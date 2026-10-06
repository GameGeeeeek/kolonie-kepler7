'use strict';
const assert=require('node:assert/strict'),fixture=require('./lib/ideas-fixture'),fs=require('fs'),path=require('path');
let checks=0;function check(name,c){assert.ok(c,name);console.log('OK - '+name);checks++;}
(async()=>{
  const requests=[],progress={story:{stage:0,startedAt:null},encounters:[],pity:{part:'panzer_platte',victories:12,required:12}};
  const f=await fixture('refresh:k7RefreshProgress,receive:k7ReceiveReward,feedback:k7ColonyFeedback,archive:k7UpdateArchive,archiveDefs:()=>K7_ARCHIVE,lootTargets:k7LootTargets,saveFavorite:mapFavoriteSave,favorites:mapFavoriteRows,jump:mapFavoriteJump,cache:()=>galaxyCache,phase:k7BossPhase,offlineBefore:k7OfflineLootSnapshot,offlineDelta:k7OfflineLootDelta,preview:k7RaidPreview,trial:()=>tacticalTrialRun,renderTrial:renderTacticalTrial,defs:()=>({buildings:BUILDING_DEFS,research:RESEARCH_DEFS,modules:MODULE_DEFS,sets:MODULE_SET_DEFS}),catalogue:()=>K7_TRANSLATIONS,raid:d=>{allianceRaidCache=d;},busy:()=>k7ServerBusy,finishResearch:processResearch,missions:checkMissions,offline:applyOfflineProgress,summary:()=>lastOfflineSummary,render:render', 'en', {api:async({path:p,request,json})=>{
    if(!p.startsWith('k7/'))return false;const body=JSON.parse(request.postData()||'{}');requests.push({path:p,body});
    if(p==='k7/progress'){await json(progress);return true;}
    if(p==='k7/story/start'){progress.story={stage:0,startedAt:Date.now()};await json({story:progress.story});return true;}
    if(p==='k7/story/recover'){progress.story.stage=2;await json({story:progress.story});return true;}
    if(p==='k7/story/choice'){progress.story.stage=4;progress.story.choice=body.choice;await json({story:progress.story});return true;}
    if(p==='k7/story/claim'){progress.story.stage=5;progress.story.claimed=true;await json({story:progress.story});return true;}
    if(p==='k7/pity/claim'){progress.pity.victories=0;await json({pity:progress.pity});return true;}
    await json({error:'Aktion nicht verfügbar.'},409);return true;
  }});
  try{
    f.page.setDefaultTimeout(10000);
    await f.page.evaluate(()=>__ideas.show('expedition'));await f.page.waitForFunction(()=>document.querySelector('[data-k7-action="story/start"]'));
    await f.page.locator('#k7Story details').evaluate(el=>el.open=true);
    check('story is fully English',(await f.page.locator('#k7Story').textContent()).includes('The silent research vessel'));
    await f.page.locator('[data-k7-action="story/start"]').click();await f.page.waitForFunction(()=>!__ideas.busy());
    check('start button calls server once',requests.filter(r=>r.path==='k7/story/start').length===1);
    progress.story.stage=1;await f.page.evaluate(async()=>{await __ideas.refresh(true);});
    await f.page.locator('[data-k7-action="story/recover"]').click();await f.page.waitForFunction(()=>!__ideas.busy());
    check('recover is separate server step',progress.story.stage===2);
    progress.story.stage=3;await f.page.evaluate(()=>__ideas.refresh(true));
    await f.page.locator('[data-k7-action="story/choice"]').first().click();await f.page.waitForFunction(()=>!__ideas.busy());
    check('ending choice transmitted',requests.some(r=>r.body.choice==='quarantine'));
    await f.page.locator('[data-k7-action="story/claim"]').click();await f.page.waitForFunction(()=>!__ideas.busy());
    check('completion shows selected ending',(await f.page.locator('#k7Story').textContent()).includes('sealed archive'));
    await f.page.evaluate(()=>__ideas.show('sammlung'));await f.page.locator('#k7Pity details').evaluate(el=>el.open=true);
    await f.page.locator('[data-k7-action="pity/claim"]').click();await f.page.waitForFunction(()=>!__ideas.busy());
    check('pity becomes unavailable after claim',await f.page.locator('[data-k7-action="pity/claim"]').isDisabled());
    const r=await f.page.evaluate(()=>{
      const t=__ideas,s=t.state();s.resources.erz=0;s.resources.kristalle=0;s.modules={};s.credits=0;
      const before=t.offlineBefore();
      const handled=t.receive({type:'set-pity',bossset:{bossKey:'panzerhuelle',defKey:'panzer_platte',seltenheit:'selten'}});
      const keys=Object.keys(s.modules),delta=t.offlineDelta(before);
      const ordinary=t.receive({type:'story-campaign',credits:100});
      const unknown=t.receive({type:'invalid',credits:100000});
      t.receive({type:'expedition-choice',resources:{erz:120,kristalle:60}});
      s.personalGoals.archive={};s.discovered={};s.discoveredSystems={};t.archive();const hidden=!s.personalGoals.archive.zenith;
      s.discoveredSystems.zenith=true;t.archive();delete s.discoveredSystems.zenith;t.archive();
      t.feedback('return','<img src=x>');const text=document.getElementById('k7ActivityFeedback');const escaped=text.textContent.includes('<img')&&!text.querySelector('img');
      s.personalGoals.feedback=false;t.feedback('build','forbidden');const off=!text.textContent.includes('forbidden');
      const sys='kepler';t.cache().alienNester=[{id:'visible-nest',sys,lp:100,expiresAt:Date.now()+100000},{id:'hidden-nest',sys:'zenith',lp:100}];
      const targets=t.lootTargets(),visible=targets.some(r=>r.id==='nest:visible-nest'),hiddenTarget=!targets.some(r=>r.id==='nest:hidden-nest');
      const marked=t.saveFavorite('loot','nest:visible-nest','<script>');t.cache().alienNester=[];const stale=t.favorites().find(r=>r.id==='nest:visible-nest');
      const staleJump=!t.jump('loot','nest:visible-nest');
      return {handled,targeted:keys.length===1&&keys[0].startsWith('panzer_platte:selten:1:'),ordinary,credits:s.credits===100,unknown:!unknown,loot:s.resources.erz===120&&s.resources.kristalle===60,delta:delta.length===1&&delta[0].count===1,hidden,persistentArchive:s.personalGoals.archive.zenith,escaped,off,visible,hiddenTarget,marked,stale:stale&&!stale.available,staleJump};
    });for(const [name,ok]of Object.entries(r))check(name,ok);
    const {SERVER_JS}=require('./lib/spieldatei'),phaseFile=SERVER_JS&&path.join(path.dirname(SERVER_JS),'boss-phases.js');
    if(phaseFile&&fs.existsSync(phaseFile)){const backend=require(phaseFile);
      for(const hp of [1000,500,499,0])for(const bomber of [0,1]){const doc={bossKey:'panzerhuelle',variant:'shield-cycle',hp,maxHp:1000},comp={bomber};const client=await f.page.evaluate(({doc,comp})=>__ideas.phase(doc,comp),{doc,comp});check('boss phase parity '+hp+'/'+bomber,JSON.stringify(client)===JSON.stringify(backend.k7BossPhase(doc,comp)));}
    }else console.log('SKIP - phase parity: backend companion file unavailable');
    await f.page.evaluate(()=>{__ideas.show('galaxie');__ideas.renderTrial();});
    await f.page.locator('#tacticalTrialBox details').evaluate(el=>el.open=true);
    for(let wave=0;wave<3;wave++){
      const buttons=f.page.locator('[data-trial-tactic]');await buttons.first().click();check('trial advances to result '+wave,await f.page.locator('[data-trial-next]').isVisible());
      await f.page.locator('[data-trial-next]').click();if(await f.page.evaluate(()=>__ideas.trial().status==='finished'))break;
    }
    check('trial completes through buttons',await f.page.evaluate(()=>__ideas.trial().status==='finished'));
    await f.page.locator('[data-trial-reset]').first().click();check('same fleet can restart',await f.page.evaluate(()=>__ideas.trial().wave===0));
    const diagnostics=[];
    for(const width of [360,390,430,1200]){
      await f.page.setViewportSize({width,height:900});
      for(const tab of ['basis','forschung','flotte','expedition','sammlung','karte']){
        await f.page.evaluate(tab=>__ideas.show(tab),tab);
        const layout=await f.page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,dialogs:[...document.querySelectorAll('.modal-content')].filter(el=>el.getBoundingClientRect().height>0).map(el=>el.getBoundingClientRect().right>innerWidth+1)}));
        diagnostics.push({width,tab,...layout});check('core layout '+tab+' '+width,layout.overflow<=1);
      }
      await f.page.evaluate(()=>{const s=__ideas.state();s.activeBasePlanet='home';s.personalGoals.feedback=true;s.resources={energie:3000,erz:3000,kristalle:3000,deuterium:3000,antimaterie:3000,forschungspunkte:3000};s.research.rsolar=0;s.research.rfusion=1;s.activeResearch=null;s.fleet.forscher=1;s.fleet.missions=[];__ideas.show('basis');});
      const level=await f.page.evaluate(()=>__ideas.state().buildings.solar);
      await f.page.locator('[data-build="solar"]:visible').click();
      check('mobile build uses normal action '+width,await f.page.evaluate(l=>__ideas.state().buildings.solar===l+1,level));
      check('actual build triggers feedback '+width,await f.page.locator('#k7ActivityFeedback').isVisible());
      await f.page.evaluate(()=>__ideas.show('forschung'));await f.page.locator('[data-research="rsolar"]:visible').click();
      check('mobile research starts '+width,await f.page.evaluate(()=>__ideas.state().activeResearch?.key==='rsolar'));
      await f.page.evaluate(()=>{__ideas.state().activeResearch.endTime=Date.now()-1;__ideas.finishResearch();});
      check('research completion recorded '+width,await f.page.evaluate(()=>__ideas.state().research.rsolar===1));
      await f.page.evaluate(()=>__ideas.show('expedition'));await f.page.locator('#sendExpeditionBtn').click();
      check('mobile fleet launch '+width,await f.page.evaluate(()=>__ideas.state().fleet.missions.some(m=>m.type==='expedition')));
      await f.page.waitForFunction(()=>!__ideas.busy());
      await f.page.evaluate(()=>{for(const m of __ideas.state().fleet.missions)m.endTime=Date.now()-1;__ideas.missions(false);__ideas.render();});
      check('fleet returns without duplicate mission '+width,await f.page.evaluate(()=>!__ideas.state().fleet.missions.some(m=>m.type==='expedition')));
      await f.page.evaluate(()=>{const s=__ideas.state();s.officerSubTab='module';s.moduleSlotLevel.home=1;s.equippedModules.home=[];s.modules={'panzer_platte:selten:1:0':1};__ideas.show('offiziere');for(const el of document.querySelectorAll('#moduleBox details'))el.open=true;});
      const equip=f.page.locator('[data-equip-module]:visible').first();await equip.click();
      check('module equipment works '+width,await f.page.evaluate(()=>__ideas.state().equippedModules.home.some(k=>k.startsWith('panzer_platte:'))));
      check('equipment area fits '+width,await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
    check('no script errors during playthrough',f.errors.length===0);
    fs.writeFileSync(path.resolve(__dirname,'../tools/ideas/layout-results.json'),JSON.stringify(diagnostics,null,2)+'\n');
    // Inventory, rather than pretending a giant game is completely translated.
    const inventory=await f.page.evaluate(()=>{const d=__ideas.defs(),c=__ideas.catalogue();return Object.fromEntries(Object.entries(d).map(([kind,defs])=>[kind,defs.flatMap(def=>['name','label','desc','trait'].filter(k=>typeof def[k]==='string'&&def[k]&&!Object.prototype.hasOwnProperty.call(c,def[k])).map(field=>({key:def.key,field,text:def[field]})))]));});
    fs.writeFileSync(path.resolve(__dirname,'../tools/ideas/translation-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
    console.log('PASS '+checks+' gameplay checks');
  }finally{await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
