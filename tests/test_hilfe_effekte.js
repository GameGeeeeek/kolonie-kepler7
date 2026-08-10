// Der neue Hilfe-Abschnitt "Aktive Effekte (Buffs)" - und zwar gegen den echten Code geprueft,
// nicht nur auf Vorhandensein. Ein Hilfetext, der etwas Falsches behauptet, ist schlimmer als keiner.
const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, ueberspringen } = require('./lib/umgebung');
const fs = require('fs'); const path = require('path');

const DATEI = SPIELDATEI;
const FILE = 'file://' + path.resolve(DATEI);
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const quelle = fs.readFileSync(DATEI, 'utf8');
const zeilen = quelle.split('\n');

// ---- Teil 1: Die Behauptungen des Abschnitts gegen den Code
// (a) "Angriffskraft wird beim Losschicken eingefroren" gilt fuer NPC-Ziele, NICHT fuer Spielerangriffe.
const missionPushes = zeilen
  .map((l, i) => ({ i, l }))
  .filter(x => x.l.includes('missions.push({ id: nextMissionId()'))
  .map(x => ({ typ: (x.l.match(/type:'([a-z-]+)'/) || [])[1], friert: /[ {]power[,:]/.test(x.l) }));
const friert = missionPushes.filter(m => m.friert).map(m => m.typ);
const npcZiele = ['attack', 'piratelair', 'worldboss', 'intercept-pirates', 'void-rift', 'attack-alliance-base'];
check('genau die im Text genannten NPC-Missionsarten frieren die Angriffskraft ein',
  npcZiele.every(t => friert.includes(t)) && friert.length === npcZiele.length, friert);
check('der Spielerangriff friert sie NICHT ein (Server rechnet bei Ankunft)',
  !friert.includes('attack-player'));
// Und der Server rechnet dort wirklich mit den Buffs aus dem gespeicherten Stand.
const server = SERVER_JS;
if (fs.existsSync(server)){
  const s = fs.readFileSync(server, 'utf8');
  check('das Backend wertet atk-Buffs aus dem Spielstand aus', /buffMult\(save, 'atk'\)/.test(s));
  check('das Backend wertet def-Buffs aus dem Spielstand aus', /buffMult\(save, 'def'\)/.test(s));
}

// (b) "Effekte multiplizieren sich untereinander"
check('atk-Buffs werden multipliziert, nicht addiert', /buff\.kind=='?='?'atk'.*power \*= buff\.mult/.test(quelle));
check('def-Buffs werden multipliziert', /buff\.kind=='?='?'def'.*power \*= buff\.mult/.test(quelle));

// (c) "liegen ausserhalb des bei +100% gedeckelten Kampfbonus-Topfes":
// Im Quelltext muss der Deckel VOR der Buff-Schleife angewendet werden.
// Seit v8.477.0 ist es ein WEICHER Deckel (gemeinsam mit dem Backend umgestellt) - die gepruefte
// Eigenschaft ist davon unberuehrt: Es geht um die REIHENFOLGE, nicht um die Form des Deckels.
// Die Zeilensuche wandert deshalb an die neue Schreibweise mit, statt zu entfallen; sonst faende
// findIndex -1, `i > capZeile` waere fuer JEDE Zeile wahr, und die Pruefung bestuende trivial.
const capZeile = zeilen.findIndex(l => l.includes("weicherDeckel(attackCombatBonusRaw"));
const buffZeile = zeilen.findIndex((l, i) => i > capZeile && /buff\.kind==='atk'/.test(l));
check('der +100%-Deckel greift VOR den Buffs (sie liegen also ausserhalb)',
  capZeile > 0 && buffZeile > capZeile, { deckel: capZeile + 1, buffs: buffZeile + 1 });

// (d) Die genannten Zahlen des Forschungs-Sprints
const zahl = re => { const m = quelle.match(re); return m ? m[1] : null; };
check('Forschungs-Sprint kostet 800 Punkte', zahl(/RESEARCH_SPRINT_COST = (\d+)/) === '800');
check('Forschungs-Sprint gibt +25%', zahl(/RESEARCH_SPRINT_MULT = ([\d.]+)/) === '1.25');
check('Forschungs-Sprint laeuft 20 Minuten', /RESEARCH_SPRINT_DURATION_MS = 20\*60\*1000/.test(quelle));
check('Quantensensoren laufen 30 Minuten', /QUANTENSENSOR_DURATION_MS = 30\*60000/.test(quelle));
check('Werft-Overdrive laeuft 30 Minuten und gibt -25%',
  /WERFT_OVERDRIVE_DURATION_MS = 30\*60000/.test(quelle) && /Werft-Overdrive \(-25% Schiffsbauzeit\)/.test(quelle));

// (e) "pro Art nur eine Quelle gleichzeitig nachkaufbar"
check('Shop-Booster derselben Art sind gesperrt, solange einer laeuft', /if \(buffKind && shopBuffActive\(buffKind\)\)/.test(quelle));
check('Forschungs-Sprint ist einfach-gesperrt', /if \(activeResearchSprint\(\)\)\{ log\('Es läuft bereits/.test(quelle));
check('Quantensensoren sind einfach-gesperrt', /if \(quantensensorActive\(\)\)\{ log/.test(quelle));
check('Werft-Overdrive ist einfach-gesperrt', /if \(werftOverdriveActive\(\)\)\{ log/.test(quelle));

// (f) "Ignorieren kann auch einen negativen Effekt bringen"
const negativ = [...quelle.matchAll(/optB:\{ label:'Ignorieren'[\s\S]{0,300}?state\.buffs\.push\(\{ kind:'[a-z_]+',(?: res:'[a-z]+',)? mult:([\d.]+)/g)]
  .map(m => parseFloat(m[1]));
check('es gibt tatsaechlich Ignorieren-Optionen mit negativem Effekt',
  negativ.length > 0 && negativ.some(v => v < 1), negativ);

// ---- Teil 2: Der Abschnitt ist im Spiel auch wirklich auffindbar
const SPIELSTAND = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9999, erz: 9999, kristalle: 9999, deuterium: 999, antimaterie: 99, forschungspunkte: 999 },
  buildings: { solar: 5, mine: 5 }, research: {}, fleet: { jaeger: 5, missions: [] }, colonies: {},
  activeBasePlanet: 'home', player: { id: 'u', name: 'Hilfetest', allianceTag: '', avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 300, buffs: [], lastTick: Date.now(),
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1400 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'me') return j({ userId: 'u', username: 'Hilfetest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
    if (p === 'storage/kepler7-save-v3') return j({ key: 'kepler7-save-v3', value: SPIELSTAND, version: 1 });
    if (p.startsWith('storage/')) return j({ e: 1 }, 404);
    return j({});
  });
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE); await page.waitForTimeout(2500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });

  // Hilfe-Tab oeffnen und die Kategorie "Fortschritt" aufklappen (die Kategorien sind eingeklappt).
  // Die Hilfe hat keinen .tab-btn in der Hauptleiste - sie haengt am "?"-Knopf in der Kopfzeile.
  await page.evaluate(() => { const b = document.getElementById('headerHelpBtn'); if (b) b.click(); });
  await page.waitForTimeout(600);
  const kategorien = await page.locator('#helpBox [data-help-cat]').count();
  check('die Hilfe ist offen und zeigt Kategorien', kategorien > 5, kategorien);
  await page.locator('#helpBox [data-help-cat="fortschritt"] .help-category-header').click();
  await page.waitForTimeout(400);

  const sichtbar = await page.locator('#helpBox [data-help-cat="fortschritt"]').innerText();
  check('der Abschnitt steht in der Kategorie „Fortschritt"', /Aktive Effekte \(Buffs\)/.test(sichtbar));
  for (const q of ['Zufallsereignisse', 'Expeditionen', 'Forschungs-Sprint', 'Kredit-Shop', 'Quantensensoren', 'Werft-Overdrive']){
    check('Quelle im Hilfetext genannt: ' + q, sichtbar.includes(q));
  }
  check('das Stapel-Beispiel steht drin', /x1,68/.test(sichtbar));
  check('der +100%-Deckel wird erwaehnt', /\+100%/.test(sichtbar));
  check('er nennt beide Timing-Regeln getrennt',
    /beim (LOSSCHICKEN|Losschicken) eingefroren/i.test(sichtbar) && /andere Spieler/.test(sichtbar));
  check('er warnt vor negativen Effekten', /negativen?\b/i.test(sichtbar) && /Ignorieren/.test(sichtbar));
  check('keine JS-Fehler', errs.length === 0, errs.slice(0, 3));

  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
