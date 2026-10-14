'use strict';
// The original DPR helper remains present in production for non-ship canvases.
// A genuine source copy restores it for ships; no test assertion is patched.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html');
const source=fs.readFileSync(game,'utf8');
const {manifest,labels,hdLabels,dprLabel,resizeLabel}=require(path.join(root,'tests/test_ship_raster_sharpness.js'));
assert.equal(manifest.length,37,'Complete native sharpness and HD manifest, including actual skin actions');
const start='    function prepareShipCanvasSurface(canvas){',end='    // Icon-Kachel einer Gebäudekarte.';
assert.equal(source.split(start).length,2,'Unique actual responsive ship surface helper');
assert.equal(source.split(end).length,2,'Unique actual helper end');
assert.equal(source.split('function ensureCanvasDpr(canvas){').length,2,'The actual original non-ship helper must exist');
const a=source.indexOf(start),b=source.indexOf(end,a);assert(b>a,'Ordered actual helper boundaries');
const broken=source.slice(0,a)+start+'\n      ensureCanvasDpr(canvas);\n      return false;\n    }\n'+source.slice(b);
const skinAnchor='      render(); refreshShipMiniIcons(); save();';
assert.equal(source.split(skinAnchor).length,2,'Unique actual native skin repaint');
const staleSkin=source.replace(skinAnchor,'      render(); save();');
const frozen=[game,path.join(root,'kepler-graphics.css'),path.join(root,'kepler-english.json'),path.join(root,'service-worker.js'),
 path.join(root,'docs/ship-art-package.json'),path.join(root,'docs/ship-detail-art-package.json'),__filename,path.join(root,'tests/test_ship_raster_sharpness.js'),path.join(root,'tests/test_ship_raster_art.js'),path.join(root,'tests/http-run.js'),
 ...fs.readdirSync(path.join(root,'tests/lib')).filter(n=>n.endsWith('.js')).sort().map(n=>path.join(root,'tests/lib',n)),
 ...fs.readdirSync(root).filter(n=>/^kepler-gfx-.*\.(png|webp)$/.test(n)).sort().map(n=>path.join(root,n))];
const {SERVER_JS}=require(path.join(root,'tests/lib/spieldatei.js'));if(process.env.KEPLER_BACKEND_SERVER)assert(fs.existsSync(process.env.KEPLER_BACKEND_SERVER),'Configured backend must exist');if(SERVER_JS)frozen.push(SERVER_JS);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const snapshot=()=>frozen.map(file=>({file,sha256:hash(file)})),before=snapshot();
const evidence=path.resolve(root,'../ship-sharpness-2026-10-14','counter-'+new Date().toISOString().replace(/[:.]/g,''));fs.mkdirSync(evidence,{recursive:true});
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-ship-sharpness-')),results=[];
function run(file,label){
 const started=Date.now(),child=spawnSync(process.execPath,['tests/http-run.js','test_ship_raster_sharpness.js'],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file},encoding:'utf8',timeout:180000,maxBuffer:12*1024*1024});
 const stdout=path.join(evidence,label+'.stdout.log'),stderr=path.join(evidence,label+'.stderr.log');fs.writeFileSync(stdout,child.stdout||'');fs.writeFileSync(stderr,child.stderr||'');
 const result={label,exit:child.status,signal:child.signal,error:child.error?.code||null,elapsedMs:Date.now()-started,sourceSha256:hash(file),stdoutSha256:hash(stdout),stderrSha256:hash(stderr)};results.push(result);
 assert.equal(child.error,undefined,label+' must finish within the existing native budget');assert.equal(child.signal,null,label+' must finish naturally');assert.equal((child.stderr||'').trim(),'','Unexpected native stderr: '+(child.stderr||''));
 const guards=(child.stdout||'').split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL) - (.+?)(?: \| |$)/.exec(line);return m&&m[2]!=='Native ship raster sharpness'?[{name:m[2],ok:m[1]==='OK'}]:[];});
 assert.deepEqual(guards.map(g=>g.name),manifest,label+' must complete every original native guard in order');
 const footer=(child.stdout||'').match(/^(OK|FAIL) - Native ship raster sharpness \| (\{.*\})$/m);assert(footer,label+' must produce the actual complete native footer');
 const totals=JSON.parse(footer[2]),failed=guards.filter(g=>!g.ok).map(g=>g.name);assert.equal(totals.checks,37);assert.equal(totals.failures,failed.length);assert.equal(footer[1],failed.length?'FAIL':'OK');
 assert((child.stdout||'').includes('37 checks, '+failed.length+' failures'),'Actual counted summary must agree');
 assert(guards.find(g=>g.name===labels.frozen).ok,label+' mutated runtime bytes');assert(guards.find(g=>g.name===labels.errors).ok,label+' has native JS/HTTP errors');assert(guards.find(g=>g.name===hdLabels.final).ok,label+' has HD native errors or source mutations');
 Object.assign(result,{guards,failed,checks:totals.checks});assert.deepEqual(snapshot(),before,'Frozen checkout changed during native run');return result;
}
try{
 const normal=run(game,'normal');assert.equal(normal.exit,0,'Native sharpness baseline must be green');assert.deepEqual(normal.failed,[]);
 const file=path.join(scratch,'original-attribute-dpr.html');fs.writeFileSync(file,broken);
 const counter=run(file,'original-attribute-dpr');assert.equal(counter.exit,1,'Original authored-size DPR source must fail normally');
 assert.deepEqual(counter.failed,[...[1,2,3].map(dprLabel),...[980,320,1487].map(resizeLabel),labels.reveal],'The original helper must be rejected for exactly the seven measured CSS/device-pixel deficits');
 const skinFile=path.join(scratch,'stale-native-skin.html');fs.writeFileSync(skinFile,staleSkin);
 const skinCounter=run(skinFile,'stale-native-skin');assert.equal(skinCounter.exit,1,'Missing native skin repaint must fail normally');
 assert.deepEqual(skinCounter.failed,[labels.skin],'Only the real standard gold standard skin action guard must reject stale cached artwork');
 assert.deepEqual(snapshot(),before,'Frozen final checkout');
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({complete:true,before,after:snapshot(),results},null,2)+'\n');
 console.log('OK - sharpness baseline and original DPR and stale skin counters complete all 37 native guards | '+evidence);
}catch(error){fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({complete:false,error:error.message,before,after:snapshot(),results},null,2)+'\n');throw error;}
finally{for(const name of fs.readdirSync(scratch))fs.unlinkSync(path.join(scratch,name));fs.rmdirSync(scratch);}
