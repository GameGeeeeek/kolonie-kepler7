// Die Tier-2-Fabrikkarte rechnet mit denselben Faktoren wie die Fabrik (15.08.2026).
//
// BEFUND. Die Engine (tier2Step) skaliert den Durchsatz mit drei Boni - Weltprojekt „Galaktische
// Verbundraffinerie" (+10%), Fähigkeitsbaum eco7 „Raffinerie-Taktgeber" (+10%, additiv dazu) und
// Raffinerie-Optimierung (+3% je Stufe, max +30%, multiplikativ darauf) - und senkt den Input mit
// dem Gravitations-Stabilisator (bis −20%). Die Karte im Basis-Tab zeigte `totalLevel *
// ratePerLevel` ROH: bei vollem Ausbau bis zu 56% zu wenig Produktion und 25% zu viel Verbrauch.
//
// Besonders schief war das, weil die Ressourcenleiste im selben Moment den ECHTEN Wert nannte -
// sie geht über den Trockenlauf tier2RatesPerSecond, der tier2Step benutzt. Zwei Anzeigen
// derselben Größe, die sich widersprachen, und der Kommentar an der Engine versprach ausdrücklich,
// „echter Tick und Anzeige-Trockenlauf" blieben identisch. Für die Ressourcenleiste stimmte das,
// für die Fabrikkarte nie.
//
// GEPRUEFT WIRD - und warum so:
//   1. Der Durchsatz steht als EINE Funktion da (tier2DurchsatzMult), nicht zweimal. Eine zweite
//      Kopie in der Karte hätte den Fehler behoben und die Fehlerquelle behalten.
//   2. Die Engine benutzt sie, und die Karte auch. Das ist die Zusage - nicht „die Zahlen stimmen
//      heute" (Arbeitsregel 3).
//   3. Der INHALT, ausgeführt statt gelesen: Weltprojekt und Fähigkeitsbaum zählen additiv, die
//      Raffinerie-Optimierung multiplikativ darauf, und der Stabilisator ist bei −20% gedeckelt.
//      Ein Test, der nur Funktionsnamen sucht, bliebe grün, wenn jemand die Faktoren verstellt.
//   4. Niemand rechnet `ratePerLevel` mehr an einer dritten Stelle roh hoch - das fasst auch einen
//      künftigen Aufrufer.
//
// GEGENPROBE (Arbeitsregel 1, beidseitig ausgeführt):
//   - Am Stand v8.514.0 fallen 1 (die Funktion gibt es nicht), 2b (die Karte ruft sie nicht) und 4
//     nennt die Kartenzeile, die roh rechnet.
//   - Setzt man am neuen Stand die additive Gruppe auf eine Multiplikator-Kette um, fällt 3a.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');

