// Patenschaft im Spiel (Feature G, 11.09.2026): Karte in den Einstellungen, Reward-Zweig, Bericht,
// Willkommenshinweis nach dem Einloesen des Einladungs-Links.
//
// Die serverseitigen Regeln (wer wann was bekommt) misst tests/test_patenschaft_http.js im
// BACKEND-Repo; hier geht es um das, was der Spieler sieht.
//
// DREI DINGE, DIE DIESER TEST ABSICHERT:
//
//  1) DER EIGENE `patenschaft`-ZWEIG in claimPendingRewards ist PFLICHT. Ohne ihn faellt die
//     Belohnung in den Rueckfall und meldet dem Spieler woertlich "Dankeschoen vom Team: +200
//     Kredite fuer deinen Bug-Report!" - eine Falschaussage (Abschnitt 3).
//
//  2) DIE KARTE HAT DREI ZUSTAENDE (Hausregel 35): Server liefert den Stand -> Karte mit Pate,
//     Schuetzlingen und Haekchen je Meilenstein; 404 (alter Server / Schalter aus) -> die Karte
//     fehlt ERSATZLOS, kein leerer Rahmen, keine Meldung; ein anderer Fehler -> eine Zeile mit dem
//     Servertext, damit die Flaeche nicht still tot ist (Abschnitte 1 und 2).
//
//  3) DER HINWEIS NACH DEM EINLOESEN kommt nur, wenn der Server den Paten nennt - ein alter
//     Server schickt das Feld nicht, und dann darf hier nichts stehen (Abschnitt 4).
//
// GEGENPROBE (gemessen am 11.09.2026 gegen den Stand VOR diesem Commit als Kopie:
// `git show <basis>:weltraum_kolonie.html > /tmp/alt.html`, dann
// KEPLER_SPIELDATEI=/tmp/alt.html node tests/test_patenschaft.js). Am alten Stand fallen
//   0a, 0b, 0c, 0d, 0e, 0f (Quelltext-Anker), 1a, 1b, 1c, 1d (keine Karte), 2c (kein Fehlertext),
//   3a, 3b, 3d, 3f (Rueckfall-Meldung, kein Bericht), 4a (kein Hinweis).
// Gruen bleiben MUESSEN (die additive Zusage): 1e, 2a, 2b (ohne Karte gibt es auch keine tote
// Flaeche und keinen Seitenfehler), 3c (die Kredite bucht auch der Rueckfall), 3e, 4b (ein alter
// Server loest keinen Hinweis aus - auch nicht am alten Stand). Die Detail-Ausdruecke der Pruefungen
// sind gegen eine fehlende Karte abgesichert - sie werden VOR dem Kurzschluss ausgewertet, und ein
// Wurf dort liesse die Gegenprobe nach 1c abbrechen (so gemessen in der ersten Fassung).
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer, logMitschnitt, logZeilen } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
const TAG = 86400000;

// ---------------------------------------------------------------- 0) Verdrahtung im Quelltext
/* Gesucht wird der AUFRUF des Rueckfalls, nicht die Zeichenkette: Kommentare zitieren den alten
   Meldungstext woertlich, `lastIndexOf` auf den Aufruf umgeht das (neuer-test-Skill). */
const rueckfallStelle = JS.lastIndexOf("log('Dankeschön vom Team: +'");
const zweigStelle = JS.indexOf("if (r.type === 'patenschaft'){");
check('0a: der Patenschaft-Zweig steht VOR dem Rueckfall-Zweig - sonst greift der Rueckfall zuerst',
  zweigStelle > 0 && rueckfallStelle > 0 && zweigStelle < rueckfallStelle,
  { zweig: zweigStelle, rueckfall: rueckfallStelle });
check('0b: der Patenschaft-Bericht traegt KEINE Gewonnen/Verloren-Pille - ein Meilenstein hat keinen Ausgang',
  /REPORT_SPECIAL_GREEN_TYPES = \[[^\]]*'patenschaft'/.test(JS));
