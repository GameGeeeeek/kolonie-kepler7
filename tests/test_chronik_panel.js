// Die Galaxie-Chronik im Weltlage-Panel (C3, 06.09.2026).
//
// Der Text kommt vom KI-Server im Heimnetz ueber das Backend (db.galaxy.chronikAusgabe,
// Backend-PR #261) und ist die einzige Zeile im Panel, die erzaehlt statt zu melden.
//
// GEPRUEFT WIRD DIE REGEL, NICHT DIE ZEILE: Der Block wird aus der Spieldatei geschnitten und
// AUSGEFUEHRT - mit gestelltem galaxyCache. Eine reine Textsuche im Quelltext koennte nicht
// unterscheiden, ob der Kasten bei fehlender Ausgabe entfaellt oder leer erscheint, und genau das
// ist hier die Aussage.
//
//   1  Ohne Ausgabe kein Kasten - und auch keine Signatur, die den Fall vom Vorhandensein
//      unterscheidbar machen wuerde.
//   2  Mit Ausgabe: Text da, Datum da, ueber der Weltlage.
//   3  Der Text wird MASKIERT - das Backend saeubert bereits, hier ist die zweite Stelle.
//   4  Zeilenumbrueche traegt CSS (white-space:pre-line), nicht <br> - so entsteht kein Markup.
//   5  Nach zwei Wochen sagt der Kasten, dass keine neue Ausgabe kam, statt eine alte still
//      als aktuelle weiterzufuehren.
//   6  Die Signatur enthaelt die Ausgabe - sonst schriebe das Panel bei einer NEUEN Ausgabe nicht
//      neu, weil sich Weltlage und Kopfgeld nicht geaendert haben. Genau die Falle, die dieses
//      Panel mit seinem Signatur-Vergleich baut.
//
// GEGENPROBE (06.09.2026, beidseitig ausgefuehrt): Ohne den Block faellt 0-anker und der Lauf
// endet; ohne escapeHtml faellt 3; mit <br>-Ersetzung statt CSS faellt 4; ohne chronikSig in den
// beiden Signatur-Zeilen faellt 6; ohne die 14-Tage-Zeile faellt 5.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// Beide Anker vor dem Schneiden pruefen (Hausregel): fehlt einer, liefe der Slice bis ans
// Dateiende und jede Pruefung darunter waere vacuous statt rot.
const von = JS.indexOf("    let chronikHtml = '', chronikSig = 'none';");
const bis = von < 0 ? -1 : JS.indexOf("    let weltlageHtml = '', weltlageSig = 'none';", von);
check('0-anker: der Chronik-Block laesst sich schneiden (beide Anker existieren)', von > 0 && bis > von, { von, bis });
if (von < 0 || bis < 0) return ende();
const BLOCK = JS.slice(von, bis);

// Ausfuehren statt lesen. escapeHtml wird gestellt - der Test misst, DASS maskiert wird, nicht wie
// die Maskierung der Spieldatei im Einzelnen aussieht (die hat ihre eigenen Tests).
const bau = new Function('galaxyCache', 'jetzt', `
  const _urspruenglich = Date.now;
  Date.now = () => jetzt;
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  try {
    ${BLOCK}
    return { chronikHtml, chronikSig };
  } finally { Date.now = _urspruenglich; }
`);

/* Eine Notbremse um jeden Lauf. Der Block wird AUSGEFUEHRT, und ein sabotierter Stand kann werfen
   statt ein falsches Ergebnis zu liefern - gemessen beim Bau: Ohne die Typpruefung im Block wirft
   `chr.text.trim()` bei einem Eintrag ohne Text, die Datei bricht mitten im Lauf ab, und die
   Pruefungen danach fallen ersatzlos aus. Exit 1 faengt das zwar, aber ein Abbruch ist keine
   Diagnose: Er nennt nicht, WELCHE Regel gebrochen ist, und verbirgt die uebrigen. Die
   Abbruchbedingung gehoert in die Messvorrichtung, nicht nur in den Pruefling (Lektion 14 des
   AI-Core-Repos). Ein Wurf wird deshalb zu einem Ergebnis, das keine Pruefung besteht. */
const sicher = (cache, jetzt) => {
  try { return bau(cache, jetzt); }
  catch (e) { return { chronikHtml: '[WURF] ' + e.message, chronikSig: '[WURF]', wurf: String(e.message) }; }
};

const JETZT = Date.parse('2026-09-06T20:00:00Z');
const AUSGABE = { woche: '2026-KW36', text: 'Die Festung bei Chronos fiel.\n\nDanach blieb es still.', erstellt: JETZT - 3600000 };

// ---- 1: ohne Ausgabe kein Rahmen ---------------------------------------------------------------
{
  const leer = sicher({}, JETZT);
  check('1a: ohne Ausgabe entfaellt der Kasten ERSATZLOS', leer.chronikHtml === '', { html: leer.chronikHtml });
  check('1b: ... und die Signatur sagt das auch', leer.chronikSig === 'none', { sig: leer.chronikSig });
  // Die drei Faelle, in denen das Backend nichts oder Unbrauchbares liefern kann.
  for (const [name, wert] of [['null', null], ['ohne text', { woche: 'x' }], ['leerer text', { woche: 'x', text: '   ' }]]) {
    const r = sicher({ chronikAusgabe: wert }, JETZT);
    check('1c: auch bei "' + name + '" bleibt der Kasten weg - und der Block wirft dabei nicht',
      r.chronikHtml === '' && !r.wurf, { html: r.chronikHtml, wurf: r.wurf });
  }
}

