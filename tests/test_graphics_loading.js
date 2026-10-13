'use strict';
// Native loopback controls and resource requests. No source instrumentation,
// forced clicks, navigation fallbacks, fake clocks or observer replacement.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {SPIELDATEI,WURZEL}=require('./lib/spieldatei');
const {starteBrowser,ruhigeUhren}=require('./lib/umgebung');
const assetNames=['colony-developed','colony-outpost','colony-settlement','defense-fortress','enemy-atlas','expedition-atlas','expedition-wreck','flagship-atlas','market-station','material-atlas','nebula','officer-atlas','orbital-atlas','orbital-dock','planet-crystal','planet-desert','planet-gas','planet-ice','planet-moon','planet-ocean','planet-volcano','research-lab','ship-carrier','ship-cruisers','ship-destroyers','ship-frachter','ship-jaeger','ship-ships','world-atlas'].map(stem=>'kepler-gfx-'+stem);
assetNames.push(...['regular','utility','advanced'].map(group=>'kepler-gfx-ship-atlas-'+group));
const TABS=['basis','verteidigung','forschung','flotte','expedition','karte','galaxie','allianz','offiziere','markt','punkte','fortschritt','sammlung'];
const labels={
 boot:'the authenticated native save and all thirteen original tabs load',
 main:'the visible main colony image is WebP, eager and high priority',
 startup:'startup requests only the main game graphic before any scroll or tab action',
 dormantImages:'five genuinely offscreen planet images retain deferred WebP sources',
 dormantAtlases:'genuinely offscreen orbital and world atlas tiles remain dormant',
 orbitalScroll:'a real viewport wheel activates the original orbital tile',
 orbitalRequest:'orbital scrolling requests its actual WebP atlas instead of PNG',
 worldScroll:'a real viewport wheel loads the original deferred world image as WebP',
 visible:'revealed native graphics are decoded and unbroken',
 expedition:'the native Expedition pointer opens the original expedition panel',
 hiddenFleetMarkup:'Expedition creates no image previews inside the hidden fleet panel',
 hiddenFleetNetwork:'Expedition starts no hidden fleet ship-image requests',
 expeditionAtlas:'the displayed original expedition tile loads its real WebP atlas',
 fleet:'the native Fleet pointer displays its decoded canonical WebP ship canvas',
 fleetThumbnails:'every displayed native fleet card retains its canonical ship-thumbnail canvas',
 railDormant:'a genuinely offscreen shipyard canvas remains unpainted even when its shared atlas is cached',
 railScroll:'a real viewport wheel activates and decodes the original canonical shipyard canvas',
 identity:'scrolling and native tab actions retain all thirteen original control identities',
 fallbackRequest:'an actual missing main WebP requests its native PNG fallback once',
 fallbackDecode:'the native PNG fallback decodes at the original colony dimensions',
 fallbackOnce:'a second native image error does not request or switch the fallback again',
 atlasFallback:'an actual missing orbital WebP loads the native PNG background fallback',
 script:'all native loading, scroll, tab and fallback actions finish without JavaScript errors',
 http:'all loopback HTTP requests finish without unexpected fixture failures',
 alliance:'the original NoTag alliance banner registers late and loads its visible WebP dock',
 allianceSecond:'a second native NoTag visit retains the displayed WebP alliance banner',
 allianceFallback:'an actual missing NoTag alliance dock WebP loads its PNG background fallback',
 allianceFallbackSecond:'a second native NoTag visit retains PNG fallback and its original gradient',
 allianceMember:'native member loading and the initial class transition request no extra dock image'
};
const assetLabel=name=>'the actual WebP preserves PNG header dimensions and every alpha byte: '+name;
const oldLabels=Object.values(labels).slice(0,22);
const manifest=[...oldLabels.slice(0,13),labels.alliance,labels.allianceSecond,...oldLabels.slice(13),labels.allianceFallback,labels.allianceFallbackSecond,...assetNames.map(assetLabel),labels.allianceMember,labels.script,labels.http];
module.exports={manifest,labels,assetNames,assetLabel};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// CSS readiness is set before the browser schedules its replacement PNG HTTP
// request. Optional request evidence must also arrive before that assertion.
async function nativeBoolean(page,fn,arg,timeout=15000,requestReady=()=>true){const end=Date.now()+timeout;do{if(await page.evaluate(fn,arg)===true&&requestReady()===true)return true;await delay(50);}while(Date.now()<end);return false;}
async function main(){
 const source=fs.readFileSync(SPIELDATEI,'utf8'),marketing=fs.readFileSync(path.join(WURZEL,'marketing-screenshots.js'),'utf8');
 const a=marketing.indexOf('function spielstand()'),b=marketing.indexOf('// Demo-Bestenliste',a);
 if(a<0||b<=a)throw Error('The native marketing save boundaries must exist');
 const version=source.match(/\bconst VERSION\s*=\s*['"]([^'"]+)['"]/);if(!version)throw Error('The actual game VERSION must exist');
 let browser,records=[],allErrors=[],fixtureErrors=[],servers=[],phase='boot';
 const check=(name,ok,data)=>{const record={name,ok:!!ok};records.push(record);console.log((record.ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data)));};
 function freshSave(tag=''){const state=JSON.parse(vm.runInNewContext(marketing.slice(a,b)+'\nspielstand();',{Date},{timeout:1000}));return {...state,...ruhigeUhren(),player:{...state.player,allianceTag:tag,allianceRole:tag?'member':''},allianceSubTab:'uebersicht',soundOn:false,lastTick:Date.now()-60000,lastSeenVersion:version[1],lastLoginDate:new Date().toDateString(),seenTabHints:Object.fromEntries([...TABS,'einstellungen','hilfe','berichte'].map(key=>[key,true]))};}
 async function fixture(failingWebPs=[],tag=''){
  const store=new Map([['kepler7-save-v3',JSON.stringify(freshSave(tag))]]),requests=[],failSet=new Set(failingWebPs);
  if(tag){store.set('alliance:'+tag+':info',JSON.stringify({tag,creatorId:'founder',creatorName:'Gründer',createdAt:Date.now()-1e7,joinMode:'open'}));store.set('alliance:'+tag+':role:u',JSON.stringify({playerId:'u',name:'Kommandant',role:'member',joinedAt:Date.now()-1e7}));store.set('leaderboard:u',JSON.stringify({id:'u',name:'Kommandant',allianceTag:tag,score:5740,level:167}));}
  const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1'),entry={phase,path:u.pathname,method:req.method,at:Date.now()};requests.push(entry);
   const send=(status,body,mime='application/json')=>{entry.status=status;res.writeHead(status,{'Content-Type':mime,'Cache-Control':'no-store','Content-Length':Buffer.byteLength(body)});res.end(body);};
   const json=(value,status=200)=>send(status,JSON.stringify(value));
   try{if(u.pathname.startsWith('/api/')){const key=u.pathname.slice(5);if(key==='health')return json({ok:true});if(!(req.headers.cookie||'').includes('kepler7_graphics_fixture=isolated'))return json({error:'fixture session required'},401);
    if(key==='me')return json({userId:'u',username:'Kommandant',homeSystem:'kepler',homeSlot:0,hasEmail:true,wantsPatchnotes:false});
    if(key==='storage-list')return json({keys:[...store.keys()].filter(key=>key.startsWith(u.searchParams.get('prefix')||''))});
    if(key.startsWith('storage/')){const name=decodeURIComponent(key.slice(8));if(['PUT','POST'].includes(req.method)){let body='';for await(const chunk of req)body+=chunk;store.set(name,JSON.parse(body).value);return json({ok:true,version:1});}return store.has(name)?json({key:name,value:store.get(name),version:1}):json({},404);}
    if(/reports|leaderboard|messages|ranking|wars|halloffame|bounty|friends/.test(key))return json([]);
    if(key==='galaxy')return json({npcEmpireStrength:1.8,marketTrend:1,collapsedSystems:{},news:[],alienNester:[]});return json({});}
    const name=u.pathname==='/'?'weltraum_kolonie.html':decodeURIComponent(u.pathname.slice(1));
    if(failSet.has(name)){entry.expectedFailure=true;return send(404,'Missing controlled WebP','text/plain');}
    const file=path.resolve(WURZEL,name);if(!file.startsWith(WURZEL+path.sep))return send(403,'outside fixture','text/plain');
    const override=process.env.KEPLER_GFX_ASSET_OVERRIDE_DIR&&/^kepler-gfx-[a-z-]+\.webp$/.test(name)?path.join(process.env.KEPLER_GFX_ASSET_OVERRIDE_DIR,name):null;
    const bytes=name==='weltraum_kolonie.html'?Buffer.from(source):await fs.promises.readFile(override&&fs.existsSync(override)?override:file);
    const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.txt':'text/plain'}[path.extname(name)]||'application/octet-stream';return send(200,bytes,mime);
   }catch(error){entry.error=error.code||error.name;if(error.code==='ENOENT'){fixtureErrors.push({path:u.pathname,error:entry.error});return send(404,'missing fixture asset','text/plain');}fixtureErrors.push({path:u.pathname,error:error.message});if(!res.headersSent)json({error:'fixture failed'},500);else res.end();}
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;servers.push(server);
  const context=await browser.newContext({viewport:{width:1487,height:1058},deviceScaleFactor:1,serviceWorkers:'block'});
  await context.addCookies([{url:origin,name:'kepler7_graphics_fixture',value:'isolated',httpOnly:true,sameSite:'Lax'}]);
  await context.addInitScript(()=>localStorage.setItem('kepler7-ui-language','de'));
  const page=await context.newPage();page.on('pageerror',error=>allErrors.push(error.message));
  await page.goto(origin+'/?lang=de',{waitUntil:'commit',timeout:60000});
  await page.waitForFunction(()=>document.body?.classList.contains('command-ui')&&document.getElementById('commandPlayerName')?.textContent==='Kommandant'&&/automatisch geladen/i.test(document.getElementById('loadstate')?.textContent||''),null,{timeout:30000});
  await page.locator('#welcomeBackDismissBtn').waitFor({state:'visible',timeout:15000});await page.locator('#welcomeBackDismissBtn').click();await page.locator('#welcomeBackOverlay').waitFor({state:'hidden'});
  return {context,page,origin,requests,failSet,store};
 }
 const graphicRequests=run=>run.requests.filter(r=>/^\/kepler-gfx-[a-z-]+\.(?:png|webp)$/.test(r.path));
 const geometry=(page,selector)=>page.locator(selector).first().evaluate(e=>{const r=e.getBoundingClientRect();return {exists:!!e,src:e.getAttribute('src'),currentSrc:e.currentSrc||null,deferred:e.getAttribute('data-gfx-src'),ready:e.dataset.gfxReady||null,fallback:e.dataset.gfxFallback||null,loading:e.loading||null,priority:e.fetchPriority||null,complete:e.complete??null,naturalWidth:e.naturalWidth??null,naturalHeight:e.naturalHeight??null,top:r.top,bottom:r.bottom,width:r.width,height:r.height,viewport:innerHeight};});
 const imageReady=(page,selector,timeout=15000)=>nativeBoolean(page,selector=>{const e=document.querySelector(selector);if(!e?.complete||!(e.naturalWidth>0&&e.naturalHeight>0))return false;for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;},selector,timeout);
 async function wheelTo(run,selector){const before=await geometry(run.page,selector);await run.page.mouse.move(1420,550);await run.page.mouse.wheel(0,Math.round(before.top-300));return before;}
 async function tab(run,key){const button=run.page.locator('#commandNav .tab-btn[data-tab='+key+']');await button.scrollIntoViewIfNeeded();const hit=await button.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});if(!hit)throw Error('Native '+key+' tab not physically reachable');await button.click();await run.page.locator('#tab-'+key).waitFor({state:'visible'});return hit;}
 try{
  browser=await starteBrowser({args:['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  const run=await fixture();try{
   const loaded=await imageReady(run.page,'#colonyVisual .gfx-landscape');await delay(250);
   const tabs=await run.page.locator('#commandNav .tab-btn').evaluateAll(es=>es.map(e=>e.dataset.tab));
   await run.page.evaluate(()=>{window.__graphicsLoadingOriginalControls=[...document.querySelectorAll('#commandNav .tab-btn')];});
   check(labels.boot,loaded&&JSON.stringify(tabs)===JSON.stringify(TABS)&&run.requests.some(r=>r.path==='/api/me'&&r.status===200)&&run.requests.some(r=>r.path==='/api/storage/kepler7-save-v3'&&r.status===200));
   const mainImage=await geometry(run.page,'#colonyVisual .gfx-landscape');check(labels.main,loaded&&mainImage.src==='kepler-gfx-colony-developed.webp'&&mainImage.loading==='eager'&&mainImage.priority==='high',mainImage);
   const initial=graphicRequests(run).map(r=>r.path);check(labels.startup,initial.length===1&&initial[0]==='/kepler-gfx-colony-developed.webp',initial);
   const planets=await run.page.locator('#tab-basis .gfx-world-image').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {deferred:e.dataset.gfxSrc,src:e.getAttribute('src'),ready:e.dataset.gfxReady,top:r.top,width:r.width,height:r.height,viewport:innerHeight};}));
   check(labels.dormantImages,planets.length===5&&planets.every(e=>e.width>0&&e.height>0&&e.top>e.viewport+200&&/\.webp$/.test(e.deferred||'')&&!e.src&&e.ready!=='true'),planets);
   const atlasDormancy=await run.page.locator('#tab-basis .gfx-orbital-art,#tab-basis .gfx-world-art').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {ready:e.dataset.gfxReady,deferred:e.classList.contains('gfx-asset-deferred'),top:r.top,width:r.width,height:r.height,viewport:innerHeight};}));
   check(labels.dormantAtlases,atlasDormancy.length>=3&&atlasDormancy.every(e=>e.deferred&&e.width>0&&e.height>0&&e.top>e.viewport+200&&e.ready!=='true'),atlasDormancy);
   phase='orbital-scroll';const orbitalBefore=await wheelTo(run,'#tab-basis .gfx-orbital-art');const orbitalReady=await nativeBoolean(run.page,()=>{const e=document.querySelector('#tab-basis .gfx-orbital-art'),r=e?.getBoundingClientRect();return !!e&&e.dataset.gfxReady==='true'&&r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;});
   check(labels.orbitalScroll,orbitalBefore.ready!=='true'&&orbitalReady,{before:orbitalBefore,after:await geometry(run.page,'#tab-basis .gfx-orbital-art')});
   await delay(250);check(labels.orbitalRequest,run.requests.some(r=>r.phase==='orbital-scroll'&&r.path==='/kepler-gfx-orbital-atlas.webp'&&r.status===200)&&!run.requests.some(r=>r.path==='/kepler-gfx-orbital-atlas.png'),graphicRequests(run).filter(r=>r.path.includes('orbital-atlas')));
   phase='world-scroll';const worldBefore=await wheelTo(run,'#tab-basis .gfx-world-image');const worldReady=await imageReady(run.page,'#tab-basis .gfx-world-image');const worldAfter=await geometry(run.page,'#tab-basis .gfx-world-image');
   check(labels.worldScroll,worldBefore.ready!=='true'&&worldReady&&/\.webp$/.test(worldAfter.currentSrc||'')&&run.requests.some(r=>r.phase==='world-scroll'&&r.path.endsWith('planet-ocean.webp')&&r.status===200),{before:worldBefore,after:worldAfter});
   const visibleOK=await nativeBoolean(run.page,()=>{const es=[...document.querySelectorAll('img[data-gfx-fallback]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;});return es.length>0&&es.every(e=>e.complete&&e.naturalWidth>0&&e.naturalHeight>0);});check(labels.visible,visibleOK);
   phase='expedition-before-fleet';check(labels.expedition,await tab(run,'expedition'));
   await delay(250);check(labels.hiddenFleetMarkup,await run.page.locator('#fleet [data-gfx-ship-thumb]').count()===0);
   check(labels.hiddenFleetNetwork,!run.requests.some(r=>r.phase==='expedition-before-fleet'&&/^\/kepler-gfx-ship-/.test(r.path)),graphicRequests(run).filter(r=>r.phase==='expedition-before-fleet'));
   const expTile=run.page.locator('#expeditionVisual .gfx-expedition-art').first();if(await expTile.count())await wheelTo(run,'#expeditionVisual .gfx-expedition-art');
   const expeditionReady=await nativeBoolean(run.page,()=>{const e=document.querySelector('#expeditionVisual .gfx-expedition-art');return !!e&&e.dataset.gfxReady==='true';});
   check(labels.expeditionAtlas,expeditionReady&&run.requests.some(r=>r.phase==='expedition-before-fleet'&&r.path==='/kepler-gfx-expedition-atlas.webp'&&r.status===200));
   phase='notag-alliance-before-fleet';await tab(run,'allianz');await wheelTo(run,'#allianceHeroBanner');
   const allianceReady=await nativeBoolean(run.page,()=>{const e=document.getElementById('allianceHeroBanner'),r=e?.getBoundingClientRect();return !!e&&!!e.closest('.gfx-alliance-entry')&&e.dataset.gfxReady==='true'&&r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;});
   check(labels.alliance,allianceReady&&await run.page.locator('#allianceNameDisplay').innerText()==='Keine Allianz'&&run.requests.some(r=>r.phase==='notag-alliance-before-fleet'&&r.path==='/kepler-gfx-orbital-dock.webp'&&r.status===200),{element:await run.page.locator('#allianceHeroBanner').evaluate(e=>({style:e.getAttribute('style'),ready:e.dataset.gfxReady,pending:e.dataset.gfxPending,entry:!!e.closest('.gfx-alliance-entry')})),requests:run.requests.filter(r=>r.path.includes('orbital-dock'))});
   phase='notag-alliance-second-before-fleet';await tab(run,'basis');await tab(run,'allianz');await wheelTo(run,'#allianceHeroBanner');
   const allianceSecond=await nativeBoolean(run.page,()=>{const e=document.getElementById('allianceHeroBanner'),r=e?.getBoundingClientRect();return !!e&&!!e.closest('.gfx-alliance-entry')&&e.dataset.gfxReady==='true'&&getComputedStyle(e).backgroundImage.includes('kepler-gfx-orbital-dock.webp')&&r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0;});
   check(labels.allianceSecond,allianceSecond,{element:await run.page.locator('#allianceHeroBanner').evaluate(e=>({computed:getComputedStyle(e).backgroundImage,ready:e.dataset.gfxReady,entry:!!e.closest('.gfx-alliance-entry')}))});
   phase='fleet';await tab(run,'flotte');await wheelTo(run,'#shipyardVisual .gfx-native-ship canvas');
   const fleetReady=await nativeBoolean(run.page,()=>{const e=document.querySelector('#shipyardVisual .gfx-native-ship canvas');if(!e||e.dataset.shipArt!=='raster'||e.dataset.shipArtReady!=='true'||e.dataset.shipFormat!=='webp')return false;const r=e.getBoundingClientRect(),d=e.getContext('2d').getImageData(0,0,e.width,e.height).data;return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&d.some((v,i)=>i%4===3&&v>8);});
   const ship=await run.page.locator('#shipyardVisual .gfx-native-ship canvas').evaluate(e=>({key:e.dataset.shipIcon,art:e.dataset.shipArt,ready:e.dataset.shipArtReady,atlas:e.dataset.shipAtlas,crop:e.dataset.shipCrop,format:e.dataset.shipFormat}));
   check(labels.fleet,fleetReady&&run.requests.some(r=>r.phase==='fleet'&&r.path==='/'+ship.atlas+'.webp'&&r.status===200),ship);
   const fleetThumbs=await run.page.locator('#fleet [data-gfx-ship-thumb]').evaluateAll(es=>es.map(e=>({tag:e.tagName,key:e.dataset.gfxShipThumb,icon:e.dataset.shipIcon})));
   check(labels.fleetThumbnails,fleetThumbs.length===38&&new Set(fleetThumbs.map(e=>e.key)).size===38&&fleetThumbs.every(e=>e.tag==='CANVAS'&&e.icon===e.key)&&['ships','jaeger','cruisers','destroyers','carrier','frachter'].every(key=>fleetThumbs.some(e=>e.key===key))&&await run.page.locator('#fleet canvas[data-ship-icon="superschlachtschiff"]').count()===1,fleetThumbs);
   const atlasFor=key=>['ships','jaeger','cruisers','destroyers','schlachtschiff','superschlachtschiff','waechter','bomber','carrier','frachter','frachtergross','bergungsfrachter','colonyShips','recycler','spaeher','spionageschiff'].includes(key)?'regular':['paktkorvette','bundeskreuzer','sternenbanner','lotsenboot','kessel','bergungskran','presslufthai','ankerwerfer','echoschnitter','bannschiff','nullkiel','grundgaenger','forscher','gesandtenschiff','schuerfschiff','enterschiff'].includes(key)?'utility':'advanced';
   const rail=await run.page.locator('#shipyardVisual .gfx-ship-list canvas').evaluateAll(es=>es.map((e,index)=>{const r=e.getBoundingClientRect();return {index,key:e.dataset.shipIcon,ready:e.dataset.shipArtReady,art:e.dataset.shipArt,top:r.top,width:r.width,height:r.height,viewport:innerHeight};}));
   const distant=rail.find(e=>e.width>0&&e.height>0&&e.top>e.viewport+200&&e.ready!=='true');
   check(labels.railDormant,!!distant&&distant.art==='fallback'&&distant.ready!=='true',rail);
   let railOK=false,railWitness=null;if(distant){phase='rail-scroll';const locator=run.page.locator('#shipyardVisual .gfx-ship-list canvas').nth(distant.index);
    const wheel=await locator.evaluate(e=>{let container=e.parentElement;while(container){const s=getComputedStyle(container);if(/auto|scroll/.test(s.overflowY)&&container.scrollHeight>container.clientHeight+1)break;container=container.parentElement;}if(!container)return null;const r=container.getBoundingClientRect(),item=e.getBoundingClientRect(),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);return {x:r.x+r.width/2,y:(top+bottom)/2,delta:item.top-(top+bottom)/2+item.height/2,container:{top:r.top,bottom:r.bottom,width:r.width,height:r.height,scrollTop:container.scrollTop}};});
    if(wheel){await run.page.mouse.move(wheel.x,wheel.y);await run.page.mouse.wheel(0,Math.round(wheel.delta));}else{await run.page.mouse.move(1420,550);await run.page.mouse.wheel(0,Math.round(distant.top-300));}
    const end=Date.now()+15000;do{railOK=await locator.evaluate(e=>{const r=e.getBoundingClientRect(),d=e.getContext('2d').getImageData(0,0,e.width,e.height).data;return e.dataset.shipArt==='raster'&&e.dataset.shipArtReady==='true'&&e.dataset.shipFormat==='webp'&&r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&d.some((v,i)=>i%4===3&&v>8);});if(railOK)break;await delay(50);}while(Date.now()<end);
    railOK=railOK&&distant.ready!=='true'&&run.requests.filter(r=>r.path==='/kepler-gfx-ship-atlas-'+atlasFor(distant.key)+'.webp'&&r.status===200).length===1;
    railWitness={before:distant,wheel,after:await locator.evaluate(e=>{const r=e.getBoundingClientRect();return {key:e.dataset.shipIcon,ready:e.dataset.shipArtReady,art:e.dataset.shipArt,atlas:e.dataset.shipAtlas,format:e.dataset.shipFormat,top:r.top,bottom:r.bottom};}),requests:run.requests.filter(r=>r.phase==='rail-scroll'&&/^\/kepler-gfx-ship-/.test(r.path))};
   }
   check(labels.railScroll,railOK,railWitness);
   check(labels.identity,await run.page.evaluate(()=>window.__graphicsLoadingOriginalControls.length===13&&window.__graphicsLoadingOriginalControls.every((e,i)=>e===document.querySelectorAll('#commandNav .tab-btn')[i])&&document.querySelectorAll('.tab-btn').length===13));
  }finally{await run.context.close();}
  phase='native-fallback';const fallback=await fixture(['kepler-gfx-colony-developed.webp','kepler-gfx-orbital-atlas.webp','kepler-gfx-orbital-dock.webp']);try{
   const restored=await imageReady(fallback.page,'#colonyVisual .gfx-landscape',10000),data=await geometry(fallback.page,'#colonyVisual .gfx-landscape');
   check(labels.fallbackRequest,fallback.requests.filter(r=>r.path==='/kepler-gfx-colony-developed.webp'&&r.expectedFailure&&r.status===404).length===1&&fallback.requests.filter(r=>r.path==='/kepler-gfx-colony-developed.png'&&r.status===200).length===1);
   const png=fs.readFileSync(path.join(WURZEL,'kepler-gfx-colony-developed.png'));check(labels.fallbackDecode,restored&&data.currentSrc?.endsWith('.png')&&data.naturalWidth===png.readUInt32BE(16)&&data.naturalHeight===png.readUInt32BE(20)&&await fallback.page.locator('#colonyVisual .gfx-landscape').getAttribute('data-gfx-fallback-tried')==='true',data);
   const countBefore=fallback.requests.filter(r=>r.path==='/kepler-gfx-colony-developed.png').length;await fallback.page.locator('#colonyVisual .gfx-landscape').dispatchEvent('error');await delay(250);
   check(labels.fallbackOnce,restored&&countBefore===1&&fallback.requests.filter(r=>r.path==='/kepler-gfx-colony-developed.png').length===1&&(await geometry(fallback.page,'#colonyVisual .gfx-landscape')).currentSrc===data.currentSrc);
   phase='native-atlas-fallback';await wheelTo(fallback,'#tab-basis .gfx-orbital-art');const atlasRecovered=await nativeBoolean(fallback.page,()=>{const e=document.querySelector('#tab-basis .gfx-orbital-art');return !!e&&e.dataset.gfxReady==='true'&&e.style.backgroundImage.includes('kepler-gfx-orbital-atlas.png');},undefined,15000,()=>fallback.requests.some(r=>r.path==='/kepler-gfx-orbital-atlas.png'&&r.status===200));
   check(labels.atlasFallback,atlasRecovered&&fallback.requests.some(r=>r.path==='/kepler-gfx-orbital-atlas.webp'&&r.status===404&&r.expectedFailure)&&fallback.requests.some(r=>r.path==='/kepler-gfx-orbital-atlas.png'&&r.status===200),{atlasRecovered,element:await fallback.page.locator('#tab-basis .gfx-orbital-art').first().evaluate(e=>({style:e.getAttribute('style'),computed:getComputedStyle(e).backgroundImage,ready:e.dataset.gfxReady,pending:e.dataset.gfxPending})),requests:fallback.requests.filter(r=>r.path.includes('orbital-atlas'))});
   phase='native-alliance-fallback-before-fleet';await tab(fallback,'allianz');await wheelTo(fallback,'#allianceHeroBanner');const allianceRecovered=await nativeBoolean(fallback.page,()=>{const e=document.getElementById('allianceHeroBanner');return !!e&&!!e.closest('.gfx-alliance-entry')&&e.dataset.gfxReady==='true'&&e.style.backgroundImage.includes('kepler-gfx-orbital-dock.png');},undefined,15000,()=>fallback.requests.some(r=>r.phase==='native-alliance-fallback-before-fleet'&&r.path==='/kepler-gfx-orbital-dock.png'&&r.status===200));
   check(labels.allianceFallback,allianceRecovered&&fallback.requests.some(r=>r.phase==='native-alliance-fallback-before-fleet'&&r.path==='/kepler-gfx-orbital-dock.webp'&&r.status===404&&r.expectedFailure)&&fallback.requests.some(r=>r.phase==='native-alliance-fallback-before-fleet'&&r.path==='/kepler-gfx-orbital-dock.png'&&r.status===200),{element:await fallback.page.locator('#allianceHeroBanner').evaluate(e=>({style:e.getAttribute('style'),computed:getComputedStyle(e).backgroundImage,ready:e.dataset.gfxReady,pending:e.dataset.gfxPending})),requests:fallback.requests.filter(r=>r.path.includes('orbital-dock'))});
   phase='native-alliance-fallback-second-before-fleet';await tab(fallback,'basis');await tab(fallback,'allianz');await wheelTo(fallback,'#allianceHeroBanner');
   const pngRetained=await nativeBoolean(fallback.page,()=>{const e=document.getElementById('allianceHeroBanner'),r=e?.getBoundingClientRect(),bg=e?getComputedStyle(e).backgroundImage:'';return !!e&&!!e.closest('.gfx-alliance-entry')&&e.dataset.gfxReady==='true'&&bg.includes('kepler-gfx-orbital-dock.png')&&bg.includes('linear-gradient')&&e.style.getPropertyPriority('background-image')==='important'&&r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0;});
   check(labels.allianceFallbackSecond,pngRetained,{element:await fallback.page.locator('#allianceHeroBanner').evaluate(e=>({style:e.getAttribute('style'),computed:getComputedStyle(e).backgroundImage,priority:e.style.getPropertyPriority('background-image'),ready:e.dataset.gfxReady}))});
   // The intentional fallback faults have already been measured. Decoder/alpha
   // checks now fetch the actual canonical files, independently of those faults.
   fallback.failSet.clear();phase='asset-decode';for(const name of assetNames){
    let result;try{result=await fallback.page.evaluate(async name=>{const read=async extension=>{const response=await fetch('/'+name+'.'+extension),bytes=await response.arrayBuffer();return {response,bytes,bitmap:await createImageBitmap(new Blob([bytes],{type:extension==='webp'?'image/webp':'image/png'}))};};let p,w;try{p=await read('png');w=await read('webp');const h=new DataView(w.bytes),signature=String.fromCharCode(...new Uint8Array(w.bytes).slice(0,4))==='RIFF'&&String.fromCharCode(...new Uint8Array(w.bytes).slice(8,12))==='WEBP'&&h.getUint32(4,true)+8===w.bytes.byteLength;
     const canvas=document.createElement('canvas');canvas.width=p.bitmap.width;canvas.height=p.bitmap.height;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(p.bitmap,0,0);const pa=c.getImageData(0,0,canvas.width,canvas.height).data;c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(w.bitmap,0,0);const wa=c.getImageData(0,0,canvas.width,canvas.height).data;let alpha=true;for(let i=3;i<pa.length;i+=4)if(pa[i]!==wa[i]){alpha=false;break;}return {ok:p.response.status===200&&w.response.status===200&&w.response.headers.get('content-type')?.startsWith('image/webp')&&signature&&p.bitmap.width>0&&p.bitmap.width===w.bitmap.width&&p.bitmap.height===w.bitmap.height&&alpha,width:p.bitmap.width,height:p.bitmap.height,webpBytes:w.bytes.byteLength,pngBytes:p.bytes.byteLength,alphaIdentical:alpha,validHeader:signature};}finally{p?.bitmap.close();w?.bitmap.close();}},name);}catch(error){result={ok:false,error:error.message};}
    check(assetLabel(name),result.ok,result);
   }
  }finally{await fallback.context.close();}
  phase='native-member-before-fleet';const member=await fixture([],'TST');try{await tab(member,'allianz');await wheelTo(member,'#allianceHeroBanner');
   const memberReady=await nativeBoolean(member.page,()=>document.getElementById('allianceNameDisplay')?.textContent==='[TST]'&&!document.getElementById('allianceHeroBanner')?.closest('.gfx-alliance-entry'));
   await delay(250);check(labels.allianceMember,memberReady&&JSON.parse(member.store.get('kepler7-save-v3')).player.allianceTag==='TST'&&!member.requests.some(r=>/^\/kepler-gfx-orbital-dock\.(?:png|webp)$/.test(r.path)),{name:await member.page.locator('#allianceNameDisplay').innerText(),entry:await member.page.locator('#allianceHeroBanner').evaluate(e=>!!e.closest('.gfx-alliance-entry')),requests:member.requests.filter(r=>r.path.includes('orbital-dock'))});
  }finally{await member.context.close();}
  check(labels.script,allErrors.length===0,allErrors);check(labels.http,fixtureErrors.length===0,fixtureErrors);
  const actual=records.map(r=>r.name);if(JSON.stringify(actual)!==JSON.stringify(manifest))throw Error('Native loading guard manifest/order changed');
  const failures=records.filter(r=>!r.ok).length;console.log(records.length+' checks, '+failures+' failures');console.log((failures?'FAIL':'OK')+' - Native graphics loading');process.exitCode=failures?1:0;
 }finally{if(browser)await browser.close();for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
