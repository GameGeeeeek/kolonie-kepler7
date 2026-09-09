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
// KB-31 (1g): Der Bahn-Waechter erkennt die Flugbahn an `data-kb-bahn` statt an ihrer
//   Strichstaerke. 1g stellt die Falle selbst auf - ein Vorposten mit zwei Projektlinien
//   derselben Signatur - und misst BEIDE Wege nebeneinander, damit der Befund belegt ist und
//   nicht behauptet.
//
// GEGENPROBE: KEPLER_KAF_GEGENPROBE=alt gegen den Stand vor KA-2/KA-3.
//   KEPLER_KAF_GEGENPROBE=bahn gegen den Stand vor KB-31: dort gibt es kein `data-kb-bahn`,
//   1d und 1g fallen beide.
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
const MUSS_FALLEN = { alt: ['1a', '1b', '1c', '1d', '1e', '3a', '3b'], bahn: ['1d', '1g'] };

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';

/* EIN VORPOSTEN MIT ZWEI KOEDERLINIEN (KB-31). `tiefenhorchen` und `sprungtor` zeichnen je eine
   <line> mit stroke-width 1.5 und ohne dasharray - dieselbe Signatur, die der Bahn-Waechter hier
   frueher als Suchmuster benutzte. Sie stehen VOR den Routen im Markup, also traf `linien[0]` sie
   und nicht die Flugbahn. Das Fixture stellt genau diese Falle auf. */
