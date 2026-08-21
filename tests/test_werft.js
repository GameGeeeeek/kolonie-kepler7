// Die Werft: vier Register statt acht Aufklappfeldern (29.07.2026, v8.340.0, Roadmap Phase 5).
//
// Diese Phase fuegt KEINEN Spielinhalt hinzu, und genau deshalb ist sie leicht falsch zu bauen:
// Wenn ein Register verschwindet, faellt das keinem Balance-Test auf. Der Test hier prueft drei
// Dinge, die man beim reinen Draufschauen uebersieht:
//
//   A) VOLLSTAENDIGKEIT. Jeder der acht frueheren Abschnitte muss in GENAU EINEM Register liegen.
//      Ein vergessener Abschnitt ist im Spiel unerreichbar - und niemand vermisst etwas, das er
//      nie gesehen hat.
//   B) DER BEDIENZUSTAND. Der aktive Reiter liegt in state.abgrund.reiter, nicht im DOM. Die Box
//      wird per setBoxHtml jede Sekunde neu geschrieben; ein DOM-Zustand waere nach einer Sekunde
//      weg (CLAUDE.md: "Jeder Bedienzustand, der NUR im DOM steckt").
//   C) DIE BRUECKE. Das Register "Bau" zeigt die Tiefenflotte, BAUT sie aber nicht. Eine zweite
//      Bauoberflaeche haette Baukorb, Warteschlange und Kostenpruefung ein zweites Mal zu pflegen -
//      und die zweite Stelle ist in diesem Projekt regelmaessig die, die veraltet.
const fs = require('fs');
const path = require('path');
// Pfad ueber die gemeinsame Quelle, nicht fest verdrahtet: Sonst wird KEPLER_SPIELDATEI
// still ignoriert und eine Gegenprobe liest die ECHTE Datei - sie sieht dann aus wie
// bestanden (CLAUDE.md, Korrektur zu Regel 14).
const { SPIELDATEI } = require('./lib/spieldatei');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

