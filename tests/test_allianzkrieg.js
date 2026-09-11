// Allianzkriege mit Einsatz (Feature C, 11.09.2026): das Kriegspanel liest Punkte, Zeit, Top-Beitraege und
// Kriegsruhm vom Server (GET /api/allianzkrieg), Erklaerung und Frieden laufen ueber die neuen Routen,
// der Client schreibt keine Kriegspunkte mehr selbst, und die zwei Belohnungszweige (war-victory mit
// Staub, war-defeat) stehen vor dem Rueckfall. Die serverseitigen Regeln misst
// tests/test_allianzkrieg_http.js im BACKEND-Repo; hier geht es um das, was der Spieler sieht.
//
// DREI DINGE, DIE DIESER TEST ABSICHERT:
//  1) DER CLIENT SCHREIBT KEINE KRIEGSPUNKTE MEHR (Abschnitt 0a, 2b, 3b). Bis Feature C stand
//     addWarScore im Spiel: +1 je gewonnenem Angriff per PUT auf alliance:<TAG>:warscore - und an diesem
//     Wert hing die Siegpraemie. Der Server lehnt diese PUTs jetzt ab; ein Client, der sie noch schickte,
//     saehe nur Fehler.
//  2) DER RUECKFALL IST STILL (Abschnitt 5). Antwortet der Server mit 404 (alter Server ohne die Route),
//     zeichnet das Panel wie bisher aus dem geteilten Speicher und erklaert wie bisher per PUT - ohne
//     Fehlermeldung (drei Zustaende, Hausregel 35). test_allianzbereiche.js misst denselben Weg mit
//     einer Attrappe, die {} statt 404 liefert.
//  3) DIE ZWEI BELOHNUNGSZWEIGE (Abschnitt 4). Ohne den war-defeat-Zweig faellt der Trostpreis in den
//     Rueckfall und meldet "Dankeschoen vom Team ... Bug-Report" - eine Falschaussage; und war-victory muss
//     den Staub NENNEN, ohne ihn zu addieren (der Server hat ihn gebucht).
//
// GEGENPROBE (gemessen am 11.09.2026 gegen den Stand vor Feature C, per
//   git show HEAD~1:weltraum_kolonie.html > /tmp/alt.html; KEPLER_SPIELDATEI=/tmp/alt.html node tests/test_allianzkrieg.js
// ): Was am alten Stand fallen MUSS: 0a, 0b, 0c, 0d, 0e, 0f, 0g, 0h, 1a, 1b, 1c, 1d, 2a, 2b, 2c, 3a, 3b,
// 4a, 4b, 4d, 6a. Was gruen bleiben MUSS (die additive Zusage): 0i, 1e, 3c, 4c, 4e, 5a, 5b, 5c, 6b.
// 4c bleibt am alten Stand bewusst gruen: Der Rueckfall-Zweig bucht die 200 Kredite ebenfalls - falsch ist
// dort nur die MELDUNG (4b), nicht der Betrag. 2c faellt, weil der alte Client die Route gar nicht ruft und
// den Grund des Servers deshalb nie sieht.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer, logMitschnitt, logZeilen } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
const UID = 'u-anna', TAG = 'AAAA';

