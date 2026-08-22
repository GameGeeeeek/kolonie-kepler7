// Die Angriffsvorschau muss die Zahl nennen, die der Kampf wirklich würfelt (15.08.2026).
//
// BEFUND. Bei NPC-Gegnern und Piratennestern wirkt eine ausgenutzte Schwachstelle als flacher
// Aufschlag: 1,25 auf die Angriffskraft und zusätzlich 1,1 auf die Phasenbasis, zusammen 1,375.
// Die Kampfauflösung rechnete ihn mit, die Vorschau daneben nicht - obwohl der Kommentar an
// BEIDEN Vorschauen ausdrücklich versprach, "dieselbe Rechnung wie die Auflösung" zu machen.
// Weil alle 18 NPCs und alle zehn Nest-Stufen eine Schwäche tragen, war das der Regelfall und
// nicht die Ausnahme: Wer den passenden Schiffstyp mitschickte - also genau das, wozu das
// Kontersystem erziehen soll -, bekam eine zu niedrige Erfolgschance angezeigt. Gemessen am
// Titan-Wächter (Verteidigung 320, Angriffskraft 320): Karte 50%, Kampf 62%.
// Danach las derselbe Spieler im Bericht eine andere Zahl als auf der Karte und musste das für
// einen Fehler in der Auflösung halten.
//
// WAS HIER GEPRUEFT WIRD - und warum so:
//   1. Die Regel steht EINMAL da. Eine zweite Kopie in der Vorschau hätte den Fehler behoben und
//      die Fehlerquelle behalten; genau daran hängt dieses Projekt laut CLAUDE.md Punkt 6 immer
//      wieder. Deshalb: weaknessPhasenBasis/npcWeaknessAusgenutzt genau einmal definiert.
//   2. Der INHALT der Regel, ausgeführt statt gelesen: 1,375 mit Schwäche, 1,0 ohne. Ein Test,
//      der nur nachsieht, ob irgendwo der Funktionsname steht, wäre grün, wenn jemand die
//      Faktoren verstellt.
//   3. Beide Paare rufen sie: NPC-Auflösung + NPC-Vorschau, Nest-Auflösung + Nest-Vorschau. Das
//      ist die eigentliche Zusage - nicht "die Funktion existiert", sondern "beide Seiten
//      benutzen sie".
//   4. Kein battleWinChance-Aufruf im Spiel bekommt mehr eine ROHE Kraft, wo es ein Gegenstück
//      mit Schwäche gibt. Das ist die Prüfung, die auch einen KÜNFTIGEN dritten Aufrufer fasst.
//
// GEGENPROBE (Arbeitsregel 1, in beide Richtungen ausgeführt):
//   - Am Stand v8.507.0 fallen 1a (weaknessPhasenBasis existiert nicht), 3b und 3d (die beiden
//     Vorschauen rufen sie nicht) und 4 (zwei rohe Aufrufe).
//   - Setzt man am neuen Stand WEAKNESS_PHASE_MULT auf 1, fällt 2b - die Prüfung hängt am Wert
//     und nicht nur am Namen.
//   - Nimmt man in der NPC-Vorschau die Klammer wieder heraus, fällt 3b, und 4 nennt die Zeile.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');

