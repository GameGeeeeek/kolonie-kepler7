// Erfolg "Legendaere Ausruestung" (v8.455.0, Task #46): Reparatur der endsWith-Pruefung.
//
// HINTERGRUND: check prueft k.endsWith(':legendaer') - seit Modul-Level und Substats tragen
// ausgeruestete Schluessel weitere Segmente (waffen:legendaer:3:atk15.w107). Nur ein nacktes,
// unaufgewertetes Legendaer-Modul zaehlte; wer aufwertete oder direkt Mythisch/Exotisch trug,
// bekam den Erfolg NIE.
//
// GEPRUEFT WIRD (der Helfer AUSGEFUEHRT, mit der ECHTEN MODULE_RARITY-Reihenfolge):
//   1) Genau die frueher verlorenen Faelle: aufgewertetes/substat-tragendes Legendaer-Modul,
//      Mythisch/Exotisch statt Legendaer, Schiffsklassen-System - alle zaehlen jetzt.
//      Und die Gegenrichtung: Episch oder leer zaehlt weiterhin NICHT.
//   2) Der Erfolg nutzt den Helfer in check UND progress; die alte endsWith-Pruefung ist weg.
//   3) Die Beschreibungen sagen die Wahrheit ("oder besser"; module1 prueft Standort-Module
//      und heisst nicht mehr "Schiffsmodul").
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.454.0) fallen 1a und 2a-2c durch.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- Extraktion (Regel 6: Anker-Existenz vor dem Slice)
const von = JS.indexOf('function equippedMindestensLegendaer(s){');
const bis = von < 0 ? -1 : JS.indexOf('\n  }', von);
check('1a: equippedMindestensLegendaer gefunden', von > 0 && bis > von);
if (von < 0) return ende();
const quelle = JS.slice(von, bis + 4);

// Echte Seltenheits-Reihenfolge aus der Datei (Regel 4), wie in test_inventarsortierung.
const rarVon = JS.indexOf('const MODULE_RARITY = {');
const rarBis = JS.indexOf('};', rarVon);
const rarKeys = [...JS.slice(rarVon, rarBis).matchAll(/^\s{4}(\w+):\s*\{/gm)].map(m => m[1]);
// Untergrenze statt fester Zahl (16.08.2026): Die Aussage ist "die Tabelle wurde gelesen", nicht
// "es sind genau sieben" - mit Primordial sind es acht (Arbeitsregel 3).
check('1b: MODULE_RARITY-Reihenfolge extrahiert', rarKeys.length >= 7, rarKeys);
const RARITY_STUB = '{' + rarKeys.map(k => k + ':{}').join(',') + '}';
const helfer = new Function('const MODULE_RARITY = ' + RARITY_STUB + ';\n' + quelle
  + '\nreturn equippedMindestensLegendaer;')();

// ---- 1) die frueher verlorenen Faelle, AUSGEFUEHRT
check('1c: aufgewertetes Legendaer-Modul mit Substats zaehlt (der Kernfall)',
  helfer({ equippedModules: { home: ['waffen:legendaer:3:atk15.w107'] } }) === true &&
  'waffen:legendaer:3:atk15.w107'.endsWith(':legendaer') === false);  // beweist: alte Pruefung verlor ihn
check('1d: nacktes Legendaer-Modul zaehlt weiterhin',
  helfer({ equippedModules: { home: ['waffen:legendaer'] } }) === true);
check('1e: Mythisch und Exotisch zaehlen als "besser"',
  helfer({ equippedModules: { kolonie1: ['panzerung:mythisch:5'] } }) === true &&
  helfer({ equippedModules: { home: ['waffen:exotisch:2:def8.w95'] } }) === true);
check('1f: auch das Schiffsklassen-System zaehlt',
  helfer({ equippedShipModules: { frachter: ['fracht:legendaer:2'] } }) === true);
check('1g: Episch oder leer zaehlt NICHT',
  helfer({ equippedModules: { home: ['waffen:episch:9:atk20.w110'] } }) === false &&
  helfer({}) === false);

// ---- 2) der Erfolg nutzt den Helfer, die alte Pruefung ist weg
const eintrag = JS.slice(JS.indexOf("key:'module_legendary'"), JS.indexOf("key:'module_legendary'") + 400);
check('2a: check nutzt den Helfer', eintrag.includes('check: s => equippedMindestensLegendaer(s)'));
check('2b: progress nutzt denselben Helfer (keine zweite Rechnung)',
  eintrag.includes('equippedMindestensLegendaer(s) ? 1 : 0'));
// Regel 6, zweiter Halbsatz, live erlebt: der Kommentar am Helfer ZITIERT die alte Pruefung -
// deshalb wird hier das konkrete Code-Fragment gesucht, nicht der blosse Text.
check('2c: die alte endsWith-Pruefung ist als CODE restlos verschwunden',
  !JS.includes("arr.some(k=>k.endsWith(':legendaer'))"));

// ---- 3) die Beschreibungen sagen die Wahrheit
check('3a: die Beschreibung nennt "Legendär oder besser" und beide Systeme',
  /desc:'Rüste ein Modul der Seltenheit Legendär oder besser aus[^']*'/.test(JS));
check('3b: module1 spricht von Standort-Modulen (geprueft werden equippedModules)',
  JS.includes("desc:'Rüste ein Standort-Modul aus.'") && !JS.includes("desc:'Rüste ein Schiffsmodul aus.'"));

ende();
