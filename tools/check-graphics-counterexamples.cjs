'use strict';
// Each controlled fault must fail only its corresponding behavior/layout checks.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'weltraum_kolonie.html'),'utf8');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'kepler-graphics-review-'));
const replace=(text,anchor,replacement)=>{if(text.split(anchor).length!==2)throw Error('Counterexample anchor must be unique: '+anchor);return text.replace(anchor,replacement);};
const cases=[
 ['disconnected',replace(source,'if (button && !button.disabled) button.click();','if (button && !button.disabled) void button;'),[
  'illustrated building action upgrades the selected actual building','illustrated ship action creates exactly one real local build order']],
 ['closing-menu',replace(source,'e.stopPropagation();planetMapMenu(e,b.dataset.gfxPlanetMenu);','planetMapMenu(e,b.dataset.gfxPlanetMenu);'),[
  'planet inspector opens the existing actions menu','escape closes only the actions menu and retains the system']],
 ['untranslated-stats',replace(source,'<span class="k">${escapeHtml(k7t(k))}</span>','<span class="k">${k}</span>'),[
  'English graphics use translated stats, counts and roles']],
 ['late-map-layout',replace(source,'// Apply the inspector layout before measuring the map or targeting the camera.\n    renderGraphicsMap();','// Counterexample: layout changes after the camera has already been measured.'),[
  'initial system camera matches the actual map aspect ratio']],
 ['jumping-map-height',replace(source,'</head>',`<style>
 @media(min-width:1480px) and (min-height:850px) { #tab-karte .gfx-system-layout .map-wrap {height:520px!important;} .gfx-system-layout {grid-template-rows:520px auto!important;} }
 </style></head>`),[
  'desktop map height remains stable when a system opens']],
 ['broken-layout',replace(source,'</head>',`<style>
 @media(min-width:1400px) and (min-height:850px) { body.command-ui .shell {transform:translateX(8px)!important;} .gfx-system-layout {grid-template-rows:850px auto!important;} .gfx-system-layout .map-wrap {height:850px!important;} }
 @media(max-width:760px) { .gfx-hotspot {min-height:34px!important;} .gfx-hotspot[data-gfx-building="mine"] {left:26%!important;top:44%!important;} .gfx-hotspot[data-gfx-building="solar"] {left:58%!important;top:39%!important;} }
 </style></head>`),[
  'wide desktop command surface stays aligned with the native game column','desktop system overview avoids intrinsic SVG height growth','mobile building controls have 44px targets without overlaps']]
];
try {
 for(const [name,html,expected] of cases){
  const file=path.join(temporary,name+'.html');fs.writeFileSync(file,html);
  const result=spawnSync(process.execPath,['tests/test_graphics_refresh.js'],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file},encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  const output=(result.stdout||'')+(result.stderr||'');
  const failures=output.split('\n').filter(line=>line.startsWith('FAIL - '));
  if(result.error||result.signal||result.status!==1||failures.length!==expected.length||!expected.every(label=>failures.some(line=>line.startsWith('FAIL - '+label)))
    ||!output.includes('OK - game boots without JavaScript errors')||!output.includes('OK - interactions produce no JavaScript errors')
    ||!output.split(/\r?\n/).includes('22 checks, '+expected.length+' failures')){
   console.error(output);throw Error(name+': counterexample did not fail exactly its intended checks (exit '+result.status+')');
  }
  console.log('OK - '+name+' rejects exactly '+expected.length+' intended faults');
  for(const line of failures)console.log(line);
 }
 const fontFile=path.join(temporary,'small-desktop-labels.html');
 fs.writeFileSync(fontFile,replace(source,'(15*uF).toFixed(1)','(15*(window.innerWidth>700?1:uF)).toFixed(1)'));
 const fontResult=spawnSync(process.execPath,['tests/http-run.js','test_uebersicht_schrift.js'],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:fontFile},encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
 const fontOutput=(fontResult.stdout||'')+(fontResult.stderr||'');
 const fontFailures=fontOutput.split('\n').filter(line=>line.startsWith('FAIL - '));
 const fontRecords=fontOutput.split(/\r?\n/).flatMap(line=>{const m=/^(OK|FAIL)\s+- (.*?)(?: \| .*)?$/.exec(line);return m?[{status:m[1],label:m[2]}]:[];});
 if(fontResult.error||fontResult.signal||fontResult.status!==1||(fontResult.stderr||'').trim()
   ||fontFailures.length!==1||!fontFailures[0].startsWith('FAIL - 1b: PC-Regionsnamen')
   ||fontRecords.length!==15||new Set(fontRecords.map(r=>r.label)).size!==15
   ||!fontRecords.some(r=>r.status==='OK'&&r.label==='6: keine JS-Fehler in allen drei Uebersichtskontexten')
   ||!fontOutput.split(/\r?\n/).includes('FAIL')){console.error(fontOutput);throw Error('Desktop readability counterexample must complete all 15 guards and fail exactly its visible-pixel check with green final JavaScript guard');}
 console.log('OK - small-desktop-labels rejects exactly 1 intended fault');
 console.log(fontFailures[0]);
} finally { fs.rmSync(temporary,{recursive:true,force:true}); }
