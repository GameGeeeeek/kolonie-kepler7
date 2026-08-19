// Schiffskosten: der Stückpreis haengt in KEINER Weise vom Bestand ab (Stand 18.08.2026).
//
// Der Test hat zwei Umbauten hinter sich, und beide haben ihn schaerfer gemacht:
//
// (1) Bis zum 18.08.2026 hielt er eine MENGENSKALIERUNG fest (+0,4% je vorhandenem Schiff,
//     oberhalb 250 exponentiell bis zum 66-fachen). Auftrag Sascha: "Nimm das wieder raus."
//     Seither haelt er ihre ABWESENHEIT fest - und zwar strenger, als die alte Kurve geprueft
//     war: Es genuegt nicht, dass der Preis "kaum" steigt, er muss ueber den ganzen
//     Bestandsbereich IDENTISCH sein.
// (2) Danach blieb noch die MASSENFLOTTEN-KOMPONENTE (SHIP_T2_KOMPONENTEN, Etappe A2): Oberhalb
//     einer Bestands-Schwelle kostete jedes weitere Schiff einer Klasse zusaetzlich
//     Tier-2-Material. Sie war als Schwelle gedacht und nicht als Preisstaffel - fuer den Spieler
//     war sie aber dasselbe: Weiterbauen wurde ab einer Stueckzahl teurer. Auftrag Sascha:
//     "Massenflotte muss noch raus." Seither prueft dieser Test, dass der Bestand den Preis
//     ueberhaupt nicht mehr beruehrt, weder ueber einen Faktor noch ueber eine Schwelle.
//
// Die geprueften Bloecke werden als ECHTE Bloecke aus der Spieldatei geschnitten und mit einem
// Mini-Fixture ausgefuehrt (Regel 36: keine Spiel-Hilfsfunktion wird durch etwas Aehnliches
// ersetzt). currentFleet/allFleets/prestigePerkCount stellt das Fixture, weil genau ihre Werte
// frueher der Messgegenstand waren - dass sie jetzt WIRKUNGSLOS sind, ist die neue Aussage.
//
// Gegenprobe (beidseitig gefahren, 18.08.2026): Mit wieder eingebauter Mengenskalierung fallen
// 2a/2b; mit wieder eingebauter Komponenten-Tabelle fallen 3a/3b/4a und 6a.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');

const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------- 1: Block ausschneiden und ausfuehren (Regel 34: Aufbau als eigene Pruefung) ----------
// Der Slice beginnt bei shipCostPerkMult (damit shipCostForRange mit im Block liegt) und endet an
// der jaegerCost-Definition. Der Mittelanker ist jetzt scaledShipCost selbst - frueher stand hier
// SHIP_T2_KOMPONENTEN, und genau die gibt es nicht mehr.
const anfang = S.indexOf('function shipCostPerkMult()');
const mitte = S.indexOf('function scaledShipCost(');
const endeAnker = S.indexOf('function jaegerCost(');
check('1-anker: shipCostPerkMult, scaledShipCost und jaegerCost existieren in dieser Reihenfolge',
  anfang >= 0 && mitte > anfang && endeAnker > mitte, { anfang, mitte, endeAnker });

let api = null;
try {
  const block = S.slice(Math.max(0, anfang), endeAnker > anfang ? endeAnker : anfang);
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
  check('1-bau: der Block laesst sich ausfuehren', !!probe.scaledShipCost,
    Object.keys(probe).filter(k => !probe[k]));
  if (probe.scaledShipCost) api = bauer;
} catch (e) {
  check('1-bau: der Block laesst sich ausfuehren', false, String(e).slice(0, 200));
}

