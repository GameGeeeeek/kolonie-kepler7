// Wer sein Schürfrecht verteidigt, bekommt einen Bericht - und verliert die Schiffe wirklich.
//
// DER ANLASS, im Browser gemessen am ausgelieferten Stand v8.593.0:
//   asteroidEskortenSync() überspringt jeden Platz, der nicht mehr MIR gehört (`p.halter !== eigen`).
//   Nach einer verlorenen Anfechtung gehört er dem Angreifer - der lokale Eskorten-Eintrag blieb
//   also mit der vollständigen VORKAMPF-Flotte stehen. Gemessen: 20 Kreuzer stationiert, Recht
//   verloren, das Kartenmenü bot "Gestrandete Eskorte zurückrufen (20 Schiffe)" an, und ein Klick
//   erzeugte eine mining-recall-Mission mit 20 Kreuzern - obwohl der Server sie in diesem Kampf
//   vernichtet hatte (er setzt gegnerVerlustAnteil = 1, wenn der Angreifer gewinnt).
//   Ein verlorenes Schürfrecht kostete den Verteidiger damit KEINEN EINZIGEN Schiffsverlust.
//   Dazu die Berichtslücke, wegen der überhaupt hingesehen wurde: In BEIDEN Ausgängen gab es nur
//   eine log()-Zeile - und die überschreibt sich mit der nächsten Meldung selbst (Hausregel 47);
//   beim Offline-Nachholen ist sie ganz stummgeschaltet. Gemessen: reports [] in beiden Läufen.
//
// WARUM DER SERVER DEN AUSSCHLAG GIBT:
//   Ein aufgegebenes Recht sieht im Felddokument GENAUSO aus wie ein verlorenes - Halter weg,
//   Eskorte weg (asteroid/release löscht sie ebenfalls). Nur dort stehen die Schiffe wirklich noch,
//   und das Kartenmenü bietet den Rückruf zu Recht an. Die Unterscheidung kommt deshalb aus
//   `vork.letzterKampf` (Backend #151) und wird nicht geraten - ein Fix, der sie rät, vernichtet
//   im aufgegebenen Fall Schiffe, und das ist die teurere Richtung.
//
// GEGENPROBE (Hausregel 1, in BEIDE Richtungen gefahren): siehe PR-Text.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer, logMitschnitt, logZeilen } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos', PLATZ = '7';
const SCHLUESSEL = SYS + ':' + PLATZ;

