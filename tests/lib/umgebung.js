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
// Pinnen hilft gegen zwei der drei Quellen unmittelbar: nextPlanetEventCheck und nextTraderCheck
// lassen sich im Spielstand in die Zukunft legen. maybeSpawnRandomEvent hat GAR KEINE Uhr (es
// wuerfelt je Tick mit 0,25 % und liest state.lastEventTime nirgends als Sperre) - seit dem
// 22.08.2026 legt `ruhigeUhren()` es trotzdem stumm, ueber die `if (state.activeEvent) return;`
// in seiner ersten Zeile (Begruendung und Messung dort). Fuer den MITSCHNITT bleibt das eine
// Erleichterung, kein Ersatz: Er faengt auch jede andere Meldung, die eine Zeile ueberschreibt.
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

/* Setzt eine Marke und liefert eine Funktion, die NUR die seither hinzugekommenen Zeilen
   zurueckgibt. Fuer Tests, die mehrere Klicks nacheinander messen.

   WARUM NICHT EINFACH `__logMitschnitt.length = 0`: Der Beobachter oben vergleicht gegen
   `a[a.length-1]`, und bei einer geleerten Liste ist das `undefined`. Die naechstbeste
   DOM-Aenderung schiebt dann den UNVERAENDERTEN Log-Text erneut hinein - die Pruefung liest
   also die Zeile des VORIGEN Klicks und meldet Erfolg, obwohl der geprueften Stelle die
   Meldung fehlt. Am 04.09.2026 durch gezielte Sabotage bewiesen: Eine Pruefung blieb gruen,
   nachdem die gemessene Meldung vollstaendig entfernt worden war. Die Marke haelt den alten
   Text deshalb als Wasserzeichen fest, statt die Liste zu leeren. */
async function logMarke(page) {
  const ab = await page.evaluate(() => {
    const el = document.getElementById('log');
    const t = el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
    window.__logMitschnitt = t ? [t] : [];
    return window.__logMitschnitt.length;
  });
  return async () => (await logZeilen(page)).slice(ab);
}

// Bewusst ein Schluessel, den RANDOM_EVENTS nie tragen wird - der Unterstrich-Rahmen macht ihn
// beim Lesen eines Spielstands sofort als Test-Riegel erkennbar.
const RUHE_EREIGNIS_KEY = '__testruhe__';

// Die Stoerquellen, die eine Fixture-Messung kapern koennen - ALLE DREI. In einen Fixture-
// Spielstand einstreuen: Object.assign(stand, ruhigeUhren())
//
// (1) und (2) sind Uhren und lassen sich pinnen: bei 0 - dem Wert, den ein frischer Spielstand
// traegt - feuert der erste Check GARANTIERT (Arbeitsregel 18).
//
// (3) ist das EREIGNIS-BANNER, und hier stand bis zum 22.08.2026, es "faengt nur der Mitschnitt
// selbst". Das stimmt fuer eine UHR - `maybeSpawnRandomEvent` hat keine, sie wuerfelt je Tick mit
// 0,25 %, und `state.lastEventTime` wird zwar geschrieben, aber nirgends als Sperre gelesen
// (Arbeitsregel 70). Es gibt aber eine ANDERE Sperre, und sie steht in der ersten Zeile der
// Funktion: `if (state.activeEvent) return;`. Ein Ereignis mit einem Schluessel, den RANDOM_EVENTS
// nicht kennt, legt den Wuerfel damit still UND bleibt unsichtbar - der Renderer findet keine
// Definition und faellt in seinen else-Zweig, der das Banner auf display:none setzt. Das
// Ablaufdatum liegt weit in der Zukunft, damit der Tick es nicht per resolveEvent('B') aufloest.
//
// GEMESSEN am 22.08.2026 gegen eine Kopie der Spieldatei mit 90 % Spawn je Tick, beide Richtungen:
//   ohne Riegel  test_klappen_kollision EXIT=1, Klick-Reparatur nach 3 Anlaeufen erschoepft,
//                Banner 153 bzw. 207 px, 4 Pruefungen rot
//   mit Riegel   EXIT=0, streuEreignisWeggeklickt 0, Banner 0 px, alles gruen
// Der Riegel VERHINDERT also, statt zu reparieren, und ein schnellerer Wuerfel hebelt ihn nicht aus.
//
// DIE REGEL DER EINBAUSTELLE: Der Spread steht VORNE im Fixture-Literal
// (`{ ...ruhigeUhren(), tutorialSeen:true, ... }`), damit alles, was danach kommt, GEWINNT. Wer ein
// ECHTES Ereignis messen will, setzt `activeEvent` also einfach dahinter auf einen echten
// RANDOM_EVENTS-Schluessel und bekommt es. Andersherum - Spread am Ende - haette der Helfer ein
// bewusst gesetztes Ereignis STILL ueberschrieben, und der Test haette gemessen, dass kein Banner
// steht, obwohl er eines wollte. `test_klappen_kollision` zeigt beide Haelften in einer Datei:
// Object.assign(s, ruhigeUhren()) und danach das echte `activeEvent` - gemessen Banner 138 px
// (390x844) bzw. 164 px (360x740) MIT, 0 px OHNE, gegen eine Kopie mit 90 % Spawn je Tick.
function ruhigeUhren(stunden) {
  const weit = Date.now() + (stunden || 1) * 3600 * 1000;
  return {
    nextPlanetEventCheck: weit,
    nextTraderCheck: weit,
    activeEvent: { key: RUHE_EREIGNIS_KEY, startTime: 0, expiresAt: Date.now() + 86400000 }
  };
}

