// Saison-Auftragsbuch im Spiel (Feature B, 11.09.2026): die Box unter der Saison-Liga, das Abholen,
// die drei Zustaende, der Belohnungszweig und der Bericht.
//
// Die serverseitigen Regeln (Zaehlung nur im Erfolgspfad, Tagesdeckel, Saisonwechsel) misst
// tests/test_auftragsbuch_http.js im BACKEND-Repo; hier geht es um das, was der Spieler sieht.
//
// VIER DINGE, DIE DIESER TEST ABSICHERT, jedes mit belegtem Grund:
//
//  1) DER EIGENE `auftragsbuch`-ZWEIG in claimPendingRewards ist PFLICHT. Ohne ihn faellt jede
//     Stufe in den Rueckfall und meldet dem Spieler woertlich "Dankeschoen vom Team: +130 Kredite
//     fuer deinen Bug-Report!" - eine Falschaussage (Abschnitt 5).
//
//  2) DREI ZUSTAENDE (Hausregel 35): Daten -> Box mit Punkten, Chips und Knopf (Abschnitt 1);
//     404 vom alten Server -> die GANZE Flaeche samt Titel weg, kein leerer Rahmen, keine Meldung,
//     und kein minuetliches Nachfragen (Abschnitt 3); echter Fehler -> Box nennt den Servertext
//     (Abschnitt 4).
//
//  3) ABHOLEN IST EIN WEG, NICHT ZWEI: Der Knopf ruft POST /abholen und danach claimPendingRewards -
//     die Kredite kommen aus dem Reward, nie aus der Antwort des Abholens (Abschnitt 2).
//
//  4) DIE VERDRAHTUNG STAPELT SICH NICHT: render() laeuft jede Sekunde, der Knopf haengt per
//     onclick, und die Box fragt den Server beim Oeffnen EINMAL, nicht je Tick (Abschnitte 0/1).
//
// GEGENPROBE (GEMESSEN 11.09.2026: `git stash push weltraum_kolonie.html`, Test, `git stash pop`):
// am alten Stand fallen 0-anker, 0a-0e, 1a-1f (mit 1e2), 2a, 2c, 2d, 2e, 3a, 3c, 4a, 5a-5d.
// Gruen bleiben 0f, 2f, 3b, 5e (die Seite laeuft ohne Fehler weiter - das ist der Punkt) und 2b:
// claimPendingRewards laeuft beim Start ohnehin, deshalb misst 2b nur MIT 2a/2c etwas. Die erste
// Fassung der Gegenprobe starb nach 1d an `undefined.length` - seither liefert boxSicht am alten
// Stand eine leere, vollstaendige Antwort, damit jede Pruefung einzeln faellt.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer, logMitschnitt, logZeilen } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';

// ---------------------------------------------------------------- 0) Verdrahtung im Quelltext
const rueckfallStelle = JS.indexOf("log('Dankeschön vom Team: +'");
const zweigStelle = JS.indexOf("if (r.type === 'auftragsbuch'){");
check('0-anker: Rueckfall und Auftragsbuch-Zweig gefunden', rueckfallStelle > 0 && zweigStelle > 0,
  { zweig: zweigStelle, rueckfall: rueckfallStelle });
check('0a: der Auftragsbuch-Zweig steht VOR dem Rueckfall-Zweig - sonst greift der Rueckfall zuerst',
  zweigStelle > 0 && rueckfallStelle > 0 && zweigStelle < rueckfallStelle);
