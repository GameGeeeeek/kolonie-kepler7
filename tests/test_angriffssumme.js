// Jede Angriffsklasse muss in der Angriffssumme UND in der Kampfschiff-Zählung vorkommen.
//
// WARUM ES DIESEN TEST GIBT: attackPowerRaw() bildet die Angriffskraft aus einer handgeschriebenen
// Summe, in der jede Klasse einzeln als `dm('schluessel', f.schluessel) * wert` steht. Genau dort
// ist DREIMAL dasselbe passiert:
//   20.07.2026 - acht Klassen fehlten
//   24.07.2026 - der Singularitäts-Vernichter fehlte
//   05.08.2026 - die drei Allianzschiffe fehlten
// Jedes Mal war die Klasse in ATTACK_SHIP_KEYS, also in der Angriffsflotte wählbar, und trug
// trotzdem 0 Angriffskraft bei. Das Backend rechnete sie dagegen mit - die Vorschau zeigte also
// etwas anderes an, als der serverseitig entschiedene Kampf einlöste. Ein Spieler mit 200
// Sternenbannern sah Angriffskraft 0.
//
// Dasselbe bei combatFleetCount(): eine zweite handgeführte Liste mit neun statt zweiundzwanzig
// Klassen. Sie ist an zehn Stellen die harte Sperre „Alle Kampfschiffe dort sind bereits im
// Einsatz." - wer nur solche Schiffe hatte, konnte gar nicht angreifen.
//
// Der Test prüft deshalb nicht Zahlen, sondern die EIGENSCHAFT: Was angreifen darf, muss auch
// zählen. Eine vierte Wiederholung fällt hier auf und nicht erst im Spiel.
const fs = require('fs');
const path = require('path');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

function schnitt(von, bis, ab){
  const a = js.indexOf(von, ab||0); if (a < 0) return '';
  const b = js.indexOf(bis, a);     if (b < 0) return '';
  return js.slice(a, b);
}

// ---- Die Positivliste, aus der alles andere folgt
const zeile = schnitt("const ATTACK_SHIP_KEYS = [", "];");
const ATTACK = (zeile.match(/'([a-zA-Z]+)'/g) || []).map(x => x.slice(1, -1));
check('ATTACK_SHIP_KEYS gefunden', ATTACK.length >= 20, ATTACK.length);
// Frachter dürfen mitfliegen, kämpfen aber nicht - sie sind bewusst in ATTACK_SHIP_KEYS und
// bewusst nicht in der Angriffssumme. KAMPF_SHIP_KEYS zieht genau diese Grenze.
const NUR_TRANSPORT = ['frachter', 'frachtergross'];
const KAMPF = ATTACK.filter(k => NUR_TRANSPORT.indexOf(k) < 0);

// ---- 1) attackPowerRaw(): jede Kampfklasse trägt einen Angriffswert bei
{
  const fn = schnitt('function attackPowerRaw(', '\n  }');
  check('1: attackPowerRaw gefunden', fn.length > 500, fn.length);
  const fehlend = KAMPF.filter(k => fn.indexOf("dm('" + k + "'") < 0);
  check('1: jede Angriffsklasse steht in der Summe', fehlend.length === 0,
    { fehlend, hinweis:'Neue Kampfklasse? In attackPowerRaw() eine dm(...)-Zeile ergaenzen UND server.js SHIP_ATK_VALUES mitpflegen.' });
  // Gegenprobe: Der Ausschnitt muss wirklich die Summe enthalten, sonst waere obiges still gruen.
  check('1: die Gegenprobe greift (der Ausschnitt enthaelt die Summe)',
    /dm\('cruisers'/.test(fn) && /dm\('destroyers'/.test(fn), fn.slice(0, 80));
  // Frachter gehoeren AUSDRUECKLICH nicht hinein - sie transportieren, sie kaempfen nicht.
  check('1: Frachter tragen weiterhin keine Angriffskraft bei',
    NUR_TRANSPORT.every(k => fn.indexOf("dm('" + k + "'") < 0), NUR_TRANSPORT);
}

// ---- 2) combatFleetCount(): aus der Liste abgeleitet, nicht von Hand gefuehrt
{
  const fn = schnitt('function combatFleetCount(', '\n  }');
  check('2: combatFleetCount gefunden', fn.length > 60, fn.length);
  // Die eigentliche Zusicherung: Die Funktion LIEST die Positivliste. Eine handgeschriebene
  // Aufzaehlung waere wieder eine zweite Liste, die beim naechsten Schiff veraltet - und genau das
  // war sie zehn Monate lang.
  check('2: sie leitet sich aus KAMPF_SHIP_KEYS ab statt Klassen aufzuzaehlen',
    /KAMPF_SHIP_KEYS/.test(fn), fn.replace(/\s+/g, ' ').slice(0, 200));
  check('2: und zaehlt Jaeger/Bomber weiterhin nur mit Hangarplatz',
    /df\.jaeger/.test(fn) && /df\.bomber/.test(fn), fn.replace(/\s+/g, ' ').slice(0, 200));
}

// ---- 3) Das Backend kennt dieselben Klassen
// Ohne diesen Abschnitt koennte die Frontend-Summe vollstaendig sein und der Server trotzdem eine
// andere Zahl rechnen - das ist der Fall, der den Spieler am meisten verwirrt, weil Vorschau und
// Ergebnis auseinanderlaufen.
{
  const { SERVER_JS } = require('./lib/umgebung');
  if (!SERVER_JS){
    console.log('OK   - 3: uebersprungen, das Backend-Repo liegt hier nicht daneben');
  } else {
    const be = fs.readFileSync(SERVER_JS, 'utf8');
    const tabelle = be.slice(be.indexOf('const SHIP_ATK_VALUES = {'));
    const bis = tabelle.indexOf('};');
    const BE_KEYS = (tabelle.slice(0, bis).match(/([a-zA-Z]+)\s*:/g) || []).map(x => x.replace(/\s*:$/, '')).filter(k => k !== 'SHIP_ATK_VALUES');
    const fehlend = KAMPF.filter(k => BE_KEYS.indexOf(k) < 0);
    check('3: jede Angriffsklasse steht auch in der Backend-Tabelle', fehlend.length === 0,
      { fehlend, hinweis:'server.js SHIP_ATK_VALUES mitpflegen, sonst rechnet der PvP-Kampf anders als die Vorschau.' });
    check('3: die Gegenprobe greift (die Backend-Tabelle wurde wirklich gelesen)', BE_KEYS.length >= 20, BE_KEYS.length);
  }
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
