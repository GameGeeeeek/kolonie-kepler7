// Tier 3: Hohlraumgitter, Kausalanker und der Kausalitätsbrecher (16.08.2026).
//
// WAS AUF DEM SPIEL STEHT. Tier 2 ist nicht daran gescheitert, dass es zu schwer herzustellen war,
// sondern daran, dass niemand es abgenommen hat - die Lager liefen voll, und ein volles Tier-2-Lager
// schaltet in tier2Step sogar den Verbrauch der EINGANGSSTOFFE ab. Eine dritte Etage ohne Abnehmer
// wäre derselbe Fehler eine Etage höher. Kette und Abnehmer kommen deshalb in EINER Auslieferung,
// und dieser Test hält beides zusammen.
//
// DIE ENTSCHEIDUNG, die er trägt: Protomaterie steckt in den BAUKOSTEN der beiden Fabriken, nicht in
// ihren laufenden Eingangsstoffen. Der Grund ist gemessen, nicht Geschmack - als Dauerverbrauch
// frisst eine einzige voll ausgebaute Kette rund 16 Protomaterie je Stunde, über zehn Standorte 162,
// gegen eine Einnahme von 11 bis 32. Eine Dauerfabrik skaliert mit Standorten und Stufen,
// Protomaterie hängt an FLUGZEIT und tut das nicht; die beiden Größen laufen zwangsläufig
// auseinander. Prüfung 2 macht diese Entscheidung zur Zusage - wer Protomaterie später doch in die
// inputs schreibt, reißt sie.
//
// GEPRUEFT WIRD ausserdem:
//   1. Die ARRAY-REIHENFOLGE. Die Engine verarbeitet TIER2_DEFS in Reihenfolge innerhalb EINES
//      Ticks; steht eine Kette vor ihrem Eingangsstoff, sieht sie dessen Produktion aus demselben
//      Tick nicht. Das ist kein Absturz, sondern eine still halbierte Produktion.
//   3. Der Protomaterie-Anteil der Baukosten bleibt bis zur letzten Stufe UNTER dem Lagerdeckel -
//      sonst wäre die Stufe nicht teuer, sondern unbezahlbar (dieselbe Sackgasse, die bei den
//      Mega-Stufen die Imperiums-Skalierung beinahe erzeugt hätte).
//   4. Beide Forschungen haben maxLevel 1. Seit v8.522.0 kosten Forschungen ab Stufe 11 selbst
//      Tier-2-Material; eine mehrstufige Tier-3-Forschung würde eine Ressource verlangen, die sie
//      selbst erst freischaltet.
//   5. Der Abnehmer existiert und nimmt BEIDE Stoffe ab. Eine Kette mit nur einem Abnehmer für
//      einen der zwei Stoffe wäre halb tot.
//   6. Die zwei per-Schlüssel gepflegten Tabellen (Kryo-Archiv, Pakt-Geschenke) decken JEDEN
//      TIER2_DEFS-Schlüssel ab - generisch geprüft, damit auch eine zehnte Kette auffällt.
//   7. Niemand wird blockiert: Metamaterial-Titan und Singularitäts-Vernichter kosten unverändert
//      kein Tier 3. Das neue Schiff kommt HINZU, es ersetzt nichts.
//   8. Die Superlative im Hilfetext stimmen - 340 Angriff und 120 Schild sind wirklich die
//      Höchstwerte. Ein Superlativ, den ein späterer Balance-Pass überholt, ist eine Falschaussage.
//
// GEGENPROBE (Arbeitsregel 1, an einer KOPIE über KEPLER_SPIELDATEI):
//   - Am Stand v8.526.0 fallen 1, 2, 3, 4, 5, 7b und 8b (nichts davon existiert dort).
//   - Schreibt man protomaterie in die inputs einer der Ketten, fällt genau 2a.
//   - Verschiebt man den Hohlraumgitter-Eintrag vor das Metamaterial, fällt genau 1.
//   - Hebt man die Baukosten auf 30 Protomaterie, fällt genau 3 - mit der unbezahlbaren Zahl.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');
const NEU = ['hohlraumgitter', 'kausalanker'];

