// Sechs Abgrund-Gegenstaende und die Handelssperre (28.07.2026, v8.336.0, Roadmap Phase 3).
//
// Der Abgrund liess bis hierher gar keine Gegenstaende fallen - es gab kein Item-Band in seiner
// Fundtabelle. Die sechs neuen loesen bewusst Probleme, die es nur unten gibt.
//
// ZWEI Dinge machen diesen Test wichtiger als eine Inhaltspruefung:
//
//   A) DIE HANDELSSPERRE. Die Roadmap verlangt sie fuer die Gegenstaende - Gegenstaende sind
//      ohnehin nicht handelbar, die Modulboerse fuehrt nur Module. Beim Nachsehen fiel aber auf,
//      dass die zehn ABGRUND-MODULE aus v8.334/8.335 sehr wohl an Mitspieler verkauft werden
//      konnten. Damit waere "nur im Abgrund findbar" nach einer Woche eine Preisfrage gewesen.
//      Der Fundpool aus v8.332.0 fasst das nicht: Er sperrt ZIEHSTELLEN, und eine Boerse zieht
//      nichts - sie reicht Vorhandenes weiter.
//
//   B) DIE VIER VORMERKUNGEN. Bannspule, Waechterruf, Grundberuehrung und (indirekt) das Tiefenlot
//      wirken auf den NAECHSTEN Tauchgang. Sie muessen beim START verbraucht werden und in der
//      Mission mitreisen - sonst gibt ein verlorener Kampf sie zurueck, oder ein spaeterer Fund
//      veraendert einen laufenden Tauchgang rueckwirkend. Genau dieselbe Regel gilt seit v8.324.0
//      fuer die Gegenmassnahme; die vier neuen folgen ihr.
const fs = require('fs');
const path = require('path');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

