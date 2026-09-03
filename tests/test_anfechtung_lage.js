// Die Anfechtungs-Vorschau nennt die LAGE vom Server (01.09.2026): Angriff gegen Verteidigung,
// Erfolgschance als Spanne, Verlustquoten - statt des alten Satzes ohne Zahl.
//
//   node tests/test_anfechtung_lage.js
//
// Bis hierher stand in der Flottenwahl der Anfechtung bewusst keine Zahl: Die Chance haengt an den
// Marken, Modulen und der Forschung des HALTERS, die der Client nicht kennt. Seit E1b kennt der
// NPC-Angriff seine Lage; jetzt fragt die Anfechtung POST /asteroid/anfechtung-vorschau, das mit
// GENAU den Funktionen des Kampfs rechnet.
//
// GEPRUEFT WIRD (am gerenderten Spiel, Regel 55):
//   1. Beim Oeffnen der Flottenwahl geht der Aufruf mit System, Platz und der ZUSAMMENSETZUNG raus.
//   2. Die Antwort steht in der Vorschau: Angriff, Verteidigung, die Spanne "62–69%", die Quoten.
//   3. RUECKFALL: Antwortet der Server 404 (Backend vor diesem Stand), steht der alte Satz ohne
//      Zahl da - keine erfundene Prozentzahl.
//   4. Eine ANDERE Auswahl loest einen ZWEITEN Aufruf aus (Signatur je Zusammensetzung); dieselbe
//      Auswahl erneut nicht (Speicher).
//
// GEGENPROBE: anfechtungLageHtml immer mit `null` aufrufen -> 2a faellt (alter Satz trotz Antwort).
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
check('0a: die Vorschau fragt den Server', /backendFetch\('\/asteroid\/anfechtung-vorschau'/.test(JS));
check('0b: der alte Satz ohne Zahl bleibt als Rueckfall erhalten', /wer deutlich stärker ist, gewinnt meist, sicher ist es nie \(10–90%\)/.test(JS));

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
const PLATZ = '3';

function serverFeld(){
  return { systeme: [SYS], felder: { [SYS]: { plaetze: {
    [PLATZ]: { sorte: 'eisen', groesse: 'brocken', vorrat: 90000, halter: 'x2', halterName: 'Rivale', tag: 'RIV', seit: 1, eskorte: { jaeger: 10 } }
  } } } };
}
function backend(store, opt){
  opt = opt || {};
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'asteroid/field') return j(serverFeld());
    if (p === 'asteroid/anfechtung-vorschau'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__lage = (store.__lage || []).concat([body]);
      if (opt.lage404) return j({ error: 'Cannot POST' }, 404);
      return j({ ok:true, angriff: 8500, verteidigung: 4340, wache: 10, chanceMin: 62, chanceMax: 69, chance: 66, verlustSieg: 18, verlustNiederlage: 55, schutzBis: 0 });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|reports/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
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
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){ const e = document.getElementById(id); if (e) e.remove(); }
  });
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
async function flottenwahlOeffnen(t){
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t.page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(t.page, SYS);
  await t.page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, PLATZ);
  await t.page.waitForTimeout(500);
  const menue = await t.page.evaluate(() => {
    const b = [...document.querySelectorAll('.kmenu button')].find(x => /Schürfrecht anfechten/.test(x.textContent));
    if (!b) return { da:false };
    const dis = b.disabled; if (!dis) b.click();
    return { da:true, disabled: dis };
  });
  await t.page.waitForTimeout(1100);   // 250 ms Entprellung + Antwort + Neuzeichnen
  const ov = await t.page.evaluate(() => { const o = document.getElementById('fwahlOverlay'); return { da: !!o && o.getBoundingClientRect().height > 0, txt: o ? o.textContent : '' }; });
  return { menue, ov };
}

