// Wisch-Leisten ([data-hscroll]) auf dem Handy: passen sie in den Bildschirm, ist der GESAMTE
// Inhalt erwischbar, und greift ein Antippen des hintersten Eintrags?
// Hintergrund: .card-row bekommt unter 700px flex-wrap:wrap; zusammen mit dem inline gesetzten
// flex-direction:column bildet sich die Flex-Zeile nach dem BREITESTEN Kind (dem langen
// Beschreibungstext), und align-items:stretch zieht die Leiste auf diese Zeilenbreite statt auf
// die Containerbreite. .shell kappt den Ueberhang per overflow-x:hidden - die Leiste behielt
// dadurch nur einen Bruchteil ihres Scrollwegs und die hinteren Eintraege waren unerreichbar.
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const path = require('path');
const FILE = SPIEL_URL;
function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}
const SAVE = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:3e5,erz:3e5,kristalle:2e5,deuterium:1e5,antimaterie:5e3,forschungspunkte:1e4},
  buildings:{solar:20,mine:18,lager:14,werft:10,hangar:6,labor:12,orbitalstation:3},
  research:{rsolar:6,rerz:6,rmodultechnik:3},
  fleet:{jaeger:200,bomber:60,zerstoerer:30,forscher:6,missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',allianceTag:'',avatarKey:null}, battleStats:{wins:5,losses:1},
  xp:20000, credits:50000, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{},
  expeditionsCompleted:12, modules:{}, shipModules:{} });

// Echte Touch-Wischgeste ueber das Chrome DevTools Protocol - page.mouse erzeugt in einem
// Touch-Kontext KEIN Scrollen, ein Maus-Drag wuerde hier faelschlich "geht nicht" melden.
async function swipeLeft(page, cdp, box, dist){
  const y = Math.round(box.y + box.h/2);
  // Bewusst NICHT am aeussersten rechten Rand ansetzen: dort liegt der fixierte Randreiter
  // ("Chat"/"Status") ueber der Seite und faengt den Touch ab - das waere ein Messfehler, kein Befund.
  const x0 = Math.round(box.x + box.w * 0.75);
  await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:x0, y}] });
  const steps = 12;
  for (let i=1;i<=steps;i++){
    await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{x: Math.round(x0 - dist*i/steps), y}] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await page.waitForTimeout(600);
}