function fnAus(n){
  const m = js.match(new RegExp('function\\s+'+n+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+n);
  const i = js.indexOf(m[0]);
  let d=0, s=js.indexOf('{', i+m[0].length), k=s;
  for (; k<js.length; k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}
function arrAus(name){
  const i = js.indexOf('const '+name+' = [');
  let d=0, s=js.indexOf('[', i), k=s;
  for (; k<js.length; k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}
const zahl = n => Number((js.match(new RegExp('const '+n+' = ([\\d.]+)'))||[])[1]);

const SECHS = ['ab_tiefenlot','ab_bannspule','ab_rueckholanker','ab_sternenkarte','ab_waechterruf','ab_grundberuehrung'];

// ---- 1) Vollstaendigkeit (Regel 7) ----
// ITEM_DEFS enthaelt Funktionen (activate) und laesst sich nicht als Literal auswerten - deshalb
// hier je Eintrag am Quelltext, aber mit den ECHTEN Feldern, nicht mit einer Wunschliste.
const itemBlock = arrAus('ITEM_DEFS');
const ICON_KEYS = new Set(Array.from(js.matchAll(/^\s{4}([a-z][a-z0-9_]*): `<svg/gm)).map(m=>m[1]));
for (const k of SECHS){
  const m = itemBlock.match(new RegExp("\\{ key:'"+k+"'[\\s\\S]{0,1400}?activate:"));
  check('1: '+k.padEnd(18)+' ist angelegt', !!m);
  if (!m) continue;
  const eintrag = m[0];
  // Gegenstaende fuehren BEIDES, wie die 24 vorhandenen: das gezeichnete Icon liegt unter dem
  // ICONS-Schluessel 'item_'+key (das ist die Konvention, die test_iconabdeckung Abschnitt 11
  // festhaelt), und `icon:` traegt ein ti-*-Symbol als Rueckfall. Wer nur das eine setzt, faellt
  // erst im anderen Test auf - deswegen steht hier beides.
  const icon = (eintrag.match(/icon:'([^']+)'/)||[])[1];
  check('1: '+k.padEnd(18)+' hat ein eigenes gezeichnetes Icon unter item_'+k, ICON_KEYS.has('item_'+k));
  check('1: '+k.padEnd(18)+' hat ein ti-*-Symbol als Rueckfall', /^ti-/.test(icon||''), { icon });
  const desc = (eintrag.match(/desc:'((?:[^'\\]|\\.)*)'/)||[])[1] || '';
  check('1: '+k.padEnd(18)+' vollstaendige Beschreibung', desc.length >= 180, { laenge: desc.length });
  check('1: '+k.padEnd(18)+' Abgrund-Herkunft', /quelle:HERKUNFT_ABGRUND/.test(eintrag));
  // chance:0 wuerde den Eintrag aus JEDEM Pool werfen - auch aus dem Abgrund-Pool (fundPool).
  // Die Herkunft haelt sie schon aus den normalen Quellen heraus; eine 0 hier waere ein toter Eintrag.
  const chance = Number((eintrag.match(/chance:([\d.]+)/)||[])[1]);
  check('1: '+k.padEnd(18)+' hat eine Fundchance > 0 (sonst waere er unfindbar)', chance > 0, { chance });
}
const seltenheiten = SECHS.map(k => (itemBlock.match(new RegExp("key:'"+k+"'[\\s\\S]{0,1400}?rarity:'([a-z]+)'"))||[])[1]);
check('1: die Seltenheiten decken die ganze Spanne ab (selten bis mythisch)',
  new Set(seltenheiten).size >= 4 && seltenheiten.includes('mythisch'), seltenheiten);

// ---- 2) DIE HANDELSSPERRE ----
check('2: es gibt eine Herkunftspruefung fuer die Modulboerse', /function istAbgrundModul/.test(js));
const IAM = new Function('MODULE_DEFS, SHIP_MODULE_DEFS, HERKUNFT_ABGRUND',
  fnAus('istAbgrundModul')+'; return istAbgrundModul;');
const MD = new Function("const HERKUNFT_NORMAL='normal', HERKUNFT_ABGRUND='abgrund'; return "+arrAus('MODULE_DEFS'))();
const SMD = new Function("const HERKUNFT_NORMAL='normal', HERKUNFT_ABGRUND='abgrund'; return "+arrAus('SHIP_MODULE_DEFS'))();
const istAbgrund = IAM(MD, SMD, 'abgrund');
const abgrundStandort = MD.filter(d=>d.quelle==='abgrund').map(d=>d.key);
const abgrundSchiff   = SMD.filter(d=>d.quelle==='abgrund').map(d=>d.key);
check('2: es gibt ueberhaupt Abgrund-Module zu schuetzen',
  abgrundStandort.length >= 4 && abgrundSchiff.length >= 6, { standort:abgrundStandort.length, schiff:abgrundSchiff.length });
check('2: JEDES Abgrund-Standortmodul wird als solches erkannt - in jeder Seltenheit',
  abgrundStandort.every(k => ['gewoehnlich','selten','episch','legendaer'].every(r => istAbgrund(false, k+':'+r))),
  abgrundStandort.filter(k => !istAbgrund(false, k+':episch')));
check('2: JEDES Abgrund-Schiffsmodul wird als solches erkannt',
  abgrundSchiff.every(k => istAbgrund(true, k+':episch')), abgrundSchiff.filter(k=>!istAbgrund(true,k+':episch')));
// Auch die laengere Schluesselform mit Stufe und Substats muss greifen - sonst rutscht ein
// aufgewertetes Modul durch, und genau die sind die wertvollen.
check('2: auch aufgewertete Module mit Stufe und Substats werden erkannt',
  istAbgrund(false, abgrundStandort[0]+':episch:3:atk-5'), abgrundStandort[0]+':episch:3:atk-5');
// Die Gegenprobe ist genauso wichtig: Der normale Modulhandel darf nicht kaputtgehen.
const normal = MD.filter(d => d.quelle !== 'abgrund').map(d=>d.key);
check('2: kein normales Modul wird faelschlich gesperrt (der Handel bleibt, wie er war)',
  normal.every(k => !istAbgrund(false, k+':episch')), normal.filter(k => istAbgrund(false, k+':episch')));
check('2: ein unbekannter Schluessel sperrt nicht (kein Absturz, keine Blockade)',
  istAbgrund(false, 'gibtsnicht:episch') === false && istAbgrund(false, '') === false && istAbgrund(false, null) === false);
// Verdrahtung: das Einstellen selbst UND beide Knoepfe.
check('2: listModuleOnMarket lehnt Abgrund-Module ab', /istAbgrundModul\(isShip, instKey\)/.test(fnAus('listModuleOnMarket')));
check('2: die Ablehnung steht VOR dem Netzaufruf (kein Modul geht in die Treuhand)',
  fnAus('listModuleOnMarket').indexOf('istAbgrundModul') < fnAus('listModuleOnMarket').indexOf('/modulemarket/list'));
check('2: der Boersen-Knopf erscheint bei Standort-Abgrundmodulen gar nicht erst',
  /!istAbgrundModul\(false, instKey\)\?`<button data-offer-module/.test(js));
check('2: und bei Schiffs-Abgrundmodulen ebenso',
  /!istAbgrundModul\(true, instKey\)\?`<button data-offer-shipmodule/.test(js));
// Ehrlichkeit ueber die Reichweite: Die Treuhand liegt serverseitig, ein manipulierter Client kaeme
// vorbei. Der Kommentar muss das sagen, sonst haelt der naechste Durchgang die Sperre fuer dicht.
check('2: der Code sagt, dass die Serverhaelfte noch fehlt',
  /server\.js/.test(js.slice(js.indexOf('function istAbgrundModul')-1200, js.indexOf('function istAbgrundModul'))));

// ---- 3) Die vier Vormerkungen: verbraucht beim START, mitgereist in der Mission ----
const startBlock = js.slice(js.indexOf('const spule = !!a.spule'), js.indexOf('const spule = !!a.spule')+1400);
check('3: Spule, Grundberuehrung und Ruf werden beim START verbraucht',
  /if \(spule\) a\.spule = false;/.test(startBlock) &&
  /if \(grund\) a\.grund = false;/.test(startBlock) &&
  /if \(ruf\)\s+a\.ruf\s+= false;/.test(startBlock), startBlock.split('\n').slice(0,12));
check('3: und reisen in der Mission mit', /composition: flotte, fleetName: sektor\.name, bann, spule, grund, ruf,/.test(js));
check('3: die Aufloesung liest sie AUS DER MISSION, nicht aus dem aktuellen Zustand',
  /abgrundSektorMitBann\(abgrundSektor\(tiefe\), m\.bann \|\| null, !!m\.spule\)/.test(js) &&
  /abgrundWiederholungsFaktor\(tiefe, !!m\.grund\)/.test(js));
// Die Spule braucht einen gewaehlten Bann - sonst haette sie nichts zu streichen und wuerde beim
// Abtauchen still verpuffen.
check('3: ohne gewaehlte Gegenmassnahme wird die Spule NICHT verbraucht',
  /const spule = !!a\.spule && !!bann;/.test(js));

// ---- 4) Bannspule: streicht wirklich einen zweiten Mutator ----
const SMB = new Function('abgrundKonstellationFuer, ABGRUND_GRENZEN, ABGRUND_BASIS_STAERKE, ABGRUND_STAERKE_MULT, ABGRUND_WAECHTER_STAERKE, ABGRUND_WAECHTER_SPLITTER, ABGRUND_MAX_FLUG_SEK, abgrundBergungsgut',
  fnAus('abgrundSektorMitBann')+'; return abgrundSektorMitBann;')(
    () => null,
    new Function('return '+js.slice(js.indexOf('{', js.indexOf('const ABGRUND_GRENZEN')), js.indexOf('};', js.indexOf('const ABGRUND_GRENZEN'))+1))(),
    zahl('ABGRUND_BASIS_STAERKE'), zahl('ABGRUND_STAERKE_MULT'), zahl('ABGRUND_WAECHTER_STAERKE'),
    zahl('ABGRUND_WAECHTER_SPLITTER'), 4*3600, () => 5);
const probeSektor = () => ({ tiefe:20, mutatoren:[{key:'a'},{key:'b'},{key:'c'}], mods:{atk:1,def:1,loot:1,shards:1,dur:1,loss:1}, waechter:null });
check('4: ohne Bann bleibt der Sektor unveraendert', SMB(probeSektor(), null, false).mutatoren.length === 3);
check('4: ein Bann streicht einen Mutator', SMB(probeSektor(), 'b', false).mutatoren.length === 2);
check('4: mit Spule fallen ZWEI', SMB(probeSektor(), 'b', true).mutatoren.length === 1,
  { rest: SMB(probeSektor(), 'b', true).mutatoren.map(m=>m.key) });
check('4: die Spule streicht deterministisch, nicht zufaellig (Vorschau und Kampf muessen gleich rechnen)',
  new Set(Array.from({length:30}, () => SMB(probeSektor(), 'b', true).mutatoren.map(m=>m.key).join())).size === 1);
check('4: bei nur einem Mutator streicht die Spule nichts Zusaetzliches (kein Absturz)',
  SMB({ tiefe:3, mutatoren:[{key:'a'}], mods:{atk:1,def:1,loot:1,shards:1,dur:1,loss:1}, waechter:null }, 'a', true).mutatoren.length === 0);

// ---- 5) Grundberuehrung: hebt den Wiederholungsabschlag auf ----
const WF = new Function('ensureAbgrund, ABGRUND_WIEDERHOLUNG',
  fnAus('abgrundWiederholungsFaktor')+'; return abgrundWiederholungsFaktor;');
const WIED = zahl('ABGRUND_WIEDERHOLUNG');
const wf = (tiefe, best, grund) => WF(() => ({ best, grund:false }), WIED)(tiefe, grund);
check('5: eine neue Tiefe gibt volle Ausbeute', wf(11, 10, false) === 1);
check('5: eine bekannte Tiefe wird abgeschlagen', wf(5, 10, false) === WIED);
check('5: mit Grundberuehrung gibt auch eine bekannte Tiefe volle Ausbeute', wf(5, 10, true) === 1);
check('5: die Funktion liest den Zustand nur, wenn kein Wert mitgegeben wird (Vorschau vs. Mission)',
  /if \(grundAktiv === undefined\) grundAktiv = a\.grund;/.test(js));

// ---- 6) Waechterruf: nur die angesteuerte Tiefe ----
const RUF = new Function('state', fnAus('abgrundRufAktiv')+'; return abgrundRufAktiv;');
const ruf = (tiefe, gewaehlt, aktiv) => RUF({ abgrund:{ ruf:aktiv, tiefe:gewaehlt } })(tiefe);
check('6: ohne Ruf passiert nichts', ruf(7, 7, false) === false);
check('6: mit Ruf wird die ANGESTEUERTE Tiefe zur Waechtertiefe', ruf(7, 7, true) === true);
// Der wichtige Fall: Wuerde der Ruf auf jede Tiefe wirken, waeren Kartenraum und Tiefensonde voller
// Waechter, die es gar nicht gibt - und die Vorschau widerspraeche der Karte.
check('6: alle anderen Tiefen bleiben unberuehrt', ruf(8, 7, true) === false && ruf(6, 7, true) === false);
check('6: ein leerer Spielstand stuerzt nicht ab', RUF({})(1) === false);
check('6: abgrundWaechterDef beruecksichtigt den Ruf', /!abgrundIstWaechter\(tiefe\) && !abgrundRufAktiv\(tiefe\)/.test(js));

// ---- 7) Tiefenlot: Sicht, die von selbst aufgebraucht wird ----
const SR = new Function('abgrundWerkstattBonus, shipModuleBonusFor, ABGRUND_STILLGAENGER_MAX, state',
  fnAus('abgrundSondeReichweite')+'; return abgrundSondeReichweite;');
const sicht = (werkstatt, lotBis, tiefe) => SR(() => werkstatt, () => 0, zahl('ABGRUND_STILLGAENGER_MAX'), { abgrund:{ lotBis, tiefe } })();
check('7: ohne Lot gilt die normale Reichweite', sicht(2, 0, 5) === 2);
check('7: ein frisches Lot reicht zehn Tiefen weit', sicht(0, 15, 5) === 10);
check('7: es schrumpft, waehrend man tiefer kommt', sicht(0, 15, 12) === 3, { r:sicht(0,15,12) });
check('7: am Ende ist es aufgebraucht und die normale Reichweite gilt wieder', sicht(2, 15, 20) === 2);
check('7: Lot und Werkstatt konkurrieren nicht, es gilt der groessere Wert', sicht(3, 15, 14) === 3);

// ---- 8) Fundweg ----
check('8: es gibt einen eigenen Fundweg fuer Abgrund-Gegenstaende', /function grantAbgrundItem/.test(js));
check('8: er zieht ueber den gemeinsamen Pool mit Abgrund-Herkunft',
  /fundPool\(ITEM_DEFS, \{ quelle: HERKUNFT_ABGRUND \}\)/.test(fnAus('grantAbgrundItem')));
check('8: und gewichtet nach Seltenheit (dieselbe Kurve wie bei Expeditionen, keine zweite)',
  /pickWeightedByRarity\(pool/.test(fnAus('grantAbgrundItem')));
const CI = new Function('ABGRUND_ITEM_CHANCE_DECKEL', fnAus('abgrundItemChance')+'; return abgrundItemChance;')(zahl('ABGRUND_ITEM_CHANCE_DECKEL'));
check('8: die Fundchance steigt mit der Tiefe', CI(50,false) > CI(1,false), { t1:CI(1,false), t50:CI(50,false) });
check('8: ein Waechter verdoppelt sie', Math.abs(CI(10,true) - CI(10,false)*2) < 1e-9);
check('8: sie ist gedeckelt - auch in absurder Tiefe', CI(1e6,true) === zahl('ABGRUND_ITEM_CHANCE_DECKEL'));
check('8: Gegenstand und Modul werden GETRENNT gewuerfelt (ein Gegenstand verdraengt keinen Modulfund)',
  js.indexOf('abgrundItemName = grantAbgrundItem(tiefe)') > js.indexOf('abgrundModulName = grantAbgrundModule(tiefe)') &&
  /if \(Math\.random\(\) < abgrundItemChance\(tiefe, !!sektor\.waechter\)\)/.test(js));
check('8: der Bericht nennt einen geborgenen Gegenstand', /Gegenstand geborgen: <strong>/.test(js));

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
