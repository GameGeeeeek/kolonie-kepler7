// KI-Kampfberichte, Etappe E1b: das Logbuch des Kommandanten im Bericht (04.09.2026)
//
//   node tests/test_kampfbericht_logbuch.js
//
// Konzept: docs/ki-kampfberichte-konzept.md. Der Client schickt nach einem npc-attack fuenf FELDER
// und die Berichts-ID an das Backend; das Backend laesst AI Core auf dem M715q schreiben, prueft den
// Text und haengt ihn als `kiText` an den Bericht. Der Client zeigt ihn als Sektion "Logbuch des
// Kommandanten" - nur MIT Text, kein Ladezustand.
//
// Die Spieldatei kapselt alles in einer Funktion; pushReport und renderReportsBox sind von aussen
// nicht erreichbar. Gemessen wird deshalb ueber die Wege, die der Spieler auch geht: die Berichte
// kommen vom (gefaelschten) Server, der Knopf "Aktualisieren" laedt sie neu, und ein Kampf entsteht,
// indem eine FAELLIGE Angriffsmission im Spielstand beim Laden aufgeloest wird (Muster aus
// test_abgrund_ui.js, Abschnitt 5).
//
// GEPRUEFT WIRD (Testplan aus dem Konzept, angepasst an die Server-Berichte):
//   1  Die Sektion erscheint NUR mit Text (Paar: mit/ohne), der Text steht drin, und ein Text mit
//      <script> wird als TEXT gezeichnet (escapeHtml gemessen, nicht angenommen).
//   2  Die Anzeigebremse: Kommt der Text NACHTRAEGLICH an denselben Bericht (so kommt er immer - per
//      Abruf), wird die Box neu geschrieben. Ohne kiText in der Signatur bliebe sie stehen.
//   3  Die Bestellung: Nach einem aufgeloesten NPC-Angriff bestellt der Client GENAU die fuenf
//      Felder plus die Berichts-ID vom Server - nie den ganzen Bericht, nicht ohne ID (aelterer
//      Server), nicht wenn das Speichern scheiterte, nicht fuer eine andere Berichtsart, nicht fuer
//      Weltboss/Abgrund/keinKampf (derselbe Typ, nicht E1) - und ein 503 bleibt still.
//
// GEGENPROBE (in beide Richtungen ausgefuehrt am 04.09.2026, Pruefnamen per diff, Kopien ueber
// KEPLER_SPIELDATEI - die echte Spieldatei bleibt unangetastet):
//   * Am Stand vor E1b (origin/main v8.672.0) fallen genau 1a, 1c, 2, 3a, 3b, 3h. Gruen bleiben die
//     Verneinungen (1b, 3e, 3f, 3g) - Abwesenheit ist auch ohne die Funktion wahr; sie stehen
//     deshalb nur neben ihren Gegenstuecken.
//   * Ohne kiText in der Signatur (reportsSig ohne kiSig) faellt genau 2.
//   * Wird der GANZE Bericht bestellt statt der fuenf Felder, fallen genau 3b und 3c.
//   * Ohne escapeHtml im Logbuch faellt genau 1c - und window.__logbuchXss waere gesetzt.
//   * Bestellt pushReport fuer JEDE Berichtsart, faellt genau 3e (die Expedition bestellt mit).
//   * Prueft kampftextBerechtigt nur den Typ (ohne keinKampf/weltboss/abgrund), fallen genau 3i und 3j.
//   Befund beim Bau: Eine faellige ERKUNDUNG schreibt keinen Bericht (nur ein Fund tut das) - die
//   Vorpruefung 3e-vorab hat das gemeldet, sonst waere 3e vacuous gruen gewesen.
const { starteBrowser, SPIEL_URL, pruefer, ruhigeUhren, devices } = require('./lib/umgebung');
const { check, ende } = pruefer();

const SCRIPT_TEXT = '<script>window.__logbuchXss = 1</script>Böse & gut';
const TEXT_A = 'Der Verband brach durch die Sperren des Nests. Kreuzer und Bomber blieben zurück.';
const warte = ms => new Promise(r => setTimeout(r, ms));
async function warteBis(bedingung, maxMs){
  const bis = Date.now() + (maxMs || 8000);
  while (Date.now() < bis){ if (bedingung()) return true; await warte(150); }
  return bedingung();
}

