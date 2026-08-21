// Wo eine Missionslinie ANFAENGT (KB-18, Spieler-Report Sascha mit Screenshot, 18.08.2026:
// "bug gefunden flotte ist von meiner heimatbasis gestartet").
//
// (Diese Etappe hiess bei der Auslieferung von v8.583.0 versehentlich KB-17 - der Name war schon
// von der Alien-Nester-Arbeit desselben Tages belegt, die Marker gegen Marker schiebt. Der Code
// heisst seit v8.584.0 KB-18; die Patchnotes bleiben als unveraenderliche Historie stehen.)
//
// DER FEHLER: Im Chronos-System stand eine Flugbahn, deren Startpunkt IN diesem System lag -
// obwohl die Heimatbasis in einem ganz anderen System steht. Ursache war die Reihenfolge der
// Verzweigung in buildGalaxyMap:
//
//   if (originKey === 'home'){ originX = homeMarkerPos.x; ... }   <- fragte originInView NICHT
//   else if (originInView){ ... Kolonie ... }
//   else { originX = SUN_X; originY = SUN_Y; }                     <- Sonne als Platzhalter
//
// Fuer eine KOLONIE ausserhalb des Blickfelds stand der Sonnen-Platzhalter also laengst da, fuer
// die HEIMAT nicht. `homeMarkerPos` ist ein Punkt auf der Heimat-Slot-Bahn (Kreis r=50 um die
// Sonne) - im fremden System bezeichnet er nichts.
//
// GEMESSEN am alten Stand (home in kepler, Erkundung nach thessa im System vega):
//   vega angesehen   -> Linienstart 400,0/115, also exakt 50,0 Einheiten neben der Sonne
//   kepler angesehen -> Linienstart 424,1/115, der echte kollisionsverschobene Heimatmarker
// Nach der Behebung: vega 0,0 Einheiten (Sonne), kepler unveraendert 424,1.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   gruen: node tests/test_flugbahn_ursprung.js
//   rot:   git show <commit>^:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_SPIELDATEI=/tmp/alt.html node tests/test_flugbahn_ursprung.js
//          -> 2 faellt mit {"abstandZurSonne":"50.0"}; 3 bleibt gruen (die Gegenrichtung war nie
//             kaputt, und genau das soll sie auch nach der Behebung belegen).
//
// WARUM DIE MESSUNG AUF DIE SYSTEMEBENE GESCOPT IST (Hausregel 51): Die Routen-Ebene der
// Uebersicht zeichnet eigene <line>-Elemente in DERSELBEN Farbe. Ungescopt lieferte die erste
// Fassung dieser Messung in zwei verschiedenen Systemen denselben Wert - ein Werkzeugfehler, kein
// Befund. Die Routen-Linien tragen `data-karte-route`, die Systemebene nicht.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

// Aus dem Code abgelesen, nicht geraten (Hausregel 4): SUN_X/SUN_Y und der Radius der
// Heimat-Slot-Bahn stehen in weltraum_kolonie.html als Konstanten.
const SONNE = { x: 350, y: 115 };
const EXPLORE_HIN = '#378add';

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
  // Genau die Lage aus dem Report: Die Flotte startet an der HEIMATBASIS (kepler) und fliegt in
  // ein anderes System (thessa liegt in vega). Lange Restzeit, damit die Linie das ganze
  // Messfenster ueber steht.
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {},
    fleet: { jaeger: 100, ships: 3, missions: [
      { id: 'm-1', type: 'explore', targetId: 'thessa', startTime: now - 60000, endTime: now + 3600000,
        fleetName: 'Flotte 1', composition: { ships: 1 } }
    ] },
    discovered: { rhea: true, aion: true, thessa: true }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {}, nextPlanetEventCheck: now + 3600000
  });

  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
     'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(1800);

  const lies = async (sys) => {
    await oeffneSystemUeberSektoren(page, sys);
    return await page.evaluate(farbe => {
      const svg = document.getElementById('galaxyMapSvg');
      const alle = [...svg.querySelectorAll('line')].filter(l => l.getAttribute('stroke') === farbe);
      // Die Routen-Ebene zeichnet in derselben Farbe - siehe Kopfkommentar (Hausregel 51).
      const linien = alle.filter(l => !l.hasAttribute('data-karte-route'));
      return {
        gesamt: alle.length, routen: alle.length - linien.length, systemLinien: linien.length,
        start: linien[0] ? { x: +linien[0].getAttribute('x1'), y: +linien[0].getAttribute('y1') } : null
      };
    }, EXPLORE_HIN);
  };
  const abstand = p => Math.hypot(p.x - SONNE.x, p.y - SONNE.y);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- 1) Die Bedingung selbst pruefen, sonst waeren 2 und 3 grün ohne Aussage (Hausregel 37) ---
  const fremd = await lies('vega');
  check('1-vorab: im Zielsystem liegt genau EINE Missionslinie der Systemebene vor',
    fremd.systemLinien === 1 && !!fremd.start, fremd);
  if (fremd.systemLinien !== 1) return ende(async () => browser.close());

  // ---- 2) Der Report-Fall: Heimat NICHT im Bild -> Sonne als Platzhalter ------------------------
  // Geprueft wird die REGEL ("der Start liegt auf der Sonne"), nicht eine Koordinaten-Schreibweise.
  // 1,5 Einheiten Toleranz, weil die Linie ihre Werte mit toFixed(1) schreibt; der Fehlerfall lag
  // bei 50,0 und ist davon meilenweit entfernt.
  check('2: startet die Flugbahn im FREMDEN System auf der Sonne statt an einer Heimatbasis, die es dort nicht gibt',
    abstand(fremd.start) <= 1.5,
    { start: fremd.start, sonne: SONNE, abstandZurSonne: abstand(fremd.start).toFixed(1) });

  // ---- 3) Gegenrichtung: im HEIMATSYSTEM muss der echte Marker weiterhin der Start sein ---------
  // Ohne diese Prüfung waere "immer die Sonne nehmen" auch eine bestandene Loesung - und die waere
  // falsch: Im Heimatsystem gehoert die Linie an die Basis. Zusaetzlich geprueft, dass es der
  // VERSCHOBENE Marker ist (kbMarkerFrei, KB-13) und nicht die rohe Slot-Position: Der Schieber
  // rueckt ihn ueber die 50 Einheiten der Rohbahn hinaus.
  const heim = await lies('kepler');
  check('3-vorab: im Heimatsystem liegt genau EINE Missionslinie der Systemebene vor',
    heim.systemLinien === 1 && !!heim.start, heim);
  if (heim.systemLinien === 1) {
    const d = abstand(heim.start);
    check('3: im Heimatsystem startet die Flugbahn weiterhin am Heimatmarker, nicht auf der Sonne',
      d > 20, { start: heim.start, abstandZurSonne: d.toFixed(1) });
    check('3b: und zwar am kollisionsverschobenen Marker, nicht an der rohen Slot-Position',
      d > 50.5, { abstandZurSonne: d.toFixed(1), roheSlotBahn: 50 });
  }

  check('4: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
