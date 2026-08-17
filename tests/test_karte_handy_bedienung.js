// Bedienbarkeit der Systemebene am Handy (Etappe KB-11, Video-Report Sascha: "Button nach
// rechts verdeckt und die Karte sehr klein und man wird wenn man das System wechselt immer
// wieder nach unten geworfen").
//
// Drei REGELN, alle am gemessenen Vorfall aufgehängt:
//   1. Der ›-Blätterknopf ist WIRKLICH tippbar - geprüft per elementFromPoint auf seine Mitte,
//      nicht per "existiert und ist sichtbar". Genau das war der Fehler: Der Knopf lag da,
//      aber der Zoom-Stapel (senkrecht, 120 px hoch) fing im kompakten Kasten seine Taps ab.
//      Ein Test auf Sichtbarkeit hätte das NIE gefunden.
//   2. Blättern scrollt die Seite nicht. Der Scroll gehört zum ersten Öffnen (KB-10), beim
//      Systemwechsel steht die Karte längst im Bild - er warf den Spieler jedes Mal zurück
//      nach unten (gemessen: 300 -> 843).
//   3. Die Gegenrichtung bleibt gewahrt: Das ERSTE Öffnen scrollt weiterhin zur Karte. Ohne
//      diese Prüfung könnte man Regel 2 erfüllen, indem man den Scroll ganz entfernt - und
//      damit KB-10 wieder einreißen.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_karte_handy_bedienung.js
//   rot:   am Stand VOR KB-11 - Prüfung 1 meldet 'galaxyZoomInBtn' als Treffer, Prüfung 2
//          einen Sprung von ~543 px: KEPLER_SPIELDATEI=/tmp/alt.html node tests/…
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSektorMitSystem } = require('./lib/karte');
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
    discovered: { rhea: true, aion: true }, colonies: { rhea: { buildings: { mine: 4 } } },
    activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    nextPlanetEventCheck: now + 3600000
  });

  // Handy-Viewport wie im Report (iPhone-artig, Touch).
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
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
  await page.waitForTimeout(1200);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- Erstes Öffnen aus der Sektoransicht (misst zugleich Regel 3) ---------------------------
  await oeffneSektorMitSystem(page, 'kepler');
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(300);
  const vorOeffnen = await page.evaluate(() => Math.round(window.scrollY));
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-sektor-sys="kepler"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(2000);
  const nachOeffnen = await page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    karteOben: Math.round(document.querySelector('#tab-karte .map-wrap').getBoundingClientRect().top)
  }));
  check('3: das ERSTE Öffnen holt die Karte weiterhin ins Bild (KB-10 bleibt gewahrt)',
    nachOeffnen.scrollY > vorOeffnen && nachOeffnen.karteOben < 200,
    { vorOeffnen, ...nachOeffnen });

  // ---- 1) Der ›-Knopf muss den Tap wirklich bekommen ------------------------------------------
  const treffer = await page.evaluate(() => {
    const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, w: b.width, h: b.height, right: b.right, bottom: b.bottom }; };
    const naechst = document.getElementById('galaxySysNextBtn');
    const vorher = document.getElementById('galaxySysPrevBtn');
    if (!naechst || !vorher) return { fehlt: true };
    const rn = r(naechst), rv = r(vorher);
    const zoom = document.getElementById('galaxyZoomInBtn');
    const stapel = zoom ? r(zoom.parentElement) : null;
    const nimmt = rr => {
      const el = document.elementFromPoint(rr.left + rr.w / 2, rr.top + rr.h / 2);
      return el ? (el.id || el.tagName) : null;
    };
    const ueberlappt = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    return { trefferNaechst: nimmt(rn), trefferVorher: nimmt(rv),
             zoomUeberlapptNaechst: stapel ? ueberlappt(rn, stapel) : null,
             zoomUeberlapptVorher: stapel ? ueberlappt(rv, stapel) : null };
  });
  check('1a: ein Tap auf die Mitte des ›-Knopfes erreicht auch den ›-Knopf',
    treffer.trefferNaechst === 'galaxySysNextBtn', treffer);
  check('1b: dasselbe für den ‹-Knopf', treffer.trefferVorher === 'galaxySysPrevBtn', treffer);
  check('1c: der Zoomstapel überlappt keinen der beiden Blätterknöpfe',
    treffer.zoomUeberlapptNaechst === false && treffer.zoomUeberlapptVorher === false, treffer);

  // ---- 2) Blättern wirft den Spieler nicht nach unten -----------------------------------------
  // Der Spieler scrollt nach dem Öffnen wieder hoch (Suchfeld/Filter) und blättert dann weiter.
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(400);
  const vorBlaettern = await page.evaluate(() => Math.round(window.scrollY));
  const nameVorher = await page.evaluate(() => (document.getElementById('systemNavName') || {}).textContent || '');
  await page.evaluate(() => document.getElementById('galaxySysNextBtn').click());
  await page.waitForTimeout(1800);
  const nachBlaettern = await page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    name: (document.getElementById('systemNavName') || {}).textContent || ''
  }));
  check('2-vorab: der Klick hat wirklich ein anderes System geöffnet',
    nachBlaettern.name.length > 0 && nachBlaettern.name !== nameVorher,
    { nameVorher, ...nachBlaettern });
  check('2: das Blättern lässt die Scroll-Position stehen (kein Sprung nach unten)',
    Math.abs(nachBlaettern.scrollY - vorBlaettern) <= 20,
    { vorBlaettern, ...nachBlaettern });

  check('4: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
