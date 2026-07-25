// Prueft den Hinweistext in "Aktive Effekte" - und die Behauptung dahinter.
//
// Der alte Text ("Finde welche bei Erkundungsmissionen!") war irrefuehrend: Der explore-Zweig der
// Missionsaufloesung vergibt gar keinen Buff. Er laesst nur ITEM_DEFS/RARE_ITEMS fallen; drei dieser
// Items geben einen Buff, aber erst beim Aktivieren im Inventar.
//
// Teil 1 prueft das statisch am Code (Regressionsschutz - wenn jemand spaeter doch einen Buff in den
// explore-Zweig einbaut, faellt es hier auf und der Text darf angepasst werden).
// Teil 2 prueft den gerenderten Text im echten Spiel.
const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, ueberspringen } = require('./lib/umgebung');
const fs = require('fs'); const path = require('path');

const DATEI = SPIELDATEI;
const FILE = 'file://' + path.resolve(DATEI);
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ---- Teil 1: statisch
const zeilen = fs.readFileSync(DATEI, 'utf8').split('\n');
const idx = s => zeilen.findIndex(l => l.includes(s));
const expStart = zeilen.findIndex(l => /if \(m\.type === 'explore'\)\{/.test(l));
const expEnde = zeilen.findIndex((l, i) => i > expStart && /\} else if \(m\.type === 'worldboss'\)\{/.test(l));
check('explore-Zweig gefunden', expStart > 0 && expEnde > expStart, { von: expStart + 1, bis: expEnde + 1 });
const explore = zeilen.slice(expStart, expEnde).join('\n');
check('der explore-Zweig vergibt KEINEN Buff direkt', !/state\.buffs/.test(explore));
check('er laesst aber Items fallen (die Grundlage des neuen Textes)', /ITEM_DEFS/.test(explore) && /RARE_ITEMS/.test(explore));

// Die drei im Text genannten Items muessen wirklich Buff-Items mit chance>0 sein.
const itemStart = zeilen.findIndex(l => /^  const ITEM_DEFS = \[/.test(l));
const itemEnde = zeilen.findIndex((l, i) => i > itemStart && /^  \];/.test(l));
const items = []; let cur = null;
for (let i = itemStart + 1; i < itemEnde; i++){
  const m = zeilen[i].match(/\{ key:'([a-z0-9_]+)', name:'([^']+)'/);
  if (m){ if (cur) items.push(cur); cur = { key: m[1], name: m[2], chance: null, buff: false }; }
  if (cur){
    if (/state\.buffs\.push/.test(zeilen[i])) cur.buff = true;
    if (cur.chance === null){ const c = zeilen[i].match(/chance:([0-9.]+)/); if (c) cur.chance = parseFloat(c[1]); }
  }
}
if (cur) items.push(cur);
const findbareBuffItems = items.filter(i => i.buff && i.chance > 0).map(i => i.name);
check('genau die drei genannten Booster-Items sind per Erkundung findbar',
  findbareBuffItems.length === 3 && ['Ressourcenschub','Schildüberladung','Antriebsmatrix'].every(n => findbareBuffItems.includes(n)),
  findbareBuffItems);

// ---- Teil 2: der gerenderte Text
function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'Bufftest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData() || '{}').value; } catch(e){} return j({ ok: true }); }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
    return j({ e: 1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

const basis = buffs => JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9999, erz: 9999, kristalle: 9999, deuterium: 999, antimaterie: 99, forschungspunkte: 999 },
  buildings: { solar: 5, mine: 5 }, research: {}, fleet: { jaeger: 5, missions: [] }, colonies: {},
  activeBasePlanet: 'home', player: { id: 'u', name: 'Bufftest', allianceTag: '', avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 300, buffs, lastTick: Date.now(),
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

async function textVonBuffbox(browser, buffs){
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1400 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': basis(buffs) }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE); await page.waitForTimeout(2500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="fortschritt"]'); if (b) b.click(); });
  await page.waitForTimeout(1000);
  const txt = await page.evaluate(() => {
    const el = document.getElementById('buffsBox');
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  await ctx.close();
  return { txt, errs };
}

(async () => {
  const browser = await starteBrowser();

  const leer = await textVonBuffbox(browser, []);
  check('Box rendert ohne aktive Effekte', !!leer.txt, leer.txt ? leer.txt.slice(0, 60) : null);
  check('die alte, irrefuehrende Aufforderung ist weg', !/Finde welche bei Erkundungsmissionen/.test(leer.txt || ''));
  check('die haeufigste Quelle wird zuerst genannt', /Zufallsereignisse/.test(leer.txt || ''));
  for (const q of ['Expeditionen', 'Forschungs-Sprint', 'Kredit-Shop']){
    check('Quelle genannt: ' + q, (leer.txt || '').includes(q));
  }
  check('der Unterschied Item vs. sofortiger Effekt wird erklaert',
    /Items/.test(leer.txt || '') && /aktivierst/.test(leer.txt || ''));
  for (const n of ['Ressourcenschub', 'Schildüberladung', 'Antriebsmatrix']){
    check('Booster-Item genannt: ' + n, (leer.txt || '').includes(n));
  }
  check('keine JS-Fehler (leer)', leer.errs.length === 0, leer.errs.slice(0, 3));

  // Mit aktivem Effekt darf der Hinweis NICHT erscheinen - die Box zeigt dann den Effekt.
  const mit = await textVonBuffbox(browser, [{ kind: 'prod_all', mult: 1.25, expiresAt: Date.now() + 3600000, source: 'shop' }]);
  check('mit aktivem Effekt wird der Hinweistext nicht angezeigt', !/Zufallsereignisse/.test(mit.txt || ''), (mit.txt || '').slice(0, 80));
  check('stattdessen steht der laufende Effekt samt Restlaufzeit da',
    /Alle Ressourcen/.test(mit.txt || '') && /läuft noch \d\d:\d\d/.test(mit.txt || ''), (mit.txt || '').slice(0, 80));
  check('keine JS-Fehler (mit Effekt)', mit.errs.length === 0, mit.errs.slice(0, 3));

  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
