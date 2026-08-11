// Der Deckel auf der T1-Grundlast (v8.486.0, Konzept docs/asteroiden-konzept.md Abschnitt 4).
//
// WAS HIER AUF DEM SPIEL STEHT: Das ist der einzige Schritt des Asteroiden-Umbaus, der Spielern
// etwas WEGNIMMT - die Produktionsgebäude sind ab Stufe 16 abgeflacht und ab 25 nicht mehr
// ausbaubar. Ein Fehler an dieser Stelle ist deshalb keine fehlende Funktion, sondern eine
// unangekündigte Enteignung. Der Test hält beide Enden fest: dass die Abflachung wirklich greift
// (und zwar überall gleich), und dass der einmalige Ausgleich wirklich ankommt.
//
// GEPRUEFT WIRD:
//   1. Die Formel selbst, aus der Spieldatei geholt und AUSGEFUEHRT: unterhalb der Schwelle ändert
//      sich nichts, darüber zählt jede Stufe halb, und sie ist streng monoton - es gibt keine
//      Stufe, die gar nichts mehr bringt (genau das wäre eine Wand statt einer Abflachung).
//   2. Die Definitionen tragen den Deckel: vier T1-Produzenten abgeflacht, Solar bewusst NICHT.
//   3. Am laufenden Spiel: Die angezeigte Rate der Erzmine folgt der Abflachung. Gemessen als
//      VERHAELTNIS zweier Läufe (Stufe 15 gegen Stufe 40) - so kürzen sich alle Multiplikatoren
//      heraus, und der Test hängt nicht an einer eingetippten Absolutzahl (Arbeitsregel 2).
//   4. Der einmalige Ausgleich: richtige Stufenzahl, Rückerstattung, sechs Minenschiffe - und beim
//      ZWEITEN Laden passiert nichts mehr. Ein Ausgleich, der sich wiederholt, wäre eine Gelddruck-
//      maschine; einer, der nicht ankommt, wäre eine Enteignung.
//   5. Der Deckel blockt den Ausbau, ohne bestehende Stufen abzusenken.
//
// GEGENPROBE (Arbeitsregel 1, in BEIDE Richtungen ausgeführt):
//   - Am alten Stand (v8.485.0) gibt es weder wirksameStufen noch flachAb: 0a und 2 fallen.
//   - Nimmt man flachAb bei der Erzmine heraus, misst 3b das Verhältnis 40/15 statt 27,5/15.
//   - Setzt man den Ausgleich zurück in applyStateDefaults(), bleibt der Test GRÜN. Das ist nach
//     Arbeitsregel 26 der Befund und nicht der Beweis, deshalb steht es hier statt weggelassen zu
//     werden: Gemessen (Instrumentierung am 11.08.2026) lief die Funktion von dort aus VIERMAL je
//     Laden, dreimal auf einem Zustand mit lauter Nullen. Dass die Auszahlung trotzdem ankam, hing
//     daran, dass die früh gesetzte Marke beim Verschmelzen des Spielstands zufällig wieder
//     verschwand. Ein beobachtbarer Unterschied zwischen beiden Platzierungen ließ sich im
//     jetzigen Code NICHT konstruieren - der Umzug in den Ladepfad beseitigt also eine
//     Zufalls-Abhängigkeit, keinen sichtbaren Fehler. Punkt 4h hält deshalb nur die STRUKTUR fest
//     (aufgerufen aus dem Ladepfad, nicht aus applyStateDefaults) und gibt nicht vor, mehr zu
//     belegen, als er kann.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 0) Extraktion. Regel 6: erst pruefen, dass BEIDE Anker existieren.
const von = JS.indexOf('  const PROD_FLACH_FAKTOR = ');
const bis = von < 0 ? -1 : JS.indexOf('\n  function ratesPerSecond(', von);
check('0a: der Abflachungs-Block steht in der Spieldatei', von > 0 && bis > von, { von, bis });
if (von < 0 || bis < 0) return ende();

