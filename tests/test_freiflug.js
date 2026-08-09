// Freiflug-Testfeld (freiflug_test.html): der Extraktions-Kreislauf muss tragen.
//
// Geprüft wird die REGEL, nicht die Momentaufnahme – jede Erwartung wird gegen einen im selben
// Lauf GEMESSENEN Ausgangsstand verglichen, nie gegen eingetippte Zahlen (Hausregel 2). Fixture-
// Schlüssel und Bediennamen kommen aus dem Auskunftsfeld window.FREIFLUG, nicht aus dem Gedächtnis
// (Hausregel 4).
//
// GEGENPROBE (in beide Richtungen ausgeführt, 09.08.2026) – sechs gezielte Sabotagen an
// freiflug_test.html, jede muss GENAU die zugehörige Prüfung rot machen:
//   * SCHWENK_KEGEL 1.15 -> 0.15            -> "ein angepeiltes Ziel lässt sich abschießen"
//   * Rangfolge in kontextAktion entfernt   -> "Anomalie schlägt näheren Asteroid"
//   * andocken(): S.fracht = {} entfernt    -> "Andocken leert den Laderaum"
//   * B.verlustAnteil 0.5 -> 0              -> "Zerstörung kostet einen Teil der Ladung"
//   * frachtDazu(): Deckel entfernt         -> "Laderaum deckelt ... auch wenn weitergebohrt wird"
//   * Set-Stufen zählen nicht mehr additiv  -> "Set-Stufe 1"/"Set-Stufe 2"
//
// DREI dieser sechs blieben im ERSTEN Durchgang unbemerkt – der Test war dort ein Blindgänger,
// und nur die Gegenprobe hat es gezeigt:
//   1. Rangfolge: Der Nachweis hing am Zufall der Sektorerzeugung (lag zufällig kein Asteroid
//      im Weg, prüfte er nichts). Jetzt wird der Konflikt mit legeAsteroidNeben() ERZWUNGEN und
//      vorher geprüft, dass der Asteroid wirklich näher liegt.
//   2. Verlustanteil: Verglichen wurde gegen Math.floor(Gesamtsumme). Die Summe der je Ressource
//      abgerundeten Posten liegt fast immer darunter, also war die Prüfung auch bei Verlust 0
//      grün. Jetzt wird gegen die je Ressource abgerundete Ladung verglichen.
//   3. Laderaum-Deckel: Die Füll-Schleife brach beim Erreichen der Kapazität selbst ab – der Test
//      hörte genau dort auf zu messen, wo der Fehler beginnt. Jetzt wird darüber hinaus gebohrt.
//
// NACHTRAG Notsprung (drei weitere Sabotagen, ebenfalls in beide Richtungen ausgeführt):
//   * Notsprung-Zweig entfernt (`if (!lage.heimwaerts)` -> `if (true)`)
//                                           -> "Notsprung bringt das Schiff aus dem Sektor heraus"
//   * B.notsprungLadung 0.4 -> 0            -> "Notsprung kostet Ladung"
//   * heimwaerts immer wahr                 -> "ohne Deuterium ist kein Sprung in die Tiefe möglich"
const fs = require('fs');
const path = require('path');
const { starteBrowser, WURZEL, pruefer, ueberspringen } = require('./lib/umgebung');
const { check, ende } = pruefer();

const DATEI = path.join(WURZEL, 'freiflug_test.html');
if (!fs.existsSync(DATEI)) ueberspringen('freiflug_test.html nicht vorhanden');

const zustand = page => page.evaluate(() => window.FREIFLUG.zustand());
const summe = o => Object.keys(o).reduce((n,k) => n + o[k], 0);

