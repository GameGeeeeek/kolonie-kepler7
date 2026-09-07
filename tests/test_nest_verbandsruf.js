// Der Allianz-Verband direkt aus dem NESTMENUE (Auftrag Sascha, 07.09.2026, woertlich: „nester und
// koenigin auch angreifbar mit allianz machen").
//
//   node tests/test_nest_verbandsruf.js
//
// WARUM ES DIESEN TEST GIBT: Die Festung bekam diesen Einstieg am 04.09.2026, das Nest nicht -
// obwohl es ihn dringender braucht. Eine Koenigin haelt 4.000.000 Lebenspunkte bei 4 h
// Abklingzeit; im Alleingang ist sie praktisch nicht zu schaffen, der Verband ist der vorgesehene
// Weg. Trotzdem fuehrte der einzige Weg dorthin ueber den Allianz-Tab, wo das Nest nach Volk und
// System noch einmal aus einer Liste gesucht werden musste, nachdem man es auf der Karte schon
// angetippt hatte.
//
// GEPRUEFT WIRD:
//   0. AM QUELLTEXT, und das ist der Teil, der diesen Test ueber „noch ein Menueeintrag" hebt:
//      Die vier Sperrgruende stehen GENAU EINMAL im Spiel (`verbandsRufSperre`), und BEIDE
//      Kartenmenues lesen sie von dort. Vorher trug die Festung sie als eigenen Block; eine
//      zweite Kopie im Nest waeren zwei Stellen gewesen, die beim naechsten Zielart (Vorposten,
//      Konvoi) auseinanderlaufen. Genau diese Sorte Kopie ist in diesem Projekt schon mehrfach
//      auseinandergelaufen - deshalb bewacht 0a die gemeinsame Implementierung und 0b/0c die
//      Einstiegspunkte.
//   1. Der Eintrag steht im Nestmenue und ist mit Allianz und Rang freigegeben; der Einzelschlag
//      bleibt darueber stehen.
//   2. Ohne Allianz steht er trotzdem da - gesperrt und mit Grund.
//   3. Der Klick oeffnet dasselbe Overlay: vier Sammelzeiten, ein Nachrichtenfeld - und KEINE
//      Zielwahl. Das ist der Unterschied zur Festung und keine Kleinigkeit: Wuerde das
//      Festungs-Auswahlfeld hier mit auftauchen, schickte der Ruf ein `festungZiel` an ein Nest.
//   4. DER AUFRUF: Sammelzeit, Nachricht und die Kennung DIESES Nestes landen so im Request an
//      /musterattack/create - gemessen am Request, nicht am Markup. Danach steht die eigene
//      Flottenwahl offen (der gemeinsame zweite Schritt aus dem Ruf-Overlay).
//   5. Die KOENIGIN (Stufe 5) ist derselbe Weg - der Titel des Overlays nennt sie beim Namen.
//
// GEGENPROBE (KEPLER_NVRUF_SABOTAGE, Pflichtlisten unten GEMESSEN, nicht geschaetzt):
//   alt      - der Stand vor diesem Auftrag (weder Helfer noch Nest-Eintrag)
//   helfer   - die vier Gruende stehen wieder doppelt im Menue statt im Helfer
const fs = require('fs');
const { starteBrowser, SPIELDATEI, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check: rohCheck, ende } = pruefer();
/* Wie bei test_festung_verbandsruf.js: pruefer() fuehrt kein Ergebnisregister, die Gegenprobe
   braucht aber eine GEMESSENE Liste der gefallenen Pruefungen. Duenner Mantel darum. */
const ergebnis = {};
const check = (name, bedingung, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bedingung; rohCheck(name, bedingung, zusatz); };

const SAB = process.env.KEPLER_NVRUF_SABOTAGE || '';
const MUSS_FALLEN = {
  alt:    ['0a', '0b', '0c', '1a', '1b', '2a', '3a', '3b', '3c', '4a', '4b', '5a'],
  helfer: ['0a', '0c']
};

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
const NEST_ID = 'nest-vruf-1';
const TAG = 'TST';

