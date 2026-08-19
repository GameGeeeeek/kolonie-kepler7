// Die seitlichen Klappen dürfen die Reiterleiste nicht verdecken - AUCH NICHT, wenn ein Banner
// über der Leiste steht (18.08.2026).
//
// DER VORFALL, DER DIESEN TEST ERZWUNGEN HAT
// ------------------------------------------
// `test_reiterleiste.js` fiel im vollen Prüflauf und war einzeln grün. Er meldete auf 390x844
// ["galaxie","fortschritt"] und auf 360x740 ["basis","karte","galaxie","fortschritt"] als
// verdeckt. Zwei frühere Sitzungen hatten dasselbe Bild als Wackeln unter Last behandelt und die
// Wartelogik des Tests verstärkt. Nachgemessen war es kein Wackeln:
//
//   `.edge-tab` hängt am VIEWPORT (am Handy `bottom:8%`), `.tabs` am INHALT darüber. Wird
//   `#eventBanner` sichtbar (ein Zufallsereignis, 138-164 px hoch), rutscht die Leiste in das
//   feste Band der Klappen - und weil die Klappen z-index 50 tragen und die Leiste 25, ist der
//   Reiter darunter nicht bloß verdeckt, sondern nicht antippbar.
//
// Gemessen am Stand VOR der Behebung, mit `state.activeEvent` im Spielstand:
//   390x844  Leiste 600..717, Klappen 685..776  -> ["galaxie","fortschritt"]
//   360x740  Leiste 570..687, Klappen 589..681  -> ["basis","karte","galaxie","fortschritt"]
//   360x640  Leiste 570..687, Klappen 497..589  -> ["basis","karte"]
// Die ersten beiden Zeilen sind ZEICHENGLEICH mit dem, was der Prüflauf gemeldet hat. Damit war
// der Fehlschlag reproduziert, statt weiter als Zufall verbucht zu werden.
//
// WARUM ES DIESEN TEST NEBEN test_reiterleiste.js GIBT
// ----------------------------------------------------
// Gefunden hat den Fehler dort ein UNGEPINNTER Ereignis-Zufall (Hausregel 18) - also Glück. Ein
// Fehler, der nur bei etwa jedem zwanzigsten Lauf auffällt, ist nicht abgesichert, er ist bloß
// gelegentlich sichtbar. Dieser Test setzt `state.activeEvent` ausdrücklich und misst die
// Eigenschaft deterministisch; `test_reiterleiste.js` pinnt seine Uhren seither und misst wieder
// nur seinen eigenen Gegenstand.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün: node tests/test_klappen_kollision.js
//   rot:  git show HEAD:weltraum_kolonie.html > /tmp/alt.html
//         KEPLER_SPIELDATEI=/tmp/alt.html node tests/test_klappen_kollision.js
//   Am Stand vor der Behebung fallen die drei "mit Ereignis"-Prüfungen; die Vorab- und
//   Gegenrichtungs-Prüfungen bleiben grün und belegen damit, dass gemessen wurde und nicht bloß
//   etwas fehlte.
const path = require('path');
const { starteBrowser, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const FILE = 'file://' + path.resolve(process.env.KEPLER_SPIELDATEI || SPIELDATEI);

const GROESSEN = [{ name: '390x844', w: 390, h: 844 },
                  { name: '360x740', w: 360, h: 740 },
                  { name: '360x640', w: 360, h: 640 }];

function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s) => r.fulfill({ status: s || 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
    if (p === 'galaxy') return j({ npcEmpireStrength: 1, marketTrend: 1, unlockedAlienRaces: [],
      collapsedSystems: {}, activeWormhole: null, news: [], controlledSystems: {}, factions: {} });
    if (p.indexOf('storage/') === 0) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))
      return j(p.indexOf('pending') >= 0 ? { reward: null } : []);
    return j({});
  };
}

