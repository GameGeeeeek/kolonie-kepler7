// Vorposten (B2): der Vertrag zwischen Frontend und server.js (02.09.2026).
//
//   node tests/test_vorposten_paritaet.js
//
// Es gibt BEWUSST keine Kopie der Stufentabelle im Frontend (die Zahlen reisen mit GET
// /api/vorposten) - also auch keinen Zahlen-Paritaetstest. Was beide Seiten trotzdem teilen und
// was still auseinanderlaufen kann, sind NAMEN: die Routen, die Missionstypen, die der Server in
// der gespeicherten Mission sucht, und die Belohnungstypen, fuer die claimPendingRewards einen
// Zweig braucht (sonst der "+500 Kredite Bug-Report"-Rueckfall).
//
// GEPRUEFT WIRD:
//   1. Jede Vorposten-Route, die das Frontend ruft, existiert in server.js - und umgekehrt ruft das
//      Frontend jede der sieben Routen.
//   2. Die Missionstypen: vorpostenFindeMission sucht 'vorposten-bau' und 'vorposten-angriff' mit
//      targetId = System; das Frontend schreibt genau diese Typen mit targetId: sysId.
//   3. Die Belohnungstypen 'vorposten' und 'vorposten-verlust' haben je einen claim-Zweig.
//   4. Die EINWEGIGE Familie (defend/rueckruf) steht in EINWEGIG_ERLAUBT von test_rundflug.js, die
//      composition-Typen in BEIDEN Whitelists, alle vier in MISSION_LINIEN.
//   5. Der Flugzeit-Kanal haengt NICHT in missionDurationFor (Weiche i), sondern nur an
//      Nicht-PvP-Aufrufstellen: Anfechtung, Mondbelagerung, Spielerangriff und Spionage rufen
//      vorpostenFlug NICHT.
//   6./7. Der Name der ersten Stufe (Rueckfaelle im Frontend) und der Hilfetext ueber Stufe 3.
//   8. Jeder Rohstoffschluessel der drei Kostenquellen ist im Spielstand bekannt - sonst zeigt
//      canAfford() dauerhaft "zu teuer" und die Kostenzeile den Rohschluessel (echter Fehler,
//      04.09.2026: `singularitaetskerne` statt `singularitaetskern` sperrte Stufe 8 und alle
//      drei Endprojekte, das Sprungtor seit Etappe 4).
//   9. Die *_DEFS-Listen sind Arrays und werden nirgends mit einem Schluessel indiziert (echter
//      Fehler, 04.09.2026: der Abbau gab die Garnison nicht zurueck).
//  10. (nur mit Nachbar-Klon) Keine Vorlage der Vorposten-Browsertests setzt ein Feld, das vorpostenFuerClient gar nicht
//      verschickt (echter Fehler, 05.09.2026: das Spiel las `garnisonVon` - so heisst die
//      Aufschluesselung nur SERVERSEITIG; an den Client geht `meineGarnison`. Die Zahl war immer
//      0, und der Browsertest blieb gruen, weil seine Vorlage das erfundene Feld selbst
//      mitlieferte. Eine Vorlage, die ein Feld erfindet, prueft nur sich selbst).
//
// GEGENPROBE: einen Belohnungs-Zweig umbenennen -> 3 faellt; vorpostenFlug in die Anfechtung
// einhaengen -> 5b faellt; 'vorposten-defend' aus EINWEGIG_ERLAUBT nehmen -> 4a faellt.
const fs = require('fs');
const path = require('path');
const { SPIELDATEI, SERVER_JS, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SRV = fs.existsSync(SERVER_JS) ? fs.readFileSync(SERVER_JS, 'utf8') : '';
check('0: server.js des Nachbar-Klons ist lesbar', SRV.length > 1000, { pfad: SERVER_JS });
/* KEIN Frueh-Ausstieg mehr (Befund aus der Durchsicht von PR #579, 04.09.2026). Hier stand
   `if (!SRV) return ende();` - richtig fuer die Abschnitte 1 bis 7, die den Nachbar-Klon WIRKLICH
   brauchen, aber der Ausstieg lag vor der ganzen Datei. In einem Checkout ohne Nachbar-Klon (und
   in jedem `git worktree`, siehe .claude/skills/backend-abgleich) meldete der Test dann gruen,
   ohne die rein frontendseitigen Pruefungen ueberhaupt zu registrieren - genau die Falle, die die
   Skill-Datei fuer andere Tests schon beschreibt.
   Jetzt haengt nur noch am Klon, was ohne ihn nichts messen kann: Abschnitte 1-7 und die drei
   Serverpruefungen aus Abschnitt 8. Der Rest (8c und der ganze Abschnitt 9) laeuft immer. */
if (SRV) {

// ---- 1) Routen ---------------------------------------------------------------------------------
const srvRouten = [...SRV.matchAll(/app\.(get|post)\('\/api\/vorposten(\/[a-z]+)?'/g)].map(m => (m[2] || ''));
const feRufe = [...JS.matchAll(/backendFetch\('\/vorposten(\/[a-z]+)?'/g)].map(m => (m[1] || ''));
const fehltImServer = [...new Set(feRufe)].filter(r => !srvRouten.includes(r));
const fehltImFrontend = srvRouten.filter(r => !feRufe.includes(r));
check('1a: jede vom Frontend gerufene Vorposten-Route existiert im Server', fehltImServer.length === 0, { fehltImServer, server: srvRouten });
check('1b: und das Frontend ruft jede der Server-Routen (keine tote Faehigkeit)', fehltImFrontend.length === 0, { fehltImFrontend, frontend: [...new Set(feRufe)] });

// ---- 2) Missionstypen ---------------------------------------------------------------------------
const srvBau = /vorpostenFindeMission\(save, missionId, 'vorposten-bau', sys\)/.test(SRV);
const srvAngriff = /vorpostenFindeMission\(save, missionId, 'vorposten-angriff', sys\)/.test(SRV);
check('2a: der Server sucht die Bau-Mission als vorposten-bau mit targetId = System', srvBau && /String\(m\.targetId\) === sysId/.test(SRV));
check('2b: das Frontend schreibt die Bau-Mission mit genau diesem Typ und targetId: sysId', /type:'vorposten-bau', targetId: sysId, system: sysId/.test(JS));
check('2c: dasselbe fuer den Angriff', srvAngriff && /type:'vorposten-angriff', targetId: sysId, system: sysId/.test(JS));

// ---- 3) Belohnungstypen -------------------------------------------------------------------------
const srvTypen = [...new Set([...SRV.matchAll(/type: 'vorposten(-[a-z]+)?'/g)].map(m => 'vorposten' + (m[1] || '')))];
const claimVon = JS.indexOf('async function claimPendingRewards(');
const claimBlock = JS.slice(claimVon, claimVon + 80000);
const ohneZweig = srvTypen.filter(t => !new RegExp("r\\.type === '" + t + "'").test(claimBlock));
/* 3a ist der Stummheitsschutz fuer 3b und 3c, nicht ihre Zaehlung (umgestellt 03.09.2026).
   Findet der Regex oben nichts, ist srvTypen leer - dann ist auch ohneZweig leer, und 3b/3c melden
   OK, ohne irgendetwas geprueft zu haben. Deshalb muessen die bekannten Typen NAMENTLICH auftauchen.
   Die frueher zusaetzlich geforderte Gesamtzahl ("genau zwei") ist entfallen: Sie schuetzte nichts,
   was 3b nicht besser prueft - ein neuer Typ ohne Frontend-Zweig faellt dort und mit Namen -, und
   verlangte bei jedem neuen Typ eine Pflege, die keine Aussage traegt. Genau das ist am 03.09.2026
   passiert: 'vorposten-abbau' kam im Backend dazu, 3b nannte die Luecke praezise, und 3a meldete
   nur, dass es jetzt drei statt zwei sind. */
check('3a: die bekannten Belohnungstypen werden im Server ueberhaupt gefunden',
  srvTypen.includes('vorposten') && srvTypen.includes('vorposten-verlust') && srvTypen.includes('vorposten-abbau'), srvTypen);
check('3b: fuer jeden davon hat claimPendingRewards einen Zweig', claimVon > 0 && ohneZweig.length === 0, { ohneZweig });
/* Der Zweig reicht bis zum NAECHSTEN Zweig, nicht bis zum ersten `continue;`. GEMESSEN am
   03.09.2026: Der neue Zweig 'vorposten-abbau' hatte ein `continue` INNERHALB einer Schleife -
   der Schnitt endete dort, das save() dahinter lag ausserhalb, und 3c fiel an einem Zweig, der
   save() sehr wohl ruft. Eine Heuristik, die am ersten `continue` schneidet, misst nicht den
   Zweig, sondern seine erste Schleife. */
const zweigSave = srvTypen.every(t => {
  const i = claimBlock.indexOf("r.type === '" + t + "'");
  if (i < 0) return false;
  const naechster = claimBlock.indexOf("if (r.type === '", i + 10);
  const b = claimBlock.slice(i, naechster > 0 ? naechster : i + 4000);
  return /\bsave\(\);/.test(b);
});
check('3c: und jeder Zweig ruft save() (Regel 73)', zweigSave);
/* 3d (03.09.2026): KEIN Typ hat ZWEI Zweige. Diese Fehlerklasse ist in diesem Projekt jetzt zweimal
   aufgetreten - erst als doppelte Schluessel in NOTIF_EVENT_INFO, dann als zwei unabhaengig
   gebaute `vorposten-abbau`-Zweige, die zwei Sitzungen parallel angelegt hatten. Die Kette der
   if-Zweige nimmt den ERSTEN, jeder weitere liegt unbemerkt als toter Code herum - und
   ausgerechnet der tote enthielt beim Social-Hub-Vorfall einmal die einzige richtige Pruefung.
   Ein doppelter Zweig faellt in keinem Spieltest auf: Der Ablauf ist ja korrekt, nur eben nicht
   der, den man liest. Gezaehlt wird deshalb hier. */
const doppelte = srvTypen.filter(t => (claimBlock.match(new RegExp("r\\.type === '" + t + "'", 'g')) || []).length > 1);
check('3d: kein Belohnungstyp hat ZWEI Zweige - der zweite waere stiller toter Code', doppelte.length === 0,
  { doppelte, zaehlung: Object.fromEntries(srvTypen.map(t => [t, (claimBlock.match(new RegExp("r\\.type === '" + t + "'", 'g')) || []).length])) });

// ---- 4) Missionsfamilie ---------------------------------------------------------------------------
const rund = fs.readFileSync(path.join(__dirname, 'test_rundflug.js'), 'utf8');
check('4a: vorposten-defend und vorposten-rueckruf stehen namentlich in EINWEGIG_ERLAUBT', /'vorposten-defend':/.test(rund) && /'vorposten-rueckruf':/.test(rund));
const whitelists = (JS.match(/m\.type==='vorposten-bau' \|\| m\.type==='vorposten-defend' \|\| m\.type==='vorposten-angriff'/g) || []).length;
check('4b: die drei composition-Typen stehen in BEIDEN Missions-Whitelists', whitelists === 2, { whitelists });
const linien = ['vorposten-bau', 'vorposten-angriff', 'vorposten-defend', 'vorposten-rueckruf'].filter(t => !new RegExp("'" + t + "':\\s*\\{ hin:").test(JS));
check('4c: alle vier Typen haben eine Missionslinie', linien.length === 0, { ohne: linien });
const bauForm = JS.match(/type:'vorposten-bau'[\s\S]{0,200}?endTime: jetzt \+ flug\*1000/);
check('4d: Bau und Angriff sind Form A (endTime = ganzer Flug)', !!bauForm && /type:'vorposten-angriff'[\s\S]{0,300}?endTime: jetzt \+ flug\*1000/.test(JS));

// ---- 5) Weiche (i): der Flugzeit-Kanal erreicht kein PvP -----------------------------------------
const mdf = JS.slice(JS.indexOf('function missionDurationFor('), JS.indexOf('function missionDurationFor(') + 3000);
check('5a: vorpostenFlug haengt NICHT in missionDurationFor selbst', !/vorposten/i.test(mdf));
function fnBlock(name){ const i = JS.indexOf('function ' + name + '('); return i < 0 ? '' : JS.slice(i, i + 4000); }
const pvp = { sendAnfechtungsMission: fnBlock('sendAnfechtungsMission'), sendVorpostenAngriff: fnBlock('sendVorpostenAngriff'), sendSpyMission: fnBlock('sendSpyMission'), sendPlayerAttackMission: fnBlock('sendPlayerAttackMission') };
const pvpMitFlug = Object.keys(pvp).filter(k => /vorpostenFlug\(/.test(pvp[k]));
check('5b: Anfechtung, Vorposten-Angriff, Spionage und Spielerangriff rufen vorpostenFlug NICHT', pvpMitFlug.length === 0, { pvpMitFlug });
const nichtPvp = (JS.match(/vorpostenFlug\(/g) || []).length;
check('5c: der Kanal ist an Nicht-PvP-Stellen eingehaengt (Erkundung, Kolonisierung, Abbau, Bau)', nichtPvp >= 6, { aufrufe: nichtPvp });

/* ---- 6) Der eingetippte Rueckfallname (GR-7, 04.09.2026) --------------------------------------
   Das Frontend schreibt an vier Stellen `|| 'Ankerkern'` - der Name der ersten Stufe, falls der
   Server keinen mitschickt. Das ist eine KOPIE-FAMILIE: Benennt das Backend die erste Stufe um,
   erfindet das Frontend still einen Namen, den es nicht mehr gibt. Genau so ist "Feldlager" nach
   GR-6 stehen geblieben, als der Vorposten laengst eine Raumstation war.
   Geprueft wird die REGEL, nicht der Name: Was das Frontend als Rueckfall eintippt, MUSS die
   erste Stufe in VORPOSTEN_STUFEN heissen. Eine spaetere Umbenennung ist damit frei - sie muss
   nur auf beiden Seiten geschehen. */
const stufenBlock = (() => {
  const i = SRV.indexOf('const VORPOSTEN_STUFEN = [');
  if (i < 0) return '';
  const j = SRV.indexOf('\n];', i);
  return j < 0 ? '' : SRV.slice(i, j);
})();
const ersteStufe = (stufenBlock.match(/name: *'([^']+)'/) || [])[1] || null;
check('6-anker: der Name der ersten Stufe ist im Server auffindbar', !!ersteStufe, { ersteStufe });
/* Gesucht wird der Rueckfall an seinem ORT, nicht an seinem Wortlaut. Eine Namensliste waere
   hier falsch: Sie muesste bei jeder Umbenennung mitgepflegt werden und verwechselt sich mit
   gleichnamigen Dingen anderswo im Spiel (es gibt Bastionsmarken namens "Bastion"). Der Ort ist
   eindeutig - das Feld heisst stufeName, oder die Quelle ist vorposten.name:
     stufeName: <irgendwas> || 'X'      r.stufeName || 'X'      daten.vorposten.name) || 'X'
   ABER: stufeName tragen auch Nester und Festungen. Ein Faecher-Fund zaehlt deshalb nur, wenn in
   DERSELBEN ZEILE das Wort "vorposten" steht. Gemessen am 04.09.2026: 32 Faecher insgesamt,
   davon 14 beim Vorposten (Ankerkern, Vorposten, neue Stufe) und 18 bei Nestern und Festungen
   (Nest, Nestes, Festung, Asteroidenfestung). Ohne diese Einengung liesse ein neuer, voellig
   richtiger Nest-Stufenname ausgerechnet den VORPOSTEN-Paritaetstest fallen - falsche Datei,
   falsche Meldung. (Befund des Codex-Review am PR #574, nachgemessen und bestaetigt.)
   In einem Vorposten-Fach steht entweder der Name der ersten Stufe oder ein bewusstes
   GATTUNGSWORT: "Vorposten", wenn gar kein Objekt bekannt ist, und "neue Stufe" nach dem Ausbau,
   wo "Ankerkern" sogar falsch waere - die Stufe ist ja gerade gewachsen. Ein drittes Gattungswort
   laesst diesen Test fallen; das ist Absicht: Wer ein Stufennamen-Fach anfasst, soll hier
   vorbeikommen. */
const GATTUNG = /^(Vorposten|neue Stufe)$/;
const FAECHER = [
  /stufeName *: *[^,;\n]{0,160}?\|\| *'([^']+)'/g,
  /\.stufeName *\|\| *'([^']+)'/g,
  /vorposten\.name\)? *\|\| *'([^']+)'/g
];
const zeileUm = i => {
  const a = JS.lastIndexOf('\n', i) + 1;
  const b = JS.indexOf('\n', i);
  return JS.slice(a, b < 0 ? JS.length : b);
};
const faecher = [];
for (const muster of FAECHER) for (const m of JS.matchAll(muster)) {
  if (!/vorposten/i.test(zeileUm(m.index))) continue;
  faecher.push(m[1]);
}
const rueckfaelle = faecher.filter(n => !GATTUNG.test(n));
check('6-anker2: die Vorposten-Faecher sind ueberhaupt auffindbar (sonst misst 6a/6b nichts)',
  faecher.length >= 10, { gefunden: faecher.length });
