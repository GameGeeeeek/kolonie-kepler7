// Die Weltlage-Zeile im Galaxie-Tab (Phase 4 der Aliens/Asteroidenfestungen).
//
//   node tests/test_weltlage.js
//
// Die galaktische Gegnerstaerke ist seit Backend-#145 kein Zeitzaehler mehr, sondern ein
// TAUZIEHEN gegen den Nestbestand. Ein Schwierigkeitsregler, den der Spieler bewegt, aber nicht
// sieht, ist kein Spielelement - deshalb diese Zeile, und deshalb dieser Test.
//
// GEPRUEFT WIRD:
//   1. Die drei RICHTUNGEN (rauf, runter, steht) - und zwar am gerenderten Text, nicht am Code.
//   2. DIE WICHTIGSTE PRUEFUNG: Fehlt `npcStaerkeZiel`, entfaellt die Zeile ERSATZLOS. Ein
//      Server vor Phase 4 und der Solo-Betrieb schicken das Feld nicht; ein "unbekannt" waere
//      hier die Falschaussage (Hausregel 35 in ihrer Gegenrichtung: drei Zustaende, und der
//      dritte ist SCHWEIGEN, weil es nichts abzuleiten gibt).
//   3. Die Zeile MISST, statt zu behaupten (Hausregel 61): Zwei Laeufe mit unterschiedlichem
//      `npcEmpireStrength` muessen unterschiedliche ZAHLEN zeigen. Eine Pruefung auf "das Wort
//      Wehrkraft steht da" waere in beiden Faellen gruen.
//   4. Der Nestbestand steht dabei - Einzahl und Mehrzahl aus dem echten Feld abgeleitet.
//   5. Der Hilfetext behauptet die alte Regel NICHT mehr und nennt die neue.
//
// GEGENPROBEN (in beide Richtungen ausfuehren, Hausregel 1):
//   * `npcStaerkeZiel` aus galaxyCache-Vorgabe und Zweig entfernt -> 1a/1b/1c/3a fallen.
//   * Die Zeile bedingungslos zeichnen (statt am typeof-Wachposten) -> 2a faellt.
//   * Den alten Hilfetext zurueck -> 5a faellt.
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const FILE = 'file://' + path.resolve(process.env.KEPLER_SPIELDATEI || SPIELDATEI);
const S = fs.readFileSync(path.resolve(process.env.KEPLER_SPIELDATEI || SPIELDATEI), 'utf8');

/* PATCHNOTES sind unveraenderliche Historie und zitieren zwangslaeufig alte Formulierungen -
   eine verneinende Pruefung ueber die GANZE Datei faende ihren eigenen Behebungs-Eintrag
   wieder (Hausregel 46). Nur die verneinenden Pruefungen brauchen das. */
const OHNE_HISTORIE = (() => {
  const v = S.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : S.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? S.slice(0, v) + S.slice(b) : S;
})();

function backend(store, galaxy) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s) => r.fulfill({ status: s || 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
    if (p === 'galaxy') return j(Object.assign({
      npcEmpireStrength: 1, marketTrend: 1, unlockedAlienRaces: [], collapsedSystems: {},
      activeWormhole: null, news: [], controlledSystems: {}, factions: {}
    }, galaxy));
    if (p.indexOf('storage/') === 0) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))
      return j(p.indexOf('pending') >= 0 ? { reward: null } : []);
    return j({});
  };
}

// Die Ereignis-Uhren gepinnt (Hausregel 18); das Zufallsereignis hat keine Uhr (Hausregel 65),
// stoert hier aber nicht: Gemessen wird der Textinhalt EINER Box, keine Fensterlage.
function speicher() {
  const t = Date.now();
  return JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    seenTabHints: { basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
      galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1 },
    resources: { energie: 412000, erz: 388000, kristalle: 264000, deuterium: 151000, antimaterie: 19400, forschungspunkte: 31200 },
    buildings: { solar: 20, mine: 19, raffinerie: 15, synth: 13, labor: 12, werft: 12, hangar: 8, lager: 12 },
    research: {}, fleet: { jaeger: 420, missions: [] }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A', allianceTag: '', avatarKey: null },
    xp: 64000, buffs: [], lastTick: t,
    nextPlanetEventCheck: t + 3600000, nextTraderCheck: t + 3600000
  });
}

async function messen(browser, galaxy) {
  const store = { 'kepler7-save-v3': speicher() };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend(store, galaxy));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE);
  await page.waitForTimeout(2400);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
    const t = document.querySelector('[data-tab="galaxie"]'); if (t) t.click();
  });
  // Mindestens ein voller Haupt-Tick: renderGalaxyNews laeuft dort, und der Galaxie-Abruf
  // haengt am Netz-Mock, nicht am Klick.
  await page.waitForTimeout(2600);
  // GESCOPT auf die Box (Hausregel 5) - "Wehrkraft" koennte sonst aus einem Hilfetext kommen.
  const r = await page.evaluate(() => {
    const box = document.getElementById('galaxyNewsBox');
    return { text: box ? (box.innerText || '') : '(keine Box)', hatBox: !!box };
  });
  r.bootfehler = fehler.slice(0, 2);
  await ctx.close();
  return r;
}

