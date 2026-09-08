// Rendert Schiffsrümpfe als PNG - mit dem ECHTEN drawShipMiniIcon aus weltraum_kolonie.html.
//
// Anders als beim Nest wird hier NICHT geschnitten: drawShipMiniIcon hängt an einem Dutzend
// Nachbarn (SHIP_HULL_DEFS, SHIP_GRAD_STOPS, markStil, hullEngines, activeShipSkinStops ...),
// und ein Schnitt, der die alle einsammelt, ist raten. Stattdessen bekommt eine KOPIE der
// Spieldatei eine einzige zusätzliche Zeile, die die Funktion nach aussen reicht; danach läuft
// das Spiel selbst und zeichnet mit seinem eigenen Code. Die Kopie liegt im Scratch-Verzeichnis,
// das Repo bleibt unberührt.
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

const SPIEL = process.argv[3] || path.join(__dirname, '..', 'weltraum_kolonie.html');
const OUT = process.argv[2] || path.join(__dirname, 'schiffe');
const GROESSE = 512;
// Die Rümpfe, die das Kartenmotiv braucht. kausalitaetsbrecher ist mit Gewicht 260 das
// stärkste Schiff des Spiels (SHIP_SCORE_WEIGHTS) - also das, was der Marker als Flaggschiff
// zeigt, wenn es im Verband steht.
const SCHIFFE = (process.env.SCHIFFE || 'kausalitaetsbrecher,superschlachtschiff,jaeger').split(',');

// Der Anker sitzt an einer Stelle, die drawShipMiniyIcon bereits sehen kann (Funktionsdeklarationen
// werden hochgezogen). Er muss genau einmal vorkommen - sonst wird nicht geraten, sondern abgebrochen.
const ANKER = '  function flottenBildUrl(key){';

(async () => {
  const html = fs.readFileSync(SPIEL, 'utf8');
  const n = html.split(ANKER).length - 1;
  if (n !== 1) throw new Error(`Anker ${n === 0 ? 'fehlt' : n + 'x vorhanden'}: ${ANKER}`);
  const patched = html.replace(ANKER,
    '  window.__keplerMini = { zeichne: drawShipMiniIcon, rumpfe: SHIP_HULL_DEFS };\n' + ANKER);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-schiff-'));
  const datei = path.join(tmp, 'spiel.html');
  fs.writeFileSync(datei, patched);
  fs.mkdirSync(OUT, { recursive: true });

  // Eigener Mini-Server: file:// verbietet dem Spiel zu viel (Service-Worker, fetch).
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(datei));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 800, height: 900 } });
  try {
    await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction('!!(window.__keplerMini && window.__keplerMini.zeichne)', null, { timeout: 30000 });
    for (const key of SCHIFFE) {
      const url = await p.evaluate(([key, S]) => {
        const K = window.__keplerMini;
        if (!K.rumpfe[key]) throw new Error('unbekannter Rumpf: ' + key);
        const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
        // markOverride 1 = keine Werftmarken (die haengen am eigenen Fortschritt). Der Anstrich
        // bleibt der des Spiels: ohne Spielstand ist das der Standard-Lack, den jeder sieht.
        K.zeichne(key, cv, 1);
        return cv.toDataURL();
      }, [key, GROESSE]);
      const roh = Buffer.from(url.split(',')[1], 'base64');
      if (roh.length < 5000) throw new Error(`${key}: Bild ist praktisch leer (${roh.length} B)`);
      fs.writeFileSync(`${OUT}/${key}.png`, roh);
      console.log('  ', key + '.png', (roh.length / 1024).toFixed(0) + ' kB');
    }
  } finally {
    await b.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });
