// Sektor-Eigenschaften (Etappe 3, 18.08.2026): Die acht Regionen der Karte trugen bis dahin nur
// Farbe, Namen und eine Beschreibung. `sektorVon` wurde AUSSCHLIESSLICH zum Zeichnen benutzt - der
// Sektor eines Planeten hatte auf nichts im Spiel eine Auswirkung, waehrend die Beschreibungen seit
// jeher welche versprachen ("ergiebige Guertelbahnen", "reich an Anomalien", "voller Passagen").
// Seither traegt jeder Sektor ausser dem Kepler-Kern ein `mod`-Feld, das in eine vorhandene,
// gedeckelte Gruppe einzahlt.
//
// WAS DIESER TEST BEWACHT - und warum genau das:
//
//  1. Die WIRKUNGSKETTE, nicht die Tabelle. Der teuerste Fehler dieser Familie ist ein
//     Konstantenfeld, das nur der Anzeigetext liest (Backend-CLAUDE.md: "st.proto war eine Zahl,
//     die nur die ANKUENDIGUNG las"). Abschnitt 1e prueft deshalb DATENGETRIEBEN: Fuer jeden Kanal,
//     der in irgendeinem `mod` vorkommt, muss es eine Rechenstelle geben. Ein neuer Kanal ohne
//     Verdrahtung faellt damit auf, ohne dass jemand an ihn gedacht haben muss (Hausregel 40).
//  2. Die zweite ANZEIGESTELLE. Ein Bonus, den nur der Quelltext kennt, gibt es fuer den Spieler
//     nicht (Hausregel 6/55). Abschnitt 3 misst das GERENDERTE Spiel und vergleicht jede Region
//     gegen die geparste Tabelle - nicht gegen eingetippte Zahlen.
//  3. Dass die Mechanik BEISST. Abschnitt 4 misst die angezeigte Erzrate zweimal mit demselben
//     Spielstand und nur unterschiedlichem Heimatsystem. Ein Aufruf im Quelltext ist noch keine
//     Wirkung.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   gruen: node tests/test_sektoreigenschaften.js
//   rot:   git show HEAD:weltraum_kolonie.html > /tmp/alt.html
//          KEPLER_SPIELDATEI=/tmp/alt.html node tests/test_sektoreigenschaften.js
//   GEMESSEN am alten Stand: 22 Pruefungen gelaufen, 15 rot (1a, 1c, 1e2, 1g, 2-anker, 3a-3g,
//   4-tabelle, 4-vorab). Der gruene Lauf hat 28 - die sechs fehlenden sind GENAU die, die Funktionen
//   messen, die es dort nicht gibt (2-bau, 2a-2d) plus 4a, das ohne Bonus-Sektor nichts zu messen
//   hat; `2-anker` benennt sie namentlich. Diese Verrechnung gehoert zur Gegenprobe (Hausregel 34):
//   Fehlen Pruefungen unerklaert, ist sie unvollstaendig, egal wie rot sie aussieht.
//   Vacuous-gruen bleiben dort 1b/1d/1e/1f/3-vorab - sie bewachen Eigenschaften der NEUEN Daten und
//   haben ohne diese Daten nichts zu sagen; das ist gewollt, nicht uebersehen.
//   EINE Variable genuegt: SPIEL_URL in tests/lib/umgebung.js leitet sich selbst aus
//   KEPLER_SPIELDATEI ab, Quelltext-Lesen und Browser-Boot messen also denselben Stand. Dass die
//   Umleitung GRIFF, belegt der Lauf an den verschobenen Anker-Indizes (CLAUDE.md, Korrektur
//   15.08.2026: eine still ignorierte Env-Variable sieht aus wie eine bestandene Gegenprobe).
//
// Abschnitt 2 fuehrt die Helfer AUS statt sie zu lesen (Hausregel 43) und schneidet dafuer ihre
// echten Abhaengigkeiten mit (Hausregel 36: nie durch etwas Aehnliches ersetzen) - SEKTOR_DEFS,
// sektorVon, STAR_SYSTEMS, PLANETS kommen alle aus der Spieldatei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;
const S = fs.readFileSync(SPIELDATEI, 'utf8');

