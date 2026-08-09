// Chat-Panel folgt dem sichtbaren Bereich, wenn die Tastatur aufgeht (v8.469.0).
//
// HINTERGRUND (Report 09.08.2026, Screenshot vom iPhone): Beim Tippen rutschte das Chat-Fenster in
// die obere linke Ecke - sichtbar blieb nur ein Streifen mit der letzten Nachricht und der
// Eingabezeile, quer ueber der iOS-Statusleiste. Seit dem 13.07.2026 passte das Panel zwar seine
// HOEHE an `visualViewport.height` an, nicht aber seine POSITION. position:fixed haengt am
// LAYOUT-Viewport; iOS scrollt genau dieses Layout nach oben, um das fokussierte Feld freizuhalten
// (`visualViewport.offsetTop` > 0), und das Panel wanderte um denselben Betrag mit hinaus.
//
// WARUM GESTELLTE API: Chromium hat keine Bildschirmtastatur, `visualViewport` laesst sich nicht
// echt verkleinern. Der Test setzt deshalb VOR dem Laden der Seite ein eigenes visualViewport-
// Objekt ein und bewegt es selbst - gemessen wird damit nicht "iOS verhaelt sich so", sondern die
// REGEL: was auch immer die API meldet, das Panel deckt danach genau diesen Bereich. Genau die
// Regel war verletzt.
//
// GEPRUEFT WIRD (im Browser, am echten DOM):
//   1) beim Oeffnen uebernimmt das Panel Hoehe UND Versatz
//   2) faehrt die Tastatur auf (Hoehe kleiner, offsetTop groesser), zieht es mit - der Kern
//   3) die Abdunkel-Schicht dahinter zieht mit (sonst geht ein Tipper am Rand ins Spiel durch)
//   4) nach dem Fokus ins Eingabefeld fasst es nach, auch ohne weiteres Viewport-Ereignis
//      (iOS meldet den Versatz verzoegert)
//   5) beim Schliessen bleiben keine Inline-Werte stehen
//
// GEGENPROBE (Arbeitsregel 1, beidseitig ausgefuehrt): am alten Stand (v8.468.0) faellt 2 durch -
// dort wird ausschliesslich die Hoehe gesetzt, `style.top` bleibt leer und das Panel steht bei 0.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s2=200) => r.fulfill({status:s2, contentType:'application/json', body:JSON.stringify(o)});
  if (p === 'health') return j({ok:true});
  if (p === 'me') return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if (p === 'reports') return j({reports:[]});
  if (p === 'pending-rewards/claim') return j({reward:null});
  if (p === 'storage-list') return j({keys:[]});
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
  // Ereignis-Uhren pinnen (Arbeitsregel 18) - der erste Planeten-Ereignis-Check feuert sonst
  // garantiert und schiebt Meldungen dazwischen.
  nextPlanetEventCheck: jetzt + 3600000, nextTraderCheck: jetzt + 3600000 });

// Das gestellte visualViewport. Es MUSS vor den Seiten-Skripten stehen: die Verdrahtung des
// Chat-Panels liest window.visualViewport beim Laden und haengt dort ihre Hoerer ein.
const VIEWPORT_STUB = () => {
  const hoerer = {};
  const stub = {
    width: 390, height: 844, offsetTop: 0, offsetLeft: 0, scale: 1,
    addEventListener: (typ, fn) => { (hoerer[typ] = hoerer[typ] || []).push(fn); },
    removeEventListener: () => {}
  };
  window.__vv = {
    setze: (werte) => Object.assign(stub, werte),
    feuere: (typ) => (hoerer[typ] || []).forEach(fn => fn()),
    hoererZahl: () => Object.keys(hoerer).reduce((n, t) => n + hoerer[t].length, 0)
  };
  Object.defineProperty(window, 'visualViewport', { value: stub, configurable: true });
};

const lies = () => {
  const p = document.getElementById('chatPanel');
  const o = document.getElementById('chatPanelOverlay');
  const r = p.getBoundingClientRect();
  return {
    offen: p.classList.contains('open'),
    stil: { top: p.style.top, left: p.style.left, hoehe: p.style.height },
    schicht: { top: o.style.top, left: o.style.left, hoehe: o.style.height, breite: o.style.width },
    gemessen: { top: Math.round(r.top), hoehe: Math.round(r.height) }
  };
};

