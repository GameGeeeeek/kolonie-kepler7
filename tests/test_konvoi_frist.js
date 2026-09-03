// Die Vorschau des Wrackkonvoi-Angriffs MISST die Entkommen-Frist gegen den Hinflug (01.09.2026).
//
//   node tests/test_konvoi_frist.js
//
// Ein Konvoi entkommt nach KONVOI_LEBENSDAUER_STD Stunden ganz. Liegt die ANKUNFT (Hinflug = flug/2)
// hinter dieser Frist, findet der Verband leeren Raum vor - das kostet nur Treibstoff, aber es lohnt
// nicht, und genau das muss die Vorschau VOR dem Start sagen. Gemessen wird das PAAR (Regel 61):
// derselbe Konvoi einmal mit 16 Stunden Rest, einmal mit einer Minute Rest - die Aussage muss sich
// UNTERSCHEIDEN. Ein Lauf allein waere auch von einem fest verdrahteten Satz erfuellt.
//
// GEGENPROBE: Die Frist-Messung aus konvoiVorschauHtml entfernen -> 2c faellt (beide Laeufe zeigen
// dieselbe Aussage); die Warnung immer anzeigen -> 2a faellt.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
check('0a: die Vorschau rechnet mit der Entkommen-Frist', /const entkommtIn = konvoiEntkommtBis\(k\) - Date\.now\(\);/.test(JS));
check('0b: und misst sie gegen den HINFLUG, nicht den Rundflug', /entkommtIn <= \(flug\/2\)\*1000/.test(JS));

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
const ZIEL_ID = 'kv-frist-1';
function konvoi(seitVor){
  return { id: ZIEL_ID, sys: SYS, lp: 26000, lpMax: 40000, seit: Date.now() - seitVor,
    naechsteWanderung: Date.now() + 4*3600000, beitraege:{}, schlaege:{},
    beute: { essenz: 4, kampfpunkte: 20, xp: 150, credits: 600, modulChance: 0.3 } };
}
function backend(seitVor, store){
  store = store || {};
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null,
      collapsedSystems:{}, activeWormhole:null, news:[], alienNester: [], wrackKonvois: [konvoi(seitVor)] });
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{} } } });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|reports/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}
async function vorschau(browser, save, seitVor){
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  // Der Spielstand reist ueber den Storage-Mock (Server-Modus), nicht ueber localStorage - wie in
  // test_nest_ui: mit gesetztem Token liest und schreibt das Spiel ausschliesslich den Server.
  await page.route('**/api/**', backend(seitVor, { [SAVE_KEY]: save }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => { for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){ const e = document.getElementById(id); if (e) e.remove(); } });
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.evaluate(() => { const n = document.querySelector('[data-map-konvoi]'); if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true})); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button, .kmenu .card-row')].find(x => /Konvoi angreifen/.test(x.textContent)); if (b) b.click(); });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => { const o = document.getElementById('fwahlOverlay'); return { da: !!o && o.getBoundingClientRect().height > 0, txt: o ? (o.textContent||'').replace(/\s+/g,' ') : '' }; });
  r.errs = errs;
  await ctx.close();
  return r;
}

(async () => {
  const browser = await starteBrowser();
  // Ausgangsstand aus dem Spiel selbst holen (wie test_nest_ui), dann eine Kampfflotte hineinlegen.
  const store0 = {};
  const ctx0 = await browser.newContext(); const p0 = await ctx0.newPage();
  await p0.route('**/api/**', backend(0, store0)); await p0.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await p0.goto(SPIEL_URL); await p0.waitForTimeout(3500);
  const basis = JSON.parse(store0[SAVE_KEY] || '{}');
  await ctx0.close();
  check('0c: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings);
  if (!basis.buildings){ await browser.close(); return ende(); }
  const st = JSON.parse(JSON.stringify(basis));
  for (const k of Object.keys(st.fleet)) if (typeof st.fleet[k] === 'number') st.fleet[k] = 0;
  st.fleet.cruisers = 120;
  const fern = Date.now() + 365*24*3600*1000;
  for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
  st.activeEvent = null; st.buffs = [];
  for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 400000;
  const SAVE = JSON.stringify(st);

  const lang = await vorschau(browser, SAVE, 2*3600000);                 // entkommt in 16 Stunden
  check('1-anker: die Flottenwahl ist offen (16 h Rest)', lang.da, { da: lang.da, errs: lang.errs.slice(0,2) });
  check('2a: mit 16 Stunden Rest nennt die Vorschau die Frist und KEINE Zu-spaet-Warnung',
    /Entkommt in/.test(lang.txt) && !/Zu spät/.test(lang.txt), { auszug: lang.txt.slice(200, 700) });
  const kurz = await vorschau(browser, SAVE, 18*3600000 - 60000);        // entkommt in 1 Minute
  check('2b-anker: die Flottenwahl ist offen (1 min Rest)', kurz.da, { da: kurz.da });
  check('2b: mit einer Minute Rest warnt sie "Zu spaet" und nennt den Hinflug', /Zu spät/.test(kurz.txt) && /Hinflug dauert/.test(kurz.txt), { auszug: kurz.txt.slice(200, 700) });
  check('2c: die beiden Aussagen UNTERSCHEIDEN sich (die Vorschau misst, sie behauptet nicht)', /Zu spät/.test(kurz.txt) !== /Zu spät/.test(lang.txt));
  await browser.close();
  ende();
})();
