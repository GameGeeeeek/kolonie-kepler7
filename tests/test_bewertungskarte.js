// Wächter für die Bewertungskarte von browsermmorpg.com (11.09.2026).
//
// WAS HIER VERTEIDIGT WIRD
// ------------------------
// Das Verzeichnis browsermmorpg.com listet das Spiel (#1799) und sortiert nach Stimmen. Sein
// Abstimmungs-Widget ist ein FREMDSKRIPT (rating_card.js). Das Spiel hält sein Sitzungs-Token in
// localStorage und schützt es mit connect-src 'self' (test_csp_verbindung.js) - aber localStorage
// gehört der HERKUNFT, nicht der einzelnen Seite: Ein Fremdskript, das direkt in irgendeiner Seite
// von www.gamegeeeeek.de läuft, auch in einer Themenseite ohne Login-Maske, könnte das Token lesen.
//
// Die Regel, die hier gemessen wird, hat deshalb drei Teile:
//   1. Das Widget steht NUR in bmmo-karte.html, und diese Datei darf nur mit browsermmorpg.com reden.
//   2. Jede Themenseite bettet die Karte als <iframe sandbox="..."> OHNE allow-same-origin ein - der
//      Rahmen bekommt damit eine undurchsichtige Herkunft: kein localStorage, keine Cookies.
//   3. Die Spieldatei lädt das Widget gar nicht; ihre Startseite trägt nur den nackten Link auf die
//      Abstimmungsseite.
//
// Teil 2 wird nicht nur am Attribut abgelesen, sondern im echten Browser GEMESSEN: Ein Stellvertreter
// für rating_card.js versucht aus dem Rahmen heraus localStorage zu lesen. Ohne Sandbox gelingt das -
// mit ihr wirft der Browser einen SecurityError. Das ist derselbe Gedanke wie in
// test_csp_verbindung.js: nicht "es hat nicht geklappt" prüfen, sondern den GRUND.
//
// browsermmorpg.com wird dabei NICHT angesprochen: Alle Abrufe dorthin fängt page.route ab und
// beantwortet sie lokal. Der Test läuft damit ohne Internet und misst auch nicht deren Server.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün: node tests/test_bewertungskarte.js
//   rot:  an einer Kopie der Seiten ohne das sandbox-Attribut fallen 2a und 4a/4b -
//         KEPLER_SEITEN_DIR=/tmp/ohne_sandbox node tests/test_bewertungskarte.js
//         (die Kopie braucht die vier Themenseiten, bmmo-karte.html und datenschutzerklaerung.html)
//   rot:  an einer Spieldatei ohne den Link fällt 3b - KEPLER_SPIELDATEI=/tmp/ohne_link.html ...
const http = require('http');
const fs = require('fs');
const path = require('path');
const { starteBrowser, WURZEL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

// Gemessen frei am 11.09.2026 in BEIDEN Repos (grep -hoE "\b3[12][0-9][0-9]\b" tests/*.js ../kolonie-kepler7-backend/tests/*.js | sort -un).
const PORT = 3266;
// Umleitbar auf eine KOPIE, damit die Gegenprobe nicht am echten Verzeichnis läuft (dieselbe
// Vorkehrung wie KEPLER_SPIELDATEI und KEPLER_ITCH_DIR).
const DIR = process.env.KEPLER_SEITEN_DIR || WURZEL;
const THEMENSEITEN = ['weltraum-browsergame.html', 'idle-spiel-browser.html', 'allianzen-pvp.html', 'spielanleitung.html'];
const KARTE = 'bmmo-karte.html';
const VOTE = 'https://browsermmorpg.com/vote.php?id=1799';

const lies = (datei) => fs.readFileSync(path.join(DIR, datei), 'utf8');
// Kommentare vorher leeren, sonst zählt ein Kommentar, der das Verbotene ZITIERT, wie ein Treffer
// (Hausregel 33) - und die Begründungen in diesen Dateien zitieren es ausführlich.
const ohneKommentare = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

(async () => {
  // ---------- 1. Die Karte selbst ----------
  const karteDa = fs.existsSync(path.join(DIR, KARTE));
  check('1-vorab: bmmo-karte.html existiert', karteDa);
  const karte = karteDa ? ohneKommentare(lies(KARTE)) : '';
  const skripte = karte.match(/<script\b[^>]*>/g) || [];
  check('1a: die Karte lädt genau EIN Skript, und zwar rating_card.js von browsermmorpg.com',
    skripte.length === 1 && /src="https:\/\/browsermmorpg\.com\/js\/rating_card\/rating_card\.js"/.test(skripte[0]), skripte);
  check('1b: der Einbettungscode trägt die Nummer des Eintrags (1799)',
    /<div class="bmmorc"[^>]*data-id="1799"/.test(karte));
  const cspM = karte.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=(["'])([\s\S]*?)\1/i);
  const csp = cspM ? cspM[2] : '';
  const direktive = (name) => { const m = csp.match(new RegExp('(?:^|;)\\s*' + name + '\\s+([^;]*)')); return m ? m[1].trim() : null; };
  check('1c: die CSP der Karte sperrt alles, was nicht genannt ist (default-src \'none\')',
    direktive('default-src') === "'none'", { csp });
  check('1d: Skript und Verbindungen dürfen NUR zu browsermmorpg.com (kein zweiter Host, kein unsafe-inline)',
    direktive('script-src') === 'https://browsermmorpg.com' && direktive('connect-src') === 'https://browsermmorpg.com',
    { script: direktive('script-src'), connect: direktive('connect-src') });
  check('1e: die Karte ist für Suchmaschinen gesperrt (sie ist kein eigener Inhalt)',
    /<meta\s+name="robots"\s+content="[^"]*noindex/.test(karte));

  // ---------- 2. Jede Themenseite ----------
  for (const datei of THEMENSEITEN) {
    const html = ohneKommentare(lies(datei));
    const rahmen = (html.match(/<iframe\b[^>]*>/g) || []).filter(t => /src="bmmo-karte\.html"/.test(t));
    const sandbox = rahmen.length === 1 ? (rahmen[0].match(/\bsandbox="([^"]*)"/) || [])[1] : undefined;
    check('2a ' + datei + ': bettet die Karte genau einmal ein, im Sandkasten OHNE allow-same-origin, MIT allow-scripts',
      rahmen.length === 1 && typeof sandbox === 'string' && !/allow-same-origin/.test(sandbox) && /\ballow-scripts\b/.test(sandbox),
      { rahmen: rahmen.length, sandbox });
    check('2b ' + datei + ': lädt das Fremdskript NICHT direkt',
      !/<script\b[^>]*browsermmorpg\.com/.test(html));
    check('2c ' + datei + ': der Hinweis neben der Karte verweist auf die Datenschutzerklärung',
      /class="bewertung-hinweis"[\s\S]{0,400}href="datenschutzerklaerung\.html"/.test(html));
  }
  check('2d: die Datenschutzerklärung nennt browsermmorpg.com als eingebundenen Dritten',
    /browsermmorpg\.com/.test(ohneKommentare(lies('datenschutzerklaerung.html'))));

  // ---------- 3. Die Spieldatei ----------
  const spiel = ohneKommentare(fs.readFileSync(SPIELDATEI, 'utf8'));
  check('3a: das Spiel lädt weder das Widget noch die Karte (kein rating_card.js, kein Rahmen auf bmmo-karte)',
    !/rating_card\.js/.test(spiel) && !/<iframe\b[^>]*bmmo-karte/.test(spiel));
  const fussVon = spiel.indexOf('<div class="ll-foot">');
  const fussBis = fussVon < 0 ? -1 : spiel.indexOf('<style>', fussVon);
  check('3-vorab: die Landing-Fußzeile ist auffindbar', fussVon > 0 && fussBis > fussVon);
  const fuss = fussVon > 0 && fussBis > fussVon ? spiel.slice(fussVon, fussBis) : '';
  const linkM = fuss.match(/<a\s+href="https:\/\/browsermmorpg\.com\/vote\.php\?id=1799"[^>]*>/);
  check('3b: die Startseite trägt den nackten Link auf die Abstimmungsseite (neuer Tab, ohne Opener)',
    !!linkM && /target="_blank"/.test(linkM[0]) && /rel="[^"]*noopener/.test(linkM[0]), linkM ? linkM[0] : null);

  // ---------- 4. Gemessen im Browser ----------
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0].replace(/^\//, '')) || THEMENSEITEN[0];
    const p = path.join(DIR, name);
    if (!name.includes('..') && fs.existsSync(p) && fs.statSync(p).isFile()) {
      res.writeHead(200, { 'Content-Type': name.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(p));
    }
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const browser = await starteBrowser();
  const seite = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const fehler = [];
  seite.on('pageerror', e => fehler.push(String(e.message).slice(0, 120)));
  seite.on('console', m => { if (m.type() === 'error') fehler.push(m.text().slice(0, 120)); });

  // Der Stellvertreter für rating_card.js: Er tut, was ein bösartiges Fremdskript täte - localStorage
  // und Cookies lesen - und schreibt das Ergebnis dorthin, wo der Test es abliest.
  const abrufe = [];
  await seite.route('https://browsermmorpg.com/**', route => {
    const r = route.request();
    abrufe.push({ url: r.url().split('?')[0], ausRahmen: r.frame() !== seite.mainFrame() });
    if (/rating_card\.js$/.test(r.url())) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body:
        "var ls, ck; try { localStorage.getItem('x'); ls = 'ERREICHBAR'; } catch (e) { ls = e.name; }" +
        "try { void document.cookie; ck = 'ERREICHBAR'; } catch (e) { ck = e.name; }" +
        "document.body.setAttribute('data-ls', ls); document.body.setAttribute('data-ck', ck);" +
        "document.querySelector('.bmmorc').textContent = 'STELLVERTRETER';" });
    }
    route.fulfill({ status: 204, body: '' });
  });

  await seite.goto('http://127.0.0.1:' + PORT + '/' + THEMENSEITEN[0], { waitUntil: 'domcontentloaded' });
  // loading="lazy": der Rahmen lädt erst, wenn er in Sichtweite kommt.
  await seite.locator('iframe.bewertung-karte').scrollIntoViewIfNeeded();
  let rahmen = null;
  for (let i = 0; i < 40 && !rahmen; i++) {
    await seite.waitForTimeout(100);
    rahmen = seite.frames().find(f => /bmmo-karte\.html/.test(f.url())) || null;
  }
  check('4-vorab: der Rahmen der Karte ist geladen', !!rahmen, { frames: seite.frames().map(f => f.url()) });
  let gemessen = { ls: null, ck: null, text: null };
  if (rahmen) {
    for (let i = 0; i < 40 && gemessen.ls === null; i++) {
      await seite.waitForTimeout(100);
      gemessen = await rahmen.evaluate(() => ({
        ls: document.body.getAttribute('data-ls'), ck: document.body.getAttribute('data-ck'),
        text: (document.querySelector('.bmmorc') || {}).textContent || null
      })).catch(() => gemessen);
    }
  }
  check('4a: das Skript LÄUFT im Rahmen (allow-scripts greift - sonst wäre die Karte eine Attrappe)',
    gemessen.text === 'STELLVERTRETER', gemessen);
  check('4b: aus dem Rahmen heraus ist localStorage NICHT erreichbar (SecurityError, die Sandbox greift)',
    gemessen.ls === 'SecurityError', gemessen);
  check('4c: und Cookies ebenso wenig', gemessen.ck === 'SecurityError', gemessen);
  check('4d: alle Abrufe bei browsermmorpg.com kommen aus dem Rahmen, keiner aus der Seite selbst',
    abrufe.length > 0 && abrufe.every(a => a.ausRahmen), abrufe);
  check('4e: keine Konsolenfehler auf der Themenseite', fehler.length === 0, fehler.slice(0, 3));

  await ende(async () => { await browser.close(); await new Promise(r => server.close(r)); });
})();
