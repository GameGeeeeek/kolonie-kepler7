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
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
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
    st.fleet.schuerfschiff = 6; st.fleet.frachter = 10;
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

  // 409 und 404 sind in den Läufen 3 und 4 ABSICHT - der Browser protokolliert jede Nicht-2xx-Antwort
  // als Konsolenfehler. Gefiltert wird deshalb die Netzwerkmeldung, nicht der Fehlerfall selbst;
  // ein echter JS-Fehler (pageerror) kommt weiterhin durch.
  const fehler = [...t1.errs, ...t2.errs, ...t3.errs]
    .filter(e => !/favicon|net::ERR|CORS|Failed to load resource/i.test(e));
  check('5: keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
  await t3.ctx.close();

  await browser.close();
  return ende();
})();
