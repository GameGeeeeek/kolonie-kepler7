'use strict';
// Preserve the original 26 checks. Only a real SVG frame is made too large or
// smaller at stage 6; the renderer, fixtures, pixel checks and clocks are intact.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'weltraum_kolonie.html');
const testName = 'test_vorposten_station.js';
const test = path.join(root, 'tests', testName);
const manifest = [
  '0a: die Silhouette kennt alle drei Zweige und einen Rueckfall ohne Zweig',
  '0c: die Hilfe nennt fuer den Vorposten das Zeichen, das die Karte auch setzt',
  '0d: und die Hilfe behauptet nicht mehr drei Stufen, wo die Leiter acht hat',
  '0b: der Radius waechst mit der Stufe und der Kollisionsschieber bekommt ihn mit',
  '1-vorab: Boot ohne Skriptfehler, der Vorposten steht auf der Karte',
  '1a: schon auf Stufe 2 steht eine gerenderte Station, kein Bodenlager',
  '1b: und keine Spur des alten Bodenlagers mehr daneben',
  '1c-anker: das Bild der Stufe 2 laesst sich auslesen (sonst misst 5d nichts)',
  '1d-anker: der Hof-Kreis ist messbar (sonst misst 3a nichts)',
  '2a: die Station ist ein gerendertes Bild, kein Strichhaufen mehr',
  '2b: der Handelsknoten liefert ebenfalls ein Bild',
  '2c: und die Festung auch',
  '2d: die drei Zweige sehen verschieden aus (kein geteiltes Bild)',
  '2e-vorab: die drei Zweigbilder und der Rumpf ohne Zweig liegen zum Messen vor',
  '2e-kontrolle: derselbe Aufbau in fremder Farbe rastert fast gleich',
  '2e: die drei Zweige unterscheiden sich im AUFBAU, nicht nur im Farbton',
  '2f: kein Zweiganbau fuellt die Kachel weiter als der Rumpf ohne Zweig',
  '3a: der Marker der Stufe 8 ist SICHTBAR groesser als der der Stufe 2 (der Ausbau ist zu sehen)',
  '3b: die Landmarke ist immer das Satelliten-Zeichen, das Zelt ist weg',
  '4a: der Marker liegt vollstaendig in der sichtbaren Karte (der Schieber kennt den gewachsenen Radius)',
  '5-vorab: alle acht Stufen wurden gezeichnet',
  '5a: acht Stufen ergeben acht verschiedene Bilder',
  '5b: der Ausbau LEGT ZU - das Bild der Stufe 8 traegt mehr als das der Stufe 4',
  '5d: die Stufe unter der Zweigwahl sieht anders aus als die Wahlstufe selbst',
  '5c: und zwar durchgehend - keine Stufe faellt gegen die vorige zurueck',
  '4b: keine Skriptfehler'
];
assert.equal(manifest.length, 26);
assert.equal(new Set(manifest).size, 26);
assert.deepEqual([...fs.readFileSync(test, 'utf8').matchAll(/\bcheck\('([^']+)'/g)].map(m => m[1]), manifest,
  'the original complete check names and source order are unchanged');
const source = fs.readFileSync(game, 'utf8');
// bV sizes the two health-bar rects, not the image. The actual image in
// vorpostenSilhouette gets both native SVG dimensions from this unique s.
const anchor = 'const s = r * 2.9;';
assert.equal(source.split(anchor).length, 2, 'exactly one actual native SVG frame anchor');
const cases = [
  { name:'branch-overflow', replacement:"const s = r * (vp.zweig === 'werft' ? 4.2 : 2.9);", failed:[manifest[16]] },
  { name:'stage-rollback', replacement:'const s = r * (vp.stufe === 6 ? 1.9 : 2.9);', failed:[manifest[24]] }
];
assert.equal(process.argv.length, 2, 'run the complete normal and both controlled faults');
const { SERVER_JS } = require(path.join(root, 'tests/lib/spieldatei.js'));
if (process.env.KEPLER_BACKEND_SERVER) assert(fs.existsSync(process.env.KEPLER_BACKEND_SERVER), 'configured backend must exist');
assert(SERVER_JS && fs.existsSync(SERVER_JS), 'the active backend source is required for the 113-file freeze');
const assets = fs.readdirSync(root).filter(n => /^kepler-gfx-[a-z-]+\.(?:png|webp)$/.test(n)).sort();
assert.equal(assets.filter(n => n.endsWith('.png')).length, 54);
assert.equal(assets.filter(n => n.endsWith('.webp')).length, 54);
const runtime = [game, path.join(root, 'kepler-graphics.css'), path.join(root, 'service-worker.js'),
  path.join(root, 'kepler-english.json'), ...assets.map(n => path.join(root, n)), SERVER_JS];
assert.equal(runtime.length, 113);
const frozen = [...runtime, test, __filename,
  ...['http-run.js','lib/http-test-origin.js','lib/spieldatei.js','lib/umgebung.js','lib/i18n.js','lib/karte.js']
    .map(n => path.join(root, 'tests', n))];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashes = files => Object.fromEntries(files.map(file => [path.relative(root, file), hash(file)]));
const frozenBefore = hashes(frozen), runtimeBefore = hashes(runtime);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-vorposten-raster-'));
const evidence = path.resolve(root, '../graphics-complete-2026-10-13',
  'vorposten-raster-layout-counter-' + new Date().toISOString().replace(/[:.]/g, ''));
fs.mkdirSync(evidence, { recursive:true });
const proofFile = path.join(evidence, 'proof.json');
const proof = { success:false, status:'running', manifest, backendSource:SERVER_JS,
  runtimeBefore, runtimeAfter:null, frozenBefore, frozenAfter:null, baseline:null, cases:[] };
const save = () => fs.writeFileSync(proofFile, JSON.stringify(proof, null, 2) + '\n');
save();

function run(name, html) {
  const htmlFile = path.join(temporary, name + '.html');
  const savedSource = path.join(evidence, name + '.html');
  fs.writeFileSync(htmlFile, html);
  fs.copyFileSync(htmlFile, savedSource);
  const argv = ['tests/http-run.js', testName];
  console.log('START - ' + name + ': all 26 original checks over native HTTP');
  const start = Date.now();
  const child = spawnSync(process.execPath, argv, { cwd:root,
    env:{ ...process.env, KEPLER_SPIELDATEI:htmlFile }, encoding:'utf8', timeout:180000, maxBuffer:12*1024*1024 });
  const stdout = child.stdout || '', stderr = child.stderr || '', output = stdout + stderr;
  const log = path.join(evidence, name + '.log');
  const errLog = path.join(evidence, name + '.stderr.log');
  fs.writeFileSync(log, stdout);
  fs.writeFileSync(errLog, stderr);
  const lines = output.split(/\r?\n/);
  const records = lines.flatMap(line => {
    const m = /^(OK|FAIL)\s+- (.*?)(?: \| .*)?$/.exec(line);
    return m ? [{ name:m[2], ok:m[1] === 'OK' }] : [];
  });
  const result = { name, argv, cwd:root, durationMs:Date.now()-start, exit:child.status,
    signal:child.signal, childError:child.error ? String(child.error) : null,
    sourceCopy:savedSource, sourceSha256:hash(savedSource), log, logSha256:hash(log),
    stderrLog:errLog, stderrSha256:hash(errLog), records, failed:records.filter(r => !r.ok).map(r => r.name) };
  // Save the actual failed/partial child before every assertion, including timeout.
  if (name === 'positive') proof.baseline = result; else proof.cases.push(result);
  save();
  const witness = '; child log: ' + log + '\n' + output;
  assert.equal(child.error, undefined, 'native child must finish within the original 180s budget' + witness);
  assert.equal(child.signal, null, 'native child must exit normally' + witness);
  assert.equal(stderr.trim(), '', 'native stderr must remain empty' + witness);
  assert.deepEqual(records.map(r => r.name), manifest, 'all 26 original names/order must complete' + witness);
  assert(records[4].ok && records[25].ok, 'original JavaScript guards must remain green' + witness);
  assert(!/\bSKIP\b|übersprungen|uebersprungen/i.test(output), 'no skipped native checks' + witness);
  assert.deepEqual(lines.filter(l => l === 'PASS' || l === 'FAIL'), [result.failed.length ? 'FAIL' : 'PASS'],
    'exact original terminal verdict' + witness);
  assert.deepEqual(hashes(frozen), frozenBefore, 'runtime, backend, test, controller and helpers stay byte-identical');
  return result;
}

try {
  const positive = run('positive', source);
  assert.equal(positive.exit, 0, 'native baseline exits zero; failed names: ' + JSON.stringify(positive.failed));
  assert.deepEqual(positive.failed, []);
  console.log('OK - positive completes all 26 original guards, including native image frames and JavaScript');
  for (const fault of cases) {
    const negative = run(fault.name, source.replace(anchor, fault.replacement));
    assert.equal(negative.exit, 1, 'genuine native fault must exit one: ' + fault.name);
    assert.deepEqual(negative.failed, fault.failed, 'exact intended native frame failure: ' + fault.name);
    console.log('OK - ' + fault.name + ' completes all 26 guards and rejects exactly ' + JSON.stringify(negative.failed));
  }
  proof.runtimeAfter = hashes(runtime);
  proof.frozenAfter = hashes(frozen);
  assert.deepEqual(proof.runtimeAfter, runtimeBefore);
  assert.deepEqual(proof.frozenAfter, frozenBefore);
  proof.success = true;
  proof.status = 'complete';
  save();
  console.log('OK - all 113 runtime hashes and the full original guard manifest remain frozen');
  console.log('Evidence: ' + evidence);
} catch (error) {
  proof.status = 'failed';
  proof.error = error.stack || String(error);
  proof.runtimeAfter = hashes(runtime);
  proof.frozenAfter = hashes(frozen);
  save();
  throw error;
} finally {
  // The concrete original source copies and all actual child logs stay in evidence.
  fs.rmSync(temporary, { recursive:true, force:true });
}
