// Event-Schiffe tragen Frachtraum - und der Erzgreifer-Ausleger wirkt endlich (28.08.2026).
//
// Der Anlass ist ein Modul, das seit v8.310.0 etwas verspricht, das kein Code einloest:
// ev_erzgreifer ("erhoeht die Frachtkapazitaet aller Event-Schiffe deutlich") traegt den Effekt
// 'cargo' und die Klasse 'eventflotte'. Gelesen wurde 'cargo' aber ausschliesslich als
// shipModuleBonusFor('frachter', 'cargo') - und alle drei Frachtschiffe gehoeren zur Klasse
// 'frachter'. Event-Schiffe hatten ueberhaupt keinen Frachtraum, auf den ein Prozentsatz haette
// wirken koennen. Gemessen war die Wirkung des Moduls damit exakt NULL, in jeder Mission.
//
// Dieser Test misst die WIRKUNG, nicht die Beschriftung: Jede Aussage wird als PAAR gefahren -
// zwei Laeufe, identisch bis auf einen Punkt, und die Zahl muss sich unterscheiden. Eine Pruefung
// auf "das Wort Frachtraum steht da" waere in beiden Faellen gruen.
const { SPIELDATEI } = require('./lib/spieldatei');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const S = fs.readFileSync(SPIELDATEI, 'utf8');
// Kommentare leeren (Regel 33): Sie zitieren Konstantennamen und Rechenformen und wuerden sonst
// als Fundstelle zaehlen. GELEERT statt entfernt, damit Zeilennummern in Belegen stimmen.
const JS = S.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
            .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));

// ---- Schneider: transitiv, ohne Namensliste ------------------------------------------------------
// Eine feste Bausteinliste haette genau die Schwaeche, gegen die dieser Test gebaut ist (Regel 40) -
// und sie faellt beim naechsten Umbau der geschnittenen Funktionen still aus. Gesammelt wird
// deshalb entlang der Laufzeitfehler: was fehlt, sagt der Interpreter selbst.
function schneideConst(name){
  const start = JS.indexOf('\n  const ' + name + ' = ');
  if (start < 0) return null;
  let tiefe = 0;
  for (let j = start; j < JS.length; j++){
    const c = JS[j];
    if (c === '{' || c === '[' || c === '(') tiefe++;
    else if (c === '}' || c === ']' || c === ')') tiefe--;
    else if (c === ';' && tiefe === 0) return JS.slice(start, j + 1);
  }
  return null;
}
function schneideFn(name){
  const start = JS.indexOf('\n  function ' + name + '(');
  if (start < 0) return null;
  let i = JS.indexOf('{', start), tiefe = 0;
  for (let j = i; j < JS.length; j++){
    if (JS[j] === '{') tiefe++;
    else if (JS[j] === '}') { tiefe--; if (tiefe === 0) return JS.slice(start, j + 1); }
  }
  return null;
}

// Die Stuecke werden in der Reihenfolge der ORIGINALDATEI zusammengesetzt, nicht in der Reihenfolge
// ihrer Entdeckung: CARGO_SHIP_KEYS ist Object.keys(CARGO_PER_SHIP) und wird beim Laden ausgewertet -
// stuende es davor, faende es seine Quelle in der temporalen Todeszone (Regel 38 im Kleinen).
const teile = [];
const sortiert = () => teile.slice().sort((a, b) => a.i - b.i).map(t => t.txt).join('\n');
let bauFehler = null;
// Der Aufbau UND jeder Aufruf laufen durch dieselbe Schleife: Eine geschnittene Funktion wirft
// haeufig erst beim AUFRUF, nicht beim Bauen - ein try/catch nur um das Zusammensetzen genuegt
// deshalb nicht (die Lehre aus 4-bau3 in test_schiffsmodul_paritaet).
function messen(fn){
  for (let runde = 0; runde < 80; runde++){
    try {
      const bau = new Function('state', sortiert() + '\nreturn { fleetCargoCapacity, mineLaderaum, shipClassKeyFor, CARGO_PER_SHIP, MINE_CARGO_JE_SCHIFF };');
      return fn(bau);
    } catch (e) {
      const m = /^(\w+) is not defined/.exec(e.message);
      if (!m) { bauFehler = e.message; return null; }
      const stueck = schneideConst(m[1]) || schneideFn(m[1]);
      if (!stueck) { bauFehler = 'nicht schneidbar: ' + m[1]; return null; }
      teile.push({ i: JS.indexOf(stueck), txt: stueck });
    }
  }
  bauFehler = 'nach 80 Runden unvollstaendig';
  return null;
}

