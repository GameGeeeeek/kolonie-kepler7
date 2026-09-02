// Der Vorposten-Bau sagt, WARUM er nicht geht (02.09.2026).
//
// Spieler-Report Sascha: "habe versucht einen vorposten zu errichten ging aber anscheinend nicht".
// Gemessen im Browser bei 390x844 (Telefon): Der Knopf "Vorposten errichten" stand da, war aber
// `disabled` - ein gesperrter Knopf feuert KEINEN Klick, und der Grund stand ausschliesslich im
// `title`. Am Telefon gibt es kein Hover: Tippen -> nichts. Kein Toast, keine Protokollzeile,
// keine Erklaerung. Dieselbe Fehlerklasse wie beim Festungsschlag (v8.631.0).
//
// Dazu ein zweiter Fund aus derselben Messung: Die Baukosten (60k Erz, 40k Kristalle, 25k Deuterium)
// koennen GROESSER sein als das, was das Lager ueberhaupt fasst - Lagerstufe 30 ohne Boni fasst
// 12.800. "Nicht genug Rohstoffe" schickt den Spieler dann ins Warten auf etwas, das nie eintritt.
// Der Grund nennt in diesem Fall den Ausweg.
//
// GEPRUEFT: Quelltext (0a-0c) und zwei Browser-Staende am Telefon-Format:
//   A) kein freies Kolonieschiff  -> Klick meldet genau das
//   B) Kolonieschiff da, Lager zu klein -> Klick nennt Lagergroesse UND Ausweg
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';

// ---- 0) Quelltext -------------------------------------------------------------------------------
check('0a: der Bau-Knopf ist NICHT mehr disabled (ein gesperrter Knopf feuert keinen Klick)',
  /data-vorposten-bau="1" \$\{grundB \? 'aria-disabled="true" style="opacity:0\.55;"' : ''\}/.test(src)
  && !/data-vorposten-bau="1" \$\{grundB \? 'disabled' : ''\}/.test(src));
check('0b: vorpostenBauStarten meldet den Grund als warn (9 s, wartet auf freie Sicht)',
  /if \(grund\)\{ log\(grund, 'ti-alert-triangle', 'warn'\); return; \}/.test(src));
check('0c: ein Lager, das die Baukosten nie fasst, wird als solches benannt (mit Ausweg)',
  /const zuKlein = Object\.values\(VORPOSTEN_BAUKOSTEN\)\.some\(a => a > cap\);/.test(src)
  && /Bau Lager oder Kryolager aus/.test(src));

const now = Date.now();
function spielstand(colonyShips, lager){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager: lager, werft:14 }, research:{},
    fleet:{ jaeger:80, cruisers:12, colonyShips: colonyShips, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5e5, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}
async function lauf(browser, colonyShips, lager){
  // Telefon-Format: Genau dort fehlt das Hover, auf das der alte Stand seinen Grund gelegt hatte.
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand(colonyShips, lager) };
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{}, wrackKonvois:[] });
    if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, liste:[], maxJeKonto:3, schutzMs:86400000, abklingMs:7200000,
      stufen:[{stufe:1,name:'Feldlager',kernLp:20000,garnisonMax:20,nutzen:{flug:0.1,prod:0.05}},{stufe:2,name:'Stützpunkt',kernLp:60000,garnisonMax:50,nutzen:{flug:0.2,prod:0.1}},{stufe:3,name:'Bastion',kernLp:150000,garnisonMax:100,nutzen:{flug:0.3,prod:0.15}}] });
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
    if (p === 'players-map') return j({ players:[] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
    return j({ ok:true });
  });
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok');
    const beob = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('toast')) (window.__toasts = window.__toasts || []).push(n.textContent); });
    document.addEventListener('DOMContentLoaded', () => { const c = document.getElementById('toastContainer'); if (c) beob.observe(c, { childList:true }); });
    window.__confirms = []; window.confirm = (x) => { window.__confirms.push(x); return false; };
  });
  await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; }));
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(800);
  await oeffneSystemUeberSektoren(page, 'vega');
  await page.waitForTimeout(1200);
  const knopf = await page.evaluate(() => { const b = document.querySelector('[data-vorposten-bau]'); return b ? { da:true, disabled: b.disabled, aria: b.getAttribute('aria-disabled'), sichtbar: b.getBoundingClientRect().height > 0 } : { da:false }; });
  await page.evaluate(() => { window.__toasts = []; const b = document.querySelector('[data-vorposten-bau]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  const nach = await page.evaluate(() => ({ toasts: (window.__toasts||[]).slice(), confirms: (window.__confirms||[]).slice(), log: (document.getElementById('log')||{}).textContent || '' }));
  return { ctx, knopf, nach, errs };
}
(async () => {
  const browser = await starteBrowser();

  // ---- A) kein freies Kolonieschiff --------------------------------------------------------------
  const a = await lauf(browser, 0, 30);
  check('1-vorab: Boot ohne Skriptfehler, der Bau-Knopf steht sichtbar in der Systemansicht', a.errs.length === 0 && a.knopf.da === true && a.knopf.sichtbar === true, { errs: a.errs.slice(0,2), knopf: a.knopf });
  check('1a: der gesperrte Knopf ist klickbar (nur optisch gedaempft, aria-disabled)', a.knopf.disabled === false && a.knopf.aria === 'true', a.knopf);
  check('1b: der Klick meldet den Grund als Toast - nicht nur im Tooltip', a.nach.toasts.some(x => /Kein freies Kolonieschiff/.test(x)), a.nach.toasts);
  check('1c: und die Protokollzeile nennt ihn ebenfalls', /Kein freies Kolonieschiff/.test(a.nach.log), a.nach.log.slice(0, 120));
  check('1d: ohne erfuellte Voraussetzung wird keine Bestaetigung gezeigt (der Bau startet nicht)', a.nach.confirms.length === 0, a.nach.confirms);
  await a.ctx.close();

  // ---- B) Kolonieschiff da, aber das Lager fasst die Baukosten nie -------------------------------
  const b = await lauf(browser, 2, 30);
  check('2a: der Klick nennt die Lagergroesse statt eines blossen "nicht genug Rohstoffe"',
    b.nach.toasts.some(x => /Dein Lager fasst nur/.test(x)) && !b.nach.toasts.some(x => /^Baukosten: .* – nicht genug Rohstoffe\.$/.test(x)), b.nach.toasts);
  check('2b: und er nennt den Ausweg (Lager/Kryolager/Lagerforschung)', b.nach.toasts.some(x => /Bau Lager oder Kryolager aus/.test(x)), b.nach.toasts);
  check('2c: keine Skriptfehler', b.errs.length === 0, b.errs.slice(0,2));
  await b.ctx.close();

  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });
// Gegenprobe gemessen 02.09.2026 (KEPLER_SPIELDATEI = v8.633.0 ohne diese Aenderung): rot 0a 0b 0c 1a 1b 1c 2a 2b (8),
// gruen bleiben 1-vorab 1d 2c (3); Prueflisten identisch (11). 1d ist alt gruen, weil dort GAR NICHTS passiert
// (der disabled-Knopf schluckt den Klick) - genau der gemeldete Fehler; 2c, weil ein stummer Knopf keinen Fehler wirft.