check('0c: das Oeffnen der Einstellungen laedt die Patenschaft (switchTab)',
  /if \(tab === 'einstellungen'\)\{[^\n]*ladePatenschaft\(\);/.test(JS));
const hilfeStart = JS.indexOf("title:'Freunde einladen', body:");
const hilfeEnde = hilfeStart > 0 ? JS.indexOf("' },", hilfeStart) : -1;
check('0d: die Hilfe erklaert die Patenschaft im Eintrag "Freunde einladen" - Dauer, beide Seiten, genau einmal',
  hilfeStart > 0 && hilfeEnde > hilfeStart && (() => {
    const t = JS.slice(hilfeStart, hilfeEnde);
    return /Patenschaft/.test(t) && /30 Tage/.test(t) && /beide/.test(t) && /genau einmal/.test(t);
  })(), { start: hilfeStart, ende: hilfeEnde });
check('0e: das Postfach kennt den Typ - sonst stuende dort eine leere Zeile (siehe NOTIF_EVENT_INFO fuer chat)',
  /NOTIF_EVENT_INFO = \{[\s\S]*?'patenschaft': \{ icon:'ti-users'/.test(JS));
check('0f: der Berichte-Renderer hat einen eigenen Zweig mit Meilenstein und Gutschrift',
  /r\.type === 'patenschaft'\)\{[\s\S]{0,900}Gutgeschrieben/.test(JS));

function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'patenschaft'){
      store.__patenschaftAnfragen = (store.__patenschaftAnfragen || 0) + 1;
      const a = store.__patenschaft || { status:404, body:{ error:'Not found' } };
      return j(a.body, a.status);
    }
    if (p === 'referral/redeem'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__redeems = (store.__redeems || []).concat([body]);
      const a = store.__redeemAntwort || { status:404, body:{ error:'Kein Spieler mit diesem Namen gefunden.' } };
      return j(a.body, a.status);
    }
    if (p === 'pending-rewards/claim'){
      const naechste = (store.__belohnungen || []).shift();
      return j({ reward: naechste || null });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
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
  // Der Einladungs-Code aus dem Link liegt in localStorage - tryAutoRedeemReferral liest ihn beim Start.
  await page.addInitScript((code) => { localStorage.setItem('kepler7_token', 'tok'); if (code) localStorage.setItem('pendingReferralCode', code); }, store.__pendingRef || '');
  await logMitschnitt(page);
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
    'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
// Alles auf den Container #patenschaftBox begrenzt (neuer-test-Skill: gescopte Selektoren).
const karte = t => t.page.evaluate(() => {
  const el = document.getElementById('patenschaftBox');
  if (!el) return { da:false };
  const chips = (wurzel) => [...wurzel.querySelectorAll('[data-ms]')].map(c => ({ ms: c.getAttribute('data-ms'), erreicht: c.getAttribute('data-erreicht') === '1' }));
  const pate = el.querySelector('[data-patenschaft-pate]');
  return {
    da: true,
    sichtbar: getComputedStyle(el).display !== 'none' && el.innerHTML.trim() !== '',
    text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
    fehler: !!el.querySelector('[data-patenschaft-fehler]'),
    leer: !!el.querySelector('[data-patenschaft-leer]'),
    pate: pate ? { text: (pate.textContent || '').replace(/\s+/g, ' ').trim(), chips: chips(pate) } : null,
    schuetzlinge: [...el.querySelectorAll('[data-patenschaft-schuetzling]')].map(s => ({ text: (s.textContent || '').replace(/\s+/g, ' ').trim(), chips: chips(s) }))
  };
});
const KATALOG = [
  { key:'erster-sieg', name:'Erster gewonnener Spielerangriff', credits:{ pate:150, schuetzling:200 }, staub:3 },
  { key:'erste-abwehr', name:'Erster abgewehrter Angriff', credits:{ pate:150, schuetzling:200 }, staub:3 },
  { key:'erster-schlag', name:'Erster Schlag gegen Nest oder Festung', credits:{ pate:150, schuetzling:200 }, staub:3 },
  { key:'erster-handel', name:'Erster Handel am Markt', credits:{ pate:150, schuetzling:200 }, staub:3 },
  { key:'serie-5', name:'Fünf Tage in Folge angemeldet', credits:{ pate:150, schuetzling:200 }, staub:3 }
];

(async () => {
  const browser = await starteBrowser();
  const roh = await tab(browser, null);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0-bau: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift'])
      if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    st.seenTabHints = ['basis','forschung','bau','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil'];
    st.credits = 1000; st.battlePoints = 0;
    delete st.referredBy; st.referralRedeemed = false;
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 10000;
    return JSON.stringify(st);
  }
  // Der Kopfzeilen-Knopf ist der Weg in die Einstellungen (headerProfileBtn.onclick -> switchTab).
  const zuEinstellungen = async t => {
    await t.page.evaluate(() => { const b = document.getElementById('headerProfileBtn'); if (b) b.click(); });
    await t.page.waitForTimeout(1200);
  };

  // ---- 1) Der Server liefert den Stand -> Karte mit Pate, Schuetzlingen, Haekchen -------------
  const jetzt = Date.now();
  const t1 = await tab(browser, fixture(), { __patenschaft: { status:200, body: {
    aktiv:true, dauerTage:30, maxSchuetzlinge:10,
    pate: { name:'anna', seit: jetzt - 17.5*TAG, bis: jetzt + 12.5*TAG, aktiv:true, meilensteine: { 'erster-sieg': jetzt - TAG, 'erster-handel': jetzt - 2*TAG } },
    schuetzlinge: [
      { name:'ben',  seit: jetzt - 3*TAG, bis: jetzt + 27*TAG, aktiv:true,  meilensteine: { 'erste-abwehr': jetzt - TAG } },
      { name:'carl', seit: jetzt - 40*TAG, bis: jetzt - 10*TAG, aktiv:false, meilensteine: {} }
    ],
    katalog: KATALOG } } });
  const vorher = await karte(t1);
  check('1a: vor dem Oeffnen der Einstellungen ist die Karte leer - geladen wird beim Oeffnen',
    !!vorher && vorher.da && !vorher.sichtbar && (t1.store.__patenschaftAnfragen || 0) === 0,
    { sichtbar: vorher && vorher.sichtbar, anfragen: t1.store.__patenschaftAnfragen });
  await zuEinstellungen(t1);
  const k1 = await karte(t1);
  check('1b: die Karte zeigt den Paten mit Restzeit in Tagen - gemessen aus `bis`, nicht eingetippt',
    !!k1 && k1.sichtbar && !!k1.pate && /anna/.test(k1.pate.text) && new RegExp('noch ' + Math.ceil(12.5) + ' Tage').test(k1.pate.text),
    k1 && k1.pate ? { text: k1.pate.text.slice(0, 120) } : k1);
  check('1c: die Haekchen des Paten-Blocks folgen dem Katalog (5 Chips) und markieren GENAU die erreichten',
    !!k1 && !!k1.pate && k1.pate.chips.map(c => c.ms).join(',') === KATALOG.map(k => k.key).join(',') &&
    k1.pate.chips.filter(c => c.erreicht).map(c => c.ms).sort().join(',') === 'erster-handel,erster-sieg',
    k1 && k1.pate ? { chips: k1.pate.chips } : null);
  check('1d: beide Schuetzlinge stehen da - ben mit einem Haekchen, carl als abgelaufen ohne Haekchen',
    !!k1 && Array.isArray(k1.schuetzlinge) && k1.schuetzlinge.length === 2 &&
    /ben/.test(k1.schuetzlinge[0].text) && k1.schuetzlinge[0].chips.filter(c => c.erreicht).map(c => c.ms).join(',') === 'erste-abwehr' &&
    /carl/.test(k1.schuetzlinge[1].text) && /abgelaufen/.test(k1.schuetzlinge[1].text) && k1.schuetzlinge[1].chips.every(c => !c.erreicht),
    // Der Detail-Ausdruck wird VOR dem Kurzschluss ausgewertet - am alten Stand (keine Karte) darf er nicht werfen.
    k1 && Array.isArray(k1.schuetzlinge) ? { schuetzlinge: k1.schuetzlinge.map(s => ({ text: s.text.slice(0, 60), erreicht: s.chips.filter(c => c.erreicht).length })) } : k1);
  check('1e: keine Seitenfehler beim Zeichnen der Karte', t1.errs.length === 0, { seitenfehler: t1.errs.slice(0, 3) });
  await t1.ctx.close();

  // ---- 2) Die drei Zustaende: 404 -> Karte weg; anderer Fehler -> Zeile mit Grund ----------------
  const t2 = await tab(browser, fixture(), { __patenschaft: { status:404, body:{ error:'Patenschaften sind nicht aktiv.', inaktiv:true } } });
  await zuEinstellungen(t2);
  const k2 = await karte(t2);
  const zeilen2 = await logZeilen(t2.page);
  check('2a: bei 404 (alter Server / Schalter aus) fehlt die Karte ERSATZLOS - kein leerer Rahmen',
    !k2 || !k2.da || (!k2.sichtbar && !k2.fehler), k2);
  check('2b: und keine Meldung an den Spieler - er hat nichts angeklickt',
    !zeilen2.some(z => /Patenschaft/.test(z)) && t2.errs.length === 0, { zeilen: zeilen2.filter(z => /Patenschaft/.test(z)), seitenfehler: t2.errs.slice(0, 3) });
  await t2.ctx.close();
  const t2c = await tab(browser, fixture(), { __patenschaft: { status:500, body:{ error:'Datenbank gerade nicht erreichbar.' } } });
  await zuEinstellungen(t2c);
  const k2c = await karte(t2c);
  check('2c: ein ECHTER Fehler zeigt eine Zeile mit dem Servertext - keine stille tote Flaeche',
    !!k2c && k2c.sichtbar && k2c.fehler && /nicht erreichbar/.test(k2c.text), k2c && k2c.da ? { text: String(k2c.text || '').slice(0, 120), fehler: k2c.fehler } : k2c);
  await t2c.ctx.close();

  // ---- 3) Die Gutschrift: eigener Zweig, kein Rueckfall --------------------------------------------
  const t3 = await tab(browser, fixture(), { __belohnungen: [
    { id:'p1', type:'patenschaft', rolle:'schuetzling', meilenstein:'erster-sieg', name:'Erster gewonnener Spielerangriff', partnerName:'anna', credits:200, staub:3 } ] });
  await t3.page.waitForTimeout(2500);
  const zeilen3 = await logZeilen(t3.page);
  check('3a: die Meldung nennt die Patenschaft und den Meilenstein - NICHT "Dankeschoen vom Team ... Bug-Report"',
    zeilen3.some(z => /Patenschaft/.test(z) && /Erster gewonnener Spielerangriff/.test(z)) && !zeilen3.some(z => /Bug-Report/.test(z)),
    { zeilen: zeilen3.filter(z => /Patenschaft|Bug-Report/.test(z)) });
  check('3b: sie nennt Kredite, Sternenstaub und den Paten',
    zeilen3.some(z => /\+200 Kredite/.test(z) && /\+3 Sternenstaub/.test(z) && /anna/.test(z)),
    { zeilen: zeilen3.filter(z => /Patenschaft/.test(z)) });
  const fx3 = t3.store[SAVE_KEY];
  for (let i = 0; i < 25 && t3.store[SAVE_KEY] === fx3; i++) await t3.page.waitForTimeout(400);
  const st3 = t3.stand();
  check('3c: die Kredite stehen im gespeicherten Spielstand', st3.credits === 1200, { credits: st3.credits });
  const b3 = (t3.store.__berichte || []).find(b => b && b.type === 'patenschaft');
  check('3d: es gibt einen BLEIBENDEN Bericht mit Rolle, Meilenstein und Partner',
    !!b3 && b3.rolle === 'schuetzling' && b3.meilenstein === 'Erster gewonnener Spielerangriff' && b3.partnerName === 'anna' && b3.credits === 200 && b3.staub === 3,
    b3 || { berichte: (t3.store.__berichte || []).map(x => x.type) });
  check('3e: keine Seitenfehler - der Zweig darf die Abhol-Schleife nicht werfen', t3.errs.length === 0, { seitenfehler: t3.errs.slice(0, 3) });
  await t3.ctx.close();
  const t3f = await tab(browser, fixture(), { __belohnungen: [
    { id:'p2', type:'patenschaft', rolle:'pate', meilenstein:'erste-abwehr', name:'Erster abgewehrter Angriff', partnerName:'ben', credits:150, staub:3 } ] });
  await t3f.page.waitForTimeout(2500);
  const zeilen3f = await logZeilen(t3f.page);
  check('3f: als PATE nennt die Meldung den Schuetzling und die 150 Kredite',
    zeilen3f.some(z => /Patenschaft/.test(z) && /Schützling ben/.test(z) && /\+150 Kredite/.test(z)) && !zeilen3f.some(z => /Bug-Report/.test(z)),
    { zeilen: zeilen3f.filter(z => /Patenschaft|Bug-Report/.test(z)) });
  await t3f.ctx.close();

  // ---- 4) Der Hinweis nach dem Einloesen - nur wenn der Server den Paten nennt -------------------
  const t4 = await tab(browser, fixture(), { __pendingRef: 'anna', __redeemAntwort: { status:200, body: {
    ok:true, status:'pending', referrerName:'anna', levelNeeded:5, currentLevel:2, patenschaft:{ name:'anna', bis: Date.now() + 30*TAG, tage:30 } } } });
  await t4.page.waitForTimeout(2500);
  const zeilen4 = await logZeilen(t4.page);
  check('4a: nach dem Einloesen steht "Dein Pate: anna" mit den 30 Tagen - der Redeem wurde wirklich gerufen',
    (t4.store.__redeems || []).length === 1 && zeilen4.some(z => /Dein Pate: anna/.test(z) && /30 Tage/.test(z)),
    { redeems: t4.store.__redeems, zeilen: zeilen4.filter(z => /Pate|verknüpft/.test(z)) });
  await t4.ctx.close();
  const t4b = await tab(browser, fixture(), { __pendingRef: 'anna', __redeemAntwort: { status:200, body: {
    ok:true, status:'pending', referrerName:'anna', levelNeeded:5, currentLevel:2 } } });
  await t4b.page.waitForTimeout(2500);
  const zeilen4b = await logZeilen(t4b.page);
  check('4b: ein alter Server ohne das Feld loest KEINEN Paten-Hinweis aus - die Verknuepfungs-Meldung bleibt',
    (t4b.store.__redeems || []).length === 1 && !zeilen4b.some(z => /Dein Pate/.test(z)) && zeilen4b.some(z => /verknüpft/.test(z)),
    { zeilen: zeilen4b.filter(z => /Pate|verknüpft/.test(z)) });
  await t4b.ctx.close();

  await browser.close();
  ende();
})();
