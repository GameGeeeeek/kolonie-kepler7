// Gürtel nur noch im aufgeklappten System (Etappe KB-8, Auftrag Sascha: "entferne die asteroiden
// gürtel das ist zu einnfach einfach jedes system Durchklicken und sich die gürtel anzuschauen").
// Ersetzt test_guertelansicht.js (KB-3), der das ENTFERNTE Verhalten als Regel prüfte.
//
// Die Regel jetzt: (1) KEIN Sektor trägt mehr ein frei antippbares Gürtelfeld ([data-sektor-feld]);
// (2) das Gürtelsystem bleibt in der Sektoransicht erkennbar (gestrichelter Ring
// data-ring="guertel" - das DASS bleibt, nur das WAS wandert ins System); (3) das aufgeklappte
// Gürtelsystem zeigt seine Brocken (data-map-asteroid); (4) der Brocken-Tipp öffnet das
// Kartenmenü mit Abbaumission UND Vorrat - genau die Information, die vorher die Gürtelansicht
// am Fels zeigte (Regel-44-Inventar der Ablösung).
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_guertel_im_system.js
//   rot:   am Stand VOR KB-8 (dort existieren [data-sektor-feld]-Objekte, Prüfung 1 fällt) -
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_guertel_im_system.js
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    return j({});
  };
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  const now = Date.now();
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, ships: 3, missions: [] },
    discovered: { rhea: true, aion: true }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    nextPlanetEventCheck: now + 3600000
  });

  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page.waitForTimeout(1500);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- 1+2) ALLE 8 Sektoren durchgehen: nirgends ein Feld, aber Gürtel-Ringe existieren -------
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-sektor="kepler"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(700);
  let felderGesamt = 0, ringeGesamt = 0, guertelSysId = null;
  const sektorProtokoll = [];
  for (let i = 0; i < 8; i++){
    const st = await page.evaluate(() => {
      const svg = document.getElementById('galaxyMapSvg');
      const ring = svg.querySelector('[data-ring="guertel"]');
      const sysNode = ring ? ring.closest('[data-sektor-sys]') : null;
      return { titel: (svg.querySelector('[data-kb-titel]') || {}).textContent || '?',
               felder: svg.querySelectorAll('[data-sektor-feld]').length,
               ringe: svg.querySelectorAll('[data-ring="guertel"]').length,
               sysId: sysNode ? sysNode.getAttribute('data-sektor-sys') : null };
    });
    felderGesamt += st.felder; ringeGesamt += st.ringe;
    if (!guertelSysId && st.sysId) guertelSysId = st.sysId;
    sektorProtokoll.push(st.titel + ': felder=' + st.felder + ' ringe=' + st.ringe);
    if (i < 7){
      await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-kb-knopf="rechts"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      await page.waitForTimeout(450);
    }
  }
  check('1: in KEINEM der 8 Sektoren existiert noch ein frei liegendes Gürtelfeld',
    felderGesamt === 0, sektorProtokoll);
  check('2: das DASS bleibt - mindestens ein Systemknoten trägt den Gürtel-Ring',
    ringeGesamt >= 1 && !!guertelSysId, { ringeGesamt, guertelSysId, sektorProtokoll });
  if (!guertelSysId) return ende(async () => browser.close());

  // ---- 3) Das aufgeklappte Gürtelsystem zeigt seine Brocken -----------------------------------
  // Der Ring wurde im ZULETZT offenen Sektor gefunden, in dem guertelSysId sichtbar ist? Nicht
  // zwingend - deshalb zurück zu dem Sektor iterieren, der den Knoten trägt (Spielerweg, keine
  // internen Aufrufe). Höchstens 8 Schritte.
  let daNode = false;
  for (let i = 0; i < 8; i++){
    daNode = await page.evaluate(sid => !!document.querySelector('#galaxyMapSvg [data-sektor-sys="' + sid + '"]'), guertelSysId);
    if (daNode) break;
    await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-kb-knopf="rechts"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await page.waitForTimeout(450);
  }
  check('3-vorab: der Sektor mit dem Gürtelsystem ist erreichbar', daNode, { guertelSysId });
  await page.evaluate(sid => { document.querySelector('#galaxyMapSvg [data-sektor-sys="' + sid + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); }, guertelSysId);
  await page.waitForTimeout(1800);   // Kamerafahrt + Folge-Tick (wie tests/lib/karte.js)
  const brocken = await page.evaluate(() => document.querySelectorAll('#galaxyMapSvg [data-map-asteroid]').length);
  check('3: das aufgeklappte Gürtelsystem zeigt seine Brocken auf der Gürtelbahn',
    brocken >= 1, { guertelSysId, brocken });

  // ---- 4) Brocken-Tipp öffnet das Kartenmenü mit Abbaumission und Vorrat ----------------------
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-map-asteroid]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(600);
  const menu = await page.evaluate(() => {
    const m = document.querySelector('.kmenu');
    return { da: !!m, abbau: m ? /Abbaumission/.test(m.textContent) : false,
             vorrat: m ? /Vorrat/.test(m.textContent) : false };
  });
  check('4: der Brocken-Tipp öffnet das Kartenmenü (Abbaumission + Vorrats-Info)',
    menu.da && menu.abbau && menu.vorrat, menu);

  check('5: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
