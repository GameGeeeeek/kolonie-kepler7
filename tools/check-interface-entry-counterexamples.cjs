'use strict';
// Each actual broken HTML/CSS copy runs all 66 unchanged native entry guards.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html'),sheet=path.join(root,'kepler-graphics.css');
const {manifest,labels,variants}=require(path.join(root,'tests/test_interface_entry.js'));
assert.equal(manifest.length,66);assert.equal(new Set(manifest).size,66);
const source=fs.readFileSync(game,'utf8'),css=fs.readFileSync(sheet,'utf8');
const replace=(input,old,next)=>{assert.equal(input.split(old).length,2,'unique genuine source anchor: '+old);return input.replace(old,next);};
const contrastStart='/* interface-clarity:entry */',contrastEnd='#loginModal .login-card { background:#0d1224; box-sizing:border-box; }';
assert.equal(css.split(contrastStart).length,2);assert.equal(css.split(contrastEnd).length,2);
const from=css.indexOf(contrastStart),to=css.indexOf(contrastEnd,from);assert(to>from);
const linkStart='#loginModal .login-secondary-link {',linkEnd='#loginModal :is(.login-secondary-link,.login-tab,input,.login-submit):focus-visible {';
assert.equal(css.split(linkStart).length,2);assert.equal(css.split(linkEnd).length,2);
const linkFrom=css.indexOf(linkStart),linkTo=css.indexOf(linkEnd,linkFrom);assert(linkTo>linkFrom);
const namesFor=keys=>variants.flatMap(v=>keys.map(key=>v.language+'/'+v.width+': '+labels[key]));
const cases=[
 {name:'old-landing-contrast',html:source,css:css.slice(0,from)+css.slice(to),failed:namesFor(['hero','header','stats'])},
 {name:'scrim-hidden',html:source,css:css+'\n#loginOverlay .ll-sky-scrim { opacity:0!important; }\n',failed:namesFor(['hero'])},
 {name:'unassociated-labels',html:['loginUsername','loginEmail','loginPassword','forgotUsername','resetNewPassword'].reduce((copy,id)=>replace(copy,'for="'+id+'"',''),source),css,
  failed:[...namesFor(['login','focus','register','forgot']),...['de','en'].flatMap(language=>['resetLabel','resetFocus'].map(key=>language+'/reset: '+labels[key]))]},
 {name:'small-password-link',html:source,css:css.slice(0,linkFrom)+css.slice(linkTo),failed:namesFor(['forgotHit'])}
];
const files=[game,sheet,path.join(root,'kepler-english.json'),path.join(root,'service-worker.js'),path.join(root,'marketing-screenshots.js'),path.join(root,'tests/test_interface_entry.js'),__filename,
 path.join(root,'tests/http-run.js'),path.join(root,'tests/lib/http-test-origin.js'),path.join(root,'tests/lib/umgebung.js'),path.join(root,'tests/lib/spieldatei.js'),
 ...fs.readdirSync(root).filter(n=>/^kepler-gfx-[a-z-]+\.(?:png|webp)$/.test(n)).sort().map(n=>path.join(root,n))];
const {SERVER_JS}=require(path.join(root,'tests/lib/spieldatei.js'));if(process.env.KEPLER_BACKEND_SERVER)assert(fs.existsSync(process.env.KEPLER_BACKEND_SERVER),'configured actual backend must exist');if(SERVER_JS)files.push(SERVER_JS);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hashes=()=>Object.fromEntries(files.map(file=>[path.relative(root,file),hash(file)])),before=hashes();
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-interface-entry-'));
const evidence=path.resolve(root,'../interface-clarity-2026-10-14','entry-counter-'+new Date().toISOString().replace(/[:.]/g,''));fs.mkdirSync(evidence,{recursive:true});
const proof={manifest,frozenBefore:before,baseline:null,cases:[],success:false};
function run(name,html,stylesheet){
 const htmlPath=path.join(temporary,name+'.html'),cssPath=path.join(temporary,name+'.css');fs.writeFileSync(htmlPath,html);fs.writeFileSync(cssPath,stylesheet);
 const child=spawnSync(process.execPath,['tests/http-run.js','test_interface_entry.js'],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:htmlPath,KEPLER_ENTRY_CSS:cssPath},encoding:'utf8',timeout:180000,maxBuffer:12*1024*1024});
 const stdout=child.stdout||'',stderr=child.stderr||'',log=path.join(evidence,name+'.log');fs.writeFileSync(log,stdout+stderr);
 const checks=stdout.split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL) - (.*?)(?: \| .*)?$/.exec(line);return m&&m[2]!=='Native interface entry'?[{name:m[2],ok:m[1]==='OK'}]:[];});
 const result={name,exit:child.status,signal:child.signal,error:child.error?String(child.error):null,sourceSha256:hash(htmlPath),cssSha256:hash(cssPath),checks,failed:checks.filter(c=>!c.ok).map(c=>c.name),log,logSha256:hash(log)};
 // Save raw results even when a baseline or child setup assertion fails.
 fs.writeFileSync(path.join(evidence,name+'.json'),JSON.stringify(result,null,2)+'\n');
 assert.equal(child.error,undefined,'native child must finish: '+log+'\n'+stdout+stderr);assert.equal(child.signal,null);assert.equal(stderr.trim(),'','unexpected native stderr: '+log+'\n'+stderr);
 assert.deepEqual(checks.map(c=>c.name),manifest,'complete identical native names/order: '+log+'\n'+stdout);
 assert(checks.at(-1).ok&&checks.at(-2).ok,'JavaScript and HTTP guards must stay green: '+log+'\n'+stdout);
 assert(stdout.split(/\r?\n/).includes('66 checks, '+result.failed.length+' failures'),'complete native footer: '+log);
 assert(stdout.split(/\r?\n/).includes((child.status===0?'OK':'FAIL')+' - Native interface entry'),'native final exit footer: '+log);
 assert.deepEqual(hashes(),before,'source/assets/backend/helper/test/controller changed');return result;
}
try{
 proof.baseline=run('positive',source,css);assert.equal(proof.baseline.exit,0,'baseline must pass: '+JSON.stringify(proof.baseline.failed)+'; '+proof.baseline.log);assert.deepEqual(proof.baseline.failed,[]);
 console.log('OK - native entry baseline completes all66 guards with green JavaScript and HTTP');
 for(const fault of cases){const actual=run(fault.name,fault.html,fault.css);proof.cases.push(actual);assert.equal(actual.exit,1,'genuine fault must exit 1: '+fault.name+' '+actual.log);assert.deepEqual(actual.failed,manifest.filter(name=>fault.failed.includes(name)),'exact intended failures: '+fault.name+' '+actual.log);console.log('OK - '+fault.name+' completes all66 guards and rejects exactly '+actual.failed.length+' named failures');}
 proof.success=true;console.log('OK - all native entry manifests, exit contracts and frozen source hashes are preserved');
}finally{proof.frozenAfter=hashes();assert.deepEqual(proof.frozenAfter,before,'final frozen sources');fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(proof,null,2)+'\n');fs.rmSync(temporary,{recursive:true,force:true});console.log('Evidence: '+evidence);}
