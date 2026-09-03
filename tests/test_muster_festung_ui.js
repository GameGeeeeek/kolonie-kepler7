// Der Verband gegen eine ASTEROIDENFESTUNG im Allianz-Tab (01.09.2026) - gebaut nach
// test_muster_nest_ui.js.
//
//   node tests/test_muster_festung_ui.js
//
// GEPRUEFT WIRD:
//   1. Am Quelltext: musterZielText kennt die Festung; der claim-Zweig gilt fuer Nest UND Festung;
//      der Bericht hat einen Festungs-Zweig.
//   2. Mit einem laufenden Festungs-Angriff nennt die Box Stufe und System - nirgends "null".
//   3. Ohne Festung (und ohne Nester) gibt es KEINE Zielart-Wahl.
//   4. Mit einer Festung erscheint sie; nach der Wahl stehen Festungs-Auswahl UND Ziel-Auswahl
//      (Kern/Schildkuppel/Geschuetztuerme) statt des Tag-Feldes; die Liste nennt Stufe, System
//      und Kernstand.
//   5. DER AUFRUF: "Angriff planen" schickt zielArt 'festung', festungSystem, festungId und das
//      gewaehlte Bauteil an /musterattack/create - gemessen am Request, nicht am Markup.
//
// GEGENPROBE: Ohne den Festungs-Zweig in renderAllianceMusterBox fehlt die Option (4a); ohne
// festungWahl im create-Aufruf fehlt festungZiel im Request (5b).
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = path.resolve(process.env.KEPLER_SPIELDATEI || SPIELDATEI);
const FILE = 'file://' + DATEI;
const JS = fs.readFileSync(DATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

const TAG = 'TST';
const SYS = 'chronos';
const FESTUNG = { id: 'fest-1', stufe: 'sternenfeste', platz: '0', sorte: 'eisen', kern: 900000, kernMax: 1200000,
  hort: 5000, hortProto: 0, seit: Date.now() - 3600000, letzteReifung: Date.now(), beitraege: {}, schlaege: {},
  bauteile: { schild: { lp: 300000, lpMax: 480000 }, tuerme: { lp: 0, lpMax: 300000 } } };
const MUSTERDOC = {
  id: 'muster1', zielArt: 'festung', targetTag: null,
  festungId: 'fest-1', festungSystem: SYS, festungStufe: 'sternenfeste', festungStufeName: 'Sternenfeste', festungZiel: 'kern',
  createdBy: 'x', createdByName: 'Kommandantin', message: '',
  createdAt: Date.now() - 60000, museterEndsAt: Date.now() + 600000,
  phase: 'gathering', dispatch: null, result: null
};
const SAVE = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  seenTabHints: { basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1, galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1 },
  resources: { energie:9e5, erz:9e5, kristalle:9e5, deuterium:9e5, antimaterie:900, forschungspunkte:900 },
  buildings: { solar:20, mine:18, labor:10, lager:40, werft:12 }, research: {},
  fleet: { jaeger:40, cruisers:20, missions:[] }, colonies: {}, activeBasePlanet: 'home',
  player: { id:'u', name:'A', avatarKey:null, allianceTag:TAG, allianceRole:'admin' },
  xp: 5000, credits: 5000, buffs: [], lastTick: Date.now(), colonyNames: {},
  nextPlanetEventCheck: Date.now() + 3600000, nextTraderCheck: Date.now() + 3600000
});

function backend(store, opt){
  opt = opt || {};
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, st) => r.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, supporter:{active:false,tier:null} });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[], collapsedSystems:{}, activeWormhole:null, news:[], controlledSystems:{}, factions:{}, alienNester: [] });
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: Object.assign({ plaetze:{} }, opt.festung ? { festung: FESTUNG } : {}) } });
    if (p === 'musterattack/create'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__create = (store.__create || []).concat([body]);
      return j({ ok:true, doc: Object.assign({}, MUSTERDOC, { festungZiel: body.festungZiel || 'kern' }) });
    }
    if (p === 'storage-list') return j({ keys: Object.keys(store) });
    if (p.indexOf('storage/') === 0){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') return j({ ok:true, version:2 });
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))
      return j(p.indexOf('pending') >= 0 ? { reward:null } : []);
    return j([]);
  };
}

