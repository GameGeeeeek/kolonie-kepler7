// Handgepflegte Backend-Spiegel gegen die Frontend-Definitionen.
//
// Das Backend hat bewusst eigene Kopien von Frontend-Tabellen: Es hat kein SHIP_DEFS und kein
// BUILDING_DEFS, kann also nicht aus derselben Quelle lesen. Diese Kopien sind der Preis fuer einen
// server-autoritativen PvP-Kampf - und genau deshalb driften sie ab. CLAUDE.md nennt das als
// eigenen Fallstrick ("Bei Aenderungen an der jeweiligen Frontend-Formel IMMER die Backend-Kopie
// mitpflegen"), und es ist am 01.08.2026 in DREI Tabellen gleichzeitig nachgewiesen worden:
//
//   1. DEFENSE_VALUES kannte den Resonanzschild-Emitter nicht - mit defVal 420 der HOECHSTE
//      Verteidigungswert des Spiels, ueber Festung (350) und Metamaterialwall (340). Das
//      server-autoritative PvP summiert ausschliesslich ueber Object.entries(DEFENSE_VALUES); das
//      teuerste Verteidigungsgebaeude zaehlte im echten Kampf also NULL, samt des 40%-Schild-
//      zuschlags darauf. Das Frontend zeigte es in der Verteidigungssumme an (es summiert ueber
//      BUILDING_DEFS selbst) - der Spieler sah eine Verteidigung, die er im Kampf nicht hatte.
//   2. ALLIANCE_STRUCTURE_COSTS kannte a_abgrund (Tiefenkartierung) nicht - als einzige der 23
//      Allianz-Strukturen. Die Freischaltpruefung ueberspringt unbekannte Schluessel stillschweigend
//      (`if (!def) continue;`), die Tech wurde also nie gegen die echten Beitraege validiert.
//   3. computeScoreServer() zaehlte nur stationierte Flotten. Schiffe in Verlegung, an der
//      Allianzbasis oder im Musterangriff fehlten - und da der Server den eingereichten Punktestand
//      BEDINGUNGSLOS ueberschreibt, verlor der Spieler die Punkte in der Bestenliste real, solange
//      seine Flotte unterwegs war.
//
// Dieser Test vergleicht die Mengen, nicht einzelne Namen: Ein KUENFTIGES Gebaeude oder eine
// kuenftige Allianz-Struktur faellt damit automatisch auf, ohne dass jemand daran denken muss.
const { SPIELDATEI, SERVER_JS, ueberspringen } = require('./lib/umgebung');
const fs = require('fs');

if (!SERVER_JS) ueberspringen('Vergleicht Frontend und Backend - das Backend-Repo (kolonie-kepler7-backend) liegt hier nicht daneben.');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const feSrc = fs.readFileSync(SPIELDATEI, 'utf8');
const beSrc = fs.readFileSync(SERVER_JS, 'utf8');
const feZeilen = feSrc.split('\n');

// ---- 1. Verteidigungsgebaeude ------------------------------------------------------------------
// Zeilenweise statt per Regex ueber die ganze Datei: BUILDING_DEFS enthaelt verschachtelte
// Klammern in Kostenobjekten, an denen eine naive Regex falsch terminiert (CLAUDE.md-Fallstrick).
// Ein Eintrag steht genau auf einer Zeile, das macht die zeilenweise Lesung eindeutig.
const feDef = {};
for (const z of feZeilen) {
  if (!z.includes("category:'defense'")) continue;
  const k = (z.match(/key:'([a-z0-9_]+)'/) || [])[1];
  if (!k) continue;
  feDef[k] = Number((z.match(/defVal:\s*(\d+)/) || [])[1] || 0);
}
const beDefBlock = (beSrc.match(/const DEFENSE_VALUES = \{([\s\S]*?)\n\};/) || [])[1];
check('Backend definiert DEFENSE_VALUES', !!beDefBlock);
const beDef = {};
if (beDefBlock) for (const m of beDefBlock.matchAll(/(\w+)\s*:\s*(\d+)/g)) beDef[m[1]] = Number(m[2]);

check('Frontend-Verteidigungsgebaeude gefunden', Object.keys(feDef).length > 15, Object.keys(feDef).length);
const defFehlen = Object.keys(feDef).filter(k => !(k in beDef));
check('kein Verteidigungsgebaeude fehlt im Backend', defFehlen.length === 0,
  defFehlen.map(k => k + ' (defVal ' + feDef[k] + ')'));
const defZuviel = Object.keys(beDef).filter(k => !(k in feDef));
check('das Backend kennt kein Gebaeude, das es im Frontend nicht gibt', defZuviel.length === 0, defZuviel);
const defAbweich = Object.keys(feDef).filter(k => k in beDef && beDef[k] !== feDef[k]);
check('alle defVal stimmen zahlengleich ueberein', defAbweich.length === 0,
  defAbweich.map(k => k + ': FE=' + feDef[k] + ' BE=' + beDef[k]));
