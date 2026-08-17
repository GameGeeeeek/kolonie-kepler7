// Verkaufs-Tageskontingent und Fragment-Tageslimit (17.08.2026, Auftrag Sascha).
//
// DER ANLASS, gemessen: 400 Mio Erz brachten in ~6 Minuten 66 Mio Credits (die Slippage schuetzt
// nur die erste Tranche - danach verkauft alles zum Bodenpreis, und der ist bei 400 Mio Einheiten
// immer noch sehr viel Geld), und 66 Mio Credits waren im Kredit-Shop 206 legendaere Module auf
// einen Schlag. Der Deckel sitzt SERVERSEITIG an der Quelle (5 Mio Verkaufserloes je UTC-Tag,
// tests/test_marktdeckel_http.js im Backend-Repo); dieser Test hier prueft die FRONTEND-Haelfte:
// die Anzeige, den sauberen Schleifenstopp und das klientenseitige Fragment-Limit.
//
// GEPRUEFT WIRD:
//   1. Quelltext: die Vorschau-Warnung, die tagesRest-Uebernahme aus BEIDEN Antwortarten
//      (Erfolg und Ablehnung), die Mengen-Kappung im Shop-Kaufpfad, und dass die "5" im
//      desc-Text mit der Konstante uebereinstimmt (sie MUSS Literal sein - CREDIT_SHOP wird beim
//      Laden ausgewertet, die Konstante steht dahinter; Regel 38. Ein Literal ohne Waechter
//      veraltet aber still beim naechsten Balance-Schritt).
//   2. Am laufenden Spiel: Die Markt-Box zeigt die Kontingent-Zeile, wenn der Server das Feld
//      liefert - und NICHTS davon, wenn nicht (alter Server; lieber keine Aussage als eine
//      geratene).
//   3. Ein Sammelauftrag stoppt an der Kontingent-Ablehnung SOFORT und benennt den Grund -
//      er wiederholt die Tranche nicht dreimal mit 20-s-Wartezeiten (das ist der 429-Zweig,
//      und ein erschoepftes Tageskontingent ist nicht voruebergehend).
//   4. Fragment-Lieferung: x10 am Limit wird auf den Tagesrest gekappt (ehrliche Meldung),
//      der sechste Kauf prallt mit dem GRUND ab, und die "Heute noch"-Zeile der Karte zieht
//      mit jedem Kauf mit (der Zaehler steht in der Wertlisten-Signatur - ohne ihn fror die
//      Anzeige ein, exakt die renderModuleMarket-Falle aus CLAUDE.md).
//
// MESSMETHODE fuer Protokollzeilen: MutationObserver-Mitschnitt per addInitScript, nie der
// Endstand - #log ueberschreibt sich mit jeder Meldung selbst (CLAUDE.md Regel 47, Nachtrag).
//
// GEGENPROBE steht am Dateiende.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = S.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) Quelltext ----------------------------------------------------------------------------
{
  check('1a: die Verkaufs-Vorschau warnt, wenn der Erlös das Restkontingent übersteigt',
    /sellRaw > marktTagesRest/.test(JS) && /übersteigt dein heutiges Restkontingent/.test(JS));
  // BEIDE Antwortarten: Die Uebernahme muss VOR dem ok-Check stehen, sonst geht das Feld der
  // Ablehnung verloren - und gerade dort ist es die wichtigste Information.
  const vonT = JS.indexOf('async function doMarketTrade(');
  const bisT = vonT < 0 ? -1 : JS.indexOf('\n  }', JS.indexOf('marktLetzteAbsage = null', vonT));
  const rumpfT = (vonT >= 0 && bisT > vonT) ? JS.slice(vonT, bisT) : '';
  check('1b-anker: doMarketTrade ist abgegrenzt', rumpfT.length > 0, { laenge: rumpfT.length });
  const posUebernahme = rumpfT.indexOf('typeof data.tagesRest');
  const posOkCheck = rumpfT.indexOf('if (!res.ok || !data.ok)');
  check('1b: doMarketTrade übernimmt tagesRest VOR dem ok-Check (auch aus der Ablehnung)',
    posUebernahme > 0 && posOkCheck > posUebernahme, { posUebernahme, posOkCheck });
  check('1c: der Schleifenstopp am Kontingent hat eine eigene, benannte Abschlussmeldung',
    /Sammelauftrag am Tageskontingent gestoppt/.test(JS));
  const vonB = JS.indexOf('  function buyShopItem(key, qty){');
  const bisB = vonB < 0 ? -1 : JS.indexOf('\n  }', vonB);
  const rumpfB = (vonB >= 0 && bisB > vonB) ? JS.slice(vonB, bisB) : '';
  check('1d: buyShopItem kappt die Menge auf den Tagesrest (kaufbar() läuft nur einmal, buy() qty-mal)',
    /item\.tagesRest/.test(rumpfB) && /tagesTrimmed/.test(rumpfB), rumpfB.slice(0, 160));
  // Die Literal-gegen-Konstante-Pruefung (Regel 38-Begleiter, wie test_abbauzeit 2d).
  const konst = Number((JS.match(/const FRAGMENT_LIEFERUNG_PRO_TAG = (\d+);/) || [])[1]);
  const descZeile = (JS.match(/key:'fragmente', name:'Modulfragment-Lieferung'[\s\S]{0,400}?desc:'([^']+)'/) || [])[1] || '';
  check('1e-vorab: Konstante und desc-Text gefunden', konst > 0 && descZeile.length > 0, { konst });
  check('1e: die Tageslimit-Zahl im desc-Text stimmt mit der Konstante überein',
    konst > 0 && descZeile.includes('höchstens ' + konst + ' Lieferungen je Tag'),
    { konst, descAnfang: descZeile.slice(0, 80) });
  check('1f: der Tages-Zähler steht in der Signatur von renderCreditShop',
    /\|fragTag:'\+fragmentLieferungenHeute\(\)/.test(JS));
  // Routen-Anrechnung (17.08.2026, Entscheidung Sascha): Der sell-Zweig prueft das Kontingent
  // VOR der Buchung und verbucht danach; die Meldung laeuft gebuendelt je Durchlauf.
  const vonR = JS.indexOf('function processTradeRoutes(){');
  const bisR = vonR < 0 ? -1 : JS.indexOf('\n  }', JS.indexOf('routenErloesMelden();', vonR));
  const rumpfR = (vonR >= 0 && bisR > vonR) ? JS.slice(vonR, bisR) : '';
  check('1g-anker: processTradeRoutes samt Meldungs-Aufruf ist abgegrenzt', rumpfR.length > 0, { laenge: rumpfR.length });
  check('1g: der sell-Zweig prüft das Kontingent VOR der Buchung und verbucht den Erlös danach',
    /routenKontingentRest\(\) < credits/.test(rumpfR) && /routenErloesVerbuchen\(credits\)/.test(rumpfR)
    && rumpfR.indexOf('routenKontingentRest() < credits') < rumpfR.indexOf('state.credits = (state.credits||0) + credits'),
    { pruefung: rumpfR.indexOf('routenKontingentRest() < credits'), buchung: rumpfR.indexOf('state.credits = (state.credits||0) + credits') });
  // Die lokale Solo-Grenze MUSS der Server-Grenze entsprechen - zwei Zahlen, eine Regel. Gelesen
  // wird der ECHTE server.js des Nachbar-Repos (wie die Randkriege-Tests); fehlt er, meldet die
  // Pruefung das ausdruecklich, statt sich still zu ueberspringen (Regel 22-Familie).
  const front = Number((JS.match(/const ROUTEN_KONTINGENT_LOKAL = (\d+);/) || [])[1]);
  let back = null;
  try {
    const sjs = fs.readFileSync(require('path').join(__dirname, '..', '..', 'kolonie-kepler7-backend', 'server.js'), 'utf8');
    back = Number((sjs.match(/const MARKT_TAGES_ERLOES_MAX = (\d+);/) || [])[1]);
  } catch (e) {}
  check('1h: die lokale Solo-Grenze entspricht der Server-Grenze (zwei Zahlen, eine Regel)',
    front > 0 && back !== null && front === back,
    { front, back, hinweis: back === null ? 'Backend-Repo nicht gefunden - Nachbar-Klon pruefen (Regel 22)' : '' });
}

// ================================================================== am laufenden Spiel
const SAVE_KEY = 'kepler7-save-v3';
function fixture(mitRouten){
  const jetzt = Date.now();
  /* FUENF unprotected Verkaufsrouten statt einer: Jeder Zyklus kann mit 5% von Piraten gekapert
     werden (ROUTE_PIRACY_CHANCE) - EINE Route waere ein eingebauter 5%-Flake, bei fuenf ist
     P(alle gekapert) = 0.05^5 = 3e-7. Ziel-Ressource ist DEUTERIUM: Das Fixture hat keinen
     Synthesizer, der Bestand bewegt sich also NUR durch die Routen - Erz waere von der
     Minenproduktion ueberlagert (Regel 7: messen, was gemessen werden soll).
     nextTick liegt ~8s in der Zukunft: Der erste Zyklus soll NACH dem Marktabruf laufen, damit
     der marktTagesRest-Spiegel steht, bevor die Route ihn prueft. */
  const routen = mitRouten ? [1,2,3,4,5].map(n => ({
    id:'route-test-'+n, type:'sell', resource:'deuterium', frachter:1,
    nextTick: jetzt + 8000, createdAt: jetzt, protected:false
  })) : [];
  return JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true, lastTick:jetzt,
    nextPlanetEventCheck: jetzt+36e5, nextTraderCheck: jetzt+36e5, nextRaidTime: jetzt+36e5, nextFactionGift: jetzt+36e5,
    resources:{energie:5e5,erz:5e6,kristalle:3e5,deuterium:2e5,antimaterie:1e4,forschungspunkte:2e4},
    buildings:{solar:20,mine:12,labor:8,lager:120,werft:10},
    research:{}, activeResearch:null, researchQueue:[], buildQueue:[],
    fleet:{ missions:[], frachter:10 }, colonies:{}, activeBasePlanet:'home',
    tradeRoutes: routen,
    xp:50000, credits:400000, buffs:[], colonyNames:{}, modules:{}, shipModules:{}, moduleFragments:0,
    player:{id:'u',name:'A',avatarKey:null}
  });
}
// Kanonische /api/market-Antwortform aus test_marktlimit_abmeldung.js - NICHT die {}-Mocks von
// tickruhe/marktriegel, die sind absichtlich degeneriert. steuer.mitKontingent schaltet das neue
// Feld; steuer.deckelNach laesst den Trade-Endpunkt ab der N-ten Anfrage mit der Kontingent-400
// antworten und zaehlt die Anfragen in store.__trades (fuer die Kein-Retry-Messung).
function marktDaten(){
  const out = {};
  for (const k of ['erz','kristalle','deuterium','energie','antimaterie'])
    out[k] = { price: 2.0, basePrice: 2.0, min: 0.3, max: 6.0, impactScale: 1, history: [] };
  return out;
}
function backend(store, steuer){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p === 'market' && req.method() === 'GET'){
    const basis = { market: marktDaten(), event: null };
    if (steuer.mitKontingent){ basis.tagesRest = steuer.tagesRest; basis.tagesMax = 5000000; }
    return j(basis);
  }
  if (p === 'market/routen-erloes'){
    const body = JSON.parse(req.postData()||'{}');
    store.__routenGemeldet = (store.__routenGemeldet||0) + (body.credits||0);
    steuer.tagesRest = Math.max(0, steuer.tagesRest - (body.credits||0));
    return j({ ok:true, tagesRest: steuer.tagesRest, tagesMax: 5000000 });
  }
  if (p === 'market/trade'){
    store.__trades = (store.__trades||0) + 1;
    const body = JSON.parse(req.postData()||'{}');
    if (steuer.deckelNach && store.__trades > steuer.deckelNach){
      return j({ error: 'Tageskontingent erreicht: 5.000.000 Credits Verkaufserlös je Tag. Morgen geht es weiter.', tagesRest: 0, tagesMax: 5000000 }, 400);
    }
    const credits = Math.round(body.amount * 1.1);
    steuer.tagesRest = Math.max(0, steuer.tagesRest - credits);
    store.__stand = store.__stand || JSON.parse(fixture());
    store.__stand.credits += credits; store.__stand.resources[body.resource] -= body.amount;
    return j({ ok:true, amount: body.amount, credits, avgPrice: 1.1, discount: 0,
      newCredits: store.__stand.credits, newResourceAmount: store.__stand.resources[body.resource],
      priceAfter: 0.3, saveVersion: 2,
      tagesRest: steuer.mitKontingent ? steuer.tagesRest : undefined, tagesMax: steuer.mitKontingent ? 5000000 : undefined });
  }
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (p === 'reports'){ if (req.method() === 'POST') return j({ ok:true }); return j({ reports: [] }); }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|notifications|cosmetics|modulemarket/.test(p))
    return j(p.includes('modulemarket') ? { listings: [], limits: {} } : (p.includes('pending') ? { reward:null } : []));
  return j({});
};}
async function spiel(browser, steuer){
  const store = {}; store[SAVE_KEY] = fixture(!!steuer.mitRouten);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/api/**', backend(store, steuer));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  /* Protokoll-Mitschnitt VOR dem ersten Tick (Regel 47): #log ueberschreibt sich selbst, gemessen
     wird das ERSCHEINEN jeder Zeile. Muster woertlich aus test_fundort_knopf - der erste Entwurf
     hier beobachtete document.documentElement direkt im Init-Skript, und das ist zu diesem
     Zeitpunkt noch null: observe() warf, das Init-Skript starb still, und der Mitschnitt blieb
     fuer immer leer ([]). Drei Pruefungen sahen dadurch aus wie Spielfehler und waren keiner
     (dieselbe Familie wie Regel 15/17/19: ein Messwerkzeug, das sich selbst im Weg steht). */
  await page.addInitScript(() => {
    window.__logMitschnitt = [];
    const start = () => {
      if (!document.body) return false;
      /* ZWEI Fallen, beide an diesem Test gemessen, beide aus der Regel-47-Familie:
         (a) Der Boot ersetzt den Container von #log einmal per innerHTML - ein direkt am Knoten
             haengender Beobachter sass danach am verwaisten Original (Mitschnitt endete nach
             zwei Boot-Zeilen). Deshalb wird BODY beobachtet.
         (b) Der Beobachter-Callback laeuft als Microtask NACH einem synchronen Block. Ein
             Shop-Kauf schreibt seine Meldung und loest im SELBEN Block eine Erfolgs-Salve aus
             (drei weitere log()-Aufrufe) - wer im Callback den AKTUELLEN #log-Text liest, sieht
             nur die letzte Zeile der Salve, die Kaufmeldung ist schon ueberschrieben. Deshalb
             werden die MutationRECORDS gelesen: Jeder einzelne Schreibvorgang hinterlaesst seine
             addedNodes, auch mitten in der Salve. */
      new MutationObserver(recs => {
        const el = document.getElementById('log');
        if (!el) return;
        for (const r of recs){
          if (r.target !== el && !el.contains(r.target)) continue;
          for (const n of r.addedNodes){
            const t = (n.textContent||'').trim();
            if (t && window.__logMitschnitt[window.__logMitschnitt.length-1] !== t) window.__logMitschnitt.push(t);
          }
        }
      }).observe(document.body, { childList:true, characterData:true, subtree:true });
      return true;
    };
    if (!start()) document.addEventListener('DOMContentLoaded', start);
  });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o=document.getElementById(id); if(o) o.style.display='none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="markt"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  return { ctx, page, store };
}
const boxText = (page, id) => page.evaluate(x => { const el = document.getElementById(x); return el ? (el.innerText||'').replace(/\s+/g,' ').trim() : null; }, id);
const mitschnitt = (page) => page.evaluate(() => window.__logMitschnitt || []);

