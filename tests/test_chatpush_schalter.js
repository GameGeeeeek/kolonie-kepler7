// Chat-Push: Schalter, Postfach-Zeile und Sprung ins Chat-Fenster (v8.472.0, Task #60).
//
// HINTERGRUND: Das Backend meldet seit PR #88 die Kategorie 'chat'. Im Frontend braucht das DREI
// Stellen, und jede fehlende ergibt einen eigenen Fehlerbericht:
//   - notifPrefsCache ohne 'chat' -> der Schalter steht beim Laden auf "aus", obwohl der Server
//     "an" meldet (genau dieser Fehler war am 02.08.2026 ein Spielerbericht, damals fuer
//     allianceraid/alliancebase);
//   - kein Schalter -> die Kategorie ist nicht abschaltbar, was der halbe Wunsch war;
//   - kein NOTIF_EVENT_INFO-Eintrag -> das Postfach zeigt eine LEERE Zeile.
// Dazu der Sprung: Der Chat ist kein Reiter, sondern ein Einschub-Fenster - ohne Sonderfall in
// geheZuZiel passiert beim Antippen der Meldung still gar nichts.
//
// GEPRUEFT WIRD IM BROWSER, nicht am Markup:
//   1) der Schalter ist da, steht auf AN und schickt beim Umlegen chat:false an den Server
//      (die gesendete Nutzlast wird abgefangen und gelesen - "der Knopf existiert" wuerde auch
//      bestehen, wenn er nichts ausloest)
//   2) er steht nach einem Neuladen NICHT wieder auf AN, wenn der Server false meldet
//   3) eine Chat-Meldung im Postfach zeigt echten Text (nicht leer) und ist anklickbar
//   4) der Klick oeffnet das Chat-Fenster im GLOBALEN Kanal
//
// GEGENPROBE (Arbeitsregel 1, beidseitig ausgefuehrt): am alten Stand (v8.471.0) fallen 1, 3 und 4
// durch - es gibt weder Schalter noch Postfach-Text noch den Sprung.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// Statisch: der Vorgabe-Zwischenspeicher MUSS den Schluessel kennen. Das ist keine Doppelung zu
// Pruefung 2 - dort meldet der Server false; hier geht es um den Fall, dass er gar nichts sagt.
check('0: notifPrefsCache kennt die Kategorie chat', /notifPrefsCache = \{[^}]*chat:true/.test(JS));

const PREFS = { enabled:true, messages:true, pact:true, weltboss:true, raid:true, allianceraid:true,
                alliancebase:true, chat:true, patchnotes:true, application:true, spy:true,
                attack:true, leaderboard:true, completion:true };

function backend(store, zustand){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s2=200) => r.fulfill({status:s2, contentType:'application/json', body:JSON.stringify(o)});
  if (p === 'health') return j({ok:true});
  if (p === 'me') return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if (p === 'reports') return j({reports:[]});
  if (p === 'pending-rewards/claim') return j({reward:null});
  if (p === 'storage-list') return j({keys:[]});
  if (p === 'notification-prefs'){
    if (req.method() === 'POST'){
      try { zustand.gesendet.push(JSON.parse(req.postData())); } catch(e){}
      return j(Object.assign({}, zustand.prefs));
    }
    return j(Object.assign({}, zustand.prefs));
  }
  if (p === 'notifications') return j({ notifications: zustand.postfach });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()).value; } catch(e){} return j({ok:true,version:2}); }
    if (store[k] !== undefined) return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}

const jetzt = Date.now();
const SAVE = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9000, erz:9000, kristalle:5000, deuterium:2000, forschungspunkte:500},
  buildings:{solar:8, mine:8, lager:6, werft:4}, research:{}, constructionQueue:[],
  fleet:{jaeger:20, missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u', name:'A', avatarKey:null}, xp:1000, credits:5000, buffs:[],
  lastTick:jetzt, colonyNames:{}, modules:{}, shipModules:{},
  nextPlanetEventCheck: jetzt + 3600000, nextTraderCheck: jetzt + 3600000 });

