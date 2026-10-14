'use strict';
// Execute in an exclusive browser lane. The genuine key mutation keeps the
// decoded initial texture truthful while removing the flat/ready cache distinction.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html'),source=fs.readFileSync(game,'utf8');
const start=source.indexOf('    function planetHolen(){'),end=source.indexOf('\n    function planetZeichnen(){',start);
assert(start>=0&&end>start,'Exactly bounded actual background planet renderer');assert.equal(source.split('    function planetHolen(){').length,2);
const body=source.slice(start,end),anchor="(tex ? '|textur' : '|flach')",replacement="'|textur'";
assert.equal(body.split(anchor).length,2,'Exactly one native texture-ready key component');
const broken=source.slice(0,start)+body.replace(anchor,replacement)+source.slice(end);
assert.equal(broken.slice(start,end-anchor.length+replacement.length).split(replacement).length,2);
assert.equal(broken.slice(0,start)+broken.slice(start,start+body.length-anchor.length+replacement.length).replace(replacement,anchor)+broken.slice(start+body.length-anchor.length+replacement.length),source,'Only the native texture-ready key component is mutated');
const manifest=[
 '0-anker: die Weltentypen sind aus dem Quelltext gelesen',
 '0a: die Textur wird auf die Kugel geschnitten und liegt UNTER dem Terminator',
 '0b: der Zeichner nimmt den quadratischen Mittelausschnitt, nicht die volle Streifenbreite',
 '0c-mond: nur der Vorgabe-Stand bleibt ohne Textur, der Mond nicht',
 '0c: der Zwischenspeicher merkt sich, ob die Textur da war',
 '1-vorab: die Kulissen-Leinwand steht und hat Fenstergröße, ohne Skriptfehler',
 '1a: der Kulissenplanet meldet, dass er die Textur seines Typs gezeichnet hat',
 '1b: und zwar mit einem echten Weltentyp, nicht mit dem Vorgabe-Blau'
];
const {deliveredRasterInventory,rasterRuntimeFiles}=require(path.join(root,'tests/test_ship_raster_art.js'));
const inventory=deliveredRasterInventory(root);
const be=process.env.KEPLER_BACKEND_SERVER||path.resolve(root,'../kolonie-kepler7-backend/server.js');assert(fs.existsSync(be),'Real pinned backend source must exist');const runtime=rasterRuntimeFiles(root,game,be,inventory);
const tracked=[...runtime,...inventory.inputFiles,'tests/test_ship_raster_art.js','tests/test_kulissenplanet.js','tools/check-kulissenplanet-cache-counterexample.cjs','tests/http-run.js','tests/lib/umgebung.js','tests/lib/spieldatei.js','tests/lib/http-test-origin.js'].map(n=>path.isAbsolute(n)?n:path.join(root,n));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),frozen=Object.fromEntries(tracked.map(file=>[file,hash(file)])),checkFrozen=()=>assert.deepEqual(Object.fromEntries(tracked.map(file=>[file,hash(file)])),frozen);
const evidence=path.resolve(root,'../graphics-complete-2026-10-13/kulissen-cache-counter-'+new Date().toISOString().replace(/[-:.]/g,''));fs.mkdirSync(evidence,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-background-cache-'));assert(path.dirname(temp)===path.resolve(os.tmpdir()));assert(path.basename(temp).startsWith('kepler-background-cache-'));
const good=path.join(temp,'positive.html'),bad=path.join(temp,'constant-texture-state.html');fs.writeFileSync(good,source);fs.writeFileSync(bad,broken);
const proof={createdUTC:new Date().toISOString(),runtimeRows:139,originalRuntimeRows:113,frozenBefore:frozen,mutation:"Only actual planetHolen key texture-ready conditional replaced by constant '|textur'; native drawing/metadata/JS remain untouched",manifest,success:false};
function run(name,file,expectedExit,expectedFailed){
 const child=spawnSync(process.execPath,['tests/http-run.js','test_kulissenplanet.js'],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file,KEPLER_BACKEND_SERVER:be,KEPLER_HTTP_TEST_ORIGIN:''},encoding:'utf8',timeout:210000,maxBuffer:6*1024*1024});
 const stdout=child.stdout||'',stderr=child.stderr||'';fs.writeFileSync(path.join(evidence,name+'.log'),stdout+stderr);
 assert.equal(child.error,undefined,'Native child must finish normally');assert.equal(child.signal,null,'Native child must not be killed');assert.equal(stderr,'','Native stderr must stay empty');assert.equal(child.status,expectedExit,'Genuine native exit must match expected result:\n'+stdout);
 const records=stdout.split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL)\s+-\s+(.+?)(?: \| |$)/.exec(line);return m?[{name:m[2],ok:m[1]==='OK'}]:[];});
 assert.deepEqual(records.map(r=>r.name),manifest,'All eight original guard names and order remain identical');assert.deepEqual(records.filter(r=>!r.ok).map(r=>r.name),expectedFailed,'Only independently fixed intended failure group may fail');
 assert.equal(stdout.trim().split(/\r?\n/).at(-1),expectedExit?'FAIL':'PASS','Native aggregate footer must agree');
 for(const name of [manifest[5],manifest[6],manifest[7]])assert(records.some(r=>r.name===name&&r.ok),'Real boot, JavaScript and texture paint must remain green');
 checkFrozen();return {exit:child.status,error:null,signal:child.signal,stderr,records,failed:records.filter(r=>!r.ok).map(r=>r.name),rawLog:path.join(evidence,name+'.log'),rawSHA256:hash(path.join(evidence,name+'.log'))};
}
try{proof.positive=run('positive',good,0,[]);console.log('OK - native background cache baseline completes all8 original guards');proof.negative=run('constant-texture-state',bad,1,[manifest[4]]);checkFrozen();proof.frozenAfter=Object.fromEntries(tracked.map(file=>[file,hash(file)]));proof.success=true;console.log('OK - constant texture-ready key rejects only0c in all8 unchanged guards; actual texture paint and JavaScript remain green');}catch(error){proof.error=error.message;throw error;}finally{proof.frozenAfter=Object.fromEntries(tracked.map(file=>[file,hash(file)]));fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(proof,null,2)+'\n');fs.rmSync(temp,{recursive:true,force:true});console.log('Evidence: '+evidence);}
