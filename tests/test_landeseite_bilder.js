// Die Bilder der Landeseite (Bündel E, 06.09.2026, Grafik-Aufnahme).
//
//   node tests/test_landeseite_bilder.js
//
// GEMESSEN AM ALTEN STAND: Der Himmel war ein Ring aus 3400 gleichförmigen Punkten mit gelbem
// Kernklecks, jeden Frame aus Einzelpfaden neu gezeichnet. Der Kern lag am Desktop bei y = 0,90 H,
// also unter der Live-Leiste; die oberen 80 % des Bildschirms waren schwarze Leere, weil die 26
// Staubwolken bei 9-16 % Deckkraft unsichtbar blieben. Das Gefechtsbild daneben zeigte sieben
// 18x10-Pfeildreiecke an einem pulsierenden Klecks - es bewarb das Kernfeature des Spiels und
// zeigte davon nichts: keine Schiffsklasse, keine Fronten, keine Treffer, keine Trümmer.
//
// DIE REGELN, DIE HIER GEHALTEN WERDEN:
//   A) Der obere Bildteil ist nicht mehr leer. Das war DER Befund; alles andere ist Beiwerk.
//   B) Der Himmel wird gebacken, nicht je Frame aus Tausenden Pfaden gezeichnet.
//   C) Im Gefechtsbild sind SCHIFFE zu sehen: zusammenhängende Formen ab 28 px Länge (die Grenze
//      steht so im Konzept - darunter werden es wieder Pfeile), und zwei Parteien.
//   D) Beides ist deterministisch - zwei Aufbauten liefern denselben Himmel.
//
// GEGENPROBE, gemessen am 06.09.2026 gegen origin/main (v8.691.0):
//   grün: node tests/test_landeseite_bilder.js
//   rot:  git show origin/main:weltraum_kolonie.html > /tmp/alt.html
//         KEPLER_SPIELDATEI=/tmp/alt.html KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_landeseite_bilder.js
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