(async () => {
  const browser = await starteBrowser();
  const roh = await tab(browser);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0c: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }
  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    for (const k of Object.keys(st.fleet)) if (typeof st.fleet[k] === 'number') st.fleet[k] = 0;
    st.fleet.cruisers = 60; st.fleet.destroyers = 20;
    st.research = Object.assign({}, st.research, { rminentechnik: 1 });
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 400000;
    return JSON.stringify(st);
  }

  // ---- 1/2) Mit Server-Antwort -----------------------------------------------------------------
  const t1 = await tab(browser, fixture());
  await t1.page.waitForTimeout(2000);
  const a = await flottenwahlOeffnen(t1);
  check('1-anker: der Anfechtungs-Eintrag ist da und die Flottenwahl offen', a.menue.da && !a.menue.disabled && a.ov.da, { menue: a.menue, offen: a.ov.da });
  const ruf = (t1.store.__lage || [])[0];
  check('1a: der Aufruf traegt System, Platz und die Zusammensetzung', !!ruf && ruf.system === SYS && String(ruf.platz) === PLATZ && ruf.composition && (ruf.composition.cruisers||0) > 0, ruf);
  // fmt() schreibt 8.500 als "8.5k" und 4.340 als "4.3k" - gemessen wird die Zeile mit ihren Etiketten.
  const lageZeile = ((a.ov.txt||'').replace(/\s+/g,' ').match(/Angriff [^–]*– Erfolgschance [0-9–]+%/) || [''])[0];
  check('2a: die Vorschau nennt Angriff, Verteidigung und die Spanne des Servers',
    /Angriff 8[.,]5k gegen Verteidigung 4[.,]3k/.test(lageZeile) && /62–69%/.test(lageZeile), { lageZeile, auszug: (a.ov.txt||'').replace(/\s+/g,' ').slice(300, 800) });
  check('2b: und die Verlustquoten fuer Sieg und Niederlage', /18%/.test(a.ov.txt) && /55%/.test(a.ov.txt), { auszug: (a.ov.txt||'').replace(/\s+/g,' ').slice(0, 500) });
  check('2c: der alte Satz ohne Zahl steht NICHT mehr da, sobald der Server geantwortet hat', !/10–90%/.test(a.ov.txt));

  // ---- 4) Andere Auswahl -> zweiter Aufruf; dieselbe erneut -> keiner --------------------------
  const vor = (t1.store.__lage || []).length;
  await t1.page.evaluate(() => { const b = document.querySelector('#fwahlOverlay [data-fwahl-nichts]'); if (b) b.click(); });
  await t1.page.waitForTimeout(700);
  const nachNichts = (t1.store.__lage || []).length;
  await t1.page.evaluate(() => { const b = document.querySelector('#fwahlOverlay [data-fwahl-alle]'); if (b) b.click(); });
  await t1.page.waitForTimeout(900);
  const nachAlle = (t1.store.__lage || []).length;
  check('4a: "Nichts" (keine Kampfschiffe) loest KEINEN Aufruf aus - ohne Flotte gibt es keine Lage', nachNichts === vor, { vor, nachNichts });
  check('4b: "Komplette Flotte" (dieselbe Zusammensetzung wie beim Oeffnen) loest keinen ZWEITEN Aufruf aus - die Signatur ist gespeichert', nachAlle === vor, { vor, nachAlle,
    hinweis: 'beim Oeffnen war bereits die komplette Kampfflotte gewaehlt' });
  await t1.page.evaluate(() => {
    // Eine ANDERE Zusammensetzung ueber den Spielerweg: ein Minus-Klick an der ersten Zeile.
    const b = document.querySelector('#fwahlOverlay [data-fwahl-minus], #fwahlOverlay button[data-minus], #fwahlOverlay .fwahl-rumpf button');
    if (b) b.click();
  });
  await t1.page.waitForTimeout(900);
  const nachAnders = (t1.store.__lage || []).length;
  check('4c: eine ANDERE Zusammensetzung loest einen weiteren Aufruf aus', nachAnders === vor + 1, { vor, nachAnders, letzte: (t1.store.__lage||[]).slice(-1)[0] });
  check('4d: keine Seitenfehler', t1.errs.length === 0, t1.errs.slice(0, 2));
  await t1.ctx.close();

  // ---- 3) Rueckfall bei 404 ----------------------------------------------------------------------
  const t2 = await tab(browser, fixture(), { lage404: true });
  await t2.page.waitForTimeout(2000);
  const b = await flottenwahlOeffnen(t2);
  check('3-anker: die Flottenwahl ist offen', b.ov.da);
  check('3a: antwortet der Server 404, steht der alte Satz ohne Zahl da - keine erfundene Prozentzahl',
    /10–90%/.test(b.ov.txt) && !/62–69%/.test(b.ov.txt) && !/wird ermittelt/.test(b.ov.txt), { auszug: (b.ov.txt||'').replace(/\s+/g,' ').slice(0, 400) });
  await t2.ctx.close();

  await browser.close();
  ende();
})();
