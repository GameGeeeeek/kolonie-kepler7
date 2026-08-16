// Komfort-Grenzen: Warteschlangen, Notizlänge, Freundesliste, Berichts-Archiv (16.08.2026).
//
// Vier Listen im Spiel haben eine harte Obergrenze; mit Unterstützer-Rang ist sie höher. Vor dieser
// Änderung stand die 30 der Freundesliste an DREI Stellen (Konstante, Fehlermeldung, Hilfetext) und
// die 10 der Warteschlangen an zwei - jetzt ziehen alle aus KOMFORT_GRENZEN.
//
// GEPRÜFT WIRD:
//   1. Die Tabelle ist die EINZIGE Quelle: Keine der alten Zahlen steht noch als Literal an einer
//      Prüf- oder Anzeigestelle. Das ist der eigentliche Zweck der Änderung (Regel 6).
//   2. Die Grenze FOLGT dem Rang - ohne Rang die kleine, mit Rang die große. Gemessen an der
//      Funktion, nicht am Quelltext.
//   3. Der Spender-Bereich wirbt mit den neuen Vorteilen, und zwar mit den ECHTEN Zahlen aus der
//      Tabelle. Eine Liste, die drei Automatiken nennt, während es sechs Vorteile gibt, wäre genau
//      die veraltete zweite Anzeigestelle, gegen die die Liste gebaut wurde.
//   4. Das Notizfeld lässt die längere Notiz auch WIRKLICH eintippen (maxLength am Element) - ohne
//      das dürfte ein Unterstützer 200 Zeichen speichern, aber nur 48 tippen.
//
// GEGENPROBE, in beide Richtungen gefahren (16.08.2026):
//   Gegen den Stand davor (git show HEAD:weltraum_kolonie.html):
//     FAIL - 1: KOMFORT_GRENZEN existiert
//     ... und alle folgenden.
//   Gegen eine Kopie, in der komfortGrenze() den Rang ignoriert (immer `standard`):
//     FAIL - 2: die Warteschlangen-Grenze folgt dem Rang | {"ohne":10,"mit":10}
//     FAIL - 4: das Notizfeld erlaubt die längere Eingabe
//   Gegen eine Kopie, in der maxLength nicht gesetzt wird:
//     FAIL - 4: das Notizfeld erlaubt die längere Eingabe | {"maxLength":48}

const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];
// Kommentare leeren, bevor Literale gezählt werden: Sie zitieren die alten Zahlen ausdrücklich
// (CLAUDE.md-Regel 33 - ein Zähler über rohen Quelltext sieht den Unterschied nicht).
const jsOhneKommentare = js.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const SAVE = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 99999, erz: 99999, kristalle: 99999, deuterium: 9999, antimaterie: 999, forschungspunkte: 9999, kikerne: 50 },
  buildings: { solar: 5, mine: 5 }, research: {}, fleet: { jaeger: 5, missions: [] }, colonies: {},
  activeBasePlanet: 'home', player: { id: 'u', name: 'Komforttest', allianceTag: '', avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 300, buffs: [], lastTick: Date.now(),
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0,
  friends: [], buildQueue: [], researchQueue: []
});

const OHNE = { active: false, tier: null, exempt: false, until: 0, quelle: null,
  trial: { verfuegbar: true, genutztAm: 0, aktiv: false, bis: 0, tage: 5 } };
const MIT = { active: true, tier: 'gold', exempt: false, granted: true, until: Date.now() + 30 * 86400000,
  quelle: 'vergeben', trial: { verfuegbar: true, genutztAm: 0, aktiv: false, bis: 0, tage: 5 } };
const ARCHIV = { belegt: 12, platz: 150, standard: 40, unterstuetzer: 150 };

function backend(opt){
  const store = { 'kepler7-save-v3': SAVE };
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'Komforttest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, supporter: opt.supporter });
    if (p === 'reports') return j({ reports: [], archiv: opt.archiv || ARCHIV });
    if (p === 'cosmetics') return j({ katalog: [], besitz: [], getragen: {}, vorgabe: {}, staub: null });
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
    return j({});
  };
}

