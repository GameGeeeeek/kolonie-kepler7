// Patchnotes-Liste (v8.298.7): renderPatchnotes() laeuft beim Boot und schrieb bis dahin ALLE
// Eintraege auf einmal ins DOM. Gemessen am 25.07.2026 bei 685 Eintraegen: 5.067 Knoten in
// #patchnotesList von 8.512 im gesamten Dokument - die Versionshistorie kostete mehr DOM als das
// komplette Spiel, auf jedem Seitenaufruf, auch wenn niemand den Update-Tab oeffnet.
//
// Jetzt werden nur die neuesten 15 gezeichnet, der Rest auf Knopfdruck. Geprueft wird:
//   1) beim Start stehen genau PATCHNOTES_SOFORT Karten in der Liste, nicht alle
//   2) die Liste ist dadurch nicht mehr der dominierende Teil des DOM
//   3) die NEUESTE Version ist dabei (sonst waere die Liste zwar kurz, aber falsch herum)
//   4) der Knopf nennt die richtige Restzahl und laedt beim Klick alle nach
//   5) der Klick auf die Versionsnummer springt weiterhin in den Update-Tab. Der Listener ist beim
//      Umbau aus renderPatchnotes heraus an den Boot-Code gewandert, weil die Funktion jetzt ein
//      zweites Mal laufen kann; dass er sich nicht aufaddiert, ist durch die Bauweise sichergestellt
//      und hier nicht eigens geprueft - dieser Punkt sichert nur, dass er ueberhaupt noch haengt.
const { starteBrowser, SPIEL_URL, SPIELDATEI, WURZEL } = require('./lib/umgebung');
const fs = require('fs');
const path = require('path');

const FILE = SPIEL_URL;
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const MEIN_ID = 'u';
const jetzt = Date.now();

