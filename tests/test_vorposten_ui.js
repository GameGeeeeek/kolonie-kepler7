// Der Vorposten im laufenden Spiel (B2, 02.09.2026): Karte, Landmarke, Detailtafel, Bau, Nutzen,
// Angriff, Belohnung - gemessen am GERENDERTEN Spiel (Regel 55), nach dem Muster von test_nest_ui.
//
//   node tests/test_vorposten_ui.js
//
// GEPRUEFT WIRD:
//   1. Ein fremder Vorposten erscheint als SICHTBARER Kartenknoten (data-map-vorposten), als
//      ⛺-Landmarke am Systemplatz der Sektoransicht und als Chip in der Detailtafel; sein
//      Kartenmenü nennt Besitzer, Kern, Verteidigung und den Angriffs-Eintrag. Ohne Vorposten
//      (aktiv:false = altes Backend) ist nichts davon da (Gegenrichtung 1e/1f).
//   2. Der BAU: In einem fremden System ohne Vorposten steht der Knopf „Vorposten errichten";
//      der Start zahlt die Baukosten, legt eine Form-A-Mission mit Kolonieschiff an. Im
//      Heimatsystem steht er nicht.
//   3. DIE WEICHE (i) - als PAAR gemessen: Mit eigenem Vorposten (flug 0,15) ist die Erkundungs-
//      Flugzeit in der Detailtafel KUERZER als ohne; die Hinflugzeit der ANFECHTUNG in der
//      Flottenwahl ist in beiden Laeufen IDENTISCH. Ein globaler Faktor riesse 3c.
//   4. Der Angriff: Rueckkehr der Mission bucht GENAU die Verluste des Servers, schreibt einen
//      Bericht 'vorposten-angriff' und ruft bei `gefallen` das Belohnungsfach.
//   5. Die Belohnung: 'vorposten' bucht Kampfpunkte/Kredite; 'vorposten-verlust' schreibt einen
//      Bericht 'vorposten-verteidigung'.
//
// GEGENPROBE: vorpostenFlug in sendAnfechtungsMission einhaengen -> 3c faellt; den claim-Zweig
// 'vorposten' entfernen -> 5a faellt (Bug-Report-Rueckfall, Kampfpunkte bleiben 0).
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren, oeffneSektorMitSystem } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
check('0a: es gibt einen eigenen Kartenknoten', /data-map-vorposten/.test(JS));
check('0b: und die Bau-Mission', /type:'vorposten-bau'/.test(JS));

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
const STUFEN = [
  { stufe: 1, name: 'Feldlager',  kernLp: 20000,  verteidigung: 2500,  garnisonMax: 300,  flug: 0.06, prod: 0.015, scan: 1, kampfpunkte: 30,  xp: 250,  credits: 1200 },
  { stufe: 2, name: 'Stützpunkt', kernLp: 90000,  verteidigung: 12000, garnisonMax: 800,  flug: 0.10, prod: 0.03,  scan: 2, kampfpunkte: 80,  xp: 700,  credits: 3500 },
  { stufe: 3, name: 'Bastion',    kernLp: 400000, verteidigung: 60000, garnisonMax: 2000, flug: 0.15, prod: 0.05,  scan: 3, kampfpunkte: 200, xp: 2000, credits: 9000 }
];
function vorposten(opt){
  const eigener = !!(opt && opt.eigener);
  return Object.assign({ id: 'vp-test-1', sys: SYS, besitzer: eigener ? 'u' : 'x2', besitzerName: eigener ? 'A' : 'Rivale',
    seit: Date.now() - 20*3600000, stufe: eigener ? 3 : 2, name: eigener ? 'Bastion' : 'Stützpunkt',
    kern: { lp: 60000, lpMax: 90000 }, verteidigung: 14000, garnisonAnzahl: 40,
    schutzBis: Date.now() - 8*3600000, ausbauAb: Date.now() + 3600000,
    nutzen: eigener ? { flug: 0.15, prod: 0.05, scan: 3 } : { flug: 0.10, prod: 0.03, scan: 2 },
    eigener, meinLetzterSchlag: 0, letzterKampf: null }, (opt && opt.felder) || {});
}
function backend(store, opt){
  opt = opt || {};
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null,
      collapsedSystems:{}, activeWormhole:null, news:[], alienNester: [], wrackKonvois: [] });
    if (p === 'vorposten'){
      if (opt.inaktiv) return j({ ok:true, aktiv:false, bauAktiv:false, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000, ausbauMs:43200000, garnisonFaktor:0.5, stufen:STUFEN, liste:[], eigene:0 });
      const liste = opt.ohneVorposten ? [] : [vorposten(opt)];
      return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000, ausbauMs:43200000, garnisonFaktor:0.5, stufen:STUFEN, liste, eigene: liste.filter(x => x.eigener).length });
    }
    if (p === 'vorposten/angriff'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__angriff = (store.__angriff || []).concat([body]);
      return j({ ok:true, schaden: 12000, gefallen: !!opt.gefallen, lp: opt.gefallen ? 0 : 48000, lpMax: 90000, stufe: 2, besitzerName: 'Rivale',
        verteidigung: 14000, durchschlag: 0.42, eigeneVerluste: { cruisers: 9 }, garnisonVerluste: { jaeger: 5 }, anteil: opt.gefallen ? 0.6 : 0, teilnehmer: 1, naechsterSchlagAb: Date.now() + 14400000 });
    }
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{ '3': { sorte:'eisen', groesse:'brocken', vorrat: 90000, halter:'x2', halterName:'Rivale', tag:'RIV', seit:1, eskorte:{ jaeger: 10 } } } } } });
    if (p === 'asteroid/anfechtung-vorschau') return j({ error:'Cannot POST' }, 404);
    if (p === 'pending-rewards/claim'){
      store.__claims = (store.__claims || 0) + 1;
      const q = opt.belohnungen || [];
      const next = q[store.__claims - 1];
      return j({ reward: next || null });
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
  await page.evaluate(() => { for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){ const e = document.getElementById(id); if (e) e.remove(); } });
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
async function aufKarte(t, sys){
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t.page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(t.page, sys || SYS);
  await t.page.waitForTimeout(400);
}
async function landmarke(t){
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t.page.waitForTimeout(600);
  await oeffneSektorMitSystem(t.page, SYS);
  return t.page.evaluate(id => {
    const g = document.querySelector('#galaxyMapSvg [data-sektor-sys="' + id + '"]');
    if (!g) return { da:false, zeichen:'' };
    const out = [];
    for (const tx of g.querySelectorAll('text')){ const r = tx.getBoundingClientRect(); if (r.width > 0 && r.height > 0) out.push((tx.textContent||'').trim()); }
    return { da:true, zeichen: out.join(' ') };
  }, SYS);
}
const knoten = page => page.evaluate(() => {
  const n = document.querySelector('[data-map-vorposten]');
  if (!n) return { da:false };
  const b = n.getBoundingClientRect();
  return { da:true, breite: Math.round(b.width), hoehe: Math.round(b.height), titel: (n.querySelector('title')||{}).textContent || '' };
});
const tafel = page => page.evaluate(() => ({
  chips: (document.getElementById('systemStatusChips')||{}).textContent || '',
  kenn: (document.getElementById('systemNavKenn')||{}).textContent || '',
  bauKnopf: (() => { const b = document.querySelector('#mapBaseLinks [data-vorposten-bau]'); return b ? { da:true, disabled: b.disabled, titel: b.getAttribute('title') || '' } : { da:false }; })(),
  vpKnopf: !!document.querySelector('#mapBaseLinks [data-vorposten-menu]')
}));
async function anfechtungHinflug(t){
  await t.page.evaluate(() => { const n = document.querySelector('[data-map-asteroid="3"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); });
  await t.page.waitForTimeout(400);
  await t.page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button')].find(x => /Schürfrecht anfechten/.test(x.textContent)); if (b && !b.disabled) b.click(); });
  await t.page.waitForTimeout(700);
  const txt = await t.page.evaluate(() => { const o = document.getElementById('fwahlOverlay'); return o ? (o.textContent||'').replace(/\s+/g,' ') : ''; });
  await t.page.evaluate(() => { const b = document.querySelector('#fwahlOverlay [data-fwahl-zu]'); if (b) b.click(); });
  return (txt.match(/Hinflug ([0-9hms ]+?) ·/) || [])[1] || null;
}

(async () => {
  const browser = await starteBrowser();
  const roh = await tab(browser, null, { inaktiv: true });
  const basis = roh.stand();
  await roh.ctx.close();
  check('0c: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }
  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    for (const k of Object.keys(st.fleet)) if (typeof st.fleet[k] === 'number') st.fleet[k] = 0;
    st.fleet.cruisers = 120; st.fleet.colonyShips = 2; st.fleet.ships = 5;
    st.research = Object.assign({}, st.research, { rminentechnik: 1 });
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 400000;
    return JSON.stringify(st);
  }

  // ---- 1) Fremder Vorposten: Knoten, Landmarke, Chip, Menue -------------------------------------
  const t1 = await tab(browser, fixture(), {});
  await t1.page.waitForTimeout(2500);
  const lm = await landmarke(t1);
  check('1b: die ⛺-Landmarke steht SICHTBAR am Systemplatz', lm.da && /⛺/.test(lm.zeichen), lm);
  await aufKarte(t1);
  const k1 = await knoten(t1.page);
  check('1a: der fremde Vorposten ist auf der Karte SICHTBAR und nennt den Besitzer', k1.da && k1.breite > 4 && /Rivale/.test(k1.titel) && /Stützpunkt/.test(k1.titel), k1);
  // Ein Fehler beim Zeichnen der Systemebene laesst JEDEN Marker verschwinden - er gehoert sofort genannt.
  check('1a2: keine Seitenfehler beim Zeichnen', t1.errs.length === 0, t1.errs.slice(0, 2));
  const tf1 = await tafel(t1.page);
  check('1c: die Detailtafel traegt den Vorposten-Chip mit Besitzer', /Stützpunkt von Rivale/.test(tf1.chips), { chips: tf1.chips.slice(0, 200) });
  check('1c2: und den Vorposten-Knopf statt des Bau-Knopfs', tf1.vpKnopf && !tf1.bauKnopf.da, tf1);
  await t1.page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
  await t1.page.waitForTimeout(500);
  const menue = await t1.page.evaluate(() => { const m = document.querySelector('.kmenu'); return m ? { offen: m.getBoundingClientRect().height > 0, text: m.textContent, knoepfe: [...m.querySelectorAll('button')].map(b => ({ label: b.textContent, disabled: b.disabled })) } : { offen:false, text:'', knoepfe:[] }; });
  check('1d: das Kartenmenü nennt Besitzer, Kern, Verteidigung und den Angriffs-Eintrag (frei, kein Bauschutz)',
    menue.offen && /Rivale/.test(menue.text) && /Kern/.test(menue.text) && /Verteidigung/.test(menue.text) && menue.knoepfe.some(k => /Vorposten angreifen/.test(k.label) && !k.disabled), { text: (menue.text||'').slice(0, 300), knoepfe: menue.knoepfe });
  await t1.page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button')].find(x => /Vorposten angreifen/.test(x.textContent)); if (b) b.click(); });
  await t1.page.waitForTimeout(700);
  const vor = await t1.page.evaluate(() => { const o = document.getElementById('fwahlOverlay'); return o ? (o.textContent||'').replace(/\s+/g,' ') : ''; });
  check('1d2: die Angriffs-Vorschau nennt Verteidigung und Durchschlag', /Verteidigung 14[.,]0k/.test(vor) && /Durchschlag rund \d+%/.test(vor), { auszug: vor.slice(200, 600) });
  await t1.page.evaluate(() => { const b = document.querySelector('#fwahlOverlay [data-fwahl-zu]'); if (b) b.click(); });
  await t1.ctx.close();

  // ---- 1e/1f) Altes Backend (aktiv:false): nichts davon -------------------------------------------
  const t0 = await tab(browser, fixture(), { inaktiv: true });
  await t0.page.waitForTimeout(2500);
  const lm0 = await landmarke(t0);
  check('1e: ohne Vorposten keine Landmarke (der Systemplatz ist da)', lm0.da && !/⛺/.test(lm0.zeichen), lm0);
  await aufKarte(t0);
  const k0 = await knoten(t0.page); const tf0 = await tafel(t0.page);
  check('1f: kein Knoten, kein Chip, kein Bau-Knopf (der Server kennt keine Vorposten)', !k0.da && !/Vorposten/.test(tf0.chips) && !tf0.bauKnopf.da && !tf0.vpKnopf, { k0, tf0 });
  await t0.ctx.close();

  // ---- 2) Der Bau -----------------------------------------------------------------------------------
  const t2 = await tab(browser, fixture(), { ohneVorposten: true });
  await t2.page.waitForTimeout(2500);
  await aufKarte(t2);
  const tf2 = await tafel(t2.page);
  check('2a: im fremden System ohne Vorposten steht der Bau-Knopf, frei, mit den Kosten im Titel', tf2.bauKnopf.da && !tf2.bauKnopf.disabled && /Baukosten/.test(tf2.bauKnopf.titel), tf2.bauKnopf);
  const erzVor = t2.stand().resources.erz;
  t2.page.once('dialog', d => d.accept());
  await t2.page.evaluate(() => { const b = document.querySelector('#mapBaseLinks [data-vorposten-bau]'); if (b) b.click(); });
  await t2.page.waitForTimeout(3500);   // save() ist entprellt - der Spielstand im Mock braucht einen Moment
  const st2 = t2.stand();
  const mb = ((st2.fleet||{}).missions||[]).find(m => m.type === 'vorposten-bau');
  check('2b: der Start legt eine Bau-Mission an - Form A, Kolonieschiff als Baukolonne, targetId = System', !!mb && mb.targetId === SYS && mb.system === SYS && mb.composition && mb.composition.colonyShips === 1 && !mb.hinBis && mb.endTime > mb.startTime, mb && { targetId: mb.targetId, composition: mb.composition, hinBis: mb.hinBis });
  check('2c: und zahlt die Baukosten (60.000 Erz plus Treibstoff)', erzVor - (st2.resources||{}).erz >= 60000, { vorher: erzVor, nachher: (st2.resources||{}).erz });
  await t2.ctx.close();
  // 2d in einem FRISCHEN Tab: Von chronos aus nach kepler zu wechseln liess die erste Fassung auf
  // chronos stehen (der Knopf zeigte "Baukolonne bereits unterwegs" - also das falsche System).
  const tH = await tab(browser, fixture(), { ohneVorposten: true });
  await tH.page.waitForTimeout(2500);
  await aufKarte(tH, 'kepler');
  const tfH = await tafel(tH.page);
  const heimOffen = await tH.page.evaluate(() => (document.getElementById('systemNavName')||{}).textContent || '');
  check('2d-anker: das Heimatsystem ist geoeffnet', /Kepler/.test(heimOffen), { name: heimOffen });
  check('2d: im Heimatsystem gibt es keinen Bau-Knopf', !tfH.bauKnopf.da, tfH.bauKnopf);
  await tH.ctx.close();

  // ---- 3) Die Weiche (i) als PAAR --------------------------------------------------------------------
  const tOhne = await tab(browser, fixture(), { ohneVorposten: true });
  await tOhne.page.waitForTimeout(2500);
  await aufKarte(tOhne);
  const kennOhne = (await tafel(tOhne.page)).kenn;
  const anfOhne = await anfechtungHinflug(tOhne);
  await tOhne.ctx.close();
  const tMit = await tab(browser, fixture(), { eigener: true });
  await tMit.page.waitForTimeout(2500);
  await aufKarte(tMit);
  const kennMit = (await tafel(tMit.page)).kenn;
  const anfMit = await anfechtungHinflug(tMit);
  const sek = s => { if (!s) return null; let t = 0; const h = s.match(/(\d+)h/), m = s.match(/(\d+)m/), x = s.match(/(\d+)s/); if (h) t += +h[1]*3600; if (m) t += +m[1]*60; if (x) t += +x[1]; return t; };
  const erkOhne = sek((kennOhne.match(/Erkundung ab ([0-9hms ]+?) ·/) || [])[1]), erkMit = sek((kennMit.match(/Erkundung ab ([0-9hms ]+?) ·/) || [])[1]);
  check('3a-anker: beide Erkundungszeiten sind lesbar', erkOhne > 0 && erkMit > 0, { kennOhne, kennMit });
  check('3b: mit eigenem Vorposten (flug 0,15) ist die Erkundung ins System KUERZER', erkMit < erkOhne, { ohne: erkOhne, mit: erkMit });
  check('3c: die Hinflugzeit der ANFECHTUNG ist mit und ohne Vorposten IDENTISCH (PvP unberuehrt)', !!anfOhne && anfOhne === anfMit, { ohne: anfOhne, mit: anfMit, hinweis: 'ein Faktor in missionDurationFor selbst erreichte die Anfechtung' });
  const tfMit = await tafel(tMit.page);
  check('3d: der eigene Vorposten steht als „Dein" in Chip und Knopf', /Dein Bastion/.test(tfMit.chips) && tfMit.vpKnopf, { chips: tfMit.chips.slice(0, 200) });
  await tMit.ctx.close();

  // ---- 4/5) Angriff angekommen + Belohnung ------------------------------------------------------------
  {
    const st = JSON.parse(fixture());
    st.fleet.missions = [{ id: 91, type:'vorposten-angriff', targetId: SYS, system: SYS, vorpostenId: 'vp-test-1', besitzerName: 'Rivale', stufeName: 'Stützpunkt',
      startTime: Date.now() - 7200000, endTime: Date.now() - 1000, fleetName: 'Sturmverband', composition: { cruisers: 100 } }];
    const t4 = await tab(browser, JSON.stringify(st), { gefallen: true, belohnungen: [
      { type:'vorposten', system: SYS, stufe: 2, name: 'Stützpunkt', besitzerName: 'Rivale', anteil: 0.6, kampfpunkte: 48, xp: 420, credits: 2100, zeit: Date.now() },
      { type:'vorposten-verlust', system: SYS, stufe: 1, name: 'Feldlager', angreiferName: 'Rivale', teilnehmer: 1, garnisonVerloren: { jaeger: 20 }, zeit: Date.now() }
    ] });
    await t4.page.waitForTimeout(5000);
    const nach = t4.stand();
    check('4a: der Server wurde mit System, Mission und Vorposten-Kennung gefragt', (t4.store.__angriff||[]).length >= 1 && t4.store.__angriff[0].system === SYS && String(t4.store.__angriff[0].missionId) === '91' && t4.store.__angriff[0].vorpostenId === 'vp-test-1', t4.store.__angriff);
    check('4b: GENAU die Verluste des Servers sind gebucht (120 im Bestand - 9 = 111 Kreuzer)', (nach.fleet||{}).cruisers === 111, { cruisers: (nach.fleet||{}).cruisers });
    const ber = (t4.store.__berichte||[]).find(b => b.type === 'vorposten-angriff');
    check('4c: der Bericht vom Typ vorposten-angriff nennt Schaden, Durchschlag und Anteil', !!ber && ber.schaden === 12000 && ber.gefallen === true && ber.anteil === 0.6 && ber.durchschlag === 0.42, ber && { schaden: ber.schaden, gefallen: ber.gefallen, anteil: ber.anteil });
    check('4d: bei `gefallen` wurde das Belohnungsfach abgerufen', (t4.store.__claims||0) >= 2, { claims: t4.store.__claims });
    check('5a: die Beute (vorposten) ist gebucht: Kampfpunkte und Kredite', (nach.battlePoints||0) >= 48 && (nach.credits||0) >= (JSON.parse(fixture()).credits||0) + 2100, { bp: nach.battlePoints, credits: nach.credits });
    const verl = (t4.store.__berichte||[]).find(b => b.type === 'vorposten-verteidigung');
    check('5b: der Verlust (vorposten-verlust) schreibt einen Bericht vorposten-verteidigung mit Angreifer und verlorener Garnison', !!verl && verl.gefallen === true && verl.angreiferName === 'Rivale' && verl.garnisonVerloren && verl.garnisonVerloren.jaeger === 20, verl);
    check('5c: keine Seitenfehler', t4.errs.length === 0, t4.errs.slice(0, 2));
    await t4.ctx.close();
  }
  await browser.close();
  ende();
})();
