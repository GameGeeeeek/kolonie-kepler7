// Das Sitzungs-Token liegt nicht mehr in localStorage - die Sitzung traegt ein HttpOnly-Cookie
// (Sicherheits-Audit P3, Etappe b, 19.08.2026).
//
// WAS HIER VERTEIDIGT WIRD
// ------------------------
// Bis zum 19.08.2026 lag das Token in `localStorage['kepler7_token']`. Beim Audit wurde keine
// XSS-Luecke gefunden, aber bei 56.400 Zeilen mit direktem innerHTML-Rendern ist die Frage nicht,
// ob je eine entsteht - und die erste waere sofort eine vollstaendige Kontouebernahme gewesen, mit
// EINER Zeile. Ein HttpOnly-Cookie kann JavaScript gar nicht erst lesen.
//
// WARUM DIESER TEST DAS ECHTE BACKEND STARTET
// -------------------------------------------
// Die geprueften Eigenschaften entstehen ERST im Zusammenspiel: Der Server setzt das Cookie, der
// Browser haelt es, das Spiel darf es nicht sehen und muss trotzdem angemeldet bleiben. Jede
// Haelfte einzeln waere trivial gruen - ein Test gegen einen nachgebauten Server wuerde genau das
// messen, was ich beim Nachbauen angenommen habe. Deshalb: echter server.js, echter Browser,
// GLEICHE HERKUNFT (ein winziger Proxy reicht /api durch, sonst schickte der Browser das Cookie
// gar nicht erst mit).
// Liegt das Backend-Repo nicht daneben, ueberspringt sich der Test mit klarer Meldung - der
// Frontend-Prueflauf soll ohne das zweite Repo durchlaufen.
//
// DIE ENTSCHEIDENDE PRUEFUNG IST 5/6, NICHT 1
// -------------------------------------------
// Dass nach einer frischen Anmeldung nichts mehr in localStorage steht (1), ist die Behebung. Ob
// sie ausgeliefert werden DARF, entscheidet etwas anderes: ob ein Spieler mit einer BESTEHENDEN
// Anmeldung von vor heute noch hereinkommt (5). Faellt die, sperrt diese Auslieferung jeden
// gleichzeitig aus - der teuerste denkbare Fehler dieses Projekts. 6 misst dazu, dass so ein
// Spieler auch wirklich migriert, statt bis zum Ablauf des JWT (180 Tage) auf localStorage zu
// bleiben; ohne 6 waere die Behebung fuer den Bestand ein halbes Jahr lang wirkungslos.
//
// WARUM ABSCHNITT 4 DEN MECHANISMUS MISST UND NICHT DIE ANZEIGE
// -------------------------------------------------------------
// Der erste Entwurf prueft nur: steht nach dem Abmelden wieder der Anmeldebildschirm? Das war
// GRUEN, auch gegen einen Server, dessen /api/logout das Cookie gar nicht loescht - die Pruefung
// belegte also nicht, was ihr Kommentar behauptete (Hausregel 61: nicht das Etikett der Regel,
// sondern die Regel). Isoliert nachgemessen ist der Unterschied eindeutig:
//
//   echter Server        -> Kekse nach dem Abmelden [],              /api/me 401
//   ohne Cookie-Loeschung -> Kekse nach dem Abmelden [kepler7_sid],  /api/me 200
//
// Geprueft wird deshalb zuerst der Cookie-Bestand des BROWSERS (4b) und die Antwort des Servers
// (4c), erst danach die Anzeige (4d). 4-vorab haelt fest, dass ueberhaupt eine Sitzung dastand -
// ein Spiel, das nie angemeldet war, waere sonst trivial gruen.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1) - siehe die Notiz am Ende dieser Datei.

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { starteBrowser, SPIELDATEI, SERVER_JS, pruefer, ueberspringen } = require('./lib/umgebung');

