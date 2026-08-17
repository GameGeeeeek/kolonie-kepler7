// Etappe A1+A2 des Wirtschafts-Rebalance-Konzepts (docs/wirtschaft-rebalance-konzept.md):
// (A1) Die Schiffs-Mengenskalierung hat oberhalb von 250 Stück einen exponentiellen Schwanz
//      (2 × 1,002^(nth−250)) statt des alten harten +100%-Deckels; bis 250 bleibt die Kurve
//      exakt die alte (1 + nth·0,004).
// (A2) Acht Klassen kosten oberhalb einer Bestands-Schwelle je weiterem Schiff eine
//      Tier-2-Komponente (SHIP_T2_KOMPONENTEN), mit demselben Faktor skaliert.
//
// Der Test schneidet SHIP_T2_KOMPONENTEN und scaledShipCost/shipCostForRange als ECHTE Blöcke
// aus der Spieldatei und führt sie mit einem Mini-Fixture aus (Regel 36: fehlende Abhängigkeiten
// - currentFleet/allFleets/prestigePerkCount - sind hier bewusst Teil des Fixtures, weil genau
// ihre Werte der Messgegenstand sind; keine Spiel-HILFSFUNKTION wird durch etwas Ähnliches
// ersetzt). Erwartungswerte werden, wo möglich, aus der ALTEN Kurve abgeleitet statt eingetippt.
//
// Gegenprobe (beidseitig gefahren, 17.08.2026): Am alten Stand (v8.547.0) fällt der Test mit
// "1-bau" (SHIP_T2_KOMPONENTEN existiert nicht) - und mit von Hand entferntem A2-Block fällt
// 4a/4b, mit zurückgebautem Faktor fällt 2b/3a.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');

const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------- 1: Blöcke ausschneiden und ausführen (Regel 34: Aufbau als eigene Prüfung) ----------
// Der Slice beginnt bei shipCostPerkMult (damit shipCostForRange mit im Block liegt) und endet
// an der jaegerCost-Definition; beide existieren genau einmal. Die dazwischen liegenden
// maxAffordable*-Funktionen werden nie AUFGERUFEN - ihre Abhängigkeiten (costFor, state)
// braucht das Fixture deshalb nicht.
const anfang = S.indexOf('function shipCostPerkMult()');
const endeAnker = S.indexOf('function jaegerCost(');
const tabelleDa = S.indexOf('const SHIP_T2_KOMPONENTEN = {');
check('1-anker: shipCostPerkMult, SHIP_T2_KOMPONENTEN und jaegerCost existieren in dieser Reihenfolge',
  anfang >= 0 && tabelleDa > anfang && endeAnker > tabelleDa, { anfang, tabelleDa, endeAnker });

let api = null;
try {
  const block = S.slice(Math.max(0, anfang), endeAnker > anfang ? endeAnker : anfang);
  // Das Fixture stellt die drei Abhängigkeiten des Blocks: eine Flotte am aktiven Standort,
  // alle Flotten des Imperiums, und den (hier neutralen) Werft-Perk. Alle Rückgaben sind mit
  // typeof-Wachen versehen (Regel 34): Am ALTEN Stand fehlt SHIP_T2_KOMPONENTEN - die
  // Gegenprobe soll dann mit benannten FAILs durchlaufen, nicht mit einem ReferenceError
  // abstürzen und die übrigen Prüfungen verdecken.
  const bauer = new Function('fixture', `
    const currentFleet = () => fixture.lokal;
    const allFleets = () => fixture.flotten;
    const prestigePerkCount = () => 0;
    ${block}
    return {
      scaledShipCost: (typeof scaledShipCost === 'function') ? scaledShipCost : null,
      SHIP_T2_KOMPONENTEN: (typeof SHIP_T2_KOMPONENTEN !== 'undefined') ? SHIP_T2_KOMPONENTEN : null,
      shipCostForRange: (typeof shipCostForRange === 'function') ? shipCostForRange : null
    };
  `);
  const probe = bauer({ lokal: {}, flotten: [] });
  check('1-bau: der Block lässt sich ausführen', !!probe.scaledShipCost, Object.keys(probe).filter(k=>!probe[k]));
  check('1c: SHIP_T2_KOMPONENTEN existiert im Block', !!probe.SHIP_T2_KOMPONENTEN);
  if (probe.scaledShipCost && probe.SHIP_T2_KOMPONENTEN) api = bauer;
} catch (e) {
  check('1-bau: der Block lässt sich ausführen', false, String(e).slice(0, 200));
  check('1c: SHIP_T2_KOMPONENTEN existiert im Block', false);
}

