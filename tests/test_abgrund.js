// Der Abgrund (27.07.2026, v8.320.0).
//
// Ausgangsbefund, am Code gemessen: alles Entdeckbare im Spiel ist eine FESTE LISTE.
//   85 Erfolge, 60 Zufallsereignisse, 7 Kodex-Stufen, 47 Forschungszweige, 3 Mega-Projekte.
// Nach Monaten sind diese Listen durch. v8.319.0 hat den Fortschritt endlos gemacht - aber eine
// hoehere Stufe ist kein neuer Inhalt. Der Abgrund erzeugt stattdessen endlos neue, BENANNTE Orte.
//
// Wie test_endlos.js schneidet dieser Test die ECHTEN Funktionen aus der Spieldatei und fuehrt sie
// aus, statt die Kurven nachzubauen. Die Rot-Probe an test_endlos.js hatte gezeigt, dass ein Test
// mit nachgebauten Formeln nichts prueft: er misst dann nur seine eigene Kopie.
//
// Geprueft wird:
//   1) Determinismus: dieselbe Tiefe ergibt denselben Sektor, verschiedene Tiefen verschiedene
//   2) Mutatoren: vollstaendig beschrieben, gemischt gut/schlecht, Wirkung gedeckelt
//   3) Endlosigkeit: keine Maximaltiefe, Schwierigkeit waechst, Belohnung waechst NICHT explosiv
//   4) Werkstatt: Preise steigen, Wirkung ist gedeckelt, Boni wirken nur im Abgrund
//   5) Tiefenbonus: logarithmisch, also endlos ohne Explosion
//   6) Wiederholte Tiefen lohnen weniger als der naechste Schritt nach unten
//   7) Verdrahtung: Missionstyp ueberall dort, wo die anderen Angriffstypen stehen
//   8) Backend-Vertraeglichkeit und CLAUDE.md-Regeln (Icons, Beschreibungen, DOM-Zustand)
//   9) Bestenlisten-Verdrahtung: veroeffentlicht, unverrauscht, angezeigt, ranglistet
//  10) Wochenlauf, Tiefensonde, Allianz-Tiefenlauf (v8.322.0)
//  11) Waechter-Tiefen, Mutator-Gegenmassnahmen, Abgrund-Titel (v8.323.0)
//  12) Auffindbarkeit der Werkstatt und laute Fehlermeldung (v8.324.0)
//  13) Grafik: Sektor-Siegel je Tiefe und Tiefenprofil (v8.326.0)
const fs = require('fs');
const path = require('path');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail = false;
const check = (n, c, x) => { console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail = fail || !c; };

