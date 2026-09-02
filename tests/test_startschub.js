// Startschub: 30 fest verortete Systeme in allen acht Sektoren (Auftrag Sascha, 02.09.2026 -
// "mehr Systeme", mit der Auflage, sie gut zu verteilen: "ein paar im Kepler Kern, ein paar in
// Meridian Weiten usw.").
//
//   node tests/test_startschub.js
//
// WAS GEBAUT IST: SCHUB_SYSTEMS (30 Eintraege mit Name, gx/gy und Zielsektor) wird beim Laden
// hinter die 69 Basissysteme und vor die Wochensysteme gehaengt (extendSchubSystems); die Planeten
// entstehen wie bei den Wochensystemen deterministisch aus einem festen Startwert je System
// (generierePlaneten, eine Quelle fuer beide). Der Wochen-Deckel sank von 208 auf 178, damit das
// Spiralfeld bei 277 Plaetzen bleibt. Die Gürtelauswahl (guertelSysteme) ist eingefroren und an
// das Backend angeglichen (siehe test_systemparitaet); Schub-Systeme tragen nie einen Gürtel.
//
// DIE MESSUNGEN SIND REGELN: Sektorzugehoerigkeit ueber sektorVon (naechstes Sektorzentrum), nicht
// ueber eine Liste; Mindestabstand gegen ALLE 69 Basis- und alle 178 moeglichen Wochensysteme;
// Determinismus ueber zwei unabhaengige Auswertungen; die Reihenfolge im Array als Regel
// (Basis, Schub, Wochen), nicht als Zahl.
//
// GEGENPROBE (in beide Richtungen ausgefuehrt, per KEPLER_SPIELDATEI gegen origin/main v8.624.0):
// siehe Pflichtliste am Ende dieses Kopfes.
//
// PFLICHTLISTE (gemessen am 02.09.2026, Prueflisten beider Laeufe per diff identisch, 30 Pruefungen):
// am alten Stand fallen 27 - der ganze Quelltext-Teil (0-vorab, 0a und die 20 davon abhaengigen,
// die fehlend() dann rot meldet statt sie zu ueberspringen), dazu 7-anker 7a 7b 8a 8b.
// gruen bleiben MUESSEN (3): 7-vorab und 8-vorab (Boot ohne Skriptfehler), 8c (kepler ohne
// Serverfeld traegt keine Gürtelbahn - die "hat nicht"-Haelfte des Paars, deshalb nie allein).
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';
const QUOTE = { kepler: 5, meridian: 5, wispern: 3, solmark: 4, obsidian: 3, pulsar: 4, ilyra: 3, rand: 3 };
const MIN_ABSTAND = 30;