async function oeffne(browser, opt){
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1500 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(opt));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  return { ctx, page, errs };
}

(async () => {
  // ---- 1) Eine Quelle statt verstreuter Literale ------------------------------------------------
  check('1: KOMFORT_GRENZEN existiert', /const KOMFORT_GRENZEN\s*=/.test(js));
  check('1: FRIENDS_MAX ist verschwunden', !/FRIENDS_MAX/.test(jsOhneKommentare),
    (jsOhneKommentare.match(/.{0,40}FRIENDS_MAX.{0,20}/) || [])[0]);
  // Die beiden Warteschlangen-Prüfungen dürfen keine eingetippte Zahl mehr enthalten. Geprüft wird
  // die REGEL ("die Prüfung liest die Tabelle"), nicht eine Trefferzahl (Regel 3/33).
  // Auf die GUARDS eingegrenzt (die mit der "ist voll"-Meldung) - `researchQueue.length >= vorher`
  // weiter unten ist ein unbeteiligter interner Vergleich und hat hier nichts zu suchen.
  const wsZeilen = jsOhneKommentare.split('\n')
    .filter(l => /(researchQueue|buildQueue)\.length >=/.test(l) && /ist voll/.test(l));
  check('1-vorab: beide Warteschlangen-Prüfungen gefunden', wsZeilen.length === 2, wsZeilen.map(l => l.trim().slice(0, 70)));
  const wsHartkodiert = wsZeilen.filter(l => /\.length >= \d/.test(l));
  check('1: keine Warteschlangen-Prüfung nennt noch eine feste Zahl', wsHartkodiert.length === 0, wsHartkodiert);
  // Der Hilfetext zur Freundesliste zieht die Zahl ebenfalls aus der Tabelle.
  check('1: der Hilfe-Abschnitt liest die Tabelle statt einer eigenen 30',
    /Merkliste \(max\. '\+KOMFORT_GRENZEN\.freunde\.standard/.test(js));

  // ---- 2) Die Grenze folgt dem Rang -------------------------------------------------------------
  // Das ganze Spiel läuft in einem IIFE; `komfortGrenze` liegt damit NICHT auf `window` und ist aus
  // dem Browser heraus nicht aufrufbar. Geprüft wird deshalb wie andernorts im Repo: Tabelle und
  // Funktion werden aus der Datei geschnitten und hier ausgeführt.
  //
  // `automatikFreigeschaltet` wird dabei vorgegeben - das ist erlaubt und kein Platzhalter im Sinne
  // von Regel 36: Es ist genau die EINGANGSGRÖSSE, die variiert werden soll, nicht eine
  // Hilfsfunktion, deren Verhalten mitgeprüft gehört. Dass der Rang im echten Spiel bis hierher
  // durchschlägt, belegt Prüfung 4 am maxLength des Notizfeldes.
  function schneide(anfang, oeffner, schliesser){
    const i = js.indexOf(anfang);
    if (i < 0) return null;
    let d = 0, s = js.indexOf(oeffner, i), k = s;
    for (; k < js.length; k++){ if (js[k] === oeffner) d++; else if (js[k] === schliesser){ d--; if (!d) break; } }
    return js.slice(s, k + 1);
  }
  const tabelleRoh = schneide('const KOMFORT_GRENZEN = {', '{', '}');
  const fnRoh = schneide('function komfortGrenze(schluessel){', '{', '}');
  check('2-vorab: Tabelle und Funktion gefunden', !!tabelleRoh && !!fnRoh);
  let KOMFORT_GRENZEN = null, ohne = {}, mit = {};
  if (tabelleRoh && fnRoh){
    // Jeden eval-Aufruf abfangen und als eigene Prüfung melden, statt den Test abstürzen zu lassen
    // (CLAUDE.md-Regel 34).
    try {
      KOMFORT_GRENZEN = eval('(' + tabelleRoh + ')');
      const bauen = rang => eval('(function(KOMFORT_GRENZEN, automatikFreigeschaltet){ return function komfortGrenze(schluessel)' + fnRoh + '; })')(KOMFORT_GRENZEN, () => rang);
      const fOhne = bauen(false), fMit = bauen(true);
      for (const k of ['warteschlange', 'notizZeichen', 'freunde']){ ohne[k] = fOhne(k); mit[k] = fMit(k); }
    } catch (e) {
      check('2-bau: Tabelle und Funktion lassen sich ausführen', false, String(e.message));
    }
  }
  check('2: die Warteschlangen-Grenze folgt dem Rang', mit.warteschlange > ohne.warteschlange, { ohne: ohne.warteschlange, mit: mit.warteschlange });
  check('2: die Notizlänge folgt dem Rang', mit.notizZeichen > ohne.notizZeichen, { ohne: ohne.notizZeichen, mit: mit.notizZeichen });
  check('2: die Freundesliste folgt dem Rang', mit.freunde > ohne.freunde, { ohne: ohne.freunde, mit: mit.freunde });
  // Und die kleinen Werte sind wirklich die bisherigen - niemand soll unbemerkt schlechter dastehen
  // als vor dieser Änderung.
  check('2: ohne Rang gilt weiterhin genau das bisherige Maß',
    ohne.warteschlange === 10 && ohne.notizZeichen === 48 && ohne.freunde === 30, ohne);

  const browser = await starteBrowser();
  const a = await oeffne(browser, { supporter: OHNE });
  const b = await oeffne(browser, { supporter: MIT });

  // ---- 3) Der Spender-Bereich wirbt mit den neuen Vorteilen -------------------------------------
  await b.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="fortschritt"]'); if (x) x.click(); });
  await b.page.waitForTimeout(1200);
  const hub = await b.page.evaluate(() => {
    const el = document.getElementById('supporterHubBox');
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  check('3: der Spender-Bereich nennt die längeren Warteschlangen', /Warteschlangen/.test(hub || ''), (hub || '').slice(0, 80));
  check('3: und das größere Berichts-Archiv', /Berichts-Archiv/.test(hub || ''));
  check('3: und die Notizen/Freunde', /Kolonie-Notizen/.test(hub || ''));
  // Mit den ECHTEN Zahlen - nicht mit erfundenen. Verglichen wird gegen die Tabelle im laufenden
  // Spiel (Regel 2: gemessener Ausgangsstand statt eingetippter Zahl).
  check('3: die genannte Warteschlangen-Zahl stammt aus der Tabelle',
    (hub || '').includes(String(mit.warteschlange) + ' statt ' + String(ohne.warteschlange)), { gesucht: mit.warteschlange + ' statt ' + ohne.warteschlange });
  check('3: die genannte Archiv-Zahl stammt vom Server',
    (hub || '').includes(String(ARCHIV.unterstuetzer) + ' statt ' + String(ARCHIV.standard)), { gesucht: ARCHIV.unterstuetzer + ' statt ' + ARCHIV.standard });

  // ---- 4) Das Notizfeld lässt die längere Eingabe auch zu --------------------------------------
  const maxLen = await b.page.evaluate(() => {
    const el = document.getElementById('colonyNoteInput');
    return el ? el.maxLength : null;
  });
  check('4: das Notizfeld erlaubt die längere Eingabe', maxLen === mit.notizZeichen, { maxLength: maxLen, erwartet: mit.notizZeichen });
  const maxLenOhne = await a.page.evaluate(() => {
    const el = document.getElementById('colonyNoteInput');
    return el ? el.maxLength : null;
  });
  check('4: und ohne Rang weiterhin nur die kurze', maxLenOhne === ohne.notizZeichen, { maxLength: maxLenOhne, erwartet: ohne.notizZeichen });

  check('keine JS-Fehler (ohne Rang)', a.errs.length === 0, a.errs.slice(0, 3));
  check('keine JS-Fehler (mit Rang)', b.errs.length === 0, b.errs.slice(0, 3));
  await a.ctx.close(); await b.ctx.close();
  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