if (api) {
  const fixture = { lokal: {}, flotten: [] };
  const mit = (bestand, key) => {
    fixture.lokal = {};
    fixture.flotten = [{ [key]: bestand }];
    return api(fixture);
  };
  // Der Bestand liegt bewusst auf einer ANDEREN Flotte als der lokalen: Die alte Rechnung war
  // (global - lokal) + n - so misst der Test auch, dass Verteilen auf Kolonien nichts umgeht.
  const kostenBei = (bestand, key, basis) => mit(bestand, key).scaledShipCost(basis, key, 0);

  /* ---------- 2: FLACHER Stueckpreis ueber den ganzen Bereich ---------- */
  const B = { erz: 100000 };
  const messpunkte = [0, 1, 100, 249, 250, 251, 500, 1000, 2000, 10000];
  const werte = messpunkte.map(nth => ({ nth, erz: kostenBei(nth, 'cruisers', B).erz }));
  const abweichend = werte.filter(w => w.erz !== B.erz);
  check('2a: der Stueckpreis ist ueber den ganzen Bestandsbereich IDENTISCH mit der Grundzahl',
    abweichend.length === 0, { grundzahl: B.erz, abweichend });
  check('2b: insbesondere an den alten Knickstellen 250/251 - dort sass der alte Deckel',
    kostenBei(250, 'cruisers', B).erz === kostenBei(251, 'cruisers', B).erz
      && kostenBei(0, 'cruisers', B).erz === kostenBei(250, 'cruisers', B).erz,
    { bei0: kostenBei(0, 'cruisers', B).erz, bei250: kostenBei(250, 'cruisers', B).erz,
      bei251: kostenBei(251, 'cruisers', B).erz });

  /* ---------- 3: die Massenflotten-Komponente ist WEG ----------
     3a prueft die Tabelle, 3b den ausgefuehrten Code. Beide braucht es: Die Tabelle koennte
     stehenbleiben, ohne gelesen zu werden (dann waere sie tot, aber harmlos), und der Preis
     koennte auch ohne Tabelle irgendwoher einen Bestandszuschlag beziehen. */
  check('3a: SHIP_T2_KOMPONENTEN existiert nicht mehr',
    api(fixture).SHIP_T2_KOMPONENTEN === null);
  // Die ACHT Klassen, die frueher eine Komponente trugen, samt ihrer alten Schwelle. Bewusst als
  // historische Regressionsliste im Test und NICHT aus einer Tabelle gelesen - die Tabelle gibt es
  // ja gerade nicht mehr. Erwartet wird fuer jede: kein einziger Tier-2-Posten, bei keinem Bestand.
  const FRUEHERE_KOMPONENTEN = [
    ['cruisers', 250], ['waechter', 250], ['destroyers', 200], ['bomber', 200],
    ['schlachtschiff', 100], ['carrier', 100], ['leerenjaeger', 50], ['superschlachtschiff', 25]
  ];
  const T2_STOFFE = ['nanolegierungen', 'quantenchips', 'hochenergiekristalle', 'fusionskerne',
    'kikerne', 'metamaterial', 'singularitaetskern'];
  const verstoesse = [];
  for (const [k, alteSchwelle] of FRUEHERE_KOMPONENTEN) {
    for (const bestand of [alteSchwelle - 1, alteSchwelle, alteSchwelle + 1, alteSchwelle * 10]) {
      const c = kostenBei(bestand, k, { erz: 1000 });
      for (const r of T2_STOFFE) if (c[r] !== undefined) verstoesse.push(k + '@' + bestand + ':' + r);
      if (c.erz !== 1000) verstoesse.push(k + '@' + bestand + ':erz=' + c.erz);
    }
  }
  check('3b: keine der acht frueheren Komponenten-Klassen bekommt bei irgendeinem Bestand einen Zuschlag',
    verstoesse.length === 0, { verstoesse: verstoesse.slice(0, 8) });

  /* ---------- 4: der Bestand wird gar nicht mehr GELESEN ----------
     Die Gegenrichtung zu 2a/3b: Selbst eine Basis mit ungewoehnlichen Schluesseln darf sich
     zwischen leerem und riesigem Bestand nicht unterscheiden - und zwar identisch im ganzen
     zurueckgegebenen Objekt, nicht nur in einem Feld. */
  const basisMix = { erz: 777, kristalle: 333, antimaterie: 11 };
  const leer = JSON.stringify(kostenBei(0, 'schlachtschiff', basisMix));
  const voll = JSON.stringify(kostenBei(99999, 'schlachtschiff', basisMix));
  check('4a: derselbe Preis bei Bestand 0 und 99.999 - vollstaendig, nicht nur je Feld',
    leer === voll, { leer, voll });

  /* ---------- 5: Batch ueber die alte Schwelle hinweg ----------
     shipCostForRange preist je Einheit. Frueher zahlten nur die Einheiten oberhalb der Schwelle
     die Komponente; heute muss ein Batch exakt Menge x Stueckpreis kosten. */
  if (api(fixture).shipCostForRange) {
    fixture.lokal = { schlachtschiff: 95 };
    fixture.flotten = [fixture.lokal];
    const teile = api(fixture);
    const batch = teile.shipCostForRange(
      { costFn: (n) => teile.scaledShipCost({ erz: 400 }, 'schlachtschiff', n) }, 95, 10);
    const fremdeStoffe = T2_STOFFE.filter(r => batch[r] !== undefined);
    check('5a: ein Batch ueber die alte Schwelle kostet exakt Menge x Stueckpreis',
      batch.erz === 400 * 10, { ist: batch.erz, erwartet: 4000 });
    check('5b: und er zieht dabei keinen Tier-2-Posten heran', fremdeStoffe.length === 0,
      { fremdeStoffe, batch });
  } else {
    check('5-vorab: shipCostForRange im Block gefunden', false);
  }
}

