// Die Schiffsrümpfe der Kampf-Wiedergabe (Bündel B, 05.09.2026, Grafik-Aufnahme).
//
//   node tests/test_schiffsruempfe.js
//
// GEMESSEN AM ALTEN BILD: Die Umrisse kamen aus SHIP_HULL_DEFS, aber die 62-%-Einfärbung im
// Mischmodus 'color' machte aus jedem Schiff eine mintgrüne oder lachsrote Farbfläche - Fenster,
// Türme und Verlauf waren nur noch als Schleier da, es gab kein Licht und keine Trennkante zum
// Hintergrund. Der Kommentar im Spiel hielt die Vorgeschichte fest: 0,85 war noch schlimmer
// ("aus den Schiffen wurden grüne und rote Blätter"), 0,62 war der Kompromiss.
//
// DIE REGEL, DIE HIER GEHALTEN WIRD, ist nicht "es sieht besser aus", sondern die Zwickmühle,
// an der die alte Lösung hing - BEIDES muss gelten:
//   A) Die SEITE muss erkennbar bleiben. Der Fehler "die eigene Flotte flog in Gegnerrot" ist in
//      diesem Spiel schon zweimal passiert; eine zu zarte Parteikante bringt ihn zurück.
//   B) Das SCHIFF muss erkennbar bleiben. Zwei Klassen mit verschiedenen Rümpfen dürfen sich im
//      Bild nicht gleichen, und die Füllung darf die Form nicht zudecken.
// Gemessen wird deshalb an gebackenen Atlanten: der Farbabstand zwischen eigener und gegnerischer
// Fassung DERSELBEN Klasse (muss groß sein) und die Helligkeitsstreuung innerhalb des Rumpfes
// (darf nicht flach sein - eine Farbfläche wäre es).
//
// EIN ERSTER ENTWURF VON 1c WAR TRIVIAL GRÜN: Er verglich die belegten Pixelkoordinaten zweier
// Klassen und meldete 100 % Unterschied - aber die Atlanten verschiedener Klassen sind verschieden
// groß, die Koordinaten also gar nicht vergleichbar. Die Prüfung hätte jeden Zustand bestanden,
// auch den alten. Jetzt misst sie die Regel, um die es geht.
//
// GEGENPROBE, gemessen am 05.09.2026 gegen origin/main (v8.685.0):
//   grün: node tests/test_schiffsruempfe.js -> 11 von 11
//   rot:  git show origin/main:weltraum_kolonie.html > /tmp/alt.html
//         KEPLER_SPIELDATEI=/tmp/alt.html node tests/test_schiffsruempfe.js
//   Am alten Stand fallen ALLE 7 laufenden Prüfungen (0a bis 0e, 1-anker, 1-anker2); die Prüfungen
//   1a bis 1d laufen dort gar nicht, weil es den Zeichner-Abschnitt nicht gibt - genau das meldet
//   1-anker. Keine einzige bleibt grün, weil jede an einem Bestandteil des Umbaus hängt.
const fs = require('fs');
const { starteBrowser, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = S.match(/<script>([\s\S]*)<\/script>/)[1];

/* ---- 0) Quelltext ---------------------------------------------------------------------------- */
check('0a: die 62-Prozent-Einfaerbung im Mischmodus color ist weg',
  !/globalCompositeOperation = 'color'/.test(JS) && !/globalAlpha = 0\.62; g\.fillStyle = farbe/.test(JS));
check('0b: es gibt einen eigenen Anstrich-Kanal, und die Wiedergabe nutzt ihn',
  /const GEFECHT_STAHL = \[/.test(JS)
  && /function drawShipMiniIcon\(key, canvas, markOverride, ohneAnstrich, stopsOverride\)/.test(JS)
  && /const stops = stopsOverride \|\|/.test(JS)
  && /drawShipMiniIcon\(shipKey, nc, eigen \? undefined : 1, !eigen, GEFECHT_STAHL\)/.test(JS));
check('0c: die Partei sitzt an Kante, Kennungsstreifen und Glut',
  /function kantenMass\(/.test(JS) && /function streifenLage\(/.test(JS) && /function glutAuftragen\(/.test(JS));
check('0d: es gibt ein Lichtmodell und Turmlichter',
  /function lichtAuftragen\(/.test(JS) && /function turmLichter\(/.test(JS));
/* Die Turmpositionen kommen aus den Rumpfdaten, es wird nichts erfunden. */
check('0e: die Tuerme werden aus SHIP_HULL_DEFS gelesen, nicht geraten',
  /var ts = def\.turrets \|\| \[\];/.test(JS) && /\(cfg\.turrets\|\|\[\]\)/.test(JS));

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('about:blank');

  /* Der ganze Zeichner-Abschnitt der Wiedergabe wird geschnitten und isoliert ausgefuehrt.
     Anker: von der Rumpf-Geometrie bis zum Ende von backeSpielAtlas. */
  const von = JS.indexOf('    /* DAS LICHT DER KAMPF-WIEDERGABE');
  /* Ab `von` suchen: dieselbe Rueckgabezeile steht auch im Polygon-Zeichner weiter oben, und ein
     Endanker VOR dem Anfang schneidet eine leere Zeichenkette (Hausregel: Anker pruefen). */
  const bisRoh = von < 0 ? -1 : JS.indexOf('      return { bild: nc, kante: kante };\n    }\n', von);
  const bis = bisRoh < 0 ? -1 : bisRoh + '      return { bild: nc, kante: kante };\n    }\n'.length;
  check('1-anker: der Zeichner-Abschnitt ist im Quelltext auffindbar', von > 0 && bis > von, { von, bis });

  let m = null;
  if (von > 0 && bis > von) {
    const hilfen = ['function hullRearSpan(', 'function hullEngines(', 'function pfadZug(',
                    'function mischmodusKann(', 'function rgba('];
    const teile = hilfen.map(h => {
      const i = JS.indexOf(h);
      if (i < 0) return '';
      let tiefe = 0, j = JS.indexOf('{', i);
      for (let k = j; k < JS.length; k++) {
        if (JS[k] === '{') tiefe++;
        else if (JS[k] === '}') { tiefe--; if (tiefe === 0) return JS.slice(i, k + 1) + '\n'; }
      }
      return '';
    }).join('');
    try {
      m = await page.evaluate(({ code, hilfen }) => {
        const kopf = `
          var SPRITE_KANTE = 168, SPRITE_RAND = 12, LAGEN = 32, SPALTEN = 8, dpr = 1;
          var TAU = Math.PI * 2;
          var SHIP_HULL_DEFS = {
            jaeger:    { pts:[[8,50],[62,38],[92,50],[62,62]], grad:'cyan', turrets:[] },
            kreuzer:   { pts:[[6,50],[40,32],[86,42],[94,50],[86,58],[40,68]], grad:'red',
                         turrets:[[46,42,5],[46,58,5]] },
            schlacht:  { pts:[[4,50],[24,26],[70,30],[96,50],[70,70],[24,74]], grad:'gold',
                         turrets:[[34,38,7],[34,62,7],[62,50,8]] }
          };
          var spielSprites = {};
          /* GEFECHT_STAHL steht beim Icon-Zeichner, also ausserhalb des geschnittenen Abschnitts -
             hier derselbe Wert, damit spielSprite ihn weiterreichen kann. */
          var GEFECHT_STAHL = ['#d0d6e2','#9aa2b6','#2f3650'];
          /* Ein Stellvertreter fuer das Spielbild: eine graue Scheibe mit zwei hellen Fenstern -
             damit laesst sich messen, OB die Fuellung durchkommt, ohne den ganzen Icon-Zeichner
             mitzunehmen. */
          function drawShipMiniIcon(key, cv){
            var g = cv.getContext('2d');
            g.fillStyle = '#9aa2b6'; g.fillRect(20, 30, 128, 108);
            g.fillStyle = '#e8ecf7'; g.fillRect(46, 60, 22, 16); g.fillRect(96, 60, 22, 16);
          }
        ` + hilfen;
        const api = new Function(kopf + code + '\nreturn { backeSpielAtlas: backeSpielAtlas, kantenMass: kantenMass, streifenLage: streifenLage };')();
        const rumpfVon = (key, spanne) => {
          const d = SHIP_HULL_DEFS_LOKAL[key];
          const xs = d.pts.map(p => p[0]), ys = d.pts.map(p => p[1]);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const mass = spanne / (maxX - minX);
          const punkte = [];
          d.pts.forEach(p => { punkte.push((p[1] - 50) * mass, -(p[0] - (minX + maxX) / 2) * mass); });
          return { schiff: key, punkte, mass, spanne, minX, maxX, mitteX: (minX + maxX) / 2, mitteY: 50 };
        };
        var SHIP_HULL_DEFS_LOKAL = {
          jaeger:   { pts:[[8,50],[62,38],[92,50],[62,62]] },
          kreuzer:  { pts:[[6,50],[40,32],[86,42],[94,50],[86,58],[40,68]] },
          schlacht: { pts:[[4,50],[24,26],[70,30],[96,50],[70,70],[24,74]] }
        };
        const lies = (atlas) => {
          const c = atlas.bild.getContext('2d');
          const k = atlas.kante;
          const d = c.getImageData(0, 0, k, k).data;
          let n = 0, r = 0, gg = 0, b = 0; const form = [];
          for (let i = 0; i < d.length; i += 4) {
            const px = (i / 4) % k, py = ((i / 4) / k) | 0;
            if (d[i + 3] > 40) { n++; r += d[i]; gg += d[i + 1]; b += d[i + 2]; form.push(px + ',' + py); }
          }
          return { n, mittel: n ? [Math.round(r / n), Math.round(gg / n), Math.round(b / n)] : null, form: new Set(form) };
        };
        const out = {};
        for (const [key, spanne] of [['jaeger', 7], ['kreuzer', 22], ['schlacht', 48]]) {
          let r;
          try { r = rumpfVon(key, spanne); }
          catch (e) { out[key] = { fehler: String(e).slice(0, 120) }; continue; }
          const eigen = api.backeSpielAtlas(r, '#5dcaa5', 1, true);
          const feind = api.backeSpielAtlas(r, '#e24b4a', 1, false);
          if (!eigen || !feind) { out[key] = { fehlt: true, eigen: !!eigen, feind: !!feind }; continue; }
          const a = lies(eigen), bF = lies(feind);
          /* B) Deckt die Fuellung die Form zu? Gemessen an der HELLIGKEITSSTREUUNG innerhalb des
             Rumpfes: eine Farbflaeche ist flach, ein beleuchteter Rumpf mit Fenstern und Tuermen
             nicht. Das ist die Regel, um die es geht - ein Formvergleich zwischen KLASSEN waere
             trivial gruen, weil ihre Atlanten verschieden gross sind. */
          const streuung = (atlas) => {
            const c = atlas.bild.getContext('2d'), k = atlas.kante;
            const d = c.getImageData(0, 0, k, k).data;
            const hell = [];
            for (let i = 0; i < d.length; i += 4) {
              if (d[i + 3] > 200) hell.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
            }
            if (hell.length < 12) return 0;
            const mit = hell.reduce((x, y) => x + y, 0) / hell.length;
            return Math.round(Math.sqrt(hell.reduce((x, y) => x + (y - mit) * (y - mit), 0) / hell.length));
          };
          // Farbabstand zwischen den Seiten (mittlere Kanaldifferenz ueber die gedeckten Pixel)
          const dist = a.mittel && bF.mittel
            ? Math.round(Math.hypot(a.mittel[0] - bF.mittel[0], a.mittel[1] - bF.mittel[1], a.mittel[2] - bF.mittel[2]))
            : 0;
          // Deckung: wie viel des Kastens der Rumpf einnimmt (Form darf nicht verschwinden)
          out[key] = { seitenAbstand: dist, pixel: a.n, mittelEigen: a.mittel, mittelFeind: bF.mittel,
                       streuungEigen: streuung(eigen), streuungFeind: streuung(feind), form: a.form };
        }
        // Formunterschied zweier KLASSEN derselben Seite
        const formDiff = (x, y) => {
          if (!out[x].form || !out[y].form) return 0;
          let nur = 0;
          out[x].form.forEach(p => { if (!out[y].form.has(p)) nur++; });
          return Math.round(nur / out[x].form.size * 100);
        };
        const erg = { klassen: {}, formKreuzerGegenSchlacht: formDiff('kreuzer', 'schlacht'),
                      formJaegerGegenKreuzer: formDiff('jaeger', 'kreuzer'),
                      kantenKlein: api.kantenMass(7, false), kantenGross: api.kantenMass(48, false) };
        for (const k of Object.keys(out)) {
          const { form, ...rest } = out[k];
          erg.klassen[k] = rest;
        }
        return erg;
      }, { code: JS.slice(von, bis), hilfen: teile });
    } catch (e) { m = { fehler: String(e).slice(0, 300) }; }
  }
  check('1-anker2: der Zeichner laeuft isoliert', !!m && !m.fehler, m && m.fehler);

  if (m && !m.fehler) {
    const K = m.klassen;
    check('1a: jede Klasse liefert einen Atlas mit gedeckten Pixeln',
      ['jaeger', 'kreuzer', 'schlacht'].every(k => K[k] && K[k].pixel > 20),
      Object.fromEntries(Object.keys(K).map(k => [k, K[k].pixel])));
    /* A) DIE SEITE. Der Farbabstand zwischen eigener und gegnerischer Fassung derselben Klasse
       muss deutlich sein - auch beim 7-px-Jaeger, wo weder Streifen noch Tuerme aufloesen. */
    check('1b: eigene und gegnerische Fassung derselben Klasse sind farblich klar getrennt',
      ['jaeger', 'kreuzer', 'schlacht'].every(k => K[k] && K[k].seitenAbstand >= 25),
      Object.fromEntries(Object.keys(K).map(k => [k, K[k].seitenAbstand])));
    /* B) DAS SCHIFF. Der Rumpf darf keine Farbflaeche sein: innerhalb der gedeckten Flaeche muss es
       Helligkeitsunterschiede geben - Fenster, Tuerme, Licht. Gemessen wird die Streuung; ein
       einfarbig gefuellter Rumpf laege nahe null. Beide Seiten, weil die alte Einfaerbung beide
       gleichermassen platt machte. Der Schwellwert 18 liegt deutlich ueber dem, was ein Verlauf
       allein erzeugt, und deutlich unter dem gemessenen Stand. */
    check('1c: der Rumpf ist keine Farbflaeche - im Bild bleiben Helligkeitsunterschiede',
      ['jaeger', 'kreuzer', 'schlacht'].every(k => K[k] && K[k].streuungEigen >= 18 && K[k].streuungFeind >= 18),
      Object.fromEntries(Object.keys(K).map(k => [k, [K[k].streuungEigen, K[k].streuungFeind]])));
    /* Die Kantenstaerke haengt an der Groesse: unter 10 px schmaler, sonst frisst sie die Form. */
    check('1d: die Kante ist groessenabhaengig - beim Jaeger schmaler als beim Schlachtschiff',
      m.kantenKlein.gross === false && m.kantenGross.gross === true
      && m.kantenKlein.leucht < m.kantenGross.leucht,
      { klein: m.kantenKlein, gross: m.kantenGross });
  }
  await ende(async () => browser.close());
})();
