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
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
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
function spielstand(lagerStufe, wenigVorrat){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    /* `wenigVorrat` startet weit UNTER dem Lagerdeckel. Ohne das ist ein Zugang gar nicht messbar:
       Das Spiel klemmt den Bestand beim Laden an den Deckel, und die Vorlage liegt dort schon -
       gleich welche Lagerstufe (gemessen: 24.800 bei Stufe 60, 80.800 bei Stufe 200). */
    resources: wenigVorrat
      ? { energie:9e5, erz:100, kristalle:100, deuterium:100, antimaterie:9e4, forschungspunkte:3e4 }
      : { energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:(lagerStufe === undefined ? 60 : lagerStufe), werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5e5, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}
async function lauf(browser, vp, belohnung, lagerStufe, wenigVorrat){
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  let belohnungRaus = false;
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand(lagerStufe, wenigVorrat) };
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
    if (p === 'pending-rewards/claim'){ const b = belohnung && !belohnungRaus ? (belohnungRaus = true, belohnung) : null; return j({ reward: b }); }
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
    return j({ ok:true });
  });
  /* DAS PROTOKOLL WIRD MITGESCHNITTEN, statt am Ende ausgelesen (Durchsicht 04.09.2026).
     `log()` schreibt per innerHTML in EIN Element - der Endzustand sagt nur, welche Meldung
     zuletzt dastand, nicht welche erschienen ist. Ein MutationObserver haelt jede fest. */
  await page.addInitScript(() => {
    localStorage.setItem('kepler7_token', 'tok');
    window.__logs = [];
    const beobachte = () => {
      const l = document.getElementById('log');
      if (!l) return;
      new MutationObserver(() => {
        const t = (l.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t !== window.__logs[window.__logs.length - 1]) window.__logs.push(t);
      }).observe(l, { subtree: true, childList: true, characterData: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', beobachte);
    else beobachte();
  });
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
      alarm: teile('[data-vp-alarm]').map(e => (e.querySelector('animate') || {}).getAttribute ? e.querySelector('animate').getAttribute('dur') : null),
      /* Die AUSDEHNUNG, gemessen am gezeichneten Bild: der weiteste Punkt irgendeines Bauteils vom
         Mittelpunkt, als Vielfaches des Marker-Radius. Die Beschriftung bleibt aussen vor - sie ist
         Text ueber dem Marker und wird vom Kollisionsschieber nicht behandelt. Der Radius kommt aus
         dem unsichtbaren Trefferkreis (r = rV x 1,45), der Mittelpunkt aus seinem cx/cy. */
      /* Die AUSDEHNUNG, gemessen am gezeichneten Bild: der weiteste Punkt irgendeines Bauteils vom
         Mittelpunkt, als Vielfaches des Marker-Radius. Die Beschriftung bleibt aussen vor - sie ist
         Text ueber dem Marker und wird vom Kollisionsschieber nicht behandelt.

         GEMESSEN WIRD IM BILDSCHIRMRAUM (getBoundingClientRect), nicht mit getBBox: Das liefert die
         Masse im EIGENEN Koordinatensystem, VOR dem transform der Gruppe - die Modulteile stehen
         dort um (0,0), und der Vergleich mit dem Mittelpunkt ergab den Abstand zum SVG-Ursprung
         (gemessener Faktor 20,4 statt 1,85; erster Entwurf, fiel prompt). */
      ausdehnung: (() => {
        const treffer = n.querySelector('circle[fill="transparent"]');
        if (!treffer || !treffer.getBoundingClientRect) return null;
        const tr = treffer.getBoundingClientRect();
        const cx = tr.left + tr.width / 2, cy = tr.top + tr.height / 2;
        const rV = (tr.width / 2) / 1.45;
        if (!(rV > 0)) return null;
        const liste = [];
        for (const el of n.querySelectorAll('*')) {
          if (el.tagName === 'title' || el.tagName === 'animate' || el.tagName === 'animateTransform') continue;
          if (el.classList && el.classList.contains('planet-label')) continue;
          const b = el.getBoundingClientRect();
          if (!b || (!b.width && !b.height)) continue;
          /* ZWEI MASSE, JE NACH LAGE DES TEILS (Durchsicht 04.09.2026 - die erste Fassung war
             bauartbedingt blind).
             Die Achsen-Ausdehnung ist die wahre NUR fuer Formen, die um den MARKERMITTELPUNKT
             herum rund sind: Bei einem Kreis mit Radius 2,35 liegt die Box-Ecke bei
             2,35 x Wurzel(2) = 3,32, dort ist aber keine Tinte - die Ecken-Messung meldete
             deshalb 3,12 fuer den Hof, der in Wahrheit auf 2,35 aufgeht.
             Fuer VERSETZTE Teile gilt das Gegenteil, und genau dort war die Achsen-Messung blind:
             Der Bogen des Tiefenhorchpostens sitzt diagonal unten links; die Achsen-Messung ergab
             2,09 r, waehrend der weiteste Tintenpunkt bei 2,78 r lag - 17 % Ueberstand, gruen
             gemeldet. `kbMarkerFrei` rechnet aber mit `Math.hypot`, also mit dem ABSTAND.
             Unterschieden wird daran, ob die Box den Mittelpunkt ENTHAELT. */
          const drin = b.left <= cx && b.right >= cx && b.top <= cy && b.bottom >= cy;
          const m = drin
            ? Math.max(Math.abs(b.left - cx), Math.abs(b.right - cx), Math.abs(b.top - cy), Math.abs(b.bottom - cy))
            : Math.max.apply(null, [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]]
                .map(function (p) { return Math.hypot(p[0] - cx, p[1] - cy); }));
          liste.push({ tag: el.tagName, attr: (el.getAttribute('data-vp-projekt') || el.getAttribute('data-vp-modul') || ''), f: Math.round(m / rV * 100) / 100 });
        }
        liste.sort((x, y) => y.f - x.f);
        return { faktor: liste.length ? liste[0].f : 0, weiteste: liste.slice(0, 4) };
      })()
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
  /* GEMESSEN WIRD DER GESPEICHERTE SPIELSTAND, nicht das Protokoll: `log()` schreibt in ein
     EINZELNES Element (#log), das jede spaetere Meldung ueberschreibt - als Messpunkt fuer ein
     Ereignis beim Start ist es untauglich (erster Entwurf, fiel prompt). Der Spielstand aus der
     nachgebauten Storage-Route belegt dagegen beides auf einmal: dass gutgeschrieben wurde UND
     dass der Zweig save() gerufen hat. */
  let gespeichert = null;
  try { gespeichert = JSON.parse(st['kepler7-save-v3']); } catch (e) {}
  const logs = await page.evaluate(() => (window.__logs || []).slice());
  return { ctx, page, errs, mess, liste, menue, gespeichert, logs };
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

  // ---- 7) Gezeichnet wird nur, was auch wirkt --------------------------------------------------
  /* HIER STAND "das Bodenlager bleibt ein Bodenlager" (04.09.2026 umgeschrieben). Die Regel gibt
     es nicht mehr: Seit GR-6 ist der Vorposten auf JEDER Stufe eine Station, das Bodenlager ist
     entfallen. Eine Pruefung, die eine abgeschaffte Regel festhaelt, haelt die Entwicklung auf,
     statt sie zu sichern - sie muss der neuen Regel folgen, nicht rueckgaengig machen.
     Die neue Regel ist die staerkere: Der Server rechnet die Wirkung eines Moduls mit
     `.slice(0, slots)`. Ein Modul jenseits der Steckplaetze zaehlt NICHT - also darf es auch
     nicht gezeichnet werden, sonst verspricht das Bild eine Wirkung, die es nicht gibt. Genau
     diese Luecke war vorher durch die Stufenpruefung verdeckt. */
  const lager = await lauf(browser, doc({ stufe:2, name:'Stützpunkt', zweig:null, zweigName:null, slots:0,
    module:['geschuetz:legendaer'], projekte:['sprungtor'], kern:{ lp: 5000, lpMax: 100000 } }));
  check('7a: ein Modul ohne Steckplatz wird NICHT gezeichnet - es wirkt auch nicht',
    lager.mess.module.length === 0,
    { module: lager.mess.module.length, slots: 0, imDokument: 1 });
  const einSlot = await lauf(browser, doc({ stufe:2, name:'Stützpunkt', zweig:null, zweigName:null, slots:1,
    module:['geschuetz:legendaer','kernpanzer:episch'], projekte:['sprungtor'], kern:{ lp: 5000, lpMax: 100000 } }));
  check('7b: mit EINEM Steckplatz wird genau eines gezeichnet, nicht beide',
    einSlot.mess.module.length === 1,
    { gezeichnet: einSlot.mess.module.length, slots: 1, imDokument: 2 });
  check('7c: fertige Projekte haengen dagegen an der Station selbst, nicht an einem Steckplatz',
    lager.mess.projekte.length > 0,
    { projekte: lager.mess.projekte.length });

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

  // ---- 11) Der Belohnungszweig fuer das abgeholte Lager (Etappe V4) ----------------------------
  /* Der Server reiht das Lager als eigenen Typ ein (`vorposten-lager`). Ein Typ ohne Zweig faellt
     im Client still durch alle if-Ketten und ist ERSATZLOS weg - deshalb prueft
     test_vorposten_paritaet 3b, DASS es den Zweig gibt. Hier wird gemessen, dass er auch etwas
     tut: Der Ertrag muss im Spielstand ankommen und im Protokoll stehen. */
  /* GROSSES Lager und massvolle Lieferung: Seit der Ertrag durch gainResources geht (Lagerdeckel),
     kann eine Lieferung ueber dem Deckel gar nicht mehr ankommen - der Standard-Spielstand liegt
     dort ohnehin schon. Ein Test mit der alten, ungedeckelten Erwartung wuerde die Deckelung als
     Fehler melden. Die Deckelung selbst misst 13a. */
  const MENGE = 5000;
  const ohneLager = await lauf(browser, doc({}), null, 200, true);
  const mitLager = await lauf(browser, doc({}), { type:'vorposten-lager', system:SYS, name:'Sternenwerft',
    erz: MENGE, kristalle: 3000, deuterium: 2000, zeit: now }, 200, true);
  const vorher = ohneLager.gespeichert && ohneLager.gespeichert.resources;
  const nachher = mitLager.gespeichert && mitLager.gespeichert.resources;
  check('11a: der Ertrag ist im gespeicherten Spielstand angekommen - gutgeschrieben UND gesichert',
    !!nachher && !!vorher && nachher.erz >= vorher.erz + MENGE,
    { erzNachher: nachher && nachher.erz, erzVorher: vorher && vorher.erz, gutschrift: MENGE });
  check('11b: ALLE drei Rohstoffe kommen an, nicht nur das Erz', (() => {
    if (!nachher || !vorher) return false;
    return nachher.kristalle >= vorher.kristalle + 3000 && nachher.deuterium >= vorher.deuterium + 2000;
  })(), { nachher: nachher && { erz: nachher.erz, kristalle: nachher.kristalle, deuterium: nachher.deuterium },
          vorher: vorher && { erz: vorher.erz, kristalle: vorher.kristalle, deuterium: vorher.deuterium } });

  /* 11c/11d: DIE ANDERE HAELFTE DERSELBEN SACHE (Durchsicht 04.09.2026). Faellt ein fremder
     Vorposten, haengt der Server an die Beute JEDES Beitragenden das Feld `lagerBeute`
     (server.js, V4) - anteilig nach Schadensanteil aus dem Stand beim Fall. Der Frontend-Zweig
     `vorposten` bucht es nicht: Der Ertrag wurde gepusht, beim Abholen serverseitig aus der
     Warteschlange geraeumt und im Client ersatzlos verworfen. Die Gegenseite fuer den BESITZER
     (`lagerVerloren`) war laengst da; die Angreiferhaelfte war vergessen, und docs/vorposten.md
     behauptete ausdruecklich das Gegenteil.
     DIESELBEN LAUFBEDINGUNGEN WIE `ohneLager` (Stufe 200 UND wenig Vorrat) - der erste Entwurf
     verglich gegen einen Lauf mit anderem Ausgangsvorrat, und das Lager stand dadurch schon am
     Deckel: 11c war zufaellig gruen, 11d fiel, weil gar nichts mehr ankam. Ein Vergleich zweier
     Laeufe ist nur so viel wert wie ihre Uebereinstimmung in allem, was nicht gemessen wird. */
  const beute = await lauf(browser, doc({}), { type:'vorposten', system:SYS, name:'Sternenwerft',
    besitzerName:'Rivale', anteil:0.5, kampfpunkte:400, xp:2000, credits:9000,
    lagerBeute:{ erz: 51000, kristalle: 17000, deuterium: 13000 }, zeit: now }, 200, true);
  const bVor = ohneLager.gespeichert && ohneLager.gespeichert.resources;
  const bNach = beute.gespeichert && beute.gespeichert.resources;
  check('11c: die erbeutete Lagerbeute des geschleiften Vorpostens wird gebucht, nicht verworfen',
    !!bNach && !!bVor && bNach.erz >= bVor.erz + 51000 && bNach.kristalle >= bVor.kristalle + 17000
      && bNach.deuterium >= bVor.deuterium + 13000,
    { nachher: bNach && { erz: bNach.erz, kristalle: bNach.kristalle, deuterium: bNach.deuterium },
      vorher: bVor && { erz: bVor.erz, kristalle: bVor.kristalle, deuterium: bVor.deuterium } });
  /* Geprueft wird die REGEL (alle drei Rohstoffe stehen neben den drei alten Groessen), nicht die
     Schreibweise der Zahl: `fmt()` macht aus 51000 ein „51.0k", nicht „51.000" - der erste Entwurf
     suchte nach der zweiten Form und fiel an einer richtigen Meldung. */
  check('11d: und die Meldung nennt die Rohstoffe neben Kampfpunkten, Erfahrung und Krediten', (() => {
    const zeile = (beute.logs || []).find(t => /Anteil an der Beute/.test(t));
    if (!zeile) return false;
    return ['Kampfpunkte', 'Erfahrung', 'Kredite', 'Erz', 'Kristalle', 'Deuterium']
      .every(w => zeile.indexOf(w) >= 0);
  })(), { zeile: (beute.logs || []).find(t => /Anteil an der Beute/.test(t)) || null });

  // ---- 12) Die Ausdehnung passt in den reservierten Platz ---------------------------------------
  /* Befund des Review-Bots auf PR #562: Der Kollisionsschieber reservierte rV x 2,0, waehrend der
     Alarmring auf 2,35 aufging und die Projektteile noch weiter hinaus - das Sprungtor nach oben,
     der Tiefenhorchposten in der Diagonalen. Bestaetigt und behoben.
     GEMESSEN WIRD AM BILD, nicht an einer Kopfrechnung: Bei genau der Nachrechnung ist mir ein
     Teil durchgegangen, das der Bot nicht genannt hatte (fuenf Module desselben Typs stapelten
     nach aussen auf 2,76). Ein Test, der die gezeichnete Ausdehnung misst, faengt auch das
     naechste Bauteil, an das heute niemand denkt. */
  const vollAus = await lauf(browser, doc({
    module:['geschuetz:legendaer','geschuetz:selten','geschuetz:episch','geschuetz:gewoehnlich','geschuetz:ungewoehnlich'],
    projekte:['dockring','sprungtor','tiefenhorchen','bollwerk','handelskammer'],
    garnisonAnzahl: 3000, garnisonMax: 3000,
    anflug:[{ tag:'XYZ', ankunftAt: now + 5 * 60000, schiffe: 40 }],
    projektLaeuft:{ key:'sprungtor', fertigAb: now + 3600000 },
    kern:{ lp: 8000, lpMax: 100000 } }));
  /* Der reservierte Platz wird AUS DEM QUELLTEXT gelesen, nicht eingetippt: So prueft der Test die
     Regel „das Bild passt in das, was reserviert ist" - und nicht eine Zahl, die beim naechsten
     Umbau still auseinanderlaufen wuerde. */
  const reserviert = Number((require('fs').readFileSync(SPIELDATEI, 'utf8')
    .match(/const VORPOSTEN_SICHT = ([\d.]+);/) || [])[1]);
  check('12-vorab: der reservierte Platz steht als EINE Konstante im Quelltext', reserviert > 0, { reserviert });
  check('12a: mit ALLEM daran bleibt der Vorposten im reservierten Platz', (() => {
    const a = vollAus.mess.ausdehnung;
    return !!a && reserviert > 0 && a.faktor <= reserviert;
  })(), { gemessen: vollAus.mess.ausdehnung, reserviert });

  // ---- 13) Der Lagerdeckel gilt auch fuer das Vorposten-Lager -----------------------------------
  /* Zweiter Befund des Review-Bots, ebenfalls bestaetigt: Der Zweig addierte direkt auf
     state.resources und umging damit gainResources() - also den Lagerdeckel. Wer oft genug abholt,
     haette kein Lager mehr gebraucht. Gemessen mit einem winzigen Lager und einer riesigen Lieferung. */
  const klein = await lauf(browser, doc({}), { type:'vorposten-lager', system:SYS, name:'Sternenwerft',
    erz: 99999999, kristalle: 99999999, deuterium: 99999999, zeit: now }, 1);
  /* DIESELBE RIESENLIEFERUNG AN EIN GROSSES LAGER - die Gegenprobe zur Deckelung. Ohne sie war
     13a bauartbedingt blind (Durchsicht 04.09.2026): Der zweite Vergleich lautete
     `n.erz < v.erz + 99999999` und folgt logisch aus dem ersten, da v.erz >= 0. Er konnte nie
     fallen. Gemessen wird jetzt, was der Kommentar immer behauptet hat: Der Deckel der
     TATSAECHLICHEN Stufe wirkt - ein kleines Lager nimmt WENIGER auf als ein grosses. */
  const grossLager = await lauf(browser, doc({}), { type:'vorposten-lager', system:SYS, name:'Sternenwerft',
    erz: 99999999, kristalle: 99999999, deuterium: 99999999, zeit: now }, 200);
  check('13a: eine Lieferung ueber dem Lagerdeckel wird gekappt, nicht durchgereicht', (() => {
    const n = klein.gespeichert && klein.gespeichert.resources;
    const g = grossLager.gespeichert && grossLager.gespeichert.resources;
    return !!n && !!g && n.erz < 99999999 && n.erz < g.erz;
  })(), { mitKleinemLager: klein.gespeichert && klein.gespeichert.resources.erz,
          mitGrossemLager: grossLager.gespeichert && grossLager.gespeichert.resources.erz, geliefert: 99999999 });
  /* 13b misst jetzt das PROTOKOLL, das sein Name nennt. Vorher zaehlte es ein zweites Mal
     Skriptfehler und war damit eine echte Teilmenge von Pruefung 8 - es konnte nie fallen, ohne
     dass 8 mitfaellt. Die Regel dahinter: Die Meldung nennt, was ANKOMMT, nicht was geschickt
     wurde, und sagt beim Deckel ausdruecklich, dass der Rest verfallen ist. */
  check('13b: und das Protokoll nennt, was ankam - nicht die geschickte Menge', (() => {
    const zeile = (klein.logs || []).find(t => /Lager deines/.test(t));
    if (!zeile) return false;
    return !/99\.999\.999/.test(zeile) && /verfallen/.test(zeile) && !/es war leer/.test(zeile);
  })(), { zeile: (klein.logs || []).find(t => /Lager deines/.test(t)) || null, anzahlMeldungen: (klein.logs || []).length });

  const alleLaeufe = [voll, andere, halb, wrack, baut, weg, halbeFlotte, fern, nah, lager, einSlot, gekaempft, ohneLager, mitLager, vollAus, klein, grossLager, beute];
  check('8: keine Skriptfehler in irgendeinem Lauf', alleLaeufe.every(l => l.errs.length === 0),
    { fehler: alleLaeufe.flatMap(l => l.errs).slice(0, 3) });

  for (const l of alleLaeufe) await l.ctx.close();
  await browser.close();
  ende();
})();