// ---------------------------------------------------------------- 0) Verdrahtung im Quelltext
check('0a: es gibt genau EINE Buchungsstelle für einen Angriff auf die eigene Eskorte',
  (JS.match(/function asteroidVerteidigungBuchen\(/g) || []).length === 1,
  { definitionen: (JS.match(/function asteroidVerteidigungBuchen\(/g) || []).length,
    hinweis: 'eine zweite Kopie kann wieder auseinanderlaufen (Hausregel 43)' });
check('0b: beide Wege gehen dort durch - Kampfvermerk UND der Rückfall über die Differenz',
  (JS.match(/asteroidVerteidigungBuchen\(/g) || []).length === 3,
  { aufrufe: (JS.match(/asteroidVerteidigungBuchen\(/g) || []).length });
// Der Vermerk-Zweig muss VOR dem Halter-Filter stehen - dahinter wäre er wirkungslos, denn genau
// im gemessenen Fehlerfall gehört das Vorkommen jemand anderem.
const rumpf = (() => {
  const a = JS.indexOf('function asteroidEskortenSync(');
  const b = a >= 0 ? JS.indexOf('\n  }', JS.indexOf('_astSyncZuletzt[schluessel] = Date.now();', a)) : -1;
  return (a >= 0 && b > a) ? JS.slice(a, b) : '';
})();
check('0-anker: der Rumpf von asteroidEskortenSync ist geschnitten', rumpf.length > 400, { laenge: rumpf.length });
check('0c: der Kampfvermerk wird VOR dem Halter-Filter ausgewertet',
  rumpf.indexOf('p.letzterKampf') > 0 && rumpf.indexOf('p.letzterKampf') < rumpf.indexOf("if (p.halter !== eigen) continue;"),
  { vermerk: rumpf.indexOf('p.letzterKampf'), halterFilter: rumpf.indexOf("if (p.halter !== eigen) continue;") });

function feldMit(vork){
  return { systeme:[SYS], felder:{ [SYS]: { plaetze: { [PLATZ]: Object.assign(
    { sorte:'kometenkern', groesse:'kern', vorrat:480000 }, vork) } } } };
}
function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'asteroid/field') return j(store.__feld);
    if (p === 'asteroid/claim') return j({ ok:true, halter:'u', halterName:'A', tag:'', seit:1, eskorte:{} });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications:[] });
    if (p === 'reports'){
      // `id` und `time` ergaenzt der ECHTE Server (addReport in server.js) - ohne sie zeichnet der
      // Client keinen Zeitstempel, und die Kartensuche im Test findet gar nichts.
      if (req.method() === 'POST'){
        try { store.__berichte.unshift(Object.assign({ id: 'r' + (++store.__nr), time: Date.now() },
          JSON.parse(req.postData()||'{}').report || {})); } catch(e){}
        return j({ ok:true });
      }
      return j({ reports: store.__berichte });
    }
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}
async function tab(browser, save, feld){
  const store = { __berichte: [], __nr: 0, __feld: feld };
  if (save) store[SAVE_KEY] = save;
  const ctx = await browser.newContext({ viewport:{ width:1100, height:1600 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message || e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await logMitschnitt(page);
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
    'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}

(async () => {
  const browser = await starteBrowser();
  const roh = await tab(browser, null, feldMit({}));
  const basis = roh.stand();
  await roh.ctx.close();
  check('0d: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }
  const HEIMAT = basis.activeBasePlanet || 'home';
  const STATIONIERT_SEIT = Date.now() - 3600000;

  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    st.research = st.research || {};
    st.research.rminentechnik = 1; st.research.rschuerfrecht = 1;
    st.fleet.cruisers = 5; st.fleet.jaeger = 40;
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift'])
      if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    st.seenTabHints = ['basis','forschung','bau','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil'];
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 400000;
    // 20 Kreuzer stehen als Eskorte am Vorkommen - aus der Flotte heraus, wie beim Stationieren.
    st.asteroidEskorten = { [SCHLUESSEL]: { schiffe: { cruisers: 20 }, heimat: HEIMAT, seit: STATIONIERT_SEIT } };
    delete st.asteroidFeld;
    return JSON.stringify(st);
  }
  const vermerk = (verloren, verluste) => ({ zeit: Date.now(), verlierer: 'u', verloren: verloren,
    angreifer: 'Rivale', verluste: verluste });

  async function lauf(feld){
    const t = await tab(browser, fixture(), feld);
    await t.page.waitForTimeout(4000);
    const fx = t.store[SAVE_KEY];
    for (let i = 0; i < 30 && t.store[SAVE_KEY] === fx; i++) await t.page.waitForTimeout(400);
    return t;
  }
  const eintragVon = t => (t.stand().asteroidEskorten || {})[SCHLUESSEL] || null;
  const berichtVon = t => (t.store.__berichte || []).find(b => b && b.type === 'asteroid-verteidigung') || null;
  async function karten(t){
    await t.page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="berichte"]'); if (b) b.click(); });
    await t.page.waitForTimeout(600);
    // Der Cache hinter der Box wird nur alle 15 s nachgeladen; der Bericht entsteht aber ERST beim
    // Feld-Abgleich. Ohne diesen Anstoss misst der Test das Warten und nicht den Bericht - und die
    // Karte waere leer, ohne dass irgendetwas kaputt ist.
    await t.page.evaluate(() => { const b = document.getElementById('refreshReportsBtn'); if (b) b.click(); });
    await t.page.waitForTimeout(1800);
    return t.page.evaluate(() => {
      const box = document.getElementById('reportsBox');
      if (!box) return [];
      return [...box.children].filter(el => /\d\d\.\d\d\., \d\d:\d\d/.test(el.textContent))
        .map(el => el.textContent.replace(/\s+/g, ' ').trim());
    });
  }

  // ---- 1) Das Recht ist durch KAMPF weg: die Wache ist gefallen -------------------------------
  const t1 = await lauf(feldMit({ halter:'rivale', halterName:'Rivale', tag:'', seit:Date.now(),
    eskorte:{}, letzterKampf: vermerk(true, { cruisers: 20 }) }));
  check('1a: nach dem verlorenen Recht steht KEINE Geisterflotte mehr am Vorkommen',
    eintragVon(t1) === null, { eintrag: eintragVon(t1) });
  const b1 = berichtVon(t1);
  check('1b: es gibt einen Bericht - und er nennt Angreifer, Ort und die Verluste',
    !!b1 && b1.angreifer === 'Rivale' && b1.rechtWeg === true && b1.verlorenGesamt === 20 && !!b1.ort,
    b1 ? { angreifer: b1.angreifer, rechtWeg: b1.rechtWeg, verloren: b1.verlorenGesamt, ort: b1.ort }
       : { berichte: (t1.store.__berichte||[]).map(x => x.type) });
  const k1 = await karten(t1);
  const karte1 = k1.find(x => /Schürfrecht verloren/.test(x)) || '';
  check('1c-vorab: die Karte wurde überhaupt gezeichnet - sonst wäre 1d aus dem falschen Grund grün',
    karte1.length > 0, { gezeichnet: k1.length, karten: k1.map(x => x.slice(0, 45)) });
  check('1c: die Berichtskarte sagt, was geschehen ist - nicht nur Pille und Datum',
    karte1.length > 60 && /Rivale/.test(karte1), { karte: karte1.slice(0, 140) });
  check('1d: und sie ist NICHT als Gewonnen markiert', !/Gewonnen/.test(karte1),
    { karte: karte1.slice(0, 90) });
  // Der Anker von ausserhalb (Hausregel 62): Was BIETET das Kartenmenue an? Genau dort stand vorher
  // die vollstaendige Vorkampf-Flotte, und ein Klick gab sie zurueck.
  await t1.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t1.page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(t1.page, SYS);
  await t1.page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]');
    if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, PLATZ);
  await t1.page.waitForTimeout(900);
  const menue1 = await t1.page.evaluate(() => [...document.querySelectorAll('button, [role="button"]')]
    .map(b => (b.textContent||'').trim()).filter(x => /Eskorte/.test(x)));
  check('1e: das Kartenmenü bietet keine gestrandete Eskorte mehr an',
    !menue1.some(x => /Gestrandete Eskorte/.test(x)), { eintraege: menue1 });
  check('1f: keine Seitenfehler', t1.errs.length === 0, { seitenfehler: t1.errs.slice(0,3) });
  await t1.ctx.close();

  // ---- 2) Der Angriff wurde ABGEWEHRT: das Recht bleibt, die Verluste werden gebucht ----------
  const t2 = await lauf(feldMit({ halter:'u', halterName:'A', tag:'', seit:1,
    eskorte:{ cruisers: 12 }, letzterKampf: vermerk(false, { cruisers: 8 }) }));
  const e2 = eintragVon(t2);
  check('2a: die Eskorte ist um GENAU die gemeldeten Verluste kleiner',
    !!e2 && e2.schiffe && e2.schiffe.cruisers === 12, { eintrag: e2 && e2.schiffe });
  check('2a2: und der Kampf ist als gebucht vermerkt - eine zweite Runde zieht nicht nochmal ab',
    !!e2 && e2.kampfGebucht > 0, { kampfGebucht: e2 && e2.kampfGebucht });
  const b2 = berichtVon(t2);
  check('2b: auch die geglückte Abwehr schreibt einen Bericht',
    !!b2 && b2.rechtWeg === false && b2.verlorenGesamt === 8 && b2.uebrig === 12,
    b2 ? { rechtWeg: b2.rechtWeg, verloren: b2.verlorenGesamt, uebrig: b2.uebrig }
       : { berichte: (t2.store.__berichte||[]).map(x => x.type) });
  const k2 = await karten(t2);
  const karte2 = k2.find(x => /Eskorte hat gehalten/.test(x)) || '';
  check('2c-vorab: die Karte der Abwehr wurde gezeichnet',
    karte2.length > 0, { gezeichnet: k2.length, karten: k2.map(x => x.slice(0, 45)) });
  check('2c: die Karte der Abwehr gilt als Gewonnen', /Gewonnen/.test(karte2), { karte: karte2.slice(0, 110) });
  await t2.ctx.close();

  // ---- 3) Ein Vermerk, der ÄLTER ist als die Stationierung, darf NICHTS abziehen --------------
  // Der Vermerk hängt am VORKOMMEN und überlebt einen Besitzwechsel. Ohne diese Wache würde eine
  // frisch stationierte Eskorte durch einen längst abgegoltenen Kampf dezimiert.
  const t3 = await lauf(feldMit({ halter:'u', halterName:'A', tag:'', seit:1, eskorte:{ cruisers: 20 },
    letzterKampf: { zeit: STATIONIERT_SEIT - 60000, verlierer:'u', verloren:false, angreifer:'Alt', verluste:{ cruisers: 20 } } }));
  const e3 = eintragVon(t3);
  check('3a: ein Vermerk von VOR der Stationierung lässt die Eskorte unangetastet',
    !!e3 && e3.schiffe && e3.schiffe.cruisers === 20, { eintrag: e3 && e3.schiffe });
  check('3a2: und er erzeugt auch keinen Bericht', berichtVon(t3) === null,
    { berichte: (t3.store.__berichte||[]).map(x => x.type) });
  await t3.ctx.close();

  // ---- 4) RÜCKFALL: ein Server ohne Kampfvermerk (alter Stand, oder Kampf vor v8.597.0) -------
  // Die Differenz IST die Verlustliste. Bis v8.596.0 stand darüber nur eine log()-Zeile.
  const t4 = await lauf(feldMit({ halter:'u', halterName:'A', tag:'', seit:1, eskorte:{ cruisers: 14 } }));
  const e4 = eintragVon(t4);
  check('4a: auch ohne Vermerk zieht der Abgleich nach', !!e4 && e4.schiffe && e4.schiffe.cruisers === 14,
    { eintrag: e4 && e4.schiffe });
  const b4 = berichtVon(t4);
  check('4b: und er schreibt jetzt ebenfalls einen Bericht - mit 6 Verlusten',
    !!b4 && b4.verlorenGesamt === 6 && b4.rechtWeg === false,
    b4 ? { verloren: b4.verlorenGesamt, rechtWeg: b4.rechtWeg, angreifer: b4.angreifer }
       : { berichte: (t4.store.__berichte||[]).map(x => x.type) });
  check('4c: ohne Vermerk behauptet der Bericht KEINEN Angreifernamen',
    !!b4 && !b4.angreifer, { angreifer: b4 && b4.angreifer });
  await t4.ctx.close();

  // ---- 5) Der Rückruf einer gestrandeten Eskorte behauptet kein Schürfrecht mehr --------------
  // Gemessen am ausgelieferten Stand sagte er "Das Schürfrecht bleibt bestehen, ist aber unbewacht"
  // - über einem Vorkommen, das gerade den Besitzer gewechselt hatte.
  const t5 = await lauf(feldMit({ halter:'rivale', halterName:'Rivale', tag:'', seit:Date.now(), eskorte:{} }));
  const e5 = eintragVon(t5);
  check('5-vorab: ohne Kampfvermerk bleibt die Eskorte stehen - sie ist wirklich gestrandet',
    !!e5 && e5.schiffe && e5.schiffe.cruisers === 20, { eintrag: e5 && e5.schiffe });
  await t5.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t5.page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(t5.page, SYS);
  await t5.page.evaluate(pl => { const n = document.querySelector('[data-map-asteroid="' + pl + '"]');
    if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, PLATZ);
  await t5.page.waitForTimeout(900);
  const geklickt = await t5.page.evaluate(() => {
    const b = [...document.querySelectorAll('button, [role="button"]')]
      .find(x => /Gestrandete Eskorte zurückrufen/.test(x.textContent || ''));
    if (!b) return false; b.click(); return true;
  });
  check('5-vorab2: der Rückruf-Eintrag war da und wurde geklickt', geklickt === true);
  await t5.page.waitForTimeout(1200);
  const zeilen = (await logZeilen(t5.page)).filter(z => /kehrt vom/.test(z));
  check('5a: der Rückruf behauptet nicht, das Schürfrecht bestehe weiter',
    zeilen.length > 0 && zeilen.every(z => !/Schürfrecht bleibt bestehen/.test(z)),
    { zeilen: zeilen.slice(-2) });
  check('5b: er sagt stattdessen, dass dort keins mehr gehalten wird',
    zeilen.some(z => /hältst du dort nicht mehr/.test(z)), { zeilen: zeilen.slice(-2) });
  await t5.ctx.close();

  await browser.close();
  ende();
})();
