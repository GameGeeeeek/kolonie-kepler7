// Fähigkeitsbaum-Ausbau (v8.429.0): 8 neue feste Knoten mit neuen Wirkungsarten + 3 wiederholbare
// Meisterschaften (SKILL_MASTERY, eigenes Array).
//
// WAS HIER GEPRÜFT WIRD - Regeln, keine Momentaufnahmen (CLAUDE.md Arbeitsregel 3):
//   1) Struktur: eindeutige Schlüssel, lineare Ketten, jede Meisterschaft hängt am LETZTEN festen
//      Knoten ihres Zweigs. Alles aus den geparsten Arrays gerechnet, keine Ziffer hinterlegt.
//   2) Icons: JEDER Knoten (fest + Meisterschaft) trägt ein Icon aus der eingebetteten Whitelist -
//      die Whitelist wird aus der Spieldatei selbst gezogen (.ti-*:before), nie aus dem Gedächtnis.
//   3) Verdrahtung: jede Zugriffsfunktion wird an ihrer Einbaustelle wirklich gerufen. Genau die
//      Fehlerklasse "Wirkung versprochen, nirgends verrechnet", die es hier schon gab (v8.322.0,
//      Kommentar bei den Standort-Modulen). skillRecyclerBonus muss an BEIDEN Ratenformeln stehen
//      (Wahrheit UND ETA-Anzeige), sonst lügt die Anzeige.
//   4) skillPointsSpent zählt die Meisterschaften mit - sonst wären ihre Stufen gratis.
//   5) Backend-Parität: SKILL_WAR_BONUS in server.js muss exakt die war-Knoten mit bonus>0 spiegeln.
//      Genau daran war der Server seit dem 01.08.2026 kaputt (war4/war5 fehlten) - dieser Test hätte
//      es am Tag der Einführung gemeldet. Dazu: die Void-Reaktor-Stufenkurve (2 - 0.5^(n-1)) muss
//      auch im Server stehen, nicht ein pauschales +10%.
//   6) Browser: echter Kauf über die Knöpfe (fester Knoten UND Meisterschaft zweimal), danach
//      Wirkung GEMESSEN - Lagerdeckel-Verhältnis gegen skillLagerBonus() aus dem Spiel selbst
//      gerechnet (Arbeitsregel 2: gegen Gemessenes vergleichen, nie gegen eingetippte Zahlen),
//      Flottenslots +1, Vorwarnzeit +120, Veteranen-XP nur bei GEWINNEN verstärkt.
//
// GEGENPROBE (Arbeitsregel 1, beim Einführen ausgeführt): gegen den Stand davor
// (git show HEAD:weltraum_kolonie.html) fällt der Test durch - kein SKILL_MASTERY, keine Icons.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// Array-Literal aus der Datei schneiden und auswerten. Endanker-Existenz wird geprüft (Regel 6).
function parseArray(name) {
  const von = JS.indexOf('const ' + name + ' = [');
  if (von < 0) return null;
  const bis = JS.indexOf('\n  ];', von);
  if (bis < 0) return null;
  try { return new Function('return ' + JS.slice(von + ('const ' + name + ' = ').length, bis + 5))(); }
  catch (e) { return null; }
}
function funktionsRumpf(name) {
  const von = JS.indexOf('function ' + name + '(');
  if (von < 0) return '';
  const bis = JS.indexOf('\n  function ', von + 20);
  return bis > von ? JS.slice(von, bis) : '';
}

const TREE = parseArray('SKILL_TREE');
const MASTERY = parseArray('SKILL_MASTERY');
check('1a: SKILL_TREE und SKILL_MASTERY geparst', !!(TREE && MASTERY),
  { tree: TREE ? TREE.length : null, mastery: MASTERY ? MASTERY.length : null });
if (!TREE || !MASTERY) return ende();

