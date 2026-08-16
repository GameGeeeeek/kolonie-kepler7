// Gürtelansicht der Sektoren-Karte (Modell B, Etappe KB-3): Asteroidenfelder liegen als FREIE,
// antippbare Objekte in der Sektoransicht (Brockenwolke mit Umrandung - nicht um einen Stern
// kreisend, Spieler-Wunsch am Entwurf), und ein Tipp öffnet den Gürtel als eigene Kartenebene:
// zehn Plätze auf der Umlaufbahn, Brocken nach Größe gefärbt/skaliert, Vorrats-Balken am Fels,
// freie Plätze gestrichelt. Der Fels-Tipp öffnet das BESTEHENDE Kartenmenü (asteroidMapMenu).
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_guertelansicht.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_guertelansicht.js
//   Am alten Stand (KB-2) fällt 1: keine [data-sektor-feld]-Objekte in irgendeinem Sektor.
//
// Solo-Modus (kein geteiltes Feld): asteroidFeldSicherstellen erzeugt das Feld deterministisch -
// welche Sektoren Gürtel tragen, wird deshalb ITERIEREND gesucht (Vorbild test_asteroiden_info),
// nicht geraten (Hausregel 4).
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

  // ---- 1) Ersten Sektor mit Gürtelfeld iterierend finden (höchstens 8 Schritte) ---------------
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-sektor="kepler"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(700);
  let feldInfo = null;
  for (let i = 0; i < 8; i++){
    feldInfo = await page.evaluate(() => {
      const f = document.querySelector('#galaxyMapSvg [data-sektor-feld]');
      if (!f) return null;
      return { sysId: f.getAttribute('data-sektor-feld'),
               label: f.textContent,
               vorkommen: +( (f.textContent.match(/(\d+) Vorkommen/)||[])[1] || 0 ) };
    });
    if (feldInfo) break;
    await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-kb-knopf="rechts"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await page.waitForTimeout(500);
  }
  check('1: mindestens ein Sektor trägt ein frei liegendes Gürtelfeld mit Bestandszeile',
    feldInfo !== null && /Gürtel/.test(feldInfo.label) && feldInfo.vorkommen >= 1, feldInfo);
  if (!feldInfo) return ende(async () => browser.close());

  // ---- 2) Feld-Tipp öffnet die Gürtelansicht: Felsen = Bestandszeile, freie Plätze ergänzen ---
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-sektor-feld]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(700);
  const guertel = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    return { titel: !!svg.querySelector('[data-kb-guertel]'),
             felsen: svg.querySelectorAll('[data-kb-fels]').length,
             balken: svg.querySelectorAll('[data-kb-fels] rect').length };
  });
  check('2: die Gürtelansicht zeigt genau die gemeldeten Vorkommen als Felsen, jeder mit Vorrats-Balken',
    guertel.titel && guertel.felsen === feldInfo.vorkommen && guertel.balken === guertel.felsen * 2,
    { erwartet: feldInfo.vorkommen, ...guertel });

  // ---- 3) Fels-Tipp öffnet das BESTEHENDE Kartenmenü mit Abbau-Eintrag ------------------------
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-kb-fels]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(600);
  const menu = await page.evaluate(() => {
    const m = document.querySelector('.kmenu');
    return { da: !!m, abbau: m ? /Abbaumission/.test(m.textContent) : false,
             vorrat: m ? /Vorrat/.test(m.textContent) : false };
  });
  check('3: der Fels-Tipp öffnet das bestehende Kartenmenü (Abbaumission + Vorrats-Info)',
    menu.da && menu.abbau && menu.vorrat, menu);

  // ---- 4) ‹ führt zum Sektor zurück, ⌂ zur Übersicht ------------------------------------------
  await page.evaluate(() => { const m = document.querySelector('.kmenu'); if (m) m.remove(); });
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-kb-knopf="guertelzu"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(600);
  const zurueck = await page.evaluate(() => ({
    felder: document.querySelectorAll('#galaxyMapSvg [data-sektor-feld]').length,
    knoten: document.querySelectorAll('#galaxyMapSvg [data-sektor-sys]').length
  }));
  check('4a: ‹ führt in die Sektoransicht zurück (Feld und Systeme wieder da)',
    zurueck.felder >= 1 && zurueck.knoten >= 1, zurueck);
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-kb-knopf="heimweg"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(600);
  const uebersicht = await page.evaluate(() => document.querySelectorAll('#galaxyMapSvg [data-sektor]').length);
  check('4b: ⌂ führt zur Sektoren-Übersicht', uebersicht === 8, { regionen: uebersicht });

  check('5: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
