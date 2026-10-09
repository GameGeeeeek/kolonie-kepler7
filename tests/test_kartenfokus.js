// Sichtbarer Tastatur-Fokus auf den Kartenknoten (Etappe KB-15, Anschluss an die Pfeiltasten-
// Bedienung aus KB-14).
//
// DER BEFUND, DEN DIESER TEST FESTHÄLT - und warum er anders lautet als vermutet
// ------------------------------------------------------------------------------
// Die drei tastaturerreichbaren Knotenarten im Karten-SVG tragen längst role="button",
// tabindex="0" und ein aria-label. Vermutet worden war "es gibt gar keinen Fokusring"; gemessen
// liefert getComputedStyle auf dem fokussierten <g> aber
//     outline-style: auto · outline-width: 5px · outline-color: rgb(16,16,16)
// Es GIBT also einen Ring - den des Browsers, in fast schwarz, und damit auf dem dunklen
// Kartenhintergrund unsichtbar. Das Problem war die Farbe, nicht das Fehlen. Deshalb prüft dieser
// Test nicht "eine outline ist gesetzt" (das wäre schon vorher grün gewesen), sondern ob sich der
// Ring vom Hintergrund ABHEBT.
//
// GEPRÜFT WIRD DIE REGEL, NICHT DIE FARBE: Der ausdrücklich geprüfte dunkle Hintergrundvertrag
// begründet die unveränderte Mindesthelligkeit des Rings. Das ist keine gemessene Kontrastquote;
// die Ringfarbe wird mit einfacher Rec.601-Helligkeit geprüft. Ein anderer heller Blauton bleibt
// erlaubt, der fast-schwarze Browser-Default bleibt rot (Hausregel 3).
//
// Normalprüfung: node tests/http-run.js test_kartenfokus.js
// Kontrollierte Gegenproben: node tools/check-map-focus-counterexamples.cjs [Fallnamen]
// Der Kontrolllauf verlangt jeweils nur die vorgesehenen roten Wächter und alle anderen grün.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSektorMitSystem } = require('./lib/karte');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;
const HINTERGRUND_LABEL = '0-vorab: dunkler Kartenhintergrund folgt dem Kommandovertrag';
const gegenprobe = process.env.K7_MAP_FOCUS_FAULT || '';
const fehlerCss = {
  'shell-light': 'body.command-ui.command-ui .shell{background:#fff!important}',
  'shell-transparent': 'body.command-ui.command-ui .shell{background:transparent!important}',
  'map-white': '#tab-karte#tab-karte .map-wrap{background:#fff!important;background-image:none!important}',
  'ring-dark': '#galaxyMapSvg#galaxyMapSvg [role="button"]:focus-visible{outline-color:rgb(16,16,16)!important}',
  'ring-none': '#galaxyMapSvg#galaxyMapSvg [role="button"]:focus-visible{outline:none!important}',
  'ring-auto': '#galaxyMapSvg#galaxyMapSvg [role="button"]:focus-visible{outline:3px auto rgb(16,16,16)!important}'
};
if (gegenprobe && !Object.hasOwn(fehlerCss, gegenprobe)) throw Error('Unknown controlled map focus fault');

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

