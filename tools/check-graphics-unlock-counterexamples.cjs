'use strict';
// Every genuine broken copy executes the unchanged complete native manifest.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html'),{manifest,labels}=require(path.join(root,'tests/test_graphics_unlock.js'));
assert.equal(manifest.length,36);assert.equal(new Set(manifest).size,36);
const source=fs.readFileSync(game,'utf8'),replace=(input,old,next)=>{assert.equal(input.split(old).length,2,'one genuine native action anchor: '+old);return input.replace(old,next);};
const actual=String.raw`return root && (root.querySelector('['+spec[1]+'="'+key+'"]') || (['building','defense','ship'].includes(kind) ? root.querySelector('[data-unlock="'+key+'"]') : null));`;
const old=String.raw`return root && root.querySelector('['+spec[1]+'="'+key+'"]');`;
const scoped=String.raw`? root.querySelector('[data-unlock="'+key+'"]') : null`;
const nativeDisabled="target.disabled=button.disabled || (kind==='research' && !button.classList.contains('affordable'));";
const cases=[
 {name:'missing-fallback',copy:()=>replace(source,actual,old),failed:[labels.twoAction,labels.twoUnlock,labels.twoUnlockEvent,labels.oneAction,labels.oneUnlock,labels.zeroAction,labels.defenseAction,labels.defenseUnlock,labels.defenseEvent,labels.shipAction,labels.shipUnlock,labels.shipEvent]},
 {name:'wrong-container-scope',copy:()=>replace(source,scoped,scoped.replace('root.querySelector','document.querySelector')),failed:[labels.missingAction,labels.missingUnchanged]},
 {name:'disabled-mirror',copy:()=>replace(source,nativeDisabled,"target.disabled=(kind==='research' && !button.classList.contains('affordable'));"),failed:[labels.qty5,labels.qty10,labels.oneBlocked,labels.zeroAction,labels.poorAction]}
];
const args=process.argv.slice(2),normalOnly=args.includes('--normal-only');assert(!normalOnly||args.length===1);assert(normalOnly||new Set(args).size===args.length&&args.every(n=>cases.some(c=>c.name===n)),'unknown/duplicate native unlock fault');
const files=[game,path.join(root,'kepler-graphics.css'),path.join(root,'kepler-english.json'),path.join(root,'service-worker.js'),path.join(root,'marketing-screenshots.js'),path.join(root,'tests/test_graphics_unlock.js'),__filename,path.join(root,'tests/lib/spieldatei.js'),path.join(root,'tests/lib/umgebung.js'),...fs.readdirSync(root).filter(n=>/^kepler-gfx-[a-z-]+\.(?:png|webp)$/.test(n)).map(n=>path.join(root,n))];
const {SERVER_JS}=require(path.join(root,'tests/lib/spieldatei.js'));if(process.env.KEPLER_BACKEND_SERVER)assert(fs.existsSync(process.env.KEPLER_BACKEND_SERVER),'configured backend source must exist');if(SERVER_JS)files.push(SERVER_JS);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hashes=()=>Object.fromEntries(files.map(f=>[path.relative(root,f),hash(f)])),before=hashes();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-graphics-unlock-')),evidence=path.resolve(root,'../grafik-freischalten-2026-10-13','counter-'+new Date().toISOString().replace(/[:.]/g,''));fs.mkdirSync(evidence,{recursive:true});
function run(name,html){const file=path.join(temp,name+'.html');fs.writeFileSync(file,html);const child=spawnSync(process.execPath,['tests/test_graphics_unlock.js'],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file},encoding:'utf8',timeout:300000,maxBuffer:12*1024*1024}),output=(child.stdout||'')+(child.stderr||'');fs.writeFileSync(path.join(evidence,name+'.log'),output);
 assert.equal(child.error,undefined,'native child must finish: '+output);assert.equal(child.signal,null);assert.equal((child.stderr||'').trim(),'','native child stderr: '+output);
 const records=output.split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL) - (.*?)(?: \| .*)?$/.exec(line);return m&&m[2]!=='Native graphics unlock'?[{name:m[2],ok:m[1]==='OK'}]:[];});
 assert.deepEqual(records.map(r=>r.name),manifest,'all native guard names/order must finish: '+output);assert(records.at(-1).ok&&records.at(-2).ok,'JavaScript and HTTP remain green: '+output);
 const failed=records.filter(r=>!r.ok).map(r=>r.name);assert(output.split(/\r?\n/).includes('36 checks, '+failed.length+' failures'));assert(output.split(/\r?\n/).includes((child.status===0?'OK':'FAIL')+' - Native graphics unlock'));
 assert.deepEqual(hashes(),before,'all native source/asset/backend/guard hashes remain frozen');return {name,exit:child.status,sourceSha256:hash(file),records,failed,log:path.join(evidence,name+'.log'),logSha256:hash(path.join(evidence,name+'.log'))};
}
const proof={manifest,baseline:null,cases:[],frozenBefore:before,frozenAfter:null};
try{const normal=run('positive',source);assert.equal(normal.exit,0);assert.deepEqual(normal.failed,[]);proof.baseline=normal;console.log('OK - native graphic unlock baseline completes all36 guards with green JavaScript/HTTP');
 for(const fault of cases.filter(c=>!normalOnly&&(!args.length||args.includes(c.name)))){const negative=run(fault.name,fault.copy());assert.equal(negative.exit,1,'genuine unlock fault exits 1');assert.deepEqual(negative.failed,manifest.filter(n=>fault.failed.includes(n)),'exact intended native failures: '+fault.name);proof.cases.push(negative);console.log('OK - '+fault.name+' completes all36 identical guards and rejects exactly '+negative.failed.length+' named failures');}
 proof.frozenAfter=hashes();assert.deepEqual(proof.frozenAfter,before);proof.success=true;fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(proof,null,2)+'\n');console.log('OK - every native graphic unlock probe preserves all frozen sources');console.log('Evidence: '+evidence);
}catch(error){proof.success=false;proof.error=error.message;proof.frozenAfter=hashes();fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(proof,null,2)+'\n');throw error;}
finally{fs.rmSync(temp,{recursive:true,force:true});}