// Ein Slice mit indexOf-Endanker prueft ZUERST, dass der Anker existiert (Hausregel 6) - sonst
// laeuft er bis zum Dateiende und jede Aussage darueber wird vacuous.
function block(startAnker, endAnker) {
  const a = S.indexOf(startAnker);
  if (a < 0) return null;
  const b = S.indexOf(endAnker, a);
  if (b <= a) return null;
  return S.slice(a, b + endAnker.length);
}
// Der geschnittene Block endet auf "];" - das abschliessende Semikolon muss WEG, sonst ist
// "([...];)" ein Syntaxfehler und die Auswertung liefert stumm null. Genau daran ist der erste
// Anlauf gescheitert, und weil der Fehler verschluckt wurde, sah es nach einem Anker-Problem aus.
let auswertFehler = null;
function auswerten(quelle, praefix) {
  if (!quelle) return null;
  try { return eval('(' + quelle.replace(praefix, '').trim().replace(/;$/, '') + ')'); }
  catch (e) { auswertFehler = String(e); return null; }
}

const defsQuelle = block('const SEKTOR_DEFS = [', '\n  ];');
const sysQuelle = block('const STAR_SYSTEMS = [', '\n  ];');
const planQuelle = block('const PLANETS = [', '\n  ];');
check('0-anker: SEKTOR_DEFS, STAR_SYSTEMS und PLANETS lassen sich aus der Datei schneiden',
  !!defsQuelle && !!sysQuelle && !!planQuelle,
  { sektoren: !!defsQuelle, systeme: !!sysQuelle, planeten: !!planQuelle });

const DEFS = auswerten(defsQuelle, 'const SEKTOR_DEFS = ');
const SYSTEME = auswerten(sysQuelle, 'const STAR_SYSTEMS = ');
check('0-bau: die drei Bloecke lassen sich auswerten',
  Array.isArray(DEFS) && DEFS.length >= 8 && Array.isArray(SYSTEME) && SYSTEME.length > 20,
  { sektoren: DEFS && DEFS.length, systeme: SYSTEME && SYSTEME.length, fehler: auswertFehler });

// Sektor eines Systems - dieselbe Rechnung wie sektorVon, aber hier bewusst nachgebaut, weil sie
// als AUSWAHLHILFE fuer die Fixtures dient und nicht als geprueftes Verhalten (das prueft 2c/2d
// mit der echten, geschnittenen Funktion).
function sektorFuer(sy) {
  let best = DEFS[0], bd = Infinity;
  for (const sk of DEFS) {
    const d = (sy.gx - sk.cx) * (sy.gx - sk.cx) + (sy.gy - sk.cy) * (sy.gy - sk.cy);
    if (d < bd) { bd = d; best = sk; }
  }
  return best;
}

