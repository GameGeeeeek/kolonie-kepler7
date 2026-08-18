// Inventar-Sortierung (v8.448.0, Task #39): EIN Vergleich fuer beide Modul-Inventare -
// Seltenheit absteigend -> Modultyp -> Stufe absteigend -> Hauptwert-Wurf absteigend.
//
// Vorher galt ab gleicher Seltenheit der rohe instKey alphabetisch: Stufe "3" stand hinter
// Stufe "2" nur bei einstelligen Nachbarn richtig herum, "10" ordnete vor "2", und der
// Wert-Wurf (w-Token im Substat-Segment) stand zufaellig - seit der Wert-Streuung (v8.444.0)
// ist aber genau der Vergleich "welches der drei gleichen behalte ich?" der haeufigste.
//
// GEPRUEFT WIRD (der Vergleich AUSGEFUEHRT, mit den ECHTEN moduleLevelOf/moduleWertOf und der
// ECHTEN MODULE_RARITY-Reihenfolge aus der Spieldatei - nichts davon geraten, Regel 2/4):
//   1) Extraktion + beide Inventare nutzen denselben Vergleich (keine Inline-Kopien mehr).
//   2) Rangfolge: Seltenheit schlaegt Typ schlaegt Stufe schlaegt Wert; Ketten-Fixture.
//   3) Die beiden Faelle, die die ALTE Sortierung falsch ordnete: Stufe 3 vor Stufe 2
//      (alphabetisch stand 2 zuerst) und hoher Wert-Wurf vor niedrigem trotz "spaeterem"
//      Substat-Praefix.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.447.0) fallen 1a/1b durch - moduleInvVergleich existiert dort nicht.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

/* Der PATCHNOTES-Block wird fuer die verneinenden und die zaehlenden Pruefungen unten
   herausgeschnitten (CLAUDE.md Regel 46). Grund: Ein Patchnote, der eine Behebung beschreibt,
   ZITIERT die alte Formulierung - und reisst damit genau die Pruefung, die diese Behebung
   festhaelt. Patchnotes sind unveraenderliche Historie, man kann den Wortlaut dort also nicht
   anpassen; die Pruefung muss sich anpassen.
   Die Regel gilt nicht nur fuer "steht NICHT mehr da": Auch ein ZAEHLER wird falsch, sobald ein
   Patchnote den gesuchten Text erwaehnt - in beide Richtungen. */
const JS_OHNE_HISTORIE = (() => {
  const v = JS.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : JS.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? JS.slice(0, v) + JS.slice(b) : JS;
})();

// ---- 1) Extraktion + Verdrahtung
const von = JS.indexOf('function moduleInvVergleich(a, b){');
const bis = von < 0 ? -1 : JS.indexOf('\n  }', von);
check('1a: moduleInvVergleich gefunden', von > 0 && bis > von);
if (von < 0) return ende();
const quelle = JS.slice(von, bis + 4);
const nutzungen = (JS.match(/invKeys\.sort\(moduleInvVergleich\)/g) || []).length;
check('1b: BEIDE Inventare (Standort + Klasse) nutzen denselben Vergleich', nutzungen === 2, nutzungen);
check('1c: die alten Inline-Kopien sind weg (kein Drift-Risiko)',
  !JS_OHNE_HISTORIE.includes('rarityRankDesc') && !JS_OHNE_HISTORIE.includes('rarityRankShip'));

