// Ein Rate-Limit ist kein Sitzungskonflikt (Spieler-Report Sascha, 17.08.2026:
// "400 Millionen Ressourcen im Markt verkaufen - irgendwann werde ich einfach ausgeloggt").
//
// DIE KETTE, gemessen: Der Sammelauftrag zerlegt die Menge in Tranchen zu MARKET_MAX_PER_TRADE
// (1 Mio), bei 400 Mio also 400 Anfragen - und feuerte sie OHNE PAUSE. Der Server deckelt alle
// /api-Anfragen einer Verbindung auf 240 je Minute (globalApiRateLimit, server.js), also war das
// Limit nach einer knappen halben Minute gerissen. Weil es fuer ALLE Routen gilt, traf der 429
// danach auch das Speichern: Dessen 409-Zweig laedt die Server-Version nach, das Nachladen lief
// in denselben 429, und im Fehlerfall stand dort `handleSaveConflict()` - Token geloescht,
// Abmelde-Dialog "Du bist gerade auf einem anderen Geraet aktiv". Ein voruebergehender Fehler
// fuehrte also zur haertesten denkbaren Reaktion.
//
// GEPRUEFT WIRD:
//   1. Quelltext: Der "Nachladen gescheitert"-Zweig meldet nur noch, statt abzumelden; die drei
//      erfolglosen Nachladeversuche (echter Konflikt) melden weiterhin ab. Sammelauftrag hat
//      Pause und 429-Warteschleife.
//   2. AM LAUFENDEN SPIEL, der eigentliche Befund: 409 + Nachladen scheitert (429) ->
//      Sitzung BLEIBT bestehen, kein Abmelde-Overlay, aber die Warnung ist sichtbar.
//   3. GEGENRICHTUNG (sonst waere 2 aus dem falschen Grund gruen): 409 + Nachladen LIEFERT eine
//      fremde Version -> nach drei Versuchen wird wie bisher abgemeldet. Ohne diese Prüfung
//      koennte man den Konflikt-Fall versehentlich ganz abgeschaltet haben.
//   4. Der Sammelauftrag drosselt sich wirklich (gemessene Abstaende zwischen den Anfragen).
//
// GEGENPROBE (Arbeitsregel 1, beide Richtungen): Am Stand v8.540.0 faellt 1a (handleSaveConflict
// steht noch im Nachlade-Zweig), faellt 2 (die Sitzung wird abgemeldet) und faellt 4 (keine Pause).
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) Quelltext ---------------------------------------------------------------------------
{
  const von = JS.indexOf('async function saveGameStateVersioned(');
  const bis = von < 0 ? -1 : JS.indexOf('\n  let saveChain', von);
  check('1-anker: saveGameStateVersioned ist auffindbar', von > 0 && bis > von, { von, bis });
  const block = (von > 0 && bis > von) ? JS.slice(von, bis) : '';
  // Kommentare leeren, bevor gezaehlt wird (Arbeitsregel 33): Die Begruendung im Code zitiert
  // handleSaveConflict woertlich, ein roher Zaehler saehe den Unterschied nicht.
  const ohneKommentar = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const aufrufe = (ohneKommentar.match(/handleSaveConflict\(\)/g) || []).length;
  check('1a: im Speicherpfad bleibt GENAU EIN Abmelde-Aufruf - der fuer den echten Konflikt',
    aufrufe === 1, { aufrufe });
  check('1b: und der haengt an den drei erfolglosen Nachladeversuchen',
    /retryCount >= 3\s*\)\s*\{\s*handleSaveConflict\(\)/.test(ohneKommentar));
  check('1c: scheitert das Nachladen, wird nur gemeldet statt abgemeldet',
    /notifySaveRejected\('Serverstand gerade nicht abrufbar/.test(block));
}
{
  const von = JS.indexOf('async function doMarketTradeChunked(');
  const bis = von < 0 ? -1 : JS.indexOf('\n  // ===== Limit-Orders', von);
  check('1-anker2: doMarketTradeChunked ist auffindbar', von > 0 && bis > von, { von, bis });
  const block = (von > 0 && bis > von) ? JS.slice(von, bis) : '';
  check('1d: der Sammelauftrag pausiert zwischen den Tranchen',
    /MARKET_BULK_PAUSE_MS/.test(block) && /setTimeout/.test(block));
  check('1e: ein 429 laesst ihn warten statt abbrechen',
    /marktLetzteAbsage && marktLetzteAbsage\.status === 429/.test(block));
  check('1f: nach der LETZTEN Tranche wird nicht mehr gewartet',
    /i < chunks - 1/.test(block));
}
const PAUSE_MS = Number((JS.match(/MARKET_BULK_PAUSE_MS = (\d+)/) || [])[1]);
check('1-vorab: die Pause steht als Konstante da', PAUSE_MS > 0, { PAUSE_MS });

// ================================================================== am laufenden Spiel
const SAVE_KEY = 'kepler7-save-v3';
const TOKEN_KEY = 'kepler7_token';

function fixture(){
  return JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true, lastTick:Date.now(),
    nextPlanetEventCheck: Date.now()+36e5, nextTraderCheck: Date.now()+36e5,
    nextRaidTime: Date.now()+36e5, nextFactionGift: Date.now()+36e5,
    resources:{energie:5e5,erz:9e6,kristalle:3e5,deuterium:2e5,antimaterie:1e4,forschungspunkte:2e4},
    buildings:{solar:20,mine:12,labor:8,lager:20,werft:10},
    research:{}, fleet:{ missions:[] }, colonies:{}, activeBasePlanet:'home',
    xp:50000, credits:20000, buffs:[], colonyNames:{}, modules:{}, shipModules:{},
    player:{id:'u',name:'A',avatarKey:null}
  });
}

