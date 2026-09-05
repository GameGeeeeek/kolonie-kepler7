// Sieben kleine Grafikfehler aus der Grafik-Aufnahme vom 04./05.09.2026 (GR-9) - jeder gemessen,
// keiner vermutet:
//
//   1  WAPPEN-RIESENHELM. `.map-wrap svg { width:100%; height:100% }` traf jedes svg IM Kasten,
//      auch das verschachtelte 14x14-Wappen am Knoten. Es wurde auf Kastengroesse gezogen und lag
//      als halbtransparenter Helm ueber einem Viertel der Sektorkarte. Jetzt `.map-wrap > svg`.
//   2  GUERTELPLATZ AUF DEM PLANETEN. Platz 5 (198 Grad) lag auf dem Bahnwinkel des dritten Orbits
//      (-160 = 200 Grad); am flachen Ellipsenende sind das 21 px radialer Abstand - Aion sass in
//      Kepler auf dem Vorkommen. Jetzt weicht ein Platz auf einem Planetenwinkel AUF SEINER BAHN
//      aus, um 14 Grad nach oben. Der Ausweicher hat zwei Haelften, und beide werden geprueft:
//      er muss den betroffenen Platz verschieben (2d) und darf einen UNGUELTIGEN Ort nicht in
//      einen gueltigen verwandeln (2e) - eine Asteroidenfestung ohne Platz ergibt NaN, und die
//      erste Fassung machte daraus 214 Grad, wodurch die Bastion sichtbar neben Aion erschien
//      (gefunden vom Prueflauf am 05.09.2026: test_kartenbeschriftung fiel vierfach).
//   3  BANNERPLANET AM HANDY. preserveAspectRatio "xMidYMid slice" schnitt bei voller Bannerhoehe
//      auf 348-390 px Breite genau den Planeten (cx 590 von 720) weg. Jetzt xMaxYMid.
//   4  NEBEL DES ORBITALGLAS-HIMMELS mit 5 % Deckkraft: nicht vorhanden. Jetzt 14 %.
//   5  ORBIT-BAHNEN AM HANDY: 0,10 Deckkraft bei 0,6 px Strich - weg. Am Handy jetzt 0,18.
//   6  WRACKS trugen die Klasse (s.k) statt des Atlas-Schluessels des lebenden Schiffs (s.modell)
//      und fielen deshalb als roter Polygon-Rueckfall. Jetzt s.modell || s.k.
//   7  KAMPFORT einer terraformten Welt war die ALTE Oberflaeche (PLANETS[].type statt
//      effectivePlanetType).
//
// 6 und 7 liegen in der Kapsel der Wiedergabe (Wiedergabe = (function(){ ... })()) und sind von
// aussen nicht messbar; sie werden am Quelltext geprueft, mit Anker, dass die Stelle existiert.
// Alles andere wird im Browser gemessen.
//
// GEGENPROBE (beide Richtungen, 05.09.2026):
//   gruen: node tests/test_grafik_einzeiler.js
//   rot:   git show origin/main:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_SPIELDATEI=/tmp/alt.html KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_grafik_einzeiler.js
//   Am alten Stand fallen 10 von 24: 1b, 2b, 2d-anker, 2d-anker2, 3b, 4b, 5a, 5b, 6b, 7b - 5a mit,
//   weil die Bahnen dort noch keine data-sys-bahn-Kennung tragen (gemessen 05.09.2026). Die Anker
//   1a, 2a, 3a, 4a, 6a, 7a bleiben gruen.
//   Die Prueflisten beider Laeufe sind bewusst NICHT deckungsgleich: 2d, 2e und 2f laufen am alten
//   Stand gar nicht, weil es guertelWinkelFuer dort nicht gibt - genau das meldet 2d-anker. Eine
//   Pruefung ueber einer fehlenden Funktion waere sonst still gruen (Hausregel: vacuous).
//   ZWEITE GEGENPROBE, nur fuer 2e: dieselbe Datei mit entfernter Zeile
//   `if (!Number.isFinite(grad)) return grad;` - dann faellt genau 2e mit {ausNaN: 214}, alles
//   andere bleibt gruen (gemessen 05.09.2026).
const fs = require('fs');
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI, pruefer, versionAbfangen } = require('./lib/umgebung');
const { oeffneSektorMitSystem, oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;
const S = fs.readFileSync(SPIELDATEI, 'utf8');

/* ---- Quelltext: die Kapsel der Wiedergabe --------------------------------------------------- */
const wrackVon = S.indexOf('wracks.push({');
const wrackBis = wrackVon < 0 ? -1 : S.indexOf('});', wrackVon);
check('6a: wracks.push ist im Quelltext auffindbar', wrackVon > 0 && wrackBis > wrackVon);
const wrackBlock = wrackVon > 0 && wrackBis > wrackVon ? S.slice(wrackVon, wrackBis) : '';
check('6b: das Wrack traegt den Atlas-Schluessel des lebenden Schiffs (s.modell), nicht nur die Klasse',
  /k:\s*s\.modell\s*\|\|\s*s\.k/.test(wrackBlock), { auszug: wrackBlock.replace(/\s+/g, ' ').slice(0, 120) });

const ortVon = S.indexOf('ortTyp:        function(k, eigenerOrt){');
const ortBis = ortVon < 0 ? -1 : S.indexOf('\n          },', ortVon);
check('7a: die ortTyp-Funktion der Wiedergabe ist auffindbar', ortVon > 0 && ortBis > ortVon);
const ortBlock = ortVon > 0 && ortBis > ortVon ? S.slice(ortVon, ortBis) : '';
/* Die zweite Bedingung war leer: der verneinte Ausdruck traf nie zu, 7b haing allein am Wort
   "effectivePlanetType" - das im KOMMENTAR daneben ebenfalls steht. Jetzt wird der Kommentar
   entfernt und der ausgefuehrte Code geprueft: der Aufruf muss da sein UND am eigenen Ort haengen
   (eigenerOrt), damit der fremde Standort weiter seinen Basistyp bekommt. */
const ortCode = ortBlock.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
check('7b: der Kampfort einer terraformten Welt kommt aus effectivePlanetType, nicht aus PLANETS[].type',
  /effectivePlanetType\(k\)/.test(ortCode), { auszug: ortCode.replace(/\s+/g, ' ').slice(0, 200) });
check('7c: der eigene Ueberschreiber gilt nur am EIGENEN Ort - ein Angriffsbericht traegt den Schluessel des Verteidigers',
  /eigenerOrt/.test(ortCode) && /ortTyp\(r\.targetPlanet, true\)/.test(S) && /ortTyp\(r\.targetPlanet \|\| r\.debrisPlanet, false\)/.test(S),
  { imBlock: /eigenerOrt/.test(ortCode), raidEigen: /ortTyp\(r\.targetPlanet, true\)/.test(S),
    angriffFremd: /ortTyp\(r\.targetPlanet \|\| r\.debrisPlanet, false\)/.test(S) });
/* Und die beiden Terraform-Ziele brauchen einen eigenen Eintrag in ORT_STIL - ohne ihn faellt die
   Wiedergabe auf 'heimat' zurueck, also auf einen NEUTRALEREN Hintergrund als vor der Aenderung. */
const stilVon = S.indexOf('var ORT_STIL = {');
const stilBis = stilVon < 0 ? -1 : S.indexOf('\n    };', stilVon);
check('7d-anker: die Tabelle ORT_STIL ist auffindbar', stilVon > 0 && stilBis > stilVon);
const stilBlock = stilVon > 0 && stilBis > stilVon ? S.slice(stilVon, stilBis) : '';
check('7d: ORT_STIL kennt jedes Ziel aus TERRAFORM_TARGET_TYPES (kein Rueckfall auf heimat)',
  (() => {
    const t = (S.match(/const TERRAFORM_TARGET_TYPES = \[([^\]]*)\]/) || ['', ''])[1].match(/'([a-z]+)'/g) || [];
    const ziele = t.map(x => x.replace(/'/g, ''));
    return ziele.length >= 6 && ziele.every(z => new RegExp('^\\s+' + z + ':', 'm').test(stilBlock));
  })(),
  { ziele: (S.match(/const TERRAFORM_TARGET_TYPES = \[([^\]]*)\]/) || ['', ''])[1] });

/* ---- Quelltext: der Guertel-Ausweicher, isoliert gerechnet -----------------------------------
   Die Funktion ist reine Geometrie und haengt an nichts als ORBIT_ANGLES - deshalb wird sie hier
   aus der Spieldatei geschnitten und ausgefuehrt, statt sie im Browser zu erraten. Beide Zahlen
   (Bahnwinkel und Freiwinkel) kommen aus dem Quelltext, nicht aus dem Test: sonst pruefte der Test
   seine eigenen Annahmen (Hausregel: gegen den gemessenen Stand, nicht gegen eingetippte Werte). */
const gwVon = S.indexOf('const GUERTEL_FREIRAUM =');
const gwBis = gwVon < 0 ? -1 : S.indexOf('\n  function asteroidMarkerR(', gwVon);
const oaTreffer = S.match(/const ORBIT_ANGLES = \[[^\]]*\]/);
check('2d-anker: der Guertel-Ausweicher und ORBIT_ANGLES sind im Quelltext auffindbar',
  gwVon > 0 && gwBis > gwVon && !!oaTreffer, { gwVon, gwBis, oa: !!oaTreffer });
