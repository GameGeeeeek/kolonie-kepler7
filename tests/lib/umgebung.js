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
const PFADE = require('./spieldatei');

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
// Bezogen aus lib/spieldatei.js - das ist die EINE Quelle der Pfade. Hier stand bis zum
// 21.08.2026 eine zweite, wortgleiche Fassung; der Kommentar in spieldatei.js behauptete schon
// damals, umgebung beziehe sie von dort. Gemessen rechneten beide identisch, es war also
// folgenlos - aber es war eine zweite Wahrheit mit einem Kommentar, der das Gegenteil sagt, und
// wer spieldatei.js geaendert haette, haette diese Datei NICHT mitgeaendert.
const SPIELDATEI = PFADE.SPIELDATEI;
const SPIEL_URL = PFADE.SPIEL_URL;

// --- Backend-Quelltext (optional)
// Ein paar Tests vergleichen Frontend und Backend Zeile für Zeile (Konterrollen, Kampfphasen,
// Flottenbalance). Liegt das Backend-Repo nicht daneben, überspringen sie sich selbst mit klarer
// Meldung, statt fehlzuschlagen - der Frontend-Prüflauf soll ohne das zweite Repo durchlaufen.
const SERVER_JS = PFADE.SERVER_JS;

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
// --- Mitschnitt der Spielmeldungen ------------------------------------------------------------
// WARUM ES DIESEN HELFER GIBT (gemessen 19.08.2026). `#log` hat keinen Stapel - `log()` schreibt
// per innerHTML und ueberschreibt sich mit jeder Meldung selbst. Wer den ENDSTAND abliest, misst
// deshalb nicht "die Zeile ist erschienen", sondern "sie stand am Ende noch da" - zwei
// verschiedene Fragen, und nur die erste gehoert dem Knopf, den ein Test gerade drueckt.
//
// Der Unterschied ist keine Theorie, er hat an einem Tag zweimal zugeschlagen:
//   * test_beitrag_strikt fiel im vollen Lauf, weil "Neues Ereignis: Alte Bake sendet
//     Koordinaten" die geprueste Zeile ueberschrieben hatte. Die MECHANIK war gruen (kein
//     contrib-Dokument, Ressourcen zurueckgebucht) - nur die Anzeige war schon weitergezogen.
//   * test_benachrichtigung_abgleich war schlimmer, weil STILL: Seine verneinende Pruefung
//     ("es kommt KEINE Warnung") las gemessen "Planeten-Ereignis auf Heimatbasis: Sonnenflaute
//     ..." und war deshalb trivial gruen. Sie haette dieselbe Farbe gezeigt, wenn die Warnung
//     gekommen UND danach ueberschrieben worden waere - also genau in dem Fall, gegen den der
//     Test gebaut ist.
//
// Pinnen hilft nur zur Haelfte: nextPlanetEventCheck und nextTraderCheck lassen sich im
// Spielstand in die Zukunft legen, maybeSpawnRandomEvent hat aber GAR KEINE Uhr (es wuerfelt je
// Tick mit 0,25 % und liest state.lastEventTime nirgends als Sperre). Gegen diese Quelle ist der
// Mitschnitt die einzige Antwort - siehe CLAUDE.md, Arbeitsregel 65.
//
// DREI DINGE, DIE BEIM BAU JE EINEN ANLAUF GEKOSTET HABEN:
//   (a) Beobachtet wird `document`, NICHT `document.documentElement`. Beim addInitScript ist die
//       Wurzel noch nicht da; observe() wirft dann "parameter 1 is not of type 'Node'", der
//       Mitschnitt bleibt fuer den ganzen Lauf leer, und die Pruefungen fallen aus dem falschen
//       Grund. `document` existiert immer und deckt mit subtree:true alles ab, was spaeter
//       darunter entsteht.
//   (b) Der Beobachter darf nicht am #log-KNOTEN haengen: Der Boot ersetzt den Container einmal
//       per innerHTML, man saesse danach am verwaisten Original. Deshalb je Mutation frisch per
//       id lesen.
//   (c) addInitScript statt eines Aufrufs nach dem goto - nur so laeuft der Beobachter VOR dem
//       ersten Tick und sammelt lueckenlos.
async function logMitschnitt(page) {
  await page.addInitScript(() => {
    window.__logMitschnitt = [];
    new MutationObserver(() => {
      const el = document.getElementById('log');
      const t = el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
      const a = window.__logMitschnitt;
      if (t && t !== a[a.length - 1]) a.push(t);
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
}

// Liefert den bisherigen Mitschnitt. Eine Pruefung fragt damit "ist die Zeile ERSCHIENEN" statt
// "steht sie noch da", und ihr Beleg im Fehlschlag nennt, was STATTDESSEN zu sehen war
// (Arbeitsregel 37) - statt einer leeren Zeichenkette, aus der niemand etwas ableiten kann.
async function logZeilen(page) {
  return page.evaluate(() => (window.__logMitschnitt || []).slice());
}

// Die zwei Ereignis-Uhren, die sich SEHR WOHL pinnen lassen. Bei 0 - dem Wert, den ein frischer
// Spielstand traegt - feuert der erste Check GARANTIERT (Arbeitsregel 18). Das nimmt zwei der drei
// Stoerquellen weg und macht den Mitschnitt lesbar; die dritte (maybeSpawnRandomEvent) faengt nur
// der Mitschnitt selbst. In einen Fixture-Spielstand einstreuen: Object.assign(stand, ruhigeUhren())
function ruhigeUhren(stunden) {
  const weit = Date.now() + (stunden || 1) * 3600 * 1000;
  return { nextPlanetEventCheck: weit, nextTraderCheck: weit };
}

function ueberspringen(grund) {
  console.log('SKIP - ' + grund);
  console.log('\nPASS (übersprungen)');
  process.exit(0);
}

module.exports = { chromium, devices, starteBrowser, BROWSER, SPIELDATEI, SPIEL_URL, SERVER_JS, WURZEL, pruefer, ueberspringen, logMitschnitt, logZeilen, ruhigeUhren };
