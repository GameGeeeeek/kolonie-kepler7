// Die zweite Reliquienreihe und die Tiefen-Meilensteine (Abgrund C2).
//
//   node tests/test_abgrund_meilensteine.js
//
// ANLASS, gemessen statt behauptet: Das Beute-Konzept nennt die zweite Reliquienreihe "reines
// Schreiben". Das stimmt nicht - die vier Reliquien-Kanaele sind GEDECKELT, und der Splitter-Kanal
// stand mit 0,290 von 0,35 schon vor der Erweiterung bei 83 %. Sechs weitere Reliquien mit den
// Werten der ersten Reihe plus zwei Satz-Stufen haetten ihn auf 0,44 getrieben; neun Prozentpunkte
// waeren still im Deckel verschwunden. Deshalb zahlt die zweite Reihe in STERNENESSENZ - der
// einzigen Waehrung, die Prestige und Aufstieg uebersteht - und traegt nur kleine Prozente.
//
// GEPRUEFT WIRD:
//   1. Die drei parallelen Listen (Namen, Portraits, Reliquien) sind gleich lang und in Reihen
//      geteilt. Sie sind ueber `i % length` gekoppelt: laufen sie auseinander, traegt ein Waechter
//      die Reliquie eines anderen.
//   2. DIE ZENTRALE MESSUNG: kein Kanal reisst seinen Deckel - ausgefuehrt, nicht gelesen.
//   3. Die Meilenstein-Tabelle ist monoton und eindeutig.
//   4. Der Hilfetext nennt DIESELBEN Summen wie die Tabelle (Hausregel 72: eine Aufzaehlung neben
//      der Liste wird sonst still falsch). Er kann sie nicht ableiten - HELP_SECTIONS steht rund
//      2,4 Mio Zeichen VOR der Tabelle, ein Zugriff traefe sie in ihrer temporalen Todeszone
//      (Hausregel 38, gemessen). Also fester Wert hier UND diese Pruefung.
//   5. Verdrahtung: die Marke steht in der Aufstiegs-Bewahrliste, der Nachtrag laeuft beim Laden,
//      und der Bestandserfolg ist auf die ERSTE Reihe gescopt.
//   6. Die WIRKUNG im gerenderten Spiel (Hausregel 61), als PAAR: Ein Konto mit Rekordtiefe 180
//      bekommt beim Laden alle sieben Marken und die gemessene Essenz; ein Konto ohne Tiefe keine.
//      Und ein zweiter Lauf auf demselben Stand zahlt NICHTS nach - sonst waere aus einer
//      einmaligen Belohnung eine wiederholbare geworden.
//
// GEGENPROBEN (alle vier beidseitig gefahren, je mit der Liste dessen, was fallen MUSS, und einer
// WERKZEUGFEHLER-Meldung, falls eine davon gruen bleibt - Hausregel 71). Gemessen, 29 Pruefungen in
// JEDER Richtung bei identischer Pruefliste:
//   * ABGRUND_RELIKT_DECKEL.splitter auf 0.25 -> 2a, Beleg {"gerissen":["splitter"]}.
//   * Die Marke aus abgrundUeberReset entfernen -> 5a, Beleg ist der Rumpf ohne sie.
//   * checkAbgrundMeilensteine an der Ladestelle entfernen -> 5b UND 6a/6b. Die drei zusammen sind
//     der Beleg, dass Quelltext-Verdrahtung und gemessene Wirkung DASSELBE meinen: 6a {"bekommen":0,
//     "erwartet":7}, 6b {"erwarteterZuwachs":58}. 6c bleibt gruen und muss es - es ist der
//     Negativfall, und ohne Nachtrag ist er trivial erfuellt.
//   * Den Erfolg wieder auf die ganze Tabelle -> 5c, Beleg ist die Erfolgs-Zeile.
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const PFAD = path.resolve(process.env.KEPLER_SPIELDATEI || SPIELDATEI);
const FILE = 'file://' + PFAD;
const S = fs.readFileSync(PFAD, 'utf8');

