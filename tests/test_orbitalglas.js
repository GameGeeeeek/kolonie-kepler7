// Orbitalglas (v8.489.0): Der Sternenhimmel hängt am FENSTER, zeigt den aktiven Standort als
// Planetenbogen, und der Energiesparmodus schaltet die Weichzeichner ab.
//
// WARUM ES DIESEN TEST GIBT
// -------------------------
// Der Fehler, den diese Runde behoben hat, war jahrelang unsichtbar und wäre es geblieben: Das
// Canvas holte seine Bitmap-Größe EINMAL beim Start aus `shell.clientHeight`, als die Hülle noch
// leer war (gemessen: 778x638), und wurde danach per CSS über die volle Seitenhöhe gestreckt.
// Kaputt sah dabei nichts aus - es war schlicht fast nichts zu sehen. Genau solche Fehler fängt
// kein Blick auf die Seite, sondern nur eine Messung.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_orbitalglas.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_orbitalglas.js
//   Am alten Stand fallen 1a (Bitmap ≠ Fenster), 1b (Canvas nicht am Fenster), 2a/2b (kein Planet)
//   und 3 (Weichzeichner als Inline-Stil, vom Energiesparmodus nicht abschaltbar).
//
// Die Prüfungen messen bewusst die REGEL, nicht die Momentaufnahme (Hausregel 3): kein Vergleich
// gegen feste Pixelfarben oder feste Radien, sondern "Bitmap == Fenster", "unten links ist etwas
// gemalt, oben rechts nicht" und "zwei verschiedene Standorte ergeben zwei verschiedene Farben".
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

// Überschreibbar, damit die Gegenprobe denselben Test gegen eine ALTE Fassung fahren kann.
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'AdmiralX', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    return j({});
  };
}

function spielstand(extra) {
  const now = Date.now();
  return Object.assign({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12 },
    research: {}, fleet: { jaeger: 100, missions: [] }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'AdmiralX' }, xp: 52000, credits: 184000, prestige: 4, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {}
  }, extra || {});
}

// Öffnet das Spiel und liefert Messwerte aus dem laufenden Zustand zurück.
async function messen(browser, viewport, extra) {
  const store = {};
  store['kepler7-save-v3'] = JSON.stringify(spielstand(extra));
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });
  // Ein paar Bilder abwarten: im Energiesparmodus wird nur EIN statisches Bild gezeichnet.
  await page.waitForTimeout(1200);

  const m = await page.evaluate(() => {
    const cv = document.getElementById('bgstars');
    if (!cv) return { fehlt: true };
    const c = cv.getContext('2d');
    const punkt = (fx, fy) => {
      const d = c.getImageData(Math.max(0, Math.min(cv.width - 1, Math.round(cv.width * fx))),
                               Math.max(0, Math.min(cv.height - 1, Math.round(cv.height * fy))), 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] };
    };
    const kopfKnopf = document.querySelector('.hero-actions button');
    return {
      fehlt: false,
      bitmap: { w: cv.width, h: cv.height },
      fenster: { w: Math.round(window.innerWidth), h: Math.round(window.innerHeight) },
      position: getComputedStyle(cv).position,
      // Unten links liegt der Planetenbogen, oben rechts freier Himmel - die Gegenprobe im selben Bild.
      unten: punkt(0.18, 0.985),
      oben: punkt(0.88, 0.02),
      weichzeichner: kopfKnopf ? getComputedStyle(kopfKnopf).backdropFilter : null,
      sparmodus: document.body.classList.contains('power-save')
    };
  });
  await ctx.close();
  return m;
}

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Der Himmel hat Fenstergröße und klebt am Fenster --------------------------------------
  const a = await messen(browser, { width: 900, height: 1000 }, {});
  check('1-vorab: Canvas #bgstars vorhanden', !a.fehlt);
  if (a.fehlt) return ende(async () => browser.close());

  check('1a: Bitmap hat exakt Fenstergröße (kein Verzerren)',
    a.bitmap.w === a.fenster.w && a.bitmap.h === a.fenster.h,
    { bitmap: a.bitmap, fenster: a.fenster });
  check('1b: Canvas ist am Fenster befestigt', a.position === 'fixed', { position: a.position });

  // ---- 2) Der aktive Standort ist als Planet zu sehen -------------------------------------------
  check('2a: unten links ist der Planet gemalt, oben rechts ist freier Himmel',
    a.unten.a > 40 && a.oben.a < 40, { unten: a.unten, oben: a.oben });

  // Zwei verschiedene Standorte müssen zwei verschiedene Farben ergeben - das ist die eigentliche
  // Aussage ("der Hintergrund folgt dem Spielstand"), nicht ein bestimmter Farbwert.
  const eis = await messen(browser, { width: 900, height: 1000 }, { planetTypeOverride: { home: 'eis' } });
  const vulkan = await messen(browser, { width: 900, height: 1000 }, { planetTypeOverride: { home: 'vulkan' } });
  const abstand = Math.abs(eis.unten.r - vulkan.unten.r) + Math.abs(eis.unten.g - vulkan.unten.g) + Math.abs(eis.unten.b - vulkan.unten.b);
  check('2b: anderer Planetentyp -> anderer Planet im Hintergrund', abstand > 30,
    { eis: eis.unten, vulkan: vulkan.unten, abstand });

  // ---- 3) Energiesparmodus schaltet den Weichzeichner ab -----------------------------------------
  // Die Gegenrichtung wird mitgeprüft: ohne Sparmodus MUSS er an sein. Sonst wäre die Prüfung auch
  // dann grün, wenn es gar keinen Weichzeichner mehr gäbe (Hausregel 28: der Grund zählt).
  const sparen = await messen(browser, { width: 900, height: 1000 }, { powerSave: true });
  check('3-vorab: ohne Sparmodus ist der Weichzeichner an',
    !!a.weichzeichner && a.weichzeichner !== 'none', { weichzeichner: a.weichzeichner });
  check('3: im Sparmodus ist der Weichzeichner aus',
    sparen.sparmodus === true && sparen.weichzeichner === 'none',
    { sparmodus: sparen.sparmodus, weichzeichner: sparen.weichzeichner });

  // ---- 4) Handybreite: kein waagerechter Überlauf durch den festen Himmel ------------------------
  const handy = await messen(browser, { width: 390, height: 844 }, {});
  check('4: auf 390px hat der Himmel Fenstergröße', handy.bitmap.w === 390, { bitmap: handy.bitmap });

  await ende(async () => browser.close());
})();
