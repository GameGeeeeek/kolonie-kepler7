// KA-1: Das Gefecht auf der Karte (Auftrag Sascha, 07.09.2026, woertlich: „kampf animation auf der
// karte anzeigen wenn ich einen npc nest festung etc angreife auch andere spieler und planeten").
//
//   node tests/test_kampfanimation.js
//
// DER BEFUND, gegen den das gebaut wurde: Die Karte zeigte den Kampf NICHT. Die Flotte flog hin,
// und im naechsten Bild war sie weg - der Moment, in dem die Entscheidung faellt, war der einzige,
// den die Karte nicht hatte.
//
// GEPRUEFT WIRD AM GERENDERTEN SPIEL, nicht am Quelltext, und die REGEL statt einer Momentaufnahme:
//   1. Bei der Ankunft eines Schlages steht ein Gefecht am ZIEL - sichtbar (gemessene Flaeche > 0)
//      und an der Stelle, an der auch die Flugbahn endet (dieselbe Funktion missionMapZiel).
//   2. Es ENDET von selbst. Das ist die Haelfte, die man vergisst: Ein Gefecht, das stehen bleibt,
//      ist schlimmer als keines - es behauptet dauerhaft einen Kampf, den es nicht gibt. Gemessen
//      wird mit vorgestellter Uhr (nur Date.now), nicht mit Warten.
//   3. Es nimmt dem Ziel den Klick NICHT. Das Gefecht liegt ueber dem Marker seines Ziels; ohne
//      pointer-events="none" waere das Nest waehrend des Kampfes nicht mehr antippbar - genau die
//      Fehlerklasse, die GR-11 am Schuerfrecht-Kuerzel hatte.
//   4. DAS GEFECHT HAENGT AN DER ANKUNFT, nicht an der Rueckkehr (4a). `endTime` ist bei jedem
//      Schlag die RUECKKEHR - die Ankunft liegt in der Mitte der Spanne. Der erste Entwurf hing
//      am Ende und haette das Gefecht erst aufblitzen lassen, wenn die Flotte laengst wieder zu
//      Hause landet; der Fixture hier hatte damals so kurze Flugzeiten, dass er das nicht sehen
//      konnte. Gemessen wird deshalb der ABSTAND zur Rueckkehr.
//   5. Eine Mission OHNE Kampf (Kolonisierung) erzeugt KEIN Gefecht. Die Gegenrichtung des Paars:
//      Ohne sie waere die Pruefung auch von einem Zeichner erfuellt, der immer feuert.
//
// GEGENPROBEN (KEPLER_KA1_GEGENPROBE), beide Pflichtlisten gemessen:
//   alt       - der Stand vor KA-1 (origin/main a415efb)
//   rueckkehr - der Haken haengt wieder an endTime statt an der Ankunft (mein erster Entwurf)
const fs = require('fs');
const { starteBrowser, SPIELDATEI, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check: rohCheck, ende } = pruefer();
const ergebnis = {};
const check = (name, bedingung, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bedingung; rohCheck(name, bedingung, zusatz); };

const SAB = process.env.KEPLER_KA1_GEGENPROBE || '';
/* GEMESSEN gegen origin/main a415efb (Stand vor KA-1), nicht geschaetzt. Der erste Entwurf
   dieser Liste war doppelt falsch: 2a und 3a bleiben dort GRUEN, und das ist kein Mangel,
   sondern ihre Aussage - beide pruefen, dass KEIN Gefecht dasteht, und ohne KA-1 steht nie
   eines. Sie belegen also nichts ueber KA-1 und gehoeren nicht in die Pflichtliste; scharf
   werden sie erst am neuen Stand, wo eines dastehen KANN. 1d fiel dagegen mit, weil es das
   Attribut eines Elements liest, das dort gar nicht existiert. */
