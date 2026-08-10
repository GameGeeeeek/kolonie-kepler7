// Zeigt die Box „An die Front liefern" die richtigen offenen Mengen – und verschickt sie beim Klick
// wirklich die Handlung, die daneben steht?
//
// Der Schwestertest test_randkriege_handlungen.js liest Quelltext und vergleicht Frontend gegen
// Backend. Er kann nicht zeigen, dass am Ende etwas Bedienbares dasteht: Die offene Menge ist eine
// DIFFERENZ aus dem eigenen Spielstand und dem Basiswert, den der Server mitschickt – rechnet die
// Anzeige falsch, sieht man das nur am erzeugten DOM.
//
// GEMESSENE GEGENPROBE (10.08.2026): Gegen `git show HEAD:weltraum_kolonie.html` fällt der Test
// schon an „die Box ist da". Die Kontrollprüfungen („Galaxie-Tab offen", „keine Konsolenfehler")
// bleiben in beiden Läufen grün – der Test misst also den Unterschied.

const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

// Der Spielstand ist so gewählt, dass jede der vier Handlungen eine ANDERE offene Menge ergibt.
// Gleiche Zahlen würden eine vertauschte Zuordnung nicht auffallen lassen.
const SAVE = {
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9e5, erz: 9e5, kristalle: 6e5, deuterium: 4e5, antimaterie: 2e4, forschungspunkte: 3e4 },
  buildings: { solar: 22, mine: 20, labor: 14, lager: 16, werft: 14 }, research: {},
  fleet: { jaeger: 600, spaeher: 20, missions: [] }, colonies: {}, activeBasePlanet: 'home',
  player: { id: 'u', name: 'A', avatarKey: null }, prestige: 2, xp: 260000, credits: 180000,
  buffs: [], lastTick: Date.now(), colonyNames: {},
  expeditionsCompleted: 12,          // Basis 5  -> 7 offen
  fundmeldungenGesamt: 4,            // Basis 1  -> 3 offen
  piratennesterGeraeumt: 2,          // Basis 2  -> 0 offen (der gesperrte Fall)
  tradeRouteLifetimeCredits: 9000    // Basis 1000, Einheit 2000 -> 4 offen
};
const BASIS = { expeditionsCompleted: 5, fundmeldungenGesamt: 1, piratennesterGeraeumt: 2, tradeRouteLifetimeCredits: 1000 };
const ERWARTET = { aufklaerung: 7, fundmeldung: 3, piratennest: 0, konvoi: 4 };

const GALAXIE = {
  factions: {
    kartell:  { id: 'kartell',  name: 'Aschen-Kartell', color: '#fac775', systems: ['orion'], strength: 2 },
    schatten: { id: 'schatten', name: 'Schattenbund',   color: '#6fd0c0', systems: ['rand'],  strength: 2 }
  },
  randkriege: {
    fronten: [{ a: 'kartell', b: 'schatten', systeme: [{ sys: 'orion', kp: 610, beitragendeA: 1, beitragendeB: 0, dabei: false }] }],
    meinTag: {}, meineBasis: BASIS, tagesBreite: 300, nachschubZuletzt: 0,
    // Dienstgrade und Frontmarken (v8.479.0). Kartell steht auf Grenzwächter (Stufe 3), Schatten
    // knapp darunter auf Feldwacht (Stufe 2) - so lassen sich beide Zeilen unterscheiden, und der
    // Laden öffnet nach dem HÖCHSTEN Grad, hier also Stufe 3.
    meinKonto: { marken: 4, dienst: { kartell: 2000, schatten: 900 }, wocheMarken: 4, wocheDeckel: 12, markeJePunkte: 200 }
  },
  collapsedSystems: {}, controlledSystems: {}, news: [], activeWar: null, activeWormhole: null,
  npcEmpireStrength: 1, marketTrend: 1, lastTick: Date.now()
};

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const gesendet = [];
const gekauft = [];
function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
    if (p === 'randkriege/lager') {
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
      gekauft.push(body);
      return j({ ok: true, posten: body.posten, kosten: 2, bestand: 2 });
    }
    if (p === 'randkriege/handlung') {
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
      gesendet.push(body);
      return j({ ok: true, art: body.art, punkte: 40, roh: 40, sys: 'orion', einheiten: 1, offenDanach: 0, name: 'Test' });
    }
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    if (p === 'galaxy') return j(GALAXIE);
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
    return j({});
  };
}

