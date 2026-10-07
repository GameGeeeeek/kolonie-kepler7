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
  'planet inspector opens the existing actions menu']],
 ['untranslated-stats',replace(source,'<span class="k">${escapeHtml(k7t(k))}</span>','<span class="k">${k}</span>'),[
  'English graphics use translated stats, counts and roles']],
 ['late-map-layout',replace(source,'// Apply the inspector layout before measuring the map or targeting the camera.\n    renderGraphicsMap();','// Counterexample: layout changes after the camera has already been measured.'),[
  'initial system camera matches the actual map aspect ratio']],
 ['broken-layout',replace(source,'</head>',`<style>
 #kanzelrahmen { width:600px!important; }
 @media(min-width:1400px) and (min-height:850px) { .gfx-system-layout {grid-template-rows:850px auto!important;} .gfx-system-layout .map-wrap {height:850px!important;} }
 @media(max-width:760px) { .gfx-hotspot {min-height:34px!important;} .gfx-hotspot[data-gfx-building="mine"] {left:26%!important;top:44%!important;} .gfx-hotspot[data-gfx-building="solar"] {left:58%!important;top:39%!important;} }
 </style></head>`),[
  'wide desktop frame stays aligned with the expanded game column','desktop system overview avoids intrinsic SVG height growth','desktop map height remains stable when a system opens','mobile building controls have 44px targets without overlaps']]
];
try {
 for(const [name,html,expected] of cases){
  const file=path.join(temporary,name+'.html');fs.writeFileSync(file,html);
  const result=spawnSync(process.execPath,['tests/test_graphics_refresh.js'],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file},encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
  const output=(result.stdout||'')+(result.stderr||'');
  const failures=output.split('\n').filter(line=>line.startsWith('FAIL - '));
  if(result.status!==1||failures.length!==expected.length||!expected.every(label=>failures.some(line=>line.startsWith('FAIL - '+label)))){
   console.error(output);throw Error(name+': counterexample did not fail exactly its intended checks (exit '+result.status+')');
  }
  console.log('OK - '+name+' rejects exactly '+expected.length+' intended faults');
  for(const line of failures)console.log(line);
 }
} finally { fs.rmSync(temporary,{recursive:true,force:true}); }
