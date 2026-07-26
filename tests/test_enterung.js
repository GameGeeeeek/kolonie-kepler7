// Enterung v8.301.0 (Spieler-Wunsch 26.07.2026, Pakete E1+E2+E3).
//
// Das Enterschiff hiess seit dem 18.07.2026 so und enterte nichts. Neu ist eine vierte Kampfphase
// nach den drei bestehenden, die bei Erfolg gegnerische Schiffe kapert, dabei aber das Truemmerfeld
// schmaelert - und Prisengut als geschlossene Waehrungsschleife dazu.
//
// Geprueft wird:
//   1) die Balance-Zahlen stehen als Konstanten im Code (als Literale festgenagelt)
//   2) boardingCapacity/boardingChance rechnen richtig, inklusive Enterhaken-Ausbau
//   3) resolveBoarding kapert nur kaperbare Klassen und ENTFERNT sie aus der Gegnerflotte
//      (das ist der Truemmerfeld-Preis - ohne diese Entfernung waere die Enterung Gratis-Beute)
//   4) ein Fehlschlag kostet Enterschiffe und kapert nichts
//   5) ohne Enterschiff passiert gar nichts (Rueckwaertskompatibilitaet aller bestehenden Kaempfe)
//   6) der Prisenhof: feste Preise, drei Angebote, gedeckelter Enterhaken-Ausbau
//   7) alle Anzeigestellen sagen dasselbe wie der Code (CLAUDE.md Regel 6)
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------------------------------------------------------------- Mechanik ausführbar machen
const von = src.indexOf('  const BOARD_POWER_PER_SHIP');
const bis = src.indexOf('  // ===== Verteidigungs-Aufstellung');
check('Enterungs-Block gefunden', von > 0 && bis > von);
const gewVon = src.indexOf('  const SHIP_SCORE_WEIGHTS = {');
const gewBis = src.indexOf('\n  };', gewVon) + 5;
check('SHIP_SCORE_WEIGHTS gefunden', gewVon > 0 && gewBis > gewVon);
if (von < 0 || bis < von || gewVon < 0){ console.log('\nFAIL'); process.exit(1); }

// applyCombatLosses wird als Attrappe uebergeben: die echte Funktion haengt an Veteranen-XP,
// Truemmerfeldern und Hyperjaeger-Boni - hier interessiert nur, DASS sie mit den richtigen
// Argumenten gerufen wird und wie viel sie abzieht.
// `flotten` sind die Flotten, die allFleets() liefert - ownsEnterschiffe() haengt daran und
// entscheidet, ob ein Kampf ohne mitfliegendes Enterschiff die Enterphase ueberhaupt erwaehnt.
// Vorgabe: leer, der Spieler besitzt also keine Enterschiffe.
function bau(zustand, flotten){
  const rufe = [];
  const allFleets = () => (flotten || []);
  const applyCombatLosses = (fleet, keys, pct, planetKey, pool) => {
    rufe.push({ keys:[...keys], pct, planetKey });
    const verloren = {};
    for (const k of keys){
      const n = (pool||fleet)[k]||0;
      const weg = Math.min(n, Math.round(n*pct));
      if (weg > 0){ fleet[k] = Math.max(0, (fleet[k]||0)-weg); verloren[k] = weg; }
    }
    return verloren;
  };
  const api = new Function('state', 'applyCombatLosses', 'allFleets',
    src.slice(gewVon, gewBis) + '\n' + src.slice(von, bis) +
    '\nreturn { BOARD_POWER_PER_SHIP, BOARD_CAPACITY_PER_SHIP, BOARD_CAPTURE_CAP, BOARD_MAX_SHIP_WEIGHT,' +
    ' BOARD_CHANCE_MIN, BOARD_CHANCE_MAX, BOARD_FAIL_LOSS, PRISENGUT_PER_WEIGHT, ENTERHAKEN_MAX,' +
    ' ENTERHAKEN_COSTS, ENTERHAKEN_CHANCE_PER, ENTERHAKEN_SLOT_PER, SHIP_SCORE_WEIGHTS,' +
    ' enterhakenLevel, boardingCapacity, boardingChance, isBoardable, resolveBoarding, ownsEnterschiffe };'
  )(zustand, applyCombatLosses, allFleets);
  api.__rufe = rufe;
  return api;
}
const K = bau({ enterhaken:0 });

