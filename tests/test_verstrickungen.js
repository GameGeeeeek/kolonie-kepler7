// Fünf Verstrickungen zwischen vorhandenen Systemen (01.08.2026).
//
// DER BEFUND, DER DAZU GEFÜHRT HAT
// --------------------------------
// Mehrere große Systeme redeten nur mit sich selbst:
//   - veteranRankOf() wurde an DREI Stellen gelesen, zweimal davon dieselbe Kampfzahl.
//   - Alle Fraktions-Rangvergünstigungen wirkten INNERHALB des Fraktionsreiters, und changeFactionRep()
//     wurde ausschließlich von Fraktions-Aktionen gerufen. Ruf war ein geschlossener Kreis.
//   - state.spyIntel wurde an fünf Stellen gelesen - alle fünf reine Anzeige.
//   - DOCTRINE_DEFS waren drei Zahlen ohne Verbindung zu Rollen, Fraktionen oder Abgrund.
//
// WIE DIESER TEST GEBAUT IST
// --------------------------
// Die ganze Spieldatei läuft in einer IIFE (Zeile 3625) - von außen ist keine einzige Funktion
// erreichbar, auch nicht im Browser. Deshalb drei Ebenen, jede mit ihrer eigenen Aufgabe:
//
//   1. RECHNUNG (Sandbox): Die neuen Helfer werden aus der echten Datei herausgeschnitten und mit
//      injizierten Abhängigkeiten ausgeführt - dasselbe Muster wie test_bonibilanz.js. Damit wird
//      die Zahl geprüft, nicht ihre Beschreibung.
//   2. VERDRAHTUNG (Quelltext): Ein richtig rechnender Helfer nützt nichts, wenn ihn niemand aufruft.
//      Jede der fünf Verbindungen wird an ihrer Verbrauchsstelle als vollständige Zeile nachgewiesen.
//   3. ANZEIGE (Browser): Die Karten müssen die neuen Zahlen auch nennen (CLAUDE.md Regel 6).
//
// Dazu der FRONTEND/BACKEND-GLEICHSTAND: Zwei der Verbindungen (Legion-Bündnis, Doktrin-Synergie)
// und der Aufklärungsvorteil werden im PvP vom Server nachgerechnet. Genau dafür gibt es in
// CLAUDE.md den Fallstrick "Backend hat teils eigene Kopien von Frontend-Formeln".
const { starteBrowser, SPIELDATEI, SPIEL_URL, SERVER_JS } = require('./lib/umgebung');
const fs = require('fs');
const path = require('path');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// Schneidet von einem Marker bis zum ersten Vorkommen des Endmarkers DAHINTER. Bewusst mit
// konkreten Endmarkern statt einer Klammerzählung - CLAUDE.md warnt ausdrücklich davor, einer
// naiven Regex über verschachtelte Array-Literale zu vertrauen.
function schnitt(von, bis, ohneEnde){
  const a = src.indexOf(von);
  if (a < 0) return null;
  const b = src.indexOf(bis, a + von.length);
  return b < 0 ? null : src.slice(a, ohneEnde ? b : b + bis.length);
}

// ================================================================= 1. RECHNUNG (Sandbox)
// Die Endmarker sind die jeweils NÄCHSTE Deklaration, ausgeschlossen - sonst nähme der Schnitt
// deren öffnende Klammer mit und der Block wäre unausgeglichen.
const blockFraktion = schnitt('const FACTION_OUTSIDE = {', '  // Ein Satz für die Fraktionskarte', true);
const blockVeteran  = schnitt('const VETERAN_ROLE_EXTRA = {', '  // Erklärzeile für die Veteranenkarte', true);
const blockDoktrin  = schnitt('const DOCTRINE_DEFS = [', '\n  ];');
const blockDokFn    = schnitt('function doctrineSynActive(doc){', '\n  }');
const blockSpy      = schnitt('const SPY_EDGE_MS = ', '\n  }');
check('Fraktions-Block ausgeschnitten', !!blockFraktion);
check('Veteranen-Block ausgeschnitten', !!blockVeteran);
check('Doktrin-Tabelle ausgeschnitten', !!blockDoktrin);
check('Doktrin-Funktionen ausgeschnitten', !!blockDokFn);
check('Spionage-Block ausgeschnitten', !!blockSpy);
if (!blockFraktion || !blockVeteran || !blockDoktrin || !blockDokFn || !blockSpy){
  console.log('\nFAIL'); process.exit(1);
}

// --- B: Fraktionsbündnis wirkt außerhalb ---------------------------------------------------------
// factionEffectLevel wird injiziert: 0 = kein Effekt, 1 = freundlich, 2 = verbündet.
function fraktionsBonus(fid, stufe){
  const ctx = {};
  new Function('ctx', 'factionEffectLevel',
    blockFraktion + ';ctx.b=factionOutsideBonus;ctx.t=FACTION_OUTSIDE;'
  )(ctx, () => stufe);
  return { bonus: ctx.b(fid), tabelle: ctx.t };
}
const legionTab = fraktionsBonus('legion', 0).tabelle;
check('vier Fraktionen haben einen Wirkort außerhalb',
  ['legion','kartell','void','schatten'].every(f => legionTab[f]), Object.keys(legionTab));
for (const fid of ['legion','kartell','void','schatten']){
  const ohne = fraktionsBonus(fid, 0).bonus;
  const freund = fraktionsBonus(fid, 1).bonus;
  const verb = fraktionsBonus(fid, 2).bonus;
  check(fid + ': 0 ohne Bündnis, und Verbündet bringt mehr als Freundlich',
    ohne === 0 && freund > 0 && verb > freund, { ohne, freund, verb });
}
check('Legion-Bündnis: +3% freundlich / +6% verbündet (Backend-Spiegel)',
  fraktionsBonus('legion', 1).bonus === 0.03 && fraktionsBonus('legion', 2).bonus === 0.06);

