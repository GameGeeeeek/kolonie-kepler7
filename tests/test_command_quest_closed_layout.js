'use strict';
// A real classic scrollbar exposes long research names beyond the 305px document.
// Native closed <details> can separately retain descendant layout boxes in Chromium.
// Exercise the actual controls; neither the viewport nor game mechanisms are rewritten.
const fs=require('node:fs'),path=require('node:path');
const {starteBrowser,SPIELDATEI,SPIEL_URL,WURZEL,ruhigeUhren,versionAbfangen}=require('./lib/umgebung');
const source=fs.readFileSync(SPIELDATEI,'utf8');
const cssFile=process.env.K7_QUEST_CLOSED_CSS || path.join(WURZEL,'kepler-graphics.css');
const tabs=['basis','verteidigung','forschung','flotte','expedition','karte','galaxie','allianz','offiziere','markt','punkte','fortschritt','sammlung'];
let checks=0,failures=0,browser;
const check=(name,ok,data)=>{checks++;if(!ok)failures++;console.log((ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data)));};
const fixture={...ruhigeUhren(),tutorialSeen:true,newbieWelcomeSeen:true,seenTabHints:Object.fromEntries(tabs.map(k=>[k,true])),
 resources:{energie:90000,erz:90000,kristalle:90000,deuterium:60000,antimaterie:5000,forschungspunkte:3000},
 buildings:{solar:8,mine:2,raffinerie:4,synth:3,lager:25,labor:5,habitat:2,werftkern:3},
 research:{rkampf:1,rkolonisation:1},fleet:{jaeger:20,cruisers:4,forscher:2,missions:[]},colonies:{},
 activeBasePlanet:'home',player:{id:'u',name:'Questlayout'},battlePoints:0,xp:64000,lastTick:Date.now()-60000,
 lastLoginDate:new Date().toDateString(),lastSeenVersion:source.match(/const VERSION\s*=\s*['"]([^'"]+)/)[1],
 dailyQuests:{date:new Date().toDateString(),activeKeys:['research','trade','npc','expedition'],claimed:{},researchCount:0,tradeCount:0,startNpcKills:0,startExpeditions:0}};
const store={'kepler7-save-v3':JSON.stringify(fixture)};

(async()=>{
 try{
  // Playwright normally supplies --hide-scrollbars. Removing that flag restores the host's
  // native scrollbar and its real client-width reduction; no CSS width is fabricated.
  browser=await starteBrowser({ignoreDefaultArgs:['--hide-scrollbars']});
  const context=await browser.newContext({viewport:{width:320,height:844},isMobile:false,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await versionAbfangen(page);
  await page.route('**/kepler-graphics.css*',r=>r.fulfill({status:200,contentType:'text/css',body:fs.readFileSync(cssFile,'utf8')}));
  await page.route('**/api/**',r=>{
   const req=r.request(),p=new URL(req.url()).pathname.split('/api/')[1],j=(value,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
   if(p==='health')return j({ok:true});
   if(p==='me')return j({userId:'u',username:'Questlayout',homeSystem:'kepler',homeSlot:0,hasEmail:true});
   if(p.startsWith('storage/')){const key=decodeURIComponent(p.slice(8));if(['PUT','POST'].includes(req.method())){store[key]=JSON.parse(req.postData()||'{}').value;return j({ok:true,version:1});}return store[key]===undefined?j({},404):j({value:store[key],version:1});}
   if(/reports|leaderboard|messages|ranking|wars|halloffame|bounty|friends/.test(p))return j([]);
   return j({});
  });
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','quest-layout-test'));
  await page.goto(SPIEL_URL);
  await page.waitForFunction(()=>document.getElementById('loadstate')?.textContent.includes('Spielstand automatisch geladen'));
  await page.locator('#welcomeBackDismissBtn').waitFor({state:'visible'});
  await page.locator('#welcomeBackDismissBtn').click();
  await page.locator('#welcomeBackOverlay').waitFor({state:'hidden'});
  check('saved quest fixture loads through the native welcome exit at 320',await page.locator('#commandPlayerName').innerText()==='Questlayout'&&await page.locator('#commandMenuToggle').isVisible());

  for(const [position,key,target] of [['first','research','forschung'],['last','expedition','expedition']]){
   await page.locator('#commandQuests > summary').click();
   const opened=await page.locator('#commandQuests').evaluate(e=>{const p=e.querySelector('#dailyQuestBar'),r=p.getBoundingClientRect(),controls=[...p.querySelectorAll('[data-quest-nav]')];return {open:e.open,width:r.width,height:r.height,keys:controls.map(c=>c.dataset.questNav),notes:p.querySelectorAll('.k7-touch-note').length};});
   check('native quest popup opens before the '+position+' action at 320',opened.open&&opened.width>20&&opened.height>20&&JSON.stringify(opened.keys)===JSON.stringify(fixture.dailyQuests.activeKeys)&&opened.notes>0,opened);
   const control=page.locator('#dailyQuestBar [data-quest-nav]').nth(position==='first'?0:3);
   await control.scrollIntoViewIfNeeded();
   const hit=await control.evaluate(e=>{const r=e.getBoundingClientRect();return {key:e.dataset.questNav,width:r.width,height:r.height,x:r.x+r.width/2,y:r.y+r.height/2,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
   check('native '+position+' quest action is physically reachable at 320',hit.key===key&&hit.width>=43.99&&hit.height>=43.99&&hit.hit,hit);
   await control.click();
   await page.locator('#tab-'+target).waitFor({state:'visible'});
   check('native '+position+' quest action opens its actual target at 320',await page.locator('.tab-btn[data-tab='+target+']').evaluate(e=>e.classList.contains('active')));
   await page.locator('#commandQuestsCloseBtn').click();
   const closed=await page.locator('#commandQuests').evaluate(e=>({closed:!e.open,focus:document.activeElement===e.querySelector('summary')}));
   check('native popup close restores summary focus after the '+position+' action at 320',closed.closed&&closed.focus,closed);
  }

  await page.locator('#commandMenuToggle').click();
  await page.locator('#commandNav .tab-btn[data-tab=forschung]').click();
  await page.locator('#tab-forschung').waitFor({state:'visible'});
  check('native menu returns to the real research panel at 320',await page.locator('#commandNav').evaluate(e=>!e.classList.contains('open'))&&await page.locator('#tab-forschung').evaluate(e=>e.classList.contains('active')));
  await page.evaluate(()=>window.scrollTo(0,0));
  const geometry=await page.evaluate(()=>({viewport:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,height:innerHeight,documentHeight:document.documentElement.scrollHeight,scrollbar:innerWidth-document.documentElement.clientWidth}));
  check('research uses a genuine native classic scrollbar at 320',geometry.viewport===320&&geometry.client>0&&geometry.client<geometry.viewport&&geometry.scrollbar>0&&geometry.documentHeight>geometry.height,geometry);
  const closedLayout=await page.locator('#commandQuests').evaluate(e=>{
   const p=e.querySelector('#dailyQuestBar'),zero=el=>{const r=el.getBoundingClientRect();return {rects:el.getClientRects().length,width:r.width,height:r.height,left:r.left,top:r.top,right:r.right,bottom:r.bottom};};
   return {closed:!e.open,popup:zero(p),notes:[...p.querySelectorAll('.k7-touch-note')].map(zero)};
  });
  const zero=r=>r.rects===0&&['width','height','left','top','right','bottom'].every(k=>r[k]===0);
  check('closed native daily quest popup has no retained layout boxes at 320',closedLayout.closed&&closedLayout.notes.length>0&&zero(closedLayout.popup)&&closedLayout.notes.every(zero),closedLayout);
  const names=await page.locator('#research .bname').evaluateAll(es=>es.filter(e=>{
   for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility!=='visible'||+s.opacity<=0)return false;}
   const r=e.getBoundingClientRect();return r.width>0&&r.height>0;
  }).map(e=>({text:e.textContent.trim(),width:e.clientWidth,scroll:e.scrollWidth,height:e.getBoundingClientRect().height})));
  check('research renders positive real names including an unbroken long word at 320',names.length>=10&&names.every(n=>n.text&&n.width>20&&n.height>0)&&names.some(n=>n.text.split(/\s+/).some(w=>w.length>=16)),{count:names.length,longest:names.map(n=>n.text).sort((a,b)=>b.length-a.length).slice(0,4)});
  check('all visible native research names fit their own content boxes at 320',names.length>=10&&names.every(n=>n.width>20&&n.height>0&&n.scroll<=n.width+1),names.filter(n=>n.scroll>n.width+1));
  const documentFit=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  check('research content has no horizontal overflow within the real client width at 320',documentFit.client>0&&documentFit.scroll<=documentFit.client,documentFit);
  check('native quest layout actions complete without JavaScript errors',errors.length===0,errors);
 }catch(error){failures++;console.error(error.stack);}
 finally{if(browser)await browser.close();}
 console.log(checks+' checks, '+failures+' failures');process.exitCode=failures?1:0;
})();
