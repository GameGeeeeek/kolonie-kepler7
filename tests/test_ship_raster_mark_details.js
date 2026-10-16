'use strict';
// Real authenticated HTTP saves and native class selections. Mk II–VII may
// change the forge badge, but must not paint obsolete polygon details over an
// authored raster hull. Read actual consumer pixels; never export a renderer,
// replace game functions, supply a replacement canvas, or edit the checkout.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {SPIELDATEI,WURZEL,SERVER_JS}=require('./lib/spieldatei');
const {starteBrowser}=require('./lib/umgebung');
const {fixture,tab,pointer,boolean,delay}=require('./lib/ship-raster-fixture');
const {keys,deliveredRasterInventory,rasterRuntimeFiles}=require('./test_ship_raster_art');

const picker='#shipyardVisual [data-gfx-ship-picker]';
const intermediate={jaeger:2,cruisers:3,destroyers:4,carrier:5,frachter:6};
const labels={classes:'the mark-detail regression covers all forty-six independent native hull identities',
 auth:'independent Mk I and Mk VII accounts load their actual saved forge levels through HTTP',
 picker:'both native class pickers expose the same forty-five selectable classes',
 frozen:'all runtime, backend, package and original regression bytes stay frozen through the native mark actions',
 errors:'all native marked ship visits finish without JavaScript or unexpected fixture HTTP errors'};
const classLabel=key=>'native '+key+' Mk VII hull pixels match Mk I below its retained forge badge';
const stageLabel=(key,mk)=>'native '+key+' Mk '+mk+' retains unmarked hull pixels and its separate forge badge';
const manifest=[labels.classes,labels.auth,labels.picker,...keys.map(classLabel),
 ...Object.entries(intermediate).map(([key,mk])=>stageLabel(key,mk)),labels.frozen,labels.errors];
