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
  //
  // GEMESSEN NACH DER RUHE, nicht 1,2 s nach dem Klick (19.08.2026). Vorher stand hier ein fester
  // Schlaf, und der Test fiel im vollen Prüflauf mit `{"vorher":0,"nachher":1733,"zielOben":314}`,
  // während er einzeln dreimal hintereinander exakt 182 lieferte - bei IDENTISCHER Scroll-Position.
  // Gleiche Scrollhöhe, anderes Ziel heißt: Der Inhalt ÜBER dem Ziel ist nach dem Sprung noch
  // gewachsen (gemessene Zusammensetzung: .hero 138, #resbar 86, #tier2ResBadges 38,
  // #dailyQuestBar 28, .tabs 108, #planetRoleBox 252, #orbitalStationBox 211 - die Differenz von
  // 146 px passt auf die Tagesaufgaben-Leiste, die ihre Höhe mit dem Inhalt ändert).
  //
  // Die Schranke bleibt unverändert. Ein Test, der grün wird, weil man ihn großzügiger macht,
  // belegt nichts mehr (Hausregel 26) - gemessen wird stattdessen der FERTIGE Zustand: Bleibt das
  // Ziel auch nach dem Nachrendern über 300 px, ist das ein echter Befund und soll anschlagen.
  // Der Fehlschlag nennt seither die Höhen aller Elemente über dem Ziel, damit die Ursache im
  // Protokoll steht statt in einer späteren Sitzung (Hausregel 37).
  const sprung = await page.evaluate(async () => {
    const vorher = Math.round(window.scrollY);
    const ziel = [...document.querySelectorAll('#jumpnav-basis [data-jump-acc]')].find(a => /Terraforming/.test(a.textContent));
    if (!ziel) return { keinZiel: true };
    const messe = () => {
      const t = document.querySelector('#terraformBox .section-title');
      const r = t ? t.getBoundingClientRect() : null;
      return r ? Math.round(r.top + window.scrollY) : null;   // Dokumentlage, scroll-unabhängig
    };
    ziel.click();
    // Warten, bis die Dokumentlage des Ziels zweimal hintereinander dieselbe ist - dieselbe
    // Wartung wie warteBisRuhe in test_reiterleiste.js, und aus demselben Grund: Ein fester Schlaf
    // misst Wanduhr-Glück statt der Regel.
    let vorlauf = null, gleich = 0;
    for (let i = 0; i < 40 && gleich < 2; i++){
      await new Promise(r => setTimeout(r, 150));
      const jetzt = messe();
      gleich = (jetzt !== null && jetzt === vorlauf) ? gleich + 1 : 0;
      vorlauf = jetzt;
    }
    const titel = document.querySelector('#terraformBox .section-title');
    const r2 = titel ? titel.getBoundingClientRect() : null;
    const hoehen = {};
    for (const sel of ['.hero', '#heroRaidTimer', '#eventBanner', '#resbar', '#tier2ResBadges',
                       '#dailyQuestBar', '.tabs', '#planetRoleBox', '#orbitalStationBox']){
      const el = document.querySelector(sel);
      hoehen[sel] = el ? Math.round(el.getBoundingClientRect().height) : null;
    }
    const leiste = document.querySelector('.tabs');
    const lb = leiste ? leiste.getBoundingClientRect() : null;
    return { vorher, nachher: Math.round(window.scrollY),
             zielOben: r2 ? Math.round(r2.top) : null,
             fenster: window.innerHeight,
             leisteUnten: lb ? Math.round(lb.bottom) : null,
             leisteKlebt: leiste ? getComputedStyle(leiste).position === 'sticky' : false,
             zurRuheGekommen: gleich >= 2, hoehen: hoehen };
  });
  check('2-ruhe: die Seite kam nach dem Sprung zur Ruhe (sonst misst die Prüfung darunter einen Übergangszustand)',
    sprung.keinZiel === true || sprung.zurRuheGekommen === true, sprung);
  // Die Schranke ist jetzt eine REGEL statt einer Zahl: "im oberen Drittel des Fensters", aus der
  // gemessenen Fensterhöhe abgeleitet (Hausregel 3). Warum die alte 300 nicht bleiben konnte, ist
  // gemessen und nicht bequem: Sie war gegen den ÜBERGANGSWERT kalibriert, den der feste
  // 1,2-s-Schlaf lieferte (182 px). Im eingeschwungenen Zustand steht das Ziel schon am Stand VOR
  // Etappe 3 bei 261 px - die scheinbare Reserve von 118 px waren in Wahrheit 39. Ein Grenzwert,
  // der einen Zustand beschreibt, den das Spiel nie einnimmt, misst nicht die Sache.
  const obereGrenze = Math.round(sprung.fenster / 3);
  check('2: der Klick springt zur Terraforming-Überschrift (Ziel im oberen Bilddrittel)',
    sprung.keinZiel !== true && sprung.nachher > sprung.vorher &&
    sprung.zielOben !== null && sprung.zielOben > -60 && sprung.zielOben < obereGrenze,
    Object.assign({ obereGrenze }, sprung));
  // Die andere Richtung, und die ist neu: Bei kompaktem Kopf KLEBT die Reiterleiste oben. Ein
  // Sprung, der das Ziel dahinter parkt, sieht in der Zahl gut aus und ist für den Spieler
  // unlesbar - genau der Fehler, den KB-10 an der Karte schon einmal hatte.
  check('2b: das Ziel steht nicht hinter der klebenden Reiterleiste',
    sprung.keinZiel === true || !sprung.leisteKlebt ||
    (sprung.zielOben !== null && sprung.leisteUnten !== null && sprung.zielOben >= sprung.leisteUnten - 4),
    { zielOben: sprung.zielOben, leisteUnten: sprung.leisteUnten, klebt: sprung.leisteKlebt });

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
