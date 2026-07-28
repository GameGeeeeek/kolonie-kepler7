// Konstellationen des Abgrunds (28.07.2026, v8.329.0).
//
// Eine Konstellation ist eine benannte Mutator-Kombination mit eigener Wirkung. Sie hat drei
// Eigenschaften, die alle still falsch sein koennen, ohne dass irgendwo ein Fehler auftaucht:
//
//   1) HAEUFIGKEIT. Das ganze System steht und faellt damit, wie oft man eine trifft. Ein
//      bestimmtes DREIERPAKET zu erwischen hat eine Wahrscheinlichkeit von 1/2024 je Sektor -
//      ueber hundert Tiefen sieht man es praktisch nie. Ein PAAR unter drei gezogenen Mutatoren
//      trifft rund 1,1%. Genau deshalb sind sechs der neun Paare und nur drei Triaden.
//      Eine Kombination, die versehentlich aus zwei sehr seltenen Mutatoren besteht oder deren
//      Teile sich gegenseitig ausschliessen, waere toter Inhalt - und das saehe man nie.
//      Deshalb wird hier GEZAEHLT, nicht geschaetzt: 4000 Sektoren durchgerechnet.
//   2) WIRKUNG. Die Faktoren laufen in dieselben mods wie die Mutatoren und muessen deshalb auch
//      durch dieselbe Deckelung. Wird die Konstellation NACH der Deckelung angewandt, kann sie
//      einen Sektor aus dem Rahmen heben - und das ist im Spiel nur als "der war komisch stark"
//      zu bemerken.
//   3) BANN. Streicht eine Gegenmassnahme einen beteiligten Mutator, MUSS sich die Konstellation
//      aufloesen. Tut sie das nicht, bliebe eine Wirkung stehen, deren Ursache weg ist - und die
//      Vorschau zeigte etwas anderes als der Kampf rechnet.
//
// Geprueft wird an den ECHTEN Funktionen aus der Spieldatei, nicht an nachgebauten Formeln.
const fs = require('fs');
const path = require('path');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail = false;
const check = (n, c, x) => { console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail = fail || !c; };

