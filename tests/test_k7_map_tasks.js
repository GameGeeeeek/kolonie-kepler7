'use strict';
const assert=require('node:assert/strict'),fixture=require('./lib/ideas-fixture');
(async()=>{const f=await fixture('tasks:k7MapTasks,jump:k7MapTaskJump,systems:()=>STAR_SYSTEMS,planets:()=>PLANETS,cache:()=>galaxyCache,render:renderK7MapTasks,save:sicherSpeichern,active:()=>activeSystem','en');
try{const p=f.page;const result=await p.evaluate(()=>{
  const t=__ideas,s=t.state(),hidden=t.systems().find(x=>x.hidden),known=t.systems().find(x=>!x.hidden&&x.id!=='kepler');
  s.discoveredSystems={};s.player.allianceTag='probe';s.allianceBase={foundedAt:1,sector:known.id};
  t.cache().alienNester=[{id:'known',sys:known.id,lp:100},{id:'secret',sys:hidden.id,lp:100},{id:'expired',sys:known.id,lp:100,expiresAt:1}];
  const planet=t.planets().find(x=>x.system===known.id);s.fleet.missions=[{id:'travelling',type:'explore',targetId:planet.id,endTime:Date.now()+3600000},{id:'private',type:'attack-player',targetId:'enemy',endTime:Date.now()+3600000},{id:'done',type:'explore',targetId:planet.id,endTime:1}];
  const loot=t.tasks('loot'),missions=t.tasks('missions');
  const checked={hidden:!loot.some(r=>r.id.includes('secret')),expired:!loot.some(r=>r.id.includes('expired')),own:t.tasks('colonies').every(r=>r.kind==='colony'),alliance:t.tasks('alliance').length===1,missions:missions.length===2&&missions.find(r=>r.key.endsWith(':private')).system===null,unknown:t.tasks('__proto__').length===0};
  const stale=loot[0].key;t.cache().alienNester=[];checked.stale=t.jump(stale)===false;
  s.allianceBase.sector=hidden.id;checked.hiddenAlliance=t.tasks('alliance').length===0;
  s.player.allianceTag='';s.allianceBase.sector=known.id;checked.membership=t.tasks('alliance').length===0;
  checked.jump=t.jump(missions.find(r=>r.system).key)&&t.active()===known.id;
  t.show('karte');document.querySelector('#k7MapTasks details').open=true;return checked;
});for(const [key,ok]of Object.entries(result))assert.equal(ok,true,key);
await p.locator('#k7MapTaskFilter').selectOption('missions');
await p.evaluate(()=>{__ideas.show('basis');__ideas.show('karte');});assert.equal(await p.locator('#k7MapTaskFilter').inputValue(),'missions','filter persists between views');
for(const width of [360,390,430,1200]){await p.setViewportSize({width,height:900});assert.equal(await p.locator('#k7MapTasks').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'task controls fit '+width);}
await p.evaluate(()=>__ideas.save());await p.reload();await p.waitForFunction(()=>window.__ideas&&__ideas.ready());assert.equal(await p.evaluate(()=>__ideas.state().personalGoals.mapTaskFilter),'missions','filter survives login reload');
assert.equal(f.errors.length,0,f.errors.join('\n'));console.log('PASS four map filters, protected positions, stale targets, real jumps and persistence');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
