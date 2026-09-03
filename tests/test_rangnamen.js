// Ein eigener Name je Dominanz-Stufe (03.09.2026, Spieler-Reklamation ueber Sascha).
//
//   node tests/test_rangnamen.js
//
// ANLASS: Stufe 163 hiess "Kosmischer Souveraen 131" - ein Sammeltitel mit hochzaehlender Zahl,
// und der Spieler fand ihn "total langweilig". Jetzt traegt jede Stufe ab 9 einen eigenen Namen
// (DOMINANCE_NAMES, 492 Stueck bis Stufe 500), darueber setzt DOMINANCE_UEBERLAUF weitere Namen
// aus zwei Wortlisten zusammen - damit auch jenseits der handgepflegten Liste nie eine Nummer
// erscheint.
//
// WARUM ES DIESEN TEST GIBT: Eine handgepflegte Liste mit fast fuenfhundert Eintraegen verliert
// beim naechsten Anfassen still ihre Eindeutigkeit. Ein doppelter Name faellt niemandem auf - der
// Spieler steigt auf und liest denselben Titel wie dreissig Stufen tiefer. Genau dieser Fall ist
// beim Erzeugen der Liste auch eingetreten: sechzehn Namen kamen doppelt vor, weil acht Autoren
// einander nicht sehen konnten.
//
// GEPRUEFT WIRD - die Funktion AUSGEFUEHRT, nicht der Quelltext gelesen:
//   1) Stufe 1-8 sind unveraendert die bekannten Dienstgrade (kein Bestandsspieler verliert seinen).
//   2) Von Stufe 1 bis 500 ist JEDER Titel eindeutig, hoechstens 26 Zeichen lang und enthaelt
//      weder Ziffer noch angehaengte roemische Zahl.
//   3) Auch weit jenseits der Liste (bis Stufe 3000) kommt nie eine Ziffer zurueck - das ist der
//      Kern der Reklamation, und genau hier war die alte Fassung schuldig.
//   4) Die Anzeigestellen rufen dominanceTitle() und tragen den Titel nicht ein zweites Mal.
//   5) Die alten Sammeltitel stehen nirgends mehr im Spiel - auch nicht im Hilfetext.
//
// DIE 26-ZEICHEN-GRENZE ist gemessen, nicht geraten: Der Titel steht am Handy in einer Zeile
// neben der Stufen-Pille ("Rang: <Name>  Stufe 163").
//
// GEGENPROBE (beidseitig, GEMESSEN am 03.09.2026 - nicht geschaetzt):
//   KEPLER_SPIELDATEI=<Spieldatei vor dieser Aenderung> node tests/test_rangnamen.js
//   Exit 1, und es fallen GENAU SIEBEN Pruefungen:
//     FAIL - 0a: die Bausteine der Namensliste sind da     (alle vier fehlen dort)
//     FAIL - 0c: die Liste ist nicht leer                  (0 Namen, 0 Ueberlauf)
//     FAIL - 2c: kein Titel traegt eine Ziffer             (492 Stueck, ab "Galaktische Legende 1")
//     FAIL - 3a: auch jenseits der Liste bleibt es ein Name (2500 Stueck, "Kosmischer Souveraen 469" aufwaerts)
//     FAIL - 3b: der Ueberlauf wiederholt sich nicht       (es gibt dort gar keinen)
//     FAIL - 3c: nach einer vollen Runde beginnt er von vorn (dito)
//     FAIL - 5a: die alten Sammeltitel sind aus dem Spiel raus
//
//   BEMERKENSWERT ist, was dort GRUEN bleibt: 2a "jede Stufe hat einen eigenen Namen". Die alten
//   Titel waren als Zeichenketten sehr wohl verschieden - "Kosmischer Souveraen 1" ist nun einmal
//   nicht "Kosmischer Souveraen 2". Die Reklamation ging also nie um Doubletten, sondern um die
//   angehaengte Zahl; 2a schuetzt die NEUE Liste vor einem Fehler, den die alte gar nicht haben
//   konnte. Ich hatte beim Schreiben dieses Kopfes vier fallende Pruefungen behauptet und 2a
//   darunter - die Messung hat beides widerlegt. Genau dafuer ist die Gegenprobe da.
//   Ebenfalls gruen dort: 1a, 1b, 2b und 4 - Dienstgrade, Laenge und Anzeigestellen waren nie das
//   Problem. Faellt in einer kuenftigen Gegenprobe eine ANDERE Pruefung, ist das ein zweiter
//   Befund und kein Beleg fuer diesen hier.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- Extraktion. Regel: Anker-Existenz VOR dem Slice pruefen, sonst laeuft indexOf auf -1 und
// der Ausschnitt reicht bis fast ans Dateiende - die Pruefungen waeren dann still gegenstandslos.
function schnitt(von, bis){
  const a = JS.indexOf(von);
  if (a < 0) return null;
  const b = JS.indexOf(bis, a);
  if (b < 0) return null;
  return JS.slice(a, b + bis.length);
}