// ---------------------------------------------------------------- 1: Balance-Zahlen
// Als Literale festgezurrt, damit eine Aenderung hier auffaellt und nicht still mitwandert.
check('1: zwei Enterschiffe tragen einen Kaperplatz', K.BOARD_CAPACITY_PER_SHIP === 0.5, K.BOARD_CAPACITY_PER_SHIP);
check('1: höchstens 10 Prisen je Kampf', K.BOARD_CAPTURE_CAP === 10, K.BOARD_CAPTURE_CAP);
check('1: kaperbar nur bis Punktegewicht 45', K.BOARD_MAX_SHIP_WEIGHT === 45, K.BOARD_MAX_SHIP_WEIGHT);
check('1: Fehlschlag kostet 30% der Enterschiffe', K.BOARD_FAIL_LOSS === 0.30, K.BOARD_FAIL_LOSS);
check('1: Enterhaken-Ausbau hat 5 Stufen', K.ENTERHAKEN_MAX === 5 && K.ENTERHAKEN_COSTS.length === 5, K.ENTERHAKEN_COSTS);
check('1: die Ausbaukosten steigen streng', K.ENTERHAKEN_COSTS.every((c,i)=> i===0 || c > K.ENTERHAKEN_COSTS[i-1]), K.ENTERHAKEN_COSTS);
check('1: Chancen-Deckel unter 100%', K.BOARD_CHANCE_MAX < 1 && K.BOARD_CHANCE_MIN > 0, [K.BOARD_CHANCE_MIN, K.BOARD_CHANCE_MAX]);

// Genau die Klassen, die kaperbar sein sollen - und keine der Grossen.
{
  const kaperbar = ['jaeger','ships','cruisers','carrier','destroyers','bomber'];
  const tabu = ['schlachtschiff','leerenjaeger','superschlachtschiff','mondzerstoerer','fusionsdreadnought'];
  check('1: kleine und mittlere Klassen sind kaperbar', kaperbar.every(k => K.isBoardable(k)), kaperbar.filter(k=>!K.isBoardable(k)));
  check('1: Großschiffe sind NICHT kaperbar', tabu.every(k => !K.isBoardable(k)), tabu.filter(k=>K.isBoardable(k)));
}

// ---------------------------------------------------------------- 2: Kapazität und Chance
check('2: ohne Enterschiff kein Kaperplatz', K.boardingCapacity({}) === 0);
check('2: ein Enterschiff reicht noch nicht', K.boardingCapacity({ enterschiff:1 }) === 0);
check('2: zwei Enterschiffe geben einen Platz', K.boardingCapacity({ enterschiff:2 }) === 1);
check('2: zehn geben fünf', K.boardingCapacity({ enterschiff:10 }) === 5);
check('2: der Deckel greift', K.boardingCapacity({ enterschiff:400 }) === K.BOARD_CAPTURE_CAP, K.boardingCapacity({ enterschiff:400 }));
check('2: ohne Enterschiff keine Chance', K.boardingChance({}, 100) === 0);
{
  const schwach = K.boardingChance({ enterschiff:2 }, 400);
  const stark = K.boardingChance({ enterschiff:60 }, 400);
  check('2: mehr Enterschiffe = höhere Chance', stark > schwach, [schwach, stark]);
  check('2: die Chance bleibt unter dem Deckel', stark <= K.BOARD_CHANCE_MAX + 1e-9, stark);
  check('2: und über dem Mindestwert', schwach >= K.BOARD_CHANCE_MIN - 1e-9, schwach);
  const zaeh = K.boardingChance({ enterschiff:10 }, 50);
  const zaeher = K.boardingChance({ enterschiff:10 }, 900);
  check('2: mehr überlebender Widerstand = geringere Chance', zaeher < zaeh, [zaeh, zaeher]);
}
{
  // Enterhaken-Ausbau: additiv auf die Chance, +1 Platz je Stufe - beides gedeckelt.
  const A = bau({ enterhaken:0 }), B = bau({ enterhaken:3 }), C = bau({ enterhaken:99 });
  check('2: Ausbaustufe 3 gibt drei Plätze mehr',
    B.boardingCapacity({ enterschiff:10 }) === A.boardingCapacity({ enterschiff:10 }) + 3,
    [A.boardingCapacity({ enterschiff:10 }), B.boardingCapacity({ enterschiff:10 })]);
  const dChance = B.boardingChance({ enterschiff:4 }, 300) - A.boardingChance({ enterschiff:4 }, 300);
  check('2: und drei mal vier Prozentpunkte Chance', Math.abs(dChance - 3*K.ENTERHAKEN_CHANCE_PER) < 1e-9, dChance);
  check('2: eine überhöhte Ausbaustufe wird auf das Maximum geklemmt', C.enterhakenLevel() === K.ENTERHAKEN_MAX, C.enterhakenLevel());
}

