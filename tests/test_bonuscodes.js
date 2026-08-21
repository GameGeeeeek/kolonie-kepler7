// Bonuscodes im Spiel: Eingabefeld, Einlösung, Gutschrift, Bericht, Admin-Reiter.
//
// AUFTRAG (Sascha, 21.08.2026): "ich will ab und zu mal bonuscodes posten wo die spieler kleine
// geschenke bekommen die codes sollen aber nur eine gewisse gueltigkeit haben also max 1 mal pro
// account einloesbar und nur 1 woche etc aktiv am liebsten baust du mir das in den admin bereich
// ein."  Die serverseitigen Regeln misst tests/test_bonuscodes_http.js im BACKEND-Repo; hier geht
// es um das, was der Spieler sieht.
//
// DREI DINGE, DIE DIESER TEST ABSICHERT, und jedes hat einen belegten Grund:
//
//  1) DER EIGENE `bonuscode`-ZWEIG in claimPendingRewards ist PFLICHT. Ohne ihn faellt die
//     Belohnung in den Rueckfall und meldet dem Spieler woertlich "Dankeschoen vom Team: +500
//     Kredite fuer deinen Bug-Report!" - eine Falschaussage. Ohne `credits` stuende dort sogar
//     "+NaN Kredite", weil die Meldung ausserhalb des `if (r.credits)` steht (Abschnitt 3).
//
//  2) EINE ABLEHNUNG WIRD NICHT VERSCHWIEGEN. Der Einladungs-Bonus daneben schweigt bewusst -
//     er loest sich im Hintergrund ein, ohne dass der Spieler etwas angeklickt hat. Ein
//     Bonuscode ist eine bewusste Bedienhandlung; ein stiller Fehlschlag waere die tote Flaeche,
//     gegen die CLAUDE.md-Regel 35 geschrieben ist (Abschnitt 4).
//
//  3) DIE VERDRAHTUNG DARF SICH NICHT STAPELN. render() laeuft jede Sekunde; ein
//     addEventListener an dieser Stelle haette nach einer Minute 60 Handler und schickte den
//     Code 60-mal ab (Abschnitt 5).
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer, logMitschnitt, logZeilen } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';

// ---------------------------------------------------------------- 0) Verdrahtung im Quelltext
/* Gesucht wird der AUFRUF des Rueckfalls, nicht die Zeichenkette: Der erklaerende Kommentar ueber
   dem neuen Zweig zitiert den alten Meldungstext woertlich, und `indexOf` faende ihn zuerst
   (Hausregel 6, zweite Haelfte - ein Kommentar zitiert denselben Text). */
const rueckfallStelle = JS.indexOf("log('Dankeschön vom Team: +'");
const zweigStelle = JS.indexOf("if (r.type === 'bonuscode'){");
check('0-anker: beide Stellen gefunden', rueckfallStelle > 0 && zweigStelle > 0,
  { zweig: zweigStelle, rueckfall: rueckfallStelle });
check('0a: der Bonuscode-Zweig steht VOR dem Rueckfall-Zweig - sonst greift der Rueckfall zuerst',
  zweigStelle > 0 && rueckfallStelle > 0 && zweigStelle < rueckfallStelle,
  { zweig: zweigStelle, rueckfall: rueckfallStelle });
check('0b: die Knoepfe werden per onclick verdrahtet, nicht per addEventListener',
  /bonusCodeBtn\.onclick *=/.test(JS) && !/bonusCodeBtn\.addEventListener/.test(JS),
  { onclick: /bonusCodeBtn\.onclick *=/.test(JS), addEventListener: /bonusCodeBtn\.addEventListener/.test(JS) });
check('0c: der Bonuscode-Bericht traegt KEINE Gewonnen/Verloren-Pille - ein Geschenk hat keinen Ausgang',
  /REPORT_SPECIAL_GREEN_TYPES = \[[^\]]*'bonuscode'/.test(JS));