// NUR ZWEI Bausteine sind Vorbedingung: die Dienstgrade und die Funktion selbst. Alles andere wird
// eingesammelt, WENN es da ist. Der Grund ist die Gegenprobe: Braeuchte der Test die neuen Tabellen
// zum Starten, bliebe er am alten Stand schon bei der Extraktion stehen - und ein Test, der vor der
// eigentlichen Messung abbricht, belegt nichts ausser seiner eigenen Anwesenheit. So laeuft er auf
// BEIDEN Staenden durch und die Zahlen sagen, welcher besser ist.
const pflicht = {
  titles: schnitt('const DOMINANCE_TITLES = [', '];'),
  fn:     schnitt('function dominanceTitle(lvl){', '\n  }'),
};
const fehltPflicht = Object.keys(pflicht).filter(k => !pflicht[k]);
check('0z: Dienstgrade und dominanceTitle sind auffindbar', fehltPflicht.length === 0, { fehltPflicht });
if (fehltPflicht.length) return ende();

const kuer = {
  namen: schnitt('const DOMINANCE_NAMES = [', '\n  ];'),
  vor:   schnitt('const DOMINANCE_UEBERLAUF_VOR = [', '\n  ];'),
  grund: schnitt('const DOMINANCE_UEBERLAUF_GRUND = [', '\n  ];'),
  ueber: schnitt('const DOMINANCE_UEBERLAUF = (', '})();'),
  // Nur fuer den alten Stand da, damit dessen dominanceTitle ueberhaupt laeuft und gemessen werden
  // kann. Am heutigen Stand sind beide null und dieser Zweig ist wirkungslos.
  altTiers: schnitt('const DOMINANCE_LEGEND_TIERS = [', '];'),
  altSpan:  schnitt('const DOMINANCE_LEGEND_SPAN = ', ';'),
};
const fehlend = ['namen', 'vor', 'grund', 'ueber'].filter(k => !kuer[k]);
check('0a: die Bausteine der Namensliste sind da (ein Name je Stufe statt Sammeltitel)',
  fehlend.length === 0, { fehlend });

let API = null;
try {
  const quelle = [pflicht.titles, kuer.altTiers, kuer.altSpan, kuer.namen, kuer.vor, kuer.grund, kuer.ueber, pflicht.fn]
    .filter(Boolean).join('\n');
  API = new Function(
    quelle +
    '; return { dominanceTitle, DOMINANCE_TITLES,' +
    ' DOMINANCE_NAMES: (typeof DOMINANCE_NAMES !== "undefined" ? DOMINANCE_NAMES : []),' +
    ' DOMINANCE_UEBERLAUF: (typeof DOMINANCE_UEBERLAUF !== "undefined" ? DOMINANCE_UEBERLAUF : []) };'
  )();
} catch(e){
  check('0b: die Rangnamen lassen sich ausfuehren', false, { fehler: String(e && e.message) });
  return ende();
}
check('0b: die Rangnamen lassen sich ausfuehren', typeof API.dominanceTitle === 'function');
check('0c: die Liste ist nicht leer (sonst misst der Rest nichts)',
  API.DOMINANCE_NAMES.length >= 400 && API.DOMINANCE_UEBERLAUF.length >= 500,
  { namen: API.DOMINANCE_NAMES.length, ueberlauf: API.DOMINANCE_UEBERLAUF.length });