// Beide Ereignis-Uhren gepinnt (Hausregel 18). Das REICHT hier aber NICHT, und der Satz, der
// vorher an dieser Stelle stand, war falsch: `maybeSpawnRandomEvent()` - die Funktion, die
// `state.activeEvent` und damit das Banner setzt - hat GAR KEINE Uhr. Sie würfelt je Tick mit
// 0,25 % und ist deshalb über den Spielstand nicht stillzulegen (`state.lastEventTime` wird zwar
// geschrieben, aber nirgends als Sperre gelesen - wer sie pinnt, pinnt nichts). Gemessen am
// 19.08.2026 im Suite-Lauf: ein 152 px hohes Fremd-Banner in der "ohne Ereignis"-Messung bei
// 360x740, während 390x844 und 360x640 im selben Lauf sauber waren. Deshalb räumt `messen()`
// unten ein zufälliges Ereignis über den SPIELERWEG weg und misst neu - und meldet, dass es das
// getan hat, statt es zu verschweigen.
function speicher(mitEreignis) {
  const t = Date.now();
  const s = {
    tutorialSeen: true, newbieWelcomeSeen: true,
    seenTabHints: { basis: 1, verteidigung: 1, forschung: 1, flotte: 1, expedition: 1, karte: 1,
      galaxie: 1, allianz: 1, offiziere: 1, markt: 1, punkte: 1, fortschritt: 1 },
    resources: { energie: 412000, erz: 388000, kristalle: 264000, deuterium: 151000, antimaterie: 19400, forschungspunkte: 31200 },
    buildings: { solar: 20, mine: 19, raffinerie: 15, synth: 13, labor: 12, werft: 12, hangar: 8, lager: 12 },
    research: { rsolar: 8, rerz: 8, rkampf: 7 }, fleet: { jaeger: 420, missions: [] },
    colonies: {}, activeBasePlanet: 'home', shipMarks: {},
    player: { id: 'u', name: 'A', allianceTag: '', avatarKey: null }, battleStats: { wins: 5, losses: 1 },
    xp: 64000, buffs: [], lastTick: t, colonyNames: {}, colonyNotes: {},
    nextPlanetEventCheck: t + 3600000, nextTraderCheck: t + 3600000
  };
  // 'asteroid' ist ein echter RANDOM_EVENTS-Schlüssel. Ein erfundener würde vom else-Zweig des
  // Renderers still ausgeblendet, das Banner bliebe weg und die Messung wäre vacuous.
  if (mitEreignis) s.activeEvent = { key: 'asteroid', expiresAt: t + 1800000 };
  return JSON.stringify(s);
}

// Was der SPIELER hat: nicht "ist ein Element vorhanden", sondern "kommt der Tap an"
// (Hausregel 49 - ein Sichtbarkeits-Test hätte diesen Fehler nie gefunden).
const lese = () => {
  const bar = document.querySelector('.tabs');
  const bb = bar.getBoundingClientRect();
  const eb = document.getElementById('eventBanner');
  const sicht = Array.prototype.slice.call(document.querySelectorAll('.edge-tab'))
    .filter(e => getComputedStyle(e).display !== 'none');
  const btns = Array.prototype.slice.call(bar.querySelectorAll('.tab-btn'));
  const trifft = el => {
    const r = el.getBoundingClientRect();
    const t = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return t ? (t === el || el.contains(t) || t.contains(el)) : false;
  };
  return {
    bannerHoehe: eb ? Math.round(eb.getBoundingClientRect().height) : 0,
    bannerSichtbar: !!eb && getComputedStyle(eb).display !== 'none',
    leiste: [Math.round(bb.top), Math.round(bb.bottom)],
    klappenAnzahl: sicht.length,
    klappen: sicht.map(e => (e.id || '?') + ':' + Math.round(e.getBoundingClientRect().top) + '..' + Math.round(e.getBoundingClientRect().bottom)),
    // Überschneidung der Rechtecke - dieselbe Rechnung wie in test_reiterleiste.js
    verdeckt: btns.filter(x => {
      const r = x.getBoundingClientRect();
      return sicht.some(e => {
        const k = e.getBoundingClientRect();
        return r.left < k.right && r.right > k.left && r.top < k.bottom && r.bottom > k.top;
      });
    }).map(x => x.getAttribute('data-tab')),
    // Die Gegenrichtung: Wer etwas VERSCHIEBT, erzeugt Kollisionen an der neuen Stelle
    // (Hausregel 53). Bleiben die Klappen selbst bedienbar und ganz im Fenster?
    klappenBedienbar: sicht.filter(trifft).length,
    klappenAusserhalb: sicht.filter(e => {
      const r = e.getBoundingClientRect();
      return r.top < 0 || r.bottom > window.innerHeight + 1;
    }).map(e => e.id || '?'),
    versatzGesetzt: sicht.filter(e => !!e.style.bottom).length
  };
};

