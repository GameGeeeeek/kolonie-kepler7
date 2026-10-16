'use strict';
// Real authenticated HTTP saves and native class selections. Mk II–VII may
// change the forge badge, but must not paint obsolete polygon details over an
// authored raster hull. Read actual consumer pixels and native paint provenance;
// hero bodies must match exactly, cards must contain only their atlas and badge.
// Never export a renderer,
// replace game functions, supply a replacement canvas, or edit the checkout.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {SPIELDATEI,WURZEL,SERVER_JS}=require('./lib/spieldatei');
const {starteBrowser}=require('./lib/umgebung');
const {fixture,tab,pointer,boolean,delay}=require('./lib/ship-raster-fixture');
const {keys,deliveredRasterInventory,rasterRuntimeFiles}=require('./test_ship_raster_art');
const {stableSkinSave}=require('./test_ship_raster_sharpness');

const picker='#shipyardVisual [data-gfx-ship-picker]';
const intermediate={jaeger:2,cruisers:3,destroyers:4,carrier:5,frachter:6};
const labels={classes:'the mark-detail regression covers all forty-six independent native hull identities',
 auth:'independent Mk I and Mk VII accounts load their actual saved forge levels through HTTP',
 picker:'both native class pickers expose the same forty-five selectable classes',
 frozen:'all runtime, backend, package and original regression bytes stay frozen through the native mark actions',
 errors:'all native marked ship visits finish without JavaScript or unexpected fixture HTTP errors'};
const classLabel=key=>'native '+key+' Mk VII retains '+(key==='superschlachtschiff'?'an authored-only raster card':'exact hero pixels and an authored-only raster card');
const stageLabel=(key,mk)=>'native '+key+' Mk '+mk+' retains exact heroes and an authored-only raster card';
const manifest=[labels.classes,labels.auth,labels.picker,...keys.map(classLabel),
 ...Object.entries(intermediate).map(([key,mk])=>stageLabel(key,mk)),labels.frozen,labels.errors];
module.exports={manifest,labels,classLabel,stageLabel};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// At this native desktop width the scene width, rather than the mark-dependent
// inspector height, bounds both heroes. Compare equal physical raster sizes.
const viewport={width:1280,height:1058};

