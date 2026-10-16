// KB-22: Der Beschriftungs-Entflechter gibt nicht mehr auf, solange ein Platz frei ist.
//
//   node tests/test_beschriftung_ausweichen.js
//
// DER FEHLERBERICHT (Sascha, 07.09.2026): "Planetenname überdeckt die Mitte eines
// Asteroiden-Vorkommens". Die naheliegende Vermutung war, dass kbLabelsEntflechten das Vorkommen
// gar nicht kennt - sein Körper ist ein <polygon>, und der Entflechter greift `image`, dann
// `circle.body`, dann den größten Kreis. GEMESSEN war es anders: Er kennt es, sieht die Kollision
// und GIBT AUF. Eine instrumentierte Kopie protokollierte wörtlich `frei=false` für beide Namen.
//
// Der Grund ist die Ausweichrichtung. Ein Planetenname steht UNTER seinem Planeten, "weg vom
// eigenen Objekt" heißt damit "weiter nach unten" - und unten liegt die Gürtelbahn. Alle sieben
// erlaubten Plätze landeten auf dem nächsten Vorkommen. Nach OBEN, über den eigenen Planeten
// hinweg, wäre der erste Schritt frei gewesen; diese Richtung probierte er nie.
//
// GEPRÜFT WIRD DIE REGEL, nicht die Momentaufnahme. Nicht "Chronos-3 liegt bei y=105,7", sondern:
//   1b  KEINE Beschriftung verdeckt die MITTE eines fremden Kartenobjekts. Die Mitte ist das, was
//       den Marker unlesbar und (vor GR-11) untippbar machte - der Rand ist Kosmetik.
//   1c  Liegt eine Beschriftung überhaupt auf einem fremden Objekt, dann ist in der GANZEN
//       Kandidatenliste kein Platz frei. Das ist die eigentliche Aussage: Aufgeben ist nur dann
//       erlaubt, wenn es nichts zu holen gibt. Die Hindernismenge hier ist ABSICHTLICH weiter als
//       die des Entflechters (alle anderen Beschriftungen statt nur der bereits gesetzten) - was
//       diese Prüfung als frei ansieht, hätte er erst recht als frei gesehen. Ein falsches Rot ist
//       damit ausgeschlossen; ein falsches Grün wäre der teurere Fehler.
//
//       DIESE PRÜFUNG WAR IM ERSTEN ENTWURF FALSCH, und der Fehler ist lehrreich genug für einen
//       Absatz: Sie rechnete die Kandidaten von der ENDLAGE aus. Der Entflechter rechnet sie aber
//       von der AUSGANGSLAGE aus - bei einer verschobenen Beschriftung sind das zwei verschiedene
//       Raster, und die Prüfung verlangte einen Platz, den er nie erreichen konnte. Sie meldete
//       prompt rot an einem Stand, der nachweislich richtig gewählt hatte (instrumentierte Kopie:
//       alle neun Lagen belegt, gewählt wurde die mit der kleinsten Überdeckung).
//       Die Ausgangslage wird deshalb GEMESSEN statt geraten: Beschriftungen derselben Objektart
//       sitzen mit demselben natürlichen Abstand an ihrem Objekt; der häufigste Abstand im Bild
//       IST dieser natürliche (die meisten Beschriftungen werden nie verschoben). Wer davon
//       abweicht, wurde um genau diese Differenz verschoben. Trägt eine Art weniger als drei
//       Beschriftungen, ist der häufigste Wert kein Beleg - dann wird sie übersprungen.
//   1d  Der seitliche Versatz bleibt im Rahmen (höchstens 12 Einheiten von der Objektmitte). Der
//       erste Entwurf von KB-16 erlaubte 42 senkrecht, und "Deine Basis" landete unter dem
//       NACHBARPLANETEN. Die Zuordnung Label->Objekt ist wichtiger als jede gelöste Kollision.
//   1e  Keine Beschriftung liegt näher an der Mitte eines FREMDEN Objekts als an der ihres eigenen.
//       Dieselbe Lehre, in der Form, die auch freistehende Beschriftungen erfasst.
//   1g  Keine überdeckte Beschriftung blieb mangels Bezugsgröße ungeprüft. Der Wächter zählt aus,
//       was er NICHT beurteilen konnte - sonst wäre 1c grün, sobald die Bezugsmessung wegfällt.
//   1h  Keine Beschriftung liegt auf dem KÖRPER ihres EIGENEN Objekts. Das ist der Fehler, den die
//       Regel beim Bauen zweimal gemacht hat: "über das eigene Objekt hinweg" wurde zu "mitten
//       darauf". Gefunden hat ihn beide Male der Bestandstest test_kartenbeschriftung, nicht dieser
//       Wächter - der klammerte das eigene Objekt aus, genau wie die fehlerhafte Umsetzung.
//
// GEGENPROBE IN ZWEI RICHTUNGEN, beide gemessen:
//   alt      `git show 890ff38:weltraum_kolonie.html` - der Stand VOR der Reparatur. Dort fällt 1b.
//   entwurf  `git show 479b1f5:weltraum_kolonie.html` - mein EIGENER erster Entwurf, der die
//            Gegenrichtung ohne Rücksicht auf das eigene Objekt probierte. Dort fällt 1h, und nur
//            1h. Dieser zweite Stand ist der wertvollere von beiden: Er ist kein historischer
//            Zustand, sondern ein Fehler, der beim Bauen dieser Etappe wirklich passiert ist.
// Aufruf: KEPLER_SPIELDATEI=<kopie> KEPLER_ENTFLECHTER_GEGENPROBE=alt|entwurf
const { starteBrowser, SPIEL_URL, ruhigeUhren, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { SPIELDATEI, WURZEL } = require('./lib/spieldatei');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { check: rohCheck, ende } = pruefer();
const ergebnis = {};
const check = (name, bedingung, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bedingung; rohCheck(name, bedingung, zusatz); };

const SAB = process.env.KEPLER_ENTFLECHTER_GEGENPROBE || '';
// Explicit HTTP modes add one non-vacuous image-state guard; the legacy run
// keeps its eight original guards and historical counterexample semantics.
const ASSET_MODE = process.env.KEPLER_ASTEROID_ASSET_MODE || '';
const EVIDENCE_DIR = process.env.KEPLER_ASTEROID_EVIDENCE_DIR || '';
/* GEMESSEN, nicht geschätzt - und dreimal nach unten korrigiert, weil die Messung mein Bauchgefühl
   jedes Mal widerlegt hat (erst 1e, dann 1g, dann 1c). 1a fehlt hier bewusst: Es ist die
   Vorbedingung (das Gürtelsystem zeigt überhaupt genug Objekte), gilt an beiden Ständen und
   belegt nichts über die Reparatur. 1d und 1e gelten am alten Stand ebenfalls - der alte Code
   überschritt den Rahmen nie und verirrte keine Beschriftung, er blieb einfach liegen. 1g gilt
   dort ebenfalls: Die Kürzel der Vorkommen überlappen am alten Stand zwar sichtbar, aber nicht die
   GEMESSENE Fläche, an der 1c ansetzt - also gibt es dort auch nichts zu übergehen.
   1c steht ebenfalls nicht mehr drin, und das ist die interessanteste der drei Streichungen: Vor
   der Korrektur des blinden Flecks (eigenes Objekt bei verschobenen Plätzen) fiel 1c am alten
   Stand - aber aus dem FALSCHEN Grund. Es hielt die eigene Planetenscheibe für einen freien Platz.
   Mit der richtigen Regel erfüllen beide Stände 1c, und nur 1b unterscheidet sie noch. Eine
   Prüfung, die aus dem falschen Grund rot ist, ist genauso wertlos wie eine, die aus dem falschen
   Grund grün ist. */
const MUSS_FALLEN = { alt: ['1b'], entwurf: ['1h'] };

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
/* Fünf belegte Gürtelplätze im selben Bild: Der Fehler braucht DICHTE - ein einzelnes Vorkommen
   hat immer Platz daneben. Jeder Halter bringt zusätzlich sein Kürzel als eigene Beschriftung mit,
   die Beschriftungen konkurrieren also auch untereinander. Das ist genau die Lage aus dem Bericht. */
const PLAETZE = ['1', '2', '3', '4', '5'];

function assetFixture(page, evidence){
  const origin = new URL(process.env.KEPLER_HTTP_TEST_ORIGIN || '');
  if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || !origin.port)
    throw new Error('Explicit asteroid asset modes require tests/http-run.js on loopback HTTP');
  const manifest = JSON.parse(fs.readFileSync(path.join(WURZEL, 'docs/asteroid-mining-art-package.json'), 'utf8'));
  const groups = manifest.groups.filter(g => g.tiles.some(t => t.rasterKey === 'asteroid:eisen'));
  if (groups.length !== 1) throw new Error('Exactly one canonical iron asteroid atlas is required');
  const art = groups[0], tile = art.tiles.find(t => t.rasterKey === 'asteroid:eisen');
  const assets = ['webp', 'png'].map((ext, index) => ({
    url: new URL(art.stem + '.' + ext + '?v=' + art[ext + 'Sha256'].slice(0, 12), origin).href,
    status: index ? 503 : 404, ext
  }));
  const targets = new Map(assets.map(a => [a.url, a])), requests = new Map();
  evidence.assets = assets;
  page.on('request', request => {
    if (!targets.has(request.url())) return;
    const record = { url: request.url(), method: request.method(), type: request.resourceType(), status: null, failure: null, intercepted: false };
    requests.set(request, record); evidence.network.push(record);
  });
  page.on('response', response => {
    const record = requests.get(response.request());
    if (record) record.status = response.status();
  });
  page.on('requestfailed', request => {
    const record = requests.get(request);
    if (record) record.failure = request.failure()?.errorText || 'request failed';
  });
  const route = page.route(url => targets.has(url.href), async route => {
    const asset = targets.get(route.request().url()), record = requests.get(route.request());
    if (record) record.intercepted = true;
    if (ASSET_MODE === 'unavailable')
      await route.fulfill({ status: asset.status, contentType: 'text/plain', body: 'Deliberately unavailable native asteroid atlas' });
    else await route.continue();
  });
  return { route, art, tile, assets };
}