// Bloecke ueber ihre GRENZE schneiden, nie ueber eine geschaetzte Zeichenzahl - ein geratenes
// Fenster ist kein Scope, und der Anker gehoert selbst geprueft (Hausregel 6).
function block(anfang, ende) {
  const a = S.indexOf(anfang);
  if (a < 0) return null;
  const b = S.indexOf(ende, a);
  return b < 0 ? null : S.slice(a, b + ende.length);
}
const bNamen   = block('const ABGRUND_WAECHTER_NAMEN = [', '\n  ];');
const bBilder  = block('const ABGRUND_WAECHTER_BILDER = [', '\n  ];');
const bRelikte = block('const ABGRUND_RELIKTE = [', '\n  ];');
const bDeckel  = block('const ABGRUND_RELIKT_DECKEL = {', '};');
const bSatz    = block('const ABGRUND_RELIKT_SATZ = [', '\n  ];');
const bMeilen  = block('const ABGRUND_TIEFEN_MEILENSTEINE = [', '\n  ];');
check('1-anker: alle sechs Tabellen sind abgegrenzt',
  !!(bNamen && bBilder && bRelikte && bDeckel && bSatz && bMeilen),
  { namen:!!bNamen, bilder:!!bBilder, relikte:!!bRelikte, deckel:!!bDeckel, satz:!!bSatz, meilen:!!bMeilen });

// Jeden Aufbau fassen und als eigene, BENANNTE Pruefung melden, statt den Lauf mittendrin sterben
// zu lassen (Hausregel 34).
let G = null, aufbauFehler = null;
try {
  G = new Function([bNamen, bBilder, bRelikte, bDeckel, bSatz, bMeilen].join('\n')
    + '\nreturn { NAMEN:ABGRUND_WAECHTER_NAMEN, BILDER:ABGRUND_WAECHTER_BILDER, R:ABGRUND_RELIKTE,'
    + ' D:ABGRUND_RELIKT_DECKEL, SA:ABGRUND_RELIKT_SATZ, M:ABGRUND_TIEFEN_MEILENSTEINE };')();
} catch (e) { aufbauFehler = String(e && e.message || e); }
check('1-bau: die Tabellen lassen sich ausfuehren', !!G, { fehler: aufbauFehler });

