// PvP auf alle Standorte, Frontend-Etappe 1: die Zielwahl (01.09.2026).
//
//   node tests/test_pvp_standorte.js
//
// Auftrag Sascha: „man kann nur hauptlanet von spielern angreifen keine kolonien es sollen alle
// von spielern kolonisierten planeten angreifbar sein mehr pvp aktion!"
//
// Gemessen wird am GERENDERTEN Spiel, nicht am Quelltext - eine Zielwahl, die niemand anklicken
// kann, ist keine.
//
// GEPRUEFT WIRD:
//   1. PARITAET der Kopie-Familie STANDORT_BEUTE_FAKTOR gegen server.js - ausgefuehrt, nicht
//      gegreppt. Dazu der Honeypot: ladeZielStandorte wird geschnitten und AUSGEFUEHRT, weil die
//      Verfaelschung beim Laden passiert und ob ein Spaeher entdeckt wird das Spiel wuerfelt.
//   2. OHNE Aufklaerung gibt es keine Wahl, sondern den Weg dorthin.
//   3. MIT Aufklaerung erscheint je Standort ein Knopf - und die Wahl WIRKT: zwei Standorte
//      muessen verschiedene Zahlen zeigen. Eine Pruefung auf „das Wort Kolonie steht da" waere
//      auch bei kaputter Rechnung gruen.
//   4. Das Ziel reist in der MISSION mit UND landet im REQUEST - und ohne Wahl bleibt das Feld
//      weg, damit der Server byte-gleich seinen Altpfad laeuft.
//   5. ZIELBINDUNG: Eine bei Spieler A getroffene Wahl darf bei Spieler B nicht weiterwirken.
//      Kolonieschluessel sind globale Planeten-IDs - Ben fuehrt deshalb DENSELBEN Mond wie Anna,
//      sonst finge schon die Listenpruefung ab und die Bindung waere gar nicht die Schranke.
//   6. Der Honeypot wirkt auch auf die angezeigten Standortzahlen.
//   7. Der Bericht nennt den Standort - mit dem FREMDEN Namen, nicht mit dem eigenen
//      Kolonienamen desselben Planeten.
//
// GEGENPROBEN (beidseitig gefahren, jede mit einer Liste der Pruefungen, die fallen MUESSEN):
//   * Stand vor der Etappe (KEPLER_SPIELDATEI auf origin/main): 24 von 47 fallen.
//   * Zielbindung KOMPLETT entfernt (beide Schranken - Ruecksetzen beim Oeffnen UND Bindung in
//     pvpZielFuerTarget): 5a faellt. Nur eine von beiden zu entfernen genuegt nicht, die andere
//     faengt ab - das hat die erste Fassung dieser Gegenprobe als WERKZEUGFEHLER gemeldet.
//   * ladeZielStandorte ohne den Honigfaktor: 1f faellt.
//   * planetDisplayName statt fremdStandortName in standortBerichtszeile: 7b faellt.
//   * targetPlanet nicht in den Request: 4e faellt. (4a-4d messen die MISSION und blieben gruen -
//     genau daran ist die Luecke aufgefallen.)
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, SERVER_JS, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ================================================== 1. Paritaet der Kopie-Familie (ausgefuehrt)
// Der Erwartungswert kommt aus dem BACKEND, nicht aus derselben Quelle wie der Messgegenstand -
// sonst koennte die Pruefung gar nicht fehlschlagen.
(function paritaet(){
  let fe = null, be = null, aufbauFehler = null;
  try {
    const m = JS.match(/const STANDORT_BEUTE_FAKTOR = (\{[^}]*\});/);
    if (m) fe = new Function('return ' + m[1])();
  } catch(e){ aufbauFehler = 'Frontend: ' + e.message; }
  try {
    const srv = fs.existsSync(SERVER_JS) ? fs.readFileSync(SERVER_JS, 'utf8') : null;
    if (srv){
      const m = srv.match(/const STANDORT_BEUTE_FAKTOR = (\{[^}]*\});/);
      if (m) be = new Function('return ' + m[1])();
    }
  } catch(e){ aufbauFehler = (aufbauFehler||'') + ' Backend: ' + e.message; }

  check('1-bau: beide Tabellen liessen sich ausfuehren', !aufbauFehler, aufbauFehler || undefined);
  check('1a: das Frontend fuehrt STANDORT_BEUTE_FAKTOR', !!fe, fe || undefined);
  if (!be){
    // Kein Fehlschlag, aber es wird GESAGT - ein still uebersprungener Vergleich sieht aus wie ein
    // bestandener.
    console.log('WARNUNG - server.js nicht lesbar, die Paritaetspruefung 1b/1c wurde UEBERSPRUNGEN');
  } else {
    check('1b: dieselben Standortarten auf beiden Seiten',
      JSON.stringify(Object.keys(fe||{}).sort()) === JSON.stringify(Object.keys(be).sort()),
      { frontend: Object.keys(fe||{}), backend: Object.keys(be) });
    const abw = Object.keys(be).filter(k => (fe||{})[k] !== be[k]);
    check('1c: dieselben Faktoren auf beiden Seiten', abw.length === 0,
      abw.length ? abw.map(k => k+': FE '+(fe||{})[k]+' vs BE '+be[k]) : undefined);
  }
  let feArt = null;
  try {
    const m = JS.match(/function standortArtVon\(key\)\{[\s\S]*?\n  \}/);
    if (m) feArt = new Function('return ' + m[0])();
  } catch(e){}
  check('1d: standortArtVon ordnet Heimat, Kolonie und Mond richtig ein',
    !!feArt && feArt('home') === 'heimat' && feArt('vesna') === 'kolonie' && feArt('moon_vesna') === 'mond',
    feArt ? { home: feArt('home'), vesna: feArt('vesna'), moon: feArt('moon_vesna') } : 'nicht ausfuehrbar');
})();

