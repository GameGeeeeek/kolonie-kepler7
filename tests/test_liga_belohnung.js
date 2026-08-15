// Die Wochenliga-Box nennt die Belohnung, die wirklich ausgezahlt wird (15.08.2026).
//
// BEFUND. LEAGUE_DEFS trägt seit der Absenkung auf ein Fünftel `prodMin` 12/6/3/0. Die Box im
// Fortschritt-Tab nannte weiterhin „Platin 1.500 Kredite + 60 Min. Produktion, Gold 800 + 30 Min.,
// Silber 400 + 15 Min." - die Werte von VOR der Absenkung, also Faktor 5 zu viel. Der
// Hilfe-Abschnitt hatte die 12/6/3 längst; die Box war die zweite Anzeigestelle, die die alte
// Annahme behielt (CLAUDE.md Punkt 6).
//
// Das wiegt schwerer als ein schiefer Hilfetext: Es ist die einzige Stelle, an der ein Spieler
// VOR der Abrechnung liest, wofür sich das Wochenrennen lohnt - und montags kam dann ein Fünftel
// davon an.
//
// GEPRUEFT WIRD:
//   1. Die Auszahlung liest ihre Werte aus LEAGUE_DEFS (`lg.credits`, `lg.prodMin`) - dort ist die
//      Wahrheit, und dorthin muss die Anzeige zeigen.
//   2. Die Box rechnet ihre Zeile AUS LEAGUE_DEFS, statt Zahlen hinzuschreiben. Damit kann sie
//      nicht mehr zurückbleiben, wenn jemand die Balance wieder ändert - das ist die Zusage,
//      nicht „die Zahlen stimmen heute" (Arbeitsregel 3).
//   3. Keine Live-Anzeige nennt mehr eine Minutenzahl aus der Zeit vor der Absenkung. Die
//      PATCHNOTES sind davon ausgenommen: Sie sind unveränderliche Historie und nennen die alten
//      Werte völlig zu Recht - genau daran wäre eine naive Suche gescheitert, denn der Satz steht
//      dort wörtlich genauso.
//
// GEGENPROBE (Arbeitsregel 1, beidseitig ausgeführt): Am Stand v8.510.0 fallen 2 und 3 - 3 nennt
// die Zeile der Box. Setzt man am neuen Stand prodMin in LEAGUE_DEFS auf andere Werte, bleibt der
// Test grün (richtig so: die Box zieht mit), aber 1 schlägt an, sobald die Auszahlung nicht mehr
// aus LEAGUE_DEFS liest.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');

// ---- 0) Die Quelle -------------------------------------------------------------------------
const von = S.indexOf('  const LEAGUE_DEFS = [');
const bis = von < 0 ? -1 : S.indexOf('\n  ];', von);
check('0a: LEAGUE_DEFS ist auffindbar', von >= 0 && bis > von, { von, bis });
if (von < 0 || bis < 0) return ende();
const DEFS = new Function(S.slice(von, bis + 5) + '\nreturn LEAGUE_DEFS;')();
check('0b: es gibt vier Ligen mit prodMin', DEFS.length === 4 && DEFS.every(l => typeof l.prodMin === 'number'),
  DEFS.map(l => l.key + ':' + l.prodMin));

// ---- 1) Die Auszahlung liest aus LEAGUE_DEFS ------------------------------------------------
// Ohne diese Prüfung könnte jemand die Auszahlung auf eigene Zahlen umstellen, und die Box zöge
// brav eine Quelle nach, die gar nicht mehr zahlt.
const auszahlung = S.indexOf("if (r.type === 'weekly-league')");
const auszahlungEnde = auszahlung < 0 ? -1 : S.indexOf("if (r.type === 'season-league')", auszahlung);
check('1-anker: der Auszahlungszweig ist auffindbar', auszahlung >= 0 && auszahlungEnde > auszahlung);
if (auszahlung >= 0 && auszahlungEnde > auszahlung) {
  const zweig = S.slice(auszahlung, auszahlungEnde);
  check('1a: die Auszahlung nimmt die Kredite aus LEAGUE_DEFS', /lg\.credits/.test(zweig));
  check('1b: und die Produktionsminuten ebenso', /lg\.prodMin/.test(zweig));
  check('1c: der Liga-Eintrag stammt aus LEAGUE_DEFS', /LEAGUE_DEFS\.find\(/.test(zweig));
}

// ---- 2) Die Box rechnet aus derselben Quelle ------------------------------------------------
check('2: die Wochenliga-Box baut ihre Belohnungszeile aus LEAGUE_DEFS',
  /Montags gibt es die Liga-Belohnung: \$\{LEAGUE_DEFS\.map\(/.test(S));

// ---- 3) Keine Live-Anzeige nennt mehr die alten Minutenwerte ---------------------------------
// Die PATCHNOTES nennen 60/30/15 zu Recht (unveränderliche Historie). Sie werden deshalb
// ausgeschnitten, BEVOR gesucht wird - und der Endanker wird zuerst auf Existenz geprüft
// (Arbeitsregel 6), sonst liefe der Ausschnitt bis fast ans Dateiende und die Prüfung wäre
// gehaltlos.
const pnVon = S.indexOf('  const PATCHNOTES = [');
const pnBis = pnVon < 0 ? -1 : S.indexOf('\n  ];', pnVon);
check('3-anker: der PATCHNOTES-Block ist sauber abgegrenzt', pnVon >= 0 && pnBis > pnVon, { pnVon, pnBis });
if (pnVon >= 0 && pnBis > pnVon) {
  const ohnePatchnotes = S.slice(0, pnVon) + S.slice(pnBis);
  const alteWerte = DEFS.filter(l => l.prodMin > 0).map(l => l.prodMin * 5); // 60/30/15
  const treffer = [];
  ohnePatchnotes.split('\n').forEach((z, i) => {
    if (alteWerte.some(w => z.indexOf(w + ' Min') >= 0) && /Liga|Platin|Gold|Silber/.test(z)) {
      treffer.push({ zeile: i + 1, text: z.trim().slice(0, 110) });
    }
  });
  check('3: keine Live-Anzeige nennt mehr die Werte von vor der Absenkung', treffer.length === 0, treffer);
  // Die Gegenprobe zur Gegenprobe: Der Ausschnitt muss die Historie WIRKLICH noch enthalten -
  // sonst hätte man die alten Werte nur aus dem Suchraum geschnitten statt aus der Anzeige.
  check('3-gegen: die Patchnotes-Historie nennt die alten Werte weiterhin',
    S.slice(pnVon, pnBis).indexOf('60/30/15') >= 0);
}

ende();
