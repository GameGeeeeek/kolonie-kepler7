// KA-2 und KA-3: Die Flotte statt des Pfeils, und die Bewegungen der anderen
// (Auftrag Sascha, 07.09.2026, woertlich: „meine flotte nicht als pfeil anzeigen bei flotten
// bewegung sondern die flotte ansich … flotten bewegung auch anderer spieler anzeigen allerdings
// nur wenn ich einen horchposten oder einen planeten oder eine festung in dem system habe").
//
//   node tests/test_kartenflotten.js
//
// GEPRUEFT WIRD AM GERENDERTEN SPIEL, und jeweils die REGEL statt einer Momentaufnahme:
//
// KA-2 (1x): Der alte Pfeil ist weg, und an seiner Stelle steht ein gezeichneter Rumpf.
//   1c ist die eigentliche Zusage: Das GELEIT WAECHST mit der Flotte. Ein fest verdrahtetes Bild
//   erfuellte 1a und 1b, aber niemals 1c.
//   1d misst die AUSRICHTUNG gegen die Flugbahn. Der gezeichnete Rumpf zeigt nach rechts, der
//   alte Pfeil nach oben - wer das verwechselt, laesst die ganze Flotte quer zur Bahn fliegen,
//   und zwar unauffaellig genug, um es zu uebersehen.
//
// KA-3 (2x/3x): Die Sichtregel, in BEIDE Richtungen gemessen. Ohne Praesenz und ohne Posten darf
//   NICHTS zu sehen sein - das ist die Haelfte, die eine Aufklaerung ueberhaupt erst zu einer
//   Aufklaerung macht. 3a belegt, dass die eigene Praesenz sie oeffnet.
//
// GEGENPROBE: KEPLER_KAF_GEGENPROBE=alt gegen den Stand vor KA-2/KA-3.
const fs = require('fs');
const { starteBrowser, SPIELDATEI, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check: rohCheck, ende } = pruefer();
const ergebnis = {};
const check = (name, bedingung, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bedingung; rohCheck(name, bedingung, zusatz); };

const SAB = process.env.KEPLER_KAF_GEGENPROBE || '';
/* GEMESSEN gegen origin/main a415efb (Stand vor KA-2/KA-3), nicht geschaetzt.
   2a fehlt hier BEWUSST und ist kein Mangel: Es prueft, dass ohne Praesenz NICHTS zu sehen ist -
   und ohne KA-3 ist dort nie etwas zu sehen. Es belegt also nichts ueber KA-3; scharf wird es
   erst am neuen Stand, wo etwas zu sehen sein KANN. Dieselbe Ueberlegung wie bei 2a/3a in
   test_kampfanimation.js. */
const MUSS_FALLEN = { alt: ['1a', '1b', '1c', '1d', '1e', '3a', '3b'] };

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';

function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[], collapsedSystems:{},
      activeWormhole:null, news:[], controlledSystems:{}, factions:{}, alienNester: [] });
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{} } } });
    if (p === 'storage-list') return j({ keys: Object.keys(store).filter(k => k.indexOf('__') !== 0) });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|reports|vorposten/.test(p))
      return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}
async function karte(browser, store){
  const ctx = await browser.newContext({ viewport: { width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
    const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click();
  });
  await page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(3000);
  return { ctx, page, errs };
}
/* Misst die EIGENE Flottenmarke: die Gruppe mit translate+rotate, die gezeichnete Rumpfbilder
   enthaelt - und die Bahn, auf der sie sitzt. Der Vergleich der beiden Winkel ist die Aussage. */
async function messeMarke(page, farbe){
  return page.evaluate((f) => {
    const svg = document.getElementById('galaxyMapSvg');
    if (!svg) return { svg:false };
    const gruppen = [...svg.querySelectorAll('g')].filter(g => /rotate/.test(g.getAttribute('transform')||'')
      && [...g.querySelectorAll('image')].some(i => (i.getAttribute('href')||'').startsWith('data:image')));
    const pfeile = svg.querySelectorAll('polygon[points="0,-6 4,5 0,2 -4,5"]').length;
    if (!gruppen.length) return { svg:true, marke:false, pfeile };
    const g = gruppen[0];
    const mt = (g.getAttribute('transform')||'').match(/translate\(([-\d.]+),([-\d.]+)\)\s*rotate\(([-\d.]+)\)/);
    const bilder = [...g.querySelectorAll('image')];
    const linien = [...svg.querySelectorAll('line')].filter(l => Number(l.getAttribute('stroke-width')) === 1.5 && !l.getAttribute('stroke-dasharray'));
    let bahn = null;
    if (linien.length){
      const l = linien[0];
      bahn = Math.round(Math.atan2(+l.getAttribute('y2') - +l.getAttribute('y1'), +l.getAttribute('x2') - +l.getAttribute('x1')) * 180/Math.PI);
    }
    const w = mt ? Math.round(Number(mt[3])) : null;
    const kasten = g.getBoundingClientRect();
    return { svg:true, marke:true, pfeile, bilder: bilder.length,
      groessen: bilder.map(i => Number(i.getAttribute('width'))).sort((a,b) => a-b),
      winkel: w, bahn, abweichung: (w !== null && bahn !== null) ? Math.round(((w - bahn) % 360 + 540) % 360 - 180) : null,
      breite: Math.round(kasten.width), hoehe: Math.round(kasten.height),
      texte: [...svg.querySelectorAll('text')].map(t => (t.textContent||'').trim()).filter(t => /Schiffe?$|Rückflug/.test(t)) };
  }, farbe || '');
}
async function messeFremde(page){
  return page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    if (!svg) return { svg:false };
    return { svg:true,
      bahnen: svg.querySelectorAll('line[stroke-dasharray="4,4"]').length,
      texte: [...svg.querySelectorAll('text')].map(t => (t.textContent||'').trim()).filter(t => /Nova/.test(t)) };
  });
}

