// Die vollstaendige Patchnotes-Historie fuer Tests (seit 01.09.2026).
//
// Bis dahin standen alle Versionen als Literal im PATCHNOTES-Block der Spieldatei, und Tests, die
// "die Patchnote zu v8.356.0 existiert noch" oder "IRGENDEIN Eintrag nennt alle drei Zahlen"
// pruefen, suchten einfach in der Spieldatei. Jetzt bleiben nur die neuesten PATCHNOTES_IM_SPIEL
// Eintraege im Spiel, der Rest liegt in patchnotes-archiv.json (build-patchnotes.js rotiert).
// Die Historie ist damit nicht weg, sie liegt an zwei Stellen - und dieses Modul ist die EINE
// Stelle, die beide zusammensetzt, damit nicht zehn Tests je eine eigene Fassung davon tragen.
//
//   allePatchnotes(src)   -> Array der Eintraege { version, date, changes }, neueste zuerst
//   patchnotesText(src)   -> die Historie als EIN Text im Wortlaut des Spiel-Literals: der
//                            Block-Text aus der Spieldatei, dahinter je Archiveintrag ein Block
//                            in derselben Form (`    { version:'…', date:'…', changes:[ … ]},`).
//                            Regex- und indexOf-Pruefungen, die bisher ueber den Block liefen,
//                            laufen damit unveraendert ueber die ganze Historie.
//
// `src` ist optional: ohne Argument wird die Spieldatei aus lib/spieldatei gelesen. Tests, die
// die Datei ohnehin schon im Speicher haben, reichen sie durch (kein zweites 5-MB-Lesen).
//
// Bewusst NICHT hier: das Ausschneiden des Blocks fuer verneinende Pruefungen ("alter Text steht
// nicht mehr im Live-Code"). Das bleibt in den Tests, weil es dort um die Spieldatei OHNE
// Historie geht - dafuer ist das Archiv ohnehin unsichtbar, es liegt in einer anderen Datei.
const fs = require('fs');
const path = require('path');
const { SPIELDATEI, WURZEL } = require('./spieldatei');

const START = '  const PATCHNOTES = [';
const ENDE = '\n  ];';

function grenzen(src){
  const v = src.indexOf(START);
  const b = v < 0 ? -1 : src.indexOf(ENDE, v);
  if (v < 0 || b < 0) throw new Error('PATCHNOTES-Block in der Spieldatei nicht gefunden');
  return { v, b };
}

function archivLesen(){
  const p = path.join(WURZEL, 'patchnotes-archiv.json');
  if (!fs.existsSync(p)) return [];
  const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(arr)) throw new Error('patchnotes-archiv.json ist kein Array');
  return arr;
}

function quelle(src){ return typeof src === 'string' ? src : fs.readFileSync(SPIELDATEI, 'utf8'); }

function allePatchnotes(src){
  const s = quelle(src);
  const { v, b } = grenzen(s);
  const imSpiel = new Function('return [' + s.slice(v + START.length, b) + '\n]')();
  return imSpiel.concat(archivLesen());
}

function literal(text){
  return "'" + String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
}
function eintragLiteral(n){
  return "    { version:'" + n.version + "', date:'" + n.date + "', changes:[\n" +
    (n.changes || []).map(c => '      ' + literal(c)).join(',\n') + '\n    ]},';
}

function patchnotesText(src){
  const s = quelle(src);
  const { v, b } = grenzen(s);
  return s.slice(v, b) + '\n' + archivLesen().map(eintragLiteral).join('\n') + ENDE;
}

module.exports = { allePatchnotes, patchnotesText, archivLesen };
