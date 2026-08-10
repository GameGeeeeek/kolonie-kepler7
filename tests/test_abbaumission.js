// Abbaumission an Asteroidenvorkommen (v8.478.0, Konzept docs/asteroiden-konzept.md, Phase 1).
//
// DIE REGEL, die dieser Test traegt: "Die Ressourcen bekommt der Spieler erst, wenn die Flotte
// wieder zurueck ist." Das ist eine Aussage, die man nur bemerkt, wenn man sie VERLETZT - ein Test,
// der bloss den Endstand prueft, waere auch bei sofortiger Gutschrift beim Start gruen. Deshalb ist
// die ZWISCHENPRUEFUNG (Punkt 3) der eigentliche Kern: mitten im Flug darf nichts gutgeschrieben
// sein, und der Vorrat des Brockens muss trotzdem schon gesunken sein (Entnahme beim Start, damit
// derselbe Brocken nicht zweimal vergeben werden kann).
//
// GEPRUEFT WIRD:
//   1. Das Feld entsteht und ist DETERMINISTISCH: zwei frische Spielstaende ergeben dieselben
//      Guertelsysteme mit demselben Inhalt. Sonst saehe jeder Spieler eine andere Galaxie.
//   2. Die Brocken sind auf der Sektorkarte da und anklickbar.
//   3. Nach dem Start: Ladung ist dem Vorkommen ENTNOMMEN, beim Spieler aber NICHTS gutgeschrieben.
//   4. Nach der Rueckkehr: exakt die Ladung ist da, aufgeteilt nach der Sorte des Brockens.
//   5. Foerdertechnik hebt Abbaurate UND Laderaum - die Abbauzeit bleibt deshalb gleich, die Ladung
//      waechst. Genau diese Kopplung ist der Grund, warum die Forschung beides hebt.
//
// GEGENPROBE (in beide Richtungen ausgefuehrt, Arbeitsregel 1):
//   - Am alten Stand (vor v8.478.0) gibt es weder state.asteroidFeld noch [data-map-asteroid];
//     Punkt 1 und 2 fallen sofort.
//   - Schreibt man die Gutschrift versuchsweise in sendMiningMission statt in checkMissions, faellt
//     Punkt 3 - und NUR Punkt 3. Das ist die Probe, die belegt, dass er etwas misst.
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); if (!c) fail = true; };

const SAVE_KEY = 'kepler7-save-v3';

// Backend-Mock nach dem Muster der uebrigen Tests: Der Spielstand liegt NICHT im localStorage,
// sondern geht per PUT /api/storage/<key> an den Server. Ohne diesen Mock speichert das Spiel gar
// nicht (doSave bricht bei !bootDataReady ab, und ready wird ohne Auth nie true) - der erste Anlauf
// dieses Tests hat genau daran zwanzig Minuten verloren.
function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (p === 'reports'){
    // Berichte wirklich halten statt leer zu antworten: Der Abbau-Bericht traegt die vom SPIEL
    // gerechnete Gutschrift (angekommen/verloren) und ist damit die saubere Messstelle - siehe 4b.
    if (req.method() === 'POST'){
      try { store.__berichte.unshift(JSON.parse(req.postData()||'{}').report || {}); } catch(e){}
      return j({ ok:true });
    }
    return j({ reports: store.__berichte });
  }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

