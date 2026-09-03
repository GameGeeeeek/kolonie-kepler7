// Die Sektorlage im Frontend: der Aufschlag wirkt, steht an der Karte und ist eingefroren (E5).
//
//   node tests/test_sektorlage_ui.js
//
// DER ANLASS: Die Galaxie kannte genau EINE Schwierigkeitszahl (`npcEmpireStrength`, galaxieweit)
// - und die sah der Spieler nirgends. Sie wuchs serverseitig bis 2,5, und niemand sagte es ihm.
// Seit kolonie-kepler7-backend#222 rechnet der Server je Region einen Druck aus Nestern und
// Festungen und daraus einen NPC-Faktor, RELATIV zum Galaxieschnitt.
//
// GEPRUEFT WIRD:
//   1. DIE WIRKUNG ALS PAAR - dieselbe Gegner-Verteidigung mit und ohne belastete Region. Ohne
//      diese Messung belegte der Test nur, dass irgendwo "+20 %" geschrieben steht.
//   2. Die Gegenrichtung: OHNE sektorLage (alter Server, Schalter aus, Solo) aendert sich nichts.
//   3. Beide Kartenebenen nennen die Lage - und die ruhige Region sieht aus wie vorher.
//   4. Der Wert wird beim Missionsstart EINGEFROREN; die Aufloesung bevorzugt ihn.
//   5. Der Client rechnet die Lage NICHT nach (die Frontend-Kopie NEST_STUFEN traegt kein
//      `punkte`-Feld, und das soll so bleiben - sonst gaebe es zwei Quellen fuer dieselbe Zahl).
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 0) Quelltext-Anker -------------------------------------------------------------------------
check('0a: der Faktor sitzt in npcEffectiveDefense',
  /sektorNpcMult\(npc && npc\.system\)/.test(JS));
check('0b: der Missionsstart friert den WELT-Anteil ein, nicht die fertige Verteidigung',
  /weltFaktor: npcWeltFaktor\(npc\)/.test(JS) && !/effDefense: npcEffectiveDefense\(npc\)/.test(JS));
check('0c: die Aufloesung setzt ihn ein und faellt ohne ihn auf den lebenden Wert zurueck',
  /const effDefense = npcEffectiveDefense\(npc, m\.weltFaktor\);/.test(JS)
  && /typeof weltFaktor === 'number' && weltFaktor > 0\) \? weltFaktor : npcWeltFaktor\(npc\)/.test(JS));

/* ---- 0e) DER ANLASSFALL DER CODEX-PRUEFUNG (P1), als ausgefuehrte Regel ---------------------
   Der erste Entwurf fror die GANZE Verteidigung beim Start ein. npcEffectiveLoot liest den
   Siegzaehler aber bei der ANKUNFT, und npcScaling waechst nach jedem Sieg: Wer mehrere
   Flotten gleichzeitig auf denselben Gegner schickt (bis zu elf), kaempfte damit jedes Mal
   gegen die Verteidigung vom Start, waehrend die Beute mit jedem Sieg stieg. Belohnung und
   Schwierigkeit waren entkoppelt.
   Geprueft wird die REGEL, nicht die eine Zeile: Beide Funktionen werden geschnitten,
   ausgefuehrt und mit demselben steigenden Zaehler gefuettert - waechst die eine, muss die
   andere mitwachsen. */
const schneideFn = (kopf) => {
  const i = JS.indexOf(kopf);
  if (i < 0) return null;
  const j = JS.indexOf('\n  }', i);
  return j < 0 ? null : JS.slice(i, j + 4);
};
const FN_DEF = schneideFn('  function npcEffectiveDefense(npc, weltFaktor){');
const FN_LOOT = schneideFn('  function npcEffectiveLoot(npc){');
check('0e-anker: beide Funktionen lassen sich schneiden', !!FN_DEF && !!FN_LOOT,
  { def: !!FN_DEF, loot: !!FN_LOOT });
