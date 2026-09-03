// Stationsmodule im Spiel: Steckplätze sehen, einbauen, ausbauen, bauen (02.09.2026, Etappe 3).
//
// Auftrag Sascha: "man soll Module finden koennen, die selten sind - die sind natuerlich am
// besten, random natuerlich. Und man soll auch Module bauen koennen, die sind aber weniger gut.
// Die kann man ausbauen, kostet aber eine Kleinigkeit."
//
// Der Bestand und die eingebauten Module liegen beim SERVER (ein Modul hebt die Verteidigung eines
// PvP-Ziels). Das Spiel haelt deshalb KEINE eigene Moduldefinition - gemessen wird hier, dass es
// wirklich die Serverangaben zeigt und die richtigen Anfragen stellt.
//
// GEPRUEFT: Quelltext (0a-0c) und ein Browser-Durchlauf am eigenen Vorposten:
//   1a-1c das Kartenmenue nennt die Steckplaetze und oeffnet das Fenster
//   2a-2c das Fenster zeigt belegten Platz, freien Platz und den Bestand mit Wirkung in Worten
//   3a-3b Einbauen schickt genau das gewaehlte Modul; Ausbauen nennt die Kosten am Knopf
//   4a    die Schmiede sagt, bis zu welcher Stufe sie baut, und dass Besseres nur im Kampf faellt
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';
const SYS = 'vega';

