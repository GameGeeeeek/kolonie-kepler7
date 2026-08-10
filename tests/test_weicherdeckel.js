// Weicher Deckel - Überlauf statt Klippe (v8.468.0, Task #59, Wunsch Sascha).
//
// HINTERGRUND: Bis hierher galt ueberall `Math.min(deckel, roh)`. Der Punkt unter dem Deckel
// zaehlte voll, der naechste exakt null - man musste vor jeder Entscheidung nachsehen, und ein
// guter Fund in einem vollen Topf war wertlos. Jetzt laeuft jeder Bonus ueber dem Deckel
// exponentiell aus: wirksam = deckel + spielraum*(1 - e^(-(roh-deckel)/spielraum)).
//
// GEPRUEFT WIRD (die Funktion AUSGEFUEHRT, aus der Spieldatei geholt):
//   1) die vier Eigenschaften, auf denen der ganze Entwurf steht:
//      a) unterhalb des Deckels VOELLIG unveraendert - niemand wird geschwaecht,
//      b) stetig am Deckel und Steigung 1 (der erste Punkt darueber zaehlt noch voll),
//      c) streng monoton - mehr ist IMMER mehr, es gibt keinen wertlosen Punkt,
//      d) hart begrenzt bei deckel+spielraum - der Deckel bremst weiter.
//   2) Verdrahtung: die zwoelf Toepfe laufen ueber weicherDeckel. Die PvP-Toepfe blieben hier
//      zunaechst bewusst hart (das Backend rechnet sie mit) und sind seit v8.477.0 gemeinsam mit
//      ihm umgestellt - die Paritaet beider Fassungen prueft tests/test_pvp_deckel.js.
//   3) die Zeit-Ersparnisse rechnen am BONUS, nicht am Multiplikator (sonst am falschen Ende).
//   4) Anzeige: Boni-Bilanz nutzt dieselbe Funktion und weist den Ueberlauf aus; Hilfe erklaert.
//
// GEGENPROBE (Arbeitsregel 1, beidseitig ausgefuehrt): am alten Stand (v8.467.0) fehlt die
// Funktion - 0a schlaegt an; die Verdrahtungspruefungen fallen ebenfalls durch.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- Extraktion (Regel 6: Anker-Existenz VOR dem Slice)
const von = JS.indexOf('const UEBERLAUF_ANTEIL = ');
const bis = von < 0 ? -1 : JS.indexOf('\n  const PROD_BONUS_CAP', von);
check('0a: weicherDeckel-Block gefunden', von > 0 && bis > von);
if (von < 0 || bis < 0) return ende();
const quelle = JS.slice(von, bis);
const { weicherDeckel, UEBERLAUF_ANTEIL } = new Function(
  quelle + '\nreturn { weicherDeckel, UEBERLAUF_ANTEIL };')();
check('0b: der Ueberlauf-Anteil ist benannt und plausibel',
  UEBERLAUF_ANTEIL > 0 && UEBERLAUF_ANTEIL <= 0.5, UEBERLAUF_ANTEIL);

