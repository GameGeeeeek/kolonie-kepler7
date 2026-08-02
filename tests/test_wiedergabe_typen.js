// „Zuschauen" bei allen Kampfarten, die die Wiedergabe wirklich darstellen kann (02.08.2026).
//
// DER BEFUND: Die Bedingung für den Knopf stand als feste Liste ['raid','npc-attack',
// 'player-attack'] direkt im Markup der Berichtsliste - und kannte damit DREI Kampfarten weniger,
// als buildBattleSequence() daneben tatsächlich darstellen kann. Leerenriss,
// Piraten-Trümmerraub und der Angriff auf eine feindliche Allianzbasis liefen durch dieselbe
// Wiedergabe-Maschinerie, waren über die Oberfläche aber gar nicht erreichbar. Nachgemessen, bevor
// etwas geändert wurde: In einem Berichte-Bestand aus genau diesen drei Arten gab es NULL Knöpfe.
//
// Der wiederkehrende Fehlertyp dieses Projekts in Reinform: nicht die kaputte Mechanik - die
// stimmte -, sondern eine zweite Stelle, die die alte Annahme behielt.
//
// GEPRÜFT WIRD:
//   1. istAbspielbar() selbst, ausgeführt - die Bedingungen sind der eigentliche Inhalt.
//   2. Für jede der drei neuen Arten: Knopf da, Wiedergabe öffnet, kein Fehler.
//   3. Die Wiedergabe NENNT den Gegner. Ein Knopf, der zu einem Bildschirm mit „Gegner" führt,
//      wäre nur halb gebaut - diese drei Arten führen kein targetName.
//   4. Gegenprobe: Was kein Gefecht war, bekommt weiterhin KEINEN Knopf.
const fs = require('fs');
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ------------------------------------------------------------- 1) Die Bedingung, ausgeführt
{
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  const liste = (src.match(/const ABSPIELBARE_BERICHTE = \[[^\]]*\];/) || [''])[0];
  const a = src.indexOf('function istAbspielbar(r){');
  const fnQuelle = a < 0 ? '' : src.slice(a, src.indexOf('\n  }', a) + 4);
  check('1: istAbspielbar() gefunden', fnQuelle.length > 200, fnQuelle.length);
  check('1: die Typenliste gefunden', liste.length > 40);

  const f = new Function(liste + '\n' + fnQuelle + '\n return istAbspielbar;')();
  check('1: Überfall mit Angreiferflotte', f({ type:'raid', fleet:{jaeger:5} }) === true);
  check('1: Überfall, bei dem nur die eigene stationierte Flotte bekannt ist',
    f({ type:'raid', stationedFleet:{jaeger:5} }) === true);
  check('1: NPC-Kampf', f({ type:'npc-attack', fleet:{jaeger:5} }) === true);
  check('1: Spielerangriff', f({ type:'player-attack', fleet:{jaeger:5} }) === true);
  check('1: Leerenriss', f({ type:'void-rift', fleet:{jaeger:5} }) === true);
  check('1: Allianzbasis-Angriff', f({ type:'alliance-base-attack', fleet:{jaeger:5} }) === true);
  check('1: Piraten-Trümmerraub, gewonnen', f({ type:'pirate-debris-raid', result:'win', fleet:{jaeger:5} }) === true);
  // 'escaped' ist gar kein Gefecht - die Piraten wurden nie abgefangen. Ein Knopf dorthin
  // fuehrte zu einer Wiedergabe ohne Kampf.
  check('1: entkommener Trümmerraub ist kein Gefecht -> kein Knopf',
    f({ type:'pirate-debris-raid', result:'escaped', fleet:{jaeger:5} }) === false);
  check('1: automatisch abgefangener Trümmerraub ebenfalls nicht',
    f({ type:'pirate-debris-raid', result:'ki-intercept', fleet:{jaeger:5} }) === false);
  check('1: Expedition NUR mit echter Begegnung',
    f({ type:'expedition', encountered:true, fleet:{jaeger:5} }) === true &&
    f({ type:'expedition', encountered:false, fleet:{jaeger:5} }) === false);
  check('1: ohne eigene Flotte gibt es nichts zu zeigen',
    f({ type:'void-rift' }) === false && f({ type:'npc-attack' }) === false);
  check('1: ein Spionagebericht ist kein Gefecht', f({ type:'spy-report', fleet:{jaeger:5} }) === false);
  check('1: ohne Bericht kein Absturz', f(null) === false && f(undefined) === false);
}

