// Detailtafel der Sektorkarte, erste Ausbaustufe (Etappe B-3, v8.500.0):
// (1) Systemkopf, Basis-Schnellzugriff, Planetenliste und Monde bilden EINE Tafel-Fläche
//     (#systemTafel), (2) der Kopf zeigt die echte Sonnenfarbe des Systems statt des für alle
//     Systeme gleichen gelben Icons, (3) neue Kennzahlenzeile: Entfernung in Sektoren,
//     Erkundungs-Flugzeit, eigene Basen im System.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_systemtafel.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_systemtafel.js
//   Am alten Stand fallen 1 (kein #systemTafel), 2 (keine Sonnen-Scheibe) und 3/4 (keine
//   Kennzahlenzeile).
//
// Die erwartete Sonnenfarbe wird aus der GETESTETEN Datei selbst abgeleitet (hashStringToFloat +
// SUN_TYPES per Regex herausgezogen und ausgeführt) - nicht aus dem Gedächtnis eingetippt
// (Hausregel 2). Beide Anker werden vorab auf Existenz geprüft (Hausregel 6).
const fs = require('fs');
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

// Erwarteten Sonnentyp für ein System aus der getesteten Datei ableiten.
function sonnentypAus(dateiUrl, systemId) {
  const pfad = decodeURIComponent(new URL(dateiUrl).pathname);
  const quelle = fs.readFileSync(pfad, 'utf8');
  const sunM = quelle.match(/const SUN_TYPES = \[[\s\S]*?\n  \];/);
  const hashM = quelle.match(/function hashStringToFloat\(str\)\{[\s\S]*?\n  \}/);
  if (!sunM || !hashM) return null;   // Anker-Existenz zuerst (Hausregel 6)
  return new Function(hashM[0] + '\n' + sunM[0] +
    '\nreturn SUN_TYPES[Math.min(SUN_TYPES.length-1, Math.floor(hashStringToFloat(' + JSON.stringify(systemId + ':suntype') + ')*SUN_TYPES.length))];')();
}
function hexZuRgb(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? 'rgb(' + parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16) + ')' : hex;
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  const now = Date.now();
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, ships: 3, colonyShips: 1, missions: [] },
    discovered: { rhea: true, aion: true },
    // Heimatbasis (home) + Kolonie rhea = 2 eigene Basen im Heimatsystem - genau das muss die
    // Kennzahlenzeile nennen.
    colonies: { rhea: { buildings: { solar: 3, mine: 2, habitat: 1 }, fleet: { ships: 2, missions: [] } } },
    activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, prestige: 4, buffs: [], lastTick: now,
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
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  // System aufklappen, damit die system-nav-Zeile sichtbar ist (sie hängt an galaxyOpenSystem).
  await page.evaluate(() => {
    const n = document.querySelector('#galaxyMapSvg [data-system-node="kepler"]');
    if (n) n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(2000);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- 1) Die Tafel existiert und enthält alle vier Bestandteile ------------------------------
  const tafel = await page.evaluate(() => {
    const t = document.getElementById('systemTafel');
    return { da: !!t,
             nav: !!(t && t.querySelector('.system-nav')),
             links: !!(t && t.querySelector('#mapBaseLinks')),
             liste: !!(t && t.querySelector('#planetList')),
             monde: !!(t && t.querySelector('#moonListWrap')) };
  });
  check('1: Systemkopf, Schnellzugriff, Planetenliste und Monde stehen in EINER Tafel',
    tafel.da && tafel.nav && tafel.links && tafel.liste && tafel.monde, tafel);
  if (!tafel.da) return ende(async () => browser.close());

  // ---- 2) Die Sonnen-Scheibe trägt die echte Farbe des Systems --------------------------------
  const erwartet = sonnentypAus(DATEI, 'kepler');
  const scheibe = await page.evaluate(() => {
    const el = document.getElementById('systemSunDisc');
    return el ? { da: true, bg: el.style.background, schatten: el.style.boxShadow } : { da: false };
  });
  const farbeOk = !!erwartet && scheibe.da &&
    (scheibe.bg.includes(erwartet.core) || scheibe.bg.includes(hexZuRgb(erwartet.core))) &&
    (scheibe.bg.includes(erwartet.glow) || scheibe.bg.includes(hexZuRgb(erwartet.glow)));
  check('2: die Sonnen-Scheibe zeigt Kern- UND Glühfarbe des echten Sonnentyps (' + (erwartet ? erwartet.label : '?') + ')',
    farbeOk, { erwartet, scheibe });

  // ---- 3) Kennzahlenzeile im Heimatsystem -----------------------------------------------------
  const kennHeim = await page.evaluate(() => {
    const el = document.getElementById('systemNavKenn');
    return el ? el.textContent : null;
  });
  check('3: die Kennzahlenzeile nennt Heimatsystem, Erkundungs-Flugzeit und die 2 eigenen Basen',
    !!kennHeim && /Heimatsystem/.test(kennHeim) && /Erkundung ab/.test(kennHeim) && /2 eigene Basen/.test(kennHeim),
    { kennHeim });

  // ---- 4) Im Nachbarsystem steht eine echte Entfernung ----------------------------------------
  const kennFremd = await page.evaluate(async () => {
    const btn = document.getElementById('systemNextBtn');
    if (!btn) return null;
    btn.click();
    await new Promise(r => setTimeout(r, 1600));
    const el = document.getElementById('systemNavKenn');
    const name = document.getElementById('systemNavName');
    return { kenn: el ? el.textContent : null, name: name ? name.textContent : null };
  });
  check('4: im Nachbarsystem zeigt die Zeile die Entfernung in Sektoren (kein "Heimatsystem" mehr)',
    !!kennFremd && !!kennFremd.kenn && /Sektoren entfernt/.test(kennFremd.kenn) && !/Heimatsystem/.test(kennFremd.kenn),
    kennFremd);

  check('5: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
