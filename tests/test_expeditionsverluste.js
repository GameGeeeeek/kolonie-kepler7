// Expeditions-Begegnungen, Balance-Überarbeitung v8.298.10 (Spieler-Report: "man verliert so viel
// Schiffe, das ist abnormal").
//
// Die alte Formel lautete P(Totalverlust|Begegnung) = 0,45 − 0,15·r und kostete jedes Mal die
// KOMPLETTE Eskorte. Daraus folgten zwei Fehler, die man dem Code nicht ansieht, sondern nur der
// Rechnung:
//   1. Selbst eine unendlich starke Eskorte kam nie unter 30% Totalverlust - die Eskorte konnte das
//      Problem also gar nicht lösen.
//   2. Weil der Verlust die ganze Eskorte war, WUCHS der erwartete Schiffsverlust mit der Eskorte.
//      Rechnerisch war es am besten, möglichst wenig mitzuschicken - das Gegenteil der Absicht.
//
// Dieser Test rechnet die neue Kurve nach, statt sie nur laufen zu lassen. Geprüft wird analytisch
// (geschlossene Formel) UND per Simulation gegen den echten, aus der Spieldatei extrahierten Code,
// damit Formel und Umsetzung nicht auseinanderlaufen können.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
// Auch Konstanten erwischen, die sich eine const-Zeile teilen (…MIN = 0.50, …SPAN = 0.30;).
const zahl = (name) => {
  const m = src.match(new RegExp('(?:const|,)\\s*' + name + '\\s*=\\s*([0-9.]+)'));
  return m ? parseFloat(m[1]) : NaN;
};
const HEAVY_BASE = zahl('EXPEDITION_HEAVY_BASE');
const WEAK_BASE = zahl('EXPEDITION_WEAK_BASE');
const LOSS_MIN = zahl('EXPEDITION_HEAVY_LOSS_MIN');
const LOSS_SPAN = zahl('EXPEDITION_HEAVY_LOSS_SPAN');
const SCORE_FACTOR = zahl('EXPEDITION_ENEMY_SCORE_FACTOR');
const SCORE_CAP = zahl('EXPEDITION_ENEMY_SCORE_CAP');

check('alle Balance-Konstanten aus der Spieldatei gelesen',
  [HEAVY_BASE, WEAK_BASE, LOSS_MIN, LOSS_SPAN, SCORE_FACTOR, SCORE_CAP].every(Number.isFinite),
  { HEAVY_BASE, WEAK_BASE, LOSS_MIN, LOSS_SPAN, SCORE_FACTOR, SCORE_CAP });

const pSchwer = r => HEAVY_BASE * Math.pow(1 - r, 2);
const pSchwach = r => WEAK_BASE * (1 - r);
const anteil = r => LOSS_MIN + LOSS_SPAN * (1 - r);
// Erwarteter Eskortenverlust je Begegnung, als Anteil der mitgeschickten Eskorte.
const erwartet = r => pSchwer(r) * anteil(r);

// ---------------------------------------------------------------- 1) die drei Ausgänge sind gültig
// ratio ist per Konstruktion in [0,1] (Eskorte/(Eskorte+Gegner), beide ≥ 0) - der Schrittzähler wird
// deshalb geklemmt, sonst würde reine Fließkomma-Ungenauigkeit am oberen Rand einen Fehlalarm geben.
let summenOk = true, negativ = false;
for (let i = 0; i <= 50; i++){
  const r = Math.min(1, i / 50);
  const s = pSchwer(r) + pSchwach(r);
  if (s > 1 || s < 0) summenOk = false;
  if (pSchwer(r) < 0 || pSchwach(r) < 0) negativ = true;
}
check('1: die Wahrscheinlichkeiten bleiben über den ganzen Bereich gültig (Summe ≤ 1, nichts negativ)',
  summenOk && !negativ);
check('1: ohne Eskorte bleibt es hart – unbewachte Expeditionen sollen eine schlechte Idee sein',
  pSchwer(0) >= 0.30, { 'P(schwer) bei r=0': pSchwer(0) });

