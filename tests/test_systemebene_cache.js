// Systemebene der Sektorkarte: Markup-Zwischenspeicher + ruhende Sterne (Etappe B-2, v8.498.0).
//
// Ausgangsbefund (aus dem Code, Kommentar an der alten Schreibstelle): Die Galaxie-Ebene hat seit
// v8.310.0 ihren Markup-Vergleich, die Systemebene wurde aber bewusst "IMMER neu gefüllt", damit
// Countdowns weiterlaufen - buildMap() schrieb die Gruppe also jede Sekunde per innerHTML neu und
// verdrahtete alle Klickziele neu. Dazu waren die 30 Hintergrundsterne per Math.random() gesetzt:
// das Markup war bei jedem Aufbau ein anderes (die Sterne sprangen sichtbar) - derselbe Fehler,
// der bei den Galaxie-Sternen am 26.07.2026 behoben wurde.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_systemebene_cache.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_systemebene_cache.js
//   Am alten Stand fallen 1 (Ebene wird jede Sekunde neu geschrieben), 1b (Sterne springen)
//   und 3a (moonListWrap wird jede Sekunde neu geschrieben).
//
// Uhr-Regel (Hausregel 18): Date.now() wird EINGEFROREN, bevor markiert wird. Mit stehender Uhr
// steht jeder legitime Countdown (Missionslinien, Terraforming) still - das Markup ist konstant,
// und ein kaputter Cache fällt trotzdem durch (die Marke stirbt am Schreiben, nicht am Inhalt).
// Fixture-Schlüssel aus dem Code abgelesen (Hausregel 4): thessa liegt im System vega, nicht in
// kepler - sein Mond landet deshalb im moonListWrap ("Weitere Monde"), nicht in der Planetenliste.
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
    research: {}, fleet: { jaeger: 100, ships: 3, colonyShips: 1, missions: [] },
    discovered: { rhea: true, aion: true },
    colonies: {}, activeBasePlanet: 'home',
    // thessa (System vega) hat einen Mond: der Elternplanet liegt außerhalb des angezeigten
    // Systems, also erscheint der Mond im moonListWrap-Fallback "Weitere Monde (anderes System)".
    moons: { thessa: { formedAt: now - 86400000 } },
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, prestige: 4, buffs: [], lastTick: now,
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
  // Heimatsystem aufklappen (galaxyOeffne öffnet immer, kein Toggle) und die Kamerafahrt
  // ausklingen lassen, BEVOR die Uhr steht.
  await oeffneSystemUeberSektoren(page, 'kepler');
  await page.waitForTimeout(2000);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  const grundlage = await page.evaluate(() => {
    const g = document.getElementById('galaxySystemLayer');
    return { da: !!g, kinder: g ? g.childElementCount : 0,
             planeten: g ? g.querySelectorAll('[data-planet]').length : 0 };
  });
  check('0-vorab: Systemebene ist aufgeklappt und gefüllt', grundlage.da && grundlage.kinder > 10 && grundlage.planeten >= 3, grundlage);
  if (!grundlage.da || fehler.length || grundlage.planeten < 3) return ende(async () => browser.close());

  // ---- 1) Leerlauf: Ebene wird nicht neu geschrieben, Sterne stehen ----------------------------
  // Uhr einfrieren, einen Tick verstreichen lassen, DANN markieren (Hausregel 18 - Reihenfolge
  // ist Teil der Regel).
  await page.evaluate(() => { const fest = Date.now(); Date.now = () => fest; });
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    const g = document.getElementById('galaxySystemLayer');
    g.querySelectorAll('[data-planet]').forEach((n, i) => { n.__marke = 'm' + i; });
    window.__markenZahl = g.querySelectorAll('[data-planet]').length;
    // Die Sterne sind die <circle> direkt unter der Gruppe (Planeten &Co. liegen in <g>).
    window.__sterneVorher = Array.from(g.children).filter(n => n.tagName === 'circle')
      .map(c => c.getAttribute('cx') + ',' + c.getAttribute('cy')).join('|');
  });
  await page.waitForTimeout(3400);   // mindestens drei Sekunden-Ticks
  const leerlauf = await page.evaluate(() => {
    const g = document.getElementById('galaxySystemLayer');
    const knoten = [...g.querySelectorAll('[data-planet]')];
    const sterne = Array.from(g.children).filter(n => n.tagName === 'circle')
      .map(c => c.getAttribute('cx') + ',' + c.getAttribute('cy')).join('|');
    return { erwartet: window.__markenZahl, markiert: knoten.filter(n => n.__marke).length,
             gesamt: knoten.length, sterneGleich: sterne === window.__sterneVorher,
             sterneZahl: sterne.split('|').length };
  });
  check('1: im Leerlauf wird die Systemebene über mehrere Ticks NICHT neu geschrieben',
    leerlauf.markiert === leerlauf.erwartet && leerlauf.gesamt === leerlauf.erwartet, leerlauf);
  check('1b: die Hintergrundsterne stehen still (deterministisch statt Math.random)',
    leerlauf.sterneGleich && leerlauf.sterneZahl >= 20, leerlauf);

  // ---- 2) Klick nach übersprungenen Ticks (Pflicht bei jeder neuen Zwischenspeicher-Anwendung):
  // Die Klick-Handler hängen an den ALTEN Knoten - genau die müssen nach den Skips noch leben.
  // Gemessen wird, was der Spieler sieht: das Kartenmenü (.kmenu) öffnet sich mit Einträgen.
  const menue = await page.evaluate(async () => {
    const g = document.getElementById('galaxySystemLayer');
    const ziel = [...g.querySelectorAll('[data-planet]')].find(n => n.getAttribute('data-planet') !== '__home__');
    if (!ziel) return { keinZiel: true };
    ziel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    const m = document.querySelector('.kmenu');
    const daten = { da: !!m, knoepfe: m ? m.querySelectorAll('[data-kmenu-i]').length : 0 };
    if (m) m.remove();   // aufräumen, damit das Menü keinen späteren Klick verdeckt
    return daten;
  });
  check('2: nach übersprungenen Ticks öffnet der Planeten-Klick weiterhin das Kartenmenü',
    menue.keinZiel !== true && menue.da === true && menue.knoepfe >= 1, menue);

  // ---- 3) moonListWrap: Leerlauf schreibt nicht, der Kolonisieren-Klick baut sichtbar um -------
  const mondVorab = await page.evaluate(() => {
    const w = document.getElementById('moonListWrap');
    const btn = w ? w.querySelector('[data-colonize-moon="thessa"]') : null;
    w.querySelectorAll('.card-row').forEach((n, i) => { n.__mmarke = 'm' + i; });
    window.__mondMarken = w.querySelectorAll('.card-row').length;
    return { da: !!btn, deaktiviert: btn ? btn.disabled : null };
  });
  check('3-vorab: der Fremdsystem-Mond steht im moonListWrap mit klickbarem Kolonisieren-Knopf',
    mondVorab.da && mondVorab.deaktiviert === false, mondVorab);
  await page.waitForTimeout(3400);
  const mondLeerlauf = await page.evaluate(() => {
    const w = document.getElementById('moonListWrap');
    const zeilen = [...w.querySelectorAll('.card-row')];
    return { erwartet: window.__mondMarken, markiert: zeilen.filter(n => n.__mmarke).length, gesamt: zeilen.length };
  });
  check('3a: im Leerlauf wird moonListWrap über mehrere Ticks NICHT neu geschrieben',
    mondLeerlauf.markiert === mondLeerlauf.erwartet && mondLeerlauf.gesamt === mondLeerlauf.erwartet, mondLeerlauf);
  // Klick nach den übersprungenen Ticks = zugleich die Kein-Einfrieren-Gegenprobe: Der
  // Missionsstart muss die Karte sichtbar auf "unterwegs" umbauen (Regel 26/28: gemessen wird,
  // was der Spieler sieht, samt Grund - dem Knopftext).
  const mondKlick = await page.evaluate(async () => {
    const w = document.getElementById('moonListWrap');
    const btn = w.querySelector('[data-colonize-moon="thessa"]');
    if (!btn || btn.disabled) return { keinKnopf: true };
    btn.click();
    await new Promise(r => setTimeout(r, 1600));   // ein Render-Tick nach dem Klick
    const w2 = document.getElementById('moonListWrap');
    const b2 = w2.querySelector('[data-colonize-moon="thessa"]');
    const zeilen = [...w2.querySelectorAll('.card-row')];
    return { neuGebaut: zeilen.filter(n => n.__mmarke).length === 0,
             unterwegs: !!b2 && /unterwegs/.test(b2.textContent) && b2.disabled };
  });
  check('3b: nach übersprungenen Ticks startet "Kolonisieren" die Mondmission und die Box baut neu',
    mondKlick.keinKnopf !== true && mondKlick.unterwegs === true && mondKlick.neuGebaut === true, mondKlick);

  // ---- 4) Gegenprobe gegen Einfrieren: Systemwechsel baut die Ebene sichtbar neu ---------------
  const wechsel = await page.evaluate(async () => {
    const vorher = document.getElementById('systemNavName') ? document.getElementById('systemNavName').textContent : '';
    const btn = document.getElementById('systemNextBtn');
    if (!btn) return { keinKnopf: true };
    btn.click();
    await new Promise(r => setTimeout(r, 1600));
    const g = document.getElementById('galaxySystemLayer');
    const knoten = g ? [...g.querySelectorAll('[data-planet]')] : [];
    const nachher = document.getElementById('systemNavName') ? document.getElementById('systemNavName').textContent : '';
    return { markiert: knoten.filter(n => n.__marke).length, gesamt: knoten.length,
             nameGeaendert: vorher !== nachher, vorher, nachher };
  });
  check('4: der Wechsel in ein anderes System baut die Ebene neu auf (kein Einfrieren)',
    wechsel.keinKnopf !== true && wechsel.markiert === 0 && wechsel.gesamt >= 1 && wechsel.nameGeaendert, wechsel);

  check('5: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
