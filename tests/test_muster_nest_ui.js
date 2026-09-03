// Der koordinierte Angriff kann ein ALIEN-NEST treffen (Phase 5, Frontend).
//
//   node tests/test_muster_nest_ui.js
//
// GEPRUEFT WIRD:
//   1. Am Quelltext: Es gibt EINE Quelle fuer die Zielbezeichnung (`musterZielText`), und ALLE
//      Anzeigestellen fragen sie. Vorher lasen vier Stellen `doc.targetTag` direkt - bei einem
//      Nest ist der null, dort stuende also viermal "[null]" (Punkt 6 der Checkliste).
//   2. Im Browser: Steht ein Nest-Verbandsangriff, nennt die Box das VOLK und das System - und
//      nirgends "null". Das ist die Messung, die 1 erst belegt.
//   3. Im Browser, die Gegenrichtung: Ohne Nester im Galaxie-Zustand gibt es KEINE Zielart-Wahl.
//      Ein Server vor Phase 3/5 fuehrt `alienNester` nicht; eine Auswahl mit leerem Zweig waere
//      ein Versprechen ohne Gegenstand.
//   4. Mit Nestern erscheint die Wahl - und die Nest-Liste nennt Volk, Stufe, System und LP.
//   5. Am Quelltext: claim hat einen Nest-Zweig, der die Waehrungsfelder NICHT anfasst. Der
//      Server schickt sie bei einem Nest gar nicht; wer sie uebernaehme, schriebe `undefined` in
//      den Spielstand.
//
// GEGENPROBEN (in beide Richtungen ausfuehren, Hausregel 1):
//   * `musterZielText` durch `doc.targetTag` ersetzt -> 2a faellt ("null" steht in der Box).
//   * Die Zielart-Wahl bedingungslos zeichnen -> 3a faellt.
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = path.resolve(process.env.KEPLER_SPIELDATEI || SPIELDATEI);
const FILE = 'file://' + DATEI;
const JS = fs.readFileSync(DATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

const TAG = 'TST';
const NESTER = [
  { id: 'n1', volk: 'kryll', sys: 'rigel', stufe: 3, lp: 380000, lpMax: 400000 },
  { id: 'n2', volk: 'verglueht', sys: 'altair', stufe: 5, lp: 4000000, lpMax: 4400000 }
];
const MUSTERDOC = {
  id: 'muster1', zielArt: 'alien-nest', targetTag: null,
  nestId: 'n1', nestSystem: 'rigel', nestVolk: 'kryll', nestVolkName: 'Kryll-Schwarm',
  nestStufeName: 'Schwarmstock',
  createdBy: 'x', createdByName: 'Kommandantin', message: '',
  createdAt: Date.now() - 60000, museterEndsAt: Date.now() + 600000,
  phase: 'gathering', dispatch: null, result: null
};

const SAVE = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  seenTabHints: { basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
    galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1 },
  resources: { energie:9e5, erz:9e5, kristalle:9e5, deuterium:9e5, antimaterie:900, forschungspunkte:900 },
  buildings: { solar:20, mine:18, labor:10, lager:40, werft:12 }, research: {},
  fleet: { jaeger:40, cruisers:20, missions:[] }, colonies: {}, activeBasePlanet: 'home',
  player: { id:'u', name:'A', avatarKey:null, allianceTag:TAG, allianceRole:'admin' },
  xp: 5000, credits: 5000, buffs: [], lastTick: Date.now(), colonyNames: {},
  nextPlanetEventCheck: Date.now() + 3600000, nextTraderCheck: Date.now() + 3600000
});

