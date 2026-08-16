// Asteroiden-Info im Kartenmenü (Etappe AS-1, v8.512.0): Der Klick auf einen Asteroiden zeigt
// jetzt unter dem Menükopf (a) die Ressourcen-Anteile der Sorte (aus ASTEROID_SORTEN.res,
// derselben Quelle wie der Abbau), (b) einen Vorrats-Balken a.vorrat/groesse.vorrat in der
// Größen-Farbe und (c) die Zahl "Vorrat: X von Y (Z%)". Die vorher überfrachtete (und auf dem
// Handy abgeschnittene) Titelzeile trägt den Vorrat nicht mehr.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_asteroiden_info.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_asteroiden_info.js
//   Am alten Stand fällt 2 (kein .kmenu-info-Block) und 3 (Vorrat steht noch in der Titelzeile).
//
// Weg zum Gürtelsystem aus dem Code abgelesen (Hausregel 4): guertelSysteme() ist
// deterministisch, im Solo-Betrieb erzeugt asteroidFeldSicherstellen() das Feld lokal - der Test
// klickt sich mit ▶ durch die Systeme, bis die Systemebene [data-map-asteroid]-Knoten trägt
// (20 von ~77 Systemen sind Gürtel; die Schleife ist gedeckelt und meldet sonst sauber rot).
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
  await page.waitForTimeout(1200);
  // Seit KB-4: über die Sektoren hinein - danach ist die ◀/▶-Zeile sichtbar und die
  // Gürtel-Suche über systemNextBtn läuft wie zuvor auf der Systemebene.
  await oeffneSystemUeberSektoren(page, 'kepler');

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- 1) Zum ersten Gürtelsystem klicken (deterministisch, gedeckelt) ------------------------
  let gefunden = false, schritte = 0;
  for (; schritte < 30; schritte++) {
    const hatAst = await page.evaluate(() => !!document.querySelector('#galaxySystemLayer [data-map-asteroid]'));
    if (hatAst) { gefunden = true; break; }
    await page.evaluate(() => document.getElementById('systemNextBtn').click());
    await page.waitForTimeout(900);
  }
  check('1: ein Gürtelsystem mit Asteroiden ist erreichbar (Schritte: ' + schritte + ')', gefunden);
  if (!gefunden) return ende(async () => browser.close());

  // ---- 2) Klick auf den Asteroiden öffnet das Menü MIT Info-Block -----------------------------
  const menue = await page.evaluate(async () => {
    const ast = document.querySelector('#galaxySystemLayer [data-map-asteroid]');
    ast.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    const m = document.querySelector('.kmenu');
    if (!m) return { da: false };
    const info = m.querySelector('.kmenu-info');
    const balken = info ? info.querySelector('.progress-outer .progress-inner') : null;
    const breite = balken ? parseInt(balken.style.width, 10) : null;
    return { da: true, info: !!info,
             resAnteile: info ? (info.querySelector('.kmenu-info-res') || {}).textContent || '' : '',
             balken: !!balken, breite,
             zahl: info ? ((info.querySelector('.kmenu-info-zahl') || {}).textContent || '') : '',
             titel: (m.querySelector('.kmenu-titel') || {}).textContent || '' };
  });
  check('2: das Menü zeigt Info-Block mit Ressourcen-Anteilen, Balken (0-100%) und Vorrats-Zahl',
    menue.da && menue.info && /%/.test(menue.resAnteile) && menue.balken &&
    menue.breite !== null && menue.breite >= 0 && menue.breite <= 100 &&
    /Vorrat: .+ von .+ \(\d+%\)/.test(menue.zahl), menue);

  // ---- 3) Die Titelzeile ist entlastet: der Vorrat steht nicht mehr dort ----------------------
  check('3: die Titelzeile trägt den Vorrat nicht mehr (steht jetzt im Info-Block)',
    menue.da && !/Vorrat/.test(menue.titel), { titel: menue.titel });

  check('4: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
