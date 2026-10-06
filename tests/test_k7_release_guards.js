'use strict';
const assert=require('node:assert/strict'),fixture=require('./lib/ideas-fixture');
(async()=>{
  let armed=false;
  const pending=new Map();
  const f=await fixture('trial:newTacticalTrial,trialResolve:resolveTacticalTrial,trialContinue:continueTacticalTrial,trialRender:run=>{tacticalTrialRun=run;renderTacticalTrial();},label:k7ColonyLabel,favorite:mapFavoriteTarget,preview:k7BlueprintPreview,queue:k7QueueBlueprintStep,defs:RESEARCH_DEFS,rows:k7CostBottleneck,dry:k7PlanningCopy,cap:storageCap,defaults:applyStateDefaults,loadPlayers:loadPlayersInSystem,system:id=>{activeSystem=id},players:()=>otherPlayersInSystem,advance:dt=>{const gross=ratesPerSecond();for(const [key,rate]of Object.entries(gross))applySoftCappedGain(state.resources,key,rate*dt,storageCap());processTier2Factories(dt);}','en',{api:async({path,request,json})=>{
    if(path!=='players-map')return false;
    if(!armed){await json({players:[]});return true;}
    const system=new URL(request.url()).searchParams.get('system');
    await new Promise(resolve=>pending.set(system,async body=>{await json(body);resolve();}));return true;
  }});
  try{
    await f.page.waitForTimeout(500);
    const result=await f.page.evaluate(()=>{
      const t=__ideas,s=t.state();s.colonyNames={};
      const home=t.favorite('colony','home').name==='Home base'&&t.label('home')==='Home base';
      const moon=t.label('moon_home')==='Moon of Home base';
      s.colonyNames.home='Heimatbasis';const personal=t.label('home')==='Heimatbasis'&&t.label('moon_home')==='Moon of Heimatbasis';
      s.research=Object.fromEntries(t.defs.map(d=>[d.key,1000]));s.buildings.urmateriereaktor=0;s.buildQueue=[];s.constructionQueue=[];s.rareItems.urmaterie=0;
      const plan={id:'rare-plan',name:'Rare plan',steps:[{key:'urmateriereaktor',level:3}]};s.personalGoals.blueprints=[plan];
      let row=t.preview(plan,'home')[0];const missing=row.specialItem==='urmaterie'&&row.specialMissing===3&&!row.unlocked&&!t.queue(plan.id,row.def.key,'home');
      s.rareItems.urmaterie=1;const resources=JSON.stringify(s.resources);const first=t.queue(plan.id,'urmateriereaktor','home');row=t.preview(plan,'home')[0];
      const reserved=first&&row.queued===1&&row.remaining===2&&row.specialAvailable===0&&!t.queue(plan.id,'urmateriereaktor','home')&&s.rareItems.urmaterie===1&&JSON.stringify(s.resources)===resources;
      s.rareItems.urmaterie=3;row=t.preview(plan,'home')[0];const rest=row.specialAvailable===2&&row.specialMissing===0&&row.unlocked;
      s.research={rsingularitaet:1,rewig_prod:40};s.colonies={};s.buildings={mine:2,solar:2,lager:3};s.buildQueue=[];s.constructionQueue=[];s.fleet.missions=[];s.resources={energie:0,erz:0,kristalle:0,deuterium:0,antimaterie:0,forschungspunkte:0};s.researchQueue=['rewig_prod'];s.baustelle={anteil:0.25,konten:{}};t.defaults();
      const account='rewig_prod:41',cost=t.cap()*1.001;
      const funded=t.rows({erz:cost},account)[0];
      const paidAt=seconds=>t.dry(()=>{t.advance(seconds);return s===t.state()?NaN:(t.state().resources.erz||0)+((t.state().baustelle.konten[account]||{}).erz||0);});
      const before=JSON.stringify(s),eta=funded.eta;
      const mixed=funded.rate>0&&funded.accountRate>0&&paidAt(eta)>=cost-1e-6&&paidAt(eta-1)<cost-1e-6;
      const readonly=before===JSON.stringify(s);
      s.resources.erz=t.cap();const saturated=t.rows({erz:cost},account)[0];
      const full=saturated.rate===0&&paidAt(saturated.eta)>=cost-1e-6&&paidAt(Math.max(0,saturated.eta-1))<cost-1e-6;
      return {home,moon,personal,missing,reserved,rest,mixed,full,readonly};
    });
    for(const [name,ok]of Object.entries(result))assert.equal(ok,true,name);
    console.log('OK - default names translate, private names persist, rare-item requirements and combined account ETA are correct');
    await f.page.evaluate(()=>{
      __ideas.show('galaxie');
      let run;
      for(const a of ['screen','strike','barrage'])for(const b of ['screen','strike','barrage'])for(const c of ['screen','strike','barrage']){
        let candidate=__ideas.trial();for(const tactic of [a,b,c]){if(candidate.status!=='ready')break;candidate=__ideas.trialContinue(__ideas.trialResolve(candidate,tactic,candidate.wave));}
        if(candidate.integrity>0&&candidate.integrity<85&&candidate.history.length===3)run=candidate;
      }
      if(!run)throw Error('real sub-goal trial fixture');
      __ideas.trialRender(run);
    });
    assert.equal(await f.page.locator('#tacticalTrialBox h4[role="status"]').textContent(),'Trial failed','sub-goal trial result is reported as failure');
    await f.page.evaluate(()=>{
      let run=__ideas.trial();for(const tactic of ['screen','strike','barrage'])run=__ideas.trialContinue(__ideas.trialResolve(run,tactic,run.wave));__ideas.trialRender(run);
    });
    assert.equal(await f.page.locator('#tacticalTrialBox h4[role="status"]').textContent(),'Blockade cleared','all three counters meet the training objective');
    console.log('OK - trial headings match the actual 85-point objective');
    armed=true;
    await f.page.evaluate(()=>{__ideas.system('old-system');void __ideas.loadPlayers();__ideas.system('new-system');void __ideas.loadPlayers();});
    const deadline=Date.now()+10000;while(pending.size<2&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
    assert.equal(pending.size,2,'both real map requests reached the local fixture');
    await pending.get('new-system')({players:[{id:'new-player',isMe:false}]});
    await f.page.waitForFunction(()=>__ideas.players()[0]?.id==='new-player');
    await pending.get('old-system')({players:[{id:'old-player',isMe:false}]});
    await f.page.waitForTimeout(100);
    assert.equal(await f.page.evaluate(()=>__ideas.players()[0]?.id),'new-player','stale player-map response cannot replace the current system');
    assert.equal(f.errors.length,0,f.errors.join('\n'));
    console.log('OK - late old-system responses never replace current map players');
  }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
