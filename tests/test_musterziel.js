// KB-29: Der angeschlossene Verband nennt sein Ziel - und fuehrt zu ihm.
//
//   node tests/test_musterziel.js
//
// SPIELER-REPORT Sascha (08.09.2026, zwei Screenshots): In der Flottenposition stand
// „Musterangriff auf [?] · 913 Schiffe", in den Allianz-Nachrichten „Koordinierter Angriff gegen
// [null] gestartet!" und „gegen [undefined] erfolgreich", und die Ankuendigung schrieb „das
// Alien-Nest der Die Verglühten bei sys_halvar_weite".
//
// DIE URSACHE IST EINE EINZIGE: Seit Phase 5 kann ein Verband auch ein Nest, eine Festung oder
// einen Vorposten treffen - und bei genau diesen drei ist `targetTag` null. Fuenf Anzeigestellen
// bauten ihren Text trotzdem daraus. `musterZielText` rechnete den richtigen Namen laengst aus,
// nur fragte ihn dort niemand. Dazu zwei Fehler in der Funktion selbst: Sie gab die
// System-KENNUNG statt des Namens aus, und ihr Nest-Zweig lieferte nur den Volksnamen, dem die
// Ankuendigung dann „das Alien-Nest der " voranstellte - bei „Die Verglühten" doppelt.
//
// GEPRUEFT WIRD DIE REGEL:
//   1a  Vorbedingung: Die Zeile des angeschlossenen Verbands steht in der Flottenposition.
//   1b  Sie nennt ein ECHTES Ziel - kein [?], kein [null], kein undefined, und den SYSTEMNAMEN
//       statt der Kennung. Gemessen gegen beides, damit „nicht [?]" nicht schon reicht.
//   1c  Nach dem Abflug zaehlt sie auf den Einschlag herunter (dispatch.arrivalAt), statt
//       „gebunden" zu zeigen.
//   1d  Sie ist anklickbar und traegt System UND Selektor des Ziels.
//   2a  Der Klick oeffnet die Karte im ZIELsystem und setzt dort ein rotes Fadenkreuz.
//   2b  Das Fadenkreuz liegt AUF dem Ziel - gemessen als Abstand zur Nestmitte. Ohne diese
//       Messung waere 2a auch dann gruen, wenn das Kreuz in der Ecke haengt.
//   2c  Ueber dem Kreuz steht die Einschlagszeit, und sie zaehlt (zwei Messungen im Abstand).
//   3a  KOPIE-FAMILIE am Quelltext: KEINE der Verbands-Meldungen baut ihren Zieltext noch aus
//       `targetTag` zusammen. Das ist die Stelle, an der die naechste Zielart wieder auflaufen
//       wuerde, und sie ist im Bild nicht sichtbar (die Nachrichten gehen in den Allianz-Chat).
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor KB-29 setzen und mit
// KEPLER_ZIEL_GEGENPROBE=alt aufrufen. Die MUSS_FALLEN-Liste unten ist GEMESSEN, nicht geraten.
const fsZ = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
/* DIE GEGENPROBE MUSS AUSGEWERTET WERDEN, SONST IST SIE DEKORATION. Der erste Entwurf reichte
   `mussFallen` an `ende()` weiter - das nimmt aber nur eine Aufraeum-Funktion und hat die Liste
   stillschweigend verworfen. Der Lauf sah dann aus wie eine Gegenprobe und war keine: Ob die
   Pflichtliste wirklich gefallen ist, haette nur ein Mensch beim Lesen bemerkt. Deshalb dasselbe
   Muster wie in test_sprungtor_route: jedes Ergebnis unter seiner Nummer mitschreiben und am Ende
   gegen die Liste halten. */
const ergebnis = {};
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const ICH = 'u-ich';
const SYS = 'vega';
const now = Date.now();
const GEGENPROBE = process.env.KEPLER_ZIEL_GEGENPROBE || '';
/* ZWEI VERGLEICHSSTAENDE, beide gemessen:
     alt        = vor KB-29 (4cdf423). Dort steht „[?]", es gibt keinen Klick und kein Fadenkreuz.
     durchsicht = vor den drei Befunden der Durchsicht am PR (ac819d4). Dort gibt es alles,
                  aber: der Selektor traegt keine Kennung (1d/4b), der Besitzername geht ROH in
                  innerHTML (4a - die Einschleusung feuert dort wirklich, gemessen xss:1), und mit
                  ausgeschalteter Ereignis-Ebene meldet der Klick Erfolg und zeigt nichts (4c). */
