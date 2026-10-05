'use strict';
// K7-005: execute the real inline implementation in Chromium. All accounts and APIs below
// are disposable local fixtures; no request may reach the production game.
const fs = require('fs');
const http = require('http');
const assert = require('node:assert/strict');
const { SPIELDATEI, starteBrowser, ruhigeUhren } = require('./lib/umgebung');
const source = fs.readFileSync(SPIELDATEI, 'utf8');
const end = '\n})();\n</script>\n</body>';
assert.equal(source.split(end).length - 1, 1, 'one verified test-export anchor');
const api = `\nwindow.__mapReview = { ready:()=>bootDataReady, state:()=>state,
  save:mapFavoriteSave, remove:mapFavoriteRemove, jump:mapFavoriteJump,
  rows:mapFavoriteRows, systemRows:mapSystemBookmarks, render:renderMapFavorites,
  visible:visibleSystems, hidden:()=>STAR_SYSTEMS.filter(s=>s.hidden),
  show:()=>switchTab('karte'), currentSystem:()=>activeSystem };\n`;
const html = source.replace(end, api+end);
const store = {};
let checks = 0, failed = 0;
function check(name, actual){ checks++; if(!actual)failed++; console.log((actual?'OK':'FAIL')+' - '+name); }
(async()=>{
  let browser, server;
  try {
    server = http.createServer((req,res)=>{
      res.writeHead(200,{'Content-Type': req.url.startsWith('/service-worker') ? 'application/javascript' : 'text/html'});
      res.end(req.url.startsWith('/service-worker') ? '' : html);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    browser=await starteBrowser();
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const req=route.request(), url=new URL(req.url());
      if(url.origin!==origin) return route.abort();
      if(!url.pathname.startsWith('/api/')) return route.continue();
      const p=url.pathname.slice(5), json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
      if(p==='health')return json({ok:true});
      if(p==='me')return json({userId:'u',username:'kartenprobe',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:false});
      if(p.startsWith('storage/')){
        const key=decodeURIComponent(p.slice(8));
        if(req.method()==='PUT'){store[key]=JSON.parse(req.postData()||'{}').value; return json({ok:true,version:1});}
        return store[key]===undefined ? json({error:'missing'},404) : json({key,value:store[key],version:1});
      }
      if(p.includes('pending-rewards'))return json({reward:null});
      if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends/.test(p))return json([]);
      return json({});
    });
    const now=Date.now();
    store['kepler7-save-v3']=JSON.stringify({tutorialSeen:true,newbieWelcomeSeen:true,
      resources:{energie:1000,erz:1000,kristalle:500,deuterium:200,antimaterie:0,forschungspunkte:50},
      buildings:{solar:2,mine:2,kristallmine:2,lager:3,labor:1},research:{},colonies:{},activeBasePlanet:'home',
      fleet:{ships:1,missions:[]},player:{id:'u',name:'kartenprobe',allianceTag:''},lastTick:now,
      lastLoginDate:new Date().toDateString(),lastSeenVersion:(source.match(/const VERSION\s*=\s*['"]([^'"]+)/)||[])[1],
      favoritePlanets:{},colonyNotes:{},...ruhigeUhren()});
    await context.addInitScript(()=>localStorage.setItem('kepler7_token','local-fixture'));
    const page=await context.newPage(), errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.goto(origin);
    await page.waitForFunction(()=>window.__mapReview && window.__mapReview.ready(),{timeout:15000});
    await page.evaluate(()=>{
      for(const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']){
        const el=document.getElementById(id); if(el)el.style.display='none';
      }
      __mapReview.show();
    });
    check('game boot completed without script errors',errors.length===0);
    const data=await page.evaluate(()=>{
      const t=__mapReview,s=t.state(),before=JSON.stringify(s.resources);
      const bad=t.hidden().find(x=>!t.visible().some(v=>v.id===x.id));
      const visible=t.visible().find(x=>x.id!=='kepler')||t.visible()[0];
      const malicious='\"><img src=x onerror=alert(1)> Meine Notiz';
      const own=t.save('colony','home',malicious), valid=t.save('system',visible.id,'Mein Treffpunkt');
      const hiddenRejected=bad ? !t.save('system',bad.id,'nicht zeigen') && !t.jump('system',bad.id) : false;
      const unknownRejected=!t.save('colony','__proto__','bad') && !t.save('system','not-a-system','bad');
      const sameResources=before===JSON.stringify(s.resources);
      return {own,valid,hiddenRejected,unknownRejected,sameResources,note:s.colonyNotes.home,malicious,id:visible.id};
    });
    for(const key of ['own','valid','hiddenRejected','unknownRejected','sameResources'])check(key,data[key]);
    check('notes remain literal text',data.note===data.malicious);
    await page.waitForTimeout(800);
    await page.evaluate(()=>__mapReview.render());
    await page.locator('#mapFavoritesBox summary').click();
    check('notes do not create HTML elements',await page.locator('#mapFavoritesBox img').count()===0);
    for(const width of [360,390,430,1200]){
      await page.setViewportSize({width,height:900});
      const layout=await page.locator('#mapFavoritesBox').evaluate(el=>{
        const r=el.getBoundingClientRect();
        return {within:r.left>=-1 && r.right<=innerWidth+1,overflow:el.scrollWidth<=el.clientWidth+1,
          buttons:[...el.querySelectorAll('button')].every(b=>b.getBoundingClientRect().height>=43)};
      });
      check('map favourites fit '+width+'px',layout.within&&layout.overflow&&layout.buttons);
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('#mapFavoriteTarget').selectOption('system:'+data.id);
    await page.locator('#mapFavoriteNote').fill('Termin am Freitag');
    await page.locator('#mapFavoriteForm button[type=submit]').click();
    await page.waitForTimeout(1000);
    check('editing through the actual form saves the note',await page.evaluate(id=>__mapReview.systemRows().find(r=>r.id===id).note==='Termin am Freitag',data.id));
    // save() is asynchronous: wait for the actual storage PUT rather than assuming it happened.
    const until=Date.now()+6000;
    while(Date.now()<until && !String(store['kepler7-save-v3']).includes('Termin am Freitag'))await page.waitForTimeout(100);
    check('new note reached persistent storage',String(store['kepler7-save-v3']).includes('Termin am Freitag'));
    await page.reload();await page.waitForFunction(()=>window.__mapReview&&__mapReview.ready());
    check('system note survives reload',await page.evaluate(id=>__mapReview.systemRows().some(r=>r.id===id&&r.note==='Termin am Freitag'),data.id));
    check('colony note survives reload',await page.evaluate(note=>__mapReview.state().colonyNotes.home===note,data.malicious));
    const boundaries=await page.evaluate(id=>{
      const t=__mapReview,s=t.state();
      t.remove('colony','home'); const noteKept=!!s.colonyNotes.home && !s.favoritePlanets.home;
      const systems=t.visible().slice(0,33); s.mapSystemBookmarks=[];
      let all=true;for(const item of systems.slice(0,32))all=t.save('system',item.id,'')&&all;
      const cap=systems.length===33&&!t.save('system',systems[32].id,'overflow');
      const editAtCap=t.save('system',systems[0].id,'edit while full');
      s.mapSystemBookmarks=[null,{id},{id,note:'duplicate'},{id:4},'bad',{id:'unknown-destination',note:'Keep my note'}];
      const clean=t.systemRows();const stale=t.rows().find(r=>r.id==='unknown-destination');
      return {noteKept,all,cap,editAtCap,clean:clean.length===2,stale:!!stale&&!stale.available&&stale.note==='Keep my note'};
    },data.id);
    for(const [key,value]of Object.entries(boundaries))check(key,value);
    check('new preference retained by both reset paths',(source.match(/mapSystemBookmarks:keepMapSystemBookmarks/g)||[]).length===2);
    check('no new browser errors',errors.length===0);
    console.log((failed?'FAIL':'PASS')+' '+checks+' checks');if(failed)process.exitCode=1;
  }finally{
    if(browser)await browser.close();
    if(server)await new Promise(resolve=>server.close(resolve));
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
