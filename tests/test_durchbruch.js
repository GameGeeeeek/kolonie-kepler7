// Durchbruch-Stufen beim Aufwerten (v8.461.0, Task #52, Build-System-Fortsetzung).
//
// HINTERGRUND: Aufwerten (Stufe 1-10) war ein reiner Hauptwert-Verstaerker - Substats wurden
// nur erhalten. Jetzt: Bei Stufe 4/7/10 gewinnt das Modul einen zusaetzlichen Zweitwert bis
// zur Obergrenze seiner Seltenheit (MODULE_SUB_RANGE[..][1]); ist die erreicht, wird der
// SCHWAECHSTE Zweitwert um MODULE_DURCHBRUCH_PLUS (+0,2 Punkte) verstaerkt, gedeckelt bei
// MODULE_SUB_MAX. Keine neue Obergrenze - erreichbar ist nur, was ein perfekter Fund-Wurf
// ohnehin duerfte.
//
// GEPRUEFT WIRD (upgradeModule AUSGEFUEHRT, Wuerfel deterministisch ueber ein eingeschobenes
// Math-Objekt, Muster wie test_rerollplus):
//   1) Stufe 3->4 unter der Obergrenze: neuer Zweitwert (nicht Primaereffekt, nicht doppelt),
//      w-Token wandert mit, Log nennt den Durchbruch.
//   2) Obergrenze erreicht: schwaechster Zweitwert +2 (Zehntel-Promille), Rest unveraendert.
//   3) Alles perfekt: kein Umbau, normales Aufwerten. 4) Stufe 2->3 (kein Durchbruch-Level):
//      Substats unveraendert. 5) Gewoehnlich: kein Durchbruch, Tooltip-Hinweis leer.
//   6) Tooltips/Hilfe (statisch): alle vier Aufwerten-Knoepfe tragen den Hinweis, die Hilfe
//      nennt die Regeln.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.460.0) fehlt der Block komplett - 0a schlaegt an.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- Extraktion (Regel 6: Anker-Existenz VOR dem Slice pruefen)
const von = JS.indexOf('const MODULE_DURCHBRUCH_LEVELS = ');
const bis = von < 0 ? -1 : JS.indexOf('\n  // Substats eines Moduls gegen Fragmente neu w', von);
check('0a: Durchbruch-Block gefunden (Konstanten bis Ende upgradeModule)', von > 0 && bis > von);
if (von < 0 || bis < 0) return ende();
const quelle = JS.slice(von, bis);

// Konstanten aus der Datei ablesen (Regel 4: nie raten)
const konst = [
  JS.match(/const MODULE_LEVEL_MAX = \d+;/)[0],
  JS.match(/const MODULE_SUB_MIN = \d+;[^\n]*/)[0],
  JS.match(/const MODULE_SUB_MAX = \d+;[^\n]*/)[0],
  JS.match(/const MODULE_SUB_RANGE = \{[^\n]*\};/)[0]
].join('\n');
const SUB_MIN = Number(JS.match(/const MODULE_SUB_MIN = (\d+);/)[1]);
const SUB_MAX = Number(JS.match(/const MODULE_SUB_MAX = (\d+);/)[1]);
const PLUS = Number(JS.match(/const MODULE_DURCHBRUCH_PLUS = (\d+);/)[1]);

