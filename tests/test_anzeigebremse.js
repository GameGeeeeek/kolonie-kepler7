// Anzeige-Bremse bei bildschirmfüllender Wiedergabe (02.08.2026).
//
// GEMESSEN, nicht vermutet: Während eine Kampf-Wiedergabe lief, schrieb der Haupt-Tick in acht
// Sekunden 505 Mal und rund 95,6 kB Markup UNTER das Overlay. Das Overlay ist `position:fixed;
// inset:0` mit deckendem Hintergrund - niemand sah davon ein Zeichen. Die Rechenzeit fehlte genau
// dort, wo sie gebraucht wurde: in der Wiedergabe daneben.
//
// DIE GEFAHR BEI SO EINER BREMSE ist nicht, dass sie zu wenig bremst, sondern dass sie ZU VIEL
// bremst. Deshalb prüft dieser Test beide Richtungen:
//
//   1. Unter dem Overlay wird nichts mehr geschrieben.
//   2. Die Wiedergabe selbst animiert unverändert weiter (sonst hätte die Bremse das Falsche erwischt).
//   3. Die SPIELMECHANIK läuft weiter - Ressourcen wachsen, während die Wiedergabe läuft. Ein
//      Anhalten des Spiels wäre der schwerwiegendste denkbare Fehler dieser Änderung und würde
//      niemandem auffallen, der nur auf die Bildrate schaut.
//   4. Beim Schliessen wird sofort nachgezeichnet - sonst stünden dort bis zu eine Sekunde alte
//      Zahlen.
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

const BERICHT = {
  id:'b1', ts: Date.now(), type:'npc-attack', result:'win', npcName:'Kryllid-Nest (Stufe 4)',
  npcLevel:4, attackPower:52600, defensePower:38900, chancePct:71,
  fleet:{ jaeger:820, bomber:64, destroyers:30 }, ownLostShips:{ jaeger:96, bomber:4 },
  npcFleet:{ jaeger:600, cruisers:120 }, destroyedNpcShips:{ jaeger:600, cruisers:82 },
  fromPlanet:'Kepler-7b', debrisPlanet:'home', loot:{ erz:31000 },
  phasen:[{key:'anflug',name:'Anflug',chance:0.72,gewonnen:true,power:52600},
          {key:'hauptgefecht',name:'Hauptgefecht',chance:0.58,gewonnen:false,power:49100},
          {key:'entscheidung',name:'Entscheidung',chance:0.64,gewonnen:true,power:51300}]
};

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='reports')return j({reports:[BERICHT]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true,version:2});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|messages|ranking|wars|halloffame|bounty|friends/.test(p))return j([]);
  return j({});
};}

const save = () => JSON.stringify({ tutorialSeen:true,newbieWelcomeSeen:true,
  // Bewusst KLEINE Bestaende bei GROSSEM Lager: Mit dem urspruenglichen Spielstand stand die
  // Leiste auf "Lager voll / +0 pro Sekunde" - dann waechst nichts, und Punkt 3 haette einen
  // Stillstand gemeldet, den es gar nicht gab.
  resources:{energie:5000,erz:5000,kristalle:3000,deuterium:2000,antimaterie:500,forschungspunkte:800},
  buildings:{solar:22,mine:20,kristallmine:18,labor:14,lager:30,werft:14,turm:8,laser:10,schild:6},
  research:{rkampf:9,rsolar:9,rerz:8}, fleet:{jaeger:600,cruisers:120,missions:[]},
  colonies:{},activeBasePlanet:'home',player:{id:'u',name:'A',avatarKey:null},
  battleStats:{wins:9,losses:2},xp:260000,credits:180000,buffs:[],lastTick:Date.now(),
  colonyNames:{},modules:{},shipModules:{} });

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

