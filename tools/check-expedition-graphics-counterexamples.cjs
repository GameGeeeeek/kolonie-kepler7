'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'weltraum_kolonie.html'),'utf8');
const scratchRoot=fs.realpathSync(os.tmpdir());
const folder=fs.mkdtempSync(path.join(scratchRoot,'kepler-expedition-graphics-'));
if(path.dirname(fs.realpathSync(folder))!==scratchRoot||!path.basename(folder).startsWith('kepler-expedition-graphics-'))throw Error('Counterexample folder must stay inside its temporary root');
function changed(anchor,replacement){
 if(source.split(anchor).length!==2)throw Error('Counterexample requires exactly one source anchor');
 return source.replace(anchor,replacement);
}
try {
 const selection=path.join(folder,'selection.html');
 fs.writeFileSync(selection,changed("selectedExpeditionType = btn.getAttribute('data-expedition-type');",'void btn; // deliberately disconnected selection'));
 const scroll=path.join(folder,'scroll.html');
 fs.writeFileSync(scroll,changed("if (v) el.scrollLeft = v;",'void v; /* deliberately lost scroll position */'));
 for(const [name,file,test,labels] of [
  ['touch selection',selection,'test_hscroll.js',['Leiste "exptype": Antippen des hintersten Eintrags greift']],
  ['selection after cached ticks',selection,'test_expeditionsbox_cache.js',['2: der Klick nach drei uebersprungenen Ticks wirkt noch','3: die echte Aenderung baut die Box neu auf (Markierung ist weg)']],
  ['scroll restoration',scroll,'test_expeditionsbox_cache.js',['4: die waagerechte Scrollposition ueberlebt den Neuaufbau']]
 ]){
  const r=spawnSync(process.execPath,['tests/http-run.js',test],{cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file},encoding:'utf8',timeout:150000,maxBuffer:4*1024*1024});
  const output=(r.stdout||'')+(r.stderr||'');
  const failures=output.split(/\r?\n/).filter(line=>line.startsWith('FAIL - '));
  if(r.status!==1||failures.length!==labels.length||labels.some(label=>!failures.some(line=>line.startsWith('FAIL - '+label)))){
   console.error(output);throw Error(name+': expected only the intended failed checks; exit '+r.status);
  }
  console.log('OK - '+name+' rejects the intended fault');
 }
} finally { fs.rmSync(folder,{recursive:true,force:true}); }
