// PvE-Ziele (Konvoi, Nest, Festung): Die eigene Abklingzeit ist SICHTBAR, und ein Angriff in die
// Abklingzeit oder neben einen schon fliegenden Verband kommt gar nicht erst zustande (02.09.2026).
//
// Spieler-Report Sascha: "abklingzeit wrackkonvois sollte angezeigt werden bzw wenn cooldown da
// sollte man erst garnicht erst angreifen koennen". Gemessen: Das Kartenmenue sperrte den Knopf
// zwar, aber (a) nur, wenn der aktive Standort den ersten Verband geschickt hatte - ein zweiter
// Verband von einer Kolonie flog los und lief bei der Ankunft in die 403-Abklingzeit des Servers;
// (b) die Startfunktionen selbst prueften nichts, der Flottenwahl-Dialog kann laenger offen stehen,
// als der Zustand gilt; (c) die Restzeit stand nur als Knopfgrund, nicht am Marker und nicht als
// eigene Zeile.
//
// GEPRUEFT: Quelltext (0a-0f) und ein Browser-Szenario mit zwei Konvois: k1 in Abyss mit eigener
// Abklingzeit (Schlag vor 30 min, 2 h Frist), k2 in Vega ohne. Marker-Tooltip, Menuezeile,
// Knopfgrund, Torwaechter in sendKonvoiMission (beide Gruende) und die Gegenrichtung: ohne Grund
// startet die Mission, und pveSchlagMerken setzt den Stempel sofort.
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';

