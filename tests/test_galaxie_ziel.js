// Galaxie-Ziel der Woche (Feature A, 11.09.2026): die Karte im Nachrichten-Kasten, der Reward-Zweig,
// der Bericht und die Hilfe.
//
// Ein gemeinsames Wochenziel aller Spieler ("Schlagt diese Woche zusammen N-mal gegen Alien-Nester"),
// gezaehlt und bezahlt vom Server. Die serverseitigen Regeln misst tests/test_galaxie_ziel_http.js im
// BACKEND-Repo; hier geht es um das, was der Spieler sieht.
//
// VIER DINGE, DIE DIESER TEST ABSICHERT:
//  1) DREI ZUSTAENDE (Hausregel 35): Mit `galaxieZiel` in /api/galaxy steht die Karte mit Zahlen
//     (Abschnitt 1), erreicht wird sie gruen (2), OHNE das Feld gibt es KEINE Karte - kein leerer
//     Rahmen (3). Ein alter Server, ein Notaus oder die Minute nach dem Wochenwechsel sehen alle gleich
//     aus: kein Feld, keine Karte.
//  2) DAS SYMBOL vom Server landet in einem class-ATTRIBUT. Dort hilft escapeHtml nicht - eine fremde
//     Klasse waere kein Text, sondern Wirkung. Die Karte prueft gegen ein Muster (3b).
//  3) DER EIGENE `galaxie-ziel`-ZWEIG in claimPendingRewards ist PFLICHT. Ohne ihn faellt die Belohnung
//     in den Rueckfall und meldet woertlich "Dankeschoen vom Team: +… Kredite fuer deinen Bug-Report" -
//     eine Falschaussage (Abschnitt 4). Sternenstaub bucht der SERVER; der Client zeigt die Zahl nur.
//  4) PARITAET zum Backend, wenn dessen server.js daneben liegt: Jedes Symbol des Katalogs
//     GALAXIE_ZIEL_ARTEN muss im Frontend vorkommen (das Icon-Font ist ein Teilsatz - ein Symbol, das
//     der Server schickt und das Frontend nicht kennt, waere ein leeres Kaestchen), und die Zahlen im
//     Hilfetext (Tagesdeckel, Kredite, Staub, Klemmen) sind die des Servers (0e).
//
// GEGENPROBE (gemessen am 11.09.2026 mit KEPLER_SPIELDATEI auf einer Kopie des Standes v8.715.0,
// KEPLER_BACKEND_SERVER auf die server.js mit Feature A): am alten Stand fallen
//   0a 0b 0c 0d 0e2 1a 1b 1c 1d 2a 3b 4a 4b 4d 5a.
// Gruen bleiben - und jedes hat einen benannten Grund, keines davon ist ein Beweis:
//   0-anker, 0-stand (Messvorrichtung), 0e (die vier Symbole benutzt das Frontend schon anderswo -
//   die Pruefung schuetzt vor einem KUENFTIGEN fremden Symbol im Server-Katalog), 3a (keine Karte
//   ohne Feld - das konnte der alte Stand trivial), 4c (der RUECKFALL bucht die Kredite ebenfalls;
//   was er falsch macht, ist die Meldung und der fehlende Bericht - das messen 4a/4b/4d) und 4e.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, SERVER_JS, starteBrowser, pruefer, logMitschnitt, logZeilen } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';

// ---------------------------------------------------------------- 0) Verdrahtung im Quelltext
const rueckfallStelle = JS.indexOf("log('Dankeschön vom Team: +'");
const zweigStelle = JS.indexOf("if (r.type === 'galaxie-ziel'){");
check('0-anker: Rueckfall-Zweig gefunden', rueckfallStelle > 0, { rueckfall: rueckfallStelle });
check('0a: der galaxie-ziel-Zweig steht VOR dem Rueckfall-Zweig - sonst greift der Rueckfall zuerst',
  zweigStelle > 0 && rueckfallStelle > 0 && zweigStelle < rueckfallStelle, { zweig: zweigStelle, rueckfall: rueckfallStelle });
