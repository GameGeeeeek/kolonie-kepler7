// Modul-Schloss (v8.458.0, Task #49, Build-System-Fortsetzung).
//
// HINTERGRUND: Fuenf Wege, ein wertvolles Modul zu verlieren - einzeln zerlegen, Schnell-
// Verschrotten, Kredit-Verkauf, Boerse und das stille Verheizen als Schmelz-Futter. Das
// Schloss sperrt alle fuenf; Werkbank-Aktionen bleiben erlaubt und nehmen das Schloss auf
// den neuen Schluessel mit.
//
// GEPRUEFT WIRD (Kern, Zerlegen, Bulk und fuseGeschwister AUSGEFUEHRT):
//   1) Toggle setzt/loest; der l:/s:-Praefix trennt die beiden Modulsysteme (gleicher
//      instKey, nur ein System gesperrt).
//   2) Die fuenf Sperren: Zerlegen und Bulk ausgefuehrt (gesperrt = unangetastet bzw.
//      uebersprungen), Verkauf/Boerse/Schmelz-Klick als Quelltext-Guard belegt, und
//      fuseGeschwister laesst gesperrte Stapel AUS - damit rechnen 3->1-Knopf, "2/3"-
//      Hinweis und Verbrauchsfolge automatisch ohne sie (eine Menge fuer alle drei).
//   3) Migration ausgefuehrt: Schloss wandert auf den neuen Schluessel; der alte verliert
//      es nur, wenn kein Exemplar mehr da ist; alle VIER Werkbank-Funktionen rufen sie.
//   4) Verdrahtung beider Schloss-Knoepfe + Hilfe.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.457.0) fallen 1a und die Folge-Pruefungen durch.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- Extraktion (Regel 6: Anker-Existenz vor jedem Slice)
const kernVon = JS.indexOf('function lockKeyFor(isShip, instKey){');
const kernBis = kernVon < 0 ? -1 : JS.indexOf('function sellModuleForCredits(', kernVon);
check('1a: Schloss-Kern gefunden', kernVon > 0 && kernBis > kernVon);
if (kernVon < 0 || kernBis < 0) return ende();
const kern = JS.slice(kernVon, kernBis);
const geschwVon = JS.indexOf('function fuseGeschwister(inv, instKey){');
const geschwBis = JS.indexOf('\n  }', geschwVon) + 4;
const dismVon = JS.indexOf('function dismantleModule(isShip, instKey){');
const dismBis = JS.indexOf('\n  }', dismVon) + 4;
const bulkVon = JS.indexOf('function bulkDismantleModules(isShip, filterFn, keepPerKey){');
const bulkBis = JS.indexOf('\n  }', bulkVon) + 4;
check('1b: alle Funktions-Slices gefunden', geschwVon > 0 && dismVon > 0 && bulkVon > 0);

function macheWelt(modules, shipModules){
  const state = { modules: Object.assign({}, modules||{}), shipModules: Object.assign({}, shipModules||{}),
                  moduleFragments: 0, dailyQuests: null };
  const logs = [];
  const infoStub = () => ({ rar: { label: 'Test' }, def: { name: 'Modul' }, level: 1 });
  const api = new Function('state', 'MODULE_FRAGMENT_VALUE', 'moduleLevelOf',
    'moduleInstanceInfo', 'shipModuleInstanceInfo', 'log', 'playSound', 'render', 'save',
    kern + '\n' + JS.slice(geschwVon, geschwBis) + '\n' + JS.slice(dismVon, dismBis) + '\n' + JS.slice(bulkVon, bulkBis)
    + '\nreturn { lockKeyFor, modulGesperrt, toggleModuleLock, moduleLockMitnehmen, fuseGeschwister, dismantleModule, bulkDismantleModules };')(
    state, { selten: 3 }, (k) => parseInt(String(k).split(':')[2] || '1', 10),
    infoStub, infoStub, (m) => logs.push(m), () => {}, () => {}, () => {});
  return { api, state, logs };
}

// ---- 1) Toggle + System-Trennung
{
  const w = macheWelt({ 'waffen:selten': 1 }, { 'waffen:selten': 1 });
  w.api.toggleModuleLock(false, 'waffen:selten');
  check('1c: Toggle sperrt; der Praefix trennt die Systeme (Schiffs-Stapel bleibt offen)',
    w.api.modulGesperrt(false, 'waffen:selten') === true &&
    w.api.modulGesperrt(true, 'waffen:selten') === false, w.state.moduleLocks);
  w.api.toggleModuleLock(false, 'waffen:selten');
  check('1d: erneuter Klick entsperrt restlos',
    w.api.modulGesperrt(false, 'waffen:selten') === false &&
    Object.keys(w.state.moduleLocks).length === 0, w.state.moduleLocks);
}

