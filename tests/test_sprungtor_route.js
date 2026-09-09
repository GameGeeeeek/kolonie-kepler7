// KB-26: Die Flugbahn fuehrt durch das Sprungtor.
//
//   node tests/test_sprungtor_route.js
//
// AUFTRAG Sascha (08.09.2026): „die Routenfuehrung muss intelligent sein und merken, ah, okay, da
// hab ich ein Sprungtor, das benutze ich auch."
//
// DER BEFUND: Kommt eine Flotte aus einem ANDEREN System, nahm der Kartenzeichner die SONNE als
// Platzhalter - die Flotte erschien aus dem Nichts in der Mitte. Die FLUGZEIT rechnete dabei
// laengst mit dem Tor (vorpostenFlug/vorpostenFlugMult, Deckel 0,75 statt 0,5); nur das Bild sagte
// etwas anderes. Hier wird keine Mechanik erfunden, sondern das Bild mit der Rechnung in
// Uebereinstimmung gebracht.
//
// GEPRUEFT WIRD DIE REGEL, in BEIDE Richtungen:
//   1a  Vorbedingung: Vorposten mit fertigem Sprungtor im gezeigten System, Mission von aussen,
//       und ueberhaupt eine Bahn im Bild.
//   1b  Die Bahn beginnt AM TOR und nicht an der Sonne. Gemessen wird der Abstand zu beiden -
//       „nicht an der Sonne" allein waere kein Beleg, die Bahn koennte irgendwo anders anfangen.
//   1c  OHNE fertiges Sprungtor beginnt sie an der Sonne. Das ist die Gegenrichtung im selben
//       Lauf: Ohne sie waere 1b auch dann gruen, wenn die Bahn IMMER am Tor begaenne.
//       KEINE eigene Verhaltenspruefung fuer „eine Art OHNE Tor-Kennzeichen beginnt an der Sonne":
//       Sie braeuchte ein zweites Fixture mit NPC-Ziel, und 2a haelt dieselbe Zusage bereits an der
//       Wurzel - gezeichnet wird ausschliesslich, was `art.sprungtor` traegt, und 2a legt fest, wer
//       das ist. Das steht hier, statt eine Pruefung zu behaupten, die es nicht gibt.
//   2a  DIE KOPIE-FAMILIE: Genau vier Missionsarten tragen `sprungtor:true`, und es sind die vier,
//       deren Sendeweg vorpostenFlug() aufruft (gemessen 08.09.2026: explore, colonize, mining,
//       vorposten-bau). Mondlandung und Bergbau-Eskorte rufen missionDurationFor direkt, alle
//       Angriffsarten ebenso. Wer eine Aufrufstelle ergaenzt und die Tabelle vergisst, faellt hier.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor KB-26 (`git show 264b8c6:weltraum_kolonie.html`),
// Aufruf mit KEPLER_TOR_GEGENPROBE=alt. Dort faellt 1b - die Bahn beginnt an der Sonne.
const fs2 = require('fs');
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
/* Der Zielplanet kommt aus der ECHTEN Spieldatei - dieselbe Regel wie in test_flugbahnen: Eine
   erfundene targetId findet missionMapZiel nicht, es gaebe keine Bahn, und der Test waere still
   leer statt rot. */
