'use strict';
// Change the real player option and exercise the original navigation nodes. API fixtures
// provide two independent accounts; no game state, timers or click handlers are replaced.
const fs=require('node:fs');
const {starteBrowser,SPIELDATEI,SPIEL_URL,ruhigeUhren,versionAbfangen}=require('./lib/umgebung');
const TABS=['basis','verteidigung','forschung','flotte','expedition','karte','galaxie','allianz','offiziere','markt','punkte','fortschritt','sammlung'];
const KEY='kepler7-save-v3',source=fs.readFileSync(SPIELDATEI,'utf8');
const version=source.match(/\bconst VERSION\s*=\s*['"]([^'"]+)['"]/);
if(!version)throw Error('Native VERSION anchor missing');
const accounts={
 a:{id:'11111111-1111-4111-8111-111111111111',name:'MenupilotA'},
 b:{id:'22222222-2222-4222-8222-222222222222',name:'MenupilotB'}
};
const fixture=account=>JSON.stringify({...ruhigeUhren(),tutorialSeen:true,newbieWelcomeSeen:true,
 seenTabHints:Object.fromEntries([...TABS,'einstellungen','hilfe','berichte'].map(k=>[k,true])),soundOn:false,
 resources:{energie:90000,erz:90000,kristalle:90000,deuterium:60000,antimaterie:5000,forschungspunkte:3000},
 buildings:{solar:8,mine:2,raffinerie:4,synth:3,lager:25,labor:5,habitat:2,werftkern:3},
 research:{rkampf:1,rkolonisation:1},fleet:{jaeger:20,cruisers:4,forscher:2,missions:[]},colonies:{},
 activeBasePlanet:'home',player:{id:account.id,name:account.name},xp:64000,battlePoints:1000,
 lastTick:Date.now()-60000,lastLoginDate:new Date().toDateString(),lastSeenVersion:version[1]});