// steuer: { saveStatus, getStatus, festeVersion } - der Mock reagiert je Lauf anders.
function backend(store, steuer){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p === 'market'){
    // Antwortform aus server.js ABGELESEN (Arbeitsregel 4): { market: { key: {price, basePrice,
    // min, max, impactScale, history} } } - ein erfundenes `prices` liess die Box im Ladezustand
    // stehen, und der Test fand seine Bedienelemente nicht.
    const eine = (preis) => ({ price:preis, basePrice:preis, min:preis/4, max:preis*4, impactScale:1, history:[] });
    return j({ market:{ erz:eine(10), kristalle:eine(20), deuterium:eine(30), energie:eine(5), antimaterie:eine(90) }, event:null });
  }
  if (p === 'market/trade'){
    store.__trades.push(Date.now());
    if (steuer.tradeStatus && store.__trades.length === steuer.tradeBei)
      return j({ error:'Zu viele Anfragen von dieser Verbindung - bitte kurz warten.' }, steuer.tradeStatus);
    let body = {}; try { body = JSON.parse(req.postData()||'{}'); } catch(e){}
    const menge = body.amount || 0;
    store.__verkauft += menge;
    return j({ ok:true, amount:menge, credits:menge*10, avgPrice:10, discount:0,
      newCredits: 20000 + store.__verkauft*10, newResourceAmount: Math.max(0, 9e6 - store.__verkauft),
      priceAfter: 10, saveVersion: 5 });
  }
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){
      if (k === SAVE_KEY && steuer.saveStatus){
        store.__saveVersuche++;
        return j({ error:'Konflikt' }, steuer.saveStatus);
      }
      try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){}
      return j({ ok:true, key:k, version:1 });
    }
    if (k === SAVE_KEY && steuer.getStatus){
      store.__getVersuche++;
      return j({ error:'Zu viele Anfragen' }, steuer.getStatus);
    }
    if (k === SAVE_KEY && steuer.festeVersion !== undefined){
      store.__getVersuche++;
      return j({ key:k, value: store[k], version: steuer.festeVersion });
    }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (p === 'reports'){
    if (req.method() === 'POST') return j({ ok:true });
    return j({ reports: [] });
  }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|notifications/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

async function spiel(browser, steuer){
  const store = { __trades: [], __verkauft: 0, __saveVersuche: 0, __getVersuche: 0 };
  store[SAVE_KEY] = fixture();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store, steuer || {}));
  await page.addInitScript(k => localStorage.setItem(k, 'tok'), TOKEN_KEY);
  /* #log ueberschreibt sich mit JEDER Meldung selbst - der erste Anlauf dieses Tests las den
     Endstand und fand dort ein Planeten-Ereignis statt der geprueften Warnung (dieselbe Falle wie
     bei test_fundort_knopf, CLAUDE.md Regel 47). Deshalb wird MITGESCHNITTEN. */
  await page.addInitScript(() => {
    window.__logZeilen = [];
    const start = () => { const box = document.getElementById('log'); if (!box) return false;
      const merke = () => { const t=(box.innerText||'').trim(); if (t && window.__logZeilen[window.__logZeilen.length-1]!==t) window.__logZeilen.push(t); };
      new MutationObserver(merke).observe(box,{childList:true,characterData:true,subtree:true}); merke(); return true; };
    if (!start()) document.addEventListener('DOMContentLoaded', start);
  });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o=document.getElementById(id); if(o) o.style.display='none'; }); });
  return { ctx, page, store, errs };
}
const sitzung = (page) => page.evaluate(k => ({
  token: localStorage.getItem(k),
  overlay: !!(document.getElementById('conflictOverlay') && document.getElementById('conflictOverlay').style.display === 'flex'),
  logText: ((window.__logZeilen||[]).join('\n') + '\n' + ((document.getElementById('log')||{}).innerText||''))
}), TOKEN_KEY);

