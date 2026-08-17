// Etappe E1+E2 des Wirtschafts-Rebalance-Konzepts (docs/wirtschaft-rebalance-konzept.md):
// (E1) Verkaufs- und Veredelungsroute binden höchstens ROUTE_MAX_FRACHTER Frachter, je
//      Verkaufsressource bzw. Umwandlungspaar läuft höchstens EINE Route; bestehende Routen
//      über dem Deckel stutzt applyStateDefaults beim Laden (Frachter werden frei).
// (E2) Die Verkaufsroute rechnet höchstens zum Markt-BASISPREIS ab - der lokale Cache-Preis
//      konnte darüber liegen (Knappheits-Ereignis) und die Route war dann ein slippagefreier
//      Umweg am Backend vorbei.
//
// Gemessen wird AUSGEFÜHRT: Die echten Blöcke (Konstanten, createTradeRoute, processTradeRoutes,
// Stutz-Block) laufen mit einem Mini-Fixture. Umgebungs-Stubs (log/render/save/playSound,
// Flotten-Zähler) sind Fixture-Grenze; die Preis-Regel wird aus den beiden Zustands-Deltas
// HERGELEITET (credits / (verkaufte Menge × Spread)), damit kein Bonushelfer-Stub in die
// Messung einfließt (Regel 36).
//
// Gegenprobe (beidseitig gefahren, 17.08.2026): Am alten Stand (v8.548.0) fällt 1-anker
// (ROUTE_MAX_FRACHTER fehlt), und der hergeleitete Routenpreis folgt dem Cache über den
// Basispreis hinaus (Prüfung 5a wäre rot).
const fs = require('fs');
const { SPIELDATEI, SERVER_JS, pruefer } = require('./lib/umgebung');

const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------- 1: Anker und Blöcke ----------
const kAnfang = S.indexOf('const ROUTE_INTERVAL_MS');
const kEnde = S.indexOf('  // ===== Geteilter Marktplatz');
check('1-anker: Routen-Block gefunden', kAnfang >= 0 && kEnde > kAnfang, { kAnfang, kEnde });
check('1b: ROUTE_MAX_FRACHTER existiert', S.indexOf('const ROUTE_MAX_FRACHTER') > 0);
check('1c: MARKET_BASE_PRICES existiert', S.indexOf('const MARKET_BASE_PRICES') > 0);

let api = null;
try {
  const block = S.slice(Math.max(0, kAnfang), Math.max(0, kEnde));
  const bauer = new Function('fx', `
    const state = fx.state;
    const logs = fx.logs;
    const log = (msg) => logs.push(String(msg));
    const render = () => {}; const save = () => {}; const playSound = () => {};
    const useBackend = () => true;
    const allFleets = () => fx.flotten;
    const allFleetsWithPlanet = () => fx.flotten.map(f => ({ fleet: Object.assign({ missions: [] }, f) }));
    const computeAwayByType = () => ({});
    // Neutrale Bonus-Umgebung: alle Zusatz-Boni 0, damit die Herleitung des Preises exakt ist
    // (bei Eingang 0 ist die Identität von deckelWeich keine Näherung, sondern exakt).
    const deckelWeich = (x) => x;
    const officerBonus = () => 0; const moduleBonusTotal = () => 0;
    const factionOutsideBonus = () => 0; const hostileRouteMult = () => 1;
    const hasRoleAnywhere = () => false;
    const RES_DEFS = [];
    const gainResources = (obj) => { for (const [r,a] of Object.entries(obj)) state.resources[r] = (state.resources[r]||0) + a; };
    ${block}
    return {
      createTradeRoute: (typeof createTradeRoute === 'function') ? createTradeRoute : null,
      processTradeRoutes: (typeof processTradeRoutes === 'function') ? processTradeRoutes : null,
      ROUTE_MAX_FRACHTER: (typeof ROUTE_MAX_FRACHTER !== 'undefined') ? ROUTE_MAX_FRACHTER : null,
      MARKET_BASE_PRICES: (typeof MARKET_BASE_PRICES !== 'undefined') ? MARKET_BASE_PRICES : null,
      MARKET_SELL_SPREAD: (typeof MARKET_SELL_SPREAD !== 'undefined') ? MARKET_SELL_SPREAD : null
    };
  `);
  const probe = bauer({ state: { tradeRoutes: [], resources: {}, research: {} }, flotten: [], logs: [] });
  check('1-bau: der Block lässt sich ausführen', !!probe.createTradeRoute && !!probe.processTradeRoutes);
  check('1d: neue Konstanten im Block vorhanden', probe.ROUTE_MAX_FRACHTER !== null && !!probe.MARKET_BASE_PRICES,
    { deckel: probe.ROUTE_MAX_FRACHTER });
  if (probe.createTradeRoute && probe.ROUTE_MAX_FRACHTER !== null) api = bauer;
} catch (e) {
  check('1-bau: der Block lässt sich ausführen', false, String(e).slice(0, 200));
  check('1d: neue Konstanten im Block vorhanden', false);
}

