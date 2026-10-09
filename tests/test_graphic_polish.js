'use strict';
// Actual HTTP game, native definitions and isolated API: regressions from the graphics audit.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {SPIELDATEI,WURZEL,starteBrowser,ruhigeUhren}=require('./lib/umgebung');
let source=fs.readFileSync(SPIELDATEI,'utf8');
const fault=process.env.K7_POLISH_FAULT;
if(fault==='icons')source=source.replace("if (g.art === 'standortmodul' || g.art === 'schiffsmodul') return moduleIconHtml","if (false) return moduleIconHtml");
if(fault==='emphasis')source=source.replace('sammlungBeschreibungHtml(k7View(g).desc)','escapeHtml(k7View(g).desc)');
if(fault==='enemies')source=source.replace('const i=GFX_ENEMY_KEYS.indexOf(n.id);','const i=0;');
if(fault==='defense-activity')source=source.replace("const nativeKind=kind==='defense'?'building':kind;",'const nativeKind=kind;');
if(fault==='history-clear')source=source.replace("setBoxHtml(document.getElementById('scoreHistorySvgMeta'),'scoreHistorySvgMeta','');",'').replace("setBoxHtml(document.getElementById(svgId+'Meta'),svgId+'Meta','');",'');
const end='\n})();\n</script>\n</body>';
assert.equal(source.split(end).length-1,1,'verified game export anchor');
const html=source.replace(end,`\nwindow.__gfxReview={collection:renderSammlung,rich:sammlungBeschreibungHtml,portrait:gfxEnemyPortrait,npcDefs:()=>NPCS,activity:gfxActivityHtml,trophies:k7ProfileTrophies,ready:()=>bootDataReady,state:()=>state,show:s=>switchTab(s),render,
  stage:b=>gfxColonyStage(b),selectBuilding:k=>{gfxBuilding=k;renderGraphicsColony();},
  selectShip:k=>{gfxShip=k;renderGraphicsShipyard();},map:renderGraphicsMap,
  selectDefense:k=>{gfxDefense=k;renderGraphicsDefense();},selectResearch:k=>{gfxResearch=k;renderGraphicsResearch();},
  expeditionType:()=>selectedExpeditionType,officers:OFFICERS.map(o=>o.key),shipKeys:SHIP_DEFS.map(d=>d.key),planetArt:GFX_PLANET_ART,facilityDefs:()=>BUILDING_DEFS.map(d=>({key:d.key,name:k7View(d).name,category:d.category})),levels:()=>currentBuildings()};\n`+end);
