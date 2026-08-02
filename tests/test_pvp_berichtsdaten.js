// PvP-Bericht fuehrt Gegenseite und Phasen mit (02.08.2026, v8.384.0).
//
// DIE AUSGANGSLAGE: `player-attack` war der einzige Kampfbericht ohne Gegenseite - keine Flotte des
// Ziels, keine Verteidigungsanlagen, keine Phasenurteile. Der Server RECHNETE all das (er schreibt
// es seit jeher in seine eigenen `attack-sent`/`attack-received`-Berichte), gab es dem Angreifer in
// der Antwort auf POST /api/attack aber nie zurueck.
//
// WAS HIER GEPRUEFT WIRD, und warum jeder Punkt noetig ist:
//
//   1. Der Uebernahme-Helfer, ausgefuehrt. Er darf NUR uebernehmen, was in der Antwort steht -
//      Sascha zieht Frontend und Backend getrennt auf den Pi, ein alteres Backend liefert die
//      Felder also nicht. Leere Objekte im Bericht waeren schlimmer als fehlende: sie sehen aus wie
//      eine gemessene Null.
//   2. Beide Berichtszweige (Sieg und Niederlage) und beide Betriebsarten (Server und Solo)
//      muessen die Angaben fuehren. Genau hier entsteht sonst der Klassiker dieses Projekts: ein
//      Zweig umgestellt, der zweite vergessen.
//   3. Die Anzeige muss sie auch zeigen - Bericht UND Kampf-Wiedergabe. Eine Angabe ohne Abnehmer
//      ist nur Ballast im Bericht, und die Wiedergabe daneben zeigte sonst weiter das abstrakte
//      Personen-Icon (die zweite Anzeigestelle mit der alten Annahme).
//   4. `defenderLostShips` darf es NICHT geben. Ein PvP-Angriff zerstoert Verteidigungsgebaeude,
//      aber kein Schiff des Ziels - die Groesse existiert im Kampfmodell nicht. Dieser Punkt haelt
//      fest, dass sie bewusst fehlt, damit sie niemand spaeter "der Vollstaendigkeit halber" mit
//      einer erfundenen Zahl nachtraegt.
const fs = require('fs');
const { SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

function schnitt(von, bis){
  const a = src.indexOf(von);
  if (a < 0) return '';
  const b = src.indexOf(bis, a + von.length);
  return b < 0 ? '' : src.slice(a, b + bis.length);
}

// ------------------------------------------------------- 1) Der Helfer, ausgefuehrt
{
  const q = schnitt('function pvpKampfDetails(data){', '\n    }');
  check('1: pvpKampfDetails() gefunden', q.length > 300, q.length);
  const f = new Function(q + '\n return pvpKampfDetails;')();

  check('1: ohne Antwort ein leeres Ergebnis, kein Absturz',
    JSON.stringify(f(undefined)) === '{}' && JSON.stringify(f(null)) === '{}');

  // Ein aelteres Backend liefert nur das Noetigste.
  check('1: altes Backend -> gar keine neuen Felder statt leerer',
    JSON.stringify(f({ success:true, attackPower:100, defensePower:50 })) === '{}');

  const voll = f({
    phasen:[{ key:'anflug', gewonnen:true, chance:0.6 }], chancePct:64, counterMult:1.12,
    formation:'schilde', formationMult:1.15,
    defenseBefore:{ laser:12, plasma:6 }, defenderFleet:{ jaeger:400, cruisers:20 },
    destroyedBuilding:'laser', destroyedBuildingCount:2
  });
  check('1: vollstaendige Antwort -> alle acht Angaben uebernommen',
    Object.keys(voll).sort().join(',') ===
    'chancePct,counterMult,defenderFleet,defenseBefore,destroyedBuilding,destroyedBuildingCount,formation,formationMult,phasen'.split(',').filter(k=>k!=='x').join(','),
    Object.keys(voll).sort());
  check('1: die Werte werden unveraendert durchgereicht',
    voll.chancePct === 64 && voll.defenderFleet.jaeger === 400 && voll.defenseBefore.laser === 12);

  // Leere Objekte sind KEINE Angabe - sonst stuende im Bericht eine Null, die niemand gemessen hat.
  const leer = f({ phasen:[], defenseBefore:{}, defenderFleet:{} });
  check('1: leere Flotte/Anlagen/Phasen werden verworfen, nicht uebernommen',
    JSON.stringify(leer) === '{}', leer);
}

// ------------------------------------------- 2) Beide Zweige, beide Betriebsarten
{
  const serverPfad = (src.match(/\.\.\.pvpKampfDetails\(data\)/g) || []).length;
  check('2: Server-Pfad reicht die Angaben in BEIDEN Berichten weiter (Sieg und Niederlage)',
    serverPfad === 2, serverPfad);

  const soloPfad = (src.match(/\.\.\.simDetails/g) || []).length;
  check('2: Solo-Pfad ebenso in beiden Berichten', soloPfad === 2, soloPfad);

  // Der Solo-Pfad wuerfelte die Phasen schon, warf sie aber weg.
  check('2: Solo-Pfad haelt das Phasenergebnis fest, statt nur .success zu lesen',
    /const phasenSim = resolveBattlePhases\(/.test(src) && /phasen: phasenSim\.phasen/.test(src));
  check('2: Solo-Pfad nennt dieselbe Chance wie die Vorschau (battleWinChance, nicht selbst gerechnet)',
    /chancePct: Math\.round\(battleWinChance\(myPower, theirDefenseEstimate, konterSim, PVP_PHASE_MIN, PVP_PHASE_MAX\) \* 100\)/.test(src));
  check('2: Solo-Pfad nutzt dieselben PvP-Deckel wie der Server',
    /resolveBattlePhases\(myPower, theirDefenseEstimate, konterSim, PVP_PHASE_MIN, PVP_PHASE_MAX\)/.test(src));
  // Ohne Zielflotte (Gegner ohne Bestenlisten-Eintrag) darf kein leeres Feld entstehen.
  check('2: Solo-Pfad setzt defenderFleet nur, wenn es wirklich eine gibt',
    /if \(Object\.keys\(zielFlotteSim\)\.length\) simDetails\.defenderFleet = zielFlotteSim;/.test(src));
  // Die Anlagen sind im Solo-Modus schlicht unbekannt.
  const soloBlock = schnitt('const simDetails = {', 'zielFlotteSim;');
  check('2: Solo-Pfad behauptet KEINE Verteidigungsanlagen (die kennt der Bestenlisten-Eintrag nicht)',
    !/defenseBefore/.test(soloBlock));
}

// -------------------------------------------------- 3) Die Anzeigestellen
{
  const bericht = schnitt("} else if (r.type === 'player-attack'){", "} else if (r.type === 'spy-report'){");
  check('3: Berichtsblock gefunden', bericht.length > 800, bericht.length);
  check('3: der Bericht zeigt die Phasen', /battlePhaseReportHtml\(r\.phasen\)/.test(bericht));
  check('3: der Bericht zeigt die Konterwirkung', /counterReportLine\(r\.counterMult\)/.test(bericht));
  check('3: der Bericht zeigt die Aufstellung des Ziels',
    /formationReportLine\(r\.formation, r\.formationMult, 'des Ziels'\)/.test(bericht));
  check('3: der Bericht zeigt die Flotte des Ziels', /Flotte des Ziels/.test(bericht) && /r\.defenderFleet/.test(bericht));
  check('3: der Bericht zeigt die Anlagen des Ziels samt zerstoerter',
    /defenseBreakdownHtml\(r\.defenseBefore, r\.destroyedBuilding\)/.test(bericht));

  // Die Wiedergabe ist die zweite Anzeigestelle derselben Groesse.
  const seq = schnitt("      left = { label: 'Deine Flotte', fleet: {...(r.fleet||{})}, losses: {...(r.ownLostShips||{})}, accentColor: null };\n      // Seit dem 02.08.2026", 'attackerWins = r.result === \'win\';');
  check('3: Wiedergabe-Block gefunden', seq.length > 300, seq.length);
  check('3: die Wiedergabe nutzt die Zielflotte, wenn sie da ist', /r\.defenderFleet/.test(seq));
  check('3: und die Anlagen des Ziels', /r\.defenseBefore/.test(seq));
  check('3: ohne beides bleibt es beim abstrakten Icon (aeltere Berichte)',
    /abstractIcon:'ti-user'/.test(seq));
}

// ----------------------------------------- 4) Was bewusst NICHT drin steht
{
  // Geprueft wird die ZUWEISUNG, nicht das Wort: Im Kommentar daneben steht ausdruecklich,
  // warum es das Feld nicht gibt - der Hinweis darf nicht seinen eigenen Test ausloesen.
  check('4: es wird nirgends ein Feld "defenderLostShips" gesetzt - die Groesse existiert im Kampfmodell nicht',
    !/defenderLostShips\s*[:=]/.test(src));
  // Und die Begruendung steht im Code, damit sie niemand als Versehen nachtraegt.
  check('4: die Begruendung dafuer steht im Quelltext',
    /zerstoert Verteidigungs-GEBAEUDE|zerstoert Verteidigungsgebaeude, aber kein Schiff/.test(src));
}

// --------------------------------- 5) Hilfe und Patchnote sagen dasselbe
{
  const hilfe = schnitt("{ title:'Kampfphasen'", "' },");
  check('5: der Hilfe-Abschnitt „Kampfphasen" nennt den PvP-Bericht',
    /Spieler-gegen-Spieler-Bericht<\/strong> jede Phase einzeln/.test(hilfe));
  check('5: die Hilfe erklaert, dass die Aufklaerung dadurch nichts verliert',
    /Aufklärung verliert dadurch nichts/.test(src));
  // Geprueft wird die BEHAUPTUNG, nicht die Schreibweise: dass die Aenderung ueberhaupt in einem
  // Patchnotes-Eintrag steht. Die erste Fassung nagelte hier VERSION === '8.384.0' fest - und ging
  // schon beim naechsten, voellig unbeteiligten Versionssprung kaputt. Genau davor warnt CLAUDE.md:
  // ein Test, der eine Schreibweise festhaelt statt einer Aussage, wird zum Hindernis fuer richtige
  // Aenderungen statt zum Schutz vor falschen.
  const ver = (src.match(/const VERSION = '([\d.]+)'/) || [])[1];
  const teile = (ver || '0.0.0').split('.').map(Number);
  check('5: VERSION ist mindestens 8.384.0', teile[0] > 8 || (teile[0] === 8 && teile[1] >= 384), ver);
  check('5: es gibt einen Patchnotes-Eintrag zu dieser Aenderung',
    /Spieler-gegen-Spieler-Bericht zeigt endlich/.test(src));
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