check('6a: das Frontend tippt ueberhaupt einen Rueckfallnamen ein (sonst misst 6b nichts)',
  rueckfaelle.length > 0, { gefunden: rueckfaelle });
check('6b: und jeder davon ist der Name der ERSTEN Stufe des Servers',
  !!ersteStufe && rueckfaelle.every(n => n === ersteStufe),
  { ersteStufe, imFrontend: [...new Set(rueckfaelle)] });


/* ---- 7) Der Hilfetext nennt eine Stufe beim Namen (GR-7, 04.09.2026) --------------------------
   Gefunden von der adversarischen Durchsicht: HELP_SECTIONS, Eintrag "Koordinierte Angriffe",
   sagte nach der Umbenennung weiter "eine Bastion haelt 400.000 Kernpunkte und 60.000
   Verteidigung". Die Zahlen gehoeren zu Stufe 3 - die heisst seit dem Backend-Merge
   "Kernstation". Der Rueckfall-Waechter (Abschnitt 6) kann das bauartbedingt nicht sehen: Er
   prueft Faecher im Code, nicht Fliesstext.
   Der Satz ist eine KOPIE-FAMILIE aus DREI Werten (Name, Kernpunkte, Verteidigung). Geprueft
   wird deshalb nicht das Wort, sondern die Zuordnung: Die im Satz genannten Zahlen bestimmen
   EINDEUTIG eine Stufe des Servers, und der im selben Satz genannte Name muss deren Name sein.
   Eine spaetere Umbenennung oder Balance-Aenderung faellt damit auf, ohne dass hier ein Name
   gepflegt werden muss. */
