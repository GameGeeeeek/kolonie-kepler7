// KB-23: Die Ebenen-Schalter wirken auf der Systemebene - dort, wo man sie sieht.
//
//   node tests/test_kartenebenen.js
//
// DER BEFUND, gegen den das gebaut wurde (08.09.2026, gemessen): Der Knopf „Routen" wird
// AUSSCHLIESSLICH auf der Systemebene eingeblendet - in der Sektoransicht blendet buildGalaxyMap
// ihn aus. Gedeckelt hat `karteEbeneAn('routen')` aber nur die systemuebergreifenden Linien, und
// die zeichnet die Uebersicht. Ergebnis: System oeffnen, Knopf druecken, Zustand springt von
// `active` auf inaktiv - und im Bild aendert sich NICHTS. Gemessen 17 Bilder, 7 Pfade, 14 Texte
// vorher wie nachher. Ein sichtbarer Schalter ohne Wirkung ist schlimmer als keiner: Er behauptet
// eine Einstellmoeglichkeit, die es nicht gibt.
//
// GEPRUEFT WIRD DIE REGEL, und zwar in BEIDE Richtungen. Ein Test, der nur „aus" misst, ist von
// einem Zeichenfehler nicht zu unterscheiden, der die Marken ohnehin verschluckt:
//   1a  Vorbedingung: Leiste und Knopf sind da, der Knopf ist an, und es steht ueberhaupt etwas
//       zum Ausblenden im Bild. Ohne diese Zeile koennte alles Folgende gruen sein, weil nie
//       etwas gezeichnet wurde.
//   1b  Routen AUS  -> die eigene Flottenmarke und ihre Beschriftung verschwinden.
//   1c  Routen AN   -> sie kommen zurueck. Der Rueckweg ist die Haelfte, die belegt, dass 1b den
//       Schalter gemessen hat und nicht einen kaputten Aufbau.
//   2a  Aufklaerung AUS -> die fremde Flotte verschwindet.
//   2b  Aufklaerung AUS laesst die EIGENEN Marken unberuehrt - die Schalter sind unabhaengig.
//       Das ist die Zusage hinter der Aufteilung: Wer den eigenen Verkehr ausblendet, will
//       trotzdem sehen, wer auf ihn zufliegt, und umgekehrt.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor KB-23
// (`git show 7d6beb2:weltraum_kolonie.html`), Aufruf mit KEPLER_EBENEN_GEGENPROBE=alt.
const { starteBrowser, SPIELDATEI, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check: rohCheck, ende } = pruefer();
const ergebnis = {};
const check = (name, bedingung, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bedingung; rohCheck(name, bedingung, zusatz); };

const SAB = process.env.KEPLER_EBENEN_GEGENPROBE || '';
/* GEMESSEN gegen origin/main a415efb (Stand vor KA-2/KA-3), nicht geschaetzt.
   2a fehlt hier BEWUSST und ist kein Mangel: Es prueft, dass ohne Praesenz NICHTS zu sehen ist -
   und ohne KA-3 ist dort nie etwas zu sehen. Es belegt also nichts ueber KA-3; scharf wird es
   erst am neuen Stand, wo etwas zu sehen sein KANN. Dieselbe Ueberlegung wie bei 2a/3a in
   test_kampfanimation.js. */
const MUSS_FALLEN = { alt: ['1b', '2a'] };

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


/* Zaehlt, was auf der Systemebene zu sehen ist. Getrennt nach Herkunft, weil genau die Trennung
   geprueft wird: eigene Flottenmarken (gezeichnete Ruempfe) gegen fremde Bahnen (gestrichelte
   Linien). Gemessen am GERENDERTEN Bild, nicht am Quelltext. */
