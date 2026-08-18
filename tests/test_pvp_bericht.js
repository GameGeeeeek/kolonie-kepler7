// Zwei Anzeigestellen, die eine alte Annahme behalten hatten (Konsistenz-Audit 01.08.2026).
//
//   A) DER PvP-KAMPFBERICHT ZEIGTE WEDER PHASEN NOCH KONTER NOCH AUFSTELLUNG. Der Server schickt
//      alle drei Felder (phasen, counterMult, formation/formationMult) seit dem Phasen-Umbau in
//      JEDEM der vier PvP-Berichte mit - gerendert wurden sie nur im NPC-Bericht und im Ueberfall.
//      Die Hilfe verspricht an drei Stellen ausdruecklich, dass der Kampfbericht jede Phase einzeln
//      zeigt und sagt, wie stark der Konter gewirkt hat. Ausgerechnet im Spieler-gegen-Spieler-
//      Bericht - dem einzigen Rueckkanal, an dem man seine Aufstellung bewerten kann - stand
//      stattdessen ein nackter Zahlenvergleich, der seit v8.295.0 nicht mehr erklaert, wie der
//      Kampf ausgegangen ist.
//
//   B) ZWEI TEXTE BEHAUPTETEN, FLOTTENVERLEGUNGEN ZAEHLTEN NICHT INS ENTSENDELIMIT. Seit dem
//      17.07.2026 zaehlen sie (activeFleetMissionCount summiert relocateGroupIds mit). Die FAQ und
//      die desc der Forschung "Flottenkoordination" sagten weiterhin das Gegenteil - die dritte
//      Stelle war laengst richtig. Das ist die teuerste Sorte Falschaussage: Der Spieler plant eine
//      Umverteilung in dem Glauben, sie koste keinen Slot, und steht dann ohne Angriffs- oder
//      Expeditionsmoeglichkeit da.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

/* Der PATCHNOTES-Block wird fuer die Pruefungen unten herausgeschnitten (CLAUDE.md Regel 46).
   Grund: Ein Patchnote, der eine Behebung beschreibt, ZITIERT die alte Formulierung - und reisst
   damit genau die Pruefung, die diese Behebung festhaelt. Patchnotes sind unveraenderliche
   Historie, man kann den Wortlaut dort also nicht anpassen; die Pruefung muss sich anpassen.
   Betroffen sind hier BEIDE Richtungen: die verneinende Suche nach der alten Falschaussage UND
   der Zaehler auf die neue - ein Patchnote, der den neuen Wortlaut zitiert, triebe ihn ueber 2. */
const SRC_OHNE_HISTORIE = (() => {
  const v = src.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : src.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? src.slice(0, v) + src.slice(b) : src;
})();
function schnitt(von, bis) {
  const a = src.indexOf(von), b = src.indexOf(bis, a);
  if (a < 0 || b < 0) throw new Error('Abschnitt nicht gefunden: ' + von);
  return src.slice(a, b);
}

// ---- A: der PvP-Kampfbericht -------------------------------------------------------------------
const gesendet = schnitt("if (r.type === 'attack-sent'){", "} else if (r.type === 'attack-received'){");
const erhalten = schnitt("} else if (r.type === 'attack-received'){", "} else if (r.type === 'sabotage-sent'){");

for (const [name, block] of [['Angriffsbericht', gesendet], ['Ueberfallbericht', erhalten]]) {
  check(`${name}: Kampfverlauf wird gerendert`, block.includes('battlePhaseReportHtml(r.phasen'));
  check(`${name}: Konterwirkung wird gerendert`, block.includes('counterReportLine(r.counterMult)'));
  check(`${name}: Aufstellung wird gerendert`, block.includes('formationReportLine(r.formation'));
}

// Wessen Phasen, wessen Aufstellung - die Sorte Detail, an der sich ein Bericht in sein Gegenteil
// verkehrt. Der Server wuerfelt die Phasen IMMER aus Sicht des Angreifers, die Aufstellung gehoert
// IMMER dem Verteidiger. Im eigenen Angriffsbericht ist die Aufstellung also die des GEGNERS, und
// im Ueberfallbericht sind die Phasen die des ANGREIFERS - ein erfolgreicher Verteidiger saehe
// sonst "1 von 3 Phasen gewonnen" und muesste raten, wessen Phasen gemeint sind.
check('Angriffsbericht schreibt die Aufstellung dem Ziel zu', gesendet.includes("'des Ziels'"));
check('Ueberfallbericht schreibt die Aufstellung dem Spieler zu', erhalten.includes("'deine'"));
check('Ueberfallbericht kennzeichnet die Phasen als die des Angreifers', erhalten.includes("'den Angreifer'"));