/* Der Ausweicher rechnet jetzt mit der GEOMETRIE des Kastens (kbOrbitMass, kbOrbitRx, guertelRx,
   SUN_X/SUN_Y). Die werden hier mitgegeben, damit beide Kastenformen einzeln geprueft werden
   koennen - die Browser-Messung weiter unten sieht nur die runde. Die Masse stehen im Quelltext
   und werden von dort gelesen, nicht eingetippt. */
const massTreffer = S.match(/return kbRunderKasten\(\) \? (\{[^}]*\}) : (\{[^}]*\});/);
const sonneTreffer = S.match(/const SUN_X = (\d+), SUN_Y = (\d+);/);
check('2d-anker3: Bahnmasse und Sonnenmitte sind im Quelltext lesbar', !!massTreffer && !!sonneTreffer,
  { mass: massTreffer && massTreffer[0], sonne: sonneTreffer && sonneTreffer[0] });
const baueGw = (rund) => {
  if (!(gwVon > 0 && gwBis > gwVon && oaTreffer && massTreffer && sonneTreffer)) return null;
  const kopf = oaTreffer[0] + ';'
    + 'const SUN_X = ' + sonneTreffer[1] + ', SUN_Y = ' + sonneTreffer[2] + ';'
    + 'function kbOrbitMass(){ return ' + (rund ? massTreffer[1] : massTreffer[2]) + '; }'
    + 'function kbOrbitRx(o){ const m = kbOrbitMass(); return m.basis + o*m.schritt; }'
    + 'function guertelRx(){ return kbOrbitRx(3.5); }';
  try { return new Function(kopf + S.slice(gwVon, gwBis) + ';return guertelWinkelFuer;')(); }
  catch (e) { return null; }
};
const gw = baueGw(true), gwFlach = baueGw(false);
check('2d-anker2: der geschnittene Block laeuft in beiden Kastenformen',
  typeof gw === 'function' && typeof gwFlach === 'function');
