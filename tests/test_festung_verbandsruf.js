// Der Allianz-Verband direkt aus dem Festungsmenue (Auftrag Sascha, 04.09.2026).
//
//   node tests/test_festung_verbandsruf.js
//
// WARUM ES DIESEN TEST GIBT: Bisher fuehrte genau EIN Weg zu einem koordinierten Angriff - der
// Allianz-Tab, wo man die Festung ein zweites Mal heraussuchen musste. Der neue Eintrag im
// Kartenmenue nimmt das Ziel als gegeben und fragt nur noch Sammelphase, Nachricht und Zielwahl.
//
// GEPRUEFT WIRD:
//   0. Am Quelltext: Die Sammelzeiten des Verbands sind 15/30/45/60 - UND der Sternenfresser-Raid
//      hat seine EIGENE Liste. Das ist die eigentliche Falle dieser Aenderung: Bis heute speiste
//      eine Frontend-Liste ZWEI Backend-Endpunkte, die gegen ZWEI verschiedene Konstanten pruefen
//      (ALLIANCE_MUSTER_DURATIONS und ALLIANCE_RAID_GATHER_DURATIONS). Solange beide [30,60,120]
//      waren, fiel das nicht auf; mit den neuen Stufen haette der Raid 15 und 45 angeboten und der
//      Server sie mit 400 abgelehnt.
//   1. Der Eintrag steht im Festungsmenue und ist mit Allianz und Rang FREIGEGEBEN.
//   2. Ohne Allianz steht er trotzdem da, aber gesperrt und mit Grund - dieselbe Bauart wie der
//      Einzelschlag darueber.
//   3. Der Klick oeffnet das Overlay: genau vier Sammelzeiten, genau drei Ziele, ein Nachrichtenfeld.
//   4. DER AUFRUF: 45 Minuten + Schildkuppel + Nachricht landen so im Request an
//      /musterattack/create - gemessen am Request, nicht am Markup.
//   5. Die Meldung an die Allianz maskiert die Nachricht (sie geht per innerHTML in die Liste).
//
// GEGENPROBE (KEPLER_VRUF_SABOTAGE, Pflichtlisten unten gemessen):
//   listen   - der Raid nimmt wieder die Verbandsliste  -> 0b, 0c
//   eintrag  - der Menueeintrag faellt weg              -> 1a, 1b, 2a, 3a, 3b, 3c, 4a, 4b
//   ziel     - die Zielwahl wird nicht ausgelesen       -> 4b
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIELDATEI, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check: rohCheck, ende } = pruefer();
/* pruefer() fuehrt kein Ergebnisregister - die Gegenprobe braucht aber eine gemessene Liste der
   gefallenen Pruefungen, keine gezaehlte. Deshalb ein duenner Mantel darum: derselbe Aufruf,
   dieselbe Ausgabe, zusaetzlich ein Register. */
const ergebnis = {};
const check = (name, bedingung, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bedingung; rohCheck(name, bedingung, zusatz); };

const SAB = process.env.KEPLER_VRUF_SABOTAGE || '';
const MUSS_FALLEN = {
  listen:  ['0b', '0c'],
  eintrag: ['1a', '1b', '2a', '3a', '3b', '3c', '4a', '4b'],
  ziel:    ['4b']
};

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
const TAG = 'TST';