async function waitForAssetMode(page, evidence, fixture){
  try {
    const complete = () => ASSET_MODE === 'unavailable'
      ? fixture.assets.every(a => evidence.network.some(r => r.url === a.url && r.status === a.status))
      : evidence.network.some(r => r.status === 200);
    const deadline = Date.now() + 10000;
    while (!complete() && Date.now() < deadline) await page.waitForTimeout(50);
    if (!complete()) throw new Error('The exact native atlas requests did not finish in the selected mode');
    await page.waitForFunction(({ mode, places }) => {
      const nodes = [...document.querySelectorAll('#galaxyMapSvg [data-map-asteroid]')];
      return nodes.length === places.length && places.every(place => {
        const g = nodes.find(n => n.getAttribute('data-map-asteroid') === place);
        const image = g?.querySelector('[data-asteroid-image]'), fallback = g?.querySelector('[data-asteroid-fallback]');
        if (!image || !fallback) return false;
        return mode === 'available'
          ? image.dataset.asteroidArtReady === 'true' && !!image.getAttribute('href') && getComputedStyle(fallback).visibility === 'hidden'
          : image.dataset.asteroidArtReady !== 'true' && !image.getAttribute('href') && getComputedStyle(fallback).visibility === 'visible';
      });
    }, { mode: ASSET_MODE, places: PLAETZE }, { timeout: 8000 });
  } catch (error) { evidence.waitError = error.message; }
}