// Eine Tabelle ausführbar machen - sturzsicher (Arbeitsregel 34): Der Fehlschlag beim AUFBAU meldet
// sich als eigene, benannte Prüfung, statt den Lauf abzubrechen und alles danach stumm ausfallen zu
// lassen.
function tabelle(name, kopf) {
  const v = S.indexOf('  const ' + name + ' = [');
  const b = v < 0 ? -1 : S.indexOf('\n  ];', v);
  if (v < 0 || b < 0) { check('0-anker: ' + name + ' ist auffindbar', false, { v, b }); return null; }
  try { return new Function((kopf || '') + S.slice(v, b + 5) + '\nreturn ' + name + ';')(); }
  catch (e) { check('0-bau: ' + name + ' lässt sich ausführen', false, e.message); return null; }
}
const T2 = tabelle('TIER2_DEFS');
const BAU = tabelle('BUILDING_DEFS');
const FOR = tabelle('RESEARCH_DEFS', 'const ALLIANZ_FORSCHUNG_MAX = 10;\n');
check('0: die drei Tabellen wurden gelesen', !!T2 && !!BAU && !!FOR, { T2: !!T2, BAU: !!BAU, FOR: !!FOR });
if (!T2 || !BAU || !FOR) return ende();

check('0b: beide Tier-3-Ketten existieren', NEU.every(k => T2.some(t => t.key === k)),
  { vorhanden: T2.map(t => t.key) });

// ---- 1) Array-Reihenfolge --------------------------------------------------------------------
// Generisch über ALLE Ketten geprüft, nicht nur die zwei neuen: Dieselbe Falle trifft jede künftige.
const idx = {}; T2.forEach((t, i) => { idx[t.key] = i; });
const verdreht = [];
for (const t of T2) for (const eingang of Object.keys(t.inputs || {})) {
  if (idx[eingang] !== undefined && idx[eingang] > idx[t.key]) verdreht.push(t.key + ' braucht ' + eingang + ', steht aber davor');
}
check('1: jede Kette steht HINTER ihren Tier-2-Eingangsstoffen (sonst sieht sie deren Produktion im selben Tick nicht)',
  verdreht.length === 0, verdreht);

// ---- 2) Protomaterie: Baukosten ja, Dauerverbrauch nein --------------------------------------
const mitProtoInput = T2.filter(t => (t.inputs || {}).protomaterie).map(t => t.key);
check('2a: KEINE Kette verbraucht Protomaterie laufend (sonst saugt sie den Bergbau rund um die Uhr leer)',
  mitProtoInput.length === 0, mitProtoInput);
const fabriken = NEU.map(k => BAU.find(b => b.key === (T2.find(t => t.key === k) || {}).buildingKey)).filter(Boolean);
check('2b-vorab: zu beiden Ketten wurde die Fabrik gefunden', fabriken.length === 2,
  { gefunden: fabriken.map(f => f.key) });
check('2b: beide Fabriken kosten beim BAU Protomaterie - sonst hinge Tier 3 gar nicht am Bergbau',
  fabriken.length === 2 && fabriken.every(f => (f.baseCost || {}).protomaterie > 0),
  fabriken.map(f => ({ fabrik: f.key, proto: (f.baseCost || {}).protomaterie })));

// ---- 3) Die Baukosten bleiben bezahlbar ------------------------------------------------------
/* Gebäudekosten wachsen mit costMult^Stufe (costFor) und werden NICHT mit dem Imperium skaliert.
   Der teuerste Einzelausbau muss trotzdem unter den Protomaterie-Speicher passen - was darüber
   liegt, lässt sich nicht ansparen, egal wie lange jemand fliegt. Beide Größen werden GERECHNET,
   nicht eingetippt (Arbeitsregel 2), damit die Prüfung eine Änderung an Deckel ODER Kosten fängt. */