const nest = (id, volk, sys, stufe) => ({ id, volk, sys, stufe, lp: 1000, lpMax: 1000 });

(async () => {
  const browser = await starteBrowser();
  try {
    // ---- 1) Die drei Richtungen -----------------------------------------------------------
    const rauf = await messen(browser, { npcEmpireStrength: 1.40, npcStaerkeZiel: 1.77,
      alienNester: [nest('a','kryll','vega',2), nest('b','xantheer','rigel',2)] });
    check('1a-boot: die Box ist da und der Start ist fehlerfrei',
      rauf.hatBox && rauf.bootfehler.length === 0, { bootfehler: rauf.bootfehler });
    check('1a: steigende Weltlage wird als Aufruesten benannt und nennt BEIDE Zahlen',
      /ruestet auf|rüstet auf/i.test(rauf.text) && rauf.text.includes('1,40x') && rauf.text.includes('1,77x'),
      { text: rauf.text.slice(0, 220) });

    const runter = await messen(browser, { npcEmpireStrength: 2.50, npcStaerkeZiel: 1.77,
      alienNester: [nest('a','kryll','vega',2)] });
    check('1b: fallende Weltlage wird als Beruhigung benannt und nennt BEIDE Zahlen',
      /beruhigt sich/i.test(runter.text) && runter.text.includes('2,50x') && runter.text.includes('1,77x'),
      { text: runter.text.slice(0, 220) });

    const steht = await messen(browser, { npcEmpireStrength: 1.77, npcStaerkeZiel: 1.77, alienNester: [] });
    check('1c: gleicher Ist- und Zielwert heisst "steht" - und behauptet keine Richtung',
      /Weltlage steht/i.test(steht.text) && !/ruestet auf|rüstet auf|beruhigt sich/i.test(steht.text),
      { text: steht.text.slice(0, 220) });

    // ---- 2) Ohne das Feld schweigt die Zeile - die wichtigste Pruefung ---------------------
    const ohne = await messen(browser, { npcEmpireStrength: 2.50, alienNester: [nest('a','kryll','vega',3)] });
    check('2a: ohne npcStaerkeZiel steht KEINE Weltlage-Zeile da (kein "unbekannt")',
      !/Wehrkraft der NPC-Reiche/i.test(ohne.text) && !/Weltlage/i.test(ohne.text),
      { text: ohne.text.slice(0, 220),
        hinweis: 'ein Server vor Phase 4 schickt das Feld nicht - dann gibt es nichts zu sagen' });

    // ---- 3) Die Zeile MISST, statt zu behaupten (Hausregel 61) ------------------------------
    check('3a: dieselbe Zeile zeigt bei anderem Ist-Wert eine ANDERE Zahl',
      rauf.text.includes('1,40x') && runter.text.includes('2,50x') && !rauf.text.includes('2,50x'),
      { mitIst140: /1,40x/.test(rauf.text), mitIst250: /2,50x/.test(runter.text) });

    // ---- 4) Der Nestbestand steht dabei ----------------------------------------------------
    check('4a: Mehrzahl bei zwei Nestern', /2<?\/?strong>? ?Alien-Nester|2 Alien-Nester/.test(rauf.text.replace(/\s+/g,' ')),
      { text: rauf.text.slice(0, 220) });
    check('4b: Einzahl bei einem Nest, Mehrzahl-Formulierung kommt nicht vor',
      /ein Alien-Nest/.test(runter.text) && !/Alien-Nester/.test(runter.text),
      { text: runter.text.slice(0, 220) });
    check('4c: und "kein Alien-Nest" bei leerem Bestand',
      /kein Alien-Nest/.test(steht.text), { text: steht.text.slice(0, 220) });

    // ---- 5) Der Hilfetext -------------------------------------------------------------------
    check('5a: der Hilfetext behauptet die alte Regel nicht mehr',
      !OHNE_HISTORIE.includes('steigt langsam über die Zeit'),
      { hinweis: 'die Wehrkraft ist seit Phase 4 kein Zeitzaehler mehr' });
    check('5b: und er nennt den Nestbestand als Ursache',
      /Bestand an Alien-Nestern/.test(S) && /Wehrkraft der Galaxie/.test(S));
    check('5c: die Voelker gelten nicht mehr als folgenlose Weltgeschichte',
      !OHNE_HISTORIE.includes('kein direkter Gameplay-Effekt außer der Anzeige selbst'));
  } finally {
    await browser.close();
  }
  ende();
})();
