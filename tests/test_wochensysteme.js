// Woechentlich wachsende Galaxie v8.299.0 (Feature-Wunsch 26.07.2026).
//
// Jede Woche kommen zwei Sternsysteme mit je 5-10 Planeten dazu, erzeugt allein aus dem Wochen-Index.
// Das ist geteilter Weltzustand OHNE Backend - jeder Client rechnet die Galaxie selbst aus. Damit das
// funktioniert, muessen drei Dinge unverhandelbar stimmen, und genau die prueft dieser Test:
//
//   A) DETERMINISMUS - zwei unabhaengige Laeufe muessen fuer denselben Index Zeichen fuer Zeichen
//      dasselbe System liefern. Waere das nicht so, saehen zwei Spieler verschiedene Galaxien und
//      Angriffe/Allianzbasen zeigten ins Leere.
//   B) NUR ANHAENGEN - ein spaeterer Lauf darf an frueher erzeugten Systemen nichts aendern. Sonst
//      koennte eine bereits gegruendete Kolonie unter dem Spieler weg-generiert werden.
//   C) GLEICHE PLANETENROTATION - Orbit-Positionen, Typen und die Formeln fuer Dauer/Beute/
//      Entdeckungsbonus/Kolonisierungskosten muessen zu den bestehenden Planeten passen. Der Wunsch
//      war ausdruecklich "mit der Planetenrotation, wie wir sie jetzt haben".
//
// Dazu die Kadenz selbst (2 pro Woche, kumulativ, gedeckelt) und die Anzeigestellen (CLAUDE.md
// Regel 6): Erfolg, Kompendium und Hilfe muessen dasselbe sagen wie der Code.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------------------------------------------------------------- Datenblöcke aus der Datei ziehen
function arrayLiteral(name){
  const von = src.indexOf('const '+name+' = [');
  if (von < 0) return null;
  const bis = src.indexOf('\n  ];', von);
  if (bis < 0) return null;
  return src.slice(von, bis + 5);
}
const starSrc = arrayLiteral('STAR_SYSTEMS');
const planetSrc = arrayLiteral('PLANETS');
const typeSrc = (() => {
  const von = src.indexOf('const PLANET_TYPE_INFO = {');
  const bis = src.indexOf('\n  };', von);
  return von < 0 || bis < 0 ? null : src.slice(von, bis + 5);
})();
check('Datenblöcke STAR_SYSTEMS/PLANETS/PLANET_TYPE_INFO gefunden', !!starSrc && !!planetSrc && !!typeSrc);

// Der Generator selbst - von der ersten Konstanten bis unmittelbar VOR den Aufruf beim Laden, damit
// der Test selbst bestimmt, welcher Zeitpunkt gilt.
const genVon = src.indexOf('  const WEEKLY_SYSTEMS_PER_WEEK = ');
const genBis = src.indexOf('  extendWeeklySystems(Date.now());');
check('Generator-Block gefunden', genVon > 0 && genBis > genVon);
if (!starSrc || !planetSrc || !typeSrc || genVon < 0 || genBis < genVon){ console.log('\nFAIL'); process.exit(1); }
const genSrc = src.slice(genVon, genBis);

// Eine frische, voneinander unabhängige Ausführung des Generators. Zweimal aufgerufen ergibt das zwei
// vollständig getrennte Galaxien - genau die Ausgangslage zweier Spieler an zwei Rechnern.
function neueGalaxie(){
  return new Function(
    starSrc + '\n' + planetSrc + '\n' + typeSrc + '\n' + genSrc + '\n' +
    'return { STAR_SYSTEMS, PLANETS, BASE_STAR_SYSTEM_COUNT, BASE_PLANET_COUNT, WEEKLY_SYSTEMS_PER_WEEK,' +
    ' WEEKLY_SYSTEM_EPOCH, WEEKLY_SYSTEM_MAX, WEEKLY_ORBIT_POS, WEEKLY_PLANET_TYPES, WEEK_MS,' +
    ' weeklySystemCount, nextWeeklySystemTs, extendWeeklySystems, buildWeeklySystem, baseStarSystems };'
  )();
}

