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
  // `alt` ist der Stand vor dem Paket: Dort gibt es keine Regeln, also faellt ALLES.
  alt:          ['1a','1b','2a','2b','2c','3a','4a','4b','5a','5b','5c','5d','5e','5f','6a'],
  ohneregel:    ['1a'],
  einseitig:    ['4b'],
  ueberschuss:  ['5a'],
  imdeckel:     ['4a'],
  // Die Befunde der zweiten Durchsicht, je einzeln zurueckgebaut.
  frachtklasse: ['2a'],   // der Wieger liest wieder die Frachter-KLASSE - der Nulleffekt
  handliste:    ['3a'],   // die Modulpaare wieder von Hand getippt, ohne den Stillgaenger
  ohnedeckel:   ['5b'],   // ABGRUND_REGEL_MAX auf 1 - eine Regel setzt die Flotte auf null
  // Ein invertierter Zoll bricht drei Pruefungen, nicht eine: die Richtung (5d) UND beide
  // Zahlenpruefungen, weil er dann am Deckel und unterhalb davon andere Werte liefert. Die
  // ueberzaehligen wurden gemessen, nicht geschaetzt - der Waechter meldet sie von selbst.
  zollinvers:   ['5b','5c','5d'],
  kielohnetiefe:['5f'],   // der Gegenschlag verliert die Tiefe
  alleblind:    ['1b']    // siebzehn Waechter tragen dieselbe Regel
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
/* MEHRZEILIGE OBJEKT-KONSTANTEN am Klammernpaar schneiden. `konstAus` nimmt nur die erste Zeile -
   bei CARGO_PER_SHIP (zwei Zeilen) blieb das Objekt offen, der Kontext war syntaktisch kaputt und
   der Aufbau lieferte still `null`. Drei Pruefungen waren damit aus dem falschen Grund rot. */
function objektAus(name){
  const i = js.indexOf('const '+name+' = {');
  if (i < 0) return '';
  let d=0, a=js.indexOf('{', i), k=a;
  for(;k<js.length;k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1)+';';
}

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

/* GLEICHMAESSIG VERTEILT, nicht nur „mindestens einmal". Die alte Fassung waere gruen geblieben,
   wenn siebzehn Waechter denselben Blindfleck traegen und die uebrigen fuenf Regeln je einmal
   vorkaemen - genau die Verarmung, gegen die das Paket gebaut ist. Verlangt wird deshalb, dass
   jede Regel gleich oft vergeben ist; die Zahl selbst wird GERECHNET, damit sie beim neunzehnten
   Waechter nicht falsch wird. */
const proRegel = {};
for (const k of regelKeys) proRegel[k] = eintraege.filter(e => e.regel === k).length;
const erwartet = regelKeys.length > 0 ? eintraege.length / regelKeys.length : 0;
merke('1b: jede Regel ist gleich oft vergeben, keine haengt an einem einzigen Waechter',
  regelKeys.length > 0 && Number.isInteger(erwartet) && erwartet > 1
    && regelKeys.every(k => proRegel[k] === erwartet),
  { erwartetJeRegel: erwartet, verteilung: proRegel });

// ---- 2) Die Anteilsrechnung, als VERHALTEN ---------------------------------------------------
/* GEGEN DIE ECHTEN TABELLEN, NICHT GEGEN ATTRAPPEN. Der erste Entwurf setzte hier erfundene
   Angriffswerte ein (Bergungsfrachter 2 statt 0) und eine SHIP_CLASS_DEFS-Attrappe - und genau
   diese Fiktion versteckte einen P1: `abgrundAnteilFracht` las die Frachter-KLASSE, deren drei
   Schiffe alle atk:0 tragen, war also strukturell immer 0. Drei der achtzehn Waechter hatten
   faktisch keine Regel, und der Test war gruen. Ein Test, der sich seine Daten passend macht,
   misst die Daten und nicht den Code. Geladen werden deshalb ATTACK_SHIP_KEYS, SHIP_DEFS,
   SHIP_CLASS_DEFS, CARGO_PER_SHIP und SHIP_MODULE_DEFS aus der Spieldatei. */
/* Aus der Tabelle GELESEN, nicht nachgebaut: je Eintrag Schluessel und Angriffswert bzw.
   Klasse, Effekt und Herkunft. Der Anker `{ key:'` wird vorher auf Treffer geprueft - ohne
   Treffer liefert die Funktion eine leere Liste, und die Pruefungen fallen sichtbar statt
   still gruen zu werden. */
