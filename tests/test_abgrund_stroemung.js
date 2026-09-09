// Abgrund-Paket B: DIE STRÖMUNG - dieselbe Tiefe trägt morgen einen anderen Sektor.
//
//   node tests/test_abgrund_stroemung.js
//
// DER BEFUND, aus dem das Paket kommt: Der Sektor hing ALLEIN an der Tiefe
// (`abgrundRng(t * 7919 + 104729)`). Tiefe 47 sah heute aus wie vor einem halben Jahr und wie in
// einem Jahr. Der vorhandene Inhalt - 24 Mutatoren, 9 Konstellationen, die Namensbausteine - stand
// damit fuer jede Tiefe fuer immer fest; wer eine Tiefe einmal gesehen hatte, hatte sie fuer alle
// Zeiten gesehen. Die Stroemung gibt dem Seed eine ZWEITE Achse, ohne eine einzige neue Tabelle.
//
// GEPRUEFT WIRD DIE REGEL, in beide Richtungen:
//   1a  INNERHALB einer Stroemung ist der Sektor unveraendert deterministisch - das ist die alte
//       Zusage, und sie darf nicht verlorengehen.
//   1b  ZWISCHEN zwei Stroemungen aendert er sich wirklich, und zwar nicht nur im Namen: ueber 60
//       Tiefen gemessen muss die Mehrheit einen anderen Mutatorensatz tragen. Eine Zeitkomponente,
//       die den Seed zwar anfasst, aber selten etwas veraendert, waere ein Feature auf dem Papier.
//   1c  Der Sektor traegt die Stroemung, aus der er stammt (`sektor.stroemung`) - ohne dieses Feld
//       koennte niemand nachsehen, welche gerade galt.
//   2a  DIE WAECHTER BLEIBEN, WO SIE SIND. Sie haengen an `abgrundWaechterDef(tiefe)`, also rein
//       an der Tiefe. Ueber vier Stroemungen und alle Zehnertiefen bis 100 muss derselbe Wächter
//       mit demselben Namen dastehen - sonst waenderten Reliquien, Kabinett und Kartenraum mit,
//       und ein Spieler verloere den Beleg fuer das, was er geschafft hat.
//   2b  Die Stroemung dreht sich an der LOKALEN Mitternacht und ist ueber einen Tag hinweg
//       konstant: derselbe Wert um 00:01 und um 23:59 desselben Tages, ein anderer am Folgetag.
//       Gemessen an gestellten Zeitstempeln, nicht an der Wanduhr.
//   3a  EINGEFROREN AM MISSIONSSTART. Die Vorschau rechnet beim Start, die Aufloesung beim
//       Ankommen - ohne Einfrieren koennte ein Tauchgang unter der einen Stroemung starten und
//       unter der naechsten ankommen, und die Vorschau haette gelogen. Gemessen am Quelltext:
//       `sendeAbgrundMission` legt die Zahl in die Mission, die Aufloesung liest `m.stroemung`.
//   4a  DER SUCHCACHE HAENGT AN DER STROEMUNG (Durchsicht an PR #615). `abgrundKonstellationsSuche`
//       speicherte seine Fundstellen allein nach Starttiefe zwischen - richtig, solange sie fuer
//       immer feststanden. Wer das Spiel ueber Mitternacht offen laesst, bekaeme sonst die
//       Fundstellen von GESTERN genannt und startete einen Tauchgang auf eine Konstellation, die
//       dort nicht mehr liegt.
//   4b  DER KARTENRAUM ZEIGT DEN SEKTOR DES KAMPFES (Durchsicht an PR #615, zweite Runde). Er ist
//       ausdruecklich die Geschichte des Kontos; ohne die damalige Stroemung schriebe sich jeder
//       Stationsname jede Mitternacht um - genau die Zusage, die dieses Paket gibt. Der erste
//       Versuch rechnete sie aus dem EroberungsTAG zurueck; dieser Weg ist hier ausdruecklich
//       ausgeschlossen, denn er ist fuer jeden bestehenden Eintrag falsch (die alten Sektoren
//       hatten gar keinen Datumsanteil) und fuer einen neuen Sieg ueber Mitternacht ebenfalls
//       (gekaempft wird unter der Stroemung des Aufbruchs, gespeichert der Tag der Ankunft).
//   5a  DIE STROEMUNG 0 IST DER SEED VON VORHER, gemessen und nicht behauptet: `abgrundRng` muss
//       fuer `t*7919+104729` und fuer `t*7919+104729+0*15485863` dieselbe Folge liefern. Nur
//       deshalb darf ein Vorgang „aus der Zeit davor" auf sie zurueckfallen, statt die heutige zu
//       nehmen. Dazu die Rueckfallregel selbst: fehlt/keine Zahl -> 0, echte Zahl -> unveraendert.
//   5b  UND DIE BEIDEN STELLEN NUTZEN SIE. Die Aufloesung eines Tauchgangs, der schon vor diesem
//       Paket unterwegs war (P1 der Durchsicht: sonst aendern sich Verteidigung, Mutatoren,
//       Beute und Verluste mitten im Flug), und der Kartenraum ueber die am Sieg festgehaltene
//       Zahl - die auch den Aufstieg ueberlebt, wie `waechterTage` daneben.
//   3b  Und die Anzeige sagt es. Eine Mechanik, von der der Spieler nichts weiss, ist keine - er
//       saehe nur, dass „seine" Tiefe ploetzlich anders aussieht, und hielte es fuer einen Fehler.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor dem Paket, Aufruf mit
// KEPLER_STROEMUNG_GEGENPROBE=alt. Dort fallen 1b, 1c, 2b, 3a, 3b, 4a, 4b, 5a und 5b - die
// Stroemung gibt es nicht. 1a und 2a bleiben gruen: Sie halten fest, was das Paket NICHT anfassen
// darf, und sind damit keine Belege fuer die Stroemung, sondern die Waechter ueber ihre Auflagen.
// Mit =cache laeuft dieselbe Datei gegen den Stand vor der ERSTEN Durchsichts-Behebung (dort
// fallen 3a, 4a, 4b, 5a, 5b), mit =durchsicht2 gegen den vor der ZWEITEN (3a, 4b, 5a, 5b).
const fs = require('fs');
const { SPIELDATEI } = require('./lib/spieldatei');
const src = fs.readFileSync(process.env.KEPLER_SPIELDATEI || SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];
// v8.714.0: abgrundWaechterDef liest die Regeltabelle - sie gehoert mit in den Kontext, sonst
// stuerzt der Aufbau mit ReferenceError ab statt eine Pruefung zu melden.
function regelQuelleAus(){
  const i = js.indexOf('const ABGRUND_WAECHTER_REGELN = [');
  if (i < 0) return '';
  let d=0, a=js.indexOf('[', i), k=a;
  for(;k<js.length;k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(i, k+1)+';\n'+fnAus('abgrundRegelDef');
}

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };
const SAB = process.env.KEPLER_STROEMUNG_GEGENPROBE || '';
/* Alle drei Listen sind GEMESSEN, nicht gedacht - und die Pruefung unten belegt beide Richtungen:
   dass jede genannte faellt UND dass keine ungenannte mitfaellt. Der erste Entwurf tippte sie und
   vergass `3a` bei zwei Staenden: Diese Pruefung hat in diesem Auftrag ihren Anker mitverschaerft
   (sie liest die Aufloesung jetzt durch `abgrundStroemungVonFrueher` hindurch) und misst damit
   denselben P1-Befund wie `5b`. */
