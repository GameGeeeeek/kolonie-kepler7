'use strict';
const {spawnSync}=require('node:child_process');
for(const fault of ['touch','missions','catalogue','help-focus','orbital-width','rail-scroll','english-roles']){
 const result=spawnSync(process.execPath,['tests/test_visual_details.js'],{env:{...process.env,K7_DETAIL_FAULT:fault},encoding:'utf8',timeout:180000});
 const output=(result.stdout||'')+(result.stderr||'');
 const expected={touch:'market quantity controls are touch sized',missions:'six expeditions have distinct visible scenes',catalogue:'research grouping keeps every native definition exactly once','help-focus':'keyboard focus survives rebuilding an opened help topic','orbital-width':'orbital choices use the available grid width instead of old narrow scroll cards','rail-scroll':'ship rail preserves its scroll position when selecting a distant hull','english-roles':'all catalogue hull roles use their English labels after a language switch'}[fault];
 if(result.status!==1||!output.includes('FAIL - '+expected)){console.error(output);throw new Error('Counterexample failed to isolate '+fault);}
 console.log('OK - '+fault+' breaks the intended real UI check');
}