const oeffneEinstellungen = () => {
  ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  const b = document.querySelector('.tab-btn[data-tab="einstellungen"]');
  if (b) b.click();
};

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Schalter da, an, und er wirkt
  {
    const zustand = { prefs: Object.assign({}, PREFS), gesendet: [], postfach: [] };
    const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route('**/api/**', backend({ 'kepler7-save-v3': SAVE }, zustand));
    await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
    await page.goto(SPIEL_URL); await page.waitForTimeout(3000);
    await page.evaluate(oeffneEinstellungen);
    await page.waitForTimeout(1200);

    const da = await page.evaluate(() => {
      const el = document.querySelector('[data-notif-cat="chat"]');
      if (!el) return null;
      const zeile = el.closest('.card-row');
      // NICHT kuerzen: Der erste Anlauf schnitt bei 80 Zeichen ab und suchte danach nach einem
      // Wort, das genau dahinter stand - der Test fiel auf korrektem Code durch.
      return { an: el.classList.contains('on') || el.classList.contains('active'),
               klassen: el.className,
               text: zeile ? zeile.textContent.trim() : '' };
    });
    check('1a: der Schalter "Globaler Chat" ist in den Einstellungen da', !!da, da);
    check('1b: er ist beschriftet und erklaert die Drosselung',
      !!da && /Globaler Chat/.test(da.text) && /halbe Stunde/.test(da.text), da && da.text);

    // Mit Waechter: Fehlt der Schalter (alter Stand), soll 1c als FEHLGESCHLAGEN dastehen und der
    // Test weiterlaufen - sonst bricht die Gegenprobe hier ab und belegt die restlichen Luecken
    // gar nicht mehr. Genau das passierte im ersten Anlauf.
    await page.evaluate(() => { const el = document.querySelector('[data-notif-cat="chat"]'); if (el) el.click(); });
    await page.waitForTimeout(800);
    check('1c: das Umlegen schickt chat:false an den Server (der Knopf tut wirklich etwas)',
      zustand.gesendet.length > 0 && zustand.gesendet[zustand.gesendet.length-1].chat === false,
      zustand.gesendet[zustand.gesendet.length-1]);
    check('1d: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---- 2) Meldet der Server false, steht der Schalter nach dem Laden auf AUS
  {
    const zustand = { prefs: Object.assign({}, PREFS, { chat:false }), gesendet: [], postfach: [] };
    const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
    const page = await ctx.newPage();
    await page.route('**/api/**', backend({ 'kepler7-save-v3': SAVE }, zustand));
    await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
    await page.goto(SPIEL_URL); await page.waitForTimeout(3000);
    await page.evaluate(oeffneEinstellungen);
    await page.waitForTimeout(1200);
    const aus = await page.evaluate(() => {
      const el = document.querySelector('[data-notif-cat="chat"]');
      const ein = document.querySelector('[data-notif-cat="attack"]');
      return { chat: el ? el.className : null, vergleich: ein ? ein.className : null };
    });
    // Gegen eine EINGESCHALTETE Kategorie derselben Liste verglichen statt gegen einen geratenen
    // Klassennamen (Arbeitsregel 4): Der Unterschied muss sichtbar sein, wie er auch immer heisst.
    check('2: bei chat:false steht der Schalter anders als ein eingeschalteter derselben Liste',
      aus.chat !== null && aus.chat !== aus.vergleich, aus);
    await ctx.close();
  }

  // ---- 3)+4) Postfach-Zeile mit echtem Text, Klick oeffnet den Chat
  {
    const zustand = { prefs: Object.assign({}, PREFS), gesendet: [], postfach: [
      { id:'n1', type:'chat', time: Date.now()-60000, payload:{ authorName:'Bert' }, ziel:'chat:global' }
    ]};
    const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route('**/api/**', backend({ 'kepler7-save-v3': SAVE }, zustand));
    await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
    await page.goto(SPIEL_URL); await page.waitForTimeout(3500);
    await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));

    const zeile = await page.evaluate(() => {
      const el = document.querySelector('[data-notif-go="chat:global"]');
      return el ? { text: el.textContent.trim(), klickbar: el.getAttribute('role') === 'button' } : null;
    });
    check('3a: die Chat-Meldung erscheint im Postfach und ist anklickbar',
      !!zeile && zeile.klickbar, zeile);
    check('3b: sie zeigt echten Text (kein leerer Eintrag) und nennt den Verfasser',
      !!zeile && zeile.text.length > 20 && /Bert/.test(zeile.text), zeile && zeile.text);
    // Der Text darf NICHT die Nachricht selbst enthalten - die schickt der Server bewusst nicht mit.
    check('3c: der Nachrichtentext selbst steht nicht darin (Server schickt ihn gar nicht)',
      !!zeile && !/hallo|nachricht:/i.test(zeile.text), zeile && zeile.text);

    await page.evaluate(() => { const el = document.querySelector('[data-notif-go="chat:global"]'); if (el) el.click(); });
    await page.waitForTimeout(900);
    const chat = await page.evaluate(() => {
      const panel = document.getElementById('chatPanel');
      const global = document.getElementById('chatPanelTabGlobal');
      const box = document.getElementById('chatPanelGlobalBox');
      return { offen: !!panel && panel.classList.contains('open'),
               globalAktiv: !!global && global.classList.contains('active'),
               boxSichtbar: !!box && box.style.display !== 'none' };
    });
    check('4a: der Klick oeffnet das Chat-Fenster', chat.offen, chat);
    check('4b: und zwar im GLOBALEN Kanal', chat.globalAktiv && chat.boxSichtbar, chat);
    check('4c: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  ende();
})().catch(e => { console.error(e); process.exit(1); });