// --- A: Veteranenrang x Planetenrolle ------------------------------------------------------------
// planetRoleOf und veteranRankOf werden injiziert - so misst der Test die KOPPLUNG, nicht die
// Rangtabelle (die hat ihren eigenen Ort und darf sich unabhängig verschieben).
function vetExtra(rolle, rangBonus, art){
  const ctx = {};
  new Function('ctx', 'planetRoleOf', 'veteranRankOf',
    blockVeteran + ';ctx.f=veteranRoleExtra;ctx.t=VETERAN_ROLE_EXTRA;'
  )(ctx, () => (rolle ? { key: rolle } : null), () => ({ bonus: rangBonus }));
  return { wert: ctx.f('home', art), tabelle: ctx.t };
}
const vetTab = vetExtra(null, 0, 'def').tabelle;
check('genau drei Rollen sind mit dem Veteranenrang gekoppelt',
  Object.keys(vetTab).length === 3, Object.keys(vetTab));
check('Festungs-Welt: der Rang zählt auf die Verteidigung ein zweites Mal (Faktor 1,0)',
  vetExtra('fortress', 0.08, 'def').wert === 0.08, vetExtra('fortress', 0.08, 'def').wert);
check('Werft-Welt: Bauzeit-Anteil ist das 1,5-fache des Rangs',
  Math.abs(vetExtra('shipyard', 0.08, 'build').wert - 0.12) < 1e-9);
check('Tiefenhafen: Splitter-Anteil ist das Doppelte des Rangs',
  Math.abs(vetExtra('deepport', 0.08, 'abgrund').wert - 0.16) < 1e-9);
// Zwei Gegenproben. Die erste verhindert, dass die nächste "Vollständigkeits"-Runde allen sieben
// Rollen etwas gibt; die zweite, dass eine Rolle für die FALSCHE Wirkungsart zahlt.
for (const rolle of ['mining','trade','science','logistics']){
  check(rolle + ' bekommt vom Veteranenrang nichts',
    ['def','build','abgrund'].every(a => vetExtra(rolle, 0.08, a).wert === 0));
}
check('Festungs-Welt zahlt NICHT auf Bauzeit oder Splitter',
  vetExtra('fortress', 0.08, 'build').wert === 0 && vetExtra('fortress', 0.08, 'abgrund').wert === 0);
check('ohne Kampferfahrung ist die Kopplung überall 0',
  ['fortress','shipyard','deepport'].every((r,i) => vetExtra(r, 0, ['def','build','abgrund'][i]).wert === 0));

// --- E: Doktrin-Synergie -------------------------------------------------------------------------
function doktrin(key, rollen){
  const ctx = {};
  new Function('ctx', 'state', 'hasRoleAnywhere',
    blockDoktrin + ';' + blockDokFn.replace('function doctrineSynActive', 'function doctrineSynActive')
    + '\n  function activeDoctrine(){ return state.doctrine ? DOCTRINE_DEFS.find(d=>d.key===state.doctrine) : null; }'
    + ';ctx.m=doctrineMultOf;ctx.a=doctrineSynActive;ctx.d=DOCTRINE_DEFS;'
  )(ctx, { doctrine: key }, r => rollen.includes(r));
  return ctx;
}
// Die Paarliste wird aus DOCTRINE_DEFS ABGELEITET, nicht eingetippt. Vorher stand hier dreimal
// eine feste Dreierliste - eine vierte Doktrin waere damit still durchgerutscht, und genau das
// ist der teuerste Fehlertyp dieses Tests: Er haette weiter gruen gemeldet, waehrend Frontend und
// Backend im PvP auseinanderlaufen. Die Ableitung steht HINTER der Funktion `doktrin`, weil sie
// deren Rueckgabe braucht (Hausregel 3: die REGEL pruefen, nicht die Momentaufnahme).
const DOKTRIN_PAARE = doktrin(null, []).d.map(d => [d.key, (d.syn||{}).rolle]);
check('jede Doktrin hat eine Synergie mit einer Rolle',
  doktrin(null, []).d.every(d => d.syn && d.syn.rolle && d.syn.text), doktrin(null, []).d.map(d => d.key + '→' + (d.syn||{}).rolle));
check('Offensiv-Doktrin ohne Werft-Welt: nur der Grundwert 1,20',
  doktrin('doc_offensive', []).m('atkMult') === 1.20);
check('Offensiv-Doktrin MIT Werft-Welt: 1,20 × 1,08',
  Math.abs(doktrin('doc_offensive', ['shipyard']).m('atkMult') - 1.20*1.08) < 1e-9);
check('  ... und die falsche Rolle bringt ihr nichts',
  doktrin('doc_offensive', ['fortress','trade','mining']).m('atkMult') === 1.20);
check('Verteidigungs-Doktrin MIT Festungs-Welt: 1,20 × 1,08',
  Math.abs(doktrin('doc_defensive', ['fortress']).m('defMult') - 1.20*1.08) < 1e-9);
check('Logistik-Doktrin MIT Handels-Welt wirkt auf Treibstoff UND Lager',
  Math.abs(doktrin('doc_logistics', ['trade']).m('fuelMult') - 0.80*0.92) < 1e-9
  && Math.abs(doktrin('doc_logistics', ['trade']).m('cargoMult') - 1.20*1.08) < 1e-9);
check('ohne Doktrin ist jeder Multiplikator neutral',
  ['atkMult','defMult','fuelMult','cargoMult'].every(s => doktrin(null, ['shipyard','fortress','trade']).m(s) === 1));
// Die Synergie darf die andere Seite nicht anfassen - sonst wäre die Offensiv-Doktrin heimlich auch
// eine Verteidigungs-Doktrin.
check('die Synergie einer Doktrin fasst nur ihre eigene Seite an',
  doktrin('doc_offensive', ['shipyard']).m('defMult') === 0.85
  && doktrin('doc_defensive', ['fortress']).m('atkMult') === 0.85);

