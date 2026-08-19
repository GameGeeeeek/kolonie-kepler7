// Eine PvE-Auflösung ZIEHT VERLUSTE AB - sie gibt keine Überlebenden zurück (19.08.2026).
//
//   node tests/test_flotte_rueckkehr.js
//
// DER ANLASS IST EIN AUSGELIEFERTER FEHLER, kein theoretischer. Die Schiffe eines Verbandes
// bleiben während der ganzen Mission in `fleet` gezählt - nur der Flottenplatz ist belegt, und
// `computeAwayByType()` hält sie als "unterwegs" von einer zweiten Verplanung zurück. Wer beim
// Auflösen die ÜBERLEBENDEN wieder addiert, zählt sie damit ein zweites Mal.
// Gemessen am Stand v8.581.0 (Festungsschlag und Anfechtung, beide live): 100 Jäger im Bestand,
// 40 davon im Verband, 4 Verluste - danach standen 136 Jäger da. Ein Schlag mit der Vorauswahl
// (also der ganzen Kampfflotte) hat den Bestand je Mal nahezu verdoppelt.
//
// WARUM DIESER TEST DATENGETRIEBEN IST UND KEINE NAMENSLISTE FÜHRT (Arbeitsregel 40): Der Fehler
// entstand durch KOPIEREN - die Nest-Auflösung hat ihn vom Festungsschlag geerbt, der ihn von der
// Anfechtung hatte. Eine vierte PvE-Missionsart würde ihn genauso erben. Geprüft wird deshalb
// JEDE Funktion der Form `…Aufloesen(m, planetKey, fleet)`, ohne dass jemand an sie gedacht haben
// muss.
//
// GEPRUEFT WIRD:
//   1. `pveVerlusteBuchen` existiert GENAU EINMAL und zieht ab (Arbeitsregel 43: zwei Kopien
//      können wieder auseinanderlaufen - genau das war der Vorfall).
//   2. Jede gefundene Auflösung delegiert dorthin.
//   3. Keine Auflösung addiert irgendwo auf `fleet[...]` - das ist die URSACHE, nicht das Symptom
//      einer einzelnen Schreibweise.
//   4. Der Helfer wird AUSGEFÜHRT und die Wirkung gemessen: Verluste abgezogen, Boden bei 0,
//      leeres `verluste` lässt den Bestand unangetastet (das ist der Fall "Server nicht
//      erreichbar / Ziel weitergezogen" - dort kommt die Flotte wirklich vollzählig heim).
//
// GEGENPROBE (in beide Richtungen ausgeführt): Eine Kopie der Spieldatei, in der eine Auflösung
// wieder `fleet[k] = (fleet[k]||0) + v` schreibt, lässt 2 und 3 anschlagen und nennt die Funktion.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');

// Kommentare leeren, bevor irgendetwas gezählt oder gesucht wird: Ein erklärender Kommentar
// zitiert hier zwangsläufig genau die Zeile, gegen die geprüft wird (Arbeitsregel 33/46).
const OHNE_KOMMENTARE = S
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

