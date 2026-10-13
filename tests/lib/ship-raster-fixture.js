'use strict';
// An actual HTTP save and original assets. No runtime exports, patched observers,
// artificial game clocks, force-clicks or replacement controls.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const {SPIELDATEI,WURZEL}=require('./spieldatei');
const {ruhigeUhren}=require('./umgebung');
const TABS=['basis','verteidigung','forschung','flotte','expedition','karte','galaxie','allianz','offiziere','markt','punkte','fortschritt','sammlung'];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function boolean(page,fn,arg,timeout=10000){const until=Date.now()+timeout;do{if(await page.evaluate(fn,arg)===true)return true;await delay(40);}while(Date.now()<until);return false;}
async function pointer(page,selector){const end=Date.now()+10000;let detached;do{const target=page.locator(selector).first();try{await target.scrollIntoViewIfNeeded({timeout:Math.max(1,end-Date.now())});const hit=await target.evaluate(e=>{if(!e.isConnected)return null;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});if(hit===null)continue;if(!hit)throw Error('Native pointer target blocked: '+selector);await target.click({timeout:Math.max(1,end-Date.now())});return true;}catch(error){if(!/Element is not attached to the DOM|Element is not connected|element was detached/i.test(error.message))throw error;detached=error;}}while(Date.now()<end);throw detached||Error('Native pointer target never stayed connected: '+selector);}
async function tab(page,key){if(await page.locator('#commandMenuToggle').isVisible()&&!(await page.locator('#commandNav').evaluate(e=>e.classList.contains('open'))))await pointer(page,'#commandMenuToggle');await pointer(page,'#commandNav .tab-btn[data-tab="'+key+'"]');await page.locator('#tab-'+key).waitFor({state:'visible'});}
function save(overrides={}){const marketing=fs.readFileSync(path.join(WURZEL,'marketing-screenshots.js'),'utf8'),a=marketing.indexOf('function spielstand()'),b=marketing.indexOf('// Demo-Bestenliste',a);if(a<0||b<=a)throw Error('Native marketing save anchors missing');const original=JSON.parse(vm.runInNewContext(marketing.slice(a,b)+'\nspielstand();',{Date},{timeout:1000})),source=fs.readFileSync(SPIELDATEI,'utf8'),version=source.match(/\bconst VERSION\s*=\s*['"]([^'"]+)['"]/);if(!version)throw Error('Native VERSION missing');return {...original,...ruhigeUhren(),shipSkin:'standard',shipMarks:{},soundOn:false,lastTick:Date.now()-60000,lastSeenVersion:version[1],lastLoginDate:new Date().toDateString(),seenTabHints:Object.fromEntries([...TABS,'einstellungen','hilfe','berichte'].map(key=>[key,true])),...overrides};}
async function fixture(browser,options={}){
 const source=fs.readFileSync(SPIELDATEI,'utf8'),requests=[],errors=[],httpErrors=[],store=new Map([['kepler7-save-v3',JSON.stringify(save(options.save))]]),waiting=[];
 let phase='boot',released=!options.hold,closed=false;const releasedNames=new Set();
 const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1'),entry={path:u.pathname,query:u.search,method:req.method,phase,destination:req.headers['sec-fetch-dest']||'',at:Date.now()};requests.push(entry);
  const send=(status,body,mime='application/json')=>{entry.status=status;res.writeHead(status,{'Content-Type':mime,'Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store'});res.end(body);};const json=(value,status=200)=>send(status,JSON.stringify(value));
  try{if(u.pathname.startsWith('/api/')){const key=u.pathname.slice(5);if(key==='health')return json({ok:true});if(key==='me'){if(options.public){entry.expected=true;return json({error:'not logged in'},401);}return json({userId:'u',username:'Kommandant',homeSystem:'kepler',homeSlot:0,hasEmail:true,wantsPatchnotes:false});}
   if(key==='storage-list')return json({keys:[...store.keys()].filter(k=>k.startsWith(u.searchParams.get('prefix')||''))});
   if(key.startsWith('storage/')){const name=decodeURIComponent(key.slice(8));if(['PUT','POST'].includes(req.method)){let body='';for await(const chunk of req)body+=chunk;store.set(name,JSON.parse(body).value);return json({ok:true,version:1});}return store.has(name)?json({value:store.get(name),version:1}):json({},404);}
   if(Object.prototype.hasOwnProperty.call(options.api||{},key))return json(options.api[key]);
   if(key==='reports')return json({reports:options.reports||[]});if(key.includes('pending-rewards')||key.includes('claim'))return json({reward:null});
   if(key==='galaxy')return json({npcEmpireStrength:1.8,marketTrend:1,collapsedSystems:{},news:[],alienNester:[],wrackKonvois:options.convoys||[]});
   if(/leaderboard|messages|ranking|wars|halloffame|bounty|friends/.test(key))return json([]);return json({});}
   const name=u.pathname==='/'?'weltraum_kolonie.html':decodeURIComponent(u.pathname.slice(1));
   if(!u.searchParams.has('oracle')&&options.fail?.includes(name)){entry.expected=true;return send(404,'Controlled missing ship atlas','text/plain');}
   if(!u.searchParams.has('oracle')&&options.poison?.includes(name)){entry.expected=true;return send(200,Buffer.from('RIFF\0\0\0\0WEBPbad decoder'),'image/webp');}
   if(!released&&!releasedNames.has(name)&&options.hold?.includes(name))await new Promise(resolve=>waiting.push(Object.assign(resolve,{assetName:name})));
   const file=path.resolve(WURZEL,name);if(!file.startsWith(WURZEL+path.sep))throw Error('Path outside fixture');
   const bytes=name==='weltraum_kolonie.html'?Buffer.from(source):name==='kepler-graphics.css'&&process.env.KEPLER_SHIP_CSS?fs.readFileSync(process.env.KEPLER_SHIP_CSS):await fs.promises.readFile(file);
   return send(200,bytes,{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.txt':'text/plain'}[path.extname(name)]||'application/octet-stream');
  }catch(error){httpErrors.push({path:u.pathname,error:error.message});if(!res.headersSent)send(500,'Fixture failed','text/plain');else res.end();}
 });let context;
 const close=async()=>{if(closed)return;closed=true;released=true;for(const resolve of waiting.splice(0))resolve();try{if(context)await context.close();}finally{server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}};
 try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const origin='http://127.0.0.1:'+server.address().port;context=await browser.newContext({viewport:options.viewport||{width:1487,height:1058},deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:options.reduced?'reduce':'no-preference'});
 if(!options.public)await context.addCookies([{url:origin,name:'kepler7_graphics_fixture',value:'isolated',httpOnly:true,sameSite:'Lax'}]);
 await context.addInitScript(()=>localStorage.setItem('kepler7-ui-language','de'));
 if(options.noIO)await context.addInitScript(()=>{delete window.IntersectionObserver;});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin,{waitUntil:'domcontentloaded'});
 if(options.public)await page.locator('#loginOverlay').waitFor({state:'visible'});else{await page.waitForFunction(()=>document.body.classList.contains('command-ui')&&document.getElementById('commandPlayerName')?.textContent==='Kommandant',null,{timeout:options.bootTimeout||20000});await page.locator('#welcomeBackOverlay').waitFor({state:'visible',timeout:15000});if(!options.welcome)await pointer(page,'#welcomeBackDismissBtn');}
 return {page,context,store,requests,errors,httpErrors,phase:value=>{phase=value;},release:name=>{if(name){releasedNames.add(name);for(let i=waiting.length-1;i>=0;i--)if(waiting[i].assetName===name)waiting.splice(i,1)[0]();}else{released=true;for(const resolve of waiting.splice(0))resolve();}},close};
 }catch(error){await close();throw error;}
}
module.exports={TABS,delay,boolean,pointer,tab,save,fixture};
