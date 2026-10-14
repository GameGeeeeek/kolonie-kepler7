'use strict';
// Real HTTP save, native CSS layout and Chromium device metrics. Read-only DOM
// witnesses never invoke game renderers or replace its resize/visibility hooks.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {SPIELDATEI,WURZEL,SERVER_JS}=require('./lib/spieldatei');
const {starteBrowser}=require('./lib/umgebung');
const {fixture,tab,pointer,boolean,delay,save}=require('./lib/ship-raster-fixture');
const {canvasData,keys}=require('./test_ship_raster_art');
const hero='#shipyardVisual .gfx-native-ship canvas[data-ship-detail="true"]';
const legacyHero='#shipyardVisual .gfx-native-ship canvas:not([data-ship-detail])';
const thumb='#fleet canvas[data-gfx-ship-thumb="jaeger"]';
const labels={boot:'sharpness uses the authenticated native save and actual class picker',
 hidden:'native hide and reveal preserve a nonempty canonical ship image',
 reveal:'revealed ship canvases match their actual content size and device pixels',
 controls:'native resize painting preserves the original navigation and ship order controls',
 paint:'native gold paint and forge marks remain visible after backing-store resize',
 skin:'native standard gold and standard skin actions repaint retained HD and card canvases',
 quiet:'settled ship backing stores remain unchanged over subsequent native frames',
 frozen:'ship sharpness actions preserve every original runtime and backend byte',
 errors:'ship sharpness actions finish without JavaScript or fixture HTTP errors'};
const hdLabels={map:'all forty-six HD classes match the independent detail crop package',
 assets:'all twenty-four delivered detail images match their independent package hashes and natural dimensions',
 dormant:'an actual hidden fleet does not prefetch HD ship banks',
 lazy:'the visible native ship class requests only its genuinely consumed HD bank',
 primary:'the native HD hero is visible and its canonical legacy fallback is hidden after readiness',
 natural:'the actual HD hero crop contains more independent source pixels than the legacy crop',
 classes:'all forty-five actual native class selections paint their matching independent HD crop',
 cache:'native class visits reuse each HD bank without duplicate decodes or legacy hero requests',
 pending:'an actual pending HD response leaves the native canonical fallback visible',
 late:'native HD readiness replaces the fallback without replacing class or navigation controls',
 missing:'an actual missing HD WebP uses exactly one canonical PNG fallback',
 failed:'two actually failed HD formats retain the visible ready legacy hero',
 final:'all HD native actions preserve frozen bytes and finish without JavaScript or HTTP errors'};
const dprLabel=dpr=>'native hero and card backing stores cover actual CSS content at DPR '+dpr;
const aspectLabel=dpr=>'native hero and card retain their visible proportions at DPR '+dpr;
const pixelsLabel=dpr=>'native hero and card retain ready canonical pixels at DPR '+dpr;
const resizeLabel=width=>'native ship resize updates actual content backing stores at '+width+'px';
const resizePixelsLabel=width=>'native ship resize retains canonical pixels at '+width+'px';
const manifest=[labels.boot,...[1,2,3].flatMap(d=>[dprLabel(d),aspectLabel(d),pixelsLabel(d)]),
 ...[980,320,1487].flatMap(w=>[resizeLabel(w),resizePixelsLabel(w)]),
 labels.hidden,labels.reveal,labels.controls,labels.paint,labels.skin,labels.quiet,labels.frozen,labels.errors,
 ...Object.values(hdLabels)];
