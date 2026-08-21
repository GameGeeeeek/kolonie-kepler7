#!/usr/bin/env node
// Erzeugt Presse-/Verzeichnis-Screenshots aus der lokalen Spieldatei.
//
// WARUM DIESES SKRIPT IM REPO LIEGT: Fast jedes Browsergame-Verzeichnis verlangt mindestens ein
// Bild, und die Einträge werden über Monate nachgezogen. Ein Skript, das die Bilder aus dem
// AKTUELLEN Stand erzeugt, veraltet nicht - eine einmal von Hand geschossene Sammlung schon.
// Dieselbe Begründung wie bei den Tests: Was nur im Sitzungs-Scratchpad steht, gibt es beim
// nächsten Mal nicht mehr.
//
// Der Spielstand ist bewusst ein FORTGESCHRITTENES Konto (Gebäude Stufe 14-30, Flotte, Kolonien) -
// ein frischer Start zeigt leere Listen, und genau die will kein Verzeichnis abbilden.
//
// Aufruf:  node marketing-screenshots.js [zielverzeichnis]
// Vorgabe: ./presse-bilder/   (bewusst ein UNTERORDNER: der Deploy-Webhook kopiert `*.png` aus dem
//          Wurzelverzeichnis nach /deploy/web/ - Bilder dort würden ungefragt live gehen.)

const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PW_PFAD || '/opt/node22/lib/node_modules/playwright');

const WURZEL = __dirname;
const SPIELDATEI = process.env.KEPLER_SPIELDATEI || path.join(WURZEL, 'weltraum_kolonie.html');
const ZIEL = process.argv[2] || path.join(WURZEL, 'presse-bilder');
const SAVE_KEY = 'kepler7-save-v3';

// Ereignis-Uhren gepinnt und alle Reiter-Hinweise als gesehen markiert (Arbeitsregeln 18/63):
// Beides schiebt sonst Möbel ins Bild, die nur manchmal da sind - bei einem Screenshot ist das
// nicht bloss Rauschen, sondern ein Banner quer über dem Motiv.
function spielstand() {
  const jetzt = Date.now();
  const gesehen = {};
  for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) gesehen[t] = true;
  return JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: gesehen,
    // Bewusst UNTER dem Lagerdeckel: Bei vollem Lager steht in jeder Karte "+0/s (Lager voll)",
    // und ein Werbebild, das Stillstand zeigt, wirbt für Stillstand. Gemessen fasst das Lager
    // bei diesen Gebäudestufen rund 20.3k je Grundstoff.
    resources: { energie: 12400, erz: 13800, kristalle: 9100, deuterium: 6400, antimaterie: 2900, forschungspunkte: 7300 },
    buildings: { solar: 24, mine: 22, kristallmine: 20, deuteriumsynth: 18, labor: 16, lager: 30, werft: 16, roboter: 14 },
    // Die drei Freischalt-Forschungen sind PFLICHT, nicht Deko: Ohne sie steht auf dem
    // Verteidigungs-Bild jede einzelne Anlage auf "gesperrt" - acht Schlösser untereinander,
    // und das war der erste Entwurf. Schlüssel gemessen aus RESEARCH_DEFS, nicht geraten.
    research: { rlaser: 8, rschild: 7, rantrieb: 9, rspionage: 6,
                rpanzer: 6, rschildmatrix: 5, rnanotech: 4 },
    fleet: { jaeger: 140, cruisers: 46, destroyers: 18, frachter: 30, missions: [] },
    colonies: {}, activeBasePlanet: 'home', player: { id: 'u', name: 'Kommandant', avatarKey: null },
    xp: 1.4e6, credits: 8e5, buffs: [], lastTick: jetzt, colonyNames: {}, modules: {}, shipModules: {},
    nextPlanetEventCheck: jetzt + 3600000, nextTraderCheck: jetzt + 3600000
  });
}

