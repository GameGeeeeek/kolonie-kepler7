// Tagesaufgabe "Modul-Werkbank" (v8.454.0, Task #45).
//
// HINTERGRUND: Der Tages-Pool (22 Vorlagen) kannte das komplette Modul-System nicht, obwohl
// das Tutorial verspricht, die Tagesaufgaben fuehrten "durch alle Systeme". Die neue Vorlage
// zaehlt Werkbank-Aktionen: aufwerten, verschmelzen, zerlegen, neu wuerfeln (Subs ODER Wurf).
//
// GEPRUEFT WIRD:
//   1) Die Vorlage selbst: Schluessel, Icon aus der Whitelist, Sprungziel-Tab existiert,
//      der Name nennt genau die vier zaehlenden Aktionen, available-Praedikat vorhanden.
//   2) Der Zaehler: Fortschritts-Fall, Tagesbeginn-Reset, und GENAU fuenf Hooks - je einer
//      in den fuenf geteilten Erfolgs-Pfaden (Regel 6: Slices mit existenzgepruefter Grenze).
//      Ausruesten zaehlt bewusst NICHT - equipModule/equipShipModule sind hook-frei.
//   3) AUSGEFUEHRT am Beispiel dismantleModule: der Zaehler steigt beim Erfolg, steigt NICHT
//      bei abgelehnter Aktion (Modul nicht im Inventar) und crasht nicht ohne dailyQuests.
//   4) Anzeigestellen: Tutorial und Hilfe nennen die Pool-Groesse, und zwar die ECHTE
//      (gegen DAILY_QUEST_DEFS.length gemessen, nicht getippt - Regel 2).
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.453.0) fallen 1a, 2a-2c und 4a durch.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) die Vorlage
const defsVon = JS.indexOf('const DAILY_QUEST_DEFS = [');
const defsBis = defsVon < 0 ? -1 : JS.indexOf('\n  ];', defsVon);
check('1: DAILY_QUEST_DEFS gefunden', defsVon > 0 && defsBis > defsVon);
if (defsVon < 0) return ende();
const DEFS = new Function(JS.slice(defsVon, defsBis + 5) + ';return DAILY_QUEST_DEFS;')();
const def = DEFS.find(d => d.key === 'modul');
check('1a: es gibt die Vorlage "modul"', !!def, def && def.name);
if (!def) return ende();
check('1b: Icon aus der Font-Whitelist', new RegExp('\\.' + def.icon + ':before').test(HTML), def.icon);
// Der Tab-Button steht im HTML-Markup, nicht im <script>-Teil - deshalb HTML durchsuchen
// (Regel 9 im Kleinen: die erste Fassung suchte in JS und fiel auf korrektem Code durch).
check('1c: das Sprungziel offiziere existiert als Tab',
  def.nav && def.nav.tab === 'offiziere' && HTML.includes('data-tab="offiziere"'));
check('1d: der Name nennt genau die vier zaehlenden Aktionen',
  /aufwerten/.test(def.name) && /verschmelzen/.test(def.name) &&
  /zerlegen/.test(def.name) && /neu würfeln/.test(def.name) && !/ausrüsten/i.test(def.name),
  def.name);
check('1e: available-Praedikat vorhanden (sonst fuer neue Konten unerfuellbar)',
  typeof def.available === 'function');

