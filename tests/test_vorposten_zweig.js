// Die Spezialisierung des Vorpostens: einmalige Wahl ab der Wahlstufe, danach sichtbar (02.09.2026).
//
// Auftrag Sascha: "sehr, sehr viele Ausbaustufen fuer verschiedene Spezialisierungen"; Entscheidung
// 8 Stufen, ab Stufe 4 eine einmalige Ausrichtung (Werft / Handelsknoten / Festungsring).
//
// GEPRUEFT wird, was der SPIELER sieht und tut:
//   0a-0d Quelltext: Kosten kommen vom Server (keine zweite Tabelle mehr), Wahl-Helfer, Menuezeile.
//   1a-1d Ein Vorposten VOR der Wahl: das Menue sagt, dass die Wahl ansteht; der Ausbau-Knopf
//         nennt sie; ein Klick fragt die Ausrichtung ab und schickt sie an den Server.
//   2a-2b Ein Vorposten NACH der Wahl: Menue nennt Ausrichtung und Kurztext, der Ausbau-Knopf
//         nennt den Namen der naechsten Stufe des GEWAEHLTEN Zweigs.
//   3a    Die Garnisonsgrenze kommt vom OBJEKT, nicht aus der Leiter (ein Festungsring hat 45 %
//         mehr Platz als die Tabelle - vorher htte das Spiel zu wenig angezeigt).
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';
const SYS = 'vega';

// ---- 0) Quelltext -------------------------------------------------------------------------------
check('0a: die Ausbaukosten kommen vom Server - keine zweite Kostentabelle im Spiel',
  /function vorpostenAusbauKosten\(v\)\{ return \(v && v\.naechsteStufe && v\.naechsteStufe\.kosten\) \|\| null; \}/.test(src)
  && !/const VORPOSTEN_AUSBAU_KOSTEN = /.test(src));
check('0b: die Helfer fuer Wahl und Varianten lesen ausschliesslich die Serverantwort',
  /function vorpostenZweigWahlSteht\(v\)\{ return !!\(v && v\.naechsteStufe && v\.naechsteStufe\.zweigWahl\); \}/.test(src)
  && /function vorpostenVarianten\(v\)\{ return \(v && v\.naechsteStufe && v\.naechsteStufe\.varianten\) \|\| \[\]; \}/.test(src));
check('0c: der Ausbau schickt den Zweig mit', /body: JSON\.stringify\(\{ system: sysId, zweig \}\)/.test(src));
check('0d: die Garnisonsgrenze kommt vom Objekt (zweig-korrekt), nicht aus der Leiter',
  /const grenze = v\.garnisonMax \|\| st\.garnisonMax \|\| 0;/.test(src) && !/von \$\{st\.garnisonMax\|\|0\}/.test(src));

