// Verteidigung bekommt Anerkennung (18.08.2026).
//
// WARUM ES DIESEN TEST GIBT
// -------------------------
// Gemessen am Stand v8.567.0: Von 102 Erfolgen hatte KEIN EINZIGER einen Verteidigungsbezug, und
// von 28 Kosmetikstücken ebenfalls keines. Kampfpunkte gibt es ausschließlich fürs Angreifen
// (docs/verteidigung-flotte-konzept.md 1.3). Diese Lieferung schließt beides - und dabei liegt
// genau eine Falle, die dieser Test bewacht:
//
//   Es gibt ZWEI Zähler für abgewehrte Angriffe, und sie sind NICHT austauschbar.
//     * `state.pvpDefended` steht im SPIELSTAND. Der Server schreibt ihn, danach ist er
//       klientenautoritativ. Für einen ERFOLG ist das in Ordnung - ein Erfolg ist keine Fläche,
//       die anderen gehört, und alle 102 vorhandenen arbeiten genauso.
//     * `user.staub.abwehrGesamt` steht im NUTZEROBJEKT des Servers. Nur er taugt für KOSMETIK,
//       denn eine Namensfarbe steht in der Bestenliste, also auf einer Fläche, die allen gehört.
//
//   Die bequeme Abkürzung wäre, die Kosmetik ebenfalls an `pvpDefended` zu hängen - der Katalog
//   liest für seine übrigen Fortschritts-Bedingungen ja ohnehin den Spielstand. Sie ist genau der
//   Fehler, an dem die Wochenpass-Analyse gescheitert ist, und Abschnitt B2 fällt darauf.
//
// GEPRÜFT WIRD
//   A) am GERENDERTEN Spiel: die Bollwerk-Reihe schaltet aus `pvpDefended` frei, in beide
//      Richtungen (0 -> nichts, 150 -> alle fünf), die Schwelle stimmt knapp darunter, der Titel
//      erscheint, und der Hilfe-Abschnitt zeigt die ABGELEITETEN Zahlen (nicht seinen Rückfall).
//   B) am Backend-Quelltext, mit AUSGEFÜHRTEN Funktionen statt gelesenen Zeilen (Hausregel 43):
//      die Bedingungsart liest das Nutzerobjekt und NICHT den Spielstand, sie ist unbefristet,
//      und der Zähler wächst nur hinter dem Absprache-Riegel.
//
// GEGENPROBE, dreimal gefahren (18.08.2026, alle Zahlen gemessen, nicht geschätzt).
// Grüner Lauf: 35 Prüfungen, 0 rot.
//
//   (a) Gegen den Stand v8.567.0, Frontend UND Backend (KEPLER_SPIELDATEI + KEPLER_BACKEND_SERVER
//       auf `git show HEAD:`-Kopien): 13 Prüfungen, 6 rot -
//         FAIL - A1-vorab: die Bollwerk-Reihe existiert in ACHIEVEMENTS | {"gefunden":0}
//         FAIL - B1: der Katalog führt die Bedingungsart abgewehrt | {"gefunden":[]}
//         FAIL - B1: der ausgelieferte Katalog hängt den Tagesriegel an
//         FAIL - B4: derselbe Angreifer zählt am selben Tag nur einmal (dreimal, Zähler fehlt)
//       13 statt 35, weil Abschnitt A ohne die Reihe nichts messen KANN und sich mit einer
//       SKIP-Zeile abmeldet. Das ist der Grund, warum es hier keinen frühen Ausstieg gibt:
//       Abschnitt B läuft trotzdem und liefert seine Aussage (Hausregel 34).
//
//   (b) Gegen eine Backend-Kopie, deren 'abgewehrt'-Zweig `save.pvpDefended` liest statt des
//       Nutzerobjekts - also die bequeme Abkürzung von oben: 36 Prüfungen, GENAU ZWEI rot -
//         FAIL - B2: ein gefälschter Spielstand schaltet die Kosmetik NICHT frei | {"ergebnis":true}
//         FAIL - B2: der serverseitige Zähler schaltet sie sehr wohl frei | {"ergebnis":false}
//       Alles andere bleibt grün. Das ist der Fall, den nur diese eine Prüfung sieht.
//
//   (c) Gegen eine Backend-Kopie, die den Zähler VOR die Absprache-Riegel setzt: 36 Prüfungen,
//       zwei rot -
//         FAIL - B4: derselbe Angreifer zählt am selben Tag nur einmal | {"abwehrGesamt":5}
//         FAIL - B4: über den Tagesdeckel hinaus zählt nichts mehr mit | {"abwehrGesamt":7}