if (FN_DEF && FN_LOOT){
  const bau = new Function('siege', `
    function npcScalingCount(){ return siege; }
    function prestigeChallengeMult(){ return 1; }
    function seasonalLootMult(){ return 1; }
    function sektorNpcMult(){ return 1; }
    const galaxyCache = { npcEmpireStrength: 1 };
    function npcWeltFaktor(){ return 1; }
    ${FN_DEF}
    ${FN_LOOT}
    return { npcEffectiveDefense, npcEffectiveLoot };`);
  const npcProbe = { id:'x', defense: 1000, system:'kepler', loot: { erz: 1000 } };
  const reihe = [0, 1, 2, 5].map(s => {
    const a = bau(s);
    // MIT dem eingefrorenen Welt-Anteil gerechnet - genau so, wie die Aufloesung es tut.
    return { siege: s, def: a.npcEffectiveDefense(npcProbe, 1), beute: a.npcEffectiveLoot(npcProbe).erz };
  });
  const beideSteigen = reihe.every((r, i) => i === 0 || (r.def > reihe[i-1].def && r.beute > reihe[i-1].beute));
  check('0e: Verteidigung und Beute haengen am SELBEN lebenden Siegzaehler - auch mit eingefrorenem Welt-Anteil',
    beideSteigen, reihe);
}
/* Der Client rechnet die Lage nicht nach. Faellt diese Pruefung, hat jemand `punkte` in die
   Frontend-Kopie geschrieben - der erste Schritt zu zwei Quellen fuer dieselbe Zahl, von denen
   die zweite die ist, die niemand pflegt. */
const nestBlock = (() => {
  const i = JS.indexOf('const NEST_STUFEN');
  return i < 0 ? '' : JS.slice(i, JS.indexOf('\n  ]', i));
})();
check('0d-anker: die Frontend-Kopie NEST_STUFEN laesst sich schneiden', nestBlock.length > 50, nestBlock.length);
check('0d: sie traegt weiterhin KEIN punkte-Feld - der Client liest die Lage, er rechnet sie nicht',
  nestBlock.length > 50 && !/[^a-zA-Z]punkte\s*:/.test(nestBlock),
  { hinweis: 'kampfpunkte: enthaelt punkte: - der erste Entwurf fiel an seinem eigenen Teilstring' });

const SAVE_KEY = 'kepler7-save-v3';
const HEIMAT = 'kepler';
const NPC_SYS = 'kepler';      // raider1 sitzt hier; der Sektor heisst ebenfalls 'kepler'

// Eine belastete Region: nur der Kepler-Kern liegt ueber dem Schnitt.
const LAGE_BELASTET = { sektoren: {
  kepler:   { druck: 14, nester: 3, festungen: 1, ueber: 12.5, npcMult: 1.25, stufe: 'belagert' },
  wispern:  { druck: 0, nester: 0, festungen: 0, ueber: 0, npcMult: 1, stufe: 'ruhig' },
  solmark:  { druck: 0, nester: 0, festungen: 0, ueber: 0, npcMult: 1, stufe: 'ruhig' },
  obsidian: { druck: 0, nester: 0, festungen: 0, ueber: 0, npcMult: 1, stufe: 'ruhig' },
  meridian: { druck: 0, nester: 0, festungen: 0, ueber: 0, npcMult: 1, stufe: 'ruhig' },
  pulsar:   { druck: 0, nester: 0, festungen: 0, ueber: 0, npcMult: 1, stufe: 'ruhig' },
  ilyra:    { druck: 0, nester: 0, festungen: 0, ueber: 0, npcMult: 1, stufe: 'ruhig' },
  rand:     { druck: 0, nester: 0, festungen: 0, ueber: 0, npcMult: 1, stufe: 'ruhig' }
}, schnitt: 1.75, stand: Date.now() };

function backend(store, opt){
  opt = opt || {};
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:HEIMAT, homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy'){
      const g = { npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[],
        activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], wrackKonvois:[] };
      if (opt.lage) g.sektorLage = opt.lage;
      return j(g);
    }
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'reports') return req.method() === 'POST' ? j({ ok:true }) : j({ reports: [] });
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}
async function tab(browser, opt){
  const store = {};
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store, opt));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
                      'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  return { ctx, page, errs };
}
// Die Verteidigung, die der Spieler VOR dem Angriff sieht - aus dem Kartenmenue des Gegners.
async function npcVerteidigung(page){
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(700);
  const { oeffneSystemUeberSektoren } = require('./lib/karte');
  await oeffneSystemUeberSektoren(page, NPC_SYS);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const n = document.querySelector('[data-map-npc]');
    if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:100, clientY:100 }));
  });
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const box = document.querySelector('.kmenu-info') || document.body;
    const t = box.textContent || '';
    const m = /([\d.  ]+)\s*Verteidigung/.exec(t);
    return { zahl: m ? Number(m[1].replace(/[^\d]/g, '')) : null, text: t };
  });
}