const hilfeSatz = JS.match(/eine ([A-Za-zÄÖÜäöüß]+) hält ([\d.]+) Kernpunkte und ([\d.]+) Verteidigung/);
check('7-anker: der Hilfesatz mit Stufenname und Kennzahlen ist auffindbar (sonst misst 7a/7b nichts)',
  !!hilfeSatz, { gefunden: hilfeSatz ? hilfeSatz[0] : null });
if (hilfeSatz) {
  const zahl = t => Number(String(t).replace(/\./g, ''));
  const genannterName = hilfeSatz[1];
  const genannterKern = zahl(hilfeSatz[2]);
  const genannteVert  = zahl(hilfeSatz[3]);
  const stufenRoh = [...stufenBlock.matchAll(/\{ *stufe: *(\d+), *name: *'([^']+)', *kernLp: *(\d+), *verteidigung: *(\d+)/g)]
    .map(m => ({ stufe: Number(m[1]), name: m[2], kernLp: Number(m[3]), verteidigung: Number(m[4]) }));
  check('7-anker2: die Stufentabelle des Servers ist mit Kennzahlen lesbar',
    stufenRoh.length >= 8, { gelesen: stufenRoh.length });
  const passend = stufenRoh.filter(x => x.kernLp === genannterKern);
  check('7a: die im Hilfetext genannten Kernpunkte gehören zu GENAU EINER Serverstufe',
    passend.length === 1, { genannterKern, treffer: passend.map(x => x.stufe + ':' + x.name) });
  check('7b: und diese Stufe heißt im Server genauso wie im Hilfetext',
    passend.length === 1 && passend[0].name === genannterName,
    { imHilfetext: genannterName, imServer: passend.length === 1 ? passend[0].name : null });
  check('7c: auch die genannte Verteidigung stimmt mit derselben Stufe überein',
    passend.length === 1 && passend[0].verteidigung === genannteVert,
    { imHilfetext: genannteVert, imServer: passend.length === 1 ? passend[0].verteidigung : null });
}

}   // Ende der serverabhaengigen Abschnitte 1-7