function feld(){
  return { systeme:[SYS], felder:{ [SYS]: { plaetze:{}, festung: {
    id:'fest-1', stufe:'sternenfeste', platz:'3', sorte:'eisen',
    kernMax:1200000, kern:900000, hort:250000, hortProto:180,
    seit:Date.now(), letzteReifung:Date.now(), beitraege:{}, schlaege:{},
    bauteile: { schild: { lp:480000, lpMax:480000 }, tuerme: { lp:300000, lpMax:300000 } }
  } } } };
}
function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'asteroid/field') return j(store.__feld);
    if (p === 'musterattack/create'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__create = (store.__create || []).concat([body]);
      // Die Ablehnung, gegen die 5b misst: der Server hat schon einen Verband laufen.
      if (store.__ablehnen) return j({ error: 'Es läuft bereits ein koordinierter Angriff.' }, 409);
      return j({ ok:true, doc: { id:'m1', zielArt:'festung', targetTag:null, festungSystem:SYS,
        festungStufeName:'Sternenfeste', createdBy:'u', createdByName:'A', message: body.message || '',
        createdAt: Date.now(), museterEndsAt: Date.now() + 2700000, phase:'gathering', dispatch:null, result:null } });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'storage-list') return j({ keys: Object.keys(store).filter(k => k.indexOf('__') !== 0) });
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|reports|galaxy|vorposten/.test(p))
      return j(p.includes('pending') ? { reward:null } : (p === 'galaxy'
        ? { npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[], collapsedSystems:{}, activeWormhole:null, news:[], controlledSystems:{}, factions:{}, alienNester: [] }
        : []));
    return j({});
  };
}
async function tab(browser, startSave, ohneAllianz){
  const store = { __feld: feld() };
  if (startSave) store[SAVE_KEY] = startSave;
  if (!ohneAllianz){
    store['alliance:' + TAG + ':info'] = JSON.stringify({ tag:TAG, creatorId:'u', creatorName:'A', createdAt: Date.now()-86400000, joinMode:'open' });
    store['alliance:' + TAG + ':role:u'] = JSON.stringify({ role:'admin', joinedAt: Date.now()-86400000, userId:'u' });
    store['alliance:' + TAG + ':base'] = JSON.stringify({ foundedAt: Date.now()-86400000, sector:'kepler', level:3, hp:1000 });
  }
  const ctx = await browser.newContext({ viewport: { width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
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
    const n = document.querySelector('[data-map-festung]');
    if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true }));
  });
  await t.page.waitForTimeout(600);
  return t.page.evaluate(() => {
    const m = document.querySelector('.kmenu');
    if (!m) return { da:false };
    const knoepfe = [...m.querySelectorAll('button')].map((b, i) => ({
      text: (b.textContent||'').trim(), gesperrt: b.disabled,
      grund: (b.nextElementSibling && b.nextElementSibling.classList.contains('kmenu-grund'))
        ? (b.nextElementSibling.textContent||'').trim() : ''
    }));
    return { da:true, knoepfe, text: m.innerText || '' };
  });
}

