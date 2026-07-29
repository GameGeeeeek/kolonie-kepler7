// Tiefenflotte, Staffel I (28.07.2026, v8.337.0, Roadmap Phase 4a).
//
// Lotsenboot, Kessel, Bergungskran. Das tiefste System des Spiels hatte kein eigenes Geraet - man
// tauchte mit derselben Flotte ab, mit der man PvP spielt.
//
// DIE TRENNUNG IST DER GANZE PUNKT und Abschnitt 2 ist deshalb der wichtigste Abschnitt hier.
//
// Die Roadmap schlug vor, attackPower() einen Parameter zu geben, wer der Gegner ist. Das TRAEGT
// NICHT: attackPower() ist serverseitig in computeAttackPower() gespiegelt (der Kommentar dort sagt
// ausdruecklich, dass das den server-autoritativen PvP-Kampf mit der Client-Vorschau in Deckung
// haelt), und der Server rechnet die PvP-Kraft selbst aus der Flotte. Ein Client-Parameter aendert
// daran nichts - man haette drei Schiffe gebaut, die im PvP zaehlen und aus Bergungsgut bezahlt
// werden. Die Roadmap nennt genau das "den schlimmsten denkbaren Ausgang".
//
// Der tragfaehige Weg stand schon im Code: ATTACK_SHIP_KEYS ist eine ausdrueckliche POSITIVLISTE.
// Wer nicht drinsteht, taucht in keiner Angriffs- oder Verteidigungsrechnung auf - weder hier noch
// auf dem Server, der unbekannte Schluessel ohnehin ignoriert. Die Trennung ist damit nicht
// behauptet, sondern baulich unmoeglich zu verletzen, und sie braucht keine Backend-Aenderung.
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
const DREI = ['lotsenboot','kessel','bergungskran'];

