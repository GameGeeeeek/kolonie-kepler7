'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const [fault,label] of [
  ['surface','native and illustrated panels follow the same surface token'],
  ['focus','affordable native order retains a stable inset keyboard ring'],
  ['dialog','body-mounted fleet dialog keeps its visible keyboard ring'],
  ['font','body-mounted dialog heading uses the illustrated heading font'],
  ['warning','animated warning tab retains a stable keyboard ring'],
  ['subtab','subtab keyboard ring appears immediately without a shadow transition'],
  ['theme','selected theme inline shadow cannot hide keyboard focus'],
  ['mobile','main panel fits 390px sammlung'],
  ['hover','settings jump links retain their hover feedback']
]){
  const r=spawnSync(process.execPath,['tests/test_visual_harmony.js'],{cwd:root,env:{...process.env,K7_HARMONY_FAULT:fault,K7_HARMONY_PROBE:fault},encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  const output=(r.stdout||'')+(r.stderr||''),failures=output.split('\n').filter(l=>l.startsWith('FAIL - '));
  if(r.status!==1||failures.length!==1||!failures[0].startsWith('FAIL - '+label)){
    console.error(output);throw Error(fault+': expected exactly the intended failed check; exit '+r.status);
  }
  console.log('OK - '+fault+' rejects the intended fault');console.log(failures[0]);
}