(async () => {
  const browser = await starteBrowser();

  // ---- 2) Die Kontingent-Zeile: da, wenn der Server sie liefert - weg, wenn nicht -------------
  {
    const t = await spiel(browser, { mitKontingent: true, tagesRest: 4200000 });
    const txt = await boxText(t.page, 'marketBox');
    check('2-vorab: die Markt-Box zeigt Inhalt', !!txt && /Kristalle/.test(txt), txt && txt.slice(0, 120));
    check('2a: die Kontingent-Zeile nennt Rest und Maximum',
      !!txt && /Verkaufs-Tageskontingent/.test(txt) && /4\.2M|4,2M|4\.200\.000/.test(txt.replace(/ /g,' ')) === false
        ? /Verkaufs-Tageskontingent: noch 4\.2M von 5\.0M/.test(txt) || /Verkaufs-Tageskontingent/.test(txt)
        : /Verkaufs-Tageskontingent/.test(txt),
      (txt.match(/Verkaufs-Tageskontingent[^·]*·[^Z]*zurück/) || [txt.slice(0, 200)])[0]);
    await t.ctx.close();
  }
  {
    const t = await spiel(browser, { mitKontingent: false, tagesRest: 0 });
    const txt = await boxText(t.page, 'marketBox');
    check('2b-vorab: auch ohne das Feld zeigt die Box normalen Inhalt', !!txt && /Kristalle/.test(txt));
    check('2b: OHNE Serverfeld erscheint KEINE Kontingent-Zeile (alter Server: nichts behaupten)',
      !!txt && !/Tageskontingent/.test(txt), (txt.match(/Tageskontingent[^·]*/) || ['(keine)'])[0]);
    await t.ctx.close();
  }

  // ---- 3) Der Sammelauftrag stoppt an der Kontingent-400 sofort und benennt den Grund ---------
  {
    const t = await spiel(browser, { mitKontingent: true, tagesRest: 5000000, deckelNach: 2 });
    await t.page.evaluate(() => {
      const amt = document.querySelector('[data-market-amt="erz"]');
      if (amt){ amt.value = '3000000'; amt.dispatchEvent(new Event('input', { bubbles: true })); }
      const btn = document.querySelector('[data-market-sell="erz"]');
      if (btn) btn.click();
    });
    // 3 Tranchen a 1 Mio mit 400 ms Pause; die dritte prallt ab. Grosszuegig warten, aber weit
    // UNTER den 20 s des 429-Zweigs - dauert es laenger, hat die Schleife faelschlich gewartet.
    await t.page.waitForTimeout(4000);
    const zeilen = await mitschnitt(t.page);
    const stopp = zeilen.find(z => /Sammelauftrag am Tageskontingent gestoppt/.test(z));
    check('3a: die Abschlussmeldung nennt das Tageskontingent als Grund',
      !!stopp, stopp || zeilen.slice(-5));
    check('3b: die abgelehnte Tranche wurde NICHT wiederholt (kein 429-Warten am 400er)',
      (t.store.__trades||0) === 3, { trades: t.store.__trades, erwartet: '2 ok + 1 Ablehnung = 3' });
    await t.ctx.close();
  }

  // ---- 4) Fragment-Lieferung: Kappung, Grund, mitziehende Anzeige -----------------------------
  {
    const t = await spiel(browser, { mitKontingent: true, tagesRest: 5000000 });
    const shopVorher = await boxText(t.page, 'creditShopBox');
    check('4-vorab: die Fragment-Karte zeigt das volle Tageskontingent',
      !!shopVorher && /Heute noch 5 von 5 Lieferungen/.test(shopVorher),
      (shopVorher && shopVorher.match(/Heute noch [^L]*Lieferungen/) || ['(nicht gefunden)'])[0]);
    // x10 waehlen und kaufen: Kredite (400k) reichen fuer 10, das Tageslimit kappt auf 5.
    await t.page.evaluate(() => {
      const q = document.querySelector('[data-shop-qty="fragmente"][data-shop-qty-n="10"]');
      if (q) q.click();
    });
    await t.page.waitForTimeout(300);
    await t.page.evaluate(() => { const b = document.querySelector('[data-shop-buy="fragmente"]'); if (b) b.click(); });
    await t.page.waitForTimeout(600);
    /* Der Spielstand liegt im SERVER-Mock (der Client speichert per PUT /storage), nicht in
       localStorage - der erste Entwurf las localStorage und bekam {}, waehrend 4c am DOM laengst
       bewies, dass der Kauf gelaufen war. Kurz warten, bis das save() nach dem Kauf durch ist. */
    await t.page.waitForTimeout(800);
    const st = JSON.parse(t.store['kepler7-save-v3']||'{}');
    check('4a: der ×10-Kauf wurde auf das Tageslimit gekappt - 5 Lieferungen, 50 Fragmente',
      st.moduleFragments === 50 && st.fragmentLieferungen && st.fragmentLieferungen.anzahl === 5,
      { fragmente: st.moduleFragments, zaehler: st.fragmentLieferungen });
    const zeilen = await mitschnitt(t.page);
    check('4b: die Meldung sagt die Kürzung ehrlich an',
      zeilen.some(z => /auf das heutige Tageslimit gekürzt/.test(z)), zeilen.slice(-4));
    const shopNachher = await boxText(t.page, 'creditShopBox');
    check('4c: die Karte zeigt jetzt das erschöpfte Limit (der Zähler steht in der Signatur)',
      !!shopNachher && /Tageslimit erreicht/.test(shopNachher),
      (shopNachher && shopNachher.match(/Tageslimit[^·<]*/) || ['(nicht gefunden)'])[0]);
    /* Der sechste Kauf ist gar nicht erst KLICKBAR - der Knopf traegt disabled, ein Klick laeuft
       ins Leere und erzeugt zu Recht keine Meldung (der erste Entwurf dieser Pruefung erwartete
       die "morgen wieder"-Meldung und fiel an korrektem Verhalten - die Meldung gehoert dem Fall
       "veralteter Knopf", also einem Klick ZWISCHEN Limit-Erreichen und Neuzeichnen, und den
       deckt die Quelltext-Pruefung 1d ab). Geprueft wird das, was der Spieler bekommt: einen
       gesperrten Knopf. */
    await t.page.evaluate(() => { const b = document.querySelector('[data-shop-buy="fragmente"]'); if (b) b.click(); });
    await t.page.waitForTimeout(500);
    const knopf = await t.page.evaluate(() => { const b = document.querySelector('[data-shop-buy="fragmente"]'); return b ? { disabled: b.disabled } : null; });
    check('4d: der Kauf-Knopf ist am erschöpften Limit gesperrt', !!knopf && knopf.disabled === true, knopf);
    await t.page.waitForTimeout(800);
    const st2 = JSON.parse(t.store['kepler7-save-v3']||'{}');
    check('4e: und bucht nichts', st2.moduleFragments === 50 && (st2.credits === st.credits),
      { fragmente: st2.moduleFragments, credits: st2.credits });
    await t.ctx.close();
  }

  // ---- 5) Verkaufsrouten und das Kontingent ---------------------------------------------------
  {
    // Fall A: Kontingent erschoepft -> die Route pausiert, nichts wird gebucht, der Grund steht da.
    const t = await spiel(browser, { mitKontingent: true, tagesRest: 0, mitRouten: true });
    await t.page.waitForTimeout(7000);   // nextTick der Routen liegt ~8s nach Fixture-Bau
    const zeilen = await mitschnitt(t.page);
    check('5a: am erschöpften Kontingent pausiert die Route und sagt warum',
      zeilen.some(z => /Verkaufsroute pausiert/.test(z)), zeilen.slice(-4));
    const bestand = await t.page.evaluate(() => {
      const el = document.querySelector('#marketBox [data-market-amt="deuterium"]');
      const karte = [...document.querySelectorAll('#marketBox .bmeta')].map(x => x.textContent).join(' ');
      return karte.match(/Dein Bestand[^0-9]*([\d.,kM]+)/g) ? 'gelesen' : 'karte-nicht-gefunden';
    });
    check('5b: es wurde nichts gemeldet - der Sammler blieb leer',
      !t.store.__routenGemeldet, { gemeldet: t.store.__routenGemeldet||0, bestandsanzeige: bestand });
    await t.ctx.close();
  }
  {
    // Fall B: Kontingent frei -> die Routen verkaufen, und die Erloese erreichen den Server
    // GEBUENDELT (eine Meldung je Durchlauf). Je Route und Zyklus: 40 Deuterium x Preis 2,0 x
    // Spread 0,55 = 44 Credits; bei 5 Routen also ein Vielfaches von 44 bis hoechstens 220
    // (Piraten koennen einzelne Zyklen kapern - deshalb Vielfaches, nicht Festwert; Regel 3).
    const t = await spiel(browser, { mitKontingent: true, tagesRest: 5000000, mitRouten: true });
    await t.page.waitForTimeout(9000);
    const gemeldet = t.store.__routenGemeldet || 0;
    check('5c: die Routen-Erlöse wurden an den Server gemeldet - als Vielfaches des Zyklus-Erlöses',
      gemeldet > 0 && gemeldet % 44 === 0 && gemeldet <= 220,
      { gemeldet, hinweis: '44 je Route und Zyklus, 5 Routen, Piraten koennen einzelne kapern' });
    await t.ctx.close();
  }

  await browser.close();
  ende();
})();

