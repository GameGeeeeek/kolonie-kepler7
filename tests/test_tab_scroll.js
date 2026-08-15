// Scrollposition je Tab merken (Etappe S-4): switchTab sichert beim Verlassen window.scrollY und
// stellt sie beim Zurückkommen wieder her; nie besuchte Tabs starten oben. Vorher blieb schlicht
// die Scrollhöhe des alten Tabs stehen - wer in der Basis tief unten war, landete im nächsten
// Tab im Nirgendwo.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_tab_scroll.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_tab_scroll.js
//   Am alten Stand fällt 2 (Forschung startet NICHT oben, die Basis-Scrollhöhe bleibt stehen).
//
// Erwartungen gegen GEMESSENE Werte (Hausregel 2): Die Basis-Scrolltiefe wird vorab gemessen
// (maximal mögliche Tiefe), nicht als feste Zahl eingetippt.
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

  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
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
  });

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- 1-vorab) Die Basis-Seite ist überhaupt tief genug zum Scrollen ------------------------
  const tiefe = await page.evaluate(() => {
    window.scrollTo(0, 999999);
    const max = Math.round(window.scrollY);
    window.scrollTo(0, 600);
    return { max, jetzt: Math.round(window.scrollY) };
  });
  check('1-vorab: die Basis lässt sich mindestens 600px tief scrollen (Fixture trägt die Messung)',
    tiefe.max >= 600 && tiefe.jetzt === 600, tiefe);

  // ---- 2) Erstbesuch eines Tabs startet OBEN -------------------------------------------------
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="forschung"]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  const erstbesuch = await page.evaluate(() => Math.round(window.scrollY));
  check('2: der erstmals besuchte Forschung-Tab startet oben (alter Stand: Scrollhöhe blieb bei ~600 stehen)',
    erstbesuch === 0, { erstbesuch });

  // ---- 3) Zurück zur Basis: die gemerkte Tiefe ist wieder da ---------------------------------
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="basis"]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  const zurueck = await page.evaluate(() => Math.round(window.scrollY));
  check('3: zurück in der Basis steht die Seite wieder bei der gemerkten Tiefe (~600)',
    Math.abs(zurueck - 600) <= 100, { zurueck });

  // ---- 4) Auch der zweite Tab merkt sich seine eigene Tiefe ----------------------------------
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="forschung"]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  const f = await page.evaluate(() => {
    window.scrollTo(0, 300);
    return Math.round(window.scrollY);
  });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="basis"]'); if (b) b.click(); });
  await page.waitForTimeout(400);
  // Zwischenmessung macht die Prüfung auch für sich allein trennscharf (Hausregel 28): Am alten
  // Stand stünde die Basis jetzt bei 300 (Scrollhöhe wandert einfach mit), nicht bei ihren ~600.
  const basisZwischen = await page.evaluate(() => Math.round(window.scrollY));
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="forschung"]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  const f2 = await page.evaluate(() => Math.round(window.scrollY));
  check('4: beide Tabs merken sich ihre eigene Tiefe unabhängig voneinander',
    f === 300 && Math.abs(basisZwischen - 600) <= 100 && Math.abs(f2 - 300) <= 100,
    { gesetzt: f, basisZwischen, wieder: f2 });

  check('5: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
