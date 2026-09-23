#!/usr/bin/env node
'use strict';
// Real-browser localization checks against an isolated, mocked loopback origin. No live accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SPIELDATEI } = require('./lib/spieldatei');
const source = fs.readFileSync(SPIELDATEI, 'utf8');
assert.ok(source.includes('/* K7_ENGLISH_RUNTIME_BEGIN */'), 'English runtime is missing (the original-source counterexample must fail here).');
const { starteBrowser } = require('./lib/umgebung');
const ORIGIN = 'http://127.0.0.1:41837';
const screenDir = process.env.K7_SCREENSHOT_DIR;
if (screenDir) fs.mkdirSync(screenDir, {recursive:true});
const version = (source.match(/const VERSION = '([^']+)'/) || [,''])[1];
const GERMAN_SURFACE_PROBES = [
  'English preview',
  'Benötigt Minentechnik',
  'Gebäudestufen gelten',
  'Verteidigungsgebäude schützen',
  'Keine Schiffe im Bau',
  'Keine Forschung läuft',
  'Allianzen teilen Forschung',
  'Dein Punktestand',
  'Erfolge, Fähigkeitsbaum',
  'Noch keine Einträge.',
  'Mehr dazu',
  'Verstanden'
];
function savedGame() {
  const now=Date.now();
  return {tutorialSeen:true,newbieWelcomeSeen:true,
    resources:{energie:48000,erz:52000,kristalle:31000,deuterium:20000,antimaterie:900,forschungspunkte:2200},
    buildings:{solar:18,mine:17,kristallmine:15,deutsynth:12,labor:10,lager:12,werft:9,hangar:6,habitat:8,geschuetz:8,schild:6},
    research:{rsolar:8,rerz:8,rkampf:6,rkampf2:4,rschildmatrix:5,rbauplan:5,rmodultechnik:3},
    activeResearch:{key:'rkristall',endsAt:now+600000},
    constructionQueue:[{kind:'building',key:'mine',planet:'home',qty:1,label:'Erzmine',icon:'ti-pick',cost:{erz:200,energie:120},totalDur:300,paid:true,startTime:now,endTime:now+300000}],
    fleet:{jaeger:320,bomber:90,zerstoerer:45,schlachtschiff:28,waechter:60,traeger:12,missions:[{type:'expedition',planet:'home',endsAt:now+900000,fleet:{jaeger:20}}]},
    colonies:{},activeBasePlanet:'home',player:{id:'u',name:'Energie',allianceTag:'TEST',avatarKey:'crown'},
    battleStats:{wins:42,losses:7},expeditionsCompleted:18,ascension:{count:3,essence:0,tree:{}},
    achievements:{a1:true,a2:true},xp:52000,credits:184000,prestige:4,buffs:[],lastTick:now,
    officers:{admiral:6,ingenieur:5},commandPoints:12,colonyNames:{},colonyNotes:{},shipSkin:'gold'};
}
async function makePage(browser, {language='de',authenticated=false,mobile=false}={}) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1365,height:1000},serviceWorkers:'block'});
  const store={'kepler7-save-v3':JSON.stringify(savedGame())};
  const errors=[];
  await context.route('**/*', async route => {
    const req=route.request(), url=new URL(req.url());
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if (url.origin!==ORIGIN) return route.fulfill({status:204,body:''});
    if (url.pathname.startsWith('/api/')) {
      const p=url.pathname.slice(5);
      if(p==='health')return json({ok:true});
      if(p==='me')return authenticated?json({userId:'u',username:'Energie',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true}):json({error:'Not authenticated'},401);
      if(p.startsWith('storage/')){
        const key=decodeURIComponent(p.slice(8));
        if(req.method()==='PUT'){try{store[key]=JSON.parse(req.postData()||'{}').value;}catch(_){}return json({ok:true});}
        return store[key]!==undefined?json({key,value:store[key],version:1}):json({error:'Not found'},404);
      }
      if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))return json(p.includes('pending')?{reward:null}:[]);
      return json({});
    }
    if(url.pathname==='/' || url.pathname==='/weltraum_kolonie.html')return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:source});
    if(url.pathname==='/version.txt')return route.fulfill({status:200,contentType:'text/plain',body:version+'\n'});
    if(url.pathname==='/manifest.json')return json({name:'Kepler-7',start_url:'/',display:'standalone',icons:[]});
    return route.fulfill({status:204,body:''});
  });
  await context.addInitScript(({authenticated})=>{if(authenticated)localStorage.setItem('kepler7_token','tok');},{authenticated});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(ORIGIN+'/?lang='+language);
  await page.waitForSelector('[data-k7-language]',{state:'attached'});
  await page.waitForTimeout(authenticated?2000:250);
  return {page,context,errors,store};
}
(async()=>{
  const browser=await starteBrowser();
  try {
    const anonymous=await makePage(browser,{language:'en'});
    const {page}=anonymous;
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    assert.match(await page.title(), /Kepler-7 Colony/);
    assert.match(await page.locator('.ll-h1').innerText(), /galaxy/i);
    await page.locator('.ll-actions [data-ll-open="login"]').click();
    assert.equal(await page.locator('#loginUsername').getAttribute('placeholder'),'Commander name');
    assert.match(await page.locator('#loginSubmitBtn').innerText(),/Log in|Sign in/i);
    assert.equal(anonymous.errors.length,0,anonymous.errors.join('\n'));
    if(screenDir)await page.screenshot({path:path.join(screenDir,'english-login.png')});
    await page.evaluate(()=>{const node=document.createElement('p');node.id='user-content-probe';node.textContent='Energie Bauen Kolonie gründen';document.body.append(node);});
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#user-content-probe').innerText(),'Energie Bauen Kolonie gründen');
    await page.evaluate(()=>{const s=document.querySelector('[data-k7-language]');s.value='de';s.dispatchEvent(new Event('change'));});
    await page.waitForURL(url=>url.searchParams.get('lang')==='de');
    await page.waitForSelector('[data-k7-language]',{state:'attached'});
    assert.equal(await page.locator('html').getAttribute('lang'),'de');
    assert.equal(await page.evaluate(()=>localStorage.getItem('kepler7-ui-language')),'de');
    assert.equal(await page.locator('#loginUsername').getAttribute('placeholder'),'Kommandantenname');
    await anonymous.context.close();
    console.log('PASS anonymous English login, protected user content, and English -> German switching');

    for(const language of ['de','en']){
      const state=await makePage(browser,{language,authenticated:true});
      const p=state.page;
      await p.evaluate(()=>['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id=>{const node=document.getElementById(id);if(node)node.style.display='none';}));
      assert.equal(state.errors.length,0,state.errors.join('\n'));
      const tabs=await p.locator('.tab-btn').evaluateAll(buttons=>buttons.map(b=>b.getAttribute('data-tab')));
      assert.ok(tabs.length>10,'Expected the full game navigation, not an empty fixture');
      for(const tab of tabs){
        const activated=await p.evaluate(tab=>{const b=document.querySelector('.tab-btn[data-tab="'+tab+'"]');b.click();return document.querySelector('.tab-btn.active')?.getAttribute('data-tab')===tab;},tab);
        await p.waitForTimeout(150);
        assert.ok(activated,'Tab did not activate: '+tab);
        assert.equal(state.errors.length,0,language+' '+tab+': '+state.errors.join('\n'));
        if(language==='en'){
          const visibleText=await p.locator('body').innerText();
          const leftovers=GERMAN_SURFACE_PROBES.filter(phrase=>visibleText.includes(phrase));
          assert.deepEqual(leftovers,[], 'English '+tab+' still shows German surface text: '+leftovers.join(', '));
        }
      }
      for(const attr of ['data-fleet-subtab','data-officer-subtab']){
        const keys=await p.locator('['+attr+']').evaluateAll((buttons,attr)=>buttons.map(b=>b.getAttribute(attr)),attr);
        for(const key of keys){
          await p.evaluate(({attr,key})=>document.querySelector('['+attr+'="'+key+'"]')?.click(),{attr,key});
          await p.waitForTimeout(100);
          assert.equal(state.errors.length,0,language+' '+key+': '+state.errors.join('\n'));
        }
      }
      await p.evaluate(()=>document.querySelector('.tab-btn')?.click());
      if(language==='en'){
        await p.locator('#headerHelpBtn').click();
        await p.waitForTimeout(150);
        const helpText=await p.locator('#tab-hilfe').innerText();
        assert.match(helpText,/Basics/);
        assert.match(helpText,/Fleet and ships/);
        assert.doesNotMatch(helpText,/Grundlagen|Häufige Fragen|Warum/);
      }
      if(screenDir)await p.screenshot({path:path.join(screenDir,language+'-game.png')});
      const serialized=JSON.stringify(state.store);
      assert.ok(serialized.includes('energie'),'German resource identifier must remain unchanged');
      assert.ok(!serialized.includes('kepler7-ui-language'),'UI language must not enter the server save store');
      console.log('PASS '+language+': boot, '+tabs.length+' tabs, fleet/officer sub-tabs; no script errors');
      await state.context.close();
    }
    const mobile=await makePage(browser,{language:'en',mobile:true});
    assert.equal(await mobile.page.locator('.ll-actions [data-k7-language]').isVisible(),true);
    const overflow=await mobile.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(overflow,false,'English landing page must not overflow horizontally on mobile');
    if(screenDir)await mobile.page.screenshot({path:path.join(screenDir,'english-mobile.png')});
    assert.equal(mobile.errors.length,0,mobile.errors.join('\n'));
    await mobile.context.close();
    console.log('PASS English mobile landing page and language selector');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