// ------------------------------------------------------------- 2-4) im Browser
const grund = { fleet:{jaeger:400,cruisers:80,destroyers:20}, ownLostShips:{jaeger:40},
                fromPlanet:'Kepler-7b', debrisPlanet:'home' };
const BERICHTE = [
  Object.assign({ id:'v', ts:Date.now(), type:'void-rift', result:'win', targetPlanet:'home',
                  attackPower:44000, defensePower:61000, chancePct:26, shards:3 }, grund),
  Object.assign({ id:'p', ts:Date.now(), type:'pirate-debris-raid', result:'win', targetPlanet:'home',
                  attackPower:9000, defensePower:4000, destroyedShips:{jaeger:60}, taken:{erz:1000} }, grund),
  Object.assign({ id:'a', ts:Date.now(), type:'alliance-base-attack', result:'win', targetTag:'NYX',
                  attackPower:50000, defensePower:20000, damage:1200, hullAfter:3000, hullMax:5000 }, grund),
  // Gegenprobe: kein Gefecht, darf keinen Knopf bekommen.
  Object.assign({ id:'e', ts:Date.now(), type:'pirate-debris-raid', result:'escaped',
                  targetPlanet:'home', taken:{erz:500} }, grund),
];

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='reports')return j({reports:BERICHTE});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}
const save=()=>JSON.stringify({tutorialSeen:true,newbieWelcomeSeen:true,
  resources:{energie:5000,erz:5000,kristalle:3000,deuterium:2000,antimaterie:500,forschungspunkte:800},
  buildings:{solar:22,mine:20,kristallmine:18,labor:14,lager:30,werft:14,turm:8,laser:10,schild:6},
  research:{rkampf:9}, fleet:{jaeger:600,missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, battleStats:{wins:9,losses:2}, xp:260000, credits:180000,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

(async()=>{
  const browser=await starteBrowser();
  const ctx=await browser.newContext(Object.assign({},devices['Desktop Chrome'],{viewport:{width:1000,height:1200}}));
  const page=await ctx.newPage(); const errs=[];
  page.on('pageerror',e=>errs.push(String(e)));
  page.on('console',m=>{if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text()))errs.push(m.text());});
  await page.route('**/api/**', backend({'kepler7-save-v3':save()}));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3200);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  // Der Berichte-Bereich hat keinen Reiterknopf - er wird über das Kopfsymbol geöffnet.
  await page.evaluate(()=>{const x=document.getElementById('headerReportsBtn'); if(x) x.click();});
  await page.waitForTimeout(1600);

  const knoepfe = await page.evaluate(()=>[...document.querySelectorAll('[data-watch-battle]')].map(b=>b.getAttribute('data-watch-battle')));
  check('2: alle drei Kampfarten haben einen Knopf', ['v','p','a'].every(id=>knoepfe.includes(id)), knoepfe);
  check('4: der entkommene Trümmerraub hat KEINEN Knopf', !knoepfe.includes('e'), knoepfe);

  const erwartet = { v:'Leerenriss', p:'Piraten-Trümmerräuber', a:'Allianzbasis' };
  for (const id of ['v','p','a']){
    const geklickt = await page.evaluate((rid)=>{
      const b=[...document.querySelectorAll('[data-watch-battle]')].find(x=>x.getAttribute('data-watch-battle')===rid);
      if(!b) return false; b.click(); return true;
    }, id);
    await page.waitForTimeout(1000);
    const zustand = await page.evaluate(()=>({
      offen: document.getElementById('battleModalOverlay').classList.contains('open'),
      titel: (document.getElementById('battleModalTitle')||{}).textContent||''
    }));
    check('2: '+id+' - die Wiedergabe öffnet sich', geklickt && zustand.offen === true, zustand);
    // 3) Der Gegner muss BENANNT sein. Diese drei Arten fuehren kein targetName; ohne eigene
    //    Zuordnung stuende dort schlicht "Gegner".
    check('3: '+id+' - die Wiedergabe nennt den Gegner ('+erwartet[id]+')',
      zustand.titel.includes(erwartet[id]), zustand.titel.slice(0,70));
    await page.evaluate(()=>{const c=document.getElementById('battleModalCloseBtn'); if(c) c.click();});
    await page.waitForTimeout(400);
  }

  check('keine JS-Fehler in der ganzen Runde', errs.length === 0, errs.slice(0,3));
  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
