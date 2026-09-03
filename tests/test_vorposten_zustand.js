// Die Station zeigt, was in ihr steckt (Etappe V1, 03.09.2026).
//
// Auftrag Sascha: alle Punkte der Vorposten-Auswahl umsetzen. Der optische Teil davon ist dieser:
// Bis hierher trug die Silhouette NUR Stufe und Zweig. Module, Projekte, Kernschaden, laufender
// Ausbau, laufender Abbau, Garnison und Anflug waren unsichtbar - ein Sprungtor kostet 6 Mio. Erz,
// 40 Singularitaetskerne und 24 Stunden Bauzeit, und die Station sah danach aus wie vorher.
//
// GEMESSEN WIRD DIE REGEL, nicht die Form: „jedes eingebaute Modul erzeugt genau ein eigenes Teil",
// nicht „das Geschuetz ist ein Polygon mit drei Punkten". Sonst blockiert der Test den naechsten
// Neuentwurf, den er absichern soll (dieselbe Lehre wie bei 1a/1b in test_vorposten_station.js).
//
// Alle Daten dafuer liegen laengst beim Client: vorpostenFuerClient schickt module, projekte,
// kern, abbauAb und garnisonAnzahl an JEDEN, projektLaeuft und anflug nur an den Besitzer.
//
// Gegenprobe: siehe Fuss der Datei.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const ICH = 'u-ich';
const SYS = 'vega';
const now = Date.now();

const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp: 20000*s, verteidigung: 2500*s, garnisonMax: 300*s, flug:0.06, prod:0.015, scan:1, kosten: s===1?null:{ erz:1000 } }));
const ZWEIGE = [
  { key:'werft',   name:'Werft',         kurz:'Schnelle Flotten.', namen:{4:'Werftgerüst',5:'Dockring',6:'Schiffsschmiede',7:'Flottenwerft',8:'Sternenwerft'}, mult:{} },
  { key:'handel',  name:'Handelsknoten', kurz:'Ertrag und Sicht.', namen:{4:'Handelsposten',5:'Umschlagring',6:'Frachtkreuz',7:'Handelsknoten',8:'Sternenmarkt'}, mult:{} },
  { key:'festung', name:'Festungsring',  kurz:'Hält Systeme.',     namen:{4:'Wehrring',5:'Zitadelle',6:'Sperrfeuerring',7:'Kriegsbastion',8:'Sternenfestung'}, mult:{} }
];
// Die Modul- und Projekttabellen kommen im echten Betrieb vom Server (vorpostenCache.modulDefs /
// modulSeltenheiten / projektDefs). Hier stehen sie in derselben FORM, mit denselben Schluesseln.
const MODUL_DEFS = [
  { key:'kernpanzer',    name:'Kernpanzerung',     icon:'ti-shield',             wirkung:'kern',         basis:0.08, desc:'x' },
  { key:'geschuetz',     name:'Geschützbank',      icon:'ti-sword',              wirkung:'verteidigung', basis:0.10, desc:'x' },
  { key:'hangar',        name:'Hangarerweiterung', icon:'ti-rocket',             wirkung:'garnison',     basis:0.12, desc:'x' },
  { key:'sprungrechner', name:'Sprungrechner',     icon:'ti-atom-2',             wirkung:'flug',         basis:0.15, desc:'x' },
  { key:'raffinerie',    name:'Umlaufraffinerie',  icon:'ti-building-factory-2', wirkung:'prod',         basis:0.15, desc:'x' },
  { key:'horchposten',   name:'Horchposten',       icon:'ti-antenna-bars-5',     wirkung:'scan',         basis:1,    desc:'x' }
];
const MODUL_SELTENHEIT = {
  gewoehnlich:{ label:'Gewöhnlich', mult:1.0 }, ungewoehnlich:{ label:'Ungewöhnlich', mult:1.4 },
  selten:{ label:'Selten', mult:2.0 }, episch:{ label:'Episch', mult:2.8 }, legendaer:{ label:'Legendär', mult:4.0 }
};
const PROJEKT_DEFS = [
  { key:'dockring',      name:'Dockring',          icon:'ti-rocket',           zweig:'werft',   stufeAb:5, dauerMs:1, wirkung:{ garnison:0.25 }, desc:'x', kosten:{ erz:1 } },
  { key:'handelskammer', name:'Handelskammer',     icon:'ti-building-bank',    zweig:'handel',  stufeAb:5, dauerMs:1, wirkung:{ prod:0.35 },     desc:'x', kosten:{ erz:1 } },
  { key:'bollwerk',      name:'Bollwerk',          icon:'ti-building-castle',  zweig:'festung', stufeAb:5, dauerMs:1, wirkung:{ kern:0.2 },      desc:'x', kosten:{ erz:1 } },
  { key:'tiefenhorchen', name:'Tiefenhorchposten', icon:'ti-antenna-bars-5',   zweig:null,      stufeAb:6, dauerMs:1, wirkung:{ scan:1 },        desc:'x', kosten:{ erz:1 } },
  { key:'sprungtor',     name:'Sprungtor',         icon:'ti-atom-2',           zweig:null,      stufeAb:7, dauerMs:1, wirkung:{ flug:0.2 },      desc:'x', kosten:{ erz:1 } }
];

