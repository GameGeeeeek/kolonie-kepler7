// Sternenessenz ist die einzige Waehrung, die JEDEN Reset ueberlebt - also darf keine Marke,
// die sie auszahlt, an einem Reset verlorengehen (03.09.2026).
//
//   node tests/test_essenzmarken.js
//
// DER ANLASS: Das Spiel hat DREI Reset-Ausgaenge - Prestige, Aufstieg und den kompletten
// Zuruecksetzen-Knopf. Alle drei behalten die Sternenessenz. Die MARKEN, die festhalten, was
// bereits ausgezahlt wurde, ueberlebten aber nur die ersten beiden; der dritte baut den Zustand
// aus einem eigenen, kuerzeren Literal neu auf. Wer ihn drueckte, konnte dieselben Belohnungen
// ein zweites Mal einloesen - gemessen 320 Essenz je Durchlauf.
//
// Dass das lange niemandem auffiel, hat einen Grund: Der Vollreset loescht auch die SAMMLUNGEN
// hinter den Marken. Nichts ist sofort wieder faellig, alles muss neu erarbeitet werden, und der
// Knopf kostet dabei den ganzen Account. Es war also nie ein lohnender Exploit - aber die Regel
// galt an zwei von drei Ausgaengen, und genau das prueft diese Datei.
//
// WARUM DIE LISTE HIER STEHT UND TROTZDEM NICHT VERALTET: Welche Marke eine Auszahlung bewacht,
// laesst sich nicht zuverlaessig aus dem Text ableiten - dafuer stehen Marke und Auszahlung zu
// weit auseinander. Abschnitt 0 zaehlt deshalb die AUSZAHLUNGSSTELLEN und verlangt, dass jede
// von ihnen unten eingeordnet ist. Eine sechste Quelle laesst diesen Test fallen, bis jemand sie
// einordnet - sie kann nicht still dazukommen.
//
// (Zwei fruehere Anlaeufe dieser Messung waren unvollstaendig: Sie suchten nur nach `essence:` in
// den offensichtlichen Tabellen und fanden zwei Marken statt fuenf, 184 Essenz statt 320. Deshalb
// zaehlt der Test die Auszahlungen, nicht die Tabellen.)
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 0) Jede Auszahlungsstelle ist eingeordnet -------------------------------------------------
/* Jede Marke MIT ihrer Auszahlung. `feld` ist der Pfad im Spielstand, den ein Reset mitnehmen
   muss; `essenz` die gemessene Summe (sie steht hier als Groessenordnung, nicht als Pruefwert -
   geprueft wird die Mitnahme, nicht der Betrag). */
const MARKEN = [
  { feld: 'compendiumClaimed',   essenz: 57,  wo: 'claimCompendium'          },
  { feld: 'researchMilestones',  essenz: 127, wo: 'checkResearchMilestones'  },
  { feld: 'codexClaimed',        essenz: 54,  wo: 'claimCodexTier'           },
  { feld: 'abgrund.meilensteine',essenz: 58,  wo: 'checkAbgrundMeilensteine' },
  { feld: 'statthalterKills',    essenz: 24,  wo: 'Erstsieg gegen einen Statthalter' }
];
/* Die Auszahlungen OHNE Marke - hier ausdruecklich benannt, damit sie nicht als Luecke zaehlen
   und niemand sie "vervollstaendigt":
     1. Der Wrackkonvoi zahlt anteilig Essenz aus einer pendingReward des SERVERS. Der Server hat
        den Eintrag beim Abholen bereits geloescht; eine Marke im Spielstand gaebe es dafuer nicht
        zu bewachen.
     2. Der AUFSTIEG selbst (asc.essence += gain) - das ist der Lohn fuer den Aufstieg, keine
        einloesbare Belohnung. Die "Marke" ist der Aufstieg, und der setzt ohnehin alles zurueck. */
const OHNE_MARKE = 2;

