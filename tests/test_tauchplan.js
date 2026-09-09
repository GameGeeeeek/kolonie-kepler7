// Abgrund-Paket A: DER TAUCHPLAN - ein Tauchgang laeuft ueber mehrere Tiefen nacheinander.
//
//   node tests/test_tauchplan.js
//
// DIE GEFAHR, GEGEN DIE DIESER TEST GEBAUT IST, ist nicht die Schleife, sondern die Buchfuehrung:
// Bis v8.711.0 rechnete die Aufloesung GENAU EINEN Sektor ab, und alles - Splitter, Bergungsgut,
// Beute, Kampfpunkte, Bestiarium, Reliquien, Rekordtiefe, Meilensteine, Wochenbestwert - stand in
// diesem einen Durchgang. Wer daraus eine Route macht und die Abrechnung HINTER die Schleife legt,
// bekommt eine Version, die sich voellig richtig anfuehlt und den Spieler trotzdem um alles
// bringt, was er in den Sektoren davor verdient hat. Das faellt niemandem auf, weil der letzte
// Sektor ja korrekt abgerechnet wird.
//
// GEPRUEFT WIRD:
//   1a  Es gibt die Schleife, und ohne Plan hat sie genau einen Durchgang - ein laufender
//       Tauchgang von vorher und jeder Plan der Laenge 1 verhalten sich damit wie bisher. Das ist
//       die Zusage, die die 441 Bestandspruefungen zum Waechter ueber den Umbau macht.
//   1b  DIE ABRECHNUNG STEHT IN DER SCHLEIFE. Gemessen am Rumpf: Meilensteine, Waechtersieg,
//       Wochenbestwert, Bestiarium, Rekordtiefe und Kampfbericht liegen INNERHALB.
//   2a  `abgrundPlanTiefen` liefert aufeinanderfolgende Tiefen, gedeckelt bei ABGRUND_PLAN_MAX,
//       und bei fehlender Angabe genau eine. Verhalten, nicht Quelltext.
//   2b  Die Anflugdauer ist die SUMME ueber alle geplanten Sektoren. Ein Plan, der fuenf Tiefen in
//       der Zeit von einer schafft, waere ein Geschenk - und die Vorschau loege.
//   3a  Verluste bleiben zwischen den Sektoren: Was in Sektor 1 faellt, kaempft in Sektor 2 nicht
//       mehr mit. Ohne das waere ein langer Plan risikofrei.
//   3b  Die Sicherheitslinie wird aus der MISSION gelesen und gegen den gemessenen Anteil geprueft,
//       nicht gegen eine Schaetzung.
//   4a  Der Plan reist in der Mission mit - wie Bann, Spule, Ruf und Stroemung. Wer ihn nach dem
//       Start umstellt, aendert einen laufenden Tauchgang nicht mehr.
//   4b  Die Grenze wird JE SEKTOR gemessen. Einmal beim Planen abgeschnitten, endete jeder Plan an
//       der alten Rekordtiefe - und der Plan koennte nie in neues Gebiet laufen.
//   5a  Bedienung und Hilfe sagen es. Eine Mechanik, von der der Spieler nichts weiss, ist keine.
//
// GEGENPROBEN:
//   =alt          der Stand vor dem Paket. Dort faellt ALLES, auch 2a: Die Routenfunktion gibt es
//                 dort nicht, der Kontextaufbau faengt das ab und liefert null statt abzustuerzen.
//   =nachher      die Meilensteine stehen HINTER der Schleife statt darin. Dort faellt 1b - genau
//                 der Fehler, gegen den dieser Test gebaut ist.
const fs = require('fs');
const { SPIELDATEI } = require('./lib/umgebung');
const src = fs.readFileSync(process.env.KEPLER_SPIELDATEI || SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };
const SAB = process.env.KEPLER_TAUCHPLAN_GEGENPROBE || '';
const MUSS_FALLEN = { alt: ['1a','1b','2a','2b','3a','3b','4a','4b','5a'], nachher: ['1b'] };

/* Der Aufloesungsblock wird am Klammernpaar begrenzt, nicht bis Dateiende geschnitten: Denselben
   Anker gibt es zweimal (Aufloesung und Missionsliste). `a.konstGesehen` darin belegt, dass es die
   Aufloesung ist - dieselbe Absicherung wie in test_konstellationen. */
