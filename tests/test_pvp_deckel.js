// PvP-Toepfe am weichen Deckel - und Spiel und Server rechnen dabei GLEICH (v8.477.0).
//
// HINTERGRUND: v8.468.0 stellte zwoelf Toepfe auf den weichen Deckel um und liess die PvP-Toepfe
// bewusst hart - der Server rechnet sie mit, und eine einseitige Umstellung haette Vorschau und
// tatsaechlichen Kampf verschieden rechnen lassen. Jetzt wechseln beide Seiten gemeinsam.
//
// DIE WICHTIGSTE PRUEFUNG IST 2: Beide Fassungen der Formel werden AUS DEN DATEIEN geholt und
// AUSGEFUEHRT, dann ueber einen Wertebereich verglichen. Ein Test, der nur nach dem Wort
// `weicherDeckel` in beiden Dateien sucht, wuerde bestehen, waehrend die eine Seite laengst eine
// andere Kurve rechnet als die andere - genau der Fehler, den CLAUDE.md unter "Backend hat teils
// eigene Kopien von Frontend-Formeln" als wiederkehrend beschreibt.
//
// GEGENPROBE (Arbeitsregel 1, beidseitig ausgefuehrt): am alten Stand (v8.473.0) fallen 1 und 3
// durch (dort stehen die harten Deckel); Abschnitt 2 faellt, sobald man eine der beiden Formeln
// veraendert - beides ausgefuehrt.
const fs = require('fs');
const path = require('path');
const { SPIELDATEI, pruefer, SERVER_JS } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const BE_PFAD = SERVER_JS;
const hatBackend = fs.existsSync(BE_PFAD);
check('Backend-Repo liegt daneben (ohne es ist die Paritaet UNGEPRUEFT)', hatBackend, BE_PFAD);
const BE = hatBackend ? fs.readFileSync(BE_PFAD, 'utf8') : '';

// ---- 1) Die fuenf Verbrauchsstellen im Spiel laufen ueber den weichen Deckel
const STELLEN = [
  ['Angriffsbonus',            'const combatBonus = deckelWeich(attackCombatBonusRaw(planetKey), 1.0);'],
  ['Verteidigungsbonus',       'const combatBonus = deckelWeich(defenseCombatBonusRaw(planetKey), 1.0);'],
  ['Schlachtschiff-Angriff',   "deckelWeich(shipModuleBonusFor('schlachtschiff','atk'), 1.0)"],
  ['T2-Fokusarray-Angriff',    "deckelWeich(shipModuleBonusFor('raffiniert','atk'), 1.0)"],
  ['Ueberfall-Schutz',         "1 - deckelWeich(moduleBonusAt(targetPlanet, 'raidloss'), 0.6)"]
];
for (const [name, fragment] of STELLEN)
  check('1: ' + name.padEnd(24) + ' laeuft ueber den weichen Deckel', JS.includes(fragment));

// Und die harten Fassungen sind WEG - sonst haette jemand danebengeschrieben statt ersetzt.
for (const [name, muster] of [
  ['Angriffsbonus',      'Math.min(1.0, attackCombatBonusRaw'],
  ['Verteidigungsbonus', 'Math.min(1.0, defenseCombatBonusRaw'],
  // BEWUSST nur die beiden atk-Stellen: Der Huellen-Bonus (`shipModuleBonusFor(cls, 'hull')`)
  // bleibt hart gedeckelt. Er ist KEIN PvP-Topf im hier gemeinten Sinn - der Server liest
  // shipModuleBonus ausschliesslich fuer 'atk' und 'siegechance'; 'hull' und 'shield' kommen in
  // server.js ueberhaupt nicht vor (die serverseitige Verteidigung ist laut Kommentar dort ein
  // bewusster Teil-Port). Ihn einseitig weich zu machen wuerde die Anzeige im Spiel aendern, ohne
  // dass sich am Kampf etwas aendert - also genau die Art Auseinanderlaufen, die dieser Umbau
  // gerade beendet. Der erste Anlauf hatte ihn mit einem zu breiten Muster miterfasst.
  ['Schlachtschiff-Angriff', "Math.min(1.0, shipModuleBonusFor('schlachtschiff','atk')"],
  ['T2-Fokusarray-Angriff',  "Math.min(1.0, shipModuleBonusFor('raffiniert','atk')"],
  ['Ueberfall-Schutz',   "Math.max(0.4, 1 - moduleBonusAt(targetPlanet, 'raidloss')"]
]) check('1: der harte Deckel bei ' + name.padEnd(24) + ' ist entfernt', !JS.includes(muster));

/* Und die Gegenrichtung: Der Huellen-Bonus MUSS hart gedeckelt bleiben - jetzt auf BEIDEN Seiten.
   Hier stand bis zum 21.08.2026 "solange der Server ihn nicht kennt" mit der Pruefung, dass 'hull'
   im Backend GAR NICHT vorkommt. Das war richtig und ist ueberholt: Seit der Angleichung der
   Flottenverteidigung rechnet der Server den Huellen-Bonus mit (er hatte dem Verteidiger vorher
   bis zu 100 % unterschlagen). Die Pruefung ist damit nicht schwaecher geworden, sondern
   STAERKER - aus "eine Seite kennt ihn nicht" wird "beide deckeln ihn gleich hart".
   Faellt sie, hat jemand eine der zwei Seiten einseitig auf den weichen Deckel umgestellt, und
   Anzeige und Kampf laufen wieder auseinander. */
