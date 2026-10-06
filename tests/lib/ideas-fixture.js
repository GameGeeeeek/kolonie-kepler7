'use strict';
const fs=require('fs'),http=require('http'),assert=require('node:assert/strict');
const {SPIELDATEI,starteBrowser,ruhigeUhren}=require('./umgebung');
module.exports=async function fixture(api,language='de',options={}){
  const source=fs.readFileSync(SPIELDATEI,'utf8').replace(/\r\n/g,'\n'),end='\n})();\n</script>\n</body>';
  assert.equal(source.split(end).length,2,'checked game export anchor');
  const html=source.replace(end,'\nwindow.__ideas={ready:()=>bootDataReady,state:()=>state,show:switchTab,'+api+'};\n'+end);
  const store={},errors=[],server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    const origin='http://127.0.0.1:'+server.address().port;browser=await starteBrowser();
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());if(url.origin!==origin)return route.abort();
      if(!url.pathname.startsWith('/api/'))return route.continue();
      const p=url.pathname.slice(5),json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
      if(options.api&&await options.api({path:p,request:req,json}))return;
      if(p==='me')return json({userId:'u',username:'ideenprobe',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:false});
      if(p.startsWith('storage/')){const key=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){store[key]=JSON.parse(req.postData()||'{}').value;return json({ok:true,version:1});}return store[key]===undefined?json({error:'missing'},404):json({key,value:store[key],version:1});}
      if(p.includes('pending-rewards'))return json({reward:null});
      if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends/.test(p))return json([]);
      return json({});
    });
    store['kepler7-save-v3']=JSON.stringify({tutorialSeen:true,newbieWelcomeSeen:true,
      resources:{energie:1000,erz:1000,kristalle:500,deuterium:200,antimaterie:0,forschungspunkte:50},buildings:{solar:2,mine:2,raffinerie:1,lager:3,labor:1},research:{},colonies:{},activeBasePlanet:'home',
      fleet:{ships:1,missions:[]},player:{id:'u',name:'ideenprobe',allianceTag:''},lastTick:Date.now(),lastLoginDate:new Date().toDateString(),lastSeenVersion:(source.match(/const VERSION\s*=\s*['"]([^'"]+)/)||[])[1],...ruhigeUhren()});
    await context.addInitScript(()=>localStorage.setItem('kepler7_token','fixture'));
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/?lang='+language);await page.waitForFunction(()=>window.__ideas&&__ideas.ready());
    await page.evaluate(()=>{for(const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']){const el=document.getElementById(id);if(el)el.style.display='none';}});
    return {page,store,errors,source,close:async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));}};
  }catch(error){if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));throw error;}
};
