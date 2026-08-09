// Reroll+ mit Substat-Sperre (v8.457.0, Task #48, Build-System-Fortsetzung).
//
// HINTERGRUND: Der normale Reroll wuerfelt ALLE Zweitwerte neu - wer eine Spitzen-Zeile hat,
// riskiert sie bei jedem Versuch, die uebrigen zu verbessern. Reroll+ behaelt die beste Zeile,
// wuerfelt nur die uebrigen neu, die ANZAHL bleibt stehen, Kosten 3x normaler Reroll.
//
// GEPRUEFT WIRD (die Funktion AUSGEFUEHRT, der Wuerfel deterministisch ueber ein
// eingeschobenes Math-Objekt - Math ist hier ein Funktionsparameter, der das globale
// Math verschattet):
//   1) Die beste Zeile bleibt EXAKT erhalten (Effekt UND Wert), die uebrigen sind neu,
//      die Anzahl bleibt, der gesperrte Effekt faellt nicht doppelt, das w-Token wandert mit.
//   2) Kosten = 3x moduleRerollCost (gemessen); Ablehnungen (<2 Subs, zu wenig Fragmente)
//      lassen ALLES unangetastet.
//   3) Werkbank-Zaehler steigt (Tagesaufgabe); Verdrahtung beider Knoepfe; Hilfe nennt
//      Sperre, Anzahl-Regel und den Preisfaktor.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.456.0) fallen 1a und 3b/3c durch.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- Extraktion (Regel 6: Anker-Existenz vor dem Slice)
const von = JS.indexOf('function moduleRerollPlusCost(rarity){');
const bis = von < 0 ? -1 : JS.indexOf('\n  /* Hauptwert-Neuschmieden', von);
check('1a: Reroll+-Block gefunden', von > 0 && bis > von);
if (von < 0 || bis < 0) return ende();
const quelle = JS.slice(von, bis);

// Echte Parser + Konstanten aus der Datei (Regel 4).
const subsVon = JS.indexOf('function moduleSubsOf(instKey){');
const subsQuelle = JS.slice(subsVon, JS.indexOf('\n  }', subsVon) + 4);
const wertVon = JS.indexOf('function moduleWertOf(instKey){');
const wertQuelle = JS.slice(wertVon, JS.indexOf('\n  }', wertVon) + 4);
const konst = [
  JS.match(/const MODULE_WERT_MIN = \d+, MODULE_WERT_MAX = \d+;/)[0],
  JS.match(/const MODULE_SUB_MIN = \d+;[^\n]*/)[0],
  JS.match(/const MODULE_SUB_MAX = \d+;[^\n]*/)[0]
].join('\n');
const SUB_MIN = Number(JS.match(/const MODULE_SUB_MIN = (\d+);/)[1]);

// Sandbox: deterministischer Wuerfel - random() liefert immer 0 (erster Pool-Effekt,
// kleinster Wert SUB_MIN), damit das Ergebnis exakt vorhersagbar ist.
const FRAG_VALUE = { legendaer: 20 };
function macheWelt(inv, fragmente){
  const state = { modules: Object.assign({}, inv), shipModules: {}, moduleFragments: fragmente,
                  dailyQuests: { modulCount: 0 } };
  const logs = [];
  const mathFest = { random: () => 0, floor: Math.floor, round: Math.round, max: Math.max, min: Math.min };
  const infoStub = (instKey) => {
    const [typ, rarity] = String(instKey).split(':');
    return { key: typ, type: typ, rarity, level: parseInt(String(instKey).split(':')[2] || '1', 10),
             rar: { label: 'Test' }, def: { name: typ, effect: 'atk' } };
  };
  // moduleLockMitnehmen-Stub (Arbeitsregel 9, v8.458.0 Modul-Schloss): die Migration selbst
  // prueft test_modulschloss.
  const api = new Function('state', 'Math', 'MODULE_FRAGMENT_VALUE', 'MODULE_SUB_POOL_LOC',
    'MODULE_SUB_POOL_SHIP', 'MODULE_SUB_EFFECT_LABEL', 'moduleRerollCost', 'moduleLockMitnehmen',
    'moduleInstanceInfo', 'shipModuleInstanceInfo', 'log', 'playSound', 'render', 'save',
    konst + '\n' + subsQuelle + '\n' + wertQuelle + '\n' + quelle
    + '\nreturn { moduleRerollPlusCost, rerollModuleSubsBehalte };')(
    state, mathFest, FRAG_VALUE, ['def', 'prod', 'lager', 'atk'], ['hull'],
    { def: 'Verteidigung' },
    (r) => (FRAG_VALUE[r] || 1) * 3, () => {},
    infoStub, infoStub, (m) => logs.push(m), () => {}, () => {}, () => {});
  return { api, state, logs };
}

