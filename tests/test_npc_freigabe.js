// Das 🎯-Abzeichen zeigt nur Gegner, die der Spieler erreichen darf (03.09.2026).
//
//   node tests/test_npc_freigabe.js
//
// DER ANLASS, gemessen: Drei Gegner sind hinter der Forschung `rleere` gesperrt (void1/2/3). Vier
// Stellen halten sich daran - die Systemliste, die Zielauswahl, der Angriffs-Riegel und die
// Gegnerliste. Das Landmarken-Abzeichen der Sektorkarte war die fuenfte und einzige ohne die
// Regel. Und weil in allen drei Systemen AUSSERDEM ein freier Gegner steht, war die Folge nicht
// bloss ein Name zu viel, sondern eine falsche Anzahl und ein falscher "staerkster":
//
//   vortex   "2 Gegner, staerkster: Leeren-Vorhut (Stufe 30)"   wahr: Vortex-Kollektiv - Stufe 13
//   abyss    "2 Gegner, staerkster: Leeren-Armada (Stufe 35)"   wahr: Der Abyss-Fuerst - Stufe 20
//   nyra     "2 Gegner, staerkster: Das Herz der Leere (40)"    wahr: Nyra, die Verschlingerin - 25
//
// Ein Spieler ohne Leerentechnologie las dort also Namen und Stufen von Inhalten, die das Spiel
// ihm sonst ueberall verbirgt - und dazu eine Zahl, die fuer ihn nicht stimmt.
//
// WIE HIER GEPRUEFT WIRD - zwei Fragen, getrennt gemessen:
//   1) IST DIE REGEL RICHTIG?   npcFreigeschaltet wird aus der Spieldatei geschnitten und
//      AUSGEFUEHRT (Abschnitt 1).
//   2) WENDET DAS ABZEICHEN SIE AN?  karteSystemBadges wird geschnitten und mit einem EIGENEN,
//      bekannt richtigen npcFreigeschaltet ausgefuehrt (Abschnitt 2-4). Dadurch misst Abschnitt 2
//      wirklich nur, OB gefiltert wird - und faellt nicht mit, wenn die Regel selbst kaputt ist.
// Ein Regex auf die Filterzeile waere die Sorte Pruefung, die in diesem Repo schon zweimal
// danebenlag (docs/PROJECT_MEMORY.md): Sie haelt eine Schreibweise fest, nicht die Sache.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

function schneideFunktion(kopf){
  const von = JS.indexOf(kopf);
  if (von < 0) return null;
  const bis = JS.indexOf('\n  function ', von + kopf.length);
  return bis > von ? JS.slice(von, bis) : null;
}

// ---- 0) Anker ----------------------------------------------------------------------------------
const HELFER = schneideFunktion('  function npcFreigeschaltet(');
const BADGES = schneideFunktion('  function karteSystemBadges(sysId){');
check('0-anker: karteSystemBadges laesst sich schneiden', !!BADGES, BADGES ? BADGES.split('\n').length + ' Zeilen' : 'nicht gefunden');
check('0b: es gibt einen benannten Helfer npcFreigeschaltet',
  !!HELFER, HELFER ? HELFER.split('\n').length + ' Zeilen' : 'nicht gefunden');
if (!BADGES) { ende(); return; }

// ---- 1) Die Regel selbst -----------------------------------------------------------------------
/* Ausgefuehrt, nicht gelesen. Drei Faelle, und der dritte ist der, den eine Pruefung gerne
   vergisst: Ein Gegner OHNE requiresResearch muss immer durchkommen - auch wenn state.research
   den Schluessel gar nicht kennt. */