if (api) {
  const fixture = { lokal: {}, flotten: [] };
  const mit = (bestand, key) => {
    fixture.lokal = {};
    fixture.flotten = [{ [key]: bestand }];
    return api(fixture);
  };
  // Der Bestand liegt bewusst auf einer ANDEREN Flotte als der lokalen: scaledShipCost zählt
  // (global - lokal) + n - so misst der Test auch, dass Verteilen auf Kolonien nichts umgeht.
  const kostenBei = (bestand, key, basis) => mit(bestand, key).scaledShipCost(basis, key, 0);

  // ---------- 2: A1-Kurve - unter/auf 250 exakt die alte, darüber stetig steigend ----------
  const B = { erz: 100000 }; // große Basis, damit ceil-Rundung die Vergleiche nicht verschmiert
  const alteKurve = (nth) => Math.ceil(100000 * (1 + Math.min(1.0, nth * 0.004)));
  let unter250Gleich = true;
  for (const nth of [0, 1, 100, 249, 250]) {
    if (kostenBei(nth, 'cruisers', B).erz !== alteKurve(nth)) unter250Gleich = false;
  }
  check('2a: bis einschließlich 250 exakt die alte Kurve (gemessen, nicht eingetippt)', unter250Gleich);
  const bei250 = kostenBei(250, 'cruisers', B).erz;
  const bei251 = kostenBei(251, 'cruisers', B).erz;
  const bei500 = kostenBei(500, 'cruisers', B).erz;
  const bei1000 = kostenBei(1000, 'cruisers', B).erz;
  const bei2000 = kostenBei(2000, 'cruisers', B).erz;
  check('2b: oberhalb 250 steigt der Preis weiter (alter Stand: konstant 2×)',
    bei251 > bei250 && bei500 > bei251 && bei1000 > bei500 && bei2000 > bei1000,
    { bei250, bei251, bei500, bei1000, bei2000 });
  // Die REGEL des Schwanzes, nicht die Momentaufnahme: je +250 Schiffe multipliziert sich der
  // Faktor um denselben Wert (1,002^250) - gemessen als Verhältnis zweier Messpunkte.
  const q1 = bei500 / bei250, q2 = bei1000 / bei500 * 1; // 1000-500 sind 500 Schritte = q1²
  check('3a: exponentielle Regel - Verhältnis je 250 Schritte konstant (±1% Rundung)',
    Math.abs(q2 - q1 * q1) / (q1 * q1) < 0.01, { q1, q2 });
  check('3b: weiche Wand - Schiff 2000 kostet mehr als das 30-fache von Schiff 250',
    bei2000 > 30 * bei250, { faktor: bei2000 / bei250 });

  // ---------- 4: A2-Komponenten ----------
  const T = api(fixture).SHIP_T2_KOMPONENTEN;
  const klassen = Object.keys(T);
  check('4-vorab: die Tabelle führt Klassen mit ab-Schwelle und Kosten',
    klassen.length >= 5 && klassen.every(k => T[k].ab > 0 && Object.keys(T[k].kosten).length > 0),
    { klassen });
  let unterSchwelleSauber = true, ueberSchwelleDa = true, skaliert = true;
  for (const k of klassen) {
    const t2Keys = Object.keys(T[k].kosten);
    const unter = kostenBei(T[k].ab - 1, k, { erz: 1000 });
    if (t2Keys.some(r => unter[r] !== undefined)) unterSchwelleSauber = false;
    const auf = kostenBei(T[k].ab, k, { erz: 1000 });
    // Erwartung aus der Tabelle UND der Faktor-Formel abgeleitet, nicht eingetippt:
    const nth = T[k].ab;
    const faktor = nth <= 250 ? 1 + nth * 0.004 : 2 * Math.pow(1.002, nth - 250);
    for (const r of t2Keys) {
      if (auf[r] !== Math.ceil(T[k].kosten[r] * faktor)) skaliert = false;
      if (!(auf[r] > 0)) ueberSchwelleDa = false;
    }
  }
  check('4a: unterhalb der Schwelle keine T2-Kosten (alle Klassen)', unterSchwelleSauber);
  check('4b: ab der Schwelle T2-Kosten vorhanden und mit dem Faktor skaliert', ueberSchwelleDa && skaliert);
  // Klassen OHNE Tabelleneintrag bleiben komplett T2-frei - auch bei riesigem Bestand.
  const jaegerHoch = kostenBei(5000, 'jaeger', { erz: 50, energie: 30 });
  check('4c: Klassen ohne Eintrag (Jäger) bekommen nie T2-Kosten',
    !('nanolegierungen' in jaegerHoch) && !('quantenchips' in jaegerHoch), jaegerHoch);

  // ---------- 5: Batch über die Schwelle hinweg (shipCostForRange preist je Einheit) ----------
  if (api(fixture).shipCostForRange) {
    fixture.lokal = { schlachtschiff: 95 };
    fixture.flotten = [fixture.lokal];
    const teile = api(fixture);
    const batch = teile.shipCostForRange({ costFn: (n) => teile.scaledShipCost({ erz: 400 }, 'schlachtschiff', n) }, 95, 10);
    // Einheiten 95..99 ohne, 100..104 mit Komponente - erwartete Nano-Summe aus Tabelle+Formel:
    let nanoErwartet = 0;
    for (let nth = 100; nth <= 104; nth++) nanoErwartet += Math.ceil(T.schlachtschiff.kosten.nanolegierungen * (1 + nth * 0.004));
    check('5: Batch über die Schwelle - nur die Einheiten oberhalb zahlen die Komponente',
      batch.nanolegierungen === nanoErwartet, { ist: batch.nanolegierungen, nanoErwartet });
  } else {
    check('5: shipCostForRange im Block gefunden', false);
  }
}

