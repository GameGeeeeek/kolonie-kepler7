// Komplett-Tag-Bonus der Tagesaufgaben v8.298.29.
//
// Ausgangslage: Die EINZELbelohnungen skalieren mit "5 Minuten eigener Produktion". Bei fuenf
// Aufgaben taeglich sind das rund 25 Minuten - gegen die 1440 Minuten, die ein Tag ohnehin
// produziert, unter 2%. Fuer ein entwickeltes Konto also belanglos.
//
// Die naheliegende Antwort (mehr Minuten) ist genau die Formel, die am 13.07.2026 von 30 auf 5
// GESENKT wurde und vor der CLAUDE.md ausdruecklich warnt. Sie bleibt deshalb unangetastet - dieser
// Test nagelt das ausdruecklich fest. Stattdessen zahlt der Komplett-Tag-Bonus in Waehrungen, die
// NICHT mit der Produktion mitwachsen.
//
// Geprueft wird:
//   1) die 5-Minuten-Formel der Einzelbelohnung ist unveraendert (300 Sekunden, Flat als Untergrenze)
//   2) der Komplett-Tag-Bonus zahlt Kredite, Modulfragmente und Kommandopunkte
//   3) alle drei haengen an der Serienlaenge und sind bei DAILY_STREAK_CAP gedeckelt
//   4) schon der erste Komplett-Tag gibt mindestens ein Modulfragment (kein Leerlauf)
//   5) die Groessenordnung bleibt im Rahmen der uebrigen Fragment-/Kommandopunkt-Quellen
//   6) der Bonus faellt NUR, wenn wirklich alle Aufgaben abgeholt sind
//   7) die Hilfe nennt die Zahlen - und zwar dieselben wie der Code (CLAUDE.md Regel 6)
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// Die vier Balance-Zahlen direkt aus der Datei.
const zahl = (re, was) => { const m = src.match(re); check('Konstante '+was+' gefunden', !!m); return m ? Number(m[1]) : null; };
const CAP = zahl(/const DAILY_STREAK_CAP = (\d+);/, 'DAILY_STREAK_CAP');
const CREDITS = zahl(/const DAILY_ALLDONE_CREDITS = (\d+);/, 'DAILY_ALLDONE_CREDITS');
const FRAG_EVERY = zahl(/const DAILY_ALLDONE_FRAGMENT_EVERY = (\d+);/, 'DAILY_ALLDONE_FRAGMENT_EVERY');
const CP_EVERY = zahl(/const DAILY_ALLDONE_CP_EVERY = (\d+);/, 'DAILY_ALLDONE_CP_EVERY');