// ---------------------------------------------------------------- 3: Kapern zieht aus der Gegnerflotte
{
  const A = bau({ enterhaken:0 });
  const gegner = { jaeger:20, destroyers:4, schlachtschiff:3, superschlachtschiff:1 };
  const eigene = { enterschiff:20 };
  const r = A.resolveBoarding({ enterschiff:20 }, gegner, 10, eigene, 'home', () => 0); // 0 < chance -> Erfolg
  check('3: die Enterung gelingt', r && r.erfolg === true);
  check('3: es werden genau so viele Schiffe gekapert wie Plätze da sind',
    r.gekapertGesamt === A.boardingCapacity({ enterschiff:20 }), { gekapert:r.gekapertGesamt, plaetze:A.boardingCapacity({ enterschiff:20 }) });
  check('3: gekapert wird das Wertvollste zuerst (Zerstörer vor Jäger)',
    (r.gekapert.destroyers||0) === 4 && (r.gekapert.jaeger||0) === 6, r.gekapert);
  check('3: Großschiffe bleiben unangetastet',
    gegner.schlachtschiff === 3 && gegner.superschlachtschiff === 1, { s:gegner.schlachtschiff, ss:gegner.superschlachtschiff });
  // DAS ist der Preis der Enterung: die Prisen sind aus der Gegnerflotte RAUS, bevor Verluste und
  // Truemmerfeld gerechnet werden. Ohne diese Zeile waere die Enterung Gratis-Beute obendrauf.
  check('3: die Prisen sind aus der Gegnerflotte entfernt (kein Trümmerfeld daraus)',
    gegner.jaeger === 14 && gegner.destroyers === 0, { jaeger:gegner.jaeger, destroyers:gegner.destroyers });
  const erwartet = 4*A.SHIP_SCORE_WEIGHTS.destroyers + 6*A.SHIP_SCORE_WEIGHTS.jaeger;
  check('3: das Prisengut entspricht dem Punktegewicht der Prise', r.prisengut === erwartet, { ist:r.prisengut, soll:erwartet });
  check('3: bei Erfolg gehen keine Enterschiffe verloren', r.verloren === null && eigene.enterschiff === 20, eigene.enterschiff);
}
{
  // Nur Großschiffe im Gegner: Enterung gelingt, es gibt aber nichts zu holen.
  const A = bau({ enterhaken:0 });
  const gegner = { superschlachtschiff:5 };
  const r = A.resolveBoarding({ enterschiff:20 }, gegner, 10, { enterschiff:20 }, 'home', () => 0);
  check('3: gegen reine Großschiff-Flotten gibt es keine Prise', r.erfolg && r.gekapertGesamt === 0 && r.prisengut === 0, r);
  check('3: und die Gegnerflotte bleibt vollständig', gegner.superschlachtschiff === 5);
}

