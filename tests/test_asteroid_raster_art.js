'use strict';
// Independent package pixels, authenticated HTTP save and physical native UI.
// No game exports, renderer calls, replacement clocks or force clicks.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {SPIELDATEI,WURZEL,SERVER_JS}=require('./lib/spieldatei');
const {starteBrowser}=require('./lib/umgebung');
const {fixture,save,tab,pointer,boolean,delay}=require('./lib/ship-raster-fixture');
const sorts='eisen prisma eiskern magnetit hydrat klathrat pechblende resonanz kometenkern urmaterie'.split(' ');
const pixelLabel=key=>'native mining deposit paints the independent '+key+' crop';
const labels={package:'ten native mining sorts match the independent asteroid package',assets:'both delivered asteroid formats match package bytes and dimensions',
 rgba:'decoded asteroid PNG and WebP retain identical opaque pixels and alpha',dormant:'a hidden mining map does not request its asteroid atlas',
 geometry:'all ten original mining hit rectangles still contain the same-size illustration',rights:'original own and foreign mining rights keep their rings holder labels and protection',
 peil:'private mining bearings paint their independent crops and keep their separate dashed rings',menu:'the native mining menu paints its actual gold deposit and retains resource shares',
 hidden:'every loaded mining illustration hides its original polygon and mineral-vein fallback',gold:'the actual Urmaterie crop keeps a distinct golden mineral identity',
 actions:'the original mining action opens the actual fleet preview without starting a mission',
 pending:'a genuinely pending asteroid response retains every visible original mining polygon',late:'actual delayed asteroid readiness paints the retained native map nodes',
 png:'a genuinely missing asteroid WebP loads exactly one canonical PNG fallback',failed:'two genuinely failed asteroid formats retain the complete visible original mining markers',
 once:'failed asteroid formats are requested once and retain their native fallback after a real revisit',
 banners:'both native asteroid banner choices paint decoded canonical motifs without original polygon bleed',
 bannerControls:'the original alliance banner roles and native selection action remain usable',
 heroPixels:'native bronze ash and bronze selections paint their actual independent hero crops',
 controls:'mining artwork does not replace native navigation or mining hit controls',
 frozen:'asteroid native actions preserve every original runtime asset package and backend byte',errors:'asteroid native actions finish without JavaScript or fixture HTTP errors'};
const manifest=[labels.package,labels.assets,labels.rgba,labels.dormant,...sorts.map(pixelLabel),labels.geometry,labels.rights,labels.peil,labels.menu,labels.hidden,labels.gold,
 labels.actions,labels.pending,labels.late,labels.png,labels.failed,labels.once,labels.banners,labels.bannerControls,labels.heroPixels,labels.controls,labels.frozen,labels.errors];