/* ---- 0) Quelltext ---------------------------------------------------------------------------- */
check('0a: der Himmel wird gebacken statt Frame für Frame gezeichnet',
  /function llGalaxieBacken\(W, H, dpr, mobil\)\{/.test(JS)
  && /function llGalaxieZeichnen\(ctx, G, t\)\{/.test(JS)
  && /szene\.sky\.gal = llGalaxieBacken\(/.test(JS));
/* Die 3400 Einzelpunkte und die 26 unsichtbaren Staubwolken sind weg - beides stand für den
   alten Zustand: viel Rechenzeit, wenig Bild. */
check('0b: die alte Punktwolke ist verschwunden',
  !/const N = 3400; szene\.sky\.pts = \[\];/.test(JS)
  && !/szene\.sky\.dust\.push/.test(JS));
check('0c: das Gefechtsbild zeichnet echte Rümpfe',
  /function zeichneRumpfB\(g, klasse, L, mat, opt\)\{/.test(JS)
  && /function zeichneGefechtB\(a, t, statisch\)\{/.test(JS)
  && /zeichneGefechtB\(a, t, llStaticOnly\(\)\);/.test(JS));
/* Der gemeinsame Grund wird für das Gefecht übersprungen - dessen Zeichner bringt einen eigenen
   mit, der mit clearRect beginnt. Ohne diesen Zweig wäre er gemalt und sofort überdeckt. */
check('0d: der gemeinsame Grund läuft nicht doppelt',
  /if \(a\.kind !== 'flotte'\)\{/.test(JS));
/* Ein eigener Vollkreis-Name: das TAU der Kampf-Wiedergabe liegt in deren IIFE und ist hier
   nicht erreichbar - der erste Einbau warf genau deshalb ReferenceError. */
check('0e: der Vollkreis der Landeseite hat einen eigenen Namen',
  /const LL_TAU = Math\.PI \* 2;/.test(JS));

function backend(){
  let angemeldet = false;
  return async r => {
    const req = r.request(), p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    // /me MUSS 401 liefern, solange niemand angemeldet ist - sonst hält das Spiel den Besucher
    // für eingeloggt und die Landeseite erscheint gar nicht (Falle aus test_landeseite).
    if (p === 'me') return angemeldet ? j({ userId:'u', username:'A' }) : j({ error:'nein' }, 401);
    void angemeldet;
    return j({});
  };
}

(async () => {
  const browser = await starteBrowser();
  const messe = async (breite, hoehe, dpr) => {
    const ctx = await browser.newContext({ viewport:{ width:breite, height:hoehe }, deviceScaleFactor:dpr });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route('**/api/**', backend());
    await page.goto(SPIEL_URL);
    await page.waitForTimeout(2600);
    const d = await page.evaluate(() => {
      const sky = document.getElementById('llSky');
      const art = document.querySelector('canvas[data-ll-art="flotte"]');
      const lies = cv => {
        if (!cv || !cv.width) return null;
        const c = cv.getContext('2d');
        const w = cv.width, h = cv.height;
        const d = c.getImageData(0, 0, w, h).data;
        // Mittlere Helligkeit je Bilddrittel (oben/mitte/unten) und Anteil "sichtbarer" Pixel.
        const teil = (y0, y1) => {
          let summe = 0, n = 0, hell = 0;
          for (let y = y0; y < y1; y += 2) for (let x = 0; x < w; x += 2){
            const i = (y*w+x)*4;
            const a = d[i+3] / 255;
            const l = (0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]) * a;
            summe += l; n++; if (l > 18) hell++;
          }
          return { mittel: n ? summe/n : 0, anteilHell: n ? hell/n : 0 };
        };
        return { w, h, oben: teil(0, Math.floor(h*0.4)), mitte: teil(Math.floor(h*0.4), Math.floor(h*0.75)) };
      };
      // Rumpfformen im Gefechtsbild: waagerechte Läufe zusammenhängender heller Pixel.
      const ruempfe = () => {
        if (!art || !art.width) return null;
        const c = art.getContext('2d'), w = art.width, h = art.height;
        const d = c.getImageData(0,0,w,h).data;
        let laengsterLauf = 0, lilac = 0, rot = 0;
        for (let y = 0; y < h; y += 2){
          let lauf = 0;
          for (let x = 0; x < w; x++){
            const i = (y*w+x)*4, r = d[i], g = d[i+1], b = d[i+2];
            const l = 0.299*r + 0.587*g + 0.114*b;
            if (l > 70){ lauf++; if (lauf > laengsterLauf) laengsterLauf = lauf; } else lauf = 0;
            // Parteikanten: Lilac (blaustichig hell) und Rot (rotstichig).
            if (l > 60 && b > r + 25) lilac++;
            if (l > 60 && r > b + 45) rot++;
          }
        }
        return { w, h, laengsterLauf, lilac, rot, dpr: window.devicePixelRatio || 1 };
      };
      return { sky: lies(sky), gefecht: ruempfe(),
               skyBreite: sky ? sky.clientWidth : 0, artDa: !!art };
    });
    await ctx.close();
    return { d, errs };
  };

  for (const [name, b, h, dpr] of [['Desktop', 1280, 800, 1], ['Handy', 390, 844, 2]]){
    const { d, errs } = await messe(b, h, dpr);
    check(name + ' – keine Skriptfehler', errs.length === 0, errs.slice(0, 3));
    check(name + ' – Himmel und Gefechtsbild sind da', !!d.sky && d.artDa, { sky: !!d.sky, art: d.artDa });
    if (d.sky){
      /* A) DER Befund: der obere Bildteil war leer. Gemessen wird die mittlere Helligkeit des
         oberen Bilddrittels und der Anteil sichtbarer Pixel darin.
         DIE SCHWELLEN SIND GEMESSEN, und zwar am alten Stand DREIMAL - er zeichnete seine
         Punktwolke mit Math.random, die Werte schwanken also von Aufruf zu Aufruf:
           Desktop alt 4,89-7,65 Helligkeit / 1,6-6,8 % helle Pixel   → neu 14,21 / 27,5 %
           Handy   alt 7,25-13,11 / 10,8-31,4 %                       → neu 22,87 / 63,8 %
         Ein erster Anlauf setzte die Schwelle bei 2,5 und war damit auch am ALTEN Stand grün -
         die Prüfung hätte nichts belegt. Je Formfaktor eine eigene Zahl, weil die alte Galaxie am
         Handy schon im oberen Bereich stand (Kern bei 0,48 H) und am Desktop nicht (0,90 H): die
         Verbesserung ist dort größer, die Schwelle darf niedriger liegen. */
      const grenzen = name === 'Handy' ? { mittel: 17, anteil: 0.45 } : { mittel: 11, anteil: 0.15 };
      check(name + ' – der obere Bildteil ist nicht mehr leer',
        d.sky.oben.mittel > grenzen.mittel && d.sky.oben.anteilHell > grenzen.anteil,
        { mittel: +d.sky.oben.mittel.toFixed(2), anteilHell: +d.sky.oben.anteilHell.toFixed(3), grenzen });
      check(name + ' – die Bildmitte trägt die Galaxie',
        d.sky.mitte.mittel > d.sky.oben.mittel,
        { oben: +d.sky.oben.mittel.toFixed(2), mitte: +d.sky.mitte.mittel.toFixed(2) });
    }
    if (d.gefecht){
      /* C) Rümpfe statt Pfeile. Der längste zusammenhängende helle Lauf entspricht der Länge des
         größten Rumpfes, gemessen in CSS-PIXELN: die Frage ist, was ein Mensch sieht, nicht wie
         dicht der Schirm ist.
         DIE SCHWELLE IST GEMESSEN, NICHT AUS DEM KONZEPT ÜBERNOMMEN. Das Konzept nennt 28 px als
         Mindestforderung an die Lesbarkeit - als Trennwert taugt sie nicht: am alten Stand misst
         derselbe Lauf 27 px (Desktop) und 30 px (Handy, wo der Verlaufsschweif der Pfeile länger
         gerät), die Prüfung wäre dort also zur Hälfte grün gewesen. Am neuen Stand sind es 182
         und 153 px. Die 60 liegt weit über beiden alten und weit unter beiden neuen Werten. */
      const laufCss = d.gefecht.laengsterLauf / d.gefecht.dpr;
      check(name + ' – im Gefecht stehen Schiffe, keine Pfeile',
        laufCss >= 60, { laengsterLaufCss: Math.round(laufCss), mindestens: 60, dpr: d.gefecht.dpr });
      check(name + ' – beide Parteien sind an der Farbe zu trennen',
        d.gefecht.lilac > 60 && d.gefecht.rot > 60,
        { lilac: d.gefecht.lilac, rot: d.gefecht.rot });
    }
  }

  /* D) Zwei Aufbauten derselben Größe liefern denselben Himmel - der Formgenerator hängt an einem
     festen Seed, sonst sähe die Landeseite bei jedem Aufruf anders aus. */
  const a = await messe(1280, 800, 1), b = await messe(1280, 800, 1);
  check('der Himmel ist bei zwei Aufbauten derselbe',
    a.d.sky && b.d.sky && Math.abs(a.d.sky.oben.mittel - b.d.sky.oben.mittel) < 0.6,
    { a: a.d.sky && +a.d.sky.oben.mittel.toFixed(2), b: b.d.sky && +b.d.sky.oben.mittel.toFixed(2) });

  await browser.close();
  ende();
})();
