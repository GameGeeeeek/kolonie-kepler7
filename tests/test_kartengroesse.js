// Größe der Planetendarstellung in der geöffneten Systemebene (Etappe KB-12, Spieler-Report Sascha
// mit Screenshot: "Also die Karte ist wirklich extrem mini, also noch noch kleiner und ich brauch
// echt eine Lupe. Kannst Du das mal bitte anpassen, dass die genauso groß ist wie die Karte davor?").
//
// WAS HIER GEPRÜFT WIRD - und warum ausgerechnet das
// --------------------------------------------------
// KB-10 und KB-11 haben beide an der KASTENHÖHE bzw. am Skala-Deckel gedreht und beide Male war die
// Karte danach immer noch zu klein. Der Grund ist geometrisch: Die Systemebene zeichnete einen
// 600×180 Einheiten breiten STREIFEN (Orbits rx = 42+orbit*43, Ellipsen ry = rx*0,3). Wer auf einem
// ~348 px breiten Handy-Kasten alle Planeten zeigen will, kann damit höchstens 0,85 vergrößern -
// EGAL wie hoch der Kasten ist, denn begrenzend ist die BREITE. Deshalb misst dieser Test die einzige
// Größe, um die es dem Spieler ging: den PLANETENDURCHMESSER IN PIXELN auf dem Gerät.
// Am Stand vor KB-12 sind das 12 px, danach 20 px.
//
// Und er misst die Gegenrichtung mit, weil sie beim Bauen tatsächlich schiefging: Die rundere Form
// braucht einen höheren Kasten - wird der aber AUCH am breiten PC-Kasten hochgezogen (dort gilt
// weiter die flache Zeichnung), entsteht wieder toter Raum, und die Kastenmitte rutscht unter den
// Fensterrand. Gemessen: 325 -> 480 px Kastenhöhe, `elementFromPoint` auf der Kastenmitte lieferte
// null, das Ziehen der Karte kam gar nicht mehr an (test_kartenbedienung 2a/2b, Treue 1 -> 0).
// Prüfung 3 hält genau das fest.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_kartengroesse.js
//   rot:   am Stand VOR KB-12 - Prüfung 1 meldet 12 px statt >= 16,
//          Prüfung 2 ein flaches Kastenverhältnis:
//          KEPLER_SPIELDATEI=/tmp/vor_kb12.html node tests/test_kartengroesse.js
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
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

function spielstand() {
  const now = Date.now();
  return JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, missions: [] }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    // Ereignis-Uhr in die Zukunft pinnen (Hausregel 18) - der erste Planeten-Ereignis-Check feuert
    // sonst GARANTIERT und schreibt mitten in der Messung Boxen neu.
    nextPlanetEventCheck: now + 3600000
  });
}

