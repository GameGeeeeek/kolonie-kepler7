// Galaxie-Übersichtskarte: Zwischenspeicher und ruhendes Sternenfeld (26.07.2026).
//
// Ausgangsbefund (gemessen, nicht vermutet): buildGalaxyMap() baute das komplette SVG bei geöffnetem
// Karte-Tab JEDE SEKUNDE neu - 448 Knoten, rund 49 KB Markup, etwa 10% aller DOM-Knoten der Seite.
// Und weil die 25 Hintergrundsterne per Math.random() gesetzt wurden, war das erzeugte Markup dabei
// jedes Mal ein anderes: die Sterne sprangen im Sekundentakt.
//
// Der Zwischenspeicher vergleicht bewusst das ERZEUGTE MARKUP statt einer von Hand gepflegten
// Signatur (die Karte zieht aus einem guten Dutzend Quellen; eine Signaturliste wäre genau die Sorte
// zweite Stelle, die beim nächsten Umbau vergessen wird - dann friert die Karte ein).
//
// Geprüft wird deshalb beides, und zwar am laufenden Spiel:
//   1) im Leerlauf bleibt das DOM bestehen (kein innerHTML-Neuschreiben)
//   2) ändert sich etwas Sichtbares, wird trotzdem neu gebaut - der Speicher friert nichts ein
//   3) das Sternenfeld steht still
//   4) Zoom wirkt weiterhin, obwohl er das Markup nicht ändert
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

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