function assetModeMatches(evidence, fixture, measured){
  if (evidence.waitError || measured.asteroids.length !== PLAETZE.length) return false;
  const exactPlaces = measured.asteroids.map(a => a.place).sort();
  if (JSON.stringify(exactPlaces) !== JSON.stringify(PLAETZE.slice().sort())) return false;
  const network = evidence.network;
  if (!network.length || network.some(r => r.type !== 'image' || r.method !== 'GET' || !r.intercepted || r.failure)) return false;
  const bodies = measured.asteroids.every(a => {
    const selected = measured.flaechen.find(f => f.platz === a.place);
    if (!selected || !selected.koerper.sichtbar || a.labels.length !== 1 || a.labels[0] !== '[RIV]' || !a.fallback || !a.image) return false;
    const image = a.image;
    if (image.key !== 'asteroid:eisen') return false;
    if (ASSET_MODE === 'available') return selected.koerper.tag === 'image' && image.ready === 'true'
      && image.atlas === fixture.art.stem && image.crop === fixture.tile.rect.join(',')
      && image.href?.startsWith('data:image/png;base64,') && image.visibility === 'visible'
      && a.fallback.visibility === 'hidden' && ['webp', 'png'].includes(image.format);
    return selected.koerper.tag === 'circle' && selected.koerperInk.quelle === 'Körper und Kontur'
      && selected.koerperInk.kontur > 0 && selected.b.w > 0 && selected.b.h > 0
      && image.ready !== 'true' && !image.href && a.fallback.visibility === 'visible' && a.fallback.polygons > 0;
  });
  return bodies && (ASSET_MODE === 'available'
    ? network.every(r => r.status === 200)
    : network.length === 2 && fixture.assets.every((a, index) => network[index].url === a.url && network[index].status === a.status));
}

async function preserveAssetEvidence(page, evidence){
  if (!EVIDENCE_DIR) return;
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  try {
    if (!page || page.isClosed()) throw new Error('No open native page was available for the screenshot');
    const map = page.locator('#galaxyMapSvg');
    if (await map.isVisible()) await map.scrollIntoViewIfNeeded({ timeout: 5000 });
    const png = await page.screenshot({ timeout: 10000, animations: 'allow', caret: 'initial' });
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'native.png'), png, { flag: 'wx' });
    evidence.screenshot = { file: 'native.png', bytes: png.length, sha256: crypto.createHash('sha256').update(png).digest('hex') };
  } catch (error) { evidence.screenshotError = error.stack || String(error); }
  evidence.results = { ...ergebnis };
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'network-body.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  if (evidence.screenshotError) throw new Error(evidence.screenshotError);
}

function serverFeld(){
  const plaetze = {};
  for (const p of PLAETZE){
    plaetze[p] = { sorte:'eisen', groesse:'brocken', vorrat:90000, halter:'x2', halterName:'Rivale',
      tag:'RIV', seit:1, eskorte:{ jaeger: 8 }, schutzBis: 0 };
  }
  return { systeme:[SYS], felder:{ [SYS]: { plaetze } } };
}
function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'asteroid/field') return j(serverFeld());
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|reports|galaxy|vorposten/.test(p))
      return j(p.includes('pending') ? { reward:null } : (p === 'galaxy'
        ? { npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[], collapsedSystems:{}, activeWormhole:null, news:[], controlledSystems:{}, factions:{}, alienNester: [] }
        : []));
    return j({});
  };
}
const SPIELSTAND = JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: { basis:1, karte:1, galaxie:1 },
  resources: { energie:148000, erz:152000, kristalle:131000, deuterium:92000, antimaterie:3900, forschungspunkte:12200 },
  buildings: { solar:18, mine:17, kristallmine:15, labor:10, lager:12, werft:8 },
  research: {}, fleet: { jaeger:120, transporter:30, missions:[] }, colonies: {},
  activeBasePlanet: 'home', player: { id:'u', name:'AdmiralX' }, xp:152000, credits:384000
}));

