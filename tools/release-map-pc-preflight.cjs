// Temporary Gaming-PC evidence controller; never admit this file to the release branch.
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),backendRoot=path.join(root,'.review-backend');
const out=path.join(root,'.release-map-evidence');
const expectedBackend='00fe250194f419e1b0063f24da146bbb5c7041c7';
const expectedOriginal='212a406c7b32626efff31daf5d7319419ee8d1eb';
fs.mkdirSync(out,{recursive:false});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const gitAt=(cwd,...args)=>cp.execFileSync('git',['-C',cwd,...args],{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const report={startedUTC:new Date().toISOString(),endedUTC:null,passed:false,head:gitAt(root,'rev-parse','HEAD'),
  tree:gitAt(root,'rev-parse','HEAD^{tree}'),backend:gitAt(backendRoot,'rev-parse','HEAD'),
  runner:process.env.RUNNER_NAME,os:process.env.RUNNER_OS,run:process.env.GITHUB_RUN_ID,
  attempt:process.env.GITHUB_RUN_ATTEMPT,job:process.env.GITHUB_JOB,cases:[]};
const saveReport=()=>{
  const file=path.join(out,'admission.json'),temp=path.join(out,'admission.json.tmp');
  fs.writeFileSync(temp,JSON.stringify(report,null,2)+'\n');fs.renameSync(temp,file);
};
function snapshot(cwd){
  const files=gitAt(cwd,'ls-files','-z').split('\0').filter(Boolean).sort();
  const entries=Object.fromEntries(files.map(file=>{
    try{
      const target=path.join(cwd,file),stat=fs.lstatSync(target);
      const data=stat.isSymbolicLink()?Buffer.from(fs.readlinkSync(target)):fs.readFileSync(target);
      return [file,{sha256:sha(data),bytes:data.length,type:stat.isSymbolicLink()?'symlink':'file'}];
    }catch(error){return [file,{error:error.code||error.message}];}
  }));
  return {head:gitAt(cwd,'rev-parse','HEAD'),tree:gitAt(cwd,'rev-parse','HEAD^{tree}'),files:entries};
}
const freeze=()=>({frontend:snapshot(root),backend:snapshot(backendRoot)});
const records=log=>log.split(/\r?\n/).flatMap(line=>{
  const m=/^(OK|FAIL)\s+- (.*)$/.exec(line);
  return m?[{ok:m[1]==='OK',name:m[2].split(' | ')[0]}]:[];
});
function gpuRecords(log){
  const gpu=[],errors=[];
  for(const line of log.split(/\r?\n/))if(line.startsWith('[chromium-gpu] ')){
    try{
      const entry=JSON.parse(line.slice('[chromium-gpu] '.length));
      require(path.join(root,'tests/lib/chromium-gpu.js')).assertHardware(entry);gpu.push(entry);
    }catch(error){errors.push(error.message);}
  }
  return {gpu,errors};
}
let frozen;
function verifyFrozen(){
  const after=freeze();report.after=after;
  const equal=JSON.stringify(frozen)===JSON.stringify(after);
  if(!equal)report.freezeEverChanged=true;
  return {equal,snapshotSha256:sha(JSON.stringify(after))};
}
function run(spec){
  const item={name:spec.name,args:spec.args,timeoutMs:spec.timeoutMs||180000,
    expectedExit:spec.negative?1:0,startedUTC:new Date().toISOString(),passed:false};
  report.cases.push(item);saveReport();
  let result;
  try{
    const env={...process.env};
    // Every positive uses the actual checkout. Only genuine original counterexamples select a copy.
    delete env.KEPLER_SPIELDATEI;delete env.KEPLER_HTTP_TEST_ORIGIN;
    if(spec.game)env.KEPLER_SPIELDATEI=spec.game;
    if(spec.generate){
      const generated=path.join(out,'generated');fs.mkdirSync(generated);
      assert.deepEqual(fs.readdirSync(generated),[],'Generator destination must start empty');
      for(const file of ['weltraum_kolonie.html','patchnotes-archiv.json'])
        fs.copyFileSync(path.join(root,file),path.join(generated,file),fs.constants.COPYFILE_EXCL);
      env.KEPLER_WURZEL=generated;item.generatedRoot=path.relative(root,generated);
    }
    result=cp.spawnSync(process.execPath,spec.args,{cwd:root,env,encoding:'utf8',
      detached:true,timeout:item.timeoutMs,killSignal:'SIGKILL',maxBuffer:64*1024*1024});
    // Kill only this invocation's process group, including a browser orphaned by a timed-out test.
    if(result.pid){try{process.kill(-result.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')item.cleanupError=error.message;}}
    const log=(result.stdout||'')+(result.stderr||'');
    fs.writeFileSync(path.join(out,spec.name+'.log'),log,{flag:'wx'});
    const gpu=gpuRecords(log);
    Object.assign(item,{status:result.status,signal:result.signal,error:result.error?.message,
      bytes:Buffer.byteLength(log),sha256:sha(log),records:records(log),gpu:gpu.gpu,gpuErrors:gpu.errors,
      footers:log.split(/\r?\n/).filter(line=>/^(?:PASS|FAIL|\d+ checks, \d+ failures|\d+ Prüfungen, \d+ fehlgeschlagen)$/.test(line))});
    item.passed=!item.error&&!item.signal&&!item.cleanupError&&item.status===item.expectedExit&&item.gpuErrors.length===0;
    if(spec.native)item.passed=item.passed&&item.gpu.length>0&&item.records.length>0;
    if(!spec.negative)item.passed=item.passed&&item.records.every(record=>record.ok);
    if(spec.required)item.passed=item.passed&&item.footers.some(line=>/^\d+ Prüfungen, 0 fehlgeschlagen$/.test(line));
    if(spec.native&&!spec.negative)item.passed=item.passed&&item.footers.some(line=>line==='PASS'||/^\d+ checks, 0 failures$/.test(line));
    if(spec.generate){
      const generated=path.join(out,'generated'),files={};
      for(const file of ['weltraum_kolonie.html','patchnotes-archiv.json','patchnotes.html','patchnotes.xml','version.txt']){
        const data=fs.readFileSync(path.join(generated,file));assert(data.length>0,'Generated file must not be empty: '+file);
        files[file]={bytes:data.length,sha256:sha(data)};
      }
      assert.equal(files['weltraum_kolonie.html'].sha256,frozen.frontend.files['weltraum_kolonie.html'].sha256,
        'Native generator must preserve the exact tested candidate HTML');
      assert.equal(files['patchnotes-archiv.json'].sha256,frozen.frontend.files['patchnotes-archiv.json'].sha256,
        'Native generator must preserve every byte of the existing archive');
      item.generatedFiles=files;report.generated={root:item.generatedRoot,files};
    }
    if(spec.spacing){
      // The existing counter writes its actual two child logs into a fresh OS-temp directory.
      const paths=log.split(/\r?\n/).flatMap(line=>line.startsWith('Evidence: ')?[line.slice(10)]:[]);
      assert.equal(paths.length,1,'Existing spacing counter must identify exactly one evidence directory');
      const source=fs.realpathSync(paths[0]),temp=fs.realpathSync(os.tmpdir());
      assert.equal(path.dirname(source),temp,'Counter evidence must come from its own OS-temp directory');
      assert.match(path.basename(source),/^overview-hint-spacing-/);
      const target=path.join(out,'spacing-counterexample');fs.mkdirSync(target);
      item.retained={};
      for(const name of ['positive.log','negative.log','result.json','positive.html','only-kepler-hint-text-33.html']){
        const data=fs.readFileSync(path.join(source,name));fs.writeFileSync(path.join(target,name),data,{flag:'wx'});
        item.retained[name]={bytes:data.length,sha256:sha(data)};
      }
      const positive=fs.readFileSync(path.join(target,'positive.log'),'utf8'),negative=fs.readFileSync(path.join(target,'negative.log'),'utf8');
      const a=records(positive),b=records(negative),failed=b.filter(record=>!record.ok);
      const witness=JSON.parse(fs.readFileSync(path.join(target,'result.json'),'utf8'));
      item.nested={positive:a,negative:b,gpu:[...gpuRecords(positive).gpu,...gpuRecords(negative).gpu],witness};
      item.passed=item.passed&&a.length===15&&a.every(record=>record.ok)&&b.length===a.length
        &&a.every((record,index)=>record.name===b[index].name)
        &&failed.length===1&&failed[0].name.startsWith('4c:')&&item.nested.gpu.length>=2
        &&gpuRecords(positive).errors.length===0&&gpuRecords(negative).errors.length===0
        &&witness.positiveExit===0&&witness.negativeExit===1&&witness.checks===15
        &&witness.sourceSha256===frozen.frontend.files['weltraum_kolonie.html'].sha256
        &&witness.positiveSha256===item.retained['positive.html'].sha256
        &&witness.positiveSha256===witness.sourceSha256
        &&witness.negativeSha256===item.retained['only-kepler-hint-text-33.html'].sha256;
    }
    if(spec.negative){
      const positive=report.cases.find(entry=>entry.name===spec.positive),failed=item.records.filter(record=>!record.ok);
      const ids=failed.map(record=>record.name.split(':')[0]);
      item.expectedFailedIds=spec.failedIds;
      item.passed=item.passed&&item.records.length===spec.guardCount
        &&positive?.records.length===spec.guardCount
        &&item.records.every((record,index)=>record.name===positive.records[index].name)
        &&JSON.stringify(ids.slice().sort())===JSON.stringify(spec.failedIds.slice().sort())
        &&item.footers.at(-1)==='FAIL';
    }
  }catch(error){item.controllerError=error.stack||String(error);item.passed=false;}
  finally{
    item.endedUTC=new Date().toISOString();
    try{item.freeze=verifyFrozen();if(!item.freeze.equal)item.passed=false;}catch(error){item.freezeError=error.stack||String(error);item.passed=false;report.freezeEverChanged=true;}
    saveReport();
    console.log(spec.name+': '+JSON.stringify({status:item.status,passed:item.passed,checks:item.records?.length,
      failed:item.records?.filter(record=>!record.ok).map(record=>record.name),gpu:item.gpu?.map(entry=>entry.renderer),error:item.controllerError||item.error}));
  }
}
try{
  assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(report.os,'Linux');
  assert.match(report.runner||'',/^saschaneu-kolonie-kepler7-/);
  assert.equal(process.env.PC_CHROMIUM_GPU,'1');assert.equal(process.env.PC_CHROMIUM_GPU_AVAILABLE,'1');
  assert(process.env.DISPLAY,'Verified native GPU display is required');assert.equal(report.backend,expectedBackend);
  gitAt(root,'diff','--quiet','HEAD','--');gitAt(backendRoot,'diff','--quiet','HEAD','--');
  frozen=freeze();report.before=frozen;
  for(const repository of Object.values(frozen))assert(Object.values(repository.files).every(file=>!file.error),'Every tracked source must be readable');
  saveReport();
  // Export the real parent object byte-for-byte, never reconstruct a deliberately broken source.
  const original=cp.execFileSync('git',['-C',root,'show','HEAD^:weltraum_kolonie.html'],{maxBuffer:16*1024*1024});
  const originalBlob=crypto.createHash('sha1').update(Buffer.from('blob '+original.length+'\0')).update(original).digest('hex');
  assert.equal(originalBlob,expectedOriginal,'Parent HTML must be the exact unchanged e703/5eaf original');
  const originalPath=path.join(out,'genuine-parent-original.html');fs.writeFileSync(originalPath,original,{flag:'wx'});
  report.original={ref:'HEAD^:weltraum_kolonie.html',parent:gitAt(root,'rev-parse','HEAD^'),blob:originalBlob,bytes:original.length,sha256:sha(original)};
  const cases=[{name:'required',args:['tests/run.js','--nur-pflicht'],required:true}];
  const positives=[
    ['overview','test_uebersicht_schrift.js'],['labels','test_beschriftung_ausweichen.js'],
    ['region-hints','test_regionshinweise.js'],['map-directions','test_kartenrichtungen.js'],
    ['map-layers','test_karte_ebenen.js'],['map-menu-scroll','test_kartenmenue_scrollen.js'],
    ['sector-view','test_sektoransicht.js'],['landmarks','test_landmarken.js'],
    ['map-captions','test_kartenbeschriftung.js'],['sector-hulls','test_sektorregionen.js']
  ];
  for(const [name,file]of positives)cases.push({name,args:['tests/http-run.js',file],native:true});
  cases.push({name:'spacing-counter',args:['tools/check-overview-hint-spacing-counterexample.cjs'],spacing:true,timeoutMs:600000});
  for(const [name,file]of [['research-quest','test_command_quest_closed_layout.js'],['escape-windows','test_escape_fenster.js'],['visual-details','test_visual_details.js']])
    cases.push({name,args:['tests/http-run.js',file],native:true,timeoutMs:name==='escape-windows'?600000:180000});
  cases.push({name:'original-overview',args:['tests/http-run.js','test_uebersicht_schrift.js'],native:true,negative:true,
    game:originalPath,positive:'overview',guardCount:15,failedIds:['4b','4c']});
  cases.push({name:'original-labels',args:['tests/http-run.js','test_beschriftung_ausweichen.js'],native:true,negative:true,
    game:originalPath,positive:'labels',guardCount:8,failedIds:['1h']});
  cases.push({name:'release-metadata-build',args:['build-patchnotes.js'],generate:true});
  report.expectedCases=cases.map(entry=>entry.name);saveReport();
  for(const spec of cases)run(spec); // Intentionally continue through every independent case after failures.
}catch(error){report.error=error.stack||String(error);console.error(report.error);}
finally{
  if(frozen){try{report.finalFreeze=verifyFrozen();}catch(error){report.freezeError=error.stack||String(error);report.freezeEverChanged=true;}}
  report.endedUTC=new Date().toISOString();
  report.passed=!report.error&&!report.freezeError&&!report.freezeEverChanged&&report.finalFreeze?.equal===true
    &&report.cases.length===18&&report.expectedCases?.length===18
    &&report.cases.every((item,index)=>item.name===report.expectedCases[index]&&item.passed===true);
  saveReport();console.log('PC map release admission: '+(report.passed?'PASS':'FAIL'));process.exitCode=report.passed?0:1;
}