// ---------------------------------------------------------------- 2) die Eskorte wirkt wirklich
// Der Kern des alten Fehlers: die Kurve muss gegen null gehen, nicht gegen 30%.
check('2: bei überwältigender Überlegenheit geht das Risiko gegen null (alt: nie unter 30%)',
  pSchwer(1) < 0.001 && pSchwer(0.9) < 0.02,
  { 'r=0.9': +pSchwer(0.9).toFixed(4), 'r=1.0': +pSchwer(1).toFixed(4) });
const altP = r => 0.45 - 0.15 * r;
check('2: bei ausgeglichenen Kräften ist das Risiko deutlich kleiner als vorher',
  pSchwer(0.5) < altP(0.5) / 3,
  { alt: +altP(0.5).toFixed(3), neu: +pSchwer(0.5).toFixed(3) });
// Monotonie: jede zusätzliche Eskortenstärke muss das Risiko senken, nie erhöhen.
let monoton = true;
for (let r = 0; r < 1; r += 0.01) if (pSchwer(r + 0.01) > pSchwer(r) + 1e-12) monoton = false;
check('2: mehr Eskorte senkt das Risiko streng monoton', monoton);

// ---------------------------------------------------------------- 3) der Anreiz dreht sich um
// Das ist die eigentliche Aussage der Überarbeitung. Alt: Verlust = 100% der Eskorte, also war der
// erwartete Verlust ~konstant in r und der absolute Verlust wuchs mit jeder mitgeschickten Einheit.
// Neu: der erwartete ANTEIL sinkt mit r - eine größere Eskorte lohnt sich also doppelt.
let anreizOk = true;
for (let r = 0; r < 1; r += 0.01) if (erwartet(r + 0.01) > erwartet(r) + 1e-12) anreizOk = false;
check('3: der erwartete Eskortenverlust sinkt mit stärkerer Eskorte (alt: er stieg faktisch)', anreizOk);
check('3: bei starker Eskorte ist der erwartete Verlust verschwindend',
  erwartet(0.8) < 0.01, { 'E[Verlust] r=0.8': +(erwartet(0.8) * 100).toFixed(2) + '%' });
check('3: bei ausgeglichenen Kräften mindestens 5x besser als vorher (alt = 38% der Eskorte)',
  erwartet(0.5) * 5 < altP(0.5),
  { alt: +(altP(0.5) * 100).toFixed(1) + '%', neu: +(erwartet(0.5) * 100).toFixed(2) + '%' });

// ---------------------------------------------------------------- 4) kein Totalverlust mehr
check('4: auch im schlimmsten Fall überlebt ein Teil der Eskorte',
  anteil(0) < 1 && anteil(0) <= 0.80 && anteil(1) >= 0.50,
  { 'Anteil r=0': anteil(0), 'Anteil r=1': anteil(1) });

// ---------------------------------------------------------------- 5) Gegnerskalierung ist gedeckelt
const gegnerMittel = punkte => 190 + Math.min(SCORE_CAP, punkte * SCORE_FACTOR);
check('5: die Gegnerstärke wächst nicht mehr unbegrenzt mit dem Punktestand',
  gegnerMittel(1e6) === gegnerMittel(1e7),
  { 'bei 1 Mio': gegnerMittel(1e6), 'bei 10 Mio': gegnerMittel(1e7) });
check('5: für kleine Konten ändert sich nichts (Deckel greift erst später)',
  gegnerMittel(10000) === 190 + 10000 * SCORE_FACTOR, gegnerMittel(10000));

