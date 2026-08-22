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

// ---- 5. Kampfwerte je Schiffstyp: atk, defWeight, Schild ----------------------------------------
// Diese drei Tabellen entscheiden JEDEN PvP-Kampf (weightedFleetDefensePower/fleetShieldSum), und
// bis zum 22.08.2026 hat sie KEIN Test gelesen - genau deshalb ist der Kausalitaetsbrecher
// monatelang mit defWeight 1 statt 1,8 und Schild 0 statt 120 durch die Verteidigung gelaufen
// (gemessen: 136 statt 365 Verteidigungspunkte je Schiff, mit voller Kampfforschung 267 statt 600).
// Die Backend-CLAUDE.md nennt beim Urmaterie-Koloss ausdruecklich, dass ausgerechnet diese zwei
// Tabellen "KEIN Test gemeldet" hat - das ist hiermit geschlossen.
//
// Verglichen wird die WIRKUNG, nicht die Tabellenmitgliedschaft: Ein Schiff ohne Eintrag ist kein
// Fehler, es bekommt dann den Vorgabewert (defWeight 1, Schild 0). Falsch ist erst, wenn der
// wirksame Wert vom Frontend abweicht. Und verglichen werden MENGEN statt Namen - ein kuenftiges
// Schiff faellt damit auf, ohne dass jemand an es gedacht haben muss.
const tabelleLesen = (quelle, name) => {
  const block = (quelle.match(new RegExp('const ' + name + ' = \\{([^\\n]*?)\\};')) || [])[1] || '';
  const raus = {};
  for (const t of block.replace(/\/\/.*$/, '').matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([0-9.]+)/g)) raus[t[1]] = Number(t[2]);
  return raus;
};
const beAtk = tabelleLesen(beSrc, 'SHIP_ATK_VALUES');
const beDw  = tabelleLesen(beSrc, 'SHIP_DEF_WEIGHTS');
const beSch = tabelleLesen(beSrc, 'SHIP_SHIELD_EXPLICIT');

// SHIP_DEFS MEHRZEILIG lesen: Die drei Allianzschiffe tragen ihr defWeight auf der ZWEITEN Zeile
// ihres Eintrags. Eine zeilenweise Lesung wie in Abschnitt 4 meldet fuer sie defWeight 1 und damit
// drei Abweichungen, die es nicht gibt - genau so ist es beim Bau dieses Abschnitts passiert.
// Geschnitten wird deshalb vom Eintragsanfang bis zum NAECHSTEN Eintragsanfang.
const sdAnf = feSrc.indexOf('const SHIP_DEFS = [');
const sdEnde = feSrc.indexOf('\n  ];', sdAnf);
const sdBlock = (sdAnf >= 0 && sdEnde > sdAnf) ? feSrc.slice(sdAnf, sdEnde) : '';
check('5-anker: der SHIP_DEFS-Block wurde gefunden', sdBlock.length > 1000, sdBlock.length);
const sdPos = [];
for (const m of sdBlock.matchAll(/\{ key:'([a-z0-9_]+)', name:'[^']*', icon:'ship_/g)) sdPos.push({ key: m[1], i: m.index });
const feKampf = sdPos.map((p, n) => {
  const txt = sdBlock.slice(p.i, n + 1 < sdPos.length ? sdPos[n + 1].i : sdBlock.length);
  return { key: p.key,
    atk: Number((txt.match(/atk:\s*(\d+)/) || [])[1] || 0),
    dw: (txt.match(/defWeight:\s*([0-9.]+)/) || [])[1],
    schild: (txt.match(/shield:\s*(\d+)/) || [])[1],
    tief: /tiefenschiff:\s*true/.test(txt) };
});
check('5-vorab: mehrzeilige Eintraege werden gelesen (Paktkorvette traegt ihr defWeight auf Zeile 2)',
  (feKampf.find(s => s.key === 'paktkorvette') || {}).dw === '0.7',
  (feKampf.find(s => s.key === 'paktkorvette') || {}).dw);

const wirkAbweich = [];
for (const s of feKampf) {
  if (!(s.key in beAtk)) continue;                       // iteriert das Backend nicht - siehe 5d
  const feW = s.dw === undefined ? 1 : Number(s.dw);
  const feS = s.schild === undefined ? 0 : Number(s.schild);
  const beW = beDw[s.key] !== undefined ? beDw[s.key] : 1;
  const beS = beSch[s.key] !== undefined ? beSch[s.key] : 0;
  if (s.atk !== beAtk[s.key]) wirkAbweich.push(s.key + ' atk: FE=' + s.atk + ' BE=' + beAtk[s.key]);
  if (feW !== beW) wirkAbweich.push(s.key + ' defWeight: FE=' + feW + ' BE=' + beW);
  if (feS !== beS) wirkAbweich.push(s.key + ' Schild: FE=' + feS + ' BE=' + beS);
}
check('5a: Angriff, Verteidigungsgewicht und Schild wirken im Backend wie im Frontend',
  wirkAbweich.length === 0, wirkAbweich);

