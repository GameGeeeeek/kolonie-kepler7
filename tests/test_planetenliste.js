// Planetenliste als konsistente Detailfläche (Etappe B-1 des Sektorkarten-Umbaus, v8.496.0):
// Erstfund-Ertrag sichtbar, Wechsel-Knopf auf der eigenen Kolonie, Markup-Zwischenspeicher.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_planetenliste.js
//   rot:   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_planetenliste.js
//   Am alten Stand fallen 1 (kein Erstfund), 2a/2b (kein Wechsel-Knopf) und 3a (Liste wird
//   jede Sekunde neu geschrieben).
//
// Uhr-Regel (Hausregel 18): Für das Cache-Messfenster wird Date.now() EINGEFROREN. Die Liste färbt
// Kosten nach Leistbarkeit, und die Produktion hebt die Vorräte jede Sekunde - überschreitet ein
// Vorrat mitten im Fenster eine Kostenschwelle, ändert sich das Markup ZU RECHT. Mit stehender Uhr
// steht die Produktion, das Markup ist konstant, und ein kaputter Cache fällt trotzdem durch.
// Fixture-Schlüssel aus dem Code abgelesen (Hausregel 4): Kepler-Planeten vesna/rhea/aion.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    return j({});
  };
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  const now = Date.now();
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, ships: 3, colonyShips: 1, missions: [] },
    // rhea ist entdeckt und kolonisiert (Wechsel-Knopf), aion nur entdeckt (kein Erstfund mehr),
    // vesna unentdeckt (Erstfund-Zeile). Aktive Basis ist home, damit rhea "Wechseln" zeigt.
    discovered: { rhea: true, aion: true },
    // Kolonie-Form aus dem Code abgelesen (Zeile ~47742): buildings + fleet, wie colonizePlanet
    // sie anlegt - ein nacktes Objekt ließ den Boot mit 'reading solar' abstürzen.
    // Rheas Kolonieflotte braucht eigene Erkundungsschiffe: Prüfung 2b wechselt die aktive
    // Basis dorthin, und Prüfung 4 klickt DANACH auf "Schicken" - mit leerer Flotte wäre der
    // Knopf zu Recht deaktiviert und die Prüfung fiele aus dem falschen Grund (Hausregel 28).
    colonies: { rhea: { buildings: { solar: 3, mine: 2, habitat: 1 }, fleet: { ships: 2, missions: [] } } }, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, prestige: 4, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    nextPlanetEventCheck: now + 3600000
  });

  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  const liste = await page.evaluate(() => {
    const el = document.getElementById('planetList');
    return el ? { da: true, zeilen: el.querySelectorAll('.card-row').length } : { da: false };
  });
  check('0-vorab: Planetenliste des Heimatsystems ist gefüllt', liste.da && liste.zeilen >= 5, liste);
  if (!liste.da || fehler.length || liste.zeilen < 5) return ende(async () => browser.close());

  // ---- 1) Erstfund-Zeile: nur beim unentdeckten Planeten, mit BEIDEN Werten ---------------------
  // Regel statt Momentaufnahme (Hausregel 3): geprüft wird, dass die Zeile den Begriff und beide
  // Zahlen ENTHÄLT - nicht ihr exakter Wortlaut.
  const erstfund = await page.evaluate(() => {
    const zeilen = [...document.querySelectorAll('#planetList .card-row')];
    const zeileVon = name => zeilen.find(z => z.textContent.includes(name));
    const unent = zeileVon('Trümmerfeld Vesna');   // unentdeckt, discoveryBonus laut PLANETS vorhanden
    const entd = zeileVon('Kristallgürtel Aion');  // entdeckt
    return {
      unentHatErstfund: !!unent && /Erstfund/.test(unent.textContent),
      unentHatDanach: !!unent && /danach/.test(unent.textContent),
      entdOhneErstfund: !!entd && !/Erstfund/.test(entd.textContent)
    };
  });
  check('1: unentdeckter Planet zeigt den Erstfund-Ertrag samt "danach"-Wert',
    erstfund.unentHatErstfund && erstfund.unentHatDanach, erstfund);
  check('1: entdeckter Planet zeigt KEINE Erstfund-Zeile mehr', erstfund.entdOhneErstfund, erstfund);

  // ---- 2) Wechsel-Knopf auf der eigenen Kolonie --------------------------------------------------
  // Selektor auf #planetList beschränkt (Hausregel 5) - data-planet-switch existiert auch im
  // Kartenmenü und im Seitenpanel.
  const vorher = await page.evaluate(() => {
    const btn = document.querySelector('#planetList [data-planet-switch="rhea"]');
    return { da: !!btn, deaktiviert: btn ? btn.disabled : null };
  });
  check('2a: die kolonisierte Kolonie trägt einen Wechsel-Knopf', vorher.da && vorher.deaktiviert === false, vorher);
  if (vorher.da) {
    await page.evaluate(() => document.querySelector('#planetList [data-planet-switch="rhea"]').click());
    await page.waitForTimeout(400);
    // DOM-only ('state' lebt im Skript-Scope, nicht auf window): Der Knopf wird aus
    // activeBasePlanet gerendert - steht er nach dem Klick deaktiviert auf "aktive Basis",
    // IST der Wechsel passiert (Regel 26: messen, was der Spieler sieht; Regel 28: der Grund -
    // der Text - wird mitgeprüft, nicht nur irgendein Zustandswechsel).
    const nachher = await page.evaluate(() => {
      const b = document.querySelector('#planetList [data-planet-switch="rhea"]');
      return b ? { deaktiviert: b.disabled, text: b.textContent.trim() } : null;
    });
    check('2b: der Klick wechselt die aktive Basis auf die Kolonie',
      !!nachher && nachher.deaktiviert === true && /aktive Basis/.test(nachher.text), nachher);
  }

  // ---- 3) Markup-Zwischenspeicher: Leerlauf schreibt nicht, Änderung schreibt --------------------
  // Uhr einfrieren, DANN markieren (Hausregel 18 - Reihenfolge ist Teil der Regel).
  await page.evaluate(() => {
    const fest = Date.now();
    Date.now = () => fest;
  });
  await page.waitForTimeout(1100);   // ein Tick mit stehender Uhr vergehen lassen
  await page.evaluate(() => {
    document.querySelectorAll('#planetList .card-row').forEach((n, i) => { n.__marke = 'm' + i; });
    window.__markenZahl = document.querySelectorAll('#planetList .card-row').length;
  });
  await page.waitForTimeout(3400);   // mindestens drei Sekunden-Ticks
  const leerlauf = await page.evaluate(() => {
    const zeilen = [...document.querySelectorAll('#planetList .card-row')];
    return { erwartet: window.__markenZahl, markiert: zeilen.filter(n => n.__marke).length, gesamt: zeilen.length };
  });
  check('3a: im Leerlauf wird die Liste über mehrere Ticks NICHT neu geschrieben',
    leerlauf.markiert === leerlauf.erwartet && leerlauf.gesamt === leerlauf.erwartet, leerlauf);

  // ---- 3b + 4 in EINER Messung: Der Klick nach den übersprungenen Ticks (Pflicht bei jeder
  // neuen setBoxHtml-Anwendung) ist zugleich die Kein-Einfrieren-Gegenprobe - der Missionsstart
  // muss das Markup sichtbar auf "unterwegs" umbauen. DOM-only, ohne state-Zugriff.
  const klick = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll('#planetList [data-send]')].find(b => !b.disabled);
    if (!btn) return { keinKnopf: true };
    const ziel = btn.getAttribute('data-send');
    btn.click();
    await new Promise(r => setTimeout(r, 1600));   // ein Render-Tick nach dem Klick
    const zeilen = [...document.querySelectorAll('#planetList .card-row')];
    const neuGebaut = zeilen.filter(n => n.__marke).length === 0;
    const b2 = document.querySelector('#planetList [data-send="' + ziel + '"]');
    return { ziel, neuGebaut,
             unterwegs: !!b2 && /unterwegs/.test(b2.textContent) && b2.disabled };
  });
  check('4: nach übersprungenen Ticks startet "Schicken" die Mission und die Liste baut neu',
    klick.keinKnopf !== true && klick.unterwegs === true && klick.neuGebaut === true, klick);

  check('5: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
