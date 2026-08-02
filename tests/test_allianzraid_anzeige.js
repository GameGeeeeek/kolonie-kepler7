// Allianz-Raid-Box bleibt nicht mehr auf "laedt..." stehen (Spieler-Report 02.08.2026).
//
// DAS SYMPTOM: Im Allianz-Tab stand unter "ALLIANZ-RAID" dauerhaft "laedt..." - der Anfangsinhalt
// des Kastens aus dem HTML. Kein Fehlertext, keine leere Box, nichts, was nach einem Defekt aussah.
// Ein ewiger Ladetext ist die irrefuehrendste aller Fehlermeldungen: Er sieht aus wie ein langsamer
// Server und ist in Wahrheit ein Absturz.
//
// DIE URSACHE: renderAllianceRaidBox() griff im letzten Zweig blind auf `doc.dispatch.arrivalAt`
// zu. `dispatch: null` ist aber ein voellig regulaerer Zustand - der Server setzt es beim Ausrufen
// jeder neuen Welle ausdruecklich auf null und fuellt es erst beim Abflug wieder. Jede LOGIK-Stelle
// beruecksichtigte das laengst (checkAllianceRaidArrival hat `!doc.dispatch` in der Wache); nur die
// ANZEIGE hatte es vergessen. Verschaerfend ist der Zweig der FALLTHROUGH: Er faengt jeden
// unerwarteten oder fehlenden phase-Wert mit ab.
//
// DIE ZWEITE HAELFTE: Die acht Allianz-Boxen wurden in render() ungeschuetzt hintereinander
// aufgerufen. Ein Fehler in einer riss alle darunter mit. Der Kommentar an dieser Stelle beschrieb
// genau dieses Risiko schon vorher - abgesichert war aber nur die Reiter-Umschaltung davor.
//
// Der Test prueft beide Haelften an einem echt hochgefahrenen Spiel, nicht am Quelltext: Nur so
// faellt auf, wenn der naechste Umbau die Absicherung wieder verliert.
const { starteBrowser, devices, SPIELDATEI, SPIEL_URL } = require('./lib/umgebung');
const fs = require('fs');
const os = require('os');
const path = require('path');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const TAG = 'TST';

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData() || '{}').value; } catch(e){} return j({ ok:true }); }
    return store[k] === undefined ? j({ value:null }) : j({ value: store[k] });
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))
    return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

const spielstand = () => JSON.stringify({
  tutorialSeen:true, newbieWelcomeSeen:true, allianceSubTab:'krieg',
  resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:2e4, forschungspunkte:3e4 },
  buildings:{ solar:20, mine:18, lager:20, werft:12, labor:12 },
  research:{}, colonies:{}, activeBasePlanet:'home',
  player:{ id:'u', name:'A', avatarKey:null, allianceTag:TAG, allianceRole:'admin' },
  fleet:{ jaeger:500, schlachtschiff:50, missions:[] },
  battleStats:{ wins:1, losses:0 }, xp:20000, credits:50000, buffs:[], lastTick:Date.now(), colonyNames:{}
});
const info  = JSON.stringify({ tag:TAG, creatorId:'u', creatorName:'A', createdAt: Date.now()-1e7, joinMode:'open' });
const rolle = JSON.stringify({ playerId:'u', name:'A', role:'admin', joinedAt: Date.now()-1e7 });
const basis = JSON.stringify({ foundedAt: Date.now()-1e7, system:'kepler', level:5, hp:60000, maxHp:60000,
  contributions:{}, announcedLevel:5, destroyed:false });

const raidDoc = zusatz => JSON.stringify(Object.assign({
  id:'r1', level:2, hp:30000, maxHp:50000, targetSector:'kepler', waveNumber:2,
  expiresAt: Date.now()+36e5
}, zusatz));

