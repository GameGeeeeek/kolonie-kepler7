// Jede Test-Vorlage muss den Schluessel benutzen, den das SPIEL liest (05.09.2026).
//
//   node tests/test_spielstand_schluessel.js
//
// WARUM ES DIESEN WAECHTER GIBT. Vier Vorposten-Tests legten ihren Spielstand unter
// `kepler7-save-v1` ab; das Spiel liest `STORE_KEY = 'kepler7-save-v3'`. Die Vorlage kam damit NIE
// an - jede Pruefung darin, die an Rohstoffen, Flotte oder Gebaeuden haengt, mass den
// Startzustand statt der Vorlage. Solche Tests sind still gruen aus dem falschen Grund, und das
// ist schlimmer als ein roter Test: Ein roter meldet sich.
//
// Schlimmer noch war die FOLGE: Aus der Beobachtung „die Flotte bleibt leer" wurde die Ursache
// „der Spielstand dieser Testfamilie laedt nicht" - eine Vermutung, die nie erneut gemessen wurde
// und als Tatsache in zwei weitere Tests abgeschrieben wurde. Sie war falsch; der Spielstand laedt.
//
// Der Waechter ist absichtlich stumpf: Er liest den Schluessel aus dem Spiel und vergleicht ihn mit
// jedem `kepler7-save-*`-Literal in tests/. Keine Heuristik, keine Ausnahmeliste.
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const path = require('path');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const TESTS = path.dirname(__filename);
const spiel = fs.readFileSync(SPIELDATEI, 'utf8');

/* DER SCHLUESSEL WIRD AUS DEM SPIEL GELESEN, nie hier eingetippt - sonst waere dieser Test die
   zweite Kopie derselben Zeichenkette und ginge beim naechsten Wechsel genauso schief wie die
   Vorlagen, die er bewacht. */
const m = spiel.match(/const STORE_KEY = '([^']+)';/);
check('1-anker: STORE_KEY ist im Spiel auffindbar (sonst misst dieser Test nichts)',
  !!m && /^kepler7-save-/.test(m[1]), { gefunden: m && m[1] });
const SOLL = m ? m[1] : null;

const dateien = fs.readdirSync(TESTS).filter(f => f.endsWith('.js'));
const falsch = [];
let mitVorlage = 0;
for (const f of dateien) {
  if (f === path.basename(__filename)) continue;   // die eigene Beschreibung zaehlt nicht
  const inhalt = fs.readFileSync(path.join(TESTS, f), 'utf8');
  /* Nur ZUWEISUNGEN als Speicherschluessel zaehlen (`'kepler7-save-x': ...` oder
     `setItem('kepler7-save-x'`), nicht jede Erwaehnung: Ein Kommentar, der den alten Schluessel
     als Fehlerbeschreibung nennt, ist kein Fehler - er ist die Begruendung dieses Waechters. */
  const treffer = [...inhalt.matchAll(/['"](kepler7-save-[a-z0-9]+)['"]\s*(?::|,|\))/g)].map(x => x[1]);
  if (!treffer.length) continue;
  mitVorlage++;
  for (const t of new Set(treffer)) if (t !== SOLL) falsch.push(f + ' -> ' + t);
}
check('1b-anker: es gibt ueberhaupt Tests mit einer Spielstand-Vorlage (sonst misst 1c nichts)',
  mitVorlage >= 20, { dateienMitVorlage: mitVorlage, gesamt: dateien.length });
check('1c: jede Test-Vorlage benutzt den Schluessel, den das Spiel liest',
  falsch.length === 0, { soll: SOLL, abweichend: falsch.slice(0, 10), anzahl: falsch.length });

ende();

/* GEGENPROBE (gemessen 05.09.2026): In einer beliebigen Testdatei den Schluessel auf
   `kepler7-save-v1` zuruecksetzen -> 1c faellt und nennt Datei und Schluessel. Genau der Zustand,
   in dem vier Vorposten-Tests monatelang waren.
   Und andersherum: `STORE_KEY` im Spiel auf einen anderen Wert setzen -> 1c faellt fuer ALLE
   Vorlagen auf einmal. Das ist gewollt: Ein Wechsel des Schluessels ist eine Migration, und sie
   soll laut sein. */