check('0b: der Bericht galaxie-ziel traegt KEINE Gewonnen/Verloren-Pille - ein Gemeinschaftsziel hat keinen Kampfausgang',
  /REPORT_SPECIAL_GREEN_TYPES = \[[^\]]*'galaxie-ziel'/.test(JS));
/* Die Signatur ist der Teil, den man beim Nachbauen vergisst: Ohne `zielSig` in newsSig UND emptySig
   bliebe die Karte nach dem ersten Aufbau stehen, wie sie war - ein neuer Stand vom Server aendert
   die Signatur nicht, der Kasten wird nicht neu geschrieben. */
const newsSigZeile = JS.match(/const newsSig = ([^\n]*)/);
const emptySigZeile = JS.match(/const emptySig=([^;]*);/);
check('0c: die Karte steht in BEIDEN Signaturen des Kastens (mit und ohne Nachrichten)',
  !!newsSigZeile && /zielSig/.test(newsSigZeile[1]) && !!emptySigZeile && /zielSig/.test(emptySigZeile[1]),
  { news: newsSigZeile && newsSigZeile[1].slice(0, 80), leer: emptySigZeile && emptySigZeile[1].slice(0, 80) });
const hilfe = HTML.match(/\{ title:'Galaxie-Ziel der Woche', body:'([^']*)' \}/);
check('0d: die Hilfe (Lebendige Galaxie) hat einen vollstaendigen Eintrag - Art, Zaehlung, Deckel, Belohnung, Bedingung',
  !!hilfe && /Alien-Nestern/.test(hilfe[1]) && /gewerteter Schlag/.test(hilfe[1]) && /je Kommandant und Tag/.test(hilfe[1])
    && /Sternenstaub/.test(hilfe[1]) && /verfehltes Ziel zahlt nichts/.test(hilfe[1]) && /Ohne eigenen Server/.test(hilfe[1]),
  hilfe ? hilfe[1].slice(0, 120) : null);

// ---------------------------------------------------------------- 0e) Paritaet zum Backend
if (SERVER_JS) {
  const SRV = fs.readFileSync(SERVER_JS, 'utf8');
  const block = SRV.match(/const GALAXIE_ZIEL_ARTEN = \[([\s\S]*?)\n\];/);
  const icons = block ? [...block[1].matchAll(/icon: '(ti-[a-z0-9-]+)'/g)].map(m => m[1]) : [];
  const zahl = re => Number((SRV.match(re) || [])[1]);
  const deckel = zahl(/const GALAXIE_ZIEL_TAGESDECKEL = (\d+);/);
  const basis = zahl(/const GALAXIE_ZIEL_CREDITS_BASIS = (\d+);/);
  const je = zahl(/const GALAXIE_ZIEL_CREDITS_JE_BEITRAG = (\d+);/);
  const kappe = zahl(/const GALAXIE_ZIEL_CREDITS_DECKEL = (\d+);/);
  const staub = zahl(/const GALAXIE_ZIEL_STAUB = (\d+);/);
  const min = zahl(/const GALAXIE_ZIEL_MIN = (\d+), GALAXIE_ZIEL_MAX = (\d+);/);
  const max = Number((SRV.match(/const GALAXIE_ZIEL_MIN = (\d+), GALAXIE_ZIEL_MAX = (\d+);/) || [])[2]);
  const fehlend = icons.filter(ic => !new RegExp('\\b' + ic + '\\b').test(HTML));
  check('0e: jedes Symbol des Server-Katalogs kommt im Frontend vor (Icon-Font ist ein Teilsatz)',
    icons.length === 4 && fehlend.length === 0, { icons, fehlend });
  const h = hilfe ? hilfe[1] : '';
  check('0e2: die Zahlen im Hilfetext sind die des Servers - Tagesdeckel, Kredite, Staub, Klemmen',
    deckel > 0 && basis > 0 && je > 0 && kappe > 0 && staub > 0 && min > 0 && max > 0
      && new RegExp('Höchstens ' + deckel + ' Beiträge je Kommandant und Tag').test(h)
      && new RegExp(basis + ' Kredite plus ' + je + ' je Beitrag \\(höchstens ' + (basis + kappe) + ' Kredite\\)').test(h)
      && new RegExp('und ' + staub + ' Sternenstaub').test(h)
      && new RegExp('mindestens ' + min + ', höchstens ' + max).test(h),
    { deckel, basis, je, kappe, staub, min, max });
} else {
  console.log('----  0e: Backend-server.js nicht gefunden (KEPLER_BACKEND_SERVER) - Paritaet uebersprungen');
}

