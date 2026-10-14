'use strict';
// Native entry flows use the normal loopback HTTP runner and actual shipped CSS/catalogue.
// No real account is created: only the API responses are an isolated anonymous fixture.
const fs=require('node:fs'),assert=require('node:assert/strict');
const variants=[{language:'de',width:1440},{language:'en',width:1440},{language:'de',width:320},{language:'en',width:320}];
const labels={
 hero:'landing copy is legible over the brightest galaxy background',
 header:'landing navigation and system status remain readable',
 stats:'all four native landing statistics have readable captions',
 login:'login labels stay visible, associated and translated after typing',
 focus:'clicking each login label focuses its own native input',
 email:'login hides both the registration email input and its label',
 forgotHit:'the native forgotten-password link has a readable 44px target',
 register:'registration exposes three associated translated field labels',
 hint:'registration exposes the translated password length without changing login rules',
 return:'returning to login hides registration labels and length hints',
 forgot:'the native password-request state has an associated translated label',
 request:'the real password-request action sends the entered commander name',
 verify:'native verification-required registration clears its email label and hint',
 layout:'landing and its open login card fit the actual viewport',
 resetLabel:'reset-link entry exposes its associated translated new-password label',
 resetFocus:'clicking the reset label focuses the real password input',
 resetHint:'reset-link entry visibly explains the translated eight-character rule',
 resetSubmit:'the original native reset action submits token and new password',
 js:'all entry flows finish without JavaScript errors',
 http:'all entry flows finish without unexpected HTTP fixture errors'
};
const prefix=v=>v.language+'/'+v.width;
const mainLabels=['hero','header','stats','login','focus','email','forgotHit','register','hint','return','forgot','request','verify','layout'];
const resetLabels=['resetLabel','resetFocus','resetHint','resetSubmit'];
const manifest=[...variants.flatMap(v=>mainLabels.map(k=>prefix(v)+': '+labels[k])),...['de','en'].flatMap(language=>resetLabels.map(k=>language+'/reset: '+labels[k])),labels.js,labels.http];
assert.equal(manifest.length,66);assert.equal(new Set(manifest).size,66);