// Observe successful original native API calls, forwarding every receiver,
// argument, result and exception unchanged. No game renderer is exposed or
// called. The tested document installs this before any of its canvas paints.
function installPaintObservation(){
 const frames=new WeakMap(),states=new WeakMap(),errors=[];
 const state=ctx=>{
  let s=states.get(ctx);if(!s){s={clipped:false,stack:[],width:ctx.canvas.width,height:ctx.canvas.height};states.set(ctx,s);}
  if(s.width!==ctx.canvas.width||s.height!==ctx.canvas.height){s.clipped=false;s.stack=[];s.width=ctx.canvas.width;s.height=ctx.canvas.height;}
  return s;
 };
 const style=ctx=>{const t=ctx.getTransform();return {transform:[t.a,t.b,t.c,t.d,t.e,t.f],alpha:ctx.globalAlpha,composite:ctx.globalCompositeOperation,
  filter:ctx.filter,shadowBlur:ctx.shadowBlur,shadowColor:ctx.shadowColor,shadowX:ctx.shadowOffsetX,shadowY:ctx.shadowOffsetY,
  smoothing:ctx.imageSmoothingEnabled,quality:ctx.imageSmoothingQuality,clipped:state(ctx).clipped,lineWidth:ctx.lineWidth,font:ctx.font,align:ctx.textAlign,baseline:ctx.textBaseline,
  fillStyle:typeof ctx.fillStyle==='string'?ctx.fillStyle:'non-solid',strokeStyle:typeof ctx.strokeStyle==='string'?ctx.strokeStyle:'non-solid'};};
 const copy=(frame,depth=0)=>frame?{width:frame.width,height:frame.height,overflow:frame.overflow,ops:frame.ops.map(op=>({...op,
  source:op.source?.kind==='image'?{...op.source}:op.source?.kind==='canvas'?{kind:'canvas',width:op.source.width,height:op.source.height,
   frame:depth<1?copy(op.source.frame,depth+1):null,unknownNestedSource:depth>=1}:op.source?{kind:op.source.kind}:undefined}))}:null;
 const source=image=>image instanceof HTMLImageElement?{kind:'image',url:image.currentSrc||image.src,width:image.naturalWidth,height:image.naturalHeight,complete:image.complete}
  :image instanceof HTMLCanvasElement?{kind:'canvas',width:image.width,height:image.height,frame:copy(frames.get(image))}:{kind:'unknown'};
 for(const method of ['clearRect','drawImage','fill','stroke','fillRect','strokeRect','fillText','strokeText','putImageData','save','restore','clip','reset']){
  const descriptor=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,method);if(!descriptor?.value)continue;
  const original=descriptor.value;
  Object.defineProperty(CanvasRenderingContext2D.prototype,method,{...descriptor,value:function(...args){
   const result=Reflect.apply(original,this,args);
   try{
    const s=state(this);
    if(method==='save')s.stack.push(s.clipped);
    if(method==='restore'&&s.stack.length)s.clipped=s.stack.pop();
    if(method==='clip')s.clipped=true;
    if(method==='reset'){s.clipped=false;s.stack=[];}
    let frame=frames.get(this.canvas);
    if(!frame||method==='clearRect'||method==='reset'){
     frame={width:this.canvas.width,height:this.canvas.height,ops:[],overflow:false};frames.set(this.canvas,frame);
    }
    if(frame.ops.length>=32)frame.overflow=true;
    else{
     const op={method,args:(method==='drawImage'?args.slice(1):args).map(v=>typeof v==='number'||typeof v==='string'?v:{kind:typeof v}),state:style(this)};
     if(method==='drawImage')op.source=source(args[0]);
     if(method==='fillText'){
      const m=this.measureText(args[0]);op.textBox={left:args[1]-m.actualBoundingBoxLeft,right:args[1]+m.actualBoundingBoxRight,top:args[2]-m.actualBoundingBoxAscent,bottom:args[2]+m.actualBoundingBoxDescent};
     }
     frame.ops.push(op);
    }
   }catch(error){errors.push(error.stack||String(error));}
   return result;
  }});
 }
 window.__shipMarkPaintObservation={read:canvas=>({origin:location.origin,frame:copy(frames.get(canvas)),errors:[...errors]}),errors:()=>[...errors]};
}
async function markedFixture(browser,options){
 // The fixture receives the original context, with the observer installed
 // before it creates its first page. No second boot or saved time is needed.
 return fixture({newContext:async contextOptions=>{
  const context=await browser.newContext(contextOptions);
  try{await context.addInitScript(installPaintObservation);return context;}
  catch(error){await context.close();throw error;}
 }},options);
}
function nativeCardPaint(item,mk,oracle){
 const frame=item.paint?.frame;
 if(!frame||item.paint.errors.length||frame.overflow||frame.width!==item.width||frame.height!==item.height)return false;
 const names=mk>1?['clearRect','drawImage','fillRect','strokeRect','fillText']:['clearRect','drawImage'];
 if(JSON.stringify(frame.ops.map(op=>op.method))!==JSON.stringify(names))return false;
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),neutral=s=>s&&equal(s.transform,[1,0,0,1,0,0])&&s.alpha===1&&s.composite==='source-over'&&s.filter==='none'
  &&s.shadowBlur===0&&s.shadowColor==='rgba(0, 0, 0, 0)'&&s.shadowX===0&&s.shadowY===0&&!s.clipped;
 const clear=frame.ops[0],body=frame.ops[1],layer=body.source?.frame;
 if(!equal(clear.args,[0,0,item.width,item.height])||!neutral(clear.state)||!neutral(body.state)||!body.state.smoothing||body.state.quality!=='high'
  ||!equal(body.args,[0,0])||body.source?.kind!=='canvas'||body.source.width!==item.width||body.source.height!==item.height
  ||!layer||layer.overflow||layer.width!==item.width||layer.height!==item.height||layer.ops.length!==1)return false;
 const image=layer.ops[0],asset=image.source;
 if(image.method!=='drawImage'||!neutral(image.state)||!image.state.smoothing||image.state.quality!=='high'||asset?.kind!=='image'
  ||!asset.complete||asset.width!==oracle.width||asset.height!==oracle.height||image.args.length!==8||!equal(image.args.slice(0,4),oracle.rect))return false;
 const url=new URL(asset.url),ext=item.format;
 if(!['webp','png'].includes(ext)||url.origin!==item.paint.origin||url.pathname!=='/'+oracle.stem+'.'+ext||url.search!=='?v='+oracle[ext+'Sha256'].slice(0,12))return false;
 if(!image.args.every(Number.isFinite)||image.args[6]<=0||image.args[7]<=0)return false;
 if(mk>1){
  const inside=box=>Object.values(box).every(Number.isFinite)&&box.left>=0&&box.top>=0&&box.right<=item.width&&box.bottom<=item.bodyY;
  for(const op of frame.ops.slice(2)){
   if(!neutral(op.state))return false;
   if(op.method==='fillText'){
    if(!equal(op.args,[['I','II','III','IV','V','VI','VII'][mk-1],item.width-3,2])||op.state.align!=='right'||op.state.baseline!=='top'||op.state.fillStyle!=='#f0b556'||!inside(op.textBox))return false;
   }else{
    if(op.args.length!==4||!op.args.every(Number.isFinite))return false;
    const [x,y,w,h]=op.args,pad=op.method==='strokeRect'?op.state.lineWidth/2:0;
    if(op.method==='strokeRect'?op.state.strokeStyle.replace(/\s/g,'')!=='rgba(240,181,86,0.55)':op.state.fillStyle.replace(/\s/g,'')!=='rgba(8,12,20,0.82)')return false;
    if(w<=0||h<=0||!inside({left:x-pad,top:y-pad,right:x+w+pad,bottom:y+h+pad}))return false;
   }
  }
 }
 return true;
}