// Die Helfer muessen die Beschriftung ueberhaupt annehmen - sonst waeren die Pruefungen oben
// gruen, waehrend das Argument still verschluckt wird.
check('formationReportLine nimmt ein wessen-Argument', /function formationReportLine\(formationKey, mult, wessen\)/.test(src));
check('battlePhaseReportHtml nimmt ein Sicht-Argument', /function battlePhaseReportHtml\(phasen, ausSichtVon\)/.test(src));
check('und beide geben es auch aus',
  /Aufstellung'\+\(wessen\?' '\+wessen:''\)/.test(src) && /\(ausSichtVon\?' für '\+ausSichtVon:''\)/.test(src));

// Rueckwaertskompatibel: Die bestehenden Aufrufe ohne das neue Argument duerfen sich nicht aendern.
check('der Ueberfall-Bericht (raid) ruft die Aufstellung weiterhin ohne Zusatz auf',
  src.includes('formationReportLine(r.formation, r.formationMult);'));
check('der NPC-Bericht ruft die Phasen weiterhin ohne Zusatz auf',
  src.includes('battlePhaseReportHtml(r.phasen);'));

// ---- B: die Flottenverlegungs-Texte ------------------------------------------------------------
// Der Code ist die Wahrheit: activeFleetMissionCount zaehlt die Verlegungen ueber ein Set von
// groupIds mit und addiert dessen Groesse.
const zaehler = schnitt('function activeFleetMissionCount(){', '\n  }');
// Geprueft wird die AUSSAGE (Verlegungen gehen ueber ein groupId-Set in die Summe ein), nicht
// der exakte Rueckgabeausdruck: Seit v8.391.0 addiert dieselbe Zeile zusaetzlich die
// Recycler-Sammelauftraege. Die erste Fassung nagelte 'return n + relocateGroupIds.size;'
// fest und ging bei dieser voellig richtigen Erweiterung kaputt - derselbe Fehlertyp wie
// beim festgenagelten abstractIcon in test_pvp_berichtsdaten.
check('der Code zaehlt Verlegungen wirklich mit',
  zaehler.includes('relocateGroupIds') && /return n \+ relocateGroupIds\.size(\s*\+[^;]*)?;/.test(zaehler));

const alteBehauptung = (SRC_OHNE_HISTORIE.match(/Flottenverlegungen zwischen eigenen Planeten zählen nicht mit/g) || []);
check('kein Text behauptet mehr, Verlegungen zaehlten nicht mit', alteBehauptung.length === 0, alteBehauptung.length);

// Die beiden korrigierten Stellen muessen es auch wirklich SAGEN - "nichts Falsches mehr da" ist
// nur die halbe Pruefung, sonst waere auch ein ersatzloses Streichen gruen.
//
// Das Datum ist im Muster OPTIONAL (18.08.2026, TX-1). Vorher stand hier
// `zählen seit dem 17\.07\.2026 mit` fest verdrahtet - damit verlangte die Pruefung nicht die
// Aussage, sondern eine Schreibweise, und zwar ausgerechnet eine mit einem Auslieferungsdatum im
// SPIELERTEXT. Fuer den Spieler sagt "seit dem 17.07.2026" nichts ueber das Spiel, nur darueber,
// dass hier einmal etwas geaendert wurde; TX-1 raeumt genau dieses Muster aus allen
// Beschreibungstexten. Die geprueften Eigenschaften sind unveraendert: die Aussage muss an BEIDEN
// Stellen stehen (ein ersatzloses Streichen faellt weiterhin durch), die alte Falschaussage
// nirgends, und die Verband-Ausnahme wieder an beiden. Nur das Datum darf fehlen - oder dastehen,
// falls es je zurueckkehrt.
const neu = (SRC_OHNE_HISTORIE.match(/Flottenverlegungen zwischen eigenen Planeten zählen (?:seit dem \d{2}\.\d{2}\.\d{4} )?mit/g) || []);
check('beide Stellen sagen jetzt das Richtige', neu.length === 2, neu.length);
// Und sie nennen die Verband-Ausnahme - ohne sie waere die neue Aussage zwar wahr, aber
// irrefuehrend: Ein Verband aus acht Schiffstypen kostet EINEN Slot, nicht acht.
// Die Verband-Ausnahme muss in beiden stehen - ohne sie waere die neue Aussage zwar wahr, aber
// irrefuehrend. Die Formulierung unterscheidet sich bewusst: In der Forschungsbeschreibung darf der
// Knopfname NICHT in „…" stehen, weil test_forschungstexte.js solche Zitate als Verweis auf andere
// Forschungsnamen liest und dann eine nicht existierende Forschung meldet. Gemeinsam ist beiden
// deshalb nur der Kern der Aussage.
check('beide nennen die Verband-Ausnahme',
  (src.match(/losgeschickter (?:Verband|Zug) allerdings nur als EIN Slot/g) || []).length === 2,
  (src.match(/losgeschickter (?:Verband|Zug) allerdings nur als EIN Slot/g) || []).length);

// Gegenprobe: Der Scan wuerde die alte Formulierung erkennen, wenn sie zurueckkaeme.
check('Gegenprobe: die alte Formulierung wuerde gefunden',
  /Flottenverlegungen zwischen eigenen Planeten zählen nicht mit/.test(
    'Text: Flottenverlegungen zwischen eigenen Planeten zählen nicht mit - Ende'));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
