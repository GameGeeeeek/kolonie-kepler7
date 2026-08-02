// #officerBox und #statsTilesBox: Zwischenspeicher (02.08.2026).
//
// GEMESSEN, nicht geschätzt (MutationObserver, acht Sekunden):
//
//     #officerBox      8 Neuaufbauten   108,2 kB   bei 13,5 kB Boxgröße   - nur auf dem Offiziere-Reiter
//     #statsTilesBox   8 Neuaufbauten    23,5 kB   bei  2,9 kB Boxgröße   - auf JEDEM Reiter
//
// In beiden Fällen war das Markup Zeichen für Zeichen identisch. #statsTilesBox gehört damit zu
// derselben reiterunabhängigen Klasse wie #npcList vor v8.311.0: Sie lief auch dort mit, wo man sie
// gar nicht sieht.
//
// DER EINZIGE ECHTE RISIKOPUNKT ist #officerBox: Die beiden Verdrahtungsläufe liegen IM if-Zweig,
// werden bei übersprungenem Takt also NICHT neu gesetzt. Das geht nur gut, weil die alten Knoten
// samt Handler stehen bleiben - und genau das muss belegt sein, nicht angenommen. Deshalb klickt
// dieser Test einen Offiziers-Knopf NACH mehreren übersprungenen Takten.
//
// #statsTilesBox hat weder Handler noch Canvas; dort genügt der Nachweis, dass die Anzeige stimmt
// und sich bei einer echten Änderung sofort neu aufbaut.
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true,version:2});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}

const save=()=>JSON.stringify({tutorialSeen:true,newbieWelcomeSeen:true,
  resources:{energie:5e5,erz:5e5,kristalle:3e5,deuterium:2e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:22,mine:20,kristallmine:18,labor:14,lager:30,werft:14,turm:8,laser:10,schild:6},
  research:{rkampf:9,rsolar:9,rerz:8}, fleet:{jaeger:600,cruisers:200,destroyers:90,missions:[]},
  colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
  // Reichlich Kommandopunkte, damit die Aufwerten-Knöpfe überhaupt bedienbar sind.
  battleStats:{wins:9,losses:2}, xp:260000, credits:180000, commandPoints:500000,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

// Die Markierung hängt am DOM-Knoten, nicht am Markup - ein innerHTML-Neuschreiben vernichtet sie
// zwangsläufig. Ein Textvergleich könnte dagegen aus dem falschen Grund gelingen: Der Text SOLL ja
// gleich bleiben.
const markiere = (page,id) => page.evaluate(x=>{const b=document.getElementById(x); if(!b||!b.firstElementChild) return false; b.firstElementChild.__marke=1; return true;}, id);
const markeDa  = (page,id) => page.evaluate(x=>{const b=document.getElementById(x); return !!(b&&b.firstElementChild&&b.firstElementChild.__marke===1);}, id);

(async()=>{
  const browser=await starteBrowser();
  const ctx=await browser.newContext(Object.assign({},devices['Desktop Chrome'],{viewport:{width:1000,height:1300}}));
  const page=await ctx.newPage(); const errs=[];
  page.on('pageerror',e=>errs.push(String(e)));
  page.on('console',m=>{if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text()))errs.push(m.text());});
  await page.route('**/api/**', backend({'kepler7-save-v3':save()}));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3200);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});

  await page.evaluate(()=>{const x=document.querySelector('.tab-btn[data-tab="offiziere"]'); if(x) x.click();});
  await page.waitForTimeout(1500);

  const groessen = await page.evaluate(()=>['officerBox','statsTilesBox'].map(id=>{const b=document.getElementById(id); return b?b.innerHTML.length:-1;}));
  check('0: beide Boxen sind gerendert', groessen[0] > 2000 && groessen[1] > 500, groessen);
  if (groessen[0] <= 2000){
    console.log('\nFEHLGESCHLAGEN (ohne Offiziersliste wäre alles Weitere ein falsches Grün)');
    await browser.close(); process.exit(1);
  }

  // ------------------------------------------------- 1) beide bleiben über mehrere Takte stehen
  check('1: #officerBox lässt sich markieren', await markiere(page,'officerBox') === true);
  check('1: #statsTilesBox lässt sich markieren', await markiere(page,'statsTilesBox') === true);
  await page.waitForTimeout(3400);   // mindestens drei Sekunden-Takte
  check('1: #officerBox steht nach drei Takten noch', await markeDa(page,'officerBox') === true);
  check('1: #statsTilesBox steht nach drei Takten noch', await markeDa(page,'statsTilesBox') === true);

  // ------------------------------------------------- 2) der Knopf wirkt nach übersprungenen Takten
  // Das ist der eigentliche Risikopunkt: Die Verdrahtung lief zuletzt vor über drei Sekunden.
  const vorher = await page.evaluate(()=>{
    const b=document.querySelector('[data-upgrade-officer]');
    return b ? { key:b.getAttribute('data-upgrade-officer'), text:(b.closest('.card-row')||b.parentElement).textContent.replace(/\s+/g,' ').slice(0,80) } : null;
  });
  check('2: es gibt einen Aufwerten-Knopf', !!vorher, vorher);
  if (vorher){
    await page.evaluate(()=>{ const b=document.querySelector('[data-upgrade-officer]'); if(b) b.click(); });
    await page.waitForTimeout(900);
    const nachher = await page.evaluate(()=>{
      const b=document.querySelector('[data-upgrade-officer]');
      return b ? (b.closest('.card-row')||b.parentElement).textContent.replace(/\s+/g,' ').slice(0,80) : null;
    });
    check('2: der Klick nach drei übersprungenen Takten wirkt noch (Stufe hat sich geändert)',
      nachher !== null && nachher !== vorher.text, { vorher: vorher.text, nachher });
    // 3) und die echte Änderung hat die Box neu gebaut
    check('3: die echte Änderung baut #officerBox neu auf (Markierung ist weg)',
      await markeDa(page,'officerBox') === false);
  }

  // ------------------------------------------------- 4) statsTilesBox zeigt weiterhin das Richtige
  const kacheln = await page.evaluate(()=>{
    const b=document.getElementById('statsTilesBox');
    return b ? (b.textContent||'').replace(/\s+/g,' ') : '';
  });
  check('4: die Statistik-Kacheln zeigen ihre Werte', /Siege/.test(kacheln) && /Kampfpunkte/.test(kacheln), kacheln.slice(0,90));

  check('keine JS-Fehler', errs.length === 0, errs.slice(0,3));
  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