function doc(over){
  return Object.assign({
    id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now - 86400000,
    stufe:8, name:'Sternenwerft', zweig:'werft', zweigName:'Werft', maxStufe:8,
    kern:{ lp: 100000, lpMax: 100000 }, verteidigung: 20000,
    garnisonAnzahl: 0, garnisonMax: 3000, garnison:{},
    slots:5, module:[], modulBoni:null, projekte:[], projektBoni:null,
    abbauAb:null, schutzBis:0, ausbauAb: now - 1000,
    nutzen:{ flug:0.2, prod:0.05, scan:3, flugDeckel:0.5 }, eigener:true,
    anflug:[], meinLetzterSchlag:0, letzterKampf:null, kampfverlauf:[], naechsteStufe:null
  }, over || {});
}
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5e5, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}
async function lauf(browser, vp){
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
    if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000, ausbauMs:43200000,
      garnisonFaktor:0.5, stufen:STUFEN, zweige:ZWEIGE, zweigAb:4, maxStufe:8, liste:[vp], eigene:1,
      modulDefs:MODUL_DEFS, modulSeltenheiten:MODUL_SELTENHEIT, modulBestand:{}, modulSlotsMax:5,
      projektDefs:PROJEKT_DEFS, projekteAktiv:true, flugDeckel:0.5, abbauMs:86400000, abbauAktiv:true });
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
    if (p === 'players-map') return j({ players:[] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
    return j({ ok:true });
  });
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; }));
  /* D3: Die Uebersicht steht auf dem Basis-Tab und wird deshalb VOR dem Wechsel zur Karte
     gelesen - danach baut das Spiel sie bewusst nicht mehr jede Sekunde neu (Performance). */
  const liste = await page.evaluate(() => {
    const l = document.getElementById('fpVorpostenList');
    const b = l && l.querySelector('[data-fp-vorposten]');
    return { da: !!b, text: b ? b.textContent.replace(/\s+/g, ' ').trim() : '' };
  });
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(800);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(1200);
  /* GEMESSEN WIRD AM DOM, nicht an der Zeichenkette: querySelectorAll zaehlt echte Knoten, ein
     Zaehlen von "data-vp-modul" im HTML-Text zaehlte auch ein Vorkommen im Kommentar mit. */
  const mess = await page.evaluate(() => {
    const n = document.querySelector('[data-map-vorposten]');
    if (!n) return { da:false };
    const teile = (sel) => Array.from(n.querySelectorAll(sel));
    const lage = (el) => { const b = el.getBoundingClientRect(); return Math.round(b.left) + 'x' + Math.round(b.top); };
    return {
      da:true,
      module: teile('[data-vp-modul]').map(e => ({ key: e.getAttribute('data-vp-modul'), seltenheit: e.getAttribute('data-vp-modul-seltenheit'), lage: lage(e), html: e.innerHTML })),
      projekte: teile('[data-vp-projekt]').map(e => ({ key: e.getAttribute('data-vp-projekt'), html: e.innerHTML })),
      schaden: teile('[data-vp-schaden]').map(e => e.getAttribute('data-vp-schaden')),
      schadenTeile: teile('[data-vp-schaden]').reduce((n, e) => n + e.children.length, 0),
      bau: teile('[data-vp-bau]').map(e => e.getAttribute('data-vp-bau')),
      abbau: teile('[data-vp-abbau]').length,
      garnison: teile('[data-vp-garnison]').map(e => ({ voll: e.getAttribute('data-vp-garnison'),
        gefuellt: e.querySelectorAll('polygon[fill-opacity]').length, leer: e.querySelectorAll('polygon[stroke-width]').length })),
      alarm: teile('[data-vp-alarm]').map(e => (e.querySelector('animate') || {}).getAttribute ? e.querySelector('animate').getAttribute('dur') : null)
    };
  });
  await page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(500);
  const menue = await page.evaluate(() => {
    // Das Kartenmenue hat KEINE id - es ist ein <div class="kmenu"> (im Quelltext nachgelesen).
    const m = document.querySelector('.kmenu');
    return { da: !!m, verlauf: m ? m.querySelectorAll('[data-vp-verlauf]').length : 0,
      text: m ? m.textContent.replace(/\s+/g, ' ').trim() : '' };
  });
  return { ctx, page, errs, mess, liste, menue };
}
(async () => {
  const browser = await starteBrowser();

  // ---- 1) Module -------------------------------------------------------------------------------
  const voll = await lauf(browser, doc({ module:['geschuetz:legendaer','raffinerie:selten','geschuetz:gewoehnlich','horchposten:episch'],
    projekte:['dockring','sprungtor','tiefenhorchen'] }));
  check('0: Boot ohne Skriptfehler, der Vorposten steht auf der Karte', voll.errs.length === 0 && voll.mess.da === true, { errs: voll.errs.slice(0,2), da: voll.mess.da });
  check('1a: jedes eingebaute Modul erzeugt genau EIN eigenes Teil', voll.mess.module.length === 4, { gezeichnet: voll.mess.module.map(m => m.key) });
  check('1b: das Teil traegt den Modultyp und seine Seltenheit', (() => {
    const s = voll.mess.module.map(m => m.key + ':' + m.seltenheit).sort().join(',');
    return s === 'geschuetz:gewoehnlich,geschuetz:legendaer,horchposten:episch,raffinerie:selten';
  })(), { gemessen: voll.mess.module.map(m => m.key + ':' + m.seltenheit).sort() });
  check('1c: die Seltenheit ist an der Farbe zu sehen - legendaer und gewoehnlich unterscheiden sich', (() => {
    const l = voll.mess.module.find(m => m.seltenheit === 'legendaer'), g = voll.mess.module.find(m => m.seltenheit === 'gewoehnlich');
    if (!l || !g) return false;
    const farbe = (h) => (String(h).match(/#[0-9a-fA-F]{6}/g) || []).sort().join(',');
    return farbe(l.html) !== farbe(g.html);
  })(), { legendaer: (voll.mess.module.find(m => m.seltenheit === 'legendaer')||{}).html, gewoehnlich: (voll.mess.module.find(m => m.seltenheit === 'gewoehnlich')||{}).html });
  check('1d: zwei Module desselben Typs liegen NICHT uebereinander', (() => {
    const g = voll.mess.module.filter(m => m.key === 'geschuetz');
    return g.length === 2 && g[0].lage !== g[1].lage;
  })(), { lagen: voll.mess.module.filter(m => m.key === 'geschuetz').map(m => m.lage) });

  // ---- 2) Projekte -----------------------------------------------------------------------------
  check('2a: jedes FERTIGE Projekt bekommt sein Bauteil', voll.mess.projekte.map(p => p.key).sort().join(',') === 'dockring,sprungtor,tiefenhorchen',
    { gezeichnet: voll.mess.projekte.map(p => p.key) });
  const andere = await lauf(browser, doc({ zweig:'festung', zweigName:'Festungsring', name:'Sternenfestung', projekte:['bollwerk','handelskammer'] }));
  check('2b: die andere Haelfte der Projekttabelle zeichnet ebenso - und nur sie',
    andere.mess.projekte.map(p => p.key).sort().join(',') === 'bollwerk,handelskammer',
    { gezeichnet: andere.mess.projekte.map(p => p.key) });
  check('2c: das Sprungtor ist das einzige Teil mit einer Fuellung - es soll zuerst auffallen', (() => {
    const tor = voll.mess.projekte.find(p => p.key === 'sprungtor');
    const rest = voll.mess.projekte.filter(p => p.key !== 'sprungtor');
    return !!tor && /fill-opacity="0\.\d+"/.test(tor.html) && rest.every(p => !/fill-opacity="0\.\d+"/.test(p.html));
  })(), { tor: (voll.mess.projekte.find(p => p.key === 'sprungtor')||{}).html });

  // ---- 3) Der Zustand des Kerns ----------------------------------------------------------------
  check('3a: ein unversehrter Kern zeigt KEINEN Schaden', voll.mess.schaden.length === 0, { schaden: voll.mess.schaden });
  const halb = await lauf(browser, doc({ kern:{ lp: 50000, lpMax: 100000 } }));
  check('3b: unter zwei Dritteln reisst die Huelle', halb.mess.schaden.join(',') === 'mittel', { schaden: halb.mess.schaden });
  const wrack = await lauf(browser, doc({ kern:{ lp: 8000, lpMax: 100000 } }));
  check('3c: unter einem Drittel ist der Schaden schwer und deutlich mehr zu sehen', (() => {
    // Der Name verspricht MEHR - also wird auch mehr gemessen, nicht nur die Beschriftung.
    return wrack.mess.schaden.join(',') === 'schwer' && wrack.mess.schadenTeile > halb.mess.schadenTeile;
  })(), { schwer: wrack.mess.schaden, teileSchwer: wrack.mess.schadenTeile, teileMittel: halb.mess.schadenTeile });

  // ---- 4) Ausbau und Abbau ---------------------------------------------------------------------
  const baut = await lauf(browser, doc({ projektLaeuft:{ key:'sprungtor', fertigAb: now + 3600000 } }));
  check('4a: ein laufendes Vorhaben stellt eine Baustelle an die Station', baut.mess.bau.join(',') === 'sprungtor', { bau: baut.mess.bau });
  check('4b: ohne laufendes Vorhaben steht keine Baustelle da', voll.mess.bau.length === 0, { bau: voll.mess.bau });
  const weg = await lauf(browser, doc({ abbauAb: now + 12 * 3600000 }));
  check('4c: ein laufender Abbau ist am Marker zu sehen', weg.mess.abbau === 1, { abbau: weg.mess.abbau });
  check('4d: ohne Abbau kein Demontagegeruest', voll.mess.abbau === 0, { abbau: voll.mess.abbau });

  // ---- 5) Die Garnison -------------------------------------------------------------------------
  check('5a: eine leere Garnison zeigt fuenf leere Plaetze', (() => {
    const g = voll.mess.garnison[0];
    return !!g && g.voll === '0' && g.gefuellt === 0 && g.leer === 5;
  })(), { garnison: voll.mess.garnison });
  const halbeFlotte = await lauf(browser, doc({ garnisonAnzahl: 1500, garnisonMax: 3000 }));
  check('5b: eine halb belegte Garnison zeigt die Haelfte gefuellt', (() => {
    const g = halbeFlotte.mess.garnison[0];
    return !!g && g.voll === '3' && g.gefuellt === 3;
  })(), { garnison: halbeFlotte.mess.garnison });

  // ---- 6) Der Anflug ---------------------------------------------------------------------------
  check('6a: ohne Anflug kein Alarmring', voll.mess.alarm.length === 0, { alarm: voll.mess.alarm });
  const fern = await lauf(browser, doc({ anflug:[{ tag:'XYZ', ankunftAt: now + 2 * 3600000, schiffe: 40 }] }));
  const nah  = await lauf(browser, doc({ anflug:[{ tag:'XYZ', ankunftAt: now + 5 * 60000, schiffe: 40 }] }));
  check('6b: ein Anflug legt einen Alarmring um den Marker', fern.mess.alarm.length === 1 && nah.mess.alarm.length === 1,
    { fern: fern.mess.alarm, nah: nah.mess.alarm });
  check('6c: je naeher der Einschlag, desto schneller schlaegt der Ring', (() => {
    const f = parseFloat(fern.mess.alarm[0] || '0'), n = parseFloat(nah.mess.alarm[0] || '0');
    return f > 0 && n > 0 && n < f;
  })(), { fern: fern.mess.alarm[0], nah: nah.mess.alarm[0] });

  // ---- 7) Das Bodenlager bleibt ein Bodenlager -------------------------------------------------
  const lager = await lauf(browser, doc({ stufe:2, name:'Stützpunkt', zweig:null, zweigName:null, slots:0,
    module:['geschuetz:legendaer'], projekte:['sprungtor'], kern:{ lp: 5000, lpMax: 100000 } }));
  check('7a: bis zur Wahlstufe bekommt der Vorposten KEINE Stationsteile, auch nicht mit Modulen im Gepaeck',
    lager.mess.module.length === 0 && lager.mess.projekte.length === 0,
    { module: lager.mess.module.length, projekte: lager.mess.projekte.length });

  // ---- 9) Die Uebersicht auf der Startseite (D3) ------------------------------------------------
  /* Geprueft wird die REGEL, nicht die Schreibweise der Zahl: fmt() kuerzt auf "1.5k", und ein
     Test, der "1.500" erwartet, misst meine Annahme statt das Spiel (erster Entwurf, fiel prompt).
     Belegt wird deshalb: es steht ein Kern-Prozentwert da, es steht ein Garnisons-Verhaeltnis da,
     und beide AENDERN SICH mit dem Zustand - sonst waere es ein fester Text. */
  check('9a: die Uebersicht nennt den Kernzustand und die Garnison, nicht nur Name und System', (() => {
    const t = halbeFlotte.liste.text, leer = voll.liste.text;
    return halbeFlotte.liste.da && /\d+%/.test(t) && /\S+\/\S+/.test(t) && t !== leer;
  })(), { belegt: halbeFlotte.liste.text, leereGarnison: voll.liste.text });
  check('9a2: ein beschaedigter Kern zeigt einen anderen Prozentwert als ein heiler', (() => {
    const p = (t) => (String(t).match(/(\d+)%/) || [])[1];
    return p(wrack.liste.text) === '8' && p(voll.liste.text) === '100';
  })(), { wrack: wrack.liste.text, heil: voll.liste.text });
  check('9b: ein laufendes Vorhaben steht mit seiner Restzeit in der Uebersicht',
    baut.liste.da && /Sprungtor/.test(baut.liste.text), { text: baut.liste.text });
  check('9c: ein laufender Abbau verdraengt das Vorhaben - er ist das Wichtigere',
    weg.liste.da && /Abbau/.test(weg.liste.text) && !/Sprungtor/.test(weg.liste.text), { text: weg.liste.text });

  // ---- 10) Der Kampfverlauf im Kartenmenue (D2) ------------------------------------------------
  const gekaempft = await lauf(browser, doc({
    letzterKampf: { zeit: now - 3600000, angreiferName:'Angreifer A', schaden: 40000, gefallen:false, teilnehmer:1 },
    kampfverlauf: [
      { zeit: now - 3600000,  angreiferName:'Angreifer A', schaden: 40000, teilnehmer:1 },
      { zeit: now - 7200000,  angreiferName:'Angreifer B', schaden: 12000, teilnehmer:3 },
      { zeit: now - 10800000, angreiferName:'Angreifer C', schaden:  9000, teilnehmer:1 }
    ] }));
  check('10a: das Kartenmenue zeigt die Angriffe VOR dem juengsten', gekaempft.menue.da && gekaempft.menue.verlauf === 2,
    { verlauf: gekaempft.menue.verlauf, da: gekaempft.menue.da });
  check('10b: der juengste Schlag steht nicht doppelt - er hat schon seine eigene Zeile', (() => {
    const t = gekaempft.menue.text;
    return (t.match(/Angreifer A/g) || []).length === 1 && /Angreifer B/.test(t) && /Angreifer C/.test(t);
  })(), { text: gekaempft.menue.text.slice(0, 400) });
  check('10c: ein Verband ist als solcher zu erkennen', /Verband, 3/.test(gekaempft.menue.text),
    { text: gekaempft.menue.text.slice(0, 400) });
  check('10d: ohne Verlauf steht kein leerer Abschnitt da', voll.menue.da && voll.menue.verlauf === 0,
    { verlauf: voll.menue.verlauf });

  const alleLaeufe = [voll, andere, halb, wrack, baut, weg, halbeFlotte, fern, nah, lager, gekaempft];
  check('8: keine Skriptfehler in irgendeinem Lauf', alleLaeufe.every(l => l.errs.length === 0),
    { fehler: alleLaeufe.flatMap(l => l.errs).slice(0, 3) });

  for (const l of alleLaeufe) await l.ctx.close();
  await browser.close();
  ende();
})();
