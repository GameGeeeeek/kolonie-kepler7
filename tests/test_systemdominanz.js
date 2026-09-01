// Wer beherrscht ein System? Die Karte sagt es (Auftrag Sascha, 29.08.2026).
//
//   node tests/test_systemdominanz.js
//
// DER ANLASS IST GEMESSEN, und er war groesser als "es fehlt eine Anzeige". Beide Kartenstellen
// (Nachbarpunkte der offenen Systemebene und Sektoransicht) pruefen die Eroberung nur gegen die
// EIGENE Spieler-ID. galaxyCache.controlledSystems ist aber die globale Karte systemId -> userId
// ALLER Spieler: Ein von einem FREMDEN Spieler erobertes System sah auf der Karte aus wie ein
// unbeanspruchtes. Erfahren konnte man es nur, indem man das System oeffnete - die Chip-Zeile dort
// kennt die Unterscheidung laengst und nennt sie im eigenen Kommentar "zwei verschiedene Aussagen".
// Ebenso unsichtbar war die Kolonie-Herrschaft, obwohl computeSystemControllers sie vollstaendig
// fuehrt und renderTerritoryBox sie als Liste zeigt.
//
// GEPRUEFT WIRD DIE WIRKUNG, NICHT DIE BESCHRIFTUNG (Arbeitsregel 61). Jede Kernmessung ist ein
// PAAR aus zwei Laeufen, die sich in genau einem Punkt unterscheiden - eine Pruefung auf "das Wort
// erobert steht da" waere in beiden Faellen gruen.
//
// GEPRUEFT WIRD:
//   1. Quelltext: die EINE Quelle existiert genau einmal, und der teure Herrscher-Aufruf laeuft
//      ueber den Zwischenspeicher (ohne ihn waeren es gemessen ~24 Mio Vergleiche je Kartenaufbau).
//   2. Die Rangfolge, ausgefuehrt ueber die geschnittene Funktion: jede Stufe schlaegt die
//      naechste, und das Nest steht NUR, wenn sonst niemand herrscht.
//   3. Sektoransicht: eine FREMDE Eroberung faerbt den Knoten - der Anlassfall.
//   4. Eigener Besitz ist GEFUELLT, Fremdes nur umrandet (die Bildsprache der Etappe).
//   5. Regionsuebersicht: die Systempunkte tragen die Dominanzfarbe.
//   6. Gegenrichtung: ein System ohne jede Macht traegt keinen Dominanz-Ring.
//
// GEGENPROBE (in beide Richtungen ausgefuehrt, per KEPLER_SPIELDATEI gegen origin/main),
// GEMESSEN statt behauptet - die erste Fassung dieser Liste war falsch:
//   Es fallen 21 von 27:  1a 1b 1c-vorab 1c 2-bau 2a-2g 3a 3b 4a 4b 4c 5-vorab 5a 5b 6a
//   Gruen bleiben MUESSEN: 3-vorab und 6b (Boot ohne Fehler; ohne Machtdaten ist nichts markiert)
//     sowie die drei -anker (die Sektoransicht laesst sich oeffnen - das konnte sie vorher auch).
// Hier stand zuerst, 6a bleibe gruen, weil es ja "hier ist keine Macht" sage. Die Messung sagt das
// Gegenteil: 6a verlangt, dass MANCHE Knoten einen Ring tragen und andere nicht - am alten Stand
// tragen ALLE keinen, die Aussage ist also gar nicht pruefbar. Eine Pflichtliste ist selbst eine
// Behauptung, bis die Gegenprobe sie gemessen hat (Arbeitsregel 71).
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer, logMitschnitt } = require('./lib/umgebung');
const { oeffneSektorMitSystem } = require('./lib/karte');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
const ICH = 'u-ich';

// Gemessene Systeme (aus PLANETS gelesen, nicht geraten): zenith hat GENAU DREI Planeten - damit
// laesst sich eine vollstaendige Kolonie-Herrschaft mit drei Eintraegen herstellen.
const SYS_FREMD_EROBERT = 'vega';
const SYS_EIGEN_EROBERT = 'chronos';
// GEMESSEN und beim ersten Anlauf falsch gewaehlt: zenith und tiefsee haben zwar nur drei
// Planeten, tragen in STAR_SYSTEMS aber hidden:true - sie erscheinen auf der Karte gar nicht.
// Die Pruefung darauf war dadurch aus dem FALSCHEN Grund gruen (kein Knoten statt kein Ring,
// Arbeitsregel 28). Gewaehlt sind jetzt SICHTBARE Systeme, gelesen aus STAR_SYSTEMS.
const SYS_KOLONIE       = 'sys_ashen_bogen';
const KOLONIE_PLANETEN  = ['n8ashen', 'n9ashen', 'n10ashen', 'n11ashen', 'n12ashen'];

