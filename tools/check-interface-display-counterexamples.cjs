'use strict';
// Genuine source/CSS omissions. Every child completes the same native manifest.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html'),cssFile=path.join(root,'kepler-graphics.css');
const source=fs.readFileSync(game,'utf8'),css=fs.readFileSync(cssFile,'utf8');
const names=[
 'display preferences default to standard and balanced',
 'display preferences offer six named native options',
 ...[390,768,1280].flatMap(width=>['left','top'].map(position=>'display sizes keep native navigation and every building accessible at '+width+' '+position)),
 'graphics profiles reduce completed decorative canvas paints without removing artwork',
 'economy background remains static between native wakeups',
 'native changes persist both presentation preferences in the account',
 'real reload restores display size graphics profile and menu position',
 'unsupported saved display values use this account defaults',
 'presentation actions finish without JavaScript or fixture HTTP errors'
];
assert.equal(names.length,14);
const frozen=[game,cssFile,path.join(root,'kepler-english.json'),path.join(root,'service-worker.js'),__filename,
 path.join(root,'tests/test_interface_display.js'),path.join(root,'tests/http-run.js'),
 ...fs.readdirSync(path.join(root,'tests/lib')).filter(name=>name.endsWith('.js')).sort().map(name=>path.join(root,'tests/lib',name)),
 ...fs.readdirSync(root).filter(name=>/^kepler-gfx-[a-z-]+\.(png|webp)$/.test(name)).sort().map(name=>path.join(root,name))];