function vorpostenAntwort(){
  const jetzt = Date.now();
  const stufen = [1,2,3,4,5,6,7,8].map(n => ({ stufe:n, name:'Stufe '+n, kernLp: 20000*n, verteidigung: 2500*n,
    garnisonMax: 300*n, flug:0.06, prod:0.015, scan:1, kosten: n===1?null:{ erz:1000 } }));
  return { ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000,
    ausbauMs:43200000, garnisonFaktor:0.5, stufen, zweigAb:4, maxStufe:8, eigene:1,
    zweige:[{ key:'werft', name:'Werft', kurz:'x', namen:{4:'Werftgerüst',5:'Dockring',6:'Schiffsschmiede',7:'Flottenwerft',8:'Sternenwerft'}, mult:{} }],
    modulDefs:[], modulSeltenheiten:{}, modulBestand:{}, modulSlotsMax:5, projektDefs:[], projekteAktiv:true,
    flugDeckel:0.5, abbauMs:86400000, abbauAktiv:true, lagerAktiv:true, dockMax:7,
    liste:[{ id:'vp-k', sys:SYS, besitzer:'u', besitzerName:'A', seit: jetzt-86400000,
      stufe:8, name:'Sternenwerft', zweig:'werft', zweigName:'Werft', maxStufe:8,
      kern:{ lp:100000, lpMax:100000 }, verteidigung:20000,
      garnisonAnzahl:0, garnisonMax:3000, garnison:{},
      slots:5, module:[], modulBoni:null, projekte:['tiefenhorchen','sprungtor'], projektBoni:null,
      lager:{}, lagerVollAb: jetzt+36e5, dockBereit:0,
      abbauAb:null, schutzBis:0, ausbauAb: jetzt-1000,
      nutzen:{ flug:0.2, prod:0.05, scan:3, flugDeckel:0.5 }, eigener:true,
      anflug:[], meinLetzterSchlag:0, letzterKampf:null, kampfverlauf:[], naechsteStufe:null }] };
}
function backend(store, mitVorposten){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[], collapsedSystems:{},
      activeWormhole:null, news:[], controlledSystems:{}, factions:{}, alienNester: [] });
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{} } } });
    if (p === 'vorposten' && mitVorposten) return j(vorpostenAntwort());
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
async function karte(browser, store, mitVorposten){
  const ctx = await browser.newContext({ viewport: { width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store, !!mitVorposten));
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
    /* DIE BAHN WIRD AN IHREM MERKMAL ERKANNT, nicht an ihrer Strichstaerke (KB-31, 08.09.2026).
       Vorher stand hier ein Filter ueber "stroke-width 1.5 und kein dasharray" und danach
       linien[0]. Dieselbe Signatur tragen zwei Linien der Vorposten-Silhouette (Peilstrahl des
       Tiefenhorchens, Mast zum Sprungtor), und die stehen VOR den Routen im Markup - steht ein
       Vorposten im System, mass der Waechter dessen Mast. Gefallen ist er nie, weil kein Fixture
       hier einen Vorposten setzt; die Pruefung war also seit ihrem ersten Tag von der Abwesenheit
       eines Vorpostens abhaengig, ohne dass das irgendwo stand. */
    const linien = [...svg.querySelectorAll('line[data-kb-bahn]')];
    /* DER ALTE WEG WIRD MITGEMESSEN, nicht nur ersetzt. Sonst belegte die Pruefung zwar, dass der
       neue Weg funktioniert, aber nie, dass der alte falsch war - und der Befund waere eine
       Behauptung geblieben. `koeder` ist die Zahl der Linien, die das alte Suchmuster traf. */
    const alteTreffer = [...svg.querySelectorAll('line')].filter(l => Number(l.getAttribute('stroke-width')) === 1.5 && !l.getAttribute('stroke-dasharray'));
    const winkelVon = l => Math.round(Math.atan2(+l.getAttribute('y2') - +l.getAttribute('y1'), +l.getAttribute('x2') - +l.getAttribute('x1')) * 180/Math.PI);
    const bahnAlt = alteTreffer.length ? winkelVon(alteTreffer[0]) : null;
    let bahn = null;
    if (linien.length){
      const l = linien[0];
      bahn = Math.round(Math.atan2(+l.getAttribute('y2') - +l.getAttribute('y1'), +l.getAttribute('x2') - +l.getAttribute('x1')) * 180/Math.PI);
    }
    const w = mt ? Math.round(Number(mt[3])) : null;
    const kasten = g.getBoundingClientRect();
    return { svg:true, marke:true, pfeile, bilder: bilder.length,
      groessen: bilder.map(i => Number(i.getAttribute('width'))).sort((a,b) => a-b),
      winkel: w, bahn, bahnAlt, koeder: alteTreffer.length, bahnZahl: linien.length, abweichung: (w !== null && bahn !== null) ? Math.round(((w - bahn) % 360 + 540) % 360 - 180) : null,
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

    /* 1g: KB-31 - DIE BAHN WIRD AN IHREM MERKMAL ERKANNT, nicht an ihrer Strichstaerke.
       Derselbe Lauf wie 1a-1f, nur steht jetzt ein eigener Vorposten mit den Projekten
       `tiefenhorchen` und `sprungtor` im System. Beide zeichnen eine <line> mit stroke-width 1.5
       und ohne dasharray - dieselbe Signatur, ueber die dieser Waechter die Flugbahn frueher
       suchte - und sie stehen VOR den Routen im Markup.
       GEMESSEN WERDEN BEIDE WEGE NEBENEINANDER, und das ist der Kern: `bahnAlt` ist der Winkel,
       den das alte Suchmuster geliefert haette, `bahn` der des neuen. Sind sie verschieden, ist
       der Befund belegt statt behauptet - der alte Weg mass wirklich den falschen Strich. Und die
       Flottenmarke steht auf dem NEUEN, nicht auf dem alten.
       Der Fall ist nie aufgefallen, weil kein Fixture dieser drei Waechter einen Vorposten setzt:
       Die Pruefung hing seit ihrem ersten Tag an der Abwesenheit eines Vorpostens, ohne dass das
       irgendwo stand. */
    const sVp = { [SAVE_KEY]: stand({ comp: { spaeher: 3 } }) };
    const t2b = await karte(browser, sVp, true);
    const mv = await messeMarke(t2b.page);
    check('1g: mit einem Vorposten im System findet der Waechter die BAHN und nicht dessen Projektlinien',
      mv.marke === true && mv.bahnZahl >= 1 && mv.koeder > mv.bahnZahl
      && mv.bahnAlt !== mv.bahn && mv.abweichung === 0,
      { koeder: mv.koeder, bahnen: mv.bahnZahl, winkelAltesMuster: mv.bahnAlt,
        winkelBahn: mv.bahn, markenwinkel: mv.winkel, abweichung: mv.abweichung });
    check('1h: und dabei keine Skriptfehler', t2b.errs.length === 0, t2b.errs.slice(0, 2));
    await t2b.ctx.close();

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
