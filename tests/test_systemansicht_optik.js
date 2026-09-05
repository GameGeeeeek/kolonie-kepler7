// Die offene Systemansicht: Licht und Schatten (Auftrag Sascha, 01.09.2026 - "optisch ein
// Meisterwerk"; gewaehlt aus drei gerenderten Varianten: A "Licht und Schatten" als Basis, dazu
// die Gasriesen-Ringe und sichtbaren Mondbahnen aus C).
//
//   node tests/test_systemansicht_optik.js
//
// WAS GEBAUT IST (alles in buildMap, vier Helfer davor): Nebelschleier in der Sonnenfarbe,
// 48 Sterne mit Glanzkreuz, durchgezogene Bahnen mit einer farbigen Bahnspur hinter jedem
// Planeten, Sonnenkorona mit zehn langsam wandernden Strahlen, Tag-/Nachtseite je Planet (der
// Schatten liegt sonnenabgewandt), Atmosphaeren-Halo nur fuer ERFORSCHTE Welten, Ring um
// Gasriesen (hintere Haelfte hinter, vordere vor der Scheibe), eine Mondbahn unter jedem
// Mond-Marker, und ein dunkler Saum um jede Beschriftung.
//
// ZWEI ENTSCHEIDUNGEN, DIE DER TEST FESTHAELT:
//   - KEIN SVG-Filter (0b). Ein feGaussianBlur wird bei jeder Neuzeichnung gerastert, und die
//     Ebene traegt Dauer-Animationen. Jeder Verlauf ist ein radialGradient.
//   - Die Sterne kommen aus einem echten Generator (0c). hashStringToFloat rechnet h*31+Zeichen
//     mod 10000; zwei Schluessel, die sich nur in der Sternnummer unterscheiden, liegen 31/10000
//     auseinander - 48 Sterne ergaben so "Perlenschnuere", die im Bild wie Striche aussahen.
//
// DIE MESSUNGEN SIND REGELN, KEINE MOMENTAUFNAHMEN (Regel 3): Die Bahnspur muss an der Scheibe
// ENDEN (Endpunkt des Bogens = Bildmitte), der Schatten-Verlauf muss seinen Mittelpunkt auf der
// SONNENSEITE haben (naeher an der Sonne als die Scheibenmitte), die Mondbahn muss durch den
// Mond-Marker LAUFEN (Radius = Abstand des Markers). Halo und Abdunklung werden als PAAR gemessen
// (Regel 61): erforscht hat, unerforscht hat nicht - jede Haelfte allein waere auch bei einer
// Zeichnung gruen, die alles oder nichts markiert.
//
// GEGENPROBE (in beide Richtungen ausgefuehrt, per KEPLER_SPIELDATEI gegen origin/main, Stand
// v8.623.0 - siehe Pflichtliste am Ende dieses Kopfes): Am alten Stand fehlen alle data-sys-Anker.
//
// PFLICHTLISTE (gemessen am 01.09.2026, nicht geraten - Regel 71): am alten Stand fallen 18 von 28,
//   0a 0-vorab 0b-anker 0c 1a 1a2 1a3 1a4 1b 1b2 1c 1d 1h 1e 1f 1f2 1i 2a
// gruen bleiben MUESSEN (10): 0b 0d (die "hat nicht"-Regeln - ohne 0-vorab/0b-anker daneben
// waeren sie ueber einem leeren Schnitt trivial gruen), 1-vorab 1-anker 2-vorab (Boot und Fixture),
// 1d2 1e2 1f3 (die "hat nicht"-Haelften der Paare - genau deshalb stehen sie nie allein) sowie
// 1g-anker und 1g (die alte Zeichnung war ebenfalls deterministisch). Prueflisten beider Laeufe
// per diff verglichen: identisch.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const ICH = 'u-ich';
const SYS = 'kepler';
// Die fuenf festen Planeten des Heimatsystems (PLANETS, system:'kepler'); alles Weitere dort sind
// Wochenplaneten, deren Bestand vom Datum abhaengt - sie bleiben unerforscht und stoeren nicht.
const ERFORSCHT = ['vesna', 'rhea', 'aion', 'draconis'];
const UNERFORSCHT = ['kaska'];
const GASRIESE = 'draconis';
const KEIN_GASRIESE = ['vesna', 'rhea', 'aion', 'kaska'];
const MIT_MOND = ['rhea'];

