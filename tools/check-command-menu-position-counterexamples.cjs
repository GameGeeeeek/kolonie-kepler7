'use strict';
// Each fault removes one actual menu implementation guarantee. The checkout stays frozen;
// the complete native test must finish normally with the exact same ordered 108 guards.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.join(root,'weltraum_kolonie.html');
const TABS=['basis','verteidigung','forschung','flotte','expedition','karte','galaxie','allianz','offiziere','markt','punkte','fortschritt','sammlung'];
const manifest=[
 'a saved account without a menu preference defaults to the existing left menu',
 'native menu choice exposes exactly two named options',
 'native top choice updates layout and keeps the focused select',
 'the first top switch moves the thirteen native controls without cloning them',
 'native top choice is saved in this actual account',
 'a real reload restores the saved top menu',
 ...[1487,756,390,320].flatMap(width=>[
  'top menu occupies real document flow after the header at '+width,
  'top menu has no mobile drawer or hidden backdrop at '+width,
  'top menu sticky clearance includes both real header and menu heights at '+width,
  'top menu thirteen controls fit the real rail without hidden horizontal scrolling at '+width,
  'top '+width+' preserves exactly the thirteen original sections without duplicate controls',
  ...TABS.map(key=>'top '+width+' native pointer opens '+key)
 ]),
 ...[[844,390],[390,360]].map(([width,height])=>'top '+width+'x'+height+' native basis build remains physically reachable on a short display'),
 'top account entry remains physically reachable after short and 320px resizes',
 'top menu keeps the original keyboard settings action and saved state',
 'native left choice restores its drawer and focused select',
 'switching position preserves every original navigation node and handler',
 'left 390 preserves exactly the thirteen original sections without duplicate controls',
 ...TABS.map(key=>'left 390 native pointer opens '+key),
 'left drawer Escape restores its visible entry focus',
 'left drawer retains its original reverse focus trap',
 'left drawer retains its original forward focus trap',
 'left drawer still closes through a real backdrop pointer',
 'a real reload also restores the explicitly saved left menu',
 'a native account change uses the second account default without inheriting top',
 'native account switching keeps the first account saved preference intact',
 'native login restores the first account own top preference',
 'an unsupported saved menu value falls back to the existing left menu',
 'all real menu position pointer and keyboard actions complete without JavaScript errors'
];
assert.equal(manifest.length,108,'complete native menu manifest count');
const frozen=[game,path.join(root,'kepler-graphics.css'),path.join(root,'kepler-english.json'),path.join(root,'service-worker.js'),
 path.join(root,'tests/http-run.js'),path.join(root,'tests/lib/umgebung.js'),path.join(root,'tests/lib/spieldatei.js'),
 path.join(root,'tests/test_command_menu_position.js'),__filename,
 ...fs.readdirSync(root).filter(name=>/^kepler-gfx-[a-z-]+\.(?:png|webp)$/.test(name)).sort().map(name=>path.join(root,name))];
