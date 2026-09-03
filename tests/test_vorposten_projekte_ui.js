// Stationsprojekte im Spiel: Fenster, Freischaltung, Bauzeit, Sprungtor (03.09.2026, Etappe 4).
//
// Auftrag Sascha: "dass man von dort aus Projekte starten kann, dass man von dort aus vielleicht
// auch eine Art Ueberraumtor bauen kann. Also auch noch mehr Projekte quasi macht."
//
// Der Katalog kommt vom SERVER (`projektDefs`), die Wirkung fuehrt der Server im Dokument. Das
// Spiel haelt deshalb KEINE eigene Projekttabelle - gemessen wird hier, dass es wirklich die
// Serverangaben zeigt und die richtige Anfrage stellt.
//
// GEPRUEFT: Quelltext (0a-0d), die Icon-Paritaet zum Backend (0e) und ein Browser-Durchlauf:
//   1a-1c das Kartenmenue nennt den Stand und oeffnet das Fenster
//   2a-2d das Fenster zeigt Laufendes, Fertiges und Moegliches - mit dem GRUND, warum etwas fehlt
//   3a    Starten schickt genau das gewaehlte Vorhaben
//   4a    das Sprungtor wird als Grenze beschrieben, nicht als Prozentwert auf denselben Kanal
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';
const SYS = 'vega';

