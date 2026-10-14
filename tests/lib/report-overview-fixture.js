'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {SPIELDATEI,WURZEL}=require('./spieldatei');
const {save,pointer,boolean}=require('./ship-raster-fixture');
async function fixture(browser,{reports=[],language='de',viewport={width:1280,height:1000}}={}){
 let current=reports,context,closed=false;
 const source=fs.readFileSync(SPIELDATEI),requests=[],errors=[],httpErrors=[],store=new Map([['kepler7-save-v3',JSON.stringify(save())]]);
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1'),entry={path:url.pathname,method:req.method};requests.push(entry);
  const send=(status,body,mime='application/json')=>{const bytes=Buffer.isBuffer(body)?body:Buffer.from(body);entry.status=status;res.writeHead(status,{'Content-Type':mime,'Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);};
  const json=(body,status=200)=>send(status,JSON.stringify(body));
  try{
   if(url.pathname.startsWith('/api/')){
    const key=url.pathname.slice(5);
    if(key==='health')return json({ok:true});
    if(key==='me')return json({userId:'u',username:'Kommandant',homeSystem:'kepler',homeSlot:0,hasEmail:true,wantsPatchnotes:false});
    if(key==='storage-list')return json({keys:[...store.keys()].filter(k=>k.startsWith(url.searchParams.get('prefix')||''))});
    if(key.startsWith('storage/')){
     const name=decodeURIComponent(key.slice(8));
     if(['PUT','POST'].includes(req.method)){let body='';for await(const chunk of req)body+=chunk;store.set(name,JSON.parse(body).value);return json({ok:true,version:1});}
     if(!store.has(name)){entry.expected=true;return json({},404);}return json({value:store.get(name),version:1});
    }
    if(key==='reports')return json({reports:current});
    if(key.includes('pending-rewards')||key.includes('claim'))return json({reward:null});
    if(key==='galaxy')return json({npcEmpireStrength:1.8,marketTrend:1,collapsedSystems:{},news:[],alienNester:[],wrackKonvois:[]});
    if(/leaderboard|messages|ranking|wars|halloffame|bounty|friends/.test(key))return json([]);
    return json({});
   }
   const name=url.pathname==='/'?'weltraum_kolonie.html':decodeURIComponent(url.pathname.slice(1)),file=path.resolve(WURZEL,name);
   if(!file.startsWith(WURZEL+path.sep))throw Error('Fixture path outside repository');
   const bytes=name==='weltraum_kolonie.html'?source:name==='kepler-graphics.css'&&process.env.KEPLER_REPORT_CSS?fs.readFileSync(process.env.KEPLER_REPORT_CSS):await fs.promises.readFile(file);
   send(200,bytes,{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.txt':'text/plain'}[path.extname(name)]||'application/octet-stream');
  }catch(error){httpErrors.push({path:url.pathname,error:error.message});if(!res.headersSent)send(500,'Fixture failed','text/plain');else res.end();}
 });
 const close=async()=>{if(closed)return;closed=true;try{if(context)await context.close();}finally{server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}};
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin='http://127.0.0.1:'+server.address().port;
  context=await browser.newContext({viewport,deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce'});
  await context.addCookies([{url:origin,name:'kepler7_graphics_fixture',value:'isolated',httpOnly:true,sameSite:'Lax'}]);
  await context.addInitScript(value=>localStorage.setItem('kepler7-ui-language',value),language);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/?lang='+language,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.classList.contains('command-ui')&&document.getElementById('commandPlayerName')?.textContent==='Kommandant',null,{timeout:20000});
  await page.locator('#welcomeBackOverlay').waitFor({state:'visible',timeout:15000});await pointer(page,'#welcomeBackDismissBtn');
  await pointer(page,'#headerReportsBtn');await page.locator('#reportsBox').waitFor({state:'visible'});
  await boolean(page,()=>document.querySelectorAll('#reportsBox [data-report-card]').length>0);
  return {page,context,requests,errors,httpErrors,setReports:value=>{current=value;},close};
 }catch(error){await close();throw error;}
}
module.exports={fixture};
