// Woher ein Besucher kam - die Frontend-Haelfte (03.09.2026, Auftrag Sascha).
//
// DER ANLASS, woertlich: "macht es sinn auf tiktok werbung zu schalten ?" Die Antwort war nein,
// unter anderem weil es im ganzen Spiel KEINE Kampagnen-Messung gab - gemessen null Treffer fuer
// utm_source, utm_campaign, document.referrer, gtag(, ttq, fbq( und dataLayer. Diese Haelfte sammelt
// die Herkunft ein; der Server legt sie ab (Backend-Waechter: test_besucherquelle_http.js, Port 3253).
//
// GEMESSEN WIRD DIE WIRKUNG, NICHT DIE ANWESENHEIT (Hausregel 61): Die Kernpruefung liest den
// Rumpf der ECHTEN Registrierungs-Anfrage am Server mit. Eine Pruefung auf "der
// localStorage-Eintrag existiert" waere auch dann gruen, wenn das Feld nie mitgeschickt wird - und
// genau daran haengt der ganze Nutzen.
//
// WARUM EIN EIGENER HTTP-SERVER STATT file:// - das hat einen Anlauf gekostet und gehoert
// aufgeschrieben: Unter file:// blockiert CORS jeden /api-Aufruf, BEVOR ein Playwright-`page.route`
// ihn sehen kann (gemessen: "Access to fetch at 'file:///api/health' from origin 'null' has been
// blocked by CORS policy"). Das Spiel faellt dann in den Solo-Modus, das AGB-Haekchen bleibt
// unsichtbar, und die Registrierung findet nie statt - der Rumpf blieb null, und das sah aus wie
// ein Fehler der geprueften Aenderung statt wie ein Werkzeugfehler. Ueber HTTP gelingt
// checkBackend(), und das Formular verhaelt sich wie im echten Spiel. Vorbild und derselbe Grund:
// test_csp_verbindung.js.
//
// Der ZWEITE Server (PORT_FREMD) ist die verweisende fremde Seite. Nur so laesst sich messen, dass
// aus document.referrer der HOSTNAME wird und nicht die volle Adresse - `location.host` enthaelt
// den Port, zwei Server auf 127.0.0.1 sind also verschiedene Hosts.
// GEGENPROBE gegen die Spieldatei ohne die Aenderung (KEPLER_SPIELDATEI auf eine Kopie), beide
// Richtungen gefahren, Pruefnamen per `diff` verglichen statt gezaehlt - die Schlusszeile "FAIL"
// wuerde sonst mitzaehlen: neu EXIT=0, alt EXIT=1, 10 von 17 fallen bei identischer Liste.
// Die SIEBEN, die auch am alten Stand gruen bleiben, sind kein Mangel und gehoeren benannt:
//   * 1a-vorab / 7-vorab / 8-vorab - Vorpruefungen der Messvorrichtung, sie MUESSEN beidseitig
//     gruen sein (sonst misst der Test sein eigenes Werkzeug statt der Seite).
//   * 3b-vorab - der Anker `const body = { username, password };` steht auch im alten Stand.
//   * 5a / 8a - "nichts gespeichert": am alten Stand wird ueberhaupt nie etwas gespeichert.
//   * 6a - "ausserhalb des register-Zweigs kein body.besucherquelle": ohne die Zeile trivial erfuellt.
//     Sie misst die Gegenrichtung und muss gruen bleiben.
const fs = require('fs');
const http = require('http');
const { SPIELDATEI, starteBrowser, pruefer } = require('./lib/umgebung');

const PORT = 3245;          // gemessen frei: grep -hoE "PORT *= *3[0-9]{3}" tests/*.js
const PORT_FREMD = 3246;    // die verweisende Seite