function bericht(id, extra){
  return Object.assign({
    id, time: Date.now() - 60000, type: 'npc-attack', result: 'win',
    npcName: 'Piratennest Kharon-Tiefe', npcLevel: 6, attackPower: 48213, defensePower: 31877, chancePct: 82,
    fleet: { cruisers: 40, bomber: 12 }, ownLostShips: { cruisers: 7 }, loot: { erz: 1000 }, cargoCapacity: 5000,
    fromPlanet: 'Kepler Prime', flightTime: 1260, battlePoints: 10
  }, extra || {});
}

// Grundspielstand wie in test_abgrund_ui.js; `missionen` sind die faelligen Missionen, die das Spiel
// beim Laden aufloest.
const basisStand = (missionen, extra) => JSON.stringify(Object.assign({
  ...ruhigeUhren(),
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:20,mine:18,lager:20,werft:12,labor:12},
  research:{}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null},
  fleet:{ jaeger:4000, cruiser:200, schlachtschiff:400, frachter:200, kessel:5, lotsenboot:3, ships:5, missions: missionen || [] },
  battleStats:{wins:9,losses:2}, xp:20000, credits:50000, buffs:[], lastTick:Date.now(),
  colonyNames:{}
}, extra || {}));
// Eine FAELLIGE Angriffsmission gegen den ersten NPC (Void-Marodeure, Verteidigung 30) - so gebaut,
// wie das Spiel sie selbst anlegt (Z. 62392: id, type, targetId, startTime, endTime, power,
// fleetName, composition). Mit 4000 Jaegern ist der Sieg sicher; Math.random ist ohnehin festgesetzt.
const angriff = () => ({ id:'t1', type:'attack', targetId:'raider1', startTime: Date.now()-600000, endTime: Date.now()-2000,
  power: 200000, fleetName:'Probe', composition:{ jaeger: 400 } });
// Eine faellige Expedition schreibt IMMER einen Bericht (type 'expedition', beide Zweige der
// Aufloesung rufen pushReport) - eine Erkundung dagegen nur bei einem Fund, gemessen: kein Bericht.
const expedition = () => ({ id:'x1', type:'expedition', startTime: Date.now()-600000, endTime: Date.now()-2000,
  fleetName:'Weitflug', composition:{ jaeger: 10 }, escortPower: 100, encounterChance: 0 });
// Zwei Berichte, die DENSELBEN Typ npc-attack tragen, aber keinen Text bekommen duerfen (Befund des
// Review-Bots am PR #577): der Weltboss ohne Serverantwort (keinKampf) und der Abgrund-Tauchgang
// (abgrund:true, Fixture aus test_abgrund_ui.js Abschnitt 5). Weltboss und Abgrund gehoeren nicht
// zur Etappe E1; sie wuerden nur das Tageskontingent verbrauchen.
const weltboss = () => ({ id:'w1', type:'worldboss', bossLevel: 1, startTime: Date.now()-600000, endTime: Date.now()-2000,
  fleetName:'Probe', composition:{ jaeger: 400 }, power: 200000 });
const abgrund = () => ({ id:'a1', type:'abgrund', targetId: 1, startTime: Date.now()-600000, endTime: Date.now()-2000,
  fleetName:'Probe', composition:{ jaeger: 4000, schlachtschiff: 400, frachter: 200 }, power: 200000 });