(async () => {
  const browser = await starteBrowser();
  let fail=false; const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };
  const store={}; store['kepler7-save-v3']=SAVE;
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome']));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>{ localStorage.setItem('kepler7_token','tok'); });
  await page.goto(SPIEL_URL); await page.waitForTimeout(2500);
  await page.evaluate(()=>{ ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}); });
  await page.evaluate(()=>{ const b=document.querySelector('.tab-btn[data-tab="karte"]'); if(b)b.click(); });
  await page.waitForTimeout(1500);

  const grundlage = await page.evaluate(()=>{
    const svg = document.getElementById('galaxyMapSvg');
    return { da: !!svg, knoten: svg ? svg.querySelectorAll('*').length : 0,
             systeme: svg ? svg.querySelectorAll('[data-system-node]').length : 0 };
  });
  check('Karte ist aufgebaut', grundlage.da && grundlage.knoten > 50 && grundlage.systeme > 1, grundlage);
  if (!grundlage.da){ console.log('\nFAIL'); await browser.close(); process.exit(1); }

  // ---------------------------------------------------------------- 1) Leerlauf: DOM bleibt stehen
  // Die Markierung haengt am DOM-Knoten selbst, nicht am Markup - ein innerHTML-Neuschreiben wuerde
  // sie zwangslaeufig vernichten. Genau das ist die Messung.
  await page.evaluate(()=>{
    const svg = document.getElementById('galaxyMapSvg');
    svg.querySelectorAll('[data-system-node]').forEach((n,i)=>{ n.__marke = 'm'+i; });
    window.__markenZahl = svg.querySelectorAll('[data-system-node]').length;
  });
  await page.waitForTimeout(3400); // mindestens drei Sekunden-Ticks
  const nachLeerlauf = await page.evaluate(()=>{
    const svg = document.getElementById('galaxyMapSvg');
    const knoten = Array.from(svg.querySelectorAll('[data-system-node]'));
    return { gesamt: knoten.length, markiert: knoten.filter(n=>n.__marke).length, erwartet: window.__markenZahl };
  });
  check('1: im Leerlauf wird das Karten-DOM über mehrere Ticks NICHT neu geschrieben',
    nachLeerlauf.markiert === nachLeerlauf.erwartet && nachLeerlauf.gesamt === nachLeerlauf.erwartet,
    nachLeerlauf);

  // ---------------------------------------------------------------- 2) Gegenprobe: Änderung baut neu
  // Ein anderes System auswaehlen aendert Hervorhebung und Beschriftung - das Markup MUSS sich
  // aendern, sonst waere der Zwischenspeicher ein Einfrieren.
  const gewechselt = await page.evaluate(async ()=>{
    const svg = document.getElementById('galaxyMapSvg');
    const knoten = Array.from(svg.querySelectorAll('[data-system-node]'));
    const aktiv = svg.querySelector('.planet-label') ? null : null;
    // Irgendein System, das gerade NICHT ausgewaehlt ist: das letzte in der Liste.
    const ziel = knoten[knoten.length-1];
    const id = ziel.getAttribute('data-system-node');
    ziel.dispatchEvent(new MouseEvent('click', { bubbles:true }));
    return id;
  });
  await page.waitForTimeout(1600);
  const nachWechsel = await page.evaluate(()=>{
    const svg = document.getElementById('galaxyMapSvg');
    const knoten = Array.from(svg.querySelectorAll('[data-system-node]'));
    return { gesamt: knoten.length, markiert: knoten.filter(n=>n.__marke).length };
  });
  check('2: eine sichtbare Änderung baut die Karte weiterhin neu auf (kein Einfrieren)',
    nachWechsel.markiert === 0 && nachWechsel.gesamt > 1, Object.assign({ gewechseltZu: gewechselt }, nachWechsel));
  // Und die Klick-Handler sind nach dem Neuaufbau wieder verdrahtet.
  await page.evaluate(()=>{ document.getElementById('galaxyMapSvg').querySelectorAll('[data-system-node]').forEach(n=>{ n.__marke2 = 1; }); });
  const zweiterWechsel = await page.evaluate(()=>{
    const svg = document.getElementById('galaxyMapSvg');
    const knoten = Array.from(svg.querySelectorAll('[data-system-node]'));
    knoten[0].dispatchEvent(new MouseEvent('click', { bubbles:true }));
    return knoten[0].getAttribute('data-system-node');
  });
  await page.waitForTimeout(1600);
  const nachZweitem = await page.evaluate(()=>{
    const knoten = Array.from(document.getElementById('galaxyMapSvg').querySelectorAll('[data-system-node]'));
    return { markiert: knoten.filter(n=>n.__marke2).length, gesamt: knoten.length };
  });
  check('2: die Klick-Handler werden beim Neuaufbau wieder gebunden (zweiter Wechsel greift)',
    nachZweitem.markiert === 0, Object.assign({ gewechseltZu: zweiterWechsel }, nachZweitem));

  // ---------------------------------------------------------------- 3) Sternenfeld steht still
  const sterne = async () => page.evaluate(()=>{
    const svg = document.getElementById('galaxyMapSvg');
    // Die Hintergrundsterne sind die <circle> direkt unter dem SVG (die Systeme liegen in <g>).
    return Array.from(svg.children).filter(n=>n.tagName==='circle')
      .map(c=>c.getAttribute('cx')+','+c.getAttribute('cy')+','+c.getAttribute('r')).join('|');
  });
  const s1 = await sterne();
  await page.waitForTimeout(2400);
  const s2 = await sterne();
  check('3: es gibt überhaupt ein Sternenfeld', s1.split('|').length >= 20, { sterne: s1.split('|').length });
  check('3: das Sternenfeld springt nicht mehr im Sekundentakt', s1 === s2 && s1.length > 0);

  // ---------------------------------------------------------------- 4) Zoom wirkt trotz Speicher
  const vorZoom = await page.evaluate(()=>document.getElementById('galaxyMapSvg').getAttribute('viewBox'));
  await page.evaluate(()=>{
    const svg = document.getElementById('galaxyMapSvg');
    const r = svg.getBoundingClientRect();
    svg.dispatchEvent(new WheelEvent('wheel', { deltaY:-240, clientX:r.left+r.width/2, clientY:r.top+r.height/2, bubbles:true, cancelable:true }));
  });
  await page.waitForTimeout(500);
  const nachZoom = await page.evaluate(()=>document.getElementById('galaxyMapSvg').getAttribute('viewBox'));
  check('4: Zoom ändert den Ausschnitt weiterhin, obwohl er das Markup nicht ändern muss',
    vorZoom !== nachZoom, { vorZoom, nachZoom });

  check('Keine Konsolenfehler auf der Karte', errs.length === 0, errs.slice(0,3));
  console.log(fail ? '\nFAIL' : '\nPASS');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
