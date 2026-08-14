// Das geteilte Asteroidenfeld auf der Client-Seite (v8.487.0, Konzept Phase 4, Schritt 1).
//
// WAS HIER AUF DEM SPIEL STEHT: Ab jetzt führt der SERVER den Vorrat - alle Spieler sehen dieselben
// Brocken. Zwei Dinge dürfen dabei nicht schiefgehen, und beide sind hier festgehalten:
//   (a) Sobald der Server liefert, gehört ihm das Feld. Der Client darf nichts dazuerfinden, sonst
//       stehen Brocken auf der Karte, die es nirgends gibt.
//   (b) Wenn der Server NICHT liefert - etwa weil das Frontend vor dem Backend live geht, und die
//       beiden Repos werden unabhängig ausgeliefert -, muss der Bergbau trotzdem funktionieren.
//       Genau das war die erste Fassung nicht: Sie hätte bei fehlendem Endpunkt den kompletten
//       Gürtel geleert.
//
// GEPRUEFT WIRD:
//   1. Liefert der Server ein Feld, zeigt die Karte SEINS - erkennbar an einem System, das der
//      lokale Erzeuger nie so belegt hätte, und nur an den Plätzen, die der Server nennt.
//   2. Der Missionsstart ruft /api/asteroid/mine, schickt System, Platz und Wunschmenge - und die
//      Mission friert die Menge des SERVERS ein, nicht die eigene Vorschau.
//   3. Lehnt der Server ab (jemand war schneller), startet KEINE Mission, es wird KEIN Treibstoff
//      gezahlt, und die Karte wird neu geholt.
//   4. Antwortet der Endpunkt gar nicht (404, altes Backend), läuft alles lokal weiter - Feld da,
//      Mission startbar. Das ist die Rückfallebene, und sie ist der eigentliche Grund für den
//      Umweg über _astFeldVomServer.
//
// GEGENPROBE (Arbeitsregel 1, in BEIDE Richtungen ausgeführt):
//   - Am alten Stand (v8.486.0) gibt es kein ladeAsteroidfeld: 0a fällt.
//   - Nimmt man den mine-Aufruf aus sendMiningMission heraus und entnimmt wieder lokal, fällt 2b
//     (die Mission trägt die eigene Vorschaumenge statt der Server-Antwort) und 3.
//   - Lässt man asteroidFeldSicherstellen() auch nach der Server-Antwort lokal erzeugen, fällt 1c
//     (zusätzliche Brocken in Systemen, die der Server gar nicht führt).
//   - Für Abschnitt 6 (Schürfrechte, v8.489.0): Am Stand v8.488.0 fallen 6a-6g geschlossen, und 6b
//     zeigt dabei die Lücke, die die UI schließt - das fremd reservierte Vorkommen bot dort
//     freundlich "Öffnet die Flottenwahl" an.
//   - Für Abschnitt 7 (v8.490.0, Spieler-Report Sascha): Am Stand v8.489.0 fallen BEIDE - 7a
//     findet useBackend() nicht in asteroidFeldGeteilt(), und 7b findet keine eigene Formulierung
//     im Protokoll, weil das Spiel dort die Serverantwort ungefiltert weiterreicht (gemessen:
//     im Protokoll steht die Meldung gar nicht, sie geht als Toast raus - in beiden Faellen
//     bekommt der Spieler den Servertext statt einer Auskunft).
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
check('0a: der Ladeweg für das geteilte Feld steht in der Spieldatei',
  /async function ladeAsteroidfeld\(/.test(JS) && /_astFeldVomServer/.test(JS));
check('0b: der Missionsstart kennt den mine-Endpunkt', /'\/asteroid\/mine'/.test(JS));

const SAVE_KEY = 'kepler7-save-v3';
// Ein Feld, das der lokale Erzeuger so nie bauen würde: EIN System, EIN Platz, und der liegt auf
// Platz 7. Damit ist an der Karte eindeutig ablesbar, wessen Feld gezeigt wird.
const SERVER_SYSTEM = 'chronos';
const SERVER_PLATZ = '7';
const SERVER_VORRAT = 480000;
function serverFeld(vorrat){
  return { systeme: [SERVER_SYSTEM], felder: { [SERVER_SYSTEM]: { plaetze: {
    [SERVER_PLATZ]: { sorte: 'kometenkern', groesse: 'kern', vorrat: vorrat === undefined ? SERVER_VORRAT : vorrat }
  } } } };
}

function backend(store, opt){
  opt = opt || {};
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'asteroid/field'){
      store.__feldAbrufe = (store.__feldAbrufe || 0) + 1;
      if (opt.feld404) return j({ error:'Cannot GET' }, 404);
      return j(store.__feld || serverFeld());
    }
    if (p === 'asteroid/mine'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__mineAufrufe = (store.__mineAufrufe || 0).valueOf();
      store.__mine = (store.__mine || []).concat([body]);
      if (opt.mine404) return j({ error:'Cannot POST' }, 404);
      if (opt.mineAbgelehnt) return j({ error:'Dieses Vorkommen ist nicht mehr da.', weg:true }, 409);
      // Der Server gibt bewusst WENIGER als gewünscht - so lässt sich prüfen, wessen Zahl die
      // Mission einfriert.
      const menge = Math.floor((body.wunsch || 0) / 2);
      const rest = Math.max(0, SERVER_VORRAT - menge);
      store.__feld = serverFeld(rest);
      return j({ ok:true, menge, sorte:'kometenkern', groesse:'kern', rest });
    }
    // Schürfrechte (v8.489.0): der Mock spielt den echten Server nach - Halter ist der angemeldete
    // Nutzer 'u' (siehe /me oben), ein fremd reservierter Platz lehnt mit 409 und Namen ab.
    if (p === 'asteroid/claim'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__claims = (store.__claims || []).concat([body]);
      if (opt.claim404) return j({ error:'Cannot POST' }, 404);
      if (opt.claim401) return j({ error:'Nicht angemeldet.' }, 401);
      const feld = store.__feld || serverFeld();
      const vork = feld.felder[body.system] && feld.felder[body.system].plaetze[String(body.platz)];
      if (!vork || vork.frei) return j({ error:'Dieses Vorkommen ist nicht mehr da.', weg:true }, 409);
      if (vork.halter && vork.halter !== 'u') return j({ error:'Bereits reserviert von ' + (vork.halterName||'?') + '.' }, 409);
      Object.assign(vork, { halter:'u', halterName:'A', tag:'', seit:1, eskorte:{} });
      store.__feld = feld;
      return j({ ok:true, halter:'u', halterName:'A', tag:'', seit:1, eskorte:{} });
    }
    if (p === 'asteroid/contest'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__contests = (store.__contests || []).concat([body]);
      if (opt.contest403) return j({ error: 'Dieses Vorkommen steht noch unter Schutz.', schutz: true }, 403);
      // Sieg mit Verlusten: so laesst sich pruefen, dass der Client GENAU die Verluste des Servers
      // bucht und nicht seine eigene Rechnung.
      return j({ ok: true, gewonnen: true, chance: 0.9, halterVorher: 'Rivale',
        eigeneVerluste: { cruisers: 4 }, gegnerVerluste: { jaeger: 10 },
        halter: 'u', halterName: 'A', schutzBis: Date.now() + 7200000 });
    }
    if (p === 'asteroid/release'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__releases = (store.__releases || []).concat([body]);
      const feld = store.__feld || serverFeld();
      const vork = feld.felder[body.system] && feld.felder[body.system].plaetze[String(body.platz)];
      if (vork){ delete vork.halter; delete vork.halterName; delete vork.tag; delete vork.seit; delete vork.eskorte; store.__feld = feld; }
      return j({ ok:true });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    // Das Postfach. Der echte Server rechnet 'ziel' erst beim Ausliefern aus (notificationTarget),
    // deshalb steht es hier auch nicht in den Fixture-Eintraegen.
    if (p === 'notifications'){
      if (req.method() === 'POST') return j({ ok:true });
      return j({ notifications: (store.__meldungen || []).map(n => Object.assign({ ziel:'karte' }, n)) });
    }
    if (p === 'reports'){
      if (req.method() === 'POST'){ try { store.__berichte.unshift(JSON.parse(req.postData()||'{}').report || {}); } catch(e){} return j({ ok:true }); }
      return j({ reports: store.__berichte });
    }
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

async function tab(browser, startSave, opt){
  const store = { __berichte: [] };
  if (opt && opt.feldInit) store.__feld = opt.feldInit;   // VOR dem Boot setzen - der erste Feld-Abruf laeuft schon beim Laden
  if (startSave) store[SAVE_KEY] = startSave;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
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
async function aufKarte(t, sysId){
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t.page.waitForTimeout(700);
  await t.page.evaluate(id => { const n = document.querySelector('[data-system-node="' + id + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); }, sysId);
  await t.page.waitForTimeout(1200);
}
async function marker(t){
  return t.page.evaluate(() => [...document.querySelectorAll('[data-map-asteroid]')].map(n => n.getAttribute('data-map-asteroid')));
}

(async () => {
  const browser = await starteBrowser();

  // Ausgangsstand vom Spiel selbst (Arbeitsregel 4)
  const roh = await tab(browser);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0c: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    st.research = st.research || {}; st.research.rminentechnik = 1;
    st.fleet.schuerfschiff = 6; st.fleet.frachter = 10; st.fleet.jaeger = 60; st.fleet.cruisers = 20;
    st.buildings.lager = 2000;
    for (const g of ['solar','mine','raffinerie','synth','fusionsreaktor','labor']) st.buildings[g] = 0;
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 40000;
    // Das Feld aus dem Ausgangsstand entfernen: Der stammt aus einem Lauf MIT Server und trägt
    // deshalb dessen eine System. Als Startpunkt wäre das eine stille Vorbelegung - Lauf 4 soll
    // messen, was der lokale Erzeuger tut, nicht was ein früherer Lauf hinterlassen hat.
    delete st.asteroidFeld;
    return JSON.stringify(st);
  }

  // ---- 1) Das Feld des Servers gewinnt ------------------------------------------------------
  const t1 = await tab(browser, fixture());
  await t1.page.waitForTimeout(2500);           // erster Abruf läuft im Haupt-Tick
  check('1a: der Client hat das Feld beim Server geholt', (t1.store.__feldAbrufe || 0) >= 1, t1.store.__feldAbrufe);
  await aufKarte(t1, SERVER_SYSTEM);
  const m1 = await marker(t1);
  check('1b: genau der eine Brocken des Servers steht auf der Karte',
    m1.length === 1 && m1[0] === SERVER_PLATZ, m1);
  // Auf einen echten Save warten, bevor der Spielstand gelesen wird: Bis das Spiel selbst
  // speichert, hält der Mock die Fixture - man misst sonst den eigenen Ausgangsstand.
  const fixture1 = t1.store[SAVE_KEY];
  for (let i = 0; i < 40 && t1.store[SAVE_KEY] === fixture1; i++) await t1.page.waitForTimeout(500);
  const standNach = t1.stand();
  const systeme = Object.keys(standNach.asteroidFeld || {});
  check('1c: der Client hat KEINE eigenen Systeme dazuerfunden',
    systeme.length === 1 && systeme[0] === SERVER_SYSTEM, systeme);

  // ---- 2) Der Missionsstart geht über den Server ---------------------------------------------
  await t1.page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, SERVER_PLATZ);
  await t1.page.waitForTimeout(400);
  await t1.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Abbaumission/.test(y.textContent)); if (x) x.click(); });
  await t1.page.waitForTimeout(700);
  const vorschau = await t1.page.evaluate(() => { const o = document.querySelector('#fwahlOverlay.open'); return o ? o.innerText : ''; });
  check('2-0: die Flottenwahl steht offen', /Abbaumission starten/.test(vorschau));
  const erzVorher = t1.stand().resources.deuterium;
  await t1.page.evaluate(() => { const x = [...document.querySelectorAll('#fwahlOverlay button')].find(y => /Abbaumission starten/.test(y.textContent)); if (x) x.click(); });
  await t1.page.waitForTimeout(2500);
  const anfragen = t1.store.__mine || [];
  check('2a: der Start hat /api/asteroid/mine gerufen - mit System, Platz und Wunschmenge',
    anfragen.length === 1 && anfragen[0].system === SERVER_SYSTEM && String(anfragen[0].platz) === SERVER_PLATZ && anfragen[0].wunsch > 0,
    anfragen[0]);
  const mission = (t1.stand().fleet.missions || []).find(m => m.type === 'mining');
  const serverMenge = Math.floor((anfragen[0] ? anfragen[0].wunsch : 0) / 2);
  check('2b: die Mission friert die Menge des SERVERS ein, nicht die eigene Vorschau',
    !!mission && mission.ladung === serverMenge && serverMenge < (anfragen[0] || {}).wunsch,
    { ladung: mission && mission.ladung, serverMenge, gewuenscht: (anfragen[0] || {}).wunsch });
  await t1.ctx.close();

  // ---- 3) Der Server lehnt ab: nichts startet, nichts wird gezahlt ---------------------------
  const t2 = await tab(browser, fixture(), { mineAbgelehnt: true });
  await t2.page.waitForTimeout(2500);
  await aufKarte(t2, SERVER_SYSTEM);
  await t2.page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, SERVER_PLATZ);
  await t2.page.waitForTimeout(400);
  await t2.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Abbaumission/.test(y.textContent)); if (x) x.click(); });
  await t2.page.waitForTimeout(700);
  const deutVorher = t2.stand().resources.deuterium;
  const abrufeVorher = t2.store.__feldAbrufe || 0;
  await t2.page.evaluate(() => { const x = [...document.querySelectorAll('#fwahlOverlay button')].find(y => /Abbaumission starten/.test(y.textContent)); if (x) x.click(); });
  await t2.page.waitForTimeout(2500);
  const stand2 = t2.stand();
  check('3a: keine Mission gestartet', !(stand2.fleet.missions || []).some(m => m.type === 'mining'),
    (stand2.fleet.missions || []).map(m => m.type));
  check('3b: kein Treibstoff gezahlt', (stand2.resources.deuterium || 0) >= deutVorher - 1,
    { vorher: deutVorher, nachher: stand2.resources.deuterium });
  check('3c: die Karte wurde sofort neu geholt', (t2.store.__feldAbrufe || 0) > abrufeVorher,
    { vorher: abrufeVorher, nachher: t2.store.__feldAbrufe });
  await t2.ctx.close();

  // ---- 4) Rückfallebene: der Endpunkt fehlt (altes Backend) ----------------------------------
  const t3 = await tab(browser, fixture(), { feld404: true, mine404: true });
  // Auf einen echten Save warten: Bis das Spiel selbst speichert, hält der Mock die Fixture - und
  // dann misst man seinen eigenen Ausgangsstand statt des Ergebnisses.
  const fixtureText = t3.store[SAVE_KEY];
  for (let i = 0; i < 40 && t3.store[SAVE_KEY] === fixtureText; i++) await t3.page.waitForTimeout(500);
  const stand3 = t3.stand();
  const sys3 = Object.keys(stand3.asteroidFeld || {});
  check('4a: ohne Endpunkt entsteht das Feld weiterhin lokal - der Gürtel ist NICHT leer',
    sys3.length >= 15, sys3.length);
  const zielSys = sys3.find(x => Object.values(stand3.asteroidFeld[x].plaetze).some(p => p && !p.frei));
  await aufKarte(t3, zielSys);
  const m3 = await marker(t3);
  check('4b: und die Brocken sind auf der Karte anklickbar', m3.length >= 1, { zielSys, marker: m3.length });
  const platz3 = m3[0];
  await t3.page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, platz3);
  await t3.page.waitForTimeout(400);
  await t3.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Abbaumission/.test(y.textContent)); if (x) x.click(); });
  await t3.page.waitForTimeout(700);
  await t3.page.evaluate(() => { const x = [...document.querySelectorAll('#fwahlOverlay button')].find(y => /Abbaumission starten/.test(y.textContent)); if (x) x.click(); });
  await t3.page.waitForTimeout(2500);
  const mission3 = (t3.stand().fleet.missions || []).find(m => m.type === 'mining');
  check('4c: eine Abbaumission startet auch ohne Server-Endpunkt', !!mission3 && mission3.ladung > 0,
    mission3 ? { ladung: mission3.ladung } : null);
  check('4d: und der mine-Endpunkt wurde dabei GAR NICHT gerufen - lokal entnommen',
    (t3.store.__mine || []).length === 0, (t3.store.__mine || []).length);

  // ---- 6) Schürfrechte (v8.489.0): fremd gesperrt, eigenes anmelden und aufgeben --------------
  // Feld mit ZWEI Plätzen: 7 frei, 3 von 'Rivale' reserviert und mit Eskorte bewacht.
  const t4 = await tab(browser, fixture(), { feldInit: { systeme: [SERVER_SYSTEM], felder: { [SERVER_SYSTEM]: { plaetze: {
    [SERVER_PLATZ]: { sorte: 'kometenkern', groesse: 'kern', vorrat: SERVER_VORRAT },
    '3': { sorte: 'eisen', groesse: 'brocken', vorrat: 90000,
           halter: 'x2', halterName: 'Rivale', tag: 'RIV', seit: 1, eskorte: { jaeger: 10 } }
  } } } } });
  await t4.page.waitForTimeout(2500);
  await aufKarte(t4, SERVER_SYSTEM);
  const ringe = await t4.page.evaluate(() => [...document.querySelectorAll('[data-map-asteroid]')]
    .map(n => ({ platz: n.getAttribute('data-map-asteroid'), fremdRing: n.innerHTML.includes('#e0667a'), eigenRing: n.innerHTML.includes('#5dcaa5') })));
  const fremdMarker = ringe.find(r => r.platz === '3'), freiMarker = ringe.find(r => r.platz === SERVER_PLATZ);
  check('6a: das fremde Recht trägt einen roten Ring, das freie Vorkommen keinen',
    !!fremdMarker && fremdMarker.fremdRing && !!freiMarker && !freiMarker.fremdRing && !freiMarker.eigenRing, ringe);

  const menuAuf = async (platz) => {
    await t4.page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, platz);
    await t4.page.waitForTimeout(400);
    return t4.page.evaluate(() => {
      const m = document.querySelector('.kmenu');
      if (!m) return null;
      return { text: m.innerText, knoepfe: [...m.querySelectorAll('button')].map(b => ({ label: b.textContent, disabled: b.disabled })) };
    });
  };
  // Fremdes Recht: Abbau gesperrt, und der Grund nennt den Halter (Regel 28 fuer die Anzeige).
  const menuFremd = await menuAuf('3');
  const abbauFremd = menuFremd && menuFremd.knoepfe.find(k => /Abbaumission/.test(k.label));
  check('6b: am fremd reservierten Vorkommen ist der Abbau gesperrt und der Halter wird genannt',
    !!abbauFremd && abbauFremd.disabled && /Rivale/.test(menuFremd.text) && !menuFremd.knoepfe.some(k => /Schürfrecht anmelden/.test(k.label)),
    menuFremd && { disabled: abbauFremd && abbauFremd.disabled, text: menuFremd.text.slice(0, 160) });

  // Freies Vorkommen: anmelden - der Aufruf geht an /asteroid/claim, danach zeigt die Karte den
  // eigenen (gruenen) Ring, GESTRICHELT, denn eine Eskorte steht dort nicht.
  const menuFrei = await menuAuf(SERVER_PLATZ);
  check('6c: das freie Vorkommen bietet die Anmeldung mit Stand 0/2 an',
    !!menuFrei && menuFrei.knoepfe.some(k => /Schürfrecht anmelden \(0\/2\)/.test(k.label) && !k.disabled), menuFrei && menuFrei.knoepfe);
  await t4.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Schürfrecht anmelden/.test(y.textContent)); if (x) x.click(); });
  await t4.page.waitForTimeout(2000);
  check('6d: der Klick hat /api/asteroid/claim mit System und Platz gerufen',
    (t4.store.__claims || []).length === 1 && (t4.store.__claims[0] || {}).system === SERVER_SYSTEM && String((t4.store.__claims[0] || {}).platz) === SERVER_PLATZ,
    t4.store.__claims);
  const ringeNach = await t4.page.evaluate(() => [...document.querySelectorAll('[data-map-asteroid]')]
    .map(n => ({ platz: n.getAttribute('data-map-asteroid'), eigenRing: n.innerHTML.includes('#5dcaa5'), gestrichelt: n.innerHTML.includes('stroke-dasharray') })));
  const meinMarker = ringeNach.find(r => r.platz === SERVER_PLATZ);
  check('6e: das eigene Recht trägt den grünen Ring - gestrichelt, denn es ist unbewacht',
    !!meinMarker && meinMarker.eigenRing && meinMarker.gestrichelt, ringeNach);

  // Eigenes Recht: Menue bietet Eskorte und Aufgeben; Aufgeben ruft /asteroid/release und der Ring geht.
  const menuMein = await menuAuf(SERVER_PLATZ);
  check('6f: das eigene Recht bietet Eskorte stationieren und Aufgeben an',
    !!menuMein && menuMein.knoepfe.some(k => /Eskorte stationieren/.test(k.label)) && menuMein.knoepfe.some(k => /Schürfrecht aufgeben/.test(k.label)),
    menuMein && menuMein.knoepfe);
  await t4.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Schürfrecht aufgeben/.test(y.textContent)); if (x) x.click(); });
  await t4.page.waitForTimeout(2000);
  check('6g: das Aufgeben hat /api/asteroid/release gerufen',
    (t4.store.__releases || []).length === 1, t4.store.__releases);
  const ringeFrei = await t4.page.evaluate(() => [...document.querySelectorAll('[data-map-asteroid]')]
    .map(n => ({ platz: n.getAttribute('data-map-asteroid'), eigenRing: n.innerHTML.includes('#5dcaa5') })));
  check('6h: danach ist der Ring wieder weg', !(ringeFrei.find(r => r.platz === SERVER_PLATZ) || {}).eigenRing, ringeFrei);

  // ---- 7) Sitzung weg: keine rohen Servertexte, keine toten Knöpfe (v8.490.0) ---------------
  // WAS HIER AUF DEM SPIEL STEHT (Spieler-Report 14.08.2026): _astFeldVomServer wird einmal true
  // und nie wieder false, authToken dagegen faellt beim Abmelden/Verdraengen auf null. Ohne die
  // Sitzungspruefung blieben die Rechte-Knoepfe stehen und der Spieler bekam die rohe
  // Serverantwort "Nicht angemeldet." zu lesen - eine Auskunft, mit der niemand etwas anfangen kann.
  check('7a: das geteilte Feld verlangt eine bestehende Sitzung, nicht nur eine frühere Antwort',
    /function asteroidFeldGeteilt\(\)\s*\{\s*return _astFeldVomServer && useBackend\(\);/.test(JS));

  const t5 = await tab(browser, fixture(), { claim401: true, feldInit: { systeme: [SERVER_SYSTEM], felder: { [SERVER_SYSTEM]: { plaetze: {
    [SERVER_PLATZ]: { sorte: 'kometenkern', groesse: 'kern', vorrat: SERVER_VORRAT }
  } } } } });
  await t5.page.waitForTimeout(2500);
  await aufKarte(t5, SERVER_SYSTEM);
  await t5.page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, SERVER_PLATZ);
  await t5.page.waitForTimeout(400);
  await t5.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Schürfrecht anmelden/.test(y.textContent)); if (x) x.click(); });
  await t5.page.waitForTimeout(2000);
  const protokoll = await t5.page.evaluate(() => {
    const el = document.getElementById('log') || document.querySelector('.plog');
    return el ? el.innerText.slice(0, 600) : '';
  });
  check('7b: bei abgelaufener Sitzung sagt das Spiel das in eigenen Worten - nicht mit dem Servertext',
    /Sitzung ist abgelaufen/.test(protokoll) && !/Nicht angemeldet\./.test(protokoll),
    protokoll.split('\n').slice(0, 3));
  await t5.ctx.close();

  // ---- 8) Anfechtung (v8.491.0) ---------------------------------------------------------------
  // WAS HIER AUF DEM SPIEL STEHT: Der Kampf wird SERVERSEITIG entschieden. Der Client darf sein
  // eigenes Ergebnis nicht erfinden - er schickt nur die Missions-ID und bucht danach GENAU die
  // Verluste, die der Server nennt. Und die Flotte darf unter keinen Umstaenden verschwinden.
  const t6 = await tab(browser, fixture(), { feldInit: { systeme: [SERVER_SYSTEM], felder: { [SERVER_SYSTEM]: { plaetze: {
    '3': { sorte: 'eisen', groesse: 'brocken', vorrat: 90000,
           halter: 'x2', halterName: 'Rivale', tag: 'RIV', seit: 1, eskorte: { jaeger: 30 } }
  } } } } });
  await t6.page.waitForTimeout(2500);
  await aufKarte(t6, SERVER_SYSTEM);
  await t6.page.evaluate(() => { const n = document.querySelector('[data-map-asteroid="3"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); });
  await t6.page.waitForTimeout(400);
  const anfMenu = await t6.page.evaluate(() => { const m = document.querySelector('.kmenu'); return m ? [...m.querySelectorAll('button')].map(b => ({ t: b.textContent, disabled: b.disabled })) : null; });
  check('8a: am fremden Recht steht die Anfechtung zur Wahl',
    !!anfMenu && anfMenu.some(k => /anfechten/i.test(k.t) && !k.disabled), anfMenu);

  await t6.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /anfechten/i.test(y.textContent)); if (x) x.click(); });
  await t6.page.waitForTimeout(700);
  const anfWahl = await t6.page.evaluate(() => { const o = document.querySelector('#fwahlOverlay.open'); return o ? o.innerText : ''; });
  check('8b: die Flottenwahl nennt die Wache und verspricht KEINE Prozentzahl',
    /Anfechtung starten/.test(anfWahl) && /30 Schiff/.test(anfWahl) && !/Erfolgsaussicht \d/.test(anfWahl),
    anfWahl.slice(0, 200));
  await t6.page.evaluate(() => { const x = [...document.querySelectorAll('#fwahlOverlay button')].find(y => /Anfechtung starten/.test(y.textContent)); if (x) x.click(); });
  await t6.page.waitForTimeout(1500);
  const anfVor = t6.stand();
  const anfMission = (anfVor.fleet.missions || []).find(m => m.type === 'asteroid-contest');
  check('8c: die Anfechtungs-Mission steht mit Ziel und Flotte im Spielstand',
    !!anfMission && anfMission.targetId === SERVER_SYSTEM + ':3' && !!mission.composition,
    anfMission ? { targetId: anfMission.targetId, schiffe: Object.keys(anfMission.composition||{}).length } : null);
  if (!anfMission){ await t6.ctx.close(); await browser.close(); return ende(); }

  // Die Uhr vorstellen, damit die Mission ankommt - NUR Date.now (Arbeitsregel 8).
  const anfFlugSek = Math.ceil((anfMission.endTime - anfMission.startTime) / 1000) + 5;
  await t6.page.evaluate(sek => {
    const echt = Date.now, versatz = sek * 1000;
    Date.now = () => echt.call(Date) + versatz;
  }, anfFlugSek);
  await t6.page.waitForTimeout(4000);
  const anfAnfragen = t6.store.__contests || [];
  check('8d: bei Ankunft ruft der Client /asteroid/contest - mit System, Platz und Missions-ID',
    anfAnfragen.length === 1 && anfAnfragen[0].system === SERVER_SYSTEM && String(anfAnfragen[0].platz) === '3' && !!anfAnfragen[0].missionId,
    anfAnfragen[0]);
  const anfNach = t6.stand();
  // Gemessen statt geraten: capFighterSelection kappt Jaeger ohne Hangar auf null - ein fest
  // eingetippter Schiffstyp haette hier die Kappung gemessen statt der Verlustbuchung.
  const flogMit = anfMission.composition.cruisers || 0;
  check('8e-vorab: es sind wirklich Kreuzer mitgeflogen (sonst misst 8e nichts)', flogMit > 4, flogMit);
  check('8e: die Mission ist beendet und die Schiffe sind zurück - abzüglich GENAU der Verluste des Servers',
    !(anfNach.fleet.missions || []).some(m => m.type === 'asteroid-contest') &&
    (anfNach.fleet.cruisers || 0) === Math.max(0, (anfVor.fleet.cruisers || 0) + flogMit - 4),
    { vorher: anfVor.fleet.cruisers, mitgeflogen: flogMit, nachher: anfNach.fleet.cruisers });
  const anfBericht = (t6.store.__berichte || []).find(b => b && b.type === 'asteroid-contest');
  check('8f: es gibt einen Bericht mit Ausgang und beiden Verlustseiten',
    !!anfBericht && anfBericht.gewonnen === true && !!anfBericht.eigeneVerluste && !!anfBericht.gegnerVerluste,
    anfBericht ? { gewonnen: anfBericht.gewonnen, eigene: anfBericht.eigeneVerluste } : null);

  // ---- 9) Was der Spieler danach zu SEHEN bekommt (v8.494.0) -----------------------------------
  // 8f belegt, dass der Bericht ENTSTEHT. Hier geht es um die drei Anzeigestellen, die ihn danach
  // falsch oder gar nicht zeigten - die typische zweite Anzeigestelle mit der alten Annahme:
  //   (a) Der Ausgang steht in 'gewonnen', nicht in result:'win'. reportIsPositive kannte nur
  //       'win'/'destroyed' - eine GEWONNENE Anfechtung bekam den roten Streifen samt Pille
  //       "Verloren", und der Filter "Nur Erfolge" blendete sie aus.
  //   (b) Keine Filterkategorie beanspruchte 'asteroid-contest'; reportCategoryOf faellt dann auf
  //       'other' zurueck, der Kampfbericht lag also unter "Sonstiges".
  //   (c) Ohne Eintrag in NOTIF_EVENT_INFO greift der Notnagel der Tabelle: GEMESSEN stand am alten
  //       Stand zweimal das nackte Wort "Ereignis" im Postfach - fuer beide Ausgaenge derselbe Text,
  //       der weder sagt, was passiert ist, noch ob das Recht noch steht. (Der 'chat'-Kommentar in
  //       der Spieldatei spricht von einer leeren Zeile; das galt vor dem Notnagel.)
  t6.store.__meldungen = [
    { id:'n1', type:'asteroid-contested', time: Date.now(), payload:{ angreiferName:'Rivale', verloren:true,  sorte:'eiskern', system:SERVER_SYSTEM } },
    { id:'n2', type:'asteroid-contested', time: Date.now(), payload:{ angreiferName:'Rivale', verloren:false, sorte:'eiskern', system:SERVER_SYSTEM } }
  ];
  await t6.page.evaluate(() => { const b = document.getElementById('headerReportsBtn'); if (b) b.click(); });
  await t6.page.waitForTimeout(1500);
  // Gescopt auf #reportsBox (Arbeitsregel 5) - Kartenzeilen und Filterknoepfe gibt es im Spiel an
  // mehreren Stellen.
  const anfKarte = await t6.page.evaluate(() => {
    const box = document.getElementById('reportsBox'); if (!box) return { box:false };
    const k = [...box.querySelectorAll('.card-row')].find(e => /Anfechtung gewonnen/.test(e.textContent));
    if (!k) return { box:true, gefunden:false, hat: box.textContent.slice(0, 120) };
    const pille = [...k.querySelectorAll('span')].map(x => x.textContent.trim()).find(t => /^(Gewonnen|Verloren)$/.test(t));
    return { box:true, gefunden:true, pille, gruen: /#5dcaa5/.test(k.getAttribute('style') || '') };
  });
  check('9a: die gewonnene Anfechtung steht als Erfolg da - gruener Streifen, Pille "Gewonnen"',
    anfKarte.gefunden === true && anfKarte.pille === 'Gewonnen' && anfKarte.gruen === true, anfKarte);

  const nachFilter = async (attr, wert) => {
    await t6.page.evaluate(([a, w]) => {
      const box = document.getElementById('reportsBox'); if (!box) return;
      const b = box.querySelector('[' + a + '="' + w + '"]'); if (b) b.click();
    }, [attr, wert]);
    await t6.page.waitForTimeout(900);
    return t6.page.evaluate(() => {
      const box = document.getElementById('reportsBox'); if (!box) return null;
      return [...box.querySelectorAll('.card-row')].some(e => /Anfechtung gewonnen/.test(e.textContent));
    });
  };
  check('9b: unter "Kaempfe" ist der Anfechtungsbericht zu finden (nicht unter Sonstiges)',
    (await nachFilter('data-reports-filter-cat', 'combat')) === true);
  check('9c: und der Ergebnisfilter "Nur Erfolge" behaelt ihn ebenfalls',
    (await nachFilter('data-reports-filter-result', 'win')) === true);

  const postfach = await t6.page.evaluate(() => {
    const box = document.getElementById('notificationEventsBox'); if (!box) return null;
    return [...box.querySelectorAll('.bname')].map(e => e.textContent.trim());
  });
  check('9d: das Postfach erklaert beide Ausgaenge - kein leerer Eintrag, und die Texte sind verschieden',
    Array.isArray(postfach) && postfach.length === 2 &&
    postfach.every(t => t.length > 30 && /Rivale/.test(t) && /Eiskern/.test(t)) &&
    postfach[0] !== postfach[1] &&
    postfach.some(t => /abgenommen/.test(t)) && postfach.some(t => /bleibt deins/.test(t)),
    postfach);
  await t6.ctx.close();

  // 409 und 404 sind in den Läufen 3 und 4 ABSICHT - der Browser protokolliert jede Nicht-2xx-Antwort
  // als Konsolenfehler. Gefiltert wird deshalb die Netzwerkmeldung, nicht der Fehlerfall selbst;
  // ein echter JS-Fehler (pageerror) kommt weiterhin durch.
  const fehler = [...t1.errs, ...t2.errs, ...t3.errs, ...t4.errs, ...t5.errs, ...t6.errs]
    .filter(e => !/favicon|net::ERR|CORS|Failed to load resource/i.test(e));
  check('5: keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
  await t3.ctx.close();
  await t4.ctx.close();

  await browser.close();
  return ende();
})();
