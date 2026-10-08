'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const [fault,label] of [['icons','collection restores all three audited module icons'],['emphasis','collection renders native emphasis without literal HTML'],['enemies','each native NPC has its own identity-keyed fleet illustration'],['navigation','compact navigation remains legible and saves vertical space']]){
  const r=spawnSync(process.execPath,['tests/test_graphic_polish.js'],{cwd:root,env:{...process.env,K7_POLISH_FAULT:fault},encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  const out=(r.stdout||'')+(r.stderr||''),failures=out.split('\n').filter(l=>l.startsWith('FAIL - '));
  if(r.status!==1||!failures.length||failures.some(l=>!l.startsWith('FAIL - '+label))||!/OK - graphic improvements produce no JavaScript errors/.test(out))throw Error(fault+' did not reject only the intended behavioral fault:\n'+out);
  console.log('OK - '+fault+' rejects the intended regression ('+failures.length+' checks)');
}