// Die Zustaende, in denen das geteilte Raid-Dokument stehen kann. Die beiden letzten sind die, an
// denen die Anzeige gestorben ist - `dispatch: null` schreibt der Server selbst bei jeder neuen
// Welle (server.js: "doc.phase = 'gathering'; ...; doc.dispatch = null").
const FAELLE = [
  ['kein Raid',                  null],
  ['resolved',                   raidDoc({ phase:'resolved', hp:0, result:{ destroyed:true, resolvedAt:Date.now()-1e5 } })],
  ['idle',                       raidDoc({ phase:'idle', lastWaveEndedAt:Date.now()-1e5, lastWaveResult:{ damage:20000, participantCount:3 } })],
  ['gathering',                  raidDoc({ phase:'gathering', gatherEndsAt:Date.now()+9e5 })],
  ['enroute mit dispatch',       raidDoc({ phase:'enroute', dispatch:{ arrivalAt:Date.now()+5e5, participantCount:3, totalShips:500, totalPower:90000 } })],
  ['enroute mit dispatch:null',  raidDoc({ phase:'enroute', dispatch:null })],
  ['phase fehlt ganz',           raidDoc({})]
];

async function starte(browser, url, raid){
  const store = { 'kepler7-save-v3': spielstand(),
    ['alliance:'+TAG+':info']: info, ['alliance:'+TAG+':role:u']: rolle, ['alliance:'+TAG+':base']: basis };
  if (raid) store['alliance:'+TAG+':raid'] = raid;
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{ width:900, height:1400 } }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  page.on('dialog', d => d.accept());
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(url);
  await page.waitForSelector('.tab-btn[data-tab="allianz"]', { timeout: 60000 });
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="allianz"]'); if (b) b.click(); });
  await page.waitForTimeout(3500);
  return { page, ctx, errs };
}

const textVon = (page, id) => page.evaluate(i => {
  const e = document.getElementById(i);
  return e ? (e.textContent || '').trim() : null;
}, id);