// Das Superschlachtschiff hat keinen SHIP_DEFS-Eintrag (es ist ein Superschiff und steht in eigenen
// Konstanten). Es deshalb blind auszunehmen waere die schwaechere Loesung - seine drei Werte stehen
// im Frontend genauso schwarz auf weiss, nur woanders.
const feSsAtk = Number((feSrc.match(/if \(key === 'superschlachtschiff'\) return (\d+);/) || [])[1] || 0);
const feSsSch = Number((feSrc.match(/const SUPERSCHLACHTSCHIFF_SHIELD = (\d+)/) || [])[1] || 0);
const feSsDw  = Number((feSrc.match(/const SUPERSCHLACHTSCHIFF_DEF_WEIGHT = ([0-9.]+)/) || [])[1] || 0);
check('5b-vorab: die drei Superschlachtschiff-Werte wurden im Frontend gefunden',
  feSsAtk > 0 && feSsSch > 0 && feSsDw > 0, { atk: feSsAtk, schild: feSsSch, defWeight: feSsDw });
check('5b: das Superschlachtschiff stimmt in allen drei Werten ueberein',
  beAtk.superschlachtschiff === feSsAtk && beSch.superschlachtschiff === feSsSch && beDw.superschlachtschiff === feSsDw,
  { FE: { atk: feSsAtk, schild: feSsSch, defWeight: feSsDw },
    BE: { atk: beAtk.superschlachtschiff, schild: beSch.superschlachtschiff, defWeight: beDw.superschlachtschiff } });

// Gegenrichtung: ein Backend-Eintrag ohne Gegenstueck im Frontend rechnet mit einem Schiff, das es
// nicht gibt - und ein Eintrag in defWeight/Schild, den SHIP_ATK_VALUES nicht kennt, wird gar nicht
// erst gelesen (beide Schleifen laufen ueber SHIP_ATK_VALUES) und ist damit stiller toter Code.
const feKeys = new Set(feKampf.map(s => s.key).concat(['superschlachtschiff']));
const beFremd = Object.keys(beAtk).filter(k => !feKeys.has(k));
check('5c: das Backend fuehrt keinen Kampfwert fuer ein Schiff, das es im Frontend nicht gibt',
  beFremd.length === 0, beFremd);
const beUngelesen = Object.keys(beDw).concat(Object.keys(beSch)).filter(k => !(k in beAtk));
check('5c2: jeder Eintrag in SHIP_DEF_WEIGHTS/SHIP_SHIELD_EXPLICIT wird auch wirklich gelesen',
  beUngelesen.length === 0, beUngelesen);

// Und die Richtung, an der der Urmaterie-Koloss beinahe gescheitert waere: Ein KAMPFSCHIFF, das gar
// nicht erst in SHIP_ATK_VALUES steht, traegt im PvP NULL - ohne Vorgabewert, weil beide Schleifen
// ueber genau diese Tabelle laufen. Fuer die Wirtschaftsschiffe ist das richtig (atk 0, kein Schild),
// fuer die Tiefenflotte ebenfalls (defWeight 0, eigene Waehrung, nicht in ATTACK_SHIP_KEYS).
// Der Mondzerstoerer ist die EINE dokumentierte Ausnahme: Ihn aufzunehmen waere laut Kommentar im
// Backend "eine ungewollte Aenderung der PvP-Kampfkraft" - er steht deshalb namentlich hier, damit
// sein Verschwinden aus dieser Liste genauso auffaellt wie ein neuer Fall.
const MONDZERSTOERER_AUSNAHME = 'mondzerstoerer';
const stumm = feKampf.filter(s => !(s.key in beAtk) && s.key !== MONDZERSTOERER_AUSNAHME
  && (s.atk > 0 || s.schild !== undefined || (s.dw !== undefined && Number(s.dw) > 0)));
check('5d: kein Schiff mit Kampfwerten fehlt in SHIP_ATK_VALUES (es zaehlte im PvP sonst NULL)',
  stumm.length === 0, stumm.map(s => s.key + ' (atk ' + s.atk + ', Schild ' + (s.schild || 0) + ', defWeight ' + (s.dw || 0) + ')'));
check('5d2: die Ausnahme ist noch eine - der Mondzerstoerer hat weiterhin Kampfwerte und fehlt weiterhin',
  !!feKampf.find(s => s.key === MONDZERSTOERER_AUSNAHME && s.atk > 0) && !(MONDZERSTOERER_AUSNAHME in beAtk),
  { imFrontend: !!feKampf.find(s => s.key === MONDZERSTOERER_AUSNAHME), imBackend: MONDZERSTOERER_AUSNAHME in beAtk });

check('5e: Gegenprobe - die drei Backend-Tabellen wurden ueberhaupt gelesen',
  Object.keys(beAtk).length > 20 && Object.keys(beDw).length > 20 && Object.keys(beSch).length > 5,
  { atk: Object.keys(beAtk).length, defWeight: Object.keys(beDw).length, schild: Object.keys(beSch).length });

// ---- 6. Gegenprobe -----------------------------------------------------------------------------
// Ohne sie waeren gruene Haken oben auch dann zu sehen, wenn die Leseregeln gar nichts finden.
check('Gegenprobe: die Leseregeln finden ueberhaupt etwas',
  Object.keys(feDef).length > 0 && Object.keys(beDef).length > 0
  && Object.keys(feStruct).length > 0 && Object.keys(beStruct).length > 0,
  { feDef: Object.keys(feDef).length, beDef: Object.keys(beDef).length,
    feStruct: Object.keys(feStruct).length, beStruct: Object.keys(beStruct).length });

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
