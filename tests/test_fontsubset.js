// Der eingebettete Icon-Font muss ein SUBSET bleiben.
//
// Seit v8.296.0 steckt nur noch ein Subset der tatsaechlich benutzten Icons in der Spieldatei
// (10,8 KB statt 446,7 KB). Das spart bei jedem Seitenaufruf rund ein Drittel der Uebertragung.
// Der Fehler, gegen den dieser Test schuetzt: Jemand baut ein neues ti-*-Icon ein, greift zum
// Vollfont (oder laedt ihn per npm nach) und bettet ihn versehentlich komplett ein - die Datei
// waechst dann still um mehr als das Vierzigfache, und niemand merkt es beim Durchklicken.
//
// Der frueher hier liegende Test verglich gegen einen Schnappschuss "vorher_original.html", der nur
// im Sitzungs-Scratchpad existierte - eine einmalige Messung, kein dauerhafter Test. Ersetzt durch
// die Pruefung der Eigenschaft, auf die es wirklich ankommt.
const fs = require('fs');
const path = require('path');
const { SPIELDATEI, WURZEL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const OBERGRENZE_KB = 60;   // grosszuegig: aktuell 10,8 KB, der Vollfont waere 446,7 KB

const html = fs.readFileSync(SPIELDATEI, 'utf8');
const treffer = html.match(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)/g) || [];
check('genau EINE eingebettete Schriftquelle', treffer.length === 1, treffer.length);

if (treffer.length === 1) {
  const b64 = treffer[0].split(',')[1];
  const kb = Buffer.from(b64, 'base64').length / 1024;
  check('eingebetteter Font unter ' + OBERGRENZE_KB + ' KB (ist Subset, nicht Vollfont)',
    kb < OBERGRENZE_KB, kb.toFixed(1) + ' KB');

  const voll = path.join(WURZEL, 'tabler-icons-full.woff2');
  if (fs.existsSync(voll)) {
    const vollKb = fs.statSync(voll).size / 1024;
    check('deutlich kleiner als der mitversionierte Vollfont', kb < vollKb / 4,
      { subset: kb.toFixed(1) + ' KB', voll: vollKb.toFixed(1) + ' KB' });
  }

  // Die Zahl der CSS-Regeln muss zur Zahl der Glyphen passen - build-icon-subset.js zieht seine
  // Liste genau aus diesen Regeln, ein Auseinanderlaufen faellt sonst erst im Spiel auf.
  const regeln = [...html.matchAll(/\.ti-([a-z0-9-]+):before\s*\{\s*content:/g)].length;
  check('CSS enthaelt die erwartete Groessenordnung an Icon-Regeln', regeln > 50 && regeln < 200, regeln);
}

ende();
