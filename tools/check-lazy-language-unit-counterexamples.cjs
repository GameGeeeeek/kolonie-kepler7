'use strict';
// Run the actual compiler/loader units against genuine module copies in memory.
// No browser, network or repository mutation; all 24 original guards stay green.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),runtime=path.join(root,'tools/i18n/runtime.js'),catalogue=path.join(root,'tools/i18n/catalog.cjs');
const manifest=[
 'translation quality permits locale formatting while preserving values and signs',
 'translation quality rejects lost variables, duplicate rewards and changed markup',
 'registered display labels translate without modifying definitions or save keys',
 'player-owned objects and names identical to labels are never translated',
 'HTML text and allowed attributes translate, but IDs, URLs and handlers do not',
 'template interpolation, side-effect count and escape semantics survive',
 'optional property access preserves null short-circuiting',
 'history is byte-identical and not translated',
 'API payloads, selection keys and comparisons remain original',
 'default German behavior and unknown translations are retained',
 'dynamic authored messages preserve names and numeric captures',
 'dynamic translation prefers the most specific authored sentence',
 'dynamic captures keep existing HTML escaping at the display boundary',
 'German mode retains dynamic messages and unknown text',
 'supported URL language overrides stored preference; invalid languages fall back',
 'blocked storage does not prevent boot and URL selection',
 'HTML translations cannot introduce executable markup',
 'locale changes only supported display formatting calls',
 'tagged template raw/cooked text is never rewritten',
 'frozen properties respect Proxy invariants',
 'language switch saves before navigation, preserving unrelated URL parameters',
 'compiler rejects stacking and missing script/IIFE anchors',
 'source guard still sees nicheDesc as a genuine property read',
 'scanner ignores script/style contents and preserves numeric entities',
 'external compiler removes catalogue payloads and versions the same-origin URL by their bytes',
 'external German bootstrap makes zero catalogue fetches and keeps native data unchanged',
 'external English fetches exactly one content-versioned JSON file without credentials',
 'external English blocks game and authentication until response and dictionary are ready',
 'external URL language overrides stored locale and unsupported queries use the stored default',
 'external bootstrap tolerates blocked storage with and without an explicit English query',
 'external network failure resumes German without mutating locale, names or save keys',
 'external HTTP 404 falls back without parsing its error document or mutating player data',
 'external invalid JSON resumes German and leaves the English preference retryable',
 'external invalid dictionary shapes and values fail closed before native game code',
 'external fifteen-second abort resumes German, clears its timer and preserves the save'
];
const added=manifest.slice(24);
const cases=[
 {name:'inline-catalogue',target:catalogue,old:'const value = external ?',next:'const value = false ?',failed:added.filter(name=>name!==added[1])},
 {name:'eager-german',target:catalogue,old:`'K7_LANGUAGE === "en" ? await k7LoadEnglishCatalogue('+JSON.stringify(catalogueUrl(catalogue))+') : {}'`,
  next:`'await k7LoadEnglishCatalogue('+JSON.stringify(catalogueUrl(catalogue))+')'`,failed:[added[1],added[4],added[5]]},
 {name:'premature-main',target:catalogue,old:'? await k7LoadEnglishCatalogue(',next:'? k7LoadEnglishCatalogue(',failed:added.slice(2)},
 {name:'credentials',target:runtime,old:"credentials:'omit'",next:"credentials:'include'",failed:[added[2]]},
 {name:'fallback-language',target:runtime,old:"K7_LANGUAGE = 'de';",next:'void K7_LANGUAGE;',failed:added.slice(6)},
 {name:'invalid-dictionary',target:runtime,old:"Object.entries(catalogue).some(([key,value]) => !key || typeof value !== 'string' || !value.trim())",next:'false',failed:[added[9]]},
 {name:'timeout-budget',target:runtime,old:'controller.abort(), 15000',next:'controller.abort(), 16000',failed:[added[10]]}
];
const requested=process.argv.slice(2);assert(requested.every(name=>cases.some(item=>item.name===name)),'unknown lazy-language unit counterexample');
const frozen=['weltraum_kolonie.html','kepler-graphics.css','kepler-english.json','service-worker.js',
 'tools/i18n/test.cjs','tools/i18n/runtime.js','tools/i18n/catalog.cjs','tools/i18n/build.cjs','tools/i18n/quality.cjs',path.relative(root,__filename)].map(name=>path.join(root,name));