function fnAus(n){
  const m = js.match(new RegExp('function\\s+'+n+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+n);
  const i = js.indexOf(m[0]);
  let d=0, s=js.indexOf('{', i+m[0].length), k=s;
  for (; k<js.length; k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}
function arrAus(name){
  const i = js.indexOf('const '+name+' = [');
  let d=0, s=js.indexOf('[', i), k=s;
  for (; k<js.length; k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}
const boxQ = fnAus('renderAbgrundBox');

// ---- 1) Die Register selbst ----
const REITER = new Function('return '+arrAus('ABGRUND_REITER'))();
check('1: es gibt vier Register', REITER.length === 4, REITER.map(r=>r.key));
check('1: jedes hat Schluessel, Namen, Icon und Kurzhinweis',
  REITER.every(r => r.key && r.name && /^ti-/.test(r.icon||'') && r.note),
  REITER.filter(r => !(r.key && r.name && /^ti-/.test(r.icon||'') && r.note)).map(r=>r.key));
check('1: die Schluessel sind eindeutig', new Set(REITER.map(r=>r.key)).size === 4);
// Das Register-Aussehen ist NICHT neu erfunden - .fleet-subtab gibt es im Projekt schon zweimal
// (Flotte, Offiziere). Ein drittes Aussehen fuer dieselbe Sache waere genau die Uneinheitlichkeit,
// die diese Phase beseitigen soll.
check('1: es benutzt das vorhandene Register-Aussehen statt eines neuen',
  /class="fleet-subtabs abgrund-reiter"/.test(boxQ) && /class="fleet-subtab\$\{/.test(boxQ));

// ---- 2) VOLLSTAENDIGKEIT: kein Abschnitt darf verlorengehen ----
const ABSCHNITTE = ['abgrundWerkstatt','abgrundKonstellationen','abgrundKartenraum','abgrundKabinett',
                    'abgrundChronik','abgrundRangliste','abgrundAllianz','abgrundBestiarium'];
for (const k of ABSCHNITTE){
  // Nur die MARKUP-Stelle zaehlen (<details ...>), nicht die Handler-Zeilen: Die Werkstatt wird
  // zusaetzlich per box.querySelector('[data-keep-open="abgrundWerkstatt"]') gesucht, um das erste
  // Aufklappen zu merken. Ein blosses Zaehlen des Schluessels haette sie faelschlich als doppelt
  // gemeldet - der Test waere aus dem falschen Grund rot gewesen.
  const n = (boxQ.match(new RegExp('<details data-keep-open="'+k+'"', 'g')) || []).length;
  check('2: '+k.padEnd(22)+' kommt genau einmal vor', n === 1, { vorkommen:n });
}
// Und jeder Abschnitt muss INNERHALB eines Register-Zweigs liegen. Ein Abschnitt ausserhalb waere
// in jedem Register sichtbar - der Zustand vor dieser Phase, nur schlechter.
{
  // Die Zweige stehen als ${reiter!=='X' ? '' : `...`} im Markup. Zaehle die Zweige.
  const zweige = (boxQ.match(/\$\{reiter!=='[a-z]+' \? '' : `/g) || []).map(z => (z.match(/'([a-z]+)'/)||[])[1]);
  check('2: fuer jedes Register gibt es genau einen Markup-Zweig',
    zweige.length === 4 && new Set(zweige).size === 4, zweige);
  check('2: die Zweige tragen dieselben Schluessel wie die Registerliste',
    zweige.slice().sort().join() === REITER.map(r=>r.key).sort().join(), { zweige, register:REITER.map(r=>r.key) });
}

// ---- 3) DER BEDIENZUSTAND ----
const AR = new Function('state, ABGRUND_REITER, ensureAbgrund',
  fnAus('abgrundReiter')+'; return abgrundReiter;');
const reiterVon = wert => AR({ abgrund:{ reiter:wert } }, REITER, function(){ return this.abgrund; }.bind({ abgrund:{ reiter:wert } }))();
check('3: ohne gespeicherte Wahl steht das erste Register vorn', reiterVon(undefined) === 'ausbau');
check('3: eine gespeicherte Wahl wird uebernommen', reiterVon('sammlung') === 'sammlung');
// Ein Spielstand aus einer aelteren Version - oder ein manipulierter - darf die Box nicht leeren:
// Ein unbekannter Reiter wuerde sonst ALLE vier Zweige ueberspringen und eine leere Werft zeigen.
check('3: ein unbekannter Reiter faellt auf das erste zurueck statt eine leere Box zu zeigen',
  reiterVon('gibtsnicht') === 'ausbau' && reiterVon('') === 'ausbau' && reiterVon(null) === 'ausbau');
check('3: der Reiter wird im SPIELSTAND gehalten, nicht nur im DOM',
  /ensureAbgrund\(\)\.reiter = el\.getAttribute\('data-abgrund-reiter'\)/.test(boxQ) &&
  /data-abgrund-reiter/.test(boxQ));
check('3: nach dem Wechsel wird gespeichert UND neu gezeichnet',
  /ensureAbgrund\(\)\.reiter = [^;]+;\s*save\(\);\s*render\(\);/.test(boxQ));
// Als Zeichenkette gespeichert: Die Backend-SAVE_SANITY_LIMITS pruefen Zahlenfelder. Ein Reiter,
// der als Zahl gespeichert wuerde, waere ein weiteres Feld in dieser Pruefung - und ein abgelehnter
// Spielstand friert das Speichern KOMPLETT ein (CLAUDE.md, Vorfall 21.07.2026).
check('3: der Reiter ist eine Zeichenkette, keine Zahl',
  REITER.every(r => typeof r.key === 'string'));

// ---- 4) DIE BRUECKE: zeigen, nicht bauen ----
const bruecke = fnAus('abgrundBauBruecke');
check('4: die Bruecke listet genau die Tiefenschiffe', /SHIP_DEFS\.filter\(d => d\.tiefenschiff\)/.test(bruecke));
check('4: sie fragt den Freischaltstand ueber shipRequirementsMet ab, statt die Tiefe selbst zu vergleichen',
  /shipRequirementsMet\(def\)/.test(bruecke));
check('4: sie nennt den Preis ueber tiefenschiffKosten, nicht ueber eine eigene Zahl',
  /tiefenschiffKosten\(def\.key, 1\)/.test(bruecke));
// DAS ist der Punkt: kein Bauknopf. Nur ein Sprung in die Werft.
check('4: sie enthaelt KEINEN Bauknopf (keine zweite Bauoberflaeche)',
  !/kaufeTiefenschiff|data-build-ship|addToBuildCart|baueSchiff/.test(bruecke),
  (bruecke.match(/kaufeTiefenschiff|data-build-ship|addToBuildCart|baueSchiff/g)||[]));
check('4: stattdessen fuehrt ein Knopf in die Werft', /data-abgrund-werft/.test(bruecke));
check('4: und der schaltet wirklich auf die Werft um',
  /state\.fleetSubTab = 'werft';/.test(boxQ) && /switchTab\('flotte'\)/.test(boxQ));
// Der Tab-Schluessel heisst 'flotte', nicht 'fleet' - beim ersten Anlauf stand hier showTab('fleet'),
// eine Funktion, die es gar nicht gibt. Deshalb steht die Pruefung hier ausdruecklich.
check('4: switchTab ist die echte Funktion und der Tab heisst flotte',
  /function switchTab\(/.test(js) && /data-tab="flotte"/.test(src));

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
