// Der Ausbau-Deckel des Forschungslabors (16.08.2026, Auftrag Sascha: "Forschungslabor braucht
// auch ein Cap").
//
// WAS HIER AUF DEM SPIEL STEHT: Das Labor war nach dem Sommer-Umbau das letzte Dauer-Gebaeude
// ohne Deckel - und es produziert mit den Forschungspunkten ausgerechnet die Ressource, die
// bewusst der Engpass des Spiels ist (keine Prestige-/Kommandanten-/Allianz-Boni, siehe
// HELP_SECTIONS). Ohne Deckel waechst die FP-Produktion unbegrenzt mit Laborstufen; mit Deckel,
// aber ohne Bestandskappung, gilt er fuer Altkonten nicht (genau der Spieler-Report mit Foto,
// der zum zweiten Kappungs-Durchgang fuehrte). Beide Enden werden hier festgehalten.
//
// GEPRUEFT WIRD:
//   1. Die Definition: labor traegt maxLevel 25 - und bewusst KEIN flachAb (die Abflachung war
//      Teil des Minen-Umbaus; hier soll nur der Ausbau enden, keine vorhandene Rate sinken).
//   2. Der DRITTE Kappungs-Durchgang: eigene Marke deckelKappung2026c als Wache (Bestandskonten
//      haben 2026 und 2026b laengst gesetzt - mit einer alten Marke liefe die Labor-Kappung dort
//      nie), alle drei Marken werden gesetzt, beide Reset-Neuaufbauten bewahren die dritte.
//   3. Der Hilfetext leitet den Deckel aus der Def ab, statt eine Zahl einzutippen.
//   4. Am laufenden Spiel: Ein Bestandskonto MIT den Marken der ersten zwei Durchgaenge und
//      Labor 30 steht nach dem Laden auf 25, der Kappungs-Bericht nennt das Labor ohne
//      Erstattungs-Behauptung (fuer das Labor gab es nie eine). Gegenrichtung: Labor 20 bleibt
//      20, und es entsteht KEIN Kappungs-Bericht.
//   5. Die Karte: unter dem Deckel nennt sie "Ausbau bis Stufe 25", auf dem Deckel ist sie
//      maxed ohne Kaufknopf.
//
// GEGENPROBE (Arbeitsregel 1, in beide Richtungen):
//   - Am alten Stand (git show <alt>:weltraum_kolonie.html als Kopie, via KEPLER_SPIELDATEI):
//     1b faellt (kein maxLevel am Labor), 2b faellt (Wache ist noch 2026b), 3b faellt, und im
//     Playwright-Teil bleibt Labor 30 auf 30 stehen (4a faellt). Anzahl gelaufener Pruefungen
//     gegen den gruenen Lauf vergleichen (Arbeitsregel 34).
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) Die Definition --------------------------------------------------------------------
// Scope auf den BUILDING_DEFS-Block (Arbeitsregel 39: key:'labor' koennte auch anderswo leben),
// mit Anker-Existenz-Pruefung (Arbeitsregel 6).
const defsVon = JS.indexOf('const BUILDING_DEFS');
const defsBis = defsVon < 0 ? -1 : JS.indexOf('\n  ];', defsVon);
check('1a: der BUILDING_DEFS-Block steht in der Spieldatei', defsVon > 0 && defsBis > defsVon, { defsVon, defsBis });
const DEFS_BLOCK = (defsVon > 0 && defsBis > defsVon) ? JS.slice(defsVon, defsBis) : '';
const laborZeile = (DEFS_BLOCK.match(/\{ key:'labor',[^\n]*/) || [])[0] || '';
check('1b: das Labor traegt einen Ausbau-Deckel', /maxLevel:\d+/.test(laborZeile), laborZeile.slice(-90));
const deckel = +((laborZeile.match(/maxLevel:(\d+)/) || [])[1] || 0);
check('1c: der Deckel ist 25 - dieselbe Klasse wie die T1-Produzenten (test_t1_deckel prueft deren 25)',
  deckel === 25, deckel);
check('1d: bewusst OHNE flachAb - keine vorhandene Rate sinkt, nur der Ausbau endet',
  laborZeile.length > 0 && !/flachAb/.test(laborZeile), laborZeile.slice(-90));

// ---- 2) Der dritte Kappungs-Durchgang -----------------------------------------------------
{
  const kv = JS.indexOf('function deckelKappung(){');
  check('2a: deckelKappung existiert', kv > 0, kv);
  const kBlock = kv > 0 ? JS.slice(kv, kv + 700) : '';
  check('2b: die Wache ist die DRITTE Marke (Bestandskonten haben die ersten zwei laengst)',
    /if \(state\.deckelKappung2026c\) return;/.test(kBlock), kBlock.slice(0, 200));
  check('2c: alle drei Marken werden gesetzt (die frueheren Durchgaenge sind enthalten)',
    /state\.deckelKappung2026c = true/.test(kBlock)
    && /state\.deckelKappung2026b = true/.test(kBlock)
    && /state\.deckelKappung2026 = true/.test(kBlock));
  // Die REGEL ist "beide Reset-Neuaufbauten bewahren die Marke" - mindestens 2 Fundstellen,
  // kein exakter Zaehler (Arbeitsregel 3/33: eine dritte legitime Stelle darf dazukommen).
  const bewahrt = (JS.match(/deckelKappung2026c: !!state\.deckelKappung2026c/g) || []).length;
  check('2d: Prestige UND Aufstieg bewahren die dritte Marke', bewahrt >= 2, bewahrt);
}

// ---- 3) Der Hilfetext ---------------------------------------------------------------------
{
  const hv = JS.indexOf("title:'Forschungslabor: Tempo & Forschungspunkte'");
  check('3a: der Hilfe-Abschnitt zum Labor existiert', hv > 0, hv);
  const zeilenEnde = hv > 0 ? JS.indexOf('\n', hv) : -1;
  const hZeile = hv > 0 ? JS.slice(hv, zeilenEnde) : '';
  check('3b: der Hilfetext leitet den Deckel aus der Def ab, statt eine Zahl einzutippen',
    /BUILDING_DEFS\.find\(d=>d\.key==="labor"\)\.maxLevel/.test(hZeile), hZeile.slice(0, 200));
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
async function wartenAufMarke(t, text, sekunden){
  for (let i = 0; i < (sekunden||30)*2 && !String(t.store[SAVE_KEY]||'').includes(text); i++) await t.page.waitForTimeout(500);
}
// Die Labor-Karte im Basis-Reiter, gescoped auf ihre eigene card-row (Arbeitsregel 5).
async function laborKarte(t){
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="basis"]'); if (x) x.click(); });
  await t.page.waitForTimeout(1500);
  return t.page.evaluate(() => {
    for (const row of document.querySelectorAll('.card-row')){
      const bname = (row.querySelector('.bname')||{}).textContent || '';
      if (!bname.trim().startsWith('Forschungslabor')) continue;
      return {
        text: row.textContent,
        maxed: /Ausbau-Deckel|Maximalstufe/.test(row.textContent),
        kaufbar: !!row.querySelector('button.buy:not([disabled])')
      };
    }
    return null;
  });
}

(async () => {
  const browser = await starteBrowser();

  // Ausgangsstand vom Spiel erzeugen lassen (Arbeitsregel 4: nichts erfinden).
  const roh = await tab(browser);
  const basis = roh.stand();
  await roh.ctx.close();
  check('4-0: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  function fixture(laborStufe){
    const st = JSON.parse(JSON.stringify(basis));
    st.buildings.labor = laborStufe;
    // DAS Bestandskonto-Szenario: die Marken der ersten zwei Durchgaenge sind GESETZT (jedes
    // echte Konto traegt sie seit v8.493/v8.508), nur die dritte fehlt. Genau dort muss die
    // Labor-Kappung trotzdem laufen - mit abgestreiften alten Marken wuerde der Test die
    // falsche, leichtere Frage beantworten.
    st.deckelKappung2026 = true;
    st.deckelKappung2026b = true;
    st.deckelAusgleich2026 = true;
    delete st.deckelKappung2026c;
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    return JSON.stringify(st);
  }

  // ---- 4) Bestandskonto ueber dem Deckel: gekappt + Bericht ohne Erstattungs-Behauptung ----
  const store30 = { __berichte: [] };
  const t30 = await tab(browser, fixture(30), store30);
  await wartenAufMarke(t30, 'deckelKappung2026c', 25);
  const stand30 = t30.stand();
  check('4a: ein Labor-30-Bestandskonto (mit den Marken der ersten zwei Durchgaenge) steht nach dem Laden auf dem Deckel',
    (stand30.buildings.labor || 0) === deckel, { labor: stand30.buildings.labor, deckel });
  check('4b: die dritte Marke ist gesetzt', stand30.deckelKappung2026c === true, stand30.deckelKappung2026c);
  const bericht = (store30.__berichte || []).find(b => b && b.type === 'deckelkappung');
  const laborEintrag = bericht && (bericht.gekappt || []).find(g => g.name === 'Forschungslabor');
  check('4c: der Kappungs-Bericht nennt das Labor mit alter und neuer Stufe',
    !!laborEintrag && laborEintrag.von === 30 && laborEintrag.auf === deckel, laborEintrag);
  check('4d: der Bericht behauptet fuer das Labor KEINE Erstattung (es gab nie eine)',
    !!laborEintrag && laborEintrag.erstattet === false, laborEintrag);
  check('4e: keine Konsolenfehler beim Kappungs-Lauf', t30.errs.length === 0, t30.errs.slice(0, 3));
  await t30.ctx.close();

  // ---- Gegenrichtung: unter dem Deckel wird NICHTS gekappt und NICHTS berichtet ------------
  const store20 = { __berichte: [] };
  const t20 = await tab(browser, fixture(20), store20);
  await wartenAufMarke(t20, 'deckelKappung2026c', 25);
  const stand20 = t20.stand();
  check('4f: ein Labor-20-Konto bleibt unangetastet', (stand20.buildings.labor || 0) === 20, stand20.buildings.labor);
  check('4g: es entsteht KEIN Kappungs-Bericht (nichts lag ueber einem Deckel)',
    !(store20.__berichte || []).some(b => b && b.type === 'deckelkappung'),
    (store20.__berichte || []).filter(b => b && b.type === 'deckelkappung').length);

  // ---- 5) Die Karte ------------------------------------------------------------------------
  const k20 = await laborKarte(t20);
  check('5a: unter dem Deckel nennt die Karte das Ausbau-Ende ("Ausbau bis Stufe ' + deckel + '")',
    !!k20 && new RegExp('Ausbau bis Stufe ' + deckel).test(k20.text) && k20.maxed === false,
    k20 && { maxed: k20.maxed, hinweis: (k20.text.match(/Ausbau bis Stufe \d+/) || [])[0] });
  await t20.ctx.close();

  const tCap = await tab(browser, fixture(deckel));
  const kCap = await laborKarte(tCap);
  check('5b: auf dem Deckel ist die Karte maxed und hat keinen Kaufknopf mehr',
    !!kCap && kCap.maxed === true && kCap.kaufbar === false, kCap && { maxed: kCap.maxed, kaufbar: kCap.kaufbar });
  await tCap.ctx.close();

  await browser.close();
  ende();
})();