// ================================================================================================
// 1) Die Tabelle und ihre Verdrahtung (Quelltext)
// ================================================================================================
if (DEFS) {
  const KANAELE = auswerten(block('const SEKTOR_KANAL_TEXT = {', '\n  };'), 'const SEKTOR_KANAL_TEXT = ');
  const bekannt = KANAELE ? Object.keys(KANAELE) : [];
  const unbekannt = DEFS.filter(sk => sk.mod).flatMap(sk => Object.keys(sk.mod).filter(k => !bekannt.includes(k)));
  check('1a-anzeige: jeder in `mod` benutzte Kanal hat einen Anzeigetext in SEKTOR_KANAL_TEXT',
    !!KANAELE && unbekannt.length === 0, { bekannt, unbekannt });

  // Nur Boni: Die Wirkung greift rueckwirkend fuer jede bestehende Kolonie; wer vorher dort
  // gesiedelt hat, darf dafuer nicht bestraft werden.
  const negativ = DEFS.filter(sk => sk.mod)
    .flatMap(sk => Object.entries(sk.mod).filter(e => !(e[1] > 0)).map(e => sk.key + '.' + e[0] + '=' + e[1]));
  check('1b-nurboni: kein Sektor traegt einen Malus oder eine Null', negativ.length === 0, { negativ });

  const neutral = DEFS.filter(sk => !sk.mod).map(sk => sk.key);
  const mitMod = DEFS.filter(sk => sk.mod).map(sk => sk.key);
  check('1c-neutral: der Kepler-Kern ist der EINZIGE Sektor ohne Eigenart, alle uebrigen tragen eine',
    neutral.length === 1 && neutral[0] === 'kepler' && mitMod.length === DEFS.length - 1,
    { neutral, mitMod });

  // Regel 2 des Entwurfs: Jede Wirkung loest den Text ein, der schon dastand. Geprueft wird die
  // REGEL ("die Beschreibung nennt ihre Zahl"), nicht eine Formulierung (Hausregel 3).
  const stumm = DEFS.filter(sk => sk.mod)
    .filter(sk => !Object.values(sk.mod).every(w => new RegExp('\\b' + Math.round(w * 100) + '\\s?%').test(sk.desc || '')))
    .map(sk => sk.key);
  check('1d-text: jede Sektor-Beschreibung nennt die Prozentzahl ihrer eigenen Eigenart',
    stumm.length === 0, { stumm, beispiel: stumm.length ? (DEFS.find(sk => sk.key === stumm[0]) || {}).desc : null });

  // ---- 1e: der Wirkungs-Waechter (siehe Kopfkommentar) ----------------------------------------
  // Fuer jeden benutzten Kanal muss es eine RECHENSTELLE geben. `flug` laeuft ueber den Faktor
  // sektorFlugMult, alle uebrigen als Summand ueber sektorBonus(..., '<kanal>').
  const benutzt = Array.from(new Set(DEFS.filter(sk => sk.mod).flatMap(sk => Object.keys(sk.mod))));
  const ohneWirkung = benutzt.filter(k => k === 'flug'
    ? !/sektorFlugMult\(\s*\w/.test(S)
    : !new RegExp("sektorBonus\\([^)]*'" + k + "'\\)").test(S));
  check('1e-wirkung: jeder benutzte Kanal hat eine Rechenstelle (kein Feld, das nur der Text liest)',
    ohneWirkung.length === 0, { benutzt, ohneWirkung });

  // Gegenrichtung (Hausregel 33): Ein Aufruf fuer einen Kanal, den keine Tabelle mehr fuehrt, ist
  // genauso ein Befund - er liest dauerhaft 0 und sieht im Quelltext nach Wirkung aus.
  const gerufen = Array.from(new Set((S.match(/sektorBonus\([^)]*'(\w+)'\)/g) || [])
    .map(m => m.replace(/^[\s\S]*'(\w+)'\)$/, '$1'))));
  check('1e2-gegenrichtung: es wird kein Kanal abgefragt, den keine Sektor-Tabelle mehr fuehrt',
    gerufen.length > 0 && gerufen.every(k => benutzt.includes(k)), { gerufen, benutzt });

  // ---- 1f: additiv, nie als eigene Multiplikation ---------------------------------------------
  // Hausregel des Projekts: kleine, stapelnde Boni gehoeren in die vorhandene gedeckelte Gruppe.
  // Die Flugzeit ist die begruendete Ausnahme und laeuft ueber die eigene Funktion sektorFlugMult.
  const alsFaktor = (S.match(/.{0,70}\*=?\s*sektorBonus\([^)]*\)/g) || [])
    .concat(S.match(/sektorBonus\([^)]*\)\s*\*[^=]/g) || []);
  check('1f-additiv: sektorBonus wird nirgends als eigener Faktor multipliziert',
    alsFaktor.length === 0, { treffer: alsFaktor.slice(0, 3) });

  // ---- 1g: der Produktionsbonus haengt am ROHSTOFF-Zweig, nicht am Laborzweig -------------------
  const laborAb = S.indexOf('if (b.labor > 0){');
  const rohstoff = block("mineMult *= (1 + moduleBonusAt(planet, 'prod')", 'if (b.labor > 0){');
  check('1g-rohstoffe: der Produktionsbonus steht im Rohstoffzweig und der Laborzweig bleibt frei',
    !!rohstoff && /sektorBonus\(planet,\s*'prod'\)/.test(rohstoff)
      && laborAb > 0 && !/sektorBonus/.test(S.slice(laborAb, laborAb + 2000)),
    { rohstoffzweig: !!rohstoff, laborAnker: laborAb > 0 });
}

