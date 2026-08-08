// Klassen-Vorlagen + Wechselvorschau (v8.447.0, Task #38): das Standort-Vorlagen-System
// (drei Profile A/B/C, Auto-Name, 1-Klick-Wechsel, Vorschau) fuer die Schiffsklassen-Module.
//
// ARCHITEKTUR: shipLoadoutVorschau simuliert das Anwenden exakt nach den Regeln von
// applyShipModuleLoadout (Slots, ein Modul je Typ, nur noch vorhandene Module) und misst
// vorher/nachher mit der ECHTEN shipModuleBonusFor auf temporaer getauschter Liste - samt
// Substats und Synergien, kein zweiter Rechenweg. Save/Apply werden hier AUSGEFUEHRT,
// nicht nur auf Textbausteine geprueft.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.446.0) fallen 1a und 6 durch - die Funktionen existieren dort nicht.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- Extraktion + Sandbox
// Regel 6: beide Anker muessen EXISTIEREN, sonst wird der Slice vacuous.
const von = JS.indexOf('const SHIP_LOADOUT_CATEGORY = {');
const bis = von < 0 ? -1 : JS.indexOf('function shipModuleSlotUpgradeCost(', von);
check('1a: Klassen-Vorlagen-Block gefunden (SHIP_LOADOUT_CATEGORY bis vor shipModuleSlotUpgradeCost)',
  von > 0 && bis > von);
if (von < 0 || bis < 0) { ende(); return; }
const quelle = JS.slice(von, bis);
check('1b: die Vorschau rechnet mit der ECHTEN shipModuleBonusFor auf getauschter Liste',
  quelle.includes('shipModuleBonusFor(klasse, eff)') &&
  quelle.includes('state.equippedShipModules[klasse] = liste;'));

// Sandbox: shipModuleBonusFor als Basissumme je Effekt aus der ausgeruesteten Liste - geprueft
// werden Simulation, Diff und die Save/Apply-Regeln, nicht die Bonusformel (eigene Tests).
const BASIS = { 'panzer:selten': { hull: 0.08 }, 'ziel:selten': { atk: 0.08 },
                'fracht:episch': { cargo: 0.12 }, 'fracht:selten': { cargo: 0.08 },
                'duese:selten': { speed: 0.08 }, 'lot:selten': { drucklot: 1 } };
const DEFS = [ { key:'panzer', effect:'hull' }, { key:'ziel', effect:'atk' },
               { key:'fracht', effect:'cargo' }, { key:'duese', effect:'speed' },
               { key:'lot', effect:'drucklot' } ];
function macheWelt(equipped, inventar, slots, preset){
  const state = { shipModules: Object.assign({}, inventar),
                  equippedShipModules: { frachter: [...equipped] },
                  shipModuleLoadouts: preset === undefined ? {} : { frachter: { A: preset } } };
  const logs = [];
  const api = new Function('state', 'SHIP_CLASS_DEFS', 'SHIP_MODULE_DEFS',
    'equippedShipModulesAt', 'shipModuleSlotCount', 'typeAlreadyEquipped',
    'SHIP_MODULE_EFFECT_LABEL', 'shipModuleBonusFor', 'log', 'playSound', 'render', 'save',
    quelle + '\nreturn { autoShipLoadoutName, shipLoadoutName, saveShipModuleLoadout, applyShipModuleLoadout, shipLoadoutVorschau };')(
    state,
    [ { key:'frachter', name:'Frachter' } ],
    DEFS,
    (kl) => (state.equippedShipModules[kl] || []),
    () => slots,
    (liste, instKey) => liste.some(k => k.split(':')[0] === String(instKey).split(':')[0]),
    { atk:'Angriff', hull:'Verteidigung', cargo:'Frachtkapazität', speed:'Geschwindigkeit', drucklot:'Mutator-Bann' },
    (kl, eff) => (state.equippedShipModules[kl] || []).reduce((a, k) => a + ((BASIS[k] || {})[eff] || 0), 0),
    (m) => logs.push(m), () => {}, () => {}, () => {});
  return { api, state, logs };
}

