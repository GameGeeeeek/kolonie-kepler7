// Markt-In-Flight-Riegel + Bau-Countdown-Splitboxen (v8.460.0, Task #51 - MutationObserver-
// Mess-Session).
//
// HINTERGRUND (Befund 09.08.2026): (1) renderMarket() ruft bei leerem marketCache
// loadMarketState() auf, und loadMarketState() ruft nach der Antwort renderMarket() - lieferte
// der Server eine 200er-Antwort OHNE market-Feld, riefen die beiden sich UNGEBREMST gegenseitig
// auf: gemessen ~570 Umlaeufe je Sekunde, jeder mit komplettem Neuaufbau von tradeRouteBox und
// marketBox UND einer neuen /market-Anfrage an den Pi. (2) Der Sekunden-Countdown eines
// laufenden Schiffsbaus stand IM Markup von #fleet (148,8 kB, groesste Box des Spiels) - die
// Markup-Signatur konnte waehrend eines Baus nie greifen, die Box wurde sekuendlich komplett
// neu geschrieben. Seit v8.460.0 wohnen Countdown+Leerlaufkarte in der kleinen fleetJobs-Box
// (Vorbild buildQueueBox), analog defenseJobs fuer die Verteidigungs-Kacheln.
//
// KALENDER-EVENT-FALLSTRICK (Regel aus der v8.458-Nacht): Waehrend eines aktiven Kalender-
// Events tickt in #fleet ein LEGITIMER sekundengenauer Countdown (Event-Schiff-Karten) - die
// "#fleet steht still"-Pruefung wuerde an Event-Tagen faelschlich rot. Der Test rechnet das
// Event-Fenster deshalb aus den Konstanten der Spieldatei selbst nach (EVENT_EPOCH,
// EVENT_ACTIVE_DAYS, EVENT_PAUSE_DAYS - abgelesen, nicht geraten) und ueberspringt NUR diese
// eine Pruefung im Fenster; Marktriegel- und Countdown-lebt-Pruefungen laufen immer.
//
// GEGENPROBE (Regel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten Stand
// (v8.459.0) fallen 1a-1e statisch durch, 2a misst die Anfragenflut (>>20 in 6 s) und 3b das
// sekuendliche Neuschreiben von #fleet.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const MARKUP = HTML.slice(0, HTML.indexOf('<script>'));

// ---- statisch: Riegel und Splitboxen existieren an den richtigen Stellen
// Regel statt Momentaufnahme (Hausregel 3): gefordert ist setzen, pruefen, IM FINALLY loesen -
// was der catch nebenbei tut (seit v8.538.0 vermerkt er den Netzfehler fuer die Regel-35-
// Anzeige), ist nicht Teil dieser Regel und darf sich formen.
check('1a: loadMarketState hat den In-Flight-Riegel (setzen, pruefen, im finally loesen)',
  JS.includes('if (!useBackend() || marketLoadLaeuft) return;') &&
  JS.includes('marketLoadLaeuft = true;') &&
  JS.includes('finally { marketLoadLaeuft = false; }'));
check('1b: loadModuleMarket hat denselben Riegel',
  JS.includes('if (!useBackend() || moduleMarketLoadLaeuft) return;') &&
  JS.includes('finally { moduleMarketLoadLaeuft = false; }'));
check('1c: fleetJobs- und defenseJobs-Box stehen im HTML-Markup (nicht nur im JS)',
  MARKUP.includes('<div id="fleetJobs"></div>') && MARKUP.includes('<div id="defenseJobs"></div>'));
check('1d: der Tick schreibt Leerlaufkarte+Bauauftraege nach fleetJobs, und #fleet ohne sie',
  JS.includes("setBoxHtml(document.getElementById('fleetJobs'), 'fleetJobs',") &&
  JS.includes("leerlaufKarte('flotte') + constructionProgressCards(j=>j.kind==='ship'") &&
  JS.includes('shipFilterToggle + shipRows + superBlock)'));
// 1e prueft die REGEL statt der alten Quelltext-Momentaufnahme (Hausregel 3/9, Umbau bei
// Etappe S-4): Die defenseBuildings-Schreibstelle darf sich formen (Filter-Chip davor), solange
// sie weiter die Gebaeudekacheln rendert und KEINE Bauauftrags-Karten enthaelt - die stehen in
// der eigenen defenseJobs-Box. Anker-Existenz zuerst (Hausregel 6: sonst vacuous Slice).
const defWriteStart = JS.indexOf("setBoxHtml(document.getElementById('defenseBuildings'), 'defenseBuildings',");
const defWriteEnd = JS.indexOf('refreshDefenseMiniIcons', defWriteStart);
check('1e-vorab: die defenseBuildings-Schreibstelle und ihr Endanker existieren',
  defWriteStart >= 0 && defWriteEnd > defWriteStart, { defWriteStart, defWriteEnd });