async function messen(browser, opt, extraStore, waehleFestung){
  const store = Object.assign({
    'kepler7-save-v3': SAVE,
    ['alliance:' + TAG + ':base']: JSON.stringify({ foundedAt: Date.now() - 86400000, sector: 'kepler', level: 3, hp: 1000 }),
    ['alliance:' + TAG + ':info']: JSON.stringify({ tag: TAG, creatorId: 'u', creatorName: 'A', createdAt: Date.now() - 86400000, joinMode: 'open' }),
    ['alliance:' + TAG + ':role:u']: JSON.stringify({ role: 'admin', joinedAt: Date.now() - 86400000, userId: 'u' })
  }, extraStore || {});
  const ctx = await browser.newContext({ viewport: { width:1280, height:900 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend(store, opt));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE);
  await page.waitForTimeout(2400);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
    const t = document.querySelector('[data-tab="allianz"]'); if (t) t.click();
  });
  await page.waitForTimeout(2600);
  if (waehleFestung){
    await page.evaluate(() => {
      const sel = document.querySelector('#allianceMusterBox #musterZielArtSelect');
      if (!sel) return;
      sel.value = 'festung';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(1400);
  }
  if (waehleFestung === 'planen'){
    await page.evaluate(() => {
      const z = document.querySelector('#allianceMusterBox #musterFestungZielSelect');
      if (z){ z.value = 'schild'; z.dispatchEvent(new Event('change', { bubbles: true })); }
      const b = document.querySelector('#allianceMusterBox #musterCreateBtn');
      if (b) b.click();
    });
    await page.waitForTimeout(1200);
  }
  const r = await page.evaluate(() => {
    const box = document.getElementById('allianceMusterBox');
    const fs_ = box && box.querySelector('#musterFestungSelect');
    const zs = box && box.querySelector('#musterFestungZielSelect');
    return {
      da: !!box, text: box ? (box.innerText || '') : '',
      hatArtWahl: !!(box && box.querySelector('#musterZielArtSelect')),
      artOptionen: box && box.querySelector('#musterZielArtSelect') ? [...box.querySelector('#musterZielArtSelect').options].map(o => o.value) : [],
      hatFestungWahl: !!fs_, hatZielWahl: !!zs, hatTagFeld: !!(box && box.querySelector('#musterTargetTagInput')),
      festungListe: fs_ ? fs_.innerHTML : '', zielOptionen: zs ? [...zs.options].map(o => o.value) : []
    };
  });
  r.bootfehler = fehler.slice(0, 2);
  r.create = store.__create || [];
  await ctx.close();
  return r;
}

(async () => {
  // ---- 1) Quelltext ------------------------------------------------------------------------------
  const zvon = JS.indexOf('function musterZielText(');
  const zblock = JS.slice(zvon, JS.indexOf('\n  }', zvon));
  check('1a: musterZielText kennt die Zielart festung', zvon > 0 && /zielArt === 'festung'/.test(zblock));
  const cvon = JS.indexOf('async function claimMusterAttackOutcome(');
  const cbis = JS.indexOf('async function refreshAllianceMusterAttack(');
  const cblock = (cvon > 0 && cbis > cvon) ? JS.slice(cvon, cbis) : '';
  /* Der Zweig deckt inzwischen mehrere Ziele ohne Allianz ab (Nest, Festung, Vorposten).
     Geprueft wird die Regel, nicht die Zahl der Glieder: `data.nest` steht vorn, `data.festung`
     ist dabei. Faellt eines von beiden weg, ist diese Pruefung zu Recht rot. */
  check('1b: der claim-Zweig gilt fuer Nest UND Festung',
    /if \(data\.nest(?: \|\| data\.\w+)* \|\| data\.festung(?: \|\| data\.\w+)*\)\{/.test(cblock),
    { kopf: (cblock.match(/if \(data\.nest[^)]*\)\{/) || ['-'])[0] });
  check('1c: der Bericht hat einen Festungs-Zweig', /istFestungBericht = r\.zielArt === 'festung'/.test(JS));
  /* Der Satz in HELP_SECTIONS zaehlt inzwischen mehr Zielarten auf. Geprueft wird, dass die
     Asteroidenfestung IN diesem Satz steht - nicht die genaue Reihenfolge der Aufzaehlung. */
  const hilfeSatz = (JS.match(/Ziel kann eine fremde Allianzbasis[^.<]{0,200}sein/) || [''])[0];
  check('1d: die Hilfe nennt die Festung als Verbandsziel',
    /Asteroidenfestung/.test(hilfeSatz), { satz: hilfeSatz });

  const browser = await starteBrowser();
  try {
    // ---- 2) Laufender Festungs-Angriff --------------------------------------------------------
    const mit = await messen(browser, { festung: true }, { ['alliance:' + TAG + ':musterattack']: JSON.stringify(MUSTERDOC) });
    check('2a-vorab: die Box ist da und der Start ist fehlerfrei', mit.da && mit.bootfehler.length === 0, { da: mit.da, bootfehler: mit.bootfehler });
    check('2a: die Box nennt Stufe und System der Festung - und nirgends "null"',
      /Sternenfeste/.test(mit.text) && /Chronos/i.test(mit.text) && !/\[null\]|\bnull\b/.test(mit.text), { text: mit.text.slice(0, 240) });

    // ---- 3) Ohne Festung keine Zielart-Wahl -----------------------------------------------------
    const ohne = await messen(browser, {}, {});
    check('3a: ohne Festung und ohne Nester gibt es KEINE Zielart-Wahl', ohne.da && ohne.hatTagFeld && !ohne.hatArtWahl, { artWahl: ohne.hatArtWahl, tagFeld: ohne.hatTagFeld });

    // ---- 4) Mit Festung erscheint sie -------------------------------------------------------------
    const frei = await messen(browser, { festung: true }, {});
    check('4a: mit einer Festung steht die Zielart-Wahl da - MIT der Option festung und OHNE Nest-Option (es gibt keine Nester)',
      frei.hatArtWahl && frei.artOptionen.includes('festung') && !frei.artOptionen.includes('alien-nest'), { optionen: frei.artOptionen });
    check('4a2: solange "Fremde Allianz" gewaehlt ist, steht weiterhin das Tag-Feld da', frei.hatTagFeld && !frei.hatFestungWahl, { tagFeld: frei.hatTagFeld });
    const gewaehlt = await messen(browser, { festung: true }, {}, true);
    check('4b: nach der Wahl stehen Festungs- und Ziel-Auswahl statt des Tag-Feldes',
      gewaehlt.hatFestungWahl && gewaehlt.hatZielWahl && !gewaehlt.hatTagFeld, { festung: gewaehlt.hatFestungWahl, ziel: gewaehlt.hatZielWahl, tagFeld: gewaehlt.hatTagFeld });
    check('4c: die Liste nennt Stufe, System und Kernstand', /Sternenfeste/.test(gewaehlt.festungListe) && /Chronos/i.test(gewaehlt.festungListe) && /Kern/.test(gewaehlt.festungListe), { liste: gewaehlt.festungListe.slice(0, 200) });
    check('4d: die Ziel-Auswahl fuehrt Kern, Schild und Tuerme', ['kern','schild','tuerme'].every(k => gewaehlt.zielOptionen.includes(k)), { ziele: gewaehlt.zielOptionen });

    // ---- 5) Der Aufruf ------------------------------------------------------------------------------
    const geplant = await messen(browser, { festung: true }, {}, 'planen');
    const c = geplant.create[0];
    check('5a: "Angriff planen" ruft /musterattack/create mit zielArt festung, System und Kennung', !!c && c.zielArt === 'festung' && c.festungSystem === SYS && c.festungId === 'fest-1' && c.tag === TAG, c);
    check('5b: und mit dem gewaehlten Bauteil als Ziel des ganzen Verbands', !!c && c.festungZiel === 'schild', c && { festungZiel: c.festungZiel });
  } finally {
    await browser.close();
  }
  ende();
})();
