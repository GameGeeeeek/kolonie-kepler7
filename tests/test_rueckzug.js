// Rueckzugs-Option und Rettungskapsel v8.298.14 (Inhaltspaket 4/5).
//
// Zwei Ergaenzungen an der Begegnungsauflösung, die beide leicht still danebengehen koennen:
//   - "Bei Feindkontakt abbrechen" muss beim START eingebacken werden. Waere es eine Live-Abfrage
//     von state, wuerde ein spaeteres Umlegen des Schalters bereits fliegende Expeditionen
//     rueckwirkend aendern - genau der Fehler, den encounterChance/rewardMult dort vermeiden.
//   - Die Rettungskapsel greift bei ZWEI Ausgaengen (geschwaecht und schwerer Verlust). Nur einen
//     davon anzufassen waere der naheliegende Halbfehler.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const zahl = (name) => { const m = src.match(new RegExp('(?:const|,)\\s*' + name + '\\s*=\\s*([0-9.]+)')); return m ? parseFloat(m[1]) : NaN; };
const BASIS = zahl('RETTUNGSKAPSEL_BASIS'), PRO_STUFE = zahl('RETTUNGSKAPSEL_PRO_STUFE'), DECKEL = zahl('RETTUNGSKAPSEL_DECKEL');
check('Rettungskapsel-Konstanten gelesen', [BASIS, PRO_STUFE, DECKEL].every(Number.isFinite), { BASIS, PRO_STUFE, DECKEL });
check('1: die Kapsel ist weder wirkungslos noch ein Freifahrtschein',
  BASIS > 0.1 && DECKEL < 1 && DECKEL > BASIS, { BASIS, DECKEL });