if (!SERVER_JS) ueberspringen('Backend-Repo liegt nicht daneben (SERVER_JS nicht gefunden) - dieser Test braucht den echten server.js.');
const BACKEND_WURZEL = path.dirname(SERVER_JS);
if (!fs.existsSync(path.join(BACKEND_WURZEL, 'node_modules', 'bcryptjs'))) {
  ueberspringen('Im Backend-Repo fehlt node_modules (dort einmal `npm install`) - dieser Test startet den echten Server.');
}

const { check, ende } = pruefer();

// 3241 belegt test_csp_verbindung.js; die Backend-Suite liegt bei 3195-3226.
const WEB_PORT = 3242;
const API_PORT = 3243;
const BASIS = 'http://127.0.0.1:' + WEB_PORT;

const bcrypt = require(path.join(BACKEND_WURZEL, 'node_modules', 'bcryptjs'));

const PASS = 'Vurm-Tal-92x';          // besteht die Passwort-Regeln aus Backend-#138
const A_ID = crypto.randomUUID();
const B_ID = crypto.randomUUID();

function db() {
  const hash = bcrypt.hashSync(PASS, 10);
  return {
    users: {
      anna: { userId: A_ID, username: 'anna', passwordHash: hash, email: 'a@example.invalid', emailVerified: true, createdAt: Date.now() },
      bert: { userId: B_ID, username: 'bert', passwordHash: hash, email: 'b@example.invalid', emailVerified: true, createdAt: Date.now() }
    },
    // Der Spielstand gehoert in die SERVER-DB, nicht in localStorage: Nach der Anmeldung ruft das
    // Spiel load() und holt ihn von dort - eine lokale Fixture waere in dem Moment ueberschrieben.
    // Gemessen ist das genau so passiert: Das Tutorial-Overlay stand danach ueber allem und fing
    // jeden Klick ab ("#tutorialOverlay intercepts pointer events").
    private: {
      [A_ID]: { 'kepler7-save-v3': { value: spielstand(), version: 1 } },
      [B_ID]: { 'kepler7-save-v3': { value: spielstand(), version: 1 } }
    },
    shared: {}, resetTokens: {},
    galaxy: { npcEmpireStrength: 1, marketTrend: 1, collapsedSystems: {}, controlledSystems: {},
      news: [], activeWar: null, activeWormhole: null, lastTick: Date.now(), factions: {} }
  };
}

const warte = ms => new Promise(r => setTimeout(r, ms));

// Ein Spielstand, der die Moebel abschaltet, die sonst ueber der Anmeldung stehen: Ohne
// tutorialSeen faengt das Tutorial-Overlay nach der Anmeldung jeden Klick ab, ohne die gepinnten
// Ereignis-Uhren feuert der erste Planeten-Ereignis-Check GARANTIERT (Hausregel 18), und
// seenTabHints haelt die 166 px hohe Hinweisleiste weg (Hausregel 63). Gemessen wird hier die
// Anmeldung, nicht das Spiel.
function spielstand() {
  const jetzt = Date.now();
  return JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true, lastTick: jetzt,
    nextPlanetEventCheck: jetzt + 36e5, nextTraderCheck: jetzt + 36e5,
    nextRaidTime: jetzt + 36e5, nextFactionGift: jetzt + 36e5,
    seenTabHints: ['basis','karte','galaxie','fortschritt','flotte','forschung','verteidigung',
                   'markt','allianz','abgrund','profil','hilfe'],
    resources: { energie: 5e4, erz: 5e4, kristalle: 3e4, deuterium: 2e4 },
    buildings: { solar: 10, mine: 6, labor: 4, lager: 20, werft: 4 }
  });
}

// Wird gesetzt, sobald es etwas abzuraeumen gibt - der aeussere Fehlerausgang benutzt sie. Ohne
// das bleibt bei jedem Absturz ein Backend stehen, und der NAECHSTE Lauf misst dieses statt seines
// eigenen (genau so passiert, 19.08.2026).
let aufraeumen = async () => {};

