// Spielerbericht 25.07.2026: "Beim Enterschiff draufdruecken klappt es auf, geht aber nach einer
// Sekunde von selbst wieder zu."
//
// Verdacht: Die gesperrte Event-Schiff-Karte nutzt ein natives <details>. Der Aufklappzustand steckt
// damit AUSSCHLIESSLICH im DOM - und #fleet wird vom Haupt-Tick (1x/Sekunde) per innerHTML komplett
// neu geschrieben. Der Test klappt auf und wartet DREI Sekunden, also sicher ueber mehrere Ticks.
const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, ueberspringen } = require('./lib/umgebung');
const path = require('path');

const FILE = SPIEL_URL;
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'Klapptest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData() || '{}').value; } catch(e){} return j({ ok: true }); }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
    return j({ e: 1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

// Enterschiff ist gesperrt (nicht in unlocked) und hat erst 2 von 6 Enterausruestungen - genau der
// Zustand, in dem die zusammengeklappte Karte mit <details> gerendert wird.
const SPIELSTAND = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 99999, erz: 99999, kristalle: 99999, deuterium: 9999, antimaterie: 99, forschungspunkte: 999 },
  buildings: { solar: 8, mine: 8, werft: 5, labor: 4 }, research: { rkampf: 3 },
  fleet: { jaeger: 5, missions: [] }, colonies: {},
  activeBasePlanet: 'home', player: { id: 'u', name: 'Klapptest', allianceTag: '', avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 300, buffs: [], lastTick: Date.now(),
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0,
  eventParts: { piratenueberfall_teil: 2, voidanomalie_teil: 1 }, unlocked: {}
});

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1400 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const store = { 'kepler7-save-v3': SPIELSTAND };
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE); await page.waitForTimeout(2500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });

  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="flotte"]'); if (b) b.click(); });
  await page.waitForTimeout(400);
  // Der Werft-Unterreiter, in dem die Schiffskarten stehen - ohne ihn ist #fleet ausgeblendet.
  await page.evaluate(() => {
    const b = document.querySelector('[data-fleet-subtab="werft"]') || document.querySelector('[data-fleet-subtab]');
    if (b) b.click();
  });
  // Der Filter "Nur baubare Schiffe anzeigen" wuerde die gesperrte Karte verstecken.
  await page.evaluate(() => {
    const t = document.querySelector('[data-toggle-hide-locked] i.ti-check');
    if (t) t.closest('[data-toggle-hide-locked]').click();
  });
  await page.waitForTimeout(1200);

  // Die Enterschiff-Karte ueber ihren Freischalt-Knopf finden - der traegt den Schiffsschluessel.
  const karte = '#fleet .event-locked-card:has(button[data-unlock-event="enterschiff"])';
  const details = karte + ' details.event-locked';
  check('gesperrte Enterschiff-Karte ist da', await page.locator(details).count() === 1, await page.locator(details).count());

  const istOffen = () => page.locator(details).evaluate(el => el.open);
  check('startet zugeklappt', (await istOffen()) === false);

  await page.locator(details + ' > summary').click();
  await page.waitForTimeout(120);
  check('Klick klappt auf', await istOffen());

  // Der eigentliche Fehler: nach den naechsten Ticks.
  await page.waitForTimeout(3000);
  check('bleibt nach 3 Sekunden (mehrere Ticks) noch offen', await istOffen());

  const txt = await page.locator(details).evaluate(el => el.textContent.replace(/\s+/g, ' ').trim());
  check('der aufgeklappte Text ist auch wirklich sichtbar', /Exklusives Event-Schiff/.test(txt), txt.slice(0, 90));

  // Und Zuklappen muss ebenso halten - sonst haetten wir das Problem nur umgedreht.
  await page.locator(details + ' > summary').click();
  await page.waitForTimeout(2500);
  check('bewusstes Zuklappen bleibt zugeklappt', (await istOffen()) === false);

  // Zweite Karte gegenpruefen: die Aufklappzustaende duerfen sich nicht gegenseitig setzen.
  const details2 = '#fleet .event-locked-card:has(button[data-unlock-event="phantomschiff"]) details.event-locked';
  if (await page.locator(details2).count() === 1){
    await page.locator(details2 + ' > summary').click();
    await page.waitForTimeout(2500);
    check('Phantomschiff-Karte bleibt offen', await page.locator(details2).evaluate(el => el.open));
    check('Enterschiff-Karte dabei weiterhin zu (kein gemeinsamer Zustand)', (await istOffen()) === false);
  } else {
    check('zweite Event-Schiff-Karte zum Gegentest vorhanden', false, 'phantomschiff-Karte fehlt');
  }

  check('keine JS-Fehler', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
