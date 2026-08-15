// Ebenen-Leiste der Sektorkarte (Etappe B-5, v8.502.0): drei schaltbare Zeichen-Ebenen der
// Galaxie-Übersicht - Fraktionen (Territorium-Flächen), Ereignisse (Piratenbasis/Aliens/Krieg +
// Wurmloch), Aufklärung (Spähberichte/Peilungen). Vorgabe alles an; die Auswahl wird im
// Spielstand gespeichert (state.karteEbenen).
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_karte_ebenen.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_karte_ebenen.js
//   Am alten Stand fällt 1 (keine Leiste) und damit alles Weitere.
//
// Fixture-Fakten aus dem Code abgelesen (Hausregel 4): factionOwning() rendert Territorium nur
// für Fraktionen, deren id in FACTION_DIPLOMACY steht (kartell/void/legion/schatten); die Fläche
// heißt <g class="terr-<fid>">. Piratenbasis-Abzeichen 🏴‍☠️ hängt an
// galaxyCache.activePirateFaction.system, Krieg ⚔️ an activeWar.system.
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
    // Alle drei Ebenen haben etwas zu zeigen: Kartell-Territorium um vega, Piratenbasis in vega,
    // Krieg in orion. Aufklärung kommt aus dem Spielstand (spyIntel), nicht vom Server.
    if (p === 'galaxy') return j({ npcEmpireStrength: 1, marketTrend: 1,
      activePirateFaction: { system: 'vega', name: 'Testpiraten' },
      unlockedAlienRaces: [], activeWar: { system: 'orion', factionA: 'Kartell', factionB: 'Legion' },
      collapsedSystems: {}, activeWormhole: null, news: [], controlledSystems: {},
      factions: { kartell: { id: 'kartell', name: 'Das Kartell', color: '#e0a548', systems: ['vega'] } } });
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
  await page.waitForTimeout(1800);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  const messung = () => page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const knopf = k => {
      const b = document.querySelector('#karteEbenenLeiste [data-karte-ebene="' + k + '"]');
      return b ? { da: true, an: b.classList.contains('active') } : { da: false };
    };
    return {
      terr: !!svg.querySelector('g.terr-kartell'),
      pirat: svg.textContent.includes('🏴'),
      krieg: svg.textContent.includes('⚔'),
      fraktionen: knopf('fraktionen'), ereignisse: knopf('ereignisse'), aufklaerung: knopf('aufklaerung')
    };
  });

  // ---- 1) Vorgabe: Leiste da, alle drei an, alle Ebenen sichtbar ------------------------------
  const vorgabe = await messung();
  check('1: die Ebenen-Leiste existiert und alle drei Knöpfe stehen auf AN',
    vorgabe.fraktionen.da && vorgabe.fraktionen.an && vorgabe.ereignisse.an && vorgabe.aufklaerung.an, vorgabe);
  if (!vorgabe.fraktionen.da) return ende(async () => browser.close());
  check('1b: mit allem an zeigt die Karte Territorium, Piratenbasis und Krieg',
    vorgabe.terr && vorgabe.pirat && vorgabe.krieg, vorgabe);

  // ---- 2) Ereignisse aus: Abzeichen weg, Territorium bleibt -----------------------------------
  await page.evaluate(() => document.querySelector('#karteEbenenLeiste [data-karte-ebene="ereignisse"]').click());
  await page.waitForTimeout(600);
  const ohneEreignisse = await messung();
  check('2: Ereignisse AUS nimmt Piraten- und Kriegs-Abzeichen von der Karte, Territorium bleibt',
    !ohneEreignisse.pirat && !ohneEreignisse.krieg && ohneEreignisse.terr && !ohneEreignisse.ereignisse.an,
    ohneEreignisse);

  // ---- 3) Fraktionen aus: Fläche weg --------------------------------------------------------
  await page.evaluate(() => document.querySelector('#karteEbenenLeiste [data-karte-ebene="fraktionen"]').click());
  await page.waitForTimeout(600);
  const ohneFraktionen = await messung();
  check('3: Fraktionen AUS nimmt die Territoriums-Fläche von der Karte',
    !ohneFraktionen.terr && !ohneFraktionen.fraktionen.an, ohneFraktionen);

  // ---- 4) Persistenz: die Auswahl steht im gespeicherten Spielstand ---------------------------
  // Gemessen am tatsächlich zum Server geschickten Save (der Testserver fängt das PUT ab) -
  // nicht an internem Zustand (Regel 26: messen, was BLEIBT).
  await page.waitForTimeout(1500);
  let gespeichert = null;
  try { gespeichert = JSON.parse(store['kepler7-save-v3']).karteEbenen; } catch (e) {}
  check('4: der Spielstand speichert die Ebenen-Auswahl (ereignisse & fraktionen aus)',
    !!gespeichert && gespeichert.ereignisse === false && gespeichert.fraktionen === false, { gespeichert });

  // ---- 5) Wieder an: die Abzeichen kommen zurück ----------------------------------------------
  await page.evaluate(() => {
    document.querySelector('#karteEbenenLeiste [data-karte-ebene="ereignisse"]').click();
    document.querySelector('#karteEbenenLeiste [data-karte-ebene="fraktionen"]').click();
  });
  await page.waitForTimeout(600);
  const wiederAn = await messung();
  check('5: Wieder-Einschalten bringt Abzeichen und Fläche zurück',
    wiederAn.terr && wiederAn.pirat && wiederAn.krieg && wiederAn.ereignisse.an && wiederAn.fraktionen.an,
    wiederAn);

  check('6: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
