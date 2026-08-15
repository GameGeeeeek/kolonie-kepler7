// Die 14 nachgeschriebenen Forschungsbeschreibungen - und zwar gegen die echten Zahlen im Code.
//
// Hintergrund: Die Forschungskarte zeigt den Zahlen-Zusatz ("aktuell +18%") NUR, wenn die Stufe
// schon ueber 0 liegt. Bei einer noch nicht erforschten Technologie sah der Spieler also wirklich
// nur zwei Woerter ("Energieproduktion (vertieft)") - genau die Beschwerde vom 22.07.2026.
//
// Teil 1 rechnet jede genannte Prozentzahl aus effectPerLevel/maxLevel nach. Aendert jemand spaeter
// die Balance und vergisst den Text, faellt es hier auf.
// Teil 2 prueft, dass die Beschreibung im Spiel bei Stufe 0 vollstaendig ankommt.
const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, ueberspringen } = require('./lib/umgebung');
const fs = require('fs'); const path = require('path');

const DATEI = SPIELDATEI;
const FILE = 'file://' + path.resolve(DATEI);
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const roh = fs.readFileSync(DATEI, 'utf8');
const zeilen = roh.split('\n');
const s = zeilen.findIndex(l => /^  const RESEARCH_DEFS = \[/.test(l));
let e = s; for (let i = s + 1; i < zeilen.length; i++){ if (/^  \];/.test(zeilen[i])){ e = i; break; } }

const defs = [];
for (let i = s + 1; i < e; i++){
  const k = zeilen[i].match(/key:'([a-z0-9]+)'/);
  const d = zeilen[i].match(/desc:'([^']*)'/);
  const ep = zeilen[i].match(/effectPerLevel:([\d.]+)/);
  const ml = zeilen[i].match(/maxLevel:(\d+)/);
  if (k && d) defs.push({ key: k[1], desc: d[1], ep: ep ? parseFloat(ep[1]) : null, max: ml ? parseInt(ml[1], 10) : null, zeile: i + 1 });
}
check('RESEARCH_DEFS eingelesen', defs.length > 30, defs.length);

// ---- Teil 1: keine Zwei-Wort-Beschreibung mehr, und jede Zahl stimmt
const zuKurz = defs.filter(d => d.desc.length < 50);
check('keine Forschung hat mehr eine Kürzel-Beschreibung (<50 Zeichen)', zuKurz.length === 0,
  zuKurz.map(d => d.key + ': "' + d.desc + '"'));

// Die 14 neu geschriebenen: die genannte "je Stufe"-Zahl muss effectPerLevel entsprechen,
// die "bei Stufe N"-Zahl dem Produkt effectPerLevel * maxLevel.
const neu = ['rsolar','rerz','rkristall','rdeuterium','rantimaterie','rsolar2','rerz2','rkristall2',
             'rdeuterium2','rantimaterie2','rlager','rbauplan','rfruehwarnung','rnotfall'];
const zahl = t => parseFloat(String(t).replace(',', '.'));
for (const key of neu){
  const d = defs.find(x => x.key === key);
  if (!d){ check('Def gefunden: ' + key, false); continue; }
  const jeStufe = d.desc.match(/([\d,]+)% je Stufe/);
  const beiMax = d.desc.match(/bis [−+]?([\d,]+)% bei Stufe (\d+)/);
  const okStufe = jeStufe && Math.abs(zahl(jeStufe[1]) / 100 - d.ep) < 1e-9;
  const okMax = beiMax && Math.abs(zahl(beiMax[1]) / 100 - d.ep * d.max) < 1e-9
             && parseInt(beiMax[2], 10) === d.max;
  check(key + ': genannte Zahlen decken sich mit effectPerLevel/maxLevel', !!(okStufe && okMax),
    { text: jeStufe ? jeStufe[1] + '%/Stufe, ' + (beiMax ? beiMax[1] + '% bei ' + beiMax[2] : '?') : 'keine Zahl gefunden',
      code: (d.ep * 100) + '%/Stufe, ' + (d.ep * d.max * 100).toFixed(1) + '% bei ' + d.max });
}

