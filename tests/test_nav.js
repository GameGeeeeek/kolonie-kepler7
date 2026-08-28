const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const path=require('path');
const FILE='file://'+path.resolve(SPIELDATEI);
function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}
(async()=>{
const b=await starteBrowser();
let fail=false; const check=(n,c,x)=>{console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):''));fail=fail||!c;};
const store={}; const errs=[];
store['kepler7-save-v3']=JSON.stringify({tutorialSeen:true,newbieWelcomeSeen:true,
 resources:{energie:4000,erz:5000,kristalle:3000,deuterium:2000,antimaterie:90,forschungspunkte:200},
 buildings:{solar:8,mine:8,labor:5},research:{},fleet:{jaeger:30,missions:[]},colonies:{},activeBasePlanet:'home',
 player:{id:'u',name:'A',allianceTag:'',avatarKey:null},battleStats:{wins:0,losses:0},xp:5000,buffs:[],lastTick:Date.now(),colonyNames:{},colonyNotes:{}});
const ctx=await b.newContext({viewport:{width:900,height:900}}); const page=await ctx.newPage();
page.on('pageerror',e=>errs.push(String(e)));
await page.route('**/api/**',backend(store));
await page.addInitScript(()=>{localStorage.setItem('kepler7_token','tok');});
await page.goto(FILE); await page.waitForTimeout(1800);
await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay'].forEach(i=>{const o=document.getElementById(i);if(o)o.style.display='none';});});
const map=await page.evaluate(()=>{
  const o={}; document.querySelectorAll('.tab-btn').forEach(b=>{o[b.getAttribute('data-tab')]=b.getAttribute('data-tab-domain');});
  return o;});
// Geprueft wird die EIGENSCHAFT, nicht die Anzahl: "12" war eine Momentaufnahme und ist mit dem
// dreizehnten Reiter (Sammlung, 28.08.2026) auf voellig korrektem Code durchgefallen (Hausregel 3).
// Die vier Domaenen bleiben dagegen eine echte Regel - eine fuenfte muesste einen Trenner mitbringen.
const DOMAENEN = ['kolonie','erkundung','gemeinschaft','meta'];
check('jeder Reiter hat eine Domaene', Object.keys(map).length>0 && Object.values(map).every(Boolean), map);
check('jede Domaene ist eine der vier bekannten',
  Object.values(map).every(d => DOMAENEN.includes(d)), map);
// Die Domaenen muessen zusammenhaengend stehen - sonst passen die Trenner nicht mehr zu den Gruppen.
const order=await page.evaluate(()=>[...document.querySelectorAll('.tab-btn')].map(b=>b.getAttribute('data-tab')));
const folge = order.map(t => map[t]);
const bloecke = folge.filter((d,i) => d !== folge[i-1]);
check('Zuordnung entspricht den vorhandenen Trennern',
  new Set(bloecke).size === bloecke.length, { bloecke, map });
// Die Reihenfolge der BESTANDS-Reiter ist Muskelerinnerung und darf sich nicht aendern; ein
// ANGEHAENGTER Reiter verletzt das nicht, ein umsortierter sehr wohl. Deshalb Praefix statt
// Gleichheit - und die Gegenrichtung mitgeprueft: der Bestand darf auch nicht schrumpfen.
const BESTAND = 'basis,verteidigung,forschung,flotte,expedition,karte,galaxie,allianz,offiziere,markt,punkte,fortschritt'.split(',');
check('Reihenfolge der Bestands-Reiter unveraendert',
  BESTAND.every((t,i) => order[i] === t), order.join(','));
check('kein Bestands-Reiter ist verschwunden',
  BESTAND.every(t => order.includes(t)), BESTAND.filter(t => !order.includes(t)));
// Aktiver Reiter je Domaene muss die Domaenenfarbe tragen
const want={basis:'rgb(127, 119, 221)',karte:'rgb(92, 225, 255)',allianz:'rgb(250, 199, 117)',fortschritt:'rgb(93, 202, 165)'};
for(const [tab,col] of Object.entries(want)){
  // Klicken und dann POLLEN, bis die erwartete Farbe wirklich anliegt. Feste Wartezeiten waren hier
  // zweimal unzuverlaessig: mal war die active-Klasse noch nicht gesetzt, mal lief noch der
  // 0.2s-Farbuebergang (gemessen wurde dann rgba(...,0.98)). Verglichen werden die RGB-Kanaele.
  const want3 = (String(col).match(/\d+/g)||[]).slice(0,3).join(',');
  await page.evaluate(t=>{const x=document.querySelector('.tab-btn[data-tab="'+t+'"]'); if(x) x.click();}, tab);
  let got='(nie gemessen)', ok=false;
  for (let i=0;i<40 && !ok;i++){
    got = await page.evaluate(t=>{const x=document.querySelector('.tab-btn[data-tab="'+t+'"]');
      return x ? getComputedStyle(x).borderTopColor : 'ELEMENT FEHLT';}, tab);
    ok = (String(got).match(/\d+/g)||[]).slice(0,3).join(',') === want3;
    if(!ok) await page.waitForTimeout(150);
  }
  check('aktiver Reiter "'+tab+'" traegt Domaenenfarbe', ok, {got,col});
}
// Farbfuss auch im RUHENDEN Zustand vorhanden (der eigentliche Orientierungsgewinn)
const rest=await page.evaluate(()=>{const x=document.querySelector('.tab-btn[data-tab="markt"]');
  const s=getComputedStyle(x,'::after'); return {content:s.content, bg:s.backgroundColor, op:s.opacity};});
check('ruhender Reiter hat Farbfuss', rest.bg==='rgb(93, 202, 165)' && parseFloat(rest.op)>0, rest);
check('keine JS-Fehler', errs.length===0, errs.slice(0,3));
await ctx.close(); await b.close();
console.log(fail?'\nFAIL':'\nPASS'); process.exit(fail?1:0);})();
