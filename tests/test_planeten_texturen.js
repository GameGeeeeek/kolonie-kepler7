// GR-10: Planeten-Texturen aller 13 Weltentypen (Grafik-Aufnahme "Kepler-7 in neuem Licht",
// 05.09.2026). Gemessen am alten Zeichner (v8.671.0): alle zehn Typen trugen dasselbe
// V-Schlierenmuster (rowShiftX/rowShiftY liessen die Rauschkoordinate mit der Zeile wandern),
// mond, erdwelt und leerenwelt hatten keinen Builder und lieferten Byte fuer Byte die Erdtextur,
// und der 90x45-Streifen wurde bis 1,8-fach hochskaliert.
//
//   node tests/test_planeten_texturen.js
//
// WAS DER TEST MISST: Der Texturblock (PLANET_TEXTUR_B ... PLANET_TEXTURE_CACHE) wird aus der
// Spieldatei geschnitten und in einer leeren Seite ausgefuehrt - er ist absichtlich in sich
// geschlossen, damit genau das moeglich ist (Regel: gemeinsame Implementierung UND alle
// Einstiegspunkte pruefen). Die Regeln, nicht die Bilder: jeder Typ hat einen eigenen Builder,
// der Streifen ist 2:1 mit 128x64, deckend, nicht flach, an der Naht x=0/x=B nahtlos, und die
// drei frueheren Erd-Doppelgaenger unterscheiden sich sichtbar von der Erdtextur. Danach die
// beiden Einstiegspunkte im Spiel: die Planetenliste zeichnet ihre Miniaturen (Canvas nicht leer),
// die Systemkarte bettet den quadratischen Mittelausschnitt (Hoehe des Streifens = 64) ein.
//
// GEGENPROBE (beide Richtungen ausgefuehrt am 05.09.2026, per KEPLER_SPIELDATEI+KEPLER_TESTDATEI
// gegen v8.671.0): am alten Stand fehlt der Blockanker. PFLICHTLISTE (gemessen, nicht geraten):
// am alten Stand fallen 6 von 19 - 0a 0b 0c 0d 1-anker (ReferenceError PLANET_TEXTUR_B, damit
// entfaellt Block 1a-1h) und 2b (Ausschnitt 45x45 statt 64x64). Gruen bleiben MUESSEN 0e (den
// Rueckfall auf erdaehnlich gab es schon), 2-vorab, 2a und 2-anker (die Liste hat immer
// gezeichnet, das System liess sich immer oeffnen). Prueflisten beider Laeufe per diff verglichen.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const TYPEN = ['erdaehnlich', 'erdwelt', 'wasserwelt', 'wueste', 'eis', 'vulkan', 'kristall',
  'gasriese', 'asteroid', 'mond', 'todeswelt', 'super', 'leerenwelt'];
const DOPPELGAENGER = ['mond', 'erdwelt', 'leerenwelt'];   // lieferten frueher die Erdtextur

// ---- 0) Quelltext ---------------------------------------------------------------------------------
const ANFANG = 'const PLANET_TEXTUR_B = 128, PLANET_TEXTUR_H = 64;';
const ENDE = 'const PLANET_TEXTURE_CACHE = {};';
const zaehl = (s, re) => (s.match(re) || []).length;
const a0 = JS.indexOf(ANFANG), e0 = JS.indexOf(ENDE);
check('0a: der Texturblock hat genau einen Anfangs- und einen Endanker (128x64)',
  a0 >= 0 && e0 > a0 && JS.indexOf(ANFANG, a0 + 1) < 0 && JS.indexOf(ENDE, e0 + 1) < 0, { a0, e0 });