const now = Date.now();
// Die Leiter, wie der Server sie schickt (Auszug: die drei Stufen um die Wahl herum).
const STUFEN = [
  { stufe:1, name:'Feldlager',  kernLp:20000,  verteidigung:2500,  garnisonMax:300,  flug:0.06, prod:0.015, scan:1, kosten:null },
  { stufe:2, name:'Stützpunkt', kernLp:90000,  verteidigung:12000, garnisonMax:800,  flug:0.10, prod:0.03,  scan:2, kosten:{ erz:200000, kristalle:130000, deuterium:80000 } },
  { stufe:3, name:'Bastion',    kernLp:400000, verteidigung:60000, garnisonMax:2000, flug:0.15, prod:0.05,  scan:3, kosten:{ erz:600000, kristalle:400000, deuterium:250000 } },
  { stufe:4, name:'Ausbaustufe 4', kernLp:800000, verteidigung:110000, garnisonMax:3200, flug:0.18, prod:0.065, scan:3, kosten:{ erz:1200000, kristalle:800000, deuterium:500000 } }
];
const ZWEIGE = [
  { key:'werft',   name:'Werft',          kurz:'Schnelle Flotten: kurze Flugzeiten, solide Struktur.', namen:{4:'Werftgerüst'},    mult:{} },
  { key:'handel',  name:'Handelsknoten',  kurz:'Ertrag und Fernsicht - dafür die dünnste Hülle.',      namen:{4:'Handelsposten'},  mult:{} },
  { key:'festung', name:'Festungsring',   kurz:'Hält Systeme: dickster Kern, größte Garnison.',        namen:{4:'Wehrring'},       mult:{} }
];
// VOR der Wahl: Stufe 3, naechste Stufe traegt zweigWahl mit drei Varianten.
const vorWahl = {
  id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now - 86400000, stufe:3, name:'Bastion',
  zweig:null, zweigName:null, maxStufe:8,
  kern:{ lp:400000, lpMax:400000 }, verteidigung:60000, garnisonAnzahl:0, garnisonMax:2000, garnison:{},
  schutzBis:0, ausbauAb: now - 1000, nutzen:{ flug:0.15, prod:0.05, scan:3 }, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
  naechsteStufe: { stufe:4, kosten:{ erz:1200000, kristalle:800000, deuterium:500000 }, zweigWahl:true, varianten:[
    { zweig:'werft',   name:'Werftgerüst',   kernLp:720000,  verteidigung:93500,  garnisonMax:3200, nutzen:{ flug:0.27, prod:0.039, scan:3 } },
    { zweig:'handel',  name:'Handelsposten', kernLp:640000,  verteidigung:82500,  garnisonMax:2720, nutzen:{ flug:0.18, prod:0.117, scan:4 } },
    { zweig:'festung', name:'Wehrring',      kernLp:1080000, verteidigung:176000, garnisonMax:4640, nutzen:{ flug:0.126, prod:0.033, scan:3 } }
  ] }
};
// NACH der Wahl: Festungsring auf Stufe 4, Garnisonsgrenze 4640 (Leiter waere 3200).
const nachWahl = Object.assign({}, vorWahl, {
  stufe:4, name:'Wehrring', zweig:'festung', zweigName:'Festungsring',
  kern:{ lp:1080000, lpMax:1080000 }, verteidigung:176000, garnisonMax:4640,
  nutzen:{ flug:0.126, prod:0.033, scan:3 },
  naechsteStufe: { stufe:5, kosten:{ erz:2000000, kristalle:1400000, deuterium:900000 }, zweigWahl:false, varianten:[
    { zweig:'festung', name:'Zitadelle', kernLp:1890000, verteidigung:304000, garnisonMax:6960, nutzen:{ flug:0.147, prod:0.04, scan:4 } }
  ] }
});
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e6, erz:9e6, kristalle:9e6, deuterium:9e6, antimaterie:9e5, forschungspunkte:3e4 },
    buildings:{ solar:40, mine:40, labor:20, lager:400, kryolager:900, werft:20 }, research:{},   // Lagerdeckel > Ausbaukosten (1,2 Mio) - sonst sperrt der Knopf zu Recht
    fleet:{ jaeger:200, cruisers:60, colonyShips:2, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5e5, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}
