'use strict';
// Real authenticated HTTP, original controls and actual illustration boxes. Missing
// new entries are recorded red before the unchanged account route continues the
// remaining measurements. No game handler, clock, observer or DOM is replaced.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {SPIELDATEI,WURZEL,SERVER_JS}=require('./lib/spieldatei');
const {starteBrowser}=require('./lib/umgebung');
const f=require('./lib/ship-raster-fixture');
const {deliveredRasterInventory,rasterRuntimeFiles}=require('./test_ship_raster_art');
const widths=[320,360,390,430,760,1487],key='kepler7-save-v3';
const labels={footer:w=>'the named settings footer is a physical touch target at '+w,
 route:w=>'the footer opens the real display section and keeps its native focus at '+w,
 menu:w=>'the upfront menu settings action preserves focus and native drawer return at '+w,
 graphics:w=>'compact illustrations preserve native catalogues and actions at '+w,
 landscape:'landscape 844 by 390 leaves usable compact artwork and native actions',
 preferences:'all native presentation choices persist through a real reload',
 keyboard:'the original header and keyboard settings actions reach the same native controls',
 english:'English large display retains named settings and bounded artwork at 320 and 760',
 script:'all mobile settings actions finish without JavaScript or unexpected HTTP errors',
 hashes:'all 139 runtime and backend files remain frozen through mobile settings actions'};
