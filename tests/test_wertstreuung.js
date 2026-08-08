// Hauptwert-Streuung je Fund (v8.444.0, Build-System Etappe 2, Wunsch Sascha).
//
// ARCHITEKTUR: Jeder FUND wuerfelt seinen Hauptwert 90-110%, kodiert als "wNN"-Token im
// Substat-Segment des instKey - bewusst KEIN fuenftes Segment, damit die strenge
// Boersen-Validierung des Servers (MODULE_INSTKEY_RE) unveraendert passt. Gefertigte
// Module und Altbestand gelten als 100%. Die Schmelze matcht seither GESCHWISTER
// (Typ+Seltenheit+Stufe) statt identischer Schluessel und uebernimmt den besten Wurf.
//
// GEPRUEFT WIRD (die kritischen Teile AUSGEFUEHRT):
//   1) Parser: w-Token ist KEIN Zweitwert, moduleWertOf liest und klemmt ihn, Altbestand=100.
//   2) Verrechnung: moduleInstanceInfo multipliziert den Wurf in den Bonus (ausgefuehrt).
//   3) Alle fuenf Fundpfade wuerfeln; Fertigung bleibt bei 100% (kein Token).
//   4) Schmelze AUSGEFUEHRT: Geschwister zaehlen zusammen, andere Stufe zaehlt NICHT,
//      das Ergebnis traegt den besten Wurf der verbrauchten drei.
//   5) Reroll laesst den Hauptwert stehen.
//   6) SERVER: MODULE_INSTKEY_RE akzeptiert das Token (ausgefuehrt gegen die echte Regex),
//      moduleWertMultServer liest es identisch (ausgefuehrt), und BEIDE Nachrechnungs-
//      stellen (PvP-Kampfmodule, Ueberfall-Schutz) multiplizieren ihn.
//   7) Hilfe nennt Spanne, Fertigungs-Ausnahme und die neue Schmelzregel.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren ausgefuehrt): am alten Stand fallen 1, 2, 4
// und 6 durch.
const fs = require('fs');
const { SPIELDATEI, SERVER_JS, pruefer, ueberspringen } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const fnAus = (kopf) => {
  const a = JS.indexOf(kopf);
  const b = a < 0 ? -1 : JS.indexOf('\n  }', a);
  return b > a ? JS.slice(a, b + 4) : '';
};

// ---- 1) Parser
const qSubs = fnAus('function moduleSubsOf(instKey){');
const qWert = fnAus('function moduleWertOf(instKey){');
check('1a: moduleSubsOf und moduleWertOf gefunden', qSubs.length > 200 && qWert.length > 100);
const konst = 'const MODULE_WERT_MIN = 90, MODULE_WERT_MAX = 110;\n';
const subsVon = new Function(konst + qSubs + '\nreturn moduleSubsOf;')();
const wertVon = new Function(konst + qWert + '\nreturn moduleWertOf;')();
check('1b: das w-Token ist KEIN Zweitwert',
  JSON.stringify(subsVon('waffen:selten:1:prod15.w104')) === JSON.stringify([{ effect: 'prod', value: 0.015 }]));
check('1c: moduleWertOf liest den Wurf, klemmt Ausreisser und gibt Altbestand 100',
  wertVon('waffen:selten:1:prod15.w104') === 104 &&
  wertVon('waffen:selten:1:w90') === 90 &&
  wertVon('waffen:selten:1:w999') === 110 &&
  wertVon('waffen:selten') === 100 &&
  wertVon('waffen:selten:3:prod15') === 100);

// ---- 2) Verrechnung ausgefuehrt (Standort-Info mit gestellten Abhaengigkeiten)
{
  const qInfo = fnAus('function moduleInstanceInfo(instKey){');
  check('2a: moduleInstanceInfo gefunden', qInfo.length > 300);
  const info = new Function('MODULE_DEFS', 'MODULE_RARITY', 'moduleLevelOf', 'moduleLevelMult',
    'moduleSubsOf', 'moduleWertOf', 'abgrundTiefenSkala',
    qInfo + '\nreturn moduleInstanceInfo;')(
    [{ key: 'waffen', effect: 'atk', base: 0.05 }],
    { selten: { label: 'Selten', mult: 1.6 } },
    (k) => parseInt(String(k).split(':')[2] || '1', 10), () => 1,
    subsVon, wertVon, () => 1);
  const mit = info('waffen:selten:1:w104'), ohne = info('waffen:selten');
  check('2b: der Wurf multipliziert den Hauptbonus (104% von 8%)',
    Math.abs(mit.bonus - 0.05 * 1.6 * 1.04) < 1e-9 && mit.wert === 104, mit && mit.bonus);
  check('2c: ohne Token bleibt der Normwert', Math.abs(ohne.bonus - 0.08) < 1e-9 && ohne.wert === 100);
}