// --- 1) Struktur
const alleKeys = TREE.concat(MASTERY).map(n => n.key);
check('1b: alle Schlüssel eindeutig', new Set(alleKeys).size === alleKeys.length, alleKeys.length);
const branches = [...new Set(TREE.map(n => n.branch))];
let kettenOk = true, mastReqOk = true;
for (const b of branches) {
  const kette = TREE.filter(n => n.branch === b);
  if (kette[0].requires !== null) kettenOk = false;
  for (let i = 1; i < kette.length; i++) if (kette[i].requires !== kette[i - 1].key) kettenOk = false;
  const m = MASTERY.find(x => x.branch === b);
  if (!m || m.requires !== kette[kette.length - 1].key || !(m.maxStufen > 0) || !(m.cost > 0)) mastReqOk = false;
}
check('1c: jede Zweig-Kette ist lückenlos linear', kettenOk);
check('1d: jede Meisterschaft hängt am letzten festen Knoten ihres Zweigs', mastReqOk);
// Der Ausbau-Zweck, als Regel: jeder Zweig hat neue Wirkungsarten (bonus:0-Knoten), und die
// Meisterschaften (gerechnet aus cost*maxStufen) tragen mehr Laufweite als der feste Baum selbst.
check('1e: jeder Zweig hat mindestens einen Knoten neuer Wirkungsart (bonus:0)',
  branches.every(b => TREE.some(n => n.branch === b && n.bonus === 0)));
const festKosten = TREE.reduce((a, n) => a + n.cost, 0);
const mastKosten = MASTERY.reduce((a, m) => a + m.cost * m.maxStufen, 0);
check('1f: Meisterschaften geben mehr Punkte-Laufweite als der feste Baum', mastKosten > festKosten,
  { fest: festKosten, meisterschaften: mastKosten });

// --- 2) Icons aus der Whitelist, vollständige Beschreibungen
const whitelist = new Set([...HTML.matchAll(/\.(ti-[a-z0-9-]+):before/g)].map(m => m[1]));
check('2a: Whitelist aus der Datei gezogen', whitelist.size > 50, whitelist.size);
const ohneIcon = TREE.concat(MASTERY).filter(n => !n.icon || !whitelist.has(n.icon)).map(n => n.key);
check('2b: jeder Knoten trägt ein Icon aus der Whitelist', ohneIcon.length === 0, ohneIcon);
const knappeDesc = TREE.concat(MASTERY).filter(n => !n.desc || (n.bonus === 0 || n.maxStufen) && n.desc.length < 60).map(n => n.key);
check('2c: neue Wirkungsarten haben ganze Sätze als Beschreibung', knappeDesc.length === 0, knappeDesc);

