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
if (!SRV) return ende();

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

ende();


/* GEGENPROBE, sechs Richtungen gemessen am 04.09.2026 (jeweils NUR die eine Datei angefasst,
   die Testdatei blieb neu):

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
   7-anker fand den Satz auch im sabotierten Zustand, 7-anker2 las durchgehend 8 Stufen. */