// ---------------------------------------------------------------- 4: Fehlschlag
{
  const A = bau({ enterhaken:0 });
  const gegner = { jaeger:20, destroyers:4 };
  const eigene = { enterschiff:20 };
  const r = A.resolveBoarding({ enterschiff:20 }, gegner, 10, eigene, 'home', () => 0.999); // > chance -> Fehlschlag
  check('4: die Enterung scheitert', r && r.erfolg === false);
  check('4: es wird nichts gekapert', r.gekapertGesamt === 0 && r.prisengut === 0, r);
  check('4: die Gegnerflotte bleibt unangetastet', gegner.jaeger === 20 && gegner.destroyers === 4, gegner);
  check('4: Enterschiffe gehen verloren', (r.verloren||{}).enterschiff === 6, r.verloren);
  check('4: und sind wirklich aus der eigenen Flotte abgezogen', eigene.enterschiff === 14, eigene.enterschiff);
  const ruf = A.__rufe[A.__rufe.length-1];
  check('4: der Verlust läuft über applyCombatLosses (also mit Trümmerfeld)',
    ruf && ruf.keys.length === 1 && ruf.keys[0] === 'enterschiff' && ruf.pct === K.BOARD_FAIL_LOSS && ruf.planetKey === 'home', ruf);
}

// ---------------------------------------------------------------- 5: ohne Enterschiff nichts
{
  const A = bau({ enterhaken:0 });
  const gegner = { jaeger:20 };
  const r = A.resolveBoarding({ jaeger:100, bomber:20 }, gegner, 10, { jaeger:100 }, 'home', () => 0);
  check('5: wer keine Enterschiffe besitzt, bekommt gar keine Enterphase', r === null, r);
  check('5: und die Gegnerflotte bleibt unberührt', gegner.jaeger === 20);
}
// Der stille Fall Nr. 1 (v8.301.2): Enterschiffe DA, aber keins in dieser Flotte. Vorher schwieg der
// Bericht komplett - fuer den Spieler nicht unterscheidbar von "die Enterung ist kaputt".
{
  const A = bau({ enterhaken:0 }, [{ enterschiff:12 }]);
  const gegner = { jaeger:20 };
  const r = A.resolveBoarding({ jaeger:100 }, gegner, 10, { jaeger:100 }, 'home', () => 0);
  check('5: wer Enterschiffe besitzt, aber keins mitschickt, bekommt eine Begründung',
    r && r.grund === 'nicht_dabei', r);
  check('5: dabei wird nichts gewürfelt und nichts verloren',
    !!r && r.chance === 0 && r.erfolg === false && r.gekapertGesamt === 0 && r.verloren === null, r);
  check('5: und die Gegnerflotte bleibt auch dann unberührt', gegner.jaeger === 20);
  // Auch ein frueherer Versuch zaehlt als "spielt die Enterung" - ein Fehlschlag kostet 30% der
  // Enterschiffe, wer wenige hatte steht danach ohne da und wuerde sonst wieder nichts erklaert kriegen.
  const B = bau({ enterhaken:0, boardAttempts:3 }, []);
  check('5: ein früherer Enterversuch reicht dafür ebenfalls', B.ownsEnterschiffe() === true);
}
// Der stille Fall Nr. 2 (v8.301.2): Wurf gewonnen, aber 0 Kaperplaetze. Der Bericht behauptete
// vorher, beim Gegner sei nichts Kaperbares uebrig gewesen - das war schlicht falsch.
{
  const A = bau({ enterhaken:0 });
  const gegner = { jaeger:20, destroyers:4 };
  const eigene = { enterschiff:1 };
  check('5: ein einzelnes Enterschiff ohne Enterhaken ergibt 0 Kaperplätze', A.boardingCapacity({ enterschiff:1 }) === 0);
  const r = A.resolveBoarding({ enterschiff:1 }, gegner, 10, eigene, 'home', () => 0);
  check('5: der Wurf gilt trotzdem als gewonnen', r && r.erfolg === true, r);
  check('5: und wird als fehlender Kaperplatz begründet, nicht als leerer Gegner', !!r && r.grund === 'kein_platz', r && r.grund);
  check('5: es wird nichts gekapert und nichts abgezogen',
    !!r && r.gekapertGesamt === 0 && gegner.jaeger === 20 && gegner.destroyers === 4 && eigene.enterschiff === 1);
  // Gegenprobe: mit Enterhaken-Stufe 1 hat dasselbe eine Flotte sehr wohl einen Platz.
  const B = bau({ enterhaken:1 });
  const gegner2 = { jaeger:20 };
  const r2 = B.resolveBoarding({ enterschiff:1 }, gegner2, 10, { enterschiff:1 }, 'home', () => 0);
  check('5: mit Enterhaken-Stufe 1 kapert dieselbe Flotte sehr wohl',
    !!r2 && r2.grund === undefined && r2.gekapertGesamt === 1, r2 && { grund:r2.grund, n:r2.gekapertGesamt });
}