const g = neueGalaxie();
const EPOCH = g.WEEKLY_SYSTEM_EPOCH, WOCHE = g.WEEK_MS;
check('die Epoche ist ein Montag 00:00 UTC', new Date(EPOCH).getUTCDay() === 1 && new Date(EPOCH).getUTCHours() === 0,
  new Date(EPOCH).toISOString());

// ---------------------------------------------------------------- 1: Kadenz
// Der eigentliche Wunsch: "jede Woche zwei Systeme". Als Literale festgenagelt, nicht aus der Datei
// zurueckgelesen - sonst wuerde sich der Test bei einer Aenderung still mit anpassen.
check('1: es sind zwei Systeme pro Woche', g.WEEKLY_SYSTEMS_PER_WEEK === 2, g.WEEKLY_SYSTEMS_PER_WEEK);
check('1: in der Epochenwoche gibt es bereits die ersten zwei', g.weeklySystemCount(EPOCH) === 2, g.weeklySystemCount(EPOCH));
check('1: kurz vor Wochenende immer noch zwei', g.weeklySystemCount(EPOCH + WOCHE - 1000) === 2);
check('1: mit dem Wochenwechsel sind es vier', g.weeklySystemCount(EPOCH + WOCHE) === 4);
check('1: nach 10 Wochen sind es 22', g.weeklySystemCount(EPOCH + 10*WOCHE) === 22, g.weeklySystemCount(EPOCH + 10*WOCHE));
check('1: vor der Epoche gibt es keine', g.weeklySystemCount(EPOCH - 1000) === 0);
for (let w = 0; w <= 12; w++){
  const erwartet = (w+1)*2;
  check('1: Woche '+w+' ergibt '+erwartet+' Systeme', g.weeklySystemCount(EPOCH + w*WOCHE) === erwartet);
}
// Der Deckel ist die Bremse gegen unbegrenztes Wachstum - ohne ihn waeren es nach zehn Jahren 1.040
// Systeme mit ~7.800 Planeten, die an knapp 50 Stellen linear durchsucht werden.
check('1: der Deckel greift', g.weeklySystemCount(EPOCH + 5000*WOCHE) === g.WEEKLY_SYSTEM_MAX, g.WEEKLY_SYSTEM_MAX);
check('1: der Deckel ist eine gerade Zahl (volle Wochen)', g.WEEKLY_SYSTEM_MAX % 2 === 0);
check('1: der Deckel liegt bei 208 (104 Wochen)', g.WEEKLY_SYSTEM_MAX === 208, g.WEEKLY_SYSTEM_MAX);
// Countdown-Anzeige
check('1: der nächste Termin ist der kommende Montag',
  g.nextWeeklySystemTs(EPOCH + 3*WOCHE + 5000) === EPOCH + 4*WOCHE);
check('1: am Deckel gibt es keinen nächsten Termin mehr', g.nextWeeklySystemTs(EPOCH + 5000*WOCHE) === 0);

// ---------------------------------------------------------------- 2: Determinismus (A)
// Zwei getrennte Galaxien, unterschiedlich weit aufgebaut - die Ueberschneidung muss identisch sein.
{
  const a = neueGalaxie(); a.extendWeeklySystems(EPOCH + 20*WOCHE); // 42 Systeme
  const b = neueGalaxie(); b.extendWeeklySystems(EPOCH + 3*WOCHE);  // 8 Systeme
  const aNeu = a.STAR_SYSTEMS.slice(a.BASE_STAR_SYSTEM_COUNT);
  const bNeu = b.STAR_SYSTEMS.slice(b.BASE_STAR_SYSTEM_COUNT);
  check('2: Lauf A hat 42 neue Systeme', aNeu.length === 42, aNeu.length);
  check('2: Lauf B hat 8 neue Systeme', bNeu.length === 8, bNeu.length);
  check('2: die ersten 8 Systeme sind in beiden Läufen identisch',
    JSON.stringify(aNeu.slice(0,8)) === JSON.stringify(bNeu), { a: aNeu[0], b: bNeu[0] });
  const aP = a.PLANETS.slice(a.BASE_PLANET_COUNT).filter(p => bNeu.some(s => s.id === p.system));
  const bP = b.PLANETS.slice(b.BASE_PLANET_COUNT);
  check('2: auch alle Planeten dieser 8 Systeme sind identisch',
    JSON.stringify(aP) === JSON.stringify(bP), { anzahl: [aP.length, bP.length] });
}