(async () => {
  const dbPfad = path.join(os.tmpdir(), 'kepler-sitzungscookie-front-' + process.pid + '.json');
  fs.writeFileSync(dbPfad, JSON.stringify(db(), null, 1));

  // --- echtes Backend ------------------------------------------------------------------------
  // PUBLIC_URL wird bewusst NICHT ueberschrieben: `web-push` verlangt fuer das VAPID-Subject
  // zwingend https:/mailto: und laesst den Server sonst gar nicht erst starten.
  // VOR dem Start: Haelt schon jemand den Port? Das ist keine Vorsicht, sondern der Befund eines
  // eigenen Fehlschlags (19.08.2026): Zwei abgebrochene Laeufe hatten ihr Backend nicht
  // abgeraeumt, und die Gegenprobe gegen eine SABOTIERTE Server-Kopie sprach in Wahrheit mit dem
  // echten Server von vorhin - sie war gruen und belegte nichts. Ein Test, der auf einen fremden
  // Prozess trifft, misst nicht seinen Gegenstand (Hausregel 15/17/19).
  {
    let fremd = false;
    try { const r = await fetch('http://127.0.0.1:' + API_PORT + '/api/health'); fremd = r.ok; } catch (e) {}
    if (fremd) {
      check('0-port: der Backend-Port ' + API_PORT + ' ist frei', false,
        { hinweis: 'Dort antwortet schon ein Server. Verwaisten Prozess beenden: ' +
                   'ps -eo pid=,args= | grep "node .*server.js"' });
      return ende();
    }
  }

  let srvLog = '';
  const backend = spawn(process.execPath, [SERVER_JS], {
    cwd: BACKEND_WURZEL,
    env: Object.assign({}, process.env, { DB_FILE: dbPfad, PORT: String(API_PORT), JWT_SECRET: 'testsecret' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  backend.stdout.on('data', d => { srvLog += d; });
  backend.stderr.on('data', d => { srvLog += d; });

  // --- Web-Server auf DERSELBEN Herkunft ------------------------------------------------------
  // Die Spieldatei und /api muessen aus Browser-Sicht dieselbe Herkunft haben, sonst schickt er
  // das Cookie gar nicht erst mit und der Test misst seinen eigenen Aufbau statt das Spiel.
  const QUELLE = fs.readFileSync(SPIELDATEI, 'utf8');
  const web = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      const stuecke = [];
      req.on('data', c => stuecke.push(c));
      req.on('end', () => {
        const weiter = http.request(
          { host: '127.0.0.1', port: API_PORT, path: req.url, method: req.method, headers: req.headers },
          antwort => { res.writeHead(antwort.statusCode, antwort.headers); antwort.pipe(res); });
        weiter.on('error', () => { res.writeHead(502); res.end('{}'); });
        weiter.end(Buffer.concat(stuecke));
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(QUELLE);
  });
  await new Promise(r => web.listen(WEB_PORT, '127.0.0.1', r));

  let oben = false;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(BASIS + '/api/health'); if (r.ok) { oben = true; break; } } catch (e) {}
    await warte(250);
  }
  check('0-aufbau: echtes Backend und Web-Server sind oben', oben, oben ? undefined : { log: srvLog.slice(-400) });
  if (!oben) { try { backend.kill(); } catch (e) {} web.close(); try { fs.unlinkSync(dbPfad); } catch (e) {} return ende(); }

  const browser = await starteBrowser();
  // Eigener Kontext statt einer nackten Seite: Pruefung 5 muss die Kekse gezielt leeren koennen
  // (clearCookies gibt es nur am Kontext), und ein Kontext haelt Cookies und localStorage ueber
  // Neuladen hinweg zusammen - genau das, was hier gemessen wird.
  const kontext = await browser.newContext();
  const seite = await kontext.newPage();
  // #log ueberschreibt sich mit JEDER Meldung selbst (Hausregel 47) - ein Blick auf den Endstand
  // faende die gepruefte Zeile nur mit Glueck. Deshalb ein Mitschnitt, und zwar per addInitScript,
  // damit er schon vor dem ersten Tick steht.
  await seite.addInitScript(() => {
    window.__logZeilen = [];
    const start = () => {
      const box = document.getElementById('log');
      if (!box) return false;
      const merke = () => {
        const t = (box.innerText || '').trim();
        if (t && window.__logZeilen[window.__logZeilen.length - 1] !== t) window.__logZeilen.push(t);
      };
      new MutationObserver(merke).observe(box, { childList: true, characterData: true, subtree: true });
      merke();
      return true;
    };
    if (!start()) document.addEventListener('DOMContentLoaded', start);
  });

  aufraeumen = async () => {
    try { await browser.close(); } catch (e) {}
    try { backend.kill(); } catch (e) {}
    try { web.close(); } catch (e) {}
    try { fs.unlinkSync(dbPfad); } catch (e) {}
  };

  /** Ist das Spiel gerade angemeldet? Gemessen an dem, was der SPIELER sieht - nicht an einer
   *  inneren Variablen: Die Anmeldeflaeche liegt ueber allem, der Abmeldeknopf erscheint erst
   *  ueber showLogoutBtn(). Beides zusammen, damit ein halber Zustand auffaellt. */
  const angemeldet = async () => seite.evaluate(() => {
    const ov = document.getElementById('loginOverlay');
    const btn = document.getElementById('headerLogoutBtn');
    // Gemessen wird eine WIRKLICHE Ausdehnung, nicht nur `display`: Der Knopf im Profil-Reiter
    // steht in einem Panel, das je nach Reiter ausgeblendet ist - `getComputedStyle(el).display`
    // sieht nur das Element selbst und meldete ihn dort als sichtbar, obwohl kein Klick ankommt
    // (gemessen: der Klick lief in einen 30-Sekunden-Timeout). Deshalb der Knopf im KOPF, der
    // immer steht, und die Hoehe statt der Eigenschaft (Hausregel 55: sichtbar statt vorhanden).
    return {
      anmeldeflaeche: !!ov && getComputedStyle(ov).display !== 'none',
      abmeldeknopf: !!btn && btn.getBoundingClientRect().height > 0
    };
  });
  /** Raeumt ein aufgeschlagenes Tutorial weg, falls eines steht. */
  const tutorialWeg = async () => {
    try {
      const b = await seite.$('#tutorialSkipBtn');
      if (b && await b.isVisible()) { await b.click(); await warte(300); }
    } catch (e) {}
  };
  const gespeichertesToken = async () =>
    seite.evaluate(() => { try { return localStorage.getItem('kepler7_token'); } catch (e) { return 'FEHLER'; } });

  async function meldeAn(name) {
    // Die Anmeldekarte liegt in einem Modal, das die Landeseite erst oeffnet - ohne den Klick auf
    // einen [data-ll-open]-Knopf ist #loginUsername zwar im DOM, aber unsichtbar, und ein fill()
    // laeuft in einen 30-Sekunden-Timeout. Gegangen wird der Spielerweg, nicht openLoginModal()
    // von aussen: Die Funktion lebt im Modulscope und waere von hier gar nicht aufrufbar.
    await seite.click('[data-ll-open="login"]');
    await seite.waitForSelector('#loginUsername', { state: 'visible', timeout: 15000 });
    await seite.fill('#loginUsername', name);
    await seite.fill('#loginPassword', PASS);
    await seite.click('#loginSubmitBtn');
    for (let i = 0; i < 60; i++) {
      // Das Tutorial wegklicken, falls es kommt - der Spielerweg ueber seinen eigenen
      // Ueberspringen-Knopf. Der Spielstand in der Server-DB traegt zwar tutorialSeen, aber sich
      // darauf zu verlassen hiesse, eine Annahme ueber den Ladepfad zur Voraussetzung der
      // MESSUNG zu machen; hier geht es um die Anmeldung, nicht um das Tutorial.
      try {
        const ueberspringen = await seite.$('#tutorialSkipBtn');
        if (ueberspringen && await ueberspringen.isVisible()) await ueberspringen.click();
      } catch (e) {}
      const z = await angemeldet();
      if (!z.anmeldeflaeche && z.abmeldeknopf) return true;
      await warte(250);
    }
    return false;
  }

  // ---- 1: nach frischer Anmeldung steht nichts mehr in localStorage ---------------------------
  await seite.goto(BASIS + '/', { waitUntil: 'domcontentloaded' });
  await warte(1500);
  const drin = await meldeAn('anna');
  check('1-vorab: die Anmeldung ueber die Oberflaeche gelingt', drin, drin ? undefined : await angemeldet());
  if (!drin) return ende(aufraeumen);

  check('1: nach der Anmeldung liegt KEIN Token in localStorage',
    (await gespeichertesToken()) === null, { gespeichert: await gespeichertesToken() });

  // Die Gegenprobe zur Behebung selbst: Ein Cookie, das JavaScript lesen kann, waere genauso
  // erreichbar wie localStorage und damit vollkommen wirkungslos. Gemessen wird hier NICHT die
  // Set-Cookie-Kopfzeile (das tut der Backend-Test), sondern was der Browser dem Spiel zeigt.
  const sichtbar = await seite.evaluate(() => document.cookie);
  check('1b: und das Sitzungs-Cookie ist fuer JavaScript unsichtbar (HttpOnly wirkt wirklich)',
    !/kepler7_sid/.test(sichtbar), { documentCookie: sichtbar });

  // ---- 2: die Sitzung TRAEGT - das Spiel spricht wirklich mit dem Server ----------------------
  // Ohne diese Pruefung waere 1 auch dann gruen, wenn die Anmeldung gar nichts bewirkt haette.
  {
    const r = await seite.evaluate(async () => {
      const res = await fetch('/api/me');
      return { status: res.status, name: res.ok ? (await res.json()).username : null };
    });
    check('2: eine Anfrage aus dem Spiel heraus ist angemeldet (das Cookie traegt)',
      r.status === 200 && r.name === 'anna', r);
  }

  // ---- 3: die Sitzung ueberlebt das Neuladen --------------------------------------------------
  // DAS ist die Frage, an der der ganze Umbau haengt: Ohne das Cookie waere der Spieler nach dem
  // Wegfall von localStorage bei JEDEM Neuladen abgemeldet.
  await seite.reload({ waitUntil: 'domcontentloaded' });
  await warte(3000);
  await tutorialWeg();
  {
    const z = await angemeldet();
    check('3: nach dem Neuladen ist der Spieler weiterhin angemeldet',
      !z.anmeldeflaeche && z.abmeldeknopf, z);
    check('3b: und es liegt weiterhin kein Token in localStorage',
      (await gespeichertesToken()) === null, { gespeichert: await gespeichertesToken() });
  }

  // ---- 4: Abmelden meldet wirklich ab ---------------------------------------------------------
  // Das Paar: 4-vorab haelt fest, dass ueberhaupt eine Sitzung dastand, sonst waere 4b trivial.
  {
    const vorher = await angemeldet();
    check('4-vorab: vor dem Abmelden steht eine Sitzung', !vorher.anmeldeflaeche && vorher.abmeldeknopf, vorher);
    // confirm() wegklicken - der Abmeldeknopf fragt nach.
    seite.on('dialog', d => d.accept());
    await seite.click('#headerLogoutBtn');
    await warte(2500);
    // ZUERST der Mechanismus, dann die Anzeige. Das ist hier keine Feinheit, sondern der Befund
    // einer Gegenprobe: Gegen einen Server, dessen /api/logout das Cookie NICHT loescht, blieb die
    // reine Anzeige-Pruefung unten GRUEN - sie belegte also nicht, was sie behauptet. Isoliert
    // gemessen ist der Unterschied eindeutig: echter Server -> Kekse [], /me 401; sabotierter ->
    // Cookie bleibt, /me 200. Genau DAS wird deshalb geprueft (Hausregel 61: nicht das Etikett
    // der Regel, sondern die Regel).
    const kekse = (await kontext.cookies()).map(c => c.name);
    check('4b: das Sitzungs-Cookie ist wirklich weg (JS kann es nicht loeschen, nur der Server)',
      !kekse.includes('kepler7_sid'), { kekse });
    const meStatus = await seite.evaluate(() => fetch('/api/me').then(r => r.status).catch(() => 0));
    check('4c: und der Server nimmt die Sitzung nicht mehr an', meStatus === 401, { status: meStatus });

    await seite.goto(BASIS + '/', { waitUntil: 'domcontentloaded' });
    await warte(3000);
    await tutorialWeg();
    const z = await angemeldet();
    check('4d: nach dem Neuladen steht der Anmeldebildschirm',
      z.anmeldeflaeche && !z.abmeldeknopf, z);
  }

  // ---- 5: BESTANDSSITZUNG - wer nur ein localStorage-Token hat, kommt weiterhin herein --------
  // Die Pruefung, die ueber die Auslieferbarkeit entscheidet. Nachgestellt wird der Zustand eines
  // Spielers, der sich zuletzt VOR dem 19.08.2026 angemeldet hat: Token in localStorage, kein
  // Cookie. Zweites Konto, weil der Server nur EINE Sitzung je Konto zulaesst.
  const antwortB = await fetch(BASIS + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'bert', password: PASS })
  });
  const tokenB = (await antwortB.json()).token;
  check('5-vorab: ein Token fuer die nachgestellte Bestandssitzung liegt vor', !!tokenB);

  await kontext.clearCookies();
  await seite.evaluate(t => { try { localStorage.setItem('kepler7_token', t); } catch (e) {} }, tokenB);
  await seite.goto(BASIS + '/', { waitUntil: 'domcontentloaded' });
  await warte(3500);
  await tutorialWeg();
  {
    const z = await angemeldet();
    check('5: eine Bestandssitzung (Token in localStorage, kein Cookie) kommt weiterhin herein',
      !z.anmeldeflaeche && z.abmeldeknopf, z);
  }

  // ---- 6: ...und sie MIGRIERT, statt bis zum Ablauf des JWT auf localStorage zu bleiben --------
  // Der Server hat beim Aufruf aus 5 ein Cookie nachgereicht. Beim naechsten Laden traegt es die
  // Sitzung, und das Spiel raeumt den gespeicherten Token weg. Zwei Seitenaufrufe, keine
  // Nutzeraktion - ohne das waere die Behebung fuer den Bestand 180 Tage lang wirkungslos.
  await seite.reload({ waitUntil: 'domcontentloaded' });
  await warte(3500);
  await tutorialWeg();
  {
    const z = await angemeldet();
    check('6: nach dem naechsten Laden ist die Bestandssitzung weiterhin angemeldet',
      !z.anmeldeflaeche && z.abmeldeknopf, z);
    check('6b: und der Token ist aus localStorage verschwunden (die Sitzung ist migriert)',
      (await gespeichertesToken()) === null, { gespeichert: await gespeichertesToken() });
  }

  // ---- 7: das Spiel schreibt den Token nirgends mehr hin --------------------------------------
  // Quelltext-Pruefung als Ergaenzung zur Messung: Die Messungen oben belegen die Wege, die dieser
  // Test faehrt. Diese hier faengt eine kuenftige NEUE Schreibstelle, die kein Weg beruehrt -
  // musterbasiert und damit auch fuer den Fall, an den niemand gedacht hat (Hausregel 40).
  {
    const schreibt = (QUELLE.match(/localStorage\.setItem\(\s*TOKEN_KEY/g) || []).length;
    check('7: nirgends im Spiel wird das Token noch in localStorage geschrieben', schreibt === 0,
      { setItemAufrufe: schreibt });
    // Gegenrichtung: Der LESE-Zugriff muss bleiben - er ist der Bestandsschutz aus Pruefung 5.
    // Verschwindet er, ist niemand mehr geschuetzt, und 5 wuerde es hier gar nicht mehr merken,
    // weil dieser Test seine Bestandssitzung selbst herstellt.
    const liest = (QUELLE.match(/localStorage\.getItem\(TOKEN_KEY\)/g) || []).length;
    check('7b: der LESENDE Zugriff bleibt (er ist der Bestandsschutz aus Pruefung 5)', liest === 1,
      { getItemAufrufe: liest });
  }

  // ---- 8: kennt der Server die Abmelde-Route NICHT, wird das gesagt statt verschwiegen ---------
  // Der Fall ist nicht ausgedacht: Der Backend-Deploy dieses Projekts ist sechsmal haengen
  // geblieben, zuletzt genau mit diesem Commit. Ein 404 WIRFT NICHT - ohne die Statuspruefung
  // waere daraus ein stilles "abgemeldet" geworden, waehrend das Cookie weiterlebt und das
  // Neuladen den Spieler wieder anmeldet. Auf einem geteilten Geraet ist das genau der Fall, den
  // ein Abmeldeknopf verhindern soll.
  {
    const vorher = await angemeldet();
    check('8-vorab: es steht eine Sitzung, die abgemeldet werden koennte',
      !vorher.anmeldeflaeche && vorher.abmeldeknopf, vorher);

    await seite.route('**/api/logout', r =>
      r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Cannot POST /api/logout"}' }));
    await seite.evaluate(() => { window.__logZeilen = []; window.__keinNeuladen = true; });
    await seite.click('#headerLogoutBtn');
    await warte(3000);

    /* Gemessen wird das NEULADEN selbst, ueber eine Marke, die es zerstoert - nicht "ist der
       Spieler angemeldet?". Der Unterschied ist der ganze Punkt und faellt nur an der Gegenprobe
       auf: Ohne die Statuspruefung laedt die Seite neu, das lebende Cookie meldet sofort wieder
       an, und "angemeldet" sieht danach EXAKT gleich aus (Hausregel 28 - gruen aus dem falschen
       Grund). Die Marke unterscheidet die beiden Faelle eindeutig. */
    const nichtNeugeladen = await seite.evaluate(() => window.__keinNeuladen === true);
    check('8: bei einem 404 wird NICHT neu geladen (ein Neuladen meldete ueber das lebende Cookie wieder an)',
      nichtNeugeladen, { markeUeberlebt: nichtNeugeladen });
    const nachher = await angemeldet();
    check('8-dazu: und der Spieler steht weiterhin im Spiel',
      !nachher.anmeldeflaeche && nachher.abmeldeknopf, nachher);
    // Und die Sitzung muss weiter TRAGEN: Wuerde der lokale Zustand trotzdem abgeraeumt, waere das
    // Spiel nach aussen angemeldet und nach innen tot - Server-Funktionen still ohne Wirkung.
    const meStatus = await seite.evaluate(() => fetch('/api/me').then(r => r.status).catch(() => 0));
    check('8b: und die Sitzung traegt weiterhin (kein Halbzustand)', meStatus === 200, { status: meStatus });
    const zeilen = await seite.evaluate(() => (window.__logZeilen || []).join(' | '));
    check('8c: das Spiel benennt den Fehlschlag, statt ihn zu verschlucken',
      /Abmelden hat nicht geklappt/.test(zeilen), { mitschnitt: zeilen.slice(-240) });
    await seite.unroute('**/api/logout');
  }

  await ende(aufraeumen);
})().catch(async e => {
  console.error(e);
  try { await aufraeumen(); } catch (x) {}
  process.exit(1);
});

// GEGENPROBEN (19.08.2026) - Notiz am Ende, damit sie beim Lesen des Tests nicht zwischen Aufbau
// und Messung steht. Es braucht DREI, weil dieser Test drei Dinge misst: die Spieldatei, den
// Server und die Wache gegen einen Server, der die Abmelde-Route nicht kennt.
//
//   neuer Stand:                                  22 Pruefungen, 0 rot
//
//   (1) alte Spieldatei, KEPLER_SPIELDATEI:       22 Pruefungen, 9 rot
//       1, 3b, 6b, 7   - der Token liegt wieder in localStorage und wandert nie heraus.
//       8, 8-dazu, 8c  - der alte Abmeldeweg kennt die Route gar nicht.
//       4b, 4c         - der Nebenbefund, der ohne diese Messung untergegangen waere: Das ALTE
//                        Frontend laesst gegen den NEUEN Server nach dem "Abmelden" ein
//                        GUELTIGES Sitzungs-Cookie auf dem Geraet zurueck (gemessen:
//                        kekse ["kepler7_sid"], /api/me 200). Es meldet den Spieler nicht wieder
//                        an - das alte Frontend sieht das Cookie ja gar nicht -, aber die Sitzung
//                        lebt. Das ist der Grund, Etappe b zuegig nachzuziehen.
//
//   (2) Server ohne Cookie-Loeschung in /api/logout, KEPLER_BACKEND_SERVER:
//                                                 22 Pruefungen, 3 rot
//       4b, 4c, 4d     - 4d ist der Beleg fuer die Behauptung im Kopf: OHNE die Loeschung meldet
//                        "Abmelden" den Spieler beim naechsten Laden WIEDER AN
//                        (gemessen: {"anmeldeflaeche":false,"abmeldeknopf":true}).
//
//   (3) Spieldatei ohne die Statuspruefung (res.ok wird ignoriert):
//                                                 22 Pruefungen, 2 rot
//       8, 8c          - gemessen {"markeUeberlebt":false}: Die Seite laedt neu, und das lebende
//                        Cookie meldet sofort wieder an.
//
// Dieselben 22 in allen vier Laeufen (Hausregel 34). Dass 5 an allen alten Staenden gruen bleibt,
// ist kein Mangel, sondern der Punkt: Eine Bestandssitzung kam vorher herein und soll es weiter -
// genau daran haengt, ob diese Auslieferung ueberhaupt zulaessig ist.
//
// PRUEFUNG 8 HAT DIE GEGENPROBE ZWEIMAL GEBRAUCHT, und der erste Entwurf ist lehrreich: Er fragte
// "steht der Spieler noch im Spiel?" - und blieb gruen, obwohl die Seite neu geladen hatte, weil
// das lebende Cookie ihn sofort wieder anmeldete. Beide Faelle sehen danach IDENTISCH aus
// (Hausregel 28). Gemessen wird deshalb das Neuladen SELBST, ueber eine Marke, die es zerstoert.
//
// EIN WERKZEUGFEHLER AUS DIESER RUNDE, und er hat Gegenprobe (2) zuerst wertlos gemacht:
// Frueh abgebrochene Laeufe (Playwright-Timeout) hatten ihr Backend nicht abgeraeumt. Zwei
// verwaiste server.js-Prozesse hielten den Port, und die "sabotierte" Gegenprobe sprach in
// Wahrheit mit dem ECHTEN Server von vorhin - sie war gruen und belegte nichts. Behoben in beide
// Richtungen: Der aeussere Fehlerausgang raeumt jetzt auf, und der Test prueft VOR dem Start, ob
// der Port schon belegt ist (0-port). Dieselbe Familie wie Hausregel 15/17/19 - nie ein
// Messwerkzeug, das sich selbst im Weg steht.