const leererStand = () => ({ equippedShipModules: {}, shipModules: {}, modules: {}, research: {}, shipMarks: {} });
// Ein Lauf = ein eigener Spielstand. Ein gemeinsames Objekt haette den zweiten Lauf vom ersten
// abhaengig gemacht - dieselbe Falle wie bei test_kartenmarker.
const fracht = (flotte, module) => messen(api => api(Object.assign(leererStand(), { equippedShipModules: module || {} })).fleetCargoCapacity(flotte));
const bergbau = (flotte, module) => messen(api => api(Object.assign(leererStand(), { equippedShipModules: module || {} })).mineLaderaum(flotte));
const klasseVon = (k) => messen(api => api(leererStand()).shipClassKeyFor(k));
const ERZ = { eventflotte: ['ev_erzgreifer:gewoehnlich:1'] };
const FRACHTMODUL = { frachter: ['fr_frachtraum:gewoehnlich:1'] };

// ---- 1. Die Rechnung laeuft ueberhaupt -----------------------------------------------------------
const probe = fracht({ frachter: 1 });
check('1-bau: fleetCargoCapacity laesst sich schneiden und ausfuehren', probe === 300, bauFehler || probe);
if (probe !== 300) { console.log('\nFAIL'); process.exit(1); }

// ---- 2. Event-Schiffe tragen Ladung --------------------------------------------------------------
const EVENT_MIT_FRACHT = ['enterschiff', 'phantomschiff', 'riftwaechter'];
const ohneFrachter = fracht({ enterschiff: 4, phantomschiff: 4, riftwaechter: 4 });
check('2a: ein reiner Event-Verband hat Frachtraum (vorher exakt 0)', ohneFrachter > 0, ohneFrachter);
check('2b: jedes der drei Schiffe traegt einzeln etwas bei', EVENT_MIT_FRACHT.every(k => fracht({ [k]: 1 }) > 0),
  EVENT_MIT_FRACHT.map(k => k + '=' + fracht({ [k]: 1 })));
// Die Groessenordnung ist die Zusage der Etappe: kein Frachterersatz. Geprueft als VERHAELTNIS zum
// Kleinen Frachter, nicht als Literal - eine Momentaufnahme waere beim naechsten Balance-Schritt rot.
const jeEvent = fracht({ enterschiff: 1 });
const jeFrachter = fracht({ frachter: 1 });
check('2c: ein Event-Schiff traegt deutlich weniger als ein Kleiner Frachter (kein Frachterersatz)',
  jeEvent > 0 && jeEvent <= jeFrachter / 3, { eventSchiff: jeEvent, kleinerFrachter: jeFrachter });