// ---------------------------------------------------------------- 3: nur anhängen (B)
{
  const c = neueGalaxie();
  const sysVorher = JSON.stringify(c.STAR_SYSTEMS);
  const plVorher = JSON.stringify(c.PLANETS);
  check('3: vor dem ersten Aufruf ist nichts angehängt',
    c.STAR_SYSTEMS.length === c.BASE_STAR_SYSTEM_COUNT && c.PLANETS.length === c.BASE_PLANET_COUNT);
  c.extendWeeklySystems(EPOCH);
  const nach2 = JSON.stringify(c.STAR_SYSTEMS.slice(0, c.BASE_STAR_SYSTEM_COUNT + 2));
  check('3: die fest eingetragene Galaxie bleibt unangetastet',
    JSON.stringify(c.STAR_SYSTEMS.slice(0, c.BASE_STAR_SYSTEM_COUNT)) === sysVorher);
  check('3: auch die fest eingetragenen Planeten bleiben unangetastet',
    JSON.stringify(c.PLANETS.slice(0, c.BASE_PLANET_COUNT)) === plVorher);
  const zuwachs1 = c.extendWeeklySystems(EPOCH + 4*WOCHE);
  check('3: ein späterer Aufruf hängt genau die fehlenden an', zuwachs1 === 8, zuwachs1);
  check('3: und lässt die zuvor erzeugten unverändert',
    JSON.stringify(c.STAR_SYSTEMS.slice(0, c.BASE_STAR_SYSTEM_COUNT + 2)) === nach2);
  check('3: ein Aufruf ohne Zuwachs ändert nichts', c.extendWeeklySystems(EPOCH + 4*WOCHE) === 0);
  check('3: ein Aufruf mit ÄLTEREM Zeitpunkt entfernt nichts',
    c.extendWeeklySystems(EPOCH) === 0 && c.STAR_SYSTEMS.length === c.BASE_STAR_SYSTEM_COUNT + 10,
    c.STAR_SYSTEMS.length - c.BASE_STAR_SYSTEM_COUNT);
}

// ---------------------------------------------------------------- 4: Planetenrotation (C)
const voll = neueGalaxie();
voll.extendWeeklySystems(EPOCH + 5000*WOCHE); // alles bis zum Deckel, damit auch Randfälle drankommen
const neueSysteme = voll.STAR_SYSTEMS.slice(voll.BASE_STAR_SYSTEM_COUNT);
const neuePlaneten = voll.PLANETS.slice(voll.BASE_PLANET_COUNT);
check('4: der Deckel erzeugt genau '+voll.WEEKLY_SYSTEM_MAX+' Systeme', neueSysteme.length === voll.WEEKLY_SYSTEM_MAX, neueSysteme.length);

{
  // Die zehn Orbit-Positionen, abgelesen an gx261..gx270 der bestehenden Erweiterung. Bewusst hier
  // im Test noch einmal ausgeschrieben statt aus der Datei gezogen: Wer die Rotation im Spiel
  // umbaut, soll hier eine Warnung bekommen und nicht stillschweigend recht behalten.
  const ROTATION = [[260,150],[380,55],[470,160],[570,70],[150,170],[380,170],[570,170],[260,55],[470,55],[150,70]];
  check('4: die Rotation im Code stimmt mit der bestehenden Galaxie überein',
    JSON.stringify(voll.WEEKLY_ORBIT_POS) === JSON.stringify(ROTATION), voll.WEEKLY_ORBIT_POS);

  const proSystem = {};
  for (const p of neuePlaneten) (proSystem[p.system] = proSystem[p.system] || []).push(p);
  let minP = 99, maxP = 0, orbitFehler = 0, posFehler = 0, dauerFehler = 0;
  for (const s of neueSysteme){
    const ps = proSystem[s.id] || [];
    minP = Math.min(minP, ps.length); maxP = Math.max(maxP, ps.length);
    ps.forEach((p, i) => {
      if (p.orbit !== i+1) orbitFehler++;
      if (p.x !== ROTATION[i][0] || p.y !== ROTATION[i][1]) posFehler++;
      if (i > 0 && p.duration <= ps[i-1].duration) dauerFehler++;
    });
  }
  check('4: jedes System hat mindestens 5 Planeten', minP >= 5, minP);
  check('4: und höchstens 10', maxP <= 10, maxP);
  // Beide Grenzen muessen auch WIRKLICH vorkommen - sonst waere z.B. ein fest verdrahtetes "immer 7"
  // unauffaellig durchgegangen.
  check('4: die Spanne wird ausgeschöpft (5 kommt vor)', minP === 5, minP);
  check('4: die Spanne wird ausgeschöpft (10 kommt vor)', maxP === 10, maxP);
  check('4: die Orbits sind lückenlos von 1 an durchnummeriert', orbitFehler === 0, orbitFehler);
  check('4: jeder Planet sitzt auf der Position seiner Orbit-Nummer', posFehler === 0, posFehler);
  check('4: die Erkundungsdauer steigt mit dem Orbit', dauerFehler === 0, dauerFehler);
}

