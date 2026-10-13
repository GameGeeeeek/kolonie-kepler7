'use strict';
// Real HTTP saves, native controls and completed original canvas calls only.
const fs=require('node:fs'),vm=require('node:vm');
const {SPIELDATEI}=require('./spieldatei');
const base=require('./ship-raster-fixture');
const replay=require('./combat-raster-fixture');
const buildings='solar mine raffinerie synth fusionsreaktor bergungswerft urmateriereaktor aufbereitung lager hochsicherheitslager kryolager tresor labor kryoarchiv autonomiekern gravkompressor nanolegierungsfabrik quantenchipfabrik kristalllabor fusionsschmiede kilabor metamaterialweberei singularitaetsreaktor hohlraumweberei kausalankerwerk werftkern quantenwerft habitat botschaft'.split(' ');
const defenses='turm flak laser plasma raketen gauss railgun singularitaetsturm schild ionenschild schildkuppel voidbarriere mondschild resonanzschild sensorphalanx abhorchposten signaturscanner kiverteidigung bunker festung metamaterialwall fusionsbastion nanoplattform'.split(' ');
const types='erdaehnlich erdwelt wasserwelt wueste eis vulkan kristall gasriese asteroid mond todeswelt super leerenwelt'.split(' ');
function region(source,start,end){if(source.split(start).length!==2||source.split(end).length!==2)throw Error('Unique native region missing: '+start);const a=source.indexOf(start),b=source.indexOf(end,a+start.length);if(a<0||b<=a)throw Error('Unordered native region: '+start);return source.slice(a,b);}
function nativeFacts(){
 const source=fs.readFileSync(SPIELDATEI,'utf8'),block=region(source,'  const BUILDING_DEFS = [','  k7RegisterDefinitions(BUILDING_DEFS);');
 const definitions=vm.runInNewContext(block+';BUILDING_DEFS;',{}, {timeout:1000}),rows=Object.fromEntries(definitions.map(d=>[d.key,{key:d.key,max:d.maxLevel||(d.category==='defense'?20:30),category:d.category}]));
 const planetBlock=region(source,'  const PLANETS = [','  k7RegisterDefinitions(PLANETS);'),planetRows=vm.runInNewContext(planetBlock+';PLANETS;',{}, {timeout:1000}),planets=planetRows.map(p=>({id:p.id,system:p.system,type:p.type}));
 const systemBlock=region(source,'  const STAR_SYSTEMS = [','  k7RegisterDefinitions(STAR_SYSTEMS);'),systemRows=vm.runInNewContext(systemBlock+';STAR_SYSTEMS;',{}, {timeout:1000}),systems=systemRows.map(s=>s.id);
 // Read the actual native navigation order rather than assuming table order.
 const expanded=systemRows.map(s=>({...s})),navigation=region(source,'  const SEKTOR_DEFS = [','  k7RegisterDefinitions(SEKTOR_DEFS);')+'\n'+region(source,'  function sektorVon(sy){','  /* Der Sektor eines STANDORTS')+'\n'+region(source,'  const WEEKLY_SYSTEMS_PER_WEEK = 2;','  // Wochenwechsel im laufenden Spiel:')+'\n'+region(source,'  function karteSystemReihenfolge(){','  // Wird vom Zoom-Block');
 const navRows=vm.runInNewContext(navigation+';karteSystemReihenfolge();',{STAR_SYSTEMS:expanded,PLANETS:planetRows.map(p=>({...p})),PLANET_TYPE_INFO:{},k7RegisterDefinitions:()=>{},visibleSystems:()=>expanded.filter(s=>!s.hidden)},{timeout:1000});
 if([...buildings,...defenses].some(key=>!rows[key]?.max)||planets.length<13||systems.length<23)throw Error('Complete actual native class/location tables missing');
 const level=(key,stage)=>{const m=Math.max(3,rows[key].max),threshold=defenses.includes(key)&&m>=20?[1,5,10]:[1,Math.ceil(m*.33),Math.ceil(m*.66)];return threshold[stage-1];};
 const stages=[1,2,3].map(stage=>Object.fromEntries([...buildings,...defenses].map(key=>[key,level(key,stage)])));
 const stars=vm.runInNewContext(region(source,'  function hashStringToFloat(str){','  // Feste Plätze auf der Spiralkarte')+';({hash:hashStringToFloat,types:SUN_TYPES});',{k7RegisterDefinitions:()=>{}},{timeout:1000});
 const starType=Object.fromEntries(systems.map(id=>[id,stars.types[Math.min(stars.types.length-1,Math.floor(stars.hash(id+':suntype')*stars.types.length))].key]));
 const species=vm.runInNewContext(region(source,'  const ALIEN_VOELKER = {','  k7RegisterDefinitions(ALIEN_VOELKER);')+';ALIEN_VOELKER;',{}, {timeout:1000}),nestStages=vm.runInNewContext(region(source,'  const NEST_STUFEN = [','  k7RegisterDefinitions(NEST_STUFEN);')+';NEST_STUFEN;',{}, {timeout:1000});
 return {source,rows,planets,systems,systemRows,navRows,level,stages,starType,starLabels:Object.fromEntries(stars.types.map(t=>[t.key,t.label])),species,nestStages};
}
function architectureSave(facts){return base.save({buildings:facts.stages[0],colonies:{rhea:{buildings:facts.stages[1],fleet:{jaeger:25,missions:[]}},moon_home:{buildings:facts.stages[2],fleet:{jaeger:30,missions:[]}}},discovered:{rhea:true},moons:{home:true},activeBasePlanet:'home',constructionQueue:[],buildQueue:[],activeResearch:null});}
function foreignReport(facts){const value=replay.reports().incoming;return {...value,id:'remaining-foreign',type:'player-attack',targetName:'Fremde Basis',defenderFleet:value.stationedFleet,ownLostShips:{jaeger:15},destroyedBuilding:'turm',defenseBefore:Object.fromEntries(defenses.map(key=>[key,facts.level(key,3)]))};}
async function wheelTo(page,selector){
 const end=Date.now()+10000;
 do{const target=page.locator(selector).first();const rect=await target.boundingBox();if(rect){const viewport=page.viewportSize();if(rect.y>=190&&rect.y+rect.height<=viewport.height-20)return true;await page.mouse.move(viewport.width*.7,viewport.height*.7);await page.mouse.wheel(0,Math.max(-700,Math.min(700,rect.y-viewport.height*.48)));}await base.delay(55);}while(Date.now()<end);
 return false;
}
async function system(page,id){
 // Every ingress is an actual original visible SVG target or original Back button.
 const facts=nativeFacts(),target=facts.navRows.findIndex(s=>s.id===id);
 if(await page.locator('#galaxySysNextBtn').isVisible()&&target>=0){
  const name=(await page.locator('#systemNavName').textContent()).replace(/\s*🏠\s*$/,'').trim(),current=facts.navRows.findIndex(s=>s.name===name);
  if(current>=0){const count=facts.navRows.length,forward=(target-current+count)%count,back=(current-target+count)%count,direction=forward<=back?1:-1,steps=Math.min(forward,back);for(let i=0;i<steps;i++){const selector=direction===1?'#galaxySysNextBtn':'#galaxySysPrevBtn';await wheelTo(page,selector);await base.pointer(page,selector);}const actual=(await page.locator('#systemNavName').textContent()).replace(/\s*🏠\s*$/,'').trim();if(actual!==facts.navRows[target].name)throw Error('Actual native system navigation mismatch: '+id+' / '+actual);return;}
 }
 const node='#galaxyMapSvg [data-sektor-sys="'+id+'"]:visible';
 if(await page.locator(node).count()){await base.pointer(page,node);return;}
 for(let i=0;i<3&&!await page.locator('#galaxyMapSvg [data-sektor]:visible').count();i++)await base.pointer(page,'#galaxyBackBtn');
 const sectors=await page.locator('#galaxyMapSvg [data-sektor]:visible').evaluateAll(nodes=>nodes.map(e=>e.dataset.sektor));
 for(const sector of sectors){await base.pointer(page,'#galaxyMapSvg [data-sektor="'+sector+'"]:visible');if(await page.locator(node).count()){await base.pointer(page,node);return;}await base.pointer(page,'#galaxyBackBtn');}
 throw Error('Actual native system not reachable: '+id);
}
async function ready(page,selector,key,timeout=10000){return base.boolean(page,({selector,key})=>{const e=document.querySelector(selector);return !!e&&e.dataset.gameRasterKey===key&&e.dataset.gameArtReady==='true'&&e.dataset.gameArt==='raster';},{selector,key},timeout);}
async function scroll(page,selector){
 const end=Date.now()+10000;let last;
 do{try{await page.locator(selector).first().scrollIntoViewIfNeeded({timeout:Math.max(1,end-Date.now())});return;}catch(error){if(!/Element is not attached to the DOM|Element is not connected|element was detached/i.test(error.message))throw error;last=error;}}while(Date.now()<end);
 throw last||Error('Native scroll target never stayed connected: '+selector);
}
async function planetPointer(page,id,type){
 const selector='#galaxyMapSvg [data-planet="'+id+'"] image[data-game-raster-key="planet:'+type+'"]',end=Date.now()+10000;
 do{
  try{
   const target=page.locator(selector).first();await target.scrollIntoViewIfNeeded({timeout:Math.max(1,end-Date.now())});
   const hit=await target.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,g=e.closest('[data-planet]'),node=document.elementFromPoint(x,y);return {connected:e.isConnected,x,y,w:r.width,h:r.height,accepted:!!g&&!!node&&g.contains(node),id:g?.dataset.planet,hitTag:node?.localName,hitClass:node?.getAttribute('class')};});
   if(!hit.connected)continue;
   if(hit.w>0&&hit.h>0&&hit.accepted&&hit.id===id){await page.mouse.click(hit.x,hit.y);return hit;}
   const viewport=page.viewportSize();await page.mouse.move(viewport.width*.97,viewport.height*.7);await page.mouse.wheel(0,Math.max(-500,Math.min(500,hit.y-viewport.height*.5)));await base.delay(50);
  }catch(error){if(!/Element is not attached to the DOM|Element is not connected|element was detached/i.test(error.message))throw error;}
 }while(Date.now()<end);
 throw Error('Actual planet image centre never hit its native planet: '+selector);
}
async function visibility(page,selector){return page.locator(selector).first().evaluate(e=>{const r=e.getBoundingClientRect(),parents=[];for(let p=e;p&&p.nodeType===1;p=p.parentElement){const s=getComputedStyle(p);parents.push({tag:p.localName,id:p.id,class:p.className,hidden:p.hidden,display:s.display,visibility:s.visibility,opacity:s.opacity});}return {at:Date.now(),connected:e.isConnected,rect:{x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right},viewport:{w:innerWidth,h:innerHeight},data:{...e.dataset},parents};});}
async function pixels(page,selector,art,kind='motif'){
 const end=Date.now()+10000;
 do{const value=await page.locator(selector).first().evaluate(async(e,{art,kind})=>{
  const r=e.getBoundingClientRect(),meta={key:e.dataset.gameRasterKey,ready:e.dataset.gameArtReady,format:e.dataset.gameFormat,crop:e.dataset.gameCrop,width:r.width,height:r.height,alt:e.getAttribute('alt')};
  const source=e instanceof HTMLCanvasElement?e:e instanceof HTMLImageElement?e.src:e.namespaceURI==='http://www.w3.org/2000/svg'?e.getAttribute('href'):getComputedStyle(e).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
  const read=async source=>{if(source instanceof HTMLCanvasElement)return source;const image=new Image();image.src=source;await image.decode();return image;};
  const actualImage=await read(source),atlas=await read('/'+art.stem+'.png?oracle=1');
  const w=actualImage.width||actualImage.naturalWidth,h=actualImage.height||actualImage.naturalHeight,expected=document.createElement('canvas');expected.width=w;expected.height=h;const c=expected.getContext('2d'),[x,y,tw,th]=art.rect;
  // The oracle uses only the independent original PNG and recorded rectangle.
  // Crop before scaling to avoid sampling neighboring atlas pixels at an edge.
  const crop=document.createElement('canvas');crop.width=tw;crop.height=th;crop.getContext('2d').drawImage(atlas,x,y,tw,th,0,0,tw,th);
  if(kind==='architecture'){const S=Math.min(w,h),scale=Math.min(S*.92/tw,S*.84/th);c.drawImage(crop,(S-tw*scale)/2,S*.90-th*scale,tw*scale,th*scale);}
  else{const pad=e instanceof HTMLCanvasElement?1:0,scale=Math.min((w-pad*2)/tw,(h-pad*2)/th),dw=tw*scale,dh=th*scale;c.drawImage(crop,(w-dw)/2,(h-dh)/2,dw,dh);}
  let expectedPicture=expected,unscaledOracle;
  if(actualImage instanceof HTMLImageElement){
   const actualRaw=document.createElement('canvas');actualRaw.width=w;actualRaw.height=h;actualRaw.getContext('2d').drawImage(actualImage,0,0,w,h);
   const a=actualRaw.getContext('2d').getImageData(0,0,w,h).data,b=c.getImageData(0,0,w,h).data;let max=0,sum=0,alpha=0;
   for(let i=0;i<a.length;i+=4){alpha+=Math.abs(a[i+3]-b[i+3]);for(let k=0;k<3;k++){const d=Math.abs(a[i+k]*a[i+3]/255-b[i+k]*b[i+3]/255);sum+=d;max=Math.max(max,d);}}
   unscaledOracle={width:w,height:h,maxPremultDiff:max,meanPremultDiff:sum/a.length,meanAlphaDiff:alpha/(a.length/4)};
   // Chromium downsamples decoded Image and Canvas sources differently. Encode
   // only the independent original-PNG expectation through the same Image path.
   expectedPicture=await read(expected.toDataURL('image/png'));
  }
  const normalize=image=>{const cv=document.createElement('canvas');cv.width=cv.height=48;cv.getContext('2d').drawImage(image,0,0,48,48);return cv.getContext('2d').getImageData(0,0,48,48).data;},a=normalize(actualImage),b=normalize(expectedPicture);let sum=0,count=0,alpha=0;for(let i=0;i<a.length;i+=4){if(a[i+3]>8)count++;alpha+=Math.abs(a[i+3]-b[i+3]);for(let k=0;k<3;k++)sum+=Math.abs(a[i+k]*a[i+3]/255-b[i+k]*b[i+3]/255);}
  return {...meta,count,diff:sum/a.length,alphaDiff:alpha/(a.length/4),nativeWidth:w,nativeHeight:h,unscaledOracle,connected:e.isConnected};
 },{art,kind});
 if(value.connected&&value.width>0&&value.height>0)return value;
 await base.delay(40);
 }while(Date.now()<end);
 throw Error('Native pixel consumer never stayed connected and visible: '+selector);
}
async function observe(page,oracle){
 // Calls are forwarded unchanged, before observation. Only successful original
 // invocations are observed; weak provenance follows native scratch canvases to
 // a connected consumer. No simulation, timer, listener or control is replaced.
 await page.evaluate(async oracle=>{
  const original=CanvasRenderingContext2D.prototype.drawImage,reference={},dimensions={},images={};
  const normalized=image=>{const cv=document.createElement('canvas');cv.width=cv.height=24;original.call(cv.getContext('2d'),image,0,0,24,24);return cv.getContext('2d').getImageData(0,0,24,24).data;};
  for(const [key,art]of Object.entries(oracle)){if(!images[art.stem]){const image=new Image();image.src='/'+art.stem+'.png?oracle=1';await image.decode();images[art.stem]=image;}const cv=document.createElement('canvas');cv.width=art.rect[2];cv.height=art.rect[3];original.call(cv.getContext('2d'),images[art.stem],...art.rect,0,0,cv.width,cv.height);reference[key]=normalized(cv);(dimensions[cv.width+'x'+cv.height]||(dimensions[cv.width+'x'+cv.height]=[])).push(key);}
  const provenance=new WeakMap(),memo=new WeakMap();let records={},calls=0,errors=[],galaxy=[];
  const diff=(a,b)=>{let total=0;for(let i=0;i<a.length;i+=4){for(let k=0;k<3;k++)total+=Math.abs(a[i+k]*a[i+3]/255-b[i+k]*b[i+3]/255);total+=Math.abs(a[i+3]-b[i+3]);}return total/a.length;};
  CanvasRenderingContext2D.prototype.drawImage=function(...args){const result=Reflect.apply(original,this,args);try{const image=args[0];let keys=[];if(image instanceof HTMLCanvasElement){if(!memo.has(image)){let found=null;const candidates=dimensions[image.width+'x'+image.height]||[];if(candidates.length){const actual=normalized(image);for(const key of candidates){const distance=diff(actual,reference[key]);if(distance<=3&&(!found||distance<found.diff))found={key,diff:distance};}}memo.set(image,found);}const found=memo.get(image);if(found)keys.push(found.key);keys.push(...(provenance.get(image)||[]));}if(keys.length){let inherited=provenance.get(this.canvas);if(!inherited){inherited=new Set();provenance.set(this.canvas,inherited);}for(const key of keys)inherited.add(key);if(this.canvas.isConnected){calls++;for(const key of new Set(keys)){const record=records[key]||(records[key]={calls:0,canvases:[],aspect:oracle[key].rect[2]/oracle[key].rect[3]});record.calls++;const id=this.canvas.id||this.canvas.getAttribute('data-ll-art')||this.canvas.getAttribute('data-bicon')||this.canvas.getAttribute('data-planet-icon')||'native';if(!record.canvases.includes(id))record.canvases.push(id);}}}}catch(error){errors.push(error.message);}return result;};
  const forwarded=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(...args){const result=Reflect.apply(forwarded,this,args);if(galaxy.length<12&&this.canvas.id==='llSky'&&args[0] instanceof HTMLCanvasElement&&provenance.get(args[0])?.has('galaxy:disc'))try{const cv=args[0],p=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let edgeMax=0,translucent=0;for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){const a=p[(y*cv.width+x)*4+3];if(a>0&&a<250)translucent++;if(x===0||y===0||x===cv.width-1||y===cv.height-1)edgeMax=Math.max(edgeMax,a);}const m=this.getTransform();galaxy.push({edgeMax,translucent,width:cv.width,height:cv.height,matrix:[m.a,m.b,m.c,m.d,m.e,m.f]});}catch(error){errors.push(error.message);}return result;};
  window.__remainingRasterObservation={read:()=>({records:JSON.parse(JSON.stringify(records)),calls,errors:[...errors],galaxy:[...galaxy]}),reset:()=>{records={};calls=0;errors=[];galaxy=[];}};
 },oracle);
}
const observation=page=>page.evaluate(()=>window.__remainingRasterObservation.read());
const reset=page=>page.evaluate(()=>window.__remainingRasterObservation.reset());
const requests=(run,pkg)=>run.requests.filter(r=>pkg.atlases.some(g=>r.path==='/'+g.stem+'.webp'||r.path==='/'+g.stem+'.png')&&r.destination==='image'&&!r.query.includes('oracle'));
module.exports={...base,...replay,buildings,defenses,types,region,nativeFacts,architectureSave,foreignReport,wheelTo,system,ready,scroll,planetPointer,pixels,visibility,observe,observation,reset,requests};
