// Abgrund-Paket C: WAECHTER MIT REGELN - jeder der achtzehn fragt etwas anderes von der Flotte.
//
//   node tests/test_waechterregeln.js
//
// DIE GEFAHR, GEGEN DIE DIESER TEST GEBAUT IST, ist nicht die Rechnung, sondern die REICHWEITE.
// Bis v8.713.0 unterschieden sich die Waechter nur im Namen. Eine Regel je Waechter ist leicht
// gebaut - und ebenso leicht halb gebaut: Sie haengt an EINER der beiden Verlust-Aufrufstellen
// (dann wirkt sie je nach Ausgang des Kampfes), oder ein neunzehnter Waechter kommt ohne Regel
// dazu, oder ein siebtes Abgrund-Schiffsmodul entwischt der Zoll-Regel, weil dessen Liste von
// Hand gepflegt statt gemessen wird. Alles drei faellt in keinem Kampf auf.
//
// GEPRUEFT WIRD:
//   1a  JEDER Waechter traegt eine Regel, und jede genannte Regel gibt es auch. Kein Eintrag
//       ohne, kein Verweis ins Leere.
//   1b  Jede Regel wird auch BENUTZT - eine Regel, die an keinem Waechter haengt, ist tot.
//   2a  Die Anteilsrechnung: staerkste Art, Frachtanteil, Tiefenmodul-Anteil. VERHALTEN, mit
//       aufgerufenen Funktionen aus der Spieldatei, nicht per Textvergleich.
//   2b  Ohne Flotte und ohne Feuerkraft gibt jede Anteilsfunktion 0 - keine Division durch null.
//   3a  ABGRUND_MODUL_EFFEKTE deckt GENAU die Effekte ab, die im Spiel wirklich als
//       abgrundSchiffsmodul(...) gerufen werden. GEMESSEN aus der Datei, nicht getippt.
//   4a  Die Angriffsregel wirkt in abgrundKampfkraft und AUSSERHALB der gedeckelten Bonusgruppe.
//   4b  BEIDE Verlust-Aufrufstellen gehen durch abgrundVerlustFaktor. Keine rechnet noch selbst.
//   5a  Der Verstaerker verdoppelt nur den UEBERSCHUSS und laesst einen Sektor, der die Verluste
//       senkt, in Ruhe.
//   6a  Die Regel ist sichtbar, bevor jemand abtaucht: Waechtertafel, Tiefensonde, Bestiarium,
//       und hinterher im Kampfbericht.
//
// GEGENPROBEN:
//   =ohneregel    ein Waechter verliert sein `regel:` -> 1a faellt
//   =einseitig    die Niederlagen-Zeile rechnet wieder selbst -> 4b faellt
//   =modulluecke  ein Effekt fehlt in ABGRUND_MODUL_EFFEKTE -> 3a faellt
//   =ueberschuss  der Verstaerker verdoppelt den ganzen Faktor -> 5a faellt
//   =imdeckel     die Angriffsregel wandert in die Bonusgruppe -> 4a faellt
const fs = require('fs');
const { SPIELDATEI } = require('./lib/umgebung');
const src = fs.readFileSync(process.env.KEPLER_SPIELDATEI || SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };
const SAB = process.env.KEPLER_WAECHTERREGELN_GEGENPROBE || '';
const MUSS_FALLEN = {
  // `alt` ist der Stand vor dem Paket: Dort gibt es keine Regeln, also faellt ALLES - auch 2a/2b,
  // weil der Kontextaufbau die Anteilsfunktionen nicht findet und null liefert statt abzustuerzen.
  alt:         ['1a','1b','2a','2b','3a','4a','4b','5a','6a'],
  ohneregel:   ['1a'],
  einseitig:   ['4b'],
  modulluecke: ['3a'],
  ueberschuss: ['5a'],
  imdeckel:    ['4a']
};

