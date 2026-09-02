// KI-Kampfberichte: der Prompt liegt in ZWEI Repos - und muss derselbe sein.
//
// gamegeeeeek-ai-core/tools/kampftext_messlauf.py hat ihn am echten Modell GEMESSEN (E0,
// 28.08.2026: acht von acht Texten trugen eine Falschaussage, daraufhin der radikale Zuschnitt).
// kolonie-kepler7-backend/server.js ENTSCHEIDET damit, was ein Spieler zu sehen bekommt. Laufen
// die beiden auseinander, misst das Werkzeug etwas anderes, als der Server durchlaesst - und der
// naechste Messlauf beantwortet stillschweigend eine andere Frage als die gestellte.
//
// Dieselbe Kopie-Familie wie SHIP_SCORE_WEIGHTS/computeScoreServer, nur ueber drei Repos:
// Die Schiffsnamen kommen zusaetzlich aus SHIP_DEFS der Spieldatei.
const fs = require('fs');
const { SPIELDATEI, SERVER_JS, AI_CORE_MESSLAUF } = require('./lib/spieldatei');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

if (!SERVER_JS || !AI_CORE_MESSLAUF) {
  console.log('UEBERSPRUNGEN - Nachbar-Repo fehlt (server.js: ' + !!SERVER_JS + ', AI Core: ' + !!AI_CORE_MESSLAUF + ')');
  process.exit(0);
}
const BE = fs.readFileSync(SERVER_JS, 'utf8');
const PY = fs.readFileSync(AI_CORE_MESSLAUF, 'utf8');
const FE = fs.readFileSync(SPIELDATEI, 'utf8');

// --- 1: die fuenf Felder --------------------------------------------------------------------
// Sie sind der Zuschnitt selbst. Ein sechstes Feld auf einer Seite heisst: Der Server gibt dem
// Modell eine Groesse mit, die im Messlauf nie geprueft wurde - oder umgekehrt.
// Geschnitten wird ab dem `return {` der Funktion, nicht ab ihrem Kopf: Der Docstring bzw. der
// Kommentar darueber nennt die Feldnamen in Prosa, und ein Muster ueber den ganzen Rumpf zaehlte
// sie mit. Der Anker ist ausserdem `def prompt_daten(` OHNE Signatur - der erste Entwurf suchte
// `def prompt_daten(bericht)` und fand nichts, weil dort `bericht: dict` steht.
function felderAus(text, start, ende) {
  let i = text.indexOf(start);
  if (i < 0) return null;
  i = text.indexOf('return {', i);
  if (i < 0) return null;
  const j = text.indexOf(ende, i);
  if (j < 0) return null;
  const raus = [];
  for (const m of text.slice(i, j).matchAll(/^\s*['"]?([a-z_]+)['"]?\s*:/gm)) raus.push(m[1]);
  return raus.sort();
}
const feldBE = felderAus(BE, 'function kampftextDaten(', 'function kampftextDatenText');
const feldPY = felderAus(PY, 'def prompt_daten(', 'def baue_prompt(');
check('1-anker: beide Bloecke gefunden', !!feldBE && !!feldPY, { be: feldBE, py: feldPY });
check('1a: dieselben fuenf Felder in beiden Repos',
  JSON.stringify(feldBE) === JSON.stringify(feldPY), { backend: feldBE, aiCore: feldPY });
check('1b: und es sind wirklich die fuenf des Zuschnitts',
  JSON.stringify(feldBE) === JSON.stringify(['ausgang', 'eigene_schiffe', 'gegner', 'stufe', 'verlorene_schiffe']),
  feldBE);

// --- 2: der Anweisungstext ------------------------------------------------------------------
// Wort fuer Wort, nur ohne Zeilenumbrueche und Mehrfach-Leerzeichen: Der Text IST das Gemessene.
// Ein anderer Prompt ergibt andere Texte, und dann sagt die E0-Messung nichts mehr ueber sie.
function anweisung(text, von, bis) {
  const i = text.indexOf(von);
  if (i < 0) return null;
  const j = text.indexOf(bis, i);
  if (j < 0) return null;
  return text.slice(i, j)
    .replace(/\\n/g, ' ')            // die Umbrueche IM Prompt
    .replace(/['"+\n]/g, ' ')        // Zeichenketten-Grenzen beider Sprachen
    .replace(/\s+/g, ' ')
    .trim();
}
const textBE = anweisung(BE, 'Du bist der Bordschreiber', 'KAMPFDATEN:');
const textPY = anweisung(PY, 'Du bist der Bordschreiber', 'KAMPFDATEN:');
check('2-anker: beide Anweisungstexte gefunden', !!textBE && !!textPY);
check('2a: der Anweisungstext ist wortgleich', textBE === textPY, { backend: textBE, aiCore: textPY });
check('2b: er verbietet ausdruecklich Zahlen und Zeitangaben',
  /KEINE Zahlen und KEINE Zeitangaben/.test(textBE || ''), { textBE });

// --- 3: der Laengendeckel -------------------------------------------------------------------
const deckelBE = (BE.match(/const KAMPFTEXT_MAX_ZEICHEN = (\d+)/) || [])[1];
const deckelPY = (PY.match(/^MAX_ZEICHEN = (\d+)/m) || [])[1];
check('3a: derselbe Laengendeckel', deckelBE && deckelBE === deckelPY, { backend: deckelBE, aiCore: deckelPY });

// --- 4: die Schiffsnamen gegen SHIP_DEFS ----------------------------------------------------
// Ein neues Schiff, das hier fehlt, faellt still aus dem Erzaehltext - und die Schiffsnamen-Sperre
// koennte es dann auch nicht als fremd erkennen.
const iBE = BE.indexOf('const KAMPFTEXT_SCHIFFSNAMEN = {');
const namenBE = {};
if (iBE >= 0) {
  for (const m of BE.slice(iBE, BE.indexOf('\n};', iBE)).matchAll(/^\s*([a-z0-9_]+): '([^']+)',/gm)) namenBE[m[1]] = m[2];
}
const iFE = FE.indexOf('const SHIP_DEFS');
const namenFE = {};
if (iFE >= 0) {
  for (const m of FE.slice(iFE, FE.indexOf('\n  ];', iFE)).matchAll(/key:\s*'([a-z0-9_]+)'[^\n]*?name:\s*'([^']+)'/g)) namenFE[m[1]] = m[2];
}
check('4-anker: beide Tabellen gefunden',
  Object.keys(namenBE).length > 20 && Object.keys(namenFE).length > 20,
  { backend: Object.keys(namenBE).length, shipDefs: Object.keys(namenFE).length });
const fehlend = Object.keys(namenFE).filter(k => !namenBE[k]);
check('4a: jedes Schiff aus SHIP_DEFS hat einen Namen im Backend', fehlend.length === 0, fehlend);
const abweichend = Object.keys(namenFE).filter(k => namenBE[k] && namenBE[k] !== namenFE[k])
  .map(k => k + ': FE=' + namenFE[k] + ' BE=' + namenBE[k]);
check('4b: und zwar denselben', abweichend.length === 0, abweichend);
// Die Gegenrichtung: ein Name, den SHIP_DEFS gar nicht kennt, waere ein erfundenes Schiff - die
// Sperre wuerde es dann als erlaubt durchlassen, sobald es im Text auftaucht.
const ueberzaehlig = Object.keys(namenBE).filter(k => !namenFE[k] && k !== 'superschlachtschiff');
check('4c: kein Name, den SHIP_DEFS nicht kennt', ueberzaehlig.length === 0, ueberzaehlig);
check('4d: das Superschlachtschiff ist die eine benannte Ausnahme (es hat keinen SHIP_DEFS-Eintrag)',
  namenBE.superschlachtschiff === 'Superschlachtschiff' && !namenFE.superschlachtschiff,
  { backend: namenBE.superschlachtschiff, inShipDefs: !!namenFE.superschlachtschiff });

console.log('');
console.log(fail ? 'FEHLGESCHLAGEN' : 'Alles gruen.');
process.exit(fail ? 1 : 0);
