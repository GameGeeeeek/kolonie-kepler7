// Vergeltung / Rache-Knopf (Feature D, 11.09.2026): der Knopf im Bericht, die Zeile im gewonnenen
// Vergeltungsschlag, die Hinweiszeile in der Angriffsvorschau - und die Paritaet der drei Zahlen
// mit dem Backend. Die serverseitigen Regeln misst tests/test_rache_http.js im BACKEND-Repo; hier
// geht es um das, was der Spieler sieht.
//
// VIER DINGE, DIE DIESER TEST ABSICHERT:
//
//  1) DER KNOPF STEHT NUR, WO DER SERVER IHN EINLOEST. Bedingung: attackerId (ein alter Server
//     schickt keine), juenger als 24 h, und - wenn /api/me die Rechte liefert - das Recht ist noch
//     da (Abschnitt 1). Ein Knopf an einem Bericht, dessen Recht laengst verbraucht ist, waere
//     "Vergeltung moeglich" als Falschaussage.
//  2) DER KNOPF BENUTZT DEN VORHANDENEN WEG (data-goto-attack, wie "Direkt Angriff" im Spionage-
//     bericht) und markiert das Ziel im Kampf-Unterreiter - keine zweite Verdrahtung (Abschnitt 2).
//  3) DREI ZUSTAENDE (Hausregel 35): Kennt der Server das Feld `rache` in /api/me nicht, bleibt die
//     Vorschau ohne Hinweiszeile - nichts versprechen, was der Server nicht einloest (Abschnitt 3).
//  4) DIE ZAHLEN SIND EINE KOPIE-FAMILIE mit server.js (Abschnitt 0a). Aendert das Backend den
//     Bonus, veraltet sonst jeder Text hier still.
//
// GEGENPROBE (GEMESSEN am 11.09.2026 gegen den Stand vor dieser Aenderung, Runner im Repo-Ordner:
//   git stash push -- weltraum_kolonie.html && node tests/test_rache.js; git stash pop):
//   fallen MUESSEN 0a-0e, 1a, 1d, 2-vorab, 2a, 2b, 3-vorab, 3a. Gruen BLEIBEN 0f, 1-vorab, 1b, 1c,
//   1e, 2c, 3b - 1b/1c/1e pruefen Abwesenheit und sind am alten Stand trivial wahr; ihr Beleg ist
//   die Gegenrichtung 1a/1d im selben Lauf.
// Aufruf mit Paritaet: KEPLER_BACKEND_SERVER=<pfad zur server.js> node tests/test_rache.js
const fs = require('fs');
const path = require('path');
const { SPIELDATEI, SPIEL_URL, SERVER_JS, starteBrowser, pruefer, logMitschnitt } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';

// ---------------------------------------------------------------- 0) Quelltext
// 0a: Paritaet der drei Konstanten mit dem Backend. Gelesen wird der AUSDRUCK, nicht der Wert -
// `24 * 3600 * 1000` auf beiden Seiten - und dann ausgewertet, damit `86400000` drueben auch ginge.
const konst = (quelle, name) => {
  const m = quelle.match(new RegExp('const ' + name + ' = ([^;]+);'));
  return m ? Function('return (' + m[1] + ')')() : null;
};
const NAMEN = ['RACHE_FENSTER_MS', 'RACHE_BEUTE_BONUS', 'RACHE_KAMPFPUNKTE'];
const vorn = Object.fromEntries(NAMEN.map(n => [n, konst(JS, n)]));
if (SERVER_JS && fs.existsSync(SERVER_JS)) {
  const SRV = fs.readFileSync(SERVER_JS, 'utf8');
  const hinten = Object.fromEntries(NAMEN.map(n => [n, konst(SRV, n)]));
  check('0a: RACHE_FENSTER_MS / RACHE_BEUTE_BONUS / RACHE_KAMPFPUNKTE sind mit server.js identisch',
    NAMEN.every(n => vorn[n] !== null && vorn[n] === hinten[n]), { frontend: vorn, backend: hinten });
} else {
  check('0a: die drei RACHE_*-Konstanten stehen im Quelltext (Backend-Klon nicht vorhanden - Paritaet uebersprungen, KEPLER_BACKEND_SERVER setzen)',
    NAMEN.every(n => vorn[n] !== null), vorn);
}
check('0b: der Rache-Knopf faehrt den VORHANDENEN data-goto-attack-Weg (keine zweite Verdrahtung, kein eigener Listener)',
  /data-goto-attack="\$\{escapeHtml\(r\.attackerId\)\}"[^>]*data-rache-knopf=/.test(JS) && !/\[data-rache-knopf\]/.test(JS),
  { knopf: /data-rache-knopf=/.test(JS), eigenerListener: /\[data-rache-knopf\]/.test(JS) });
