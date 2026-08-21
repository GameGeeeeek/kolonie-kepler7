// Wächter für itch-wrapper/index.html - die Startkarte, die auf itch.io hochgeladen wird.
//
// Anlass (21.08.2026): Der erste Entwurf fing den Klick ab und rief
// window.open(ziel, '_blank', 'noopener'), um am Rückgabewert zu erkennen, ob der Tab aufging.
// Gemessen in Chromium gibt dieser Aufruf ABER IMMER null zurück - das ist die Spezifikation,
// nicht ein Fehler: Mit noopener wird die Opener-Beziehung gekappt, es gibt nichts
// zurückzugeben. Folge: Die Erfolgsverzweigung war toter Code, und die Warnung "Dieses Fenster
// darf keine neuen Tabs öffnen" erschien bei JEDEM Klick, auch bei einwandfreiem Erfolg.
//
// Was dieser Test NICHT kann: prüfen, ob sich wirklich ein Tab öffnet. Gemessen mit einer
// Gegenkontrolle (nackter <a target="_blank"> ganz ohne JavaScript) öffnet in dieser
// Container-Umgebung KEIN Fall einen Tab - die Umgebung kann das schlicht nicht. Eine Prüfung
// darauf würde das Messwerkzeug messen, nicht die Seite (Arbeitsregel 15/17/19).
// Geprüft wird deshalb die REGEL, die den Fehler unmöglich macht.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { starteBrowser, WURZEL, pruefer } = require('./lib/umgebung');

const PORT = 3244;               // 3195-3229 (Backend), 3241-3243 (Frontend) sind belegt
// Umleitbar, damit die Gegenprobe an einer KOPIE laufen kann statt am echten Verzeichnis
// (dieselbe Vorkehrung wie KEPLER_SPIELDATEI - eine Gegenprobe, die das Original liest,
// ist geschenkt und sieht trotzdem wie eine bestandene aus).
const DIR = process.env.KEPLER_ITCH_DIR || path.join(WURZEL, 'itch-wrapper');
const DATEI = path.join(DIR, 'index.html');
const { check, ende } = pruefer();

// --- 1. Quelltext: die Regel, die den Anlassfehler unmöglich macht ---
const roh = fs.readFileSync(DATEI, 'utf8');

// Kommentare leeren, BEVOR gezählt wird - dieser Test erklärt den alten Fehler im Kommentar
// und würde sich sonst selbst auf die Füße treten (Arbeitsregel 33).
const ohneKommentar = roh
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

// Der Entferner wird an einer SELBST GEBAUTEN Probe belegt, nicht am Dateiinhalt: Sonst
// schlägt er am Vergleichsstand fehl, weil dort der erklärende Kommentar noch nicht steht -
// eine Prüfung, die aus dem falschen Grund rot ist (Arbeitsregel 28).
const probe = '<!-- window.open A -->\n/* window.open B */\ncode();  // window.open C\nwindow.open(D);';
const probeOhne = probe
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');
check('1-vorab der Kommentar-Entferner trifft alle drei Kommentararten',
  probeOhne.indexOf('window.open') !== -1 && (probeOhne.match(/window\.open/g) || []).length === 1,
  { uebrig: (probeOhne.match(/window\.open [A-D]|window\.open\(D\)/g) || []) });

check('1a kein window.open im ausgeführten Code',
  ohneKommentar.indexOf('window.open') === -1,
  { treffer: (ohneKommentar.match(/window\.open[^;]*/g) || []).slice(0, 3) });

check('1b kein preventDefault - der Link darf seine Arbeit tun',
  ohneKommentar.indexOf('preventDefault') === -1);