// ---- 2) Vorschau: Diff-Rechnung und Anwenden-Regeln in der Simulation
{
  const w = macheWelt(['panzer:selten'], { 'fracht:episch': 1 }, 4, ['fracht:episch']);
  const v = w.api.shipLoadoutVorschau('frachter', 'A');
  check('2a: geaenderte Effekte mit vorher/nachher, groesste Aenderung zuerst',
    !!v && v.diffs.length === 2 &&
    v.diffs[0].effect === 'cargo' && v.diffs[0].vorher === 0 && Math.abs(v.diffs[0].nachher - 0.12) < 1e-9 &&
    v.diffs[1].effect === 'hull' && Math.abs(v.diffs[1].vorher - 0.08) < 1e-9 && v.diffs[1].nachher === 0,
    v && v.diffs);
  const gleich = macheWelt(['panzer:selten'], {}, 4, ['panzer:selten']).api.shipLoadoutVorschau('frachter', 'A');
  check('2b: identische Vorlage meldet gleich', !!gleich && gleich.gleich === true && gleich.fehlt === 0);
  // Slot-Deckel 1: nur das erste Preset-Modul zaehlt.
  const v1 = macheWelt([], { 'fracht:episch': 1, 'duese:selten': 1 }, 1, ['fracht:episch', 'duese:selten']).api.shipLoadoutVorschau('frachter', 'A');
  check('2c: der Slot-Deckel gilt auch in der Vorschau',
    !!v1 && v1.diffs.length === 1 && v1.diffs[0].effect === 'cargo', v1 && v1.diffs);
  // Ein Modul je Typ: zweites fracht-Modul uebersprungen, zaehlt NICHT als fehlt.
  const v2 = macheWelt([], { 'fracht:episch': 1, 'fracht:selten': 1 }, 4, ['fracht:episch', 'fracht:selten']).api.shipLoadoutVorschau('frachter', 'A');
  check('2d: ein Modul je Typ gilt auch in der Vorschau (Doppel zaehlt nicht als fehlt)',
    !!v2 && v2.fehlt === 0 && v2.diffs.length === 1 && Math.abs(v2.diffs[0].nachher - 0.12) < 1e-9, v2);
  // Nicht mehr vorhandene Module zaehlen als fehlt; Ausgeruestetes zaehlt zum Bestand.
  const v3 = macheWelt([], {}, 4, ['fracht:episch']).api.shipLoadoutVorschau('frachter', 'A');
  check('2e: verschmolzene/zerlegte Module werden als fehlt ausgewiesen',
    !!v3 && v3.fehlt === 1 && v3.gleich === true, v3);
  const v4 = macheWelt(['fracht:episch'], {}, 4, ['fracht:episch', 'panzer:selten']).api.shipLoadoutVorschau('frachter', 'A');
  check('2f: aktuell Ausgeruestetes zaehlt zum simulierten Bestand',
    !!v4 && v4.fehlt === 1 && v4.diffs.length === 0, v4);
}

// ---- 3) Keine Spuren
{
  const w = macheWelt(['panzer:selten'], { 'fracht:episch': 1 }, 4, ['fracht:episch']);
  const vorher = JSON.stringify(w.state.equippedShipModules);
  const inv = JSON.stringify(w.state.shipModules);
  w.api.shipLoadoutVorschau('frachter', 'A');
  check('3: die Vorschau hinterlaesst keine Spuren (Ausruestung und Inventar unveraendert)',
    JSON.stringify(w.state.equippedShipModules) === vorher && JSON.stringify(w.state.shipModules) === inv,
    w.state.equippedShipModules);
}

