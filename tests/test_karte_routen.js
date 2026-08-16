// Routen-Ebene der Sektorkarte (Etappe B-6, v8.504.0): eigene systemübergreifende Missionen
// erscheinen als gestrichelte Linie auf der Galaxie-Übersicht, schaltbar über den vierten
// Ebenen-Knopf "Routen". Die Linie nutzt MISSION_LINIEN (dieselbe Farb-/Artenquelle wie die
// Systemansicht) und ist BEWUSST ohne Fortschritts-Punkt/Restzeit gebaut, damit ihr Markup
// konstant bleibt und der Galaxie-Zwischenspeicher weiter greift.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_karte_routen.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_karte_routen.js
//   Am alten Stand fallen 1 (kein Routen-Knopf) und 2 (keine Linie).
//
// Fixture-Fakten aus dem Code abgelesen (Hausregel 4): Missionsform aus sendExploreMission
// ({id, type:'explore', targetId, startTime, endTime, fleetName, composition}); thessa liegt im
// System vega, home in kepler -> systemübergreifend. Uhr-Regel (Hausregel 18) für die
// Cache-Messung: Date.now() einfrieren, dann markieren.
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
    research: {},
    // Eine laufende Erkundung von home (kepler) nach thessa (vega) - systemübergreifend, mit
    // langer Restzeit, damit sie das ganze Messfenster über besteht.
    fleet: { jaeger: 100, ships: 3, missions: [
      { id: 'm-test-1', type: 'explore', targetId: 'thessa', startTime: now - 60000, endTime: now + 3600000, fleetName: 'Flotte 1', composition: { ships: 1 } }
    ] },
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
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(1800);
  // Seit KB-4 zeichnet nur die geöffnete Systemebene die Routen-Linien und [data-system-node] -
  // also zuerst auf dem Spielerweg ein System öffnen.
  await oeffneSystemUeberSektoren(page, 'kepler');

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  const messung = () => page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const linie = svg.querySelector('[data-karte-route="explore"]');
    const b = document.querySelector('#karteEbenenLeiste [data-karte-ebene="routen"]');
    return { knopf: !!b, an: b ? b.classList.contains('active') : null,
             linie: !!linie, farbe: linie ? linie.getAttribute('stroke') : null };
  });

  // ---- 1+2) Vorgabe an: Knopf da, Linie da, Farbe aus MISSION_LINIEN (explore-hin) ------------
  const vorgabe = await messung();
  check('1: der Routen-Knopf existiert und steht auf AN', vorgabe.knopf && vorgabe.an === true, vorgabe);
  if (!vorgabe.knopf) return ende(async () => browser.close());
  check('2: die systemübergreifende Erkundung erscheint als Linie in der Erkundungsfarbe',
    vorgabe.linie && vorgabe.farbe === '#378add', vorgabe);

  // ---- 3) Cache-Verträglichkeit: die Linie ändert das Markup NICHT jede Sekunde ---------------
  // Uhr einfrieren, Tick verstreichen lassen, DANN markieren (Hausregel 18). Eine Linie mit
  // Restzeit/Fortschritt im Markup würde hier durchfallen - genau das soll sie nicht haben.
  await page.evaluate(() => { const fest = Date.now(); Date.now = () => fest; });
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    svg.querySelectorAll('[data-system-node]').forEach((n, i) => { n.__marke = 'm' + i; });
    window.__markenZahl = svg.querySelectorAll('[data-system-node]').length;
  });
  await page.waitForTimeout(3400);
  const leerlauf = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const knoten = [...svg.querySelectorAll('[data-system-node]')];
    return { erwartet: window.__markenZahl, markiert: knoten.filter(n => n.__marke).length };
  });
  check('3: mit laufender Mission steht die Übersicht im Leerlauf weiterhin still (Cache greift)',
    leerlauf.markiert === leerlauf.erwartet && leerlauf.erwartet > 0, leerlauf);

  // ---- 4) Routen aus: Linie weg -----------------------------------------------------------------
  await page.evaluate(() => document.querySelector('#karteEbenenLeiste [data-karte-ebene="routen"]').click());
  await page.waitForTimeout(600);
  const aus = await messung();
  check('4: Routen AUS nimmt die Missionslinie von der Karte', !aus.linie && aus.an === false, aus);

  check('5: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
