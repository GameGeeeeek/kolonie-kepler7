// Der Spielstand darf beim Update nicht verloren gehen (Spieler-Report 14.09.2026:
// "Wenn Updates kommen, wird die Bauschlange gelöscht und auch die Forschungsschlange").
//
// DIE FEHLERKLASSE, gemessen: storageGet() fällt bei jedem Serverfehler still auf die lokale
// Notkopie zurück. Für Rundfunk-Schlüssel ist das richtig, für den eigenen Spielstand nicht:
// load() konnte die Notkopie nicht von einer echten Serverantwort unterscheiden, meldete
// "Spielstand automatisch geladen" und schrieb sie beim nächsten Takt über den unversehrten
// Serverstand. Das Zeitfenster dafür ist genau der Deploy (Backend startet sich neu, rund 7 s 502)
// - deshalb fiel es als "beim Update" auf.
//
// Geprüft wird die REGEL, nicht der Wortlaut einer Meldung:
//   1) Störung beim Laden -> der Serverstand bleibt unverändert (nichts wird überschrieben)
//   2) ... und das Spiel bleibt gesperrt, solange es den Stand nicht hat (fail-closed)
//   3) nach der Störung holt es sich den Stand von allein und ist wieder spielbar
//   4) OHNE Notkopie (neues Gerät) wird kein leerer Anfangsstand über den Serverstand geschrieben
//   5) Normalbetrieb bleibt unberührt: laden, spielen, speichern
//   6) ein echtes 404 (neues Konto) startet weiterhin ganz normal eine neue Kolonie
//
// GEGENPROBE (gemessen, beide Richtungen, identische Prüfnamen per diff verglichen):
//   neuer Stand  -> Exit 0, alle 14 Prüfungen grün
//   alter Stand  -> Exit 1, GENAU diese fünf fallen
//     2: das Spiel meldet nicht fälschlich "geladen"
//     1: Serverstand auch NACH der Störung unverändert (nichts überschrieben)
//     3: nach der Störung stehen die Warteschlangen wieder in der Anzeige
//     4: und es wird keine "Neue Kolonie" gemeldet
//     4: nach der Störung steht der echte Stand da
//   Alter Stand:  KEPLER_SPIELDATEI=<kopie von HEAD~> node tests/test_spielstand_ersatz.js
//   Die Prüfungen 5 und 6 sind an BEIDEN Ständen grün - sie sind die Gegenprobe zur Sperre
//   selbst: eine Sicherung, die einfach alles blockiert, wäre sonst unbemerkt "grün".

const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

const FILE = SPIEL_URL;
const MEIN_ID = 'u';
const KEY = 'kepler7-save-v3';
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

