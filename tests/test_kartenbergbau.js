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
/* `strahl` ist der Stand vor KA-2 (08.09.2026): Die Marke liegt dort EXAKT auf dem Vorkommen,
   einen Foerderstrahl gibt es nicht -> 2d und 2e fallen. 2a bleibt dort gruen und ist damit kein
   Beleg fuer KA-2, sondern die mitgezogene Zusage: Auf dem Vorkommen zu stehen war ja nie falsch,
   falsch waere die halbe Strecke. */
/* `sprung` ist der erste KA-2-Entwurf (de06f5b): Er zog den Halteabstand erst im Zeichnen ab, die
   Marke flog also bis in die Brockenmitte und sprang bei `hinBis` zurueck -> 2f faellt. */
const MUSS_FALLEN = { alt: ['1a', '1b', '2a'], strahl: ['2d', '2e'], sprung: ['2f'] };

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
    /* DIE BAHN WIRD AN IHREM MERKMAL ERKANNT, nicht an ihrer Strichstaerke (KB-31, 08.09.2026).
       Vorher stand hier ein Filter ueber "stroke-width 1.5 und kein dasharray" und danach
       linien[0]. Dieselbe Signatur tragen zwei Linien der Vorposten-Silhouette (Peilstrahl des
       Tiefenhorchens, Mast zum Sprungtor), und die stehen VOR den Routen im Markup - steht ein
       Vorposten im System, mass der Waechter dessen Mast. Gefallen ist er nie, weil kein Fixture
       hier einen Vorposten setzt; die Pruefung war also seit ihrem ersten Tag von der Abwesenheit
       eines Vorpostens abhaengig, ohne dass das irgendwo stand. */
    const linien = [...svg.querySelectorAll('line[data-kb-bahn]')];
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
    /* DER ANFANG DER BAHN wird mitgemessen, weil 2a seit KA-2 die REGEL prueft und nicht mehr
       einen Schwellwert: „am Vorkommen und nicht auf halbem Rueckweg" laesst sich nur gegen den
       Ort messen, an den der halbierende Fehler die Marke setzen wuerde - die MITTE der Route. */
    /* RUECKFALL AUF DAS ALTE SUCHMUSTER, wenn es `data-kb-bahn` noch nicht gibt: Das Merkmal kam
       erst mit KB-31 (08.09.2026). Ohne diesen Zweig maesse 2a an einem aelteren Stand gar nichts
       und faellt dann aus dem falschen Grund - der Gegenprobe-Lauf haette es als Beleg fuer KA-2
       gelesen, obwohl es nur die fehlende Bahn-Kennung war. Dieses Fixture setzt keinen Vorposten,
       das alte Muster ist hier also eindeutig. */
    const bahn = (svg && svg.querySelector('line[data-kb-bahn]'))
      || (svg && [...svg.querySelectorAll('line')].find(l => Number(l.getAttribute('stroke-width')) === 1.5 && !l.getAttribute('stroke-dasharray')))
      || null;
    const start = bahn ? { x:+bahn.getAttribute('x1'), y:+bahn.getAttribute('y1') } : null;
    const strahl = svg ? [...svg.querySelectorAll('[data-kb-foerderstrahl] line')].map(l => ({
      x1:+l.getAttribute('x1'), y1:+l.getAttribute('y1'), x2:+l.getAttribute('x2'), y2:+l.getAttribute('y2'),
      animiert: !!l.querySelector('animate'), zeiger: l.closest('[data-kb-foerderstrahl]').getAttribute('pointer-events') })) : [];
    return mt ? { x:+mt[1], y:+mt[2], ziel, start, strahl } : null;
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
    /* 2a prueft die REGEL, nicht einen Schwellwert (nachgezogen mit KA-2, 08.09.2026).
       Bis dahin stand hier `abstand < 6`. Das war richtig, solange die Marke waehrend der
       Foerderung EXAKT auf dem Vorkommen lag - seit dem Foerderstrahl haelt der Konvoi bewusst
       Abstand, sonst haette der Strahl Laenge null. Die Zahl 6 war aber nie die Zusage; die Zusage
       lautet „am Vorkommen und nicht auf halbem Rueckweg", und der Kommentar am Code nennt genau
       diesen Fehler: „der Kartenzeichner kennt hinBis nicht und halbiert stur bei frac>=0.5".
       GEMESSEN WIRD DESHALB GEGEN DIE ROUTENMITTE - den Ort, an den der halbierende Fehler die
       Marke setzen wuerde. Die Marke muss NAEHER am Vorkommen stehen als an dieser Mitte - bei
       genau dem Fehler, den 2a faengt, waere der Abstand zur Mitte NULL und der zum Vorkommen die
       halbe Strecke. Damit zieht die Pruefung bei jeder kuenftigen Abstandsaenderung mit, ohne
       ihre Kraft zu verlieren.
       KEIN VIELFACHES als Schwelle: Ein erster Entwurf verlangte „viermal weiter zur Mitte" und
       fiel auf richtigem Code durch - ein Abbauflug bleibt IM System und ist kurz (gemessen: rund
       50 Einheiten), die Mitte liegt also nur 25 Einheiten entfernt. Die Schwelle haette den
       Standabstand verboten statt den Fehler. */
    const routenMitte = (ortB && ortB.start && ortB.ziel)
      ? { x: (ortB.start.x + ortB.ziel.x)/2, y: (ortB.start.y + ortB.ziel.y)/2 } : null;
    const dZiel  = (ortB && ortB.ziel) ? Math.hypot(ortB.x - ortB.ziel.x, ortB.y - ortB.ziel.y) : null;
    const dMitte = routenMitte ? Math.hypot(ortB.x - routenMitte.x, ortB.y - routenMitte.y) : null;
    check('2a: waehrend der Foerderung steht die Marke AM VORKOMMEN, nicht auf halbem Rueckweg',
      dZiel !== null && dMitte !== null && dZiel < dMitte,
      { abstandZumVorkommen: dZiel === null ? null : +dZiel.toFixed(1),
        abstandZurRoutenmitte: dMitte === null ? null : +dMitte.toFixed(1),
        verhaeltnis: (dZiel && dMitte) ? +(dMitte/dZiel).toFixed(1) : null });

    /* KA-2: DER STRAHL SELBST. Der Auftrag lautete woertlich „wenn eine flotte fördert soll das
       grafisch angezeigt werden z.b ein laserstrahl auf dem asteroiden". */
    const str = (ortB && ortB.strahl) || [];
    const trifft = str.length > 0 && ortB.ziel
      && str.every(l => Math.hypot(l.x2 - ortB.ziel.x, l.y2 - ortB.ziel.y) < 3
                     && Math.hypot(l.x1 - ortB.x, l.y1 - ortB.y) < 3);
    check('2d: ein Strahl laeuft von der Flotte auf das Vorkommen',
      str.length >= 2 && trifft && Math.hypot(str[0].x2-str[0].x1, str[0].y2-str[0].y1) > 8,
      { teile: str.length, laenge: str.length ? +Math.hypot(str[0].x2-str[0].x1, str[0].y2-str[0].y1).toFixed(1) : null });
    /* Eine ruhende Linie saehe aus wie eine Verbindung, nicht wie eine Taetigkeit - die Bewegung
       IST die Aussage. Und `pointer-events="none"`, weil der Strahl sonst genau die beiden
       Trefferflaechen abfinge, die dort etwas oeffnen sollen. */
    /* 2f: KEIN SPRUNG AN DER PHASENGRENZE. Der erste Entwurf von KA-2 zog den Halteabstand erst
       im Zeichnen ab - er wirkte damit NUR waehrend der Foerderung. Die Marke flog bis in die
       Brockenmitte, sprang bei `hinBis` um rund siebzehn Einheiten zurueck und beim Abflug wieder
       vor: zwei sichtbare Spruenge, die kein Test gesehen haette.
       GEMESSEN WIRD DER ANFLUG KURZ VOR SEINEM ENDE: Steht die Marke dort schon nahe am
       Halteplatz, kann sie beim Umschalten nicht mehr springen. Ein Vergleich der beiden
       Zustaende waere die ehrlichere Messung, ginge aber nur mit zwei Laeufen, deren Uhren sich
       um Millisekunden unterscheiden - dieser eine Lauf misst dieselbe Zusage an einer Stelle,
       an der sie entscheidet. */
    /* KURZ VOR DER ANKUNFT: hinBis liegt eine Sekunde VOR uns, der Anflug ist also zu 99,8 %
       durch. Alle anderen Zeiten bleiben wie im Hauptlauf - der einzige Unterschied ist die
       Phase, sonst maesse 2f etwas, das sich auch aus einem anderen Grund unterscheiden koennte. */
    /* KURZ VOR DER ANKUNFT heisst hier: der Anflug ist zu 99,94 % durch. Das ist gemessen und
       nicht grosszuegig gewaehlt - ein erster Entwurf setzte `hinBis` nur eine Sekunde voraus, bei
       einem 30-Sekunden-Anflug sind das aber erst 96,8 %, und dort liegt AUCH der springende Stand
       rund siebzehn Einheiten entfernt. Die Pruefung war damit gruen, ohne zu unterscheiden.
       Der lange Anflug (zehn Stunden) loest beides zugleich: Der Rest-Anteil wird winzig, und
       `hinBis` bleibt trotzdem weit genug in der Zukunft, dass der Seitenaufbau ihn nicht
       ueberholt - sonst maesse der Lauf die Foerderphase und 2f waere eine Kopie von 2a. */
    const t5 = await karte(browser, { [SAVE_KEY]: stand({
      zeiten: { startTime: jetzt - 36000000, hinBis: jetzt + 120000,
                abbauBis: jetzt + 870000, endTime: jetzt + 900000 } }) });
    const ortV = await markenOrt(t5.page);
    /* BELEGEN, DASS WIRKLICH DER ANFLUG GEMESSEN WURDE. Ein erster Entwurf setzte `hinBis` nur
       zwanzig Sekunden voraus - der Seitenaufbau samt Regionssuche brauchte laenger, der Lauf mass
       also die FOERDERPHASE und 2f war eine Kopie von 2a: gruen auf beiden Staenden, ohne je zu
       unterscheiden. Die Beschriftung sagt die Phase: „foerdert" steht nur waehrend des Abbaus. */
    const formV = await messeForm(t5.page);
    await t5.ctx.close();
    const imAnflug = !(formV.texte || []).some(t => /fördert/.test(t));
    check('2f-vorab: der Lauf hat wirklich den ANFLUG gemessen, nicht die Foerderung',
      imAnflug === true, { texte: (formV.texte || []).filter(t => /Erzzug/.test(t)) });
    const dVor = (ortV && ortV.ziel) ? Math.hypot(ortV.x - ortV.ziel.x, ortV.y - ortV.ziel.y) : null;
    check('2f: schon kurz vor der Ankunft steht die Marke am Halteplatz - kein Sprung beim Umschalten',
      imAnflug === true && dZiel !== null && dVor !== null && Math.abs(dVor - dZiel) < 3,
      { kurzVorAnkunft: dVor === null ? null : +dVor.toFixed(1),
        waehrendFoerderung: dZiel === null ? null : +dZiel.toFixed(1),
        unterschied: (dVor !== null && dZiel !== null) ? +Math.abs(dVor - dZiel).toFixed(1) : null });

    check('2e: er bewegt sich und faengt keine Klicks ab',
      str.some(l => l.animiert) && str.every(l => l.zeiger === 'none'),
      { animiert: str.filter(l => l.animiert).length, zeiger: str.map(l => l.zeiger) });

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
