'use strict';
// Isolated real-browser counterexamples. The native test owns its ephemeral HTTP
// server, cookies and SW; only genuine HTML/SW copies are changed, never sources.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html'),worker=path.join(root,'service-worker.js');
const source=fs.readFileSync(game,'utf8').replace(/\r\n/g,'\n'),sw=fs.readFileSync(worker,'utf8').replace(/\r\n/g,'\n');
const manifest=[
 'German starts the actual authenticated saved game',
 'German keeps all thirteen native pointer navigation actions',
 'German makes no English catalogue request',
 'German preserves player-owned names and original server save keys',
 'German native bootstrap and navigation have no JavaScript errors',
 'English makes one same-origin content-versioned JSON request without the session cookie',
 'English sends no authentication or save request while the real catalogue response is held',
 'English does not initialize native game handlers before the catalogue response',
 'English starts the authenticated game after the actual catalogue response',
 'English translates the original navigation labels',
 'English translates the menu position label, both options and saved-preference hint',
 'English keeps all thirteen native pointer navigation actions',
 'English protects authored-label player names and original server save keys',
 'English registers its native worker even after load preceded the held catalogue response',
 'English completes native navigation with exactly one catalogue fetch',
 'English native bootstrap and navigation have no JavaScript errors',
 ...['404','invalid'].flatMap(mode=>[
  mode+' catalogue failure still starts the authenticated game in German',
  mode+' fallback keeps English preference and native landing/settings retry notices',
  mode+' fallback preserves protected names and original save keys',
  mode+' fallback retries English through the real settings language control',
  mode+' fallback and native retry have no JavaScript errors'
 ]),
 'The actual native service worker controls the isolated HTTP game',
 'The actual worker caches the versioned JSON under its own resource URL',
 'The English catalogue never replaces the native HTML shell cache',
 'A second cached catalogue fetch causes no background HTTP request',
 'A poisoned HTML catalogue cache is rejected and replaced by one real JSON fetch',
 'An HTTP 200 HTML fallback is not retained as a versioned English catalogue',
 'The actual worker permits a native English retry after the server returns valid JSON',
 'Worker cache recovery preserves player-owned names and original save keys',
 'Native worker cache, poison recovery and retry have no JavaScript errors',
 'All isolated native language scenarios finish without JavaScript or HTTP fixture errors'
];
assert.equal(manifest.length,36);
const failNames=(...starts)=>manifest.filter(name=>starts.some(start=>name.startsWith(start)));
function replace(text,old,next){assert.equal(text.split(old).length,2,'one genuine source mutation: '+old);return text.replace(old,next);}
const declaration=/^const K7_TRANSLATIONS = K7_LANGUAGE === "en" \? await k7LoadEnglishCatalogue\("(kepler-english\.json\?v=[a-f0-9]{16})"\) : \{\};$/m;
const match=declaration.exec(source);assert(match,'native optional async catalogue declaration');
const cases=[
 {name:'eager-german',html:()=>replace(source,match[0],'const K7_TRANSLATIONS = await k7LoadEnglishCatalogue('+JSON.stringify(match[1])+');'),failed:failNames('German makes no English')},
 {name:'premature-main',html:()=>replace(source,match[0],match[0].replace('? await ','? ')),failed:failNames(
  'English sends no authentication','English does not initialize','English translates the original','English translates the menu',
  '404 catalogue failure','404 fallback keeps','404 fallback retries','invalid catalogue failure','invalid fallback keeps','invalid fallback retries',
  'An HTTP 200 HTML','The actual worker permits')},
 {name:'credentials',html:()=>replace(source,"fetch(url, {headers:{Accept:'application/json'}, credentials:'omit', signal:controller.signal})",
  "fetch(url, {headers:{Accept:'application/json'}, credentials:'include', signal:controller.signal})"),failed:failNames('English makes one same-origin')},
 {name:'fallback-language',html:()=>replace(source,"K7_LANGUAGE = 'de';",'void K7_LANGUAGE;'),failed:failNames(
  '404 catalogue failure','404 fallback keeps','404 fallback retries','invalid catalogue failure','invalid fallback keeps','invalid fallback retries',
  'An HTTP 200 HTML','The actual worker permits')},
 {name:'protected-name',html:()=>replace(source,'id="commandPlayerName" translate="no"','id="commandPlayerName"'),failed:failNames('English protects authored-label','Worker cache recovery preserves')},
 {name:'load-readiness',html:()=>replace(source,"if (document.readyState === 'complete') k7RegisterServiceWorker();\n    else window.addEventListener('load', k7RegisterServiceWorker, { once: true });",
  "window.addEventListener('load', k7RegisterServiceWorker, { once: true });"),failed:failNames('English registers its native worker')},
 {name:'sw-background',sw:()=>replace(sw,'if (await validEnglishCatalogue(cached)) return cached;',
  'if (await validEnglishCatalogue(cached)) { fetch(req).catch(() => {}); return cached; }'),failed:failNames('A second cached catalogue')},
 {name:'sw-poison',sw:()=>{
  const functions=[...sw.matchAll(/async function validEnglishCatalogue\(response\) \{[\s\S]*?\n\}/g)];assert.equal(functions.length,1,'native catalogue validator');
  return replace(sw,functions[0][0],'async function validEnglishCatalogue(response) { return true; }');
 },failed:failNames('A poisoned HTML','An HTTP 200 HTML','The actual worker permits')},
 {name:'accept-html',html:()=>replace(source,"headers:{Accept:'application/json'}, credentials:'omit', signal:controller.signal",
  "headers:{Accept:'text/html'}, credentials:'omit', signal:controller.signal"),failed:failNames('English makes one same-origin',
  'The actual worker caches','The English catalogue never','A second cached catalogue','A poisoned HTML')}
];
const requested=process.argv.slice(2);assert(requested.every(name=>cases.some(item=>item.name===name)),'unknown native lazy-language counterexample');
const frozen=[game,worker,path.join(root,'kepler-english.json'),path.join(root,'kepler-graphics.css'),path.join(root,'tests/test_lazy_language_catalog.js'),__filename,
 path.join(root,'tests/lib/umgebung.js'),path.join(root,'tests/lib/spieldatei.js'),
 ...fs.readdirSync(root).filter(name=>/^kepler-gfx-[a-z-]+\.(?:png|webp)$/.test(name)).sort().map(name=>path.join(root,name))];