(async () => {
  const browser = await starteBrowser();

  // ---- 1/2) Die Wirkung als PAAR ---------------------------------------------------------------
  const ohne = await tab(browser);
  const vOhne = await npcVerteidigung(ohne.page);
  check('1a: ohne Sektorlage nennt das Kartenmenue eine Verteidigung', vOhne.zahl > 0, vOhne.zahl);
  check('1b: und KEINE Lage-Zeile - eine ruhige Galaxie sieht aus wie vorher',
    !/Belagert|Unruhig|darin enthalten/.test(vOhne.text), vOhne.text.slice(0, 160));
  check('1c: keine Seitenfehler ohne das Feld (alter Server, Schalter aus, Solo)',
    ohne.errs.length === 0, ohne.errs.slice(0, 2));
  await ohne.ctx.close();

  const mit = await tab(browser, { lage: LAGE_BELASTET });
  const vMit = await npcVerteidigung(mit.page);
  check('2a: mit belasteter Region steigt die Verteidigung um GENAU den Faktor',
    vOhne.zahl > 0 && vMit.zahl === Math.round(vOhne.zahl * 1.25),
    { ohne: vOhne.zahl, mit: vMit.zahl, erwartet: Math.round(vOhne.zahl * 1.25) });
  check('2b: und das Menue nennt den Grund, nicht nur die Zahl',
    /Belagert/.test(vMit.text) && /darin enthalten/.test(vMit.text), vMit.text.slice(0, 200));

  // ---- 3) Beide Kartenebenen -------------------------------------------------------------------
  /* BEWUSST EIN FRISCHER REITER: Der Kartenreiter oeffnet die Regionsuebersicht. Der erste Entwurf
     maass sie im selben Reiter wie das Kartenmenue oben - dort steht man im aufgeklappten System,
     und von dort fuehrt kein einzelner Heimweg-Knopf zurueck. Alle vier Pruefungen waren rot,
     obwohl der Code stimmte. */
  const karte = await tab(browser, { lage: LAGE_BELASTET });
  await karte.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await karte.page.waitForTimeout(1200);
  const raender = await karte.page.evaluate(() => {
    const out = {};
    for (const p of document.querySelectorAll('path[data-sektor-lage]')){
      const k = p.getAttribute('data-sektor-lage');
      out[k] = (out[k] || 0) + 1;
    }
    const belagert = document.querySelector('path[data-sektor-lage="belagert"]');
    const ruhig = document.querySelector('path[data-sektor-lage="ruhig"]');
    return { arten: out,
      belagertRand: belagert ? belagert.getAttribute('stroke') : null,
      belagertBreite: belagert ? belagert.getAttribute('stroke-width') : null,
      ruhigRand: ruhig ? ruhig.getAttribute('stroke') : null,
      ruhigBreite: ruhig ? ruhig.getAttribute('stroke-width') : null };
  });
  check('3a: die belastete Region traegt einen eigenen Rand, die ruhige den alten',
    raender.belagertRand && raender.ruhigRand === '#39426b' && raender.belagertRand !== '#39426b'
    && raender.ruhigBreite === '1.4' && raender.belagertBreite === '2.2',
    raender);
  check('3b: alle acht Regionen tragen ihre Lage als Datenfeld',
    Object.values(raender.arten).reduce((a, b) => a + b, 0) === 8, raender.arten);
  await karte.page.evaluate(() => {
    const g = document.querySelector('[data-sektor="kepler"]');
    if (g) g.dispatchEvent(new MouseEvent('click', { bubbles:true }));
  });
  await karte.page.waitForTimeout(900);
  const kopfzeile = await karte.page.evaluate(() => {
    const t = document.querySelector('[data-kb-lage]');
    return t ? { text: t.textContent || '', y: t.getAttribute('y') } : null;
  });
  check('3c: die Sektoransicht traegt die Lage als eigene Kopfzeile unter der Eigenart',
    !!kopfzeile && /Belagert/.test(kopfzeile.text) && /Druck/.test(kopfzeile.text) && kopfzeile.y === '72',
    kopfzeile);
  check('3d: und nennt den Aufschlag in derselben Zeile',
    !!kopfzeile && /NPCs \+25%/.test(kopfzeile.text), kopfzeile && kopfzeile.text);
  check('3e2: keine Seitenfehler auf beiden Kartenebenen', karte.errs.length === 0, karte.errs.slice(0, 2));
  await karte.ctx.close();
  check('3e: keine Seitenfehler mit gesetzter Lage', mit.errs.length === 0, mit.errs.slice(0, 2));
  await mit.ctx.close();
  await browser.close();
  ende();
})();