// ---- 1) Die Dienstgrade bleiben --------------------------------------------------------------
// Bestandsspieler unter Stufe 9 sollen ihren gewohnten Titel behalten; die Reklamation betraf die
// hochzaehlenden Sammelnamen darueber, nicht diese acht.
const DIENSTGRADE = ['Rekrut','Pionier','Kommandant','Kriegsherr','Vizeadmiral','Admiral','Großadmiral','Imperator'];
const abweichend = DIENSTGRADE.map((n, i) => [i+1, n, API.dominanceTitle(i+1)]).filter(x => x[1] !== x[2]);
check('1a: Stufe 1-8 tragen unveraendert die bekannten Dienstgrade', abweichend.length === 0, abweichend);
check('1b: Stufe 0 bleibt "Neuling"', API.dominanceTitle(0) === 'Neuling', API.dominanceTitle(0));

// ---- 2) Jede Stufe bis 500 ein eigener, kurzer, zahlenfreier Name ------------------------------
const gesehen = new Map();
const doppelte = [], zuLang = [], mitZiffer = [], leer = [];
for (let lvl = 1; lvl <= 500; lvl++){
  const t = API.dominanceTitle(lvl);
  if (!t || typeof t !== 'string'){ leer.push(lvl); continue; }
  if (gesehen.has(t)) doppelte.push({ stufe: lvl, name: t, schonBei: gesehen.get(t) });
  else gesehen.set(t, lvl);
  if (t.length > 26) zuLang.push({ stufe: lvl, name: t, laenge: t.length });
  // Ziffer ODER eine angehaengte roemische Zahl - beides ist "die Zahl hinten dran", um die es geht.
  if (/[0-9]/.test(t) || /\s+[IVXLCDM]+$/.test(t)) mitZiffer.push({ stufe: lvl, name: t });
}
check('2z: jede Stufe liefert ueberhaupt einen Titel', leer.length === 0, leer.slice(0, 10));
check('2a: jede Stufe 1-500 hat einen eigenen Namen', doppelte.length === 0,
  { anzahl: doppelte.length, erste: doppelte.slice(0, 6) });
check('2b: kein Titel ist laenger als 26 Zeichen', zuLang.length === 0,
  { anzahl: zuLang.length, erste: zuLang.slice(0, 6) });
check('2c: kein Titel traegt eine Ziffer oder angehaengte roemische Zahl', mitZiffer.length === 0,
  { anzahl: mitZiffer.length, erste: mitZiffer.slice(0, 6) });

// ---- 3) Jenseits der Liste ---------------------------------------------------------------------
// Der eigentliche Kern der Reklamation: Frueher zaehlte ab Stufe 45 derselbe Sammeltitel endlos
// hoch. Ab hier muss auch die 3000. Stufe noch einen NAMEN liefern.
const spaetMitZiffer = [];
for (let lvl = 501; lvl <= 3000; lvl++){
  const t = API.dominanceTitle(lvl);
  if (!t || /[0-9]/.test(t) || /\s+[IVXLCDM]+$/.test(t)) spaetMitZiffer.push({ stufe: lvl, name: t });
}
check('3a: auch jenseits der Liste bleibt es ein Name statt einer Nummer', spaetMitZiffer.length === 0,
  { anzahl: spaetMitZiffer.length, erste: spaetMitZiffer.slice(0, 5) });
// Und die Fortsetzung wiederholt sich nicht sofort: ueber die volle Ueberlauf-Laenge hinweg muss
// jeder Titel neu sein, sonst haetten wir die Zahl nur gegen eine kurze Schleife getauscht.
const uSicht = new Set();
let uDoppelt = 0;
for (let k = 0; k < Math.min(API.DOMINANCE_UEBERLAUF.length, 4000); k++){
  const t = API.dominanceTitle(501 + k);
  if (uSicht.has(t)) uDoppelt++;
  uSicht.add(t);
}
check('3b: der Ueberlauf wiederholt sich innerhalb seiner Laenge nicht',
  API.DOMINANCE_UEBERLAUF.length > 0 && uDoppelt === 0,
  { laenge: API.DOMINANCE_UEBERLAUF.length, doppelt: uDoppelt });
