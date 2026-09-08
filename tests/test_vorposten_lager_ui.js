// Das Lager am Vorposten im Spiel (Etappe V4, Frontend-Haelfte, 05.09.2026).
//
// DER ANLASS IST DIE LUECKE SELBST: Der Belohnungszweig `vorposten-lager` stand seit dem
// 03.09.2026 im Spiel, sorgfaeltig gebaut - aber KEINE einzige Stelle rief den Endpunkt
// /api/vorposten/lager/holen. Das Lager war unerreichbar; der Zweig konnte nie ausloesen.
// `grep -c 'vorposten/lager/holen' weltraum_kolonie.html` war 0.
//
// Diese Fehlerklasse hat kein Testverfahren gefangen, weil beide Seiten fuer sich stimmig waren:
// Der Server bot den Endpunkt an, das Spiel konnte die Antwort verarbeiten - es fragte nur nie.
// Abschnitt 0 misst deshalb die VERBINDUNG, nicht die Enden.
//
// GEPRUEFT:
//   0a  Es gibt genau eine Stelle, die den Abhol-Endpunkt ruft.
//   0b  Sie bucht den Ertrag NICHT selbst - das tut der Claim-Zweig ueber gainResources
//       (dort haengt der Lagerdeckel). Eine zweite Buchung waere eine Verdopplung.
//   0c  Und sie loest den Claim aus, statt auf den naechsten Takt zu warten.
//   1a  Die Station zeigt den Lagerstand - auch an einem FREMDEN Vorposten (offen sichtbar).
//   1b  Mit „voll in ..." solange Platz ist.
//   2a  Am Deckel steht „voll" und der Hinweis, dass Weiteres verfaellt.
//   3a  Der Abhol-Eintrag steht im Menue des EIGENEN Vorpostens ...
//   3b  ... und fehlt, wenn das Lager leer ist - ein Knopf, der „hier liegt nichts" antwortet,
//       ist kein Angebot.
//   3c  ... und fehlt am fremden Vorposten.
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = src.match(/<script>([\s\S]*)<\/script>/)[1];
const ICH = 'u-ich';
const SYS = 'vega';

