// Tiefenflotte, Staffel I (v8.337.0, Phase 4a), II (v8.338.0, Phase 4b) und III (v8.339.0, 4c).
//
// Staffel I: Lotsenboot, Kessel, Bergungskran - sie machen den Abstieg MACHBAR.
// Staffel II: Presslufthai, Ankerwerfer, Echoschnitter - sie machen ihn STEUERBAR, indem sie gegen
// die Mutatoren des Sektors arbeiten.
// Staffel III: Bannschiff, Nullkiel, Grundgaenger - sie gehen die drei HAERTEN an: den Waechter,
// den Mutator, den man sich nicht aussuchen kann, und den Wiederholungsabschlag.
// Alle neun unterliegen denselben Riegeln (Abschnitt 1+2).
//
// Das tiefste System des Spiels hatte kein eigenes Geraet - man tauchte mit derselben Flotte ab,
// mit der man PvP spielt.
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
const { SPIELDATEI } = require('./lib/umgebung');
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
const DREI_II = ['presslufthai','ankerwerfer','echoschnitter'];
const DREI_III = ['bannschiff','nullkiel','grundgaenger'];
// Abschnitt 1 und 2 gelten fuer ALLE Staffeln. Waeren sie auf Staffel I beschraenkt geblieben,
// haetten spaetere Staffeln Schiffe ohne Icon, ohne Beschreibung und ohne PvP-Riegel einschleusen
// koennen, ohne dass ein einziger Test rot wird - genau der Fehlertyp, den dieses Projekt kennt.
const ALLE = DREI.concat(DREI_II).concat(DREI_III);
// Der Nullkiel ist die einzige Ausnahme vom gleitenden Bonusmuster: Seine Wirkung ist binaer
// (ein Mutator faellt weg oder nicht), er steht deshalb nicht in TIEFENSCHIFF_WIRKUNG. Er MUSS
// aus den gleitenden Pruefungen heraus - sonst waeren sie fuer ihn gruen, ohne etwas zu pruefen:
// tiefenschiffBonus() liefert fuer unbekannte Schluessel 0, und "0 === 0 und 0 < 1" haelt jede
// Deckelpruefung aus. Abschnitt 7 prueft ihn stattdessen an seiner Schwelle.
const GLEITEND = ALLE.filter(k => k !== 'nullkiel');