// ---- 4) Save + Apply AUSGEFUEHRT
{
  // Speichern merkt sich die aktuelle Ausruestung und vergibt den Auto-Namen.
  const w = macheWelt(['panzer:selten', 'fracht:episch'], {}, 4, undefined);
  w.api.saveShipModuleLoadout('frachter', 'B');
  check('4a: Speichern legt die aktuelle Ausruestung als Vorlage ab',
    JSON.stringify(w.state.shipModuleLoadouts.frachter.B) === JSON.stringify(['panzer:selten', 'fracht:episch']),
    w.state.shipModuleLoadouts);
  check('4b: der Auto-Name kommt aus der Effekt-Zusammensetzung (hull+cargo -> zwei Kategorien)',
    w.state.shipModuleLoadoutNames.frachter.B === 'Verteidigung/Logistik',
    w.state.shipModuleLoadoutNames);
  // Anwenden: legt Ausgeruestetes zurueck, bestueckt nach den Regeln, meldet Fehlendes.
  const w2 = macheWelt(['duese:selten'], { 'panzer:selten': 1 }, 2, ['panzer:selten', 'ziel:selten']);
  w2.api.applyShipModuleLoadout('frachter', 'A');
  check('4c: Anwenden legt zurueck, ruestet die Vorlage aus und meldet Fehlendes',
    JSON.stringify(w2.state.equippedShipModules.frachter) === JSON.stringify(['panzer:selten']) &&
    (w2.state.shipModules['duese:selten'] || 0) === 1 &&
    w2.state.shipModules['panzer:selten'] === undefined &&
    w2.logs.some(m => /1 nicht mehr im Besitz/.test(m)),
    { eq: w2.state.equippedShipModules, inv: w2.state.shipModules, logs: w2.logs });
  // Gemessener Rundlauf (Regel 2): Vorschau-Ergebnis == echtes Ergebnis nach Anwenden.
  const w3a = macheWelt(['panzer:selten'], { 'fracht:episch': 1, 'ziel:selten': 1 }, 2, ['fracht:episch', 'ziel:selten']);
  const vorschau = w3a.api.shipLoadoutVorschau('frachter', 'A');
  const w3b = macheWelt(['panzer:selten'], { 'fracht:episch': 1, 'ziel:selten': 1 }, 2, ['fracht:episch', 'ziel:selten']);
  w3b.api.applyShipModuleLoadout('frachter', 'A');
  const echt = {};
  for (const eff of ['atk','hull','cargo','speed','drucklot'])
    echt[eff] = (w3b.state.equippedShipModules.frachter || []).reduce((a, k) => a + ((BASIS[k] || {})[eff] || 0), 0);
  check('4d: die Vorschau sagt exakt den Zustand voraus, den Anwenden herstellt',
    !!vorschau && vorschau.diffs.every(d => Math.abs((echt[d.effect] || 0) - d.nachher) < 1e-9),
    { vorschau, echt });
  // Auto-Name mit klarer Mehrheit -> EINE Kategorie.
  check('4e: klare Mehrheit ergibt eine Kategorie',
    w.api.autoShipLoadoutName(['fracht:episch', 'duese:selten', 'fracht:selten']) === 'Logistik');
}

// ---- 5) Verdrahtung, Nicht-Prozent-Effekte, Hilfe
check('5a: die Klassen-Karte rendert Vorlagen-Zeilen mit Vorschau',
  JS.includes('const vs = has ? shipLoadoutVorschau(klasse, nm) : null;') &&
  JS.includes('data-shiploadout-save') && JS.includes('data-shiploadout-apply'));
check('5b: die Knoepfe sind verdrahtet',
  JS.includes("saveShipModuleLoadout(klasse, btn.getAttribute('data-shiploadout-save'))") &&
  JS.includes("applyShipModuleLoadout(klasse, btn.getAttribute('data-shiploadout-apply'))"));
// Drucklot & Co. sind KEINE Prozentwerte - die Vorschau darf dort keine Prozente erfinden
// (gleicher Fehlertyp wie der historische "+100% drucklot"-Bug an der Slot-Karte).
check('5c: Nicht-Prozent-Effekte werden in der Vorschau als Rohwert gezeigt',
  /const proz = !SHIP_MODULE_EFFECT_OHNE_PROZENT\.has\(d\.effect\);/.test(JS));
check('5d: die Hilfe nennt die Klassen-Vorlagen samt Wechselvorschau',
  /je Schiffsklasse drei speicherbare Profile \(A\/B\/C\)/.test(JS) &&
  JS.includes('inklusive Substats und Synergien'));
check('5e: der Spielstand-Ladepfad legt shipModuleLoadouts an',
  JS.includes('if (state.shipModuleLoadouts === undefined) state.shipModuleLoadouts = {};'));

ende();
