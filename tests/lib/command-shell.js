'use strict';
// The command-centre contract replaces the former horizontal rail geometry.
// It exercises the original controls and saved state, rather than a second UI model.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {SPIELDATEI,WURZEL,starteBrowser,ruhigeUhren}=require('./umgebung');
const TABS=['basis','verteidigung','forschung','flotte','expedition','karte','galaxie','allianz','offiziere','markt','punkte','fortschritt','sammlung'];
const GROUPS={kolonie:['basis','verteidigung','forschung'],erkundung:['flotte','expedition','karte','galaxie'],gemeinschaft:['allianz','offiziere','markt'],meta:['punkte','fortschritt','sammlung']};
async function run(surface='all'){
 let source=fs.readFileSync(SPIELDATEI,'utf8'),css=fs.readFileSync(path.join(WURZEL,'kepler-graphics.css'),'utf8');
 const selected=surface==='all'?['nav','hud','actions','status']:surface.split(',');
 const fault=process.env.K7_COMMAND_FAULT||({scroll:'selection',font:'font'}[process.env.K7_NAV_FAULT])||({'compact-clipping':'labels',gains:'gains'}[process.env.K7_DENSITY_FAULT]);
 const replace=(text,old,next)=>{assert.equal(text.split(old).length,2,'unique counterexample anchor: '+old);return text.replace(old,next);};
 if(fault==='font')css+='\n.command-rail .tab-btn{font-size:8px!important}';
 if(fault==='labels')css+='\nbody.command-ui #resbar .rescard .label{position:absolute;width:1px;height:1px;overflow:hidden}';
 if(fault==='gains')css+='\nbody.command-ui #resbar .rescard .rate{display:none!important}';
 if(fault==='selection')source=replace(source,"b.addEventListener('click', ()=>switchTab(b.getAttribute('data-tab')))","b.addEventListener('click', ()=>switchTab('basis'))");
 if(fault==='focus')source=replace(source,'if(commandMenuHadFocus){const panel=', 'if(false){const panel=');
 if(fault==='options')source=replace(source,"escapeHtml(state.colonyNames?.[id]?planetDisplayName(id):k7t(planetDisplayName(id)))","k7PreserveUserText(escapeHtml(planetDisplayName(id)))");
 if(fault==='queue')source=replace(source,"native.closest('.card-row').querySelector('[data-queue]')","document.querySelector('#buildings [data-queue=solar]')");
 if(fault==='status')source=replace(source,"const entry=document.body.classList.contains('command-ui')?document.getElementById('commandStatusBtn'):fpToggleBtn;","const entry=fpToggleBtn;");
 const end='\n})();\n</script>\n</body>';assert.equal(source.split(end).length,2,'unique script end');
 const html=source.replace(end,'\nwindow.__command={ready:()=>bootDataReady,state:()=>state,render,show:switchTab,active:()=>activeTab,defs:BUILDING_DEFS};\n'+end);
 let checks=0,failures=0,server,browser;
 const check=(name,ok,data)=>{checks++;if(!ok)failures++;console.log((ok?'OK':'FAIL')+' - '+name+(ok||data===undefined?'':' '+JSON.stringify(data)));};
 try{
  server=http.createServer((req,res)=>{
   const u=new URL(req.url,'http://localhost');let data,mime;
   if(u.pathname==='/'){data=html;mime='text/html';}
   else if(u.pathname==='/kepler-graphics.css'){data=css;mime='text/css';}
   else{const f=path.resolve(WURZEL,u.pathname.slice(1));if(!f.startsWith(WURZEL+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}data=fs.readFileSync(f);mime=f.endsWith('.png')?'image/png':f.endsWith('.woff2')?'font/woff2':f.endsWith('.css')?'text/css':'application/javascript';}
   res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(data);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const fixture={tutorialSeen:true,newbieWelcomeSeen:true,seenTabHints:Object.fromEntries(TABS.map(k=>[k,true])),
   resources:{energie:90000,erz:90000,kristalle:90000,deuterium:60000,antimaterie:5000,forschungspunkte:3000},
   buildings:{solar:8,mine:2,raffinerie:4,synth:3,lager:25,labor:5,habitat:2,werftkern:3},research:{rkampf:1,rkolonisation:1},
   fleet:{jaeger:20,cruisers:4,forscher:2,missions:[]},colonies:{rhea:{buildings:{solar:3,mine:2,lager:4},fleet:{jaeger:1,missions:[]}},moon_home:{buildings:{solar:1,lager:2},fleet:{missions:[]}}},
   colonyNames:{rhea:'Forschung & <Heimatbasis>'},discovered:{rhea:true},activeBasePlanet:'home',player:{id:'u',name:'Forschung'},
   battlePoints:1234567,xp:64000,lastTick:Date.now()-60000,lastLoginDate:new Date().toDateString(),lastSeenVersion:source.match(/const VERSION\s*=\s*['"]([^'"]+)/)[1],...ruhigeUhren()};
  const store={'kepler7-save-v3':JSON.stringify(fixture)};
  browser=await starteBrowser();const ctx=await browser.newContext({viewport:{width:1487,height:1058},serviceWorkers:'block'});
  await ctx.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),j=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(u.origin!==origin)return route.abort();if(!u.pathname.startsWith('/api/'))return route.continue();const p=u.pathname.slice(5);
   if(p==='me')return j({userId:'u',username:'Forschung',homeSystem:'kepler',homeSlot:0,hasEmail:true});
   if(p.startsWith('storage/')){const key=p.slice(8);if(['PUT','POST'].includes(req.method())){store[key]=JSON.parse(req.postData()||'{}').value;return j({ok:true,version:1});}return store[key]===undefined?j({},404):j({value:store[key],version:1});}
   if(/reports|leaderboard|messages|ranking|wars|halloffame|bounty|friends/.test(p))return j([]);return j({});
  });
  await ctx.addInitScript(()=>localStorage.setItem('kepler7_token','isolated-command-test'));
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let boots=0;
  const boot=async(url=origin)=>{await page.goto(url);await page.waitForFunction(()=>window.__command&&__command.ready());if(!boots++){await page.locator('#welcomeBackDismissBtn').waitFor({state:'visible'});await page.locator('#welcomeBackDismissBtn').click();}await page.evaluate(()=>{for(const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay']){const e=document.getElementById(id);if(e)e.style.display='none';}__command.show('basis');});};
  await boot();
  if(selected.includes('nav')){
   const membership=await page.locator('.tabs .tab-gruppe').evaluateAll(es=>Object.fromEntries(es.map(e=>[e.dataset.tabGruppe,[...e.querySelectorAll('.tab-btn')].map(b=>b.dataset.tab)])));
   check('navigation keeps every section once in the chosen four groups',JSON.stringify(membership)===JSON.stringify(GROUPS),membership);
   check('navigation group titles match the chosen direction',JSON.stringify(await page.locator('.tab-gruppe-titel').allTextContents())===JSON.stringify(['Kolonie','Einsatz','Imperium','Erfolge']));
   const icons=await page.locator('.tab-icon-badge').evaluateAll(es=>es.map(e=>e.querySelector('svg')?'svg:'+e.querySelector('svg').innerHTML:e.querySelector('i')?.className));
   check('navigation preserves thirteen distinct native symbols',icons.length===13&&new Set(icons).size===13&&icons.every(Boolean),icons);
   for(const width of [1900,1487,1200,901,900,760,390,360,320]){
    await page.setViewportSize({width,height:844});const drawer=width<=900;
    check('menu entry follows the actual responsive layout at '+width,await page.locator('#commandMenuToggle').isVisible()===drawer);
    if(drawer)await page.locator('#commandMenuToggle').click();
    const measures=await page.locator('.tabs .tab-btn').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {key:e.dataset.tab,font:parseFloat(s.fontSize),w:r.width,h:r.height,clipped:e.scrollWidth>e.clientWidth+2,badge:[...e.querySelectorAll('.tab-badge')].filter(b=>getComputedStyle(b).display!=='none').every(b=>{const z=b.getBoundingClientRect();return z.left>=r.left&&z.right<=r.right+1&&z.top>=r.top&&z.bottom<=r.bottom+1;})};}));
    check('navigation remains readable and badges fit at '+width,measures.length===13&&measures.every(m=>m.font>=12&&m.w>=44&&m.h>=(drawer?44:39.99)&&!m.clipped&&m.badge),measures);
    if(drawer)await page.locator('#commandNavClose').click();
    for(const key of TABS){
     if(drawer)await page.locator('#commandMenuToggle').click();
     const button=page.locator('.tabs [data-tab="'+key+'"]');await button.scrollIntoViewIfNeeded();
     const hit=await button.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
     await button.click();
     check('native selection opens '+key+' at '+width,hit&&await page.locator('#tab-'+key).evaluate(e=>e.classList.contains('active'))&&await button.getAttribute('aria-current')==='page');
     if(drawer)check('selected panel receives focus after mobile navigation '+key+' at '+width,await page.locator('#tab-'+key).evaluate(e=>document.activeElement===e)&&await page.locator('#commandMenuToggle').getAttribute('aria-expanded')==='false');
    }
    check('navigation causes no horizontal document overflow at '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   }
   await page.setViewportSize({width:390,height:844});await page.locator('#commandMenuToggle').click();await page.keyboard.press('Escape');
   check('Escape closes the menu and returns focus to its visible entry',await page.locator('#commandMenuToggle').evaluate(e=>document.activeElement===e&&e.getAttribute('aria-expanded')==='false'));
   await page.locator('#commandMenuToggle').click();await page.locator('#commandNavClose').focus();await page.keyboard.press('Shift+Tab');
   check('menu traps reverse focus at the first control',await page.locator('#commandAccountBtn').evaluate(e=>document.activeElement===e));
   await page.keyboard.press('Tab');check('menu traps forward focus at the last control',await page.locator('#commandNavClose').evaluate(e=>document.activeElement===e));
   await page.locator('.command-tools summary').focus();await page.keyboard.press('Enter');check('extra native menu actions are keyboard reachable',await page.locator('[data-command-header=headerFeedbackBtn]').isVisible());
   await page.locator('#commandNavBackdrop').click({position:{x:350,y:400}});check('backdrop closes the drawer',await page.locator('#commandMenuToggle').getAttribute('aria-expanded')==='false');
   await page.locator('#commandMenuToggle').click();await page.setViewportSize({width:1487,height:1058});await page.waitForFunction(()=>!document.getElementById('commandNav').classList.contains('open'));
   check('growing to desktop clears the menu backdrop',await page.locator('#commandNavBackdrop').getAttribute('hidden')!==null);
  }
  if(selected.includes('hud')){
   for(const width of [1487,1200,901,760,390,360,320]){
    await page.setViewportSize({width,height:844});await page.evaluate(()=>__command.show('basis'));
    const labels=await page.locator('#resbar .rescard .label').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:e.textContent,width:r.width,height:r.height,position:s.position,font:parseFloat(s.fontSize),visible:s.display!=='none',fit:e.scrollWidth<=e.clientWidth+1};}));
    check('six real resource labels remain visible and readable at '+width,labels.length===6&&labels.every(r=>r.visible&&r.width>10&&r.height>10&&r.position!=='absolute'&&r.font>=10&&r.fit),labels);
    const rates=await page.locator('#resbar .rate').evaluateAll(es=>es.map(e=>({text:e.textContent,visible:getComputedStyle(e).display!=='none',width:e.getBoundingClientRect().width,fit:e.scrollWidth<=e.clientWidth+1})));
    check('native production and capacity remain readable at '+width,rates.length===6&&rates.every(r=>r.visible&&r.width>10&&r.fit&&r.text.includes('/s')),rates);
    const controls=await page.locator('.hero-bottom button,.hero-bottom select,.command-stats > summary,.command-status button').evaluateAll(es=>es.filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {id:e.id,w:r.width,h:r.height,left:r.left,right:r.right};}));
    check('visible HUD controls are touch sized and fit at '+width,controls.every(r=>r.w>=43.99&&r.h>=43.99&&r.left>=0&&r.right<=width+1),controls);
    await page.locator('#commandStats > summary').click();
    const chips=await page.locator('.hero-stats .hstat').evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {id:e.querySelector('[id]')?.id,visible:r.width>0&&r.height>0,fit:e.scrollWidth<=e.clientWidth+1,left:r.left,right:r.right};}));
    check('disclosed account and location metrics remain reachable at '+width,chips.length>=8&&chips.every(r=>r.visible&&r.fit&&r.left>=0&&r.right<=width+1),chips);
    await page.locator('#commandStats > summary').click();
    await page.locator('#commandQuests > summary').click();check('daily quests retain their native claim controls at '+width,await page.locator('#dailyQuestBar').isVisible()&&await page.locator('#dailyQuestBar [data-claim-quest],[data-quest-nav]').count()>0);await page.locator('#commandQuests > summary').click();
   }
   const options=await page.locator('#commandPlanetSelect option').allTextContents();
   check('location picker renders escaped names and owned moons as plain option text',JSON.stringify(options)===JSON.stringify(['Heimatbasis','Forschung & <Heimatbasis>','Mond von Heimatbasis']),options);
   await page.locator('#commandStats > summary').click();
   const accountBefore=await page.locator('[data-hstat-gruppe=konto] .hstat-value').allTextContents();const localBefore=await page.locator('[data-hstat-gruppe=standort] .hstat-value').allTextContents();
   await page.locator('#commandPlanetSelect').selectOption('rhea');
   check('location picker invokes the native colony switch',await page.evaluate(()=>__command.state().activeBasePlanet==='rhea'));
   check('account metrics stay fixed while location fleet and power change',JSON.stringify(accountBefore)===JSON.stringify(await page.locator('[data-hstat-gruppe=konto] .hstat-value').allTextContents())&&JSON.stringify(localBefore)!==JSON.stringify(await page.locator('[data-hstat-gruppe=standort] .hstat-value').allTextContents()));
   await page.locator('#commandPlanetSelect').selectOption('moon_home');check('native moon switch remains available',await page.evaluate(()=>__command.state().activeBasePlanet==='moon_home'));
   await page.locator('#commandStats > summary').click();await page.locator('#commandPlanetSelect').selectOption('home');
  }
  if(selected.includes('actions')){
   await page.setViewportSize({width:1487,height:1058});await page.evaluate(()=>__command.show('basis'));
   check('all building definitions remain selectable once',await page.locator('#colonyVisual [data-gfx-facility]').count()===await page.evaluate(()=>__command.defs.length));
   await page.locator('#colonyVisual [data-gfx-facility][data-gfx-key=mine]').click();
   await page.locator('#colonyVisual [data-gfx-queue]').click();
   check('inspector queue uses the selected building and native planet',await page.evaluate(()=>__command.state().buildQueue.some(j=>j.key==='mine'&&j.planet==='home')));
   check('status queue count follows the native pending queue',await page.locator('#commandQueueSummary').innerText()==='Bau-Warteschlange · 1');
   await page.locator('#commandPlanetSelect').selectOption('rhea');await page.locator('#colonyVisual [data-gfx-facility][data-gfx-key=solar]').click();await page.locator('#colonyVisual [data-gfx-queue]').click();
   check('colony queue stays separate from home orders',await page.evaluate(()=>__command.state().buildQueue.some(j=>j.key==='solar'&&j.planet==='rhea')&&__command.state().buildQueue.some(j=>j.key==='mine'&&j.planet==='home')));
   await page.locator('#commandQueueBtn').click();check('queue shortcut opens and focuses the native queue',await page.locator('#buildQueueBox').evaluate(e=>document.activeElement===e));
  }
  if(selected.includes('status')){
   for(const width of [390,1487]){await page.setViewportSize({width,height:844});await page.locator('#commandStatusBtn').click();
    check('status entry opens the native fleet drawer immediately at '+width,await page.locator('#fleetPositionPanel').isVisible()&&await page.locator('#commandStatusBtn').getAttribute('aria-expanded')==='true');
    await page.setViewportSize({width:width===390?1487:390,height:844});await page.waitForTimeout(200);
    check('status remains usable across resizing at '+width,await page.locator('#fleetPositionPanel').isVisible()&&await page.locator('#fpCloseBtn').isVisible());
    await page.keyboard.press('Escape');check('Escape closes the visible fleet drawer at '+width,!await page.locator('#fleetPositionPanel').isVisible()&&await page.locator('#commandStatusBtn').getAttribute('aria-expanded')==='false');
   }
  }
  if(surface==='all'){
   await boot(origin+'/?lang=en');
   check('English navigation translates the new section names',JSON.stringify(await page.locator('.tab-gruppe-titel').allTextContents())===JSON.stringify(['Colony','Operations','Empire','Achievements']));
   check('English mode preserves player owned names and translates the default home option',await page.locator('#commandPlayerName').innerText()==='Forschung'&&await page.locator('#commandPlanetSelect option[value=rhea]').innerText()==='Forschung & <Heimatbasis>'&&await page.locator('#commandPlanetSelect option[value=home]').innerText()==='Home base');
  }
  check('command shell uses native actions without JavaScript errors',errors.length===0,errors);
 }catch(e){failures++;console.error(e.stack);}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
 console.log(checks+' checks, '+failures+' failures');return failures?1:0;
}
module.exports={run};