{
  // Die Formeln, abgelesen an den bestehenden Planeten (z.B. gx261: 58 Deuterium, discoveryBonus 55,
  // colonizeCost 694 = 58x12). Weicht der Generator davon ab, waere ein neues System entweder
  // wertlos oder eine Goldgrube - beides waere ein Balance-Bruch.
  let bonusFehler = 0, kostenFehler = 0, typFehler = 0, leerFehler = 0;
  const typen = new Set(voll.WEEKLY_PLANET_TYPES.map(t => t.type));
  const typInfo = new Function(typeSrc + '\nreturn PLANET_TYPE_INFO;')();
  for (const p of neuePlaneten){
    if (!typen.has(p.type) || !typInfo[p.type]) typFehler++;
    if (!p.reward || !Object.keys(p.reward).length) leerFehler++;
    for (const r in p.reward){
      if (p.discoveryBonus[r] !== Math.max(1, Math.round(p.reward[r]*0.96))) bonusFehler++;
      if (p.colonizeCost[r] !== p.reward[r]*12) kostenFehler++;
    }
  }
  check('4: alle Planetentypen sind im Spiel bekannte Typen', typFehler === 0, typFehler);
  check('4: kein Planet ohne Beute', leerFehler === 0, leerFehler);
  check('4: Entdeckungsbonus ist überall 96% der Beute', bonusFehler === 0, bonusFehler);
  check('4: Kolonisierungskosten sind überall das 12-fache der Beute', kostenFehler === 0, kostenFehler);

  // Groessenordnung gegen die bestehende Galaxie: die neuen Systeme duerfen weder billiger noch
  // reicher sein als das, was schon da ist.
  const bestehend = voll.PLANETS.slice(0, voll.BASE_PLANET_COUNT);
  const maxAlt = Math.max(...bestehend.map(p => p.duration));
  const minAlt = Math.min(...bestehend.map(p => p.duration));
  const maxNeu = Math.max(...neuePlaneten.map(p => p.duration));
  const minNeu = Math.min(...neuePlaneten.map(p => p.duration));
  check('4: keine Erkundung dauert länger als die längste bestehende', maxNeu <= maxAlt, { neu: maxNeu, alt: maxAlt });
  check('4: und keine ist kürzer als die kürzeste bestehende', minNeu >= minAlt, { neu: minNeu, alt: minAlt });
  const groesteBeute = Math.max(...neuePlaneten.map(p => Math.max(...Object.values(p.reward))));
  const groesteAlt = Math.max(...bestehend.map(p => Math.max(...Object.values(p.reward))));
  check('4: die größte Beute übertrifft die bestehende Galaxie nicht', groesteBeute <= groesteAlt, { neu: groesteBeute, alt: groesteAlt });
}

