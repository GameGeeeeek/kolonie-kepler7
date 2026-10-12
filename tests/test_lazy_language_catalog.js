'use strict';
// Actual loopback HTTP, cookies, game bootstrap and service worker. No game
// clocks, handlers, language variables or authenticated production APIs are replaced.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http');
const path=require('node:path'),crypto=require('node:crypto');
const {SPIELDATEI,WURZEL}=require('./lib/spieldatei');
const {starteBrowser,ruhigeUhren}=require('./lib/umgebung');
const source=fs.readFileSync(SPIELDATEI,'utf8');
const catalogueBytes=fs.readFileSync(path.join(WURZEL,'kepler-english.json'));
const workerBytes=fs.readFileSync(process.env.KEPLER_SERVICE_WORKER||path.join(WURZEL,'service-worker.js'));
const links=[...source.matchAll(/k7LoadEnglishCatalogue\("(kepler-english\.json\?v=[a-f0-9]{16})"\)/g)];
assert.equal(links.length,1,'one genuine content-versioned English catalogue URL');
const cataloguePath='/'+links[0][1],key='kepler7-save-v3',languageKey='kepler7-ui-language';
const TABS=['basis','verteidigung','forschung','flotte','expedition','karte','galaxie','allianz','offiziere','markt','punkte','fortschritt','sammlung'];
function nativeResourceKeys(name){
 const declarations=[...source.matchAll(new RegExp('\\bconst '+name+'\\s*=\\s*\\[','g'))];
 assert.equal(declarations.length,1,'one native resource definition '+name);
 const tail=source.slice(declarations[0].index),end=/^\s*\];/m.exec(tail);
 assert(end,'native resource array terminator '+name);
 const keys=[...tail.slice(0,end.index).matchAll(/\bkey:\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
 assert(keys.length>0&&new Set(keys).size===keys.length,'real distinct resource IDs '+name);return keys;
}
const specialDefinition=[...source.matchAll(/^\s*function resDefFor\(key\)\{/gm)];
assert.equal(specialDefinition.length,1,'one native special-resource lookup');
const specialTail=source.slice(specialDefinition[0].index),specialEnd=/^  \}/m.exec(specialTail);
assert(specialEnd,'native special-resource function terminator');
const specialResourceKeys=[...specialTail.slice(0,specialEnd.index).matchAll(/return\s*\{\s*key:\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
assert(specialResourceKeys.length>0,'actual authored special-resource IDs');
const baseResourceKeys=nativeResourceKeys('RES_DEFS'),allResourceKeys=new Set([...baseResourceKeys,...nativeResourceKeys('TIER2_DEFS'),...specialResourceKeys]);
const playerName='Menü links',userId='11111111-1111-4111-8111-111111111111';
const cookieName='kepler7_fixture_session',cookieValue='isolated-native-language';
const version=source.match(/\bconst VERSION\s*=\s*['"]([^'"]+)['"]/);
assert(version,'native VERSION fixture anchor');
const assets=new Map([['/service-worker.js',workerBytes]]);
for(const name of ['kepler-graphics.css','tabler-icons-full.woff2','manifest.json','icon-192.png','icon-512.png','apple-touch-icon.png',
 ...fs.readdirSync(WURZEL).filter(name=>/^kepler-gfx-[a-z-]+\.(?:png|webp)$/.test(name))]){
 const file=path.join(WURZEL,name);if(fs.existsSync(file))assets.set('/'+name,fs.readFileSync(file));
}
let checks=0,failures=0,browser;const records=[],allErrors=[];
function check(name,ok,data){checks++;if(!ok)failures++;records.push({name,ok:!!ok});
 console.log((ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data)));}
function savedGame(){return {...ruhigeUhren(),tutorialSeen:true,newbieWelcomeSeen:true,soundOn:false,
 seenTabHints:Object.fromEntries([...TABS,'einstellungen','hilfe','berichte'].map(tab=>[tab,true])),
 resources:{energie:90000,erz:90000,kristalle:90000,deuterium:60000,antimaterie:5000,forschungspunkte:3000},
 buildings:{solar:8,mine:2,raffinerie:4,synth:3,lager:25,labor:5,habitat:2,werftkern:3},
 research:{rkampf:1,rkolonisation:1},fleet:{jaeger:20,cruisers:4,forscher:2,missions:[]},colonies:{},
 activeBasePlanet:'home',player:{id:userId,name:playerName},colonyNames:{home:'Bauen'},
 xp:64000,battlePoints:1000,lastTick:Date.now(),lastLoginDate:new Date().toDateString(),lastSeenVersion:version[1]};}
async function fixtureServer(mode){
 const store=new Map([[key,JSON.stringify(savedGame())]]),versions=new Map([[key,1]]),requests=[],held=[];
 let catalogueMode=mode,releaseRequest;
 const firstCatalogue=new Promise(resolve=>{releaseRequest=resolve;});
 const send=(res,status,data,mime='application/json')=>{res.writeHead(status,{'Content-Type':mime,'Content-Length':Buffer.byteLength(data),'Cache-Control':'no-store'});res.end(data);};
 const json=(res,data,status=200)=>send(res,status,JSON.stringify(data));
 const catalogueReply=res=>{
  if(catalogueMode==='404')return json(res,{error:'fixture catalogue missing'},404);
  if(catalogueMode==='invalid')return json(res,{Bauen:7});
  if(catalogueMode==='html')return send(res,200,'<!doctype html><html><body>Native nginx fallback fixture</body></html>','text/html');
  return send(res,200,catalogueBytes,'application/json');
 };
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   const entry={path:url.pathname,search:url.search,method:req.method,cookie:req.headers.cookie||'',accept:req.headers.accept||''};requests.push(entry);
   if(url.pathname==='/kepler-english.json'){
    releaseRequest(entry);if(catalogueMode==='hold'){held.push(res);return;}return catalogueReply(res);
   }
   if(url.pathname==='/__catalogue_barrier__')return json(res,{catalogueRequests:requests.filter(r=>r.path==='/kepler-english.json').length});
   if(url.pathname==='/api/health')return json(res,{ok:true});
   if(url.pathname.startsWith('/api/')){
    if(!entry.cookie.includes(cookieName+'='+cookieValue))return json(res,{error:'fixture session required'},401);
    const api=url.pathname.slice(5);
    if(api==='me')return json(res,{userId,username:playerName,homeSystem:'kepler',homeSlot:0,hasEmail:true,wantsPatchnotes:false});
    if(api==='storage-list')return json(res,{keys:[...store.keys()].filter(k=>k.startsWith(url.searchParams.get('prefix')||''))});
    if(api.startsWith('storage/')){
     const name=decodeURIComponent(api.slice(8));
     if(['PUT','POST'].includes(req.method)){
      let body='';for await(const chunk of req)body+=chunk;
      const data=JSON.parse(body);store.set(name,data.value);versions.set(name,(versions.get(name)||0)+1);
      return json(res,{ok:true,version:versions.get(name)});
     }
     return store.has(name)?json(res,{key:name,value:store.get(name),version:versions.get(name)}):json(res,{},404);
    }
    if(api.includes('pending-rewards'))return json(res,{reward:null});
    if(/reports|leaderboard|messages|ranking|wars|halloffame|bounty|friends|players/.test(api))return json(res,[]);
    return json(res,{});
   }
   if(url.pathname==='/'||url.pathname==='/weltraum_kolonie.html')return send(res,200,source,'text/html; charset=utf-8');
   if(url.pathname==='/version.txt')return send(res,200,version[1]+'\n','text/plain');
   if(assets.has(url.pathname))return send(res,200,assets.get(url.pathname),url.pathname.endsWith('.js')?'application/javascript':
    url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.json')?'application/json':url.pathname.endsWith('.woff2')?'font/woff2':url.pathname.endsWith('.webp')?'image/webp':'image/png');
   return send(res,404,'Fixture asset unavailable','text/plain');
  }catch(error){if(!res.headersSent)json(res,{error:'fixture HTTP failure'},500);else res.end();allErrors.push('HTTP fixture: '+error.message);}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+server.address().port;
 return {origin,requests,store,firstCatalogue,setMode:value=>{catalogueMode=value;},release:()=>{catalogueMode='valid';for(const res of held.splice(0))catalogueReply(res);},
  close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
async function pageFixture(server,language,workers='block'){
 const context=await browser.newContext({viewport:{width:1487,height:1058},serviceWorkers:workers});
 context.setDefaultTimeout(15000);
 await context.addCookies([{url:server.origin,name:cookieName,value:cookieValue,httpOnly:true,sameSite:'Lax'}]);
 await context.addInitScript(({languageKey,language})=>{if(localStorage.getItem(languageKey)===null)localStorage.setItem(languageKey,language);},{languageKey,language});
 await context.addInitScript(()=>{window.__lazyNativeLoads=[];window.addEventListener('load',()=>window.__lazyNativeLoads.push({url:location.href,ready:document.readyState,at:performance.now()}));});
 // Only third-party assets are isolated. Same-origin HTML, JSON, cookies, APIs and
 // worker fetches always reach the real fixture server without route.fulfill.
 await context.route('**/*',route=>new URL(route.request().url()).origin===server.origin?route.continue():route.fulfill({status:204,body:''}));
 const page=await context.newPage(),errors=[],catalogueRequests=[];
 page.on('pageerror',error=>{errors.push(error.message);allErrors.push(error.message);});
 context.on('request',request=>{if(new URL(request.url()).pathname==='/kepler-english.json')catalogueRequests.push({url:request.url(),worker:!!request.serviceWorker()});});
 await page.goto(server.origin+'/?lang='+language,{waitUntil:'load'});
 return {context,page,errors,catalogueRequests};
}
async function boot(page){
 await page.waitForFunction(()=>document.body.classList.contains('command-ui')&&
  /automatisch geladen|automatically loaded/i.test(document.getElementById('loadstate')?.textContent||''));
 await page.locator('#loginOverlay').waitFor({state:'hidden'});
 const welcome=page.locator('#welcomeBackDismissBtn');if(await welcome.isVisible())await welcome.click();
}
const apiRequests=server=>server.requests.filter(r=>r.path.startsWith('/api/'));
const catalogueRequests=server=>server.requests.filter(r=>r.path==='/kepler-english.json');
async function nativeTabs(page){
 const membership=await page.locator('#commandNav .tab-btn').evaluateAll(buttons=>buttons.map(b=>b.dataset.tab)),actions=[];
 for(const tab of TABS){
  const button=page.locator('#commandNav .tab-btn[data-tab='+tab+']');await button.scrollIntoViewIfNeeded();
  const hit=await button.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
  await button.click();await page.locator('#tab-'+tab).waitFor({state:'visible'});
  actions.push({tab,hit,active:await button.getAttribute('aria-current')==='page'});
 }
 return {ok:JSON.stringify(membership)===JSON.stringify(TABS)&&await page.locator('.tab-btn').count()===13&&actions.every(a=>a.hit&&a.active),membership,actions};
}
async function settings(page){await page.locator('#commandAccountBtn').scrollIntoViewIfNeeded();await page.locator('#commandAccountBtn').click();await page.locator('#tab-einstellungen').waitFor({state:'visible'});}
async function protectedState(page,server){
 const saved=JSON.parse(server.store.get(key));
 return {name:await page.locator('#commandPlayerName').innerText(),savedName:saved.player.name,colonyName:saved.colonyNames.home,
  resources:Object.keys(saved.resources).sort(),keys:[...server.store.keys()],localeInSave:Object.prototype.hasOwnProperty.call(saved,languageKey)};
}
const protectedOK=data=>data.name===playerName&&data.savedName===playerName&&data.colonyName==='Bauen'&&
 baseResourceKeys.every(key=>data.resources.includes(key))&&data.resources.every(key=>allResourceKeys.has(key))&&
 data.keys.includes(key)&&!data.keys.includes(languageKey)&&!data.localeInSave;
async function retries(page){return page.evaluate(key=>({preference:localStorage.getItem(key),
 landing:document.getElementById('k7LanguageLoadNotice')?.getAttribute('role'),
 settings:document.getElementById('k7LanguageSettingsNotice')?.getAttribute('role'),
 value:document.querySelector('.resetrow [data-k7-language]')?.value}),languageKey);}
async function realRetry(page,server){
 server.setMode('valid');await settings(page);
 const select=page.locator('.resetrow [data-k7-language]');
 const before=await select.inputValue();
 if(before!=='de'){await select.selectOption('en');return false;}
 await Promise.all([page.waitForEvent('load'),select.selectOption('en')]);await boot(page);
 return await page.locator('html').getAttribute('lang')==='en'&&await select.inputValue()==='en';
}
// Playwright's predicate poller treats an async predicate's Promise as truthy.
// Await the actual browser result on every poll and accept only Boolean true;
// the deadline is the same 15s fixture timeout, not a game-clock modification.
async function waitNativeBoolean(page,predicate,arg){
 const deadline=Date.now()+15000;
 do{
  if(await page.evaluate(predicate,arg)===true)return true;
  await new Promise(resolve=>setTimeout(resolve,50));
 }while(Date.now()<deadline);
 return false;
}
async function controlledWorker(page){
 return waitNativeBoolean(page,async()=>!!(await navigator.serviceWorker.getRegistration('/'))?.active&&!!navigator.serviceWorker.controller);
}
async function cacheSnapshot(page){return page.evaluate(async path=>{
 const cache=await caches.open('kepler7-shell-v1'),entry=await cache.match(path),shell=await cache.match('/__app-shell__');
 return {catalogueType:entry?.headers.get('content-type')||null,catalogueBody:entry?await entry.text():null,
  shellType:shell?.headers.get('content-type')||null,shellBody:shell?await shell.text():null};
},cataloguePath);}
(async()=>{
 try{
  browser=await starteBrowser();
  const de=await fixtureServer('valid');let run;
  try{
   run=await pageFixture(de,'de');await boot(run.page);
   check('German starts the actual authenticated saved game',await run.page.locator('html').getAttribute('lang')==='de'&&apiRequests(de).some(r=>r.path==='/api/me')&&apiRequests(de).some(r=>r.path==='/api/storage/'+key));
   const tabs=await nativeTabs(run.page);check('German keeps all thirteen native pointer navigation actions',tabs.ok,tabs);
   check('German makes no English catalogue request',catalogueRequests(de).length===0&&run.catalogueRequests.length===0);
   const data=await protectedState(run.page,de);check('German preserves player-owned names and original server save keys',protectedOK(data),data);
   check('German native bootstrap and navigation have no JavaScript errors',run.errors.length===0,run.errors);
  }finally{if(run)await run.context.close();await de.close();}
  const en=await fixtureServer('hold');run=null;
  try{
   run=await pageFixture(en,'en','allow');await en.firstCatalogue;
   console.log('WITNESS - held English document lifecycle | '+JSON.stringify(await run.page.evaluate(async()=>({ready:document.readyState,loads:window.__lazyNativeLoads,
    registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:!!r.active})),controlled:!!navigator.serviceWorker.controller}))));
   const request=catalogueRequests(en)[0];
   check('English makes one same-origin content-versioned JSON request without the session cookie',catalogueRequests(en).length===1&&request.search===new URL(cataloguePath,en.origin).search&&request.accept==='application/json'&&request.cookie==='',request);
   check('English sends no authentication or save request while the real catalogue response is held',apiRequests(en).length===0,apiRequests(en).map(r=>r.path));
   check('English does not initialize native game handlers before the catalogue response',!await run.page.locator('body').evaluate(e=>e.classList.contains('command-ui')));
   en.release();await boot(run.page);
   console.log('WITNESS - English lifecycle immediately after authenticated boot | '+JSON.stringify(await run.page.evaluate(async()=>({ready:document.readyState,loads:window.__lazyNativeLoads,
    registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:!!r.active})),controlled:!!navigator.serviceWorker.controller}))));
   check('English starts the authenticated game after the actual catalogue response',await run.page.locator('html').getAttribute('lang')==='en'&&apiRequests(en).some(r=>r.path==='/api/storage/'+key));
   check('English translates the original navigation labels',await run.page.locator('[data-tab=basis]').evaluate(e=>[...e.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim())==='Base'&&
    await run.page.locator('[data-tab=verteidigung]').evaluate(e=>[...e.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim())==='Defence');
   await settings(run.page);
   const menu=await run.page.evaluate(()=>({label:document.querySelector('label[for=commandMenuPosition]').textContent,
    options:[...document.querySelectorAll('#commandMenuPosition option')].map(e=>e.textContent),hint:document.getElementById('commandMenuPositionHint').textContent}));
   check('English translates the menu position label, both options and saved-preference hint',menu.label==='Menu position'&&
    JSON.stringify(menu.options)===JSON.stringify(['Menu on the left','Menu at the top'])&&menu.hint==='Choose navigation on the left or at the top. Your choice is saved with your game.',menu);
   const tabs=await nativeTabs(run.page);check('English keeps all thirteen native pointer navigation actions',tabs.ok,tabs);
   const data=await protectedState(run.page,en);check('English protects authored-label player names and original server save keys',protectedOK(data),data);
   console.log('WITNESS - English lifecycle before worker guard after navigation | '+JSON.stringify(await run.page.evaluate(async()=>({ready:document.readyState,loads:window.__lazyNativeLoads,
    registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:!!r.active})),controlled:!!navigator.serviceWorker.controller}))));
   const englishWorker=await controlledWorker(run.page);
   console.log('WITNESS - English lifecycle after worker guard | '+JSON.stringify(await run.page.evaluate(async()=>({ready:document.readyState,loads:window.__lazyNativeLoads,
    registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:!!r.active})),controlled:!!navigator.serviceWorker.controller}))));
   check('English registers its native worker even after load preceded the held catalogue response',englishWorker);
   check('English completes native navigation with exactly one catalogue fetch',catalogueRequests(en).length===1&&run.catalogueRequests.length===1);
   check('English native bootstrap and navigation have no JavaScript errors',run.errors.length===0,run.errors);
  }finally{if(run)await run.context.close();await en.close();}
  for(const mode of ['404','invalid']){
   const server=await fixtureServer(mode);run=null;
   try{
    run=await pageFixture(server,'en');await boot(run.page);
    check(mode+' catalogue failure still starts the authenticated game in German',await run.page.locator('html').getAttribute('lang')==='de'&&apiRequests(server).some(r=>r.path==='/api/storage/'+key));
    await settings(run.page);const notice=await retries(run.page);
    check(mode+' fallback keeps English preference and native landing/settings retry notices',notice.preference==='en'&&notice.landing==='status'&&notice.settings==='status'&&notice.value==='de',notice);
    const data=await protectedState(run.page,server);check(mode+' fallback preserves protected names and original save keys',protectedOK(data),data);
    check(mode+' fallback retries English through the real settings language control',await realRetry(run.page,server));
    check(mode+' fallback and native retry have no JavaScript errors',run.errors.length===0,run.errors);
   }finally{if(run)await run.context.close();await server.close();}
  }
  const sw=await fixtureServer('valid');run=null;
  try{
   run=await pageFixture(sw,'de','allow');await boot(run.page);
   const controlled=await controlledWorker(run.page);check('The actual native service worker controls the isolated HTTP game',controlled);
   await run.page.goto(sw.origin+'/?lang=en',{waitUntil:'load'});await boot(run.page);
   const cached=await waitNativeBoolean(run.page,async path=>!!await(await caches.open('kepler7-shell-v1')).match(path),cataloguePath);
   const cache=await cacheSnapshot(run.page);
   check('The actual worker caches the versioned JSON under its own resource URL',cached&&cache.catalogueBody===catalogueBytes.toString('utf8')&&/application\/json/i.test(cache.catalogueType||''));
   check('The English catalogue never replaces the native HTML shell cache',/text\/html/i.test(cache.shellType||'')&&cache.shellBody?.includes('<!DOCTYPE html>')&&!cache.shellBody?.startsWith('{'));
   const beforeNetwork=catalogueRequests(sw).length,beforeWorker=run.catalogueRequests.filter(request=>request.worker).length;
   const response=await run.page.evaluate(async path=>{const res=await fetch(path,{headers:{Accept:'application/json'},credentials:'omit'});return {type:res.headers.get('content-type'),body:await res.text()};},cataloguePath);
   // A real worker-origin HTTP fence follows the completed cached fetch. Both
   // passive browser requests and server receipts must remain unchanged; the
   // genuine background-fetch counterexample verifies this absence guard.
   const worker=run.context.serviceWorkers()[0];if(worker)await worker.evaluate(async()=>{const r=await fetch('/__catalogue_barrier__');await r.json();});
   check('A second cached catalogue fetch causes no background HTTP request',response.body===catalogueBytes.toString('utf8')&&/application\/json/i.test(response.type||'')&&
    catalogueRequests(sw).length===beforeNetwork&&run.catalogueRequests.filter(request=>request.worker).length===beforeWorker,
    {beforeNetwork,afterNetwork:catalogueRequests(sw).length,beforeWorker,afterWorker:run.catalogueRequests.filter(request=>request.worker).length});
   await run.page.evaluate(async path=>{const c=await caches.open('kepler7-shell-v1');await c.put(path,new Response('<!doctype html><html>Poisoned catalogue cache</html>',{headers:{'Content-Type':'text/html'}}));},cataloguePath);
   const beforePoison=catalogueRequests(sw).length;
   await run.page.reload({waitUntil:'load'});await boot(run.page);
   const repaired=await cacheSnapshot(run.page);
   check('A poisoned HTML catalogue cache is rejected and replaced by one real JSON fetch',await run.page.locator('html').getAttribute('lang')==='en'&&catalogueRequests(sw).length===beforePoison+1&&repaired.catalogueBody===catalogueBytes.toString('utf8'));
   await run.page.evaluate(async path=>(await caches.open('kepler7-shell-v1')).delete(path),cataloguePath);sw.setMode('html');
   await run.page.reload({waitUntil:'load'});await boot(run.page);
   const htmlCache=await cacheSnapshot(run.page);
   check('An HTTP 200 HTML fallback is not retained as a versioned English catalogue',await run.page.locator('html').getAttribute('lang')==='de'&&htmlCache.catalogueBody===null);
   check('The actual worker permits a native English retry after the server returns valid JSON',await realRetry(run.page,sw));
   const data=await protectedState(run.page,sw);check('Worker cache recovery preserves player-owned names and original save keys',protectedOK(data),data);
   check('Native worker cache, poison recovery and retry have no JavaScript errors',run.errors.length===0,run.errors);
  }finally{if(run)await run.context.close();await sw.close();}
  check('All isolated native language scenarios finish without JavaScript or HTTP fixture errors',allErrors.length===0,allErrors);
 }catch(error){failures++;console.error(error.stack);}
 finally{
  if(browser)await browser.close();
  const directory=path.resolve(WURZEL,'../grafik-ladezeiten-2026-10-12');fs.mkdirSync(directory,{recursive:true});
  const name=process.env.KEPLER_LAZY_CASE||'normal';assert(/^[a-z0-9-]+$/.test(name),'safe evidence case name');
  fs.writeFileSync(path.join(directory,'lazy-language-native-'+name+'.json'),JSON.stringify({checks,failures,records,errors:allErrors,
   sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),workerSha256:crypto.createHash('sha256').update(workerBytes).digest('hex')},null,2)+'\n');
 }
 console.log(checks+' checks, '+failures+' failures');console.log(failures?'FAIL - Lazy language catalogue':'OK - Lazy language catalogue');process.exitCode=failures?1:0;
})();
