'use strict';
// Every genuine HTML copy runs the complete independent native manifest.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html'),{manifest,labels,viewports,files}=require('../tests/test_void_sector_invitation.js');
assert.equal(manifest.length,20);assert.equal(new Set(manifest).size,20);
const source=fs.readFileSync(game,'utf8'),replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'unique genuine invitation anchor');return s.replace(a,b);};
const cases=[
 {name:'missing-attribution',copy:()=>replace(source,'href="https://void.gamegeeeeek.de/?ref=kepler7"','href="https://void.gamegeeeeek.de/"'),failed:viewports.map(v=>labels.link(v.width))},
 {name:'ignored-dismissal',copy:()=>replace(source,"dismissed = dismissed || localStorage.getItem('kepler7-void-sector-invitation-hidden') === '1';","dismissed = dismissed || false;"),failed:[labels.persisted]},
 {name:'inert-dismiss',copy:()=>replace(source,'    invitation.hidden = true;','    void invitation;'),failed:[labels.dismiss]}
];
const args=process.argv.slice(2);assert(new Set(args).size===args.length&&args.every(x=>cases.some(c=>c.name===x)),'unknown or duplicate invitation case');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),all=[...files,__filename],snapshot=()=>Object.fromEntries(all.map(p=>[path.relative(root,p),hash(p)])),before=snapshot();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-void-invitation-')),evidence=path.resolve(root,'../void-sector-invitation-2026-10-15','counter-'+new Date().toISOString().replace(/[:.]/g,''));fs.mkdirSync(evidence,{recursive:true});
const proof={manifest,baseline:null,cases:[],frozenBefore:before,frozenAfter:null,success:false};
function run(name,html){const file=path.join(temp,name+'.html');fs.writeFileSync(file,html);fs.writeFileSync(path.join(evidence,name+'.html'),html);const child=spawnSync(process.execPath,['tests/test_void_sector_invitation.js'],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file},encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});const out=child.stdout||'',err=child.stderr||'';fs.writeFileSync(path.join(evidence,name+'.stdout.log'),out);fs.writeFileSync(path.join(evidence,name+'.stderr.log'),err);
 assert.equal(child.error,undefined,'native child finishes: '+name+'\n'+out+err);assert.equal(child.signal,null);assert.equal(err,'','native child stderr: '+name+'\n'+out+err);
 const guards=[...out.matchAll(/^(OK|FAIL) - (.+?)(?: \| |$)/gm)].filter(m=>m[2]!=='Void sector invitation').map(m=>({name:m[2],ok:m[1]==='OK'}));assert.deepEqual(guards.map(g=>g.name),manifest,'all twenty original names and order: '+name+'\n'+out);const failed=guards.filter(g=>!g.ok).map(g=>g.name);assert(guards.at(-1).ok&&guards.at(-2).ok,'native JS/HTTP and frozen sources stay green');
 const foot=[...out.matchAll(/^(OK|FAIL) - Void sector invitation \| (\{.*\})$/gm)];assert.equal(foot.length,1);assert.deepEqual(JSON.parse(foot[0][2]),{checks:20,failures:failed.length});assert.equal(foot[0][1],failed.length?'FAIL':'OK');assert.equal(child.status,failed.length?1:0);assert.deepEqual(snapshot(),before);
 return {name,exit:child.status,signal:child.signal,error:child.error||null,sourceSha256:hash(file),guards,failed,stdoutSha256:hash(path.join(evidence,name+'.stdout.log')),stderrSha256:hash(path.join(evidence,name+'.stderr.log'))};}
try{
 proof.baseline=run('normal',source);assert.equal(proof.baseline.exit,0);assert.deepEqual(proof.baseline.failed,[]);console.log('OK - native invitation baseline completes all 20 original guards');
 for(const c of cases.filter(c=>!args.length||args.includes(c.name))){const r=run(c.name,c.copy());proof.cases.push(r);assert.equal(r.exit,1);assert.deepEqual(r.failed,manifest.filter(n=>c.failed.includes(n)));console.log('OK - '+c.name+' completes all 20 guards and rejects exactly '+r.failed.length);}
 proof.frozenAfter=snapshot();assert.deepEqual(proof.frozenAfter,before);proof.success=true;console.log('OK - invitation source and every original asset remain frozen');
}catch(error){proof.error=error.stack;proof.frozenAfter=snapshot();throw error;}
finally{fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify(proof,null,2)+'\n');fs.rmSync(temp,{recursive:true,force:true});}