/* Misst am GERENDERTEN Bild. Die Flächenwahl (image -> circle.body -> größter Kreis) ist bewusst
   dieselbe wie in kbLabelsEntflechten: Gemessen wird gegen das, was der Entflechter als belegt
   ansieht - sonst prüfte der Test eine andere Karte als die, die er beurteilt. Für die MITTE (1b)
   und die Zuordnung (1e) zählt dagegen die Gruppe als GANZES, denn das ist, was der Spieler sieht. */
async function lage(page){
  return page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find(s => s.querySelector('.planet-node'));
    if (!svg) return { fehler: 'kein SVG mit .planet-node' };
    const OBJEKTE = '.planet-node';
    const kasten = el => { try { const b = el.getBBox(); return b && b.width ? { x:b.x, y:b.y, w:b.width, h:b.height } : null; } catch(e){ return null; } };
    const koerperInkMessen = (el, gruppe, box) => {
      const fallback = grund => ({ box, quelle: 'getBBox', grund });
      try {
        if (!['circle', 'image'].includes(el.tagName) || el.children.length)
          return fallback('kein einfacher Kreis oder Bildkörper');
        for (let a = el; a; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (a.hasAttribute('transform') || s.transform !== 'none' || s.filter !== 'none' ||
              s.vectorEffect !== 'none' || s.clipPath !== 'none' || s.maskImage !== 'none')
            return fallback('Körperlayout oder Maleffekt nicht sicher bestimmbar');
          if (a === gruppe) break;
        }
        const stil = getComputedStyle(el);
        let kontur = 0;
        if (stil.stroke !== 'none') {
          // Bild-Strokes sowie quadratische Strichenden sind hier nicht modelliert.
          // Beim Kreis umfassen runde/stumpfe Enden auch gestrichelte Ringe sicher.
          if (el.tagName !== 'circle' || !/^\d+(?:\.\d+)?px$/.test(stil.strokeWidth) ||
              !['butt', 'round'].includes(stil.strokeLinecap))
            return fallback('Körperkontur nicht sicher bestimmbar');
          kontur = parseFloat(stil.strokeWidth) / 2;
        }
        return { box: { x: box.x - kontur, y: box.y - kontur,
          w: box.w + 2 * kontur, h: box.h + 2 * kontur }, quelle: 'Körper und Kontur', kontur };
      } catch (e) { return fallback(String(e.message || e)); }
    };
    const koerperSichtbar = el => {
      for (let node = el; node; node = node.parentElement){
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) <= 0) return false;
      }
      return true;
    };
    const flaechen = [];
    svg.querySelectorAll(OBJEKTE).forEach(g => {
      // Native Chromium retains a 12x12 SVG image box even with no decoded href.
      // That placeholder paints no asteroid. Measure the visible native body;
      // keep the placeholder's actual box in the evidence instead of erasing it.
      let el = [...g.querySelectorAll('image')].find(image =>
        !(image.hasAttribute('data-asteroid-image') && image.dataset.asteroidArtReady !== 'true') && kasten(image)) || g.querySelector('circle.body');
      if (!el){
        const kreise = [...g.querySelectorAll('circle')];
        if (kreise.length) el = kreise.reduce((a, c) => (+c.getAttribute('r') > +a.getAttribute('r') ? c : a));
      }
      if (!el) return;
      const b = kasten(el), ganz = kasten(g);
      if (!b || !ganz) return;
      flaechen.push({ nr: flaechen.length, b, ganz, platz: g.getAttribute('data-map-asteroid'), koerperInk: koerperInkMessen(el, g, b),
        koerper: { tag: el.tagName, sichtbar: koerperSichtbar(el), klasse: el.getAttribute('class'),
          cy: el.getAttribute('cy'), r: el.getAttribute('r') },
        polygone: [...g.querySelectorAll('polygon')].map(kasten).filter(Boolean),
        art: [...g.attributes].map(a => a.name).filter(n => n.startsWith('data-')).join(',') });
      g.__nr = flaechen.length - 1;
    });
    const texte = [...svg.querySelectorAll('text.planet-label')];
    // 1b/1c vergleichen weiterhin die getBBox-Flächen des Entflechters. Nur 1h darf bei
    // einfachen Texten die sichtbare Glyphenhöhe statt der unsichtbaren Font-Linebox nutzen.
    const glyphenMessen = (t, stil) => {
      const computedFont = [stil.fontStyle || 'normal', stil.fontWeight || 'normal',
        stil.fontSize, stil.fontFamily].join(' ');
      const basis = { computedFont, letterSpacing: stil.letterSpacing,
        textAnchor: stil.textAnchor, dominantBaseline: stil.dominantBaseline,
        alignmentBaseline: stil.alignmentBaseline, baselineShift: stil.baselineShift };
      try {
        const ctx = document.createElement('canvas').getContext('2d');
        if (!ctx) return { ...basis, fehler: 'kein Canvas-2D-Kontext' };
        ctx.font = computedFont;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.direction = stil.direction === 'rtl' ? 'rtl' : 'ltr';
        const spacingUnterstuetzt = 'letterSpacing' in ctx;
        if (spacingUnterstuetzt) ctx.letterSpacing = stil.letterSpacing === 'normal' ? '0px' : stil.letterSpacing;
        const m = ctx.measureText(t.textContent || '');
        return { ...basis, canvasFont: ctx.font, textAlign: ctx.textAlign, textBaseline: ctx.textBaseline,
          direction: ctx.direction, canvasLetterSpacing: spacingUnterstuetzt ? ctx.letterSpacing : null,
          spacingUnterstuetzt, width: m.width,
          actualBoundingBoxAscent: m.actualBoundingBoxAscent, actualBoundingBoxDescent: m.actualBoundingBoxDescent,
          actualBoundingBoxLeft: m.actualBoundingBoxLeft, actualBoundingBoxRight: m.actualBoundingBoxRight };
      } catch (e) { return { ...basis, fehler: String(e.message || e) }; }
    };
    const eigenInkMessen = (t, stil, box, glyphen) => {
      const fallback = grund => ({ box, quelle: 'getBBox', grund });
      try {
        // Canvas und SVG sind nur in diesem einfachen alphabetischen Fall vergleichbar.
        // Bei Sonderlayout wird nicht geraten, sondern die bisherige strenge Box behalten.
        if (!box || t.children.length || ['rotate', 'textLength', 'lengthAdjust', 'transform'].some(a => t.hasAttribute(a)) ||
            ['x', 'y', 'dx', 'dy'].some(a => t[a].baseVal.numberOfItems > 1) ||
            stil.transform !== 'none' || stil.writingMode !== 'horizontal-tb' || stil.direction !== 'ltr' ||
            !['auto', 'alphabetic'].includes(stil.dominantBaseline) ||
            !['auto', 'baseline'].includes(stil.alignmentBaseline) || !['0px', '0'].includes(stil.baselineShift))
          return fallback('kein einfacher horizontaler alphabetischer Text');
        if (stil.fontVariant !== 'normal' || !['normal', '100%'].includes(stil.fontStretch) ||
            stil.fontFeatureSettings !== 'normal' || stil.fontVariationSettings !== 'normal' ||
            stil.textTransform !== 'none' || stil.textDecorationLine !== 'none' ||
            stil.textShadow !== 'none' || stil.filter !== 'none' || stil.vectorEffect !== 'none' ||
            (!glyphen.spacingUnterstuetzt && !['normal', '0px'].includes(stil.letterSpacing)))
          return fallback('Schrift- oder Maleffekt nicht in Canvas-Metrik enthalten');
        const n = t.getNumberOfChars();
        if (!n) return fallback('keine gerenderten Zeichen');
        const baselineY = t.getStartPositionOfChar(0).y;
        for (let i = 0; i < n; i++)
          if (t.getStartPositionOfChar(i).y !== baselineY || t.getRotationOfChar(i) !== 0)
            return fallback('wechselnde Grundlinie oder Zeichendrehung');
        const ascent = glyphen.actualBoundingBoxAscent, descent = glyphen.actualBoundingBoxDescent;
        if (![baselineY, ascent, descent].every(Number.isFinite) || ascent + descent <= 0)
          return fallback('keine belastbare Glyphenmetrik');
        let kontur = 0;
        if (stil.stroke !== 'none') {
          if (!/^\d+(?:\.\d+)?px$/.test(stil.strokeWidth) || !['round', 'bevel'].includes(stil.strokeLinejoin))
            return fallback('Konturausdehnung nicht sicher bestimmbar');
          kontur = parseFloat(stil.strokeWidth) / 2;
        }
        // Horizontal bleibt die volle getBBox-Breite ZUZÜGLICH der Kontur bestehen.
        // Die runde/abgeschrägte Kontur reicht höchstens eine halbe Strichbreite über
        // die Glyphen hinaus: keine Fehlertoleranz.
        return { box: { x: box.x - kontur, y: baselineY - ascent - kontur,
          w: box.w + 2 * kontur, h: ascent + descent + 2 * kontur },
          quelle: 'Glyphen und Kontur', baselineY, kontur };
      } catch (e) { return fallback(String(e.message || e)); }
    };
    const labels = texte.map(t => {
      const eigen = t.closest(OBJEKTE);
      const stil = getComputedStyle(t);
      const box = kasten(t), glyphen = glyphenMessen(t, stil);
      return { text:(t.textContent||'').trim().slice(0, 28), box,
               finalY: t.getAttribute('y'), transform: t.getAttribute('transform'),
               font: { family: stil.fontFamily, size: stil.fontSize, weight: stil.fontWeight, lineHeight: stil.lineHeight },
               glyphen, eigenInk: eigenInkMessen(t, stil, box, glyphen),
               eigenNr: eigen && eigen.__nr !== undefined ? eigen.__nr : -1 };
    }).filter(l => l.box);
    const asteroids = [...svg.querySelectorAll('[data-map-asteroid]')].map(g => {
      const image = g.querySelector('[data-asteroid-image]'), fallback = g.querySelector('[data-asteroid-fallback]');
      return { place: g.getAttribute('data-map-asteroid'), labels: [...g.querySelectorAll('text.planet-label')].map(t => t.textContent.trim()),
        image: image ? { key: image.dataset.gameRasterKey, atlas: image.dataset.gameAtlas, crop: image.dataset.gameCrop,
          format: image.dataset.gameFormat, ready: image.dataset.asteroidArtReady, href: image.getAttribute('href'),
          visibility: getComputedStyle(image).visibility, box: kasten(image) } : null,
        fallback: fallback ? { visibility: getComputedStyle(fallback).visibility, polygons: fallback.querySelectorAll('polygon').length } : null };
    });
    return { flaechen, labels, asteroids };
  });
}

