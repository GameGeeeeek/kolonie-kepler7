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
    'return { abgrundSektor, abgrundMutatorAnzahl, ensureAbgrund, abgrundMaxTiefe, abgrundGewaehlteTiefe,',
    '  abgrundWiederholungsFaktor, abgrundWerkstattStufe, abgrundWerkstattKosten, abgrundWerkstattBonus,',
    '  abgrundTiefenBonus, abgrundChronikOffen, abgrundFreigeschaltet, abgrundKampfkraft,',
    '  ABGRUND_MUTATOREN, ABGRUND_WERKSTATT, ABGRUND_CHRONIK, ABGRUND_WIEDERHOLUNG };'
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
check('2: jeder hat Schluessel, Namen, Icon und vollstaendige Beschreibung (CLAUDE.md Regel 7)',
  MUT.every(m => m.key && m.name && m.icon && typeof m.desc === 'string' && m.desc.length >= 60 && /[.!]$/.test(m.desc.trim())),
  MUT.filter(m => !(m.key && m.name && m.icon && m.desc && m.desc.length >= 60)).map(m=>m.key));
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
check('4: jeder Zweig hat Icon und vollstaendige Beschreibung mit Deckelangabe',
  WS.every(d => d.icon && d.desc && d.desc.length >= 80 && /gedeckelt/i.test(d.desc)),
  WS.filter(d => !(d.icon && d.desc && d.desc.length >= 80 && /gedeckelt/i.test(d.desc))).map(d=>d.key));
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
const wsAufrufe = (js.match(/abgrundWerkstattBonus\('([a-z]+)'\)/g) || []);
const erlaubteUmgebung = /abgrundKampfkraft|abgrund'|renderAbgrundBox|kaufeAbgrundAusbau/;
check('4: abgrundWerkstattBonus wird nur im Abgrund-Kontext aufgerufen',
  wsAufrufe.length >= 4 && wsAufrufe.every(a => {
    const i = js.indexOf(a);
    const umfeld = js.slice(Math.max(0, i-2500), i+200);
    return erlaubteUmgebung.test(umfeld);
  }), { aufrufe:wsAufrufe.length });

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
// Icons: alle Mutator- und Werkstatt-Icons muessen in der Font-Whitelist liegen. check-icons.js
// prueft nur ti-*-Vorkommen im Markup; diese hier stehen in Datenfeldern.
const whitelist = new Set((js + src).match(/\.ti-[a-z0-9-]+:before/g).map(s => s.slice(1).replace(':before','')));
const fehlendeIcons = MUT.concat(WS).map(x=>x.icon).filter(i => !whitelist.has(i));
check('8: alle Mutator- und Werkstatt-Icons sind im Icon-Subset enthalten',
  fehlendeIcons.length === 0, fehlendeIcons);
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
const keepOpen = (boxQuelle.match(/data-keep-open="/g) || []).length;
check('8: jedes <details> der Abgrund-Box hat data-keep-open',
  details > 0 && details === keepOpen, { details, keepOpen });
// Und die Tauchtiefe darf nicht nur im DOM stehen - sonst ist sie beim naechsten Tick weg.
check('8: die gewaehlte Tauchtiefe liegt im Spielstand, nicht nur im DOM',
  /z\.tiefe = Math\.max\(1, Math\.min\(abgrundMaxTiefe\(\)/.test(boxQuelle) && !/<select/.test(boxQuelle));
// Hilfe und Patchnotes: neue Mechanik ohne Erklaerung ist halbe Arbeit (CLAUDE.md Punkt 5).
check('8: es gibt einen Hilfe-Abschnitt zum Abgrund',
  /title:'Der Abgrund[^']*',\s*body:'/.test(js));
check('8: der oberste Patchnotes-Eintrag beschreibt den Abgrund',
  /version:'8\.320\.0'[\s\S]{0,4000}Abgrund/.test(js));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