// Der Solo-Betrieb zeigt in mehreren Boxen "nur mit Serververbindung". Für ein Werbebild ist das
// die falsche Aussage - deshalb ein Mock, der die Boxen füllt, statt sie zu sperren.
function backend(save) {
  return async r => {
    const p = r.request().url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'Kommandant', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
    if (p === 'galaxy') return j({ npcEmpireStrength: 1.8, npcStaerkeZiel: 2.1, marketTrend: 1, activePirateFaction: null,
      unlockedAlienRaces: [], activeWar: null, collapsedSystems: {}, activeWormhole: null, news: [], alienNester: [] });
    if (p === 'asteroid/field') return j({ systeme: [], felder: {} });
    // Mit gesetztem Token ist der SERVER die Quelle des Spielstands - ein 404 hier lässt das
    // Spiel bei null anfangen (gemessen: 130 Erz statt der gesetzten 1,4 Mio).
    if (p === 'storage/' + SAVE_KEY) return j({ value: save, version: 1 });
    if (p.startsWith('storage/')) return j({ e: 1 }, 404);
    return j({ ok: true });
  };
}

// scrollZu: Ohne das steht der eigentliche Inhalt teils unterhalb des Bildrands - gemessen war die
// Sektorkarte im ersten Lauf nur als Streifen am unteren Rand zu sehen, ausgerechnet beim
// auffälligsten Motiv.
const MOTIVE = [
  { datei: 'basis',        reiter: 'basis',        titel: 'Kolonie und Ausbau' },
  { datei: 'galaxie',      reiter: 'karte',        titel: 'Die geteilte Galaxie', scrollZu: '#galaxyMapSvg' },
  { datei: 'forschung',    reiter: 'forschung',    titel: 'Forschungsbaum',       scrollZu: '#research' },
  { datei: 'flotte',       reiter: 'flotte',       titel: 'Werft und Flotte',    scrollZu: '#fleetSubWerft' },
  { datei: 'verteidigung', reiter: 'verteidigung', titel: 'Verteidigungsanlagen', scrollZu: '#defenseBuildings' },
];

(async () => {
  if (!fs.existsSync(SPIELDATEI)) { console.error('Spieldatei nicht gefunden:', SPIELDATEI); process.exit(1); }
  fs.mkdirSync(ZIEL, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  const save = spielstand();
  await ctx.route('**/api/**', backend(save));
  const page = await ctx.newPage();
  await page.addInitScript(([k, v]) => {
    localStorage.setItem('kepler7_token', 'tok');
    localStorage.setItem('kepler7_' + k, v);
  }, [SAVE_KEY, save]);
  await page.goto('file://' + SPIELDATEI, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Overlays wegräumen - dieselbe Liste wie in tests/test_landmarken.js. Sie fangen sonst die
  // Klicks ab (gemessen: tutorialOverlay "intercepts pointer events"), und ein Screenshot mit
  // halbem Willkommensdialog davor ist unbrauchbar.
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  await page.waitForTimeout(600);

  let gemacht = 0;
  for (const m of MOTIVE) {
    const knopf = page.locator(`[data-tab="${m.reiter}"]`).first();
    if (!(await knopf.count())) { console.log(`  ÜBERSPRUNGEN  ${m.datei} (Reiter "${m.reiter}" nicht gefunden)`); continue; }
    await knopf.click();
    await page.waitForTimeout(2200);
    if (m.scrollZu) {
      const el = page.locator(m.scrollZu).first();
      if (await el.count()) {
        await el.scrollIntoViewIfNeeded();
        // Die klebende Reiterleiste verdeckt sonst die Oberkante (KB-10) - ein Stück zurück.
        await page.evaluate(() => window.scrollBy(0, -130));
        await page.waitForTimeout(1200);
      } else {
        console.log(`  HINWEIS  ${m.datei}: "${m.scrollZu}" nicht gefunden, ungescrollt aufgenommen`);
      }
    }
    const ziel = path.join(ZIEL, `kepler7-${m.datei}.png`);
    await page.screenshot({ path: ziel });
    const kb = Math.round(fs.statSync(ziel).size / 1024);
    console.log(`  OK  ${path.basename(ziel).padEnd(28)} ${String(kb).padStart(5)} kB   ${m.titel}`);
    gemacht++;
  }

  await browser.close();
  console.log(`\n${gemacht} von ${MOTIVE.length} Bildern in ${ZIEL}`);
  process.exit(gemacht === MOTIVE.length ? 0 : 1);
})();