const MUSS_FALLEN = { alt: ['1b', '1c', '1d', '2a', '2b', '2c', '3a', '4a', '4b', '4c'],
                      durchsicht: ['1d', '4a', '4b', '4c'] };

const QUELLE = fsZ.readFileSync(SPIELDATEI, 'utf8');
// Der Systemname kommt aus der Spieldatei, nicht aus dem Gedaechtnis - sonst prueft 1b gegen einen
// Namen, den es im Spiel gar nicht gibt, und ist still gruen.
const SYSNAME = (QUELLE.match(new RegExp("id:'" + SYS + "',\\s*name:'([^']+)'")) || [])[1];
const VOLKNAME = (QUELLE.match(/verglueht:\s*\{ name:'([^']+)'/) || [])[1];

const MUSTER_ID = 'm-1';
const NEST_ID = 'n-1';
const ANKUNFT = now + 9 * 60 * 1000;

/* `opt` deckt die drei Faelle der Durchsicht ab (08.09.2026):
     zielArt          'alien-nest' (Vorgabe) oder 'vorposten'
     nestId           welches Nest gemeint ist - fuer den Fall mit ZWEI Nestern im System
     besitzerName     der frei gewaehlte Name eines fremden Vorposten-Besitzers
     ebenenAus        die Kartenebene „Ereignisse" steht auf aus */
function spielstand(opt){
  opt = opt || {};
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  const istVp = opt.zielArt === 'vorposten';
  const dok = istVp
    ? { id: MUSTER_ID, zielArt:'vorposten', vorpostenSystem: SYS, vorpostenId:'vp-1',
        vorpostenStufeName:'Sternenwerft', vorpostenBesitzerName: opt.besitzerName || 'Fremder',
        targetTag: null, phase:'enroute', museterEndsAt: now - 30000,
        dispatch:{ arrivalAt: ANKUNFT, totalShips: 913, totalPower: 135800, participantCount: 1 } }
    : { id: MUSTER_ID, zielArt:'alien-nest', nestId: opt.nestId || NEST_ID, nestSystem: SYS,
        nestVolkName: VOLKNAME, targetTag: null, phase:'enroute', museterEndsAt: now - 30000,
        dispatch:{ arrivalAt: ANKUNFT, totalShips: 913, totalPower: 135800, participantCount: 1 } };
  return JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    karteEbenen: opt.ebenenAus ? { ereignisse:false } : {},
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{},
    fleet:{ jaeger:80, cruisers:12, spaeher:6, missions:[] },
    /* DER BEITRAG OHNE `zielText`/`zielOrt` - genau so liegt er bei jedem Spieler, der VOR dieser
       Version beigetreten ist. Damit prueft der Test den Weg ueber das lebende Dokument, nicht den
       bequemen Rueckfall. */
    allianceMusterContribution:{ musterAttackId: MUSTER_ID, targetTag: null,
      composition:{ jaeger: 913 }, power: 135800, originPlanet:'home', joinedAt: now - 60000 },
    allianceMusterAttack: dok,
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' },
    xp:9e5, credits:5e5, buffs:[], lastTick: now, colonyNames:{}, modules:{}, shipModules:{},
    nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5, weeklySystemsSeen:14,
    schubGesehen:true, lastSeenReportTime: now });
}