if (typeof gw === 'function' && typeof gwFlach === 'function') {
  const roh = p => ((p * 36) + 18) % 360;
  /* Die REGEL, nicht die Momentaufnahme (Hausregel 3): Nach dem Ausweichen muss jeder Platz von
     beiden Planetenbahnen weiter weg sein als vorher - und zwar in JEDER Kastenform. Die erste
     Fassung erfuellte das nur im runden Kasten; im flachen schob sie Platz 5 von 22,4 auf 14,8
     Einheiten, also erst auf die Scheibe. Gemessen wird mit denselben Formeln wie im Spiel. */
  const abstandFn = (rund) => {
    const m = JSON.parse((rund ? massTreffer[1] : massTreffer[2]).replace(/([a-z]+):/g, '"$1":'));
    const SX = +sonneTreffer[1], SY = +sonneTreffer[2];
    const rxO = o => m.basis + o * m.schritt;
    const pkt = (g, rx, ry) => ({ x: SX + rx * Math.cos(g * Math.PI / 180), y: SY + ry * Math.sin(g * Math.PI / 180) });
    const bahnen = JSON.parse(oaTreffer[0].split('=')[1].trim());
    return (g) => Math.min(...[3, 4].map(o => {
      const a = pkt(g, rxO(3.5), rxO(3.5) * m.ry);
      const b = pkt(bahnen[(o - 1) % bahnen.length], rxO(o), rxO(o) * m.ry);
      return Math.hypot(a.x - b.x, a.y - b.y);
    }));
  };
  const formen = [{ name: 'rund', fn: gw, d: abstandFn(true) }, { name: 'flach', fn: gwFlach, d: abstandFn(false) }];
  const nieSchlechter = formen.map(f => ({
    form: f.name,
    plaetze: [...Array(10).keys()].map(i => ({
      platz: i, vorher: +f.d(roh(i)).toFixed(1), nachher: +f.d(f.fn(roh(i))).toFixed(1)
    })).filter(x => x.nachher < x.vorher - 0.05)
  }));
  check('2d: das Ausweichen macht den Abstand zur Planetenscheibe in KEINER Kastenform kleiner',
    nieSchlechter.every(f => f.plaetze.length === 0), nieSchlechter);
  // Und es tut ueberhaupt etwas: im runden Kasten liegt Platz 5 nur 9,5 Einheiten neben Aion.
  check('2d2: der zu nahe Platz weicht im runden Kasten wirklich aus (Platz 5 wandert)',
    gw(roh(5)) !== roh(5) && abstandFn(true)(gw(roh(5))) > abstandFn(true)(roh(5)) + 5,
    { vorher: roh(5), nachher: gw(roh(5)),
      abstandVorher: +abstandFn(true)(roh(5)).toFixed(1), abstandNachher: +abstandFn(true)(gw(roh(5))).toFixed(1) });
  // Und die andere Haelfte: ein ungueltiger Ort darf nicht zu einem gueltigen werden. Eine Festung
  // ohne Platz ergibt NaN; ohne die Finite-Pruefung lieferte die Funktion 214 Grad und die Bastion
  // erschien sichtbar neben Aion (gemessen 05.09.2026, test_kartenbeschriftung fiel vierfach).
  check('2e: ein ungueltiger Platz bleibt ungueltig (NaN wird nicht zu einem Winkel)',
    Number.isNaN(gw(roh(undefined))) && Number.isNaN(gw(NaN)),
    { ausUndefined: gw(roh(undefined)), ausNaN: gw(NaN) });
  // Das Ausweichen darf keinen zweiten Platz treffen: zehn Plaetze, zehn verschiedene Endwinkel.
  const ende10 = formen.map(f => [...Array(10).keys()].map(i => f.fn(roh(i))));
  check('2f: nach dem Ausweichen liegt kein Platz auf einem anderen (beide Kastenformen)',
    ende10.every(e => new Set(e).size === 10), { rund: ende10[0], flach: ende10[1] });
}