const defWrite = defWriteStart >= 0 && defWriteEnd > defWriteStart ? JS.slice(defWriteStart, defWriteEnd) : '';
check('1e: Verteidigung analog - defenseJobs eigene Box, Kacheln ohne Bauauftraege',
  JS.includes("setBoxHtml(document.getElementById('defenseJobs'), 'defenseJobs',") &&
  defWrite.includes(".map(buildingRowHtml).join('')") &&
  !defWrite.includes('constructionProgressCards'));

// ---- Kalender-Event-Fenster aus der Spieldatei ablesen (Regel 4: nie raten)
const aktiveTage = Number(JS.match(/const EVENT_ACTIVE_DAYS = (\d+)/)[1]);
const pauseTage = Number(JS.match(/const EVENT_PAUSE_DAYS = (\d+)/)[1]);
const em = JS.match(/const EVENT_EPOCH = Date\.UTC\((\d+), (\d+), (\d+)\)/);
const slotMs = (aktiveTage + pauseTage) * 86400000;
const withinSlot = ((Date.now() - Date.UTC(+em[1], +em[2], +em[3])) % slotMs + slotMs) % slotMs;
// aktiv ODER beginnt innerhalb der naechsten 15 Minuten (Testdauer + Puffer)
const eventFenster = withinSlot < aktiveTage*86400000 || (slotMs - withinSlot) < 15*60000;

// Fixture wie der Messlauf: laufender Schiffsbau (der Countdown ist das Messobjekt), grosse
// Bestaende (keine Kann-ich-mir-leisten-Farbwechsel im Messfenster), Ereignis-Uhren gepinnt
// (der erste Planeten-Ereignis-Check feuert sonst GARANTIERT und schreibt Boxen um).
const jetzt = Date.now();
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:48000, erz:52000, kristalle:31000, deuterium:20000, antimaterie:900, forschungspunkte:2200},
  buildings:{solar:18, mine:17, kristallmine:15, deutsynth:12, labor:10, lager:12, werft:9, hangar:6, habitat:8, geschuetz:8, schild:6},
  research:{rsolar:8, rerz:8, rkampf:6},
  constructionQueue:[{kind:'ship', key:'jaeger', planet:'home', qty:5, label:'Jäger', icon:'ti-rocket',
    cost:{erz:500, energie:300}, totalDur:600, paid:true, startTime:jetzt, endTime:jetzt+600000}],
  fleet:{jaeger:320, bomber:90, zerstoerer:45, missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u', name:'A', avatarKey:null}, xp:52000, credits:184000, buffs:[], lastTick:jetzt,
  colonyNames:{}, modules:{}, shipModules:{},
  nextPlanetEventCheck: jetzt + 3600000, nextTraderCheck: jetzt + 3600000 });

// Backend-Stub: /market antwortet 200 MIT LEEREM JSON-OBJEKT - exakt die Antwortform, die die
// Rekursion zuendete (ok, aber kein market-Feld). Jede Anfrage wird gezaehlt.
function backend(store, zaehler){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s2=200) => r.fulfill({status:s2, contentType:'application/json', body:JSON.stringify(o)});
  if (p === 'market'){ zaehler.market++; return j({}); }
  if (p === 'modulemarket') return j({listings:[], limits:{}});
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

