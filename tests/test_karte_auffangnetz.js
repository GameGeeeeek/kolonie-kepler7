// Eingangs-Signatur des Karten-Auffangnetzes (Etappe G-1): Der Sekundentakt-Aufruf von
// buildGalaxyMap baut den ~400-Zeilen-Markup-String nur noch, wenn sich eine billige
// Eingangs-Signatur ändert ODER der letzte Vollbau >5 s her ist (Selbstkorrektur wie beim
// setBoxHtml-Markup-Vergleich, nur VOR dem teuren Aufbau statt danach). Messgröße ist der
// Messpunkt window.__karteAufbauten am Funktionsanfang - der Markup-Vergleich am Ende macht
// eingesparte wie durchgeführte Aufbauten von außen sonst unsichtbar (eine DOM-Marke überlebt
// jeden Aufbau mit unverändertem Markup, weil dann gar kein innerHTML geschrieben wird - genau
// daran wäre die erste Fassung dieses Tests gescheitert).
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_karte_auffangnetz.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_SPIELDATEI=/tmp/alt.html node tests/test_karte_auffangnetz.js
//   Am alten Stand fällt 1 (kein Messpunkt window.__karteAufbauten).
//
// Uhr-Regel (Hausregel 18): Für die "baut NICHT"-Messung wird NUR Date.now() eingefroren - die
// setInterval-Ticks laufen real weiter, aber Signatur und 5-s-Fenster stehen still. Danach wird
// die Uhr wieder freigegeben und die Selbstkorrektur-Obergrenze gemessen (Prüfung 3/4).
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

  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
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
  await page.waitForTimeout(2000);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- 1) Messpunkt existiert, Karte wurde gebaut ---------------------------------------------
  const z0 = await page.evaluate(() => ({
    zaehler: window.__karteAufbauten,
    kinder: (document.getElementById('galaxyMapSvg')||{}).childElementCount || 0
  }));
  check('1: der Messpunkt __karteAufbauten existiert und die Karte ist aufgebaut',
    typeof z0.zaehler === 'number' && z0.zaehler > 0 && z0.kinder > 0, z0);
  if (typeof z0.zaehler !== 'number') return ende(async () => browser.close());

  // ---- 2) Stehende Uhr, nichts geändert: KEIN weiterer Aufbau ---------------------------------
  await page.evaluate(() => { window.__echtNow = Date.now; const fest = Date.now(); Date.now = () => fest; });
  await page.waitForTimeout(1100);
  const v2 = await page.evaluate(() => window.__karteAufbauten);
  await page.waitForTimeout(3500);
  const n2 = await page.evaluate(() => window.__karteAufbauten);
  check('2: bei stehender Uhr und unverändertem Zustand baut das Auffangnetz NICHT (Zähler steht 3,5 s still)',
    n2 === v2, { vorher: v2, nachher: n2 });

  // ---- 3) Laufende Uhr, nichts geändert: der 5-s-Vollbau greift (Selbstkorrektur) -------------
  // Das ist zugleich die LATENZ-Garantie des Spielers (Hausregel 3, Regel statt Pfad): Egal ob
  // eine Änderung von der Signatur erkannt wird oder nicht - spätestens der 5-Sekunden-Vollbau
  // macht sie sichtbar. Der Spielzustand ist closure-intern und von außen nicht mutierbar, der
  // Signatur-Pfad allein deshalb hier nicht isoliert ansteuerbar; die Obergrenze ist die
  // Eigenschaft, auf die es ankommt.
  const v3 = await page.evaluate(() => { Date.now = window.__echtNow; return window.__karteAufbauten; });
  await page.waitForTimeout(6500);
  const n3 = await page.evaluate(() => window.__karteAufbauten);
  check('3: mit laufender Uhr baut der 5-Sekunden-Vollbau spätestens nach 6,5 s erneut (Selbstkorrektur/Latenz-Deckel)',
    n3 > v3, { vorher: v3, nachher: n3 });

  // ---- 4) Und er baut dabei NICHT jede Sekunde (das war der Zustand vor dieser Etappe) --------
  check('4: im 6,5-s-Fenster liefen höchstens 2 Aufbauten statt ~6 (Auffangnetz spart wirklich)',
    (n3 - v3) >= 1 && (n3 - v3) <= 2, { aufbauten: n3 - v3 });

  check('5: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