// Die Backend-Attrappe: haelt den Spielstand (storage) und die Berichte, schreibt jede Anfrage mit
// (Methode, Pfad, Rumpf) - daran haengt Abschnitt 3 - und antwortet auf die zwei Kampftext-Wege so,
// wie `antworten` gerade steht.
function backend(stand, berichte){
  const store = { 'kepler7-save-v3': stand };
  const aufrufe = [];
  const antworten = { reportsPost: { status: 200, body: { ok: true, id: 'r-neu' } }, kampftext: { status: 202, body: { auftragId: 'a1', wartend: 0 } } };
  const route = r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (b, s) => r.fulfill({ status: s || 200, contentType: 'application/json', body: JSON.stringify(b) });
    let rumpf = null;
    try { rumpf = req.postData() ? JSON.parse(req.postData()) : null; } catch (e) { rumpf = req.postData(); }
    aufrufe.push({ methode: req.method(), pfad: p, rumpf });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = (rumpf || {}).value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    if (p === 'reports' && req.method() === 'POST'){
      if (antworten.reportsPost.status === 200 && rumpf && rumpf.report) berichte.unshift(Object.assign({ id: antworten.reportsPost.body.id || 'r-x', time: Date.now() }, rumpf.report));
      return j(antworten.reportsPost.body, antworten.reportsPost.status);
    }
    if (p === 'reports') return j({ reports: berichte });
    if (p === 'kampfbericht/text') return j(antworten.kampftext.body, antworten.kampftext.status);
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))
      return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
  return { route, aufrufe, antworten, berichte };
}

async function seiteMit(browser, berichte, missionen, vorAntworten, extraStand){
  const be = backend(basisStand(missionen, extraStand), berichte);
  if (vorAntworten) Object.assign(be.antworten, vorAntworten);
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{ width:1100, height:1600 } }));
  const page = await ctx.newPage();
  const seitenfehler = []; page.on('pageerror', e => seitenfehler.push(String(e.message || e)));
  await page.route('**/api/**', be.route);
  await page.addInitScript(() => { localStorage.setItem('kepler7_token','tok'); });
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.goto(SPIEL_URL);
  // Auf das Spiel warten, nicht auf die Uhr (Muster test_abgrund_ui.js). Die Berichte haben KEINEN
  // eigenen Reiter (gemessen: die Reiter heissen basis ... sammlung) - #reportsBox wird trotzdem
  // gezeichnet, sobald loadReports() die Berichte geholt hat.
  await page.waitForSelector('.tab-btn[data-tab="galaxie"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
    'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  await page.waitForFunction(() => { const b = document.getElementById('reportsBox'); return !!b && b.children.length > 0; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  return { ctx, page, seitenfehler, be };
}

// Karten der Berichte-Box, je als { text, hatLogbuch, logbuchText, html }
const karten = page => page.evaluate(() => {
  const box = document.getElementById('reportsBox');
  if (!box) return null;
  return [...box.children]
    .filter(el => /\d\d\.\d\d\., \d\d:\d\d/.test(el.textContent))
    .map(el => {
      const lb = el.querySelector('.ki-logbuch');
      return { text: el.textContent.replace(/\s+/g, ' ').trim(), hatLogbuch: !!lb,
        logbuchText: lb ? lb.textContent.replace(/\s+/g, ' ').trim() : '', html: el.innerHTML };
    });
});
const aktualisieren = async page => {
  await page.evaluate(() => { const b = document.getElementById('refreshReportsBtn'); if (b) b.click(); });
  await page.waitForTimeout(1200);
};