if (api) {
  const frisch = () => ({
    state: { tradeRoutes: [], resources: { erz: 1e9, energie: 1e9 }, research: {}, credits: 0, marketCache: null },
    flotten: [{ frachter: 2000 }],
    logs: []
  });
  const DECKEL = api(frisch()).ROUTE_MAX_FRACHTER;

  // ---------- 2: E1 - Frachter-Deckel beim Anlegen ----------
  {
    const fx = frisch(); const t = api(fx);
    t.createTradeRoute('sell', { frachter: DECKEL + 1, resource: 'erz' });
    check('2a: Verkaufsroute über dem Deckel wird abgelehnt (mit Grund)',
      fx.state.tradeRoutes.length === 0 && fx.logs.some(l => l.includes('höchstens ' + DECKEL)),
      { logs: fx.logs.slice(-2) });
    t.createTradeRoute('sell', { frachter: DECKEL, resource: 'erz' });
    check('2b: Verkaufsroute auf dem Deckel wird angelegt', fx.state.tradeRoutes.length === 1);
    t.createTradeRoute('transport', { frachter: DECKEL + 5, resource: 'energie' });
    check('2c: Veredelungsroute über dem Deckel wird abgelehnt', fx.state.tradeRoutes.length === 1,
      { logs: fx.logs.slice(-1) });
    t.createTradeRoute('transport', { frachter: 3, resource: 'energie' });
    check('2d: Veredelungsroute unter dem Deckel wird angelegt', fx.state.tradeRoutes.length === 2);
  }

  // ---------- 3: E1 - eine Route je Ressource/Paar ----------
  {
    const fx = frisch(); const t = api(fx);
    t.createTradeRoute('sell', { frachter: 5, resource: 'erz' });
    t.createTradeRoute('sell', { frachter: 5, resource: 'erz' });
    check('3a: zweite Verkaufsroute derselben Ressource wird abgelehnt (mit Grund)',
      fx.state.tradeRoutes.length === 1 && fx.logs.some(l => l.includes('läuft bereits')),
      { logs: fx.logs.slice(-1) });
    t.createTradeRoute('sell', { frachter: 5, resource: 'kristalle' });
    check('3b: Verkaufsroute einer ANDEREN Ressource geht weiterhin', fx.state.tradeRoutes.length === 2);
    t.createTradeRoute('transport', { frachter: 5, resource: 'energie' });
    t.createTradeRoute('transport', { frachter: 5, resource: 'energie' });
    check('3c: zweites Veredelungs-Paar derselben Quelle wird abgelehnt',
      fx.state.tradeRoutes.filter(r => r.type === 'transport').length === 1);
  }

  // ---------- 4: E1 - Stutz-Block beim Laden (aus applyStateDefaults geschnitten) ----------
  {
    const sAnfang = S.indexOf('// Etappe E1 (Wirtschafts-Rebalance): Bestehende');
    const sEnde = S.indexOf('für Flotte und Lager.', sAnfang);
    const sSchluss = sEnde > 0 ? S.indexOf('}', sEnde) : -1;
    check('4-anker: Stutz-Block in applyStateDefaults gefunden', sAnfang > 0 && sSchluss > sAnfang);
    if (sAnfang > 0 && sSchluss > sAnfang) {
      try {
        const logs = [];
        const state = { tradeRoutes: [
          { type: 'sell', frachter: 500, resource: 'erz' },
          { type: 'transport', frachter: 20, resource: 'energie' },
          { type: 'sell', frachter: 10, resource: 'kristalle' },
          { type: 'credits', frachter: 15 }
        ] };
        new Function('state', 'log', 'ROUTE_MAX_FRACHTER', S.slice(sAnfang, sSchluss + 1))(state, (m) => logs.push(m), DECKEL);
        const [a, b, c, d] = state.tradeRoutes;
        check('4a: Routen über dem Deckel werden auf den Deckel gestutzt', a.frachter === DECKEL && b.frachter === DECKEL, { a: a.frachter, b: b.frachter });
        check('4b: Routen unter dem Deckel und Kredit-Routen bleiben unangetastet', c.frachter === 10 && d.frachter === 15);
        check('4c: das Stutzen wird gemeldet (mit Anzahl freier Frachter)', logs.length === 1 && /490/.test(logs[0]), { logs });
        const logs2 = [];
        new Function('state', 'log', 'ROUTE_MAX_FRACHTER', S.slice(sAnfang, sSchluss + 1))(state, (m) => logs2.push(m), DECKEL);
        check('4d: idempotent - zweiter Lauf stutzt nichts und meldet nichts', logs2.length === 0 && a.frachter === DECKEL);
      } catch (e) {
        check('4a: Routen über dem Deckel werden auf den Deckel gestutzt', false, String(e).slice(0, 160));
      }
    }
  }

  // ---------- 5: E2 - Verkaufsroute höchstens zum Basispreis (Preis HERGELEITET) ----------
  {
    const preisFuer = (cache) => {
      const fx = frisch(); const t = api(fx);
      fx.state.marketCache = cache;
      fx.state.tradeRoutes = [{ id: 'r1', type: 'sell', resource: 'erz', frachter: 10, nextTick: 0, protected: false }];
      const erzVorher = fx.state.resources.erz;
      // Piraterie würfelt je Zyklus - für eine deterministische Messung so oft ticken, bis
      // mindestens ein Zyklus durchkam (Erz-Bestand gesunken ist).
      for (let i = 0; i < 50 && fx.state.resources.erz === erzVorher; i++) {
        fx.state.tradeRoutes[0].nextTick = 0;
        t.processTradeRoutes();
      }
      const menge = erzVorher - fx.state.resources.erz;
      if (menge <= 0) return { fehler: 'kein Zyklus durchgekommen' };
      return { preis: fx.state.credits / (menge * api(frisch()).MARKET_SELL_SPREAD), menge };
    };
    const basis = api(frisch()).MARKET_BASE_PRICES.erz;
    const hoch = preisFuer({ erz: { price: basis * 3 } });
    check('5a: Cache-Preis ÜBER dem Basispreis wird auf den Basispreis gekappt',
      hoch.preis !== undefined && Math.abs(hoch.preis - basis) < 0.02, hoch);
    const tief = preisFuer({ erz: { price: basis * 0.25 } });
    check('5b: Cache-Preis UNTER dem Basispreis gilt weiterhin (Route folgt dem Markt nach unten)',
      tief.preis !== undefined && Math.abs(tief.preis - basis * 0.25) < 0.02, tief);
    const ohne = preisFuer(null);
    check('5c: ohne Markt-Cache gilt der Basispreis', ohne.preis !== undefined && Math.abs(ohne.preis - basis) < 0.02, ohne);
  }
}

