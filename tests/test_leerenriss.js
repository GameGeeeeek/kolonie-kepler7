// Leerenriss-Wiedergabe: Riss statt Platzhalter, ehrliche Kraftschiene, scrollbare Tafeln
// (v8.440.0, Aufgaben #8/#9/#11 - alle drei an derselben Buehne GEMESSEN, nicht vermutet).
//
// DIE DREI BEFUNDE:
//   #8  Der Leerenriss-Bericht fuehrt KEINE Gegnerflotte - die Buehne erfand trotzdem zwei
//       rote Platzhalter-Schiffe (gemessen 26.611 gruene gegen 1.327 rote Bildpunkte).
//       Jetzt: die Gegenseite hat null Ruempfe, an ihrer Stelle steht der gezeichnete Riss
//       (zeichneRiss), der zurueckschiesst (rissSchritt) und sich im Verlauf schwaecht.
//   #9  Die Kraftschiene zaehlte nur Rumpfgewichte - bei unbekannter Gegenseite stur
//       "Du 100% / 0%", waehrend die Tafel daneben "12.809 Abwehrkraft" nannte. Jetzt EINE
//       Helferfunktion (kraftAnteilA) fuer BEIDE Anzeigestellen (HUD und Video).
//   #11 #osTafelA scrollte (scrollHeight 245 zu clientHeight 167), zeigte es aber nicht an -
//       die letzte Zeile war mittendurch geschnitten. Jetzt Verlauf + "N weitere Zeilen".
//
// GEPRUEFT WIRD (Regeln, die kritischen AUSGEFUEHRT):
//   1) schlachtDaten AUSGEFUEHRT: void-rift markiert riss, PvP bewusst NICHT (dort gibt es
//      eine echte, nur unbekannte Flotte), zerfallener Riss bleibt unabspielbar.
//   2) kraftAnteilA + rissStaerke AUSGEFUEHRT: Berichtszahlen statt 0%, Verlustanteil der
//      eigenen Seite, Schwaecherwerden des Risses, Rueckfall auf Rumpfgewichte.
//   3) Verdrahtung: keine D-Ruempfe bei Riss, findeGegner zielt auf den Riss, Zeichnen- und
//      Schritt-Aufrufe an der richtigen Stelle, BEIDE Kraft-Anzeigestellen nutzen den Helfer.
//   4) Browser (Telefonmass): Wiedergabe eines Leerenriss-Berichts laeuft OHNE Fehler (die
//      leeren Gegner-Arrays sind das Absturzrisiko dieser Aenderung), die Schiene zeigt dem
//      Riss echte Prozent, die Tafel traegt den Scrollhinweis mit Zeilenzahl.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren ausgefuehrt): am alten Stand fallen 1 (riss-
// Feld fehlt), 2 (kraftAnteilA existiert nicht) und 3 durch.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) schlachtDaten ausgefuehrt: die Riss-Markierung
{
  const von = JS.indexOf('const Schlachtdaten = (function () {');
  const bis = JS.indexOf('})();', von);
  check('1a: Schlachtdaten-Kapsel gefunden', von > 0 && bis > von);
  const modul = new Function(JS.slice(von, bis + 5) + '\nreturn Schlachtdaten;')();
  const sd = modul.schlachtDaten;
  const riss = sd({ type:'void-rift', result:'win', targetPlanet:'p1', attackPower:20000,
    defensePower:12809, fleet:{ jaeger:100, cruisers:20 }, ownLostShips:{ jaeger:5 } }, null);
  check('1b: void-rift markiert die Gegenseite als Riss (unbekannt, mit Kraft)',
    riss && riss.verteidiger && riss.verteidiger.riss === true &&
    riss.verteidiger.bekannt === false && riss.verteidiger.kraft === 12809,
    riss && riss.verteidiger);
  const pvp = sd({ type:'player-attack', result:'win', attackPower:20000, defensePower:9000,
    fleet:{ jaeger:10 } }, null);
  check('1c: PvP bleibt bewusst OHNE riss-Markierung (echte, nur unbekannte Flotte)',
    pvp && pvp.verteidiger && !pvp.verteidiger.riss && pvp.verteidiger.bekannt === false);
  const zerfallen = sd({ type:'void-rift', result:'collapsed' }, null);
  check('1d: ein zerfallener Riss ist weiterhin kein Gefecht', zerfallen && zerfallen.abspielbar === false);
}