(async () => {
  const browser = await starteBrowser();
  let fail=false; const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };
  const store={}; store['kepler7-save-v3']=SAVE;
  const ctx = await browser.newContext(Object.assign({}, devices['Pixel 5']));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror',e=>errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>{ localStorage.setItem('kepler7_token','tok'); });
  await page.goto(FILE); await page.waitForTimeout(2000);
  await page.evaluate(()=>{ ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}); });
  const cdp = await ctx.newCDPSession(page);

  // Tabs, auf denen Wisch-Leisten vorkommen. Unterreiter der Flotte fuer die Modul-Leisten.
  const stops = [['expedition',null],['basis',null],['flotte','module'],['flotte','schiffsmodule']];
  const seen = new Set();
  for (const [tab, sub] of stops){
    await page.evaluate(t=>{ const b=document.querySelector('.tab-btn[data-tab="'+t+'"]'); if(b)b.click(); }, tab);
    await page.waitForTimeout(700);
    if (sub){ await page.evaluate(s=>{ const b=document.querySelector('[data-fleet-subtab="'+s+'"]'); if(b)b.click(); }, sub); await page.waitForTimeout(700); }
    const bars = await page.evaluate(()=>Array.from(document.querySelectorAll('[data-hscroll]'))
      .filter(b=>b.offsetParent !== null)
      .map(b=>b.getAttribute('data-hscroll')));
    for (const name of bars){
      if (seen.has(name)) continue;
      seen.add(name);
      // Leiste erst in den Sichtbereich holen: die Touch-Koordinaten stammen aus
      // getBoundingClientRect, und eine Leiste weiter unten in der Seite laege sonst ausserhalb
      // des Viewports - die Wischgeste ginge daneben und wuerde faelschlich "geht nicht" melden.
      await page.evaluate(n=>{ document.querySelector(`[data-hscroll="${n}"]`).scrollIntoView({block:'center'}); }, name);
      await page.waitForTimeout(400);
      const info = await page.evaluate(n=>{
        const bar = document.querySelector(`[data-hscroll="${n}"]`);
        const r = bar.getBoundingClientRect();
        const kids = Array.from(bar.children);
        const last = kids[kids.length-1];
        const lr = last ? last.getBoundingClientRect() : null;
        return { clientW: bar.clientWidth, scrollW: bar.scrollWidth, win: window.innerWidth,
                 x:r.x, y:r.y, w:r.width, h:r.height, kids:kids.length,
                 lastRight: lr ? Math.round(lr.right - r.left + bar.scrollLeft) : 0 };
      }, name);
      const label = 'Leiste "'+name+'"';
      // 1) Die Leiste selbst darf nicht breiter sein als der Bildschirm - sonst liegt ihr rechter
      //    Teil hinter der overflow-Kante von .shell und ist gar nicht bedienbar.
      check(label+': passt in den Bildschirm', info.clientW <= info.win, {leiste:info.clientW, bildschirm:info.win});
      // 2) Der Scrollweg muss den GESAMTEN Inhalt erreichbar machen.
      const need = Math.max(0, info.lastRight - info.clientW);
      const have = Math.max(0, info.scrollW - info.clientW);
      check(label+': Scrollweg deckt den ganzen Inhalt', have >= need - 1, {noetig:need, vorhanden:have, eintraege:info.kids});
      // 3) Echte Wischgeste bewegt die Leiste.
      if (have > 20){
        await page.evaluate(n=>{ document.querySelector(`[data-hscroll="${n}"]`).scrollLeft = 0; }, name);
        await page.waitForTimeout(200);
        const inView = info.y >= 0 && info.y + info.h <= 851;
        check(label+': liegt fuer die Wischprobe im Sichtbereich', inView, {y:Math.round(info.y), h:Math.round(info.h)});
        await swipeLeft(page, cdp, {x:info.x,y:info.y,w:info.w,h:info.h}, Math.min(200, have));
        const after = await page.evaluate(n=>Math.round(document.querySelector(`[data-hscroll="${n}"]`).scrollLeft), name);
        check(label+': Wischen bewegt die Leiste', after > 20, {scrollLeftNachWisch:after});
      }
      // 4) Der hinterste Eintrag laesst sich per Antippen wirklich auswaehlen (nur bei Button-Leisten).
      const tapInfo = await page.evaluate(n=>{
        const bar = document.querySelector(`[data-hscroll="${n}"]`);
        const btns = Array.from(bar.querySelectorAll(':scope > button'));
        if (!btns.length) return null;
        const last = btns[btns.length-1];
        last.scrollIntoView({block:'nearest', inline:'center'});
        const attr = last.getAttributeNames().find(a=>a.startsWith('data-'));
        return { attr, val: last.getAttribute(attr), text:last.textContent.trim() };
      }, name);
      if (tapInfo){
        await page.waitForTimeout(400);
        const vis = await page.evaluate(t=>{
          const b=document.querySelector(`[${t.attr}="${t.val}"]`); const r=b.getBoundingClientRect();
          return { x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2),
                   inView: r.left >= 0 && r.right <= window.innerWidth };
        }, tapInfo);
        check(label+': hinterster Eintrag ("'+tapInfo.text.slice(0,24)+'") wird sichtbar', vis.inView, vis);
        await page.touchscreen.tap(vis.x, vis.y);
        await page.waitForTimeout(800);
        const active = await page.evaluate(t=>{
          const b=document.querySelector(`[${t.attr}="${t.val}"]`);
          return b ? /5dcaa5|e0a548|c3bef5/.test(b.getAttribute('style')||'') : false;
        }, tapInfo);
        check(label+': Antippen des hintersten Eintrags greift', active, {aktiv:active});
      }
    }
  }
  check('alle erwarteten Leisten geprueft', seen.size >= 3, Array.from(seen));
  check('keine JS-Fehler', errs.length===0, errs.slice(0,2));
  await browser.close();
  console.log(fail?'\nFAIL':'\nPASS'); process.exit(fail?1:0);
})();