function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'bonuscode/einloesen'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__einloesungen = (store.__einloesungen || []).concat([body.code]);
      const a = store.__antwort || { status:200, body:{ ok:true, code:'STERNENSTAUB25', gaben:{ credits:500 } } };
      return j(a.body, a.status);
    }
    if (p === 'pending-rewards/claim'){
      const naechste = (store.__belohnungen || []).shift();
      return j({ reward: naechste || null });
    }
    if (p === 'admin/bonuscodes'){
      if (!store.__adminOk) return j({ error:'Kein Admin-Zugriff.' }, 403);
      return j({ codes: store.__codes || [], gaben: { credits:{max:25000,name:'Kredite'}, erz:{max:2000000,name:'Erz'} },
                 laufzeiten: [1,3,7,14,30], maxAktiv: 50 });
    }
    if (p === 'admin/bonuscode'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      store.__angelegt = (store.__angelegt || []).concat([body]);
      if (!store.__adminOk) return j({ error:'Kein Admin-Zugriff.' }, 403);
      return j({ ok:true, code:'NEUERCODE99', gueltigBis: Date.now() + 7*86400000 });
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
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await logMitschnitt(page);
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
    'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
const feldText = (t, id) => t.page.evaluate(i => {
  const el = document.getElementById(i);
  if (!el) return null;
  return { sichtbar: !!el.offsetParent || getComputedStyle(el).display !== 'none', text: (el.textContent||'').trim(), wert: el.value };
}, id);

(async () => {
  const browser = await starteBrowser();
  const roh = await tab(browser, null);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0d: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift'])
      if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    st.seenTabHints = ['basis','forschung','bau','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil'];
    st.credits = 1000; st.battlePoints = 0;
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 10000;
    return JSON.stringify(st);
  }
  const zuEinstellungen = async t => {
    await t.page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="einstellungen"]'); if (b) b.click(); });
    await t.page.waitForTimeout(900);
  };

  // ---- 1) Das Eingabefeld gibt es - und nur mit Server ----------------------------------------
  const t1 = await tab(browser, fixture());
  await zuEinstellungen(t1);
  const feld = await feldText(t1, 'bonusCodeRow');
  check('1a: das Eingabefeld steht im Einstellungen-Reiter', !!feld && feld.sichtbar, feld);
  check('1b: der Abschnitt erklaert die zwei Regeln des Auftrags - Laufzeit und einmal je Konto',
    await t1.page.evaluate(() => {
      const t = document.getElementById('tab-einstellungen');
      const s = t ? t.textContent : '';
      return /Bonuscode/.test(s) && /einmal je Konto/.test(s) && /nur eine Weile/.test(s);
    }));

  // ---- 2) Einlösen: Erfolg ---------------------------------------------------------------------
  await t1.page.evaluate(() => { const el = document.getElementById('bonusCodeInput'); if (el) el.value = 'sternen-staub 25'; });
  await t1.page.evaluate(() => { const b = document.getElementById('bonusCodeBtn'); if (b) b.click(); });
  await t1.page.waitForTimeout(1200);
  check('2a: der eingegebene Code geht ROH an den Server - normalisiert wird dort',
    (t1.store.__einloesungen || [])[0] === 'sternen-staub 25', { gesendet: t1.store.__einloesungen });
  const statusOk = await feldText(t1, 'bonusCodeStatus');
  check('2b: die BLEIBENDE Zeile meldet den Erfolg - nicht nur das Protokoll',
    !!statusOk && statusOk.sichtbar && /eingelöst/.test(statusOk.text), statusOk);
  const feldNach = await t1.page.evaluate(() => (document.getElementById('bonusCodeInput')||{}).value);
  check('2c: und das Eingabefeld ist geleert', feldNach === '', { wert: feldNach });
  await t1.ctx.close();

  // ---- 3) Die Gutschrift: eigener Zweig, kein Rueckfall ----------------------------------------
  const t3 = await tab(browser, fixture(), { __belohnungen: [
    { id:'b1', type:'bonuscode', code:'STERNENSTAUB25', credits:500, erz:5000, kampfpunkte:25 } ] });
  await t3.page.waitForTimeout(2500);
  const zeilen3 = await logZeilen(t3.page);
  check('3a: die Meldung nennt den Bonuscode - NICHT "Dankeschoen vom Team ... Bug-Report"',
    zeilen3.some(z => /Bonuscode eingelöst/.test(z)) && !zeilen3.some(z => /Bug-Report/.test(z)),
    { zeilen: zeilen3.filter(z => /Bonuscode|Bug-Report/.test(z)) });
  check('3b: sie zaehlt auf, was gutgeschrieben wurde',
    zeilen3.some(z => /\+500 Kredite/.test(z) && /Erz/.test(z)),
    { zeilen: zeilen3.filter(z => /Bonuscode/.test(z)) });
  // `state` lebt im Modulscope der Spieldatei und ist von aussen nicht erreichbar (Hausregel 47) -
  // gemessen wird der GESPEICHERTE Stand, den der Zweig ueber save() schreibt.
  const fx3 = t3.store[SAVE_KEY];
  for (let i = 0; i < 25 && t3.store[SAVE_KEY] === fx3; i++) await t3.page.waitForTimeout(400);
  const st3 = t3.stand();
  check('3c: und die Werte stehen wirklich im gespeicherten Spielstand',
    st3.credits === 1500 && (st3.resources||{}).erz === 15000 && st3.battlePoints === 25,
    { credits: st3.credits, erz: (st3.resources||{}).erz, kampfpunkte: st3.battlePoints });
  const b3 = (t3.store.__berichte || []).find(b => b && b.type === 'bonuscode');
  check('3d: es gibt einen BLEIBENDEN Bericht - log() ueberschreibt sich selbst',
    !!b3 && b3.code === 'STERNENSTAUB25' && Array.isArray(b3.gaben) && b3.gaben.length === 3,
    b3 ? { code: b3.code, gaben: b3.gaben } : { berichte: (t3.store.__berichte||[]).map(x => x.type) });
  check('3e: keine Seitenfehler - der Zweig darf die Abhol-Schleife nicht werfen', t3.errs.length === 0,
    { seitenfehler: t3.errs.slice(0,3) });
  await t3.ctx.close();

  // ---- 3f) Ein Code OHNE credits darf nicht "+NaN Kredite" melden -------------------------------
  const t3b = await tab(browser, fixture(), { __belohnungen: [ { id:'b2', type:'bonuscode', code:'NURERZ99', erz:1000 } ] });
  await t3b.page.waitForTimeout(2500);
  const zeilen3b = await logZeilen(t3b.page);
  check('3f: ein Code ohne Kredite meldet kein NaN',
    zeilen3b.some(z => /Bonuscode eingelöst/.test(z)) && !zeilen3b.some(z => /NaN/.test(z)),
    { zeilen: zeilen3b.filter(z => /Bonuscode|NaN/.test(z)) });
  await t3b.ctx.close();

  // ---- 4) Die Ablehnung wird NICHT verschwiegen -------------------------------------------------
  for (const fall of [
    { name:'4a', status:410, fehler:'Dieser Code ist abgelaufen.', suche:/abgelaufen/ },
    { name:'4b', status:409, fehler:'Diesen Code hast du bereits eingelöst.', suche:/bereits eingelöst/ },
    { name:'4c', status:404, fehler:'Diesen Code gibt es nicht.', suche:/gibt es nicht/ }
  ]){
    const t = await tab(browser, fixture(), { __antwort: { status: fall.status, body: { error: fall.fehler } } });
    await zuEinstellungen(t);
    await t.page.evaluate(() => { const el = document.getElementById('bonusCodeInput'); if (el) el.value = 'IRGENDEINCODE'; });
    await t.page.evaluate(() => { const b = document.getElementById('bonusCodeBtn'); if (b) b.click(); });
    await t.page.waitForTimeout(1000);
    const st = await feldText(t, 'bonusCodeStatus');
    check(fall.name + ': die Ablehnung "' + fall.fehler + '" steht sichtbar da - mit dem GRUND',
      !!st && st.sichtbar && fall.suche.test(st.text), st);
    await t.ctx.close();
  }

  // ---- 5) Die Verdrahtung stapelt sich nicht ----------------------------------------------------
  // render() laeuft jede Sekunde. Nach mehreren Sekunden darf EIN Klick genau EINE Anfrage
  // ausloesen - bei addEventListener waeren es so viele wie vergangene Ticks.
  const t5 = await tab(browser, fixture());
  await zuEinstellungen(t5);
  await t5.page.waitForTimeout(4500);
  await t5.page.evaluate(() => { const el = document.getElementById('bonusCodeInput'); if (el) el.value = 'EINMALIG12'; });
  await t5.page.evaluate(() => { const b = document.getElementById('bonusCodeBtn'); if (b) b.click(); });
  await t5.page.waitForTimeout(1200);
  check('5a: ein Klick nach mehreren Ticks loest GENAU EINE Anfrage aus',
    (t5.store.__einloesungen || []).length === 1, { anfragen: (t5.store.__einloesungen || []).length });
  await t5.ctx.close();

  // ---- 6) Der Admin-Reiter ----------------------------------------------------------------------
  const t6 = await tab(browser, fixture(), { __adminOk: true, __codes: [
    { code:'ALTCODE123', anzeige:'ALTCODE123', gaben:{ credits:500 }, angelegt: Date.now()-3600000,
      gueltigBis: Date.now() + 3*86400000, maxGesamt: 0, eingeloest: 7, aktiv: true, notiz:'TikTok' } ] });
  await t6.page.evaluate(() => { const o = document.getElementById('adminPanelOverlay'); if (o) o.style.display = 'flex'; });
  await t6.page.evaluate(() => { const b = document.getElementById('adminTabCodesBtn'); if (b) b.click(); });
  await t6.page.waitForTimeout(1500);
  const sicht = await t6.page.evaluate(() => {
    const v = document.getElementById('adminCodesView');
    return { da: !!v, offen: v ? getComputedStyle(v).display !== 'none' : false,
             sub: (document.getElementById('adminPanelSub')||{}).textContent,
             liste: (document.getElementById('adminCodeList')||{}).textContent || '',
             gaben: [...document.querySelectorAll('[data-code-gabe]')].map(e => e.getAttribute('data-code-gabe')),
             zeiten: [...document.querySelectorAll('[data-code-tage]')].map(e => e.getAttribute('data-code-tage')) };
  });
  check('6a: der Codes-Reiter oeffnet sich und nennt sich in der Kopfzeile',
    sicht.da && sicht.offen && /Bonuscode/.test(sicht.sub || ''), { offen: sicht.offen, sub: sicht.sub });
  check('6b: die Gaben-Felder kommen VOM SERVER - kein zweiter Satz Grenzen im Frontend',
    sicht.gaben.length === 2 && sicht.gaben.includes('credits') && sicht.gaben.includes('erz'), { gaben: sicht.gaben });
  check('6c: die Laufzeiten ebenfalls', sicht.zeiten.join(',') === '1,3,7,14,30', { zeiten: sicht.zeiten });
  check('6d: die Liste nennt Einloesungen, Restlaufzeit und Notiz',
    /ALTCODE123/.test(sicht.liste) && /7×/.test(sicht.liste) && /TikTok/.test(sicht.liste),
    { liste: sicht.liste.slice(0, 160) });
  /* Anlegen ueber den Spielerweg - die Werte muessen aus den Feldern eingesammelt werden.
     Der Aufbau steht in try/catch und meldet seinen Fehlschlag als EIGENE Pruefung (Hausregel 34):
     Am Stand ohne die Etappe gibt es die Felder nicht, `getElementById(...).value` warf, und der
     Test starb hier - 6e und 6f liefen in der Gegenprobe nie, waehrend der rote Exit-Code wie eine
     vollstaendige Gegenprobe aussah. */
  let aufbau6 = null;
  try {
    await t6.page.evaluate(() => {
      const name = document.getElementById('adminCodeName');
      const knopf = document.getElementById('adminCodeCreateBtn');
      if (!name || !knopf) throw new Error('Eingabefeld oder Knopf fehlt');
      name.value = 'NEUERCODE99';
      const g = document.querySelector('[data-code-gabe="credits"]'); if (g) g.value = '750';
      const m = document.getElementById('adminCodeMaxGesamt'); if (m) m.value = '100';
      knopf.click();
    });
  } catch(e){ aufbau6 = String(e.message || e).split('\n')[0]; }
  check('6e-bau: die Anlege-Flaeche laesst sich bedienen', aufbau6 === null, { aufbau6 });
  await t6.page.waitForTimeout(1200);
  const gesendet = (t6.store.__angelegt || [])[0];
  check('6e: der Anlegen-Knopf schickt Code, Gabe, Laufzeit und Deckel',
    !!gesendet && gesendet.code === 'NEUERCODE99' && gesendet.gaben && gesendet.gaben.credits === 750 &&
    gesendet.tage === 7 && gesendet.maxGesamt === 100, gesendet);
  check('6f: keine Seitenfehler im Admin-Reiter', t6.errs.length === 0, { seitenfehler: t6.errs.slice(0,3) });
  await t6.ctx.close();

  await browser.close();
  ende();
})();
