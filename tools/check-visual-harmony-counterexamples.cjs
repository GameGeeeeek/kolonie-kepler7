'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
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
  assert(!r.error&&!r.signal&&!(r.stderr||''),fault+': process must complete normally without stderr');
  const names=output.split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL) - (.*)$/.exec(line);return m?[m[2].replace(/\s+[\[{].*$/,'')]:[];});
  const middle=['dialog','font'].includes(fault)?['body-mounted fleet dialog keeps its visible keyboard ring','body-mounted dialog heading uses the illustrated heading font']:fault==='theme'?['native theme selection remains effective and persisted',label]:[label];
  assert.deepEqual(names,['actual stylesheet and controlled probe response arrived',...middle,'native game interaction completes without script errors'],fault+': the complete native probe guard list must run');
  assert(output.includes('OK - native game interaction completes without script errors'),fault+': final JavaScript guard must be green');
  const summaries=[...output.matchAll(/^(\d+) harmony checks, (\d+) failed\r?$/gm)];
  assert(summaries.length===1&&Number(summaries[0][1])===names.length&&Number(summaries[0][2])===1,fault+': complete final summary is required');
  if(r.status!==1||failures.length!==1||!failures[0].startsWith('FAIL - '+label)){
    console.error(output);throw Error(fault+': expected exactly the intended failed check; exit '+r.status);
  }
  console.log('OK - '+fault+' rejects the intended fault');console.log(failures[0]);
}