function backend(store, galaxy) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, st) => r.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, supporter:{active:false,tier:null} });
    if (p === 'galaxy') return j(Object.assign({ npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[],
      collapsedSystems:{}, activeWormhole:null, news:[], controlledSystems:{}, factions:{} }, galaxy));
    if (p === 'storage-list') return j({ keys: Object.keys(store) });
    if (p.indexOf('storage/') === 0) {
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

async function messen(browser, galaxy, extraStore, waehleNest) {
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
  await page.route('**/api/**', backend(store, galaxy));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE);
  await page.waitForTimeout(2400);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
    const t = document.querySelector('[data-tab="allianz"]'); if (t) t.click();
  });
  await page.waitForTimeout(2600);
  /* Die Nest-Liste erscheint erst, wenn die Zielart wirklich gewaehlt ist - und gewaehlt wird sie
     ueber den SPIELERWEG (Auswahl setzen, change ausloesen), nicht durch einen Griff in den
     Modulscope. Ohne diesen Schritt haette 4b die Liste im Markup gesucht, wo sie zu Recht nicht
     steht, und waere aus dem falschen Grund rot gewesen. */
  if (waehleNest) {
    await page.evaluate(() => {
      const sel = document.querySelector('#allianceMusterBox #musterZielArtSelect');
      if (!sel) return;
      sel.value = 'alien-nest';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(1400);
  }
  const r = await page.evaluate(() => {
    const box = document.getElementById('allianceMusterBox');
    return {
      da: !!box,
      text: box ? (box.innerText || '') : '',
      html: box ? box.innerHTML : '',
      hatArtWahl: !!(box && box.querySelector('#musterZielArtSelect')),
      hatNestWahl: !!(box && box.querySelector('#musterNestSelect')),
      hatTagFeld: !!(box && box.querySelector('#musterTargetTagInput')),
      // GESCOPT auf das Auswahlfeld: "Königin" steht auch im Einleitungstext der Box, eine
      // Suche über das ganze Markup waere aus dem falschen Grund gruen (Hausregel 5/28).
      nestListe: (box && box.querySelector('#musterNestSelect')) ? box.querySelector('#musterNestSelect').innerHTML : ''
    };
  });
  r.bootfehler = fehler.slice(0, 2);
  await ctx.close();
  return r;
}

(async () => {
  // ---- 1) Die EINE Quelle am Quelltext ---------------------------------------------------------
  check('1a: es gibt eine gemeinsame Quelle fuer die Zielbezeichnung',
    /function musterZielText\(/.test(JS));
  const rufe = (JS.match(/musterZielText\(/g) || []).length;
  check('1b: mehrere Anzeigestellen fragen sie (Aufruf + Definition)', rufe >= 5, { aufrufe: rufe });
  /* Der Musterangriffs-Block wird gescopt gelesen: `doc.targetTag` steht auch im Backend-Kommentar
     und in anderen Allianz-Funktionen (Hausregel 39). */
  const von = JS.indexOf('function renderAllianceMusterBox(');
  const bis = JS.indexOf('function renderAllianceBuildingBox(');
  check('1c-anker: der Block der Musterangriffs-Box ist auffindbar', von > 0 && bis > von, { von, bis });
  const block = (von > 0 && bis > von) ? JS.slice(von, bis) : '';
  check('1d: in der Box wird targetTag nicht mehr roh in die Ueberschrift geschrieben',
    !/gegen \[\$\{escapeHtml\(doc\.targetTag\)\}\]/.test(block),
    { hinweis: 'bei einem Nest ist targetTag null - dort stuende "[null]"' });

  // ---- 5) claim: der Nest-Zweig fasst die Waehrung nicht an -------------------------------------
  const cvon = JS.indexOf('async function claimMusterAttackOutcome(');
  const cbis = JS.indexOf('async function refreshAllianceMusterAttack(');
  check('5a-anker: der claim-Block ist auffindbar', cvon > 0 && cbis > cvon);
  const cblock = (cvon > 0 && cbis > cvon) ? JS.slice(cvon, cbis) : '';
  /* Seit dem Verband gegen Festungen (01.09.2026) deckt der Zweig alle Ziele ohne Allianz ab -
     `if (data.nest || data.festung || data.vorposten){`. Gesucht wird der Kopf, der als ERSTES
     `data.nest` prueft; ein Zweig, der das Nest nicht mehr kennt, waere hier zu Recht rot.
     Die Zahl der weiteren Glieder ist offen, damit ein viertes Ziel diesen Test nicht bricht. */
  const zweigKopf = (cblock.match(/if \(data\.nest(?: \|\| data\.\w+)*\)\{/) || [''])[0];
  // Ohne gefundenen Kopf gibt es KEINE Scheibe - sonst begaenne sie bei 0 und 5c waere stumm.
  const nestZweig = zweigKopf ? cblock.slice(cblock.indexOf(zweigKopf), cblock.indexOf('const lostParts')) : '';
  check('5b: es gibt einen Nest-Zweig', !!zweigKopf && cblock.indexOf(zweigKopf) > 0, { kopf: zweigKopf || '(keiner)' });
  check('5c: und er fasst die Waehrungsfelder NICHT an',
    !!nestZweig && !/state\.credits\s*=/.test(nestZweig) && !/newForschungspunkte/.test(nestZweig),
    { hinweis: 'der Server schickt sie bei einem Nest nicht - uebernommen waere das undefined im Spielstand' });

  const browser = await starteBrowser();
  try {
    // ---- 2) Die Box nennt Volk und System, nicht "null" -----------------------------------------
    const mit = await messen(browser, { alienNester: NESTER },
      { ['alliance:' + TAG + ':musterattack']: JSON.stringify(MUSTERDOC) });
    check('2a-vorab: die Musterangriffs-Box ist da und der Start ist fehlerfrei',
      mit.da && mit.bootfehler.length === 0, { da: mit.da, bootfehler: mit.bootfehler });
    check('2a: die Box nennt Volk und System des Nestes - und nirgends "null"',
      /Kryll-Schwarm/.test(mit.text) && /rigel/i.test(mit.text) && !/\[null\]|\bnull\b/.test(mit.text),
      { text: mit.text.slice(0, 240) });

    // ---- 3) Ohne Nester keine Zielart-Wahl ------------------------------------------------------
    const ohne = await messen(browser, {}, {});
    check('3a-vorab: ohne laufenden Angriff steht das Planungsformular da',
      ohne.da && ohne.hatTagFeld, { da: ohne.da, tagFeld: ohne.hatTagFeld, text: ohne.text.slice(0, 160) });
    check('3a: ohne Nester gibt es KEINE Zielart-Wahl',
      !ohne.hatArtWahl && !ohne.hatNestWahl,
      { artWahl: ohne.hatArtWahl, nestWahl: ohne.hatNestWahl,
        hinweis: 'ein Server vor Phase 3/5 fuehrt alienNester nicht - eine leere Wahl waere ein Versprechen ohne Gegenstand' });

    // ---- 4) Mit Nestern erscheint sie ------------------------------------------------------------
    const frei = await messen(browser, { alienNester: NESTER }, {});
    check('4a: mit Nestern steht die Zielart-Wahl da', frei.hatArtWahl,
      { artWahl: frei.hatArtWahl, text: frei.text.slice(0, 200) });
    check('4a2: solange "Fremde Allianz" gewaehlt ist, steht weiterhin das Tag-Feld da',
      frei.hatTagFeld && !frei.hatNestWahl, { tagFeld: frei.hatTagFeld, nestWahl: frei.hatNestWahl });

    const gewaehlt = await messen(browser, { alienNester: NESTER }, {}, true);
    check('4b-vorab: nach der Wahl steht das Nest-Auswahlfeld statt des Tag-Feldes',
      gewaehlt.hatNestWahl && !gewaehlt.hatTagFeld,
      { nestWahl: gewaehlt.hatNestWahl, tagFeld: gewaehlt.hatTagFeld });
    const L = gewaehlt.nestListe;
    check('4b: und die Liste fuehrt beide Nester mit Volk, Stufe, System und LP',
      /Kryll-Schwarm/.test(L) && /Schwarmstock/.test(L) && /Verglühten/.test(L) &&
      /Königin/.test(L) && /rigel/.test(L) && /altair/.test(L) && /LP/.test(L),
      { liste: L.slice(0, 260) });
  } finally {
    await browser.close();
  }
  ende();
})();
