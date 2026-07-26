// Trümmerfeld-Box: Zwischenspeicher (26.07.2026, v8.301.2).
//
// Ausgangsbefund: Die Box hing als Inline-Block mitten im Flotten-Render und wurde bei geöffnetem
// Flotte- oder Expedition-Tab JEDE SEKUNDE per innerHTML neu geschrieben - auch dann, wenn am
// Planeten gar kein Recycler steht und sich an den Zahlen folglich nie etwas ändert.
//
// Sie erfüllt die Bedingung des Hausmusters aus CLAUDE.md: kein Live-Countdown, keine Date.now()-
// Differenz, nur Zahlen. Also Signatur-Cache. Die Signatur enthält bewusst die FERTIG FORMATIERTEN
// Werte (rewardHtml + fmt der Summe) statt der Rohzahlen - sonst würde eine Nachkommastelle, die
// gar nicht angezeigt wird, einen Neuaufbau auslösen und der Cache wäre wirkungslos.
//
// Der Zustand `state` liegt in der IIFE und ist von außen nicht erreichbar; die beiden Fälle werden
// deshalb über ZWEI Spielstände gefahren statt über eine Manipulation im laufenden Spiel:
//   1) ohne Recycler bleibt das DOM über mehrere Ticks bestehen
//   2) mit Recyclern schrumpft das Feld sichtbar - die Box wird weiterhin neu gebaut (kein Einfrieren)
//   3) ein leeres Trümmerfeld lässt die Box leer
//   4) der angezeigte Planetenname stammt aus planetDisplayName und steckt auch in der Signatur
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

function save(zusatz){
  return JSON.stringify(Object.assign({ tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{energie:3e5,erz:3e5,kristalle:2e5,deuterium:1e5,antimaterie:5e3,forschungspunkte:1e4},
    buildings:{solar:20,mine:18,lager:14,werft:10,hangar:6,labor:12},
    research:{rsolar:6,rerz:6},
    fleet:{jaeger:200,bomber:60,recycler:0,missions:[]}, colonies:{}, activeBasePlanet:'home',
    player:{id:'u',name:'A',allianceTag:'',avatarKey:null}, battleStats:{wins:5,losses:1},
    xp:20000, credits:50000, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{},
    modules:{}, shipModules:{} }, zusatz));
}

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