if (G) {
  // ---- 1) Die drei parallelen Listen ---------------------------------------------------------
  check('1a: Namen, Portraits und Reliquien sind gleich lang',
    G.NAMEN.length === G.BILDER.length && G.R.length === G.NAMEN.length,
    { namen: G.NAMEN.length, bilder: G.BILDER.length, relikte: G.R.length });
  check('1b: jede Reliquie traegt eine Reihe, und es gibt genau zwei',
    G.R.every(r => r.reihe === 1 || r.reihe === 2)
      && G.R.filter(r => r.reihe === 1).length > 0 && G.R.filter(r => r.reihe === 2).length > 0,
    { reihe1: G.R.filter(r => r.reihe === 1).length, reihe2: G.R.filter(r => r.reihe === 2).length,
      ohne: G.R.filter(r => r.reihe !== 1 && r.reihe !== 2).map(r => r.key) });
  check('1c: Schluessel und Namen sind eindeutig',
    new Set(G.R.map(r => r.key)).size === G.R.length && new Set(G.R.map(r => r.name)).size === G.R.length,
    { keys: G.R.length - new Set(G.R.map(r => r.key)).size, namen: G.R.length - new Set(G.R.map(r => r.name)).size });
  // Die erste Reihe steht VORNE - der Index entscheidet, welche Tiefe welches Stueck fallen laesst.
  // Stuende ein Reihe-2-Stueck dazwischen, veraenderte das rueckwirkend die Beute einer Tiefe,
  // die ein Spieler laengst geholt hat.
  check('1d: die erste Reihe steht geschlossen VORNE',
    G.R.findIndex(r => r.reihe === 2) === G.R.filter(r => r.reihe === 1).length,
    { ersterZweiter: G.R.findIndex(r => r.reihe === 2), anzahlErste: G.R.filter(r => r.reihe === 1).length });

  // ---- 2) DIE ZENTRALE MESSUNG: kein Kanal reisst seinen Deckel -------------------------------
  const belegung = {}, gerissen = [];
  for (const k of Object.keys(G.D)) {
    const rel = G.R.filter(x => x.kanal === k).reduce((s, x) => s + x.wert, 0);
    const satz = G.SA.filter(x => x.kanal === k && G.R.length >= x.ab).reduce((s, x) => s + x.wert, 0);
    const summe = rel + satz;
    belegung[k] = { summe: +summe.toFixed(4), deckel: G.D[k], anteil: Math.round(summe / G.D[k] * 100) + '%' };
    if (summe > G.D[k]) gerissen.push(k);
  }
  check('2a: kein Reliquien-Kanal reisst bei vollstaendiger Sammlung seinen Deckel',
    gerissen.length === 0, { gerissen, belegung });
  // Und die Gegenrichtung: Ein Deckel, der so hoch liegt, dass er NIE greifen kann, ist keine
  // Bremse mehr, sondern eine Zahl ohne Wirkung (Hausregel 59). Er muss erreichbar bleiben.
  check('2b: die Deckel bleiben erreichbar (kein Kanal unter 50 % ausgelastet)',
    Object.values(belegung).every(b => b.summe / b.deckel >= 0.5), belegung);
  // Der Splitter-Kanal ist der engste und der Grund fuer die ganze Bauform dieser Etappe.
  check('2c: die zweite Reihe bedient den engsten Kanal (splitter) NICHT',
    G.R.filter(r => r.reihe === 2 && r.kanal === 'splitter').length === 0,
    { reihe2Splitter: G.R.filter(r => r.reihe === 2 && r.kanal === 'splitter').map(r => r.key) });
  // Ihre Werte liegen unter denen der ersten Reihe - die Belohnung sind die Meilensteine.
  // JE KANAL verglichen, nicht global: Die Kanaele haben von Haus aus verschiedene Groessen-
  // ordnungen (beute 0,03-0,05 gegen verlust 0,02-0,035). Ein globaler Vergleich haelte das
  // kleinste beute-Stueck der zweiten Reihe gegen das kleinste verlust-Stueck der ersten und
  // misst damit den Kanal-Unterschied statt der Reihen-Abstufung (Hausregel 21: erst pruefen,
  // ob die Bezugsgroesse ueberhaupt vergleichbar ist).
  const jeKanal = {};
  const reihenVerstoss = [];
  for (const k of Object.keys(G.D)) {
    const eins = G.R.filter(r => r.reihe === 1 && r.kanal === k).map(r => r.wert);
    const zwei = G.R.filter(r => r.reihe === 2 && r.kanal === k).map(r => r.wert);
    if (!eins.length || !zwei.length) continue;
    const maxZwei = Math.max(...zwei), minEins = Math.min(...eins);
    jeKanal[k] = { groesstesZweite: maxZwei, kleinstesErste: minEins };
    if (maxZwei > minEins) reihenVerstoss.push(k);
  }
  check('2d-vorab: es gibt ueberhaupt Kanaele, in denen BEIDE Reihen vertreten sind',
    Object.keys(jeKanal).length >= 2, { verglicheneKanaele: Object.keys(jeKanal) });
  check('2d: je Kanal gibt kein Stueck der zweiten Reihe mehr als das schwaechste der ersten',
    reihenVerstoss.length === 0, { reihenVerstoss, jeKanal });

  // ---- 3) Die Meilenstein-Tabelle ------------------------------------------------------------
  check('3a: die Tiefen steigen und sind eindeutig',
    G.M.every((m, i) => i === 0 || m.tiefe > G.M[i-1].tiefe) && new Set(G.M.map(m => m.key)).size === G.M.length,
    { tiefen: G.M.map(m => m.tiefe) });
  check('3b: Essenz und Kredite steigen monoton mit der Tiefe',
    G.M.every((m, i) => i === 0 || (m.essence >= G.M[i-1].essence && m.credits >= G.M[i-1].credits)),
    { essenz: G.M.map(m => m.essence), kredite: G.M.map(m => m.credits) });
  // Der letzte Meilenstein muss die vollstaendige Sammlung abdecken, sonst endet die Belohnung
  // vor dem Inhalt, den diese Etappe hinzufuegt.
  check('3c: der letzte Meilenstein reicht bis zur letzten Reliquie',
    G.M[G.M.length-1].tiefe >= G.R.length * 10,
    { letzterMeilenstein: G.M[G.M.length-1].tiefe, letzteReliquie: G.R.length * 10 });
  check('3d: jeder Meilenstein nennt Name und Beschreibung',
    G.M.every(m => m.name && m.desc && m.desc.length >= 30),
    { zuKurz: G.M.filter(m => !m.name || !m.desc || m.desc.length < 30).map(m => m.key) });

  // ---- 4) Der Hilfetext nennt DIESELBEN Summen (Hausregel 72) ---------------------------------
  const essenzSumme = G.M.reduce((s, m) => s + m.essence, 0);
  const krediteSumme = G.M.reduce((s, m) => s + m.credits, 0);
  const hilfeAb = S.indexOf('Reliquien – was ein Wächter zurücklässt');
  const hilfe = hilfeAb < 0 ? '' : S.slice(hilfeAb, hilfeAb + 5000);
  check('4-anker: der Hilfe-Abschnitt ist gefunden', hilfeAb >= 0, { index: hilfeAb });
  check('4a: der Hilfetext nennt die gemessene Essenz-Summe',
    hilfe.includes(String(essenzSumme) + ' Sternenessenz'),
    { erwartet: essenzSumme + ' Sternenessenz' });
  const kredText = krediteSumme.toLocaleString('de-DE');
  check('4b: der Hilfetext nennt die gemessene Kredit-Summe',
    hilfe.includes(kredText), { erwartet: kredText });
  check('4c: der Hilfetext nennt die Zahl der Meilensteine',
    /sieben|acht|neun|sechs/.test(hilfe) && hilfe.includes(G.M.map(m => m.tiefe).join(', ').replace(/, ([0-9]+)$/, ' und $1')),
    { erwarteteTiefen: G.M.map(m => m.tiefe).join(', ').replace(/, ([0-9]+)$/, ' und $1') });
}