const counterFailures={visibleFallback:[labels.hidden],wrongGold:[pixelLabel('urmaterie'),labels.peil,labels.menu,labels.gold,labels.banners,labels.heroPixels],drawnBanner:[labels.banners,labels.heroPixels],bannerHref:[labels.banners,labels.heroPixels],staleHero:[labels.heroPixels],bannerTransform:[labels.banners,labels.heroPixels],delayedBackground:[labels.banners],coveredBanner:[labels.banners,labels.heroPixels]};
module.exports={manifest,labels,sorts,pixelLabel,counterFailures};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const mapNode=place=>'#galaxyMapSvg [data-map-asteroid="'+place+'"]';
function options(extra={}){
 const base=save(),future=Date.now()+7*86400000,plaetze={};
 sorts.forEach((sorte,index)=>{plaetze[index]={sorte,groesse:['splitter','brocken','kern','koloss'][index%4],vorrat:42000};});
 Object.assign(plaetze[0],{halter:'u',halterName:'Kommandant',tag:'ART',eskorte:{jaeger:12},schutzBis:future});
 Object.assign(plaetze[1],{halter:'foreign',halterName:'Rivale',tag:'RIV',eskorte:{},schutzBis:future});
 return {...extra,save:{...base,player:{...base.player,id:'u',name:'Kommandant',allianceTag:'ART',allianceRole:'admin'},
  research:{...base.research,rminentechnik:1},fleet:{...base.fleet,schuerfschiff:20,missions:[]},
  // The native field loader synchronizes a holder's stationed escort. Match
  // its actual save and server document; do not answer a legitimate claim with {}.
  asteroidEskorten:{'kepler:0':{schiffe:{jaeger:12},heimat:'home',seit:Date.now()-60000}},
  peilungen:[{id:'p1',system:'kepler',sorte:'urmaterie',groesse:'kern',vorrat:480000,gefundenAm:Date.now(),verfaelltAm:future},
   {id:'p2',system:'kepler',sorte:'prisma',groesse:'koloss',vorrat:1200000,gefundenAm:Date.now(),verfaelltAm:future}]},
  // Match the real shared-storage wire value before navigation. Native role
  // synchronization remains active, including its ordinary 15-second refresh.
  sharedStorage:{'alliance:ART:role:u':JSON.stringify({role:'admin'})},
  api:{'asteroid/field':{systeme:['kepler'],felder:{kepler:{plaetze}}},
   'asteroid/claim':{halter:'u',halterName:'Kommandant',tag:'ART',seit:Date.now()-60000,eskorte:{jaeger:12},schutzBis:future}}};
}
async function openMap(run){
 await tab(run.page,'karte');await run.page.locator('#galaxyMapSvg').scrollIntoViewIfNeeded();
 // The real region contains its own hint-menu hit target. A physical region
 // click can therefore expose either the actual system nodes or its actual
 // Kepler shortcut menu; both controls call the native galaxyOeffne handler.
 await pointer(run.page,'#galaxyMapSvg [data-sektor="kepler"]');
 if(!await boolean(run.page,()=>!!document.querySelector('#galaxyMapSvg [data-sektor-sys="kepler"]')||[...document.querySelectorAll('.kmenu button[data-kmenu-i]')].some(n=>/^Kepler(?:\s|$)/.test(n.textContent.trim())),undefined,8000))throw Error('Native Kepler region exposed neither its system node nor its real shortcut button');
 if(await run.page.locator('#galaxyMapSvg [data-sektor-sys="kepler"]').count())await pointer(run.page,'#galaxyMapSvg [data-sektor-sys="kepler"]');
 else{
  const home=run.page.locator('.kmenu button[data-kmenu-i]').filter({hasText:/^Kepler(?:\s|$)/});
  if(await home.count()!==1)throw Error('The actual native Kepler shortcut must be unique');
  const index=await home.getAttribute('data-kmenu-i');await pointer(run.page,'.kmenu button[data-kmenu-i="'+index+'"]');
 }
 if(!await boolean(run.page,()=>document.querySelectorAll('#galaxyMapSvg [data-map-asteroid]').length===12,undefined,8000))throw Error('Actual HTTP mining field did not reach the native map');
 await run.page.locator('#galaxyMapSvg').scrollIntoViewIfNeeded();
}
async function illustration(page,selector,oracle){
 const loc=page.locator(selector).first();if(!await loc.count())return {missing:true};
 return loc.evaluate(async(group,g)=>{
  const image=group.matches('image')?group:group.querySelector('[data-asteroid-image]'),fallback=group.querySelector('[data-asteroid-fallback]');
  if(!image)return {missing:true,fallbackCount:group.querySelectorAll('polygon').length};
  const r=image.getBoundingClientRect();let visible=image.isConnected&&r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;
  for(let node=image;node;node=node.parentElement){const css=getComputedStyle(node);visible=visible&&css.display!=='none'&&css.visibility==='visible'&&Number(css.opacity)>0;}
  const result={visible,width:r.width,height:r.height,key:image.dataset.gameRasterKey,ready:image.dataset.asteroidArtReady,art:image.dataset.gameArt,
   format:image.dataset.gameFormat,atlas:image.dataset.gameAtlas,crop:image.dataset.gameCrop,href:!!image.getAttribute('href'),
   fallbackVisible:fallback?getComputedStyle(fallback).visibility==='visible':null,originalPolygons:fallback?.querySelectorAll('polygon').length||0};
  if(!image.getAttribute('href')||!g)return result;
  const actual=new Image();actual.src=image.getAttribute('href');await actual.decode();
  const expected=new Image();expected.src='/'+g.stem+'.png?oracle=1';await expected.decode();
  const [sx,sy,w,h]=g.rect,a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=w;a.height=b.height=h;
  a.getContext('2d').drawImage(actual,0,0,w,h);b.getContext('2d').drawImage(expected,sx,sy,w,h,0,0,w,h);
  const ap=a.getContext('2d').getImageData(0,0,w,h).data,bp=b.getContext('2d').getImageData(0,0,w,h).data;
  let alphaDiff=0,opaqueDiff=0,count=0,gold=0,opaque=0;
  for(let i=0;i<ap.length;i+=4){if(ap[i+3]!==bp[i+3])alphaDiff++;if(ap[i+3]>8)count++;if(ap[i+3]===255){opaque++;if(ap[i]>ap[i+1]*1.05&&ap[i+1]>ap[i+2]*1.25)gold++;for(let k=0;k<3;k++)if(ap[i+k]!==bp[i+k])opaqueDiff++;}}
  return {...result,alphaDiff,opaqueDiff,count,goldFraction:opaque?gold/opaque:0,sourceWidth:actual.naturalWidth,sourceHeight:actual.naturalHeight};
 },oracle||null);
}
const canonical=(w,key,g)=>w.visible&&w.ready==='true'&&w.art==='raster'&&w.key==='asteroid:'+key&&w.atlas===g.stem&&w.crop===g.rect.join(',')&&w.sourceWidth===g.rect[2]&&w.sourceHeight===g.rect[3]&&w.count>100&&w.alphaDiff===0&&w.opaqueDiff===0;
// Independent original banner composition, read from the native four calls to
// bannerAsteroid: [cx-r,cy-r,2r,2r], in their original painting order.
const bannerBounds={asche:[[81,87,18,18],[134,104,12,12],[242,92,16,16],[315,107,10,10]],bronze:[[75,62,40,40],[136,34,28,28],[299,64,52,52],[240,25,20,20]]};
// Read the actual CSS input and decode it as a complete background. Every
// embedded image is checked against an independently delivered original PNG
// crop; the consumed SVG must decode and preserve the actual motif geometry.
// The scaled scene comparison is diagnostic: Chromium's small SVG-image
// rasterization is a separate sampling step from the strict original-size pixels.
// No test markup is attached to the game and no runtime renderer is called.
async function bannerPixels(page,selector,key,oracle){
 return page.locator(selector).evaluate(async(node,input)=>{
  const rect=node.getBoundingClientRect();let opacity=1,visible=node.isConnected&&rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth;
  for(let parent=node;parent;parent=parent.parentElement){const c=getComputedStyle(parent);opacity*=Number(c.opacity);visible=visible&&c.display!=='none'&&c.visibility==='visible';}
  visible=visible&&opacity>0;
  const background=getComputedStyle(node),result={selection:input.key,visible,opacity,ready:node.dataset.asteroidArtReady,art:node.dataset.gameArt,baked:node.dataset.gameRasterBaked,disabled:!!node.disabled,backgroundSize:background.backgroundSize,backgroundPosition:background.backgroundPosition,backgroundRepeat:background.backgroundRepeat,motifs:[]};
  try{
   const match=getComputedStyle(node).backgroundImage.match(/^url\("(data:image\/svg\+xml,.*)"\)$/);
   if(!match)return {...result,missingBackground:true};
   const actualSvg=decodeURIComponent(match[1].slice('data:image/svg+xml,'.length));
   const doc=new DOMParser().parseFromString(actualSvg,'image/svg+xml');
   if(doc.querySelector('parsererror'))return {...result,invalidSvg:true};
   const svg=doc.documentElement,view=svg.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
   if(!view||view.length!==4||view.some(v=>!Number.isFinite(v))||view[2]!==400||view[3]!==140)return {...result,invalidViewBox:view};
   const actualGroups=[...doc.querySelectorAll('[data-asteroid-raster]')],replacedHrefs=new Set();let projectedSvg=actualSvg,blankSvg=actualSvg,projectedImages=0;
   result.rootAspectRatio=svg.getAttribute('preserveAspectRatio');result.embeddedStyleSheets=doc.querySelectorAll('style').length;
   const png=new Image();png.src='/'+input.oracle.stem+'.png?oracle=1';await png.decode();
   const [sx,sy,w,h]=input.oracle.rect,crop=document.createElement('canvas');crop.width=w;crop.height=h;
   crop.getContext('2d').drawImage(png,sx,sy,w,h,0,0,w,h);const expectedPixels=crop.getContext('2d').getImageData(0,0,w,h).data,expectedHref=crop.toDataURL('image/png');
   for(let index=0;index<actualGroups.length;index++){
    const group=actualGroups[index],image=group.querySelector('[data-asteroid-image]'),fallback=group.querySelector('[data-asteroid-fallback]');
    let shown=true,groupOpacity=1;const alteredComposition=[];
    for(let ancestor=image;ancestor;ancestor=ancestor.parentElement){const style=ancestor.style;shown=shown&&ancestor.getAttribute('visibility')!=='hidden'&&ancestor.getAttribute('visibility')!=='collapse'&&ancestor.getAttribute('display')!=='none'&&style.display!=='none'&&style.visibility!=='hidden';groupOpacity*=Number(ancestor.getAttribute('opacity')||1)*Number(style.opacity||1);for(const name of ['transform','clip-path','mask','filter','style','class'])if(ancestor.hasAttribute(name))alteredComposition.push({tag:ancestor.localName,attribute:name,value:ancestor.getAttribute(name)});}
    const box=image?Object.fromEntries(['x','y','width','height'].map(name=>[name,Number(image.getAttribute(name))])):null;
    const motif={key:group.getAttribute('data-asteroid-raster'),fallback:fallback?.getAttribute('visibility'),fallbackPolygons:fallback?.querySelectorAll('polygon').length||0,shown:shown&&groupOpacity>0,groupOpacity,alteredComposition,aspectRatio:image?.getAttribute('preserveAspectRatio'),box};
    const href=image?.getAttribute('href');if(!href?.startsWith('data:image/png')){result.motifs.push({...motif,missingPixels:true});continue;}
    const decoded=new Image();decoded.src=href;await decoded.decode();const actual=document.createElement('canvas');actual.width=w;actual.height=h;actual.getContext('2d').drawImage(decoded,0,0);
    const pixels=actual.getContext('2d').getImageData(0,0,w,h).data;let alphaDiff=0,opaqueDiff=0,count=0,premultMax=0;
    for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]!==expectedPixels[i+3])alphaDiff++;if(pixels[i+3]>8)count++;for(let channel=0;channel<3;channel++){if(expectedPixels[i+3]===255&&pixels[i+channel]!==expectedPixels[i+channel])opaqueDiff++;premultMax=Math.max(premultMax,Math.abs(pixels[i+channel]*pixels[i+3]/255-expectedPixels[i+channel]*expectedPixels[i+3]/255));}}
    result.motifs.push({...motif,sourceWidth:decoded.naturalWidth,sourceHeight:decoded.naturalHeight,alphaDiff,opaqueDiff,count,premultMax});
    // Preserve every actual SVG byte apart from its image input. XML namespace
    // reserialization is an extra rendering transformation, not the pixel oracle.
    if(!replacedHrefs.has(href)){const uses=projectedSvg.split(href).length-1;if(uses){projectedSvg=projectedSvg.split(href).join(expectedHref);blankSvg=blankSvg.split('href="'+href+'"').join('');projectedImages+=uses;}replacedHrefs.add(href);}
   }
   let nativeSceneWidth=0,nativeSceneHeight=0;
   const scene=async href=>{const image=new Image();image.src=href;await image.decode();if(!nativeSceneWidth){nativeSceneWidth=image.naturalWidth;nativeSceneHeight=image.naturalHeight;}const canvas=document.createElement('canvas');canvas.width=400;canvas.height=140;canvas.getContext('2d').drawImage(image,0,0,400,140);return canvas.getContext('2d').getImageData(0,0,400,140).data;};
   const actualScene=await scene(match[1]),expectedScene=await scene('data:image/svg+xml,'+encodeURIComponent(projectedSvg)),roundTrip=await scene('data:image/svg+xml,'+encodeURIComponent(new XMLSerializer().serializeToString(doc.documentElement))),blankScene=await scene('data:image/svg+xml,'+encodeURIComponent(blankSvg));
   // Same consumed SVG bytes, with only its image hrefs removed. Each original
   // motif box must contain a real painted RGB contribution. No crop-resampling
   // equivalence or arbitrary tiny-motif pixel-count threshold is assumed.
   result.contributions=input.bounds.map(([x,y,width,height])=>{let differentRGBPixels=0;for(let py=y;py<y+height;py++)for(let px=x;px<x+width;px++){const i=(py*400+px)*4;if([0,1,2].some(c=>actualScene[i+c]!==blankScene[i+c]))differentRGBPixels++;}return {box:[x,y,width,height],differentRGBPixels};});
   let nativeScenePixels=0,sceneAlphaDiff=0,scenePremultMax=0,roundTripPremultMax=0;for(let i=0;i<actualScene.length;i+=4){if(actualScene[i+3]===255)nativeScenePixels++;if(actualScene[i+3]!==expectedScene[i+3])sceneAlphaDiff++;for(let channel=0;channel<3;channel++){scenePremultMax=Math.max(scenePremultMax,Math.abs(actualScene[i+channel]*actualScene[i+3]/255-expectedScene[i+channel]*expectedScene[i+3]/255));roundTripPremultMax=Math.max(roundTripPremultMax,Math.abs(actualScene[i+channel]*actualScene[i+3]/255-roundTrip[i+channel]*roundTrip[i+3]/255));}}
   return {...result,decodedBackground:true,nativeSceneWidth,nativeSceneHeight,nativeScenePixels,projectedImages,sceneComparisonIsDiagnostic:true,sceneAlphaDiff,scenePremultMax,roundTripPremultMax};
  }catch(error){return {...result,decodeError:error.message};}
 },{key,oracle,bounds:bannerBounds[key]});
}
function canonicalBanner(w,key,g){return w.visible&&w.opacity>0&&w.ready==='true'&&w.art==='raster'&&w.baked==='asteroid-banner:'+key&&w.backgroundSize==='cover'&&w.backgroundPosition==='50% 50%'&&w.backgroundRepeat==='no-repeat'&&w.decodedBackground===true&&w.rootAspectRatio==='xMidYMid slice'&&w.embeddedStyleSheets===0&&w.nativeSceneWidth>0&&w.nativeSceneHeight>0&&Math.abs(w.nativeSceneWidth/w.nativeSceneHeight-400/140)<1e-9&&w.nativeScenePixels===400*140&&w.projectedImages===4&&w.contributions?.length===4&&w.contributions.every(c=>c.differentRGBPixels>0)&&w.motifs.length===4&&w.motifs.every((m,index)=>m.key==='asteroid:'+(key==='bronze'?'urmaterie':'eisen')&&m.fallback==='hidden'&&m.fallbackPolygons>0&&m.shown&&m.groupOpacity===1&&m.alteredComposition.length===0&&m.aspectRatio==='xMidYMid meet'&&m.box&&JSON.stringify([m.box.x,m.box.y,m.box.width,m.box.height])===JSON.stringify(bannerBounds[key][index])&&m.sourceWidth===g.rect[2]&&m.sourceHeight===g.rect[3]&&m.count>100&&m.alphaDiff===0&&m.opaqueDiff===0&&m.premultMax<=2);}
async function readyBanner(page,selector,key,timeout=10000){return boolean(page,({selector,key})=>{
 const node=document.querySelector(selector);if(!node||node.dataset.asteroidArtReady!=='true'||node.dataset.gameRasterBaked!=='asteroid-banner:'+key)return false;
 const r=node.getBoundingClientRect();if(!node.isConnected||r.width<=0||r.height<=0||r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth)return false;
 for(let parent=node;parent;parent=parent.parentElement){const c=getComputedStyle(parent);if(c.display==='none'||c.visibility!=='visible'||Number(c.opacity)!==1)return false;}
 return true;
 },{selector,key},timeout);}