const MUSS_FALLEN = {
  alt:   ['1b', '1c', '2b', '3a', '3b', '4a', '4b', '5a', '5b'],
  cache: ['3a', '4a', '4b', '5a', '5b'],
  // Der Stand, den die zweite Durchsicht gesehen hat: Suchcache schon behoben, aber der
  // Kartenraum rechnete noch aus dem Tag zurueck und ein Tauchgang von vorher bekam die
  // heutige Stroemung.
  durchsicht2: ['3a', '4b', '5a', '5b']
};

/* Dieselben Ausschneider wie test_abgrund.js. Sie stehen hier bewusst noch einmal statt in einer
   gemeinsamen Datei: Beide Tests schneiden die Spieldatei fuer ihren EIGENEN Zweck zurecht, und
   eine geteilte Fassung muesste beide Zwecke bedienen - genau die Sorte Kopplung, die beim
   naechsten Umbau den anderen Test mitreisst. */
function block(name){
  const i = js.indexOf('const '+name+' = [');
  if (i < 0) return null;
  let d=0, s=js.indexOf('[', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}
function konstAus(name){
  const m = js.match(new RegExp('^\\s*const '+name+' = .*$', 'm'));
  if (!m) throw new Error('Konstante nicht gefunden: '+name);
  return m[0].trim();
}
function fnAus(name, pflicht){
  const i = js.indexOf('function '+name+'(');
  if (i < 0){
    if (pflicht === false) return '';
    throw new Error('Funktion nicht gefunden: '+name);
  }
  let d=0, s=js.indexOf('{', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}

/* Am ALTEN Stand gibt es `abgrundStroemung` nicht. Der Kontext bekommt dann eine Attrappe, die
   IMMER 0 liefert - damit laeuft der Aufbau durch und die Pruefungen messen, was wirklich fehlt,
   statt am Aufbau zu sterben. Ein Test, der in der Gegenprobe abstuerzt, belegt nichts. */
const hatStroemung = js.indexOf('function abgrundStroemung(') >= 0;
const stroemungQuelle = hatStroemung ? fnAus('abgrundStroemung') : 'function abgrundStroemung(){ return 0; }';
/* Dieselbe Ueberlegung fuer den Rueckfall auf die Rechnung von vorher: Am alten Stand gibt es ihn
   nicht. Die Attrappe liefert `null` statt `0` - damit laeuft der Aufbau durch, und 5a faellt aus
   dem RICHTIGEN Grund (der Rueckfall fehlt), statt zufaellig gruen zu werden, weil `null * x`
   ebenfalls 0 ergibt. */
const hatVonFrueher = js.indexOf('function abgrundStroemungVonFrueher(') >= 0;
const vonFrueherQuelle = hatVonFrueher
  ? konstAus('ABGRUND_STROEMUNG_ALT') + '\n' + fnAus('abgrundStroemungVonFrueher')
  : 'const ABGRUND_STROEMUNG_ALT = null;\nfunction abgrundStroemungVonFrueher(){ return null; }';

function baueKontext(){
  const quelle = [
    konstAus('ABGRUND_SILBEN_A'), konstAus('ABGRUND_SILBEN_B'), konstAus('ABGRUND_SILBEN_C'),
    konstAus('ABGRUND_GRIECHISCH'),
    'const ABGRUND_MUTATOREN = '+block('ABGRUND_MUTATOREN')+';',
    'const ABGRUND_KONSTELLATIONEN = '+block('ABGRUND_KONSTELLATIONEN')+';',
    fnAus('abgrundKonstellationFuer'),
    js.match(/^\s*const ABGRUND_GRENZEN = \{[\s\S]*?\};/m)[0].trim(),
    konstAus('ABGRUND_BASIS_STAERKE'), konstAus('ABGRUND_STAERKE_MULT'),
    konstAus('ABGRUND_WAECHTER_ALLE'), konstAus('ABGRUND_WAECHTER_STAERKE'),
    konstAus('ABGRUND_WAECHTER_SPLITTER'), konstAus('ABGRUND_WAECHTER_BERGUNG'),
    'const ABGRUND_WAECHTER_NAMEN = '+block('ABGRUND_WAECHTER_NAMEN')+';',
    stroemungQuelle, vonFrueherQuelle,
    fnAus('abgrundRng'), fnAus('abgrundMutatorAnzahl'),
    fnAus('abgrundBergungsgut'), fnAus('abgrundIstWaechter'), fnAus('abgrundRufAktiv'),
    // ensureAbgrund liest seit v8.712.0 ABGRUND_PLAN_MAX (Deckel des Tauchplans).
    konstAus('ABGRUND_PLAN_MAX'),
    regelQuelleAus(), fnAus('abgrundWaechterDef'), fnAus('ensureAbgrund'), fnAus('abgrundSektor'),
    'return { abgrundSektor, abgrundStroemung, abgrundWaechterDef, abgrundRng,'
      + ' abgrundStroemungVonFrueher, ABGRUND_STROEMUNG_ALT };'
  ].join('\n');
  const state = { research:{}, abgrund:null };
  return new Function('state', quelle)(state);
}

const G = baueKontext();

// ---- 1) Die Regel ----------------------------------------------------------------------------
const A = G.abgrundSektor(47, undefined, 20000);
const B = G.abgrundSektor(47, undefined, 20000);
merke('1a: innerhalb EINER Stroemung ist der Sektor unveraendert deterministisch',
  A.name === B.name && A.defense === B.defense
    && A.mutatoren.map(m=>m.key).join() === B.mutatoren.map(m=>m.key).join(),
  { name: A.name, verteidigung: A.defense });

/* 1b misst ueber 60 Tiefen, nicht ueber eine: Ein einzelner Sektor koennte zufaellig denselben
   Mutatorensatz behalten, und die Pruefung waere dann aus dem falschen Grund rot. Verlangt wird
   die Mehrheit - gemessen liegt sie weit darueber. */
let andereMutatoren = 0, andereNamen = 0;
for (let t = 1; t <= 60; t++){
  const heute = G.abgrundSektor(t, undefined, 20000);
  const morgen = G.abgrundSektor(t, undefined, 20001);
  if (heute.mutatoren.map(m=>m.key).join() !== morgen.mutatoren.map(m=>m.key).join()) andereMutatoren++;
  if (heute.name !== morgen.name) andereNamen++;
}
merke('1b: zwischen zwei Stroemungen aendern sich Namen UND Mutatoren',
  andereNamen >= 58 && andereMutatoren >= 31,
  { andereNamen, andereMutatoren, von: 60 });

merke('1c: der Sektor traegt die Stroemung, aus der er stammt',
  A.stroemung === 20000 && G.abgrundSektor(9, undefined, 4711).stroemung === 4711,
  { stroemung: A.stroemung });

// ---- 2) Die Auflagen -------------------------------------------------------------------------
/* 2a: Die Waechter sind der Beleg fuer das, was ein Spieler geschafft hat - Reliquien, Kabinett,
   Kartenraum haengen an ihnen. Wanderten sie mit der Stroemung, waere ein Kabinett von gestern
   heute falsch beschriftet. Gemessen ueber vier Stroemungen und alle Zehnertiefen bis 100. */
const waechterAbweichungen = [];
for (let t = 10; t <= 100; t += 10){
  const namen = [20000, 20001, 20050, 21000].map(str => {
    const s = G.abgrundSektor(t, true, str);
    return s.waechter ? s.waechter.name : null;
  });
  if (new Set(namen).size !== 1) waechterAbweichungen.push({ tiefe: t, namen });
}
merke('2a: die Waechter bleiben, wo sie sind - die Stroemung bewegt sie nicht',
  waechterAbweichungen.length === 0,
  { geprueft: 10, abweichungen: waechterAbweichungen.slice(0, 2) });

/* 2b: Gemessen an GESTELLTEN Zeitstempeln, nicht an der Wanduhr - sonst prueft der Test, wann er
   zufaellig laeuft. Drei Punkte desselben lokalen Tages und einer vom Folgetag. */
const tagA = new Date(2026, 8, 9, 0, 1, 0).getTime();
const tagAmittag = new Date(2026, 8, 9, 12, 0, 0).getTime();
const tagAspaet = new Date(2026, 8, 9, 23, 59, 0).getTime();
const tagB = new Date(2026, 8, 10, 0, 1, 0).getTime();
merke('2b: die Stroemung dreht an der lokalen Mitternacht, nicht mittendrin',
  hatStroemung
    && G.abgrundStroemung(tagA) === G.abgrundStroemung(tagAmittag)
    && G.abgrundStroemung(tagAmittag) === G.abgrundStroemung(tagAspaet)
    && G.abgrundStroemung(tagB) === G.abgrundStroemung(tagA) + 1,
  { frueh: G.abgrundStroemung(tagA), spaet: G.abgrundStroemung(tagAspaet), folgetag: G.abgrundStroemung(tagB) });

// ---- 3) Eingefroren und sichtbar --------------------------------------------------------------
/* 3a wird am QUELLTEXT gemessen, weil kein Testlauf eine echte Mitternacht abwarten kann. Beide
   Anker werden vorher auf Existenz geprueft - ein fehlender Anker liefert `-1`, und ein Vergleich
   zweier `-1` waere aus dem falschen Grund gruen. */
const vonSend = js.indexOf('function sendeAbgrundMission(');
const bisSend = vonSend >= 0 ? js.indexOf('playSound(', vonSend) : -1;
const sendRumpf = (vonSend >= 0 && bisSend > vonSend) ? js.slice(vonSend, bisSend) : '';
const legtAb = /const stroemung = abgrundStroemung\(\);/.test(sendRumpf)
  && /abgrundSektor\(tiefe, undefined, stroemung\)/.test(sendRumpf)
  && /\bstroemung,/.test(sendRumpf);
/* Der Waechterruf steht seit v8.712.0 hinter `erster ?` - er gilt nur fuer den ERSTEN Sektor eines
   Tauchplans. Gemessen wird deshalb, dass die Stroemung ueber `abgrundStroemungVonFrueher` aus der
   MISSION kommt, egal wie das Ruf-Argument davor aussieht; das ist die Aussage dieser Pruefung. */
const liestAus = /abgrundSektor\(tiefe, [^,]+, abgrundStroemungVonFrueher\(m\.stroemung\)\)/.test(js);
merke('3a: die Mission legt die Stroemung ab, die Aufloesung liest sie von dort',
  sendRumpf.length > 0 && legtAb && liestAus,
  { rumpfDa: sendRumpf.length > 0, legtAb, liestAus });

merke('3b: die Anzeige nennt die Stroemung, ihre Restzeit und das Einfrieren',
  /Die Strömung dreht \$\{stroemungRestText\}/.test(js)
    && /abgrundStroemungWechsel\(\) - Date\.now\(\)/.test(js)
    && /behält seinen/.test(js)
    && /Die Strömung – warum dieselbe Tiefe morgen anders aussieht/.test(js),
  { restzeit: /abgrundStroemungWechsel/.test(js), hilfe: /Die Strömung – warum/.test(js) });

// ---- 4) Die zweiten Anzeigestellen -----------------------------------------------------------
/* Beide am QUELLTEXT gemessen: Der Suchcache lebt in einer Modulvariablen, die kein Testkontext
   ueber eine echte Mitternacht hinweg beobachten kann, und der Kartenraum haengt an einem
   Spielstand mit Eroberungstagen. Die Anker werden vorher auf Existenz geprueft. */
const vonSuche = js.indexOf('function abgrundKonstellationsSuche(');
const bisSuche = vonSuche >= 0 ? js.indexOf('function ', vonSuche + 10) : -1;
const sucheRumpf = (vonSuche >= 0 && bisSuche > vonSuche) ? js.slice(vonSuche, bisSuche) : '';
merke('4a: der Suchcache haengt an Starttiefe UND Stroemung',
  sucheRumpf.length > 0
    && /abgrundSucheCache\.stroemung === str/.test(sucheRumpf)
    && /abgrundSektor\(t, undefined, str\)/.test(sucheRumpf)
    && /abgrundSucheCache = \{ von, stroemung: str, treffer \}/.test(sucheRumpf),
  { rumpfDa: sucheRumpf.length > 0 });

/* Der Anker beginnt bei den Deklarationen, nicht erst bei der Schleife: `waechterStrom` steht
   eine Zeile darueber, und ein Test, der sie in der GANZEN Datei sucht, bliebe gruen, wenn sie
   in eine andere Funktion wandert - waehrend renderAbgrundBox mit einem ReferenceError abbricht. */
const vonRaum = js.indexOf('const waechterTage = a.waechterTage || {};');
const bisRaum = vonRaum >= 0 ? js.indexOf('}).join(\'\');', vonRaum) : -1;
const raumRumpf = (vonRaum >= 0 && bisRaum > vonRaum) ? js.slice(vonRaum, bisRaum) : '';
merke('4b: der Kartenraum zeigt den Sektor des Kampfes, nicht den von heute',
  raumRumpf.length > 0
    && /const waechterStrom = a\.waechterStrom \|\| \{\};/.test(raumRumpf)
    && /abgrundSektor\(t, undefined, geschafft \? abgrundStroemungVonFrueher\(waechterStrom\[t\]\) : undefined\)/.test(raumRumpf)
    // Der Rueckrechenweg ueber den Tag ist ausdruecklich AUSGESCHLOSSEN, nicht nur ungenutzt:
    // Er war fuer jeden bestehenden Eintrag falsch, und ein spaeterer Umbau darf ihn nicht
    // versehentlich wieder einfuehren.
    && !/abgrundStroemungAmTag/.test(js),
  { rumpfDa: raumRumpf.length > 0, rueckrechnerWeg: !/abgrundStroemungAmTag/.test(js) });

// ---- 5) Was schon lief und was schon geschafft ist -------------------------------------------
/* 5a ist der einzige Beleg dafuer, dass der Rueckfall UEBERHAUPT erlaubt ist: Waere die Stroemung
   0 irgendetwas anderes als der Seed von vorher, wuerde jeder Rueckfall den Sektor genauso
   veraendern wie die heutige Stroemung - nur unauffaelliger.
   DIE SEED-FORMEL WIRD GELESEN, NICHT GETIPPT. Der erste Entwurf rechnete
   `abgrundRng(47*7919 + 104729 + ABGRUND_STROEMUNG_ALT * 15485863)` gegen
   `abgrundRng(47*7919 + 104729)` - das sind bei einer Konstante 0 buchstaeblich dieselben
   Zeichen, und der Nachbarterm prueft die 0 ohnehin. Die Pruefung konnte nur rot werden, wenn
   die Konstante nicht 0 ist, und haette einen Umbau auf etwa `(str+1) * 15485863` glatt
   durchgelassen (eigene Durchsicht an PR #615). Jetzt kommt der Ausdruck aus dem Quelltext von
   `abgrundSektor`; abgetippt ist nur noch die ALTE Formel, und die ist Geschichte und aendert
   sich nicht mehr. */
const seedAusdruck = (fnAus('abgrundSektor').match(/const rng = abgrundRng\(([^;]*)\);/) || [])[1] || '';
let seedBeiNull = null, seedBeiStrom = null;
if (seedAusdruck){
  try {
    const seedFn = new Function('t', 'str', 'return (' + seedAusdruck + ');');
    seedBeiNull = seedFn(47, 0); seedBeiStrom = seedFn(47, 20706);
  } catch(e){}
}
merke('5a: die Stroemung von frueher IST der Seed von vorher, und Fehlendes faellt auf sie zurueck',
  !!seedAusdruck
    && seedBeiNull === 47 * 7919 + 104729      // bei Stroemung 0 bleibt die Rechnung von vorher
    && seedBeiStrom !== seedBeiNull            // und eine echte Stroemung bewegt den Seed wirklich
    && G.ABGRUND_STROEMUNG_ALT === 0
    && G.abgrundStroemungVonFrueher(undefined) === 0
    && G.abgrundStroemungVonFrueher(null) === 0
    && G.abgrundStroemungVonFrueher(NaN) === 0
    && G.abgrundStroemungVonFrueher('20706') === 0
    && G.abgrundStroemungVonFrueher(20706) === 20706,
  { ausdruck: seedAusdruck, beiNull: seedBeiNull, altFormel: 47 * 7919 + 104729,
    beiStrom: seedBeiStrom, alt: G.ABGRUND_STROEMUNG_ALT });

merke('5b: Tauchgang und Station von vorher nehmen sie - und der Aufstieg traegt sie mit',
  /abgrundSektor\(tiefe, [^,]+, abgrundStroemungVonFrueher\(m\.stroemung\)\)/.test(js)
    && /function merkeWaechterSieg\(tiefe, stroemung\)/.test(js)
    && /merkeWaechterSieg\(tiefe, sektor\.stroemung\)/.test(js)
    // Die Schreibstelle setzt BEIDE Felder zusammen; ein Zweig, der nur den Tag setzt, waere ein
    // Kartenraum, der fuer eine frische Eroberung den alten Sektor behauptet.
    && /a\.waechterStrom\[tiefe\] = \(typeof stroemung === 'number' && isFinite\(stroemung\)\)/.test(js)
    && /\? stroemung : abgrundStroemung\(\);/.test(js)
    && /waechterStrom: a\.waechterStrom\|\|\{\}/.test(js),
  { aufloesung: /abgrundStroemungVonFrueher\(m\.stroemung\)/.test(js),
    aufstieg: /waechterStrom: a\.waechterStrom\|\|\{\}/.test(js) });

/* Die Gegenprobe prueft BEIDE Richtungen. Der erste Entwurf filterte nur `soll` und belegte
   damit, dass die genannten Pruefungen fallen - nie, dass NUR die genannten fallen. Gemessen
   (eigene Durchsicht an PR #615): `3a` fiel an zwei Staenden mit, ohne in der Liste zu stehen,
   weil dieser Auftrag ihren Anker mitverschaerft hat. Wer die Gegenprobe beim naechsten Umbau
   faehrt, haelt so ein zusaetzliches Rot fuer erwartet und uebersieht eine echte Regression.
   Genau davor warnt die Hausregel („Pruefnamen beider Laeufe vergleichen, nicht zaehlen"). */
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