function backend(store, lage){ return async r => {
  const req = r.request(); const u = new URL(req.url()); const p = u.pathname.split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return lage.offline ? r.abort() : j({ ok: true });
  if (lage.offline) return r.abort();
  if (p === 'me') return j({ userId: MEIN_ID, username: 'Ersatztest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p === 'storage-list') { const prefix = u.searchParams.get('prefix') || ''; return j({ keys: Object.keys(store).filter(k => k.startsWith(prefix) && !k.startsWith('__v:')) }); }
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    // Nur die Spielstand-Route stört - genau wie ein Backend, das gerade neu startet, während
    // nginx die Seite schon ausliefert.
    if (lage.blind && k === KEY) return j({ error: 'Bad Gateway' }, 502);
    if (req.method() === 'PUT'){
      try {
        const body = JSON.parse(req.postData() || '{}');
        const ist = store['__v:'+k] || 0;
        // Echte Versionsprüfung wie im Backend - sonst könnte der Test einen Überschreiber
        // übersehen, den der Server in Wahrheit abgelehnt hätte.
        if (body.expectedVersion !== undefined && body.expectedVersion !== ist) return j({ error: 'conflict', version: ist }, 409);
        store[k] = body.value; store['__v:'+k] = ist + 1;
      } catch(e){}
      return j({ ok: true, version: store['__v:'+k] });
    }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: store['__v:'+k] || 1 });
    return j({ e: 1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

// Absichtlich ARM: die eingereihten Posten dürfen nicht abgearbeitet werden, sonst wäre
// "verloren" nicht von "erledigt" zu unterscheiden.
const basis = (extra) => JSON.stringify(Object.assign({
  tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: {},
  resources: { energie: 5, erz: 5, kristalle: 0, deuterium: 0, antimaterie: 0, forschungspunkte: 0 },
  buildings: { solar: 1, mine: 1, labor: 1 }, research: { rsolar: 1 },
  fleet: { jaeger: 0, missions: [] }, colonies: {}, activeBasePlanet: 'home',
  player: { id: MEIN_ID, name: 'Ersatztest', allianceTag: null, avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 0, buffs: [],
  colonyNames: {}, modules: {}, shipModules: {}, equippedShipModules: {}
}, extra));

const MIT_SCHLANGEN = { buildQueue: [{ planet: 'home', key: 'fusionsreaktor' }], researchQueue: ['rerz'] };
const OHNE_SCHLANGEN = { buildQueue: [], researchQueue: [] };

function schlangenAus(roh){
  try { const s = JSON.parse(roh);
    return { bau: (s.buildQueue||[]).map(q => q.key), forschung: (s.researchQueue||[]).slice() }; }
  catch(e){ return { fehler: String(e) }; }
}
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function seite(browser, store, lage, lokal){
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
  const page = await ctx.newPage();
  await page.route('**/api/**', backend(store, lage));
  await page.addInitScript(([k, v]) => {
    localStorage.setItem('kepler7_token', 'tok');
    if (v) localStorage.setItem('kepler7_' + k, v); else localStorage.removeItem('kepler7_' + k);
  }, [KEY, lokal || null]);
  return { ctx, page };
}
const ladezustand = () => (document.getElementById('loadstate') || {}).textContent || '';

(async () => {
  const browser = await starteBrowser();

  // ================================================ 1-3) Störung mit alter Notkopie im Browser
  {
    const store = { [KEY]: basis(MIT_SCHLANGEN), ['__v:'+KEY]: 7 };
    const lage = { blind: true, offline: false };
    const { ctx, page } = await seite(browser, store, lage, basis(OHNE_SCHLANGEN));
    await page.goto(FILE); await page.waitForTimeout(3000);

    const waehrend = schlangenAus(store[KEY]);
    check('1: Serverstand bleibt während der Störung unverändert',
      gleich(waehrend, { bau: ['fusionsreaktor'], forschung: ['rerz'] }), waehrend);

    // fail-closed: Solange der echte Stand fehlt, darf das Spiel nicht so tun, als wäre er da.
    // Gemessen an der Wirkung, nicht am Text: die Notkopie hat LEERE Warteschlangen - erschiene
    // sie als Spielstand, stünden die Boxen auf "leer" und die Meldung auf "geladen".
    const ladeText = await page.evaluate(ladezustand);
    check('2: das Spiel meldet nicht fälschlich "geladen"',
      !/automatisch geladen|Neue Kolonie gestartet/.test(ladeText), ladeText.slice(0, 80));

    // Jetzt ist das Backend wieder da - das Spiel muss sich selbst erholen.
    lage.blind = false;
    await page.waitForTimeout(16000);
    const danach = schlangenAus(store[KEY]);
    check('1: Serverstand auch NACH der Störung unverändert (nichts überschrieben)',
      gleich(danach, { bau: ['fusionsreaktor'], forschung: ['rerz'] }), danach);
    // Die Erholung an der WIRKUNG messen, nicht am Meldungstext: #loadstate wird im laufenden
    // Betrieb wieder geleert, ein Text-Vergleich wäre hier grün oder rot je nach Zufall.
    check('3: nach der Störung stehen die Warteschlangen wieder in der Anzeige',
      /Fusionsreaktor/.test(await page.evaluate(() => (document.getElementById('buildQueueBox')||{}).innerText || '')));
    check('3: und das Spiel speichert wieder (bootDataReady ist gesetzt)',
      store['__v:'+KEY] > 7, { version: store['__v:'+KEY] });
    await ctx.close();
  }

  // ================================================ 4) Störung OHNE Notkopie (neues Gerät)
  // Die schlimmere Fassung derselben Fehlerklasse: ohne lokale Kopie lieferte storageGet null,
  // load() nahm den "Neue Kolonie gestartet"-Zweig und speicherte einen leeren Anfangsstand.
  {
    const store = { [KEY]: basis(MIT_SCHLANGEN), ['__v:'+KEY]: 3 };
    const lage = { blind: true, offline: false };
    const { ctx, page } = await seite(browser, store, lage, null);
    await page.goto(FILE); await page.waitForTimeout(3000);
    const waehrend = schlangenAus(store[KEY]);
    check('4: ohne Notkopie wird kein leerer Anfangsstand über den Serverstand geschrieben',
      gleich(waehrend, { bau: ['fusionsreaktor'], forschung: ['rerz'] }), waehrend);
    const ladeText = await page.evaluate(ladezustand);
    check('4: und es wird keine "Neue Kolonie" gemeldet',
      !/Neue Kolonie gestartet/.test(ladeText), ladeText.slice(0, 80));
    lage.blind = false;
    await page.waitForTimeout(16000);
    check('4: nach der Störung steht der echte Stand da',
      gleich(schlangenAus(store[KEY]), { bau: ['fusionsreaktor'], forschung: ['rerz'] }), schlangenAus(store[KEY]));
    await ctx.close();
  }

  // ================================================ 5) Normalbetrieb (Gegenprobe zur Sperre)
  // Ohne diese Prüfung wäre eine Sicherung grün, die schlicht ALLES sperrt.
  {
    const store = { [KEY]: basis(MIT_SCHLANGEN), ['__v:'+KEY]: 1 };
    const lage = { blind: false, offline: false };
    const { ctx, page } = await seite(browser, store, lage, null);
    await page.goto(FILE); await page.waitForTimeout(4000);
    check('5: Normalbetrieb - der Stand wird geladen',
      /automatisch geladen/.test(await page.evaluate(ladezustand)));
    check('5: Normalbetrieb - die Warteschlange ist sichtbar',
      /Fusionsreaktor/.test(await page.evaluate(() => (document.getElementById('buildQueueBox')||{}).innerText || '')));
    const vorher = store['__v:'+KEY];
    await page.waitForTimeout(13000);
    check('5: Normalbetrieb - es wird weiterhin gespeichert', store['__v:'+KEY] > vorher,
      { vorher, nachher: store['__v:'+KEY] });
    check('5: Normalbetrieb - und der Inhalt bleibt vollständig',
      gleich(schlangenAus(store[KEY]), { bau: ['fusionsreaktor'], forschung: ['rerz'] }), schlangenAus(store[KEY]));
    await ctx.close();
  }

  // ================================================ 6) echtes 404 = neues Konto
  // Die Nachbarschaft der Änderung: storageGet gibt bei 404 weiterhin null zurück, BEVOR die
  // strikte Sperre greifen kann. Ein neues Konto muss also ganz normal starten - eine Sicherung,
  // die auch den ersten Start blockiert, wäre schlimmer als der Fehler, den sie verhindert.
  {
    const store = {};                       // Server kennt diesen Spielstand nicht
    const lage = { blind: false, offline: false };
    const { ctx, page } = await seite(browser, store, lage, null);
    await page.goto(FILE); await page.waitForTimeout(4000);
    check('6: ohne vorhandenen Serverstand startet weiterhin eine neue Kolonie',
      /Neue Kolonie gestartet/.test(await page.evaluate(ladezustand)),
      (await page.evaluate(ladezustand)).slice(0, 80));
    check('6: und dieser neue Stand wird auch gespeichert', (store['__v:'+KEY] || 0) >= 1,
      { version: store['__v:'+KEY] });
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? 'FAIL - Spielstand-Ersatz' : 'OK - Spielstand-Ersatz');
  process.exit(fail ? 1 : 0);
})();