const { wirksameStufen, PROD_FLACH_FAKTOR } = new Function(
  JS.slice(von, bis) + '\nreturn { wirksameStufen, PROD_FLACH_FAKTOR };')();

// ---- 1) Die Formel ------------------------------------------------------------------------
{
  check('1a: der Abflachungsfaktor ist die Haelfte', PROD_FLACH_FAKTOR === 0.5, PROD_FLACH_FAKTOR);
  const ohne = { key:'x' };
  let gleich = true;
  for (let n = 0; n <= 60; n++) if (wirksameStufen(ohne, n) !== n) gleich = false;
  check('1b: ohne flachAb aendert sich GAR NICHTS (kein Gebaeude wird nebenbei getroffen)', gleich);

  const def = { key:'mine', flachAb:15 };
  let unveraendert = true;
  for (let n = 0; n <= 15; n++) if (wirksameStufen(def, n) !== n) unveraendert = false;
  check('1c: bis zur Schwelle zaehlt jede Stufe voll', unveraendert);
  check('1d: darueber zaehlt jede Stufe halb', wirksameStufen(def, 25) === 20 && wirksameStufen(def, 40) === 27.5,
    { bei25: wirksameStufen(def, 25), bei40: wirksameStufen(def, 40) });
  // Streng monoton: Das ist der Unterschied zwischen einer Abflachung und einer Wand. Eine Stufe,
  // die nichts mehr bringt, ist ein Knopf, der nichts tut - genau das sollte vermieden werden.
  let monoton = true;
  for (let n = 0; n < 80; n++) if (!(wirksameStufen(def, n+1) > wirksameStufen(def, n))) monoton = false;
  check('1e: streng monoton - keine Stufe ist wertlos', monoton);
  check('1f: negative oder fehlende Stufen ergeben 0, nicht NaN',
    wirksameStufen(def, -5) === 0 && wirksameStufen(def, undefined) === 0);
}

// ---- 2) Die Definitionen ------------------------------------------------------------------
{
  const zeile = k => (JS.match(new RegExp("\\{ key:'" + k + "',[^\\n]*")) || [])[0] || '';
  for (const k of ['mine','raffinerie','synth','fusionsreaktor']){
    const z = zeile(k);
    check('2: ' + k + ' ist gedeckelt (25) und ab 15 abgeflacht',
      /maxLevel:25/.test(z) && /flachAb:15/.test(z), z.slice(-70));
  }
  const zs = zeile('solar');
  // Solar bewusst ohne Abflachung: Energie ist seit v8.485.0 der Betriebsstoff der Aufbereitung.
  // Ein Deckel auf die Energie wuerde genau das Ventil zudrehen, das der Umbau aufmachen soll.
  check('2: solar ist gedeckelt (40), aber NICHT abgeflacht',
    /maxLevel:40/.test(zs) && !/flachAb/.test(zs), zs.slice(-70));
}

// ---- 4h) Wo der Ausgleich aufgerufen wird (Struktur, siehe Kopfkommentar) ------------------
{
  // Der Schnitt endet an der SCHLIESSENDEN Klammer von applyStateDefaults, nicht an der naechsten
  // Funktion: Die Definition von deckelAusgleich() steht direkt dahinter, und `deckelAusgleich()`
  // ist Teil von `function deckelAusgleich(){` - der erste Anlauf schlug genau daran an und haette
  // eine korrekte Datei angeschwaerzt. Gesucht wird deshalb der AUFRUF mit Semikolon.
  const anfang = JS.indexOf('function applyStateDefaults(){');
  const defaults = JS.slice(anfang, JS.indexOf('\n  }\n', anfang));
  check('4h: applyStateDefaults() ruft den Ausgleich NICHT auf (laeuft auch vor dem Laden und beim Prestige)',
    anfang > 0 && defaults.length > 100 && !/deckelAusgleich\(\);/.test(defaults), defaults.length);
  const ladepfad = JS.slice(JS.indexOf('state = Object.assign(state, parsedSave);'));
  check('4h2: der Ladepfad ruft ihn auf, nachdem der Spielstand verschmolzen ist',
    /deckelAusgleich\(\);/.test(ladepfad.slice(0, 30000)));
}