/* ---- 8) Rohstoffschluessel der Kostentabellen (04.09.2026) ------------------------------------
   ANLASS, ein echter Fehler im laufenden Spiel: Der Server schrieb in die Kosten der Stufe 8 und
   der drei Endprojekte `singularitaetskerne` (Mehrzahl). Der Schluessel im Spielstand heisst
   `singularitaetskern` (Einzahl) - nur das LABEL lautet "Singularitätskerne". Der Server liest
   `kosten` nirgends selbst, sie reisen rein als Anzeige zum Client; dort gab
   costAmountAvailable() fuer den unbekannten Schluessel immer 0 zurueck, canAfford() also immer
   false. Folge: "Ausbauen zur Stufe 8" war dauerhaft gesperrt und mit ihm ALLE drei Endprojekte
   (stufeAb 8); das Sprungtor wurde seit Etappe 4 angeboten und liess sich nie starten. Zusaetzlich
   druckte resDefFor() den Rohschluessel: "120 singularitaetskern" statt "120 Singularitätskerne".

   Die Fehlerklasse ist NICHT auf diesen einen Tippfehler beschraenkt: Jeder Rohstoffschluessel in
   einer Kostentabelle ist eine Kopie-Familie mit dem Spielstand. Ein falscher sperrt still, ohne
   Fehlermeldung, ohne Log, auf beiden Seiten gruen - und bleibt es, bis ihn jemand im Spiel
   ausprobiert.

   DIE REGEL, die hier geprueft wird: Jeder Schluessel in einer Vorposten-Kostentabelle muss von
   resDefFor() aufloesbar sein - also in RES_DEFS oder TIER2_DEFS stehen oder einer der drei
   Sonderzweige (credits, bergung, protomaterie) sein. Genau diese Menge ist auch die Menge, fuer
   die costAmountAvailable() etwas anderes als 0 liefern kann.
   Der gueltige Vorrat wird AUS DEM FRONTEND GELESEN, nicht in den Test getippt: eine neue
   Tier-2-Ressource erweitert ihn von selbst, ein Tippfehler nicht.

   Geprueft werden alle drei Kostenquellen, die am Vorposten haengen:
     - VORPOSTEN_STUFEN[].kosten  (Server, reist als naechsteStufe.kosten -> vorpostenAusbauKosten)
     - VP_PROJEKT_DEFS[].kosten   (Server, reist als projektDefs -> costText)
     - VORPOSTEN_BAUKOSTEN        (Frontend, dieselbe Klasse, dieselbe Folge) */
function listeAb(quelle, anker){
  const i = quelle.indexOf(anker);
  if (i < 0) return '';
  const enden = ['\n  ];', '\n];'].map(e => quelle.indexOf(e, i)).filter(x => x > 0).sort((a, b) => a - b);
  return enden.length ? quelle.slice(i, enden[0]) : '';
}
const defKeys = s => [...s.matchAll(/\bkey: *'([a-z0-9_]+)'/g)].map(m => m[1]);
const resBlock  = listeAb(JS, 'const RES_DEFS = [');
const tierBlock = listeAb(JS, 'const TIER2_DEFS = [');
const rdVon = JS.indexOf('function resDefFor(');
const rdBlock = rdVon < 0 ? '' : JS.slice(rdVon, rdVon + 2500);
const sonderzweige = [...rdBlock.matchAll(/key === '([a-z]+)'/g)].map(m => m[1]);
const VORRAT = new Set([...defKeys(resBlock), ...defKeys(tierBlock), ...sonderzweige]);
check('8-anker1: die Rohstoff-Definitionen des Frontends sind lesbar (sonst misst 8a-8c nichts)',
  defKeys(resBlock).length >= 6 && defKeys(tierBlock).length >= 9 && sonderzweige.length >= 3,
  { resDefs: defKeys(resBlock).length, tier2: defKeys(tierBlock).length, sonderzweige });

// Aus einem Tabellenblock jeden Schluessel jedes `kosten: { ... }` ziehen.
const kostenSchluessel = s => [...s.matchAll(/kosten: *\{([^}]*)\}/g)]
  .flatMap(m => [...m[1].matchAll(/([a-z0-9_]+) *:/g)].map(x => x[1]));