(async () => {
  const browser = await starteBrowser();

  // ---- 2) DER BEFUND: 409 + Nachladen scheitert am Rate-Limit -> Sitzung bleibt --------------
  {
    const t = await spiel(browser, { saveStatus: 409, getStatus: 429 });
    const vorher = await sitzung(t.page);
    check('2-vorab: die Sitzung steht vor dem Speicherversuch', !!vorher.token && vorher.overlay === false, vorher.token ? 'Token da' : 'KEIN Token');
    // Auf mindestens einen abgelehnten Speicherversuch warten (das Spiel speichert im 10s-Takt).
    for (let i = 0; i < 50 && t.store.__saveVersuche === 0; i++) await t.page.waitForTimeout(500);
    check('2-vorab2: der Server hat einen Speicherversuch mit 409 abgelehnt', t.store.__saveVersuche > 0,
      { saveVersuche: t.store.__saveVersuche, getVersuche: t.store.__getVersuche });
    await t.page.waitForTimeout(2500);
    const nachher = await sitzung(t.page);
    check('2a: die Sitzung bleibt bestehen - ein Rate-Limit meldet niemanden ab',
      !!nachher.token, { token: nachher.token ? 'da' : 'WEG' });
    check('2b: und es erscheint kein "anderes Geraet"-Dialog', nachher.overlay === false, nachher.overlay);
    check('2c: dass gerade nicht gespeichert wird, steht aber sichtbar im Protokoll',
      /NICHT gespeichert/.test(nachher.logText), nachher.logText.slice(0, 160));
    await t.ctx.close();
  }

  // ---- 3) GEGENRICHTUNG: echter Konflikt meldet weiterhin ab --------------------------------
  {
    // Der Server antwortet auf das Nachladen sauber, nennt aber dauerhaft eine FREMDE Version -
    // genau das Bild einer zweiten Sitzung, die weiterschreibt.
    const t = await spiel(browser, { saveStatus: 409, festeVersion: 99 });
    for (let i = 0; i < 60 && !(await sitzung(t.page)).overlay; i++) await t.page.waitForTimeout(500);
    const s = await sitzung(t.page);
    check('3a: bei einem ECHTEN Konflikt wird weiterhin abgemeldet', s.overlay === true,
      { overlay: s.overlay, saveVersuche: t.store.__saveVersuche, getVersuche: t.store.__getVersuche });
    check('3b: und das Token ist dabei entfernt', !s.token, { token: s.token ? 'noch da' : 'weg' });
    check('3c: es wurde wirklich mehrfach nachgeladen, bevor aufgegeben wurde',
      t.store.__getVersuche >= 3, { getVersuche: t.store.__getVersuche });
    await t.ctx.close();
  }

  // ---- 4) Der Sammelauftrag drosselt sich ---------------------------------------------------
  {
    const t = await spiel(browser, {});
    // 3 Tranchen (3 Mio bei 1 Mio je Tranche) - genug fuer zwei Pausen, kurz genug fuer einen Test.
    // doMarketTradeChunked lebt im Modulscope - der Auftrag wird ueber die Oberflaeche gestartet.
    await t.page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="markt"]'); if (b) b.click(); });
    await t.page.waitForTimeout(1500);
    // Selektoren aus der Spieldatei ABGELESEN (Arbeitsregel 4): data-market-amt / data-market-sell.
    const gestartet = await t.page.evaluate(() => {
      const box = document.getElementById('marketBox');
      if (!box) return 'keine Marktbox';
      const feld = box.querySelector('[data-market-amt="erz"]');
      const knopf = box.querySelector('[data-market-sell="erz"]');
      if (!feld) return 'Mengenfeld nicht gefunden';
      if (!knopf) return 'Verkaufsknopf nicht gefunden';
      feld.value = '3000000';
      feld.dispatchEvent(new Event('input', { bubbles:true }));
      knopf.click();
      return 'geklickt';
    });
    check('4-vorab: der Sammelauftrag liess sich ueber die Oberflaeche starten',
      gestartet === 'geklickt', { gestartet });
    if (gestartet === 'geklickt'){
      for (let i = 0; i < 40 && t.store.__trades.length < 3; i++) await t.page.waitForTimeout(500);
      check('4a: es wurden mehrere Tranchen gehandelt', t.store.__trades.length >= 3, { tranchen: t.store.__trades.length });
      if (t.store.__trades.length >= 3){
        const abstaende = [];
        for (let i = 1; i < t.store.__trades.length; i++) abstaende.push(t.store.__trades[i] - t.store.__trades[i-1]);
        const kleinster = Math.min(...abstaende);
        // Gemessen gegen die Konstante aus der Datei, nicht gegen eine eingetippte Zahl
        // (Arbeitsregel 2). Toleranz nach unten, weil Timer nie exakt feuern.
        check('4b: zwischen den Tranchen liegt die Drosselpause (kein Anfragen-Sturm)',
          kleinster >= PAUSE_MS * 0.8, { kleinster, erwartetMindestens: Math.round(PAUSE_MS*0.8), abstaende });
      }
    }
    check('4c: keine JS-Fehler', t.errs.length === 0, t.errs.slice(0,3));
    await t.ctx.close();
  }

  await browser.close();
  ende();
})();