// ---- 1) die vier tragenden Eigenschaften, an mehreren Deckeln gemessen
const DECKEL = [1.0, 0.5, 0.4, 0.3, 0.2];
{
  // a) unterhalb unveraendert - das ist die Zusage "niemand wird geschwaecht"
  let abweichung = 0;
  for (const d of DECKEL)
    for (let r = 0; r <= d; r += d/20)
      abweichung = Math.max(abweichung, Math.abs(weicherDeckel(r, d) - r));
  check('1a: unterhalb des Deckels aendert sich nichts (kein bestehender Spieler verliert)',
    abweichung < 1e-12, { groesteAbweichung: abweichung });

  // b) stetig UND Steigung 1 am Deckel: der erste Punkt darueber zaehlt noch voll.
  let sprung = 0, steigung = [];
  for (const d of DECKEL){
    sprung = Math.max(sprung, Math.abs(weicherDeckel(d + 1e-9, d) - d));
    const h = d/10000;
    steigung.push((weicherDeckel(d + h, d) - d) / h);
  }
  check('1b: kein Sprung am Deckel und der erste Punkt darueber zaehlt voll (Steigung ~1)',
    sprung < 1e-8 && steigung.every(x => x > 0.999 && x <= 1.0),
    { sprung, steigung: steigung.map(x => x.toFixed(4)) });

  // c) streng monoton: JEDER weitere Punkt bewegt die Zahl noch. Das ist die eigentliche
  // Zusage an den Spieler - es gibt keinen Bonus mehr, der nichts tut.
  let schlimmster = Infinity;
  for (const d of DECKEL){
    let vorher = weicherDeckel(d, d);
    for (let r = d; r <= d*3; r += d/50){
      const jetzt = weicherDeckel(r + d/50, d);
      schlimmster = Math.min(schlimmster, jetzt - vorher);
      vorher = jetzt;
    }
  }
  check('1c: streng monoton - jeder weitere Punkt zaehlt noch (kein wertloser Bonus)',
    schlimmster > 0, { kleinsterZuwachs: schlimmster });

  // d) hart begrenzt: der Deckel tut weiter seine Arbeit (kein Aufschaukeln).
  const ueber = DECKEL.map(d => ({ d, max: weicherDeckel(d * 1000, d), grenze: d * (1 + UEBERLAUF_ANTEIL) }));
  check('1d: hart begrenzt bei Deckel + Spielraum, auch bei absurdem Rohwert',
    ueber.every(x => x.max <= x.grenze + 1e-9 && x.max > x.d),
    ueber.map(x => x.d + '->' + x.max.toFixed(4) + ' (Grenze ' + x.grenze + ')'));

  // Konkrete Zahlen aus der Patchnote nachrechnen (Regel 11: Behauptungen messen).
  check('1e: die Patchnote-Beispiele stimmen (110->108, 125->116, 150->122 bei Deckel 100%)',
    Math.round(weicherDeckel(1.10,1)*1000)/10 === 108.2 &&
    Math.round(weicherDeckel(1.25,1)*100) === 116 &&
    Math.round(weicherDeckel(1.50,1)*100) === 122,
    [weicherDeckel(1.10,1), weicherDeckel(1.25,1), weicherDeckel(1.50,1)].map(x=>(x*100).toFixed(1)));
}

// ---- 2) Verdrahtung: zwoelf Toepfe umgestellt (die PvP-Toepfe seit v8.477.0 ebenfalls)
const UMGESTELLT = [
  ['Produktion', 'weicherDeckel(globalBonus, PROD_BONUS_CAP)'],
  ['Handel', "weicherDeckel(moduleBonusTotal('trade'), 0.3)"],
  ['Expeditions-Ausbeute', "weicherDeckel(moduleBonusTotal('expedition'), 1.0)"],
  ['Gegenschlag', "weicherDeckel(moduleBonusAt(planetKey, 'defatk'), 1.0)"],
  ['Erfahrung', "weicherDeckel(moduleBonusTotal('xpgain'), 1.0)"],
  ['Treibstoff', "weicherDeckel(moduleBonusAt(state.activeBasePlanet, 'fuelcost') + skillFuelBonus(), 0.5)"],
  ['Forschungszeit', "weicherDeckel(moduleBonusTotal('research'), 0.4)"],
  ['Bauzeit', "weicherDeckel(moduleBonusAt(planetKey, 'buildspeed'), 0.5)"],
  ['Expeditions-Risiko', "weicherDeckel(moduleBonusAt(planetKey, 'exprisk'), 0.5)"],
  ['Schiffsbauzeit', 'weicherDeckel(werftkernLvl*0.015, 0.20)'],
  ['Prestige', 'weicherDeckel(n * PRESTIGE_PROD_PER_LEVEL, PRESTIGE_PROD_CAP)'],
  ['Kommandanten-Level', 'weicherDeckel(n * COMMANDER_PROD_PER_LEVEL, COMMANDER_PROD_CAP)']
];
for (const [name, fragment] of UMGESTELLT)
  check('2: ' + name.padEnd(22) + ' laeuft ueber den weichen Deckel', JS.includes(fragment));

