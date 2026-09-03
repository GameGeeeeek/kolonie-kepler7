// Sammlung: Verbrauchsgueter lassen sich direkt im Reiter aktivieren (02.09.2026, Wunsch Sascha:
// "verbrauchsgueter aktivierbar in der sammlung machen").
//
// Bis hierher zeigte die Sammlung den Bestand ("2x"), aktivieren ging nur im Inventar unter
// Fortschritt. Jetzt traegt jede Zeile eines BESESSENEN Verbrauchsguts den Aktivieren-Knopf des
// Inventars (data-item-activate) und ruft dieselbe Funktion (activateItem) - eine Implementierung,
// zwei Einstiegspunkte. Module, Materialien, Reliquien und nicht besessene Gueter haben keinen.
//
// GEPRUEFT: Quelltext (0a-0c) und im Browser: Knopf nur an der richtigen Zeile, ein Klick
// verbraucht genau ein Exemplar, die Wirkung tritt ein (Buff), die Zeile zeigt den neuen Bestand,
// die Meldung kommt. Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';

check('0a: renderSammlung baut den Aktivieren-Knopf nur fuer besessene Verbrauchsgueter',
  /const aktivieren = \(g\.art === 'verbrauch' && n > 0\)\s*\? `<button data-item-activate="\$\{escapeHtml\(g\.key\)\}"/.test(src));
check('0b: der Knopf ruft activateItem (dieselbe Funktion wie das Inventar) und zeichnet die Sammlung neu',
  /box\.querySelectorAll\('\[data-item-activate\]'\)\.forEach\(btn => btn\.onclick = \(e\) => \{ e\.stopPropagation\(\); activateItem\(btn\.getAttribute\('data-item-activate'\)\); renderSammlung\(\); \}\);/.test(src));
check('0c: die Hilfe zur Sammlung nennt das Aktivieren', /title:'Verbrauchsgüter direkt aktivieren'/.test(src));

const now = Date.now();
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:30, werft:14 }, research:{}, fleet:{ jaeger:80, kreuzer:10, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich', avatarKey:null }, xp:9e5, credits:5e5, buffs:[],
    inventory:{ boost_prod: 2 },
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}
(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand() };
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{}, wrackKonvois:[] });
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
    if (p === 'players-map') return j({ players:[] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
    return j({ ok:true });
  });
  await page.addInitScript(() => {
    localStorage.setItem('kepler7_token', 'tok');
    const beob = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('toast')) (window.__toasts = window.__toasts || []).push(n.textContent); });
    document.addEventListener('DOMContentLoaded', () => { const c = document.getElementById('toastContainer'); if (c) beob.observe(c, { childList:true }); });
  });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(6000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="sammlung"]'); if (x) x.click(); });
  await page.waitForTimeout(1200);
  const lage = await page.evaluate(() => {
    const box = document.getElementById('sammlungBox');
    const knoepfe = box ? Array.from(box.querySelectorAll('[data-item-activate]')).map(b => b.getAttribute('data-item-activate')) : null;
    const zeilen = box ? box.querySelectorAll('.card-row').length : 0;
    const btn = box && box.querySelector('[data-item-activate="boost_prod"]');
    const pille = btn ? (btn.closest('.card-row').querySelector('.lvl-pill') || {}).textContent : null;
    const name = btn ? (btn.closest('.card-row').querySelector('.bname') || {}).textContent : null;
    return { knoepfe, zeilen, pille, name };
  });
  check('1a: die Sammlung ist aufgebaut (viele Zeilen), genau EIN Aktivieren-Knopf - am einzigen besessenen Verbrauchsgut',
    lage.zeilen > 50 && Array.isArray(lage.knoepfe) && lage.knoepfe.join() === 'boost_prod', { zeilen: lage.zeilen, knoepfe: lage.knoepfe });
  check('1b: die Zeile heisst Ressourcenschub und zeigt 2x', /Ressourcenschub/.test(lage.name || '') && /^2x$/.test((lage.pille || '').trim()), { name: lage.name, pille: lage.pille });
  // Klicks null-sicher: Am alten Stand gibt es den Knopf nicht - dann sollen die Pruefungen fallen, nicht der Test abbrechen.
  await page.evaluate(() => { window.__toasts = []; const b = document.querySelector('#sammlungBox [data-item-activate="boost_prod"]'); if (b) b.click(); });
  await page.waitForTimeout(700);
  const danach = await page.evaluate(() => {
    const box = document.getElementById('sammlungBox');
    const btn = box && box.querySelector('[data-item-activate="boost_prod"]');
    const pille = btn ? (btn.closest('.card-row').querySelector('.lvl-pill') || {}).textContent : null;
    return { pille, knopfNochDa: !!btn, toasts: (window.__toasts || []).slice() };
  });
  // Der Spielzustand ist im Test nicht erreichbar (IIFE) - gelesen wird der Spielstand, den
  // activateItem() per save() zum Server schickt (der Mitschnitt der PUT-Route, wie test_festung_ui).
  const stand = () => { try { return JSON.parse(st['kepler7-save-v3']); } catch(e){ return {}; } };
  const s1 = stand();
  Object.assign(danach, { bestand: (s1.inventory||{}).boost_prod, buffs: (s1.buffs||[]).map(b => b.kind) });
  check('2a: ein Klick verbraucht genau ein Exemplar und die Wirkung tritt ein (Buff prod)', danach.bestand === 1 && danach.buffs.join() === 'prod', { bestand: danach.bestand, buffs: danach.buffs });
  check('2b: die Zeile zeigt den neuen Bestand 1x, der Knopf bleibt (noch ein Exemplar)', /^1x$/.test((danach.pille || '').trim()) && danach.knopfNochDa === true, { pille: danach.pille, knopf: danach.knopfNochDa });
  check('2c: die Meldung des Gegenstands kommt als Toast', danach.toasts.length >= 1, danach.toasts);
  await page.evaluate(() => { const b = document.querySelector('#sammlungBox [data-item-activate="boost_prod"]'); if (b) b.click(); });
  await page.waitForTimeout(700);
  const leer = await page.evaluate(() => ({ knopf: !!document.querySelector('#sammlungBox [data-item-activate="boost_prod"]'), pille: (Array.from(document.querySelectorAll('#sammlungBox .card-row')).find(r => /Ressourcenschub/.test((r.querySelector('.bname')||{}).textContent||''))||{querySelector:()=>null}).querySelector('.lvl-pill')?.textContent }));
  leer.bestand = (stand().inventory||{}).boost_prod;
  check('2d: nach dem letzten Exemplar verschwindet der Knopf, die Zeile bleibt als "noch nicht"-Eintrag stehen', leer.bestand === 0 && leer.knopf === false && /noch nicht/.test(leer.pille || ''), leer);
  check('3: keine Skriptfehler', errs.length === 0, errs.slice(0, 3));
  await ctx.close(); await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });
// Gegenprobe gemessen 02.09.2026 (KEPLER_SPIELDATEI = v8.631.0 ohne diese Aenderung): rot 0a 0b 0c 1a 1b 2a 2b 2c 2d (9),
// gruen bleibt 3 (keine Skriptfehler - der alte Stand ist ja nicht kaputt, nur ohne Knopf); Prueflisten identisch (10).
