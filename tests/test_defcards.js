// Verteidigungskarten: groessere Kacheln + gesperrte Anlagen zeigen Grafik und Wirkung.
// Das Spiel laeuft in einer IIFE - alles wird ueber den Spielstand gesetzt und im DOM gemessen.
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
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
// Bewusst OHNE die Forschungen, die die spaeteren Anlagen freischalten - so entstehen im selben
// Tab beide Kartenarten (baubar und gesperrt) und beide lassen sich in einem Lauf pruefen.
const mkSave = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:5e5,erz:5e5,kristalle:3e5,deuterium:2e5,antimaterie:9e3,forschungspunkte:2e4},
  buildings:{solar:20,mine:18,lager:14,werft:8,turm:6,flak:6,laser:6}, research:{rsolar:6,rerz:6},
  fleet:{jaeger:50,missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',allianceTag:'',avatarKey:null}, battleStats:{wins:1,losses:0},
  xp:5000, credits:20000, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{} });

async function boot(browser, width, dpr){
  const store={}; store['kepler7-save-v3']=mkSave();
  const ctx=await browser.newContext({viewport:{width,height:1200},deviceScaleFactor:dpr});
  const page=await ctx.newPage(); const errs=[];
  page.on('pageerror',e=>errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>{ localStorage.setItem('kepler7_token','tok'); });
  await page.goto(FILE); await page.waitForTimeout(1800);
  await page.evaluate(()=>{ ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}); });
  await page.evaluate(()=>{ const b=document.querySelector('.tab-btn[data-tab="verteidigung"]'); if(b)b.click(); });
  await page.waitForTimeout(900);
  const data = await page.evaluate(()=>{
    const rows = Array.from(document.querySelectorAll('#defenseBuildings .card-row'));
    const out = rows.map(row=>{
      const tile = row.querySelector('.bicon');
      const cv = row.querySelector('canvas');
      const r = tile ? tile.getBoundingClientRect() : null;
      const cr = cv ? cv.getBoundingClientRect() : null;
      return {
        name: (row.querySelector('.bname')||{}).textContent||'',
        locked: row.classList.contains('research-locked'),
        isDef: !!(tile && tile.classList.contains('bicon-def')),
        hasCanvas: !!cv,
        hasLockBadge: !!row.querySelector('.lock-badge'),
        tileW: r?Math.round(r.width):0, tileH: r?Math.round(r.height):0,
        canvasW: cr?Math.round(cr.width):0, canvasH: cr?Math.round(cr.height):0,
        text: (row.querySelector('.left')||{}).textContent||''
      };
    });
    // Wird die Zeichenflaeche wirklich bemalt? Nicht-transparente Pixel eines gesperrten Icons zaehlen.
    let paintedLocked = -1;
    const lockedRow = rows.find(r=>r.classList.contains('research-locked') && r.querySelector('canvas'));
    if (lockedRow){
      const c = lockedRow.querySelector('canvas');
      const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>10) n++;
      paintedLocked = n;
    }
    return { rows: out, paintedLocked, docW: document.documentElement.scrollWidth, winW: window.innerWidth };
  });
  await ctx.close();
  return { data, errs };
}
(async () => {
  const browser = await starteBrowser();
  let fail=false; const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

  for (const [w,dpr,want] of [[1100,1,68],[1100,2,68],[420,2,56]]){
    const { data, errs } = await boot(browser, w, dpr);
    const tag = w+'px/dpr'+dpr;
    const defs = data.rows.filter(r=>r.isDef);
    check(tag+': Verteidigungskarten gefunden', defs.length >= 10, defs.length);
    check(tag+': jede Kachel '+want+'x'+want,
      defs.every(r=>r.tileW===want && r.tileH===want),
      defs.filter(r=>r.tileW!==want||r.tileH!==want).map(r=>[r.name.trim(),r.tileW,r.tileH]).slice(0,3));
    // Das canvas muss IN die Kachel passen - auf Retina schreibt ensureCanvasDpr ein inline
    // style.width in Attributgroesse (64px), das darf die 56px-Kachel nicht sprengen.
    check(tag+': Grafik bleibt innerhalb der Kachel',
      defs.every(r=>r.canvasW>0 && r.canvasW<=r.tileW && r.canvasH<=r.tileH),
      defs.filter(r=>!(r.canvasW>0 && r.canvasW<=r.tileW)).map(r=>[r.name.trim(),r.canvasW,r.tileW]).slice(0,3));
    check(tag+': kein waagerechtes Ueberlaufen der Seite', data.docW <= data.winW, {doc:data.docW, win:data.winW});
    check(tag+': keine JS-Fehler', errs.length===0, errs.slice(0,2));

    const locked = data.rows.filter(r=>r.locked && r.isDef);
    check(tag+': gesperrte Anlagen vorhanden', locked.length >= 2, locked.length);
    check(tag+': gesperrte zeigen Grafik statt Schloss-Symbol', locked.every(r=>r.hasCanvas), locked.filter(r=>!r.hasCanvas).map(r=>r.name.trim()));
    check(tag+': gesperrte tragen ein Schloss-Abzeichen', locked.every(r=>r.hasLockBadge), locked.filter(r=>!r.hasLockBadge).map(r=>r.name.trim()));
    check(tag+': gesperrte nennen ihre Wirkung je Stufe',
      locked.every(r=>/je Stufe|Reichweite|Zerstörungschance|Vorwarnzeit/.test(r.text)),
      locked.filter(r=>!/je Stufe|Reichweite|Zerstörungschance|Vorwarnzeit/.test(r.text)).map(r=>r.name.trim()).slice(0,3));
    check(tag+': Grafik einer gesperrten Anlage ist wirklich gezeichnet', data.paintedLocked > 200, data.paintedLocked);
    console.log('');
  }
  await browser.close();
  console.log(fail?'FAIL':'PASS'); process.exit(fail?1:0);
})();
