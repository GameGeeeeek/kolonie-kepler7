// Kleine Sekunden-Schreiber auf Markup-Signatur (v8.467.0, Task #58).
//
// HINTERGRUND: Die MutationObserver-Messung aus v8.460.0 hatte ein Gruppchen kleiner Boxen
// aufgedeckt, die im Sekundentakt komplett neu geschrieben wurden - je fuer sich unauffaellig,
// zusammen gemessene 3,8 bis 11,8 kB Markup je Sekunde und Reiter. Seit v8.467.0 laufen sie
// ueber setBoxHtml (Markup-Signatur), wie die grossen Listen seit v8.310.0.
//
// GEPRUEFT WIRD:
//   1) statisch: keine der vierzehn Boxen schreibt noch per innerHTML= (die Regel, nicht die
//      Momentaufnahme - eine neu hinzugefuegte innerHTML-Zuweisung faellt damit auf)
//   2) im BROWSER gemessen: die Boxen stehen ueber mehrere Ticks still (Marke ueberlebt),
//      und die Bedienung wirkt danach noch - stellvertretend der Taktik-Haltungs-Wechsel,
//      dessen Handler im selben Zweig wie das Schreiben verdrahtet wird.
//   3) Selbstkorrektur: Laeuft ein Countdown (Bau-Warteschlange), MUSS die Box weiter
//      geschrieben werden - eine Markup-Signatur kann nichts einfrieren.
//
// UHR: Das Messfenster friert Date.now ein (Arbeitsregel 18) - sonst misst Abschnitt 2
// Wanduhr-Glueck statt der Regel, sobald irgendwo ein legitimer Countdown laeuft.
//
// GEGENPROBE (Arbeitsregel 1, beidseitig ausgefuehrt): am alten Stand (v8.466.0) fallen 1
// und 2 durch - dort schreibt jede dieser Boxen jede Sekunde neu.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// Die umgebauten Boxen mit dem Variablennamen, unter dem sie im Code geschrieben werden.
const BOXEN = [
  ['stanceBox', 'stanceBox'], ['researchSprintBox', 'researchSprintBox'],
  ['exoticResearchBox', 'exoticResearchBox'], ['veteranTrainingBox', 'veteranTrainingBox'],
  ['combatBonusCapBox', 'combatBonusCapBox'], ['relocateAllBox', 'relocateAllBox'],
  ['battleStatsBox', 'battleStatsBox'], ['prestigeBox', 'prestigeBox'],
  ['qBox', 'buildQueueBox'], ['rqBox', 'researchQueueBox'], ['claimBox', 'kofiClaimSupporterBox']
];

// ---- 1) statisch: kein innerHTML= mehr, dafuer setBoxHtml mit dem richtigen Schluessel
for (const [variable, schluessel] of BOXEN){
  const direkt = new RegExp('(^|[^\\w$])' + variable + '\\.innerHTML\\s*=').test(JS);
  const ueberHelfer = JS.includes('setBoxHtml(' + variable + ", '" + schluessel + "'");
  check('1: ' + schluessel.padEnd(22) + ' laeuft ueber setBoxHtml, nicht ueber innerHTML=',
    !direkt && ueberHelfer, { direkt, ueberHelfer });
}
// Die drei Boxen mit generischer Variable `box` - hier zaehlt der Schluessel im Aufruf.
for (const schluessel of ['eventCalendarBox', 'happyHourBox', 'worldBossBox']){
  check('1: ' + schluessel.padEnd(22) + ' laeuft ueber setBoxHtml',
    JS.includes("setBoxHtml(box, '" + schluessel + "'"));
}

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
const save = (mitBau) => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:48000, erz:52000, kristalle:31000, deuterium:20000, antimaterie:900, forschungspunkte:9000},
  buildings:{solar:18, mine:17, kristallmine:15, deutsynth:12, labor:10, lager:12, werft:9, geschuetz:8},
  research:{rsolar:8, rerz:8, rkampf:6},
  // Laufende Forschung = sekundengenauer Countdown in researchQueueBox. Feldname endTime aus
  // der Spieldatei abgelesen (Regel 4), nicht geraten. Die Restzeit steht dort im Zweig
  // `rq.length ? ... : 'Noch leer'` - bei LEERER Warteschlange gibt es also gar keinen
  // Countdown, und die Box stuende voellig zu Recht still. Der erste Anlauf mass genau das
  // und schlug auf korrektem Code an (dieselbe Familie wie Arbeitsregel 7: nicht messen, was
  // man messen will). Deshalb hier eine echte Warteschlange.
  activeResearch: mitBau ? { key:'rsolar', targetLevel:9, endTime: jetzt + 900000 } : null,
  researchQueue: mitBau ? ['rerz'] : [],
  constructionQueue:[],
  fleet:{jaeger:200, missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u', name:'A', avatarKey:null}, xp:52000, credits:184000, prestige:3, buffs:[],
  battleStats:{wins:42, losses:7}, lastTick:jetzt, colonyNames:{}, modules:{}, shipModules:{},
  // Ereignis-Uhren pinnen (Arbeitsregel 18): der erste Planeten-Ereignis-Check feuert sonst
  // GARANTIERT und schreibt Boxen um, die hier gerade stillstehen sollen.
  nextPlanetEventCheck: jetzt + 3600000, nextTraderCheck: jetzt + 3600000 });