/* ---- Browser ---------------------------------------------------------------------------------- */
const saveMit = (zusatz) => JSON.stringify(Object.assign({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
  buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
  research: {}, fleet: { jaeger: 100, ships: 3, missions: [] },
  discovered: { rhea: true, aion: true }, colonies: {}, activeBasePlanet: 'home',
  player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: Date.now(),
  colonyNames: {}, colonyNotes: {}, nextPlanetEventCheck: Date.now() + 3600000,
  seenTabHints: ['basis', 'karte', 'galaxie', 'fortschritt', 'flotte', 'forschung', 'werft', 'verteidigung', 'markt', 'allianz', 'abgrund', 'profil']
}, zusatz || {}));
/* Die Eisenlegion besitzt drei Kandidaten aus dem Kepler-Umfeld - welcher davon in der geoeffneten
   Region liegt, entscheidet die Karte; der Test sucht das Wappen ueber alle Knoten. */
const GALAXIE = {
  factions: { legion: { id: 'legion', name: 'Eisenlegion', color: '#85b7eb', systems: ['vega', 'orion', 'syss_01'], strength: 2 } },
  collapsedSystems: {}, controlledSystems: {}, news: [], activeWar: null, activeWormhole: null,
  npcEmpireStrength: 1, marketTrend: 1, lastTick: Date.now()
};
/* Kepler ist Guertelsystem (systeme), Platz 5 ist besetzt - genau der Platz auf dem Bahnwinkel
   von Aion (Orbit 3). Platz 2 als Kontrolle, der nirgends im Weg liegt. */
const FELD = { systeme: ['kepler'], felder: { kepler: { plaetze: {
  5: { frei: false, sorte: 'eisenkern', groesse: 'brocken', vorrat: 1200 },
  2: { frei: false, sorte: 'eisenkern', groesse: 'brocken', vorrat: 900 }
} } } };

function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
    if (p === 'galaxy') return j(GALAXIE);
    if (p === 'asteroid/field') return j(FELD);
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    return j({});
  };
}

async function boot(browser, viewport, geraet, saveZusatz) {
  const store = { 'kepler7-save-v3': saveMit(saveZusatz) };
  const ctx = await browser.newContext(Object.assign({}, geraet || {}, { viewport }));
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await versionAbfangen(page);
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });
  return { page, ctx, fehler };
}