async function lauf(browser, doc){
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand() };
  const gesendet = [];
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{}, wrackKonvois:[] });
    if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000, ausbauMs:43200000,
      garnisonFaktor:0.5, stufen:STUFEN, zweige:ZWEIGE, zweigAb:4, maxStufe:8, liste:[doc], eigene:1 });
    if (p === 'vorposten/ausbauen'){ let b={}; try { b = JSON.parse(req.postData()||'{}'); } catch(e){} gesendet.push(b); return j({ ok:true, vorposten: nachWahl }); }
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
    window.__prompts = []; window.prompt = (text, def) => { window.__prompts.push(text); return window.__promptAntwort === undefined ? def : window.__promptAntwort; };
    window.__confirms = []; window.confirm = (text) => { window.__confirms.push(text); return window.__confirmAntwort !== false; };
  });
  await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; }));
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(800);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
  await page.waitForTimeout(500);
  const menue = await page.evaluate(() => { const m = document.querySelector('.kmenu');
    return m ? { offen: m.getBoundingClientRect().height > 0, text: m.textContent.replace(/\s+/g,' '),
      zweigFlag: (m.querySelector('[data-vp-zweig]') || {}).getAttribute ? m.querySelector('[data-vp-zweig]').getAttribute('data-vp-zweig') : null,
      knoepfe: [...m.querySelectorAll('button')].map(b => ({ label: b.textContent.trim(), disabled: b.disabled })) } : { offen:false };
  });
  return { ctx, page, errs, menue, gesendet };
}
(async () => {
  const browser = await starteBrowser();

  // ---- 1) VOR der Wahl ---------------------------------------------------------------------------
  const a = await lauf(browser, vorWahl);
  check('1-vorab: Boot ohne Skriptfehler, das Vorposten-Menue oeffnet sich', a.errs.length === 0 && a.menue.offen === true, { errs: a.errs.slice(0,2), offen: a.menue.offen });
  check('1a: das Menue sagt, dass die Ausrichtung beim naechsten Ausbau einmalig gewaehlt wird',
    a.menue.zweigFlag === '0' && /Noch ohne Ausrichtung/.test(a.menue.text) && /einmalig/.test(a.menue.text), { flag: a.menue.zweigFlag, text: a.menue.text.slice(0, 200) });
  check('1b: der Ausbau-Knopf nennt die anstehende Wahl', a.menue.knoepfe.some(k => /Ausrichtung wählen/.test(k.label) && !k.disabled), a.menue.knoepfe.map(k => k.label));
  check('1c: das Menue nennt die Stufe als "X von 8" (die Leiter ist ablesbar)', /Stufe 3 von 8/.test(a.menue.text), a.menue.text.slice(0, 120));
  await a.page.evaluate(() => { window.__promptAntwort = '3'; });   // 3 = Festungsring
  await a.page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button')].find(x => /Ausrichtung wählen/.test(x.textContent)); if (b) b.click(); });
  await a.page.waitForTimeout(1200);
  const gefragt = await a.page.evaluate(() => (window.__prompts || []).slice());
  check('1d: der Klick fragt die Ausrichtung ab und nennt alle drei mit ihren Werten',
    gefragt.length === 1 && /Werft/.test(gefragt[0]) && /Handelsknoten/.test(gefragt[0]) && /Festungsring/.test(gefragt[0]) && /für immer/.test(gefragt[0]),
    gefragt[0] ? gefragt[0].slice(0, 160) : null);
  check('1e: und schickt GENAU den gewaehlten Zweig an den Server', a.gesendet.length === 1 && a.gesendet[0].zweig === 'festung' && a.gesendet[0].system === SYS, a.gesendet);
  await a.ctx.close();

  // ---- 2) NACH der Wahl --------------------------------------------------------------------------
  const b = await lauf(browser, nachWahl);
  check('2a: das Menue nennt die Ausrichtung mit ihrem Kurztext',
    b.menue.zweigFlag === '1' && /Ausrichtung: Festungsring/.test(b.menue.text) && /Hält Systeme/.test(b.menue.text), { flag: b.menue.zweigFlag, text: b.menue.text.slice(0, 220) });
  check('2b: der Ausbau-Knopf nennt den Namen der naechsten Stufe DIESES Zweigs, ohne erneute Wahl',
    b.menue.knoepfe.some(k => /Zitadelle/.test(k.label)) && !b.menue.knoepfe.some(k => /Ausrichtung wählen/.test(k.label)), b.menue.knoepfe.map(k => k.label));
  check('3a: die Garnisonsgrenze kommt vom Objekt (4.640 des Festungsrings, nicht 3.200 der Leiter)',
    /von 4640/.test(b.menue.text) || /von 4\.640/.test(b.menue.text), (b.menue.text.match(/Garnison [^·]*/) || [])[0]);
  check('3b: keine Skriptfehler', b.errs.length === 0, b.errs.slice(0,2));
  await b.ctx.close();

  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });
// Gegenprobe gemessen 02.09.2026 (KEPLER_SPIELDATEI = v8.636.0 ohne diese Aenderung): rot 0a 0b 0c 0d 1a 1b 1c 1d 1e 2a 2b 3a (12),
// gruen bleiben 1-vorab und 3b (2) - das Spiel bootet dort natuerlich fehlerfrei und zeichnet ein Menue, es kennt
// nur weder Zweige noch die Leiter. Prueflisten identisch (14).