(async () => {
  const browser = await starteBrowser();

  // ---- Abschnitt 1: die Sektion, nur mit Text ---------------------------------------------
  {
    const berichte = [ bericht('r-a', { kiText: TEXT_A }), bericht('r-b'), bericht('r-c', { kiText: SCRIPT_TEXT }) ];
    const { ctx, page, seitenfehler } = await seiteMit(browser, berichte);
    let k = await karten(page);
    check('1-vorab: die drei Berichte sind gezeichnet', Array.isArray(k) && k.length === 3, { gezeichnet: k && k.length });
    k = k || [];
    check('1a: mit Text erscheint die Sektion "Logbuch des Kommandanten" - und der Text steht drin',
      !!k[0] && k[0].hatLogbuch && /Logbuch des Kommandanten/.test(k[0].logbuchText) && k[0].logbuchText.indexOf(TEXT_A) >= 0, k[0] && k[0].logbuchText);
    check('1b: OHNE Text keine Sektion, auch keine leere Ueberschrift (die Gegenrichtung)',
      !!k[1] && !k[1].hatLogbuch && !/Logbuch/.test(k[1].text), k[1] && k[1].text.slice(0, 120));
    const xssLief = await page.evaluate(() => window.__logbuchXss === 1);
    check('1c: ein Text mit <script> wird als TEXT gezeichnet (escapeHtml gemessen)',
      !!k[2] && k[2].hatLogbuch && k[2].logbuchText.indexOf('<script>') >= 0 && k[2].logbuchText.indexOf('Böse & gut') >= 0
        && k[2].html.indexOf('<script>') < 0 && !xssLief,
      { logbuchText: k[2] && k[2].logbuchText, xssLief });
    check('1d: keine Seitenfehler beim Zeichnen', seitenfehler.length === 0, { seitenfehler: seitenfehler.slice(0, 3) });

    // ---- Abschnitt 2: die Anzeigebremse ----------------------------------------------------
    // So kommt der Text IMMER: an denselben Bericht, dieselbe ID, per spaeterem Abruf. Der Knopf
    // "Aktualisieren" ist derselbe Weg wie der 15-s-Takt (beide rufen loadReports).
    berichte[1].kiText = 'Nachgereicht: Der Verband kehrte heim.';
    await aktualisieren(page);
    k = (await karten(page)) || [];
    check('2: kommt der Text nachtraeglich an denselben Bericht, schreibt die Box neu (kiText steht in der Signatur)',
      !!k[1] && k[1].hatLogbuch && k[1].logbuchText.indexOf('Nachgereicht') >= 0, k[1] && k[1].logbuchText);
    await ctx.close();
  }

  // ---- Abschnitt 3: die Bestellung ---------------------------------------------------------
  const bestellungen = be => be.aufrufe.filter(a => a.pfad === 'kampfbericht/text');
  const berichtePost = be => be.aufrufe.filter(a => a.pfad === 'reports' && a.methode === 'POST');
  {
    const { ctx, page, seitenfehler, be } = await seiteMit(browser, [], [angriff()]);
    await warteBis(() => bestellungen(be).length > 0, 8000);
    const gesendet = berichtePost(be).map(a => a.rumpf && a.rumpf.report && a.rumpf.report.type);
    check('3-vorab: die faellige Angriffsmission wurde aufgeloest und der Bericht ging an den Server',
      gesendet.indexOf('npc-attack') >= 0, { gesendet });
    check('3a: danach wird GENAU EIN Kampftext bestellt', bestellungen(be).length === 1, { bestellungen: bestellungen(be).length });
    const rumpf = (bestellungen(be)[0] && bestellungen(be)[0].rumpf) || {};
    check('3b: bestellt werden die fuenf Felder plus die Berichts-ID vom Server - und sonst nichts',
      Object.keys(rumpf).sort().join(',') === 'fleet,npcLevel,npcName,ownLostShips,reportId,result'
        && rumpf.reportId === 'r-neu' && rumpf.npcName === 'Void-Marodeure' && rumpf.npcLevel === 1 && rumpf.result === 'win'
        && !!rumpf.fleet && rumpf.fleet.jaeger === 400 && typeof rumpf.ownLostShips === 'object',
      rumpf);
    check('3c: kein Text, kein Prompt, keine Kampfzahlen im Rumpf (der Prompt entsteht nur auf dem Server)',
      !('prompt' in rumpf) && !('text' in rumpf) && !('attackPower' in rumpf) && !('loot' in rumpf), Object.keys(rumpf));
    check('3d: keine Seitenfehler bei Kampf und Bestellung', seitenfehler.length === 0, { seitenfehler: seitenfehler.slice(0, 3) });
    await ctx.close();
  }
  {
    const { ctx, be } = await seiteMit(browser, [], [expedition()]);
    await warteBis(() => berichtePost(be).length > 0, 8000);
    await warte(700);
    const gesendet = berichtePost(be).map(a => a.rumpf && a.rumpf.report && a.rumpf.report.type);
    check('3e-vorab: eine faellige Expedition erzeugt einen Bericht anderer Art', gesendet.length > 0 && gesendet.indexOf('npc-attack') < 0, { gesendet });
    check('3e: fuer eine andere Berichtsart wird NICHTS bestellt', bestellungen(be).length === 0, { bestellungen: bestellungen(be).length });
    await ctx.close();
  }
  {
    const { ctx, be } = await seiteMit(browser, [], [angriff()], { reportsPost: { status: 200, body: { ok: true } } });
    await warteBis(() => berichtePost(be).length > 0, 8000);
    await warte(700);
    check('3f: nennt der Server keine Berichts-ID (aelterer Stand), wird nichts bestellt',
      berichtePost(be).length > 0 && bestellungen(be).length === 0, { berichte: berichtePost(be).length, bestellungen: bestellungen(be).length });
    await ctx.close();
  }
  {
    const { ctx, be } = await seiteMit(browser, [], [angriff()], { reportsPost: { status: 500, body: { error: 'kaputt' } } });
    await warteBis(() => berichtePost(be).length > 0, 8000);
    await warte(700);
    check('3g: scheitert das Speichern des Berichts, wird nichts bestellt',
      berichtePost(be).length > 0 && bestellungen(be).length === 0, { berichte: berichtePost(be).length, bestellungen: bestellungen(be).length });
    await ctx.close();
  }
  {
    // Weltboss ohne Serverantwort: ein npc-attack-Bericht MIT keinKampf - kein Text zu erzaehlen.
    const { ctx, be } = await seiteMit(browser, [], [weltboss()]);
    await warteBis(() => berichtePost(be).length > 0, 8000);
    await warte(700);
    const berichte = berichtePost(be).map(a => a.rumpf && a.rumpf.report).filter(Boolean);
    check('3i-vorab: der Weltboss ohne Serverantwort erzeugt einen npc-attack-Bericht ohne Kampf',
      berichte.some(r => r.type === 'npc-attack' && r.keinKampf === true), { typen: berichte.map(r => r.type + (r.keinKampf ? '/keinKampf' : '')) });
    check('3i: fuer einen Bericht OHNE Kampf wird nichts bestellt', bestellungen(be).length === 0, { bestellungen: bestellungen(be).length });
    await ctx.close();
  }
  {
    // Abgrund-Tauchgang: ein npc-attack-Bericht mit abgrund:true - nicht Teil der Etappe E1.
    const { ctx, be } = await seiteMit(browser, [], [abgrund()], null, { research: { rsingularitaet: 1 } });
    await warteBis(() => berichtePost(be).length > 0, 10000);
    await warte(700);
    const berichte = berichtePost(be).map(a => a.rumpf && a.rumpf.report).filter(Boolean);
    check('3j-vorab: der Tauchgang erzeugt einen npc-attack-Bericht mit abgrund',
      berichte.some(r => r.type === 'npc-attack' && r.abgrund === true), { typen: berichte.map(r => r.type + (r.abgrund ? '/abgrund' : '')) });
    check('3j: fuer den Abgrund wird nichts bestellt (E1 ist der gewoehnliche NPC-Angriff)', bestellungen(be).length === 0, { bestellungen: bestellungen(be).length });
    await ctx.close();
  }
  {
    const { ctx, page, seitenfehler, be } = await seiteMit(browser, [], [angriff()], { kampftext: { status: 503, body: { error: 'KI-Kampfberichte sind derzeit abgeschaltet.' } } });
    await warteBis(() => bestellungen(be).length > 0, 8000);
    await warte(700);
    await aktualisieren(page);
    const k = (await karten(page)) || [];
    check('3h: ein 503 (abgeschaltet/Notaus) bleibt still - bestellt wurde, kein Seitenfehler, kein Logbuch und keine Meldung im Bericht',
      bestellungen(be).length === 1 && seitenfehler.length === 0 && k.length >= 1 && k.every(x => !x.hatLogbuch && !/Logbuch|abgeschaltet|KI-Kampfbericht/i.test(x.text)),
      { bestellungen: bestellungen(be).length, seitenfehler: seitenfehler.slice(0, 2), karten: k.length });
    await ctx.close();
  }

  await ende(async () => { await browser.close(); });
})().catch(async e => { console.error('ABBRUCH:', e); process.exit(1); });
