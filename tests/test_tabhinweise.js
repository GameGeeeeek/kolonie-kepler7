// Kontextbezogene Ersthinweise (v8.298.3): Beim ERSTEN Oeffnen eines Tabs erscheint eine Leiste mit
// einem Satz dazu, was es dort zu tun gibt, plus Sprung in den passenden Hilfe-Abschnitt. Nach
// "Verstanden" ist sie fuer diesen Tab dauerhaft weg (state.seenTabHints).
//
// Geprueft wird:
//   1) statisch: jeder TAB_HINTS-Eintrag hat ein Icon aus der 69er-Whitelist, einen gueltigen
//      HELP_SECTIONS-Schluessel und einen vollstaendigen Satz (CLAUDE.md: "Icon UND Beschreibung")
//   2) der Hinweis erscheint beim ersten Oeffnen eines Tabs
//   3) "Verstanden" laesst ihn verschwinden UND landet im Spielstand
//   4) er kommt beim erneuten Oeffnen NICHT wieder - auch nicht nach einem Reload
//   5) ein bereits weggeklickter Tab zeigt beim ersten Besuch in dieser Sitzung gar nichts
//   6) waehrend des Tutorials wird nichts angezeigt (sonst redet das Spiel doppelt)
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

const FILE = SPIEL_URL;
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const MEIN_ID = 'u';
const jetzt = Date.now();

// ------------------------------------------------------- 1) statische Pruefung an der Spieldatei
const html = fs.readFileSync(SPIELDATEI, 'utf8');
const hintBlock = (html.match(/const TAB_HINTS = \{[\s\S]*?\n  \};/) || [])[0] || '';
const eintraege = [...hintBlock.matchAll(/^\s{4}(\w+): \{ icon:'([^']+)', help:'([^']+)',\s*\n\s*text:'([\s\S]*?)' \},?$/gm)]
  .map(m => ({ tab: m[1], icon: m[2], help: m[3], text: m[4] }));
