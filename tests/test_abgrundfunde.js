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
  alt:     ['1a','1b','2a','2b','2c','3a','3b','3c','3d','4a'],
  zeit:    ['3a'],
  letzter: ['3b'],
  zustand: ['3c'],
  abbruch: ['3d']
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
merke('1b: die Vorgabe kennt genau zwei Werte',
  werte.length === 2 && werte.indexOf('bergen') >= 0 && werte.indexOf('vorbei') >= 0,
  { werte });

// ---- 2) Berechnet, nicht gewuerfelt ----------------------------------------------------------
let G = null, G_FEHLER = '';
try {
  const quelle = [
    konstAus('ABGRUND_FUND_CHANCE'), konstAus('ABGRUND_FUND_ATEM'),
    tabelleAus('ABGRUND_FUNDE'),
    fnAus('abgrundRng'),
    "function abgrundStroemung(){ return 0; }",
    fnAus('abgrundFundZwischen'), fnAus('abgrundFundErtrag'),
    "return { fund: abgrundFundZwischen, ertrag: abgrundFundErtrag, chance: ABGRUND_FUND_CHANCE };"
  ].join('\n');
  G = new Function(quelle)();
} catch(e){ G = null; G_FEHLER = e.message; }

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

/* 2b: Ein Fund darf nicht mit der Waechtertiefe wandern. Gemessen wird der Anteil der
   Waechtertiefen mit Fund gegen den Anteil aller Tiefen - laege der Fund am selben Wurf wie der
   Sektor, waeren beide Anteile identisch oder eines von beiden 0 bzw. 1. */
const waechterTiefen = tiefen.filter(t => t % 10 === 0);
const waechterMitFund = G ? waechterTiefen.filter(t => G.fund(t, 0)).length : 0;
const quoteAlle = mitFund.length / tiefen.length;
const quoteW = waechterTiefen.length ? waechterMitFund / waechterTiefen.length : 0;
merke('2b: der Fund haengt nicht am selben Wurf wie der Sektor darueber',
  !!G && waechterMitFund > 0 && waechterMitFund < waechterTiefen.length
    && Math.abs(quoteW - quoteAlle) < 0.25,
  { quoteAlle: Math.round(quoteAlle*100)/100, quoteWaechter: Math.round(quoteW*100)/100 });

const e10 = G ? G.ertrag(G.fund(10,0) || { gabe:'bergung' }, 10) : null;
const e200 = G ? G.ertrag(G.fund(10,0) || { gabe:'bergung' }, 200) : null;
merke('2c: der Ertrag waechst mit der Tiefe und ist nie null',
  !!e10 && !!e200 && e10.menge >= 1 && e200.menge > e10.menge
    && !G.ertrag(null, 10),
  { tiefe10: e10 && e10.menge, tiefe200: e200 && e200.menge });

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
merke('4a: Bedienung, Sonde, Hilfe und eine eigene Meldung',
  /data-abgrund-funde/.test(js)
    && /fundeVoraus\[v\.tiefe\]/.test(js)
    && /Funde im Abstieg – was zwischen zwei Sektoren liegt/.test(js)
    // Eine EIGENE Zeile, nicht an die Abbruchmeldung gehaengt: Es gibt Funde auch dann, wenn der
    // Plan ganz durchlaeuft - dann steht dort gar keine Abbruchmeldung.
    && /if \(fundText && showLog !== false\) log\('Zwischen den Sektoren:'\+fundText/.test(js),
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