// ---- 0) Quelltext: Tabelle, Bloecke, Deckel -------------------------------------------------------
const schnitt = (a, b, ab) => { const von = src.indexOf(a, ab || 0); const bis = von < 0 ? -1 : src.indexOf(b, von); return (von >= 0 && bis > von) ? src.slice(von, bis + b.length) : ''; };
const starSrc = schnitt('  const STAR_SYSTEMS = [', '\n  ];');
const planetSrc = schnitt('  const PLANETS = [', '\n  ];');
const typeSrc = schnitt('  const PLANET_TYPE_INFO = {', '\n  };');
const sektorSrc = schnitt('  const SEKTOR_DEFS = [', '\n  ];');
const genVon = src.indexOf('  const WEEKLY_SYSTEMS_PER_WEEK = ');
const genBis = src.indexOf('  extendWeeklySystems(Date.now());');
const genSrc = (genVon > 0 && genBis > genVon) ? src.slice(genVon, genBis) : '';
check('0-vorab: Datenbloecke und Generator-Block gefunden', !!starSrc && !!planetSrc && !!typeSrc && !!sektorSrc && !!genSrc && /const SCHUB_SYSTEMS = \[/.test(genSrc),
  { star: starSrc.length, planet: planetSrc.length, typ: typeSrc.length, sektor: sektorSrc.length, gen: genSrc.length });
// Kein frueher Abbruch: Am alten Stand fehlt der Schub im Generator-Block, und dann muessen alle
// abhaengigen Pruefungen ROT erscheinen statt zu fehlen - sonst liesse sich die Pruefliste beider
// Laeufe nicht per diff vergleichen (Regel 71). Die Namen kommen aus dieser Datei selbst.
function fehlend(namen, grund){ for (const n of namen) check(n, false, { nichtGeprueft: grund }); }
const ABHAENGIG = (() => { const me = fs.readFileSync(__filename, 'utf8'); const von = me.indexOf('// ---- 0) Quelltext'), bis = me.lastIndexOf('// ---- 7/8) Im Browser');
  return [...me.slice(von, bis).matchAll(/check\('([^']+)'/g)].map(m => m[1]).filter(n => !/^(0-vorab|0a):/.test(n)); })();

function neueGalaxie(){
  return new Function(starSrc + '\n' + planetSrc + '\n' + typeSrc + '\n' + genSrc + '\n' +
    'return { STAR_SYSTEMS, PLANETS, BASE_STAR_SYSTEM_COUNT, BASE_PLANET_COUNT, WEEKLY_SYSTEM_MAX, WEEKLY_SYSTEM_EPOCH, WEEK_MS,' +
    ' SCHUB_SYSTEMS, SCHUB_SYSTEM_COUNT, extendWeeklySystems, extendSchubSystems, WEEKLY_RING };')();
}
const sektoren = new Function(sektorSrc + '\nreturn SEKTOR_DEFS;')();
const sektorVon = (p) => { let best = sektoren[0], bd = Infinity; for (const sk of sektoren){ const d = (p.gx - sk.cx) ** 2 + (p.gy - sk.cy) ** 2; if (d < bd){ bd = d; best = sk; } } return best; };

let g = null, fehler = null;
try { if (genSrc && /const SCHUB_SYSTEMS = \[/.test(genSrc)) g = neueGalaxie(); else fehler = 'kein Schub im Generator-Block'; } catch (e) { fehler = String(e); }
check('0a: der Generator-Block laesst sich mit dem Schub auswerten', !!g, fehler);
if (!g) fehlend(ABHAENGIG, fehler || 'Generator-Block nicht auswertbar');
else {
const schub = g.SCHUB_SYSTEMS;
check('0b: die Tabelle hat 30 Eintraege mit eindeutigen IDs syss_01..syss_30',
  schub.length === 30 && new Set(schub.map(s => s.id)).size === 30 && schub.every((s, i) => s.id === 'syss_' + String(i + 1).padStart(2, '0')),
  schub.slice(0, 3).map(s => s.id));
const basisNamen = new Set(g.STAR_SYSTEMS.slice(0, g.BASE_STAR_SYSTEM_COUNT).map(s => s.name));
check('0c: alle 30 Namen sind eindeutig und kollidieren mit keinem Basissystem',
  new Set(schub.map(s => s.name)).size === 30 && !schub.some(s => basisNamen.has(s.name)), schub.filter(s => basisNamen.has(s.name)).map(s => s.name));
check('0d: die statische PLANETS-Tabelle enthaelt keine Schub-Planeten (sie entstehen beim Laden)', !/system:'syss_/.test(planetSrc));

// ---- 1) Verteilung: jeder im angesagten Sektor, Quoten wie beauftragt --------------------------------
{
  const falsch = schub.filter(s => sektorVon(s).key !== s.sektor).map(s => ({ id: s.id, soll: s.sektor, ist: sektorVon(s).key }));
  check('1a: jedes Schub-System liegt im Sektor, den seine Tabelle nennt (naechstes Sektorzentrum)', falsch.length === 0, falsch.slice(0, 4));
  const zaehl = {}; for (const s of schub) zaehl[sektorVon(s).key] = (zaehl[sektorVon(s).key] || 0) + 1;
  check('1b: fuenf im Kepler-Kern und fuenf in den Meridian-Weiten', zaehl.kepler === 5 && zaehl.meridian === 5, zaehl);
  check('1c: jeder der acht Sektoren bekommt mindestens drei, zusammen 30',
    sektoren.every(sk => (zaehl[sk.key] || 0) >= 3) && Object.values(zaehl).reduce((a, b) => a + b, 0) === 30, zaehl);
  check('1d: Quoten wie im Auftrag festgelegt', JSON.stringify(zaehl) === JSON.stringify(Object.fromEntries(Object.keys(QUOTE).map(k => [k, zaehl[k]]))) && Object.keys(QUOTE).every(k => zaehl[k] === QUOTE[k]), zaehl);
}

// ---- 2) Mindestabstand gegen alles, was es gibt oder geben wird ----------------------------------
{
  const basis = g.STAR_SYSTEMS.slice(0, g.BASE_STAR_SYSTEM_COUNT);
  const ring = g.WEEKLY_RING;
  const wochen = Array.from({ length: g.WEEKLY_SYSTEM_MAX }, (_, i) => { const w = i * 2.39996323, r = Math.sqrt(ring.r0 * ring.r0 + (i + 1) * 700); return { id: 'sysw_' + i, gx: Math.round((ring.cx + Math.cos(w) * r) * 10) / 10, gy: Math.round((ring.cy + Math.sin(w) * r) * 10) / 10 }; });
  let dmin = Infinity, paar = null;
  for (const s of schub) for (const q of basis.concat(wochen, schub)) { if (q === s) continue; const d = Math.hypot(s.gx - q.gx, s.gy - q.gy); if (d < dmin){ dmin = d; paar = [s.id, q.id]; } }
  check('2a: kein Schub-System naeher als 30 Einheiten an irgendeinem Basis-, Wochen- oder Schub-System', dmin >= MIN_ABSTAND, { dmin: +dmin.toFixed(1), paar, MIN_ABSTAND });
}

// ---- 3) Reihenfolge und Deckel ----------------------------------------------------------------------
{
  const h = neueGalaxie(); h.extendWeeklySystems(h.WEEKLY_SYSTEM_EPOCH);
  const B = h.BASE_STAR_SYSTEM_COUNT, S = h.SCHUB_SYSTEM_COUNT;
  check('3a: im Array stehen erst 69 Basis-, dann 30 Schub-, dann die Wochensysteme',
    B === 69 && S === 30 && h.STAR_SYSTEMS[B].id === 'syss_01' && h.STAR_SYSTEMS[B + S - 1].id === 'syss_30' && h.STAR_SYSTEMS[B + S].id === 'sysw_0',
    { B, S, anSchub: h.STAR_SYSTEMS[B] && h.STAR_SYSTEMS[B].id, nachSchub: h.STAR_SYSTEMS[B + S] && h.STAR_SYSTEMS[B + S].id });
  check('3b: der Wochen-Deckel ist 178, zusammen 277 Plaetze', h.WEEKLY_SYSTEM_MAX === 178 && B + S + h.WEEKLY_SYSTEM_MAX === 277, { deckel: h.WEEKLY_SYSTEM_MAX });
  check('3c: ein zweiter Aufruf haengt den Schub nicht doppelt an', h.extendSchubSystems() === 0 && h.STAR_SYSTEMS.filter(s => s.schub).length === 30);
}

// ---- 4) Planeten: 5..10 je System, deterministisch, markiert -------------------------------------
{
  const a = neueGalaxie(), b = neueGalaxie();
  const pa = a.PLANETS.filter(p => p.schub), pb = b.PLANETS.filter(p => p.schub);
  const jeSystem = {}; for (const p of pa) jeSystem[p.system] = (jeSystem[p.system] || 0) + 1;
  const zahlen = schub.map(s => jeSystem[s.id] || 0);
  check('4a: jedes Schub-System hat 5 bis 10 Planeten', zahlen.every(n => n >= 5 && n <= 10), { min: Math.min(...zahlen), max: Math.max(...zahlen), gesamt: pa.length });
  check('4b: Planeten-IDs gs<k>_<o> sind eindeutig und kollidieren nicht mit der Basis',
    new Set(pa.map(p => p.id)).size === pa.length && pa.every(p => /^gs\d+_\d+$/.test(p.id)) && !pa.some(p => /^gw/.test(p.id)),
    pa.slice(0, 2).map(p => p.id));
  check('4c: zwei unabhaengige Auswertungen liefern zeichengleiche Planeten (deterministisch)', JSON.stringify(pa) === JSON.stringify(pb), { anzahl: [pa.length, pb.length] });
  const namen = new Set(a.PLANETS.map(p => p.name));
  check('4d: kein Planetenname doppelt (auch nicht gegen die Basis)', namen.size === a.PLANETS.length, a.PLANETS.length - namen.size);
}

// ---- 5) Basiszahlen unberuehrt ---------------------------------------------------------------------
{
  const basisPlaneten = (planetSrc.match(/\bid:'/g) || []).length;
  check('5a: BASE_STAR_SYSTEM_COUNT bleibt 69', g.BASE_STAR_SYSTEM_COUNT === 69, g.BASE_STAR_SYSTEM_COUNT);
  check('5b: BASE_PLANET_COUNT ist die statische Tabelle, ohne Schub-Planeten', g.BASE_PLANET_COUNT === basisPlaneten, { base: g.BASE_PLANET_COUNT, statisch: basisPlaneten });
  check('5c: der Wochenring rechnet nur mit den Basissystemen (baseStarSystems)', /const WEEKLY_RING = \(function\(\)\{\s*const basis = baseStarSystems\(\);/.test(src));
}

// ---- 6) Gürtel: eingefroren, kein Schub-System darunter ---------------------------------------------
{
  const holFe = (name) => { const m = src.match(new RegExp('  function ' + name + '\\([\\s\\S]*?\\n  \\}\\n')); return m ? m[0] : ''; };
  const konst = (name) => { const m = src.match(new RegExp('const ' + name + ' = ([^;]+);')); return m ? m[1].trim() : null; };
  const teile = [holFe('guertelHash'), holFe('guertelKandidat'), holFe('guertelSysteme')];
  let satz = null, err = null;
  try {
    const h = neueGalaxie(); h.extendWeeklySystems(h.WEEKLY_SYSTEM_EPOCH + 6 * h.WEEK_MS); // 14 Wochensysteme wie am Tag des Einfrierens
    satz = new Function('STAR_SYSTEMS', `const GUERTEL_AUSWAHL_SEED = ${konst('GUERTEL_AUSWAHL_SEED')}; const GUERTEL_WOCHEN_STAND = ${konst('GUERTEL_WOCHEN_STAND')}; const GUERTEL_SYSTEM_ZAHL = ${konst('GUERTEL_SYSTEM_ZAHL')}; let _guertelCache = null;\n` + teile.join('\n') + '\nreturn guertelSysteme();')(h.STAR_SYSTEMS);
  } catch (e) { err = String(e); }
  const EINGEFROREN = ["abyss","kepler","nebel","orion","sys_corvus_weite","sys_halvar_weite","sys_meridian_kern","sys_oort_schleuse","sys_xerxes_zone","sysw_1","sysw_10","sysw_11","sysw_12","sysw_13","sysw_2","sysw_3","sysw_5","sysw_6","sysw_7","tiefsee"];
  check('6a: die lokale Gürtelauswahl nennt genau die 20 eingefrorenen Systeme (Stand 02.09.2026, wie der Server)',
    !err && !!satz && JSON.stringify(satz) === JSON.stringify(EINGEFROREN), err || (satz && { nurHier: satz.filter(x => !EINGEFROREN.includes(x)), fehlt: EINGEFROREN.filter(x => !satz.includes(x)) }));
  check('6b: kein Schub-System traegt einen Gürtel', !!satz && !satz.some(x => /^syss_/.test(x)));
}

} // Ende des Quelltext-Teils
// ---- 7/8) Im Browser: Hinweis einmal, Serverliste hat Vorrang ---------------------------------------
function spielstand(extra){
  const j = Date.now(); const g2 = {};
  for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) g2[t] = true;
  return JSON.stringify(Object.assign({
    tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: g2, activeEvent: { key: '__testruhe__', bis: j + 9e8 },
    resources: { energie: 9e5, erz: 9e5, kristalle: 6e5, deuterium: 4e5, antimaterie: 9e4, forschungspunkte: 3e4 },
    buildings: { solar: 22, mine: 20, labor: 14, lager: 30, werft: 14 }, research: {}, fleet: { jaeger: 80, missions: [] },
    colonies: {}, discovered: {}, activeBasePlanet: 'home', player: { id: ICH, name: 'Ich', avatarKey: null }, xp: 9e5, credits: 5e5, buffs: [],
    lastTick: j, colonyNames: {}, modules: {}, shipModules: {}, nextPlanetEventCheck: j + 36e5, nextTraderCheck: j + 36e5
  }, extra || {}));
}
async function tab(browser, save, feld){
  const st = { ['leaderboard:' + ICH]: JSON.stringify({ id: ICH, name: 'Ich', score: 9000, ships: 20, bp: 9, lastSeen: Date.now(), ownedPlanets: [] }), 'kepler7-save-v3': save };
  const puts = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: ICH, username: 'Ich', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
    if (p === 'galaxy') return j({ npcEmpireStrength: 1, marketTrend: 1, activePirateFaction: null, unlockedAlienRaces: [], activeWar: null, collapsedSystems: {}, activeWormhole: null, news: [], alienNester: [], controlledSystems: {} });
    if (p === 'asteroid/field') return j(feld);
    if (p === 'reports') return j({ reports: [] });
    if (p === 'players-map') return j({ players: [] });
    if (p === 'pending-rewards/claim') return j({ reward: null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok: true, nachrichten: [], neuesteTs: 0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ puts.push(req.postData() || ''); return j({ ok: true, version: 2 }); } if (st[k] !== undefined) return j({ key: k, value: st[k], shared: true, version: 1 }); return j({ e: 1 }, 404); }
    return j({ ok: true });
  });
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3200);
  const logText = await page.evaluate(() => { const l = document.getElementById('log'); return l ? l.innerText : ''; });
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  return { ctx, page, errs, puts, logText };
}
const feldPlatz = (sys) => ({ [sys]: { plaetze: { 0: { frei: false, sorte: 'eisenkern', groesse: 'brocken', vorrat: 1000 } } } });

(async () => {
  const browser = await starteBrowser();
  // 7) Bestandskonto (weeklySystemsSeen gesetzt): der Hinweis kommt genau einmal.
  {
    const t = await tab(browser, spielstand({ weeklySystemsSeen: 14 }), { systeme: [], felder: {} });
    check('7-vorab: Boot ohne Skriptfehler', t.errs.length === 0, t.errs.slice(0, 2));
    check('7-anker: die Karte kennt 111 Sternsysteme', await t.page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); return true; }) && (await (async () => { await t.page.waitForTimeout(1200); return t.page.evaluate(() => /111 Sternsysteme/.test((document.querySelector('#tab-karte') || document.body).innerText)); })()));
    check('7a: der Hinweis auf die 30 neuen Systeme steht im Protokoll', /Fernaufklärung hat 30 neue Sternsysteme kartiert/.test(t.logText), t.logText.slice(0, 120));
    await t.page.waitForTimeout(2500);
    check('7b: der Spielstand merkt sich den Hinweis (schubGesehen), damit er kein zweites Mal kommt', t.puts.some(b => /schubGesehen[\\"]+:\s*true/.test(b)), { puts: t.puts.length });
    await t.ctx.close();
  }
  // 8) Die Gürtelliste des Servers hat Vorrang: vega (nicht in der lokalen Auswahl) traegt die Gürtelbahn,
  //    kepler (lokal Gürtel, aber ohne Serverfeld) nicht - beide Haelften des Paars.
  {
    const t = await tab(browser, spielstand({ weeklySystemsSeen: 14, schubGesehen: true }), { systeme: ['vega', 'orion'], felder: Object.assign({}, feldPlatz('vega'), feldPlatz('orion')) });
    check('8-vorab: Boot ohne Skriptfehler', t.errs.length === 0, t.errs.slice(0, 2));
    const bahn = async (sys) => { await t.page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); }); await t.page.waitForTimeout(800); await oeffneSystemUeberSektoren(t.page, sys); await t.page.waitForTimeout(1200);
      return t.page.evaluate(() => { const L = document.getElementById('galaxySystemLayer'); return !!(L && [...L.querySelectorAll('ellipse')].some(e => e.getAttribute('stroke') === '#c9c7bd' && e.getAttribute('stroke-dasharray') === '1,7')); }); };
    const vega = await bahn('vega');
    check('8a: vega traegt die Gürtelbahn, weil der Server es als Gürtelsystem nennt', vega === true, { vega });
    const kepler = await bahn('kepler');
    check('8c: kepler ohne Serverfeld traegt keine Gürtelbahn (Gegenrichtung des Paars)', kepler === false, { kepler });
    check('8b: das Paar misst also die Serverliste, nicht die lokale Rechnung', vega === true && kepler === false);
    await t.ctx.close();
  }
  await browser.close();
  ende();
})();