// SEIT v8.477.0 sind auch die PvP-Toepfe umgestellt - gemeinsam mit dem Backend, das dieselbe
// Formel bekommen hat. Bis dahin stand hier die Gegenprobe "die drei MUESSEN noch hart sein",
// und sie war richtig: Eine einseitige Umstellung haette Client und Server im Kampf verschieden
// rechnen lassen. Die Aussage ist damit nicht weggefallen, sondern umgezogen - tests/
// test_pvp_deckel.js holt BEIDE Fassungen aus den Dateien, fuehrt sie aus und vergleicht sie
// ueber einen Wertebereich. Das ist die staerkere Pruefung: Sie faellt auch dann, wenn beide
// Seiten `weicherDeckel` heissen, aber verschieden rechnen.
check('2: die PvP-Toepfe sind ebenfalls umgestellt (Paritaet prueft test_pvp_deckel.js)',
  JS.includes('weicherDeckel(attackCombatBonusRaw(planetKey), 1.0)') &&
  JS.includes("weicherDeckel(moduleBonusAt(targetPlanet, 'raidloss'), 0.6)"));
check('2: es gibt keinen hart gedeckelten Topf mehr in der Bilanz',
  !JS.includes('hart:true'));

// ---- 3) Die Zeit-Ersparnisse rechnen am BONUS, nicht am Multiplikator.
// Der alte Code stand als Boden auf dem Multiplikator (Math.max(0.5, 1 - bonus)). Wer den
// weichen Deckel dort einsetzt, ohne umzustellen, rechnet am falschen Ende - deshalb darf
// KEINE dieser Stellen mehr ein Math.max mit Boden haben.
for (const [name, muster] of [
  ['Bauzeit', /Math\.max\(0\.5, 1 - moduleBonusAt\(planetKey, 'buildspeed'\)\)/],
  ['Forschungszeit', /Math\.max\(0\.6, 1 - moduleBonusTotal\('research'\)\)/],
  ['Treibstoff', /Math\.max\(0\.5, 1 - moduleBonusAt\(state\.activeBasePlanet, 'fuelcost'\)/],
  ['Expeditions-Risiko', /Math\.max\(0\.5, 1 - moduleBonusAt\(planetKey, 'exprisk'\)\)/]
]) check('3: ' + name.padEnd(22) + ' hat keinen Multiplikator-Boden mehr', !muster.test(JS));

// Und die Wirkung stimmt der Richtung nach: mehr Bonus = kleinerer Multiplikator, nie negativ.
{
  const multBauzeit = (bonus) => 1 - weicherDeckel(bonus, 0.5);
  check('3: die Bauzeit-Ersparnis waechst weiter, bleibt aber deutlich ueber null',
    multBauzeit(0.6) < multBauzeit(0.5) && multBauzeit(10) > 0.37 && multBauzeit(10) < 0.38,
    { bei60: multBauzeit(0.6).toFixed(4), bei1000: multBauzeit(10).toFixed(4) });
}

// ---- 4) Anzeige und Hilfe (Regel 6: alle Anzeigestellen derselben Groesse)
// Seit v8.477.0 gibt es keinen harten Topf mehr - die Fallunterscheidung `g.hart ? ... : ...`
// ist damit entfallen, die Bilanz rechnet fuer alle Toepfe gleich.
check('4a: die Boni-Bilanz nutzt dieselbe Funktion und weist den Ueberlauf aus',
  JS.includes('const weich = weicherDeckel(roh, deckel);') &&
  JS.includes('ueberlauf: Math.max(0, weich - Math.min(roh, deckel))'));
check('4b: "ohne Wirkung" steht nur noch bei den harten Toepfen',
  JS.includes('der Überlauf bringt noch ${vz}${pct(ueberlauf)}') &&
  JS.includes('const verpufft = Math.max(0, roh - deckel - (ueberlauf||0));'));
check('4c: die beiden Kurztexte sagen "im Ueberlauf" statt "Deckel erreicht"',
  !JS.includes("' (Deckel erreicht)'") && (JS.match(/' \(im Überlauf\)'/g) || []).length === 2);
// Die PvP-Ausnahme ist seit v8.477.0 aufgehoben; der Hilfetext sagt jetzt, dass Spiel und Server
// dieselbe Formel benutzen. Die Pruefung wandert mit dem Text mit, statt ihn nicht mehr zu pruefen.
check('4d: die Hilfe erklaert die Regel und dass sie inzwischen ueberall gilt',
  JS.includes('keine Klippe mehr</strong>') &&
  JS.includes('auf ein Viertel der Obergrenze begrenzt') &&
  JS.includes('folgen seit v8.477.0 derselben Regel'));

ende();
