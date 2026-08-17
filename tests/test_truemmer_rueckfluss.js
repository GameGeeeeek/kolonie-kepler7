// Etappe A3 des Wirtschafts-Rebalance-Konzepts (docs/wirtschaft-rebalance-konzept.md):
// Aus verlorenem Schiffsgewicht entsteht weniger Trümmergut (Faktor 8 -> 3), damit ein verlorener
// Kampf wieder etwas kostet. Gemessener Anlass: Bei Faktor 8 erstattete das Trümmerfeld 55 % des
// Erz- und 86 % des Kristall-Nachbaus - ein 15-%-Flottenverlust kostete netto ~20 Sekunden
// Produktion, abgewehrte Überfälle waren sogar ein GEWINN.
//
// Der Test hält drei Dinge fest, die beim Bauen je einzeln schiefgehen können:
//   (1) Der Faktor lebt an EINER Stelle. Er stand als Literal an drei Stellen - darunter die
//       Trümmer-VORSCHAU im Spähbericht, deren Kommentar verspricht, sie passe zur echten Menge.
//       Wer nur zwei anfasst, macht ausgerechnet die Vorschau zur Lüge (Hausregel 6).
//   (2) Die 60/30-Aufteilung bleibt - geprüft am AUSGEFÜHRTEN Block, nicht am Quelltext.
//   (3) Die Mondschwelle wandert mit. Monde entstehen aus Trümmerfeldern; bliebe die Schwelle
//       stehen, dauerte eine Mondbildung 2,67-mal so lange - eine Inhalts-Bremse, die diese
//       Wirtschafts-Änderung nicht beabsichtigt. Geprüft wird das VERHÄLTNIS, nicht die Zahl:
//       so bleibt der Test gültig, wenn später beide Werte gemeinsam wandern (Regel 3).
//
// Gegenprobe (beidseitig gefahren, 17.08.2026): Am alten Stand (v8.554.0) fallen 2a (Faktor 8),
// 3 (Schwelle 4000 gegen Faktor 3) und 4b (Hilfetext nennt 4.000); mit nur zwei von drei
// umgestellten Rechenstellen fällt 1b.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');

const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = S.match(/<script>([\s\S]*)<\/script>/)[1];

// Verneinende Prüfungen dürfen den PATCHNOTES-Block nicht mitlesen (Regel 46): Der Eintrag zu
// dieser Auslieferung zitiert die alten Zahlen, um zu erklären, was sich geändert hat.
const OHNE_HISTORIE = (() => {
  const v = S.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : S.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? S.slice(0, v) + S.slice(b) : S;
})();
// Kommentare leeren, bevor Rechenstellen GEZÄHLT werden (Regel 33): Die Begründung an der
// Konstante zitiert "8" und "3" mehrfach, ein Zähler über den rohen Quelltext sähe den
// Unterschied nicht.
const OHNE_KOMMENTARE = OHNE_HISTORIE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