const fs = require('fs');
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI, SERVER_JS, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

// ---------------------------------------------------------------------------------------------
// Hilfsmittel
// ---------------------------------------------------------------------------------------------

function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
    return j({});
  };
}

const stand = zusatz => JSON.stringify(Object.assign({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 5e5, erz: 5e5, kristalle: 3e5, deuterium: 2e5, antimaterie: 1e4, forschungspunkte: 2e4 },
  buildings: { solar: 15, mine: 14, lager: 18, werft: 8, labor: 8 },
  research: {}, colonies: {}, activeBasePlanet: 'home',
  player: { id: 'u', name: 'A', avatarKey: null },
  fleet: { jaeger: 500, frachter: 50, missions: [] },
  battleStats: { wins: 3, losses: 1 }, xp: 5000, credits: 20000, buffs: [],
  // Ereignis-Uhren gepinnt (Hausregel 18/20): Ein Planeten-Ereignis oder ein Händler mitten im
  // Messfenster erzeugt eine Meldungs-Salve und kostet Zeit, ohne dass es hier etwas zu messen gibt.
  nextPlanetEventCheck: Date.now() + 36e5, nextTraderCheck: Date.now() + 36e5,
  lastTick: Date.now(), colonyNames: {}
}, zusatz));

const gespeichert = store => { try { return JSON.parse(store['kepler7-save-v3'] || '{}'); } catch (e) { return {}; } };

// checkAchievements() hängt an SPIELERAKTIONEN, nicht am Haupt-Takt (gemessen: ein Spielstand, der
// jede Bedingung erfüllt, hat nach zehn Sekunden Laufzeit null Erfolge). Ein Test, der nur wartet,
// misst deshalb nichts - er braucht einen Klick. Genommen wird der billigste echte Spielerweg: ein
// Gebäude-Ausbau im Basis-Reiter.
async function aktionAusloesen(page) {
  return page.evaluate(() => {
    const t = document.querySelector('.tab-btn[data-tab="basis"]'); if (t) t.click();
    const knopf = [...document.querySelectorAll('[data-build]')].find(x => !x.disabled);
    if (!knopf) return null;
    knopf.click();
    return knopf.getAttribute('data-build');
  });
}

async function warteAuf(page, pruefe, maxMs) {
  const bis = Date.now() + (maxMs || 20000);
  while (Date.now() < bis) { if (await pruefe()) return true; await page.waitForTimeout(120); }
  return false;
}

async function starte(browser, spielstand) {
  const store = { 'kepler7-save-v3': spielstand };
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport: { width: 1000, height: 1500 } }));
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) fehler.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForSelector('.tab-btn[data-tab="fortschritt"]', { timeout: 60000 });
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });
  return { ctx, page, store, fehler };
}

// Die Schlüssel der Reihe werden AUS DER SPIELDATEI gelesen, nicht hier eingetippt: Kommt eine
// sechste Stufe dazu, prüft dieser Test sie automatisch mit, statt still an fünf hängenzubleiben
// (Hausregel 3 - die REGEL prüfen, nicht die Momentaufnahme; Hausregel 33 - keine blanke Zahl).
const SPIEL = fs.readFileSync(SPIELDATEI, 'utf8');
const REIHE = (() => {
  const v = SPIEL.indexOf('const ACHIEVEMENTS');
  const b = SPIEL.indexOf('\n  ];', v);
  if (v < 0 || b < 0) return [];
  return [...SPIEL.slice(v, b).matchAll(/key:'(bollwerk\d+)'[\s\S]{0,600}?>=\s*(\d+)/g)]
    .map(m => ({ key: m[1], schwelle: Number(m[2]) }))
    .sort((a, b2) => a.schwelle - b2.schwelle);
})();