const basis = Number((S.match(/const PROTOMATERIE_LAGER_BASIS = (\d+)/) || [])[1]);
const jeStufe = Number((S.match(/const PROTOMATERIE_LAGER_JE_AUFBEREITUNG = (\d+)/) || [])[1]);
const aufbMax = Number((S.match(/key:'aufbereitung'[\s\S]{0,900}?maxLevel:(\d+)/) || [])[1]);
check('3-vorab: Speicher-Konstanten und Aufbereitungs-Maximalstufe gelesen',
  basis > 0 && jeStufe > 0 && aufbMax > 0, { basis, jeStufe, aufbMax });
if (basis > 0 && jeStufe > 0 && aufbMax > 0 && fabriken.length === 2) {
  const deckel = basis + jeStufe * aufbMax;
  const teuerste = fabriken.map(f => ({
    fabrik: f.key,
    // costFor rechnet base * costMult^level; die letzte baubare Stufe ist maxLevel-1.
    hoechsteStufe: Math.ceil(f.baseCost.protomaterie * Math.pow(f.costMult, f.maxLevel - 1))
  }));
  check('3: der teuerste Fabrik-Ausbau passt in den Protomaterie-Speicher (sonst unbezahlbar statt teuer)',
    teuerste.every(t => t.hoechsteStufe < deckel), { deckel, teuerste });
}

// ---- 4) Keine Forschung sperrt sich selbst aus -----------------------------------------------
const neueForschungen = fabriken.flatMap(f => (f.requires || []).map(r => (typeof r === 'string' ? r : r.key)))
  .map(k => FOR.find(x => x.key === k)).filter(Boolean);
check('4-vorab: zu beiden Fabriken wurde die freischaltende Forschung gefunden',
  neueForschungen.length === 2, { gefunden: neueForschungen.map(f => f.key) });
const zuHoch = neueForschungen.filter(f => f.maxLevel !== 1).map(f => f.key + '(max' + f.maxLevel + ')');
check('4: beide Tier-3-Forschungen haben maxLevel 1 - mehrstufig würden sie eine Ressource verlangen, die sie selbst freischalten',
  zuHoch.length === 0, zuHoch);

// ---- 5) Der Abnehmer nimmt BEIDE Stoffe ------------------------------------------------------
const kosten = S.match(/function kausalitaetsbrecherCost\(n\)\{ return scaledShipCost\((\{[^}]*\})/);
check('5-vorab: die Kostenfunktion des Kausalitätsbrechers ist auffindbar', !!kosten);
if (kosten) {
  let k = null;
  try { k = new Function('return ' + kosten[1] + ';')(); } catch (e) {}
  check('5a: er kostet BEIDE Tier-3-Ressourcen - eine Kette mit nur einem Abnehmer wäre halb tot',
    !!k && NEU.every(r => (k[r] || 0) > 0), k);
  check('5b: und KEINE Protomaterie direkt - die steckt schon in den Fabriken, doppelt wäre doppelt gezählt',
    !!k && !k.protomaterie, k);
}
check('5c: das Schiff steht in SHIP_DEFS und braucht die zweite Tier-3-Forschung',
  /key:'kausalitaetsbrecher'[^\n]*requires:\['rkausalanker'\]/.test(S));

// ---- 6) Die per-Schlüssel gepflegten Tabellen sind vollständig --------------------------------
/* Beide Tabellen werden von Hand je Ressource gepflegt und veralten deshalb still. Ohne Eintrag im
   Kryo-Archiv ist `kryoLvl * undefined` NaN, der Bestand ginge beim Prestige kommentarlos verloren;
   bei den Pakt-Geschenken fiele die Menge auf die "N Minuten eigene Produktion"-Formel zurück, vor
   der CLAUDE.md ausdrücklich warnt. Generisch über ALLE Schlüssel geprüft, nicht nur die neuen. */
for (const [name, muster] of [['KRYOARCHIV_KEEP_PER_LEVEL', /const KRYOARCHIV_KEEP_PER_LEVEL = (\{[^}]*\})/],
                              ['PACT_GIFT_TIER2_CAPS', /const PACT_GIFT_TIER2_CAPS = (\{[^}]*\})/]]) {
  const m = S.match(muster);
  let tab = null;
  try { tab = m ? new Function('return ' + m[1] + ';')() : null; } catch (e) {}
  const fehlt = tab ? T2.filter(t => !(t.key in tab)).map(t => t.key) : ['Tabelle nicht lesbar'];
  check('6: ' + name + ' kennt jede Kette aus TIER2_DEFS', fehlt.length === 0, { fehlt });
}