// Stapelhinweise muessen auf real existierende Forschungen zeigen. Seit v8.429.0 darf eine
// Forschung auch einen FAEHIGKEITSBAUM-Knoten nennen (rflottenkoord -> „Parallelkommando", der
// +1-Flottenslot) - deshalb zaehlen die Namen aus SKILL_TREE/SKILL_MASTERY mit. Die Schutzwirkung
// bleibt: ein Tippfehler oder ein spaeter umbenannter Knoten faellt weiterhin auf.
const namen = new Set(zeilen.slice(s + 1, e).map(l => (l.match(/name:'([^']+)'/) || [])[1]).filter(Boolean));
for (const arr of ['SKILL_TREE', 'SKILL_MASTERY']){
  const von = zeilen.findIndex(l => l.includes('const ' + arr + ' = ['));
  if (von < 0) continue;
  for (let i = von + 1; i < zeilen.length; i++){
    if (/^  \];/.test(zeilen[i])) break;
    const m = zeilen[i].match(/name:'([^']+)'/);
    if (m) namen.add(m[1]);
  }
}
let stapelFehler = [];
for (const d of defs){
  for (const m of d.desc.matchAll(/„([^"]+)"/g)) if (!namen.has(m[1])) stapelFehler.push(d.key + ' -> ' + m[1]);
}
check('alle in Beschreibungen genannten Forschungsnamen existieren wirklich', stapelFehler.length === 0, stapelFehler);

// Hausstil der Anfuehrungszeichen: oeffnend „ , schliessend das gerade " (364x in der Datei).
check('Anführungszeichen im Hausstil („…")', !roh.includes('“'));

// ---- Teil 2: kommt der Text bei Stufe 0 vollstaendig im Spiel an?
function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, st = 200) => r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'me') return j({ userId: 'u', username: 'Forschtest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') return j({ ok: true });
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
    return j({ e: 1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

// research: {} -> alle Stufen 0. Genau der Zustand, in dem die Karte KEINEN Zahlen-Zusatz anhaengt
// und die Beschreibung allein stehen muss.
const SPIELSTAND = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 99999, erz: 99999, kristalle: 99999, deuterium: 9999, antimaterie: 999, forschungspunkte: 9999 },
  buildings: { solar: 8, mine: 8, labor: 5 }, research: {}, fleet: { jaeger: 5, missions: [] }, colonies: {},
  activeBasePlanet: 'home', player: { id: 'u', name: 'Forschtest', allianceTag: '', avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 300, buffs: [], lastTick: Date.now(),
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1600 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', ev => errs.push(String(ev)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE); await page.waitForTimeout(2500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="forschung"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);

  // Seit v8.506.0 (Kompaktkarten) stecken die Beschreibungen hinter dem "Details"-Griff der
  // Karte - für die Messung werden alle Griffe geöffnet (am alten Stand ohne Griffe ein No-op,
  // die Gegenprobe-Richtung dieses Tests bleibt also intakt). Die geschützte Eigenschaft ist
  // dieselbe wie seit dem 22.07.2026: die VOLLSTÄNDIGE Beschreibung kommt beim Spieler an -
  // jetzt eben einen Tipp entfernt statt immer sichtbar.
  await page.evaluate(() => { document.querySelectorAll('#research details.karten-info').forEach(d => { d.open = true; }); });
  const seite = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  let fehlend = [];
  for (const key of neu){
    const d = defs.find(x => x.key === key);
    // Der Anfang der Beschreibung reicht als Nachweis, dass sie gerendert wird (Zeilenumbrüche im
    // innerText wurden oben normalisiert).
    const probe = d.desc.slice(0, 40).replace(/\s+/g, ' ');
    if (!seite.includes(probe)) fehlend.push(key);
  }
  check('alle 14 Beschreibungen erscheinen bei Stufe 0 auf der Forschungsseite', fehlend.length === 0, fehlend);
  check('keine Beschreibung wirkt mehr wie ein fehlender Text (kein nacktes "Energieproduktion")',
    !/Energieproduktion \(vertieft\)(?! )/.test(seite) || /Zweite Stufe des Energie-Zweigs/.test(seite));
  check('keine JS-Fehler', errs.length === 0, errs.slice(0, 3));

  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(ev => { console.error('Testlauf abgebrochen:', ev); process.exit(1); });
