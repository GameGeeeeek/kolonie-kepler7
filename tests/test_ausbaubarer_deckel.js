// Der ausbaubare Deckel - Schritt 2 des Deckel-Umbaus (v8.483.0, Wunsch Sascha).
//
// HINTERGRUND: Schritt 1 (v8.468.0/v8.477.0) nahm der Grenze die KLIPPE - darueber zaehlt jeder
// Punkt noch etwas. Die Grenze selbst stand aber fest. Der Aufstiegs-Zweig 'grenzen' hebt sie
// jetzt um 3% je Stufe, bei ALLEN Toepfen zugleich.
//
// GEPRUEFT WIRD:
//   1) Der Zweig existiert, ist vollstaendig beschrieben und in allen Vorbelegungen enthalten -
//      ein fehlender Schluessel in der Migration hiesse: Bestandskonten bekommen ihn nie.
//   2) `weicherDeckel` ist UNVERAENDERT rein geblieben. Das ist keine Formalie: Der Ausbau steckt
//      bewusst an den Aufrufstellen, weil die Paritaetspruefung genau diese Funktion vergleicht -
//      steckte er darin und im Backend nicht, waeren beide OHNE Aufstieg identisch und MIT
//      Aufstieg verschieden, und der Vergleich faende es nicht.
//   3) Der Ausbau WIRKT - gemessen an der ausgefuehrten Rechnung, nicht am Quelltext: Bei Stufe 0
//      exakt wie vorher, bei Stufe 10 genau +30%, darueber gedaempft.
//   4) Spiel und Server rechnen denselben Faktor - beide Fassungen ausgefuehrt und verglichen.
//   5) Die Bilanz zeigt den AUSGEBAUTEN Deckel und schlaegt ihn nicht doppelt auf.
//
// GEGENPROBE (Arbeitsregel 1, beidseitig ausgefuehrt): am alten Stand (v8.477.0) gibt es weder
// Zweig noch Huellenaufruf - 1, 3 und 4 fallen durch.
const fs = require('fs');
const path = require('path');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const BE_PFAD = path.join(path.dirname(SPIELDATEI), '..', 'kolonie-kepler7-backend', 'server.js');
const hatBackend = fs.existsSync(BE_PFAD);
const BE = hatBackend ? fs.readFileSync(BE_PFAD, 'utf8') : '';
check('Backend-Repo liegt daneben (ohne es ist die Paritaet UNGEPRUEFT)', hatBackend);

// ---- 1) Zweig vorhanden, beschrieben, in ALLEN Vorbelegungen
check('1a: der Zweig "Verschobene Grenzen" steht im Aufstiegsbaum',
  /\{ key:'grenzen', name:'Verschobene Grenzen', icon:'ti-infinity'/.test(JS));
// CLAUDE.md Punkt 7: eigenes Icon UND vollstaendige, selbsterklaerende Beschreibung.
const beschreibung = (JS.match(/key:'grenzen'[^}]*desc:'([^']+)'/) || [])[1] || '';
check('1b: die Beschreibung nennt Wirkung, Umfang und das Verhalten des Ueberlaufs',
  beschreibung.length > 120 && /3%/.test(beschreibung) && /Überlauf/.test(beschreibung),
  beschreibung.slice(0, 90));
// Fehlt der Schluessel in einer Vorbelegung, bekaemen Bestandskonten den Zweig nie zu sehen.
const vorbelegungen = (JS.match(/tree: \{ prod:0[^}]*\}|tree = \{ prod:0[^}]*\}/g) || []);
check('1c: alle Vorbelegungen des Baums kennen den Zweig',
  vorbelegungen.length >= 3 && vorbelegungen.every(v => v.includes('grenzen:0')),
  { gefunden: vorbelegungen.length, ohne: vorbelegungen.filter(v => !v.includes('grenzen:0')).length });

// ---- 2) weicherDeckel ist rein geblieben
const von = JS.indexOf('const UEBERLAUF_ANTEIL = ');
const bis = von < 0 ? -1 : JS.indexOf('\n  const PROD_BONUS_CAP', von);
check('2a: der weicherDeckel-Block ist auffindbar', von > 0 && bis > von);
const quelle = JS.slice(von, bis);
check('2b: weicherDeckel selbst kennt den Ausbau NICHT (sonst waere die Paritaet blind)',
  !/function weicherDeckel[\s\S]*?\n  \}/.exec(quelle)[0].includes('deckelAusbau'));
check('2c: es gibt einen Huellenaufruf, der ihn anwendet',
  quelle.includes('function deckelWeich(roh, basisDeckel, spielraum){') &&
  quelle.includes('weicherDeckel(roh, basisDeckel * deckelAusbau(), spielraum)'));