// ---------------------------------------------------------------- 0) Verdrahtung im Quelltext
check('0a: kein Client-Schreibzugriff auf warscore/warcontrib mehr - addWarScore ist weg',
  !/storageSet\('alliance:'\+tag\+':warscore/.test(JS) && !/addWarScore\(/.test(JS),
  { storageSet: /storageSet\('alliance:'\+tag\+':warscore/.test(JS), aufrufe: (JS.match(/addWarScore\(/g) || []).length });
/* Gesucht wird der AUFRUF des Rueckfalls, nicht die Zeichenkette (Hausregel 6): Kommentare zitieren ihn. */
const rueckfallStelle = JS.indexOf("log('Dankeschön vom Team: +'");
const defeatStelle = JS.indexOf("if (r.type === 'war-defeat'){");
check('0b: der war-defeat-Zweig steht VOR dem Rueckfall-Zweig', defeatStelle > 0 && rueckfallStelle > 0 && defeatStelle < rueckfallStelle,
  { zweig: defeatStelle, rueckfall: rueckfallStelle });
check('0c: der war-victory-Zweig nennt den Staub (r.staub) - und addiert ihn nicht',
  /r\.type === 'war-victory'\)\{[\s\S]{0,900}?r\.staub \? /.test(JS) && !/state\.staub[^\n]*r\.staub/.test(JS));
check('0d: Ehrentitel „Kriegsherren" mit exklusiver Quelle und Vergabe ab drei Siegen',
  /key:'kriegsherren'[^}]*exclusiveSource:true/.test(JS) && /const KRIEGSHERREN_SIEGE = 3;/.test(JS) && /function grantKriegsherrenTitleIfEarned\(/.test(JS));
check('0e: der Hilfe-Eintrag „Kriege" nennt den Server, +10, den Tagesdeckel und den Trostpreis',
  /title:'Kriege', body:'[^']*Kriegspunkte vergibt der Server[^']*\+10[^']*3 Angriffe am Tag[^']*Trostpreis/.test(JS));
check('0f: Bericht-Typ war-defeat in Kategorie, Renderer und Symbolwahl',
  /'asteroid-verteidigung','war-defeat'\] \}/.test(JS) && /r\.type === 'war-defeat'\)\{/.test(JS) && /r\.type==='war-defeat' \? 'ti-skull'/.test(JS));
check('0g: Erklaeren und Frieden gehen ueber die Routen - mit 404-Rueckfall',
  /allianzkriegRoute\('\/allianzkrieg\/erklaeren', enemyTag\)/.test(JS) && /allianzkriegRoute\('\/allianzkrieg\/frieden', enemyTag\)/.test(JS) &&
  /if \(res\.status === 404\)\{ allianzkriegServer = false; return 'alt'; \}/.test(JS));
check('0h: die Frieden-Knoepfe des Server-Panels werden per onclick verdrahtet',
  /btn\.onclick = \(\) => makePeace\(btn\.getAttribute\('data-make-peace'\)\)/.test(JS));

function lage(store){
  return store.__lage || {
    aktiv:true, tag:TAG,
    kriege:[{ gegnerTag:'IRON', endsAt: Date.now() + 3*86400000, laeuft:true, erklaertVon:'anna', erklaertAm: Date.now() - 86400000,
      punkte:{ eigene:12, gegner:6 }, topBeitraege:[{ userId:UID, name:'anna', score:12 }, { userId:'m2', name:'HandelsHans', score:4 }], meinBeitrag:12 }],
    ruhm: store.__ruhm || { siege:2, niederlagen:1, unentschieden:0 },
    regeln:{ dauerMs: 7*86400000, maxLaufend:2, tagesdeckel:3, punkte:{ sieg:10, niederlage:2, abwehr:6, vorposten:8 }, siegKredite:1200, siegStaub:15, trostKredite:200 }
  };
}
function backend(store){
  return async r => {
    const req = r.request(); const url = req.url().split('/api/')[1] || ''; const p = url.split('?')[0]; const query = url.split('?')[1] || '';
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:UID, username:'anna', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'allianzkrieg'){
      store.__lageAbrufe = (store.__lageAbrufe || 0) + 1;
      if (store.__server404) return j({ error:'Nicht gefunden' }, 404);
      return j(lage(store));
    }
    if (p === 'allianzkrieg/erklaeren' || p === 'allianzkrieg/frieden'){
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch(e){}
      const liste = p.endsWith('erklaeren') ? '__erklaert' : '__frieden';
      store[liste] = (store[liste] || []).concat([body]);
      if (store.__server404) return j({ error:'Nicht gefunden' }, 404);
      const a = store.__routenAntwort || { status:200, body:{ ok:true, gegnerTag: body.gegnerTag } };
      return j(a.body, a.status);
    }
    if (p === 'pending-rewards/claim'){
      const naechste = (store.__belohnungen || []).shift();
      return j({ reward: naechste || null });
    }
    if (p === 'storage-list'){
      const pre = decodeURIComponent((query.match(/prefix=([^&]*)/) || [])[1] || '');
      return j({ keys: Object.keys(store).filter(k => !k.startsWith('__') && k.startsWith(pre)) });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){
        store.__puts = (store.__puts || []).concat([k]);
        try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){}
        return j({ ok:true });
      }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications:[] });
    if (p === 'reports'){
      if (req.method() === 'POST'){
        try { store.__berichte.unshift(Object.assign({ id:'r'+(++store.__nr), time:Date.now() }, JSON.parse(req.postData()||'{}').report || {})); } catch(e){}
        return j({ ok:true });
      }
      return j({ reports: store.__berichte });
    }
    if (/leaderboard|messages|ranking|halloffame|bounty|friends/.test(p)) return j([]);
    return j({});
  };
}
async function tab(browser, save, opt){
  const store = Object.assign({ __berichte: [], __nr: 0 }, opt || {});
  if (save) store[SAVE_KEY] = save;
  // Ohne diesen Datensatz wirft syncOwnAllianceRole() den Spieler bei einem 404 lokal aus der Allianz.
  store['alliance:'+TAG+':role:'+UID] = JSON.stringify({ playerId:UID, name:'anna', role:'admin', joinedAt: Date.now() - 86400000 });
  const ctx = await browser.newContext({ viewport:{ width:1100, height:1600 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message || e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); window.confirm = () => true; });
  await logMitschnitt(page);
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
    'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
const boxText = (t, id) => t.page.evaluate(i => {
  const el = document.getElementById(i);
  if (!el) return null;
  return { da:true, sichtbar: getComputedStyle(el).display !== 'none', text: (el.textContent||'').replace(/\s+/g,' ').trim() };
}, id);
const zumAllianzTab = async t => {
  await t.page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="allianz"]'); if (b) b.click(); });
  await t.page.waitForTimeout(1200);
  await t.page.evaluate(() => { const b = document.querySelector('#allianceSubtabBar [data-alliance-subtab="mitglieder"]'); if (b) b.click(); });
  await t.page.waitForTimeout(900);
};
const kriegsPuts = t => (t.store.__puts || []).filter(k => /^alliance:[^:]+:(wars|warmeta|warscore|warcontrib)/.test(k));