async function main(){
 const {starteBrowser,SPIEL_URL}=require('./lib/umgebung');
 const records=[],errors=[],httpErrors=[];
 const check=(name,ok,data)=>{records.push({name,ok:!!ok});console.log((ok?'OK':'FAIL')+' - '+name+(data===undefined?'':' | '+JSON.stringify(data)));};
 const browser=await starteBrowser();
 const translated={de:{username:'Kommandantenname',password:'Passwort',email:'E-Mail (Pflicht – für die Konto-Bestätigung)',newPassword:'Neues Passwort',hint:'Mindestens 8 Zeichen'},en:{username:'Commander name',password:'Password',email:'Email (required for account verification)',newPassword:'New password',hint:'At least 8 characters'}};
 async function open(language,width,reset=false){
  const context=await browser.newContext({viewport:{width,height:width<=520?844:900},serviceWorkers:'block'}),page=await context.newPage(),requests=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('response',response=>{if(response.status()>=400&&!response.url().includes('/api/'))httpErrors.push({url:response.url(),status:response.status()});});
  page.on('requestfailed',request=>{if(!/ERR_ABORTED/.test(request.failure()?.errorText||''))httpErrors.push({url:request.url(),error:request.failure()});});
  await page.route('**/api/**',async route=>{
   const req=route.request(),pathname=new URL(req.url()).pathname;
   const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(pathname==='/api/health')return json({ok:true});
   if(pathname==='/api/me')return json({error:'Not authenticated'},401);
   if(['/api/request-password-reset','/api/reset-password','/api/register'].includes(pathname)){
    requests.push({path:pathname,method:req.method(),body:JSON.parse(req.postData()||'{}')});
    return json(pathname==='/api/register'?{needsVerification:true}: {ok:true});
   }
   if(/reports|messages/.test(pathname))return json({reports:[],messages:[]});
   if(/leaderboard|ranking|wars|halloffame|bounty|friends/.test(pathname))return json([]);
   if(pathname.includes('pending-rewards'))return json({reward:null});
   return json({});
  });
  // Only genuine CSS counterexamples set this path. The normal run loads the shipped sheet.
  if(process.env.KEPLER_ENTRY_CSS)await page.route('**/kepler-graphics.css*',route=>route.fulfill({status:200,contentType:'text/css; charset=utf-8',body:fs.readFileSync(process.env.KEPLER_ENTRY_CSS)}));
  const url=new URL(SPIEL_URL);url.searchParams.set('lang',language);if(reset)url.searchParams.set('reset','entry-fixture-token');
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.locator('#loginOverlay').waitFor({state:'visible'});
  await page.waitForFunction(()=>Number(document.getElementById('llStatSystems')?.textContent)>0);
  return {context,page,requests};
 }
 async function labelFacts(page,ids,expected){
  return page.evaluate(({ids,expected})=>{
   const visible=node=>{if(!node)return false;const rect=node.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return false;for(let n=node;n;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0)return false;}return true;};
   return ids.map((id,i)=>{const input=document.getElementById(id),label=document.getElementById(id+'Label');return {id,inputVisible:visible(input),labelVisible:visible(label),associated:!!label&&label.control===input&&input.labels.length===1,text:label?.textContent.trim(),expected:expected[i],value:input?.value};});
  },{ids,expected});
 }
 const correct=facts=>facts.length>0&&facts.every(f=>f.inputVisible&&f.labelVisible&&f.associated&&f.text===f.expected);
 async function labelFocus(page,ids,button){
  const results=[];
  for(const id of ids){await page.locator(button).focus();const label=page.locator('#'+id+'Label');if(await label.isVisible())await label.click();results.push({id,active:await page.evaluate(()=>document.activeElement?.id)});}
  return results;
 }
 async function hidden(page,ids){return page.evaluate(ids=>ids.map(id=>{const node=document.getElementById(id);if(!node)return {id,exists:false,hidden:false};const r=node.getBoundingClientRect();return {id,exists:true,hidden:r.width===0&&r.height===0};}),ids);}
 const allHidden=facts=>facts.length>0&&facts.every(f=>f.exists&&f.hidden);
 async function landing(page){
  return page.evaluate(()=>{
   const rgba=text=>{const m=String(text).match(/[\d.]+/g);return m&&m.length>=3?[Number(m[0]),Number(m[1]),Number(m[2]),m.length>3?Number(m[3]):1]:null;};
   const blend=(c,bg)=>c&&[0,1,2].map(i=>c[i]*c[3]+bg[i]*(1-c[3]));
   const lum=c=>c.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
   const contrast=(text,bg)=>{if(!text||!bg)return 0;const a=lum(blend(text,bg)),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
   const scrim=document.querySelector('.ll-sky-scrim'),stops=getComputedStyle(scrim).backgroundImage.match(/rgba?\([^)]*\)/g)||[];
   const scrimRect=scrim.getBoundingClientRect();let scrimVisible=scrim.isConnected,scrimOpacity=1;
   for(let node=scrim;node;node=node.parentElement){const style=getComputedStyle(node);scrimVisible=scrimVisible&&style.display!=='none'&&style.visibility==='visible';scrimOpacity*=Number(style.opacity);}
   const protection={connected:scrim.isConnected,visible:scrimVisible,effectiveOpacity:scrimOpacity,coversViewport:scrimRect.left<=0&&scrimRect.top<=0&&scrimRect.right>=document.documentElement.clientWidth&&scrimRect.bottom>=innerHeight,rect:{left:scrimRect.left,top:scrimRect.top,right:scrimRect.right,bottom:scrimRect.bottom}};
   const backgrounds=stops.map(rgba).map(c=>blend(c,[255,255,255]));
   const fact=(selector,bgs)=>{const node=document.querySelector(selector),s=node&&getComputedStyle(node),r=node?.getBoundingClientRect();return {exists:!!node,visible:!!r&&r.width>0&&r.height>0,font:s?parseFloat(s.fontSize):0,text:node?.textContent.trim(),ratio:s&&bgs.length?Math.min(...bgs.map(bg=>contrast(rgba(s.color),bg))):0};};
   const top=document.querySelector('.ll-topbar'),live=document.querySelector('.ll-livebar'),topBg=blend(rgba(getComputedStyle(top).backgroundColor),[255,255,255]),liveBg=blend(rgba(getComputedStyle(live).backgroundColor),[255,255,255]);
   return {protection,hero:[fact('.ll-h1',backgrounds),fact('.ll-lede',backgrounds),fact('.ll-trust',backgrounds),fact('.ll-kicker',backgrounds),fact('.ll-trust b',backgrounds)],header:fact('.ll-topbar > div:last-child',[topBg]),nav:[...top.querySelectorAll('nav a')].filter(n=>n.getBoundingClientRect().width>0).map(n=>{const s=getComputedStyle(n);return {text:n.textContent,font:parseFloat(s.fontSize),ratio:contrast(rgba(s.color),topBg)};}),stats:[...live.querySelectorAll('span')].map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {text:n.textContent.trim(),visible:r.width>0&&r.height>0,font:parseFloat(s.fontSize),ratio:contrast(rgba(s.color),liveBg)};})};
  });
 }
 try{
  for(const variant of variants){
   const {language,width}=variant,p=prefix(variant),t=translated[language],{context,page,requests}=await open(language,width);
   try{
    const art=await landing(page);
    check(p+': '+labels.hero,art.protection.connected&&art.protection.visible&&art.protection.effectiveOpacity===1&&art.protection.coversViewport&&art.hero.length===5&&art.hero.every(f=>f.exists&&f.visible&&f.text&&f.ratio>=4.5),{protection:art.protection,text:art.hero});
    check(p+': '+labels.header,art.header.exists&&art.header.visible&&art.header.text&&art.header.font>=12&&art.header.ratio>=4.5&&(width<821?art.nav.length===0:art.nav.length===4&&art.nav.every(f=>f.font>=12&&f.ratio>=4.5)),{header:art.header,nav:art.nav});
    check(p+': '+labels.stats,art.stats.length===4&&art.stats.every(f=>f.visible&&f.text&&f.font>=12&&f.ratio>=4.5),art.stats);
    await page.locator('.ll-actions [data-ll-open="login"]').click();
    await page.locator('#loginCardNormal').waitFor({state:'visible'});
    await page.locator('#loginUsername').fill('EntryProbe');await page.locator('#loginPassword').fill('old123');
    const loginFacts=await labelFacts(page,['loginUsername','loginPassword'],[t.username,t.password]);
    check(p+': '+labels.login,correct(loginFacts)&&loginFacts.every(f=>f.value),loginFacts);
    const focused=await labelFocus(page,['loginUsername','loginPassword'],'#loginSubmitBtn');check(p+': '+labels.focus,focused.every(f=>f.active===f.id),focused);
    const loginHidden=await hidden(page,['loginEmail','loginEmailLabel','loginPasswordHint']);check(p+': '+labels.email,allHidden(loginHidden),loginHidden);
    await page.locator('#forgotPasswordLink').scrollIntoViewIfNeeded();
    const link=await page.locator('#forgotPasswordLink').evaluate(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node),point={x:r.x+r.width/2,y:r.y+r.height/2};return {height:r.height,font:parseFloat(s.fontSize),visible:r.width>0&&r.height>0,hit:node.contains(document.elementFromPoint(point.x,point.y))};});
    check(p+': '+labels.forgotHit,link.visible&&link.height>=44&&link.font>=14&&link.hit,link);
    await page.locator('#registerTabBtn').click();
    const regFacts=await labelFacts(page,['loginUsername','loginEmail','loginPassword'],[t.username,t.email,t.password]);check(p+': '+labels.register,correct(regFacts),regFacts);
    const hint=await page.locator('#loginPasswordHint').evaluate(node=>({visible:node.getBoundingClientRect().height>0,text:node.textContent.trim()}));check(p+': '+labels.hint,hint.visible&&hint.text===t.hint,hint);
    await page.locator('#loginTabBtn').click();
    const returned=await hidden(page,['loginEmail','loginEmailLabel','loginPasswordHint']);check(p+': '+labels.return,allHidden(returned)&&(await page.locator('#loginPassword').getAttribute('placeholder'))===t.password,returned);
    await page.locator('#forgotPasswordLink').click();await page.locator('#loginCardForgot').waitFor({state:'visible'});
    const forgotFacts=await labelFacts(page,['forgotUsername'],[t.username]),forgotFocus=await labelFocus(page,['forgotUsername'],'#forgotSubmitBtn');check(p+': '+labels.forgot,correct(forgotFacts)&&forgotFocus[0].active==='forgotUsername',{facts:forgotFacts,focus:forgotFocus});
    await page.locator('#forgotUsername').fill('EntryProbe');await page.locator('#forgotSubmitBtn').click();await page.waitForFunction(()=>!document.getElementById('forgotSubmitBtn').disabled);
    check(p+': '+labels.request,requests.some(r=>r.path==='/api/request-password-reset'&&r.method==='POST'&&r.body.username==='EntryProbe'),requests);
    await page.locator('#backToLoginLink').click();await page.locator('#registerTabBtn').click();
    await page.locator('#loginUsername').fill('EntryProbe');await page.locator('#loginEmail').fill('entry@example.test');await page.locator('#loginPassword').fill('entrysecret8');await page.locator('#loginTosCheckbox').check();await page.locator('#loginSubmitBtn').click();
    await page.waitForFunction(()=>!document.getElementById('loginSubmitBtn').disabled&&document.getElementById('loginTabBtn').classList.contains('active'));
    const verifyHidden=await hidden(page,['loginEmail','loginEmailLabel','loginPasswordHint']);
    check(p+': '+labels.verify,allHidden(verifyHidden)&&requests.some(r=>r.path==='/api/register'&&r.body.username==='EntryProbe'&&r.body.email==='entry@example.test'&&r.body.password==='entrysecret8'),{hidden:verifyHidden,requests});
    const fit=await page.evaluate(()=>{const r=document.getElementById('loginCardNormal').getBoundingClientRect(),d=document.documentElement;return {client:d.clientWidth,scroll:d.scrollWidth,left:r.left,right:r.right,visible:r.width>0};});check(p+': '+labels.layout,fit.visible&&fit.scroll<=fit.client+1&&fit.left>=-1&&fit.right<=fit.client+1,fit);
   }finally{await context.close();}
  }
  for(const language of ['de','en']){
   const t=translated[language],p=language+'/reset',{context,page,requests}=await open(language,320,true);
   try{
    await page.locator('#loginCardReset').waitFor({state:'visible'});const facts=await labelFacts(page,['resetNewPassword'],[t.newPassword]);check(p+': '+labels.resetLabel,correct(facts),facts);
    const focus=await labelFocus(page,['resetNewPassword'],'#resetSubmitBtn');check(p+': '+labels.resetFocus,focus[0].active==='resetNewPassword',focus);
    const hint=await page.locator('#loginCardReset .login-field-hint').evaluate(node=>({visible:node.getBoundingClientRect().height>0,text:node.textContent.trim()}));check(p+': '+labels.resetHint,hint.visible&&hint.text===t.hint,hint);
    await page.locator('#resetNewPassword').fill('newsecret8');await page.locator('#resetSubmitBtn').click();await page.locator('#loginCardNormal').waitFor({state:'visible'});
    check(p+': '+labels.resetSubmit,requests.some(r=>r.path==='/api/reset-password'&&r.method==='POST'&&r.body.token==='entry-fixture-token'&&r.body.newPassword==='newsecret8')&&!new URL(page.url()).searchParams.has('reset'),requests);
   }finally{await context.close();}
  }
  check(labels.js,errors.length===0,errors);check(labels.http,httpErrors.length===0,httpErrors);
  assert.deepEqual(records.map(r=>r.name),manifest,'entry test must finish the complete ordered manifest');
  const failures=records.filter(r=>!r.ok).length;console.log(records.length+' checks, '+failures+' failures');console.log((failures?'FAIL':'OK')+' - Native interface entry');if(failures)process.exitCode=1;
 }finally{await browser.close();}
}
module.exports={manifest,labels,variants,mainLabels,resetLabels};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
