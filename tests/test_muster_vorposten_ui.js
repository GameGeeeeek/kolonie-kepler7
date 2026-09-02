// Der Verband gegen einen VORPOSTEN im Allianz-Tab (02.09.2026) - gebaut nach
// test_muster_festung_ui.js.
//
//   node tests/test_muster_vorposten_ui.js
//
// GEPRUEFT WIRD:
//   1. Am Quelltext: musterZielText kennt den Vorposten; der claim-Zweig gilt fuer alle drei
//      Zielarten ohne Allianz; der Bericht hat einen Vorposten-Zweig.
//   2. Mit einem laufenden Vorposten-Angriff nennt die Box Stufe, BESITZER und System - nirgends
//      "null". Der Besitzer ist die Auskunft, die diese Zielart von Nest und Festung unterscheidet.
//   3. Ohne Vorposten gibt es KEINE Vorposten-Option in der Zielart-Wahl.
//   4. DIE AUSWAHL FILTERT: Der EIGENE Vorposten und einer unter BAUSCHUTZ stehen NICHT zur Wahl -
//      beide wuerde der Server abweisen, ein Eintrag dafuer waere ein Versprechen ohne Gegenstand.
//      Gemessen als PAAR gegen einen fremden, ungeschuetzten, der sehr wohl dasteht.
//   5. DER AUFRUF: "Angriff planen" schickt zielArt 'vorposten', vorpostenSystem und vorpostenId
//      an /musterattack/create - gemessen am Request, nicht am Markup.
//
// GEGENPROBE: Ohne den Filter in der Liste stuenden eigener und geschuetzter Vorposten zur Wahl
// (4b/4c); ohne vorpostenWahl im create-Aufruf fehlt vorpostenSystem im Request (5a).
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = path.resolve(process.env.KEPLER_SPIELDATEI || SPIELDATEI);
const FILE = 'file://' + DATEI;
const JS = fs.readFileSync(DATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

const TAG = 'TST';
const SYS = 'chronos';
const SYS_EIGEN = 'rigel', SYS_SCHUTZ = 'altair';
const STUFEN = [
  { stufe: 1, name: 'Feldlager',  kernLp: 20000,  verteidigung: 2500,  garnisonMax: 300,  flug: 0.06, prod: 0.015, scan: 1 },
  { stufe: 2, name: 'Stützpunkt', kernLp: 90000,  verteidigung: 12000, garnisonMax: 800,  flug: 0.10, prod: 0.03,  scan: 2 },
  { stufe: 3, name: 'Bastion',    kernLp: 400000, verteidigung: 60000, garnisonMax: 2000, flug: 0.15, prod: 0.05,  scan: 3 }
];
/* Drei Vorposten - genau die Messvorrichtung fuer Abschnitt 4: einer fremd und angreifbar, einer
   EIGEN, einer unter BAUSCHUTZ. Nur der erste darf in der Auswahl stehen. */
function vp(id, sys, opt){
  opt = opt || {};
  return { id, sys, besitzer: opt.eigener ? 'u' : 'x2', besitzerName: opt.eigener ? 'A' : 'Rivale',
    seit: opt.schutz ? Date.now() : Date.now() - 30*3600000, stufe: opt.stufe || 3, name: STUFEN[(opt.stufe||3)-1].name,
    kern: { lp: 300000, lpMax: 400000 }, verteidigung: 60000, garnisonAnzahl: 50,
    schutzBis: opt.schutz ? Date.now() + 12*3600000 : Date.now() - 3600000,
    nutzen: { flug: 0.15, prod: 0.05, scan: 3 }, eigener: !!opt.eigener, meinLetzterSchlag: 0, letzterKampf: null };
}
const MUSTERDOC = {
  id: 'muster1', zielArt: 'vorposten', targetTag: null,
  vorpostenId: 'vp-1', vorpostenSystem: SYS, vorpostenBesitzerName: 'Rivale', vorpostenStufeName: 'Bastion',
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
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{} } } });
    if (p === 'vorposten'){
      const liste = opt.ohneVorposten ? [] : [vp('vp-1', SYS), vp('vp-eigen', SYS_EIGEN, { eigener:true }), vp('vp-schutz', SYS_SCHUTZ, { schutz:true })];
      return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000,
        ausbauMs:43200000, garnisonFaktor:0.5, stufen:STUFEN, liste, eigene: liste.filter(x=>x.eigener).length });
    }
    if (p === 'musterattack/create'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__create = (store.__create || []).concat([body]);
      return j({ ok:true, doc: MUSTERDOC });
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
      sel.value = 'vorposten';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(1400);
  }
  if (waehleFestung === 'planen'){
    await page.evaluate(() => {
      const b = document.querySelector('#allianceMusterBox #musterCreateBtn');
      if (b) b.click();
    });
    await page.waitForTimeout(1200);
  }
  const r = await page.evaluate(() => {
    const box = document.getElementById('allianceMusterBox');
    const vs = box && box.querySelector('#musterVorpostenSelect');
    return {
      da: !!box, text: box ? (box.innerText || '') : '',
      hatArtWahl: !!(box && box.querySelector('#musterZielArtSelect')),
      artOptionen: box && box.querySelector('#musterZielArtSelect') ? [...box.querySelector('#musterZielArtSelect').options].map(o => o.value) : [],
      hatVorpostenWahl: !!vs, hatTagFeld: !!(box && box.querySelector('#musterTargetTagInput')),
      vorpostenWerte: vs ? [...vs.options].map(o => o.value) : [], vorpostenListe: vs ? vs.innerHTML : ''
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
  check('1a: musterZielText kennt die Zielart vorposten - und nennt den Besitzer',
    zvon > 0 && /zielArt === 'vorposten'/.test(zblock) && /vorpostenBesitzerName/.test(zblock));
  const cvon = JS.indexOf('async function claimMusterAttackOutcome(');
  const cbis = JS.indexOf('async function refreshAllianceMusterAttack(');
  const cblock = (cvon > 0 && cbis > cvon) ? JS.slice(cvon, cbis) : '';
  check('1b: der claim-Zweig gilt fuer alle drei Zielarten ohne Allianz', /if \(data\.nest \|\| data\.festung \|\| data\.vorposten\)\{/.test(cblock));
  check('1c: der Bericht hat einen Vorposten-Zweig', /istVorpostenBericht = r\.zielArt === 'vorposten'/.test(JS));
  check('1d: die Hilfe nennt den Vorposten als Verbandsziel', /eine Asteroidenfestung oder ein fremder Vorposten sein/.test(JS));
  check('1e: und erklaert die zweite Bauschutz-Pruefung bei der Ankunft', /Bauschutz wird ein zweites Mal bei der <em>Ankunft<\/em> geprüft/.test(JS));

  const browser = await starteBrowser();
  try {
    // ---- 2) Laufender Vorposten-Angriff ---------------------------------------------------------
    const mit = await messen(browser, {}, { ['alliance:' + TAG + ':musterattack']: JSON.stringify(MUSTERDOC) });
    check('2a-vorab: die Box ist da und der Start ist fehlerfrei', mit.da && mit.bootfehler.length === 0, { da: mit.da, bootfehler: mit.bootfehler });
    check('2a: die Box nennt Stufe, BESITZER und System - und nirgends "null"',
      /Bastion/.test(mit.text) && /Rivale/.test(mit.text) && /Chronos/i.test(mit.text) && !/\[null\]|\bnull\b/.test(mit.text),
      { text: mit.text.slice(0, 260) });

    // ---- 3) Ohne Vorposten keine Option ----------------------------------------------------------
    const ohne = await messen(browser, { ohneVorposten: true }, {});
    check('3a: ohne Vorposten gibt es keine Vorposten-Option (und mangels Nest/Festung gar keine Wahl)',
      ohne.da && ohne.hatTagFeld && !ohne.artOptionen.includes('vorposten'), { optionen: ohne.artOptionen, tagFeld: ohne.hatTagFeld });

    // ---- 4) Die Auswahl filtert -------------------------------------------------------------------
    const frei = await messen(browser, {}, {});
    check('4a: mit einem angreifbaren Vorposten steht die Zielart-Wahl da', frei.hatArtWahl && frei.artOptionen.includes('vorposten'), { optionen: frei.artOptionen });
    const gewaehlt = await messen(browser, {}, {}, true);
    check('4a2: nach der Wahl steht die Vorposten-Auswahl statt des Tag-Feldes',
      gewaehlt.hatVorpostenWahl && !gewaehlt.hatTagFeld, { vorposten: gewaehlt.hatVorpostenWahl, tagFeld: gewaehlt.hatTagFeld });
    /* DAS PAAR: Der fremde, ungeschuetzte steht drin - der EIGENE und der unter BAUSCHUTZ nicht.
       Beide wuerde der Server abweisen (400 bzw. 403); ein Eintrag dafuer waere ein Versprechen
       ohne Gegenstand. Eine Pruefung nur auf "der fremde ist da" waere auch ohne Filter gruen. */
    check('4b: der fremde, ungeschuetzte Vorposten steht zur Wahl', gewaehlt.vorpostenWerte.includes(SYS), { werte: gewaehlt.vorpostenWerte });
    check('4c: der EIGENE und der unter BAUSCHUTZ stehen NICHT zur Wahl',
      !gewaehlt.vorpostenWerte.includes(SYS_EIGEN) && !gewaehlt.vorpostenWerte.includes(SYS_SCHUTZ),
      { werte: gewaehlt.vorpostenWerte, hinweis: 'beide wuerde der Server abweisen - 400 bzw. 403' });
    check('4d: die Liste nennt Stufe, Besitzer, System, Kern und Verteidigung',
      /Bastion/.test(gewaehlt.vorpostenListe) && /Rivale/.test(gewaehlt.vorpostenListe) && /Kern/.test(gewaehlt.vorpostenListe) && /Verteidigung/.test(gewaehlt.vorpostenListe),
      { liste: gewaehlt.vorpostenListe.slice(0, 220) });

    // ---- 5) Der Aufruf ------------------------------------------------------------------------------
    const geplant = await messen(browser, {}, {}, 'planen');
    const c = geplant.create[0];
    check('5a: "Angriff planen" ruft create mit zielArt vorposten, System und Kennung',
      !!c && c.zielArt === 'vorposten' && c.vorpostenSystem === SYS && c.vorpostenId === 'vp-1' && c.tag === TAG, c);
    check('5b: und schickt KEIN targetTag mit (der Vorposten hat keine Allianz)', !!c && !c.targetTag, c && { targetTag: c.targetTag });
  } finally {
    await browser.close();
  }
  ende();
})();
