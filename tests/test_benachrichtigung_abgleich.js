// Ein Benachrichtigungs-Schalter, der nichts tut, muss sagen warum (05.08.2026).
//
// SPIELER-REPORT Sascha: „die beiden benachrichtigungen lassen sich nicht aktivieren"
// (Allianz-Raid ausgerufen, Allianzbasis). Nachgestellt und gemessen: Beide standen auf Aus, der
// Klick schickte sauber `true` an den Server - und danach standen sie wieder auf Aus.
//
// Die Ursache lag NICHT im Schalter. Die Server-Route baut die Einstellungen bei jedem Speichern
// komplett neu auf; kennt sie eine Kategorie nicht, fehlt sie in der Antwort. Und diese Antwort hat
// den lokalen Stand kommentarlos ersetzt. Das passiert genau dann, wenn das Backend älter ist als
// das Spiel - beide Kategorien kamen am 02.08.2026 dazu.
//
// WAS DIESER TEST FESTHÄLT: nicht, dass der Schalter dann funktioniert (das kann er nicht, der
// Server speichert es ja wirklich nicht), sondern dass das Spiel es SAGT. Ein stiller Rücksprung
// ist stundenlang nicht zuzuordnen, eine benannte Ursache ist in einer Minute behoben.
//
// Die Gegenprobe mit vollständigem Server gehört dazu: Ohne sie wäre der Test auch dann grün, wenn
// die Meldung IMMER käme - und dann wäre sie wertlos.
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const ALLE = ['enabled','messages','pact','weltboss','raid','allianceraid','alliancebase',
              'patchnotes','application','spy','attack','leaderboard','completion'];

// kennt: welche Kategorien der Server überhaupt kennt. Alles andere fällt aus der Antwort heraus -
// exakt das Verhalten der echten Route (sie baut das Objekt Feld für Feld neu auf).
function backend(store, kennt){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  const bauen = (b) => { const o={}; for (const k of kennt) o[k] = b[k] !== false; return o; };
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if(p==='notification-prefs') return j(bauen(req.method()==='POST' ? JSON.parse(req.postData()||'{}') : {}));
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
  buildings:{solar:22,mine:20,labor:14,lager:30,werft:14}, research:{}, fleet:{missions:[]},
  colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null,allianceTag:'TST'},
  xp:9e5, credits:5e5, buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

async function lade(browser, kennt){
  const ctx = await browser.newContext({ viewport:{width:1400,height:1000} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, kennt));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  return { page, ctx, errs };
}
const zustand = (page, cat) => page.evaluate((c) => {
  const el = document.querySelector('[data-notif-cat="'+c+'"]');
  return { an: el ? el.classList.contains('on') : null,
           protokoll: (document.getElementById('log')||{}).textContent || '' };
}, cat);
async function klick(page, cat){
  await page.evaluate((c) => { const el = document.querySelector('[data-notif-cat="'+c+'"]'); if (el) el.click(); }, cat);
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await starteBrowser();

  // ============================== 1) Server kennt die zwei Kategorien NICHT
  {
    const alt = ALLE.filter(k => k !== 'allianceraid' && k !== 'alliancebase');
    const { page, ctx, errs } = await lade(browser, alt);
    const vor = await zustand(page, 'allianceraid');
    check('1: der unbekannte Schalter steht auf Aus (so war der Report)', vor.an === false, { an: vor.an });
    await klick(page, 'allianceraid');
    const nach = await zustand(page, 'allianceraid');
    check('1: er springt auch nach dem Klick zurueck - der Server speichert es wirklich nicht', nach.an === false, { an: nach.an });
    check('1: ABER das Spiel sagt jetzt, woran es liegt',
      /Server kennt diese Benachrichtigungs-Einstellung noch nicht/.test(nach.protokoll), nach.protokoll.slice(0,160));
    check('1: und nennt die betroffene Kategorie beim Namen',
      /allianceraid/.test(nach.protokoll), nach.protokoll.slice(0,160));
    check('keine JS-Fehler (alter Server)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 2) GEGENPROBE: vollstaendiger Server
  // Ohne diesen Abschnitt waere der Test auch dann gruen, wenn die Meldung bei JEDEM Klick kaeme.
  {
    const { page, ctx, errs } = await lade(browser, ALLE);
    const vor = await zustand(page, 'allianceraid');
    check('2: bei vollstaendigem Server steht der Schalter auf An', vor.an === true, { an: vor.an });
    await klick(page, 'allianceraid');
    const aus = await zustand(page, 'allianceraid');
    check('2: der Klick schaltet ihn wirklich aus', aus.an === false, { an: aus.an });
    check('2: und es kommt KEINE Warnung', !/Server kennt diese Benachrichtigungs-Einstellung/.test(aus.protokoll), aus.protokoll.slice(0,160));
    await klick(page, 'allianceraid');
    const an = await zustand(page, 'allianceraid');
    check('2: und wieder ein', an.an === true, { an: an.an });
    check('keine JS-Fehler (vollstaendiger Server)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