const ZIELPLANET = (fs2.readFileSync(SPIELDATEI, 'utf8').match(/\{ id:'(\w+)',[^\n]*system:'vega'/) || [])[1];
function spielstand(lagerStufe, wenigVorrat, torMarke){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    /* `wenigVorrat` startet weit UNTER dem Lagerdeckel. Ohne das ist ein Zugang gar nicht messbar:
       Das Spiel klemmt den Bestand beim Laden an den Deckel, und die Vorlage liegt dort schon -
       gleich welche Lagerstufe (gemessen: 24.800 bei Stufe 60, 80.800 bei Stufe 200). */
    resources: wenigVorrat
      ? { energie:9e5, erz:100, kristalle:100, deuterium:100, antimaterie:9e4, forschungspunkte:3e4 }
      : { energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:(lagerStufe === undefined ? 60 : lagerStufe), werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, spaeher:6, missions:[
      /* Eine ERKUNDUNG von der Heimat (kepler) nach vega: Ursprung ausserhalb des gezeigten
         Systems - genau der Fall, in dem bisher die Sonne als Platzhalter stand. Der Zielplanet
         wird aus der Spieldatei GELESEN, nicht erfunden (eine erfundene targetId liefert kein
         Ziel und damit gar keine Bahn - der Test waere still leer). */
      /* `torMarke` ist die eingefrorene Auskunft „stand beim Start ein Tor?" (KB-30). undefined
         heisst: aus einem Spielstand von VOR KB-30 - dann gilt das alte Verhalten, und genau das
         messen 1a bis 1c weiterhin. Gruppe 4 setzt sie ausdruecklich. */
      Object.assign({ id: 9001, type:'explore', targetId: ZIELPLANET, fleetName:'Kundschafter',
        startTime: now - 60000, endTime: now + 600000, composition:{ spaeher: 4 } },
        torMarke === undefined ? {} : { tor: torMarke }) ] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5e5, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}
async function lauf(browser, vp, belohnung, lagerStufe, wenigVorrat, torMarke){
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  let belohnungRaus = false;
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand(lagerStufe, wenigVorrat, torMarke) };
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
      // Die Auskunft, die die entfallenen Dreiecke ersetzt (5b): der Tooltip des Markers.
      titel: (document.querySelector('[data-map-vorposten] title') || {}).textContent || '',
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

const SAB = process.env.KEPLER_TOR_GEGENPROBE || '';
/* ZWEI VERGLEICHSSTAENDE, weil dieser Test inzwischen zwei Aenderungen bewacht - und die
   MUSS_FALLEN-Liste gilt immer NUR fuer einen bestimmten alten Stand. Gemessen, nicht gesetzt:
     alt  = vor KB-26 (264b8c6). Dort begann die Bahn an der Sonne UND das Tor war ein flacher
            Ellipsen-Ring -> 1b, 3a und 3b fallen.
     ring = vor KB-27 (4cdf423). Dort fliegt die Flotte schon durch das Tor (KB-26 ist drin),
            das Tor ist aber noch der flache Ring -> nur 3a und 3b fallen, 1b bleibt gruen.
   Der erste Anlauf fuehrte nur `alt` und lief gegen 4cdf423 - die Gegenprobe meldete daraufhin
   „1b blieb gruen" und hatte recht: Sie mass einen Stand, der KB-26 laengst kennt. */
/* DREI VERGLEICHSSTAENDE, alle gemessen:
     alt  = vor KB-26 (264b8c6): Bahn an der Sonne UND flacher Ellipsen-Ring -> 1b, 3a, 3b fallen.
     ring = vor KB-27 (4cdf423): Bahn schon durch das Tor, Tor noch flach     -> 3a, 3b fallen.
     hoch = vor KB-32 (d525800): Tor aufrecht, aber der Entflechter kennt nur das erste Bild der
            Gruppe -> die Beschriftung liegt auf dem Tor, 3d faellt. */
const MUSS_FALLEN = { alt: ['1b', '3a', '3b'], ring: ['3a', '3b'], hoch: ['3d'], marke: ['4a', '4c', '4d'] };
const ergebnis = {};
const check2 = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

/* Wo die Bahn ANFAENGT, und wo Sonne und Tor stehen. Alles aus dem gerenderten Bild: Die
   Torposition wird NICHT nachgerechnet, sondern am gezeichneten Tor abgelesen - eine zweite
   Rechnung waere eine zweite Wahrheit und ginge beim naechsten Verschieben auseinander.
   ABGELESEN WIRD DIE MITTE DES TORBILDS, NICHT EINE ELLIPSE (nachgezogen mit KB-27). Bis dahin
   bestand das Tor aus drei Ellipsen, und der Test suchte genau die - als es ein gerendertes Bild
   wurde, fand er nichts und meldete auf richtigem Code rot. Die Mitte kommt jetzt aus dem
   Rahmen des gezeichneten Teils, egal woraus es besteht: Bild wie Ellipse. */
async function bahnStart(page, farbe){
  return page.evaluate((f) => {
    const svg = document.getElementById('galaxyMapSvg');
    if (!svg) return { svg:false };
    const l = [...svg.querySelectorAll('line')].find(e => (e.getAttribute('stroke')||'') === f && !e.getAttribute('stroke-dasharray'));
    const tor = svg.querySelector('[data-vp-projekt="sprungtor"] image, [data-vp-projekt="sprungtor"] ellipse, [data-vp-projekt="sprungtor"] circle');
    let mitte = null;
    if (tor && tor.tagName === 'image'){
      mitte = { x: Number(tor.getAttribute('x')) + Number(tor.getAttribute('width'))/2,
                y: Number(tor.getAttribute('y')) + Number(tor.getAttribute('height'))/2 };
    } else if (tor){
      mitte = { x: Number(tor.getAttribute('cx')), y: Number(tor.getAttribute('cy')) };
    }
    /* KB-27: Bauart und Ausdehnung des Tores. `gestalt` sagt, WORAUS es besteht; `masse` gibt
       Breite und Hoehe im Bild und den Abstand der weitesten Ecke zur Stationsmitte, gemessen in
       Marker-Radien - dieselbe Groesse, die kbMarkerFrei reserviert. Der Radius kommt wie in
       test_vorposten_zustand aus dem unsichtbaren Trefferkreis (r = rV x 1,45). */
    const grp = svg.querySelector('[data-vp-projekt="sprungtor"]');
    let gestalt = null, masse = null;
    if (grp){
      gestalt = { bild: grp.querySelectorAll('image').length, ellipsen: grp.querySelectorAll('ellipse').length };
      const treffer = svg.querySelector('[data-map-vorposten] circle[fill="transparent"]');
      const gb = grp.getBoundingClientRect();
      if (treffer && gb.width && gb.height){
        const tb = treffer.getBoundingClientRect();
        const sx = tb.left + tb.width/2, sy = tb.top + tb.height/2, rV = (tb.width/2)/1.45;
        const ecken = [[gb.left,gb.top],[gb.right,gb.top],[gb.left,gb.bottom],[gb.right,gb.bottom]];
        /* KB-32: Liegt eine Beschriftung AUF dem Tor? Gemessen im Bildschirmraum, also mit allen
           Transformationen - das ist, was der Spieler sieht. */
        const kollision = [...svg.querySelectorAll('text.planet-label')].map(t => {
          const tb = t.getBoundingClientRect();
          const ueber = tb.left < gb.right && tb.right > gb.left && tb.top < gb.bottom && tb.bottom > gb.top;
          if (!ueber) return null;
          const bx = Math.max(0, Math.min(tb.right, gb.right) - Math.max(tb.left, gb.left));
          const by = Math.max(0, Math.min(tb.bottom, gb.bottom) - Math.max(tb.top, gb.top));
          return { text: (t.textContent || '').trim(), flaeche: +(bx * by).toFixed(1) };
        }).filter(Boolean);
        masse = { breite: gb.width, hoehe: gb.height, aufDemTor: kollision,
                  seitenverhaeltnis: +(gb.width/gb.height).toFixed(2),
                  eckeInRadien: +(Math.max.apply(null, ecken.map(p => Math.hypot(p[0]-sx, p[1]-sy))) / rV).toFixed(2) };
      }
    }
    return { svg:true, bahn: l ? { x:Number(l.getAttribute('x1')), y:Number(l.getAttribute('y1')) } : null, tor: mitte, gestalt, masse };
  }, farbe);
}
const abst = (a,b) => (a && b) ? Math.hypot(a.x-b.x, a.y-b.y) : null;
/* DIE SONNE aus der Spieldatei GELESEN, nicht aus dem DOM geraten. Der erste Entwurf suchte den
   groessten Kreis - und traf die STATION (gemessen: 29,2 Einheiten unter dem Tor, also genau
   r*1,72 darunter). Die Pruefung „nicht an der Sonne" verglich damit gegen den falschen Punkt und
   war aus dem falschen Grund gruen. Die Konstante steht als EINE Zeile im Quelltext; sie
   abzulesen ist genauer als jede Heuristik ueber gezeichnete Kreise. */
const SONNE = (() => {
  const m = fs2.readFileSync(SPIELDATEI, 'utf8').match(/const SUN_X = (\d+), SUN_Y = (\d+);/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
})();

(async () => {
  const browser = await starteBrowser();
  try {
    // ---- 2a) Die Kopie-Familie, ohne Browser messbar --------------------------------------------
    const quelle = fs2.readFileSync(SPIELDATEI, 'utf8');
    const tabVon = quelle.indexOf('const MISSION_LINIEN = {');
    const tab = quelle.slice(tabVon, quelle.indexOf('\n  };', tabVon));
    const mitTor = [...tab.matchAll(/^\s{4}'?([\w-]+)'?:\s*\{[^\n]*sprungtor:true/gm)].map(m => m[1]).sort();
    check2('0a: ein Zielplanet in vega steht in der Spieldatei', !!ZIELPLANET, { ZIELPLANET });
    /* Die Liste waechst mit den Aufrufstellen von vorpostenFlug() - sie ist eine Kopie-Familie,
       kein fester Bestand. VP-1 hat mit dem Transportverband die fuenfte Aufrufstelle gebracht
       (vorpostenFrachtFlug); die Zusage bleibt dieselbe: GENAU die Arten, deren Flugzeit ueber
       vorpostenFlug laeuft, tragen sprungtor:true - keine mehr und keine weniger. */
    check2('2a: genau die fuenf Arten mit vorpostenFlug tragen sprungtor:true',
      JSON.stringify(mitTor) === JSON.stringify(['colonize','explore','mining','vorposten-bau','vorposten-fracht']), { mitTor });

    // ---- 1) Mit Tor ------------------------------------------------------------------------------
    const mitTorLauf = await lauf(browser, doc({ projekte:['sprungtor'] }));
    const a = await bahnStart(mitTorLauf.page, '#378add');
    check2('1a: Vorbedingung - Tor gezeichnet, Sonne bekannt, und eine Bahn im Bild',
      a.svg === true && !!a.tor && !!SONNE && !!a.bahn, { ...a, SONNE });
    check2('1b: die Bahn beginnt AM TOR, nicht an der Sonne',
      !!a.bahn && !!a.tor && abst(a.bahn, a.tor) < 3 && abst(a.bahn, SONNE) > 12,
      { zumTor: a.tor ? +abst(a.bahn, a.tor).toFixed(1) : null,
        zurSonne: +abst(a.bahn, SONNE).toFixed(1) });

    /* ---- 3) DAS TOR SELBST (KB-27, Auftrag Sascha: „ein richtiges tor mit grafik nicht einfach
       nur ein ring ... aehnlich stargate atlantis") ------------------------------------------- */
    check2('3a: das Tor ist ein gerendertes Bauwerk, kein Ellipsen-Ring',
      !!a.gestalt && a.gestalt.bild === 1 && a.gestalt.ellipsen === 0, { gestalt: a.gestalt });
    /* AUFRECHT ist die eigentliche Zusage - ein Tor durchfliegt man, ein Reifen liegt herum. Der
       flache Vorgaenger war 2,3-mal so breit wie hoch (rx 0,92 r zu ry 0,40 r); ein aufrechtes Tor
       ist rund quadratisch. Gemessen mit Spielraum, damit der Stiel unten nicht stoert. */
    check2('3b: es steht aufrecht - Breite und Hoehe liegen beieinander',
      !!a.masse && a.masse.seitenverhaeltnis > 0.55 && a.masse.seitenverhaeltnis < 1.45, { masse: a.masse });
    /* Und es bleibt im reservierten Platz. Diese Pruefung gilt auch fuer den flachen Vorgaenger -
       sie ist kein Beleg fuer KB-27, sondern der Waechter, der die naechste Vergroesserung faengt.
       GEMESSEN wird die weiteste ECKE, nicht die Oberkante: kbMarkerFrei rechnet mit Math.hypot.
       Genau diese Verwechslung hat den ersten Entwurf des Tores auf 3,63 r wachsen lassen. */
    const reserviert = Number((quelle.match(/const VORPOSTEN_SICHT = ([\d.]+);/) || [])[1]);
    check2('3c: das Tor bleibt im reservierten Platz des Vorpostens',
      reserviert > 0 && !!a.masse && a.masse.eckeInRadien <= reserviert,
      { gemessen: a.masse && a.masse.eckeInRadien, reserviert });
    /* KB-32 (Fehlerbericht Sascha mit Screenshot: „der name des aussenposten überlagert das tor").
       Der Beschriftungs-Entflechter griff die belegte Flaeche einer Gruppe ueber das ERSTE Bild -
       beim Vorposten die Station. Das aufrechte Tor darueber galt damit als leerer Raum, und die
       Beschriftung wich genau dorthin aus. Gemessen wird die Ueberdeckung im Bildschirmraum. */
    check2('3d: keine Beschriftung liegt auf dem Tor',
      !!a.masse && Array.isArray(a.masse.aufDemTor) && a.masse.aufDemTor.length === 0,
      { aufDemTor: a.masse && a.masse.aufDemTor });
    await mitTorLauf.ctx.close();

    // ---- 1c) Ohne Tor ---------------------------------------------------------------------------
    const ohne = await lauf(browser, doc({ projekte:[] }));
    const b = await bahnStart(ohne.page, '#378add');
    check2('1c: ohne fertiges Sprungtor beginnt sie an der Sonne',
      !!b.bahn && !b.tor && abst(b.bahn, SONNE) < 3,
      { zurSonne: b.bahn ? +abst(b.bahn, SONNE).toFixed(1) : null, tor: b.tor });
    await ohne.ctx.close();

    /* ---- 4) KB-30: WAS BEIM START GALT, NICHT WAS JETZT GILT --------------------------------
       Befund der Durchsicht an PR #611, bestaetigt: `endTime` friert die Flugzeit beim Start ein,
       die Bahn las den HEUTIGEN Torzustand. Wird ein Tor waehrend eines Fluges fertig, zeichnete
       die Bahn eine Passage, die die Flugzeit gar nicht hat - und das Tor verkuerzt wirklich
       (`wirkung: { flug: 0.20, flugDeckel: 0.75 }` in VP_PROJEKT_DEFS des Servers).
       BEIDE LAEUFE HABEN DAS TOR IM BILD und unterscheiden sich NUR in der Marke der Mission.
       Das ist der Kern: Ohne 4b waere 4a auch dann gruen, wenn die Bahn nie mehr durch ein Tor
       ginge; ohne 4a waere 4b auch dann gruen, wenn die Marke gar nicht gelesen wuerde. */
    const spaet = await lauf(browser, doc({ projekte:['sprungtor'] }), null, undefined, undefined, false);
    const c = await bahnStart(spaet.page, '#378add');
    check2('4a: eine Mission, die VOR dem Tor startete, beginnt an der Sonne - obwohl das Tor jetzt steht',
      !!c.bahn && !!c.tor && abst(c.bahn, SONNE) < 3 && abst(c.bahn, c.tor) > 12,
      { torGezeichnet: !!c.tor, zurSonne: c.bahn ? +abst(c.bahn, SONNE).toFixed(1) : null,
        zumTor: (c.bahn && c.tor) ? +abst(c.bahn, c.tor).toFixed(1) : null });
    await spaet.ctx.close();

    const frueh = await lauf(browser, doc({ projekte:['sprungtor'] }), null, undefined, undefined, true);
    const d = await bahnStart(frueh.page, '#378add');
    check2('4b: eine Mission, die MIT Tor startete, beginnt am Tor',
      !!d.bahn && !!d.tor && abst(d.bahn, d.tor) < 3 && abst(d.bahn, SONNE) > 12,
      { zumTor: (d.bahn && d.tor) ? +abst(d.bahn, d.tor).toFixed(1) : null,
        zurSonne: d.bahn ? +abst(d.bahn, SONNE).toFixed(1) : null });
    await frueh.ctx.close();

    /* 4c: DIE ZWEITE KOPIE-FAMILIE. 2a haelt fest, WELCHE Arten durch ein Tor fliegen; 4c haelt
       fest, dass auch jede Stelle, die so eine Mission ERZEUGT, die Marke setzt. Ohne sie faellt
       eine neue Missionsart still auf das alte Verhalten zurueck - und zwar unauffaellig, weil
       `undefined` absichtlich der Rueckfall ist. Die Zahl ist GEMESSEN (08.09.2026): sieben
       Erzeuger fuer fuenf Arten, weil die Erkundung drei hat (von Hand, Auto-Erkunder hin,
       Auto-Erkunder zurueck). */
    /* Sieben Erzeuger, aber nur SECHS fragen den heutigen Torzustand ab: Der Rueckweg des
       Auto-Erkunders uebernimmt die Marke SEINES HINWEGS, weil er auch dessen DAUER uebernimmt
       (Befund der Durchsicht an PR #614). Eine dort frisch gerechnete Marke koennte von der
       eingefrorenen Flugzeit abweichen - genau das Auseinanderlaufen, das KB-30 behebt.
       Gezaehlt wird deshalb BEIDES getrennt; eine Summe waere gruen, wenn eine Stelle wegfiele
       und eine andere doppelt stuende. */
    const erzeuger = (quelle.match(/tor: vorpostenTorAn\(/g) || []).length;
    const ausHinweg = (quelle.match(/tor: tour\.lastLegTor/g) || []).length;
    check2('4c: alle sieben Missionserzeuger der Tor-Arten setzen die Marke',
      erzeuger === 6 && ausHinweg === 1,
      { ausTorzustand: erzeuger, ausHinweg, erwartet: '6 + 1' });
    /* Und die Marke des Hinwegs wird auch wirklich GESETZT - sonst truege der Rueckweg still
       `undefined` und fiele auf das alte Verhalten zurueck, ohne dass 4c es merkt. */
    check2('4d: der Hinweg des Auto-Erkunders merkt sich seine Torlage mit der Dauer',
      /tour\.lastLegDuration = dur;/.test(quelle) && /tour\.lastLegTor = vorpostenTorAn\(/.test(quelle),
      { dauer: /tour\.lastLegDuration = dur;/.test(quelle), marke: /tour\.lastLegTor = vorpostenTorAn\(/.test(quelle) });
  } finally {
    await browser.close();
  }

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = soll.filter(n => ergebnis[n] === false);
    console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' der Pflichtliste gefallen (' +
      soll.map(n => n + '=' + (ergebnis[n] === false ? 'rot' : 'gruen')).join(' ') + ')');
    if (gefallen.length !== soll.length){
      console.log('FAIL - Gegenprobe unvollstaendig: ' + soll.filter(n => ergebnis[n] !== false).join(', ') + ' blieben gruen');
      process.exitCode = 1; return;
    }
    process.exitCode = 0; return;
  }
  ende();
})().catch(e => { console.error('FAIL - Abbruch:', e); process.exit(1); });
