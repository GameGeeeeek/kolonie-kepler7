// Modulbörse und der schmale Speicherpfad (05.09.2026) - die zwei Nachzüge zu v8.689.0.
//
// TEIL 1: DIE MODULBÖRSE TRÄGT DIESELBE LÜCKE WIE DER MARKT.
// Gemessen an drei Routen im Backend:
//   /modulemarket/list   prüft `moduleInvOf(save)` gegen den GESPEICHERTEN Spielstand
//   /modulemarket/buy    prüft `save.credits` gegen den GESPEICHERTEN Spielstand
//   /modulemarket/cancel liest ihn und schreibt ihn zurück
// Der Client speichert im 10-Sekunden-Takt, und drei der vier Modul-Vergabestellen schreiben
// `state.modules` OHNE eigenes Speichern - gemessen: grantRandomModule, grantRandomShipModule
// und grantBossSetModule tun es nicht, nur gibModul tut es. Wer ein frisch gefundenes Modul in
// diesem Fenster einstellt, bekommt „Dieses Modul liegt nicht (mehr) in deinem Inventar" für
// eines, das seine Sammlung anzeigt.
//
// TEIL 2: DER SCHMALE SPEICHERPFAD.
// `doSave()` schreibt VIER Schlüssel nacheinander: den Spielstand und drei Rundfunk-Schlüssel
// (leaderboard/missions/moondefense), die andere Spieler lesen. Seit v8.689.0 hängt jeder
// Handel an einem solchen Speichervorgang - das ist die Wartezeit des Spielers, und vier
// abgewartete Schreibvorgänge statt einem sind dafür der falsche Preis. `save({nurSpielstand:
// true})` schreibt nur den Spielstand; die Rundfunk-Schlüssel holt der reguläre Takt gleich
// wieder nach, sie interessieren in diesem Moment niemanden.
//
// GEPRÜFT WIRD:
//   1. Quelltext: save/doSave nehmen opts; der schmale Pfad kehrt NACH dem Spielstand und VOR
//      den Rundfunk-Schlüsseln zurück; Markt und alle drei Börsen-Aufrufe benutzen ihn.
//   2. AM LAUFENDEN SPIEL: Vor einer Börsen-Anfrage wird der Spielstand geschrieben.
//   3. AM LAUFENDEN SPIEL: In dem Fenster zwischen Klick und Anfrage steht KEIN
//      Rundfunk-Schlüssel - das ist die Messung für den schmalen Pfad.
//   4. GEGENRICHTUNG: Scheitert das Speichern, geht KEINE Börsen-Anfrage raus, und der Spieler
//      erfährt den Grund.
//   5. GEGENRICHTUNG: Der reguläre 10-Sekunden-Takt schreibt weiterhin ALLE vier Schlüssel -
//      der schmale Pfad darf die Rundfunk-Schlüssel nicht dauerhaft abschalten. Ohne diese
//      Prüfung wäre 3 auch dann grün, wenn jemand sie versehentlich ganz entfernt.
//
// GEGENPROBE steht am Dateiende.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) Quelltext ----------------------------------------------------------------------------
{
  /* Der Anker fuers ENDE ist der letzte Rundfunk-Schluessel plus das `return saveResult;`
     dahinter - beides liegt definitionsgemaess IN doSave. `let saveChain` taugt nicht: Es
     steht VOR der Funktion (erster Anlauf, gemessen: indexOf lieferte -1, und der Abschnitt
     mass daraufhin einen leeren Block). Beide Anker werden vor Gebrauch geprueft. */
  const von = JS.indexOf('async function doSave(');
  const iMond = von < 0 ? -1 : JS.indexOf("storageSet('moondefense:", von);
  const iEnde = iMond < 0 ? -1 : JS.indexOf('return saveResult;', iMond);
  const ende_ = iEnde < 0 ? -1 : iEnde + 30;
  check('1-anker: doSave ist auffindbar und seine beiden Endanker existieren',
    von > 0 && iMond > von && ende_ > von, { von, moondefense: iMond, ende: ende_ });
  const block = (von > 0 && ende_ > von) ? JS.slice(von, ende_) : '';
  const ohneK = block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  check('1a: doSave nimmt Optionen entgegen', /async function doSave\(opts\)/.test(ohneK));
  check('1b: der schmale Pfad kehrt früh zurück',
    /if \(opts && opts\.nurSpielstand\) return saveResult;/.test(ohneK));
  /* Die REIHENFOLGE ist der ganze Punkt: nach dem Spielstand, vor den Rundfunk-Schlüsseln.
     Stünde die Rückkehr davor, käme der Aufrufer ohne gespeicherten Stand zurück - und der
     Handel liefe wieder auf veralteter Grundlage. */
  const iStand = ohneK.indexOf('saveGameStateVersioned(JSON.stringify(state))');
  const iFrueh = ohneK.indexOf('opts.nurSpielstand');
  const iRundfunk = ohneK.indexOf("storageSet('leaderboard:'");
  check('1c-anker: Spielstand-Schreibung und Rundfunk-Schlüssel sind auffindbar',
    iStand > 0 && iRundfunk > 0, { stand: iStand, rundfunk: iRundfunk });
  check('1c: die frühe Rückkehr steht NACH dem Spielstand und VOR den Rundfunk-Schlüsseln',
    iStand > 0 && iFrueh > iStand && iFrueh < iRundfunk,
    { stand: iStand, frueheRueckkehr: iFrueh, rundfunk: iRundfunk });
}
{
  check('1d: save() reicht die Optionen an doSave durch',
    /function save\(opts\)\{[\s\S]{0,200}?doSave\(opts\)/.test(JS.replace(/\/\*[\s\S]*?\*\//g, '')));
  const ohneK = JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  /* JE FUNKTION pruefen, nicht ueber die ganze Datei (Durchsicht 06.09.2026). Ein Zaehler mit
     Schwelle ">= 2" ueber drei Vorkommen kann nicht sehen, wenn AUSGERECHNET der Sammelauftrag
     auf den vollen Speichervorgang zurueckfaellt - etwa beim Aufloesen eines Merge-Konflikts
     gegen den Text vor 8.690.0. Genau diese Regression soll die Aenderung verhindern. */
  for (const fn of ['doMarketTrade(', 'doMarketTradeChunked(']){
    const i = ohneK.indexOf('async function ' + fn);
    const j = i < 0 ? -1 : ohneK.indexOf('\n  async function ', i + 10);
    const block = (i >= 0) ? ohneK.slice(i, j > i ? j : i + 6000) : '';
    check('1e-' + fn.replace('(', '') + ': benutzt den schmalen Pfad',
      i >= 0 && /save\(\{ nurSpielstand: true \}\)/.test(block), { gefunden: i >= 0 });
  }
  /* EINE Stelle für alle drei Börsen-Aufrufe, nicht drei Kopien - und alle drei benutzen sie.
     Ein vierter Aufruf, der sie vergisst, fällt hier auf. */
  check('1f: es gibt EINE gemeinsame Sicherung für die Börse',
    /async function moduleMarketSpielstandSichern\(/.test(ohneK));
  const nutzer = (ohneK.match(/await moduleMarketSpielstandSichern\(/g) || []).length;
  check('1g: und alle DREI Börsen-Aufrufe benutzen sie', nutzer === 3, { nutzer });
  for (const route of ['list', 'cancel', 'buy']){
    const i = ohneK.indexOf("backendFetch('/modulemarket/" + route + "'");
    const davor = i > 0 ? ohneK.slice(Math.max(0, i - 400), i) : '';
    check('1h-' + route + ': die Sicherung steht VOR der Anfrage',
      i > 0 && /moduleMarketSpielstandSichern\(/.test(davor), { i });
  }
}

// ================================================================== am laufenden Spiel
const SAVE_KEY = 'kepler7-save-v3';
const TOKEN_KEY = 'kepler7_token';

function fixture(){
  return JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true, lastTick:Date.now(),
    nextPlanetEventCheck: Date.now()+36e5, nextTraderCheck: Date.now()+36e5,
    nextRaidTime: Date.now()+36e5, nextFactionGift: Date.now()+36e5,
    resources:{energie:5e4,erz:5e5,kristalle:3e5,deuterium:2e5,antimaterie:1e4,forschungspunkte:2e4},
    buildings:{solar:20,mine:12,labor:8,lager:20,werft:10},
    research:{}, fleet:{ missions:[] }, colonies:{}, activeBasePlanet:'home',
    xp:50000, credits:500000, buffs:[], colonyNames:{}, modules:{}, shipModules:{},
    player:{id:'u',name:'A',avatarKey:null}
  });
}

/* Der Mock fuehrt ein ABLAUFPROTOKOLL mit Zeitstempeln. Nur damit laesst sich die Frage
   beantworten, die Teil 2 stellt: nicht "wie oft wurde geschrieben", sondern "was wurde
   ZWISCHEN dem Klick und der Anfrage geschrieben". Der reguläre 10-Sekunden-Takt schreibt
   nebenher weiter; eine blosse Zaehlung koennte ihn nicht davon trennen. */
function backend(store, steuer){ return async r => {
  steuer = steuer || {};
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p === 'market'){
    const eine = (preis) => ({ price:preis, basePrice:preis, min:preis/4, max:preis*4, impactScale:1, history:[] });
    return j({ market:{ erz:eine(10), kristalle:eine(20), deuterium:eine(30), energie:eine(5), antimaterie:eine(90) }, event:null });
  }
  if (p === 'modulemarket'){
    /* EIN FREMDES Angebot (mine:false, bezahlbar) - sonst rendert die Anzeige gar keinen
       Kaufen-Knopf, und Pruefung 4 waere gruen, weil nichts zu klicken war statt weil die
       Sicherung greift. Genau so ist der erste Anlauf hereingefallen (gemessen: vorher 0,
       nachher 0). Die Feldnamen sind aus der Anzeige ABGELESEN, nicht geraten. */
    return j({ listings: [{ id:'ang1', instKey:'produktion:epic:3', isShip:false, mine:false,
      price:2000, sellerName:'Jemand' }],
      limits: { minPrice:1000, maxPrice:5000000, maxPerUser:5, feePct:0.05 } });
  }
  if (p.startsWith('modulemarket/')){
    store.__ablauf.push({ typ:'boerse', route:p, t: Date.now() });
    return j({ ok:true, listings: [], limits: { minPrice:1000, maxPrice:5000000, maxPerUser:5, feePct:0.05 } });
  }
  if (p === 'market/trade'){
    store.__ablauf.push({ typ:'handel', t: Date.now() });
    let body = {}; try { body = JSON.parse(req.postData()||'{}'); } catch(e){}
    return j({ ok:true, action: body.action, resource: body.resource, amount: body.amount,
      credits: 1, avgPrice:5, discount:0, priceBefore:5, priceAfter:5, saveVersion: ++store.__version,
      newCredits: 500000, newResourceAmount: 1000 });
  }
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){
      if (k === SAVE_KEY && steuer.saveStatus){ store.__saveAblehnungen++; return j({ error:'Fehler' }, steuer.saveStatus); }
      store.__ablauf.push({ typ:'put', key:k, t: Date.now() });
      try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){}
      if (k === SAVE_KEY) store.__version++;
      return j({ ok:true, key:k, version: store.__version });
    }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version: store.__version });
    return j({ e:1 }, 404);
  }
  if (p === 'reports'){ if (req.method() === 'POST') return j({ ok:true }); return j({ reports: [] }); }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|notifications/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

async function spiel(browser, steuer){
  const store = { __ablauf: [], __saveAblehnungen: 0, __version: 1 };
  store[SAVE_KEY] = fixture();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store, steuer));
  await page.addInitScript(k => localStorage.setItem(k, 'tok'), TOKEN_KEY);
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