function schiffeAusDatei(){
  const roh = tabelleAus('SHIP_DEFS');
  return roh.split("{ key:'").slice(1).map(st => {
    const k = st.slice(0, st.indexOf("'"));
    const m = st.match(/\batk:\s*(-?\d+(?:\.\d+)?)/);
    return (k && m) ? { key: k, atk: Number(m[1]) } : null;
  }).filter(Boolean);
}
function modulzeilenAusDatei(){
  const roh = tabelleAus('SHIP_MODULE_DEFS');
  return roh.split("{ key:'").slice(1).map(st => {
    const bis = st.indexOf('\n    {');
    const e = bis > 0 ? st.slice(0, bis) : st;
    const kl = e.match(/klasse:'([a-z]+)'/), ef = e.match(/effect:'([a-z]+)'/);
    const q  = /quelle:\s*HERKUNFT_ABGRUND/.test(e) ? 'abgrund' : 'sonst';
    return (kl && ef) ? { klasse: kl[1], effect: ef[1], quelle: q } : null;
  }).filter(Boolean);
}
let A = null, ECHT = null, A_FEHLER = '';
try {
  const quelle = [
    /* DIE ECHTEN WERTE, ABER OHNE DIE ABHAENGIGKEITSKETTE. SHIP_DEFS im Ganzen zu laden
       scheitert (`shipCost`, `jaegerCost`, … sind Funktionen und Konstanten aus dem halben
       Spiel); SHIP_MODULE_DEFS ebenso. Gelesen werden deshalb genau die FELDER, um die es geht -
       aus derselben Tabelle, mit denselben Zahlen. Das ist etwas anderes als sie zu erfinden:
       Dreht eine Balance-Runde einen Angriffswert, dreht der Test mit. */
    'const SHIP_DEFS = '+JSON.stringify(schiffeAusDatei())+';',
    'const SHIP_MODULE_DEFS = '+JSON.stringify(modulzeilenAusDatei())+';',
    "const HERKUNFT_ABGRUND = 'abgrund';",
    tabelleAus('ATTACK_SHIP_KEYS'), objektAus('CARGO_PER_SHIP'),
    tabelleAus('SHIP_CLASS_DEFS'),
    fnAus('shipBaseAtk'),
    // Nur DIESE eine Attrappe: welche Module ausgeruestet sind, haengt am Spielstand und ist die
    // Frage, die der Test von aussen stellen will - alles andere kommt aus der Datei.
    "let AUSGERUESTET = [];",
    "function abgrundSchiffsmodul(f, kl, e){ return AUSGERUESTET.some(p => p.klasse === kl && p.effect === e) ? 1 : 0; }",
    fnAus('abgrundModulPaare'), fnAus('abgrundArtKraft'), fnAus('abgrundAnteilStaerksteArt'),
    fnAus('abgrundAnteilFracht'), fnAus('abgrundAnteilMitTiefenmodul'),
    "return { staerkste: abgrundAnteilStaerksteArt, fracht: abgrundAnteilFracht,",
    "         modul: abgrundAnteilMitTiefenmodul, paare: abgrundModulPaare,",
    "         atk: shipBaseAtk, setze: p => { AUSGERUESTET = p; },",
    "         KEYS: ATTACK_SHIP_KEYS, CARGO: CARGO_PER_SHIP };"
  ].join('\n');
  A = new Function(quelle)();
  ECHT = !!A;
// Der Grund wird MITGEFUEHRT. Ein `catch`, das nur `null` setzt, macht aus einem kaputten
// Kontextaufbau eine Pruefung, die aus dem falschen Grund rot ist - und man sucht den Fehler im
// Spielcode statt im Test. Genau das ist hier zweimal passiert.
} catch(e){ A = null; A_FEHLER = e.message; }

const rd = x => Math.round(x*1000)/1000;
/* Die Bezugswerte werden GEMESSEN, nicht getippt: shipBaseAtk kommt aus der Datei, also altert
   der Test nicht, wenn eine Balance-Runde einen Angriffswert dreht. */
/* Die Flotte ist so gewaehlt, dass die staerkste Art und der Frachtanteil VERSCHIEDENE Werte
   ergeben. Der erste Entwurf nahm eine, in der beide zufaellig 0,725 waren - ein Vertauschen der
   beiden Funktionen waere darin unsichtbar geblieben. Der Kausalitaetsbrecher ist das staerkste
   Schiff ohne Frachtraum, der Urmaterie-Koloss das einzige MIT Frachtraum und Angriffswert. */