// --- 2d) Beschreibung ↔ Code: die Zahl im Spielertext muss die gerechnete sein.
// Die Zugriffsfunktionen werden aus der Datei geschnitten und mit gestelltem state ausgeführt -
// das Spiel läuft in einer IIFE, von außen kommt man an sie nicht heran. Erwartungswerte kommen
// aus den desc-Texten selbst (erste Zahl), nicht aus diesem Test: genau die Fehlerklasse
// "zweite Anzeigestelle mit alter Annahme" (CLAUDE.md Pflicht 6), hier maschinell geprüft.
{
  const von = JS.indexOf('function skillStufe(');
  const bis = JS.indexOf('\n  const SKILL_BRANCH_INFO');
  check('2d: Zugriffsfunktionen gefunden (Anker existieren)', von > 0 && bis > von);
  const api = st => new Function('state', JS.slice(von, bis) +
    '\nreturn {skillLagerBonus, skillTier2Bonus, skillRecyclerBonus, skillVetXpMult, skillWarnBonusSec, skillFuelBonus, skillFleetSlots};')(st);
  const zahl = key => { const d = TREE.concat(MASTERY).find(n => n.key === key).desc;
    const m = d.match(/([+-−]?)(\d+(?:,\d+)?)/); return Number(m[2].replace(',', '.')); };
  const nur = key => api({ skillTree: { [key]: key.endsWith('M') ? 1 : true } });
  const leer = api({ skillTree: {} });
  check('2e: eco6-Prozent stimmt mit der Beschreibung überein',
    Math.abs(nur('eco6').skillLagerBonus() * 100 - zahl('eco6')) < 1e-9, zahl('eco6'));
  check('2f: eco7/eco8-Prozente stimmen mit der Beschreibung überein',
    Math.abs(nur('eco7').skillTier2Bonus() * 100 - zahl('eco7')) < 1e-9 &&
    Math.abs(nur('eco8').skillRecyclerBonus() * 100 - zahl('eco8')) < 1e-9);
  check('2g: war6-Prozent und war7-Sekunden stimmen mit der Beschreibung überein',
    Math.abs((nur('war6').skillVetXpMult() - 1) * 100 - zahl('war6')) < 1e-9 &&
    nur('war7').skillWarnBonusSec() === zahl('war7'));
  check('2h: log7-Prozent und log8-Slot stimmen mit der Beschreibung überein',
    Math.abs(nur('log7').skillFuelBonus() * 100 - zahl('log7')) < 1e-9 &&
    nur('log8').skillFleetSlots() === zahl('log8'));
  check('2i: Meisterschafts-Wirkung je Stufe stimmt mit der Beschreibung überein',
    Math.abs(nur('ecoM').skillLagerBonus() * 100 - zahl('ecoM')) < 1e-9 &&
    Math.abs((nur('warM').skillVetXpMult() - 1) * 100 - zahl('warM')) < 1e-9 &&
    Math.abs(nur('logM').skillFuelBonus() * 100 - zahl('logM')) < 1e-9);
  check('2j: ohne Knoten alles neutral',
    leer.skillLagerBonus() === 0 && leer.skillVetXpMult() === 1 && leer.skillWarnBonusSec() === 0 &&
    leer.skillFuelBonus() === 0 && leer.skillFleetSlots() === 0 && leer.skillTier2Bonus() === 0);
}

// --- 3) Verdrahtung der Einbaustellen
check('3a: storageCap ruft skillLagerBonus', funktionsRumpf('storageCap').includes('skillLagerBonus()'));
// Der Aufruf sass bis v8.514.0 direkt in tier2Step. Seit die Tier-2-Fabrikkarte denselben
// Durchsatz braucht (sie rechnete ihn vorher gar nicht mit), steht er in tier2DurchsatzMult, das
// tier2Step ruft. Die gepruefte REGEL ist unveraendert - der Skill-Bonus zaehlt additiv mit dem
// Weltprojekt -, nur ihr Ort hat sich verschoben; der Test folgt dem, statt auf der alten Stelle
// zu bestehen (Arbeitsregel 3: die Regel pruefen, nicht die Momentaufnahme). Geprueft wird
// deshalb BEIDES, sonst koennte die Funktion den Bonus tragen, ohne dass die Fabrik sie ruft.
const durchsatzRumpf = funktionsRumpf('tier2DurchsatzMult');
check('3b: der Tier-2-Durchsatz nimmt skillTier2Bonus additiv mit dem Weltprojekt auf',
  durchsatzRumpf.includes('skillTier2Bonus()') && /\+ skillTier2Bonus\(\)/.test(durchsatzRumpf));
check('3b2: und tier2Step bildet seinen Durchsatz über genau diese Funktion',
  funktionsRumpf('tier2Step').includes('tier2DurchsatzMult()'));
check('3c: skillRecyclerBonus an BEIDEN Ratenformeln (Wahrheit + ETA-Anzeige)',
  (JS.match(/(?<!function )skillRecyclerBonus\(\)/g) || []).length === 2 &&
  funktionsRumpf('collectDebrisWithRecyclers').includes('skillRecyclerBonus()') &&
  funktionsRumpf('recyclerAuftragRest').includes('skillRecyclerBonus()'));
const vetRumpf = funktionsRumpf('addVeteranXp');
check('3d: addVeteranXp verstärkt nur GEWINNE (amt > 0 vor skillVetXpMult)',
  vetRumpf.includes('skillVetXpMult()') && /if \(amt > 0\)[^\n]*skillVetXpMult/.test(vetRumpf));
