// Abgrund-Gesamtbilanz (29.07.2026, v8.341.0, Roadmap Phase 6).
//
// Am Ende der Roadmap steht die Frage, die keine Einzelphase beantworten kann: Wie stark ist ein
// voll ausgestatteter Abgrund-Spieler gegenueber einem, der nie abgetaucht ist? Sechs Phasen haben
// je fuer sich sinnvolle Boni eingefuehrt - Werkstatt, Reliquien, zehn Module, sechs Gegenstaende,
// neun Schiffe, der Tiefenbonus. Keine einzige davon konnte sehen, was die anderen tun.
//
// DREI FRAGEN, und die dritte ist die, die man ohne Messung nie beantwortet:
//
//   A) DAS LECK. Ist irgendeine Abgrund-Quelle ueber einen normalen Weg erreichbar? Das ist die
//      Zusage, um die es in dieser ganzen Roadmap geht. Sie wird in tests/test_herkunft.js schon
//      vollstaendig geprueft (Fundpool, Ziehstellen, Handelssperre) - hier steht deshalb nur die
//      Gegenprobe, dass es diesen Test ueberhaupt noch gibt. Ein Leck laesst sich nicht
//      zurueckziehen, ohne Spielern etwas wegzunehmen.
//
//   B) PVP. Keine Abgrund-Quelle darf Angriff oder Verteidigung gegen einen MITSPIELER veraendern -
//      gegen NPCs ausdruecklich schon. Der heikle Fall ist der Nullfeldanker: Er gibt Verteidigung,
//      und zwar an einem STANDORT, nicht im Abgrund. Er ist der einzige Abgrund-Bonus, der das tut.
//
//   C) DER ANREIZ. Faellt der Vorteil eines tief getauchten Kontos unter eine Schwelle, war die
//      ganze Roadmap wirkungslos - und genau das merkt man ohne Messung nie, weil nichts kaputt
//      geht. Es gibt keinen Fehler, den man sieht; es gibt nur ein System, das niemand benutzt.
const fs = require('fs');
const path = require('path');
// Pfad ueber die gemeinsame Quelle, nicht fest verdrahtet: Sonst wird KEPLER_SPIELDATEI
// still ignoriert und eine Gegenprobe liest die ECHTE Datei - sie sieht dann aus wie
// bestanden (CLAUDE.md, Korrektur zu Regel 14).
const { SPIELDATEI } = require('./lib/spieldatei');
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
function objAus(name){
  const i = js.indexOf('const '+name+' = {');
  let d=0, s=js.indexOf('{', i), k=s;
  for (; k<js.length; k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}
const zahl = n => Number((js.match(new RegExp('const '+n+' = ([\\d.]+)'))||[])[1]);

// ---- A) DAS LECK: die Gegenprobe, dass der Herkunfts-Test noch existiert ----
// Bewusst KEINE zweite Umsetzung derselben Pruefung: Zwei Leck-Tests, die dasselbe behaupten,
// laufen beim naechsten Umbau auseinander, und dann glaubt man dem falschen.
{
  const herkunft = path.join(__dirname, 'test_herkunft.js');
  check('A: der Herkunfts-Test existiert weiterhin', fs.existsSync(herkunft));
  const q = fs.existsSync(herkunft) ? fs.readFileSync(herkunft,'utf8') : '';
  check('A: und er prueft weiterhin, dass kein Abgrund-Eintrag im normalen Pool liegt',
    /KEIN Abgrund-Modul liegt im normalen Fundpool/.test(q));
  check('A: und dass es keine direkte Array-Ziehung mehr gibt',
    /keine Stelle zieht mehr direkt aus einem Fundpool-Array/.test(q));
}

// ---- B) PVP: keine Abgrund-Quelle in Angriff oder Verteidigung gegen Spieler ----
const ABGRUND_FUNKTIONEN = [
  'abgrundKanalBonus', 'abgrundWerkstattBonus', 'abgrundReliktBonus',
  'abgrundSchiffsmodul', 'tiefenschiffBonus', 'abgrundKampfkraft', 'abgrundTiefenBonus'
];
for (const fn of ['attackPowerRaw','defenseCombatBonusRaw','defensePower','shipDefenseContribution']){
  const q = fnAus(fn);
  const drin = ABGRUND_FUNKTIONEN.filter(a => q.includes(a));
  check('B: '+fn.padEnd(24)+' ruft keine Abgrund-Funktion', drin.length === 0, drin);
}
// Der Nullfeldanker ist der EINZIGE Abgrund-Bonus, der Verteidigung an einem Standort gibt. Er
// darf ausschliesslich im NPC-Ueberfall wirken. Geprueft wird das an der Zahl der Anwendungsstellen:
// Solange es genau eine gibt und die in executeRaid() liegt, kann er PvP gar nicht erreichen.
{
  // Seit der Phasen-Umstellung (17.08.2026) gibt es ZWEI benannte Aufrufer: die Aufloesung
  // (executeRaid) und die Vorab-Chance im Spaeh-Bericht (resolveRaidScout) - beides dieselbe
  // NPC-Abwehr, einmal gewuerfelt, einmal angekuendigt. PvP erreicht der Anker weiterhin nicht.
  // Ein DRITTER unbenannter Aufrufer laesst die Zaehlung fallen, genau wie vorher.
  const stellen = (js.match(/nullfeldSchub\(/g)||[]).length;   // 1x Definition + 2x Aufruf
  check('B: der Nullfeldanker wird an genau ZWEI benannten Stellen angewandt', stellen === 3, { vorkommen:stellen });
  check('B: Stelle eins liegt im NPC-Ueberfall (executeRaid)',
    fnAus('executeRaid').includes('nullfeldSchub('));
  check('B: Stelle zwei ist die Vorab-Chance des Spaeh-Berichts (resolveRaidScout)',
    fnAus('resolveRaidScout').includes('nullfeldSchub('));
  const NS = new Function('moduleBonusAt, ABGRUND_NULLFELD_DECKEL',
    fnAus('nullfeldSchub')+'; return nullfeldSchub;')(() => 0.8, zahl('ABGRUND_NULLFELD_DECKEL'));
  check('B: er wirkt nur bei Unterzahl - in Ueberzahl gibt er nichts', NS('home', 100, 200) === 0);
  check('B: bei Unterzahl gibt er etwas', NS('home', 400, 100) > 0, { schub:NS('home',400,100) });
  check('B: und ist gedeckelt', NS('home', 1e9, 1) === zahl('ABGRUND_NULLFELD_DECKEL'));
}
// Die Tiefenflotte: dieselbe Positivliste wie in tests/test_tiefenflotte.js, hier nur als
// Gesamtaussage - kein Tiefenschiff steht in ATTACK_SHIP_KEYS.
{
  const ATTACK_KEYS = new Function('return '+arrAus('ATTACK_SHIP_KEYS'))();
  const tiefenschiffe = Array.from(js.matchAll(/\{ key:'([a-z]+)'[^\n]*tiefenschiff:true/g)).map(m=>m[1]);
  check('B: es gibt neun Tiefenschiffe', tiefenschiffe.length === 9, tiefenschiffe.length);
  check('B: KEINES steht in ATTACK_SHIP_KEYS',
    tiefenschiffe.every(k => !ATTACK_KEYS.includes(k)), tiefenschiffe.filter(k=>ATTACK_KEYS.includes(k)));
}

// ---- C) DIE GESAMTBILANZ je Kanal ----
// Gerechnet wird mit den ECHTEN Funktionen und einem voll ausgebauten Konto, nicht mit einer
// nachgebauten Zahlenliste - eine zweite Liste veraltet beim naechsten neuen Bonus stillschweigend.
const WERKSTATT = new Function('ABGRUND_SONDE_MAX', 'return '+arrAus('ABGRUND_WERKSTATT'))(zahl('ABGRUND_SONDE_MAX') || 3);
const RELIKT_DECKEL = new Function('return '+objAus('ABGRUND_RELIKT_DECKEL'))();
const TIEFENSCHIFF = new Function('return '+objAus('TIEFENSCHIFF_WIRKUNG'))();
const KANAL_WERKSTATT = new Function('return '+objAus('ABGRUND_KANAL_WERKSTATT'))();

// Die Obergrenze je Kanal: Werkstatt-Deckel + Relikt-Deckel + was die Tiefenflotte beitraegt.
const werkstattDeckel = kanal => (WERKSTATT.find(d => d.key === KANAL_WERKSTATT[kanal])||{}).deckel || 0;
const FLOTTE_JE_KANAL = {   // welches Schiff zahlt auf welchen Kanal ein
  kraft:    ['presslufthai','bannschiff'],
  verlust:  ['kessel'],
  splitter: ['echoschnitter'],
  beute:    ['bergungskran']
};
const flottenDeckel = kanal => (FLOTTE_JE_KANAL[kanal]||[]).reduce((s,k) => s + ((TIEFENSCHIFF[k]||{}).deckel||0), 0);

const bilanz = {};
for (const kanal of ['kraft','verlust','splitter','beute']){
  bilanz[kanal] = {
    werkstatt: werkstattDeckel(kanal),
    relikte:   RELIKT_DECKEL[kanal] || 0,
    flotte:    flottenDeckel(kanal)
  };
  bilanz[kanal].summe = bilanz[kanal].werkstatt + bilanz[kanal].relikte + bilanz[kanal].flotte;
}
console.log('    (Bilanz je Kanal:', JSON.stringify(bilanz), ')');
check('C: jeder Kanal hat ueberhaupt einen Beitrag aus mehreren Quellen',
  Object.values(bilanz).every(b => b.werkstatt > 0 && b.flotte > 0),
  Object.entries(bilanz).filter(([,b]) => !(b.werkstatt>0 && b.flotte>0)).map(([k])=>k));
// Die eigentliche Frage dieser Phase: Laeuft irgendein Kanal aus dem Ruder? Die Grenze ist bewusst
// grosszuegig (+300%) - sie soll nicht die Balance festschreiben, sondern eine Explosion melden,
// wie sie entsteht, wenn eine kuenftige Phase einen fuenften Beitrag auf denselben Kanal legt.
const KANAL_ALARM = 3.0;
for (const [kanal, b] of Object.entries(bilanz)){
  check('C: Kanal '+kanal.padEnd(9)+' bleibt unter der Alarmgrenze', b.summe <= KANAL_ALARM,
    { summe:Number(b.summe.toFixed(3)), grenze:KANAL_ALARM, ...b });
}
// Die Kampfkraft hat als einzige einen HARTEN gemeinsamen Deckel im Code. Er muss kleiner sein als
// die Summe der Einzelquellen - sonst waere er wirkungslos und die Gruppe faktisch ungedeckelt.
check('C: der Kampfkraft-Deckel greift wirklich (kleiner als die Summe seiner Quellen)',
  zahl('ABGRUND_KRAFT_DECKEL') < bilanz.kraft.summe + 1,
  { deckel:zahl('ABGRUND_KRAFT_DECKEL'), summe:bilanz.kraft.summe });
// Verluste sind der einzige Kanal, der MULTIPLIKATIV verrechnet wird - dort darf die Summe der
// Einzelwerte ueber 1 liegen, ohne dass die Verluste je auf null fallen. Das steht so im Code und
// muss auch so bleiben; addierte man sie, waeren Verluste bei genug Ausbau exakt null.
check('C: die Verluste bleiben multiplikativ verrechnet (nie exakt null)',
  /\(1 - abgrundKanalBonus\('verlust'\)\) \* \(1 - Math\.min\(0\.5, kiel\)\) \* \(1 - kesselSchutz\)/.test(js));

// ---- D) DER ANREIZ: was bringt Abtauchen ausserhalb des Abgrunds? ----
// Nur ZWEI Dinge wirken oben: der Tiefenbonus auf die Produktion und die vier Abgrund-
// Standortmodule. Alles andere wirkt ausschliesslich unten - das ist Absicht und der Grund, warum
// die PvP-Trennung ueberhaupt haltbar ist.
{
  const TB = new Function('ensureAbgrund', fnAus('abgrundTiefenBonus')+'; return abgrundTiefenBonus;');
  const bonus = best => TB(() => ({ best }))();
  check('D: ohne Abstieg gibt es keinen Produktionsvorteil', bonus(0) === 0);
  check('D: Rekordtiefe 30 bringt einen MESSBAREN Vorteil', bonus(30) >= 0.08,
    { prozent:Number((bonus(30)*100).toFixed(1)) });
  check('D: er waechst weiter, aber gedaempft (logarithmisch, nie explosiv)',
    bonus(100) > bonus(30) && bonus(1000) < bonus(30) * 3,
    { t30:Number((bonus(30)*100).toFixed(1)), t100:Number((bonus(100)*100).toFixed(1)), t1000:Number((bonus(1000)*100).toFixed(1)) });
  // Die Gegenprobe zur Anreiz-Frage: Der Vorteil darf auch nicht so gross werden, dass Abtauchen
  // die einzige sinnvolle Beschaeftigung wird. Gemessen wird die EIGENSCHAFT, nicht eine geratene
  // Obergrenze: Weil der Bonus logarithmisch ist, bringt jede VERDOPPLUNG der Tiefe denselben
  // festen Zuwachs - egal ob von 100 auf 200 oder von 100.000 auf 200.000. Damit kann er nie
  // davonlaufen, ohne dass man eine Zahl festschreiben muesste, die beim naechsten Balance-Pass
  // ohnehin nicht mehr stimmt. (Ein erster Anlauf prueft hier "unter +30% bei Tiefe 1e6" - eine
  // geratene Grenze, an der 39,9% scheiterten, ohne dass am Produkt etwas falsch war.)
  const zuwachs = (a,b) => bonus(b) - bonus(a);
  // Toleranz statt exakter Gleichheit: Die Formel rechnet mit log2(1 + best), und dieses "+1"
  // macht den Zuwachs bei kleinen Tiefen minimal groesser (0,019857 statt 0,02 zwischen 100 und
  // 200). Die Aussage bleibt dieselbe - der Zuwachs ist bei JEDER Verdopplung praktisch gleich -,
  // nur eine Pruefung auf 1e-9 waere an einer Eigenschaft gescheitert, die es gar nicht gibt.
  check('D: jede Verdopplung der Tiefe bringt denselben Zuwachs (echt logarithmisch)',
    Math.abs(zuwachs(100,200) - zuwachs(100000,200000)) < 0.001,
    { von100auf200:Number(zuwachs(100,200).toFixed(6)), von100kauf200k:Number(zuwachs(100000,200000).toFixed(6)) });
  check('D: in realistischer Reichweite (bis Tiefe 1000) bleibt er unter +20%', bonus(1000) < 0.20,
    { prozent:Number((bonus(1000)*100).toFixed(1)) });
  check('D: der Tiefenbonus wird an genau EINER Stelle angewandt',
    (js.match(/abgrundTiefenBonus\(\)/g)||[]).length === 2);   // Definition + Anwendung
}
// Die Abgrund-Standortmodule, die oben wirken - namentlich, damit ein unbemerktes neues auffaellt.
// Seit 31.07.2026 sind es acht (v8.356.0 hat vier ergaenzt); die Liste waechst hier bewusst mit,
// statt zu einer blossen Anzahl zu verkommen: Ein neues Modul SOLL diesen Test einmal rot machen,
// damit jemand die Frage darunter beantwortet - naemlich ob es PvP beruehrt.
{
  // Herkunfts-Konstanten aus der Datei ableiten (Regel 40/43): MODULE_DEFS traegt seit A2 auch
  // HERKUNFT_KONVOI; eine feste Vierer-Namensliste riesse den Literal-Parser mit "... is not defined".
  const herkunftDecls = (js.match(/const HERKUNFT_[A-Z_]+ = '[a-z]+'/g) || []).join('; ');
  const MD = new Function(herkunftDecls + "; return "+arrAus('MODULE_DEFS'))();
  const obenWirksam = MD.filter(d => d.quelle === 'abgrund').map(d => d.key).sort();
  check('D: die Abgrund-Standortmodule sind genau diese',
    obenWirksam.join() === ['drucktank','echolotmast','krustenpresse','nullfeldanker','prisenwaage','splitterofen','taktschmiede','wrackleser'].join(), obenWirksam);
  // DER EIGENTLICHE PUNKT: Von allen gibt nur der Nullfeldanker Kampfwirkung - und der ist oben
  // schon auf NPC und Unterzahl eingegrenzt. Alles andere sind Lager, Signal, Fragmente, Bauzeit,
  // Terraforming, Truemmerabbau und Prisengut: kein Kampfwert, nichts davon erreicht das PvP.
  const effekte = MD.filter(d => d.quelle === 'abgrund').map(d => d.effect).sort();
  check('D: ihre Effekte beruehren keinen Kampfwert ausser dem eingegrenzten Nullfeld',
    effekte.join() === ['markenzeit','nullfeld','ofen','prise','signal','storage','terraform','wrack'].join(), effekte);
  // Zusaetzlich unabhaengig von der Namensliste: Kein Abgrund-Standortmodul darf jemals einen der
  // Effekte tragen, die in Angriff oder Verteidigung einfliessen. Diese Pruefung haelt auch dann,
  // wenn jemand die Liste oben gedankenlos erweitert.
  const pvpEffekte = ['atk','def','defatk','shield','hull','raidloss','siegechance'];
  const verboten = MD.filter(d => d.quelle === 'abgrund' && pvpEffekte.includes(d.effect)).map(d=>d.key);
  check('D: kein Abgrund-Standortmodul traegt einen PvP-wirksamen Kampfeffekt', verboten.length === 0, verboten);
}

// ---- E) Speicherbare Zahlenfelder ----
// CLAUDE.md, Vorfall 21.07.2026: Ein einziges Zahlenfeld ueber der Backend-Grenze laesst den GESAMTEN
// Spielstand mit HTTP 400 abprallen - dauerhaft, still, und der Spieler sieht nur "immer 8 Std.
// offline". Der Abgrund hat mit `bergung` (v8.333.0) ein neues solches Feld eingefuehrt.
//
// EHRLICH BLEIBEN: Ob `bergung` in den SAVE_SANITY_LIMITS steht, laesst sich VON HIER AUS NICHT
// pruefen - das Backend liegt in einem anderen Repo. Was hier geprueft werden kann, ist die
// Groessenordnung: Bleibt der Wert weit unter den bekannten Grenzen, ist das Risiko klein, auch
// wenn niemand das Feld eingetragen hat.
{
  const BG = new Function('ABGRUND_WAECHTER_BERGUNG', fnAus('abgrundBergungsgut')+'; return abgrundBergungsgut;')(zahl('ABGRUND_WAECHTER_BERGUNG'));
  check('E: Bergungsgut waechst flach mit der Tiefe (kein exponentielles Feld)',
    BG(1000, false) < BG(1, false) * 200,
    { tiefe1:BG(1,false), tiefe100:BG(100,false), tiefe1000:BG(1000,false) });
  // Obergrenze grob abgeschaetzt: tiefster realistischer Sektor, Waechter, eine Million Tauchgaenge.
  const obergrenze = BG(1000, true) * 1e6;
  check('E: selbst bei einer Million Waechter-Tauchgaengen in Tiefe 1000 bleibt es unter 1e10',
    obergrenze < 1e10, { hoechstwert:obergrenze.toExponential(2) });
  check('E: das Feld wird nie negativ (pay() deckelt bei null)',
    /Math\.max\(0, \(a\.bergung\|\|0\) - amt\)/.test(fnAus('pay')));
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
