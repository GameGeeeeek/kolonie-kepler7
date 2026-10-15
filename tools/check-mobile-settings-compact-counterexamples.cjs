'use strict';
// Genuine absent entry, old panel-only routing and omitted illustration sizing.
// Every child runs the unchanged HTTP native test, full ordered manifest and exit.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html'),cssFile=path.join(root,'kepler-graphics.css'),test=path.join(root,'tests/test_mobile_settings_compact.js');
const {SERVER_JS}=require(path.join(root,'tests/lib/spieldatei'));
const {deliveredRasterInventory,rasterRuntimeFiles}=require(path.join(root,'tests/test_ship_raster_art'));
const widths=[320,360,390,430,760,1487];
// Deliberately independent of the test's exports: no dropped or renamed guard
// can change a counter's expectation simply by changing the native test.
const names=[...widths.flatMap(w=>[
 'the named settings footer is a physical touch target at '+w,
 'the footer opens the real display section and keeps its native focus at '+w,
 'the upfront menu settings action preserves focus and native drawer return at '+w,
 'compact illustrations preserve native catalogues and actions at '+w]),
 'landscape 844 by 390 leaves usable compact artwork and native actions',
 'all native presentation choices persist through a real reload',
 'the original header and keyboard settings actions reach the same native controls',
 'English large display retains named settings and bounded artwork at 320 and 760',
 'all mobile settings actions finish without JavaScript or unexpected HTTP errors',
 'all 139 runtime and backend files remain frozen through mobile settings actions'];