// ---- 1) Die Regel steht einmal -------------------------------------------------------------
const defBasis = (S.match(/function weaknessPhasenBasis\s*\(/g) || []).length;
const defAusgenutzt = (S.match(/function npcWeaknessAusgenutzt\s*\(/g) || []).length;
check('1a: weaknessPhasenBasis ist genau einmal definiert', defBasis === 1, { gefunden: defBasis });
check('1b: npcWeaknessAusgenutzt ist genau einmal definiert', defAusgenutzt === 1, { gefunden: defAusgenutzt });

// ---- 2) Der Inhalt der Regel, ausgeführt ----------------------------------------------------
// Die Funktion wird aus der Datei geschnitten und WIRKLICH aufgerufen. Ein Muster, das nur den
// Namen sucht, bliebe grün, wenn jemand 1,25 auf 1,0 setzt.
const vonK = S.indexOf('  const WEAKNESS_POWER_MULT');
const bisK = S.indexOf('  const PHASE_CHANCE_MIN', vonK);
check('2a: der Konstanten-/Regelblock ist auffindbar', vonK >= 0 && bisK > vonK, { vonK, bisK });
if (vonK >= 0 && bisK > vonK) {
  // shipDisplayName wird von weaknessName gerufen, hier aber nie erreicht - eine Attrappe genügt,
  // damit der Block überhaupt lädt.
  const block = 'function shipDisplayName(k){ return k; }\nfunction deployableFighters(f){ return { jaeger:f.jaeger||0, bomber:f.bomber||0 }; }\n'
    + S.slice(vonK, bisK);
  const f = new Function(block + '\nreturn { basis: weaknessPhasenBasis, genutzt: npcWeaknessAusgenutzt, name: weaknessName };')();
  const mit = f.basis(1000, true), ohne = f.basis(1000, false);
  check('2b: die Schwäche hebt die Phasenbasis auf das 1,375-fache', Math.abs(mit / ohne - 1.375) < 1e-9,
    { mit, ohne, verhaeltnis: mit / ohne });
  check('2c: ohne Schwäche bleibt die Basis unverändert', ohne === 1000, { ohne });
  // Die Erkennung selbst: der Riftwächter ist der zweite Zugang zur Leerenjäger-Schwäche und
  // wäre bei einer nachgebauten Bedingung als Erstes vergessen worden.
  check('2d: Kreuzer werden über den Flottenschlüssel cruisers erkannt',
    f.genutzt({ weakness: 'cruiser' }, { cruisers: 1 }) === true && f.genutzt({ weakness: 'cruiser' }, { cruiser: 1 }) === false);
  check('2e: der Riftwächter löst die Leerenjäger-Schwäche ebenfalls aus',
    f.genutzt({ weakness: 'leerenjaeger' }, { riftwaechter: 1 }) === true);
  check('2f: ein Gegner ohne Schwäche meldet nie eine ausgenutzte', f.genutzt({}, { cruisers: 99 }) === false);
}

// ---- 3) Beide Paare rufen die Regel ---------------------------------------------------------
// Slices mit Endanker: Der Anker wird ZUERST auf Existenz geprüft (Arbeitsregel 6) - fehlt er,
// liefe der Ausschnitt bis fast ans Dateiende und jede Prüfung darin wäre gehaltlos.
function ausschnitt(vonMarke, bisMarke, name) {
  const a = S.indexOf(vonMarke);
  const b = a < 0 ? -1 : S.indexOf(bisMarke, a);
  check('3-anker: ' + name + ' - beide Marken gefunden', a >= 0 && b > a, { a, b });
  return (a >= 0 && b > a) ? S.slice(a, b) : '';
}
const npcAufl = ausschnitt("const hasWeakness = npcWeaknessAusgenutzt(npc, fleet);", "const success = phasenErgebnis.success;", 'NPC-Auflösung');
check('3a: die NPC-Auflösung bildet ihre Phasenbasis mit weaknessPhasenBasis',
  /const phasenBasis = weaknessPhasenBasis\(powerRoh, hasWeakness\)/.test(npcAufl));

/* MITGEZOGEN AM 22.08.2026 (E1b) - und dabei SCHAERFER geworden, nicht passend gemacht.
   Die NPC-Vorschau-Rechnung stand bis dahin inline in renderGalaxy; dieser Ausschnitt suchte sie
   ueber ihre dortigen Variablennamen (powerRohPreview, schwaecheGenutzt, attackFleet). Seit E1b
   liegt sie in npcKampfLage(), weil die KARTE dieselben Zahlen braucht - der Ausschnitt fand
   seine Marken nicht mehr und meldete {"a":-1,"b":-1} auf voellig korrektem Code.
   Die bequeme Loesung waere gewesen, einfach die neuen Namen einzusetzen. Geprueft wird jetzt
   stattdessen die EIGENSCHAFT, die dieser Test schuetzen soll - und zwar in beide Richtungen:
   die eine Vorschau-Rechnung bildet ihre Basis mit weaknessPhasenBasis (3b/3c), UND es gibt sie
   nur EINMAL (3b2). Eine zweite Vorschau, die die Basis anders bildet, faellt damit auf; vorher
   waere sie unbemerkt geblieben, solange die alte Stelle noch stimmte. */
const npcVor = ausschnitt("function npcKampfLage(npc, flotte){", "\n  /* Die Enterphase", 'NPC-Kampflage');
check('3b: die NPC-Vorschau rechnet ihre Chance über dieselbe Basis',
  /battleWinChance\(weaknessPhasenBasis\(powerRoh, schwaecheGenutzt\), effDefense, konter\)/.test(npcVor));
check('3c: und sie zeigt die Angriffskraft mit demselben Aufschlag wie die Auflösung',
  /powerRoh \* konter \* \(schwaecheGenutzt \? WEAKNESS_POWER_MULT : 1\)/.test(npcVor));
// Die Gegenrichtung: Sobald jemand die Chance ein zweites Mal ausrechnet, laufen die beiden
// Stellen frueher oder spaeter auseinander - genau der Vorfall, der diesen Test hervorgebracht hat.
{
  const n = (S.match(/battleWinChance\(weaknessPhasenBasis\(/g) || []).length;
  check('3b2: und sie tut es an genau EINER Stelle', n === 1, { stellen: n });
}

const nestVor = ausschnitt("const plSchwaeche = pirateLairWeakness(stage);", "const plBusy = cf.missions.some", 'Nest-Vorschau');
check('3d: die Piratennest-Vorschau rechnet ihre Chance über dieselbe Basis',
  /const plPhasenBasis = weaknessPhasenBasis\(plPower, plSchwaecheGenutzt\)/.test(nestVor)
  && /battleWinChance\(plPhasenBasis, lairDef, 1\)/.test(nestVor));

// Und sie sagt dem Spieler, WOHER der Unterschied kommt - ohne diese Zeile springt die Zahl
// unerklärlich, sobald man den passenden Schiffstyp dazunimmt.
check('3e: die NPC-Karte nennt die Schwachstelle des Gegners',
  S.includes('Schwachstelle: ${weaknessName(n.weakness)}'));
check('3f: die Nest-Box nennt die Schwachstelle ihrer Stufe',
  S.includes('Schwachstelle dieser Stufe: ${weaknessName(plSchwaeche)}'));

// ---- 4) Kein Aufrufer bekommt mehr eine rohe Kraft, wo es eine Schwäche gibt -----------------
// Diese Prüfung fasst auch einen KÜNFTIGEN dritten Aufrufer. Die vier bekannten Ausnahmen sind
// benannt, nicht stillschweigend übergangen: PvP kennt keine Schwachstellen (dort entscheidet das
// Kontersystem), Leerenriss und Abgrund haben keine modellierte Gegnerflotte.
const ROH_ERLAUBT = [
  'myPowerVorrat',      // PvP-Simulation (Solo-Pfad) - seit v8.558.0 mit eingerechnetem
                        // Gefechtsvorrat. Die Schwaechen-Basis ist hier bewusst NICHT im Spiel:
                        // Schwaechen sind eine NPC-Eigenschaft, ein Spieler hat keine.
  'previewPower',       // PvP-Vorschau
  'myFullAttack',       // PvP-Chance im Spionagebericht
  'riftPower',          // Leerenriss - keine Schwachstelle modelliert
  'kraft',              // Abgrund - Vorschau und Auflösung, beide identisch roh
  // Überfall-Abwehr (Phasen-Umstellung 17.08.2026): Der NPC ist hier der ANGREIFER - eine
  // Schwachstelle ist eine Eigenschaft verteidigender NPCs, es gibt hier keine auszunutzen.
  'raiderPowerBase',    // Auflösung in executeRaid
  'raiderPower'         // Vorab-Chance im Späh-Bericht (resolveRaidScout)
];
// `function ` davor ausschließen: Sonst zählt die DEFINITION als Aufrufer und meldet ihren
// eigenen Parameternamen (basePower) als Verstoß - eine Prüfung, die sich selbst im Weg steht.
const aufrufe = [];
const re = /(function\s+)?battleWinChance\(([A-Za-z_$][\w$]*)/g;
let m;
while ((m = re.exec(S)) !== null) {
  if (m[1]) continue;
  const zeile = S.slice(0, m.index).split('\n').length;
  aufrufe.push({ zeile, arg: m[2] });
}
const verdaechtig = aufrufe.filter(a => ROH_ERLAUBT.indexOf(a.arg) < 0 && !/Basis$/.test(a.arg));
check('4a: es gibt überhaupt battleWinChance-Aufrufe zu prüfen', aufrufe.length >= 6, { gefunden: aufrufe.length });
check('4b: jeder Aufruf bekommt entweder eine Phasenbasis oder steht auf der benannten Ausnahmeliste',
  verdaechtig.length === 0, verdaechtig);

ende();