check('0a: es gibt GENAU EINE Stelle, die den Abhol-Endpunkt ruft',
  (JS.match(/'\/vorposten\/lager\/holen'/g) || []).length === 1,
  { treffer: (JS.match(/'\/vorposten\/lager\/holen'/g) || []).length });
{
  const von = JS.indexOf('async function vorpostenLagerHolen(');
  const rumpf = von < 0 ? '' : JS.slice(von, JS.indexOf('\n  }', von));
  check('0-anker: die Abholfunktion ist lesbar (sonst messen 0b und 0c nichts)',
    von > 0 && /lager\/holen/.test(rumpf), { laenge: rumpf.length });
  /* 0b ist die WICHTIGSTE Pruefung dieser Datei. Der Ertrag kommt ueber die
     Belohnungs-Warteschlange, und der Claim-Zweig bucht ihn ueber gainResources - dort haengt der
     Lagerdeckel. Wer ihn hier zusaetzlich addierte, verdoppelte ihn; wer `state.resources` direkt
     anfasste, umginge den Deckel. Beides saehe im Spiel zunaechst richtig aus. */
  check('0b: die Abholfunktion bucht den Ertrag NICHT selbst',
    !/state\.resources/.test(rumpf) && !/gainResources\(/.test(rumpf) && !/\bpay\(/.test(rumpf),
    { rumpfAuszug: rumpf.slice(0, 0) || undefined });
  check('0c: sie loest den Claim aus, statt auf den naechsten Takt zu warten',
    /claimPendingRewards\(\)/.test(rumpf), {});
  /* 0d: backendFetch faengt NICHTS ab - `await fetch(...)` wirft bei einem Netzfehler. Ohne
     `.catch` flaege die Rueckweisung ungefangen aus der Funktion: keine Meldung, kein Neuladen,
     und das Kartenmenue ist beim Klick schon geschlossen. Der Spieler saehe gar nichts.
     GEMESSEN am 05.09.2026: ALLE zwoelf Vorposten-Aktionen behandeln das - acht per `try`, vier
     per `.catch(() => null)`. Diese hier war die einzige Ausnahme, gefunden von der Durchsicht. */
  check('0d: der Netzfehler wird gefangen - wie an jeder anderen Vorposten-Aktion',
    /backendFetch\('\/vorposten\/lager\/holen'[^\n]*\.catch\(/.test(rumpf) || /try\s*\{/.test(rumpf),
    { auszug: (rumpf.match(/backendFetch\([^\n]{0,40}/) || [])[0] });
}

const now = Date.now();
const STUNDEN = 12;
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s,
  garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, werft:0, markt:0, lager:1200*s, kosten:{ erz:1000 } }));
function vp(over){
  return Object.assign({ id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now-86400000,
    stufe:8, name:'Orbitalfeste', zweig:'handel', zweigName:'Handelsknoten', maxStufe:8,
    kern:{ lp:6000000, lpMax:6500000 }, verteidigung:850000, garnisonAnzahl:0, garnisonMax:14000, garnison:{},
    schutzBis:0, ausbauAb: now-1000, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
    slots:0, module:[], modulBoni:null, projekte:[], projektBoni:null, projektLaeuft:null, projektMoeglich:[],
    naechsteStufe:null, anflug:[],
    nutzen:{ flug:0.30, prod:0.13, scan:5, werft:0, markt:0, flugDeckel:0.5 },
    lager:{ erz:84375, kristalle:28125, deuterium:22500 },
    lagerRate:{ erz:28125, kristalle:9375, deuterium:7500 },
    lagerVollAb: now + 9 * 3600 * 1000 }, over || {});
}
/* `slotsVoll` fuellt die Flottenslots. Gebraucht seit VP-1 (08.09.2026): Die abgeholte Fracht
   fliegt seither als Transportverband nach Hause und wird erst bei der Ankunft gebucht. Abschnitt
   5 misst aber die UEBERGABE der Dock-Schiffe, nicht den Flug - und die geschieht auf beiden Wegen
   durch dieselbe Funktion (vorpostenFrachtBuchen). Mit vollen Slots greift der Rueckfall, der
   sofort bucht, und die drei Pruefungen messen weiter genau das, wofuer sie geschrieben wurden.
   Den Weg ueber den Verband misst tests/test_vorposten_fracht.js (2b: die Schiffe reisen mit und
   kommen an). Die Alternative - hier auf einen echten Flug warten - haette den Test um Minuten
   verlaengert und dieselbe Zusage ein zweites Mal geprueft. */
function spielstand(slotsVoll){
  const missionen = [];
  if (slotsVoll) for (let i = 0; i < 8; i++)
    missionen.push({ id: 7000+i, type:'explore', targetId:'thessa', startTime: now, endTime: now + 9e6, composition:{ spaeher: 1 } });
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, spaeher:20, missions: missionen },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5000, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}

(async () => {
  const browser = await starteBrowser();
  async function messe(vpDoc, opt){
    opt = opt || {};
    const ctx = await browser.newContext({ viewport:{ width:1280, height:1000 } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    let schreibZaehler = 0;
    const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }),
      /* `kepler7-save-v3` - der Schluessel, den das Spiel wirklich liest (`STORE_KEY`). Hier stand
         `v1`: Die Vorlage kam damit NIE an, und jede Pruefung, die an Rohstoffen, Flotte oder
         Gebaeuden haengt, mass den Startzustand statt der Vorlage - still gruen aus dem falschen
         Grund. Gemessen und behoben am 05.09.2026. */
      'kepler7-save-v3': spielstand(opt.slotsVoll) };
    await page.route('**/api/**', async r => {
      const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
      const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
      if (p === 'health') return j({ ok:true });
      if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
      if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:[] });
      if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:0, abklingMs:0,
        ausbauMs:43200000, garnisonFaktor:0.5, stufen:STUFEN,
        zweige:[{ key:'handel', name:'Handelsknoten', kurz:'Verdient.', namen:{8:'Sternenmarkt'}, mult:{} }],
        zweigAb:4, maxStufe:8, modulDefs:[], modulSeltenheiten:{}, modulBaubar:['gewoehnlich'],
        modulAusbauKosten:250, modulBauAbklingMs:0, modulBestand:{}, modulBauAb:0,
        projektDefs: opt.projektDefs || [], projekteAktiv: !!opt.projektDefs, flugDeckel:0.5,
        lagerAktiv:true, lagerStunden:STUNDEN,
        /* ABSICHTLICH NICHT die Serverwerte 'cruisers'/24/7. Abschnitt 6 prueft den Text des
           Sternendocks, und der liest `vorpostenCache.dockSchiff/dockStunden/dockMax` MIT
           RUECKFALL auf genau jene drei Zahlen. Stuenden hier dieselben Werte, waere jede
           Erwartung auch dann gruen, wenn der Code den Cache gar nicht anfasst - ein Tippfehler
           im Feldnamen bliebe unbemerkt (Durchsicht 07.09.2026). Abweichende Werte trennen die
           beiden Faelle: Was hier steht, kann NUR ueber den Cache im Text landen.
           Die Paritaet der Rueckfallzahlen gegen VP_DOCK_* prueft test_vorposten_paritaet.js. */
        ...(opt.dockKonfig || {}),
        liste:[vpDoc], eigene: vpDoc.eigener ? 1 : 0 });
      if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
      if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
      if (p === 'players-map') return j({ players:[] });
      /* Die Messvorrichtung fuer Abschnitt 5: die vorgemerkte Belohnung GENAU EINMAL - so wie der
         echte Server, der den Eintrag beim Abholen mit shift() entfernt. Ohne das "genau einmal"
         liefe der Claim-Takt in eine Endlosgutschrift und die Flotte waere am Ende beliebig gross;
         die Pruefung wuerde dann nicht die Gutschrift messen, sondern die Zahl der Takte. */
      if (p === 'pending-rewards/claim'){
        if (opt.belohnung && !st.__geliefert){ st.__geliefert = 1; return j({ reward: opt.belohnung }); }
        return j({ reward:null });
      }
      if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
      if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]);
        return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
      if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8));
        /* GEZAEHLT WIRD JEDES SCHREIBEN DES SPIELSTANDS. Ohne diesen Zaehler kann der 5-Anker gar
           nicht rot werden: `st` ist mit der Vorlage VORBELEGT, ein Lauf ohne einen einzigen PUT
           liefert also dieselbe Flotte zurueck wie ein Lauf, in dem der Zweig nichts gebucht hat -
           `flotte` ist nie null, `cruisers` immer eine Zahl. Der Anker haette „save() wurde
           gerufen" behauptet und in Wahrheit nur belegt, dass die Vorlage noch da ist
           (Durchsicht 07.09.2026). */
        if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){}
          if (k === 'kepler7-save-v3') schreibZaehler++;
          return j({ ok:true }); }
        return st[k] === undefined ? j({ error:'nix' }, 404) : j({ value: st[k] }); }
      return j({ ok:true });
    });
    /* DIE MELDUNG WIRD MITGESCHNITTEN, NICHT AM ENDE ABGELESEN. Ein erster Entwurf las das
       Log-Fenster nach dem Lauf aus - da stand laengst die Fernaufklaerung drin, die Meldung ueber
       das Dock war weggerollt. Genau davor warnt die Hausregel: bei transienten Meldungen den
       Ereignisverlauf messen, nicht den spaeteren DOM-Endzustand. Der Beobachter haengt sich vor
       dem Spielcode ein, weil die Belohnung schon beim Hochfahren abgeholt wird. */
    await page.addInitScript(() => {
      localStorage.setItem('kepler7_token', 'tok'); window.confirm = () => true;
      window.__logMit = [];
      document.addEventListener('DOMContentLoaded', () => {
        const l = document.getElementById('log');
        if (!l) return;
        new MutationObserver(ms => {
          for (const m of ms) for (const n of m.addedNodes)
            window.__logMit.push((n.textContent || '').replace(/\s+/g, ' ').trim());
        }).observe(l, { childList: true, subtree: true });
      });
    });
    await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
    await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(id => { const n = document.getElementById(id); if (n) n.style.display = 'none'; }));
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await page.waitForTimeout(600);
    await oeffneSystemUeberSektoren(page, SYS);
    await page.waitForTimeout(1000);
    await page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    /* Auf das Menue warten, nicht auf die Uhr (Lehre aus test_vorposten_werft_ui, docs/TESTING.md).
       DER SELEKTOR IST `.kmenu` - openKarteMenu haengt genau dieses Element an document.body.
       Der erste Entwurf suchte `.map-menu, #mapMenu, [data-map-menu]`, fand nichts und wich auf
       document.body aus. Damit mass er den TEXTINHALT DER GANZEN SEITE - und der enthaelt den
       <script>-Block, also den Quelltext samt `label:'Lager abholen'`. Pruefung 3a war dadurch
       gruen, ohne dass ein Menue existierte, und 3b/3c fielen aus demselben Grund.
       Genau davor warnt die Hausregel „Selektoren in Tests auf den tatsaechlich geprueften
       Container begrenzen". Ein Rueckfall auf document.body ist hier kein Notnagel, sondern der
       sichere Weg zu einer Pruefung, die nichts belegt - deshalb gibt es ihn nicht mehr. */
    await page.waitForFunction(() => {
      const m = document.querySelector('.kmenu');
      return m && /Vorposten/.test(m.textContent || '');
    }, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
    const g = await page.evaluate(() => {
      const m = document.querySelector('.kmenu');
      if (!m) return { text: null, lagerZeile: null, lagerErz: null, dockZeile: null, dockAnz: null };
      const zeile = m.querySelector('[data-vp-lager]');
      const dz = m.querySelector('[data-vp-dock]');
      return { text: (m.textContent || '').replace(/\s+/g, ' ').trim(),
        lagerZeile: zeile ? (zeile.textContent || '').replace(/\s+/g, ' ').trim() : null,
        lagerErz: zeile ? Number(zeile.getAttribute('data-vp-lager')) : null,
        dockZeile: dz ? (dz.textContent || '').replace(/\s+/g, ' ').trim() : null,
        dockAnz: dz ? Number(dz.getAttribute('data-vp-dock')) : null };
    });
    /* Die Flotte wird aus dem GESPEICHERTEN Spielstand gelesen, nicht aus dem DOM: `state` liegt
       in der IIFE des Spiels und ist von aussen nicht erreichbar - und der Umweg ueber die
       Speicherung belegt zugleich, dass der Zweig sein save() wirklich gerufen hat (Regel 73).
       Kommt nichts an, bleibt `flotte` null und Abschnitt 5 sagt das, statt still zu vergleichen. */
    /* Abschnitt 6 braucht ein ZWEITES Fenster: die Wirkungstexte stehen nicht im Kartenmenue,
       sondern im Projekt-Overlay dahinter. Geklickt wird der Menueeintrag, nicht die Funktion -
       `vpProjektWirkungText` liegt in der IIFE des Spiels und ist von aussen unerreichbar, und
       genau deshalb misst nur dieser Weg auch, dass sie von DORT aus aufrufbar ist. Waere
       `shipDefOrSuper` ausser Reichweite, stuende hier ein ReferenceError statt eines Textes. */
    let projektText = null;
    if (opt.projektDefs){
      await page.evaluate(() => {
        const m = document.querySelector('.kmenu');
        if (!m) return;
        for (const b of m.querySelectorAll('[data-kmenu-i]'))
          if (/Projekte/.test(b.textContent || '')){ b.click(); return; }
      });
      await page.waitForFunction(() => {
        const o = document.getElementById('vorpostenProjektOverlay');
        return o && (o.textContent || '').length > 40;
      }, null, { timeout: 15000 }).catch(() => {});
      projektText = await page.evaluate(() => {
        const o = document.getElementById('vorpostenProjektOverlay');
        return o ? (o.textContent || '').replace(/\s+/g, ' ').trim() : null;
      });
    }
    let flotte = null;
    try { flotte = (JSON.parse(st['kepler7-save-v3'] || '{}') || {}).fleet || null; } catch (e) {}
    const logMit = await page.evaluate(() => (window.__logMit || []).slice()).catch(() => []);
    const logText = (logMit || []).join(' | ');
    await ctx.close();
    return { ...g, errs, flotte, logText, logMit, projektText, schreibZaehler };
  }

  /* Abschnitt 5 (V6, 07.09.2026): Das Sternendock haengt am SELBEN Griff wie das Lager - der
     Server legt seine fertigen Kreuzer als `schiffe` in dieselbe Belohnung. Bis zu diesem Auftrag
     las der Lager-Zweig nur erz/kristalle/deuterium; die Schiffe waeren beim Abholen ersatzlos
     verfallen, weil die Belohnung danach aus der Warteschlange geraeumt wird. Genau so ist beim
     Abbau schon einmal eine ganze Garnison verschwunden.
     GEMESSEN WIRD DIE GUTSCHRIFT, nicht der Quelltext: 12 Kreuzer im Ausgangsstand, drei aus dem
     Dock, also 15 im gespeicherten Spielstand. */
  const dock = await messe(vp(), { slotsVoll: true, belohnung: { type:'vorposten-lager', system:SYS, name:'Handelsposten',
    erz: 1000, kristalle: 0, deuterium: 0, schiffe: { cruisers: 3 } } });
  const eigen = await messe(vp());
  const fremd = await messe(vp({ eigener:false, besitzer:'u-fremd', besitzerName:'Nachbar' }));
  const voll  = await messe(vp({ lagerVollAb: now - 60000 }));
  const leer  = await messe(vp({ lager:{ erz:0, kristalle:0, deuterium:0 }, lagerVollAb: now + 12*3600*1000 }));
  /* Schluessel, Namen, Zweige und Wirkungen sind die des Servers (server.js, VP_ENDPROJEKTE) -
     eine Kopie-Familie. Ein erster Entwurf hatte `zweig:'militaer'` (den es im Spiel gar nicht
     gibt; die drei heissen werft/handel/festung) und `name:'Sperrfeuer'` statt
     `Sperrfeuerleitstand` - gerendert wurde damit ein Zustand, den das echte Spiel nie erzeugt. */
  const PROJ = [
    { key:'sternendock',  name:'Sternendock',          icon:'ti-anchor', stufeAb:8, zweig:'werft',   dauerMs:129600000, kosten:{ erz:1000 }, wirkung:{ werftSchiff: 1 },  desc:'' },
    { key:'sternenmarkt', name:'Sternenmarkt',         icon:'ti-basket', stufeAb:8, zweig:'handel',  dauerMs:129600000, kosten:{ erz:1000 }, wirkung:{ marktPlaetze: 2 }, desc:'' },
    { key:'sperrfeuer',   name:'Sperrfeuerleitstand',  icon:'ti-shield', stufeAb:8, zweig:'festung', dauerMs:129600000, kosten:{ erz:1000 }, wirkung:{ verlust: 0.08 },   desc:'' }
  ];
  const DOCK_KONFIG = { dockSchiff:'bomber', dockStunden:6, dockMax:3 };
  const proj = await messe(vp(), { projektDefs: PROJ, dockKonfig: DOCK_KONFIG });

  /* Abschnitt 7: DIE HAELFTE, DIE FEHLTE. `dockBereit` kam vom Server an jeden Client und wurde
     im Spiel nirgends gelesen (`grep -c dockBereit` war 0). Beide Laeufe hier haben ein LEERES
     Lager - genau der Zustand, in dem der alte Griff `vorpostenCache.lagerAktiv &&
     !vorpostenLagerLeer(v)` den Eintrag verschwinden liess und ein volles Dock unerreichbar war.
     `leerLager` ist deshalb nicht Beiwerk, sondern der Kern der Messung. */
  const leerLager = { lager:{ erz:0, kristalle:0, deuterium:0 }, lagerVollAb: now + 12*3600*1000 };
  const dockKonf2 = { dockSchiff:'cruisers', dockStunden:24, dockMax:3 };
  const dockTeil = await messe(vp({ ...leerLager, dockBereit:2, dockSchiff:'cruisers' }), { dockKonfig: dockKonf2 });
  const dockVoll = await messe(vp({ ...leerLager, dockBereit:3, dockSchiff:'cruisers' }), { dockKonfig: dockKonf2 });

  /* 5c: der unbekannte Schiffsschluessel. Der Server liefert einen Typ, den diese Spielversion
     nicht kennt - der Normalfall unserer Auslieferungsreihenfolge (Backend zuerst live). Vorher
     wurde er still verschluckt, und weil das Lager gleichzeitig leer war, behauptete die Meldung
     sogar „es war leer". Der Ertrag ist zu diesem Zeitpunkt beim Server schon geshiftet. */
  /* `slotsVoll` wie beim Dock-Lauf: Seit VP-1 fliegt die Fracht als Transportverband nach Hause,
     und die Meldung ueber den unbekannten Schiffstyp entsteht erst bei der BUCHUNG. Mit vollen
     Slots greift der Rueckfall, der sofort bucht - dieselbe Funktion, dieselbe Meldung. */
  const fremdSchiff = await messe(vp(), { slotsVoll: true, belohnung: { type:'vorposten-lager', system:SYS, name:'Handelsposten',
    erz: 0, kristalle: 0, deuterium: 0, schiffe: { gibtesnichtmehr: 2 } } });

  /* Der Anker verlangt ein ECHTES Menue: `text` ist null, wenn `.kmenu` fehlt, und die Laenge
     liegt bei einem Kartenmenue in den Hunderten - nicht in den Millionen wie bei der ganzen
     Seite. Beides zusammen schliesst den Rueckfall aus, an dem der erste Entwurf scheiterte. */
  check('1-anker: das Kartenmenue selbst wurde in allen vier Laeufen gezeichnet',
    [eigen, fremd, voll, leer].every(x => typeof x.text === 'string' && x.text.length > 40 && x.text.length < 20000),
    { laengen: [eigen, fremd, voll, leer].map(x => x.text === null ? null : x.text.length) });
  check('1a: der Lagerstand steht auch an einem FREMDEN Vorposten - er ist offen sichtbar',
    fremd.lagerErz === 84375 && /Lager:/.test(fremd.lagerZeile || ''),
    { erz: fremd.lagerErz, zeile: fremd.lagerZeile });
  check('1b: solange Platz ist, steht da, wann es voll wird',
    /voll in /.test(eigen.lagerZeile || '') && !/· voll –/.test(eigen.lagerZeile || ''),
    { zeile: eigen.lagerZeile });
  check('2a: am Deckel steht „voll" und dass Weiteres verfaellt',
    /voll/.test(voll.lagerZeile || '') && /verfällt/.test(voll.lagerZeile || '') && !/voll in /.test(voll.lagerZeile || ''),
    { zeile: voll.lagerZeile });
  check('3a: der Abhol-Eintrag steht im Menue des eigenen Vorpostens',
    /Lager abholen/.test(eigen.text), { auszug: eigen.text.slice(0, 160) });
  check('3b: und fehlt, wenn das Lager leer ist',
    !/Lager abholen/.test(leer.text) && leer.lagerZeile === null,
    { zeile: leer.lagerZeile, auszug: leer.text.slice(0, 160) });
  check('3c: und fehlt am fremden Vorposten',
    !/Lager abholen/.test(fremd.text), { auszug: fremd.text.slice(0, 160) });
  const alle = [...eigen.errs, ...fremd.errs, ...voll.errs, ...leer.errs];
  check('4a: kein JavaScript-Fehler in den vier Durchlaeufen', alle.length === 0, alle.slice(0, 3));

  await browser.close();
  /* ---- 5) Die Kreuzer des Sternendocks ------------------------------------------------------- */
  check('5-anker: der Lauf mit der Dock-Belohnung hat den Spielstand wirklich GESCHRIEBEN',
    dock.schreibZaehler > 0 && !!(dock.flotte && typeof dock.flotte.cruisers === 'number'),
    { puts: dock.schreibZaehler, cruisers: dock.flotte ? dock.flotte.cruisers : null, fehler: dock.errs.slice(0, 2) });
  /* Der Dock-Lauf war der einzige ohne Fehlerpruefung - 4a deckt nur die vier Menuelaeufe ab.
     Ein ReferenceError im neuen Zweig haette dort nur als Beiwerk eines fallenden Ankers gestanden. */
  check('5-anker2: kein JavaScript-Fehler im Dock-Lauf', dock.errs.length === 0, dock.errs.slice(0, 3));
  check('5a: die drei Kreuzer aus dem Sternendock sind in der Flotte angekommen',
    !!dock.flotte && dock.flotte.cruisers === 15,
    { erwartet: 15, gemessen: dock.flotte ? dock.flotte.cruisers : null, ausgangsstand: 12 });
  /* Und der Spieler ERFAEHRT es. Eine stille Gutschrift waere fast so schlecht wie keine: Wer
     nicht sieht, dass das Dock geliefert hat, baut es kein zweites Mal. */
  /* EINE Meldung muss alles sagen, nicht der Join ueber alle. Der erste Entwurf prueft `logText`
     - dort duerften „Sternendock" und „3x" aus zwei verschiedenen Eintraegen stammen, und der
     Schiffsname wurde gar nicht geprueft: „aus dem Sternendock: 3x <irgendwas>" waere gruen
     geblieben (Durchsicht 07.09.2026). Gesucht wird deshalb der EINE Eintrag, der alles traegt. */
  const dockMeldung = (dock.logMit || []).find(t => /Sternendock/.test(t)) || '';
  check('5b: EINE Meldung nennt Sternendock, Anzahl, Schiffsnamen und Landeort',
    /Sternendock/.test(dockMeldung) && /3\s*\u00d7\s*Kreuzer/.test(dockMeldung) && /auf Heimatbasis/.test(dockMeldung),
    { meldung: dockMeldung.slice(0, 240) });

  /* Abschnitt 6 (V6, 07.09.2026): DIE DREI ENDPROJEKTE TRAGEN KEINEN ANTEIL.
     `vpProjektWirkungText` faellt fuer jeden unbekannten Schluessel in den Prozent-Zweig. Ohne
     eigene Zweige stuende im Projektfenster „+100 % werftSchiff", „+200 % marktPlaetze" und
     „+8 % verlust" - drei Zahlen, von denen keine stimmt: `werftSchiff: 1` ist eine STUECKZAHL je
     Zeitraum, `marktPlaetze: 2` sind zwei PLAETZE, und `verlust: 0.08` sind acht PROZENTPUNKTE
     auf den Grundverlust des Angreifers.
     GEMESSEN WIRD DAS GERENDERTE FENSTER, nicht der Quelltext - Abschnitt 13 der Paritaetsdatei
     tut Letzteres bereits. Dieser Weg belegt zusaetzlich, dass `shipDefOrSuper` von dort aus
     ueberhaupt erreichbar ist: waere es das nicht, stuende hier ein ReferenceError statt eines
     Textes, und der Anker faenge das ab.
     Die Wirkungswerte sind die des Servers (server.js, VP_ENDPROJEKTE) - eine Kopie-Familie. */
  const pt = proj.projektText || '';
  check('6-anker: das Projektfenster wurde gezeichnet und nennt alle drei Endprojekte',
    /Sternendock/.test(pt) && /Sternenmarkt/.test(pt) && /Sperrfeuer/.test(pt) && pt.length < 20000,
    { laenge: pt.length, auszug: pt.slice(0, 200), fehler: proj.errs.slice(0, 2) });
  check('6a: das Sternendock nennt Schiff, Takt und Stapel AUS DEM CACHE - keine Prozentzahl',
    /1 Bomber je 6 Stunden, bis zu 3 gestapelt/.test(pt) && !/% werftSchiff/.test(pt)
      && !/Kreuzer|24 Stunden|bis zu 7/.test(pt),
    { auszug: (pt.match(/Sternendock.{0,80}/) || [])[0], geschickt: DOCK_KONFIG });
  check('6b: der Sternenmarkt nennt zwei Angebotsplaetze - keine Prozentzahl',
    /\+2 Angebotsplätze an der Modulbörse/.test(pt) && !/% marktPlaetze/.test(pt),
    { auszug: (pt.match(/Sternenmarkt.{0,80}/) || [])[0] });
  check('6c: das Sperrfeuer nennt Prozentpunkte, nicht Prozent',
    /\+8 Prozentpunkte Verlust für jeden Angreifer/.test(pt) && !/\+8 % verlust/.test(pt),
    { auszug: (pt.match(/Sperrfeuer.{0,80}/) || [])[0] });
  check('6d: kein JavaScript-Fehler im Projektfenster', proj.errs.length === 0, proj.errs.slice(0, 3));

  /* ---- 5c) Ein Schiffstyp, den diese Version nicht kennt ------------------------------------- */
  check('5c: ein unbekannter Schiffstyp wird gemeldet statt still verschluckt',
    (fremdSchiff.logMit || []).some(t => /Sternendock/.test(t) && /noch nicht kennt/.test(t))
      && !(fremdSchiff.logMit || []).some(t => /Sternendock/.test(t) && /es war leer/.test(t)),
    { meldung: ((fremdSchiff.logMit || []).find(t => /Lager deines Vorpostens/.test(t)) || '').slice(0, 240) });

  /* ---- 7) Das Sternendock ist sichtbar und erreichbar ---------------------------------------- */
  check('7-anker: beide Dock-Laeufe haben ein echtes Kartenmenue gezeichnet',
    [dockTeil, dockVoll].every(x => typeof x.text === 'string' && x.text.length > 40 && x.text.length < 20000)
      && dockTeil.errs.length === 0 && dockVoll.errs.length === 0,
    { laengen: [dockTeil, dockVoll].map(x => x.text === null ? null : x.text.length),
      fehler: [...dockTeil.errs, ...dockVoll.errs].slice(0, 2) });
  check('7a: der Dockstand steht im Info-Block - Anzahl und Schiffsname',
    dockTeil.dockAnz === 2 && /Sternendock:/.test(dockTeil.dockZeile || '') && /Kreuzer/.test(dockTeil.dockZeile || ''),
    { anzahl: dockTeil.dockAnz, zeile: dockTeil.dockZeile });
  check('7b: solange Platz ist, steht dabei, wieviel hineinpasst',
    /von 3/.test(dockTeil.dockZeile || '') && !/voll/.test(dockTeil.dockZeile || ''),
    { zeile: dockTeil.dockZeile });
  /* Der Deckel ist kein Schoenheitsfehler: `vorpostenDockStand` kappt hart bei dockMax, und
     `dockSeit` wird beim Abholen nur bis zum Deckel zurueckgerechnet. Wer sein Dock stehen laesst,
     verliert Schiffe - und erfuhr es bis hierher nirgends. */
  check('7c: am Deckel steht „voll" und dass Weiteres verfaellt',
    /voll/.test(dockVoll.dockZeile || '') && /verfällt/.test(dockVoll.dockZeile || '') && !/von 3/.test(dockVoll.dockZeile || ''),
    { zeile: dockVoll.dockZeile });
  /* DIE WICHTIGSTE PRUEFUNG DIESES ABSCHNITTS. Beide Laeufe haben ein leeres Lager. Haengt der
     Griff wieder allein an `vorpostenLagerLeer`, faellt genau diese Zeile - und die Schiffe sind
     unerreichbar, so wie es die Belohnung vor diesem Auftrag war. */
  check('7d: der Abhol-Eintrag steht da, obwohl das Lager LEER ist',
    /Sternendock abholen/.test(dockTeil.text), { auszug: (dockTeil.text.match(/.{0,60}abholen.{0,60}/) || [])[0] });
  check('7e: und bei leerem Lager UND leerem Dock steht er nicht da',
    !/abholen/.test(leer.text), { auszug: leer.text.slice(0, 120) });

  ende();
})();