function block(name){
  const i = js.indexOf('const '+name+' = [');
  if (i < 0) return null;
  let d=0, s=js.indexOf('[', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}
function objBlock(name){
  const i = js.indexOf('const '+name+' = {');
  if (i < 0) throw new Error('Objekt nicht gefunden: '+name);
  let d=0, s=js.indexOf('{', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}
function fnAus(name){
  const i = js.indexOf('function '+name+'(');
  if (i < 0) throw new Error('Funktion nicht gefunden: '+name);
  let d=0, s=js.indexOf('{', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}
// Die Konstantenzeilen ebenfalls aus der Datei ziehen, nicht abschreiben - sonst veraltet der Test
// beim naechsten Balance-Pass still.
function konstAus(name){
  const re = new RegExp('^\\s*const '+name+' = .*$', 'm');
  const m = js.match(re);
  if (!m) throw new Error('Konstante nicht gefunden: '+name);
  return m[0].trim();
}
function baueKontext(zustand){
  const quelle = [
    konstAus('ABGRUND_SILBEN_A'), konstAus('ABGRUND_SILBEN_B'), konstAus('ABGRUND_SILBEN_C'),
    konstAus('ABGRUND_GRIECHISCH'),
    block('ABGRUND_MUTATOREN') ? 'const ABGRUND_MUTATOREN = '+block('ABGRUND_MUTATOREN')+';' : (()=>{throw new Error('ABGRUND_MUTATOREN fehlt')})(),
    // Seit v8.329.0 ruft abgrundSektor() die Konstellationen auf - ohne sie wirft der Kontext beim
    // ersten Sektor. Beides gehoert deshalb mit in die Umgebung, aus der Datei gezogen wie alles
    // andere hier.
    'const ABGRUND_KONSTELLATIONEN = '+block('ABGRUND_KONSTELLATIONEN')+';',
    fnAus('abgrundKonstellationFuer'),
    // ABGRUND_SONDE_MAX zuerst: das Werkstatt-Array referenziert die Konstante in seinem
    // Literal, eine spaetere Deklaration liefe in die temporale Todeszone.
    konstAus('ABGRUND_SONDE_MAX'),
    block('ABGRUND_WERKSTATT') ? 'const ABGRUND_WERKSTATT = '+block('ABGRUND_WERKSTATT')+';' : (()=>{throw new Error('ABGRUND_WERKSTATT fehlt')})(),
    block('ABGRUND_CHRONIK') ? 'const ABGRUND_CHRONIK = '+block('ABGRUND_CHRONIK')+';' : (()=>{throw new Error('ABGRUND_CHRONIK fehlt')})(),
    js.match(/^\s*const ABGRUND_GRENZEN = \{[\s\S]*?\};/m)[0].trim(),
    konstAus('ABGRUND_BASIS_STAERKE'), konstAus('ABGRUND_STAERKE_MULT'),
    konstAus('ABGRUND_MAX_FLUG_SEK'), konstAus('ABGRUND_WIEDERHOLUNG'),
    konstAus('ABGRUND_REQ_RESEARCH'),
    fnAus('abgrundRng'), fnAus('abgrundSektor'), fnAus('abgrundMutatorAnzahl'),
    fnAus('ensureAbgrund'), fnAus('abgrundMaxTiefe'), fnAus('abgrundGewaehlteTiefe'),
    fnAus('abgrundWiederholungsFaktor'), fnAus('abgrundWerkstattStufe'),
    fnAus('abgrundWerkstattKosten'), fnAus('abgrundWerkstattBonus'),
    fnAus('abgrundTiefenBonus'), fnAus('abgrundChronikOffen'), fnAus('abgrundFreigeschaltet'),
    fnAus('abgrundKampfkraft'),
    konstAus('ABGRUND_WOCHE_FAKTOR'),
    block('ABGRUND_ALLIANZ_MARKEN') ? 'const ABGRUND_ALLIANZ_MARKEN = '+block('ABGRUND_ALLIANZ_MARKEN')+';' : (()=>{throw new Error('ABGRUND_ALLIANZ_MARKEN fehlt')})(),
    fnAus('weekKeyOf'), fnAus('abgrundWochenpflege'), fnAus('abgrundWochenPraemieSplitter'),
    konstAus('ABGRUND_STILLGAENGER_MAX'), 'const shipModuleBonusFor = () => 0;',
    // Tiefenflotte (v8.337.0): die Sondenreichweite und die Anflugdauer fragen sie jetzt mit.
    // Hier ohne Tiefenschiffe, damit dieser Test weiterhin die Grundwerte misst.
    'const currentFleet = () => ({});', 'const TIEFENSCHIFF_WIRKUNG = {};',
    // Navigator-Ausweitung (v8.342.0): abgrundAnflugdauer liest jetzt officerBonus('navigator').
    // Hier ohne Offizier (0), damit dieser Test weiterhin die Grundwerte misst - der Navigator hat
    // seinen eigenen Nachweis in test_tiefenflotte.js und test_abgrundbezug.js.
    'const officerBonus = () => 0;',
    fnAus('tiefenschiffBonus'), fnAus('lotsenbootSicht'), fnAus('abgrundAnflugdauer'), fnAus('abgrundSondeReichweite'),
    konstAus('ABGRUND_WAECHTER_ALLE'), konstAus('ABGRUND_WAECHTER_STAERKE'),
    konstAus('ABGRUND_WAECHTER_SPLITTER'), konstAus('ABGRUND_WAECHTER_BERGUNG'), konstAus('ABGRUND_GEGEN_KOSTEN'),
    fnAus('abgrundBergungsgut'),
    block('ABGRUND_WAECHTER_NAMEN') ? 'const ABGRUND_WAECHTER_NAMEN = '+block('ABGRUND_WAECHTER_NAMEN')+';' : (()=>{throw new Error('ABGRUND_WAECHTER_NAMEN fehlt')})(),
    fnAus('abgrundIstWaechter'), fnAus('abgrundRufAktiv'), fnAus('abgrundWaechterDef'), fnAus('abgrundSektorMitBann'),
    'return { abgrundSektor, abgrundMutatorAnzahl, ensureAbgrund, abgrundMaxTiefe, abgrundGewaehlteTiefe,',
    '  abgrundWiederholungsFaktor, abgrundWerkstattStufe, abgrundWerkstattKosten, abgrundWerkstattBonus,',
    '  abgrundTiefenBonus, abgrundChronikOffen, abgrundFreigeschaltet, abgrundKampfkraft,',
    '  ABGRUND_MUTATOREN, ABGRUND_WERKSTATT, ABGRUND_CHRONIK, ABGRUND_WIEDERHOLUNG,',
    '  weekKeyOf, abgrundWochenpflege, abgrundWochenPraemieSplitter, abgrundSondeReichweite,',
    '  ABGRUND_ALLIANZ_MARKEN, ABGRUND_WOCHE_FAKTOR, ABGRUND_SONDE_MAX,',
    '  abgrundIstWaechter, abgrundWaechterDef, abgrundSektorMitBann,',
    '  ABGRUND_WAECHTER_ALLE, ABGRUND_WAECHTER_STAERKE, ABGRUND_WAECHTER_SPLITTER,',
    '  ABGRUND_WAECHTER_BERGUNG, abgrundBergungsgut,',
    '  ABGRUND_WAECHTER_NAMEN, ABGRUND_GEGEN_KOSTEN };'
  ].join('\n');
  return new Function('state', quelle)(zustand);
}
// Diese Pruefung steht BEWUSST vor dem Ausfuehren: Sie liest nur den Quelltext und muss deshalb
// auch dann noch eine lesbare Zeile liefern, wenn abgrundSektor gar nicht mehr laufen kann. Die
// Rot-Probe "Beute aus der eigenen Produktion" liess den Test sonst mit einem nackten
// ReferenceError sterben - fehlgeschlagen war er zwar, aber er sagte nicht, woran es lag.
const sektorQuelle = fnAus('abgrundSektor');
check('3: die Beute haengt NICHT an der eigenen Produktion ("N Minuten Produktion"-Falle)',
  !/ratesPerSecond|prodMin/.test(sektorQuelle));

const neuerZustand = () => ({ research:{}, abgrund:null });
let G;
try { G = baueKontext(neuerZustand()); }
catch(e){ check('0: die echten Funktionen liessen sich aus der Spieldatei laden', false, String(e.message)); console.log('\nFAIL'); process.exit(1); }
// Nicht-Leerheits-Wache: schlaegt der Aufbau still fehl, sind alle folgenden Pruefungen wertlos.
check('0: die echten Funktionen wurden aus der Spieldatei geladen',
  typeof G.abgrundSektor === 'function' && G.abgrundSektor(1) && typeof G.abgrundSektor(1).defense === 'number',
  { tiefe1Staerke: G.abgrundSektor(1).defense });

// ---- 1) Determinismus ----
const s7a = G.abgrundSektor(7), s7b = G.abgrundSektor(7);
check('1: dieselbe Tiefe ergibt exakt denselben Sektor',
  s7a.name === s7b.name && s7a.defense === s7b.defense &&
  s7a.mutatoren.map(m=>m.key).join() === s7b.mutatoren.map(m=>m.key).join(), { name:s7a.name });
// Ein frisch gebauter Kontext (anderes state-Objekt) muss dasselbe liefern - sonst haengt der
// Sektor doch am Spielstand und waere nicht spieleruebergreifend vergleichbar.
const G2 = baueKontext(neuerZustand());
check('1: der Sektor haengt NICHT am Spielstand (anderer Kontext, gleiches Ergebnis)',
  G2.abgrundSektor(47).name === G.abgrundSektor(47).name, { name:G.abgrundSektor(47).name });
const namen = new Set();
for (let t=1; t<=300; t++) namen.add(G.abgrundSektor(t).name);
check('1: 300 Tiefen ergeben (nahezu) 300 verschiedene Namen', namen.size >= 295, { verschieden:namen.size, von:300 });
check('1: der Name enthaelt griechischen Buchstaben und Katalognummer',
  /[α-ω]-\d{4}$/.test(G.abgrundSektor(13).name), { probe:G.abgrundSektor(13).name });

// ---- 2) Mutatoren ----
const MUT = G.ABGRUND_MUTATOREN;
check('2: es gibt mindestens 18 Mutatoren', MUT.length >= 18, { anzahl:MUT.length });
// Das Bild ist seit v8.328.0 KEIN Schrift-Icon mehr, sondern eine gezeichnete Form in
// ABGRUND_SYMBOLE (davor hatten vier Paare dasselbe ti-Icon, siehe tests/test_abgrund_symbole.js).
// Diese Pruefung wurde deshalb umgestellt statt gestrichen - ein Mutator ohne Bild bleibt ein
// Verstoss gegen CLAUDE.md Regel 7, nur liegt das Bild jetzt woanders.
const SYMBOLE = eval('('+objBlock('ABGRUND_SYMBOLE')+')');
check('2: jeder hat Schluessel, Namen, gezeichnetes Symbol und vollstaendige Beschreibung (CLAUDE.md Regel 7)',
  MUT.every(m => m.key && m.name && SYMBOLE[m.key] && typeof m.desc === 'string' && m.desc.length >= 60 && /[.!]$/.test(m.desc.trim())),
  MUT.filter(m => !(m.key && m.name && SYMBOLE[m.key] && m.desc && m.desc.length >= 60)).map(m=>m.key));
const WIRKFELDER = ['atk','def','loot','shards','dur','loss'];
check('2: jeder Mutator wirkt auf mindestens ein Feld',
  MUT.every(m => WIRKFELDER.some(f => typeof m[f] === 'number')),
  MUT.filter(m => !WIRKFELDER.some(f => typeof m[f] === 'number')).map(m=>m.key));
// Ein Pool aus lauter Vorteilen waere kein Inhalt, sondern nur Beute. Es muss beides geben.
const gut = MUT.filter(m => (m.atk>1)||(m.loot>1)||(m.shards>1)||(m.def<1)||(m.dur<1)||(m.loss<1));
const schlecht = MUT.filter(m => (m.atk<1)||(m.def>1)||(m.loot<1)||(m.dur>1)||(m.loss>1));
check('2: es gibt sowohl vorteilhafte als auch nachteilige Mutatoren',
  gut.length >= 6 && schlecht.length >= 6, { vorteilhaft:gut.length, nachteilig:schlecht.length });
const gemischt = MUT.filter(m => gut.includes(m) && schlecht.includes(m));
check('2: mindestens die Haelfte hat Vorteil UND Preis zugleich',
  gemischt.length >= MUT.length/2, { gemischt:gemischt.length, von:MUT.length });
// Anzahl je Sektor waechst mit der Tiefe und uebersteigt nie den Pool.
check('2: die Mutatorenzahl waechst mit der Tiefe',
  G.abgrundMutatorAnzahl(1) < G.abgrundMutatorAnzahl(10) && G.abgrundMutatorAnzahl(10) < G.abgrundMutatorAnzahl(40),
  { t1:G.abgrundMutatorAnzahl(1), t10:G.abgrundMutatorAnzahl(10), t40:G.abgrundMutatorAnzahl(40) });
let doppelt = null;
for (let t=1; t<=400 && !doppelt; t++){
  const keys = G.abgrundSektor(t).mutatoren.map(m=>m.key);
  if (new Set(keys).size !== keys.length) doppelt = { tiefe:t, keys };
}
check('2: kein Sektor zieht denselben Mutator doppelt', !doppelt, doppelt || undefined);
// Deckelung: drei gleichgerichtete Mutatoren duerfen sich nicht aufschaukeln.
let ausserhalb = null;
const GRENZEN = { atk:[0.50,1.60], def:[0.60,2.00], loot:[0.40,2.50], shards:[0.60,2.50], dur:[0.50,2.00], loss:[0.40,2.00] };
for (let t=1; t<=1000 && !ausserhalb; t++){
  const mods = G.abgrundSektor(t).mods;
  for (const f of WIRKFELDER){
    if (mods[f] < GRENZEN[f][0] - 1e-9 || mods[f] > GRENZEN[f][1] + 1e-9){ ausserhalb = { tiefe:t, feld:f, wert:mods[f] }; break; }
  }
}
check('2: ueber 1000 Tiefen bleibt jede Wirkung in ihren Grenzen', !ausserhalb, ausserhalb || undefined);

// ---- 3) Endlosigkeit ohne Explosion ----
check('3: es gibt keine Maximaltiefe im Code',
  !/ABGRUND_MAX_TIEFE|MAX_ABGRUND_TIEFE|abgrundMaxDepth/.test(js));
const sehrTief = G.abgrundSektor(500);
check('3: auch Tiefe 500 liefert einen gueltigen Sektor',
  sehrTief.name && sehrTief.defense > 0 && sehrTief.splitter > 0 && sehrTief.dauer > 0,
  { name:sehrTief.name, staerke:sehrTief.defense, splitter:sehrTief.splitter });
// Schwierigkeit geometrisch, Belohnung linear: der Abstand waechst, die Tiefe wird also von selbst
// zur Wand - das ist der Sinn. Waere die Beute ebenfalls geometrisch, waere jede Tiefe gratis.
const d10 = G.abgrundSektor(10), d20 = G.abgrundSektor(20), d40 = G.abgrundSektor(40);
check('3: die Gegnerstaerke waechst ueberproportional',
  d20.defense > d10.defense*2 && d40.defense > d20.defense*2,
  { t10:d10.defense, t20:d20.defense, t40:d40.defense });
const splitterRoh = t => Math.round(3 + t*0.8); // Basiskurve ohne Mutatorstreuung
check('3: die Splitterausbeute waechst nur linear, nicht geometrisch',
  splitterRoh(100)/splitterRoh(50) < 2.2 && splitterRoh(200)/splitterRoh(100) < 2.2,
  { t50:splitterRoh(50), t100:splitterRoh(100), t200:splitterRoh(200) });
check('3: die Flugzeit ist nach oben gedeckelt',
  G.abgrundSektor(5000).dauer <= 4*3600, { tiefe5000:G.abgrundSektor(5000).dauer });

// ---- 4) Werkstatt ----
const WS = G.ABGRUND_WERKSTATT;
check('4: es gibt mindestens vier Ausbaustufen-Zweige', WS.length >= 4, { anzahl:WS.length });
// Die Deckelung MUSS in der Beschreibung stehen (CLAUDE.md Regel 7 verlangt Wirkung inkl. Deckel),
// aber nicht mit einem bestimmten Wort: die Tiefensonde zaehlt Tiefen und sagt "hoechstens drei".
const nenntDeckel = d => /gedeckelt|h[oö]chstens|maximal/i.test(d.desc||'');
check('4: jeder Zweig hat Icon und vollstaendige Beschreibung mit Deckelangabe',
  WS.every(d => d.icon && d.desc && d.desc.length >= 80 && nenntDeckel(d)),
  WS.filter(d => !(d.icon && d.desc && d.desc.length >= 80 && nenntDeckel(d))).map(d=>d.key));
check('4: die Preise steigen mit jeder Stufe',
  WS.every(d => G.abgrundWerkstattKosten(d,0) < G.abgrundWerkstattKosten(d,1) &&
                G.abgrundWerkstattKosten(d,5) < G.abgrundWerkstattKosten(d,10)),
  WS.map(d => ({ k:d.key, s0:G.abgrundWerkstattKosten(d,0), s10:G.abgrundWerkstattKosten(d,10), s30:G.abgrundWerkstattKosten(d,30) })));
// Endlose Senke: Stufe 60 muss unbezahlbar teuer sein, sonst ist die Werkstatt nach einer Woche voll.
check('4: Stufe 60 kostet ein Vielfaches von Stufe 20 (echte Senke)',
  WS.every(d => G.abgrundWerkstattKosten(d,60) > G.abgrundWerkstattKosten(d,20)*100),
  WS.map(d => ({ k:d.key, s20:G.abgrundWerkstattKosten(d,20), s60:G.abgrundWerkstattKosten(d,60) })));
// Wirkung gedeckelt: mit absurd vielen Stufen darf nichts durchlaufen.
const Gvoll = baueKontext({ research:{}, abgrund:{ tiefe:1, best:0, splitter:0, tauchgaenge:0, gesehen:{},
  werkstatt: WS.reduce((a,d)=>{ a[d.key]=100000; return a; }, {}) } });
check('4: auch bei 100.000 Stufen bleibt jede Wirkung an ihrem Deckel',
  WS.every(d => Math.abs(Gvoll.abgrundWerkstattBonus(d.key) - d.deckel) < 1e-9),
  WS.map(d => ({ k:d.key, bonus:Gvoll.abgrundWerkstattBonus(d.key), deckel:d.deckel })));
// Und: die Werkstatt-Boni duerfen NUR im Abgrund wirken. Geprueft an den Aufrufstellen im Quelltext.
// Werkstatt-Boni duerfen NUR im Abgrund wirken. Gemessen wird an der UMSCHLIESSENDEN FUNKTION,
// nicht an einem Zeichenfenster: Ein Fenster ist von der Codelaenge abhaengig und meldete eine
// voellig korrekte neue Aufrufstelle (abgrundSondeReichweite) faelschlich als Verstoss.
// Fuer checkMissions gilt zusaetzlich, dass der Aufruf im 'abgrund'-Zweig stehen muss - sonst
// wuerde ein Werkstatt-Bonus in einem FREMDEN Missionstyp hier durchrutschen.
function umschliessendeFunktion(index){
  const davor = js.slice(0, index);
  const treffer = davor.match(/\n  (?:async )?function ([A-Za-z0-9_]+)\s*\(/g);
  if (!treffer || !treffer.length) return null;
  const letzte = treffer[treffer.length-1];
  return (letzte.match(/function ([A-Za-z0-9_]+)/)||[])[1] || null;
}
// Seit v8.330.0 laufen die vier Bonus-Kanaele (Kampfkraft, Verluste, Splitter, Beute) NICHT mehr
// einzeln ueber abgrundWerkstattBonus, sondern gebuendelt ueber abgrundKanalBonus - dort werden
// Werkstatt und Reliquien addiert. Die REGEL, die dieser Abschnitt schuetzt, ist unveraendert:
// Ein Abgrund-Bonus darf nirgends ausserhalb des Abgrunds gelesen werden, sonst wuerde er die
// normale Wirtschaft oder das PvP verschieben. Nur der Traeger heisst jetzt anders, deshalb
// werden BEIDE Namen eingesammelt statt der Test gestrichen.
const wsStellen = [];
{
  const re = /(abgrundWerkstattBonus|abgrundKanalBonus)\('([a-z]+)'\)/g;
  let m;
  while ((m = re.exec(js)) !== null) wsStellen.push({ index:m.index, fn:umschliessendeFunktion(m.index) });
}
const wsVerstoss = wsStellen.filter(st => {
  if (!st.fn) return true;
  if (/^(abgrund|renderAbgrund|kaufeAbgrund)/.test(st.fn)) return false;
  if (st.fn === 'checkMissions'){
    // Steht der Aufruf hinter dem Beginn des Abgrund-Zweigs und vor dem naechsten Zweig?
    const zweig = js.indexOf("} else if (m.type === 'abgrund'){");
    const naechster = js.indexOf("} else if (m.type === 'intercept-pirates'){", zweig);
    return !(zweig >= 0 && st.index > zweig && (naechster < 0 || st.index < naechster));
  }
  return true;
});
check('4: Abgrund-Boni werden nur im Abgrund-Kontext gelesen',
  wsStellen.length >= 4 && wsVerstoss.length === 0,
  { aufrufe:wsStellen.length, funktionen:[...new Set(wsStellen.map(s=>s.fn))], verstoesse:wsVerstoss.map(v=>v.fn) });

// ---- 5) Tiefenbonus ----
const bonusBei = best => baueKontext({ research:{}, abgrund:{ tiefe:1, best, splitter:0, tauchgaenge:0, gesehen:{}, werkstatt:{} } }).abgrundTiefenBonus();
check('5: ohne Tauchgang gibt es keinen Bonus', bonusBei(0) === 0);
// Gemessen wird an GLEICH GROSSEN Schritten (je +10 Tiefe), nicht an Verdopplungen: eine
// Log-Kurve liefert bei gleichem VERHAELTNIS etwa gleiche Zuwaechse (10->20 und 100->200 sind
// beide eine Verdopplung), erst bei gleichem ABSTAND flacht sie sichtbar ab. Die erste Fassung
// dieser Pruefung verglich Verdopplungen und schlug deshalb an, obwohl die Kurve stimmte.
check('5: der Bonus waechst, aber gleich grosse Schritte bringen immer weniger',
  bonusBei(20) > bonusBei(10) && bonusBei(110) > bonusBei(100) &&
  (bonusBei(110) - bonusBei(100)) < (bonusBei(20) - bonusBei(10)) / 5,
  { schritt10auf20:+(bonusBei(20)-bonusBei(10)).toFixed(5), schritt100auf110:+(bonusBei(110)-bonusBei(100)).toFixed(5) });
check('5: selbst Rekordtiefe 100.000 bleibt unter +40% Produktion',
  bonusBei(100000) < 0.40, { bonus:+bonusBei(100000).toFixed(4) });
// Er muss auch wirklich verdrahtet sein - ein Bonus, den niemand aufruft, ist kein Bonus.
check('5: der Tiefenbonus ist in ratesPerSecond verdrahtet',
  /const tiefenProd = abgrundTiefenBonus\(\);/.test(js) && /tiefenProd > 0/.test(js));

// ---- 6) Wiederholung lohnt weniger ----
const Grek = baueKontext({ research:{}, abgrund:{ tiefe:1, best:30, splitter:0, tauchgaenge:0, gesehen:{}, werkstatt:{} } });
check('6: eine bereits bezwungene Tiefe gibt weniger Ausbeute',
  Grek.abgrundWiederholungsFaktor(20) < 1 && Grek.abgrundWiederholungsFaktor(30) < 1,
  { tiefe20:Grek.abgrundWiederholungsFaktor(20) });
check('6: der naechste Schritt nach unten gibt die volle Ausbeute',
  Grek.abgrundWiederholungsFaktor(31) === 1);
check('6: waehlbar ist hoechstens eine Tiefe unter dem Rekord',
  Grek.abgrundMaxTiefe() === 31, { max:Grek.abgrundMaxTiefe() });

// ---- 7) Verdrahtung des Missionstyps ----
// CLAUDE.md Regel 6: nach einer Mechanik-Aenderung ALLE Stellen derselben Groesse pruefen, nicht
// nur die eine, die man im Kopf hat. Der Missionstyp muss ueberall dort stehen, wo 'piratelair'
// steht - sonst zaehlt ein Tauchgang z.B. nicht gegen die Missionskapazitaet oder die Schiffe
// gelten daheim weiterhin als verfuegbar und lassen sich doppelt verschicken.
const lairZeilen = js.split('\n').map((z,i)=>({z,i})).filter(o => /m\.type\s*===?\s*'piratelair'/.test(o.z) && /filter|if \(\(/.test(o.z));
const ohneAbgrund = lairZeilen.filter(o => !/'abgrund'/.test(o.z));
check('7: jede Missions-Sammelstelle mit piratelair kennt auch abgrund',
  lairZeilen.length >= 10 && ohneAbgrund.length === 0,
  { stellen:lairZeilen.length, ohneAbgrund:ohneAbgrund.map(o=>o.i+1) });
check('7: es gibt einen Aufloesungszweig fuer den Tauchgang',
  /\} else if \(m\.type === 'abgrund'\)\{/.test(js));
check('7: der Tauchgang taucht in der Missionsliste mit eigenem Label auf',
  /m\.type === 'abgrund'[\s\S]{0,300}Abgrund: Tiefe/.test(js));
// Vorschau und Aufloesung MUESSEN dieselbe Kraftfunktion benutzen - genau der Auseinanderlauf,
// der bei der PvP-Vorschau schon einmal zwei widersprechende Anzeigen erzeugt hat.
const kraftAufrufe = (js.match(/abgrundKampfkraft\(/g) || []).length;
check('7: Vorschau und Aufloesung teilen sich eine Kampfkraft-Funktion',
  kraftAufrufe >= 3, { aufrufe:kraftAufrufe });

// ---- 8) Backend, Icons, DOM-Zustand ----
// SAVE_SANITY_LIMITS (Backend): Kredite 1e12, Ressourcen 1e15. Der Abgrund fuehrt vier neue
// speicherbare Zahlenfelder ein - keins davon darf realistisch in diese Naehe kommen.
check('8: die Rohstoffbeute bleibt auch in Tiefe 10.000 weit unter dem Ressourcen-Limit',
  Math.max.apply(null, Object.values(G.abgrundSektor(10000).loot)) < 1e12,
  { maxBeute:Math.max.apply(null, Object.values(G.abgrundSektor(10000).loot)) });
// Icons: die Werkstatt-Zweige tragen weiterhin Schrift-Icons und muessen deshalb in der
// Font-Whitelist liegen. check-icons.js prueft nur ti-*-Vorkommen im MARKUP; diese hier stehen in
// Datenfeldern und faenden dort niemanden. Die Mutatoren sind seit v8.328.0 gezeichnet und deshalb
// hier raus - fuer sie prueft tests/test_abgrund_symbole.js Vollstaendigkeit UND Eindeutigkeit.
const whitelist = new Set((js + src).match(/\.ti-[a-z0-9-]+:before/g).map(s => s.slice(1).replace(':before','')));
const fehlendeIcons = WS.map(x=>x.icon).filter(i => !whitelist.has(i));
check('8: alle Werkstatt-Icons sind im Icon-Subset enthalten',
  fehlendeIcons.length === 0, fehlendeIcons);
check('8: kein Mutator traegt noch ein Schrift-Icon-Feld (das Bild kommt aus ABGRUND_SYMBOLE)',
  MUT.every(m => !m.icon), MUT.filter(m=>m.icon).map(m=>m.key));
// Chronik: echte Lese-Inhalte, keine Platzhalter.
const CH = G.ABGRUND_CHRONIK;
check('8: die Chronik hat mindestens 16 Eintraege mit echtem Text',
  CH.length >= 16 && CH.every(e => e.titel && e.text && e.text.length >= 100),
  { eintraege:CH.length, kuerzester:Math.min.apply(null, CH.map(e=>e.text.length)) });
check('8: die Chronik-Tiefen steigen streng an',
  CH.every((e,i) => i === 0 || e.tiefe > CH[i-1].tiefe), CH.map(e=>e.tiefe));
// Aufklappzustand: CLAUDE.md - <details>, die im Tick neu geschrieben werden, klappen ohne
// data-keep-open nach einer Sekunde von selbst wieder zu.
const boxQuelle = fnAus('renderAbgrundBox');
const details = (boxQuelle.match(/<details/g) || []).length;
// Nur Vorkommen AM <details>-Tag zaehlen: seit v8.324.0 steht derselbe Text auch in einem
// querySelector im Verdrahtungsteil, und der ist kein Markup.
const keepOpen = (boxQuelle.match(/<details[^>]*data-keep-open="/g) || []).length;
check('8: jedes <details> der Abgrund-Box hat data-keep-open',
  details > 0 && details === keepOpen, { details, keepOpen });
// Und die Tauchtiefe darf nicht nur im DOM stehen - sonst ist sie beim naechsten Tick weg.
check('8: die gewaehlte Tauchtiefe liegt im Spielstand, nicht nur im DOM',
  /z\.tiefe = Math\.max\(1, Math\.min\(abgrundMaxTiefe\(\)/.test(boxQuelle) && !/<select/.test(boxQuelle));
// Hilfe und Patchnotes: neue Mechanik ohne Erklaerung ist halbe Arbeit (CLAUDE.md Punkt 5).
// Seit v8.326.0 ist die Abgrund-Hilfe ein EIGENER Abschnitt mit mehreren Eintraegen, kein
// Sammelabsatz mehr unter "Grundlagen". Vorher war es ein einziger Eintrag mit 581 Woertern, an
// den ueber fuenf Versionen immer weiter angehaengt wurde - und er stand im Einsteiger-Abschnitt,
// obwohl der Abgrund Endgame-Inhalt ist.
{
  const i = js.indexOf("{ key:'abgrund', icon:'ti-infinity', title:'Der Abgrund', entries:[");
  check('8: der Abgrund hat einen EIGENEN Hilfe-Abschnitt', i > 0);
  const ende = i > 0 ? js.indexOf('\n    ]},', i) : -1;
  const abschnitt = i > 0 && ende > i ? js.slice(i, ende) : '';
  const eintraege = (abschnitt.match(/\{ title:'/g) || []).length;
  check('8: er ist in mehrere Eintraege gegliedert, keine Textwand', eintraege >= 5, { eintraege });
  // Kein Einzeleintrag darf wieder zur Wand werden - genau so ist der alte entstanden.
  const laengen = [...abschnitt.matchAll(/body:'((?:[^'\\]|\\.)*)'/g)].map(m => m[1].length);
  check('8: kein einzelner Hilfe-Eintrag ist laenger als 2000 Zeichen',
    laengen.length > 0 && Math.max.apply(null, laengen) <= 2000,
    { laengen, laengster: laengen.length ? Math.max.apply(null, laengen) : 0 });
  // Und der alte Sammelabsatz darf nicht danebenstehen geblieben sein.
  check('8: der alte Sammelabsatz unter "Grundlagen" ist verschwunden',
    (js.match(/title:'Der Abgrund – endlos neue Sektoren'/g) || []).length === 0);
}
check('8: der oberste Patchnotes-Eintrag beschreibt den Abgrund',
  /version:'8\.320\.0'[\s\S]{0,4000}Abgrund/.test(js));

// ---- 9) Bestenlisten-Verdrahtung (v8.321.0) ----
// Der Determinismus aus Abschnitt 1 hat nur dann einen Zweck, wenn die Tiefe auch irgendwo
// verglichen wird. Geprueft wird die ganze Kette: veroeffentlichen, anzeigen, ranglisten.
check('9: die Rekordtiefe wird im Bestenlisten-Eintrag veroeffentlicht',
  /abgrundBest: \(state\.abgrund && state\.abgrund\.best\) \|\| 0,/.test(js));
// Sie darf NICHT durch die Spionageabwehr verrauscht werden - eine verrauschte Bestleistung
// waere als Vergleichswert wertlos. fuzz() umschliesst die Flottenzahlen, nicht diese.
check('9: die Tiefe wird nicht von der Spionageabwehr verrauscht',
  !/abgrundBest:\s*fuzz\(/.test(js));
check('9: die Bestenliste zeigt ein Tiefen-Abzeichen',
  /e\.abgrundBest\?' <span class="lvl-pill"[^]{0,200}ti-infinity/.test(js));
check('9: das Spielerprofil zeigt die Rekordtiefe im Vergleich',
  /entry\.abgrundBest \? prow\('ti-infinity'[^]{0,200}Rekordtiefe/.test(js));
const boxQuelle9 = fnAus('renderAbgrundBox');
check('9: die Abgrund-Box baut eine Tiefen-Rangliste',
  /const tiefenListe = \(leaderboardCache\|\|\[\]\)/.test(boxQuelle9) && /tiefsten Kommandanten/.test(boxQuelle9));
// Sie darf keinen eigenen Serverabruf ausloesen - der Zwischenspeicher ist ohnehin da.
check('9: die Rangliste laedt nichts nach, sie nutzt den vorhandenen Zwischenspeicher',
  !/storageList|storageGet|loadLeaderboard\(/.test(boxQuelle9));
// Und sie muss ehrlich beschriften, dass nur die geladenen Top 30 gewertet sind.
check('9: die Rangliste nennt ihre Grenze (nur die geladenen Top 30)',
  /Top 30/.test(boxQuelle9));

// ---- 10) Wochen-Tiefenlauf, Tiefensonde, Allianz-Tiefenlauf (v8.322.0) ----
// Gemessen wird am ZUSTAND, nicht am Rueckgabewert: abgrundWochenpflege arbeitet auf state.
{
  const zustand = { research:{}, player:{id:'u',name:'A'},
    abgrund:{ tiefe:1, best:30, splitter:0, tauchgaenge:0, gesehen:{}, werkstatt:{},
              woche:{ key:'2020-01-06', best:12 }, wochePraemie:null, allianzMarken:{} } };
  const W = baueKontext(zustand);
  W.abgrundWochenpflege();
  check('10: nach dem Wochenwechsel steht die Vorwoche als Praemie bereit',
    !!zustand.abgrund.wochePraemie && zustand.abgrund.wochePraemie.tiefe === 12,
    { praemie: zustand.abgrund.wochePraemie });
  check('10: die laufende Woche startet bei 0 und traegt den aktuellen Schluessel',
    zustand.abgrund.woche.best === 0 && zustand.abgrund.woche.key === W.weekKeyOf(Date.now()),
    { woche: zustand.abgrund.woche });
  // Zweiter Aufruf in derselben Woche darf nichts mehr veraendern.
  zustand.abgrund.woche.best = 5;
  W.abgrundWochenpflege();
  check('10: ein zweiter Aufruf in derselben Woche laesst den Lauf unangetastet',
    zustand.abgrund.woche.best === 5, { best: zustand.abgrund.woche.best });
}
// Eine bessere, noch nicht abgeholte Praemie darf nicht von einer schlechteren ueberschrieben werden.
{
  const zustand = { research:{}, player:{id:'u',name:'A'},
    abgrund:{ tiefe:1, best:30, splitter:0, tauchgaenge:0, gesehen:{}, werkstatt:{},
              woche:{ key:'2020-01-06', best:3 }, wochePraemie:{ key:'2019-12-30', tiefe:25 }, allianzMarken:{} } };
  baueKontext(zustand).abgrundWochenpflege();
  check('10: eine bessere offene Praemie wird nicht von einer schlechteren verdraengt',
    zustand.abgrund.wochePraemie.tiefe === 25, { praemie: zustand.abgrund.wochePraemie });
}
check('10: die Wochenpraemie waechst mit der Tiefe und ist mindestens 1',
  G.abgrundWochenPraemieSplitter(0) >= 1 && G.abgrundWochenPraemieSplitter(40) > G.abgrundWochenPraemieSplitter(20),
  { t20:G.abgrundWochenPraemieSplitter(20), t40:G.abgrundWochenPraemieSplitter(40) });
check('10: der Wochenlauf zaehlt auch unterhalb des Rekords (das ist sein Zweck)',
  /if \(tiefe > \(a\.woche\.best\|\|0\)\) a\.woche\.best = tiefe;/.test(js));
check('10: die Wochentiefe wird mit ihrem Wochenschluessel veroeffentlicht',
  /abgrundWoche: \(state\.abgrund && state\.abgrund\.woche\)/.test(js) && /key: state\.abgrund\.woche\.key/.test(js));
// Sonde: gedeckelt, und sie nutzt dieselbe Werkstatt-Rechnung wie alle anderen Zweige.
{
  const sonde = G.ABGRUND_WERKSTATT.find(d => d.key === 'tiefensonde');
  check('10: die Tiefensonde ist ein regulaerer Werkstatt-Zweig', !!sonde && sonde.einheit === 'Tiefen',
    sonde ? { deckel:sonde.deckel, schritt:sonde.schritt } : null);
  const S0 = baueKontext({ research:{}, abgrund:{ tiefe:1, best:0, splitter:0, tauchgaenge:0, gesehen:{}, werkstatt:{}, woche:{key:null,best:0}, wochePraemie:null, allianzMarken:{} } });
  check('10: ohne Sonde gibt es keine Vorschau', S0.abgrundSondeReichweite() === 0);
  const S9 = baueKontext({ research:{}, abgrund:{ tiefe:1, best:0, splitter:0, tauchgaenge:0, gesehen:{}, werkstatt:{ tiefensonde:99 }, woche:{key:null,best:0}, wochePraemie:null, allianzMarken:{} } });
  check('10: die Vorschau ist bei drei Tiefen gedeckelt', S9.abgrundSondeReichweite() === 3, { weite:S9.abgrundSondeReichweite() });
  check('10: die Sonde aendert nichts am Kampf, nur an der Anzeige',
    !/tiefensonde/.test(fnAus('abgrundKampfkraft')) && !/tiefensonde/.test(fnAus('abgrundSektor')));
}
// Allianz: eigener Schluessel je Mitglied - das ist der Punkt, an dem Beitraege sonst verlorengehen.
// Gemeint ist der SCHLUESSEL, nicht die Schreibvariante - seit v8.324.0 laeuft das ueber
// storageSetStrict (siehe Abschnitt 12). Deshalb bewusst offen fuer beide Varianten.
check('10: jedes Mitglied schreibt nur seinen EIGENEN Allianz-Schluessel',
  /storageSet(Strict)?\('alliance:'\+tag\+':abgrund:'\+state\.player\.id/.test(js));
check('10: gelesen wird ueber storageList, nicht ueber ein gemeinsames Dokument',
  /storageList\('alliance:'\+tag\+':abgrund:'/.test(js));
check('10: nur Beitraege der laufenden Woche zaehlen fuer die Marken',
  /x\.weekKey === woche/.test(js));
check('10: es gibt drei aufsteigende Allianz-Marken mit Beschreibung',
  G.ABGRUND_ALLIANZ_MARKEN.length === 3 &&
  G.ABGRUND_ALLIANZ_MARKEN.every((m,i) => m.desc && m.desc.length >= 60 && (i===0 || m.ziel > G.ABGRUND_ALLIANZ_MARKEN[i-1].ziel)),
  G.ABGRUND_ALLIANZ_MARKEN.map(m => ({ k:m.key, ziel:m.ziel, splitter:m.splitter })));
// Diese beiden Regeln werden am VERHALTEN gemessen, nicht am Vorhandensein eines Tokens.
// Erster Anlauf prüfte nur, ob "a.allianzMarken[merker]" irgendwo im Quelltext steht - die
// Zuweisung eine Zeile weiter unten liess den Test auch dann gruen, wenn die Sperre entfernt war.
// Die Rot-Probe "Marke laesst sich mehrfach abholen" schlug deshalb nicht an.
const aktuelleWoche = G.weekKeyOf(Date.now());
function markenKontext(zustand, summe){
  const quelle = [
    block('ABGRUND_ALLIANZ_MARKEN') ? 'const ABGRUND_ALLIANZ_MARKEN = '+block('ABGRUND_ALLIANZ_MARKEN')+';' : '',
    fnAus('weekKeyOf'), fnAus('ensureAbgrund'), fnAus('abgrundWochenpflege'),
    'function abgrundAllianzSumme(){ return SUMME; }'.replace('SUMME', String(summe)),
    fnAus('abgrundAllianzMarkeErreicht'), fnAus('holeAbgrundAllianzMarke'),
    // Nebenwirkungen stumm schalten - geprueft wird die Buchhaltung, nicht die Anzeige.
    'function log(){} function fmt(x){ return String(x); } function playSound(){} function save(){} function render(){}',
    'return { holeAbgrundAllianzMarke };'
  ].join('\n');
  return new Function('state', quelle)(zustand);
}
{
  const zustand = { research:{}, player:{id:'u',name:'A'},
    abgrund:{ tiefe:1, best:9, splitter:0, tauchgaenge:1, gesehen:{}, werkstatt:{},
              woche:{ key:null, best:9 }, wochePraemie:null, allianzMarken:{} } };
  // Der Wochenschluessel MUSS der aktuelle sein: holeAbgrundAllianzMarke ruft abgrundWochenpflege
  // auf, und ein abweichender Schluessel gilt dort - voellig richtig - als Wochenwechsel und setzt
  // den Lauf auf 0 zurueck. Mit key:null hatte die erste Fassung dieses Tests genau das ausgeloest
  // und dann eine Auszahlung von 0 gemessen, ohne dass am Produkt etwas falsch war.
  zustand.abgrund.woche = { key: aktuelleWoche, best: 9 };
  const M = markenKontext(zustand, 999); // Summe weit ueber jeder Marke
  M.holeAbgrundAllianzMarke('m50');
  const nachErstem = zustand.abgrund.splitter;
  M.holeAbgrundAllianzMarke('m50');
  const nachZweitem = zustand.abgrund.splitter;
  check('10: eine Marke laesst sich je Woche nur EINMAL abholen (am Verhalten gemessen)',
    nachErstem > 0 && nachZweitem === nachErstem, { nachErstem, nachZweitem });
}
{
  const zustand = { research:{}, player:{id:'u',name:'A'},
    abgrund:{ tiefe:1, best:9, splitter:0, tauchgaenge:0, gesehen:{}, werkstatt:{},
              woche:{ key:aktuelleWoche, best:0 }, wochePraemie:null, allianzMarken:{} } };
  const M = markenKontext(zustand, 999);
  M.holeAbgrundAllianzMarke('m50');
  check('10: wer selbst nicht getaucht ist, bekommt nichts (am Verhalten gemessen)',
    (zustand.abgrund.splitter||0) === 0, { splitter: zustand.abgrund.splitter });
}
{
  const zustand = { research:{}, player:{id:'u',name:'A'},
    abgrund:{ tiefe:1, best:9, splitter:0, tauchgaenge:1, gesehen:{}, werkstatt:{},
              woche:{ key:aktuelleWoche, best:9 }, wochePraemie:null, allianzMarken:{} } };
  const M = markenKontext(zustand, 10); // Summe UNTER der ersten Marke
  M.holeAbgrundAllianzMarke('m50');
  check('10: eine nicht erreichte Marke zahlt nichts aus',
    (zustand.abgrund.splitter||0) === 0, { splitter: zustand.abgrund.splitter });
}
// Das Nachladen ist reines Anzeige-Polling und gehoert hinter das Sichtbarkeits-Gate (CLAUDE.md);
// das MELDEN des eigenen Beitrags haengt an echter Mechanik und darf es nicht.
check('10: der Allianz-Stand wird nur bei sichtbarem Tab nachgeladen',
  /visibilityState === 'visible'\) ladeAbgrundAllianzstand\(\)/.test(js));
check('10: der eigene Beitrag wird unabhaengig von der Sichtbarkeit gemeldet',
  /^\s*meldeAbgrundAllianzBeitrag\(\);$/m.test(js));

// ---- 11) Waechter, Gegenmassnahmen, Titel (v8.323.0) ----
check('11: jede zehnte Tiefe ist eine Waechtertiefe',
  G.abgrundIstWaechter(10) && G.abgrundIstWaechter(20) && !G.abgrundIstWaechter(9) && !G.abgrundIstWaechter(11));
check('11: Waechter haben Namen UND einen eigenen Text',
  G.ABGRUND_WAECHTER_NAMEN.length >= 12 && G.ABGRUND_WAECHTER_NAMEN.every(w => w.name && w.text && w.text.length >= 60),
  { anzahl:G.ABGRUND_WAECHTER_NAMEN.length });
// Ueber die Liste hinaus muss es weitergehen - der Abstieg ist unendlich, die Namensliste nicht.
{
  const erste = G.abgrundWaechterDef(10);
  const nachRunde = G.abgrundWaechterDef(10 + G.ABGRUND_WAECHTER_ALLE * G.ABGRUND_WAECHTER_NAMEN.length);
  check('11: nach der Namensliste kehren Waechter mit Zaehlnummer wieder',
    !!nachRunde && nachRunde.name !== erste.name && /Wiederkehr/.test(nachRunde.name),
    { erste:erste.name, spaeter: nachRunde ? nachRunde.name : null });
  // Absturzsicher formuliert: Laeuft die Namensliste aus und die Funktion liefert null, soll hier
  // eine lesbare FAIL-Zeile stehen und kein nackter TypeError.
  const tief = G.abgrundWaechterDef(10000);
  check('11: auch in Tiefe 10.000 gibt es noch einen benannten Waechter',
    !!tief && !!tief.name, tief ? tief.name : null);
}
// Der Waechter muss sich in Staerke UND Belohnung niederschlagen, sonst ist er nur ein Etikett.
{
  const w = G.abgrundSektor(20), davor = G.abgrundSektor(19), danach = G.abgrundSektor(21);
  check('11: der Sektor traegt den Waechter', !!w.waechter && !davor.waechter && !danach.waechter);
  // Gegen die reine Tiefenkurve gerechnet: Tiefe 20 muss deutlich ueber der Interpolation liegen.
  const erwartetOhne = Math.sqrt(davor.defense * danach.defense);
  check('11: eine Waechtertiefe ist spuerbar staerker als ihre Nachbarn',
    w.defense > erwartetOhne * 1.2, { tiefe20:w.defense, nachbarmittel:Math.round(erwartetOhne) });
  check('11: und sie gibt mehr Splitter', w.splitter > davor.splitter * 2, { t19:davor.splitter, t20:w.splitter });
}
// Seit v8.330.0 ist der Erstsieg anders belohnt als die Wiederholung: beim ERSTEN Sieg ueber einen
// Waechter faellt seine Reliquie, ab dem zweiten wie bisher ein Modul. Die Zusage "ein Waechter
// gibt garantiert etwas Einmaliges" gilt also weiter - nur eben zweigeteilt. Beide Aeste werden
// geprueft, sonst koennte einer davon still verschwinden.
{
  const i = js.indexOf('const relikt = abgrundReliktDef(tiefe);');
  const zweig = i > 0 ? js.slice(i, i + 1600) : '';
  check('11: der Erstsieg ueber einen Waechter gibt seine Reliquie',
    /a\.relikte\[relikt\.key\] = true/.test(zweig));
  check('11: jeder weitere Sieg gibt weiterhin garantiert ein Modul',
    /reliktNeu \? null : grantRandomModule\(\)/.test(zweig));
}
// ---- Gegenmassnahme ----
{
  const roh = G.abgrundSektor(17); // Tiefe >= 15 -> drei Mutatoren
  check('11: eine Tiefe ab 15 hat drei Mutatoren zum Bannen', roh.mutatoren.length === 3);
  const opfer = roh.mutatoren[0];
  const gebannt = G.abgrundSektorMitBann(roh, opfer.key);
  check('11: der gebannte Mutator ist aus dem Sektor verschwunden',
    gebannt.mutatoren.length === roh.mutatoren.length - 1 &&
    !gebannt.mutatoren.some(m => m.key === opfer.key) &&
    gebannt.gebannt && gebannt.gebannt.key === opfer.key,
    { vorher:roh.mutatoren.map(m=>m.key), nachher:gebannt.mutatoren.map(m=>m.key) });
  // Und seine WIRKUNG muss weg sein, nicht nur sein Name aus der Liste. Breit gemessen statt an
  // einem Einzelfall: Die erste Fassung dieser Pruefung hatte ein "|| a === b && ..."-Oder, das sie
  // fast immer wahr machte - eine leere Pruefung genau an der Stelle, um die es geht.
  // Ausnahmen sind moeglich, wenn die Deckelung beide Werte auf dieselbe Grenze presst; deshalb
  // wird eine Quote geprueft und die Ausreisser werden mit ausgegeben.
  const WIRK = ['atk','def','loot','shards','dur','loss'];
  let banns = 0, wirksam = 0; const ausreisser = [];
  for (let t = 15; t <= 120; t++){
    const sk = G.abgrundSektor(t);
    for (const mut of sk.mutatoren){
      banns++;
      const ohne = G.abgrundSektorMitBann(sk, mut.key);
      if (WIRK.some(f => Math.abs(ohne.mods[f] - sk.mods[f]) > 1e-9)) wirksam++;
      else if (ausreisser.length < 4) ausreisser.push({ tiefe:t, mutator:mut.key });
    }
  }
  check('11: ein Bann aendert die Wirkung des Sektors, nicht nur die Namensliste',
    banns > 200 && wirksam / banns >= 0.95, { banns, wirksam, ausreisser });
  // Ein Bann auf einen Mutator, der gar nicht im Sektor liegt, darf nichts veraendern.
  check('11: ein wirkungsloser Bann laesst den Sektor unveraendert',
    G.abgrundSektorMitBann(roh, 'gibtesnicht') === roh);
  // Der Waechterzuschlag muss den Bann ueberleben - er haengt an der Tiefe, nicht am Mutator.
  const wRoh = G.abgrundSektor(20);
  const wGebannt = G.abgrundSektorMitBann(wRoh, wRoh.mutatoren[0].key);
  check('11: ein Bann hebt den Waechterstatus nicht auf',
    !!wGebannt.waechter && wGebannt.splitter > G.abgrundSektor(19).splitter * 2,
    { splitter:wGebannt.splitter });
}
// Seit v8.336.0 reisen neben dem Bann drei weitere Vormerkungen mit (Bannspule, Waechterruf,
// Grundberuehrung). Die Aussage bleibt dieselbe - beim START verbraucht, in der Mission mitgereist -,
// nur die Schreibweise der Zeile hat sich geaendert.
check('11: die Gegenmassnahme wird beim START verbraucht, nicht bei der Rueckkehr',
  /a\.gegenmassnahmen -= 1;/.test(js) && /composition: flotte, fleetName: sektor\.name, bann,/.test(js));
// Seit v8.339.0 kommt als vierter Parameter der Nullkiel dazu - er haengt an der MITGEFLOGENEN
// Flotte, damit ein zwischenzeitlicher Verkauf den Sektor nicht rueckwirkend haerter macht.
check('11: der Bann kommt bei der Aufloesung aus der MISSION',
  /abgrundSektorMitBann\(abgrundSektor\(tiefe\), m\.bann \|\| null, !!m\.spule, nullkielAktiv\(m\.composition \|\| fleet\)\)/.test(js));
// Vorschau und Kampf muessen denselben Bann anwenden.
{
  const boxQ = fnAus('renderAbgrundBox');
  // Seit v8.336.0 gibt die Vorschau auch die Bannspule mit - sie verschiebt Gegnerstaerke und
  // Beute, und eine Vorschau, die das verschweigt, waere genau der Auseinanderlauf, den dieser
  // Abschnitt verhindern soll.
  check('11: die Vorschau rechnet mit demselben Bann wie der Start',
    /abgrundSektorMitBann\(rohSektor, bannAktiv, !!a\.spule && !!bannAktiv, nullkielAktiv\(flotte\)\)/.test(boxQ) && /rohSektor\.mutatoren\.some/.test(boxQ));
}
// ---- Titel ----
{
  const tm = block('TITLE_MAP');
  check('11: es gibt drei Abgrund-Titel', tm && (tm.match(/abgrund(10|25|50)/g)||[]).length === 3,
    tm ? (tm.match(/achievement:'abgrund\d+', title:'[^']+'/g)||[]) : null);
  // Reihenfolge ist Rangfolge (playerTitle nimmt den ersten Treffer): der schwerste zuerst.
  const i50 = tm.indexOf("'abgrund50'"), i25 = tm.indexOf("'abgrund25'"), i10 = tm.indexOf("'abgrund10'");
  check('11: die Abgrund-Titel stehen in absteigender Schwierigkeit ganz oben',
    i50 >= 0 && i50 < i25 && i25 < i10 && i10 < tm.indexOf("'allbosses'"),
    { i50, i25, i10 });
}

// ---- 12) Auffindbarkeit und laute Fehler (v8.324.0) ----
// Spieler-Report 28.07.2026: "wo ist die Abgrund-Splitter-Werkstatt?" - sie war die einzige
// Ausgabestelle fuer Splitter und lag hinter einem Aufklappfeld, das openDetailKeys (ein reiner
// Sitzungs-Cache) nach jedem Neuladen wieder zuklappte.
{
  const boxQ = fnAus('renderAbgrundBox');
  check('12: der Splitterstand steht in der immer sichtbaren Ueberschrift',
    /section-title[^`]*Der Abgrund[^`]*Splitter/.test(boxQ));
  check('12: die Werkstatt steht offen, solange sie noch nie angefasst wurde',
    /a\.werkstattGesehen \? detailsOpenAttr\('abgrundWerkstatt'\) : ' open'/.test(boxQ));
  // Und ein bewusstes Zuklappen muss ueberleben - sonst bevormundet die Box den Spieler.
  check('12: ein eigenes Auf-/Zuklappen wird dauerhaft gemerkt',
    /werkstattGesehen = true; save\(\)/.test(boxQ) && /addEventListener\('toggle'/.test(boxQ));
  check('12: die Beschriftung sagt, wofuer die Werkstatt da ist',
    /Werkstatt – hier gibst du Splitter aus/.test(boxQ));
}
// Der Allianz-Beitrag darf NICHT ueber storageSet laufen: das faellt bei jeder Nicht-OK-Antwort
// still auf localStorage zurueck, und ein geteilter Schluessel im eigenen Browser ist wertlos.
{
  const meldeQ = fnAus('meldeAbgrundAllianzBeitrag');
  check('12: der Allianz-Beitrag nutzt die strikte Schreibvariante',
    /storageSetStrict\(/.test(meldeQ) && !/[^t]storageSet\(/.test(meldeQ));
  check('12: eine Ablehnung wird dem Spieler gemeldet, nicht nur der Konsole',
    /log\(/.test(meldeQ) && /'warn'/.test(meldeQ));
  check('12: aber nur einmal je Grund, nicht bei jedem Tauchgang',
    /a\.allianzMeldungFehler !== grund/.test(meldeQ));
  check('12: die Meldung stellt klar, dass der eigene Tauchgang zaehlt',
    /eigener Tauchgang ist davon nicht betroffen/.test(meldeQ));
}

// ---- 13) Grafik: Sektor-Siegel und Tiefenprofil (v8.326.0) ----
// Der Abgrund war bis v8.325.0 reine Schrift. Ein System, dessen ganzer Reiz "jede Tiefe ist ein
// anderer Ort" ist, sah an jedem Ort gleich aus.
{
  const GG = baueKontext(neuerZustand());
  const siegelQ = fnAus('abgrundSiegel');
  check('13: es gibt ein Sektor-Siegel und ein Tiefenprofil',
    siegelQ.length > 100 && fnAus('abgrundTiefenprofil').length > 100);
  // Das Siegel muss aus der TIEFE kommen, nicht aus dem Zufall - sonst zeichnet jeder Tick ein
  // anderes Bild und die Zusage "Tiefe 47 ist fuer alle dieselbe" gilt fuer das Wappen nicht.
  check('13: das Siegel wird gewuerfelt wie der Sektor: aus der Tiefe, nicht aus Math.random',
    /abgrundRng\(/.test(siegelQ) && !/Math\.random/.test(siegelQ));
}
{
  // Ausfuehren statt nur lesen: dieselbe Tiefe muss dasselbe Markup ergeben, verschiedene Tiefen
  // verschiedenes. Dafuer werden die echten Funktionen mit den Sektoren gefuettert.
  const zeichner = new Function('ABGRUND_WAECHTER_ALLE',
    [konstAus('ABGRUND_SIEGEL_KERNE'), konstAus('ABGRUND_SIEGEL_RINGE'),
     fnAus('abgrundRng'), fnAus('abgrundSiegel'), fnAus('abgrundTiefenprofil'),
     'return { abgrundSiegel, abgrundTiefenprofil };'].join('\n'))(G.ABGRUND_WAECHTER_ALLE);
  const s20a = zeichner.abgrundSiegel(G.abgrundSektor(20), 56);
  const s20b = zeichner.abgrundSiegel(G.abgrundSektor(20), 56);
  check('13: dieselbe Tiefe ergibt exakt dasselbe Siegel', s20a === s20b, { laenge:s20a.length });
  const bilder = new Set();
  for (let t = 1; t <= 120; t++) bilder.add(zeichner.abgrundSiegel(G.abgrundSektor(t), 56));
  check('13: 120 Tiefen ergeben ueberwiegend verschiedene Siegel',
    bilder.size >= 100, { verschieden:bilder.size, von:120 });
  check('13: das Siegel ist gueltiges, in sich geschlossenes SVG',
    /^<svg /.test(s20a) && /<\/svg>$/.test(s20a) && !/undefined|NaN/.test(s20a));
  // Waechtertiefen muessen sich auch im Bild unterscheiden - die Farbe traegt Information.
  // ACHTUNG, hier steckte ein Loch: Die erste Fassung prueft nur, OB die Waechterfarbe vorkommt.
  // Das kleine Waechter-Dreieck traegt sie aber ohnehin, also blieb die Pruefung gruen, als die
  // Farbcodierung von Ring, Speichen und Kern absichtlich abgeschaltet wurde. Jetzt wird gezaehlt:
  // ein Waechtersiegel muss die Farbe MEHRFACH tragen (Ring, Speichen, Kern, Marke), ein normales
  // ueberhaupt nicht.
  const w = zeichner.abgrundSiegel(G.abgrundSektor(20), 56);
  const n = zeichner.abgrundSiegel(G.abgrundSektor(21), 56);
  const zaehle = (t,f) => (t.match(new RegExp(f,'g'))||[]).length;
  check('13: eine Waechtertiefe faerbt das ganze Siegel, nicht nur die Marke',
    zaehle(w,'#e24b4a') >= 3 && zaehle(n,'#e24b4a') === 0,
    { waechter:zaehle(w,'#e24b4a'), normal:zaehle(n,'#e24b4a') });
  // Und die Farbe muss die Zahl der Mutatoren abbilden - sonst ist sie reine Dekoration.
  const farbeVon = t => (zeichner.abgrundSiegel(G.abgrundSektor(t), 56).match(/#[0-9a-f]{6}/g)||[])
    .filter(f => f !== '#0d1224')[0];
  const einer = farbeVon(2), zweier = farbeVon(7), dreier = farbeVon(17);
  check('13: die Siegelfarbe unterscheidet ein, zwei und drei Mutatoren',
    einer && zweier && dreier && new Set([einer, zweier, dreier]).size === 3,
    { einMutator:einer, zwei:zweier, drei:dreier });
  // Profil: Marken fuer jeden Waechter bis zum naechsten Ziel, keine kaputten Zahlen.
  const profil = zeichner.abgrundTiefenprofil(23, 24);
  check('13: das Tiefenprofil zeichnet die Waechter als Marken',
    /^<svg /.test(profil) && !/undefined|NaN/.test(profil) &&
    (profil.match(/<path d="M[\d.]+ 20 L/g)||[]).length >= 3,
    { marken:(profil.match(/<path d="M[\d.]+ 20 L/g)||[]).length });
  check('13: auch ohne jeden Tauchgang ergibt das Profil ein gueltiges Bild',
    /^<svg /.test(zeichner.abgrundTiefenprofil(0, 1)) && !/NaN/.test(zeichner.abgrundTiefenprofil(0, 1)));
}
check('13: die Sektorkarte zeigt Siegel und Profil',
  /abgrundSiegel\(sektor, 56\)/.test(fnAus('renderAbgrundBox')) &&
  /abgrundTiefenprofil\(a\.best\|\|0, tiefe\)/.test(fnAus('renderAbgrundBox')));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
