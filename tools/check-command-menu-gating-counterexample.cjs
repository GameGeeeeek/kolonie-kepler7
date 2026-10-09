'use strict';
// Run the complete native keyboard test against a temporary source counterexample. The real
// checkout and assets stay untouched; both runs must execute the same named guards in order.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html');
const guard="if(!menu.classList.contains('open') || !fensterObenauf(menu))return;";
const source=fs.readFileSync(game,'utf8');
assert.equal(source.split(guard).length,2,'unique native command-menu gating anchor');
const expected=[
 '4-Menü: geschlossenes Menü beansprucht Escape nicht',
 '4-Menü: ein verdecktes Menü beansprucht weder Escape noch Tab'
];
function run(file){
 const result=spawnSync(process.execPath,['tests/http-run.js','test_schirmfrage.js'],{
  cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file},encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024
 });
 const output=(result.stdout||'')+(result.stderr||'');
 assert.equal(result.error,undefined,'keyboard test process failed: '+result.error);
 const checks=output.split(/\r?\n/).flatMap(line=>{
  const match=/^(OK\s*|FAIL)\s+-\s+(.+?)(?: \| |$)/.exec(line);
  return match&&match[2]!=='Schirmfrage'?[{name:match[2],ok:match[1].trim()==='OK'}]:[];
 });
 return {result,output,checks};
}
const baseline=run(game);
assert.equal(baseline.result.status,0,'native keyboard baseline is not green:\n'+baseline.output);
assert(baseline.checks.length>=30&&baseline.checks.every(c=>c.ok),'baseline lost native keyboard guards:\n'+baseline.output);
assert(baseline.output.includes('OK - Schirmfrage'),'baseline did not reach its final guard');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-command-menu-'));
const counterfile=path.join(directory,'unguarded-menu.html');
try{
 fs.writeFileSync(counterfile,source.replace(guard,''));
 const counter=run(counterfile);
 assert.equal(counter.result.status,1,'counterexample did not fail normally:\n'+counter.output);
 assert.deepEqual(counter.checks.map(c=>c.name),baseline.checks.map(c=>c.name),'native keyboard guard names/count changed:\n'+counter.output);
 assert.deepEqual(counter.checks.filter(c=>!c.ok).map(c=>c.name),expected,'counterexample rejected unrelated native guards:\n'+counter.output);
 for(const width of [390,900])assert(counter.checks.some(c=>c.name===width+': J: keine Skriptfehler'&&c.ok),'native JavaScript guard missing at '+width);
 assert(counter.output.includes('FAIL - Schirmfrage'),'counterexample did not reach its final guard');
 console.log('OK - native keyboard baseline passes all '+baseline.checks.length+' guards');
 console.log('OK - unguarded command menu rejects only its two closed/covered guards');
 console.log('OK - original browser and JavaScript guards keep identical names/count and remain green');
}finally{
 if(fs.existsSync(counterfile))fs.unlinkSync(counterfile);
 fs.rmdirSync(directory);
}