// ---- 1) Die drei Schiffe (CLAUDE.md Regel 7) ----
const shipBlock = arrAus('SHIP_DEFS');
const ICON_KEYS = new Set(Array.from(js.matchAll(/^\s{4}([a-z][a-z0-9_]*): `<svg/gm)).map(m=>m[1]));
const HULL_KEYS = new Set(Array.from(js.matchAll(/^\s{6}([a-z][a-z0-9_]*):\s*\{ pts:/gm)).map(m=>m[1]));
for (const k of DREI){
  const m = shipBlock.match(new RegExp("\\{ key:'"+k+"'[\\s\\S]{0,900}?\\}, *\\n"));
  check('1: '+k.padEnd(13)+' ist angelegt', !!m);
  if (!m) continue;
  const e = m[0];
  check('1: '+k.padEnd(13)+' hat ein gezeichnetes Schiffs-Icon', ICON_KEYS.has('ship_'+k));
  check('1: '+k.padEnd(13)+' hat einen eigenen Rumpf (Mini-Icon der Flottenliste)', HULL_KEYS.has(k));
  const desc = (e.match(/desc:'((?:[^'\\]|\\.)*)'/)||[])[1] || '';
  check('1: '+k.padEnd(13)+' hat eine vollstaendige Beschreibung', desc.length >= 150, { laenge:desc.length });
  check('1: '+k.padEnd(13)+' ist ueber die Rekordtiefe freigeschaltet', /tiefe:\d+/.test(e), (e.match(/tiefe:\d+/)||[])[0]);
  check('1: '+k.padEnd(13)+' kostet Bergungsgut', /bergung: tiefenschiffKosten/.test(e));
  // atk:0 ist die zweite Sicherung: Wer die Schiffe spaeter doch in ATTACK_SHIP_KEYS aufnaehme,
  // bekaeme dadurch keine stille Kampfkraft geschenkt.
  check('1: '+k.padEnd(13)+' traegt atk:0 als zweite Sicherung', /atk:0/.test(e));
}

// ---- 2) DIE TRENNUNG ----
const ATTACK_KEYS = new Function('return '+arrAus('ATTACK_SHIP_KEYS'))();
check('2: die Positivliste ist ueberhaupt eine Liste', Array.isArray(ATTACK_KEYS) && ATTACK_KEYS.length > 15, ATTACK_KEYS.length);
check('2: KEINES der drei steht in ATTACK_SHIP_KEYS - damit kann es im PvP gar nicht zaehlen',
  DREI.every(k => !ATTACK_KEYS.includes(k)), DREI.filter(k => ATTACK_KEYS.includes(k)));
// Die Gegenprobe: Die Liste muss die richtigen Schiffe weiterhin enthalten, sonst haette ich
// beim Einfuegen etwas kaputtgemacht und der Test waere aus dem falschen Grund gruen.
check('2: die vorhandenen Kampfschiffe stehen weiterhin darin',
  ['jaeger','schlachtschiff','frachter','leerenjaeger'].every(k => ATTACK_KEYS.includes(k)));
// Und keine der Kampf-/Verteidigungsfunktionen darf die drei namentlich kennen.
for (const fn of ['attackPowerRaw','defenseCombatBonusRaw','defensePower','shipDefenseContribution']){
  const q = fnAus(fn);
  const drin = DREI.filter(k => q.includes("'"+k+"'"));
  check('2: '+fn.padEnd(24)+' kennt keins der drei Schiffe', drin.length === 0, drin);
}
// defWeight:0 - der dritte Riegel. shipDefenseContribution summiert ueber defWeight; eine
// versehentliche 1 dort waere Verteidigungskraft im PvP, ohne dass irgendwo ein Name faellt.
for (const k of DREI){
  const e = shipBlock.match(new RegExp("\\{ key:'"+k+"'[\\s\\S]{0,900}?\\}, *\\n"))[0];
  check('2: '+k.padEnd(13)+' traegt defWeight:0 (kein stiller Verteidigungsbeitrag)', /defWeight:0/.test(e));
}

// ---- 3) Freischaltung ueber die Rekordtiefe, ausgefuehrt ----
const SRM = new Function('state', fnAus('shipRequirementsMet')+'; return shipRequirementsMet;');
const darf = (best, forschung, def) => SRM({ abgrund:{ best }, research: forschung })(def);
const probe = { requires:[{key:'rsingularitaet',level:1}], tiefe:15 };
check('3: ohne Rekordtiefe kein Schiff, auch mit Forschung', darf(0, { rsingularitaet:1 }, probe) === false);
check('3: knapp darunter noch nicht', darf(14, { rsingularitaet:1 }, probe) === false);
check('3: genau auf der Tiefe schon', darf(15, { rsingularitaet:1 }, probe) === true);
check('3: tiefer erst recht', darf(80, { rsingularitaet:1 }, probe) === true);
// Die Tiefe ERSETZT die Forschung nicht - sonst waere der Abgrund selbst kein Gate mehr.
check('3: ohne die Forschung reicht auch die Tiefe nicht', darf(80, {}, probe) === false);
check('3: Schiffe ohne tiefe-Feld sind unberuehrt (die 31 vorhandenen)',
  darf(0, { rleere:5 }, { requires:[{key:'rleere',level:5}] }) === true);
check('3: ein Spielstand ohne Abgrund-Objekt stuerzt nicht ab',
  SRM({ research:{ rsingularitaet:1 } })(probe) === false);

// ---- 4) Bergungsgut als Kostenschluessel ----
// Der Code sagt selbst: wer einen neuen Kostenschluessel einfuehrt, muss ihn in
// costAmountAvailable() UND in pay() kennen - der Kredit-Fall war bis v8.298.26 halb verdrahtet
// und machte einen ganzen Bauposten unbezahlbar.
const CAA = new Function('state', fnAus('costAmountAvailable')+'; return costAmountAvailable;');
const hab = (st, r) => CAA(st)(r);
check('4: Bergungsgut wird aus state.abgrund gelesen, nicht aus state.resources',
  hab({ abgrund:{ bergung:250 }, resources:{}, credits:0 }, 'bergung') === 250);
check('4: ohne Abgrund-Objekt sind es 0 statt undefined',
  hab({ resources:{}, credits:0 }, 'bergung') === 0);
check('4: Kredite und Ressourcen funktionieren unveraendert',
  hab({ credits:99, resources:{ erz:7 }, abgrund:{} }, 'credits') === 99 &&
  hab({ credits:0, resources:{ erz:7 }, abgrund:{} }, 'erz') === 7);
check('4: pay() kennt den Schluessel ebenfalls (sonst NaN im Spielstand)',
  /r === 'bergung'/.test(fnAus('pay')));
check('4: pay() faellt nicht unter null (ein negativer Wert liesse das Backend den Save ablehnen)',
  /Math\.max\(0, \(a\.bergung\|\|0\) - amt\)/.test(fnAus('pay')));
// Die Preise muessen mit der Stueckzahl steigen, wie bei allen anderen Schiffen.
const TK = new Function('TIEFENFLOTTE', fnAus('tiefenschiffKosten')+'; return tiefenschiffKosten;')(
  new Function('return '+js.slice(js.indexOf('{', js.indexOf('const TIEFENFLOTTE')), js.indexOf('};', js.indexOf('const TIEFENFLOTTE'))+1))());
check('4: jedes der drei hat einen Preis > 0', DREI.every(k => TK(k,1) > 0), DREI.map(k=>k+':'+TK(k,1)));
check('4: 100 Stueck kosten mehr als das 100-fache des ersten (Staffelung greift)',
  TK('kessel',100) > TK('kessel',1)*100, { einzeln:TK('kessel',1), hundert:TK('kessel',100) });
check('4: ein unbekanntes Schiff kostet 0 statt NaN', TK('gibtsnicht',5) === 0);

// ---- 5) Die drei Wirkungen, ausgefuehrt ----
const TB = new Function('TIEFENSCHIFF_WIRKUNG', fnAus('tiefenschiffBonus')+'; return tiefenschiffBonus;')(
  new Function('return '+js.slice(js.indexOf('{', js.indexOf('const TIEFENSCHIFF_WIRKUNG')), js.indexOf('};', js.indexOf('const TIEFENSCHIFF_WIRKUNG'))+1))());
check('5: ohne Schiffe kein Bonus', DREI.every(k => TB({}, k) === 0) && TB(null,'kessel') === 0);
check('5: der Bonus waechst mit der Stueckzahl', TB({kessel:5},'kessel') < TB({kessel:20},'kessel'));
// Deckel an absurder Stueckzahl gemessen - mit realistischen Zahlen wuerde die Pruefung nie
// fehlschlagen und bewiese nichts.
check('5: jeder Bonus ist gedeckelt, auch bei 100.000 Schiffen',
  DREI.every(k => TB({[k]:100000}, k) === TB({[k]:1e9}, k) && TB({[k]:1e9}, k) < 1),
  DREI.map(k => k+':'+TB({[k]:1e9},k)));
check('5: ein Schiff zaehlt nur fuer seine eigene Wirkung', TB({kessel:50},'lotsenboot') === 0);

// Anflugdauer: Lotsenboot verkuerzt, Vorschau und Start MUESSEN dieselbe Funktion benutzen.
const AD = new Function('tiefenschiffBonus, ABGRUND_MAX_FLUG_SEK', fnAus('abgrundAnflugdauer')+'; return abgrundAnflugdauer;')(TB, 4*3600);
check('5: ohne Lotsenboot bleibt die Dauer wie bisher', AD(10, 1, {}) === Math.round(240+10*20));
check('5: mit Lotsenboot wird sie kuerzer', AD(10, 1, {lotsenboot:10}) < AD(10, 1, {}),
  { ohne:AD(10,1,{}), mit:AD(10,1,{lotsenboot:10}) });
check('5: sie faellt nie unter die Untergrenze von 120 Sekunden', AD(1, 0.1, {lotsenboot:1e6}) >= 120);
check('5: und nie ueber die Obergrenze', AD(100000, 5, {}) === 4*3600);
check('5: Vorschau und Start rechnen mit DERSELBEN Funktion und der Flotte',
  (js.match(/abgrundAnflugdauer\(tiefe, sektor\.mods\.dur, flotte\)/g)||[]).length === 2,
  { vorkommen:(js.match(/abgrundAnflugdauer\(tiefe, sektor\.mods\.dur, flotte\)/g)||[]).length });

// Kessel und Kran an ihren Verrechnungsstellen.
check('5: der Kessel senkt die Verluste multiplikativ, nicht in derselben Gruppe',
  /\* \(1 - kesselSchutz\)/.test(js));
check('5: der Kran traegt eigenen Laderaum, ohne fleetCargoCapacity anzufassen',
  /kraene \* CARGO_PER_BERGUNGSKRAN/.test(js) && !/bergungskran/.test(fnAus('fleetCargoCapacity')));
check('5: und hebt zusaetzlich die geborgene Menge',
  /abgrundKanalBonus\('beute'\) \+ tiefenschiffBonus\(m\.composition \|\| fleet, 'bergungskran'\)/.test(js));
check('5: das Lotsenboot erweitert die Sondenreichweite',
  /\+ lotsenbootSicht\(\)/.test(js) && /f\.lotsenboot\|\|0\) > 0\)? \? 1 : 0/.test(fnAus('lotsenbootSicht')));

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