let checks=0,failed=0;
const check=(name,ok,data)=>{checks++;if(!ok)failed++;console.log((ok?'OK':'FAIL')+' - '+name+(ok||!data?'':' '+JSON.stringify(data)));};
(async()=>{
 let server,browser;
 try {
  server=http.createServer((req,res)=>{
   if(req.url.split('?')[0]==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html);}
   const p=path.resolve(WURZEL,req.url.split('?')[0].slice(1));
   if(!p.startsWith(WURZEL+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}
   const faults={navigation:'\n#game-root .tabs .tab-btn{font-size:8.5px!important}',readability:'\n#sammlungBox#sammlungBox .gfx-collection-item[data-item-owned="false"]{opacity:.55!important}',trophies:'\n.gfx-trophy-hall{display:block!important}'};
   res.writeHead(200,{'Content-Type':p.endsWith('.png')?'image/png':p.endsWith('.css')?'text/css':'application/javascript'});res.end(p.endsWith('.css')&&faults[fault]?fs.readFileSync(p,'utf8')+faults[fault]:fs.readFileSync(p));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port,store={};
  const now=Date.now();
  store['kepler7-save-v3']=JSON.stringify({tutorialSeen:true,newbieWelcomeSeen:true,
    commandPoints:1000,credits:12345,resources:{energie:90000,erz:90000,kristalle:90000,deuterium:60000,antimaterie:1000,forschungspunkte:3000},
    buildings:{solar:8,mine:2,raffinerie:4,synth:3,lager:25,labor:5,habitat:2,werftkern:3},research:{rkampf:1,rkolonisation:1},
    fleet:{ships:3,jaeger:2,cruisers:1,destroyers:0,forscher:2,missions:[]},colonies:{rhea:{buildings:{solar:3,mine:2,lager:4},fleet:{jaeger:1,missions:[]}}},
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
  await page.evaluate(()=>__gfxReview.show('sammlung'));
  const collection=await page.locator('#sammlungBox').evaluate(box=>({raw:/<(?:strong|em)>/.test(box.textContent),icons:[...box.querySelectorAll('.gfx-collection-item')].filter(r=>/Siegesschmiede|Kampfrausch|Siegesschirm/.test(r.textContent)).map(r=>!!r.querySelector('.bicon svg')),emphasis:box.querySelectorAll('.gfx-collection-item strong,.gfx-collection-item em').length}));
  check('collection renders native emphasis without literal HTML',!collection.raw&&collection.emphasis>0,collection);
  check('collection restores all three audited module icons',collection.icons.length===3&&collection.icons.every(Boolean),collection);
  const unowned=page.locator('#sammlungBox .gfx-collection-item[data-item-owned="false"]').filter({hasText:'Siegesschmiede'});
  await unowned.hover();
  const readable=await unowned.evaluate(r=>({opacity:getComputedStyle(r).opacity,meta:[...r.querySelectorAll('.bmeta')].map(e=>getComputedStyle(e).opacity)}));
  check('collection unowned text remains readable after native pointer feedback',readable.opacity==='1'&&readable.meta.every(o=>o==='1'),readable);
  const materials=await page.locator('#sammlungBox [data-gfx-material]').evaluateAll(els=>els.map(e=>({key:e.dataset.gfxMaterial,style:e.getAttribute('style')})));
  check('all six rare materials use distinct native-keyed item illustrations',materials.length===6&&new Set(materials.map(m=>m.key)).size===6&&new Set(materials.map(m=>m.style)).size===6,materials);
  check('collection permits emphasis but escapes attributes and executable markup',await page.evaluate(()=>{const v=__gfxReview.rich('<strong>Wert</strong><em>Text</em><img src=x onerror="alert(1)"><strong onclick="x">Bad</strong>');return v.includes('<strong>Wert</strong>')&&v.includes('<em>Text</em>')&&!/<img|onclick="|onerror="/.test(v)&&v.includes('&lt;img');}));
  for(const [tab,id,kind] of [['basis','colonyVisual','building'],['verteidigung','defenseVisual','defense']]){
    await page.evaluate(t=>__gfxReview.show(t),tab);
    const catalogue=await page.locator('#'+id).evaluate((box,kind)=>{const groups=[...box.querySelectorAll('.gfx-facility-group')],keys=[...box.querySelectorAll('[data-gfx-facility]')].map(b=>b.dataset.gfxKey),defs=__gfxReview.facilityDefs().filter(d=>kind==='defense'?d.category==='defense':d.category!=='defense');return {groups:groups.length,complete:keys.length===defs.length&&new Set(keys).size===keys.length&&defs.every(d=>keys.includes(d.key)),named:groups.every(g=>g.querySelector('h4').textContent.length>0&&g.querySelector('button'))};},kind);
    check(kind+' visible groups contain every native facility exactly once',catalogue.groups>=3&&catalogue.complete&&catalogue.named,catalogue);
  }
  const portraits=await page.evaluate(()=>__gfxReview.npcDefs().map(n=>{const el=document.createElement('div');el.innerHTML=__gfxReview.portrait(n);const p=el.querySelector('[data-gfx-enemy]');return {key:n.id,actual:p&&p.dataset.gfxEnemy,style:p&&p.getAttribute('style')};}));
  check('each native NPC has its own identity-keyed fleet illustration',portraits.length===26&&portraits.every(p=>p.actual===p.key)&&new Set(portraits.map(p=>p.style)).size===portraits.length,portraits);
  const atlas=await page.evaluate(()=>new Promise(r=>{const i=new Image();i.onload=()=>r({w:i.naturalWidth,h:i.naturalHeight});i.onerror=()=>r({w:0,h:0});i.src='kepler-gfx-enemy-atlas.png';}));
  check('enemy atlas loads with the six by five tile proportions',atlas.w>600&&Math.abs(atlas.w/atlas.h-6/5)<.01,atlas);
  await page.evaluate(()=>{const t=Date.now()-3600000;__gfxReview.state().scoreHistory=[{ts:t,score:100,credits:400,prodErz:2},{ts:t+900000,score:120,credits:600,prodErz:3},{ts:t+3600000,score:200,credits:800,prodErz:5}];__gfxReview.show('punkte');__gfxReview.render();});
  for(const id of ['scoreHistorySvg','creditsHistorySvg','prodHistorySvg']){
    const chart=await page.locator('#'+id).evaluate(svg=>{const meta=document.getElementById(svg.id+'Meta'),p=[...svg.querySelectorAll('circle')];return {times:meta.querySelectorAll('.gfx-chart-times span').length,rows:meta.querySelectorAll('tbody tr').length,label:svg.getAttribute('aria-label'),fraction:p.length===3?(Number(p[1].getAttribute('cx'))-Number(p[0].getAttribute('cx')))/(Number(p[2].getAttribute('cx'))-Number(p[0].getAttribute('cx'))):0,titles:p.every(p=>p.querySelector('title').textContent.includes(' · '))};});
    check(id+' shows real times, values and proportionate snapshot spacing',chart.times===2&&chart.rows===3&&chart.label&&chart.titles&&Math.abs(chart.fraction-.25)<.001,chart);
  }
  await page.evaluate(()=>{__gfxReview.state().scoreHistory=[];__gfxReview.render();});
  check('empty history clears former chart times and values',await page.locator('.gfx-chart-meta').evaluateAll(els=>els.every(e=>!e.textContent.trim())));
  const activity=await page.evaluate(()=>{const s=__gfxReview.state();s.constructionQueue=[{kind:'building',key:'solar',planet:'home',startTime:1},{kind:'building',key:'mine',planet:'rhea',startTime:1},{kind:'ship',key:'jaeger',planet:'home',startTime:null}];s.activeResearch={key:'rsolar',endTime:Date.now()+60000};return {running:__gfxReview.activity('building','solar'),foreign:__gfxReview.activity('building','mine'),waiting:__gfxReview.activity('ship','jaeger'),research:__gfxReview.activity('research','rsolar')};});
  check('activity distinguishes running, queued and foreign-site orders',activity.running.includes('Aktiver Auftrag')&&activity.foreign===''&&activity.waiting.includes('In der Warteschlange')&&activity.research.includes('Aktiver Auftrag'),activity);
  const defenseActivity=await page.evaluate(()=>{__gfxReview.state().constructionQueue.push({kind:'building',key:'plasma',planet:'home',startTime:1});return __gfxReview.activity('defense','plasma');});
  check('defense activity reads native building jobs',defenseActivity.includes('Aktiver Auftrag')&&defenseActivity.includes('Plasma'),defenseActivity);
  await page.evaluate(()=>{__gfxReview.state().constructionQueue=[];__gfxReview.state().activeResearch=null;__gfxReview.show('fortschritt');});
  const trophies=await page.locator('.gfx-trophy-hall').evaluateAll(halls=>halls.map(h=>({cases:h.querySelectorAll('.gfx-trophy-case').length,plinths:h.querySelectorAll('.gfx-trophy-plinth').length})));
  check('profile displays three actual trophy cases with distinct empty state',trophies.length>0&&trophies.every(h=>h.cases===3&&h.plinths===3),trophies);
  const trophyLayout=await page.locator('.gfx-trophy-hall').evaluateAll(halls=>halls.every(h=>getComputedStyle(h).display==='grid'&&[...h.children].every(c=>c.getBoundingClientRect().width<h.getBoundingClientRect().width/2)));
  check('desktop trophy cases occupy three real columns',trophyLayout);
  for(const width of [320,390,756,1280]){
    await page.setViewportSize({width,height:844});await page.evaluate(()=>__gfxReview.show('basis'));
    if(await page.locator('#commandMenuToggle').isVisible())await page.locator('#commandMenuToggle').click();
    const nav=await page.locator('.tabs').evaluate(nav=>({height:document.querySelector('.hero').getBoundingClientRect().height,font:Math.min(...[...nav.querySelectorAll('.tab-btn')].map(b=>parseFloat(getComputedStyle(b).fontSize))),targets:[...nav.querySelectorAll('.tab-btn')].every(b=>{const r=b.getBoundingClientRect();return r.width>=43.99&&r.height>=43.99;}),page:document.documentElement.scrollWidth<=innerWidth}));
    check('compact navigation remains legible and saves vertical space at '+width+'px',nav.font>=12&&nav.height<85&&nav.targets&&nav.page,nav);
    await page.locator('.tabs .tab-btn[data-tab="sammlung"]').press('Enter');
    check('last navigation area stays keyboard reachable at '+width+'px',await page.locator('.tabs .tab-btn[data-tab="sammlung"]').evaluate(b=>{const r=b.getBoundingClientRect(),n=b.closest('.tabs').getBoundingClientRect();return b.classList.contains('active')&&r.left>=n.left-1&&r.right<=n.right+1&&document.querySelector('#tab-sammlung').classList.contains('active');}));
  }
  check('graphic improvements produce no JavaScript errors',errors.length===0,errors);
 }catch(e){failed++;console.error(e.stack);}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
 console.log('\n'+checks+' checks, '+failed+' failures');process.exitCode=failed?1:0;
})();