/* Beide Listen GEMESSEN, nicht geschaetzt.
   `alt`   - origin/main a415efb, der Stand vor KA-1: dort gibt es gar kein Gefecht.
   `rueckkehr` - mein eigener erster Entwurf, bei dem der Haken an `endTime` (der RUECKKEHR) hing
     statt an der Ankunft. Er faellt IDENTISCH zu `alt`, und genau das ist die Aussage: Aus Sicht
     des Spielers war die erste Fassung so gut wie gar keine - zum Zeitpunkt, an dem man hinsieht,
     steht nichts da. Die alte Fassung dieses Tests konnte das nicht sehen, weil ihr Fixture Hin-
     und Rueckflug in 72 Sekunden zusammenfallen liess. */
const MUSS_FALLEN = {
  alt:       ['1a', '1b', '1c', '1d', '4a'],
  rueckkehr: ['1a', '1b', '1c', '1d', '4a']
};

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
const NEST_ID = 'nest-ka1';

function nest(){
  return { id: NEST_ID, volk:'kryll', sys:SYS, stufe:3, lp:260000, lpMax:400000,
    seit: Date.now() - 7200000, letzteReifung: Date.now() - 3600000,
    naechsterWurf: Date.now() + 8*3600*1000, naechsteWanderung: 0, beitraege:{}, schlaege:{} };
}
function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[],
      controlledSystems:{}, factions:{}, alienNester: [nest()] });
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{} } } });
    /* Der Schlag wird BEWUSST langsam beantwortet (2,5 s): So steht das Gefecht sicher noch,
       waehrend gemessen wird - und es belegt zugleich, dass die Anzeige an der ANKUNFT haengt und
       nicht an der Serverantwort. */
    if (p === 'alien/nest-angriff'){
      await new Promise(r2 => setTimeout(r2, 2500));
      return j({ ok:true, schaden:31000, gefallen:false, lp:229000, lpMax:400000,
        trifftSchwaeche:true, schwaeche:'jaeger', volk:'kryll', volkName:'Kryll-Schwarm',
        stufe:3, stufeName:'Schwarmstock', eigeneVerluste:{ jaeger:20 },
        anteil:0, teilnehmer:1, schwarmGefallen:false, mitgerissen:0 });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'reports') return req.method() === 'POST' ? j({ ok:true }) : j({ reports: [] });
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|vorposten/.test(p))
      return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}