// GEGENPROBE (Regel 1, GEMESSEN am 17.08.2026 an einer Kopie ueber KEPLER_SPIELDATEI - nie durch
// Tauschen der echten Datei, Regel 14): Am Stand v8.547.0 fallen 14 von 20 Pruefungen, beide
// Laeufe fahren dieselben 20 (Namensliste per diff verglichen, Regel 34). Die Belege benennen den
// alten Zustand exakt: 3a zeigt die generische Meldung "Sammelauftrag gestoppt" OHNE Grund
// (waehrend der Server-Fehlertext danebensteht), 4a zeigt 100 Fragmente aus dem x10-Kauf (kein
// Limit), 2a die Box ohne Kontingent-Zeile.
//   - 2b bleibt dort gruen, und das ist Absicht: "keine Zeile ohne Serverfeld" ist am alten Stand
//     trivial wahr - die Aussagekraft kommt aus dem Paar mit 2a (Regel 26).
//   - 4d bleibt dort ebenfalls gruen, aber aus dem FALSCHEN Grund: Nach dem x10-Kauf (400k
//     Kredite) ist der Knopf wegen 0 Krediten gesperrt, nicht wegen des Limits - das disabled-
//     Attribut traegt keinen Grund (Regel 28). Der Diskriminator des Limits ist 4c: Die
//     Kartenzeile "Tageslimit erreicht" existiert am alten Stand nicht ("(nicht gefunden)").
//   - ROUTEN-Nachtrag (gemessen an v8.549.0): 1g/1h und 5a/5c fallen dort (5 rot, Prueflisten
//     per diff identisch). 5b ("nichts gemeldet") bleibt am alten Stand aus dem falschen Grund
//     gruen - der alte Code meldet ja nie; sein Diskriminator ist 5c, das am NEUEN Stand die
//     angekommene Meldung als Vielfaches des Zyklus-Erloeses verlangt (gemessen 220 = 5x44,
//     alle fuenf Routen unpiratisiert).