const FRAG_VALUE = { legendaer: 20, mythisch: 40, gewoehnlich: 1 };
function macheWelt(inv, fragmente){
  const state = { modules: Object.assign({}, inv), shipModules: {}, moduleFragments: fragmente,
                  dailyQuests: { modulCount: 0 } };
  const logs = [];
  // random()=0: neuer Effekt = erster zulaessiger Pool-Eintrag, Wert = SUB_MIN.
  const mathFest = { random: () => 0, floor: Math.floor, round: Math.round, max: Math.max, min: Math.min };
  const infoStub = (instKey) => {
    const [typ, rarity] = String(instKey).split(':');
    return { key: typ, type: typ, rarity, level: parseInt(String(instKey).split(':')[2] || '1', 10),
             rar: { label: 'Test' }, def: { name: typ, effect: 'atk' } };
  };
  const api = new Function('state', 'Math', 'MODULE_FRAGMENT_VALUE', 'MODULE_SUB_POOL_LOC',
    'MODULE_SUB_POOL_SHIP', 'MODULE_SUB_EFFECT_LABEL', 'moduleUpgradeCost', 'moduleLockMitnehmen',
    'moduleInstanceInfo', 'shipModuleInstanceInfo', 'findEquippedModuleSlot',
    'log', 'playSound', 'render', 'save',
    konst + '\n' + quelle
    + '\nreturn { upgradeModule, modulDurchbruch, durchbruchHinweis, durchbruchPille };')(
    state, mathFest, FRAG_VALUE, ['def', 'prod', 'lager', 'atk'], ['hull', 'shield'],
    { def: 'Verteidigung', prod: 'Produktion', lager: 'Lager', hull: 'Huelle' },
    (r, l) => (FRAG_VALUE[r] || 1) * Math.max(1, l), () => {},
    infoStub, infoStub, () => null,
    (m) => logs.push(m), () => {}, () => {}, () => {});
  return { api, state, logs };
}

// ---- 1) Stufe 3->4 unter der Obergrenze: neuer Zweitwert, w-Token wandert mit
{
  // legendaer hat Obergrenze 2, das Modul hat 1 Zweitwert (def15) -> Durchbruch ergaenzt.
  // random=0 -> erster Pool-Effekt, der weder Primaereffekt (atk) noch belegt (def) ist: 'prod',
  // Wert SUB_MIN.
  const key = 'waffen:legendaer:3:def15.w104';
  const w = macheWelt({ [key]: 1 }, 500);
  w.api.upgradeModule(false, key);
  const erwartet = 'waffen:legendaer:4:def15.prod' + SUB_MIN + '.w104';
  check('1a: neuer Zweitwert ergaenzt, w-Token am Ende erhalten',
    w.state.modules[erwartet] === 1 && w.state.modules[key] === undefined, w.state.modules);
  check('1b: das Log nennt den Durchbruch mit Wert und Effekt',
    w.logs.some(m => m.includes('Durchbruch: neuer Zweitwert +' + (SUB_MIN/10).toFixed(1) + '% Produktion')), w.logs);
  check('1c: Kosten unveraendert Zerlege-Wert x Stufe (500 - 20*3 = 440)',
    w.state.moduleFragments === 500 - FRAG_VALUE.legendaer * 3, w.state.moduleFragments);
}

// ---- 2) Obergrenze erreicht: schwaechster Zweitwert wird verstaerkt
{
  // mythisch hat Obergrenze 2 und das Modul 2 Zweitwerte -> Verstaerkung des schwaechsten (prod12).
  const key = 'waffen:mythisch:6:def15.prod12';
  const w = macheWelt({ [key]: 1 }, 500);
  w.api.upgradeModule(false, key);
  const erwartet = 'waffen:mythisch:7:def15.prod' + (12 + PLUS);
  check('2a: der schwaechste Zweitwert steigt um +' + PLUS + ', der Rest bleibt',
    w.state.modules[erwartet] === 1, w.state.modules);
  check('2b: das Log nennt die Verstaerkung',
    w.logs.some(m => m.includes('Produktion verstärkt auf +' + ((12+PLUS)/10).toFixed(1) + '%')), w.logs);
  // Deckel: ein Wert knapp unter der Bestmarke darf sie nicht ueberschreiten.
  const key2 = 'waffen:mythisch:9:def' + (SUB_MAX-1) + '.prod' + SUB_MAX;
  const w2 = macheWelt({ [key2]: 1 }, 900);
  w2.api.upgradeModule(false, key2);
  check('2c: die Verstaerkung ist bei MODULE_SUB_MAX gedeckelt',
    w2.state.modules['waffen:mythisch:10:def' + SUB_MAX + '.prod' + SUB_MAX] === 1, w2.state.modules);
}