// ---- 0) Quelltext ------------------------------------------------------------------------------------
check('0a: pveVerbandUnterwegs prueft ueber ALLE Standorte', /function pveVerbandUnterwegs\(typ, feld, wert\)\{\s*return allFleetsWithPlanet\(\)/.test(src));
check('0b: die drei Kartenmenues (Nest, Konvoi, Festung) nutzen sie', (src.match(/const schonUnterwegs = pveVerbandUnterwegs\(/g) || []).length === 3, (src.match(/const schonUnterwegs = pveVerbandUnterwegs\(/g) || []).length);
check('0c: die drei Startfunktionen haben den Torwaechter (Abklingzeit UND unterwegs)',
  /const abklingK = konvoiAbklingBis\(k\);/.test(src) && /const abklingN = nestAbklingBis\(nest\);/.test(src)
  && /const abklingF = letzterF \? letzterF \+ FESTUNG_ABKLING_STD/.test(src) && (src.match(/warte seinen Schlag ab\.'/g) || []).length === 3);
check('0d: die Flottenwahl-Sperre nennt die Abklingzeit (Konvoi, Nest, Festung)',
  (src.match(/'Abklingzeit – nächster Schlag an (diesem Konvoi|diesem Nest|dieser Festung) in '/g) || []).length === 3);
check('0e: Konvoi- und Nest-Marker tragen den naechsten Schlag im Tooltip, beide Menues die Abklingzeile',
  (src.match(/' · dein nächster Schlag in '/g) || []).length === 2 && (src.match(/\+ pveAbklingZeile\(/g) || []).length === 2);
check('0f: nach einem gewerteten Schlag setzen Konvoi, Nest und Festung den Stempel sofort',
  (src.match(/pveSchlagMerken\(/g) || []).length === 4, (src.match(/pveSchlagMerken\(/g) || []).length);

// ---- Fixture ---------------------------------------------------------------------------------------
// Drei Konvois: k1 in Abyss mit eigener Abklingzeit (Schlag vor 30 min, Frist 2 h); k2 in Vega ohne
// Abklingzeit, aber ein Verband der KOLONIE Vesna ist schon dorthin unterwegs (der aktive Standort
// ist der Heimatplanet und hat nichts fliegen); k3 in Vega ohne alles - die Gegenrichtung.
// Der Spielzustand ist im Test nicht erreichbar (IIFE): gemessen wird ueber DOM und den Spielstand,
// den das Spiel per save() an die PUT-Route schickt (Mitschnitt, wie test_festung_ui).
const now = Date.now();
const konvoi = (id, sys, schlaege) => ({ id, sys, lp: 5000, lpMax: 8000, seit: now - 3600000, schlaege: schlaege || {},
  beute: { essenz: 2, kampfpunkte: 10, xp: 100, credits: 500 } });
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:30, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, destroyers:4, missions:[] },
    colonies:{ vesna:{ buildings:{}, fleet:{ jaeger:5, missions:[{ id:'m-kol-k2', type:'konvoi-angriff', targetId:'vega', system:'vega', zielId:'k2', startTime: now, endTime: now + 3600000, fleetName:'Kolonie-Verband', composition:{ jaeger:5 } }] } } },
    discovered:{ vesna:true }, activeBasePlanet:'home', player:{ id:ICH, name:'Ich', avatarKey:null }, xp:9e5, credits:5e5, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}
(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:['vesna'] }), 'kepler7-save-v3': spielstand() };
  const stand = () => { try { return JSON.parse(st['kepler7-save-v3']); } catch(e){ return {}; } };
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{},
      wrackKonvois: [konvoi('k1', 'abyss', { [ICH]: now - 30*60000 }), konvoi('k2', 'vega', {}), konvoi('k3', 'vega', {})] });
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
  await page.waitForTimeout(500);
  check('1-vorab: Boot ohne Skriptfehler', errs.length === 0, errs.slice(0, 2));
  const menueLesen = () => page.evaluate(() => {
    const btn = document.querySelector('[data-kmenu-i="0"]'); const grund = document.querySelector('.kmenu-grund'); const zeile = document.querySelector('[data-pve-abkling]');
    return { knopf: btn ? btn.textContent.trim() : null, gesperrt: btn ? btn.disabled : null, grund: grund ? grund.textContent : null, zeileFlag: zeile ? zeile.getAttribute('data-pve-abkling') : null, zeile: zeile ? zeile.textContent : null };
  });
  const markerKlick = id => page.evaluate(id => { const n = document.querySelector('[data-map-konvoi="' + id + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:300, clientY:300 })); return !!n; }, id);
  const menueZu = () => page.evaluate(() => { document.body.dispatchEvent(new MouseEvent('click', { bubbles:true })); const k = document.querySelector('.kmenu'); if (k) k.remove(); });

  // ---- 1) Sichtbar: Marker-Tooltip und Menuezeile in Abyss (k1, Abklingzeit laeuft) ----------------
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(800);
  await oeffneSystemUeberSektoren(page, 'abyss');
  await page.waitForTimeout(1200);
  const marker = await page.evaluate(() => { const n = document.querySelector('[data-map-konvoi="k1"]'); return n ? (n.querySelector('title') || {}).textContent || '' : null; });
  check('1a: der Konvoi-Marker nennt den naechsten eigenen Schlag im Tooltip', !!marker && /dein nächster Schlag in/.test(marker), marker);
  await markerKlick('k1'); await page.waitForTimeout(500);
  const m1 = await menueLesen();
  check('1b: der Angriffsknopf ist gesperrt und nennt die Restzeit als Grund', m1.gesperrt === true && /sammeln sich neu/.test(m1.grund || '') && /nächster Schlag in/.test(m1.grund || ''), m1);
  check('1c: eine eigene Zeile nennt letzten und naechsten Schlag und verweist auf die Berichte',
    m1.zeileFlag === '1' && /Dein letzter Schlag an diesem Konvoi: vor/.test(m1.zeile || '') && /nächster in/.test(m1.zeile || '') && /Berichte › Kämpfe/.test(m1.zeile || ''), m1.zeile);
  await menueZu();

  // ---- 2) Ein Verband der KOLONIE ist unterwegs - der Heimatplanet darf keinen zweiten schicken ----
  await oeffneSystemUeberSektoren(page, 'vega');
  await page.waitForTimeout(1200);
  const da2 = await markerKlick('k2'); await page.waitForTimeout(500);
  const m2 = await menueLesen();
  check('2a: k2 - der Knopf ist gesperrt, weil ein Verband eines ANDEREN Standorts schon unterwegs ist', da2 && m2.gesperrt === true && /bereits zu diesem Konvoi unterwegs/.test(m2.grund || ''), m2);
  check('2b: k2 - ohne eigenen Schlag gibt es keine Abklingzeile (nichts zu melden)', m2.zeile === null, m2.zeile);
  await menueZu();

  // ---- 3) Gegenrichtung: k3 ohne Grund - Menue offen, Dialog offen, Start moeglich, Mission entsteht -
  const da3 = await markerKlick('k3'); await page.waitForTimeout(500);
  const m3 = await menueLesen();
  check('3a: k3 - ohne Abklingzeit und ohne fliegenden Verband ist der Knopf frei', da3 && m3.gesperrt === false && /Öffnet die Flottenwahl/.test(m3.grund || ''), m3);
  await page.evaluate(() => { const b = document.querySelector('[data-kmenu-i="0"]'); if (b && !b.disabled) b.click(); });
  await page.waitForTimeout(700);
  const dlg = await page.evaluate(() => { const o = document.getElementById('fwahlOverlay'); const s = o && o.querySelector('[data-fwahl-start]'); return { da: !!o && o.getBoundingClientRect().height > 0, start: s ? !s.disabled : null, txt: o ? (o.textContent || '').replace(/\s+/g, ' ') : '' }; });
  check('3b: die Flottenwahl oeffnet sich, der Start ist frei und nennt keine Abklingzeit', dlg.da && dlg.start === true && !/Abklingzeit – nächster Schlag/.test(dlg.txt), { da: dlg.da, start: dlg.start, sperre: (dlg.txt.match(/(Wähle mindestens[^.]*\.|Abklingzeit[^.]*\.)/) || [])[1] });
  await page.evaluate(() => { const b = document.querySelector('#fwahlOverlay [data-fwahl-start]'); if (b && !b.disabled) b.click(); });
  await page.waitForTimeout(1500);
  const missionen = ((stand().fleet || {}).missions || []).filter(m => m.type === 'konvoi-angriff').map(m => m.zielId);
  check('3c: die Mission zu k3 entsteht (die Sperre sperrt nicht blind)', missionen.includes('k3'), missionen);
  // Und jetzt ist k3 "unterwegs" - vom Heimatplaneten aus - und der Knopf muss zu sein.
  await markerKlick('k3'); await page.waitForTimeout(500);
  const m3b = await menueLesen();
  check('3d: danach ist k3 fuer einen zweiten Start gesperrt (Verband unterwegs)', m3b.gesperrt === true && /bereits zu diesem Konvoi unterwegs/.test(m3b.grund || ''), m3b);
  check('4: keine Skriptfehler', errs.length === 0, errs.slice(0, 3));
  await ctx.close(); await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });
// Gegenprobe gemessen 02.09.2026 (KEPLER_SPIELDATEI = v8.631.0 ohne diese Aenderung): rot 0a 0b 0c 0d 0e 0f 1a 1c 2a (9),
// gruen bleiben 1-vorab 1b 2b 3a 3b 3c 3d 4 (8); Prueflisten identisch (17). 1b ist alt gruen, weil das Menue die
// Abklingzeit des AKTIVEN Standorts schon sperrte - neu sind Tooltip (1a), Zeile (1c) und die Sperre ueber alle
// Standorte (2a); 3d ist alt gruen, weil der Heimatplanet dort selbst geschickt hat.