check('0b: der Abhol-Knopf wird per onclick verdrahtet, nicht per addEventListener',
  /auftragsbuchAbholenBtn'\);\s*if \(btn\) btn\.onclick *=/.test(JS) && !/auftragsbuchAbholenBtn[^\n]*addEventListener/.test(JS));
check('0c: der Bericht traegt KEINE Gewonnen/Verloren-Pille - eine Stufe hat keinen Ausgang',
  /REPORT_SPECIAL_GREEN_TYPES = \[[^\]]*'auftragsbuch'/.test(JS));
check('0d: die Hilfe erklaert das Buch unter "Fortschritt" - mit Tagesdeckel, Stufen und Titel',
  (() => {
    const i = HTML.indexOf("title:'Saison-Auftragsbuch'");
    const fortschritt = HTML.indexOf("key:'fortschritt'");
    const naechste = HTML.indexOf("key:'automatisierung'");
    if (i < 0 || fortschritt < 0) return false;
    const body = HTML.slice(i, i + 2500);
    return i > fortschritt && i < naechste && /Tagesdeckel/.test(body) && /20 Stufen/.test(body) && /Chronist der Saison/.test(body);
  })());
check('0e: die Box liegt im Rang-Unterreiter, laedt im 60-s-Takt und nur dort',
  /id="auftragsbuchWrap"/.test(HTML) && /AUFTRAGSBUCH_TAKT_MS = 60000/.test(JS) &&
  /state\.galaxySubTab === 'rang'/.test(JS.slice(JS.indexOf('function renderAuftragsbuch('), JS.indexOf('function renderAuftragsbuch(') + 1500)));

// ---------------------------------------------------------------- Attrappe
const GALAXIE = { collapsedSystems: {}, controlledSystems: {}, news: [], activeWar: null, activeWormhole: null,
  npcEmpireStrength: 1, marketTrend: 1, lastTick: Date.now(), factions: {} };
const STUFEN_AB = [25, 60, 100, 150, 210, 280, 360, 450, 550, 660, 780, 910, 1050, 1200, 1360, 1530, 1710, 1900, 2100, 2310];
function buch(punkte, abgeholt){
  return {
    aktiv: true, saison: '2026-09', endetAm: Date.now() + 20 * 86400000 + 3 * 3600000, punkte,
    taten: { angriff: 3, markt: 10 },
    stufen: STUFEN_AB.map((ab, i) => ({ stufe: i + 1, ab, belohnung: Object.assign({ credits: 100 + i * 25 },
      i + 1 === 5 ? { staub: 5, fragmente: 2 } : {}, i + 1 === 20 ? { staub: 20, fragmente: 10, titel: 'Chronist der Saison' } : {}),
      erreicht: punkte >= ab, abgeholt: abgeholt.includes(i + 1) })),
    katalog: [
      { art: 'angriff', name: 'Spielerangriff geführt', punkte: 10, tagesDeckel: 5, heute: 3 },
      { art: 'abwehr', name: 'Angriff abgewehrt', punkte: 8, tagesDeckel: 3, heute: 0 },
      { art: 'festung', name: 'Festung angegriffen', punkte: 8, tagesDeckel: 6, heute: 0 },
      { art: 'nest', name: 'Nest angegriffen', punkte: 8, tagesDeckel: 6, heute: 0 },
      { art: 'konvoi', name: 'Konvoi überfallen', punkte: 8, tagesDeckel: 6, heute: 0 },
      { art: 'weltboss', name: 'Weltboss getroffen', punkte: 6, tagesDeckel: 8, heute: 0 },
      { art: 'vorposten', name: 'Vorposten angegriffen', punkte: 8, tagesDeckel: 6, heute: 0 },
      { art: 'markt', name: 'Handel am Markt', punkte: 2, tagesDeckel: 10, heute: 10 }
    ]
  };
}
function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'auftragsbuch'){
      store.__gets = (store.__gets || 0) + 1;
      const a = store.__buch || { status: 404, body: { error: 'Not found' } };
      return j(typeof a.body === 'function' ? a.body() : a.body, a.status);
    }
    if (p === 'auftragsbuch/abholen'){
      store.__abholen = (store.__abholen || 0) + 1;
      // Der Server reiht je Stufe einen Reward ein und antwortet mit den Stufen - genau so misst es
      // der Backend-Test. Danach zeigt GET die Stufen als abgeholt.
      store.__belohnungen = (store.__belohnungen || []).concat([
        { id:'a2', type:'auftragsbuch', saison:'2026-09', stufe:2, credits:130 },
        { id:'a3', type:'auftragsbuch', saison:'2026-09', stufe:3, credits:150 } ]);
      store.__buch = { status: 200, body: () => buch(120, [1, 2, 3]) };
      return j({ ok:true, abgeholt:[2, 3] });
    }
    if (p === 'pending-rewards/claim'){
      store.__claims = (store.__claims || 0) + 1;
      const naechste = (store.__belohnungen || []).shift();
      return j({ reward: naechste || null });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'galaxy') return j(GALAXIE);
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications:[] });
    if (p === 'reports'){
      if (req.method() === 'POST'){
        try { store.__berichte.unshift(Object.assign({ id:'r'+(++store.__nr), time:Date.now() },
          JSON.parse(req.postData()||'{}').report || {})); } catch(e){}
        return j({ ok:true });
      }
      return j({ reports: store.__berichte });
    }
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends/.test(p)) return j([]);
    return j({});
  };
}
async function tab(browser, save, opt){
  const store = Object.assign({ __berichte: [], __nr: 0 }, opt || {});
  if (save) store[SAVE_KEY] = save;
  const ctx = await browser.newContext({ viewport:{ width:1100, height:1600 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message || e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await logMitschnitt(page);
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
    'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
const zuRang = async t => {
  await t.page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="galaxie"]'); if (b) b.click(); });
  await t.page.waitForTimeout(400);
  await t.page.evaluate(() => { const b = document.querySelector('[data-galaxy-subtab="rang"]'); if (b) b.click(); });
  await t.page.waitForTimeout(2000);
};
// Alles auf den geprueften Container begrenzt - nie ueber das ganze Dokument.
const boxSicht = t => t.page.evaluate(() => {
  const wrap = document.getElementById('auftragsbuchWrap'), box = document.getElementById('auftragsbuchBox');
  // Am alten Stand gibt es die Box nicht: leere, aber vollstaendige Antwort, damit JEDE spaetere
  // Pruefung einzeln faellt, statt dass der Test an `undefined.length` stirbt (Hausregel 34).
  if (!wrap || !box) return { da: false, sichtbar: false, text: '', chips: 0, zustaende: {}, knopf: null, taten: [] };
  const chips = [...box.querySelectorAll('[data-auftragsbuch-stufe]')];
  const zust = {}; for (const c of chips) zust[c.getAttribute('data-zustand')] = (zust[c.getAttribute('data-zustand')] || 0) + 1;
  const knopf = box.querySelector('#auftragsbuchAbholenBtn');
  return {
    da: true, sichtbar: wrap.style.display !== 'none' && !!wrap.offsetParent,
    text: (box.textContent || '').replace(/\s+/g, ' ').trim(),
    chips: chips.length, zustaende: zust,
    knopf: knopf ? (knopf.textContent || '').trim() : null,
    taten: [...box.querySelectorAll('[data-auftragsbuch-tat]')].map(e => e.getAttribute('data-auftragsbuch-tat') + ':' + (e.textContent || '').replace(/\s+/g, ' ').trim())
  };
});

(async () => {
  const browser = await starteBrowser();
  const roh = await tab(browser, null);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0f: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift'])
      if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    st.seenTabHints = ['basis','forschung','bau','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil'];
    st.credits = 1000; st.battlePoints = 0; st.moduleFragments = 5; st.seasonTitles = [];
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 10000;
    return JSON.stringify(st);
  }

  // ---- 1) Die Box mit Daten: Punkte, Chips, Knopf, Taten ---------------------------------------
  const t1 = await tab(browser, fixture(), { __buch: { status: 200, body: () => buch(120, [1]) } });
  await zuRang(t1);
  const s1 = await boxSicht(t1);
  check('1a: die Box steht sichtbar im Rang-Unterreiter', s1.da && s1.sichtbar, { da: s1.da, sichtbar: s1.sichtbar });
  check('1b: sie nennt Saison und Punktestand aus der Serverantwort', /2026-09/.test(s1.text) && /Punkte\s*120/.test(s1.text),
    { text: (s1.text || '').slice(0, 200) });
  check('1c: zwanzig Stufen-Chips: 1 abgeholt, 2 erreicht, 17 offen',
    s1.chips === 20 && s1.zustaende.abgeholt === 1 && s1.zustaende.erreicht === 2 && s1.zustaende.offen === 17, s1.zustaende);
  check('1d: der Abhol-Knopf nennt die Zahl der offenen Stufen', !!s1.knopf && /abholen \(2\)/.test(s1.knopf), { knopf: s1.knopf });
  check('1e: die Tatenliste zeigt jede Art mit "heute n/Deckel"', s1.taten.length === 8 &&
    s1.taten.some(z => /^angriff:/.test(z) && /heute 3\/5/.test(z)) && s1.taten.some(z => /^markt:/.test(z) && /heute 10\/10/.test(z)),
    { taten: s1.taten.slice(0, 3) });
  check('1e2: der Balken nennt die naechste Stufe (4 ab 150) und was fehlt (30)', /Nächste Stufe 4 ab 150/.test(s1.text) && /30 fehlen/.test(s1.text),
    { text: (s1.text || '').slice(200, 420) });
  await t1.page.waitForTimeout(4000);
  check('1f: die Box hat den Server beim Oeffnen EINMAL gefragt - nicht je Render-Tick', t1.store.__gets === 1, { gets: t1.store.__gets });

  // ---- 2) Abholen: POST, dann claim - die Kredite kommen aus dem Reward ------------------------
  const claimsVor2 = t1.store.__claims || 0;
  await t1.page.evaluate(() => { const b = document.getElementById('auftragsbuchAbholenBtn'); if (b) b.click(); });
  await t1.page.waitForTimeout(3000);
  check('2a: der Knopf ruft POST /auftragsbuch/abholen genau einmal', t1.store.__abholen === 1, { abholen: t1.store.__abholen });
  check('2b: und danach claimPendingRewards - die Warteschlange ist leer', (t1.store.__claims || 0) > claimsVor2 && (t1.store.__belohnungen || []).length === 0,
    { claimsVor: claimsVor2, claims: t1.store.__claims, offen: (t1.store.__belohnungen || []).length });
  const fx2 = t1.store[SAVE_KEY];
  for (let i = 0; i < 25 && t1.stand().credits !== 1280; i++) await t1.page.waitForTimeout(400);
  const st2 = t1.stand();
  check('2c: beide Stufen sind gebucht - 1000 + 130 + 150 Kredite im gespeicherten Spielstand', st2.credits === 1280, { credits: st2.credits });
  const s2 = await boxSicht(t1);
  check('2d: die Box wurde neu geladen - drei abgeholte Chips, kein Knopf mehr',
    (t1.store.__gets || 0) >= 2 && s2.zustaende.abgeholt === 3 && s2.knopf === null, { gets: t1.store.__gets, zustaende: s2.zustaende, knopf: s2.knopf });
  const zeilen2 = await logZeilen(t1.page);
  check('2e: die Meldung nennt das Auftragsbuch - NICHT "Dankeschoen vom Team ... Bug-Report"',
    zeilen2.some(z => /Auftragsbuch 2026-09 – Stufe 2/.test(z)) && !zeilen2.some(z => /Bug-Report/.test(z)),
    { zeilen: zeilen2.filter(z => /Auftragsbuch|Bug-Report/.test(z)).slice(0, 3) });
  check('2f: keine Seitenfehler', t1.errs.length === 0, { seitenfehler: t1.errs.slice(0, 3) });
  await t1.ctx.close();

  // ---- 3) 404 = alter Server: die ganze Flaeche weg, keine Meldung, kein Nachfragen ------------
  const t3 = await tab(browser, fixture(), { __buch: { status: 404, body: { error: 'Not found' } } });
  await zuRang(t3);
  await t3.page.waitForTimeout(4000);
  const s3 = await boxSicht(t3);
  const zeilen3 = await logZeilen(t3.page);
  check('3a: der Wrapper existiert, ist aber ersatzlos ausgeblendet - samt Titel', s3.da && !s3.sichtbar, { da: s3.da, sichtbar: s3.sichtbar });
  check('3b: keine Fehlermeldung im Protokoll, keine Seitenfehler',
    !zeilen3.some(z => /Auftragsbuch|nicht aktiv|Not found/.test(z)) && t3.errs.length === 0,
    { zeilen: zeilen3.filter(z => /Auftragsbuch|Not found/.test(z)), seitenfehler: t3.errs.slice(0, 2) });
  check('3c: ein alter Server wird nicht jede Sekunde erneut gefragt', t3.store.__gets === 1, { gets: t3.store.__gets });
  await t3.ctx.close();

  // ---- 4) Echter Fehler: die Box nennt den Grund vom Server ------------------------------------
  const t4 = await tab(browser, fixture(), { __buch: { status: 500, body: { error: 'Kaputt getestet.' } } });
  await zuRang(t4);
  const s4 = await boxSicht(t4);
  check('4a: bei einem echten Fehler bleibt die Box und nennt den Servertext', s4.da && s4.sichtbar && /Kaputt getestet/.test(s4.text),
    { sichtbar: s4.sichtbar, text: (s4.text || '').slice(0, 120) });
  await t4.ctx.close();

  // ---- 5) Der Belohnungszweig: Endstufe mit Titel, Fragmenten und Staub ------------------------
  const t5 = await tab(browser, fixture(), { __belohnungen: [
    { id:'b1', type:'auftragsbuch', saison:'2026-09', stufe:20, credits:600, fragmente:10, staub:20, titel:'Chronist der Saison' } ] });
  await t5.page.waitForTimeout(2500);
  const zeilen5 = await logZeilen(t5.page);
  check('5a: die Meldung nennt Stufe 20 mit allen Gaben - und kein NaN, kein Bug-Report',
    zeilen5.some(z => /Auftragsbuch 2026-09 – Stufe 20/.test(z) && /\+600 Kredite/.test(z) && /\+10 Modulfragmente/.test(z) && /\+20 Sternenstaub/.test(z) && /Chronist der Saison/.test(z))
    && !zeilen5.some(z => /Bug-Report|NaN/.test(z)),
    { zeilen: zeilen5.filter(z => /Auftragsbuch|Bug-Report|NaN/.test(z)).slice(0, 3) });
  const fx5 = t5.store[SAVE_KEY];
  for (let i = 0; i < 25 && t5.store[SAVE_KEY] === fx5; i++) await t5.page.waitForTimeout(400);
  const st5 = t5.stand();
  check('5b: Kredite und Modulfragmente stehen im gespeicherten Spielstand - Sternenstaub NICHT (den bucht der Server)',
    st5.credits === 1600 && st5.moduleFragments === 15 && !('staub' in st5),
    { credits: st5.credits, fragmente: st5.moduleFragments });
  check('5c: der Titel liegt in state.seasonTitles - dieselbe Liste wie die Saison-Liga-Titel',
    Array.isArray(st5.seasonTitles) && st5.seasonTitles.some(x => x.tier === 'auftragsbuch' && x.title === 'Chronist der Saison' && x.seasonKey === '2026-09'),
    { titel: st5.seasonTitles });
  const b5 = (t5.store.__berichte || []).find(b => b && b.type === 'auftragsbuch');
  check('5d: es gibt einen BLEIBENDEN Bericht mit Saison, Stufe, Gaben und Titel',
    !!b5 && b5.saison === '2026-09' && b5.stufe === 20 && Array.isArray(b5.gaben) && b5.gaben.length === 4 && b5.titel === 'Chronist der Saison',
    b5 ? { saison: b5.saison, stufe: b5.stufe, gaben: b5.gaben } : { berichte: (t5.store.__berichte || []).map(x => x.type) });
  check('5e: keine Seitenfehler - der Zweig darf die Abhol-Schleife nicht werfen', t5.errs.length === 0, { seitenfehler: t5.errs.slice(0, 3) });
  await t5.ctx.close();

  await browser.close();
  ende();
})();
