// Hauptwert-Neuschmieden (v8.451.0, Task #42): das Gegenstueck zum Substat-Reroll.
//
// HINTERGRUND: Seit der Wert-Streuung (v8.444.0) war ein schwacher Hauptwert-Wurf endgueltig -
// rerollModuleSubs laesst ihn bewusst unangetastet. rerollModuleWert wuerfelt NUR den Wurf neu
// (90-110%), Substats und Stufe bleiben, kostet 5x Fragment-Wert, Ergebnis ersetzt ohne Netz.
//
// GEPRUEFT WIRD (die Funktion AUSGEFUEHRT, Wuerfel deterministisch injiziert):
//   1) Kern: w-Token wird ersetzt, Substats/Stufe bleiben exakt, Fragmente sinken um 5x Wert,
//      alte Instanz raus / neue rein. Ein 100%-Wurf traegt KEIN Token. Kurzschluessel ohne
//      Level-Segment bekommen eines, sobald ein Token dazukommt (Serverformat!).
//   2) Kein Netz, aber auch kein Diebstahl: bei zu wenig Fragmenten aendert sich NICHTS.
//   3) Verdrahtung in beiden Inventaren + Hilfe; der Tooltip warnt vor dem Ersetzen.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.450.0) faellt 1a durch - die Funktion existiert dort nicht.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- Extraktion (Regel 6: Endanker-Existenz wird geprueft, bevor gesliced wird)
const von = JS.indexOf('function moduleWertRerollCost(rarity){');
const bis = von < 0 ? -1 : JS.indexOf('function craftModuleFromFragments(', von);
check('1a: Neuschmiede-Block gefunden', von > 0 && bis > von);
if (von < 0 || bis < 0) return ende();
const quelle = JS.slice(von, bis);

// Echte Parser-Helfer aus der Spieldatei (Regel 4: nichts raten).
const wertVon = JS.indexOf('function moduleWertOf(instKey){');
const wertQuelle = JS.slice(wertVon, JS.indexOf('\n  }', wertVon) + 4);
const konstanten = [
  JS.match(/const MODULE_WERT_MIN = \d+, MODULE_WERT_MAX = \d+;/)[0]
].join('\n');

// Sandbox: Wuerfel deterministisch, Info-Stubs mit den Feldern, die die Funktion nutzt.
const FRAG_VALUE = { selten: 3, mythisch: 50 };
function macheWelt(inv, fragmente, wurf, isShip){
  const state = { moduleFragments: fragmente, modules: isShip ? {} : Object.assign({}, inv),
                  shipModules: isShip ? Object.assign({}, inv) : {} };
  const logs = [];
  const infoStub = (instKey) => {
    const [typ, rarity] = String(instKey).split(':');
    const lvlSeg = parseInt(String(instKey).split(':')[2] || '1', 10);
    return { key: typ, type: typ, rarity, level: isNaN(lvlSeg) ? 1 : lvlSeg,
             rar: { label: 'Test' }, def: { name: typ } };
  };
  const api = new Function('state', 'MODULE_FRAGMENT_VALUE', 'moduleInstanceInfo',
    'shipModuleInstanceInfo', 'wertWuerfeln', 'log', 'playSound', 'render', 'save',
    konstanten + '\n' + wertQuelle + '\n' + quelle
    + '\nreturn { moduleWertRerollCost, rerollModuleWert };')(
    state, FRAG_VALUE, infoStub, infoStub, () => wurf,
    (m) => logs.push(m), () => {}, () => {}, () => {});
  return { api, state, logs };
}