check('3e: raidDetectionLead addiert skillWarnBonusSec',
  funktionsRumpf('raidDetectionLead').includes('skillWarnBonusSec()'));
const fuelRumpf = funktionsRumpf('missionFuelCostSplit');
// Seit v8.468.0 ist der Deckel weich (Ueberlauf statt Klippe) und steht als
// deckelWeich(<summe>, 0.5) statt als Boden auf dem Multiplikator. Die gepruefte REGEL ist
// unveraendert: Der Faehigkeitsbaum-Bonus liegt IM selben Deckel wie der Modul-Bonus und hat
// keinen eigenen Kanal - deshalb muss er INNERHALB des weicherDeckel-Aufrufs stehen.
check('3f: Treibstoff-Bonus sitzt IM Deckel des Depots (kein eigener Kanal)',
  /deckelWeich\([^\n]*skillFuelBonus\(\), 0\.5\)/.test(fuelRumpf));
check('3g: maxConcurrentFleets addiert skillFleetSlots',
  funktionsRumpf('maxConcurrentFleets').includes('skillFleetSlots()'));

// --- 4) Punkte-Buchhaltung und Anzeige-Paare
check('4a: skillPointsSpent zählt die Meisterschaften mit',
  funktionsRumpf('skillPointsSpent').includes('SKILL_MASTERY'));
const koordDef = (JS.split('\n').find(z => z.includes("key:'rflottenkoord'")) || '');
check('4b: rflottenkoord-Beschreibung kennt den +1-Slot aus dem Baum', koordDef.includes('Parallelkommando'));
check('4c: Meisterschafts-Knöpfe sind gezeichnet UND verdrahtet',
  JS.includes('data-skillmastery="${m.key}"') && JS.includes("querySelectorAll('[data-skillmastery]')"));

// --- 5) Backend-Parität (überspringt sich nur selbst, wenn das Backend-Repo fehlt)
if (SERVER_JS) {
  const srv = fs.readFileSync(SERVER_JS, 'utf8');
  const m = srv.match(/const SKILL_WAR_BONUS = \{([^}]*)\}/);
  const serverWar = {};
  if (m) for (const t of m[1].matchAll(/(\w+):\s*([\d.]+)/g)) serverWar[t[1]] = Number(t[2]);
  const frontWar = TREE.filter(n => n.branch === 'war' && n.bonus > 0);
  const fehlend = frontWar.filter(n => serverWar[n.key] !== n.bonus).map(n => n.key);
  const zuviel = Object.keys(serverWar).filter(k => !frontWar.some(n => n.key === k));
  check('5a: SKILL_WAR_BONUS im Server spiegelt exakt die war-Knoten mit bonus>0',
    !!m && fehlend.length === 0 && zuviel.length === 0, { fehlend, zuviel, server: serverWar });
  check('5b: Void-Reaktor-Stufenkurve (2 - 0.5^(n-1)) steht auch im Server, kein Pauschalwert',
    JS.includes('2 - Math.pow(0.5, st - 1)') && srv.includes('2 - Math.pow(0.5,'));
} else {
  console.log('SKIP - Backend-Repo liegt nicht daneben, Paritätsprüfung 5a/5b übersprungen.');
}

// --- 6) Browser: echter Kauf und gemessene Wirkung
const SAVE = () => JSON.stringify({ tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9e6, erz: 9e6, kristalle: 9e6, deuterium: 9e6, antimaterie: 9e4, forschungspunkte: 9e4 },
  buildings: { solar: 20, mine: 20, raffinerie: 15, lager: 30, werft: 10 },
  research: { rflottenkoord: 3, rscanner: 2 },
  fleet: { jaeger: 50, frachter: 20, recycler: 5, missions: [] }, colonies: {},
  activeBasePlanet: 'home', player: { id: 'u', name: 'A', avatarKey: null },
  // eco-Kette komplett vorbesetzt: der Meisterschafts-Kauf braucht den letzten festen Knoten,
  // und der feste Kauf-Klick unten nimmt deshalb den war-Zweig.
  skillTree: { eco1: true, eco2: true, eco3: true, eco4: true, eco5: true, eco6: true, eco7: true, eco8: true },
  veteranXp: { home: 1000 },
  xp: 9e6, credits: 9e5, buffs: [], lastTick: Date.now(), colonyNames: {} });

