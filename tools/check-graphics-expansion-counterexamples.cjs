'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const [fault,label,minFailures=1,maxFailures=minFailures] of [
 ['forwarding','fortress upgrade executes exactly one native defense action'],
 ['prerequisites','unmet prerequisite remains visibly locked'],
 ['cache','a browser retaining the previous CSS receives the new usable controls'],
 ['catalogue','all native buildings and defense facilities are directly visible with their actual names and local levels'],
 ['catalogue-focus','catalogue keyboard selection moves focus to the updated native details'],
 ['catalogue-scroll','',1,8]
]){
 const r=spawnSync(process.execPath,['tests/test_graphics_expansion.js'],{cwd:root,env:{...process.env,K7_GFX_EXPANSION_FAULT:fault},encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
 const output=(r.stdout||'')+(r.stderr||''),failures=output.split('\n').filter(l=>l.startsWith('FAIL - '));
 const intended=failures.every(line=>fault==='catalogue-scroll'
   ? /^FAIL - (basis|verteidigung) distant catalogue selection brings updated details into view at (320|390|756|1487)px/.test(line)
   : line.startsWith('FAIL - '+label));
 if(r.status!==1||failures.length<minFailures||failures.length>maxFailures||!intended){
   console.error(output);throw Error(fault+': expected exactly its intended failed check; exit '+r.status);
 }
 console.log('OK - '+fault+' rejects the intended fault');console.log(failures.join('\n'));
}