// A native ETA update can replace a card during scrolling. Reacquire only that
// actually detached target; visibility/timeouts and other failures stay fatal.
async function scroll(page,selector){
 const deadline=Date.now()+5000;let detached;
 do{
  try{await page.locator(selector).first().scrollIntoViewIfNeeded({timeout:Math.max(1,deadline-Date.now())});return;}
  catch(error){if(!/Element is not attached to the DOM|Element is not connected|element was detached/i.test(error.message))throw error;detached=error;}
 }while(Date.now()<deadline);
 throw detached||Error('Native ship consumer did not remain connected: '+selector);
}
async function readPixels(page,selector,key){
 await scroll(page,selector);
 if(!await boolean(page,([sel,k])=>{const c=document.querySelector(sel);return !!c&&c.dataset.shipIcon===k&&c.dataset.shipArt==='raster'&&c.dataset.shipArtReady==='true';},[selector,key],10000))throw Error('Native ship raster never became ready: '+key+' '+selector);
 const surface=await page.locator(selector).first().elementHandle();
 if(!surface)throw Error('Native marked ship surface disappeared: '+key);
 try{
 // Observe native geometry/readiness before one pixel read. Repeated canvas
 // readbacks can themselves change Chromium's rendering backend, so they must
 // not be the way this observer decides whether the original image settled.
 let previous=null,settled=null,stableSince=0;const deadline=Date.now()+3000;
 do{
  const metadata=await surface.evaluate(c=>{const r=c.getBoundingClientRect();return {
   key:c.dataset.shipIcon,art:c.dataset.shipArt,ready:c.dataset.shipArtReady,atlas:c.dataset.shipAtlas,
   crop:c.dataset.shipCrop,format:c.dataset.shipFormat,detail:c.dataset.shipDetail==='true',
   width:c.width,height:c.height,cssWidth:r.width,cssHeight:r.height,connected:c.isConnected};});
  const signature=JSON.stringify(metadata),now=Date.now();
  if(signature!==previous)stableSince=now;
  else if(metadata.connected&&metadata.key===key&&metadata.art==='raster'&&metadata.ready==='true'&&now-stableSince>=200){settled=metadata;break;}
  previous=signature;await delay(40);
 }while(Date.now()<deadline);
 if(!settled)throw Error('Native marked ship geometry/readiness never settled: '+key+' '+previous);
 const last=await surface.evaluate(async(c,{expected,diagnostic})=>{
   const r=c.getBoundingClientRect(),metadata={key:c.dataset.shipIcon,art:c.dataset.shipArt,ready:c.dataset.shipArtReady,atlas:c.dataset.shipAtlas,
    crop:c.dataset.shipCrop,format:c.dataset.shipFormat,detail:c.dataset.shipDetail==='true',width:c.width,height:c.height,cssWidth:r.width,cssHeight:r.height,connected:c.isConnected};
   if(!metadata.connected||Object.keys(expected).some(field=>metadata[field]!==expected[field]))throw Error('The exact native ship node changed before its single pixel read');
   const w=c.width,h=c.height,bodyY=Math.ceil(h*.22+10),ctx=c.getContext('2d');
   if(w<1||h<=bodyY||!ctx)throw Error('Native marked ship canvas has no measurable body');
   const paint=window.__shipMarkPaintObservation.read(c),bytes=ctx.getImageData(0,0,w,h).data,body=bytes.slice(bodyY*w*4),badge=bytes.slice(0,bodyY*w*4),png=diagnostic&&w<=200?c.toDataURL('image/png'):null;
   const digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');
   let count=0;for(let i=3;i<body.length;i+=4)if(body[i]>8)count++;
   return {...metadata,bodyY,bodyBytes:body.length,count,bodySha256:await digest(body),badgeSha256:await digest(badge),paint,
    diagnosticPNG:png};
  },{expected:settled,diagnostic:!!process.env.KEPLER_SHIP_MARK_EVIDENCE});
 if(Object.keys(settled).some(field=>last[field]!==settled[field]))throw Error('Native marked ship surface changed before its single pixel read: '+key);
 const png=last.diagnosticPNG;delete last.diagnosticPNG;
 Object.defineProperty(last,'diagnosticPNG',{value:png});return last;
 }finally{await surface.dispose();}
}
function preserveFailure(name,before,after){
 const folder=process.env.KEPLER_SHIP_MARK_EVIDENCE;if(!folder)return;
 fs.mkdirSync(folder,{recursive:true});
 for(const [side,items]of [['plain',before],['marked',after]])for(const [index,item]of items.entries())if(item.diagnosticPNG){
  fs.writeFileSync(path.join(folder,name+'-'+side+'-'+index+'.png'),Buffer.from(item.diagnosticPNG.split(',')[1],'base64'),{flag:'wx'});
 }
}
async function visitCard(run,key){
 if(key!=='superschlachtschiff')await run.page.locator(picker).selectOption(key);
 // Read all ordinary construction cards in their own observation phase. The
 // native card-only control accounts agree; this keeps prior hero readbacks
 // out of every card sample without selecting or replacing a failed sample.
 return readPixels(run.page,'#fleet canvas[data-ship-icon="'+key+'"]',key);
}
async function visit(run,key,card){
 const result=[];
 if(key!=='superschlachtschiff'){
  await run.page.locator(picker).selectOption(key);
  for(const detail of [true,false])result.push(await readPixels(run.page,
   '#shipyardVisual .gfx-native-ship canvas[data-ship-icon="'+key+'"]'+(detail?'[data-ship-detail="true"]':':not([data-ship-detail])'),key));
 }
 // All ordinary classes are saved as unlocked, so this is the actual original
 // construction card, including the event/item classes, not the inspector rail.
 result.push(card);
 return result;
}
function sameHull(before,after,key,art,mk=7){
 const expected=key==='superschlachtschiff'?1:3;
 return before.length===expected&&after.length===expected&&after.every((item,index)=>{
  const old=before[index],oracle=(item.detail?art.detail:art.base)[key];
  return item.key===key&&old.key===key&&item.art==='raster'&&old.art==='raster'&&item.ready==='true'&&old.ready==='true'
   &&item.count>20&&old.count>20&&item.atlas===oracle.stem&&old.atlas===oracle.stem
   &&item.crop===oracle.rect.join(',')&&old.crop===oracle.rect.join(',')
   &&['width','height','bodyY','bodyBytes'].every(field=>item[field]===old[field])
   &&(index===expected-1?nativeCardPaint(old,1,art.base[key])&&nativeCardPaint(item,mk,art.base[key])
     &&JSON.stringify(old.paint.frame.ops[1].source.frame.ops[0].args)===JSON.stringify(item.paint.frame.ops[1].source.frame.ops[0].args):item.bodySha256===old.bodySha256)
   &&item.badgeSha256!==old.badgeSha256;
 });
}
async function main(){
 const records=[],runs=[],check=(name,ok,data)=>{records.push({name,ok:!!ok});console.log((ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data)));};
 const inventory=deliveredRasterInventory(WURZEL),originalTests=fs.readdirSync(__dirname).filter(name=>/^test_.*\.js$/.test(name)).sort();
 const frozen=[...new Set([...rasterRuntimeFiles(WURZEL,SPIELDATEI,SERVER_JS,inventory),
  ...inventory.inputFiles,...['marketing-screenshots.js','void-sector-invitation.png'].filter(name=>fs.existsSync(path.join(WURZEL,name))).map(name=>path.join(WURZEL,name)),
  ...originalTests.map(name=>path.join(__dirname,name)),...fs.readdirSync(path.join(__dirname,'lib')).filter(name=>/\.(?:js|cjs|json)$/.test(name)).sort().map(name=>path.join(__dirname,'lib',name))])];
 const hashes=()=>frozen.map(file=>({file:path.relative(WURZEL,file).split(path.sep).join('/'),sha256:sha(file)})),before=hashes();
 const packageArt=name=>Object.fromEntries(JSON.parse(fs.readFileSync(path.join(WURZEL,'docs',name),'utf8')).groups.flatMap(group=>group.tiles.map(tile=>[tile.key,{stem:group.stem,rect:tile.rect,width:group.width,height:group.height,pngSha256:group.pngSha256,webpSha256:group.webpSha256}])));
 const art={base:packageArt('ship-art-package.json'),detail:packageArt('ship-detail-art-package.json')};
 check(labels.classes,keys.length===46&&new Set(keys).size===46&&['base','detail'].every(kind=>Object.keys(art[kind]).length===46&&keys.every(key=>art[kind][key])),{keys});
 // Both accounts have the same legitimate idle empire and affordable stores;
 // native ETA replacements must not become an unrelated raster comparison.
 const idle=stableSkinSave().save;
 const saved=marks=>({...idle,shipSkin:'standard',shipMarks:marks,uiHideLockedShips:false,
  unlocked:Object.fromEntries(keys.map(key=>[key,true])),constructionQueue:[],buildQueue:[],researchQueue:[],activeResearch:null,shipMarkJob:null});
 let browser;
 try{
  browser=await starteBrowser({args:['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  // The native save stores Mk I as an absent key, including after autosave.
  const plain=await markedFixture(browser,{viewport,save:saved({})});runs.push(plain);
  const marked=await markedFixture(browser,{viewport,save:saved(Object.fromEntries(keys.map(key=>[key,7])))});runs.push(marked);
  for(const run of [plain,marked]){await tab(run.page,'flotte');await pointer(run.page,'#shipyardVisual [data-gfx-ship="jaeger"]');}
  const loaded=[plain,marked].map(run=>JSON.parse(run.store.get('kepler7-save-v3')));
  check(labels.auth,plain.context!==marked.context&&plain.store!==marked.store&&loaded.every((state,index)=>state.shipSkin==='standard'&&keys.every(key=>index?state.shipMarks[key]===7:!Object.hasOwn(state.shipMarks,key)))
   &&[plain,marked].every(run=>run.requests.some(request=>request.path==='/api/storage/kepler7-save-v3'&&request.status===200)),loaded.map(state=>({shipSkin:state.shipSkin,shipMarks:state.shipMarks})));
  const options=await Promise.all([plain,marked].map(run=>run.page.locator(picker+' option').evaluateAll(nodes=>nodes.map(node=>node.value))));
  check(labels.picker,options.every(list=>list.length===45&&new Set(list).size===45&&keys.filter(key=>key!=='superschlachtschiff').every(key=>list.includes(key))),options);
  const middle=await markedFixture(browser,{viewport,save:saved(intermediate)});runs.push(middle);
  await tab(middle.page,'flotte');await pointer(middle.page,'#shipyardVisual [data-gfx-ship="jaeger"]');
  const cards={plain:{},marked:{},middle:{}};
  for(const key of keys){
   cards.plain[key]=await visitCard(plain,key);
   cards.marked[key]=await visitCard(marked,key);
   if(Object.hasOwn(intermediate,key))cards.middle[key]=await visitCard(middle,key);
  }
  const neutral={};
  // Only one context performs native actions at a time. No parallel browser
  // stress or call to an internal renderer is needed for this regression.
  for(const key of keys){neutral[key]=await visit(plain,key,cards.plain[key]);const actual=await visit(marked,key,cards.marked[key]),ok=sameHull(neutral[key],actual,key,art);if(!ok)preserveFailure(key,neutral[key],actual);check(classLabel(key),ok,{plain:neutral[key],marked:actual});}
  for(const [key,mk]of Object.entries(intermediate)){const actual=await visit(middle,key,cards.middle[key]),ok=sameHull(neutral[key],actual,key,art,mk);if(!ok)preserveFailure(key+'-mk'+mk,neutral[key],actual);check(stageLabel(key,mk),ok,{plain:neutral[key],marked:actual});}
  const after=hashes();check(labels.frozen,JSON.stringify(before)===JSON.stringify(after),{count:frozen.length,originalTests:originalTests.length,hashes:after});
  const observationErrors=(await Promise.all(runs.map(run=>run.page.evaluate(()=>window.__shipMarkPaintObservation.errors())))).flat();
  check(labels.errors,runs.every(run=>!run.errors.length&&!run.httpErrors.length)&&!observationErrors.length,{javascript:runs.flatMap(run=>run.errors),http:runs.flatMap(run=>run.httpErrors),observationErrors});
  if(JSON.stringify(records.map(record=>record.name))!==JSON.stringify(manifest))throw Error('Native mark-detail guard manifest or order changed');
  const failures=records.filter(record=>!record.ok).length;console.log(records.length+' checks, '+failures+' failures');
  console.log((failures?'FAIL':'OK')+' - Native ship raster mark details');process.exitCode=failures?1:0;
 }finally{for(const run of runs)await run.close();if(browser)await browser.close();}
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