/* GEZAEHLT WIRD JEDE ZUWEISUNG AN EIN FELD NAMENS `essence`, nicht eine Schreibweise.
   Der erste Entwurf suchte woertlich nach
   `state.ascension.essence = (state.ascension.essence || 0) + …` - gemeldet von der
   Codex-Pruefung an PR #561 (P2) mit dem Hinweis, ein `+=` rutsche durch. Nachgemessen war es
   schlimmer als gemeldet: Eine SIEBTE Auszahlung gab es damals schon, und sie rutschte bereits
   durch - der Aufstieg schreibt ueber einen Alias (`asc.essence = (asc.essence||0) + gain`).
   Der Waechter, der jede Quelle einordnen wollte, war also selbst blind fuer eine.
   DIE BENANNTE RESTLUECKE: Ein Zugriff ueber `['essence']` oder ueber eine Hilfsfunktion, die
   den Feldnamen nicht im Text traegt, faellt hier weiterhin nicht auf. Das ist kein Versehen,
   sondern die Grenze einer Textpruefung - sie steht hier, statt verschwiegen zu werden. */
const auszahlungen = (JS.match(/\.essence\s*\+?=[^=]/g) || []).length;
check('0: JEDE Zuweisung an ein essence-Feld ist unten eingeordnet',
  auszahlungen === MARKEN.length + OHNE_MARKE,
  { gefunden: auszahlungen, eingeordnet: MARKEN.length + OHNE_MARKE,
    hinweis: 'Kommt eine Quelle dazu, gehoert sie in MARKEN (mit ihrer Marke) oder in die Begruendung von OHNE_MARKE' });
/* Gegenprobe im selben Durchgang: Die alte, enge Schreibweise findet WENIGER als die neue. Ohne
   diese Zeile koennte jemand den Ausdruck oben wieder verengen, und Pruefung 0 bliebe gruen,
   solange er die Zahl daneben mitzieht. */
const engGezaehlt = (JS.match(/state\.ascension\.essence\s*=\s*\(state\.ascension\.essence\s*\|\|\s*0\)\s*\+/g) || []).length;
check('0b: die enge Schreibweise wuerde weniger finden - der weite Ausdruck ist noetig',
  engGezaehlt < auszahlungen, { eng: engGezaehlt, weit: auszahlungen });

// ---- 1) Die drei Reset-Ausgaenge ---------------------------------------------------------------
/* Geschnitten wird jeweils das Zustands-Literal, aus dem der Reset den neuen Spielstand baut -
   plus die Zeilen davor, in denen die keep*-Variablen entstehen. Beides zusammen ist der Ort, an
   dem eine Mitnahme steht; fehlt das Feld dort, legt applyStateDefaults() es leer an. */
function ausgang(name, anker){
  const i = JS.indexOf(anker);
  if (i < 0) return null;
  /* Geschnitten wird bis zur naechsten Funktion auf oberster Ebene, NICHT bis zum ersten
     `applyStateDefaults`: Alle drei Ausgaenge ERWAEHNEN den Namen in einem Kommentar, bevor sie
     ihn aufrufen. Der erste Entwurf schnitt daran ab und bekam Stuecke ohne das Zustands-Literal -
     alle fuenf Pruefungen fielen bei richtigem Code. Abschnitt 1b faengt genau das ab. */
  const bis = JS.indexOf('\n  function ', i + anker.length);
  return bis < 0 ? null : { name, text: JS.slice(i, bis) };
}
const AUSGAENGE = [
  ausgang('Prestige',   '  function confirmPrestigeWithPerk('),
  ausgang('Aufstieg',   '  function ascendWithPath('),
  ausgang('Vollreset',  "  document.getElementById('resetBtn').addEventListener")
].filter(Boolean);
check('1-anker: alle drei Reset-Ausgaenge lassen sich schneiden',
  AUSGAENGE.length === 3, AUSGAENGE.map(a => a.name));
/* Ohne diese Zeile waere der Test bei einem misslungenen Schnitt ROT statt UNBRAUCHBAR - und das
   sieht gleich aus. Sie sagt, welches der beiden es ist. */