async function lauf(browser, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }),
               'kepler7-save-v3': spielstand(opt) };
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[],
      /* Bei `zweiNester` steht ein ZWEITES Nest VOR dem gemeinten in der Liste - genau die Lage,
         in der ein Selektor ohne Kennung das falsche trifft. */
      alienNester: (opt.zweiNester ? [{ id:'n-vorne', volk:'kryll', sys: SYS, stufe:2, lp:120000, lpMax:200000,
          seit: now-3600000, letzteReifung: now, beitraege:{}, schlaege:{} }] : []).concat([
        { id: NEST_ID, volk:'verglueht', sys: SYS, stufe:3, lp:260000, lpMax:400000,
          seit: now-3600000, letzteReifung: now, beitraege:{}, schlaege:{} }]),
      controlledSystems:{}, wrackKonvois:[] });
    if (p === 'vorposten') return j({ ok:true, aktiv:false, liste:[] });
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
    if (p === 'players-map') return j({ players:[] });
    if (p === 'pending-rewards/claim') return j({ reward: null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
    return j({ ok:true });
  });
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); window.__xss = 0; });
  await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; }));
  return { ctx, page, errs };
}

(async () => {
  const browser = await starteBrowser();
  const { ctx, page, errs } = await lauf(browser, {});

  // ---- 1) Die Zeile in der Flottenposition -----------------------------------------------------
  const zeile = await page.evaluate(() => {
    const liste = document.getElementById('fleetPositionList');
    if (!liste) return null;
    const treffer = [...liste.querySelectorAll('.fleet-position-item')]
      .find(el => /Musterangriff/.test(el.textContent || ''));
    if (!treffer) return { da:false, alles:(liste.textContent||'').replace(/\s+/g,' ').trim().slice(0,300) };
    return { da:true, text:(treffer.textContent||'').replace(/\s+/g,' ').trim(),
             ziel: treffer.getAttribute('data-fp-vziel'), zeit: treffer.getAttribute('data-fp-vzeit') };
  });
  merke('1a: die Zeile des angeschlossenen Verbands steht in der Flottenposition',
    !!(zeile && zeile.da), zeile);
  const txt = (zeile && zeile.text) || '';
  merke('1b: sie nennt das echte Ziel - Systemname statt Kennung, kein [?]/[null]/undefined',
    !!SYSNAME && !!VOLKNAME && txt.includes(SYSNAME) && txt.includes(VOLKNAME)
    && !/\[\?\]|\[null\]|undefined|\b' + SYS + '\b/.test(txt) && !txt.includes(SYS),
    { text: txt, erwartetSystem: SYSNAME, erwartetVolk: VOLKNAME });
  merke('1c: nach dem Abflug zaehlt sie auf den Einschlag herunter statt "gebunden"',
    /Einschlag in/.test(txt) && !/gebunden/.test(txt), { text: txt });
  /* Der Selektor traegt die KENNUNG des gemeinten Nests, nicht bloss die Art. Das war ein Befund
     der Durchsicht: Ohne sie trifft der Sprung in einem System mit mehreren Nestern immer das
     erste. 4b misst die Wirkung im Bild, 1d haelt die Zusage schon an der Zeile fest. */
  merke('1d: sie ist anklickbar und traegt System UND den Selektor MIT Kennung',
    !!(zeile && zeile.ziel) && zeile.ziel.indexOf('|') > 0
    && zeile.ziel.split('|')[0] === SYS
    && zeile.ziel.split('|')[1] === '[data-map-nest="' + NEST_ID + '"]',
    { ziel: zeile && zeile.ziel, zeit: zeile && zeile.zeit });

  // ---- 2) Der Klick fuehrt zum Ziel, das Fadenkreuz liegt darauf --------------------------------
  await page.evaluate(() => {
    const liste = document.getElementById('fleetPositionList');
    const el = liste && [...liste.querySelectorAll('.fleet-position-item')].find(x => /Musterangriff/.test(x.textContent||''));
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1600);
  const karte = await page.evaluate(() => {
    const tab = document.querySelector('.tab-btn[data-tab="karte"]');
    const kreuz = document.querySelector('[data-karte-fadenkreuz]');
    const nest = document.querySelector('[data-map-nest]');
    const mitte = el => { try { const b = el.getBBox(); return { x: b.x + b.width/2, y: b.y + b.height/2 }; } catch(e){ return null; } };
    const zeitEl = document.querySelector('[data-karte-zielzeit]');
    return {
      aufKarte: !!(tab && tab.classList.contains('active')),
      kreuzDa: !!kreuz, nestDa: !!nest,
      kreuzMitte: kreuz ? mitte(kreuz) : null, nestMitte: nest ? mitte(nest) : null,
      nestGroesse: nest ? (function(){ try { const b = nest.getBBox(); return Math.max(b.width, b.height); } catch(e){ return 0; } })() : 0,
      zeitText: zeitEl ? (zeitEl.textContent||'').trim() : null
    };
  });
  merke('2a: der Klick oeffnet die Karte im Zielsystem und setzt ein Fadenkreuz',
    karte.aufKarte === true && karte.kreuzDa === true && karte.nestDa === true, karte);
  const abstand = (karte.kreuzMitte && karte.nestMitte)
    ? Math.hypot(karte.kreuzMitte.x - karte.nestMitte.x, karte.kreuzMitte.y - karte.nestMitte.y) : null;
  merke('2b: das Fadenkreuz liegt AUF dem Nest, nicht irgendwo im Bild',
    abstand !== null && abstand < Math.max(6, karte.nestGroesse * 0.5),
    { abstand: abstand === null ? null : Number(abstand.toFixed(1)), nestGroesse: Number((karte.nestGroesse||0).toFixed(1)) });
  const zeit1 = karte.zeitText;
  await page.waitForTimeout(2400);
  const zeit2 = await page.evaluate(() => { const e = document.querySelector('[data-karte-zielzeit]'); return e ? (e.textContent||'').trim() : null; });
  merke('2c: ueber dem Kreuz steht die Einschlagszeit, und sie zaehlt',
    !!zeit1 && /Einschlag in/.test(zeit1) && !!zeit2 && zeit2 !== zeit1,
    { vorher: zeit1, nachher: zeit2 });

  // ---- 3) Die Kopie-Familie am Quelltext --------------------------------------------------------
  const JS = QUELLE.match(/<script>([\s\S]*)<\/script>/)[1];
  const rohbau = [
    ["Abflug-Nachricht", /Koordinierter Angriff gegen \['\+fresh\.targetTag\+'\]/],
    ["Ergebnis-Nachricht", /Angriff gegen \['\+targetTag\+'\]/],
    ["Abrechnung", /Koordinierter Angriff gegen \['\+doc\.targetTag\+'\]/],
    ["Rueckzug", /koordinierten Angriff gegen \['\+contrib\.targetTag\+'\]/],
    ["Flottenposition", /Musterangriff auf \['\+\(muster\.targetTag\|\|'\?'\)\+'\]/]
  ].filter(([, re]) => re.test(JS)).map(([name]) => name);
  merke('3a: keine Verbands-Meldung baut ihren Zieltext mehr aus targetTag',
    rohbau.length === 0, { nochRoh: rohbau });

  merke('3b: kein Skriptfehler beim Aufbau', errs.length === 0, { fehler: errs.slice(0,2) });
  await ctx.close();

  /* ---- 4) DIE DREI BEFUNDE DER DURCHSICHT AM PR (08.09.2026) ---------------------------------
     Alle drei waren echt und sind hier je einzeln nachgestellt. */

  // 4a (P1, Sicherheit): Der Zieltext enthaelt bei einem Vorposten den frei gewaehlten Namen
  // seines BESITZERS. Beide Anzeigestellen schreiben per innerHTML.
  const boese = '<img src=x onerror="window.__xss=1">';
  const b1 = await lauf(browser, { zielArt:'vorposten', besitzerName: boese });
  const sicher = await b1.page.evaluate(() => {
    const liste = document.getElementById('fleetPositionList');
    const el = liste && [...liste.querySelectorAll('.fleet-position-item')].find(x => /Musterangriff/.test(x.textContent||''));
    return { xss: window.__xss || 0,
             bilder: liste ? liste.querySelectorAll('img').length : -1,
             text: el ? (el.textContent||'').replace(/\s+/g,' ').trim() : null };
  });
  merke('4a: ein Besitzername mit Markup wird als TEXT gezeigt, nicht ausgefuehrt',
    sicher.xss === 0 && sicher.bilder === 0 && !!sicher.text && sicher.text.indexOf('<img') >= 0,
    sicher);
  await b1.ctx.close();

  // 4b: Zwei Nester im System - das Fadenkreuz muss auf dem GEMEINTEN liegen, nicht auf dem ersten.
  const b2 = await lauf(browser, { zweiNester: true });
  await b2.page.evaluate(() => {
    const liste = document.getElementById('fleetPositionList');
    const el = liste && [...liste.querySelectorAll('.fleet-position-item')].find(x => /Musterangriff/.test(x.textContent||''));
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await b2.page.waitForTimeout(1600);
  const zwei = await b2.page.evaluate((zielId) => {
    const kreuz = document.querySelector('[data-karte-fadenkreuz]');
    const mitte = el => { try { const b = el.getBBox(); return { x: b.x + b.width/2, y: b.y + b.height/2 }; } catch(e){ return null; } };
    const nester = [...document.querySelectorAll('[data-map-nest]')].map(n => ({ id: n.getAttribute('data-map-nest'), m: mitte(n) }));
    const k = kreuz ? mitte(kreuz) : null;
    const ab = (a,b) => (a&&b) ? Math.hypot(a.x-b.x, a.y-b.y) : null;
    const naechstes = nester.map(n => ({ id: n.id, d: ab(k, n.m) })).sort((a,b) => a.d - b.d)[0];
    return { anzahl: nester.length, kreuzDa: !!kreuz, naechstes, zielId,
             abstaende: nester.map(n => ({ id: n.id, d: Number((ab(k, n.m)||999).toFixed(1)) })) };
  }, NEST_ID);
  merke('4b: bei zwei Nestern liegt das Fadenkreuz auf dem gemeinten',
    zwei.anzahl === 2 && zwei.kreuzDa === true && !!zwei.naechstes && zwei.naechstes.id === NEST_ID,
    zwei);
  await b2.ctx.close();

  // 4c: Steht die Ebene „Ereignisse" aus, wird das Nest gar nicht gezeichnet. Der Klick soll das
  // Ziel trotzdem zeigen - und sagen, dass er die Ebene dafuer eingeblendet hat.
  const b3 = await lauf(browser, { ebenenAus: true });
  await b3.page.evaluate(() => {
    window.__log = [];
    const l = document.getElementById('log');
    if (l) new MutationObserver(() => {
      const t = (l.textContent||'').replace(/\s+/g,' ').trim();
      if (t && t !== window.__log[window.__log.length-1]) window.__log.push(t);
    }).observe(l, { subtree:true, childList:true, characterData:true });
    const liste = document.getElementById('fleetPositionList');
    const el = liste && [...liste.querySelectorAll('.fleet-position-item')].find(x => /Musterangriff/.test(x.textContent||''));
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await b3.page.waitForTimeout(1800);
  const aus = await b3.page.evaluate(() => ({
    kreuzDa: !!document.querySelector('[data-karte-fadenkreuz]'),
    nestDa: !!document.querySelector('[data-map-nest]'),
    logs: (window.__log || []).slice()
  }));
  merke('4c: mit ausgeschalteter Ereignis-Ebene erscheint das Ziel trotzdem - und es wird gesagt',
    aus.kreuzDa === true && aus.nestDa === true && aus.logs.some(t => /Ereignisse/.test(t)), aus);
  await b3.ctx.close();

  await browser.close();
  if (GEGENPROBE){
    const soll = MUSS_FALLEN[GEGENPROBE] || [];
    const gefallen = soll.filter(n => ergebnis[n] === false);
    console.log('GEGENPROBE ' + GEGENPROBE + ': ' + gefallen.length + '/' + soll.length + ' der Pflichtliste gefallen (' +
      soll.map(n => n + '=' + (ergebnis[n] === false ? 'rot' : 'gruen')).join(' ') + ')');
    if (gefallen.length !== soll.length){
      console.log('FAIL - Gegenprobe unvollstaendig: ' + soll.filter(n => ergebnis[n] !== false).join(', ') + ' blieben gruen');
      process.exitCode = 1; return;
    }
    process.exitCode = 0; return;
  }
  ende();
})();
