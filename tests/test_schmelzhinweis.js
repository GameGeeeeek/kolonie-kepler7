// Verschmelzen-Tooltip nennt die Erhalt-Regeln (v8.450.0, Task #41).
//
// HINTERGRUND: Der 3->1-Knopf sagte nur "3x Selten zu 1x Episch verschmelzen" und verschwieg,
// was fuseModules wirklich tut. Die reale Falle: Wer auf sein Exemplar mit SCHWACHEN Substats
// klickt, behaelt die schwachen und verfeuert das gute Exemplar als Futter - ohne Warnung.
//
// GEPRUEFT WIRD:
//   1) Beide Verschmelzen-Knoepfe (Standort + Klasse) nennen im title die drei Regeln:
//      Erhalt von Stufe+Substats des angeklickten Moduls, bester Hauptwert-Wurf der drei,
//      Verbrauchsreihenfolge/Geschwister-Definition.
//   2) Der Tooltip sagt die WAHRHEIT: die genannten Regeln stehen so in fuseModules
//      (Substats aus dem angeklickten instKey, Math.max ueber die Wuerfe, angeklicktes
//      Modul zuerst in der Verbrauchsfolge). Regel 6: Slice-Anker existenzgeprueft.
//   3) Auch die Schiffsklassen-Hilfe nennt die Erhalt-Regeln (die Standort-Hilfe tat es
//      schon vorher).
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.449.0) fallen 1a/1b und 3 durch.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) beide Tooltips
// Die Regel-Formulierung einmal definieren und an beiden Knoepfen erwarten - der Text muss
// im selben title-Attribut stehen wie die Seltenheits-Zeile des jeweiligen Systems.
const REGELN = 'Erhalten bleiben Stufe und Substats DIESES Moduls; der beste Hauptwert-Wurf der drei wandert ins Ergebnis. Verbraucht wird zuerst dieses Modul, dann gleichartige (gleicher Typ, Seltenheit und Stufe – Zweitwerte dürfen abweichen).';
check('1a: der Standort-Verschmelzen-Knopf nennt die Regeln',
  JS.includes('${MODULE_RARITY[nextRar].label} verschmelzen. ' + REGELN));
check('1b: der Klassen-Verschmelzen-Knopf nennt die Regeln',
  JS.includes('${MODULE_RARITY[nextRarS].label} verschmelzen. ' + REGELN));

// ---- 2) der Tooltip sagt die Wahrheit (Abgleich mit fuseModules)
const von = JS.indexOf('function fuseModules(isShip, instKey){');
const bis = von < 0 ? -1 : JS.indexOf('\n  }', von);
check('2a: fuseModules-Slice gefunden', von > 0 && bis > von);
if (von < 0) return ende();
const fuse = JS.slice(von, bis);
check('2b: Substats kommen wirklich aus dem ANGEKLICKTEN instKey',
  fuse.includes("let fuseSubs = (String(instKey).split(':')[3] || '')"));
check('2c: der beste Hauptwert-Wurf der drei wird wirklich uebernommen',
  fuse.includes('besterWert = Math.max(besterWert, moduleWertOf(vk2));'));
check('2d: das angeklickte Modul steht wirklich zuerst in der Verbrauchsfolge',
  fuse.includes('const verbrauchsfolge = [instKey].concat(fuseGeschwister(inv, instKey).filter(k => k !== instKey));'));

// ---- 3) Schiffsklassen-Hilfe
check('3: die Schiffsklassen-Hilfe nennt die Erhalt-Regeln',
  /Auch hier gilt die <strong>Modul-Schmelze<\/strong>: 3 gleiche verschmelzen \(Stufe und Substats des <em>angeklickten<\/em> Moduls bleiben erhalten, der beste Hauptwert-Wurf der drei zählt\)/.test(JS));

ende();