// Oeffnet das Spiel mit einem Spielstand und stellt den Flotte-Tab ein.
async function spiel(browser, zustand){
  const store={ 'kepler7-save-v3': save(zustand) };
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome']));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>{ localStorage.setItem('kepler7_token','tok'); });
  await page.goto(SPIEL_URL); await page.waitForTimeout(2500);
  await page.evaluate(()=>{ ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}); });
  await page.evaluate(()=>{ const b=document.querySelector('.tab-btn[data-tab="flotte"]'); if(b)b.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(()=>{ const b=document.querySelector('[data-fleet-subtab="flotte"]'); if(b)b.click(); });
  await page.waitForTimeout(1200);
  return { page, ctx, errs };
}
const lies = page => page.evaluate(()=>{
  const box = document.getElementById('debrisBox');
  const k = box && box.firstElementChild;
  return { leer: !box || box.innerHTML.length === 0, markiert: !!(k && k.__marke),
           text: box ? box.textContent.replace(/\s+/g,' ').trim().slice(0,220) : null };
});

(async () => {
  const browser = await starteBrowser();

  // ------------------------------------------------------- 1) ohne Recycler: DOM bleibt stehen
  {
    const { page, ctx, errs } = await spiel(browser, {
      debrisFields:{ home:{ erz:48000, kristalle:21000 } },
      colonyNames:{ home:'Steinbruch' } });
    const start = await lies(page);
    check('Trümmerfeld-Box ist aufgebaut', /Trümmerfeld bei/.test(start.text||''), start);
    check('ohne Recycler steht der passende Hinweis da', /Keine Recycler hier stationiert/.test(start.text||''));
    // 4) Der ANGEZEIGTE Name gehoert in die Signatur, nicht der Planetenschluessel - sonst behielte
    // die Box nach dem Umbenennen einer Kolonie den alten Namen, bis sich zufaellig eine Zahl aendert.
    check('4: der eigene Kolonie-Name steht in der Box', /Trümmerfeld bei Steinbruch/.test(start.text||''), start.text);

    // Die Markierung haengt am DOM-Knoten, nicht am Markup - ein innerHTML-Neuschreiben vernichtet
    // sie zwangslaeufig. Genau das ist die Messung, und sie kann nicht aus dem falschen Grund
    // gelingen (anders als ein Vergleich der Textinhalte, die ja gleich BLEIBEN sollen).
    await page.evaluate(()=>{ document.getElementById('debrisBox').firstElementChild.__marke = 1; });
    await page.waitForTimeout(3400); // mindestens drei Sekunden-Ticks
    const nach = await lies(page);
    check('1: ohne Recycler wird die Box über mehrere Ticks NICHT neu geschrieben', nach.markiert === true, nach);
    check('1: und ihr Inhalt steht unverändert da', nach.text === start.text);
    check('1: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ------------------------------------------------------- 2) mit Recyclern: baut weiter neu auf
  // 20 Recycler holen 160 Ressourcen/s aus dem Feld - die angezeigte Summe sinkt also innerhalb
  // weniger Ticks sichtbar. Genau dann MUSS neu gezeichnet werden, sonst waere der Cache ein
  // Einfrieren statt einer Ersparnis.
  {
    const { page, ctx, errs } = await spiel(browser, {
      debrisFields:{ home:{ erz:4800, kristalle:2100 } },
      // Lager bewusst leer: bei vollem Lager baut collectDebrisWithRecyclers() das Feld absichtlich
      // NICHT ab (Bugfix im Spiel - Ressourcen sollen nicht ersatzlos verschwinden). Mit vollem
      // Lager würde dieser Test also aus dem falschen Grund grün werden.
      resources:{ energie:5e4, erz:100, kristalle:100, deuterium:100, antimaterie:0, forschungspunkte:0 },
      fleet:{ jaeger:200, bomber:60, recycler:20, missions:[] } });
    const start = await lies(page);
    check('2: mit Recyclern nennt die Box deren Zahl und Sammelrate',
      /20 Recycler sammeln gerade aktiv ein/.test(start.text||'') && /160 Ressourcen\/s/.test(start.text||''), start.text);
    await page.evaluate(()=>{ document.getElementById('debrisBox').firstElementChild.__marke = 1; });
    await page.waitForTimeout(3400);
    const nach = await lies(page);
    check('2: das sinkende Feld baut die Box weiterhin neu auf (kein Einfrieren)', nach.markiert === false, nach);
    check('2: und die angezeigte Summe ist wirklich gesunken', nach.text !== start.text, { vorher:start.text, nachher:nach.text });
    check('2: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ------------------------------------------------------- 3) kein Trümmerfeld: Box bleibt leer
  {
    const { page, ctx } = await spiel(browser, { debrisFields:{} });
    const leer = await lies(page);
    check('3: ohne Trümmerfeld bleibt die Box leer', leer.leer === true, leer);
    await ctx.close();
  }

  // ------------------------------------------------------- 4) Signatur enthält den Namen
  {
    const src = fs.readFileSync(SPIELDATEI, 'utf8');
    const fn = src.slice(src.indexOf('function renderDebrisBox'), src.indexOf('// ===== Prisenhof'));
    check('4: es gibt genau eine renderDebrisBox-Definition',
      (src.match(/function renderDebrisBox/g)||[]).length === 1, (src.match(/function renderDebrisBox/g)||[]).length);
    check('4: der angezeigte Name steckt in der Signatur', /const sig = name\+'\|'/.test(fn));
    check('4: ebenso die Recycler-Zahl und die formatierten Werte',
      /const sig = name\+'\|'\+recyclerCount\+'\|'\+gesamt\+'\|'\+inhalt;/.test(fn));
    check('4: bei leerem Feld wird der Zwischenspeicher zurückgesetzt', /lastDebrisSig = null;\n      return;/.test(fn));
  }

  console.log('\n' + (fail ? 'FAIL' : 'PASS'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