// ---- 3) Fundpfade wuerfeln, Fertigung nicht
// Gezaehlt werden die AUFRUFE im Schluesselbau (":1:'+mitWertWurf") - die blosse
// Funktionsdefinition matcht dasselbe Kurzmuster und verfaelschte die Zaehlung (erster Lauf).
check('3a: alle fuenf Fundpfade haengen den Wurf an (mitWertWurf)',
  (JS.match(/:1:'\+mitWertWurf\(subs\)/g) || []).length === 5);
check('3b: die Fragment-Fertigung bleibt bei 100% (kein Token im gefertigten Schluessel)',
  JS.includes("const instKey = defKey+':'+rarity;"));

// ---- 4) Schmelze ausgefuehrt: Geschwister + bester Wurf
{
  const quelle = fnAus('function fuseGeschwister(inv, instKey){') + '\n' +
                 fnAus('function fuseAnzahl(inv, instKey){') + '\n' +
                 fnAus('function fuseModules(isShip, instKey){');
  check('4a: fuseGeschwister/fuseAnzahl/fuseModules gefunden', quelle.length > 1200, quelle.length);
  const RAR = { selten: { label: 'Selten' }, episch: { label: 'Episch' } };
  const mach = (inv) => {
    const logs = [];
    const state = { modules: inv, shipModules: {} };
    const fn = new Function('state', 'MODULE_RARITY', 'MODULE_FUSE_COUNT', 'nextRarityOf',
      'moduleLevelOf', 'moduleWertOf', 'moduleInstanceInfo', 'shipModuleInstanceInfo',
      'log', 'playSound', 'render', 'save',
      quelle + '\nreturn fuseModules;')(
      state, RAR, 3, (r) => r === 'selten' ? 'episch' : null,
      (k) => parseInt(String(k).split(':')[2] || '1', 10), wertVon,
      (k) => ({ rar: RAR[String(k).split(':')[1]] || { label: '?' }, def: { name: 'Testmodul' } }),
      () => null, (t) => logs.push(t), () => {}, () => {}, () => {});
    return { fn, state, logs };
  };
  // Drei GESCHWISTER mit verschiedenen Wuerfen und Zweitwerten - Fusion klappt, bester Wurf bleibt.
  const a = mach({ 'waffen:selten:1:w96': 1, 'waffen:selten:1:prod12.w108': 1, 'waffen:selten:1:w101': 1 });
  a.fn(false, 'waffen:selten:1:w96');
  check('4b: Geschwister verschmelzen trotz verschiedener Wuerfe/Zweitwerte, bester Wurf bleibt',
    a.state.modules['waffen:episch:1:w108'] === 1 && Object.keys(a.state.modules).length === 1,
    a.state.modules);
  // Eine andere STUFE zaehlt nicht mit - zwei Geschwister reichen nicht.
  const b = mach({ 'waffen:selten:1:w96': 2, 'waffen:selten:2:w110': 1 });
  b.fn(false, 'waffen:selten:1:w96');
  check('4c: eine andere Stufe zaehlt NICHT als Geschwister',
    b.state.modules['waffen:selten:1:w96'] === 2 && !b.state.modules['waffen:episch:1:w110'] &&
    b.logs.some(t => t.includes('derselben Seltenheit und Stufe')), b.state.modules);
}

// ---- 5) Reroll
check('5: der Substat-Reroll traegt den alten Hauptwert-Wurf ins neue Segment',
  JS.includes("if (wAlt !== 100) newSubs += '.w' + wAlt;"));

// ---- 6) Server-Paritaet (ausgefuehrt gegen die echte Regex und den echten Parser)
if (!SERVER_JS) return ueberspringen('Backend-Repo liegt nicht daneben - Wert-Paritaet nicht pruefbar.');
{
  const srv = fs.readFileSync(SERVER_JS, 'utf8');
  const reM = srv.match(/const MODULE_INSTKEY_RE = (\/[^\n]+\/);/);
  check('6a: die Boersen-Validierung gefunden', !!reM);
  const re = reM ? new Function('return ' + reM[1] + ';')() : /$^/;
  check('6b: die strenge Boersen-Regex akzeptiert Schluessel MIT Wurf-Token',
    re.test('panzerung:ungewoehnlich:1:prod15.w104') && re.test('waffen:exotisch:10:w96') &&
    !re.test('waffen:selten:1:prod15:extra'));
  const qSrvVon = srv.indexOf('function moduleWertMultServer(instKey) {');
  const qSrvBis = srv.indexOf('\n}', qSrvVon);
  check('6c: moduleWertMultServer existiert', qSrvVon > 0 && qSrvBis > qSrvVon);
  const srvWert = new Function(srv.slice(qSrvVon, qSrvBis + 2) + '\nreturn moduleWertMultServer;')();
  check('6d: der Server liest den Wurf identisch (104 -> 1.04, ohne Token -> 1, geklammert)',
    Math.abs(srvWert('waffen:selten:1:prod15.w104') - 1.04) < 1e-9 &&
    srvWert('waffen:selten') === 1 && Math.abs(srvWert('x:y:1:w999') - 1.1) < 1e-9);
  check('6e: BEIDE Nachrechnungsstellen multiplizieren den Wurf (PvP-Kampfmodule + Ueberfall-Schutz)',
    (srv.match(/\* moduleWertMultServer\(instKey\);/g) || []).length === 2);
}

// ---- 7) Hilfe (zweite Anzeigestelle)
check('7: die Hilfe nennt Spanne, Fertigungs-Ausnahme und die neue Schmelzregel',
  JS.includes('zwischen <strong>90% und 110%</strong> des Normwerts') &&
  JS.includes('Gefertigte Module liegen immer exakt bei 100%') &&
  JS.includes('besten Hauptwert-Wurf der drei'));

ende();
