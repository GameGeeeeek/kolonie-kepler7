// Kompaktkarten (Etappe S-1, v8.509.0): Die Detail-Texte der Gebäude- und Forschungskarten
// klappen ein (Standard ZU) - sichtbar bleiben Name, Stufe, KOSTEN, Knöpfe und der
// Sabotage-Alarm; fertige Karten schrumpfen auf eine Zeile mit Max-Abzeichen. Der Klappzustand
// nutzt data-keep-open/detailsOpenAttr und muss das sekündliche Neuzeichnen überleben.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_kompaktkarten.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_kompaktkarten.js
//   Am alten Stand fallen 1/2 (keine Klapp-Details) und 4 (Beschreibung immer sichtbar).
//
// Fixture-Fakten aus dem Code abgelesen (Hausregel 4): quantenchipfabrik hat maxLevel 15 und
// requires ['rquantenphysik'] - mit Stufe 15 im Fixture ist sie die fertige Karte. Uhr-Regel
// (Hausregel 18) für das Überleben des Klappzustands: Uhr einfrieren, DANN aufklappen, DANN
// Ticks verstreichen lassen.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    return j({});
  };
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  const now = Date.now();
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 480000, erz: 520000, kristalle: 310000, deuterium: 200000, antimaterie: 9000, forschungspunkte: 22000 },
    // quantenchipfabrik auf Maximalstufe 15 -> die fertige Karte; solar ausbaubar.
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9, quantenchipfabrik: 15 },
    research: { rquantenphysik: 1 }, fleet: { jaeger: 100, ships: 3, missions: [] },
    discovered: { rhea: true, aion: true }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    nextPlanetEventCheck: now + 3600000
  });

  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- 1) Gebäudeliste: jede Karte hat Klapp-Details, Standard ZU; Kosten trotzdem sichtbar ---
  const bau = await page.evaluate(() => {
    const box = document.getElementById('buildings');
    const karten = [...box.querySelectorAll('.card-row')].filter(k => k.querySelector('[data-build]') || k.textContent.includes('Max'));
    const mitDetails = karten.filter(k => k.querySelector('details.karten-info')).length;
    const offen = box.querySelectorAll('details.karten-info[open]').length;
    const solar = box.querySelector('details[data-keep-open="binfo:solar"]');
    const solarKarte = solar ? solar.closest('.card-row') : null;
    const solarProd = solarKarte ? solarKarte.querySelector('.prodline') : null;
    return { karten: karten.length, mitDetails, offen,
             solarDa: !!solar,
             solarProdVersteckt: !!solarProd && !solarProd.checkVisibility(),
             solarKostenSichtbar: !!solarKarte && !!solarKarte.querySelector(".bcost") && solarKarte.querySelector(".bcost").checkVisibility(),
             solarKnopfDa: !!solarKarte && !!solarKarte.querySelector('[data-build="solar"]') };
  });
  check('1: alle Gebäudekarten haben Klapp-Details, Standard zu - Kosten und Knopf bleiben sichtbar',
    bau.karten > 5 && bau.mitDetails === bau.karten && bau.offen === 0 &&
    bau.solarDa && bau.solarProdVersteckt && bau.solarKostenSichtbar && bau.solarKnopfDa, bau);

  // ---- 2) Die fertige Karte ist kompakt: Max-Abzeichen sichtbar, langer Hinweis eingeklappt ---
  const fertig = await page.evaluate(() => {
    const d = document.querySelector('#buildings details[data-keep-open="binfo:quantenchipfabrik"]');
    const karte = d ? d.closest('.card-row') : null;
    if (!karte) return { da: false };
    const hinweis = [...karte.querySelectorAll('.bmeta')].find(x => x.textContent.includes('Maximalstufe erreicht'));
    return { da: true,
             badge: /Max/.test((karte.querySelector('.badge-done') || {}).textContent || ''),
             hinweisVersteckt: !!hinweis && !hinweis.checkVisibility(),
             keineKosten: !karte.querySelector('.bcost'),
             hoehe: Math.round(karte.getBoundingClientRect().height) };
  });
  check('2: die fertige Fabrik zeigt kompakt Max-Abzeichen, der lange Hinweis ist eingeklappt',
    fertig.da && fertig.badge && fertig.hinweisVersteckt && fertig.keineKosten && fertig.hoehe < 120, fertig);

  // ---- 3) Aufklappen überlebt das sekündliche Neuzeichnen (Uhr einfrieren, DANN klappen) ------
  await page.evaluate(() => { const fest = Date.now(); Date.now = () => fest; });
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    document.querySelector('#buildings details[data-keep-open="binfo:solar"] summary').click();
  });
  await page.waitForTimeout(3400);   // mehrere Ticks samt Neuzeichnen der Liste
  const nachTicks = await page.evaluate(() => {
    const d = document.querySelector('#buildings details[data-keep-open="binfo:solar"]');
    const prod = d ? d.closest('.card-row').querySelector('.prodline') : null;
    return { offen: !!d && d.open, prodSichtbar: !!prod && prod.checkVisibility() };
  });
  check('3: eine aufgeklappte Karte bleibt über mehrere Ticks aufgeklappt (data-keep-open)',
    nachTicks.offen && nachTicks.prodSichtbar, nachTicks);

  // ---- 4) Forschung: Beschreibung eingeklappt, Erforschen-Knopf sichtbar ----------------------
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="forschung"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  const forschung = await page.evaluate(() => {
    const box = document.getElementById('research');
    const details = box.querySelectorAll('details.karten-info');
    const offen = box.querySelectorAll('details.karten-info[open]').length;
    const erste = box.querySelector('details.karten-info');
    const karte = erste ? erste.closest('.card-row') : null;
    const desc = karte ? karte.querySelector('details .bmeta') : null;
    return { anzahl: details.length, offen,
             descVersteckt: !!desc && !desc.checkVisibility(),
             knopfDa: !!box.querySelector('[data-research]') };
  });
  check('4: Forschungskarten haben eingeklappte Beschreibungen, der Erforschen-Knopf bleibt',
    forschung.anzahl > 10 && forschung.offen === 0 && forschung.descVersteckt && forschung.knopfDa, forschung);

  // ---- 5) Der Ausbauen-Knopf funktioniert nach den übersprungenen Ticks -----------------------
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="basis"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  const ausbau = await page.evaluate(async () => {
    const vorher = document.querySelector('#buildings details[data-keep-open="binfo:solar"]')
      .closest('.card-row').querySelector('.lvl-pill').textContent;
    const btn = document.querySelector('#buildings [data-build="solar"]');
    if (!btn || btn.disabled) return { keinKnopf: true, vorher };
    btn.click();
    await new Promise(r => setTimeout(r, 1600));
    const nachher = document.querySelector('#buildings details[data-keep-open="binfo:solar"]')
      .closest('.card-row').querySelector('.lvl-pill').textContent;
    return { vorher, nachher };
  });
  check('5: der Ausbauen-Knopf baut weiterhin (Stufen-Pill ändert sich)',
    ausbau.keinKnopf !== true && ausbau.vorher !== ausbau.nachher, ausbau);

  check('6: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