// ================================================== 1e-1g. Der Honeypot, AUSGEFUEHRT
/* Die Verfaelschung passiert beim LADEN, nicht beim Anzeigen - eine Messung am gerenderten Spiel
   kaeme nur ueber eine echte Spionagemission dorthin, und ob der Spaeher dabei entdeckt wird,
   wuerfelt das Spiel (bis 60 %). Der Block wird deshalb geschnitten und mit einem Mini-Fixture
   ausgefuehrt. Die erste Fassung dieser Pruefung legte die Standorte fertig verfaelscht in die
   Fixture - damit lief ladeZielStandorte nie, und eine Kopie ohne den Faktor blieb gruen. */
const honeypotFertig = (function(){
  let fn = null, aufbauFehler = null;
  try {
    const m = JS.match(/  async function ladeZielStandorte\(targetId, honig\)\{[\s\S]*?\n  \}/);
    if (!m) throw new Error('ladeZielStandorte nicht gefunden');
    const quelle = 'return (' + m[0].trim().replace(/^async function ladeZielStandorte/, 'async function') + ')';
    fn = new Function('useBackend','backendFetch','standortArtVon','STANDORT_BEUTE_FAKTOR', quelle)(
      () => true,
      async () => ({ ok:true, json: async () => ({ standorte: [
        { key:'home', art:'heimat', verteidigung: 100000, beuteFaktor: 1.0 },
        { key:'vesna', art:'kolonie', verteidigung: 4000, beuteFaktor: 0.5 }
      ] }) }),
      k => (!k || k === 'home') ? 'heimat' : (String(k).startsWith('moon_') ? 'mond' : 'kolonie'),
      { heimat:1.0, kolonie:0.5, mond:0.35 }
    );
  } catch(e){ aufbauFehler = String(e).slice(0,200); }
  check('1e-bau: ladeZielStandorte liess sich schneiden und ausfuehren', !!fn, aufbauFehler || undefined);
  if (!fn) return Promise.resolve();
  // Die Signatur ist (targetId, honig) - der Faktor ist das ZWEITE Argument.
  return fn('u-x', 1).then(ehrlich => fn('u-x', 2).then(verfaelscht => {
    check('1e: ohne Entdeckung stehen die ECHTEN Serverzahlen da',
      !!ehrlich && ehrlich[0].verteidigung === 100000 && ehrlich[1].verteidigung === 4000,
      ehrlich && ehrlich.map(x => x.verteidigung));
    check('1f: mit entdecktem Spaeher sind sie mit DEMSELBEN Faktor aufgeblaeht',
      !!verfaelscht && verfaelscht[0].verteidigung === 200000 && verfaelscht[1].verteidigung === 8000,
      verfaelscht && verfaelscht.map(x => x.verteidigung));
    check('1g: der Beutefaktor bleibt unangetastet - er ist keine Aufklaerungszahl',
      !!verfaelscht && verfaelscht[1].beuteFaktor === 0.5, verfaelscht && verfaelscht[1].beuteFaktor);
  }));
})();

