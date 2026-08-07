// Klangmotive (v8.434.0): Jede Klang-Art ist eine Notenfolge in SOUND_MOTIVE.
//
// DER FEHLER, den dieser Test dauerhaft festnagelt: Bis v8.433.0 riefen 'lose' (8 Stellen!),
// 'complete', 'click' und 'alarm' eine Klang-Art auf, die in der freqs-Tabelle nie existierte -
// der stille Rueckfall spielte den 440-Hz-Standardton. Eine Niederlage klang wie ein Bauauftrag,
// und niemandem konnte es auffallen, weil der Rueckfall keinen Fehler wirft.
//
// GEPRUEFT WIRD DIE REGEL, in beide Richtungen:
//   1) JEDE per playSound('...') gerufene Art (auch in Ternaries) ist in SOUND_MOTIVE definiert.
//   2) JEDE definierte Art wird irgendwo gerufen oder gehoert der Kampf-Wiedergabe - ein Motiv
//      ohne Rufer waere versprochener, nie hoerbarer Inhalt.
//   3) Die Noten sind wohlgeformt (ausgefuehrt, nicht abgelesen): f/d/g positiv, g als
//      Lautstaerke gedeckelt (<= 0.1 - lauter war auch der alte Synth nie), gueltige Wellenform.
//   4) Die neuen Klaenge sind WIRKLICH verdrahtet: levelup am Kommandanten- und Veteranen-
//      Aufstieg, rare an beiden Fund-Funktionen, bossdrop am Boss-Set-Drop.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren ausgefuehrt): am alten Stand faellt der Test durch
// (SOUND_MOTIVE existiert nicht; 'lose'/'click'/'alarm' ohne Definition).
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

// SOUND_MOTIVE ausfuehrbar herausschneiden.
const von = JS.indexOf('const SOUND_MOTIVE = {');
const bis = JS.indexOf('\n  };', von);
check('1a: SOUND_MOTIVE gefunden (Anker existieren)', von > 0 && bis > von);
let MOTIVE = null;
try { MOTIVE = new Function('return ' + JS.slice(von + 'const SOUND_MOTIVE = '.length, bis + 5))(); } catch (e) {}
check('1b: SOUND_MOTIVE ist auswertbar', !!MOTIVE, MOTIVE && Object.keys(MOTIVE).length);
if (!MOTIVE) return ende();

// ---- 1) Jede gerufene Art ist definiert - Aufrufe samt Ternaries einsammeln.
const gerufen = new Set();
for (const m of JS.matchAll(/playSound\(([^)]*)\)/g)){
  for (const q of m[1].matchAll(/'([a-z]+)'/g)) gerufen.add(q[1]);
}
const fehlend = [...gerufen].filter(k => !MOTIVE[k]);
check('1c: jede gerufene Klang-Art hat ein Motiv (kein stummer 440-Hz-Rueckfall mehr)',
  gerufen.size >= 10 && fehlend.length === 0, { gerufen: [...gerufen].sort(), fehlend });

// ---- 2) Kein Motiv ohne Rufer (die drei Wiedergabe-Arten laufen ueber playSound(kind)).
const WIEDERGABE = ['shot', 'impact', 'explosion'];
const tot = Object.keys(MOTIVE).filter(k => !gerufen.has(k) && !WIEDERGABE.includes(k));
check('2a: kein Motiv ohne Rufer', tot.length === 0, tot);
check('2b: die Wiedergabe-Arten stehen weiter bereit', WIEDERGABE.every(k => !!MOTIVE[k]));

// ---- 3) Wohlgeformte Noten
const WELLEN = ['sine', 'triangle', 'square', 'sawtooth'];
const kaputt = [];
for (const [k, noten] of Object.entries(MOTIVE)){
  if (!Array.isArray(noten) || !noten.length){ kaputt.push(k + ': leer'); continue; }
  for (const n of noten){
    if (!(n.f > 0) || !(n.d > 0) || !(n.t >= 0)) kaputt.push(k + ': f/d/t');
    if (!(n.g > 0) || n.g > 0.1) kaputt.push(k + ': Lautstaerke ' + n.g);
    if (!WELLEN.includes(n.w)) kaputt.push(k + ': Wellenform ' + n.w);
  }
}
check('3a: alle Noten wohlgeformt, Lautstaerke gedeckelt', kaputt.length === 0, kaputt.slice(0, 5));

// ---- 4) Die neuen Klaenge sind wirklich verdrahtet.
check('4a: Kommandanten-Levelaufstieg spielt levelup',
  /Level aufgestiegen! Jetzt Kommandanten-Level '\+after\+'\.', 'ti-award'\);\n\s*playSound\('levelup'\);/.test(JS));
check('4b: Veteranen-Aufstieg spielt levelup',
  /Veteranen-Aufstieg[\s\S]{0,200}?playSound\('levelup'\);/.test(JS));
check('4c: beide Fund-Funktionen spielen bei episch+ die Seltenheits-Fanfare',
  (JS.match(/if \(rarity==='episch' \|\| rarity==='legendaer'(?: \|\| rarity==='mythisch')?\) playSound\('rare'\);/g) || []).length === 2);
check('4d: der Boss-Set-Drop spielt bossdrop',
  /function grantBossSetModule[\s\S]{0,900}?playSound\('bossdrop'\);/.test(JS));

ende();
