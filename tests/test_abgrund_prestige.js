// Der Abgrund ueber die beiden Resets (30.07.2026, v8.344.0).
//
// Ausgangslage: `state.abgrund` stand in KEINER der beiden keep*-Listen. Jeder Prestige und jeder
// Aufstieg loeschte damit Rekordtiefe, Werkstatt, Reliquien, Konstellationen und beide Werkstoffe -
// stillschweigend, denn beide Bestaetigungsdialoge zaehlten nur auf, was BLEIBT, und der Abgrund
// kam darin nicht vor. In keine Richtung.
//
// Dieser Test ist bewusst ein QUELLTEXT-Test und kein Laufzeit-Test. Die beiden Reset-Funktionen
// bauen ein state-Objekt mit ueber siebzig Feldern und rufen danach applyStateDefaults(), render()
// und save() - das im Test nachzustellen hiesse, die halbe Spieldatei zu stubben, und der Test
// wuerde dann vor allem die Stubs pruefen. Was hier wirklich schiefgehen kann, ist etwas anderes und
// vom Quelltext aus vollstaendig sichtbar:
//
//   A) das Feld fehlt in einer der beiden Zuweisungen (der urspruengliche Fehler)
//   B) beide Resets rufen denselben Zweig (jemand tippt zweimal `true`)
//   C) die Auswahl der behaltenen Felder laeuft von der tatsaechlichen Datenstruktur weg
//   D) die Dialoge sagen es nicht (genau das machte den Fehler so lange unsichtbar)
//
// Die Uebertragungsfunktion selbst wird dagegen ECHT ausgefuehrt - sie ist reines Datenumkopieren
// und braucht keine Umgebung.
const fs = require('fs');
const path = require('path');
// Pfad ueber die gemeinsame Quelle, nicht fest verdrahtet: Sonst wird KEPLER_SPIELDATEI
// still ignoriert und eine Gegenprobe liest die ECHTE Datei - sie sieht dann aus wie
// bestanden (CLAUDE.md, Korrektur zu Regel 14).
const { SPIELDATEI } = require('./lib/spieldatei');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

