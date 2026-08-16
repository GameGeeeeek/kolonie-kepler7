// Sektorkarte, Richtung A (v8.491.0): Der Ausschnitt passt zum Kasten, das Verschieben klebt am
// Zeiger und schreibt die Karte nicht neu, Zurücksetzen zeigt den belegten Bereich, das Rad hält
// die Seite nicht mehr fest, und die Suche verrät keine unentdeckten Systeme.
//
// WARUM DIESE PRÜFUNGEN SO GEBAUT SIND
// ------------------------------------
// Sie messen den BILDSCHIRM, nicht die Innereien: Prüfung 2 zieht um eine bekannte Pixelstrecke und
// schaut nach, ob sich ein Systemknoten um genau dieselbe Strecke bewegt hat. Das ist die Regel, um
// die es geht ("die Karte klebt am Finger") - eine Prüfung gegen die viewBox-Zahlen wäre nur eine
// Wiederholung der Formel, die sie prüfen soll (Hausregel 3).
//
// GEGENPROBE (beide Richtungen gefahren):
//   grün:  node tests/test_kartenbedienung.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_kartenbedienung.js
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
    if (p === 'me') return j({ userId: 'u', username: 'AdmiralX', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
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
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12 },
    research: {}, fleet: { jaeger: 100, missions: [] }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'AdmiralX' }, xp: 52000, credits: 184000, prestige: 4, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    // Ereignis-Uhren in die Zukunft pinnen: der erste Planeten-Ereignis-Check feuert sonst GARANTIERT
    // und schreibt mitten in der Messung Boxen neu (siehe CLAUDE.md, Regel 18).
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
  // Auf den Kartenreiter
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  const svgDa = await page.evaluate(() => !!document.getElementById('galaxyMapSvg'));
  check('0-vorab: Karte vorhanden', svgDa);
  if (!svgDa) return ende(async () => browser.close());
  // Seit KB-4 gelten Zoomen/Verschieben nur in der geöffneten Systemebene - dorthin navigieren
  // (Übersicht -> Region -> System), alle Bedienungs-Prüfungen laufen dort.
  await oeffneSystemUeberSektoren(page, 'kepler');

  // ---- 1) Ausschnitt und Kasten haben dasselbe Seitenverhältnis --------------------------------
  const verh = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const r = svg.getBoundingClientRect();
    const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const s = Math.min(r.width / vb[2], r.height / vb[3]);
    return { kasten: r.width / r.height, ausschnitt: vb[2] / vb[3],
             leer: 1 - (vb[2] * s * vb[3] * s) / (r.width * r.height) };
  });
  check('1: Ausschnitt und Kasten haben dasselbe Seitenverhältnis',
    Math.abs(verh.kasten - verh.ausschnitt) < 0.02, verh);
  check('1b: dadurch bleibt keine Fläche des Kastens leer', verh.leer < 0.02,
    { leerAnteil: +(verh.leer * 100).toFixed(1) + '%' });

  // ---- 2) Verschieben klebt am Zeiger, auf BEIDEN Achsen ----------------------------------------
  // Gemessen wird die Bildschirmposition eines Systemknotens vor und nach dem Ziehen.
  //
  // WICHTIG - drei Fallen, alle beim Bau dieses Tests real hereingefallen:
  // (a) Gemessen wird der KREIS eines FESTEN Systems, nicht das erste <g>: Das Umriss-Rechteck der
  //     Gruppe enthält die Beschriftung, die beim Sekunden-Neuaufbau je nach Nähe wechselt, und
  //     "das erste <g>" kann nach einem Neuaufbau ein anderes System sein.
  // (b) Gemessen wird RELATIV zum SVG-Kasten, nicht in Seitenkoordinaten: Beim Sekundentick änderte
  //     ein Element OBERHALB der Karte seine Höhe um 14 px und verschob den ganzen Kasten - in
  //     Seitenkoordinaten sah das wie ein Zieh-Fehler von exakt 14 px aus, obwohl viewBox und
  //     Knoten-Markup nachweislich unverändert waren. Die Zeigerrechnung des Spiels arbeitet
  //     ebenfalls relativ zum Kasten (getBoundingClientRect je Ereignis) - das Bezugssystem des
  //     Tests muss dasselbe sein (Hausregel 21: erst die Bezugsgröße prüfen).
  async function knotenPunkt() {
    return page.evaluate(() => {
      const n = document.querySelector('[data-system-node="kepler"] circle')
        || document.querySelector('[data-system-node] circle');
      if (!n) return null;
      const svg = document.getElementById('galaxyMapSvg');
      const r = svg.getBoundingClientRect();
      const b = n.getBoundingClientRect();
      return { x: b.x + b.width / 2 - r.x, y: b.y + b.height / 2 - r.y };
    });
  }
  const kasten = await page.locator('#galaxyMapSvg').boundingBox();
  const vor = await knotenPunkt();
  check('2-vorab: ein Systemknoten ist messbar', !!vor, vor);
  if (vor) {
    const ZIEH_X = 120, ZIEH_Y = 70;
    await page.mouse.move(kasten.x + kasten.width / 2, kasten.y + kasten.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(kasten.x + kasten.width / 2 + ZIEH_X * i / 6,
                            kasten.y + kasten.height / 2 + ZIEH_Y * i / 6);
    }
    await page.mouse.up();
    await page.waitForTimeout(250);
    const nach = await knotenPunkt();
    const gx = nach.x - vor.x, gy = nach.y - vor.y;
    // Anteil der tatsächlich zurückgelegten Strecke. 1,00 heißt: klebt exakt am Zeiger.
    const treueX = gx / ZIEH_X, treueY = gy / ZIEH_Y;
    check('2a: waagerechtes Ziehen klebt am Zeiger', Math.abs(treueX - 1) < 0.08,
      { gezogen: ZIEH_X, bewegt: +gx.toFixed(1), treue: +treueX.toFixed(3) });
    check('2b: senkrechtes Ziehen klebt am Zeiger', Math.abs(treueY - 1) < 0.08,
      { gezogen: ZIEH_Y, bewegt: +gy.toFixed(1), treue: +treueY.toFixed(3) });
  }

  // ---- 3) Verschieben schreibt die Karte nicht neu ----------------------------------------------
  const bau = await page.evaluate(async () => {
    const svg = document.getElementById('galaxyMapSvg');
    let neuschriebe = 0;
    const beob = new MutationObserver(ms => { ms.forEach(m => { if (m.type === 'childList') neuschriebe++; }); });
    beob.observe(svg, { childList: true, subtree: false });
    const r = svg.getBoundingClientRect();
    const mitte = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const feuere = (typ, x, y, extra) => svg.dispatchEvent(Object.assign(
      new MouseEvent(typ, { clientX: x, clientY: y, bubbles: true }), extra || {}));
    // mousedown auf dem SVG, mousemove auf dem Fenster (so ist es verdrahtet)
    feuere('mousedown', mitte.x, mitte.y);
    for (let i = 1; i <= 15; i++) {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: mitte.x + i * 4, clientY: mitte.y + i * 2, bubbles: true }));
    }
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise(r2 => setTimeout(r2, 60));
    beob.disconnect();
    return { neuschriebe, bewegungen: 15 };
  });
  check('3: 15 Zeigerbewegungen schreiben die Karte kein einziges Mal neu',
    bau.neuschriebe === 0, bau);

  // ---- 4) Zurücksetzen schält eine Ebene nach außen (seit KB-4: System -> Sektoransicht) --------
  const reset = await page.evaluate(async () => {
    const b = document.getElementById('galaxyZoomResetBtn');
    if (b) b.click();
    await new Promise(r => setTimeout(r, 1400));
    return { ebene: !!document.getElementById('galaxySystemLayer'),
             sektorSys: document.querySelectorAll('#galaxyMapSvg [data-sektor-sys]').length };
  });
  check('4: Zurücksetzen schließt das System und führt in die Sektoransicht',
    !reset.ebene && reset.sektorSys >= 1, reset);
  // Für die Rad-Prüfungen wieder hinein ins System.
  await oeffneSystemUeberSektoren(page, 'kepler');

  // ---- 5) Rad hält die Seite nicht mehr fest ------------------------------------------------------
  const rad = await page.evaluate(async () => {
    const svg = document.getElementById('galaxyMapSvg');
    const vorher = svg.getAttribute('viewBox');
    const r = svg.getBoundingClientRect();
    const ev = new WheelEvent('wheel', { deltaY: -120, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true });
    svg.dispatchEvent(ev);
    await new Promise(x => setTimeout(x, 250));
    const ohneStrg = { verhindert: ev.defaultPrevented, geaendert: svg.getAttribute('viewBox') !== vorher };
    const vorher2 = svg.getAttribute('viewBox');
    const ev2 = new WheelEvent('wheel', { deltaY: -120, ctrlKey: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true });
    svg.dispatchEvent(ev2);
    await new Promise(x => setTimeout(x, 250));
    return { ohneStrg, mitStrg: { verhindert: ev2.defaultPrevented, geaendert: svg.getAttribute('viewBox') !== vorher2 } };
  });
  check('5a: Rollen OHNE Strg lässt die Seite scrollen und zoomt nicht',
    rad.ohneStrg.verhindert === false && rad.ohneStrg.geaendert === false, rad.ohneStrg);
  check('5b: Rollen MIT Strg zoomt weiterhin',
    rad.mitStrg.verhindert === true && rad.mitStrg.geaendert === true, rad.mitStrg);

  // ---- 6) Suche verrät keine unentdeckten Systeme ------------------------------------------------
  const suche = await page.evaluate(async () => {
    const versteckt = (typeof STAR_SYSTEMS !== 'undefined')
      ? STAR_SYSTEMS.filter(x => x.hidden).map(x => x.id) : [];
    if (!versteckt.length) return { keineGeheimen: true };
    const opfer = (typeof PLANETS !== 'undefined')
      ? PLANETS.filter(p => versteckt.includes(p.system))[0] : null;
    if (!opfer) return { keinPlanet: true };
    const feld = document.getElementById('sectorSearchInput');
    feld.value = opfer.name;
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    const kasten = document.getElementById('sectorSearchResults');
    return { name: opfer.name, system: opfer.system,
             gefunden: !!kasten && kasten.textContent.includes(opfer.name) };
  });
  if (suche.keineGeheimen || suche.keinPlanet) {
    check('6: (übersprungen – keine Geheimsysteme mit Planeten im Datenbestand)', true, suche);
  } else {
    check('6: ein Planet eines unentdeckten Systems taucht in der Suche NICHT auf',
      suche.gefunden === false, suche);
  }

  check('7: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