// ---- 2) der Zaehler
check('2a: Fortschritts-Fall vorhanden', JS.includes("if (key==='modul') return dq.modulCount||0;"));
check('2b: Tagesbeginn-Reset setzt modulCount auf 0', JS.includes('tier2Produced:0, modulCount:0, claimed:{}'));
const HOOK = 'state.dailyQuests.modulCount = (state.dailyQuests.modulCount||0) + 1';
const hooks = (JS.match(new RegExp(HOOK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
// Sechs seit v8.457.0: Reroll+ (rerollModuleSubsBehalte) ist die sechste Werkbank-Aktion -
// vom Aufgaben-Namen "neu wuerfeln" bereits abgedeckt (Arbeitsregel 9: Erwartung mitgezogen).
check('2c: GENAU sechs Hooks (die sechs geteilten Werkbank-Pfade)', hooks === 6, hooks);
// Jeder Hook sitzt in der richtigen Funktion (Slices mit existenzgeprueften Grenzen, Regel 6).
const funktionen = ['upgradeModule', 'fuseModules', 'dismantleModule', 'rerollModuleSubs', 'rerollModuleSubsBehalte', 'rerollModuleWert'];
for (let i = 0; i < funktionen.length; i++){
  const fn = funktionen[i];
  const von = JS.indexOf('function ' + fn + '(isShip, instKey){');
  // Grenze: der Beginn der jeweils naechsten Funktions-Definition irgendeiner Art.
  const bis = von < 0 ? -1 : JS.indexOf('\n  function ', von + 10);
  const ok = von > 0 && bis > von && JS.slice(von, bis).includes(HOOK);
  check('2d: der Hook sitzt in ' + fn, ok);
}
// Ausruesten zaehlt bewusst NICHT.
for (const fn of ['equipModule', 'equipShipModule']){
  const von = JS.indexOf('function ' + fn + '(');
  const bis = von < 0 ? -1 : JS.indexOf('\n  function ', von + 10);
  check('2e: ' + fn + ' ist hook-frei (Ausruesten ist keine Werkbank-Aktion)',
    von > 0 && bis > von && !JS.slice(von, bis).includes('modulCount'));
}

// ---- 3) AUSGEFUEHRT: dismantleModule zaehlt bei Erfolg, nicht bei Ablehnung
{
  const von = JS.indexOf('function dismantleModule(isShip, instKey){');
  const bis = JS.indexOf('\n  }', von) + 4;
  check('3a: dismantleModule-Slice gefunden', von > 0 && bis > von + 4);
  const quelle = JS.slice(von, bis);
  const macheWelt = (inv, mitDaily) => {
    const state = { modules: Object.assign({}, inv), shipModules: {}, moduleFragments: 0,
                    dailyQuests: mitDaily ? { modulCount: 0 } : null };
    const fn = new Function('state', 'MODULE_FRAGMENT_VALUE', 'moduleLevelOf',
      'moduleInstanceInfo', 'shipModuleInstanceInfo', 'log', 'render', 'save',
      quelle + '\nreturn dismantleModule;')(
      state, { selten: 3 }, () => 1,
      () => ({ rar: { label: 'Selten' }, def: { name: 'Waffen' }, level: 1 }), () => null,
      () => {}, () => {}, () => {});
    return { fn, state };
  };
  const w1 = macheWelt({ 'waffen:selten': 1 }, true);
  w1.fn(false, 'waffen:selten');
  check('3b: der Zaehler steigt beim erfolgreichen Zerlegen',
    w1.state.dailyQuests.modulCount === 1 && w1.state.moduleFragments === 3,
    w1.state.dailyQuests);
  const w2 = macheWelt({}, true);
  w2.fn(false, 'waffen:selten');
  check('3c: abgelehnte Aktion zaehlt NICHT', w2.state.dailyQuests.modulCount === 0, w2.state.dailyQuests);
  const w3 = macheWelt({ 'waffen:selten': 1 }, false);
  w3.fn(false, 'waffen:selten');
  check('3d: ohne dailyQuests kein Absturz, Zerlegen laeuft normal', w3.state.moduleFragments === 3);
}

// ---- 4) Anzeigestellen nennen die ECHTE Pool-Groesse (Regel 2: gemessen, nicht getippt)
check('4a: Tutorial und Hilfe nennen die echte Pool-Groesse (' + DEFS.length + ')',
  JS.includes('aus ' + DEFS.length + ' Vorlagen gezogen') &&
  JS.includes('Insgesamt sind es damit ' + DEFS.length + ' Vorlagen'));
check('4b: die Hilfe erklaert die Modul-Werkbank samt Nicht-Zaehlen von Ausruesten',
  JS.includes('<strong>Modul-Werkbank</strong>') && JS.includes('Ausrüsten zählt bewusst nicht'));

ende();