// ---- 1) Kern, ausgefuehrt
{
  // Modul: beste Zeile def25 (2,5%), zweite prod12. random=0 -> Ersatz-Zeile wird der erste
  // Pool-Effekt, der weder Primaereffekt (atk) noch gesperrt (def) ist: 'prod' mit SUB_MIN.
  const key = 'waffen:legendaer:3:def25.prod12.w104';
  const w = macheWelt({ [key]: 1 }, 500);
  w.api.rerollModuleSubsBehalte(false, key);
  const erwartet = 'waffen:legendaer:3:def25.prod' + SUB_MIN + '.w104';
  check('1b: beste Zeile exakt erhalten, Rest neu, Anzahl gleich, w-Token wandert mit',
    w.state.modules[erwartet] === 1 && w.state.modules[key] === undefined,
    w.state.modules);
  check('1c: Kosten = 3x normaler Reroll (gemessen: 500 - 3*3*20 = 320)',
    w.state.moduleFragments === 500 - FRAG_VALUE.legendaer * 9, w.state.moduleFragments);
  check('1d: die Meldung nennt die behaltene Zeile', w.logs.some(m => /beste Zeile behalten \(\+2\.5% Verteidigung\)/.test(m)), w.logs);
  check('1e: der Werkbank-Zaehler steigt', w.state.dailyQuests.modulCount === 1);
  // Der gesperrte Effekt faellt nicht doppelt: pool filtert 'def' heraus - haette random=0 den
  // ersten Pool-Eintrag 'def' gewaehlt, staende er doppelt. Genau das prueft 1b implizit mit;
  // hier zusaetzlich der Quelltext-Beleg, dass der Filter BEIDE ausnimmt.
  check('1f: der Pool nimmt Primaereffekt UND gesperrten Effekt aus',
    quelle.includes("filter(e => e !== primary && e !== beste.effect)"));
}

// ---- 2) Ablehnungen ohne Nebenwirkung
{
  const key1 = 'waffen:legendaer:1:def25';
  const w1 = macheWelt({ [key1]: 1 }, 500);
  w1.api.rerollModuleSubsBehalte(false, key1);
  check('2a: unter 2 Zweitwerten wird abgelehnt, nichts veraendert',
    w1.state.modules[key1] === 1 && w1.state.moduleFragments === 500 &&
    w1.logs.some(m => /mindestens zwei Zweitwerte/.test(m)), w1.logs);
  const key2 = 'waffen:legendaer:1:def25.prod12';
  const w2 = macheWelt({ [key2]: 1 }, FRAG_VALUE.legendaer * 9 - 1);
  w2.api.rerollModuleSubsBehalte(false, key2);
  check('2b: zu wenig Fragmente wird abgelehnt, nichts veraendert',
    w2.state.modules[key2] === 1 && w2.state.moduleFragments === FRAG_VALUE.legendaer * 9 - 1 &&
    w2.state.dailyQuests.modulCount === 0);
}

// ---- 3) Verdrahtung + Hilfe
check('3a: beide Inventare zeigen den Knopf erst ab 2 Zweitwerten',
  (JS.match(/\$\{\(info\.subs\.length>=2\)\?`<button data-rerollplus-(ship)?module=/g) || []).length === 2);
check('3b: beide Knoepfe sind verdrahtet',
  JS.includes("rerollModuleSubsBehalte(false, btn.getAttribute('data-rerollplus-module'))") &&
  JS.includes("rerollModuleSubsBehalte(true, btn.getAttribute('data-rerollplus-shipmodule'))"));
check('3c: die Hilfe nennt Sperre, Anzahl-Regel und den Preisfaktor',
  JS.includes('<strong>Reroll+</strong>: die beste Zeile bleibt erhalten') &&
  JS.includes('mehr Zeilen kann nur der normale Reroll bringen') &&
  JS.includes('kostet das Dreifache des normalen Rerolls'));

ende();