function klammer(start, auf, zu){
  let d = 0, s = js.indexOf(auf, start), k = s;
  for (; k < js.length; k++){ if (js[k]===auf) d++; else if (js[k]===zu){ d--; if(!d) break; } }
  return js.slice(s, k+1);
}
function arrAus(n){ const i = js.indexOf('const '+n+' = ['); if (i<0) throw new Error(n); return klammer(i,'[',']'); }
function objAus(n){ const i = js.indexOf('const '+n+' = {'); if (i<0) throw new Error(n); return klammer(i,'{','}'); }
function fnAus(n){
  const m = js.match(new RegExp('function\\s+'+n+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+n);
  const i = js.indexOf(m[0]);
  let d = 0, s = js.indexOf('{', i + m[0].length), k = s;
  for (; k < js.length; k++){ if (js[k]==='{') d++; else if (js[k]==='}'){ d--; if(!d) break; } }
  return js.slice(i, k+1);
}
function zahl(n){ return Number((js.match(new RegExp('const '+n+' = ([\\d.]+)'))||[])[1]); }

const G = new Function(`
  const ABGRUND_MUTATOREN = ${arrAus('ABGRUND_MUTATOREN')};
  const ABGRUND_KONSTELLATIONEN = ${arrAus('ABGRUND_KONSTELLATIONEN')};
  const ABGRUND_SYMBOLE = ${objAus('ABGRUND_SYMBOLE')};
  const ABGRUND_GRENZEN = ${objAus('ABGRUND_GRENZEN')};
  const ABGRUND_SILBEN_A = ${arrAus('ABGRUND_SILBEN_A')};
  const ABGRUND_SILBEN_B = ${arrAus('ABGRUND_SILBEN_B')};
  const ABGRUND_SILBEN_C = ${arrAus('ABGRUND_SILBEN_C')};
  const ABGRUND_GRIECHISCH = ${arrAus('ABGRUND_GRIECHISCH')};
  const ABGRUND_WAECHTER_NAMEN = ${arrAus('ABGRUND_WAECHTER_NAMEN')};
  const ABGRUND_BASIS_STAERKE = ${zahl('ABGRUND_BASIS_STAERKE')};
  const ABGRUND_STAERKE_MULT = ${zahl('ABGRUND_STAERKE_MULT')};
  const ABGRUND_MAX_FLUG_SEK = 4*3600;
  const ABGRUND_WAECHTER_ALLE = ${zahl('ABGRUND_WAECHTER_ALLE')};
  const ABGRUND_WAECHTER_STAERKE = ${zahl('ABGRUND_WAECHTER_STAERKE')};
  const ABGRUND_WAECHTER_SPLITTER = ${zahl('ABGRUND_WAECHTER_SPLITTER')};
  const ABGRUND_SUCHE_WEITE = ${zahl('ABGRUND_SUCHE_WEITE')};
  let abgrundSucheCache = { von:null, treffer:null };
  ${fnAus('abgrundRng')}
  ${fnAus('abgrundMutatorAnzahl')}
  ${fnAus('abgrundIstWaechter')}
  ${fnAus('abgrundWaechterDef')}
  ${fnAus('abgrundKonstellationFuer')}
  ${fnAus('abgrundKonstellationsEmblem')}
  ${fnAus('abgrundKonstellationsSuche')}
  ${fnAus('abgrundSektor')}
  ${fnAus('abgrundSektorMitBann')}
  return { ABGRUND_KONSTELLATIONEN, ABGRUND_MUTATOREN, ABGRUND_GRENZEN, ABGRUND_SUCHE_WEITE,
           abgrundSektor, abgrundSektorMitBann, abgrundKonstellationFuer,
           abgrundKonstellationsEmblem, abgrundKonstellationsSuche };
`)();

const K = G.ABGRUND_KONSTELLATIONEN;
const MUT_KEYS = new Set(G.ABGRUND_MUTATOREN.map(m => m.key));

// ---- 1) Die Daten selbst ----
check('1: es gibt Konstellationen und jede hat Schluessel, Namen, Farbe, Text und Wirkungstext',
  K.length >= 6 && K.every(k => k.key && k.name && k.farbe && k.text && k.wirkungText), { anzahl: K.length });
const unbekannt = K.flatMap(k => k.teile.filter(t => !MUT_KEYS.has(t)));
check('1: jeder Bestandteil ist ein echter Mutator', unbekannt.length === 0, unbekannt);
check('1: keine Konstellation nennt denselben Mutator zweimal',
  K.every(k => new Set(k.teile).size === k.teile.length));
// Mehr als drei ginge nie auf: ein Sektor traegt hoechstens drei Mutatoren.
check('1: keine Konstellation braucht mehr Teile, als ein Sektor tragen kann (3)',
  K.every(k => k.teile.length >= 2 && k.teile.length <= 3),
  K.filter(k => k.teile.length > 3).map(k => k.key));
check('1: jede Konstellation wirkt auf mindestens ein Feld, und nur auf bekannte Felder',
  K.every(k => Object.keys(k.wirkung||{}).length > 0
    && Object.keys(k.wirkung).every(f => G.ABGRUND_GRENZEN[f])),
  K.filter(k => !Object.keys(k.wirkung||{}).every(f => G.ABGRUND_GRENZEN[f])).map(k=>k.key));
// Zwei Konstellationen mit derselben Teilemenge waeren nicht unterscheidbar - eine gaebe es nie.
const mengen = K.map(k => k.teile.slice().sort().join('+'));
check('1: keine zwei Konstellationen haben dieselbe Teilemenge',
  new Set(mengen).size === mengen.length, mengen.filter((m,i) => mengen.indexOf(m) !== i));
// Ein Paar, das vollstaendig in einer Triade steckt, wuerde diese Triade unerreichbar machen -
// abgrundKonstellationFuer sucht zwar Triaden zuerst, aber die Reihenfolge im Array ist dann die
// einzige Absicherung. Diese Pruefung macht die Abhaengigkeit sichtbar, statt sie zu verstecken.
const triaden = K.filter(k => k.triade), paare = K.filter(k => !k.triade);
const verdeckt = triaden.filter(t => paare.some(p => p.teile.every(x => t.teile.includes(x))));
check('1: die Triaden werden vor den Paaren geprueft, verdeckte Triaden sind also erkannt',
  verdeckt.length === 0 || /k\.triade && k\.teile\.every/.test(fnAus('abgrundKonstellationFuer')),
  verdeckt.map(t => t.key));

// ---- 2) Haeufigkeit: gezaehlt, nicht geschaetzt ----
const N = 4000, START = 15;
const zaehl = {};
let mitKonst = 0;
for (let t = START; t < START + N; t++){
  const k = G.abgrundSektor(t).konstellation;
  if (k){ mitKonst++; zaehl[k.key] = (zaehl[k.key]||0) + 1; }
}
check('2: Konstellationen sind selten genug, dass sie auffallen (unter 15% der Sektoren)',
  mitKonst/N < 0.15, { anteil: +(mitKonst/N*100).toFixed(2)+'%', jederNte: Math.round(N/mitKonst) });
check('2: und haeufig genug, dass man sie ueberhaupt erlebt (ueber 2% der Sektoren)',
  mitKonst/N > 0.02, { anteil: +(mitKonst/N*100).toFixed(2)+'%' });
// Kein Paar darf TOT sein. Bei 1,1% erwartet man ueber 4000 Sektoren rund 44 Treffer; unter 5
// stimmt etwas nicht mit den Bestandteilen.
const totePaare = paare.filter(k => (zaehl[k.key]||0) < 5);
check('2: kein Paar ist toter Inhalt - jedes kommt in 4000 Sektoren mehrfach vor',
  totePaare.length === 0,
  paare.map(k => k.key+': '+(zaehl[k.key]||0)));
// Die Triaden MUESSEN deutlich seltener sein als die Paare - sonst waeren sie keine.
const seltensteSPaar = Math.min.apply(null, paare.map(k => zaehl[k.key]||0));
const haeufigsteTriade = Math.max.apply(null, triaden.map(k => zaehl[k.key]||0));
check('2: jede Triade ist seltener als das seltenste Paar',
  haeufigsteTriade < seltensteSPaar,
  { seltenstesPaar: seltensteSPaar, haeufigsteTriade, triaden: triaden.map(k => k.key+': '+(zaehl[k.key]||0)) });

// ---- 3) Wirkung: gedeckelt wie alles andere ----
// Der Sektor mit der staerksten Konstellation darf keine Kennzahl ausserhalb der Grenzen tragen.
const ausserhalb = [];
for (let t = START; t < START + N; t++){
  const s = G.abgrundSektor(t);
  if (!s.konstellation) continue;
  for (const f of Object.keys(G.ABGRUND_GRENZEN)){
    const [u,o] = G.ABGRUND_GRENZEN[f];
    if (s.mods[f] < u - 1e-9 || s.mods[f] > o + 1e-9) ausserhalb.push({ tiefe:t, feld:f, wert:s.mods[f] });
  }
}
check('3: keine Konstellation hebt einen Sektor ueber die Deckelung hinaus',
  ausserhalb.length === 0, ausserhalb.slice(0,4));
// Und sie muss WIRKEN: derselbe Mutatorensatz mit und ohne Konstellationsrechnung darf sich nicht
// gleichen. Gemessen an einem echten Fundort statt an einem gebauten Beispiel.
const fundort = (() => { for (let t = START; t < START+N; t++){ const s = G.abgrundSektor(t); if (s.konstellation && !s.waechter) return s; } })();
check('3: es gibt einen echten Fundort zum Messen', !!fundort, fundort && { tiefe:fundort.tiefe, konst:fundort.konstellation.key });
if (fundort){
  const ohne = { atk:1, def:1, loot:1, shards:1, dur:1, loss:1 };
  for (const m of fundort.mutatoren) for (const f of Object.keys(ohne)) if (typeof m[f] === 'number') ohne[f] *= m[f];
  for (const f of Object.keys(ohne)){
    const [u,o] = G.ABGRUND_GRENZEN[f];
    ohne[f] = Math.max(u, Math.min(o, ohne[f]));
  }
  const felder = Object.keys(fundort.konstellation.wirkung);
  const unveraendert = felder.filter(f => Math.abs(ohne[f] - fundort.mods[f]) < 1e-9);
  check('3: die Wirkung der Konstellation schlaegt sich wirklich in den Kennzahlen nieder',
    unveraendert.length === 0,
    { konst: fundort.konstellation.key, ohne, mit: fundort.mods, unveraendert });
}

// ---- 4) Der Bann loest die Konstellation auf ----
if (fundort){
  const teil = fundort.konstellation.teile[0];
  const nachBann = G.abgrundSektorMitBann(fundort, teil);
  check('4: ein Bann auf einen beteiligten Mutator loest die Konstellation auf',
    nachBann.konstellation === null,
    { gebannt: teil, danach: nachBann.konstellation && nachBann.konstellation.key });
  // Und die Kennzahlen muessen sich dabei WIRKLICH aendern - sonst waere die Aufloesung folgenlos
  // und die Anzeige loege.
  check('4: mit der Konstellation verschwindet auch ihre Wirkung aus den Kennzahlen',
    Object.keys(fundort.konstellation.wirkung).some(f => Math.abs(nachBann.mods[f] - fundort.mods[f]) > 1e-9),
    { vorher: fundort.mods, nachher: nachBann.mods });
  // Ein Bann auf einen UNBETEILIGTEN Mutator darf sie dagegen stehen lassen (falls es einen gibt).
  const fremd = fundort.mutatoren.map(m=>m.key).find(k => !fundort.konstellation.teile.includes(k));
  if (fremd){
    check('4: ein Bann auf einen unbeteiligten Mutator laesst die Konstellation stehen',
      (G.abgrundSektorMitBann(fundort, fremd).konstellation||{}).key === fundort.konstellation.key,
      { gebannt: fremd });
  }
}

// ---- 5) Der Sucher ----
const treffer = G.abgrundKonstellationsSuche(1);
check('5: der Sucher findet die Mehrzahl der Konstellationen in seiner Reichweite',
  Object.keys(treffer).length >= paare.length,
  { gefunden: Object.keys(treffer).length, von: K.length, weite: G.ABGRUND_SUCHE_WEITE });
// Jede gemeldete Tiefe muss stimmen - eine falsche Tiefe waere schlimmer als gar keine Auskunft.
const falsch = Object.entries(treffer).filter(([key, t]) => (G.abgrundSektor(t).konstellation||{}).key !== key);
check('5: jede gemeldete Fundstelle traegt die genannte Konstellation wirklich',
  falsch.length === 0, falsch.slice(0,3));
// Und es muss die ERSTE sein: eine spaetere zu melden, obwohl eine naehere existiert, waere ein
// stiller Fehler, den niemand bemerkt, weil die Auskunft ja "stimmt".
const nichtDieErste = Object.entries(treffer).filter(([key, t]) => {
  for (let x = 1; x < t; x++) if ((G.abgrundSektor(x).konstellation||{}).key === key) return true;
  return false;
});
check('5: gemeldet wird die naechstgelegene Fundstelle, nicht irgendeine',
  nichtDieErste.length === 0, nichtDieErste.slice(0,3));
check('5: zwei Aufrufe mit derselben Starttiefe liefern dasselbe (Zwischenspeicher verfaelscht nichts)',
  JSON.stringify(G.abgrundKonstellationsSuche(1)) === JSON.stringify(treffer));
// Der Zwischenspeicher darf nicht ueber die Starttiefe hinweg gelten - sonst zeigte die Box nach
// einem Tiefenwechsel die Fundstellen der alten Tiefe.
const treffer50 = G.abgrundKonstellationsSuche(50);
check('5: eine andere Starttiefe liefert eine andere Auskunft (der Cache klebt nicht)',
  JSON.stringify(treffer50) !== JSON.stringify(treffer),
  { ab1: treffer, ab50: treffer50 });
check('5: keine Fundstelle liegt vor der Starttiefe',
  Object.values(treffer50).every(t => t >= 50), treffer50);

// ---- 6) Das Emblem ----
const emblem = G.abgrundKonstellationsEmblem(K[0], 80);
check('6: das Emblem ist ein vollstaendiges <svg> in der gewuenschten Groesse',
  /^<svg /.test(emblem) && emblem.includes('width="80"') && emblem.includes('</svg>'));
check('6: es traegt die Farbe der Konstellation', emblem.includes('color:'+K[0].farbe));
// Kernpunkt: das Emblem besteht aus den SYMBOLEN der Teile, es gibt keine zweite Zeichnung.
const embleme = K.map(k => G.abgrundKonstellationsEmblem(k, 60));
check('6: jedes Emblem enthaelt so viele Symbolgruppen wie die Konstellation Teile hat',
  K.every((k,i) => (embleme[i].match(/<g transform="translate/g)||[]).length === k.teile.length),
  K.map((k,i) => k.key+': '+(embleme[i].match(/<g transform="translate/g)||[]).length+'/'+k.teile.length));
check('6: keine zwei Konstellationen haben dasselbe Emblem',
  new Set(embleme).size === embleme.length);
check('6: ohne Konstellation gibt es bewusst kein Ersatzbild',
  G.abgrundKonstellationsEmblem(null, 60) === '');
// Der Emblem-Bauer darf keine eigene Zeichnung mitbringen - sonst muesste ein neuer Mutator an
// zwei Stellen gezeichnet werden, und genau das war der Fehler vor v8.328.0.
check('6: das Emblem zeichnet nichts selbst, es holt aus ABGRUND_SYMBOLE',
  /ABGRUND_SYMBOLE\[/.test(fnAus('abgrundKonstellationsEmblem'))
    && !/ d="M\d/.test(fnAus('abgrundKonstellationsEmblem').replace(/figur/g,'')));

// ---- 7) Verdrahtung im Spiel ----
const boxQuelle = fnAus('renderAbgrundBox');
check('7: die Sektorkarte zeigt die Konstellation samt Wirkung',
  /sektor\.konstellation \?/.test(boxQuelle) && /wirkungText/.test(boxQuelle));
check('7: die Tiefensonde markiert Konstellationen in der Vorschau',
  /v\.konstellation\?/.test(boxQuelle));
check('7: es gibt ein eigenes Aufklappfeld mit Zustandserhalt',
  /data-keep-open="abgrundKonstellationen"/.test(boxQuelle));
// Der Sucher ist teuer. Laeuft er auch bei zugeklapptem Feld, zahlt jeder Pfeilklick dafuer.
check('7: der Sucher laeuft nur bei geoeffnetem Feld',
  /const konstOffen = openDetailKeys\.has\('abgrundKonstellationen'\)/.test(boxQuelle)
    && /konstOffen \? abgrundKonstellationsSuche\(tiefe\) : null/.test(boxQuelle));
check('7: erlebte Konstellationen werden im Spielstand mitgezaehlt',
  /a\.konstGesehen\[sektor\.konstellation\.key\]/.test(js));
// Gezaehlt werden muss der Sektor MIT Bann - ein aufgeloestes Sternbild hat man nicht erlebt.
const aufloesung = js.slice(js.indexOf("} else if (m.type === 'abgrund'){"));
check('7: gezaehlt wird der tatsaechlich gekaempfte Sektor, nicht der ungebannte',
  /const sektor = abgrundSektorMitBann/.test(aufloesung.slice(0, 1200)));
check('7: es gibt einen Erfolg fuer alle Konstellationen',
  /key:'abgrundkonst'/.test(js) && /ABGRUND_KONSTELLATIONEN\.every/.test(js));
// Regel 6: Die Hilfe muss dieselbe Zahl nennen wie das Array, sonst veraltet sie beim naechsten Zuwachs.
const hilfe = js.slice(js.indexOf("Konstellationen – wenn Mutatoren zusammengehören"));
const hilfeZahl = { 'neun':9, 'acht':8, 'zehn':10, 'elf':11, 'zwölf':12 };
const genannt = Object.keys(hilfeZahl).find(w => hilfe.slice(0,2500).includes('<strong>'+w+'</strong>'));
check('7: die Hilfe nennt dieselbe Anzahl Konstellationen wie das Array',
  !!genannt && hilfeZahl[genannt] === K.length, { hilfe: genannt, array: K.length });

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
