'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const [fault,label] of [
 ['forwarding','fortress upgrade executes exactly one native defense action'],
 ['prerequisites','unmet prerequisite remains visibly locked'],
 ['cache','a browser retaining the previous CSS receives the new usable controls']
]){
 const r=spawnSync(process.execPath,['tests/test_graphics_expansion.js'],{cwd:root,env:{...process.env,K7_GFX_EXPANSION_FAULT:fault},encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
 const output=(r.stdout||'')+(r.stderr||''),failures=output.split('\n').filter(l=>l.startsWith('FAIL - '));
 if(r.status!==1||failures.length!==1||!failures[0].startsWith('FAIL - '+label)){
   console.error(output);throw Error(fault+': expected exactly its intended failed check; exit '+r.status);
 }
 console.log('OK - '+fault+' rejects the intended fault');console.log(failures[0]);
}
