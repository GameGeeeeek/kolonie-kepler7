'use strict';
const assert=require('node:assert/strict'),fixture=require('./lib/ideas-fixture');
(async()=>{const requests=[];const f=await fixture('welcome:showWelcomeBackModal,action:k7ServerAction,quests:()=>DAILY_QUEST_DEFS,render:render,profile:showPlayerProfile','en',{api:async({path,request,json})=>{
  if(path==='k7/story/start'){requests.push(path);await new Promise(resolve=>setTimeout(resolve,100));await json({story:{stage:0,startedAt:Date.now()}});return true;}return false;
}});try{const p=f.page;
for(const width of [360,390,430,1200]){
await p.setViewportSize({width,height:620});await p.evaluate(()=>{const s=__ideas.state();s.resources.erz=100000;s.resources.kristalle=100000;s.resources.energie=100000;s.buildings.solar=2;s.buildings.dronen=0;s.buildings.robofabrik=0;s.activeBasePlanet='home';__ideas.show('basis');});
const before=await p.evaluate(()=>__ideas.state().buildings.solar);await p.locator('[data-build="solar"]:visible').dblclick();assert.equal(await p.evaluate(()=>__ideas.state().buildings.solar),before+1,'double gesture purchases once '+width);
await p.waitForTimeout(400);await p.locator('[data-build="solar"]:visible').click();assert.equal(await p.evaluate(()=>__ideas.state().buildings.solar),before+2,'deliberate later purchase remains available '+width);
await p.evaluate(()=>__ideas.welcome({minutes:400,gained:{erz:120,kristalle:60},bauten:20,forschungen:10,missionsPending:12,loot:Array.from({length:18},()=>({name:'Erz',count:1})),truemmer:{erz:20}},null));
const card=p.locator('#welcomeBackOverlay > .login-card');assert.equal(await card.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&el.scrollHeight>el.clientHeight;}),true,'long return dialog fits and scrolls '+width);
await p.locator('#welcomeBackDismissBtn').scrollIntoViewIfNeeded();await p.locator('#welcomeBackDismissBtn').click();assert.equal(await p.locator('#welcomeBackOverlay').isVisible(),false,'dialog bottom action reachable '+width);
await p.evaluate(()=>{const s=__ideas.state();s.shopPurchases=1;s.dailyQuests={date:new Date().toDateString(),activeKeys:['shop','research'],startShopPurchases:0,researchCount:0,claimed:{}};__ideas.show('expedition');});
// Nur die ausdruecklich aktive HUD-Oberflaeche hat einklappbare Tagesaufgaben.
if(await p.locator('body').evaluate(el=>el.classList.contains('command-ui'))){
const aufgaben=p.locator('#commandQuests'),aufgabenKopf=p.locator('#commandQuests > summary:visible');
assert.equal(await aufgabenKopf.isVisible(),true,'daily quests summary is visible '+width);
if(!await aufgaben.evaluate(el=>el.open))await aufgabenKopf.click();
assert.equal(await aufgaben.evaluate(el=>el.open),true,'daily quests are open before the real claim '+width);
}
// In der Legacy-Oberflaeche bleibt der originale sichtbare Inline-Claim unveraendert.
const quest=p.locator('[data-claim-quest="shop"]');await quest.scrollIntoViewIfNeeded();assert.equal(await quest.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.height>=44||innerWidth>480?el.contains(hit):false;}),true,'claim target receives touch '+width);
const credits=await p.evaluate(()=>__ideas.state().credits);await quest.focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>__ideas.state().credits),credits+60,'keyboard claim grants the actual reward once '+width);assert.equal(await p.evaluate(()=>__ideas.state().dailyQuests.claimed.shop),true);
await p.evaluate(()=>__ideas.profile({id:'other',name:'Warteschlange',allianceTag:'Jäger',title:'Grundlagen',score:100,lastSeen:Date.now()}));assert.equal(await p.locator('#playerProfileOverlay > .profile-hero-card').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),true,'player dialog fits '+width);await p.locator('#profileCloseBtn').click();
const result=await p.evaluate(async()=>{const before=__ideas.state().credits;const values=await Promise.all([__ideas.action('story/start'),__ideas.action('story/start')]);return {one:values.filter(Boolean).length===1,unchanged:before===__ideas.state().credits};});assert.equal(result.one,true,'server actions reject simultaneous calls '+width);assert.equal(result.unchanged,true);
}
assert.equal(requests.length,4,'one claim request for each deliberate gesture');assert.equal(f.errors.length,0,f.errors.join('\n'));console.log('PASS purchases, deliberate repeat, server claim locking and scrollable return dialog at all four widths');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