check('0a: das Spiel haelt KEINE eigene Projekttabelle - der Katalog kommt vom Server',
  /function vpProjektDef\(key\)\{ return \(vorpostenCache\.projektDefs \|\| \[\]\)/.test(src)
  && !/const VP_PROJEKT_DEFS = \[/.test(src));
check('0b: der Start geht an den Projekt-Endpunkt', /'\/vorposten\/projekt\/starten'/.test(src));
/* Der Flugzeit-Deckel war bis Etappe 4 eine harte 0,5 im Spiel - eine Kopie-Familie mit dem
   Backend, und ausgerechnet die Zahl, die das Sprungtor verschiebt. Steht sie wieder hart in der
   Rechnung, taete ein fertiges Tor nichts. */
check('0c: der Flugzeit-Deckel kommt vom Server, nicht als harte Zahl aus der Rechnung',
  /const deckel = \(v\.nutzen && typeof v\.nutzen\.flugDeckel === 'number'\) \? v\.nutzen\.flugDeckel : VORPOSTEN_FLUG_DECKEL;/.test(src)
  && /return Math\.max\(1 - deckel, 1 - f\);/.test(src));
/* Die REGEL, nicht das Layout (Regel 3): Im Rumpf von vorpostenProjektStarten muss der
   Abweis-Zweig VOR der Abbuchung stehen. Ein Kommentar dazwischen darf die Pruefung nicht
   umwerfen - der erste Entwurf haftete am Zeilenbild und fiel genau daran. */
{
  const a = src.indexOf('async function vorpostenProjektStarten(');
  const rumpf = a < 0 ? '' : src.slice(a, src.indexOf('\n  }', a));
  const iAbweis = rumpf.indexOf('Der Server hat den Baubeginn abgelehnt');
  const iZahl = rumpf.indexOf('pay(d.kosten)');
  check('0d: bezahlt wird NACH der Zusage des Servers (sonst waeren die Rohstoffe bei Ablehnung weg)',
    a >= 0 && iAbweis > 0 && iZahl > 0 && iZahl > iAbweis, { abweis: iAbweis, zahlung: iZahl });
}

/* 0e: Die Icons der Server-Tabellen laufen an check-icons.js VORBEI - das Skript liest nur die
   Spieldatei. Ein Projekt oder Modul mit einem Icon ausserhalb der 72er-Whitelist zeichnete im
   Spiel ein leeres Kaestchen, und kein Prueflauf saehe es. Hier wird die Whitelist aus der
   Spieldatei gegen BEIDE Server-Tabellen gehalten. Ohne Nachbar-Repo wird uebersprungen. */
{
  const bePfad = path.join(__dirname, '..', '..', 'kolonie-kepler7-backend', 'server.js');
  if (!fs.existsSync(bePfad)) {
    console.log('     INFO - 0e uebersprungen: kein Nachbar-Repo kolonie-kepler7-backend');
  } else {
    const be = fs.readFileSync(bePfad, 'utf8');
    const erlaubt = new Set([...src.matchAll(/\.ti-([a-z0-9-]+):before/g)].map(m => m[1]));
    const schnitt = (von, bis) => { const a = be.indexOf(von); if (a < 0) return ''; const b = be.indexOf(bis, a); return b < 0 ? '' : be.slice(a, b); };
    const tabellen = schnitt('const VP_PROJEKT_DEFS = [', '\n];') + schnitt('const VP_MODUL_DEFS = [', '\n];');
    const benutzt = [...new Set([...tabellen.matchAll(/icon:\s*'ti-([a-z0-9-]+)'/g)].map(m => m[1]))];
    check('0e-vorab: die Icons der Server-Tabellen wurden gelesen (sonst misst 0e nichts)',
      erlaubt.size > 20 && benutzt.length >= 8, { whitelist: erlaubt.size, gefunden: benutzt.length });
    const fehlend = benutzt.filter(i => !erlaubt.has(i));
    check('0e: jedes Icon aus VP_PROJEKT_DEFS und VP_MODUL_DEFS steht in der Icon-Whitelist des Spiels',
      fehlend.length === 0, fehlend);
  }
}

const now = Date.now();
const PROJEKT_DEFS = [
  { key:'dockring', name:'Dockring', icon:'ti-rocket', zweig:'festung', stufeAb:5, dauerMs:28800000,
    wirkung:{ garnison:0.25 }, desc:'Ein zweiter Liegeplatzring.', kosten:{ erz:9000, kristalle:7000 } },
  { key:'handelskammer', name:'Handelskammer', icon:'ti-building-bank', zweig:'handel', stufeAb:5, dauerMs:28800000,
    wirkung:{ prod:0.35 }, desc:'Kontore am Ring.', kosten:{ erz:9000, kristalle:7000 } },
  { key:'tiefenhorchen', name:'Tiefenhorchposten', icon:'ti-antenna-bars-5', zweig:null, stufeAb:6, dauerMs:43200000,
    wirkung:{ scan:1 }, desc:'Eine ausgefahrene Lauschanlage.', kosten:{ erz:16000 } },
  { key:'sprungtor', name:'Sprungtor', icon:'ti-atom-2', zweig:null, stufeAb:7, dauerMs:86400000,
    wirkung:{ flug:0.20, flugDeckel:0.75 }, desc:'Ein durchgehend offenes Tor im Orbit.', kosten:{ erz:60000 } }
];
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s, garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, kosten: s===1?null:{ erz:1000 } }));
// Stufe 5, Zweig Festung: Dockring geht, Tiefenhorchposten (6) und Sprungtor (7) noch nicht,
// Handelskammer nie. Ein fertiges Bollwerk steht schon da, damit "Fertig" nicht leer ist.
const vp = { id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now-86400000, stufe:5, name:'Zitadelle',
  zweig:'festung', zweigName:'Festungsring', maxStufe:8, kern:{ lp:900000, lpMax:1000000 }, verteidigung:250000,
  garnisonAnzahl:0, garnisonMax:4800, garnison:{}, schutzBis:0, ausbauAb: now-1000,
  nutzen:{ flug:0.15, prod:0.04, scan:4, flugDeckel:0.5 }, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
  slots:2, module:[], modulBoni:null,
  projekte:['tiefenhorchen'], projektBoni:null, projektLaeuft:null, projektMoeglich:['dockring'],
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
      garnisonFaktor:0.5, stufen:STUFEN,
      zweige:[{ key:'festung', name:'Festungsring', kurz:'Hält Systeme.', namen:{5:'Zitadelle'}, mult:{} },
              { key:'handel', name:'Handelsknoten', kurz:'Verdient.', namen:{}, mult:{} }],
      zweigAb:4, maxStufe:8, modulDefs:[], modulSeltenheiten:{}, modulBaubar:['gewoehnlich'],
      modulAusbauKosten:250, modulBauAbklingMs:21600000, modulBestand:{}, modulBauAb:0,
      projektDefs:PROJEKT_DEFS, projekteAktiv:true, flugDeckel:0.5,
      liste:[vp], eigene:1 });
    if (p === 'vorposten/projekt/starten'){ let b={}; try { b = JSON.parse(req.postData()||'{}'); } catch(e){} gesendet.push({ weg:p, body:b });
      return j({ ok:true, projekt: b.projekt, fertigAb: now+28800000, kosten:{ erz:9000 }, vorposten: vp }); }
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
  check('1a: das Menue nennt die fertigen Projekte beim Namen', /Projekte: Tiefenhorchposten/.test(menueText), (menueText.match(/Projekte:[^·]*/) || [])[0]);
  check('1b: und bietet den Eintrag an, mit der Zahl der fertigen', menueKnoepfe.some(k => /Projekte \(1 fertig\)/.test(k.label) && !k.disabled), menueKnoepfe.map(k => k.label));
  await page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button')].find(x => /^Projekte/.test(x.textContent.trim())); if (b) b.click(); });
  await page.waitForTimeout(600);
  const fenster = await page.evaluate(() => { const o = document.getElementById('vorpostenProjektOverlay');
    return o ? { offen: o.classList.contains('open'), text: o.textContent.replace(/\s+/g,' '),
      start: [...o.querySelectorAll('[data-vp-projekt-start]')].map(b => b.getAttribute('data-vp-projekt-start')) } : { offen:false, text:'', start:[] };
  });
  check('1c: das Fenster oeffnet sich', fenster.offen === true, fenster.offen);
  check('2a: es zeigt, dass gerade nichts gebaut wird, und das fertige Vorhaben mit Wirkung',
    /nichts gebaut/.test(fenster.text) && /Tiefenhorchposten/.test(fenster.text) && /\+1 Aufklärungsstufe/.test(fenster.text),
    (fenster.text.match(/Fertig.{0,90}/) || [])[0]);
  /* Der Kern der Anzeige: Auch was NICHT geht, steht da - mit dem Grund. Sonst verschwiege das
     Fenster, dass es das Sprungtor ueberhaupt gibt (Lehre vom Bau-Knopf). */
  check('2b: was noch nicht geht, steht mit dem GRUND da (Stufe bzw. Ausrichtung)',
    /Sprungtor/.test(fenster.text) && /Braucht Stufe 7/.test(fenster.text)
    && /Handelskammer/.test(fenster.text) && /Baut nur Handelsknoten/.test(fenster.text),
    (fenster.text.match(/Sprungtor.{0,80}/) || [])[0]);
  check('2c: nur das wirklich moegliche Vorhaben hat einen Start-Knopf',
    (fenster.start || []).join() === 'dockring', fenster.start);
  check('2d: die Regel steht dabei - eines gleichzeitig, jedes einmal, kein Abbruch',
    /Ein Vorhaben je Station gleichzeitig/.test(fenster.text) && /Abbrechen geht nicht/.test(fenster.text));
  /* Das Sprungtor ist eine GRENZE, kein weiterer Anteil auf denselben Kanal - genau deshalb gibt
     es das Projekt. Als "+75 % Flugzeit" waere es eine Falschangabe. */
  check('4a: das Sprungtor wird als Grenze beschrieben, nicht als Prozentwert auf den Flug-Kanal',
    /Flugzeit-Grenze 75 % statt 50 %/.test(fenster.text) && !/\+75 % kürzere/.test(fenster.text),
    (fenster.text.match(/Flugzeit-Grenze[^·]*/) || [])[0]);
  await page.evaluate(() => { const b = document.querySelector('[data-vp-projekt-start="dockring"]'); if (b) b.click(); });
  await page.waitForTimeout(700);
  check('3a: Starten schickt GENAU das gewaehlte Vorhaben und das System',
    gesendet.some(g => g.weg === 'vorposten/projekt/starten' && g.body.projekt === 'dockring' && g.body.system === SYS), gesendet);
  check('5: keine Skriptfehler', errs.length === 0, errs.slice(0,3));
  await ctx.close(); await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });
