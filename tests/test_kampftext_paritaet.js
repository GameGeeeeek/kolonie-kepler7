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

// --- 5: E2 - die Datenbloecke der grossen Momente (04.09.2026) ------------------------------
// GEGENPROBE zu 5 und 6 (gemessen, Kopie der Nachbar-server.js sabotiert): ein E2-Feld umbenannt
// (schiffstypen_verteidiger -> schiffe_verteidiger) -> genau 5a und 5b fallen; ein Wort in der
// Koeniginnen-Einleitung geaendert -> genau 6-koenigin faellt.
// Fuenf weitere Kampfarten, je ein eigener Datenblock in prompt_daten_fuer (Python) und
// kampftextDatenFuer (JS). Verglichen wird die MENGE aller Feldnamen mit Vielfachheit ueber die
// ganze Funktion - ein umbenanntes oder fehlendes Feld auf einer Seite faellt so auf, ohne dass
// die Pruefung die Reihenfolge der Arten kennen muss. Und keine Liste darf mehr "_schiffe" heissen:
// die erste E2-Messung las "eigene_schiffe: [Bomber, Kreuzer]" als zwei Schiffe.
function felderAusRumpf(text, start, ende) {
  const i = text.indexOf(start);
  if (i < 0) return null;
  const j = text.indexOf(ende, i);
  if (j < 0) return null;
  const raus = [];
  // Python-Schluesselwoerter mit Doppelpunkt (else:, try:, finally:) sind keine Felder - der erste
  // Entwurf zaehlte das `else:` des Spielerkampf-Zweigs als 26. Feld.
  for (const m of text.slice(i, j).matchAll(/^\s*['"]?([a-z_]+)['"]?\s*:/gm)) if (!/^(else|try|finally|elif)$/.test(m[1])) raus.push(m[1]);
  return raus.sort();
}
const e2BE = felderAusRumpf(BE, 'function kampftextDatenFuer(', '\n  return null;');
const e2PY = felderAusRumpf(PY, 'def prompt_daten_fuer(', 'raise ValueError');
check('5-anker: beide E2-Datenbloecke gefunden', !!e2BE && !!e2PY && e2BE.length > 10 && e2PY.length > 10, { be: e2BE && e2BE.length, py: e2PY && e2PY.length });
check('5a: dieselben E2-Felder in beiden Repos (mit Vielfachheit)', JSON.stringify(e2BE) === JSON.stringify(e2PY), { backend: e2BE, aiCore: e2PY });
check('5b: jede Liste heisst Schiffstypen, keine mehr _schiffe (Befund der ersten E2-Messung)',
  !!e2BE && e2BE.some(f => f.indexOf('schiffstypen') >= 0) && e2BE.every(f => !/_schiffe$|^schiffe_/.test(f)), e2BE);
check('5c: der Spielerkampf traegt die Verluste als Datum', !!e2BE && e2BE.filter(f => f === 'verluste').length === 1, e2BE);

// --- 6: E2 - die Einleitungen und die gemeinsamen Regeln -------------------------------------
// Je Art ein Anweisungstext; der npc-Text in Abschnitt 2 ist der gemessene von E0, diese fuenf sind
// die gemessenen von E2 (04.09.2026). Normalisiert wie oben, plus der Backslash der JS-Escapes.
// Der Eintrag wird vom Schluessel bis zum naechsten Schluessel geschnitten; verglichen wird ab dem
// ersten Wort des Textes (`ab`), ohne Zeichenketten-Grenzen, Klammern, Kommas und Backslashes
// beider Sprachen. `\n` im Prompt wird zum Leerzeichen, bevor die Backslashes fallen.
function e2Text(text, von, bis, ab) {
  const i = text.indexOf(von);
  if (i < 0) return null;
  const j = text.indexOf(bis, i);
  if (j < 0) return null;
  const roh = text.slice(i, j);
  const k = roh.indexOf(ab);
  if (k < 0) return null;
  return roh.slice(k).replace(/\\n/g, ' ').replace(/['"+\n\\(),;]/g, ' ').replace(/\s+/g, ' ').trim();
}
const ARTEN = ['weltboss', 'festung', 'koenigin', 'pvp-angriff', 'pvp-verteidigung'];
const iEinBE = BE.indexOf('const KAMPFTEXT_EINLEITUNGEN = {'), iEinPY = PY.indexOf('E2_EINLEITUNGEN = {');
check('6-anker: beide Einleitungstabellen gefunden', iEinBE >= 0 && iEinPY >= 0);
for (let k = 0; k < ARTEN.length; k++) {
  const art = ARTEN[k], naechste = ARTEN[k + 1];
  // Der Eintrag reicht bis zum naechsten Schluessel bzw. bis zum Ende der Tabelle.
  const be = e2Text(BE.slice(iEinBE), (art.indexOf('-') >= 0 ? "'" + art + "':" : art + ':'), naechste ? (naechste.indexOf('-') >= 0 ? "'" + naechste + "':" : '\n  ' + naechste + ':') : '\n};', 'Du bist');
  const py = e2Text(PY.slice(iEinPY), '"' + art + '": (', naechste ? '"' + naechste + '": (' : '\n}', 'Du bist');
  check('6-' + art + ': die Einleitung ist wortgleich', !!be && !!py && be === py, { backend: be, aiCore: py });
}
const regelnBE = e2Text(BE, 'const KAMPFTEXT_E2_REGELN =', 'KAMPFDATEN:', 'STRIKTE REGELN');
const regelnPY = e2Text(PY, 'E2_REGELN = (', 'KAMPFDATEN:', 'STRIKTE REGELN');
check('6-regeln: die gemeinsamen E2-Regeln sind wortgleich und verbieten Stueckzahlen auch als Wort',
  !!regelnBE && !!regelnPY && regelnBE === regelnPY && /auch nicht als Wort/.test(regelnBE), { backend: regelnBE, aiCore: regelnPY });

// Der Verlust-Satz gehoert NUR in die zwei PvP-Einleitungen (dritte Messung, 05.09.2026): In den
// gemeinsamen Regeln erreichte er auch Weltboss, Festung und Koenigin, die das Datum
// "verluste: nicht bekannt" gar nicht haben - der Koeniginnen-Text schrieb ihn woertlich ab und
// behauptete damit das Gegenteil der Daten. Geprueft wird die STELLE, nicht der Wortlaut: dass er
// in den gemeinsamen Regeln FEHLT ist die Haelfte, die den Fehler gefunden haette.
const VERLUSTSATZ = /NICHTS ueber Verluste/;
check('6-verlustsatz-regeln: der Verlust-Satz steht in KEINEM der beiden gemeinsamen Regelbloecke',
  !VERLUSTSATZ.test(regelnBE) && !VERLUSTSATZ.test(regelnPY), { backend: VERLUSTSATZ.test(regelnBE), aiCore: VERLUSTSATZ.test(regelnPY) });
for (const art of ARTEN) {
  const naechste = ARTEN[ARTEN.indexOf(art) + 1];
  const be = e2Text(BE.slice(iEinBE), (art.indexOf('-') >= 0 ? "'" + art + "':" : art + ':'), naechste ? (naechste.indexOf('-') >= 0 ? "'" + naechste + "':" : '\n  ' + naechste + ':') : '\n};', 'Du bist');
  const py = e2Text(PY.slice(iEinPY), '"' + art + '": (', naechste ? '"' + naechste + '": (' : '\n}', 'Du bist');
  const soll = art.indexOf('pvp') === 0;
  check('6-verlustsatz-' + art + ': der Satz steht ' + (soll ? 'in' : 'NICHT in') + ' dieser Einleitung, in beiden Repos',
    VERLUSTSATZ.test(be || '') === soll && VERLUSTSATZ.test(py || '') === soll,
    { backend: VERLUSTSATZ.test(be || ''), aiCore: VERLUSTSATZ.test(py || '') });
}

console.log('');
console.log(fail ? 'FEHLGESCHLAGEN' : 'Alles gruen.');
process.exit(fail ? 1 : 0);
