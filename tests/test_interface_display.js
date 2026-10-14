'use strict';
// Actual selects, account save, original controls and completed canvas paint calls.
// No game handlers, clocks, random generator or combat state are replaced.
const {starteBrowser}=require('./lib/umgebung');
const f=require('./lib/ship-raster-fixture');
const fs=require('node:fs'),vm=require('node:vm'),{SPIELDATEI}=require('./lib/spieldatei');
const source=fs.readFileSync(SPIELDATEI,'utf8'),start=source.indexOf('const BUILDING_DEFS = ['),end=source.indexOf('k7RegisterDefinitions(BUILDING_DEFS);',start);
if(start<0||end<=start||source.indexOf('const BUILDING_DEFS = [',start+1)>=0)throw Error('Unique native building definitions missing');
const expectedBuildings=vm.runInNewContext(source.slice(start,end)+'\nBUILDING_DEFS;',{}, {timeout:1000}).filter(d=>d.category!=='defense').map(d=>d.key).sort();
const KEY='kepler7-save-v3',checks=[],errors=[];
const typographyReport={id:'display-typography',time:Date.now()-120000,type:'npc-attack',result:'win',npcName:'Void-Marodeure',npcLevel:1,attackPower:120,defensePower:60,chancePct:70,fromPlanet:'Kepler Prime',flightTime:60,cargoCapacity:500,fleet:{jaeger:3},ownLostShips:{jaeger:1},loot:{erz:8},phasen:[{name:'Anflug',gewonnen:true,chance:.7,icon:'ti-sword'}]};
const check=(name,ok,data)=>{checks.push({name,ok});console.log((ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data)));};
let browser,run;
async function settings(page){
 if(!await page.locator('#tab-einstellungen').isVisible()){
  if(await page.locator('#commandMenuToggle').isVisible()&&!await page.locator('#commandNav').evaluate(e=>e.classList.contains('open')))await f.pointer(page,'#commandMenuToggle');
  await f.pointer(page,'#commandAccountBtn');
 }
 if(!await page.locator('#commandDisplaySize').isVisible())await f.pointer(page,'#tab-einstellungen [data-sec-toggle="anzeige"]');
 await page.locator('#commandDisplaySize').waitFor({state:'visible'});
}
async function choose(page,id,value){
 await settings(page);const target=page.locator('#'+id);
 await target.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
 await target.focus();await target.selectOption(value);
}
async function dismiss(page){
 await page.waitForFunction(()=>document.getElementById('loadstate')?.textContent.includes('Spielstand automatisch geladen'));
 if(await page.locator('#welcomeBackDismissBtn').isVisible())await f.pointer(page,'#welcomeBackDismissBtn');
 await page.locator('#loginOverlay').waitFor({state:'hidden'});
}
const stored=()=>JSON.parse(run.store.get(KEY));
async function metrics(page){return page.evaluate(()=>{
 const select=document.getElementById('commandDisplaySize'),r=select.getBoundingClientRect();
 const nav=[...document.querySelectorAll('#commandNav .tab-btn')],style=getComputedStyle(select);
 const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),client=document.documentElement.clientWidth;
 const overflowNodes=[...document.querySelectorAll('#tab-einstellungen *,#game-root .hero *,#resbar *,#commandStatus *')].flatMap(node=>{const b=node.getBoundingClientRect();return b.width>0&&b.height>0&&(b.right>client+1||b.left<-1)?[{id:node.id,tag:node.tagName,class:typeof node.className==='string'?node.className:'',left:b.left,right:b.right,width:b.width,client:node.clientWidth,scroll:node.scrollWidth,text:node.textContent.trim().slice(0,90)}]:[];}).slice(0,24);
 return {font:parseFloat(getComputedStyle(document.getElementById('commandMenuPositionHint')).fontSize),
  target:r.height,focus:document.activeElement===select,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,
  selectRect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},hitTarget:hit?{id:hit.id,tag:hit.tagName,class:typeof hit.className==='string'?hit.className:''}:null,overflowNodes,
  transform:getComputedStyle(document.getElementById('game-root')).transform,zoom:getComputedStyle(document.body).zoom,
  optionFont:parseFloat(style.fontSize),tabs:nav.map(e=>e.dataset.tab),nodes:nav.every(e=>e===window.__displayOriginalTabs[e.dataset.tab])};
});}
async function contentTypography(page){
 // Real original picks and the native Reports button expose actual authored content.
 for(const key of ['mine','solar'])if(await page.locator('#buildings [data-building-compare="'+key+'"]').getAttribute('aria-pressed')!=='true')await f.pointer(page,'#buildings [data-building-compare="'+key+'"]');
 const comparison=await page.locator('#buildingCompareBox').evaluate(node=>{const table=node.querySelector('table'),heading=node.querySelector('h3'),r=node.getBoundingClientRect();return {visible:!node.hidden&&r.width>0&&r.height>0,keys:[...node.querySelectorAll('[data-building-compare-remove]')].map(e=>e.dataset.buildingCompareRemove),rows:node.querySelectorAll('tbody tr').length,font:table?parseFloat(getComputedStyle(table).fontSize):0,heading:heading?parseFloat(getComputedStyle(heading).fontSize):0};});
 await f.pointer(page,'#headerReportsBtn');await page.locator('#reportsBox [data-report-card="display-typography"] .report-overview').waitFor({state:'visible'});
 const report=await page.locator('#reportsBox [data-report-card="display-typography"] .report-overview').evaluate(node=>{const labels=[...node.querySelectorAll('dt')],values=[...node.querySelectorAll('dd')],strong=node.querySelector('dd > strong'),r=node.getBoundingClientRect();return {visible:r.width>0&&r.height>0,labels:labels.map(e=>({text:e.textContent.trim(),font:parseFloat(getComputedStyle(e).fontSize)})),values:values.map(e=>({text:e.textContent.trim(),font:parseFloat(getComputedStyle(e).fontSize)})),total:strong?{text:strong.textContent.trim(),font:parseFloat(getComputedStyle(strong).fontSize)}:null};});
 return {comparison,report};
}
function contentMatches(rows){
 if(rows.length!==3||rows.some(row=>!row.content?.comparison.visible||JSON.stringify(row.content.comparison.keys)!==JSON.stringify(['mine','solar'])||row.content.comparison.rows!==4||row.content.comparison.font<12||row.content.comparison.heading<15||!row.content.report.visible||row.content.report.labels.length!==3||row.content.report.values.length!==3||row.content.report.labels.some(value=>!value.text||value.font<12)||row.content.report.values.some(value=>!value.text||value.font<12)||row.content.report.total?.text!=='1'||row.content.report.total.font<18))return false;
 const compact=rows[0].content,standard=rows[1].content,large=rows[2].content;
 return compact.comparison.font<=standard.comparison.font&&compact.comparison.heading<=standard.comparison.heading&&compact.report.labels.every((value,index)=>value.font<=standard.report.labels[index].font)&&compact.report.values.every((value,index)=>value.font<=standard.report.values[index].font)&&compact.report.total.font<=standard.report.total.font&&large.comparison.font>standard.comparison.font&&large.comparison.heading>standard.comparison.heading&&large.report.labels.every((value,index)=>value.font>standard.report.labels[index].font)&&large.report.values.every((value,index)=>value.font>standard.report.values[index].font)&&large.report.total.font>standard.report.total.font;
}
(async()=>{
 try{
  browser=await starteBrowser();
  // Transparent browser setup adds read-only accounting around original canvas methods.
  const observed={newContext:async options=>{
   const context=await browser.newContext(options);
   await context.addInitScript(()=>{
    window.__displayFrames=[];window.__displayOriginalTabs={};let frame=null;
    const clear=CanvasRenderingContext2D.prototype.clearRect,fill=CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.clearRect=function(...args){const result=Reflect.apply(clear,this,args);
     if(this.canvas.id==='bgstars'){frame={at:performance.now(),quality:document.body?.dataset.commandGraphicsQuality||'',fills:0};window.__displayFrames.push(frame);if(window.__displayFrames.length>120)window.__displayFrames.shift();}return result;};
    CanvasRenderingContext2D.prototype.fill=function(...args){const result=Reflect.apply(fill,this,args);if(this.canvas.id==='bgstars'&&frame)frame.fills++;return result;};
   });return context;
  }};
  run=await f.fixture(observed,{viewport:{width:1280,height:1000},save:{powerSave:false,uiMenuPosition:'top'},reports:[typographyReport]});
  const page=run.page;await settings(page);
  await page.locator('#commandNav .tab-btn').evaluateAll(es=>{window.__displayOriginalTabs=Object.fromEntries(es.map(e=>[e.dataset.tab,e]));});
  check('display preferences default to standard and balanced',await page.locator('#commandDisplaySize').inputValue()==='standard'&&await page.locator('#commandGraphicsQuality').inputValue()==='balanced');
  const choices=await page.locator('#commandDisplaySize option,#commandGraphicsQuality option').evaluateAll(es=>es.map(e=>({value:e.value,text:e.textContent.trim()})));
  check('display preferences offer six named native options',JSON.stringify(choices.map(e=>e.value))===JSON.stringify(['compact','standard','large','economy','balanced','full'])&&choices.every(e=>e.text.length>0),choices);
  for(const width of [390,768,1280])for(const position of ['left','top']){
   await page.setViewportSize({width,height:1000});await choose(page,'commandMenuPosition',position);
   const rows=[];let catalogue=null,complete=true;
   for(const size of ['compact','standard','large']){
    await choose(page,'commandDisplaySize',size);await f.delay(80);const data=await metrics(page);
    // Real settings pointer target remains uncovered; no force-click or CSS overrides.
    const hit=await page.locator('#commandDisplaySize').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
    await f.tab(page,'basis');
    const facilities=await page.locator('#colonyVisual [data-gfx-facility="building"]').evaluateAll(es=>es.map(e=>({key:e.dataset.gfxKey,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,display:getComputedStyle(e).display,visible:getComputedStyle(e).visibility})));
    if(catalogue===null)catalogue=facilities.map(e=>e.key);
    complete=complete&&JSON.stringify(facilities.map(e=>e.key).sort())===JSON.stringify(expectedBuildings)&&JSON.stringify(facilities.map(e=>e.key))===JSON.stringify(catalogue)&&facilities.every(e=>e.w>0&&e.h>=44&&e.display!=='none'&&e.visible==='visible');
    const content=width===1280?await contentTypography(page):null;
    rows.push({size,...data,hit,buildings:facilities.length,content});await settings(page);
   }
   // Exercise all thirteen real menu controls once in the largest layout.
   for(const key of f.TABS){await f.tab(page,key);complete=complete&&await page.locator('#tab-'+key).isVisible();}
   await settings(page);
   check('display sizes keep native navigation and every building accessible at '+width+' '+position,
    complete&&rows.every(r=>r.focus&&r.hit&&r.nodes&&r.target>=44&&r.scroll<=r.client+1&&r.transform==='none'&&(!r.zoom||r.zoom==='1')&&JSON.stringify(r.tabs)===JSON.stringify(f.TABS))&&rows[0].font<=rows[1].font&&rows[2].font>rows[1].font&&rows[2].target>rows[0].target&&(width!==1280||contentMatches(rows)),rows);
  }
  await page.setViewportSize({width:1280,height:1000});await choose(page,'commandMenuPosition','top');
  const paints={};
  for(const quality of ['full','balanced','economy']){
   await choose(page,'commandGraphicsQuality',quality);
   await f.boolean(page,q=>window.__displayFrames.some(r=>r.quality===q&&r.fills>0),quality,3500);
   paints[quality]=await page.evaluate(q=>window.__displayFrames.filter(r=>r.quality===q&&r.fills>0).at(-1)||null,quality);
  }
  const pixels=await page.locator('#bgstars').evaluate(e=>e.getContext('2d').getImageData(0,0,e.width,e.height).data.some((v,i)=>i%4===3&&v>0));
  check('graphics profiles reduce completed decorative canvas paints without removing artwork',pixels&&paints.full?.fills>paints.balanced?.fills&&paints.balanced?.fills>paints.economy?.fills&&paints.economy?.fills>0,paints);
  const prior=await page.evaluate(()=>window.__displayFrames.filter(r=>r.quality==='economy'&&r.fills>0).length);await f.delay(400);
  const after=await page.evaluate(()=>window.__displayFrames.filter(r=>r.quality==='economy'&&r.fills>0).length);
  check('economy background remains static between native wakeups',prior===after,{prior,after});
  await choose(page,'commandDisplaySize','large');await choose(page,'commandGraphicsQuality','full');
  const until=Date.now()+5000;while(Date.now()<until&&(stored().uiDisplaySize!=='large'||stored().uiGraphicsQuality!=='full'))await f.delay(25);
  check('native changes persist both presentation preferences in the account',stored().uiDisplaySize==='large'&&stored().uiGraphicsQuality==='full'&&stored().uiMenuPosition==='top');
  await page.reload({waitUntil:'domcontentloaded'});await dismiss(page);await settings(page);
  check('real reload restores display size graphics profile and menu position',await page.locator('#commandDisplaySize').inputValue()==='large'&&await page.locator('#commandGraphicsQuality').inputValue()==='full'&&await page.locator('#commandMenuPosition').inputValue()==='top');
  // A second actual saved account supplies unsupported values through the original API.
  // Closing the first context cannot overwrite that independent account fixture.
  const js=run.errors.slice(),http=run.httpErrors.slice();await run.close();
  run=await f.fixture(observed,{save:{uiDisplaySize:'huge-unknown',uiGraphicsQuality:'unlimited-unknown'}});
  await settings(run.page);
  check('unsupported saved display values use this account defaults',await run.page.locator('#commandDisplaySize').inputValue()==='standard'&&await run.page.locator('#commandGraphicsQuality').inputValue()==='balanced');
  js.push(...run.errors);http.push(...run.httpErrors);
  check('presentation actions finish without JavaScript or fixture HTTP errors',js.length===0&&http.length===0,{js,http});
 }catch(error){errors.push(error.stack);console.error(error.stack);}
 finally{if(run)await run.close();if(browser)await browser.close();}
 const failed=checks.filter(g=>!g.ok).length+errors.length;
 console.log((failed?'FAIL':'OK')+' - Interface display | '+JSON.stringify({checks:checks.length,failures:failed}));process.exitCode=failed?1:0;
})();
