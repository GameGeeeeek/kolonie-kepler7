// Pflicht-Sweep (CLAUDE.md Schritt 3): Boot + alle Tabs durchklicken, auf Konsolenfehler prüfen.
// Realistischer Spielstand: mehrere Kolonien inkl. Mond, aktive Forschung/Missionen/Bauqueue.
//
// BEWUSSTE GRENZE DIESES TESTS (26.07.2026): Die Attrappe hier antwortet auf die serverabhängigen
// Endpunkte absichtlich mager (`return j({})`). Damit prüft der Sweep den Solo-/Offline-Pfad - also
// dass alle Tabs auch ohne Serverdaten fehlerfrei aufgehen. Das ist wertvoll, hat aber einen blinden
// Fleck: Anzeigebereiche, die bei fehlenden Daten in einen Leerzustand gehen, führen ihren
// eigentlichen Rendercode nie aus. Genau darin steckte der Fraktionsladen-Fehler (v8.298.22 bis
// v8.298.28) monatelang unentdeckt - wo nichts rendert, kann auch nichts krachen.
//
// Die Gegenprobe MIT gefüllten Serverdaten steht in tests/test_serverbereiche.js. Dieser Sweep hier
// soll bewusst NICHT umgestellt werden: die beiden Tests decken zwei verschiedene Zustände ab, und
// der leere ist der, in dem echte Spieler ohne Serververbindung sitzen.
const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, ueberspringen } = require('./lib/umgebung');
const path = require('path');
const FILE = SPIEL_URL;
function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'AdmiralX',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}
(async () => {
  const browser = await starteBrowser();
  let fail=false; const errs=[], warns=[];
  const store={};
  const now=Date.now();
  const save = { tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{energie:48000,erz:52000,kristalle:31000,deuterium:20000,antimaterie:900,forschungspunkte:2200},
    buildings:{solar:18,mine:17,kristallmine:15,deutsynth:12,labor:10,lager:12,werft:9,hangar:6,habitat:8,geschuetz:8,schild:6},
    research:{rsolar:8,rerz:8,rkampf:6,rkampf2:4,rschildmatrix:5,rbauplan:5,rmodultechnik:3},
    activeResearch:{ key:'rkristall', endsAt: now+600000 },
    // Bauaufträge in der ECHTEN Form, die das Spiel erzeugt (cost/label/totalDur/paid/endTime) -
    // ohne cost wirft activateQueuedJobs() beim Tick, weil canAfford(job.cost) Object.entries(undefined) macht.
    constructionQueue:[
      {kind:'building',key:'mine',planet:'home',qty:1,label:'Erzmine',icon:'ti-pick',
       cost:{erz:200,energie:120},totalDur:300,paid:true,startTime:now,endTime:now+300000},
      {kind:'ship',key:'jaeger',planet:'home',qty:5,label:'Jäger',icon:'ti-rocket',
       cost:{erz:500,energie:300},totalDur:225,paid:true,startTime:now,endTime:now+120000}],
    fleet:{jaeger:320,bomber:90,zerstoerer:45,schlachtschiff:28,waechter:60,traeger:12,
      missions:[{type:'expedition',planet:'home',endsAt:now+900000,fleet:{jaeger:20}}]},
    colonies:{}, activeBasePlanet:'home',
    player:{id:'u',name:'AdmiralX',allianceTag:'VOID',avatarKey:'crown'},
    battleStats:{wins:42,losses:7}, expeditionsCompleted:18, ascension:{count:3,essence:0,tree:{}},
    achievements:{a1:true,a2:true}, xp:52000, credits:184000, prestige:4, buffs:[], lastTick:now,
    officers:{admiral:6,ingenieur:5}, commandPoints:12, colonyNames:{}, colonyNotes:{}, shipSkin:'gold' };
  store['kepler7-save-v3']=JSON.stringify(save);
  const ctx=await browser.newContext({viewport:{width:900,height:1000}}); const page=await ctx.newPage();
  page.on('pageerror',e=>errs.push('pageerror: '+e));
  // 404er ignorieren: das Mock-Backend antwortet auf unbekannte storage-Schlüssel bewusst mit 404
  // (im echten Spiel ebenfalls der Normalfall für noch nie geschriebene Schlüssel).
  page.on('console',m=>{ const t=m.text();
    if(m.type()==='error' && !/404|Failed to load resource/.test(t)
        // Versions-Pruefung holt per fetch die eigene Datei - ueber file:// blockiert das die
        // CORS-Regel des Browsers. Reines Testumgebungs-Rauschen, ueber nginx laeuft es.
        && !/CORS policy|Cross origin requests/.test(t)) errs.push('console: '+t);
    if(m.type()==='warning') warns.push(t); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>{ localStorage.setItem('kepler7_token','tok'); });
  await page.goto(FILE); await page.waitForTimeout(2000);
  await page.evaluate(()=>{ ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}); });
  // ---- Boot-Fehler sind toedlich und wurden bis zum 01.08.2026 NICHT gemeldet ----------------
  // Der Tab-Durchlauf unten vergleicht die Fehlerzahl nur VOR und NACH jedem Klick. Ein Fehler
  // beim LADEN steckt schon vor dem ersten Vergleich in errs und setzt fail deshalb nie - und
  // weil die Tab-Knoepfe statisches HTML sind, existieren sie auch dann, wenn das Skript gar nicht
  // initialisiert hat. Ein Klick darauf tut dann nichts, wirft nichts, und JEDER Tab meldet OK.
  //
  // Real passiert am 01.08.2026: Eine const wurde 14.000 Zeilen nach ihrer ersten Verwendung
  // deklariert ("Cannot access before initialization"). Das ganze Spiel startete nicht - der Sweep
  // meldete SWEEP PASS mit allen Tabs gruen. Genau deshalb steht diese Pruefung VOR dem Durchlauf.
  const bootFehler = errs.slice();
  console.log((bootFehler.length?'FAIL':'OK  ')+' - Boot ohne Skriptfehler'
    + (bootFehler.length?' | '+bootFehler.slice(0,2).join(' ~ '):''));
  if (bootFehler.length) fail = true;

  const tabs = await page.evaluate(()=>Array.from(document.querySelectorAll('.tab-btn')).map(b=>b.getAttribute('data-tab')));
  console.log('Tabs gefunden:', tabs.length, tabs.join(','));
  for (const t of tabs){
    const before = errs.length;
    // Der Rueckgabewert sagt, ob der Klick tatsaechlich den aktiven Tab gesetzt hat. Das ist die
    // zweite Haelfte der Boot-Absicherung und unabhaengig von der Konsole: Die Tab-Knoepfe stehen
    // im statischen HTML, ein toter Skriptblock laesst sie also stehen - anklickbar, aber wirkungslos.
    // Ohne diese Pruefung meldet der Sweep bei einem nicht initialisierten Spiel jeden Tab als OK.
    const gewechselt = await page.evaluate(tt=>{
      const b=document.querySelector('.tab-btn[data-tab="'+tt+'"]'); if(b)b.click();
      const a=document.querySelector('.tab-btn.active');
      return !!a && a.getAttribute('data-tab')===tt;
    }, t);
    await page.waitForTimeout(700);
    const ok = errs.length===before && gewechselt;
    if (!gewechselt) errs.push('Tab "'+t+'" liess sich nicht aktivieren - Skript tot?');
    console.log((ok?'OK  ':'FAIL')+' - Tab '+t+(ok?'':' | '+errs.slice(before).join(' ~ ')));
    if(!ok) fail=true;
  }
  // Unterreiter von Flotte und Offiziere ebenfalls durchklicken
  for (const sel of ['[data-fleet-subtab]','[data-officer-subtab]']){
    const keys = await page.evaluate(s=>Array.from(document.querySelectorAll(s)).map(b=>b.getAttribute(s.replace(/[\[\]]/g,''))), sel);
    for (const k of keys){
      const before=errs.length;
      await page.evaluate(([s,kk])=>{ const b=document.querySelector(s+'="'+kk+'"]'.replace(']','')+']'); if(b)b.click(); }, [sel.slice(0,-1), k]);
      await page.waitForTimeout(400);
      const ok=errs.length===before;
      console.log((ok?'OK  ':'FAIL')+' - Unterreiter '+k+(ok?'':' | '+errs.slice(before).join(' ~ ')));
      if(!ok) fail=true;
    }
  }
  console.log('\nKonsolenfehler gesamt:', errs.length);
  if (errs.length) console.log(errs.slice(0,6).join('\n'));
  await ctx.close(); await browser.close();
  console.log(fail?'\nSWEEP FAIL':'\nSWEEP PASS'); process.exit(fail?1:0);
})();