// ================================================== Browser-Teil
const SAVE_KEY = 'kepler7-save-v3';
const ZIEL_A = 'u-anna', ZIEL_B = 'u-ben';

// Zwei Standorte mit ABSICHTLICH weit auseinanderliegender Verteidigung: Nur so kann Abschnitt 3
// belegen, dass die Wahl wirkt, statt nur, dass Knoepfe dastehen.
const STANDORTE_A = [
  { key:'home',       art:'heimat',  verteidigung: 900000, beuteFaktor: 1.0 },
  { key:'vesna',      art:'kolonie', verteidigung:   4000, beuteFaktor: 0.5 },
  { key:'moon_vesna', art:'mond',    verteidigung:    900, beuteFaktor: 0.35 }
];
/* Ben fuehrt DENSELBEN Mond wie Anna. Das ist der Kern von Abschnitt 5: Kolonieschluessel sind
   global, zwei Spieler koennen auf demselben Planeten siedeln. Haette Ben den Mond nicht, finge
   schon die Listenpruefung die fremde Wahl ab - und die Spielerbindung waere gar nicht die
   wirksame Schranke. */
const STANDORTE_B = [
  { key:'home',       art:'heimat', verteidigung: 5000, beuteFaktor: 1.0 },
  { key:'moon_vesna', art:'mond',   verteidigung: 1200, beuteFaktor: 0.35 }
];
const SPY_BERICHTE = [
  { id:'r-a', type:'spy-report', time: Date.now()-60000, targetId: ZIEL_A, targetName:'Anna',
    ships:{ cruisers: 5 }, score: 1000, defensePower: 900000, deep:true, resTotal: 400000, colonyCount: 2 },
  { id:'r-b', type:'spy-report', time: Date.now()-60000, targetId: ZIEL_B, targetName:'Ben',
    ships:{ cruisers: 3 }, score: 900, defensePower: 5000, deep:false, colonyCount: 0 }
];

