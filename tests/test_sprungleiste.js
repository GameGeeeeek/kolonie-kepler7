// Sprungleiste in Basis und Forschung (Etappe S-3, v8.515.0): Die Einstellung uiJumpNav (bisher
// nur Punktestand/Fortschritt/Einstellungen mit handgepflegten Listen) wirkt jetzt auch in Basis
// und Forschung - die Leiste baut sich SELBST aus den Abschnitts-Überschriften, die der
// generische Akkordeon-Durchlauf einsammelt (keine zweite Liste, die veralten kann).
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_sprungleiste.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_sprungleiste.js
//   Am alten Stand fällt 1 (kein #jumpnav-basis) und damit alles Weitere.
//
// Regel statt Momentaufnahme (Hausregel 3): Geprüft wird, dass BEKANNTE Abschnitte (Planeten-
// Rolle, Terraforming) als Einträge VORKOMMEN und der Klick zum markierten Ziel springt - nicht
// die exakte Anzahl oder Reihenfolge der Einträge.
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
    // Sprungleiste AN, Akkordeon AN (der Klick muss einen eingeklappten Abschnitt aufklappen).
    uiJumpNav: true, uiCollapsibleSections: true, collapsedSections: {},
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, ships: 3, missions: [] },
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

  // ---- 1) Basis: Leiste sichtbar, bekannte Abschnitte als Einträge ----------------------------
  const basis = await page.evaluate(() => {
    const l = document.getElementById('jumpnav-basis');
    if (!l) return { da: false };
    const texte = [...l.querySelectorAll('[data-jump-acc]')].map(a => a.textContent);
    return { da: true, sichtbar: l.style.display !== 'none', anzahl: texte.length,
             rolle: texte.some(t => /Planeten-Rolle/.test(t)),
             terra: texte.some(t => /Terraforming/.test(t)) };
  });
  check('1: die Basis-Sprungleiste ist sichtbar und nennt Planeten-Rolle und Terraforming',
    basis.da && basis.sichtbar && basis.anzahl >= 3 && basis.rolle && basis.terra, basis);
  if (!basis.da) return ende(async () => browser.close());

  // ---- 2) Klick springt zum Ziel (gemessen an der Scroll-Position der Seite) ------------------
  const sprung = await page.evaluate(async () => {
    const vorher = Math.round(window.scrollY);
    const ziel = [...document.querySelectorAll('#jumpnav-basis [data-jump-acc]')].find(a => /Terraforming/.test(a.textContent));
    if (!ziel) return { keinZiel: true };
    ziel.click();
    await new Promise(r => setTimeout(r, 1200));
    const titel = document.querySelector('#terraformBox .section-title');
    const r2 = titel ? titel.getBoundingClientRect() : null;
    return { vorher, nachher: Math.round(window.scrollY),
             zielOben: r2 ? Math.round(r2.top) : null };
  });
  check('2: der Klick springt zur Terraforming-Überschrift (Ziel im oberen Bildbereich)',
    sprung.keinZiel !== true && sprung.nachher > sprung.vorher &&
    sprung.zielOben !== null && sprung.zielOben > -60 && sprung.zielOben < 300, sprung);

  // ---- 3) Klick auf einen EINGEKLAPPTEN Abschnitt klappt ihn auf ------------------------------
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('#terraformBox .section-title').click(); });
  await page.waitForTimeout(600);
  const aufgeklappt = await page.evaluate(async () => {
    const vorherZu = document.querySelector('#terraformBox .section-title').classList.contains('sec-collapsed');
    const ziel = [...document.querySelectorAll('#jumpnav-basis [data-jump-acc]')].find(a => /Terraforming/.test(a.textContent));
    ziel.click();
    await new Promise(r => setTimeout(r, 1200));
    const titel = document.querySelector('#terraformBox .section-title');
    const inhalt = titel.nextElementSibling;
    return { vorherZu, nachherOffen: !titel.classList.contains('sec-collapsed'),
             inhaltSichtbar: !!inhalt && inhalt.style.display !== 'none' };
  });
  check('3: der Sprung klappt einen eingeklappten Abschnitt vorher auf',
    aufgeklappt.vorherZu && aufgeklappt.nachherOffen && aufgeklappt.inhaltSichtbar, aufgeklappt);

  // ---- 4) Forschung hat ebenfalls eine Leiste -------------------------------------------------
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="forschung"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  const forschung = await page.evaluate(() => {
    const l = document.getElementById('jumpnav-forschung');
    return l ? { da: true, sichtbar: l.style.display !== 'none',
                 anzahl: l.querySelectorAll('[data-jump-acc]').length } : { da: false };
  });
  check('4: auch der Forschung-Tab hat eine gefüllte Sprungleiste',
    forschung.da && forschung.sichtbar && forschung.anzahl >= 3, forschung);

  check('5: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