// ================================================================== am laufenden Spiel
const SAVE_KEY = 'kepler7-save-v3';

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
    if (req.method() === 'POST'){ try { store.__berichte.unshift(JSON.parse(req.postData()||'{}').report || {}); } catch(e){} return j({ ok:true }); }
    return j({ reports: store.__berichte });
  }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

async function tab(browser, startSave, store){
  store = store || { __berichte: [] };
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
// Auf einen Save warten, der die gesuchte Marke wirklich traegt. Ohne das misst man den eigenen
// Ausgangsstand: Das Spiel speichert alle zehn Sekunden, der Mock haelt bis dahin die Fixture -
// genau daran sah der Ausgleich beim ersten Anlauf wie kaputt aus, obwohl er lief.
async function wartenAufMarke(t, text, sekunden){
  for (let i = 0; i < (sekunden||30)*2 && !String(t.store[SAVE_KEY]||'').includes(text); i++) await t.page.waitForTimeout(500);
}
// Die angezeigte Rate eines Gebaeudes von seiner Karte im Basis-Reiter.
async function karte(t, name){
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="basis"]'); if (x) x.click(); });
  await t.page.waitForTimeout(1500);
  return t.page.evaluate(n => {
    for (const row of document.querySelectorAll('#buildings .card-row')){
      const bname = (row.querySelector('.bname')||{}).textContent || '';
      if (!bname.trim().startsWith(n)) continue;
      const prod = (row.querySelector('.prodline')||{}).textContent || '';
      const m = prod.match(/Produktion: \+([\d.,]+)\/s/);
      return {
        rate: m ? parseFloat(m[1].replace(/\./g,'').replace(',','.')) : null,
        prodline: prod,
        maxed: /Maximalstufe erreicht/.test(row.textContent),
        kaufbar: !!row.querySelector('button.buy:not([disabled])')
      };
    }
    return null;
  }, name);
}

