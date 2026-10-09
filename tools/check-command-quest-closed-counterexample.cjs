'use strict';
// Restore each genuine former CSS rule independently, with the complete native test unchanged.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),cssFile=path.join(root,'kepler-graphics.css');
const sourceFiles=['weltraum_kolonie.html','kepler-graphics.css','tests/test_command_quest_closed_layout.js','tools/check-command-quest-closed-counterexample.cjs'].map(f=>path.join(root,f));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),frozen=sourceFiles.map(hash);
const css=fs.readFileSync(cssFile,'utf8');
const manifest=[
 'saved quest fixture loads through the native welcome exit at 320',
 ...['first','last'].flatMap(position=>[
  'native quest popup opens before the '+position+' action at 320',
  'native '+position+' quest action is physically reachable at 320',
  'native '+position+' quest action opens its actual target at 320',
  'native popup close restores summary focus after the '+position+' action at 320'
 ]),
 'native menu returns to the real research panel at 320',
 'research uses a genuine native classic scrollbar at 320',
 'closed native daily quest popup has no retained layout boxes at 320',
 'research renders positive real names including an unbroken long word at 320',
 'all visible native research names fit their own content boxes at 320',
 'research content has no horizontal overflow within the real client width at 320',
 'native quest layout actions complete without JavaScript errors'
];
const cases=[
 ['quest-closed','body.command-ui #commandQuests:not([open]) #dailyQuestBar { display:none; }',[
  // Chromium's UA content-visibility may contain document overflow while still retaining
  // real popup/descendant rectangles. The layout-box contract rejects that exact old state.
  'closed native daily quest popup has no retained layout boxes at 320'
 ]],
 ['research-word','  body.command-ui #research .bname { overflow-wrap:anywhere; }',[
  'all visible native research names fit their own content boxes at 320',
  'research content has no horizontal overflow within the real client width at 320'
 ]]
];
const requested=process.argv.slice(2);assert(requested.every(name=>cases.some(c=>c[0]===name)),'Unknown controlled quest-layout regression');
function run(file,exit){
 const result=spawnSync(process.execPath,['tests/http-run.js','test_command_quest_closed_layout.js'],{cwd:root,env:{...process.env,K7_QUEST_CLOSED_CSS:file||''},encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
 assert(!result.error&&!result.signal,'Native quest layout process did not finish normally: '+result.error);
 assert.equal(result.stderr||'','','Native quest layout wrote an unexpected error');
 assert.equal(result.status,exit,'Unexpected native quest layout exit:\n'+result.stdout);
 const output=result.stdout||'',records=output.split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL) - (.+?)(?: \| |$)/.exec(line);return m?[{name:m[2],ok:m[1]==='OK'}]:[];});
 const summaries=[...output.matchAll(/^(\d+) checks, (\d+) failures\r?$/gm)];
 assert.equal(summaries.length,1,'Complete native quest summary missing:\n'+output);
 assert.equal(+summaries[0][1],manifest.length,'Native quest test lost guards');
 assert.equal(+summaries[0][2],records.filter(r=>!r.ok).length,'Native quest failure count differs');
 assert.deepEqual(records.map(r=>r.name),manifest,'Complete native quest guard names/order differ');
 assert(records.some(r=>r.name===manifest.at(-1)&&r.ok),'Final native JavaScript guard must remain green');
 assert.deepEqual(sourceFiles.map(hash),frozen,'The source changed during the native quest counterexample');
 return {records,output};
}
const baseline=run('',0);assert(baseline.records.every(r=>r.ok),'Native quest baseline must be entirely green');
console.log('OK - native quest baseline passes all '+manifest.length+' complete guards');
for(const [name,anchor,expected] of cases.filter(c=>!requested.length||requested.includes(c[0]))){
 assert.equal(css.split(anchor).length,2,'Unique genuine CSS regression anchor: '+name);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-quest-layout-')),file=path.join(directory,'counterexample.css');
 try{
  fs.writeFileSync(file,css.replace(anchor,''));
  const counter=run(file,1),failed=counter.records.filter(r=>!r.ok).map(r=>r.name);
  console.log('MEASURE - '+name+': '+JSON.stringify(failed));
  assert.deepEqual(counter.records.map(r=>r.name),baseline.records.map(r=>r.name),'Positive/negative quest manifests differ');
  assert.deepEqual(failed,expected,'Only the exact intended native quest layout guards may fail:\n'+counter.output);
  console.log('OK - '+name+' rejects only its '+expected.length+' exact layout guards; original native actions and JavaScript remain green');
 }finally{if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(directory);}
}
