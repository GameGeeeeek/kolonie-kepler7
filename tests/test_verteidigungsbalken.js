// Kennwert-Balken auf den Verteidigungskarten (Etappe VT-1, Auftrag Sascha: "bei vertieidgung auch
// wie bei flotte hinzu die balken angriff vertiedigung schild etc").
//
// DER FEHLER, DEN DIESER TEST FÄNGT - und der beim Bauen wirklich passiert ist
// ----------------------------------------------------------------------------
// Der erste Anlauf hängte die Balken an `prodLine` an. Die steht aber in
// <details class="karten-info"> - auf einer GEBAUTEN Anlage waren sie damit zugeklappt und für den
// Spieler unsichtbar; nur die gesperrten Karten (die keinen Griff haben) zeigten sie. Im DOM waren
// sie vorhanden, ein Test auf "existiert" wäre also grün gewesen. Aufgefallen ist es allein am
// gerenderten Bild (CLAUDE.md, Regel 42).
// Deshalb prüft Abschnitt 2 nicht die Existenz, sondern die SICHTBARKEIT: kein Balken darf in einem
// zugeklappten <details> liegen. Die Schiffskarten machen es vor - dort liegen die Balken im
// Kartenkörper, und der Patchnote zum Kompakt-Umbau hält ausdrücklich fest, dass Statusbalken
// immer sichtbar bleiben.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_verteidigungsbalken.js
//   rot:   am Stand vor VT-1 - Abschnitt 1 meldet 0 Karten mit Balken:
//          KEPLER_SPIELDATEI=/tmp/vor_vt1.html node tests/test_verteidigungsbalken.js
//   rot:   an einer Kopie, in der die Balken wieder in <details> liegen - Abschnitt 2 meldet die
//          zugeklappten Karten namentlich.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;
const S = fs.readFileSync(SPIELDATEI, 'utf8');

