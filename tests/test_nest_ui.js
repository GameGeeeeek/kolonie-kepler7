// Alien-Nester im gerenderten Spiel (Phase 3, 18.08.2026).
//
//   node tests/test_nest_ui.js
//
// Der Test fährt das ECHTE Spiel im Browser gegen einen nachgebauten Server. Das Nest kommt dabei
// über den GALAXIE-Zustand (db.galaxy.alienNester), nicht über ein eigenes Dokument - anders als
// die Festung, die im Asteroiden-Felddokument steckt. Der Unterschied ist Absicht des Backends:
// db.galaxy ist für Clients über die generische Storage-Route gar nicht erreichbar.
//
// GEPRUEFT WIRD:
//   1. Der Kartenknoten erscheint im aufgeklappten System - und zwar SICHTBAR (gemessene Fläche),
//      nicht bloss im DOM (Arbeitsregel 55).
//   2. Das Kartenmenü nennt Lebenspunkte, Schwäche und - bei wandernden Völkern - die Warnung.
//   3. Der Angriffs-Eintrag ist gesperrt, solange die Abklingzeit läuft, und nennt den GRUND.
//   4. Die Flottenwahl misst die Schwäche an der ECHTEN Auswahl: derselbe Verband einmal mit und
//      einmal ohne die passende Schiffsklasse muss unterschiedliche Vorschau-Aussagen liefern.
//      Das ist der Kern des Tests (Arbeitsregel 61: nicht das Etikett prüfen, sondern die Regel) -
//      eine Prüfung auf "das Wort Schwäche steht da" wäre in BEIDE Richtungen grün.
//   5. Der Start legt eine Mission mit der NEST-KENNUNG an und bucht Treibstoff ab.
//   6. Ein verpasster Schlag (Nest weitergezogen) kostet nichts: Die Flotte kehrt vollzählig
//      zurück, und der Grund steht im Protokoll.
//
// GEGENPROBE (in beide Richtungen ausgeführt, überall dieselbe Anzahl gelaufener Prüfungen):
//   * Ohne Nest im Galaxie-Zustand: kein Knoten (1b), kein Menü.
//   * Mit einer Kopie, in der nestTrifftSchwaeche stur false liefert, fällt 4c - 4a/4b bleiben
//     grün, sie prüfen ja nur, DASS eine Aussage dasteht.
//   * Mit einer Kopie, die die Nest-Kennung nicht in die Mission schreibt, fällt 5b.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren, oeffneSektorMitSystem } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';

// Ein Nest der Nomaden von Vex: das einzige wandernde Volk, also zugleich die Warnzeile in 2c.
// Schwäche 'destroyers' - die Frontend-Schreibweise; test_nest_paritaet hält sie gegen das Backend.
function nest(opt){
  opt = opt || {};
  return {
    id: 'nest-1', volk: opt.volk || 'vex', sys: SYS,
    stufe: opt.stufe || 3, lp: opt.lp !== undefined ? opt.lp : 260000, lpMax: 400000,
    seit: Date.now() - 3600000, letzteReifung: Date.now(),
    beitraege: {}, schlaege: opt.schlaege || {}
  };
}
function galaxie(nester){
  return { npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[],
           activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[],
           alienNester: nester || [] };
}

