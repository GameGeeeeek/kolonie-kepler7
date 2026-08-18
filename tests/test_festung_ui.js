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
//   6. Zielwahl und Bauteile (Phase 2): Die Zielknöpfe erscheinen nur, wenn die Festung Bauteile
//      führt, ihre FAKTOREN folgen der Konterrolle des Verbands, und die Wahl reist in der Mission
//      mit. Gemessen wird die Wirkung, nicht die Beschriftung (Arbeitsregel 61).
//
// GEGENPROBE (in beide Richtungen ausgeführt, überall dieselbe Anzahl gelaufener Prüfungen = 42):
//   * Ohne Festung im Felddokument: kein Knoten, keine Drosselzeile, volle Ladung (Abschnitt 1b/3c).
//   * Mit einer Kopie, die in abbauPlan den Faktor nicht anwendet, fällt 3a/3b.
//   * Mit einer Kopie, die `plan.ladung` statt `plan.ladungRoh` sendet, fällt 4a.
//   * Mit einer Kopie, in der festungRollenFaktor nur `spec.min` liefert, fallen 6c und 6e
//     (gemessen 0.70 statt 1.60) - 6a/6b/6h bleiben grün, sie prüfen ja nur das Etikett.
//   * Mit einer Kopie, die `ziel:'kern'` fest in die Mission schreibt, fällt 6k.
//   * Mit einer Kopie ohne die Ziel-Zeile auf der Missionskarte fällt 6p.
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
function feld(mitFestung, bauteile){
  const f = { plaetze: { [PLATZ]: { sorte:'urmaterie', groesse:'kern', vorrat:VORRAT } } };
  if (mitFestung){
    f.festung = { id:'fest-1', stufe:'sternenfeste', platz:FEST_PLATZ, sorte:'eisen',
      kernMax:1200000, kern:900000, hort:250000, hortProto:180,
      seit:Date.now(), letzteReifung:Date.now(), beitraege:{}, schlaege:{} };
    /* Die Bauteile kommen wie vom Server: LP-Stand plus Hoechstwert, abgeleitet aus dem Kern
       (anteilKern 0,40 bzw. 0,25 bei 1,2 Mio). Eine Festung OHNE dieses Feld ist eine aus
       Phase 1 - und genau die ist die Gegenrichtung in Abschnitt 6f. */
    if (bauteile) f.festung.bauteile = JSON.parse(JSON.stringify(bauteile));
  }
  return { systeme:[SYS], felder:{ [SYS]: f } };
}
const BAUTEILE_GANZ = { schild: { lp:480000, lpMax:480000 }, tuerme: { lp:300000, lpMax:300000 } };

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

  /* ---- 6) Zielwahl und Bauteile (Phase 2) ----------------------------------------------------
     Gemessen wird die WIRKUNG, nicht die Beschriftung. Der Unterschied ist an diesem Test schon
     einmal teuer gewesen (Arbeitsregel 61): Abschnitt 3 prueefte anfangs nur, dass das Wort
     "gedrosselt" dasteht - die Gegenprobe mit ausgebautem Faktor blieb gruen, weil der Erklaertext
     am Vorhandensein der Festung haengt und nicht an der Rechnung.
     Hier heisst das: Es genuegt nicht, dass drei Zielknoepfe erscheinen. Ihre FAKTOREN muessen
     sich nach der Konterrolle des Verbands unterscheiden, und die Wahl muss in der MISSION
     ankommen. Der Verband besteht dafuer ausschliesslich aus Jaegern (Rolle `abfang`) - damit
     steht der Tuerme-Faktor am oberen Anschlag und der Schild-Faktor am unteren, beide aus der
     Tabelle der Spieldatei abgelesen statt eingetippt. */
  const SPEC = (() => {
    // Die Erwartung kommt aus der TABELLE der Spieldatei, nicht aus dem gerenderten Text - sonst
    // bestaetigte die Pruefung sich selbst (Arbeitsregel 62).
    const v = JS.indexOf('  const FESTUNG_BAUTEILE = {');
    const b = v < 0 ? -1 : JS.indexOf('\n  };', v);
    const kern = (JS.match(/  const FESTUNG_KERN_ROLLE = ([^;]*);/) || [])[1];
    if (v < 0 || b <= v || !kern) return null;
    try {
      return new Function(JS.slice(v, b + 5) + '\nreturn { b: FESTUNG_BAUTEILE, kern: ' + kern + ' };')();
    } catch (e){ return null; }
  })();
  check('6-tabelle: die Bauteil-Tabelle liess sich aus der Spieldatei lesen',
    !!SPEC && !!SPEC.b && !!SPEC.b.schild && !!SPEC.kern, { SPEC });

  function fixtureAbfang(){
    const st = JSON.parse(fixture());
    /* Ein REINER Abfangjaeger-Verband: Der Rollenanteil ist damit 1 fuer `abfang` und 0 fuer alles
       andere - die drei Faktoren muessen sich deshalb maximal unterscheiden. Mit einer gemischten
       Flotte laegen sie dicht beieinander, und die Pruefung koennte nicht mehr zwischen "wirkt"
       und "wirkt nicht" trennen.
       DIE TRAEGER SIND PFLICHT, und das war der erste Fehlschlag dieses Abschnitts: capFighterSelection
       kappt Jaeger auf die Hangar-Kapazitaet der MITGESCHICKTEN Traeger (hangarCapacity: 6 je
       Carrier). Ohne einen einzigen Traeger fiel die Auswahl auf 0 Jaeger zurueck, uebrig blieben
       die Frachter - und alle drei Faktoren standen am unteren Anschlag. Der Test haette dann den
       HANGARDECKEL gemessen statt der Rollenwirkung (Arbeitsregel 7). Der Carrier ist seit der
       Umwidmung vom 02.08.2026 selbst `abfang`, der Verband bleibt also sortenrein. */
    for (const k of Object.keys(st.fleet)){
      if (typeof st.fleet[k] === 'number' && !/^(schuerfschiff|ships)$/.test(k)) st.fleet[k] = 0;
    }
    st.fleet.schuerfschiff = 6;
    st.fleet.jaeger = 80;
    st.fleet.carrier = 20;      // 20 x 6 = 120 Hangarplaetze, die 80 Jaeger passen alle hinein
    return JSON.stringify(st);
  }
  async function angriffOeffnen(t){
    await aufKarte(t);
    await t.page.evaluate(() => {
      const n = document.querySelector('[data-map-festung]');
      if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    });
    await t.page.waitForTimeout(400);
    await t.page.evaluate(() => {
      const btn = [...document.querySelectorAll('.kmenu button, .kmenu .card-row')].find(b => /Festung angreifen/.test(b.textContent));
      if (btn) btn.click();
    });
    await t.page.waitForTimeout(800);
  }
  // Die Knoepfe werden ueber ihre SICHTBARE Flaeche gelesen, nicht ueber ihr Dasein
  // (Arbeitsregel 55) - ein Knopf mit Hoehe 0 ist fuer den Spieler nicht da.
  const zieleLesen = (page) => page.evaluate(() => {
    const ov = document.getElementById('fwahlOverlay');
    if (!ov) return { da:false, knoepfe:[] };
    return {
      da: ov.getBoundingClientRect().height > 0,
      txt: ov.textContent,
      knoepfe: [...ov.querySelectorAll('[data-fest-ziel]')].map(b => {
        const r = b.getBoundingClientRect();
        return { ziel: b.getAttribute('data-fest-ziel'), text: b.textContent.trim(),
                 sichtbar: r.width > 4 && r.height > 4, aktiv: b.classList.contains('primary'),
                 faktor: parseFloat((b.textContent.match(/×\s*([\d.]+)/) || [])[1] || 'NaN') };
      })
    };
  });

  const t6 = await tab(browser, fixtureAbfang(), { feld: feld(true, BAUTEILE_GANZ) });
  await t6.page.waitForTimeout(2500);
  await angriffOeffnen(t6);
  const z = await zieleLesen(t6.page);
  check('6-anker: die Flottenwahl der Festung ist offen', z.da, { da: z.da });
  check('6a: es gibt drei SICHTBARE Zielknöpfe (Kern, Schild, Türme)',
    z.knoepfe.length === 3 && z.knoepfe.every(k => k.sichtbar),
    { knoepfe: z.knoepfe });
  const zk = Object.fromEntries(z.knoepfe.map(k => [k.ziel, k]));
  check('6b: jeder Knopf nennt seinen Faktor',
    !!zk.kern && !!zk.schild && !!zk.tuerme && [zk.kern, zk.schild, zk.tuerme].every(k => isFinite(k.faktor)),
    { knoepfe: z.knoepfe });
  if (SPEC && zk.kern && zk.schild && zk.tuerme){
    /* Das ist die Pruefung der WIRKUNG. Der Verband ist reiner Abfangjaeger-Verband:
         Tuerme  (Rolle abfang)  -> Anteil 1 -> Faktor max
         Schild  (Rolle bomber)  -> Anteil 0 -> Faktor min
         Kern    (Rolle kapital) -> Anteil 0 -> Faktor min
       Waeren die Faktoren fest verdrahtet oder der Rollenanteil kaputt, staenden hier drei
       gleiche Zahlen - und genau das faengt diese Pruefung, waehrend 6a/6b es nicht koennen. */
    check('6c: der Faktor gegen die Türme steht am OBEREN Anschlag (Abfangjäger-Verband)',
      Math.abs(zk.tuerme.faktor - SPEC.b.tuerme.max) < 0.02,
      { gemessen: zk.tuerme.faktor, erwartet: SPEC.b.tuerme.max });
    check('6d: der Faktor gegen die Schildkuppel steht am UNTEREN Anschlag',
      Math.abs(zk.schild.faktor - SPEC.b.schild.min) < 0.02,
      { gemessen: zk.schild.faktor, erwartet: SPEC.b.schild.min });
    check('6e: und die drei Ziele haben WIRKLICH verschiedene Faktoren',
      zk.tuerme.faktor > zk.kern.faktor && zk.tuerme.faktor > zk.schild.faktor,
      { tuerme: zk.tuerme.faktor, kern: zk.kern.faktor, schild: zk.schild.faktor,
        hinweis: 'gleiche Zahlen heissen: der Rollenanteil wirkt nicht' });
  }
  check('6f: die Vorschau nennt die stehenden Bauteile und ihre Wirkung',
    /Schildkuppel/.test(z.txt) && /Geschütztürme/.test(z.txt) && /35 %|35%/.test(z.txt),
    { auszug: (z.txt||'').slice(0, 600) });
  // Die Verlustspanne haengt an den TUERMEN, nicht an der Stufe - solange sie stehen, nennt die
  // Vorschau die hoehere Quote. Eine feste Zahl waere die zweite Anzeigestelle mit der alten
  // Annahme (Pflichtpunkt 6 der Checkliste).
  check('6g: die Verlustspanne nennt die Türme als Grund',
    /Geschütztürme sind der Grund/.test(z.txt), { auszug: (z.txt||'').slice(0, 600) });

  // Ziel wechseln - und messen, dass sich die WIRKSAM-GEGEN-Zeile mitbewegt.
  const vorher = (z.txt.match(/Wirksam gegen dieses Ziel:\s*([^–-]+)/) || [])[1] || '';
  await t6.page.evaluate(() => {
    const b = document.querySelector('#fwahlOverlay [data-fest-ziel="tuerme"]');
    if (b) b.click();
  });
  await t6.page.waitForTimeout(500);
  const z2 = await zieleLesen(t6.page);
  const nachher = (z2.txt.match(/Wirksam gegen dieses Ziel:\s*([^–-]+)/) || [])[1] || '';
  check('6h: der Klick setzt das Ziel um (aktiver Knopf wandert)',
    (z2.knoepfe.find(k => k.ziel === 'tuerme') || {}).aktiv === true &&
    (z2.knoepfe.find(k => k.ziel === 'kern') || {}).aktiv === false,
    { knoepfe: z2.knoepfe });
  check('6i: und die Zeile "Wirksam gegen" nennt eine ANDERE Rolle als vorher',
    !!vorher && !!nachher && vorher.trim() !== nachher.trim(),
    { vorher: vorher.trim(), nachher: nachher.trim() });

  // Und der eigentliche Beweis: Die Wahl reist in der MISSION mit.
  await t6.page.evaluate(() => {
    const b = document.querySelector('#fwahlOverlay [data-fwahl-start]');
    if (b && !b.disabled) b.click();
  });
  await t6.page.waitForTimeout(1500);
  const m6 = ((t6.stand().fleet||{}).missions||[]).find(m => m.type === 'festung-angriff');
  check('6j: der Angriff ist gestartet', !!m6, { missionen: ((t6.stand().fleet||{}).missions||[]).map(m=>m.type) });
  check('6k: und die Mission trägt das GEWÄHLTE Ziel',
    !!m6 && m6.ziel === 'tuerme', { ziel: m6 && m6.ziel });
  /* Die Missionskarte muss das Ziel NENNEN. Es ist beim Start festgelegt und nicht mehr
     aenderbar - eine Karte, die es verschweigt, laesst den Spieler im Unklaren, worauf sein
     Verband gleich schiesst. Gemessen wird der gerenderte Text, nicht das Feld im Spielstand. */
  await t6.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="flotte"]'); if (x) x.click(); });
  await t6.page.waitForTimeout(1400);
  const karte6 = await t6.page.evaluate(() => {
    const b = document.getElementById('missionsActive');
    return b ? b.textContent : '';
  });
  check('6p: die Missionskarte nennt das gewählte Ziel',
    /Ziel:\s*Geschütztürme/.test(karte6), { auszug: (karte6||'').slice(0, 300) });
  await t6.ctx.close();

  // ---- 6l) Gegenrichtung: eine Festung aus Phase 1 hat keine Bauteile -------------------------
  const t7 = await tab(browser, fixtureAbfang(), { feld: feld(true) });
  await t7.page.waitForTimeout(2500);
  await angriffOeffnen(t7);
  const z7 = await zieleLesen(t7.page);
  check('6l-anker: auch ohne Bauteile öffnet die Flottenwahl', z7.da, { da: z7.da });
  check('6l: ohne Bauteile gibt es KEINE Zielwahl - und keinen leeren Abschnitt',
    z7.knoepfe.length === 0 && !/Ziel wählen/.test(z7.txt || ''),
    { knoepfe: z7.knoepfe.length, hatUeberschrift: /Ziel wählen/.test(z7.txt || '') });
  check('6m: dann nennt die Verlustspanne die Stufe statt der Türme',
    !/Geschütztürme sind der Grund/.test(z7.txt || '') && /Verlusten des Verbands/.test(z7.txt || ''),
    { auszug: (z7.txt||'').slice(0, 400) });
  await t7.ctx.close();

  // ---- 6n) Ein zerstörtes Bauteil ist kein Ziel mehr ------------------------------------------
  const t8 = await tab(browser, fixtureAbfang(),
    { feld: feld(true, { schild: { lp:0, lpMax:480000 }, tuerme: { lp:300000, lpMax:300000 } }) });
  await t8.page.waitForTimeout(2500);
  await angriffOeffnen(t8);
  const z8 = await zieleLesen(t8.page);
  check('6n: das zerstörte Schild steht nicht mehr zur Wahl',
    z8.knoepfe.length === 2 && !z8.knoepfe.some(k => k.ziel === 'schild'),
    { knoepfe: z8.knoepfe });
  check('6o: es wird aber weiterhin als zerstört AUSGEWIESEN - nicht stillschweigend verschwiegen',
    /Schildkuppel/.test(z8.txt || '') && /zerstört/.test(z8.txt || ''),
    { auszug: (z8.txt||'').slice(0, 600) });
  await t8.ctx.close();

  await browser.close();
  ende();
})();
