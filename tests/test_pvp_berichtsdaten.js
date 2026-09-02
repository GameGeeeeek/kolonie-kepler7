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
//   4. `defenderLostShips` darf es NICHT geben. ACHTUNG, der Grund hat sich am 02.08.2026 geaendert
//      (v8.386.0): Seitdem kostet ein erfolgreicher Angriff das Ziel sehr wohl Schiffe - der Server
//      liefert dafuer aber bewusst nur einen PROZENTSATZ (defenderLossPct). Die Stueckzahlen
//      entstehen erst, wenn der Client des ZIELS den Abzug anwendet und dabei an seinem echten
//      Bestand deckelt; eine Stueckzahl im Bericht des Angreifers koennte davon abweichen und waere
//      dann schlicht falsch. Die Zusicherung gilt also weiter, nur aus einem anderen Grund.
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
  /* Der erste Parameter wird ueber \w+ gematcht statt woertlich als `myPower`: Seit den
     Gefechtsvorraeten (v8.558.0) heisst er myPowerVorrat, weil der Vorrat vor dem Wurf
     eingerechnet wird. Die geprueften Eigenschaften - dieselbe Chancen-Funktion, dieselben
     PvP-Deckel wie der Server - sind davon unberuehrt (Arbeitsregel 3: die Regel pruefen,
     nicht die Momentaufnahme). */
  check('2: Solo-Pfad nennt dieselbe Chance wie die Vorschau (battleWinChance, nicht selbst gerechnet)',
    /chancePct: Math\.round\(battleWinChance\(\w+, theirDefenseEstimate, konterSim, PVP_PHASE_MIN, PVP_PHASE_MAX\) \* 100\)/.test(src));
  check('2: Solo-Pfad nutzt dieselben PvP-Deckel wie der Server',
    /resolveBattlePhases\(\w+, theirDefenseEstimate, konterSim, PVP_PHASE_MIN, PVP_PHASE_MAX\)/.test(src));
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

  // Die Wiedergabe ist die zweite Anzeigestelle derselben Groesse. Seit v8.390.0 baut sie
  // ihr Bild nicht mehr selbst aus dem Bericht, sondern ueber den Adapter schlachtDaten() -
  // die frueher hier geprueften Zeilen (buildBattleSequence, abstractIcon) gibt es nicht
  // mehr. Geprueft wird jetzt dieselbe AUSSAGE an ihrem neuen Ort: dass die Zielflotte
  // benutzt wird, wenn der Bericht sie fuehrt, und dass ohne sie NICHTS erfunden wird.
  // Anker OHNE fuehrende Leerzeichen: Der Adapter liegt in der Wiedergabe-Kapsel und ist
  // dadurch tiefer eingerueckt als in seiner Quelldatei. Die erste Fassung dieser Pruefung
  // nahm die Einrueckung mit und fand deshalb nichts.
  const adapter = schnitt("if (r.defenderFleet && Object.keys(zahlenObjekt(r.defenderFleet)).length){",
                          "d.abwehr = abwehrBauen(r.defenseBefore, u);");
  check('3: der Adapter-Block der Wiedergabe wurde gefunden', adapter.length > 300, adapter.length);
  check('3: die Wiedergabe nutzt die Zielflotte, wenn sie da ist',
    /d\.verteidiger = seiteBauen\(gegnerName, 'gegner', r\.defenderFleet/.test(adapter));
  // Ein PvP-Angriff zerstoert Verteidigungsgebaeude, aber kein Schiff des Ziels - die
  // Zielflotte bleibt also vollstaendig stehen. Das ist keine Luecke, sondern das
  // Kampfmodell, und die Wiedergabe muss es so kennzeichnen statt Verluste zu erfinden.
  check('3: sie behauptet dabei KEINE Schiffsverluste des Ziels',
    /d\.verteidiger\.ohneSchiffsverluste = true;/.test(adapter));
  // Ohne Zielflotte (aelteres Backend) kein Platzhalterverband, sondern die nackte
  // Abwehrkraft und ein Vermerk, dass die Zusammensetzung unbekannt ist.
  check('3: ohne Zielflotte wird nichts erfunden, sondern die Luecke benannt',
    /d\.verteidiger = unbekannteSeite\(gegnerName, 'gegner'/.test(adapter)
    && /d\.luecken\.push\('Flotte des Gegners'\)/.test(adapter), adapter.slice(-170));
  // Die Anlagen des Ziels stehen im Bericht (defenseBefore) und werden dort gezeigt -
  // die Wiedergabe fuehrt sie nur beim eingehenden Ueberfall, wo der Bericht sie hergibt.
  check('3: die Anlagen kommen aus defenseBefore', /d\.abwehr = abwehrBauen\(r\.defenseBefore, u\);/.test(src));
}

// ----------------------------------------- 4) Was bewusst NICHT drin steht
{
  // Geprueft wird die ZUWEISUNG, nicht das Wort: Im Kommentar daneben steht ausdruecklich,
  // warum es das Feld nicht gibt - der Hinweis darf nicht seinen eigenen Test ausloesen.
  check('4: es wird nirgends ein Feld "defenderLostShips" gesetzt - der Server liefert einen Prozentsatz',
    !/defenderLostShips\s*[:=]/.test(src));
  // Und die Begruendung steht im Code, damit sie niemand als Versehen nachtraegt.
  check('4: die Begruendung dafuer steht im Quelltext',
    /WEITERHIN KEIN `defenderLostShips`/.test(src));
  // Gegenprobe zur Aenderung von v8.386.0: den Prozentsatz gibt es, und er wird uebernommen.
  check('4: stattdessen wird defenderLossPct uebernommen',
    /if \(typeof data\.defenderLossPct === 'number' && data\.defenderLossPct > 0\) d\.defenderLossPct = data\.defenderLossPct;/.test(src));
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
  // Die Historie liegt seit dem 01.09.2026 an zwei Stellen (Spiel + patchnotes-archiv.json); tests/lib/patchnotes.js setzt sie zusammen.
  check('5: es gibt einen Patchnotes-Eintrag zu dieser Aenderung',
    /Spieler-gegen-Spieler-Bericht zeigt endlich/.test(require('./lib/patchnotes').patchnotesText(src)));
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