const {SERVER_JS}=require(path.join(root,'tests/lib/spieldatei.js'));
if(process.env.KEPLER_BACKEND_SERVER)assert(fs.existsSync(process.env.KEPLER_BACKEND_SERVER),'Configured actual backend must exist');
if(SERVER_JS)frozen.push(SERVER_JS);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),snapshot=()=>frozen.map(file=>({file,sha256:hash(file)}));
const before=snapshot(),stamp=new Date().toISOString().replace(/[:.]/g,''),evidence=path.resolve(root,'../interface-clarity-2026-10-14','display-counter-'+stamp);
fs.mkdirSync(evidence,{recursive:true});
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-display-'));
function replace(bytes,old,next){assert.equal(bytes.split(old).length,2,'Unique actual implementation anchor: '+old);return bytes.replace(old,next);}
// The genuine omitted scroll repair has complete measured manifests on both hosts.
// Ubuntu's native sticky geometry also covers the 1280px left-menu select.
const preferenceVisibilityByPlatform={
 win32:[[390,'left'],[390,'top'],[768,'top'],[1280,'top']],
 linux:[[390,'left'],[390,'top'],[768,'top'],[1280,'left'],[1280,'top']]
};
assert(Object.prototype.hasOwnProperty.call(preferenceVisibilityByPlatform,process.platform),'Preference visibility fault has not been measured on this platform');
function run(file,style,label){
 const started=Date.now(),result=spawnSync(process.execPath,['tests/http-run.js','test_interface_display.js'],{
  cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file,KEPLER_SHIP_CSS:style||''},encoding:'utf8',timeout:180000,maxBuffer:12*1024*1024});
 fs.writeFileSync(path.join(evidence,label+'.stdout.log'),result.stdout||'');fs.writeFileSync(path.join(evidence,label+'.stderr.log'),result.stderr||'');
 assert.equal(result.error,undefined,label+' failed to finish');assert.equal(result.signal,null,label+' was terminated');
 const guards=(result.stdout||'').split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL) - (.+?)(?: \| |$)/.exec(line);return m&&m[2]!=='Interface display'?[{name:m[2],ok:m[1]==='OK'}]:[];});
 assert.deepEqual(guards.map(g=>g.name),names,label+' lost or reordered a native guard');
 assert(guards.at(-1).ok,label+' has JavaScript/HTTP errors');
 const footer=(result.stdout||'').match(/^(OK|FAIL) - Interface display \| (\{.*\})$/m);assert(footer,label+' missing full native footer');
 const data=JSON.parse(footer[2]),failed=guards.filter(g=>!g.ok).map(g=>g.name);
 assert.equal(data.checks,14);assert.equal(data.failures,failed.length);
 return {label,exit:result.status,elapsedMs:Date.now()-started,failed,guards,stdoutSha256:hash(path.join(evidence,label+'.stdout.log')),stderrSha256:hash(path.join(evidence,label+'.stderr.log'))};
}
const cases=[
 {name:'restore-preferences',html:()=>replace(replace(source,
  "state.uiDisplaySize = ['compact','large'].includes(parsedSave.uiDisplaySize) ? parsedSave.uiDisplaySize : 'standard';","state.uiDisplaySize = 'standard';"),
  "state.uiGraphicsQuality = ['economy','full'].includes(parsedSave.uiGraphicsQuality) ? parsedSave.uiGraphicsQuality : 'balanced';","state.uiGraphicsQuality = 'balanced';"),
  failed:['real reload restores display size graphics profile and menu position']},
 {name:'decorative-density',html:()=>replace(source,'return index < Math.max(1,Math.round(total*scale));','return true;'),
  failed:['graphics profiles reduce completed decorative canvas paints without removing artwork']},
 {name:'display-size-styles',style:()=>{
  const starts=[...css.matchAll(/\/\* interface-clarity:display\r?\n/g)],endMarker='/* interface-clarity:display:end */';
  assert.equal(starts.length,1,'Unique density CSS block');assert.equal(css.split(endMarker).length,2,'Unique density CSS end');
  const start=starts[0].index,end=css.indexOf(endMarker,start);assert(end>start);
  return css.slice(0,start)+css.slice(end+endMarker.length);
 },failed:[390,768,1280].flatMap(width=>['left','top'].map(position=>'display sizes keep native navigation and every building accessible at '+width+' '+position))}
 ,{name:'content-typography',style:()=>{
  const startMarker='/* interface-clarity:display:content-type */',endMarker='/* interface-clarity:display:content-type:end */';
  assert.equal(css.split(startMarker).length,2,'Unique actual summary typography start');assert.equal(css.split(endMarker).length,2,'Unique actual summary typography end');
  const start=css.indexOf(startMarker),end=css.indexOf(endMarker,start);assert(end>start);
  return css.slice(0,start)+css.slice(end+endMarker.length);
 },failed:['left','top'].map(position=>'display sizes keep native navigation and every building accessible at 1280 '+position)}
 ,{name:'settings-textarea-sizing',style:()=>replace(css,
  'body.command-ui #tab-einstellungen textarea { box-sizing:border-box; min-width:0; max-width:100%; }',
  'body.command-ui #tab-einstellungen textarea { box-sizing:content-box; min-width:0; max-width:100%; }'),
  failed:['left','top'].map(position=>'display sizes keep native navigation and every building accessible at 390 '+position)}
 ,{name:'preference-visibility',html:()=>replace(source,
  "if(control.isConnected&&document.activeElement===control)control.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});",
  'void control;'),
  failed:preferenceVisibilityByPlatform[process.platform].map(([width,position])=>'display sizes keep native navigation and every building accessible at '+width+' '+position)}
];
const selected=process.argv.slice(2);assert(selected.every(name=>cases.some(c=>c.name===name)),'Unknown genuine display fault');
const results=[];
try{
 const normal=run(game,null,'normal');results.push(normal);assert.equal(normal.exit,0,'Native display baseline red');assert.deepEqual(normal.failed,[]);
 for(const item of cases.filter(c=>!selected.length||selected.includes(c.name))){
  const file=path.join(scratch,item.name+'.html'),style=item.style?path.join(scratch,item.name+'.css'):null;
  fs.writeFileSync(file,item.html?item.html():source);if(style)fs.writeFileSync(style,item.style());
  const counter=run(file,style,item.name);results.push(counter);assert.equal(counter.exit,1,item.name+' must fail normally');assert.deepEqual(counter.failed,item.failed,item.name+' changed its exact failure set');assert.deepEqual(snapshot(),before,'Frozen source changed');
  console.log('OK - '+item.name+' completes all 14 guards and rejects exactly '+item.failed.length+' genuine failures');
 }
 assert.deepEqual(snapshot(),before,'Frozen final source changed');
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({complete:true,before,after:snapshot(),results},null,2)+'\n');
 console.log('OK - display baseline and genuine counters | '+evidence);
}catch(error){fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({complete:false,error:error.message,before,after:snapshot(),results},null,2)+'\n');throw error;}
finally{for(const name of fs.readdirSync(scratch))fs.unlinkSync(path.join(scratch,name));fs.rmdirSync(scratch);}