function fnAus(name){
  const i = js.indexOf('function '+name+'(');
  if (i < 0) return '';
  let d=0, s=js.indexOf('{', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}
// Eine Tabelle wird am KLAMMERNPAAR geschnitten, nicht bis zum naechsten `];`: Die Regeln
// enthalten selbst Funktionsrumpfe mit Klammern, ein Textanker liefe mitten hinein.
function tabelleAus(name){
  const i = js.indexOf('const '+name+' = [');
  if (i < 0) return '';
  let d=0, s=js.indexOf('[', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(i, k+1)+';';
}
const konstAus = n => { const m = js.match(new RegExp('^\\s*const '+n+' = .*$','m')); return m ? m[0].trim() : ''; };

// ---- 1) Jeder Waechter traegt eine Regel ------------------------------------------------------
const namenTab = tabelleAus('ABGRUND_WAECHTER_NAMEN');
const regelTab = tabelleAus('ABGRUND_WAECHTER_REGELN');
const regelKeys = [...regelTab.matchAll(/\{ key:'([a-z]+)'/g)].map(m => m[1]);
// Gezaehlt werden die EINTRAEGE der Namensliste, nicht die Vorkommen von `regel:` - sonst waere
// ein Eintrag ohne Regel unsichtbar, solange nur die Gesamtzahl stimmt.
const eintraege = [...namenTab.matchAll(/\{ name:'([^']+)'(?:, regel:'([a-z]+)')?/g)]
  .map(m => ({ name: m[1], regel: m[2] || null }));
const ohneRegel = eintraege.filter(e => !e.regel);
const insLeere = eintraege.filter(e => e.regel && regelKeys.indexOf(e.regel) < 0);
merke('1a: jeder Waechter traegt eine Regel, und jede genannte Regel gibt es',
  eintraege.length >= 18 && regelKeys.length > 0
    && ohneRegel.length === 0 && insLeere.length === 0,
  { waechter: eintraege.length, regeln: regelKeys.length,
    ohneRegel: ohneRegel.map(e => e.name), insLeere: insLeere.map(e => e.regel) });

const benutzt = regelKeys.filter(k => eintraege.some(e => e.regel === k));
merke('1b: jede Regel haengt an mindestens einem Waechter',
  regelKeys.length > 0 && benutzt.length === regelKeys.length,
  { regeln: regelKeys, unbenutzt: regelKeys.filter(k => benutzt.indexOf(k) < 0) });

// ---- 2) Die Anteilsrechnung, als VERHALTEN ---------------------------------------------------
/* Der Kontext wird EINMAL gebaut. Die Abhaengigkeiten sind Attrappen mit gemessenen Werten:
   Jaeger 5 Angriff, Schlachtschiff 90, Bergungsfrachter 2, reine Frachter 0. Damit ist die
   staerkste Art bei gemischter Flotte eindeutig und der Frachtanteil nicht null - ein Test, in
   dem alle Frachter 0 Angriff haben, koennte den Frachtanteil gar nicht messen. */
let A = null;
try {
  const quelle = [
    "const ATTACK_SHIP_KEYS = ['jaeger','schlachtschiff','bergungsfrachter','frachter'];",
    "function shipBaseAtk(k){ return ({jaeger:5, schlachtschiff:90, bergungsfrachter:2, frachter:0})[k] || 0; }",
    "const SHIP_CLASS_DEFS = [{ key:'frachter', shipKeys:['frachter','bergungsfrachter'] }];",
    konstAus('ABGRUND_MODUL_KLASSEN'), konstAus('ABGRUND_MODUL_EFFEKTE'),
    "function abgrundSchiffsmodul(f, kl, e){ return kl === 'frachter' ? 1 : 0; }",
    fnAus('abgrundArtKraft'), fnAus('abgrundAnteilStaerksteArt'),
    fnAus('abgrundAnteilFracht'), fnAus('abgrundAnteilMitTiefenmodul'),
    "return { staerkste: abgrundAnteilStaerksteArt, fracht: abgrundAnteilFracht, modul: abgrundAnteilMitTiefenmodul };"
  ].join('\n');
  A = new Function(quelle)();
} catch(e){ A = null; }

// 10 Jaeger (50) + 1 Schlachtschiff (90) + 5 Bergungsfrachter (10) = 150.
const F = { jaeger:10, schlachtschiff:1, bergungsfrachter:5, frachter:99 };
const rd = x => Math.round(x*1000)/1000;
merke('2a: staerkste Art, Frachtanteil und Tiefenmodul-Anteil werden als ANTEIL gerechnet',
  !!A
    && rd(A.staerkste(F)) === rd(90/150)
    && rd(A.fracht(F)) === rd(10/150)
    && rd(A.modul(F)) === rd(10/150),
  { staerkste: A && rd(A.staerkste(F)), fracht: A && rd(A.fracht(F)), modul: A && rd(A.modul(F)) });

merke('2b: ohne Flotte und ohne Feuerkraft ist jeder Anteil 0, keine Division durch null',
  !!A
    && A.staerkste(null) === 0 && A.fracht(null) === 0 && A.modul(null) === 0
    && A.staerkste({ frachter: 40 }) === 0 && A.fracht({ frachter: 40 }) === 0,
  { leer: A && A.staerkste(null), ohneFeuerkraft: A && A.staerkste({ frachter: 40 }) });

// ---- 3) Die Modul-Liste wird GEMESSEN, nicht gepflegt -----------------------------------------
/* Der eigentliche Waechter dieses Tests. Die Zoll-Regel fragt „traegt die Klasse ein
   Tiefenmodul", und die Antwort haengt an einer Liste von Effekten. Wird die von Hand gepflegt,
   entwischt ihr das siebte Modul - und die Regel wird still schwaecher, ohne dass irgendetwas
   rot wird. Deshalb wird die Liste gegen die tatsaechlichen Aufrufstellen gemessen. */
const gerufen = [...js.matchAll(/abgrundSchiffsmodul\([^,]+,\s*'([a-z]+)'\s*,\s*'([a-z]+)'\)/g)];
const effekteImSpiel = [...new Set(gerufen.map(m => m[2]))].sort();
const klassenImSpiel = [...new Set(gerufen.map(m => m[1]))].sort();
const listeE = (konstAus('ABGRUND_MODUL_EFFEKTE').match(/'([a-z]+)'/g)||[]).map(x => x.replace(/'/g,'')).sort();
const listeK = (konstAus('ABGRUND_MODUL_KLASSEN').match(/'([a-z]+)'/g)||[]).map(x => x.replace(/'/g,'')).sort();
merke('3a: die Modul-Listen decken genau die Effekte und Klassen ab, die es im Spiel gibt',
  effekteImSpiel.length > 0
    && JSON.stringify(effekteImSpiel) === JSON.stringify(listeE)
    && JSON.stringify(klassenImSpiel) === JSON.stringify(listeK),
  { imSpiel: effekteImSpiel, inDerListe: listeE, klassenImSpiel, klassenInDerListe: listeK });

// ---- 4) Die zwei Wirkstellen ------------------------------------------------------------------
const kraftQ = fnAus('abgrundKampfkraft');
const iDeckel = kraftQ.indexOf('ABGRUND_KRAFT_DECKEL');
const iRegel = kraftQ.indexOf('regel.kraft(');
merke('4a: die Angriffsregel wirkt in abgrundKampfkraft und AUSSERHALB der gedeckelten Gruppe',
  kraftQ.length > 0 && iDeckel >= 0 && iRegel > iDeckel
    && /const regel = sektor\.waechter && sektor\.waechter\.regel;/.test(kraftQ),
  { deckelAb: iDeckel, regelAb: iRegel });

/* 4b misst die AUSSAGE „keine der beiden Stellen rechnet noch selbst", nicht die Zahl der
   Aufrufe: Eine Zahl altert, sobald eine dritte Verluststelle dazukommt. Beides zusammen faengt
   sowohl das Vergessen einer Stelle als auch das Zurueckbauen einer schon umgestellten. */
/* GEMESSEN WERDEN DIE AUFRUFSTELLEN, NICHT EIN TEXTMUSTER UEBER DIE DATEI. Der erste Entwurf
   zaehlte Vorkommen von `sektor.mods.loss * panzer` im ganzen Quelltext und verlangte null - und
   fiel prompt ueber den KOMMENTAR ueber abgrundVerlustFaktor, der die alte Formel zitiert. Eine
   Pruefung, die an einem Kommentar scheitert, meldet einen Fehler auf richtigem Code; dieselbe
   Fehlerklasse wie der zeilenlokale Filter in test_tiefenflotte. Geschnitten wird deshalb der
   Aufloesungsblock, und darin JEDE applyCombatLosses-Anweisung einzeln geprueft. */
function klammer(quelle, start, auf, zu){
  let d = 0, s = quelle.indexOf(auf, start), k = s;
  for (; k < quelle.length; k++){ if (quelle[k]===auf) d++; else if (quelle[k]===zu){ d--; if(!d) break; } }
  return quelle.slice(s, k+1);
}
const vonBlock = js.indexOf("} else if (m.type === 'abgrund'){");
const block = vonBlock >= 0 ? klammer(js, vonBlock, '{', '}') : '';
const verlustFn = fnAus('abgrundVerlustFaktor');
const verlustStellen = [];
for (let i = block.indexOf('applyCombatLosses('); i >= 0; i = block.indexOf('applyCombatLosses(', i+1)){
  const bis = block.indexOf(';', i);
  if (bis > i) verlustStellen.push(block.slice(i, bis+1));
}
const selbstrechner = verlustStellen.filter(z => z.indexOf('abgrundVerlustFaktor(') < 0);
merke('4b: BEIDE Verlust-Aufrufstellen gehen durch abgrundVerlustFaktor, keine rechnet selbst',
  verlustFn.length > 0
    && /a\.konstGesehen\[/.test(block)   // Beleg, dass der geschnittene Block die Aufloesung ist
    && verlustStellen.length >= 2
    && selbstrechner.length === 0,
  { stellen: verlustStellen.length, selbstrechner: selbstrechner.length });

// ---- 5) Der Verstaerker verdoppelt nur den UEBERSCHUSS ----------------------------------------
let R = null;
try {
  const quelle = [
    "function abgrundAnteilStaerksteArt(){ return 0; }",
    "function abgrundAnteilMitTiefenmodul(){ return 1; }",
    "function abgrundAnteilFracht(){ return 0; }",
    "function abgrundKanalBonus(){ return 0; }",
    "function abgrundSchiffsmodul(){ return 0; }",
    "function tiefenschiffBonus(){ return 0; }",
    tabelleAus('ABGRUND_WAECHTER_REGELN'),
    "return ABGRUND_WAECHTER_REGELN;"
  ].join('\n');
  R = new Function(quelle)();
} catch(e){ R = null; }
const verst = R && R.find(r => r.key === 'verstaerker');
// mods.loss 1,5 heisst „+50% Verluste". Verdoppelt heisst +100%, der Faktor also 2 statt 1,5 -
// gemessen am Verhaeltnis, damit der uebrige Panzer-Anteil sich herauskuerzt.
const hoch = verst ? verst.verlust(1.5, {}, { mods:{ loss:1.5 } }) / 1.5 : null;
const runter = verst ? verst.verlust(0.8, {}, { mods:{ loss:0.8 } }) / 0.8 : null;
const neutral = verst ? verst.verlust(1, {}, { mods:{ loss:1 } }) : null;
merke('5a: der Verstaerker verdoppelt den Ueberschuss, nicht den Faktor - und senkende Sektoren gar nicht',
  !!verst && rd(hoch) === rd(2/1.5) && rd(runter) === 1 && rd(neutral) === 1,
  { erhoehend: rd(hoch), senkend: rd(runter), neutral: rd(neutral) });

// ---- 6) Sichtbar, bevor jemand abtaucht -------------------------------------------------------
merke('6a: die Regel steht am Sektor, in der Sonde, im Bestiarium und im Bericht',
  /Seine Regel – \$\{escapeHtml\(sektor\.waechter\.regel\.name\)\}/.test(js)
    && /v\.waechter\.regel\?' \('\+escapeHtml\(v\.waechter\.regel\.name\)\+'\)'/.test(js)
    && /geschafft && sek\.waechter\.regel \?/.test(js)
    && /sektor\.waechter\.regel \? ' \('\+sektor\.waechter\.regel\.name/.test(js),
  {});

if (SAB){
  const soll = MUSS_FALLEN[SAB] || [];
  const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false);
  const fehlend = soll.filter(n => ergebnis[n] !== false);
  const unerwartet = gefallen.filter(n => soll.indexOf(n) < 0);
  if (fehlend.length) console.log('FAIL - Gegenprobe unvollstaendig: '+fehlend.join(' ')+' blieben gruen');
  else if (unerwartet.length) console.log('FAIL - Gegenprobe UEBERZAEHLIG: '+unerwartet.join(' ')+' fiel zusaetzlich');
  else console.log('GEGENPROBE '+SAB+': '+gefallen.length+'/'+soll.length+' gefallen ('+gefallen.map(n=>n+'=rot').join(' ')+')');
  process.exit((fehlend.length || unerwartet.length) ? 1 : 0);
}
console.log(fail ? 'FAIL' : 'PASS');
process.exit(fail ? 1 : 0);
