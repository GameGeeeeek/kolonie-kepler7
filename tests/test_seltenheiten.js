// Sieben Modul-Seltenheiten (v8.443.0, Build-System Etappe 1, Wunsch Sascha).
//
// DIE ZWEI NEUEN STUFEN: Ungewoehnlich (+30%, zwischen Gewoehnlich und Selten, normaler
// Fundpool) und Exotisch (+600%, ueber Mythisch, NICHT im Fundpool, NICHT fertigbar -
// entsteht AUSSCHLIESSLICH durch Verschmelzen von 3 Mythischen).
//
// GEPRUEFT WIRD (die kritischen Teile AUSGEFUEHRT):
//   1) Die Seltenheits-Tabelle: sieben Stufen in RANG-Reihenfolge (die Schmelzkette laeuft
//      ueber Object.keys!), Multiplikatoren streng steigend, jede Stufe mit Label und Farbe.
//   2) Vollstaendigkeit der Nebentabellen: JEDE Stufe hat Zerlegewert und Verkaufspreis;
//      die Fertigungstabelle laesst GENAU mythisch und exotisch aus (beabsichtigte Luecken).
//   3) AUSGEFUEHRT: nextRarityOf-Kette laeuft von gewoehnlich bis exotisch; fuseModules
//      verschmilzt 3 Mythische zu 1 Exotischen, sperrt den Sprung NACH Mythisch weiterhin
//      und meldet bei Exotisch das Ende der Kette.
//   4) Fundwuerfe: die Ungewoehnlich-Baender existieren in allen drei Ziehwegen; KEIN Wurf
//      erreicht exotisch.
//   5) PARITAET: die Backend-Kopie MODULE_RARITY_MULT stimmt Stufe fuer Stufe mit dem
//      Frontend ueberein (der ||1-Fallback wuerde eine fehlende Stufe still verschlucken).
//   6) Hilfe-Texte nennen die neuen Stufen und Zahlen (zweite Anzeigestelle, Pflicht 6).
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren ausgefuehrt): am alten Stand fallen 1a
// (fuenf statt sieben), 3 und 5 durch.
const fs = require('fs');
const { SPIELDATEI, SERVER_JS, pruefer, ueberspringen } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) Die Tabelle selbst, ausgefuehrt geparst
const tabVon = JS.indexOf('const MODULE_RARITY = {');
const tabBis = JS.indexOf('\n  };', tabVon);
check('1a: MODULE_RARITY gefunden', tabVon > 0 && tabBis > tabVon);
const RAR = new Function(JS.slice(tabVon, tabBis + 5) + '\nreturn MODULE_RARITY;')();
const ORDNUNG = Object.keys(RAR);
check('1b: sieben Stufen in Rang-Reihenfolge (Schmelzkette haengt an Object.keys!)',
  ORDNUNG.join(',') === 'gewoehnlich,ungewoehnlich,selten,episch,legendaer,mythisch,exotisch', ORDNUNG);
check('1c: Multiplikatoren streng steigend',
  ORDNUNG.every((k, i) => i === 0 || RAR[k].mult > RAR[ORDNUNG[i-1]].mult),
  ORDNUNG.map(k => RAR[k].mult));
check('1d: jede Stufe hat Label und eigene Farbe',
  ORDNUNG.every(k => RAR[k].label && /^#[0-9a-f]{6}$/i.test(RAR[k].color)) &&
  new Set(ORDNUNG.map(k => RAR[k].color)).size === ORDNUNG.length);

// ---- 2) Nebentabellen vollstaendig (aus der Datei geparst, gegen die GEPARSTE Ordnung)
const objAus = (name) => {
  const m = JS.match(new RegExp('const ' + name + ' = \\{([^\\n]*)\\};'));
  return m ? new Function('return {' + m[1] + '};')() : null;
};
const frag = objAus('MODULE_FRAGMENT_VALUE'), sell = objAus('MODULE_SELL_CREDITS'),
      craft = objAus('MODULE_FRAGMENT_CRAFT_COST'), subR = objAus('MODULE_SUB_RANGE');
check('2a: JEDE Stufe hat Zerlegewert, Verkaufspreis und Zweitwert-Spanne',
  !!(frag && sell && subR) && ORDNUNG.every(k => frag[k] > 0 && sell[k] > 0 && Array.isArray(subR[k])),
  ORDNUNG.filter(k => !(frag && frag[k]) || !(sell && sell[k]) || !(subR && subR[k])));
check('2b: Zerlegewerte und Verkaufspreise steigen mit dem Rang',
  ORDNUNG.every((k, i) => i === 0 || (frag[k] > frag[ORDNUNG[i-1]] && sell[k] > sell[ORDNUNG[i-1]])));
check('2c: die Fertigungstabelle laesst GENAU mythisch und exotisch aus',
  !!craft && ORDNUNG.filter(k => craft[k] === undefined).join(',') === 'mythisch,exotisch',
  craft && ORDNUNG.filter(k => craft[k] === undefined));
const shipOrder = (JS.match(/const SHIP_MODULE_RARITY_ORDER = \[([^\]]*)\];/) || ['', ''])[1];
check('2d: die Schiffsmodul-Rangliste kennt dieselben sieben Stufen',
  new Function('return [' + shipOrder + '];')().join(',') === ORDNUNG.join(','));

