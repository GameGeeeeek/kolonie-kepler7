// Festungsschlag: Der Spieler erfaehrt, was sein Angriff bewirkt hat (Spieler-Report Sascha,
// 02.09.2026: "asteroidenfestung muss man anscheinend mehrmals angreifen aber man bekommt keinerlei
// info was der angriff bewirkt hat ob cooldown ist oder ein bericht").
//
//   node tests/test_festung_rueckmeldung.js
//
// GEMESSEN VOR DEM UMBAU (Szenario: Festungsmission waehrend der Abwesenheit angekommen, beim
// naechsten Start aufgeloest): Bericht und Abzeichen kamen an, aber die Meldung war ein Toast von
// 4,2 s, der HINTER dem Willkommen-zurueck- und dem Update-Overlay aufging - unsichtbar. Und im
// Fehlerfall deutete der Client JEDE 403-Antwort als "Abklingzeit", obwohl der Server drei Gruende
// schickt (Abklingzeit, kein gespeicherter Spielstand, keine Flotte im Spielstand) - der Text des
// Servers wurde verworfen (`if (!res.ok) daten = null`).
//
// GEBAUT: (1) Der Servertext (daten.error) wird in allen vier Aufloesungen behalten und im Toast
// wie im Bericht genannt. (2) Toasts mit Gewicht (wichtig, warn) warten, solange ein Overlay den
// Blick verdeckt, und bleiben 9 s; jeder Schlag gilt als wichtig. (3) Das Festungsmenue und der
// Marker nennen den eigenen Beitrag, den Hortanteil, den letzten und den naechsten Schlag.
//
// DIE MESSUNGEN SIND REGELN: Ein Toast mit Gewicht erscheint NICHT, solange ein Overlay offen ist,
// und erscheint, sobald es zu ist (Paar); der Servertext steht woertlich im Bericht; das Menue
// rechnet den Anteil aus den Beitraegen des Feldes (7.400 von 22.200 = 33 %), nicht aus einer
// festen Zahl.
//
// GEGENPROBE per KEPLER_SPIELDATEI gegen origin/main (v8.628.0) - Pflichtliste am Ende des Kopfes.
//
// PFLICHTLISTE (gemessen am 02.09.2026, Prueflisten beider Laeufe per diff identisch):
// am alten Stand fallen 0a 0b 0c 0d 1a 1b 1d 1e 1f 2a 2b 2c; gruen bleiben MUESSEN 1-vorab, 2-vorab
// (Boot ohne Skriptfehler), 1c (der Bericht kommt auch alt an - genau deshalb steht er nie allein)
// und 1g (der Willkommen-Toast erscheint auch alt bei offenem Overlay: er hat kein Gewicht).
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';

