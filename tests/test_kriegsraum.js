// Der Kriegsraum: Zeigt der Unterreiter „Front" den Frontzustand wirklich – mit den neuen Wappen,
// den richtigen Haltern und der eigenen Beteiligung?
//
// Warum das ein Browsertest sein muss: Der Kriegsraum liest ausschließlich aus galaxyCache, und
// der ist ohne Server leer. Ein Quelltexttest könnte zeigen, dass die Funktion existiert – nicht,
// dass am Ende etwas Lesbares dasteht. Und die elf neuen Wappen sind SVG-Zeichnungen: Ob sie im
// erzeugten Dokument ankommen, sieht man nur am DOM.
//
// GEMESSENE GEGENPROBE (10.08.2026): Gegen `git show HEAD:weltraum_kolonie.html` fällt der Test an
// „der Unterreiter Front existiert". Die Kontrollprüfungen („Galaxie-Tab offen", „keine
// Konsolenfehler") bleiben in beiden Läufen grün – der Test misst den Unterschied.

const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

const SAVE = {
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9e5, erz: 9e5, kristalle: 6e5, deuterium: 4e5, antimaterie: 2e4, forschungspunkte: 3e4 },
  buildings: { solar: 22, mine: 20, labor: 14, lager: 16, werft: 14 }, research: {},
  fleet: { jaeger: 600, spaeher: 20, missions: [] }, colonies: {}, activeBasePlanet: 'home',
  player: { id: 'u', name: 'A', avatarKey: null }, prestige: 2, xp: 260000, credits: 180000,
  buffs: [], lastTick: Date.now(), colonyNames: {},
  expeditionsCompleted: 3, fundmeldungenGesamt: 0, piratennesterGeraeumt: 0, tradeRouteLifetimeCredits: 0
};

// Drei Abschnitte mit ABSICHTLICH verschiedenen Zuständen: einer klar von A gehalten (900),
// einer umkämpft (500), einer an B gefallen (120). Gleiche Werte würden eine vertauschte
// Zuordnung nicht auffallen lassen.
const GALAXIE = {
  factions: {
    kartell:  { id: 'kartell',  name: 'Aschen-Kartell', color: '#fac775', systems: ['orion'], strength: 2 },
    schatten: { id: 'schatten', name: 'Schattenbund',   color: '#6fd0c0', systems: ['rand'],  strength: 2 },
    legion:   { id: 'legion',   name: 'Eisenlegion',    color: '#85b7eb', systems: [], strength: 1 },
    void:     { id: 'void',     name: 'Void-Marodeure', color: '#e24b4a', systems: [], strength: 1 }
  },
  randkriege: {
    fronten: [{ a: 'kartell', b: 'schatten', systeme: [
      { sys: 'orion', kp: 900, beitragendeA: 3, beitragendeB: 1, dabei: true },
      { sys: 'rand',  kp: 500, beitragendeA: 1, beitragendeB: 1, dabei: false },
      { sys: 'kepler', kp: 120, beitragendeA: 0, beitragendeB: 2, dabei: false }
    ] }],
    meinTag: {}, meineBasis: {}, tagesBreite: 300, nachschubZuletzt: 0,
    // Kartell auf Frontenhauptmann (3500), Schatten auf Melder (250) - zwei verschiedene Stufen.
    // Bestand und Wochenstand sind ABSICHTLICH verschieden (9 gegen 7): Mit derselben Zahl waere
    // die Bestandspruefung trivial erfuellt gewesen - genau der Fall, den die Hausregeln als
    // "gruen, ohne etwas zu belegen" beschreiben.
    meinKonto: { marken: 9, dienst: { kartell: 4000, schatten: 300 }, wocheMarken: 7, wocheDeckel: 12, markeJePunkte: 200 }
  },
  collapsedSystems: {}, controlledSystems: {}, news: [], activeWar: null, activeWormhole: null,
  npcEmpireStrength: 1, marketTrend: 1, lastTick: Date.now()
};

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    if (p === 'galaxy') return j(GALAXIE);
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
    return j({});
  };
}