(async () => {
  const browser = await starteBrowser();

  // Ausgangsstand vom SPIEL erzeugen lassen (Arbeitsregel 4: nichts erfinden)
  const roh = await tab(browser);
  const basis = roh.stand();
  await roh.ctx.close();
  check('3-0: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  function fixture(mineStufe, extra){
    const st = JSON.parse(JSON.stringify(basis));
    Object.assign(st.buildings, { solar:35, mine:mineStufe, raffinerie:34, synth:30, fusionsreaktor:26, habitat:20, lager:45, labor:10 });
    st.research = Object.assign(st.research || {}, { rsolar:15, rerz:15 });
    st.fleet.schuerfschiff = 0;
    delete st.deckelAusgleich2026;   // ein Bestandskonto kennt die Marke nicht
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 1000;
    if (extra) extra(st);
    return JSON.stringify(st);
  }

  // ---- 3) Die Abflachung wirkt wirklich, gemessen als Verhaeltnis ---------------------------
  const t15 = await tab(browser, fixture(15));
  const k15 = await karte(t15, 'Erzmine');
  await t15.ctx.close();
  const t40 = await tab(browser, fixture(40));
  const k40 = await karte(t40, 'Erzmine');
  check('3a: beide Laeufe liefern eine Rate', !!(k15 && k15.rate) && !!(k40 && k40.rate), { k15: k15 && k15.rate, k40: k40 && k40.rate });
  if (k15 && k15.rate && k40 && k40.rate){
    const gemessen = k40.rate / k15.rate;
    // 40 Stufen ergeben wirksam 15 + 25*0,5 = 27,5. Ohne Abflachung stuende hier 40/15 = 2,667.
    const erwartet = wirksameStufen({ flachAb:15 }, 40) / 15;
    check('3b: Stufe 40 bringt das 27,5/15-fache von Stufe 15, nicht das 40/15-fache',
      Math.abs(gemessen - erwartet) < 0.02, { gemessen: +gemessen.toFixed(4), erwartet, ohneAbflachung: +(40/15).toFixed(4) });
  }
  check('3c: die Karte erklaert die Abflachung, statt sie nur zu tun',
    !!k40 && /zählt jede weitere Stufe nur noch halb/.test(k40.prodline), k40 && k40.prodline.slice(0, 160));
  await t40.ctx.close();

  // ---- 5) Der Deckel blockt den Ausbau, senkt aber nichts ab --------------------------------
  const tMax = await tab(browser, fixture(25));
  const kMax = await karte(tMax, 'Erzmine');
  check('5a: auf dem Deckel ist die Karte "maxed" und hat keinen Kaufknopf mehr',
    !!kMax && kMax.maxed === true && kMax.kaufbar === false, kMax && { maxed: kMax.maxed, kaufbar: kMax.kaufbar });
  await tMax.ctx.close();

  // ---- 4) Der einmalige Ausgleich ------------------------------------------------------------
  const store = { __berichte: [] };
  const t = await tab(browser, fixture(40), store);
  await wartenAufMarke(t, 'deckelAusgleich2026', 40);
  const nach = t.stand();
  const bericht = (store.__berichte || []).filter(r => r.type === 'deckelausgleich');
  const b = bericht[0];
  // Erwartete Stufenzahl aus dem Fixture ABGELEITET, nicht eingetippt: mine 40, raffinerie 34,
  // synth 30, fusionsreaktor 26, alle gedeckelt bei 25.
  const sollStufen = [40,34,30,26].reduce((a, l) => a + Math.max(0, l - 25), 0);
  check('4a: es gibt genau EINEN Ausgleichs-Bericht', bericht.length === 1, bericht.length);
  check('4b: er nennt die richtige Zahl an Stufen ueber dem Deckel',
    !!b && b.stufen === sollStufen, { gemeldet: b && b.stufen, erwartet: sollStufen });
  check('4c: sechs Minenschiffe sind wirklich im Spielstand angekommen',
    (nach.fleet||{}).schuerfschiff === 6, (nach.fleet||{}).schuerfschiff);
  check('4d: es wurde etwas zurueckerstattet und die Marke steht',
    !!b && Object.keys(b.angekommen||{}).length > 0 && nach.deckelAusgleich2026 === true,
    { angekommen: b && b.angekommen, marke: nach.deckelAusgleich2026 });
  // Am Lagerdeckel Verfallenes wird ausgewiesen statt verschwiegen - das Fixture hat bewusst ein
  // kleines Lager, der groessere Teil passt gar nicht hinein.
  check('4e: was am vollen Lager verfaellt, steht im Bericht',
    !!b && Object.keys(b.verfallen||{}).length > 0, b && b.verfallen);
  // Die bestehenden Stufen bleiben stehen - der Deckel nimmt niemandem etwas ab, was schon da ist.
  check('4f: die Gebaeudestufen ueber dem Deckel wurden NICHT abgesenkt',
    (nach.buildings||{}).mine === 40, (nach.buildings||{}).mine);
  await t.ctx.close();

  // Zweites Laden mit demselben (jetzt fortgeschriebenen) Spielstand: nichts darf noch einmal
  // ausgezahlt werden. Ein Ausgleich, der sich wiederholt, ist eine Gelddruckmaschine.
  const store2 = { __berichte: [] };
  const t2 = await tab(browser, JSON.stringify(nach), store2);
  await t2.page.waitForTimeout(6000);
  const nach2 = t2.stand();
  check('4g: beim ZWEITEN Laden gibt es keinen zweiten Ausgleich',
    (store2.__berichte||[]).filter(r => r.type === 'deckelausgleich').length === 0
    && (nach2.fleet||{}).schuerfschiff === 6,
    { berichte: (store2.__berichte||[]).filter(r => r.type === 'deckelausgleich').length, schiffe: (nach2.fleet||{}).schuerfschiff });
  const fehler = [...t.errs, ...t2.errs, ...t40.errs].filter(e => !/favicon|net::ERR|CORS|404/i.test(e));
  check('6: keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
  await t2.ctx.close();

  await browser.close();
  return ende();
})();