// ---------- 6: Anzeigestellen (Regel 6: die zweite Stelle, die die alte Annahme behaelt) ----------
// Verneinende Pruefungen schneiden den PATCHNOTES-Block heraus (Regel 46) - die Historie zitiert
// die alten Formulierungen und darf das auch.
const OHNE_HISTORIE = (() => {
  const v = S.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : S.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? S.slice(0, v) + S.slice(b) : S;
})();
check('6-vorab: der PATCHNOTES-Block liess sich herausschneiden',
  OHNE_HISTORIE.length < S.length && OHNE_HISTORIE.length > S.length * 0.3,
  { ganz: S.length, ohne: OHNE_HISTORIE.length });
check('6a: keine Werft-Karte kuendigt noch eine Massenflotten-Komponente an',
  !OHNE_HISTORIE.includes('${t2KompLine}') && !OHNE_HISTORIE.includes('${superKompLine}')
    && !OHNE_HISTORIE.includes('Massenflotten-Komponente aktiv'));
check('6b: der Hilfetext sagt, dass der Stueckpreis NICHT mehr mit der Flottengroesse steigt',
  S.includes('kostet jedes Schiff einer Klasse denselben Preis'));
// Bewusst der SPEZIFISCHE alte Schiffs-Wortlaut, nicht "gedeckelt bei +100%" allgemein - den
// Deckel gibt es bei anderen Mechaniken (Abgrund-Offiziere) voellig zu Recht weiterhin.
check('6c: die alte Aussage "kostet also das Doppelte" ist aus den Live-Texten verschwunden',
  !OHNE_HISTORIE.includes('Schiff eines Typs kostet also das Doppelte'));
check('6c2: auch die exponentielle Zwischen-Aussage steht nicht mehr in den Live-Texten',
  !OHNE_HISTORIE.includes('wächst der Stückpreis exponentiell weiter'));
// 6d ist die Umkehrung der frueheren Paritaetswache: Der Hilfetext darf keine Klasse mehr mit
// einer Bestands-Schwelle bewerben. Geprueft wird der Hilfe-Abschnitt selbst, auf seinen
// title:-Anker gescopt - der nackte Titel wird auch in Kommentaren zitiert (Regel 6/39).
{
  const hilfeStart = OHNE_HISTORIE.indexOf("title:'Imperiums-Skalierung der Kosten'");
  check('6d-vorab: der Hilfe-Abschnitt ist auffindbar', hilfeStart >= 0);
  const hilfe = hilfeStart >= 0 ? OHNE_HISTORIE.slice(hilfeStart, hilfeStart + 3000) : '';
  const wirbt = /ab \d+ Stück|oberhalb einer Bestands-Schwelle je weiterem Schiff eine/.test(hilfe);
  check('6d: der Hilfetext verspricht keine Bestands-Schwelle mehr', !wirbt,
    { ausschnitt: hilfe.slice(0, 0) || undefined });
}

ende();