(async () => {
  check('A1-vorab: die Bollwerk-Reihe existiert in ACHIEVEMENTS', REIHE.length >= 3,
    { gefunden: REIHE.length, reihe: REIHE });
  // KEIN frueher Ausstieg bei fehlender Reihe: Abschnitt B haengt nicht an ihr, und eine
  // Gegenprobe, die nach der ersten roten Zeile abbricht, hat ihre uebrigen Pruefungen nie
  // ausgefuehrt - der rote Exit-Code sieht dann aus wie eine gelungene Gegenprobe, obwohl
  // niemand weiss, was die anderen gesagt haetten (Hausregel 34).
  const hoechste = REIHE.length ? REIHE[REIHE.length - 1] : null;
  const browser = REIHE.length ? await starteBrowser() : null;
  if (!REIHE.length) console.log('SKIP - Abschnitt A uebersprungen (ohne die Reihe gibt es im Spiel nichts zu messen); Abschnitt B laeuft weiter.');

  // ---- A) Das gerenderte Spiel ----------------------------------------------------------------

  // A1: OHNE abgewehrte Angriffe darf keiner freigeschaltet sein. Ohne diese Gegenrichtung wäre
  // "schaltet frei" auch mit einer check-Funktion grün, die immer true liefert (Hausregel 28).
  if (browser) {
    const { ctx, page, store, fehler } = await starte(browser, stand({ pvpDefended: 0 }));
    await warteAuf(page, () => !!gespeichert(store).achievements, 20000);
    const ach = gespeichert(store).achievements || {};
    const faelschlich = REIHE.filter(r => ach[r.key]).map(r => r.key);
    check('A1: ohne abgewehrte Angriffe ist keine Stufe freigeschaltet', faelschlich.length === 0, { faelschlich });
    check('A1: keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
    await ctx.close();
  }

  // A2/A3: Mit einem Stand ÜBER der höchsten Schwelle müssen alle Stufen fallen - und zwar
  // rückwirkend, ohne dass im Test ein Angriff stattfindet. Gemessen wird der GESPEICHERTE Stand,
  // nicht das DOM: Genau dieser Stand wird nach einem Reload wieder geladen.
  if (browser) {
    const { ctx, page, store, fehler } = await starte(browser, stand({ pvpDefended: hoechste.schwelle }));
    const gebaut = await aktionAusloesen(page);
    check('A2-vorab: eine Spieleraktion ließ sich auslösen', !!gebaut, { gebaut });
    const alle = await warteAuf(page, () => {
      const a = gespeichert(store).achievements || {};
      return REIHE.every(r => a[r.key]);
    }, 25000);
    const ach = gespeichert(store).achievements || {};
    check('A2: alle Stufen der Reihe schalten rückwirkend frei', alle,
      { erwartet: REIHE.map(r => r.key), fehlend: REIHE.filter(r => !ach[r.key]).map(r => r.key) });

    // A3: Der Titel - gemessen dort, wo ihn ANDERE zu sehen bekommen. playerTitle() lebt im
    // Modulscope und ist von außen nicht aufrufbar; sein Ergebnis reist aber im veröffentlichten
    // Bestenlisten-Eintrag mit, und genau das ist die Aussage, die zählt. Auf der Seite selbst
    // steht der Titel nirgends im Text (nachgemessen) - eine Prüfung auf document.body wäre also
    // aus dem falschen Grund rot gewesen.
    const lbTitel = await warteAuf(page, () => {
      const k = Object.keys(store).find(x => x.indexOf('leaderboard:') === 0);
      if (!k) return false;
      try { return !!JSON.parse(store[k]).title; } catch (e) { return false; }
    }, 20000);
    const lbKey = Object.keys(store).find(x => x.indexOf('leaderboard:') === 0);
    let veroeffentlicht = null;
    try { veroeffentlicht = lbKey ? JSON.parse(store[lbKey]).title : null; } catch (e) {}
    check('A3-vorab: ein Bestenlisten-Eintrag wurde veröffentlicht', lbTitel, { lbKey });
    check('A3: der Verteidigungs-Titel steht im veröffentlichten Eintrag',
      typeof veroeffentlicht === 'string' && veroeffentlicht.length > 0, { titel: veroeffentlicht });

    // A4: Der Hilfe-Abschnitt. Er leitet seine Zahlen aus ACHIEVEMENTS ab; steht dort der
    // Rückfallwert, ist die Ableitung stillschweigend gescheitert (Hausregel 38 - der
    // Syntax-Check führt nichts aus, also wird hier ausgeführt gemessen).
    // Der Hilfetext wird über den Kopfleisten-Knopf erreicht (einen Reiter dafür gibt es nicht) und
    // liegt in einem zugeklappten Aufklapper - erst nach dem Klick auf die Kategorie ist er für den
    // Spieler lesbar. Gemessen wird deshalb innerText NACH dem Aufklappen, nicht innerHTML des
    // Dokuments: Das Spiel steht als ein einziges <script> in der Seite, eine Suche über
    // documentElement.innerHTML fände den QUELLTEXT des Abschnitts und wäre immer grün.
    const hilfe = await page.evaluate(() => {
      const b = document.getElementById('headerHelpBtn'); if (b) b.click();
      const box = document.getElementById('helpBox'); if (!box) return null;
      const kat = [...box.querySelectorAll('[data-help-cat]')]
        .find(k => /Was dir Verteidigung einbringt/.test(k.textContent || ''));
      if (!kat) return null;
      // Nur aufklappen, wenn zu - ein zweiter Klick klappte wieder zu, und innerText wäre leer.
      if (!kat.classList.contains('open')) { const kopf = kat.querySelector('.help-category-header'); if (kopf) kopf.click(); }
      const neuKat = document.querySelector('[data-help-cat="' + kat.getAttribute('data-help-cat') + '"]');
      const kategorie = ((neuKat || kat).querySelector('.bname') || {}).textContent || '';
      // Auf den EINZELNEN Eintrag scopen, nicht auf die Kategorie: Sonst genügte es, dass die
      // gesuchten Zahlen irgendwo in einem der Nachbarabsätze stehen, und die Prüfung wäre aus dem
      // falschen Grund grün (Hausregel 28/39).
      const eintrag = [...(neuKat || kat).querySelectorAll('.help-entry')]
        .find(x => /Was dir Verteidigung einbringt/.test(((x.querySelector('.help-entry-title') || {}).textContent || '')));
      return { kategorie: kategorie.trim(), text: eintrag ? (eintrag.innerText || '') : null };
    });
    const hilfeText = hilfe && hilfe.text;
    check('A4-vorab: der Hilfe-Abschnitt ist als eigener Eintrag lesbar', !!hilfeText,
      { kategorie: hilfe && hilfe.kategorie });
    if (hilfeText) {
      // Die Zahlen stehen NUR dann darin, wenn die Ableitung aus ACHIEVEMENTS wirklich gelaufen
      // ist - der Rückfall im Quelltext liefert andere Werte. Das ist die Ausführungsprobe zu
      // Hausregel 38, die der Syntax-Check nicht leisten kann.
      check('A4: er nennt die abgeleitete Stufenzahl und die höchste Schwelle',
        hilfeText.indexOf('' + REIHE.length + ' Stufen') !== -1 && hilfeText.indexOf('bis ' + hoechste.schwelle) !== -1,
        { stufen: REIHE.length, hoechste: hoechste.schwelle, ausschnitt: hilfeText.slice(0, 400) });
      // Und er muss dort stehen, wo ihn jemand sucht. Bis zum 18.08.2026 lag der Bastionsmarken-
      // Abschnitt unter „Offiziere" - ein Hilfetext in der falschen Kategorie ist für den Spieler
      // so gut wie nicht vorhanden.
      check('A4: der Abschnitt steht in der Kategorie Kampf',
        !!hilfe && /Kampf$/.test(hilfe.kategorie), { kategorie: hilfe && hilfe.kategorie });
    }
    check('A2: keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
    await ctx.close();
  }

  // A5: Knapp DARUNTER. Eine Schwelle wird immer von beiden Seiten geprüft (Hausregel 12) - sonst
  // wäre ">= 1" statt ">= 150" genauso grün.
  if (browser && REIHE.length >= 2) {
    const { ctx, page, store, fehler } = await starte(browser, stand({ pvpDefended: hoechste.schwelle - 1 }));
    const vorletzte = REIHE[REIHE.length - 2];
    await aktionAusloesen(page);
    await warteAuf(page, () => !!(gespeichert(store).achievements || {})[vorletzte.key], 25000);
    const ach = gespeichert(store).achievements || {};
    check('A5: einer unter der Schwelle reicht für die höchste Stufe NICHT', !ach[hoechste.key],
      { stand: hoechste.schwelle - 1, schwelle: hoechste.schwelle });
    check('A5: die Stufe darunter ist aber sehr wohl freigeschaltet', !!ach[vorletzte.key],
      { stufe: vorletzte.key, schwelle: vorletzte.schwelle });
    check('A5: keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
    await ctx.close();
  }

  if (browser) await browser.close();

  // ---- B) Backend: ausgeführt, nicht gelesen ---------------------------------------------------

  if (!SERVER_JS) {
    console.log('SKIP - Backend-Quelltext nicht gefunden, Abschnitt B übersprungen.');
    return ende();
  }
  const server = fs.readFileSync(SERVER_JS, 'utf8');

  // Einen Funktionsblock samt Rumpf herausschneiden (Klammerzählung statt Regex - eine naive Regex
  // terminiert bei dieser Dateigröße an verschachtelten Klammern falsch).
  function block(quelle, anfang) {
    const i = quelle.indexOf(anfang);
    if (i < 0) return null;
    let d = 0, s = quelle.indexOf('{', i), k = s;
    if (s < 0) return null;
    for (; k < quelle.length; k++) { if (quelle[k] === '{') d++; else if (quelle[k] === '}') { d--; if (!d) break; } }
    return quelle.slice(i, k + 1);
  }
  function literal(quelle, anfang, auf, zu) {
    const i = quelle.indexOf(anfang);
    if (i < 0) return null;
    let d = 0, s = quelle.indexOf(auf, i), k = s;
    if (s < 0) return null;
    for (; k < quelle.length; k++) { if (quelle[k] === auf) d++; else if (quelle[k] === zu) { d--; if (!d) break; } }
    return quelle.slice(s, k + 1);
  }

  // B1: Der Katalog führt die Art überhaupt - und trägt den Tagesriegel mit, damit der Erklärtext
  // im Spiel ihn nennen kann, ohne die Konstante abzuschreiben.
  const defsRoh = literal(server, 'const KOSMETIK_DEFS = [', '[', ']');
  check('B1-vorab: KOSMETIK_DEFS gefunden', !!defsRoh);
  let DEFS = [];
  try { DEFS = eval('(' + defsRoh + ')'); } catch (e) { check('B1-bau: KOSMETIK_DEFS ließ sich lesen', false, String(e).slice(0, 160)); }
  const abgewehrtDefs = DEFS.filter(d => d.bedingung && d.bedingung.typ === 'abgewehrt');
  check('B1: der Katalog führt die Bedingungsart abgewehrt', abgewehrtDefs.length >= 2,
    { gefunden: abgewehrtDefs.map(d => d.key) });
  // Der Tagesriegel steht bewusst NICHT im Literal (das müssen zwei Tests auswerten können),
  // sondern wird beim Ausliefern des Katalogs angehängt. Geprüft wird deshalb die Auslieferung.
  const katalogZeile = (server.match(/katalog:\s*KOSMETIK_DEFS\.map\([\s\S]{0,400}?\}\)\),/) || [])[0] || '';
  check('B1: der ausgelieferte Katalog hängt den Tagesriegel an',
    /abgewehrt/.test(katalogZeile) && /proTag/.test(katalogZeile) && /STAUB_ABWEHR_MAX_PRO_TAG/.test(katalogZeile),
    { zeile: katalogZeile.replace(/\s+/g, ' ').slice(0, 220) });

  // B2: DIE KERNPRÜFUNG. Die Bedingung darf den SPIELSTAND nicht befragen. Gemessen wird das,
  // indem beides gleichzeitig vorgelegt wird: ein Spielstand, der weit über der Schwelle liegt,
  // und ein Nutzerobjekt, das bei null steht.
  const erfuelltRoh = block(server, 'function kosmetikBedingungErfuellt(');
  check('B2-vorab: kosmetikBedingungErfuellt gefunden', !!erfuelltRoh);
  if (erfuelltRoh && abgewehrtDefs.length) {
    const def = abgewehrtDefs.slice().sort((a, b2) => a.bedingung.wert - b2.bedingung.wert)[0];
    let erfuellt = null, bauFehler = null;
    try {
      // `findUserById` ist hier bewusst ein FIXTURE und kein Ersatz für eine Rechenfunktion: Es
      // liefert die Nutzerdatenbank, also die EINGABE des Tests (Hausregel 36 betrifft Helfer,
      // deren Verhalten das Ergebnis verändert - eine Nachschlagetabelle tut das nicht).
      erfuellt = new Function('findUserById', 'KOSMETIK_STUFEN_RANG', 'supporterStatusCombined',
        'spenderStufeJeErreicht', erfuelltRoh + '; return kosmetikBedingungErfuellt;')(
        (id) => ({ id, staub: { abwehrGesamt: 0 } }), { bronze: 1, silver: 2, gold: 3 },
        () => ({ active: false }), () => null);
    } catch (e) { bauFehler = String(e).slice(0, 200); }
    check('B2-bau: der Block ließ sich ausführen', !!erfuellt, bauFehler || undefined);
    if (erfuellt) {
      const gefaelschterStand = { pvpDefended: def.bedingung.wert * 100, battlePoints: 0, prestige: 0 };
      let ergebnis = null;
      try { ergebnis = erfuellt('u', def, gefaelschterStand); } catch (e) { ergebnis = 'FEHLER: ' + String(e).slice(0, 160); }
      check('B2: ein gefälschter Spielstand schaltet die Kosmetik NICHT frei', ergebnis === false,
        { stueck: def.key, schwelle: def.bedingung.wert, pvpDefendedImStand: gefaelschterStand.pvpDefended, ergebnis });

      // Und die Gegenrichtung: mit dem SERVERSEITIGEN Zähler muss es greifen, sonst wäre B2 auch
      // mit einer Bedingung grün, die grundsätzlich false liefert (Hausregel 28).
      let mitZaehler = null;
      try {
        const f = new Function('findUserById', 'KOSMETIK_STUFEN_RANG', 'supporterStatusCombined',
          'spenderStufeJeErreicht', erfuelltRoh + '; return kosmetikBedingungErfuellt;')(
          (id) => ({ id, staub: { abwehrGesamt: def.bedingung.wert } }), { bronze: 1, silver: 2, gold: 3 },
          () => ({ active: false }), () => null);
        mitZaehler = f('u', def, {});
      } catch (e) { mitZaehler = 'FEHLER: ' + String(e).slice(0, 160); }
      check('B2: der serverseitige Zähler schaltet sie sehr wohl frei', mitZaehler === true,
        { stueck: def.key, schwelle: def.bedingung.wert, ergebnis: mitZaehler });
    }
  }

  // B3: Unbefristet. Der Zähler wächst nur; würde die Art als befristet geführt, prüfte der
  // Lesepfad sie bei jedem Bestenlisten-Abruf erneut und läse dafür unnötig den Spielstand.
  const befristetRoh = block(server, 'function kosmetikBefristet(');
  check('B3-vorab: kosmetikBefristet gefunden', !!befristetRoh);
  if (befristetRoh && abgewehrtDefs.length) {
    let bef = null;
    try { bef = new Function(befristetRoh + '; return kosmetikBefristet;')(); } catch (e) {}
    check('B3-bau: der Block ließ sich ausführen', !!bef);
    if (bef) check('B3: die Art abgewehrt gilt als unbefristet', bef(abgewehrtDefs[0]) === false,
      { stueck: abgewehrtDefs[0].key });
  }

  // B4: Der Absprache-Riegel. Ausgeführt mit den ECHTEN Funktionen aus server.js - inklusive der
  // Abhängigkeiten, die mitgeschnitten statt nachgebaut werden (Hausregel 36).
  const teile = ['function staubTagesschluessel(', 'function staubWochenschluessel(',
                 'function staubKonto(', 'function staubGutschreiben(', 'function staubAbwehrGutschreiben(']
    .map(a => block(server, a));
  const deckelRoh = (server.match(/const STAUB_ABWEHR_MAX_PRO_TAG\s*=\s*(\d+)/) || [])[1];
  const satzRoh = (server.match(/const STAUB_ABWEHR\s*=\s*(\d+)/) || [])[1];
  check('B4-vorab: alle Zähler-Funktionen und Konstanten gefunden',
    teile.every(Boolean) && !!deckelRoh && !!satzRoh,
    { fehlend: teile.map((t, i) => t ? null : i).filter(x => x !== null), deckel: deckelRoh, satz: satzRoh });
  if (teile.every(Boolean) && deckelRoh && satzRoh) {
    let gut = null, bauFehler = null;
    try {
      gut = new Function('STAUB_ABWEHR_MAX_PRO_TAG', 'STAUB_ABWEHR',
        teile.join('\n') + '\n; return staubAbwehrGutschreiben;')(Number(deckelRoh), Number(satzRoh));
    } catch (e) { bauFehler = String(e).slice(0, 200); }
    check('B4-bau: die Zähler-Funktionen ließen sich ausführen', !!gut, bauFehler || undefined);
    if (gut) {
      // Derselbe Angreifer, mehrfach am selben Tag.
      const einer = { staub: undefined };
      for (let i = 0; i < 5; i++) gut(einer, 'angreifer-1');
      check('B4: derselbe Angreifer zählt am selben Tag nur einmal',
        (einer.staub || {}).abwehrGesamt === 1,
        { versuche: 5, abwehrGesamt: (einer.staub || {}).abwehrGesamt });

      // Verschiedene Angreifer, mehr als der Tagesdeckel erlaubt.
      const viele = { staub: undefined };
      const deckel = Number(deckelRoh);
      for (let i = 0; i < deckel + 4; i++) gut(viele, 'angreifer-' + i);
      check('B4: über den Tagesdeckel hinaus zählt nichts mehr mit',
        (viele.staub || {}).abwehrGesamt === deckel,
        { angreifer: deckel + 4, deckel, abwehrGesamt: (viele.staub || {}).abwehrGesamt });

      // Und dass er überhaupt etwas tut - sonst wären beide Prüfungen oben mit einem Zähler grün,
      // der nie hochzählt.
      check('B4: der Zähler wächst überhaupt', (einer.staub || {}).abwehrGesamt > 0);
    }
  }

  // B5: Der Erklärtext im Spiel. Geprüft wird die REGEL (Schwelle und Riegel stehen darin), nicht
  // eine Schreibweise (Hausregel 36, zweite Hälfte).
  const textRoh = block(SPIEL, 'function kosmetikBedingungText(');
  check('B5-vorab: kosmetikBedingungText gefunden', !!textRoh);
  if (textRoh && abgewehrtDefs.length) {
    // Die Bedingung wird so zusammengesetzt, wie der SERVER sie ausliefert - also mit proTag aus
    // der echten Konstante, nicht mit einer hier eingetippten Zahl.
    const b = Object.assign({}, abgewehrtDefs[0].bedingung, { proTag: Number(deckelRoh) });
    let txt = null, bauFehler = null;
    try {
      const f = new Function(textRoh + '; return kosmetikBedingungText;')();
      txt = f(b);
    } catch (e) { bauFehler = String(e).slice(0, 200); }
    check('B5-bau: der Block ließ sich ausführen', typeof txt === 'string', bauFehler || undefined);
    if (typeof txt === 'string') {
      check('B5: der Text nennt die Schwelle', txt.indexOf('' + b.wert) !== -1, { text: txt });
      check('B5: der Text nennt den Tagesriegel', txt.indexOf('' + b.proTag) !== -1, { text: txt });
      check('B5: der Text sagt, dass der Zähler bei null begonnen hat', /null begonnen|bei null/i.test(txt), { text: txt });
      check('B5: er ist keine Notfall-Antwort', txt.indexOf('unbekannt') === -1, { text: txt });
    }
  }

  ende();
})();
