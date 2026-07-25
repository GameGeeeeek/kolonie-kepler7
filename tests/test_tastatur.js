// Tastaturbedienung der Schalter-Zeilen (v8.298.8). Die Einstellungen des Spiels (Ton, Ereignis-
// Benachrichtigungen, Energiesparmodus, automatische Verstaerkung/Reparatur, Auto-Erkundung,
// Layout-Optionen, Einfuehrungs-Rundgang, Ersthinweise) sind klickbare <div class="card-row"> und
// waren damit gar nicht per Tastatur erreichbar - obwohl das Spiel mit den Ziffern-Kuerzeln fuer die
// Tabs sonst durchaus Tastaturbedienung kennt. Gemessen am 25.07.2026: 24 klickbare <div> im
// statischen HTML, davon 0 mit role oder tabindex.
//
// Geprueft wird:
//   1) statisch: alle Schalter-Zeilen tragen role="button" und tabindex="0"
//   2) sie sind per Tab erreichbar (document.activeElement landet darauf)
//   3) Enter schaltet wirklich um - am gespeicherten Spielstand nachgewiesen, nicht nur am DOM
//   4) die Leertaste ebenso, ohne dass die Seite darunter wegscrollt
//   5) aria-pressed folgt dem sichtbaren Schalter
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

const FILE = SPIEL_URL;
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const MEIN_ID = 'u';
const jetzt = Date.now();

// ------------------------------------------------------- 1) statische Pruefung an der Spieldatei
const html = fs.readFileSync(SPIELDATEI, 'utf8');
const zeilen = [...html.matchAll(/<div class="card-row" id="(\w+)"([^>]*)style="cursor:pointer/g)]
  .map(m => ({ id: m[1], attr: m[2] }));
const ohneRolle = zeilen.filter(z => !/role="button"/.test(z.attr) || !/tabindex="0"/.test(z.attr));
check('1: Schalter-Zeilen im statischen HTML gefunden', zeilen.length >= 12, zeilen.length);
check('1: alle tragen role="button" und tabindex="0"', ohneRolle.length === 0, ohneRolle.map(z => z.id));

function backend(store){ return async r => {
  const req = r.request(); const u = new URL(req.url()); const p = u.pathname.split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: MEIN_ID, username: 'Tastaturtest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p === 'storage-list') return j({ keys: Object.keys(store).filter(k => k.startsWith(u.searchParams.get('prefix') || '')) });
  if (p.startsWith('storage/')) {
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
    return j({ e: 1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

// soundOn bewusst true, damit das Umschalten eine sichtbare Richtung hat.
const SPIELSTAND = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: {}, soundOn: true,
  resources: { energie: 9999, erz: 9999, kristalle: 9999, deuterium: 999, antimaterie: 99, forschungspunkte: 99 },
  buildings: { solar: 8, mine: 8 }, research: {}, fleet: { jaeger: 10, missions: [] }, colonies: {},
  activeBasePlanet: 'home',
  player: { id: MEIN_ID, name: 'Tastaturtest', allianceTag: null, avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 1000, buffs: [], lastTick: jetzt,
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

const schalterZustand = id => {
  const row = document.getElementById(id);
  const sw = row ? row.querySelector('.toggle-switch') : null;
  return { an: !!sw && sw.classList.contains('on'), aria: row ? row.getAttribute('aria-pressed') : null };
};

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1400 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const store = { 'kepler7-save-v3': SPIELSTAND };
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE); await page.waitForTimeout(2600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const b = document.getElementById('headerProfileBtn'); if (b) b.click(); });
  await page.waitForTimeout(800);

  // -------------------------------------------------- 2) per Tab erreichbar
  const erreichbar = await page.evaluate(() => {
    const row = document.getElementById('soundToggleRow');
    if (!row) return null;
    row.focus();
    return document.activeElement === row;
  });
  check('2: die Ton-Zeile lässt sich fokussieren', erreichbar === true, erreichbar);
  // Und zwar auch ueber die echte Tab-Reihenfolge, nicht nur per .focus().
  const inTabReihenfolge = await page.evaluate(() => {
    const row = document.getElementById('soundToggleRow');
    return !!row && row.tabIndex >= 0;
  });
  check('2: sie liegt in der Tab-Reihenfolge (tabIndex >= 0)', inTabReihenfolge);

  // -------------------------------------------------- 3) Enter schaltet um
  const vorher = await page.evaluate(schalterZustand, 'soundToggleRow');
  check('3: Ausgangszustand ist „an" und aria-pressed stimmt überein',
    vorher.an === true && vorher.aria === 'true', vorher);
  await page.evaluate(() => document.getElementById('soundToggleRow').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1300);
  const nachEnter = await page.evaluate(schalterZustand, 'soundToggleRow');
  check('3: Enter schaltet den Schalter um', nachEnter.an === false, nachEnter);
  check('3: aria-pressed folgt dem sichtbaren Schalter', nachEnter.aria === 'false', nachEnter);
  // Der Beweis, dass wirklich die Einstellung geschaltet wurde und nicht nur eine CSS-Klasse:
  let gespeichert = null;
  try { gespeichert = JSON.parse(store['kepler7-save-v3']).soundOn; } catch(e){}
  check('3: die Einstellung landet im gespeicherten Spielstand', gespeichert === false, { soundOn: gespeichert });

  // -------------------------------------------------- 4) Leertaste ebenso, ohne Scroll-Sprung
  await page.evaluate(() => { window.scrollTo(0, 200); document.getElementById('soundToggleRow').focus(); });
  const scrollVorher = await page.evaluate(() => window.scrollY);
  await page.keyboard.press(' ');
  await page.waitForTimeout(1300);
  const nachSpace = await page.evaluate(schalterZustand, 'soundToggleRow');
  check('4: die Leertaste schaltet ebenfalls um', nachSpace.an === true, nachSpace);
  const scrollNachher = await page.evaluate(() => window.scrollY);
  check('4: die Seite scrollt dabei nicht weg (preventDefault greift)',
    Math.abs(scrollNachher - scrollVorher) < 30, { vorher: scrollVorher, nachher: scrollNachher });

  // -------------------------------------------------- 5) auch die Nicht-Schalter sind bedienbar
  // „Ersthinweise zuruecksetzen" ist ein Knopf ohne Schaltzustand - er darf deshalb KEIN
  // aria-pressed tragen, muss aber genauso auf Enter reagieren.
  check('5: eine Zeile ohne Schalter trägt kein aria-pressed',
    (await page.evaluate(() => document.getElementById('resetTabHintsBtn').getAttribute('aria-pressed'))) === null);
  await page.evaluate(() => document.getElementById('resetTabHintsBtn').focus());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  check('5: Enter löst auch dort die Aktion aus',
    /Zurückgesetzt/.test(await page.evaluate(() => (document.getElementById('resetTabHintsMeta') || {}).textContent || '')));

  check('keine JS-Fehler', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