// ---- 2) die fuenf Sperren
{
  const w = macheWelt({ 'waffen:selten': 1 });
  w.api.toggleModuleLock(false, 'waffen:selten');
  w.api.dismantleModule(false, 'waffen:selten');
  check('2a: Zerlegen prallt am Schloss ab (Modul und Fragmente unangetastet)',
    w.state.modules['waffen:selten'] === 1 && w.state.moduleFragments === 0 &&
    w.logs.some(m => /gesperrt/.test(m)), w.state.modules);
  const w2 = macheWelt({ 'waffen:selten': 2, 'panzer:selten': 2 });
  w2.api.toggleModuleLock(false, 'waffen:selten');
  w2.api.bulkDismantleModules(false, () => true, 0);
  check('2b: Schnell-Verschrotten ueberspringt gesperrte Stapel',
    w2.state.modules['waffen:selten'] === 2 && w2.state.modules['panzer:selten'] === undefined &&
    w2.state.moduleFragments === 6, w2.state.modules);
  const w3 = macheWelt({ 'waffen:selten:1:w96': 1, 'waffen:selten:1:w108': 1, 'waffen:selten:1:w101': 1 });
  w3.api.toggleModuleLock(false, 'waffen:selten:1:w108');
  check('2c: gesperrte Stapel sind kein Schmelz-Futter (fuseGeschwister laesst sie aus)',
    JSON.stringify(w3.api.fuseGeschwister(w3.state.modules, 'waffen:selten:1:w96').sort()) ===
    JSON.stringify(['waffen:selten:1:w101', 'waffen:selten:1:w96']));
  check('2d: Verkauf, Boerse und Schmelz-Klick tragen den Guard im Quelltext',
    (JS.match(/if \(modulGesperrt\(isShip, instKey\)\)\{ log\('Dieses Modul ist gesperrt/g) || []).length >= 3);
}

// ---- 3) Migration
{
  const w = macheWelt({ 'waffen:selten:2': 1 });
  w.api.toggleModuleLock(false, 'waffen:selten:2');
  // Werkbank simuliert: ein Exemplar wandert von alt nach neu, alter Stapel leer.
  w.state.modules['waffen:selten:2'] = 0; delete w.state.modules['waffen:selten:2'];
  w.state.modules['waffen:selten:3'] = 1;
  w.api.moduleLockMitnehmen(false, 'waffen:selten:2', 'waffen:selten:3', w.state.modules);
  check('3a: das Schloss wandert auf den neuen Schluessel, der leere alte verliert es',
    w.api.modulGesperrt(false, 'waffen:selten:3') === true &&
    w.api.modulGesperrt(false, 'waffen:selten:2') === false, w.state.moduleLocks);
  const w2 = macheWelt({ 'waffen:selten:2': 2 });
  w2.api.toggleModuleLock(false, 'waffen:selten:2');
  w2.state.modules['waffen:selten:2'] = 1; w2.state.modules['waffen:selten:3'] = 1;
  w2.api.moduleLockMitnehmen(false, 'waffen:selten:2', 'waffen:selten:3', w2.state.modules);
  check('3b: bleiben Exemplare im alten Stapel, behalten BEIDE das Schloss',
    w2.api.modulGesperrt(false, 'waffen:selten:2') === true &&
    w2.api.modulGesperrt(false, 'waffen:selten:3') === true, w2.state.moduleLocks);
  check('3c: alle vier Werkbank-Funktionen rufen die Migration',
    (JS.match(/moduleLockMitnehmen\(isShip, instKey, (nextKey|newKey), inv\);/g) || []).length === 4);
}

// ---- 4) Verdrahtung + Hilfe
check('4a: beide Inventare haben den Schloss-Knopf',
  JS.includes('data-lock-module="${instKey}"') && JS.includes('data-lock-shipmodule="${instKey}"'));
check('4b: beide Knoepfe sind verdrahtet',
  JS.includes("toggleModuleLock(false, btn.getAttribute('data-lock-module'))") &&
  JS.includes("toggleModuleLock(true, btn.getAttribute('data-lock-shipmodule'))"));
check('4c: die Hilfe nennt alle fuenf Sperren und die Mitwanderung',
  JS.includes('<strong>Modul-Schloss:</strong>') &&
  JS.includes('gesperrte Stapel zählen nicht als Verschmelz-Geschwister') &&
  JS.includes('das Schloss wandert dabei auf den neuen Stand mit'));
check('4d: der Spielstand-Ladepfad legt moduleLocks an',
  JS.includes('if (state.moduleLocks === undefined) state.moduleLocks = {};'));

ende();
