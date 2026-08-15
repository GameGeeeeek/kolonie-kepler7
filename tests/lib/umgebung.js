// Gemeinsame Umgebung für alle Tests im Repo.
//
// WARUM ES DIESE DATEI GIBT
// -------------------------
// Die Tests lagen bis 25.07.2026 ausschließlich im Sitzungs-Scratchpad unter /tmp und waren damit
// weg, sobald der Container eingesammelt wurde. Sie hatten Playwright, den Browser und die
// Spieldatei als absolute Pfade fest eingebaut ("/opt/node22/...", "/home/user/kolonie-kepler7/...").
// Auf einem anderen Rechner - Saschas Pi, ein neuer Container, ein Laptop - stimmt keiner davon.
// Diese Datei kapselt das Auffinden an EINER Stelle; die Tests selbst kennen keine absoluten Pfade
// mehr.
const fs = require('fs');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..', '..');

function ersterVorhandener(kandidaten) {
  for (const k of kandidaten) { try { if (fs.existsSync(k)) return k; } catch (e) {} }
  return null;
}

// --- Playwright
// Erst der normale Auflösungsweg (lokale node_modules), dann die üblichen globalen Orte.
function ladePlaywright() {
  const versuche = [
    'playwright',
    '/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright',
    '/usr/local/lib/node_modules/playwright'
  ];
  for (const v of versuche) { try { return require(v); } catch (e) {} }
  console.error('FEHLER: Playwright nicht gefunden. Installation: npm i -D playwright');
  process.exit(2);
}
const _pw = ladePlaywright();
const chromium = _pw.chromium;
const devices = _pw.devices;

// --- Browser
// null heißt: Playwright soll seinen eigenen mitgebrachten Browser nehmen. Das ist der Normalfall
// auf einem frisch eingerichteten Rechner; die festen Pfade davor sind die vorinstallierten Browser
// dieser Container-Umgebung (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers).
const BROWSER = ersterVorhandener([
  process.env.KEPLER_CHROMIUM,
  '/opt/pw-browsers/chromium',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
].filter(Boolean));

// Startoptionen: --no-sandbox ist nötig, weil die Tests in Containern oft als root laufen.
const STARTOPTIONEN = { args: ['--no-sandbox', '--disable-dev-shm-usage'] };
if (BROWSER) STARTOPTIONEN.executablePath = BROWSER;
const starteBrowser = (extra) => chromium.launch(Object.assign({}, STARTOPTIONEN, extra || {}));

// --- Spieldatei
// KEPLER_SPIELDATEI zeigt auf eine KOPIE unter anderem Pfad. Gebraucht wird das für Gegenproben
// (CLAUDE.md-Regel 1): Der übliche Griff dafür war bisher `cp alt.html weltraum_kolonie.html` …
// messen … zurückkopieren - also ein Edit an der Spieldatei, das jeden gleichzeitig laufenden
// Prüflauf wertlos macht (Regel 14, Nachtrag vom 15.08.2026). CLAUDE.md beschrieb diesen Env-Weg
// schon als vorhanden; er war es nicht. Gilt für alle Tests, die ihre Datei von hier beziehen -
// Tests mit eigenem `path.join(__dirname, '..', ...)` bleiben davon unberührt.
const SPIELDATEI = process.env.KEPLER_SPIELDATEI || path.join(WURZEL, 'weltraum_kolonie.html');
const SPIEL_URL = 'file://' + SPIELDATEI;

// --- Backend-Quelltext (optional)
// Ein paar Tests vergleichen Frontend und Backend Zeile für Zeile (Konterrollen, Kampfphasen,
// Flottenbalance). Liegt das Backend-Repo nicht daneben, überspringen sie sich selbst mit klarer
// Meldung, statt fehlzuschlagen - der Frontend-Prüflauf soll ohne das zweite Repo durchlaufen.
const SERVER_JS = ersterVorhandener([
  process.env.KEPLER_BACKEND_SERVER,
  path.join(WURZEL, '..', 'kolonie-kepler7-backend', 'server.js'),
  '/workspace/kolonie-kepler7-backend/server.js'
].filter(Boolean));

// --- Kleine Prüf-Hilfe, damit alle Tests dieselbe Ausgabe erzeugen
function pruefer() {
  let fehlgeschlagen = false;
  const check = (name, bedingung, zusatz) => {
    console.log((bedingung ? 'OK  ' : 'FAIL') + ' - ' + name +
      (zusatz !== undefined ? ' | ' + JSON.stringify(zusatz) : ''));
    if (!bedingung) fehlgeschlagen = true;
  };
  const ende = async (aufraeumen) => {
    if (aufraeumen) { try { await aufraeumen(); } catch (e) {} }
    console.log(fehlgeschlagen ? '\nFAIL' : '\nPASS');
    process.exit(fehlgeschlagen ? 1 : 0);
  };
  return { check, ende, get fehlgeschlagen() { return fehlgeschlagen; } };
}

// Überspringen mit Aussage: Exit-Code 0, aber im Protokoll klar als übersprungen erkennbar.
function ueberspringen(grund) {
  console.log('SKIP - ' + grund);
  console.log('\nPASS (übersprungen)');
  process.exit(0);
}

module.exports = { chromium, devices, starteBrowser, BROWSER, SPIELDATEI, SPIEL_URL, SERVER_JS, WURZEL, pruefer, ueberspringen };
