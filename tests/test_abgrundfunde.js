// Abgrund-Paket E: FUNDE IM ABSTIEG - was zwischen zwei Sektoren eines Tauchplans liegt.
//
//   node tests/test_abgrundfunde.js
//
// DIE GEFAHR, GEGEN DIE DIESER TEST GEBAUT IST, ist die Waehrung. Die Vorgabe lautete „bergen und
// ZEIT verlieren" - und Zeit ist genau das, was hier NICHT bezahlt werden darf: `endTime` steht
// seit dem Abtauchen fest, und die Hilfe sagt das seit v8.712.0 ausdruecklich zu. Wer den Fund
// doch an der Flugzeit haengt, bricht eine Zusage, die kein Kampf und kein Bestandstest bemerkt -
// der Spieler sieht nur, dass seine Flotte laenger wegbleibt als versprochen. Bezahlt wird mit
// ATEM. Zweite Gefahr: ein Fund NACH dem letzten Sektor - dort gibt es keinen Zwischenraum, und
// ein Fund, der den Plan verlaengert, waere ein sechster Sektor durch die Hintertuer.
//
// GEPRUEFT WIRD:
//   1a  Es gibt Funde, jeder mit Schluessel, Namen, Text, Icon und einer Gabe, die es gibt.
//   1b  Die Vorgabe kennt genau zwei Werte - „mal so, mal so" waere keine Entscheidung.
//   2a  Ein Fund wird BERECHNET, nicht gewuerfelt: dieselbe Tiefe und Stroemung ergeben denselben
//       Fund, eine andere Stroemung darf ihn aendern. VERHALTEN, mit aufgerufener Funktion.
//   2b  Er korreliert NICHT mit dem Sektor darueber - sonst laege bei jedem Waechter auch ein Fund.
//   2c  Der Ertrag waechst mit der Tiefe und ist nie null.
//   3a  Bezahlt wird mit ATEM. Nirgends im Fund-Block wird endTime, dauer oder flightTime angefasst.
//   3b  Der Fund liegt NUR ZWISCHEN zwei Sektoren - der Riegel gegen den letzten steht da.
//   3c  Die Vorgabe kommt aus der MISSION, nicht aus dem aktuellen Zustand.
//   3d  Reicht der Atem nicht, wird vorbeigezogen statt abgebrochen.
//   4a  Sichtbar: Bedienung im Tauchreiter, Tiefensonde, Hilfe - und eine eigene Meldung, auch
//       wenn der Plan ganz durchlaeuft.
//
// GEGENPROBEN:
//   =alt        der Stand vor dem Paket - dort faellt alles
//   =zeit       der Fund zieht an der Flugzeit statt am Atem -> 3a
//   =letzter    der Riegel gegen den letzten Sektor faellt weg -> 3b
//   =zustand    die Vorgabe kommt aus dem aktuellen Zustand statt aus der Mission -> 3c
//   =abbruch    zu wenig Atem bricht den Plan ab, statt vorbeizuziehen -> 3d
const fs = require('fs');
const { SPIELDATEI } = require('./lib/umgebung');
const src = fs.readFileSync(process.env.KEPLER_SPIELDATEI || SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };
const SAB = process.env.KEPLER_ABGRUNDFUNDE_GEGENPROBE || '';
const MUSS_FALLEN = {
  alt:      ['1a','1b','2a','2b','2c','3a','3b','3c','3d','4a','4b','4c','4d','4e'],
  zeit:     ['3a'],
  letzter:  ['3b'],
  zustand:  ['3c'],
  abbruch:  ['3d'],
  // Die Befunde der Durchsicht, je einzeln zurueckgebaut.
  ohnefeld: ['4a'],   // das Auswahlfeld fehlt - der Ist-Zustand vor dieser Runde
  ohnezeile:['4b'],   // der Fund unter der aktuellen Tiefe wird wieder nicht gezeigt
  ohnesicht:['4e'],   // die Vorschau zaehlt die Funde nicht mit
  gratis:   ['1b'],   // ABGRUND_FUND_ATEM = 0 - Bergen kostet nichts
  flach:    ['2c'],   // ein Ertragszweig waechst nicht mit der Tiefe
  sektorseed:['2b']   // der Fund haengt am Sektor-Wurf
};