(async () => {
  const browser = await starteBrowser();
  const saveStr = JSON.stringify(SAVE);
  const store = { 'kepler7-save-v3': saveStr };
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fehler.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(s => {
    localStorage.setItem('kepler7-save-v3', s);
    localStorage.setItem('kepler7_token', 'tok');
  }, saveStr);
  await page.goto(SPIEL_URL);
  await page.waitForSelector('[data-tab="karte"]', { timeout: 20000 });
  await page.waitForTimeout(2600);
  await page.evaluate(() => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  await page.click('[data-tab="galaxie"]');
  await page.click('[data-galaxy-subtab="diplo"]');
  await page.waitForTimeout(2500);

  // ---- Kontrollprüfungen: greifen auch am alten Stand ---------------------------------------------
  const galaxieOffen = await page.evaluate(() => {
    const p = document.querySelector('.galaxy-subpanel[data-galaxy-sub="diplo"]');
    return !!p && p.style.display !== 'none';
  });
  check('Galaxie-Tab offen, Diplomatie-Panel sichtbar', galaxieOffen);

  // ---- Die Box -------------------------------------------------------------------------------------
  const box = await page.$('#frontLieferBox');
  check('die Box ist da', !!box);
  if (!box) { console.log('\nFEHLGESCHLAGEN'); await browser.close(); process.exit(1); }
  const html = await page.evaluate(() => document.getElementById('frontLieferBox').innerHTML);
  check('die Box ist gefüllt', html.length > 400, html.length);

  // Die offenen Mengen. Gelesen wird der Text der Pille NEBEN dem jeweiligen Knopf - so hängt die
  // Prüfung an der Zuordnung Handlung→Zahl und nicht bloß daran, dass die Zahlen irgendwo vorkommen.
  const gelesen = await page.evaluate(() => {
    const raus = {};
    document.querySelectorAll('#frontLieferBox [data-front-liefern]').forEach(btn => {
      const art = btn.getAttribute('data-front-liefern');
      const pille = btn.parentElement.querySelector('.lvl-pill');
      raus[art] = { pille: pille ? pille.textContent.trim() : null, knopf: btn.textContent.trim(), gesperrt: btn.disabled };
    });
    return raus;
  });
  for (const [art, soll] of Object.entries(ERWARTET)) {
    const g = gelesen[art];
    check('Zeile ' + art + ' vorhanden', !!g, g);
    if (!g) continue;
    check(art + ': offene Menge ' + soll + ' wird angezeigt',
      soll > 0 ? g.pille === soll + ' offen' : g.pille === 'nichts offen', g.pille);
    check(art + ': der Knopf ist ' + (soll > 0 ? 'bedienbar' : 'gesperrt'), g.gesperrt === (soll === 0), g);
  }
  check('die Nachschub-Zeile ist da und bedienbar',
    !!gelesen.nachschub && gelesen.nachschub.gesperrt === false, gelesen.nachschub);

  // Die Seitenauswahl kennt genau die Fraktionen der aufgebauten Front.
  const seiten = await page.evaluate(() =>
    [...document.querySelectorAll('#frontLieferBox [data-front-seite] option')].map(o => o.value));
  check('die Seitenauswahl zeigt beide Frontfraktionen',
    JSON.stringify(seiten.sort()) === JSON.stringify(['kartell', 'schatten']), seiten);

  // ---- Der Klick verschickt wirklich die Handlung daneben ------------------------------------------
  await page.selectOption('#frontLieferBox [data-front-seite]', 'schatten');
  await page.waitForTimeout(400);
  await page.click('#frontLieferBox [data-front-liefern="fundmeldung"]');
  await page.waitForTimeout(1200);
  check('genau eine Anfrage verschickt', gesendet.length === 1, gesendet);
  check('mit der Handlung des geklickten Knopfes', gesendet[0] && gesendet[0].art === 'fundmeldung', gesendet[0]);
  check('und der GEWÄHLTEN Seite, nicht der Vorgabe', gesendet[0] && gesendet[0].fraktion === 'schatten', gesendet[0]);

  // Ein gesperrter Knopf verschickt nichts.
  await page.evaluate(() => {
    const b = document.querySelector('#frontLieferBox [data-front-liefern="piratennest"]');
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  check('ein gesperrter Knopf verschickt nichts', gesendet.length === 1, gesendet.map(g => g.art));

  // ---- Dienstgrade und Frontlager (v8.479.0) -----------------------------------------------------
  const lager = await page.evaluate(() => {
    const box = document.getElementById('frontLieferBox');
    const raus = {};
    box.querySelectorAll('[data-front-lager]').forEach(btn => {
      const zeile = btn.closest('.card-row');
      const pille = btn.parentElement.querySelector('.lvl-pill');
      raus[btn.getAttribute('data-front-lager')] = {
        gesperrt: btn.disabled, grund: pille ? pille.textContent.trim() : null,
        preis: btn.textContent.trim().split(' ')[0],
        name: zeile ? (zeile.querySelector('.bname') || {}).textContent : null
      };
    });
    return { posten: raus, text: box.textContent };
  });
  check('das Frontlager wird gezeigt', Object.keys(lager.posten).length >= 5, Object.keys(lager.posten));
  check('der Markenbestand steht da', /Bestand:\s*4\s*Marken/.test(lager.text.replace(/\s+/g,' ')), lager.text.slice(0,0));
  check('der Wochenstand steht da', lager.text.replace(/\s+/g,' ').includes('diese Woche verdient: 4 von 12'));
  // Die Dienstgrade: Kartell = Grenzwächter (2000 >= 1750), Schatten = Feldwacht (900 >= 750).
  check('der Dienstgrad je Fraktion wird genannt',
    lager.text.includes('Grenzwächter') && lager.text.includes('Feldwacht'), null);
  check('und wie weit es bis zur nächsten Stufe ist', /noch\s*[\d.]+\s*bis/.test(lager.text));
  // Bei 4 Marken und Grad 3: depot (2/Grad1) und peilung (3/Grad3) bezahlbar, lazarett (4/Grad3)
  // auch; bergung (Grad 4) und anleihe (Grad 5) und abzeichen (Grad 6) gesperrt.
  check('bezahlbare Posten im erreichten Grad sind bedienbar',
    lager.posten.depot && !lager.posten.depot.gesperrt && lager.posten.lazarett && !lager.posten.lazarett.gesperrt,
    { depot: lager.posten.depot, lazarett: lager.posten.lazarett });
  check('ein Posten über dem Dienstgrad ist gesperrt',
    lager.posten.bergung && lager.posten.bergung.gesperrt, lager.posten.bergung);
  check('und nennt den nötigen Dienstgrad als Grund',
    lager.posten.bergung && /^ab /.test(lager.posten.bergung.grund || ''), lager.posten.bergung);

  await page.click('#frontLieferBox [data-front-lager="depot"]');
  await page.waitForTimeout(1200);
  check('der Kauf verschickt genau einen Posten', gekauft.length === 1, gekauft);
  check('und zwar den geklickten', gekauft[0] && gekauft[0].posten === 'depot', gekauft[0]);
  await page.evaluate(() => {
    const b = document.querySelector('#frontLieferBox [data-front-lager="bergung"]');
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  check('ein gesperrter Posten verschickt nichts', gekauft.length === 1, gekauft.map(g => g.posten));

  check('keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles in Ordnung');
  process.exit(fail ? 1 : 0);
})();
