// Kompaktkarten in Werft und Offizieren (Etappe K-1, S-1-Muster): Die Beschreibungs-/Antriebs-
// Zeilen der Schiffskarten und die Erklärzeile der Offizierskarten stehen hinter einem
// "Details"-Griff (details.karten-info, data-keep-open) - Statusbalken, Kosten und Knöpfe
// bleiben immer sichtbar.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_flottenkarten.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_flottenkarten.js
//   Am alten Stand fällt 1 (kein sinfo-Details an der Jäger-Karte).
//
// Sichtbarkeit wird per checkVisibility() gemessen (nicht getBoundingClientRect - Chromium gibt
// Kindern zugeklappter <details> weiterhin Layout-Boxen, Vorbild test_kompaktkarten).
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
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, ships: 3, missions: [] },
    // Ein Offizier angeheuert, damit die Karte die "Aktuell:"-Statuszeile trägt (die sichtbar
    // bleiben muss, während die Erklärzeile hinter den Griff wandert).
    officers: { admiral: 3 },
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
    const b = document.querySelector('.tab-btn[data-tab="flotte"]'); if (b) b.click();
  });
  await page.waitForTimeout(1500);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- 1) Jäger-Karte: Details-Griff da, Meta-Zeile zu, Balken/Kaufknopf sichtbar -------------
  const jaeger = await page.evaluate(() => {
    const karte = document.querySelector('#fleet details[data-keep-open="sinfo:jaeger"]');
    if (!karte) return { da: false };
    const card = karte.closest('.card-row');
    const metaZeile = [...karte.querySelectorAll('.bmeta')].find(b => /Angriffspunkte/.test(b.textContent));
    const balken = card.querySelector('.ship-stats, [class*="stat"]') || card.querySelector('.progress-outer');
    const kaufen = card.querySelector('[data-buyship="jaeger"]');
    return { da: true, offen: karte.open,
             metaDa: !!metaZeile, metaSichtbar: metaZeile ? metaZeile.checkVisibility() : null,
             kaufenSichtbar: kaufen ? kaufen.checkVisibility() : false };
  });
  check('1: die Jäger-Karte trägt den Details-Griff, die Meta-Zeile ist zu, der Kaufknopf sichtbar',
    jaeger.da && !jaeger.offen && jaeger.metaDa && jaeger.metaSichtbar === false && jaeger.kaufenSichtbar, jaeger);
  if (!jaeger.da) return ende(async () => browser.close());

  // ---- 2) Aufklappen zeigt die Meta-Zeile, Zustand überlebt Sekunden-Neuzeichnungen -----------
  await page.evaluate(() => { document.querySelector('#fleet details[data-keep-open="sinfo:jaeger"] summary').click(); });
  await page.waitForTimeout(600);
  const offen = await page.evaluate(() => {
    const karte = document.querySelector('#fleet details[data-keep-open="sinfo:jaeger"]');
    const metaZeile = [...karte.querySelectorAll('.bmeta')].find(b => /Angriffspunkte/.test(b.textContent));
    return { offen: karte.open, metaSichtbar: metaZeile ? metaZeile.checkVisibility() : null };
  });
  check('2: aufgeklappt ist die Meta-Zeile sichtbar', offen.offen && offen.metaSichtbar === true, offen);

  await page.waitForTimeout(3200);
  const nachTicks = await page.evaluate(() => {
    const karte = document.querySelector('#fleet details[data-keep-open="sinfo:jaeger"]');
    return { offen: karte ? karte.open : null };
  });
  check('3: der offene Zustand überlebt mehrere Sekunden-Neuzeichnungen (data-keep-open)',
    nachTicks.offen === true, nachTicks);

  // ---- 4) Offizierskarte: Erklärzeile hinter dem Griff, "Aktuell:"-Zeile bleibt sichtbar ------
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="offiziere"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  const offizier = await page.evaluate(() => {
    const griff = document.querySelector('#officerBox details[data-keep-open="oinfo:admiral"]');
    if (!griff) return { da: false };
    const card = griff.closest('.card-row');
    const erklaer = [...griff.querySelectorAll('.bmeta')].find(b => /Angriffskraft/.test(b.textContent));
    const aktuell = [...card.querySelectorAll('.bmeta')].find(b => /^Aktuell:/.test(b.textContent.trim()));
    return { da: true, offen: griff.open,
             erklaerDa: !!erklaer, erklaerSichtbar: erklaer ? erklaer.checkVisibility() : null,
             aktuellSichtbar: aktuell ? aktuell.checkVisibility() : false };
  });
  check('4: die Admiral-Karte hat den Griff (Erklärzeile zu), die Aktuell-Statuszeile bleibt sichtbar',
    offizier.da && !offizier.offen && offizier.erklaerDa && offizier.erklaerSichtbar === false && offizier.aktuellSichtbar, offizier);

  check('5: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