const mitschnitt = (page) => page.evaluate(() =>
  ((window.__logZeilen||[]).join('\n') + '\n' + ((document.getElementById('log')||{}).innerText||'')));

/* Der Marktverkauf ist der bequemste Ausloeser fuer die Messung: Er geht seit v8.689.0
   ueber genau denselben schmalen Speicherpfad wie die Boerse, und er laesst sich ohne
   Modulbestand ausloesen. */
const verkaufe = (page) => page.evaluate(() => {
  const pct = document.querySelector('[data-market-pct="energie"][data-pct="25"]');
  if (pct) pct.click();
  const btn = document.querySelector('[data-market-sell="energie"]');
  if (btn) btn.click();
});
const marktOeffnen = async (page) => {
  await page.evaluate(() => { const b = document.querySelector('[data-tab="markt"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
};

/* EINE Quelle fuer die drei Rundfunk-Schluessel: Das Muster wird daraus GEBAUT, damit
   Erkennung (Pruefung 3) und Behauptung (Pruefung 5) nicht auseinanderlaufen koennen. */
const RUNDFUNK_ARTEN = ['leaderboard', 'missions', 'moondefense'];
const RUNDFUNK = new RegExp('^(' + RUNDFUNK_ARTEN.join('|') + '):');

(async () => {
  const browser = await starteBrowser();

  // ---- 2+3) Vor der Anfrage wird geschrieben - aber NUR der Spielstand ----------------------
  {
    const t = await spiel(browser);
    await marktOeffnen(t.page);
    /* Auf einen VOLLSTAENDIGEN Takt warten, nicht auf seinen ersten Schreibvorgang (Durchsicht
       06.09.2026). Ein Takt schreibt vier Schluessel nacheinander, wenige Millisekunden
       auseinander; diese Schleife prueft alle 500 ms. Faellt die Grenze zwischen den ersten und
       den letzten Schreibvorgang, stuende t0 mitten im Takt - dessen drei Rundfunk-Schluessel
       landeten dann IM Messfenster, und Pruefung 3 waere rot an korrektem Code. Der letzte
       Schluessel des Takts ist ein Rundfunk-Schluessel, auf den wird gewartet. */
    for (let i = 0; i < 40 && !t.store.__ablauf.some(e => e.typ === 'put' && RUNDFUNK.test(e.key || '')); i++) await t.page.waitForTimeout(500);
    check('2-vorab: das Spiel hat einen vollständigen Takt geschrieben',
      t.store.__ablauf.some(e => e.typ === 'put' && e.key === SAVE_KEY) &&
      t.store.__ablauf.some(e => e.typ === 'put' && RUNDFUNK.test(e.key || '')),
      { geschrieben: t.store.__ablauf.filter(e => e.typ === 'put').map(e => e.key) });
    await t.page.waitForTimeout(300);   // Rest des Takts sicher abfliessen lassen

    const t0 = Date.now();
    await verkaufe(t.page);
    await t.page.waitForTimeout(2000);
    const handel = t.store.__ablauf.find(e => e.typ === 'handel' && e.t >= t0);
    check('2a: der Handel hat stattgefunden', !!handel, { ablauf: t.store.__ablauf.slice(-6) });
    /* OHNE `handel` gaebe es kein Fenster - und ein leeres Fenster enthaelt trivial keinen
       Rundfunk-Schluessel. Pruefung 3 waere dann gruen, ohne etwas gemessen zu haben; genau die
       Falle, vor der der Kopf dieser Datei bei 4a warnt. Deshalb haengt 3 ausdruecklich daran,
       DASS gemessen wurde. */
    const fenster = handel ? t.store.__ablauf.filter(e => e.t >= t0 && e.t <= handel.t) : [];
    check('2b: im Fenster vor der Anfrage steht ein Spielstand-Schreibvorgang',
      fenster.some(e => e.typ === 'put' && e.key === SAVE_KEY), fenster);
    /* DIE MESSUNG FUER DEN SCHMALEN PFAD: Im selben Fenster darf KEIN Rundfunk-Schluessel
       stehen. Mit dem vollen doSave() waeren es drei. */
    const rundfunk = fenster.filter(e => e.typ === 'put' && RUNDFUNK.test(e.key || ''));
    check('3: und KEIN Rundfunk-Schlüssel - der Handel wartet auf einen Schreibvorgang, nicht vier',
      !!handel && fenster.length > 0 && rundfunk.length === 0,
      { gemessen: !!handel, rundfunkImFenster: rundfunk.map(e => e.key), fenster: fenster.length });
    check('2c: keine Skriptfehler', t.errs.length === 0, t.errs.slice(0, 3));

    // ---- 5) GEGENRICHTUNG: der regulaere Takt schreibt weiterhin ALLE vier -----------------
    /* Ohne diese Pruefung waere 3 auch dann gruen, wenn jemand die Rundfunk-Schluessel ganz
       entfernt - dann saehen andere Spieler die eigene Flotte und die eigenen Missionen nie
       wieder, und kein Test haette es gemerkt. */
    /* Auf einen Takt warten, der NACH t1 vollstaendig ist: Erst den Spielstand, dann einen
       Rundfunk-Schluessel abwarten. Nur auf den Rundfunk-Schluessel zu warten reichte nicht -
       laege t1 mitten im Takt, fehlte der Spielstand in `spaeter`, und die Pruefung waere rot
       an korrektem Code (Durchsicht 06.09.2026). */
    const t1 = Date.now();
    const taktVoll = () => t.store.__ablauf.some(e => e.t > t1 && e.key === SAVE_KEY)
      && RUNDFUNK_ARTEN.every(a => t.store.__ablauf.some(e => e.t > t1 && (e.key || '').startsWith(a + ':')));
    for (let i = 0; i < 40 && !taktVoll(); i++) await t.page.waitForTimeout(500);
    const spaeter = t.store.__ablauf.filter(e => e.t > t1 && e.typ === 'put');
    const arten = new Set(spaeter.map(e => (e.key || '').split(':')[0]));
    /* ALLE DREI verlangen, nicht nur leaderboard (Codex-Durchsicht 06.09.2026). Die Behauptung
       dieser Pruefung ist "der Takt schreibt weiterhin alle vier Schluessel"; wer nur einen
       davon abfragt, laesst genau den Fall durch, gegen den sie steht - dass der schmale Pfad
       spaeter versehentlich auch im vollen Lauf greift und missions/moondefense wegfallen.
       Die Liste kommt aus RUNDFUNK_ARTEN, damit Muster und Behauptung nicht auseinanderlaufen. */
    check('5: der reguläre Takt schreibt weiterhin Spielstand UND ALLE Rundfunk-Schlüssel',
      spaeter.some(e => e.key === SAVE_KEY) && RUNDFUNK_ARTEN.every(a => arten.has(a)),
      { geschrieben: [...arten], erwartet: ['kepler7-save-v3', ...RUNDFUNK_ARTEN] });
    await t.ctx.close();
  }

  // ---- 4) GEGENRICHTUNG: scheitert das Speichern, geht keine Börsen-Anfrage raus ------------
  {
    /* 500 und nicht 409: Ein 409 laesst das Spiel dreimal nachladen und danach
       handleSaveConflict() feuern - der Spieler waere abgemeldet, und "keine Anfrage" waere
       gruen, ohne etwas ueber diesen Fix auszusagen (dieselbe Falle wie in
       test_markt_verkauf_speicherstand.js Abschnitt 5). */
    /* Die Modulboerse-Anzeige sitzt im MARKT-Tab, nicht bei den Offizieren (dort wird nur der
       Preis an der Modulkarte eingegeben) - im ersten Anlauf hier falsch geklickt, gemessen:
       kein Knopf, und 4a waere gruen gewesen, weil nichts zu klicken war. */
    const boerseOeffnen = async (page) => { await marktOeffnen(page); await page.waitForTimeout(600); };
    const kaufKlick = (page) => page.evaluate(() => {
      const btn = document.querySelector('[data-mm-buy]');
      if (btn) btn.click();
      return !!btn;
    });

    /* POSITIVE GEGENKONTROLLE ZUERST: Bei gesundem Speichern MUSS der Klick eine Anfrage
       ausloesen. Ohne sie saehe 4a genauso aus, wenn der Knopf gar nicht existiert. */
    {
      const ok = await spiel(browser);
      await boerseOeffnen(ok.page);
      const gabKnopf = await kaufKlick(ok.page);
      await ok.page.waitForTimeout(1800);
      check('4-vorab0: der Kaufen-Knopf ist da und löst bei gesundem Speichern eine Anfrage aus',
        gabKnopf && ok.store.__ablauf.some(e => e.typ === 'boerse'),
        { knopf: gabKnopf, anfragen: ok.store.__ablauf.filter(e => e.typ === 'boerse').length });
      await ok.ctx.close();
    }

    const t = await spiel(browser, { saveStatus: 500 });
    await boerseOeffnen(t.page);
    for (let i = 0; i < 40 && t.store.__saveAblehnungen === 0; i++) await t.page.waitForTimeout(500);
    check('4-vorab: der Server lehnt das Speichern ab', t.store.__saveAblehnungen > 0,
      { ablehnungen: t.store.__saveAblehnungen });
    const gabKnopf = await kaufKlick(t.page);
    check('4-vorab2: auch hier ist der Knopf da - sonst misst 4a nichts', gabKnopf, { gabKnopf });
    await t.page.waitForTimeout(1800);
    check('4a: es ging keine Börsen-Anfrage raus',
      t.store.__ablauf.filter(e => e.typ === 'boerse').length === 0,
      t.store.__ablauf.filter(e => e.typ === 'boerse'));
    check('4b: und der Spieler erfährt den Grund',
      /nicht speichern|abgebrochen/i.test(await mitschnitt(t.page)),
      (await mitschnitt(t.page)).slice(-200));
    await t.ctx.close();
  }

  await browser.close();
  ende();
})();

/* GEGENPROBE, GEMESSEN am 05.09.2026 gegen origin/main (6e58ba6, also MIT v8.689.0)
   via KEPLER_SPIELDATEI auf eine Kopie: 14 Pruefungen fallen (gemessen nach der Durchsicht vom
   06.09.2026, die 1e in zwei je Funktion gescopte Pruefungen aufgeteilt hat - vorher 13).
     1a-1h - weder Optionen noch schmaler Pfad noch gemeinsame Sicherung existieren dort.
     3     - der volle doSave schreibt drei Rundfunk-Schluessel ins Fenster vor dem Handel.
     4a/4b - die Boerse fragt dort ohne jede Sicherung an, auch bei abgelehntem Speichern.
   GRUEN bleiben dort die beiden Anker, 2-vorab, 2a, 2b, 2c, 5 und die drei 4-vorab-Kontrollen.
   Das ist Absicht und der eigentliche Wert dieser Auswahl:
     2b bleibt gruen, weil v8.689.0 schon VOR dem Handel speichert - Pruefung 3 misst also
       wirklich nur den Unterschied zwischen "einem" und "vier" Schreibvorgaengen, nicht das,
       was der vorige PR bereits gebracht hat.
     5 bleibt gruen, weil der reguläre Takt die Rundfunk-Schluessel nie verloren hat.
     4-vorab0 bleibt gruen und ist der Grund, warum 4a etwas belegt: Der Knopf ist da und
       feuert bei gesundem Speichern. Ohne diese Kontrolle waere 4a auch dann gruen, wenn gar
       nichts zu klicken gewesen waere - genau so ist der erste Anlauf hereingefallen (zweimal:
       erst ohne Angebot in der Boerse, dann im falschen Tab). */