(async () => {
  const browser = await starteBrowser();
  const page = await (await browser.newContext({ viewport:{ width:1280, height:800 } })).newPage();
  const fehler = [];
  page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  page.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));

  await page.goto('file://' + DATEI);
  await page.waitForFunction(() => window.FREIFLUG && window.FREIFLUG.zustand().laeuft, { timeout: 15000 });

  const start = await zustand(page);
  check('bootet und läuft', start.laeuft === true && start.sektor === 'heim');
  check('Startausrüstung ist eingebaut', start.eingebaut > 0, { eingebaut: start.eingebaut });

  // ---------------------------------------------------------------- 1. Aktive Steuerung
  // Gemessen wird die Beschleunigung, nicht ein Zielwert: Schub an -> Tempo muss steigen und der
  // Ort sich ändern; Schub aus -> die Reibung muss es wieder abbauen.
  const vorSchub = await zustand(page);
  await page.evaluate(() => window.FREIFLUG.taste('w', true));
  await page.waitForTimeout(800);
  const imSchub = await zustand(page);
  await page.evaluate(() => window.FREIFLUG.taste('w', false));
  const weg = Math.hypot(imSchub.x - vorSchub.x, imSchub.y - vorSchub.y);
  check('Schub beschleunigt das Schiff', imSchub.tempo > vorSchub.tempo + 20 && weg > 40,
    { tempoVorher: Math.round(vorSchub.tempo), tempoNachher: Math.round(imSchub.tempo), weg: Math.round(weg) });
  await page.waitForTimeout(900);
  const nachSchub = await zustand(page);
  check('ohne Schub bremst die Reibung', nachSchub.tempo < imSchub.tempo * 0.5,
    { vorher: Math.round(imSchub.tempo), nachher: Math.round(nachSchub.tempo) });

  // Das Tempo muss an der Höchstgeschwindigkeit des Rumpfes hängen, nicht frei wachsen.
  await page.evaluate(() => window.FREIFLUG.taste('w', true));
  await page.waitForTimeout(2500);
  const voll = await zustand(page);
  await page.evaluate(() => window.FREIFLUG.taste('w', false));
  check('Höchstgeschwindigkeit wird eingehalten', voll.tempo <= voll.werte.maxTempo * 1.05,
    { tempo: Math.round(voll.tempo), max: Math.round(voll.werte.maxTempo) });

  // ------------------------------------------------------------------------ 2. Sprung
  const torDa = await page.evaluate(() => window.FREIFLUG.anTor('guertel'));
  check('Heimatorbit hat ein Sprungtor zum Erzgürtel', torDa === true);
  const vorSprung = await zustand(page);
  await page.evaluate(() => window.FREIFLUG.sprung());
  await page.waitForTimeout(300);
  const nachSprung = await zustand(page);
  check('Sprung wechselt den Sektor', nachSprung.sektor === 'guertel',
    { vorher: vorSprung.sektor, nachher: nachSprung.sektor });
  check('Sprung kostet Deuterium',
    (nachSprung.lager.deuterium || 0) + (nachSprung.fracht.deuterium || 0) <
    (vorSprung.lager.deuterium || 0) + (vorSprung.fracht.deuterium || 0),
    { vorher: vorSprung.lager.deuterium, nachher: nachSprung.lager.deuterium });
  check('tieferer Sektor hat Gegner', nachSprung.gegner > 0, { gegner: nachSprung.gegner });

  // ------------------------------------------------------------------------- 3. Abbau
  // BEWUSST im Erzgürtel und NICHT im Heimatorbit: Dort liegen Asteroiden im Andockradius der
  // Station, und weil die Kontext-Taste das Andocken vorzieht, sicherte der erste Entwurf dieses
  // Tests bei jedem "Abbau" in Wahrheit die Ladung – die drei folgenden Prüfungen verglichen
  // danach zweimal einen LEEREN Laderaum und waren grün, ohne irgendetwas zu belegen.
  const ast = await page.evaluate(() => {
    const a = window.FREIFLUG.naechsterAsteroid();
    if (a) window.FREIFLUG.setzeSchiff(a.x + 120, a.y);
    return a;
  });
  check('Sektor enthält Asteroiden', !!ast, ast && ast.typ);
  const vorAbbau = await zustand(page);
  await page.evaluate(() => window.FREIFLUG.taste('e', true));
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.FREIFLUG.taste('e', false));
  const nachAbbau = await zustand(page);
  check('Abbau füllt den Laderaum', nachAbbau.frachtSumme > vorAbbau.frachtSumme,
    { vorher: Math.round(vorAbbau.frachtSumme), nachher: Math.round(nachAbbau.frachtSumme) });

  // Der Laderaum muss WIRKLICH deckeln – gemessen am eigenen Grenzwert des Rumpfes, nicht an
  // einer eingetippten Zahl. Wichtig: Der Test muss den Deckel auch ERREICHEN, sonst prüft er
  // nichts (Hausregel 7: messen, was gemessen werden soll, nicht den Deckel eines leeren Fasses).
  const kapazitaet = nachAbbau.werte.fracht;
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => {
      const a = window.FREIFLUG.naechsterAsteroid();
      if (a) window.FREIFLUG.setzeSchiff(a.x + 120, a.y);
    });
    await page.evaluate(() => window.FREIFLUG.taste('e', true));
    await page.waitForTimeout(650);
    await page.evaluate(() => window.FREIFLUG.taste('e', false));
    const z = await zustand(page);
    if (z.frachtSumme >= kapazitaet - 1) break;
  }
  const amDeckel = await zustand(page);
  check('Laderaum wird beim Abbau wirklich voll (sonst prüft der Deckel nichts)',
    amDeckel.frachtSumme > kapazitaet * 0.9,
    { fracht: Math.round(amDeckel.frachtSumme), kapazitaet: Math.round(kapazitaet) });
  // ÜBER den Deckel hinaus weiterbohren. Ohne diese Runden prüfte der Test nichts: Die Schleife
  // oben bricht selbst bei Erreichen der Kapazität ab, und ein entfernter Deckel fiel deshalb in
  // der Gegenprobe nicht auf – der Test hörte genau dort auf zu messen, wo der Fehler beginnt.
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      const a = window.FREIFLUG.naechsterAsteroid();
      if (a) window.FREIFLUG.setzeSchiff(a.x + 120, a.y);
    });
    await page.evaluate(() => window.FREIFLUG.taste('e', true));
    await page.waitForTimeout(700);
    await page.evaluate(() => window.FREIFLUG.taste('e', false));
  }
  const ueberDeckel = await zustand(page);
  check('Laderaum deckelt bei der Kapazität des Rumpfes, auch wenn weitergebohrt wird',
    ueberDeckel.frachtSumme <= kapazitaet + 0.5,
    { fracht: Math.round(ueberDeckel.frachtSumme), kapazitaet: Math.round(kapazitaet) });

  // --------------------------------------------------------------------- 4. Andocken
  // Der Kern des Extraktions-Kreislaufs: ungesicherte Ladung wird beim Andocken zu gesicherter.
  await page.evaluate(() => window.FREIFLUG.betrete('heim', null));
  await page.waitForTimeout(150);
  const vorDock = await zustand(page);
  const lagerVorDock = summe(vorDock.lager);
  check('vor dem Andocken liegt wirklich Ladung an Bord', vorDock.frachtSumme > 10,
    { fracht: Math.round(vorDock.frachtSumme) });
  await page.evaluate(() => { window.FREIFLUG.anStation(); window.FREIFLUG.andocken(); });
  await page.waitForTimeout(250);
  const nachDock = await zustand(page);
  check('Andocken leert den Laderaum', nachDock.frachtSumme < 1,
    { vorher: Math.round(vorDock.frachtSumme), nachher: Math.round(nachDock.frachtSumme) });
  check('Andocken schreibt die Ladung dem Koloniespeicher gut',
    summe(nachDock.lager) >= lagerVorDock + Math.floor(vorDock.frachtSumme) - 8,
    { lagerVorher: Math.round(lagerVorDock), lagerNachher: Math.round(summe(nachDock.lager)),
      ladung: Math.round(vorDock.frachtSumme) });
  check('Andocken setzt die Hülle instand', nachDock.huelle === nachDock.werte.huelleMax);
  await page.evaluate(() => document.getElementById('tafelWeiter').click());
  await page.waitForTimeout(150);
  await page.evaluate(() => window.FREIFLUG.betrete('guertel', null));
  await page.waitForTimeout(150);

  // --------------------------------------------------------- 5. Risiko: Zerstörung
  // Es genügt NICHT zu prüfen, dass der Laderaum leer ist – er wäre auch leer, wenn alles gerettet
  // würde. Geprüft wird, dass WENIGER im Speicher ankommt, als an Bord war.
  await page.evaluate(() => window.FREIFLUG.heile());
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => {
      const a = window.FREIFLUG.naechsterAsteroid();
      if (a) window.FREIFLUG.setzeSchiff(a.x + 120, a.y);
    });
    await page.evaluate(() => window.FREIFLUG.taste('e', true));
    await page.waitForTimeout(650);
    await page.evaluate(() => window.FREIFLUG.taste('e', false));
    const z = await zustand(page);
    if (z.frachtSumme > 30) break;
  }
  const vorTod = await zustand(page);
  const lagerVorTod = summe(vorTod.lager);
  check('vor dem Test liegt Ladung an Bord', vorTod.frachtSumme > 5, { fracht: Math.round(vorTod.frachtSumme) });
  // Vergleichsgröße ist die JE RESSOURCE abgerundete Ladung – genau das, was bei vollständiger
  // Rettung im Speicher ankäme. Mit Math.floor(Gesamtsumme) war die Prüfung wertlos: Die Summe
  // mehrerer abgerundeter Einzelposten liegt fast immer darunter, sodass der Test auch bei
  // Verlustanteil 0 grün blieb (in der Gegenprobe aufgefallen).
  const anBordGefloort = Object.keys(vorTod.fracht)
    .reduce((n, k) => n + Math.floor(vorTod.fracht[k]), 0);
  await page.evaluate(() => window.FREIFLUG.zerstoere());
  await page.waitForTimeout(250);
  const nachTod = await zustand(page);
  const gerettet = summe(nachTod.lager) - lagerVorTod;
  check('Zerstörung kostet einen Teil der ungesicherten Ladung',
    gerettet < anBordGefloort,
    { anBord: anBordGefloort, gerettet: Math.round(gerettet) });
  check('Zerstörung vernichtet nicht die ganze Ladung', gerettet > 0,
    { anBord: Math.round(vorTod.frachtSumme), gerettet: Math.round(gerettet) });
  check('Zerstörung lässt den Koloniespeicher unangetastet',
    summe(nachTod.lager) >= lagerVorTod);

  // ------------------------------------------------- 6. Kontext-Taste: Rangfolge
  // Der Fehler, den diese Prüfung fängt: Bei reinem Abstandsvergleich gewinnt ein zufällig
  // näherer Asteroid gegen die Anomalie, die der Spieler ansteuern wollte. Einmalige
  // Fundstücke müssen den beliebig wiederholbaren Abbau schlagen.
  await page.evaluate(() => { window.FREIFLUG.betrete('schwelle', null); window.FREIFLUG.heile(); });
  await page.waitForTimeout(150);
  const anomalien = await page.evaluate(() => window.FREIFLUG.anomalieListe());
  check('tiefe Sektoren enthalten Anomalien', anomalien.length > 0, { anzahl: anomalien.length });
  // Der Konflikt wird ERZWUNGEN, nicht abgewartet: Vor jedem Versuch wird ein Asteroid näher an
  // das Schiff gelegt als die Anomalie. Ohne diesen Schritt hing der Nachweis am Zufall der
  // Sektorerzeugung – in der Gegenprobe blieb der Test grün, obwohl die Rangfolge entfernt war,
  // weil in diesem Sektor zufällig kein Asteroid im Weg lag.
  let anomalienAusgeloest = 0, konflikte = 0;
  for (let i = 0; i < anomalien.length; i++) {
    const vorher = (await zustand(page)).statistik.anomalien;
    const konflikt = await page.evaluate(i => {
      window.FREIFLUG.heile();
      window.FREIFLUG.anAnomalie(i);
      return window.FREIFLUG.legeAsteroidNeben(34, 0);
    }, i);
    if (konflikt && konflikt.abstand < 26) konflikte++;
    await page.evaluate(() => window.FREIFLUG.taste('e', true));
    await page.waitForTimeout(600);
    await page.evaluate(() => window.FREIFLUG.taste('e', false));
    const z = await zustand(page);
    if (z.statistik.anomalien > vorher) anomalienAusgeloest++;
  }
  check('der Asteroid lag wirklich näher als die Anomalie (sonst prüft die Rangfolge nichts)',
    konflikte === anomalien.length, { konflikte, versuche: anomalien.length });
  check('jede angeflogene Anomalie löst aus (Anomalie schlägt näheren Asteroid)',
    anomalienAusgeloest === anomalien.length,
    { ausgeloest: anomalienAusgeloest, vorhanden: anomalien.length });

  // -------------------------------------------------------------- 7. Wracks und Beute
  await page.evaluate(() => { window.FREIFLUG.betrete('riff', null); window.FREIFLUG.heile(); });
  await page.waitForTimeout(150);
  const wracks = await page.evaluate(() => window.FREIFLUG.wrackListe());
  check('Piratengebiet enthält Wracks', wracks.length > 0, { anzahl: wracks.length });
  const vorWrack = await zustand(page);
  await page.evaluate(() => { window.FREIFLUG.heile(); window.FREIFLUG.anWrack(0); });
  await page.evaluate(() => window.FREIFLUG.taste('e', true));
  await page.waitForTimeout(700);
  await page.evaluate(() => window.FREIFLUG.taste('e', false));
  await page.waitForTimeout(400);
  const nachWrack = await zustand(page);
  // Nicht auf liegengebliebene Beutebrocken prüfen: Das Schiff steht beim Plündern innerhalb der
  // Aufsammel-Reichweite, die Brocken fliegen also sofort in den Laderaum. Gemessen wird der WERT,
  // der ankommt – als Ladung, als Modul oder als noch fliegender Brocken.
  const wertGewonnen = (nachWrack.frachtSumme > vorWrack.frachtSumme) ||
                       (nachWrack.module > vorWrack.module) || (nachWrack.beute > vorWrack.beute);
  check('Wrack lässt sich plündern', nachWrack.statistik.wracks > vorWrack.statistik.wracks,
    { vorher: vorWrack.statistik.wracks, nachher: nachWrack.statistik.wracks });
  check('Plündern bringt Wert ein', wertGewonnen,
    { frachtVorher: Math.round(vorWrack.frachtSumme), frachtNachher: Math.round(nachWrack.frachtSumme),
      module: nachWrack.module, beute: nachWrack.beute });

  // ------------------------------------------------------------------- 8. Kampf
  // Ein erfasstes und angepeiltes Ziel MUSS fallen – sonst ist die Waffe wirkungslos.
  await page.evaluate(() => {
    window.FREIFLUG.betrete('guertel', null);
    window.FREIFLUG.heile();
    window.FREIFLUG.nurEinGegner('pirat_jaeger');
  });
  const vorKampf = await zustand(page);
  await page.evaluate(() => window.FREIFLUG.taste(' ', true));
  let abschuss = false;
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => window.FREIFLUG.richteAus());
    await page.waitForTimeout(300);
    const z = await zustand(page);
    if (z.statistik.abschuesse > vorKampf.statistik.abschuesse) { abschuss = true; break; }
  }
  await page.evaluate(() => window.FREIFLUG.taste(' ', false));
  check('ein angepeiltes Ziel lässt sich abschießen', abschuss);
  const nachKampf = await zustand(page);
  check('Abschuss wirft Beute ab', nachKampf.beute > 0 || nachKampf.frachtSumme > vorKampf.frachtSumme,
    { beute: nachKampf.beute });

  // --------------------------------------------------------------- 9. Module und Sets
  // Set-Stufen zählen ADDITIV: zwei Teile geben die erste Stufe, drei Teile zusätzlich die zweite.
  //
  // ACHTUNG, hier lag ein Blindgänger: Der Späher hat nur DREI Modulplätze und startet mit zwei
  // belegten. Der erste Entwurf baute zwei Set-Teile ein, von denen still nur EINES ankam – der
  // gemessene Zuwachs war reiner Modulwert, und die Prüfung "Set greift" war grün, ohne dass je
  // ein Set aktiv war. Deshalb: Plätze zuerst leeren und die Zahl der eingebauten Module prüfen.
  await page.evaluate(() => { window.FREIFLUG.betrete('heim', null); window.FREIFLUG.heile(); window.FREIFLUG.leereSlots(); });
  const ohneSet = await zustand(page);
  check('Slots lassen sich leeren', ohneSet.eingebaut === 0, { eingebaut: ohneSet.eingebaut });

  // Erwartungswerte aus den DEFS ableiten, nicht eintippen (Hausregel 2).
  const erwartet = await page.evaluate(() => {
    const md = window.FREIFLUG.module.find(m => m.key === 'scanner');
    const mult = window.FREIFLUG.seltenheiten.selten.mult;
    const set = window.FREIFLUG.sets.find(s => s.key === 'leerenjaeger');
    return {
      nurModul: md.basis * mult,
      setScan: set.stufen.find(s => s.teile === 2).wirkung.scan,
      setGlueck: set.stufen.find(s => s.teile === 3).wirkung.glueck
    };
  });

  await page.evaluate(() => {
    const a = window.FREIFLUG.gibModul('scanner', 'selten');
    window.FREIFLUG.einbauen(a.id);
  });
  const einTeil = await zustand(page);
  check('ein Modul ist eingebaut', einTeil.eingebaut === 1, { eingebaut: einTeil.eingebaut });
  check('Modul erhöht seinen Wirkungskanal um genau seinen Wert',
    Math.abs(einTeil.boni.scan - erwartet.nurModul) < 0.001,
    { gemessen: einTeil.boni.scan.toFixed(3), erwartet: erwartet.nurModul.toFixed(3) });
  check('ein einzelnes Teil löst noch KEINE Set-Stufe aus',
    einTeil.boni.scan < erwartet.nurModul + erwartet.setScan - 0.001);

  await page.evaluate(() => {
    const b = window.FREIFLUG.gibModul('antrieb', 'selten');
    window.FREIFLUG.einbauen(b.id);
  });
  const zweiTeile = await zustand(page);
  check('zwei Module sind eingebaut', zweiTeile.eingebaut === 2, { eingebaut: zweiTeile.eingebaut });
  check('Set-Stufe 1 (2 Teile Leerenjäger) kommt zusätzlich zum Modulwert',
    Math.abs(zweiTeile.boni.scan - (erwartet.nurModul + erwartet.setScan)) < 0.001,
    { gemessen: zweiTeile.boni.scan.toFixed(3),
      erwartet: (erwartet.nurModul + erwartet.setScan).toFixed(3) });
  check('Set-Stufe 2 ist bei zwei Teilen noch nicht aktiv', zweiTeile.boni.glueck < 0.001,
    { glueck: zweiTeile.boni.glueck });

  await page.evaluate(() => {
    const c = window.FREIFLUG.gibModul('tarnsystem', 'selten');
    window.FREIFLUG.einbauen(c.id);
  });
  const dreiTeile = await zustand(page);
  check('drei Module sind eingebaut', dreiTeile.eingebaut === 3, { eingebaut: dreiTeile.eingebaut });
  check('Set-Stufe 2 (3 Teile) kommt ADDITIV obendrauf, Stufe 1 bleibt erhalten',
    Math.abs(dreiTeile.boni.glueck - erwartet.setGlueck) < 0.001 &&
    dreiTeile.boni.scan >= zweiTeile.boni.scan - 0.001,
    { glueck: dreiTeile.boni.glueck.toFixed(3), erwartetGlueck: erwartet.setGlueck.toFixed(3),
      scanVorher: zweiTeile.boni.scan.toFixed(3), scanNachher: dreiTeile.boni.scan.toFixed(3) });

  // Seltenheit muss den Wert steigern – dieselbe Rangordnung wie MODULE_RARITY der Spieldatei
  const seltenheiten = await page.evaluate(() => window.FREIFLUG.seltenheiten);
  check('Seltenheitsstufen steigen monoton',
    Object.keys(seltenheiten).every((k, i, a) =>
      i === 0 || seltenheiten[k].mult > seltenheiten[a[i-1]].mult),
    Object.keys(seltenheiten).map(k => seltenheiten[k].mult).join('<'));

  // ------------------------------------------------- 9b. Notsprung (keine Sackgasse)
  // Die beiden tiefsten Sektoren haben KEINE Station und KEINE Deuterium-Asteroiden. Ohne
  // Notsprung wäre ein Spieler dort ohne Treibstoff gefangen, und der einzige Ausweg wäre die
  // eigene Zerstörung – ohne dass ihm das irgendwo gesagt würde. Geprüft wird beides: dass die
  // Sackgasse überhaupt entstehen KANN (sonst prüft der Rest nichts) und dass sie einen Ausgang hat.
  const tiefeOhneTreibstoff = await page.evaluate(() => {
    const s = window.FREIFLUG.sektoren.find(x => x.key === 'saum');
    return { station: !!s.station, hatDeuterium: s.asteroiden.arten.indexOf('deuteriumeis') >= 0 };
  });
  check('der tiefste Sektor hat weder Station noch Deuterium-Quelle (die Sackgasse ist real)',
    !tiefeOhneTreibstoff.station && !tiefeOhneTreibstoff.hatDeuterium, tiefeOhneTreibstoff);

  await page.evaluate(() => {
    window.FREIFLUG.betrete('saum', null);
    window.FREIFLUG.heile();
    window.FREIFLUG.setzeLager('deuterium', 0);
    window.FREIFLUG.setzeFracht('deuterium', 0);
    window.FREIFLUG.setzeFracht('xenit', 120);
  });
  await page.waitForTimeout(150);
  const lage = await page.evaluate(() => window.FREIFLUG.torLage('schwelle'));
  check('ohne Deuterium reicht der Vorrat für keinen regulären Sprung',
    lage && lage.reicht === false && lage.heimwaerts === true, lage);

  const vorNot = await zustand(page);
  await page.evaluate(() => window.FREIFLUG.anTor('schwelle'));
  await page.evaluate(() => window.FREIFLUG.sprung());
  await page.waitForTimeout(300);
  const nachNot = await zustand(page);
  check('Notsprung bringt das Schiff aus dem Sektor heraus',
    nachNot.sektor === 'schwelle', { vorher: vorNot.sektor, nachher: nachNot.sektor });
  check('Notsprung kostet Ladung',
    nachNot.frachtSumme < vorNot.frachtSumme,
    { vorher: Math.round(vorNot.frachtSumme), nachher: Math.round(nachNot.frachtSumme) });
  check('Notsprung verbrennt nicht die ganze Ladung', nachNot.frachtSumme > 0,
    { rest: Math.round(nachNot.frachtSumme) });

  // Die Gegenrichtung muss gesperrt bleiben – sonst wäre der Notsprung ein Gratis-Weg nach unten.
  await page.evaluate(() => {
    window.FREIFLUG.setzeLager('deuterium', 0);
    window.FREIFLUG.setzeFracht('deuterium', 0);
  });
  const abwaerts = await page.evaluate(() => window.FREIFLUG.torLage('saum'));
  check('abwärts führendes Tor gilt nicht als heimwärts',
    abwaerts && abwaerts.heimwaerts === false, abwaerts);
  const vorAb = await zustand(page);
  await page.evaluate(() => { window.FREIFLUG.anTor('saum'); window.FREIFLUG.sprung(); });
  await page.waitForTimeout(300);
  const nachAb = await zustand(page);
  check('ohne Deuterium ist kein Sprung in die Tiefe möglich',
    nachAb.sektor === vorAb.sektor, { vorher: vorAb.sektor, nachher: nachAb.sektor });

  // -------------------------------------------------------- 10. Inhalte vollständig
  const inhalt = await page.evaluate(() => ({
    sektoren: window.FREIFLUG.sektoren.length,
    schiffe: window.FREIFLUG.schiffe.length,
    module: window.FREIFLUG.module.length,
    sets: window.FREIFLUG.sets.length,
    gegner: Object.keys(window.FREIFLUG.gegnerDefs).length,
    asteroiden: Object.keys(window.FREIFLUG.asteroidDefs).length,
    anomalien: window.FREIFLUG.anomalieDefs.length,
    wracks: window.FREIFLUG.wrackDefs.length,
    ereignisse: window.FREIFLUG.ereignisDefs.length
  }));
  check('alle Inhaltstabellen sind gefüllt',
    inhalt.sektoren >= 5 && inhalt.schiffe >= 5 && inhalt.module >= 10 && inhalt.sets >= 3 &&
    inhalt.gegner >= 8 && inhalt.asteroiden >= 8 && inhalt.anomalien >= 6 &&
    inhalt.wracks >= 5 && inhalt.ereignisse >= 9, inhalt);

  // Jeder Gegnertyp braucht ein Verhalten, jeder Asteroid einen Ertrag, jedes Modul einen Text –
  // die Pflicht "Icon UND vollständige Beschreibung" der Spieldatei, auf diesen Prototyp übertragen.
  const luecken = await page.evaluate(() => {
    const l = [];
    const G = window.FREIFLUG.gegnerDefs;
    for (const k in G) if (!G[k].ki || !G[k].pts || !G[k].beute) l.push('gegner:' + k);
    const A = window.FREIFLUG.asteroidDefs;
    for (const k in A) if (!A[k].name || !A[k].ertrag || !Object.keys(A[k].ertrag).length) l.push('asteroid:' + k);
    for (const m of window.FREIFLUG.module) if (!m.text || m.text.length < 40) l.push('modul:' + m.key);
    for (const s of window.FREIFLUG.schiffe) if (!s.text || s.text.length < 40) l.push('schiff:' + s.key);
    for (const s of window.FREIFLUG.sektoren) if (!s.text || s.text.length < 40) l.push('sektor:' + s.key);
    return l;
  });
  check('jeder Inhalt hat Verhalten und vollständige Beschreibung', luecken.length === 0, luecken);

  // ------------------------------------------------------------------ 11. Sauberkeit
  check('keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 4));

  await ende(() => browser.close());
})();
