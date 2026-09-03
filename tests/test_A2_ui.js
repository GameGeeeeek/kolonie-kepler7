// Der Wrackkonvoi im laufenden Spiel: Karte, Kartenmenü, Vorschau, Mission, Bergung (A2, 28.08.2026).
//
//   node tests/test_A2_ui.js
//
// Er misst am GERENDERTEN Spiel, nicht am Quelltext - „im DOM vorhanden" ist nicht „für den
// Spieler sichtbar" (Arbeitsregel 55).
//
// A2 ist SINGLE-TIER und FLACH: kein Schwäche-Faktor, keine Konterklasse, keine Stufentabelle. Die
// Beute reist als flacher `k.beute` IN jedem Konvoi-Objekt. Deshalb hat dieser Test - anders als
// test_nest_ui - KEINE Schwäche-PAAR-Messung; Abschnitt 6 misst die WIRKUNG stattdessen an zwei
// Konvois mit verschiedenem Lebenspunkte-Stand UND verschiedener `beute`.
//
// GEPRUEFT WIRD:
//   1. Der Konvoi erscheint als eigener Kartenknoten, und zwar SICHTBAR. Ohne Konvoi im
//      Galaxie-Zustand ist er nicht da (Gegenrichtung 1c).
//   2. Sein Kartenmenü nennt Lebenspunkte, die Untertitel-Zeile „Wandernde Beute" und den
//      Angriffs-Eintrag „Konvoi angreifen".
//   3. Die Vorschau nennt die A2-Aussage („Was ankommt, zählt auf deinen Anteil an der Bergung")
//      und die Verlustspanne - NICHT eine Schwäche.
//   4. Der Missionsstart legt eine Mission mit `zielId` (NICHT `nestId`) und `system` an. Beide
//      braucht der Server: die Kennung, um das Ziel zu finden, das System, um „entkommen" zu
//      erkennen. `targetId` trägt das SYSTEM (`k.sys`), damit die Missionskarte einen Namen hat.
//   5. Die Missionskarte nennt „Wrackkonvoi" - ohne eigenen Zweig stünde dort „Erkundungsziel".
//   6. Der Füllbalken und die Bergungszeile MESSEN: zwei Läufe mit anderem Stand und anderer Beute
//      müssen einen anderen Balken und eine andere Bergungszeile zeigen (Regel 61/62).
//   7. Der `wrackkonvoi`-Zweig von claimPendingRewards bucht die Bergung: Sternenessenz,
//      Kampfpunkte und die zwei Bergungsmodule (Standort + Schiff). Gemessen als PAAR gegen einen
//      Lauf OHNE die Belohnung.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
check('0a: der Client-Vertrag heisst galaxyCache.wrackKonvois', /galaxyCache\.wrackKonvois/.test(JS));
check('0b: es gibt einen eigenen Kartenknoten', /data-map-konvoi/.test(JS));
check('0c: und eine Angriffsmission', /type:'konvoi-angriff'/.test(JS));

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
const KONVOI_ID = 'konvoi-test-1';

function konvoi(opt){
  /* Die Ueberschreibungen sind die Messvorrichtung fuer Abschnitt 6: ZWEI Laeufe, die sich in
     Lebenspunkten UND Beute unterscheiden, muessen einen anderen Balken und eine andere
     Bergungszeile zeigen. Ein Lauf allein waere auch von einem fest verdrahteten Balken erfuellt
     (Regel 61). `schlaege` bleibt leer, sonst greift die Abklingzeit und der Eintrag ist gesperrt. */
  return Object.assign({ id: KONVOI_ID, sys:SYS, lp:260000, lpMax:400000,
    seit: Date.now() - 3600000, schlaege:{},
    beute:{ essenz:12, kampfpunkte:18, xp:200, credits:5000, modulChance:0.3 } }, opt || {});
}