(async () => {
  const browser = await starteBrowser();
  const roh = await tab(browser, null);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0i: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    const fern = Date.now() + 365*24*3600*1000;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift'])
      if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    st.seenTabHints = ['basis','forschung','bau','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil'];
    st.tutorialSeen = true; st.newbieWelcomeSeen = true;
    st.credits = 1000; st.allianceTitles = []; st.equippedAllianceTitle = null;
    st.player = Object.assign({}, st.player || {}, { id:UID, name:'anna', allianceTag:TAG, allianceRole:'admin' });
    st.allianceTag = TAG; st.allianceRole = 'admin';
    return JSON.stringify(st);
  }

  // ---- 1) Das Panel zeichnet die Lage des Servers ---------------------------------------------
  const t1 = await tab(browser, fixture());
  await zumAllianzTab(t1);
  const box1 = await boxText(t1, 'allianceWarsBox');
  check('1a: das Kriegspanel zeigt den Krieg mit den SERVERpunkten 12 : 6 - nicht aus dem geteilten Speicher',
    !!box1 && /Krieg gegen \[IRON\]/.test(box1.text) && /12 : 6/.test(box1.text) && /in Führung/.test(box1.text), box1);
  check('1b: Restzeit, Erklaerer und Top-Beitraege der eigenen Seite stehen dabei',
    !!box1 && /Endet in/.test(box1.text) && /erklärt von anna/.test(box1.text) && /Top: 1\. anna \(12\) · 2\. HandelsHans \(4\)/.test(box1.text) && /dein Beitrag: 12/.test(box1.text), box1);
  const ruhm1 = await boxText(t1, 'allianceRuhmLine');
  check('1c: der Kriegsruhm steht im Allianz-Kopf - "Siege · Niederlagen"',
    !!ruhm1 && ruhm1.sichtbar && /Kriegsruhm: 2 Siege · 1 Niederlagen/.test(ruhm1.text), ruhm1);
  check('1d: die Regeln kommen vom Server (Tagesdeckel, Praemie, Trostpreis) - keine zweite Kopie im Spiel',
    !!box1 && /höchstens 3 gewertete Angriffe/.test(box1.text) && /1\.2k Kredite \+ 15 Sternenstaub/.test(box1.text) && /Trostpreis 200 Kredite/.test(box1.text), box1);
  const reihe1 = await boxText(t1, 'allianceWarDeclareRow');
  check('1e: der Anfuehrer sieht die Erklaerungs-Zeile', !!reihe1 && reihe1.sichtbar, reihe1);

  // ---- 2) Erklaeren geht ueber die Route, nicht ueber den geteilten Speicher --------------------
  await t1.page.evaluate(() => { const el = document.getElementById('allianceWarTagInput'); if (el) el.value = 'nova'; });
  await t1.page.evaluate(() => { const b = document.getElementById('allianceWarDeclareBtn'); if (b) b.click(); });
  await t1.page.waitForTimeout(1200);
  const zeilen2 = await logZeilen(t1.page);
  check('2a: der Klick ruft POST /api/allianzkrieg/erklaeren mit dem GROSSGESCHRIEBENEN Tag - und meldet den Erfolg',
    (t1.store.__erklaert || []).length === 1 && t1.store.__erklaert[0].gegnerTag === 'NOVA' && zeilen2.some(z => /Krieg gegen Allianz \[NOVA\] erklärt/.test(z)),
    { erklaert: t1.store.__erklaert, zeilen: zeilen2.filter(z => /Krieg/.test(z)) });
  check('2b: KEIN PUT auf wars/warmeta/warscore/warcontrib - der alte Weg ist nicht mehr der Weg',
    kriegsPuts(t1).length === 0, { puts: kriegsPuts(t1) });
  // Ablehnung mit Grund: der Servertext steht im Log, kein Rueckfall auf den alten Weg.
  t1.store.__routenAntwort = { status:409, body:{ error:'Mit [NOVA] seid ihr bereits im Krieg.' } };
  await t1.page.evaluate(() => { const el = document.getElementById('allianceWarTagInput'); if (el) el.value = 'NOVA'; });
  await t1.page.evaluate(() => { const b = document.getElementById('allianceWarDeclareBtn'); if (b) b.click(); });
  await t1.page.waitForTimeout(1000);
  const zeilen2b = await logZeilen(t1.page);
  check('2c: eine Ablehnung des Servers steht mit GRUND im Log - und loest keinen PUT aus',
    zeilen2b.some(z => /bereits im Krieg/.test(z)) && kriegsPuts(t1).length === 0, { zeilen: zeilen2b.filter(z => /Krieg/.test(z)).slice(-2), puts: kriegsPuts(t1) });
  t1.store.__routenAntwort = null;

  // ---- 3) Frieden ueber die Route -------------------------------------------------------------------
  await t1.page.evaluate(() => { const b = document.querySelector('#allianceWarsBox [data-make-peace="IRON"]'); if (b) b.click(); });
  await t1.page.waitForTimeout(1000);
  const zeilen3 = await logZeilen(t1.page);
  check('3a: der Frieden-Knopf ruft POST /api/allianzkrieg/frieden mit dem Gegner-Tag',
    (t1.store.__frieden || []).length === 1 && t1.store.__frieden[0].gegnerTag === 'IRON' && zeilen3.some(z => /Frieden mit Allianz \[IRON\] geschlossen/.test(z)),
    { frieden: t1.store.__frieden, zeilen: zeilen3.filter(z => /Frieden/.test(z)) });
  check('3b: auch dafuer kein PUT in den geteilten Speicher', kriegsPuts(t1).length === 0, { puts: kriegsPuts(t1) });
  check('3c: keine Seitenfehler im Kriegspanel', t1.errs.length === 0, { seitenfehler: t1.errs.slice(0,3) });
  await t1.ctx.close();

  // ---- 4) Die zwei Belohnungszweige ---------------------------------------------------------------
  const t4 = await tab(browser, fixture(), { __belohnungen: [
    { id:'w1', type:'war-victory', enemyTag:'IRON', credits:1200, staub:15, myScore:30, theirScore:12 },
    { id:'w2', type:'war-defeat', enemyTag:'NOVA', credits:200, myScore:5, theirScore:9 } ] });
  await t4.page.waitForTimeout(2500);
  const zeilen4 = await logZeilen(t4.page);
  check('4a: der Sieg nennt Praemie UND Staub - "+15 Sternenstaub" steht in der Meldung',
    zeilen4.some(z => /KRIEG GEWONNEN gegen Allianz \[IRON\]/.test(z) && /\+1\.2k Kredite/.test(z) && /\+15 Sternenstaub/.test(z) && /Endstand 30:12/.test(z)),
    { zeilen: zeilen4.filter(z => /KRIEG|Krieg/.test(z)) });
  check('4b: die Niederlage hat einen EIGENEN Zweig - Trostpreis mit Endstand, kein "Dankeschoen vom Team"',
    zeilen4.some(z => /Krieg gegen Allianz \[NOVA\] verloren/.test(z) && /Endstand 5:9/.test(z) && /\+200 Kredite/.test(z)) &&
    !zeilen4.some(z => /Bug-Report|Dankeschön vom Team/.test(z)),
    { zeilen: zeilen4.filter(z => /verloren|Dankeschön|Bug-Report/.test(z)) });
  const fx4 = t4.store[SAVE_KEY];
  for (let i = 0; i < 25 && t4.store[SAVE_KEY] === fx4; i++) await t4.page.waitForTimeout(400);
  const st4 = t4.stand();
  check('4c: beide Kredit-Betraege stehen im gespeicherten Spielstand (1000 + 1200 + 200) - der Staub wird NICHT lokal addiert',
    st4.credits === 2400 && st4.warsWon === 1 && st4.staub === undefined, { credits: st4.credits, warsWon: st4.warsWon, staub: st4.staub });
  const bericht4 = (t4.store.__berichte || []).find(b => b && b.type === 'war-defeat');
  const siegBericht4 = (t4.store.__berichte || []).find(b => b && b.type === 'weekly-reward' && /Kriegssieg/.test(b.rewardLabel || ''));
  check('4d: es gibt einen BLEIBENDEN Bericht je Zweig - die Niederlage als eigener Typ mit Verloren-Ausgang, der Sieg nennt den Staub',
    !!bericht4 && bericht4.result === 'loss' && bericht4.enemyTag === 'NOVA' && bericht4.credits === 200 &&
    !!siegBericht4 && /15 Sternenstaub/.test(siegBericht4.rewardLabel),
    { niederlage: bericht4, sieg: siegBericht4 && siegBericht4.rewardLabel, alle: (t4.store.__berichte||[]).map(b => b.type) });
  check('4e: keine Seitenfehler - die Zweige duerfen die Abhol-Schleife nicht werfen', t4.errs.length === 0, { seitenfehler: t4.errs.slice(0,3) });
  await t4.ctx.close();

  // ---- 5) Der Rueckfall: alter Server (404) -> alter Weg, still ----------------------------------
  const t5 = await tab(browser, fixture(), { __server404: true,
    ['alliance:'+TAG+':wars']: JSON.stringify({ enemies:['IRON'] }),
    ['alliance:'+TAG+':warscore:IRON']: JSON.stringify({ score:5 }),
    ['alliance:IRON:warscore:'+TAG]: JSON.stringify({ score:3 }),
    ['alliance:'+TAG+':warmeta:IRON']: JSON.stringify({ startedAt: Date.now()-86400000, endsAt: Date.now()+2*86400000, declaredBy:TAG }) });
  await zumAllianzTab(t5);
  const box5 = await boxText(t5, 'allianceWarsBox');
  check('5a: mit 404 zeichnet das Panel wie bisher aus dem geteilten Speicher (5 : 3) - keine Fehlermeldung',
    !!box5 && /Krieg gegen \[IRON\]/.test(box5.text) && /5 : 3/.test(box5.text) && !/nicht verfügbar/.test(box5.text), box5);
  const ruhm5 = await boxText(t5, 'allianceRuhmLine');
  check('5b: ohne Server-Lage bleibt die Ruhm-Zeile weg (leerer Rahmen waere die tote Flaeche)',
    !ruhm5 || !ruhm5.sichtbar || ruhm5.text === '', ruhm5);
  await t5.page.evaluate(() => { const el = document.getElementById('allianceWarTagInput'); if (el) el.value = 'ZZZZ'; });
  await t5.page.evaluate(() => { const b = document.getElementById('allianceWarDeclareBtn'); if (b) b.click(); });
  await t5.page.waitForTimeout(1500);
  const zeilen5 = await logZeilen(t5.page);
  check('5c: erklaeren geht dann den ALTEN Weg (PUT auf beide Kriegslisten) - und meldet den Erfolg wie bisher',
    kriegsPuts(t5).includes('alliance:'+TAG+':wars') && kriegsPuts(t5).includes('alliance:ZZZZ:wars') && zeilen5.some(z => /Krieg gegen Allianz \[ZZZZ\] erklärt/.test(z)) &&
    !zeilen5.some(z => /fehlgeschlagen|abgelehnt/.test(z)),
    { puts: kriegsPuts(t5), zeilen: zeilen5.filter(z => /Krieg/.test(z)) });
  await t5.ctx.close();

  // ---- 6) Der Ehrentitel „Kriegsherren" ab drei Siegen --------------------------------------------
  const t6 = await tab(browser, fixture(), { __ruhm: { siege:3, niederlagen:0, unentschieden:1 } });
  await zumAllianzTab(t6);
  const fx6 = t6.store[SAVE_KEY];
  for (let i = 0; i < 25 && t6.store[SAVE_KEY] === fx6; i++) await t6.page.waitForTimeout(400);
  const st6 = t6.stand();
  const ruhm6 = await boxText(t6, 'allianceRuhmLine');
  const zeilen6 = await logZeilen(t6.page);
  check('6a: bei drei Siegen liegt „kriegsherren" im gespeicherten Titelbesitz, ist angelegt und wird gemeldet',
    Array.isArray(st6.allianceTitles) && st6.allianceTitles.includes('kriegsherren') && st6.equippedAllianceTitle === 'kriegsherren' &&
    !!ruhm6 && /Kriegsherren/.test(ruhm6.text) && /unentschieden/.test(ruhm6.text) && zeilen6.some(z => /Ehrentitel „Kriegsherren"/.test(z)),
    { titel: st6.allianceTitles, angelegt: st6.equippedAllianceTitle, ruhm: ruhm6 });
  await t6.ctx.close();
  // Gegenrichtung: mit zwei Siegen (Abschnitt 1) gab es den Titel nicht.
  const t6b = await tab(browser, fixture());
  await zumAllianzTab(t6b);
  await t6b.page.waitForTimeout(1500);
  const st6b = t6b.stand();
  check('6b: mit zwei Siegen gibt es den Titel NICHT', !(st6b.allianceTitles || []).includes('kriegsherren'), { titel: st6b.allianceTitles });
  await t6b.ctx.close();

  await browser.close();
  ende();
})();
