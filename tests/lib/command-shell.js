'use strict';
// The command-centre contract replaces the former horizontal rail geometry.
// It exercises the original controls and saved state, rather than a second UI model.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {SPIELDATEI,WURZEL,starteBrowser,ruhigeUhren}=require('./umgebung');
const TABS=['basis','verteidigung','forschung','flotte','expedition','karte','galaxie','allianz','offiziere','markt','punkte','fortschritt','sammlung'];
const GROUPS={kolonie:['basis','verteidigung','forschung'],erkundung:['flotte','expedition','karte','galaxie'],gemeinschaft:['allianz','offiziere','markt'],meta:['punkte','fortschritt','sammlung']};
async function run(surface='all'){
 let source=fs.readFileSync(SPIELDATEI,'utf8'),css=fs.readFileSync(path.join(WURZEL,'kepler-graphics.css'),'utf8');
 const selected=surface==='all'?['nav','hud','actions','data','status','sticky','safe']:surface.split(',');
 const fault=process.env.K7_COMMAND_FAULT||({scroll:'selection',font:'font'}[process.env.K7_NAV_FAULT])||({'compact-clipping':'labels',gains:'gains'}[process.env.K7_DENSITY_FAULT]);
 const replace=(text,old,next)=>{assert.equal(text.split(old).length,2,'unique counterexample anchor: '+old);return text.replace(old,next);};
 if(fault==='font')css+='\n.command-rail .tab-btn{font-size:8px!important}';
 if(fault==='labels')css+='\nbody.command-ui #resbar .rescard .label{position:absolute;width:1px;height:1px;overflow:hidden}';
 if(fault==='gains')css+='\nbody.command-ui #resbar .rescard .rate{display:none!important}';
 if(fault==='selection')source=replace(source,"b.addEventListener('click', ()=>switchTab(b.getAttribute('data-tab')))","b.addEventListener('click', ()=>switchTab('basis'))");
 if(fault==='focus')source=replace(source,'if(commandMenuHadFocus){const panel=', 'if(false){const panel=');
 // Reproduce the empty labels observed when a native option received rich label markup.
 if(fault==='options')source=replace(source,"escapeHtml(commandPlanetName(id))","''");
 if(fault==='queue')source=replace(source,"native.closest('.card-row').querySelector('[data-queue]')","document.querySelector('#buildings [data-queue=solar]')");
 if(fault==='layer')css+='\nbody.command-ui:has(.fleet-position-panel.fp-mobile-open) .command-status{z-index:54!important}';
 if(fault==='sticky')css+='\nbody.command-ui .hero{position:static!important}';
 if(fault==='chat-layer')css+='\nbody.command-ui #chatPanel{z-index:61!important}body.command-ui #chatPanelOverlay{z-index:60!important}';
 if(fault==='input-size')css+='\nbody.command-ui .tab-panel input{box-sizing:content-box!important;max-width:none!important}';
 if(fault==='collection-size')css+='\nbody.command-ui .gfx-collection-item > :last-child{width:100%!important;max-width:100%!important}';
 if(fault==='moon-name')source=replace(source,'return k7t("Mond von")+" "+commandPlanetName(moonParentKey(id));','return k7t(planetDisplayName(id));');
 if(fault==='status-focus')source=replace(source,"if(hadFocus)document.getElementById('commandStatusBtn')?.focus({preventScroll:true});","if(false)document.getElementById('commandStatusBtn')?.focus({preventScroll:true});");
 if(fault==='status-position')css+='\nbody.command-ui .fleet-position-panel{transform:translateY(-50%)!important}';
 if(fault==='mission-source')source=replace(source,'const missions=activeFleetMissionCount();','const missions=(currentFleet().missions||[]).length;');
 if(fault==='queue-source')source=replace(source,'const queue=(state.buildQueue||[]).length;','const queue=(state.buildQueue||[]).filter(job=>job.planet===state.activeBasePlanet).length;');
 if(fault==='queue-overlay')source=replace(source,"document.getElementById('commandQueueBtn').addEventListener('click',()=>{\n      closeFpPanel();","document.getElementById('commandQueueBtn').addEventListener('click',()=>{");
 if(fault==='value-fit')css+='\nbody.command-ui #resbar .value{letter-spacing:18px!important;white-space:nowrap!important}';
 if(fault==='safe-area'){const marker='/* Keep native PWA safe areas:';assert.equal(css.split(marker).length,2,'unique safe-area block');css=css.slice(0,css.indexOf(marker));}
 if(fault==='drawer-scroll')css=replace(css,'body.command-ui #game-root .command-rail .tabs { overflow:visible; padding:0; gap:0; flex:0 0 auto; min-height:auto; }','');
 if(fault==='status-box')source=replace(source,".observe(statusBar,{box:'border-box'})",'.observe(statusBar)');
 if(fault==='nav-alignment')css=replace(css,'body.command-ui #game-root .command-rail .tab-btn { justify-content:flex-start; }','');
 if(fault==='status-height')css+='\nbody.command-ui{--command-status-height:56px!important}';
 if(fault==='queue-offset')css+='\nbody.command-ui #buildQueueBox{scroll-margin-top:0!important}';
 // Restore both parts of the prior heading: its wider native monospace title and unwrapped row.
 if(fault==='research-wrap')css+='\nbody.command-ui #game-root .gfx-research h2{font-family:var(--font-mono)!important}body.command-ui .gfx-research .gfx-heading{flex-wrap:nowrap!important}body.command-ui .gfx-research .gfx-heading > div{max-width:none!important}body.command-ui .gfx-research .gfx-location{max-width:45%!important;text-align:right!important}';
 if(fault==='quest-clearance')css+='\n@media(max-width:900px){body.command-ui #dailyQuestBar{bottom:68px!important;left:12px!important;right:12px!important}}';
 if(fault==='quest-empty')css+='\nbody.command-ui #dailyQuestBar [data-claim-quest],body.command-ui #dailyQuestBar [data-quest-nav]{visibility:hidden!important}';
 if(fault==='quest-close')source=replace(source,"          summary.click();\n          summary.focus({preventScroll:true});","          void summary;\n          summary.focus({preventScroll:true});");
 if(fault==='quest-mobile-position')css+='\n@media(min-width:621px) and (max-width:900px){body.command-ui #dailyQuestBar{position:absolute!important;top:calc(100% + 4px)!important;bottom:auto!important;left:auto!important;right:0!important;width:min(520px,calc(100vw - 30px))!important}}';
 if(fault==='quest-hit')css+='\nbody.command-ui #dailyQuestBar [data-claim-quest],body.command-ui #dailyQuestBar [data-quest-nav]{pointer-events:none!important}';
 if(fault==='player-write')source=replace(source,"    setBoxText(document.getElementById('commandPlayerName'),state.player.name||k7t('Kommandant'));","    document.getElementById('commandPlayerName').setAttribute('translate','no');\n    setBoxText(document.getElementById('commandPlayerName'),state.player.name||k7t('Kommandant'));");
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
   fleet:{jaeger:20,cruisers:4,forscher:2,missions:[]},colonies:{rhea:{buildings:{solar:3,mine:2,lager:4},fleet:{jaeger:1,missions:[]}},moon_home:{buildings:{solar:1,lager:2},fleet:{missions:[]}},moon_rhea:{buildings:{solar:1,lager:2},fleet:{missions:[]}}},
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
   for(const width of (fault?[1487,390]:[1900,1487,1200,901,900,760,390,360,320])){
    await page.setViewportSize({width,height:844});const drawer=width<=900;
    check('menu entry follows the actual responsive layout at '+width,await page.locator('#commandMenuToggle').isVisible()===drawer);
    if(drawer)await page.locator('#commandMenuToggle').click();
    if(drawer){
     const rail=await page.locator('#commandNav').evaluate(e=>{const tabs=e.querySelector('.tabs'),s=getComputedStyle(tabs);return {railOverflow:e.scrollWidth-e.clientWidth,tabsOverflow:tabs.scrollHeight-tabs.clientHeight,flow:s.overflowY};});
     check('mobile navigation uses a single vertical drawer without clipped groups at '+width,rail.railOverflow<=1&&rail.tabsOverflow<=1&&rail.flow==='visible',rail);
     await page.locator('#commandNav').hover();await page.mouse.wheel(0,2000);await page.waitForTimeout(80);
     const last=await page.locator('.tabs [data-tab=sammlung]').evaluate(e=>{const r=e.getBoundingClientRect(),rail=document.getElementById('commandNav');return {scroll:rail.scrollTop,top:r.top,bottom:r.bottom,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
     check('all thirteen mobile sections are reachable by ordinary drawer scrolling at '+width,last.scroll>0&&last.top>=0&&last.bottom<=844&&last.hit,last);
     await page.locator('#commandNav').evaluate(e=>e.scrollTop=0);
    }
    const measures=await page.locator('.tabs .tab-btn').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {key:e.dataset.tab,font:parseFloat(s.fontSize),w:r.width,h:r.height,clipped:e.scrollWidth>e.clientWidth+2,badge:[...e.querySelectorAll('.tab-badge')].filter(b=>getComputedStyle(b).display!=='none').every(b=>{const z=b.getBoundingClientRect();return z.left>=r.left&&z.right<=r.right+1&&z.top>=r.top&&z.bottom<=r.bottom+1;})};}));
    check('navigation remains readable and badges fit at '+width,measures.length===13&&measures.every(m=>m.font>=12&&m.w>=44&&m.h>=(drawer?44:39.99)&&!m.clipped&&m.badge),measures);
    const alignment=await page.locator('.tabs .tab-btn').evaluateAll(es=>es.map(e=>e.querySelector('.tab-icon-badge').getBoundingClientRect().left-e.getBoundingClientRect().left));
    check('all thirteen navigation symbols share a consistent label alignment at '+width,alignment.length===13&&Math.max(...alignment)-Math.min(...alignment)<=1,alignment);
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
   // Measure final endgame text, rather than a transient frame of the native number tween.
   // The animation's early-frame bounds have a separate native-function regression.
   await page.emulateMedia({reducedMotion:'reduce'});
   for(const width of [1487,1200,901,760,390,360,320]){
    await page.setViewportSize({width,height:844});await page.evaluate(()=>__command.show('basis'));
    await page.evaluate(()=>{Object.assign(__command.state().resources,{energie:3.2129e9,erz:3.2098e9,kristalle:2.8683e9,deuterium:2.2683e9,antimaterie:9.284e8,forschungspunkte:5.242e8});__command.render();});
    const labels=await page.locator('#resbar .rescard .label').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:e.textContent,width:r.width,height:r.height,position:s.position,font:parseFloat(s.fontSize),visible:s.display!=='none',fit:e.scrollWidth<=e.clientWidth+1};}));
    check('six real resource labels remain visible and readable at '+width,labels.length===6&&labels.every(r=>r.visible&&r.width>10&&r.height>10&&r.position!=='absolute'&&r.font>=10&&r.fit),labels);
    const rates=await page.locator('#resbar .rate').evaluateAll(es=>es.map(e=>({text:e.textContent,visible:getComputedStyle(e).display!=='none',width:e.getBoundingClientRect().width,fit:e.scrollWidth<=e.clientWidth+1})));
    check('native production and capacity remain readable at '+width,rates.length===6&&rates.every(r=>r.visible&&r.width>10&&r.fit&&r.text.includes('/s')),rates);
    const values=await page.locator('#resbar .value').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),card=e.closest('.rescard').getBoundingClientRect(),range=document.createRange();range.selectNodeContents(e);const ink=range.getBoundingClientRect();return {text:e.firstChild?.textContent,visible:r.width>10&&r.height>10,fit:e.scrollWidth<=e.clientWidth+1&&ink.right<=card.right-1&&ink.left>=card.left};}));
    check('all six endgame resource values stay readable inside their cards at '+width,values.length===6&&values.every(v=>v.visible&&v.fit)&&values.some(v=>/M/.test(v.text)),values);
    const controls=await page.locator('.hero-bottom button,.hero-bottom select,.command-stats > summary,.command-status button').evaluateAll(es=>es.filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {id:e.id,w:r.width,h:r.height,left:r.left,right:r.right};}));
    check('visible HUD controls are touch sized and fit at '+width,controls.every(r=>r.w>=43.99&&r.h>=43.99&&r.left>=0&&r.right<=width+1),controls);
    const required=['commandPlanetSelect','commandChatBtn','headerReportsBtn','commandStatusBtn','commandQueueBtn'];
    if(width<=900)required.push('commandMenuToggle');
    check('all required HUD entry points stay visible at '+width,required.every(id=>controls.some(c=>c.id===id))&&await page.locator('#commandStats > summary').isVisible(),{required,actual:controls.map(c=>c.id)});
    await page.locator('#commandStats > summary').click();
    const chips=await page.locator('.hero-stats .hstat').evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {id:e.querySelector('[id]')?.id,visible:r.width>0&&r.height>0,fit:e.scrollWidth<=e.clientWidth+1,left:r.left,right:r.right};}));
    check('disclosed account and location metrics remain reachable at '+width,chips.length>=8&&chips.every(r=>r.visible&&r.fit&&r.left>=0&&r.right<=width+1),chips);
    await page.locator('#commandStats > summary').click();
    await page.locator('#commandQuests > summary').click();
    const questControls=page.locator('#dailyQuestBar [data-claim-quest],#dailyQuestBar [data-quest-nav]');
    check('daily quests retain their native claim controls at '+width,await page.locator('#dailyQuestBar').isVisible()&&await questControls.count()>0);
    const questHits=[];
    for(const index of [...new Set([0,await questControls.count()-1])].filter(i=>i>=0)){
     const control=questControls.nth(index);await control.scrollIntoViewIfNeeded();
     questHits.push(await control.evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
    }
    check('first and last native quest actions remain physically reachable at '+width,questHits.length>0&&questHits.every(r=>r.width>=43.99&&r.height>=43.99&&r.hit),questHits);
    await page.locator('#commandQuestsCloseBtn').click();
    await page.locator('#commandChatBtn').click();
    await page.waitForFunction(()=>{const panel=document.getElementById('chatPanel'),transform=getComputedStyle(panel).transform;return panel.classList.contains('open')&&(transform==='none'||transform==='matrix(1, 0, 0, 1, 0, 0)');});
    check('native chat is visible above the navigation at '+width,await page.locator('#chatPanelTabAlliance').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
    await page.locator('#chatPanelCloseBtn').click();
   }
   const options=await page.locator('#commandPlanetSelect option').allTextContents();
   check('location picker renders escaped names and owned moons as plain option text',JSON.stringify(options)===JSON.stringify(['Heimatbasis','Forschung & <Heimatbasis>','Mond von Heimatbasis','Mond von Forschung & <Heimatbasis>']),options);
   await page.locator('#commandStats > summary').click();
   const accountBefore=await page.locator('[data-hstat-gruppe=konto] .hstat-value').allTextContents();const localBefore=await page.locator('[data-hstat-gruppe=standort] .hstat-value').allTextContents();
   await page.locator('#commandPlanetSelect').selectOption('rhea');
   check('location picker invokes the native colony switch',await page.evaluate(()=>__command.state().activeBasePlanet==='rhea'));
   check('account metrics stay fixed while location fleet and power change',JSON.stringify(accountBefore)===JSON.stringify(await page.locator('[data-hstat-gruppe=konto] .hstat-value').allTextContents())&&JSON.stringify(localBefore)!==JSON.stringify(await page.locator('[data-hstat-gruppe=standort] .hstat-value').allTextContents()));
   await page.locator('#commandPlanetSelect').selectOption('moon_home');check('native moon switch remains available',await page.evaluate(()=>__command.state().activeBasePlanet==='moon_home'));
   await page.locator('#commandStats > summary').click();await page.locator('#commandPlanetSelect').selectOption('home');
   await page.emulateMedia({reducedMotion:'no-preference'});
  }
  if(selected.includes('actions')){
   await page.setViewportSize({width:1487,height:1058});await page.evaluate(()=>__command.show('basis'));
   check('all building definitions remain selectable once',await page.locator('#colonyVisual [data-gfx-facility]').count()===await page.evaluate(()=>__command.defs.filter(d=>d.category!=='defense').length));
   await page.locator('#colonyVisual [data-gfx-facility][data-gfx-key=mine]').click();
   await page.locator('#colonyVisual [data-gfx-queue]').click();
   check('inspector queue uses the selected building and native planet',await page.evaluate(()=>__command.state().buildQueue.some(j=>j.key==='mine'&&j.planet==='home')));
   check('status queue count follows the native pending queue',await page.locator('#commandQueueSummary').innerText()==='Bau-Warteschlange · 1');
   await page.locator('#commandPlanetSelect').selectOption('rhea');
   // Native wish-list entries may wait for resources; keep this order pending across ticks.
   await page.evaluate(()=>{Object.keys(__command.state().resources).forEach(k=>__command.state().resources[k]=0);__command.render();});
   await page.locator('#colonyVisual [data-gfx-facility][data-gfx-key=solar]').click();await page.locator('#colonyVisual [data-gfx-queue]').click();
   const orders=await page.evaluate(()=>({pending:__command.state().buildQueue,running:__command.state().constructionQueue,homeMine:__command.state().buildings.mine}));
   check('colony queue stays separate from home orders',orders.pending.some(j=>j.key==='solar'&&j.planet==='rhea')&&(orders.pending.some(j=>j.key==='mine'&&j.planet==='home')||orders.running.some(j=>j.key==='mine'&&j.planet==='home')||orders.homeMine>2),orders);
   await page.locator('#commandPlanetSelect').selectOption('home');
   const queueCount=await page.evaluate(()=>__command.state().buildQueue.length);
   check('queue summary counts orders at every location represented by its native target',queueCount>0&&await page.locator('#commandQueueSummary').innerText()==='Bau-Warteschlange · '+queueCount);
   await page.locator('#commandQueueBtn').click();check('queue shortcut opens and focuses the native queue',await page.locator('#buildQueueBox').evaluate(e=>document.activeElement===e));
  }
  if(selected.includes('data')){
   await page.setViewportSize({width:390,height:844});await page.locator('#commandPlanetSelect').selectOption('home');
   await page.evaluate(()=>{const s=__command.state();s.fleet.missions=[];s.colonies.rhea.fleet.missions=[{id:'command-rhea',type:'explore',targetId:'aion',composition:{jaeger:1},fleetName:'Rhea-Patrouille',startTime:Date.now()-60000,endTime:Date.now()+3600000}];__command.render();});
   await page.locator('#commandStatusBtn').click();
   check('fleet summary includes a native mission departing from another location',await page.locator('#commandMissionSummary').innerText()==='Flotteneinsätze · 1'&&(await page.locator('#fleetPositionList').innerText()).includes('Forschung & <Heimatbasis>'));
   await page.locator('#fpCloseBtn').click();
   await page.evaluate(()=>{const s=__command.state();s.colonies.rhea.fleet.missions=[];s.recyclerAuftraege={rhea:{heimat:'home',anzahl:1,groupId:'command-recycle'}};s.debrisFields.rhea={erz:500000};s.colonies.rhea.fleet.recycler=1;__command.render();});
   await page.locator('#commandStatusBtn').click();
   check('fleet summary includes a recycler assignment without a missions-array entry',await page.locator('#commandMissionSummary').innerText()==='Flotteneinsätze · 1'&&(await page.locator('#fleetPositionList').innerText()).includes('Recycler sammeln'));
   await page.locator('#fpCloseBtn').click();
   await page.evaluate(()=>{const s=__command.state();s.recyclerAuftraege={};s.debrisFields.rhea={};s.colonies.rhea.fleet.recycler=0;__command.render();});
   const playerWrites=await page.evaluate(()=>{const player=document.getElementById('commandPlayerName'),observer=new MutationObserver(()=>{});observer.observe(player,{attributes:true});for(let i=0;i<3;i++)__command.render();const records=observer.takeRecords().map(r=>r.attributeName);observer.disconnect();return {protected:player.getAttribute('translate')==='no',records};});
   check('player name remains protected without repeated attribute writes in a quiet HUD',playerWrites.protected&&playerWrites.records.length===0,playerWrites);
  }
  if(selected.includes('status')){
   for(const width of [390,1487]){await page.setViewportSize({width,height:844});await page.locator('#commandStatusBtn').click();
    check('status entry opens the native fleet drawer immediately at '+width,await page.locator('#fleetPositionPanel').isVisible()&&await page.locator('#commandStatusBtn').getAttribute('aria-expanded')==='true');
    if(await page.locator('#fleetPositionPanel').isVisible()){
     const placement=await page.locator('#fpCloseBtn').evaluate(e=>{const r=e.getBoundingClientRect(),p=document.getElementById('fleetPositionPanel').getBoundingClientRect();return {top:p.top,bottom:p.bottom,closeTop:r.top,closeBottom:r.bottom,closeRight:r.right,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
     check('status heading and close control remain inside the screen at '+width,placement.top>=0&&placement.bottom<=844&&placement.closeTop>=0&&placement.closeBottom<=844&&placement.closeRight<=width&&placement.hit,placement);
    }
    check('open status entry remains above its backdrop at '+width,await page.locator('#commandStatusBtn').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
    await page.setViewportSize({width:width===390?1487:390,height:844});await page.waitForTimeout(200);
    check('status remains usable across resizing at '+width,await page.locator('#fleetPositionPanel').isVisible()&&await page.locator('#fpCloseBtn').isVisible());
    await page.locator('#fpCloseBtn').focus();await page.keyboard.press('Escape');check('Escape closes the visible fleet drawer at '+width,!await page.locator('#fleetPositionPanel').isVisible()&&await page.locator('#commandStatusBtn').getAttribute('aria-expanded')==='false');
    check('closing status returns keyboard focus to its visible entry at '+width,await page.locator('#commandStatusBtn').evaluate(e=>document.activeElement===e));
    await page.locator('#commandStatusBtn').click();
    // A blocked status entry has already failed its hit guard. Avoid a blocked dependent click
    // so the controlled regression reports that finding rather than an unrelated timeout.
    const queueHit=await page.locator('#commandQueueBtn').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
    check('open status entry remains above its backdrop and queue shortcut is reachable at '+width,queueHit);
    if(queueHit){
     await page.locator('#commandQueueBtn').click();
     check('queue shortcut closes the fleet drawer and focuses the visible native queue at '+width,!await page.locator('#fleetPositionPanel').isVisible()&&await page.locator('#fpBackdrop').evaluate(e=>getComputedStyle(e).display==='none')&&await page.locator('#buildQueueBox').evaluate(e=>document.activeElement===e));
     const queuePosition=await page.evaluate(()=>({queueTop:document.getElementById('buildQueueBox').getBoundingClientRect().top,headerBottom:document.querySelector('.hero').getBoundingClientRect().bottom}));
     check('queue shortcut keeps its native heading below the sticky header at '+width,queuePosition.queueTop>=queuePosition.headerBottom,queuePosition);
    }else await page.keyboard.press('Escape');
    // Keep a deliberately broken close-on-queue case from contaminating the next viewport.
    if(await page.locator('#fleetPositionPanel').isVisible())await page.keyboard.press('Escape');
   }
  }
  if(selected.includes('sticky')){
   for(const width of (fault&&fault!=='research-wrap'?[390]:[390,320])){
   await page.setViewportSize({width,height:844});
   let actuallyScrolled=0;
   for(const key of TABS){
    await page.evaluate(key=>__command.show(key),key);
    await page.evaluate(()=>window.scrollTo(0,Math.max(0,document.documentElement.scrollHeight-innerHeight)));
    const measure=await page.locator('#commandMenuToggle').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,scroll:scrollY,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,outside:[...document.querySelectorAll('#tab-'+__command.active()+' *')].filter(x=>{const b=x.getBoundingClientRect();return b.width&&b.right>document.documentElement.clientWidth+1;}).slice(0,8).map(x=>({id:x.id,cl:x.className,right:x.getBoundingClientRect().right}))};});
    check('menu stays reachable while reading long '+key+' content at '+width,measure.top>=0&&measure.bottom<=844&&measure.hit&&measure.overflow<=2,measure);
    if(key==='forschung'){
     const heading=await page.locator('.gfx-research .gfx-heading').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height,children:[...e.children].map(c=>{const b=c.getBoundingClientRect();return {left:b.left,right:b.right,width:b.width,height:b.height,fit:c.scrollWidth<=c.clientWidth+1};})};});
     check('research title and progress fit together inside the mobile content column at '+width,heading.width>10&&heading.height>10&&heading.left>=0&&heading.right<=width+1&&heading.children.length>=2&&heading.children.every(c=>c.width>10&&c.height>10&&c.left>=heading.left-1&&c.right<=heading.right+1&&c.fit),heading);
    }
    if(measure.scroll>=300)actuallyScrolled++;
    if(measure.hit){
     await page.locator('#commandMenuToggle').click();
     check('scrolled page still opens its native menu for '+key,await page.locator('#commandNav').evaluate(e=>e.classList.contains('open')));
     await page.locator('#commandNavClose').click();
    }
   }
   check('sticky-menu checks exercise at least eight genuinely scrolled sections at '+width,actuallyScrolled>=8,actuallyScrolled);
   }
   await page.evaluate(()=>window.scrollTo(0,0));
  }
  if(selected.includes('safe')){
   for(const scenario of [{width:320,height:844,top:47,bottom:34,left:0,right:0},{width:844,height:390,top:0,bottom:21,left:44,right:44}]){
    const {width,height,top,bottom,left,right}=scenario;
    await page.setViewportSize({width,height});await page.evaluate(()=>__command.show('basis'));
    // CSS variables expose the native env() contract without depending on a desktop notch.
    const insets=await page.addStyleTag({content:`body.command-ui.command-ui{--command-safe-top:${top}px;--command-safe-bottom:${bottom}px;--command-safe-left:${left}px;--command-safe-right:${right}px;}`});
    await page.evaluate(()=>{window.scrollTo(0,0);__command.render();});await page.waitForTimeout(80);
    const actualInsets=await page.evaluate(()=>{const s=getComputedStyle(document.body);return ['top','bottom','left','right'].map(side=>parseFloat(s.getPropertyValue('--command-safe-'+side)));});
    check('PWA fixture applies all four specified safe areas at '+width,JSON.stringify(actualInsets)===JSON.stringify([top,bottom,left,right]),actualInsets);
    const entries=await page.locator('#commandMenuToggle,#commandPlanetSelect,#commandChatBtn,#commandStatusBtn,#commandQueueBtn').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {id:e.id,left:r.left,right:r.right,top:r.top,bottom:r.bottom,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
    check('native HUD entry points avoid the PWA safe areas at '+width,entries.length===5&&entries.every(r=>r.left>=left&&r.right<=width-right&&r.top>=top&&r.bottom<=height-bottom&&r.hit),{scenario,entries});
    await page.locator('#commandStatusBtn').click();
    const drawers=await page.evaluate(()=>{const panel=document.getElementById('fleetPositionPanel').getBoundingClientRect(),status=document.querySelector('.command-status').getBoundingClientRect();return {panel:panel.toJSON(),status:status.toJSON(),padding:parseFloat(getComputedStyle(document.querySelector('.shell-inner')).paddingBottom)};});
    check('fleet drawer and content clearance follow the actual status height at '+width,drawers.panel.top>=top&&drawers.panel.right<=width-right&&drawers.panel.bottom<=drawers.status.top+0.01&&drawers.padding>=drawers.status.height+19.99,{scenario,drawers});
    await page.locator('#fpCloseBtn').click();
    await page.locator('#commandQuests > summary').click();
    const questPlacement=await page.locator('#dailyQuestBar').evaluate(e=>{
     const visible=el=>{for(let p=el;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility!=='visible'||+s.opacity<=0)return false;}const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
     const r=e.getBoundingClientRect(),status=document.querySelector('.command-status').getBoundingClientRect();
     return {visible:visible(e),width:r.width,height:r.height,controls:[...e.querySelectorAll('[data-claim-quest],[data-quest-nav]')].filter(visible).length,left:r.left,right:r.right,bottom:r.bottom,statusTop:status.top};
    });
    check('daily quests clear the actual status bar and horizontal PWA safe areas at '+width,questPlacement.visible&&questPlacement.width>20&&questPlacement.height>20&&questPlacement.controls>0&&questPlacement.left>=left+11.99&&questPlacement.right<=width-right-11.99&&questPlacement.bottom<=questPlacement.statusTop-11.99,{scenario,questPlacement});
    await page.waitForFunction(()=>{const e=document.getElementById('commandQuestsCloseBtn');if(!e)return false;getComputedStyle(e).transform;return e.getAnimations().every(a=>!(a instanceof CSSTransition&&a.transitionProperty==='transform'&&a.playState!=='finished'));});
    const questClose=await page.locator('#commandQuestsCloseBtn').evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
    check('daily quests provide a reachable native close action at '+width,questClose.width>=43.99&&questClose.height>=43.99&&questClose.hit,questClose);
    await page.locator('#commandQuestsCloseBtn').click();
    const questClosed=await page.locator('#commandQuests').evaluate(e=>({closed:!e.open,focused:document.activeElement===e.querySelector('summary')}));
    check('daily quest close action closes its details and restores summary focus at '+width,questClosed.closed&&questClosed.focused,questClosed);
    // Preserve all later guards when the controlled close-forwarding fault keeps the popup open.
    if(!questClosed.closed)await page.locator('#commandQuests > summary').press('Space');
    await page.locator('#commandMenuToggle').click();
    const close=await page.locator('#commandNavClose').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,left:r.left,bottom:r.bottom,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
    check('mobile drawer close control avoids the PWA safe areas at '+width,close.top>=top&&close.left>=left&&close.bottom<=height-bottom&&close.hit,close);
    await page.locator('#commandNavClose').click();await insets.evaluate(e=>e.remove());
   }
  }
  if(surface==='all'||surface==='english'){
   await boot(origin+'/?lang=en');
   check('English navigation translates the new section names',JSON.stringify(await page.locator('.tab-gruppe-titel').allTextContents())===JSON.stringify(['Colony','Operations','Empire','Achievements']));
   check('English mode preserves player owned names and translates the default home option',await page.locator('#commandPlayerName').innerText()==='Forschung'&&await page.locator('#commandPlanetSelect option[value=rhea]').innerText()==='Forschung & <Heimatbasis>'&&await page.locator('#commandPlanetSelect option[value=home]').innerText()==='Home base'&&await page.locator('#commandPlanetSelect option[value=moon_rhea]').innerText()==='Moon of Forschung & <Heimatbasis>'&&await page.locator('#commandMenuToggle').getAttribute('aria-label')==='Open menu');
  }
  check('command shell uses native actions without JavaScript errors',errors.length===0,errors);
 }catch(e){failures++;console.error(e.stack);}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
 console.log(checks+' checks, '+failures+' failures');return failures?1:0;
}
module.exports={run};
