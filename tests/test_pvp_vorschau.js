// Die PvP-Angriffsvorschau im Spielerprofil urteilte binaer ("erfolgversprechend" / "aussichtslos"),
// obwohl der Server den Kampf seit v8.295.0 in DREI PHASEN aufloest, mit je Phase auf 0,196/0,804
// gedeckelter Chance und "zwei von drei". Daraus folgt:
//   - bei Gleichstand sind es genau 50% (die Vorschau zeigte den gruenen Haken)
//   - beliebig ueberlegen deckelt bei 90% (nie sicher)
//   - beliebig unterlegen deckelt bei 10% (nie aussichtslos)
// Die NPC-Vorschau zeigt laengst die echte Zahl - PvP war die Ausnahme.
const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, ueberspringen } = require('./lib/umgebung');
const fs = require('fs'); const path = require('path');

const DATEI = SPIELDATEI;
const FILE = 'file://' + path.resolve(DATEI);
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ---- Teil 1: Paritaet der Phasengrenzen zwischen Frontend und Backend.
// Weichen sie ab, nennt die Vorschau eine andere Zahl als der Server rechnet - genau der Fehler,
// den wir gerade beheben, nur subtiler.
const fe = fs.readFileSync(DATEI, 'utf8');
const SERVER = SERVER_JS;
if (fs.existsSync(SERVER)){
  const be = fs.readFileSync(SERVER, 'utf8');
  const bm = be.match(/PVP_PHASE_MIN = ([\d.]+), PVP_PHASE_MAX = ([\d.]+)/);
  const fm = fe.match(/PVP_PHASE_MIN = ([\d.]+), PVP_PHASE_MAX = ([\d.]+)/);
  check('Backend definiert die PvP-Phasengrenzen', !!bm, bm ? bm.slice(1, 3) : null);
  check('Frontend spiegelt dieselben Grenzen', !!fm && !!bm && fm[1] === bm[1] && fm[2] === bm[2],
    { frontend: fm ? fm.slice(1, 3) : null, backend: bm ? bm.slice(1, 3) : null });
}

// Die drei Eckwerte analytisch (zwei von drei Phasen).
const g = p => 3 * p * p * (1 - p) + p * p * p;
const erwartetGleichstand = Math.round(g(0.5) * 100);
const erwartetMax = Math.round(g(0.804) * 100);
const erwartetMin = Math.round(g(0.196) * 100);
check('Eckwerte stimmen (50 / 90 / 10)', erwartetGleichstand === 50 && erwartetMax === 90 && erwartetMin === 10,
  { gleichstand: erwartetGleichstand, max: erwartetMax, min: erwartetMin });

// ---- Teil 2: die Anzeige im echten Spiel
const MEIN_ID = 'u';
function bestenliste(defensePower){
  return [
    { id: MEIN_ID, name: 'Vorschautest', score: 5000, bp: 100, defensePower: 4000, level: 12, ships: 10, cruisers: 5, destroyers: 2 },
    { id: 'gegner', name: 'Zielperson', score: 5200, bp: 120, defensePower, level: 13, ships: 40, cruisers: 20, destroyers: 10, battleWins: 3, battleLosses: 1, npcKills: 7, buildLvl: 40 }
  ];
}

