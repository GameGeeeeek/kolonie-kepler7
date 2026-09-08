// KB-24: Die Bergbauflotte bekommt eine Route - und ein eigenes Symbol.
//
//   node tests/test_kartenebergbau.js
//
// FEHLERBERICHT Sascha (08.09.2026, woertlich): „die wird bei normalen Flotten angezeigt, aber
// nicht, wenn du eine reine Bergbauflotte losschickst … zeig das trotzdem auch an, ein anderes
// Symbol, wenn du nur Recycler und Frachtschiffe dafuer losschickst, soll ein anderes Symbol sein
// wie eine Kampfflotte."
//
// GEMESSEN: 'mining' und 'mining-escort' standen NICHT in MISSION_LINIEN, und die Zeichenschleife
// filtert ueber genau diese Tabelle. Eine Abbauflotte hatte also nie eine Bahn - das war keine
// Regression, sondern eine Luecke von Anfang an.
//
// GEPRUEFT WIRD AM GERENDERTEN BILD, und jeweils die REGEL:
//   1a  Die Abbauflotte hat ueberhaupt eine Bahn und eine Marke. Das ist die Haelfte des Berichts.
//   1b  Ihre Marke sieht ANDERS AUS als die einer Kampfflotte. Gemessen wird die FORM, nicht der
//       Rumpf: Der Konvoi steht in einer Reihe (alle Bilder gleich gross, gleicher Abstand), die
//       Kampfflotte im Keil (ein grosses Flaggschiff, kleinere Begleiter). Zwei verschiedene
//       Ruempfe waeren KEIN Beleg - ein Bergungsfrachter ist auf 22 Karteneinheiten von einem
//       Zerstoerer kaum zu unterscheiden, und genau deshalb traegt die Form die Aussage.
//   1c  Eine Abbauflotte MIT Kampfschiffen faellt zurueck in den Keil. Das ist die Gegenrichtung
//       der Regel: „reine" Bergbauflotte heisst reine, sonst waere die Auskunft gelogen.
//   2a  Waehrend der Foerderung steht die Marke AM VORKOMMEN und nicht auf halbem Rueckweg.
//       Das ist die Falle, vor der der Code an der Schuerfrecht-Anfechtung ausdruecklich warnt:
//       „der Kartenzeichner kennt hinBis nicht und halbiert stur bei frac>=0.5". Bei einer
//       Abbaumission liegt die Haelfte der Gesamtzeit mitten im Abbau.
//   2b  Und die Beschriftung sagt dann „foerdert" statt einer Schiffszahl an einer Marke, die
//       sich nicht bewegt.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor KB-24 (`git show d4fa4eb:weltraum_kolonie.html`),
// Aufruf mit KEPLER_BERGBAU_GEGENPROBE=alt. Dort fallen 1a, 1b und 2a - es gibt schlicht nichts.
const { starteBrowser, SPIELDATEI, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check: rohCheck, ende } = pruefer();
const ergebnis = {};
const check = (name, bedingung, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bedingung; rohCheck(name, bedingung, zusatz); };

const SAB = process.env.KEPLER_BERGBAU_GEGENPROBE || '';
/* GEMESSEN gegen origin/main a415efb (Stand vor KA-2/KA-3), nicht geschaetzt.
   2a fehlt hier BEWUSST und ist kein Mangel: Es prueft, dass ohne Praesenz NICHTS zu sehen ist -
   und ohne KA-3 ist dort nie etwas zu sehen. Es belegt also nichts ueber KA-3; scharf wird es
   erst am neuen Stand, wo etwas zu sehen sein KANN. Dieselbe Ueberlegung wie bei 2a/3a in
   test_kampfanimation.js. */
const MUSS_FALLEN = { alt: ['1a', '1b', '2a'] };

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
    /* Der Guertel traegt jetzt einen Brocken auf Platz '3' - denselben, auf den die Fixture-Mission
       zielt. Mit dem leeren `plaetze:{}` von vorher gab es keinen [data-map-asteroid]-Marker, 2a
       hatte also kein messbares Ziel und meldete `ziel: null`: rot aus dem falschen Grund. */
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{
      '3': { sorte:'eisen', groesse:'brocken', vorrat:90000 } } } } });
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