// ---------------------------------------------------------------- Browser-Attrappe
function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy'){
      const g = { npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null,
                  collapsedSystems:{}, activeWormhole:null, news: store.__news || [], controlledSystems:{}, factions:{} };
      if (store.__galaxieZiel) g.galaxieZiel = store.__galaxieZiel;
      return j(g);
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
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|vorposten/.test(p)) return j([]);
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
// Alles auf den Kasten gescopt - die Karte darf nirgendwo sonst gemessen werden.
const karte = t => t.page.evaluate(() => {
  const box = document.getElementById('galaxyNewsBox');
  if (!box) return null;
  const k = box.querySelector('#galaxieZielKarte');
  const balken = k ? k.querySelector('.progress-inner') : null;
  const ico = k ? k.querySelector('i.ti') : null;
  return { boxText: (box.textContent || '').replace(/\s+/g, ' ').trim(), kinder: box.children.length,
           ersteId: box.children[0] ? box.children[0].id : null,
           karte: !!k, text: k ? (k.textContent || '').replace(/\s+/g, ' ').trim() : null,
           breite: balken ? balken.style.width : null, rahmen: k ? k.style.borderColor : null,
           iconKlasse: ico ? ico.className : null, html: k ? k.innerHTML : null };
});
const zuGalaxie = async t => {
  await t.page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="galaxie"]'); if (b) b.click(); });
  await t.page.waitForTimeout(1500);
};
const ZIEL = (extra) => Object.assign({ woche:'2026-09-07', art:'nestschlaege', name:'Schläge gegen Alien-Nester',
  beschreibung:'Jeder gewertete Angriff auf ein Alien-Nest zählt – egal, ob das Nest dabei fällt.', icon:'ti-alien',
  ziel:12, stand:7, erreicht:false, ende: Date.now() + 2*86400000 + 3600000, meinBeitrag:2, kommandanten:3, tagesDeckel:10 }, extra || {});
const NEWS = [{ id:'n1', time: Date.now() - 60000, icon:'ti-truck', text:'Marktlage normalisiert.' }];

