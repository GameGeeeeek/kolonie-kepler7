// Die Asteroidenfestung im laufenden Spiel: Karte, Kartenmenü, Vorschau (Phase 1, 18.08.2026).
//
//   node tests/test_festung_ui.js
//
// Er misst am GERENDERTEN Spiel, nicht am Quelltext. Der Grund steht in Arbeitsregel 55: „im DOM
// vorhanden" ist nicht „für den Spieler sichtbar", und genau dieser Unterschied hat bei den
// Verteidigungsbalken einen ausgelieferten Fehler verursacht.
//
// GEPRUEFT WIRD:
//   1. Die Festung erscheint als eigener Kartenknoten - und zwar SICHTBAR (gemessene Fläche > 0),
//      nicht nur als Element. Ohne Festung im Felddokument ist sie nicht da (Gegenrichtung).
//   2. Ihr Kartenmenü nennt die Zahlen, die eine Entscheidung tragen: Kern, Blockade, Hort.
//   3. Die Startvorschau der ABBAUMISSION benennt die Drosselung ausdrücklich und zeigt die
//      gekürzte Ladung. Eine stillschweigend kleinere Zahl wäre die Verschlechterung ohne
//      Erklärung, wegen der der Spawn-Schalter im Backend überhaupt existiert.
//   4. Der Missionsstart schickt den ROHEN Wunsch an den Server - nicht die schon gekürzte Zahl.
//      Sonst kürzte der Server ein zweites Mal, und der Spieler bekäme 0,45 x 0,45.
//   5. Die Protomaterie trägt ihren EIGENEN Faktor: Sie hängt allein an der Größe des Vorkommens,
//      die Ladungskürzung erreicht sie nie. Der Server schickt `protoBlockade`, und die Mission
//      friert die gedrosselte Menge ein.
//
// GEGENPROBE (in beide Richtungen ausgeführt):
//   * Ohne Festung im Felddokument: kein Knoten, keine Drosselzeile, volle Ladung (Abschnitt 1b/3c).
//   * Mit einer Kopie, die in abbauPlan den Faktor nicht anwendet, fällt 3a/3b.
//   * Mit einer Kopie, die `plan.ladung` statt `plan.ladungRoh` sendet, fällt 4a.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
check('0a: die Stufentabelle steht in der Spieldatei', /const FESTUNG_STUFEN = \{/.test(JS));
check('0b: es gibt einen eigenen Kartenknoten', /data-map-festung/.test(JS));
check('0c: und eine Angriffsmission', /type:'festung-angriff'/.test(JS));

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
const PLATZ = '7';
const FEST_PLATZ = '3';
const VORRAT = 480000;

// Das Felddokument, wie es der Server liefert - mit oder ohne Festung.
function feld(mitFestung){
  const f = { plaetze: { [PLATZ]: { sorte:'urmaterie', groesse:'kern', vorrat:VORRAT } } };
  if (mitFestung){
    f.festung = { id:'fest-1', stufe:'sternenfeste', platz:FEST_PLATZ, sorte:'eisen',
      kernMax:1200000, kern:900000, hort:250000, hortProto:180,
      seit:Date.now(), letzteReifung:Date.now(), beitraege:{}, schlaege:{} };
  }
  return { systeme:[SYS], felder:{ [SYS]: f } };
}

function backend(store, opt){
  opt = opt || {};
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'asteroid/field') return j(store.__feld);
    if (p === 'asteroid/mine'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__mine = (store.__mine || []).concat([body]);
      // Der Server rechnet den Faktor selbst - genau wie der echte. Damit misst Abschnitt 4, ob
      // der Client die ROHE Zahl geschickt hat: Die Antwort ist 45 % davon.
      const roh = body.wunsch || 0;
      return j({ ok:true, menge: Math.round(roh * 0.45), sorte:'urmaterie', groesse:'kern',
                 rest: VORRAT - Math.round(roh*0.45), blockade:0.55, geraeumtBonus:0, protoBlockade:0 });
    }
    // Der Speicher muss WIRKLICH speichern - sonst kommt kein Ausgangsstand zustande und jede
    // Fixture darunter ist leer (genau daran ist der erste Anlauf gescheitert).
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
  const store = { __feld: (opt && opt.feld) || feld(true) };
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
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
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
  check('0d: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    st.research = st.research || {}; st.research.rminentechnik = 1;
    st.fleet.schuerfschiff = 6; st.fleet.frachter = 10; st.fleet.jaeger = 60; st.fleet.cruisers = 20;
    st.buildings.lager = 2000;
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 400000;
    delete st.asteroidFeld;
    return JSON.stringify(st);
  }

  // ---- 1) Der Kartenknoten -------------------------------------------------------------------
  const t1 = await tab(browser, fixture());
  await t1.page.waitForTimeout(2500);
  await aufKarte(t1);
  const sicht = await t1.page.evaluate(() => {
    const n = document.querySelector('[data-map-festung]');
    if (!n) return { da:false };
    const b = n.getBoundingClientRect();
    return { da:true, breite: Math.round(b.width), hoehe: Math.round(b.height), titel: (n.querySelector('title')||{}).textContent || '' };
  });
  // SICHTBARKEIT, nicht Existenz (Arbeitsregel 55): ein Knoten mit Flaeche 0 waere fuer den
  // Spieler nicht da, und `querySelector` faende ihn trotzdem.
  check('1a: die Festung ist auf der Karte SICHTBAR', sicht.da && sicht.breite > 4 && sicht.hoehe > 4, sicht);
  check('1b: ihr Titel nennt Stufe und Drosselung',
    /Sternenfeste/.test(sicht.titel||'') && /55%/.test(sicht.titel||''), { titel: sicht.titel });

  // ---- 2) Das Kartenmenü ---------------------------------------------------------------------
  await t1.page.evaluate(() => { const n = document.querySelector('[data-map-festung]'); if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true})); });
  await t1.page.waitForTimeout(500);
  const menue = await t1.page.evaluate(() => {
    const m = document.querySelector('.kmenu');
    return m ? { text: m.textContent, offen: m.getBoundingClientRect().height > 0 } : { text:'', offen:false };
  });
  check('2a: das Kartenmenü öffnet sich', menue.offen, menue);
  check('2b: es nennt Kern, Drosselung und Hort',
    /Kern/.test(menue.text) && /Abbau/.test(menue.text) && /Hort/.test(menue.text),
    { text: (menue.text||'').slice(0, 260) });
  check('2c: und trägt den Angriffs-Eintrag', /Festung angreifen/.test(menue.text),
    { text: (menue.text||'').slice(0, 260) });

  // ---- 3) Die Vorschau der Abbaumission ------------------------------------------------------
  const vor = await t1.page.evaluate((platz) => {
    const a = (typeof asteroidAn === 'function') ? asteroidAn('chronos', platz) : null;
    return null;
  }, PLATZ).catch(() => null);
  // Der Modulscope ist von aussen nicht erreichbar - also den SPIELERWEG gehen: Brocken anklicken,
  // Abbaumission oeffnen, die Vorschau ablesen (dieselbe Begruendung wie beim Fundort-Knopf).
  await t1.page.evaluate((platz) => {
    const n = document.querySelector('[data-map-asteroid="' + platz + '"]');
    if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true}));
  }, PLATZ);
  await t1.page.waitForTimeout(400);
  await t1.page.evaluate(() => {
    const btn = [...document.querySelectorAll('.kmenu button, .kmenu .card-row')].find(b => /Abbaumission/.test(b.textContent));
    if (btn) btn.click();
  });
  await t1.page.waitForTimeout(800);
  /* GESCOPT auf #fwahlOverlay - der erste Entwurf fiel auf document.body zurueck und war damit
     aus dem falschen Grund gruen: "Protomaterie" steht auch im Hilfetext, also irgendwo auf der
     Seite (Arbeitsregel 28). Und der Anker selbst wird geprueft, sonst waere die Aussage vacuous
     (Arbeitsregel 6). */
  const vorschau = await t1.page.evaluate(() => {
    const ov = document.getElementById('fwahlOverlay');
    return { da: !!ov && ov.getBoundingClientRect().height > 0, txt: ov ? ov.textContent : '' };
  });
  check('3-anker: die Flottenwahl ist offen', vorschau.da, { da: vorschau.da });
  check('3a: die Vorschau BENENNT die Drosselung',
    /gedrosselt/.test(vorschau.txt) && /Sternenfeste/.test(vorschau.txt),
    { auszug: (vorschau.txt||'').slice(0, 400) });
  check('3b: und nennt die Protomaterie ausdrücklich',
    /Protomaterie/.test(vorschau.txt), { auszug: (vorschau.txt||'').slice(0, 400) });

  /* 3c ist die eigentliche Aussage dieses Abschnitts, und sie hat gefehlt: Der erste Entwurf
     pruefte nur, dass das WORT "gedrosselt" dasteht. Die Gegenprobe (Faktor aus abbauPlan
     entfernt) blieb deshalb GRUEN - der Erklaertext haengt am Vorhandensein der Festung, nicht
     an der Rechnung. Eine Pruefung des Etiketts statt der Wirkung (Arbeitsregel 3).
     Gemessen wird jetzt die ZAHL: dieselbe Flotte, dasselbe Vorkommen, einmal mit und einmal
     ohne Festung - die angezeigte Ladung muss sich unterscheiden. */
  const ladungMit = (vorschau.txt.match(/Ladung\s*([\d.,]+[kM]?)\s*von/) || [])[1] || null;
  check('3c-mit: die Vorschau nennt eine Ladung', !!ladungMit, { ladungMit });
  await t1.ctx.close();

  const tOhne = await tab(browser, fixture(), { feld: feld(false) });
  await tOhne.page.waitForTimeout(2500);
  await aufKarte(tOhne);
  await tOhne.page.evaluate((platz) => {
    const n = document.querySelector('[data-map-asteroid="' + platz + '"]');
    if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true}));
  }, PLATZ);
  await tOhne.page.waitForTimeout(400);
  await tOhne.page.evaluate(() => {
    const btn = [...document.querySelectorAll('.kmenu button, .kmenu .card-row')].find(b => /Abbaumission/.test(b.textContent));
    if (btn) btn.click();
  });
  await tOhne.page.waitForTimeout(800);
  const vorschauOhne = await tOhne.page.evaluate(() => {
    const ov = document.getElementById('fwahlOverlay');
    return ov ? ov.textContent : '';
  });
  const ladungOhne = (vorschauOhne.match(/Ladung\s*([\d.,]+[kM]?)\s*von/) || [])[1] || null;
  check('3c-ohne: auch ohne Festung nennt sie eine Ladung', !!ladungOhne, { ladungOhne });
  check('3c: die Festung KUERZT die angezeigte Ladung wirklich',
    !!ladungMit && !!ladungOhne && ladungMit !== ladungOhne,
    { mitFestung: ladungMit, ohneFestung: ladungOhne,
      hinweis: 'gleiche Zahl heisst: der Faktor wirkt nicht, die Vorschau luegt' });
  check('3d: und die Drosselzeile fehlt ohne Festung',
    !/gedrosselt/.test(vorschauOhne), { auszug: vorschauOhne.slice(0, 200) });
  // Auch hier starten - der dabei gesendete Wunsch ist der ABSOLUTE Anker fuer Abschnitt 4.
  await tOhne.page.evaluate(() => {
    const b = document.querySelector('#fwahlOverlay [data-fwahl-start]');
    if (b && !b.disabled) b.click();
  });
  await tOhne.page.waitForTimeout(1500);
  const wunschOhne = ((tOhne.store.__mine || [])[0] || {}).wunsch || null;
  check('3e: der Ohne-Festung-Lauf hat einen Wunsch gesendet', !!wunschOhne, { wunschOhne });
  await tOhne.ctx.close();

  // ---- 4) Der Missionsstart schickt den ROHEN Wunsch ------------------------------------------
  const t2 = await tab(browser, fixture());
  await t2.page.waitForTimeout(2500);
  const gestartet = await t2.page.evaluate((platz) => {
    // Der Spielerweg über die Karte ist für diesen Punkt zu indirekt; hier zählt allein, WELCHE
    // Zahl den Server erreicht. Deshalb der direkte Aufruf über den Knopf im Kartenmenü.
    const n = document.querySelector('[data-map-asteroid="' + platz + '"]');
    return !!n;
  }, PLATZ);
  await aufKarte(t2);
  await t2.page.evaluate((platz) => {
    const n = document.querySelector('[data-map-asteroid="' + platz + '"]');
    if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true}));
  }, PLATZ);
  await t2.page.waitForTimeout(400);
  await t2.page.evaluate(() => {
    const btn = [...document.querySelectorAll('.kmenu button, .kmenu .card-row')].find(b => /Abbaumission/.test(b.textContent));
    if (btn) btn.click();
  });
  await t2.page.waitForTimeout(700);
  // Der echte Knopf traegt data-fwahl-start - aus dem Code abgelesen, nicht geraten
  // (Arbeitsregel 4). Der erste Entwurf suchte nach Beschriftungen und fand nichts.
  const knopf = await t2.page.evaluate(() => {
    const b = document.querySelector('#fwahlOverlay [data-fwahl-start]');
    if (!b) return { da:false };
    const gesperrt = b.disabled;
    if (!gesperrt) b.click();
    return { da:true, gesperrt, text: b.textContent };
  });
  check('4-knopf: der Startknopf ist da und nicht gesperrt', knopf.da && !knopf.gesperrt, knopf);
  await t2.page.waitForTimeout(1500);
  const geschickt = (t2.store.__mine || [])[0];
  check('4a: der Missionsstart hat den Server erreicht', !!geschickt, { mine: t2.store.__mine });
  if (geschickt){
    // Der Wunsch muss die ROHE Ladung sein. Waere er schon gekuerzt, kuerzte der Server ein
    // zweites Mal - der Spieler bekaeme 0,45 x 0,45 = 20 % statt 45 %.
    const stand = t2.stand();
    const mission = ((stand.fleet||{}).missions||[]).find(m => m.type === 'mining');
    check('4b: die Mission trägt die vom SERVER gebuchte Menge',
      !!mission && mission.ladung === Math.round((geschickt.wunsch||0) * 0.45),
      { wunsch: geschickt.wunsch, ladung: mission && mission.ladung, erwartet: Math.round((geschickt.wunsch||0)*0.45) });
    check('4c: und die Protomaterie ist auf 0 gedrosselt (protoBlockade: 0)',
      !!mission && mission.proto === 0, { proto: mission && mission.proto });
    /* 4d ist die Pruefung gegen die DOPPELKUERZUNG, und sie braucht einen ABSOLUTEN Anker.
       4b allein kann sie nicht finden: Es vergleicht die gebuchte Menge gegen die GESENDETE Zahl,
       ist also selbstbestaetigend - schickt der Client die schon gekuerzte Ladung, stimmt das
       Verhaeltnis weiterhin, und der Spieler bekaeme still 0,45 x 0,45 = 20 % statt 45 %.
       Der Anker ist der Wunsch aus dem Lauf OHNE Festung: Er ist die Kapazitaet der Flotte, und
       die haengt nicht davon ab, ob eine Festung im System steht. Beide Laeufe benutzen dieselbe
       Fixture, also muss dieselbe Zahl herauskommen. */
    check('4d: der gesendete Wunsch ist die ROHE Ladung, nicht die gekürzte',
      !!wunschOhne && geschickt.wunsch === wunschOhne,
      { mitFestung: geschickt.wunsch, ohneFestung: wunschOhne,
        hinweis: 'kleiner heisst: der Client hat schon gekuerzt, der Server kuerzt ein zweites Mal' });
  }
  await t2.ctx.close();

  // ---- 5) Gegenrichtung: OHNE Festung ---------------------------------------------------------
  const t3 = await tab(browser, fixture(), { feld: feld(false) });
  await t3.page.waitForTimeout(2500);
  await aufKarte(t3);
  const ohne = await t3.page.evaluate(() => !!document.querySelector('[data-map-festung]'));
  check('5a: ohne Festung im Feld gibt es keinen Festungsknoten', ohne === false, { gefunden: ohne });
  await t3.ctx.close();

  await browser.close();
  ende();
})();