// ---- 1) Kern, ausgefuehrt
{
  // 93% -> 107%: Token ersetzt, Substats und Stufe bleiben, Kosten = 5x Fragment-Wert.
  const w = macheWelt({ 'waffen:selten:2:atk15.w93': 1 }, 20, 107, false);
  w.api.rerollModuleWert(false, 'waffen:selten:2:atk15.w93');
  check('1b: w-Token ersetzt, Substats und Stufe unangetastet, alte Instanz raus / neue rein',
    w.state.modules['waffen:selten:2:atk15.w107'] === 1 &&
    w.state.modules['waffen:selten:2:atk15.w93'] === undefined,
    w.state.modules);
  check('1c: Kosten = 5x Fragment-Wert der Seltenheit (gemessen, nicht getippt: 20 - 3*5 = 5)',
    w.state.moduleFragments === 20 - FRAG_VALUE.selten * 5, w.state.moduleFragments);
  check('1d: die Meldung nennt alt -> neu', w.logs.some(m => /93% → 107%/.test(m)), w.logs);
  // Neuer Wurf glatt 100: KEIN Token (kein Token und 100% sind dieselbe Aussage).
  const w2 = macheWelt({ 'waffen:selten:2:atk15.w93': 1 }, 20, 100, false);
  w2.api.rerollModuleWert(false, 'waffen:selten:2:atk15.w93');
  check('1e: ein 100%-Wurf traegt kein w-Token',
    w2.state.modules['waffen:selten:2:atk15'] === 1, w2.state.modules);
  // Kurzschluessel ohne Segmente: Level-Segment kommt dazu, sobald ein Token entsteht -
  // sonst laege das Token im Level-Segment und der Server-Regex-Vertrag waere gebrochen.
  const w3 = macheWelt({ 'waffen:selten': 2 }, 20, 104, false);
  w3.api.rerollModuleWert(false, 'waffen:selten');
  check('1f: Kurzschluessel bekommt Level-Segment vor dem Token (waffen:selten:1:w104)',
    w3.state.modules['waffen:selten:1:w104'] === 1 && w3.state.modules['waffen:selten'] === 1,
    w3.state.modules);
  // Schiffs-Zweig nutzt das Schiffs-Inventar.
  const w4 = macheWelt({ 'ziel:mythisch:5:atk20.w98': 1 }, 300, 110, true);
  w4.api.rerollModuleWert(true, 'ziel:mythisch:5:atk20.w98');
  check('1g: Schiffs-Zweig schreibt ins Schiffs-Inventar, gleiche Regeln',
    w4.state.shipModules['ziel:mythisch:5:atk20.w110'] === 1 &&
    w4.state.moduleFragments === 300 - FRAG_VALUE.mythisch * 5,
    { inv: w4.state.shipModules, frag: w4.state.moduleFragments });
}

// ---- 2) Zu wenig Fragmente: NICHTS aendert sich
{
  const w = macheWelt({ 'waffen:selten:2:atk15.w93': 1 }, FRAG_VALUE.selten * 5 - 1, 107, false);
  const vorher = JSON.stringify(w.state.modules);
  w.api.rerollModuleWert(false, 'waffen:selten:2:atk15.w93');
  check('2: bei zu wenig Fragmenten bleibt alles unangetastet',
    JSON.stringify(w.state.modules) === vorher &&
    w.state.moduleFragments === FRAG_VALUE.selten * 5 - 1 &&
    w.logs.some(m => /Nicht genug Modulfragmente/.test(m)),
    { inv: w.state.modules, logs: w.logs });
}

// ---- 3) Verdrahtung + Hilfe
check('3a: beide Inventare haben den Wurf-Knopf',
  JS.includes('data-wertreroll-module="${instKey}"') &&
  JS.includes('data-wertreroll-shipmodule="${instKey}"'));
check('3b: beide Knoepfe sind verdrahtet',
  JS.includes("rerollModuleWert(false, btn.getAttribute('data-wertreroll-module'))") &&
  JS.includes("rerollModuleWert(true, btn.getAttribute('data-wertreroll-shipmodule'))"));
check('3c: der Tooltip warnt vor dem Ersetzen ohne Netz',
  (JS.match(/Das Ergebnis ersetzt den alten Wurf, auch wenn es schlechter ausfällt\./g) || []).length >= 2);
check('3d: die Hilfe nennt das Neuschmieden mit Kosten und Netz-Regel',
  JS.includes('<strong>Hauptwert-Neuschmieden</strong>') &&
  JS.includes('5× Fragment-Wert der Seltenheit'));

ende();
