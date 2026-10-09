'use strict';
// Real game, isolated local API. The counterexample removes only forwarding of build actions.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {SPIELDATEI,WURZEL,starteBrowser,ruhigeUhren}=require('./lib/umgebung');
const {oeffneSektorMitSystem,oeffneSystemUeberSektoren}=require('./lib/karte');
const source=fs.readFileSync(SPIELDATEI,'utf8');
const end='\n})();\n</script>\n</body>';
assert.equal(source.split(end).length-1,1,'verified game export anchor');
const html=source.replace(end,`\nwindow.__gfxReview={ready:()=>bootDataReady,state:()=>state,show:s=>switchTab(s),render,
  stage:b=>gfxColonyStage(b),selectBuilding:k=>{gfxBuilding=k;renderGraphicsColony();},
  selectShip:k=>{gfxShip=k;renderGraphicsShipyard();},map:renderGraphicsMap};\n`+end);
let checks=0,failed=0;
const check=(name,ok,data)=>{checks++;if(!ok)failed++;console.log((ok?'OK':'FAIL')+' - '+name+(ok||!data?'':' '+JSON.stringify(data)));};
(async()=>{
 let server,browser;
 try {
  server=http.createServer((req,res)=>{
   if(req.url.split('?')[0]==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html);}
   const p=path.resolve(WURZEL,req.url.split('?')[0].slice(1));
   if(!p.startsWith(WURZEL+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}
   res.writeHead(200,{'Content-Type':p.endsWith('.png')?'image/png':p.endsWith('.css')?'text/css':'application/javascript'});res.end(fs.readFileSync(p));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port,store={};
  const now=Date.now();
  store['kepler7-save-v3']=JSON.stringify({tutorialSeen:true,newbieWelcomeSeen:true,
    resources:{energie:90000,erz:90000,kristalle:90000,deuterium:60000,antimaterie:1000,forschungspunkte:3000},
    buildings:{solar:8,mine:2,raffinerie:4,synth:3,lager:25,labor:5,habitat:2,werftkern:3},research:{rkampf:1,rkolonisation:1},
    fleet:{ships:3,jaeger:2,cruisers:1,destroyers:0,missions:[]},colonies:{rhea:{buildings:{solar:3,mine:2,lager:4},fleet:{jaeger:1,missions:[]}}},
    discovered:{rhea:true,aion:true,draconis:true},activeBasePlanet:'home',player:{id:'u',name:'graphics-fixture'},
    lastTick:now-60000,lastLoginDate:new Date().toDateString(),lastSeenVersion:(source.match(/const VERSION\s*=\s*['"]([^'"]+)/)||[])[1],...ruhigeUhren()});
  browser=await starteBrowser();
  const ctx=await browser.newContext({viewport:{width:1487,height:1058},serviceWorkers:'block'});
  await ctx.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==origin)return route.abort();
   if(!url.pathname.startsWith('/api/'))return route.continue();
   const p=url.pathname.slice(5),json=(v,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(v)});
   if(p==='me')return json({userId:'u',username:'graphics-fixture',homeSystem:'kepler',homeSlot:0,hasEmail:true,wantsPatchnotes:false});
   if(p.startsWith('storage/')){const k=p.slice(8);if(req.method()==='PUT'||req.method()==='POST'){store[k]=JSON.parse(req.postData()||'{}').value;return json({ok:true,version:1});}return store[k]===undefined?json({},404):json({key:k,value:store[k],version:1});}
   if(p.includes('pending-rewards'))return json({reward:null});
   if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends/.test(p))return json([]);
   return json({});
  });
  await ctx.addInitScript(()=>localStorage.setItem('kepler7_token','local-fixture'));
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.waitForFunction(()=>window.__gfxReview&&__gfxReview.ready(),{timeout:20000});
  // Loading schedules the offline dialog after save(); dismiss the actual dialog before actions.
  await page.locator('#welcomeBackDismissBtn').waitFor({state:'visible'});
  await page.locator('#welcomeBackDismissBtn').click();
  await page.evaluate(()=>{for(const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']){const e=document.getElementById(id);if(e)e.style.display='none';}__gfxReview.show('basis');});
  check('game boots without JavaScript errors',errors.length===0,errors);
  await page.waitForFunction(()=>{const img=document.querySelector('#colonyVisual .gfx-landscape');return img&&img.complete&&img.naturalWidth>0;});
  const surface=await page.evaluate(()=>{
   const root=document.getElementById('game-root'),shell=root?.querySelector('.shell'),hero=root?.querySelector('.hero'),rail=document.getElementById('commandNav'),frame=document.getElementById('kanzelrahmen'),scene=document.querySelector('#colonyVisual .gfx-scene'),img=scene?.querySelector('.gfx-landscape');
   if(!root||!shell||!hero||!rail||!frame||!scene||!img)return {ready:false};
   const bounds=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height};};
   const visible=e=>{for(let p=e;p;p=p.parentElement){const cs=getComputedStyle(p);if(cs.display==='none'||cs.visibility!=='visible'||+cs.opacity<=0)return false;}return true;};
   return {ready:document.body.classList.contains('command-ui')&&[root,shell,hero,rail,scene,img].every(visible)&&img.complete&&img.naturalWidth>0&&img.naturalHeight>0,
    viewport:document.documentElement.clientWidth,root:bounds(root),shell:bounds(shell),hero:bounds(hero),rail:bounds(rail),scene:bounds(scene),image:bounds(img),frameHidden:getComputedStyle(frame).display==='none'&&bounds(frame).width===0&&bounds(frame).height===0};
  });
  check('wide desktop command surface stays aligned with the native game column',surface.ready&&surface.frameHidden&&surface.root.width>0&&surface.shell.width>0&&surface.scene.width>0&&surface.scene.height>0&&surface.image.width>0&&surface.image.height>0
   &&Math.abs(surface.root.left-surface.rail.right)<1&&Math.abs(surface.root.right-surface.viewport)<1
   &&Math.abs(surface.shell.left-surface.root.left)<1&&Math.abs(surface.shell.width-surface.root.width)<1
   &&Math.abs(surface.hero.left-surface.root.left)<1&&Math.abs(surface.hero.width-surface.root.width)<1
   &&surface.scene.left>=surface.root.left-1&&surface.scene.right<=surface.root.right+1,surface);
  const stages=await page.evaluate(()=>[__gfxReview.stage({mine:1}),__gfxReview.stage({mine:20,solar:20}),__gfxReview.stage({mine:25,solar:40,lager:40,labor:20}),__gfxReview.stage({mine:1,turm:200})]);
  check('colony art follows economic development, not defense levels',JSON.stringify(stages)===JSON.stringify(['outpost','settlement','developed','outpost']),stages);
  await page.locator('#colonyVisual [data-gfx-building="mine"]').click();
  const before=await page.evaluate(()=>__gfxReview.state().buildings.mine);
  await page.locator('#colonyVisual [data-gfx-build="building"]').click();
  const after=await page.evaluate(()=>__gfxReview.state().buildings.mine);
  check('illustrated building action upgrades the selected actual building',after===before+1,{before,after});
  await page.evaluate(()=>__gfxReview.show('flotte'));
  await page.locator('#shipyardVisual [data-gfx-ship="jaeger"]').click();
  const match=await page.evaluate(()=>{const a=document.querySelector('#shipyardVisual [data-gfx-build]'),b=document.querySelector('#fleet [data-buyship="jaeger"]');return !!a&&!!b&&a.textContent===b.textContent&&a.disabled===b.disabled;});
  check('ship action mirrors the current quantity and eligibility',match);
  await page.locator('#shipyardVisual [data-gfx-build="ship"]').click();
  const queued=await page.evaluate(()=>__gfxReview.state().constructionQueue.filter(j=>j.kind==='ship'&&j.key==='jaeger'&&j.planet==='home').reduce((n,j)=>n+j.qty,0));
  check('illustrated ship action creates exactly one real local build order',queued===1,{queued});
  const identity=await page.evaluate(()=>{const image=document.querySelector('#shipyardVisual .gfx-ship-model');__gfxReview.render();return image===document.querySelector('#shipyardVisual .gfx-ship-model');});
  check('unchanged render retains the large ship image node',identity);
  await page.evaluate(()=>__gfxReview.show('karte'));
  if(await page.locator('#galaxyBackBtn').isVisible())await page.locator('#galaxyBackBtn').click();
  await page.locator('#galaxyBackBtn').waitFor({state:'hidden'});
  assert.equal(await oeffneSektorMitSystem(page,'kepler'),true,'actual sector containing Kepler is open');
  const sectorHeight=await page.locator('#tab-karte .map-wrap').evaluate(el=>el.getBoundingClientRect().height);
  await oeffneSystemUeberSektoren(page,'kepler');await page.evaluate(()=>__gfxReview.map());
  const map=await page.evaluate(()=>{const root=document.getElementById('mapPlanetVisual');return {shown:!root.hidden,art:root.querySelector('img')?.getAttribute('src'),rockArt:document.querySelector('[data-planet="vesna"] [data-gfx-planet]')?.getAttribute('href'),unknown:root.textContent.includes('Nicht erkundet'),height:document.getElementById('graphicsMapLayout').getBoundingClientRect().height};});
  check('known colony gets its correct planet illustration',map.shown&&map.art==='kepler-gfx-planet-ocean.png'&&!map.unknown,map);
  check('asteroid is never replaced by an ocean illustration',!map.rockArt,map);
  check('desktop system overview avoids intrinsic SVG height growth',map.height>300&&map.height<600,map);
  const camera=await page.evaluate(()=>{const r=document.querySelector('#tab-karte .map-wrap').getBoundingClientRect(),v=document.getElementById('galaxyMapSvg').viewBox.baseVal;return {height:r.height,mapRatio:r.height/r.width,cameraRatio:v.height/v.width};});
  check('desktop map height remains stable when a system opens',Math.abs(sectorHeight-camera.height)<=2,{sectorHeight,...camera});
  check('initial system camera matches the actual map aspect ratio',Math.abs(camera.mapRatio-camera.cameraRatio)<0.01,camera);
  // Dismiss the actual first-use hint and finish the browser's native scroll before opening
  // a menu that intentionally closes on window scroll. Keep the real pointer action and guards.
  const mapHint=page.locator('#tabHintBar [data-tab-hint-dismiss="karte"]');
  if(await mapHint.isVisible()){await mapHint.click();await page.locator('#tabHintBar').waitFor({state:'hidden'});}
  const planetAction=page.locator('#mapPlanetVisual [data-gfx-planet-menu]');
  // Viewport-only scrolling can leave a tall inspector behind the fixed bottom status bar.
  await planetAction.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  // Native focus can also scroll horizontally when the controlled shell offset overflows.
  // Finish that real focus scroll before the pointer opens a menu that closes on any page scroll.
  await planetAction.focus();
  // Use the same browser scroll preparation as locator.click() before measuring stability.
  await planetAction.scrollIntoViewIfNeeded();
  await planetAction.evaluate(e=>new Promise((resolve,reject)=>{
   let previous,stable=0;const start=performance.now();
   const frame=()=>{const r=e.getBoundingClientRect(),pose=[scrollX,scrollY,r.x,r.y,r.width,r.height];
    stable=previous&&pose.every((v,i)=>v===previous[i])?stable+1:0;previous=pose;
    if(stable>=4)return resolve();if(performance.now()-start>5000)return reject(Error('Native planet action never reaches stable scroll geometry'));requestAnimationFrame(frame);
   };requestAnimationFrame(frame);
  }));
  const planetHit=await planetAction.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {hit:hit===e||e.contains(hit),point:[r.x+r.width/2,r.y+r.height/2],target:hit?.outerHTML.slice(0,350)};});
  assert.equal(planetHit.hit,true,'actual planet inspector action is the native pointer hit: '+JSON.stringify(planetHit));
  await planetAction.click();
  check('planet inspector opens the existing actions menu',await page.locator('.kmenu').isVisible());
  // Read the actual menu/scroll/focus state without changing the native Escape handler.
  // The clipped centre matches fensterLage(), including menus partly outside the viewport.
  const escapeWitness=()=>page.evaluate(()=>{
   const menus=[...document.querySelectorAll('.kmenu')],menu=menus[0],system=document.getElementById('mapPlanetVisual');
   const describe=element=>element?{tag:element.tagName,id:element.id,class:String(element.className),html:element.outerHTML.slice(0,350)}:null;
   const rect=element=>element?element.getBoundingClientRect().toJSON():null;
   const menuRect=rect(menu),systemRect=rect(system);
   let centre=null,hit=null;
   if(menuRect){
    const left=Math.max(menuRect.left,0),top=Math.max(menuRect.top,0),right=Math.min(menuRect.right,innerWidth),bottom=Math.min(menuRect.bottom,innerHeight);
    if(right>left&&bottom>top){centre=[(left+right)/2,(top+bottom)/2];hit=document.elementFromPoint(...centre);}
   }
   return {menuCount:menus.length,systemVisible:!!systemRect&&systemRect.width>0&&systemRect.height>0&&getComputedStyle(system).visibility==='visible',
    menuRect,systemRect,centre,centerHit:describe(hit),centerBelongsToMenu:!!menu&&!!hit&&(hit===menu||menu.contains(hit)),
    scroll:{x:scrollX,y:scrollY},focus:describe(document.activeElement),viewBox:document.getElementById('galaxyMapSvg')?.getAttribute('viewBox')};
  });
  const escapeBefore=await escapeWitness();
  await page.keyboard.press('Escape');
  const escapeAfter=await escapeWitness(),escapeTrace={before:escapeBefore,after:escapeAfter};
  console.log('MEASURE - native map-menu Escape '+JSON.stringify(escapeTrace));
  check('escape closes only the actions menu and retains the system',await page.locator('.kmenu').count()===0&&await page.locator('#mapPlanetVisual').isVisible(),escapeTrace);
  // Recover after a failed navigation check so controlled faults cannot hide later checks.
  if(!await page.locator('#mapPlanetVisual').isVisible()){await oeffneSystemUeberSektoren(page,'kepler');await page.evaluate(()=>__gfxReview.map());}
  await page.locator('#mapPlanetVisual [data-gfx-colony="rhea"]').click();
  check('open colony changes the actual base and basis tab',await page.evaluate(()=>__gfxReview.state().activeBasePlanet==='rhea'&&document.getElementById('tab-basis').classList.contains('active')));
  for(const tab of ['basis','flotte','karte']){
   await page.setViewportSize({width:390,height:844});await page.evaluate(t=>__gfxReview.show(t),tab);
   if(tab==='karte'){await oeffneSystemUeberSektoren(page,'kepler');await page.evaluate(()=>__gfxReview.map());}
   const selector=tab==='basis'?'#colonyVisual':tab==='flotte'?'#shipyardVisual':'#mapPlanetVisual';
   const fit=await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+1;});
   check(tab+' graphic view fits a 390px viewport',fit);
   if(tab==='basis'){
    // Translation at large viewport coordinates can subtract Float32 edges to 43.999939
    // for a native 44px layout box. Normalize only the target-height witness to Blink's
    // 1/64 CSS-pixel layout resolution; retain the original DOMRect overlap geometry.
    const spots=await page.locator('#colonyVisual .gfx-hotspot').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,targetH:Math.round(r.height*64)/64};}));
    check('mobile building controls have 44px targets without overlaps',spots.length===4&&spots.every(a=>a.targetH>=44)&&spots.every((a,i)=>spots.slice(i+1).every(b=>a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y)),spots);
   }
  }
  const assets=['colony-outpost','colony-settlement','colony-developed','ship-jaeger','ship-cruisers','ship-destroyers','planet-ocean','planet-crystal','planet-gas','orbital-dock','nebula'];
  check('all required local image assets exist and are nonempty',assets.every(a=>{const p=path.join(WURZEL,'kepler-gfx-'+a+'.png');return fs.existsSync(p)&&fs.statSync(p).size>1000;}));
  const saved=JSON.parse(store['kepler7-save-v3']);saved.lastTick=Date.now()-60000;store['kepler7-save-v3']=JSON.stringify(saved);
  await page.goto(origin+'/?lang=en');await page.waitForFunction(()=>window.__gfxReview&&__gfxReview.ready());
  await page.evaluate(()=>__gfxReview.show('flotte'));
  const labels=await page.locator('#shipyardVisual .sstat .k').allTextContents();
  const english=await page.locator('#shipyardVisual').textContent();
  check('English graphics use translated stats, counts and roles',JSON.stringify(labels)===JSON.stringify(['Attack','Shield','Defense','Speed'])&&english.includes('Available')&&!/Bestand|Großkampf|Abfangjäger/.test(english),{labels,english});
  check('interactions produce no JavaScript errors',errors.length===0,errors);
 }catch(e){failed++;console.error(e.stack);}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
 console.log('\n'+checks+' checks, '+failed+' failures');process.exitCode=failed?1:0;
})();
