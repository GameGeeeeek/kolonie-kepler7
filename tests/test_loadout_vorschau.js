// Loadout-Wechselvorschau (v8.446.0, Task #37): "Was aendert sich?" an jeder Vorlage.
//
// ARCHITEKTUR: loadoutVorschau simuliert das Anwenden exakt nach den applyModuleLoadout-Regeln
// (Slots, ein Modul je Typ, nur noch vorhandene Module) und misst vorher/nachher mit der ECHTEN
// moduleBonusAt auf temporaer getauschter Ausruestungsliste - kein zweiter Rechenweg, der beim
// naechsten Set-Umbau driften koennte. Reine Anzeige.
//
// GEPRUEFT WIRD (die Simulation AUSGEFUEHRT):
//   1) Diff-Rechnung: geaenderte Effekte mit vorher/nachher, groesste Aenderung zuerst,
//      identische Vorlage meldet gleich.
//   2) Die Anwenden-Regeln gelten auch in der SIMULATION: Slot-Deckel, ein Modul je Typ,
//      nicht mehr vorhandene Module zaehlen als fehlt.
//   3) Die Messung hinterlaesst KEINE Spuren: die echte Ausruestungsliste ist nach dem Aufruf
//      unveraendert (der Tausch-Trick darf nie nach aussen lecken).
//   4) Verdrahtung: die Vorlagen-Zeilen rendern die Vorschau, die Hilfe nennt sie.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren ausgefuehrt): am alten Stand fallen 1a und 4 durch.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- Extraktion + Sandbox
const von = JS.indexOf('function loadoutVorschau(planetKey, slotName){');
const bis = von < 0 ? -1 : JS.indexOf('\n  }', von);
check('1a: loadoutVorschau gefunden', von > 0 && bis > von);
if (von < 0) return ende();
const quelle = JS.slice(von, bis + 4);
check('1b: sie rechnet mit der ECHTEN moduleBonusAt auf getauschter Liste (kein zweiter Rechenweg)',
  quelle.includes('moduleBonusAt(planetKey, eff)') &&
  quelle.includes('state.equippedModules[planetKey] = liste;'));

// Sandbox: moduleBonusAt als einfache Basissumme je Effekt aus der Liste - geprueft wird die
// SIMULATION und der Diff, nicht die Bonusformel (die hat ihre eigenen Tests).
const BASIS = { 'panzerung:selten': { def: 0.08 }, 'waffen:selten': { atk: 0.08 },
                'bergbau:episch': { prod: 0.12 }, 'bergbau:selten': { prod: 0.08 },
                'lager:selten': { storage: 0.08 } };
function macheWelt(equipped, inventar, slots, preset){
  const state = { modules: Object.assign({}, inventar),
                  equippedModules: { home: [...equipped] },
                  moduleLoadouts: { home: { A: preset } } };
  const fn = new Function('state', 'equippedAt', 'moduleSlotCount', 'typeAlreadyEquipped',
    'MODULE_EFFECT_LABEL', 'moduleBonusAt',
    quelle + '\nreturn loadoutVorschau;')(
    state,
    (pk) => (state.equippedModules[pk] || []),
    () => slots,
    (liste, instKey) => liste.some(k => k.split(':')[0] === String(instKey).split(':')[0]),
    { atk: 'Angriff', def: 'Verteidigung', prod: 'Produktion', storage: 'Lager' },
    (pk, eff) => (state.equippedModules[pk] || []).reduce((a, k) => a + ((BASIS[k] || {})[eff] || 0), 0));
  return { fn, state };
}

