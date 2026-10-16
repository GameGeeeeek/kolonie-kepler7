'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {blob, verifyManifest, runPool} = require('./cpu-pool.cjs');
const manifest = require('./cpu-tests.json');
const root = path.resolve(process.argv[2] || process.cwd());
const output = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'kepler-cpu-benchmark-'));
const sequence = [1, 2, 4, 4, 2, 1, 1, 2, 4];
function median(values) { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; }
function emit(prefix, value) {
  const line = prefix + ' ' + JSON.stringify(value);
  if (Buffer.byteLength(line, 'utf8') >= 14000) throw new Error('Benchmark output line exceeds safe GitHub log size: ' + prefix);
  console.log(line);
}
function emitFailureLog(round, name, text, prefix = 'CPU_BENCH_FAILURE_LOG') {
  const points = [...text];
  for (let offset = 0; offset < points.length; offset += 1000)
    emit(prefix, {round, name, chunk: offset / 1000, text: points.slice(offset, offset + 1000).join('')});
}
function readOptional(file) { try { return fs.readFileSync(file, 'utf8').trim(); } catch { return null; } }
function pressure() { return Object.fromEntries(['cpu', 'memory', 'io'].map(name => [name, readOptional('/proc/pressure/' + name)])); }
function resources() {
  const memory = readOptional('/proc/meminfo') || '';
  const available = Number((memory.match(/^MemAvailable:\s+(\d+)/m) || [])[1]) * 1024;
  const times = os.cpus().map(cpu => cpu.times);
  return {available: Number.isFinite(available) ? available : os.freemem(),
    busy: times.reduce((sum, row) => sum + row.user + row.nice + row.sys + row.irq, 0),
    total: times.reduce((sum, row) => sum + Object.values(row).reduce((a, b) => a + b, 0), 0)};
}
async function main() {
  verifyManifest(root, manifest);
  for (const [relative, sha] of Object.entries(manifest.sourceFiles)) {
    if (blob(path.join(root, relative)) !== sha) throw new Error('Benchmark game/catalogue differs from pinned Main: ' + relative);
  }
  emit('CPU_BENCH_INPUT', {source: manifest.main, count: manifest.tests.length, node: process.version, warmups: [1, 2, 4], sequence,
    cores: os.availableParallelism(), totalMemory: os.totalmem(), output});
  const world = [path.join(root, 'weltraum_kolonie.html'), path.join(root, 'kepler-english.json'),
    process.env.KEPLER_BACKEND_SERVER || path.resolve(root, '../kolonie-kepler7-backend/server.js')];
  const hash = () => world.map(relative => require('node:crypto').createHash('sha256').update(fs.readFileSync(path.resolve(root, relative))).digest('hex'));
  const before = hash();
  const {results: [mandatory]} = await runPool({root, names: ['run.js'], workers: 1,
    output: path.join(output, 'mandatory'), extraArgs: ['--nur-pflicht'], timeoutMs: 120000});
  emit('CPU_BENCH_MANDATORY', {ok: mandatory.ok, status: mandatory.status, signal: mandatory.signal,
    timedOut: mandatory.timedOut, seconds: mandatory.seconds, cleanupError: mandatory.cleanupError});
  emitFailureLog('mandatory', 'run.js', fs.readFileSync(mandatory.log, 'utf8'), 'CPU_BENCH_MANDATORY_LOG');
  if (!mandatory.ok) throw new Error('Mandatory checks failed');
  const rounds = [];
  for (const [index, workers] of [1, 2, 4, ...sequence].entries()) {
    const warmup = index < 3;
    const baseline = !warmup && workers === 1;
    verifyManifest(root, manifest);
    const startResources = resources(), startPressure = pressure();
    let minAvailable = startResources.available;
    const sampler = setInterval(() => { minAvailable = Math.min(minAvailable, resources().available); }, 250);
    let result;
    try {
      result = await runPool({root, names: manifest.tests, workers, output: path.join(output, String(index)), onResult(row) {
        emit('CPU_BENCH_TEST', {round: index, workers, baseline, warmup, name: row.name, ok: row.ok,
          seconds: row.seconds, assertions: row.assertionLines, assertionDigest: row.assertionDigest,
          skipped: row.skipped, browserForbidden: row.browserForbidden});
        if (!row.ok) {
          emit('CPU_BENCH_FAILURE', {round: index, ...row});
          emitFailureLog(index, row.name, fs.readFileSync(row.log, 'utf8'));
        }
      }});
    } finally { clearInterval(sampler); }
    const endResources = resources();
    const compact = {workers, seconds: result.seconds, baseline, warmup, tests: result.results.length,
      failures: result.results.filter(row => !row.ok),
      assertions: result.results.map(row => [row.name, row.assertionLines, row.assertionDigest]),
      resources: {minimumSystemAvailableBytes: minAvailable,
        systemCpuBusyPercent: 100 * (endResources.busy - startResources.busy) / (endResources.total - startResources.total),
        pressureBefore: startPressure, pressureAfter: pressure()},
      testSeconds: result.results.map(row => [row.name, row.seconds])};
    const {assertions, testSeconds, failures, ...roundSummary} = compact;
    emit('CPU_BENCH_ROUND', {round: index, ...roundSummary,
      failureCount: failures.length, assertionCount: assertions.reduce((sum, row) => sum + row[1], 0),
      assertionDigest: require('node:crypto').createHash('sha256').update(JSON.stringify(assertions)).digest('hex')});
    if (compact.failures.length) throw new Error('CPU benchmark is not stable; no setting may be adopted');
    if (rounds.length && JSON.stringify(rounds[0].assertions) !== JSON.stringify(compact.assertions))
      throw new Error('Assertion coverage differs between rounds');
    rounds.push(compact);
    if (JSON.stringify(hash()) !== JSON.stringify(before)) throw new Error('Source changed during benchmark');
  }
  const measured = rounds.filter(round => !round.warmup);
  const two = median(measured.filter(round => round.workers === 2).map(round => round.seconds));
  const four = median(measured.filter(round => round.workers === 4).map(round => round.seconds));
  // Prefer two unless four gives a material gain beyond ordinary scheduling noise.
  const one = median(measured.filter(round => round.workers === 1).map(round => round.seconds));
  const candidate = four < two * 0.95 ? 4 : 2;
  const chosenWorkers = (candidate === 4 ? four : two) < one * 0.95 ? candidate : 1;
  const summary = {source: manifest.main, tests: manifest.tests.length, rounds: measured.length, one, two, four,
    cpuPoolPercentFaster: (two - four) / two * 100, chosenWorkers,
    policy: 'Four requires >=5% median gain over two; candidate requires >=5% gain over serial baseline. All tests green; browser/GPU tests unchanged.'};
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({summary, rounds}, null, 2) + '\n');
  emit('CPU_BENCH_SUMMARY', summary);
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