// Öffnet das Heimatsystem auf dem angegebenen Viewport und misst die Darstellung.
async function messeSystem(browser, store, viewport, mobil) {
  const ctx = await browser.newContext(Object.assign({ viewport }, mobil ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}));
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
  await oeffneSystemUeberSektoren(page, 'kepler');
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const wrap = document.querySelector('#tab-karte .map-wrap').getBoundingClientRect();
    // Gemessen wird die SCHEIBE, nicht die Gruppe: Das Umriss-Rechteck von .planet-node enthält die
    // Beschriftung und hinge damit an der Schriftgröße statt an der Kartengeometrie (dieselbe Falle
    // wie in test_kartenbedienung, Punkt a).
    //
    // Die Scheibe ist je nach Planetentyp ein <image> (Textur, über eine clipPath-Maske) oder ein
    // circle.body - beides ist genau r*2 breit. Nach dem r-Attribut zu suchen wäre falsch: Die
    // clipPath-MASKE trägt denselben Radius, liegt aber in <defs> und liefert ein leeres Rechteck
    // bei 0/0. Genau daran hat dieser Test beim ersten Lauf 7 von 8 Planeten als "außerhalb des
    // Kastens" gemeldet - am PC-Stand ebenso, wo sich gar nichts geändert hatte.
    let groesste = 0, anzahl = 0, draussen = 0;
    document.querySelectorAll('#galaxyMapSvg .planet-node').forEach(g => {
      const c = g.querySelector('image') || g.querySelector('circle.body');
      if (!c) return;
      const b = c.getBoundingClientRect();
      anzahl++;
      groesste = Math.max(groesste, b.width);
      if (b.left < wrap.left - 2 || b.right > wrap.right + 2 || b.top < wrap.top - 2 || b.bottom > wrap.bottom + 2) draussen++;
    });
    // Liegt die Mitte des Kartenkastens überhaupt im Fenster? Nur dort kommt ein Zeiger-Ereignis an.
    const mx = wrap.left + wrap.width / 2, my = wrap.top + wrap.height / 2;
    const imFenster = mx >= 0 && my >= 0 && mx <= window.innerWidth && my <= window.innerHeight;
    const unterMitte = imFenster ? document.elementFromPoint(mx, my) : null;
    return {
      durchmesserPx: Math.round(groesste), planeten: anzahl, draussen,
      kasten: { w: Math.round(wrap.width), h: Math.round(wrap.height) },
      verhaeltnis: +(wrap.height / wrap.width).toFixed(3),
      mitteImFenster: imFenster,
      mitteTrifft: unterMitte ? (unterMitte.id || unterMitte.tagName) : null,
      viewBox: svg ? svg.getAttribute('viewBox') : null
    };
  });
  m.fehler = fehler.slice(0, 2);
  await ctx.close();
  return m;
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  store['kepler7-save-v3'] = spielstand();

  // ---- Handy (Report-Gerät: 390×844) ----------------------------------------------------------
  const handy = await messeSystem(browser, store, { width: 390, height: 844 }, true);
  check('0-vorab: Handy - Boot ohne Skriptfehler', handy.fehler.length === 0, handy.fehler);
  check('0-vorab: Handy - die Planeten des Systems sind gezeichnet', handy.planeten >= 4, handy);

  // 16 px ist bewusst kein Wunschwert, sondern die MITTE zwischen gemessen 12 (vorher) und 20
  // (nachher): Der Test hält die REGEL fest ("deutlich größer als der Streifen es zuließ"), nicht
  // die Momentaufnahme einer Zahl, die sich beim nächsten Feinschliff um ein Pixel verschiebt
  // (Hausregel 3).
  check('1: die Planetenscheibe ist am Handy deutlich größer als vor KB-12 (>= 16 px)',
    handy.durchmesserPx >= 16, handy);
  check('1b: dabei fällt kein Planet aus dem Kartenkasten', handy.draussen === 0, handy);

  // Die rundere Bahnform und die höhere Kastenform gehören zusammen - fehlt eine der beiden,
  // beschneidet die Kamera den Inhalt oben und unten, statt ihn zu vergrößern.
  check('2: der Kartenkasten ist am Handy hoch genug für die runden Bahnen (h/b >= 0,6)',
    handy.verhaeltnis >= 0.6, handy);

  // ---- PC (breiter Kasten: dort gilt weiter die flache Zeichnung) ------------------------------
  const pc = await messeSystem(browser, store, { width: 900, height: 1000 }, false);
  check('0-vorab: PC - Boot ohne Skriptfehler', pc.fehler.length === 0, pc.fehler);
  check('3: der PC-Kasten bleibt flach (h/b <= 0,5) - sonst wieder toter Raum',
    pc.verhaeltnis <= 0.5, pc);
  // Das eigentliche Schadensbild der zu hohen Fassung: Die Kastenmitte lag unterhalb des Fensters,
  // ein Zeiger-Ereignis dort erreichte gar nichts mehr und das Ziehen der Karte war tot.
  check('3b: die Mitte des PC-Kartenkastens liegt im Fenster und trifft die Karte',
    pc.mitteImFenster && pc.mitteTrifft !== null, pc);

  await ende(async () => browser.close());
})();
