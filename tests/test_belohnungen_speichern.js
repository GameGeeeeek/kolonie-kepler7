// Jede abgeholte Belohnung muss SOFORT gespeichert werden.
//
// Der Anlass (gemessen am 21.08.2026): Von den acht Zweigen in claimPendingRewards() riefen
// GENAU ZWEI kein save() - ausgerechnet `festung` (seit v8.569.0) und `alien-nest` (seit
// v8.582.0). Warum das Datenverlust ist und nicht bloss Schlamperei:
//
//   POST /api/pending-rewards/claim macht serverseitig `list.shift()` und danach `saveDb()`
//   (server.js). Die Belohnung ist in dem Moment, in dem der Client sie in der Hand haelt, aus
//   der Warteschlange VERSCHWUNDEN - es gibt keinen zweiten Versuch. Schreibt der Client sie
//   nicht in den Spielstand, sind Hort, Protomaterie, Kampfpunkte, Erfahrung und Kredite weg,
//   sobald der Reiter geschlossen wird, bevor ein anderes Ereignis speichert.
//   claimPendingRewards() laeuft beim Start des Spiels - genau dann, wenn ein Spieler kurz
//   reinsieht und wieder zumacht.
//
// Die Funktion hat KEIN abschliessendes save() nach der Schleife; jeder Zweig ist selbst dafuer
// zustaendig. Geprueft wird deshalb datengetrieben JEDER Zweig, nicht eine Namensliste - ein
// neunter Belohnungstyp faellt damit auf, ohne dass jemand an ihn gedacht haben muss
// (Arbeitsregel 40).
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// Anker zuerst - ohne ihn liefe der Slice ins Leere und alles darunter waere vacuous (Regel 6).
const von = src.indexOf('async function claimPendingRewards()');
const bis = von < 0 ? -1 : src.indexOf("} catch(e){ /* still, kein Problem", von);
check('1-anker: claimPendingRewards laesst sich schneiden', von > 0 && bis > von, { von, bis });
const block = (von > 0 && bis > von) ? src.slice(von, bis) : '';

/* Kommentare leeren, BEVOR nach save() gesucht wird (Arbeitsregel 33). Der Erklaerkommentar im
   Festungs-Zweig ZITIERT den Aufruf ("die EINZIGEN der acht ohne save()") - eine rohe Textsuche
   haelt den Zweig damit faelschlich fuer versorgt. Genau daran ist die erste Gegenprobe zu diesem
   Test vorbeigelaufen: Sie benannte nur `alien-nest` statt beider Zweige. Zeilenkommentare werden
   nur geleert, wenn sie eine Zeile ANFANGEN oder hinter Code stehen ohne Anfuehrungszeichen davor -
   im geschnittenen Block gibt es keine Zeichenkette mit '//'. */
const ohneKommentare = block
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/^([^'"\n]*?)\/\/[^\n]*$/gm, (m, vor) => vor + ' '.repeat(m.length - vor.length));
check('2-vorab: das Leeren der Kommentare hat gegriffen (sonst zaehlt der Test Zitate mit)',
  ohneKommentare.length === block.length && !/EINZIGEN der acht/.test(ohneKommentare),
  { gleicheLaenge: ohneKommentare.length === block.length, zitatWeg: !/EINZIGEN der acht/.test(ohneKommentare) });

const grenzen = [...ohneKommentare.matchAll(/if \(r\.type === '([a-z-]+)'\)\{/g)];
check('2: die Belohnungszweige sind gefunden (mindestens acht)', grenzen.length >= 8,
  grenzen.map(m => m[1]));
check('2-anker: der erste Zweig steht nicht am Blockanfang (Vorspann vorhanden)',
  grenzen.length > 0 && grenzen[0].index > 100, grenzen.length ? grenzen[0].index : -1);

const ohneSave = [];
for (let i = 0; i < grenzen.length; i++){
  const a = grenzen[i].index;
  const b = (i + 1 < grenzen.length) ? grenzen[i + 1].index : block.length;
  if (!ohneKommentare.slice(a, b).includes('save()')) ohneSave.push(grenzen[i][1]);
}
check('3: JEDER Belohnungszweig speichert sofort', ohneSave.length === 0, { ohneSave });

// Der Rest hinter dem letzten Zweig ist der Auffang-Fall (Dankeschoen fuer Bug-Reports) - er
// mutiert ebenfalls state und braucht dieselbe Behandlung.
const letzterEnde = grenzen.length ? grenzen[grenzen.length - 1].index : 0;
const rest = ohneKommentare.slice(letzterEnde);
const auffang = rest.slice(rest.lastIndexOf('}\n'));
check('4: auch der Auffang-Fall hinter dem letzten Zweig speichert',
  rest.includes('save()') && (auffang.includes('save()') || rest.split('save()').length >= 3),
  rest.slice(-260));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