module.exports={manifest,labels,hdLabels,dprLabel,aspectLabel,pixelsLabel,resizeLabel,resizePixelsLabel,stableSkinSave};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function stableSkinSave(){
 // Only the additional skin-action case needs a static, affordable fleet list.
 // Native production and clocks continue normally; the original paint/DPR save
 // remains separate. Real empty queues and full factory stores avoid unrelated
 // construction/ETA changes replacing an otherwise correctly repainted card.
 const source=fs.readFileSync(SPIELDATEI,'utf8'),slice=(start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a);
  if(a<0||b<=a)throw Error('Native skin fixture data boundaries missing');return source.slice(a,b);
 };
 const data=vm.runInNewContext(slice('  function scaledShipCost(base, shipKey, n){','  // ===== Schiffs-Datenblatt')
  +slice('  const SHIP_DEFS = [','  k7RegisterDefinitions(SHIP_DEFS);')
  +slice('  const TIER2_DEFS = [','  k7RegisterDefinitions(TIER2_DEFS);')
  +'\n({ships:SHIP_DEFS.map(d=>({key:d.key,requires:d.requires,tiefe:d.tiefe,allianzSchiff:d.allianzSchiff,unlockItems:d.unlockItems,unlockEventParts:d.unlockEventParts,cost:d.costFn(0)})).concat([{key:"superschlachtschiff",cost:superschlachtschiffCost(0)}]),tiers:TIER2_DEFS});',{}, {timeout:1000});
 const s=save({shipSkin:'gold',battleStats:{wins:200,losses:0},shipMarks:{jaeger:8},
  buildQueue:[],constructionQueue:[],researchQueue:[],activeResearch:null,shipMarkJob:null});
 const tierKeys=new Set(data.tiers.map(d=>d.key));
 const baseCosts=data.ships.flatMap(d=>Object.entries(d.cost).filter(([r])=>!tierKeys.has(r)&&r!=='bergung'&&r!=='protomaterie').map(([,n])=>n));
 const budget=Math.ceil(Math.max(...baseCosts))*2;
 s.buildings={...s.buildings,lager:Math.max(s.buildings.lager||0,Math.ceil(budget/400))};
 s.resources={...s.resources};
 for(const key of Object.keys(s.resources))if(!tierKeys.has(key))s.resources[key]=Math.max(s.resources[key]||0,budget);
 const buildingSets=[s.buildings,...Object.values(s.colonies||{}).map(c=>c.buildings||{})];
 const highSecurity=buildingSets.reduce((sum,b)=>sum+(b.hochsicherheitslager||0),0),tierCaps={};
 for(const d of data.tiers){
  const level=buildingSets.reduce((sum,b)=>sum+(b[d.buildingKey]||0),0);
  if(level>0){const cap=d.storageBase+level*d.storagePerLevel+highSecurity*80;tierCaps[d.key]=cap;s.resources[d.key]=cap;}
 }
 const physical=data.ships.filter(d=>!d.tiefe&&!d.allianzSchiff&&!d.unlockItems&&!d.unlockEventParts&&d.requires
  &&d.requires.every(r=>(s.research[typeof r==='string'?r:r.key]||0)>=(typeof r==='string'?1:r.level)));
 if(!physical.length||physical.some(d=>Object.entries(d.cost).some(([r,n])=>(s.resources[r]||0)<n)))throw Error('Actual buildable skin-fixture ships must all be affordable');
 return {save:s,proof:{nativeClasses:data.ships.length,budget,baseStorageLowerBound:800+s.buildings.lager*400,
  warehouseLevel:s.buildings.lager,tierCaps,affordablePhysicalClasses:physical.map(d=>d.key),
  emptyQueues:s.buildQueue.length===0&&s.constructionQueue.length===0&&s.researchQueue.length===0&&!s.activeResearch&&!s.shipMarkJob}};
}
async function geometry(page,selector){return page.locator(selector).first().evaluate(c=>{
 const s=getComputedStyle(c),r=c.getBoundingClientRect(),num=key=>parseFloat(s[key])||0;
 const contentW=r.width-num('borderLeftWidth')-num('borderRightWidth')-num('paddingLeft')-num('paddingRight');
 const contentH=r.height-num('borderTopWidth')-num('borderBottomWidth')-num('paddingTop')-num('paddingBottom');
 let visible=c.isConnected&&contentW>0&&contentH>0;
 for(let p=c;p;p=p.parentElement){const t=getComputedStyle(p);visible=visible&&t.display!=='none'&&t.visibility==='visible'&&Number(t.opacity)>0;}
 return {connected:c.isConnected,visible,contentW,contentH,dpr:window.devicePixelRatio,objectFit:s.objectFit,
  width:c.width,height:c.height,art:c.dataset.shipArt,ready:c.dataset.shipArtReady,
  atlas:c.dataset.shipAtlas,crop:c.dataset.shipCrop,key:c.dataset.shipIcon,
  cssWidth:s.width,cssHeight:s.height,boxSizing:s.boxSizing};
 });}