(async () => {
  const browser = await starteBrowser();
  const store = { 'kepler7-save-v3': SAVE };
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(VIEWPORT_STUB);
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3000);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => {
      const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });

  check('0: das gestellte visualViewport wurde benutzt (Hoerer haengen daran)',
    await page.evaluate(() => window.__vv.hoererZahl() > 0), await page.evaluate(() => window.__vv.hoererZahl()));

  // ---- 1) Oeffnen: Hoehe UND Versatz uebernommen
  await page.evaluate(() => document.getElementById('chatEdgeTab').click());
  await page.waitForTimeout(400);
  const auf = await page.evaluate(lies);
  check('1a: das Panel ist offen', auf.offen);
  check('1b: es uebernimmt die Hoehe des sichtbaren Bereichs', auf.stil.hoehe === '844px', auf.stil);
  check('1c: und seinen Versatz (bei geschlossener Tastatur 0)',
    auf.stil.top === '0px' && auf.stil.left === '0px', auf.stil);

  // ---- 2) Tastatur faehrt auf: sichtbarer Bereich kleiner UND nach unten verschoben.
  // Das ist der gemeldete Fehler: bis v8.468.0 blieb top leer, das Panel stand bei 0 und lag
  // damit 300px ueber dem sichtbaren Bereich - zu sehen war nur sein unteres Ende.
  await page.evaluate(() => { window.__vv.setze({ height: 380, offsetTop: 300 }); window.__vv.feuere('resize'); window.__vv.feuere('scroll'); });
  await page.waitForTimeout(200);
  const tastatur = await page.evaluate(lies);
  check('2a: das Panel folgt dem Versatz nach unten (der eigentliche Fehler)',
    tastatur.stil.top === '300px', tastatur.stil);
  check('2b: und schrumpft auf die verbliebene Hoehe', tastatur.stil.hoehe === '380px', tastatur.stil);
  check('2c: gemessen deckt es damit genau den sichtbaren Bereich',
    tastatur.gemessen.top === 300 && tastatur.gemessen.hoehe === 380, tastatur.gemessen);

  // ---- 3) Die Abdunkel-Schicht zieht mit
  check('3: die Abdunkel-Schicht dahinter deckt denselben Bereich',
    tastatur.schicht.top === '300px' && tastatur.schicht.hoehe === '380px' && tastatur.schicht.breite === '390px',
    tastatur.schicht);

  // ---- 4) Nachfassen nach dem Fokus, OHNE weiteres Viewport-Ereignis.
  // iOS meldet den Versatz teils erst nach dem Fokus; ohne Nachlauf stuende das Panel bis zum
  // naechsten Ereignis falsch. Hier wird bewusst NUR fokussiert und nichts gefeuert.
  await page.evaluate(() => {
    window.__vv.setze({ height: 340, offsetTop: 420 });
    document.getElementById('chatPanelAllianceInput').focus();
  });
  await page.waitForTimeout(700);
  const nachFokus = await page.evaluate(lies);
  check('4: nach dem Fokus ins Eingabefeld fasst es von selbst nach',
    nachFokus.stil.top === '420px' && nachFokus.stil.hoehe === '340px', nachFokus.stil);

  // ---- 5) Schliessen raeumt alle Inline-Werte weg
  await page.evaluate(() => document.getElementById('chatPanelCloseBtn').click());
  await page.waitForTimeout(300);
  const zu = await page.evaluate(lies);
  check('5a: geschlossen bleibt kein Inline-Wert am Panel stehen',
    !zu.offen && zu.stil.top === '' && zu.stil.left === '' && zu.stil.hoehe === '', zu.stil);
  check('5b: und keiner an der Abdunkel-Schicht',
    zu.schicht.top === '' && zu.schicht.hoehe === '' && zu.schicht.breite === '', zu.schicht);

  check('6: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
  await ctx.close();
  await browser.close();
  ende();
})().catch(e => { console.error(e); process.exit(1); });
