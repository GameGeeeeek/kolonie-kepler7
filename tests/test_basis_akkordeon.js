// Basis-Boxen im generischen Akkordeon (Etappe S-2, v8.513.0): Mit der Einstellung
// "Einklappbare Abschnitte" (state.uiCollapsibleSections) lassen sich jetzt auch Planeten-Rolle,
// Orbitalstation und Terraforming einklappen. Befund: Das Akkordeon lief nur über die DIREKTEN
// Kinder des Tab-Panels - die Überschriften dieser drei Bereiche liegen innerhalb ihrer per
// setBoxHtml geschriebenen Boxen und wurden nie erfasst.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_basis_akkordeon.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_basis_akkordeon.js
//   Am alten Stand fallen 1 (keine Chevrons in den Boxen) und 2/3 (kein Einklappen).
//
// Uhr-Regel (Hausregel 18): Für die Überlebens-Messung des eingeklappten Zustands wird die Uhr
// eingefroren - die Boxen werden im Sekundentakt neu geschrieben, und genau das darf den
// Klappzustand nicht zurücksetzen (das Akkordeon läuft im selben render()-Durchgang danach).
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
    // Die Einstellung ist AN - genau ihr Wirkbereich wird erweitert. collapsedSections leer.
    uiCollapsibleSections: true, collapsedSections: {},
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

  // ---- 1) Die drei Box-Überschriften tragen jetzt den Akkordeon-Chevron -----------------------
  const chevrons = await page.evaluate(() => {
    const hat = id => {
      const box = document.getElementById(id);
      const titel = box ? box.querySelector('.section-title') : null;
      return { titel: !!titel, chevron: !!(titel && titel.querySelector('.prog-chevron')) };
    };
    return { rolle: hat('planetRoleBox'), orbital: hat('orbitalStationBox'), terra: hat('terraformBox') };
  });
  check('1: Planeten-Rolle, Orbitalstation und Terraforming tragen den Akkordeon-Chevron',
    chevrons.rolle.chevron && chevrons.orbital.chevron && chevrons.terra.chevron, chevrons);

  // ---- 2) Klick auf die Terraforming-Überschrift klappt den Inhalt ein ------------------------
  // Uhr einfrieren VOR dem Klappen - die Sekunden-Neuzeichnung der Box darf den Zustand danach
  // nicht zurücksetzen.
  await page.evaluate(() => { const fest = Date.now(); Date.now = () => fest; });
  await page.waitForTimeout(1100);
  await page.evaluate(() => document.querySelector('#terraformBox .section-title').click());
  await page.waitForTimeout(600);
  const zu = await page.evaluate(() => {
    const box = document.getElementById('terraformBox');
    const titel = box.querySelector('.section-title');
    const inhalt = titel ? titel.nextElementSibling : null;
    return { eingeklappt: titel && titel.classList.contains('sec-collapsed'),
             inhaltVersteckt: !!inhalt && inhalt.style.display === 'none' };
  });
  check('2: der Klick auf die Überschrift klappt den Terraforming-Inhalt ein', zu.eingeklappt && zu.inhaltVersteckt, zu);

  // ---- 3) Der Zustand überlebt das sekündliche Neuzeichnen der Box ----------------------------
  await page.waitForTimeout(3400);
  const nachTicks = await page.evaluate(() => {
    const box = document.getElementById('terraformBox');
    const titel = box.querySelector('.section-title');
    const inhalt = titel ? titel.nextElementSibling : null;
    return { eingeklappt: titel && titel.classList.contains('sec-collapsed'),
             inhaltVersteckt: !!inhalt && inhalt.style.display === 'none' };
  });
  check('3: der eingeklappte Zustand überlebt mehrere Sekunden-Neuzeichnungen',
    nachTicks.eingeklappt && nachTicks.inhaltVersteckt, nachTicks);

  // ---- 4) Persistenz: der Zustand steht im gespeicherten Spielstand ---------------------------
  let gespeichert = null;
  try {
    const cs = JSON.parse(store['kepler7-save-v3']).collapsedSections || {};
    gespeichert = Object.keys(cs).find(k => k.includes('terraformBox') && cs[k]) || null;
  } catch (e) {}
  check('4: der Spielstand speichert den eingeklappten Terraforming-Abschnitt', !!gespeichert, { gespeichert });

  // ---- 5) Wieder aufklappen -------------------------------------------------------------------
  await page.evaluate(() => document.querySelector('#terraformBox .section-title').click());
  await page.waitForTimeout(600);
  const auf = await page.evaluate(() => {
    const box = document.getElementById('terraformBox');
    const titel = box.querySelector('.section-title');
    const inhalt = titel ? titel.nextElementSibling : null;
    return { eingeklappt: titel && titel.classList.contains('sec-collapsed'),
             inhaltSichtbar: !!inhalt && inhalt.style.display !== 'none' };
  });
  check('5: erneuter Klick klappt wieder auf', !auf.eingeklappt && auf.inhaltSichtbar, auf);

  check('6: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