const stores={a:{[KEY]:fixture(accounts.a)},b:{[KEY]:fixture(accounts.b)}},versions={a:{},b:{}};
let current='a',invalidLoadedMenu=false,browser,checks=0,failures=0;
const writes=[],errors=[];
const check=(name,ok,data)=>{checks++;if(!ok)failures++;console.log((ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data)));};
const saved=account=>JSON.parse(stores[account][KEY]);
const waitFor=async predicate=>{
 const until=Date.now()+5000;
 while(!await predicate()&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,20));
 // The caller records the real result. A failed expectation must not abort later guards.
};
async function bootExit(page,name){
 await page.waitForFunction(expected=>document.getElementById('commandPlayerName')?.textContent===expected&&
  document.getElementById('loadstate')?.textContent.includes('Spielstand automatisch geladen'),name);
 const welcome=page.locator('#welcomeBackDismissBtn');
 await welcome.waitFor({state:'visible'});await welcome.click();
 await page.locator('#welcomeBackOverlay').waitFor({state:'hidden'});
 await page.locator('#loginOverlay').waitFor({state:'hidden'});
}
async function settings(page,hitGuard=null){
 // Reuse a settings panel already reached through a native action. Re-clicking its
 // entry is unnecessary preparation for changing a second option in that panel.
 const alreadyOpen=await page.locator('#tab-einstellungen').evaluate(e=>e.classList.contains('active'));
 if(!alreadyOpen||hitGuard){
  const toggle=page.locator('#commandMenuToggle');
  if(await toggle.isVisible()&&!await page.locator('#commandNav').evaluate(e=>e.classList.contains('open')))await toggle.click();
  const entry=page.locator('#commandAccountBtn');await entry.scrollIntoViewIfNeeded();
  const pointer=await entry.evaluate(e=>{
  const rect=node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {top:r.top,bottom:r.bottom,left:r.left,
   right:r.right,width:r.width,height:r.height,position:s.position,display:s.display,zIndex:s.zIndex,minHeight:s.minHeight};};
  const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),nav=document.getElementById('commandNav');
  return {body:document.body.className,hit:e.contains(hit),cover:hit?.id||hit?.className,account:rect(e),
   tabs:rect(nav.querySelector('.tabs')),last:rect(nav.querySelector('[data-tab=sammlung]')),nav:rect(nav),
   scrollTop:nav.scrollTop,scrollHeight:nav.scrollHeight,clientHeight:nav.clientHeight};
  });
  console.log('WITNESS - native account entry before pointer | '+JSON.stringify(pointer));
  if(hitGuard)check(hitGuard,pointer.hit&&pointer.account.width>=44&&pointer.account.height>=44&&
   pointer.nav.width>100&&pointer.nav.height>40,pointer);
  if(hitGuard&&!pointer.hit){
   // Keep the pointer regression red. A covered native button can still be used
   // through its actual keyboard action, so later independent guards remain measured.
   console.log('WITNESS - recorded account pointer failure; continuing through native focus and Enter');
   await entry.focus();await page.keyboard.press('Enter');
  }else await entry.click();
 }
 await page.locator('#tab-einstellungen').waitFor({state:'visible'});
 if(!await page.locator('#commandMenuPosition').isVisible()){
  await page.locator('#tab-einstellungen .prog-section[data-sec=anzeige] [data-sec-toggle=anzeige]').click();
 }
 await page.locator('#commandMenuPosition').waitFor({state:'visible'});
}
async function choose(page,value){
 await settings(page);const select=page.locator('#commandMenuPosition');
 await select.focus();await select.selectOption(value);
 await waitFor(()=>saved(current).uiMenuPosition===value);
}
async function layout(page){
 return page.evaluate(()=>{
  const nav=document.getElementById('commandNav'),toggle=document.getElementById('commandMenuToggle'),r=nav.getBoundingClientRect();
  const style=getComputedStyle(nav),hero=document.querySelector('.shell-inner > .hero'),h=hero.getBoundingClientRect();
  return {top:document.body.classList.contains('command-menu-top'),parent:nav.parentElement.className,
   followsHero:nav.previousElementSibling===hero,position:style.position,left:r.left,right:r.right,width:r.width,height:r.height,
   heroBottom:h.bottom,open:nav.classList.contains('open'),backdrop:document.getElementById('commandNavBackdrop').hidden,
   expanded:toggle.getAttribute('aria-expanded'),toggleVisible:!!toggle.getClientRects().length&&getComputedStyle(toggle).display!=='none',
   client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
   headerHeight:h.height,stickyHeight:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--leisten-hoehe'))};
 });
}
async function centerSettled(control){
 // Short displays have a fixed status footer. Complete native centered scrolling
 // before the original physical hit guard; no handler or layout is changed.
 await control.evaluate(e=>e.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
 await control.evaluate(e=>new Promise((resolve,reject)=>{
  const start=performance.now();let previous='',since=start;
  const frame=()=>{
   if(!e.isConnected)return reject(Error('Native short-display control detached while settling'));
   const r=e.getBoundingClientRect(),status=document.querySelector('.command-status')?.getBoundingClientRect();
   const value=JSON.stringify([r.x,r.y,r.width,r.height,scrollX,scrollY,status?.top]);
   const now=performance.now();if(value!==previous){previous=value;since=now;}
   if(now-since>=200)return resolve();
   if(now-start>=3000)return reject(Error('Native short-display geometry did not settle'));
   requestAnimationFrame(frame);
  };requestAnimationFrame(frame);
 }));
}
async function tabActions(page,label,drawer){
 const membership=await page.locator('#commandNav .tab-btn').evaluateAll(es=>es.map(e=>e.dataset.tab));
 const all=await page.locator('.tab-btn').evaluateAll(es=>es.map(e=>e.dataset.tab));
 check(label+' preserves exactly the thirteen original sections without duplicate controls',
  JSON.stringify(membership)===JSON.stringify(TABS)&&all.length===13&&new Set(all).size===13,{membership,total:all.length});
 for(const key of TABS){
  if(drawer)await page.locator('#commandMenuToggle').click();
  const control=page.locator('#commandNav .tab-btn[data-tab='+key+']');await control.scrollIntoViewIfNeeded();
  const hit=await control.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {
   hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),w:r.width,h:r.height,font:parseFloat(s.fontSize),
   fit:e.scrollWidth<=e.clientWidth+1,visible:r.width>0&&r.height>0&&s.visibility==='visible'};});
  await control.click();await page.locator('#tab-'+key).waitFor({state:'visible'});
  const native=await page.evaluate(k=>({panel:document.getElementById('tab-'+k).classList.contains('active'),
   active:[...document.querySelectorAll('.tab-btn.active')].map(e=>e.dataset.tab),
   current:document.querySelector('.tab-btn[data-tab="'+k+'"]').getAttribute('aria-current'),
   drawerClosed:!document.getElementById('commandNav').classList.contains('open')&&
    document.getElementById('commandMenuToggle').getAttribute('aria-expanded')==='false',
   focus:document.activeElement===document.getElementById('tab-'+k)}),key);
  check(label+' native pointer opens '+key,hit.visible&&hit.hit&&hit.w>=43.99&&hit.h>=43.99&&hit.font>=12&&hit.fit&&
   native.panel&&JSON.stringify(native.active)===JSON.stringify([key])&&native.current==='page'&&
   (!drawer||native.drawerClosed&&native.focus),{hit,native});
 }
}
async function login(page,account){
 await page.locator('#loginOverlay').waitFor({state:'visible'});
 await page.locator('[data-ll-open=login]').first().click();
 await page.locator('#loginUsername').fill(accounts[account].name);
 await page.locator('#loginPassword').fill('native-menu-fixture');
 await page.locator('#loginSubmitBtn').click();await bootExit(page,accounts[account].name);
}
async function logout(page){
 await settings(page);page.once('dialog',dialog=>dialog.accept());
 await page.locator('#logoutBtn').click();await page.locator('#loginOverlay').waitFor({state:'visible'});
}
(async()=>{
 try{
  browser=await starteBrowser();const context=await browser.newContext({viewport:{width:1487,height:1058},serviceWorkers:'block'});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await versionAbfangen(page);
  if(process.env.K7_MENU_POSITION_CSS)await page.route('**/kepler-graphics.css*',route=>route.fulfill({status:200,
   contentType:'text/css',body:fs.readFileSync(process.env.K7_MENU_POSITION_CSS,'utf8')}));
  await context.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url()),p=url.pathname.slice(url.pathname.indexOf('/api/')+5);
   const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
   if(p==='health')return json({ok:true});
   if(p==='logout'){writes.push({kind:'logout',account:current});current=null;return json({ok:true});}
   if(p==='login'){
    const input=JSON.parse(request.postData()||'{}'),account=Object.keys(accounts).find(k=>accounts[k].name===input.username);
    if(!account)return json({error:'Unknown fixture account'},401);current=account;
    writes.push({kind:'login',account});return json({userId:accounts[account].id,username:accounts[account].name});
   }
   if(!current)return json({error:'No fixture session'},401);
   if(p==='me')return json({userId:accounts[current].id,username:accounts[current].name,homeSystem:'kepler',homeSlot:0,
    hasEmail:true,wantsPatchnotes:false});
   if(p==='storage-list')return json({keys:Object.keys(stores[current]).filter(key=>key.startsWith(url.searchParams.get('prefix')||''))});
   if(p.startsWith('storage/')){
    const key=decodeURIComponent(p.slice(8)),account=current;
    if(['PUT','POST'].includes(request.method())){
     const body=JSON.parse(request.postData()||'{}');stores[account][key]=body.value;versions[account][key]=(versions[account][key]||1)+1;
     if(key===KEY)writes.push({kind:'save',account,position:saved(account).uiMenuPosition});
     return json({ok:true,version:versions[account][key]});
    }
    if(stores[account][key]===undefined)return json({},404);
    // Every real load receives a minute-old server fixture. Decorating the GET response
    // prevents a legitimate unload save from removing the guaranteed delayed welcome;
    // menu values and all captured native PUT data remain untouched.
    let value=stores[account][key];
    if(key===KEY)value=JSON.stringify({...JSON.parse(value),lastTick:Date.now()-60000,
     ...(invalidLoadedMenu&&account==='a'?{uiMenuPosition:'sideways'}:{})});
    return json({key,value,version:versions[account][key]||1});
   }
   if(p.includes('pending-rewards'))return json({reward:null});
   if(/reports|leaderboard|messages|ranking|wars|halloffame|bounty|friends/.test(p))return json([]);
   return json({});
  });
  await page.goto(SPIEL_URL);await bootExit(page,accounts.a.name);await settings(page);
  check('a saved account without a menu preference defaults to the existing left menu',
   await page.locator('#commandMenuPosition').inputValue()==='left'&&!(await layout(page)).top);
  const options=await page.locator('#commandMenuPosition option').evaluateAll(es=>es.map(e=>({value:e.value,text:e.textContent.trim()})));
  check('native menu choice exposes exactly two named options',options.length===2&&JSON.stringify(options.map(o=>o.value))===JSON.stringify(['left','top'])&&options.every(o=>o.text),options);
  await page.evaluate(()=>{window.__menuOriginalNodes={nav:document.getElementById('commandNav'),
   tabs:[...document.querySelectorAll('#commandNav .tab-btn')],account:document.getElementById('commandAccountBtn')};});
  await choose(page,'top');
  check('native top choice updates layout and keeps the focused select', (await layout(page)).top&&
   await page.locator('#commandMenuPosition').evaluate(e=>document.activeElement===e));
  const initialIdentity=await page.evaluate(()=>{const old=window.__menuOriginalNodes;return old.nav===document.getElementById('commandNav')&&
   old.account===document.getElementById('commandAccountBtn')&&old.tabs.length===13&&
   old.tabs.every((node,i)=>node===document.querySelectorAll('#commandNav .tab-btn')[i]);});
  check('the first top switch moves the thirteen native controls without cloning them',initialIdentity);
  check('native top choice is saved in this actual account',saved('a').uiMenuPosition==='top'&&writes.some(w=>w.kind==='save'&&w.account==='a'&&w.position==='top'),writes.slice(-3));
  await page.reload();await bootExit(page,accounts.a.name);await settings(page);
  check('a real reload restores the saved top menu',await page.locator('#commandMenuPosition').inputValue()==='top'&&(await layout(page)).top);
  // Record a failed restore first, then use the actual select to complete all navigation guards.
  if(await page.locator('#commandMenuPosition').inputValue()!=='top')await choose(page,'top');
  await page.evaluate(()=>{window.__menuOriginalNodes={nav:document.getElementById('commandNav'),
   tabs:[...document.querySelectorAll('#commandNav .tab-btn')],account:document.getElementById('commandAccountBtn')};});
  for(const width of [1487,756,390,320]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>window.scrollTo(0,0));
   // Let the native ResizeObserver and its dependent layout finish; do not rewrite
   // heights or wait for a particular expected value (the counterexample must stay red).
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const geometry=await layout(page);
   check('top menu occupies real document flow after the header at '+width,geometry.top&&geometry.followsHero&&
    geometry.parent.includes('shell-inner')&&['static','relative','sticky'].includes(geometry.position)&&geometry.width>100&&geometry.height>40&&
    geometry.left>=0&&geometry.right<=geometry.client+1&&geometry.scroll<=geometry.client+1,geometry);
   check('top menu has no mobile drawer or hidden backdrop at '+width,!geometry.open&&geometry.backdrop&&geometry.expanded==='false'&&!geometry.toggleVisible,geometry);
   check('top menu sticky clearance includes both real header and menu heights at '+width,
    geometry.headerHeight>20&&geometry.height>40&&Math.abs(geometry.stickyHeight-(Math.round(geometry.headerHeight)+Math.round(geometry.height)))<=1,geometry);
   const fit=await page.locator('#commandNav').evaluate(e=>{const r=e.getBoundingClientRect(),tabs=e.querySelector('.tabs');return {
    railClient:e.clientWidth,railScroll:e.scrollWidth,scrollLeft:e.scrollLeft,tabsClient:tabs.clientWidth,tabsScroll:tabs.scrollWidth,
    controls:[...e.querySelectorAll('.tab-btn')].map(b=>{const q=b.getBoundingClientRect();return {key:b.dataset.tab,
     left:q.left-r.left,right:q.right-r.right,width:q.width,fit:b.scrollWidth<=b.clientWidth+1};})};});
   check('top menu thirteen controls fit the real rail without hidden horizontal scrolling at '+width,
    fit.controls.length===13&&fit.railClient>100&&fit.tabsClient>100&&fit.railScroll<=fit.railClient+1&&
    fit.tabsScroll<=fit.tabsClient+1&&fit.scrollLeft===0&&fit.controls.every(c=>c.left>=-1&&c.right<=1&&c.fit),fit);
   await tabActions(page,'top '+width,false);
  }
  for(const [width,height] of [[844,390],[390,360]]){
   await page.setViewportSize({width,height});
   const tab=page.locator('#commandNav .tab-btn[data-tab=basis]');await centerSettled(tab);await tab.click();
   await page.locator('#tab-basis').waitFor({state:'visible'});
   const control=page.locator('#colonyVisual [data-gfx-build=building][data-gfx-key=mine]');
   await centerSettled(control);
   const hit=await control.evaluate(e=>{const r=e.getBoundingClientRect(),p=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),
    nav=document.getElementById('commandNav').getBoundingClientRect(),hero=document.querySelector('.hero').getBoundingClientRect();
    return {exists:!!e,enabled:!e.disabled,w:r.width,h:r.height,x:r.x+r.width/2,y:r.y+r.height/2,
     hit:e.contains(p),cover:p?.id||p?.className,scrollY:window.scrollY,nav:{top:nav.top,bottom:nav.bottom,height:nav.height},
     hero:{top:hero.top,bottom:hero.bottom,height:hero.height},viewport:{width:innerWidth,height:innerHeight}};});
   const oldLevel=saved('a').buildings.mine;
   if(hit.hit&&hit.enabled){await control.click();await waitFor(()=>saved('a').buildings.mine===oldLevel+1);}
   check('top '+width+'x'+height+' native basis build remains physically reachable on a short display',
    hit.enabled&&hit.w>=43.99&&hit.h>=43.99&&hit.hit&&saved('a').buildings.mine===oldLevel+1,{...hit,oldLevel,newLevel:saved('a').buildings.mine});
  }
  await page.setViewportSize({width:320,height:844});
  await settings(page,'top account entry remains physically reachable after short and 320px resizes');
  await page.locator('#soundToggleRow').focus();
  console.log('WITNESS - native keyboard action before Enter | '+JSON.stringify(await page.locator('#soundToggleRow').evaluate(e=>({
   focus:document.activeElement===e,role:e.getAttribute('role'),pressed:e.getAttribute('aria-pressed'),on:e.querySelector('.toggle-switch').classList.contains('on')}))));
  await page.keyboard.press('Enter');
  // The existing renderer synchronizes aria-pressed before drawing the changed switch.
  // Observe the following real tick as well as the real native save, without freezing it.
  await waitFor(async()=>saved('a').soundOn===true&&await page.locator('#soundToggleRow').getAttribute('aria-pressed')==='true');
  check('top menu keeps the original keyboard settings action and saved state',saved('a').soundOn===true&&
   await page.locator('#soundToggleRow').getAttribute('aria-pressed')==='true',{
    soundOn:saved('a').soundOn,pressed:await page.locator('#soundToggleRow').getAttribute('aria-pressed')});
  await page.setViewportSize({width:390,height:844});await choose(page,'left');
  const left=await layout(page);
  check('native left choice restores its drawer and focused select',!left.top&&left.toggleVisible&&!left.open&&left.backdrop&&
   await page.locator('#commandMenuPosition').evaluate(e=>document.activeElement===e),left);
  const identity=await page.evaluate(()=>{const old=window.__menuOriginalNodes;return {
   nav:old.nav===document.getElementById('commandNav'),account:old.account===document.getElementById('commandAccountBtn'),
   tabs:old.tabs.length===13&&old.tabs.every((node,i)=>node===document.querySelectorAll('#commandNav .tab-btn')[i])};});
  check('switching position preserves every original navigation node and handler',identity.nav&&identity.account&&identity.tabs,identity);
  await tabActions(page,'left 390',true);
  await page.locator('#commandMenuToggle').click();await page.keyboard.press('Escape');
  check('left drawer Escape restores its visible entry focus',await page.locator('#commandMenuToggle').evaluate(e=>
   document.activeElement===e&&e.getAttribute('aria-expanded')==='false')&&await page.locator('#commandNavBackdrop').getAttribute('hidden')!==null);
  await page.locator('#commandMenuToggle').click();await page.locator('#commandNavClose').focus();await page.keyboard.press('Shift+Tab');
  check('left drawer retains its original reverse focus trap',await page.locator('#commandAccountBtn').evaluate(e=>document.activeElement===e));
  await page.keyboard.press('Tab');
  check('left drawer retains its original forward focus trap',await page.locator('#commandNavClose').evaluate(e=>document.activeElement===e));
  await page.locator('#commandNavBackdrop').click({position:{x:350,y:400}});
  check('left drawer still closes through a real backdrop pointer',await page.locator('#commandMenuToggle').getAttribute('aria-expanded')==='false');
  await choose(page,'left');await page.reload();await bootExit(page,accounts.a.name);await settings(page);
  check('a real reload also restores the explicitly saved left menu',saved('a').uiMenuPosition==='left'&&
   await page.locator('#commandMenuPosition').inputValue()==='left'&&!(await layout(page)).top);
  await choose(page,'top');await page.setViewportSize({width:1487,height:1058});await logout(page);await login(page,'b');await settings(page);
  check('a native account change uses the second account default without inheriting top',current==='b'&&
   await page.locator('#commandPlayerName').innerText()===accounts.b.name&&await page.locator('#commandMenuPosition').inputValue()==='left'&&
   !(await layout(page)).top,{position:await page.locator('#commandMenuPosition').inputValue(),account:current});
  check('native account switching keeps the first account saved preference intact',saved('a').uiMenuPosition==='top'&&
   writes.some(w=>w.kind==='logout'&&w.account==='a')&&writes.some(w=>w.kind==='login'&&w.account==='b'),writes.filter(w=>w.kind!=='save'));
  await logout(page);await login(page,'a');await settings(page);
  check('native login restores the first account own top preference',current==='a'&&
   await page.locator('#commandMenuPosition').inputValue()==='top'&&(await layout(page)).top);
  // Invalid historical input is supplied in the real GET after the unload save, then
  // loaded through the native normalization path rather than a live-state overwrite.
  invalidLoadedMenu=true;
  await page.reload();await bootExit(page,accounts.a.name);await settings(page);
  check('an unsupported saved menu value falls back to the existing left menu',
   await page.locator('#commandMenuPosition').inputValue()==='left'&&!(await layout(page)).top);
  check('all real menu position pointer and keyboard actions complete without JavaScript errors',errors.length===0,errors);
 }catch(error){failures++;console.error(error.stack);}
 finally{if(browser)await browser.close();}
 console.log(checks+' checks, '+failures+' failures');
 console.log(failures?'FAIL - Command menu position':'OK - Command menu position');process.exitCode=failures?1:0;
})();