// ---- 0) Quelltext ------------------------------------------------------------------------------------
{
  const decl = (src.match(/let daten = null, status = 0, serverFehler = '';/g) || []).length;
  const behalten = (src.match(/if \(!res\.ok\)\{ serverFehler = \(daten && typeof daten\.error === 'string'\)/g) || []).length;
  const verworfen = (src.match(/if \(!res\.ok\) daten = null;/g) || []).length;
  check('0a: alle vier Aufloesungen (Anfechtung, Nest, Konvoi, Festung) behalten den Servertext', decl === 4 && behalten === 4 && verworfen === 0, { decl, behalten, verworfen });
  check('0b: der Grund im Festungs-, Nest- und Konvoi-Zweig nennt den Servertext vor dem Statuscode',
    /const festGrund = 'Der Angriff kam nicht zustande – '\s*\+ \(serverFehler \|\|/.test(src)
    && (src.match(/\+ ' – ' \+ \(serverFehler \|\| \(status === 403/g) || []).length === 2);
  check('0c: pushToast kennt die Warteschlange fuer verdeckte Sicht und die 9-Sekunden-Dauer',
    /function toastOverlayOffen\(\)/.test(src) && /const dauer = \(type === 'wichtig' \|\| type === 'warn'\) \? 9000 : 4200;/.test(src)
    && /toastWarteschlange\.push\(\[msg, icon, type\]\)/.test(src));
  check('0d: jeder Schlag (Festung, Nest, Konvoi) meldet sich als wichtig',
    (src.match(/'wichtig'\); \/\/ jeder Schlag ist wichtig/g) || []).length === 2 && /\/\/ Jeder Schlag ist wichtig, nicht nur der letzte/.test(src)
    && !/\(daten\.gefallen \|\| daten\.zerstoert\) \? 'wichtig' : undefined/.test(src));
}

// ---- Fixture ---------------------------------------------------------------------------------------
const now = Date.now();
const mission = () => ({ id:'m-fest-1', type:'festung-angriff', targetId:'abyss', system:'abyss', festungId:'f-abyss-1', stufe:'schanze', stufeName:'Schanze', ziel:'kern',
  composition:{ jaeger:40, kreuzer:6 }, startTime: now-40*60000, endTime: now-10*60000, fleetName:'Erste Flotte', planet:'home' });
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:30, werft:14 }, research:{}, fleet:{ jaeger:80, kreuzer:10, missions:[mission()] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich', avatarKey:null }, xp:9e5, credits:5e5, buffs:[],
    // lastTick 45 Minuten zurueck: das Spiel war zu, die Mission ist waehrenddessen angekommen -> Willkommen-zurueck-Overlay
    lastTick: now-45*60000, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now-3600000 });
}
async function lauf(browser, antwort, festungExtra){
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const feld = { systeme:['abyss'], felder:{ abyss:{ plaetze:{}, festung: Object.assign({ id:'f-abyss-1', stufe:'schanze', kern:30000, kernMax:30000, hort:8000, sorte:'eisenkern', schlaege:{}, beitraege:{}, bauteile:{} }, festungExtra || {}) } } };
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand() };
  const reports = [];
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{} });
    if (p === 'asteroid/field') return j(feld);
    if (p === 'festung/angriff') return j(antwort.body, antwort.status);
    if (p === 'reports'){ if (req.method() === 'POST'){ const b = JSON.parse(req.postData() || '{}'); reports.unshift(Object.assign({ id:'r'+reports.length, time: Date.now() }, b.report)); return j({ ok:true }); } return j({ reports }); }
    if (p === 'players-map') return j({ players:[] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT') return j({ ok:true, version:2 }); if (st[k] !== undefined) return j({ key:k, value:st[k], shared:true, version:1 }); return j({ e:1 }, 404); }
    return j({ ok:true });
  });
  // Jeden Toast mit Zeitstempel und Overlay-Zustand mitschneiden - ein Endstand-Blick saehe den
  // 4-Sekunden-Toast nie (Regel: transiente Meldungen als Verlauf messen).
  await page.addInitScript(() => {
    localStorage.setItem('kepler7_token', 'tok');
    const beob = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('toast'))
      (window.__toasts = window.__toasts || []).push({ t: n.textContent, overlay: ['welcomeBackOverlay','updateNoticeOverlay','tutorialOverlay'].filter(id => { const o = document.getElementById(id); return o && getComputedStyle(o).display !== 'none'; }).length }); });
    document.addEventListener('DOMContentLoaded', () => { const c = document.getElementById('toastContainer'); if (c) beob.observe(c, { childList:true }); });
  });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(6000);
  const beiOverlay = await page.evaluate(() => (window.__toasts || []).slice());
  const overlayOffen = await page.evaluate(() => ['welcomeBackOverlay','updateNoticeOverlay'].some(id => { const o = document.getElementById(id); return o && getComputedStyle(o).display !== 'none'; }));
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  await page.waitForTimeout(3000);
  const alle = await page.evaluate(() => (window.__toasts || []).slice());
  const nachher = alle.slice(beiOverlay.length);
  return { ctx, page, errs, reports, beiOverlay, nachher, overlayOffen };
}
async function festungImBlick(page){
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(800);
  await oeffneSystemUeberSektoren(page, 'abyss');
  await page.waitForTimeout(1200);
  const marker = await page.evaluate(() => { const n = document.querySelector('[data-map-festung]'); return n ? (n.querySelector('title') || {}).textContent || '' : null; });
  await page.evaluate(() => { const n = document.querySelector('[data-map-festung]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:300, clientY:300 })); });
  await page.waitForTimeout(500);
  const menue = await page.evaluate(() => { const m = document.querySelector('[data-festung-beitrag]'); const l = document.querySelector('[data-festung-letzter]'); return { beitrag: m ? m.textContent.trim() : null, beitragFlag: m ? m.getAttribute('data-festung-beitrag') : null, letzter: l ? l.textContent.trim() : null }; });
  return { marker, menue };
}

(async () => {
  const browser = await starteBrowser();
  // ---- 1) Treffer: 7.400 Schaden, das Feld kennt meinen Beitrag (7.400 von 22.200) und meinen letzten Schlag vor 1 h
  {
    const t = await lauf(browser, { status:200, body:{ ok:true, schaden:7400, kern:22600, kernMax:30000, gefallen:false, anteil:0.25, teilnehmer:1, eigeneVerluste:{ jaeger:3 }, ziel:'kern', rollenFaktor:1, bauteile:{} } },
      { kern:22600, beitraege:{ [ICH]:{ name:'Ich', schaden:7400 }, 'u-x':{ name:'Xena', schaden:14800 } }, schlaege:{ [ICH]: now-3600000 } });
    check('1-vorab: Boot ohne Skriptfehler', t.errs.length === 0, t.errs.slice(0, 2));
    check('1g: das Willkommen-Overlay stand beim Start offen, und der Willkommen-Toast (ohne Gewicht) kam trotzdem', t.overlayOffen && t.beiOverlay.some(x => /Willkommen zurück/.test(x.t)), { overlayOffen: t.overlayOffen, bei: t.beiOverlay.map(x => x.t.slice(0, 40)) });
    check('1a: der Treffer-Toast erscheint NICHT, solange das Overlay den Blick verdeckt', !t.beiOverlay.some(x => /beschossen/.test(x.t)), t.beiOverlay.map(x => x.t.slice(0, 60)));
    check('1b: und erscheint, sobald das Overlay zu ist - mit Schaden und Restkern (die andere Haelfte des Paars)',
      t.nachher.some(x => /Schanze bei Abyss-Tiefen beschossen: 7\.4k Schaden, Kern noch 22\.6k/.test(x.t) && x.overlay === 0), t.nachher.map(x => x.t.slice(0, 80)));
    check('1c: der Bericht ist gepostet (Festung beschossen, 7.400 Schaden)', t.reports.length === 1 && t.reports[0].type === 'festung-angriff' && t.reports[0].schaden === 7400 && !t.reports[0].keinKampf, t.reports[0] && { type: t.reports[0].type, schaden: t.reports[0].schaden });
    const b = await festungImBlick(t.page);
    check('1d: das Festungsmenue nennt meinen Beitrag und rechnet den Hortanteil aus den Beitraegen (7.400 von 22.200 = 33 %)',
      !!b.menue.beitrag && b.menue.beitragFlag === '1' && /7\.4k/.test(b.menue.beitrag) && /33%/.test(b.menue.beitrag) && /2 Beitragende/.test(b.menue.beitrag), b.menue.beitrag);
    check('1e: es nennt meinen letzten Schlag (vor 1 h) und den naechsten (in etwa 5 h) und verweist auf den Bericht',
      !!b.menue.letzter && /vor 1h/.test(b.menue.letzter) && /nächster in/.test(b.menue.letzter) && /4h 5\dm|5h/.test(b.menue.letzter) && /Berichte › Kämpfe/.test(b.menue.letzter), b.menue.letzter);
    check('1f: der Marker in der Systemansicht traegt dieselbe Kurzfassung im Tooltip', !!b.marker && /dein Beitrag 7\.4k \(33% des Horts\)/.test(b.marker) && /nächster Schlag in/.test(b.marker), b.marker);
    await t.ctx.close();
  }
  // ---- 2) Abgewiesen mit 403: der Server sagt "Kein gespeicherter Spielstand", nicht "Abklingzeit"
  {
    const t = await lauf(browser, { status:403, body:{ error:'Kein gespeicherter Spielstand - erst speichern, dann angreifen.' } }, {});
    check('2-vorab: Boot ohne Skriptfehler', t.errs.length === 0, t.errs.slice(0, 2));
    check('2a: der Warn-Toast nennt den Servertext woertlich und NICHT "Abklingzeit"',
      t.nachher.some(x => /Kein gespeicherter Spielstand/.test(x.t)) && !t.nachher.concat(t.beiOverlay).some(x => /Abklingzeit/.test(x.t)), t.nachher.map(x => x.t.slice(0, 120)));
    check('2b: der Bericht ohne Kampf traegt den Servertext als Grund', t.reports.length === 1 && !!t.reports[0].keinKampf && /Kein gespeicherter Spielstand/.test(t.reports[0].grund || ''), t.reports[0] && t.reports[0].grund);
    const b = await festungImBlick(t.page);
    check('2c: ohne eigenen Schlag sagt das Menue das - statt eines leeren Feldes', !!b.menue.beitrag && b.menue.beitragFlag === '0' && /Noch kein Schlag von dir/.test(b.menue.beitrag) && b.menue.letzter === null, b.menue);
    await t.ctx.close();
  }
  await browser.close();
  ende();
})();
