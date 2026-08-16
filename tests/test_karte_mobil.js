// Mobiler Feinschliff der Detailtafel (Etappe B-7, v8.505.0):
// (1) ✕ im Tafelkopf schließt das System - bisher ging Schließen nur über Knöpfe AUF der Karte
//     („‹ Galaxie", Esc, Klick ins Leere), die nach dem Scrollen zur Tafel nicht erreichbar sind.
// (2) Auf schmalen Bildschirmen (<=700px) holt das Aufklappen die Tafel sanft ins Bild
//     („die Lade" aus dem Zielbild); das ✕ scrollt zurück zur Karte.
// (3) Die Ebenen-Leiste ist auf schmalen Bildschirmen einzeilig wischbar statt umzubrechen.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_karte_mobil.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_karte_mobil.js
//   Am alten Stand fallen 1 (kein ✕), 2b (kein Scroll zur Tafel) und 4 (Leiste bricht um).
//
// Gemessen wird, was der Spieler sieht (Regel 26): die Scroll-Position der Seite und die
// Sichtbarkeit der Knöpfe - nicht interner Zustand.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
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

  // Telefon-Maße: 390x844 (gängiges Smartphone) - unterhalb der 700px-Mobil-Schwelle des Spiels.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- 1) ✕ existiert und ist bei GESCHLOSSENEM System unsichtbar (hängt an der nav-Zeile) ----
  const vorab = await page.evaluate(() => {
    const b = document.getElementById('systemTafelZu');
    return { da: !!b, sichtbar: !!(b && b.offsetParent), scrollY: Math.round(window.scrollY) };
  });
  check('1: der ✕-Knopf existiert und ist ohne offenes System unsichtbar',
    vorab.da && !vorab.sichtbar, vorab);
  if (!vorab.da) return ende(async () => browser.close());

  // ---- 2) Aufklappen: ✕ wird sichtbar, die Tafel wird ins Bild geholt -------------------------
  // Seit KB-4 führt der Spielerweg über die Sektoren (Übersicht -> Region -> System).
  await oeffneSystemUeberSektoren(page, 'kepler');
  await page.waitForTimeout(2200);   // Kamerafahrt + sanftes Scrollen ausklingen lassen
  const offen = await page.evaluate(() => {
    const b = document.getElementById('systemTafelZu');
    const t = document.getElementById('systemTafel');
    const r = t.getBoundingClientRect();
    return { sichtbar: !!(b && b.offsetParent), scrollY: Math.round(window.scrollY),
             tafelOben: Math.round(r.top) };
  });
  check('2a: mit offenem System ist der ✕-Knopf sichtbar', offen.sichtbar, offen);
  check('2b: das Aufklappen holt die Tafel ins Bild (Seite ist zur Tafel gescrollt)',
    offen.scrollY > vorab.scrollY && offen.tafelOben >= -40 && offen.tafelOben < 400, offen);

  // ---- 3) ✕ schließt und scrollt zurück zur Karte ---------------------------------------------
  const zu = await page.evaluate(async () => {
    document.getElementById('systemTafelZu').click();
    await new Promise(r => setTimeout(r, 1600));
    const back = document.getElementById('galaxyBackBtn');
    const b = document.getElementById('systemTafelZu');
    const karte = document.querySelector('#tab-karte .map-wrap').getBoundingClientRect();
    return { zurueckKnopfWeg: !back || back.style.display === 'none',
             zuKnopfWeg: !(b && b.offsetParent),
             karteOben: Math.round(karte.top), scrollY: Math.round(window.scrollY) };
  });
  check('3: das ✕ schließt das System und bringt die Karte zurück ins Bild',
    zu.zurueckKnopfWeg && zu.zuKnopfWeg && zu.karteOben > -100 && zu.karteOben < 500, zu);

  // ---- 4) Ebenen-Leiste ist auf dem Telefon einzeilig wischbar --------------------------------
  const leiste = await page.evaluate(() => {
    const l = document.getElementById('karteEbenenLeiste');
    const st = getComputedStyle(l);
    return { wrap: st.flexWrap, overflowX: st.overflowX,
             einzeilig: l.scrollHeight <= l.clientHeight + 4 };
  });
  check('4: die Ebenen-Leiste bricht nicht um, sondern wird wischbar',
    leiste.wrap === 'nowrap' && leiste.overflowX === 'auto' && leiste.einzeilig, leiste);

  check('5: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
