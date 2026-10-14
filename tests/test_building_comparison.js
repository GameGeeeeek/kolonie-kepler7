'use strict';
// Existing isolated HTTP fixture; the controls below are operated by real pointer/keyboard input.
// Read-only original cost functions and native details are the oracle, not comparison records.
const assert=require('node:assert/strict'),fixture=require('./lib/ideas-fixture');
const labels={
 catalogue:'all 29 building and 23 defense entries retain their original native controls',
 selection:'three native picks produce three correctly named translated comparison columns',
 one:'x1 comparison matches original costs benefits and the real next levels',
 five:'x5 comparison matches original costs benefits and respects the actual level cap',
 max:'Max comparison matches native affordability and level limits',
 remove:'removing a comparison column restores its native pick focus',
 limit:'a fourth native pick cannot exceed the three-column comparison limit',
 locked:'rare-item and research locks remain explicit without promising an upgrade',
 planet:'the native location selector refreshes comparison levels costs and benefits',
 defense:'defense compares its own values and preserves moon and research restrictions',
 controls:'native details still open and the original build controls remain available',
 layout:'both comparison tables scroll internally at 320px and fit the 1280px document',
 readonly:'comparison and quantity pointers cannot consume resources items or queue construction',
 js:'all comparison flows finish without JavaScript errors',
 http:'all comparison actions finish without unexpected HTTP errors'
};
const steps=Object.keys(labels).filter(key=>!['js','http'].includes(key));
const manifest=[...['de','en'].flatMap(language=>steps.map(key=>language+': '+labels[key])),labels.js,labels.http];
assert.equal(manifest.length,28);assert.equal(new Set(manifest).size,28);
module.exports={manifest,labels};
const norm=text=>String(text||'').replace(/\s+/g,' ').trim();
async function main(){
 const records=[],errors=[],httpErrors=[];
 const check=(name,ok,data)=>{records.push({name,ok:!!ok});console.log((ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data)));};
 async function pointer(locator){
  await locator.evaluate(node=>node.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  const point=await locator.evaluate(node=>{const r=node.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,width:r.width,height:r.height,hit:node.contains(document.elementFromPoint(x,y))};});
  assert(point.width>0&&point.height>0&&point.hit,'comparison pointer must hit its real native target: '+JSON.stringify(point));
  await locator.page().mouse.click(point.x,point.y);
 }
 async function tab(page,key){const button=page.locator('#commandNav .tab-btn[data-tab="'+key+'"]');if(!await button.isVisible())await pointer(page.locator('#commandMenuToggle'));await pointer(button);await page.locator('#tab-'+key).waitFor({state:'visible'});}
 const list=domain=>domain==='defense'?'#defenseBuildings':'#buildings';
 const box=domain=>domain==='defense'?'#defenseCompareBox':'#buildingCompareBox';
 const pick=(page,domain,key)=>page.locator(list(domain)+' [data-building-compare="'+key+'"]');
 async function clear(page,domain){
  for(let i=0;i<8&&await page.locator(box(domain)+' [data-building-compare-remove]').count();i++)await pointer(page.locator(box(domain)+' [data-building-compare-remove]').first());
  assert.equal(await page.locator(box(domain)+' [data-building-compare-remove]').count(),0,'finite native comparison cleanup');
 }
 async function table(page,domain){
  return page.locator(box(domain)).evaluate(node=>({hidden:node.hidden,heading:node.querySelector('h3')?.textContent.trim(),context:node.querySelector('.k7-building-compare-heading > span')?.textContent.trim(),keys:[...node.querySelectorAll('[data-building-compare-remove]')].map(n=>n.dataset.buildingCompareRemove),names:[...node.querySelectorAll('.k7-building-compare-name > span')].map(n=>n.textContent.trim()),rows:[...node.querySelectorAll('tbody tr')].map(tr=>({label:tr.querySelector('th')?.textContent.trim(),values:[...tr.querySelectorAll('td')].map(td=>td.textContent.replace(/\s+/g,' ').trim())}))}));
 }
 async function original(page,keys,domain){
  return page.evaluate(({keys,domain})=>{
   const text=value=>String(value||'').replace(/\s+/g,' ').trim();
   return keys.map(key=>{
    const t=__ideas,def=t.defs().find(d=>d.key===key),level=t.buildings()[key]||0;
    let qty=t.quantity()==='max'?Math.max(1,t.affordable(def,level,50)):t.quantity();
    if(def.maxLevel)qty=Math.max(0,Math.min(qty,def.maxLevel-level));
    const costs=document.createElement('div');costs.innerHTML=t.costHtml(t.cost(def,level,qty));
    const row=document.querySelector((domain==='defense'?'#defenseBuildings':'#buildings')+' [data-building-compare="'+key+'"]')?.closest('.card-row');
    return {key,name:t.view(def).name,level,qty,next:level+qty,maxLevel:def.maxLevel||null,cost:text(costs.textContent),nativeCost:row?[...row.querySelectorAll('.bcost .costitem')].map(n=>text(n.textContent)).join(' '):null,benefit:text(row?.querySelector('.prodline')?.textContent),details:!!row?.querySelector('details.karten-info'),build:!!row?.querySelector('[data-build="'+key+'"]')};
   });
  },{keys,domain});
 }
 const matches=(actual,expected)=>actual.keys.length===expected.length&&actual.rows.length===4&&expected.every((e,i)=>actual.keys[i]===e.key&&actual.names[i]===e.name&&actual.rows[0].values[i].includes(e.level+' → '+e.next)&&norm(actual.rows[1].values[i])===e.cost&&e.cost===e.nativeCost&&e.benefit&&norm(actual.rows[2].values[i])===e.benefit&&e.details&&e.build);
 async function settledComparison(page,selector,phase){
  const witness=await page.evaluate(selector=>new Promise(resolve=>{
   const started=performance.now(),anchorChanges=[];let previous=null,stableSince=null,samples=0,frameId=0,last=null,finished=false;
   const finish=stable=>{if(finished)return;finished=true;clearTimeout(deadline);cancelAnimationFrame(frameId);resolve({stable,phase:null,samples,elapsedMs:performance.now()-started,anchorChanges,last});};
   const deadline=setTimeout(()=>finish(false),3000);
   const sample=now=>{
    const node=document.querySelector(selector),r=node?.getBoundingClientRect();let visible=!!node?.isConnected&&!!r&&r.width>0&&r.height>0,opacity=1;
    for(let p=node;p;p=p.parentElement){const c=getComputedStyle(p);visible=visible&&c.display!=='none'&&c.visibility!=='hidden'&&c.visibility!=='collapse';opacity*=Number(c.opacity);}
    const anchor=window.__ideas.anchor(),targetPanel=node?.closest('.tab-panel')?.id;
    if(!anchorChanges.length||JSON.stringify(anchorChanges.at(-1).anchor)!==JSON.stringify(anchor))anchorChanges.push({elapsedMs:now-started,anchor});
    visible=visible&&opacity>0&&anchor.samePanel&&targetPanel===anchor.activePanel&&Number.isFinite(anchor.nativeAnchor)&&anchor.nativeAnchor===anchor.documentTop;
    const values=r?[r.x,r.y,r.width,r.height,node.clientWidth,node.clientHeight,node.scrollWidth,node.scrollHeight,node.scrollLeft,node.scrollTop,window.scrollX,window.scrollY,document.documentElement.clientWidth,document.documentElement.clientHeight,document.documentElement.scrollWidth,document.documentElement.scrollHeight,opacity]:[];
    samples++;last={connected:!!node?.isConnected,visible,opacity,anchor,targetPanel,values};
    if(visible&&previous?.visible&&values.length===previous.values.length&&values.every((value,i)=>Math.abs(value-previous.values[i])<=0.1)){if(stableSince===null)stableSince=now;}
    else stableSince=visible?now:null;
    previous=last;
    if(visible&&stableSince!==null&&now-stableSince>=200)finish(true);else frameId=requestAnimationFrame(sample);
   };
   frameId=requestAnimationFrame(sample);
  }),selector);
  console.log('MEASURE - native comparison anchor and geometry readiness | '+JSON.stringify({...witness,phase}));
  assert(witness.stable&&witness.samples>=2,'comparison native geometry must stay stable for 200ms before '+phase+': '+JSON.stringify(witness));
  return {...witness,phase};
 }
 async function fit(page,domain,width){
  await page.setViewportSize({width,height:900});
  const selector=box(domain)+' .k7-building-compare-scroll',scroll=page.locator(selector);
  await settledComparison(page,selector,'center scroll');
  await scroll.evaluate(node=>node.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  await settledComparison(page,selector,'native wheel');
  const before=await scroll.evaluate(node=>{const r=node.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,target=document.elementFromPoint(x,y);return {x:r.x,y:r.y,width:r.width,height:r.height,point:{x,y},hit:!!target&&node.contains(target),target:target?.outerHTML.slice(0,250),client:node.clientWidth,scroll:node.scrollWidth,left:node.scrollLeft,docClient:document.documentElement.clientWidth,docScroll:document.documentElement.scrollWidth};});
  if(width===320){
   console.log('MEASURE - comparison before native wheel | '+JSON.stringify({domain,width,before}));assert(before.width>0&&before.height>0&&before.hit,'comparison wheel must hit its real native scroller: '+JSON.stringify(before));
   await page.evaluate(({selector,point})=>{
    const original=document.querySelector(selector),ids=new WeakMap(),events=[],samples=[];let nextId=0;
    const id=node=>{if(!node)return null;if(!ids.has(node))ids.set(node,++nextId);return ids.get(node);};id(original);
    const describe=node=>node===window?'window':node===document?'document':node?{nodeId:id(node),tag:node.tagName||node.nodeName,id:node.id||'',className:typeof node.className==='string'?node.className:node.className?.baseVal||''}:null;
    const take=phase=>{const node=document.querySelector(selector),r=node?.getBoundingClientRect(),panel=node?.closest('.tab-panel'),pr=panel?.getBoundingClientRect(),hit=document.elementFromPoint(point.x,point.y),snapshot={phase,at:performance.now(),nodeId:id(node),sameNode:node===original,connected:!!node?.isConnected,originalConnected:!!original?.isConnected,rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,panel:pr?{id:panel.id,top:pr.top,documentTop:pr.top+scrollY,height:pr.height}:null,anchor:window.__ideas.anchor(),left:node?.scrollLeft,client:node?.clientWidth,scroll:node?.scrollWidth,scrollX,scrollY,documentHeight:document.documentElement.scrollHeight,documentClientHeight:document.documentElement.clientHeight,pointer:point,pointerInside:!!node&&!!hit&&node.contains(hit),hitTarget:describe(hit),activeElement:describe(document.activeElement)};samples.push(snapshot);return snapshot;};
    const observe=phase=>event=>events.push({phase,at:performance.now(),deltaX:event.deltaX,deltaY:event.deltaY,deltaMode:event.deltaMode,clientX:event.clientX,clientY:event.clientY,cancelable:event.cancelable,defaultPrevented:event.defaultPrevented,target:describe(event.target),path:event.composedPath().map(describe),geometry:take('wheel-'+phase)});
    const capture=observe('capture'),bubble=observe('bubble');document.addEventListener('wheel',capture,{capture:true,passive:true});document.addEventListener('wheel',bubble,{passive:true});
    window.__comparisonWheelProbe={take,stop(){document.removeEventListener('wheel',capture,true);document.removeEventListener('wheel',bubble);return {events,samples};}};
    take('before-native-mouse-move');
   },{selector,point:before.point});
   try{
    await page.mouse.move(before.point.x,before.point.y);const moved=await page.evaluate(()=>window.__comparisonWheelProbe.take('after-native-mouse-move'));console.log('MEASURE - comparison after native mouse move | '+JSON.stringify({domain,width,moved}));
    await settledComparison(page,selector,'wheel after native mouse move');const moveSettled=await page.evaluate(()=>window.__comparisonWheelProbe.take('after-mouse-move-settled'));console.log('MEASURE - comparison settled pointer before native wheel | '+JSON.stringify({domain,width,moveSettled}));assert(moveSettled.connected&&moveSettled.pointerInside,'comparison wheel must still hit its real native scroller after mouse move: '+JSON.stringify(moveSettled));
    await page.mouse.wheel(600,0);const immediate=await page.evaluate(()=>window.__comparisonWheelProbe.take('after-native-wheel'));console.log('MEASURE - comparison immediately after native wheel | '+JSON.stringify({domain,width,immediate}));
    const nextFrame=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve(window.__comparisonWheelProbe.take('next-native-raf-after-wheel')))));console.log('MEASURE - comparison native wheel next animation frame | '+JSON.stringify({domain,width,nextFrame}));
    await page.waitForFunction(selector=>document.querySelector(selector).scrollLeft>0,box(domain)+' .k7-building-compare-scroll');
   }finally{const trace=await page.evaluate(()=>{const result=window.__comparisonWheelProbe.stop();delete window.__comparisonWheelProbe;return result;});console.log('MEASURE - complete passive native comparison wheel trace | '+JSON.stringify({domain,width,trace}));}
  }
  const after=await scroll.evaluate(node=>({left:node.scrollLeft,client:node.clientWidth,scroll:node.scrollWidth,docClient:document.documentElement.clientWidth,docScroll:document.documentElement.scrollWidth}));
  return {width,before,after,ok:before.width>0&&before.docScroll<=before.docClient+1&&after.docScroll<=after.docClient+1&&(width===320?before.scroll>before.client&&after.left>before.left:after.scroll<=after.client+1)};
 }
 for(const language of ['de','en']){
  const run=await fixture('defs:()=>BUILDING_DEFS,planets:()=>PLANETS,buildings:currentBuildings,quantity:()=>buildQtyMode,cost:costForRange,costHtml:costHtml,affordable:maxAffordableQty,view:k7View,defaults:applyStateDefaults,render:render,anchor:()=>{const panel=document.querySelector(".tab-panel.active"),r=panel?.getBoundingClientRect();return{samePanel:!!panel&&panel===bildAnkerPanel,activePanel:panel?.id||null,nativePanel:bildAnkerPanel?.id||null,nativeAnchor:bildAnkerLage,documentTop:r?Math.round(r.top+scrollY):null,rawDocumentTop:r?r.top+scrollY:null};}',language);
  const page=run.page,p=language+': ';
  page.on('response',response=>{if(response.status()>=400&&!response.url().includes('/api/'))httpErrors.push({language,url:response.url(),status:response.status()});});
  try{
   await page.setViewportSize({width:1280,height:900});
   const setup=await page.evaluate(()=>{
    const t=__ideas,s=t.state();s.uiHideMaxed=false;s.resources={...s.resources,energie:5000,erz:5000,kristalle:4000,deuterium:2000};s.buildings={solar:38,mine:2,lager:3,habitat:19,turm:2};s.research={};s.unlocked={};s.rareItems={};s.constructionQueue=[];s.buildQueue=[];
    const planet=t.planets()[0].id;s.colonies[planet]={buildings:{solar:3,mine:7,lager:10,habitat:4,turm:5},fleet:{missions:[]}};s.activeBasePlanet='home';t.defaults();t.render();
    const sample=()=>JSON.stringify({resources:s.resources,rare:s.rareItems,queue:s.constructionQueue,waiting:s.buildQueue,buildings:s.buildings,colonies:Object.fromEntries(Object.entries(s.colonies).map(([key,colony])=>[key,colony.buildings]))});
    const events=[];window.__comparisonEvents=events;const pending=new WeakMap();
    document.addEventListener('click',event=>{if(event.target.closest('[data-building-compare],[data-building-compare-remove],[data-qty]'))pending.set(event,sample());},true);
    document.addEventListener('click',event=>{if(pending.has(event))events.push({same:pending.get(event)===sample(),target:event.target.closest('[data-building-compare],[data-building-compare-remove],[data-qty]')?.outerHTML.slice(0,250)});});
    return {planet,definitions:t.defs().map(d=>({key:d.key,domain:d.category==='defense'?'defense':'building'}))};
   });
   await tab(page,'basis');const buildings=await page.locator('#buildings [data-building-compare]').evaluateAll(nodes=>nodes.map(n=>({key:n.dataset.buildingCompare,visible:n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0})));
   await tab(page,'verteidigung');const defenses=await page.locator('#defenseBuildings [data-building-compare]').evaluateAll(nodes=>nodes.map(n=>({key:n.dataset.buildingCompare,visible:n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0})));
   check(p+labels.catalogue,buildings.length===29&&defenses.length===23&&[...buildings,...defenses].every(n=>n.visible)&&JSON.stringify(buildings.map(n=>n.key).sort())===JSON.stringify(setup.definitions.filter(d=>d.domain==='building').map(d=>d.key).sort())&&JSON.stringify(defenses.map(n=>n.key).sort())===JSON.stringify(setup.definitions.filter(d=>d.domain==='defense').map(d=>d.key).sort()),{building:buildings,defense:defenses});
   await tab(page,'basis');const keys=['mine','lager','solar'];for(const key of keys)await pointer(pick(page,'building',key));
   const selected=await table(page,'building'),expectedNames=await page.evaluate(keys=>keys.map(key=>__ideas.view(__ideas.defs().find(d=>d.key===key)).name),keys),pressed=await page.locator('#buildings [data-building-compare][aria-pressed="true"]').count();
   check(p+labels.selection,!selected.hidden&&JSON.stringify(selected.keys)===JSON.stringify(keys)&&JSON.stringify(selected.names)===JSON.stringify(expectedNames)&&pressed===3&&selected.heading===(language==='en'?'Upgrade comparison':'Ausbauvergleich')&&JSON.stringify(selected.rows.map(r=>r.label))===JSON.stringify(language==='en'?['Next upgrade level','Cost','Benefit','Availability']:['Nächste Ausbaustufe','Kosten','Nutzen','Verfügbarkeit']),selected);
   await pointer(page.locator('#qtySelect [data-qty="1"]'));let expected=await original(page,keys,'building'),actual=await table(page,'building');check(p+labels.one,matches(actual,expected)&&expected.every(e=>e.qty===1),{actual,expected});
   await pointer(page.locator('#qtySelect [data-qty="5"]'));expected=await original(page,keys,'building');actual=await table(page,'building');check(p+labels.five,matches(actual,expected)&&expected.find(e=>e.key==='mine').qty===5&&expected.find(e=>e.key==='solar').qty===2&&expected.find(e=>e.key==='solar').next===40,{actual,expected});
   await pointer(page.locator('#qtySelect [data-qty="max"]'));expected=await original(page,keys,'building');actual=await table(page,'building');check(p+labels.max,matches(actual,expected)&&expected.every(e=>e.qty>=1&&e.qty<=50&&(!e.maxLevel||e.next<=e.maxLevel)),{actual,expected});
   await pointer(page.locator('#buildingCompareBox [data-building-compare-remove="solar"]'));const removed=await table(page,'building'),focus=await page.evaluate(()=>document.activeElement?.dataset.buildingCompare);check(p+labels.remove,JSON.stringify(removed.keys)===JSON.stringify(['mine','lager'])&&focus==='solar'&&await pick(page,'building','solar').getAttribute('aria-pressed')==='false',{keys:removed.keys,focus});
   await pointer(pick(page,'building','solar'));const fourth=pick(page,'building','habitat'),disabled=await fourth.isDisabled();await pointer(fourth);const capped=await table(page,'building');check(p+labels.limit,disabled&&capped.keys.length===3&&!capped.keys.includes('habitat'),{disabled,keys:capped.keys});
   await clear(page,'building');for(const key of ['urmateriereaktor','nanolegierungsfabrik'])await pointer(pick(page,'building',key));const locked=await table(page,'building');check(p+labels.locked,JSON.stringify(locked.keys)===JSON.stringify(['urmateriereaktor','nanolegierungsfabrik'])&&locked.rows[0].values.every(v=>!v.includes('→'))&&locked.rows[1].values[0].includes(language==='en'?'Unlock:':'Freischaltung:')&&locked.rows[1].values[0].includes('1')&&locked.rows[1].values[1].includes(language==='en'?'Research required:':'Forschung benötigt:')&&locked.rows[3].values[0]===(language==='en'?'Unlock item missing':'Freischaltgegenstand fehlt')&&locked.rows[3].values[1]===(language==='en'?'Research missing':'Forschung fehlt')&&await page.locator('#buildings [data-unlock="urmateriereaktor"]').isDisabled(),locked);
   await clear(page,'building');await pointer(page.locator('#qtySelect [data-qty="1"]'));for(const key of keys)await pointer(pick(page,'building',key));const home=await table(page,'building');await page.locator('#commandPlanetSelect').selectOption(setup.planet);actual=await table(page,'building');expected=await original(page,keys,'building');check(p+labels.planet,matches(actual,expected)&&expected.find(e=>e.key==='mine').level===7&&actual.rows[0].values[0]!==home.rows[0].values[0]&&actual.rows[1].values[0]!==home.rows[1].values[0]&&actual.rows[2].values[0]!==home.rows[2].values[0]&&(await page.locator('#commandPlanetSelect').inputValue())===setup.planet,{home,actual,expected});
   await tab(page,'verteidigung');const defenseInitiallyHidden=await page.locator('#defenseCompareBox').evaluate(node=>node.hidden);for(const key of ['turm','schild','abhorchposten'])await pointer(pick(page,'defense',key));const def=await table(page,'defense'),turm=await original(page,['turm'],'defense');check(p+labels.defense,defenseInitiallyHidden&&JSON.stringify(def.keys)===JSON.stringify(['turm','schild','abhorchposten'])&&def.rows.length===4&&def.rows[0].values[0].includes(turm[0].level+' → '+turm[0].next)&&norm(def.rows[1].values[0])===turm[0].cost&&norm(def.rows[2].values[0])===turm[0].benefit&&def.rows[0].values.slice(1).every(v=>!v.includes('→'))&&def.rows[3].values[1]===(language==='en'?'Research missing':'Forschung fehlt')&&def.rows[1].values[2]===(language==='en'?'Only available on a moon':'Nur auf einem Mond verfügbar')&&def.rows[3].values[2]===(language==='en'?'Switch to a moon':'Zum Mond wechseln'),{def,turm});
   const detailSelector='#defenseBuildings details[data-keep-open="binfo:turm"]';await pointer(page.locator(detailSelector+' > summary'));
   const detailTransition=await page.evaluate(selector=>new Promise(resolve=>requestAnimationFrame(()=>{const node=document.querySelector(selector),content=node?.querySelector('.prodline'),r=content?.getBoundingClientRect(),panel=node?.closest('.tab-panel'),parents=[];for(let p=content;p;p=p.parentElement){const c=getComputedStyle(p);parents.push({tag:p.tagName,id:p.id,className:p.className,display:c.display,visibility:c.visibility,contentVisibility:c.contentVisibility,opacity:c.opacity});}resolve({exists:!!content,connected:!!content?.isConnected,open:node?.open,text:content?.textContent.trim(),rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,panel:panel?{id:panel.id,className:panel.className}:null,parents});})),detailSelector);console.log('MEASURE - native detail after its next animation frame | '+JSON.stringify({language,detailTransition}));
   await page.locator(detailSelector+' .prodline').waitFor({state:'visible'});
   const details=await page.locator(detailSelector).evaluate(node=>({open:node.open,content:node.querySelector('.prodline')?.getBoundingClientRect().height>0})),build=page.locator('#defenseBuildings [data-build="turm"]');await tab(page,'basis');const basisPreserved=await table(page,'building');check(p+labels.controls,details.open&&details.content&&await build.count()===1&&await page.locator('#buildings [data-build="mine"]').count()===1&&JSON.stringify(basisPreserved.keys)===JSON.stringify(keys)&&await page.locator('#buildings details[data-keep-open="binfo:mine"]').count()===1,{details,basisPreserved:basisPreserved.keys});
   const fits=[];for(const domain of ['building','defense']){await tab(page,domain==='building'?'basis':'verteidigung');for(const width of [320,1280])fits.push(await fit(page,domain,width));}check(p+labels.layout,fits.length===4&&fits.every(f=>f.ok),fits);
   const events=await page.evaluate(()=>window.__comparisonEvents);check(p+labels.readonly,events.length>=20&&events.every(event=>event.same),events);
   errors.push(...run.errors.map(error=>language+': '+error));
  }finally{await run.close();}
 }
 check(labels.js,errors.length===0,errors);check(labels.http,httpErrors.length===0,httpErrors);
 assert.deepEqual(records.map(r=>r.name),manifest,'complete ordered comparison manifest');const failures=records.filter(r=>!r.ok).length;console.log(records.length+' checks, '+failures+' failures');console.log((failures?'FAIL':'OK')+' - Native building comparison');if(failures)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