// ---- 2) kraftAnteilA + rissStaerke ausgefuehrt
{
  const fnAus = (kopf) => {
    const a = JS.indexOf(kopf);
    if (a < 0) return '';
    const b = JS.indexOf('\n    }', a);
    return b > a ? JS.slice(a, b + 6) : '';
  };
  const qR = fnAus('function rissStaerke(){');
  const qK = fnAus('function kraftAnteilA(summeA, summeD){');
  check('2a: rissStaerke und kraftAnteilA gefunden', qR.length > 100 && qK.length > 300,
    [qR.length, qK.length]);
  // Seit v8.441.0 kennt kraftAnteilA auch den Raid-Boss (BOSS/bossHpAnteil) - die Sandbox
  // stellt beide, sonst wirft der Nicht-Riss-Zweig einen ReferenceError (Arbeitsregel 9).
  const qB = fnAus('function bossHpAnteil(){');
  const rechne = (ctx) => new Function('ctx',
    'var GEGNER_UNBEKANNT = ctx.unbekannt, DATEN = ctx.daten, KRAFT_START_A = ctx.startA,' +
    ' RISS = ctx.riss || null, BOSS = ctx.boss || null, tSim = ctx.t || 0;' +
    ' function klemme(v, a, b){ return Math.min(b, Math.max(a, v)); }\n' +
    qR + '\n' + qB + '\n' + qK + '\nreturn kraftAnteilA(ctx.summeA, ctx.summeD);')(ctx);
  const daten = { verteidiger: { kraft: 12809, riss: true }, angriffskraft: 20000, abwehrkraft: 12809, ergebnis: 'sieg' };
  // Erwartungen aus derselben Formel unabhaengig hergeleitet, nicht aus dem Code abgelesen.
  check('2b: zu Kampfbeginn gilt das Berichtsverhaeltnis (statt "Du 100%")',
    rechne({ unbekannt: true, daten, startA: 1000, riss: {}, t: 2.6, summeA: 1000, summeD: 0 })
      === Math.round(100 * 20000 / (20000 + 12809)));
  check('2c: eigene Verluste druecken den eigenen Anteil',
    rechne({ unbekannt: true, daten, startA: 1000, riss: {}, t: 2.6, summeA: 500, summeD: 0 })
      === Math.round(100 * 10000 / (10000 + 12809)));
  check('2d: bei Sieg schliesst sich der Riss - am Ende 100%',
    rechne({ unbekannt: true, daten, startA: 1000, riss: {}, t: 41, summeA: 1000, summeD: 0 }) === 100);
  const datenNl = Object.assign({}, daten, { ergebnis: 'niederlage' });
  check('2e: bei Niederlage bleibt der Riss geschwaecht stehen (nie 100%)',
    rechne({ unbekannt: true, daten: datenNl, startA: 1000, riss: {}, t: 41, summeA: 1000, summeD: 0 })
      === Math.round(100 * 20000 / (20000 + 12809 * 0.55)));
  check('2f: bekannte Gegenseite rechnet unveraendert mit Rumpfgewichten',
    rechne({ unbekannt: false, daten, startA: 1000, t: 5, summeA: 300, summeD: 100 })
      === Math.round(100 * 300 / 400));
  check('2g: unbekannt OHNE gemeldete Kraft faellt auf die alte Rechnung zurueck',
    rechne({ unbekannt: true, daten: { verteidiger: {}, angriffskraft: 20000, abwehrkraft: 0 },
             startA: 1000, t: 5, summeA: 700, summeD: 0 }) === 100);
}

// ---- 3) Verdrahtung in der Buehne
check('3a: die Riss-Gegenseite bekommt KEINE Stellvertreter-Ruempfe (seit v8.441.0 auch der Boss)',
  JS.includes("var n = ((RISS || BOSS) && d.seite === 'D') ? 0 : neueRumpfZahl(k), arr = new Array(n);") &&
  JS.includes('proSchiff[k] = n > 0 ? d.start / n : 0;'));
