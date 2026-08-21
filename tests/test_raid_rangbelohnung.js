// Allianz-Raid: Belohnung nach Platzierung (05.08.2026, Wunsch Sascha).
//
// WUNSCH: "platz 1 bekommt am meisten nach unten immer weniger auch der schwächste bekommt
// belohnung ... es soll dort wertvolle belohnungen geben".
//
// BEFUND VORHER, mit der alten Serverformel nachgerechnet (Stufe 8, zehn Teilnehmer, realistische
// Anteile 22/16/13/11/9/8/7/6/5/3 %):
//     Platz  1 ... 1197 Kredite      Platz 2 ... 744      Platz 10 ... 627
// Eine Staffelung GAB es rechnerisch - aber Platz 2 bis Platz 10 lagen nur 19 % auseinander. Das
// ganze Gefaelle steckte in einem einzigen Sprung bei Platz 1 (`isTop ? x1,5`); wer Zweiter wurde,
// merkte keinen Unterschied zum Letzten. Ausserdem war die Erfahrung FLACH (20 bzw. 12,
// unabhaengig von Bossstufe UND Beitrag), und Ressourcen gab es gar keine.
//
// WAS DIESER TEST PRUEFT - Eigenschaften der Kurve, keine Zahlentabelle. Eine Tabelle waere bei
// jeder Nachjustierung rot, ohne dass etwas kaputt ist. Geprueft wird stattdessen:
//   1. STRENG FALLEND - jeder Platz bekommt weniger als der davor. Das ist der Kern des Wunsches.
//   2. UNTERGRENZE - auch der Letzte bekommt etwas (> 0 bei jeder Groesse des Verbands).
//   3. SPUERBARE SPANNE - Platz 2 bis Letzter liegen deutlich weiter auseinander als die 19 % von
//      frueher. Ohne diese Pruefung waere auch die alte, fast flache Kurve "streng fallend".
//   4. GEDECKELT - die Belohnung haengt NUR an Bossstufe und Platz, nie an der eigenen Wirtschaft
//      (CLAUDE.md-Fallstrick "N Minuten eigene Produktion").
//   5. Die Frontend-Texte behaupten nicht mehr den alten Top-Bonus (CLAUDE.md Regel 6).
const fs = require('fs');
const path = require('path');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// Die echten Funktionen aus server.js schneiden und ausfuehren - kein Nachbau. Ein Nachbau wuerde
// genau dann gruen bleiben, wenn der Server sich aendert, und waere damit wertlos.
const SERVER = path.join(__dirname, '..', '..', 'kolonie-kepler7-backend', 'server.js');
if (!fs.existsSync(SERVER)){
  console.log('UEBERSPRUNGEN - Backend-Repo liegt nicht daneben (' + SERVER + ')');
  process.exit(0);
}
const src = fs.readFileSync(SERVER, 'utf8');
function schneide(name){
  const a = src.indexOf('function ' + name + '(');
  if (a < 0) return null;
  const b = src.indexOf('\n}', a);
  return b > a ? src.slice(a, b + 2) : null;
}
const teile = ['allianceRaidRankFactor','allianceRaidRankShare','allianceRaidRewardFor','allianceRaidModuleDrop'].map(schneide);
check('alle vier Belohnungsfunktionen im Backend gefunden', teile.every(Boolean),
  teile.map((t,i) => (t ? 'ok' : 'FEHLT')).join(','));
if (!teile.every(Boolean)){ console.log('\nFEHLGESCHLAGEN'); process.exit(1); }
const spanne = (src.match(/const ALLIANCE_RAID_RANK_SPREAD = ([\d.]+)/)||[])[1];
check('Rangspanne als benannte Konstante', !!spanne, { ALLIANCE_RAID_RANK_SPREAD: spanne });

const umgebung = {};
new Function('u', 'const ALLIANCE_RAID_RANK_SPREAD = ' + spanne + ';\n' + teile.join('\n') +
  '\nu.rank = allianceRaidRankFactor; u.share = allianceRaidRankShare; u.lohn = allianceRaidRewardFor; u.modul = allianceRaidModuleDrop;')(umgebung);

// Realistische Verteilung: einer stark, der Rest abfallend.
const ANTEILE = [22,16,13,11,9,8,7,6,5,3];

// ---- 1) streng fallend, in jeder Verbandsgroesse
{
  const kaputt = [];
  for (const n of [1,2,3,5,7,10,20]){
    const a = ANTEILE.slice(0, n);
    const summe = a.reduce((x,y)=>x+y,0);
    const werte = a.map((x,i) => umgebung.lohn(8, x/summe, i+1, n, true));
    for (let i = 1; i < werte.length; i++){
      if (!(werte[i].credits < werte[i-1].credits)) kaputt.push({ n, platz:i+1, vor:werte[i-1].credits, hier:werte[i].credits });
      if (!(werte[i].xp <= werte[i-1].xp)) kaputt.push({ n, platz:i+1, feld:'xp' });
    }
  }
  check('1: die Belohnung faellt von Platz zu Platz streng ab', kaputt.length === 0, kaputt.slice(0,4));
}

// ---- 2) auch der Letzte bekommt etwas
{
  const leer = [];
  for (const n of [1,2,3,5,10,20]){
    const l = umgebung.lohn(8, 0.01, n, n, true);   // letzter Platz, winziger Anteil
    if (!(l.credits > 0 && l.battlePoints > 0 && l.xp > 0 && l.resources.erz > 0)) leer.push({ n, l });
    // Antimaterie und Fragmente sind bewusst Spitzenbeute - aber ganz leer soll auch unten nichts sein.
    if (!(l.resources.antimaterie > 0) || !(l.fragments > 0)) leer.push({ n, feld:'antimaterie/fragmente', l });
  }
  check('2: auch der letzte Platz bekommt in jeder Gruppengroesse etwas', leer.length === 0, leer.slice(0,3));
}