function backend(store) { return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true, supporter: { active: false, tier: null } });
  if (p === 'reports') return j({ reports: [] });
  if (p === 'storage-list') return j({ keys: [] });
  if (p.startsWith('storage/')) {
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData()).value; } catch (e) {} return j({ ok: true, version: 2 }); }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
    return j({ e: 1 }, 404);
  }
  return j([]);
}; }

(async () => {
  const browser = await starteBrowser();
  const store = { 'kepler7-save-v3': SAVE() };
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay'].forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }));

  // In den Fortschritt-Tab, damit der Baum überhaupt gezeichnet wird (Render-Gate auf activeTab).
  await page.evaluate(() => { const b = document.querySelector('[data-tab="fortschritt"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);

  // Das Spiel läuft in einer IIFE - der Kauf wird deshalb komplett über das DOM geführt und
  // über das DOM gemessen: der Punktestand im Kopf der Box (erste <strong> im ersten .bmeta),
  // das Verschwinden des Kaufknopfs und der Stufenzähler der Meisterschaft.
  const avail = async () => page.evaluate(() =>
    Number((document.querySelector('#skillTreeBox .bmeta strong') || {}).textContent));
  const vorher = await avail();
  check('6a: Baum gezeichnet, Punktestand lesbar', Number.isFinite(vorher) && vorher > 20, vorher);

  // Fester Knoten über den echten Knopf (auf die Box beschränkt - Arbeitsregel 5).
  await page.evaluate(() => { const b = document.querySelector('#skillTreeBox [data-skillnode="war1"]'); if (b) b.click(); });
  await page.waitForTimeout(300);
  const nachFest = await avail();
  const war1Weg = await page.evaluate(() => !document.querySelector('#skillTreeBox [data-skillnode="war1"]'));
  check('6b: fester Knoten gekauft - Punkte um seine Kosten gesunken, Knopf weg',
    vorher - nachFest === TREE.find(n => n.key === 'war1').cost && war1Weg, { vorher, nachFest, war1Weg });

  // Meisterschaft zweimal über den echten Knopf; nach jedem Kauf zeichnet render() den Baum neu,
  // der Knopf wird deshalb jedes Mal frisch gesucht.
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => { const b = document.querySelector('#skillTreeBox [data-skillmastery="ecoM"]'); if (b) b.click(); });
    await page.waitForTimeout(300);
  }
  const nachMast = await avail();
  const stufenText = await page.evaluate(() =>
    (document.getElementById('skillTreeBox').textContent.match(/Stufe \d+\/\d+/) || [null])[0]);
  check('6c: Meisterschaft zweimal gesteigert - Punkte je Stufe abgezogen',
    nachFest - nachMast === 2 * MASTERY.find(m => m.key === 'ecoM').cost, { nachFest, nachMast });
  check('6d: Stufenzähler steht im Baum (eco-Zweig zeichnet zuerst)',
    stufenText === 'Stufe 2/' + MASTERY.find(m => m.key === 'ecoM').maxStufen, stufenText);

  // Gegenprobe im selben Lauf: ein gesperrter Meisterschafts-Knopf (warM ohne war-Kette) darf
  // beim Klick NICHTS abziehen - disabled-Knöpfe feuern kein click, und selbst wenn, prüft
  // buySkillMastery die Voraussetzung.
  await page.evaluate(() => { const b = document.querySelector('#skillTreeBox [data-skillmastery="warM"]'); if (b) b.click(); });
  await page.waitForTimeout(300);
  check('6e: gesperrte Meisterschaft nicht kaufbar', (await avail()) === nachMast);
  check('6f: keine JS-Fehler', errs.length === 0, errs.slice(0, 3));

  await ende(async () => { await ctx.close(); await browser.close(); });
})();