/* GEGENPROBE, vier Richtungen gemessen am 05.09.2026 (Pruefnamen beider Laeufe per `diff`
   verglichen). Jeweils NUR die Spieldatei angefasst.

   A) Die Lagerzeile aus dem Info-Block entfernt: 1a, 1b und 2a FALLEN.
   C) Die Bedingung `!vorpostenLagerLeer(v)` aus dem Menueeintrag entfernt: 3b FAELLT - der Knopf
      erschiene dann auch ueber einem leeren Lager und antwortete „hier liegt noch nichts".
   E) `claimPendingRewards()` durch eine eigene Buchung ersetzt: 0b UND 0c FALLEN. Das ist der
      teuerste denkbare Fehler dieser Etappe: Der Ertrag kaeme doppelt (einmal hier, einmal aus
      der Warteschlange) und umginge dabei den Lagerdeckel.
   G) Den Endpunkt-Pfad verbogen: 0a FAELLT - und mit ihm der 0-Anker, der dann sagt, dass 0b und
      0c nichts mehr messen. Genau dafuer steht er da.
   H) Das `.catch(() => null)` am Abhol-Aufruf entfernt: 0d FAELLT.

   DER EIGENE TESTFEHLER, der diese Datei fast wertlos gemacht haette: Der erste Entwurf suchte das
   Kartenmenue unter `.map-menu, #mapMenu, [data-map-menu]` - keiner dieser Selektoren existiert -
   und wich auf `document.body` aus. Gemessen wurde damit der Textinhalt der GANZEN SEITE, und der
   enthaelt den <script>-Block, also den Quelltext samt `label:'Lager abholen'`. Pruefung 3a war
   gruen, ohne dass ein Menue existierte; 3b und 3c fielen aus demselben Grund.
   Der Container heisst `.kmenu` (openKarteMenu haengt genau ihn an document.body). Der Anker
   misst seitdem auch die LAENGE: ein Kartenmenue hat einige hundert Zeichen, die ganze Seite
   5,7 Millionen. Ein Rueckfall auf document.body ist kein Notnagel, sondern der sichere Weg zu
   einer Pruefung, die nichts belegt - deshalb gibt es ihn nicht mehr.

   UND EIN ZWEITER MESSFEHLER, diesmal beim Nachpruefen eines fremden Befunds: Die Durchsicht
   meldete die ungefangene Rueckweisung „wie es die Nachbar-Aktionen machen". Meine erste
   Gegenmessung suchte nur nach `try {` und meldete FUENF weitere Funktionen mit derselben Luecke -
   also keinen Praezedenzfall. Das war falsch: Die zweite Form ist `.catch(() => null)` direkt am
   Aufruf, und mit ihr behandeln ALLE zwoelf Vorposten-Aktionen den Fall (acht per `try`, vier per
   `.catch`). Meine neue war die einzige Ausnahme. Wer eine Regel misst, muss BEIDE Schreibweisen
   kennen, sonst widerlegt er einen richtigen Befund mit einer zu engen Suche.

   V6 (07.09.2026), Abschnitte 5, 6 und 7, gemessen gegen `git show origin/main:weltraum_kolonie.html`
   (Pruefnamen beider Laeufe per `diff` verglichen - einziger Unterschied ist die Schlusszeile):
   5a FAELLT dort mit `gemessen: 12` gegen `erwartet: 15` - die drei Kreuzer des Sternendocks
   waeren beim Abholen ersatzlos verfallen, weil die Belohnung nach dem Zweig aus der
   Warteschlange geraeumt wird. 5b FAELLT, die Meldung nennt das Dock nicht. Der 5-Anker bleibt
   GRUEN: Der Lauf hat gespeichert, die Messung ist also echt und nicht nur ausgefallen.
   6a, 6b und 6c FALLEN dort ebenfalls; im Fenster stuende „+100 % werftSchiff", „+200 %
   marktPlaetze" und „+8 % verlust". Der 6-Anker bleibt GRUEN - das Fenster wird gezeichnet, nur
   sein Inhalt ist falsch. Genau diese Haelfte-gruen/Haelfte-rot-Aufteilung ist der Beweis, dass
   die Anker messen und nicht bloss mitfallen.

   ZWEITE RUNDE, aus der adversarischen Durchsicht desselben Aenderungssatzes (07.09.2026). Drei
   Befunde betrafen DIESE DATEI, nicht die Spieldatei:

   1) DER 5-ANKER KONNTE GAR NICHT ROT WERDEN. `st` ist mit der Vorlage vorbelegt, und der Anker
      las genau diesen Schluessel. Ein Lauf ohne einen einzigen PUT liefert damit dieselbe Flotte
      wie ein Lauf, in dem der Zweig nichts gebucht hat: `flotte` nie null, `cruisers` immer eine
      Zahl. Der Kommentar behauptete „belegt zugleich, dass der Zweig sein save() gerufen hat" -
      das war falsch. Gezaehlt werden jetzt die PUTs auf `kepler7-save-v3`; die Gegenprobe misst
      dort `puts: 6` bei `cruisers: 12`, also ein echtes Schreiben OHNE Buchung. Das ist der
      Unterschied, den der alte Anker nicht sehen konnte.
   2) ABSCHNITT 6 MASS NUR DEN RUECKFALL. Die Fixture schickte `dockSchiff/dockStunden/dockMax`
      gar nicht, und der Code faellt dann auf 'cruisers'/24/7 zurueck - genau die Werte, die 6a
      erwartete. Ein Tippfehler in einem der drei Cache-Namen waere gruen geblieben. Die Fixture
      schickt jetzt ABWEICHENDE Werte (bomber/6/3), die nur ueber den Cache im Text landen koennen;
      die Paritaet der Rueckfallzahlen gegen VP_DOCK_* prueft test_vorposten_paritaet.js, 14a.
   3) 5B KONNTE QUER UEBER MELDUNGEN GREIFEN. Geprueft wurde der Join ALLER Log-Eintraege -
      „Sternendock" und „3x" durften aus zwei verschiedenen stammen, und der Schiffsname wurde gar
      nicht geprueft. Gesucht wird jetzt der EINE Eintrag, der alles traegt.

   Neu dazu, ebenfalls beide Richtungen gemessen:
   5c FAELLT am alten Stand mit der Meldung „ist eingetroffen - es war leer." - der unbekannte
      Schiffstyp wurde still verschluckt, und die Meldung log dabei.
   7a bis 7d FALLEN am alten Stand (`anzahl: null`, `zeile: null`): `dockBereit` hatte im Spiel
      keinen einzigen Leser, und der Abhol-Eintrag hing allein am Lager - bei leerem Lager waren
      die fertigen Schiffe unerreichbar.
   7-anker und 7e bleiben dort GRUEN. Der Anker, weil das Kartenmenue gezeichnet wird und nur sein
   Inhalt fehlt; 7e, weil ein Eintrag bei leerem Lager UND leerem Dock auch vorher nicht da war -
   die Pruefung schuetzt die Gegenrichtung, nicht dieselbe. */