// Der konkrete Fund - namentlich, damit die Regression unmissverstaendlich ist.
check('der Resonanzschild-Emitter zaehlt serverseitig mit', beDef.resonanzschild === 420, beDef.resonanzschild);

// ---- 2. Allianz-Strukturen ---------------------------------------------------------------------
// Unterschieden wird ueber resKey: Die Abgrund-MODULE benutzen ebenfalls ab_-Schluessel
// (ab_tiefenkiel, ab_drucklot, ...) - zwei voellig verschiedene Systeme mit demselben Praefix, und
// ohne Unterscheidung meldet der Vergleich vierzehn Phantom-Luecken. resKey (die Ressource, in der
// die Struktur bezahlt wird) haben alle 23 Allianz-Strukturen und kein einziges Modul.
//
// Bewusst NICHT ueber costMult/maxLevel gefiltert, wie es hier zuerst stand: Die fuenf
// Expansionsstufen (a_expand1..5) haben weder das eine noch das andere - sie sind einmalige Kaeufe -
// und fielen dadurch still aus der Pruefung. Fuenf ungepruefte Strukturen in einem Test, der
// Vollstaendigkeit behauptet, waeren genau der Fehler, den dieser Test verhindern soll.
const feStruct = {};
for (const z of feZeilen) {
  const k = (z.match(/\{\s*key:'((?:a_|ab_)[a-z0-9]+)'/) || [])[1];
  if (!k || !/resKey:/.test(z)) continue;
  const cost = (z.match(/[^a-zA-Z]cost:\s*(\d+)/) || [])[1];
  if (cost) feStruct[k] = Number(cost);
}
const beStructBlock = (beSrc.match(/const ALLIANCE_STRUCTURE_COSTS = \{([\s\S]*?)\n\};/) || [])[1];
check('Backend definiert ALLIANCE_STRUCTURE_COSTS', !!beStructBlock);
const beStruct = {};
if (beStructBlock) for (const m of beStructBlock.matchAll(/\b((?:a_|ab_)[a-z0-9]+)\s*:\s*\{\s*cost:\s*(\d+)/g)) beStruct[m[1]] = Number(m[2]);

check('Frontend-Allianzstrukturen gefunden', Object.keys(feStruct).length > 15, Object.keys(feStruct).length);
const structFehlen = Object.keys(feStruct).filter(k => !(k in beStruct));
check('keine Allianz-Struktur fehlt im Backend', structFehlen.length === 0, structFehlen);
const structAbweich = Object.keys(feStruct).filter(k => k in beStruct && beStruct[k] !== feStruct[k]);
check('alle Grundkosten stimmen zahlengleich ueberein', structAbweich.length === 0,
  structAbweich.map(k => k + ': FE=' + feStruct[k] + ' BE=' + beStruct[k]));
check('a_abgrund (Tiefenkartierung) wird serverseitig geprueft', beStruct.a_abgrund === 45000, beStruct.a_abgrund);

// ---- 3. Punktestand: Schiffe unterwegs ---------------------------------------------------------
// Das Frontend zaehlt sie in awayShipTotalsForScore(); der Server muss dieselben Quellen kennen,
// sonst faellt der Punktestand in der Bestenliste, sobald eine Flotte unterwegs ist.
const feAway = (feSrc.match(/function awayShipTotalsForScore\(\)\{([\s\S]*?)\n  \}/) || [])[1] || '';
const beAway = (beSrc.match(/function awayShipTotalsServer\(save\) \{([\s\S]*?)\n\}/) || [])[1] || '';
check('Frontend hat awayShipTotalsForScore', !!feAway);
check('Backend hat die Spiegelung awayShipTotalsServer', !!beAway);

// Die Missionsarten sind die eigentliche Substanz - eine fehlende Art ist genau die Luecke.
const arten = ['relocate', 'defend-base', 'defend-base-return', 'attack-alliance-base'];
for (const a of arten) {
  check(`Missionsart "${a}" auf beiden Seiten`, feAway.includes(`'${a}'`) && beAway.includes(`'${a}'`),
    { frontend: feAway.includes(`'${a}'`), backend: beAway.includes(`'${a}'`) });
}
for (const feld of ['shipsAtAllianceBase', 'allianceMusterContribution']) {
  check(`Quelle "${feld}" auf beiden Seiten`, feAway.includes(feld) && beAway.includes(feld),
    { frontend: feAway.includes(feld), backend: beAway.includes(feld) });
}
// Und die Spiegelung muss auch WIRKLICH in die Punkterechnung eingehen - eine Funktion ohne
// Aufrufstelle waere hier der teuerste Fehler, weil alle Einzelpruefungen oben trotzdem gruen sind.
const beScore = (beSrc.match(/function computeScoreServer\(save\) \{([\s\S]*?)\n\}/) || [])[1] || '';
check('computeScoreServer ruft awayShipTotalsServer auf', beScore.includes('awayShipTotalsServer('));

// ---- 4. Punktegewichte je Schiffstyp ------------------------------------------------------------
// Der Server ueberschreibt den eingereichten Punktestand BEDINGUNGSLOS mit seiner eigenen Rechnung.
// Ein Schiff, das nur die Frontend-Tabelle kennt, zaehlt in der Bestenliste deshalb NULL - der
// Spieler sieht seinen Punktestand fallen, sobald er es baut, und findet dafuer keine Erklaerung.
// Genau das ist am 23.07.2026 mit Metamaterial-Titan und Singularitaets-Vernichter passiert und am
// 20.07.2026 mit dem Mondzerstoerer; beide Male stand die Ursache erst im Nachhinein im Kommentar.
// Verglichen werden MENGEN, nicht einzelne Namen - ein kuenftiges Schiff faellt damit von selbst auf.
const gewichteLesen = (quelle) => {
  const block = (quelle.match(/const SHIP_SCORE_WEIGHTS = \{([\s\S]*?)\n\s*\};/) || [])[1] || '';
  const raus = {};
  // Kommentare vorher weg: Sie enthalten Zahlen und Schiffsnamen ("atk 300", "-> 180") und wuerden
  // sonst als Eintraege gelesen - ein Messwerkzeug, das sich selbst im Weg steht.
  for (const zeile of block.split('\n')) {
    const ohneKommentar = zeile.replace(/\/\/.*$/, '');
    for (const t of ohneKommentar.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(\d+)/g)) raus[t[1]] = Number(t[2]);
  }
  return raus;
};
const feGew = gewichteLesen(feSrc);
const beGew = gewichteLesen(beSrc);
const gewFehlen = Object.keys(feGew).filter(k => !(k in beGew));
const gewZuviel = Object.keys(beGew).filter(k => !(k in feGew));
const gewAbweich = Object.keys(feGew).filter(k => k in beGew && beGew[k] !== feGew[k]);
check('Backend kennt jeden Schiffstyp der Frontend-Punktetabelle', gewFehlen.length === 0, gewFehlen);
check('Backend fuehrt keinen Schiffstyp, den das Frontend nicht kennt', gewZuviel.length === 0, gewZuviel);
check('Die Punktegewichte stimmen ueberein', gewAbweich.length === 0,
  gewAbweich.map(k => k + ': FE=' + feGew[k] + ' BE=' + beGew[k]));
// Und die Tabelle muss auch die SCHIFFE des Spiels abdecken - eine in sich stimmige, aber
// unvollstaendige Kopie waere hier sonst gruen. SHIP_DEFS ist die Wahrheit darueber, was es gibt.
//
// AUSGENOMMEN ist die TIEFENFLOTTE (tiefenschiff:true, neun Schiffe). Das ist keine Luecke, sondern
// die Bauart, und sie steht so im Code: Diese Schiffe werden in der eigenen Waehrung `bergung`
// bezahlt statt in Ressourcen, stehen bewusst NICHT in ATTACK_SHIP_KEYS ("die Trennung ist nicht
// behauptet, sondern baulich unmoeglich zu verletzen", Kommentar an SHIP_DEFS), und der Abgrund
// zahlt ueber abgrundScoreTotal() - die Rekordtiefe, nicht die Flotte - in den Punktestand ein.
// Wuerde diese Pruefung sie mitzaehlen, bliebe sie so lange rot, bis jemand neun Gewichte erfindet
// und damit die Bestenliste verschiebt. Die Regel, die hier wirklich gilt, ist die engere:
// Ein Schiff, das im NORMALEN Spiel gebaut und geflogen wird, braucht ein Gewicht.
const feSchiffe = [];
const feTiefenschiffe = [];
for (const z of feZeilen) {
  const m = z.match(/^\s*\{ key:'([a-z0-9_]+)', name:'[^']*', icon:'ship_/);
  if (!m) continue;
  feSchiffe.push(m[1]);
  if (/tiefenschiff:\s*true/.test(z)) feTiefenschiffe.push(m[1]);
}
const ohneGewicht = feSchiffe.filter(k => !(k in feGew) && !feTiefenschiffe.includes(k));
check('Gegenprobe: SHIP_DEFS wurde ueberhaupt gelesen', feSchiffe.length > 30, feSchiffe.length);
check('Gegenprobe: die Tiefenflotte wurde als solche erkannt (sonst prueft die Ausnahme nichts)',
  feTiefenschiffe.length === 9, feTiefenschiffe);
check('Jedes regulaere Schiff aus SHIP_DEFS hat ein Punktegewicht', ohneGewicht.length === 0, ohneGewicht);

// ---- 5. Gegenprobe -----------------------------------------------------------------------------
// Ohne sie waeren gruene Haken oben auch dann zu sehen, wenn die Leseregeln gar nichts finden.
check('Gegenprobe: die Leseregeln finden ueberhaupt etwas',
  Object.keys(feDef).length > 0 && Object.keys(beDef).length > 0
  && Object.keys(feStruct).length > 0 && Object.keys(beStruct).length > 0,
  { feDef: Object.keys(feDef).length, beDef: Object.keys(beDef).length,
    feStruct: Object.keys(feStruct).length, beStruct: Object.keys(beStruct).length });

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