const manifest=[...widths.flatMap(w=>[labels.footer(w),labels.route(w),labels.menu(w),labels.graphics(w)]),labels.landscape,labels.preferences,labels.keyboard,labels.english,labels.script,labels.hashes];
module.exports={widths,labels,manifest};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function probe(page,selector){return page.locator(selector).first().evaluate(e=>{
 const r=e.getBoundingClientRect(),s=getComputedStyle(e);let opacity=1,visible=e.isConnected&&r.width>0&&r.height>0;
 for(let p=e;p;p=p.parentElement){const c=getComputedStyle(p);visible=visible&&c.display!=='none'&&c.visibility==='visible';opacity*=Number(c.opacity);}
 const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
 return {visible:visible&&opacity>0,hit:e.contains(hit),text:e.textContent.trim(),font:parseFloat(s.fontSize),
  layoutHeight:e.offsetHeight,cssHeight:parseFloat(s.height),width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
  fit:e.scrollWidth<=e.clientWidth+1,client:document.documentElement.clientWidth,viewport:innerHeight,
  cover:hit?{id:hit.id,tag:hit.tagName,class:typeof hit.className==='string'?hit.className:''}:null};
});}
function touch(p,minimum=44){return !!p&&p.visible&&p.hit&&p.width>=minimum&&p.layoutHeight>=minimum&&p.cssHeight>=minimum&&p.height>0&&p.fit&&p.left>=0&&p.right<=p.client+1&&p.top>=0&&p.bottom<=p.viewport+1;}
async function drawer(page){if(await page.locator('#commandMenuToggle').isVisible()&&!await page.locator('#commandNav').evaluate(e=>e.classList.contains('open')))await f.pointer(page,'#commandMenuToggle');}
async function accountSettings(page){
 if(!await page.locator('#tab-einstellungen').isVisible()){
  // Preparation prefers the new persistent action. A deliberately absent new
  // entry still has the real old account route; no success guard uses this path.
  if(await page.locator('#commandSettingsBtn').isVisible())await f.pointer(page,'#commandSettingsBtn');
  else{await drawer(page);await f.pointer(page,'#commandAccountBtn');}
 }
 if(!await page.locator('#commandMenuPosition').isVisible())await f.pointer(page,'#tab-einstellungen [data-sec-toggle="anzeige"]');
 await page.locator('#commandMenuPosition').waitFor({state:'visible'});
}
async function choose(page,id,value){await accountSettings(page);const target=page.locator('#'+id);await target.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await target.focus();await target.selectOption(value);}
async function collapseDisplay(page){await accountSettings(page);await f.pointer(page,'#tab-einstellungen [data-sec-toggle="anzeige"]');await page.locator('#commandMenuPosition').waitFor({state:'hidden'});await f.tab(page,'basis');}
async function destination(page){return page.evaluate(()=>{
 const select=document.getElementById('commandMenuPosition'),r=select.getBoundingClientRect(),s=getComputedStyle(select),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
 return {panel:document.getElementById('tab-einstellungen').classList.contains('active'),open:!select.closest('.prog-section').classList.contains('collapsed'),
  visible:r.width>0&&r.height>0&&s.display!=='none'&&s.visibility==='visible',focus:document.activeElement===select,hit:select.contains(hit),
  top:r.top,bottom:r.bottom,height:innerHeight,layoutHeight:select.offsetHeight,cssHeight:parseFloat(s.height),active:document.activeElement?.id,
  drawer:document.getElementById('commandNav').classList.contains('open'),expanded:document.getElementById('commandMenuToggle').getAttribute('aria-expanded'),backdrop:document.getElementById('commandNavBackdrop').hidden,
  quests:document.getElementById('commandQuests').open,stats:document.getElementById('commandStats').open,
  fleet:document.getElementById('fleetPositionPanel').classList.contains('fp-mobile-open'),statusExpanded:document.getElementById('commandStatusBtn').getAttribute('aria-expanded')};
});}
const arrived=(d,minimum=44)=>d.panel&&d.open&&d.visible&&d.focus&&d.hit&&d.layoutHeight>=minimum&&d.cssHeight>=minimum&&d.top>=0&&d.bottom<=d.height&&!d.drawer&&d.expanded==='false'&&d.backdrop&&!d.quests&&!d.stats&&!d.fleet&&d.statusExpanded==='false';
async function newEntry(page,selector,keyboard=false){
 const entry=page.locator(selector).first();let physical=null,clicked=false;
 if(await entry.count()&&await entry.isVisible()){
  await entry.scrollIntoViewIfNeeded();physical=await probe(page,selector);
  if(physical.hit){if(keyboard){await entry.focus();await page.keyboard.press('Enter');}else await f.pointer(page,selector);clicked=true;}
 }
 const actual=await destination(page);
 if(!clicked||!actual.panel||!actual.visible){
  console.log('WITNESS - unavailable new entry; original account route continues later measurements | '+JSON.stringify({selector,clicked,physical,actual}));
  if(actual.quests)await f.pointer(page,'#commandQuestsCloseBtn');
  if(actual.stats)await f.pointer(page,'#commandStats > summary');
  if(actual.fleet)await f.pointer(page,'#fpCloseBtn');
  if(actual.drawer)await page.keyboard.press('Escape');
  await accountSettings(page);
 }
 return {clicked,physical,actual};
}
async function escapeReturn(page){
 if(!await page.locator('#commandMenuToggle').isVisible())return {drawer:false,valid:!await page.locator('#commandNav').evaluate(e=>e.classList.contains('open'))};
 await drawer(page);await page.keyboard.press('Escape');return page.evaluate(()=>({drawer:true,valid:!document.getElementById('commandNav').classList.contains('open')&&document.getElementById('commandNavBackdrop').hidden&&document.getElementById('commandMenuToggle').getAttribute('aria-expanded')==='false'&&document.activeElement===document.getElementById('commandMenuToggle')}));
}
async function boot(page){
 if(!await f.boolean(page,()=>document.body.classList.contains('command-ui')&&document.getElementById('commandPlayerName')?.textContent==='Kommandant',null,15000))throw Error('Actual authenticated reload did not finish');
 await page.locator('#loginOverlay').waitFor({state:'hidden'});
 if(await page.locator('#welcomeBackDismissBtn').isVisible())await f.pointer(page,'#welcomeBackDismissBtn');
}
async function scene(page,box,cap,kind){
 const selector='#'+box+' .gfx-scene',until=Date.now()+5000;
 // Native async artwork can rebuild this scene between lookup and scroll. Only
 // that observed detachment repeats the same physical preparation on its new node.
 for(;;){try{await page.locator(selector).scrollIntoViewIfNeeded({timeout:Math.max(1,until-Date.now())});break;}catch(error){if(!/Element is not attached to the DOM|Element is not connected|element was detached/i.test(error.message)||Date.now()>=until)throw error;}}
 // Wait for a real image decode, independently of the requested CSS height.
 const decoded=await f.boolean(page,s=>{const e=document.querySelector(s),img=e?.querySelector('img.gfx-landscape');return !!img&&img.complete&&img.naturalWidth>0;},selector,5000);
 if(kind==='ship')await f.boolean(page,s=>{const c=document.querySelector(s+' .gfx-native-ship canvas[data-ship-detail]');return !!c&&c.width>0&&c.height>0&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);},selector,5000);
 const result=await page.locator(selector).evaluate((e,{kind})=>{
  const r=e.getBoundingClientRect(),image=e.querySelector('img.gfx-landscape'),i=image?.getBoundingClientRect(),inspector=e.parentElement.querySelector('.gfx-inspector'),ir=inspector?.getBoundingClientRect();
  const action=inspector?.querySelector('[data-gfx-build]'),ar=action?.getBoundingClientRect(),as=action&&getComputedStyle(action),hero=e.querySelector('.gfx-native-ship canvas[data-ship-detail]'),hr=hero?.getBoundingClientRect();
  const options=inspector?.querySelector('select'),items=[...e.closest('.gfx-view').querySelectorAll(kind==='building'?'[data-gfx-facility="building"]':kind==='defense'?'[data-gfx-facility="defense"]':kind==='ship'?'[data-gfx-ship]':'[data-gfx-research-picker] option')];
  const hotspots=[...e.querySelectorAll('[data-gfx-building]')].map(node=>{const b=node.getBoundingClientRect(),s=getComputedStyle(node);return {key:node.dataset.gfxBuilding,left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height,layoutHeight:node.offsetHeight,cssHeight:parseFloat(s.height),visible:b.width>0&&b.height>0&&s.display!=='none'&&s.visibility==='visible'};});
  const overflowNodes=[],client=document.documentElement.clientWidth;
  if(document.documentElement.scrollWidth>client+1)for(const node of document.body.querySelectorAll('*')){
   const b=node.getBoundingClientRect(),s=getComputedStyle(node);if(b.width<=0||b.height<=0)continue;
   let visible=true,opacity=1,clipRight=Infinity;const ancestors=[];
   for(let p=node;p;p=p.parentElement){const c=getComputedStyle(p),r=p.getBoundingClientRect();opacity*=Number(c.opacity);visible=visible&&c.display!=='none'&&c.visibility==='visible';
    const clips=p!==node&&(/^(hidden|clip|auto|scroll)$/.test(c.overflowX)||/paint|strict|content/.test(c.contain));
    if(clips)clipRight=Math.min(clipRight,r.left+p.clientLeft+p.clientWidth);
    ancestors.push({id:p.id,tag:p.tagName,class:typeof p.className==='string'?p.className:'',left:r.left,right:r.right,client:p.clientWidth,scroll:p.scrollWidth,minWidth:c.minWidth,display:c.display,flex:c.flex,flexWrap:c.flexWrap,overflowX:c.overflowX,contain:c.contain,transform:c.transform,whiteSpace:c.whiteSpace,font:c.fontSize,clips});
   }
   if(!visible||opacity<=0)continue;
   const projections=[{type:'box',left:b.left,right:b.right,width:b.width}];
   if(!/^(hidden|clip|auto|scroll)$/.test(s.overflowX))for(const child of node.childNodes)if(child.nodeType===Node.TEXT_NODE&&child.textContent.trim()){
    const range=document.createRange();range.selectNodeContents(child);for(const r of range.getClientRects())if(r.width>0&&r.height>0)projections.push({type:'text',left:r.left,right:r.right,width:r.width,text:child.textContent.trim().slice(0,90)});
   }
   for(const projection of projections){const effectiveRight=Math.min(projection.right,clipRight);if(effectiveRight>client+1)overflowNodes.push({id:node.id,tag:node.tagName,class:typeof node.className==='string'?node.className:'',...projection,effectiveRight,text:projection.text||node.textContent.trim().slice(0,90),ancestors});}
  }
  overflowNodes.sort((a,b)=>b.effectiveRight-a.effectiveRight);overflowNodes.splice(25);
  return {height:r.height,width:r.width,top:r.top,bottom:r.bottom,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
   image:image?{complete:image.complete,w:image.naturalWidth,alt:image.alt,width:i.width,height:i.height}:null,
   inspector:ir?{width:ir.width,height:ir.height,left:ir.left,right:ir.right}:null,
   action:action?{key:action.dataset.gfxKey,kind:action.dataset.gfxBuild,text:action.textContent.trim(),visible:ar.width>0&&ar.height>0&&as.display!=='none'&&as.visibility==='visible',disabled:action.disabled}:null,
   bounds:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},hotspots,overflowNodes,
   count:items.length,keys:items.map(e=>e.dataset.gfxKey||e.dataset.gfxShip||e.value),itemsVisible:items.every(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return e.tagName==='OPTION'||b.width>0&&b.height>0&&s.display!=='none'&&s.visibility==='visible';}),
   options:options?[...options.options].map(o=>({value:o.value,text:o.textContent.trim()})):null,
   hero:hero?{width:hr.width,height:hr.height,left:hr.left,right:hr.right,top:hr.top,bottom:hr.bottom,pixels:hero.getContext('2d').getImageData(0,0,hero.width,hero.height).data.some((v,i)=>i%4===3&&v>0)}:null};
 },{kind});
 result.decoded=decoded;result.cap=cap;return result;
}
function sceneFits(r,kind,mobile,large,researchKeys){
 const count=kind==='building'?29:kind==='defense'?23:kind==='ship'?45:null;
 const hotspotFloor=large?48:44,hotspots=r.hotspots||[],hotspotsFit=kind!=='building'||!mobile||hotspots.length===4&&new Set(hotspots.map(p=>p.key)).size===4&&hotspots.every(p=>p.visible&&p.width>=hotspotFloor&&p.layoutHeight>=hotspotFloor&&p.cssHeight>=hotspotFloor&&p.left>=r.bounds.left&&p.right<=r.bounds.right&&p.top>=r.bounds.top&&p.bottom<=r.bounds.bottom)&&hotspots.every((a,i)=>hotspots.slice(i+1).every(b=>a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top));
 return r.decoded&&r.height>0&&(mobile?r.height<=r.cap:r.height>260)&&r.width>0&&r.scroll<=r.client+1&&r.image?.complete&&r.image.w>0&&r.image.width>0&&r.image.height>0&&
  r.inspector?.width>0&&r.inspector.height>0&&r.inspector.left>=0&&r.inspector.right<=r.client+1&&r.action?.kind===kind&&r.action.visible&&r.action.text.length>0&&
  r.count>0&&new Set(r.keys).size===r.count&&(count===null||r.count===count)&&r.itemsVisible&&hotspotsFit&&(kind!=='research'||researchKeys.length>0&&JSON.stringify(r.keys)===JSON.stringify(researchKeys))&&
  (kind!=='ship'||r.hero?.pixels&&r.hero.width>0&&r.hero.height>0&&Math.abs(r.hero.width/r.hero.height-4/3)<.01&&r.hero.width<=r.width&&r.hero.height<=r.height);
}
async function graphics(page,width,height=900,large=false,researchKeys=[]){
 const short=height<=500,mobile=width<=900,caps=large?(short?[220,220,200,180]:[260,260,220,200]):(short?[200,200,180,160]:[240,240,200,180]);
 const results=[];
 for(const [index,[tab,box,kind,picker,value]]of [['basis','colonyVisual','building',null,null],['verteidigung','defenseVisual','defense','data-gfx-defense-picker','flak'],['flotte','shipyardVisual','ship','data-gfx-ship-picker','jaeger'],['forschung','researchVisual','research','data-gfx-research-picker','rsolar']].entries()){
  await f.tab(page,tab);
  if(picker){const select=page.locator('#'+box+' ['+picker+']');await select.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await select.focus();await select.selectOption(value);}
  else await f.pointer(page,'#colonyVisual [data-gfx-building="mine"]');
  const measured=await scene(page,box,caps[index],kind);
  if(measured.scroll>measured.client+1)console.log('WITNESS - actual document overflow | '+JSON.stringify({width,height,large,kind,scroll:measured.scroll,client:measured.client,offenders:measured.overflowNodes}));
  measured.pass=sceneFits(measured,kind,mobile,large,researchKeys);results.push(measured);
 }
 return {pass:results.length===4&&results.every(r=>r.pass),results};
}
async function main(){
 const records=[],runs=[];let browser,error;
 const check=(name,ok,data)=>{records.push({name,ok:!!ok});console.log((ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data)));};
 const inventory=deliveredRasterInventory(WURZEL),runtime=rasterRuntimeFiles(WURZEL,SPIELDATEI,SERVER_JS,inventory),snapshot=()=>runtime.map(file=>({file,sha256:hash(file)})),before=snapshot();
 try{
  browser=await starteBrowser();const run=await f.fixture(browser,{viewport:{width:1487,height:900},save:{uiCollapsibleSections:true,collapsedSections:{anzeige:true},uiMenuPosition:'left',uiDisplaySize:'standard',uiGraphicsQuality:'balanced'}});runs.push(run);const page=run.page;
  await f.tab(page,'forschung');const researchKeys=await page.locator('#researchVisual [data-gfx-research-picker] option').evaluateAll(es=>es.map(e=>e.value));
  if(!researchKeys.length||new Set(researchKeys).size!==researchKeys.length)throw Error('Real desktop research catalogue reference is absent or duplicated');
  console.log('WITNESS - real desktop research option reference | '+JSON.stringify(researchKeys));
  const originals=await page.locator('#commandNav .tab-btn').elementHandles();
  for(const width of widths){
   await page.setViewportSize({width,height:900});await choose(page,'commandMenuPosition',width===360||width===430?'top':'left');await collapseDisplay(page);
   const footer=await page.locator('#commandSettingsBtn').count()?await probe(page,'#commandSettingsBtn'):null;
   check(labels.footer(width),touch(footer)&&footer.font>=12&&footer.text==='Einstellungen',footer);
   let popup=null;
   if(width===320){await f.pointer(page,'#commandQuests > summary');popup=await page.locator('#commandQuests').evaluate(e=>e.open);}
   if(width===760){await f.pointer(page,'#commandStatusBtn');popup=await page.locator('#fleetPositionPanel').evaluate(e=>e.classList.contains('fp-mobile-open'));}
   if(width===1487){await f.pointer(page,'#commandStats > summary');popup=await page.locator('#commandStats').evaluate(e=>e.open);}
   const direct=await newEntry(page,'#commandSettingsBtn');
   check(labels.route(width),direct.clicked&&arrived(direct.actual)&&(popup===null||popup===true),{...direct,popup});
   await collapseDisplay(page);await drawer(page);
   const menu=page.locator('#commandNav .command-tools > [data-command-header="headerProfileBtn"]'),upfront=await menu.count()===1&&await menu.evaluate(e=>!e.closest('details'));
   const viaMenu=await newEntry(page,'#commandNav .command-tools > [data-command-header="headerProfileBtn"]'),returned=await escapeReturn(page);
   check(labels.menu(width),upfront&&viaMenu.clicked&&touch(viaMenu.physical)&&arrived(viaMenu.actual)&&returned.valid,{upfront,...viaMenu,returned});
   const artwork=await graphics(page,width,900,false,researchKeys),identity=await Promise.all(originals.map((node,i)=>node.evaluate((e,i)=>e.isConnected&&e===document.querySelectorAll('#commandNav .tab-btn')[i],i)));
   const membership=await page.locator('.tab-btn').evaluateAll(es=>es.map(e=>e.dataset.tab));
   check(labels.graphics(width),artwork.pass&&identity.length===13&&identity.every(Boolean)&&JSON.stringify(membership)===JSON.stringify(f.TABS),{...artwork,identity,membership});
  }
  await page.setViewportSize({width:844,height:390});await choose(page,'commandMenuPosition','left');
  const landscape=await graphics(page,844,390,false,researchKeys);check(labels.landscape,landscape.pass,landscape);
  await page.setViewportSize({width:1280,height:900});await accountSettings(page);
  const options=await page.locator('#commandMenuPosition option,#commandDisplaySize option,#commandGraphicsQuality option').evaluateAll(es=>es.map(e=>({value:e.value,text:e.textContent.trim()})));
  for(const size of ['compact','standard','large'])await choose(page,'commandDisplaySize',size);
  for(const quality of ['economy','balanced','full'])await choose(page,'commandGraphicsQuality',quality);
  await choose(page,'commandMenuPosition','top');
  const saved=()=>JSON.parse(run.store.get(key));const until=Date.now()+5000;while(Date.now()<until&&(saved().uiDisplaySize!=='large'||saved().uiGraphicsQuality!=='full'||saved().uiMenuPosition!=='top'))await f.delay(25);
  const persisted=saved();await page.reload({waitUntil:'domcontentloaded'});await boot(page);await accountSettings(page);
  check(labels.preferences,JSON.stringify(options.map(o=>o.value))===JSON.stringify(['left','top','compact','standard','large','economy','balanced','full'])&&options.every(o=>o.text)&&persisted.uiDisplaySize==='large'&&persisted.uiGraphicsQuality==='full'&&persisted.uiMenuPosition==='top'&&await page.locator('#commandDisplaySize').inputValue()==='large'&&await page.locator('#commandGraphicsQuality').inputValue()==='full'&&await page.locator('#commandMenuPosition').inputValue()==='top',{options,persisted:{size:persisted.uiDisplaySize,quality:persisted.uiGraphicsQuality,menu:persisted.uiMenuPosition}});
  await choose(page,'commandMenuPosition','left');await collapseDisplay(page);
  const header=await newEntry(page,'#headerProfileBtn');await page.setViewportSize({width:390,height:900});await collapseDisplay(page);
  const keyboard=await newEntry(page,'#commandSettingsBtn',true);
  const tabs=[];for(const key of f.TABS){await f.tab(page,key);tabs.push({key,visible:await page.locator('#tab-'+key).isVisible()});}
  check(labels.keyboard,header.clicked&&arrived(header.actual)&&keyboard.clicked&&arrived(keyboard.actual)&&tabs.length===13&&tabs.every(t=>t.visible),{header,keyboard,tabs});
  await accountSettings(page);await page.locator('.resetrow [data-k7-language]').selectOption('en');await page.waitForURL('**/?lang=en');await boot(page);
  let english=true;const englishRows=[];
  for(const width of [320,760]){await page.setViewportSize({width,height:900});await accountSettings(page);await choose(page,'commandDisplaySize','large');await f.tab(page,'basis');
   const label=await page.locator('#commandSettingsBtn').count()?await probe(page,'#commandSettingsBtn'):null,entry=await newEntry(page,'#commandSettingsBtn');
   const art=await graphics(page,width,900,true,researchKeys);english=english&&touch(label,48)&&label.text==='Settings'&&entry.clicked&&arrived(entry.actual,48)&&art.pass;englishRows.push({width,label,entry,art});
  }
  check(labels.english,english&&await page.locator('html').getAttribute('lang')==='en',englishRows);
 }catch(e){error=e;console.error(e.stack);}
 finally{for(const run of runs)await run.close();if(browser)await browser.close();}
 check(labels.script,!error&&runs.length>0&&runs.every(r=>r.errors.length===0&&r.httpErrors.length===0),{error:error?.message,runs:runs.map(r=>({js:r.errors,http:r.httpErrors}))});
 check(labels.hashes,runtime.length===139&&JSON.stringify(snapshot())===JSON.stringify(before),{files:runtime.length});
 const failures=records.filter(r=>!r.ok).length+(error?1:0);console.log((failures?'FAIL':'OK')+' - Mobile settings compact | '+JSON.stringify({checks:records.length,failures}));process.exitCode=failures?1:0;
}
if(require.main===module)main();