check('0a: das Spiel haelt KEINE eigene Modultabelle - Katalog und Bestand kommen vom Server',
  /function vpModulDef\(key\)\{ return \(vorpostenCache\.modulDefs \|\| \[\]\)/.test(src)
  && /function vpModulBestandListe\(\)\{[\s\S]{0,120}vorpostenCache\.modulBestand/.test(src)
  && !/const VP_MODUL_DEFS = \[/.test(src));
check('0b: die drei Wege gehen an die drei Endpunkte',
  /'\/vorposten\/modul\/einbauen'/.test(src) && /'\/vorposten\/modul\/ausbauen'/.test(src) && /'\/vorposten\/modul\/bauen'/.test(src));
check('0c: der Ausbau gleicht Kredite und Spielstand-Version an (sonst Versionskonflikt)',
  /if \(typeof daten\.newCredits === 'number'\) state\.credits = daten\.newCredits;/.test(src)
  && /if \(typeof daten\.saveVersion === 'number' && daten\.saveVersion > gameSaveVersion\) gameSaveVersion = daten\.saveVersion;/.test(src));

const now = Date.now();
const MODUL_DEFS = [
  { key:'kernpanzer', name:'Kernpanzerung', icon:'ti-shield', wirkung:'kern', basis:0.08, desc:'Verstärkt den Kern der Station.' },
  { key:'geschuetz', name:'Geschützbank', icon:'ti-sword', wirkung:'verteidigung', basis:0.10, desc:'Zusätzliche Geschütze.' },
  { key:'horchposten', name:'Horchposten', icon:'ti-antenna-bars-5', wirkung:'scan', basis:1, desc:'Lauscht weiter ins System.' }
];
const SELTENHEITEN = { gewoehnlich:{ label:'Gewöhnlich', mult:1.0 }, ungewoehnlich:{ label:'Ungewöhnlich', mult:1.4 }, selten:{ label:'Selten', mult:2.0 }, episch:{ label:'Episch', mult:2.8 }, legendaer:{ label:'Legendär', mult:4.0 } };
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s, garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, kosten: s===1?null:{ erz:1000 } }));
const vp = { id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now-86400000, stufe:5, name:'Zitadelle',
  zweig:'festung', zweigName:'Festungsring', maxStufe:8, kern:{ lp:900000, lpMax:1000000 }, verteidigung:250000,
  garnisonAnzahl:0, garnisonMax:4800, garnison:{}, schutzBis:0, ausbauAb: now-1000,
  nutzen:{ flug:0.15, prod:0.04, scan:4 }, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
  slots:2, module:['geschuetz:selten'], modulBoni:{ kern:0, verteidigung:0.2, garnison:0, flug:0, prod:0, scan:0 },
  naechsteStufe:null };
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5000, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}
(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const gesendet = [];
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand() };
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{}, wrackKonvois:[] });
    if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000, ausbauMs:43200000,
      garnisonFaktor:0.5, stufen:STUFEN, zweige:[{ key:'festung', name:'Festungsring', kurz:'Hält Systeme.', namen:{5:'Zitadelle'}, mult:{} }],
      zweigAb:4, maxStufe:8, modulDefs:MODUL_DEFS, modulSeltenheiten:SELTENHEITEN, modulBaubar:['gewoehnlich','ungewoehnlich'],
      modulAusbauKosten:250, modulBauAbklingMs:21600000, modulBestand:{ 'kernpanzer:episch':1, 'horchposten:gewoehnlich':2 }, modulBauAb:0,
      liste:[vp], eigene:1 });
    if (p.startsWith('vorposten/modul/')){ let b={}; try { b = JSON.parse(req.postData()||'{}'); } catch(e){} gesendet.push({ weg: p, body: b });
      return j({ ok:true, modul: b.modul || 'kernpanzer:episch', kosten:250, newCredits:4750, saveVersion:2, bestand:{}, vorposten: vp }); }
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
    if (p === 'players-map') return j({ players:[] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
    return j({ ok:true });
  });
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); window.confirm = () => true; });
  await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; }));
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(800);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
  await page.waitForTimeout(500);
  const menue = await page.evaluate(() => { const m = document.querySelector('.kmenu');
    return m ? { text: m.textContent.replace(/\s+/g,' '), knoepfe: [...m.querySelectorAll('button')].map(b => ({ label: b.textContent.trim(), disabled: b.disabled })) } : null; });
  check('1-vorab: Boot ohne Skriptfehler, das Vorposten-Menue ist offen', errs.length === 0 && !!menue, { errs: errs.slice(0,2) });
  const menueText = (menue && menue.text) || '', menueKnoepfe = (menue && menue.knoepfe) || [];
  check('1a: das Menue nennt die Steckplaetze mit Belegung und dem Namen des eingebauten Moduls',
    /Steckplätze: 1 von 2/.test(menueText) && /Selten Geschützbank/.test(menueText), (menueText.match(/Steckplätze[^·]*/) || [])[0]);
  check('1b: und bietet den Eintrag zum Bestücken an (1/2)', menueKnoepfe.some(k => /Steckplätze \(1\/2\)/.test(k.label) && !k.disabled), menueKnoepfe.map(k => k.label));
  await page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button')].find(x => /Steckplätze/.test(x.textContent)); if (b) b.click(); });
  await page.waitForTimeout(600);
  const fenster = await page.evaluate(() => { const o = document.getElementById('vorpostenModulOverlay');
    return o ? { offen: o.classList.contains('open'), text: o.textContent.replace(/\s+/g,' '),
      rein: [...o.querySelectorAll('[data-vp-modul-rein]')].map(b => b.getAttribute('data-vp-modul-rein')),
      raus: [...o.querySelectorAll('[data-vp-modul-raus]')].map(b => ({ platz: b.getAttribute('data-vp-modul-raus'), label: b.textContent.trim() })),
      bau: [...o.querySelectorAll('[data-vp-modul-bau]')].map(b => b.getAttribute('data-vp-modul-bau')) } : { offen:false };
  });
  check('1c: das Fenster oeffnet sich', fenster.offen === true, fenster.offen);
  check('2a: es zeigt den belegten Platz mit Wirkung in Worten (+20% Verteidigung bei „selten")',
    /Selten Geschützbank/.test(fenster.text || '') && /\+20% Verteidigung/.test(fenster.text || ''), ((fenster.text || '').match(/Selten Geschützbank[^·]*/) || [])[0]);
  check('2b: den freien Platz und den Bestand mit Anzahl', /Freier Steckplatz/.test(fenster.text || '') && /Episch Kernpanzerung/.test(fenster.text || '') && /Gewöhnlich Horchposten/.test(fenster.text || '') && /2x/.test(fenster.text || ''), fenster.rein);
  check('2c: der Horchposten wird als STUFE beschrieben, nicht als Prozentwert', /\+1 Aufklärungsstufe/.test(fenster.text || '') && !/\+100% Aufklärung/.test(fenster.text || ''));
  check('3a-vorab: der Ausbau-Knopf nennt die Kosten', (fenster.raus || []).length === 1 && /250/.test((fenster.raus[0] || {}).label || ''), fenster.raus);
  await page.evaluate(() => { const b = document.querySelector('[data-vp-modul-rein="kernpanzer:episch"]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  check('3a: Einbauen schickt GENAU das gewaehlte Modul an den Einbau-Endpunkt',
    gesendet.some(g => g.weg === 'vorposten/modul/einbauen' && g.body.modul === 'kernpanzer:episch' && g.body.system === SYS), gesendet);
  await page.evaluate(() => { const b = document.querySelector('[data-vp-modul-raus="0"]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  check('3b: Ausbauen schickt den Steckplatz, nicht den Modulnamen',
    gesendet.some(g => g.weg === 'vorposten/modul/ausbauen' && g.body.platz === 0 && g.body.system === SYS), gesendet);
  check('4a: die Schmiede nennt die Baustufe und dass Besseres nur im Kampf faellt',
    /Gebaut wird bis Ungewöhnlich/.test(fenster.text || '') && /bessere Stücke findet man nur im Kampf/i.test(fenster.text || ''), ((fenster.text || '').match(/Gebaut wird bis[^.]*\./) || [])[0]);
  check('4b: jedes Modul des Katalogs hat einen Schmiede-Knopf', (fenster.bau || []).join() === 'kernpanzer,geschuetz,horchposten', fenster.bau);
  await page.evaluate(() => { const b = document.querySelector('[data-vp-modul-bau="horchposten"]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  check('4c: der Bau schickt Schluessel UND die baubare Seltenheit (nie eine bessere)',
    gesendet.some(g => g.weg === 'vorposten/modul/bauen' && g.body.modul === 'horchposten' && g.body.seltenheit === 'ungewoehnlich'), gesendet);
  check('5: keine Skriptfehler', errs.length === 0, errs.slice(0,3));
  await ctx.close(); await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });
// Gegenprobe gemessen 02.09.2026 (KEPLER_SPIELDATEI = v8.642.0 ohne diese Aenderung): rot 0a 0b 0c 1a 1b 1c 2a 2b
// 2c 3a-vorab 3a 3b 4a 4b 4c (15), gruen bleiben 1-vorab und 5 (2) - dort bootet das Spiel fehlerfrei, es kennt
// nur keine Stationsmodule. Prueflisten identisch (17).
//
// TEUER GELERNT: Der erste Entwurf BRACH am alten Stand nach 1c ab (`fenster.raus[0].label` auf einem leeren
// Array). Die Prueflisten waren dadurch verschieden, und die Gegenprobe belegte nichts fuer die zehn Pruefungen
// dahinter. Ein Test, der am kaputten Stand abstuerzt statt zu fallen, misst dort gar nichts.