function backend(store, defensePower){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: MEIN_ID, username: 'Vorschautest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  // Die Bestenliste kommt NICHT von /api/leaderboard, sondern aus dem geteilten Speicher:
  // storage-list('leaderboard:') und danach ein storageGet je Schluessel.
  if (p === 'storage-list'){
    const prefix = new URL(req.url()).searchParams.get('prefix') || '';
    return j({ keys: Object.keys(store).filter(k => k.startsWith(prefix)) });
  }
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') return j({ ok: true });
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
    return j({ e: 1 }, 404);
  }
  if (/reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

// Eine ueberschaubare, reine Jaeger-Flotte: Angriffskraft laesst sich so grob steuern.
const spielstand = () => JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 99999, erz: 99999, kristalle: 99999, deuterium: 9999, antimaterie: 99, forschungspunkte: 999 },
  buildings: { solar: 8, mine: 8, hangar: 20 }, research: {},
  fleet: { jaeger: 200, cruisers: 50, missions: [] }, colonies: {},
  activeBasePlanet: 'home', player: { id: MEIN_ID, name: 'Vorschautest', allianceTag: '', avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 3000, buffs: [], lastTick: Date.now(),
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

async function vorschauText(browser, defensePower){
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1500 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const eintraege = bestenliste(defensePower);
  const store = { 'kepler7-save-v3': spielstand() };
  for (const e of eintraege) store['leaderboard:' + e.id] = JSON.stringify(e);
  await page.route('**/api/**', backend(store, defensePower));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE); await page.waitForTimeout(2600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  // Die Bestenliste liegt im Punktestand-Tab.
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="punkte"]'); if (b) b.click(); });
  await page.waitForTimeout(2000);
  // Profil des Gegners oeffnen (Bestenlisten-Zeile).
  const geklickt = await page.evaluate(() => {
    const row = document.querySelector('[data-profile="gegner"]');
    if (!row) return false;
    row.click(); return true;
  });
  await page.waitForTimeout(700);
  const out = await page.evaluate(() => {
    const pre = document.getElementById('profileAttackPreview');
    const ban = document.getElementById('profileThreatBanner');
    return {
      vorschau: pre && pre.getClientRects().length ? pre.innerText.replace(/\s+/g, ' ').trim() : null,
      banner: ban && ban.getClientRects().length ? ban.innerText.replace(/\s+/g, ' ').trim() : null
    };
  });
  await ctx.close();
  return Object.assign(out, { geklickt, errs });
}

(async () => {
  const browser = await starteBrowser();

  // (a) Ziel mit winziger Verteidigung -> darf NICHT als sicherer Sieg dastehen (Deckel 90%).
  const stark = await vorschauText(browser, 50);
  check('Bestenlisten-Zeile des Ziels gefunden', stark.geklickt);
  check('Vorschau ist sichtbar', !!stark.vorschau, stark.vorschau);
  const prozentStark = stark.vorschau && stark.vorschau.match(/(\d+)\s*%/);
  check('a) haushoch überlegen: Vorschau nennt eine Prozentzahl', !!prozentStark, stark.vorschau);
  check('a) und zwar gedeckelt bei 90%, nicht "sicher"', !!prozentStark && parseInt(prozentStark[1], 10) <= 90 && parseInt(prozentStark[1], 10) >= 80,
    prozentStark ? prozentStark[1] + '%' : null);
  check('a) kein absolutes Versprechen mehr', !!stark.vorschau && !/erfolgversprechend/.test(stark.vorschau), stark.vorschau);

  // (b) Ziel mit erdrueckender Verteidigung -> darf NICHT "aussichtslos" heissen (Boden 10%).
  const schwach = await vorschauText(browser, 5000000);
  const prozentSchwach = schwach.vorschau && schwach.vorschau.match(/(\d+)\s*%/);
  check('b) hoffnungslos unterlegen: Vorschau nennt eine Prozentzahl', !!prozentSchwach, schwach.vorschau);
  check('b) und zwar mindestens 10%, nicht "aussichtslos"', !!prozentSchwach && parseInt(prozentSchwach[1], 10) >= 10,
    prozentSchwach ? prozentSchwach[1] + '%' : null);
  check('b) das Wort "aussichtslos" fällt nicht mehr', !!schwach.vorschau && !/aussichtslos/.test(schwach.vorschau), schwach.vorschau);

  // (c) Der Hinweis auf die unbekannte Aufstellung des Verteidigers muss dastehen - sonst liest sich
  //     die Prozentzahl wieder als Gewissheit.
  check('c) Vorschau weist auf die unbekannte Verteidigungs-Aufstellung hin',
    !!stark.vorschau && /Aufstellung/.test(stark.vorschau), stark.vorschau);

  // (d) Banner und Vorschau duerfen sich nicht widersprechen.
  check('d) Banner zeigt dieselbe Prozentzahl wie die Vorschau',
    !!stark.banner && !!prozentStark && stark.banner.includes(prozentStark[1] + '%'),
    { banner: stark.banner, vorschau: prozentStark ? prozentStark[1] + '%' : null });

  check('keine JS-Fehler', stark.errs.length === 0 && schwach.errs.length === 0, stark.errs.concat(schwach.errs).slice(0, 3));

  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
