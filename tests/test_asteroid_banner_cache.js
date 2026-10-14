'use strict';
// Browser-free component contract. Execute the actual native report-cache and
// banner functions; style append and canvas pixel baking are bounded DOM stubs.
// This proves binding after the real cache reset, not browser artwork pixels.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {SPIELDATEI,WURZEL,SERVER_JS}=require('./lib/spieldatei');
const source=fs.readFileSync(SPIELDATEI,'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(WURZEL,'docs/ship-art-package.json'),'utf8'));
const keys=pkg.groups.flatMap(group=>group.tiles.map(tile=>tile.key));
assert.equal(keys.length,46);assert.equal(new Set(keys).size,46);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const frozen=[SPIELDATEI,...['kepler-graphics.css','service-worker.js','kepler-english.json'].map(name=>path.join(WURZEL,name)),
 ...fs.readdirSync(WURZEL).filter(name=>/^kepler-gfx-.*\.(png|webp)$/.test(name)).sort().map(name=>path.join(WURZEL,name)),
 ...fs.readdirSync(path.join(WURZEL,'docs')).filter(name=>/art-(?:package|prompts)\.json$/.test(name)).sort().map(name=>path.join(WURZEL,'docs',name)),
 __filename,path.join(WURZEL,'tests/lib/spieldatei.js')];
if(process.env.KEPLER_BACKEND_SERVER)assert(fs.existsSync(process.env.KEPLER_BACKEND_SERVER),'Configured backend must exist');
if(SERVER_JS)frozen.push(SERVER_JS);
const snapshot=()=>frozen.map(file=>({file,sha256:sha(fs.readFileSync(file))})),before=snapshot();
function section(text,start,end){assert.equal(text.split(start).length,2,'Unique actual component start: '+start);const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert(b>a,'Ordered actual component end: '+end);return text.slice(a,b);}
function constant(text,name){const expression=new RegExp('const '+name+' = (\\d+);','g'),matches=[...text.matchAll(expression)];assert.equal(matches.length,1,'Unique actual native constant '+name);return Number(matches[0][1]);}
const cap=constant(source,'BILD_DECKEL'),backing=constant(source,'BILD_BACKGROESSE');assert.equal(cap,130);assert.equal(backing,96);
const rebind=/^[ \t]*if\(!gameRasterBakedConsumers\.has\(template\.id\)\)gameRasterRegisterBake\(template\.id,template\.keys,template\.bake\);$/gm;
assert.equal([...source.matchAll(rebind)].length,1,'Unique actual post-reset banner rebind');
const legacy=source.replace(rebind,'/* Genuine missing post-reset banner rebind. */');assert.notEqual(legacy,source);
const labels={initial:'native asteroid banner begins with its original registered bake',report:'138 original report picture identities trigger the unchanged native 130-rule reset',attributes:'the retained asteroid template restores its canonical bake attributes after native reset',consumer:'the retained hero component binds the restored original template after native reset',identity:'native reset preserves one template and the same original bake callback'};
function witness(text){
 const styleNode={childNodes:[],appendChild(node){this.childNodes.push(node);}};
 Object.defineProperty(styleNode,'textContent',{set(){this.childNodes=[];},get(){return this.childNodes.join('');}});
 const hero={nodeType:1,localName:'div',dataset:{},isConnected:true,matches:()=>true,querySelectorAll:()=>[]};
 const pendingDemands=[],draws=[];
 const context={Map,Set,WeakMap,WeakSet,state:{shipSkin:'standard'},SHIP_HULL_DEFS:Object.fromEntries(keys.map(key=>[key,{}])),BILD_BACKGROESSE:backing,BILD_DECKEL:cap,
  gebackeneBilder:{},shipRasterBakes:new Map(),shipRasterBakedArt:new Map(),gameRasterBakedConsumers:new Map(),asteroidBannerTemplates:new Map(),
  gameRasterConsumers:new WeakMap(),gameRasterTargets:new Set(),gameRasterDrawing:new WeakSet(),gameRasterObserver:null,asteroidRasterEventsBound:false,GAME_RASTER_ART:{'asteroid:urmaterie':{}},
  document:{getElementById:id=>id==='gebackeneBildStile'?styleNode:null,querySelectorAll:selector=>selector==='[data-game-raster-baked]'&&hero.dataset.gameRasterBaked?[hero]:[],
   addEventListener:()=>{},createTextNode:rule=>rule,createElement:name=>{assert.equal(name,'canvas');return {dataset:{},toDataURL:()=> 'data:image/png;base64,component'};}},
  gameRasterObserveConsumers:()=>{},gameRasterSetData:()=>{},gameRasterVisible:node=>node===hero&&node.isConnected,
  gameRasterCanvas:(key,demand)=>{assert.equal(key,'asteroid:urmaterie');if(demand)pendingDemands.push(key);return null;},
  gameRasterDataUrl:()=>null,gameRasterSvgAttributes:key=>'data-game-raster-key="'+key+'"',escapeHtml:value=>String(value),
  shipMarkOf:()=>1,activeShipSkinStops:()=>null,drawShipMiniIcon:(key,canvas,mark,foreign)=>{assert(keys.includes(key));assert.equal(canvas.dataset.shipRasterLoad,'defer');draws.push({key,mark,foreign});},saveShipRasterBake:()=>{}};
 vm.createContext(context);
 const functions=[section(text,'    function gameRasterRequestConsumer(node){','    function gameRasterRefreshConsumers'),
  section(text,'    function gameRasterScan(root){','    function gameRasterAfterTabAnimation'),
  section(text,'    function gameRasterRegisterBake(id,keys,redraw){','    // Private helpers for the existing SVG'),
  section(text,'    function asteroidRasterSvgHtml(sorte,cx,cy,r,fallback){','    function asteroidRasterIconHtml'),
  section(text,'    function asteroidBannerAttributes(banner){','\n    function anlageAusbaustand'),
  section(text,'  function bannerAsteroid(cx, cy, r, color, sorte=','  function bannerGradDefs'),
  section(text,'  function svgBg(inner){','  const BANNER_DEFS'),
  section(text,'  function bildStilAnhaengen(regel){','  function schiffBildKlasse'),
  section(text,'  function schiffBildKlasse(key, fremd){','  /* Wie schiffBildKlasse')].join('\n');
 vm.runInContext(functions,context,{timeout:1000});
 const banner=vm.runInContext("({key:'bronze',css:svgBg(bannerAsteroid(95,82,20,'#8a6530','urmaterie'))})",context);
 const initialAttributes=context.asteroidBannerAttributes(banner);context.watchAsteroidBanner(hero,banner);
 const template=context.asteroidBannerTemplates.get('bronze'),initialBake=context.gameRasterBakedConsumers.get(template.id);
 const originalCallback=initialBake.redraw,initialConsumer=context.gameRasterConsumers.get(hero);
 const pictures=[];
 for(const skin of ['standard','gold']){context.state.shipSkin=skin;for(const key of keys){pictures.push(context.schiffBildKlasse(key,false));if(skin==='standard')pictures.push(context.schiffBildKlasse(key,true));}}
 const reset={bakes:context.gameRasterBakedConsumers.size,templates:context.asteroidBannerTemplates.size,rules:styleNode.childNodes.length};
 const restoredAttributes=context.asteroidBannerAttributes(banner);context.watchAsteroidBanner(hero,banner);
 const restoredBake=context.gameRasterBakedConsumers.get(template.id),restoredConsumer=context.gameRasterConsumers.get(hero);
 const truth={
  [labels.initial]:initialAttributes.includes('asteroid-banner:bronze')&&!!initialConsumer&&initialConsumer.redraw===originalCallback,
  [labels.report]:pictures.length===138&&draws.length===138&&pictures.every(Boolean)&&new Set(pictures).size===138&&reset.bakes===0&&reset.templates===1&&reset.rules===8,
  [labels.attributes]:restoredAttributes===initialAttributes&&!!restoredBake,
  [labels.consumer]:hero.dataset.gameRasterBaked===template.id&&hero.dataset.gameRasterKey==='asteroid:urmaterie'&&!!restoredConsumer&&restoredConsumer.redraw===originalCallback,
  [labels.identity]:context.asteroidBannerTemplates.size===1&&context.asteroidBannerTemplates.get('bronze')===template&&template.bake===originalCallback
 };
 assert(pendingDemands.length>0,'The actual connected pending consumer must demand its canonical motif');
 return {truth,reset,pictures:pictures.length,sourceSha256:sha(Buffer.from(text))};
}
const current=witness(source),negative=witness(legacy),expected=Object.values(labels);
assert.deepEqual(Object.keys(current.truth),expected);assert.deepEqual(Object.keys(negative.truth),expected);
for(const name of expected){assert.equal(current.truth[name],true,name);console.log('OK - '+name);}
assert.deepEqual(Object.entries(negative.truth).filter(([,ok])=>!ok).map(([name])=>name),[labels.attributes,labels.consumer],'Only the missing native post-reset rebinding must fail');
console.log('OK - genuine missing-rebind source preserves the complete component manifest and fails exactly the two reset-binding guards');
assert.deepEqual(snapshot(),before,'Every real source asset package and configured backend stays byte-identical');
console.log('OK - asteroid banner cache component review preserves all frozen runtime package and backend bytes');
console.log('7 checks, 0 failures');