// ---- Sandbox mit den ECHTEN Helfern aus der Spieldatei
// MODULE_RARITY-Reihenfolge aus der Datei ziehen (nie aus dem Gedaechtnis, Regel 4). Der
// indexOf-Endanker wird gegen die naechste const-Zeile verifiziert, bevor gesliced wird.
const rarVon = JS.indexOf('const MODULE_RARITY = {');
const rarBis = rarVon < 0 ? -1 : JS.indexOf('};', rarVon);
check('1d: MODULE_RARITY-Block gefunden', rarVon > 0 && rarBis > rarVon);
const rarBlock = JS.slice(rarVon, rarBis);
const rarKeys = [...rarBlock.matchAll(/^\s{4}(\w+):\s*\{/gm)].map(m => m[1]);
// Auf die REGEL umgestellt: Die Sortierung braucht eine Aufwaertsfolge, die bei Gewoehnlich
// beginnt - nicht eine bestimmte Laenge. Exotisch ist seit dem 16.08.2026 nicht mehr das Ende
// (Primordial steht darueber), die gepruefte Eigenschaft gilt aber unveraendert.
check('1e: die Seltenheits-Reihenfolge beginnt bei Gewoehnlich und enthaelt alle bekannten Stufen',
  rarKeys.length >= 7 && rarKeys[0] === 'gewoehnlich'
  && ['gewoehnlich','ungewoehnlich','selten','episch','legendaer','mythisch','exotisch'].every((k,i) => rarKeys[i] === k), rarKeys);

const levelVon = JS.indexOf('function moduleLevelOf(instKey){');
const wertVon = JS.indexOf('function moduleWertOf(instKey){');
const wertBis = wertVon < 0 ? -1 : JS.indexOf('\n  }', wertVon);
check('1f: echte Parser-Helfer gefunden', levelVon > 0 && wertVon > 0 && wertBis > wertVon);
const levelZeile = JS.slice(levelVon, JS.indexOf('\n', levelVon));
const wertQuelle = JS.slice(wertVon, wertBis + 4);
const konstanten = [
  JS.match(/const MODULE_LEVEL_MAX = \d+;/)[0],
  JS.match(/const MODULE_WERT_MIN = \d+, MODULE_WERT_MAX = \d+;/)[0]
].join('\n');
const RARITY_STUB = '{' + rarKeys.map(k => k + ':{}').join(',') + '}';
const vergleich = new Function(
  konstanten + '\nconst MODULE_RARITY = ' + RARITY_STUB + ';\n'
  + levelZeile + '\n' + wertQuelle + '\n' + quelle + '\nreturn moduleInvVergleich;')();

// ---- 2) Rangfolge als Ketten-Fixture (bewusst verwuerfelt uebergeben)
{
  const erwartet = [
    'waffen:exotisch',                 // Seltenheit schlaegt alles
    'bergbau:selten:5',                // gleicher Rang: Typ alphabetisch vor waffen
    'waffen:selten:10:atk4.w93',       // Stufe 10 vor Stufe 3
    'waffen:selten:3',                 // Stufe 3 vor Stufe 2 (alte Sortierung: umgekehrt)
    'waffen:selten:2',
    'waffen:selten:1:def4.w107',       // gleicher Typ/Stufe: bester Wurf zuerst
    'waffen:selten:1:atk4.w93',        //   (alte Sortierung: atk4 vor def4 -> 93 zuerst)
    'waffen:selten',                   // ohne Segmente = Stufe 1, Wert 100 -> zwischen 107 und 93? NEIN:
                                       //   100 < 107 und > 93 - Position wird unten separat geprueft
    'lager:gewoehnlich'
  ];
  // Regel 7: nicht die eigene Erwartungsliste "messen" - die Positionsfrage fuer 'waffen:selten'
  // (Wert 100) wird explizit gerechnet statt in der Kette versteckt.
  const kette = ['waffen:selten:2', 'lager:gewoehnlich', 'waffen:selten:1:atk4.w93',
                 'waffen:selten:10:atk4.w93', 'bergbau:selten:5', 'waffen:exotisch',
                 'waffen:selten:3', 'waffen:selten:1:def4.w107'];
  const sortiert = [...kette].sort(vergleich);
  check('2a: Seltenheit -> Typ -> Stufe -> Wert, am verwuerfelten Fixture',
    JSON.stringify(sortiert) === JSON.stringify(erwartet.filter(k => k !== 'waffen:selten')),
    sortiert);
  check('2b: Wert 100 (kein w-Token) sortiert zwischen 107 und 93',
    vergleich('waffen:selten:1:def4.w107', 'waffen:selten') < 0 &&
    vergleich('waffen:selten', 'waffen:selten:1:atk4.w93') < 0);
}

// ---- 3) Genau die Faelle, die die alte Sortierung falsch ordnete
{
  check('3a: Stufe 3 steht vor Stufe 2 (alphabetisch stand "2" zuerst)',
    vergleich('waffen:selten:3', 'waffen:selten:2') < 0 &&
    ['waffen:selten:2', 'waffen:selten:3'].sort((a, b) => a.localeCompare(b))[0] === 'waffen:selten:2');
  check('3b: hoher Wert-Wurf steht vor niedrigem, auch wenn sein Substat-Praefix spaeter kommt',
    vergleich('waffen:selten:1:def4.w107', 'waffen:selten:1:atk4.w93') < 0 &&
    ['waffen:selten:1:def4.w107', 'waffen:selten:1:atk4.w93'].sort((a, b) => a.localeCompare(b))[0] === 'waffen:selten:1:atk4.w93');
  // Stabilitaet: voellig gleiche Schluessel sind neutral (0), sonst wuerde sort() flackern.
  check('3c: identische Schluessel vergleichen neutral',
    vergleich('waffen:selten:2', 'waffen:selten:2') === 0);
}

ende();
