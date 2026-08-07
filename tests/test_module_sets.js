const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const path = require('path');
const FILE = SPIEL_URL;
const store = {};
function backend(){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'T',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}
(async () => {
  const browser = await starteBrowser();
  let fail=false; const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };
  const ctx=await browser.newContext({viewport:{width:900,height:1300}}); const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  await page.route('**/api/**', backend());
  // Home hat Industriekomplex KOMPLETT (bergbau+werft+lager) und Festung UNVOLLSTÄNDIG (nur panzerung).
  const save = { tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{energie:5000,erz:5000,kristalle:3000,deuterium:2000,antimaterie:100,forschungspunkte:200},
    buildings:{solar:10,mine:10,labor:5}, research:{}, fleet:{jaeger:20,missions:[]}, colonies:{}, activeBasePlanet:'home',
    player:{id:'u',name:'T',allianceTag:'',avatarKey:null}, battleStats:{wins:0,losses:0}, buffs:[], lastTick:Date.now(),
    moduleFragments:0,
    modules:{ 'bergbau:episch':1, 'werft:selten':1, 'lager:selten':1, 'panzerung:episch':1 },
    equippedModules:{ home:['bergbau:episch','werft:selten','lager:selten','panzerung:episch'] },
    moduleSlotLevel:{home:4} };
  store['kepler7-save-v3'] = JSON.stringify(save);
  await page.addInitScript(()=>{ localStorage.setItem('kepler7_token','tok'); });
  await page.goto(FILE); await page.waitForTimeout(1400);
  await page.evaluate(()=>{ ['tutorialOverlay','welcomeNewOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}); const t=document.querySelector('.tab-btn[data-tab="offiziere"]'); if(t) t.click(); });
  await page.waitForTimeout(500);
  const txt = await page.evaluate(()=>{ const b=document.getElementById('moduleBox'); return (b&&b.textContent)||''; });
  check('Industriekomplex aktiv angezeigt', /Set „Industriekomplex" aktiv/.test(txt), txt.match(/Set „Industriekomplex[^\n]{0,60}/)?.[0]);
  check('Industriekomplex zeigt +12% Produktion/Bauzeit/Lager', /\+12% Produktion/.test(txt) && /\+12% Bauzeit/.test(txt) && /\+12% Lager/.test(txt));
  check('Festung als fast-vollständig (Abwehrmodul fehlt)', /Set „Festungs-Doktrin": nur noch Abwehrmodul fehlt/.test(txt), txt.match(/Festungs-Doktrin[^\n]{0,70}/)?.[0]);
  check('Logistik-/Forschungs-Sets NICHT fälschlich aktiv', !/Set „Logistiknetz" aktiv/.test(txt) && !/Set „Forschungszentrum" aktiv/.test(txt));
  // moduleBonusAt-Integration: setBonusAt fließt in die Anzeige ein. Zusätzlich statische PvP-Paritäts-Prüfung:
  // KEIN benanntes Set darf 'raidloss' (server-nachgerechnete PvP-Beute) oder 'atk' (Schiffsklassen-Angriff) tragen.
  const fs = require('fs');
  const src = fs.readFileSync(SPIELDATEI,'utf8');
  // Endanker seit v8.433.0 das Array-Ende selbst (Arbeitsregel 6: der alte Kommentar-Anker
  // "// Welche benannten Sets" fiel mit activeSetsAt weg, und der Slice lief bis fast ans
  // Dateiende - die atk-Pruefung schlug auf fremdem Code an, "Block gefunden" blieb vacuous gruen).
  const defsStart = src.indexOf('const MODULE_SET_DEFS = [');
  const defsEnde = src.indexOf('\n  ];', defsStart);
  const defsBlock = (defsStart >= 0 && defsEnde > defsStart) ? src.slice(defsStart, defsEnde + 5) : '';
  check('MODULE_SET_DEFS-Block gefunden (mit existierendem Endanker)', defsBlock.length > 100 && defsBlock.length < 20000, defsBlock.length);
  check('kein Set berührt raidloss (PvP-Parität)', !/raidloss\s*:/.test(defsBlock));
  check('kein Set berührt atk (PvP-Parität)', !/\batk\s*:/.test(defsBlock));
  check('moduleBonusAt integriert setBonusAt additiv', /moduleSetMult\(planetKey\)\s*\+\s*setBonusAt\(planetKey,\s*effect\)/.test(src));
  check('keine JS-Fehler', errs.length===0, errs.slice(0,3));
  await ctx.close(); await browser.close();
  console.log(fail?'\nFAIL':'\nPASS'); process.exit(fail?1:0);
})();