// ---- 1) Die Regel steht einmal --------------------------------------------------------------
const n = (S.match(/function tier2DurchsatzMult\s*\(/g) || []).length;
check('1: tier2DurchsatzMult ist genau einmal definiert', n === 1, { gefunden: n });

// ---- 2) Engine UND Karte rufen sie ----------------------------------------------------------
function ausschnitt(vonMarke, bisMarke, name) {
  const a = S.indexOf(vonMarke);
  const b = a < 0 ? -1 : S.indexOf(bisMarke, a);
  check('2-anker: ' + name + ' - beide Marken gefunden', a >= 0 && b > a, { a, b });
  return (a >= 0 && b > a) ? S.slice(a, b) : '';
}
const engine = ausschnitt('  function tier2Step(def, resources, seconds, grund){', '\n    const inMult = gravInputMult();', 'Engine');
check('2a: die Engine bildet ihren Durchsatz mit tier2DurchsatzMult',
  /const want = totalLevel \* def\.ratePerLevel \* seconds \* tier2DurchsatzMult\(\)/.test(engine));

const karte = ausschnitt("const t2def = TIER2_DEFS.find(t2=>t2.buildingKey===def.key);", "} else if (def.key==='hochsicherheitslager')", 'Fabrikkarte');
check('2b: die Karte rechnet ihre Produktion über dieselbe Funktion',
  /const t2Durchsatz = tier2DurchsatzMult\(\)/.test(karte)
  && /rateNow = totalNow\*t2def\.ratePerLevel\*t2Durchsatz/.test(karte)
  && /rateNext = totalNext\*t2def\.ratePerLevel\*t2Durchsatz/.test(karte));
check('2c: und ihren Verbrauch über gravInputMult - sonst weist sie zu viel aus',
  /const t2InMult = gravInputMult\(\)/.test(karte) && /rate\*amt\*t2InMult/.test(karte));

// ---- 3) Der Inhalt der Regeln, ausgeführt ----------------------------------------------------
const von = S.indexOf('  function raffinerieThroughputMult()');
const bis = S.indexOf('  // `grund` (optional)', von);
check('3-anker: der Faktorenblock ist auffindbar', von >= 0 && bis > von, { von, bis });
let f = null;
if (von >= 0 && bis > von) {
  const stubs = `
    let FORSCH = 0, GRAV = 0, WP = false, SKILL = 0;
    const state = { get research(){ return { rraffinerieoptimierung: FORSCH }; },
                    get allianceResearch(){ return WP ? { wp_verbundraffinerie: 1 } : {}; } };
    function allBuildingSets(){ return [{ gravkompressor: GRAV }]; }
    function skillTier2Bonus(){ return SKILL; }
    function setz(f, g, w, sk){ FORSCH = f; GRAV = g; WP = w; SKILL = sk; }
  `;
  // Sturzsicher bauen: Fehlt die Funktion (genau der Fall, gegen den dieser Test anschlagen soll),
  // wirft new Function einen ReferenceError - und dann liefen die Prüfungen DANACH, vor allem die
  // Aufrufer-Prüfung 4, überhaupt nicht mehr. Genau so war es am alten Stand: Der Test war rot,
  // aber aus dem falschen Grund, und was 4 zu sagen gehabt hätte, hat nie jemand gesehen.
  // Ein abgestürzter Test ist kein durchgeführter Test (Arbeitsregel 25, andere Richtung).
  let bauFehler = null;
  try {
    f = new Function(stubs + S.slice(von, bis)
      + '\nreturn { durchsatz: tier2DurchsatzMult, grav: gravInputMult, setz };')();
  } catch (e) { bauFehler = e.message; }
  check('3-bau: der Faktorenblock lässt sich ausführen', !!f, bauFehler);
}
if (f) {
  f.setz(0, 0, false, 0);
  check('3a: ohne alles ist der Durchsatz 1,0', Math.abs(f.durchsatz() - 1) < 1e-9, f.durchsatz());
  // Additiv, nicht multiplikativ: 1 + 0,10 + 0,10 = 1,20 - eine Kette ergäbe 1,21.
  f.setz(0, 0, true, 0.10);
  check('3b: Weltprojekt und Fähigkeitsbaum zählen ADDITIV (1,20 statt 1,21)',
    Math.abs(f.durchsatz() - 1.20) < 1e-9, f.durchsatz());
  // Und die Forschung multipliziert darauf: 1,20 * 1,30 = 1,56.
  f.setz(10, 0, true, 0.10);
  check('3c: die Raffinerie-Optimierung multipliziert darauf (1,56 bei Vollausbau)',
    Math.abs(f.durchsatz() - 1.56) < 1e-9, f.durchsatz());
  f.setz(99, 0, false, 0);
  check('3d: die Optimierung ist bei +30% gedeckelt, auch über Stufe 10',
    Math.abs(f.durchsatz() - 1.30) < 1e-9, f.durchsatz());
  f.setz(0, 50, false, 0);
  check('3e: der Gravitations-Stabilisator ist bei -20% gedeckelt',
    Math.abs(f.grav() - 0.80) < 1e-9, f.grav());
}

// ---- 4) Niemand rechnet ratePerLevel mehr roh hoch -------------------------------------------
// Kommentare vorher leeren (Arbeitsregel 33), sonst zählt ein erklärender Kommentar mit.
const ohneKommentar = S
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/^([^\n]*?)\/\/[^\n]*$/gm, (m, vor) => vor);
const ERLAUBT = [
  /const want = totalLevel \* def\.ratePerLevel \* seconds \* tier2DurchsatzMult\(\)/,
  /rateNow = totalNow\*t2def\.ratePerLevel\*t2Durchsatz/,
  /rateNext = totalNext\*t2def\.ratePerLevel\*t2Durchsatz/,
  /ratePerLevel:/          // die Tabelleneinträge selbst
];
const fremd = [];
ohneKommentar.split('\n').forEach((z, i) => {
  if (z.indexOf('ratePerLevel') >= 0 && !ERLAUBT.some(r => r.test(z))) {
    fremd.push({ zeile: i + 1, text: z.trim().slice(0, 110) });
  }
});
check('4: jede Stelle, die ratePerLevel hochrechnet, nimmt den Durchsatz mit', fremd.length === 0, fremd);

ende();