async function bild(page){
  return page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const leiste = document.getElementById('karteEbenenLeiste');
    const knopf = k => leiste && leiste.querySelector('[data-karte-ebene="' + k + '"]');
    const texte = svg ? [...svg.querySelectorAll('text')].map(t => (t.textContent||'').trim()) : [];
    return {
      leiste: !!(leiste && leiste.getClientRects().length),
      routenKnopf: !!(knopf('routen') && knopf('routen').getClientRects().length),
      routenAn: !!(knopf('routen') && knopf('routen').classList.contains('active')),
      aufklaerungKnopf: !!(knopf('aufklaerung') && knopf('aufklaerung').getClientRects().length),
      aufklaerungAn: !!(knopf('aufklaerung') && knopf('aufklaerung').classList.contains('active')),
      /* EIGENE Marken sind alle gezeichneten Ruempfe AUSSER denen der fremden Flotten - die
         werden mit derselben Funktion gezeichnet und sind sonst nicht zu unterscheiden. Genau
         daran ist der erste Entwurf dieser Pruefung gescheitert: 2b zaehlte 15 gegen 11 und
         meldete rot, obwohl die vier fehlenden Bilder die fremde Flotte waren, die beim
         Ausblenden der Aufklaerung korrekt verschwand. Der Container-Selektor ist deshalb
         Pflicht, nicht Feinschliff (Hausregel: Selektoren auf den geprueften Container
         begrenzen). */
      eigeneBilder: svg ? [...svg.querySelectorAll('image')].filter(i => !i.closest('[data-map-fremdflotte]')).length : 0,
      eigeneTexte: texte.filter(t => /Schiffe?$|Rückflug/.test(t)).length,
      fremdeBilder: svg ? svg.querySelectorAll('[data-map-fremdflotte] image').length : 0,
      fremdeBahnen: svg ? svg.querySelectorAll('line[stroke-dasharray="4,4"]').length : 0,
      fremdeTexte: texte.filter(t => /Nova/.test(t)).length
    };
  });
}
async function schalte(page, ebene){
  await page.evaluate(e => {
    const k = document.querySelector('#karteEbenenLeiste [data-karte-ebene="' + e + '"]');
    if (k) k.click();
  }, ebene);
  await page.waitForTimeout(1600);   // der Kartenaufbau laeuft im Sekundentakt
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
      st.fleet.missions = [{ id:7001, type:'explore', system:SYS, targetId:'chronos1',
        fleetName:'Testflotte', startTime: jetzt-30000, endTime: jetzt+600000,
        composition: { jaeger:120, cruisers:20 } }];
      st.colonies = Object.assign({}, st.colonies, { 'chronos1': { buildings:{ solar:3 }, name:'Außenposten' } });
      const fern = jetzt + 365*24*3600*1000;
      for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
      st.activeEvent = null; st.buffs = [];
      return JSON.stringify(st);
    }
    const fremdeMeldung = JSON.stringify({ id:'x9', name:'Nova', updated: jetzt, missions: [
      { type:'attack', originSystem:'vega', destSystem:SYS, startTime: jetzt-120000, endTime: jetzt+600000,
        fleetName:'Sturmflotte', composition:{ jaeger:120, schlachtschiff:6 } } ]});

    const store = { [SAVE_KEY]: stand({}), 'missions:x9': fremdeMeldung };
    const t = await karte(browser, store);

    const an = await bild(t.page);
    check('1a: Leiste, beide Knoepfe und etwas zum Ausblenden sind da (Vorbedingung)',
      an.leiste && an.routenKnopf && an.routenAn && an.aufklaerungKnopf && an.aufklaerungAn
      && an.eigeneBilder > 0 && an.eigeneTexte > 0 && an.fremdeBahnen > 0 && an.fremdeTexte > 0, an);
  /* `fremdeBilder` steht bewusst NICHT in dieser Vorbedingung, obwohl es naheliegt: Der Zaehler
     haengt am Merkmal data-map-fremdflotte, und das gibt es erst seit KB-23. Am Vergleichsstand
     waere 1a damit rot - eine Vorbedingung, die am alten Stand nicht gilt, kann nichts absichern,
     und die roten 1b/2a stuenden dann unter dem Verdacht, nur Folgefehler zu sein. Gemessen wird
     hier deshalb, was es in BEIDEN Staenden gibt: die gestrichelte Bahn und ihre Beschriftung. */

    await schalte(t.page, 'routen');
    const ohneRouten = await bild(t.page);
    check('1b: Routen AUS blendet die eigene Flottenmarke samt Beschriftung aus',
      ohneRouten.routenAn === false && ohneRouten.eigeneBilder < an.eigeneBilder && ohneRouten.eigeneTexte === 0,
      { vorher: { bilder: an.eigeneBilder, texte: an.eigeneTexte },
        nachher: { bilder: ohneRouten.eigeneBilder, texte: ohneRouten.eigeneTexte } });

    await schalte(t.page, 'routen');
    const wieder = await bild(t.page);
    check('1c: Routen AN holt sie zurueck (Gegenrichtung im selben Lauf)',
      wieder.routenAn === true && wieder.eigeneBilder === an.eigeneBilder && wieder.eigeneTexte === an.eigeneTexte,
      { anfang: { bilder: an.eigeneBilder, texte: an.eigeneTexte },
        zurueck: { bilder: wieder.eigeneBilder, texte: wieder.eigeneTexte } });

    await schalte(t.page, 'aufklaerung');
    const ohneAufk = await bild(t.page);
    check('2a: Aufklaerung AUS blendet die fremde Flotte aus',
      ohneAufk.aufklaerungAn === false && ohneAufk.fremdeBahnen === 0 && ohneAufk.fremdeTexte === 0
      && ohneAufk.fremdeBilder === 0,
      { vorher: { bahnen: an.fremdeBahnen, texte: an.fremdeTexte, bilder: an.fremdeBilder },
        nachher: { bahnen: ohneAufk.fremdeBahnen, texte: ohneAufk.fremdeTexte, bilder: ohneAufk.fremdeBilder } });
    check('2b: und laesst die EIGENEN Marken unberuehrt (die Schalter sind unabhaengig)',
      ohneAufk.eigeneBilder === an.eigeneBilder && ohneAufk.eigeneTexte === an.eigeneTexte,
      { erwartet: { bilder: an.eigeneBilder, texte: an.eigeneTexte },
        gemessen: { bilder: ohneAufk.eigeneBilder, texte: ohneAufk.eigeneTexte } });

    check('3a: keine Skriptfehler beim Schalten', t.errs.length === 0, t.errs.slice(0, 2));
    await t.ctx.close();
  } finally {
    await browser.close();
  }

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = soll.filter(n => ergebnis[n] === false);
    console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' der Pflichtliste gefallen (' +
      soll.map(n => n + '=' + (ergebnis[n] === false ? 'rot' : 'gruen')).join(' ') + ')');
    if (gefallen.length !== soll.length){
      console.log('FAIL - Gegenprobe unvollstaendig: ' + soll.filter(n => ergebnis[n] !== false).join(', ') + ' blieben gruen');
      process.exitCode = 1;
      return;
    }
    process.exitCode = 0;
    return;
  }
  ende();
})().catch(e => { console.error('FAIL - Abbruch:', e); process.exit(1); });