// ---- 3. Der Erzgreifer wirkt - als PAAR gemessen -------------------------------------------------
// Zwei Laeufe, identische Flotte, einziger Unterschied ist das ausgeruestete Modul.
const evOhne = fracht({ enterschiff: 10 });
const evMit  = fracht({ enterschiff: 10 }, ERZ);
check('3a: der Erzgreifer erhoeht den Frachtraum der Event-Schiffe', evMit > evOhne, { ohne: evOhne, mit: evMit });
// Die Gegenrichtung: Er darf NICHT auf Frachter wirken - sonst waere aus einem Event-Modul
// stillschweigend ein Frachter-Modul geworden.
const frOhne = fracht({ frachter: 10 });
const frMit  = fracht({ frachter: 10 }, ERZ);
check('3b: er wirkt NICHT auf Frachter', frMit === frOhne, { ohne: frOhne, mit: frMit });
// Und umgekehrt: Das Frachter-Modul darf nicht auf Event-Schiffe uebergreifen.
check('3c: das Frachter-Cargo-Modul wirkt NICHT auf Event-Schiffe',
  fracht({ enterschiff: 10 }, FRACHTMODUL) === evOhne,
  { ohne: evOhne, mitFrachtmodul: fracht({ enterschiff: 10 }, FRACHTMODUL) });
check('3d: das Frachter-Cargo-Modul wirkt weiterhin auf Frachter',
  fracht({ frachter: 10 }, FRACHTMODUL) > frOhne,
  { ohne: frOhne, mit: fracht({ frachter: 10 }, FRACHTMODUL) });

// ---- 4. Keine stille Verschlechterung fuer den Urmaterie-Koloss ----------------------------------
// Er gehoert gemessen zu KEINER Modulklasse, bekam ueber die alte pauschale Zeile aber den
// Frachter-Bonus. Der Rueckfall in fleetCargoCapacity haelt das - ohne ihn haette dieser Umbau ihm
// still etwas weggenommen, das er vorher hatte.
check('4-vorab: der Koloss gehoert wirklich keiner Modulklasse an (sonst prueft 4a nichts)',
  klasseVon('urmateriekoloss') === null, klasseVon('urmateriekoloss'));
const koOhne = fracht({ urmateriekoloss: 5 });
const koMit  = fracht({ urmateriekoloss: 5 }, FRACHTMODUL);
check('4a: der Urmaterie-Koloss behaelt den Frachter-Cargo-Bonus', koMit > koOhne, { ohne: koOhne, mit: koMit });

// ---- 5. Bergbau: der Bunker des Schuerfschiffs ---------------------------------------------------
// Das Schuerfschiff steht bewusst NICHT in CARGO_PER_SHIP - es haette in mineLaderaum() sonst
// doppelt gezaehlt (eigener Bunker PLUS Frachtraum). Beides wird hier gemessen, nicht behauptet.
const tabelle = messen(api => api(leererStand()).CARGO_PER_SHIP);
check('5-vorab: das Schuerfschiff hat keinen Eintrag in CARGO_PER_SHIP (sonst zaehlt es doppelt)',
  tabelle && !('schuerfschiff' in tabelle), Object.keys(tabelle || {}));
check('5a: das Schuerfschiff traegt in fleetCargoCapacity nichts bei', fracht({ schuerfschiff: 10 }) === 0,
  fracht({ schuerfschiff: 10 }));
const bgOhne = bergbau({ schuerfschiff: 10 });
const bgMit  = bergbau({ schuerfschiff: 10 }, ERZ);
check('5b: beim Abbau traegt der Bunker des Schuerfschiffs', bgOhne > 0, bgOhne);
check('5c: der Erzgreifer erhoeht auch den Bunker beim Abbau', bgMit > bgOhne, { ohne: bgOhne, mit: bgMit });
// Gegenprobe zur Doppelzaehlung: Der Bunker allein ist genau MINE_CARGO_JE_SCHIFF je Schiff.
const bunkerBasis = messen(api => api(leererStand()).MINE_CARGO_JE_SCHIFF);
check('5d: keine Doppelzaehlung - zehn Schuerfschiffe tragen genau zehn Bunker',
  bgOhne === bunkerBasis * 10, { gemessen: bgOhne, erwartet: bunkerBasis * 10 });