// ---- 3) die Spanne ist spuerbar, nicht nur formal vorhanden
// Das ist die Pruefung, die die ALTE Kurve nicht bestanden haette: Sie war ebenfalls streng
// fallend, aber Platz 2 bis Letzter lagen nur 19 % auseinander.
{
  const n = ANTEILE.length, summe = ANTEILE.reduce((x,y)=>x+y,0);
  const w = ANTEILE.map((x,i) => umgebung.lohn(8, x/summe, i+1, n, true).credits);
  const spannePct = Math.round((w[1]/w[n-1] - 1) * 100);
  check('3: Platz 2 bis Letzter liegen deutlich weiter auseinander als frueher (19%)',
    spannePct >= 60, { spanne: spannePct + '%', frueher: '19%', werte: w });
  // GEGENPROBE zu 3: Die alte Kurve nachrechnen und zeigen, dass sie hier durchgefallen waere -
  // sonst waere die Schwelle nur eine Zahl ohne Bezug.
  const alt = ANTEILE.map((x,i) => Math.round((300+8*150)*(0.4+0.6*(x/summe))*(i===0?1.5:1)));
  const altSpanne = Math.round((alt[1]/alt[n-1] - 1) * 100);
  check('3: Gegenprobe – die alte Kurve waere an dieser Schwelle gescheitert',
    altSpanne < 60, { alteSpanne: altSpanne + '%' });
}

// ---- 4) gedeckelt: haengt nur an Stufe und Platz
{
  // Zwei voellig verschiedene "Wirtschaften" gibt es in der Funktion gar nicht als Eingabe - genau
  // das ist die Zusage. Geprueft wird, dass die Signatur keine Ressourcen-/Produktionsgroesse
  // entgegennimmt und der Aufruf mit denselben vier Werten reproduzierbar ist.
  const a = umgebung.lohn(8, 0.2, 2, 5, true);
  const b = umgebung.lohn(8, 0.2, 2, 5, true);
  check('4: gleiche Eingabe, gleiche Belohnung (kein Zufall, keine Wirtschaftskopplung)',
    JSON.stringify(a) === JSON.stringify(b), a);
  // Und sie waechst mit der Bossstufe - sonst waere ein Stufe-20-Boss so viel wert wie Stufe 1,
  // was bei der XP vorher tatsaechlich der Fall war.
  const s1 = umgebung.lohn(1, 0.2, 1, 5, true), s20 = umgebung.lohn(20, 0.2, 1, 5, true);
  check('4: hoehere Bossstufe zahlt mehr - auch bei der Erfahrung (war vorher flach 20)',
    s20.credits > s1.credits && s20.xp > s1.xp, { stufe1: s1.xp, stufe20: s20.xp });
}

// ---- 5) eine nicht-toedliche Welle zahlt weniger, und ohne Kill gibt es keine Spitzenbeute
{
  const kill = umgebung.lohn(8, 0.2, 1, 5, true);
  const ohne = umgebung.lohn(8, 0.2, 1, 5, false);
  check('5: eine nicht-toedliche Welle zahlt durchgehend weniger',
    ohne.credits < kill.credits && ohne.xp < kill.xp && ohne.resources.erz < kill.resources.erz,
    { kill: kill.credits, ohne: ohne.credits });
  check('5: ohne Kill keine Antimaterie, keine Fragmente, kein Modul',
    ohne.resources.antimaterie === 0 && ohne.fragments === 0 && umgebung.modul(8, 1, 5, false) === null);
}

// ---- 6) Regel 6: die Frontend-Texte behaupten den alten Top-Bonus nicht mehr
{
  // Pfad ueber die gemeinsame Quelle: sonst wird KEPLER_SPIELDATEI still ignoriert und eine
  // Gegenprobe liest die ECHTE Datei (CLAUDE.md, Korrektur zu Regel 14).
  const spiel = fs.readFileSync(require('./lib/spieldatei').SPIELDATEI, 'utf8');
  // Der Hilfe-Abschnitt zum ALLIANZ-Raid darf den +50%-Top-Bonus nicht mehr versprechen. Der
  // WELTBOSS benutzt ihn weiterhin und ist bewusst ausgenommen - dort stimmt die Aussage.
  const a = spiel.indexOf("title:'Allianz-Raid'");
  const b = spiel.indexOf('},', a);
  const abschnitt = a >= 0 ? spiel.slice(a, b) : '';
  check('6: Hilfe-Abschnitt "Allianz-Raid" gefunden', a >= 0 && b > a);
  check('6: er verspricht keinen "Top-Schädiger +50%"-Bonus mehr',
    !!abschnitt && !/Top-Schädiger \+50%/.test(abschnitt),
    abschnitt ? (abschnitt.match(/Top-Schädiger[^<.]*/)||['(nicht mehr enthalten)'])[0] : null);
  check('6: und er erklaert stattdessen die Platzierung',
    /Platzierung|Platz 1/.test(abschnitt));
  // Gegenprobe: Der Weltboss-Text MUSS den Bonus weiterhin nennen - sonst haette ich blind ueber
  // die ganze Datei ersetzt und eine korrekte Aussage mitgeloescht.
  check('6: Gegenprobe – der Weltboss nennt seinen Top-Bonus weiterhin',
    /Top-Schädiger[^<]{0,20}\+50%/.test(spiel));
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