if (HELFER){
  const regel = new Function('forschung', `
    const state = { research: forschung };
    ${HELFER}
    return npcFreigeschaltet;`);
  const ohne = regel({});
  const mit  = regel({ rleere: 1 });
  const gesperrt = { id:'void1', requiresResearch:'rleere' };
  check('1: gesperrter Gegner ist ohne die Forschung NICHT frei',
    ohne(gesperrt) === false, ohne(gesperrt));
  check('1b: mit der Forschung ist er frei', mit(gesperrt) === true, mit(gesperrt));
  check('1c: ein Gegner OHNE Sperre ist immer frei, auch bei leerer Forschung',
    !!ohne({ id:'raider10' }), ohne({ id:'raider10' }));
} else {
  check('1: gesperrter Gegner ist ohne die Forschung NICHT frei', false, 'Helfer fehlt');
  check('1b: mit der Forschung ist er frei', false, 'Helfer fehlt');
  check('1c: ein Gegner OHNE Sperre ist immer frei, auch bei leerer Forschung', false, 'Helfer fehlt');
}

// ---- Das Abzeichen ausfuehren ------------------------------------------------------------------
/* Alle Nachbarn werden auf "hier ist nichts" gestellt, damit genau EIN Abzeichen entstehen kann.
   karteEbeneAn liefert true - das 🎯 haengt an der Ereignis-Ebene, und die soll hier an sein. */
function badgesFuer(npcs, forschung){
  const bauen = new Function('NPCS', 'forschung', `
    const state = { allianceBase:null, asteroidFeld:null, spyIntel:{} };
    const STAR_SYSTEMS = [], NEST_STUFEN = {};
    const galaxyCache = { activePirateFaction:null, nester:[], konvois:[] };
    function activeSignals(){ return []; }
    function npcFreigeschaltet(npc){
      return !npc.requiresResearch || (forschung[npc.requiresResearch]||0) >= 1;
    }
    function myAllianceTag(){ return null; }
    function karteEbeneAn(){ return true; }
    function statthalterIn(){ return null; }
    function npcScalingCount(){ return 0; }
    function weaknessName(w){ return String(w||''); }
    function nesterImSystem(){ return []; }
    function wurmlochOffen(){ return null; }
    function festungFaktoren(){ return {}; }
    function nestVolk(){ return null; }
    function nestStufeDef(){ return null; }
    function nestSchwaecheName(){ return ''; }
    function konvoiImSystem(){ return []; }
    function vorpostenAn(){ return null; }
    function vorpostenIstStation(){ return false; }
    function vorpostenScanStufe(){ return 0; }
    function signalTypeOf(){ return null; }
    function fmt(n){ return String(n); }
    ${BADGES}
    return karteSystemBadges;`);
  return bauen(npcs, forschung)('pruefsystem');
}
function ziel(bs){ return (bs || []).filter(b => b && b.icon === '🎯'); }

// ---- 2) Der gemessene Anlassfall: frei + gesperrt im selben System ------------------------------
/* Genau die Lage von vortex/abyss/nyra. Ohne die Forschung darf das Abzeichen NUR den freien
   Gegner kennen - und damit die EINZAHL-Fassung waehlen, nicht "2 Gegner". */
const GEMISCHT = [
  { id:'raider10', name:'Vortex-Kollektiv', level:13, system:'pruefsystem' },
  { id:'void1', name:'Leeren-Vorhut', level:30, system:'pruefsystem', requiresResearch:'rleere' }
];
{
  const t = ziel(badgesFuer(GEMISCHT, {}));
  check('2: ohne die Forschung steht genau EIN 🎯 da', t.length === 1, t.length);
  const titel = (t[0] || {}).title || '';
  check('2b: es nennt den freien Gegner mit seiner Stufe',
    /Vortex-Kollektiv/.test(titel) && /13/.test(titel), titel);
  /* Der eigentliche Schaden. Nicht nur "der Name fehlt": Anzahl und "staerkster" waren falsch. */
  check('2c: der gesperrte Gegner taucht NICHT auf', !/Leeren-Vorhut/.test(titel), titel);
  check('2d: und die Anzahl zaehlt ihn auch nicht mit', !/2 Gegner/.test(titel), titel);
}