async function messen(browser, g, mitEreignis) {
  const store = { 'kepler7-save-v3': speicher(mitEreignis) };
  const ctx = await browser.newContext({ viewport: { width: g.w, height: g.h }, hasTouch: g.w <= 700, isMobile: g.w <= 700 });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE);
  await page.waitForTimeout(2400);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
  });
  // Mindestens ein voller Haupt-Tick, denn dort weicht die Klappe aus. Wer früher misst, misst
  // den Zustand VOR dem Ausweichen - und das sähe aus wie ein wirkungsloser Fix.
  await page.waitForTimeout(2600);

  /* Ein zufällig gefeuertes Ereignis kapert die "ohne Ereignis"-Messung (Begründung oben). Es wird
     über den Weg weggeräumt, den auch der Spieler hat - der "Ignorieren"-Knopf des Banners -, nicht
     über einen Griff in den Modulscope: Der ist von außen gar nicht erreichbar, und ein Test, der
     Spielinternes nachbaut, misst nicht mehr das Spiel (Hausregel 36/47). Bis zu drei Anläufe, weil
     der Würfel auch danach weiterläuft; die Restwahrscheinlichkeit liegt damit unter 1 zu 10.000.
     In der "mit Ereignis"-Messung kann das gar nicht passieren: `maybeSpawnRandomEvent` kehrt bei
     gesetztem `state.activeEvent` in der ersten Zeile zurück. */
  let streu = 0;
  for (let i = 0; !mitEreignis && i < 3; i++) {
    const steht = await page.evaluate(() => {
      const eb = document.getElementById('eventBanner');
      return !!eb && getComputedStyle(eb).display !== 'none';
    });
    if (!steht) break;
    streu++;
    await page.evaluate(() => { const b = document.getElementById('eventOptB'); if (b) b.click(); });
    await page.waitForTimeout(1300);          // ein voller Tick: erst der raeumt das Banner ab
  }

  const r = await page.evaluate(lese);
  r.bootfehler = fehler.slice(0, 2);
  r.streuEreignis = streu;                    // steht im Protokoll, statt still zu bleiben
  await ctx.close();
  return r;
}

(async () => {
  const browser = await starteBrowser();
  try {
    for (const g of GROESSEN) {
      const ohne = await messen(browser, g, false);
      const mit = await messen(browser, g, true);
      const p = g.name + ': ';

      check(p + 'Vorab: es gibt überhaupt zwei Klappen und ohne Ereignis kein Banner',
        ohne.klappenAnzahl >= 2 && ohne.bannerHoehe === 0 && ohne.bootfehler.length === 0,
        { klappen: ohne.klappenAnzahl, bannerHoehe: ohne.bannerHoehe, bootfehler: ohne.bootfehler,
          streuEreignisWeggeklickt: ohne.streuEreignis });

      // Ohne diese Prüfung wäre die Hauptaussage darunter vacuous: Bleibt das Banner weg, ist
      // "nichts verdeckt" trivial erfüllt (Hausregel 37).
      check(p + 'Vorab: mit gesetztem Ereignis steht das Banner wirklich und schiebt die Leiste',
        mit.bannerSichtbar && mit.bannerHoehe > 60 && mit.leiste[0] > ohne.leiste[0],
        { bannerSichtbar: mit.bannerSichtbar, bannerHoehe: mit.bannerHoehe,
          leisteOhne: ohne.leiste, leisteMit: mit.leiste });

      check(p + 'ohne Ereignis verdecken die Klappen keinen Reiter',
        ohne.verdeckt.length === 0, { verdeckt: ohne.verdeckt, leiste: ohne.leiste, klappen: ohne.klappen });

      check(p + 'MIT Ereignis-Banner verdecken die Klappen ebenfalls keinen Reiter',
        mit.verdeckt.length === 0,
        { verdeckt: mit.verdeckt, leiste: mit.leiste, klappen: mit.klappen, bannerHoehe: mit.bannerHoehe });

      check(p + 'die ausgewichenen Klappen bleiben selbst bedienbar und ganz im Fenster',
        mit.klappenBedienbar === mit.klappenAnzahl && mit.klappenAusserhalb.length === 0,
        { bedienbar: mit.klappenBedienbar, von: mit.klappenAnzahl, ausserhalb: mit.klappenAusserhalb, klappen: mit.klappen });
    }

    // Gegenrichtung am PC: Dort gilt die Regel nicht, und ein zurückgelassener Versatz wäre ein
    // Fehler, den niemand erklären könnte. Geprüft wird, dass KEIN style.bottom gesetzt ist -
    // die Klappen also wieder ihrer CSS-Regel folgen.
    const pc = await messen(browser, { name: 'PC', w: 1280, h: 900 }, true);
    check('PC 1280x900: kein Versatz gesetzt, die Klappen folgen wieder dem Stylesheet',
      pc.versatzGesetzt === 0 && pc.verdeckt.length === 0,
      { versatzGesetzt: pc.versatzGesetzt, verdeckt: pc.verdeckt, klappen: pc.klappen });
  } catch (e) {
    check('LAUF: der Test lief bis zum Ende durch', false, { fehler: String((e && e.stack) || e) });
  }
  return ende(async () => browser.close());
})();