const unbekannt = liste => liste.filter(k => !VORRAT.has(k));
if (SRV) {
const srvStufen = listeAb(SRV, 'const VORPOSTEN_STUFEN = [');
const srvProjekte = listeAb(SRV, 'const VP_PROJEKT_DEFS = [');
const stufenKosten = [...new Set(kostenSchluessel(srvStufen))];
const projektKosten = [...new Set(kostenSchluessel(srvProjekte))];
// Gemessen am 04.09.2026: 8 Stufenzeilen mit 7 Kostenbloecken (Stufe 1 wird errichtet, nicht
// ausgebaut) und 8 Projekte mit je einem Block. Ein Anker, der nur "> 0" verlangt, laesst eine
// kaputte Ausschnittsgrenze als "alles gruen" durchgehen.
check('8-anker2: die Kostentabellen des Servers sind vollstaendig lesbar (sonst misst 8a/8b nichts)',
  (srvStufen.match(/\{ *stufe:/g) || []).length === 8 &&
  (srvStufen.match(/kosten: *\{/g) || []).length === 7 &&
  (srvProjekte.match(/kosten: *\{/g) || []).length === 8,
  { stufenZeilen: (srvStufen.match(/\{ *stufe:/g) || []).length,
    stufenKostenBloecke: (srvStufen.match(/kosten: *\{/g) || []).length,
    projektKostenBloecke: (srvProjekte.match(/kosten: *\{/g) || []).length });

check('8a: jeder Rohstoff in den Ausbaukosten des Servers ist im Spielstand bekannt',
  unbekannt(stufenKosten).length === 0,
  { unbekannt: unbekannt(stufenKosten), gelesen: stufenKosten });
check('8b: jeder Rohstoff in den Projektkosten des Servers ist im Spielstand bekannt',
  unbekannt(projektKosten).length === 0,
  { unbekannt: unbekannt(projektKosten), gelesen: projektKosten });
}   // Ende des serverabhaengigen Teils von Abschnitt 8 - 8c darunter laeuft immer

const bauRoh = (JS.match(/const VORPOSTEN_BAUKOSTEN *= *\{([^}]*)\}/) || ['', ''])[1];
const bauKosten = [...bauRoh.matchAll(/([a-z0-9_]+) *:/g)].map(m => m[1]);
check('8-anker3: die Baukosten des Frontends sind lesbar (sonst misst 8c nichts)',
  bauKosten.length >= 3, { gelesen: bauKosten });
check('8c: auch die Baukosten des Vorpostens nennen nur bekannte Rohstoffe',
  unbekannt(bauKosten).length === 0, { unbekannt: unbekannt(bauKosten), gelesen: bauKosten });


/* ---- 9) Registerform: die *_DEFS-Listen sind ARRAYS (04.09.2026) ------------------------------
   ANLASS, der zweite echte Fehler im laufenden Spiel: Im Abbau-Zweig von claimPendingRewards
   stand ein Index-Zugriff auf SHIP_DEFS mit einem SCHIFFSSCHLUESSEL. SHIP_DEFS ist aber eine
   Liste, kein Register - der Zugriff ergibt immer undefined, die Bedingung darum immer false.
   Folge: Wer seinen Vorposten abbaut, bekam die Garnison NICHT zurueck; die Belohnung wurde
   trotzdem aus der Warteschlange geraeumt, die Schiffe waren ersatzlos weg. Nichts daran ist von
   aussen sichtbar - kein Fehler, kein Log, die Meldung laesst den Halbsatz einfach weg.

   Es waren die einzigen beiden solchen Zugriffe der ganzen Datei; ueberall sonst steht
   `SHIP_DEFS.find(d => d.key === k)`. Genau deshalb ist die Regel billig zu halten:
   9a haelt den reparierten Zweig fest, 9b verbietet die Form ueberhaupt.

   9b ist bewusst DATEIWEIT und nicht auf den Vorposten eingeengt: die Fehlerklasse gehoert nicht
   dem Vorposten, sie war hier nur zum ersten Mal messbar. Der Test sucht als Zeichenkette und
   unterscheidet Kommentar nicht von Code - der Kommentar an der reparierten Stelle ist deshalb
   umschrieben. Erlaubt bleibt ein echter Zahlenindex (RES_DEFS[Math.floor(...)] im
   Zufallsereignis); wer eine Zaehlvariable braucht, traegt sie in ZAHLENINDEX nach. */
const abbauVon = JS.indexOf("r.type === 'vorposten-abbau'");
// OHNE KOMMENTARE messen. Der erklaerende Kommentar an der reparierten Stelle nennt die richtige
// Form im Fliesstext - gegen den rohen Ausschnitt geprueft waere 9a auch am kaputten Stand gruen
// (gemessen 04.09.2026, die Gegenprobe fiel zuerst durch).
const ohneKommentar = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, '');
const abbauZweig = abbauVon < 0 ? '' : ohneKommentar(JS.slice(abbauVon, abbauVon + 4000));
check('9-anker: der Abbau-Zweig von claimPendingRewards ist auffindbar (sonst misst 9a nichts)',
  abbauVon > 0 && /r\.garnison/.test(abbauZweig), { gefunden: abbauVon > 0 });
/* 9a verlangt shipDefOrSuper, nicht SHIP_DEFS.find - und 9c misst, WARUM.
   Der erste Reparaturversuch schrieb hier `SHIP_DEFS.find(d => d.key === k)`. Das holt 39 von 40
   Schiffstypen zurueck und laesst ausgerechnet das teuerste verfallen: Das Superschlachtschiff ist
   das einzige Angriffsschiff OHNE SHIP_DEFS-Eintrag (die Werft haengt es per `.concat` an), steht
   aber in ATTACK_SHIP_KEYS - und vorpostenGarnisonSenden reicht genau diese Liste als `keys` an die
   Flottenwahl durch, es ist also stationierbar. Derselbe Fehler eine Etage tiefer, gefunden in der
   Durchsicht von PR #579 (04.09.2026).
   9c haelt die drei gemessenen Voraussetzungen fest. Faellt eine davon (z. B. weil das Schiff
   spaeter doch in SHIP_DEFS aufgenommen wird), soll 9c das MELDEN statt 9a stillschweigend
   ueberfluessig zu machen - dann gehoert die Regel neu bedacht, nicht der Test angepasst. */
check('9a: der Abbau loest die Garnison ueber shipDefOrSuper auf, nicht ueber SHIP_DEFS.find',
  /shipDefOrSuper\(\s*k\s*\)/.test(abbauZweig) && !/SHIP_DEFS\.find/.test(abbauZweig),
  { imZweig: (abbauZweig.match(/(shipDefOrSuper|SHIP_DEFS[.[])[^\n]{0,40}/) || [])[0] || null });
const jsOhneKommentar = ohneKommentar(JS);
const superInDefs = /\{ *key: *'superschlachtschiff'/.test(listeAb(jsOhneKommentar, 'const SHIP_DEFS = ['));
const superInAngriff = /const ATTACK_SHIP_KEYS = \[[^\]]*'superschlachtschiff'/.test(jsOhneKommentar);
const garniVon = jsOhneKommentar.indexOf('function vorpostenGarnisonSenden(');
const garniKeys = garniVon > 0 && /keys: ATTACK_SHIP_KEYS/.test(jsOhneKommentar.slice(garniVon, garniVon + 2500));
check('9c: die Voraussetzung von 9a stimmt noch - Superschlachtschiff ohne SHIP_DEFS-Eintrag, aber stationierbar',
  !superInDefs && superInAngriff && garniKeys,
  { inShipDefs: superInDefs, inAttackShipKeys: superInAngriff, garnisonNimmtAttackShipKeys: garniKeys });

const LISTEN = ['RES_DEFS', 'BUILDING_DEFS', 'RESEARCH_DEFS', 'SHIP_DEFS', 'TIER2_DEFS', 'MODULE_DEFS'];
const ZAHLENINDEX = /^(\d+|i|j|n|idx|index|Math\.[\s\S]+)$/;
const alsArray = LISTEN.filter(n => new RegExp('const ' + n + ' = \\[').test(JS));
check('9-anker2: alle sechs Listen sind in der Spieldatei als Array deklariert (sonst misst 9b nichts)',
  alsArray.length === LISTEN.length, { gefunden: alsArray, erwartet: LISTEN.length });
const schluesselZugriffe = [];
for (const name of LISTEN) {
  for (const m of JS.matchAll(new RegExp('\\b' + name + '\\[([^\\]]*)\\]', 'g'))) {
    if (!ZAHLENINDEX.test(m[1].trim())) schluesselZugriffe.push(name + '[' + m[1] + ']');
  }
}
check('9b: keine der sechs *_DEFS-Listen wird mit einem Schluessel indiziert (sie sind Arrays)',
  schluesselZugriffe.length === 0, { gefunden: schluesselZugriffe });

/* 10. KEINE TESTVORLAGE DARF EIN FELD ERFINDEN (05.09.2026, echter Fehler).
   ---------------------------------------------------------------------------------------------
   Die Frontend-Haelfte von V5 las `v.garnisonVon[meineId]`. So heisst die Aufschluesselung
   SERVERSEITIG in `doc` - vorpostenFuerClient verschickt sie bewusst NICHT („die vollstaendige
   Aufschluesselung sieht weiterhin nur der Besitzer") und schickt stattdessen `meineGarnison`,
   den eigenen Anteil, flach nach Schiffstyp. Der Name stammte aus dem Konzeptpapier statt aus dem
   Quelltext des Senders; im Spiel war die Zahl deshalb IMMER 0.
   AUFGEFALLEN IST ES NICHT, weil die Vorlage des Browser-Tests das erfundene Feld selbst
   mitlieferte. Eine Vorlage, die ein Feld erfindet, prueft nur sich selbst - sie kann einen
   falschen Feldnamen nicht fangen, egal wie gruendlich der Test danach misst.
   Hier wird deshalb die VORLAGE gegen den SENDER gehalten: Jeder Schluessel, den eine
   Vorposten-Vorlage setzt, muss ein Feld sein, das vorpostenFuerClient wirklich erzeugt. */
if (SRV) {
  const balanciert = (t, von) => {
    let d = 0;
    for (let i = von; i < t.length; i++) {
      const c = t[i];
      if (c === '{') d++;
      else if (c === '}') { d--; if (!d) return t.slice(von, i + 1); }
    }
    return '';
  };
  const kommentarfrei = t => t
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));
  /* Schluessel auf der OBERSTEN Ebene eines Objektliterals. Zwei Feinheiten, beide gemessen:
     Ein Wert, der ein blosser Bezeichner ist (`besitzer: ICH`), sieht wie eine Kurzschreibweise
     aus - deshalb muss das Zeichen VOR dem Namen `{` oder `,` sein, also Schluesselposition.
     Und Klammern jeder Art zaehlen in die Tiefe, sonst gaelte `(doc.seit || 0) + X` als Feld. */
  const tiefe1 = lit => {
    const t = kommentarfrei(lit); const out = []; let d = 0;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (c === '{' || c === '(' || c === '[') { d++; continue; }
      if (c === '}' || c === ')' || c === ']') { d--; continue; }
      if (d !== 1 || !/[A-Za-z_$]/.test(c)) continue;
      let j = i - 1; while (j >= 0 && /\s/.test(t[j])) j--;
      if (!(t[j] === '{' || t[j] === ',')) continue;
      const m = /^([A-Za-z_$][\w$]*)\s*(:|,|\})/.exec(t.slice(i));
      if (m) { out.push(m[1]); i += m[1].length - 1; }
    }
    return [...new Set(out)];
  };

  const fnVon = SRV.indexOf('function vorpostenFuerClient(');
  const fnRumpf = fnVon < 0 ? '' : SRV.slice(fnVon, SRV.indexOf('\n}\n', fnVon));
  const outVon = fnRumpf.indexOf('{', fnRumpf.indexOf('const out ='));
  const felder = new Set(fnRumpf ? tiefe1(balanciert(fnRumpf, outVon)) : []);
  // Was NUR der Besitzer sieht, steht als `out.x = ...` unter dem Literal - es sind Felder wie
  // jedes andere, nur enger verteilt; eine Vorlage darf sie setzen.
  for (const m of fnRumpf.matchAll(/\bout\.([A-Za-z_$][\w$]*)\s*=/g)) felder.add(m[1]);
  check('10-anker1: die Felderliste stammt wirklich aus vorpostenFuerClient (sonst misst 10a nichts)',
    felder.size >= 30 && felder.has('meineGarnison') && felder.has('garnison') && felder.has('eigener')
    && !felder.has('garnisonVon'),
    { anzahl: felder.size, meineGarnison: felder.has('meineGarnison'), garnisonVon: felder.has('garnisonVon') });

  /* Die Vorlagen werden am FINGERABDRUCK erkannt, nicht am Variablennamen: Sie heissen je nach
     Datei `vp`, `doc` oder stehen anonym in `liste:[...]`. Ein Objektliteral, das `garnisonAnzahl`
     UND `kern` auf oberster Ebene setzt, ist ein Vorposten - sonst nichts in diesen Dateien.
     Dazu die Ueberschreibungen an den Aufrufstellen `vp({ ... })`; die tragen den Fingerabdruck
     naturgemaess nicht. */
  const testDir = path.join(__dirname);
  const dateien = fs.readdirSync(testDir).filter(n => /^test_vorposten_.*\.js$/.test(n) && n !== 'test_vorposten_paritaet.js');
  const fremdeFelder = []; const mitVorlage = [];
  for (const name of dateien) {
    const t = fs.readFileSync(path.join(testDir, name), 'utf8');
    const keys = new Set(); let bis = -1;
    for (let i = 0; i < t.length; i++) {
      if (t[i] !== '{' || i < bis) continue;
      const lit = balanciert(t, i); if (!lit) continue;
      const k = tiefe1(lit);
      if (k.includes('garnisonAnzahl') && k.includes('kern')) { k.forEach(x => keys.add(x)); bis = i + lit.length; }
    }
    for (const m of t.matchAll(/\bvp\(\s*\{/g)) tiefe1(balanciert(t, m.index + m[0].length - 1)).forEach(x => keys.add(x));
    if (!keys.size) continue;
    mitVorlage.push(name);
    for (const k of keys) if (!felder.has(k)) fremdeFelder.push(name + ' -> ' + k);
  }
  check('10-anker2: es wurden ueberhaupt Vorlagen gefunden (sonst misst 10a nichts)',
    mitVorlage.length >= 8, { dateien: mitVorlage.length, namen: mitVorlage });
  check('10a: keine Vorposten-Vorlage setzt ein Feld, das vorpostenFuerClient nie schickt',
    fremdeFelder.length === 0, { erfunden: fremdeFelder });
}

/* 11. DER HILFETEXT IST EINE HANDGETIPPTE KOPIE (05.09.2026, Befund der Durchsicht).
   ---------------------------------------------------------------------------------------------
   Etappe V7 hat dem Vorposten-Hilfetext einen Absatz ueber Steckplaetze, Module und Sets gegeben -
   mit der ANZAHL der Module, ihren NAMEN und den ZUSAMMENSETZUNGEN der Sets. Das ist genau die
   Sorte Kopie, die dieses Repo bei den Tabellen selbst vermeidet („Das Spiel haelt KEINE eigene
   Modultabelle"): In Prosa laesst sie sich nicht zur Laufzeit fuellen, also altert sie still,
   sobald jemand ein Modul umbenennt oder ein Set anders zusammensetzt.
   Derselbe Mechanismus wie Abschnitt 7 fuer den Stufennamen - nur eine Etappe spaeter. */
if (SRV) {
  const hilfeVon = JS.indexOf('<strong>Steckplätze und Sets.</strong>');
  const hilfe = hilfeVon < 0 ? '' : JS.slice(hilfeVon, JS.indexOf('<br><br><strong>Acht Stufen</strong>', hilfeVon));
  check('11-anker: der Hilfe-Absatz ueber Steckplaetze und Sets ist auffindbar (sonst misst 11a-11c nichts)',
    hilfeVon > 0 && hilfe.length > 400 && hilfe.length < 4000, { laenge: hilfe.length });

  const modulNamen = [...SRV.matchAll(/\{ key: '[a-z]+',\s*name: '([^']+)',\s*icon: 'ti-[a-z0-9-]+',\s*wirkung:/g)].map(m => m[1]);
  const setBlock = (SRV.match(/const VP_MODUL_SET_DEFS = \[[\s\S]*?\n\];/) || [''])[0];
  const sets = [...setBlock.matchAll(/\{ key: '([a-z]+)', name: '([^']+)',[\s\S]*?teile: \[([^\]]*)\]/g)]
    .map(m => ({ key: m[1], name: m[2], teile: m[3].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean) }));
  const modulKeyZuName = {};
  for (const m of SRV.matchAll(/\{ key: '([a-z]+)',\s*name: '([^']+)',\s*icon: 'ti-[a-z0-9-]+',\s*wirkung:/g)) modulKeyZuName[m[1]] = m[2];
  check('11-anker2: Modulnamen und Set-Tabelle sind im Server lesbar (sonst misst 11a-11c nichts)',
    modulNamen.length >= 6 && sets.length >= 3 && sets.every(x => x.teile.length >= 2),
    { module: modulNamen, sets: sets.map(x => x.key) });

  // 11a: Die genannte ANZAHL stimmt - und jeder genannte Modulname existiert wirklich.
  const zahlwort = { drei: 3, vier: 4, fuenf: 5, 'fünf': 5, sechs: 6, sieben: 7, acht: 8 };
  const genannteZahl = (hilfe.match(/–\s*(\w+)\s+gibt es/) || [])[1];
  check('11a: die im Hilfetext genannte Modul-Anzahl stimmt mit der Servertabelle ueberein',
    zahlwort[genannteZahl] === modulNamen.length,
    { imHilfetext: genannteZahl, alsZahl: zahlwort[genannteZahl], imServer: modulNamen.length });
  const inKlammer = (hilfe.match(/gibt es \(([^)]*)\)/) || ['', ''])[1].split(',').map(x => x.trim()).filter(Boolean);
  check('11b: und jeder dort aufgezaehlte Modulname existiert im Server, keiner fehlt',
    inKlammer.length === modulNamen.length && inKlammer.every(n => modulNamen.includes(n))
    && modulNamen.every(n => inKlammer.includes(n)),
    { imHilfetext: inKlammer, imServer: modulNamen });

  /* 11c: Jedes im Hilfetext genannte Set gibt es, heisst dort genauso, und seine Klammer nennt
     GENAU die Module, aus denen der Server es zusammensetzt. Sets, die der Text gar nicht nennt
     (die Sternwacht steht dort in Prosa), bleiben aussen vor - geprueft wird, was behauptet wird. */
  const behauptet = [...hilfe.matchAll(/<em>([^<]+)<\/em> \(([^)]*)\)/g)]
    .map(m => ({ name: m[1], teile: m[2].split('+').map(x => x.trim()).filter(Boolean) }));
  const falsch = [];
  for (const b of behauptet) {
    const def = sets.find(x => x.name === b.name);
    if (!def) { falsch.push(b.name + ': gibt es im Server nicht'); continue; }
    const soll = def.teile.map(k => modulKeyZuName[k] || k);
    if (soll.join('|') !== b.teile.join('|')) falsch.push(b.name + ': Text [' + b.teile.join(', ') + '] vs. Server [' + soll.join(', ') + ']');
  }
  check('11c-anker: der Hilfetext behauptet ueberhaupt Set-Zusammensetzungen (sonst misst 11c nichts)',
    behauptet.length >= 3, { behauptet: behauptet.map(b => b.name) });
  check('11c: jedes genannte Set heisst im Server genauso und besteht aus genau diesen Modulen',
    falsch.length === 0, { falsch, behauptet: behauptet.map(b => b.name + ' (' + b.teile.join(' + ') + ')') });
}

ende();


/* GEGENPROBE, sieben Richtungen (jeweils NUR die eine Datei angefasst, die Testdatei blieb neu).
   Zu Abschnitt 10, gemessen am 05.09.2026:
   G) Die Vorlage in test_vorposten_verbuendet_ui.js zurueck auf `garnisonVon`: 10a FAELLT, und
      NUR 10a (Pruefnamen beider Laeufe per `diff`). Das ist genau der Stand, an dem der Fehler
      vier Stunden unbemerkt blieb.

   Die sechs Richtungen vom 04.09.2026:

   Zum Rueckfallnamen (Abschnitt 6):
   A) Spieldatei auf origin/main (Rueckfall noch "Feldlager"), Server "Ankerkern": 6b FAELLT.
   B) Spieldatei neu ("Ankerkern"), Server auf "Ringkern" umbenannt: 6b FAELLT.
   C) Fremdes Stufenfach umbenannt (Nest-Rueckfall 'Nest' -> 'Brutkammer'): bleibt GRUEN.
      Das ist die Gegenprobe zur Einengung auf Vorposten-Zeilen - ohne sie haette C den Test
      gefaellt, obwohl am Vorposten nichts falsch ist.

   Zum Hilfetext (Abschnitt 7) - je eine je kopierter Groesse:
   D) Name im Hilfetext auf den alten Stand ("Bastion"): 7b FAELLT, 7a und 7c bleiben gruen.
   E) Kernpunkte im Hilfetext verdreht (400.000 -> 401.000): 7a FAELLT (kein Treffer), 7b und
      7c fallen mit, weil ohne Stufe nichts mehr zuzuordnen ist.
   F) Verteidigung der Stufe 3 im SERVER geaendert (60.000 -> 66.000): 7c FAELLT.

   Die Anker blieben in allen sechs Laeufen gruen: 6-anker2 mass durchgehend 14 Faecher,
   7-anker fand den Satz auch im sabotierten Zustand, 7-anker2 las durchgehend 8 Stufen.

   GEGENPROBE zu den Abschnitten 8 und 9, fuenf Richtungen gemessen am 04.09.2026 (Pruefnamen
   beider Laeufe per `diff` verglichen, nicht gezaehlt). Was fallen MUSS:

   A) Server zurueck auf `singularitaetskerne` (Mehrzahl, der echte Fehler, 5 Stellen):
      8a und 8b FALLEN. Genau der Stand, der seit Etappe 4 live war.
   B) Tippfehler in VORPOSTEN_BAUKOSTEN des Frontends (`deuterium` -> `deuterien`): 8c FAELLT.
   C) FREMDE Kostentabelle kaputt (Singularitaets-Geschuetzturm, `singularitaetskerne:15`):
      NICHTS faellt - richtig, der Waechter ist auf die drei Vorposten-Quellen eingeengt. Ohne
      diese Richtung waere nicht belegt, dass 8a-8c ueberhaupt etwas eingrenzen.
   D) Die Anker beider Seiten: TIER2_DEFS umbenannt -> 8-anker1 faellt (und mit ihm 8a/8b, weil
      der Vorrat dann unvollstaendig ist); einen Kostenblock aus VORPOSTEN_STUFEN entfernt ->
      8-anker2 faellt. Ein Ausschnitt, der ins Leere greift, kann sich damit nicht gruen melden.
   E) Der Index-Zugriff auf SHIP_DEFS zurueck in den Abbau-Zweig: 9a UND 9b FALLEN.
      Wichtig: Beim ERSTEN Versuch blieb 9a gruen - der erklaerende Kommentar an derselben Stelle
      nennt die richtige Form im Fliesstext, und der rohe Ausschnitt enthaelt ihn. Seitdem misst
      9a den Zweig OHNE Kommentare. Ein Waechter, der seine eigene Erklaerung mitliest, misst
      nichts.
   F) Eine ANDERE Liste falsch indiziert (`RES_DEFS[key]` in resDefFor): nur 9b faellt - die
      dateiweite Regel greift auch dort, wo der Vorposten nichts damit zu tun hat.

   NACHTRAG aus der Durchsicht von PR #579, drei weitere Richtungen gemessen:

   G) `shipDefOrSuper(k)` zurueck auf `SHIP_DEFS.find(d => d.key === k)`: 9a FAELLT. Das ist der
      halbrichtige Fix, der 39 von 40 Schiffstypen zurueckholt und ausgerechnet das teuerste
      verfallen laesst.
   H) Der Nachbar-Klon fehlt (server.js beiseitegelegt): Pruefung 0 faellt wie bisher, aber es
      laufen jetzt ACHT Pruefungen statt keiner - 8-anker1, 8-anker3, 8c und der ganze Abschnitt 9.
      Vorher stieg die Datei an dieser Stelle komplett aus. 29 serverabhaengige Pruefungen fehlen
      dann, und Pruefung 0 sagt warum.
   I) Das Superschlachtschiff in SHIP_DEFS aufgenommen: 9c FAELLT - und nur 9c. Die Regel von 9a
      haette dann keine Grundlage mehr; das soll auffallen, statt dass 9a still zur Formsache wird. */

