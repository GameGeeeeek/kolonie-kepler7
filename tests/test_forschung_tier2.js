// Forschung kostet ab einer hohen Stufe Tier-2-Ressourcen (Wunsch Sascha, 15.08.2026).
//
// WAS AUF DEM SPIEL STEHT: Eine Forschung, die eine Ressource verlangt, die sie selbst erst
// freischaltet, ist eine Sackgasse - der Spieler kann sie nie erforschen und kommt nie an die
// Ressource. Dass das heute nicht passieren kann, ist kein Zufall, sondern liegt an einer
// Eigenschaft der Daten: Alle sieben Forschungen, die eine Tier-2-Kette freischalten, haben
// maxLevel 1 und erreichen die Schwelle nie. Diese Eigenschaft ist ungeschrieben und würde beim
// nächsten Balance-Pass, der einer von ihnen mehr Stufen gibt, still verschwinden. Prüfung 2 macht
// sie deshalb zur Zusage.
//
// GEPRUEFT WIRD:
//   1. Die Kostenrechnung ist EINE Stelle, und die Tier-2-Kosten hängen dort - nicht in einer
//      zweiten Formel neben der Anzeige (die Fehlerklasse aus CLAUDE.md Punkt 6, an der diese
//      Sitzung sechs Anzeigen berichtigt hat).
//   2. Keine Forschung kann sich selbst aussperren: Jede der sieben Freischalt-Forschungen bleibt
//      unter der Schwelle.
//   3. Der INHALT der Regel, ausgeführt statt gelesen: unterhalb der Schwelle KEINE Tier-2-Kosten
//      (Bestandskonten im frühen Spiel merken nichts), darüber linear wachsend, und die Chip-
//      Schwelle liegt über der Nano-Schwelle.
//   4. Die Allianzforschung bleibt unberührt - sie geht durch dieselbe Funktion, ist aber bei
//      ALLIANZ_FORSCHUNG_MAX gedeckelt. Fällt dieser Deckel jemals über die Schwelle, ändert das
//      still die Kosten eines ganz anderen Systems; dann soll es hier auffallen.
//
// GEGENPROBE (Arbeitsregel 1, in beide Richtungen ausgeführt):
//   - Am Stand v8.516.0 fallen 1 und 3 (forschungT2Kosten existiert nicht).
//   - Setzt man FORSCHUNG_T2_AB_NANO auf 1, fällt 2 und nennt alle sieben Freischalt-Forschungen.
//   - Hebt man ALLIANZ_FORSCHUNG_MAX auf 20, fällt 4.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');

// Die Tier-2-Ketten und die Forschung, die sie jeweils freischaltet. Nicht eingetippt, sondern aus
// TIER2_DEFS und BUILDING_DEFS abgeleitet - eine achte Kette wird dadurch automatisch mitgeprüft.
function tabelle(name) {
  const v = S.indexOf('  const ' + name + ' = [');
  const b = v < 0 ? -1 : S.indexOf('\n  ];', v);
  if (v < 0 || b < 0) return null;
  try { return new Function('const ALLIANZ_FORSCHUNG_MAX = 10;\n' + S.slice(v, b + 5) + '\nreturn ' + name + ';')(); }
  catch (e) { return null; }
}
const T2 = tabelle('TIER2_DEFS'), BAU = tabelle('BUILDING_DEFS'), FOR = tabelle('RESEARCH_DEFS'), ALLI = tabelle('ALLIANCE_RESEARCH_DEFS');
check('0: alle vier Tabellen gelesen', !!T2 && !!BAU && !!FOR && !!ALLI,
  { T2: !!T2, BAU: !!BAU, FOR: !!FOR, ALLI: !!ALLI });
if (!T2 || !BAU || !FOR || !ALLI) return ende();