// Erwartungswerte aus BUILDING_DEFS LESEN, nicht eintippen (Hausregel 4/2). Gesucht werden alle
// Zeilen mit category:'defense' - die Defs stehen über mehrere Blöcke verteilt, deshalb bewusst
// zeilenweise statt über einen Slice.
const DEF_ANLAGEN = S.split('\n').filter(z => /category:'defense'/.test(z)).map(z => {
  const key = (z.match(/key:'([a-z0-9_]+)'/i) || [])[1];
  const name = (z.match(/name:'([^']+)'/) || [])[1];
  const defVal = +((z.match(/defVal:\s*(-?\d+)/) || [])[1] || 0);
  const atkVal = +((z.match(/atkVal:\s*(-?\d+)/) || [])[1] || 0);
  return key ? { key, name, defVal, atkVal, shield: Math.round(defVal * 0.4) } : null;
}).filter(Boolean);

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
  // Ein paar Anlagen GEBAUT und die Forschungen frei: Nur so entstehen beide Kartenarten
  // (freigeschaltet mit Details-Griff und gesperrt ohne) - der Fehler oben trat ausschließlich auf
  // der freigeschalteten auf.
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 480000, erz: 520000, kristalle: 310000, deuterium: 200000, antimaterie: 9000, forschungspunkte: 22000 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9, turm: 6, flak: 4, laser: 3, schild: 2 },
    research: { rpanzer: 5, rschildmatrix: 3 },
    fleet: { jaeger: 100, missions: [] }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    nextPlanetEventCheck: now + 3600000   // Ereignis-Uhr pinnen (Hausregel 18)
  });

  const ctx = await browser.newContext({ viewport: { width: 430, height: 1000 } });
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
    const b = document.querySelector('.tab-btn[data-tab="verteidigung"]'); if (b) b.click();
  });
  await page.waitForTimeout(1500);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  check('0-vorab: die Anlagen ließen sich aus BUILDING_DEFS lesen',
    DEF_ANLAGEN.length >= 15, { gefunden: DEF_ANLAGEN.length });

  const karten = await page.evaluate(() => {
    const box = document.getElementById('defenseBuildings');
    if (!box) return null;
    return [...box.querySelectorAll('.card-row')].map(k => {
      const name = (k.querySelector('.bname') || {}).textContent || '';
      const bars = [...k.querySelectorAll('.sstat')].map(s => ({
        k: (s.querySelector('.k') || {}).textContent || '',
        v: +((s.querySelector('.v') || {}).textContent || 0),
        // Liegt der Balken in einem ZUGEKLAPPTEN Aufklapp-Griff? Genau das war der Fehler.
        imGriff: !!s.closest('details') && !s.closest('details').open,
        hoehe: Math.round(s.getBoundingClientRect().height)
      }));
      return { name: name.replace(/\s+/g, ' ').trim(), bars };
    });
  });
  check('0-vorab: die Verteidigungsliste ist gebaut', !!karten && karten.length >= 15,
    { karten: karten ? karten.length : 0 });
  if (!karten) return ende(async () => browser.close());

  const kartenFuer = a => karten.find(k => k.name.startsWith(a.name));

  // ---- 1) Jede Anlage MIT Kampfwerten trägt drei Balken ---------------------------------------
  const mitWerten = DEF_ANLAGEN.filter(a => a.atkVal || a.defVal);
  const ohneBalken = mitWerten.filter(a => { const k = kartenFuer(a); return !k || k.bars.length !== 3; })
    .map(a => ({ anlage: a.name, balken: (kartenFuer(a) || { bars: [] }).bars.length }));
  check('1: jede Verteidigungsanlage mit Kampfwerten trägt drei Balken',
    ohneBalken.length === 0, { fehlend: ohneBalken.slice(0, 5), geprueft: mitWerten.length });

  // ---- 2) DIE KERNPRÜFUNG: die Balken sind sichtbar, nicht zugeklappt -------------------------
  const versteckt = karten.filter(k => k.bars.some(b => b.imGriff || b.hoehe === 0))
    .map(k => ({ karte: k.name, imGriff: k.bars.filter(b => b.imGriff).length, hoehe0: k.bars.filter(b => b.hoehe === 0).length }));
  check('2: kein Balken steckt in einem zugeklappten „Details"-Griff',
    versteckt.length === 0, { versteckt: versteckt.slice(0, 5) });

  // ---- 3) Die Zahlen stimmen mit BUILDING_DEFS überein ----------------------------------------
  // Geprüft wird die REGEL (Angriff = atkVal, Vert. = defVal, Schild = 40% davon), nicht eine
  // Momentaufnahme einzelner Werte - eine Balance-Änderung an einer Anlage darf den Test nicht
  // reißen, eine falsch verdrahtete Anzeige schon (Hausregel 3).
  const falsch = [];
  for (const a of mitWerten) {
    const k = kartenFuer(a);
    if (!k || k.bars.length !== 3) continue;
    const [an, vt, sc] = k.bars;
    if (an.v !== a.atkVal) falsch.push({ anlage: a.name, feld: 'Angriff', gezeigt: an.v, erwartet: a.atkVal });
    if (vt.v !== a.defVal) falsch.push({ anlage: a.name, feld: 'Vert.', gezeigt: vt.v, erwartet: a.defVal });
    if (sc.v !== a.shield) falsch.push({ anlage: a.name, feld: 'Schild', gezeigt: sc.v, erwartet: a.shield });
  }
  check('3: die Balkenwerte stimmen mit atkVal / defVal / 40%-Schild überein',
    falsch.length === 0, { abweichungen: falsch.slice(0, 6) });

  // ---- 4) Gegenrichtung: Anlagen OHNE Kampfwerte bekommen keine Nullbalken --------------------
  // Abhorchposten und Mondschild tragen ihre Wirkung in eigenen Regeln (atkVal/defVal beide 0).
  // Drei leere Balken wären dort eine nichtssagende Anzeige - und ohne diese Prüfung könnte man
  // Abschnitt 1 erfüllen, indem man einfach jeder Karte Balken gibt.
  const ohneWerte = DEF_ANLAGEN.filter(a => !a.atkVal && !a.defVal);
  const falschBalkig = ohneWerte.filter(a => { const k = kartenFuer(a); return k && k.bars.length > 0; })
    .map(a => a.name);
  check('4-vorab: es gibt überhaupt Anlagen ohne Kampfwerte zu prüfen',
    ohneWerte.length >= 1, { ohneWerte: ohneWerte.map(a => a.name) });
  check('4: Anlagen ohne Kampfwerte zeigen keine leeren Balken',
    falschBalkig.length === 0, { faelschlichBalkig: falschBalkig });

  // ---- 5) EINE Bildsprache: dieselbe CSS-Klasse wie die Schiffskarten -------------------------
  // Eine zweite, eigene Balken-Klasse wäre die typische zweite Anzeigestelle, die beim nächsten
  // Umbau auseinanderläuft (Regel 43).
  const OHNE_KOMMENTARE = S.replace(/^\s*\/\/.*$/gm, '');
  check('5: die Balken nutzen die Schiffs-Klasse .sstat statt einer zweiten Bildsprache',
    OHNE_KOMMENTARE.includes("class=\"sstat\"") && !/\.dstat\s*\{/.test(OHNE_KOMMENTARE), {});

  check('6: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