// ---------------------------------------------------------------- 5: Eindeutigkeit
{
  const sysIds = voll.STAR_SYSTEMS.map(s => s.id);
  const plIds = voll.PLANETS.map(p => p.id);
  check('5: alle System-IDs sind eindeutig', new Set(sysIds).size === sysIds.length,
    sysIds.length - new Set(sysIds).size);
  check('5: alle Planeten-IDs sind eindeutig', new Set(plIds).size === plIds.length,
    plIds.length - new Set(plIds).size);
  const sysNamen = voll.STAR_SYSTEMS.map(s => s.name);
  const plNamen = voll.PLANETS.map(p => p.name);
  check('5: alle Systemnamen sind eindeutig (auch gegen die bestehenden)',
    new Set(sysNamen).size === sysNamen.length, sysNamen.length - new Set(sysNamen).size);
  check('5: alle Planetennamen sind eindeutig (auch gegen die bestehenden)',
    new Set(plNamen).size === plNamen.length, plNamen.length - new Set(plNamen).size);
  check('5: jeder neue Planet verweist auf ein existierendes System',
    neuePlaneten.every(p => sysIds.includes(p.system)));
  // Die neuen Systeme muessen sich an der ID von den fest eingetragenen unterscheiden lassen - sonst
  // koennte baseStarSystems() sie nicht sauber ausklammern.
  check('5: alle neuen Systeme tragen das eigene ID-Präfix', neueSysteme.every(s => s.id.indexOf('sysw_') === 0));
  check('5: kein bestehendes System trägt dieses Präfix',
    voll.baseStarSystems().every(s => s.id.indexOf('sysw_') !== 0));
  check('5: baseStarSystems liefert genau die fest eingetragenen',
    voll.baseStarSystems().length === voll.BASE_STAR_SYSTEM_COUNT, voll.baseStarSystems().length);
}

// ---------------------------------------------------------------- 6: Lage in der Galaxie
{
  // Die neuen Systeme sollen AUSSEN anwachsen, nicht zwischen die bestehenden gestreut werden - sonst
  // saehe die Karte nach ein paar Monaten aus wie ein Kuddelmuddel und "Sektor"-Entfernungen
  // (Abhorchposten-Reichweite) verloeren ihren Sinn.
  const basis = voll.baseStarSystems();
  const cx = basis.reduce((a,s)=>a+s.gx,0)/basis.length, cy = basis.reduce((a,s)=>a+s.gy,0)/basis.length;
  const rAlt = Math.max(...basis.map(s => Math.hypot(s.gx-cx, s.gy-cy)));
  const rNeuMin = Math.min(...neueSysteme.map(s => Math.hypot(s.gx-cx, s.gy-cy)));
  check('6: alle neuen Systeme liegen außerhalb der bestehenden Galaxie', rNeuMin > rAlt, { rNeuMin: Math.round(rNeuMin), rAlt: Math.round(rAlt) });
  const rNeuMax = Math.max(...neueSysteme.map(s => Math.hypot(s.gx-cx, s.gy-cy)));
  check('6: und die Galaxie wächst dabei höchstens auf das Doppelte', rNeuMax < rAlt*2, { rNeuMax: Math.round(rNeuMax), rAlt: Math.round(rAlt) });
  // Abstand zum naechsten Nachbarn: muss in der Groessenordnung der bestehenden Galaxie bleiben,
  // sonst stimmt SECTOR_UNIT_DISTANCE (65) fuer die neuen Systeme nicht mehr.
  let minAbstand = Infinity;
  for (let i = 0; i < neueSysteme.length; i++){
    for (let j = i+1; j < neueSysteme.length; j++){
      minAbstand = Math.min(minAbstand, Math.hypot(neueSysteme[i].gx-neueSysteme[j].gx, neueSysteme[i].gy-neueSysteme[j].gy));
    }
  }
  check('6: keine zwei neuen Systeme liegen aufeinander', minAbstand > 10, Math.round(minAbstand));
}