// ---- 1) Quelltext: die eine Quelle und der Riegel gegen die quadratische Form ----------------
check('1a: systemDominanz existiert GENAU EINMAL',
  (JS.match(/function systemDominanz\(/g) || []).length === 1,
  { anzahl: (JS.match(/function systemDominanz\(/g) || []).length });
check('1b: beide Kartenstellen lesen sie, statt die Regel zu wiederholen',
  (JS.match(/systemDominanz\(/g) || []).length >= 4,
  { aufrufe: (JS.match(/systemDominanz\(/g) || []).length });
// Der Zwischenspeicher ist keine Feinheit: computeSystemControllers macht je besessenem Planeten
// ein lineares PLANETS.find ueber 499+ Eintraege. Ohne ihn liefe das je SYSTEMKNOTEN erneut.
// Kommentare VOR dem Suchen leeren (Arbeitsregel 33): Der Doku-Block ueber systemDominanz nennt
// computeSystemControllers beim Namen, und die rohe Textsuche hielt das fuer einen Aufruf.
const JS_OHNE_KOMMENTARE = JS
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '));
const domRumpf = (() => {
  const i = JS_OHNE_KOMMENTARE.indexOf('function systemDominanz(');
  if (i < 0) return '';
  const j = JS_OHNE_KOMMENTARE.indexOf('{', i);
  let t = 0, k = j;
  while (k < JS_OHNE_KOMMENTARE.length){
    if (JS_OHNE_KOMMENTARE[k] === '{') t++;
    else if (JS_OHNE_KOMMENTARE[k] === '}'){ t--; if (t === 0) return JS_OHNE_KOMMENTARE.slice(i, k + 1); }
    k++;
  }
  return '';
})();
check('1c-vorab: der Rumpf von systemDominanz laesst sich schneiden', domRumpf.length > 200, { laenge: domRumpf.length });
check('1c: systemDominanz liest die Herrscher ueber den Zwischenspeicher, nicht direkt',
  /function systemHerrscherCached\(/.test(JS) && /systemHerrscherCached\(\)/.test(domRumpf)
  && !/computeSystemControllers\(\)/.test(domRumpf),
  { cachedImRumpf: /systemHerrscherCached\(\)/.test(domRumpf), direktImRumpf: /computeSystemControllers\(\)/.test(domRumpf) });

// ---- 2) Die Rangfolge, AUSGEFUEHRT statt gelesen ---------------------------------------------
// Die Funktion wird geschnitten und mit gestellten Umgebungen gefahren. Ein Blick auf den
// Quelltext koennte nicht sagen, ob die Reihenfolge der Zweige wirklich traegt.
function schneide(name){
  const i = JS.indexOf('function ' + name + '(');
  if (i < 0) return null;
  const j = JS.indexOf('{', i);
  let t = 0, k = j;
  while (k < JS.length){
    if (JS[k] === '{') t++;
    else if (JS[k] === '}'){ t--; if (t === 0) return JS.slice(i, k + 1); }
    k++;
  }
  return null;
}
let dominanzFn = null, bauFehler = '';
try {
  // Die drei Farbkonstanten sind einzeilig, DOMINANZ_BETONUNG ist ein mehrzeiliges Objektliteral -
  // es wird deshalb ueber die Klammertiefe geschnitten, nicht per Zeilen-Regex.
  const konst = ["DOMINANZ_FARBE_EIGEN", "DOMINANZ_FARBE_FEIND", "DOMINANZ_FARBE_FREMD"]
    .map(n => (JS.match(new RegExp("\\n\\s*const " + n + " = [^\\n]*")) || [''])[0]).join('\n');
  const betonung = (() => {
    const i = JS.indexOf('const DOMINANZ_BETONUNG = {');
    if (i < 0) return '';
    const j = JS.indexOf('{', i);
    let t = 0, k = j;
    while (k < JS.length){
      if (JS[k] === '{') t++;
      else if (JS[k] === '}'){ t--; if (t === 0) return JS.slice(i, k + 2); }
      k++;
    }
    return '';
  })();
  // domMitBetonung wird von systemDominanz an JEDER Rueckgabe gerufen - fehlt sie, wirft die
  // geschnittene Funktion erst beim AUFRUF, also ausserhalb dieses try/catch. Genau so ist der
  // Test beim ersten Anlauf nach 5 statt 27 Pruefungen gestorben.
  const fn = [betonung, schneide('domMitBetonung'), schneide('systemDominanz')].join('\n');
  if (!schneide('systemDominanz') || !schneide('domMitBetonung') || !betonung)
    throw new Error('Baustein fehlt: ' + [betonung?'':'DOMINANZ_BETONUNG',
      schneide('domMitBetonung')?'':'domMitBetonung', schneide('systemDominanz')?'':'systemDominanz'].filter(Boolean).join(', '));
  dominanzFn = new Function('umgebung', konst + '\n' + fn + `
    const galaxyCache = umgebung.galaxyCache, state = umgebung.state;
    const ALIEN_VOELKER = umgebung.ALIEN_VOELKER, NEST_STUFEN = umgebung.NEST_STUFEN;
    function systemHerrscherCached(){ return umgebung.herrscher || {}; }
    function factionOwning(id){ return (umgebung.fraktionen || {})[id] || null; }
    function nesterImSystem(id){ return (umgebung.nester || []).filter(n => n.sys === id); }
    function myAllianceTag(){ return umgebung.meinTag || null; }
    function karteEbeneAn(){ return umgebung.ebenenAn !== false; }
    return systemDominanz;`);
} catch(e){ bauFehler = String(e).split('\n')[0]; }
check('2-bau: systemDominanz laesst sich schneiden und ausfuehren', !!dominanzFn, { fehler: bauFehler });
// Scheitert der Aufbau, wird JEDE abhaengige Pruefung NAMENTLICH als rot gemeldet, statt still zu
// verschwinden (Arbeitsregel 34). Ohne das lief die Gegenprobe mit 20 statt 27 Pruefungen, und der
// rote Exit-Code sah aus wie eine vollstaendige Gegenprobe.
const ABHAENGIG_2 = ['2a: Eroberung schlaegt Kolonie, Fraktion und Nest',
  '2b: ohne Eroberung schlaegt die Kolonie-Herrschaft Fraktion und Nest',
  '2c: ohne Kolonie-Herrschaft schlaegt die Fraktion das Nest',
  '2d: das Nest steht NUR, wenn sonst niemand herrscht',
  '2e: der Kollaps ueberlagert jede Macht',
  '2f: eigene und fremde Eroberung sind verschieden und verschieden gefaerbt',
  '2g: ohne jede Macht liefert die Funktion null',
  '2-lauf: kein Laufzeitfehler in den Messaufrufen'];
function fehlend(namen, grund){ for (const n of namen) check(n, false, { nichtGeprueft: grund }); }
if (!dominanzFn) fehlend(ABHAENGIG_2, bauFehler || 'systemDominanz nicht ausfuehrbar');

if (dominanzFn){
  const VOELKER = { kryll:{ name:'Kryll-Schwarm', farbe:'#8fd694' } };
  const STUFEN = [null, {name:'Sporenherd'}, {name:'Brutkammer'}, {name:'Schwarmstock'}, {name:'Hochnest'}, {name:'Königin'}];
  const basis = extra => Object.assign({
    galaxyCache: { collapsedSystems:{}, controlledSystems:{} },
    state: { player:{ id:ICH } }, herrscher:{}, fraktionen:{}, nester:[],
    meinTag:'GG', ALIEN_VOELKER:VOELKER, NEST_STUFEN:STUFEN
  }, extra || {});
  /* Jeder Messaufruf ist gefasst: Ein try/catch um den AUFBAU genuegt nicht, wenn die
     geschnittene Funktion erst beim AUFRUF wirft (die Lehre aus 4-bau3 in
     test_schiffsmodul_paritaet). Ohne diese Wache endet der ganze Lauf mitten drin, und der rote
     Exit-Code sieht aus wie eine vollstaendige Gegenprobe. */
  const laufFehler = [];
  const dom = u => { try { return dominanzFn(u)('s1'); }
                     catch(e){ laufFehler.push(String(e).split('\n')[0]); return null; } };

  // Jede Stufe wird gegen die naechstschwaechere gestellt: Wer gewinnt, wenn BEIDE da sind?
  const alleVier = {
    galaxyCache:{ collapsedSystems:{}, controlledSystems:{ s1:'u-fremd' } },
    state:{ player:{ id:ICH } },
    herrscher:{ s1:{ tag:'XY', playerName:'Fremd', planetCount:3 } },
    fraktionen:{ s1:{ id:'legion', name:'Legion', color:'#c33' } },
    nester:[{ sys:'s1', volk:'kryll', stufe:5 }],
    meinTag:'GG', ALIEN_VOELKER:VOELKER, NEST_STUFEN:STUFEN
  };
  check('2a: Eroberung schlaegt Kolonie, Fraktion und Nest',
    dom(alleVier) && dom(alleVier).art === 'erobert-fremd', { art: dom(alleVier) && dom(alleVier).art });

  const ohneErob = Object.assign({}, alleVier, { galaxyCache:{ collapsedSystems:{}, controlledSystems:{} } });
  check('2b: ohne Eroberung schlaegt die Kolonie-Herrschaft Fraktion und Nest',
    dom(ohneErob) && dom(ohneErob).art === 'kolonie-fremd', { art: dom(ohneErob) && dom(ohneErob).art });

  const ohneKol = Object.assign({}, ohneErob, { herrscher:{} });
  check('2c: ohne Kolonie-Herrschaft schlaegt die Fraktion das Nest',
    dom(ohneKol) && dom(ohneKol).art === 'fraktion', { art: dom(ohneKol) && dom(ohneKol).art });

  const nurNest = Object.assign({}, ohneKol, { fraktionen:{} });
  check('2d: das Nest steht NUR, wenn sonst niemand herrscht',
    dom(nurNest) && dom(nurNest).art === 'nest' && /Königin/.test(dom(nurNest).titel),
    { art: dom(nurNest) && dom(nurNest).art, titel: dom(nurNest) && dom(nurNest).titel });

  // Der Kollaps ueberlagert alles - in einem zerstoerten System ist die Besitzfrage gegenstandslos.
  const kollaps = Object.assign({}, alleVier, { galaxyCache:{ collapsedSystems:{ s1:true }, controlledSystems:{ s1:'u-fremd' } } });
  check('2e: der Kollaps ueberlagert jede Macht',
    dom(kollaps) && dom(kollaps).art === 'kollabiert', { art: dom(kollaps) && dom(kollaps).art });

  // Die eigene Eroberung ist eine ANDERE Aussage als eine fremde - genau der Anlassfall.
  const meins = Object.assign({}, basis(), { galaxyCache:{ collapsedSystems:{}, controlledSystems:{ s1:ICH } } });
  const fremd = Object.assign({}, basis(), { galaxyCache:{ collapsedSystems:{}, controlledSystems:{ s1:'u-fremd' } } });
  check('2f: eigene und fremde Eroberung sind verschieden und verschieden gefaerbt',
    dom(meins).art === 'erobert-eigen' && dom(fremd).art === 'erobert-fremd' && dom(meins).farbe !== dom(fremd).farbe,
    { eigen: dom(meins).art + '/' + dom(meins).farbe, fremd: dom(fremd).art + '/' + dom(fremd).farbe });

    check('2g: ohne jede Macht liefert die Funktion null', dom(basis()) === null, { erg: dom(basis()) });
  check('2-lauf: kein Laufzeitfehler in den Messaufrufen', laufFehler.length === 0, laufFehler.slice(0,2));
}

// ---- Browser-Fixture -------------------------------------------------------------------------
function save(){
  const jetzt = Date.now();
  const gesehen = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) gesehen[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:gesehen,
    activeEvent:{ key:'__testruhe__', bis: jetzt + 9e8 },
    resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
    buildings:{solar:22,mine:20,labor:14,lager:30,werft:14}, research:{}, fleet:{ jaeger:80, missions:[] },
    colonies:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich', avatarKey:null },
    xp:9e5, credits:5e5, buffs:[], lastTick:jetzt, colonyNames:{}, modules:{}, shipModules:{},
    nextPlanetEventCheck: jetzt+3600000, nextTraderCheck: jetzt+3600000 });
}
function store(opt){
  const s = {};
  if (!opt.ohneKolonieHerr){
    // EINE Identitaet haelt ALLE drei zenith-Planeten - genau die Bedingung, unter der
    // computeSystemControllers eine Kontrolle vergibt (mehr als eine Identitaet = umkaempft).
    s['leaderboard:u-nachbar'] = JSON.stringify({ id:'u-nachbar', name:'Nachbarin', allianceTag:'ZEN',
      score:5000, ships:10, bp:5, lastSeen:Date.now(), ownedPlanets: KOLONIE_PLANETEN });
  }
  s['leaderboard:' + ICH] = JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9,
    lastSeen:Date.now(), ownedPlanets: [] });
  return s;
}
function backend(opt){
  const st = store(opt);
  return async r => {
    const req = r.request(); const u = req.url(); const p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[],
      alienNester:[],
      controlledSystems: opt.ohneEroberung ? {} : { [SYS_FREMD_EROBERT]:'u-fremd', [SYS_EIGEN_EROBERT]:ICH } });
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'reports') return j({ reports: [] });
    if (p === 'pending-rewards/claim') return j({ reward: null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){
      const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]);
      return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') return j({ ok:true, version:2 });
      if (st[k] !== undefined) return j({ key:k, value:st[k], shared:true, version:1 });
      return j({ e:1 }, 404);
    }
    return j({ ok:true });
  };
}
async function tab(browser, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport:{ width:1400, height:1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(opt));
  await page.addInitScript(([k, v]) => { localStorage.setItem('kepler7_token','tok'); localStorage.setItem('kepler7_'+k, v); }, [SAVE_KEY, save()]);
  await logMitschnitt(page);
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}
// Liest den Dominanz-Ring eines Systemplatzes - gescopt auf #galaxyMapSvg (Arbeitsregel 5) und
// mit GEMESSENER Fuellung statt blosser Existenz (Arbeitsregel 55/61).
async function ringAmSystem(page, sysId){
  return page.evaluate(id => {
    const g = document.querySelector('#galaxyMapSvg [data-sektor-sys="' + id + '"]');
    if (!g) return { da:false };
    const c = g.querySelector('[data-dominanz]');
    if (!c) return { da:true, ring:null };
    const r = c.getBoundingClientRect();
    return { da:true, ring:{ art:c.getAttribute('data-dominanz'), name:c.getAttribute('data-ring'),
      stroke:c.getAttribute('stroke'), fill:c.getAttribute('fill'),
      sichtbar: r.width > 0 && r.height > 0,
      titel:(c.querySelector('title')||{}).textContent || '' } };
  }, sysId);
}