module.exports={manifest,labels,classLabel,stageLabel};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

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
 // Consecutive identical samples witness a settled backing store. Waiting
 // does not change or repair its pixels, dimensions, layout or game state.
 let previous=null,last,stable=0;const deadline=Date.now()+3000;
 do{
  last=await page.locator(selector).first().evaluate(async c=>{
   const w=c.width,h=c.height,bodyY=Math.ceil(h*.22+10),ctx=c.getContext('2d',{willReadFrequently:true});
   if(w<1||h<=bodyY||!ctx)throw Error('Native marked ship canvas has no measurable body');
   const bytes=ctx.getImageData(0,0,w,h).data,body=bytes.slice(bodyY*w*4),badge=bytes.slice(0,bodyY*w*4);
   const digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');
   let count=0;for(let i=3;i<body.length;i+=4)if(body[i]>8)count++;
   return {key:c.dataset.shipIcon,art:c.dataset.shipArt,ready:c.dataset.shipArtReady,atlas:c.dataset.shipAtlas,
    crop:c.dataset.shipCrop,format:c.dataset.shipFormat,detail:c.dataset.shipDetail==='true',
    width:w,height:h,bodyY,bodyBytes:body.length,count,bodySha256:await digest(body),badgeSha256:await digest(badge)};
  });
  const signature=JSON.stringify(last);stable=signature===previous?stable+1:0;previous=signature;
  if(stable>=2)return last;await delay(60);
 }while(Date.now()<deadline);
 throw Error('Native marked ship pixels never settled: '+key+' '+JSON.stringify(last));
}
async function visit(run,key){
 const result=[];
 if(key!=='superschlachtschiff'){
  await run.page.locator(picker).selectOption(key);
  for(const detail of [true,false])result.push(await readPixels(run.page,
   '#shipyardVisual .gfx-native-ship canvas[data-ship-icon="'+key+'"]'+(detail?'[data-ship-detail="true"]':':not([data-ship-detail])'),key));
 }
 // All ordinary classes are saved as unlocked, so this is the actual original
 // construction card, including the event/item classes, not the inspector rail.
 result.push(await readPixels(run.page,'#fleet canvas[data-ship-icon="'+key+'"]',key));
 return result;
}
function sameHull(before,after,key,art){
 const expected=key==='superschlachtschiff'?1:3;
 return before.length===expected&&after.length===expected&&after.every((item,index)=>{
  const old=before[index],oracle=(item.detail?art.detail:art.base)[key];
  return item.key===key&&old.key===key&&item.art==='raster'&&old.art==='raster'&&item.ready==='true'&&old.ready==='true'
   &&item.count>20&&old.count>20&&item.atlas===oracle.stem&&old.atlas===oracle.stem
   &&item.crop===oracle.rect.join(',')&&old.crop===oracle.rect.join(',')
   &&['width','height','bodyY','bodyBytes','bodySha256'].every(field=>item[field]===old[field])
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
 const packageArt=name=>Object.fromEntries(JSON.parse(fs.readFileSync(path.join(WURZEL,'docs',name),'utf8')).groups.flatMap(group=>group.tiles.map(tile=>[tile.key,{stem:group.stem,rect:tile.rect}])));
 const art={base:packageArt('ship-art-package.json'),detail:packageArt('ship-detail-art-package.json')};
 check(labels.classes,keys.length===46&&new Set(keys).size===46&&['base','detail'].every(kind=>Object.keys(art[kind]).length===46&&keys.every(key=>art[kind][key])),{keys});
 const saved=marks=>({shipSkin:'standard',shipMarks:marks,uiHideLockedShips:false,
  unlocked:Object.fromEntries(keys.map(key=>[key,true])),constructionQueue:[],buildQueue:[],researchQueue:[],activeResearch:null,shipMarkJob:null});
 let browser;
 try{
  browser=await starteBrowser({args:['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
  // The native save stores Mk I as an absent key, including after autosave.
  const plain=await fixture(browser,{save:saved({})});runs.push(plain);
  const marked=await fixture(browser,{save:saved(Object.fromEntries(keys.map(key=>[key,7])))});runs.push(marked);
  for(const run of [plain,marked]){await tab(run.page,'flotte');await pointer(run.page,'#shipyardVisual [data-gfx-ship="jaeger"]');}
  const loaded=[plain,marked].map(run=>JSON.parse(run.store.get('kepler7-save-v3')));
  check(labels.auth,plain.context!==marked.context&&plain.store!==marked.store&&loaded.every((state,index)=>state.shipSkin==='standard'&&keys.every(key=>index?state.shipMarks[key]===7:!Object.hasOwn(state.shipMarks,key)))
   &&[plain,marked].every(run=>run.requests.some(request=>request.path==='/api/storage/kepler7-save-v3'&&request.status===200)),loaded.map(state=>({shipSkin:state.shipSkin,shipMarks:state.shipMarks})));
  const options=await Promise.all([plain,marked].map(run=>run.page.locator(picker+' option').evaluateAll(nodes=>nodes.map(node=>node.value))));
  check(labels.picker,options.every(list=>list.length===45&&new Set(list).size===45&&keys.filter(key=>key!=='superschlachtschiff').every(key=>list.includes(key))),options);
  const neutral={};
  // Only one context performs native actions at a time. No parallel browser
  // stress or call to an internal renderer is needed for this regression.
  for(const key of keys){neutral[key]=await visit(plain,key);const actual=await visit(marked,key);check(classLabel(key),sameHull(neutral[key],actual,key,art),{plain:neutral[key],marked:actual});}
  const middle=await fixture(browser,{save:saved(intermediate)});runs.push(middle);
  await tab(middle.page,'flotte');await pointer(middle.page,'#shipyardVisual [data-gfx-ship="jaeger"]');
  for(const [key,mk]of Object.entries(intermediate)){const actual=await visit(middle,key);check(stageLabel(key,mk),sameHull(neutral[key],actual,key,art),{plain:neutral[key],marked:actual});}
  const after=hashes();check(labels.frozen,JSON.stringify(before)===JSON.stringify(after),{count:frozen.length,originalTests:originalTests.length,hashes:after});
  check(labels.errors,runs.every(run=>!run.errors.length&&!run.httpErrors.length),{javascript:runs.flatMap(run=>run.errors),http:runs.flatMap(run=>run.httpErrors)});
  if(JSON.stringify(records.map(record=>record.name))!==JSON.stringify(manifest))throw Error('Native mark-detail guard manifest or order changed');
  const failures=records.filter(record=>!record.ok).length;console.log(records.length+' checks, '+failures+' failures');
  console.log((failures?'FAIL':'OK')+' - Native ship raster mark details');process.exitCode=failures?1:0;
 }finally{for(const run of runs)await run.close();if(browser)await browser.close();}
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
