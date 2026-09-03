// Der Urmateriekern ist auf der Karte zu ERKENNEN - nicht nur vorhanden.
//
//   node tests/test_urmaterie_karte.js
//
// Anlass (Spieler-Report Sascha, 22.08.2026): "Habe alle Systeme durchgeschaut kein einzigen
// urmaterie Asteroiden gefunden." Die Haelfte der Ursache lag im Frontend: JEDES Vorkommen trug
// auf der Karte die Farbe seiner GROESSE (g.farbe), der Urmateriekern war pixelidentisch mit
// sieben anderen Sorten - waehrend Hilfetext und Patchnote "goldgeadertes Gestein, sofort
// erkennbar" versprachen. Die zehn gezeichneten ast_*-Sortensymbole hatten gemessen je GENAU
// zwei Fundstellen (Definition + Tabelleneintrag) und keine einzige Lesestelle (Hausregel 42/59).
//
// GEPRUEFT WIRD DIE WIRKUNG ALS PAAR (Regel 61): Zwei Vorkommen DERSELBEN Groesse, einmal
// urmaterie, einmal eisen - nur so belegt ein Unterschied die SORTE und nicht die Groesse.
// Eine Pruefung "die Goldfarbe steht im Quelltext" waere auch dann gruen, wenn die Zeichnung
// sie nie erreicht.
//
// GEGENPROBE (Regel 71 mit Pflichtliste, GEMESSEN am 28.08.2026 gegen origin/main via
// KEPLER_SPIELDATEI): 0a, 0b, 0c, 0d, 1a, 1c, 2a, 2b, 2c fallen. Gruen bleiben MUESSEN
// 1-vorab und 1b - am alten Stand zeigt 1-vorab woertlich den Anlassfall (beide Vorkommen
// identisch #e0a548, ununterscheidbar), und 1b ist die Zusage, dass der Eisenbrocken seine
// Groessenfarbe behaelt; faellt eine der beiden, ist das ein WERKZEUGFEHLER der Gegenprobe,
// kein Beleg. 0d2 bleibt ebenfalls gruen (die beanstandete Formulierung kam erst MIT der
// Etappe und ist am alten Stand gar nicht da).
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// Verneinende Pruefungen ohne den PATCHNOTES-Block - der Patchnote dieser Etappe darf den alten
// Wortlaut zitieren (Regel 46).
const OHNE_HISTORIE = (() => {
  const v = JS.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : JS.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? JS.slice(0, v) + JS.slice(b) : JS;
})();
check('vorab: der Patchnotes-Block ist gefunden (sonst waere die Exzision vacuous)', OHNE_HISTORIE.length < JS.length, { entfernt: JS.length - OHNE_HISTORIE.length });

// ---- 0) Quelltext: beide Zeichenstellen tragen den Urmaterie-Zweig -------------------------
// Es gibt ZWEI Stellen, die ein Vorkommen als Sechseck zeichnen (Guertelbahn und Schuerfpeilung,
// Punkt 6 der Checkliste). Gezaehlt wird die Goldader-Farbe in einem polygon-fill-Ausdruck -
// je Stelle einmal als fill-Weiche.
const goldWeichen = (JS.match(/fill="\$\{istUrmaterie(?:Pe)? \? '#8a5f1c' : g\.farbe\}"/g) || []).length;
check('0a: beide Zeichenstellen (Guertel + Peilung) kennen den Urmaterie-Zweig', goldWeichen === 2, { gefunden: goldWeichen });
check('0b: die Weiche haengt an PROTOMATERIE_SORTE, nicht an einem zweiten Literal',
  /const istUrmaterie = a\.sorte === PROTOMATERIE_SORTE;/.test(JS) && /const istUrmateriePe = pe\.sorte === PROTOMATERIE_SORTE;/.test(JS));
check('0c: der Hilfetext behauptet nicht mehr "das Symbol die Sorte" auf der Karte',
  !OHNE_HISTORIE.includes('das Symbol die Sorte'));
check('0d: er sagt stattdessen, wo die Sorte steht (Kartenmenue) und was gold ist',
  /die Sorte nennt dir das\s+Kartenmen/.test(JS) && JS.includes('goldgeaderte Gestein'));
// Am gerenderten Screenshot gemessen (28.08.2026): Ein Eisen-KERN gleicher Groesse traegt die
// Groessenfarbe #e0a548 (warmes Orange), ein Koloss Rosa - "das einzige warme Gestein zwischen
// lauter grauen Brocken" waere also eine messbare Falschaussage. Das immer wahre Merkmal ist
// die helle Ader (#ffe6ab) statt des dunklen Rands, und daran haengt der Text jetzt.
// PATCHNOTES vorher herausgeschnitten (Regel 46): Der Patchnote der Sorten-Einfuehrung zitiert
// die alte Formulierung als unveraenderliche Historie.
check('0d2: der Hilfetext behauptet nicht, alle anderen Brocken seien grau',
  !OHNE_HISTORIE.includes('zwischen lauter grauen Brocken'));

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
const P_URM = '7', P_EIS = '2';