// ---- 1) Die Kosten hängen an der einen Rechenstelle ------------------------------------------
const nDef = (S.match(/function forschungT2Kosten\s*\(/g) || []).length;
check('1a: forschungT2Kosten ist genau einmal definiert', nDef === 1, { gefunden: nDef });
const vonC = S.indexOf('  function researchCostFor(r, targetLevel){');
const bisC = vonC < 0 ? -1 : S.indexOf('\n  }', vonC);
check('1b-anker: researchCostFor ist auffindbar', vonC >= 0 && bisC > vonC);
check('1b: researchCostFor schlägt die Tier-2-Kosten auf',
  vonC >= 0 && bisC > vonC && /forschungT2Kosten\(targetLevel\)/.test(S.slice(vonC, bisC)));

// ---- 2) Keine Forschung kann sich selbst aussperren ------------------------------------------
// Der eigentliche Grund für diesen Test. Aus den Daten abgeleitet, nicht aus einer Liste im Kopf.
const schwelle = Number((S.match(/const FORSCHUNG_T2_AB_NANO = (\d+)/) || [])[1]);
check('2-vorab: die Schwelle steht als Konstante da', schwelle > 1, { schwelle });
const freischalter = [];
for (const t of T2) {
  const b = BAU.find(x => x.key === t.buildingKey);
  for (const req of (b && b.requires) || []) {
    const key = (typeof req === 'string') ? req : req.key;
    const f = FOR.find(x => x.key === key);
    if (f) freischalter.push({ kette: t.key, forschung: f.key, maxLevel: f.maxLevel });
  }
}
check('2-vorab2: zu jeder Tier-2-Kette wurde die freischaltende Forschung gefunden',
  freischalter.length === T2.length, { ketten: T2.length, gefunden: freischalter.length });
const sackgasse = freischalter.filter(f => f.maxLevel >= schwelle);
check('2: keine Freischalt-Forschung erreicht die Tier-2-Schwelle (sonst sperrt sie sich selbst aus)',
  sackgasse.length === 0, sackgasse);

// ---- 3) Der Inhalt der Regel, ausgeführt -----------------------------------------------------
const vonK = S.indexOf('  const FORSCHUNG_T2_AB_NANO =');
const bisK = vonK < 0 ? -1 : S.indexOf('  // Die EINE Kostenstelle', vonK);
check('3-anker: der Konstantenblock ist auffindbar', vonK >= 0 && bisK > vonK, { vonK, bisK });
let f = null;
if (vonK >= 0 && bisK > vonK) {
  // Sturzsicher (Arbeitsregel 34): Fehlt die Funktion, meldet das eine eigene Prüfung, statt den
  // Lauf abzubrechen - sonst liefen die Prüfungen danach nie und niemand sähe, was sie sagen.
  let fehler = null;
  try {
    f = new Function(S.slice(vonK, bisK) + '\nreturn { t2: forschungT2Kosten, abNano: FORSCHUNG_T2_AB_NANO, abChips: FORSCHUNG_T2_AB_CHIPS };')();
  } catch (e) { fehler = e.message; }
  check('3-bau: der Konstantenblock lässt sich ausführen', !!f, fehler);
}
if (f) {
  check('3a: unterhalb der Schwelle gibt es KEINE Tier-2-Kosten',
    Object.keys(f.t2(f.abNano - 1)).length === 0 && Object.keys(f.t2(1)).length === 0,
    { einsUnterSchwelle: f.t2(f.abNano - 1), stufe1: f.t2(1) });
  check('3b: ab der Schwelle kosten sie Nanolegierungen', (f.t2(f.abNano).nanolegierungen || 0) > 0, f.t2(f.abNano));
  check('3c: die Chip-Schwelle liegt ÜBER der Nano-Schwelle', f.abChips > f.abNano, { abNano: f.abNano, abChips: f.abChips });
  check('3d: knapp unter der Chip-Schwelle kosten sie noch keine Quantenchips',
    !f.t2(f.abChips - 1).quantenchips && (f.t2(f.abChips).quantenchips || 0) > 0,
    { davor: f.t2(f.abChips - 1), danach: f.t2(f.abChips) });
  // Linear, nicht exponentiell: Der Abstand zwischen zwei Stufen bleibt gleich. Die Grundkosten
  // wachsen bereits mit costMult - ein zweiter exponentieller Term daneben wäre die Aufschaukelung,
  // vor der CLAUDE.md warnt.
  const d1 = f.t2(f.abNano + 5).nanolegierungen - f.t2(f.abNano + 4).nanolegierungen;
  const d2 = f.t2(f.abNano + 20).nanolegierungen - f.t2(f.abNano + 19).nanolegierungen;
  check('3e: die Nano-Kosten wachsen LINEAR (gleicher Schritt früh wie spät)', d1 === d2, { frueh: d1, spaet: d2 });
}

// ---- 4) Die Allianzforschung bleibt unberührt ------------------------------------------------
// Sie geht durch dieselbe researchCostFor - nur ihr Deckel hält sie unter der Schwelle. Das ist
// eine stille Abhängigkeit zwischen zwei Systemen, und genau deshalb steht sie hier.
const ueber = ALLI.filter(r => r.maxLevel >= schwelle).map(r => r.key + '(max' + r.maxLevel + ')');
check('4: keine Allianzforschung erreicht die Schwelle - sie bleibt ohne Tier-2-Kosten',
  ueber.length === 0, ueber);

// ---- 5) Tier-2-Schlüssel DIREKT in der baseCost (16.08.2026, die zwei Tier-3-Forschungen) ----
// Der Schwellen-Mechanismus oben erreicht maxLevel-1-Forschungen nie - rhohlraum und rkausalanker
// tragen ihre Tier-2-Kosten deshalb direkt in der baseCost. Damit gilt die Sackgassen-Regel aus
// Abschnitt 2 in einer zweiten Form, und sie wird hier aus den KOSTEN abgeleitet statt aus einer
// Liste im Kopf: Wer eine Kette als Zutat verlangt, muss deren Freischalt-Forschung ECHT
// (transitiv über requires) voraussetzen - und nie sich selbst. Eine künftige Forschung, die
// z. B. Hohlraumgitter verlangt, ohne rhohlraum vorauszusetzen, fällt hier auf.
{
  const t2keys = new Set(T2.map(t => t.key));
  const unlockVon = {};
  for (const f of freischalter) unlockVon[f.kette] = f.forschung;
  function requiresHuelle(f, gesehen){
    gesehen = gesehen || new Set();
    for (const req of f.requires || []){
      const key = (typeof req === 'string') ? req : req.key;
      if (gesehen.has(key)) continue;
      gesehen.add(key);
      const sub = FOR.find(x => x.key === key);
      if (sub) requiresHuelle(sub, gesehen);
    }
    return gesehen;
  }
  const verstoesse = [];
  let direkteKosten = 0;
  for (const f of FOR){
    const t2InCost = Object.keys(f.baseCost || {}).filter(k => t2keys.has(k));
    if (!t2InCost.length) continue;
    direkteKosten++;
    const huelle = requiresHuelle(f);
    for (const k of t2InCost){
      const unlock = unlockVon[k];
      if (!unlock || unlock === f.key || !huelle.has(unlock))
        verstoesse.push({ forschung: f.key, zutat: k, freischalter: unlock || 'unbekannt' });
    }
  }
  // Regel 37: erst belegen, dass der geprüfte Fall überhaupt existiert - sonst wäre 5b trivial grün.
  check('5a: es GIBT Forschungen mit Tier-2-Kosten direkt in der baseCost (rhohlraum, rkausalanker)',
    direkteKosten >= 2, { direkteKosten });
  check('5b: jede Tier-2-Zutat einer baseCost wird von einer ECHT vorausgesetzten Forschung freigeschaltet - nie von der eigenen',
    verstoesse.length === 0, verstoesse);
}

ende();