(async()=>{
  const browser=await starteBrowser();
  const store={'kepler7-save-v3':save()};
  const ctx=await browser.newContext(Object.assign({},devices['Desktop Chrome'],{viewport:{width:1000,height:1200}}));
  const page=await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3200);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});

  // Ausgangswert der Ressourcenleiste, BEVOR die Wiedergabe startet.
  // Der gesamte Text der Leiste, formatunabhaengig - die Zahlen stehen dort abgekuerzt ("7.2k"),
  // ein Zahlenvergleich waere unnoetig zerbrechlich.
  const leiste = () => page.evaluate(()=>((document.getElementById('resbar')||{}).textContent||'').replace(/\s+/g,' ').trim());
  const leisteVor = await leiste();

  // Der Berichte-Bereich hat keinen Reiterknopf - er wird über das Kopfsymbol geöffnet.
  await page.evaluate(()=>{const x=document.getElementById('headerReportsBtn'); if(x) x.click();});
  await page.waitForTimeout(1500);
  const knopf = await page.evaluate(()=>{
    const b=[...document.querySelectorAll('button')].find(x=>/Zuschauen/i.test(x.textContent||''));
    if(!b) return false; b.click(); return true;
  });
  check('0: die Wiedergabe lässt sich über den „Zuschauen"-Knopf starten', knopf === true);
  await page.waitForTimeout(1200);
  const offen = await page.evaluate(()=>{const o=document.getElementById('battleModalOverlay'); return !!o && o.classList.contains('open');});
  check('0: das Overlay ist offen', offen === true);
  if (!offen){
    console.log('\nFEHLGESCHLAGEN (ohne offene Wiedergabe wäre jede weitere Prüfung ein falsches Grün)');
    await browser.close(); process.exit(1);
  }
  // Ohne deckenden Hintergrund wäre die ganze Bremse nicht zu rechtfertigen - das ist ihre
  // Voraussetzung, nicht ihr Ergebnis.
  const deckend = await page.evaluate(()=>{
    const o=document.getElementById('battleModalOverlay'); const st=getComputedStyle(o);
    const m=/rgba?\(([^)]+)\)/.exec(st.backgroundColor||'');
    const a=m ? Number((m[1].split(',')[3]||'1').trim()) : 1;
    return { position: st.position, alpha: a };
  });
  check('0: das Overlay bedeckt den Bildschirm wirklich (fixed, weitgehend deckend)',
    deckend.position === 'fixed' && deckend.alpha > 0.7, deckend);

  // --------------------------------------------------- 1-3) messen, während die Wiedergabe läuft
  const mess = await page.evaluate(()=>new Promise(f=>{
    const ov=document.getElementById('battleModalOverlay');
    const zahl = () => {
      // Die Ressourcenleiste ist die einzige Stelle, an der man von aussen sieht, ob die
      // SPIELMECHANIK laeuft - sie wird aus state gespeist.
      const el=document.querySelector('#resbar [data-res="erz"], #resbar');
      return el ? (el.textContent||'').replace(/\s+/g,'') : '';
    };
    let unten=0, untenBytes=0, imOverlay=0;
    const start = zahl();
    const mo=new MutationObserver(muts=>{
      for(const m of muts){
        const t=m.target;
        if(ov.contains(t)){ imOverlay++; continue; }
        unten++; if(t.innerHTML) untenBytes += t.innerHTML.length;
      }
    });
    mo.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>{ mo.disconnect(); f({ unten, kBunten:Number((untenBytes/1024).toFixed(1)), imOverlay, start, ende: zahl() }); }, 8000);
  }));

  // Die Schwelle ist bewusst nicht "genau 0": Unter dem Overlay laufen weiterhin einzelne Timer,
  // die NICHT der Sekunden-Takt sind (Kurzmeldungen, Abzeichen, Schutzschild-Restzeit). Die
  // erste Fassung verlangte 0 und schlug an einer einzigen Mutation mit 0 kB an - das haette den
  // Test wacklig gemacht, ohne ihn strenger zu machen. Die Aussage lautet: der SEKUNDENTAKT
  // schreibt die Oberflaeche nicht mehr neu. Zum Vergleich der gemessene Ausgangswert: 505
  // Mutationen und 95,6 kB in denselben acht Sekunden.
  check('1: der Sekunden-Takt schreibt unter dem Overlay nichts mehr neu (vorher 505 / 95,6 kB)',
    mess.unten < 25 && mess.kBunten < 2, { mutationen: mess.unten, kB: mess.kBunten });
  check('2: die Wiedergabe selbst animiert unverändert weiter', mess.imOverlay > 100, mess.imOverlay);

  // --------------------------------------------------- 4) Nachhol-Render beim Schliessen
  const nach = await page.evaluate(()=>new Promise(f=>{
    let n=0;
    const ov=document.getElementById('battleModalOverlay');
    const mo=new MutationObserver(muts=>{ for(const m of muts){ if(!ov.contains(m.target)) n++; } });
    mo.observe(document.body,{childList:true,subtree:true});
    const btn=document.getElementById('battleModalCloseBtn');
    if(btn) btn.click();
    setTimeout(()=>{ mo.disconnect(); f({ nachSchliessen:n, nochOffen: ov.classList.contains('open') }); }, 300);
  }));
  check('4: beim Schliessen wird sofort nachgezeichnet (kein Warten auf den nächsten Takt)',
    nach.nachSchliessen > 0 && nach.nochOffen === false, nach);

  // --------------------------------------------------- 3) Mechanik lief die ganze Zeit weiter
  // Nicht waehrend der Wiedergabe messbar - die Anzeige ist ja gerade gebremst, und der
  // gespeicherte Spielstand wird in diesem kurzen Fenster nicht zuverlaessig neu geschrieben
  // (ein erster Anlauf prueft genau das und meldete deshalb einen Fehler, den es auch OHNE die
  // Bremse gab). Der belastbare Nachweis kommt DANACH: Der Nachhol-Render zeigt den echten
  // Stand, und der muss hoeher sein als vor dem Oeffnen. Waere die Mechanik stehengeblieben,
  // stuende dort noch dieselbe Zahl.
  await page.waitForTimeout(1200);
  const leisteNach = await leiste();
  check('3: die Ressourcenleiste war ueberhaupt lesbar', leisteVor.length > 20, leisteVor.slice(0,60));
  check('3: die Spielmechanik lief waehrend der gebremsten Anzeige weiter',
    leisteVor.length > 20 && leisteNach !== leisteVor,
    { vorOeffnen: leisteVor.slice(0,70), nachSchliessen: leisteNach.slice(0,70) });

  // Und danach laeuft die Anzeige wieder normal.
  const wieder = await page.evaluate(()=>new Promise(f=>{
    let n=0;
    const mo=new MutationObserver(muts=>{ n+=muts.length; });
    mo.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>{ mo.disconnect(); f(n); }, 3000);
  }));
  check('4: nach dem Schliessen zeichnet der Takt wieder normal', wieder > 0, wieder);

  check('keine JS-Fehler', errs.length === 0, errs.slice(0,3));
  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