// ---- 1) Der Helfer ---------------------------------------------------------------------------
const defs = OHNE_KOMMENTARE.match(/function pveVerlusteBuchen\s*\(/g) || [];
check('1a: pveVerlusteBuchen ist genau einmal definiert', defs.length === 1, { gefunden: defs.length });

const hVon = OHNE_KOMMENTARE.indexOf('function pveVerlusteBuchen');
const hBis = hVon < 0 ? -1 : OHNE_KOMMENTARE.indexOf('\n  }', hVon);
const helfer = (hVon >= 0 && hBis > hVon) ? S.slice(hVon, hBis + 4) : '';
check('1b: der Rumpf des Helfers ist auffindbar', !!helfer, { laenge: helfer.length });
/* Hier steht bewusst KEIN vorzeitiges Ende: Am Stand VOR der Behebung gibt es den Helfer gar
   nicht, und genau dann sind die Abschnitte 2 und 3 die interessanten. Ein `return` an dieser
   Stelle hätte die Gegenprobe gegen den ursprünglichen Vorfall auf zwei Prüfungen verkürzt -
   rot aus dem falschen Grund (Arbeitsregel 34). */
check('1c: er ZIEHT AB und addiert nicht', !!helfer && /-\s*weg/.test(helfer) && !/\+\s*weg/.test(helfer),
  { rumpf: helfer.replace(/\s+/g, ' ').slice(0, 200) });

// ---- 2/3) Jede Auflösung ----------------------------------------------------------------------
/* Die Blöcke werden über die SIGNATUR gefunden, nicht über Namen. Endanker ist die nächste
   Funktionsdefinition auf derselben Einrückung; dass er existiert, wird geprüft - ohne diese
   Kontrolle liefe der Slice bei einem Fehlschlag fast bis zum Dateiende und die Aussage wäre
   vacuous (Arbeitsregel 6). */
const treffer = [...OHNE_KOMMENTARE.matchAll(/async function (\w*Aufloesen)\s*\(m, planetKey, fleet\)\s*\{/g)];
check('2-anker: es wurden Auflösungen gefunden', treffer.length >= 3,
  { anzahl: treffer.length, namen: treffer.map(t => t[1]) });

const ohneHelfer = [], mitAddition = [], ohneAnker = [];
for (const t of treffer){
  const von = t.index;
  const bis = OHNE_KOMMENTARE.indexOf('\n  }\n', von);
  if (bis < 0){ ohneAnker.push(t[1]); continue; }
  const rumpf = OHNE_KOMMENTARE.slice(von, bis);
  if (!/pveVerlusteBuchen\s*\(\s*fleet\s*,/.test(rumpf)) ohneHelfer.push(t[1]);
  // Jede Zuweisung auf fleet[...], die einen PLUS-Term enthält - unabhängig von der Schreibweise.
  const additionen = [...rumpf.matchAll(/fleet\[[^\]]+\]\s*=\s*[^;\n]*\+[^;\n]*/g)].map(x => x[0].trim());
  if (additionen.length) mitAddition.push({ funktion: t[1], zeilen: additionen });
}
check('2-ende: jeder Block hat seinen Endanker', ohneAnker.length === 0, { ohneAnker });
check('2: jede Auflösung bucht über pveVerlusteBuchen', ohneHelfer.length === 0, { ohneHelfer });
check('3: keine Auflösung addiert auf fleet[...]', mitAddition.length === 0, { mitAddition });

// ---- 4) Die gemessene Wirkung ------------------------------------------------------------------
let fn = null;
try { fn = new Function(helfer + '\nreturn pveVerlusteBuchen;')(); } catch (e) { fn = null; }
const messbar = typeof fn === 'function';
check('4-bau: der Helfer lässt sich ausführen', messbar, { typ: typeof fn });
/* Die drei Messungen laufen AUCH ohne Helfer - sie schlagen dann fehl und sagen warum. Hinter
   ein `if` gestellt hätte die Gegenprobe gegen den ursprünglichen Vorfall drei Prüfungen
   weniger gefahren, und der rote Exit-Code hätte genau das verdeckt (Arbeitsregel 34). */
const f1 = { jaeger: 100, destroyers: 20, frachter: 5 };
if (messbar) fn(f1, { jaeger: 4, destroyers: 1 });
check('4a: die Verluste sind abgezogen',
  messbar && f1.jaeger === 96 && f1.destroyers === 19 && f1.frachter === 5, { helferDa: messbar, flotte: f1 });

const f2 = { jaeger: 3 };
if (messbar) fn(f2, { jaeger: 99 });
check('4b: es gibt keinen negativen Bestand', messbar && f2.jaeger === 0, { helferDa: messbar, flotte: f2 });

const f3 = { jaeger: 80, destroyers: 12 };
if (messbar) fn(f3, {});
check('4c: ohne Kampf bleibt der Bestand unangetastet',
  messbar && f3.jaeger === 80 && f3.destroyers === 12, { helferDa: messbar, flotte: f3 });

ende();