// ================================================================================================
// 2) Die Helfer ausgefuehrt (Hausregel 43: "der Code sieht gleich aus" ist kein Beleg)
// ================================================================================================
(function abschnitt2() {
  const teile = [
    ['STAR_SYSTEMS', sysQuelle],
    ['PLANETS', planQuelle],
    ['SEKTOR_DEFS', defsQuelle],
    ['sektorVon', block('function sektorVon(sy){', '\n  }')],
    ['SEKTOR_KANAL_TEXT', block('const SEKTOR_KANAL_TEXT = {', '\n  };')],
    ['sektorEffektTeile', block('function sektorEffektTeile(sk){', '\n  }')],
    ['sektorEffektKurz', block('function sektorEffektKurz(sk){', '\n  }')],
    ['sektorEffektLang', block('function sektorEffektLang(sk){', '\n  }')],
    ['sektorVonSystemId', block('function sektorVonSystemId(sysId){', '\n  }')],
    ['sektorVonPlanet', block('function sektorVonPlanet(planetKey){', '\n  }')],
    ['sektorBonus', block('function sektorBonus(planetKey, kanal){', '\n  }')],
    ['sektorFlugMult', block('function sektorFlugMult(sysId){', '\n  }')],
    ['isMoonKey', block('function isMoonKey(key){', '\n')],
    ['moonParentKey', block('function moonParentKey(key){', '\n')]
  ];
  const fehlend = teile.filter(t => !t[1]).map(t => t[0]);
  check('2-anker: alle geprueften Bloecke lassen sich aus der Datei schneiden', fehlend.length === 0, { fehlend });
  if (fehlend.length || !DEFS || !SYSTEME) return;

  // Ein Bau-Fehler wird als EIGENE Pruefung gemeldet, statt den Testlauf zu beenden - sonst laufen
  // die uebrigen Pruefungen dieses Abschnitts nie und ein roter Exit sieht aus wie eine gelungene
  // Gegenprobe (Hausregel 34).
  let API = null, fehler = null;
  try {
    const quelle = teile.map(t => t[1]).join('\n')
      + '\nconst _sektorCache = new Map();'
      + '\nreturn { sektorEffektKurz: sektorEffektKurz, sektorEffektLang: sektorEffektLang,'
      + ' sektorBonus: sektorBonus, sektorFlugMult: sektorFlugMult };';
    API = new Function('myHomeSystem', quelle)('kepler');
  } catch (e) { fehler = String(e); }
  check('2-bau: die geschnittenen Bloecke lassen sich ausfuehren', !!API, { fehler });
  if (!API) return;

  const k = mod => ({ key: 'x', name: 'X', mod: mod, desc: '' });
  const kurzProd = API.sektorEffektKurz(k({ prod: 0.08 }));
  const kurzFlug = API.sektorEffektKurz(k({ flug: 0.10 }));
  check('2a-vorzeichen: ein Produktionsbonus wird mit +, ein Flugzeit-Bonus mit MINUS angezeigt',
    kurzProd === '+8% Produktion' && kurzFlug === '−10% Flugzeit', { prod: kurzProd, flug: kurzFlug });

  check('2b-neutral: ein Sektor ohne mod meldet "ohne Eigenart" statt einer leeren Zeile',
    /ohne Eigenart/i.test(API.sektorEffektKurz(k(null))) && /Grundwert/.test(API.sektorEffektLang(k(null))),
    { kurz: API.sektorEffektKurz(k(null)), lang: API.sektorEffektLang(k(null)) });

  // Der Mond-Zwischenschritt: "moon_<planet>" steht in PLANETS gar nicht und erbt das System
  // seines Planeten. Ohne diesen Schritt bekaeme jeder Mond des Spiels den Bonus 0.
  const PLANETEN = auswerten(planQuelle, 'const PLANETS = ');
  const prodSekt = DEFS.find(sk => sk.mod && sk.mod.prod);
  const sysDrin = SYSTEME.filter(sy => sektorFuer(sy).key === prodSekt.key).map(sy => sy.id);
  const pl = PLANETEN && PLANETEN.find(x => sysDrin.indexOf(x.system) >= 0);
  const bonusPlanet = pl ? API.sektorBonus(pl.id, 'prod') : null;
  const bonusMond = pl ? API.sektorBonus('moon_' + pl.id, 'prod') : null;
  check('2c-mond: ein Mond erbt den Sektor seines Planeten (sonst bekaeme jeder Mond den Bonus 0)',
    !!pl && bonusPlanet > 0 && bonusMond === bonusPlanet,
    { planet: pl && pl.id, sektor: prodSekt.key, planetBonus: bonusPlanet, mondBonus: bonusMond });

  // Flugzeit: ein Ziel im Bonus-Sektor ist SCHNELLER (Faktor < 1), ein unbekanntes Ziel bleibt
  // unberuehrt (Faktor exakt 1) - sonst braechen Missionsarten ohne echtes Zielsystem.
  const flugSekt = DEFS.find(sk => sk.mod && sk.mod.flug);
  const zielSys = SYSTEME.find(sy => sektorFuer(sy).key === flugSekt.key);
  check('2d-flugzeit: ein Ziel im Flugzeit-Sektor ist schneller, ein unbekanntes Ziel bleibt unberuehrt',
    !!zielSys && Math.abs(API.sektorFlugMult(zielSys.id) - (1 - flugSekt.mod.flug)) < 1e-9
      && API.sektorFlugMult(null) === 1 && API.sektorFlugMult('gibtesnicht') === 1,
    { ziel: zielSys && zielSys.id, faktor: zielSys && API.sektorFlugMult(zielSys.id),
      ohneZiel: API.sektorFlugMult(null), unbekannt: API.sektorFlugMult('gibtesnicht') });
})();

