'use strict';
// Actual game/assets over HTTP. The API and all mutations belong to this local fixture.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {SPIELDATEI,WURZEL,starteBrowser,ruhigeUhren}=require('./lib/umgebung');
const source=fs.readFileSync(SPIELDATEI,'utf8'),css=fs.readFileSync(path.join(WURZEL,'kepler-graphics.css'),'utf8');
const end='\n})();\n</script>\n</body>';
assert.equal(source.split(end).length,2,'unique native fixture export anchor');
const html=source.replace(end,'\nwindow.__harmony={ready:()=>bootDataReady,state:()=>state,show:switchTab,render};\n'+end);
const fault=process.env.K7_HARMONY_FAULT||'',probe=process.env.K7_HARMONY_PROBE||'';
const faults={
  surface:'.gfx-inspector{background:#040404!important}',
  focus:'#game-root #buildings [data-build="mine"]:focus-visible{box-shadow:none!important;animation:none!important}',
  // Repeated IDs deliberately outweigh the production focus guard, including its replay exclusion.
  dialog:'#fwahlOverlay#fwahlOverlay [data-fwahl-zu]:focus-visible{box-shadow:none!important}',
  font:'#fwahlOverlay .fwahl-titel{font-family:serif!important}',
  warning:'#game-root#game-root .tab-btn-alert:focus-visible{box-shadow:none!important}',
  subtab:'#game-root#game-root #fleetSubtabs .fleet-subtab:focus-visible{transition:box-shadow 10s!important}',
  theme:'#game-root #themePicker [data-theme-key="ocean"]:focus-visible{box-shadow:0 0 0 2px #fff!important}',
  mobile:'@media(max-width:400px){#tab-sammlung.active{min-width:700px!important}}',
  hover:'#tab-einstellungen .jumpnav a:hover{background:#19223a!important;color:#b8bfd4!important}'
};
assert(!fault||Object.hasOwn(faults,fault),'known controlled CSS fault');
let checks=0,failed=0;
function check(name,ok,data){checks++;if(!ok)failed++;console.log((ok?'OK':'FAIL')+' - '+name+(!ok&&data?' '+JSON.stringify(data):''));}
const tabs=['basis','verteidigung','forschung','flotte','expedition','karte','galaxie','allianz','offiziere','markt','punkte','fortschritt','sammlung','berichte','hilfe','einstellungen'];
(async()=>{
  let server,browser;
  try {
    server=http.createServer((req,res)=>{
      const pathname=new URL(req.url,'http://fixture').pathname;
      if(pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html);}
      if(pathname==='/kepler-graphics.css'){res.writeHead(200,{'Content-Type':'text/css'});return res.end(css+'\n:root{--harmony-fixture-loaded:yes;--harmony-fixture-fault:'+ (fault||'none')+';}\n'+(faults[fault]||''));}
      const p=path.resolve(WURZEL,pathname.slice(1));
      if(!p.startsWith(WURZEL+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}
      res.writeHead(200,{'Content-Type':p.endsWith('.png')?'image/png':p.endsWith('.css')?'text/css':'application/javascript'});res.end(fs.readFileSync(p));
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const origin='http://127.0.0.1:'+server.address().port,store={};
    store['kepler7-save-v3']=JSON.stringify({tutorialSeen:true,newbieWelcomeSeen:true,powerSave:false,headerCompact:true,uiJumpNav:true,
      commandPoints:1000,credits:12345,resources:{energie:90000,erz:90000,kristalle:90000,deuterium:60000,antimaterie:1000,forschungspunkte:3000},
      buildings:{solar:8,mine:2,raffinerie:4,synth:3,lager:25,labor:5,habitat:2,werftkern:3},research:{rkampf:1,rkolonisation:1},
      fleet:{ships:3,jaeger:2,cruisers:1,destroyers:0,forscher:2,missions:[]},discovered:{rhea:true,aion:true,draconis:true},activeBasePlanet:'home',
      player:{id:'u',name:'harmony-fixture'},lastTick:Date.now()-60000,lastLoginDate:new Date().toDateString(),
      lastSeenVersion:(source.match(/const VERSION\s*=\s*['"]([^'"]+)/)||[])[1],...ruhigeUhren()});
    browser=await starteBrowser();
    const ctx=await browser.newContext({viewport:{width:1487,height:1058},serviceWorkers:'block'});
    await ctx.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.origin!==origin)return route.abort();
      if(!url.pathname.startsWith('/api/'))return route.continue();
      const p=url.pathname.slice(5),json=(v,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(v)});
      if(p==='me')return json({userId:'u',username:'harmony-fixture',homeSystem:'kepler',homeSlot:0,hasEmail:true,wantsPatchnotes:false});
      if(p.startsWith('storage/')){const k=p.slice(8);if(req.method()==='PUT'||req.method()==='POST'){store[k]=JSON.parse(req.postData()||'{}').value;return json({ok:true,version:1});}return store[k]===undefined?json({},404):json({key:k,value:store[k],version:1});}
      if(p.includes('pending-rewards'))return json({reward:null});
      if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends/.test(p))return json([]);
      return json({});
    });
    await ctx.addInitScript(()=>localStorage.setItem('kepler7_token','local-harmony-fixture'));
    const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin);await page.waitForFunction(()=>window.__harmony&&__harmony.ready(),{timeout:20000});
    await page.locator('#welcomeBackDismissBtn').waitFor({state:'visible'});await page.locator('#welcomeBackDismissBtn').click();
    await page.evaluate(()=>{for(const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']){const e=document.getElementById(id);if(e)e.style.display='none';}});
    check('actual stylesheet and controlled probe response arrived',await page.evaluate(f=>{
      const s=getComputedStyle(document.documentElement);return s.getPropertyValue('--harmony-fixture-loaded').trim()==='yes'&&s.getPropertyValue('--harmony-fixture-fault').trim()===(f||'none');
    },fault));
    const headerTabs={berichte:'#headerReportsBtn',hilfe:'#headerHelpBtn',einstellungen:'#headerProfileBtn'};
    const show=async tab=>{await page.locator(headerTabs[tab]||'.tab-btn[data-tab="'+tab+'"]').click();await page.locator('#tab-'+tab+'.active').waitFor({state:'visible'});};
    const focus=async (selector,settle=400)=>{
      const el=page.locator(selector).first();await el.evaluate(e=>e.blur());
      await el.press('Tab');await page.keyboard.press('Shift+Tab');if(settle)await page.waitForTimeout(settle);
      return el.evaluate(e=>{const s=getComputedStyle(e),rgb=getComputedStyle(document.documentElement).getPropertyValue('--gfx-focus').trim();
        const color=document.createElement('span');color.style.color=rgb;document.body.appendChild(color);const normalized=getComputedStyle(color).color;color.remove();
        return {focused:document.activeElement===e&&e.matches(':focus-visible'),shadow:s.boxShadow,ring:s.boxShadow.includes('inset')&&s.boxShadow.includes(normalized),animation:s.animationName,transition:s.transitionDuration};});
    };
    if(!probe||probe==='surface'){
      await show('basis');
      const oldSurface=await page.evaluate(()=>{
        const root=document.documentElement,old=root.style.getPropertyValue('--gfx-panel');root.style.setProperty('--gfx-panel','rgb(21, 40, 53)');return old;
      });
      // Native card backgrounds transition for 150 ms; measure the settled surface.
      await page.waitForTimeout(250);
      const surfaces=await page.evaluate(old=>{
        const root=document.documentElement;
        const native=getComputedStyle(document.querySelector('#buildings [data-build="mine"]').closest('.card-row')).backgroundColor,gfx=getComputedStyle(document.querySelector('#colonyVisual .gfx-inspector')).backgroundColor;
        if(old)root.style.setProperty('--gfx-panel',old);else root.style.removeProperty('--gfx-panel');return {native,gfx};
      },oldSurface);
      check('native and illustrated panels follow the same surface token',surfaces.native==='rgb(21, 40, 53)'&&surfaces.gfx===surfaces.native,surfaces);
    }
    if(!probe||probe==='focus'){
      await show('basis');
      const native=await focus('#buildings [data-build="mine"]');
      check('affordable native order retains a stable inset keyboard ring',native.focused&&native.ring&&native.animation==='none',native);
      if(!probe){
        const illustrated=await focus('#colonyVisual [data-gfx-building="mine"]');check('illustrated selection shares the inset keyboard ring',illustrated.focused&&illustrated.ring,illustrated);
      }
    }
    if(!probe||probe==='dialog'||probe==='font'){
      await show('galaxie');await page.locator('#npcList [data-attack]').first().click();await page.locator('#fwahlOverlay.open').waitFor({state:'visible'});
      const dialog=await focus('#fwahlOverlay [data-fwahl-zu]');check('body-mounted fleet dialog keeps its visible keyboard ring',dialog.focused&&dialog.ring,dialog);
      const fonts=await page.evaluate(()=>({dialog:getComputedStyle(document.querySelector('#fwahlOverlay .fwahl-titel')).fontFamily,illustrated:getComputedStyle(document.querySelector('#colonyVisual .gfx-heading h2')).fontFamily}));
      check('body-mounted dialog heading uses the illustrated heading font',fonts.dialog===fonts.illustrated,fonts);
      await page.locator('#fwahlOverlay [data-fwahl-zu]').click();
    }
    if(!probe||probe==='warning'){
      // raidPulse animates box-shadow even in power-save mode. It must not win over keyboard focus.
      await show('basis');await page.locator('.tab-btn[data-tab="basis"]').evaluate(e=>e.classList.add('tab-btn-alert'));
      const warning=await focus('.tab-btn[data-tab="basis"]');check('animated warning tab retains a stable keyboard ring',warning.focused&&warning.ring,warning);
      await page.locator('.tab-btn[data-tab="basis"]').evaluate(e=>e.classList.remove('tab-btn-alert'));
    }
    if(!probe||probe==='subtab'){
      await show('flotte');
      const subtab=await focus('#fleetSubtabs [data-fleet-subtab]',0);
      check('subtab keyboard ring appears immediately without a shadow transition',subtab.focused&&subtab.ring&&subtab.transition==='0s',subtab);
    }
    if(!probe||probe==='hover'){
      await page.evaluate(()=>__harmony.show('einstellungen'));
      const link=page.locator('#tab-einstellungen .jumpnav a').first();await page.mouse.move(0,0);await link.evaluate(e=>e.blur());
      const before=await link.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));
      await link.hover();const after=await link.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));
      check('settings jump links retain their hover feedback',before.bg!==after.bg&&before.color!==after.color,{before,after});
    }
    if(!probe||probe==='theme'){
      await page.evaluate(()=>__harmony.show('einstellungen'));
      await page.locator('#themePicker [data-theme-key="ocean"]').click();
      check('native theme selection remains effective and persisted',await page.evaluate(()=>__harmony.state().themeKey==='ocean'&&getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim().toLowerCase()==='#378add'));
      const theme=await focus('#themePicker [data-theme-key="ocean"]');check('selected theme inline shadow cannot hide keyboard focus',theme.focused&&theme.ring,theme);
    }
    if(!probe||probe==='mobile'){
      for(const width of (probe?[390]:[320,390,756,1487])){
        await page.setViewportSize({width,height:844});
        for(const tab of (probe?['sammlung']:tabs)){
          await show(tab);
          const fit=await page.locator('#tab-'+tab).evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,documentWidth:document.documentElement.scrollWidth};});
          check('main panel fits '+width+'px '+tab,fit.left>=-1&&fit.right<=fit.width+1&&fit.documentWidth<=fit.width+1,fit);
        }
      }
      if(!probe){
        await show('sammlung');
        const catalogue=await page.locator('#sammlungBox > .card-row[style*="opacity:0.55"]').first().evaluate(e=>({opacity:getComputedStyle(e).opacity,text:e.innerText}));
        check('unowned catalogue remains readable with an explicit possession badge',catalogue.opacity==='1'&&catalogue.text.includes('noch nicht'),catalogue);
        await page.locator('#sammlungBox [data-sammlung-besitz]').click();
        check('native possession filter still changes the catalogue',await page.locator('#sammlungBox > .card-row[style*="opacity:0.55"]').count()===0);
      }
    }
    check('native game interaction completes without script errors',errors.length===0,errors);
  }catch(e){check('harmony review completes',false,{message:e.message});}
  finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));}
  console.log(checks+' harmony checks, '+failed+' failed');process.exitCode=failed?1:0;
})();