function fnAus(name){
  const i = js.indexOf('function '+name+'(');
  if (i < 0) return '';
  let d=0, s=js.indexOf('{', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}
function tabelleAus(name){
  const i = js.indexOf('const '+name+' = [');
  if (i < 0) return '';
  let d=0, s=js.indexOf('[', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(i, k+1)+';';
}
const konstAus = n => { const m = js.match(new RegExp('^\\s*const '+n+' = .*$','m')); return m ? m[0].trim() : ''; };

/* DER KONTEXT WIRD GANZ OBEN GEBAUT: Pruefung 1b liest ihn seit dieser Runde mit (sie haelt
   fest, dass Bergen wirklich Atem kostet), und eine `let`-Deklaration weiter unten waere fuer sie
   die temporale Todeszone gewesen - genau der Fehler, den das Projekt im Spielcode zweimal
   hatte. */
let G = null, G_FEHLER = '';
try {
  const quelle = [
    konstAus('ABGRUND_FUND_CHANCE'), konstAus('ABGRUND_FUND_ATEM'),
    tabelleAus('ABGRUND_FUNDE'),
    fnAus('abgrundRng'),
    "function abgrundStroemung(){ return 0; }",
    // Der Ertrag liest seit dieser Runde die echten Sektorwerte und die Ausbau-Faktoren. Das
    // Bergungsgut kommt aus der Spieldatei; die beiden Faktoren sind Attrappen mit 1, also der
    // Zustand OHNE jeden Ausbau - gemessen wird das Wachstum mit der Tiefe, nicht die Werkstatt.
    konstAus('ABGRUND_FUND_WERT'), fnAus('abgrundBergungsgut'),
    "function abgrundBeuteFaktor(){ return 1; }",
    "function abgrundSplitterFaktor(){ return 1; }",
    fnAus('abgrundFundZwischen'), fnAus('abgrundFundErtrag'),
    "return { fund: abgrundFundZwischen, ertrag: abgrundFundErtrag, chance: ABGRUND_FUND_CHANCE, atem: ABGRUND_FUND_ATEM };"
  ].join('\n');
  G = new Function(quelle)();
} catch(e){ G = null; G_FEHLER = e.message; }

// ---- 1) Die Tabellen -------------------------------------------------------------------------
const fundTab = tabelleAus('ABGRUND_FUNDE');
const eintraege = [...fundTab.matchAll(/\{ key:'([a-z]+)', name:'([^']+)', icon:'([a-z0-9-]+)'/g)]
  .map(m => ({ key:m[1], name:m[2], icon:m[3] }));
const gaben = [...fundTab.matchAll(/gabe:'([a-z]+)'/g)].map(m => m[1]);
const ertragQ = fnAus('abgrundFundErtrag');
// Die Gaben muessen im Ertrag auch VORKOMMEN - eine erfundene Gabe fiele sonst still in den
// Sammelzweig und gaebe klammheimlich Modulfragmente.
const gabenBekannt = gaben.filter(g => ertragQ.indexOf("'"+g+"'") >= 0 || g === 'fragmente');
merke('1a: es gibt Funde, jeder mit Schluessel, Namen, Icon und einer Gabe, die der Ertrag kennt',
  eintraege.length >= 3 && gaben.length === eintraege.length
    && gabenBekannt.length === gaben.length
    && eintraege.every(e => e.key && e.name && /^ti-/.test(e.icon)),
  { anzahl: eintraege.length, gaben, unbekannt: gaben.filter(g => gabenBekannt.indexOf(g) < 0) });

const vorgabeTab = tabelleAus('ABGRUND_FUND_VORGABEN');
const werte = [...vorgabeTab.matchAll(/wert:'([a-z]+)'/g)].map(m => m[1]);
merke('1b: die Vorgabe kennt genau zwei Werte, und Bergen kostet wirklich Atem',
  werte.length === 2 && werte.indexOf('bergen') >= 0 && werte.indexOf('vorbei') >= 0
    // ABGRUND_FUND_ATEM = 0 waere durch alle uebrigen Pruefungen gefallen: 3a und 3d vergleichen
    // nur Zeichenketten. Die zentrale Zusage des Pakets ist „kostet einen Sektor" - hier steht sie.
    && !!G && G.atem >= 1,
  { werte, atem: G && G.atem });

// ---- 2) Berechnet, nicht gewuerfelt ----------------------------------------------------------

// Gemessen ueber einen breiten Bereich, nicht an einer einzelnen Tiefe: Eine einzelne koennte
// zufaellig leer sein und die Pruefung waere aus dem falschen Grund gruen.
const tiefen = [];
for (let t = 1; t <= 400; t++) tiefen.push(t);
const mitFund = G ? tiefen.filter(t => G.fund(t, 0)) : [];
const zweimalGleich = G ? tiefen.every(t => {
  const a = G.fund(t, 0), b = G.fund(t, 0);
  return (a && b) ? a.key === b.key : a === b;
}) : false;
const andereStroemung = G ? tiefen.filter(t => {
  const a = G.fund(t, 0), b = G.fund(t, 7);
  return (a ? a.key : null) !== (b ? b.key : null);
}).length : 0;
merke('2a: ein Fund wird berechnet, nicht gewuerfelt - und die Stroemung aendert ihn',
  !!G && zweimalGleich && mitFund.length > 0 && mitFund.length < tiefen.length
    && andereStroemung > 0,
  { tiefenMitFund: mitFund.length, vonTiefen: tiefen.length,
    anteil: G ? Math.round(mitFund.length/tiefen.length*100)/100 : null,
    chance: G && G.chance, aendertSichMitStroemung: andereStroemung,
    kontextFehler: G_FEHLER || undefined });

/* 2b MISST JETZT DIE SEEDS, NICHT EINE QUOTE. Der erste Entwurf verglich die Fundquote auf
   Waechtertiefen mit der Gesamtquote bei 0,25 Toleranz - und die behauptete Sabotage (Fund am
   SEKTOR-Seed) laege bei 0,017 Abstand, waere also gruen geblieben. Der Grund ist strukturell:
   Ob eine Tiefe einen Waechter traegt, entscheidet `abgrundIstWaechter` allein aus der Tiefe,
   nie der Wurf - eine Quotengleichheit kann darum gar nicht entstehen. Verglichen werden deshalb
   die Konstanten selbst: Der Fund-Seed darf keine der drei Sektor-Konstanten benutzen. */
const sektorQ = fnAus('abgrundSektor');
const mSek = sektorQ.match(/abgrundRng\(([^)]*)\)/);
const fundQ = fnAus('abgrundFundZwischen');
const mFund = fundQ.match(/abgrundRng\(([^)]*)\)/);
const zahlen = t => (t ? (t.match(/\d+/g) || []) : []);
const sekZahlen = zahlen(mSek && mSek[1]);
const fundZahlen = zahlen(mFund && mFund[1]);
const geteilt = fundZahlen.filter(z => sekZahlen.indexOf(z) >= 0);
merke('2b: der Fund-Wurf teilt keine einzige Konstante mit dem Sektor-Wurf',
  sekZahlen.length >= 3 && fundZahlen.length >= 3 && geteilt.length === 0,
  { sektor: sekZahlen, fund: fundZahlen, geteilt });

/* ALLE DREI ZWEIGE, nicht nur einer. Der erste Entwurf rief zweimal denselben Fund und lief
   damit durch genau ein `if` - `menge: 1` im Splitter-Zweig waere gruen geblieben, solange der
   gezogene Fund zufaellig ein anderer war. */
const zweige = ['bergung','splitter','fragmente'];
const ertraege = G ? zweige.map(g => ({ g, klein: G.ertrag({ gabe:g }, 10).menge,
                                           gross: G.ertrag({ gabe:g }, 200).menge })) : [];
merke('2c: JEDER Ertragszweig waechst mit der Tiefe und ist nie null',
  ertraege.length === 3
    && ertraege.every(e => e.klein >= 1 && e.gross > e.klein)
    && !G.ertrag(null, 10),
  { ertraege });

// ---- 3) Die Abrechnung -----------------------------------------------------------------------
function klammer(quelle, start, auf, zu){
  let d = 0, s = quelle.indexOf(auf, start), k = s;
  for (; k < quelle.length; k++){ if (quelle[k]===auf) d++; else if (quelle[k]===zu){ d--; if(!d) break; } }
  return quelle.slice(s, k+1);
}
const vonBlock = js.indexOf("} else if (m.type === 'abgrund'){");
const block = vonBlock >= 0 ? klammer(js, vonBlock, '{', '}') : '';
/* GESCHNITTEN WIRD DER AEUSSERE BLOCK, nicht der innere. Der erste Entwurf nahm die naechste
   `if (`-Klammer vor dem Aufruf - das ist `if (fund){`, und der Riegel gegen den letzten Sektor
   steht eine Ebene darueber. 3b war damit rot auf richtigem Code. Fehlt der aeussere Anker
   (genau der Fall, den die Gegenprobe `letzter` herstellt), faellt der Schnitt auf den inneren
   zurueck - und 3b wird rot, weil der Riegel darin wirklich nicht steht. */
const iFund = block.indexOf('abgrundFundZwischen(');
const iAussen = iFund >= 0 ? block.lastIndexOf('if (tiefe !== planTiefen', iFund) : -1;
const iStart = iAussen >= 0 ? iAussen : (iFund >= 0 ? block.lastIndexOf('if (', iFund) : -1);
/* KOPF UND RUMPF: `klammer` schneidet ab der oeffnenden Klammer - die BEDINGUNG stand damit gar
   nicht im Ausschnitt, und 3b suchte einen Riegel in einem Text, der ihn nie enthalten konnte.
   Zweiter Anlauf desselben Fehlers an derselben Pruefung. */
const fundRumpf = iStart >= 0 ? klammer(block, iStart, '{', '}') : '';
const fundKopf  = iStart >= 0 ? block.slice(iStart, block.indexOf('{', iStart)) : '';
const fundBlock = fundKopf + fundRumpf;

/* 3a IST DIE KERNPRUEFUNG. Der Fund darf die Flugzeit nicht anfassen - sie steht seit dem
   Abtauchen fest. Geprueft wird beides: dass der Atem gezogen wird UND dass keine Zeitgroesse
   im Block vorkommt. Nur eines von beidem waere zu wenig: „atemRest -= 1" daneben schriebe man
   schnell, waehrend die Zeit trotzdem verschoben wird. */
const zeitWoerter = ['endTime', 'flightTime', 'dauer', 'startTime'];
const zeitTreffer = zeitWoerter.filter(w => fundBlock.indexOf(w) >= 0);
merke('3a: bezahlt wird mit Atem, und die Flugzeit wird nirgends angefasst',
  fundBlock.length > 40
    && /atemRest -= ABGRUND_FUND_ATEM;/.test(fundBlock)
    && zeitTreffer.length === 0,
  { blockDa: fundBlock.length > 40, zeitTreffer });

merke('3b: ein Fund liegt NUR zwischen zwei Sektoren, nie hinter dem letzten',
  fundBlock.length > 40
    && /tiefe !== planTiefen\[planTiefen\.length-1\]/.test(fundBlock),
  { riegelDa: /tiefe !== planTiefen\[planTiefen\.length-1\]/.test(fundBlock) });

merke('3c: die Vorgabe kommt aus der Mission, nicht aus dem aktuellen Zustand',
  fundBlock.indexOf('m.plan && m.plan.funde') >= 0
    && fundBlock.indexOf('a.planFunde') < 0
    && /funde: planFunde/.test(js),
  { ausMission: fundBlock.indexOf('m.plan && m.plan.funde') >= 0,
    ausZustand: fundBlock.indexOf('a.planFunde') >= 0 });

/* 3d: Zu wenig Atem heisst VORBEIZIEHEN, nicht Abbrechen. Ein Fund ist eine Gelegenheit; wer
   daraus ein Hindernis macht, kuerzt den Plan aus einem Grund, den keine Vorschau nennt. */
merke('3d: reicht der Atem nicht, wird vorbeigezogen statt abgebrochen',
  fundBlock.length > 40
    && /const reicht = atemRest >= ABGRUND_FUND_ATEM;/.test(fundBlock)
    && fundBlock.indexOf('planAbbruch') < 0
    && fundBlock.indexOf('break;') < 0,
  { keinAbbruch: fundBlock.indexOf('planAbbruch') < 0, keinBreak: fundBlock.indexOf('break;') < 0 });

// ---- 4) Sichtbar -----------------------------------------------------------------------------
/* 4a WAR DIE PRUEFUNG, DIE DAS PAKET RETTEN SOLLTE - und sie war vacuous. Sie suchte
   `data-abgrund-funde` irgendwo in der Datei, und dieser Text steht auch im HANDLER
   (`box.querySelector('[data-abgrund-funde]')`). Das Auswahlfeld selbst fehlte komplett: Der
   Handler suchte ein Element, das es nicht gab, `onchange` wurde nie gebunden, und jeder Spieler
   barg fuer immer - waehrend Hilfe und Patchnote zusagten, er koenne waehlen. Gepruft wird jetzt
   das MARKUP, und die vier Aussagen stehen einzeln statt in einem &&-Turm: Faellt eine, sagt der
   Name welche. */
merke('4a: das Auswahlfeld existiert wirklich und ist an die Vorgaben gebunden',
  /<select data-abgrund-funde/.test(js)
    && /ABGRUND_FUND_VORGABEN\.map\(v =>/.test(js)
    && /v\.wert===planFunde\?' selected'/.test(js)
    && /const fundeWahl = box\.querySelector\('\[data-abgrund-funde\]'\);/.test(js)
    && /fundeWahl\.onchange/.test(js),
  { markup: /<select data-abgrund-funde/.test(js),
    handler: /fundeWahl\.onchange/.test(js) });

merke('4b: die Tiefensonde zeigt auch den Fund unter der GEWAEHLTEN Tiefe',
  // Der einzige Zwischenraum eines Zweierplans - und der ist ohne Werkstatt-Ausbau der Normalfall.
  // Er wurde berechnet und von niemandem gelesen; die Sondenliste beginnt erst bei Tiefe+1.
  /const fundHier = fundeVoraus\[tiefe\];/.test(js)
    && /\$\{fundHierHtml\}/.test(js)
    && /fundeVoraus\[v\.tiefe\]/.test(js),
  {});

merke('4c: die Hilfe erklaert die Funde',
  /Funde im Abstieg – was zwischen zwei Sektoren liegt/.test(js), {});

merke('4d: die Fundmeldung steht in einer EIGENEN Zeile',
  // Es gibt Funde auch dann, wenn der Plan ganz durchlaeuft - dann steht keine Abbruchmeldung da,
  // und ein Anhang an sie waere spurlos gewesen.
  /if \(fundText && showLog !== false\) log\('Zwischen den Sektoren:'\+fundText/.test(js), {});

/* 4e: DIE VORSCHAU RECHNET DIE FUNDE MIT. Sie liegen deterministisch fest und die Sonde zeigt
   sie - eine Vorschau ohne sie sagte „Route kostet 2" bei Atem 2 und liess den Verband trotzdem
   nach einem Sektor umkehren. Genau die Klasse Fehler, die der Code an drei anderen Stellen
   selbst verbietet. */
merke('4e: die Atem-Vorschau zaehlt die geborgenen Funde mit',
  /planFunde === 'bergen' && abgrundFundZwischen\(tiefe \+ i - 1\)/.test(js)
    && /atemFunde \+= ABGRUND_FUND_ATEM;/.test(js)
    && /davon \$\{atemFunde\} für Funde/.test(js),
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