(async () => {
  const browser = await starteBrowser();

  // ---- 2) still ueber mehrere Ticks + Bedienung wirkt danach noch
  {
    const store = { 'kepler7-save-v3': save(false) };
    const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route('**/api/**', backend(store));
    await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
    await page.goto(SPIEL_URL); await page.waitForTimeout(3000);
    await page.evaluate(() => {
      ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => {
        const o = document.getElementById(id); if (o) o.style.display = 'none'; });
      const b = document.querySelector('.tab-btn[data-tab="forschung"]'); if (b) b.click();
    });
    await page.waitForTimeout(1200);
    // Uhr einfrieren, einen Tick verstreichen lassen, DANN markieren (Arbeitsregel 18).
    await page.evaluate(() => { const fest = Date.now(); window.__echt = Date.now; Date.now = () => fest; });
    await page.waitForTimeout(1300);
    const IDS = ['stanceBox','researchSprintBox','exoticResearchBox','veteranTrainingBox',
                 'battleStatsBox','prestigeBox','buildQueueBox','researchQueueBox','eventCalendarBox'];
    const markiert = await page.evaluate(ids => {
      const da = [];
      for (const id of ids){ const el = document.getElementById(id);
        if (el && el.firstElementChild){ el.firstElementChild.__marke = true; da.push(id); } }
      return da;
    }, IDS);
    check('2a: die Boxen sind gerendert und markierbar', markiert.length >= 7, markiert);
    await page.waitForTimeout(3400);
    const stehen = await page.evaluate(ids => ids.filter(id => {
      const el = document.getElementById(id);
      return !!(el && el.firstElementChild && el.firstElementChild.__marke);
    }), markiert);
    check('2b: sie werden ueber mehrere Ticks NICHT neu geschrieben',
      stehen.length === markiert.length, { erwartet: markiert, still: stehen });
    // Bedienung nach uebersprungenen Ticks: die Taktik-Haltung verdrahtet ihre Knoepfe im
    // selben Zweig wie das Schreiben - genau der Fall, den CLAUDE.md pruefen laesst.
    await page.evaluate(() => { if (window.__echt) Date.now = window.__echt; });
    const gewechselt = await page.evaluate(() => {
      const box = document.getElementById('stanceBox');
      const btn = box && box.querySelector('[data-choose-stance]');
      if (!btn) return null;
      const ziel = btn.getAttribute('data-choose-stance');
      btn.click();
      return { ziel, jetzt: window.__stanceTest === undefined ? null : null };
    });
    await page.waitForTimeout(600);
    const stand = await page.evaluate(() => (document.getElementById('stanceBox')||{}).textContent||'');
    check('2c: der Haltungs-Knopf wirkt auch nach uebersprungenen Ticks noch',
      gewechselt && /Aktiv/.test(stand), { geklickt: gewechselt, hatAktiv: /Aktiv/.test(stand) });
    check('2d: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---- 3) Selbstkorrektur: laufender Bau-Countdown MUSS weiter schreiben
  {
    const store = { 'kepler7-save-v3': save(true) };
    const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route('**/api/**', backend(store));
    await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
    await page.goto(SPIEL_URL); await page.waitForTimeout(3000);
    await page.evaluate(() => {
      ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => {
        const o = document.getElementById(id); if (o) o.style.display = 'none'; });
    });
    const text0 = await page.evaluate(() => (document.getElementById('researchQueueBox')||{}).textContent||'');
    await page.evaluate(() => { const el = document.getElementById('researchQueueBox');
      if (el && el.firstElementChild) el.firstElementChild.__marke = true; });
    await page.waitForTimeout(3400);
    const nach = await page.evaluate(() => {
      const el = document.getElementById('researchQueueBox');
      return { marke: !!(el && el.firstElementChild && el.firstElementChild.__marke),
               text: el ? el.textContent : '' };
    });
    check('3a: bei laufendem Forschungs-Countdown wird die Box weiterhin neu geschrieben',
      nach.marke === false, nach.marke);
    check('3b: und ihr Text zaehlt dabei sichtbar herunter', nach.text !== text0 && text0.length > 0);
    check('3c: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  ende();
})().catch(e => { console.error(e); process.exit(1); });