const schneidet = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const eigenVergleich = (label, flaeche) => {
  const text = label.eigenInk, koerper = flaeche.koerperInk;
  if (text.quelle !== 'getBBox' && koerper.quelle !== 'getBBox')
    return { textBox: text.box, koerperBox: koerper.box, quelle: 'Glyphen und beide Konturen' };
  // Keine gemischte Messung: Schon ein unsicherer Partner behält den gesamten alten Test.
  return { textBox: label.box, koerperBox: flaeche.b, quelle: 'getBBox',
    grund: [text.grund, koerper.grund].filter(Boolean).join('; ') };
};
const mitteIn = (k, f) => {
  const cx = f.ganz.x + f.ganz.w/2, cy = f.ganz.y + f.ganz.h/2;
  return cx >= k.x && cx <= k.x + k.w && cy >= k.y && cy <= k.y + k.h;
};
const abstand = (k, f) => Math.hypot((k.x + k.w/2) - (f.ganz.x + f.ganz.w/2), (k.y + k.h/2) - (f.ganz.y + f.ganz.h/2));

(async () => {
  let browser, ctx, page;
  const evidence = { mode: ASSET_MODE || 'legacy', network: [], body: null };
  try {
  if (!['', 'available', 'unavailable'].includes(ASSET_MODE)) throw new Error('Unknown KEPLER_ASTEROID_ASSET_MODE');
  if (ASSET_MODE && SAB) throw new Error('Explicit asset modes must retain the real exit code; do not combine them with historical SAB overrides');
  if (ASSET_MODE || EVIDENCE_DIR) evidence.sources = Object.fromEntries([SPIELDATEI, __filename, path.join(WURZEL, 'docs/asteroid-mining-art-package.json')]
    .map(file => [path.relative(WURZEL, file), crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  browser = await starteBrowser();
  const store = { [SAVE_KEY]: SPIELSTAND };
  ctx = await browser.newContext({ viewport: { width:1280, height:900 } });
  page = await ctx.newPage();
  const assets = ASSET_MODE ? assetFixture(page, evidence) : null;
  if (assets) await assets.route;
  const fehler = [];
  page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
    const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click();
  });
  await page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(1500);
  if (assets) await waitForAssetMode(page, evidence, assets);

  const l = await lage(page);
  evidence.body = l;
  if (l.fehler){ check('0a: Systemebene gezeichnet', false, l.fehler); throw new Error(l.fehler); }
  if (assets){
    const asteroids = l.asteroids.map(a => ({ ...a, image: a.image ? { ...a.image, href: a.image.href ? {
      prefix: a.image.href.slice(0, 32), characters: a.image.href.length, sha256: crypto.createHash('sha256').update(a.image.href).digest('hex')
    } : null } : null }));
    check('1i: expliziter Asteroiden-Bildmodus zeigt alle fünf nativen Körper', assetModeMatches(evidence, assets, l),
    { mode: ASSET_MODE, waitError: evidence.waitError || null, network: evidence.network, asteroids,
      bodies: l.flaechen.filter(f => f.platz !== null).map(f => ({ place: f.platz, body: f.koerper, box: f.b, ink: f.koerperInk })) });
  }

  const vorkommen = l.flaechen.filter(f => /data-map-asteroid/.test(f.art));
  const namen = l.labels.filter(x => x.eigenNr >= 0);
  check('1a: dichtes Gürtelsystem gerendert (Vorbedingung)',
    vorkommen.length >= 4 && namen.length >= 6,
    vorkommen.length + ' Vorkommen, ' + namen.length + ' Beschriftungen mit eigenem Objekt');

  // 1b - die Mitte
  const mitten = [];
  for (const x of l.labels)
    for (const f of l.flaechen)
      if (f.nr !== x.eigenNr && mitteIn(x.box, f)) mitten.push(x.text + ' auf ' + f.art);
  check('1b: keine Beschriftung verdeckt die Mitte eines fremden Objekts',
    mitten.length === 0, mitten.join(' | ') || 'keine');

  // 1c - aufgegeben, obwohl ein Platz frei war?
  /* Der natürliche Abstand je Objektart, GEMESSEN als häufigster Wert im Bild (siehe Kopf). Der
     Schlüssel rundet auf eine Nachkommastelle, damit Fließkomma-Rauschen keine zwei Klassen aus
     einem Wert macht. */
  const haeufigster = (werte) => {
    const zaehler = {};
    // SVG rounding can produce both -0.0 and 0.0 for a centered label.
    // They are the same measured offset, so they must share one reference bucket.
    for (const v of werte){ const k = String(Number(v.toFixed(1))); zaehler[k] = (zaehler[k] || 0) + 1; }
    let besterK = null, besteN = 0;
    for (const k of Object.keys(zaehler)) if (zaehler[k] > besteN){ besteN = zaehler[k]; besterK = k; }
    return { wert: besterK === null ? null : parseFloat(besterK), anzahl: besteN };
  };
  const natuerlich = {};
  const uebersprungen = [];
  for (const art of [...new Set(namen.map(x => l.flaechen[x.eigenNr].art))]){
    const gleiche = namen.filter(x => l.flaechen[x.eigenNr].art === art);
    const dy = haeufigster(gleiche.map(x => x.box.y - l.flaechen[x.eigenNr].b.y));
    const dx = haeufigster(gleiche.map(x => (x.box.x + x.box.w/2) - (l.flaechen[x.eigenNr].b.x + l.flaechen[x.eigenNr].b.w/2)));
    if (gleiche.length < 3 || dy.anzahl < 3 || dx.anzahl < 3){ uebersprungen.push(art + ' (' + gleiche.length + ')'); continue; }
    natuerlich[art] = { dy: dy.wert, dx: dx.wert };
  }
  const versaeumt = [];
  let geprueft = 0;
  for (const x of l.labels){
    const draufliegend = l.flaechen.filter(f => f.nr !== x.eigenNr && schneidet(x.box, f.b));
    if (!draufliegend.length) continue;
    const eigenF = x.eigenNr >= 0 ? l.flaechen[x.eigenNr] : null;
    const n = eigenF ? natuerlich[eigenF.art] : null;
    if (!eigenF || !n) continue;   // ohne gemessene Ausgangslage keine Aussage - lieber nichts sagen als falsch
    geprueft++;
    // Ausgangslage: die Endlage um den gemessenen Versatz zurückgeschoben.
    const versatzY = (x.box.y - eigenF.b.y) - n.dy;
    const versatzX = ((x.box.x + x.box.w/2) - (eigenF.b.x + eigenF.b.w/2)) - n.dx;
    const start = { x: x.box.x - versatzX, y: x.box.y - versatzY, w: x.box.w, h: x.box.h };
    const richtung = (start.y + start.h/2 >= eigenF.b.y + eigenF.b.h/2) ? 1 : -1;
    const plaetze = [];
    for (let v = 1; v <= 2; v++) plaetze.push({ dy: richtung*7*v, dx: 0 });
    for (let v = 1; v <= 2; v++) plaetze.push({ dy: -richtung*7*v, dx: 0 });
    for (const s of [8, -8, 12, -12]) plaetze.push({ dy: 0, dx: s });
    const andere = l.labels.filter(y => y !== x).map(y => y.box);
    /* Das EIGENE Objekt zählt bei einem verschobenen Platz mit - genau wie in der Umsetzung.
       Ohne diese Zeile hatte diese Prüfung denselben blinden Fleck wie der erste Entwurf der
       Regel selbst und meldete "2 Plätze frei" für Stellen, an denen die eigene Planetenscheibe
       liegt (gemessen am 07.09.2026). Ein Wächter, der eine andere Regel prüft als die, die
       gilt, ist schlimmer als keiner. */
    const frei = plaetze.filter(p => {
      const k = { x: start.x + p.dx, y: start.y + p.dy, w: start.w, h: start.h };
      const versetzt = !!(p.dx || p.dy);
      return !l.flaechen.some(f => (versetzt || f.nr !== x.eigenNr) && schneidet(k, f.b)) && !andere.some(a => schneidet(k, a));
    });
    if (frei.length) versaeumt.push(x.text + ' liegt auf ' + draufliegend.map(f => f.art).join('/') +
      ', obwohl ' + frei.length + ' Plätze frei sind (z. B. dy=' + frei[0].dy + ' dx=' + frei[0].dx + ')');
  }
  check('1c: liegengeblieben nur, wenn kein Platz frei war', versaeumt.length === 0,
    (versaeumt.join(' | ') || 'keine') + ' [' + geprueft + ' Beschriftungen mit Überdeckung geprüft' +
    (uebersprungen.length ? ', Arten ohne Bezugsgröße: ' + uebersprungen.join(', ') : '') + ']');

  /* 1c kann nur urteilen, wo es eine gemessene Ausgangslage gibt. Ohne diese Prüfung hier würde
     die Lücke still wachsen: Fiele die Bezugsgröße irgendwann für ALLE Arten weg, wäre 1c grün,
     ohne eine einzige Beschriftung angesehen zu haben - grün aus dem falschen Grund, und das ist
     so schlecht wie rot. Gezählt wird deshalb ausdrücklich, was 1c NICHT beurteilen konnte. */
  const uebergangen = l.labels.filter(x => {
    if (!l.flaechen.some(f => f.nr !== x.eigenNr && schneidet(x.box, f.b))) return false;
    const eigenF = x.eigenNr >= 0 ? l.flaechen[x.eigenNr] : null;
    return !eigenF || !natuerlich[eigenF.art];
  }).map(x => x.text);
  check('1g: keine überdeckte Beschriftung blieb mangels Bezugsgröße ungeprüft',
    uebergangen.length === 0, uebergangen.length ? {
      texte: uebergangen,
      lage: l.labels.filter(x => uebergangen.includes(x.text)).map(x => ({
        text: x.text, box: x.box, eigenNr: x.eigenNr,
        eigenF: l.flaechen[x.eigenNr],
        fremdeF: l.flaechen.filter(f => f.nr !== x.eigenNr && schneidet(x.box, f.b))
      }))
    } : 'keine');

  // 1d - der Rahmen
  const weit = namen.filter(x => {
    const f = l.flaechen.find(g => g.nr === x.eigenNr);
    return Math.abs((x.box.x + x.box.w/2) - (f.b.x + f.b.w/2)) > 12.5;
  }).map(x => x.text);
  check('1d: seitlicher Versatz bleibt im Rahmen (<= 12)', weit.length === 0, weit.join(' | ') || 'keine');

  // 1e - die Zuordnung
  const verirrt = [];
  for (const x of namen){
    const eigenF = l.flaechen.find(f => f.nr === x.eigenNr);
    const dEigen = abstand(x.box, eigenF);
    const naeher = l.flaechen.filter(f => f.nr !== x.eigenNr && abstand(x.box, f) < dEigen);
    if (naeher.length) verirrt.push(x.text + ' steht näher an ' + naeher[0].art);
  }
  check('1e: keine Beschriftung steht näher an einem fremden Objekt als am eigenen',
    verirrt.length === 0, verirrt.join(' | ') || 'keine');

  /* 1h ist der Wächter über genau den Fehler, den die Regel zweimal gemacht hat: Eine Beschriftung
     nach oben "über ihr eigenes Objekt hinweg" zu schieben und dabei DARAUF zu landen. Gemessen
     wird gegen den KÖRPER, nicht gegen die Gruppe - die Beschriftung ist selbst Teil ihrer Gruppe,
     deren Box sie also immer vollständig enthält, und die Prüfung wäre sonst nie grün. */
  const aufSichSelbst = namen.filter(x => {
    const v = eigenVergleich(x, l.flaechen[x.eigenNr]);
    return schneidet(v.textBox, v.koerperBox);
  }).map(x => {
    const f = l.flaechen[x.eigenNr];
    const vergleich = eigenVergleich(x, f);
    // Der Entflechter speichert das urspruengliche y nicht. Fuer Asteroidenkuerzel ist die
    // Renderer-Formel cy + Ringradius + 7 ablesbar; die SVG-Werte sind bereits gerundet,
    // deshalb getrennt als naeherungsweise Rekonstruktion ausweisen.
    const asteroidRing = /data-map-asteroid/.test(f.art) && f.koerper.tag === 'circle';
    return { text: x.text, textBox: x.box, eigenInk: x.eigenInk, koerperBox: f.b,
      koerperInk: f.koerperInk, vergleich, koerper: f.koerper,
      polygonBoxen: f.polygone, font: x.font, glyphen: x.glyphen, finalY: x.finalY, transform: x.transform,
      urspruenglichesY: null,
      ausgangsYRekonstruiert: asteroidRing ? +(Number(f.koerper.cy) + Number(f.koerper.r) + 7).toFixed(1) : null,
      ueberlappungsHoehe: Math.min(vergleich.textBox.y + vergleich.textBox.h, vergleich.koerperBox.y + vergleich.koerperBox.h) -
        Math.max(vergleich.textBox.y, vergleich.koerperBox.y) };
  });
  check('1h: keine Beschriftung liegt auf dem Körper ihres eigenen Objekts',
    aufSichSelbst.length === 0, aufSichSelbst.length ? aufSichSelbst : 'keine');

  check('1f: keine Skriptfehler beim Zeichnen', fehler.length === 0, fehler.slice(0, 2).join(' | ') || 'keine');

  } catch (error) { evidence.setupError = error.stack || String(error); throw error; }
  finally {
    try { await preserveAssetEvidence(page, evidence); }
    finally { if (ctx) await ctx.close(); if (browser) await browser.close(); }
  }

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = soll.filter(n => ergebnis[n] === false);
    console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' der Pflichtliste gefallen (' +
      soll.map(n => n + '=' + (ergebnis[n] === false ? 'rot' : 'gruen')).join(' ') + ')');
    if (gefallen.length !== soll.length){
      console.log('FAIL - Gegenprobe unvollstaendig: ' + soll.filter(n => ergebnis[n] !== false).join(', ') + ' blieben gruen');
      process.exitCode = 1;
      return;
    }
    process.exitCode = 0;
    return;
  }
  ende();
})().catch(e => { console.error('FAIL - Abbruch:', e); process.exit(1); });
