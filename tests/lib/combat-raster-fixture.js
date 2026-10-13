'use strict';
// Reports use the game's existing native adapters and names. The HTTP fixture
// supplies saves and assets; no replay handler, clock or game state is replaced.
const {fixture,save,pointer,tab,boolean,delay}=require('./ship-raster-fixture');
const fleet={jaeger:900,hyperjaeger:120,bomber:400,hyperbomber:180,schlachtschiff:600,quantenkreuzer:220,cruisers:300,destroyers:260,waechter:400};
const defense={flak:20,turm:18,laser:16,raketen:12,gauss:10,plasma:8,schild:8};
const raidBosses=[['sternenfresser','Sternenfresser'],['panzerhuelle','Panzerhülle'],['schwarmmutter','Schwarmmutter'],['phasenwandler','Phasenwandler'],['gluthorn','Gluthorn']];
const worldBosses=['Leviathan der Leere','Chronos-Verschlinger','Die Singularität','Wächter des Abgrunds','Nova-Titan'];
function reports(){
 const now=Date.now(),stamp=(id,type,fields)=>({id,type,time:now,ts:now,targetPlanet:'home',...fields});
 const phases=[{nr:1,name:'Anflug',gewonnen:true},{nr:2,name:'Hauptgefecht',gewonnen:true},{nr:3,name:'Rückzug',gewonnen:true}];
 const own=stamp('combat-own','npc-attack',{result:'win',npcName:'Void-Marodeure',npcLevel:1,attackPower:88000,defensePower:52000,fleet,ownLostShips:{jaeger:210,bomber:60,schlachtschiff:40},npcFleet:{jaeger:1400,cruisers:380,schlachtschiff:120},destroyedNpcShips:{jaeger:1400,cruisers:300,schlachtschiff:90},phasen:phases});
 const incoming=stamp('combat-incoming','raid',{result:'win',faction:'Söldnerkonvoi',attackPower:52000,defensePower:88000,fleet:{jaeger:1400,cruisers:380,schlachtschiff:120},stationedFleet:fleet,ownLostShips:{jaeger:210,bomber:60,schlachtschiff:40},destroyedShips:{jaeger:1400,cruisers:300,schlachtschiff:90},defenseBefore:defense});
 const raid=raidBosses.map(([key,name])=>({key,report:stamp('combat-boss-'+key,'alliance-raid',{bossName:name,level:3,waveNumber:2,damage:25000,hpNachher:14200,maxHp:39200,lossPct:.1,totalPower:61000,fleet,myComposition:fleet})}));
 const world=worldBosses.map((name,index)=>({key:'wb'+index,report:stamp('combat-boss-wb'+index,'npc-attack',{result:'loss',npcName:name+' – Stufe 2',weltboss:true,attackPower:50000,defensePower:400000,bossHpNachher:150000,bossZerstoert:false,fleet,ownLostShips:{jaeger:210}})}));
 const abgrund={key:'abgrund',report:stamp('combat-boss-abgrund','npc-attack',{result:'loss',npcName:'Schattengraben (Tiefe 44)',npcLevel:44,abgrund:true,attackPower:9000,defensePower:22000,fleet,ownLostShips:{jaeger:210}})};
 // Omitted bossName exercises the genuine native Raid-Boss/generisch fallback.
 const generic={key:'generisch',report:stamp('combat-boss-generisch','alliance-raid',{level:3,waveNumber:2,damage:25000,hpNachher:14200,maxHp:39200,lossPct:.1,totalPower:61000,fleet,myComposition:fleet})};
 const rift=stamp('combat-rift','void-rift',{result:'loss',riftPower:32000,defensePower:32000,attackPower:22000,fleet,ownLostShips:{jaeger:210},shards:0});
 return {own,incoming,bosses:[...raid,abgrund,...world,generic],rift};
}
async function openReplay(run,id){
 if(!await run.page.locator('#reportsBox').isVisible())await pointer(run.page,'#headerReportsBtn');
 const selector='#reportsBox [data-watch-battle="'+id+'"]';
 // Long native reports can leave a partially visible control under fixed HUD.
 // Scroll the actual target to the viewport centre before the physical hit test.
 await run.page.locator(selector).evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
 try{await pointer(run.page,selector);}catch(error){const hit=await run.page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {box:{x:r.x,y:r.y,w:r.width,h:r.height},hit:target?.outerHTML.slice(0,600)||null};});error.message+=' | actual native hit '+JSON.stringify(hit);throw error;}
 await run.page.locator('#battleModalOverlay').waitFor({state:'visible'});
}
async function closeReplay(run){await pointer(run.page,'#battleModalCloseBtn');await run.page.locator('#battleModalOverlay').waitFor({state:'hidden'});}
const state=page=>page.locator('#osWrap').evaluate(e=>{try{return JSON.parse(e.dataset.zustand);}catch{return null;}});
// Observe only completed original drawImage calls. Every argument, receiver,
// return value and thrown exception remains native; nothing advances the game.
async function observeDraws(page,oracle){
 await page.evaluate(async oracle=>{
  const original=CanvasRenderingContext2D.prototype.drawImage,reference={},dimensions={};
  const normalized=canvas=>{const small=document.createElement('canvas');small.width=small.height=32;original.call(small.getContext('2d'),canvas,0,0,32,32);return small.getContext('2d').getImageData(0,0,32,32).data;};
  const images={};
  for(const [key,art] of Object.entries(oracle)){
   if(!images[art.stem]){const image=new Image();image.src='/'+art.stem+'.png?oracle=1';await image.decode();images[art.stem]=image;}
   const canvas=document.createElement('canvas');canvas.width=art.rect[2];canvas.height=art.rect[3];original.call(canvas.getContext('2d'),images[art.stem],...art.rect,0,0,canvas.width,canvas.height);reference[key]=normalized(canvas);
   const id=canvas.width+'x'+canvas.height;(dimensions[id]||(dimensions[id]=[])).push(key);
  }
  let records={},drawCalls=0,fragments=0,errors=[];const memo=new WeakMap(),fragmentMemo=new WeakMap();
  const fingerprint=(actual,expected)=>{let diff=0;for(let i=0;i<actual.length;i+=4){for(let k=0;k<3;k++)diff+=Math.abs(actual[i+k]*actual[i+3]/255-expected[i+k]*expected[i+3]/255);diff+=Math.abs(actual[i+3]-expected[i+3]);}return diff/actual.length;};
  CanvasRenderingContext2D.prototype.drawImage=function(...args){
   const result=Reflect.apply(original,this,args);
   if(this.canvas.id==='osCv')try{
    drawCalls++;const image=args[0];
    if(image instanceof HTMLCanvasElement){
     if(!memo.has(image)){
      const candidates=dimensions[image.width+'x'+image.height]||[];let found=null;
      if(candidates.length){const pixels=normalized(image);for(const key of candidates){const diff=fingerprint(pixels,reference[key]);if(diff<=3&&(!found||diff<found.diff))found={key,diff};}}
      memo.set(image,found);
     }
     const found=memo.get(image);if(found){const entry=records[found.key]||(records[found.key]={calls:0,diff:found.diff});entry.calls++;}
     // Native32 rotations are arranged in eight columns and four rows. A cut
     // hull band has a smaller source height than one complete rotation frame.
     if(args.length===9&&Math.abs(image.width-image.height*2)<=2&&args[3]<=image.width/8+1&&args[4]<image.height/4-1&&args[3]>0&&args[4]>0){
      if(!fragmentMemo.has(image)){const canvas=document.createElement('canvas');canvas.width=canvas.height=32;original.call(canvas.getContext('2d'),image,...args.slice(1,5),0,0,32,32);const pixels=canvas.getContext('2d').getImageData(0,0,32,32).data;fragmentMemo.set(image,pixels.some((v,i)=>i%4===3&&v>=8));}
      if(fragmentMemo.get(image))fragments++;
     }
    }
   }catch(error){errors.push(error.message);}
   return result;
  };
  window.__combatPixelObservation={read:()=>({records,drawCalls,fragments,errors}),reset:()=>{records={};drawCalls=0;fragments=0;errors=[];}};
 },oracle);
}
const observation=page=>page.evaluate(()=>window.__combatPixelObservation.read());
const resetObservation=page=>page.evaluate(()=>window.__combatPixelObservation.reset());
module.exports={fixture,save,pointer,tab,boolean,delay,fleet,defense,raidBosses,worldBosses,reports,openReplay,closeReplay,state,observeDraws,observation,resetObservation};