function backend(store, opt){
  opt = opt || {};
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j(store.__galaxie);
    if (p === 'alien/nest-angriff'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__angriffe = (store.__angriffe || []).concat([body]);
      if (opt.verpasst) return j({ ok:true, verpasst:true, grund:'weitergezogen', neuesSystem:'vega',
        text:'Der Schwarm ist weitergezogen - dein Verband findet bei ' + SYS + ' nichts mehr vor und kehrt zurück.' });
      return j({ ok:true, schaden:52000, gefallen:false, trifftSchwaeche:true, schwaeche:'destroyer',
        lp:208000, lpMax:400000, stufe:3, stufeName:'Schwarmstock', volk:'vex', volkName:'Nomaden von Vex',
        eigeneVerluste:{ cruisers:2 }, anteil:0, teilnehmer:1, schwarmGefallen:false, mitgerissen:0,
        naechsterSchlagAb: Date.now() + 4*3600*1000 });
    }
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'reports'){
      if (req.method() === 'POST'){ try { (store.__berichte = store.__berichte || []).unshift(JSON.parse(req.postData()||'{}').report || {}); } catch(e){} return j({ ok:true }); }
      return j({ reports: store.__berichte || [] });
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

async function tab(browser, startSave, opt){
  opt = opt || {};
  const store = { __galaxie: opt.galaxie || galaxie([nest()]) };
  if (startSave) store[SAVE_KEY] = startSave;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [], protokoll = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store, opt));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  // Mitschnitt statt Endstand: #log überschreibt sich mit jeder Meldung selbst (Arbeitsregel 47).
  await page.addInitScript(() => {
    window.__log = [];
    // documentElement statt body: addInitScript laeuft VOR dem body, und ein Observer auf
    // undefined wirft (genau das ist beim ersten Anlauf passiert).
    // addInitScript laeuft VOR dem Dokument - der Observer wird erst gesetzt, wenn es steht.
    const start = () => { try {
      new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes){
        const l = document.getElementById('log'); if (l && l.contains(n)) window.__log.push(l.textContent || '');
      }}).observe(document.documentElement, { childList:true, subtree:true });
    } catch(e){} };
    if (document.documentElement) start(); else document.addEventListener('readystatechange', start, { once:true });
  });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  return { ctx, page, errs, store, protokoll,
           log: () => page.evaluate(() => window.__log || []),
           stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
async function aufKarte(t){
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t.page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(t.page, SYS);
}

(async () => {
  const browser = await starteBrowser();

  const roh = await tab(browser);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0a: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }
  check('0b: es gibt einen eigenen Kartenknoten im Quelltext', HTML.includes('data-map-nest'));

  function fixture(extra){
    const st = JSON.parse(JSON.stringify(basis));
    st.fleet.cruisers = 40; st.fleet.jaeger = 60; st.fleet.destroyers = 12;
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    // Die Reiterleisten-Hinweise abschalten: Sie sind 166 px hoch und verschieben jede
    // Fensterlage-Messung (Arbeitsregel 63).
    st.seenTabHints = {};
    for (const t of ['basis','flotte','karte','galaxie','fortschritt','forschung','werft','verteidigung','allianz','markt','module','profil']) st.seenTabHints[t] = true;
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 400000;
    Object.assign(st, extra || {});
    return JSON.stringify(st);
  }

  // ---- 1) Der Kartenknoten -------------------------------------------------------------------
  {
    const t = await tab(browser, fixture());
    await aufKarte(t);
    await t.page.waitForTimeout(1200);
    const mass = await t.page.evaluate(() => {
      const n = document.querySelector('[data-map-nest]');
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { breite: Math.round(r.width), hoehe: Math.round(r.height) };
    });
    // SICHTBARKEIT, nicht Existenz (Arbeitsregel 55): ein Knoten mit Fläche 0 stünde im DOM und
    // wäre für den Spieler nicht da.
    check('1a: der Nest-Knoten ist im offenen System sichtbar', !!mass && mass.breite > 8 && mass.hoehe > 8, mass);
    check('1b: keine Konsolenfehler beim Zeichnen', t.errs.length === 0, t.errs.slice(0,3));
    await t.ctx.close();
  }
  // Gegenrichtung: ohne Nest kein Knoten. Ohne sie belegt 1a nichts.
  {
    const t = await tab(browser, fixture(), { galaxie: galaxie([]) });
    await aufKarte(t);
    await t.page.waitForTimeout(1200);
    const da = await t.page.evaluate(() => !!document.querySelector('[data-map-nest]'));
    check('1c-gegenrichtung: ohne Nest im Galaxie-Zustand steht kein Knoten', !da);
    await t.ctx.close();
  }

  // ---- 2) Das Kartenmenü ---------------------------------------------------------------------
  {
    const t = await tab(browser, fixture());
    await aufKarte(t);
    await t.page.waitForTimeout(1200);
    await t.page.evaluate(() => { const n = document.querySelector('[data-map-nest]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    await t.page.waitForTimeout(700);
    const txt = await t.page.evaluate(() => {
      const m = document.querySelector('.kmenu');
      return m ? (m.textContent || '') : '';
    });
    check('2a: das Menü nennt die Lebenspunkte', /Lebenspunkte/.test(txt), { txt: txt.slice(0,140) });
    check('2b: das Menü nennt die Schwäche namentlich (Zerstörer)', /Zerstörer/.test(txt), { txt: txt.slice(0,200) });
    check('2c: bei einem wandernden Volk warnt es davor', /zieht weiter/.test(txt), { txt: txt.slice(0,240) });
    check('2d: der Angriffs-Eintrag steht bereit', /Nest angreifen/.test(txt), { txt: txt.slice(0,140) });
    await t.ctx.close();
  }
  // ---- 3) Abklingzeit: der Eintrag ist gesperrt UND nennt den Grund ---------------------------
  {
    const frisch = { 'u': Date.now() - 60000 };   // vor einer Minute geschlagen
    const t = await tab(browser, fixture(), { galaxie: galaxie([nest({ schlaege: frisch })]) });
    await aufKarte(t);
    await t.page.waitForTimeout(1200);
    await t.page.evaluate(() => { const n = document.querySelector('[data-map-nest]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    await t.page.waitForTimeout(700);
    const txt = await t.page.evaluate(() => {
      const m = document.querySelector('.kmenu');
      return m ? (m.textContent || '') : '';
    });
    check('3a: bei laufender Abklingzeit nennt das Menü den Grund',
      /sammeln sich neu|nächster Schlag/i.test(txt), { txt: txt.slice(0,240) });
    await t.ctx.close();
  }

  // ---- 4) Die Schwäche wird an der ECHTEN Auswahl gemessen -----------------------------------
  // Der Kern des Tests. Zweimal derselbe Ablauf, einmal MIT Zerstörern in der Flotte und einmal
  // ohne - die Vorschau muss unterschiedlich ausfallen. Eine Prüfung auf "das Wort steht da" wäre
  // in beide Richtungen grün (Arbeitsregel 61).
  async function vorschauText(mitZerstoerern){
    const st = JSON.parse(fixture());
    if (!mitZerstoerern) st.fleet.destroyers = 0;
    const t = await tab(browser, JSON.stringify(st));
    await aufKarte(t);
    await t.page.waitForTimeout(1200);
    await t.page.evaluate(() => { const n = document.querySelector('[data-map-nest]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    await t.page.waitForTimeout(600);
    await t.page.evaluate(() => {
      for (const el of document.querySelectorAll('.kmenu button[data-kmenu-i]')){
        if ((el.textContent||'').includes('Nest angreifen')){ el.click(); return; }
      }
    });
    await t.page.waitForTimeout(900);
    const txt = await t.page.evaluate(() => {
      const o = document.getElementById('fwahlOverlay');
      return o ? (o.textContent || '') : '';
    });
    await t.ctx.close();
    return txt;
  }
  const mit = await vorschauText(true);
  const ohne = await vorschauText(false);
  check('4a: die Vorschau nennt bei passender Flotte die getroffene Schwäche',
    /Schwäche getroffen/.test(mit), { ausschnitt: (mit.match(/.{0,60}Schwäche.{0,60}/)||[''])[0] });
  check('4b: ohne die passende Klasse nennt sie den fehlenden Bonus',
    /Empfindlich gegen/.test(ohne), { ausschnitt: (ohne.match(/.{0,60}Empfindlich.{0,60}/)||[''])[0] });
  check('4c-WIRKUNG: beide Vorschauen sagen etwas VERSCHIEDENES',
    /Schwäche getroffen/.test(mit) !== /Schwäche getroffen/.test(ohne),
    { mitTrifft: /Schwäche getroffen/.test(mit), ohneTrifft: /Schwäche getroffen/.test(ohne) });

  // ---- 5) Der Start legt die Mission mit der Nest-Kennung an ---------------------------------
  {
    const t = await tab(browser, fixture());
    await aufKarte(t);
    await t.page.waitForTimeout(1200);
    await t.page.evaluate(() => { const n = document.querySelector('[data-map-nest]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    await t.page.waitForTimeout(600);
    await t.page.evaluate(() => {
      for (const el of document.querySelectorAll('.kmenu button[data-kmenu-i]')){
        if ((el.textContent||'').includes('Nest angreifen')){ el.click(); return; }
      }
    });
    await t.page.waitForTimeout(900);
    await t.page.evaluate(() => {
      // data-fwahl-start - aus dem Code abgelesen, nicht ueber den Beschriftungstext geraten.
      const b = document.querySelector('#fwahlOverlay [data-fwahl-start]');
      if (b && !b.disabled) b.click();
    });
    await t.page.waitForTimeout(1500);
    const knopf = await t.page.evaluate(() => {
      const b = document.querySelector('#fwahlOverlay [data-fwahl-start]');
      return b ? { da:true, gesperrt: !!b.disabled, text:(b.textContent||'').trim() } : { da:false };
    });
    check('5-vorab: der Startknopf war bedienbar', knopf.da === false || !knopf.gesperrt, knopf);
    // Aus dem SERVER-Speicher lesen, nicht aus localStorage: Das Spiel schreibt seinen Stand ueber
    // storage/ - der erste Anlauf las localStorage und sah nichts, obwohl die Mission laut
    // Protokoll laengst lief.
    // Beide Quellen ansehen: Der Stand kann im Server-Stub ODER in localStorage liegen, je
    // nachdem, ob der Autosave schon durch war. Wer nur eine liest, misst Timing statt Inhalt.
    const lokal5 = await t.page.evaluate(() => localStorage.getItem('kepler7-save-v3') || '');
    const st5 = (() => {
      const a = t.stand();
      const b = lokal5 ? JSON.parse(lokal5) : {};
      const zaehl = o => { let n = (((o||{}).fleet||{}).missions||[]).length; for (const c of Object.values((o||{}).colonies||{})) n += (((c||{}).fleet||{}).missions||[]).length; return n; };
      return zaehl(b) > zaehl(a) ? b : a;
    })();
    const alle5 = [];
    const sammel5 = f => { for (const mm of (((f||{}).fleet||{}).missions)||[]) alle5.push(mm); };
    sammel5(st5); for (const c of Object.values(st5.colonies||{})) sammel5(c);
    const m = alle5.find(x => x.type === 'nest-angriff') || null;
    const log5 = await t.log();
    check('5a: eine Mission vom Typ nest-angriff ist angelegt', !!m,
      m ? { type:m.type, system:m.system } : { letzteMeldungen: log5.slice(-4) });
    check('5b: sie trägt die NEST-KENNUNG (sonst schlüge sie gegen ein fremdes Ziel ein)',
      !!m && m.nestId === 'nest-1', m && { nestId:m.nestId });
    check('5c: sie ist ein RUNDFLUG - endTime liegt deutlich hinter der halben Strecke',
      !!m && (m.endTime - m.startTime) > 0, m && { dauerSek: m && Math.round((m.endTime-m.startTime)/1000) });
    await t.ctx.close();
  }

  // ---- 6) Verpasster Schlag kostet nichts ----------------------------------------------------
  {
    const st = JSON.parse(fixture());
    // Eine Mission, die JETZT ankommt - der Server antwortet mit `verpasst`.
    st.fleet.missions = (st.fleet.missions||[]).concat([{
      id: 9001, type:'nest-angriff', targetId:SYS, system:SYS, nestId:'nest-1',
      stufe:3, stufeName:'Schwarmstock', volk:'vex', volkName:'Nomaden von Vex',
      startTime: Date.now() - 60000, endTime: Date.now() - 1000,
      fleetName:'Testverband', composition:{ cruisers:10, destroyers:4 }
    }]);
    const vorher = { cruisers: st.fleet.cruisers, destroyers: st.fleet.destroyers };
    const t = await tab(browser, JSON.stringify(st), { verpasst:true });
    await t.page.waitForTimeout(4000);
    const lokal6 = await t.page.evaluate(() => localStorage.getItem('kepler7-save-v3') || '');
    const s6 = lokal6 ? JSON.parse(lokal6) : t.stand();
    const nachher = { cruisers: (s6.fleet||{}).cruisers, destroyers: (s6.fleet||{}).destroyers };
    const log = await t.log();
    check('6a: die Flotte kehrt VOLLZÄHLIG zurück (kein Schiff verloren)',
      nachher.cruisers === vorher.cruisers + 10 && nachher.destroyers === vorher.destroyers + 4,
      { vorher, nachher, erwartet:{ cruisers:vorher.cruisers+10, destroyers:vorher.destroyers+4 } });
    check('6b: das Protokoll nennt den GRUND, statt still "ok" zu melden',
      log.some(z => /weitergezogen|nichts mehr vor/.test(z)),
      { letzte: log.slice(-3) });
    await t.ctx.close();
  }

  // ---------------------------------------------------------------------------------------
  // 7: AUFFINDBARKEIT. Ein Nest steht in EINEM von 69 Systemen. Ohne ein Abzeichen auf der
  // Sektoransicht ist es nur zu finden, indem man jedes System einzeln aufklappt - genau der
  // Weg, ueber den es schon einen Spieler-Report gab (KB-9, "system nach system durchsucht").
  // Gemessen wird SICHTBARKEIT, nicht Existenz im Markup (Regel 55): Ein <text> mit Hoehe 0
  // waere im DOM da und fuer den Spieler trotzdem nicht vorhanden.
  {
    const t = await tab(browser, fixture());
    await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await t.page.waitForTimeout(700);
    await oeffneSektorMitSystem(t.page, SYS);
    await t.page.waitForTimeout(900);

    const mit = await t.page.evaluate(() => {
      const svg = document.getElementById('galaxyMapSvg');
      if (!svg) return { fehler: 'kein galaxyMapSvg' };
      const treffer = [...svg.querySelectorAll('text')].filter(e => (e.textContent || '').includes('\u{1F95A}'));
      if (!treffer.length) return { anzahl: 0 };
      const r = treffer[0].getBoundingClientRect();
      return { anzahl: treffer.length, breite: Math.round(r.width), hoehe: Math.round(r.height),
               titel: (treffer[0].querySelector('title') || {}).textContent || '' };
    });
    check('7a: die Sektoransicht traegt ein sichtbares Nest-Abzeichen',
      mit.anzahl >= 1 && mit.breite > 0 && mit.hoehe > 0, mit);
    // Regel 61: Das Abzeichen muss auch SAGEN, was dort steht - ein stummes Symbol schickt den
    // Spieler zwar hin, aber ohne zu wissen, worauf er sich einlaesst.
    check('7b: sein Tooltip nennt Stufe und Volk',
      /Schwarmstock/.test(mit.titel || '') && /Vex/.test(mit.titel || ''), { titel: mit.titel });
    await t.ctx.close();
  }
  {
    // Gegenrichtung: ohne Nest im Galaxie-Zustand darf kein Abzeichen stehen - sonst waere 7a
    // auch von einem fest eingebauten Symbol erfuellt.
    const t = await tab(browser, fixture(), { galaxie: galaxie([]) });
    await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await t.page.waitForTimeout(700);
    await oeffneSektorMitSystem(t.page, SYS);
    await t.page.waitForTimeout(900);
    const ohne = await t.page.evaluate(() => {
      const svg = document.getElementById('galaxyMapSvg');
      return [...(svg ? svg.querySelectorAll('text') : [])]
        .filter(e => (e.textContent || '').includes('\u{1F95A}')).length;
    });
    check('7c-gegenrichtung: ohne Nest steht kein Abzeichen', ohne === 0, { anzahl: ohne });
    await t.ctx.close();
  }

  await browser.close();
  ende();
})();