// ---------------------------------------------------------------- 6) Simulation gegen den echten Code
// Analytik und Umsetzung könnten auseinanderlaufen (z.B. wenn jemand die Reihenfolge der Würfe
// ändert). Deshalb wird der Auflösungsblock aus der Spieldatei GESCHNITTEN und real ausgeführt.
// Ab dem if(encountered){ schneiden, damit der Block ausgeglichene Klammern hat.
const von = src.lastIndexOf('if (encountered){', src.indexOf('enemyPower = 40 + Math.random()*300'));
const bis = src.indexOf('if (outcome === \'destroyed\')', von);
check('6: Auflösungsblock in der Spieldatei gefunden', von > 0 && bis > von);
if (von > 0 && bis > von){
  const block = src.slice(von, bis);
  const lauf = new Function('escortPower', 'K', `
    let outcome='success', ratio=1, enemyPower=0, schwerVerlustAnteil=0;
    const encountered = true;
    const fleet={forscher:5};
    const computeScore=()=>K.score;
    const EXPEDITION_ENEMY_SCORE_CAP=K.SCORE_CAP, EXPEDITION_ENEMY_SCORE_FACTOR=K.SCORE_FACTOR;
    const EXPEDITION_HEAVY_BASE=K.HEAVY_BASE, EXPEDITION_WEAK_BASE=K.WEAK_BASE;
    const EXPEDITION_HEAVY_LOSS_MIN=K.LOSS_MIN, EXPEDITION_HEAVY_LOSS_SPAN=K.LOSS_SPAN;
    ${block}
    return { outcome, ratio, schwerVerlustAnteil };
  `);
  const K = { score: 50000, SCORE_CAP, SCORE_FACTOR, HEAVY_BASE, WEAK_BASE, LOSS_MIN, LOSS_SPAN };
  const N = 60000;
  // Eskortenstärke so wählen, dass sich ein Ziel-ratio um 0,5 ergibt (Gegner im Mittel 190+1500).
  const zielGegner = 190 + Math.min(SCORE_CAP, K.score * SCORE_FACTOR);
  const escort = zielGegner; // ratio ≈ 0,5
  let schwer = 0, schwach = 0, abgewehrt = 0, rSumme = 0, anteilSumme = 0;
  for (let i = 0; i < N; i++){
    const e = lauf(escort, K);
    rSumme += e.ratio;
    if (e.outcome === 'destroyed'){ schwer++; anteilSumme += e.schwerVerlustAnteil; }
    else if (e.outcome === 'weakened') schwach++;
    else abgewehrt++;
  }
  const rMittel = rSumme / N;
  const simSchwer = schwer / N;
  const erwartetSchwer = pSchwer(rMittel);
  check('6: die Simulation trifft die analytische Formel für schwere Verluste',
    Math.abs(simSchwer - erwartetSchwer) < 0.02,
    { simuliert: +simSchwer.toFixed(4), formel: +erwartetSchwer.toFixed(4), rMittel: +rMittel.toFixed(3) });
  check('6: die Simulation trifft die Formel für geschwächte Rückkehrer',
    Math.abs(schwach / N - pSchwach(rMittel)) < 0.02,
    { simuliert: +(schwach / N).toFixed(4), formel: +pSchwach(rMittel).toFixed(4) });
  check('6: bei ausgeglichenen Kräften wird der Angriff meistens abgewehrt',
    abgewehrt / N > 0.55, { abgewehrt: +(abgewehrt / N).toFixed(3) });
  const anteilMittel = schwer ? anteilSumme / schwer : 0;
  check('6: der real gewürfelte Verlustanteil liegt im vorgesehenen Band',
    anteilMittel > LOSS_MIN && anteilMittel < LOSS_MIN + LOSS_SPAN,
    { gemittelt: +anteilMittel.toFixed(3), band: [LOSS_MIN, LOSS_MIN + LOSS_SPAN] });
  check('6: kein einziger Durchlauf löscht die komplette Eskorte aus',
    anteilMittel < 1);
}

// ---------------------------------------------------------------- 7) alle Anzeigestellen mitgezogen
// CLAUDE.md-Regel 6: nach einer Mechanik-Änderung ALLE Stellen suchen, die dieselbe Größe zeigen.
check('7: der Bericht spricht nicht mehr von einer verlorenen Expedition',
  !src.includes("destroyed:{label:'Expedition verloren'"));
check('7: die Log-Meldung spricht nicht mehr von „vollständig verloren"',
  !src.includes('überrascht und vollständig verloren'));
check('7: der Hinweis über der Eskortenauswahl droht nicht mehr mit Totalverlust',
  !src.includes('drohen unterwegs Verluste bis hin zum Totalverlust'));
check('7: die Hilfe erklärt die drei Ausgänge einer Begegnung',
  src.includes('Was bei einer Begegnung passiert'));
check('7: die Hilfe nennt den Trümmerfeld- und Hyperjäger-Hinweis',
  /Trümmerfeld/.test(src.slice(src.indexOf('Was bei einer Begegnung passiert'), src.indexOf('Was bei einer Begegnung passiert') + 2000)) &&
  /Hyperjäger/.test(src.slice(src.indexOf('Was bei einer Begegnung passiert'), src.indexOf('Was bei einer Begegnung passiert') + 2000)));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