async function readyMap(run){return boolean(run.page,()=>[...document.querySelectorAll('#galaxyMapSvg [data-asteroid-image]')].length===12&&[...document.querySelectorAll('#galaxyMapSvg [data-asteroid-image]')].every(n=>n.dataset.asteroidArtReady==='true'),undefined,8000);}
const assetRequests=(run,pkg)=>run.requests.filter(r=>pkg.groups.some(g=>r.path==='/'+g.stem+'.webp'||r.path==='/'+g.stem+'.png')&&r.destination==='image'&&!r.query.includes('oracle'));
async function main(){
 const records=[],runs=[],check=(name,ok,data)=>{records.push({name,ok:!!ok});console.log((ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data,(key,value)=>typeof value==='string'&&value.startsWith('data:image')?'inline image '+sha(Buffer.from(value)):value)));};
 const pkg=JSON.parse(fs.readFileSync(path.join(WURZEL,'docs/asteroid-mining-art-package.json'),'utf8'));
 const oracle=Object.fromEntries(pkg.groups.flatMap(g=>g.tiles.map(t=>[t.key.replace(/^asteroid:/,''),{...g,rect:t.rect}])));
 const runtime=[SPIELDATEI,...['kepler-graphics.css','kepler-english.json','service-worker.js','docs/asteroid-mining-art-package.json',
  ...fs.readdirSync(WURZEL).filter(n=>/^kepler-gfx-.*\.(png|webp)$/.test(n)).sort()].map(n=>path.join(WURZEL,n)),...(SERVER_JS?[SERVER_JS]:[])];
 const snapshot=()=>runtime.map(file=>({file:path.basename(file),sha256:sha(fs.readFileSync(file))})),before=snapshot();
 let browser;
 try{
  const source=fs.readFileSync(SPIELDATEI,'utf8'),a=source.indexOf('const GAME_RASTER_ART=Object.freeze({'),b=source.indexOf('// Private image loader for the existing visible game consumers.',a);
  if(a<0||b<=a)throw Error('Actual canonical game-raster declaration missing');
  const native=vm.runInNewContext(source.slice(a,b)+'\nGAME_RASTER_ART;',{}, {timeout:1000});
  const tiles=pkg.groups.flatMap(g=>g.tiles),keys=tiles.map(t=>t.key.replace(/^asteroid:/,''));
  check(labels.package,pkg.groups.length===1&&tiles.length===10&&new Set(keys).size===10&&Object.keys(native).filter(k=>k.startsWith('asteroid:')).length===10&&sorts.every(key=>oracle[key]&&native['asteroid:'+key]?.stem===oracle[key].stem&&JSON.stringify(native['asteroid:'+key]?.rect)===JSON.stringify(oracle[key].rect)&&native['asteroid:'+key].pngSha256===oracle[key].pngSha256&&native['asteroid:'+key].webpSha256===oracle[key].webpSha256&&oracle[key].rect[0]>=0&&oracle[key].rect[1]>=0&&oracle[key].rect[0]+oracle[key].rect[2]<=oracle[key].width&&oracle[key].rect[1]+oracle[key].rect[3]<=oracle[key].height),{keys,groups:pkg.groups.length});
  browser=await starteBrowser({args:['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  const create=async extra=>{const run=await fixture(browser,options(extra));runs.push(run);return run;};
  const run=await create(),dormant=assetRequests(run,pkg).slice();
  const assets=[];
  for(const group of pkg.groups){const pixels=await run.page.evaluate(async g=>{
   const read=async ext=>{const i=new Image();i.src='/'+g.stem+'.'+ext+'?oracle=1';await i.decode();const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext('2d').drawImage(i,0,0);return {w:c.width,h:c.height,p:c.getContext('2d').getImageData(0,0,c.width,c.height).data};};
   const a=await read('png'),b=await read('webp');let alphaDiff=0,opaqueDiff=0,premultMax=0;
   for(let i=0;i<a.p.length;i+=4){if(a.p[i+3]!==b.p[i+3])alphaDiff++;for(let k=0;k<3;k++){if(a.p[i+3]===255&&a.p[i+k]!==b.p[i+k])opaqueDiff++;premultMax=Math.max(premultMax,Math.abs(a.p[i+k]*a.p[i+3]/255-b.p[i+k]*b.p[i+3]/255));}}
   return {width:a.w,height:a.h,webpWidth:b.w,webpHeight:b.h,alphaDiff,opaqueDiff,premultMax};
  },group);assets.push({stem:group.stem,...pixels,hashes:['png','webp'].map(ext=>({ext,sha256:sha(fs.readFileSync(path.join(WURZEL,group.stem+'.'+ext)))}))});}
  check(labels.assets,assets.length===1&&assets.every((x,i)=>x.width===pkg.groups[i].width&&x.height===pkg.groups[i].height&&x.webpWidth===x.width&&x.webpHeight===x.height&&x.hashes.every(h=>h.sha256===pkg.groups[i][h.ext+'Sha256'])),assets);
  check(labels.rgba,assets.every(x=>x.alphaDiff===0&&x.opaqueDiff===0&&x.premultMax<=2),assets);
  check(labels.dormant,dormant.length===0,dormant);
  await openMap(run);await readyMap(run);const normal=[];
  for(const [index,key]of sorts.entries()){const witness=await illustration(run.page,mapNode(index),oracle[key]);normal.push(witness);check(pixelLabel(key),canonical(witness,key,oracle[key]),witness);}
  const geometry=await run.page.locator('#galaxyMapSvg [data-map-asteroid]').evaluateAll(nodes=>nodes.filter(n=>/^\d+$/.test(n.dataset.mapAsteroid)).map(node=>{
   const hit=node.querySelector('rect.kb-treffer'),image=node.querySelector('[data-asteroid-image]'),polygon=node.querySelector('polygon');
   if(!hit||!image||!polygon)return {place:node.dataset.mapAsteroid,missing:true};
   const box=el=>({x:Number(el.getAttribute('x')),y:Number(el.getAttribute('y')),w:Number(el.getAttribute('width')),h:Number(el.getAttribute('height'))});
   const h=box(hit),i=box(image),points=polygon.getAttribute('points').split(' ').map(p=>p.split(',').map(Number));
   return {place:node.dataset.mapAsteroid,hit:h,image:i,points,pointerEvents:getComputedStyle(image).pointerEvents,handler:typeof node.onclick};
  }));
  check(labels.geometry,geometry.length===10&&geometry.every((w,i)=>!w.missing&&w.pointerEvents==='none'&&w.image.w===2*[4.5,6,7.5,9.5][i%4]&&w.hit.w>=w.image.w&&w.hit.h>=w.image.h&&Math.abs((w.hit.x+w.hit.w/2)-(w.image.x+w.image.w/2))<.1&&Math.abs((w.hit.y+w.hit.h/2)-(w.image.y+w.image.h/2))<.1&&w.points.every(([x,y])=>x>=w.hit.x&&x<=w.hit.x+w.hit.w&&y>=w.hit.y&&y<=w.hit.y+w.hit.h)),geometry);
  const rights=await run.page.evaluate(()=>[0,1].map(place=>{const node=document.querySelector('#galaxyMapSvg [data-map-asteroid="'+place+'"]');return {place,title:node?.querySelector('title')?.textContent,text:node?.querySelector('.planet-label')?.textContent,rings:[...(node?.children||[])].filter(n=>n.localName==='circle').map(n=>({color:n.getAttribute('stroke'),dash:n.getAttribute('stroke-dasharray'),animations:n.querySelectorAll('animate').length})),arcs:node?.querySelectorAll('path').length||0};}));
  check(labels.rights,rights[0].title.includes('dein Schürfrecht')&&rights[0].title.includes('12 Schiffe')&&rights[0].text==='[ART]'&&rights[0].arcs===1&&rights[0].rings.some(r=>r.color==='#5dcaa5'&&r.animations===2)&&rights[1].title.includes('Rivale')&&rights[1].text==='[RIV]'&&rights[1].rings.some(r=>r.color==='#e0667a'&&r.dash==='3,3'),rights);
  const peil=await Promise.all([illustration(run.page,mapNode('p1'),oracle.urmaterie),illustration(run.page,mapNode('p2'),oracle.prisma)]);
  const peilRing=await run.page.locator(mapNode('p1')+' > circle').first().evaluate(n=>({color:n.getAttribute('stroke'),dash:n.getAttribute('stroke-dasharray')}));
  check(labels.peil,canonical(peil[0],'urmaterie',oracle.urmaterie)&&canonical(peil[1],'prisma',oracle.prisma)&&peilRing.color==='#5dcaa5'&&peilRing.dash==='3,3',{peil,peilRing});
  await pointer(run.page,mapNode(9)+' .kb-treffer');await run.page.locator('.kmenu').waitFor({state:'visible'});
  await boolean(run.page,()=>document.querySelector('.kmenu [data-asteroid-image]')?.dataset.asteroidArtReady==='true');
  const menu=await illustration(run.page,'.kmenu .kmenu-kopf',oracle.urmaterie),menuText=await run.page.locator('.kmenu').innerText();
  check(labels.menu,canonical(menu,'urmaterie',oracle.urmaterie)&&menuText.includes('Abbaumission')&&menuText.includes('Vorrat:')&&menuText.includes('35%')&&menuText.includes('30%'),{menu,text:menuText});
  check(labels.hidden,[...normal,...peil,menu].every(w=>w.fallbackVisible===false&&w.originalPolygons>0),[...normal,...peil,menu].map(({key,fallbackVisible,originalPolygons})=>({key,fallbackVisible,originalPolygons})));
  check(labels.gold,normal[9].key==='asteroid:urmaterie'&&normal[9].goldFraction>.15&&normal[9].goldFraction>normal[0].goldFraction+.1,{gold:normal[9].goldFraction,iron:normal[0].goldFraction});
  const controls=await run.page.locator('#commandNav .tab-btn').elementHandles();
  const missionsBefore=JSON.stringify(JSON.parse(run.store.get('kepler7-save-v3')).fleet.missions);
  const action=run.page.locator('.kmenu button').filter({hasText:'Abbaumission'}).first();await action.click();await run.page.locator('#fwahlOverlay').waitFor({state:'visible'});
  const preview=await run.page.locator('#fwahlOverlay').innerText();
  const missionsAfter=JSON.stringify(JSON.parse(run.store.get('kepler7-save-v3')).fleet.missions);
  check(labels.actions,preview.includes('Abbaumission starten')&&preview.includes('Protomaterie')&&await run.page.locator('#fwahlOverlay [data-fwahl-start]').isVisible()&&missionsAfter===missionsBefore&&!run.requests.some(r=>/^\/api\/asteroid\/(?:mine|release|contest)/.test(r.path)&&r.method!=='GET'),{preview,missionsBefore,missionsAfter,requests:run.requests.filter(r=>r.path.startsWith('/api/asteroid/'))});
  await pointer(run.page,'#fwahlOverlay [data-fwahl-zu]');
  const files=pkg.groups.flatMap(g=>[g.stem+'.webp',g.stem+'.png']);
  const pending=await create({hold:files});await openMap(pending);
  const retained=await pending.page.locator('#galaxyMapSvg [data-map-asteroid]').elementHandles();
  const pendingWitness=await pending.page.locator('#galaxyMapSvg [data-map-asteroid]').evaluateAll(nodes=>nodes.map(n=>({polygons:n.querySelectorAll('polygon').length,visibility:getComputedStyle(n.querySelector('[data-asteroid-fallback]')).visibility,ready:n.querySelector('[data-asteroid-image]')?.dataset.asteroidArtReady,href:!!n.querySelector('[data-asteroid-image]')?.getAttribute('href')})));
  check(labels.pending,pendingWitness.length===12&&pendingWitness.every(w=>w.polygons>0&&w.visibility==='visible'&&w.ready!=='true'&&!w.href)&&assetRequests(pending,pkg).length===1,pendingWitness);
  pending.release();await readyMap(pending);
  const late=await illustration(pending.page,mapNode(0),oracle.eisen);
  check(labels.late,canonical(late,'eisen',oracle.eisen)&&(await Promise.all(retained.map(h=>h.evaluate(n=>n.isConnected)))).every(Boolean),late);
  const png=await create({fail:pkg.groups.map(g=>g.stem+'.webp')});await openMap(png);await readyMap(png);
  const pngWitness=await illustration(png.page,mapNode(0),oracle.eisen),pngRequests=assetRequests(png,pkg);
  check(labels.png,canonical(pngWitness,'eisen',oracle.eisen)&&pngWitness.format==='png'&&pngRequests.length===2&&pngRequests[0].path.endsWith('.webp')&&pngRequests[1].path.endsWith('.png'),{pngWitness,pngRequests});
  const failed=await create({fail:files});await openMap(failed);await boolean(failed.page,()=>[...document.querySelectorAll('#galaxyMapSvg [data-asteroid-image]')].length===12);
  await delay(300);
  const failure=await failed.page.locator('#galaxyMapSvg [data-map-asteroid]').evaluateAll(nodes=>nodes.map(n=>({polygons:n.querySelectorAll('polygon').length,visibility:getComputedStyle(n.querySelector('[data-asteroid-fallback]')).visibility,ready:n.querySelector('[data-asteroid-image]')?.dataset.asteroidArtReady,href:!!n.querySelector('[data-asteroid-image]')?.getAttribute('href')})));
  check(labels.failed,failure.length===12&&failure.every(w=>w.polygons>0&&w.visibility==='visible'&&w.ready!=='true'&&!w.href),failure);
  const failuresBefore=assetRequests(failed,pkg).length;await tab(failed.page,'basis');await tab(failed.page,'karte');await delay(300);
  check(labels.once,failuresBefore===2&&assetRequests(failed,pkg).length===2&&await failed.page.locator('#galaxyMapSvg [data-map-asteroid]').count()===12,assetRequests(failed,pkg));
  await tab(run.page,'allianz');await run.page.locator('#bannerPickerWrap').waitFor({state:'visible'});
  const banners=[];
  for(const key of ['asche','bronze']){
   await run.page.locator('[data-banner="'+key+'"]').scrollIntoViewIfNeeded();
   await readyBanner(run.page,'[data-banner="'+key+'"]',key);
   banners.push(await bannerPixels(run.page,'[data-banner="'+key+'"]',key,oracle[key==='bronze'?'urmaterie':'eisen']));
  }
  check(labels.banners,banners.length===2&&banners.every(b=>canonicalBanner(b,b.selection,oracle[b.selection==='bronze'?'urmaterie':'eisen'])),banners);
  // Reuse the same real hero node through two already-loaded asteroid templates.
  // A stale consumer must remain red; no rerender or synthetic click repairs it.
  const heroNode=await run.page.locator('#allianceHeroBanner').elementHandle(),heroes=[];
  for(const key of ['bronze','asche','bronze']){
   await pointer(run.page,'[data-banner="'+key+'"]');
   await run.page.locator('#allianceHeroBanner').scrollIntoViewIfNeeded();
   await readyBanner(run.page,'#allianceHeroBanner',key,3000);
   heroes.push(await bannerPixels(run.page,'#allianceHeroBanner',key,oracle[key==='bronze'?'urmaterie':'eisen']));
  }
  check(labels.bannerControls,banners.every(b=>!b.disabled)&&run.store.get('alliance:ART:banner')==='bronze'&&await run.page.locator('[data-banner="bronze"]').evaluate(n=>n.classList.contains('active'))&&run.requests.some(r=>r.path==='/api/storage/alliance%3AART%3Abanner'&&r.method==='PUT'),{banners,heroes,role:run.store.get('alliance:ART:role:u'),requests:run.requests.filter(r=>r.path.includes('banner'))});
  check(labels.heroPixels,heroes.length===3&&await heroNode.evaluate(n=>n.isConnected&&n===document.getElementById('allianceHeroBanner'))&&heroes.every(h=>canonicalBanner(h,h.selection,oracle[h.selection==='bronze'?'urmaterie':'eisen'])),heroes);
  check(labels.controls,controls.length>=13&&(await Promise.all(controls.map(h=>h.evaluate(n=>n.isConnected&&n.tagName==='BUTTON')))).every(Boolean),{controls:controls.length});
  check(labels.frozen,JSON.stringify(snapshot())===JSON.stringify(before),{files:runtime.length,hashes:snapshot()});
  check(labels.errors,runs.every(r=>!r.errors.length&&!r.httpErrors.length),{javascript:runs.flatMap(r=>r.errors),http:runs.flatMap(r=>r.httpErrors)});
  if(JSON.stringify(records.map(r=>r.name))!==JSON.stringify(manifest))throw Error('Native asteroid guard manifest incomplete or out of order');
  const failures=records.filter(r=>!r.ok).length;console.log((failures?'FAIL':'OK')+' - Native asteroid raster artwork | '+JSON.stringify({checks:records.length,failures}));console.log(records.length+' checks, '+failures+' failures');if(failures)process.exitCode=1;
 }finally{for(const run of runs)await run.close();if(browser)await browser.close();}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
