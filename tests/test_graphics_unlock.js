'use strict';
// Real native HTTP saves, controls and pointer events. The saved game is observed
// through its normal PUTs; no exported runtime, forced clicks or fake clocks.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {SPIELDATEI,WURZEL}=require('./lib/spieldatei'),{starteBrowser,ruhigeUhren}=require('./lib/umgebung');
const labels={
 boot:'the real authenticated save loads with all thirteen original native tabs',
 selected:'the original reactor catalogue pointer selects its native graphic inspector',
 twoAction:'two Urmaterie expose the enabled original unlock action in the graphic inspector',
 twoUnlock:'the graphic unlock consumes exactly one Urmaterie and persists the flag without building',
 twoUnlockEvent:'the real graphic pointer forwards exactly one original reactor unlock event',
 afterUnlock:'after unlock the graphic action resolves the current native build instead of the old unlock',
 qty5:'x5 preserves the disabled native reactor build with only one remaining Urmaterie',
 qty10:'x10 preserves the disabled native reactor build with only one remaining Urmaterie',
 qty1:'x1 restores the enabled current native reactor build',
 built:'the next graphic build consumes the second Urmaterie and constructs exactly local level one',
 buildEvent:'the real graphic pointer forwards exactly one original reactor build event',
 oneAction:'one Urmaterie exposes the enabled original graphic unlock',
 oneUnlock:'a one-item unlock persists the flag and zero stock while leaving the reactor unbuilt',
 oneBlocked:'after a one-item unlock the graphic build mirrors its disabled native original',
 oneUnchanged:'a real pointer at the disabled one-item build creates no level or extra item effect',
 zeroAction:'zero Urmaterie keep the visible graphic unlock and its native original disabled',
 zeroUnchanged:'a real pointer at the disabled zero-item unlock creates no unlock or item effect',
 defenseAction:'the original Crystal Fortress graphic inspector exposes its enabled native unlock',
 defenseUnlock:'the shared defense graphic unlock consumes one Crystal Heart without construction',
 defenseEvent:'the defense graphic pointer forwards exactly one original unlock event',
 shipAction:'the original Moon Destroyer picker exposes its actual enabled four-item native unlock',
 shipUnlock:'the shared ship graphic unlock consumes its four original items without creating a ship',
 shipEvent:'the ship graphic pointer forwards exactly one original unlock event',
 priorAction:'an already unlocked reactor exposes its current original native build',
 priorBuild:'the already unlocked graphic build consumes only its one level item without another unlock',
 poorAction:'insufficient native resources keep the graphic reactor build disabled',
 poorUnchanged:'a real pointer at the unaffordable graphic build creates no level or item effect',
 missingNative:'the real unlock control is absent from buildings and exists only in a different native container',
 missingAction:'a cross-container native unlock cannot create a graphic building action',
 missingUnchanged:'the absent in-container action cannot consume an item or unlock the reactor',
 researchMissing:'both original research actions are absent while a matching unlock control is present',
 researchAction:'research never substitutes an unlock for its absent native research action',
 researchQueueAction:'research queue never substitutes an unlock for its absent native queue action',
 controls:'every completed fixture retains its thirteen original native navigation controls',
 script:'all real unlock build quantity tab and absence actions finish without JavaScript errors',
 http:'all loopback requests finish without unexpected HTTP fixture errors'
};
const manifest=Object.values(labels);module.exports={labels,manifest};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,timeout=10000){const end=Date.now()+timeout;do{if(await fn()===true)return true;await delay(50);}while(Date.now()<end);return false;}
async function main(){
 const source=fs.readFileSync(SPIELDATEI,'utf8'),marketing=fs.readFileSync(path.join(WURZEL,'marketing-screenshots.js'),'utf8'),a=marketing.indexOf('function spielstand()'),b=marketing.indexOf('// Demo-Bestenliste',a);
 if(a<0||b<=a)throw Error('one actual native marketing save boundary');
 const version=(source.match(/\bconst VERSION\s*=\s*['"]([^'"]+)['"]/)||[])[1];if(!version)throw Error('actual game VERSION');
 const tabs=['basis','verteidigung','forschung','flotte','expedition','karte','galaxie','allianz','offiziere','markt','punkte','fortschritt','sammlung'];
 let browser,servers=[],errors=[],httpErrors=[],records=[],controlIdentity=[];
 const check=(name,ok,data)=>{records.push({name,ok:!!ok});console.log((ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data)));};
 const snapshot=run=>{const s=JSON.parse(run.store.get('kepler7-save-v3'));return {rare:s.rareItems||{},unlocked:s.unlocked||{},level:(s.buildings||{}).urmateriereaktor||0,defense:(s.buildings||{}).festung||0,ship:(s.fleet||{}).mondzerstoerer||0,construction:(s.constructionQueue||[]).length,resources:s.resources};};
 async function fixture({urm=2,unlocked=false,poor=false,ship=false}={}){
  const state=JSON.parse(vm.runInNewContext(marketing.slice(a,b)+'\nspielstand();',{Date},{timeout:1000}));
  Object.assign(state,ruhigeUhren(),{lastTick:Date.now()-60000,lastSeenVersion:version,lastLoginDate:new Date().toDateString(),soundOn:false,activeBasePlanet:'home',activeResearch:null,buildQueue:[],constructionQueue:[],uiHideLockedShips:false,rareItems:{urmaterie:urm,kristallherz:2,antimateriekern:2,altetech:2,leerensplitter:2},unlocked:{urmateriereaktor:unlocked,festung:false,mondzerstoerer:false},seenTabHints:Object.fromEntries([...tabs,'einstellungen','hilfe','berichte'].map(t=>[t,true]))});
  state.buildings.urmateriereaktor=0;state.buildings.festung=0;state.fleet.mondzerstoerer=0;
  if(ship)Object.assign(state.research,{rleere:10,rkampf2:20});
  if(poor){state.resources.antimaterie=0;state.buildings.fusionsreaktor=0;for(const c of Object.values(state.colonies))c.buildings.fusionsreaktor=0;}
  const store=new Map([['kepler7-save-v3',JSON.stringify(state)]]),requests=[];
  const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1'),entry={path:u.pathname,method:req.method};requests.push(entry);
   const send=(status,bytes,mime='application/json')=>{entry.status=status;res.writeHead(status,{'Content-Type':mime,'Cache-Control':'no-store','Content-Length':Buffer.byteLength(bytes)});res.end(bytes);},json=(body,status=200)=>send(status,JSON.stringify(body));
   try{if(u.pathname.startsWith('/api/')){const key=u.pathname.slice(5);if(key==='health')return json({ok:true});if(!(req.headers.cookie||'').includes('kepler7_unlock_fixture=isolated'))return json({error:'isolated session required'},401);
    if(key==='me')return json({userId:'u',username:'Kommandant',homeSystem:'kepler',homeSlot:0,hasEmail:true,wantsPatchnotes:false});
    if(key==='storage-list')return json({keys:[...store.keys()].filter(k=>k.startsWith(u.searchParams.get('prefix')||''))});
    if(key.startsWith('storage/')){const k=decodeURIComponent(key.slice(8));if(['PUT','POST'].includes(req.method)){let raw='';for await(const chunk of req)raw+=chunk;store.set(k,JSON.parse(raw).value);return json({ok:true,version:1});}return store.has(k)?json({key:k,value:store.get(k),version:1}):json({},404);}
    if(key==='galaxy')return json({npcEmpireStrength:1.8,marketTrend:1,collapsedSystems:{},news:[],alienNester:[]});
    if(/reports|leaderboard|messages|ranking|wars|halloffame|bounty|friends/.test(key))return json([]);return json({});}
    const name=u.pathname==='/'?'weltraum_kolonie.html':decodeURIComponent(u.pathname.slice(1)),file=path.resolve(WURZEL,name);if(!file.startsWith(WURZEL+path.sep))return send(403,'outside fixture','text/plain');
    const bytes=name==='weltraum_kolonie.html'?Buffer.from(source):await fs.promises.readFile(file),mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain'}[path.extname(name)]||'application/octet-stream';return send(200,bytes,mime);
   }catch(error){httpErrors.push({path:u.pathname,error:error.code||error.message});if(!res.headersSent)return json({error:'fixture failure'},500);res.end();}
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));servers.push(server);
  const origin='http://127.0.0.1:'+server.address().port,context=await browser.newContext({viewport:{width:1487,height:1058},deviceScaleFactor:1,serviceWorkers:'block'});
  await context.addCookies([{url:origin,name:'kepler7_unlock_fixture',value:'isolated',httpOnly:true,sameSite:'Lax'}]);await context.addInitScript(()=>localStorage.setItem('kepler7-ui-language','de'));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/?lang=de',{waitUntil:'commit',timeout:60000});
  await page.waitForFunction(()=>document.body?.classList.contains('command-ui')&&document.getElementById('commandPlayerName')?.textContent==='Kommandant'&&/automatisch geladen/i.test(document.getElementById('loadstate')?.textContent||''),null,{timeout:30000});
  await page.locator('#welcomeBackDismissBtn').waitFor({state:'visible'});await page.locator('#welcomeBackDismissBtn').click();await page.locator('#welcomeBackOverlay').waitFor({state:'hidden'});
  await page.evaluate(()=>{window.__unlockControls=[...document.querySelectorAll('#commandNav .tab-btn')];window.__unlockEvents=[];document.addEventListener('click',e=>{const button=e.target.closest('[data-unlock],[data-build],[data-buyship]');if(button)window.__unlockEvents.push({key:button.getAttribute('data-unlock')||button.getAttribute('data-build')||button.getAttribute('data-buyship'),action:button.hasAttribute('data-unlock')?'unlock':'build'});},true);});
  return {context,page,store,requests};
 }
 async function close(run){controlIdentity.push(await run.page.evaluate(()=>window.__unlockControls.length===13&&window.__unlockControls.every((e,i)=>e===document.querySelectorAll('#commandNav .tab-btn')[i])));await run.context.close();}
 async function preparePointer(locator){await locator.scrollIntoViewIfNeeded();const point=await locator.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y)),visible:r.width>0&&r.height>0};});if(!point.hit||!point.visible)throw Error('real pointer target must be physically reachable: '+JSON.stringify(point));return point;}
 async function pointer(locator){const point=await preparePointer(locator);await locator.page().mouse.click(point.x,point.y);return point;}
 async function originalPointer(locator){
  // The native list may be replaced by a normal resource tick while scrolling.
  // Re-read its genuine current box instead of holding a stale element handle.
  const page=locator.page(),end=Date.now()+10000;let previous=null,stableSince=0;
  while(Date.now()<end){const box=await locator.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,width:r.width,height:r.height,top:r.top,bottom:r.bottom,viewport:innerHeight,hit:e.contains(document.elementFromPoint(x,y))};});
   if(!(box.width>0&&box.height>0))throw Error('native recovery must have a real visible box: '+JSON.stringify(box));
   if(box.top<90||box.bottom>box.viewport-65){await page.mouse.move(1420,520);await page.mouse.wheel(0,Math.round(box.y-box.viewport/2));previous=null;stableSince=0;await delay(80);continue;}
   if(!box.hit)throw Error('native recovery pointer is genuinely obstructed: '+JSON.stringify(box));
   if(previous&&['x','y','width','height'].every(k=>Math.abs(box[k]-previous[k])<=0.5)){if(Date.now()-stableSince>=150){await page.mouse.click(box.x,box.y);return box;}}
   else{previous=box;stableSince=Date.now();}await delay(50);
  }throw Error('native recovery never reached a stable genuine pointer target');
 }
 async function tab(run,key){await pointer(run.page.locator('#commandNav .tab-btn[data-tab="'+key+'"]'));await run.page.locator('#tab-'+key).waitFor({state:'visible'});}
 async function select(run,kind,key){const box=kind==='defense'?'defenseVisual':'colonyVisual';await pointer(run.page.locator('#'+box+' [data-gfx-facility="'+kind+'"][data-gfx-key="'+key+'"]'));return run.page.locator('#'+box+' [data-gfx-build="'+kind+'"]');}
 const native=(run,kind,key,unlock=false)=>run.page.locator('#'+({building:'buildings',defense:'defenseBuildings',ship:'fleet'}[kind])+' ['+(unlock?'data-unlock':kind==='ship'?'data-buyship':'data-build')+'="'+key+'"]');
 async function mirror(run,action,original,disabled){const a=await action.evaluate(e=>({hidden:e.hidden,disabled:e.disabled,text:e.textContent.trim()}));const n=await original.evaluate(e=>({disabled:e.disabled,text:e.textContent.trim()}));return {ok:!a.hidden&&a.disabled===disabled&&n.disabled===disabled&&a.text===n.text,a,n};}
 async function preferred(run,action,original){if(await action.isVisible()&&!await action.isDisabled())return {graphic:true,point:await pointer(action)};return {graphic:false,nativeRecovery:true,point:await originalPointer(original)};}
 async function effects(run,predicate){return until(()=>predicate(snapshot(run)));}
 const eventCount=(run,key,action)=>run.page.evaluate(({key,action})=>window.__unlockEvents.filter(e=>e.key===key&&e.action===action).length,{key,action});
 try{
  browser=await starteBrowser({args:['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  const run=await fixture();try{
   check(labels.boot,JSON.stringify(await run.page.locator('#commandNav .tab-btn').evaluateAll(es=>es.map(e=>e.dataset.tab)))===JSON.stringify(tabs)&&run.requests.some(r=>r.path==='/api/storage/kepler7-save-v3'&&r.status===200));
   const action=await select(run,'building','urmateriereaktor');check(labels.selected,await run.page.locator('#colonyVisual [data-gfx-facility][data-gfx-key="urmateriereaktor"]').getAttribute('aria-pressed')==='true');
   let m=await mirror(run,action,native(run,'building','urmateriereaktor',true),false);check(labels.twoAction,m.ok,m);
   const click=await preferred(run,action,native(run,'building','urmateriereaktor',true));const unlocked=await effects(run,s=>s.rare.urmaterie===1&&s.unlocked.urmateriereaktor===true&&s.level===0&&s.construction===0);check(labels.twoUnlock,click.graphic&&unlocked,{click,state:snapshot(run)});check(labels.twoUnlockEvent,click.graphic&&await eventCount(run,'urmateriereaktor','unlock')===1);
   m=await mirror(run,action,native(run,'building','urmateriereaktor'),false);check(labels.afterUnlock,m.ok&&await native(run,'building','urmateriereaktor',true).count()===0,m);
   for(const [qty,label]of [[5,labels.qty5],[10,labels.qty10]]){await pointer(run.page.locator('#qtySelect [data-qty="'+qty+'"]'));m=await mirror(run,action,native(run,'building','urmateriereaktor'),true);check(label,m.ok&&snapshot(run).rare.urmaterie===1&&snapshot(run).level===0,m);}
   await pointer(run.page.locator('#qtySelect [data-qty="1"]'));m=await mirror(run,action,native(run,'building','urmateriereaktor'),false);check(labels.qty1,m.ok,m);
   const buildClick=await preferred(run,action,native(run,'building','urmateriereaktor'));check(labels.built,buildClick.graphic&&await effects(run,s=>s.level===1&&s.rare.urmaterie===0&&s.unlocked.urmateriereaktor===true&&s.construction===0),{buildClick,state:snapshot(run)});check(labels.buildEvent,buildClick.graphic&&await eventCount(run,'urmateriereaktor','build')===1&&await eventCount(run,'urmateriereaktor','unlock')===1);
  }finally{await close(run);}
  const one=await fixture({urm:1});try{const action=await select(one,'building','urmateriereaktor');let m=await mirror(one,action,native(one,'building','urmateriereaktor',true),false);check(labels.oneAction,m.ok,m);const click=await preferred(one,action,native(one,'building','urmateriereaktor',true));check(labels.oneUnlock,click.graphic&&await effects(one,s=>s.rare.urmaterie===0&&s.unlocked.urmateriereaktor===true&&s.level===0),{click,state:snapshot(one)});m=await mirror(one,action,native(one,'building','urmateriereaktor'),true);check(labels.oneBlocked,m.ok,m);await pointer(action);await delay(250);check(labels.oneUnchanged,snapshot(one).rare.urmaterie===0&&snapshot(one).level===0&&await eventCount(one,'urmateriereaktor','build')===0);}finally{await close(one);}
  const zero=await fixture({urm:0});try{const action=await select(zero,'building','urmateriereaktor'),m=await mirror(zero,action,native(zero,'building','urmateriereaktor',true),true);check(labels.zeroAction,m.ok,m);if(await action.isVisible())await pointer(action);await delay(250);check(labels.zeroUnchanged,!snapshot(zero).unlocked.urmateriereaktor&&snapshot(zero).rare.urmaterie===0&&snapshot(zero).level===0&&await eventCount(zero,'urmateriereaktor','unlock')===0);}finally{await close(zero);}
  const defense=await fixture();try{await tab(defense,'verteidigung');const action=await select(defense,'defense','festung'),m=await mirror(defense,action,native(defense,'defense','festung',true),false);check(labels.defenseAction,m.ok,m);const click=await preferred(defense,action,native(defense,'defense','festung',true));check(labels.defenseUnlock,click.graphic&&await effects(defense,s=>s.rare.kristallherz===1&&s.unlocked.festung===true&&s.defense===0&&s.construction===0),{click,state:snapshot(defense)});check(labels.defenseEvent,click.graphic&&await eventCount(defense,'festung','unlock')===1);}finally{await close(defense);}
  const ship=await fixture({ship:true});try{await tab(ship,'flotte');const picker=ship.page.locator('#shipyardVisual [data-gfx-ship-picker]');await picker.selectOption('mondzerstoerer');const action=ship.page.locator('#shipyardVisual [data-gfx-build="ship"]'),m=await mirror(ship,action,native(ship,'ship','mondzerstoerer',true),false);check(labels.shipAction,m.ok&&await action.getAttribute('data-gfx-key')==='mondzerstoerer',m);const click=await preferred(ship,action,native(ship,'ship','mondzerstoerer',true));check(labels.shipUnlock,click.graphic&&await effects(ship,s=>['antimateriekern','kristallherz','altetech','leerensplitter'].every(k=>s.rare[k]===1)&&s.unlocked.mondzerstoerer===true&&s.ship===0&&s.construction===0),{click,state:snapshot(ship)});check(labels.shipEvent,click.graphic&&await eventCount(ship,'mondzerstoerer','unlock')===1);}finally{await close(ship);}
  const prior=await fixture({urm:1,unlocked:true});try{const action=await select(prior,'building','urmateriereaktor'),m=await mirror(prior,action,native(prior,'building','urmateriereaktor'),false);check(labels.priorAction,m.ok&&await native(prior,'building','urmateriereaktor',true).count()===0,m);const click=await preferred(prior,action,native(prior,'building','urmateriereaktor'));check(labels.priorBuild,click.graphic&&await effects(prior,s=>s.level===1&&s.rare.urmaterie===0)&&await eventCount(prior,'urmateriereaktor','unlock')===0,{click,state:snapshot(prior)});}finally{await close(prior);}
  const poor=await fixture({urm:1,unlocked:true,poor:true});try{const action=await select(poor,'building','urmateriereaktor'),m=await mirror(poor,action,native(poor,'building','urmateriereaktor'),true);check(labels.poorAction,m.ok&&snapshot(poor).resources.antimaterie===0,m);await pointer(action);await delay(250);check(labels.poorUnchanged,snapshot(poor).rare.urmaterie===1&&snapshot(poor).level===0&&await eventCount(poor,'urmateriereaktor','build')===0);}finally{await close(poor);}
  const absent=await fixture();try{const action=await select(absent,'building','mine'),reactor=absent.page.locator('#colonyVisual [data-gfx-facility][data-gfx-key="urmateriereaktor"]'),point=await preparePointer(reactor);await native(absent,'building','urmateriereaktor',true).evaluate(e=>document.getElementById('defenseBuildings').append(e));await absent.page.mouse.click(point.x,point.y);
   const absence=await absent.page.locator('#buildings').evaluate(box=>({build:box.querySelectorAll('[data-build="urmateriereaktor"]').length,unlock:box.querySelectorAll('[data-unlock="urmateriereaktor"]').length,other:document.querySelectorAll('#defenseBuildings [data-unlock="urmateriereaktor"]').length}));check(labels.missingNative,absence.build===0&&absence.unlock===0&&absence.other===1,absence);
   const hidden=await action.evaluate(e=>e.hidden===true);check(labels.missingAction,hidden&&absence.build===0&&absence.unlock===0,{hidden,absence});if(await action.isVisible())await pointer(action);await delay(250);check(labels.missingUnchanged,!snapshot(absent).unlocked.urmateriereaktor&&snapshot(absent).rare.urmaterie===2&&snapshot(absent).level===0&&await eventCount(absent,'urmateriereaktor','unlock')===0);
  }finally{await close(absent);}
  const research=await fixture();try{await tab(research,'forschung');const action=research.page.locator('#researchVisual [data-gfx-build="research"]'),queue=research.page.locator('#researchVisual [data-gfx-build="researchqueue"]'),key=await action.getAttribute('data-gfx-key');
   await research.page.locator('#research').evaluate((box,key)=>{for(const e of box.querySelectorAll('[data-research="'+key+'"],[data-research-queue="'+key+'"]'))e.remove();const unlock=document.querySelector('#buildings [data-unlock="urmateriereaktor"]');unlock.setAttribute('data-unlock',key);box.append(unlock);},key);
   check(labels.researchMissing,await research.page.locator('#research [data-research="'+key+'"],#research [data-research-queue="'+key+'"]').count()===0&&await research.page.locator('#research [data-unlock="'+key+'"]').count()===1);
   check(labels.researchAction,await until(()=>action.evaluate(e=>e.hidden===true),2500));check(labels.researchQueueAction,await until(()=>queue.evaluate(e=>e.hidden===true),2500));
  }finally{await close(research);}
  check(labels.controls,controlIdentity.length===9&&controlIdentity.every(Boolean),controlIdentity);check(labels.script,errors.length===0,errors);check(labels.http,httpErrors.length===0,httpErrors);
  if(JSON.stringify(records.map(r=>r.name))!==JSON.stringify(manifest))throw Error('complete ordered native unlock manifest');const failed=records.filter(r=>!r.ok).length;console.log(records.length+' checks, '+failed+' failures');console.log((failed?'FAIL':'OK')+' - Native graphics unlock');process.exitCode=failed?1:0;
 }finally{if(browser)await browser.close();for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