check('3b: die Angreifer zielen auf den Riss',
  JS.includes("if (seite === 'A' && RISS) return rissStaerke() > 0.03 ? RISS : null;"));
{
  // Reihenfolge im Zeichenpfad: Riss nach den Wracks und vor den Antrieben. Die REGEL wird
  // geprueft, nicht die woertliche Dreierfolge (Arbeitsregel 3) - seit v8.441.0 steht
  // zwischen Riss und Antrieben zusaetzlich die Boss-Silhouette.
  const w = JS.indexOf('zeichneWracks(g);\n      zeichneRiss(g);');
  const antriebe = w > 0 ? JS.indexOf('zeichneAntriebe(g);', w) : -1;
  check('3c: zeichneRiss haengt im Zeichenpfad zwischen Wracks und Antrieben',
    w > 0 && antriebe > 0 && antriebe - w < 120, antriebe - w);
}
check('3d: rissSchritt laeuft im Simulationsschritt neben der Bodenabwehr',
  JS.includes('anlagenSchritt(dt);\n      rissSchritt(dt);'));
check('3e: BEIDE Kraft-Anzeigestellen nutzen kraftAnteilA (HUD und Video), die alte Formel ist weg',
  (JS.match(/var pa = kraftAnteilA\(summeA, summeD\);/g) || []).length === 2 &&
  !JS.includes('var ges = summeA + summeD || 1, pa ='));
check('3f: die HUD-Signatur traegt bei Riss/Boss eine Sekundenmarke (Schiene haengt an der Zeit)',
  JS.includes("if (RISS || BOSS) sig += '|' + Math.round(tSim);"));
check('3g: enterZiele uebersteht leere Gegner-Arrays', JS.includes('if (!arr || !arr.length) continue;'));
check('3h: die Hilfe nennt Riss-Zeichnung und ehrliche Kraftschiene (zweite Anzeigestelle)',
  JS.includes('wird als Riss über dem Planeten gezeichnet') &&
  JS.includes('mit der gemeldeten Abwehrkraft aus dem Bericht'));

// ---- 4) Tafel-Scrollhinweis (#11): Stil und Verdrahtung
check('4a: der Hinweis klebt sticky am unteren Rand und verschwindet am Listenende',
  /#osWrap \.tafel-mehr\{position:sticky/.test(HTML) &&
  /#osWrap \.tafel\.am-ende \.tafel-mehr\{opacity:0\}/.test(HTML));
check('4b: beide Tafeln werden nach jedem Aufbau und nach Groessenaenderung neu bemessen',
  (JS.match(/tafelScrollPruefen\(elTafelA\);/g) || []).length === 2 &&
  (JS.match(/tafelScrollPruefen\(elTafelD\);/g) || []).length === 2);
check('4c: der Hinweis zaehlt die wirklich verborgenen Zeilen',
  JS.includes("zs[i].offsetTop + zs[i].offsetHeight > el.scrollTop + el.clientHeight"));

// ---- 5) Browser: Wiedergabe auf dem Telefon, ohne Fehler, mit Riss-Prozenten und Hinweis
const BERICHT = { id: 'r1', time: Date.now(), type: 'void-rift', result: 'win',
  targetPlanet: 'p1', attackPower: 20000, defensePower: 12809, chancePct: 61,
  phasen: [ { name:'Anflug', chance:0.6, gewonnen:true, power:20000 },
            { name:'Hauptgefecht', chance:0.55, gewonnen:true, power:20000 },
            { name:'Nachhut', chance:0.7, gewonnen:true, power:20000 } ],
  // 15 Klassen, damit die Tafel auf dem Telefon WIRKLICH ueber den 26vh-Deckel waechst -
  // mit 9 Klassen passte sie noch hinein und 5e/5f massen nichts (erster Lauf dieses Tests).
  fleet: { jaeger:400, hyperjaeger:120, cruisers:80, destroyers:40, bomber:60, hyperbomber:20,
           schlachtschiff:12, recycler:6, frachter:8, spaeher:5, forscher:4, colonyShips:2,
           schuerfschiff:3, bergungskran:1, lotsenboot:2 },
  ownLostShips: { jaeger:30, cruisers:4 }, shards: 3, battlePoints: 12,
  fromPlanet: 'Heimatbasis', debrisPlanet: 'p1', flightTime: 120 };

function backend(){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true, supporter: { active: false, tier: null } });
  if (p === 'reports') return j({ reports: [BERICHT] });
  if (p === 'storage-list') return j({ keys: [] });
  if (p.startsWith('storage/')) return j({ e: 1 }, 404);
  return j([]);
}; }

