'use strict';
// Native actions and real responsive rendering for the remaining graphics audit.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {SPIELDATEI,WURZEL,starteBrowser,ruhigeUhren}=require('./lib/umgebung');
let source=fs.readFileSync(SPIELDATEI,'utf8'),css=fs.readFileSync(path.join(WURZEL,'kepler-graphics.css'),'utf8');
function fault(text,old,next){assert.equal(text.split(old).length,2,'unique fault anchor');return text.replace(old,next);}
if(process.env.K7_DETAIL_FAULT==='touch')css=fault(css,'#creditShopBox button { min-width:44px; min-height:44px;','#creditShopBox button { min-width:28px; min-height:28px;');
if(process.env.K7_DETAIL_FAULT==='orbital-width')css=fault(css,'.gfx-orbital-choice { min-width:0!important; max-width:none!important;','.gfx-orbital-choice { min-width:0!important; max-width:190px!important;');
if(process.env.K7_DETAIL_FAULT==='missions')source=fault(source,"gfxAtlasTile(GFX_EXPEDITION_KEYS,key,3,","gfxAtlasTile(GFX_EXPEDITION_KEYS,'standard',3,");
if(process.env.K7_DETAIL_FAULT==='catalogue')source=fault(source,'const defs=RESEARCH_DEFS.filter(r=>','const defs=RESEARCH_DEFS.slice(1).filter(r=>');
if(process.env.K7_DETAIL_FAULT==='help-focus')source=fault(source,'if(keepFocus) box.querySelector(', 'if(false) box.querySelector(');
if(process.env.K7_DETAIL_FAULT==='rail-scroll')source=fault(source,'if (railPosition) { const rail=', 'if (false) { const rail=');
if(process.env.K7_DETAIL_FAULT==='english-roles')source=fault(source,'k7t(shipRoleInfo(d).label)','shipRoleInfo(d).label');
const end='\n})();\n</script>\n</body>';assert.equal(source.split(end).length,2);
const html=source.replace(end,`\nwindow.__details={ready:()=>bootDataReady,state:()=>state,show:s=>switchTab(s),render,research:RESEARCH_DEFS,ships:SHIP_DEFS,types:EXPEDITION_TYPES,worlds:TERRAFORM_TARGET_TYPES,orbital:orbitalStationOf,officers:OFFICERS,groups:gfxResearchCatalogue};\n`+end);
let checks=0,failures=0;
function check(name,ok,data){checks++;if(!ok)failures++;console.log((ok?'OK':'FAIL')+' - '+name+(ok||!data?'':' '+JSON.stringify(data)));}
(async()=>{
 let server,browser;
 try {
  server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html);}
   if(url.pathname==='/kepler-graphics.css'){res.writeHead(200,{'Content-Type':'text/css'});return res.end(css);}
   const file=path.resolve(WURZEL,url.pathname.slice(1));
   if(!file.startsWith(WURZEL+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
   res.writeHead(200,{'Content-Type':file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':'application/javascript'});res.end(fs.readFileSync(file));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port,store={};
  store['kepler7-save-v3']=JSON.stringify({tutorialSeen:true,newbieWelcomeSeen:true,commandPoints:1000,credits:50000,moduleFragments:100,
   resources:{energie:90000,erz:90000,kristalle:90000,deuterium:60000,antimaterie:5000,forschungspunkte:3000},
   buildings:{solar:8,mine:2,raffinerie:4,synth:3,lager:25,labor:5,habitat:2,werftkern:3},research:{rkampf:1,rkolonisation:1,rleere:5},
   fleet:{ships:3,jaeger:2,cruisers:1,forscher:2,missions:[]},colonies:{rhea:{buildings:{solar:3,mine:2,lager:4},fleet:{jaeger:1,missions:[]}}},
   discovered:{rhea:true},activeBasePlanet:'home',player:{id:'u',name:'details-fixture'},officers:{ingenieur:1},
   lastTick:Date.now()-60000,lastLoginDate:new Date().toDateString(),lastSeenVersion:(source.match(/const VERSION\s*=\s*['"]([^'"]+)/)||[])[1],...ruhigeUhren()});
  browser=await starteBrowser();const ctx=await browser.newContext({viewport:{width:1487,height:1058},serviceWorkers:'block'});
  await ctx.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(url.origin!==origin)return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();
   const p=url.pathname.slice(5);
   if(p==='me')return json({userId:'u',username:'details-fixture',homeSystem:'kepler',homeSlot:0,hasEmail:true});
   if(p.startsWith('storage/')){const key=p.slice(8);if(['POST','PUT'].includes(req.method())){store[key]=JSON.parse(req.postData()||'{}').value;return json({ok:true,version:1});}return store[key]===undefined?json({},404):json({value:store[key],version:1});}
   if(/reports|leaderboard|messages|ranking|wars|halloffame|bounty|friends/.test(p))return json([]);
   return json({});
  });
  await ctx.addInitScript(()=>localStorage.setItem('kepler7_token','isolated-visual-details'));
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
  await page.waitForFunction(()=>window.__details&&__details.ready(),{timeout:20000});
  await page.locator('#welcomeBackDismissBtn').waitFor({state:'visible'});await page.locator('#welcomeBackDismissBtn').click();
  await page.evaluate(()=>{for(const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay']){const e=document.getElementById(id);if(e)e.style.display='none';}__details.show('basis');});
  check('four orbital focuses remain available with distinct station scenes',await page.locator('#orbitalStationBox [data-build-orbital]').count()===4&&await page.locator('#orbitalStationBox .gfx-orbital-art').evaluateAll(es=>new Set(es.map(e=>getComputedStyle(e).backgroundPosition)).size===4));
  check('orbital choices use the available grid width instead of old narrow scroll cards',await page.locator('#orbitalStationBox .gfx-orbital-choices').evaluate(e=>[...e.children].every(c=>c.getBoundingClientRect().width>=e.clientWidth*.45)));
  await page.locator('#terraformBox [data-pick-terraform-target="wasserwelt"]').click();
  check('world selection uses native state before starting a paid job',await page.evaluate(()=>__details.state().terraforming.home.targetType==='wasserwelt'&&!__details.state().terraformJob));
  check('all eight eligible target worlds remain selectable',await page.locator('#terraformBox [data-pick-terraform-target]').count()===8);
  await page.locator('#terraformBox [data-continue-terraform]').click();
  check('terraform start creates the native job and keeps its target picture',await page.evaluate(()=>__details.state().terraformJob?.targetType==='wasserwelt')&&await page.locator('#terraformBox .gfx-world-comparison > div').count()===2);
  await page.locator('#orbitalStationBox [data-build-orbital="signal"]').click();
  check('queued orbital scene follows the actual queued focus',await page.locator('#orbitalStationBox .gfx-orbital-art').getAttribute('aria-label')==='Signalring'&&await page.locator('#orbitalStationBox [data-orbital-cancel]').count()===1);
  await page.evaluate(()=>__details.show('forschung'));
  check('research grouping keeps every native definition exactly once',await page.evaluate(()=>{const expected=__details.research.map(r=>r.key).sort(),actual=__details.groups().map(r=>r.def.key).sort();return JSON.stringify(actual)===JSON.stringify(expected)&&new Set(actual).size===expected.length;}));
  check('research list renders topic headings and all native actions',await page.locator('#research [data-gfx-research-group]').count()>=8&&await page.locator('#research [data-research]').count()===await page.evaluate(()=>__details.research.length));
  await page.evaluate(()=>{__details.state().research.rsolar=__details.research.find(r=>r.key==='rsolar').maxLevel;__details.state().uiHideMaxed=true;__details.render();});
  check('hide completed research still leaves all incomplete technologies',await page.locator('#research [data-research="rsolar"]').count()===0&&await page.locator('#research [data-research="rerz"]').count()===1);
  await page.evaluate(()=>__details.show('flotte'));
  check('ship rail contains every native hull once',await page.locator('#shipyardVisual [data-gfx-ship]').count()===await page.evaluate(()=>__details.ships.length));
  await page.locator('#shipyardVisual [data-gfx-ship="bomber"]').click();
  check('native hull selection updates the actual construction control',await page.locator('#shipyardVisual [data-gfx-build="ship"]').getAttribute('data-gfx-key')==='bomber');
  const lastHull=page.locator('#shipyardVisual [data-gfx-ship]').last();
  await lastHull.focus();
  const railTop=await page.locator('#shipyardVisual .gfx-ship-list').evaluate(e=>e.scrollTop);
  await lastHull.press('Enter');
  check('ship rail preserves its scroll position when selecting a distant hull',railTop>100&&await page.locator('#shipyardVisual .gfx-ship-list').evaluate((e,y)=>Math.abs(e.scrollTop-y)<1,railTop));
  check('ship rail preserves keyboard focus after selection and native fleet updates',await page.evaluate(()=>{const key=__details.ships.at(-1).key;const selected=()=>document.activeElement?.dataset.gfxShip===key;const first=selected();__details.state().fleet[key]=1;__details.render();return first&&selected();}));
  await page.evaluate(()=>__details.show('expedition'));
  const scenes=await page.locator('#expeditionBox [data-expedition-type] .gfx-expedition-art').evaluateAll(es=>es.map(e=>getComputedStyle(e).backgroundPosition));
  check('six expeditions have distinct visible scenes',scenes.length===6&&new Set(scenes).size===6,scenes);
  for(const key of ['short','deep','salvage','research','mining','standard']){
   await page.locator('#expeditionBox [data-expedition-type="'+key+'"]').click();
   const position=await page.locator('#expeditionBox [data-expedition-type="'+key+'"] .gfx-expedition-art').evaluate(e=>getComputedStyle(e).backgroundPosition);
   check(key+' scene and selected state match the expedition banner',await page.locator('#expeditionVisual .gfx-expedition-art').evaluate((e,p)=>getComputedStyle(e).backgroundPosition===p,position)&&await page.locator('#expeditionBox [data-expedition-type="'+key+'"]').getAttribute('aria-pressed')==='true');
  }
  await page.evaluate(()=>__details.show('offiziere'));
  check('only hired officers show rank progress',await page.locator('#officerBox [role="progressbar"]').count()===1&&await page.locator('#officerBox [role="progressbar"]').getAttribute('aria-valuenow')==='1');
  check('flagship stages follow native levels without bonus changes',await page.evaluate(()=>{const result=[];for(const level of [0,10,20]){__details.state().flagship={level,name:'Local flagship'};__details.render();result.push(document.querySelector('#flagshipBox .gfx-flagship-art').style.getPropertyValue('--tile-x'));}return new Set(result).size===3;}));
  await page.evaluate(()=>__details.show('einstellungen'));
  await page.locator('#themePicker [data-theme-key="ocean"]').click();
  check('named theme selection updates native preference and selected marker',await page.evaluate(()=>__details.state().themeKey==='ocean')&&await page.locator('#themePicker [aria-pressed="true"]').count()===1&&await page.locator('#themePicker [data-theme-key="ocean"]').innerText()==='Ozean');
  await page.locator('#avatarPicker [data-avatar="alien"]').click();
  check('named avatar selection updates native preference and selected marker',await page.evaluate(()=>__details.state().player.avatarKey==='alien')&&await page.locator('#avatarPicker [aria-pressed="true"]').count()===1);
  check('locked avatars retain their identity and cannot be selected',await page.locator('#avatarPicker [data-avatar="nova"]').isDisabled()&&await page.locator('#avatarPicker [data-avatar="nova"] .gfx-avatar-symbol svg').count()===1);
  await page.evaluate(()=>__details.show('hilfe'));
  await page.locator('#helpBox [data-help-cat="grundlagen"] .help-category-header').press('Enter');
  check('help topics open using keyboard and report the real expanded state',await page.locator('#helpBox [data-help-cat="grundlagen"] .help-category-header').getAttribute('aria-expanded')==='true'&&await page.locator('#help-body-grundlagen').isVisible());
  check('keyboard focus survives rebuilding an opened help topic',await page.locator('#helpBox [data-help-cat="grundlagen"] .help-category-header').evaluate(e=>document.activeElement===e));
  for(const width of [320,390,760,1487]){
   await page.setViewportSize({width,height:1058});
   for(const tab of ['basis','flotte','expedition','offiziere','markt','einstellungen','hilfe','galaxie']){
    await page.evaluate(t=>__details.show(t),tab);
    const roots={basis:['#orbitalStationBox','#terraformBox'],flotte:['#shipyardVisual'],expedition:['#expeditionVisual','.gfx-expedition-types'],offiziere:['#flagshipBox','#officerBox'],markt:['#creditShopBox'],einstellungen:['#themePicker','#avatarPicker'],hilfe:['#helpBox'],galaxie:['#npcList']}[tab];
    const layout=await page.locator(roots.join(',')).evaluateAll(es=>es.map(e=>({root:e.id||e.className,width:e.clientWidth,scroll:e.scrollWidth,fit:e.scrollWidth<=e.clientWidth+2})));
    check(tab+' graphic controls fit '+width+'px without horizontal clipping',layout.every(r=>r.fit),layout);
    if(tab==='flotte'&&width===390){
     await page.locator('#shipyardVisual [data-gfx-ship]').last().focus();
     const railLeft=await page.locator('#shipyardVisual .gfx-ship-list').evaluate(e=>e.scrollLeft);
     await page.locator('#shipyardVisual [data-gfx-ship]').last().press('Enter');
     check('mobile ship rail preserves horizontal position after keyboard selection',railLeft>100&&await page.locator('#shipyardVisual .gfx-ship-list').evaluate((e,x)=>Math.abs(e.scrollLeft-x)<1,railLeft));
    }
    if(tab==='markt'){
     const sizes=await page.locator('#creditShopBox [data-shop-qty]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height};}));
     // Browser layout can report 43.9998px for a computed 44px minimum.
     check('market quantity controls are touch sized at '+width+'px',sizes.length>0&&sizes.every(r=>r.width>=43.99&&r.height>=43.99),sizes);
    }
   }
  }
  check('new atlases load and have correct grid aspect ratios',await page.evaluate(async()=>{for(const [file,ratio] of [['orbital',1],['world',1],['expedition',1.5],['flagship',3]]){const im=new Image();im.src='kepler-gfx-'+file+'-atlas.png';await im.decode();if(Math.abs(im.naturalWidth/im.naturalHeight-ratio)>.01)return false;}return true;}));
  await page.goto(origin+'/?lang=en');
  await page.waitForFunction(()=>window.__details&&__details.ready());
  await page.evaluate(()=>{for(const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay']){const e=document.getElementById(id);if(e)e.style.display='none';}__details.show('flotte');});
  const roles=await page.locator('#shipyardVisual [data-gfx-ship] small').allTextContents();
  const englishRoles=['Civilian','Interceptor','Bomber','Capital ship','Armored','Fast attack','Attack'];
  check('all catalogue hull roles use their English labels after a language switch',roles.length===45&&roles.every(t=>englishRoles.some(role=>t.startsWith(role+' · Available:')))&&['Civilian','Interceptor','Capital ship'].every(role=>roles.some(t=>t.startsWith(role+' ·'))),roles);
  check('all exercised native actions finish without JavaScript errors',errors.length===0,errors);
 }catch(e){failures++;console.error(e.stack);}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
 console.log('\n'+checks+' checks, '+failures+' failures');process.exitCode=failures?1:0;
})();