const linkTag = (roh.match(/<a class="knopf"[^>]*>/) || [''])[0];
check('1c der Startknopf ist ein echter Link auf das Spiel',
  /href="https:\/\/www\.gamegeeeeek\.de\//.test(linkTag), { tag: linkTag });
check('1d er öffnet einen eigenen Tab und kappt den Opener',
  /target="_blank"/.test(linkTag) && /rel="noopener"/.test(linkTag), { tag: linkTag });

// itch.io verlangt für eingebettete Spiele: externe Ressourcen nur über HTTPS, keine
// absoluten Pfade. Beides hier gemessen statt angenommen.
check('1e keine absoluten Pfade (itch.io-Regel)',
  !/(src|href)="\//.test(roh),
  { treffer: (roh.match(/(src|href)="\/[^"]*"/g) || []).slice(0, 3) });
check('1f kein http:// ohne s (itch.io-Regel)',
  !/http:\/\/(?!127\.0\.0\.1)/.test(roh),
  { treffer: (roh.match(/http:\/\/[^"'\s]*/g) || []).slice(0, 3) });

// --- 2. Im Browser: die Wirkung, nicht die Beschriftung ---
const server = http.createServer((req, res) => {
  const p = req.url === '/' ? '/index.html' : req.url;
  let inhalt = null;
  try { inhalt = fs.readFileSync(path.join(DIR, path.basename(p))); } catch (e) { inhalt = null; }
  if (inhalt === null) { res.writeHead(404); return res.end('weg'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(inhalt);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
  const page = await ctx.newPage();

  const fremd = [];
  page.on('request', r => {
    if (!r.url().startsWith('http://127.0.0.1:' + PORT)) fremd.push(r.url());
  });

  await page.goto('http://127.0.0.1:' + PORT + '/');
  await page.waitForTimeout(400);

  check('2a die Seite lädt nichts von außen', fremd.length === 0, { fremd });

  // Der Anlassfehler, gemessen an der WIRKUNG: Nach einem Klick darf keine Warnung
  // erscheinen, die eine Sperre behauptet. Am alten Stand erschien sie IMMER.
  const vorher = (await page.$eval('#warum', e => e.textContent)).trim();
  await page.click('#starten');
  await page.waitForTimeout(600);
  const nachher = (await page.$eval('#warum', e => e.textContent)).trim();

  check('2b ein Klick behauptet keine Sperre', !/keine neuen Tabs/i.test(nachher),
    { nachher: nachher.slice(0, 90) });
  check('2c der Hinweistext bleibt derselbe', vorher === nachher,
    { vorher: vorher.slice(0, 60), nachher: nachher.slice(0, 60) });

  // Der Auffangweg ersetzt die entfernte Erkennung - er muss deshalb SICHTBAR sein,
  // nicht nur vorhanden (Arbeitsregel 55).
  const adr = await page.$('.adresse');
  const sichtbar = adr ? await adr.isVisible() : false;
  const hoehe = adr ? (await adr.boundingBox() || { height: 0 }).height : 0;
  const text = adr ? (await adr.innerText()).trim() : '';
  check('2d die Adresse steht sichtbar als Auffangweg da',
    sichtbar && hoehe > 0 && /gamegeeeeek\.de/.test(text), { sichtbar, hoehe, text: text.slice(0, 70) });

  const markierbar = adr
    ? await page.$eval('.adresse', e => getComputedStyle(e).userSelect
        || getComputedStyle(e).webkitUserSelect)
    : '';
  check('2e ein Klick auf die Adresse markiert sie', markierbar === 'all', { userSelect: markierbar });

  // Das Sternenfeld war schon einmal unsichtbar (349 von 576.000 Bildpunkten). Gemessen
  // statt angesehen, damit es nicht still wieder verschwindet.
  // Zwei Zahlen, nicht eine - und der Grund dafuer ist gemessen (21.08.2026).
  //
  // Hier stand nur "zaehle Bildpunkte mit Alpha > 20". Das war richtig, solange die Karte ein
  // duennes Sternenfeld auf DURCHSICHTIGER Leinwand malte: Ohne Sterne war die Zahl 0.
  // Seit die Kulisse zuerst einen DECKENDEN Grund malt, hat jeder Bildpunkt Alpha 255 - die
  // Pruefung meldete 576.000 von 576.000 und war damit vacuous. Gemessen an einer Kulisse,
  // die NUR die Grundfarbe malt (kein Stern, kein Planet, kein Orbit): unveraendert gruen.
  //
  // Gezaehlt wird deshalb, was sich vom Grund UNTERSCHEIDET. Die Grundfarbe kommt dabei aus
  // Kulisse.GRUND, nicht aus einem eingetippten Wert - sonst stuenden hier zwei Wahrheiten,
  // und ein Farbwechsel machte die Pruefung still wieder vacuous.
  const sterne = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { canvas: false };
    const grund = (window.Kulisse && window.Kulisse.GRUND) || null;
    if (!grund) return { canvas: true, grundBekannt: false };
    const gr = parseInt(grund.slice(1, 3), 16), gg = parseInt(grund.slice(3, 5), 16), gb = parseInt(grund.slice(5, 7), 16);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let hell = 0, inhalt = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 20) hell++;
      if (Math.abs(d[i] - gr) + Math.abs(d[i + 1] - gg) + Math.abs(d[i + 2] - gb) > 8) inhalt++;
    }
    return { canvas: true, grundBekannt: true, grund, gemalt: hell, inhalt, gesamt: d.length / 4 };
  });
  check('2f-vorab die Leinwand ist ueberhaupt bemalt', sterne.canvas && sterne.grundBekannt && sterne.gemalt > 500, sterne);
  // Die eigentliche Aussage: Auf dem Grund steht INHALT - Sterne, Nebel, Planet, Orbits.
  // Die Schranke als REGEL statt als Literal: mindestens ein Prozent der Flaeche weicht ab.
  // Gemessen liegt der echte Wert weit darueber (der Planet allein deckt ein Vielfaches),
  // die Gegenprobe "nur Grundfarbe" liefert exakt 0.
  check('2f die Kulisse malt wirklich etwas auf den Grund',
        sterne.inhalt > sterne.gesamt * 0.01,
        { inhalt: sterne.inhalt, gesamt: sterne.gesamt, anteil: sterne.gesamt ? (100 * sterne.inhalt / sterne.gesamt).toFixed(1) + ' %' : null });

  await browser.close();
  server.close();
  ende();
})().catch(e => { console.error('ABSTURZ: ' + e.message); server.close(); process.exit(2); });
