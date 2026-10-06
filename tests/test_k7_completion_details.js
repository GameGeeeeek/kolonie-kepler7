'use strict';
const assert=require('node:assert/strict'),fixture=require('./lib/ideas-fixture');
(async()=>{const progress={encounters:[{id:'no-loot',choice:'return',resolvedAt:Date.now(),status:'resolved',result:{resources:{},automatic:false}},{id:'safe',choice:'salvage',resolvedAt:Date.now(),status:'resolved',result:{resources:{erz:120,kristalle:60},automatic:true}}]};
const f=await fixture('preview:k7BlueprintPreview,buildings:()=>BUILDING_DEFS,goals:k7PersonalGoals,archive:renderK7Archive,profile:renderCommanderProfile,trophy:k7SetTrophy,returnHtml:k7ReturnEncounters,refresh:k7RefreshProgress,report:k7EncounterReportHtml','en',{api:async({path,json})=>{if(path==='k7/progress'){await json(progress);return true;}return false;}});
try{const p=f.page;await p.evaluate(()=>__ideas.refresh(true));
// Measure the synchronous display helpers after loading, so a normal production tick is not
// mistaken for a resource change caused by the display itself.
const result=await p.evaluate(()=>{
const t=__ideas,s=t.state(),stock=JSON.stringify(s.resources),moon=t.buildings().find(d=>d.moonOnly);s.research=Object.fromEntries((moon.requires||[]).map(key=>[typeof key==='string'?key:key.key,100]));
const row=t.preview({steps:[{key:moon.key,level:1}]},'home')[0];
const html=t.returnHtml({since:Date.now()-60000});const old=t.returnHtml({since:Date.now()+10000});
s.achievements={firstbuild:true};t.goals().trophies=['allbosses','firstbuild',''];t.profile();const denied=!t.trophy(0,'allbosses');
t.goals().archive={zenith:true,'kartell:100':true};s.discoveredSystems={};t.archive();
return {moon:row.moonBlocked&&!row.unlocked,foreign:t.preview({steps:[{key:'mine',level:1}]},'__proto__').length===0,decision:html.includes('Return')&&html.includes('No additional loot')&&html.includes('Automatic safe salvage')&&html.includes('120'),old:old==='',readonly:stock===JSON.stringify(s.resources),denied};
});for(const [name,ok]of Object.entries(result))assert.equal(ok,true,name);
assert.equal(await p.locator('#commanderProfileBox [aria-label="Trophy hall"] .k7-item').count(),3,'three trophy places appear on the real commander profile');assert.equal(await p.locator('#commanderProfileBox [aria-label="Trophy hall"] strong').count(),1,'profile rejects unearned saved trophy');
assert.match(await p.locator('#k7Archive').textContent(),/Origin.*Discovery condition/s,'archive shows actual origin and discovery condition');
assert.equal(f.errors.length,0,f.errors.join('\n'));console.log('PASS moon/ownership blueprint gates, authoritative return decisions, discovery conditions and earned profile trophies');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