// Wahrgenommene Helligkeit einer rgb()-Farbe (0..255). Bewusst die einfache Rec.601-Gewichtung -
// es geht um "hebt sich ab", nicht um eine Farbmetrik.
function helligkeit(rgbText) {
  const m = String(rgbText || '').match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return null;
  return 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
}
// SVG computed styles can retain a nonzero outline-width even for outline-style:none.
// Require an actually painted explicit style as well as the existing width/brightness guards.
const sichtbareRingStile = new Set(['solid', 'dotted', 'dashed', 'double', 'groove', 'ridge', 'inset', 'outset']);

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

  // Der alte Transparenzvertrag erfasste nur backgroundColor und übersah schon damals die
  // Nebel-Bitmap. Die Kommandozentrale malt zusätzlich einen ausdrücklich dunklen .shell-Grund.
  // Wir prüfen beide echten Flächen, statt transparente Eltern als Kontrastfarbe zu behandeln.
  // Die ursprünglichen Prüfziele und Wächterlabels bleiben erhalten. Zusätzlich werden
  // none/hidden als unsichtbare Ringstile abgelehnt und wirklich örtliche Ringpixel gemessen;
  // die native Tab- und Mausbedienung bleibt unabhängig vom Hintergrundvertrag geprüft.
  const HELL_MIN = 90;
  if (gegenprobe) await page.addStyleTag({ content: fehlerCss[gegenprobe] });
  const hintergrund = await page.evaluate(() => {
    let el = document.querySelector('#tab-karte .map-wrap');
    const kette = [];
    while (el) {
      const cs = getComputedStyle(el);
      const farbe = cs.backgroundColor.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
      kette.push({
        selektor: el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].join('.'),
        shell: el.classList.contains('shell'),
        farbe: cs.backgroundColor, bild: cs.backgroundImage,
        rgba: farbe ? { r: +farbe[1], g: +farbe[2], b: +farbe[3], a: farbe[4] === undefined ? 1 : +farbe[4] } : null
      });
      el = el.parentElement;
    }
    const shellIndex = kette.findIndex(e => e.shell);
    const shell = kette[shellIndex], map = kette[0];
    const bildMatch = map && map.bild.match(/^url\(["']?([^"')]+)["']?\)$/);
    const bildUrl = bildMatch ? new URL(bildMatch[1], location.href) : null;
    const shellDunkel = shell && shell.rgba && shell.rgba.r === 8 && shell.rgba.g === 14
      && shell.rgba.b === 28 && shell.rgba.a >= 0.92;
    const farbVertrag = shellIndex > 0 && kette.filter(e => e.shell).length === 1
      && kette.every((e, i) => e.rgba && (i === shellIndex ? shellDunkel : e.rgba.a === 0));
    const bildVertrag = !!bildUrl && bildUrl.origin === location.origin
      && bildUrl.pathname.endsWith('/kepler-gfx-nebula.png')
      // HTML-/Body-Verläufe liegen unter der mindestens 92% deckenden dunklen .shell.
      // Zwischen .shell und Bitmap darf keine weitere gemalte Hintergrundbildfläche liegen.
      && kette.slice(1, shellIndex + 1).every(e => e.bild === 'none');
    return { command: document.body.classList.contains('command-ui'), farbVertrag, bildVertrag, kette };
  });
  if (hintergrund.command) {
    check(HINTERGRUND_LABEL, hintergrund.farbVertrag && hintergrund.bildVertrag, hintergrund);
  } else {
    // Historische vor-HUD-Gegenkopien behalten die ursprüngliche positive Transparenzprämisse.
    // Die Wahl hängt ausdrücklich an body.command-ui, nicht an zufällig fehlenden Bedienelementen.
    const grundlos = hintergrund.kette.slice(0, 8).map(e => e.farbe);
    check('0-vorab: die Karte hat wirklich keinen eigenen CSS-Hintergrund (Bezug ist der Default-Ring)',
      grundlos.length > 0 && grundlos.every(f => /rgba\(0, 0, 0, 0\)/.test(f)), { kette: grundlos });
  }

  // Misst einen Knoten: Fokus setzen, Stil ablesen, Pixel vor/nach vergleichen.
  async function messeKnoten(selektor) {
    const svg = await page.$('#galaxyMapSvg');
    if (!svg) return { fehlt: true };
    await page.mouse.move(0, 0);
    await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await page.waitForTimeout(150);
    const ruhe = await svg.screenshot();
    const geometrie = () => page.evaluate(sel => {
      const svg = document.getElementById('galaxyMapSvg'), g = document.querySelector(sel);
      if (!svg || !g) return null;
      const rect = e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
      const v = svg.viewBox.baseVal;
      return { svg:rect(svg), knoten:rect(g), scroll:[scrollX,scrollY], viewBox:[v.x,v.y,v.width,v.height], hover:svg.matches(':hover') };
    }, selektor);
    const vorher = await geometrie();
    const stil = await page.evaluate(sel => {
      const g = document.querySelector(sel);
      if (!g) return null;
      // The paint comparison measures the ring, not a focus-triggered page scroll.
      // Real keyboard scrolling remains exercised independently by the native Tab path below.
      g.focus({ preventScroll: true });
      const cs = getComputedStyle(g);
      return { visible: g.matches(':focus-visible'), color: cs.outlineColor,
               width: parseFloat(cs.outlineWidth) || 0, style: cs.outlineStyle, offset:parseFloat(cs.outlineOffset) || 0 };
    }, selektor);
    if (!stil) return { fehlt: true };
    await page.waitForTimeout(250);
    const fokus = await svg.screenshot();
    const nachher = await geometrie();
    const geometrieGleich = !!vorher && JSON.stringify(vorher) === JSON.stringify(nachher) && vorher.hover === false;
    // Comparing encoded PNG buffers for the entire SVG also sees unrelated moving decoration.
    // Decode the actual screenshots without touching the app. Only new outline-colored paint
    // outside this node's box can witness its ring; its existing content is outside the metric.
    const pixel = await page.evaluate(async ({a,b,pose,color,width,offset}) => {
      if (!pose) return { neueRingpixel:0, kanten:[] };
      const decode = async base64 => {
        const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], {type:'image/png'}));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap,0,0);const image = ctx.getImageData(0,0,bitmap.width,bitmap.height);bitmap.close();return image;
      };
      const before = await decode(a), after = await decode(b);
      const rgb = color.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      if (!rgb || before.width !== after.width || before.height !== after.height) return { neueRingpixel:0, kanten:[] };
      const c = rgb.slice(1).map(Number), sx=after.width/pose.svg[2], sy=after.height/pose.svg[3];
      const left=(pose.knoten[0]-pose.svg[0])*sx, top=(pose.knoten[1]-pose.svg[1])*sy;
      const right=left+pose.knoten[2]*sx, bottom=top+pose.knoten[3]*sy;
      const band=(Math.max(0,offset)+width+1)*Math.max(sx,sy), edges=new Set();let count=0;
      for (let y=Math.max(0,Math.floor(top-band));y<Math.min(after.height,Math.ceil(bottom+band));y++)
        for (let x=Math.max(0,Math.floor(left-band));x<Math.min(after.width,Math.ceil(right+band));x++) {
          const px=x+.5,py=y+.5;if(px>=left&&px<=right&&py>=top&&py<=bottom)continue;
          const i=(y*after.width+x)*4;
          if(after.data[i+3]===0||!c.every((v,k)=>Math.abs(after.data[i+k]-v)<=1))continue;
          if(c.every((v,k)=>Math.abs(before.data[i+k]-v)<=1)&&before.data[i+3]===after.data[i+3])continue;
          count++;if(px<left)edges.add('links');if(px>right)edges.add('rechts');if(py<top)edges.add('oben');if(py>bottom)edges.add('unten');
        }
      return { neueRingpixel:count, kanten:[...edges] };
    }, {a:ruhe.toString('base64'),b:fokus.toString('base64'),pose:nachher,color:stil.color,width:stil.width,offset:stil.offset});
    return Object.assign(stil, { pixelGeaendert:geometrieGleich && pixel.neueRingpixel > 0,
      geometrieGleich, vorher, nachher, pixel });
  }

  // ---- 1) Übersicht: die Regionen ---------------------------------------------------------------
  const region = await messeKnoten('#galaxyMapSvg [data-sektor]');
  check('1-vorab: ein Regionsknoten ist da und nimmt den Fokus', !region.fehlt && region.visible === true, region);
  const hellRegion = region.color ? helligkeit(region.color) : 0;
  check('1: der Fokusring der Region ist explizit gesetzt und auf dunklem Grund sichtbar',
    region.width > 0 && sichtbareRingStile.has(region.style) && hellRegion >= HELL_MIN,
    { ring: region.color, helligkeit: Math.round(hellRegion), mindestens: HELL_MIN, stil: region.style, breite: region.width });
  check('1b: und er wird wirklich gemalt (Pixel ändern sich)', region.pixelGeaendert === true, region);

  // ---- 2) Sektoransicht: Systemknoten und Ebenen-Knöpfe -----------------------------------------
  await oeffneSektorMitSystem(page, 'kepler');
  await page.waitForTimeout(600);

  const sysKnoten = await messeKnoten('#galaxyMapSvg [data-sektor-sys]');
  const hellSys = sysKnoten.color ? helligkeit(sysKnoten.color) : 0;
  check('2-vorab: ein Systemknoten ist da und nimmt den Fokus', !sysKnoten.fehlt && sysKnoten.visible === true, sysKnoten);
  check('2: der Fokusring des Systemknotens ist explizit gesetzt und sichtbar',
    sysKnoten.width > 0 && sichtbareRingStile.has(sysKnoten.style) && hellSys >= HELL_MIN,
    { ring: sysKnoten.color, helligkeit: Math.round(hellSys), stil: sysKnoten.style, breite: sysKnoten.width });

  const ebenenKnopf = await messeKnoten('#galaxyMapSvg [data-kb-knopf]');
  const hellKnopf = ebenenKnopf.color ? helligkeit(ebenenKnopf.color) : 0;
  check('3-vorab: ein Ebenen-Knopf ist da und nimmt den Fokus', !ebenenKnopf.fehlt && ebenenKnopf.visible === true, ebenenKnopf);
  check('3: der Fokusring des Ebenen-Knopfes ist explizit gesetzt und sichtbar',
    ebenenKnopf.width > 0 && sichtbareRingStile.has(ebenenKnopf.style) && hellKnopf >= HELL_MIN,
    { ring: ebenenKnopf.color, helligkeit: Math.round(hellKnopf), stil: ebenenKnopf.style, breite: ebenenKnopf.width });

  // ---- 4) Echtes Tabben erreicht die Knoten -----------------------------------------------------
  // Nicht nur programmatisches focus(): Erst das bestätigt, dass der Ring auf dem WEG erscheint,
  // den ein Spieler ohne Maus wirklich geht.
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.focus(); });
  let tabs = 0, getabbt = null;
  while (tabs < 60 && !getabbt) {
    await page.keyboard.press('Tab'); tabs++;
    getabbt = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || !a.closest || !a.closest('#galaxyMapSvg')) return null;
      const cs = getComputedStyle(a);
      return { was: a.getAttribute('data-sektor-sys') || a.getAttribute('data-sektor') || a.getAttribute('data-kb-knopf'),
               visible: a.matches(':focus-visible'), color: cs.outlineColor, width: parseFloat(cs.outlineWidth) || 0, style:cs.outlineStyle };
    });
  }
  check('4: mit Tab erreicht man einen Kartenknoten, und der Ring ist dort sichtbar',
    !!getabbt && getabbt.visible === true && getabbt.width > 0 && sichtbareRingStile.has(getabbt.style)
      && helligkeit(getabbt.color) >= HELL_MIN,
    { tabs, getabbt });

  // ---- 5) GEGENRICHTUNG: ein Mausklick hinterlässt keinen stehenden Ring ------------------------
  // Ohne diese Prüfung könnte man Prüfung 1-4 erfüllen, indem man :focus statt :focus-visible
  // nimmt - dann bekäme jeder Klick auf ein System einen Ring, der bis zum nächsten Klick bleibt.
  await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
  await oeffneSektorMitSystem(page, 'kepler');
  await page.waitForTimeout(400);
  const knopf = await page.$('#galaxyMapSvg [data-sektor-sys]');
  const box = knopf ? await knopf.boundingBox() : null;
  check('5-vorab: ein Systemknoten ist anklickbar', !!box, { box });
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);
    const nachKlick = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || !a.closest || !a.closest('#galaxyMapSvg')) return { imSvg: false };
      return { imSvg: true, visible: a.matches(':focus-visible'), width: parseFloat(getComputedStyle(a).outlineWidth) || 0 };
    });
    check('5: nach einem Mausklick steht kein Fokusring auf der Karte',
      nachKlick.imSvg === false || nachKlick.visible === false, nachKlick);
  }

  check('6: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