// ================================================================================================
// 3+4) Das gerenderte Spiel
// ================================================================================================
const NOW = Date.now();
const SAVE = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  // Bewusst fast leeres Lager: Ein volles Lager misst den DECKEL statt der Produktion (Hausregel 7 -
  // genau darauf ist der erste Anlauf hereingefallen, die Anzeige stand auf "+0/s (Lager voll)").
  resources: { energie: 480000, erz: 100, kristalle: 100, deuterium: 100, antimaterie: 10, forschungspunkte: 100 },
  buildings: { solar: 40, mine: 17, kristallmine: 15, labor: 10, lager: 20, werft: 9 },
  research: {}, fleet: { jaeger: 100, ships: 3, missions: [] },
  discovered: {}, colonies: {}, activeBasePlanet: 'home',
  player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: NOW,
  // Beide Ereignis-Uhren gepinnt: Ein Planeten-Ereignis multipliziert die Produktion und wuerde die
  // Bezugsgroesse mitten in der Messung verschieben (Hausregel 20/21).
  nextPlanetEventCheck: NOW + 3600000, nextTraderCheck: NOW + 3600000
});

function backend(store, heim) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s) => r.fulfill({ status: s || 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: heim, homeSlot: 0, attackShieldMs: 0 });
    if (p === 'galaxy') return j({ npcEmpireStrength: 1, marketTrend: 1, unlockedAlienRaces: [],
      collapsedSystems: {}, activeWormhole: null, news: [], controlledSystems: {}, factions: {} });
    if (p.indexOf('storage/') === 0) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    return j({});
  };
}

async function seite(browser, heim) {
  const store = { 'kepler7-save-v3': SAVE };
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await page.route('**/api/**', backend(store, heim));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
      'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });
  return { ctx: ctx, page: page, fehler: fehler };
}

// Die Erzrate, wie der SPIELER sie sieht (.rescard .rate) - nicht aus einer nachgebauten Formel.
function erzRate(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.rescard[data-res="erz"] .rate');
    if (!el) return null;
    const t = (el.textContent || '').trim();
    const m = t.match(/\+([\d.,]+)\s*\/s/);
    return { roh: t, zahl: m ? parseFloat(m[1].replace(',', '.')) : null };
  });
}