const F = A ? { jaeger:10, kausalitaetsbrecher:2, urmateriekoloss:1 } : null;
const w = k => A ? A.atk(k) * F[k] : 0;
const summeF = A ? w('jaeger') + w('kausalitaetsbrecher') + w('urmateriekoloss') : 0;
merke('2a: die Anteile werden gegen die ECHTEN Schiffstabellen gerechnet',
  !!A && summeF > 0
    && rd(A.staerkste(F)) === rd(Math.max(w('jaeger'), w('kausalitaetsbrecher'), w('urmateriekoloss'))/summeF)
    && rd(A.staerkste(F)) !== rd(A.fracht(F))   // sonst waere ein Vertauschen unsichtbar
    // Der Urmaterie-Koloss ist das einzige Schiff mit Angriffswert UND Frachtraum - genau das
    // Schiff, fuer das der Satz „Frachtraum zaehlt nur zum Teil" ueberhaupt Sinn ergibt.
    && rd(A.fracht(F)) === rd(w('urmateriekoloss')/summeF)
    && A.fracht(F) > 0,
  { staerkste: A && rd(A.staerkste(F)), fracht: A && rd(A.fracht(F)),
    kolossAtk: A && A.atk('urmateriekoloss'), kolossFracht: A && A.CARGO['urmateriekoloss'],
    kontextFehler: A_FEHLER || undefined });

merke('2b: ohne Flotte und ohne Feuerkraft ist jeder Anteil 0, keine Division durch null',
  !!A
    && A.staerkste(null) === 0 && A.fracht(null) === 0 && A.modul(null) === 0
    && A.staerkste({ frachter: 40 }) === 0 && A.fracht({ frachter: 40 }) === 0,
  { leer: A && A.staerkste(null), ohneFeuerkraft: A && A.staerkste({ frachter: 40 }) });

/* 2c: DIE ZOLL-REGEL MUSS ERFUELLBAR SEIN. Ohne ausgeruestetes Modul ist der Anteil 0 - mit einem
   passenden muss er echt groesser werden, sonst verlangt die Regel etwas, das der Spieler gar
   nicht liefern kann. Gemessen mit einem Paar aus der Datei, nicht mit einem getippten. */
let zollOhne = null, zollMit = null;
if (A){
  A.setze([]);            zollOhne = A.modul({ schlachtschiff: 5 });
  A.setze(A.paare());     zollMit  = A.modul({ schlachtschiff: 5 });
  A.setze([]);
}
merke('2c: der Zoll ist erfuellbar - mit passendem Modul steigt der Anteil',
  !!A && zollOhne === 0 && zollMit > 0 && A.paare().length > 0,
  { ohneModul: zollOhne, mitModul: zollMit, paare: A && A.paare().length });

// ---- 3) Die Modul-Liste wird GEMESSEN, nicht gepflegt -----------------------------------------
/* DER EIGENTLICHE WAECHTER DIESES TESTS. Die Zoll-Regel fragt „traegt die Klasse ein
   Tiefenmodul", und die Antwort darf an keiner gepflegten Liste haengen.
   DER ERSTE ENTWURF MASS DAS FALSCHE: Er verglich zwei getippte Listen mit den
   `abgrundSchiffsmodul(...)`-AUFRUFSTELLEN - und war gruen, obwohl der Stillgaenger (Klasse
   `aufklaerer`, Effekt `sondensicht`) fehlte: Der wird ueber `shipModuleBonusFor` gelesen und hat
   gar keine solche Aufrufstelle. Ein achtes Modul war der Regel entwischt, bevor sie ausgeliefert
   war. Gemessen wird jetzt gegen die GRUNDWAHRHEIT: alles in SHIP_MODULE_DEFS mit
   `quelle === HERKUNFT_ABGRUND`. Die Zaehlung `8` steht bewusst NICHT hier - sie waere beim
   neunten Modul falsch; verlangt wird Deckungsgleichheit. */
const paareAusDatei = A ? A.paare() : [];
const paareSoll = modulzeilenAusDatei().filter(d => d.quelle === 'abgrund')
  .map(d => d.klasse+':'+d.effect).sort();
const paareIst = paareAusDatei.map(p => p.klasse+':'+p.effect).sort();
merke('3a: die Zoll-Regel kennt GENAU die Abgrund-Schiffsmodule, die es gibt',
  paareSoll.length > 0
    && JSON.stringify(paareIst) === JSON.stringify(paareSoll),
  { anzahl: paareIst.length, soll: paareSoll.length,
    fehlend: paareSoll.filter(x => paareIst.indexOf(x) < 0),
    ueberzaehlig: paareIst.filter(x => paareSoll.indexOf(x) < 0) });

