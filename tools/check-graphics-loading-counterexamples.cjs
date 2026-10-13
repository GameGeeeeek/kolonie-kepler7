'use strict';
// Genuine isolated source/asset copies; every child must finish the same ordered
// native manifest. No checkout mutation, expectation suppression or forced UI.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html');
const {manifest,labels,assetNames,assetLabel}=require(path.join(root,'tests/test_graphics_loading.js'));
const expectedManifest=require(path.join(root,'tests/lib/graphics-loading-manifest.json'));
assert.equal(expectedManifest.length,61);assert.equal(new Set(expectedManifest).size,61);assert.deepEqual(manifest,expectedManifest);
const source=fs.readFileSync(game,'utf8');
const replace=(input,anchor,next)=>{assert.equal(input.split(anchor).length,2,'one genuine graphics loading anchor: '+anchor);return input.replace(anchor,next);};
const hiddenGood='return activeTab===\'flotte\'&&SHIP_HULL_DEFS[key]?`<canvas data-ship-icon="${key}" data-gfx-ship-thumb="${key}" width="78" height="58" aria-hidden="true"></canvas>`:\'\';';
const hiddenOld='return GFX_SHIP_KEYS.includes(key)&&!activeFleetSkinFilter()?`<img data-gfx-ship-thumb="${key}" src="kepler-gfx-ship-${key}.png" alt="" decoding="async">`:"";';
const primaryGood=String.raw`eager?'src="'+src+'" loading="eager" fetchpriority="high"'`;
const primaryOld=String.raw`eager?'src="'+fallback+'" loading="eager" fetchpriority="high"'`;
const fallbackLine="if(element.tagName.toLowerCase()==='image')element.setAttribute('href',fallback);else element.src=fallback;";
const oldAllianceSelector="['.gfx-empty-state','nebula','linear-gradient(100deg,#101529e8,#101529cc)'],['#allianceHeroBanner','orbital-dock','linear-gradient(90deg,#0c1225ee,#0c122599)']";
const actualMemberGate="if(!asset||(asset[0]==='#allianceHeroBanner'&&myAllianceTag()))return;";
const actualMemberFinal="if(element.isConnected&&!(asset[0]==='#allianceHeroBanner'&&myAllianceTag())){";
const actualMemberRefresh='if(!entry){';
function eagerCanvases(input){const a=input.indexOf('    function shipRasterVisible(canvas){'),b=input.indexOf('\n    // A cached Canvas',a);assert(a>=0&&b>a,'the actual bounded native ship viewport gate');return input.slice(0,a)+'    function shipRasterVisible(canvas){return true;}'+input.slice(b);}
const cases=[
 {name:'eager-offscreen',source:()=>eagerCanvases(replace(source,'if(gfxAssetIntersectionObserver)gfxAssetIntersectionObserver.observe(element);','if(gfxAssetIntersectionObserver)gfxAssetActivate(element);')),failed:[labels.startup,labels.dormantImages,labels.dormantAtlases,labels.orbitalScroll,labels.orbitalRequest,labels.worldScroll,labels.hiddenFleetNetwork,labels.alliance,labels.fleet,labels.railDormant,labels.railScroll,labels.allianceFallback,labels.allianceMember]},
 // The old six-image factory requests hidden PNGs and loses the canonical
 // canvases. The independently deferred shared-atlas rail remains checked.
 {name:'hidden-fleet',source:()=>replace(source,hiddenGood,hiddenOld),failed:[labels.hiddenFleetMarkup,labels.hiddenFleetNetwork,labels.fleetThumbnails]},
 // Fleet is now a canonical Canvas consumer; the original main IMG branch and
 // its once-only fallback contract remain independently checked.
 {name:'primary-png',source:()=>replace(source,primaryGood,primaryOld),failed:[labels.main,labels.startup,labels.fallbackRequest,labels.fallbackDecode]},
 {name:'img-fallback',source:()=>replace(source,fallbackLine,'void fallback;'),failed:[labels.fallbackRequest,labels.fallbackDecode,labels.fallbackOnce]},
 {name:'alliance-registration',source:()=>replace(replace(source,oldAllianceSelector,oldAllianceSelector.replace("['#allianceHeroBanner'","['.gfx-alliance-entry .alliance-hero-banner'")),'gfxRefreshAllianceArtwork(heroBanner,!tag);','void heroBanner;'),failed:[labels.alliance,labels.allianceSecond,labels.allianceFallback,labels.allianceFallbackSecond]},
 {name:'alliance-refresh',source:()=>replace(source,'gfxRefreshAllianceArtwork(heroBanner,!tag);','void heroBanner;'),failed:[labels.allianceFallbackSecond]},
 {name:'member-gate',source:()=>{const start=source.indexOf('  function gfxRefreshAllianceArtwork(banner,entry){'),end=source.indexOf('\n  function ',start+1);assert(start>=0&&end>start,'one bounded native alliance refresh');const body=source.slice(start,end);assert.equal(body.split(actualMemberRefresh).length,2);let broken=source.slice(0,start)+body.replace(actualMemberRefresh,'if(false&&!entry){')+source.slice(end);broken=replace(broken,actualMemberGate,'if(!asset)return;');return replace(broken,actualMemberFinal,'if(element.isConnected){');},failed:[labels.allianceMember]},
 {name:'invalid-webp',source:()=>source,asset:'kepler-gfx-colony-outpost.webp',failed:[assetLabel('kepler-gfx-colony-outpost')]}
];
const requested=process.argv.slice(2),normalOnly=requested.includes('--normal-only');
assert(!normalOnly||requested.length===1,'normal-only cannot be combined with faults');
assert(normalOnly||new Set(requested).size===requested.length&&requested.every(name=>cases.some(c=>c.name===name)),'unknown/duplicate controlled graphics loading case');
const tracked=[game,path.join(root,'kepler-graphics.css'),path.join(root,'service-worker.js'),path.join(root,'kepler-english.json'),path.join(root,'marketing-screenshots.js'),path.join(root,'tests/test_graphics_loading.js'),__filename,path.join(root,'tests/lib/umgebung.js'),path.join(root,'tests/lib/spieldatei.js'),...assetNames.flatMap(name=>['png','webp'].map(ext=>path.join(root,name+'.'+ext)))];
tracked.push(path.join(root,'tests/lib/graphics-loading-manifest.json'));
const backend=require(path.join(root,'tests/lib/spieldatei')).SERVER_JS;if(backend)tracked.push(backend);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashes=()=>Object.fromEntries(tracked.map(file=>[path.relative(root,file),hash(file)]));
const before=hashes(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-graphics-loading-'));
const evidence=path.resolve(root,'../ship-menu-harmony-2026-10-13','graphics-loading-counter-'+new Date().toISOString().replace(/[:.]/g,''));fs.mkdirSync(evidence,{recursive:true});
function run(name,file,assetDirectory){
 const child=spawnSync(process.execPath,['tests/test_graphics_loading.js'],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file,KEPLER_GFX_ASSET_OVERRIDE_DIR:assetDirectory||''},encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024});
 const output=(child.stdout||'')+(child.stderr||'');fs.writeFileSync(path.join(evidence,name+'.log'),output);
 assert.equal(child.error,undefined,'child failed to finish: '+output);assert.equal(child.signal,null,'child killed: '+output);assert.equal((child.stderr||'').trim(),'','child stderr: '+output);
 const records=output.split(/\r?\n/).flatMap(line=>{const match=/^(OK|FAIL)\s+- (.*?)(?: \| .*)?$/.exec(line);return match&&match[2]!=='Native graphics loading'?[{name:match[2],ok:match[1]==='OK'}]:[];});
 assert.deepEqual(records.map(r=>r.name),manifest,'incomplete or reordered native guard manifest: '+output);assert(records.at(-2)?.ok&&records.at(-1)?.ok,'all JavaScript/HTTP guards must survive: '+output);
 assert(output.split(/\r?\n/).includes('61 checks, '+records.filter(r=>!r.ok).length+' failures'),'missing exact native completion: '+output);assert(output.split(/\r?\n/).includes((child.status===0?'OK':'FAIL')+' - Native graphics loading'),'native exit/completion mismatch');
 assert.deepEqual(hashes(),before,'frozen source/assets/backend/test/controller changed during '+name);
 return {name,exit:child.status,records,failed:records.filter(r=>!r.ok).map(r=>r.name),log:path.join(evidence,name+'.log'),logSha256:hash(path.join(evidence,name+'.log'))};
}
const proof={manifest,baseline:null,cases:[],frozenBefore:before,frozenAfter:null};
try{
 const good=path.join(temp,'positive.html');fs.writeFileSync(good,source);const baseline=run('positive',good);assert.equal(baseline.exit,0,'native graphics loading baseline must pass');assert.deepEqual(baseline.failed,[]);proof.baseline=baseline;
 console.log('OK - current native graphics loading finishes all61 guards with green JavaScript/HTTP');
 for(const fault of cases.filter(c=>!normalOnly&&(!requested.length||requested.includes(c.name)))){
  const file=path.join(temp,fault.name+'.html');fs.writeFileSync(file,fault.source());let assets;
  if(fault.asset){assets=path.join(temp,'bad-assets');fs.mkdirSync(assets);const bytes=Buffer.from(fs.readFileSync(path.join(root,fault.asset)));bytes.write('BAD!',0,'ascii');fs.writeFileSync(path.join(assets,fault.asset),bytes);}
  const negative=run(fault.name,file,assets);assert.equal(negative.exit,1,'controlled fault must fail normally: '+fault.name);
  const expected=manifest.filter(name=>fault.failed.includes(name));assert.deepEqual(negative.failed,expected,'controlled fault must reject precisely the named guards: '+fault.name);proof.cases.push(negative);
  console.log('OK - '+fault.name+' finishes all61 identical native guards and rejects exactly '+expected.length+' named failures');
 }
 proof.frozenAfter=hashes();assert.deepEqual(proof.frozenAfter,before);proof.success=true;
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(proof,null,2)+'\n');console.log('OK - every graphics loading probe preserves frozen source/assets and complete manifests');console.log('Evidence: '+evidence);
}catch(error){proof.success=false;proof.error=error.message;proof.frozenAfter=hashes();fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(proof,null,2)+'\n');throw error;}
finally{fs.rmSync(temp,{recursive:true,force:true});}
