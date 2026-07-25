const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const path=require('path');
const FILE='file://'+path.resolve(SPIELDATEI);
function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}
(async()=>{
const b=await starteBrowser();
let fail=false; const check=(n,c,x)=>{console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):''));fail=fail||!c;};
const store={}; const errs=[];
store['kepler7-save-v3']=JSON.stringify({tutorialSeen:true,newbieWelcomeSeen:true,
 resources:{energie:48000,erz:52000,kristalle:31000,deuterium:20000,antimaterie:900,forschungspunkte:2200},
 buildings:{solar:18,mine:17,labor:10,werft:9,hangar:6,lager:10},research:{rsolar:8,rkampf:6},
 fleet:{jaeger:320,waechter:40,missions:[]},colonies:{},activeBasePlanet:'home',
 player:{id:'u',name:'A',allianceTag:'',avatarKey:null},battleStats:{wins:0,losses:0},xp:52000,buffs:[],lastTick:Date.now(),colonyNames:{},colonyNotes:{}});
const ctx=await b.newContext({viewport:{width:900,height:1200}}); const page=await ctx.newPage();
page.on('pageerror',e=>errs.push(String(e)));
await page.route('**/api/**',backend(store));
await page.addInitScript(()=>{localStorage.setItem('kepler7_token','tok');});
await page.goto(FILE); await page.waitForTimeout(1900);
await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay'].forEach(i=>{const o=document.getElementById(i);if(o)o.style.display='none';});
 const t=document.querySelector('.tab-btn[data-tab="flotte"]'); if(t)t.click();});
await page.waitForTimeout(900);
const r=await page.evaluate(()=>{
  const cards=[...document.querySelectorAll('.card-row.ship-card')];
  const first=cards[0];
  const bars=first?[...first.querySelectorAll('.sstat')].map(s=>({k:s.querySelector('.k').textContent,
     w:s.querySelector('.tr i').style.width, v:s.querySelector('.v').textContent})):[];
  const canv=first?first.querySelector('canvas[data-ship-icon]'):null;
  // Ist auf das Canvas wirklich gezeichnet worden (nicht nur leer)?
  let painted=false;
  if(canv){ try{ const d=canv.getContext('2d').getImageData(0,0,canv.width,canv.height).data;
     for(let i=3;i<d.length;i+=4){ if(d[i]>8){painted=true;break;} } }catch(e){} }
  const locked=[...document.querySelectorAll('details.event-locked')];
  return { cardCount:cards.length, bars, roleLabels:cards.slice(0,6).map(c=>(c.querySelector('.rolelbl')||{}).textContent),
    canvasW:canv?canv.width:0, painted, lockedCount:locked.length,
    lockedOpenByDefault:locked.filter(d=>d.open).length,
    firstHeight:first?Math.round(first.getBoundingClientRect().height):0,
    lockedHeight:locked[0]?Math.round(locked[0].closest('.card-row').getBoundingClientRect().height):0,
    stripe:first?getComputedStyle(first).getPropertyValue('--ship-role').trim():'' };
});
check('Schiffskarten vorhanden', r.cardCount>=2, {n:r.cardCount});
check('4 Kennwert-Balken je Karte', r.bars.length===4, r.bars.map(b=>b.k));
check('Balken haben Breite + Wert', r.bars.every(b=>/%$/.test(b.w) && b.v.length>0), r.bars);
check('Balken normiert (nicht alle 100%)', r.bars.some(b=>parseFloat(b.w)<100), r.bars.map(b=>b.w));
check('Rollen-Streifen gesetzt', /^#|rgb/.test(r.stripe), r.stripe);
check('Rollen-Kuerzel gerendert', r.roleLabels.filter(Boolean).length>=2, r.roleLabels);
check('Canvas auf 78px vergroessert', r.canvasW===78, r.canvasW);
check('Schiff wurde tatsaechlich gezeichnet', r.painted===true);
check('Gesperrte Event-Schiffe aufklappbar', r.lockedCount>=3, {n:r.lockedCount});
check('...standardmaessig eingeklappt', r.lockedOpenByDefault===0, r.lockedOpenByDefault);
check('...kompakter als eine Schiffskarte', r.lockedHeight>0 && r.lockedHeight < r.firstHeight, {locked:r.lockedHeight,ship:r.firstHeight});
// Aufklappen muss den vollen Text zeigen
const open=await page.evaluate(()=>{ const d=document.querySelector('details.event-locked');
  const before=d.textContent.length; d.querySelector('summary').click();
  return { before, after:d.textContent.length, open:d.open };});
check('Aufklappen zeigt mehr Text', open.open===true && open.after>=open.before, open);
// Freischalt-Knopf muss AUSSERHALB des details liegen (immer sichtbar)
const btnOutside=await page.evaluate(()=>{ const c=document.querySelector('details.event-locked').closest('.card-row');
  const btn=c.querySelector('[data-unlock-event]'); return !!btn && !btn.closest('details'); });
check('Zusammenbauen-Knopf immer sichtbar (nicht im Aufklappteil)', btnOutside===true);
check('keine JS-Fehler', errs.length===0, errs.slice(0,3));
await ctx.close(); await b.close();
console.log(fail?'\nFAIL':'\nPASS'); process.exit(fail?1:0);
})();