async function tab(browser, startSave){
  const store = {};
  if (startSave) store[SAVE_KEY] = startSave;
  const ctx = await browser.newContext({ viewport: { width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
/* Misst das Gefecht im gerenderten SVG: Gibt es eines, ist es sichtbar, und liegt es beim Ziel? */
async function messeGefecht(page){
  return page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    if (!svg) return { svg:false };
    const texte = [...svg.querySelectorAll('text')].filter(t => /GEFECHT/.test(t.textContent||''));
    if (!texte.length) return { svg:true, da:false };
    const b = texte[0].getBoundingClientRect();
    const nestKnoten = svg.querySelector('[data-map-nest]');
    const nb = nestKnoten ? nestKnoten.getBoundingClientRect() : null;
    return { svg:true, da:true, anzahl: texte.length,
      breite: Math.round(b.width), hoehe: Math.round(b.height),
      // Abstand der Gefechtsbeschriftung zur Mitte des Nestmarkers - das Gefecht gehoert ANS ZIEL.
      abstandZumNest: nb ? Math.round(Math.hypot((b.left+b.width/2)-(nb.left+nb.width/2), (b.top+b.height/2)-(nb.top+nb.height/2))) : null,
      pe: texte[0].getAttribute('pointer-events') };
  });
}

(async () => {
  const browser = await starteBrowser();
  try {
    const roh = await tab(browser);
    const basis = roh.stand();
    await roh.ctx.close();
    check('0a: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
    if (!basis.buildings) return;

    /* Der Fixture setzt eine Mission, die GERADE eintrifft: endTime knapp in der Zukunft, damit
       checkMissions sie im normalen Tick abarbeitet. Ein bereits abgelaufenes endTime taete es
       auch, aber dann laege der Beginn des Gefechts vor dem Laden und die Restzeit waere unklar. */
    function fixture(typ){
      const st = JSON.parse(JSON.stringify(basis));
      const jetzt = Date.now();
      st.fleet = Object.assign({}, st.fleet, { jaeger: 200, cruisers: 80, colonyShips: 3 });
      /* EIN ECHTER RUNDFLUG, und das ist seit dem 07.09.2026 der Kern dieser Messvorrichtung.
         `endTime` ist bei einem Schlag die RUECKKEHR, nicht die Ankunft: Die Ankunft liegt in
         der MITTE der Spanne. Der erste Entwurf setzte startTime auf -60 s und endTime auf +12 s
         - bei 72 Sekunden Gesamtdauer fielen Hin- und Rueckflug praktisch zusammen, und der Test
         konnte den Unterschied gar nicht sehen. Genau durch diese Luecke kam der blockierende
         Befund der Durchsicht herein: Der Haken hing an der Rueckkehr, und das Gefecht waere
         erst aufgeblitzt, wenn die Flotte laengst wieder zu Hause landet.
         JETZT: Start weit in der Vergangenheit, Rueckkehr weit in der Zukunft, Ankunft (Mitte)
         rund 14 s nach dem Laden - also nach Boot (3,5 s), Reiter (0,6 s) und Aufklappen (~1,5 s),
         und mit deutlichem Abstand zur Rueckkehr. Abschnitt 4 misst genau diesen Abstand. */
      const HIN = 14000, GESAMT = 600000;   // Ankunft in 14 s, Rueckkehr in 10 Minuten
      st.fleet.missions = [ typ === 'nest'
        ? { id: 9001, type:'nest-angriff', system:SYS, nestId: NEST_ID, fleetName:'1. Flotte',
            startTime: jetzt + HIN - GESAMT/2, endTime: jetzt + HIN + GESAMT/2, composition:{ jaeger: 60 } }
        : { id: 9002, type:'colonize', system:SYS, targetId:'chronos1', fleetName:'Siedler',
            startTime: jetzt - 60000, endTime: jetzt + HIN, composition:{ colonyShips: 1 } } ];
      const fern = jetzt + 365*24*3600*1000;
      for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
      st.activeEvent = null; st.buffs = [];
      return JSON.stringify(st);
    }

    // ---- 1) Der Schlag kommt an ------------------------------------------------------------
    const t1 = await tab(browser, fixture('nest'));
    await t1.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await t1.page.waitForTimeout(600);
    await oeffneSystemUeberSektoren(t1.page, SYS);
    /* Gewartet wird auf das EREIGNIS, nicht auf eine Zahl: Die Ankunft haengt an der Wanduhr des
       Browsers, und ein festes Schlafen misst am Ende Glueck statt Verhalten. */
    let g1 = { da:false };
    for (let i = 0; i < 20 && !g1.da; i++){
      await t1.page.waitForTimeout(1000);
      g1 = await messeGefecht(t1.page);
    }
    check('1a: bei der Ankunft steht ein Gefecht auf der Karte', g1.da === true, g1);
    check('1b: und zwar SICHTBAR (gemessene Flaeche > 0)',
      g1.da === true && g1.breite > 0 && g1.hoehe > 0, g1);
    /* Am ZIEL, nicht irgendwo: gemessen gegen den Nestmarker. Die Schwelle ist grosszuegig (der
       Text steht 20 Einheiten ueber der Zielmitte, in Bildschirmpixeln je nach Zoom mehr) - sie
       trennt "beim Nest" von "am anderen Ende der Karte", und das ist die Aussage. */
    check('1c: es liegt beim Ziel, nicht irgendwo auf der Karte',
      g1.da === true && g1.abstandZumNest !== null && g1.abstandZumNest < 120,
      { abstand: g1.abstandZumNest });
    check('1d: es nimmt dem Ziel den Klick nicht (pointer-events)', g1.pe === 'none', { pe: g1.pe });

    /* 4a: DER BLOCKIERENDE BEFUND DER DURCHSICHT, als Wachposten.
       Das Gefecht gehoert an die ANKUNFT. Gemessen wird das am Abstand zur RUECKKEHR: Die Mission
       dieses Fixtures kehrt erst in zehn Minuten heim; steht das Gefecht JETZT schon da, kann es
       nicht an endTime gehangen haben.
       DIE MESSUNG STEHT HIER, nicht weiter unten: Ein erster Entwurf las den Spielstand nach
       `t1.ctx.close()` und starb an "Target page ... has been closed" - derselbe Ablauffehler,
       der in dieser Sitzung schon einmal eine Pruefung aus dem falschen Grund gruen gemacht hat.
       Der Zeitpunkt ist ausserdem der richtige: Die Aussage gilt fuer den Moment, in dem das
       Gefecht gesehen wurde. */
    /* Gelesen wird der SERVERSEITIGE Spielstand aus dem Mock-Speicher, nicht localStorage: Das
       Spiel legt seinen Stand im Server-Modus dort ab, und ein erster Entwurf bekam von
       localStorage schlicht null zurueck. */
    const restMission = ((t1.stand().fleet || {}).missions || [])[0];
    const restzeit = restMission ? Math.round((restMission.endTime - Date.now())/1000) : null;
    check('4a: das Gefecht stand da, waehrend die Flotte noch MINUTEN von der Rueckkehr entfernt war',
      g1.da === true && restzeit !== null && restzeit > 120,
      { restzeitSek: restzeit, gefechtDa: g1.da,
        hinweis: 'endTime ist die Rueckkehr - die Ankunft liegt in der Mitte der Spanne' });

    // ---- 2) Es endet von selbst ------------------------------------------------------------
    /* MIT VORGESTELLTER UHR statt mit Warten: Nur Date.now wird ersetzt (Hausregel) - die
       Uhr-Hilfen des Browsertreibers heilen versaeumte Timer nach, ein Proxy um Date laeuft in
       eine Endlosrekursion. Neun Sekunden vor, ein Kartenneubau, fertig. */
    await t1.page.evaluate(() => { const echt = Date.now(); Date.now = () => echt + 9000; });
    await t1.page.waitForTimeout(2500);
    const g2 = await messeGefecht(t1.page);
    check('2a: nach der Gefechtsdauer ist es wieder weg - ein Gefecht, das stehen bleibt, luegt',
      g2.da === false, g2);
    check('2b: keine Skriptfehler auf dem ganzen Weg', t1.errs.length === 0, t1.errs.slice(0, 2));
    await t1.ctx.close();

    // ---- 3) Die Gegenrichtung: eine Mission ohne Kampf ---------------------------------------
    const t3 = await tab(browser, fixture('colonize'));
    await t3.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await t3.page.waitForTimeout(600);
    await oeffneSystemUeberSektoren(t3.page, SYS);
    /* Genauso lange wie oben gewartet - sonst maesse die Gegenrichtung nur, dass die Kolonisierung
       noch gar nicht angekommen ist, statt dass sie kein Gefecht ausloest. Gewartet wird, bis die
       Mission wirklich weg ist (angekommen), und ERST DANN gemessen. */
    let angekommen = false;
    for (let i = 0; i < 20 && !angekommen; i++){
      await t3.page.waitForTimeout(1000);
      angekommen = ((t3.stand().fleet || {}).missions || []).length === 0;
    }
    await t3.page.waitForTimeout(1500);
    const g3 = await messeGefecht(t3.page);
    check('3-vorab: die Kolonisierung ist wirklich angekommen - sonst misst 3a nur Warten',
      angekommen === true, { missionenRest: ((t3.stand().fleet || {}).missions || []).length });
    check('3a: eine Kolonisierung erzeugt KEIN Gefecht - sonst feuerte der Zeichner immer',
      g3.da === false, g3);
    await t3.ctx.close();
  } finally {
    await browser.close();
  }

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false).sort();
    const fehlt = soll.filter(k => gefallen.indexOf(k) < 0);
    const zuviel = gefallen.filter(k => soll.indexOf(k) < 0);
    console.log('\nGegenprobe „' + SAB + '": gefallen ' + JSON.stringify(gefallen) + ', erwartet ' + JSON.stringify(soll));
    if (fehlt.length || zuviel.length){
      console.log('FAIL - Gegenprobe: nicht gefallen ' + JSON.stringify(fehlt) + ', unerwartet gefallen ' + JSON.stringify(zuviel));
      process.exit(1);
    }
    console.log('PASS - Gegenprobe: genau die erwarteten Pruefungen sind gefallen.');
    process.exit(0);
  }
  ende();
})();