const backend=path.resolve(root,'../kolonie-kepler7-backend/server.js');if(fs.existsSync(backend))frozen.push(backend);
const hashes=()=>frozen.map(file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
const before=hashes(),results=[],directory=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-lazy-unit-'));
const evidence=path.resolve(root,'../grafik-ladezeiten-2026-10-12');fs.mkdirSync(evidence,{recursive:true});
function run(name,hook){
 const p=spawnSync(process.execPath,[...(hook?['--require',hook]:[]),'--test','--test-reporter=tap','tools/i18n/test.cjs'],
  {cwd:root,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
 const output=(p.stdout||'')+(p.stderr||'');fs.writeFileSync(path.join(evidence,'lazy-language-unit-'+name+'.log'),output);
 assert.equal(p.error,undefined,name+' subprocess error');assert.equal(p.signal,null,name+' subprocess signal');assert.equal(p.stderr,'',name+' unexpected stderr');
 const guards=[...output.matchAll(/^(ok|not ok) \d+ - (.+)$/gm)].map(m=>({ok:m[1]==='ok',name:m[2]}));
 assert.deepEqual(guards.map(g=>g.name),manifest,name+' changed/incomplete independent unit manifest');
 for(const line of ['# tests 35','# cancelled 0','# skipped 0','# todo 0'])assert(output.includes(line),name+' missing summary '+line);
 assert.deepEqual(hashes(),before,name+' frozen source/test/controller changed');
 return {name,status:p.status,guards:guards.length,failed:guards.filter(g=>!g.ok).map(g=>g.name)};
}
try{
 const baseline=run('normal');assert.equal(baseline.status,0);assert.deepEqual(baseline.failed,[]);results.push(baseline);
 console.log('OK - all 35 compiler/loader units pass with the original 24 guards retained');
 for(const item of cases.filter(item=>!requested.length||requested.includes(item.name))){
  assert.equal(fs.readFileSync(item.target,'utf8').split(item.old).length,2,item.name+' unique genuine module anchor');
  const hook=path.join(directory,item.name+'.cjs');
  fs.writeFileSync(hook,`'use strict';const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');const target=${JSON.stringify(item.target)},old=${JSON.stringify(item.old)},next=${JSON.stringify(item.next)},nativeRead=fs.readFileSync;function fault(source){assert.equal(source.split(old).length,2,'exact source fault');return source.replace(old,next);}if(target.endsWith('runtime.js')){fs.readFileSync=function(file,...args){const result=nativeRead.call(this,file,...args);return typeof file==='string'&&path.resolve(file)===target?fault(result):result;};}else{const nativeLoad=Module._extensions['.js'];function load(module,file){if(path.resolve(file)===target)return module._compile(fault(nativeRead(file,'utf8')),file);return nativeLoad(module,file);}Module._extensions['.js']=load;Module._extensions['.cjs']=load;}\n`);
  const result=run(item.name,hook);assert.equal(result.status,1,item.name+' must reject its loader fault');
  assert.deepEqual(result.failed,item.failed,item.name+' missing/unrelated failure set');
  assert(result.failed.every(name=>added.includes(name)),item.name+' original 24 guards must remain green');
  results.push(result);console.log('OK - '+item.name+' completes all 35 units and rejects exactly '+result.failed.length+' intended new guards');
 }
 assert.deepEqual(hashes(),before,'final source/test/controller snapshot changed');
 fs.writeFileSync(path.join(evidence,'lazy-language-unit-proof.json'),JSON.stringify({manifest,results,frozen,before,after:hashes()},null,2)+'\n');
 console.log('OK - strict lazy-language unit counterexamples preserve all frozen sources');
}finally{
 const resolved=path.resolve(directory);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));
 assert(path.basename(resolved).startsWith('kepler-lazy-unit-'),'cleanup remains inside its owned temp directory');fs.rmSync(resolved,{recursive:true,force:true});
}