// Zwei Vorkommen DERSELBEN Groesse - der gemessene Unterschied kann damit nur die Sorte sein.
function feld(){
  return { systeme:[SYS], felder:{ [SYS]: { plaetze: {
    [P_URM]: { sorte:'urmaterie', groesse:'kern', vorrat:480000 },
    [P_EIS]: { sorte:'eisen',     groesse:'kern', vorrat:480000 }
  } } } };
}

function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'asteroid/field') return j(store.__feld);
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'reports') return req.method() === 'POST' ? j({ ok:true }) : j({ reports: [] });
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

async function tab(browser, startSave){
  const store = { __feld: feld() };
  if (startSave) store[SAVE_KEY] = startSave;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}

(async () => {
  const browser = await starteBrowser();

  // Ausgangsstand aus dem Spiel MESSEN statt eintippen (Regel 2).
  const roh = await tab(browser);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0e: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    delete st.asteroidFeld;
    return JSON.stringify(st);
  }

  const t = await tab(browser, fixture());
  await t.page.waitForTimeout(1500);
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t.page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(t.page, SYS);

  // ---- 1) Die Karte: gold gegen grau, gleiche Groesse ---------------------------------------
  const knoten = await t.page.evaluate(([pu, pe]) => {
    const lies = platz => {
      const n = document.querySelector('[data-map-asteroid="' + platz + '"]');
      if (!n) return null;
      const poly = n.querySelector('polygon');
      const kreis = n.querySelector('circle:not([stroke])') || n.querySelectorAll('circle')[n.querySelectorAll('circle').length - 1];
      const b = n.getBoundingClientRect();
      return { breite: Math.round(b.width), polyFill: poly ? poly.getAttribute('fill') : null,
               polyStroke: poly ? poly.getAttribute('stroke') : null,
               kreisFill: kreis ? kreis.getAttribute('fill') : null };
    };
    return { urm: lies(pu), eis: lies(pe) };
  }, [P_URM, P_EIS]);
  check('1-vorab: beide Vorkommen sind gezeichnet und sichtbar',
    !!(knoten.urm && knoten.eis && knoten.urm.breite > 0 && knoten.eis.breite > 0), knoten);
  check('1a: der Urmateriekern traegt das goldgeaderte Gestein (Koerper #8a5f1c, Ader-Rand #ffe6ab)',
    !!knoten.urm && knoten.urm.polyFill === '#8a5f1c' && knoten.urm.polyStroke === '#ffe6ab', knoten.urm);
  check('1b: der Eisenbrocken derselben Groesse behaelt die Groessenfarbe (Gegenrichtung des Paars)',
    !!knoten.eis && knoten.eis.polyFill !== '#8a5f1c' && knoten.eis.polyStroke === '#0a0d1a', knoten.eis);
  check('1c: die goldene Ader liegt im Kern des Urmateriekerns, nicht beim Eisen',
    !!knoten.urm && !!knoten.eis && knoten.urm.kreisFill === '#ffe6ab' && knoten.eis.kreisFill !== '#ffe6ab',
    { urm: knoten.urm && knoten.urm.kreisFill, eis: knoten.eis && knoten.eis.kreisFill });

  // ---- 2) Das Kartenmenue nennt die Sorte MIT Symbol ----------------------------------------
  async function menueKopf(platz){
    return t.page.evaluate(p => {
      const n = document.querySelector('[data-map-asteroid="' + p + '"]');
      if (!n) return null;
      n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 }));
      const kopf = document.querySelector('.kmenu .kmenu-kopf');
      if (!kopf) return { menue:false };
      return { menue:true, svg: !!kopf.querySelector('svg'), svgInhalt: (kopf.querySelector('svg')||{}).innerHTML || '',
               text: kopf.textContent };
    }, platz);
  }
  const kU = await menueKopf(P_URM);
  await t.page.waitForTimeout(250);
  const kE = await menueKopf(P_EIS);
  check('2-vorab: beide Kartenmenues oeffnen sich', !!(kU && kU.menue && kE && kE.menue), { u: kU, e: kE && kE.menue });
  check('2a: der Menuekopf traegt ein gezeichnetes Sorten-Symbol (SVG, nicht nur Text)',
    !!(kU && kU.svg && kE && kE.svg));
  check('2b: die Symbole der zwei Sorten UNTERSCHEIDEN sich - es ist das Sortenbild, kein festes',
    !!(kU && kE && kU.svgInhalt && kE.svgInhalt && kU.svgInhalt !== kE.svgInhalt),
    { uLen: kU && kU.svgInhalt.length, eLen: kE && kE.svgInhalt.length });
  check('2c: der Urmaterie-Kopf zeigt die Goldader des ast_urmaterie-Symbols',
    !!(kU && /ffe6ab/i.test(kU.svgInhalt)), kU && kU.svgInhalt.slice(0, 80));

  check('3: keine Seitenfehler waehrend des Laufs', t.errs.length === 0, t.errs.slice(0, 3));

  await t.ctx.close();
  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Testlauf abgebrochen | ' + e.message); process.exit(1); });
