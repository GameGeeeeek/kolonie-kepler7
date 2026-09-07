#!/usr/bin/env node
/* Beschreibungstexte: gibt es sie, und werden sie ANGEZEIGT?
 *
 *   node check-texte.js
 *
 * WARUM DIESE PRUEFUNG DIE ANZEIGESTELLE MISST UND NICHT DAS FELD.
 * `docs/content-ideen.md` (Abschnitt 8) hat eine Beschreibungs-Pruefung vorgeschlagen: alle
 * DEFS-Arrays auf leere oder zu kurze `desc`-Felder abklopfen. Beim Nachmessen am 07.09.2026 hat
 * sich gezeigt, dass genau diese Regel hier falsch waere:
 *
 *   SHIP_DEFS hat 64 Eintraege und nur 9 `desc`-Felder. Die anderen 55 Schiffe sind trotzdem
 *   erklaert - ihre Texte stehen in einer handgeschriebenen if/else-Kette in der Werft. Eine
 *   Pruefung "jeder Eintrag braucht ein desc" haette 55 Schiffe angemahnt, die keinen Mangel
 *   haben, und waere damit die Art von Pruefung, die man nach drei Tagen abschaltet.
 *
 * Der Fehler, den dieses Projekt WIRKLICH zweimal gemacht hat, ist ein anderer, und
 * `tests/test_schiffstexte.js` haelt ihn im Kopf fest: DAS FELD OHNE ANZEIGESTELLE. Der Text war
 * geschrieben, vollstaendig und selbsterklaerend - er wurde nur nirgends gerendert. Erst
 * `def.desc` (bis v8.347.0), dann `nicheDesc` (bis v8.150-irgendwas). Zweimal derselbe Fehler,
 * zweimal ein anderer Feldname, beide Male von einem Spieler gemeldet statt von einer Pruefung.
 *
 * DIE REGEL LAUTET DESHALB: Ein Textfeld, das in einer Inhaltstabelle geschrieben wird, muss
 * mindestens eine Stelle haben, die es liest. Ein Feld ohne Leser ist toter Text - egal, wie gut
 * er geschrieben ist.
 *
 * WIE GEZAEHLT WIRD, und warum ohne Blockgrenzen: Eine Definition steht als `feld:`, eine
 * Lesestelle als `.feld` oder `['feld']`. Die beiden Schreibweisen sind lexikalisch verschieden,
 * die Pruefung braucht also gar nicht zu wissen, wo eine Tabelle anfaengt und aufhoert. Ein
 * erster Entwurf hat genau das versucht (Tabellenbloecke abgrenzen, Lesestellen ausserhalb
 * zaehlen) und meldete `lostText` und `ownLostText` als tot - beide werden gelesen, die
 * Blockgrenzen waren daneben. Zwei Fehlalarme von drei Befunden; die Blockrechnung ist deshalb
 * ersatzlos entfallen.
 */
const fs = require('fs');
const path = require('path');

const DATEI = process.env.KEPLER_SPIELDATEI || path.join(__dirname, 'weltraum_kolonie.html');
const html = fs.readFileSync(DATEI, 'utf8');

/* Textfelder erkennen wir am Namen. Die Liste ist bewusst eine Endungs-Regel und keine
   Aufzaehlung: Der naechste Fehler dieser Art wird ein Feld tragen, das es heute nicht gibt -
   `nicheDesc` gab es beim ersten Mal auch noch nicht. */
const TEXT_ENDUNG = /^(desc|text|lore|motto|hinweis|kurz)$|^[a-z][a-zA-Z0-9]*(Desc|Text|Lore|Motto|Hinweis|Kurz)$/;
/* DIE WORTGRENZE IST NICHT KOSMETIK. Ein erster Entwurf liess die Endung auch klein zu
   (`...lore`) und meldete daraufhin `explore` als toten Text - das Wort endet zufaellig auf
   "lore". Ein Feldname traegt seinen Zweck entweder ALS ganzes Wort (`desc`, `lore`) oder als
   angehaengtes Wort in Binnengrossschreibung (`nicheDesc`, `lostText`); alles dazwischen ist
   ein Zufallstreffer. */

/* Felder, die KEINE Anzeigestelle brauchen - jedes mit Grund. Ohne diese Liste meldet die Pruefung
   Treffer, die keine sind, und wird abgeschaltet statt gelesen. */
const AUSNAHMEN = {
  // (heute leer - jeder Eintrag hier gehoert mit Datum und Grund dokumentiert)
};

// 1) Alle geschriebenen Textfelder einsammeln: `feld:` in Objektliteralen.
const geschrieben = new Map();          // feld -> Anzahl Definitionen
for (const m of html.matchAll(/[{,]\s*([a-zA-Z][a-zA-Z0-9]*)\s*:/g)) {
  const f = m[1];
  if (!TEXT_ENDUNG.test(f)) continue;
  geschrieben.set(f, (geschrieben.get(f) || 0) + 1);
}

// 2) Fuer jedes Feld: gibt es eine Lesestelle? `.feld` oder `['feld']` oder `["feld"]`.
const tot = [];
for (const [f, n] of geschrieben) {
  if (f in AUSNAHMEN) continue;
  const lese = new RegExp('\\.' + f + '\\b|\\[\\s*[\'"]' + f + '[\'"]\\s*\\]', 'g');
  const treffer = (html.match(lese) || []).length;
  if (treffer === 0) tot.push({ feld: f, definiert: n });
}

let fehler = false;
if (tot.length) {
  fehler = true;
  console.error('\nTEXT OHNE ANZEIGESTELLE - geschrieben, aber nirgends gelesen:');
  for (const t of tot) {
    console.error('  ' + t.feld + '  (' + t.definiert + ' Definition' + (t.definiert === 1 ? '' : 'en') + ', 0 Lesestellen)');
  }
  console.error('\nEntweder das Feld anzeigen - oder es entfernen. Ein dritter Weg waere ein Text,');
  console.error('den nie jemand sieht; genau das ist diesem Projekt schon zweimal passiert.');
  console.error('Braucht das Feld wirklich keine Anzeigestelle, gehoert es mit Grund und Datum');
  console.error('in die Liste AUSNAHMEN am Kopf von check-texte.js.\n');
} else {
  console.log('Textfelder: ' + geschrieben.size + ' Namen, alle mit mindestens einer Anzeigestelle.');
}

process.exit(fehler ? 1 : 0);