// ---- 3) Schmelzkette ausgefuehrt
{
  const fnAus = (kopf) => {
    const a = JS.indexOf(kopf);
    const b = a < 0 ? -1 : JS.indexOf('\n  }', a);
    return b > a ? JS.slice(a, b + 4) : '';
  };
  const qNext = fnAus('function nextRarityOf(rarity){');
  // Seit v8.444.0 (Wert-Streuung) matcht die Schmelze GESCHWISTER - die beiden Helfer
  // gehoeren mit in die Sandbox, sonst wirft fuseModules einen ReferenceError (Arbeitsregel 9).
  const qFuse = fnAus('function fuseGeschwister(inv, instKey){') + '\n' +
                fnAus('function fuseAnzahl(inv, instKey){') + '\n' +
                fnAus('function fuseModules(isShip, instKey){');
  check('3a: nextRarityOf und fuseModules gefunden', qNext.length > 100 && qFuse.length > 900);
  const naechste = new Function('MODULE_RARITY', qNext + '\nreturn nextRarityOf;')(RAR);
  check('3b: die Kette laeuft luecklos von gewoehnlich bis exotisch und endet dort',
    ORDNUNG.every((k, i) => naechste(k) === (ORDNUNG[i+1] || null)));
  const mach = (inv) => {
    const logs = [];
    const state = { modules: inv, shipModules: {} };
    const fn = new Function('state', 'MODULE_RARITY', 'MODULE_FUSE_COUNT', 'nextRarityOf',
      'moduleLevelOf', 'moduleWertOf', 'moduleInstanceInfo', 'shipModuleInstanceInfo', 'log', 'playSound', 'render', 'save',
      qFuse + '\nreturn fuseModules;')(
      state, RAR, 3, naechste,
      (k) => parseInt(String(k).split(':')[2] || '1', 10), () => 100,
      (k) => ({ rar: RAR[String(k).split(':')[1]] || { label: '?' }, def: { name: 'Testmodul' } }),
      () => null, (t) => logs.push(t), () => {}, () => {}, () => {});
    return { fn, state, logs };
  };
  const a = mach({ 'waffen:mythisch': 3 });
  a.fn(false, 'waffen:mythisch');
  check('3c: 3 Mythische verschmelzen zu 1 Exotischen (die einzige Quelle der Stufe)',
    a.state.modules['waffen:exotisch'] === 1 && !a.state.modules['waffen:mythisch'],
    a.state.modules);
  const b = mach({ 'waffen:legendaer': 3 });
  b.fn(false, 'waffen:legendaer');
  check('3d: der Sprung NACH Mythisch bleibt gesperrt (Schmiede/Allianzmissionen)',
    !b.state.modules['waffen:mythisch'] && b.state.modules['waffen:legendaer'] === 3 &&
    b.logs.some(t => t.includes('Mythisch entsteht nicht durch Verschmelzen')), b.logs);
  const c = mach({ 'waffen:exotisch': 3 });
  c.fn(false, 'waffen:exotisch');
  check('3e: Exotisch ist das Ende der Kette',
    c.state.modules['waffen:exotisch'] === 3 && c.logs.some(t => t.includes('Höchste Seltenheit')), c.logs);
}

// ---- 4) Fundwuerfe
check('4a: alle drei Ziehwege wuerfeln das Ungewoehnlich-Band',
  JS.includes("else if (roll < 0.78) rarity = 'ungewoehnlich';") &&
  JS.includes("else if (roll > 0.20) rarity = 'ungewoehnlich';") &&
  JS.includes('else if (roll < 0.78) idx = 1;'));
check('4b: KEIN Wurf erreicht exotisch (nur die Schmelze)',
  !/rarity = 'exotisch'/.test(JS) && !/idx = 6/.test(JS));

// ---- 5) Backend-Paritaet der Multiplikatoren
if (!SERVER_JS) return ueberspringen('Backend-Repo liegt nicht daneben - MODULE_RARITY_MULT-Paritaet nicht pruefbar.');
{
  const srv = fs.readFileSync(SERVER_JS, 'utf8');
  const m = srv.match(/const MODULE_RARITY_MULT = \{([^\n]*)\};/);
  check('5a: Backend-Kopie gefunden', !!m);
  const be = m ? new Function('return {' + m[1] + '};')() : {};
  const abweichung = ORDNUNG.filter(k => be[k] !== RAR[k].mult);
  check('5b: Backend-Multiplikatoren stimmen Stufe fuer Stufe mit dem Frontend ueberein',
    abweichung.length === 0 && Object.keys(be).length === ORDNUNG.length,
    abweichung.map(k => k + ': FE ' + RAR[k].mult + ' vs BE ' + be[k]));
}

// ---- 6) Hilfe (zweite Anzeigestelle)
check('6a: die Hilfe nennt sieben Stufen mit den echten Faktoren',
  JS.includes('sieben Seltenheitsstufen') &&
  JS.includes('Ungewöhnlich +' + Math.round((RAR.ungewoehnlich.mult - 1) * 100) + '%') &&
  JS.includes('Exotisch +' + Math.round((RAR.exotisch.mult - 1) * 100) + '%'));
check('6b: die Hilfe nennt die Exotisch-Quelle und die Fragment-Staffel',
  JS.includes('3 Mythische verschmelzen zu einem Exotischen') &&
  JS.includes('Exotisch ' + frag.exotisch) && JS.includes('Exotisch ist nicht fertigbar'));

ende();
