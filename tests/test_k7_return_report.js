'use strict';
const assert=require('node:assert/strict'),fixture=require('./lib/ideas-fixture');
(async()=>{
  const f=await fixture('offline:applyOfflineProgress,summary:()=>lastOfflineSummary,report:showWelcomeBackModal,defaults:applyStateDefaults,capacity:k7ResourceCapacity,save:sicherSpeichern', 'en');
  try{
    const p=f.page;
    // The initial load schedules its own welcome popup after 400 ms. Let that startup popup
    // settle before creating the isolated report whose navigation and dismissal are measured.
    await p.waitForTimeout(500);
    const result=await p.evaluate(()=>{
      const t=__ideas,s=t.state();s.buildings={nanolegierungsfabrik:10,lager:3};s.colonies={};s.research={};s.fleet.missions=[];s.constructionQueue=[];s.buildQueue=[];s.researchQueue=[];s.activeResearch=null;t.defaults();
      s.resources={energie:1000,erz:1000,kristalle:1000,deuterium:0,antimaterie:0,forschungspunkte:0,nanolegierungen:0};const before={...s.resources};
      t.offline(60);const summary=t.summary(),actual={};for(const key of Object.keys(s.resources))actual[key]=Math.round(s.resources[key]-(before[key]||0));
      const resources=JSON.stringify(s.resources);t.report(summary,null);const displayOnly=resources===JSON.stringify(s.resources);
      s.resources.nanolegierungen=t.capacity('nanolegierungen');s.resources.protomaterie=t.capacity('protomaterie');t.report(summary,null);
      return {summary,actual,displayOnly};
    });
    assert.deepEqual(result.summary.gained,result.actual,'return ledger includes actual refinery output and consumption');
    assert.ok(result.summary.gained.nanolegierungen>0,'real refinery produced advanced resources');
    assert.ok(result.summary.gained.erz<0,'real refinery consumed input resources');
    assert.equal(result.displayOnly,true,'showing report never grants rewards');
    await p.waitForTimeout(200);
    const text=await p.locator('#welcomeBackBody').textContent();assert.match(text,/Consumed by production chains/);assert.match(text,/Nanoalloys/);assert.match(text,/Protomatter/i);
    assert.equal(await p.locator('#welcomeBackBody [data-wb-jump]').count(),3,'return report offers three actual navigation actions');
    const target=await p.locator('#welcomeBackBody [data-wb-jump]').last().getAttribute('data-wb-jump');
    await p.locator('#welcomeBackBody [data-wb-jump]').last().focus();await p.keyboard.press('Enter');
    assert.equal(await p.locator('.tab-btn.active').getAttribute('data-tab'),target,'keyboard action opens its actual tab');
    assert.equal(await p.locator('#welcomeBackOverlay').isVisible(),false,'action dismisses report before navigation');
    await p.evaluate(()=>__ideas.save());const beforeReload=await p.evaluate(()=>__ideas.state().resources.nanolegierungen);
    await p.reload();await p.waitForFunction(()=>window.__ideas&&__ideas.ready());
    const afterReload=await p.evaluate(()=>__ideas.state().resources.nanolegierungen);
    assert.ok(afterReload<beforeReload+1,'reload does not apply the previous offline minute again');
    assert.equal(f.errors.length,0,f.errors.join('\n'));console.log('PASS return ledger, consumption, advanced storage, three links and reload');
  }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