function fnAus(n){
  const m = js.match(new RegExp('function\\s+'+n+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+n);
  const i = js.indexOf(m[0]);
  let d=0, s=js.indexOf('{', i+m[0].length), k=s;
  for (; k<js.length; k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}

// ---- 1) Beide Resets tragen den Abgrund ueberhaupt weiter ----
const prestige = fnAus('confirmPrestigeWithPerk');
// Seit v8.373.0 ist doAscension() nur noch die Pfad-AUSWAHL; der eigentliche Reset samt
// Abgrund-Weitergabe und Sicherheitsabfragen steht in ascendWithPath(). Der Test zeigt bewusst auf
// die Funktion, die den Reset wirklich ausfuehrt - auf doAscension zu zeigen haette ihn still zu
// einem Test ueber ein Auswahlmenue gemacht.
const aufstieg = fnAus('ascendWithPath');
// Der Feldname wird an der GRENZE geprueft (Zeilenanfang oder Komma davor), nicht als beliebige
// Teilzeichenkette. Beim ersten Anlauf stand hier nur /abgrund: .../ - und eine Rot-Probe, die das
// Feld in `xabgrund:` verunstaltete, blieb gruen, weil `xabgrund: ` die gesuchte Zeichenkette
// enthaelt. Der Test haette also genau den Fall verschlafen, fuer den er gebaut ist.
const traegt = q => /(?:^|[\s,{])abgrund:\s*abgrundUeberReset\(/m.test(q);
check('1: das Prestige traegt den Abgrund weiter', traegt(prestige));
check('1: der Aufstieg traegt den Abgrund weiter',  traegt(aufstieg));
// DAS ist der Kern: Die beiden duerfen NICHT denselben Zweig rufen. Ein zweimal getipptes `true`
// waere die stillste moegliche Regression - der Aufstieg wuerde Werkstoffe und Werkstatt behalten,
// obwohl sein Dialog das Gegenteil verspricht, und kein anderer Test wuerde das sehen.
check('1: das Prestige nimmt ALLES mit', /(?:^|[\s,{])abgrund:\s*abgrundUeberReset\(true\)/m.test(prestige));
check('1: der Aufstieg nur die Aufzeichnungen', /(?:^|[\s,{])abgrund:\s*abgrundUeberReset\(false\)/m.test(aufstieg));
check('1: und es sind wirklich zwei verschiedene Zweige',
  (js.match(/abgrundUeberReset\(true\)/g)||[]).length === 1 &&
  (js.match(/abgrundUeberReset\(false\)/g)||[]).length === 1);

// ---- 2) Die Uebertragung selbst ----
const UR = new Function('state', fnAus('abgrundUeberReset')+'; return abgrundUeberReset;');
// Ein voller Abgrund-Zustand, wie ihn ein weit entwickeltes Konto hat.
const voll = {
  tiefe:64, best:87, splitter:41200, bergung:1330, tauchgaenge:412,
  gesehen:{ sog:12, kristallader:3 }, konstGesehen:{ wanderer:1 }, relikte:{ erster:true, chor:true },
  waechterTage:{ 10:'2026-07-01', 20:'2026-07-08' }, werkstatt:{ druckhuelle:14, echolot:9 },
  woche:{ key:'2026-07-27', best:64 }, wochePraemie:{ key:'2026-07-20', tiefe:60 },
  allianzMarken:{ '2026-07-27|50':true }, gegenmassnahmen:7, bann:'sog',
  lotBis:74, spule:true, ruf:true, grund:true, werkstattGesehen:true, allianzMeldungFehler:null,
  meilensteine:{ t25:true, t50:true, t75:true },
  reiter:'sammlung'
};
{
  const alles = UR({ abgrund: voll })(true);
  check('2: mit true kommt der Zustand unveraendert durch', alles === voll);
}
{
  const rest = UR({ abgrund: voll })(false);
  // Was bleiben MUSS - die Aufzeichnungen.
  for (const [feld, wert] of [['best',87], ['tauchgaenge',412]]){
    check('2: der Aufstieg behaelt '+feld.padEnd(12), rest[feld] === wert, rest[feld]);
  }
  for (const feld of ['gesehen','konstGesehen','relikte','waechterTage','meilensteine']){
    check('2: der Aufstieg behaelt '+feld.padEnd(12),
      JSON.stringify(rest[feld]) === JSON.stringify(voll[feld]), rest[feld]);
  }
  // Was gehen MUSS - Werkstoffe, Werkstatt, Vormerkungen, Wochenlauf.
  for (const feld of ['splitter','bergung','werkstatt','woche','wochePraemie','allianzMarken',
                      'gegenmassnahmen','bann','lotBis','spule','ruf','grund']){
    check('2: der Aufstieg setzt '+feld.padEnd(16)+' zurueck', rest[feld] === undefined, rest[feld]);
  }
  // ensureAbgrund() fuellt die fehlenden Felder danach mit ihren Grundwerten - genau dafuer ist es
  // da. Ein Feld, das hier fehlt, ist deshalb keine Luecke, sondern die Rueckstellung.
  check('2: die zurueckgesetzten Felder werden von ensureAbgrund neu gefuellt',
    /if \(typeof a\.splitter !== 'number'/.test(fnAus('ensureAbgrund')) &&
    /if \(!a\.werkstatt\) a\.werkstatt = \{\}/.test(fnAus('ensureAbgrund')));
  // Ein leerer Ausgangszustand darf nicht abstuerzen (Konto, das nie getaucht ist).
  const leer = UR({})(false);
  check('2: ein Konto ohne Abgrund uebersteht den Aufstieg',
    leer.best === 0 && leer.tauchgaenge === 0 && JSON.stringify(leer.relikte) === '{}');
}

// ---- 3) Die Auswahl darf nicht von der Datenstruktur weglaufen ----
// Wenn ensureAbgrund ein NEUES Aufzeichnungs-Feld bekommt (etwa eine weitere Sammlung), muss
// entschieden werden, ob es den Aufstieg ueberlebt. Diese Pruefung erzwingt die Entscheidung: Sie
// listet die bekannten Felder auf, und ein unbekanntes macht sie rot.
{
  const eA = fnAus('ensureAbgrund');
  const felder = [...eA.matchAll(/a\.([a-zA-ZäöüÄÖÜ]+)\s*(?:=|!==|===)/g)].map(m => m[1]);
  const bekannt = new Set(['tiefe','best','splitter','bergung','tauchgaenge','gesehen','konstGesehen',
    'relikte','waechterTage','werkstatt','woche','wochePraemie','allianzMarken','gegenmassnahmen',
    'bann','lotBis','spule','ruf','grund','werkstattGesehen','allianzMeldungFehler','meilensteine']);
  const neu = [...new Set(felder)].filter(f => !bekannt.has(f));
  check('3: ensureAbgrund fuehrt keine dem Reset unbekannten Felder',
    neu.length === 0, { unbekannt:neu, hinweis:'Neues Feld? In abgrundUeberReset entscheiden, ob es den Aufstieg ueberlebt.' });
}
// Und der Abgrund darf keine Kolonie-Schluessel fuehren: Das ist die Begruendung dafuer, dass
// Prestige ihn KOMPLETT behalten darf. Zeigte ein Feld auf eine Kolonie, wuerde es nach dem Reset
// ins Leere zeigen - genau der Bug, den equippedModules hatte.
check('3: kein Abgrund-Feld haengt an Kolonien oder Planeten',
  !/state\.colonies|activeBasePlanet|planetKey/.test(fnAus('ensureAbgrund')));

// ---- 4) Die Dialoge und die Hilfe sagen es (CLAUDE.md Regel 6) ----
// Der Fehler war jahrelang unsichtbar, WEIL die Dialoge nur aufzaehlen, was bleibt. Ein stummer
// Dialog ist hier keine Kosmetik, sondern die Ursache.
{
  const pDlg = (fnAus('doPrestige').match(/confirm\('Prestige[^']*'/)||[''])[0];
  check('4: der Prestige-Dialog nennt den Abgrund', /Abgrund/.test(pDlg));
  check('4: und wird konkret, was genau bleibt',
    /Rekordtiefe/.test(pDlg) && /Bergungsgut/.test(pDlg), pDlg.length);
  const aDlg = (aufstieg.match(/confirm\('AUFSTIEG[^']*'/)||[''])[0];
  check('4: der Aufstiegs-Dialog nennt den Abgrund', /Abgrund/.test(aDlg));
  check('4: und sagt ausdruecklich, was dort VERLOREN geht',
    /verloren/.test(aDlg) && /Werkstatt/.test(aDlg), aDlg.length);
  const hilfe = src.slice(src.indexOf("{ title:'Prestige', body:'"));
  const eintrag = hilfe.slice(0, hilfe.indexOf("' },"));
  check('4: der Hilfe-Abschnitt Prestige nennt beide Faelle',
    /Abgrund-Fortschritt/.test(eintrag) && /Aufzeichnungen/.test(eintrag));
  check('4: und nennt den Grund fuer den Unterschied (Kompendium)',
    /Kompendium/.test(eintrag));
  // Die Einschraenkung gehoert dazu: Wer liest "Abgrund bleibt", erwartet sonst, nach dem Prestige
  // sofort weitertauchen zu koennen - die Forschung ist aber weg.
  check('4: und sagt, dass Singularitaetsphysik trotzdem neu erforscht werden muss',
    /Singularitätsphysik/.test(eintrag));
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