function backend(store, opt){
  opt = opt || {};
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[],
      alienNester:[], wrackKonvois: opt.ohneKonvoi ? [] : [konvoi(opt.konvoi)] });
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{} } } });
    if (p === 'konvoi/angriff'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__schlag = (store.__schlag || []).concat([body]);
      return j({ ok:true, schaden:9000, gefallen:false, lp:251000, lpMax:400000,
        eigeneVerluste:{ cruisers:12 }, anteil:0, teilnehmer:1, grund:null });
    }
    // Die eigentliche Messvorrichtung fuer Abschnitt 7: der Server liefert die vorgemerkte
    // Belohnung GENAU EINMAL, danach nichts mehr - genau wie der echte Server, der den Eintrag
    // beim Abholen mit list.shift() entfernt.
    if (p === 'pending-rewards/claim'){
      if (opt.pendingReward && !store.__pendingGeliefert){ store.__pendingGeliefert = true; return j({ reward: opt.pendingReward }); }
      return j({ reward: null });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'reports'){
      if (req.method() === 'POST'){ try { (store.__berichte = store.__berichte || []).unshift(JSON.parse(req.postData()||'{}').report || {}); } catch(e){} return j({ ok:true }); }
      return j({ reports: store.__berichte || [] });
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

async function tab(browser, startSave, opt){
  const store = {};
  if (startSave) store[SAVE_KEY] = startSave;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store, opt));
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
/* Misst die Fuellbalken des offenen Kartenmenues. Gemessen wird die SICHTBARE Geometrie
   (Regel 55) und der Anteil, den die Fuellung von ihrer Schiene einnimmt - nicht das
   style-Attribut. Dieselbe Hausform .progress-outer wie beim Nest-Menue (GR-3). */
async function balkenMessen(page){
  return page.evaluate(() => {
    const m = document.querySelector('.kmenu');
    if (!m) return { menue:false, balken:[], zeilen:[], text:'' };
    const balken = [...m.querySelectorAll('.progress-outer')].map(b => {
      const fuell = b.querySelector('.progress-inner');
      const rs = b.getBoundingClientRect();
      const rf = fuell ? fuell.getBoundingClientRect() : null;
      return {
        hoehe: Math.round(rs.height),
        schienenBreite: Math.round(rs.width),
        fuellBreite: rf ? Math.round(rf.width) : 0,
        anteil: (rs.width > 0 && rf) ? +(rf.width / rs.width).toFixed(3) : null,
        imGriff: !!b.closest('details') && !(b.closest('details')||{}).open
      };
    });
    const zeilen = [...m.querySelectorAll('.bmeta')].map(d => (d.textContent || '').trim());
    return { menue:true, balken, zeilen, text: m.textContent || '' };
  });
}
async function aufKarte(t){
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t.page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(t.page, SYS);
}

// Zieht die von der Bergung betroffenen Groessen aus einem Spielstand - fuer die PAAR-Messung in
// Abschnitt 7. Die zwei Modul-Toepfe werden ueber ihren Instanz-Schluessel-PREFIX geprueft: der
// Server wuerfelt den Wurf, also steht die genaue Kennung nicht fest, wohl aber `kv_bergungs*:`.
function werte(stand){
  const modK = Object.keys(stand.modules || {});
  const shipK = Object.keys(stand.shipModules || {});
  return {
    essenz: ((stand.ascension || {}).essence) || 0,
    kampfpunkte: stand.battlePoints || 0,
    standortModul: modK.some(k => k.startsWith('kv_bergungslogik:')),
    schiffModul: shipK.some(k => k.startsWith('kv_bergungspanzer:'))
  };
}