(async () => {
  // ---- 0) Quelltext: die zwei Listen ------------------------------------------------------------
  const mVon = JS.indexOf('const ALLIANCE_MUSTER_DURATIONS =');
  const mZeile = mVon > 0 ? JS.slice(mVon, JS.indexOf('\n', mVon)) : '';
  const rVon = JS.indexOf('const ALLIANCE_RAID_DURATIONS =');
  const rZeile = rVon > 0 ? JS.slice(rVon, JS.indexOf('\n', rVon)) : '';
  const zahlen = (z) => (z.match(/\[([^\]]*)\]/) || [,''])[1].split(',')
    .map(t => t.trim()).filter(Boolean).map(t => { const m = t.match(/^(\d+)\*60$/); return m ? Number(m[1]) : NaN; });
  check('0a: die Sammelphase des Verbands ist auf 15, 30, 45 und 60 Minuten einstellbar',
    JSON.stringify(zahlen(mZeile)) === JSON.stringify([15, 30, 45, 60]), { gemessen: zahlen(mZeile) });
  check('0b: der Sternenfresser-Raid hat eine EIGENE Liste (das Backend prueft ihn gegen eine andere Konstante)',
    rVon > 0 && JSON.stringify(zahlen(rZeile)) === JSON.stringify([30, 60, 120]), { gemessen: zahlen(rZeile) });
  /* Die Raid-Box darf die Verbandsliste NIRGENDS mehr lesen - sonst waere die Trennung nur die
     halbe: Ein zweiter Verweis reicht, damit der Raid wieder 15 Minuten anbietet. */
  const rbVon = JS.indexOf('const durOptions = ALLIANCE_RAID_DURATIONS.map');
  const rbBis = JS.indexOf('function renderAllianceMusterBox', rbVon > 0 ? rbVon : 0);
  const rBlock = (rbVon > 0 && rbBis > rbVon) ? JS.slice(rbVon, rbBis) : '';
  check('0c: und die Raid-Box liest die Verbandsliste NIRGENDS mehr',
    rbVon > 0 && rBlock.length > 0 && rBlock.indexOf('ALLIANCE_MUSTER_DURATIONS') < 0,
    { blockLaenge: rBlock.length, treffer: (rBlock.match(/ALLIANCE_MUSTER_DURATIONS/g) || []).length });
  const nVon = JS.indexOf("'alliance-muster': { icon:'ti-sword'");
  const nBlock = nVon > 0 ? JS.slice(nVon, nVon + 900) : '';
  check('0d: die Meldung nennt das ECHTE Ziel (p.ziel) statt eines leeren Kuerzels',
    /p\.ziel/.test(nBlock) && /p\.targetTag/.test(nBlock), { gefunden: nVon > 0 });
  check('0e: und maskiert die Nachricht des Ausrufers - sie geht per innerHTML in die Liste',
    /escapeHtml\(n\)/.test(nBlock) && /p\.nachricht/.test(nBlock));

  const browser = await starteBrowser();
  try {
    const roh = await tab(browser);
    const basis = roh.stand();
    await roh.ctx.close();
    check('0f: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
    if (!basis.buildings) return;

    function fixture(mitAllianz){
      const st = JSON.parse(JSON.stringify(basis));
      st.fleet = Object.assign({ missions: [] }, st.fleet, { jaeger: 200, cruisers: 80 });
      st.player = Object.assign({}, st.player, mitAllianz ? { allianceTag: TAG, allianceRole: 'admin' } : { allianceTag: null, allianceRole: null });
      const fern = Date.now() + 365*24*3600*1000;
      for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
      st.activeEvent = null; st.buffs = [];
      delete st.asteroidFeld;
      return JSON.stringify(st);
    }

    // ---- 1) Mit Allianz und Rang -----------------------------------------------------------------
    const t1 = await tab(browser, fixture(true));
    const m1 = await menueOeffnen(t1);
    const e1 = m1.knoepfe ? m1.knoepfe.find(b => /Allianz-Verband ausrufen/.test(b.text)) : null;
    check('1a: das Festungsmenue bietet den Verbands-Ruf an', !!e1,
      { knoepfe: (m1.knoepfe||[]).map(b => b.text) });
    check('1b: und er ist mit Allianz und Rang freigegeben', !!e1 && !e1.gesperrt,
      { gesperrt: e1 ? e1.gesperrt : null, grund: e1 ? e1.grund : null });
    check('1c: der Einzelschlag steht weiter darueber - der neue Eintrag ersetzt ihn nicht',
      (m1.knoepfe||[]).some(b => /Festung angreifen/.test(b.text)));

    // ---- 3) Das Overlay --------------------------------------------------------------------------
    const ov = await t1.page.evaluate(() => {
      const b = [...document.querySelectorAll('.kmenu button')].find(x => /Allianz-Verband ausrufen/.test(x.textContent||''));
      if (!b) return { da:false };
      b.click();
      const o = document.getElementById('vrufOverlay');
      if (!o || !o.classList.contains('open')) return { da:false, offen:false };
      const d = o.querySelector('#vrufDauer'), z = o.querySelector('#vrufFestungZiel');
      return { da:true, offen:true,
        dauern: d ? [...d.options].map(x => Number(x.value)) : [],
        dauerTexte: d ? [...d.options].map(x => x.textContent) : [],
        ziele: z ? [...z.options].map(x => x.value) : [],
        hatNachricht: !!o.querySelector('#vrufNachricht') };
    });
    check('3a: der Klick oeffnet das Overlay', ov.da && ov.offen, ov);
    check('3b: es bietet genau die vier Sammelzeiten an', JSON.stringify(ov.dauern||[]) === JSON.stringify([900, 1800, 2700, 3600]),
      { gemessen: ov.dauern, texte: ov.dauerTexte });
    check('3c: dazu die drei Ziele der Festung und ein Nachrichtenfeld',
      JSON.stringify(ov.ziele||[]) === JSON.stringify(['kern','schild','tuerme']) && ov.hatNachricht,
      { ziele: ov.ziele, hatNachricht: ov.hatNachricht });

    // ---- 4) Der Aufruf ---------------------------------------------------------------------------
    /* Die Bedienung ist bewusst GEGEN ein fehlendes Overlay abgesichert: In der Gegenprobe
       `eintrag` gibt es weder Knopf noch Overlay, und ein blindes o.querySelector() wuerde hier
       eine Ausnahme werfen - der Test waere tot, bevor er 4a und 4b ueberhaupt meldet. Eine
       Gegenprobe, die den Test abstuerzen laesst, misst nichts. */
    if (ov.da && ov.offen){
      await t1.page.evaluate(() => {
        const o = document.getElementById('vrufOverlay');
        const d = o.querySelector('#vrufDauer'); if (d) d.value = String(45*60);
        const z = o.querySelector('#vrufFestungZiel'); if (z) z.value = 'schild';
        const n = o.querySelector('#vrufNachricht'); if (n) n.value = 'Alle Mann, wir schleifen die Feste!';
        const b = o.querySelector('[data-vruf-start]'); if (b) b.click();
      });
      await t1.page.waitForTimeout(1200);
    }
    const anfrage = (t1.store.__create || [])[0] || null;
    check('4a: der Ruf geht als Festungs-Verband an den Server, mit der GEWAEHLTEN Sammelzeit und der Nachricht',
      !!anfrage && anfrage.zielArt === 'festung' && anfrage.gatherSeconds === 45*60
      && anfrage.festungSystem === SYS && /schleifen die Feste/.test(anfrage.message || ''), anfrage);
    check('4b: und traegt die gewaehlte Zielwahl mit - nicht stumm den Kern',
      !!anfrage && anfrage.festungZiel === 'schild', { festungZiel: anfrage ? anfrage.festungZiel : null });
    check('4c: keine Skriptfehler auf dem ganzen Weg', t1.errs.length === 0, t1.errs.slice(0, 2));
    await t1.ctx.close();

    /* ---- 5) Escape und der Erhalt der Eingabe -----------------------------------------------
       Zwei Befunde der Durchsicht: Escape fiel durch das Overlay hindurch bis zu dem Handler, der
       das aufgeklappte System zuklappt - man kam nur heraus, indem man das System verlor. Und bei
       einer Ablehnung des Servers waren Sammelphase, Zielwahl und die getippte Nachricht weg. */
    const t5 = await tab(browser, fixture(true));
    t5.store.__ablehnen = true;
    await menueOeffnen(t5);
    const esc = await t5.page.evaluate(async () => {
      const b = [...document.querySelectorAll('.kmenu button')].find(x => /Allianz-Verband ausrufen/.test(x.textContent||''));
      if (b) b.click();
      const offenVorher = !!document.querySelector('#vrufOverlay.open');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return { offenVorher, offenNachher: !!document.querySelector('#vrufOverlay.open') };
    });
    check('5a: Escape schliesst das Overlay', esc.offenVorher && !esc.offenNachher, esc);
    /* Das KARTENMENUE schliesst sich beim Oeffnen des Overlays (openKarteMenu ruft closeKarteMenu
       vor dem Eintrag) - der zweite Klick braucht deshalb ein frisch geoeffnetes Menue, nicht das
       alte. Erster Entwurf fand den Knopf nicht mehr und meldete rot, ohne etwas zu messen. */
    await t5.page.evaluate(() => {
      const b = [...document.querySelectorAll('.kmenu button')].find(x => /Allianz-Verband ausrufen/.test(x.textContent||''));
      if (b) b.click();
      const o = document.getElementById('vrufOverlay');
      if (!o) return;
      o.querySelector('#vrufDauer').value = String(45*60);
      o.querySelector('#vrufFestungZiel').value = 'tuerme';
      o.querySelector('#vrufNachricht').value = 'Zweiter Versuch';
      o.querySelector('[data-vruf-start]').click();
    });
    await t5.page.waitForTimeout(1200);
    await menueOeffnen(t5);
    const behalten = await t5.page.evaluate(() => {
      const b = [...document.querySelectorAll('.kmenu button')].find(x => /Allianz-Verband ausrufen/.test(x.textContent||''));
      if (!b) return { da: false, grund: 'kein Knopf' };
      b.click();
      const o = document.getElementById('vrufOverlay');
      if (!o || !o.classList.contains('open')) return { da: false, grund: 'Overlay zu' };
      return { da: true, dauer: Number(o.querySelector('#vrufDauer').value),
        ziel: o.querySelector('#vrufFestungZiel').value, txt: o.querySelector('#vrufNachricht').value };
    });
    check('5b: nach einer Ablehnung stehen Sammelphase, Zielwahl und Nachricht wieder da',
      behalten.da && behalten.dauer === 45*60 && behalten.ziel === 'tuerme' && /Zweiter Versuch/.test(behalten.txt || ''),
      behalten);
    await t5.ctx.close();

    // ---- 2) Ohne Allianz -------------------------------------------------------------------------
    const t2 = await tab(browser, fixture(false), true);
    const m2 = await menueOeffnen(t2);
    const e2 = m2.knoepfe ? m2.knoepfe.find(b => /Allianz-Verband ausrufen/.test(b.text)) : null;
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