(async () => {
  const browser = await starteBrowser();
  let auf = null;
  try {
    // ---- 3) Anzeigestellen ---------------------------------------------------------------------
    auf = await seite(browser, 'kepler');
    const page = auf.page;
    check('3-vorab: Boot ohne Skriptfehler (der Hilfe-Eintrag leitet aus SEKTOR_DEFS ab - eine zu'
      + ' frueh gelesene Konstante wuerfe hier den ReferenceError, den `node --check` nie sieht)',
      auf.fehler.length === 0, auf.fehler.slice(0, 3));

    await page.evaluate(() => { document.querySelector('.tab-btn[data-tab="karte"]').click(); });
    await page.waitForTimeout(1500);

    const ueb = await page.evaluate(() => Array.prototype.map.call(
      document.querySelectorAll('#galaxyMapSvg [data-sektor]'), g => ({
        key: g.getAttribute('data-sektor'),
        eigenart: g.getAttribute('data-sektor-eigenart') || '',
        aria: g.getAttribute('aria-label') || '',
        title: (g.querySelector('title') || {}).textContent || '',
        sichtbar: Array.prototype.map.call(g.querySelectorAll('text'), t => t.textContent).join(' | ')
      })));

    // Parity gegen die GEPARSTE Tabelle - nie gegen eingetippte Zahlen (Hausregel 2).
    const sollFuer = key => {
      const sk = (DEFS || []).find(x => x.key === key);
      if (!sk) return null;
      return sk.mod ? Object.keys(sk.mod).map(kn => (kn === 'flug' ? '−' : '+') + Math.round(sk.mod[kn] * 100) + '%') : null;
    };
    const abweichung = ueb.filter(r => {
      const soll = sollFuer(r.key);
      return soll === null ? !/ohne Eigenart/i.test(r.eigenart)
        : !soll.every(t => r.eigenart.indexOf(t) >= 0);
    }).map(r => ({ key: r.key, gezeigt: r.eigenart, erwartet: sollFuer(r.key) }));

    check('3a-uebersicht: jede Region zeigt ihre Eigenart, und zwar die aus SEKTOR_DEFS',
      ueb.length === (DEFS || []).length && abweichung.length === 0,
      { regionen: ueb.length, erwartet: (DEFS || []).length, abweichung });

    // `indexOf('')` liefert immer 0 - ohne die Leer-Pruefung waere diese Zeile am alten Stand
    // gruen gewesen, obwohl gar keine Eigenart existierte (Hausregel 28).
    check('3b-sichtbar: die Eigenart steht als eigene, NICHT LEERE Textzeile am Knoten',
      ueb.length > 0 && ueb.every(r => r.eigenart.length > 3 && r.sichtbar.indexOf(r.eigenart) >= 0),
      { beispiel: ueb[0], leer: ueb.filter(r => r.eigenart.length <= 3).map(r => r.key) });

    check('3c-tooltip: Tooltip und aria-label tragen die ausfuehrliche Fassung',
      ueb.length > 0 && ueb.every(r => {
        const marke = r.key === 'kepler' ? 'Grundwert' : '%';
        return r.title.indexOf(marke) >= 0 && r.aria.indexOf(marke) >= 0;
      }), { beispiel: ueb.find(r => r.key !== 'kepler'), neutral: ueb.find(r => r.key === 'kepler') });

    // Sektoransicht: dieselbe Aussage eine Ebene tiefer.
    // Ohne Bonus-Sektor (alter Stand) auf den ersten ausweichen, damit der Rest des Tests laeuft -
    // eine Gegenprobe, die mitten drin abstuerzt, hat ihre uebrigen Pruefungen nie gefahren
    // (Hausregel 34), und der rote Exit verdeckt genau das.
    const bonusSekt = (DEFS || []).filter(sk => sk.mod)[0] || (DEFS || [])[0];
    const bonusKey = bonusSekt.key;
    await page.evaluate(kk => {
      const g = document.querySelector('#galaxyMapSvg [data-sektor="' + kk + '"]');
      if (g) g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, bonusKey);
    await page.waitForTimeout(900);
    const sek = await page.evaluate(() => {
      const t = document.querySelector('#galaxyMapSvg [data-kb-eigenart]');
      if (!t) return null;
      // Der Tooltip ist ein <title>-KIND und steckt mit in textContent. Gemessen wird die GEMALTE
      // Zeile, also der Rest (Hausregel 51: ein Selektor darf nicht das Hilfskonstrukt greifen).
      const tip = (t.querySelector('title') || {}).textContent || '';
      return { key: t.getAttribute('data-kb-eigenart'), gemalt: (t.textContent || '').replace(tip, '').trim(), tip: tip };
    });
    check('3d-sektoransicht: die Kopfzeile der Sektoransicht nennt die Eigenart ebenfalls',
      !!sek && sek.key === bonusKey && /%/.test(sek.gemalt) && /%/.test(sek.tip), sek);

    // Hilfe: der Eintrag ist ABGELEITET, also muss er alle Sektoren namentlich nennen.
    await page.evaluate(() => { const b = document.getElementById('headerHelpBtn'); if (b) b.click(); });
    await page.waitForTimeout(700);
    const hilfe = await page.evaluate(() => {
      const kat = document.querySelector('[data-help-cat="galaxie"]');
      if (kat) kat.click();
      const e = Array.prototype.slice.call(document.querySelectorAll('.help-entry'))
        .find(x => /Sektoren haben Eigenschaften/.test(x.innerText || ''));
      return e ? (e.innerText || '') : null;
    });
    const fehltImText = (DEFS || []).filter(sk => !hilfe || hilfe.indexOf(sk.name) < 0).map(sk => sk.key);
    check('3e-hilfe: der Hilfe-Eintrag nennt JEDEN Sektor namentlich (aus SEKTOR_DEFS abgeleitet)',
      !!hilfe && fehltImText.length === 0 && /rückwirkend/i.test(hilfe),
      { gefunden: !!hilfe, fehltImText, auszug: hilfe && hilfe.slice(0, 200) });

    // ---- 3f: die Eigenart steht auch am EIGENEN Standort, nicht nur auf der Karte -------------
    // Wer wissen will, was seine Kolonie bringt, sieht im Kolonien-Reiter nach, nicht auf der Karte.
    await page.evaluate(() => { document.querySelector('.tab-btn[data-tab="basis"]').click(); });
    await page.waitForTimeout(1400);
    const standort = await page.evaluate(() => {
      const b = document.getElementById('planetRoleBox');
      return b ? (b.innerText || '').slice(0, 400) : null;
    });
    const heimSektor = (DEFS || []).find(sk => sk.key === 'kepler');
    check('3f-standort: der Basis-Reiter nennt den Sektor des aktuellen Standorts samt Wirkung',
      !!standort && heimSektor && standort.indexOf(heimSektor.name) >= 0
        && /ohne Eigenart|Grundwert/i.test(standort),
      { auszug: standort });

    // Die Gegenrichtung, und sie ist die eigentliche Aussage: Im NEUTRALEN Heimatsektor waere die
    // Zeile auch dann noch plausibel, wenn sie gar keinen Bonus zeigen koennte. Also derselbe
    // Standort-Blick aus einem Bonus-Sektor heraus.
    const bonusProd = (DEFS || []).find(sk => sk.mod && sk.mod.prod);
    const bonusHeim = bonusProd ? SYSTEME.find(sy => sektorFuer(sy).key === bonusProd.key) : null;
    let standortBonus = null;
    if (bonusHeim) {
      const zw = await seite(browser, bonusHeim.id);
      standortBonus = await zw.page.evaluate(() => {
        const b = document.getElementById('planetRoleBox');
        return b ? (b.innerText || '').slice(0, 300) : null;
      });
      await zw.ctx.close();
    }
    check('3f2-standort-bonus: aus einem Bonus-Sektor heraus nennt dieselbe Zeile Namen UND Prozentzahl',
      !!standortBonus && standortBonus.indexOf(bonusProd.name) >= 0
        && standortBonus.indexOf('+' + Math.round(bonusProd.mod.prod * 100) + '%') >= 0,
      { sektor: bonusProd && bonusProd.key, system: bonusHeim && bonusHeim.id, auszug: standortBonus });

    // Der Mond-Zweig derselben Box muss die Zeile ebenfalls tragen - ein Mond erbt den Sektor
    // seines Planeten und bekommt den Bonus WIRKLICH (2c misst das). Stuende die Zeile nur im
    // Planeten-Zweig, waere sie die Anzeigestelle, die auf dem Mond schweigt (Hausregel 6).
    // Geprueft am Quelltext, weil ein Mond-Fixture den ganzen Kolonie-Aufbau braeuchte: Die
    // Zeile muss VOR der isMoonKey-Verzweigung gebildet und in BEIDEN Zweigen ausgegeben werden.
    const boxBlock = block("const roleBox = document.getElementById('planetRoleBox');",
      "roleBox.querySelectorAll('[data-set-planet-role]')");
    const vorVerzweigung = boxBlock && boxBlock.indexOf('const sektorZeile') >= 0
      && boxBlock.indexOf('const sektorZeile') < boxBlock.indexOf('if (isMoonKey(');
    check('3g-mondzweig: die Standort-Zeile wird VOR der Mond-Verzweigung gebildet und in BEIDEN Zweigen ausgegeben',
      !!boxBlock && vorVerzweigung && (boxBlock.match(/sektorZeile \+/g) || []).length === 2,
      { anker: !!boxBlock, vorVerzweigung, ausgaben: boxBlock ? (boxBlock.match(/sektorZeile \+/g) || []).length : 0 });

    await auf.ctx.close(); auf = null;

    // ---- 4) Die Mechanik beisst ----------------------------------------------------------------
    // Gemessen wird das VERHAELTNIS zweier Laeufe mit identischem Spielstand und nur
    // unterschiedlichem Heimatsystem. Die Bezugsgroesse wird davor UND danach gemessen: Springt
    // sie, lag eine Happy-Hour-Grenze im Messfenster (Hausregel 21/49) - dann wird das Fenster
    // WIEDERHOLT, nicht die Schranke gelockert (Hausregel 26).
    const prodSektor = (DEFS || []).filter(sk => sk.mod && sk.mod.prod)
      .sort((a, b) => b.mod.prod - a.mod.prod)[0];
    check('4-tabelle: es gibt ueberhaupt einen Sektor mit Produktionsbonus zu messen',
      !!prodSektor, { mitProd: (DEFS || []).filter(sk => sk.mod && sk.mod.prod).map(sk => sk.key) });
    const bonusSys = prodSektor ? SYSTEME.find(sy => sektorFuer(sy).key === prodSektor.key) : null;

    let ergebnis = null;
    const protokoll = [];
    for (let versuch = 1; versuch <= 3 && !ergebnis && bonusSys; versuch++) {
      const a = await seite(browser, 'kepler'); const rA = await erzRate(a.page); await a.ctx.close();
      const b = await seite(browser, bonusSys.id); const rB = await erzRate(b.page); await b.ctx.close();
      const c = await seite(browser, 'kepler'); const rC = await erzRate(c.page); await c.ctx.close();
      protokoll.push({ versuch, neutral: rA, bonus: rB, neutralWieder: rC });
      if (!rA || !rB || !rC || rA.zahl === null || rB.zahl === null || rC.zahl === null) continue;
      if (rA.zahl !== rC.zahl) continue; // Bezugsgroesse gewandert -> Messfenster wiederholen
      ergebnis = { basis: rA.zahl, bonus: rB.zahl, verhaeltnis: rB.zahl / rA.zahl };
    }

    check('4-vorab: die Bezugsgroesse (Erzrate im neutralen Sektor) hat sich waehrend der Messung gehalten',
      !!ergebnis, { protokoll });

    if (ergebnis) {
      // Die angezeigte Rate ist auf eine Nachkommastelle gerundet - deshalb ein Band statt eines
      // exakten Werts. Es trennt sauber zwischen "wirkt" und "wirkt nicht": ohne die Aenderung
      // steht dort exakt 1,000.
      const soll = 1 + prodSektor.mod.prod;
      check('4a-wirkung: eine Kolonie im Produktions-Sektor foerdert messbar mehr als im neutralen Sektor',
        ergebnis.verhaeltnis > 1.02 && Math.abs(ergebnis.verhaeltnis - soll) < 0.03,
        { sektor: prodSektor.key, system: bonusSys.id, soll: soll.toFixed(3),
          gemessen: ergebnis.verhaeltnis.toFixed(4), basis: ergebnis.basis, bonus: ergebnis.bonus,
          protokoll });
    }
  } catch (e) {
    check('LAUF: der Test lief bis zum Ende durch', false, { fehler: String((e && e.stack) || e) });
  }
  if (auf) await auf.ctx.close();
  return ende(async () => browser.close());
})();