(async () => {
  const browser = await starteBrowser();

  // ============================================ 1) Kein Zustand laesst die Box haengen
  for (const [name, raid] of FAELLE){
    const { page, ctx, errs } = await starte(browser, SPIEL_URL, raid);
    const txt = await textVon(page, 'allianceRaidBox');
    check('1: "' + name + '" - die Box zeigt nicht mehr "lädt…"', !!txt && !/^lädt/.test(txt),
      (txt || '').slice(0, 60));
    check('1: "' + name + '" - kein Absturz beim Zeichnen',
      !errs.some(e => /arrivalAt|dispatch/.test(e)), errs.slice(0, 2));
    // Die Boxen NACH der Raid-Box muessen ebenfalls dastehen - sie waren die stillen Mitopfer.
    const danach = await textVon(page, 'allianceBuildingBox');
    check('1: "' + name + '" - die Box darunter ist ebenfalls gezeichnet',
      !!danach && !/^lädt/.test(danach), (danach || '').slice(0, 40));
    await ctx.close();
  }

  // ============================================ 2) Der Fall, an dem es starb, zeigt echten Inhalt
  // Nicht nur "irgendwas statt lädt…": Bei einem laufenden Boss gehoeren Name und Lebenspunkte
  // dazu, sonst waere die Behebung nur ein stiller Platzhalter.
  {
    const { page, ctx } = await starte(browser, SPIEL_URL, raidDoc({ phase:'enroute', dispatch:null }));
    const txt = await textVon(page, 'allianceRaidBox');
    check('2: der Bossname steht da', /Panzerhülle/.test(txt || ''), (txt || '').slice(0, 60));
    check('2: die Lebenspunkte stehen da', /30\.0k \/ 50\.0k HP/.test(txt || ''));
    await ctx.close();
  }

  // ============================================ 3) Eine kaputte Box reisst die anderen nicht mit
  //
  // Bewiesen mit einer ABSICHTLICH zerstoerten Box: renderAllianceFleetParadeBox() wirft, und die
  // Raid-Box steht in render() DAHINTER. Ohne die Einzelabsicherung kaeme sie nie dran - genau so
  // ist der gemeldete Fehler entstanden. Geprueft wird an einer temporaeren Kopie der Spieldatei,
  // damit das Repo unveraendert bleibt.
  {
    const kaputt = fs.readFileSync(SPIELDATEI, 'utf8').replace(
      'function renderAllianceFleetParadeBox(){',
      "function renderAllianceFleetParadeBox(){ throw new Error('Testsabotage');");
    check('3: die Sabotage konnte eingesetzt werden', kaputt.includes('Testsabotage'));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-sabotage-'));
    const datei = path.join(dir, 'sabotiert.html');
    fs.writeFileSync(datei, kaputt);
    try {
      const { page, ctx, errs } = await starte(browser, 'file://' + datei, raidDoc({ phase:'idle', lastWaveEndedAt:Date.now()-1e5 }));
      const raidTxt = await textVon(page, 'allianceRaidBox');
      check('3: die Raid-Box wird trotz kaputter Box DAVOR gezeichnet',
        !!raidTxt && !/^lädt/.test(raidTxt), (raidTxt || '').slice(0, 50));
      const danach = await textVon(page, 'allianceEndgameBox');
      check('3: auch die vorletzte Box der Reihe wird gezeichnet',
        danach !== null && !/^lädt/.test(danach), (danach || '').slice(0, 40));
      // Die sabotierte Box selbst sagt es, statt weiter "lädt…" zu zeigen.
      const paradeTxt = await textVon(page, 'allianceFleetParadeBox');
      check('3: die kaputte Box meldet sich, statt ewig zu laden',
        /konnte nicht geladen werden/.test(paradeTxt || ''), (paradeTxt || '').slice(0, 60));
      check('3: der Fehler wurde nicht verschluckt (Konsole)',
        errs.length === 0, errs.slice(0, 2));   // pageerror darf NICHT auftreten - gefangen
      await ctx.close();
    } finally {
      fs.rmSync(dir, { recursive:true, force:true });
    }
  }

  // ============================================ 4) Die Box-Kennungen in der Tabelle stimmen
  //
  // Die Absicherung fuehrt eine eigene Liste (Kennung -> Render-Funktion), damit sie den
  // Platzhalter der GESCHEITERTEN Box ersetzen kann. Eine falsche Kennung faellt nirgends auf: Das
  // try/catch greift weiterhin, aber die Meldung landet im Nichts und der Spieler sieht wieder
  // ewig "lädt…" - also genau das Symptom, gegen das die Absicherung gebaut wurde. Beim ersten
  // Schreiben ist mir das prompt passiert (allianceWorldProjectsBox statt allianceWorldBox).
  // Ab v8.379.0 gilt dasselbe fuer den Fortschritt-Tab, der dieselbe ungeschuetzte Kette hatte -
  // deshalb werden BEIDE Tabellen geprueft, nicht nur die des Allianz-Tabs.
  {
    const src = fs.readFileSync(SPIELDATEI, 'utf8');
    const tabelleVon = name => {
      const a = src.indexOf('const ' + name + ' = [');
      return a < 0 ? '' : src.slice(a, src.indexOf('];', a));
    };
    const alle = [];
    for (const [name, anzahl] of [['ALLIANZ_BOXEN', 8], ['FORTSCHRITT_BOXEN', 8]]){
      const paare = [...tabelleVon(name).matchAll(/\['([a-zA-Z]+)',\s*(render[A-Za-z]+)\]/g)].map(m => [m[1], m[2]]);
      check('4: ' + name + ' wurde gelesen', paare.length === anzahl, paare.length);
      alle.push(...paare);
    }
    // Einzelaufrufe ausserhalb der Tabellen (z. B. renderDailyLoginBox) zaehlen mit.
    for (const m of src.matchAll(/zeichneAbgesichert\('([a-zA-Z]+)',\s*(render[A-Za-z]+)\)/g)) alle.push([m[1], m[2]]);
    check('4: mindestens 17 abgesicherte Boxen', alle.length >= 17, alle.length);

    for (const [id, fn] of alle){
      // Die Kennung, die die Funktion selbst benutzt - aus ihren ersten Zeilen.
      const a = src.indexOf('function ' + fn + '(){');
      const kopf = a < 0 ? '' : src.slice(a, a + 600);
      const echt = (kopf.match(/getElementById\('([a-zA-Z]+)'\)/) || [])[1];
      check('4: "' + fn + '" ist mit der richtigen Kennung eingetragen', id === echt, { tabelle:id, funktion:echt });
      check('4: das Element "' + id + '" gibt es im HTML', src.includes('id="' + id + '"'));
    }

    // Innerhalb von render() darf keine dieser Funktionen mehr nackt aufgerufen werden - sonst
    // waere die Absicherung halb, und genau daraus entsteht der naechste Fehler dieser Art.
    //
    // BEWUSST nur der Rumpf von render(): Dieselben Funktionen werden an vielen anderen Stellen
    // einzeln aufgerufen (nach einer Spende, einem Kauf, einem Reiterwechsel). Dort ist ein nackter
    // Aufruf voellig richtig - es gibt keine Kette, die mitgerissen werden koennte, und der Aufrufer
    // hat ohnehin seinen eigenen Kontext. Die erste Fassung dieser Pruefung suchte ueber die ganze
    // Datei und meldete prompt 13 solcher legitimen Stellen.
    const rVon = src.indexOf('\n  function render(){');
    const rBis = src.indexOf('\n  function ', rVon + 10);
    const rumpf = src.slice(rVon, rBis);
    // Strukturell pruefen statt nach Groesse: render() ist rund 414 kB lang (knapp 9% der Datei),
    // eine Obergrenze aus dem Bauch waere nur eine Zahl, die beim naechsten Anbau kippt. Richtig
    // eingegrenzt ist der Rumpf dann, wenn beide Ketten drinstehen UND er vor der naechsten
    // Funktion endet - sonst suchte die Pruefung darunter im Nichts oder in der halben Datei.
    check('4: der Rumpf von render() wurde eingegrenzt',
      rBis > rVon && rumpf.includes('const ALLIANZ_BOXEN') && rumpf.includes('const FORTSCHRITT_BOXEN')
        && !rumpf.includes('function zeichneAbgesichert'),
      { laenge: rumpf.length, endetVor: src.slice(rBis, rBis + 30).trim() });
    const abgesichert = new Set(alle.map(([, fn]) => fn));
    const nackt = [];
    for (const zeile of rumpf.split('\n')){
      const m = /^\s*(render[A-Za-z]+)\(\);\s*$/.exec(zeile);
      if (m && abgesichert.has(m[1])) nackt.push(m[1]);
    }
    check('4: in render() wird keine abgesicherte Box mehr nackt aufgerufen', nackt.length === 0, nackt);
  }

  // ============================================ 5) Fortschritt-Tab: gleiche Isolation
  // Wie Abschnitt 3, nur fuer die zweite Kette. renderCompendium() steht dort VOR renderDominance,
  // renderAllianceTitlesBox, renderAllianceSkinsBox, der Levelanzeige und renderDailyLoginBox -
  // ohne Absicherung waeren die alle mit ausgefallen, inklusive der Levelanzeige mitten drin.
  {
    const kaputt = fs.readFileSync(SPIELDATEI, 'utf8').replace(
      'function renderCompendium(){',
      "function renderCompendium(){ throw new Error('Testsabotage');");
    check('5: die Sabotage konnte eingesetzt werden', kaputt.includes('Testsabotage'));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-fortschritt-'));
    const datei = path.join(dir, 'sabotiert.html');
    fs.writeFileSync(datei, kaputt);
    try {
      const { page, ctx, errs } = await starte(browser, 'file://' + datei, null);
      await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="fortschritt"]'); if (b) b.click(); });
      await page.waitForTimeout(2500);
      for (const id of ['dominanceBox', 'allianceTitlesBox', 'levelBox', 'dailyLoginBox']){
        const t = await textVon(page, id);
        check('5: "' + id + '" wird trotz kaputter Box davor gezeichnet', !!t, (t || '').slice(0, 40));
      }
      check('5: der Fehler wurde gefangen, nicht als Absturz durchgereicht', errs.length === 0, errs.slice(0, 2));
      await ctx.close();
    } finally {
      fs.rmSync(dir, { recursive:true, force:true });
    }
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
