'use strict';
// Each fault is an actual independently served source copy. The native test,
// its complete guard order, physical actions and HTTP error checks stay intact.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html'),source=fs.readFileSync(game,'utf8');
const nativeTest=path.join(root,'tests/test_asteroid_raster_art.js');
const {manifest,labels,counterFailures}=require(nativeTest);
// Independent full ordered contract. Editing the test export cannot silently
// delete a guard or redefine which genuine source failure the controller accepts.
const expectedManifest=[
 'ten native mining sorts match the independent asteroid package',
 'both delivered asteroid formats match package bytes and dimensions',
 'decoded asteroid PNG and WebP retain identical opaque pixels and alpha',
 'a hidden mining map does not request its asteroid atlas',
 ...'eisen prisma eiskern magnetit hydrat klathrat pechblende resonanz kometenkern urmaterie'.split(' ').map(key=>'native mining deposit paints the independent '+key+' crop'),
 'all ten original mining hit rectangles still contain the same-size illustration',
 'original own and foreign mining rights keep their rings holder labels and protection',
 'private mining bearings paint their independent crops and keep their separate dashed rings',
 'the native mining menu paints its actual gold deposit and retains resource shares',
 'every loaded mining illustration hides its original polygon and mineral-vein fallback',
 'the actual Urmaterie crop keeps a distinct golden mineral identity',
 'the original mining action opens the actual fleet preview without starting a mission',
 'a genuinely pending asteroid response retains every visible original mining polygon',
 'actual delayed asteroid readiness paints the retained native map nodes',
 'a genuinely missing asteroid WebP loads exactly one canonical PNG fallback',
 'two genuinely failed asteroid formats retain the complete visible original mining markers',
 'failed asteroid formats are requested once and retain their native fallback after a real revisit',
 'both native asteroid banner choices paint decoded canonical motifs without original polygon bleed',
 'the original alliance banner roles and native selection action remain usable',
 'native bronze ash and bronze selections paint their actual independent hero crops',
 'mining artwork does not replace native navigation or mining hit controls',
 'asteroid native actions preserve every original runtime asset package and backend byte',
 'asteroid native actions finish without JavaScript or fixture HTTP errors'
];
assert.equal(manifest.length,32,'All 31 original guards and the independent hero-pixel guard must be present');
assert.deepEqual(manifest,expectedManifest,'Complete independently fixed native guard names and order');
assert.equal(new Set(manifest).size,manifest.length,'Native guard labels must be unique');
const independentFailureSets={
 visibleFallback:[expectedManifest[18]],
 wrongGold:[expectedManifest[13],expectedManifest[16],expectedManifest[17],expectedManifest[19],expectedManifest[26],expectedManifest[28]],
 drawnBanner:[expectedManifest[26],expectedManifest[28]],
 bannerHref:[expectedManifest[26],expectedManifest[28]],
 staleHero:[expectedManifest[28]],
 bannerTransform:[expectedManifest[26],expectedManifest[28]],
 delayedBackground:[expectedManifest[26]],
 coveredBanner:[expectedManifest[26],expectedManifest[28]],
 warmHref:[expectedManifest[22]]
};
assert.deepEqual(counterFailures,independentFailureSets,'Genuine fault expectations must match the independently fixed failure sets');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function replaceOnce(text,before,after){assert.equal(text.split(before).length,2,'Unique actual native source anchor: '+before);return text.replace(before,after);}
function restoreWarmHref(text){
 text=replaceOnce(text,'      return `<g data-asteroid-raster="${escapeHtml(key)}"','      const url=gameRasterDataUrl(key,false);\n      return `<g data-asteroid-raster="${escapeHtml(key)}"');
 return replaceOnce(text,'+ `<image data-asteroid-image="1" ${gameRasterSvgAttributes(key)} x=',
  '+ `<image data-asteroid-image="1" ${gameRasterSvgAttributes(key)}${url?\' href="\'+escapeHtml(url)+\'"\':\'\'} x=');
}
const faults=[
 {label:'visible-fallback',failed:counterFailures.visibleFallback,source:replaceOnce(source,"if(fallback)fallback.style.visibility=ready?'hidden':'visible';","if(fallback)fallback.style.visibility='visible';")},
 {label:'wrong-gold-crop',failed:counterFailures.wrongGold,source:replaceOnce(source,"const key='asteroid:'+sorte;","const key='asteroid:'+(sorte==='urmaterie'?'eisen':sorte);")},
 {label:'drawn-banners',failed:counterFailures.drawnBanner,source:replaceOnce(source,'return asteroidRasterSvgHtml(sorte,cx,cy,r,','return (sorte,cx,cy,r,')},
 // Change only the actually consumed href; native keys, labels and selection
 // retain their correct Urmaterie identity and cannot satisfy the pixel oracle.
 {label:'banner-wrong-href',failed:counterFailures.bannerHref,source:replaceOnce(source,"image.setAttribute('href',gameRasterDataUrl(group.getAttribute('data-asteroid-raster'),false));","image.setAttribute('href',gameRasterDataUrl('asteroid:eisen',false));")},
 // Keep the first same-node binding, including its actual template identity.
 // Removing only the weak-map delete leaves the picker-template apply path
 // correctly painting the new identity and is therefore not a failing fault.
 {label:'stale-hero-binding',failed:counterFailures.staleHero,source:replaceOnce(source,'if(node.dataset.gameRasterBaked!==template.id)gameRasterConsumers.delete(node);','if(node.dataset.gameRasterBaked&&node.dataset.gameRasterBaked!==template.id)return;')},
 {label:'banner-hidden-transform',failed:counterFailures.bannerTransform,source:replaceOnce(source,'const svg=new XMLSerializer().serializeToString(doc.documentElement);',"for(const group of doc.querySelectorAll('[data-asteroid-raster]'))group.setAttribute('transform','translate(1000 0)');\n          const svg=new XMLSerializer().serializeToString(doc.documentElement);")},
 // Restore the real previous background-transition mechanism, with a bounded
 // two-second duration that exposes asset-ready versus consumed-CSS readiness.
 {label:'banner-delayed-background',failed:counterFailures.delayedBackground,source:replaceOnce(source,'.banner-option[data-game-raster-baked^="asteroid-banner:"] { transition:border-color 0.15s ease, transform 0.1s ease, box-shadow 0.2s ease; }','.banner-option[data-game-raster-baked^="asteroid-banner:"] { transition:background 2s ease, transform 0.1s ease, box-shadow 0.2s ease; }')},
 // This keeps all canonical inputs and their geometry intact. Only the new
 // actual-versus-blank scene contribution can detect the opaque later overlay.
 {label:'banner-covered-images',failed:counterFailures.coveredBanner,source:replaceOnce(source,'const svg=new XMLSerializer().serializeToString(doc.documentElement);',"const cover=doc.createElementNS('http://www.w3.org/2000/svg','rect');cover.setAttribute('width','400');cover.setAttribute('height','140');cover.setAttribute('fill','#010203');doc.documentElement.appendChild(cover);\n          const svg=new XMLSerializer().serializeToString(doc.documentElement);")},
 {label:'warm-inline-href',failed:counterFailures.warmHref,source:restoreWarmHref(source)}
];
for(const fault of faults)assert.notEqual(sha(Buffer.from(fault.source)),sha(Buffer.from(source)),'Every fault must really change source bytes');
const frozen=[game,nativeTest,__filename,path.join(root,'tests/http-run.js'),
 ...['kepler-graphics.css','kepler-english.json','service-worker.js'].map(name=>path.join(root,name)),
 ...fs.readdirSync(path.join(root,'tests/lib')).filter(name=>/\.(?:js|json)$/.test(name)).sort().map(name=>path.join(root,'tests/lib',name)),
 ...fs.readdirSync(path.join(root,'docs')).filter(name=>/art-(?:package|prompts)\.json$/.test(name)).sort().map(name=>path.join(root,'docs',name)),
 ...fs.readdirSync(root).filter(name=>/^kepler-gfx-.*\.(?:png|webp)$/.test(name)).sort().map(name=>path.join(root,name))];
