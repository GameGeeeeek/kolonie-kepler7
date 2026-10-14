'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {WURZEL,SPIELDATEI,SERVER_JS}=require('./lib/spieldatei');
const {starteBrowser}=require('./lib/umgebung'),{pointer,boolean,delay}=require('./lib/ship-raster-fixture');
const {fixture}=require('./lib/report-overview-fixture'),{canvasData}=require('./test_ship_raster_art');
const manifest=require('./lib/report-overview-manifest.json');
const keys=['cards','losses','raster','loot','zero','legacy','malformed','incomingLoot','percentage','incomingPhase','outgoingPhase','salvage','unpaid','garrison','escort','rift','cancelled','negative','noncombat','actions','replay','logbook','escape','refresh','stable','english','mobile','hashes','script','http'];
assert.equal(manifest.length,30);assert.equal(new Set(manifest).size,30);
const labels=Object.fromEntries(keys.map((key,i)=>[key,manifest[i]]));
module.exports={manifest,labels};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const runtimeFiles=[SPIELDATEI,path.join(WURZEL,'kepler-graphics.css'),path.join(WURZEL,'service-worker.js'),path.join(WURZEL,'kepler-english.json'),...fs.readdirSync(WURZEL).filter(n=>/^kepler-gfx-[a-z-]+\.(?:png|webp)$/.test(n)).map(n=>path.join(WURZEL,n))];
if(process.env.KEPLER_BACKEND_SERVER)assert(fs.existsSync(process.env.KEPLER_BACKEND_SERVER),'Configured backend source must exist');
if(SERVER_JS)runtimeFiles.push(SERVER_JS);
const files=[...runtimeFiles,__filename,path.join(WURZEL,'tests/lib/report-overview-fixture.js'),path.join(WURZEL,'tests/lib/report-overview-manifest.json'),path.join(WURZEL,'tests/lib/ship-raster-fixture.js'),path.join(WURZEL,'tests/test_ship_raster_art.js'),path.join(WURZEL,'marketing-screenshots.js'),path.join(WURZEL,'docs/ship-art-package.json')];
const hashRows=()=>Object.fromEntries(files.map(file=>[path.relative(WURZEL,file),sha(fs.readFileSync(file))]));
const phase=(name,won)=>({name,gewonnen:won,chance:.7,icon:'ti-sword'});
const phaseData=[phase('Anflug',true),phase('Beschuss',false),phase('Entscheidung',true)];
const literal='<b data-report-injected="1">Glanz & Mut</b>';
// This is a valid native colony name: renameColony accepts trimmed names up to 24 characters.
const colonyLiteral='<b data-rp>Kepler</b>';
const report=(id,extra={})=>({id,time:Date.now()-120000,type:'npc-attack',result:'win',npcName:'Void-Marodeure',npcLevel:1,targetId:'raider1',fromPlanet:'Kepler Prime',attackPower:48213,defensePower:31877,chancePct:82,fleet:{jaeger:40},ownLostShips:{jaeger:7},loot:{erz:123},phasen:phaseData,cargoCapacity:5000,flightTime:1260,...extra});
const inputReports=()=>[
 report('overview-npc',{credits:15,battlePoints:2,kiText:'Logbuch: '+literal,fromPlanet:colonyLiteral}),
 report('overview-zero',{ownLostShips:{},loot:{},phasen:[]}),
 report('overview-legacy',{ownLostShips:undefined,loot:undefined,phasen:undefined}),
 report('overview-malformed',{result:'loss',ownLostShips:'unknown',loot:null,phasen:'old'}),
 report('overview-incoming',{type:'attack-received',result:'loss',attackerName:literal,attackerId:'other',stolen:{erz:233},ownLostShips:undefined,loot:undefined,defenderLossPct:.25}),
 report('overview-outgoing',{type:'attack-sent',targetName:'Asterion',stolen:{erz:9},loot:undefined,ownLostShips:{jaeger:2}}),
 report('overview-salvage',{type:'nest-angriff',system:'kepler',systemName:'Kepler-System',volk:'xantheer',gefallen:true,anteil:.16,eigeneVerluste:{jaeger:2},ownLostShips:undefined,loot:undefined,phasen:undefined}),
 report('overview-unpaid',{type:'nest-angriff',system:'kepler',systemName:'Kepler-System',volk:'xantheer',gefallen:false,anteil:.25,eigeneVerluste:{jaeger:2},ownLostShips:undefined,loot:undefined,phasen:undefined,lp:100,lpMax:200}),
 report('overview-garrison',{type:'vorposten-verteidigung',gefallen:true,system:'kepler',systemName:'Kepler-System',garnisonVerloren:{jaeger:4},ownLostShips:undefined,loot:undefined,phasen:undefined}),
 report('overview-escort',{type:'asteroid-verteidigung',rechtWeg:true,system:'kepler',ort:'Guertel',verluste:{jaeger:5},verlorenGesamt:5,ownLostShips:undefined,loot:undefined,phasen:undefined}),
 report('overview-rift',{type:'void-rift',result:'collapsed',targetPlanet:'home',lostAntimaterie:15,ownLostShips:undefined,loot:undefined,phasen:undefined}),
 report('overview-cancelled',{keinKampf:true,grund:'Ziel nicht mehr erreichbar',ownLostShips:undefined,loot:undefined,phasen:undefined}),
 report('overview-negative',{type:'raid',result:'loss',faction:'Void-Marodeure',targetPlanet:'home',ownLostShips:{jaeger:18},lostResources:{erz:5},lossPct:5,loot:undefined}),
 report('overview-weekly',{type:'weekly-reward',rank:1,rewardLabel:'10 Kredite'}),
 report('overview-dynamic',{type:'alliance-base-defense',result:'loss',damage:0,ownLostShips:undefined,loot:undefined,phasen:[phase(literal,true)],resources:{[literal]:3}}),
 report('overview-defense-ok',{type:'attack-received',result:'win',attackerName:'Asterion',ownLostShips:{},loot:undefined,stolen:undefined,defendReward:10,phasen:[phase('Anflug',false),phase('Beschuss',true),phase('Entscheidung',false)]})
];
const selector=id=>'#reportsBox [data-report-card="'+id+'"]';
async function read(page,id){return page.locator(selector(id)).evaluateAll(es=>{const e=es[0];if(!e)return null;const metric=key=>{const box=e.querySelector('[data-report-metric="'+key+'"]');return box?{label:box.querySelector('dt')?.textContent||'',text:box.querySelector('dd')?.textContent.replace(/\s+/g,' ').trim()||''}:null;};return {overview:!!e.querySelector('.report-overview'),losses:metric('losses'),loot:metric('loot'),phases:metric('phases'),text:e.textContent,html:e.innerHTML,actions:[...e.querySelectorAll('button')].map(b=>[...b.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value).join('|')),logbook:e.querySelector('.ki-logbuch')?.textContent||''};});}
async function main(){
 const before=hashRows(),records=[],runs=[],browser=await starteBrowser();
 const check=(key,ok,detail)=>{const record={name:labels[key],ok:!!ok};records.push(record);console.log((record.ok?'OK':'FAIL')+' - '+record.name+(detail!==undefined?' | '+JSON.stringify(detail):''));};
 try{
  const reports=inputReports(),run=await fixture(browser,{reports});runs.push(run);
  check('cards',await run.page.locator('#reportsBox [data-report-card] .report-overview').count()===15&&await run.page.locator(selector('overview-weekly')+' .report-overview').count()===0,{reports:reports.length});
  let npc=await read(run.page,'overview-npc');
  check('losses',npc?.losses?.label==='Eigene Verluste'&&npc.losses.text.includes('7 Schiffe')&&npc.losses.text.includes('7 Jäger'),npc?.losses);
  const artSelector=selector('overview-npc')+' .report-overview [data-ship-key="jaeger"]';await run.page.locator(selector('overview-npc')).scrollIntoViewIfNeeded();
  const ready=await boolean(run.page,sel=>document.querySelector(sel)?.dataset.shipArtReady==='true',artSelector,8000);
  const pkg=JSON.parse(fs.readFileSync(path.join(WURZEL,'docs/ship-art-package.json'),'utf8')),group=pkg.groups.find(g=>g.tiles.some(t=>t.key==='jaeger')),art={stem:group.stem,rect:group.tiles.find(t=>t.key==='jaeger').rect},pixels=ready?await canvasData(run.page,artSelector,art):null;
  check('raster',!!pixels&&pixels.ready==='true'&&pixels.atlas===art.stem&&pixels.crop===art.rect.join(',')&&pixels.count>0&&pixels.diff<18,pixels);
  check('loot',npc?.loot?.text.includes('123 Erz')&&npc.loot.text.includes('+15 Kredite')&&npc.loot.text.includes('+2 Kampfpunkte'),npc?.loot);
  const zero=await read(run.page,'overview-zero');check('zero',zero?.losses?.text==='0 Schiffe'&&zero.loot?.text==='Keine'&&zero.phases?.text==='Keine Phasen',zero);
  const legacy=await read(run.page,'overview-legacy');check('legacy',[legacy?.losses,legacy?.loot,legacy?.phases].every(m=>m?.text==='Nicht überliefert'),legacy);
  const malformed=await read(run.page,'overview-malformed');check('malformed',[malformed?.losses,malformed?.loot,malformed?.phases].every(m=>m?.text==='Nicht überliefert'),malformed);
  const incoming=await read(run.page,'overview-incoming');
  check('incomingLoot',incoming?.loot?.label==='Ressourcenverlust'&&incoming.loot.text==='233 Erz',incoming?.loot);
  check('percentage',incoming?.losses?.text==='~25% der Schiffe'&&!incoming.losses.text.includes('0 Schiffe'),incoming?.losses);
  check('incomingPhase',incoming?.phases?.label==='Phasen des Angreifers'&&incoming.phases.text==='2 / 3 gewonnen',incoming?.phases);
  const outgoing=await read(run.page,'overview-outgoing');check('outgoingPhase',outgoing?.phases?.label==='Deine Kampfphasen'&&outgoing.phases.text==='2 / 3 gewonnen',outgoing?.phases);
  const salvage=await read(run.page,'overview-salvage');check('salvage',salvage?.loot?.label==='Bergungsanteil'&&salvage.loot.text==='16%Unter Belohnungen',salvage?.loot);
  const unpaid=await read(run.page,'overview-unpaid');check('unpaid',unpaid?.loot?.label==='Beute und Belohnung'&&unpaid.loot.text==='Nicht überliefert'&&!unpaid.loot.text.includes('Unter Belohnungen'),unpaid?.loot);
  const garrison=await read(run.page,'overview-garrison');check('garrison',garrison?.losses?.label==='Garnisonsverluste'&&garrison.losses.text.includes('4 Schiffe'),garrison?.losses);
  const escort=await read(run.page,'overview-escort');check('escort',escort?.losses?.label==='Eigene Verluste'&&escort.losses.text.includes('5 Schiffe'),escort?.losses);
  const rift=await read(run.page,'overview-rift');check('rift',rift?.loot?.label==='Ressourcenverlust'&&rift.loot.text==='15 Antimaterie',rift?.loot);
  const cancelled=await read(run.page,'overview-cancelled');check('cancelled',cancelled?.losses?.text==='0 Schiffe'&&cancelled.loot?.text==='Keine'&&cancelled.phases?.text==='Kein Kampf',cancelled);
  const negative=await read(run.page,'overview-negative');check('negative',negative?.losses?.text.includes('18 Schiffe')&&negative.loot?.label==='Ressourcenverlust'&&negative.loot.text==='5 Erz',negative);
  const weekly=await read(run.page,'overview-weekly');check('noncombat',!!weekly&&!weekly.overview&&weekly.text.includes('10 Kredite')&&weekly.text.includes('Platz 1'),weekly);
  check('actions',!!npc&&npc.actions.some(s=>s==='data-watch-battle=overview-npc')&&npc.actions.some(s=>s==='data-share-battle=overview-npc')&&npc.actions.some(s=>s==='data-rebuild-losses=overview-npc')&&salvage?.actions.some(s=>s==='data-zeig-fundort=overview-salvage'),{npc:npc?.actions,salvage:salvage?.actions});
  await pointer(run.page,selector('overview-npc')+' [data-watch-battle]');await run.page.locator('#battleModalOverlay').waitFor({state:'visible'});
  const replayControls=await run.page.locator('#osBtnNeustart,#osBtnPause,#osBtnTempo,#osBtnEnde').count();
  await pointer(run.page,'#osBtnEnde');await run.page.locator('#battleModalOverlay').waitFor({state:'hidden'});
  check('replay',replayControls===4&&await run.page.locator('#reportsBox').isVisible(),{replayControls});
  const dynamic=await read(run.page,'overview-dynamic');
  check('logbook',npc?.logbook.includes(literal)&&npc?.text.includes(colonyLiteral)&&dynamic?.text.includes(literal)&&await run.page.locator('#reportsBox [data-report-injected],#reportsBox [data-rp]').count()===0,{logbook:npc?.logbook,colonyText:npc?.text,dynamicText:dynamic?.text});
  check('escape',dynamic?.loot?.text.includes(literal)&&await run.page.locator('#reportsBox .report-overview [data-report-injected]').count()===0,dynamic?.loot);
  run.setReports(reports.map(r=>r.id==='overview-npc'?{...r,ownLostShips:{jaeger:9},loot:{erz:345},phasen:[phase('Anflug',false),phase('Beschuss',false),phase('Entscheidung',true)]}:r));
  const reportGets=run.requests.filter(r=>r.path==='/api/reports'&&r.method==='GET').length;
  await pointer(run.page,'#refreshReportsBtn');
  const refreshed=await boolean(run.page,sel=>document.querySelector(sel+' [data-report-metric="losses"] dd')?.textContent.includes('9 Schiffe'),selector('overview-npc'),8000);npc=await read(run.page,'overview-npc');
  check('refresh',refreshed&&npc?.loot?.text.includes('345 Erz')&&npc.phases?.text==='1 / 3 gewonnen'&&run.requests.filter(r=>r.path==='/api/reports'&&r.method==='GET').length>reportGets,npc);
  const stable=await run.page.evaluate(sel=>new Promise(resolve=>{const box=document.getElementById('reportsBox'),node=document.querySelector(sel+' .report-overview');let writes=0;const observer=new MutationObserver(rows=>{writes+=rows.filter(r=>r.type==='childList'&&r.target===box).length;});observer.observe(box,{childList:true});setTimeout(()=>{observer.disconnect();resolve({exists:!!node,same:node===document.querySelector(sel+' .report-overview'),connected:!!node?.isConnected,writes});},1200);}),selector('overview-npc'));
  check('stable',stable.exists&&stable.same&&stable.connected&&stable.writes===0,stable);
  const english=await fixture(browser,{reports,language:'en'});runs.push(english);const enNpc=await read(english.page,'overview-npc'),enIncoming=await read(english.page,'overview-incoming'),enOld=await read(english.page,'overview-legacy'),enShare=await read(english.page,'overview-salvage');
  check('english',await english.page.locator('html').getAttribute('lang')==='en'&&enNpc?.losses?.label==='Your losses'&&enNpc.losses.text.includes('7 Ships')&&enNpc.loot?.label==='Loot and rewards'&&enNpc.loot.text.includes('+2 Combat points')&&enNpc.phases?.label==='Your combat phases'&&enIncoming?.phases?.label==='Attacker phases'&&enIncoming.loot?.label==='Resources lost'&&enOld?.losses?.text==='Not recorded'&&enShare?.loot?.label==='Salvage share'&&enShare.loot.text==='16%Under rewards',{enNpc,enIncoming,enOld,enShare});
  await run.page.setViewportSize({width:320,height:900});await run.page.locator(selector('overview-npc')).scrollIntoViewIfNeeded();await run.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const geometry=await run.page.locator(selector('overview-npc')).evaluate(e=>{const region=e.querySelector('.report-overview'),cells=[...e.querySelectorAll('.report-overview-cell')].map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,client:n.clientWidth,scroll:n.scrollWidth};}),buttons=[...e.querySelectorAll('button')].map(n=>{const r=n.getBoundingClientRect();return {w:r.width,h:r.height};});return {region:region?{client:region.clientWidth,scroll:region.scrollWidth}:null,cells,buttons};});
  check('mobile',geometry.cells.length===3&&geometry.cells.every((c,i)=>c.width>0&&c.scroll<=c.client+1&&(!i||c.y>=geometry.cells[i-1].bottom))&&geometry.region?.scroll<=geometry.region?.client+1&&geometry.buttons.every(b=>b.w>=44&&b.h>=44),geometry);
  check('hashes',JSON.stringify(hashRows())===JSON.stringify(before),{runtimeRows:runtimeFiles.length,frozenRows:files.length});
  check('script',runs.every(r=>r.errors.length===0),runs.flatMap(r=>r.errors));
  check('http',runs.every(r=>r.httpErrors.length===0&&r.requests.every(q=>!q.status||q.status<400||q.expected)),runs.flatMap(r=>[...r.httpErrors,...r.requests.filter(q=>q.status>=400&&!q.expected)]));
  assert.deepEqual(records.map(r=>r.name),manifest);const failed=records.filter(r=>!r.ok).map(r=>r.name);
  console.log('REPORT_OVERVIEW_COMPLETE '+JSON.stringify({names:manifest,records,failed,checks:manifest.length,complete:true}));console.log(manifest.length+' checks, '+failed.length+' failures');console.log((failed.length?'FAIL':'OK')+' - Native report overview');process.exitCode=failed.length?1:0;
 }finally{for(const run of runs)await run.close();await browser.close();}
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
