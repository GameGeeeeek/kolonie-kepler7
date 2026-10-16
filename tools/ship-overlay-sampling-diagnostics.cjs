'use strict';
// Temporary read-only native controls; never admitted to the update branch.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {starteBrowser}=require('../tests/lib/umgebung');
const {fixture,tab,pointer,boolean,delay}=require('../tests/lib/ship-raster-fixture');
const {stableSkinSave}=require('../tests/test_ship_raster_sharpness');
const {keys}=require('../tests/test_ship_raster_art');
const out=path.resolve('.ship-overlay-evidence/sampling-diagnostics');fs.mkdirSync(out,{recursive:false});
const suspects=['schuerfschiff','hyperjaeger','metamaterialtitan'],viewport={width:1280,height:1058},runs=[],report={stages:[],errors:[],passed:false};
const idle=stableSkinSave().save;
const saved=marks=>({...idle,shipSkin:'standard',shipMarks:marks,uiHideLockedShips:false,unlocked:Object.fromEntries(keys.map(key=>[key,true])),constructionQueue:[],buildQueue:[],researchQueue:[],activeResearch:null,shipMarkJob:null});
async function measure(run,key,name){
 await run.page.locator('#shipyardVisual [data-gfx-ship-picker]').selectOption(key);
 const selector='#fleet canvas[data-ship-icon="'+key+'"]';
 await run.page.locator(selector).first().scrollIntoViewIfNeeded();
 if(!await boolean(run.page,s=>document.querySelector(s)?.dataset.shipArtReady==='true',selector))throw Error('Native diagnostic card never ready '+name);
 await delay(350);
 const data=await run.page.locator(selector).first().evaluate(async c=>{
  const ctx=c.getContext('2d',{willReadFrequently:true}),w=c.width,h=c.height,y=Math.ceil(h*.22+10),bytes=ctx.getImageData(0,0,w,h).data,body=bytes.slice(y*w*4),png=c.toDataURL('image/png');
  window.__shipSamplingIDs??={map:new WeakMap(),next:1,reads:new WeakMap()};const ids=window.__shipSamplingIDs;if(!ids.map.has(c))ids.map.set(c,ids.next++);ids.reads.set(c,(ids.reads.get(c)||0)+1);
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  const t=ctx.getTransform(),css=getComputedStyle(c);return {id:ids.map.get(c),testReadOrdinal:ids.reads.get(c),connected:c.isConnected,key:c.dataset.shipIcon,atlas:c.dataset.shipAtlas,crop:c.dataset.shipCrop,format:c.dataset.shipFormat,dataset:{...c.dataset},width:w,height:h,bodyY:y,
   viewport:[innerWidth,innerHeight,devicePixelRatio],rect:rect(c),scene:rect(document.querySelector('#shipyardVisual .gfx-scene')),
   css:{width:css.width,height:css.height,boxSizing:css.boxSizing,padding:[css.paddingTop,css.paddingRight,css.paddingBottom,css.paddingLeft],border:[css.borderTopWidth,css.borderRightWidth,css.borderBottomWidth,css.borderLeftWidth]},
   context:{attributes:ctx.getContextAttributes?.(),transform:[t.a,t.b,t.c,t.d,t.e,t.f],globalAlpha:ctx.globalAlpha,composite:ctx.globalCompositeOperation,filter:ctx.filter,shadowBlur:ctx.shadowBlur,shadowColor:ctx.shadowColor,smoothing:ctx.imageSmoothingEnabled,quality:ctx.imageSmoothingQuality},
   bodySha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',body))].map(n=>n.toString(16).padStart(2,'0')).join(''),png};
 });
 const png=Buffer.from(data.png.split(',')[1],'base64');delete data.png;data.pngSha256=crypto.createHash('sha256').update(png).digest('hex');fs.writeFileSync(path.join(out,name+'-'+key+'.png'),png,{flag:'wx'});return data;
}
async function stage(name){
 const samples={};for(const run of runs){samples[run.label]={};for(const key of suspects)samples[run.label][key]=await measure(run,key,name+'-'+run.label);}
 const comparisons=Object.fromEntries(suspects.map(key=>[key,{neutralEqual:samples.plain[key].bodySha256===samples.neutral[key].bodySha256,markedEqual:samples.plain[key].bodySha256===samples.marked[key].bodySha256}]));
 report.stages.push({name,samples,comparisons});console.log('DIAGNOSTIC '+name+' '+JSON.stringify(comparisons));
}
(async()=>{let browser;try{
 browser=await starteBrowser({args:['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});
 for(const [label,marks]of [['plain',{}],['marked',Object.fromEntries(keys.map(k=>[k,7]))],['neutral',{}]]){
  const run=await fixture(browser,{viewport,save:saved(marks)});run.label=label;runs.push(run);await tab(run.page,'flotte');await pointer(run.page,'#shipyardVisual [data-gfx-ship="jaeger"]');
 }
 await stage('initial');
 for(const run of runs){await tab(run.page,'basis');await tab(run.page,'flotte');}
 await stage('native-reentry');
 for(const run of runs){const cdp=await run.context.newCDPSession(run.page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height:844,deviceScaleFactor:2,mobile:false});await delay(350);await run.page.locator('#fleet canvas[data-ship-icon="schuerfschiff"]').first().scrollIntoViewIfNeeded();await delay(350);await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:1058,deviceScaleFactor:1,mobile:false});await delay(350);await cdp.detach();}
 await stage('native-density-return');
 report.errors=runs.flatMap(run=>[...run.errors,...run.httpErrors]);if(report.errors.length)throw Error(JSON.stringify(report.errors));report.passed=true;
 }catch(error){report.error=error.stack||String(error);console.error(report.error);process.exitCode=1;}
 finally{for(const run of runs)await run.close();if(browser)await browser.close();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
})();