const sharp=(g,index)=>{
 // CSS object-fit paints the authored image inside its content box. The source
 // HTML supplies 360:270 for the hero and 78:58 for the card; the oracle measures
 // that paint rectangle independently, without reading renderer bookkeeping.
 const ratio=index===0?360/270:78/58;
 const fit=['contain','scale-down'].includes(g.objectFit)?Math.min(g.contentW/ratio,g.contentH):g.contentH;
 const w=['contain','scale-down'].includes(g.objectFit)?fit*ratio:g.contentW,h=fit;
 return g.visible&&g.width>=w*g.dpr&&g.width<=Math.ceil(w*g.dpr)+1&&g.height>=h*g.dpr&&g.height<=Math.ceil(h*g.dpr)+1;
};
async function pixels(page,selector){return page.locator(selector).first().evaluate(c=>{
 const a=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;
 let count=0,warm=0,opaque=0,plaque=0;const h=c.height,w=c.width;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;
  if(a[i+3]>8)count++;
  if(a[i+3]>=200&&x>w*.3&&x<w*.7&&y>h*.3&&y<h*.7){opaque++;if(a[i]>a[i+2]+20)warm++;}
  if(x>w*.75&&y<h*.3&&a[i+3]>200&&a[i]>a[i+2]+20)plaque++;
 }
 return {count,warmFraction:opaque?warm/opaque:0,plaque,key:c.dataset.shipIcon,
  art:c.dataset.shipArt,ready:c.dataset.shipArtReady,atlas:c.dataset.shipAtlas,crop:c.dataset.shipCrop};
 });}
