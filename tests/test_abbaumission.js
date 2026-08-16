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
const { oeffneSystemUeberSektoren } = require('./lib/karte');

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
  const belegt = Object.keys(feldA[zielSystem].plaetze).filter(k => !feldA[zielSystem].plaetze[k].frei);
  /* Bevorzugt ein Vorkommen, das KEIN Splitter ist (16.08.2026). Splitter geben bewusst null
     Protomaterie - der Abschnitt 7 unten waere an einem Splitter zwar gruen, aber ohne Aussage
     (Arbeitsregel 37: eine Pruefung hinter einer Bedingung, die nicht eintrat). Alle uebrigen
     Pruefungen dieses Tests sind groessenunabhaengig, die Wahl aendert an ihnen nichts.
     Faellt zurueck auf den ersten belegten Platz, falls das Guertelsystem nur Splitter traegt -
     dann sagt 7-vorab es ausdruecklich, statt still nichts zu pruefen. */
  const zielPlatz = belegt.find(k => feldA[zielSystem].plaetze[k].groesse !== 'splitter') || belegt[0];
  const zielGroesse = feldA[zielSystem].plaetze[zielPlatz].groesse;
  const vorratVorher = feldA[zielSystem].plaetze[zielPlatz].vorrat;
  /* Die Sollmenge kommt aus der SPIELDATEI, nicht aus einer Tabelle im Test - sonst waere sie eine
     zweite Wahrheitsquelle, die bei der naechsten Balance-Aenderung still veraltet (Arbeitsregel 3:
     die Regel pruefen, nicht die Momentaufnahme). */
  const protoTabelle = (() => {
    const src = require('fs').readFileSync(require('./lib/umgebung').SPIELDATEI, 'utf8');
    const m = src.match(/const PROTOMATERIE_JE_FUHRE = (\{[^}]*\});/);
    try { return m ? new Function('return ' + m[1])() : null; } catch (e) { return null; }
  })();

  async function aufKarte(t){
    await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await t.page.waitForTimeout(700);
    // Seit KB-4: über die Sektoren hinein (Übersicht -> Region -> System).
    await oeffneSystemUeberSektoren(t.page, zielSystem);
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
  /* ---- 7) Protomaterie (16.08.2026) -------------------------------------------------------
     Der Rohstoff, den keine Fabrik herstellt - er faellt nur als Beifang heimkehrender Fuhren an
     und ist der Grund, ueberhaupt zum Guertel zu fliegen. Geprueft wird hier, WEIL die
     Messvorrichtung dieses Tests ohnehin steht: eine echte Mission, ein echter Bericht.
     Die drei Aussagen bauen aufeinander auf: Die Menge haengt allein an der GROESSE (nicht an der
     Ladung, nicht an der Flotte - sonst skalierte sie wieder mit dem Imperium), sie wird beim
     START eingefroren (eine spaetere Balance-Aenderung darf keine Flotte treffen, die schon
     unterwegs ist), und sie kommt bei der Rueckkehr wirklich an. */
  check('7-vorab die Sollmenge wurde aus der Spieldatei gelesen und das Ziel gibt Protomaterie',
    !!protoTabelle && protoTabelle[zielGroesse] > 0,
    { zielGroesse, tabelle: protoTabelle, hinweis: 'bei 0: das Guertelsystem trug nur Splitter, 7a-7c sind dann ohne Aussage' });
  if (protoTabelle && mission){
    check('7a die Mission traegt die Menge ihrer GROESSE, beim Start eingefroren',
      mission.proto === protoTabelle[zielGroesse],
      { groesse: zielGroesse, erwartet: protoTabelle[zielGroesse], inDerMission: mission.proto });
    check('7b der Bericht weist sie als angekommen aus, ohne Verfall bei leerem Speicher',
      !!bericht && bericht.proto === mission.proto && !bericht.protoVerloren,
      { imBericht: bericht && bericht.proto, verfallen: bericht && bericht.protoVerloren });
    check('7c und sie liegt danach wirklich im Spielstand',
      (stEnde.resources.protomaterie||0) - (stStart.resources.protomaterie||0) === mission.proto,
      { vorher: stStart.resources.protomaterie, nachher: stEnde.resources.protomaterie, erwartet: mission.proto });
  }

  const fehler = c.errs.filter(e => !/favicon|net::ERR|CORS|404/i.test(e));
  check('4c keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
  await c.ctx.close();

  /* ---- 7d-7f) Die GEGENRICHTUNG: voller Speicher --------------------------------------------
     Ohne diesen zweiten Lauf sagt "ohne Verfall bei leerem Speicher" (7b) nichts aus - er waere
     auch dann gruen, wenn es den Ueberlauf-Zweig gar nicht gaebe. Und der Ueberlauf ist die
     Zusage, auf die es hier ankommt: Eine Fuhre, fuer die jemand 45 Minuten geflogen ist, darf
     nicht stillschweigend verfallen. Der Bericht MUSS sie beim Namen nennen.
     Der Speicher wird auf seinen Deckel gesetzt statt auf eine erfundene Zahl - der Deckel steht
     bei 500 + 100 je Stufe der Aufbereitungsanlage, und die ist im Fixture 0. */
  {
    const t = await tab(browser, abgewandelt(stA, st => {
      st.research = st.research || {};
      st.research.rminentechnik = 1;
      st.fleet.schuerfschiff = 6;
      st.fleet.frachter = 10;
      st.buildings.lager = 120;
      for (const g of ['solar','mine','raffinerie','synth','fusionsreaktor','labor']) st.buildings[g] = 0;
      ereignisUhrenPinnen(st);
      for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 4000;
      st.resources.protomaterie = 500;   // Deckel ohne Aufbereitungsanlage - randvoll
    }));
    await aufKarte(t);
    await oeffneMenue(t);
    await t.page.evaluate(() => { const x = [...document.querySelectorAll('#fwahlOverlay button')].find(y => /Abbaumission starten/.test(y.textContent)); if (x) x.click(); });
    await t.page.waitForTimeout(2000);
    const stV = t.stand();
    const mV = (stV.fleet.missions || []).find(m => m.type === 'mining');
    check('7d-vorab der zweite Lauf hat eine Mission mit Protomaterie an Bord',
      !!mV && mV.proto > 0, { proto: mV && mV.proto, bestandVorher: stV.resources.protomaterie });
    if (mV){
      await t.page.evaluate(ms => { const echt = Date.now; Date.now = () => echt.call(Date) + ms; }, mV.endTime - Date.now() + 5000);
      await t.page.waitForTimeout(4000);
      const stN = t.stand();
      const bV = (t.store.__berichte || []).find(r => r.type === 'mining');
      check('7d der Bericht nennt den Verfall ausdruecklich, statt ihn zu verschweigen',
        !!bV && bV.protoVerloren === mV.proto && bV.proto === 0,
        { angekommen: bV && bV.proto, verfallen: bV && bV.protoVerloren, ausDerMission: mV.proto });
      check('7e und der Bestand steht weiterhin exakt am Deckel - kein Ueberlauf ins Lager',
        stN.resources.protomaterie === 500, { bestand: stN.resources.protomaterie });
      // Die Rohstoffe der Fuhre muessen davon voellig unberuehrt sein: zwei getrennte Deckel, und
      // ein volles Protomaterie-Fass darf die Ladung nicht mitreissen.
      check('7f die Rohstoffladung kommt trotzdem vollstaendig an (getrennte Deckel)',
        !!bV && !bV.verloren && Object.keys(bV.angekommen || {}).length > 0,
        { angekommen: bV && bV.angekommen, verloren: bV && bV.verloren });
    }
    await t.ctx.close();
  }

  /* Die Oberflaeche zeigt Zahlen durch fmt(): ab 1.000 als "4.6k", ab 1.000.000 als "1.23M",
     darunter roh. Wer nur /([\d.]+)/ liest, bekommt aus "4.6k" die 46 - Faktor 100 daneben, und
     zwar STILL: Verhaeltnisse zwischen zwei so gelesenen Werten stimmen trotzdem, der Fehler faellt
     also erst auf, wenn man die absoluten Zahlen ansieht (gemessen 14.08.2026, genau so passiert).
     Diese Funktion kennt alle drei Formen. Was sie NICHT heilen kann, ist die Aufloesung: Bei
     "4.6k" steht die Zahl auf 100 genau. Jede Pruefung darunter muss ihre Flottengroesse deshalb so
     waehlen, dass der gesuchte Unterschied deutlich groesser ist als diese Koernung. */
  const zahlAus = (txt) => {
    const m = String(txt).match(/(\d+(?:\.\d+)?)\s*(k|M)?/);
    if (!m) return null;
    const n = Number(m[1]);
    return m[2] === 'M' ? n * 1000000 : m[2] === 'k' ? n * 1000 : n;
  };

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
      ladung: zahlAus((txt.match(/Ladung\s+([\d.]+[kM]?)/) || [])[1] || '0'),
      abbau: ((txt.match(/Abbau\s+([^\u00b7]+)\u00b7/) || [])[1] || '').trim(),
      txt
    };
  }
  const s0 = await vorschauMit(0), s10 = await vorschauMit(10);
  check('5a Foerdertechnik erhoeht die Ladung um ~40%', s0.ladung > 0 && Math.abs(s10.ladung / s0.ladung - 1.4) < 0.08, { s0: s0.ladung, s10: s10.ladung });
  check('5b die Abbauzeit bleibt dabei gleich', !!s0.abbau && s0.abbau === s10.abbau, { s0: s0.abbau, s10: s10.abbau });

  // ---- 6) Bergungsfrachter: doppelte Ladung, halbes Tempo, KEIN Lager ------------------------
  // Der Bergungsfrachter ist kein Upgrade, sondern ein Tausch. Alle drei Seiten davon werden hier
  // GEMESSEN und nicht aus den Konstanten abgelesen: die Ladung gegen den Grossen Frachter, die
  // Flugzeit gegen denselben Lauf, und der Lagerdeckel gegen einen Lauf ganz ohne Frachter.
  // Der Lagerdeckel ist der Teil, der am leichtesten still kaputtgeht - beide anderen Frachter
  // zahlen darauf ein, und ein "der Vollstaendigkeit halber"-Eintrag in LAGER_PER_SHIP wuerde den
  // Geschwindigkeits-Nachteil des Schiffs komplett aushebeln, ohne dass irgendwo etwas rot wird.
  const sekunden = (txt) => {
    // fmtDuration kennt drei Formen: "42s", "5m 30s", "2h 7m".
    let m;
    if ((m = txt.match(/^(\d+)h (\d+)m$/))) return Number(m[1])*3600 + Number(m[2])*60;
    if ((m = txt.match(/^(\d+)m (\d+)s$/))) return Number(m[1])*60 + Number(m[2]);
    if ((m = txt.match(/^(\d+)s$/))) return Number(m[1]);
    return null;
  };
  // 40 Schiffe, nicht zwei: Der Unterschied, um den es geht, muss deutlich ueber der Koernung der
  // Anzeige liegen (siehe zahlAus). Bei zwei Schiffen waere der Lagerbeitrag eines fehlerhaften
  // Bergungsfrachters unter Umstaenden komplett in der Rundung verschwunden - die Pruefung waere
  // dann aus dem falschen Grund gruen gewesen.
  const ANZAHL = 40;
  async function messungMit(flottenAenderung){
    const t = await tab(browser, abgewandelt(stA, st => {
      st.research = st.research || {};
      st.research.rminentechnik = 1;
      st.research.rfoerderung = 0;
      st.fleet.schuerfschiff = 4;
      st.fleet.frachter = 0; st.fleet.frachtergross = 0; st.fleet.bergungsfrachter = 0;
      st.buildings.lager = 120;
      flottenAenderung(st);
      for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 4000;
    }));
    // Der Lagerdeckel steht auf jeder Ressourcenkarte als "/ Zahl" - gescopt auf die Erz-Karte
    // (Arbeitsregel 5), sonst trifft der Selektor die erstbeste Karte irgendeines Reiters.
    const lagerTxt = await t.page.evaluate(() => {
      const el = document.querySelector('.rescard[data-res="erz"] .value span');
      return el ? el.textContent : '';
    });
    await aufKarte(t);
    await oeffneMenue(t);
    const txt = await t.page.evaluate(() => { const o = document.querySelector('#fwahlOverlay'); return o ? o.innerText : ''; });
    await t.ctx.close();
    const lz = txt.match(/Ladung\s+([\d.]+[kM]?) von ([\d.]+[kM]?) Laderaum/) || [];
    return {
      lager: zahlAus(lagerTxt.replace('/', '')),
      ladung: zahlAus(lz[1] || '0'),
      raum: zahlAus(lz[2] || '0'),
      hinflug: sekunden(((txt.match(/Hinflug\s+([^\u00b7]+)\u00b7/) || [])[1] || '').trim())
    };
  }
  const ohne = await messungMit(() => {});
  const gross = await messungMit(st => { st.fleet.frachtergross = ANZAHL; });
  const bergung = await messungMit(st => { st.fleet.bergungsfrachter = ANZAHL; });
  check('6-vorab: die Vorschau liefert ueberhaupt Zahlen (sonst misst 6a-6d nichts)',
    ohne.ladung > 0 && ohne.lager > 0 && ohne.hinflug > 0, ohne);
  /* Gemessen wird der LADERAUM, nicht die Ladung - und das ist kein Detail, sondern der Grund,
     aus dem diese Pruefung ueberhaupt hier steht. Bei 40 Schiffen ist der VORRAT DES BROCKENS die
     engere Schranke: In beiden Laeufen steht dieselbe Ladung (gemessen 48.400), waehrend der
     Frachtraum sauber mitwaechst (61.600 gegen 121.600). Wer die Ladung verglichen haette, haette
     den Brocken gemessen statt das Schiff - genau Arbeitsregel 7 ("messen, was gemessen werden
     soll, nicht den Deckel"). Die Pruefung haelt beides fest, damit niemand sie "vereinfacht":
     Wird der Testbrocken irgendwann groesser, faellt sie auf und der Kommentar erklaert, warum. */
  check('6-vorab2: die Ladung ist hier vom Brocken gedeckelt - deshalb wird der Laderaum verglichen',
    gross.ladung === bergung.ladung && bergung.raum > gross.raum && gross.raum > ohne.raum,
    { ladungGross: gross.ladung, ladungBergung: bergung.ladung, raumGross: gross.raum, raumBergung: bergung.raum });
  // Gegen den GEMESSENEN Ausgangsstand statt gegen eingetippte Zahlen (Arbeitsregel 2).
  const zuwachsGross = gross.raum - ohne.raum;
  const zuwachsBergung = bergung.raum - ohne.raum;
  check('6a der Bergungsfrachter traegt doppelt so viel wie der Grosse Frachter',
    zuwachsGross > 0 && Math.abs(zuwachsBergung / zuwachsGross - 2) < 0.02,
    { ohne: ohne.raum, gross: gross.raum, bergung: bergung.raum, zuwachsGross, zuwachsBergung });
  check('6b und er bremst die Flotte aus - der Hinflug dauert laenger als mit dem Grossen',
    bergung.hinflug > gross.hinflug, { gross: gross.hinflug, bergung: bergung.hinflug });
  check('6c der Grosse Frachter hebt den Lagerdeckel (Gegenprobe zu 6d)',
    gross.lager > ohne.lager, { ohne: ohne.lager, gross: gross.lager });
  check('6d der Bergungsfrachter hebt ihn NICHT - sein Rumpf ist Frachtraum, kein Lager',
    bergung.lager === ohne.lager, { ohne: ohne.lager, bergung: bergung.lager, zumVergleichGross: gross.lager });

  await browser.close();
  console.log(fail ? '\nERGEBNIS: FEHLER' : '\nERGEBNIS: alles gruen');
  process.exit(fail ? 1 : 0);
})();