// ---- 0) Quelltext ---------------------------------------------------------------------------------
{
  const zaehl = (re) => (JS.match(re) || []).length;
  const helfer = ['sysSchatten', 'sysHalo', 'sysGasring', 'sysMondbahn', 'sysZufall'];
  const def = helfer.map(h => zaehl(new RegExp('function ' + h + '\\(', 'g')));
  check('0a: die fuenf sys*-Helfer sind genau einmal definiert', def.every(n => n === 1), { helfer, def });

  // Geschnitten werden die NEUEN Teile: die Helfer, der defs-Block und der Block von den Sternen
  // bis zur Sonne. Ganz buildMap zu nehmen misst die falsche Regel - das Wurmloch-Portal darin
  // traegt seit GR-1 zu Recht Filter und die Flugbahnen ihre eigenen Zufaelle.
  const schnitt = (a, b) => { const von = JS.indexOf(a); const bis = von < 0 ? -1 : JS.indexOf(b, von); return (von >= 0 && bis > von) ? JS.slice(von, bis) : ''; };
  // Fuenf Stuecke, jedes an einem Anker, der nur einmal vorkommt. 'let inner = \`<defs>' waere
  // KEIN solcher Anker - er trifft zuerst die defs der Galaxie-Ebene (gemessen: zwei Vorkommen),
  // und ein Stueck "von den Sternen bis zur Sonne" umfasst 36 kB samt Wurmloch-Portal.
  const stuecke = [schnitt('function sysSchatten(', 'function buildMap(){'),
                   schnitt('<radialGradient id="sysKorona"', '</defs>`;'),
                   schnitt('const sternZufall = sysZufall(', '// Orbit-Ringe'),
                   schnitt('// Bahnspur: ein kurzer Bogen', '// Asteroidenguertel'),
                   schnitt('// Korona (großer weicher Verlauf)', 'if (activeSunType.pulsar)')];
  const rumpf = stuecke.join('\n');
  check('0-vorab: die neuen Teile der Systemansicht liessen sich schneiden (fuenf Stuecke)',
    stuecke.every(t => t.length > 200) && /function sysMondbahn/.test(rumpf) && /sysNebelBlau/.test(rumpf)
    && /data-sys-strahlen/.test(rumpf) && /data-sys-spur/.test(rumpf), { laengen: stuecke.map(t => t.length) });
  check('0b-anker: der Rumpf zeichnet die Korona (sonst misst 0b nichts)', /data-sys-korona/.test(rumpf));
  check('0b: die Systemansicht kommt ohne SVG-Filter aus (kein feGaussianBlur, kein <filter)',
    rumpf.length > 0 && !/feGaussianBlur|<filter\b/.test(rumpf));
  check('0c: die Sterne kommen aus sysZufall, nicht aus hashStringToFloat je Stern',
    /sysZufall\(activeSystem\+':sysstern'\)/.test(rumpf) && !/hashStringToFloat\(activeSystem\+':sysstern'\+i/.test(rumpf));
  check('0d: kein Math.random in der Systemansicht (Markup-Vergleich an der Schreibstelle)',
    rumpf.length > 0 && !/Math\.random/.test(rumpf));
}

// ---- Fixture -------------------------------------------------------------------------------------
function spielstand(){
  const j = Date.now(); const g = {};
  for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) g[t] = true;
  const disc = {}; for (const id of ERFORSCHT) disc[id] = true;
  const moons = { home: true }; for (const id of MIT_MOND) moons[id] = true;
  return JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: g, activeEvent: { key: '__testruhe__', bis: j + 9e8 },
    resources: { energie: 9e5, erz: 9e5, kristalle: 6e5, deuterium: 4e5, antimaterie: 9e4, forschungspunkte: 3e4 },
    buildings: { solar: 22, mine: 20, labor: 14, lager: 30, werft: 14 }, research: {}, fleet: { jaeger: 80, missions: [] },
    colonies: { aion: { buildings: { mine: 3, solar: 2 } } }, discovered: disc, moons,
    activeBasePlanet: 'home', player: { id: ICH, name: 'Ich', avatarKey: null }, xp: 9e5, credits: 5e5, buffs: [],
    lastTick: j, colonyNames: {}, modules: {}, shipModules: {}, nextPlanetEventCheck: j + 36e5, nextTraderCheck: j + 36e5
  });
}
function backend(st){
  return async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: ICH, username: 'Ich', homeSystem: SYS, homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
    if (p === 'galaxy') return j({ npcEmpireStrength: 1, marketTrend: 1, activePirateFaction: null, unlockedAlienRaces: [], activeWar: null, collapsedSystems: {}, activeWormhole: null, news: [], alienNester: [], controlledSystems: {} });
    if (p === 'asteroid/field') return j({ systeme: [], felder: {} });
    if (p === 'reports') return j({ reports: [] });
    if (p === 'players-map') return j({ players: [] });
    if (p === 'pending-rewards/claim') return j({ reward: null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok: true, nachrichten: [], neuesteTs: 0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT') return j({ ok: true, version: 2 }); if (st[k] !== undefined) return j({ key: k, value: st[k], shared: true, version: 1 }); return j({ e: 1 }, 404); }
    return j({ ok: true });
  };
}
async function tab(browser, extra){
  const st = { ['leaderboard:' + ICH]: JSON.stringify({ id: ICH, name: 'Ich', score: 9000, ships: 20, bp: 9, lastSeen: Date.now(), ownedPlanets: [] }),
               'kepler7-save-v3': spielstand() };
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, extra || {}));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(st));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(1200);
  const auf = await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(1500);
  return { ctx, page, errs, auf };
}

