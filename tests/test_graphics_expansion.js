'use strict';
// Real game and isolated API, including a browser with the previous release's CSS cached.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {SPIELDATEI,WURZEL,starteBrowser,ruhigeUhren}=require('./lib/umgebung');
const {oeffneSektorMitSystem,oeffneSystemUeberSektoren}=require('./lib/karte');
let source=fs.readFileSync(SPIELDATEI,'utf8');
if(process.env.K7_GFX_EXPANSION_FAULT==='forwarding'){
 const anchor='if (button && !button.disabled) button.click();';assert.equal(source.split(anchor).length,2);
 source=source.replace(anchor,"if (kind!=='defense' && button && !button.disabled) button.click();");
}
if(process.env.K7_GFX_EXPANSION_FAULT==='prerequisites'){
 const anchor='done=(state.research[r.key]||0)>=r.level';assert.equal(source.split(anchor).length,2);
 source=source.replace(anchor,'done=true');
}
if(process.env.K7_GFX_EXPANSION_FAULT==='cache'){
 const anchor='kepler-graphics.css?v=20261008-1';assert.equal(source.split(anchor).length,2);
 source=source.replace(anchor,'kepler-graphics.css?v=20261007-6');
}
const currentCss=fs.readFileSync(path.join(WURZEL,'kepler-graphics.css'),'utf8');
const cssStart=currentCss.indexOf('.gfx-picker {'),cssEnd=currentCss.indexOf('.gfx-heading {');
assert(cssStart>=0&&cssEnd>cssStart,'verified previous stylesheet reconstruction');
const cachedCss=currentCss.slice(0,cssStart)+currentCss.slice(cssEnd);
const end='\n})();\n</script>\n</body>';
assert.equal(source.split(end).length-1,1,'verified game export anchor');
const html=source.replace(end,`\nwindow.__gfxReview={ready:()=>bootDataReady,state:()=>state,show:s=>switchTab(s),render,
  stage:b=>gfxColonyStage(b),selectBuilding:k=>{gfxBuilding=k;renderGraphicsColony();},
  selectShip:k=>{gfxShip=k;renderGraphicsShipyard();},map:renderGraphicsMap,
  selectDefense:k=>{gfxDefense=k;renderGraphicsDefense();},selectResearch:k=>{gfxResearch=k;renderGraphicsResearch();},
  expeditionType:()=>selectedExpeditionType,officers:OFFICERS.map(o=>o.key),shipKeys:SHIP_DEFS.map(d=>d.key),planetArt:GFX_PLANET_ART};\n`+end);