check('0c: Renderer und Signatur fragen DIESELBE Bedingung (racheKnopfMoeglich steht in racheSig)',
  /const racheSig = reportsCache\.map\(r => racheKnopfMoeglich\(r\)/.test(JS) && /\+'\|'\+racheSig;/.test(JS));
const hilfe = JS.slice(JS.indexOf("{ key:'kampf', icon:'ti-sword', title:'Kampf', entries:["), JS.indexOf("{ key:'kampf', icon:'ti-sword', title:'Kampf', entries:[") + 200000);
check('0d: die Hilfe hat im Kampf-Kapitel einen Eintrag „Vergeltung", der Fenster, Beute-Bonus und Punkte aus den Konstanten ableitet',
  /\{ title:'Vergeltung', body:'[^\n]*RACHE_FENSTER_MS[^\n]*RACHE_BEUTE_BONUS[^\n]*RACHE_KAMPFPUNKTE/.test(hilfe));
// 0e: /api/me wird an vier Stellen ausgewertet, alle rufen supporterStatusUebernehmen - die Rechte
// werden GENAU DORT uebernommen, nicht an einer fuenften Stelle (Kommentar im Spiel).
const fnStart = JS.indexOf('function supporterStatusUebernehmen(me){');
const fnEnde = JS.indexOf('\n  }\n', fnStart);
// Die Deklaration (`let meineRache = null`) zaehlt nicht mit - gesucht sind ZUWEISUNGEN.
const zuweisungen = (JS.match(/(?<!let )meineRache = /g) || []).length;
check('0e: meineRache wird genau EINMAL zugewiesen, und zwar in supporterStatusUebernehmen',
  fnStart > 0 && zuweisungen === 1 && /(?<!let )meineRache = /.test(JS.slice(fnStart, fnEnde)), { zuweisungen });

// ---------------------------------------------------------------- Browser-Attrappe
function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me'){
      const me = { userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true };
      if (store.__rache !== undefined) me.rache = store.__rache;   // undefined = alter Server ohne das Feld
      return j(me);
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications:[] });
    if (p === 'reports') return j({ reports: store.__berichte });
    if (p === 'attack') return j({ error:'Attrappe' }, 500);
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|spieler-standorte/.test(p)) return j([]);
    return j({});
  };
}
async function tab(browser, save, opt){
  const store = Object.assign({ __berichte: [] }, opt || {});
  if (save) store[SAVE_KEY] = save;
  const ctx = await browser.newContext({ viewport:{ width:1100, height:1600 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message || e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await logMitschnitt(page);
  await page.goto(SPIEL_URL);
  await page.waitForSelector('.tab-btn[data-tab="galaxie"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
    'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  // Die Berichte haben keinen eigenen Reiter - #reportsBox wird gezeichnet, sobald loadReports() sie hat.
  await page.waitForFunction(() => { const b = document.getElementById('reportsBox'); return !!b && b.children.length > 0; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
// Je Karte: Titel, Text, ob ein Rache-Knopf drinsteht - gescopt auf #reportsBox.
const karten = t => t.page.evaluate(() => Array.from(document.querySelectorAll('#reportsBox .card-row')).map(k => ({
  titel: (k.querySelector('.bname') || {}).textContent || '',
  text: k.textContent || '',
  knopf: !!k.querySelector('[data-rache-knopf]'),
  knopfText: (k.querySelector('[data-rache-knopf]') || {}).textContent || ''
})));
const karteMit = (liste, teil) => liste.find(k => k.titel.includes(teil)) || { titel:'(fehlt)', text:'', knopf:false };

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
    return JSON.stringify(st);
  }
  const jetzt = Date.now();
  const H = 3600 * 1000;
  // Die Berichte: Namen sind eindeutig, damit die Karten ueber den Titel gefunden werden koennen.
  const berichte = () => [
    { id:'r1', type:'attack-received', result:'loss', attackerName:'Rivale', attackerId:'gegner-1', attackPower:100, defensePower:50, fleet:{ fighters:3 }, stolen:{ erz:500 }, time: jetzt - 1*H },
    { id:'r2', type:'attack-received', result:'win', attackerName:'Altfeind', attackerId:'gegner-2', attackPower:20, defensePower:50, fleet:{ fighters:1 }, defendReward:7, time: jetzt - 25*H },
    { id:'r5', type:'attack-received', result:'loss', attackerName:'Verbrauchter', attackerId:'gegner-3', attackPower:100, defensePower:50, fleet:{ fighters:3 }, time: jetzt - 2*H },
    { id:'r3', type:'attack-sent', result:'win', targetName:'Rivale', targetUserId:'gegner-1', rache:true, racheBonus:0.25, attackPower:120, defensePower:40, stolen:{ erz:1250 }, fleet:{ fighters:5 }, time: jetzt - 0.5*H },
    { id:'r4', type:'attack-sent', result:'win', targetName:'Dritter', targetUserId:'gegner-4', attackPower:120, defensePower:40, stolen:{ erz:1000 }, fleet:{ fighters:5 }, time: jetzt - 0.4*H }
  ];
  // /api/me fuehrt NUR gegner-1 (Rivale). gegner-3 hat sein Recht verbraucht, gegner-2 ist abgelaufen.
  const rechte = [{ gegnerId:'gegner-1', gegnerName:'Rivale', bis: jetzt + 23*H }];

  // ---- 1) Die Berichte -----------------------------------------------------------------------
  const t1 = await tab(browser, fixture(), { __berichte: berichte(), __rache: rechte });
  const k1 = await karten(t1);
  const r1 = karteMit(k1, 'von Rivale'), r2 = karteMit(k1, 'von Altfeind'), r5 = karteMit(k1, 'von Verbrauchter');
  const r3 = karteMit(k1, 'Angriff auf Rivale'), r4 = karteMit(k1, 'Angriff auf Dritter');
  check('1-vorab: alle fuenf Berichte sind gezeichnet', [r1, r2, r5, r3, r4].every(k => k.titel !== '(fehlt)'), k1.map(k => k.titel));
  check('1a: frischer Bericht mit attackerId und gueltigem Recht: Zeile „Vergeltung möglich bis" + Knopf „Vergeltungsschlag"',
    r1.knopf && /Vergeltungsschlag/.test(r1.knopfText) && /Vergeltung möglich bis/.test(r1.text) && /\+25 % Beute/.test(r1.text) && /\+10 Kampfpunkte/.test(r1.text),
    { knopf: r1.knopf, knopfText: r1.knopfText, zeile: /Vergeltung möglich bis/.test(r1.text) });
  check('1b: aelter als 24 h -> kein Knopf, keine Zeile', !r2.knopf && !/Vergeltung möglich/.test(r2.text), { knopf: r2.knopf });
  check('1c: frisch, aber /api/me fuehrt das Recht nicht mehr (verbraucht) -> kein Knopf, keine Zeile',
    !r5.knopf && !/Vergeltung möglich/.test(r5.text), { knopf: r5.knopf });
  check('1d: attack-sent mit rache -> Zeile „Vergeltungsschlag: +25 % Beute, +10 Kampfpunkte"',
    /Vergeltungsschlag: \+25 % Beute, \+10 Kampfpunkte/.test(r3.text), { text: r3.text.slice(0, 200) });
  check('1e: attack-sent ohne rache -> keine Vergeltungs-Zeile', !/Vergeltungsschlag/.test(r4.text), { text: r4.text.slice(0, 120) });

  // ---- 2) Der Klick markiert das Ziel und die Vorschau nennt die Vergeltung -------------------
  // Der Klick wird am ELEMENT ausgeloest, nicht per Zeiger: Die Berichte-Box liegt in einem Reiter,
  // der beim Start nicht aktiv ist, und ein Zeiger-Klick wartet dort auf Sichtbarkeit. Der Handler
  // haengt am Knopf selbst (data-goto-attack-Delegation), der Weg ist derselbe.
  const geklickt = await t1.page.evaluate(() => { const b = document.querySelector('#reportsBox [data-rache-knopf="r1"]'); if (!b) return false; b.click(); return true; });
  check('2-vorab: der Knopf des frischen Berichts wurde ausgeloest', geklickt);
  await t1.page.waitForTimeout(1500);
  const vorschau = await t1.page.evaluate(() => {
    const b = document.getElementById('pendingAttackBox');
    const aktiv = document.querySelector('.tab-btn.active') || document.querySelector('.tab-btn[aria-selected="true"]');
    return { text: b ? b.textContent : null, tab: aktiv ? aktiv.getAttribute('data-tab') : null,
             galaxieSichtbar: !!(document.getElementById('tab-galaxie') && document.getElementById('tab-galaxie').offsetParent) };
  });
  check('2a: der Klick markiert das Ziel im Kampf-Unterreiter (goToAttackPlayer: „Markiertes Ziel: Rivale")',
    !!vorschau.text && /Markiertes Ziel:\s*Rivale/.test(vorschau.text) && vorschau.galaxieSichtbar, vorschau);
  check('2b: die Angriffsvorschau nennt die Vergeltung mit Beute-Bonus und Punkten',
    !!vorschau.text && /Vergeltung:/.test(vorschau.text) && /\+25 % Beute/.test(vorschau.text) && /\+10 Kampfpunkte/.test(vorschau.text) && /möglich bis/.test(vorschau.text),
    { text: (vorschau.text || '').slice(0, 300) });
  check('2c: keine Seitenfehler', t1.errs.length === 0, t1.errs.slice(0, 3));
  await t1.ctx.close();

  // ---- 3) Alter Server: /api/me kennt `rache` nicht ------------------------------------------
  const t3 = await tab(browser, fixture(), { __berichte: berichte() });   // __rache undefined
  const k3 = await karten(t3);
  const r1alt = karteMit(k3, 'von Rivale');
  check('3-vorab: der Knopf steht (attackerId + 24 h reichen, wenn der Server keine Rechteliste liefert)', r1alt.knopf, { knopf: r1alt.knopf });
  await t3.page.evaluate(() => { const b = document.querySelector('#reportsBox [data-rache-knopf="r1"]'); if (b) b.click(); });
  await t3.page.waitForTimeout(1500);
  const vorschauAlt = await t3.page.evaluate(() => { const b = document.getElementById('pendingAttackBox'); return b ? b.textContent : null; });
  check('3a: das Ziel ist markiert, aber die Vorschau VERSPRICHT NICHTS (keine „Vergeltung:"-Zeile ohne Rechteliste vom Server)',
    !!vorschauAlt && /Markiertes Ziel:\s*Rivale/.test(vorschauAlt) && !/Vergeltung:/.test(vorschauAlt), { text: (vorschauAlt || '').slice(0, 200) });
  check('3b: keine Seitenfehler', t3.errs.length === 0, t3.errs.slice(0, 3));
  await t3.ctx.close();

  await browser.close();
  ende();
})().catch(e => { console.error(e); process.exit(1); });
