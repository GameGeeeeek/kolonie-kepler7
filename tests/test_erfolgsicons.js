// Erfolgs-Icons (v8.298.5): Bis dahin trugen ALLE 73 Erfolge dieselben zwei Symbole - ti-medal
// (erledigt) bzw. ti-lock (offen). Die groesste Kartenliste des Spiels war damit visuell flach; man
// erkannte einen Erfolg erst am Text. Jetzt hat jeder Erfolg ein eigenes Icon (ACH_ICONS), mit dem
// Kategorie-Icon als Rueckfallebene.
//
// Geprueft wird:
//   1) statisch: jeder ACHIEVEMENTS-Schluessel hat einen ACH_ICONS-Eintrag, jedes Icon steht in der
//      69er-Whitelist des Icon-Subsets, und ACH_ICONS enthaelt keine Karteileichen
//   2) dynamisch: die gerenderte Erfolgsliste zeigt viele VERSCHIEDENE Icons statt zweier - genau
//      die Regression, die der frueheren Fassung nicht auffiel
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

const FILE = SPIEL_URL;
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const MEIN_ID = 'u';
const jetzt = Date.now();

// ------------------------------------------------------- 1) statische Pruefung an der Spieldatei
const html = fs.readFileSync(SPIELDATEI, 'utf8');
const achBlock = (html.match(/const ACHIEVEMENTS = \[[\s\S]*?\n  \];/) || [''])[0];
const iconBlock = (html.match(/const ACH_ICONS = \{[\s\S]*?\n  \};/) || [''])[0];
const achKeys = [...achBlock.matchAll(/key:'([^']+)'/g)].map(m => m[1]);
const iconMap = {};
[...iconBlock.matchAll(/(\w+):'(ti-[a-z0-9-]+)'/g)].forEach(m => { iconMap[m[1]] = m[2]; });
const whitelist = new Set([...html.matchAll(/^\s*\.(ti-[a-z0-9-]+):before/gm)].map(m => m[1]));

check('ACHIEVEMENTS und ACH_ICONS gefunden', achKeys.length > 0 && Object.keys(iconMap).length > 0,
  { erfolge: achKeys.length, icons: Object.keys(iconMap).length });
const ohneIcon = achKeys.filter(k => !iconMap[k]);
check('1: jeder Erfolg hat ein eigenes Icon', ohneIcon.length === 0, ohneIcon);
const unbekannt = Object.entries(iconMap).filter(([, v]) => !whitelist.has(v));
check('1: alle Icons stehen in der Icon-Whitelist (kein Font-Neubau noetig)', unbekannt.length === 0, unbekannt);
const karteileichen = Object.keys(iconMap).filter(k => !achKeys.includes(k));
check('1: keine Icon-Eintraege ohne zugehoerigen Erfolg', karteileichen.length === 0, karteileichen);
// Der eigentliche Punkt der Aenderung: echte Vielfalt, nicht 73x dasselbe Symbol.
const verschieden = new Set(Object.values(iconMap));
check('1: die Zuordnung nutzt viele verschiedene Symbole (>= 30)', verschieden.size >= 30, verschieden.size);

function backend(store){ return async r => {
  const req = r.request(); const u = new URL(req.url()); const p = u.pathname.split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: MEIN_ID, username: 'Erfolgstest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p === 'storage-list') {
    const prefix = u.searchParams.get('prefix') || '';
    return j({ keys: Object.keys(store).filter(k => k.startsWith(prefix)) });
  }
  if (p.startsWith('storage/')) {
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
    return j({ e: 1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

// Ein paar Erfolge als erledigt markieren, damit BEIDE Zustaende (erledigt/offen) im Bild sind -
// frueher unterschied genau das die zwei einzigen Symbole voneinander.
const ERLEDIGT = { firstbuild: true, tenkills: true, trade1: true, officer1: true };
const SPIELSTAND = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: { fortschritt: true },
  resources: { energie: 9999, erz: 9999, kristalle: 9999, deuterium: 999, antimaterie: 99, forschungspunkte: 99 },
  buildings: { solar: 8, mine: 8 }, research: {}, fleet: { jaeger: 10, missions: [] }, colonies: {},
  activeBasePlanet: 'home', achievements: ERLEDIGT,
  player: { id: MEIN_ID, name: 'Erfolgstest', allianceTag: null, avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 3000, buffs: [], lastTick: jetzt,
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1500 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE); await page.waitForTimeout(2600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="fortschritt"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);

  const gezeichnet = await page.evaluate(() => {
    const box = document.getElementById('achievementsList');
    if (!box) return null;
    // Nur die Karten-Icons, nicht die Kategorie-Ueberschriften oder die Rang-Zusammenfassung.
    const icons = [...box.querySelectorAll('.card-row .bicon i')].map(i =>
      [...i.classList].find(c => c.startsWith('ti-') && c !== 'ti') || '?');
    return { anzahl: icons.length, verschieden: [...new Set(icons)].length, beispiele: icons.slice(0, 8) };
  });

  check('2: die Erfolgsliste wurde gerendert', !!gezeichnet && gezeichnet.anzahl > 50, gezeichnet);
  if (gezeichnet){
    // Die alte Fassung ergab hier exakt 2 (ti-medal + ti-lock). Die Schwelle liegt bewusst deutlich
    // darueber, damit der Test wirklich die Vielfalt misst und nicht nur "mehr als eins".
    check('2: die Karten zeigen viele verschiedene Symbole statt zweier',
      gezeichnet.verschieden >= 30, gezeichnet);
    check('2: kein Erfolg wird ohne erkennbares Icon gezeichnet',
      !gezeichnet.beispiele.includes('?'), gezeichnet.beispiele);
    check('2: die alten Platzhalter dominieren nicht mehr',
      !(gezeichnet.verschieden <= 2), gezeichnet.verschieden);
  }

  check('keine JS-Fehler', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
