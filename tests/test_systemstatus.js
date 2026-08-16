// Status-Chips der Detailtafel + Eroberungs-Wahrheit (Etappe B-4, v8.501.0):
// (1) Der Tafelkopf zeigt Status-Chips aus vorhandenen Daten: Gegner im System, Trümmerfelder,
//     fremde/eigene Eroberung. (2) Die Galaxie-Übersicht färbt nur noch die EIGENE Eroberung als
//     "★ Kontrolle" - controlledSystems ist die globale Karte systemId -> userId ALLER Spieler
//     (server.js legt sie genau so an), der alte Existenz-Check färbte jedes von irgendwem
//     eroberte System grün.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_systemstatus.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_systemstatus.js
//   Am alten Stand fallen 1/2/3 (keine Chips-Zeile) und 4 (der Vega-Knoten trägt das
//   Kontroll-Sternchen, obwohl ein FREMDER Spieler das System hält).
//
// Fixture-Fakten aus dem Code abgelesen (Hausregel 4): raider1 "Void-Marodeure" sitzt
// forschungsfrei in kepler, raider2 "Schrottgarde-Klan" in vega (NPCS-Array); /api/galaxy
// speist galaxyCache (loadGalaxyState) - der Test serviert dort eine FREMDE Eroberung von vega.
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
    // Galaxie-Zustand: vega ist von einem FREMDEN Spieler erobert (uid 'jemand-anderes' != 'u').
    if (p === 'galaxy') return j({ npcEmpireStrength: 1, marketTrend: 1, activePirateFaction: null,
      unlockedAlienRaces: [], activeWar: null, collapsedSystems: {}, activeWormhole: null, news: [],
      controlledSystems: { vega: 'jemand-anderes' }, factions: {} });
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
    colonies: { rhea: { buildings: { solar: 3, mine: 2, habitat: 1 }, fleet: { ships: 2, missions: [] } } },
    activeBasePlanet: 'home',
    // Ein Trümmerfeld auf rhea (kepler) - muss als Chip erscheinen, in vega nicht.
    debrisFields: { rhea: { erz: 500, kristalle: 200 } },
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
  // Seit KB-4: über die Sektoren hinein (Übersicht -> Region -> System).
  await oeffneSystemUeberSektoren(page, 'kepler');
  await page.waitForTimeout(1000);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- 1+2) Chips im Heimatsystem: Gegner + Trümmerfeld ---------------------------------------
  const chipsHeim = await page.evaluate(() => {
    const el = document.getElementById('systemStatusChips');
    return el ? { da: true, sichtbar: el.style.display !== 'none', text: el.textContent } : { da: false };
  });
  check('1: die Chips-Zeile existiert und ist bei offenem System sichtbar',
    chipsHeim.da && chipsHeim.sichtbar, chipsHeim);
  check('2: kepler zeigt den Gegner-Chip (Void-Marodeure) und das Trümmerfeld auf Rhea',
    chipsHeim.da && /Void-Marodeure/.test(chipsHeim.text) && /1 Trümmerfeld/.test(chipsHeim.text), chipsHeim);

  // ---- 3) Im fremden System: fremde Eroberung als Chip, Trümmerfeld verschwindet --------------
  const chipsVega = await page.evaluate(async () => {
    const btn = document.getElementById('systemNextBtn');
    if (!btn) return null;
    btn.click();
    await new Promise(r => setTimeout(r, 1600));
    const el = document.getElementById('systemStatusChips');
    const name = document.getElementById('systemNavName');
    return { text: el ? el.textContent : null, name: name ? name.textContent : null };
  });
  check('3: vega zeigt die FREMDE Eroberung und den eigenen Gegner-Chip, kein Kepler-Trümmerfeld',
    !!chipsVega && /Erobert \(fremder Spieler\)/.test(chipsVega.text || '') &&
    /Schrottgarde-Klan/.test(chipsVega.text || '') && !/Trümmerfeld/.test(chipsVega.text || ''),
    chipsVega);

  // ---- 4) Sektoransicht: KEIN Kontroll-Stern für die fremde Eroberung -------------------------
  // Seit KB-4 führt das Schließen in die Sektoransicht der Region - dort trägt der Vega-Knoten
  // Meta-Text und ggf. den Kontroll-Ring. Am alten Befund (v8.501.0) stand "★ Kontrolle" für
  // JEDE Eroberung; die Regel bleibt: fremde Eroberung -> keine Kontroll-Markierung.
  const knoten = await page.evaluate(async () => {
    const zurueck = document.getElementById('galaxyBackBtn');
    if (zurueck) zurueck.click();
    await new Promise(r => setTimeout(r, 1600));
    const n = document.querySelector('#galaxyMapSvg [data-sektor-sys="vega"]');
    return n ? { text: n.textContent, kontrollRing: !!n.querySelector('[data-ring="kontrolle"]') } : null;
  });
  check('4: der Vega-Knoten der Sektoransicht trägt KEINEN Kontroll-Stern für die fremde Eroberung',
    !!knoten && !/Kontrolle/.test(knoten.text) && !knoten.kontrollRing, knoten);

  check('5: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