// ---- 5) Verdrahtung -------------------------------------------------------------------------
const bReset = block('function abgrundUeberReset(alles){', '\n  }');
check('5-anker: abgrundUeberReset ist abgegrenzt', !!bReset);
check('5a: die Meilenstein-Marke steht in der Aufstiegs-Bewahrliste',
  !!bReset && /meilensteine:\s*a\.meilensteine/.test(bReset),
  { rumpf: bReset ? bReset.slice(0, 240) : null });
check('5b: der Nachtrag laeuft an der Ladestelle',
  /if \(checkAbgrundMeilensteine\(\) > 0\) save\(\);/.test(S));
// Der Bestandserfolg MUSS auf die erste Reihe gescopt sein - sonst springt das Ziel eines
// Spielers, der bei 11 von 12 steht, still auf 18 (eine Erweiterung darf keinen fast erreichten
// Fortschritt zurueckwerfen).
const erfolgZeile = S.split('\n').find(z => z.includes("key:'abgrundkabinett'"));
check('5c: der Bestandserfolg zaehlt nur die ERSTE Reihe',
  !!erfolgZeile && /r\.reihe === 1/.test(erfolgZeile), { zeile: erfolgZeile ? erfolgZeile.slice(0, 200) : null });
check('5d: fuer die vollstaendige Sammlung gibt es einen eigenen, zweiten Erfolg',
  S.includes("key:'abgrundkabinett2'"));

