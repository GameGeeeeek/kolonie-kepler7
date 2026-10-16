// Temporary Gaming-PC evidence controller; never admit this file to the release branch.
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),backendRoot=path.join(root,'.review-backend');
const out=path.join(root,'.release-map-evidence');
const expectedBackend='00fe250194f419e1b0063f24da146bbb5c7041c7';
const expectedOriginal='212a406c7b32626efff31daf5d7319419ee8d1eb';
const originalCommit='5eaf11c1c9c3083c10adb61d788f3a6a90c02861';
const originalRef=originalCommit+':weltraum_kolonie.html';
const spacingOriginal='only-kepler-metadata-on-hint-baseline.html';
fs.mkdirSync(out,{recursive:false});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const gitAt=(cwd,...args)=>cp.execFileSync('git',['-C',cwd,...args],{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const report={startedUTC:new Date().toISOString(),endedUTC:null,passed:false,head:gitAt(root,'rev-parse','HEAD'),
  tree:gitAt(root,'rev-parse','HEAD^{tree}'),backend:gitAt(backendRoot,'rev-parse','HEAD'),
  runner:process.env.RUNNER_NAME,os:process.env.RUNNER_OS,run:process.env.GITHUB_RUN_ID,
  attempt:process.env.GITHUB_RUN_ATTEMPT,job:process.env.GITHUB_JOB,cases:[],controlledSources:[]};
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
function evidenceFiles(directory){
  const files={};
  const visit=function(folder){
    for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      const file=path.join(folder,entry.name);
      if(entry.isDirectory())visit(file);
      else{
        assert(entry.isFile(),'Only actual files may be retained as asset evidence');
        const data=fs.readFileSync(file);
        files[path.relative(directory,file)]={bytes:data.length,sha256:sha(data)};
      }
    }
  };
  visit(directory);assert(Object.keys(files).length>0,'Each explicit asset mode must retain native evidence');
  return files;
}
let frozen;
function controlledCopy(name,sourceFile,filename,anchor,replacement){
  const sourcePath=path.join(root,sourceFile),before=fs.readFileSync(sourcePath),text=before.toString('utf8');
  assert(before.equals(Buffer.from(text)),'Controlled source must round-trip byte-for-byte as UTF-8');
  assert.equal(sha(before),frozen.frontend.files[sourceFile].sha256,'Controlled source must match the frozen candidate');
  assert.equal(text.split(anchor).length,2,'Exactly one controlled source anchor: '+name);
  const offset=text.indexOf(anchor),changed=text.slice(0,offset)+replacement+text.slice(offset+anchor.length);
  const restored=changed.slice(0,offset)+anchor+changed.slice(offset+replacement.length);
  assert.equal(restored,text,'Controlled mutation must be exactly reversible: '+name);
  const copy=path.join(out,filename);assert.equal(path.dirname(copy),out);
  fs.writeFileSync(copy,changed,{flag:'wx'});
  const written=fs.readFileSync(copy),after=fs.readFileSync(sourcePath);
  assert(written.equals(Buffer.from(changed)),'Controlled copy must contain exactly the single mutation');
  assert(after.equals(before),'Creating a counterexample must never change its original source');
  report.controlledSources.push({name,sourceFile,copy:path.relative(root,copy),anchor,replacement,
    sourceCharacterOffset:offset,reversibleSingleMutation:true,sourceBytes:before.length,copyBytes:written.length,
    sourceSha256Before:sha(before),copySha256After:sha(written),sourceSha256AfterCreation:sha(after),reversedSha256:sha(restored)});
  return copy;
}
function verifyControlledSources(){
  let equal=true;
  const files=report.controlledSources.map(entry=>{
    try{
      const source=sha(fs.readFileSync(path.join(root,entry.sourceFile))),copy=sha(fs.readFileSync(path.join(root,entry.copy)));
      entry.sourceSha256AfterRun=source;entry.copySha256AfterRun=copy;
      const unchanged=source===entry.sourceSha256Before&&copy===entry.copySha256After;
      if(!unchanged)equal=false;
      return {name:entry.name,sourceSha256:source,copySha256:copy,unchanged};
    }catch(error){equal=false;return {name:entry.name,error:error.code||error.message,unchanged:false};}
  });
  return {equal,files};
}
function verifyFrozen(){
  const after=freeze();report.after=after;
  const equal=JSON.stringify(frozen)===JSON.stringify(after);
  if(!equal)report.freezeEverChanged=true;
  return {equal,snapshotSha256:sha(JSON.stringify(after))};
}
function run(spec){
  const item={name:spec.name,args:spec.args,timeoutMs:spec.timeoutMs||180000,
    expectedExit:spec.negative?1:0,expectedGuardCount:spec.guardCount,startedUTC:new Date().toISOString(),passed:false};
  report.cases.push(item);saveReport();
  let result;
  try{
    const env={...process.env};
    // Reset test-specific state before each independent run, including original-source controls.
    for(const key of ['KEPLER_SPIELDATEI','KEPLER_HTTP_TEST_ORIGIN','KEPLER_WURZEL',
      'KEPLER_ASTEROID_ASSET_MODE','KEPLER_ASTEROID_EVIDENCE_DIR','K7_QUEST_CLOSED_CSS'])delete env[key];
    Object.assign(env,spec.env||{});
    // A historical sabotage mode must never reinterpret a genuine old-source counter's exit.
    delete env.KEPLER_ENTFLECHTER_GEGENPROBE;
    delete env.KEPLER_ESCAPE_GEGENPROBE;
    if(spec.game)env.KEPLER_SPIELDATEI=spec.game;
    if(spec.generate){
      const generated=path.join(out,'generated');fs.mkdirSync(generated);
      assert.deepEqual(fs.readdirSync(generated),[],'Generator destination must start empty');
      for(const file of ['weltraum_kolonie.html','patchnotes-archiv.json'])
        fs.copyFileSync(path.join(root,file),path.join(generated,file),fs.constants.COPYFILE_EXCL);
      env.KEPLER_WURZEL=generated;item.generatedRoot=path.relative(root,generated);
    }
    item.testEnv=Object.fromEntries(['KEPLER_SPIELDATEI','KEPLER_HTTP_TEST_ORIGIN','KEPLER_WURZEL',
      'KEPLER_ASTEROID_ASSET_MODE','KEPLER_ASTEROID_EVIDENCE_DIR','K7_QUEST_CLOSED_CSS'].filter(key=>env[key]!==undefined).map(key=>[key,env[key]]));
    if(spec.assetEvidence){
      assert(['available','unavailable'].includes(env.KEPLER_ASTEROID_ASSET_MODE),'Explicit native asset mode required');
      assert.equal(env.KEPLER_ASTEROID_EVIDENCE_DIR,spec.assetEvidence);
      assert.equal(path.dirname(spec.assetEvidence),out,'Each asset witness must stay in the exclusive evidence directory');
      assert(!fs.existsSync(spec.assetEvidence),'Each asset witness path must start unused');
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
    if(spec.native)item.passed=item.passed&&item.gpu.length>0&&Number.isInteger(spec.guardCount)
      &&spec.guardCount>0&&item.records.length===spec.guardCount;
    if(!spec.negative)item.passed=item.passed&&item.records.every(record=>record.ok);
    if(spec.required)item.passed=item.passed&&item.footers.some(line=>/^\d+ Prüfungen, 0 fehlgeschlagen$/.test(line));
    if(spec.native&&!spec.negative)item.passed=item.passed&&item.footers.some(line=>line==='PASS'||/^\d+ checks, 0 failures$/.test(line));
    if(spec.assetEvidence)item.assetEvidence={directory:path.relative(out,spec.assetEvidence),files:evidenceFiles(spec.assetEvidence)};
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
      for(const name of ['positive.log','negative.log','result.json','positive.html',spacingOriginal]){
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
        &&witness.negativeSha256===item.retained[spacingOriginal].sha256;
    }
    if(spec.positive){
      const positive=report.cases.find(entry=>entry.name===spec.positive);
      item.comparedWith=spec.positive;
      item.guardNamesIdentical=positive?.records?.length===spec.guardCount
        &&item.records.length===spec.guardCount&&item.records.every((record,index)=>record.name===positive.records[index].name);
      item.passed=item.passed&&positive?.passed===true&&item.guardNamesIdentical===true;
    }
    if(spec.negative){
      const failed=item.records.filter(record=>!record.ok);
      const ids=failed.map(record=>record.name.split(':')[0]);
      item.expectedFailedIds=spec.failedIds;
      if(spec.failureFooter!==undefined){
        assert.equal(spec.name,'research-word-negative','Only the actual research counter has a numeric negative footer');
        assert.equal(spec.failureFooter,'16 checks, 2 failures');
      }
      item.expectedFooter=spec.failureFooter??'FAIL';
      item.passed=item.passed&&JSON.stringify(ids.slice().sort())===JSON.stringify(spec.failedIds.slice().sort())
        &&item.footers.at(-1)===item.expectedFooter;
    }
  }catch(error){item.controllerError=error.stack||String(error);item.passed=false;}
  finally{
    item.endedUTC=new Date().toISOString();
    try{item.freeze=verifyFrozen();if(!item.freeze.equal)item.passed=false;}catch(error){item.freezeError=error.stack||String(error);item.passed=false;report.freezeEverChanged=true;}
    item.controlledFreeze=verifyControlledSources();
    if(!item.controlledFreeze.equal){item.passed=false;report.freezeEverChanged=true;}
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
  // Export the pinned genuine old object, independent of later temporary-controller commits.
  assert.equal(gitAt(root,'rev-parse',originalCommit),originalCommit);
  const original=cp.execFileSync('git',['-C',root,'show',originalRef],{maxBuffer:16*1024*1024});
  const originalBlob=crypto.createHash('sha1').update(Buffer.from('blob '+original.length+'\0')).update(original).digest('hex');
  assert.equal(originalBlob,expectedOriginal,'Pinned HTML must be the exact unchanged e703/5eaf original');
  const originalPath=path.join(out,'genuine-parent-original.html');fs.writeFileSync(originalPath,original,{flag:'wx'});
  report.original={ref:originalRef,commit:originalCommit,blob:originalBlob,bytes:original.length,sha256:sha(original)};
  const questCounterFile='tools/check-command-quest-closed-counterexample.cjs';
  const questCounter=fs.readFileSync(path.join(root,questCounterFile),'utf8');
  const researchRules=Array.from(questCounter.matchAll(/\['research-word','([^']+)',\[\s*'([^']+)',\s*'([^']+)'\s*\]\]/g));
  assert.equal(researchRules.length,1,'Existing unchanged quest counter must define exactly one genuine research-word case');
  const [,researchAnchor,...researchFailures]=researchRules[0];
  assert.equal(researchAnchor,'  body.command-ui #research .bname { overflow-wrap:anywhere; }');
  assert.equal(sha(questCounter),frozen.frontend.files[questCounterFile].sha256);
  const researchCss=controlledCopy('research-word-negative','kepler-graphics.css','research-word-without-wrap.css',researchAnchor,'');
  const overlayAnchor='.fwahl-overlay { position:fixed; inset:0;';
  const escapeGap=controlledCopy('escape-gap-negative','weltraum_kolonie.html','escape-overlay-gap.html',overlayAnchor,
    '.fwahl-overlay { position:fixed; inset:0 20px 0 0;');
  const escapeOffset=controlledCopy('escape-offset-negative','weltraum_kolonie.html','escape-overlay-offset.html',overlayAnchor,
    '.fwahl-overlay { position:fixed; inset:20px -20px -20px 20px;');
  report.researchCounterReference={file:questCounterFile,sha256:sha(questCounter),anchor:researchAnchor,expectedFailedNames:researchFailures};
  const cases=[{name:'required',args:['tests/run.js','--nur-pflicht'],required:true}];
  const positives=[
    ['overview','test_uebersicht_schrift.js',15],['labels','test_beschriftung_ausweichen.js',8],
    ['region-hints','test_regionshinweise.js',15],['map-directions','test_kartenrichtungen.js',20],
    ['map-layers','test_karte_ebenen.js',13],['map-menu-scroll','test_kartenmenue_scrollen.js',12],
    ['sector-view','test_sektoransicht.js',9],['landmarks','test_landmarken.js',20],
    ['map-captions','test_kartenbeschriftung.js',28],['sector-hulls','test_sektorregionen.js',8]
  ];
  for(const [name,file,guardCount]of positives)cases.push({name,args:['tests/http-run.js',file],native:true,guardCount});
  const assetCase=function(name,mode,extra={}){
    const directory=path.join(out,name+'-evidence');
    return {name,args:['tests/http-run.js','test_beschriftung_ausweichen.js'],native:true,guardCount:9,
      env:{KEPLER_ASTEROID_ASSET_MODE:mode,KEPLER_ASTEROID_EVIDENCE_DIR:directory},assetEvidence:directory,...extra};
  };
  cases.push(assetCase('labels-assets-available','available'));
  cases.push(assetCase('labels-assets-unavailable','unavailable'));
  cases.push({name:'spacing-counter',args:['tools/check-overview-hint-spacing-counterexample.cjs'],spacing:true,timeoutMs:600000});
  for(const [name,file,guardCount]of [['research-quest','test_command_quest_closed_layout.js',16],['escape-windows','test_escape_fenster.js',35],['visual-details','test_visual_details.js',67]])
    cases.push({name,args:['tests/http-run.js',file],native:true,guardCount,timeoutMs:name==='escape-windows'?600000:180000});
  cases.push({name:'research-word-negative',args:['tests/http-run.js','test_command_quest_closed_layout.js'],native:true,
    negative:true,guardCount:16,positive:'research-quest',failedIds:researchFailures,failureFooter:'16 checks, 2 failures',
    env:{K7_QUEST_CLOSED_CSS:researchCss}});
  for(const [name,game]of [['escape-gap-negative',escapeGap],['escape-offset-negative',escapeOffset]])
    cases.push({name,args:['tests/http-run.js','test_escape_fenster.js'],native:true,negative:true,guardCount:35,
      positive:'escape-windows',game,failedIds:['V4-2a','V4-2b','V5','V9'],timeoutMs:600000});
  cases.push({name:'original-overview',args:['tests/http-run.js','test_uebersicht_schrift.js'],native:true,negative:true,
    game:originalPath,positive:'overview',guardCount:15,failedIds:['4b','4c']});
  cases.push({name:'original-labels',args:['tests/http-run.js','test_beschriftung_ausweichen.js'],native:true,
    game:originalPath,positive:'labels',guardCount:8});
  cases.push(assetCase('original-labels-unavailable','unavailable',{
    negative:true,game:originalPath,positive:'labels-assets-unavailable',failedIds:['1h']}));
  cases.push({name:'release-metadata-build',args:['build-patchnotes.js'],generate:true});
  report.expectedCases=cases.map(entry=>entry.name);
  report.expectedCaseMetadata=cases.map(entry=>({name:entry.name,guardCount:entry.guardCount,
    expectedExit:entry.negative?1:0,assetMode:entry.env?.KEPLER_ASTEROID_ASSET_MODE,
    comparedWith:entry.positive,expectedFailedIds:entry.failedIds,failureFooter:entry.failureFooter}));saveReport();
  for(const spec of cases)run(spec); // Intentionally continue through every independent case after failures.
}catch(error){report.error=error.stack||String(error);console.error(report.error);}
finally{
  if(frozen){try{report.finalFreeze=verifyFrozen();}catch(error){report.freezeError=error.stack||String(error);report.freezeEverChanged=true;}}
  report.finalControlledFreeze=verifyControlledSources();
  if(!report.finalControlledFreeze.equal)report.freezeEverChanged=true;
  report.endedUTC=new Date().toISOString();
  report.passed=!report.error&&!report.freezeError&&!report.freezeEverChanged&&report.finalFreeze?.equal===true
    &&report.cases.length===24&&report.expectedCases?.length===24
    &&report.controlledSources.length===3&&report.finalControlledFreeze.equal===true
    &&report.cases.every((item,index)=>item.name===report.expectedCases[index]&&item.passed===true);
  saveReport();console.log('PC map release admission: '+(report.passed?'PASS':'FAIL'));process.exitCode=report.passed?0:1;
}