(async () => {
  const browser = await starteBrowser();
  const store = { 'kepler7-save-v3': save() };
  const zaehler = { market: 0 };
  const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store, zaehler));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3000);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => {
      const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });

  // ---- 2: Markt-Tab oeffnen, Anfragen zaehlen. Seit v8.538.0 gilt: der Lade-Zweig darf nur
  // noch alle COOLDOWN_MS einen Versuch anstossen (Cooldown in loadMarketState, aus der
  // Spieldatei ABGELESEN statt eingetippt - Regel 2: sonst wird der Test wertlos, sobald
  // jemand den Wert aendert) - bis dahin galt "1x je Sekunde erneut" als gewollt, aber der
  // Vorfall vom 15.08.2026 (Backend hing tagelang hinter dem Frontend, /market lieferte
  // dauerhaft nichts) machte daraus ~86.000 Anfragen je Tag und offenem Markt-Tab gegen den
  // Pi. Gemessen wird die Regel in BEIDE Richtungen: gebremst (keine Flut) UND lebendig (die
  // Selbstheilung stirbt nicht - nach Ablauf des Cooldowns kommt wieder ein Versuch;
  // zusaetzlich deckt der 30s-Timer den Markt-Tab ab).
  const cdm = JS.match(/Date\.now\(\) - marketLetzterVersuch < (\d+)\) return;/);
  check('2-vorab: der Markt-Cooldown steht in der Spieldatei und laesst sich ablesen', !!cdm, { gefunden: !!cdm });
  const COOLDOWN_MS = cdm ? Number(cdm[1]) : 10000;
  const FENSTER_MS = 12000;
  // Obergrenze aus dem Fenster hergeleitet statt eingetippt: hoechstens ceil(Fenster/Cooldown)
  // Versuche passen hinein, plus 1 Toleranz fuer einen Versuch an der Fensterkante.
  const MAX_ANFRAGEN = Math.ceil(FENSTER_MS / COOLDOWN_MS) + 1;
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="markt"]'); if (b) b.click(); });
  await page.waitForTimeout(1000);
  const marktStart = zaehler.market;
  // Beobachter fuer 2c VOR dem Messfenster setzen: im degenerierten Zustand ({}-Antwort) wurden
  // marketBox/tradeRouteBox bis v8.533.0 ZWEIMAL je Sekunde byte-identisch neu geschrieben
  // (Tick-Aufruf + renderMarket-Rueckruf aus der Antwort). 2c misst die WIRKUNG (kein
  // sekuendliches Neuschreiben) - sie entsteht aus setBoxHtml UND dem data.market-Riegel im
  // Rueckruf zusammen; der Riegel allein ist DOM-seitig nicht vom setBoxHtml-Effekt zu
  // unterscheiden (auch ein durchgelassener Rueckruf schriebe die identische Notiz nicht neu)
  // und bleibt bewusst Verteidigung in der Tiefe gegen die halbe CPU-Arbeit je Sekunde.
  await page.evaluate(() => {
    window.__marktSchreiber = { marketBox: 0, tradeRouteBox: 0 };
    for (const id of ['marketBox', 'tradeRouteBox']){
      const el = document.getElementById(id);
      if (el) new MutationObserver(m => { window.__marktSchreiber[id] += m.length; })
        .observe(el, { childList:true, subtree:true, characterData:true });
    }
  });
  await page.waitForTimeout(FENSTER_MS);
  const marktAnfragen = zaehler.market - marktStart;
  check('2a: /market bei ok-Antwort ohne market-Feld: gebremst auf den Cooldown, aber die Selbstheilung lebt',
    marktAnfragen >= 1 && marktAnfragen <= MAX_ANFRAGEN, { anfragenImFenster: marktAnfragen, cooldownMs: COOLDOWN_MS, maxErlaubt: MAX_ANFRAGEN });
  // Seit v8.538.0 hat die Flaeche einen DRITTEN Zustand (Regel 35): Nach einem Versuch, der
  // keine Marktdaten brachte, steht der GRUND da statt eines ewigen "wird geladen…" - genau
  // die tote Flaeche vom 15.08.2026. Der Mock liefert 200 mit leerem Objekt, also muss hier
  // die "keine Marktdaten"-Ansage stehen, mit dem Versprechen, dass es von selbst weitergeht.
  const marktNote = await page.evaluate(() => (document.getElementById('marketBox')||{}).textContent || '');
  check('2b: die Markt-Box BENENNT den Zustand (Server liefert keine Marktdaten, es geht von selbst weiter)',
    marktNote.includes('keine Marktdaten') && marktNote.includes('automatisch'), { text: marktNote.slice(0, 90) });
  const marktSchreiber = await page.evaluate(() => window.__marktSchreiber);
  check('2c: marketBox und tradeRouteBox stehen im degenerierten Zustand still (kein sekuendliches Neuschreiben mehr)',
    marktSchreiber.marketBox <= 2 && marktSchreiber.tradeRouteBox <= 2, marktSchreiber);

  // ---- 3: Waehrend der Schiffsbau laeuft, tickt der Countdown in fleetJobs - #fleet steht.
  // Der Haupt-Tick schreibt die Flotten-Boxen nur bei aktivem Flotten-Reiter (erster Anlauf
  // dieses Tests mass vom Markt-Tab aus 0 Schreibvorgaenge und 0 Text - Regel 4: Verhalten
  // ablesen, nicht raten) - also erst dorthin wechseln, dann beobachten.
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="flotte"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__schreiber = { fleet: 0, fleetJobs: 0 };
    for (const id of ['fleet', 'fleetJobs']){
      const el = document.getElementById(id);
      if (el) new MutationObserver(m => { window.__schreiber[id] += m.length; })
        .observe(el, { childList:true, subtree:true, characterData:true });
    }
  });
  const jobsText0 = await page.evaluate(() => (document.getElementById('fleetJobs')||{}).textContent || '');
  await page.waitForTimeout(5000);
  const jobsText1 = await page.evaluate(() => (document.getElementById('fleetJobs')||{}).textContent || '');
  const schreiber = await page.evaluate(() => window.__schreiber);
  check('3a: der Bau-Countdown lebt in fleetJobs (Text aendert sich, Box wird geschrieben)',
    jobsText0.length > 0 && jobsText1 !== jobsText0 && schreiber.fleetJobs >= 3,
    { schreibvorgaenge: schreiber.fleetJobs, text: jobsText1.slice(0, 50) });
  if (eventFenster){
    console.log('  (3b uebersprungen: Kalender-Event aktiv oder unmittelbar bevorstehend - '
      + 'in #fleet tickt dann ein legitimer Event-Countdown, die Still-Pruefung wuerde '
      + 'faelschlich anschlagen. Slot-Position ' + Math.round(withinSlot/3600000) + ' h.)');
  } else {
    check('3b: #fleet steht dabei still (der Countdown zwingt die grosse Liste nicht mehr zum Neuaufbau)',
      schreiber.fleet <= 2, { schreibvorgaenge: schreiber.fleet });
  }

  check('4: keine JS-Fehler', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  ende();
})().catch(e => { console.error(e); process.exit(1); });
