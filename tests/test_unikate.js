// Unikat-Module (v8.463.0, Task #54, Build-System-Fortsetzung).
//
// HINTERGRUND: Zwei benannte Jagdstuecke mit eigener Herkunft (quelle:'unikat'): das
// Leviathanherz (nur Weltboss-Belohnung) und das Waechterauge (nur Waechter-
// Wiederholungssieg ab Tiefe 40, 7%). Immer Exotisch mit FESTEM Spitzenwurf (w110),
// fester unikatSub am Def (steht nicht im Schluessel, wuerfelt nie), Start GESPERRT
// (Modul-Schloss). Boerse/Schmieden/Neuschmieden gesperrt; Aufwerten inkl. Durchbruch
// und Substat-Reroll bleiben normal.
//
// GEPRUEFT WIRD (grantUnikatModul/moduleBonusAt/rerollModuleWert AUSGEFUEHRT, Wuerfel
// deterministisch, Muster wie test_rerollplus):
//   1) Defs/Icons/PvP-Paritaet (statisch)  2) Vergabe: Schluesselform, Schloss, Zaehler
//   3) unikatSub zaehlt in der Effekt-Summe  4) Neuschmieden lehnt Unikate ab
//   5) Sperren an Boerse/Schmieden/Knoepfen + Drop-Haken  6) Anzeige + Hilfe
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.462.0) fehlt der Block komplett - 0a schlaegt an.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- Extraktion (Regel 6: Anker-Existenz VOR dem Slice pruefen)
const gVon = JS.indexOf('function grantUnikatModul(defKey){');
const gBis = gVon < 0 ? -1 : JS.indexOf('\n  // Vergibt ein ABGRUND-Modul', gVon);
check('0a: grantUnikatModul gefunden', gVon > 0 && gBis > gVon);
if (gVon < 0 || gBis < 0) return ende();
const grantQuelle = JS.slice(gVon, gBis);

const fnAus = (name, endMarke) => {
  const von = JS.indexOf('function '+name+'(');
  const bis = JS.indexOf(endMarke, von);
  return (von > 0 && bis > von) ? JS.slice(von, bis) : '';
};
const rollQuelle = fnAus('rollModuleSubs', '\n  function moduleRerollCost');
const bonusQuelle = fnAus('moduleBonusAt', '\n  // Summe eines Modul-Effekts');
const wertRerollQuelle = fnAus('rerollModuleWert', '\n  function craftModuleFromFragments');
check('0b: Hilfsfunktionen extrahiert', rollQuelle.length > 50 && bonusQuelle.length > 50 && wertRerollQuelle.length > 50);

const konst = [
  JS.match(/const MODULE_WERT_MIN = \d+, MODULE_WERT_MAX = \d+;/)[0],
  JS.match(/const MODULE_SUB_MIN = \d+;[^\n]*/)[0],
  JS.match(/const MODULE_SUB_MAX = \d+;[^\n]*/)[0],
  JS.match(/const MODULE_SUB_RANGE = \{[^\n]*\};/)[0],
  "const HERKUNFT_NORMAL = 'normal'; const HERKUNFT_ABGRUND = 'abgrund'; const HERKUNFT_UNIKAT = 'unikat';",
  "function lockKeyFor(isShip, instKey){ return (isShip ? 's:' : 'l:') + instKey; }"
].join('\n');
const SUB_MIN = Number(JS.match(/const MODULE_SUB_MIN = (\d+);/)[1]);
const WERT_MAX = Number(JS.match(/const MODULE_WERT_MIN = \d+, MODULE_WERT_MAX = (\d+);/)[1]);