/* Misst die FORM der Marke: Wie viele gezeichnete Ruempfe, welche Groessen, und stehen sie in
   einer Reihe? Der Konvoi hat lauter gleich grosse Bilder, der Keil genau ein grosses. */
/* Misst die FORM der Marke: wie viele gezeichnete Ruempfe, welche Groessen, und stehen sie in
   einer Reihe? Der Konvoi hat lauter gleich grosse Bilder, der Keil genau ein grosses.
   GESCOPT auf `[data-map-flotte]`. Ein Zaehler ueber alle <image> misst die halbe Karte mit -
   Nester, Vorposten und Wrackkonvois zeichnen ebenfalls Bilder. Genau so ist der erste Entwurf
   dieser Pruefung gescheitert: 9 Bilder gemessen, davon gehoerten 2 zur Flotte. */
async function messeForm(page){
  return page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    if (!svg) return { svg:false };
    const marke = svg.querySelector('[data-map-flotte]');
    const bilder = marke ? [...marke.querySelectorAll('image')] : [];
    const groessen = bilder.map(i => Math.round(Number(i.getAttribute('width')))).sort((a,b)=>a-b);
    const versatz = bilder.map(i => Math.round(Number(i.getAttribute('y')) + Number(i.getAttribute('height'))/2));
    return { svg:true, art: marke ? marke.getAttribute('data-map-flotte') : null,
      anzahl: bilder.length, groessen,
      // Eine Reihe liegt auf EINER Achse: alle y-Mitten gleich. Der Keil setzt zwei daneben.
      eineReihe: versatz.length > 1 && new Set(versatz).size === 1,
      verschiedeneGroessen: new Set(groessen).size,
      texte: [...svg.querySelectorAll('text')].map(t => (t.textContent||'').trim()) };
  });
}
async function markenOrt(page){
  return page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const g = svg && svg.querySelector('[data-map-flotte]');
    if (!g) return null;
    const mt = /translate\(([-\d.]+),([-\d.]+)\)/.exec(g.getAttribute('transform')||'');
    const ast = document.querySelector('[data-map-asteroid]');
    let ziel = null;
    if (ast){ const b = ast.getBBox(); ziel = { x: b.x + b.width/2, y: b.y + b.height/2 }; }
    return mt ? { x:+mt[1], y:+mt[2], ziel } : null;
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
    /* Die Zeiten sind der Kern von 2a: hinBis liegt HINTER uns, abbauBis weit voraus - die Flotte
       foerdert also gerade. Gleichzeitig liegt `jetzt` deutlich ueber der HALBEN Gesamtzeit
       (30 s von 600 s Anflug, Abbau bis 900 s, Rueckkehr bei 930 s): Der alte Zeichner haette sie
       damit auf den Rueckweg gesetzt. Genau diese Kluft macht die Pruefung aussagekraeftig. */
    function stand(opt){
      opt = opt || {};
      const st = JSON.parse(JSON.stringify(basis));
      st.fleet = Object.assign({}, st.fleet, { jaeger:400, frachter:60, recycler:20, cruisers:80, missions: [] });
      const comp = opt.comp || { frachter: 12, recycler: 6 };
      const platz = opt.peilung ? 'p3' : '3';
      st.fleet.missions = [Object.assign({
        id: 8101, type: opt.typ || 'mining', targetId: SYS + ':' + platz, system: SYS, platz: platz,
        peilung: !!opt.peilung,
        fleetName: 'Erzzug', startTime: jetzt - 30000, composition: comp
      }, opt.zeiten || { hinBis: jetzt - 5000, abbauBis: jetzt + 870000, endTime: jetzt + 900000 })];
      const fern = jetzt + 365*24*3600*1000;
      for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
      st.activeEvent = null; st.buffs = [];
      return JSON.stringify(st);
    }

    // ---- 1) Die Bahn ist ueberhaupt da, und die Form ist eine andere ------------------------
    const t1 = await karte(browser, { [SAVE_KEY]: stand({}) });
    const bergbau = await messeForm(t1.page);
    check('1a: die reine Bergbauflotte hat eine Marke auf der Karte',
      bergbau.svg === true && bergbau.anzahl >= 1, bergbau);
    const ortB = await markenOrt(t1.page);
    await t1.ctx.close();

    /* Der Vergleich laeuft ueber DIESELBE Mission zum selben Ziel - der einzige Unterschied ist
       die Zusammensetzung. Waere die Form gleich, koennte kein Spieler die beiden unterscheiden.
       Ein erster Entwurf verglich gegen eine `attack`-Mission mit derselben targetId; die zielt
       aber auf einen NPC, den es unter `sys:platz` nicht gibt, also wurde gar nichts gezeichnet
       und 1b war rot aus dem falschen Grund (gemessen: 0 Bilder). */
    const t3 = await karte(browser, { [SAVE_KEY]: stand({ comp: { frachter: 12, recycler: 6, jaeger: 40 } }) });
    const gemischt = await messeForm(t3.page);
    await t3.ctx.close();

    check('1b: sie sieht ANDERS aus als eine Kampfflotte (Reihe gegen Keil)',
      bergbau.art === 'bergbau' && gemischt.art === 'kampf'
      && bergbau.eineReihe === true && gemischt.eineReihe === false
      && bergbau.verschiedeneGroessen === 1 && gemischt.verschiedeneGroessen > 1,
      { bergbau: { art: bergbau.art, reihe: bergbau.eineReihe, groessen: bergbau.groessen },
        kampf:   { art: gemischt.art, reihe: gemischt.eineReihe, groessen: gemischt.groessen } });

    check('1c: eine Abbauflotte MIT Kampfschiffen faellt zurueck in die Kampfform',
      gemischt.art === 'kampf' && gemischt.eineReihe === false && gemischt.verschiedeneGroessen > 1,
      { art: gemischt.art, reihe: gemischt.eineReihe, groessen: gemischt.groessen });

    // ---- 2) Waehrend der Foerderung steht sie am Vorkommen ----------------------------------
    check('2a: waehrend der Foerderung steht die Marke AM VORKOMMEN, nicht auf halbem Rueckweg',
      !!(ortB && ortB.ziel) && Math.hypot(ortB.x - ortB.ziel.x, ortB.y - ortB.ziel.y) < 6,
      ortB ? { marke: { x:+ortB.x.toFixed(1), y:+ortB.y.toFixed(1) },
               ziel: ortB.ziel ? { x:+ortB.ziel.x.toFixed(1), y:+ortB.ziel.y.toFixed(1) } : null,
               abstand: ortB.ziel ? +Math.hypot(ortB.x-ortB.ziel.x, ortB.y-ortB.ziel.y).toFixed(1) : null } : null);

    check('2b: und die Beschriftung sagt, was sie tut',
      (bergbau.texte || []).some(t => /Erzzug/.test(t) && /fördert/.test(t)),
      { passende: (bergbau.texte||[]).filter(t => /Erzzug/.test(t)) });

    /* 2c ist der Waechter ueber den Fehler, den der erste Entwurf von KB-24 gebaut hat: Eine
       PEILUNG traegt eine ID wie 'p3' und liegt NICHT auf der Guertelbahn. asteroidPlatzXY rechnet
       `platz * 36`, aus 'p3' wird NaN, und die Bahn bekam x2="NaN" samt Konsolenfehler. Gefunden
       hat das der Bestandstest test_peilung, nicht dieser Waechter - und zwar erst im vollen
       Lauf. Deshalb steht die Pruefung jetzt HIER, wo sie in Sekunden statt in 43 Minuten faellt. */
    const t4 = await karte(browser, { [SAVE_KEY]: stand({ peilung: true }) });
    const peil = await messeForm(t4.page);
    check('2c: eine Peilung (Platz „p3", nicht auf der Guertelbahn) zeichnet keine Bahn ins Nichts',
      t4.errs.length === 0 && peil.art === null,
      { fehler: t4.errs.slice(0, 2), marke: peil.art });
    await t4.ctx.close();

    check('3a: keine Skriptfehler', t1.errs.length === 0, t1.errs.slice(0, 2));
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
