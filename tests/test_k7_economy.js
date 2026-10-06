'use strict';
const assert=require('node:assert/strict'),fixture=require('./lib/ideas-fixture');
(async()=>{
  const f=await fixture('economy:k7EconomySnapshot,target:k7TargetBottleneck,preview:k7ImprovementPreview,dry:k7PlanningCopy,gross:ratesPerSecond,cap:storageCap,buildingCost:costFor,buildingDefs:BUILDING_DEFS,defaults:applyStateDefaults,save:sicherSpeichern','en');
  try{
    const p=f.page,result=await p.evaluate(()=>{
      const t=__ideas,s=t.state();s.research={rbauplan:2};s.colonies={};s.buildings={mine:2,solar:2,lager:3};s.fleet.missions=[];s.resources={energie:0,erz:0,kristalle:0,deuterium:0,antimaterie:0,forschungspunkte:0};t.defaults();
      const before=JSON.stringify(s),target=t.target('building','mine'),preview=t.preview('building','mine'),readonly=JSON.stringify(s)===before&&s===t.state();
      const realCost=t.buildingCost(t.buildingDefs.find(d=>d.key==='mine'),s.buildings.mine);
      s.buildings.mine++;const actualAfter=t.gross().erz;s.buildings.mine--;
      const income=preview.allowed&&preview.rows.some(r=>r.res==='erz'&&Math.abs(r.after-actualAfter)<1e-8);
      const researchPreview=t.preview('research','rsolar');s.research.rsolar=1;const actualEnergy=t.gross().energie;s.research.rsolar=0;
      const research=researchPreview.allowed&&researchPreview.rows.some(r=>r.res==='energie'&&Math.abs(r.after-actualEnergy)<1e-8);
      const storagePreview=t.preview('building','lager');s.buildings.lager++;const actualCapacity=t.cap();s.buildings.lager--;
      const storage=storagePreview.rows.some(r=>r.capAfter===actualCapacity&&r.capBefore<r.capAfter);
      s.buildings.mine=0;s.buildings.solar=0;s.buildings.nanolegierungsfabrik=10;s.resources.erz=1000;s.resources.kristalle=1000;s.resources.energie=1000;
      const consumed=t.economy(),negative=consumed.net.erz<0&&consumed.consumption.erz>0&&consumed.net.nanolegierungen>0;
      s.buildings.nanolegierungsfabrik=0;s.buildings.mine=2;s.resources.erz=t.cap();const capped=t.economy().net.erz===0;
      s.research.rsingularitaet=1;s.research.rewig_prod=40;s.researchQueue=['rewig_prod'];s.baustelle={anteil:0.25,konten:{}};
      const fundedBefore=JSON.stringify(s),funded=t.target('research','rewig_prod'),ore=funded.rows.find(r=>r.res==='erz');
      const account=ore.oversized&&ore.accountRate>0&&!ore.blocked&&Number.isFinite(ore.eta),bankReadonly=JSON.stringify(s)===fundedBefore;
      s.baustelle.anteil=0;const blocked=t.target('research','rewig_prod').rows.find(r=>r.res==='erz').blocked;
      const moon=t.buildingDefs.find(d=>d.moonOnly),moonLocked=!!moon&&!t.target('building',moon.key).unlocked,foreign=t.target('building','mine','foreign')===null;
      const exceptionBefore=JSON.stringify(s);let throwCaught=false;try{t.dry(()=>{t.state().resources.erz=999999;throw Error('expected');});}catch(e){throwCaught=e.message==='expected';}
      return {readonly,cost:JSON.stringify(target.cost)===JSON.stringify(realCost),income,research,storage,negative,capped,account,bankReadonly,blocked,moonLocked,foreign,exception:throwCaught&&s===t.state()&&JSON.stringify(s)===exceptionBefore};
    });
    for(const [name,ok] of Object.entries(result))assert.equal(ok,true,name);
    await p.evaluate(()=>{__ideas.show('basis');document.querySelector('#k7BottleneckBasis details').open=true;});
    await p.locator('#k7BottleneckBasis [data-k7-economy-kind]').selectOption('building');
    await p.locator('#k7BottleneckBasis [data-k7-economy-target]').selectOption('mine');
    assert.match(await p.locator('#k7BottleneckBasis').textContent(),/Next-level preview/);
    for(const width of [360,390,430,1200]){await p.setViewportSize({width,height:900});assert.equal(await p.locator('#k7BottleneckBasis').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().right<=innerWidth+1),true,'economy controls fit '+width);}
    await p.evaluate(()=>__ideas.save());await p.reload();await p.waitForFunction(()=>window.__ideas&&__ideas.ready());
    assert.deepEqual(await p.evaluate(()=>__ideas.state().personalGoals.economyTarget),{kind:'building',key:'mine'},'selected target persists');
    assert.equal(f.errors.length,0,f.errors.join('\n'));console.log('PASS real building/research costs, improvement effects, consumption, storage, accounts and read-only preview');
  }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