assert.equal(names.length,30);assert.equal(new Set(names).size,30);
assert.deepEqual(require(test).manifest,names,'Native test and independent controller manifest');
if(process.env.KEPLER_BACKEND_SERVER)assert(fs.existsSync(process.env.KEPLER_BACKEND_SERVER),'Configured actual backend must exist');
const inventory=deliveredRasterInventory(root),runtime=rasterRuntimeFiles(root,game,SERVER_JS,inventory),source=fs.readFileSync(game,'utf8'),css=fs.readFileSync(cssFile,'utf8');
const inputs=[...runtime,...inventory.inputFiles,__filename,test,path.join(root,'tests/test_ship_raster_art.js'),path.join(root,'tests/http-run.js'),...fs.readdirSync(path.join(root,'tests/lib')).filter(n=>n.endsWith('.js')).sort().map(n=>path.join(root,'tests/lib',n))];
assert.equal(new Set(inputs).size,inputs.length,'Unique frozen inputs');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),snapshot=()=>inputs.map(file=>({file,sha256:hash(file)})),before=snapshot();
const evidence=path.resolve(root,'../mobile-settings-compact-2026-10-15','counter-'+new Date().toISOString().replace(/[:.]/g,'')),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-mobile-settings-'));
fs.mkdirSync(evidence,{recursive:true});fs.writeFileSync(path.join(evidence,'before.json'),JSON.stringify(before,null,2)+'\n');
const unique=(bytes,old,next)=>{assert.equal(bytes.split(old).length,2,'Unique actual mutation anchor: '+old);return bytes.replace(old,next);};
const footerHidden=widths.flatMap((w,i)=>[names[i*4],names[i*4+1]]).concat(names[26],names[27]);
// The English scenario deliberately reuses this account's already-open display
// section. Only the six fresh collapsed-section visits and the header/keyboard
// guard reject a panel-only route; no fictitious English failure is required.
const routeOnly=widths.flatMap((w,i)=>[names[i*4+1],names[i*4+2]]).concat(names[26]);
const cases=[
 {name:'hidden-footer',style:()=>css+'\n/* genuine absent persistent entry */\nbody.command-ui #commandSettingsBtn { display:none!important; }\n',failed:footerHidden},
 {name:'missing-upfront-menu',html:()=>unique(source,'<button type="button" data-command-header="headerProfileBtn" aria-controls="tab-einstellungen"><i class="ti ti-adjustments" aria-hidden="true"></i>Einstellungen</button>',''),failed:widths.map((w,i)=>names[i*4+2]).concat(names[24])},
 {name:'panel-only-settings-route',html:()=>unique(source,"    navToQuestTarget({tab:'einstellungen',section:'anzeige'});","    switchTab('einstellungen');"),failed:routeOnly},
 {name:'drawer-sticky-tabs',style:()=>unique(css,'body.command-ui #game-root .command-rail .tabs { position:static; top:auto; z-index:auto; }',''),failed:[320,390,760].map(w=>names[widths.indexOf(w)*4+2]).concat(names[24])},
 {name:'old-illustration-sizes',style:()=>{
  // Omit only the three real scene-size overrides. The independent footer,
  // drawer, typography and image-fitting repairs stay present, so this genuine
  // pre-compact scene layout must finish the other original measurements.
  let result=css;
  for(const selector of ['body.command-ui :is(.gfx-colony,.gfx-defense) .gfx-scene','body.command-ui #shipyardVisual .gfx-scene','body.command-ui #researchVisual .gfx-scene']){
   const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),matches=[...result.matchAll(new RegExp(' '+escaped+' \\{[^}]*\\}','g'))];
   assert.equal(matches.length,1,'Unique actual compact scene rule '+selector);result=unique(result,matches[0][0],'');
  }
  return result;
 },failed:widths.flatMap((w,i)=>w<=900?[names[i*4+3]]:[]).concat(names[24],names[27])}
];
const selected=process.argv.slice(2);assert(selected.every(name=>cases.some(c=>c.name===name)),'Unknown genuine settings fault');
const results=[];
function run(file,style,label){
 const args=['tests/http-run.js','test_mobile_settings_compact.js'],started=Date.now(),child=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file,KEPLER_SHIP_CSS:style||''},encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
 const stdout=path.join(evidence,label+'.stdout.log'),stderr=path.join(evidence,label+'.stderr.log');fs.writeFileSync(stdout,child.stdout||'');fs.writeFileSync(stderr,child.stderr||'');
 const guards=(child.stdout||'').split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL) - (.+?)(?: \| |$)/.exec(line);return m&&m[2]!=='Mobile settings compact'?[{name:m[2],ok:m[1]==='OK'}]:[];});
 const matches=[...(child.stdout||'').matchAll(/^(OK|FAIL) - Mobile settings compact \| (\{.*\})$/gm)],footer=matches.length===1?JSON.parse(matches[0][2]):null;
 const record={label,args,sourceSha256:hash(file),cssSha256:hash(style||cssFile),exit:child.status,signal:child.signal,error:child.error?.message,elapsedMs:Date.now()-started,guards,failed:guards.filter(g=>!g.ok).map(g=>g.name),footer,stdoutSha256:hash(stdout),stderrSha256:hash(stderr)};
 results.push(record);fs.writeFileSync(path.join(evidence,label+'.json'),JSON.stringify(record,null,2)+'\n');
 assert.equal(child.error,undefined,label+' did not complete; '+record.error);assert.equal(child.signal,null,label+' was terminated');
 assert.deepEqual(guards.map(g=>g.name),names,label+' lost or reordered a native guard; '+stdout);
 assert(footer,label+' missing its complete footer');assert.equal(footer.checks,30);assert.equal(footer.failures,record.failed.length,label+' has an additional native exception; '+stderr);
 assert(guards.at(-2).ok,label+' has JavaScript/HTTP errors; '+stdout);assert(guards.at(-1).ok,label+' changed the actual runtime');
 assert.deepEqual(snapshot(),before,'Actual frozen input changed after '+label);
 return record;
}
let complete=false,error;
try{
 const baseline=run(game,null,'normal');assert.equal(baseline.exit,0,'Native settings baseline red; '+path.join(evidence,'normal.stdout.log'));assert.deepEqual(baseline.failed,[]);console.log('OK - native baseline completes all 30 original guards');
 for(const item of cases.filter(c=>!selected.length||selected.includes(c.name))){
  const file=path.join(scratch,item.name+'.html'),style=item.style?path.join(scratch,item.name+'.css'):null;
  fs.writeFileSync(file,item.html?item.html():source);if(style)fs.writeFileSync(style,item.style());
  fs.copyFileSync(file,path.join(evidence,item.name+'.html'));if(style)fs.copyFileSync(style,path.join(evidence,item.name+'.css'));
  const negative=run(file,style,item.name);assert.equal(negative.exit,1,item.name+' must fail with the native assertion exit');assert.deepEqual(negative.failed,item.failed,item.name+' changed its exact failure set');
  console.log('OK - '+item.name+' completes all 30 original guards and rejects exactly '+negative.failed.length+' genuine failures');
 }
 complete=true;console.log('OK - mobile settings baseline and genuine counters | '+evidence);
}catch(e){error=e;throw e;}
finally{
 const after=snapshot();fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({complete,error:error?.stack,runtimeFiles:runtime.length,before,after,unchanged:JSON.stringify(before)===JSON.stringify(after),manifest:names,expected:cases.map(c=>({name:c.name,failed:c.failed})),results},null,2)+'\n');
 for(const name of fs.readdirSync(scratch))fs.unlinkSync(path.join(scratch,name));fs.rmdirSync(scratch);
}
