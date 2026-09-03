// Versions-Check ueber version.txt (01.09.2026, Strukturpruefung Punkt 4).
//
// BEFUND: Zwei Timer (checkForNewVersionOnServer alle 5 Minuten, checkLiveVersionUpdate alle 10
// Minuten und bei JEDEM Tab-Wechsel) luden die komplette Spieldatei mit cache:'no-store', nur um
// darin `const VERSION` zu lesen - gemessen rund 81 MB je Stunde und offenem Tab, und das Spiel
// belohnt ausdruecklich, den Tab offen zu lassen. Jetzt fragt der Client version.txt (20 Byte)
// und holt die Spieldatei erst, wenn wirklich eine neuere Version da ist.
//
// Gemessen wird der Weg ueber den Tab-Wechsel (visibilitychange), weil er ohne Uhr-Manipulation
// ausloesbar ist; beide Timer laufen ueber dieselbe Funktion holeLiveVersion().
//   A) gleiche Version: version.txt wird gefragt, die Spieldatei NICHT geholt, kein Overlay.
//   B) neuere Version: die Spieldatei wird GENAU EINMAL geholt (fuer die Patchnotes im Overlay),
//      das Overlay erscheint und nennt die neue Version.
//   C) nginx-Rueckfall: version.txt fehlt auf dem Server, nginx liefert dafuer die Spieldatei
//      (200, text/html). Der Client darf das nicht als Version lesen - er faellt auf den alten
//      Vollabruf zurueck und erkennt die neuere Version trotzdem, mit genau einem Abruf.
//      Ohne diesen Rueckfall saehe ein Deploy ohne version.txt aus wie "keine Updates" -
//      eine Sicherung, deren Ausfall wie Normalbetrieb aussieht.
// Gegenprobe (am Stand vor dem Umbau): A faellt (die Spieldatei wird geholt) und C faellt (kein
// version.txt-Abruf).
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const html = fs.readFileSync(SPIELDATEI, 'utf8');
const VERSION = (html.match(/const VERSION = '([\d.]+)'/) || [])[1];
const NEU = '9.999.0';
// Eine "neuere" Spieldatei: VERSION hochgesetzt und ein Patchnote dazu - so, wie sie nach einem
// Release auf dem Server laege.
const htmlNeu = html
  .replace("const VERSION = '" + VERSION + "'", "const VERSION = '" + NEU + "'")
  .replace('const PATCHNOTES = [\n', "const PATCHNOTES = [\n    { version:'" + NEU + "', date:'01.01.2030', changes:[\n      'Testversion fuer den Versions-Check'\n    ]},\n");
check('vorab: VERSION gelesen und Testfassung gebaut', !!VERSION && htmlNeu.includes("const VERSION = '" + NEU + "'"), VERSION);

const MEIN_ID = 'u';
const jetzt = Date.now();
function backend(store){ return async r => {
  const req = r.request(); const u = new URL(req.url()); const p = u.pathname.split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: MEIN_ID, username: 'Versionstest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
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
const SPIELSTAND = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: {}, lastSeenVersion: VERSION,
  resources: { energie: 9999, erz: 9999, kristalle: 9999, deuterium: 999, antimaterie: 99, forschungspunkte: 99 },
  buildings: { solar: 8, mine: 8 }, research: {}, fleet: { jaeger: 10, missions: [] }, colonies: {},
  activeBasePlanet: 'home',
  player: { id: MEIN_ID, name: 'Versionstest', allianceTag: null, avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 1000, buffs: [], lastTick: jetzt,
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

// versionTxt: Text, der fuer version.txt geliefert wird (null = Netzfehler).
// spieldatei: Text, der fuer den Vollabruf der Spieldatei geliefert wird (null = Netzfehler).
async function fall(browser, name, { versionTxt, spieldatei }){
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const anfragen = [];
  page.on('request', r => {
    const u = r.url();
    if (/version\.txt/.test(u)) anfragen.push('version.txt');
    if (/weltraum_kolonie\.html\?_v=/.test(u)) anfragen.push('spieldatei');
  });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
  await page.route('**/version.txt*', r => versionTxt === null ? r.abort() :
    r.fulfill({ status: 200, contentType: versionTxt.startsWith('<') ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8', body: versionTxt }));
  await page.route('**/weltraum_kolonie.html?_v=*', r => spieldatei === null ? r.abort() :
    r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: spieldatei }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL); await page.waitForTimeout(2600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; }); });
  const vorher = anfragen.length;
  // Der Tab wird "wieder sichtbar" - derselbe Weg wie beim Zurueckwechseln auf die PWA.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(1800);
  const overlay = await page.evaluate(() => {
    const el = document.getElementById('updateNoticeOverlay');
    return { sichtbar: !!el && el.style.display === 'flex', text: el ? el.textContent.replace(/\s+/g, ' ').slice(0, 400) : '' };
  });
  await ctx.close();
  return { anfragen: anfragen.slice(vorher), overlay, errs, name };
}

(async () => {
  const browser = await starteBrowser();

  const a = await fall(browser, 'A', { versionTxt: VERSION + '\n', spieldatei: htmlNeu });
  check('A1: bei gleicher Version wird version.txt gefragt', a.anfragen.includes('version.txt'), a.anfragen);
  check('A2: ... und die Spieldatei NICHT geholt', !a.anfragen.includes('spieldatei'), a.anfragen);
  check('A3: ... und kein Overlay gezeigt', !a.overlay.sichtbar);
  check('A4: keine JS-Fehler', a.errs.length === 0, a.errs.slice(0, 2));

  const b = await fall(browser, 'B', { versionTxt: NEU + '\n', spieldatei: htmlNeu });
  check('B1: bei neuerer Version wird die Spieldatei GENAU EINMAL geholt (fuer die Patchnotes)',
    b.anfragen.filter(x => x === 'spieldatei').length === 1, b.anfragen);
  check('B2: ... und das Overlay erscheint', b.overlay.sichtbar, b.overlay.text.slice(0, 120));
  check('B3: ... und nennt die neue Version', b.overlay.text.includes(NEU), b.overlay.text.slice(0, 200));
  check('B4: keine JS-Fehler', b.errs.length === 0, b.errs.slice(0, 2));

  // nginx-Rueckfall: fuer /version.txt kommt die (neuere) Spieldatei als HTML zurueck.
  const c = await fall(browser, 'C', { versionTxt: htmlNeu, spieldatei: htmlNeu });
  check('C1: HTML statt Versionsnummer wird nicht als Version gelesen - der Vollabruf greift, genau einmal',
    c.anfragen.includes('version.txt') && c.anfragen.filter(x => x === 'spieldatei').length === 1, c.anfragen);
  check('C2: ... und die neuere Version wird trotzdem erkannt', c.overlay.sichtbar && c.overlay.text.includes(NEU), c.overlay.text.slice(0, 120));
  check('C3: keine JS-Fehler', c.errs.length === 0, c.errs.slice(0, 2));

  // Netz weg: weder version.txt noch Spieldatei erreichbar - kein Overlay, kein Fehler.
  const d = await fall(browser, 'D', { versionTxt: null, spieldatei: null });
  check('D1: ohne Netz kein Overlay und kein JS-Fehler', !d.overlay.sichtbar && d.errs.length === 0, { anfragen: d.anfragen, errs: d.errs.slice(0, 2) });

  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