// ---- 1) Diff-Rechnung
{
  const w = macheWelt(['panzerung:selten'], { 'bergbau:episch': 1 }, 4, ['bergbau:episch']);
  const v = w.fn('home', 'A');
  check('1c: geaenderte Effekte mit vorher/nachher, groesste Aenderung zuerst',
    !!v && v.diffs.length === 2 &&
    v.diffs[0].effect === 'prod' && v.diffs[0].vorher === 0 && Math.abs(v.diffs[0].nachher - 0.12) < 1e-9 &&
    v.diffs[1].effect === 'def' && Math.abs(v.diffs[1].vorher - 0.08) < 1e-9 && v.diffs[1].nachher === 0,
    v && v.diffs);
  const gleich = macheWelt(['panzerung:selten'], {}, 4, ['panzerung:selten']).fn('home', 'A');
  check('1d: identische Vorlage meldet gleich', !!gleich && gleich.gleich === true && gleich.fehlt === 0);
}

// ---- 2) Die Anwenden-Regeln gelten in der Simulation
{
  // Slot-Deckel 1: nur das erste Preset-Modul zaehlt.
  const w1 = macheWelt([], { 'bergbau:episch': 1, 'lager:selten': 1 }, 1, ['bergbau:episch', 'lager:selten']);
  const v1 = w1.fn('home', 'A');
  check('2a: der Slot-Deckel gilt auch in der Vorschau',
    !!v1 && v1.diffs.length === 1 && v1.diffs[0].effect === 'prod', v1 && v1.diffs);
  // Ein Modul je Typ: zweites bergbau-Modul wird uebersprungen, zaehlt NICHT als fehlt.
  const w2 = macheWelt([], { 'bergbau:episch': 1, 'bergbau:selten': 1 }, 4, ['bergbau:episch', 'bergbau:selten']);
  const v2 = w2.fn('home', 'A');
  check('2b: ein Modul je Typ gilt auch in der Vorschau (Doppel zaehlt nicht als fehlt)',
    !!v2 && v2.fehlt === 0 && v2.diffs.length === 1 && Math.abs(v2.diffs[0].nachher - 0.12) < 1e-9, v2);
  // Nicht mehr vorhandene Module zaehlen als fehlt.
  const w3 = macheWelt([], {}, 4, ['bergbau:episch']);
  const v3 = w3.fn('home', 'A');
  check('2c: verschmolzene/zerlegte Module werden als fehlt ausgewiesen',
    !!v3 && v3.fehlt === 1 && v3.gleich === true, v3);
  // Das aktuell Ausgeruestete steht der Vorlage zur Verfuegung (Anwenden legt erst zurueck).
  const w4 = macheWelt(['bergbau:episch'], {}, 4, ['bergbau:episch', 'panzerung:selten']);
  const v4 = w4.fn('home', 'A');
  check('2d: aktuell Ausgeruestetes zaehlt zum simulierten Bestand',
    !!v4 && v4.fehlt === 1 && v4.diffs.length === 0, v4);
}

// ---- 3) Keine Spuren
{
  const w = macheWelt(['panzerung:selten'], { 'bergbau:episch': 1 }, 4, ['bergbau:episch']);
  const vorher = JSON.stringify(w.state.equippedModules);
  const inv = JSON.stringify(w.state.modules);
  w.fn('home', 'A');
  check('3: die Messung hinterlaesst keine Spuren (Ausruestung und Inventar unveraendert)',
    JSON.stringify(w.state.equippedModules) === vorher && JSON.stringify(w.state.modules) === inv,
    w.state.equippedModules);
}

// ---- 4) Verdrahtung und Hilfe
check('4a: die Vorlagen-Zeilen rendern die Vorschau',
  JS.includes('const vs = has ? loadoutVorschau(pk, nm) : null;') &&
  JS.includes('keine Änderung zur aktuellen Ausrüstung') &&
  JS.includes('nicht mehr im Besitz</span>'));
check('4b: die Hilfe nennt die Wechselvorschau und ihre Ehrlichkeits-Regeln',
  JS.includes('<strong>Wechselvorschau</strong>') &&
  JS.includes('gerechnet mit derselben Bonus-Funktion wie das Spiel'));

ende();
