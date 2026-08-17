// Deko-Hintergrund malt sparsam (Etappe KB-9a, Spieler-Report Sascha: "ab und zu lädt sie
// schlecht denke ich und steckt im zoom einige sekunden").
//
// Gemessener Mechanismus (repro-Protokoll in der Etappe): frame() des Sternenhimmels baute je
// Nebel und je Frame einen frischen createRadialGradient und füllte damit das ganze Fenster -
// bei 30 FPS ~95% der Hauptthread-Last, und jede Karten-Geste musste sich dahinter anstellen.
// Seit KB-9a liegen die Nebel als vorgerenderte Kacheln auf einer eigenen Leinwand (#bgnebel),
// die nur bei geändertem quantisiertem Drift-Versatz neu gemalt wird.
//
// Die REGEL (nicht die Momentaufnahme): Nach dem Boot entstehen AUF DEN HINTERGRUND-LEINWÄNDEN
// (#bgstars/#bgnebel) keine Verlaufs-Objekte mehr im laufenden Betrieb. Gemessen wird über
// einen Zähl-Haken auf createRadialGradient, der VOR dem ersten Spielskript installiert wird
// (addInitScript) - dieselbe Falle wie der innerHTML-Setter aus Hausregel 18, nur für Canvas.
// Der Haken ist BEWUSST auf die zwei Leinwände gescopt (Hausregel 5, nur für Canvas statt
// querySelector): Ungescopt zählte er beim ersten Anlauf ~335 Verläufe je Sekunde von den
// völlig legitimen 40-px-Mini-Icon-Malern des Sekunden-Ticks mit und fiel auf korrektem Code
// durch. Erlaubt bleiben seltene Erzeuger (resize malt die Kacheln neu): höchstens 6 je 6 s.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_hintergrund_maler.js
//   rot:   am Stand VOR KB-9a (dort ~60 Verläufe je Sekunde, Prüfung 2 misst hunderte) -
//          KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_hintergrund_maler.js
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await page.addInitScript(() => {
    window.__gradZaehler = 0;        // nur #bgstars/#bgnebel (die Regel gilt dem Deko-Maler)
    window.__gradZaehlerAlle = 0;    // ungescopt, als Beleg dass der Haken überhaupt greift
    const orig = CanvasRenderingContext2D.prototype.createRadialGradient;
    CanvasRenderingContext2D.prototype.createRadialGradient = function(){
      window.__gradZaehlerAlle++;
      const id = this.canvas && this.canvas.id;
      if (id === 'bgstars' || id === 'bgnebel') window.__gradZaehler++;
      return orig.apply(this, arguments);
    };
  });
  await page.goto(DATEI);
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  const beimBoot = await page.evaluate(() => ({ alle: window.__gradZaehlerAlle, maler: window.__gradZaehler }));
  check('1-vorab: der Zähl-Haken greift (irgendwo entstehen beim Boot Verläufe)',
    beimBoot.alle > 0, beimBoot);

  // Messfenster NACH dem Boot: 6 Sekunden laufender Betrieb auf dem Standard-Tab.
  const vorher = await page.evaluate(() => window.__gradZaehler);
  await page.waitForTimeout(6000);
  const dazu = await page.evaluate(v => window.__gradZaehler - v, vorher);
  check('2: auf den Hintergrund-Leinwänden entstehen höchstens 6 Verläufe je 6 Sekunden (vorher: ~360)',
    dazu <= 6, { dazu, beimBoot });

  // Struktur-Beleg: die Nebel-Leinwand existiert und liegt VOR dem Sternenhimmel im DOM
  // (gleiche z-Ebene, DOM-Reihenfolge entscheidet - Nebel hinter den Sternen).
  const struktur = await page.evaluate(() => {
    const nebel = document.getElementById('bgnebel'), sterne = document.getElementById('bgstars');
    return { nebel: !!nebel, sterne: !!sterne,
             reihenfolge: !!(nebel && sterne && (nebel.compareDocumentPosition(sterne) & Node.DOCUMENT_POSITION_FOLLOWING)),
             nebelBreite: nebel ? nebel.width : 0 };
  });
  check('3: #bgnebel existiert, liegt vor #bgstars und ist auf Fenstergröße gezogen',
    struktur.nebel && struktur.sterne && struktur.reihenfolge && struktur.nebelBreite > 100, struktur);

  check('4: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await ende(async () => browser.close());
})();