// ---- 3) Mit der Forschung darf beides dastehen -------------------------------------------------
/* Die Gegenrichtung. Ohne sie wuerde ein Abzeichen, das gar keine Gegner mehr zeigt, gruen
   durchgehen - dieselbe Pruefung nur einseitig gelesen. */
{
  const t = ziel(badgesFuer(GEMISCHT, { rleere: 1 }));
  check('3: mit der Forschung steht weiterhin ein 🎯 da', t.length === 1, t.length);
  const titel = (t[0] || {}).title || '';
  check('3b: jetzt zaehlt es beide', /2 Gegner/.test(titel), titel);
  check('3c: und nennt den staerksten - den gesperrten', /Leeren-Vorhut/.test(titel), titel);
}

// ---- 4) Nur ein gesperrter Gegner: gar kein Abzeichen -------------------------------------------
/* Der Fall, den ein Filter mit "|| erster Eintrag" still ueberlebt: Bleibt nichts uebrig, darf
   auch kein leeres 🎯 entstehen. */
{
  const nur = [{ id:'void3', name:'Das Herz der Leere', level:40, system:'pruefsystem', requiresResearch:'rleere' }];
  check('4: ein System mit NUR gesperrten Gegnern traegt kein 🎯',
    ziel(badgesFuer(nur, {})).length === 0, ziel(badgesFuer(nur, {})).length);
  check('4b: mit der Forschung schon', ziel(badgesFuer(nur, { rleere:1 })).length === 1,
    ziel(badgesFuer(nur, { rleere:1 })).length);
}

// ---- 5) Der Statthalter bleibt aus dem 🎯 heraus (E2) -------------------------------------------
/* Kein neuer Befund, sondern ein Waechter: Die Freigabe-Regel darf die aeltere Regel nicht
   verdraengen. Beide filtern dieselbe Liste, und wer eine davon umbaut, faellt hier auf. */
{
  const mitStatt = [
    { id:'raider10', name:'Vortex-Kollektiv', level:13, system:'pruefsystem' },
    { id:'statt_x', name:'Meridian', level:28, system:'pruefsystem', statthalter:'meridian' }
  ];
  const titel = (ziel(badgesFuer(mitStatt, {}))[0] || {}).title || '';
  check('5: der Statthalter zaehlt nicht ins 🎯', !/Meridian/.test(titel) && !/2 Gegner/.test(titel), titel);
}

// ---- 6) Die Regel steht genau EINMAL ------------------------------------------------------------
/* Was diese Pruefung NICHT kann: Sie liest Quelltext und sieht damit nur die heutige Schreibweise.
   Ihr Zweck ist deshalb nicht das Verhalten - das messen 1 bis 4 - sondern die Kopie-Familie:
   Vor dieser Aenderung stand `!n.requiresResearch || (state.research[...]||0) >= 1` VIERMAL
   ausgeschrieben da, und die fuenfte Stelle hatte sie schlicht vergessen. Genau so entstehen in
   diesem Projekt die Befunde. */
{
  /* Beide Schreibweisen zaehlen. Die vier Kopien standen NICHT alle gleich da: drei als
     `!n.requiresResearch || (state.research[...]||0) >= 1`, der Angriffs-Riegel als negierte
     Fassung `npc.requiresResearch && (state.research[...]||0) < 1`. Ein Muster, das nur die
     erste Form kennt, haette den Riegel uebersehen - und der ist die Stelle, an der die Regel
     wirklich schuetzt. */
  const ohneHelfer = HELFER ? JS.replace(HELFER, '') : JS;
  const ausgeschrieben = (ohneHelfer.match(/requiresResearch[^\n]*state\.research/g) || []).length;
  check('6: ausserhalb des Helfers steht die Regel nirgends mehr', ausgeschrieben === 0, ausgeschrieben);
  const nutzer = (JS.match(/npcFreigeschaltet\s*\(/g) || []).length;
  /* Fuenf Verwender plus die Definition. Weniger heisst, dass eine Stelle die Regel wieder
     selbst schreibt oder ganz verloren hat. */
  check('6b: mindestens fuenf Stellen benutzen den Helfer', nutzer >= 6, nutzer);
}

ende();