const backend=path.resolve(root,'../kolonie-kepler7-backend/server.js');if(fs.existsSync(backend))frozen.push(backend);
const hashes=()=>frozen.map(file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
const before=hashes(),source=fs.readFileSync(game,'utf8'),css=fs.readFileSync(path.join(root,'kepler-graphics.css'),'utf8');
const replace=(old,next)=>{assert.equal(source.split(old).length,2,'one genuine menu fault anchor: '+old);return source.replace(old,next);};
const replaceCss=(old,next)=>{assert.equal(css.split(old).length,2,'one genuine menu CSS fault anchor: '+old);return css.replace(old,next);};
const cases=[
 {name:'restore',source:()=>replace("state.uiMenuPosition = parsedSave.uiMenuPosition === 'top' ? 'top' : 'left';","state.uiMenuPosition = 'left';"),
  failed:['a real reload restores the saved top menu','native login restores the first account own top preference']},
 {name:'flow',source:()=>replace('if(top)hero.after(menu);else shell.before(menu);','if(!top)shell.before(menu);'),
  failed:[1487,756,390,320].map(width=>'top menu occupies real document flow after the header at '+width)},
 {name:'sticky-offset',source:()=>replace('const h = headerHeight+(menu?Math.round(menu.getBoundingClientRect().height):0);','const h = headerHeight;'),
  failed:[1487,756,390,320].map(width=>'top menu sticky clearance includes both real header and menu heights at '+width)},
 {name:'drawer-aria',source:()=>replace("if(toggle)toggle.setAttribute('aria-expanded','false');",'void toggle;'),
  failed:[...TABS.map(key=>'left 390 native pointer opens '+key),'left drawer Escape restores its visible entry focus','left drawer still closes through a real backdrop pointer']},
 {name:'tab-fit',css:()=>replaceCss('min-height:44px; min-width:0; width:100%; white-space:normal; text-align:center; overflow-wrap:anywhere;',
  'min-height:44px; width:100%; text-align:center; overflow-wrap:anywhere;'),
  failed:[390,320].map(width=>'top menu thirteen controls fit the real rail without hidden horizontal scrolling at '+width)},
 {name:'short-content',css:()=>replaceCss('max-height:max(44px,min(calc((100dvh - var(--command-header-height,64px) - var(--command-status-height)) / 2),calc(50dvh - var(--command-header-height,64px) - 24px)));',
  'max-height:calc(100dvh - var(--command-header-height,64px) - var(--command-status-height));'),
  failed:[[844,390],[390,360]].map(([width,height])=>'top '+width+'x'+height+' native basis build remains physically reachable on a short display')},
 {name:'nested-sticky',css:()=>replaceCss('position:static; top:auto; z-index:auto;',''),
  failed:['top account entry remains physically reachable after short and 320px resizes']}
];
const requested=process.argv.slice(2);
assert(requested.every(name=>cases.some(item=>item.name===name)),'unknown menu-position counterexample');
function run(file,cssFile){
 const result=spawnSync(process.execPath,['tests/http-run.js','test_command_menu_position.js'],{cwd:root,
  env:{...process.env,KEPLER_SPIELDATEI:file,K7_MENU_POSITION_CSS:cssFile||''},encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
 const output=(result.stdout||'')+(result.stderr||'');assert.equal(result.error,undefined,'native menu test could not finish: '+output);
 assert.equal(result.signal,null,'native menu test terminated by a signal: '+output);
 const guards=output.split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL)\s+-\s+(.+?)(?: \| |$)/.exec(line);
  return m&&m[2]!=='Command menu position'?[{name:m[2],ok:m[1]==='OK'}]:[];});
 assert.deepEqual(guards.map(g=>g.name),manifest,'incomplete or changed native menu guards:\n'+output);
 assert(output.includes((result.status===0?'OK':'FAIL')+' - Command menu position'),'missing normal native completion:\n'+output);
 assert(guards.at(-1)?.ok,'native JavaScript guard must remain green:\n'+output);
 return {result,output,guards};
}
const baseline=run(game);assert.equal(baseline.result.status,0,'normal menu baseline is not green:\n'+baseline.output);
assert(baseline.guards.every(g=>g.ok),'normal menu baseline contains red guards:\n'+baseline.output);
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-menu-position-'));
try{
 for(const item of cases.filter(item=>!requested.length||requested.includes(item.name))){
  const file=path.join(directory,item.name+'.html'),cssFile=item.css?path.join(directory,item.name+'.css'):null;
  fs.writeFileSync(file,item.source?item.source():source);if(cssFile)fs.writeFileSync(cssFile,item.css());const counter=run(file,cssFile);
  assert.equal(counter.result.status,1,item.name+' did not fail normally:\n'+counter.output);
  assert.deepEqual(counter.guards.filter(g=>!g.ok).map(g=>g.name),item.failed,item.name+' missed its exact native failures:\n'+counter.output);
  assert.deepEqual(hashes(),before,'game/assets/backend/test/controller changed during '+item.name);
  console.log('OK - '+item.name+' finishes all '+manifest.length+' native guards and rejects exactly '+item.failed.length+' named failures');
 }
 assert.deepEqual(hashes(),before,'tested source changed during menu-position counterexamples');
 console.log('OK - menu position baseline completes all '+manifest.length+' native guards with frozen source hashes');
}finally{
 for(const name of fs.readdirSync(directory))fs.unlinkSync(path.join(directory,name));fs.rmdirSync(directory);
}
