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
const rueckfaelle = [...JS.matchAll(/\|\| *'([^']+)'/g)].map(m => m[1])
  .filter(n => /^(Ankerkern|Feldlager|Stützpunkt|Bastion|Kernstation)$/.test(n));
check('6a: das Frontend tippt ueberhaupt einen Rueckfallnamen ein (sonst misst 6b nichts)',
  rueckfaelle.length > 0, { gefunden: rueckfaelle });
check('6b: und jeder davon ist der Name der ERSTEN Stufe des Servers',
  !!ersteStufe && rueckfaelle.every(n => n === ersteStufe),
  { ersteStufe, imFrontend: [...new Set(rueckfaelle)] });

ende();