// ---------------------------------------------------------------- 6: Prisenhof
{
  const preis = (re, was) => { const m = src.match(re); check('6: Preis '+was+' gefunden', !!m); return m ? Number(m[1]) : null; };
  const frag = preis(/const PRISENHOF_FRAGMENT_COST = (\d+);/, 'Fragment');
  const kredKosten = preis(/const PRISENHOF_CREDIT_COST = (\d+);/, 'Kredit-Kosten');
  const kredGewinn = preis(/const PRISENHOF_CREDIT_GAIN = (\d+);/, 'Kredit-Gewinn');
  check('6: das Fragment kostet 400 Prisengut', frag === 400, frag);
  check('6: der Kredit-Tausch ist 25 zu 200', kredKosten === 25 && kredGewinn === 200, [kredKosten, kredGewinn]);
  // Eichung: 1 Modulfragment kostet im Kredit-Shop 4.000 Kredite (40.000 fuer 10). Der direkte
  // Kredit-Kurs muss SCHLECHTER sein als der Umweg ueber Fragmente, sonst waere das Fragment-Angebot
  // sinnlos - und er darf nicht so gut sein, dass Prisengut zur Kreditmaschine wird.
  const krProFragmentweg = 4000 / frag;              // Kredite je Prisengut über Fragmente
  const krProDirekt = kredGewinn / kredKosten;        // Kredite je Prisengut direkt
  check('6: der direkte Kredit-Kurs ist schlechter als der Umweg über Fragmente',
    krProDirekt < krProFragmentweg, { direkt:krProDirekt, ueberFragmente:krProFragmentweg });
  check('6: aber nicht absurd schlecht (mindestens die Hälfte)', krProDirekt >= krProFragmentweg*0.5, krProDirekt);
  // Feste Preise - keine Kopplung an Produktion oder Besitz (CLAUDE.md-Warnung).
  const hof = src.slice(src.indexOf('function renderPrisenhofBox'), src.indexOf('function counterReportLine'));
  check('6: die Preise hängen nicht an der Produktion', !/ratesPerSecond|questRates|storageCap/.test(hof));
  check('6: drei Angebote', ['fragment','kredite','haken'].every(a => hof.includes("'"+a+"'")||hof.includes('"'+a+'"')));
  const kauf = src.slice(src.indexOf('function prisenhofKauf'), src.indexOf('function counterReportLine'));
  check('6: jeder Kauf prüft den Vorrat', (kauf.match(/Nicht genug Prisengut/g)||[]).length === 3, (kauf.match(/Nicht genug Prisengut/g)||[]).length);
  check('6: der Ausbau ist bei der Höchststufe gesperrt', /bereits voll ausgebaut/.test(kauf));
  // Spieler-Report 26.07.2026 ("da steht nix"): Die erste Fassung blendete den Prisenhof bis zur
  // ersten GEGLUECKTEN Enterung komplett aus. Wer den Wurf verlor - je nach Gegner gut jeder
  // fuenfte Versuch -, sah danach nirgends etwas und musste annehmen, die Funktion sei kaputt.
  check('6: der Prisenhof erscheint schon, sobald man Enterschiffe besitzt',
    /const hatEnterschiffe = ownsEnterschiffe\(\);/.test(hof)
    && /&& !hatEnterschiffe\)\{ if \(box\.innerHTML\)/.test(hof));
  check('6: dieselbe Prüfung entscheidet auch über den Hinweis im Kampf (eine Quelle, nicht zwei)',
    (src.match(/ownsEnterschiffe\(\)/g)||[]).length >= 3, (src.match(/ownsEnterschiffe\(\)/g)||[]).length);
  check('6: ohne Enterschiffe bleibt er weiterhin weg', /if \(pg <= 0 && lvl === 0 && \(state\.boardings\|\|0\) === 0 && !hatEnterschiffe\)/.test(hof));
  check('6: der Leerzustand erklärt, was zu tun ist',
    /zwei Enterschiffe<\/strong> in einen Angriff auf einen <strong>NPC-Gegner/.test(hof));
  check('6: gescheiterte Versuche werden mitgezählt und angezeigt',
    /state\.boardAttempts = \(state\.boardAttempts\|\|0\) \+ 1;/.test(src) && /Enterversuch/.test(hof));
}