// ---------------------------------------------------------------- 7: Anzeigestellen (CLAUDE.md 6)
{
  // Erfolg und Kompendium duerfen NICHT gegen die wachsende Gesamtzahl zaehlen - sonst waere ein
  // einmal abgeschlossenes Sammelziel jeden Montag wieder aberkannt.
  const erfolg = (src.match(/\{ key:'allsystems',[^\n]*/)||[''])[0];
  check('7: der Erfolg „Grenzgänger" zählt gegen die Kern-Galaxie',
    erfolg.includes('baseStarSystems()') && erfolg.includes('BASE_STAR_SYSTEM_COUNT'), erfolg.slice(0,120));
  // Bewusst schaerfer als "nicht mehr STAR_SYSTEMS.length": Waere nur EINE der beiden Haelften
  // (check/progress) zurueckgedreht, zeigte der Fortschritt "72/69" - die Rot-Pruefung hat genau das
  // durchgelassen, bis diese Zeile dazukam.
  check('7: der Erfolg fasst STAR_SYSTEMS überhaupt nicht mehr an', !/STAR_SYSTEMS/.test(erfolg), erfolg.slice(0,200));
  check('7: seine Beschreibung sagt „Kernsystem"', /key:'allsystems'[^\n]*Kernsystem/.test(src), erfolg.slice(0,160));

  const komp = src.slice(src.indexOf('const COMPENDIUM_CATS = ['), src.indexOf("{ key:'bosses'"));
  check('7: das Kompendium zählt Planeten gegen BASE_PLANET_COUNT', komp.includes('total:()=>BASE_PLANET_COUNT'));
  check('7: das Kompendium zählt Systeme gegen BASE_STAR_SYSTEM_COUNT', komp.includes('total:()=>BASE_STAR_SYSTEM_COUNT'));
  check('7: entdeckte Planeten werden auf die Kern-Galaxie gefiltert', komp.includes('BASE_PLANET_IDS.has(k)'));
  check('7: das Kompendium nennt nicht mehr STAR_SYSTEMS.length/PLANETS.length',
    !/total:\(\)=>(STAR_SYSTEMS|PLANETS)\.length/.test(komp));

  // Die Hilfe muss dieselbe Kadenz nennen wie der Code.
  const hVon = src.indexOf("title:'Die Galaxie wächst jede Woche'");
  check('7: es gibt einen Hilfe-Abschnitt dazu', hVon > 0);
  const hilfe = hVon > 0 ? src.slice(hVon, src.indexOf("' },", hVon)) : '';
  check('7: die Hilfe nennt „zwei weitere Sternsysteme"', /zwei weitere Sternsysteme/.test(hilfe));
  check('7: die Hilfe nennt „5 bis 10 Planeten"', /5 bis 10<\/strong> Planeten|5 bis 10 Planeten/.test(hilfe));
  check('7: die Hilfe nennt den Montag und UTC', /Montag/.test(hilfe) && /UTC/.test(hilfe));
  check('7: die Hilfe erklärt die Ausnahme für Erfolg und Kompendium',
    /Grenzgänger/.test(hilfe) && /Kompendium/.test(hilfe));
  // Die alte, jetzt falsche Systemzahl darf nirgends mehr in einem Live-Text stehen (Patchnotes sind
  // unveraenderliche Historie und bleiben ausgenommen).
  const hilfeAlles = src.slice(src.indexOf('const HELP_SECTIONS = ['), src.indexOf('const TUTORIAL_STEPS'));
  check('7: kein Hilfetext behauptet mehr eine feste Systemzahl', !/~6[0-9] Systemen/.test(hilfeAlles),
    (hilfeAlles.match(/~\d+ Systemen/g)||[]));

  // Anzeige unter der Karte
  check('7: unter der Galaxie-Karte steht der Wachstums-Hinweis', src.includes('id="galaxyGrowthLine"'));
  // Muss dieselbe Zahl nennen wie die Navigation darunter („System 1/69"), also die SICHTBAREN
  // Systeme - mit STAR_SYSTEMS.length stünden hier die zwei noch unentdeckten Geheimsysteme mit drin.
  check('7: er nennt die Zahl der kartierten Systeme', src.includes("visSys.length+' Sternsysteme kartiert'"));
  check('7: er zeigt den Countdown bis zu den nächsten', src.includes("' neue in '"));

  // Der Spieler muss von neuen Systemen ERFAHREN, sonst tauchen sie unbemerkt am Kartenrand auf.
  check('7: es gibt eine Log-Meldung für neu erschienene Systeme', /Die Fernaufklärung hat/.test(src));
  check('7: sie wird im Haupt-Tick ausgelöst', /const neueSysteme = syncWeeklySystems\(\);/.test(src));
  check('7: und der Spielstand wird danach gesichert', /\|\| neueSysteme\) save\(\);/.test(src));
  check('7: der gemeldete Stand steckt im Spielstand', /weeklySystemsSeen: weeklySystemCount\(\)/.test(src));
}

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
