// Das Alien-Nest im laufenden Spiel: Karte, Kartenmenü, Vorschau, Mission (Phase 3, 18.08.2026).
//
//   node tests/test_nest_ui.js
//
// Er misst am GERENDERTEN Spiel, nicht am Quelltext - „im DOM vorhanden" ist nicht „für den
// Spieler sichtbar" (Arbeitsregel 55).
//
// GEPRUEFT WIRD:
//   1. Das Nest erscheint als eigener Kartenknoten, und zwar SICHTBAR (gemessene Fläche > 0).
//      Ohne Nest im Galaxie-Zustand ist es nicht da (Gegenrichtung).
//   2. Sein Kartenmenü nennt die Zahlen, die eine Entscheidung tragen: Volk, Stufe,
//      Lebenspunkte, die wirksame Schiffsklasse - und den Angriffs-Eintrag.
//   3. DIE VORSCHAU MISST DIE SCHWÄCHE, statt sie nur zu benennen: Dieselbe Flotte einmal MIT
//      und einmal OHNE die passende Schiffsklasse muss zu einer ANDEREN Aussage führen. Eine
//      Prüfung auf „das Wort Jäger steht da" wäre grün, egal was die Flotte trägt - genau die
//      Sorte Etikett-Prüfung, die in Phase 1 eine Gegenprobe hat durchgehen lassen (Regel 61).
//   4. Der Missionsstart legt eine Mission mit `nestId` und `system` an. Beide braucht der
//      Server: die Kennung, um das Nest zu finden, das System, um „weitergezogen" zu erkennen.
//   5. Die Missionskarte nennt das Volk - ohne eigenen Zweig stünde dort „Erkundungsziel".
//
// GEGENPROBE (in beide Richtungen ausgeführt, überall dieselbe Anzahl gelaufener Prüfungen):
//   * Ohne Nest im Galaxie-Zustand: kein Knoten (1c).
//   * Mit einer Kopie, in der die Vorschau die Schwäche nicht MISST, sondern nur benennt,
//     fällt 3c (beide Läufe zeigen dieselbe Aussage).
//   * Mit einer Kopie, die `system` nicht in die Mission schreibt, fällt 4c.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
check('0a: die Völker-Tabelle steht in der Spieldatei', /const ALIEN_VOELKER = \{/.test(JS));
check('0b: es gibt einen eigenen Kartenknoten', /data-map-nest/.test(JS));
check('0c: und eine Angriffsmission', /type:'nest-angriff'/.test(JS));

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
const NEST_ID = 'nest-test-1';

function nest(opt){
  /* Die Ueberschreibungen sind die Messvorrichtung fuer Abschnitt 6: ZWEI Laeufe, die sich nur in
     Stufe und Lebenspunkten unterscheiden, muessen einen anderen Balken und andere Bergungszahlen
     zeigen. Ein Lauf allein waere auch von einem fest verdrahteten Balken erfuellt (Regel 61). */
  return Object.assign({ id: NEST_ID, volk:'kryll', sys:SYS, stufe:3, lp:260000, lpMax:400000,
    seit: Date.now() - 7200000, letzteReifung: Date.now() - 3600000,
    naechsterWurf: Date.now() + 8*3600*1000, naechsteWanderung: 0, beitraege:{}, schlaege:{} }, opt || {});
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
      alienNester: opt.ohneNest ? [] : [nest(opt.nest)] });
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{} } } });
    if (p === 'alien/nest-angriff'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__schlag = (store.__schlag || []).concat([body]);
      return j({ ok:true, schaden:31000, gefallen:false, lp:229000, lpMax:400000,
        trifftSchwaeche:true, schwaeche:'jaeger', volk:'kryll', volkName:'Kryll-Schwarm',
        stufe:3, stufeName:'Schwarmstock', eigeneVerluste:{ jaeger:20 },
        anteil:0, teilnehmer:1, schwarmGefallen:false, mitgerissen:0 });
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
   (Regel 55: „im DOM vorhanden" ist nicht „fuer den Spieler sichtbar") und der Anteil, den die
   Fuellung von ihrer Schiene einnimmt - nicht das style-Attribut, das auch dann dastuende, wenn
   eine CSS-Regel den Balken flachlegt. */
async function balkenMessen(page){
  return page.evaluate(() => {
    const m = document.querySelector('.kmenu');
    if (!m) return { menue:false, balken:[], text:'' };
    const balken = [...m.querySelectorAll('.sstat')].map(b => {
      const schiene = b.querySelector('.tr'), fuell = b.querySelector('.tr i');
      const rs = schiene ? schiene.getBoundingClientRect() : null;
      const rf = fuell ? fuell.getBoundingClientRect() : null;
      const rb = b.getBoundingClientRect();
      return {
        label: (b.querySelector('.k')||{}).textContent || '',
        wert: (b.querySelector('.v')||{}).textContent || '',
        hoehe: Math.round(rb.height),
        schienenBreite: rs ? Math.round(rs.width) : 0,
        fuellBreite: rf ? Math.round(rf.width) : 0,
        anteil: (rs && rs.width > 0 && rf) ? +(rf.width / rs.width).toFixed(3) : null,
        imGriff: !!b.closest('details') && !(b.closest('details')||{}).open
      };
    });
    /* Die Meta-Zeilen kommen als EIGENE Elemente zurueck, nicht als Ausschnitt aus dem
       Fliesstext: Ein Zeichenfenster wie /Bergung:.{0,120}/ ist eine Schaetzung, keine Grenze -
       es laeuft in die Nachbarzeile hinein und macht jeden Vergleich unscharf. */
    const zeilen = [...m.querySelectorAll('.bmeta')].map(d => (d.textContent || '').trim());
    return { menue:true, balken, zeilen, text: m.textContent || '' };
  });
}
async function aufKarte(t){
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t.page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(t.page, SYS);
}

(async () => {
  const browser = await starteBrowser();

  const roh = await tab(browser);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0d: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  /* Zwei Fixtures, die sich in EINEM Punkt unterscheiden: ob die Flotte Jäger trägt - die
     Schwäche der Kryll. Sonst sind sie identisch. Das ist die Messvorrichtung für Abschnitt 3.
     Die Träger sind Pflicht, sonst kappt capFighterSelection die Jäger auf die Hangar-Kapazität
     der mitgeschickten Träger auf 0 (dieselbe Falle wie in test_festung_ui). */
  function fixture(mitJaegern){
    const st = JSON.parse(JSON.stringify(basis));
    for (const k of Object.keys(st.fleet)) if (typeof st.fleet[k] === 'number') st.fleet[k] = 0;
    st.fleet.cruisers = 120;
    if (mitJaegern){ st.fleet.jaeger = 80; st.fleet.carrier = 20; }
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 400000;
    return JSON.stringify(st);
  }

  // ---- 1) Der Kartenknoten -------------------------------------------------------------------
  const t1 = await tab(browser, fixture(true));
  await t1.page.waitForTimeout(2500);
  await aufKarte(t1);
  const sicht = await t1.page.evaluate(() => {
    const n = document.querySelector('[data-map-nest]');
    if (!n) return { da:false };
    const b = n.getBoundingClientRect();
    return { da:true, breite: Math.round(b.width), hoehe: Math.round(b.height), titel: (n.querySelector('title')||{}).textContent || '' };
  });
  check('1a: das Nest ist auf der Karte SICHTBAR', sicht.da && sicht.breite > 4 && sicht.hoehe > 4, sicht);
  check('1b: sein Titel nennt Volk und Stufe',
    /Kryll/.test(sicht.titel||'') && /Schwarmstock/.test(sicht.titel||''), { titel: sicht.titel });

  // ---- 2) Das Kartenmenü ---------------------------------------------------------------------
  await t1.page.evaluate(() => { const n = document.querySelector('[data-map-nest]'); if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true})); });
  await t1.page.waitForTimeout(500);
  const menue = await t1.page.evaluate(() => {
    const m = document.querySelector('.kmenu');
    return m ? { text: m.textContent, offen: m.getBoundingClientRect().height > 0 } : { text:'', offen:false };
  });
  check('2a: das Kartenmenü öffnet sich', menue.offen, menue);
  check('2b: es nennt Lebenspunkte und die wirksame Schiffsklasse',
    /Lebenspunkte/.test(menue.text) && /Wirksam dagegen/.test(menue.text) && /Jäger/.test(menue.text),
    { text: (menue.text||'').slice(0, 300) });
  check('2c: und trägt den Angriffs-Eintrag', /Nest angreifen/.test(menue.text),
    { text: (menue.text||'').slice(0, 300) });
  const bA = await balkenMessen(t1.page);

  // ---- 3) Die Vorschau MISST die Schwäche ------------------------------------------------------
  await t1.page.evaluate(() => {
    const btn = [...document.querySelectorAll('.kmenu button, .kmenu .card-row')].find(b => /Nest angreifen/.test(b.textContent));
    if (btn) btn.click();
  });
  await t1.page.waitForTimeout(800);
  const vorMit = await t1.page.evaluate(() => {
    const ov = document.getElementById('fwahlOverlay');
    return { da: !!ov && ov.getBoundingClientRect().height > 0, txt: ov ? ov.textContent : '' };
  });
  check('3-anker: die Flottenwahl ist offen', vorMit.da, { da: vorMit.da });
  check('3a: die Vorschau BENENNT die Schwäche', /Wirksam dagegen/.test(vorMit.txt) && /Jäger/.test(vorMit.txt),
    { auszug: (vorMit.txt||'').slice(0, 400) });
  check('3b: mit Jägern im Verband meldet sie den Treffer',
    /im Verband dabei/.test(vorMit.txt), { auszug: (vorMit.txt||'').slice(0, 500) });

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
  const m1 = ((t1.stand().fleet||{}).missions||[]).find(m => m.type === 'nest-angriff');
  check('4a: die Mission ist angelegt', !!m1, { typen: ((t1.stand().fleet||{}).missions||[]).map(m=>m.type) });
  check('4b: sie trägt die Kennung des Nestes', !!m1 && String(m1.nestId) === NEST_ID, { nestId: m1 && m1.nestId });
  /* 4c ist die Prüfung, die der Server BRAUCHT: Ohne `system` kann er nicht erkennen, dass ein
     Nest weitergezogen ist - der Anflug liefe dann gegen das neue System, als wäre nichts. */
  check('4c: und das System, in dem es beim Start stand', !!m1 && m1.system === SYS, { system: m1 && m1.system });

  // Die Missionskarte nennt das Volk (Abschnitt 5).
  await t1.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="flotte"]'); if (x) x.click(); });
  await t1.page.waitForTimeout(1400);
  const karte = await t1.page.evaluate(() => {
    const b = document.getElementById('missionsActive');
    return b ? b.textContent : '';
  });
  check('5a: die Missionskarte nennt das Volk statt eines Erkundungsziels',
    /Kryll/.test(karte) && !/Erkundungsziel/.test(karte), { auszug: (karte||'').slice(0, 300) });
  await t1.ctx.close();

  // ---- 3c) Derselbe Lauf OHNE Jäger - die Aussage muss sich UNTERSCHEIDEN ----------------------
  const t2 = await tab(browser, fixture(false));
  await t2.page.waitForTimeout(2500);
  await aufKarte(t2);
  await t2.page.evaluate(() => { const n = document.querySelector('[data-map-nest]'); if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true})); });
  await t2.page.waitForTimeout(400);
  await t2.page.evaluate(() => {
    const btn = [...document.querySelectorAll('.kmenu button, .kmenu .card-row')].find(b => /Nest angreifen/.test(b.textContent));
    if (btn) btn.click();
  });
  await t2.page.waitForTimeout(800);
  const vorOhne = await t2.page.evaluate(() => {
    const ov = document.getElementById('fwahlOverlay');
    return { da: !!ov && ov.getBoundingClientRect().height > 0, txt: ov ? ov.textContent : '' };
  });
  check('3c-anker: auch ohne Jäger ist die Flottenwahl offen', vorOhne.da, { da: vorOhne.da });
  check('3c: ohne die passende Klasse sagt die Vorschau etwas ANDERES',
    /fehlt im Verband/.test(vorOhne.txt) && !/im Verband dabei/.test(vorOhne.txt),
    { auszugOhne: (vorOhne.txt||'').slice(0, 500),
      hinweis: 'gleiche Aussage wie mit Jaegern heisst: die Vorschau misst nicht, sie behauptet' });
  await t2.ctx.close();

  /* ---- 6) Der Fuellbalken und die Bergungszeile (GR-2) --------------------------------------
     Gemessen wird die WIRKUNG, nicht die Beschriftung (Regel 61): Ein zweiter Lauf mit einer
     anderen Stufe und einem anderen Lebenspunkte-Stand muss einen ANDEREN Balken und ANDERE
     Bergungszahlen zeigen. Ein einzelner Lauf waere auch von einem fest verdrahteten Balken und
     einem festen Text erfuellt. Der Anteil wird zusaetzlich gegen die Zahlen der FIXTURE gehalten
     - ein Anker von ausserhalb der Rechnung des Spiels (Regel 62). */
  const t4 = await tab(browser, fixture(true), { nest: { stufe:1, lp:4000, lpMax:40000 } });
  await t4.page.waitForTimeout(2500);
  await aufKarte(t4);
  await t4.page.evaluate(() => { const n = document.querySelector('[data-map-nest]'); if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true})); });
  await t4.page.waitForTimeout(500);
  const bB = await balkenMessen(t4.page);
  await t4.ctx.close();

  const restA = (bA.balken||[]).find(b => /Rest/.test(b.label));
  const restB = (bB.balken||[]).find(b => /Rest/.test(b.label));
  check('6-vorab: beide Laeufe haben ein offenes Kartenmenü mit einem Rest-Balken',
    bA.menue && bB.menue && !!restA && !!restB,
    { menueA: bA.menue, menueB: bB.menue, labelA: (bA.balken||[]).map(b=>b.label), labelB: (bB.balken||[]).map(b=>b.label) });
  check('6a: der Balken ist SICHTBAR und nicht hinter dem Details-Griff',
    !!restA && restA.hoehe > 0 && restA.schienenBreite > 10 && !restA.imGriff, restA);
  check('6b: seine Fuellung entspricht dem Lebenspunkte-Anteil der Fixture (65 %)',
    !!restA && restA.anteil !== null && Math.abs(restA.anteil - 260000/400000) < 0.05,
    { gemessen: restA && restA.anteil, erwartet: +(260000/400000).toFixed(3), wertText: restA && restA.wert });
  check('6c: ein anderer Stand ergibt einen ANDEREN Balken (10 % statt 65 %)',
    !!restA && !!restB && restB.anteil !== null && Math.abs(restB.anteil - 4000/40000) < 0.05
      && Math.abs(restA.anteil - restB.anteil) > 0.2,
    { anteilA: restA && restA.anteil, anteilB: restB && restB.anteil,
      hinweis: 'gleicher Anteil in beiden Laeufen heisst: der Balken misst nicht, er steht nur da' });

  const bergA = (bA.zeilen || []).find(z => /^Bergung:/.test(z)) || '';
  const bergB = (bB.zeilen || []).find(z => /^Bergung:/.test(z)) || '';
  check('6d: das Kartenmenü nennt die Bergung samt Verteilungsregel',
    /Bergung:/.test(bergA) && /Kampfpunkte/.test(bergA) && /Schadensanteil/.test(bergA), { zeile: bergA });
  check('6e: und sie haengt an der STUFE - eine andere Stufe nennt andere Zahlen',
    !!bergA && !!bergB && bergA !== bergB,
    { stufe3: bergA, stufe1: bergB,
      hinweis: 'gleiche Zeile bei verschiedenen Stufen heisst: die Zahlen sind fest verdrahtet' });

  // ---- 1c) Gegenrichtung: kein Nest im Galaxie-Zustand ------------------------------------------
  const t3 = await tab(browser, fixture(true), { ohneNest: true });
  await t3.page.waitForTimeout(2500);
  await aufKarte(t3);
  const ohne = await t3.page.evaluate(() => !!document.querySelector('[data-map-nest]'));
  check('1c: ohne Nest im Galaxie-Zustand gibt es keinen Knoten', ohne === false, { gefunden: ohne });
  await t3.ctx.close();

  await browser.close();
  ende();
})();