const backend=path.resolve(root,'../kolonie-kepler7-backend/server.js');if(fs.existsSync(backend))frozen.push(backend);
const hashes=()=>frozen.map(file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
const before=hashes(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-lazy-native-')),results=[];
const evidence=path.resolve(root,'../grafik-ladezeiten-2026-10-12');fs.mkdirSync(evidence,{recursive:true});
function run(name,html=game,serviceWorker=worker){
 const p=spawnSync(process.execPath,['tests/test_lazy_language_catalog.js'],{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,
  env:{...process.env,KEPLER_SPIELDATEI:html,KEPLER_SERVICE_WORKER:serviceWorker,KEPLER_LAZY_CASE:name}});
 const output=(p.stdout||'')+(p.stderr||'');const log=path.join(evidence,'lazy-language-native-'+name+'.log');fs.writeFileSync(log,output);
 assert.equal(p.error,undefined,name+' native process could not finish:\n'+output);assert.equal(p.signal,null,name+' native process signalled');
 assert.equal(p.stderr,'',name+' unexpected native stderr:\n'+output);
 const records=output.split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL) - (.+?)(?: \| |$)/.exec(line);return m&&m[2]!=='Lazy language catalogue'?[{ok:m[1]==='OK',name:m[2]}]:[];});
 assert.deepEqual(records.map(r=>r.name),manifest,name+' native names/order/count changed:\n'+output);
 const failed=records.filter(r=>!r.ok).map(r=>r.name),summary=output.split(/\r?\n/).filter(line=>/^\d+ checks, \d+ failures$/.test(line));
 assert.deepEqual(summary,[manifest.length+' checks, '+failed.length+' failures'],name+' complete final native summary');
 assert.equal(output.trim().split(/\r?\n/).at(-1),(p.status===0?'OK':'FAIL')+' - Lazy language catalogue',name+' final native result');
 assert(records.filter(r=>/JavaScript|HTTP fixture errors/.test(r.name)).every(r=>r.ok),name+' native JavaScript/HTTP guards must remain green');
 assert.deepEqual(hashes(),before,name+' frozen game/assets/backend/guards changed');return {name,status:p.status,guards:records.length,failed,log};
}
try{
 const baseline=run('normal');assert.equal(baseline.status,0,'normal native language baseline must be green');assert.deepEqual(baseline.failed,[]);results.push(baseline);
 console.log('OK - native language baseline completes all '+manifest.length+' independent guards');
 for(const item of cases.filter(item=>!requested.length||requested.includes(item.name))){
  let html=game,serviceWorker=worker;
  if(item.html){html=path.join(directory,item.name+'.html');fs.writeFileSync(html,item.html());}
  if(item.sw){serviceWorker=path.join(directory,item.name+'.js');fs.writeFileSync(serviceWorker,item.sw());}
  const result=run(item.name,html,serviceWorker);assert.equal(result.status,1,item.name+' must fail normally');
  assert.deepEqual(result.failed,item.failed,item.name+' missing/unrelated native failures');results.push(result);
  console.log('OK - '+item.name+' completes all '+manifest.length+' native guards and rejects exactly '+item.failed.length+' intended failures');
 }
 assert.deepEqual(hashes(),before,'native language final frozen snapshot');
 fs.writeFileSync(path.join(evidence,'lazy-language-native-counter-proof.json'),JSON.stringify({manifest,results,frozen,before,after:hashes()},null,2)+'\n');
 console.log('OK - every native language counterexample preserves all frozen sources');
}finally{
 const resolved=path.resolve(directory);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));
 assert(path.basename(resolved).startsWith('kepler-lazy-native-'),'cleanup remains within the owned temp directory');fs.rmSync(resolved,{recursive:true,force:true});
}