let checks=0,failed=0;
const check=(name,ok,data)=>{checks++;if(!ok)failed++;console.log((ok?'OK':'FAIL')+' - '+name+(ok||!data?'':' '+JSON.stringify(data)));};
(async()=>{
 let server,browser;
 try {
  server=http.createServer((req,res)=>{
   if(req.url.split('?')[0]==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html);}
   const p=path.resolve(WURZEL,req.url.split('?')[0].slice(1));
   if(!p.startsWith(WURZEL+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}
   res.writeHead(200,{'Content-Type':p.endsWith('.png')?'image/png':p.endsWith('.css')?'text/css':'application/javascript'});res.end(fs.readFileSync(p));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port,store={};
  const now=Date.now();
  store['kepler7-save-v3']=JSON.stringify({tutorialSeen:true,newbieWelcomeSeen:true,
    commandPoints:1000,credits:12345,resources:{energie:90000,erz:90000,kristalle:90000,deuterium:60000,antimaterie:1000,forschungspunkte:3000},
    buildings:{solar:8,mine:2,raffinerie:4,synth:3,lager:25,labor:5,habitat:2,werftkern:3},research:{rkampf:1,rkolonisation:1},
    fleet:{ships:3,jaeger:2,cruisers:1,destroyers:0,forscher:2,missions:[]},colonies:{rhea:{buildings:{solar:3,mine:2,lager:4},fleet:{jaeger:1,missions:[]}}},
    discovered:{rhea:true,aion:true,draconis:true},activeBasePlanet:'home',player:{id:'u',name:'graphics-fixture'},
    lastTick:now-60000,lastLoginDate:new Date().toDateString(),lastSeenVersion:(source.match(/const VERSION\s*=\s*['"]([^'"]+)/)||[])[1],...ruhigeUhren()});
  browser=await starteBrowser();
  const ctx=await browser.newContext({viewport:{width:1487,height:1058},serviceWorkers:'block'});
  await ctx.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==origin)return route.abort();
   if(url.pathname==='/kepler-graphics.css'&&url.search==='?v=20261007-6')return route.fulfill({status:200,contentType:'text/css',body:cachedCss});
   if(!url.pathname.startsWith('/api/'))return route.continue();
   const p=url.pathname.slice(5),json=(v,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(v)});
   if(p==='me')return json({userId:'u',username:'graphics-fixture',homeSystem:'kepler',homeSlot:0,hasEmail:true,wantsPatchnotes:false});
   if(p.startsWith('storage/')){const k=p.slice(8);if(req.method()==='PUT'||req.method()==='POST'){store[k]=JSON.parse(req.postData()||'{}').value;return json({ok:true,version:1});}return store[k]===undefined?json({},404):json({key:k,value:store[k],version:1});}
   if(p.includes('pending-rewards'))return json({reward:null});
   if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends/.test(p))return json([]);
   return json({});
  });
  await ctx.addInitScript(()=>localStorage.setItem('kepler7_token','local-fixture'));
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.waitForFunction(()=>window.__gfxReview&&__gfxReview.ready(),{timeout:20000});
  // Loading schedules the offline dialog after save(); dismiss the actual dialog before actions.
  await page.locator('#welcomeBackDismissBtn').waitFor({state:'visible'});
  await page.locator('#welcomeBackDismissBtn').click();
  await page.evaluate(()=>{for(const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']){const e=document.getElementById(id);if(e)e.style.display='none';}__gfxReview.show('basis');});
  check('game boots without JavaScript errors',errors.length===0,errors);
  await page.evaluate(()=>__gfxReview.show('verteidigung'));
  check('a browser retaining the previous CSS receives the new usable controls',await page.locator('#defenseVisual select').evaluate(e=>e.getBoundingClientRect().height>=44));
  const defenseMirror=await page.evaluate(()=>{const a=document.querySelector('#defenseVisual [data-gfx-build="defense"]'),b=document.querySelector('#defenseBuildings [data-build="turm"]');return !!a&&!!b&&a.disabled===b.disabled&&a.textContent===b.textContent;});
  check('fortress action uses the current real defense order',defenseMirror);
  const before=await page.evaluate(()=>{const s=__gfxReview.state();return (s.buildings.turm||0)+s.constructionQueue.filter(j=>j.kind==='building'&&j.key==='turm'&&j.planet==='home').reduce((n,j)=>n+j.qty,0);});
  await page.locator('#defenseVisual [data-gfx-build="defense"]').click();
  const after=await page.evaluate(()=>{const s=__gfxReview.state();return (s.buildings.turm||0)+s.constructionQueue.filter(j=>j.kind==='building'&&j.key==='turm'&&j.planet==='home').reduce((n,j)=>n+j.qty,0);});
  check('fortress upgrade executes exactly one native defense action',after===before+1,{before,after});
  await page.locator('#defenseVisual [data-gfx-defense-picker]').selectOption('laser');
  check('all facilities can be selected beyond the scene hotspots',await page.locator('#defenseVisual [data-gfx-build="defense"]').getAttribute('data-gfx-key')==='laser');
  const expired=await page.evaluate(()=>{const b=document.querySelector('#defenseBuildings [data-build="laser"]'),a=document.querySelector('#defenseVisual [data-gfx-build="defense"]'),state=__gfxReview.state(),before=state.buildings.laser||0;b.disabled=true;a.click();return (state.buildings.laser||0)===before;});
  check('fortress rechecks a native action disabled after rendering',expired);
  await page.evaluate(()=>{__gfxReview.show('forschung');__gfxReview.selectResearch('rsolar2');});
  const req=await page.locator('#researchVisual [data-gfx-research="rsolar"]').first().textContent();
  check('prerequisites show the real required and achieved research levels',/8\s*\/\s*5/.test(req)===false&&/0\s*\/\s*5/.test(req),{req});
  check('unmet prerequisite remains visibly locked',await page.locator('#researchVisual [data-gfx-research="rsolar"]').first().evaluate(e=>!e.classList.contains('gfx-tech-ready')));
  check('locked research cannot be started from the illustrated view',await page.locator('#researchVisual [data-gfx-build="research"]').isDisabled()&&await page.evaluate(()=>!__gfxReview.state().activeResearch));
  await page.locator('#researchVisual [data-gfx-research="rsolar"]').first().click();
  check('prerequisite navigation selects the actual technology',await page.locator('#researchVisual [data-gfx-research-picker]').inputValue()==='rsolar');
  await page.locator('#researchVisual [data-gfx-build="research"]').click();
  check('illustrated research starts a single native research project',await page.evaluate(()=>__gfxReview.state().activeResearch?.key==='rsolar'&&__gfxReview.state().activeResearch?.targetLevel===1));
  await page.locator('#researchVisual [data-gfx-research-picker]').selectOption('rerz');
  await page.locator('#researchVisual [data-gfx-build="researchqueue"]').click();
  check('illustrated queue control adds the real selected research',await page.evaluate(()=>__gfxReview.state().researchQueue.includes('rerz')));
  const labStable=await page.evaluate(()=>{const img=document.querySelector('#researchVisual .gfx-landscape');__gfxReview.state().resources.forschungspunkte+=3;__gfxReview.render();return img===document.querySelector('#researchVisual .gfx-landscape');});
  check('research income updates retain the laboratory image',labStable);
  await page.evaluate(()=>__gfxReview.show('expedition'));
  check('all six expedition types are illustrated native controls',await page.locator('#expeditionBox [data-expedition-type] img').count()===6);
  await page.locator('#expeditionBox [data-expedition-type="salvage"]').click();
  check('illustrated mission selection changes the native expedition type',await page.evaluate(()=>__gfxReview.expeditionType()==='salvage')&&await page.locator('#expeditionVisual').textContent().then(t=>t.includes('Bergungsexpedition')));
  check('no fake travelling mission is shown while the mission list is empty',await page.locator('#expeditionsActive .gfx-journey').count()===0);
  await page.evaluate(()=>{const st=__gfxReview.state();st.fleet.missions.push({type:'expedition',id:'local-flight',endTime:Date.now()+600000,startTime:Date.now(),escortPower:0});__gfxReview.render();});
  check('a real active mission gains the journey illustration and native recall',await page.locator('#expeditionsActive .gfx-journey').count()===1&&await page.locator('#expeditionsActive [data-recall="local-flight"]').count()===1);
  await page.locator('#customFleetNameInputExp').fill('Meine Forschungsreise');
  const typing=await page.locator('#customFleetNameInputExp').evaluate(e=>{__gfxReview.render();return e===document.getElementById('customFleetNameInputExp')&&e.value==='Meine Forschungsreise'&&document.activeElement===e;});
  check('expedition input value and focus survive the graphics update',typing);
  await page.evaluate(()=>{__gfxReview.state().marketCache={erz:{price:2,basePrice:2,history:[]}};__gfxReview.show('markt');});
  await page.locator('#marketBox [data-market-amt="erz"]').fill('321');
  const market=await page.locator('#marketBox [data-market-amt="erz"]').evaluate(e=>{const img=document.querySelector('#marketVisual img');__gfxReview.state().credits=13579;__gfxReview.render();return e===document.querySelector('#marketBox [data-market-amt="erz"]')&&e.value==='321'&&document.activeElement===e&&img===document.querySelector('#marketVisual img');});
  check('market credits update without replacing the trade input or station image',market);
  check('trading port displays the real updated credit balance',await page.locator('#gfxMarketCredits').textContent()===await page.locator('#creditsDisplay').textContent());
  await page.evaluate(()=>__gfxReview.show('offiziere'));
  const portraits=await page.locator('#officerBox [data-gfx-officer]').evaluateAll(es=>es.map(e=>e.dataset.gfxOfficer));
  check('all seven actual officer roles have distinct portraits',JSON.stringify(portraits)===JSON.stringify(await page.evaluate(()=>__gfxReview.officers))&&new Set(portraits).size===7,portraits);
  await page.locator('#officerBox [data-upgrade-officer="ingenieur"]').click();
  check('portrait card still promotes the actual officer',await page.evaluate(()=>__gfxReview.state().officers.ingenieur===1));
  await page.evaluate(()=>__gfxReview.show('flotte'));
  await page.locator('#shipyardVisual [data-gfx-ship="frachter"]').click();
  check('new freight ship image is tied to the real freight ship action',await page.locator('#shipyardVisual .gfx-ship-model').getAttribute('src')==='kepler-gfx-ship-frachter.png'&&await page.locator('#shipyardVisual [data-gfx-build]').getAttribute('data-gfx-key')==='frachter');
  await page.locator('#shipyardVisual [data-gfx-ship-picker]').selectOption('bomber');
  check('other ship classes use their own detailed native hull rather than a wrong illustration',await page.locator('#shipyardVisual canvas[data-ship-icon="bomber"]').count()===1&&await page.locator('#shipyardVisual .gfx-ship-model').count()===0);
  check('class picker contains every native ship class',await page.locator('#shipyardVisual [data-gfx-ship-picker] option').count()===await page.evaluate(()=>__gfxReview.shipKeys.length));
  const alpha=await page.evaluate(async()=>{const result=[];for(const key of ['ice','volcano','desert','moon']){const i=new Image();i.src='kepler-gfx-planet-'+key+'.png';await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);result.push({key,corner:x.getImageData(0,0,1,1).data[3],center:x.getImageData(c.width/2,c.height/2,1,1).data[3]});}return result;});
  check('new planet surfaces load with genuinely transparent backgrounds',alpha.every(a=>a.corner===0&&a.center>=250),alpha);
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    for(const tab of ['verteidigung','forschung','expedition','offiziere','markt']){
      await page.evaluate(t=>__gfxReview.show(t),tab);
      const id={verteidigung:'defenseVisual',forschung:'researchVisual',expedition:'expeditionVisual',offiziere:'officerBox',markt:'marketVisual'}[tab];
      const fit=await page.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1;});
      check(tab+' fits '+width+'px without clipping controls',fit);
    }
  }
  await page.evaluate(()=>__gfxReview.show('verteidigung'));
  const spots=await page.locator('#defenseVisual .gfx-hotspot').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
  check('mobile fortress controls have 44px targets without overlaps',spots.every(a=>a.h>=44)&&spots.every((a,i)=>spots.slice(i+1).every(b=>a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y)),spots);
  const saved=JSON.parse(store['kepler7-save-v3']);saved.lastTick=Date.now()-60000;store['kepler7-save-v3']=JSON.stringify(saved);
  await page.goto(origin+'/?lang=en');await page.waitForFunction(()=>window.__gfxReview&&__gfxReview.ready());
  for(const [tab,expected] of [['verteidigung','Planetary fortress'],['forschung','Research center'],['expedition','Expedition center'],['markt','Orbital trading port']]){
    await page.evaluate(t=>__gfxReview.show(t),tab);check(tab+' uses translated English graphics',await page.locator('#tab-'+tab+' .gfx-heading h2').textContent().then(t=>t===expected));
  }
  check('graphics interactions produce no JavaScript errors',errors.length===0,errors);
 }catch(e){failed++;console.error(e.stack);}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
 console.log('\n'+checks+' checks, '+failed+' failures');process.exitCode=failed?1:0;
})();