(async () => {
  const browser = await starteBrowser();

  /* ---- Desktop: Wappen, Guertelplatz, Nebel, Bahnen ------------------------------------------- */
  {
    const { page, ctx, fehler } = await boot(browser, { width: 1280, height: 800 });
    check('0-vorab: Boot ohne Skriptfehler (Desktop)', fehler.length === 0, fehler.slice(0, 2));

    // 4) Nebel: die Kachel wird beim ersten Bild gemalt; gemessen wird die Mitte des ersten Nebels.
    const nebel = await page.evaluate(() => {
      const cv = document.getElementById('bgnebel');
      if (!cv || !cv.width) return null;
      const d = cv.getContext('2d').getImageData(Math.round(cv.width * 0.2), Math.round(cv.height * 0.3), 1, 1).data;
      return { a: d[3], w: cv.width, h: cv.height };
    });
    check('4a: die Nebel-Leinwand ist gemalt und messbar', !!nebel && nebel.w > 0, nebel);
    check('4b: der Nebel ist auf dem Schirm vorhanden - Deckkraft im Kern ueber 25/255 (alt: 5 % = 13)',
      !!nebel && nebel.a >= 25, nebel);

    await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
    await page.waitForTimeout(1500);
    const offen = await oeffneSektorMitSystem(page, 'kepler');
    check('1-vorab: die Region um Kepler laesst sich oeffnen', offen === true);

    // 1) Wappen: das verschachtelte svg darf nicht groesser sein als sein Knoten.
    const wappen = await page.evaluate(() => {
      const svgs = [...document.querySelectorAll('#galaxyMapSvg svg')];
      const kasten = document.querySelector('#tab-karte .map-wrap').getBoundingClientRect();
      return { anzahl: svgs.length, kasten: Math.round(kasten.width),
        breiten: svgs.map(s => Math.round(s.getBoundingClientRect().width)) };
    });
    check('1a: in der Sektoransicht steht mindestens ein Fraktionswappen als verschachteltes svg (sonst misst 1b nichts)',
      wappen.anzahl >= 1, wappen);
    check('1b: kein Wappen ist auf Kastengroesse aufgeblasen - jedes bleibt unter 40 px breit',
      wappen.anzahl >= 1 && wappen.breiten.every(w => w > 3 && w < 40), wappen);

    // 2) Guertelplatz 5 gegen Aion (Orbit 3) - gemessen an den gezeichneten Formen.
    const sys = await oeffneSystemUeberSektoren(page, 'kepler');
    check('2-vorab: das Kepler-System laesst sich oeffnen', sys === true);
    const guertel = await page.evaluate(() => {
      const bbox = el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, r: Math.max(r.width, r.height) / 2 }; };
      const p5 = document.querySelector('#galaxyMapSvg [data-map-asteroid="5"] polygon');
      const p2 = document.querySelector('#galaxyMapSvg [data-map-asteroid="2"] polygon');
      /* Die SICHTBARE Aussenkante: beide [data-sys-halo]-Ringe (r + 1,3 und r + 2,8) - nicht das
         Texturbild und nicht der Schatten-Verlauf, die beide weit ueber die Scheibe hinausreichen.
         circle.body steht nur im Rueckfall OHNE Textur im DOM (der Regelfall zeichnet ein <image>),
         taugt also nicht als Mass; er bleibt als Rueckfall im Selektor, damit die Messung auch
         ohne Textur etwas findet. Der aeussere Ring trug bis GR-9 keine Kennung - der Test mass
         deshalb 1,5 Einheiten zu wenig und haette ein Vorkommen durchgewunken, das in den
         sichtbaren Halo hineinragt. */
      const knoten = document.querySelector('#galaxyMapSvg [data-planet="aion"]');
      const kreise = knoten ? [...knoten.querySelectorAll('circle[data-sys-halo], circle.body')] : [];
      if (!p5 || !p2 || !kreise.length) return { p5: !!p5, p2: !!p2, kreise: kreise.length };
      const a = bbox(p5), c = bbox(p2);
      const b = kreise.map(bbox).reduce((m, k) => k.r > m.r ? k : m);
      return { abstand5: Math.round(Math.hypot(a.x - b.x, a.y - b.y)), summeRadien: Math.round(a.r + b.r),
               abstand2: Math.round(Math.hypot(c.x - b.x, c.y - b.y)), rAion: Math.round(b.r), rAst: Math.round(a.r) };
    });
    check('2a: Aion und die Vorkommen auf Platz 5 und 2 sind gezeichnet (sonst misst 2b nichts)',
      typeof guertel.abstand5 === 'number', guertel);
    check('2b: das Vorkommen auf Platz 5 liegt NICHT auf Aion - Mittelpunktsabstand groesser als die Summe der Radien',
      typeof guertel.abstand5 === 'number' && guertel.abstand5 > guertel.summeRadien, guertel);
    check('2c: Platz 2 bleibt, wo er war - weiter klar von Aion getrennt (die Behebung verschiebt nicht den ganzen Guertel)',
      typeof guertel.abstand2 === 'number' && guertel.abstand2 > guertel.summeRadien * 2, guertel);

    // 5) Bahnen am Desktop: unveraendert 0,10.
    const bahnDesktop = await page.evaluate(() => {
      const e = document.querySelector('#galaxyMapSvg [data-sys-bahn]');
      return e ? e.getAttribute('stroke-opacity') : null;
    });
    check('5a: die Orbit-Bahnen tragen ihre Kennung und am Desktop die alte Deckkraft 0,10', bahnDesktop === '0.10', { bahnDesktop });
    await ctx.close();
  }

  /* ---- Schmales Fenster mit AUSFUEHRLICHEM Kopf: der Bannerplanet -------------------------- */
  {
    /* compactHead:false erzwingt das volle 190er-Banner. Bei 480 px Fensterbreite ist es rund 440 px
       breit und damit schmaler als seine viewBox (720): slice skaliert auf die Hoehe und schneidet
       seitlich - mit xMid genau den Planeten bei cx 590. Am iPhone selbst steht nur der 56-px-
       Kompaktstreifen, der vertikal schneidet und den Planeten so oder so zeigt. */
    const { page, ctx, fehler } = await boot(browser, { width: 480, height: 900 }, null, { compactHead: false });
    check('0-vorab: Boot ohne Skriptfehler (480 px, ausfuehrlicher Kopf)', fehler.length === 0, fehler.slice(0, 2));
    const banner = await page.evaluate(() => {
      const svg = document.querySelector('.hero svg[viewBox="0 0 720 190"], svg[viewBox="0 0 720 190"]');
      if (!svg) return null;
      const ring = svg.querySelector('ellipse.orbit-ring');
      if (!ring) return { svg: true, ring: false };
      const s = svg.getBoundingClientRect(), r = ring.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      return { svgBreite: Math.round(s.width), svgHoehe: Math.round(s.height), ringMitte: Math.round(cx),
               links: Math.round(s.x), rechts: Math.round(s.x + s.width), pa: svg.getAttribute('preserveAspectRatio') };
    });
    check('3a: das Banner-svg und sein Planetenring sind vorhanden und das Banner ist hoeher als der Kompaktstreifen',
      !!banner && banner.ringMitte !== undefined && banner.svgHoehe > 80, banner);
    check('3b: die Mitte des Planetenrings liegt INNERHALB des sichtbaren Banners (mit xMid lag sie rechts ausserhalb)',
      !!banner && banner.ringMitte !== undefined && banner.ringMitte > banner.links && banner.ringMitte < banner.rechts, banner);
    await ctx.close();
  }

  /* ---- Handy: Bahnen ------------------------------------------------------------------------ */
  {
    const { page, ctx, fehler } = await boot(browser, { width: 390, height: 900 }, devices['iPhone 13']);
    check('0-vorab: Boot ohne Skriptfehler (Handy)', fehler.length === 0, fehler.slice(0, 2));
    // 5) Bahnen am Handy: 0,18.
    await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
    await page.waitForTimeout(1500);
    const sys = await oeffneSystemUeberSektoren(page, 'kepler');
    check('5-vorab: das Kepler-System laesst sich am Handy oeffnen', sys === true);
    const bahnHandy = await page.evaluate(() => {
      const e = document.querySelector('#galaxyMapSvg [data-sys-bahn]');
      return e ? e.getAttribute('stroke-opacity') : null;
    });
    check('5b: am Handy sind die Orbit-Bahnen mit 0,18 gezeichnet (alt: 0,10)', bahnHandy === '0.18', { bahnHandy });
    await ctx.close();
  }

  await browser.close();
  ende();
})().catch(e => { console.error('FAIL - Ausnahme:', e); process.exit(1); });