// ---------- 1: EINE Rechenstelle ----------
check('1a: die gemeinsame Quelle existiert (Konstante + beide Helfer)',
  /const TRUEMMER_JE_GEWICHT\s*=\s*\d+/.test(JS) &&
  /function truemmerMenge\(/.test(JS) && /function truemmerAus\(/.test(JS));
{
  // Kein `debrisWeight * <zahl>` mehr irgendwo - egal welcher Faktor dort stünde.
  const rohe = [...OHNE_KOMMENTARE.matchAll(/debrisWeight\s*\*\s*[\d.]+/g)].map(m => m[0]);
  check('1b: keine rohe Multiplikation von debrisWeight mehr im Code (alle drei Stellen delegieren)',
    rohe.length === 0, { gefunden: rohe });
  // Und die drei Aufrufer sind wirklich da - verschwindet einer, ist das genauso ein Befund
  // wie eine neue rohe Stelle (Regel 33, Gegenrichtung).
  const nutzer = (OHNE_KOMMENTARE.match(/truemmerMenge\(|truemmerAus\(/g) || []).length;
  check('1c: mindestens drei Aufrufstellen nutzen die gemeinsame Quelle (Vorschau, Basis-Angriff, Kampf)',
    nutzer >= 4, { aufrufe: nutzer, hinweis: '3 Aufrufer + truemmerMenge-Aufruf in truemmerAus' });
}

// ---------- 2: der Block AUSGEFÜHRT (Regel 43: Verhalten messen, nicht lesen) ----------
let API = null;
try {
  const von = JS.indexOf('const TRUEMMER_JE_GEWICHT');
  const bis = JS.indexOf('const SHIP_SCORE_WEIGHTS');
  API = new Function(`${JS.slice(von, bis)}
    return { TRUEMMER_JE_GEWICHT, truemmerMenge, truemmerAus };`)();
  check('2-bau: der Trümmer-Block lässt sich ausführen', !!API && typeof API.truemmerAus === 'function');
} catch (e) {
  check('2-bau: der Trümmer-Block lässt sich ausführen', false, String(e).slice(0, 160));
}

if (API) {
  check('2a: der Faktor ist gesenkt (war 8)', API.TRUEMMER_JE_GEWICHT === 3, { faktor: API.TRUEMMER_JE_GEWICHT });
  const t = API.truemmerAus(1000);
  // Erwartung aus der Konstante ABGELEITET, nicht eingetippt - so bleibt die Prüfung gültig,
  // wenn der Faktor später erneut justiert wird (Regel 2/3).
  const menge = 1000 * API.TRUEMMER_JE_GEWICHT;
  check('2b: die 60/30-Aufteilung gilt unverändert',
    t.erz === Math.round(menge*0.6) && t.kristalle === Math.round(menge*0.3), { t, menge });
  check('2c: truemmerMenge und truemmerAus rechnen mit demselben Faktor',
    API.truemmerMenge(1000) === menge, { menge: API.truemmerMenge(1000) });
  check('2d: kein Trümmergut aus Gewicht 0 (kein Freibetrag)',
    API.truemmerAus(0).erz === 0 && API.truemmerAus(0).kristalle === 0);

  // Die Kernaussage der Etappe, an der Erstattungsquote gemessen: Bei Faktor 8 bekam der
  // Verteidiger mehr als die Hälfte des Erz-Nachbaus zurück. SHIP_SCORE_WEIGHTS ist das Gewicht,
  // die Baukosten sind eine andere Größe - deshalb wird hier nur die RELATIVE Senkung geprüft.
  const alt = { erz: Math.round(1000*8*0.6), kristalle: Math.round(1000*8*0.3) };
  check('2e: die Erstattung ist auf gut ein Drittel des alten Werts gefallen',
    Math.abs(t.erz/alt.erz - 3/8) < 0.01 && Math.abs(t.kristalle/alt.kristalle - 3/8) < 0.01,
    { neu: t, alt, verhaeltnis: (t.erz/alt.erz).toFixed(3) });
}

// ---------- 3: die Mondschwelle wandert mit ----------
{
  const mFaktor = JS.match(/const TRUEMMER_JE_GEWICHT\s*=\s*(\d+)/);
  const mSchwelle = JS.match(/const MOON_FORMATION_THRESHOLD\s*=\s*(\d+)/);
  check('3-vorab: beide Konstanten gefunden', !!mFaktor && !!mSchwelle,
    { faktor: mFaktor && mFaktor[1], schwelle: mSchwelle && mSchwelle[1] });
  if (mFaktor && mSchwelle){
    // Das VERHÄLTNIS ist die geprüfte Regel, nicht die einzelne Zahl: Vor der Änderung galt
    // 4000 zu 8 = 500 Gewichtseinheiten bis zum Mond. Genau das muss erhalten bleiben, sonst
    // wird die Mondbildung still schneller oder langsamer.
    const gewichtBisMond = Number(mSchwelle[1]) / Number(mFaktor[1]);
    check('3: Schwelle und Faktor stehen im alten Verhältnis - Mondbildung gleich schnell wie vorher',
      Math.abs(gewichtBisMond - 500) < 1,
      { schwelle: mSchwelle[1], faktor: mFaktor[1], gewichtBisMond, vorher: 4000/8 });
  }
}

// ---------- 4: Anzeigestellen ----------
check('4a: die Vorschau im Spähbericht rechnet über dieselbe Quelle',
  /estDebris = truemmerMenge\(/.test(JS));
check('4b: der Hilfetext nennt die neue Mondschwelle, nicht mehr die alte',
  OHNE_HISTORIE.includes('1.500 Ressourcen') && !OHNE_HISTORIE.includes('<strong>4.000 Ressourcen</strong>'));
check('4c: der Trümmerfeld-Hilfetext sagt die kleinere Menge an',
  /Trümmerfelder[\s\S]{0,400}deutlich weniger/.test(OHNE_HISTORIE));

ende();