function nest(opt){
  return Object.assign({ id: NEST_ID, volk:'kryll', sys:SYS, stufe:3, lp:260000, lpMax:400000,
    seit: Date.now() - 7200000, letzteReifung: Date.now() - 3600000,
    naechsterWurf: Date.now() + 8*3600*1000, naechsteWanderung: 0, beitraege:{}, schlaege:{} }, opt || {});
}
function backend(store, opt){
  opt = opt || {};
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[],
      controlledSystems:{}, factions:{}, alienNester: [nest(opt.nest)] });
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{} } } });
    if (p === 'musterattack/create'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__create = (store.__create || []).concat([body]);
      return j({ ok:true, doc: { id:'m1', zielArt:'alien-nest', targetTag:null, nestId: body.nestId,
        nestVolkName:'Kryll-Schwarm', nestSystem:SYS, createdBy:'u', createdByName:'A',
        message: body.message || '', createdAt: Date.now(), museterEndsAt: Date.now() + 2700000,
        phase:'gathering', dispatch:null, result:null } });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'storage-list') return j({ keys: Object.keys(store).filter(k => k.indexOf('__') !== 0) });
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|reports|vorposten/.test(p))
      return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}
async function tab(browser, startSave, opt){
  opt = opt || {};
  const store = {};
  if (startSave) store[SAVE_KEY] = startSave;
  if (!opt.ohneAllianz){
    store['alliance:' + TAG + ':info'] = JSON.stringify({ tag:TAG, creatorId:'u', creatorName:'A', createdAt: Date.now()-86400000, joinMode:'open' });
    store['alliance:' + TAG + ':role:u'] = JSON.stringify({ role:'admin', joinedAt: Date.now()-86400000, userId:'u' });
    store['alliance:' + TAG + ':base'] = JSON.stringify({ foundedAt: Date.now()-86400000, sector:'kepler', level:3, hp:1000 });
  }
  const ctx = await browser.newContext({ viewport: { width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store, opt));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
async function menueOeffnen(t){
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t.page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(t.page, SYS);
  await t.page.waitForTimeout(1200);
  await t.page.evaluate(() => {
    const n = document.querySelector('[data-map-nest]');
    if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true }));
  });
  await t.page.waitForTimeout(600);
  return t.page.evaluate(() => {
    const m = document.querySelector('.kmenu');
    if (!m) return { da:false, knoepfe: [] };
    return { da:true, knoepfe: [...m.querySelectorAll('button')].map(b => ({
      text: (b.textContent||'').trim(), gesperrt: b.disabled,
      grund: (b.nextElementSibling && b.nextElementSibling.classList.contains('kmenu-grund'))
        ? (b.nextElementSibling.textContent||'').trim() : '' })) };
  });
}
/* Schneidet den Rumpf einer Funktion aus dem Quelltext - fuer 0b/0c gebraucht. Der Endanker wird
   VOR der Benutzung geprueft (Hausregel: ein Slice mit fehlendem Anker laeuft sonst bis zum
   Dateiende und die Pruefung wird vacuous). */
function rumpf(name, endeAnker){
  const von = JS.indexOf('function ' + name + '(');
  if (von < 0) return null;
  const bis = JS.indexOf(endeAnker, von);
  if (bis < 0) return null;
  return JS.slice(von, bis);
}

