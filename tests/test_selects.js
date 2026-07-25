// Zwei <select>-Felder verlieren ihre Auswahl, weil ihre Box periodisch neu geschrieben wird und
// keine der erzeugten <option>s ein selected-Attribut traegt:
//
//   A) #raidDurationSelect (renderAllianceRaidBox) - render() baut die Box JEDE SEKUNDE neu. Der
//      Start-Knopf liest sel.value erst im Moment des Klicks, der Raid startet also stillschweigend
//      mit der Vorgabe-Dauer statt der gewaehlten. Das ist der schlimmere Fall: keine verlorene
//      Anzeige, sondern eine verfaelschte Eingabe.
//   B) [data-pact-gift-res] (renderDiplomacy) - alle 15 Sekunden vom Bestenlisten-Poller. Wer die
//      Ressource waehlt und laenger braucht, verschenkt eine andere als gewaehlt.
//
// Der Test klickt jeweils die ZWEITE Option und prueft, ob sie die Neuzeichnung ueberlebt.
const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, ueberspringen } = require('./lib/umgebung');
const path = require('path');

const FILE = SPIEL_URL;
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// Ein Pakt der Stufe 2+ ist Voraussetzung dafuer, dass die Geschenk-Auswahl ueberhaupt gerendert wird.
const MEIN_ID = 'u';
const jetzt = Date.now();
const PAKT = {
  a: MEIN_ID, b: 'gegner1', aName: 'Wahltest', bName: 'Nachbar', status: 'active',
  acceptedAt: jetzt - 86400000, expiresAt: jetzt + 7 * 86400000, tier: 2, giftsClaimed: {}
};