(async () => {
  const browser = await starteBrowser();
  try {
    const s0 = {};
    const t0 = await karte(browser, s0);
    const basis = JSON.parse(s0[SAVE_KEY] || '{}');
    await t0.ctx.close();
    check('0a: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
    if (!basis.buildings) return;

    const jetzt = Date.now();
    function stand(opt){
      opt = opt || {};
      const st = JSON.parse(JSON.stringify(basis));
      st.fleet = Object.assign({}, st.fleet, { jaeger:400, spaeher:20, cruisers:80, superschlachtschiff:3, missions: [] });
      if (opt.comp) st.fleet.missions = [{ id:7001, type:'explore', system:SYS, targetId:'chronos1',
        fleetName:'Testflotte', startTime: jetzt-30000, endTime: jetzt+600000, composition: opt.comp }];
      if (opt.kolonie) st.colonies = Object.assign({}, st.colonies, { 'chronos1': { buildings:{ solar:3 }, name:'Außenposten' } });
      const fern = jetzt + 365*24*3600*1000;
      for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
      st.activeEvent = null; st.buffs = [];
      return JSON.stringify(st);
    }
    const fremdeMeldung = JSON.stringify({ id:'x9', name:'Nova', updated: jetzt, missions: [
      { type:'attack', originSystem:'vega', destSystem:SYS, startTime: jetzt-120000, endTime: jetzt+600000,
        fleetName:'Sturmflotte', composition:{ jaeger:120, schlachtschiff:6 } } ]});

    // ---- 1) KA-2: die eigene Flotte ---------------------------------------------------------
    const sKlein = { [SAVE_KEY]: stand({ comp: { spaeher: 3 } }) };
    const t1 = await karte(browser, sKlein);
    const mk = await messeMarke(t1.page);
    check('1a: der alte Pfeil ist weg', mk.svg === true && mk.pfeile === 0, { pfeile: mk.pfeile });
    check('1b: an seiner Stelle steht ein gezeichneter Rumpf, sichtbar',
      mk.marke === true && mk.bilder >= 1 && mk.breite > 0 && mk.hoehe > 0, mk);
    check('1d: er fliegt ENTLANG der Bahn, nicht quer dazu',
      mk.abweichung === 0, { markenwinkel: mk.winkel, bahnwinkel: mk.bahn, abweichung: mk.abweichung });
    check('1e: die Beschriftung nennt die Schiffszahl',
      (mk.texte || []).some(t => /3 Schiffe/.test(t)), { texte: mk.texte });
    check('1f: keine Skriptfehler', t1.errs.length === 0, t1.errs.slice(0, 2));
    await t1.ctx.close();

    /* 1c: DIE EIGENTLICHE ZUSAGE. Zwei Laeufe, die sich NUR in der Flottengroesse unterscheiden -
       ein fest verdrahtetes Bild erfuellte 1a und 1b, aber niemals das hier. */
    const sGross = { [SAVE_KEY]: stand({ comp: { jaeger:200, superschlachtschiff:2, cruisers:40 } }) };
    const t2 = await karte(browser, sGross);
    const mg = await messeMarke(t2.page);
    check('1c: das Geleit WAECHST mit der Flotte (3 Schiffe gegen 242)',
      mk.marke === true && mg.marke === true && mg.bilder > mk.bilder,
      { klein: mk.bilder, gross: mg.bilder, groessenGross: mg.groessen });
    await t2.ctx.close();

    // ---- 2) KA-3: ohne Praesenz sieht man NICHTS ---------------------------------------------
    const sOhne = { [SAVE_KEY]: stand({}), 'missions:x9': fremdeMeldung };
    const t3 = await karte(browser, sOhne);
    const f3 = await messeFremde(t3.page);
    check('2a: ohne Abhorchposten und ohne eigene Praesenz bleibt die fremde Flotte unsichtbar',
      f3.bahnen === 0 && (f3.texte || []).length === 0, f3);
    await t3.ctx.close();

    // ---- 3) KA-3: mit eigener Praesenz sieht man sie -----------------------------------------
    const sMit = { [SAVE_KEY]: stand({ kolonie: true }), 'missions:x9': fremdeMeldung };
    const t4 = await karte(browser, sMit);
    const f4 = await messeFremde(t4.page);
    check('3a: mit einer eigenen Kolonie im System steht sie da - gestrichelt und mit Namen',
      f4.bahnen >= 1 && (f4.texte || []).some(t => /Nova/.test(t)), f4);
    check('3b: und die Auskunft nennt Art und Restzeit (volle Sicht im eigenen System)',
      (f4.texte || []).some(t => /Nova/.test(t) && /Angriff/.test(t) && /\d/.test(t)), { texte: f4.texte });
    check('3c: keine Skriptfehler', t4.errs.length === 0, t4.errs.slice(0, 2));
    await t4.ctx.close();
  } finally {
    await browser.close();
  }

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false).sort();
    const fehlt = soll.filter(k => gefallen.indexOf(k) < 0);
    const zuviel = gefallen.filter(k => soll.indexOf(k) < 0);
    console.log('\nGegenprobe „' + SAB + '": gefallen ' + JSON.stringify(gefallen) + ', erwartet ' + JSON.stringify(soll));
    if (fehlt.length || zuviel.length){
      console.log('FAIL - Gegenprobe: nicht gefallen ' + JSON.stringify(fehlt) + ', unerwartet gefallen ' + JSON.stringify(zuviel));
      process.exit(1);
    }
    console.log('PASS - Gegenprobe: genau die erwarteten Pruefungen sind gefallen.');
    process.exit(0);
  }
  ende();
})();