(async () => {
  const browser = await starteBrowser();

  const roh = await tab(browser);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0d: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  /* Die Fixture: A2 hat keine Schwaeche, es genuegen Kampfschiffe im Verband (Kreuzer). Uhren weit
     in die Zukunft, damit kein Zufallsereignis dazwischenfunkt (Regel 18); die Ereignis-Kartenebene
     ausdruecklich an, damit der Konvoi-Knoten gezeichnet wird. */
  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    for (const k of Object.keys(st.fleet)) if (typeof st.fleet[k] === 'number') st.fleet[k] = 0;
    st.fleet.cruisers = 120;
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    st.karteEbenen = Object.assign({}, st.karteEbenen, { ereignisse:true });
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 400000;
    return JSON.stringify(st);
  }

  // ---- 1) Der Kartenknoten -------------------------------------------------------------------
  const t1 = await tab(browser, fixture());
  await t1.page.waitForTimeout(2500);
  await aufKarte(t1);
  const sicht = await t1.page.evaluate(() => {
    const n = document.querySelector('[data-map-konvoi]');
    if (!n) return { da:false };
    const b = n.getBoundingClientRect();
    return { da:true, breite: Math.round(b.width), hoehe: Math.round(b.height), titel: (n.querySelector('title')||{}).textContent || '' };
  });
  check('1a: der Wrackkonvoi ist auf der Karte SICHTBAR', sicht.da && sicht.breite > 4 && sicht.hoehe > 4, sicht);
  check('1b: sein Titel nennt den Konvoi und den Rumpf-Stand',
    /Wrackkonvoi/.test(sicht.titel||'') && /Rumpf/.test(sicht.titel||''), { titel: sicht.titel });

  // ---- 2) Das Kartenmenü ---------------------------------------------------------------------
  await t1.page.evaluate(() => { const n = document.querySelector('[data-map-konvoi]'); if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true})); });
  await t1.page.waitForTimeout(500);
  const menue = await t1.page.evaluate(() => {
    const m = document.querySelector('.kmenu');
    return m ? { text: m.textContent, offen: m.getBoundingClientRect().height > 0 } : { text:'', offen:false };
  });
  check('2a: das Kartenmenü öffnet sich', menue.offen, menue);
  check('2b: es nennt Wrackkonvoi, die Wandernde Beute und die Lebenspunkte',
    /Wrackkonvoi/.test(menue.text) && /Wandernde Beute/.test(menue.text) && /Lebenspunkte/.test(menue.text),
    { text: (menue.text||'').slice(0, 300) });
  check('2c: und trägt den Angriffs-Eintrag', /Konvoi angreifen/.test(menue.text),
    { text: (menue.text||'').slice(0, 300) });
  const bA = await balkenMessen(t1.page);

  // ---- 3) Die Vorschau (FLACH, ohne Schwäche) -------------------------------------------------
  await t1.page.evaluate(() => {
    const btn = [...document.querySelectorAll('.kmenu button, .kmenu .card-row')].find(b => /Konvoi angreifen/.test(b.textContent));
    if (btn) btn.click();
  });
  await t1.page.waitForTimeout(800);
  const vor = await t1.page.evaluate(() => {
    const ov = document.getElementById('fwahlOverlay');
    return { da: !!ov && ov.getBoundingClientRect().height > 0, txt: ov ? ov.textContent : '' };
  });
  check('3-anker: die Flottenwahl ist offen', vor.da, { da: vor.da });
  check('3a: die Vorschau nennt die A2-Anteilsregel',
    /Was ankommt, zählt auf deinen Anteil an der Bergung/.test(vor.txt),
    { auszug: (vor.txt||'').slice(0, 500) });
  check('3b: und die Verlustspanne des Verbands',
    /8[–-]14% Verlusten/.test(vor.txt), { auszug: (vor.txt||'').slice(0, 500) });

  // Der Missionsstart aus DIESEM Lauf - er trägt zugleich Abschnitt 4.
  const knopf = await t1.page.evaluate(() => {
    const b = document.querySelector('#fwahlOverlay [data-fwahl-start]');
    if (!b) return { da:false };
    const gesperrt = b.disabled;
    if (!gesperrt) b.click();
    return { da:true, gesperrt };
  });
  check('4-knopf: der Startknopf ist da und nicht gesperrt', knopf.da && !knopf.gesperrt, knopf);
  await t1.page.waitForTimeout(1200);
  const m1 = ((t1.stand().fleet||{}).missions||[]).find(m => m.type === 'konvoi-angriff');
  check('4a: die Mission ist angelegt', !!m1, { typen: ((t1.stand().fleet||{}).missions||[]).map(m=>m.type) });
  /* 4b ist der Unterschied zum Nest: der Konvoi trägt seine Kennung in `zielId`, NICHT in `nestId`
     - der Server sucht die Mission über `m.zielId`. */
  check('4b: sie trägt die Kennung des Konvois in zielId', !!m1 && String(m1.zielId) === KONVOI_ID, { zielId: m1 && m1.zielId });
  check('4c: und das System, in dem er beim Start stand', !!m1 && m1.system === SYS, { system: m1 && m1.system });

  // Die Missionskarte nennt den Konvoi (Abschnitt 5).
  await t1.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="flotte"]'); if (x) x.click(); });
  await t1.page.waitForTimeout(1400);
  const karte = await t1.page.evaluate(() => {
    const b = document.getElementById('missionsActive');
    return b ? b.textContent : '';
  });
  check('5a: die Missionskarte nennt den Wrackkonvoi statt eines Erkundungsziels',
    /Wrackkonvoi/.test(karte) && !/Erkundungsziel/.test(karte), { auszug: (karte||'').slice(0, 300) });
  await t1.ctx.close();

  /* ---- 6) Der Fuellbalken und die Bergungszeile ---------------------------------------------
     Zweiter Lauf mit anderem Lebenspunkte-Stand UND anderer Beute. Der Anteil wird gegen die
     Zahlen der FIXTURE gehalten - ein Anker von ausserhalb der Rechnung des Spiels (Regel 62). */
  const t4 = await tab(browser, fixture(), { konvoi: { lp:4000, lpMax:40000,
    beute:{ essenz:40, kampfpunkte:60, xp:800, credits:20000, modulChance:0.3 } } });
  await t4.page.waitForTimeout(2500);
  await aufKarte(t4);
  await t4.page.evaluate(() => { const n = document.querySelector('[data-map-konvoi]'); if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true})); });
  await t4.page.waitForTimeout(500);
  const bB = await balkenMessen(t4.page);
  await t4.ctx.close();

  const restA = (bA.balken||[])[0];
  const restB = (bB.balken||[])[0];
  check('6-vorab: beide Laeufe haben ein offenes Kartenmenü mit genau einem Füllbalken',
    bA.menue && bB.menue && !!restA && !!restB && (bA.balken||[]).length === 1,
    { menueA: bA.menue, menueB: bB.menue, anzahlA: (bA.balken||[]).length, anzahlB: (bB.balken||[]).length });
  check('6a: der Balken ist SICHTBAR und nicht hinter dem Details-Griff',
    !!restA && restA.hoehe > 0 && restA.schienenBreite > 10 && !restA.imGriff, restA);
  check('6b: seine Fuellung entspricht dem Lebenspunkte-Anteil der Fixture (65 %)',
    !!restA && restA.anteil !== null && Math.abs(restA.anteil - 260000/400000) < 0.05,
    { gemessen: restA && restA.anteil, erwartet: +(260000/400000).toFixed(3) });
  const zeileA = (bA.zeilen || []).find(z => /Lebenspunkte/.test(z)) || '';
  const pctA = (zeileA.match(/\((\d+)%\)/) || [])[1];
  check('6b2: die Prozentzahl in der Zeile stimmt mit dem gezeichneten Balken überein',
    pctA !== undefined && !!restA && restA.anteil !== null && Math.abs(+pctA/100 - restA.anteil) < 0.02,
    { zeile: zeileA, prozentText: pctA, balkenAnteil: restA && restA.anteil });
  check('6c: ein anderer Stand ergibt einen ANDEREN Balken (10 % statt 65 %)',
    !!restA && !!restB && restB.anteil !== null && Math.abs(restB.anteil - 4000/40000) < 0.05
      && Math.abs(restA.anteil - restB.anteil) > 0.2,
    { anteilA: restA && restA.anteil, anteilB: restB && restB.anteil,
      hinweis: 'gleicher Anteil in beiden Laeufen heisst: der Balken misst nicht, er steht nur da' });

  const bergA = (bA.zeilen || []).find(z => /^Bergung:/.test(z)) || '';
  const bergB = (bB.zeilen || []).find(z => /^Bergung:/.test(z)) || '';
  check('6d: das Kartenmenü nennt die Bergung samt Verteilungsregel',
    /Bergung:/.test(bergA) && /Sternenessenz/.test(bergA) && /Schadensanteil/.test(bergA), { zeile: bergA });
  check('6e: und sie haengt an der BEUTE - ein anderer Konvoi nennt andere Zahlen',
    !!bergA && !!bergB && bergA !== bergB,
    { konvoiA: bergA, konvoiB: bergB,
      hinweis: 'gleiche Zeile bei verschiedener Beute heisst: die Zahlen sind fest verdrahtet' });

  /* ---- 7) Der wrackkonvoi-Zweig von claimPendingRewards -------------------------------------
     Gemessen als PAAR: ein Lauf MIT vorgemerkter Belohnung gegen einen OHNE. Der MIT-Lauf muss
     Sternenessenz und Kampfpunkte gutschreiben UND die zwei Bergungsmodule (Standort + Schiff)
     ins Inventar legen; der OHNE-Lauf keines davon. Ohne den OHNE-Lauf waere ein Vorbestand aus
     der Fixture nicht von der Belohnung zu unterscheiden. */
  const belohnung = { type:'wrackkonvoi', system:SYS, anteil:0.4, essenz:12, kampfpunkte:18, xp:200, credits:5000,
    modul:{ defKey:'kv_bergungslogik', art:'standort', seltenheit:'episch' },
    kampfmodul:{ defKey:'kv_bergungspanzer', art:'schiff', seltenheit:'episch' } };

  const tMit = await tab(browser, fixture(), { pendingReward: belohnung });
  await tMit.page.waitForTimeout(2500);
  const wMit = werte(tMit.stand());
  const geliefert = !!tMit.store.__pendingGeliefert;
  await tMit.ctx.close();

  const tOhne = await tab(browser, fixture());
  await tOhne.page.waitForTimeout(2500);
  const wOhne = werte(tOhne.stand());
  await tOhne.ctx.close();

  check('7-vorab: der Server hat die Belohnung wirklich einmal ausgeliefert', geliefert, { geliefert });
  check('7-ohne: ohne Belohnung trägt der Stand KEINE Bergungsmodule',
    !wOhne.standortModul && !wOhne.schiffModul, wOhne);
  check('7a: die Bergung legt BEIDE Bergungsmodule ins Inventar (Standort + Schiff)',
    wMit.standortModul && wMit.schiffModul, { mit: wMit, ohne: wOhne });
  check('7b: und schreibt Sternenessenz und Kampfpunkte gut (+12 / +18)',
    (wMit.essenz - wOhne.essenz) === 12 && (wMit.kampfpunkte - wOhne.kampfpunkte) === 18,
    { essenzDelta: wMit.essenz - wOhne.essenz, kampfpunkteDelta: wMit.kampfpunkte - wOhne.kampfpunkte });

  // ---- 1c) Gegenrichtung: kein Konvoi im Galaxie-Zustand ------------------------------------
  const t3 = await tab(browser, fixture(), { ohneKonvoi: true });
  await t3.page.waitForTimeout(2500);
  await aufKarte(t3);
  const ohne = await t3.page.evaluate(() => !!document.querySelector('[data-map-konvoi]'));
  check('1c: ohne Konvoi im Galaxie-Zustand gibt es keinen Knoten', ohne === false, { gefunden: ohne });
  await t3.ctx.close();

  await browser.close();
  ende();
})();
