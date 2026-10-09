'use strict';
// Run the complete native keyboard test against a temporary source counterexample. The real
// checkout and assets stay untouched; all runs must execute the same 39 named guards in order.
// A second genuine old-code case removes only the two immediate native hint-layout updates.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html');
const frozenFiles=[game,path.join(root,'kepler-graphics.css'),path.join(root,'tests/test_schirmfrage.js'),__filename,
 ...fs.readdirSync(root).filter(name=>/^kepler-gfx-[a-z-]+\.png$/.test(name)).sort().map(name=>path.join(root,name))];
// The PR polish job supplies mocked API data and checks out only the frontend. Include a
// real sibling backend when present; every file actually present remains strictly frozen.
const backend=path.resolve(root,'../kolonie-kepler7-backend/server.js');
if(fs.existsSync(backend))frozenFiles.push(backend);
const hashes=()=>frozenFiles.map(file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
const frozenHashes=hashes();
const guard="if(!menu.classList.contains('open') || !fensterObenauf(menu))return;";
const source=fs.readFileSync(game,'utf8');
assert.equal(source.split(guard).length,2,'unique native command-menu gating anchor');
const expected=[
 '4-Menü: geschlossenes Menü beansprucht Escape nicht',
 '4-Menü: ein verdecktes Menü beansprucht weder Escape noch Tab'
];
const hintFrom=source.indexOf('  function hideTabHint(){'),hintTo=source.indexOf('  // Berichte sind nach Erstellung unveränderlich',hintFrom);
assert(hintFrom>=0&&hintTo>hintFrom,'unique native first-hint function region');
const hintFunctions=source.slice(hintFrom,hintTo),hintSync='    bildRuhigHalten();';
assert.equal(hintFunctions.split(hintSync).length,3,'exactly the two new native hint height updates');
const oldHintSource=source.slice(0,hintFrom)+hintFunctions.split(hintSync).join('')+source.slice(hintTo);
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
assert.equal(baseline.checks.length,39,'baseline must execute the complete native keyboard manifest:\n'+baseline.output);
assert(baseline.checks.every(c=>c.ok),'baseline lost native keyboard guards:\n'+baseline.output);
assert(baseline.output.includes('OK - Schirmfrage'),'baseline did not reach its final guard');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-command-menu-'));
const counterfile=path.join(directory,'unguarded-menu.html'),hintCounterfile=path.join(directory,'delayed-hint-layout.html');
try{
 fs.writeFileSync(counterfile,source.replace(guard,''));
 const counter=run(counterfile);
 assert.equal(counter.result.status,1,'counterexample did not fail normally:\n'+counter.output);
 assert.deepEqual(counter.checks.map(c=>c.name),baseline.checks.map(c=>c.name),'native keyboard guard names/count changed:\n'+counter.output);
 assert.deepEqual(counter.checks.filter(c=>!c.ok).map(c=>c.name),expected,'counterexample rejected unrelated native guards:\n'+counter.output);
 for(const width of [390,900])assert(counter.checks.some(c=>c.name===width+': J: keine Skriptfehler'&&c.ok),'native JavaScript guard missing at '+width);
 assert(counter.output.includes('FAIL - Schirmfrage'),'counterexample did not reach its final guard');
 fs.writeFileSync(hintCounterfile,oldHintSource);
 const hintCounter=run(hintCounterfile);
 assert.equal(hintCounter.result.status,1,'old native hint layout did not fail normally:\n'+hintCounter.output);
 assert.deepEqual(hintCounter.checks.map(c=>c.name),baseline.checks.map(c=>c.name),'old native hint layout lost guard names/count:\n'+hintCounter.output);
 assert.deepEqual(hintCounter.checks.filter(c=>!c.ok).map(c=>c.name),[
  '900: 1c-anker: das Kartenmenue liess sich oeffnen (sonst ist 1c ungeprueft)'
 ],'old native hint layout rejected unrelated guards or missed the real 900px menu failure:\n'+hintCounter.output);
 for(const width of [390,900])assert(hintCounter.checks.some(c=>c.name===width+': J: keine Skriptfehler'&&c.ok),'old native hint layout JavaScript guard missing at '+width);
 assert(hintCounter.output.includes('FAIL - Schirmfrage'),'old native hint layout did not reach its final guard');
 assert.deepEqual(hashes(),frozenHashes,'tested game/assets/backend/test/controller changed during the counterexample');
 console.log('OK - native keyboard baseline passes all '+baseline.checks.length+' guards');
 console.log('OK - unguarded command menu rejects only its two closed/covered guards');
 console.log('OK - original browser and JavaScript guards keep identical names/count and remain green');
 console.log('OK - old native hint layout rejects only the real 900px menu-persistence guard');
 console.log('OK - both counterexamples finish all 39 native guards with identical manifests and frozen source hashes');
}finally{
 if(fs.existsSync(counterfile))fs.unlinkSync(counterfile);
 if(fs.existsSync(hintCounterfile))fs.unlinkSync(hintCounterfile);
 fs.rmdirSync(directory);
}
