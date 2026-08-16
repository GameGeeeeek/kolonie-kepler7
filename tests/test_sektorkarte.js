// Sektoren-Karte, Ebene 1 (Modell B, Etappe KB-1): Die Einstellung "Sektoren-Karte" ersetzt die
// Freiflug-Galaxie durch eine Übersicht mit acht antippbaren Sektorregionen (konvexe Hüllen um
// die Mitgliedssysteme, Zuordnung = nächstes SEKTOR_DEFS-Zentrum). Ein Tipp öffnet den Sektor
// (KB-1: gezoomter Freiflug-Ausschnitt), "Zurücksetzen" führt zur Übersicht zurück.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_sektorkarte.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_sektorkarte.js
//   Am alten Stand fällt 1 (keine [data-sektor]-Regionen trotz aktivierter Einstellung).
//
// Regel statt Momentaufnahme (Hausregel 3): Die Vollständigkeit der Zuordnung wird als Summe
// gemessen (jede Region meldet data-anzahl, die Summe muss dem svg-Gesamtzähler entsprechen und
// alle Regionen müssen belegt sein) - nicht als feste Systemzahl, die beim nächsten neuen
// System veralten würde.
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
  // Seit KB-4 ("nur noch die Sektoren-Karte") gibt es die Einstellung uiSektorKarte nicht mehr -
  // ein Spielstand OHNE das Feld muss die Übersicht zeigen. Alte Spielstände, die noch
  // uiSektorKarte:false tragen, prüft Abschnitt 4 gesondert.
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

  // ---- 1) Übersicht: acht Regionen, jede belegt, Summe stimmt mit dem Gesamtzähler überein ----
  const ueb = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const regionen = [...svg.querySelectorAll('[data-sektor]')];
    return { anzahl: regionen.length,
             leere: regionen.filter(g => +(g.dataset.anzahl||0) === 0).length,
             summe: regionen.reduce((a,g) => a + (+g.dataset.anzahl||0), 0),
             gesamt: +(svg.dataset.sektorSumme||0),
             heim: regionen.some(g => /🏠/.test(g.textContent)),
             namen: regionen.map(g => (g.querySelector('text')||{}).textContent||'') };
  });
  check('1: die Übersicht zeigt acht belegte Sektorregionen und die Zuordnung ist vollständig (Summe = Gesamtzähler)',
    ueb.anzahl === 8 && ueb.leere === 0 && ueb.summe === ueb.gesamt && ueb.gesamt >= 60 && ueb.heim,
    { anzahl: ueb.anzahl, leere: ueb.leere, summe: ueb.summe, gesamt: ueb.gesamt, heim: ueb.heim });
  if (ueb.anzahl === 0) return ende(async () => browser.close());

  // ---- 2) Tipp auf eine Region öffnet den Sektor (Freiflug-Ausschnitt, Regionen weg) ----------
  const vorher = await page.evaluate(() => document.getElementById('galaxyMapSvg').getAttribute('viewBox'));
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-sektor="kepler"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(800);
  const offen = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    return { regionen: svg.querySelectorAll('[data-sektor]').length,
             viewBox: svg.getAttribute('viewBox'),
             systeme: svg.querySelectorAll('[data-system], circle').length };
  });
  check('2: der Tipp auf Kepler-Kern öffnet den Sektor - Regionen weg, Ausschnitt gewechselt, Karte gefüllt',
    offen.regionen === 0 && offen.viewBox !== vorher && offen.systeme > 5, { viewBoxVorher: vorher, ...offen });

  // ---- 3) "Zurücksetzen" führt zur Übersicht zurück -------------------------------------------
  await page.evaluate(() => { const b = document.getElementById('galaxyZoomResetBtn'); if (b) b.click(); });
  await page.waitForTimeout(800);
  const zurueck = await page.evaluate(() => document.querySelectorAll('#galaxyMapSvg [data-sektor]').length);
  check('3: „Zurücksetzen" zeigt wieder die Sektoren-Übersicht', zurueck === 8, { regionen: zurueck });

  // ---- 4) Die Einstellung ist ersatzlos weg (KB-4): keine Schalter-Zeile mehr, und selbst ein
  //         ALTER Spielstand mit uiSektorKarte:false bekommt die Sektoren-Karte -----------------
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="einstellungen"]'); if (b) b.click(); });
  await page.waitForTimeout(900);
  const zeile = await page.evaluate(() => !!document.getElementById('uiSektorKarteToggleRow'));
  check('4a: die frühere Einstellungs-Zeile „Sektoren-Karte" existiert nicht mehr', zeile === false, { zeile });

  const ctx2 = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page2 = await ctx2.newPage();
  const store2 = {};
  store2['kepler7-save-v3'] = JSON.stringify(Object.assign(JSON.parse(store['kepler7-save-v3']), { uiSektorKarte: false }));
  await page2.route('**/api/**', backend(store2));
  await page2.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page2.goto(DATEI);
  await page2.waitForTimeout(2500);
  await page2.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page2.waitForTimeout(1500);
  const alt = await page2.evaluate(() => document.querySelectorAll('#galaxyMapSvg [data-sektor]').length);
  check('4b: auch ein alter Spielstand mit uiSektorKarte:false zeigt die Sektoren-Übersicht', alt === 8, { regionen: alt });
  await ctx2.close();

  check('6: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