check('1: der Huellen-Bonus ist auf BEIDEN Seiten hart gedeckelt',
  JS.includes("Math.min(1.0, shipModuleBonusFor(cls, 'hull'))")
  && /Math\.min\(1\.0, huelle\[klasse\] \|\| 0\)/.test(BE),
  { frontend: JS.includes("Math.min(1.0, shipModuleBonusFor(cls, 'hull'))"),
    backend: /Math\.min\(1\.0, huelle\[klasse\] \|\| 0\)/.test(BE) });

// ---- 2) PARITAET: beide Fassungen ausgefuehrt und verglichen
if (hatBackend){
  const holeFrontend = () => {
    const von = JS.indexOf('const UEBERLAUF_ANTEIL = ');
    const bis = von < 0 ? -1 : JS.indexOf('\n  const PROD_BONUS_CAP', von);
    if (von < 0 || bis < 0) return null;
    return new Function(JS.slice(von, bis) + '\nreturn weicherDeckel;')();
  };
  const holeBackend = () => {
    const von = BE.indexOf('const UEBERLAUF_ANTEIL = ');
    const bis = von < 0 ? -1 : BE.indexOf('\nfunction attackBonusGroup', von);
    if (von < 0 || bis < 0) return null;
    return new Function(BE.slice(von, bis) + '\nreturn weicherDeckel;')();
  };
  const fe = holeFrontend(), be = holeBackend();
  check('2a: beide Fassungen wurden aus den Dateien geholt (Anker existieren)', !!fe && !!be);
  if (fe && be){
    let groessteAbweichung = 0, beispiel = null;
    for (const deckel of [1.0, 0.6]){
      for (let r = 0; r <= deckel * 4; r += deckel / 200){
        const d = Math.abs(fe(r, deckel) - be(r, deckel));
        if (d > groessteAbweichung){ groessteAbweichung = d; beispiel = { roh: r, deckel, fe: fe(r, deckel), be: be(r, deckel) }; }
      }
    }
    check('2b: Spiel und Server rechnen ueber den ganzen Bereich IDENTISCH',
      groessteAbweichung < 1e-12, { groessteAbweichung, beispiel });
    // Und die Kurve ist wirklich die weiche, nicht zufaellig beidseitig hart.
    check('2c: es ist die weiche Kurve (ueber dem Deckel zaehlt noch etwas)',
      fe(1.25, 1.0) > 1.0 && fe(1.25, 1.0) < 1.25 && be(1.25, 1.0) === fe(1.25, 1.0),
      { bei125: fe(1.25, 1.0) });
    check('2d: und sie ist begrenzt (Deckel + ein Viertel)',
      fe(99, 1.0) <= 1.25 + 1e-9 && fe(99, 0.6) <= 0.75 + 1e-9,
      { max100: fe(99, 1.0), max60: fe(99, 0.6) });
  }

  // ---- 3) Die vier Backend-Stellen sind ebenfalls umgestellt
  for (const [name, fragment] of [
    ['Angriffsgruppe',        'return weicherDeckel(b, 1.0 * deckelAusbauServer(save));'],
    ['Schiffsmodul-Angriff',  "return effect === 'atk' ? weicherDeckel(sum, 1.0 * deckelAusbauServer(save)) : sum;"],
    ['Ueberfall-Schutz',      'return 1 - weicherDeckel(roh, 0.6 * deckelAusbauServer(save));']
  ]) check('3: Backend - ' + name.padEnd(22) + ' laeuft ueber den weichen Deckel', BE.includes(fragment));
  check('3: Backend - Angriff UND Verteidigung (zwei Gruppen, nicht eine)',
    (BE.match(/return weicherDeckel\(b, 1\.0 \* deckelAusbauServer\(save\)\);/g) || []).length === 2);
  for (const [name, muster] of [
    ['Bonus-Gruppen',   'return Math.min(1.0, b);'],
    ['Schiffsmodule',   'Math.min(1.0, sum)'],
    ['Ueberfall-Schutz','Math.max(0.4, 1 -']
  ]) check('3: Backend - harter Deckel bei ' + name.padEnd(18) + ' ist entfernt', !BE.includes(muster));
}

// ---- 4) Anzeigestellen mitgezogen (CLAUDE.md Punkt 6)
check('4a: die Boni-Bilanz kennt keine harten Toepfe mehr',
  !JS.includes('hart:true') && JS.includes('const weich = weicherDeckel(roh, deckel);'));
check('4b: die Hilfe nennt die PvP-Ausnahme nicht mehr als bestehend',
  !JS.includes('Angriff, Verteidigung und Überfall-Schutz haben noch die harte Grenze') &&
  JS.includes('folgen seit v8.477.0 derselben Regel'));

ende();