// Erwartungswerte aus der Spieldatei selbst ziehen, damit der Test nicht veraltet, wenn neue
// Versionen dazukommen oder die Schwelle bewusst geaendert wird.
const html = fs.readFileSync(SPIELDATEI, 'utf8');
const SOFORT = parseInt((html.match(/const PATCHNOTES_SOFORT = (\d+)/) || [])[1], 10);
const pnBlock = (html.match(/const PATCHNOTES = \[[\s\S]*?\n  \];/) || [''])[0];
const IM_SPIEL = (pnBlock.match(/\{ version:'/g) || []).length;
// Seit dem 01.09.2026 liegen die aelteren Versionen in patchnotes-archiv.json (siehe
// build-patchnotes.js); das Spiel kennt ihre Zahl ueber PATCHNOTES_ARCHIV_ANZAHL und laedt die
// Datei erst auf Knopfdruck. GESAMT ist damit Spiel + Archiv.
const ARCHIV_ANZAHL = parseInt((html.match(/const PATCHNOTES_ARCHIV_ANZAHL = (\d+)/) || [])[1], 10);
const GESAMT = IM_SPIEL + ARCHIV_ANZAHL;
const NEUESTE = (pnBlock.match(/\{ version:'([^']+)'/) || [])[1];
const ARCHIV_JSON = fs.readFileSync(path.join(WURZEL, 'patchnotes-archiv.json'), 'utf8');

check('Schwelle und Eintragszahl aus der Datei gelesen',
  Number.isFinite(SOFORT) && Number.isFinite(ARCHIV_ANZAHL) && GESAMT > SOFORT && !!NEUESTE, { SOFORT, IM_SPIEL, ARCHIV_ANZAHL, GESAMT, NEUESTE });
check('das Archiv im Repo hat genau die Zahl an Eintraegen, die das Spiel kennt',
  JSON.parse(ARCHIV_JSON).length === ARCHIV_ANZAHL);

function backend(store){ return async r => {
  const req = r.request(); const u = new URL(req.url()); const p = u.pathname.split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: MEIN_ID, username: 'Patchtest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
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
  tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: {},
  resources: { energie: 9999, erz: 9999, kristalle: 9999, deuterium: 999, antimaterie: 99, forschungspunkte: 99 },
  buildings: { solar: 8, mine: 8 }, research: {}, fleet: { jaeger: 10, missions: [] }, colonies: {},
  activeBasePlanet: 'home',
  player: { id: MEIN_ID, name: 'Patchtest', allianceTag: null, avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 1000, buffs: [], lastTick: jetzt,
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

const zaehl = () => {
  const el = document.getElementById('patchnotesList');
  return {
    karten: el ? el.querySelectorAll('.card-row').length : -1,
    knoten: el ? el.querySelectorAll('*').length : -1,
    domGesamt: document.querySelectorAll('*').length,
    knopf: el ? !!el.querySelector('#patchnotesMoreBtn') : false,
    knopfText: el && el.querySelector('#patchnotesMoreBtn') ? el.querySelector('#patchnotesMoreBtn').textContent.trim() : '',
    ersteVersion: el && el.querySelector('.bname') ? el.querySelector('.bname').textContent.trim() : ''
  };
};

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1400 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
  // Das Archiv kommt vom Server; die Seite laeuft hier von file://, also liefert es der Test selbst.
  await page.route('**/patchnotes-archiv.json*', r => r.fulfill({ status: 200, contentType: 'application/json', body: ARCHIV_JSON }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE); await page.waitForTimeout(2600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });

  const start = await page.evaluate(zaehl);
  check('1: beim Start stehen nur die neuesten Versionen in der Liste',
    start.karten === SOFORT, { gezeichnet: start.karten, erwartet: SOFORT, gesamt: GESAMT });
  // Der eigentliche Gewinn: die Historie darf nicht mehr das DOM dominieren. Vor dem Umbau waren es
  // 5.067 von 8.512 Knoten (60%); die Schwelle liegt bewusst grosszuegig bei 25%.
  const anteil = start.knoten / start.domGesamt;
  check('2: die Liste ist nicht mehr der dominierende Teil des DOM (< 25%)',
    anteil < 0.25, { listenknoten: start.knoten, domGesamt: start.domGesamt, anteil: (anteil*100).toFixed(1)+'%' });
  check('3: die neueste Version steht dabei und ganz oben',
    start.ersteVersion === 'Version ' + NEUESTE, { gefunden: start.ersteVersion, erwartet: 'Version ' + NEUESTE });
  check('4: ein Knopf für die älteren Versionen ist da und nennt die Restzahl',
    start.knopf && start.knopfText.includes(String(GESAMT - SOFORT)), start.knopfText);

  // ---- Nachladen. Der Update-Tab hat keinen eigenen Knopf in der Leiste, er wird ueber die
  // Versionsnummer unten geoeffnet - der Knopf ist sonst im inaktiven Panel und nicht klickbar.
  await page.click('#versionTag');
  await page.waitForTimeout(400);
  check('4: der Update-Tab lässt sich über die Versionsnummer öffnen',
    await page.evaluate(() => { const p = document.getElementById('tab-update'); return !!p && p.classList.contains('active'); }));
  await page.click('#patchnotesMoreBtn');
  await page.waitForTimeout(1500);   // das Archiv wird erst jetzt geholt (1 MB), dann neu gezeichnet
  const nachher = await page.evaluate(zaehl);
  check('4: nach dem Klick sind alle Versionen da', nachher.karten === GESAMT,
    { jetzt: nachher.karten, gesamt: GESAMT });
  check('4: der Knopf verschwindet, wenn nichts mehr nachzuladen ist', !nachher.knopf);
  check('4: die neueste Version steht weiterhin oben',
    nachher.ersteVersion === 'Version ' + NEUESTE, nachher.ersteVersion);

  // ---- Versionsnummer bleibt klickbar und feuert nur EINMAL
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="basis"]'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.click('#versionTag');
  await page.waitForTimeout(400);
  check('5: Klick auf die Versionsnummer öffnet weiterhin den Update-Tab',
    await page.evaluate(() => { const p = document.getElementById('tab-update'); return !!p && p.classList.contains('active'); }));
  check('5: die Versionsnummer zeigt die aktuelle Version',
    /^v\d+\.\d+\.\d+$/.test(await page.evaluate(() => (document.getElementById('versionTag') || {}).textContent || '')),
    await page.evaluate(() => (document.getElementById('versionTag') || {}).textContent || ''));

  check('keine JS-Fehler', errs.length === 0, errs.slice(0, 3));

  // ---- 6) Archiv nicht erreichbar (alter Deploy ohne die Datei, Netz weg): Die Eintraege im Spiel
  // bleiben stehen, ein Hinweis verweist auf patchnotes.html, kein Knopf ins Leere, kein JS-Fehler.
  // nginx liefert fuer unbekannte Pfade die Spieldatei (200, text/html) - genau das wird hier
  // nachgestellt, nicht ein 404.
  const page2 = await ctx.newPage();
  const errs2 = []; page2.on('pageerror', e => errs2.push(String(e)));
  await page2.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
  await page2.route('**/patchnotes-archiv.json*', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>Rueckfall</title>' }));
  await page2.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page2.goto(FILE); await page2.waitForTimeout(2600);
  await page2.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigeOverlay'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; }); });
  await page2.click('#versionTag'); await page2.waitForTimeout(400);
  await page2.click('#patchnotesMoreBtn'); await page2.waitForTimeout(1200);
  const ohne = await page2.evaluate(zaehl);
  const hinweis = await page2.evaluate(() => { const el = document.getElementById('patchnotesList'); return el ? (el.querySelector('a[href="patchnotes.html"]') ? el.querySelector('a[href="patchnotes.html"]').closest('div').textContent.trim() : '') : ''; });
  check('6: ohne Archiv stehen alle Eintraege aus dem Spiel da, nicht weniger', ohne.karten === IM_SPIEL, { karten: ohne.karten, IM_SPIEL });
  check('6: ... ein Hinweis nennt die fehlende Zahl und verweist auf patchnotes.html',
    hinweis.includes(String(ARCHIV_ANZAHL)) && hinweis.includes('patchnotes.html'), hinweis.slice(0, 140));
  check('6: ... und kein Knopf verspricht etwas, das nicht kommt', !ohne.knopf);
  check('6: keine JS-Fehler', errs2.length === 0, errs2.slice(0, 3));
  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