// Gegenprobe zur Zeile darueber: Nach einer vollen Runde MUSS er sich wiederholen - sonst hat der
// Test gar nichts gemessen (z. B. weil die Liste leer war und immer derselbe Zweig lief).
check('3c: nach einer vollen Runde beginnt er wieder von vorn (Gegenprobe zu 3b)',
  API.DOMINANCE_UEBERLAUF.length > 0 && API.dominanceTitle(501) === API.dominanceTitle(501 + API.DOMINANCE_UEBERLAUF.length),
  { erster: API.dominanceTitle(501), nachEinerRunde: API.dominanceTitle(501 + API.DOMINANCE_UEBERLAUF.length) });

// ---- 4) Anzeigestellen -------------------------------------------------------------------------
// Nach einer Mechanik-Aenderung sitzt der Fehler fast immer in einer zweiten Stelle, die den Wert
// dem Spieler zeigt (docs/PROJECT_MEMORY.md). Hier sind es drei, und alle drei muessen die
// Funktion RUFEN statt den Titel selbst zusammenzubauen.
const rufe = (JS.match(/dominanceTitle\(/g) || []).length;
check('4a: die Anzeigestellen rufen dominanceTitle()', rufe >= 3, { rufe });
check('4b: keine Stelle baut einen Titel selbst aus Name und Nummer zusammen',
  !/DOMINANCE_NAMES\s*\[[^\]]*\]\s*\+\s*'\s*'/.test(JS) && !/dominanceTitle\([^)]*\)\s*\+\s*'\s*'\s*\+/.test(JS));

// ---- 5) Die alten Sammeltitel sind weg ---------------------------------------------------------
// Auch aus dem Hilfetext: Er beschrieb die Staffelung "Galaktische Legende 1-12" usw. und waere
// nach dieser Aenderung eine Falschaussage. Ein Hilfetext ist eine Anzeigestelle.
/* OHNE den PATCHNOTES-Block (CLAUDE.md: "Tests, die pruefen, dass ein alter Text nicht mehr
   existiert, duerfen nicht versehentlich im historischen PATCHNOTES-Block suchen").
   Gemessener Anlass: Der Patchnote zu v8.655.0 - also der dieser Aenderung selbst - ZITIERT
   den alten Sammeltitel, um zu erklaeren, was ersetzt wurde ("Stufe 163 hiess Kosmischer
   Souveraen 131"). Diese Pruefung riss daran, und zwar auf main selbst: sie war ab dem Merge
   ihres eigenen PRs rot. Patchnotes sind unveraenderliche Historie, der Wortlaut dort laesst
   sich also nicht anpassen - die Pruefung muss es. Derselbe Griff wie in
   tests/test_bedarfsliste.js (JS_OHNE_HISTORIE). */
const JS_OHNE_HISTORIE = (() => {
  const v = JS.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : JS.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? JS.slice(0, v) + JS.slice(b) : JS;
})();
check('5-anker: der PATCHNOTES-Block laesst sich herausschneiden (sonst waere 5a vacuous)',
  JS_OHNE_HISTORIE.length > 0 && JS_OHNE_HISTORIE.length < JS.length,
  { ganz: JS.length, ohneHistorie: JS_OHNE_HISTORIE.length });
const altGefunden = ['DOMINANCE_LEGEND_TIERS', 'DOMINANCE_LEGEND_SPAN', 'Kosmischer Souverän', 'Galaktische Legende 1-12']
  .filter(x => JS_OHNE_HISTORIE.indexOf(x) >= 0);
check('5a: die alten Sammeltitel stehen nirgends mehr im Spiel', altGefunden.length === 0, altGefunden);

ende();