// --- E2: die additiven Doktrin-Kanaele (18.08.2026) ---------------------------------------------
// Drei wirtschaftliche Doktrinen kamen dazu. Ihre Kanaele sind SUMMANDEN, nicht Faktoren - der
// Neutralwert ist also 0 und nicht 1. Ein gemeinsamer Helfer haette bei fehlender Angabe entweder
// die Produktion halbiert oder den Faktor auf 0 gezogen; dass es zwei getrennte gibt, wird hier
// als Eigenschaft geprueft und nicht nur behauptet.
function doktrinB(key, rollen){
  const ctx = {};
  new Function('ctx', 'state', 'hasRoleAnywhere',
    blockDoktrin + ';' + blockDokFn
    + '\n  function activeDoctrine(){ return state.doctrine ? DOCTRINE_DEFS.find(d=>d.key===state.doctrine) : null; }'
    + '\n  function doctrineBonusOf(kanal){ const doc = activeDoctrine(); if (!doc) return 0; const grund = doc[kanal] || 0;'
    + '\n    return doctrineSynActive(doc) ? grund + ((doc.syn||{})[kanal] || 0) : grund; }'
    + ';ctx.b=doctrineBonusOf;ctx.d=DOCTRINE_DEFS;'
  )(ctx, { doctrine: key }, r => rollen.includes(r));
  return ctx;
}
check('E2-vorab: es gibt Doktrinen mit additiven Kanaelen',
  doktrinB(null, []).d.some(d => d.prodBonus || d.expBonus || d.splitterBonus),
  doktrinB(null, []).d.filter(d => d.prodBonus || d.expBonus || d.splitterBonus).map(d => d.key));
check('E2: ohne Doktrin ist jeder additive Kanal 0 (nicht 1)',
  doktrinB(null, []).b('prodBonus') === 0 && doktrinB(null, []).b('expBonus') === 0);
check('E2: Erschliessung ohne Bergbau-Welt gibt nur den Grundwert',
  Math.abs(doktrinB('doc_erschliessung', []).b('prodBonus') - 0.10) < 1e-9,
  { wert: doktrinB('doc_erschliessung', []).b('prodBonus') });
check('E2: MIT Bergbau-Welt kommt die Synergie ADDITIV dazu (nicht multiplikativ)',
  Math.abs(doktrinB('doc_erschliessung', ['mining']).b('prodBonus') - 0.15) < 1e-9,
  { wert: doktrinB('doc_erschliessung', ['mining']).b('prodBonus'), erwartet: 0.15 });
check('E2: die falsche Rolle bringt ihr nichts',
  Math.abs(doktrinB('doc_erschliessung', ['fortress','trade']).b('prodBonus') - 0.10) < 1e-9);
check('E2: Aufklaerung zahlt auf Expedition, nicht auf Produktion',
  doktrinB('doc_aufklaerung', ['science']).b('expBonus') > 0
  && doktrinB('doc_aufklaerung', ['science']).b('prodBonus') === 0);
check('E2: Bergung zahlt auf Splitter und kostet Produktion',
  doktrinB('doc_bergung', ['deepport']).b('splitterBonus') > 0
  && doktrinB('doc_bergung', ['deepport']).b('prodBonus') < 0,
  { splitter: doktrinB('doc_bergung', ['deepport']).b('splitterBonus'), prod: doktrinB('doc_bergung', ['deepport']).b('prodBonus') });
// Die eigentliche Sicherheitsaussage: kampfneutral. Solange das gilt, kann eine dieser Doktrinen
// im PvP gar nicht auseinanderlaufen - selbst gegen einen Server, der sie noch nicht kennt.
check('E2: alle Doktrinen mit additiven Kanaelen sind im Kampf NEUTRAL',
  doktrinB(null, []).d.filter(d => d.prodBonus || d.expBonus || d.splitterBonus)
    .every(d => (d.atkMult||1) === 1 && (d.defMult||1) === 1
             && ((d.syn||{}).atkMult||1) === 1 && ((d.syn||{}).defMult||1) === 1),
  doktrinB(null, []).d.filter(d => d.prodBonus || d.expBonus || d.splitterBonus)
    .map(d => d.key + ':atk' + (d.atkMult||1) + '/def' + (d.defMult||1)));

// --- D: Aufklärungsvorteil -----------------------------------------------------------------------
function spyEdge(intel){
  const ctx = {};
  new Function('ctx', 'state', blockSpy + ';ctx.f=spyIntelEdge;ctx.b=SPY_EDGE_BONUS;ctx.ms=SPY_EDGE_MS;')
    (ctx, { spyIntel: intel ? { gegner: intel } : {} });
  return ctx;
}
const jetzt = Date.now();
check('frische, unentdeckte Aufklärung gibt den Zuschlag',
  spyEdge({ capturedAt: jetzt, detected: false }).f('gegner') === spyEdge(null).b);
check('ohne Aufklärung kein Zuschlag', spyEdge(null).f('gegner') === 0);
check('ENTDECKTE Aufklärung gibt keinen Zuschlag - die Spionageabwehr verteidigt zweimal',
  spyEdge({ capturedAt: jetzt, detected: true }).f('gegner') === 0);
check('Aufklärung älter als 30 Minuten gibt keinen Zuschlag',
  spyEdge({ capturedAt: jetzt - 31*60*1000, detected: false }).f('gegner') === 0);
check('  ... 29 Minuten alt aber schon',
  spyEdge({ capturedAt: jetzt - 29*60*1000, detected: false }).f('gegner') > 0);
check('ein anderes Ziel bekommt den Zuschlag nicht',
  spyEdge({ capturedAt: jetzt, detected: false }).f('jemand-anders') === 0);

// --- C: Fundmeldung ------------------------------------------------------------------------------
const fundKosten = Number((src.match(/FUNDMELDUNG_SPLITTER = (\d+)/) || [])[1]);
const fundRep = Number((src.match(/FUNDMELDUNG_REP = (\d+)/) || [])[1]);
const fundRepVoid = Number((src.match(/FUNDMELDUNG_REP_VOID = (\d+)/) || [])[1]);
check('Fundmeldung: Kosten und Ertrag sind gesetzt', fundKosten > 0 && fundRep > 0, { fundKosten, fundRep });
check('die Void-Marodeure zahlen mehr - die Tiefe ist ihr Thema', fundRepVoid > fundRep, { fundRep, fundRepVoid });
// Bergungsgut bleibt unhandelbar: Die Fundmeldung darf NUR Splitter anfassen. Sonst wäre der
// ausdrückliche Verzicht beim Tiefenaufkäufer stillschweigend aufgehoben.
const meldeBlock = schnitt('function meldeFund(fid){', '\n  }');
check('meldeFund() fasst ausschließlich Splitter an, kein Bergungsgut',
  !!meldeBlock && /a\.splitter/.test(meldeBlock) && !/bergungsgut/i.test(meldeBlock));