// ---- 6) Die WIRKUNG im gerenderten Spiel ----------------------------------------------------
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
function speicher(best, marken) {
  const t = Date.now();
  return JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    seenTabHints: { basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
      galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1 },
    resources: { energie: 400000, erz: 380000, kristalle: 260000, deuterium: 150000, antimaterie: 19000, forschungspunkte: 31000 },
    buildings: { solar: 20, mine: 19, raffinerie: 15, synth: 13, labor: 12, werft: 12, hangar: 8, lager: 12 },
    research: {}, fleet: { jaeger: 400, missions: [] }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A', allianceTag: '', avatarKey: null },
    credits: 1000, xp: 64000, buffs: [], lastTick: t,
    ascension: { count: 0, essence: 100, tree: { prod:0, speed:0, combat:0, start:0, expedition:0, leere:0, grenzen:0 } },
    abgrund: { best: best, tiefe: best + 1, splitter: 0, bergung: 0, relikte: {}, meilensteine: marken || {} },
    nextPlanetEventCheck: t + 3600000, nextTraderCheck: t + 3600000
  });
}
async function messen(browser, best, marken) {
  const store = { 'kepler7-save-v3': speicher(best, marken) };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE);
  // Der Nachtrag laeuft an der Ladestelle und schreibt ueber save() in den Mock-Speicher.
  await page.waitForTimeout(3200);
  await ctx.close();
  let g = null;
  try { g = JSON.parse(store['kepler7-save-v3']); } catch (e) {}
  return {
    essenz: g && g.ascension ? g.ascension.essence : null,
    marken: g && g.abgrund && g.abgrund.meilensteine ? Object.keys(g.abgrund.meilensteine).length : null,
    bootfehler: fehler.slice(0, 2)
  };
}

(async () => {
  let browser = null;
  try {
    browser = await starteBrowser();
    const tief = await messen(browser, 180, null);
    const flach = await messen(browser, 0, null);
    check('6-vorab: beide Laeufe haben einen lesbaren Spielstand geschrieben',
      tief.essenz !== null && flach.essenz !== null,
      { tief: tief.essenz, flach: flach.essenz, fehlerTief: tief.bootfehler, fehlerFlach: flach.bootfehler });
    const erwartet = G ? G.M.reduce((s, m) => s + m.essence, 0) : 0;
    check('6a: ein Konto mit Rekordtiefe 180 bekommt ALLE Marken',
      G && tief.marken === G.M.length, { bekommen: tief.marken, erwartet: G ? G.M.length : '?' });
    check('6b: und genau die gemessene Essenz dazu',
      tief.essenz === 100 + erwartet, { vorher: 100, nachher: tief.essenz, erwarteterZuwachs: erwartet });
    // Das PAAR: ohne Tiefe passiert nichts. Ohne diese Haelfte waere auch eine Fassung gruen, die
    // die Essenz bedingungslos auszahlt.
    check('6c: ein Konto ohne Rekordtiefe bekommt KEINE Marke und keine Essenz',
      flach.marken === 0 && flach.essenz === 100, { marken: flach.marken, essenz: flach.essenz });
    // Und die Invariante: ein zweiter Lauf auf demselben Stand zahlt nichts nach.
    const alleMarken = {};
    if (G) for (const m of G.M) alleMarken[m.key] = true;
    const nochmal = await messen(browser, 180, alleMarken);
    check('6d: ein zweiter Lauf zahlt NICHTS nach (die Marke bremst)',
      nochmal.essenz === 100, { essenz: nochmal.essenz, marken: nochmal.marken });
  } catch (e) {
    check('6-bau: der Browser-Abschnitt laeuft', false, { fehler: String(e && e.message || e) });
  } finally {
    if (browser) await browser.close();
  }
  ende();
})();