// Alles, was die Zeichnung ueber ihre Anker verraet - in EINEM evaluate, damit die Messung eine
// Momentaufnahme derselben Zeichnung ist und nicht zwei Aufbauten mischt.
async function messen(page){
  return page.evaluate(() => {
    const L = document.getElementById('galaxySystemLayer');
    if (!L) return { da: false };
    const num = (el, a) => parseFloat(el.getAttribute(a));
    const SUN = { x: 350, y: 115 };
    const planeten = {};
    L.querySelectorAll('g.planet-node[data-planet]').forEach(g => {
      const id = g.getAttribute('data-planet');
      const img = g.querySelector('image') || g.querySelector('circle.body');
      let mitte = null;
      if (img && img.tagName === 'image') mitte = { x: num(img, 'x') + num(img, 'width') / 2, y: num(img, 'y') + num(img, 'height') / 2, op: img.getAttribute('opacity') };
      else if (img) mitte = { x: num(img, 'cx'), y: num(img, 'cy'), op: img.getAttribute('opacity') };
      const sch = g.querySelector('[data-sys-schatten]');
      const grad = sch ? L.querySelector('#' + CSS.escape(sch.getAttribute('fill').replace(/^url\(#|\)$/g, ''))) : null;
      const mond = g.querySelector('[data-map-moon] circle[r="5.5"]');
      const bahn = g.querySelector('[data-sys-mondbahn]');
      const ringVorne = g.querySelector('clipPath[id^="sysRingClip-"]');
      planeten[id] = {
        mitte, schatten: g.querySelectorAll('[data-sys-schatten]').length,
        gradMitte: grad ? { x: num(grad, 'cx'), y: num(grad, 'cy') } : null,
        halo: g.querySelectorAll('[data-sys-halo]').length,
        abdunklung: !![...g.querySelectorAll('circle')].find(c => c.getAttribute('fill') === '#0a0d1a' && c.getAttribute('opacity') === '0.32'),
        ringHinten: g.querySelectorAll('[data-sys-ring]').length, ringVorne: !!ringVorne,
        mondMarker: mond ? { x: num(mond, 'cx'), y: num(mond, 'cy') } : null,
        mondbahn: bahn ? { x: num(bahn, 'cx'), y: num(bahn, 'cy'), r: num(bahn, 'r') } : null
      };
    });
    const spuren = {};
    L.querySelectorAll('[data-sys-spur]').forEach(p => {
      const d = p.getAttribute('d'); const z = d.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      spuren[p.getAttribute('data-sys-spur')] = { ende: { x: z[z.length - 2], y: z[z.length - 1] }, farbe: p.getAttribute('stroke') };
    });
    const strahlen = L.querySelector('[data-sys-strahlen]');
    const label = L.querySelector('text.planet-label');
    const cs = label ? getComputedStyle(label) : null;
    return {
      da: true, SUN, planeten, spuren,
      korona: L.querySelectorAll('[data-sys-korona]').length,
      koronaR: L.querySelector('[data-sys-korona]') ? num(L.querySelector('[data-sys-korona]'), 'r') : 0,
      strahlen: strahlen ? strahlen.querySelectorAll('polygon').length : 0,
      strahlenBewegt: !!(strahlen && strahlen.querySelector('animateTransform')),
      nebel: L.querySelectorAll('[data-sys-nebel]').length,
      bahnenGestrichelt: [...L.querySelectorAll('ellipse')].filter(e => e.getAttribute('cx') === '350' && e.getAttribute('stroke') === '#ffffff' && e.getAttribute('stroke-dasharray') === '2,5').length,
      labelSaum: cs ? { paintOrder: cs.paintOrder, strokeWidth: cs.strokeWidth, stroke: cs.stroke } : null,
      markup: L.innerHTML, aufbauten: window.__karteAufbauten || 0
    };
  });
}
const nah = (a, b, tol) => Math.abs(a - b) <= tol;
const abstand = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Die Zeichnung ------------------------------------------------------------------------
  {
    const t = await tab(browser);
    check('1-vorab: Boot ohne Skriptfehler', t.errs.length === 0, t.errs.slice(0, 2));
    const m = await messen(t.page);
    check('1-anker: das Heimatsystem steht offen und die Ebene traegt Planeten',
      m.da && !!m.planeten.__home__ && ERFORSCHT.concat(UNERFORSCHT).every(id => !!m.planeten[id]),
      { da: m.da, auf: t.auf, ids: m.da ? Object.keys(m.planeten) : [] });

    check('1a: die Sonne traegt eine Korona und zehn Strahlen', m.korona === 1 && m.koronaR > 0 && m.strahlen === 10,
      { korona: m.korona, koronaR: m.koronaR, strahlen: m.strahlen });
    check('1a2: die Strahlen wandern (animateTransform), solange Bewegung nicht abbestellt ist', m.strahlenBewegt === true);
    check('1a3: der Nebelschleier liegt hinter allem', m.nebel === 1, { nebel: m.nebel });
    check('1a4: die Bahnen sind durchgezogen statt gepunktet', m.bahnenGestrichelt === 0, { gepunktet: m.bahnenGestrichelt });

    // Bahnspur: je Planet genau eine, und sie ENDET an der Scheibe.
    const ids = ERFORSCHT.concat(UNERFORSCHT);
    const spurFehlt = ids.filter(id => !m.spuren[id]);
    const spurDaneben = ids.filter(id => m.spuren[id] && m.planeten[id].mitte && abstand(m.spuren[id].ende, m.planeten[id].mitte) > 0.35)
      .map(id => ({ id, ende: m.spuren[id].ende, mitte: m.planeten[id].mitte }));
    check('1b: jeder Planet hat eine Bahnspur', spurFehlt.length === 0, { fehlt: spurFehlt });
    check('1b2: und die Spur endet an der Scheibe (Endpunkt = Bildmitte, Regel statt Momentaufnahme)',
      spurFehlt.length === 0 && spurDaneben.length === 0, spurDaneben.slice(0, 3));

    // Tag-/Nachtseite: Verlauf-Mittelpunkt liegt auf der SONNENSEITE.
    const alle = ids.concat(['__home__']);
    const ohneSchatten = alle.filter(id => m.planeten[id].schatten !== 1);
    const falscheSeite = alle.filter(id => m.planeten[id].gradMitte && m.planeten[id].mitte
      && !(abstand(m.planeten[id].gradMitte, m.SUN) < abstand(m.planeten[id].mitte, m.SUN)))
      .map(id => ({ id, grad: m.planeten[id].gradMitte, mitte: m.planeten[id].mitte }));
    check('1c: jede Scheibe (auch die Heimat) traegt genau EINEN Schatten, dessen Verlauf auf der Sonnenseite sitzt',
      ohneSchatten.length === 0 && falscheSeite.length === 0, { ohneSchatten, falscheSeite: falscheSeite.slice(0, 3) });

    // Halo und Abdunklung als PAAR.
    /* GEZAEHLT WIRD NICHT, SONDERN GEPRUEFT, DASS ER DA IST (mitgezogen 05.09.2026, GR-9):
       Bis dahin trug nur der innere der beiden Halo-Ringe die Kennung, und die Pruefung verglich
       mit genau 1. Seit der aeussere Ring ebenfalls messbar ist (data-sys-halo="2", damit ein
       Waechter die sichtbare Aussenkante messen kann), waeren es 2 - die feste Zahl war eine
       Momentaufnahme des Markups, nicht die Regel. Die Regel ist "erforscht hat einen, unerforscht
       hat keinen", und sie steht als Paar mit 1d2 daneben. */
    check('1d: erforschte Welten tragen den Atmosphaeren-Halo', ERFORSCHT.every(id => m.planeten[id].halo >= 1),
      ERFORSCHT.map(id => [id, m.planeten[id].halo]));
    check('1d2: unerforschte Welten tragen KEINEN Halo (die Gegenrichtung des Paars)', UNERFORSCHT.every(id => m.planeten[id].halo === 0),
      UNERFORSCHT.map(id => [id, m.planeten[id].halo]));
    check('1h: unerforschte Welten sind abgedunkelt (Scheibe 0.7 plus dunkle Deckung), erforschte nicht',
      UNERFORSCHT.every(id => m.planeten[id].abdunklung && m.planeten[id].mitte && m.planeten[id].mitte.op === '0.7')
      && ERFORSCHT.every(id => !m.planeten[id].abdunklung && m.planeten[id].mitte && (m.planeten[id].mitte.op === '1' || m.planeten[id].mitte.op === null)),
      alle.map(id => [id, m.planeten[id].abdunklung, m.planeten[id].mitte && m.planeten[id].mitte.op]));

    // Gasriesen-Ring: nur der Gasriese, in zwei Haelften.
    check('1e: der Gasriese traegt den Ring - hintere Haelfte UND vordere (clipPath)',
      m.planeten[GASRIESE].ringHinten === 1 && m.planeten[GASRIESE].ringVorne === true, m.planeten[GASRIESE]);
    check('1e2: kein anderer Planetentyp traegt einen Ring', KEIN_GASRIESE.every(id => m.planeten[id].ringHinten === 0 && !m.planeten[id].ringVorne),
      KEIN_GASRIESE.map(id => [id, m.planeten[id].ringHinten]));

    // Mondbahn: liegt exakt unter dem Mond-Marker.
    const mondIds = MIT_MOND.concat(['__home__']);
    const bahnFehlt = mondIds.filter(id => !m.planeten[id].mondbahn || !m.planeten[id].mondMarker);
    const bahnDaneben = mondIds.filter(id => m.planeten[id].mondbahn && m.planeten[id].mondMarker
      && !nah(abstand(m.planeten[id].mondbahn, m.planeten[id].mondMarker), m.planeten[id].mondbahn.r, 0.2))
      .map(id => ({ id, r: m.planeten[id].mondbahn.r, abstand: abstand(m.planeten[id].mondbahn, m.planeten[id].mondMarker) }));
    check('1f: Planeten mit Mond tragen eine Mondbahn (Heimat eingeschlossen)', bahnFehlt.length === 0, { fehlt: bahnFehlt });
    check('1f2: und der Mond-Marker LIEGT auf ihr (Radius = Markerabstand)', bahnFehlt.length === 0 && bahnDaneben.length === 0, bahnDaneben);
    const ohneMond = ids.filter(id => !MIT_MOND.includes(id));
    check('1f3: Planeten ohne Mond tragen keine Mondbahn', ohneMond.every(id => !m.planeten[id].mondbahn), ohneMond);

    check('1i: die Beschriftung traegt den dunklen Saum (paint-order stroke, 2.4px)',
      !!(m.labelSaum && /stroke/.test(m.labelSaum.paintOrder) && m.labelSaum.strokeWidth === '2.4px'), m.labelSaum);

    // Determinismus: ein echter Neuaufbau muss dasselbe Markup ergeben; die Sterne duerfen nicht
    // springen. Weder Warten (gemessen: __karteAufbauten 6 -> 6 in 1,6 s) noch Fenstergroesse hin
    // und zurueck noch ein Tab-Wechsel (beide 6 -> 6) loesen einen aus - der Systemwechsel nach
    // Vega und zurueck tut es: dazwischen traegt die Ebene Vegas Planeten, danach wieder Keplers,
    // und beide Kepler-Zeichnungen muessen zeichengleich sein.
    await oeffneSystemUeberSektoren(t.page, 'vega');
    await t.page.waitForTimeout(1200);
    const mVega = await messen(t.page);
    await oeffneSystemUeberSektoren(t.page, SYS);
    await t.page.waitForTimeout(1500);
    const m2 = await messen(t.page);
    check('1g-anker: dazwischen stand ein anderes System (Vega) - die Ebene wurde also wirklich neu gebaut',
      mVega.da && !!mVega.planeten.thessa && !mVega.planeten.vesna && m2.da && !!m2.planeten.vesna,
      { vega: mVega.da ? Object.keys(mVega.planeten).slice(0, 4) : null, zurueck: m2.da ? Object.keys(m2.planeten).slice(0, 4) : null });
    check('1g: das Markup der Kepler-Ebene ist nach dem Neuaufbau zeichengleich (deterministisch - kein Sternenspringen)',
      m2.markup.length > 1000 && m2.markup === m.markup && mVega.markup !== m.markup,
      { gleich: m2.markup === m.markup, laenge: [m.markup.length, m2.markup.length], vegaAnders: mVega.markup !== m.markup });

    await t.ctx.close();
  }

  // ---- 2) Bewegung abbestellt: Zeichnung bleibt, nur die Strahlen stehen still ----------------
  {
    const t = await tab(browser, { reducedMotion: 'reduce' });
    check('2-vorab: Boot ohne Skriptfehler (reduzierte Bewegung)', t.errs.length === 0, t.errs.slice(0, 2));
    const m = await messen(t.page);
    check('2a: bei reduzierter Bewegung stehen die zehn Strahlen still - aber sie sind da',
      m.da && m.strahlen === 10 && m.strahlenBewegt === false, { strahlen: m.strahlen, bewegt: m.strahlenBewegt });
    await t.ctx.close();
  }

  await browser.close();
  ende();
})();