function klammer(start, auf, zu){
  let d = 0, s = js.indexOf(auf, start), k = s;
  for (; k < js.length; k++){ if (js[k]===auf) d++; else if (js[k]===zu){ d--; if(!d) break; } }
  return js.slice(s, k+1);
}
const vonBlock = js.indexOf("} else if (m.type === 'abgrund'){");
const block = vonBlock >= 0 ? klammer(vonBlock, '{', '}') : '';
const istAufloesung = /a\.konstGesehen\[/.test(block);

// ---- 1) Die Schleife und was darin steht -----------------------------------------------------
const vonSchleife = block.indexOf('for (const tiefe of planTiefen){');
const schleife = vonSchleife >= 0 ? klammer(vonBlock + vonSchleife, '{', '}') : '';
merke('1a: die Aufloesung laeuft ueber eine Liste von Tiefen, ohne Plan ueber genau eine',
  block.length > 0 && istAufloesung && vonSchleife >= 0 && schleife.length > 0
    && /abgrundPlanTiefen\(Math\.max\(1, m\.targetId \|\| 1\), \(m\.plan && m\.plan\.tiefen\) \|\| 1\)/.test(block),
  { blockDa: block.length > 0, istAufloesung, schleifeDa: schleife.length > 0 });

/* 1b ist der Kern. Jede dieser Buchungen gehoert JE SEKTOR ausgefuehrt; stuende sie hinter der
   Schleife, bekaeme der Spieler sie nur fuer den letzten. Gemessen wird die Lage im Rumpf. */
const buchungen = [
  ['Meilensteine',    'checkAbgrundMeilensteine()'],
  ['Waechtersieg',    'merkeWaechterSieg(tiefe, sektor.stroemung)'],
  ['Wochenbestwert',  'a.woche.best = tiefe'],
  ['Bestiarium',      'a.gesehen[mut.key]'],
  ['Rekordtiefe',     'a.best = tiefe'],
  ['Splitter',        'a.splitter = (a.splitter||0) + splitter'],
  ['Bergungsgut',     'a.bergung = (a.bergung||0) + bergungsgut'],
  ['Kampfbericht',    'pushReport(__battleReport)']
];
const draussen = buchungen.filter(([, code]) => schleife.indexOf(code) < 0);
merke('1b: die ganze Abrechnung steht IN der Schleife, nicht dahinter',
  schleife.length > 0 && draussen.length === 0,
  { fehlend: draussen.map(x => x[0]) });

// ---- 2) Die Route selbst ---------------------------------------------------------------------
/* 2a misst VERHALTEN: die Funktion wird aus der Datei geholt und wirklich aufgerufen. Fehlt sie
   (alter Stand), liefert die Attrappe null und die Pruefung faellt aus dem richtigen Grund. */
function fnAus(name){
  const i = js.indexOf('function '+name+'(');
  if (i < 0) return '';
  let d=0, s=js.indexOf('{', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}
const konstAus = n => { const m = js.match(new RegExp('^\\s*const '+n+' = .*$','m')); return m ? m[0].trim() : ''; };
let planFn = null, planMax = null;
if (fnAus('abgrundPlanTiefen') && konstAus('ABGRUND_PLAN_MAX')){
  try {
    const g = new Function(konstAus('ABGRUND_PLAN_MAX')+'\n'+fnAus('abgrundPlanTiefen')
      + '\nreturn { abgrundPlanTiefen, ABGRUND_PLAN_MAX };')();
    planFn = g.abgrundPlanTiefen; planMax = g.ABGRUND_PLAN_MAX;
  } catch(e){}
}
const p3 = planFn ? planFn(7, 3) : null;
const p1 = planFn ? planFn(7, undefined) : null;
const pMax = planFn ? planFn(7, 99) : null;
merke('2a: die Route ist eine Folge aufeinanderfolgender Tiefen, gedeckelt und nie leer',
  !!planFn && planMax >= 2
    && JSON.stringify(p3) === JSON.stringify([7,8,9])
    && JSON.stringify(p1) === JSON.stringify([7])
    && pMax.length === planMax && pMax[0] === 7 && pMax[pMax.length-1] === 7 + planMax - 1,
  { drei: p3, ohneAngabe: p1, gedeckelt: pMax && pMax.length, max: planMax });

/* 2b am Quelltext: Die Summe entsteht in einer Schleife ueber dieselbe Routenfunktion, und zwar in
   sendeAbgrundMission. Ein Testlauf koennte das nur ueber einen echten Missionsstart messen. */
const sendeQ = fnAus('sendeAbgrundMission');
merke('2b: die Anflugdauer ist die Summe ueber alle geplanten Sektoren',
  sendeQ.length > 0
    && /for \(const t of abgrundPlanTiefen\(tiefe, planTiefen\)\)\{/.test(sendeQ)
    && /dauer \+= abgrundAnflugdauer\(t, sek\.mods\.dur, flotte\)/.test(sendeQ)
    && /let dauer = 0;/.test(sendeQ),
  { sendeDa: sendeQ.length > 0 });

// ---- 3) Was den Plan gefaehrlich macht -------------------------------------------------------
merke('3a: Verluste bleiben zwischen den Sektoren in der Flotte',
  schleife.length > 0
    && /for \(const \[k, n\] of Object\.entries\(ownLost\)\) komp\[k\] = Math\.max\(0, \(komp\[k\]\|\|0\) - n\);/.test(schleife)
    && /anteil = Math\.max\(0, attackPower\(komp, planetKey\) \/ kraftStart\)/.test(schleife)
    // und die gekuerzte Flotte kaempft wirklich schwaecher weiter
    && /const rohkraft = \(m\.power \|\| attackPower\(fleet\)\) \* anteil;/.test(schleife),
  { schleifeDa: schleife.length > 0 });

merke('3b: die Sicherheitslinie kommt aus der Mission und wird gegen den gemessenen Anteil geprueft',
  /const linie = \(m\.plan && typeof m\.plan\.linie === 'number'\) \? m\.plan\.linie : 0;/.test(block)
    && /if \(linie > 0 && anteil < linie/.test(schleife),
  { imBlock: /const linie = /.test(block) });

// ---- 4) Eingefroren und begrenzt -------------------------------------------------------------
merke('4a: der Plan reist in der Mission mit, wie Bann, Spule, Ruf und Stroemung',
  sendeQ.length > 0
    && /const plan = \{ tiefen: planTiefen, linie: planLinie \};/.test(sendeQ)
    && /bann, spule, grund, ruf, stroemung, plan,/.test(sendeQ),
  { sendeDa: sendeQ.length > 0 });

merke('4b: die erreichbare Grenze wird JE SEKTOR gemessen, nicht einmal beim Planen',
  schleife.length > 0 && /if \(tiefe > abgrundMaxTiefe\(\)\)\{/.test(schleife),
  { schleifeDa: schleife.length > 0 });

// ---- 5) Sichtbar -----------------------------------------------------------------------------
const boxQ = fnAus('renderAbgrundBox');
merke('5a: Bedienung und Hilfe erklaeren den Plan',
  boxQ.length > 0
    && /data-abgrund-plan="1"/.test(boxQ) && /data-abgrund-linie/.test(boxQ)
    && /Der Tauchplan – mehrere Tiefen in einem Anlauf/.test(js)
    && /Sicherheitslinie/.test(js),
  { boxDa: boxQ.length > 0 });

if (SAB){
  const soll = MUSS_FALLEN[SAB] || [];
  const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false);
  const fehlend = soll.filter(n => ergebnis[n] !== false);
  const unerwartet = gefallen.filter(n => soll.indexOf(n) < 0);
  console.log('GEGENPROBE ' + SAB + ': ' + (soll.length - fehlend.length) + '/' + soll.length + ' gefallen (' +
    soll.map(n => n + '=' + (ergebnis[n] === false ? 'rot' : 'gruen')).join(' ') + ')' +
    (unerwartet.length ? ' | ZUSAETZLICH rot: ' + unerwartet.join(', ') : ''));
  if (fehlend.length || unerwartet.length){
    if (fehlend.length) console.log('FAIL - Gegenprobe unvollstaendig: ' + fehlend.join(', ') + ' blieben gruen');
    if (unerwartet.length) console.log('FAIL - Gegenprobe ueberzaehlig: ' + unerwartet.join(', ') + ' fielen, stehen aber nicht in MUSS_FALLEN');
    process.exit(1);
  }
  process.exit(0);
}
console.log(fail ? 'FAIL' : 'PASS');
process.exit(fail ? 1 : 0);
