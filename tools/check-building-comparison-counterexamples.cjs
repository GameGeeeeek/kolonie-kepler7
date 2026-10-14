'use strict';
// Genuine display-source faults; every run retains all 28 native comparison guards.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html'),testName='test_building_comparison.js';
const {manifest,labels}=require(path.join(root,'tests',testName));
assert.equal(manifest.length,28);assert.equal(new Set(manifest).size,28);
const source=fs.readFileSync(game,'utf8');
const replace=(input,old,next)=>{assert.equal(input.split(old).length,2,'unique actual comparison anchor: '+old);return input.replace(old,next);};
const names=keys=>['de','en'].flatMap(language=>keys.map(key=>language+': '+labels[key]));
const cases=[
 {name:'four-column-limit',copy:()=>replace(replace(source,"!picked&&selected.length>=3?'disabled':''","!picked&&selected.length>=4?'disabled':''"),'else if(selected.length<3)selected.push(key);','else if(selected.length<4)selected.push(key);'),failed:names(['limit'])},
 {name:'wrong-next-level',copy:()=>replace(source,"?' → '+item.nextLevel:","?' → '+item.level:"),failed:names(['one','five','max','planet','defense'])},
 {name:'missing-comparison-cost',copy:()=>replace(source,"row(k7Ui('Kosten','Cost'),item=>item.costHtml)","row(k7Ui('Kosten','Cost'),item=>'—')"),failed:names(['one','five','max','locked','planet','defense'])}
];
const files=[game,path.join(root,'kepler-graphics.css'),path.join(root,'kepler-english.json'),path.join(root,'service-worker.js'),path.join(root,'marketing-screenshots.js'),path.join(root,'tests',testName),__filename,
 ...['ideas-fixture.js','umgebung.js','spieldatei.js'].map(n=>path.join(root,'tests/lib',n)),
 ...fs.readdirSync(root).filter(n=>/^kepler-gfx-[a-z-]+\.(?:png|webp)$/.test(n)).sort().map(n=>path.join(root,n))];
const {SERVER_JS}=require(path.join(root,'tests/lib/spieldatei.js'));if(process.env.KEPLER_BACKEND_SERVER)assert(fs.existsSync(process.env.KEPLER_BACKEND_SERVER),'configured backend source must exist');if(SERVER_JS)files.push(SERVER_JS);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hashes=()=>Object.fromEntries(files.map(file=>[path.relative(root,file),hash(file)])),before=hashes();
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-building-comparison-'));
const evidence=path.resolve(root,'../interface-clarity-2026-10-14','building-counter-'+new Date().toISOString().replace(/[:.]/g,''));fs.mkdirSync(evidence,{recursive:true});
const proof={manifest,backend:SERVER_JS,frozenBefore:before,frozenAfter:null,baseline:null,cases:[],success:false};
const save=()=>fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(proof,null,2)+'\n');save();
function run(name,html){
 const file=path.join(temporary,name+'.html'),savedSource=path.join(evidence,name+'.html');fs.writeFileSync(file,html);fs.copyFileSync(file,savedSource);
 const argv=['tests/'+testName],started=Date.now();console.log('START - '+name+': complete28 native comparison guards');
 const child=spawnSync(process.execPath,argv,{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file},encoding:'utf8',timeout:180000,maxBuffer:12*1024*1024});
 const stdout=child.stdout||'',stderr=child.stderr||'',log=path.join(evidence,name+'.log'),stderrLog=path.join(evidence,name+'.stderr.log');fs.writeFileSync(log,stdout);fs.writeFileSync(stderrLog,stderr);
 const records=stdout.split(/\r?\n/).flatMap(line=>{const match=/^(OK|FAIL) - (.*?)(?: \| .*)?$/.exec(line);return match&&match[2]!=='Native building comparison'?[{name:match[2],ok:match[1]==='OK'}]:[];});
 const result={name,argv,durationMs:Date.now()-started,exit:child.status,signal:child.signal,error:child.error?String(child.error):null,source:savedSource,sourceSha256:hash(savedSource),records,failed:records.filter(r=>!r.ok).map(r=>r.name),log,logSha256:hash(log),stderrLog,stderrSha256:hash(stderrLog)};
 if(name==='positive')proof.baseline=result;else proof.cases.push(result);save();
 const detail='; log '+log+'\n'+stdout+stderr;
 assert.equal(child.error,undefined,'native comparison child must complete'+detail);assert.equal(child.signal,null,'native child must exit normally'+detail);assert.equal(stderr.trim(),'','native stderr'+detail);
 assert.deepEqual(records.map(r=>r.name),manifest,'complete identical native names/order'+detail);assert(records.at(-1).ok&&records.at(-2).ok,'JavaScript/HTTP must remain green'+detail);
 assert(!/\bSKIP\b|übersprungen|uebersprungen/i.test(stdout),'no skipped native guards'+detail);
 const lines=stdout.split(/\r?\n/);assert(lines.includes('28 checks, '+result.failed.length+' failures'),'complete native count footer'+detail);assert(lines.includes((child.status===0?'OK':'FAIL')+' - Native building comparison'),'native final exit footer'+detail);
 assert.deepEqual(hashes(),before,'runtime, assets, active backend and test/controller/helpers stay frozen');return result;
}
try{
 const baseline=run('positive',source);assert.equal(baseline.exit,0,'native baseline must pass: '+JSON.stringify(baseline.failed)+'; '+baseline.log);assert.deepEqual(baseline.failed,[]);console.log('OK - native comparison baseline completes28 green guards');
 for(const fault of cases){const result=run(fault.name,fault.copy());assert.equal(result.exit,1,'genuine display fault must exit1: '+fault.name);assert.deepEqual(result.failed,manifest.filter(name=>fault.failed.includes(name)),'exact intended failures: '+fault.name+'; '+result.log);console.log('OK - '+fault.name+' completes28 identical guards and rejects exactly '+result.failed.length+' named failures');}
 proof.success=true;console.log('OK - all native comparison exits, manifests and frozen inputs match');
}catch(error){proof.error=error.message;throw error;}
finally{proof.frozenAfter=hashes();save();assert.deepEqual(proof.frozenAfter,before,'final frozen inputs');fs.rmSync(temporary,{recursive:true,force:true});console.log('Evidence: '+evidence);}
