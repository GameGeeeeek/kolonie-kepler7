'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'weltraum_kolonie.html'),'utf8');
const anchor='<div class="gfx-combat-facts">';assert.equal(source.split(anchor).length,2);
const start=source.indexOf(anchor),end=source.indexOf('\n',start),row=source.slice(start,end);
const tempRoot=fs.realpathSync(os.tmpdir()),folder=fs.mkdtempSync(path.join(tempRoot,'kepler-combat-graphics-'));
assert.equal(path.dirname(fs.realpathSync(folder)),tempRoot);
assert.ok(path.basename(folder).startsWith('kepler-combat-graphics-'));
function replace(text,old,next){assert.equal(text.split(old).length,2);return text.replace(old,next);}
try{
 for(const [name,changed,test,expected,extra] of [
  ['raw-number',replace(replace(row,'fmt(effDefense)','Math.round(effDefense)'),'fmt(power)','Math.round(power)'),'test_kopfzeile_chips.js','4i: in der NPC-Zielliste', {KEPLER_KOPFZEILE_GEGENPROBE:'sabH'}],
  ['wrong-chance',replace(row,'${chance}%','${Math.max(1,chance-20)}%'),'test_gegnerlage.js','4: Karte und Galaxie-Reiter nennen dieselbe Erfolgschance',{}]
 ]){
  const file=path.join(folder,name+'.html');fs.writeFileSync(file,source.slice(0,start)+changed+source.slice(end));
  const r=spawnSync(process.execPath,['tests/http-run.js',test],{cwd:root,env:{...process.env,...extra,KEPLER_SPIELDATEI:file},encoding:'utf8',timeout:300000,maxBuffer:4*1024*1024});
  const output=(r.stdout||'')+(r.stderr||'');
  const expectedExit=name==='raw-number'?0:1;
  if(r.status!==expectedExit||!output.includes('FAIL - '+expected)||(name==='raw-number'&&!output.includes('GEGENPROBE sabH: 1/1 gefallen'))){console.error(output);throw Error(name+': native combat check did not detect the controlled fault');}
  console.log('OK - '+name+' fails the intended native combat assertion');
 }
}finally{fs.rmSync(folder,{recursive:true,force:true});}