// ---- 1) Defs, Icons, PvP-Paritaet (statisch, am echten Stand - Regel 4)
check('1a: die bekannten Unikat-Defs tragen Herkunft und festen unikatSub',
  /key:'leviathanherz'[^\n]*quelle:HERKUNFT_UNIKAT,\n\s*unikatSub:\{ effect:'xpgain', value:0\.03 \}/.test(JS) &&
  /key:'waechterauge'[^\n]*quelle:HERKUNFT_UNIKAT,\n\s*unikatSub:\{ effect:'expedition', value:0\.03 \}/.test(JS) &&
  /key:'korsarenkrone'[^\n]*quelle:HERKUNFT_UNIKAT,\n\s*unikatSub:\{ effect:'fuelcost', value:0\.03 \}/.test(JS));
check('1b: kein unikatSub wuerfelt atk oder raidloss (PvP-Paritaet wie bei den Boss-Sets)',
  !(JS.match(/unikatSub:\{ effect:'(atk|raidloss)'/)));
// Die folgenden drei Pruefungen laufen ueber ALLE Unikat-Defs statt ueber eine getippte Liste
// (Arbeitsregel 3: die Regel pruefen, nicht die Momentaufnahme) - ein viertes Unikat ohne
// Icon, ohne Fundort oder ohne festen Bonus faellt damit von selbst auf, ohne dass jemand
// diesen Test anfassen muss.
const unikatBloecke = [...JS.matchAll(/\{ key:'([a-z_]+)', name:'([^']+)', icon:'([a-z_]+)'[\s\S]{0,400}?quelle:HERKUNFT_UNIKAT,\n\s*unikatSub:\{ effect:'([a-z]+)', value:[\d.]+ \}, fundort:'([^']+)'/g)]
  .map(m => ({ key:m[1], name:m[2], icon:m[3], sub:m[4], fundort:m[5] }));
check('1c: jedes Unikat-Def hat Icon-Schluessel, festen Bonus und Fundort',
  unikatBloecke.length === (JS.match(/quelle:HERKUNFT_UNIKAT,/g) || []).length && unikatBloecke.length >= 3,
  unikatBloecke.map(u => u.key));
check('1d: jedes Unikat-Icon ist ein handgezeichneter ICONS-Eintrag im Hausstil',
  unikatBloecke.every(u => {
    const m = JS.match(new RegExp('\\b' + u.icon + ": `(<svg[\\s\\S]*?<\\/svg>)`"));
    if (!m) return false;
    const gehaeuse = /M50 8 L86 29 V71 L50 92 L14 71 V29 Z/.test(m[1]);
    return gehaeuse && [...m[1].matchAll(/stroke-width="([\d.]+)"/g)].every(x => x[1] === '4' || x[1] === '1.6');
  }), unikatBloecke.map(u => u.icon));
check('1e: jedes Unikat nennt in seiner Beschreibung Fundstelle und Spitzenwurf',
  unikatBloecke.every(u => {
    const i = JS.indexOf("key:'" + u.key + "'");
    const block = JS.slice(i, i + 1400);
    return /UNIKAT/.test(block) && /Exotisch mit festem Spitzenwurf/.test(block);
  }), unikatBloecke.map(u => u.key));

// ---- Sandbox
function macheWelt(){
  const state = { modules: {}, shipModules: {}, moduleLocks: undefined, moduleFragments: 500,
                  equippedModules: { home: [] }, dailyQuests: { modulCount: 0 } };
  const logs = [], reports = [];
  const mathFest = { random: () => 0, floor: Math.floor, round: Math.round, max: Math.max, min: Math.min };
  const DEFS = [
    { key:'leviathanherz', name:'Leviathanherz', quelle:'unikat', effect:'prod',
      unikatSub:{ effect:'xpgain', value:0.03 }, fundort:'Weltboss-Jagd' } ];
  const api = new Function('state', 'Math', 'MODULE_DEFS', 'MODULE_SUB_POOL_LOC', 'MODULE_SUB_POOL_SHIP',
    'MODULE_SUB_EFFECT_LABEL', 'playSound', 'pushReport', 'registerShareMoment', 'log',
    'equippedAt', 'moduleInstanceInfo', 'shipModuleInstanceInfo', 'moduleSetMult', 'setBonusAt',
    'socketBonusAt', 'moduleTechMult', 'moduleWertRerollCost', 'moduleWertOf', 'wertWuerfeln',
    'moduleLockMitnehmen', 'render', 'save',
    konst + '\n' + rollQuelle + '\n' + grantQuelle + '\n' + bonusQuelle + '\n' + wertRerollQuelle
    + '\nreturn { grantUnikatModul, moduleBonusAt, rerollModuleWert };')(
    state, mathFest, DEFS, ['prod', 'def', 'storage', 'research'], ['hull'],
    { xpgain:'Erfahrung', def:'Verteidigung', storage:'Lager' },
    () => {}, (r) => reports.push(r), () => {}, (m) => logs.push(m),
    (pk) => state.equippedModules[pk||'home'] || [],
    (instKey) => {
      const def = DEFS.find(d => d.key === String(instKey).split(':')[0]);
      if (!def) return null;
      return { type:def.key, rarity:'exotisch', level:1, def, rar:{label:'Exotisch'}, subs:[], wert:110, bonus:0.35 };
    },
    () => null, () => 1, () => 0, () => 0, () => 1,
    () => 25, (k) => 110, () => 95, () => {}, () => {}, () => {});
  return { api, state, logs, reports };
}

// ---- 2) Vergabe: Schluesselform, Schloss, Report
{
  const w = macheWelt();
  const name = w.api.grantUnikatModul('leviathanherz');
  // random=0: Exotisch wuerfelt rng[0]=2 Substats, Pool ohne Primaereffekt (prod):
  // 'def'+SUB_MIN und 'storage'+SUB_MIN; dahinter der FESTE Spitzenwurf w<MAX>.
  const erwartet = 'leviathanherz:exotisch:1:def' + SUB_MIN + '.storage' + SUB_MIN + '.w' + WERT_MAX;
  check('2a: Vergabe erzeugt Exotisch Stufe 1 mit festem Spitzenwurf und normalen Substats',
    name === 'Leviathanherz' && w.state.modules[erwartet] === 1, w.state.modules);
  check('2b: das frische Unikat startet GESPERRT (Modul-Schloss)',
    w.state.moduleLocks && w.state.moduleLocks['l:' + erwartet] === true, w.state.moduleLocks);
  check('2c: der Fund erzeugt einen Bericht mit Fundort',
    w.reports.length === 1 && /UNIKAT geborgen: Leviathanherz/.test(w.reports[0].itemName) &&
    w.reports[0].foundAt === 'Weltboss-Jagd', w.reports);
  check('2d: unbekannter Schluessel vergibt nichts',
    w.api.grantUnikatModul('gibtesnicht') === null && Object.keys(w.state.modules).length === 1);
}

// ---- 3) unikatSub zaehlt in der Effekt-Summe, ohne im Schluessel zu stehen
{
  const w = macheWelt();
  w.state.equippedModules.home = ['leviathanherz:exotisch:1:w110'];
  check('3a: der feste Unikat-Bonus zaehlt auf seinen Effekt',
    Math.abs(w.api.moduleBonusAt('home', 'xpgain') - 0.03) < 1e-9, w.api.moduleBonusAt('home', 'xpgain'));
  check('3b: der Hauptbonus bleibt davon unberuehrt',
    Math.abs(w.api.moduleBonusAt('home', 'prod') - 0.35) < 1e-9);
}

// ---- 4) Neuschmieden lehnt Unikate ab (Handler-Sperre, nicht nur der fehlende Knopf)
{
  const w = macheWelt();
  const key = 'leviathanherz:exotisch:1:w110';
  w.state.modules[key] = 1;
  w.api.rerollModuleWert(false, key);
  check('4: rerollModuleWert lehnt ab und laesst alles unangetastet',
    w.state.modules[key] === 1 && w.state.moduleFragments === 500 &&
    w.logs.some(m => /Teil seiner Identität/.test(m)), w.logs);
}

// ---- 5) Sperren + Drop-Haken (statisch)
check('5a: die Boerse lehnt Unikate im Handler UND an beiden Knoepfen ab',
  /istUnikatModul\(isShip, instKey\)/.test(fnAus('listModuleOnMarket', 'moduleMarketInFlight = true')) &&
  JS.includes('!istUnikatModul(false, instKey) && !istAbgrundModul(false, instKey)?`<button data-offer-module') &&
  JS.includes('!istUnikatModul(true, instKey) && !istAbgrundModul(true, instKey)?`<button data-offer-shipmodule'));
check('5b: alle drei Schmiede-Handler sperren Unikate',
  (JS.match(/=== HERKUNFT_UNIKAT\)\{ log\('Unikate lassen sich nicht (fertigen|schmieden)/g) || []).length === 3);
check('5c: beide Wurf-Knoepfe verschwinden fuer Unikate',
  JS.includes("${istUnikatModul(false, instKey)?'':`<button data-wertreroll-module=") &&
  JS.includes("${istUnikatModul(true, instKey)?'':`<button data-wertreroll-shipmodule="));
check('5d: die Drop-Haken existieren an Weltboss und Waechter mit den dokumentierten Regeln',
  JS.includes("grantUnikatModul('leviathanherz')") &&
  JS.includes('0.04 + share*0.10 + (isTop ? 0.06 : 0)') &&
  JS.includes("? grantUnikatModul('waechterauge') : null;"));
// Beide Unikate fallen ZUSAETZLICH, nicht anstelle der bisherigen Beute. Beim Waechter ist das
// die Bedingung dafuer, dass seine dokumentierte Zusage ("garantiert ein Modul", Hilfe +
// test_abgrund 11 + test_relikte 6) weiter gilt - der erste Entwurf ersetzte das Modul und
// liess genau diese beiden Tests durchfallen (Arbeitsregel 9 in der Gegenrichtung: nicht die
// Erwartung nachziehen, sondern den Code, wenn die alte Erwartung eine Zusage schuetzt).
check('5e: der Waechter gibt sein garantiertes Modul weiterhin unabhaengig vom Unikat',
  /const modName = reliktNeu \? null : grantRandomModule\(\);/.test(JS));
// Drittes Unikat (v8.465.0) mit einer ANDEREN Jagdart: am Ende der Piratenkette. Auch hier
// zusaetzlich - der Endboss "laesst garantiert eines fallen" steht als Zusage im Code, und
// die Reihenfolge belegt es: erst der garantierte Wurf, dann der Unikat-Wurf obendrauf.
{
  const iGarantie = JS.indexOf('if (stage >= PIRATE_LAIR_MAX_STAGE || Math.random() < (0.10 + stage*0.02)){');
  const iUnikat = JS.indexOf("if (stage >= PIRATE_LAIR_MAX_STAGE && Math.random() < 0.15){");
  check('5f: der Piraten-Endboss wirft die Korsarenkrone ZUSAETZLICH zum garantierten Modul',
    iGarantie > 0 && iUnikat > iGarantie &&
    JS.includes("grantUnikatModul('korsarenkrone')"), { garantie: iGarantie, unikat: iUnikat });
}

// ---- 6) Anzeige + Hilfe (statisch)
check('6a: die Unikat-Zeile haengt an allen fuenf Kartenstellen',
  (JS.match(/\$\{info\?unikatZeile\(info\.def\):''\}/g) || []).length === 3 &&
  (JS.match(/\$\{unikatZeile\(info\.def\)\}/g) || []).length === 2);
check('6b: die Hilfe erklaert Quellen, Spitzenwurf, Sperren und Start-Schloss',
  JS.includes("title:'Unikate – benannte Jagdstücke'") &&
  JS.includes('Exotisch mit festem Spitzenwurf (110%)</strong>; der Unikat-Bonus würfelt nie') &&
  JS.includes('automatisch gesperrt</strong> im Inventar'));

ende();