(async () => {
  const browser = await starteBrowser();

  // ---- 3/4/6) Sektoransicht: der Anlassfall und die Bildsprache ------------------------------
  {
    const t = await tab(browser);
    check('3-vorab: Boot ohne Skriptfehler', t.errs.length === 0, t.errs.slice(0,2));

    const aufV = await oeffneSektorMitSystem(t.page, SYS_FREMD_EROBERT);
    check('3-anker: die Sektoransicht mit ' + SYS_FREMD_EROBERT + ' steht offen', aufV === true, { aufV });
    const fremd = await ringAmSystem(t.page, SYS_FREMD_EROBERT);
    check('3a: eine FREMDE Eroberung faerbt den Knoten (der Anlassfall)',
      !!(fremd.ring && fremd.ring.art === 'erobert-fremd' && fremd.ring.sichtbar), fremd);
    check('3b: und der Tooltip sagt es im Klartext',
      !!(fremd.ring && /fremden Spieler erobert/.test(fremd.ring.titel)), { titel: fremd.ring && fremd.ring.titel });

    const aufC = await oeffneSektorMitSystem(t.page, SYS_EIGEN_EROBERT);
    check('4-anker: die Sektoransicht mit ' + SYS_EIGEN_EROBERT + ' steht offen', aufC === true, { aufC });
    const eigen = await ringAmSystem(t.page, SYS_EIGEN_EROBERT);
    // Das PAAR ist der Beleg: Eigener Besitz GEFUELLT, Fremdes nur umrandet. Eine Haelfte allein
    // waere auch erfuellt, wenn alle Ringe gleich aussaehen.
    check('4a: eigener Besitz ist gefuellt, fremder nur umrandet',
      !!(eigen.ring && fremd.ring && eigen.ring.fill !== 'none' && fremd.ring.fill === 'none'
         && eigen.ring.stroke !== fremd.ring.stroke),
      { eigen: eigen.ring && { fill:eigen.ring.fill, stroke:eigen.ring.stroke },
        fremd: fremd.ring && { fill:fremd.ring.fill, stroke:fremd.ring.stroke } });
    check('4b: der Bestands-Anker data-ring="kontrolle" ist erhalten geblieben',
      !!(eigen.ring && eigen.ring.name === 'kontrolle'), { name: eigen.ring && eigen.ring.name });

    const aufZ = await oeffneSektorMitSystem(t.page, SYS_KOLONIE);
    check('4c-anker: die Sektoransicht mit ' + SYS_KOLONIE + ' steht offen', aufZ === true, { aufZ });
    const kol = await ringAmSystem(t.page, SYS_KOLONIE);
    check('4c: eine fremde Kolonie-Herrschaft faerbt den Knoten und nennt den Halter',
      !!(kol.ring && kol.ring.art === 'kolonie-fremd' && /ZEN/.test(kol.ring.titel)), kol);

    /* Gegenrichtung - sie MUSS an beiden Staenden gruen sein und ist deshalb der Beleg dafuer,
       dass nicht einfach jeder Knoten einen Ring bekommt.
       Gemessen wird die REGEL in der GERADE OFFENEN Ansicht, nicht ein fest benanntes System
       (Arbeitsregel 3): Die Sektoransicht zeigt nur die Systeme EINER Region, und ein
       woanders liegendes System liefert "kein Knoten" statt "kein Ring" - beim ersten Anlauf
       genau der falsche Grund (Arbeitsregel 28). */
    const ohneRing = await t.page.evaluate(() => {
      const alle = Array.from(document.querySelectorAll('#galaxyMapSvg [data-sektor-sys]'));
      const ohne = alle.filter(g => !g.querySelector('[data-dominanz]'));
      return { knoten: alle.length, ohneRing: ohne.length,
        beispiel: ohne.length ? ohne[0].getAttribute('data-sektor-sys') : null };
    });
    check('6a-vorab: die offene Sektoransicht zeigt ueberhaupt Systemknoten', ohneRing.knoten > 1, ohneRing);
    check('6a: Systeme ohne jede Macht tragen KEINEN Dominanz-Ring',
      ohneRing.knoten > 1 && ohneRing.ohneRing > 0 && ohneRing.ohneRing < ohneRing.knoten, ohneRing);
    await t.ctx.close();
  }

  // ---- 5) Regionsuebersicht: die Systempunkte tragen die Farbe --------------------------------
  {
    const t = await tab(browser);
    await t.page.evaluate(() => { const b = document.querySelector('[data-kb-knopf="zurueck"]'); if (b) b.click(); });
    await t.page.waitForTimeout(900);
    const punkte = await t.page.evaluate(() => {
      const alle = Array.from(document.querySelectorAll('#galaxyMapSvg [data-sys-dominanz]'));
      const mit = alle.filter(c => c.getAttribute('data-sys-dominanz'));
      return { gesamt: alle.length, mitMacht: mit.length,
        arten: Array.from(new Set(mit.map(c => c.getAttribute('data-sys-dominanz')))).sort(),
        farben: Array.from(new Set(mit.map(c => c.getAttribute('fill')))).length };
    });
    check('5-vorab: die Uebersicht zeichnet ueberhaupt Systempunkte', punkte.gesamt > 20, punkte);
    check('5a: die Punkte der beherrschten Systeme tragen ihre Macht',
      punkte.mitMacht >= 3 && punkte.arten.includes('erobert-fremd')
      && punkte.arten.includes('erobert-eigen') && punkte.arten.includes('kolonie-fremd'), punkte);
    check('5b: und verschiedene Maechte haben verschiedene Farben', punkte.farben >= 2, punkte);
    await t.ctx.close();
  }

  // ---- 6b) Gegenrichtung im Grossen: ohne Machtdaten bleibt die Karte unmarkiert --------------
  {
    const t = await tab(browser, { ohneEroberung:true, ohneKolonieHerr:true });
    const n = await t.page.evaluate(() => document.querySelectorAll('#galaxyMapSvg [data-sys-dominanz]:not([data-sys-dominanz=""])').length);
    check('6b: ohne Eroberung und ohne Kolonie-Herrschaft traegt kein Punkt eine Macht', n === 0, { markiert: n });
    await t.ctx.close();
  }

  await browser.close();
  ende();
})();