(async () => {
  const browser = await starteBrowser();
  // Telefonmass: nur hier deckelt max-height:26vh die Tafeln, und nur hier scrollt etwas.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend());
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay'].forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }));
  await page.evaluate(() => { const b = document.querySelector('[data-tab="berichte"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);

  const geklickt = await page.evaluate(() => {
    const box = document.getElementById('reportsBox');
    const btn = box && box.querySelector('[data-watch-battle]');
    if (btn) btn.click();
    return !!btn;
  });
  check('5a: der Leerenriss-Bericht hat einen Zuschauen-Knopf', geklickt === true);
  await page.waitForTimeout(2500);

  const stand = await page.evaluate(() => {
    const wrap = document.getElementById('osWrap');
    const kraftD = document.getElementById('osKraftD');
    const tafelA = document.getElementById('osTafelA');
    const tafelD = document.getElementById('osTafelD');
    const mehr = tafelA && tafelA.querySelector('.tafel-mehr');
    return {
      offen: !!(wrap && wrap.offsetParent !== null),
      kraftD: kraftD ? kraftD.textContent : null,
      tafelD: tafelD ? tafelD.textContent.replace(/\s+/g, ' ') : null,
      scrollt: !!(tafelA && tafelA.scrollHeight > tafelA.clientHeight + 4),
      hinweis: mehr ? mehr.textContent : null,
      kannScrollen: !!(tafelA && tafelA.classList.contains('kann-scrollen'))
    };
  });
  check('5b: die Wiedergabe ist offen', stand.offen === true, stand);
  const prozD = stand.kraftD ? parseInt(stand.kraftD, 10) : NaN;
  check('5c: die Kraftschiene gibt dem Riss echte Prozent (nicht 0)',
    Number.isFinite(prozD) && prozD > 5 && prozD < 95, stand.kraftD);
  check('5d: die Gegner-Tafel bleibt ehrlich (Kraft bekannt, Zusammensetzung nicht)',
    !!stand.tafelD && stand.tafelD.includes('Abwehrkraft') && stand.tafelD.includes('nicht aufgeklärt'),
    stand.tafelD && stand.tafelD.slice(0, 120));
  check('5e: die eigene Tafel scrollt auf dem Telefon wirklich (Messgrundlage der Aufgabe)',
    stand.scrollt === true, stand);
  check('5f: der Scrollhinweis steht mit Zeilenzahl darin',
    stand.kannScrollen === true && !!stand.hinweis && /▾ \d+ weitere/.test(stand.hinweis), stand.hinweis);

  // Ans Listenende scrollen -> der Hinweis verschwindet (Klasse am-ende).
  await page.evaluate(() => { const t = document.getElementById('osTafelA'); if (t) t.scrollTop = t.scrollHeight; });
  await page.waitForTimeout(300);
  const amEnde = await page.evaluate(() => document.getElementById('osTafelA').classList.contains('am-ende'));
  check('5g: am Listenende verschwindet der Hinweis', amEnde === true);

  // Das Protokoll nennt den Riss (Meldung bei Simulationssekunde 6,2 - abwarten).
  await page.waitForTimeout(6000);
  const prot = await page.evaluate(() => (document.getElementById('osProtokoll') || {}).textContent || '');
  check('5h: das Protokoll meldet den Riss statt einer "Gegnerflotte"',
    prot.includes('Der Riss steht im Orbit'), prot.slice(0, 120));
  check('5i: keine JS-Fehler in der Riss-Wiedergabe (leere Gegner-Arrays!)', errs.length === 0, errs.slice(0, 3));

  await ende(async () => { await ctx.close(); await browser.close(); });
})();