// ---- 3) Alles perfekt: kein Umbau, Aufwerten laeuft normal
{
  const key = 'waffen:mythisch:9:def' + SUB_MAX + '.prod' + SUB_MAX;
  const w = macheWelt({ [key]: 1 }, 900);
  w.api.upgradeModule(false, key);
  check('3: bei perfekten Zweitwerten aendert der Durchbruch nichts (nur die Stufe steigt)',
    w.state.modules['waffen:mythisch:10:def' + SUB_MAX + '.prod' + SUB_MAX] === 1 &&
    !w.logs.some(m => m.includes('Durchbruch')), w.state.modules);
}

// ---- 4) Kein Durchbruch-Level: Substats bleiben exakt stehen
{
  const key = 'waffen:legendaer:2:def15.w104';
  const w = macheWelt({ [key]: 1 }, 500);
  w.api.upgradeModule(false, key);
  check('4: Stufe 2->3 laesst die Zweitwerte unangetastet',
    w.state.modules['waffen:legendaer:3:def15.w104'] === 1 && !w.logs.some(m => m.includes('Durchbruch')),
    w.state.modules);
}

// ---- 5) Gewoehnlich: kein Durchbruch, Hinweis leer
{
  const key = 'waffen:gewoehnlich:3';
  const w = macheWelt({ [key]: 1 }, 50);
  w.api.upgradeModule(false, key);
  check('5a: Gewoehnlich bekommt bei Stufe 4 keinen Zweitwert',
    w.state.modules['waffen:gewoehnlich:4'] === 1 && !w.logs.some(m => m.includes('Durchbruch')),
    w.state.modules);
  check('5b: der Tooltip-Hinweis ist fuer Gewoehnlich leer, fuer Legendaer bei Stufe 4 gefuellt, bei Stufe 5 leer',
    w.api.durchbruchHinweis(4, 'gewoehnlich') === '' &&
    w.api.durchbruchHinweis(4, 'legendaer').includes('DURCHBRUCH') &&
    w.api.durchbruchHinweis(5, 'legendaer') === '');
}

// ---- 7) Kartenpille (v8.462.0): naechstes Durchbruch-Ziel sichtbar an der Karte
{
  const w = macheWelt({}, 0);
  const p1 = w.api.durchbruchPille(1, 'legendaer');
  const p3 = w.api.durchbruchPille(3, 'legendaer');
  check('7a: unter dem Ziel zeigt die Pille das naechste Durchbruch-Level (gedaempft)',
    p1.includes('Durchbruch St. 4') && !p1.includes('nächste Stufe'), p1);
  check('7b: eine Stufe davor wird sie golden und sagt es deutlich',
    p3.includes('Durchbruch nächste Stufe!') && p3.includes('#fac775'), p3);
  check('7c: Gewoehnlich und Maximalstufe zeigen keine Pille',
    w.api.durchbruchPille(3, 'gewoehnlich') === '' && w.api.durchbruchPille(10, 'legendaer') === '');
  check('7d: alle vier Kartenstellen tragen die Pille (2x Slot-Karte, 2x Inventarkarte)',
    (JS.match(/\$\{info\?durchbruchPille\(info\.level, info\.rarity\):''\}/g) || []).length === 2 &&
    (JS.match(/\$\{durchbruchPille\(info\.level, info\.rarity\)\}/g) || []).length === 2);
}

// ---- 6) Verdrahtung der Anzeige (statisch)
check('6a: alle vier Aufwerten-Tooltips tragen den Durchbruch-Hinweis',
  (JS.match(/\$\{durchbruchHinweis\(info\.level\+1, info\.rarity\)\}/g) || []).length === 4);
check('6b: die Hilfe nennt Stufen, Obergrenze und den Kein-Weg-darueber-hinaus-Grundsatz',
  JS.includes('<strong>Durchbruch:</strong> Bei den Stufen 4, 7 und 10') &&
  JS.includes('höchstens bis zur Zweitwert-Obergrenze seiner Seltenheit') &&
  JS.includes('kein Weg darüber hinaus. Gewöhnliche Module (ohne Zweitwerte) haben keinen Durchbruch'));

ende();