const iconWhitelist = new Set([...html.matchAll(/^\s*\.(ti-[a-z0-9-]+):before/gm)].map(m => m[1]));
const helpKeys = new Set([...html.matchAll(/\{ key:'(\w+)', icon:'ti-[a-z0-9-]+', title:'/g)].map(m => m[1]));
const tabKeys = [...new Set([...html.matchAll(/data-tab="([a-z]+)"/g)].map(m => m[1]))];

check('TAB_HINTS gefunden und geparst', eintraege.length > 0, eintraege.length);
check('jeder Tab-Knopf hat einen Ersthinweis',
  tabKeys.every(t => eintraege.some(e => e.tab === t)),
  tabKeys.filter(t => !eintraege.some(e => e.tab === t)));
check('alle Icons stammen aus der Icon-Whitelist',
  eintraege.every(e => iconWhitelist.has(e.icon)),
  eintraege.filter(e => !iconWhitelist.has(e.icon)).map(e => e.tab + '=' + e.icon));
check('alle Hilfe-Sprungziele existieren in HELP_SECTIONS',
  eintraege.every(e => helpKeys.has(e.help)),
  eintraege.filter(e => !helpKeys.has(e.help)).map(e => e.tab + '->' + e.help));
// Der Anlass fuer die CLAUDE.md-Regel war ein Kuerzel-Text wie "Lagerkapazitaet (vertieft)" - ein
// ganzer, selbsterklaerender Satz ist Pflicht, keine Stichwortliste.
const zuKurz = eintraege.filter(e => e.text.replace(/<[^>]+>/g, '').length < 120);
check('jede Beschreibung ist ein vollstaendiger Satz (>= 120 Zeichen)', zuKurz.length === 0,
  zuKurz.map(e => e.tab + '=' + e.text.length));
// Umlaut-Falle: Beim Schreiben dieser Texte war zuerst die ASCII-Umschrift drin ("Gebaeude",
// "fuer") - im Spiel sieht das falsch aus. Geprueft wird gegen eine Liste konkreter Umschrift-Stämme
// statt gegen "ae|oe|ue" allgemein, weil echte deutsche Wörter diese Buchstabenpaare enthalten
// (z.B. "losschickst", "Museum") und eine breite Regex nur Fehlalarme produziert.
const UMSCHRIFT = /(fuer|ueber|zurueck|waehl|gewaehl|Gebaeude|erhoeh|Spaeh|groess|taeglich|zusaetzlich|Ausruestung|spuerbar|guenstig|laeuft|ausschliesslich|Faehigkeit|Waehrung|schuetz|druecken|uebersieht|schlaegt|Qualitaet|Beitraege|Ausserdem|Grosse)/;
const ohneUmlaut = eintraege.filter(e => UMSCHRIFT.test(e.text));
check('Texte benutzen echte Umlaute statt der ASCII-Umschrift', ohneUmlaut.length === 0, ohneUmlaut.map(e => e.tab));

function backend(store){ return async r => {
  const req = r.request(); const u = new URL(req.url()); const p = u.pathname.split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: MEIN_ID, username: 'Hinweistest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p === 'storage-list') {
    const prefix = u.searchParams.get('prefix') || '';
    return j({ keys: Object.keys(store).filter(k => k.startsWith(prefix)) });
  }
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData() || '{}').value; } catch(e){} return j({ ok: true }); }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
    return j({ e: 1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

function spielstand(extra){
  return JSON.stringify(Object.assign({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 9999, erz: 9999, kristalle: 9999, deuterium: 999, antimaterie: 99, forschungspunkte: 99 },
    buildings: { solar: 8, mine: 8 }, research: {}, fleet: { jaeger: 10, missions: [] }, colonies: {},
    activeBasePlanet: 'home',
    player: { id: MEIN_ID, name: 'Hinweistest', allianceTag: null, avatarKey: null },
    battleStats: { wins: 0, losses: 0 }, xp: 1000, buffs: [], lastTick: jetzt,
    colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
  }, extra || {}));
}

// Die Start-Overlays wuerden tabHintBlocked() ausloesen - im echten Spiel klickt der Spieler sie weg,
// im Test verstecken wir sie. NICHT das tutorialOverlay: dafuer gibt es Punkt 6 mit eigenem Ladevorgang.
const OVERLAYS_WEG = () => { ['welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); };

const klickTab = tab => `document.querySelector('.tab-btn[data-tab="${tab}"]').click()`;
const hinweisText = () => { const b = document.getElementById('tabHintBar'); return (b && b.style.display !== 'none') ? b.innerText.trim() : ''; };

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1400 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));

  // "markt" ist noch nie geoeffnet worden, "forschung" gilt schon als gesehen (Punkt 5).
  const store = { 'kepler7-save-v3': spielstand({ seenTabHints: { forschung: true } }) };
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE); await page.waitForTimeout(2800);
  await page.evaluate(OVERLAYS_WEG);

  // -------------------------------------------------- 2) Hinweis beim ersten Oeffnen
  await page.evaluate(klickTab('markt'));
  await page.waitForTimeout(500);
  const ersterText = await page.evaluate(hinweisText);
  check('2: Markt zeigt beim ersten Oeffnen einen Hinweis', ersterText.length > 60, ersterText.slice(0, 90));
  check('2: der Hinweis hat einen "Mehr dazu"-Knopf ins richtige Hilfe-Kapitel',
    await page.locator('#tabHintBar [data-jump-help="markt"]').count() === 1);
  check('2: der Hinweis hat einen "Verstanden"-Knopf',
    await page.locator('#tabHintBar [data-tab-hint-dismiss="markt"]').count() === 1);

  // Er darf nicht jede Sekunde neu gebaut werden - sonst flackert er beim Anfassen (tabHintShownFor).
  await page.evaluate(() => { document.querySelector('#tabHintBar .tab-hint').dataset.testMarke = '1'; });
  await page.waitForTimeout(3000);
  check('2: die Leiste wird nicht jeden Tick neu geschrieben',
    await page.evaluate(() => { const el = document.querySelector('#tabHintBar .tab-hint'); return !!el && el.dataset.testMarke === '1'; }));

  // -------------------------------------------------- 5) bereits gesehener Tab zeigt nichts
  await page.evaluate(klickTab('forschung'));
  await page.waitForTimeout(600);
  check('5: bereits weggeklickter Tab (forschung) zeigt keinen Hinweis',
    (await page.evaluate(hinweisText)) === '');

  // Ein dritter, noch ungesehener Tab muss dagegen wieder einen zeigen - sonst wuerde Punkt 5 auch
  // dann gruen, wenn die Leiste generell kaputt waere.
  await page.evaluate(klickTab('offiziere'));
  await page.waitForTimeout(600);
  const offiziereText = await page.evaluate(hinweisText);
  check('5: ungesehener Tab (offiziere) zeigt dagegen sehr wohl einen Hinweis',
    offiziereText.length > 60, offiziereText.slice(0, 70));
  check('5: die Hinweise unterscheiden sich je Tab', offiziereText !== ersterText);

  // -------------------------------------------------- 3) "Verstanden"
  await page.evaluate(klickTab('markt'));
  await page.waitForTimeout(500);
  check('3: der Markt-Hinweis steht vor dem Wegklicken noch',
    (await page.evaluate(hinweisText)).length > 60);
  await page.click('#tabHintBar [data-tab-hint-dismiss="markt"]');
  await page.waitForTimeout(400);
  check('3: nach "Verstanden" ist die Leiste weg', (await page.evaluate(hinweisText)) === '');
  // Und zwar dauerhaft: der Spielstand muss es enthalten, sonst kaeme er nach dem Reload wieder.
  await page.waitForTimeout(1200);
  const gespeichert = JSON.parse(store['kepler7-save-v3'] || '{}').seenTabHints || {};
  check('3: "markt" steht als gesehen im gespeicherten Spielstand', gespeichert.markt === true, gespeichert);

  // -------------------------------------------------- 4) kommt nicht wieder
  await page.evaluate(klickTab('galaxie'));
  await page.waitForTimeout(400);
  await page.evaluate(klickTab('markt'));
  await page.waitForTimeout(600);
  check('4: erneutes Oeffnen zeigt den Hinweis nicht wieder', (await page.evaluate(hinweisText)) === '');

  await page.reload(); await page.waitForTimeout(2800);
  await page.evaluate(OVERLAYS_WEG);
  await page.evaluate(klickTab('markt'));
  await page.waitForTimeout(600);
  check('4: auch nach einem Reload bleibt er weg', (await page.evaluate(hinweisText)) === '');

  // -------------------------------------------------- 7) Zuruecksetzen in den Einstellungen
  // Ohne diesen Weg gaebe es kein Zurueck: wer alle zwoelf Hinweise weggeklickt hat, kaeme nie
  // wieder an sie heran. Ausgangslage hier: "markt" und "forschung" gelten als gesehen.
  await page.evaluate(() => { const b = document.getElementById('headerProfileBtn'); if (b) b.click(); });
  await page.waitForTimeout(500);
  check('7: die Karte „Ersthinweise zurücksetzen" existiert',
    await page.locator('#resetTabHintsBtn').count() === 1);
  await page.click('#resetTabHintsBtn');
  await page.waitForTimeout(400);
  check('7: die Karte bestätigt das Zurücksetzen sichtbar',
    /Zurückgesetzt/.test(await page.evaluate(() => (document.getElementById('resetTabHintsMeta') || {}).textContent || '')));
  await page.waitForTimeout(1200);
  const zurueckgesetzt = JSON.parse(store['kepler7-save-v3'] || '{}').seenTabHints || {};
  check('7: der Spielstand enthält keine gesehenen Hinweise mehr',
    Object.keys(zurueckgesetzt).length === 0, zurueckgesetzt);
  // Und der Hinweis kommt an den bereits weggeklickten Tabs tatsaechlich wieder.
  await page.evaluate(klickTab('markt'));
  await page.waitForTimeout(600);
  check('7: der zuvor weggeklickte Markt-Hinweis erscheint wieder',
    (await page.evaluate(hinweisText)).length > 60, (await page.evaluate(hinweisText)).slice(0, 70));
  await page.evaluate(klickTab('forschung'));
  await page.waitForTimeout(600);
  check('7: auch der von Anfang an als gesehen markierte Tab zeigt wieder einen Hinweis',
    (await page.evaluate(hinweisText)).length > 60);
  // Die Bestaetigung darf nicht dauerhaft stehen bleiben - beim naechsten Besuch der Einstellungen
  // waere „Zurueckgesetzt" schlicht falsch.
  let zurueck = true;
  try {
    await page.waitForFunction(() => {
      const el = document.getElementById('resetTabHintsMeta');
      return el && !/Zurückgesetzt/.test(el.textContent);
    }, null, { timeout: 8000 });
  } catch(e){ zurueck = false; }
  check('7: die Bestätigung weicht wieder der Beschreibung', zurueck,
    await page.evaluate(() => (document.getElementById('resetTabHintsMeta') || {}).textContent || ''));

  // -------------------------------------------------- 6) waehrend des Tutorials nichts
  const ctx2 = await browser.newContext({ viewport: { width: 1200, height: 1400 } });
  const page2 = await ctx2.newPage();
  page2.on('pageerror', e => errs.push(String(e)));
  const store2 = { 'kepler7-save-v3': spielstand({ tutorialSeen: false, newbieWelcomeSeen: true }) };
  await page2.route('**/api/**', backend(store2));
  await page2.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page2.goto(FILE); await page2.waitForTimeout(2800);
  const tutorialOffen = await page2.evaluate(() => { const o = document.getElementById('tutorialOverlay'); return !!o && o.style.display === 'flex'; });
  check('6: das Tutorial laeuft (Voraussetzung fuer die naechste Pruefung)', tutorialOffen);
  await page2.evaluate(klickTab('markt'));
  await page2.waitForTimeout(1500);
  check('6: waehrend des Tutorials erscheint kein Ersthinweis', (await page2.evaluate(hinweisText)) === '');

  // Nach dem Durchklicken des Tutorials muss er dagegen kommen.
  for (let i = 0; i < 12; i++){
    const offen = await page2.evaluate(() => { const o = document.getElementById('tutorialOverlay'); return !!o && o.style.display === 'flex'; });
    if (!offen) break;
    await page2.click('#tutorialNextBtn');
    await page2.waitForTimeout(150);
  }
  // Hinter dem Tutorial koennen noch "Willkommen zurueck"/Patchnotes stehen - die blocken den
  // Hinweis weiterhin (so gewollt). Im echten Spiel klickt der Spieler sie weg, hier der Test.
  await page2.evaluate(OVERLAYS_WEG);
  await page2.waitForTimeout(1500);
  const nachTutorial = await page2.evaluate(hinweisText);
  check('6: direkt nach dem Tutorial erscheint der Hinweis des offenen Tabs',
    nachTutorial.length > 60, nachTutorial.slice(0, 70));

  check('keine JS-Fehler', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
