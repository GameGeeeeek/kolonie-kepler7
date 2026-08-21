// Die Alien-Tabellen liegen in ZWEI Repos - sie müssen übereinstimmen (Phase 3, 18.08.2026).
//
//   node tests/test_nest_paritaet.js
//
// WARUM ES DIESE KOPIE ÜBERHAUPT GIBT. Der SERVER besitzt das Nest und rechnet jede Wirkung.
// Trotzdem braucht das Frontend die Tabellen: Die Flottenwahl nennt VOR dem Start den Stufennamen
// und die Volks-SCHWÄCHE - und die Schwäche ist die eine Auskunft, die über Erfolg und Misserfolg
// des Schlags entscheidet. Ein Faktor, den man erst aus dem Bericht erfährt, ist keine
// Entscheidung. Dieselbe Kopie-Familie wie FESTUNG_STUFEN nebenan.
//
// DIE SCHREIBWEISE DER SCHWÄCHE WEICHT ABSICHTLICH AB, und das ist der Kern dieses Tests:
// Das Backend schreibt 'destroyer' (Schreibweise von fleetHasShipType, dieselbe Kette wie beim
// Weltboss), das Frontend 'destroyers' (Schlüssel aus SHIP_DEFS, gegen die die echte Flotte
// gezählt wird). Ohne die Abbildung unten sähe der Test eine Abweichung, wo Absicht steht - und
// eine Prüfung, die man wegen eines bekannten Falschalarms ignoriert, ist keine.
//
// GEPRUEFT WIRD:
//   1. Beide Seiten kennen dieselben VÖLKER-Schlüssel und dieselben Namen. Der Name ist tragend:
//      Über ihn ordnet das Backend (nestVolkVonName) das vorhandene "Volk entdeckt"-Ereignis
//      seinem Nestbestand zu.
//   2. Die SCHWÄCHE stimmt je Volk überein, über die Schreibweisen-Abbildung.
//   3. `wandert` stimmt überein - das Kartenmenü warnt nur bei wandernden Völkern, und eine
//      falsche Warnung wäre eine Falschaussage über etwas, das den Spieler eine Flotte kostet.
//   4. Die STUFENNAMEN stimmen überein. Der Server schickt `stufeName` erst in der Antwort; die
//      Karte und die Flottenwahl bilden ihn vorher aus der eigenen Tabelle.
//   5. Der Schwächen-Multiplikator und die Abklingzeit stimmen überein - beide stehen im
//      Frontend ausschliesslich, damit Vorschau und Menü sie NENNEN können statt sie zu behaupten.
//   6. Das Frontend führt bewusst KEINE Lebenspunkte je Stufe: Sie kommen mit dem Dokument und
//      sind dort volksabhängig (lpFaktor). Eine zweite Rechnung wäre die klassische zweite
//      Anzeigestelle. Der Test hält das fest, damit sie nicht "hilfreich" nachgetragen werden.
//
// GEGENPROBE (in beide Richtungen ausgeführt): Ändert man im Backend eine Schwäche, schlägt 2a an;
// benennt man ein Volk um, schlägt 1b an; trägt man im Frontend `lp` nach, schlägt 6a an.
const fs = require('fs');
const { SPIELDATEI, SERVER_JS, pruefer, ueberspringen } = require('./lib/umgebung');
if (!SERVER_JS) ueberspringen('Backend-Quelltext nicht gefunden (Nachbarverzeichnis kolonie-kepler7-backend fehlt).');
const { check, ende } = pruefer();

const FRONT = fs.readFileSync(SPIELDATEI, 'utf8');
const BACK = fs.readFileSync(SERVER_JS, 'utf8');

function block(quelle, name, endeMarke){
  const von = quelle.indexOf(name);
  const bis = von < 0 ? -1 : quelle.indexOf(endeMarke, von);
  return (von < 0 || bis < 0) ? null : quelle.slice(von, bis + endeMarke.length);
}
// Beide Tabellen AUSFÜHREN statt per Regex lesen (CLAUDE.md: naive Regex über Array-Literale).
function lies(quelle, anfang, endeMarke, name){
  const b = block(quelle, anfang, endeMarke);
  if (!b) return null;
  try { return eval('(' + b.slice(b.indexOf('=') + 1).replace(/;\s*$/, '') + ')'); }
  catch (e) { return null; }
}
const fVoelker = lies(FRONT, '  const ALIEN_VOELKER = {', '\n  };');
const bVoelker = lies(BACK, 'const ALIEN_VOELKER = {', '\n};');
const fStufen  = lies(FRONT, '  const NEST_STUFEN = [', '\n  ];');
const bStufen  = lies(BACK, 'const NEST_STUFEN = [', '\n];');
check('0-bau: beide Völker-Tabellen sind lesbar', !!fVoelker && !!bVoelker,
  { frontend: fVoelker && Object.keys(fVoelker), backend: bVoelker && Object.keys(bVoelker) });
check('0-bau2: beide Stufen-Tabellen sind lesbar', Array.isArray(fStufen) && Array.isArray(bStufen),
  { frontend: fStufen && fStufen.length, backend: bStufen && bStufen.length });