// ---------------------------------------------------------------- Auflösungsblock ausführbar machen
const von = src.lastIndexOf('if (encountered){', src.indexOf('enemyPower = 40 + Math.random()*300'));
const bis = src.indexOf("if (outcome === 'withdrawn')", von);
check('Auflösungsblock gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const block = src.slice(von, bis);

// Beides EINMAL vorbereiten: new Function() je Aufruf war teuer, aber der eigentliche Bremsklotz
// war zahl() - das jagt sechs Regex über die 3-MB-Spieldatei, und das zehntausendfach.
const K = { cap: zahl('EXPEDITION_ENEMY_SCORE_CAP'), faktor: zahl('EXPEDITION_ENEMY_SCORE_FACTOR'),
  heavy: zahl('EXPEDITION_HEAVY_BASE'), weak: zahl('EXPEDITION_WEAK_BASE'),
  lmin: zahl('EXPEDITION_HEAVY_LOSS_MIN'), lspan: zahl('EXPEDITION_HEAVY_LOSS_SPAN'),
  rBasis: BASIS, rStufe: PRO_STUFE, rDeckel: DECKEL };
const aufloesen = new Function('m', 'escortPower', 'st', 'fleet', 'K', `
    let outcome='success', ratio=1, enemyPower=0, schwerVerlustAnteil=0, forscherGerettet=false;
    const encountered = true;
    const state = st;
    const computeScore=()=>0;
    const EXPEDITION_ENEMY_SCORE_CAP=K.cap, EXPEDITION_ENEMY_SCORE_FACTOR=K.faktor;
    const EXPEDITION_HEAVY_BASE=K.heavy, EXPEDITION_WEAK_BASE=K.weak;
    const EXPEDITION_HEAVY_LOSS_MIN=K.lmin, EXPEDITION_HEAVY_LOSS_SPAN=K.lspan;
    const RETTUNGSKAPSEL_BASIS=K.rBasis, RETTUNGSKAPSEL_PRO_STUFE=K.rStufe, RETTUNGSKAPSEL_DECKEL=K.rDeckel;
    function rettungskapselChance(){ return Math.min(RETTUNGSKAPSEL_DECKEL, RETTUNGSKAPSEL_BASIS + (state.research.rexpedition||0)*RETTUNGSKAPSEL_PRO_STUFE); }
    function rettungskapselGreift(){ return Math.random() < rettungskapselChance(); }
    ${block}
    return { outcome, forscherGerettet, forscherUebrig: fleet.forscher };
  `);
function lauf(opts){
  const st = { expeditionSafeRuns:0, research:{ rexpedition: opts.forschung||0 } };
  const fleet = { forscher: 5 };
  return aufloesen({ withdrawOnContact: !!opts.abbrechen }, opts.escort === undefined ? 1 : opts.escort, st, fleet, K);
}

// ---------------------------------------------------------------- 2) Rückzug
let nichtAbgedreht = 0, verlusteBeimRueckzug = 0;
for (let i = 0; i < 3000; i++){
  const r = lauf({ abbrechen:true, escort:1 }); // absichtlich hoffnungslose Eskorte
  if (r.outcome !== 'withdrawn') nichtAbgedreht++;
  if (r.forscherUebrig !== 5) verlusteBeimRueckzug++;
}
check('2: mit aktivem Rückzug endet JEDE Begegnung mit Abdrehen', nichtAbgedreht === 0, { abweichungen: nichtAbgedreht });
check('2: und kostet dabei nie ein Forschungsschiff', verlusteBeimRueckzug === 0, { verluste: verlusteBeimRueckzug });
// Ohne den Schalter muss es weiterhin schiefgehen koennen - sonst waere Punkt 2 wertlos.
let schlecht = 0;
for (let i = 0; i < 3000; i++){ const o = lauf({ abbrechen:false, escort:1 }).outcome; if (o === 'destroyed' || o === 'weakened') schlecht++; }
check('2: ohne den Schalter gehen Begegnungen weiterhin schief (Gegenprobe)', schlecht > 1500, { schlechteAusgaenge: schlecht });

// ---------------------------------------------------------------- 3) Rückzug wird beim START eingebacken
check('3: die Auflösung liest die Entscheidung aus der Mission, nicht live aus state',
  /if \(m\.withdrawOnContact\)/.test(src) && !/if \(state\.expeditionWithdraw\)\{\s*\n?\s*outcome = 'withdrawn'/.test(src));
check('3: und der Startvorgang schreibt sie in die Mission',
  /withdrawOnContact: !!state\.expeditionWithdraw/.test(src));

// ---------------------------------------------------------------- 4) Rettungskapsel
function quote(forschung){
  let gerettet = 0, faelle = 0;
  for (let i = 0; i < 8000; i++){
    const r = lauf({ abbrechen:false, escort:1, forschung });
    if (r.outcome === 'destroyed' || r.outcome === 'weakened'){ faelle++; if (r.forscherGerettet) gerettet++; }
  }
  return gerettet / faelle;
}
const q0 = quote(0);
check('4: ohne Forschung entspricht die Rettungsquote der Grundchance',
  Math.abs(q0 - BASIS) < 0.03, { gemessen: +q0.toFixed(3), erwartet: BASIS });
const q5 = quote(5);
check('4: die Forschung Expeditionsanalytik hebt die Quote an',
  q5 > q0 + 0.08 && Math.abs(q5 - (BASIS + 5*PRO_STUFE)) < 0.03,
  { ohneForschung: +q0.toFixed(3), mitStufe5: +q5.toFixed(3), erwartet: BASIS + 5*PRO_STUFE });
const qMax = quote(50);
check('4: der Deckel greift', Math.abs(qMax - DECKEL) < 0.03, { gemessen: +qMax.toFixed(3), deckel: DECKEL });
// Beide Ausgaenge muessen die Kapsel benutzen - nur einen anzufassen waere der Halbfehler.
let rettungBeiSchwer = 0, rettungBeiGeschwaecht = 0;
for (let i = 0; i < 8000; i++){
  const r = lauf({ abbrechen:false, escort:1, forschung:20 });
  if (r.forscherGerettet && r.outcome === 'destroyed') rettungBeiSchwer++;
  if (r.forscherGerettet && r.outcome === 'weakened') rettungBeiGeschwaecht++;
}
check('4: die Kapsel greift bei BEIDEN schlechten Ausgängen',
  rettungBeiSchwer > 0 && rettungBeiGeschwaecht > 0,
  { beiSchweremVerlust: rettungBeiSchwer, beiGeschwaecht: rettungBeiGeschwaecht });

// ---------------------------------------------------------------- 5) Anzeigestellen (CLAUDE.md 6)
check('5: der Bericht kennt den neuen Ausgang', /withdrawn:\{label:'Planmäßig abgedreht'/.test(src));
check('5: die Log-Meldung beim schweren Verlust nennt die gerettete Kapsel',
  /forscherGerettet\?'Die Rettungskapsel brachte das Forschungsschiff heraus/.test(src));
check('5: der Bericht meldet kein verlorenes Schiff, wenn es gerettet wurde',
  /outcome==='weakened' && !forscherGerettet\) \? \{forscher:1\}/.test(src));
check('5: es gibt einen eigenen Flavour-Text für den geretteten Fall',
  /EXPEDITION_RESCUED_FLAVOR/.test(src) && (src.match(/EXPEDITION_RESCUED_FLAVOR/g) || []).length >= 3);
check('5: der Rückzug zählt NICHT als abgeschlossene Expedition',
  src.indexOf("outcome === 'withdrawn'") < src.indexOf('state.expeditionsCompleted = (state.expeditionsCompleted||0)+1'));
check('5: der Schalter hat einen Vorgabewert für Altstände', /state\.expeditionWithdraw === undefined\) state\.expeditionWithdraw = false/.test(src));
check('6: die Hilfe erklärt beides', /Rückzug &amp; Rettungskapsel|Rückzug & Rettungskapsel/.test(src));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