// ---------------------------------------------------------------- 7: Anzeigestellen (Regel 6)
{
  // Speicherfelder
  check('7: die vier Speicherfelder sind angelegt', /prisengut: 0, enterhaken: 0, boardedShips: 0, boardings: 0,/.test(src));
  // Kampfaufloesung: Enterung MUSS vor applyCombatLosses laufen, sonst waere der Truemmer-Preis weg.
  const i1 = src.indexOf('const enterung = resolveBoarding(');
  const i2 = src.indexOf('const destroyedNpcShips = applyCombatLosses(');
  check('7: die Enterung läuft vor der Verlustrechnung', i1 > 0 && i2 > i1, { enterung:i1, verluste:i2 });
  check('7: die Prisen landen in der eigenen Flotte', /for \(const \[k,v\] of Object\.entries\(enterung\.gekapert\)\) fleet\[k\] = \(fleet\[k\]\|\|0\) \+ v;/.test(src));
  check('7: Prisengut wird gutgeschrieben', /state\.prisengut = \(state\.prisengut\|\|0\) \+ enterung\.prisengut;/.test(src));
  // Angriffsvorschau, Kampfbericht, Log
  check('7: die Angriffsvorschau nennt die Enterphase', /Enterphase nach gewonnenem Kampf/.test(src));
  check('7: sie nennt auch die Kaperplätze', /kaperbar\$\{platz<=0/.test(src));
  check('7: der Kampfbericht hat eine eigene Enterzeile', /function boardingReportHtml/.test(src) && /body \+= boardingReportHtml\(r\.enterung\);/.test(src));
  check('7: der Bericht nennt den Trümmer-Preis', /fehlen im Trümmerfeld/.test(src));
  check('7: die Log-Meldung nennt Chance und Prisengut', /Enterung geglückt \('\+Math\.round\(enterung\.chance\*100\)/.test(src));
  // Schiffsbeschreibung
  const schiff = (src.match(/\{ key:'enterschiff',[^\n]*/)||[''])[0];
  check('7: die Nischen-Beschreibung des Enterschiffs nennt das Entern', /entern und gegnerische Schiffe kapern/.test(schiff), schiff.slice(-140));
  // Hilfe
  const h1 = src.indexOf("title:'Enterung – die vierte Phase'");
  const h2 = src.indexOf("title:'Prisengut & Prisenhof'");
  check('7: es gibt einen Hilfe-Abschnitt zur Enterung', h1 > 0);
  check('7: und einen zum Prisenhof', h2 > 0);
  const hilfe = h1 > 0 ? src.slice(h1, src.indexOf("' },", h1)) : '';
  check('7: die Hilfe nennt den Trümmer-Preis', /Trümmerfeld/.test(hilfe));
  check('7: die Hilfe nennt den Fehlschlag-Verlust', hilfe.includes(Math.round(0.30*100)+'%'), hilfe.includes('30%'));
  check('7: die Hilfe sagt, dass Großschiffe nicht kaperbar sind', /Superschlachtschiff lassen sich nicht übernehmen/.test(hilfe));
  check('7: die Hilfe nennt die Grenzen (kein PvP, keine Piratennester)',
    /gegen andere Spieler/.test(hilfe) && /Piratennester/.test(hilfe));
  const hilfe2 = h2 > 0 ? src.slice(h2, src.indexOf("' },", h2)) : '';
  check('7: die Prisenhof-Hilfe nennt dieselben Preise wie der Code',
    hilfe2.includes('400 Prisengut') && hilfe2.includes('25 Prisengut') && hilfe2.includes('200 Kredite'), hilfe2.slice(0,80));
  check('7: und dieselben Ausbaukosten', hilfe2.includes('300/700/1.300/2.200/3.500'));
  // Beim Bauen aufgefallen: die Enterzeile nannte die verlorenen Enterschiffe, die Verlustzeile
  // daneben (und die Live-Kampf-Wiedergabe, die dieselbe Liste abspielt) aber nicht - zwei
  // Anzeigestellen derselben Groesse, die sich widersprochen haetten.
  check('7: Enter-Verluste stehen auch in der allgemeinen Verlustliste',
    /if \(enterung && !enterung\.erfolg && enterung\.verloren\)\{/.test(src)
    && /ownLostWin\[k\] = \(ownLostWin\[k\]\|\|0\) \+ v;/.test(src));
  check('7: dabei wird die interne __debris-Marke übersprungen', /if \(k === '__debris' \|\| !\(v > 0\)\) continue;/.test(src));
  // v8.301.2: die zwei stillen Faelle muessen an JEDER Anzeigestelle ankommen, nicht nur dort, wo
  // sie entstehen - genau der Fehlertyp aus CLAUDE.md Regel 6.
  const bericht = src.slice(src.indexOf('function boardingReportHtml'), src.indexOf('  // Truemmerfeld-Box'));
  check('7: der Kampfbericht kennt beide stillen Fälle',
    /e\.grund === 'nicht_dabei'/.test(bericht) && /e\.grund === 'kein_platz'/.test(bericht));
  check('7: und behauptet beim fehlenden Kaperplatz nicht mehr, der Gegner sei leer gewesen',
    bericht.indexOf("e.grund === 'kein_platz'") < bericht.indexOf('nichts Kaperbares übrig'));
  check('7: der Bericht erklärt beim fehlenden Platz die Regel',
    /je 2 Enterschiffe, dazu \+1 je Enterhaken-Stufe/.test(bericht));
  check('7: die Sieg-Meldung kennt dieselben zwei Fälle',
    /enterung\.grund === 'nicht_dabei'/.test(src) && /enterung\.grund === 'kein_platz'/.test(src));
  check('7: der Bericht transportiert grund und Schiffszahl mit', /grund:enterung\.grund\|\|null, enterschiffe:enterung\.enterschiffe/.test(src));
  // Ein entfallener Versuch ist KEIN Versuch - sonst zaehlte der Prisenhof Kaempfe mit, in denen
  // gar nicht gewuerfelt wurde, und seine Erklaerung ("X Versuche gescheitert") waere gelogen.
  check('7: eine entfallene Enterphase zählt nicht als Enterversuch',
    /if \(enterung && enterung\.grund !== 'nicht_dabei'\) state\.boardAttempts/.test(src));
  check('7: die Angriffs-Vorschau warnt vor dem Start, wenn kein Enterschiff mitfliegt',
    /\} else if \(ownsEnterschiffe\(\)\)\{/.test(src) && /ohne sie entfällt die Enterphase/.test(src));
  // Die Hilfe sagte bis v8.301.2 noch, der Prisenhof erscheine "nach der ersten Enterung" - seit
  // v8.301.1 stimmt das nicht mehr. Zweite Anzeigestelle mit der alten Annahme.
  check('7: die Hilfe nennt die aktuelle Sichtbarkeitsregel des Prisenhofs',
    !/erscheint nach der ersten Enterung/.test(src) && /erscheint, sobald du Enterschiffe besitzt/.test(src));
  // Erfolge
  check('7: zwei neue Erfolge', /key:'ersteprise'/.test(src) && /key:'freibeuter'/.test(src));
  check('7: beide haben ein eigenes Icon', /ersteprise:'ti-anchor', freibeuter:'ti-ship',/.test(src));
}

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