function backend(store){ return async r => {
  const req = r.request(); const u = new URL(req.url()); const p = u.pathname.split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: MEIN_ID, username: 'Wahltest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p === 'storage-list') {
    // storageList liefert { keys } - genau das erwartet loadDiplomacy().
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

const SPIELSTAND = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 99999, erz: 99999, kristalle: 99999, deuterium: 9999, antimaterie: 999, forschungspunkte: 999 },
  buildings: { solar: 8, mine: 8 }, research: {}, fleet: { jaeger: 20, missions: [] }, colonies: {},
  activeBasePlanet: 'home',
  // allianceRole 'admin' -> amIAllianceMusterLeader() == true -> das Dauer-Feld wird gerendert.
  player: { id: MEIN_ID, name: 'Wahltest', allianceTag: 'TST', allianceRole: 'admin', avatarKey: null },
  allianceBase: { foundedAt: jetzt - 86400000, level: 3, system: 'kepler' },
  allianceSubTab: 'uebersicht',
  battleStats: { wins: 0, losses: 0 }, xp: 3000, buffs: [], lastTick: jetzt,
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1500 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const store = {
    'kepler7-save-v3': SPIELSTAND,
    ['pact:gegner1_' + MEIN_ID]: JSON.stringify(PAKT),
    // Ohne dieses Rollen-Dokument wirft syncOwnAllianceRole() den Spieler alle 15s aus der Allianz
    // (ein 404 gilt dort bewusst als autoritatives "kein Mitglied").
    ['alliance:TST:role:' + MEIN_ID]: JSON.stringify({ role: 'admin', name: 'Wahltest' }),
    // Die Allianzbasis wird aus dem geteilten Dokument geladen und ueberschreibt den Wert aus dem
    // Spielstand - ohne sie zeigt die Raid-Box nur "braucht eine gegruendete Allianzbasis".
    'alliance:TST:base': JSON.stringify({ foundedAt: jetzt - 86400000, level: 3, system: 'kepler', tag: 'TST', announcedLevel: 3 })
  };
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE); await page.waitForTimeout(2800);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });

  // ---------- A) Raid-Dauer
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="allianz"]'); if (b) b.click(); });
  await page.waitForTimeout(400);
  // Der Raid-Bereich liegt in einem eigenen Allianz-Unterreiter - alle Unterpanels sichtbar schalten.
  await page.evaluate(() => { document.querySelectorAll('.alliance-subpanel').forEach(p => { p.style.display = ''; }); });
  await page.waitForTimeout(1200);

  const raidSel = '#allianceRaidBox #raidDurationSelect';
  const daSel = await page.locator(raidSel).count();
  if (daSel !== 1) console.log('   [Debug] allianceRaidBox:', (await page.evaluate(() => { const b = document.getElementById('allianceRaidBox'); return b ? b.innerText.slice(0,200) : 'FEHLT'; })));
  check('A: Dauer-Auswahlfeld wird gerendert', daSel === 1, daSel);
  if (daSel === 1){
    const optionen = await page.locator(raidSel + ' option').evaluateAll(os => os.map(o => o.value));
    check('A: drei Dauer-Optionen (30 Min / 1 Std / 2 Std)', optionen.length === 3, optionen);
    const zweite = optionen[1];
    await page.selectOption(raidSel, zweite);
    check('A: Auswahl ist zunächst gesetzt', (await page.locator(raidSel).inputValue()) === zweite, zweite);
    // Der Kern: ueberlebt sie die Neuzeichnung?
    await page.waitForTimeout(3000);
    check('A: Auswahl überlebt 3 Sekunden (mehrere Ticks)',
      (await page.locator(raidSel).inputValue()) === zweite,
      { gewaehlt: zweite, jetzt: await page.locator(raidSel).inputValue() });
    // Und der Knopf muss auch wirklich diesen Wert lesen (er tut das erst beim Klick).
    const wasDerKnopfLiest = await page.evaluate(() => {
      const s = document.querySelector('#allianceRaidBox #raidDurationSelect');
      return s ? s.value : null;
    });
    check('A: der Startknopf würde die gewählte Dauer verwenden', wasDerKnopfLiest === zweite,
      { liest: wasDerKnopfLiest, gewaehlt: zweite });
    // Dritte Option gegenpruefen, damit nicht einfach immer die zweite gewinnt.
    await page.selectOption(raidSel, optionen[2]);
    await page.waitForTimeout(2500);
    check('A: auch die dritte Option hält', (await page.locator(raidSel).inputValue()) === optionen[2]);
  }

  // ---------- C) Musterangriff-Dauer (gleiche Ursache, war nur verdeckt)
  // Diese Box hat einen isTypingIn()-Schutz: solange das Feld den Fokus hat, wird gar nicht neu
  // gezeichnet. Der Fehler zeigt sich also erst, wenn man - wie jeder Spieler vor dem Klick auf
  // "Angriff planen" - woanders hinklickt. Genau das macht der Test mit blur().
  const musterSel = '#allianceMusterBox #musterDurationSelect';
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="allianz"]'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelectorAll('.alliance-subpanel').forEach(p => { p.style.display = ''; }); });
  await page.waitForTimeout(900);
  const daMuster = await page.locator(musterSel).count();
  check('C: Musterangriff-Dauerfeld wird gerendert', daMuster === 1, daMuster);
  if (daMuster === 1){
    const optionen = await page.locator(musterSel + ' option').evaluateAll(os => os.map(o => o.value));
    const zweite = optionen[1];
    await page.selectOption(musterSel, zweite);
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
    await page.waitForTimeout(3000);
    check('C: Auswahl überlebt das Wegklicken + mehrere Ticks',
      (await page.locator(musterSel).inputValue()) === zweite,
      { gewaehlt: zweite, jetzt: await page.locator(musterSel).inputValue() });
  }

  // ---------- B) Pakt-Geschenk
  await page.evaluate(() => {
    const b = document.querySelector('.tab-btn[data-tab="galaxie"]'); if (b) b.click();
  });
  await page.waitForTimeout(400);
  // Diplomatie liegt im Galaxie-Unterreiter "diplo" - der ist standardmaessig ausgeblendet.
  await page.evaluate(() => { const b = document.querySelector('[data-galaxy-subtab="diplo"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  const giftSel = '#diplomacyBox [data-pact-gift-res]';
  const daGift = await page.locator(giftSel).count();
  if (!daGift) console.log('   [Debug] diplomacyBox:', (await page.evaluate(() => { const b = document.getElementById('diplomacyBox'); return b ? b.innerText.slice(0,250) : 'FEHLT'; })));
  check('B: Geschenk-Auswahlfeld wird gerendert', daGift >= 1, daGift);
  if (daGift >= 1){
    const optionen = await page.locator(giftSel).first().locator('option').evaluateAll(os => os.map(o => o.value));
    check('B: mehrere Ressourcen wählbar', optionen.length > 1, optionen);
    const zweite = optionen[1];
    await page.locator(giftSel).first().selectOption(zweite);
    check('B: Auswahl ist zunächst gesetzt', (await page.locator(giftSel).first().inputValue()) === zweite, zweite);
    // renderDiplomacy laeuft am 15s-Poller. Statt 16 Sekunden zu warten: die Neuzeichnung direkt
    // ausloesen - dasselbe innerHTML-Ueberschreiben, nur ohne Wartezeit im Test.
    // renderDiplomacy laeuft AUSSCHLIESSLICH ueber den 15-Sekunden-Poller (loadDiplomacy). Alles
    // im Spiel steckt in einer IIFE, es gibt also keinen Weg, sie von aussen aufzurufen - und ein
    // erzwungener Tabwechsel wuerde die Box gar nicht neu bauen, der Test waere gruen ohne etwas
    // zu pruefen. Also wirklich abwarten, bis der echte Poller einmal gefeuert hat.
    //
    // Erkannt wird das ueber eine Markierung am DOM-Knoten selbst, NICHT ueber geaenderten HTML-Text:
    // die Box erzeugt zwischen zwei Durchlaeufen zeichengleiches HTML (kein Countdown darin), das
    // innerHTML-Ueberschreiben findet aber trotzdem statt und ersetzt den Knoten. Genau das ist ja
    // die Ursache des Fehlers.
    await page.evaluate(() => { document.querySelector('#diplomacyBox [data-pact-gift-res]').dataset.testMarke = '1'; });
    await page.waitForFunction(() => {
      const s = document.querySelector('#diplomacyBox [data-pact-gift-res]');
      return s && s.dataset.testMarke !== '1';
    }, null, { timeout: 30000 });
    await page.waitForTimeout(200);
    check('B: Auswahl überlebt die Neuzeichnung',
      (await page.locator(giftSel).first().inputValue()) === zweite,
      { gewaehlt: zweite, jetzt: await page.locator(giftSel).first().inputValue() });
  }

  check('keine JS-Fehler', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