(async () => {
  // ---- 0) Quelltext: EINE Implementierung, ZWEI Einstiegspunkte --------------------------------
  /* Der Satz, an dem die vier Gruende haengen. Er steht seit dem 07.09.2026 genau einmal - im
     Helfer. Gezaehlt wird der GRUNDTEXT selbst, nicht der Funktionsname: Wer die Gruende
     zurueckkopiert, kopiert den Text mit, und genau das soll auffallen. */
  const rangSatz = /Nur Admins und Offiziere rufen einen Verband aus\./g;
  const treffer = (JS.match(rangSatz) || []).length;
  check('0a: die vier Sperrgruende des Verbands-Rufs stehen genau EINMAL im Spiel',
    treffer === 1 && /function verbandsRufSperre\(\)/.test(JS), { treffer });
  const rNest = rumpf('nestMapMenu', 'function konvoiMapMenu');
  const rFest = rumpf('festungMapMenu', 'openKarteMenu(ev, st.name');
  check('0b: das Festungsmenue liest sie aus dem gemeinsamen Helfer',
    !!rFest && /verbandsRufSperre\(\)/.test(rFest), { gefunden: !!rFest });
  check('0c: und das Nestmenue liest denselben Helfer - keine zweite Kopie',
    !!rNest && /verbandsRufSperre\(\)/.test(rNest)
    && !/Nur Admins und Offiziere rufen einen Verband aus\./.test(rNest || ''), { gefunden: !!rNest });

  const browser = await starteBrowser();
  try {
    const roh = await tab(browser);
    const basis = roh.stand();
    await roh.ctx.close();
    check('0d: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
    if (!basis.buildings) return;

    function fixture(mitAllianz){
      const st = JSON.parse(JSON.stringify(basis));
      st.fleet = Object.assign({ missions: [] }, st.fleet, { jaeger: 200, cruisers: 80 });
      st.player = Object.assign({}, st.player, mitAllianz
        ? { allianceTag: TAG, allianceRole: 'admin' } : { allianceTag: null, allianceRole: null });
      // Ereignis-Riegel: kein Zufallsereignis waehrend der Messung.
      const fern = Date.now() + 365*24*3600*1000;
      for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
      st.activeEvent = null; st.buffs = [];
      return JSON.stringify(st);
    }

    // ---- 1) Mit Allianz und Rang ----------------------------------------------------------------
    const t1 = await tab(browser, fixture(true));
    const m1 = await menueOeffnen(t1);
    const e1 = m1.knoepfe.find(b => /Allianz-Verband ausrufen/.test(b.text)) || null;
    check('1a: das Nestmenue bietet den Verbands-Ruf an', !!e1, { knoepfe: m1.knoepfe.map(b => b.text) });
    check('1b: und er ist mit Allianz und Rang freigegeben', !!e1 && !e1.gesperrt,
      { gesperrt: e1 ? e1.gesperrt : null, grund: e1 ? e1.grund : null });
    check('1c: der Einzelschlag steht weiter darueber - der neue Eintrag ersetzt ihn nicht',
      m1.knoepfe.some(b => /Nest angreifen/.test(b.text)));

    // ---- 3) Das Overlay -------------------------------------------------------------------------
    const ov = await t1.page.evaluate(() => {
      const b = [...document.querySelectorAll('.kmenu button')].find(x => /Allianz-Verband ausrufen/.test(x.textContent||''));
      if (!b) return { da:false };
      b.click();
      const o = document.getElementById('vrufOverlay');
      if (!o || !o.classList.contains('open')) return { da:false, offen:false };
      const d = o.querySelector('#vrufDauer');
      const titel = o.querySelector('.fwahl-titel');
      return { da:true, offen:true,
        dauern: d ? [...d.options].map(x => Number(x.value)) : [],
        hatFestungsZiel: !!o.querySelector('#vrufFestungZiel'),
        hatNachricht: !!o.querySelector('#vrufNachricht'),
        titel: titel ? (titel.textContent||'').trim() : '' };
    });
    check('3a: der Klick oeffnet das Overlay', ov.da && ov.offen, ov);
    check('3b: es bietet dieselben vier Sammelzeiten an wie bei der Festung',
      JSON.stringify(ov.dauern||[]) === JSON.stringify([900, 1800, 2700, 3600]), { gemessen: ov.dauern });
    /* Die eigentliche Nest-Pruefung: KEINE Zielwahl. Ein Nest hat nur einen Koerper - stuende das
       Festungsfeld hier, ginge ein `festungZiel` an ein Nest, und der Spieler saehe drei Ziele,
       von denen zwei nicht existieren. */
    check('3c: mit Nachrichtenfeld, aber OHNE die Bauteil-Zielwahl der Festung',
      ov.hatNachricht === true && ov.hatFestungsZiel === false,
      { hatNachricht: ov.hatNachricht, hatFestungsZiel: ov.hatFestungsZiel });

    // ---- 4) Der Aufruf --------------------------------------------------------------------------
    /* Gegen ein fehlendes Overlay abgesichert: In der Gegenprobe `alt` gibt es weder Knopf noch
       Overlay; ein blindes querySelector() wuerde hier werfen und den Test toeten, bevor 4a/4b
       ueberhaupt melden. Eine Gegenprobe, die den Test abstuerzen laesst, misst nichts. */
    if (ov.da && ov.offen){
      await t1.page.evaluate(() => {
        const o = document.getElementById('vrufOverlay');
        const d = o.querySelector('#vrufDauer'); if (d) d.value = String(45*60);
        const n = o.querySelector('#vrufNachricht'); if (n) n.value = 'Alle Mann, wir raeuchern den Stock aus!';
        const b = o.querySelector('[data-vruf-start]'); if (b) b.click();
      });
      await t1.page.waitForTimeout(1200);
    }
    const anfrage = (t1.store.__create || [])[0] || null;
    check('4a: der Ruf geht als Nest-Verband an den Server, mit DIESER Kennung, der gewaehlten Sammelzeit und der Nachricht',
      !!anfrage && anfrage.zielArt === 'alien-nest' && String(anfrage.nestId) === NEST_ID
      && anfrage.gatherSeconds === 45*60 && /raeuchern den Stock/.test(anfrage.message || ''), anfrage);
    /* Der gemeinsame zweite Schritt aus dem Ruf-Overlay (07.09.2026): Der Rufer soll nicht ohne
       eigene Schiffe dastehen. Gemessen wird der ZUSTAND nach dem Ruf, nicht der Quelltext - und
       dass es die Flottenwahl zum ANSCHLIESSEN ist, nicht irgendeine. */
    const fw = await t1.page.evaluate(() => {
      const o = document.querySelector('.fwahl-overlay.open');
      if (!o) return { offen:false };
      return { offen:true, text: (o.textContent||'').replace(/\s+/g,' ').trim().slice(0, 160),
        knopf: [...o.querySelectorAll('button')].map(b => (b.textContent||'').trim()) };
    });
    check('4b: nach dem Ruf steht die eigene Flottenwahl zum ANSCHLIESSEN offen',
      fw.offen === true && /Koordinierter Angriff/.test(fw.text || '')
      && (fw.knopf || []).some(t => /Flotte anschließen/.test(t)), fw);
    check('4c: keine Skriptfehler auf dem ganzen Weg', t1.errs.length === 0, t1.errs.slice(0, 2));
    await t1.ctx.close();

    // ---- 5) Die Koenigin ------------------------------------------------------------------------
    /* Saschas Auftrag nennt sie ausdruecklich. Sie ist dasselbe Objekt in Stufe 5 - der Test
       belegt, dass sie damit denselben Weg bekommt UND dass der Overlay-Titel sie beim Namen
       nennt (der Stufenname allein hiesse „Königin" ohne Volk, der Festungstitel nutzt st.name). */
    const t5 = await tab(browser, fixture(true), { nest: { stufe:5, lp:3200000, lpMax:4000000 } });
    const m5 = await menueOeffnen(t5);
    const titel5 = await t5.page.evaluate(() => {
      const b = [...document.querySelectorAll('.kmenu button')].find(x => /Allianz-Verband ausrufen/.test(x.textContent||''));
      if (!b) return '';
      b.click();
      const t = document.querySelector('#vrufOverlay.open .fwahl-titel');
      return t ? (t.textContent||'').trim() : '';
    });
    check('5a: auch die Koenigin laesst sich im Verband angreifen, und der Titel nennt sie',
      m5.knoepfe.some(b => /Allianz-Verband ausrufen/.test(b.text) && !b.gesperrt) && /Königin/.test(titel5),
      { titel: titel5 });
    await t5.ctx.close();

    // ---- 2) Ohne Allianz ------------------------------------------------------------------------
    const t2 = await tab(browser, fixture(false), { ohneAllianz: true });
    const m2 = await menueOeffnen(t2);
    const e2 = m2.knoepfe.find(b => /Allianz-Verband ausrufen/.test(b.text)) || null;
    check('2a: ohne Allianz steht der Eintrag trotzdem da - gesperrt und mit Grund',
      !!e2 && e2.gesperrt && /Allianz/.test(e2.grund || ''),
      { gesperrt: e2 ? e2.gesperrt : null, grund: e2 ? e2.grund : null });
    await t2.ctx.close();
  } finally {
    await browser.close();
  }

  // ---- Auswertung: Gruen-Lauf ODER Gegenprobe ---------------------------------------------------
  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false).sort();
    const fehlt = soll.filter(k => gefallen.indexOf(k) < 0);
    const zuviel = gefallen.filter(k => soll.indexOf(k) < 0);
    console.log('\nGegenprobe „' + SAB + '": gefallen ' + JSON.stringify(gefallen) + ', erwartet ' + JSON.stringify(soll));
    if (fehlt.length || zuviel.length){
      console.log('FAIL - Gegenprobe: nicht gefallen ' + JSON.stringify(fehlt) + ', unerwartet gefallen ' + JSON.stringify(zuviel));
      process.exit(1);
    }
    console.log('PASS - Gegenprobe: genau die erwarteten Pruefungen sind gefallen.');
    process.exit(0);
  }
  ende();
})();