// ---- 6. Das Gesandtenschiff bleibt ohne Frachtraum -----------------------------------------------
// Es fliegt weder bei Angriffen noch beim Abbau mit; ein Eintrag waere toter Code (Regel 59).
check('6a: das Gesandtenschiff hat keinen Frachtraum-Eintrag', tabelle && !('gesandtenschiff' in tabelle));
const attackBlock = (JS.match(/const ATTACK_SHIP_KEYS = \[([^\]]*)\]/) || [])[1] || '';
const mineBlock = (JS.match(/const MINE_SHIP_KEYS = \[([^\]]*)\]/) || [])[1] || '';
check('6-vorab: beide Schluessellisten wurden gelesen', attackBlock.length > 50 && mineBlock.length > 10);
check('6b: es fliegt wirklich nirgends mit (sonst waere 6a eine Luecke statt einer Regel)',
  !attackBlock.includes("'gesandtenschiff'") && !mineBlock.includes("'gesandtenschiff'"));
// Die Gegenrichtung: Die drei mit Frachtraum MUESSEN mitfliegen koennen, sonst waere ihr Eintrag
// genauso toter Code.
check('6c: die drei Event-Schiffe mit Frachtraum stehen in ATTACK_SHIP_KEYS',
  EVENT_MIT_FRACHT.every(k => attackBlock.includes("'" + k + "'")),
  EVENT_MIT_FRACHT.filter(k => !attackBlock.includes("'" + k + "'")));

// ---- 7. Die automatische Verstaerkung uebergeht kein Kampfschiff mehr ----------------------------
// Bestandsfehler seit Etappe D: maybeAutoReinforce sprang ueber JEDES Schiff in CARGO_SHIP_KEYS -
// seit dem Urmaterie-Koloss (250 Angriff) ist das nicht mehr deckungsgleich mit "kein Angriffswert".
const arBlock = (() => {
  const i = JS.indexOf('function maybeAutoReinforce(');
  if (i < 0) return '';
  let j = JS.indexOf('{', i), tiefe = 0;
  for (let k = j; k < JS.length; k++){ if (JS[k] === '{') tiefe++; else if (JS[k] === '}') { tiefe--; if (!tiefe) return JS.slice(i, k + 1); } }
  return '';
})();
check('7-anker: der Block von maybeAutoReinforce wurde gefunden', arBlock.length > 400, arBlock.length);
check('7a: sie ueberspringt nur Schiffe OHNE eigenen Angriffswert',
  /CARGO_SHIP_KEYS\.includes\(k\)\s*&&\s*!schiffTraegtAngriff\(k\)/.test(arBlock),
  arBlock.split('\n').filter(z => z.includes('CARGO_SHIP_KEYS')).map(z => z.trim().slice(0, 120)));

// ---- 8. Die Anzeigestellen sagen es auch -------------------------------------------------------
// Eine neue Faehigkeit, die nirgends steht, gibt es fuer den Spieler nicht (Checkliste Punkt 6).
for (const k of EVENT_MIT_FRACHT){
  const zeile = JS.split('\n').find(z => z.includes("def.key==='" + k + "'") && z.includes('meta ='));
  check('8a-' + k + ': die Werftkarte nennt den Frachtraum', !!zeile && zeile.includes('Frachtraum'),
    zeile ? zeile.trim().slice(0, 100) : '(keine meta-Zeile gefunden)');
}
const descZeile = S.split('\n').find(z => z.includes('Schwere Bergebäume'));
check('8b: die Modulbeschreibung nennt die betroffenen Schiffe namentlich',
  !!descZeile && ['Enterschiff', 'Phantomschiff', 'Riftwächter', 'Schürfschiff'].every(n => descZeile.includes(n)),
  descZeile ? descZeile.trim().slice(0, 120) : '(nicht gefunden)');
check('8c: sie behauptet nicht mehr pauschal "aller Event-Schiffe"',
  !!descZeile && !descZeile.includes('aller Event-Schiffe'));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
