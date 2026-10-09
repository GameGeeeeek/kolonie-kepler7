'use strict';
// Run only in a free test lane. The checkout is never mutated.
// node tools/check-mission-status-close-counterexample.cjs [abbau|muster]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const gamePath = path.join(root, 'weltraum_kolonie.html');
const closingGuard = ': Mission-Zielklick schliesst Statusfenster und Verdunklung und zeigt die native Karte';
const cases = [
  { name:'abbau', file:'test_flottenposition_abbau.js', expected:['3-status'],
    originals:['1-anker','1-bau','1a','1b','1c','1d','1e','1f','4a','4b','4c','2-vorab','2a','2b','2c','2d','2e','2f','3a','3b','3c'],
    js:'3c: keine JS-Fehler' },
  { name:'muster', file:'test_musterziel.js', expected:['2-status','4b-status','4c-status'],
    originals:['1a','1b','1c','1d','2a','2b','2c','3a','3b','4a','4b','4c'],
    js:'3b: kein Skriptfehler beim Aufbau' }
];
const requested = process.argv.slice(2);
assert(requested.every(name => cases.some(test => test.name === name)), 'Unknown counterexample case');
const selected = cases.filter(test => !requested.length || requested.includes(test.name));
const tracked = [gamePath, path.join(root,'kepler-graphics.css'),
  ...selected.map(test => path.join(root,'tests',test.file)),
  path.join(root,'tests/http-run.js'), path.join(root,'tests/lib/umgebung.js'),
  path.join(root,'tests/lib/spieldatei.js'), path.join(root,'tests/lib/http-test-origin.js')];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before = Object.fromEntries(tracked.map(file => [file, hash(file)]));
const source = fs.readFileSync(gamePath,'utf8');
const startAnchor = '  function springeZuKartenziel(system, selektor){';
const endAnchor = '\n  function springeZuVorposten(';
assert.equal(source.split(startAnchor).length, 2, 'One exact map-target function anchor');
const start = source.indexOf(startAnchor), end = source.indexOf(endAnchor,start);
assert(end > start, 'The next function bounds the isolated map-target function');
const body = source.slice(start,end);
const closeLine = /^[ \t]*closeFpPanel\(\);[ \t]*\r?\n/gm;
assert.equal([...body.matchAll(closeLine)].length,1,'Exactly one native close call inside springeZuKartenziel');
const brokenBody = body.replace(closeLine,'');
const broken = source.slice(0,start) + brokenBody + source.slice(end);
assert.notEqual(broken,source,'The controlled copy removes the one close call');
assert.equal(source.slice(0,start),broken.slice(0,start),'The source prefix is unchanged');
assert.equal(source.slice(end),broken.slice(start+brokenBody.length),'The source suffix is unchanged');
const evidenceDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(),'mission-status-close-'));
const goodPath = path.join(evidenceDir,'positive.html');
const badPath = path.join(evidenceDir,'only-close-removed.html');
fs.writeFileSync(goodPath,source);
fs.writeFileSync(badPath,broken);
const records = output => output.split(/\r?\n/).flatMap(line => {
  const match = /^(OK|FAIL)\s+- (.*)$/.exec(line);
  return match ? [{status:match[1],name:match[2].split(' | ')[0]}] : [];
});
const namesWithCounts = list => {
  const result = {};
  for (const record of list) result[record.name] = (result[record.name] || 0) + 1;
  return Object.fromEntries(Object.entries(result).sort(([a],[b]) => a.localeCompare(b)));
};
const outputFor = (test,variant,file) => {
  const result = spawnSync(process.execPath,['tests/http-run.js',test.file],{
    cwd:root,env:{...process.env,KEPLER_SPIELDATEI:file,KEPLER_ZIEL_GEGENPROBE:'',KEPLER_HTTP_TEST_ORIGIN:''},
    encoding:'utf8',timeout:240000,maxBuffer:4*1024*1024
  });
  const output = (result.stdout || '') + (result.stderr || '');
  fs.writeFileSync(path.join(evidenceDir,test.name+'-'+variant+'.log'),output);
  assert(!result.error && !result.signal,test.name+' '+variant+' must finish normally: '+output);
  for (const file of tracked) assert.equal(hash(file),before[file],'Source changed during the counterexample: '+file);
  return {status:result.status,records:records(output),output};
};
const summary = {sourceSha256:before[gamePath],mutation:'Only the closeFpPanel(); line inside springeZuKartenziel removed',
  positiveSha256:hash(goodPath),negativeSha256:hash(badPath),cases:[]};
for (const test of selected){
  const positive = outputFor(test,'positive',goodPath);
  assert.equal(positive.status,0,test.name+' positive source must pass: '+positive.output);
  assert(positive.records.length > 0 && positive.records.every(record => record.status === 'OK'),test.name+' positive checks must all be green');
  for (const id of test.originals) assert(positive.records.some(record => record.name.startsWith(id+':')),test.name+' original guard missing: '+id);
  assert(positive.records.some(record => record.name === test.js),test.name+' JavaScript guard must run');
  for (const id of test.expected) assert(positive.records.some(record => record.name === id+closingGuard),test.name+' closing guard must run: '+id);
  const negative = outputFor(test,'negative',badPath);
  assert.equal(negative.status,1,test.name+' controlled regression must fail: '+negative.output);
  assert.deepEqual(namesWithCounts(negative.records),namesWithCounts(positive.records),test.name+' must execute precisely the same guard names and counts');
  const failed = negative.records.filter(record => record.status === 'FAIL');
  assert.deepEqual(failed.map(record => record.name).sort(),test.expected.map(id => id+closingGuard).sort(),
    test.name+' only the intended closing guards may fail: '+negative.output);
  assert(negative.records.some(record => record.name === test.js && record.status === 'OK'),test.name+' JavaScript must remain green');
  summary.cases.push({name:test.name,positiveExit:positive.status,negativeExit:negative.status,
    checks:positive.records.length,failed:failed.map(record => record.name),allOriginalGuardsGreen:true,javascriptGreen:true});
  console.log('OK - '+test.name+' rejects only the missing status close ('+failed.length+' checks); all original guards and JavaScript stay green');
}
for (const file of tracked) assert.equal(hash(file),before[file],'Source changed after the counterexample: '+file);
fs.writeFileSync(path.join(evidenceDir,'result.json'),JSON.stringify(summary,null,2)+'\n');
console.log('Evidence: '+evidenceDir);
