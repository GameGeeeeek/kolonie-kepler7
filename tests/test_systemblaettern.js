// System-Blättern direkt auf der Karte (Etappe KB-9b, Auftrag Sascha: "wenn man system nach
// system durchsucht muss man als auf den zurück knopf gehen um das system zu wechseln finde
// eine lösung dafür").
//
// Die REGEL: Im aufgeklappten System liegen ‹ ›-Knöpfe DIREKT am Kartenkasten (galaxySysPrev/
// NextBtn); › öffnet ein ANDERES System, ‹ führt exakt zum Ausgangssystem zurück
// (Umkehr-Eigenschaft statt einer festverdrahteten Reihenfolge, Hausregel 3), und außerhalb
// eines offenen Systems sind die Knöpfe unsichtbar (sonst wären sie eine Falschaussage).
// Die Tafel-◀/▶ nutzen DIESELBE Reihenfolge (eine Wahrheit): ▶ dann ◀ landet ebenfalls wieder
// am Ausgangssystem.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_systemblaettern.js
//   rot:   am Stand VOR KB-9b existieren die Overlay-Knöpfe nicht (Prüfung 1 fällt) -
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_systemblaettern.js
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

  const sichtbar = id => page.evaluate(i => {
    const el = document.getElementById(i);
    return !!el && el.style.display !== 'none';
  }, id);
  const offenerName = () => page.evaluate(() => {
    const el = document.getElementById('systemNavName');
    return el ? el.textContent.trim() : '';
  });

  // ---- 1) In der Übersicht sind die Blätterknöpfe unsichtbar ---------------------------------
  check('1a: Übersicht - ‹ ist unsichtbar', !(await sichtbar('galaxySysPrevBtn')), {});
  check('1b: Übersicht - › ist unsichtbar', !(await sichtbar('galaxySysNextBtn')), {});

  // ---- 2) System öffnen: Knöpfe erscheinen ----------------------------------------------------
  await oeffneSystemUeberSektoren(page, 'kepler');
  const start = await offenerName();
  check('2a: im offenen System ist › sichtbar', await sichtbar('galaxySysNextBtn'), { start });
  check('2b: im offenen System ist ‹ sichtbar', await sichtbar('galaxySysPrevBtn'), { start });
  check('2-vorab: das offene System hat einen Namen', start.length > 0, { start });

  // ---- 3) › öffnet ein ANDERES System, ‹ führt exakt zurück (Umkehr-Eigenschaft) -------------
  await page.evaluate(() => document.getElementById('galaxySysNextBtn').click());
  await page.waitForTimeout(1200);
  const naechstes = await offenerName();
  check('3a: › öffnet ein anderes System', naechstes.length > 0 && naechstes !== start, { start, naechstes });
  check('3b: die Knöpfe bleiben im neuen System sichtbar', await sichtbar('galaxySysNextBtn'), { naechstes });
  await page.evaluate(() => document.getElementById('galaxySysPrevBtn').click());
  await page.waitForTimeout(1200);
  const zurueck = await offenerName();
  check('3c: ‹ führt exakt zum Ausgangssystem zurück', zurueck === start, { start, naechstes, zurueck });

  // ---- 4) Die Tafel-◀/▶ nutzen DIESELBE Reihenfolge ------------------------------------------
  await page.evaluate(() => document.getElementById('systemNextBtn').click());
  await page.waitForTimeout(1200);
  const tafelWeiter = await offenerName();
  check('4a: Tafel-▶ öffnet dasselbe Nachbarsystem wie das Karten-›',
    tafelWeiter === naechstes, { erwartetWieKartenKnopf: naechstes, tafelWeiter });
  await page.evaluate(() => document.getElementById('systemPrevBtn').click());
  await page.waitForTimeout(1200);
  check('4b: Tafel-◀ führt zurück zum Ausgangssystem', (await offenerName()) === start, { start });

  // ---- 5) Schließen versteckt die Blätterknöpfe wieder ---------------------------------------
  await page.evaluate(() => document.getElementById('galaxyBackBtn').click());
  await page.waitForTimeout(1000);
  check('5: nach dem Schließen sind ‹ › wieder unsichtbar',
    !(await sichtbar('galaxySysPrevBtn')) && !(await sichtbar('galaxySysNextBtn')), {});

  check('6: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