const BLOCK = a0 >= 0 && e0 > a0 ? JS.slice(a0, e0) : '';
const builderKeys = (() => {
  const i = BLOCK.indexOf('const PLANET_TEXTURE_BUILDERS = {');
  if (i < 0) return [];
  return [...BLOCK.slice(i).matchAll(/^\s{6}([a-z]+):/gm)].map(m => m[1]);
})();
check('0b: alle 13 Weltentypen haben einen eigenen Builder', TYPEN.every(t => builderKeys.includes(t)),
  { fehlt: TYPEN.filter(t => !builderKeys.includes(t)), builderKeys });
check('0c: der alte 2D-Zeichner mit Zeilenversatz (V-Muster) ist weg',
  zaehl(JS, /function makeNoise2D\(/g) === 0 && zaehl(JS, /function buildPlanetTexture\(/g) === 0
  && zaehl(BLOCK, /rowShiftX\s*:/g) === 0,
  { makeNoise2D: zaehl(JS, /function makeNoise2D\(/g), buildPlanetTexture: zaehl(JS, /function buildPlanetTexture\(/g), rowShift: zaehl(BLOCK, /rowShiftX\s*:/g) });
// Jeder Typ, den das Spiel zeigen kann (PLANET_TYPE_INFO + Terraforming-Ziele), muss einen Builder
// haben - sonst faellt er still auf die Erdtextur zurueck (genau der alte Fehler bei drei Typen).
const infoBlock = (() => { const i = JS.indexOf('const PLANET_TYPE_INFO = {'); const e = JS.indexOf('\n  };', i); return i >= 0 && e > i ? JS.slice(i, e) : ''; })();
const infoKeys = [...infoBlock.matchAll(/^\s{4}([a-z]+):\s*\{\s*label:/gm)].map(m => m[1]);
const terraform = (JS.match(/const TERRAFORM_TARGET_TYPES = \[([^\]]*)\]/) || ['', ''])[1].match(/'([a-z]+)'/g) || [];
const spielTypen = [...new Set([...infoKeys, ...terraform.map(t => t.replace(/'/g, ''))])];
check('0d: jeder im Spiel zeigbare Typ hat einen Builder (kein stiller Rueckfall auf die Erdtextur)',
  spielTypen.length >= 12 && spielTypen.every(t => builderKeys.includes(t)),
  { spielTypen, fehlt: spielTypen.filter(t => !builderKeys.includes(t)) });
check('0e: getPlanetTexture faellt fuer unbekannte Schluessel weiter auf erdaehnlich zurueck',
  /PLANET_TEXTURE_BUILDERS\[typeKey\]\s*\|\|\s*PLANET_TEXTURE_BUILDERS\.erdaehnlich/.test(JS));
/* 0f: EIN BUILDER, DEN NIEMAND ANFORDERT, IST KEINE GRAFIK. Der mond-Builder war beim ersten Einbau
   von keiner Stelle erreichbar - beide Standortlisten gaben fuer einen Mond fest 'asteroid', und die
   Systemkarte zeichnet Monde als Marker, nicht als Planetenknoten. Die Textur war also gebaut,
   gecacht, geprueft - und unsichtbar. Geprueft wird deshalb der WEG zur Grafik, nicht nur ihre
   Existenz: keine Stelle darf einem Mond mehr die Asteroiden-Textur geben. */
const mondStellen = [...JS.matchAll(/isMoonKey\([^)]*\)\s*\?\s*'([a-z]+)'/g)].map(m => m[1]);
check('0f-anker: mindestens eine Stelle waehlt die Textur anhand von isMoonKey', mondStellen.length >= 1, mondStellen);
check('0f: ein Mond bekommt die Mond-Textur, nicht die eines Asteroiden',
  mondStellen.length >= 1 && mondStellen.every(t => t === 'mond') && !/data-planet-icon="asteroid"/.test(JS),
  { ueberIsMoonKey: mondStellen, festeAsteroidIcons: (JS.match(/data-planet-icon="asteroid"/g) || []).length });

(async () => {
  const browser = await starteBrowser();
  // ---- 1) Der Block selbst, in einer leeren Seite -------------------------------------------------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('about:blank');
    let mess = null, fehler = null;
    try {
      mess = await page.evaluate(({ code, typen, doppel }) => {
        const fn = new Function(code + '\n;return { B: PLANET_TEXTUR_B, H: PLANET_TEXTUR_H, builders: PLANET_TEXTURE_BUILDERS };');
        const { B, H, builders } = fn();
        const t0 = performance.now();
        const tex = {}; for (const t of typen) tex[t] = builders[t] ? builders[t]() : null;
        const dauerMs = performance.now() - t0;
        const daten = t => tex[t].getContext('2d').getImageData(0, 0, tex[t].width, tex[t].height).data;
        const je = {};
        const erde = tex.erdaehnlich ? daten('erdaehnlich') : null;
        for (const t of typen) {
          if (!tex[t]) { je[t] = { fehlt: true }; continue; }
          const w = tex[t].width, h = tex[t].height, d = daten(t);
          let minA = 255, sum = 0, sum2 = 0, n = w * h;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < minA) minA = d[i + 3];
            const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            sum += l; sum2 += l * l;
          }
          const mittel = sum / n, streuung = Math.sqrt(Math.max(0, sum2 / n - mittel * mittel));
          // Naht: Spalte 0 gegen Spalte w-1 (die Nachbarn ueber die Naht) im Vergleich zu Spalte 0
          // gegen Spalte 1 (die Nachbarn innerhalb des Streifens) - nahtlos heisst: beide gleich klein.
          const spaltenDiff = (x1, x2) => { let s = 0; for (let y = 0; y < h; y++) { const i1 = (y * w + x1) * 4, i2 = (y * w + x2) * 4; s += Math.abs(d[i1] - d[i2]) + Math.abs(d[i1 + 1] - d[i2 + 1]) + Math.abs(d[i1 + 2] - d[i2 + 2]); } return s / (h * 3); };
          const naht = spaltenDiff(0, w - 1), nachbar = spaltenDiff(0, 1), gegenueber = spaltenDiff(0, Math.floor(w / 2));
          let anders = 0;
          if (erde && erde.length === d.length) { for (let i = 0; i < d.length; i += 4) { if (Math.abs(d[i] - erde[i]) > 8 || Math.abs(d[i + 1] - erde[i + 1]) > 8 || Math.abs(d[i + 2] - erde[i + 2]) > 8) anders++; } }
          je[t] = { w, h, minA, streuung: +streuung.toFixed(1), naht: +naht.toFixed(2), nachbar: +nachbar.toFixed(2), gegenueber: +gegenueber.toFixed(2), andersAlsErde: +(anders / n).toFixed(3) };
        }
        // Determinismus: zweiter Aufruf liefert dieselben Bytes (der Cache im Spiel haelt nur EINE Textur je Typ)
        const d1 = daten('erdaehnlich'), d2 = builders.erdaehnlich().getContext('2d').getImageData(0, 0, B, H).data;
        let gleich = d1.length === d2.length; for (let i = 0; gleich && i < d1.length; i++) if (d1[i] !== d2[i]) gleich = false;
        return { B, H, dauerMs: Math.round(dauerMs), je, deterministisch: gleich };
      }, { code: BLOCK, typen: TYPEN, doppel: DOPPELGAENGER });
    } catch (e) { fehler = String(e).slice(0, 300); }
    check('1-anker: der Texturblock laeuft in sich geschlossen (keine fremden Bezeichner)', !!mess && !fehler, fehler);
    if (mess) {
      const je = mess.je;
      check('1a: jeder Streifen ist 2:1 mit 128x64 (die 45er-Hoehe war bis 1,8-fach hochskaliert)',
        mess.B === 128 && mess.H === 64 && TYPEN.every(t => je[t].w === 128 && je[t].h === 64),
        TYPEN.map(t => [t, je[t].w, je[t].h]));
      check('1b: jeder Streifen ist deckend (kein Alpha unter 255)', TYPEN.every(t => je[t].minA === 255),
        TYPEN.filter(t => je[t].minA !== 255).map(t => [t, je[t].minA]));
      check('1c: kein Streifen ist flach (Helligkeitsstreuung mindestens 6)', TYPEN.every(t => je[t].streuung >= 6),
        TYPEN.map(t => [t, je[t].streuung]));
      check('1d: jeder Streifen ist an der Naht nahtlos (Nahtsprung hoechstens doppelter Nachbarsprung + 4)',
        TYPEN.every(t => je[t].naht <= je[t].nachbar * 2 + 4),
        TYPEN.map(t => [t, je[t].naht, je[t].nachbar]));
      check('1e: mond, erdwelt und leerenwelt sind KEINE Erd-Doppelgaenger mehr (mindestens 30% der Pixel anders)',
        DOPPELGAENGER.every(t => je[t].andersAlsErde >= 0.3), DOPPELGAENGER.map(t => [t, je[t].andersAlsErde]));
      check('1f: alle Typen unterscheiden sich von der Erdtextur', TYPEN.filter(t => t !== 'erdaehnlich').every(t => je[t].andersAlsErde >= 0.3),
        TYPEN.map(t => [t, je[t].andersAlsErde]));
      check('1g: die Builder sind deterministisch (zweiter Aufruf = dieselben Bytes)', mess.deterministisch === true);
      // Gemessen 267 ms fuer alle 13 - der Deckel schuetzt vor einem versehentlichen Oktaven-Sprung,
      // nicht vor Last: 15-facher Spielraum.
      check('1h: alle 13 Streifen entstehen in unter 4 s', mess.dauerMs < 4000, { dauerMs: mess.dauerMs });
    }
    await ctx.close();
  }

  // ---- 2) Die Einstiegspunkte im Spiel ----------------------------------------------------------
  const store = {};
  const now = Date.now();
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, ships: 3, colonyShips: 1, missions: [] },
    discovered: { rhea: true, aion: true },
    colonies: { rhea: { buildings: { solar: 3, mine: 2, habitat: 1 }, fleet: { ships: 2, missions: [] } } }, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, prestige: 4, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {}, nextPlanetEventCheck: now + 3600000
  });
  const backend = async r => {
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await page.route('**/api/**', backend);
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  check('2-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  const liste = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('#planetList canvas[data-planet-icon]')];
    return cs.map(c => {
      const ctx = c.getContext('2d'); const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let farben = new Set(); let deckend = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 200) { deckend++; farben.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); } }
      return { typ: c.getAttribute('data-planet-icon'), deckendAnteil: +(deckend / (c.width * c.height)).toFixed(2), farben: farben.size };
    });
  });
  check('2a: die Planetenliste zeichnet jede Miniatur (Scheibe deckend, mehr als vier Farbtoene)',
    liste.length >= 5 && liste.every(m => m.deckendAnteil >= 0.5 && m.farben > 4), liste);

  // Die Streifen haengen erst an der SYSTEMEBENE (Sektorkarte -> System kepler oeffnen).
  const auf = await oeffneSystemUeberSektoren(page, 'kepler');
  check('2-anker: das Heimatsystem laesst sich ueber die Sektoren oeffnen', auf === true, auf);
  const karte = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('#galaxyMapSvg image')].map(i => i.getAttribute('href') || i.getAttribute('xlink:href')).filter(h => h && h.startsWith('data:image/png'));
    const groessen = await Promise.all(imgs.slice(0, 6).map(h => new Promise(res => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res([0, 0]); im.src = h; })));
    return { anzahl: imgs.length, groessen };
  });
  check('2b: die Systemkarte bettet den quadratischen 64er-Mittelausschnitt der Streifen ein',
    karte.anzahl >= 1 && karte.groessen.every(g => g[0] === 64 && g[1] === 64), karte);

  await ende(async () => browser.close());
})();
