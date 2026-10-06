'use strict';
const assert=require('node:assert/strict'),fixture=require('./lib/ideas-fixture');
let checks=0;function check(name,value){assert.ok(value,name);console.log('OK - '+name);checks++;}
(async()=>{
  const f=await fixture('plans:k7Blueprints,savePlan:k7SaveBlueprint,preview:k7BlueprintPreview,queue:k7QueueBlueprintStep,bank:key=>k7TargetBottleneck("research",key),wish:k7SelectWish,ownership:k7SetOwnership,sets:()=>MODULE_SET_DEFS,planets:()=>PLANETS,defaults:applyStateDefaults,trophy:k7SetTrophy,trophies:k7AvailableTrophies,render:renderK7Ideas');
  try{
    check('normal game starts without script errors',f.errors.length===0);
    const result=await f.page.evaluate(()=>{
      const t=__ideas,s=t.state();
      const planet=t.planets().find(p=>p.id!=='home').id;
      s.colonies[planet]={buildings:{solar:1,mine:1},fleet:{missions:[]}};t.defaults();
      const before=JSON.stringify(s.resources),saved=t.savePlan('<img src=x onerror=alert(1)>'),plan=t.plans()[0];
      let p=t.preview(plan,planet);const solar=p.find(r=>r.def.key==='solar');
      const unchanged=JSON.stringify(s.resources)===before;
      const queued=t.queue(plan.id,'solar',planet),again=t.queue(plan.id,'solar',planet);
      const consumed=JSON.stringify(s.resources)===before;
      const unknown=t.queue(plan.id,'unknown',planet),foreign=t.queue(plan.id,'mine','foreign');
      s.research={};s.resources={energie:0,erz:0,kristalle:0,deuterium:0,antimaterie:0,forschungspunkte:0};s.buildings={solar:2,mine:2,lager:3,labor:1};
      const bank=t.bank('rsolar'),wait=bank&&bank.rows.some(r=>r.eta>0&&Number.isFinite(r.eta));
      const bankBefore=JSON.stringify(s);t.bank('rsolar');const readonly=JSON.stringify(s)===bankBefore;
      const set=t.sets().find(x=>x.bossKey);s.modules={};s.equippedModules={home:[set.req[0]+':selten:1:0']};
      const ownership=t.ownership(set);const validWish=t.wish(set.key),badWish=t.wish('__proto__');
      s.achievements={bossdown:true,firstbuild:true};const validTrophy=t.trophy(0,'bossdown'),invalidTrophy=t.trophy(1,'allbosses');t.trophy(1,'bossdown');
      return {saved,unchanged,solar:solar.remaining===1&&solar.target===2,queued,again:!again,consumed,unknown:!unknown,foreign:!foreign,wait,readonly,equipped:ownership[0].owned,missing:!ownership[1].owned,validWish,badWish:!badWish,validTrophy,invalidTrophy:!invalidTrophy,unique:s.personalGoals.trophies[0]===''&&s.personalGoals.trophies[1]==='bossdown'};
    });
    for(const [name,ok]of Object.entries(result))check(name,ok);
    await f.page.evaluate(()=>{__ideas.show('basis');document.querySelector('#k7Blueprints details').open=true;});
    check('blueprint name is displayed as literal text',await f.page.locator('#k7Blueprints').evaluate(el=>!el.querySelector('img')&&el.textContent.includes('<img')));
    for(const width of [360,390,430,1200]){
      await f.page.setViewportSize({width,height:900});
      check('planning cards fit '+width+'px',await f.page.locator('#k7Blueprints').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().right<=innerWidth+1));
    }
    await f.page.evaluate(()=>{__ideas.show('sammlung');document.querySelector('#k7LootCompass details').open=true;});
    check('loot compass is reachable from collection',await f.page.locator('#k7WishSet').isVisible());
    check('wish and blueprint preferences survive both resets',(f.source.match(/personalGoals:state.personalGoals/g)||[]).length===2);
    check('no errors during planning',f.errors.length===0);
  }finally{await f.close();}
  const english=await fixture('render:renderK7Ideas','en');
  try{
    await english.page.evaluate(()=>__ideas.show('sammlung'));
    check('new compass uses existing English architecture',(await english.page.locator('#k7LootCompass').textContent()).includes('Loot compass'));
    await english.page.evaluate(()=>{
      const s=__ideas.state();s.personalGoals.blueprints=[{id:'unsupported',futureVersion:true},{id:'named-plan',name:'Heimatbasis',steps:[{key:'solar',level:2}]}];
      __ideas.show('basis');document.querySelector('#k7Blueprints details').open=true;
    });
    // Wait for the real translation observer, which must skip personal option labels.
    await english.page.waitForTimeout(100);
    check('personal plan name remains untranslated',(await english.page.locator('#k7PlanSelect option[value="named-plan"]').textContent())==='Heimatbasis');
    await english.page.locator('#k7DeletePlan').click();
    check('deleting one plan keeps unsupported entries',await english.page.evaluate(()=>{
      const raw=__ideas.state().personalGoals.blueprints;return raw.length===1&&raw[0].id==='unsupported'&&raw[0].futureVersion===true;
    }));
    await english.page.evaluate(()=>{__ideas.state().personalGoals.blueprints=Array.from({length:8},(_,i)=>({id:'unsupported-'+i,futureVersion:true}));__ideas.show('basis');});
    check('preserved entries count toward the eight-plan limit',await english.page.locator('#k7SavePlan').isDisabled());
  }finally{await english.close();}
  console.log('PASS '+checks+' checks');
})().catch(error=>{console.error(error);process.exitCode=1;});
