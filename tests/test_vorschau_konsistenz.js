// Vorschauen und Schaetzungen gegen die Stelle, die tatsaechlich rechnet.
//
// Eine Vorschau, die anders rechnet als die Ausfuehrung, ist die schlimmste Sorte zweiter
// Anzeigestelle: Der Spieler trifft seine Entscheidung an ihr. Im Konsistenz-Audit vom 01.08.2026
// sind vier davon zusammengekommen - und eine hat nicht nur falsch informiert, sondern eine Aktion
// VERWEHRT:
//
//   A) Die Kolonisierungs-Vorschau rechnete den Treibstoff mit missionFuelCost() statt mit
//      missionFuelCostSplit(). Nur die Split-Variante zieht Treibstoffdepot-Rabatt,
//      Klassen-Treibstoffmodule und Werftmarken ab und verteilt auf Deuterium/Antimaterie. Die
//      Vorschau nannte also einen ZU HOHEN Betrag - und weil der Knopf per canAfford() an dieser
//      Zahl haengt, war er bei knapper Kasse gesperrt, obwohl die Kolonisierung bezahlbar war.
//   B) Die Frachtraum-Warnung vor Expeditionen liess codexExpeditionBonus() aus, den die echte
//      Fundaufloesung enthaelt - sie schaetzte den groessten moeglichen Fund bis zu 13% zu niedrig
//      und meldete "passt", wo die Beute nicht mehr in den Laderaum ging.
//   C) Die Flottenparade zaehlte 15 von 32 Schiffstypen - im Bild UND in "Schiffe gesamt". Eine
//      reine Apex-Flotte erschien als leere Parade mit null Schiffen.
//   D) Das Profil eines FREMDEN Spielers zeichnete dessen Flotte mit den Werftmarken des eigenen
//      Kontos - eine Aufruestung, die an einem fremden Konto gar nicht einsehbar ist.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const zeilen = src.split('\n');

// ---- A: Kolonisierung ---------------------------------------------------------------------------
// Beide Vorschauen (Planet und Mond) muessen dieselbe Funktion nutzen wie die Bezahlung.
check('Kolonisierungs-Vorschau nutzt die Split-Variante (Planet)',
  src.includes('const colFuelSplit = missionFuelCostSplit(colDur, { colonyShips:1 })'));
check('Kolonisierungs-Vorschau nutzt die Split-Variante (Mond)',
  src.includes('const moonFuelSplit = missionFuelCostSplit(moonDur, { colonyShips:1 })'));
// Der alte Aufruf darf nicht zurueckkommen - er sieht harmlos aus und ist es nicht.
const alteForm = [...src.matchAll(/missionFuelCost\((?:col|moon)Dur, 1\)/g)];
check('kein rabattfreier Treibstoff mehr in den Kolonisierungs-Vorschauen', alteForm.length === 0, alteForm.length);
// Und die ANZEIGE muss den Split ausgeben, nicht eine einzelne Deuterium-Zahl. Das ist kein
// Schoenheitsfehler: Nach dem Umbau existierten die alten Variablen nicht mehr, ein
// stehengebliebenes ${colFuel} haette die Karte beim Rendern mit einem ReferenceError zerrissen -
// und der Syntax-Check haette das NICHT gefunden.
check('die Anzeige gibt den Split aus (Planet)', src.includes('${fuelCostIconHtml(colFuelSplit)} Treibstoff'));
check('die Anzeige gibt den Split aus (Mond)', src.includes('${fuelCostIconHtml(moonFuelSplit)} Treibstoff'));
for (const tot of ['colFuel', 'moonFuel']){
  check(`keine toten Verweise auf \${${tot}}`, !src.includes('${' + tot + '}'));
}