// ---------- 6: Anzeigestellen (Regel 6: die zweite Stelle, die die alte Annahme behält) ----------
// Der PATCHNOTES-Block bleibt bewusst drin (positive Prüfungen); verneinende Prüfungen schneiden
// ihn heraus (Regel 46).
const OHNE_HISTORIE = (() => {
  const v = S.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : S.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? S.slice(0, v) + S.slice(b) : S;
})();
check('6a: die Werft-Karte kündigt die Komponente an (t2KompLine wird gerendert)',
  S.includes('${t2KompLine}') && S.includes('${superKompLine}'));
check('6b: der Hilfetext nennt den exponentiellen Schwanz statt des alten Deckels',
  S.includes('wächst der Stückpreis exponentiell weiter'));
// Bewusst der SPEZIFISCHE alte Schiffs-Wortlaut, nicht "gedeckelt bei +100%" allgemein - den
// Deckel gibt es bei anderen Mechaniken (Abgrund-Offiziere) völlig zu Recht weiterhin.
check('6c: die alte Schiffs-Aussage "kostet also das Doppelte" (Fixpreis-Deckel) ist aus den Live-Texten verschwunden',
  !OHNE_HISTORIE.includes('Schiff eines Typs kostet also das Doppelte'));
// Paritätswache: Jede Klasse der Tabelle muss im Hilfetext namentlich auftauchen - eine neue
// Klasse ohne Hilfetext-Erwähnung (oder umgekehrt) fällt hier auf. Die Namen kommen aus
// SHIP_DEFS (bzw. dem Superschlachtschiff-Sonderfall), nie aus einer zweiten Liste im Test.
{
  const tabellenBlock = (S.match(/const SHIP_T2_KOMPONENTEN = \{[\s\S]*?\n  \};/) || [''])[0];
  const keys = [...tabellenBlock.matchAll(/^\s{4}(\w+):/gm)].map(m => m[1]);
  // title:-Anker statt des nackten Titels: Der Titel wird auch in Kommentaren und im
  // Grenznutzen-Hilfetext ZITIERT - der nackte indexOf traf zuerst den Kommentar an
  // scaledShipCost und prüfte dann 3000 Zeichen Quelltext statt des Hilfe-Eintrags (Regel 6).
  const hilfeStart = OHNE_HISTORIE.indexOf("title:'Imperiums-Skalierung der Kosten'");
  const hilfe = hilfeStart >= 0 ? OHNE_HISTORIE.slice(hilfeStart, hilfeStart + 3000) : '';
  check('6d-vorab: Tabelle und Hilfe-Abschnitt gefunden', keys.length >= 5 && hilfeStart >= 0, { keys });
  const fehlend = keys.filter(k => {
    const name = k === 'superschlachtschiff' ? 'Superschlachtschiff'
      : ((S.match(new RegExp(`key:'${k}', name:'([^']+)'`)) || [])[1] || k);
    // "Trägerschiff" heißt in SHIP_DEFS so, der Hilfetext darf den Namen beliebig flektieren -
    // geprüft wird der Wortstamm.
    return !hilfe.includes(name.slice(0, Math.min(name.length, 9)));
  });
  check('6d: jede Komponenten-Klasse steht namentlich im Hilfetext', fehlend.length === 0, { fehlend });
}

ende();