(async () => {
  const browser = await starteBrowser();
  const saveStr = JSON.stringify(SAVE);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fehler.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': saveStr }));
  await page.addInitScript(s => {
    localStorage.setItem('kepler7-save-v3', s);
    localStorage.setItem('kepler7_token', 'tok');
  }, saveStr);
  await page.goto(SPIEL_URL);
  await page.waitForSelector('[data-tab="karte"]', { timeout: 20000 });
  await page.waitForTimeout(2600);
  await page.evaluate(() => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  await page.click('[data-tab="galaxie"]');

  // ---- Der Unterreiter --------------------------------------------------------------------------
  const knopf = await page.locator('[data-galaxy-subtab="front"]').count();
  check('der Unterreiter Front existiert', knopf === 1, knopf);
  if (knopf !== 1) { console.log('\nFEHLGESCHLAGEN'); await browser.close(); process.exit(1); }
  await page.click('[data-galaxy-subtab="front"]');
  await page.waitForTimeout(2200);

  const sichtbar = await page.evaluate(() => {
    const p = document.querySelector('.galaxy-subpanel[data-galaxy-sub="front"]');
    return !!p && p.style.display !== 'none';
  });
  check('das Panel wird sichtbar', sichtbar);

  const daten = await page.evaluate(() => {
    const box = document.getElementById('kriegsraumBox');
    if (!box) return null;
    return {
      text: box.textContent.replace(/\s+/g, ' '),
      svg: box.querySelectorAll('svg').length,
      // Die Wappen sind an ihren Verlaufs-Referenzen erkennbar - sie benutzen die vorhandenen
      // Verläufe des Spiels, nicht eigene.
      gold: box.innerHTML.split('url(#gGold)').length - 1,
      cyan: box.innerHTML.split('url(#gCyan)').length - 1,
      balken: box.querySelectorAll('div[style*="height:6px"]').length
    };
  });
  check('die Box ist gefüllt', !!daten && daten.text.length > 200, daten && daten.text.length);
  if (!daten) { console.log('\nFEHLGESCHLAGEN'); await browser.close(); process.exit(1); }

  // ---- Die Wappen sind wirklich da ---------------------------------------------------------------
  // Vier Wappen an der Frontkarte (2), bei den Dienstgraden (2), dazu Dienstgrad-Abzeichen und
  // Frontmarke im Kopf - mindestens sechs gezeichnete Symbole.
  check('die neuen Wappen werden als SVG gezeichnet', daten.svg >= 6, daten.svg);
  check('sie benutzen die vorhandenen Verläufe des Spiels', daten.gold > 0 && daten.cyan > 0,
    { gGold: daten.gold, gCyan: daten.cyan });

  // ---- Der Zustand je Abschnitt --------------------------------------------------------------------
  check('alle drei Abschnitte haben einen Balken', daten.balken === 3, daten.balken);
  check('der klar gehaltene Abschnitt nennt seinen Halter', /Aschen-Kartell hält/.test(daten.text), null);
  check('der gefallene Abschnitt nennt die Gegenseite', /Schattenbund hält/.test(daten.text), null);
  check('der mittlere Abschnitt heißt umkämpft', /umkämpft/.test(daten.text), null);
  check('die Beitragenden je Seite stehen da', /3:1/.test(daten.text) && /0:2/.test(daten.text),
    (daten.text.match(/\d:\d/g) || []).slice(0, 4));

  // ---- Mein Stand -----------------------------------------------------------------------------------
  check('der höchste Dienstgrad steht im Kopf', /Frontenhauptmann/.test(daten.text), null);
  check('der Markenbestand steht im Kopf', /\b9\b/.test(daten.text), daten.text.slice(0, 90));
  check('der Wochenstand steht daneben, und zwar als eigene Zahl', /7\/12/.test(daten.text), null);
  // Beide Fraktionen mit Dienstpunkten erscheinen, mit ihren VERSCHIEDENEN Graden.
  check('die Dienstgrade je Fraktion stehen unten',
    /Frontenhauptmann/.test(daten.text) && /Melder/.test(daten.text), null);
  check('und die Fraktionen ohne Dienstpunkte nicht',
    !/Eisenlegion/.test(daten.text) && !/Void-Marodeure/.test(daten.text), null);

  // ---- Der Kriegsraum bedient nichts ---------------------------------------------------------------
  // Das ist eine Zusage aus Hilfetext und Patchnote: Geliefert wird genau an EINER Stelle. Ein
  // Knopf hier wäre die zweite Bedienstelle, vor der die Hausregeln warnen.
  const knoepfe = await page.evaluate(() => {
    const box = document.getElementById('kriegsraumBox');
    return { alle: box.querySelectorAll('button').length,
      liefern: box.querySelectorAll('[data-front-liefern],[data-front-lager]').length };
  });
  check('im Kriegsraum steht kein Bedienknopf', knoepfe.alle === 0 && knoepfe.liefern === 0, knoepfe);

  check('keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles in Ordnung');
  process.exit(fail ? 1 : 0);
})();
