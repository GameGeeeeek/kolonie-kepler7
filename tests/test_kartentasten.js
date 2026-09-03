// Tastatur-Bedienung der Karte (Etappe KB-14, Auftrag Sascha: "bei der karte kann man da einfügen
// bedienung über pfeiltasten wenn man am pc ist?").
//
// DIE REGEL, UM DIE ES GEHT - und warum die Gegenrichtung hier die halbe Miete ist
// --------------------------------------------------------------------------------
// Eine Tastenbelegung nimmt immer jemandem etwas weg. ← / → blättern durch die Systeme; ↑ / ↓
// bleiben ABSICHTLICH frei, weil sie die Seite scrollen - und unter der Karte steht die
// Detailtafel, die man genau dann liest, wenn ein System offen ist. Dieser Test prüft deshalb
// BEIDES: dass die belegten Tasten wirken UND dass die freien Tasten frei geblieben sind. Ohne die
// zweite Hälfte könnte man Prüfung 1 erfüllen, indem man einfach alle vier Pfeiltasten kapert.
//
// Dieselbe Abwägung steckt schon in test_kartenbedienung 5a/5b: Das Mausrad zoomt nur MIT Strg,
// damit die Seite ohne Strg scrollbar bleibt.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_kartentasten.js
//   rot:   am Stand vor KB-14 - Prüfung 1 und 2 melden, dass sich das System nicht ändert:
//          KEPLER_SPIELDATEI=/tmp/vor_kb14.html node tests/test_kartentasten.js
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren, oeffneSektorMitSystem } = require('./lib/karte');
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

const offenesSystem = page => page.evaluate(() => (document.getElementById('systemNavName') || {}).textContent || '');
const viewBoxVon = page => page.evaluate(() => {
  const svg = document.getElementById('galaxyMapSvg');
  return svg ? svg.getAttribute('viewBox') : null;
});

(async () => {
  const browser = await starteBrowser();
  const store = {};
  const now = Date.now();
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, missions: [] }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    nextPlanetEventCheck: now + 3600000   // Ereignis-Uhr pinnen (Hausregel 18)
  });

  // PC-Viewport: Die Tastatur-Bedienung ist für den PC gedacht (der Handler hängt bewusst an keiner
  // Breite, aber gemessen wird dort, wo sie benutzt wird).
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
  await page.waitForTimeout(1200);
  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- 0) In der SEKTORANSICHT öffnet keine Taste ein SYSTEM -----------------------------------
  // Hier stand bis zum 03.09.2026 "dort dürfen die Tasten noch nichts tun", begründet mit "es gibt
  // kein nächstes System". Seit v8.647.0 wechselt → dort den NACHBARSEKTOR (dieselbe Bewegung wie
  // die ‹ ›-Knöpfe daneben, gemessen in tests/test_kartenrichtungen.js Abschnitt 3). Was hier
  // geprüft wird, gilt unverändert weiter und ist der eigentliche Kern des Abschnitts: Auf dieser
  // Ebene darf keine Taste ein System AUFKLAPPEN - ein Sprung, den niemand angefordert hat.
  await oeffneSektorMitSystem(page, 'kepler');
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);
  const scrollVorSektor = await page.evaluate(() => Math.round(window.scrollY));
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  const sektorNachher = await page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    offenesSystem: !!document.querySelector('#galaxyMapSvg [data-planet]')
  }));
  check('0: in der Sektoransicht öffnet → kein System', sektorNachher.offenesSystem === false, sektorNachher);

  // ---- 1) Blättern per ← / → -------------------------------------------------------------------
  await oeffneSystemUeberSektoren(page, 'kepler');
  await page.waitForTimeout(900);
  const start = await offenesSystem(page);
  check('1-vorab: ein System ist offen und benannt', start.length > 0, { start });

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1500);
  const nachRechts = await offenesSystem(page);
  check('1: → öffnet das nächste System', nachRechts.length > 0 && nachRechts !== start,
    { start, nachRechts });

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(1500);
  const nachLinks = await offenesSystem(page);
  // Die REGEL ist "← geht die Reihenfolge zurück", nicht "← landet auf einer bestimmten ID" - aber
  // ein Schritt vor und einer zurück muss wieder am Ausgangspunkt herauskommen (Hausregel 3).
  // Bewusst BEIDE Bedingungen: Ohne "nachRechts !== start" wäre diese Prüfung an einem Stand ohne
  // Tastatur-Bedienung trivial grün - dort bewegt sich nichts, also stimmt "wieder am Anfang"
  // zufällig (genau das meldete die Gegenprobe beim ersten Anlauf, Regel 28).
  check('2: ← führt wieder zum Ausgangssystem zurück', nachRechts !== start && nachLinks === start,
    { start, nachRechts, nachLinks });

  // ---- 3) Zoom per + / − -----------------------------------------------------------------------
  const vbVorZoom = await viewBoxVon(page);
  await page.keyboard.press('+');
  await page.waitForTimeout(700);
  const vbNachPlus = await viewBoxVon(page);
  check('3a: + verändert den Ausschnitt (zoomt)', vbNachPlus !== vbVorZoom, { vbVorZoom, vbNachPlus });

  // Und die Gegenrichtung: − muss den Ausschnitt wieder aufziehen. Gemessen an der BREITE des
  // Ausschnitts, nicht an der Zeichenkette - die Position darf sich unterscheiden.
  const breiteVon = vb => vb ? +vb.split(/\s+/)[2] : NaN;
  await page.keyboard.press('-');
  await page.waitForTimeout(700);
  const vbNachMinus = await viewBoxVon(page);
  check('3b: − zieht den Ausschnitt wieder auf',
    breiteVon(vbNachMinus) > breiteVon(vbNachPlus), { vbNachPlus, vbNachMinus });

  // ---- 4) DIE GEGENRICHTUNG: ↑ / ↓ scrollen weiterhin die Seite --------------------------------
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(300);
  const scrollVor = await page.evaluate(() => Math.round(window.scrollY));
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(500);
  const scrollNach = await page.evaluate(() => Math.round(window.scrollY));
  check('4: ↓ scrollt die Seite weiterhin (bewusst NICHT belegt)',
    scrollNach > scrollVor, { scrollVor, scrollNach });

  // ---- 5) Tippen im Suchfeld darf nicht gekapert werden ----------------------------------------
  const sucheDa = await page.evaluate(() => {
    const i = document.querySelector('#tab-karte input[type="text"], #tab-karte input:not([type])');
    if (!i) return null;
    i.focus(); i.value = 'kep';
    return i.id || i.className || 'input';
  });
  if (sucheDa) {
    const vorTippen = await offenesSystem(page);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(800);
    const nachTippen = await offenesSystem(page);
    check('5: mit Fokus im Suchfeld blättert → NICHT', nachTippen === vorTippen,
      { feld: sucheDa, vorTippen, nachTippen });
  } else {
    // Regel 37: Eine Prüfung, deren Bedingung nicht eintrat, ist grün ohne Aussage - deshalb steht
    // hier der GRUND im Protokoll statt einer stillen Lücke.
    check('5: mit Fokus im Suchfeld blättert → NICHT', false,
      { grund: 'kein Texteingabefeld im Karte-Tab gefunden - Selektor prüfen' });
  }

  check('6: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