function backend(store, opt){
  opt = opt || {};
  return async r => {
    const req = r.request(); const url = req.url();
    const p = url.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u-ich', username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'spieler-standorte'){
      const t = decodeURIComponent((url.split('target=')[1]||'').split('&')[0]);
      if (opt.standorteFehlen) return j({ e:1 }, 404);
      return j({ standorte: t === ZIEL_B ? STANDORTE_B : STANDORTE_A });
    }
    if (p === 'attack'){
      let body = {}; try { body = JSON.parse(req.postData()||'{}'); } catch(e){}
      (store.__angriffe = store.__angriffe || []).push(body);
      return j({ ok:true, win:true, stolen:{ erz: 1000 }, attackPower: 5000, defensePower: 4000,
                 battlePoints: 25, newBattlePoints: 25,
                 ...(body.targetPlanet ? { targetPlanet: body.targetPlanet, standortArt: body.targetPlanet==='home'?'heimat':(String(body.targetPlanet).startsWith('moon_')?'mond':'kolonie'), beuteFaktor: 0.5 } : {}) });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'reports'){
      if (req.method() === 'POST'){ try { (store.__berichte = store.__berichte||[]).unshift(JSON.parse(req.postData()||'{}').report||{}); } catch(e){} return j({ ok:true }); }
      return j({ reports: store.__berichte || [] });
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

async function tab(browser, startSave, opt){
  // Die Berichte liefert der SERVER (GET /api/reports) - sie im Spielstand abzulegen genuegt
  // nicht, und genau daran ist der erste Anlauf gescheitert: Ohne den Spionagebericht gibt es
  // keinen „Direkt Angriff"-Knopf und damit keinen Spielerweg ins Angriffs-Feld.
  const store = { __berichte: ((opt && opt.berichte) || []).concat(JSON.parse(JSON.stringify(SPY_BERICHTE))) };
  if (startSave) store[SAVE_KEY] = startSave;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store, opt));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','eventBanner']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}

/* Der Spielerweg ins Angriffs-Overlay: „Direkt Angriff" im Spionagebericht markiert das Ziel und
   springt auf den Galaxie-Reiter, dort wird die Angriffsflotte zusammengestellt, dann „Spieler
   angreifen". Bewusst ueber echte Klicks - Modulvariablen sind von aussen nicht erreichbar, und
   ein nachgebauter Weg misst nicht das Spiel. */
async function oeffneAngriff(page, zielId){
  const markiert = await page.evaluate(id => {
    const b = document.querySelector('[data-goto-attack="'+id+'"]');
    if (!b) return false; b.click(); return true;
  }, zielId);
  if (!markiert) return { ok:false, grund:'kein [data-goto-attack='+zielId+']' };
  await page.waitForTimeout(800);
  /* Der Selektor MUSS auf die Box gescopt sein: Dieselben data-atksel-Knoepfe gibt es ein zweites
     Mal im Flottenwahl-Overlay, und ein ungescopter Treffer aendert zwar denselben Zustand, misst
     danach aber die falsche Flaeche. */
  await page.evaluate(() => {
    const box = document.getElementById('attackFleetBox') || document;
    box.querySelectorAll('[data-atksel-max]').forEach(b => b.click());
  });
  await page.waitForTimeout(500);
  const zustand = await page.evaluate(() => {
    const b = document.getElementById('pendingAttackBtn');
    return { da: !!b, disabled: b ? b.disabled : null, boxText: (document.getElementById('pendingAttackBox')||{innerText:''}).innerText.slice(0,160) };
  });
  if (!zustand.da || zustand.disabled) return { ok:false, grund:'pendingAttackBtn', zustand };
  await page.evaluate(() => document.getElementById('pendingAttackBtn').click());
  await page.waitForTimeout(600);
  const offen = await page.evaluate(() => {
    const ov = document.getElementById('fwahlOverlay');
    return !!(ov && ov.classList.contains('open'));
  });
  return { ok: offen, grund: offen ? null : 'Overlay blieb zu', zustand };
}
const overlayText = page => page.evaluate(() => {
  const ov = document.getElementById('fwahlOverlay');
  return (ov && ov.classList.contains('open')) ? ov.innerText : '';
});
const zielKnoepfe = page => page.evaluate(() => Array.from(
  document.querySelectorAll('#fwahlOverlay [data-pvp-ziel]')).map(b => ({ key: b.getAttribute('data-pvp-ziel'), text: b.innerText.trim() })));

(async () => {
  await honeypotFertig;
  const browser = await starteBrowser();
  const roh = await tab(browser);
  const basis = roh.stand();
  await roh.ctx.close();
  check('2-bau: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis||{}).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  function fixture(o){
    o = o || {};
    const st = JSON.parse(JSON.stringify(basis));
    /* 400 Kreuzer = 8.000 Angriffskraft. Bewusst so viel: Mit 40 Kreuzern (800) liegt die
       Siegchance gegen Heimat UND Kolonie am unteren Anschlag von 10 %, und der Test maesse den
       Deckel statt der Wirkung. Die Jaeger bleiben drin, obwohl sie ohne Traeger nicht fliegen -
       so faellt auf, wenn die Vorschau sie faelschlich mitzaehlt. */
    st.fleet.cruisers = 400; st.fleet.jaeger = 30; st.fleet.frachter = 12;
    st.resources = st.resources || {};
    for (const k of ['erz','kristalle','deuterium','antimaterie']) st.resources[k] = 5e6;
    // Ereignis-Uhren pinnen - sonst schiebt eine Meldungssalve die Messung.
    const fern = Date.now() + 365*24*3600*1000;
    st.nextPlanetEventCheck = fern; st.nextTraderCheck = fern;
    st.seenTabHints = ['basis','flotte','karte','galaxie','fortschritt','berichte','forschung','verteidigung','allianz','markt','abgrund','einstellungen'];
    if (o.aufklaerung){
      const honig = o.honig || 1;
      st.spyIntel = {};
      st.spyIntel[ZIEL_A] = { entry:{ cruisers:5, defensePower: Math.round(900000*honig), score:1000 },
                              capturedAt: Date.now()-60000, deep:true, detected: honig !== 1, honig,
                              standorte: STANDORTE_A.map(x => ({ ...x, verteidigung: Math.round(x.verteidigung*honig) })) };
      st.spyIntel[ZIEL_B] = { entry:{ cruisers:3, defensePower:5000, score:900 }, capturedAt: Date.now()-60000,
                              deep:false, detected:false, honig:1, standorte: JSON.parse(JSON.stringify(STANDORTE_B)) };
    }
    if (o.eigeneKolonieVesna){
      // Ich selbst siedle auf Vesna und habe die Kolonie umbenannt. Genau hier faellt auf, wenn
      // eine Anzeigestelle planetDisplayName benutzt, wo sie fremdStandortName braeuchte.
      st.colonies = st.colonies || {};
      st.colonies.vesna = st.colonies.vesna || { buildings:{}, fleet:{} };
      st.colonyNames = st.colonyNames || {};
      st.colonyNames.vesna = 'MEIN ERZHAFEN';
    }
    return JSON.stringify(st);
  }

  // ---------------------------------------------- 2. Ohne Aufklaerung: keine Wahl, aber der Weg
  {
    const t = await tab(browser, fixture({ aufklaerung:false }));
    const auf = await oeffneAngriff(t.page, ZIEL_A);
    check('2a: das Angriffs-Feld laesst sich ueber den Spielerweg oeffnen', auf.ok, auf.ok ? undefined : auf);
    const txt = await overlayText(t.page);
    const knoepfe = await zielKnoepfe(t.page);
    check('2b: ohne Aufklaerung gibt es KEINE Zielknoepfe', knoepfe.length === 0, knoepfe);
    check('2c: stattdessen steht dort der Weg dorthin', /spähe .* aus/i.test(txt), { auszug: txt.slice(0, 400) });
    check('2d: keine Seitenfehler', t.errs.length === 0, t.errs.slice(0,2));
    await t.ctx.close();
  }

  // ---------------------------------------------- 3. Mit Aufklaerung: Wahl da UND wirksam
  {
    const t = await tab(browser, fixture({ aufklaerung:true }));
    const g3 = await oeffneAngriff(t.page, ZIEL_A);
    check('3-bau: das Angriffs-Feld ist offen', g3.ok, g3.ok?undefined:g3);
    const knoepfe = await zielKnoepfe(t.page);
    check('3a: je bekanntem Standort ein Knopf', knoepfe.length === STANDORTE_A.length, knoepfe);
    check('3b: die Knoepfe tragen die Standort-Schluessel',
      STANDORTE_A.every(s => knoepfe.some(k => k.key === s.key)), knoepfe.map(k=>k.key));
    check('3c: der Mond ist als solcher benannt, nicht als roher Schluessel',
      knoepfe.some(k => k.key === 'moon_vesna' && /Mond von/i.test(k.text)), knoepfe.find(k=>k.key==='moon_vesna'));

    const werte = {};
    for (const key of ['home','vesna','moon_vesna']){
      await t.page.evaluate(k => { const b = document.querySelector('#fwahlOverlay [data-pvp-ziel="'+k+'"]'); if (b) b.click(); }, key);
      await t.page.waitForTimeout(250);
      const txt = await overlayText(t.page);
      const ch = txt.match(/Siegchance gegen [^:]+:\s*~?(\d+)%/);
      const bf = txt.match(/Beute:\s*×([\d.,]+)/);
      werte[key] = { chance: ch ? Number(ch[1]) : null, beute: bf ? bf[1] : null, txt };
    }
    check('3d: jeder Standort liefert eine Siegchance',
      ['home','vesna','moon_vesna'].every(k => werte[k].chance !== null),
      Object.fromEntries(Object.entries(werte).map(([k,v])=>[k,v.chance])));
    check('3e: die Siegchance UNTERSCHEIDET sich je Standort (die Wahl wirkt)',
      werte.home.chance !== werte.vesna.chance, { home: werte.home.chance, vesna: werte.vesna.chance });
    check('3f: die schwaechere Kolonie ist die bessere Chance',
      werte.vesna.chance > werte.home.chance, { home: werte.home.chance, vesna: werte.vesna.chance });
    check('3g: der Beutefaktor unterscheidet sich ebenfalls',
      werte.home.beute !== werte.vesna.beute, { home: werte.home.beute, vesna: werte.vesna.beute });
    check('3h: die Vorschau sagt, dass die Flugzeit am Spieler haengt, nicht am Standort',
      /Entfernung hängt am Spieler/i.test(werte.home.txt));
    check('3i: keine Seitenfehler', t.errs.length === 0, t.errs.slice(0,2));
    await t.ctx.close();
  }

  // ---------------------------------------------- 4. Die Mission traegt das Ziel
  {
    const t = await tab(browser, fixture({ aufklaerung:true }));
    await oeffneAngriff(t.page, ZIEL_A);
    await t.page.evaluate(() => { const b = document.querySelector('#fwahlOverlay [data-pvp-ziel="moon_vesna"]'); if (b) b.click(); });
    await t.page.waitForTimeout(250);
    await t.page.evaluate(() => { const b = document.querySelector('#fwahlOverlay [data-fwahl-start]'); if (b) b.click(); });
    await t.page.waitForTimeout(900);
    // Der Spielstand kommt aus dem Server-Store, nicht aus localStorage.
    const miss = (t.stand().fleet && t.stand().fleet.missions || []).filter(m => m.type === 'attack-player');
    check('4a: die Mission traegt den gewaehlten Standort',
      miss.length === 1 && miss[0].targetPlanet === 'moon_vesna', miss.map(m=>({t:m.targetPlanet, a:m.standortArt})));
    check('4b: sie traegt den Standortnamen als TEXT mit (der Schluessel allein reicht nicht)',
      miss.length === 1 && /Mond von/i.test(miss[0].standortName||''), miss[0] && miss[0].standortName);
    check('4c: und die Standortart', miss.length === 1 && miss[0].standortArt === 'mond', miss[0] && miss[0].standortArt);
    await t.ctx.close();
  }
  {
    const t = await tab(browser, fixture({ aufklaerung:false }));
    await oeffneAngriff(t.page, ZIEL_A);
    await t.page.evaluate(() => { const b = document.querySelector('#fwahlOverlay [data-fwahl-start]'); if (b) b.click(); });
    await t.page.waitForTimeout(900);
    const miss = (t.stand().fleet && t.stand().fleet.missions || []).filter(m => m.type === 'attack-player');
    /* Bis zum 02.09.2026 stand hier "ohne Zielwahl traegt die Mission KEIN Standortfeld - der
       Server laeuft seinen Altpfad". Diese Pruefung war GRUEN und hat trotzdem einen Fehler
       zementiert: Der Altpfad rechnet computeDefensePower, also die SUMME ueber alle Standorte -
       waehrend die Vorschau daneben die Heimat-Verteidigung aus /api/spieler-standorte zeigte
       (standortVerteidigung('home'), nur Heimat). Fuer einen Verteidiger MIT Kolonien waren das
       zwei verschiedene Zahlen, und die angezeigte Siegchance war zu optimistisch.
       Geprueft wird jetzt die RICHTIGE Eigenschaft: Auch ohne eigene Wahl reist 'home' mit, damit
       der Server dieselbe Funktion rechnet, aus der die Vorschau ihre Zahl bezieht. Der Altpfad
       bleibt fuer Altmissionen erreichbar - das misst 4f am Missionsobjekt ohne targetPlanet. */
    check('4d: ohne eigene Wahl reist der Standort home mit (Vorschau und Kampf rechnen dieselbe Verteidigung)',
      miss.length === 1 && miss[0].targetPlanet === 'home' && miss[0].standortArt === 'heimat',
      miss.map(m=>({ standort:m.targetPlanet, art:m.standortArt })));
    await t.ctx.close();
  }

  // ------------------------------------- 4e/4f. Der REQUEST - die Zeile, an der alles haengt
  /* Fehlt targetPlanet im Request, laeuft im Backend byte-gleich der alte Konto-Kampf: Die
     Zielwahl waere eine Oberflaeche ohne Wirkung. 4a-4d messen die MISSION, und die traegt den
     Standort auch dann, wenn er den Server nie erreicht - genau darauf ist die Gegenprobe
     „targetPlanet nicht in den Request" aufgelaufen und hat den blinden Fleck gemeldet.
     Gemessen ohne Klickweg: Eine fertige, FAELLIGE Mission steht im Startstand, der erste Tick
     loest sie auf, und der Mock schreibt den Request-Rumpf mit. */
  /* Der dritte Fall ist seit dem 02.09.2026 der wichtigste: 'home'. Bis dahin liess der Request
     das Feld dort weg und der Server rechnete die Konto-Summe, waehrend die Vorschau die
     Heimat-Verteidigung zeigte. Der Fall 'Altmission' bleibt daneben stehen und misst etwas
     anderes: ein Missionsobjekt OHNE targetPlanet - so sehen Missionen aus, die beim Update schon
     flogen. Sie sollen weiterhin kein Feld schicken und genau das Ergebnis bekommen, mit dem sie
     losgeschickt wurden. */
  for (const [id, name, standort, erwartet] of [
        ['4e', 'Mond gewaehlt', 'moon_vesna', 'moon_vesna'],
        ['4f', 'Altmission ohne Standortfeld', null, undefined],
        ['4g', 'Heimat gewaehlt', 'home', 'home']]){
    /* ZWEI KETTENGLIEDER, ZWEI WAECHTER - gemessen, nicht angenommen: Dieser Block spielt eine
       FERTIG GEBAUTE Mission ein und misst deshalb nur das zweite Glied (Missionsobjekt ->
       Request). Bei einer Sabotage von sendPlayerAttackMission (erstes Glied, Klick -> Mission)
       bleibt 4g gruen - das ist richtig so und kein blinder Fleck: Das erste Glied haelt 4d fest
       (gemessen am 02.09.2026: unter genau dieser Sabotage fallen 4d und 5a, 4g nicht). Wer eines
       der beiden Glieder bricht, bekommt also einen roten Test - aber nicht denselben. */
    const st = JSON.parse(fixture({ aufklaerung:true }));
    st.fleet.missions = [{
      id: 999, type:'attack-player', targetId: ZIEL_A, targetName:'Anna',
      startTime: Date.now()-600000, endTime: Date.now()-2000,
      fleetName:'Testverband', composition:{ cruisers: 400 }, cargoCapacity: 6000,
      ...(standort ? { targetPlanet: standort,
                       standortArt: standort === 'home' ? 'heimat' : 'mond',
                       standortName: standort === 'home' ? 'Heimatbasis' : 'Mond von Vesna' } : {})
    }];
    const t = await tab(browser, JSON.stringify(st));
    await t.page.waitForTimeout(2500);
    const a = t.store.__angriffe || [];
    check(id+'-bau ('+name+'): der Angriff wurde beim Server abgesetzt', a.length >= 1, a);
    check(id+' ('+name+'): der Request traegt '+(standort ? 'den Standort '+standort : 'KEIN Standortfeld'),
      a.length >= 1 && a[0].targetPlanet === erwartet, a[0]);
    check(id+'2 ('+name+'): die Ziel-ID steht in jedem Fall drin',
      a.length >= 1 && a[0].targetUserId === ZIEL_A, a[0]);
    await t.ctx.close();
  }

  // ---------------------------------------------- 5. Zielbindung: A-Wahl wirkt nicht bei B
  {
    const t = await tab(browser, fixture({ aufklaerung:true }));
    await oeffneAngriff(t.page, ZIEL_A);
    await t.page.evaluate(() => { const b = document.querySelector('#fwahlOverlay [data-pvp-ziel="moon_vesna"]'); if (b) b.click(); });
    await t.page.waitForTimeout(250);
    const gewaehltA = await t.page.evaluate(() => {
      const b = document.querySelector('#fwahlOverlay [data-pvp-ziel="moon_vesna"]');
      return !!(b && b.classList.contains('primary'));
    });
    check('5-vorab: bei Anna ist der Mond wirklich gewaehlt', gewaehltA);
    check('5-vorab2: Ben fuehrt denselben Standort wie Anna (sonst misst 5a die Listenpruefung)',
      STANDORTE_B.some(x => x.key === 'moon_vesna'), STANDORTE_B.map(x=>x.key));
    await t.page.evaluate(() => { const b = document.querySelector('#fwahlOverlay [data-fwahl-zu]'); if (b) b.click(); });
    await t.page.waitForTimeout(300);
    await oeffneAngriff(t.page, ZIEL_B);
    await t.page.evaluate(() => { const b = document.querySelector('#fwahlOverlay [data-fwahl-start]'); if (b) b.click(); });
    await t.page.waitForTimeout(900);
    const miss = (t.stand().fleet && t.stand().fleet.missions || []).filter(m => m.type === 'attack-player');
    /* Die gepruefte Eigenschaft ist unveraendert - Annas Wahl darf Ben nicht erreichen. Gemessen
       wird sie seit dem 02.09.2026 SCHAERFER: nicht mehr "kein Standort" (das waere jetzt auch bei
       einem kaputten Rueckfall wahr), sondern GENAU der Vorgabewert 'home'. Annas Wahl war
       'moon_vesna', und Ben fuehrt denselben Schluessel (5-vorab2) - ein Durchschlagen waere also
       sichtbar und wird nicht von der Listenpruefung abgefangen. */
    check('5a: die bei Anna getroffene Wahl wirkt bei Ben NICHT weiter',
      miss.length === 1 && miss[0].targetId === ZIEL_B && miss[0].targetPlanet === 'home',
      miss.map(m=>({ ziel:m.targetId, standort:m.targetPlanet })));
    await t.ctx.close();
  }

  // ---------------------------------------------- 6. Honeypot in der Anzeige
  {
    const t = await tab(browser, fixture({ aufklaerung:true, honig:2 }));
    const g6 = await oeffneAngriff(t.page, ZIEL_A);
    check('6-bau: das Angriffs-Feld ist offen', g6.ok, g6.ok?undefined:g6);
    const knoepfe = await zielKnoepfe(t.page);
    const vesna = knoepfe.find(k => k.key === 'vesna');
    check('6-vorab: der Kolonie-Knopf ist da', !!vesna, knoepfe);
    check('6a: die Standortzahl ist mit dem Honeypot-Faktor aufgeblaeht (8.000 statt 4.000)',
      !!vesna && /8[.,]?0/.test(vesna.text.replace(/\s/g,'')), vesna && vesna.text);
    const txt = await overlayText(t.page);
    check('6b: und der Spieler wird gewarnt, dass sein Spaeher entdeckt wurde',
      /entdeckt/i.test(txt), { auszug: txt.slice(0,300) });
    await t.ctx.close();
  }

  // ---------------------------------------------- 7. Der Bericht nennt den FREMDEN Standortnamen
  /* Gemessen wird die ZEICHNER-Stelle, nicht die Kampfaufloesung (die steht in Abschnitt 4). Der
     Bericht wird fertig eingespielt, so wie ihn resolvePlayerAttackMission schreibt - das haengt
     nicht davon ab, ob ein simulierter Kampf zufaellig gewinnt.
     Der Punkt ist die NAMENSAUFLOESUNG: Der Angreifer siedelt selbst auf Vesna und hat seine
     Kolonie „MEIN ERZHAFEN" genannt. planetDisplayName wuerde diesen Namen ueber die FREMDE
     Kolonie desselben Planeten legen. */
  {
    const ANGRIFFSBERICHT = {
      id:'r-angriff', type:'player-attack', result:'win', time: Date.now()-1000,
      targetName:'Anna', targetId: ZIEL_A,
      targetPlanet:'vesna', standortArt:'kolonie', standortName:'Vesna', beuteFaktor:0.5,
      attackPower: 8000, defensePower: 4000, loot:{ erz: 1000 },
      cargoCapacity: 6000, fromPlanet:'Heimatbasis', fleet:{ cruisers: 400 }
    };
    const t = await tab(browser, fixture({ aufklaerung:true, eigeneKolonieVesna:true }), { berichte:[ANGRIFFSBERICHT] });
    let bericht = '', aufbauFehler = null;
    try {
      await t.page.waitForTimeout(1200);
      bericht = await t.page.evaluate(() => {
        // Die ganze KARTE greifen, nicht nur die Titelzeile: Der kleinste Treffer waere die
        // Ueberschrift, und die traegt den Standort per Bauart nicht - er steht im Rumpf.
        const titel = Array.from(document.querySelectorAll('*'))
          .filter(e => /Angriff auf Spieler Anna/i.test(e.textContent||'') && e.children.length === 0)[0];
        if (!titel) return '';
        const karte = titel.closest('.card-row') || titel.closest('[class*=report]') || titel.parentElement.parentElement;
        return karte ? karte.innerText : titel.innerText;
      });
    } catch(e){ aufbauFehler = String(e).slice(0,200); }
    check('7-bau: der Bericht liess sich einspielen und rendern', !aufbauFehler, aufbauFehler || undefined);
    check('7-vorab: der Angriffsbericht ist gezeichnet', bericht.length > 40, { laenge: bericht.length, auszug: bericht.slice(0,200) });
    check('7a: der Bericht nennt den angegriffenen Standort',
      /Angegriffener Standort/i.test(bericht), { auszug: bericht.slice(0,500) });
    check('7b: mit dem FREMDEN Namen, nicht mit meinem eigenen Kolonienamen desselben Planeten',
      /Vesna/.test(bericht) && !/MEIN ERZHAFEN/i.test(bericht), { auszug: bericht.slice(0,500) });
    check('7c: und er benennt die Standortart', /Kolonie/i.test(bericht), { auszug: bericht.slice(0,500) });
    check('7d: der geminderte Beutefaktor steht dabei', /0[.,]50/.test(bericht), { auszug: bericht.slice(0,500) });
    await t.ctx.close();
  }

  await browser.close();
  ende();
})();