/* version.txt abfangen - gegen den haeufigsten Wackler der Suite (04.09.2026).
   ------------------------------------------------------------------------------------------------
   GEMESSEN: `test_fraktionsgebiet_karte` fiel in 14 von 20 Prueflauf-Protokollen eines Tages als
   "Lastsymptom" auf und war einzeln jedes Mal gruen. Die Ursache ist kein Zufall und keine Last im
   eigentlichen Sinn, sondern eine KANTE: Das Spiel ruft `setTimeout(checkLiveVersionUpdate, 15000)`,
   und der Abruf von `version.txt` scheitert unter `file://` an CORS - sichtbar als Konsolenfehler.
   Der Test dauert gemessen 19-20 s, liegt also knapp hinter der Kante; unter Last verschiebt sich
   alles nach hinten, und der Fehler faellt mal ins Messfenster und mal nicht.

   WARUM ABFANGEN UND NICHT WEGFILTERN: Ein Filter auf die Meldung ("CORS" ignorieren) macht den Test
   auch fuer ECHTE CORS-Fehler blind - er wuerde die Pruefung schwaechen, um sie gruen zu bekommen.
   Hier wird stattdessen die URSACHE beseitigt: Die Anfrage wird beantwortet, wie es der Test mit
   den api-Routen ohnehin tut, und der Fehler entsteht gar nicht erst.
   (Das Routenmuster steht bewusst nur im Code darunter: Ein Glob mit Sternchen und Schraegstrich
   beendet einen Blockkommentar - genau daran ist der erste Entwurf dieser Zeilen gescheitert.)

   DIE ANTWORT IST BEWUSST "0.0.0": Sie ist nach VERSION_TXT_MUSTER gueltig und immer AELTER als die
   laufende Version. Eine neuere wuerde `scheduleAutoReload` ausloesen und die Seite mitten im Test
   neu laden - aus einem stillen Wackler wuerde ein lauter.

   Betrifft potenziell jeden Browser-Test, der Konsolenfehler zaehlt UND laenger als 15 s laeuft
   (gemessen: 36 Tests zaehlen Konsolenfehler). Beobachtet wurde bisher nur der eine; wer einen
   zweiten findet, braucht hier eine Zeile statt einer neuen Fehlersuche. */
async function versionAbfangen(page) {
  await page.route('**/version.txt*', r => r.fulfill({
    status: 200, contentType: 'text/plain', body: '0.0.0'
  }));
}

function ueberspringen(grund) {
  console.log('SKIP - ' + grund);
  console.log('\nPASS (übersprungen)');
  process.exit(0);
}

module.exports = { chromium, devices, starteBrowser, BROWSER, SPIELDATEI, SPIEL_URL, SERVER_JS, WURZEL, pruefer, ueberspringen, logMitschnitt, logZeilen, logMarke, ruhigeUhren, versionAbfangen };