if (!fVoelker || !bVoelker || !fStufen || !bStufen){
  console.log('\nAbbruch: ohne beide Tabellen sagen die übrigen Prüfungen nichts.');
  ende();
}

// ---------- 1: dieselben Völker ----------
const fKeys = Object.keys(fVoelker).sort(), bKeys = Object.keys(bVoelker).sort();
check('1a: beide Seiten kennen dieselben Völker-Schlüssel',
  fKeys.join(',') === bKeys.join(','), { frontend: fKeys, backend: bKeys });
const namensAbweichung = fKeys.filter(k => bVoelker[k] && fVoelker[k].name !== bVoelker[k].name)
  .map(k => k + ': "' + fVoelker[k].name + '" gegen "' + bVoelker[k].name + '"');
check('1b: die Volks-NAMEN stimmen überein (das Backend ordnet über sie zu)',
  namensAbweichung.length === 0, { namensAbweichung });

// ---------- 2: die Schwäche, über die Schreibweisen-Abbildung ----------
// Backend-Schreibweise (fleetHasShipType) -> Frontend-Schlüssel (SHIP_DEFS). Nur die Fälle, die
// wirklich abweichen; alles andere ist identisch und braucht keinen Eintrag.
const SCHREIBWEISE = { destroyer: 'destroyers', cruiser: 'cruisers' };
const swAbweichung = [];
for (const k of fKeys){
  if (!bVoelker[k]) continue;
  const bSw = bVoelker[k].schwaeche;
  const erwartet = SCHREIBWEISE[bSw] || bSw;
  if (fVoelker[k].schwaeche !== erwartet){
    swAbweichung.push(k + ': Frontend "' + fVoelker[k].schwaeche + '", Backend "' + bSw + '" (erwartet "' + erwartet + '")');
  }
}
check('2a: die Volks-Schwäche stimmt je Volk überein', swAbweichung.length === 0, { swAbweichung });
// Die Abbildung selbst ist nur so viel wert wie ihre Gültigkeit: Jeder Frontend-Schlüssel muss ein
// echtes Schiff sein. Sonst zählt nestTrifftSchwaeche gegen ein Feld, das die Flotte nie trägt -
// und der Bonus wäre stumm nie erreichbar.
const shipKeys = [...FRONT.matchAll(/\{ key:'(\w+)', name:'/g)].map(m => m[1]);
const unbekannt = fKeys.map(k => fVoelker[k].schwaeche).filter(sw => sw && shipKeys.indexOf(sw) < 0);
check('2b: jede Schwäche ist ein echter SHIP_DEFS-Schlüssel', unbekannt.length === 0,
  { unbekannt, hinweis: 'sonst trifft nestTrifftSchwaeche nie' });

// ---------- 3: wandert ----------
const wAbweichung = fKeys.filter(k => bVoelker[k] && !!fVoelker[k].wandert !== !!bVoelker[k].wandert);
check('3a: das Wander-Verhalten stimmt überein (das Kartenmenü warnt danach)',
  wAbweichung.length === 0, { wAbweichung });

// ---------- 4: Stufennamen ----------
const stufenAbweichung = [];
for (let i = 1; i <= 5; i++){
  const f = (fStufen[i] || {}).name, b = (bStufen[i] || {}).name;
  if (f !== b) stufenAbweichung.push(i + ': "' + f + '" gegen "' + b + '"');
}
check('4a: die fünf Stufennamen stimmen überein', stufenAbweichung.length === 0, { stufenAbweichung });

// ---------- 5: die zwei Zahlen, die das Frontend NENNT ----------
const bMult = (BACK.match(/const ALIEN_SCHWAECHE_MULT = ([\d.]+)/) || [])[1];
const fMult = (FRONT.match(/const NEST_SCHWAECHE_MULT = ([\d.]+)/) || [])[1];
check('5a: der Schwächen-Multiplikator stimmt überein',
  !!bMult && bMult === fMult, { backend: bMult, frontend: fMult });
const bAbkling = (BACK.match(/const NEST_ABKLING_MS = (\d+)\s*\*\s*3600/) || [])[1];
const fAbkling = (FRONT.match(/const NEST_ABKLING_STD = (\d+)/) || [])[1];
check('5b: die Abklingzeit stimmt überein (Stunden)',
  !!bAbkling && bAbkling === fAbkling, { backend: bAbkling, frontend: fAbkling });

// ---------- 6: was das Frontend bewusst NICHT führt ----------
// Die Gegenrichtung von Regel 6: Hier ist eine fehlende zweite Zahl die richtige Antwort, und der
// Test hält sie fest - sonst trägt sie beim nächsten Mal jemand "hilfreich" nach.
const fStufenRoh = block(FRONT, '  const NEST_STUFEN = [', '\n  ];') || '';
check('6a: das Frontend führt KEINE Lebenspunkte je Stufe (sie kommen mit dem Dokument)',
  !/\blp\s*:/.test(fStufenRoh) && !/lpFaktor/.test(FRONT.slice(FRONT.indexOf('const ALIEN_VOELKER'), FRONT.indexOf('const NEST_SCHWAECHE_MULT'))),
  { hinweis: 'lp/lpFaktor gehören dem Server - sie sind volksabhängig' });

ende();
