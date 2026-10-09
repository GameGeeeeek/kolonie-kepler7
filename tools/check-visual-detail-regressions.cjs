'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict'), {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const source = fs.readFileSync(path.join(root,'weltraum_kolonie.html'),'utf8');
const tempRoot = fs.realpathSync(os.tmpdir());
const folder = fs.mkdtempSync(path.join(tempRoot,'kepler-detail-native-'));
assert.equal(path.dirname(fs.realpathSync(folder)),tempRoot);
assert.ok(path.basename(folder).startsWith('kepler-detail-native-'));
function replace(old,next) {
  assert.equal(source.split(old).length,2,'controlled fault needs exactly one existing anchor');
  return source.replace(old,next);
}
try {
  for (const [name,old,next,test,expected] of [
    ['custom-price',"k7Ui('Einlösen','Redeem')+' · '+item.preisText","fmt(item.cost)+' Kr.'",'test_abgrundbezug.js','10: der Knopf zeigt den eigenen Preistext'],
    ['location-icon','${moduleIconHtml(def,false,MODULE_RARITY[fragRar].color)}','<i class="ti ${def.icon}"></i>','test_iconabdeckung.js','8: data-fragcraft-loc zeigt sein eigenes gezeichnetes Modul'],
    ['ship-icon','${moduleIconHtml(def,true,MODULE_RARITY[fragRar].color)}','<i class="ti ${def.icon}"></i>','test_iconabdeckung.js','8: data-fragcraft-ship zeigt sein eigenes gezeichnetes Modul'],
    ['missing-fleet-reason',"' ('+kampfflottenMangel(cf)+')'","''",'test_sperrgrund_fortschritt_galaxie.js','9: ohne Kampfschiffe sagt die Zeile das auch']
  ]) {
    const file = path.join(folder,name+'.html');
    fs.writeFileSync(file,replace(old,next));
    const result = spawnSync(process.execPath,['tests/http-run.js',test],{
      cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file},encoding:'utf8',timeout:300000,maxBuffer:4*1024*1024
    });
    const output = (result.stdout||'')+(result.stderr||'');
    if (result.status!==1 || !output.includes('FAIL - '+expected)) {
      console.error(output);
      throw new Error(name+': native guard missed the controlled regression');
    }
    if (name==='missing-fleet-reason') assert.ok(output.includes('FAIL - 13: mit Jaegern ohne Traegerschiff'));
    console.log('OK - '+name+' is detected by its native guard');
  }
} finally {
  fs.rmSync(folder,{recursive:true,force:true});
}