// ---- 2: mit Ausgabe ----------------------------------------------------------------------------
{
  const a = sicher({ chronikAusgabe: AUSGABE }, JETZT);
  check('2a: der Text steht im Kasten', a.chronikHtml.includes('Die Festung bei Chronos fiel.'), { html: a.chronikHtml.slice(0, 120) });
  check('2b: das Datum steht dabei - sonst saehe eine alte Ausgabe aus wie die aktuelle',
    /Ausgabe vom 06\.09\.2026/.test(a.chronikHtml), { html: a.chronikHtml.slice(0, 200) });
  check('2c: die Signatur haengt an Woche UND Zeitpunkt', a.chronikSig === 'chr:2026-KW36:' + AUSGABE.erstellt, { sig: a.chronikSig });
  check('2d: das Icon stammt aus der 69er-Whitelist', a.chronikHtml.includes('ti-building-broadcast-tower'));
}

// ---- 3: der Text wird maskiert -----------------------------------------------------------------
{
  const boese = { woche: '2026-KW36', text: '<img src=x onerror=alert(1)> und <b>fett</b>', erstellt: JETZT };
  const a = sicher({ chronikAusgabe: boese }, JETZT);
  check('3: der Modelltext wird maskiert - zweite Stelle neben der Saeuberung im Backend',
    !a.chronikHtml.includes('<img') && !a.chronikHtml.includes('<b>') && a.chronikHtml.includes('&lt;img'),
    { html: a.chronikHtml.slice(-160) });
}

// ---- 4: Zeilenumbrueche ueber CSS, nicht ueber Markup -------------------------------------------
{
  const a = sicher({ chronikAusgabe: AUSGABE }, JETZT);
  check('4a: Zeilenumbrueche traegt white-space:pre-line', a.chronikHtml.includes('white-space:pre-line'));
  check('4b: ... und es wird KEIN <br> in den Text gesetzt - so entsteht gar kein Markup',
    !/<br\s*\/?>/i.test(a.chronikHtml) && a.chronikHtml.includes('fiel.\n\nDanach'), { html: a.chronikHtml.slice(-200) });
}

// ---- 5: eine alte Ausgabe wird als alt benannt --------------------------------------------------
{
  const frisch = sicher({ chronikAusgabe: Object.assign({}, AUSGABE, { erstellt: JETZT - 13 * 86400000 }) }, JETZT);
  const alt = sicher({ chronikAusgabe: Object.assign({}, AUSGABE, { erstellt: JETZT - 15 * 86400000 }) }, JETZT);
  check('5a: bis zwei Wochen steht nur das Datum', !frisch.chronikHtml.includes('keine neue Ausgabe'));
  check('5b: danach sagt der Kasten, dass keine neue kam - statt eine alte still weiterzufuehren',
    alt.chronikHtml.includes('seither keine neue Ausgabe'), { html: alt.chronikHtml.slice(0, 220) });
}

// ---- 6: die Signatur des Panels kennt die Chronik ----------------------------------------------
// Ohne das schriebe das Panel bei einer NEUEN Ausgabe nicht neu, solange sich Weltlage und
// Kopfgeld nicht geaendert haben - der Spieler saehe die Ausgabe der Vorwoche bis zum Neuladen.
{
  const leerSig = JS.indexOf("const emptySig='empty|");
  const vollSig = JS.indexOf("const newsSig = ");
  check('6-anker: beide Signatur-Zeilen gefunden', leerSig > 0 && vollSig > 0, { leerSig, vollSig });
  if (leerSig > 0 && vollSig > 0) {
    check('6a: die Signatur des leeren Falls enthaelt die Chronik',
      JS.slice(leerSig, leerSig + 120).includes('chronikSig'), { zeile: JS.slice(leerSig, leerSig + 90) });
    check('6b: die Signatur des vollen Falls ebenfalls',
      JS.slice(vollSig, vollSig + 120).includes('chronikSig'), { zeile: JS.slice(vollSig, vollSig + 90) });
    // Seit dem Galaxie-Ziel (11.09.2026) steht dessen Karte ZWISCHEN Chronik und Weltlage
    // (`chronikHtml + zielHtml + weltlageHtml`) - die Chronik bleibt ganz oben, und genau das
    // misst diese Pruefung: der Kasten haengt in beiden Ausgabewegen, an erster Stelle.
    check('6c: und der Kasten wird in BEIDE Ausgabewege eingehaengt',
      (JS.match(/chronikHtml \+ (?:zielHtml \+ )?weltlageHtml \+ bountyHtml/g) || []).length === 2,
      { treffer: (JS.match(/chronikHtml \+ (?:zielHtml \+ )?weltlageHtml \+ bountyHtml/g) || []).length });
  }
}

ende();