// ---- 7) Niemand wird blockiert ---------------------------------------------------------------
// Die beiden vorhandenen Apex-Schiffe bleiben unverändert. Ein nachträglicher Tier-3-Anteil hätte
// sie bis zum ersten Flug gesperrt - genau das schließt die Vorgabe "niemand soll blockiert werden"
// aus, und genau deshalb ist der Kausalitätsbrecher ein NEUES Schiff.
for (const [fn, erwartet] of [['metamaterialtitanCost', '{ metamaterial: 40, hochenergiekristalle: 30 }'],
                              ['singularitaetsvernichterCost', '{ singularitaetskern: 25, fusionskerne: 40 }']]) {
  check('7a: ' + fn + ' ist unverändert - das vorhandene Apex-Schiff bleibt genau so baubar wie bisher',
    S.indexOf('function ' + fn + '(n){ return scaledShipCost(' + erwartet) >= 0);
}
check('7b: das neue Schiff ist zusätzlich da, nicht an ihrer Stelle',
  /key:'metamaterialtitan'/.test(S) && /key:'singularitaetsvernichter'/.test(S) && /key:'kausalitaetsbrecher'/.test(S));

// ---- 8) Die Superlative im Hilfetext stimmen -------------------------------------------------
/* Der Hilfetext nennt 340 Angriff und 120 Schild "beides Höchstwerte". Ein Superlativ, den ein
   späterer Balance-Pass überholt, ist eine Falschaussage im Spiel - und niemand würde daran denken,
   den Hilfetext nachzuziehen. Deshalb steht die Behauptung hier als Prüfung. */
const vonSD = S.indexOf('  const SHIP_DEFS = [');
const bisSD = vonSD < 0 ? -1 : S.indexOf('\n  ];', vonSD);
check('8-anker: SHIP_DEFS ist abgegrenzt', vonSD >= 0 && bisSD > vonSD);
if (vonSD >= 0 && bisSD > vonSD) {
  const blk = S.slice(vonSD, bisSD);
  const best = (feld) => [...blk.matchAll(new RegExp("key:'([a-z]+)'[^\\n]*?" + feld + ":(\\d+)", 'g'))]
    .map(m => ({ key: m[1], wert: +m[2] })).sort((a, b) => b.wert - a.wert)[0];
  const bAtk = best('atk'), bSh = best('shield');
  // Das Superschlachtschiff steht NICHT in SHIP_DEFS - sein Schild kommt aus einer Konstante und
  // muss mitgeprüft werden, sonst ist der Superlativ nur innerhalb einer Teilmenge wahr.
  const superSchild = Number((S.match(/const SUPERSCHLACHTSCHIFF_SHIELD = (\d+)/) || [])[1]) || 0;
  check('8a: der Kausalitätsbrecher hat wirklich den höchsten Angriffswert',
    bAtk && bAtk.key === 'kausalitaetsbrecher', bAtk);
  check('8b: und wirklich den höchsten Schildwert - auch gegen das Superschlachtschiff, das nicht in SHIP_DEFS steht',
    bSh && bSh.key === 'kausalitaetsbrecher' && bSh.wert > superSchild,
    { besterInSHIP_DEFS: bSh, superschlachtschiff: superSchild });
}

ende();