// ---- B: Expeditions-Beutefaktor -----------------------------------------------------------------
// Schaetzung und Aufloesung teilen sich jetzt eine Funktion. Geprueft wird beides: dass es sie
// gibt, dass BEIDE sie rufen, und dass die Formel nur noch EINMAL im Code steht.
// Zweiter Parameter seit v8.374.0: der STARTPLANET, fuer den ortsgebundenen Signalring des
// Orbitalrings. Der Ausdruck laesst ihn zu, verlangt aber weiterhin rewardMult an erster Stelle.
check('expeditionRewardMult existiert', /function expeditionRewardMult\(rewardMult(, \w+)?\)\{/.test(src));
check('die Frachtraum-Schaetzung ruft sie', /EXPEDITION_MAX_RESOURCE_FIND_BASE \* expeditionRewardMult\(rewardMult(, \w+)?\)/.test(src));
check('die Fundaufloesung ruft sie', src.includes('const baseRewardMult = expeditionRewardMult('));
const formelKopien = [...src.matchAll(/prestigePerkCount\('expedition'\)\*0\.04/g)];
check('die Beute-Formel steht nur noch einmal im Code', formelKopien.length === 1, formelKopien.length);
check('und sie enthaelt den Kodex-Bonus, der der Schaetzung fehlte',
  /function expeditionRewardMult[\s\S]{0,400}codexExpeditionBonus\(\)/.test(src));

// ---- C: Flottenparade ---------------------------------------------------------------------------
// Die Reihenfolge muss aus dem echten Schiffsbestand kommen, nicht aus einer getippten Liste.
const paradeVon = src.indexOf('async function generateFleetCard(');
const parade = src.slice(paradeVon, src.indexOf('\n  // --- Allianz-Karte', paradeVon));
check('die Parade leitet ihre Typenliste aus SHIP_SCORE_WEIGHTS ab',
  /const order = Object\.keys\(SHIP_SCORE_WEIGHTS\)/.test(parade));
check('keine handgetippte Typenliste mehr in der Parade',
  !parade.includes("const order = ['superschlachtschiff'"));
// Gegenprobe: SHIP_SCORE_WEIGHTS muss deutlich mehr Typen kennen als die alte 15er-Liste - sonst
// waere der Umbau wirkungslos und der gruene Haken oben bedeutungslos.
const gewichte = src.indexOf('const SHIP_SCORE_WEIGHTS = {');
const typen = [...src.slice(gewichte, src.indexOf('};', gewichte)).matchAll(/([a-z]+):/g)].map(m => m[1]);
check('SHIP_SCORE_WEIGHTS kennt deutlich mehr als die alten 15 Typen', typen.length > 25, typen.length);
for (const modern of ['leerenjaeger', 'nanoklinge', 'fusionsdreadnought', 'singularitaetsvernichter', 'hyperbomber']){
  check(`die moderne Kampfklasse "${modern}" ist erfasst`, typen.includes(modern));
}

// ---- D: fremde Flotte ohne eigene Marken --------------------------------------------------------
// Der Maler hat seit v8.394.0 einen vierten Parameter (ohneAnstrich, fuer die Gegenseite in der
// Kampf-Wiedergabe). Geprueft wird die Stellung von markOverride, nicht die Zahl der Parameter.
check('drawShipMiniIcon nimmt eine Marken-Uebersteuerung', /function drawShipMiniIcon\(key, canvas, markOverride(, \w+)*\)\{/.test(src));
check('und wertet sie vor der eigenen Stufe aus', /\(typeof markOverride === 'number'\) \? markOverride/.test(src));
check('das Profil eines fremden Spielers nutzt sie',
  /profileModalStats[\s\S]{0,160}drawShipMiniIcon\(cv\.getAttribute\('data-ship'\), cv, 1\)/.test(src));
// Die eigene Flottenliste soll die Marken WEITERHIN zeigen - der Fix darf nicht ueberschiessen.
check('die eigene Flottenliste zeigt weiter die eigenen Marken',
  /drawShipMiniIcon\(c\.getAttribute\('data-ship-icon'\), c\)/.test(src));

// ---- E: der Superschlachtschiff-Sonderfall ------------------------------------------------------
// Er stand an sieben Stellen einzeln, jede mit einem eigenen nachgebauten Objekt.
check('shipDefOrSuper liefert Icon und Angriffswert mit',
  /if \(key === 'superschlachtschiff'\) return \{ key:'superschlachtschiff', name:'Superschlachtschiff', icon:'ship_superschlachtschiff', atk:shipBaseAtk\('superschlachtschiff'\)/.test(src));
// Gescannt wird ohne reine Kommentarzeilen: Der Kommentar ueber shipDefOrSuper zitiert die alte
// Form zwangslaeufig im Wortlaut, und ein Test, der darauf anschlaegt, bestraft die Dokumentation
// des Fehlers statt seinen Rueckfall. (Dieselbe Falle hat schon test_flottenschaetzung.js gestellt.)
const codeOnly = src.split('\n').filter(z => !z.trim().startsWith('//')).join('\n');
const nachgebaut = [...codeOnly.matchAll(/k===\s*'superschlachtschiff'\s*\?\s*\{/g)];
check('kein nachgebautes Superschlachtschiff-Objekt mehr', nachgebaut.length === 0, nachgebaut.length);
const iconTernaer = [...codeOnly.matchAll(/k===\s*'superschlachtschiff'\s*\?\s*'ship_superschlachtschiff'/g)];
check('kein Icon-Ternaer mehr', iconTernaer.length === 0, iconTernaer.length);
check('Gegenprobe: der Scan wuerde die alte Form erkennen',
  /k===\s*'superschlachtschiff'\s*\?\s*\{/.test("const def = k==='superschlachtschiff' ? {name:'X'} : null;"));

// ---- F: Boni-Bilanz nennt, was wirklich einzahlt ------------------------------------------------
// Die Quellenliste ist Fliesstext und laesst sich nicht rechnen - deshalb wird geprueft, dass die
// im Code tatsaechlich summierten Quellen darin auftauchen.
const bilanzVon = src.indexOf('const BONUS_GROUPS = [');
const bilanz = src.slice(bilanzVon, src.indexOf('let lastBonusBalanceSig', bilanzVon));
const defQuelle = (bilanz.match(/key:'def'[\s\S]{0,400}?quelle:'([^']*)'/) || [])[1] || '';
for (const quelle of ['Flaggschiff', 'Fähigkeitsbaum', 'Megaprojekte', 'Veteranen', 'Artefakt', 'Allianzprojekte']){
  check(`Verteidigungs-Bilanz nennt "${quelle}"`, defQuelle.includes(quelle));
}
const prodQuelle = (bilanz.match(/key:'prod'[\s\S]{0,400}?quelle:'([^']*)'/) || [])[1] || '';
for (const quelle of ['Allianz-Toprang', 'Exotenforschung', 'Artefakt', 'Schürfschiffe']){
  check(`Produktions-Bilanz nennt "${quelle}"`, prodQuelle.includes(quelle));
}

// ---- G: Labor-Deckel ----------------------------------------------------------------------------
check('Labor-Konstanten existieren', /const LAB_TIME_PER_LAB = ([\d.]+), LAB_TIME_CAP = ([\d.]+);/.test(src));
check('die Forschungsdauer nutzt sie', src.includes('Math.max(1 - LAB_TIME_CAP, 1 - labs*LAB_TIME_PER_LAB)'));
check('und die Hilfe rechnet die Laborzahl daraus',
  src.includes("Math.ceil(LAB_TIME_CAP/LAB_TIME_PER_LAB)+' Laboren erreicht"));
const lm = src.match(/const LAB_TIME_PER_LAB = ([\d.]+), LAB_TIME_CAP = ([\d.]+);/);
if (lm){
  const labore = Math.ceil(Number(lm[2]) / Number(lm[1]));
  check('der Deckel wird bei 10 Laboren erreicht, nicht bei den frueher genannten 15', labore === 10, labore);
}

// ---- H: Kryo-Archiv -----------------------------------------------------------------------------
check('die Prestige-Hilfe liest die bewahrten Mengen aus KRYOARCHIV_KEEP_PER_LEVEL',
  src.includes("Object.entries(KRYOARCHIV_KEEP_PER_LEVEL)"));
const kryo = (src.match(/const KRYOARCHIV_KEEP_PER_LEVEL = \{([^}]*)\}/) || [])[1] || '';
// Gegen die TABELLE gerechnet statt gegen eine Zahl (16.08.2026): Genau DAS ist die Aussage -
// das Kryo-Archiv muss jede Kette kennen, egal wie viele es gibt. Vorher stand hier eine 7, die
// bei der ersten neuen Kette riss, ohne dass die gepruefte Eigenschaft verletzt war.
const kryoKeys = (kryo.match(/(\w+):\s*\d+/g) || []).map(x => x.split(':')[0].trim());
// AUF DEN TABELLENBLOCK BESCHRAENKT (Arbeitsregel 39): Ungescopt traf dieses Muster auch
// Reiter-, Abschnitts- und Ressourcen-Listen - die erste Fassung las 35 vermeintliche Ketten
// und meldete das Kryo-Archiv als lueckenhaft, obwohl es vollstaendig war.
const t2Von = src.indexOf("  const TIER2_DEFS = [");
const t2Bis = t2Von < 0 ? -1 : src.indexOf('\n  ];', t2Von);
check('Gegenprobe: der TIER2_DEFS-Block ist abgegrenzt', t2Von >= 0 && t2Bis > t2Von, { t2Von, t2Bis });
const t2Ketten = (t2Von >= 0 && t2Bis > t2Von)
  ? [...src.slice(t2Von, t2Bis).matchAll(/\{ key:'(\w+)', label:'/g)].map(m => m[1]) : [];
check('Gegenprobe: beide Listen wurden gelesen', kryoKeys.length >= 7 && t2Ketten.length >= 7,
  { kryo: kryoKeys.length, ketten: t2Ketten.length });
check('das Kryo-Archiv deckt JEDE Tier-2-Kette ab',
  t2Ketten.every(k => kryoKeys.includes(k)), t2Ketten.filter(k => !kryoKeys.includes(k)));

// ---- I: DEFS-Arrays muessen reine DATEN bleiben --------------------------------------------------
// Sechs Tests werten MODULE_DEFS/SHIP_MODULE_DEFS in einer Sandbox aus und injizieren dabei nur die
// HERKUNFT_*-Konstanten. Das ist ein Vertrag: Die Arrays duerfen beim Anlegen nichts aufrufen und
// nichts referenzieren, was erst spaeter im Skript entsteht.
//
// Am 01.08.2026 zweimal gebrochen, beide Male am selben Tag: Eine berechnete Zeitangabe in der
// Taktschmiede-Beschreibung rief shipMarkTotalDurationText() (brach sechs Tests) und griff auf
// ABGRUND_TAKT_DECKEL zu - eine const, die 14.000 Zeilen SPAETER deklariert ist. Letzteres ist
// beim Laden ein "Cannot access before initialization": Das ganze Spiel startete nicht.
//
// Merksatz: In einer desc rechnet man nicht. Wo eine Zahl mitwachsen soll, gehoert sie in einen
// Hilfetext (HELP_SECTIONS wird von keinem Test als Daten ausgewertet) - nicht in die Definition.
const defsBloecke = ['MODULE_DEFS', 'SHIP_MODULE_DEFS'];
for (const name of defsBloecke){
  const von = src.indexOf('const ' + name + ' = [');
  check(`${name} gefunden`, von > 0);
  if (von < 0) continue;
  const bis = src.indexOf('\n  ];', von);
  const block = src.slice(von, bis > von ? bis : von + 200000);
  // Funktionsaufrufe in Zeichenketten-Verkettung: '+irgendwas(...)+'
  const aufrufe = [...block.matchAll(/'\s*\+\s*([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]);
  check(`${name} ruft beim Anlegen keine Funktion auf`, aufrufe.length === 0, [...new Set(aufrufe)]);
  // Verweise auf Konstanten, die erst SPAETER im Skript deklariert werden.
  const verweise = [...new Set([...block.matchAll(/'\s*\+\s*([A-Z][A-Z0-9_]{3,})\b/g)].map(m => m[1]))];
  const zuSpaet = verweise.filter(v => {
    const decl = src.indexOf('const ' + v + ' =');
    return decl > von;   // Deklaration liegt hinter dem Array -> beim Laden nicht verfuegbar
  });
  check(`${name} verweist auf keine erst spaeter deklarierte Konstante`, zuSpaet.length === 0, zuSpaet);
}
// Gegenprobe: Die Erkennung greift ueberhaupt.
check('Gegenprobe: ein Funktionsaufruf in einer desc wuerde erkannt',
  /'\s*\+\s*([A-Za-z_$][\w$]*)\s*\(/.test("desc:'Text '+fmtDuration(12)+' Ende'"));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