check('1b-anker: jeder Schnitt enthaelt wirklich das Zustands-Literal des Resets',
  AUSGAENGE.every(a => /state\s*=\s*\{/.test(a.text)),
  AUSGAENGE.map(a => a.name + ':' + (/state\s*=\s*\{/.test(a.text) ? 'ok' : 'OHNE LITERAL')));

if (AUSGAENGE.length === 3){
  for (const m of MARKEN){
    // Der Abgrund wird als BLOCK mitgenommen (abgrundUeberReset) oder gezielt als
    // { meilensteine: … } - beide Formen zaehlen, geprueft wird das Feld, nicht die Schreibweise.
    const suche = m.feld === 'abgrund.meilensteine'
      ? (t => /abgrundUeberReset\(/.test(t) || /meilensteine\s*:/.test(t))
      : (t => new RegExp('\\b' + m.feld + '\\s*:').test(t) && !new RegExp('\\b' + m.feld + '\\s*:\\s*(\\{\\s*\\}|\\[\\s*\\])').test(t));
    const fehlend = AUSGAENGE.filter(a => !suche(a.text)).map(a => a.name);
    check('1: ' + m.feld + ' (' + m.essenz + ' Essenz, ' + m.wo + ') ueberlebt ALLE drei Resets',
      fehlend.length === 0, { fehlt_bei: fehlend });
  }
}

// ---- 2) Der Bestaetigungstext sagt, was wirklich bleibt -----------------------------------------
/* Er versprach bis v8.656.0 "Nur Sternenessenz und Meta-Baum aus Aufstiegen bleiben erhalten" und
   war damit falsch, sobald die erste Marke mitgenommen wurde. Ein Dialog, der etwas anderes
   verspricht als der Code tut, ist die gefaehrlichere Haelfte dieses Fehlers: Er wird geglaubt. */
const dlgI = JS.indexOf("document.getElementById('resetBtn')");
const dlg = dlgI < 0 ? '' : JS.slice(dlgI, JS.indexOf('\n', JS.indexOf('confirm(', dlgI)));
check('2-anker: der Bestaetigungstext des Vollresets laesst sich lesen', dlg.length > 80, dlg.length);
check('2: er behauptet nicht mehr, dass NUR Sternenessenz und Meta-Baum bleiben',
  dlg.length > 80 && !/Nur Sternenessenz und Meta-Baum/.test(dlg), dlg.slice(0, 160));
check('2b: und zaehlt auf, dass die Marken eingeloester Belohnungen bleiben',
  /Marken bereits eingelöster Belohnungen/.test(dlg) && /Kompendium/.test(dlg), {});
/* Die Kehrseite gehoert ebenfalls in den Text, sonst verspricht er zu viel: Die Sammlungen
   selbst fangen neu an - eine Kategorie kann danach als "abgeholt" markiert auf 0 stehen. */
check('2c: und sagt die Kehrseite dazu - die Sammlungen selbst fangen neu an',
  /Sammlungen selbst fängst du neu an/.test(dlg), {});
/* Und die AUSNAHME davon (Codex-Pruefung P2 an PR #561): Bei den Statthaltern ist die Marke
   zugleich die Sammlung - die Kompendium-Kategorie zaehlt ueber statthalterErstsiege() dieselbe
   Liste, die der Vollreset mitnimmt. Der pauschale Satz "die Sammlungen fangen neu an" waere fuer
   sie falsch, und zwar in dem Dialog, der vor einer nicht umkehrbaren Aktion warnt. */
check('2d: und nennt die Statthalter als Ausnahme - ihre Erstsiege SIND die Sammlung',
  /bis auf die Statthalter/.test(dlg), dlg.slice(-220));
check('2d-beleg: die Kompendium-Kategorie zaehlt wirklich dieselbe mitgenommene Liste',
  /have:\(\)=>statthalterErstsiege\(\)/.test(JS) && /statthalterKills\s*:\s*keepStatthalterKills/.test(JS), {});

ende();
