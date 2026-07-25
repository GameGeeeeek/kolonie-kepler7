// Findet Funktionen, deren Name im gesamten <script>-Block nur EINMAL vorkommt - also nur in ihrer
// eigenen Definition und an keiner Aufrufstelle. Bei 1112 Funktionen in einer einzigen Datei faellt
// so etwas von Hand nicht auf: shipSkinUnlocked und counterRoleOf standen unbemerkt herum, bis der
// Bestand am 25.07.2026 einmal maschinell durchgezaehlt wurde (v8.298.9 hat beide entfernt).
//
// Reiner Textscan, kein Browser - laeuft in Millisekunden.
//
// Grenzen des Verfahrens, bewusst in Kauf genommen:
//   - Funktionen, die ausschliesslich ueber einen zusammengebauten Namen aufgerufen werden
//     (window['foo'+bar]()), wuerden faelschlich als tot gelten. Dieses Muster gibt es hier nicht -
//     das Spiel steckt komplett in einer IIFE und kennt keine dynamische Namensaufloesung.
//   - Absichtlich vorgehaltene Funktionen gehoeren in ERLAUBT, mit Begruendung. Das ist der Punkt
//     des Tests: nicht verbieten, sondern eine bewusste Entscheidung erzwingen.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// Name -> Grund, warum die Funktion trotz fehlender Aufrufstelle bleiben soll.
const ERLAUBT = {};

const html = fs.readFileSync(SPIELDATEI, 'utf8');
const script = (html.match(/<script>([\s\S]*)<\/script>/) || ['', ''])[1];
check('Skriptblock gefunden', script.length > 1000, script.length);

const namen = [...script.matchAll(/^\s*(?:async )?function ([a-zA-Z_$][\w$]*)\(/gm)].map(m => m[1]);
check('Funktionsdefinitionen gefunden', namen.length > 500, namen.length);

const tot = namen.filter(n => {
  if (ERLAUBT[n]) return false;
  return (script.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length <= 1;
});
check('keine Funktion ohne Aufrufstelle', tot.length === 0, tot);

// Gegenprobe, damit der Test nicht bloss deshalb gruen ist, weil der Scan gar nichts findet:
// eine erfundene Funktion muss zuverlaessig als tot erkannt werden.
const probe = script + '\n  function nurZumTestenNieAufgerufen(){ return 1; }\n';
const probeNamen = [...probe.matchAll(/^\s*(?:async )?function ([a-zA-Z_$][\w$]*)\(/gm)].map(m => m[1]);
const probeTot = probeNamen.filter(n => (probe.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length <= 1);
check('Gegenprobe: eine eingeschmuggelte tote Funktion wird gefunden',
  probeTot.length === 1 && probeTot[0] === 'nurZumTestenNieAufgerufen', probeTot);

// Doppelte Funktionsdeklarationen: JS ueberschreibt bei zwei function-Deklarationen desselben Namens
// still die erste mit der zweiten. Bei dieser Dateigroesse schon passiert (renderWorldBoss existierte
// zweimal, die spaetere/falsche gewann) - siehe CLAUDE.md. Verschachtelte Funktionen in getrennten
// Gueltigkeitsbereichen sind dagegen legitim, deshalb zaehlt nur die oberste Einrueckungsebene.
const oberste = [...script.matchAll(/^ {2}(?:async )?function ([a-zA-Z_$][\w$]*)\(/gm)].map(m => m[1]);
const doppelt = [...new Set(oberste.filter((n, i) => oberste.indexOf(n) !== i))];
check('keine doppelte Funktionsdeklaration auf oberster Ebene', doppelt.length === 0, doppelt);

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