async function witness(run,oracles){
 const result=[];
 for(const [index,selector] of [hero,thumb].entries()){
  // A real fleet ETA update may replace a card while Playwright is waiting for
  // scroll geometry. Reacquire only a genuinely detached target, within the
  // same bounded native action; blocked/timeout and other failures stay fatal.
  const scrollDeadline=Date.now()+5000;let detachedScroll;
  do{
   try{await run.page.locator(selector).first().scrollIntoViewIfNeeded({timeout:Math.max(1,scrollDeadline-Date.now())});detachedScroll=null;break;}
   catch(error){if(!/Element is not attached to the DOM|Element is not connected|element was detached/i.test(error.message))throw error;detachedScroll=error;}
  }while(Date.now()<scrollDeadline);
  if(detachedScroll)throw detachedScroll;
  await boolean(run.page,sel=>{const c=document.querySelector(sel);return !!c&&c.dataset.shipArtReady==='true';},selector,5000);
  // A stale backing store must be observed, not repaired by test code. Wait for
  // consecutive equal native layout/backing samples, then read the actual state.
  let last=null,stable=0,end=Date.now()+2500,g;
  do{g=await geometry(run.page,selector);const key=JSON.stringify(g);stable=key===last?stable+1:0;last=key;if(stable>=4)break;await delay(50);}while(Date.now()<end);
  const data=await pixels(run.page,selector);
  if(oracles)data.canonicalDiff=(await canvasData(run.page,selector,oracles[index])).diff;
  result.push({...g,pixels:data,stable:stable>=4});
 }
 return result;
}
async function main(){
 const records=[],runs=[],check=(name,ok,data)=>{records.push({name,ok:!!ok});console.log((ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data)));};
 const runtime=[SPIELDATEI,...['kepler-graphics.css','kepler-english.json','service-worker.js','docs/ship-art-package.json','docs/ship-detail-art-package.json',
  ...fs.readdirSync(WURZEL).filter(name=>/^kepler-gfx-.*\.(png|webp)$/.test(name)).sort()].map(name=>path.join(WURZEL,name)),...(SERVER_JS?[SERVER_JS]:[])];
 const hashes=()=>runtime.map(file=>({file:path.basename(file),sha256:hash(file)})),before=hashes();
 const pkg=JSON.parse(fs.readFileSync(path.join(WURZEL,'docs/ship-art-package.json'),'utf8'));
 const canonical=pkg.groups.find(g=>g.tiles.some(t=>t.key==='jaeger'));
 const detailPackage=JSON.parse(fs.readFileSync(path.join(WURZEL,'docs/ship-detail-art-package.json'),'utf8'));
 const details=Object.fromEntries(detailPackage.groups.flatMap(g=>g.tiles.map(t=>[t.key,{...g,rect:t.rect}])));
 const oracle=[details.jaeger,{...canonical,rect:canonical.tiles.find(t=>t.key==='jaeger').rect}];
 const canonicalPixels=gs=>gs.every((g,i)=>g.stable&&g.pixels.count>20&&g.pixels.key==='jaeger'&&g.pixels.art==='raster'&&g.pixels.ready==='true'&&g.pixels.atlas===oracle[i].stem&&g.pixels.crop===oracle[i].rect.join(',')&&(g.pixels.canonicalDiff===undefined||g.pixels.canonicalDiff<18));
 const detailRequests=run=>run.requests.filter(r=>/^\/kepler-gfx-ship-detail-.*\.(?:png|webp)$/.test(r.path)&&r.destination==='image'&&!r.query.includes('oracle'));
 const primaryState=page=>page.locator('#shipyardVisual .gfx-native-ship').evaluate(e=>{
  const hd=e.querySelector('canvas[data-ship-detail="true"]'),legacy=e.querySelector('canvas:not([data-ship-detail])');
  return {ready:e.dataset.shipDetailReady,hdOpacity:hd?Number(getComputedStyle(hd).opacity):null,legacyOpacity:legacy?Number(getComputedStyle(legacy).opacity):null,
   hdReady:hd?.dataset.shipArtReady,hdAtlas:hd?.dataset.shipAtlas,legacyReady:legacy?.dataset.shipArtReady,legacyAtlas:legacy?.dataset.shipAtlas};
 });
 const readyPrimary=s=>s.ready==='true'&&s.hdOpacity===1&&s.legacyOpacity===0&&s.hdReady==='true';
 let browser;
 try{
  browser=await starteBrowser({args:['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  const run=await fixture(browser);runs.push(run);const dormantRequests=detailRequests(run).slice();await tab(run.page,'flotte');await pointer(run.page,'#shipyardVisual [data-gfx-ship="jaeger"]');
  check(labels.boot,await run.page.locator('#shipyardVisual [data-gfx-ship-picker]').inputValue()==='jaeger'&&await run.page.locator(thumb).count()===1&&run.requests.some(r=>r.path==='/api/storage/kepler7-save-v3'&&r.status===200));
  const cdp=await run.context.newCDPSession(run.page);
  const metrics=async(width,dpr)=>{await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:1058,deviceScaleFactor:dpr,mobile:false});await boolean(run.page,([w,d])=>innerWidth===w&&devicePixelRatio===d,[width,dpr]);};
  for(const dpr of [1,2,3]){
   await metrics(1487,dpr);const gs=await witness(run,oracle);
   check(dprLabel(dpr),gs.every((g,i)=>g.dpr===dpr&&sharp(g,i)),gs);
   // Visible proportions are independent of backing-store density. Neither a
   // larger bitmap nor a responsive update may enlarge/distort the CSS layout.
   check(aspectLabel(dpr),gs.every(g=>g.visible&&g.contentW/g.contentH>1.3&&g.contentW/g.contentH<1.4)&&Math.abs(gs[0].contentW-gs[0].contentH*4/3)<1,gs.map(({contentW,contentH})=>({contentW,contentH})));
   check(pixelsLabel(dpr),canonicalPixels(gs),gs.map(g=>g.pixels));
  }
  for(const width of [980,320,1487]){
   await metrics(width,2);const gs=await witness(run,oracle);
   check(resizeLabel(width),gs.every((g,i)=>g.dpr===2&&sharp(g,i)),gs);
   check(resizePixelsLabel(width),canonicalPixels(gs),gs.map(g=>g.pixels));
  }
  await tab(run.page,'basis');const hidden=await run.page.locator(hero).isHidden();await metrics(1280,3);await tab(run.page,'flotte');const revealed=await witness(run,oracle);
  check(labels.hidden,hidden&&canonicalPixels(revealed),revealed);
  check(labels.reveal,revealed.every((g,i)=>g.dpr===3&&sharp(g,i)),revealed);
  const controls=await run.page.locator('#commandNav .tab-btn,#fleet [data-buyship="jaeger"],#fleet [data-scrapship="jaeger"]').elementHandles();
  await metrics(1400,3);await witness(run);
  check(labels.controls,controls.length>=14&&(await Promise.all(controls.map(h=>h.evaluate(e=>e.isConnected&&e.tagName==='BUTTON'&&(e.matches('#commandNav .tab-btn')||typeof e.onclick==='function'))))).every(Boolean),{controls:controls.length});
  const gold=await fixture(browser,{save:{shipSkin:'gold',battleStats:{wins:200,losses:0},shipMarks:{jaeger:8}}});runs.push(gold);
  await tab(gold.page,'flotte');await pointer(gold.page,'#shipyardVisual [data-gfx-ship="jaeger"]');
  const goldCdp=await gold.context.newCDPSession(gold.page);await goldCdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1058,deviceScaleFactor:2,mobile:false});
  const painted=await witness(gold);check(labels.paint,canonicalPixels(painted)&&painted.every(g=>g.pixels.warmFraction>.5&&g.pixels.plaque>20),painted);
  const skinCase=stableSkinSave(),skinRun=await fixture(browser,{save:skinCase.save});runs.push(skinRun);
  await tab(skinRun.page,'flotte');await pointer(skinRun.page,'#shipyardVisual [data-gfx-ship="jaeger"]');
  const skinCdp=await skinRun.context.newCDPSession(skinRun.page);await skinCdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1058,deviceScaleFactor:2,mobile:false});
  const skinPainted=await witness(skinRun);
  const skinNodes=await skinRun.page.locator('#commandNav .tab-btn,#shipyardVisual [data-gfx-ship-picker],'+hero+','+thumb).elementHandles(),skinVisits=[];
  for(const skin of ['standard','gold','standard']){
   await tab(skinRun.page,'fortschritt');
   if(!await skinRun.page.locator('#commanderProfileBox [data-ship-skin="'+skin+'"]').isVisible())await pointer(skinRun.page,'#tab-fortschritt [data-sec-toggle="profil"]');
   await pointer(skinRun.page,'#commanderProfileBox [data-ship-skin="'+skin+'"]');
   const saveDeadline=Date.now()+3000;while(JSON.parse(skinRun.store.get('kepler7-save-v3')).shipSkin!==skin&&Date.now()<saveDeadline)await delay(40);
   const stored=JSON.parse(skinRun.store.get('kepler7-save-v3')).shipSkin;
   await tab(skinRun.page,'flotte');const data=await witness(skinRun),state=await primaryState(skinRun.page);
   const canonical=skin==='standard'?await Promise.all([canvasData(skinRun.page,hero,oracle[0]),canvasData(skinRun.page,thumb,oracle[1])]):null;
   skinVisits.push({skin,stored,data,state,canonical});
  }
  const firstWarm=skinPainted.map(g=>g.pixels.warmFraction);
  const retainedSkinNodes=await Promise.all(skinNodes.map(h=>h.evaluate(e=>({connected:e.isConnected,tag:e.tagName,id:e.id,key:e.dataset.shipIcon||e.dataset.gfxShipPicker||e.dataset.tab,detail:e.dataset.shipDetail}))));
  // Mk VIII's retained plaque and additions expand the rendered alpha bounds.
  // Compare its actual weighted RGB to the independent neutral source here;
  // unmarked class guards separately retain the full normalized-alpha oracle.
  check(labels.skin,skinNodes.length===16&&retainedSkinNodes.every(n=>n.connected)&&skinVisits.every(v=>v.stored===v.skin&&readyPrimary(v.state)&&v.data.every((g,i)=>g.pixels.plaque>20&&(v.skin==='gold'?g.pixels.warmFraction>.5:g.pixels.warmFraction<firstWarm[i]-.25))&&(v.skin!=='standard'||v.canonical.every(p=>p.count>20&&p.maxMeanRGBDiff<18))),{visits:skinVisits,retainedNodes:skinNodes.length,retainedSkinNodes,fixture:skinCase.proof});
  const quietBefore=await Promise.all([geometry(gold.page,hero),geometry(gold.page,thumb)]);await delay(500);const quietAfter=await Promise.all([geometry(gold.page,hero),geometry(gold.page,thumb)]);
  check(labels.quiet,JSON.stringify(quietBefore)===JSON.stringify(quietAfter),{before:quietBefore,after:quietAfter});
  check(labels.frozen,JSON.stringify(hashes())===JSON.stringify(before),{count:runtime.length,hashes:hashes()});
  check(labels.errors,runs.every(r=>!r.errors.length&&!r.httpErrors.length),{javascript:runs.flatMap(r=>r.errors),http:runs.flatMap(r=>r.httpErrors)});
  const source=fs.readFileSync(SPIELDATEI,'utf8'),declarationStart=source.indexOf('const SHIP_RASTER_ATLASES = Object.freeze({'),declarationEnd=source.indexOf('const shipRasterImages = new Map()',declarationStart);
  if(declarationStart<0||declarationEnd<=declarationStart)throw Error('Actual immutable ship declarations missing');
  const native=vm.runInNewContext(source.slice(declarationStart,declarationEnd)+'\nSHIP_DETAIL_ART;',{}, {timeout:1000});
  const tileKeys=detailPackage.groups.flatMap(g=>g.tiles.map(t=>t.key));
  check(hdLabels.map,detailPackage.groups.length===12&&tileKeys.length===46&&new Set(tileKeys).size===46&&Object.keys(native).length===46&&keys.every(k=>details[k]&&native[k]?.stem===details[k].stem&&JSON.stringify(native[k]?.rect)===JSON.stringify(details[k].rect)),{keys:tileKeys,groups:detailPackage.groups.length});
  const assetWitnesses=[];
  for(const group of detailPackage.groups){const dimensions=await run.page.evaluate(async g=>{
   const values=[];for(const ext of ['png','webp']){const image=new Image();image.src='/'+g.stem+'.'+ext+'?oracle=1';await image.decode();values.push({ext,width:image.naturalWidth,height:image.naturalHeight});}return values;
  },group);assetWitnesses.push({stem:group.stem,dimensions,hashes:['png','webp'].map(ext=>({ext,sha256:hash(path.join(WURZEL,group.stem+'.'+ext))}))});}
  check(hdLabels.assets,assetWitnesses.length===12&&assetWitnesses.every((w,i)=>w.dimensions.every(d=>d.width===detailPackage.groups[i].width&&d.height===detailPackage.groups[i].height)&&w.hashes.every(h=>h.sha256===detailPackage.groups[i][h.ext+'Sha256'])),assetWitnesses);
  check(hdLabels.dormant,dormantRequests.length===0,dormantRequests);
  const initialRequests=detailRequests(run);check(hdLabels.lazy,initialRequests.length===1&&initialRequests[0].path==='/'+details.jaeger.stem+'.webp'&&initialRequests[0].query==='?v='+details.jaeger.webpSha256.slice(0,12),initialRequests);
  const primary=await primaryState(run.page);check(hdLabels.primary,readyPrimary(primary)&&primary.hdAtlas===details.jaeger.stem&&primary.legacyReady==='true'&&primary.legacyAtlas===canonical.stem,primary);
  check(hdLabels.natural,details.jaeger.rect[2]>oracle[1].rect[2]&&details.jaeger.rect[3]>oracle[1].rect[3]&&detailPackage.groups.every(g=>g.tiles.every(t=>{const old=pkg.groups.flatMap(a=>a.tiles).find(old=>old.key===t.key);return old&&t.rect[2]*t.rect[3]>old.rect[2]*old.rect[3]&&t.rect[0]>=0&&t.rect[1]>=0&&t.rect[0]+t.rect[2]<=g.width&&t.rect[1]+t.rect[3]<=g.height;})),{detail:details.jaeger.rect,legacy:oracle[1].rect});
  const classResults=[];
  for(const key of keys.filter(k=>k!=='superschlachtschiff')){
   await run.page.locator('#shipyardVisual [data-gfx-ship-picker]').selectOption(key);await run.page.locator(hero).scrollIntoViewIfNeeded();
   await boolean(run.page,sel=>document.querySelector(sel)?.dataset.shipArtReady==='true',hero,5000);
   const data=await canvasData(run.page,hero,details[key]),visible=await primaryState(run.page);
   classResults.push({key,data,visible});
  }
  check(hdLabels.classes,classResults.length===45&&classResults.every(({key,data,visible})=>readyPrimary(visible)&&data.key===key&&data.ready==='true'&&data.art==='raster'&&data.format==='webp'&&data.atlas===details[key].stem&&data.crop===details[key].rect.join(',')&&data.count>20&&data.diff<18),classResults);
  const visitedRequests=detailRequests(run);check(hdLabels.cache,visitedRequests.length===12&&detailPackage.groups.every(g=>visitedRequests.filter(r=>r.path==='/'+g.stem+'.webp'&&r.query==='?v='+g.webpSha256.slice(0,12)&&r.status===200).length===1)&&!run.requests.some(r=>/^\/kepler-gfx-ship-(ships|jaeger|cruisers|destroyers|carrier|frachter)\.(png|webp)$/.test(r.path)),visitedRequests);
  const bank=details.jaeger.stem,held=await fixture(browser,{hold:[bank+'.webp']});runs.push(held);await tab(held.page,'flotte');await pointer(held.page,'#shipyardVisual [data-gfx-ship="jaeger"]');await held.page.locator(legacyHero).scrollIntoViewIfNeeded();
  await boolean(held.page,sel=>document.querySelector(sel)?.dataset.shipArtReady==='true',legacyHero,5000);
  const pending=await primaryState(held.page),pendingPixels=await canvasData(held.page,legacyHero,oracle[1]);
  check(hdLabels.pending,pending.hdOpacity===0&&pending.legacyOpacity===1&&pending.legacyReady==='true'&&pendingPixels.diff<18&&pendingPixels.count>20,{pending,pendingPixels});
  const heldControls=await held.page.locator('#commandNav .tab-btn,#shipyardVisual [data-gfx-ship-picker]').elementHandles();held.release();await boolean(held.page,sel=>document.querySelector(sel)?.dataset.shipArtReady==='true',hero,5000);const late=await primaryState(held.page);
  check(hdLabels.late,readyPrimary(late)&&heldControls.length===14&&(await Promise.all(heldControls.map(h=>h.evaluate(e=>e.isConnected)))).every(Boolean),{late,controls:heldControls.length});
  for(const failedFormats of [[bank+'.webp'],[bank+'.webp',bank+'.png']]){
   const fallback=await fixture(browser,{fail:failedFormats});runs.push(fallback);await tab(fallback.page,'flotte');await pointer(fallback.page,'#shipyardVisual [data-gfx-ship="jaeger"]');await fallback.page.locator(legacyHero).scrollIntoViewIfNeeded();
   await boolean(fallback.page,sel=>document.querySelector(sel)?.dataset.shipArtReady==='true',failedFormats.length===1?hero:legacyHero,5000);await delay(200);
   const state=await primaryState(fallback.page),requests=detailRequests(fallback);
   if(failedFormats.length===1){const data=await canvasData(fallback.page,hero,details.jaeger);check(hdLabels.missing,readyPrimary(state)&&data.format==='png'&&data.atlas===bank&&data.crop===details.jaeger.rect.join(',')&&data.diff<18&&requests.length===2&&requests.some(r=>r.path==='/'+bank+'.webp'&&r.status===404&&r.expected)&&requests.some(r=>r.path==='/'+bank+'.png'&&r.status===200&&r.query==='?v='+details.jaeger.pngSha256.slice(0,12)),{state,data,requests});}
   else{const data=await canvasData(fallback.page,legacyHero,oracle[1]);check(hdLabels.failed,state.hdOpacity===0&&state.legacyOpacity===1&&state.legacyReady==='true'&&data.art==='raster'&&data.atlas===canonical.stem&&data.diff<18&&requests.length===2&&requests.every(r=>r.status===404&&r.expected),{state,data,requests});}
  }
  check(hdLabels.final,JSON.stringify(hashes())===JSON.stringify(before)&&runs.every(r=>!r.errors.length&&!r.httpErrors.length),{hashes:hashes(),javascript:runs.flatMap(r=>r.errors),http:runs.flatMap(r=>r.httpErrors)});
  if(JSON.stringify(records.map(r=>r.name))!==JSON.stringify(manifest))throw Error('Native sharpness guard manifest or order changed');
  const failures=records.filter(r=>!r.ok).length;console.log(records.length+' checks, '+failures+' failures');
  console.log((failures?'FAIL':'OK')+' - Native ship raster sharpness | '+JSON.stringify({checks:records.length,failures}));process.exitCode=failures?1:0;
 }finally{for(const run of runs)await run.close();if(browser)await browser.close();}
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
