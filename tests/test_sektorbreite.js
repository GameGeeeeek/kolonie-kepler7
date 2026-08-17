// Sektoransicht nutzt am PC die Kastenbreite (Etappe KB-8b, Spieler-Report Sascha mit Screenshot:
// "die karte nach links und recht ausdehnen weil am pc ist ja rechts und links genug platz").
// Vorher war die viewBox fest '0 0 400 H' - am breiten Kasten blieb durch meet-Letterboxing über
// die Hälfte links und rechts leer (gemessen ~52% bei 1200x800).
//
// Die REGEL (nicht die Momentaufnahme, Hausregel 3): Die viewBox-Breite folgt dem GEMESSENEN
// Kastenverhältnis (W = clamp(400..1200, H * rectW/rectH)) - die Erwartung wird aus dem echten
// getBoundingClientRect abgeleitet, nie eingetippt (Hausregel 2). Am Handy-Viewport bleibt W
// exakt 400 (dort ist der Kasten höher als breit; nichts ändert sich).
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_sektorbreite.js
//   rot:   am Stand VOR KB-8b bleibt die Breite am PC-Viewport 400, Prüfung 1a fällt -
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_sektorbreite.js
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

const SPIELSTAND = () => JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
  buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
  research: {}, fleet: { jaeger: 100, ships: 3, missions: [] },
  discovered: { rhea: true, aion: true }, colonies: {}, activeBasePlanet: 'home',
  player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: Date.now(),
  colonyNames: {}, colonyNotes: {},
  nextPlanetEventCheck: Date.now() + 3600000
});

async function sektorOeffnen(browser, viewport) {
  const store = { 'kepler7-save-v3': SPIELSTAND() };
  const ctx = await browser.newContext({ viewport });
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
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-sektor="kepler"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(700);
  const mess = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    const r = svg.getBoundingClientRect();
    const rechts = svg.querySelector('[data-kb-knopf="rechts"] rect');
    let maxCx = 0;
    svg.querySelectorAll('[data-sektor-sys] circle').forEach(c => { maxCx = Math.max(maxCx, +c.getAttribute('cx') || 0); });
    // Mindestabstand der Knoten (dieselbe bleibende Regel wie test_sektoransicht Abschnitt 2):
    const zentren = [];
    svg.querySelectorAll('[data-sektor-sys]').forEach(g => {
      const c = g.querySelector('circle');
      if (c) zentren.push([+c.getAttribute('cx'), +c.getAttribute('cy')]);
    });
    let minAbstand = Infinity;
    for (let i = 0; i < zentren.length; i++) for (let k = i + 1; k < zentren.length; k++){
      minAbstand = Math.min(minAbstand, Math.hypot(zentren[i][0]-zentren[k][0], zentren[i][1]-zentren[k][1]));
    }
    return { vbW: vb[2], vbH: vb[3], rectW: r.width, rectH: r.height,
             rechtsX: rechts ? +rechts.getAttribute('x') : null, maxCx, minAbstand };
  });
  await ctx.close();
  return { mess, fehler };
}

(async () => {
  const browser = await starteBrowser();

  // ---- 1) PC-Viewport: Breite folgt dem gemessenen Kastenverhältnis ---------------------------
  const pc = await sektorOeffnen(browser, { width: 1400, height: 900 });
  const m = pc.mess;
  check('0-vorab: PC-Boot ohne Skriptfehler', pc.fehler.length === 0, pc.fehler.slice(0, 2));
  // Erwartung aus der GEMESSENEN Kastengröße abgeleitet (Regel 2) - dieselbe Formel wie im Spiel:
  const erwartetW = Math.max(400, Math.min(1200, Math.round(m.vbH * (m.rectW / m.rectH))));
  check('1a: die viewBox-Breite wächst am breiten Kasten über 400 hinaus', m.vbW > 400, m);
  check('1b: sie entspricht der abgeleiteten Erwartung clamp(400..1200, H*Kastenverhältnis)',
    Math.abs(m.vbW - erwartetW) <= 2, { erwartetW, ...m });
  check('1c: der ›-Knopf sitzt am rechten Rand der neuen Breite (x = W-53)',
    m.rechtsX !== null && Math.abs(m.rechtsX - (m.vbW - 53)) <= 2, { rechtsX: m.rechtsX, vbW: m.vbW });
  check('1d: die Systemknoten NUTZEN die Breite (Spalten über die alte 400er-Kante hinaus)',
    m.maxCx > 400, { maxCx: m.maxCx, vbW: m.vbW });
  check('1e: der Mindestabstand der Knoten bleibt gewahrt (>=60, wie test_sektoransicht)',
    m.minAbstand >= 60, { minAbstand: Math.round(m.minAbstand) });

  // ---- 2) Handy-Viewport: exakt das alte Verhalten --------------------------------------------
  const handy = await sektorOeffnen(browser, { width: 390, height: 844 });
  check('2-vorab: Handy-Boot ohne Skriptfehler', handy.fehler.length === 0, handy.fehler.slice(0, 2));
  check('2: am Handy bleibt die viewBox-Breite exakt 400 (nichts ändert sich)',
    handy.mess.vbW === 400, handy.mess);

  await ende(async () => browser.close());
})();