check('meldeFund() setzt eine Sperrzeit', !!meldeBlock && /state\.fundmeldungLastAt\[fid\] = Date\.now\(\)/.test(meldeBlock));

// ================================================================= 2. VERDRAHTUNG (Quelltext)
// Ein richtig rechnender Helfer nützt nichts, wenn ihn niemand aufruft. Jede Verbindung an ihrer
// Verbrauchsstelle - als vollständige Zeile, nicht als Namensfund irgendwo in der Datei.
const verdrahtung = [
  ['Legion → Angriffskraft',      /combatBonus \+= factionOutsideBonus\('legion'\);/g, 2],
  ['Kartell → Handelsrouten',     /routeYieldMult\(\)\{[^\n]*factionOutsideBonus\('kartell'\)/, 1],
  ['Void → Abgrundsplitter',      /factionOutsideBonus\('void'\)/, 1],
  ['Schatten → Spionage-Tarnung', /Math\.min\(0\.6, shieldLvl\*0\.06\) \* \(1 - factionOutsideBonus\('schatten'\)\)/, 1],
  ['Veteran → Verteidigung',      /combatBonus \+= veteranRoleExtra\(planetKey, 'def'\);/, 1],
  ['Veteran → Schiffsbauzeit',    /e \*= \(1 - veteranRoleExtra\(planetKey, 'build'\)\);/, 1],
  ['Veteran → Abgrundsplitter',   /veteranRoleExtra\(planetKey, 'abgrund'\)/, 1],
  /* Hier stand die Wortform `attackPower(previewFleet, state.activeBasePlanet) * (1 + spyEdge)`.
     Seit dem 01.09.2026 rechnet die Vorschau ueber pvpReichskraft() - gemessen rechnet der Server
     die PvP-Angriffskraft ueber ALLE Standortflotten (computeAttackPower -> allFleetsOf), die
     Vorschau tat es ueber die Auswahl am aktiven Standort und war damit fuer jeden mit
     Kolonieflotten zu pessimistisch.
     Die Pruefung wird dabei STAERKER, nicht schwaecher: Sie haelt weiterhin fest, dass der
     Aufklaerungsvorteil eingerechnet wird - und zusaetzlich, dass die Kraft aus der Reichsflotte
     kommt. Eine Rueckkehr zur alten, zu kleinen Bezugsgroesse faellt damit auf; vorher waere sie
     unbemerkt geblieben, solange nur die Zeichenkette stimmte. */
  ['Aufklärung → PvP-Vorschau',   /pvpReichskraft\(null\) \* \(1 \+ spyEdge\)/, 1],
  ['PvP-Vorschau rechnet über die REICHSFLOTTE, nicht über eine Standort-Auswahl',
   /for \(const e of allFleetsWithPlanet\(\)\)\{[\s\S]{0,400}?attackPowerRaw\(f\) \* fleetDiversityMult\(f\)/, 1],
  ['PvP-Vorschau: der Konter kommt aus derselben Reichsflotte',
   /pvpReichskraft\(zielFlotte\) \/ rohKraft/, 1],
  ['Aufklärung → Solo-Auflösung', /attackPower\(m\.composition\|\|fleet, planetKey\) \* \(1 \+ spyIntelEdge\(m\.targetId\)\)/, 1],
  ['Aufklärung → Spionagebericht',/attackPower\(currentFleet\(\)\) \* \(1 \+ berichtEdge\)/, 1],
  // Die Berichte-Box hat einen Wertlisten-Signatur-Cache. Der Aufklärungsvorteil fällt nach 30
  // Minuten von selbst weg - steht er nicht in der Signatur, friert die Zeile ein und behauptet
  // weiter einen Zuschlag, den es nicht mehr gibt.
  ['Aufklärungsvorteil steht in der Signatur der Berichte-Box',
   /reportsSig = statsHtml\+'\|'\+reportsCache\.map\(r=>r\.id\+':'\+\(r\.targetId \? spyIntelEdge\(r\.targetId\) : 0\)\)/, 1]
];
for (const [name, re, mind] of verdrahtung){
  const n = re.global ? (src.match(re) || []).length : (re.test(src) ? 1 : 0);
  check('verdrahtet: ' + name, n >= mind, { gefunden: n, erwartet: mind });
}
// Die vier Doktrin-Anwendungsstellen laufen jetzt durch EINE Funktion. Bleibt eine der alten Zeilen
// stehen, vergisst genau sie die Synergie - das war der eigentliche Punkt der Umstellung.
for (const alt of ['if (doc) power *= doc.atkMult;', 'if (doc) power *= doc.defMult;',
                   'if (doc) cost *= doc.fuelMult;', 'if (doc) cap *= doc.cargoMult;']){
  check('alte Doktrin-Zeile ist weg: ' + alt, !src.includes(alt));
}
// Die additiven Kanaele brauchen ihre Verbrauchsstelle genauso wie die multiplikativen: Ein
// richtig rechnender Helfer nuetzt nichts, wenn ihn niemand aufruft. Geprueft wird, dass jeder
// Kanal in der jeweils vorhandenen, gedeckelten Gruppe landet - nicht als eigener Faktor.
check('der Produktions-Kanal landet in der additiven Gruppe',
  /globalBonus \+= doctrineBonusOf\('prodBonus'\)/.test(src));
check('der Expeditions-Kanal landet in der Ausbeute-Summe',
  /\+ doctrineBonusOf\('expBonus'\)/.test(src));
check('der Splitter-Kanal landet in abgrundSplitterFaktor',
  /\+ doctrineBonusOf\('splitterBonus'\)/.test(src));
check('kein additiver Kanal wird als FAKTOR multipliziert',
  !/\*=\s*doctrineBonusOf\(/.test(src));
check('alle vier Doktrin-Seiten laufen über doctrineMultOf()',
  ["doctrineMultOf('atkMult')", "doctrineMultOf('defMult')",
   "doctrineMultOf('fuelMult')", "doctrineMultOf('cargoMult')"].every(s => src.includes(s)));

// ================================================================= 3. FRONTEND/BACKEND-GLEICHSTAND
// Der Backend-Pfad kommt aus umgebung.js (SERVER_JS) und nicht mehr aus einem hier gebauten
// path.join. Grund, am 18.08.2026 schmerzhaft gemessen: Eine Gegenprobe mit
// KEPLER_BACKEND_SERVER auf eine sabotierte Kopie lief ins LEERE - der Test las weiter das echte
// server.js und meldete gruen, obwohl der Kopie eine ganze Doktrin fehlte. Die Sabotage hatte
// gegriffen, die Umleitung nicht; verraten hat es erst der Blick, ob die Kopie ueberhaupt gelesen
// wurde. Genau die Falle aus CLAUDE.md (Korrektur 15.08.2026 zu KEPLER_SPIELDATEI): eine still
// ignorierte Env-Variable sieht aus wie eine bestandene Gegenprobe.
const BE_PFAD = SERVER_JS || path.join(path.dirname(SPIELDATEI), '..', 'kolonie-kepler7-backend', 'server.js');
// Fehlt das Backend, SCHLÄGT der Test fehl statt still zwanzig Prüfungen zu überspringen
// (Fehlerbehebung 01.08.2026). Vorher stand hier ein 'HINWEIS - '-Text, den tests/run.js nicht
// auswertet: Der Ausfall des kompletten Gleichstands-Abschnitts wäre im Prüflauf unsichtbar
// gewesen, und genau dieser Abschnitt ist der Grund, warum es den Test gibt. Beide Repos liegen in
// diesem Projekt immer nebeneinander; fehlt eines, ist die Spiegelung ungeprüft - und das ist eine
// Aussage, die laut sein muss.
if (!fs.existsSync(BE_PFAD)){
  check('Backend-Repo liegt daneben (ohne es ist die Frontend/Backend-Spiegelung UNGEPRÜFT)', false, BE_PFAD);
} else {
  const be = fs.readFileSync(BE_PFAD, 'utf8');
  const feLegion = (blockFraktion.match(/legion:[^\n]*freundlich:([\d.]+),\s*verbuendet:([\d.]+)/) || []);
  const beLegion = (be.match(/LEGION_ALLY_ATK\s*=\s*\{\s*freundlich:\s*([\d.]+),\s*verbuendet:\s*([\d.]+)/) || []);
  check('Legion-Bündnis: Frontend und Backend nennen dieselben Werte',
    !!feLegion[1] && feLegion[1] === beLegion[1] && feLegion[2] === beLegion[2],
    { frontend:[feLegion[1], feLegion[2]], backend:[beLegion[1], beLegion[2]] });
  check('Legion-Bündnis: Backend nutzt dieselben Ruf-Schwellen 30/70 wie repTierOf()',
    /rep >= 70\) return LEGION_ALLY_ATK\.verbuendet/.test(be) && /rep >= 30\) return LEGION_ALLY_ATK\.freundlich/.test(be));
  const feEdge = (src.match(/SPY_EDGE_BONUS = ([\d.]+)/) || [])[1];
  const beEdge = (be.match(/SPY_EDGE_BONUS = ([\d.]+)/) || [])[1];
  check('Aufklärungsvorteil: gleicher Zuschlag auf beiden Seiten', !!feEdge && feEdge === beEdge, { feEdge, beEdge });
  check('Aufklärungsvorteil: gleiches Zeitfenster auf beiden Seiten',
    /SPY_EDGE_MS = 30\*60\*1000/.test(src) && /SPY_EDGE_MS = 30 \* 60 \* 1000/.test(be));
  check('Aufklärungsvorteil: Backend ignoriert entdeckte Aufklärung genau wie das Frontend',
    /if \(!it \|\| it\.detected\) return 0;/.test(be));
  check('Aufklärungsvorteil: Backend wendet ihn auf BEIDE Angriffskraft-Werte an',
    /computeAttackPower\(attacker, targetFleetSummary\) \* spyEdgeMult/.test(be)
    && /computeAttackPower\(attacker, null\) \* spyEdgeMult/.test(be));
  const beSynVon = be.indexOf('const DOCTRINE_SYN = {');
  const beSyn = beSynVon > 0 ? be.slice(beSynVon, be.indexOf('};', beSynVon)) : '';
  for (const [dk, rolle] of DOKTRIN_PAARE){
    const feHat = new RegExp("key:'" + dk + "'[\\s\\S]{0,1200}?syn:\\{ rolle:'" + rolle + "'").test(src);
    const beHat = new RegExp(dk + ":\\s*\\{\\s*rolle:\\s*'" + rolle + "'").test(beSyn);
    check('Doktrin-Synergie ' + dk + ' → ' + rolle + ': beide Seiten einig', feHat && beHat, { feHat, beHat });
  }
  check('Doktrin-Synergie: Backend prüft die Rolle wirklich (nicht nur Tabelle)',
    /hasRoleAnywhereServer\(save, syn\.rolle\)/.test(be));

  // Und jetzt die Backend-Seite AUSFÜHREN statt sie nur zu lesen. Gleiche Konstanten heißen noch
  // nicht gleiches Verhalten: Der Server liest andere Felder (save.factionRep statt state.factionRep,
  // save.planetSpecialization statt hasRoleAnywhere) und hat seine eigenen Schwellen ausgeschrieben.
  // Ein Zahlendreher in `rep >= 30` wäre von der Textprüfung oben nicht zu sehen.
  function beSchnitt(von, bis, ohneEnde){
    const a = be.indexOf(von); if (a < 0) return '';
    const b = be.indexOf(bis, a + von.length);
    return b < 0 ? '' : be.slice(a, ohneEnde ? b : b + bis.length);
  }
  const beCtx = {};
  new Function('ctx',
    beSchnitt('const LEGION_ALLY_ATK', 'function spyIntelEdge(save, targetUserId) {', true)
    + beSchnitt('function spyIntelEdge(save, targetUserId) {', '\n}')
    + beSchnitt('const DOCTRINE_MULTS', 'function doctrineMult(save, side) {', true)
    + beSchnitt('function doctrineMult(save, side) {', '\n}')
    + ';ctx.legion=legionAllianceBonus;ctx.spy=spyIntelEdge;ctx.doc=doctrineMult;'
  )(beCtx);
  const nu = Date.now();
  check('Backend rechnet: Legion 0 / 0,03 / 0,06 an den Schwellen 0 / 30 / 70',
    beCtx.legion({ factionRep:{ legion:29 } }) === 0
    && beCtx.legion({ factionRep:{ legion:30 } }) === 0.03
    && beCtx.legion({ factionRep:{ legion:69 } }) === 0.03
    && beCtx.legion({ factionRep:{ legion:70 } }) === 0.06);
  check('Backend rechnet: Feindschaft gibt keinen Kampfbonus und ein fehlendes Feld stürzt nicht ab',
    beCtx.legion({ factionRep:{ legion:-80 } }) === 0 && beCtx.legion({}) === 0);
  check('Backend rechnet: Aufklärungsvorteil frisch/entdeckt/alt/leer',
    beCtx.spy({ spyIntel:{ x:{ capturedAt:nu, detected:false } } }, 'x') === Number(feEdge)
    && beCtx.spy({ spyIntel:{ x:{ capturedAt:nu, detected:true } } }, 'x') === 0
    && beCtx.spy({ spyIntel:{ x:{ capturedAt:nu - 31*60*1000 } } }, 'x') === 0
    && beCtx.spy({}, 'x') === 0);
  check('Backend rechnet: Doktrin-Synergie nur mit der PASSENDEN Rolle',
    beCtx.doc({ doctrine:'doc_offensive', planetSpecialization:{} }, 'atk') === 1.20
    && Math.abs(beCtx.doc({ doctrine:'doc_offensive', planetSpecialization:{ a:'shipyard' } }, 'atk') - 1.20*1.08) < 1e-9
    && beCtx.doc({ doctrine:'doc_offensive', planetSpecialization:{ a:'fortress' } }, 'atk') === 1.20
    && beCtx.doc({}, 'atk') === 1);
  // Der eigentliche Gleichstand: dieselbe Lage muss auf beiden Seiten dieselbe Zahl ergeben. Je
  // Doktrin wird BEIDE Seiten geprüft (atk UND def) - eine einzelne Seite zu vergleichen wäre bei
  // doc_logistics eine Zeile gewesen, die konstruktionsbedingt immer 1===1 lautet und damit nie
  // fehlschlagen kann (Fehlerbehebung 01.08.2026).
  for (const [dk, rolle] of DOKTRIN_PAARE){
    for (const seite of ['atk','def']){
      const feWert = doktrin(dk, [rolle]).m(seite + 'Mult');
      const beWert = beCtx.doc({ doctrine:dk, planetSpecialization:{ a:rolle } }, seite);
      check('gleiche Zahl auf beiden Seiten: ' + dk + ' + ' + rolle + ' (' + seite + ')',
        Math.abs(feWert - beWert) < 1e-9, { feWert, beWert });
    }
  }
  // Und der Gegenbeweis, dass diese Schleife überhaupt etwas messen KANN: mindestens eine der sechs
  // Zahlen muss von 1 abweichen. Wären alle 1, verglichen die Zeilen oben nur Neutralwerte.
  const abweichend = DOKTRIN_PAARE
    .flatMap(([dk, rolle]) => ['atk','def'].map(s => beCtx.doc({ doctrine:dk, planetSpecialization:{ a:rolle } }, s)))
    .filter(v => Math.abs(v - 1) > 1e-9);
  check('die Gleichstands-Schleife vergleicht echte Werte, nicht lauter Neutralwerte',
    abweichend.length >= 4, abweichend);
  // doc_logistics ist serverseitig BEWUSST neutral (seine Synergie sind Treibstoff und Lager, die
  // der Server nicht rechnet). Das wird hier festgehalten, damit die Neutralität eine geprüfte
  // Aussage ist und nicht ein unbemerkter Ausfall.
  check('doc_logistics ist serverseitig neutral - und das Frontend wirkt dafür auf Treibstoff/Lager',
    beCtx.doc({ doctrine:'doc_logistics', planetSpecialization:{ a:'trade' } }, 'atk') === 1
    && Math.abs(doktrin('doc_logistics', ['trade']).m('fuelMult') - 0.80*0.92) < 1e-9);

  // ===== Prestige-Perks in den Kampfgruppen: eigenschaftsbasiert statt namentlich =====
  // Zweiter Fund der Nachprüfung vom 01.08.2026: Das Backend spiegelte von den Prestige-Perks NUR
  // 'combat'. Die stapelbaren 'schwarm' (+10% Angriff je Stapel) und 'sparwerft' (-5%) standen im
  // Frontend in BEIDEN Kampfgruppen und im Backend gar nicht - bei drei Stapeln Schwarmtaktiker
  // rechnete der Server 30 Prozentpunkte anders als die Vorschau anzeigte, das Zehnfache der
  // Abweichung, die der Legion-Bonus daneben verursacht hätte.
  //
  // Die Prüfung ist bewusst EIGENSCHAFTSBASIERT: Sie liest die Perk-Namen aus dem Frontend-Code
  // heraus und verlangt, dass jeder davon im Backend vorkommt. Eine Liste, die hier die Namen
  // aufzählt, wäre eine dritte Kopie und würde beim nächsten neuen Perk genauso veralten wie die
  // Backend-Kopie es getan hat.
  const kampfQuellen = ['function attackCombatBonusRaw(planetKey){', 'function defenseCombatBonusRaw(planetKey){']
    .map(m => schnitt(m, '\n  }') || '').join('\n');
  check('beide Kampf-Bonusfunktionen im Frontend gefunden', kampfQuellen.length > 500, kampfQuellen.length);
  const fePerks = [...new Set([...kampfQuellen.matchAll(/prestigePerkCount\('(\w+)'\)/g)].map(m => m[1]))];
  check('Frontend nutzt Prestige-Perks in den Kampfgruppen', fePerks.length >= 2, fePerks);
  const beGruppen = ['function combatBonusCommon(save) {', 'function attackBonusGroup(save) {', 'function defenseBonusGroup(save) {']
    .map(m => { const a = be.indexOf(m); return a < 0 ? '' : be.slice(a, be.indexOf('\n}', a)); }).join('\n');
  const fehlend = fePerks.filter(p => !beGruppen.includes("'" + p + "'"));
  check('jeder im Frontend-Kampf verwendete Prestige-Perk wird auch serverseitig gerechnet',
    fehlend.length === 0, { fehlend, feGefunden: fePerks });
  // Die Kehrseite von 'schwarm' (Verteidigungsmalus) steht im Frontend AUSSERHALB der gedeckelten
  // Gruppe, als eigener Multiplikator mit Untergrenze 0.5 - sie muss im Backend an derselben Art
  // von Stelle stehen, sonst hält der Server die Verteidigung für zu hoch.
  check('der Verteidigungsmalus des Schwarmtaktikers ist serverseitig gespiegelt',
    /Math\.max\(0\.5, 1 - \(\(save\.prestigePerks \|\| \[\]\)\.filter\(k => k === 'schwarm'\)\.length\) \* 0\.06\)/.test(be));

  // ===== Ruf-Schwellen über den GESAMTEN Bereich (Fehlerbehebung 01.08.2026) =====
  // Der teuerste Fund dieser Nachprüfung: factionEffectLevel() verglich den Rang-SCHLÜSSEL statt der
  // Ruf-Schwelle. Seit der Acht-Rang-Einführung liegt zwischen 'freundlich' (30) und 'verbuendet'
  // (70) der Rang 'geachtet' (50) - und für den traf keiner der beiden Schlüssel zu. Ergebnis war
  // ein totes Band von Ruf 50 bis 69, in dem JEDER Fraktionseffekt auf null fiel, während der
  // Server numerisch weiterrechnete.
  //
  // Dieser Block prüft deshalb nicht drei Stützstellen, sondern JEDEN Ruf-Wert von -100 bis 100
  // gegen die Backend-Regel. Damit fällt jede künftige Rang-Einfügung sofort auf, egal an welcher
  // Stelle sie passiert - eine Stützstellen-Prüfung hätte genau diesen Fehler wieder durchgelassen.
  const feEffekt = new Function('ctx', 'state',
    schnitt('const REP_RANKS = [', '\n  ];') + '\n'
    + schnitt('function repTierOf(rep){', '\n  }') + '\n'
    + 'const REP_MIN = -100, REP_MAX = 100;\n'
    + 'function factionRepOf(fid){ return Math.max(REP_MIN, Math.min(REP_MAX, (state.factionRep||{})[fid]||0)); }\n'
    + 'const REP_ALLY_THRESHOLD = ' + (src.match(/REP_ALLY_THRESHOLD = (\d+)/) || [])[1] + ';\n'
    + 'const REP_FRIENDLY_THRESHOLD = ' + (src.match(/REP_FRIENDLY_THRESHOLD = (\d+)/) || [])[1] + ';\n'
    + schnitt('function factionEffectLevel(fid){', '\n  }')
    + ';ctx.f=factionEffectLevel;');
  const luecken = [];
  for (let rep = -100; rep <= 100; rep++){
    const ctxE = {}; feEffekt(ctxE, { factionRep:{ legion: rep } });
    const fe = ctxE.f('legion');
    const soll = rep >= 70 ? 2 : (rep >= 30 ? 1 : 0);
    if (fe !== soll) luecken.push({ rep, frontend: fe, backendRegel: soll });
  }
  check('factionEffectLevel stimmt für JEDEN Ruf-Wert von -100 bis 100 mit der Backend-Regel überein',
    luecken.length === 0, luecken.slice(0, 6));
  // Der Bonus muss außerdem MONOTON sein: mehr Ruf darf nie weniger Wirkung bedeuten.
  const nichtMonoton = [];
  let letzter = 0;
  for (let rep = -100; rep <= 100; rep++){
    const ctxE = {}; feEffekt(ctxE, { factionRep:{ legion: rep } });
    const fe = ctxE.f('legion');
    if (fe < letzter) nichtMonoton.push({ rep, vorher: letzter, jetzt: fe });
    letzter = fe;
  }
  check('mehr Ruf bedeutet nie weniger Wirkung', nichtMonoton.length === 0, nichtMonoton);
  // Und die Stelle, die zuverlässig in die alte Lücke lief: enforceRivalExclusivity setzt den
  // Rivalen auf genau REP_ALLY_THRESHOLD - 1 und meldet dabei "Der Ruf bleibt freundlich."
  const ctx69 = {}; feEffekt(ctx69, { factionRep:{ legion: 69 } });
  check('bei Ruf 69 (das, worauf enforceRivalExclusivity setzt) gilt die Freundlich-Stufe',
    ctx69.f('legion') === 1, ctx69.f('legion'));
}

// ================================================================= 4. ANZEIGE (Browser)
// CLAUDE.md Regel 6: Eine Mechanik ohne Anzeigestelle ist die Hälfte des Fehlers. Geprüft wird an
// den Karten, die der Spieler wirklich sieht.
function backendStub(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s=200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'K', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

(async () => {
  // Doktrinen brauchen rkampf2 und rschildmatrix je Stufe 5, sonst zeigt die Box nur "gesperrt" -
  // dann prüfte der Test die Sperrmeldung statt der Synergie.
  const store = { 'kepler7-save-v3': JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
    seenTabHints:{ basis:1, verteidigung:1, forschung:1, flotte:1, galaxie:1 },
    resources:{ energie:9e5, erz:9e5, kristalle:9e5, deuterium:9e5, antimaterie:9e4, forschungspunkte:9e4 },
    buildings:{ solar:22, mine:20, labor:14, werft:15, lager:14, turm:12, schild:9 },
    research:{ rsolar:8, rkampf:8, rkampf2:6, rschildmatrix:6 },
    fleet:{ jaeger:500, schlachtschiff:60, frachter:40, spaeher:10, missions:[] },
    colonies:{}, activeBasePlanet:'home', doctrine:'doc_offensive',
    veteranXp:{ home: 5000 }, planetSpecialization:{ home:'fortress' },
    player:{ id:'u', name:'K', allianceTag:'', avatarKey:null }, battleStats:{ wins:20, losses:3 },
    xp:120000, buffs:[], lastTick:Date.now() }) };

  const b = await starteBrowser();
  const ctx = await b.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backendStub(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
  });

  // Veteranenkarte steht im Galaxie-Tab über der Angriffsflotten-Auswahl.
  for (const tab of ['galaxie','forschung','basis']){
    await page.evaluate(t => { const el = document.querySelector('.tab-btn[data-tab="'+t+'"]'); if (el) el.click(); }, tab);
    await page.waitForTimeout(900);
  }
  // document.body.textContent wäre hier eine TAUTOLOGIE (Fehlerbehebung 01.08.2026): Das <script>
  // der Spieldatei steht INNERHALB von <body> - nachgemessen beginnt <body> bei Zeichen 27.048 und
  // der Skriptblock bei 348.492 -, also enthält body.textContent den kompletten JS-Quelltext samt
  // aller String-Literale. Der gesuchte Satz ist ein Literal in VETERAN_ROLE_EXTRA und stand damit
  // unabhängig von jeder Anzeige darin: Der Prüfpunkt blieb selbst dann grün, wenn man die gesamte
  // sichtbare Oberfläche aus dem DOM entfernte. Jetzt wird eine Kopie ohne <script>/<style>
  // ausgewertet - das ist genau der Text, den ein Spieler lesen kann.
  const sicht = await page.evaluate(() => {
    const txt = id => { const e = document.getElementById(id); return e ? e.textContent : ''; };
    const kopie = document.body.cloneNode(true);
    kopie.querySelectorAll('script, style, template').forEach(e => e.remove());
    return { doktrin: txt('doctrineBox'), sichtbar: kopie.textContent || '',
             roh: (document.body.textContent || '').length };
  });
  // Gegenprobe zur Gegenprobe: Wenn die Bereinigung nichts abschneidet, ist sie wirkungslos und der
  // Prüfpunkt darunter wäre wieder eine Tautologie.
  check('die Sichtbarkeits-Auswertung schneidet den Skript-Quelltext wirklich weg',
    sicht.sichtbar.length < sicht.roh / 2 && !sicht.sichtbar.includes('VETERAN_ROLE_EXTRA'),
    { sichtbar: sicht.sichtbar.length, roh: sicht.roh });
  check('Doktrin-Karte nennt die Synergie', /Synergie/.test(sicht.doktrin), sicht.doktrin.slice(0, 160));
  check('Doktrin-Karte weist aus, dass die Werft-Welt fehlt',
    /keine Werft-Welt/.test(sicht.doktrin), sicht.doktrin.slice(0, 200));
  // Die drei wirtschaftlichen Doktrinen (18.08.2026) muessen in der Auswahl WIRKLICH auftauchen -
  // eine Zeile in DOCTRINE_DEFS, die keine Karte erzeugt, waere fuer den Spieler nicht vorhanden.
  // Geprueft wird gegen die Namen AUS DEM ARRAY, nicht gegen eingetippte (Hausregel 4/3).
  const wirtschaftlich = doktrinB(null, []).d.filter(d => d.prodBonus || d.expBonus || d.splitterBonus);
  const fehlendeKarten = wirtschaftlich.filter(d => !d.abgrund && sicht.doktrin.indexOf(d.name) === -1).map(d => d.name);
  check('jede wirtschaftliche Doktrin hat eine Karte in der Auswahl', fehlendeKarten.length === 0,
    { fehlend: fehlendeKarten, gefunden: wirtschaftlich.map(d => d.name) });
  // Und die Gegenrichtung, die diese Pruefung erst aussagekraeftig macht: Die Bergungs-Doktrin ist
  // an den Abgrund gebunden und darf im Fixture (ohne Abgrund) GERADE NICHT dastehen - sonst waere
  // "taucht auf" auch mit einer Auswahl gruen, die stur alles anzeigt.
  const nurMitAbgrund = wirtschaftlich.filter(d => d.abgrund).map(d => d.name);
  check('E2-vorab: es gibt eine abgrundgebundene Doktrin', nurMitAbgrund.length > 0, nurMitAbgrund);
  check('die abgrundgebundene Doktrin fehlt ohne freigeschalteten Abgrund',
    nurMitAbgrund.every(n => sicht.doktrin.indexOf(n) === -1),
    { gesucht: nurMitAbgrund, ausschnitt: sicht.doktrin.slice(0, 200) });

  // Veteranenkarte: der Rollen-Zusatz muss dastehen (Festungs-Welt mit Höchstrang im Spielstand).
  check('Veteranenkarte nennt die Rollen-Zusatzwirkung',
    /zählt auf ihre Verteidigung ein zweites Mal/.test(sicht.sichtbar), null);

  // Die Hilfe-Prüfungen sehen jetzt NUR in HELP_SECTIONS (Fehlerbehebung 01.08.2026). Vorher stand
  // hier .test(src) über die GANZE Datei - und da beide Wörter in den Quellcode-Kommentaren und in
  // der unveränderlichen PATCHNOTES-Historie vorkommen, wären die Prüfpunkte auch dann grün
  // geblieben, wenn kein einziger Hilfe-Abschnitt sie je erwähnt hätte.
  // Endmarker ist die nächste Deklaration NACH dem Array (helpOpenSections) - TUTORIAL_STEPS steht
  // in dieser Datei davor, nicht dahinter.
  const helpVon = src.indexOf('const HELP_SECTIONS');
  const helpBis = src.indexOf('let helpOpenSections', helpVon);
  const hilfe = (helpVon > 0 && helpBis > helpVon) ? src.slice(helpVon, helpBis) : '';
  check('HELP_SECTIONS-Block ausgeschnitten (sonst wären die drei Prüfungen darunter wirkungslos)',
    hilfe.length > 50000, hilfe.length);
  check('Hilfe kennt den Aufklärungsvorteil', /Aufklärungsvorteil/.test(hilfe));
  check('Hilfe kennt die Fundmeldung', /Fundmeldung/.test(hilfe));
  check('Hilfe nennt die Veteranen-Rollen-Kopplung', /Festungs-Welt/.test(hilfe) && /Werft-Welt/.test(hilfe));
  check('Hilfe nennt die Doktrin-Synergie', /Synergie/.test(hilfe));

  check('keine Skriptfehler', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