// Alle Toepfe laufen ueber den Huellenaufruf, keiner mehr direkt.
const direkt = (JS.match(/(^|[^a-zA-Z])weicherDeckel\(/gm) || []).length;
check('2d: nur Definition, Huellenaufruf und die Bilanz rufen weicherDeckel direkt',
  direkt === 3, { direkteAufrufe: direkt });

// ---- 3) Der Ausbau WIRKT - die echte Rechnung ausgefuehrt
{
  const holen = (txt, ankerVon, ankerBis) => {
    const a = txt.indexOf(ankerVon), b = a < 0 ? -1 : txt.indexOf(ankerBis, a);
    return (a < 0 || b < 0) ? null : txt.slice(a, b);
  };
  // Die Daempfungsrechnung des Baums samt Ausbau-Satz aus der Datei holen und ausfuehren.
  const teil = holen(JS, '  const ASCENSION_SOFT_CAP = 10;', '  function canAscend()');
  check('3a: die Aufstiegs-Rechnung ist auffindbar', !!teil);
  if (teil){
    const fe = new Function('state', teil + `
      return { ascBonus, DECKEL_AUSBAU_PRO_STUFE, faktor: () => 1 + DECKEL_AUSBAU_PRO_STUFE * ascBonus('grenzen') };`);
    const mit = (lvl) => fe({ ascension: { tree: { grenzen: lvl } } }).faktor();
    check('3b: ohne Aufstieg aendert sich NICHTS (Faktor exakt 1)', mit(0) === 1, mit(0));
    check('3c: Stufe 10 hebt jede Grenze um genau 30%', Math.abs(mit(10) - 1.30) < 1e-12, mit(10));
    // Jenseits des Softcaps nur noch ein Fuenftel je Stufe - sonst waere der Zweig eine
    // Zahlenexplosion statt einer Achse.
    check('3d: darueber gedaempft (Stufe 20 nicht doppelt so stark wie Stufe 10)',
      Math.abs(mit(20) - 1.36) < 1e-12 && mit(20) < mit(10) * 2, mit(20));
    check('3e: streng monoton - jede weitere Stufe bringt noch etwas',
      mit(11) > mit(10) && mit(50) > mit(20), { s11: mit(11), s50: mit(50) });
  }
}

// ---- 4) Paritaet: Spiel und Server rechnen denselben Faktor
if (hatBackend){
  const beVon = BE.indexOf('const ASCENSION_SOFT_CAP = 10;');
  const beBis = beVon < 0 ? -1 : BE.indexOf('\nfunction attackBonusGroup', beVon);
  check('4a: die Backend-Fassung ist auffindbar', beVon > 0 && beBis > beVon);
  const feTeil = JS.slice(JS.indexOf('  const ASCENSION_SOFT_CAP = 10;'), JS.indexOf('  function canAscend()'));
  if (beVon > 0 && beBis > beVon && feTeil){
    const feF = new Function('state', feTeil + `
      return (lvl) => { state.ascension = { tree: { grenzen: lvl } }; return 1 + DECKEL_AUSBAU_PRO_STUFE * ascBonus('grenzen'); };`)({});
    const beF = new Function(BE.slice(beVon, beBis) + '\nreturn (lvl) => deckelAusbauServer({ ascension: { tree: { grenzen: lvl } } });')();
    let groessteAbweichung = 0, beispiel = null;
    for (let lvl = 0; lvl <= 60; lvl++){
      const d = Math.abs(feF(lvl) - beF(lvl));
      if (d > groessteAbweichung){ groessteAbweichung = d; beispiel = { lvl, fe: feF(lvl), be: beF(lvl) }; }
    }
    check('4b: Spiel und Server rechnen den Ausbau ueber alle Stufen IDENTISCH',
      groessteAbweichung < 1e-12, { groessteAbweichung, beispiel });
    check('4c: und er wirkt dort wirklich (Faktor bei Stufe 10 ist 1,30)',
      Math.abs(beF(10) - 1.30) < 1e-12, beF(10));
  }
  // Alle vier PvP-Stellen im Backend ziehen den Faktor mit.
  for (const [name, fragment] of [
    ['Angriff/Verteidigung', 'weicherDeckel(b, 1.0 * deckelAusbauServer(save))'],
    ['Schiffsmodul-Angriff', 'weicherDeckel(sum, 1.0 * deckelAusbauServer(save))'],
    ['Ueberfall-Schutz',     'weicherDeckel(roh, 0.6 * deckelAusbauServer(save))']
  ]) check('4d: Backend - ' + name.padEnd(21) + ' zieht den Ausbau mit', BE.includes(fragment));
  check('4d: Backend - Angriff UND Verteidigung, nicht nur eines',
    (BE.match(/weicherDeckel\(b, 1\.0 \* deckelAusbauServer\(save\)\)/g) || []).length === 2);
}

// ---- 5) Die Bilanz zeigt den ausgebauten Deckel, aber nur einfach
check('5a: die Bilanz zeigt den AUSGEBAUTEN Deckel',
  JS.includes('const deckel = g.deckel() * deckelAusbau();'));
check('5b: und schlaegt ihn nicht doppelt auf (weicherDeckel statt deckelWeich)',
  JS.includes('const weich = weicherDeckel(roh, deckel);') &&
  !JS.includes('const weich = deckelWeich(roh, deckel);'));

ende();
