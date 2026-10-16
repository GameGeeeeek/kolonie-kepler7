'use strict';
// Actual authenticated welcome flow, native pointer actions and a locally served
// image. The external destination is fulfilled in the test context, never visited.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {SPIELDATEI,WURZEL,SERVER_JS}=require('./lib/spieldatei');
const {starteBrowser}=require('./lib/umgebung');
const f=require('./lib/ship-raster-fixture');
const viewports=[{width:320,height:740},{width:390,height:844},{width:844,height:390},{width:1487,height:1058}];
const labels={continue:w=>'the original continue action precedes the optional invitation at '+w,
 image:w=>'the real Void illustration and truthful new-pilot bonus fit at '+w,
 link:w=>'the real invitation pointer opens only the exact attributed Void entry at '+w,
 english:'English large text translates the complete optional invitation',
 dismiss:'the physical invitation dismiss action hides only its card and returns continue focus',
 persisted:'dismissal survives a real authenticated reload without fetching the invitation image again',
 public:'the public login never opens an extra invitation or requests its illustration',
 original:'the original continue action closes welcome and retains all thirteen native tabs',
 economy:'invitation and dismissal never grant Kepler credits or write a Kepler reward',
 errors:'all invitation actions finish without JavaScript or unexpected HTTP errors',
 frozen:'all original graphics and invitation inputs remain byte-identical during native actions'};