const {SERVER_JS}=require(path.join(root,'tests/lib/spieldatei.js'));if(process.env.KEPLER_BACKEND_SERVER)assert(fs.existsSync(process.env.KEPLER_BACKEND_SERVER),'Configured frozen backend must exist');if(SERVER_JS)frozen.push(SERVER_JS);
const snapshot=()=>frozen.map(file=>({file,sha256:sha(fs.readFileSync(file))})),before=snapshot();
const evidence=path.resolve(root,'../ship-sharpness-2026-10-14','asteroid-counter-'+new Date().toISOString().replace(/[:.]/g,''));fs.mkdirSync(evidence,{recursive:true});
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-asteroid-raster-')),results=[];
function run(file,label){
 const started=Date.now(),child=spawnSync(process.execPath,['tests/http-run.js','test_asteroid_raster_art.js'],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file},encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
 const stdout=path.join(evidence,label+'.stdout.log'),stderr=path.join(evidence,label+'.stderr.log');fs.writeFileSync(stdout,child.stdout||'');fs.writeFileSync(stderr,child.stderr||'');
 const result={label,exit:child.status,signal:child.signal,error:child.error?.code||null,elapsedMs:Date.now()-started,sourceSha256:sha(fs.readFileSync(file)),stdout,stderr,stdoutSha256:sha(fs.readFileSync(stdout)),stderrSha256:sha(fs.readFileSync(stderr))};results.push(result);
 assert.equal(child.error,undefined,label+' must finish within the unchanged native budget');assert.equal(child.signal,null,label+' must finish naturally');
 assert.equal((child.stderr||'').trim(),'','Unexpected native stderr in '+label+': '+(child.stderr||''));
 const guards=(child.stdout||'').split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL) - (.+?)(?: \| |$)/.exec(line);return m&&m[2]!=='Native asteroid raster artwork'?[{name:m[2],ok:m[1]==='OK'}]:[];});
 assert.deepEqual(guards.map(g=>g.name),manifest,label+' must execute every original native guard in its original order');
 const footer=(child.stdout||'').match(/^(OK|FAIL) - Native asteroid raster artwork \| (\{.*\})$/m);assert(footer,label+' must produce the complete actual native footer');
 const totals=JSON.parse(footer[2]),failed=guards.filter(g=>!g.ok).map(g=>g.name);
 assert.equal(totals.checks,manifest.length);assert.equal(totals.failures,failed.length);assert.equal(footer[1],failed.length?'FAIL':'OK');
 assert((child.stdout||'').includes(manifest.length+' checks, '+failed.length+' failures'),'Actual counted summary must agree');
 assert(guards.find(g=>g.name===labels.frozen)?.ok,label+' changed actual runtime bytes');assert(guards.find(g=>g.name===labels.errors)?.ok,label+' has native JavaScript or fixture HTTP errors');
 Object.assign(result,{checks:totals.checks,guards,failed});assert.deepEqual(snapshot(),before,'Frozen actual checkout changed during native run');return result;
}
try{
 const normal=run(game,'normal');assert.equal(normal.exit,0,'The original native baseline must actually pass');assert.deepEqual(normal.failed,[]);
 for(const fault of faults){const file=path.join(scratch,fault.label+'.html');fs.writeFileSync(file,fault.source);const result=run(file,fault.label);
  assert.equal(result.exit,1,'The actual '+fault.label+' source must fail normally');assert.deepEqual(result.failed,fault.failed,'Exact independent native failure set for '+fault.label);
 }
 assert.deepEqual(snapshot(),before,'Frozen final checkout');
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({complete:true,checksPerRun:manifest.length,before,after:snapshot(),results},null,2)+'\n');
 console.log('OK - asteroid baseline and all nine genuine source faults complete every original native guard | '+evidence);
}catch(error){fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({complete:false,error:error.message,before,after:snapshot(),results},null,2)+'\n');throw error;}
finally{for(const name of fs.readdirSync(scratch))fs.unlinkSync(path.join(scratch,name));fs.rmdirSync(scratch);}
