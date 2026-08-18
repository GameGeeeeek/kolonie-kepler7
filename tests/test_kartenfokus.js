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
// GEPRÜFT WIRD DIE REGEL, NICHT DIE FARBE: Verlangt wird ein deutlicher Helligkeitsabstand zum
// gemessenen Kartenhintergrund - ein Wechsel des Blautons darf den Test nicht reißen, ein Rückfall
// auf den fast-schwarzen Default schon (Hausregel 3).
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_kartenfokus.js
//   rot:   am Stand vor KB-15 - Prüfung 1 meldet outlineColor rgb(16,16,16) und einen
//          Helligkeitsabstand nahe null: KEPLER_SPIELDATEI=/tmp/vor_kb15.html node tests/…
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSektorMitSystem } = require('./lib/karte');
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

// Wahrgenommene Helligkeit einer rgb()-Farbe (0..255). Bewusst die einfache Rec.601-Gewichtung -
// es geht um "hebt sich ab", nicht um eine Farbmetrik.
function helligkeit(rgbText) {
  const m = String(rgbText || '').match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return null;
  return 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
}

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

  // WORAN "sichtbar" gemessen wird - und warum nicht am Hintergrund:
  // Der erste Anlauf verglich die Ringfarbe mit der Hintergrundfarbe des Kartenkastens. Der ist
  // aber TRANSPARENT, und die ganze Elternkette bis zum body ebenso: Die Seite malt ihren Grund
  // über die Canvas-Leinwände #bgnebel/#bgstars, nicht über CSS. Der Vergleich lief damit gegen
  // eine Farbe, die gar nichts malt (zufällig "schwarz") - grün aus dem halb richtigen Grund
  // (Hausregel 21). Es gibt hier schlicht keine CSS-Bezugsfarbe zu messen.
  //
  // Gemessen wird deshalb gegen den BROWSER-DEFAULT, der das eigentliche Problem war:
  //   outline-style: auto · outline-color: rgb(16,16,16)  -> Helligkeit 16, auf dunklem Grund tot.
  // Verlangt werden zwei Dinge, die zusammen genau diesen Fall ausschließen: eine EXPLIZIT gesetzte
  // outline (style !== 'auto') und eine Farbe, die auf dunklem Grund trägt (Helligkeit >= 90).
  // Das ist die Regel, nicht die Farbe - jedes gut sichtbare Blau, Cyan oder Weiß erfüllt sie.
  const HELL_MIN = 90;
  const grundlos = await page.evaluate(() => {
    let el = document.querySelector('#tab-karte .map-wrap'), kette = [];
    while (el && kette.length < 8) {
      kette.push(getComputedStyle(el).backgroundColor);
      el = el.parentElement;
    }
    return kette;
  });
  check('0-vorab: die Karte hat wirklich keinen eigenen CSS-Hintergrund (Bezug ist der Default-Ring)',
    grundlos.every(f => /rgba\(0, 0, 0, 0\)/.test(f)), { kette: grundlos });

  // Misst einen Knoten: Fokus setzen, Stil ablesen, Pixel vor/nach vergleichen.
  async function messeKnoten(selektor) {
    const svg = await page.$('#galaxyMapSvg');
    if (!svg) return { fehlt: true };
    await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); });
    await page.waitForTimeout(150);
    const ruhe = await svg.screenshot();
    const stil = await page.evaluate(sel => {
      const g = document.querySelector(sel);
      if (!g) return null;
      g.focus();
      const cs = getComputedStyle(g);
      return { visible: g.matches(':focus-visible'), color: cs.outlineColor,
               width: parseFloat(cs.outlineWidth) || 0, style: cs.outlineStyle };
    }, selektor);
    if (!stil) return { fehlt: true };
    await page.waitForTimeout(250);
    const fokus = await svg.screenshot();
    return Object.assign(stil, { pixelGeaendert: Buffer.compare(ruhe, fokus) !== 0 });
  }

  // ---- 1) Übersicht: die Regionen ---------------------------------------------------------------
  const region = await messeKnoten('#galaxyMapSvg [data-sektor]');
  check('1-vorab: ein Regionsknoten ist da und nimmt den Fokus', !region.fehlt && region.visible === true, region);
  const hellRegion = region.color ? helligkeit(region.color) : 0;
  check('1: der Fokusring der Region ist explizit gesetzt und auf dunklem Grund sichtbar',
    region.width > 0 && region.style !== 'auto' && hellRegion >= HELL_MIN,
    { ring: region.color, helligkeit: Math.round(hellRegion), mindestens: HELL_MIN, stil: region.style, breite: region.width });
  check('1b: und er wird wirklich gemalt (Pixel ändern sich)', region.pixelGeaendert === true, region);

  // ---- 2) Sektoransicht: Systemknoten und Ebenen-Knöpfe -----------------------------------------
  await oeffneSektorMitSystem(page, 'kepler');
  await page.waitForTimeout(600);

  const sysKnoten = await messeKnoten('#galaxyMapSvg [data-sektor-sys]');
  const hellSys = sysKnoten.color ? helligkeit(sysKnoten.color) : 0;
  check('2-vorab: ein Systemknoten ist da und nimmt den Fokus', !sysKnoten.fehlt && sysKnoten.visible === true, sysKnoten);
  check('2: der Fokusring des Systemknotens ist explizit gesetzt und sichtbar',
    sysKnoten.width > 0 && sysKnoten.style !== 'auto' && hellSys >= HELL_MIN,
    { ring: sysKnoten.color, helligkeit: Math.round(hellSys), stil: sysKnoten.style, breite: sysKnoten.width });

  const ebenenKnopf = await messeKnoten('#galaxyMapSvg [data-kb-knopf]');
  const hellKnopf = ebenenKnopf.color ? helligkeit(ebenenKnopf.color) : 0;
  check('3-vorab: ein Ebenen-Knopf ist da und nimmt den Fokus', !ebenenKnopf.fehlt && ebenenKnopf.visible === true, ebenenKnopf);
  check('3: der Fokusring des Ebenen-Knopfes ist explizit gesetzt und sichtbar',
    ebenenKnopf.width > 0 && ebenenKnopf.style !== 'auto' && hellKnopf >= HELL_MIN,
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
               visible: a.matches(':focus-visible'), color: cs.outlineColor, width: parseFloat(cs.outlineWidth) || 0 };
    });
  }
  check('4: mit Tab erreicht man einen Kartenknoten, und der Ring ist dort sichtbar',
    !!getabbt && getabbt.visible === true && getabbt.width > 0
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