// ---------------------------------------------------------------- Bonus-Block ausführbar machen
const von = src.indexOf('    const activeKeys = state.dailyQuests.activeKeys||[];');
const bis = src.indexOf('\n    }', src.indexOf('checkAchievements();', von)) + 6;
check('Bonus-Block gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const block = src.slice(von, bis);

function zahleAus(streak, alleAbgeholt){
  const state = {
    dailyQuestStreak: streak,
    dailyQuests: { activeKeys:['a','b','c'], claimed: alleAbgeholt === false ? { a:true, b:true } : { a:true, b:true, c:true } },
    credits: 0, moduleFragments: 0, commandPoints: 0
  };
  const meldungen = [];
  new Function('state', 'log', 'checkAchievements', 'DAILY_STREAK_CAP', 'DAILY_ALLDONE_CREDITS',
    'DAILY_ALLDONE_FRAGMENT_EVERY', 'DAILY_ALLDONE_CP_EVERY', block
  )(state, t => meldungen.push(t), () => {}, CAP, CREDITS, FRAG_EVERY, CP_EVERY);
  return { state, meldungen };
}

// ---------------------------------------------------------------- 1: Einzelbelohnung unangetastet
// Das ist die Zusicherung, dass hier NICHT an der gefaehrlichen Formel gedreht wurde.
check('1: die Einzelbelohnung rechnet weiterhin mit 300 Sekunden Produktion',
  /const scaled = Math\.max\(a, Math\.round\(\(questRates\[r\]\|\|0\) \* 300\)\);/.test(src));
check('1: der Fixwert bleibt die Untergrenze (Math.max, nicht Math.min)',
  /Math\.max\(a, Math\.round\(\(questRates\[r\]\|\|0\) \* 300\)\)/.test(src));
check('1: Kredite der Einzelaufgaben bleiben fix (keine Produktionsskalierung)',
  /if \(r === 'credits'\)\{ state\.credits = \(state\.credits\|\|0\) \+ a; \}/.test(src));

// ---------------------------------------------------------------- 2+3+4: der neue Bonus
{
  const erst = zahleAus(0, true);   // erster Komplett-Tag -> streakMult 1
  check('2: der erste Komplett-Tag zahlt Kredite', erst.state.credits === CREDITS*1, erst.state.credits);
  check('4: und mindestens ein Modulfragment', erst.state.moduleFragments >= 1, erst.state.moduleFragments);
  check('4: Kommandopunkte gibt es am ersten Tag noch nicht', erst.state.commandPoints === 0, erst.state.commandPoints);
  check('2: die Meldung nennt Kredite und Modulfragmente',
    /Kredite/.test(erst.meldungen[0]) && /Modulfragment/.test(erst.meldungen[0]), erst.meldungen[0]);
}
{
  // Alle Serienlaengen durchrechnen: streng monoton bis zum Deckel, danach konstant.
  const reihe = [];
  for (let st = 0; st <= CAP + 3; st++){
    const r = zahleAus(st, true).state;
    reihe.push([r.credits, r.moduleFragments, r.commandPoints]);
  }
  const beiCap = reihe[CAP-1];
  check('3: Kredite steigen mit der Serie', reihe[0][0] < reihe[3][0] && reihe[3][0] < beiCap[0], [reihe[0][0], reihe[3][0], beiCap[0]]);
  check('3: Modulfragmente steigen mit der Serie', reihe[0][1] < beiCap[1], [reihe[0][1], beiCap[1]]);
  check('3: Kommandopunkte steigen mit der Serie', reihe[0][2] < beiCap[2], [reihe[0][2], beiCap[2]]);
  // Der Deckel ist das Entscheidende - ohne ihn waere es wieder eine unbegrenzte Formel.
  for (let st = CAP; st <= CAP + 3; st++){
    check('3: ab Serie '+CAP+' kommt nichts mehr dazu (Serientag '+st+')',
      JSON.stringify(reihe[st]) === JSON.stringify(beiCap), { bei: reihe[st], deckel: beiCap });
  }
  check('3: der Kredit-Deckel ist '+(CREDITS*CAP), beiCap[0] === CREDITS*CAP, beiCap[0]);
  check('3: der Fragment-Deckel ist '+Math.floor(CAP/FRAG_EVERY), beiCap[1] === Math.floor(CAP/FRAG_EVERY), beiCap[1]);
  check('3: der Kommandopunkt-Deckel ist '+Math.floor(CAP/CP_EVERY), beiCap[2] === Math.floor(CAP/CP_EVERY), beiCap[2]);
}

// ---------------------------------------------------------------- 5: Größenordnung
// Gegenprobe an bestehenden Quellen: ein Gold-Fraktionsauftrag gibt QUEST_GOLD_FRAGMENTS Fragmente,
// die Legion-Offiziersschulung 40 Kommandopunkte. Der Tagesbonus darf beides nicht in den Schatten
// stellen - sonst waere die naechste Beschwerde, dass sich die Fraktionen nicht mehr lohnen.
{
  const goldFrag = Number((src.match(/const QUEST_GOLD_FRAGMENTS = (\d+);/)||[])[1]);
  check('5: der Gold-Auftrag als Vergleichsmaß gefunden', !!goldFrag, goldFrag);
  const maxFrag = Math.floor(CAP/FRAG_EVERY);
  check('5: der Tagesbonus bleibt unter einem Gold-Auftrag an Fragmenten', maxFrag < goldFrag, { tagesbonus: maxFrag, goldauftrag: goldFrag });
  const maxCp = Math.floor(CAP/CP_EVERY);
  check('5: die Kommandopunkte bleiben deutlich unter der Offiziersschulung (40)', maxCp <= 5, maxCp);
  check('5: der Kredit-Bonus bleibt unter einem Kartell-Ladenposten (15.000)', CREDITS*CAP < 15000, CREDITS*CAP);
}

// ---------------------------------------------------------------- 6: nur bei WIRKLICH allen
{
  const unvollstaendig = zahleAus(5, false);
  check('6: bei einer offenen Aufgabe gibt es keinen Bonus',
    unvollstaendig.state.credits === 0 && unvollstaendig.state.moduleFragments === 0 && unvollstaendig.state.commandPoints === 0,
    [unvollstaendig.state.credits, unvollstaendig.state.moduleFragments, unvollstaendig.state.commandPoints]);
  check('6: und auch keine Meldung', unvollstaendig.meldungen.length === 0, unvollstaendig.meldungen);
}

// ---------------------------------------------------------------- 7: Hilfe nennt dieselben Zahlen
{
  const h = src.slice(src.indexOf("title:'Tagesaufgaben'"));
  const hilfe = h.slice(0, h.indexOf("' },"));
  check('7: die Hilfe nennt den Komplett-Tag-Bonus', /Komplett-Tag-Bonus/.test(hilfe));
  check('7: die Hilfe nennt die Kredite je Serientag', hilfe.includes(CREDITS+' je Serientag'), CREDITS);
  check('7: die Hilfe nennt den Kredit-Deckel', hilfe.includes('bis '+(CREDITS*CAP)), CREDITS*CAP);
  check('7: die Hilfe nennt die Modulfragmente', /Modulfragmente/.test(hilfe));
  check('7: die Hilfe nennt die Fragment-Spanne', hilfe.includes('1 bis '+Math.floor(CAP/FRAG_EVERY)), Math.floor(CAP/FRAG_EVERY));
  check('7: die Hilfe nennt die Kommandopunkte', /Kommandopunkte/.test(hilfe));
  check('7: die Hilfe nennt den Kommandopunkt-Deckel', hilfe.includes('bis '+Math.floor(CAP/CP_EVERY)), Math.floor(CAP/CP_EVERY));
  check('7: die Hilfe nennt die maximale Serienlänge', hilfe.includes('maximal '+CAP+' Tage'), CAP);
  // Und sie muss den Grund benennen - sonst wirkt der Bonus wie eine willkuerliche Zugabe.
  check('7: die Hilfe erklärt, warum es gerade diese Währungen sind',
    /wachsen bewusst <em>nicht<\/em> mit deiner Wirtschaft/.test(hilfe));
  check('7: die alte Formulierung „Kredit-Bonus" ist weg',
    !/erhält zusätzlich einen Kredit-Bonus/.test(src));
}

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