const manifest=[...viewports.flatMap(v=>[labels.continue(v.width),labels.image(v.width),labels.link(v.width)]),labels.english,labels.dismiss,labels.persisted,labels.public,labels.original,labels.economy,labels.errors,labels.frozen];
const files=[SPIELDATEI,path.join(WURZEL,'kepler-graphics.css'),path.join(WURZEL,'kepler-english.json'),path.join(WURZEL,'service-worker.js'),...fs.readdirSync(WURZEL).filter(n=>/^kepler-gfx-[a-z-]+\.(png|webp)$/.test(n)).map(n=>path.join(WURZEL,n)),path.join(WURZEL,'void-sector-invitation.png'),path.join(WURZEL,'locales/en.json'),path.join(WURZEL,'docs/void-sector-invitation-art.json'),__filename,path.join(__dirname,'lib/ship-raster-fixture.js')];if(SERVER_JS)files.push(SERVER_JS);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),snapshot=()=>Object.fromEntries(files.map(p=>[path.relative(WURZEL,p),hash(p)]));
const artwork=JSON.parse(fs.readFileSync(path.join(WURZEL,'docs/void-sector-invitation-art.json'),'utf8'));
module.exports={labels,manifest,viewports,files,snapshot};
async function physical(page,selector){const node=page.locator(selector);if(await node.count()!==1||!await node.isVisible())return null;await node.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));return node.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,hit:e.contains(hit),fit:e.scrollWidth<=e.clientWidth+1,client:document.documentElement.clientWidth,viewport:innerHeight};});}
const touch=r=>!!r&&r.hit&&r.fit&&r.width>=44&&r.height>=44&&r.left>=0&&r.right<=r.client+1&&r.top>=0&&r.bottom<=r.viewport+1;
function nextReturningSave(run){
 // Supply the deliberate returning timestamp at the real fixture HTTP read.
 // The previous document may still persist its newer save while navigating.
 const get=run.store.get;const witness={served:false};
 run.store.get=function(key){const value=get.call(this,key);if(key!=='kepler7-save-v3')return value;run.store.get=get;const save=JSON.parse(value);save.lastTick=Date.now()-65000;witness.served=true;return JSON.stringify(save);};
 return witness;
}
async function main(){const records=[],runs=[],before=snapshot(),check=(name,ok,detail)=>{records.push({name,ok:!!ok});console.log((ok?'OK':'FAIL')+' - '+name+(detail?' | '+JSON.stringify(detail):''));};let browser,error,economy=true;
 try{
  browser=await starteBrowser();
  for(const viewport of viewports){
   const run=await f.fixture(browser,{welcome:true,viewport});runs.push(run);const page=run.page;
   await run.context.route('https://void.gamegeeeeek.de/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Isolated destination</title>'}));
   const continueBox=await physical(page,'#welcomeBackDismissBtn');
   const order=await page.evaluate(()=>{const a=document.getElementById('welcomeBackDismissBtn'),b=document.getElementById('voidSectorInvitation');return !!a&&!!b&&!!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING)&&a.closest('#welcomeBackOverlay')===b.closest('#welcomeBackOverlay');});
   check(labels.continue(viewport.width),order&&touch(continueBox)&&await page.locator('#welcomeBackOverlay').isVisible(),{order,continueBox});
   const imageReady=await f.boolean(page,()=>{const e=document.querySelector('#voidSectorInvitation img');return !!e&&e.complete&&e.naturalWidth===384&&e.naturalHeight===256&&new URL(e.currentSrc).pathname==='/void-sector-invitation.png';},null,8000);
   const card=await page.locator('#voidSectorInvitation').count()?await page.locator('#voidSectorInvitation').evaluate(e=>{const r=e.getBoundingClientRect(),img=e.querySelector('img'),ir=img.getBoundingClientRect();return {visible:!e.hidden&&r.width>0&&r.height>0,left:r.left,right:r.right,client:document.documentElement.clientWidth,fit:e.scrollWidth<=e.clientWidth+1,image:[ir.width,ir.height],text:e.textContent};}):null;
   check(labels.image(viewport.width),imageReady&&artwork.assetSha256===hash(path.join(WURZEL,'void-sector-invitation.png'))&&!!card&&card.visible&&card.fit&&card.left>=0&&card.right<=card.client+1&&card.image[0]<=96&&card.image[1]<=64&&card.image.every(n=>n>0)&&card.text.includes('+250 Credits und +5 Hunter-Raketen')&&card.text.includes('Einmalig für ein neues Void-Sector-Konto'),{imageReady,card});
   const link=page.locator('#voidSectorInvitationLink'),box=await physical(page,'#voidSectorInvitationLink'),creditsBefore=JSON.parse(run.store.get('kepler7-save-v3')).credits,creditTextBefore=await page.locator('#creditsDisplay').textContent();let destination=null,noopener=false;
   if(touch(box)){
    const next=run.context.waitForEvent('page');await page.mouse.click((box.left+box.right)/2,(box.top+box.bottom)/2);const popup=await next;await popup.waitForLoadState('domcontentloaded');destination=popup.url();noopener=await popup.evaluate(()=>window.opener===null);await popup.close();
   }
   const attrs=await link.count()?await link.evaluate(e=>({href:e.href,target:e.target,rel:e.rel})):null;
   economy=economy&&Number.isFinite(creditsBefore)&&JSON.parse(run.store.get('kepler7-save-v3')).credits===creditsBefore&&await page.locator('#creditsDisplay').textContent()===creditTextBefore;
   check(labels.link(viewport.width),touch(box)&&destination==='https://void.gamegeeeeek.de/?ref=kepler7'&&noopener&&attrs?.href===destination&&attrs.target==='_blank'&&attrs.rel.includes('noopener')&&attrs.rel.includes('noreferrer'),{box,destination,noopener,attrs});
  }
  const run=await f.fixture(browser,{welcome:true,viewport:{width:320,height:740},save:{uiDisplaySize:'large'}});runs.push(run);const page=run.page;
  const englishReturn=nextReturningSave(run),url=new URL(page.url());url.searchParams.set('lang','en');await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.locator('#welcomeBackOverlay').waitFor({state:'visible'});
  const english=await f.boolean(page,()=>document.getElementById('voidSectorInvitation')?.textContent.includes('Kepler starter bonus: +250 credits and +5 Hunter missiles'));
  const en=await page.locator('#voidSectorInvitation').evaluate(e=>({text:e.textContent,aria:e.querySelector('button').getAttribute('aria-label'),alt:e.querySelector('img').alt,lang:document.documentElement.lang,fit:e.scrollWidth<=e.clientWidth+1,size:document.body.dataset.commandDisplaySize}));
  check(labels.english,englishReturn.served&&english&&en.lang==='en'&&en.size==='large'&&en.fit&&en.text.includes('Once for a new Void Sector account created through this link.')&&en.text.includes('Play Void Sector')&&en.aria==="Don't show the Void Sector invitation again"&&en.alt.includes('glowing jump gate'),en);
  const initial=JSON.parse(run.store.get('kepler7-save-v3')),dismiss=await physical(page,'#voidSectorInvitationDismiss');if(touch(dismiss))await f.pointer(page,'#voidSectorInvitationDismiss');
  const dismissed=await page.evaluate(()=>({hidden:document.getElementById('voidSectorInvitation').hidden,focus:document.activeElement?.id,stored:localStorage.getItem('kepler7-void-sector-invitation-hidden')}));
  check(labels.dismiss,touch(dismiss)&&dismissed.hidden&&dismissed.focus==='welcomeBackDismissBtn'&&dismissed.stored==='1'&&await page.locator('#welcomeBackOverlay').isVisible(),{dismiss,dismissed});
  const after=JSON.parse(run.store.get('kepler7-save-v3'));economy=economy&&Number.isFinite(initial.credits)&&initial.credits===after.credits&&JSON.stringify(initial.rareItems)===JSON.stringify(after.rareItems)&&!Object.hasOwn(after,'voidSectorBonus');
  const imageRequests=run.requests.filter(r=>r.path==='/void-sector-invitation.png').length,dismissedReturn=nextReturningSave(run);await page.reload({waitUntil:'domcontentloaded'});await page.locator('#welcomeBackOverlay').waitFor({state:'visible'});
  const persisted=await f.boolean(page,()=>document.getElementById('voidSectorInvitation')?.hidden===true&&localStorage.getItem('kepler7-void-sector-invitation-hidden')==='1');
  check(labels.persisted,dismissedReturn.served&&persisted&&run.requests.filter(r=>r.path==='/void-sector-invitation.png').length===imageRequests,{persisted,imageRequests,after:run.requests.filter(r=>r.path==='/void-sector-invitation.png').length});
  const publicRun=await f.fixture(browser,{public:true,viewport:{width:390,height:844}});runs.push(publicRun);
  check(labels.public,await publicRun.page.locator('#loginOverlay').isVisible()&&!await publicRun.page.locator('#welcomeBackOverlay').isVisible()&&await publicRun.page.locator('#voidSectorInvitation').evaluate(e=>e.hidden&&!e.querySelector('img').hasAttribute('src'))&&publicRun.requests.every(r=>r.path!=='/void-sector-invitation.png'));
  await f.pointer(page,'#welcomeBackDismissBtn');await page.locator('#welcomeBackOverlay').waitFor({state:'hidden'});const tabs=await page.locator('.tab-btn').evaluateAll(es=>es.map(e=>e.dataset.tab));
  check(labels.original,JSON.stringify(tabs)===JSON.stringify(f.TABS)&&await page.locator('#tab-basis').isVisible(),{tabs});
  check(labels.economy,economy,{creditsBefore:initial.credits,creditsAfter:after.credits});
 }catch(e){error=e;console.error(e.stack);}
 finally{for(const run of runs)await run.close();if(browser)await browser.close();}
 check(labels.errors,!error&&runs.length===6&&runs.every(r=>r.errors.length===0&&r.httpErrors.length===0),{error:error?.message,runs:runs.map(r=>({js:r.errors,http:r.httpErrors}))});
 check(labels.frozen,JSON.stringify(snapshot())===JSON.stringify(before),{files:files.length});
 const failures=records.filter(r=>!r.ok).length+(error?1:0);console.log((failures?'FAIL':'OK')+' - Void sector invitation | '+JSON.stringify({checks:records.length,failures}));process.exitCode=failures?1:0;
}
if(require.main===module)main();
