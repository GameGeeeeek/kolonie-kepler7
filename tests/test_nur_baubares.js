// „Fertig Ausgebautes ausblenden"-Filter (Etappe S-4): Chip über den Gebäude-, Verteidigungs- und
// Forschungslisten (Muster: „Nur baubare Schiffe anzeigen" im Flotte-Tab), blendet fertig
// ausgebaute Karten aus - gesperrte Karten bleiben sichtbar, sie sind Ziele.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_nur_baubares.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_nur_baubares.js
//   Am alten Stand fällt 1 (kein data-toggle-hide-maxed-Chip) und damit alles Weitere.
//
// Fixture aus dem Code abgelesen (Hausregel 4): mine hat maxLevel:25 (Stufe 25 = fertig),
// solar maxLevel:40 (Stufe 18 = nicht fertig), rsolar maxLevel:20 (Stufe 20 = fertig).
// Selektoren auf die Container beschränkt (Hausregel 5).
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
    // mine 25 = maxLevel erreicht (fertig), solar 18 von 40 (offen)
    buildings: { solar: 18, mine: 25, raffinerie: 15, labor: 10, lager: 12, werft: 9 },
    // rsolar 20 = maxLevel erreicht (fertig)
    research: { rsolar: 20 }, fleet: { jaeger: 100, ships: 3, missions: [] },
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

  // ---- 1) Chip vorhanden (AUS), fertige Erzmine noch sichtbar --------------------------------
  const vorher = await page.evaluate(() => {
    const chip = document.querySelector('#buildings [data-toggle-hide-maxed]');
    const namen = [...document.querySelectorAll('#buildings .bname')].map(n => n.textContent);
    return { chip: !!chip, chipText: chip ? chip.textContent : '',
             mine: namen.some(t => /Erzmine/.test(t)), solar: namen.some(t => /Solarkraftwerk/.test(t)) };
  });
  check('1: der Filter-Chip steht über der Gebäudeliste (AUS) und die fertige Erzmine ist sichtbar',
    vorher.chip && /AUS/.test(vorher.chipText) && vorher.mine && vorher.solar, vorher);
  if (!vorher.chip) return ende(async () => browser.close());

  // ---- 2) Chip AN: fertige Karten verschwinden, offene bleiben ------------------------------
  await page.evaluate(() => document.querySelector('#buildings [data-toggle-hide-maxed]').click());
  await page.waitForTimeout(800);
  const an = await page.evaluate(() => {
    const chip = document.querySelector('#buildings [data-toggle-hide-maxed]');
    const namen = [...document.querySelectorAll('#buildings .bname')].map(n => n.textContent);
    return { chipText: chip ? chip.textContent : '',
             mine: namen.some(t => /Erzmine/.test(t)), solar: namen.some(t => /Solarkraftwerk/.test(t)) };
  });
  check('2: mit Filter AN ist die Erzmine ausgeblendet, das offene Solarkraftwerk bleibt, der Chip nennt die Anzahl',
    /AN/.test(an.chipText) && /ausgeblendet/.test(an.chipText) && !an.mine && an.solar, an);

  // ---- 3) Forschung: derselbe Schalter wirkt, fertiges rsolar ist weg ------------------------
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="forschung"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  const forschung = await page.evaluate(() => {
    const chip = document.querySelector('#research [data-toggle-hide-maxed]');
    const namen = [...document.querySelectorAll('#research .bname')].map(n => n.textContent);
    return { chip: !!chip, chipText: chip ? chip.textContent : '',
             rsolar: namen.some(t => /Verbesserte Solarzellen/.test(t)),
             rerz: namen.some(t => /Tiefenbohrer/.test(t)) };
  });
  check('3: im Forschung-Tab wirkt derselbe Filter - Verbesserte Solarzellen (fertig) weg, Tiefenbohrer (offen) da',
    forschung.chip && /AN/.test(forschung.chipText) && !forschung.rsolar && forschung.rerz, forschung);

  // ---- 4) Persistenz: uiHideMaxed steht im gespeicherten Spielstand --------------------------
  await page.waitForTimeout(1200);
  let gespeichert = null;
  try { gespeichert = JSON.parse(store['kepler7-save-v3']).uiHideMaxed; } catch (e) {}
  check('4: der Spielstand speichert den Filterzustand (uiHideMaxed=true)', gespeichert === true, { gespeichert });

  // ---- 5) Wieder AUS: alles kommt zurück -----------------------------------------------------
  await page.evaluate(() => document.querySelector('#research [data-toggle-hide-maxed]').click());
  await page.waitForTimeout(800);
  const aus = await page.evaluate(() => {
    const namen = [...document.querySelectorAll('#research .bname')].map(n => n.textContent);
    return { rsolar: namen.some(t => /Verbesserte Solarzellen/.test(t)) };
  });
  check('5: Chip wieder AUS - die fertige Forschung ist wieder sichtbar', aus.rsolar, aus);

  check('6: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
