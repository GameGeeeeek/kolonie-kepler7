'use strict';
// Execute only in a free test lane. Positive and negative copies share every asset and guard.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname,'..');
const gamePath = path.join(root,'weltraum_kolonie.html');
const source = fs.readFileSync(gamePath,'utf8');
const startAnchor = '  function sektorUebersichtBauen(svg){';
assert.equal(source.split(startAnchor).length,2,'One native overview renderer anchor');
const start = source.indexOf(startAnchor), end = source.indexOf('\n  function ',start+startAnchor.length);
assert(end > start,'The next function bounds the native overview renderer');
const body = source.slice(start,end);
const goodLine = 'const uZeileHinweis = uSchmal ? 40 : 44;';
const badLine = 'const uZeileHinweis = uSchmal ? 33 : 44;';
assert.equal(body.split(goodLine).length,2,'Exactly one native 40/44 hint offset inside the renderer');
const brokenBody = body.replace(goodLine,badLine);
const broken = source.slice(0,start) + brokenBody + source.slice(end);
assert.equal(broken.replace(badLine,goodLine),source,'Only the controlled 40 to 33 value changes');
const tracked = [gamePath,path.join(root,'kepler-graphics.css'),path.join(root,'tests/test_uebersicht_schrift.js'),
  path.join(root,'tests/http-run.js'),path.join(root,'tests/lib/umgebung.js'),
  path.join(root,'tests/lib/spieldatei.js'),path.join(root,'tests/lib/http-test-origin.js')];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before = Object.fromEntries(tracked.map(file => [file,hash(file)]));
const evidenceDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(),'overview-hint-spacing-'));
const goodPath = path.join(evidenceDir,'positive.html'),badPath = path.join(evidenceDir,'only-40-to-33.html');
fs.writeFileSync(goodPath,source);fs.writeFileSync(badPath,broken);
const parse = output => output.split(/\r?\n/).flatMap(line => {
  const match = /^(OK|FAIL)\s+- (.*)$/.exec(line);
  return match ? [{status:match[1],name:match[2].split(' | ')[0]}] : [];
});
const run = (variant,file) => {
  const result = spawnSync(process.execPath,['tests/http-run.js','test_uebersicht_schrift.js'],{
    cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file,KEPLER_HTTP_TEST_ORIGIN:''},encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024
  });
  const output = (result.stdout || '') + (result.stderr || '');
  fs.writeFileSync(path.join(evidenceDir,variant+'.log'),output);
  assert(!result.error && !result.signal,'The '+variant+' probe must finish normally: '+output);
  for (const file of tracked) assert.equal(hash(file),before[file],'Source changed during the probe: '+file);
  return {status:result.status,records:parse(output),output};
};
const originals = ['0a','0b-anker','0b','1-vorab','1','1b','2a','2b','3a','3b','4a','4b','4c','5'];
const positive = run('positive',goodPath);
assert.equal(positive.status,0,'The current overview must be green: '+positive.output);
assert.equal(positive.records.length,15,'All 14 original guards and the new JavaScript guard must execute');
assert(positive.records.every(record => record.status === 'OK'),'Every positive guard must be green');
for (const id of originals) assert(positive.records.some(record => record.name.startsWith(id+':')),'Original guard missing: '+id);
const jsGuard = '6: keine JS-Fehler in allen drei Uebersichtskontexten';
assert(positive.records.some(record => record.name === jsGuard),'The context-specific JavaScript guard must execute');
const negative = run('negative',badPath);
assert.equal(negative.status,1,'The isolated 40 to 33 regression must be red: '+negative.output);
assert.deepEqual(negative.records.map(record => record.name),positive.records.map(record => record.name),'Precisely the same 15 guard names and order must execute');
const failed = negative.records.filter(record => record.status === 'FAIL');
assert.equal(failed.length,1,'Only 4c may fail: '+negative.output);
assert(failed[0].name.startsWith('4c:'),'The sole failure must be the strict sector-pair guard: '+negative.output);
assert(negative.records.some(record => record.name === jsGuard && record.status === 'OK'),'JavaScript must remain green');
for (const file of tracked) assert.equal(hash(file),before[file],'Source changed after the probe: '+file);
fs.writeFileSync(path.join(evidenceDir,'result.json'),JSON.stringify({sourceSha256:before[gamePath],
  mutation:'Only uZeileHinweis narrow offset 40 to 33',positiveSha256:hash(goodPath),negativeSha256:hash(badPath),
  positiveExit:positive.status,negativeExit:negative.status,checks:15,failed:failed.map(record => record.name),
  everyOtherGuardGreen:true,javascriptGreen:true},null,2)+'\n');
console.log('OK - only the strict 4c guard rejects native hint spacing 40 to 33; all other original guards and JavaScript remain green');
console.log('Evidence: '+evidenceDir);
