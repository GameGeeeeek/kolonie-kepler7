// Wo liegen Spieldatei und Backend-Quelltext? - OHNE Playwright (21.08.2026).
//
// WARUM ES DIESE DATEI GIBT
// -------------------------
// Die Pfade standen bisher nur in lib/umgebung.js. Wer sie dort holt, zieht aber Playwright mit
// hoch (gemessen: 282 ms je Testlauf), und die reinen QUELLTEXT-Tests brauchen keinen Browser.
// Genau deshalb hatten 18 von ihnen ihren eigenen `path.join(__dirname, '..', ...)` - und damit
// den Defekt, um den es hier geht: Sie ignorieren KEPLER_SPIELDATEI still. Eine Gegenprobe gegen
// eine Kopie las bei ihnen die ECHTE Datei und sah damit aus wie bestanden (CLAUDE.md, Korrektur
// zu Regel 14; am 21.08.2026 in dieser Form wieder aufgetreten).
//
// Diese Datei ist deshalb die EINE Quelle der Pfade; lib/umgebung.js bezieht sie von hier und
// reicht sie unveraendert weiter. Zwei Fassungen derselben Pfadlogik waeren genau die zweite
// Wahrheit, gegen die das ganze Vorgehen sich richtet.
const fs = require('fs');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..', '..');

function ersterVorhandener(kandidaten) {
  for (const k of kandidaten) { try { if (fs.existsSync(k)) return k; } catch (e) {} }
  return null;
}

// KEPLER_SPIELDATEI zeigt auf eine KOPIE unter anderem Pfad. Gebraucht wird das für Gegenproben
// (Regel 1): Der übliche Griff dafür war `cp alt.html weltraum_kolonie.html` … messen …
// zurückkopieren - also ein Edit an der Spieldatei, das jeden gleichzeitig laufenden Prüflauf
// wertlos macht (Regel 14, Nachtrag vom 15.08.2026).
const SPIELDATEI = process.env.KEPLER_SPIELDATEI || path.join(WURZEL, 'weltraum_kolonie.html');
const SPIEL_URL = 'file://' + SPIELDATEI;

// Ein paar Tests vergleichen Frontend und Backend Zeile für Zeile. Liegt das Backend-Repo nicht
// daneben, überspringen sie sich selbst mit klarer Meldung, statt fehlzuschlagen.
const SERVER_JS = ersterVorhandener([
  process.env.KEPLER_BACKEND_SERVER,
  path.join(WURZEL, '..', 'kolonie-kepler7-backend', 'server.js'),
  '/workspace/kolonie-kepler7-backend/server.js'
].filter(Boolean));

// Seit den KI-Kampfberichten (E1a, 28.08.2026) gibt es eine dritte Quelle: das Messwerkzeug in
// gamegeeeeek-ai-core. Prompt und Sperren liegen dort UND im Backend - dort gemessen, hier
// entscheidend -, und der Paritaetstest haelt sie zusammen. Dieselbe Behandlung wie SERVER_JS:
// per Env umleitbar (sonst waere jede Gegenprobe still wirkungslos) und ueberspringbar, wenn das
// Nachbar-Repo nicht daneben liegt.
const AI_CORE_MESSLAUF = ersterVorhandener([
  process.env.KEPLER_AI_CORE_MESSLAUF,
  path.join(WURZEL, '..', 'gamegeeeeek-ai-core', 'tools', 'kampftext_messlauf.py'),
  '/workspace/gamegeeeeek-ai-core/tools/kampftext_messlauf.py'
].filter(Boolean));

module.exports = { WURZEL, SPIELDATEI, SPIEL_URL, SERVER_JS, AI_CORE_MESSLAUF, ersterVorhandener };
