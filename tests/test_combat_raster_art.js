'use strict';
// Physical native controls, original reports and actual drawImage source pixels.
// The fixed independent manifest also applies to every genuine broken copy.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {SPIELDATEI,WURZEL,SERVER_JS}=require('./lib/spieldatei'),{starteBrowser}=require('./lib/umgebung');
const {fixture,save,pointer,tab,boolean,delay,reports,openReplay,closeReplay,state,observeDraws,observation,resetObservation}=require('./lib/combat-raster-fixture');
const {canvasData}=require('./test_ship_raster_art');
const labels={
 package:'all twenty-nine active combat crops match the independent art package',
 assets:'all six delivered combat atlas bytes match the independent SHA256 package',
 alpha:'all three combat atlases preserve decoded alpha and opaque RGB with visible crop margins',
 dormant:'native startup and a real Expedition visit request no hidden combat atlas',
 own:'the real outgoing replay draws canonical FX pixels for the correct native parties',
 incoming:'the real incoming replay draws canonical FX pixels for the correct native parties',
 bosses:'all twelve native boss reports draw their corresponding canonical creature pixels',
 rift:'the real void-rift report draws its canonical celestial crop without invented enemy hulls',
 late:'late combat artwork repaints a paused replay without replacing controls or resetting time',
 resume:'the same native pause control resumes the existing replay after artwork arrives',
 reduced:'reduced-motion replay artwork keeps the genuine static end frame and controls',
 fallback:'an actual missing combat WebP decodes one PNG fallback and paints its canonical FX',
 composition:'the actual mission arrival retains only its positive finite composition in the map snapshot',
 map:'the actual map battle paints canonical hull and FX pixels without SMIL under reduced motion',
 mapLife:'map artwork readiness preserves native controls and the original eight-second battle lifetime',
 hashes:'all 113 original runtime and backend hashes remain frozen through every combat action',
 script:'every native combat artwork action finishes without JavaScript errors',
 http:'every actual combat HTTP save and asset request finishes without unexpected fixture errors'
};
const manifest=Object.values(labels),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
module.exports={labels,manifest};
const controls='#osBtnNeustart,#osBtnPause,#osBtnTempo,#osBtnEnde,#battleModalCloseBtn';
const combatRequests=(run,pkg)=>run.requests.filter(r=>pkg.groups.some(g=>r.path==='/'+g.stem+'.webp'||r.path==='/'+g.stem+'.png')&&r.destination==='image'&&!r.query.includes('oracle'));
const alive=async handles=>handles.length===5&&(await Promise.all(handles.map(h=>h.evaluate(e=>e.isConnected&&e===document.getElementById(e.id))))).every(Boolean);
const frame=page=>page.locator('#osCv').evaluate(async c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');});
async function paintWait(page,key,timeout=10000){return boolean(page,key=>{try{return JSON.parse(document.getElementById('osWrap').dataset.zustand).artRaster.drawn.includes(key);}catch{return false;}},key,timeout);}
async function party(page,ownSide){return page.evaluate(ownSide=>{
 const read=side=>{const root=document.getElementById('osTafel'+side),color=getComputedStyle(root.querySelector('.tafel-marke')).backgroundColor.match(/\d+/g).map(Number);return {role:root.querySelector('.tafel-rolle').textContent,color};};
 const mine=read(ownSide),other=read(ownSide==='A'?'D':'A');return mine.role==='Du'&&other.role==='Gegner'&&mine.color[1]>mine.color[0]&&mine.color[1]>mine.color[2]&&other.color[0]>other.color[1]&&other.color[0]>other.color[2];
},ownSide);}
async function collect(run,until){const samples=[],end=Date.now()+30000;do{const value=await state(run.page);if(value)samples.push(value);if(value?.t>=until)break;await delay(200);}while(Date.now()<end);return {samples,painted:await observation(run.page)};}
async function main(){
 const source=fs.readFileSync(SPIELDATEI,'utf8'),pkg=JSON.parse(fs.readFileSync(path.join(WURZEL,'docs/combat-art-package.json'),'utf8'));
 const families=pkg.activeFamilies,active=[...families.effects,...families.bosses,...families.rift],oracle=Object.fromEntries(pkg.groups.flatMap(group=>group.tiles.filter(t=>active.includes(t.key)).map(t=>[t.key,{...group,rect:t.rect}]))),records=[],runs=[];
 const runtime=[SPIELDATEI,...['kepler-graphics.css','service-worker.js','kepler-english.json',...fs.readdirSync(WURZEL).filter(name=>/^kepler-gfx-.*\.(png|webp)$/.test(name)).sort()].map(name=>path.join(WURZEL,name)),...(SERVER_JS?[SERVER_JS]:[])];
 const hashes=()=>runtime.map(file=>({file:path.basename(file),sha256:sha(fs.readFileSync(file))})),before=hashes();let browser;
 const check=(name,ok,data)=>{records.push({name,ok:!!ok});console.log((ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data)));};
 const create=async options=>{const run=await fixture(browser,options);runs.push(run);return run;};
 try{
  let declaration;try{const start='const COMBAT_RASTER_ART=Object.freeze({',end='const combatRasterImages = new Map(), combatRasterCrops = new Map();',a=source.indexOf(start),b=source.indexOf(end,a+start.length);if(source.split(start).length!==2||source.split(end).length!==2||a<0||b<=a)throw Error('Unique actual combat declaration anchors absent');declaration=vm.runInNewContext(source.slice(a,b)+'\n({art:COMBAT_RASTER_ART,fx:COMBAT_RASTER_FX_KEYS,bosses:COMBAT_RASTER_BOSS_KEYS});',{}, {timeout:1000});}catch(error){declaration={error:error.message};}
  check(labels.package,!declaration.error&&active.length===29&&new Set(active).size===29&&families.effects.length===16&&families.bosses.length===12&&families.rift.join(',')==='riss'&&Object.keys(declaration.art||{}).length===29&&JSON.stringify([...declaration.fx])===JSON.stringify(families.effects)&&JSON.stringify([...declaration.bosses])===JSON.stringify(families.bosses)&&active.every(key=>oracle[key]&&declaration.art[key]?.stem===oracle[key].stem&&JSON.stringify(declaration.art[key]?.rect)===JSON.stringify(oracle[key].rect)),declaration.error);
  check(labels.assets,pkg.groups.length===3&&pkg.groups.every(g=>['png','webp'].every(ext=>sha(fs.readFileSync(path.join(WURZEL,g.stem+'.'+ext)))===g[ext+'Sha256'])));
  browser=await starteBrowser({args:['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  const data=reports(),allReports=[data.own,data.incoming,...data.bosses.map(b=>b.report),data.rift];
  const run=await create({reports:allReports});await delay(200);await tab(run.page,'expedition');await delay(200);
  const dormantCount=combatRequests(run,pkg).length;
  const alpha=await run.page.evaluate(async groups=>{const results=[];for(const g of groups){const read=async ext=>{const image=new Image();image.src='/'+g.stem+'.'+ext+'?oracle=1';await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);return {width:canvas.width,height:canvas.height,pixels:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data};};const p=await read('png'),w=await read('webp');let alphaDiff=0,opaqueDiff=0,premultMax=0,escaped=0;for(let i=0;i<p.pixels.length;i+=4){if(p.pixels[i+3]!==w.pixels[i+3])alphaDiff++;for(let k=0;k<3;k++){if(p.pixels[i+3]===255&&p.pixels[i+k]!==w.pixels[i+k])opaqueDiff++;premultMax=Math.max(premultMax,Math.abs(p.pixels[i+k]*p.pixels[i+3]/255-w.pixels[i+k]*w.pixels[i+3]/255));}if(p.pixels[i+3]>=g.visibilityAlphaThreshold){const x=(i/4)%p.width,y=Math.floor(i/4/p.width);if(!g.tiles.some(t=>x>=t.rect[0]&&x<t.rect[0]+t.rect[2]&&y>=t.rect[1]&&y<t.rect[1]+t.rect[3]))escaped++;}}results.push({stem:g.stem,alphaDiff,opaqueDiff,premultMax,escaped,width:p.width,height:p.height,webpWidth:w.width,webpHeight:w.height});}return results;},pkg.groups);
  check(labels.alpha,alpha.length===3&&alpha.every(a=>a.alphaDiff===0&&a.opaqueDiff===0&&a.premultMax<=2&&a.escaped===0&&a.width===1254&&a.height===1254&&a.webpWidth===1254&&a.webpHeight===1254),alpha);
  check(labels.dormant,dormantCount===0&&await run.page.locator('#commandNav .tab-btn').count()===13,combatRequests(run,pkg));
  await observeDraws(run.page,oracle);
  for(const [report,side,label] of [[data.own,'A',labels.own],[data.incoming,'D',labels.incoming]]){
   await resetObservation(run.page);await openReplay(run,report.id);await pointer(run.page,'#osBtnTempo');const measured=await collect(run,32),last=measured.samples.at(-1),keys=Object.keys(measured.painted.records),required=['pulse-cyan','pulse-red','lance-blue','torpedo','impact-amber'];
   check(label,last?.t>=32&&await party(run.page,side)&&required.every(k=>keys.includes(k)&&last.artRaster.drawn.includes(k))&&keys.some(k=>k.startsWith('engine-'))&&last.artRaster.hullFragments>0&&measured.painted.fragments>0&&last.artRaster.fragmentKeys.length>0,{time:last?.t,actualPixelKeys:keys,fragments:measured.painted.fragments,nativeArt:last?.artRaster});await closeReplay(run);
  }
  await run.close();
  const bosses=await create({reports:allReports,reduced:true});await observeDraws(bosses.page,oracle);const bossResults=[];
  for(const item of data.bosses){await resetObservation(bosses.page);await openReplay(bosses,item.report.id);const ready=await paintWait(bosses.page,item.key);const current=await state(bosses.page),painted=await observation(bosses.page);bossResults.push({key:item.key,ready,boss:current?.artRaster?.boss,pixels:painted.records[item.key]||null,opponentRows:await bosses.page.locator('#osTafelD .zeile').count()});await closeReplay(bosses);}
  check(labels.bosses,bossResults.length===12&&bossResults.every(r=>r.ready&&r.boss===r.key&&r.pixels?.calls>0&&r.opponentRows===0),bossResults);
  await resetObservation(bosses.page);await openReplay(bosses,data.rift.id);const riftReady=await paintWait(bosses.page,'riss'),riftState=await state(bosses.page),riftPaint=await observation(bosses.page);
  check(labels.rift,riftReady&&riftState?.artRaster?.riss===true&&riftState.artRaster.boss===null&&riftPaint.records.riss?.calls>0&&await bosses.page.locator('#osTafelD .zeile').count()===0,{state:riftState?.artRaster,painted:riftPaint});await bosses.close();
  const fxStem=pkg.groups.find(g=>g.group==='effects').stem,creatureStem=pkg.groups.find(g=>g.group==='creatures').stem;
  const late=await create({reports:[data.own],hold:[fxStem+'.webp']});await observeDraws(late.page,oracle);await openReplay(late,data.own.id);await boolean(late.page,()=>JSON.parse(document.getElementById('osWrap').dataset.zustand).t>=3);await pointer(late.page,'#osBtnPause');await delay(100);
  const lateControls=await late.page.locator(controls).elementHandles(),beforeLate=await state(late.page),beforeFrame=await frame(late.page);late.release();await paintWait(late.page,'engine-cyan');await delay(250);const afterLate=await state(late.page),latePaint=await observation(late.page),afterFrame=await frame(late.page);await delay(400);
  // Running diagnostics publish once per simulated second; the native ready
  // callback publishes the exact paused time. This bounded lag is not a reset.
  check(labels.late,beforeLate.t>0&&afterLate.t>=beforeLate.t&&afterLate.t<=beforeLate.t+1.1&&beforeFrame!==afterFrame&&latePaint.records['engine-cyan']?.calls>0&&await alive(lateControls)&&await late.page.locator('#osBtnPause').textContent()==='Weiter'&&await frame(late.page)===afterFrame,{beforeTime:beforeLate.t,afterTime:afterLate.t,painted:latePaint});
  await pointer(late.page,'#osBtnPause');const resumed=await boolean(late.page,t=>JSON.parse(document.getElementById('osWrap').dataset.zustand).t>t+.5,afterLate.t);check(labels.resume,resumed&&await alive(lateControls)&&await late.page.locator('#osBtnPause').textContent()==='Pause',{before:afterLate.t,after:(await state(late.page)).t});await late.close();
  const rm=await create({reports:[data.bosses[0].report],reduced:true,hold:[creatureStem+'.webp']});await observeDraws(rm.page,oracle);await openReplay(rm,data.bosses[0].report.id);const rmControls=await rm.page.locator(controls).elementHandles(),rmBefore=await state(rm.page);rm.release();await paintWait(rm.page,'sternenfresser');await delay(250);const rmAfter=await state(rm.page),rmPaint=await observation(rm.page),rmFrame=await frame(rm.page);await delay(500);const rmLater=await state(rm.page),rmLaterPaint=await observation(rm.page);
  check(labels.reduced,rmBefore.t>40&&rmAfter.t===rmBefore.t&&rmLater.t===rmBefore.t&&rmPaint.records.sternenfresser?.calls>0&&rmLaterPaint.drawCalls===rmPaint.drawCalls&&await frame(rm.page)===rmFrame&&await alive(rmControls)&&await rm.page.locator('#osRm').isVisible(),{before:rmBefore.t,after:rmAfter.t,later:rmLater.t,painted:rmPaint,drawCallsLater:rmLaterPaint.drawCalls});await rm.close();
  const fallback=await create({reports:[data.own],fail:[fxStem+'.webp']});await observeDraws(fallback.page,oracle);await openReplay(fallback,data.own.id);await paintWait(fallback.page,'engine-cyan');const fallbackState=await state(fallback.page),fallbackPaint=await observation(fallback.page),fallbackRequests=combatRequests(fallback,pkg).filter(r=>r.path.startsWith('/'+fxStem+'.'));
  check(labels.fallback,fallbackRequests.length===2&&fallbackRequests[0].path.endsWith('.webp')&&fallbackRequests[0].status===404&&fallbackRequests[1].path.endsWith('.png')&&fallbackRequests[1].status===200&&fallbackRequests.every(r=>r.query==='?v='+pkg.groups.find(g=>g.stem===fxStem)[r.path.endsWith('.png')?'pngSha256':'webpSha256'].slice(0,12))&&fallbackState?.artRaster?.assets['engine-cyan']?.format==='png'&&fallbackState.artRaster.assets['engine-cyan'].fallback===true&&fallbackPaint.records['engine-cyan']?.calls>0,{requests:fallbackRequests,art:fallbackState?.artRaster,painted:fallbackPaint});await fallback.close();
  const now=Date.now(),arrival=now+14000,base=save(),composition={quantenkreuzer:1,cruisers:2,jaeger:7,bomber:0,waechter:-1,hyperjaeger:'not-finite',unknown:9};
  const map=await create({reduced:true,hold:[fxStem+'.webp','kepler-gfx-ship-atlas-regular.webp'],save:{fleet:{...base.fleet,missions:[{id:'combat-map-native',type:'attack',targetId:'raider1',startTime:arrival-300000,endTime:arrival+300000,fleetName:'Gefechtsgrafik',composition}]}}});
  await tab(map.page,'karte');await pointer(map.page,'#galaxyMapSvg [data-sektor="kepler"]');await pointer(map.page,'#galaxyMapSvg [data-sektor-sys="kepler"]');await map.page.locator('#galaxyMapSvg').scrollIntoViewIfNeeded();
  const mapControls=await map.page.locator('#commandNav .tab-btn').elementHandles();const battle=await boolean(map.page,()=>!!document.querySelector('#galaxyMapSvg [data-map-kampf]'),null,20000),seenAt=Date.now();
  const modelKeys=battle?await map.page.locator('#galaxyMapSvg [data-map-kampf]').first().getAttribute('data-map-kampf-modelle'):null,expectedKeys=['quantenkreuzer','cruisers','jaeger'];
  check(labels.composition,battle&&modelKeys?.split(',').length===3&&expectedKeys.every(k=>modelKeys.split(',').includes(k)),{battle,modelKeys,expectedKeys,arrival});
  map.release();const mapReady=await boolean(map.page,()=>[...document.querySelectorAll('#galaxyMapSvg [data-map-kampf] [data-map-combat-art]')].some(e=>e.getAttribute('href')?.startsWith('data:image/png'))&&[...document.querySelectorAll('#galaxyMapSvg [data-map-kampf] [data-map-kampf-schiff]')].some(e=>e.dataset.shipArtReady==='true'),null,5000);
  const shipPackage=JSON.parse(fs.readFileSync(path.join(WURZEL,'docs/ship-art-package.json'),'utf8')),shipOracle=Object.fromEntries(shipPackage.groups.flatMap(g=>g.tiles.map(t=>[t.key,{...g,rect:t.rect}]))),mapPixelResults=[];
  for(const key of expectedKeys){let pixels;try{const selector='#galaxyMapSvg [data-map-kampf] image[data-map-kampf-schiff="'+key+'"]';if(!await map.page.locator(selector).count())throw Error('Native battle hull absent: '+key);pixels=await canvasData(map.page,selector,shipOracle[key]);}catch(error){pixels={error:error.message};}mapPixelResults.push({key,pixels});}
  for(const key of ['lance-blue','impact-amber']){let pixels;try{const selector='#galaxyMapSvg [data-map-kampf] image[data-map-combat-art="'+key+'"]';if(!await map.page.locator(selector).count())throw Error('Native battle FX absent: '+key);pixels=await canvasData(map.page,selector,oracle[key]);}catch(error){pixels={error:error.message};}mapPixelResults.push({key,pixels});}
  const mapLayout=await map.page.evaluate(()=>{const e=document.querySelector('#galaxyMapSvg [data-map-kampf]');return e?{reduced:e.dataset.mapKampfReduziert,animations:e.querySelectorAll('animate,animateTransform,animateMotion').length,pointerless:e.getAttribute('pointer-events')==='none'&&[...e.querySelectorAll('[data-map-combat-art],[data-map-kampf-schiff]')].every(n=>n.getAttribute('pointer-events')==='none')}:null;});
  check(labels.map,mapReady&&mapLayout?.reduced==='true'&&mapLayout.animations===0&&mapLayout.pointerless&&mapPixelResults.length===5&&mapPixelResults.every(r=>r.pixels.count>20&&r.pixels.diff<18&&r.pixels.maxMeanRGBDiff<=3),{layout:mapLayout,results:mapPixelResults});
  const expired=await boolean(map.page,()=>!document.querySelector('#galaxyMapSvg [data-map-kampf]'),null,12000),expiredAt=Date.now(),mapIdentity=mapControls.length===13&&(await Promise.all(mapControls.map((h,i)=>h.evaluate((e,i)=>e.isConnected&&e===document.querySelectorAll('#commandNav .tab-btn')[i],i)))).every(Boolean);
  check(labels.mapLife,battle&&expired&&expiredAt-seenAt>=5000&&expiredAt-seenAt<=10500&&expiredAt<arrival+300000&&mapIdentity,{seenAt,expiredAt,lifetime:expiredAt-seenAt,returnedAt:arrival+300000,mapIdentity});await map.close();
  check(labels.hashes,runtime.length===113&&JSON.stringify(hashes())===JSON.stringify(before),{count:runtime.length,hashes:hashes()});
  check(labels.script,runs.every(r=>r.errors.length===0),runs.flatMap(r=>r.errors));check(labels.http,runs.every(r=>r.httpErrors.length===0),runs.flatMap(r=>r.httpErrors));
  if(JSON.stringify(records.map(r=>r.name))!==JSON.stringify(manifest))throw Error('Complete native combat manifest or order changed');const failures=records.filter(r=>!r.ok).length;console.log(records.length+' checks, '+failures+' failures');console.log((failures?'FAIL':'OK')+' - Native combat raster art');process.exitCode=failures?1:0;
 }finally{for(const run of runs)await run.close();if(browser)await browser.close();}
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