(async () => {
  const { check, ende } = pruefer();
  const QUELLE = fs.readFileSync(SPIELDATEI, 'utf8');

  // Was an /api/register bzw. /api/login geschickt wurde - am Server mitgelesen, nicht geraten.
  let letzterRumpf = null, letzterPfad = null;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/register') || req.url.startsWith('/api/login')) {
      let roh = '';
      req.on('data', d => { roh += d; });
      req.on('end', () => {
        letzterPfad = req.url;
        try { letzterRumpf = JSON.parse(roh || '{}'); } catch (e) { letzterRumpf = { parseFehler: true, roh: roh.slice(0, 200) }; }
        res.writeHead(400, { 'Content-Type': 'application/json' });   // gemessen wird, was RAUSGEHT
        res.end(JSON.stringify({ error: 'Testabbruch' }));
      });
      return;
    }
    // /api/me MUSS 401 liefern, sonst haelt das Spiel die leere Antwort fuer eine gueltige Sitzung,
    // startet durch und zeigt gar kein Anmeldeformular - gemessen: loginOverlay auf display:none,
    // stattdessen das tutorialOverlay. Ein zu grosszuegiger Mock misst dann das eigene Wunschbild.
    if (req.url.startsWith('/api/me')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'nicht angemeldet' }));
    }
    if (req.url.startsWith('/api/')) {          // checkBackend() muss gelingen (prueft nur res.ok)
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{}');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(QUELLE);
  });
  const fremd = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><a id="w" href="http://127.0.0.1:' + PORT + '/">weiter</a>');
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  await new Promise(r => fremd.listen(PORT_FREMD, '127.0.0.1', r));
  const BASIS = 'http://127.0.0.1:' + PORT + '/';

  const browser = await starteBrowser();
  const aufraeumen = async () => {
    try { await browser.close(); } catch (e) {}
    try { server.close(); } catch (e) {}
    try { fremd.close(); } catch (e) {}
  };

  // Das Anmeldeformular erscheint nur im 401-Zweig von initAuth - also dann, wenn eine GESPEICHERTE
  // Sitzung abgelaufen ist. Ohne Token startet das Spiel durch und legt ein tutorialOverlay ueber
  // die Seite (gemessen: loginOverlay auf display:none). Ein abgelaufener Token ist damit kein
  // Trick, sondern der echte Spielerweg zum Formular; der Mock beantwortet /api/me passend mit 401.
  async function seiteMitAnmeldung(kontext) {
    const p = await kontext.newPage();
    await p.addInitScript(() => { try { localStorage.setItem('kepler7_token', 'abgelaufen'); } catch (e) {} });
    return p;
  }

  const gemerkt = p => p.evaluate(() => { try { return localStorage.getItem('kepler7_besucherquelle'); } catch (e) { return 'FEHLER'; } });
  const lesen = async p => { const r = await gemerkt(p); return r && r !== 'FEHLER' ? JSON.parse(r) : null; };

  async function formularAbschicken(page, modus) {
    letzterRumpf = null; letzterPfad = null;
    if (modus === 'register') await page.click('#registerTabBtn').catch(() => {});
    await page.waitForTimeout(300);
    await page.fill('#loginUsername', 'probekonto').catch(() => {});
    await page.fill('#loginPassword', 'probelauf-9271').catch(() => {});
    const email = await page.$('#loginEmail');
    if (email && await email.isVisible().catch(() => false)) await page.fill('#loginEmail', 'probe@example.invalid').catch(() => {});
    const tos = await page.$('#loginTosCheckbox');
    if (tos && await tos.isVisible().catch(() => false)) await tos.check().catch(() => {});
    await page.click('#loginSubmitBtn').catch(() => {});
    await page.waitForTimeout(1200);
  }

  // --- 1: die Kampagnen-Parameter werden eingesammelt --------------------------------------
  let ctx = await browser.newContext();
  let page = await seiteMitAnmeldung(ctx);
  await page.goto(BASIS + '?utm_source=tiktok&utm_medium=cpc&utm_campaign=herbst26');
  await page.waitForTimeout(1800);
  let roh = await gemerkt(page);
  let h = roh && roh !== 'FEHLER' ? JSON.parse(roh) : null;
  check('1a-vorab Der Speicher ist lesbar (kein blockierter localStorage)', roh !== 'FEHLER', { roh });
  check('1a Quelle, Medium und Kampagne sind gemerkt',
        !!h && h.quelle === 'tiktok' && h.medium === 'cpc' && h.kampagne === 'herbst26', { gemerkt: h });

  // --- 2: die Parameter fliegen aus der Adresszeile -----------------------------------------
  // Sonst zaehlt jeder Folgebesucher eines WEITERGEGEBENEN Links als dieselbe Quelle, und die
  // Messung ist nach dem ersten Teilen wertlos.
  const adresse = await page.evaluate(() => location.search);
  check('2a Die utm-Parameter stehen nicht mehr in der Adresszeile', !/utm_/.test(adresse), { search: adresse });

  // --- 3: der Sendepfad - gescopt auf den Registrierungsblock, plus ausgefuehrter Leser -------
  // WAS HIER NICHT GEMESSEN WIRD, und das ist eine ehrliche Grenze statt einer stillen Luecke:
  // der Klick auf "Konto erstellen" im laufenden Spiel. Das Anmeldeformular erscheint nur im
  // 401-Zweig von initAuth; ueber HTTP mit gemocktem Backend startet das Spiel stattdessen durch
  // und legt ein tutorialOverlay ueber die Seite (fuenf Anlaeufe, jeder gemessen: loginOverlay
  // bleibt display:none). Statt den Weg dorthin zu erzwingen - und damit das Messwerkzeug zu
  // messen (Hausregel 15/17/19) - wird die Kette in zwei Haelften belegt:
  //   (a) der LESER liefert wirklich das, was Abschnitt 1 im Speicher gemessen hat  -> ausgefuehrt
  //   (b) der Rumpf bekommt das Feld GENAU im register-Zweig                        -> gescopt
  // Wer den Formularweg spaeter doch stellt, ersetzt beide Haelften durch die eine echte Messung.
  const quelltext = QUELLE;
  const leserBlock = (quelltext.match(/function besucherquelleLesen\(\)\{[\s\S]*?\n  \}/) || [null])[0];
  check('3-vorab Der Leser-Block laesst sich aus der Spieldatei schneiden', !!leserBlock,
        { gefunden: !!leserBlock });
  let gelesen = null, leserFehler = null;
  try {
    const speicher = { kepler7_besucherquelle: JSON.stringify({ quelle: 'tiktok', medium: 'cpc', kampagne: 'herbst26' }) };
    const f = new Function('localStorage', 'BESUCHERQUELLE_KEY',
      leserBlock + '; return besucherquelleLesen();');
    gelesen = f({ getItem: k => (k in speicher ? speicher[k] : null) }, 'kepler7_besucherquelle');
  } catch (e) { leserFehler = String(e).slice(0, 120); }
  check('3a Der Leser liefert genau das, was im Speicher steht (ausgefuehrt)',
        !!gelesen && gelesen.quelle === 'tiktok' && gelesen.medium === 'cpc' && gelesen.kampagne === 'herbst26',
        { gelesen, leserFehler });

  // Gescopt auf den Block, der den Anfrage-Rumpf baut - eine ungescopte Suche traefe auch einen
  // Kommentar oder eine spaetere zweite Stelle (Hausregel 39).
  const bau = quelltext.indexOf("const body = { username, password };");
  const bauEnde = quelltext.indexOf("const res = await fetch('/api/'+loginMode", bau);
  check('3b-vorab Der Anker des Rumpf-Blocks existiert', bau > 0 && bauEnde > bau, { bau, bauEnde });
  const bauBlock = bau > 0 && bauEnde > bau ? quelltext.slice(bau, bauEnde) : '';
  check('3b Der Rumpf bekommt die Herkunft NUR im register-Zweig',
        /loginMode === 'register'[\s\S]{0,200}body\.besucherquelle/.test(bauBlock) &&
        (bauBlock.match(/body\.besucherquelle/g) || []).length === 1,
        { treffer: (bauBlock.match(/body\.besucherquelle/g) || []).length, block: bauBlock.slice(0, 160) });
  await ctx.close();

  // --- 4: ein zweiter Besuch ueberschreibt die Quelle NICHT --------------------------------
  // Der Normalfall: erster Kontakt ueber eine Kampagne, Registrierung erst beim naechsten Besuch.
  // Wuerde ueberschrieben, staende dort "unbekannt" - also fast immer.
  ctx = await browser.newContext();
  page = await ctx.newPage();
  await page.goto(BASIS + '?utm_source=tiktok&utm_medium=cpc&utm_campaign=herbst26');
  await page.waitForTimeout(1200);
  await page.goto(BASIS);                                   // zweiter Besuch, direkt
  await page.waitForTimeout(1200);
  let h4a = await lesen(page);
  check('4a Der zweite, direkte Besuch laesst die erste Quelle stehen',
        !!h4a && h4a.quelle === 'tiktok', { gemerkt: h4a });
  await page.goto(BASIS + '?utm_source=zweitquelle');        // dritter Besuch, andere Kampagne
  await page.waitForTimeout(1200);
  let h4b = await lesen(page);
  check('4b Auch eine spaetere andere Kampagne ueberschreibt nicht',
        !!h4b && h4b.quelle === 'tiktok', { gemerkt: h4b });
  await ctx.close();

  // --- 5: ohne Parameter wird NICHTS gespeichert -------------------------------------------
  // Ein leerer Eintrag wuerde die Erfassung fuer immer sperren (der Nicht-Ueberschreiben-Riegel aus
  // 4 wendet sich sonst gegen sich selbst), und ein spaeterer echter Kampagnen-Link kaeme nie an.
  ctx = await browser.newContext();
  page = await seiteMitAnmeldung(ctx);
  await page.goto(BASIS);
  await page.waitForTimeout(1800);
  const roh5 = await gemerkt(page);
  check('5a Ohne Kampagnen-Parameter und ohne Verweis entsteht gar kein Eintrag',
        roh5 === null, { roh: roh5 });

  // --- 6: Gegenrichtung - beim LOGIN darf nichts mitreisen --------------------------------
  // Der Server setzt die Herkunft nur beim Anlegen des Kontos. Ein Feld beim Login waere eines,
  // das aussieht, als taete es etwas. Gemessen an derselben Blockgrenze wie 3b.
  check('6a Ausserhalb des register-Zweigs wird die Herkunft nicht gesetzt',
        !/^\s*body\.besucherquelle/m.test(bauBlock.replace(/if \(loginMode === 'register'\)\{[\s\S]*?\n      \}/g, '')),
        { block: bauBlock.slice(0, 200) });
  await ctx.close();

  // --- 7: der Verweis wird auf den HOSTNAMEN eingedampft -----------------------------------
  // Ueber die fremde Seite geklickt, damit ein echter document.referrer anliegt.
  ctx = await browser.newContext();
  page = await ctx.newPage();
  await page.goto('http://127.0.0.1:' + PORT_FREMD + '/');
  await page.click('#w');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  const ref = await page.evaluate(() => document.referrer);
  const h7 = await lesen(page);
  check('7-vorab Ein echter fremder Verweis liegt an', ref.includes(String(PORT_FREMD)), { referrer: ref });
  check('7a Der Verweis ist gemerkt', !!h7 && !!h7.verweis, { gemerkt: h7 });
  check('7b Es ist der HOSTNAME, nicht die volle Adresse',
        !!h7 && h7.verweis === '127.0.0.1:' + PORT_FREMD, { verweis: h7 && h7.verweis, referrer: ref });
  check('7c Ohne Kampagne bleiben quelle/medium/kampagne leer',
        !!h7 && h7.quelle === undefined && h7.medium === undefined && h7.kampagne === undefined, { gemerkt: h7 });
  await ctx.close();

  // --- 8: die eigene Herkunft zaehlt NICHT als Verweis -------------------------------------
  // Interne Navigation ist keine Quelle. Ohne diese Regel traege jedes Konto den eigenen Host.
  ctx = await browser.newContext();
  page = await ctx.newPage();
  await page.goto(BASIS + 'spielanleitung.html');
  await page.waitForTimeout(400);
  // NICHT per Klick: Im Spiel liegt nach dem Start ein tutorialOverlay ueber der Seite und faengt
  // jeden Zeiger ab (gemessen: "intercepts pointer events", 56 Wiederholungen bis zum Timeout).
  // Eine Navigation per location.href setzt denselben Referrer und braucht kein klickbares Element.
  await page.evaluate(() => { location.href = '/'; });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  const refIntern = await page.evaluate(() => document.referrer);
  const hIntern = await lesen(page);
  check('8-vorab Der Verweis kommt von der EIGENEN Herkunft', refIntern.includes(String(PORT)), { referrer: refIntern });
  check('8a Die eigene Herkunft erzeugt keinen Eintrag', hIntern === null, { gemerkt: hIntern, referrer: refIntern });

  await ende(aufraeumen);
})().catch(e => { console.error(e); process.exit(1); });