// ---- 4) Die zwei Wirkstellen ------------------------------------------------------------------
const kraftQ = fnAus('abgrundKampfkraft');
const iDeckel = kraftQ.indexOf('ABGRUND_KRAFT_DECKEL');
const iRegel = kraftQ.indexOf('regel.kraft(');
merke('4a: die Angriffsregel wirkt in abgrundKampfkraft und AUSSERHALB der gedeckelten Gruppe',
  kraftQ.length > 0 && iDeckel >= 0 && iRegel > iDeckel
    && /const regel = sektor\.waechter && sektor\.waechter\.regel;/.test(kraftQ)
    // WOERTLICH: `regel.kraft(rohkraft, ...)` staende ebenfalls hinter dem Deckel und waere
    // trotzdem falsch - es umginge die Mutatoren und die ganze Bonusgruppe.
    && /regel\.kraft\(kraft, flotte, sektor\)/.test(kraftQ),
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
/* WOERTLICH, nicht nur der Name: `abgrundVerlustFaktor(sektor, 1, komp)` haette den Panzer
   stillschweigend weggelassen und waere durch eine blosse Namenspruefung geschluepft. */
const selbstrechner = verlustStellen.filter(z => z.indexOf('abgrundVerlustFaktor(sektor, panzer, komp)') < 0);
merke('4b: BEIDE Verlust-Aufrufstellen gehen durch abgrundVerlustFaktor, keine rechnet selbst',
  verlustFn.length > 0
    && /a\.konstGesehen\[/.test(block)   // Beleg, dass der geschnittene Block die Aufloesung ist
    && verlustStellen.length >= 2
    && selbstrechner.length === 0,
  { stellen: verlustStellen.length, selbstrechner: selbstrechner.length });

// ---- 5) Der Verstaerker verdoppelt nur den UEBERSCHUSS ----------------------------------------
/* ALLE SECHS REGELN NUMERISCH, nicht nur der Verstaerker. Der erste Entwurf pruefte genau eine
   und liess fuenf ungedeckt - gemessen waeren damit unter anderem durchgegangen: den Zoll
   invertieren, den Blindfleck auf die SCHWAECHSTE Art umstellen, dem Gegenschlag die Tiefe
   wegnehmen. Die Anteilsfunktionen sind hier stellbar, damit jede Regel gegen bekannte Eingaben
   geprueft werden kann; die Regeln selbst und ABGRUND_REGEL_MAX kommen aus der Spieldatei. */
let R = null, stellen = null, R_FEHLER = '';
try {
  const quelle = [
    "let ANTEIL = { staerkste:0, modul:1, fracht:0 }, KANAL = 0, KIEL = 0, KESSEL = 0;",
    "function abgrundAnteilStaerksteArt(){ return ANTEIL.staerkste; }",
    "function abgrundAnteilMitTiefenmodul(){ return ANTEIL.modul; }",
    "function abgrundAnteilFracht(){ return ANTEIL.fracht; }",
    "function abgrundKanalBonus(){ return KANAL; }",
    "function abgrundSchiffsmodul(){ return KIEL; }",
    "function tiefenschiffBonus(){ return KESSEL; }",
    fnAus('abgrundSchiffsschutz'),
    konstAus('ABGRUND_REGEL_MAX'),
    tabelleAus('ABGRUND_WAECHTER_REGELN'),
    "return { regeln: ABGRUND_WAECHTER_REGELN, max: ABGRUND_REGEL_MAX,",
    "         setze: o => { if(o.anteil) ANTEIL = o.anteil; if('kanal' in o) KANAL = o.kanal;",
    "                       if('kiel' in o) KIEL = o.kiel; if('kessel' in o) KESSEL = o.kessel; } };"
  ].join('\n');
  const g = new Function(quelle)();
  R = g.regeln; stellen = g;
} catch(e){ R = null; R_FEHLER = e.message; }
const regelVon = k => R && R.find(r => r.key === k);

/* 5b-5d: die drei Kraft-Regeln. Gemessen wird die REGEL (was sie mit welchem Anteil macht),
   nicht eine Momentaufnahme - und ausdruecklich der Deckel, der sie davon abhaelt, eine Flotte
   auf null zu setzen. */
let kraftFaelle = null;
if (stellen){
  const max = stellen.max;
  stellen.setze({ anteil:{ staerkste:1, modul:0, fracht:1 } });   // der schlimmste Fall je Regel
  kraftFaelle = {
    blindfleckVoll: regelVon('blindfleck').kraft(100, {}, {}),
    zollLeer:       regelVon('zoll').kraft(100, {}, {}),
    wiegerVoll:     regelVon('wieger').kraft(100, {}, {}),
    erwartet:       100 * (1 - max)
  };
}
merke('5b: keine Kraft-Regel setzt die Flotte auf null - der Deckel greift',
  !!kraftFaelle && stellen.max > 0 && stellen.max < 1
    && rd(kraftFaelle.blindfleckVoll) === rd(kraftFaelle.erwartet)
    && rd(kraftFaelle.zollLeer) === rd(kraftFaelle.erwartet)
    && rd(kraftFaelle.wiegerVoll) === rd(kraftFaelle.erwartet),
  Object.assign({ deckel: stellen && stellen.max }, kraftFaelle || { kontextFehler: R_FEHLER }));

let kraftMild = null;
if (stellen){
  stellen.setze({ anteil:{ staerkste:0.25, modul:0.75, fracht:0.10 } });
  kraftMild = {
    blindfleck: regelVon('blindfleck').kraft(100, {}, {}),
    zoll:       regelVon('zoll').kraft(100, {}, {}),
    wieger:     regelVon('wieger').kraft(100, {}, {})
  };
}
merke('5c: unterhalb des Deckels wirkt jede Kraft-Regel genau nach ihrem Anteil',
  !!kraftMild
    && rd(kraftMild.blindfleck) === 75    // 1 - 0,25
    && rd(kraftMild.zoll) === 75          // nur der Anteil MIT Modul zaehlt
    && rd(kraftMild.wieger) === 90,       // 1 - 0,10
  kraftMild || { kontextFehler: R_FEHLER });

/* 5d: die Richtung. Ein invertierter Zoll oder ein Blindfleck auf der SCHWAECHSTEN Art bliebe
   sonst unsichtbar - beide liefern bei symmetrischen Eingaben dieselben Zahlen. */
let richtung = null;
if (stellen){
  stellen.setze({ anteil:{ staerkste:0.9, modul:0.9, fracht:0.9 } });
  const hoch = { b: regelVon('blindfleck').kraft(100,{},{}), z: regelVon('zoll').kraft(100,{},{}), w: regelVon('wieger').kraft(100,{},{}) };
  stellen.setze({ anteil:{ staerkste:0.1, modul:0.1, fracht:0.1 } });
  const tief = { b: regelVon('blindfleck').kraft(100,{},{}), z: regelVon('zoll').kraft(100,{},{}), w: regelVon('wieger').kraft(100,{},{}) };
  richtung = { hoch, tief };
}
merke('5d: die Richtung stimmt - mehr Anteil schadet bei Blindfleck und Wieger, hilft beim Zoll',
  !!richtung
    && richtung.hoch.b < richtung.tief.b
    && richtung.hoch.w < richtung.tief.w
    && richtung.hoch.z > richtung.tief.z,
  richtung || { kontextFehler: R_FEHLER });

/* 5e/5f: die beiden uebrigen Verlust-Regeln. Beide heben einen Schutz auf, den `panzer` schon
   enthaelt - gemessen wird, dass sie ihn GENAU aufheben und nicht mehr. */
let rostF = null, gegenF = null;
if (stellen){
  stellen.setze({ kanal: 0.5, kiel: 0, kessel: 0 });
  // panzer enthaelt (1-0,5); die Regel muss daraus wieder 1 machen.
  rostF = regelVon('rostfrass').verlust(1 * (1 - 0.5), {}, { mods:{ loss:1 } });
  stellen.setze({ kanal: 0, kiel: 0.4, kessel: 0.25 });
  const schutz = (1 - Math.min(0.5, 0.4 * Math.min(1, 100/50))) * (1 - 0.25);
  gegenF = { ist: regelVon('gegenschlag').verlust(1 * schutz, {}, { mods:{ loss:1 }, tiefe:100 }), schutz };
  stellen.setze({ kanal: 0, kiel: 0, kessel: 0 });
}
merke('5e: Rostfrass hebt den Werkstatt-/Reliquienschutz genau auf, nicht mehr',
  rostF !== null && rd(rostF) === 1, { faktor: rostF });
merke('5f: der Gegenschlag hebt Kiel und Kessel genau auf, mit der Tiefe des Sektors',
  !!gegenF && rd(gegenF.ist) === 1 && gegenF.schutz < 1, gegenF);

const verst = regelVon('verstaerker');
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
