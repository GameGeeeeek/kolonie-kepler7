// Kuratierte Sektoransicht (Modell B, Etappe KB-2): Ein geöffneter Sektor zeigt seine Systeme auf
// festen Plätzen (Überlappung konstruktiv unmöglich), mit Sonnenfarben, Ringen (Heimat/Basis/
// Gürtel), ‹ ›/⌂-Navigation; ein System-Tipp öffnet die BESTEHENDE Systemebene (galaxyOeffne),
// deren Schließen führt in die Sektoransicht zurück. Die Ebenen-Leiste ist seit KB-4c in der
// SEKTORANSICHT sichtbar (ihre Schalter wirken dort auf Abzeichen und Fraktions-Markierung);
// nur der Routen-Knopf bleibt der Systemebene vorbehalten.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_sektoransicht.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_sektoransicht.js
//   Am alten Stand (KB-1) fällt 1: der Region-Tipp führt in den gezoomten Freiflug,
//   [data-sektor-sys]-Knoten existieren nicht.
//
// Regel statt Momentaufnahme (Hausregel 3): Geprüft wird die EIGENSCHAFT "kein Knotenpaar näher
// als 60px" über alle Paare - nicht die konkreten Platzkoordinaten, die sich jederzeit ändern
// dürfen. Knotenzahl = data-anzahl der Region aus der Übersicht (gemessen, nicht eingetippt).
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
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, ships: 3, missions: [] },
    // rhea kolonisiert -> im Kepler-Sektor muss ein Basis-Ring auftauchen (rhea liegt im
    // Heimatcluster; Heimat-Ring am Kepler-System sowieso).
    discovered: { rhea: true, aion: true },
    colonies: { rhea: { buildings: { solar: 3, mine: 2, habitat: 1 }, fleet: { ships: 2, missions: [] } } }, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    nextPlanetEventCheck: now + 3600000
  });

  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
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
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page.waitForTimeout(1500);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- 1) Region öffnen: kuratierte Knoten in Regionsstärke, Leiste sichtbar (KB-4c) ----------
  const erwartet = await page.evaluate(() => {
    const g = document.querySelector('#galaxyMapSvg [data-sektor="kepler"]');
    return g ? +g.dataset.anzahl : null;
  });
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-sektor="kepler"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(800);
  const ansicht = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const leiste = document.getElementById('karteEbenenLeiste');
    return { knoten: svg.querySelectorAll('[data-sektor-sys]').length,
             titel: !!svg.querySelector('[data-kb-titel="kepler"]'),
             leisteDa: leiste ? getComputedStyle(leiste).display !== 'none' : null,
             routenZu: leiste ? (leiste.querySelector('[data-karte-ebene="routen"]')||{style:{}}).style.display === 'none' : null };
  });
  check('1: der Region-Tipp öffnet die kuratierte Sektoransicht (Knoten = Regionsstärke, Titel da, Ebenen-Leiste sichtbar, Routen-Knopf verborgen)',
    erwartet > 0 && ansicht.knoten === erwartet && ansicht.titel && ansicht.leisteDa === true && ansicht.routenZu === true,
    { erwartet, ...ansicht });
  if (ansicht.knoten === 0) return ende(async () => browser.close());

  // ---- 2) REGEL: kein Knotenpaar näher als 60px -----------------------------------------------
  const abstaende = await page.evaluate(() => {
    const mitten = [...document.querySelectorAll('#galaxyMapSvg [data-sektor-sys]')].map(g => {
      const c = g.querySelector('circle');
      return [+c.getAttribute('cx'), +c.getAttribute('cy')];
    });
    let min = Infinity, paar = null;
    for (let i = 0; i < mitten.length; i++) for (let j = i+1; j < mitten.length; j++){
      const d = Math.hypot(mitten[i][0]-mitten[j][0], mitten[i][1]-mitten[j][1]);
      if (d < min){ min = d; paar = [i, j]; }
    }
    return { min: Math.round(min), paar, n: mitten.length };
  });
  check('2: kein Knotenpaar liegt näher als 60px beieinander (Überlappung konstruktiv unmöglich)',
    abstaende.min >= 60, abstaende);

  // ---- 3) Ringe: Heimat-Ring am Kepler-System (Rhea liegt IM Heimatsystem - dort gewinnt der
  //         Heimat-Ring, ein separater Basis-Knoten existiert nicht), Gürtel-Ring irgendwo da ----
  const ringe = await page.evaluate(() => ({
    heim: !!document.querySelector('#galaxyMapSvg [data-sektor-sys="kepler"] [data-ring="heim"]'),
    heimMeta: (document.querySelector('#galaxyMapSvg [data-sektor-sys="kepler"]')||{textContent:''}).textContent
  }));
  check('3: das Kepler-System trägt den Heimat-Ring und nennt sich Heimat',
    ringe.heim && /Heimat/.test(ringe.heimMeta), ringe);

  // ---- 4) ‹ › wechseln den Sektor, ⌂ führt zur Übersicht --------------------------------------
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-kb-knopf="rechts"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(600);
  const nachbar = await page.evaluate(() => {
    const t = document.querySelector('#galaxyMapSvg [data-kb-titel]');
    return t ? t.getAttribute('data-kb-titel') : null;
  });
  check('4a: › wechselt zum Nachbarsektor', nachbar !== null && nachbar !== 'kepler', { nachbar });
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-kb-knopf="heimweg"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(600);
  const uebersicht = await page.evaluate(() => document.querySelectorAll('#galaxyMapSvg [data-sektor]').length);
  check('4b: ⌂ führt zur Sektoren-Übersicht zurück', uebersicht === 8, { regionen: uebersicht });

  // ---- 5) System-Tipp öffnet die BESTEHENDE Systemebene, Schließen kehrt zurück ---------------
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-sektor="kepler"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.querySelector('#galaxyMapSvg [data-sektor-sys="kepler"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(1200);
  const system = await page.evaluate(() => {
    const tafel = document.getElementById('systemTafel');
    return { knoten: document.querySelectorAll('#galaxyMapSvg [data-sektor-sys]').length,
             tafelText: tafel ? tafel.textContent.slice(0, 120) : '',
             leisteAuf: getComputedStyle(document.getElementById('karteEbenenLeiste')).display !== 'none' };
  });
  check('5a: der System-Tipp öffnet die bestehende Systemebene samt Detailtafel (Kepler-System), Ebenen-Leiste wieder da',
    system.knoten === 0 && /Kepler-System/.test(system.tafelText) && system.leisteAuf === true, system);
  await page.evaluate(() => { const b = document.getElementById('galaxyZoomResetBtn'); if (b) b.click(); });
  await page.waitForTimeout(800);
  const rueckkehr = await page.evaluate(() => document.querySelectorAll('#galaxyMapSvg [data-sektor-sys]').length);
  check('5b: das Schließen des Systems führt in die Sektoransicht zurück', rueckkehr > 0, { knoten: rueckkehr });

  check('6: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
