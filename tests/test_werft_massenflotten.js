// Schiffskosten: FLACHER Stückpreis (18.08.2026) + Tier-2-Komponenten ab einer Bestands-Schwelle.
//
// (1) Der Stückpreis einer Klasse haengt NICHT mehr vom Bestand ab. Bis zum 18.08.2026 stand hier
//     eine Mengenskalierung (+0,4% je vorhandenem Schiff, oberhalb 250 exponentiell bis zum
//     66-fachen); sie ist auf Wunsch von Sascha entfernt. Dieser Test hielt frueher genau diese
//     Kurve fest - jetzt haelt er ihre ABWESENHEIT fest, und zwar schaerfer: Es genuegt nicht,
//     dass der Preis "kaum" steigt, er muss ueber den ganzen Bereich IDENTISCH sein.
// (2) Acht Klassen kosten oberhalb einer Bestands-Schwelle je weiterem Schiff eine
//     Tier-2-Komponente (SHIP_T2_KOMPONENTEN) - zum TABELLENWERT, ohne Faktor. Das ist eine
//     Schwelle, keine Preisstaffel, und war nicht Gegenstand der Aenderung.
//
// Der Test schneidet SHIP_T2_KOMPONENTEN und scaledShipCost/shipCostForRange als ECHTE Blöcke
// aus der Spieldatei und führt sie mit einem Mini-Fixture aus (Regel 36: fehlende Abhängigkeiten
// - currentFleet/allFleets/prestigePerkCount - sind hier bewusst Teil des Fixtures, weil genau
// ihre Werte der Messgegenstand sind; keine Spiel-HILFSFUNKTION wird durch etwas Ähnliches
// ersetzt). Erwartungswerte werden, wo möglich, aus der ALTEN Kurve abgeleitet statt eingetippt.
//
// Gegenprobe (beidseitig gefahren, 18.08.2026): Mit wieder eingebauter Mengenskalierung fallen
// 2a/2b/3a; mit entferntem A2-Block fallen 4a/4b.
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

  /* ---------- 2/3: FLACHER Stückpreis - die Kernaussage der Änderung ----------
     Gemessen wird ueber den ganzen frueher betroffenen Bereich, einschliesslich der beiden
     Stellen, an denen die alte Kurve ihre Knicke hatte (250 = alter Deckel, 251 = Beginn des
     exponentiellen Schwanzes). Die Basis ist bewusst gross, damit eine Rundung einen echten
     Unterschied nicht verstecken koennte. */
  const B = { erz: 100000 };
  const messpunkte = [0, 1, 100, 249, 250, 251, 500, 1000, 2000, 10000];
  const werte = messpunkte.map(nth => ({ nth, erz: kostenBei(nth, 'cruisers', B).erz }));
  const abweichend = werte.filter(w => w.erz !== B.erz);
  check('2a: der Stückpreis ist über den ganzen Bestandsbereich IDENTISCH mit der Grundzahl',
    abweichend.length === 0, { grundzahl: B.erz, abweichend });
  check('2b: insbesondere an den alten Knickstellen 250/251 - dort sass der alte Deckel',
    kostenBei(250, 'cruisers', B).erz === kostenBei(251, 'cruisers', B).erz
      && kostenBei(0, 'cruisers', B).erz === kostenBei(250, 'cruisers', B).erz,
    { bei0: kostenBei(0, 'cruisers', B).erz, bei250: kostenBei(250, 'cruisers', B).erz, bei251: kostenBei(251, 'cruisers', B).erz });
  /* Die Gegenrichtung, ohne die 2a nichts belegt: Der Bestandszaehler MUSS weiterhin gelesen
     werden - die Tier-2-Schwelle haengt daran. Ein `scaledShipCost`, das n ignoriert, waere an
     2a nicht zu unterscheiden, wuerde aber die Komponenten abschalten. */
  const kompKlasse = Object.keys(api(fixture).SHIP_T2_KOMPONENTEN)[0];
  const kompRes = Object.keys(api(fixture).SHIP_T2_KOMPONENTEN[kompKlasse].kosten)[0];
  const schwelle = api(fixture).SHIP_T2_KOMPONENTEN[kompKlasse].ab;
  check('3a: der Bestand wird weiterhin gelesen - er entscheidet die Tier-2-Schwelle',
    kostenBei(schwelle - 1, kompKlasse, B)[kompRes] === undefined
      && kostenBei(schwelle, kompKlasse, B)[kompRes] > 0,
    { klasse: kompKlasse, schwelle, unter: kostenBei(schwelle - 1, kompKlasse, B)[kompRes],
      auf: kostenBei(schwelle, kompKlasse, B)[kompRes] });

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
    // Erwartung aus der TABELLE, nicht eingetippt - und ohne Faktor: Die Komponente ist eine
    // Schwelle, keine Preisstaffel. Bis zum 18.08.2026 stand hier der Mengenfaktor mit drin.
    for (const r of t2Keys) {
      if (auf[r] !== Math.ceil(T[k].kosten[r])) skaliert = false;
      if (!(auf[r] > 0)) ueberSchwelleDa = false;
    }
  }
  check('4a: unterhalb der Schwelle keine T2-Kosten (alle Klassen)', unterSchwelleSauber);
  check('4b: ab der Schwelle T2-Kosten vorhanden, und zwar zum reinen Tabellenwert', ueberSchwelleDa && skaliert);
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
    for (let nth = 100; nth <= 104; nth++) nanoErwartet += Math.ceil(T.schlachtschiff.kosten.nanolegierungen);
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
check('6b: der Hilfetext sagt, dass der Stückpreis NICHT mehr mit der Flottengröße steigt',
  S.includes('kostet jedes Schiff einer Klasse denselben Preis'));
// Bewusst der SPEZIFISCHE alte Schiffs-Wortlaut, nicht "gedeckelt bei +100%" allgemein - den
// Deckel gibt es bei anderen Mechaniken (Abgrund-Offiziere) völlig zu Recht weiterhin.
check('6c: die alte Schiffs-Aussage "kostet also das Doppelte" (Fixpreis-Deckel) ist aus den Live-Texten verschwunden',
  !OHNE_HISTORIE.includes('Schiff eines Typs kostet also das Doppelte'));
// Und die Aussage der Zwischenstufe ebenso - sie war von August bis zum 18.08.2026 wahr und ist
// es seit dem flachen Stückpreis nicht mehr.
check('6c2: auch die exponentielle Zwischen-Aussage steht nicht mehr in den Live-Texten',
  !OHNE_HISTORIE.includes('wächst der Stückpreis exponentiell weiter'));
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