(async () => {
  const browser = await starteBrowser();
  const roh = await tab(browser, null);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0-stand: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift'])
      if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    st.seenTabHints = ['basis','forschung','bau','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil'];
    st.credits = 1000; st.battlePoints = 0;
    st.galaxySubTab = 'info';   // der Nachrichten-Unterreiter, in dem der Kasten steht
    return JSON.stringify(st);
  }

  // ---- 1) Mit Ziel: die Karte mit Zahlen, VOR den Meldungen --------------------------------------
  const t1 = await tab(browser, fixture(), { __galaxieZiel: ZIEL(), __news: NEWS });
  await zuGalaxie(t1);
  const k1 = await karte(t1);
  check('1a: die Karte steht im Nachrichten-Kasten und nennt Name, Beschreibung, Stand/Ziel, eigenen Beitrag, Beteiligte und Restzeit',
    !!k1 && k1.karte && /Galaxie-Ziel der Woche: Schläge gegen Alien-Nester/.test(k1.text) && /Jeder gewertete Angriff auf ein Alien-Nest/.test(k1.text)
      && /7 \/ 12/.test(k1.text) && /dein Beitrag: 2/.test(k1.text) && /3 Kommandanten beteiligt/.test(k1.text) && /endet in 4[789]h \d+m/.test(k1.text)
      && !/Erreicht/.test(k1.text), k1 && { text: k1.text });
  check('1b: der Balken zeigt 7 von 12 (58 %) und der Tagesdeckel des Servers steht dabei - nicht als eigene Zahl im Frontend',
    !!k1 && k1.breite === '58%' && /Höchstens 10 Beiträge je Kommandant und Tag/.test(k1.text || ''), k1 && { breite: k1.breite });
  check('1c: das Symbol ist das vom Server genannte', !!k1 && k1.iconKlasse === 'ti ti-alien', k1 && { icon: k1.iconKlasse });
  check('1d: die Karte steht VOR den Meldungen (erstes Kind des Kastens), die Meldung darunter bleibt',
    !!k1 && k1.ersteId === 'galaxieZielKarte' && /Marktlage normalisiert/.test(k1.boxText), k1 && { erste: k1.ersteId, kinder: k1.kinder });
  await t1.ctx.close();

  // ---- 2) Erreicht: gruener Rahmen, Hinweis auf die Belohnung ------------------------------------
  const t2 = await tab(browser, fixture(), { __galaxieZiel: ZIEL({ stand: 14, erreicht: true, meinBeitrag: 4 }), __news: [] });
  await zuGalaxie(t2);
  const k2 = await karte(t2);
  check('2a: erreicht - gruener Rahmen, Balken voll, "Erreicht – Belohnung am Wochenende", kein Deckel-Hinweis mehr',
    !!k2 && k2.karte && /Erreicht – Belohnung am Wochenende/.test(k2.text) && k2.breite === '100%' && /93, ?202, ?165/.test(k2.rahmen || '')
      && /14 \/ 12/.test(k2.text) && !/Höchstens/.test(k2.text) && /Noch keine galaktischen Ereignisse/.test(k2.boxText),
    k2 && { text: k2.text, rahmen: k2.rahmen, breite: k2.breite });
  await t2.ctx.close();

  // ---- 3) Ohne Ziel: KEINE Karte, kein leerer Rahmen ------------------------------------------------
  const t3 = await tab(browser, fixture(), { __news: NEWS });
  await zuGalaxie(t3);
  const k3 = await karte(t3);
  check('3a: ohne galaxieZiel in der Antwort gibt es keine Karte - die Meldungen stehen wie immer',
    !!k3 && !k3.karte && !/Galaxie-Ziel/.test(k3.boxText) && /Marktlage normalisiert/.test(k3.boxText), k3 && { karte: k3.karte, kinder: k3.kinder });
  await t3.ctx.close();
  // Ein Symbol, das kein ti-Name ist, darf NICHT ins Attribut - die Karte faellt auf ti-target zurueck.
  const t3b = await tab(browser, fixture(), { __galaxieZiel: ZIEL({ icon: 'x" onerror="alert(1)' }), __news: [] });
  await zuGalaxie(t3b);
  const k3b = await karte(t3b);
  check('3b: ein fremdes Symbol vom Server landet nicht im class-Attribut - Rueckfall auf ti-target, kein onerror im Markup',
    !!k3b && k3b.karte && k3b.iconKlasse === 'ti ti-target' && !/onerror/.test(k3b.html || ''), k3b && { icon: k3b.iconKlasse });
  await t3b.ctx.close();

  // ---- 4) Die Gutschrift: eigener Zweig, kein Rueckfall ----------------------------------------------
  const t4 = await tab(browser, fixture(), { __belohnungen: [
    { id:'g1', type:'galaxie-ziel', woche:'2026-08-31', art:'nestschlaege', name:'Schläge gegen Alien-Nester', ziel:12, stand:14, beitrag:3, credits:350, staub:5 } ] });
  await t4.page.waitForTimeout(2500);
  const zeilen4 = await logZeilen(t4.page);
  check('4a: die Meldung nennt das Galaxie-Ziel - NICHT "Dankeschoen vom Team ... Bug-Report"',
    zeilen4.some(z => /Galaxie-Ziel der Woche erreicht/.test(z)) && !zeilen4.some(z => /Bug-Report/.test(z)),
    { zeilen: zeilen4.filter(z => /Galaxie-Ziel|Bug-Report/.test(z)) });
  check('4b: sie nennt Kredite, Sternenstaub und den eigenen Beitrag',
    zeilen4.some(z => /\+350 Kredite/.test(z) && /\+5 Sternenstaub/.test(z) && /deine 3 Beiträge/.test(z)),
    { zeilen: zeilen4.filter(z => /Galaxie-Ziel/.test(z)) });
  // `state` lebt im Modulscope (Hausregel 47) - gemessen wird der GESPEICHERTE Stand nach save().
  const fx4 = t4.store[SAVE_KEY];
  for (let i = 0; i < 25 && t4.store[SAVE_KEY] === fx4; i++) await t4.page.waitForTimeout(400);
  const st4 = t4.stand();
  check('4c: die Kredite stehen im gespeicherten Spielstand - der Staub NICHT (den bucht der Server)',
    st4.credits === 1350 && st4.staub === undefined && st4.sternenstaub === undefined, { credits: st4.credits });
  const b4 = (t4.store.__berichte || []).find(b => b && b.type === 'galaxie-ziel');
  check('4d: es gibt einen BLEIBENDEN Bericht mit den Zahlen - log() ueberschreibt sich selbst',
    !!b4 && b4.credits === 350 && b4.staub === 5 && b4.beitrag === 3 && b4.name === 'Schläge gegen Alien-Nester' && b4.woche === '2026-08-31',
    b4 ? { credits: b4.credits, staub: b4.staub, beitrag: b4.beitrag } : { berichte: (t4.store.__berichte||[]).map(x => x.type) });
  check('4e: keine Seitenfehler - der Zweig darf die Abhol-Schleife nicht werfen', t4.errs.length === 0, { seitenfehler: t4.errs.slice(0,3) });
  await t4.ctx.close();

  // ---- 5) Der Bericht in der Liste: Titel, Zahlen, keine Kampf-Pille ----------------------------------
  const t5 = await tab(browser, fixture(), { __berichte: [
    { id:'r9', time: Date.now() - 5000, type:'galaxie-ziel', woche:'2026-08-31', art:'nestschlaege', name:'Schläge gegen Alien-Nester', ziel:12, stand:14, beitrag:3, credits:350, staub:5 } ] });
  await t5.page.waitForTimeout(1500);
  const r5 = await t5.page.evaluate(() => {
    const box = document.getElementById('reportsBox');
    if (!box) return null;
    const card = [...box.querySelectorAll('.card-row')].find(c => /Galaxie-Ziel der Woche erreicht/.test(c.textContent || ''));
    return { gefunden: !!card, text: card ? (card.textContent || '').replace(/\s+/g, ' ').trim() : (box.textContent || '').slice(0, 200) };
  });
  check('5a: die Berichtskarte nennt Titel, Stand/Ziel, Beitrag, Kredite und Staub - und traegt keine Gewonnen/Verloren-Pille',
    !!r5 && r5.gefunden && /Schläge gegen Alien-Nester/.test(r5.text) && /14 \/ 12/.test(r5.text) && /dein Beitrag: 3/.test(r5.text)
      && /\+350 Kredite/.test(r5.text) && /\+5 Sternenstaub/.test(r5.text) && /31\.08\.2026/.test(r5.text)
      && !/Gewonnen|Verloren/.test(r5.text), r5);
  await t5.ctx.close();

  await ende(async () => browser.close());
})();