// ---- 1) Die sechs Schiffe (CLAUDE.md Regel 7) ----
const shipBlock = arrAus('SHIP_DEFS');
const ICON_KEYS = new Set(Array.from(js.matchAll(/^\s{4}([a-z][a-z0-9_]*): `<svg/gm)).map(m=>m[1]));
const HULL_KEYS = new Set(Array.from(js.matchAll(/^\s{6}([a-z][a-z0-9_]*):\s*\{ pts:/gm)).map(m=>m[1]));
check('1: alle drei Staffeln sind vollzaehlig', ALLE.length === 9, ALLE.length);
for (const k of ALLE){
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
check('2: KEINES der neun steht in ATTACK_SHIP_KEYS - damit kann es im PvP gar nicht zaehlen',
  ALLE.every(k => !ATTACK_KEYS.includes(k)), ALLE.filter(k => ATTACK_KEYS.includes(k)));
// Die Gegenprobe: Die Liste muss die richtigen Schiffe weiterhin enthalten, sonst haette ich
// beim Einfuegen etwas kaputtgemacht und der Test waere aus dem falschen Grund gruen.
check('2: die vorhandenen Kampfschiffe stehen weiterhin darin',
  ['jaeger','schlachtschiff','frachter','leerenjaeger'].every(k => ATTACK_KEYS.includes(k)));
// Und keine der Kampf-/Verteidigungsfunktionen darf die drei namentlich kennen.
for (const fn of ['attackPowerRaw','defenseCombatBonusRaw','defensePower','shipDefenseContribution']){
  const q = fnAus(fn);
  const drin = ALLE.filter(k => q.includes("'"+k+"'"));
  check('2: '+fn.padEnd(24)+' kennt keins der neun Schiffe', drin.length === 0, drin);
}
// Der Presslufthai ist der heikelste Fall der ganzen Trennung: Er ist das EINZIGE Tiefenschiff mit
// Kampfkraft. Seine Wirkung darf deshalb ausschliesslich in abgrundKampfkraft() liegen - die
// Funktion wird nur im Abgrund gerufen und ist serverseitig nicht gespiegelt.
{
  const stellen = (js.match(/tiefenschiffBonus\([^)]*'presslufthai'\)/g)||[]).length;
  check('2: der Presslufthai wirkt an genau EINER Stelle', stellen === 1, { stellen });
  check('2: und diese Stelle ist abgrundKampfkraft()',
    fnAus('abgrundKampfkraft').includes("'presslufthai'"));
}
// defWeight:0 - der dritte Riegel. shipDefenseContribution summiert ueber defWeight; eine
// versehentliche 1 dort waere Verteidigungskraft im PvP, ohne dass irgendwo ein Name faellt.
for (const k of ALLE){
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
check('4: jedes der neun hat einen Preis > 0', ALLE.every(k => TK(k,1) > 0), ALLE.map(k=>k+':'+TK(k,1)));
// Staffel II wird spaeter freigeschaltet und muss deshalb auch teurer sein als Staffel I - sonst
// waere das tiefere Gate eine reine Formalitaet.
check('4: das billigste Schiff der Staffel II kostet mehr als das teuerste der Staffel I',
  Math.min(...DREI_II.map(k=>TK(k,1))) > Math.max(...DREI.map(k=>TK(k,1))),
  { staffelI:DREI.map(k=>TK(k,1)), staffelII:DREI_II.map(k=>TK(k,1)) });
/* Bis zum 18.08.2026 stand hier "100 Stueck kosten mehr als das 100-fache des ersten
   (Staffelung greift)". Die Tiefenflotte hatte eine EIGENE Mengenskalierung, die scaledShipCost
   gar nicht kannte: `basis * n * (1 + 0,004*(n-1))`. Weil costFn JE STUECK mit der laufenden
   Nummer gerufen wird, multiplizierte das `* n` den STUECKPREIS mit dem Bestand - das 25.
   Lotsenboot kostete 19.161 statt 750, der 25. Nullkiel 239.550, und das bei einem Schiff, das
   seine Wirkung ueberhaupt erst ab 25 Stueck entfaltet. Der Kommentar daneben behauptete
   "dieselbe Staffelung wie bei allen anderen Schiffen"; sie war um Groessenordnungen haerter.
   Jetzt gilt der Basiswert je Stueck. Geprueft wird die neue Regel schaerfer als die alte:
   nicht "steigt kaum", sondern ueber den ganzen Bereich IDENTISCH. */
check('4: der Stueckpreis haengt nicht mehr vom Bestand ab - ueber den ganzen Bereich identisch',
  [1,2,25,100,1000].every(n => TK('kessel',n) === TK('kessel',1)),
  { gemessen: [1,2,25,100,1000].map(n => n+':'+TK('kessel',n)) });
check('4: ein unbekanntes Schiff kostet 0 statt NaN', TK('gibtsnicht',5) === 0);

// ---- 5) Die drei Wirkungen, ausgefuehrt ----
const TB = new Function('TIEFENSCHIFF_WIRKUNG', fnAus('tiefenschiffBonus')+'; return tiefenschiffBonus;')(
  new Function('return '+js.slice(js.indexOf('{', js.indexOf('const TIEFENSCHIFF_WIRKUNG')), js.indexOf('};', js.indexOf('const TIEFENSCHIFF_WIRKUNG'))+1))());
check('5: ohne Schiffe kein Bonus', GLEITEND.every(k => TB({}, k) === 0) && TB(null,'kessel') === 0);
check('5: der Bonus waechst mit der Stueckzahl', TB({kessel:5},'kessel') < TB({kessel:20},'kessel'));
// Deckel an absurder Stueckzahl gemessen - mit realistischen Zahlen wuerde die Pruefung nie
// fehlschlagen und bewiese nichts.
check('5: jeder Bonus ist gedeckelt, auch bei 100.000 Schiffen',
  GLEITEND.every(k => TB({[k]:100000}, k) === TB({[k]:1e9}, k) && TB({[k]:1e9}, k) < 1),
  GLEITEND.map(k => k+':'+TB({[k]:1e9},k)));
// Die Gegenprobe zur Ausnahme: JEDES gleitende Schiff muss auch wirklich einen Bonus liefern.
// Ohne diese Zeile koennte ein Schiff aus TIEFENSCHIFF_WIRKUNG herausfallen und die Deckelpruefung
// darueber bliebe still gruen.
check('5: und jeder gleitende Bonus ist bei genug Schiffen auch groesser als null',
  GLEITEND.every(k => TB({[k]:1000}, k) > 0), GLEITEND.filter(k => !(TB({[k]:1000},k) > 0)));
check('5: ein Schiff zaehlt nur fuer seine eigene Wirkung', TB({kessel:50},'lotsenboot') === 0);

// Anflugdauer: Lotsenboot verkuerzt, Vorschau und Start MUESSEN dieselbe Funktion benutzen.
// officerBonus kam mit v8.342.0 dazu (Navigator wirkt jetzt auch auf den Abgrund-Anflug). Hier eine
// Attrappe mit 0: Dieser Abschnitt misst die SCHIFFE. Der Navigator hat seinen eigenen Nachweis
// weiter unten, wo er ausdruecklich hochgedreht wird.
// abgrundRissKuerzung kam in v8.343.0 dazu (Leerenriss verkuerzt den Anflug). Hier ueberall fest
// auf 0: Dieser Test misst Lotsenboot, Ankerwerfer und Navigator, nicht die Stroemung - die hat
// ihren eigenen Nachweis in test_abgrundbezug.js, Abschnitt 8.
const AD = new Function('tiefenschiffBonus, ABGRUND_MAX_FLUG_SEK, officerBonus, abgrundRissKuerzung', fnAus('abgrundAnflugdauer')+'; return abgrundAnflugdauer;')(TB, 4*3600, () => 0, () => 0);
// Navigator-Ausweitung (v8.342.0): derselbe Offizier, der oben die Flugzeit senkt, wirkt jetzt auch
// unten. Geprueft mit einer Attrappe, die einen echten Bonus liefert.
{
  const ADnav = new Function('tiefenschiffBonus, ABGRUND_MAX_FLUG_SEK, officerBonus, abgrundRissKuerzung', fnAus('abgrundAnflugdauer')+'; return abgrundAnflugdauer;')(TB, 4*3600, () => 0.2, () => 0);
  check('5: der Navigator verkuerzt den Abgrund-Anflug', ADnav(30, 1, {}) < AD(30, 1, {}),
    { ohne:AD(30,1,{}), mit:ADnav(30,1,{}) });
  const ADmax = new Function('tiefenschiffBonus, ABGRUND_MAX_FLUG_SEK, officerBonus, abgrundRissKuerzung', fnAus('abgrundAnflugdauer')+'; return abgrundAnflugdauer;')(TB, 4*3600, () => 9, () => 0);
  check('5: und ist bei der Haelfte gedeckelt wie in der normalen Flugzeitrechnung',
    ADmax(30, 1, {}) === Math.round(AD(30,1,{}) * 0.5), { gedeckelt:ADmax(30,1,{}), halb:Math.round(AD(30,1,{})*0.5) });
}
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
// Seit v8.343.0 steht die Beute-Formel in abgrundBeuteFaktor() statt zweimal inline - deshalb
// wird hier die FUNKTION geprueft und zusaetzlich, dass Vorschau und Abrechnung beide sie rufen.
// Vorher hatten sie je eine eigene Zeile, und die der Vorschau kannte den Kran gar nicht.
check('5: und hebt zusaetzlich die geborgene Menge',
  /abgrundKanalBonus\('beute'\) \+ tiefenschiffBonus\(flotte, 'bergungskran'\)/.test(fnAus('abgrundBeuteFaktor')));
// Die Zahl ist eine Untergrenze, keine feste Groesse: Seit dem Ballastspiegel (v8.356.0) ruft auch
// der Niederlagen-Zweig die Funktion, um die gerettete Teilbeute zu rechnen - ein vierter, richtiger
// Aufrufer. Worauf es ankommt, ist die Eigenschaft dahinter: dass die Formel genau EINMAL im Code
// steht und jede Stelle sie holt, statt sie abzuschreiben. Das prueft die zweite Zeile.
check('5: Vorschau und Abrechnung holen die Beute aus derselben Funktion',
  (js.match(/abgrundBeuteFaktor\(/g)||[]).length >= 3);
check('5: und die Formel steht nur an dieser einen Stelle',
  (js.match(/abgrundKanalBonus\('beute'\)/g)||[]).length === 1);
check('5: das Lotsenboot erweitert die Sondenreichweite',
  /\+ lotsenbootSicht\(\)/.test(js) && /f\.lotsenboot\|\|0\) > 0\)? \? 1 : 0/.test(fnAus('lotsenbootSicht')));

// ---- 6) Staffel II: die drei Gegenmittel, ausgefuehrt ----
// Ankerwerfer. Er daempft den UEBERSCHUSS ueber 1, nicht den Faktor selbst. Das ist der ganze
// Entwurf und deshalb hier in beide Richtungen geprueft: Ein verlaengernder Mutator verliert einen
// Teil seiner Wirkung, ein VERKUERZENDER bleibt unangetastet. Haette ich stattdessen dur * (1-x)
// gerechnet, waere die zweite Zeile rot - und der Spieler haette mit einem gebauten Schiff bei
// einem guenstigen Sektor plötzlich LAENGER geflogen.
{
  const OHNE = {}, MIT = { ankerwerfer:50 };
  check('6: ein verlaengernder Mutator (dur 1.6) wird gedaempft', AD(30, 1.6, MIT) < AD(30, 1.6, OHNE),
    { ohne:AD(30,1.6,OHNE), mit:AD(30,1.6,MIT) });
  check('6: aber nie unter die normale Flugzeit - er nimmt nur den Aufschlag',
    AD(30, 1.6, MIT) >= AD(30, 1, OHNE), { gedaempft:AD(30,1.6,MIT), normal:AD(30,1,OHNE) });
  check('6: ein VERKUERZENDER Mutator (dur 0.6) bleibt unberuehrt', AD(30, 0.6, MIT) === AD(30, 0.6, OHNE),
    { ohne:AD(30,0.6,OHNE), mit:AD(30,0.6,MIT) });
  check('6: ohne Mutator aendert der Ankerwerfer gar nichts', AD(30, 1, MIT) === AD(30, 1, OHNE));
  check('6: Lotsenboot und Ankerwerfer wirken zusammen',
    AD(30, 1.6, { lotsenboot:20, ankerwerfer:50 }) < Math.min(AD(30,1.6,{lotsenboot:20}), AD(30,1.6,MIT)));
  // Der Ankerwerfer muss ALLE vier verlaengernden Mutatoren erfassen. Er kennt bewusst keinen
  // Namen - diese Probe stellt sicher, dass die Namenlosigkeit auch traegt.
  for (const dur of [1.3, 1.35, 1.4, 1.6]){
    check('6: Mutator mit dur '+dur+' wird erfasst', AD(40, dur, MIT) < AD(40, dur, OHNE));
  }
}
// Presslufthai: der einzige Beitrag im Spiel, der mit der TIEFE waechst.
{
  const AK = new Function(
    'abgrundKanalBonus, abgrundSchiffsmodul, fleetDiversityMult, FLEET_BALANCE_MAX_BONUS, tiefenschiffBonus, ABGRUND_KRAFT_DECKEL, state',
    fnAus('abgrundKampfkraft')+'; return abgrundKampfkraft;'
  )(()=>0, ()=>0, ()=>1, 1, TB, 2.0, {});
  const sek = t => ({ tiefe:t, mutatoren:[], mods:{ atk:1 } });
  const HAI = { presslufthai:60 };
  check('6: ohne Presslufthai ist die Kampfkraft unveraendert', AK(1000, sek(80), {}) === 1000);
  check('6: mit ihm steigt sie', AK(1000, sek(80), HAI) > 1000, { tief:AK(1000,sek(80),HAI) });
  check('6: und zwar in TIEFE 80 staerker als in Tiefe 20',
    AK(1000, sek(80), HAI) > AK(1000, sek(20), HAI),
    { t20:AK(1000,sek(20),HAI), t80:AK(1000,sek(80),HAI) });
  check('6: ab Tiefe 80 ist der Ortsfaktor voll - tiefer bringt keinen weiteren Sprung',
    AK(1000, sek(80), HAI) === AK(1000, sek(100), HAI));
  // Der Deckel wird an SEINEM EIGENEN Anteil nicht sichtbar - sein Wirkungsdeckel (0,50) liegt weit
  // unter ABGRUND_KRAFT_DECKEL (2,0). Der Punkt ist ein anderer: Er muss IN der gemeinsamen Gruppe
  // liegen. Deshalb hier ein zweiter Aufbau, bei dem die uebrigen Kanaele die Gruppe schon fast
  // fuellen - kaeme der Hai als eigener Faktor obendrauf, staende hier mehr als der Deckel.
  const AK_VOLL = new Function(
    'abgrundKanalBonus, abgrundSchiffsmodul, fleetDiversityMult, FLEET_BALANCE_MAX_BONUS, tiefenschiffBonus, ABGRUND_KRAFT_DECKEL, state',
    fnAus('abgrundKampfkraft')+'; return abgrundKampfkraft;'
  )(()=>1.9, ()=>0, ()=>1, 1, TB, 2.0, {});
  check('6: sein Beitrag steckt im gemeinsamen Deckel, nicht daneben',
    AK_VOLL(1000, sek(100), HAI) === 1000 * (1 + 2.0),
    { mitHai:AK_VOLL(1000, sek(100), HAI), ohneHai:AK_VOLL(1000, sek(100), {}) });
  check('6: die Gegenprobe - ohne ihn liegt die Gruppe noch unter dem Deckel',
    AK_VOLL(1000, sek(100), {}) === 1000 * (1 + 1.9));
}
// Echoschnitter: mehr Splitter, in DERSELBEN additiven Gruppe wie Werkstatt und Reliquien.
// Auch diese Gruppe steht seit v8.343.0 in einer Funktion (abgrundSplitterFaktor) - mit dem
// Tiefenhafen als viertem Summanden. Entscheidend bleibt: EINE Summe, kein zweiter Faktor daneben.
check('6: der Echoschnitter liegt in der additiven Splitter-Gruppe, nicht als eigener Faktor',
  /1 \+ abgrundKanalBonus\('splitter'\) \+ tiefenschiffBonus\(flotte, 'echoschnitter'\) \+ hafen/.test(fnAus('abgrundSplitterFaktor')));
check('6: und wirkt an genau einer Stelle',
  (js.match(/tiefenschiffBonus\([^)]*'echoschnitter'\)/g)||[]).length === 1);
check('6: Vorschau und Abrechnung holen die Splitter aus derselben Funktion',
  (js.match(/abgrundSplitterFaktor\(/g)||[]).length === 3);
// Die Beute-Zeile daneben darf er NICHT anfassen - dort sitzt der Bergungskran. Zwei Schiffe auf
// denselben Kanal waere die Art Doppelung, die dieses Projekt sonst erst beim Spieler auffaellt.
check('6: die Beute bleibt Sache des Bergungskrans',
  !new RegExp("abgrundKanalBonus\\('beute'\\)[^\\n]*echoschnitter").test(js));

// ---- 7) Staffel III: die drei Haerten, ausgefuehrt ----
// Bannschiff: Kampfkraft NUR gegen Waechter. Die Gegenprobe (ohne Waechter passiert nichts) ist
// hier die wichtigere Haelfte - ein Bannschiff, das ueberall wirkte, waere ein zweiter
// Presslufthai statt eines eigenen Schiffs.
{
  const AK = new Function(
    'abgrundKanalBonus, abgrundSchiffsmodul, fleetDiversityMult, FLEET_BALANCE_MAX_BONUS, tiefenschiffBonus, ABGRUND_KRAFT_DECKEL, state',
    fnAus('abgrundKampfkraft')+'; return abgrundKampfkraft;'
  )(()=>0, ()=>0, ()=>1, 1, TB, 2.0, { abgrund:{ best:200 } });
  const sek = (t, w) => ({ tiefe:t, mutatoren:[], waechter:w||null, mods:{ atk:1 } });
  const BANN = { bannschiff:40 };
  check('7: gegen einen Waechter steigt die Kampfkraft', AK(1000, sek(80,{name:'X'}), BANN) > 1000,
    { mit:AK(1000, sek(80,{name:'X'}), BANN) });
  check('7: ohne Waechter bringt das Bannschiff GAR NICHTS', AK(1000, sek(80), BANN) === 1000,
    { ohneWaechter:AK(1000, sek(80), BANN) });
  // Es gilt bewusst auch in laengst bezwungenen Tiefen - anders als der Waechterbann des
  // Schwerelinie-Moduls. Der Zustand oben hat best:200, die Tiefe 80 ist also laengst bezwungen.
  check('7: es wirkt auch in einer laengst bezwungenen Tiefe',
    AK(1000, sek(80,{name:'X'}), BANN) > 1000);
  check('7: die Tiefe selbst aendert seine Wirkung nicht (anders als beim Presslufthai)',
    AK(1000, sek(20,{name:'X'}), BANN) === AK(1000, sek(90,{name:'X'}), BANN));
}
// Nullkiel: die Schwelle, und der Unterschied zur Bannspule.
{
  const SCHWELLE = zahl('NULLKIEL_SCHWELLE');
  const NA = new Function('NULLKIEL_SCHWELLE', fnAus('nullkielAktiv')+'; return nullkielAktiv;')(SCHWELLE);
  check('7: die Schwelle ist ueberhaupt gesetzt', SCHWELLE > 1, SCHWELLE);
  check('7: knapp darunter wirkt er nicht', NA({ nullkiel: SCHWELLE-1 }) === false);
  check('7: genau auf der Schwelle wirkt er', NA({ nullkiel: SCHWELLE }) === true);
  check('7: ohne Flotte kein Absturz', NA(null) === false && NA({}) === false);

  const SMB = new Function('abgrundKonstellationFuer, ABGRUND_GRENZEN, ABGRUND_BASIS_STAERKE, ABGRUND_STAERKE_MULT, ABGRUND_WAECHTER_STAERKE, ABGRUND_WAECHTER_SPLITTER, abgrundAnflugdauer',
    fnAus('abgrundSektorMitBann')+'; return abgrundSektorMitBann;'
  )(()=>null, { atk:[0.1,10], def:[0.1,10], loot:[0.1,10], shards:[0.1,10], dur:[0.5,2], loss:[0.1,10] }, 100, 1.1, 1.6, 3, ()=>300);
  const roh = { tiefe:10, waechter:null, bergung:8, mutatoren:[
    { key:'a', def:2 }, { key:'b', def:3 }, { key:'c', def:5 } ] };
  const anz = s => s.mutatoren.length;
  check('7: ohne alles bleiben alle drei Mutatoren', anz(SMB(roh, null, false, false)) === 3);
  // DAS ist seine Nische: ein Mutator faellt, OHNE dass eine Gegenmassnahme gewaehlt wurde.
  check('7: der Nullkiel streicht einen Mutator OHNE gewaehlte Gegenmassnahme',
    anz(SMB(roh, null, false, true)) === 2, { rest:anz(SMB(roh, null, false, true)) });
  // Die Bannspule kann das ausdruecklich NICHT - sie ist ein zweiter Bann, kein erster.
  check('7: die Bannspule allein streicht weiterhin nichts',
    anz(SMB(roh, null, true, false)) === 3);
  check('7: mit gewaehlter Gegenmassnahme faellt einer', anz(SMB(roh, 'b', false, false)) === 2);
  check('7: Gegenmassnahme + Kiel streichen zwei', anz(SMB(roh, 'b', false, true)) === 1);
  check('7: Gegenmassnahme + Kiel + Spule streichen drei', anz(SMB(roh, 'b', true, true)) === 0);
  // Deterministisch: derselbe Aufruf muss denselben Sektor liefern. Ein Zufall hier waere genau
  // der Auseinanderlauf von Vorschau und Abrechnung, den der Code an dieser Stelle ausschliesst.
  const w1 = SMB(roh, null, false, true), w2 = SMB(roh, null, false, true);
  check('7: die Auswahl ist deterministisch, nicht zufaellig',
    JSON.stringify(w1.mutatoren) === JSON.stringify(w2.mutatoren),
    { erster:w1.mutatoren.map(m=>m.key), zweiter:w2.mutatoren.map(m=>m.key) });
  check('7: es gibt keinen Zufall in der Bann-Funktion', !/Math\.random/.test(fnAus('abgrundSektorMitBann')));
  // Alle DREI Aufrufstellen muessen den Kiel durchreichen - Start, Vorschau, Abrechnung. Genau
  // hier ist in Phase 1 schon einmal eine Stelle vergessen worden (zwei Sektor-Bauer).
  check('7: alle drei Aufrufstellen reichen den Nullkiel durch',
    (js.match(/abgrundSektorMitBann\([^;]*nullkielAktiv\(/g)||[]).length === 3,
    { stellen:(js.match(/abgrundSektorMitBann\([^;]*nullkielAktiv\(/g)||[]).length });
  check('7: und die Abrechnung nimmt die MITGEFLOGENE Flotte, nicht die daheim',
    /abgrundSektorMitBann\(abgrundSektor\(tiefe\), m\.bann \|\| null, !!m\.spule, nullkielAktiv\(m\.composition \|\| fleet\)\)/.test(js));
}
// Grundgaenger: hebt den Wiederholungsabschlag an - dauerhaft, aber nur teilweise.
{
  const ABSCHLAG = zahl('ABGRUND_WIEDERHOLUNG');
  // state/allianceTechFrac kamen mit der Tiefenkartierung (v8.343.0) dazu - hier ohne Allianz (0),
  // dieser Abschnitt misst den Grundgaenger. Die Technologie hat ihren eigenen Nachweis in
  // test_abgrundbezug.js, Abschnitt 12.
  const WF = new Function('state, ensureAbgrund, ABGRUND_WIEDERHOLUNG, tiefenschiffBonus, allianceTechFrac',
    fnAus('abgrundWiederholungsFaktor')+'; return abgrundWiederholungsFaktor;'
  )({ allianceResearch:{} }, ()=>({ best:100, grund:false }), ABSCHLAG, TB, ()=>0);
  check('7: eine neue Tiefe gibt weiterhin die volle Ausbeute', WF(101, false, {}) === 1);
  check('7: eine wiederholte ohne Grundgaenger den vollen Abschlag', WF(50, false, {}) === ABSCHLAG);
  check('7: mit Grundgaengern wird der Abschlag kleiner', WF(50, false, { grundgaenger:40 }) > ABSCHLAG,
    { ohne:WF(50,false,{}), mit:WF(50,false,{grundgaenger:40}) });
  // Er hebt ihn NIE ganz auf - das kann nur die Grundberuehrung, und die ist einmalig. Ein Schiff,
  // das den Abschlag ganz aufhoebe, haette das Item entwertet.
  check('7: er hebt den Abschlag NIE ganz auf, auch bei absurder Stueckzahl',
    WF(50, false, { grundgaenger:1e9 }) < 1, { extrem:WF(50,false,{grundgaenger:1e9}) });
  check('7: die Grundberuehrung dagegen hebt ihn ganz auf', WF(50, true, {}) === 1);
  // Und die Anzeige muss den TATSAECHLICHEN Faktor nennen, nicht die Konstante - sonst behauptet
  // die Vorschau 35%, waehrend die Abrechnung 70% gibt (CLAUDE.md Regel 6).
  check('7: keine Anzeigestelle nennt mehr die rohe Konstante',
    !/Math\.round\(ABGRUND_WIEDERHOLUNG\*100\)/.test(js));
  check('7: Vorschau und Bericht zeigen beide den tatsaechlichen Faktor',
    (js.match(/Math\.round\(wiederholung\*100\)/g)||[]).length === 2,
    { stellen:(js.match(/Math\.round\(wiederholung\*100\)/g)||[]).length });
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