// ---------- 6: Anzeigestellen ----------
const OHNE_HISTORIE = (() => {
  const v = S.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : S.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? S.slice(0, v) + S.slice(b) : S;
})();
check('6a: die Routentyp-Auswahl nennt den Deckel aus der Konstante (keine zweite Zahl)',
  S.includes('max. ${ROUTE_MAX_FRACHTER} Frachter, 1 Route je Ressource') &&
  S.includes('max. ${ROUTE_MAX_FRACHTER} Frachter, 1 Route je Paar'));
check('6b: der Hilfetext nennt Deckel und Basispreis-Regel',
  OHNE_HISTORIE.includes('Jede Route bindet höchstens 15 Frachter') &&
  OHNE_HISTORIE.includes('höchstens zum Markt-<em>Basispreis</em>'));
check('6c: das alte Versprechen "beliebig viele möglich" ist aus den Live-Texten verschwunden',
  !OHNE_HISTORIE.includes('beliebig viele möglich'));
check('6d: das Frachter-Eingabefeld deckelt über maxForType alle Routentypen',
  S.includes("newRouteDraft.type==='credits' ? ROUTE_CREDITS_MAX_FRACHTER : ROUTE_MAX_FRACHTER"));

// ---------- 7: Backend-Parität der Basispreise ----------
if (SERVER_JS && fs.existsSync(SERVER_JS)) {
  const SV = fs.readFileSync(SERVER_JS, 'utf8');
  const mFront = (S.match(/const MARKET_BASE_PRICES = \{([^}]*)\}/) || [])[1] || '';
  const front = {};
  for (const m of mFront.matchAll(/(\w+):\s*([\d.]+)/g)) front[m[1]] = Number(m[2]);
  const svStart = SV.indexOf('const MARKET_RESOURCES = {');
  const svEnde = svStart < 0 ? -1 : SV.indexOf('};', svStart);
  check('7-anker: MARKET_RESOURCES in server.js gefunden', svStart >= 0 && svEnde > svStart);
  if (svStart >= 0 && svEnde > svStart) {
    const back = {};
    for (const m of SV.slice(svStart, svEnde).matchAll(/(\w+):\s*\{\s*basePrice:\s*([\d.]+)/g)) back[m[1]] = Number(m[2]);
    const alleKeys = new Set([...Object.keys(front), ...Object.keys(back)]);
    const abweichungen = [...alleKeys].filter(k => front[k] !== back[k]).map(k => k + ': front ' + front[k] + ' vs back ' + back[k]);
    check('7a: Frontend-Basispreise decken sich Wert für Wert mit server.js (beide Richtungen)',
      abweichungen.length === 0 && alleKeys.size >= 5, { abweichungen, anzahl: alleKeys.size });
  }
} else {
  console.log('SKIP - 7: Backend-Parität (server.js nicht gefunden - Worktree ohne Nachbar-Repo?)');
}

ende();