async function tab(browser, startSave){
  const store = { __berichte: [] };
  if (startSave) store[SAVE_KEY] = startSave;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
// Einen Spielstand veraendern und als Startpunkt zurueckgeben - immer auf Basis eines vom SPIEL
// erzeugten Stands, nie von Hand gebaut: Eine erfundene Struktur waere beim naechsten neuen Feld
// still veraltet.
function abgewandelt(basis, fn){ const st = JSON.parse(JSON.stringify(basis)); fn(st); return JSON.stringify(st); }
// Ereignis-Uhren in die Zukunft pinnen (Arbeitsregel 18). Beim frischen Fixture ist
// nextPlanetEventCheck 0, der erste Check feuert also GARANTIERT - und schiebt mitten im Messfenster
// Rohstoffe nach. Der zweite Anlauf dieses Tests sah dadurch Erz und Kristalle wachsen, obwohl der
// Brocken ein reiner Eiskern war, und der Verdacht fiel zuerst auf die Gutschrift.
function ereignisUhrenPinnen(st){
  const fern = Date.now() + 365 * 24 * 3600 * 1000;
  for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift','lastPactAccrualAt']){
    if (st[k] !== undefined) st[k] = fern;
  }
  st.activeEvent = null;
  st.buffs = [];
}

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Feld entsteht und ist deterministisch -------------------------------------------
  const a = await tab(browser);
  const stA = a.stand();
  const basis = a.store[SAVE_KEY];   // vom Spiel selbst erzeugter Ausgangsstand
  const feldA = stA.asteroidFeld || {};
  const systemeA = Object.keys(feldA).sort();
  check('1a Feld existiert und belegt ~20 Systeme', systemeA.length >= 15 && systemeA.length <= 25, { systeme: systemeA.length });
  const anzahlen = systemeA.map(x => Object.values(feldA[x].plaetze).filter(q => q && !q.frei).length);
  check('1b jedes Guertelsystem traegt 4-6 Vorkommen', anzahlen.length > 0 && anzahlen.every(n => n >= 4 && n <= 6), { min: Math.min(...anzahlen), max: Math.max(...anzahlen) });
  const gesamt = anzahlen.reduce((x, y) => x + y, 0);
  check('1c galaxieweit rund 90 Vorkommen', gesamt >= 70 && gesamt <= 120, { gesamt });
  await a.ctx.close();

  const b2 = await tab(browser);
  const feldB = (b2.stand().asteroidFeld) || {};
  // Nicht-leer ist Teil der Behauptung: Zwei leere Felder waeren trivial gleich - genau die Sorte
  // Pruefung, die gruen ist, ohne etwas zu belegen (Arbeitsregel 1).
  check('1d zweiter frischer Spielstand ergibt dasselbe, nicht-leere Feld',
    systemeA.length > 0
    && JSON.stringify(systemeA) === JSON.stringify(Object.keys(feldB).sort())
    && systemeA.every(x => JSON.stringify(feldA[x]) === JSON.stringify(feldB[x])));
  await b2.ctx.close();

  // ---- 2-4) Der Kreislauf ------------------------------------------------------------------
  const zielSystem = systemeA[0];
  const zielPlatz = Object.keys(feldA[zielSystem].plaetze).filter(k => !feldA[zielSystem].plaetze[k].frei)[0];
  const vorratVorher = feldA[zielSystem].plaetze[zielPlatz].vorrat;

  async function aufKarte(t){
    await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await t.page.waitForTimeout(700);
    await t.page.evaluate(id => { const n = document.querySelector('[data-system-node="' + id + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); }, zielSystem);
    await t.page.waitForTimeout(1200);
  }
  async function oeffneMenue(t){
    await t.page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, zielPlatz);
    await t.page.waitForTimeout(400);
    await t.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Abbaumission/.test(y.textContent)); if (x) x.click(); });
    await t.page.waitForTimeout(700);
  }

  // ACHTUNG, Arbeitsregel 7 - "messen, was gemessen werden soll, nicht den Deckel": Der erste
  // Anlauf setzte alle Rohstoffe auf 50.000. Der Lagerdeckel lag bei rund 3.300, der Bestand also
  // weit darueber - gainResources() kann dann per Definition nichts mehr gutschreiben, und Punkt 4b
  // meldete "nichts angekommen", obwohl die Mechanik stimmte. Jetzt: viel Lager, wenig Bestand.
  const c = await tab(browser, abgewandelt(stA, st => {
    st.research = st.research || {};
    st.research.rminentechnik = 1;
    st.fleet.schuerfschiff = 6;
    st.fleet.frachter = 10;
    st.buildings.lager = 120;
    // Produktion auf null. Sonst misst dieser Test beim Zeitsprung die GEBAEUDEPRODUKTION mit und
    // nicht die Ladung - beim ersten Anlauf wuchsen Erz und Kristalle mit, obwohl der Brocken ein
    // reiner Eiskern war. Das ist die Familie aus Arbeitsregel 20: erst pruefen, ob die Bezugsgroesse
    // stabil ist, bevor man dem Messgegenstand misstraut.
    for (const g of ['solar','mine','raffinerie','synth','fusionsreaktor','labor']) st.buildings[g] = 0;
    ereignisUhrenPinnen(st);
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 4000;
  }));
  await aufKarte(c);
  const marker = await c.page.evaluate(() => document.querySelectorAll('[data-map-asteroid]').length);
  check('2a Brocken sind auf der Sektorkarte anklickbar', marker >= 4, { marker });
  await c.page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, zielPlatz);
  await c.page.waitForTimeout(400);
  check('2b Klick oeffnet das Kartenmenue', await c.page.evaluate(() => !!document.querySelector('.kmenu')));
  await c.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Abbaumission/.test(y.textContent)); if (x) x.click(); });
  await c.page.waitForTimeout(700);
  check('2c Flottenwahl geht auf', await c.page.evaluate(() => !!document.querySelector('#fwahlOverlay.open')));

  const vorherRes = c.stand().resources;
  await c.page.evaluate(() => { const x = [...document.querySelectorAll('#fwahlOverlay button')].find(y => /Abbaumission starten/.test(y.textContent)); if (x) x.click(); });
  await c.page.waitForTimeout(2000);

  const stStart = c.stand();
  const mission = (stStart.fleet.missions || []).find(m => m.type === 'mining');
  check('3a Mission laeuft', !!mission, mission ? { ladung: mission.ladung } : null);
  const platzJetzt = stStart.asteroidFeld[zielSystem].plaetze[zielPlatz] || {};
  check('3b Ladung ist dem Vorkommen beim START entnommen',
    !!mission && (platzJetzt.frei === true || platzJetzt.vorrat === vorratVorher - mission.ladung),
    { vorher: vorratVorher, nachher: platzJetzt.vorrat, ladung: mission && mission.ladung });
  // DER KERN DES TESTS: mitten im Flug ist beim Spieler noch NICHTS angekommen.
  const zugewachsen = ['erz','kristalle','deuterium','antimaterie']
    .filter(r => (stStart.resources[r] || 0) > (vorherRes[r] || 0));
  check('3c waehrend des Fluges ist NICHTS gutgeschrieben', zugewachsen.length === 0, { zugewachsen });

  // ---- 4) Rueckkehr: NUR die Uhr vorstellen (Arbeitsregel 8) --------------------------------
  if (mission){
    await c.page.evaluate(ms => { const echt = Date.now; Date.now = () => echt.call(Date) + ms; }, mission.endTime - Date.now() + 5000);
    await c.page.waitForTimeout(4000);
  }
  const stEnde = c.stand();
  check('4a Mission ist aufgeloest', !(stEnde.fleet.missions || []).some(m => m.type === 'mining'));
  /* WO gemessen wird, und warum nicht am Rohstoffstand:
     Ein Kontrolllauf mit identischem Fixture und Zeitsprung, aber OHNE Mission, zeigte null
     Bewegung - der Zuwachs kommt also aus der Mission. Es ist der Stufenaufstieg: Die Rueckkehr
     gibt Erfahrung, ein Aufstieg schuettet Rohstoffe aus, und zwar auch in genau den Rohstoff, um
     den es hier geht (gemessen: 5.500 statt 5.400). Den Aufstieg wegzukonfigurieren hat es
     schlimmer gemacht - ein hoch gesetztes xp loest beim Laden gleich mehrere aus.
     Gemessen wird deshalb am BERICHT, den die Mission selbst schreibt: Sein Feld `angekommen` wird
     im Spiel direkt um gainResources() herum gebildet und ist damit die Gutschrift der Mission,
     unbeeinflusst von allem, was danach passiert. Der Rohstoffstand wird zusaetzlich geprueft -
     aber als Mindestmenge, weil dort legitim noch anderes dazukommen darf. */
  const bericht = (c.store.__berichte || []).find(r => r.type === 'mining');
  check('4b es gibt einen Abbau-Bericht', !!bericht, bericht ? { ladung: bericht.ladung } : null);
  const soll = mission ? mission.res : {};
  const ist = (bericht && bericht.angekommen) || {};
  const abweichungen = Object.entries(soll)
    .map(([r, v]) => ({ r, soll: v, ist: ist[r] || 0 }))
    .filter(x => Math.abs(x.ist - x.soll) > 2);
  check('4b2 der Bericht weist die volle Ladung als angekommen aus',
    !!bericht && Object.keys(soll).length > 0 && abweichungen.length === 0 && !bericht.verloren,
    { soll, ist, verloren: bericht && bericht.verloren });
  check('4b3 die Rohstoffe sind auch wirklich im Spielstand gelandet',
    Object.entries(soll).every(([r, v]) => (stEnde.resources[r]||0) - (stStart.resources[r]||0) >= v - 2),
    Object.fromEntries(Object.keys(soll).map(r => [r, (stEnde.resources[r]||0) - (stStart.resources[r]||0)])));
  // Und die Sorte bestimmt, WELCHE Rohstoffe das sind - ein Eiskern darf kein Erz liefern.
  const sortenRes = Object.keys(soll);
  check('4d die Ladung besteht aus den Rohstoffen der Sorte',
    sortenRes.length > 0 && sortenRes.length <= 2 && sortenRes.every(r => ['erz','kristalle','deuterium','antimaterie'].indexOf(r) >= 0),
    { sortenRes });
  const fehler = c.errs.filter(e => !/favicon|net::ERR|CORS|404/i.test(e));
  check('4c keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
  await c.ctx.close();

  // ---- 5) Foerdertechnik hebt Rate UND Laderaum ---------------------------------------------
  async function vorschauMit(stufe){
    const t = await tab(browser, abgewandelt(stA, st => {
      st.research = st.research || {};
      st.research.rminentechnik = 1;
      st.research.rfoerderung = stufe;
      st.fleet.schuerfschiff = 4;
      st.fleet.frachter = 0;
      st.buildings.lager = 120;
      for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 4000;
    }));
    await aufKarte(t);
    await oeffneMenue(t);
    const txt = await t.page.evaluate(() => { const o = document.querySelector('#fwahlOverlay'); return o ? o.innerText : ''; });
    await t.ctx.close();
    return {
      ladung: parseInt(((txt.match(/Ladung\s+([\d.]+)/) || [])[1] || '0').replace(/\./g, ''), 10),
      abbau: ((txt.match(/Abbau\s+([^\u00b7]+)\u00b7/) || [])[1] || '').trim(),
      txt
    };
  }
  const s0 = await vorschauMit(0), s10 = await vorschauMit(10);
  check('5a Foerdertechnik erhoeht die Ladung um ~40%', s0.ladung > 0 && Math.abs(s10.ladung / s0.ladung - 1.4) < 0.08, { s0: s0.ladung, s10: s10.ladung });
  check('5b die Abbauzeit bleibt dabei gleich', !!s0.abbau && s0.abbau === s10.abbau, { s0: s0.abbau, s10: s10.abbau });

  await browser.close();
  console.log(fail ? '\nERGEBNIS: FEHLER' : '\nERGEBNIS: alles gruen');
  process.exit(fail ? 1 : 0);
})();
