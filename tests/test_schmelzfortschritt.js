// Schmelz-Fortschritt "2/3 zum Verschmelzen" (v8.452.0, Task #43).
//
// HINTERGRUND: Unterhalb von MODULE_FUSE_COUNT Geschwistern verschwand der 3->1-Knopf
// komplett - wer 2 Mythische desselben Typs besass, sah nirgends, dass ihm genau EIN Modul
// zum einzigen Exotisch-Weg fehlt. Jetzt zeigt die Inventar-Karte den Fortschritt, sobald
// nur noch eines fehlt - mit denselben Seltenheits-Regeln wie der Knopf selbst.
//
// GEPRUEFT WIRD:
//   1) Beide Inventare (Standort + Klasse) rendern den Hinweis mit der Bedingung
//      "genau MODULE_FUSE_COUNT - 1 Geschwister" - nicht frueher (Dauerrauschen) und
//      nicht als zweite Zaehlung neben dem Knopf (beide lesen dieselbe fuseAnz-Variable).
//   2) Dieselben Seltenheits-Regeln wie der Knopf: kein Hinweis, wenn die naechste Stufe
//      Mythisch waere (dorthin fuehrt kein Verschmelzen). Der Mythisch->Exotisch-Fall
//      bleibt dadurch automatisch erlaubt.
//   3) Der Tooltip erklaert, was "gleichartig" heisst (Zweitwerte duerfen abweichen),
//      und die Hilfe nennt den Hinweis.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.451.0) fallen 1a-1d und 3b durch.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) beide Inventare, EINE Zaehlung je Karte
check('1a: Standort-Karte zieht die Geschwister-Zahl in fuseAnz heraus',
  JS.includes('const fuseAnz = fuseAnzahl(state.modules, instKey);') &&
  JS.includes('const canFuse = fuseAnz >= MODULE_FUSE_COUNT'));
check('1b: Klassen-Karte ebenso (fuseAnzS)',
  JS.includes('const fuseAnzS = fuseAnzahl(state.shipModules, instKey);') &&
  JS.includes('const canFuseS = fuseAnzS >= MODULE_FUSE_COUNT'));
check('1c: der Standort-Hinweis erscheint GENAU beim vorletzten Exemplar',
  JS.includes("${(fuseAnz === MODULE_FUSE_COUNT - 1 && nextRar && nextRar !== 'mythisch')?"));
check('1d: der Klassen-Hinweis ebenso',
  JS.includes("${(fuseAnzS === MODULE_FUSE_COUNT - 1 && nextRarS && nextRarS !== 'mythisch')?"));
// Angezeigt wird die GEZAEHLTE Zahl, keine getippte (Regel 2) - aendert sich
// MODULE_FUSE_COUNT je, zieht die Anzeige automatisch mit.
check('1e: die Anzeige nutzt die gezaehlten Werte, keine Literale',
  (JS.match(/\$\{fuseAnzS?\}\/\$\{MODULE_FUSE_COUNT\} zum Verschmelzen/g) || []).length === 2);

// ---- 2) gleiche Seltenheits-Regeln wie der Knopf (Abgleich statt Kopie-Vertrauen)
{
  // Der Hinweis uebernimmt exakt das Seltenheits-Gate des Knopfs: nextRar && !== 'mythisch'.
  // Wuerde der Knopf sein Gate aendern und der Hinweis nicht, widersprechen sich beide -
  // deshalb wird hier geprueft, dass BEIDE Bedingungen dasselbe Gate-Fragment tragen.
  const gate = "&& nextRar && nextRar !== 'mythisch'";
  const gateS = "&& nextRarS && nextRarS !== 'mythisch'";
  const anzKnopf = (JS.match(/ MODULE_FUSE_COUNT && nextRar && nextRar !== 'mythisch'/g) || []).length;
  check('2a: Knopf und Hinweis tragen dasselbe Seltenheits-Gate (Standort)',
    JS.includes('fuseAnz === MODULE_FUSE_COUNT - 1 ' + gate) && anzKnopf >= 1);
  check('2b: Knopf und Hinweis tragen dasselbe Seltenheits-Gate (Klasse)',
    JS.includes('fuseAnzS === MODULE_FUSE_COUNT - 1 ' + gateS));
}

// ---- 3) Tooltip + Hilfe
check('3a: der Tooltip erklaert "gleichartig" (Zweitwerte duerfen abweichen)',
  (JS.match(/Noch 1 gleichartiges Modul \(gleicher Typ, Seltenheit und Stufe – Zweitwerte dürfen abweichen\)/g) || []).length === 2);
check('3b: die Hilfe nennt den Fortschritts-Hinweis',
  JS.includes('fehlt nur noch eines, zeigt die Inventar-Karte „2/3 zum Verschmelzen"'));

ende();
