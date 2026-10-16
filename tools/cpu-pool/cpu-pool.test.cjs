'use strict';
// Run only as the benchmark job's preflight. Fixtures are synthetic Node programs;
// they never load game tests, real browsers, services, or external process IDs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {blob, verifyManifest, runPool} = require('./cpu-pool.cjs');

const linux = process.platform === 'linux';
const options = {skip: !linux, concurrency: false};
const base = path.resolve(process.env.RUNNER_TEMP || os.tmpdir());
const deadlines = {timeoutMs: 500, graceMs: 100, killWaitMs: 3000};

async function fixture(files, action) {
  const directory = fs.mkdtempSync(path.join(base, 'kepler-cpu-pool-selftest-'));
  const root = path.join(directory, 'repo');
  fs.mkdirSync(path.join(root, 'tests'), {recursive: true});
  const output = path.join(directory, 'logs');
  try {
    for (const [relative, source] of Object.entries(files)) {
      const target = path.resolve(root, relative);
      assert.ok(target.startsWith(root + path.sep), 'fixture write must stay inside its own directory');
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, source);
    }
    return await action({root, output, directory});
  } finally {
    const resolved = fs.realpathSync(directory);
    const resolvedBase = fs.realpathSync(base);
    assert.ok(resolved.startsWith(resolvedBase + path.sep), 'cleanup must stay beneath runner temporary storage');
    assert.ok(path.basename(resolved).startsWith('kepler-cpu-pool-selftest-'));
    fs.rmSync(resolved, {recursive: true, force: true});
  }
}

for (const workers of [2, 4]) {
  test('runs each synthetic fixture exactly once, with maximum concurrency ' + workers, options, async () => {
    await fixture({}, async ({root, output, directory}) => {
      const events = path.join(directory, 'events.jsonl');
      const names = Array.from({length: 8}, (_, index) => 'test_fixture_' + index + '.js');
      for (const [index, name] of names.entries()) fs.writeFileSync(path.join(root, 'tests', name), `
        const fs = require('node:fs');
        const emit = phase => fs.appendFileSync(${JSON.stringify(events)}, JSON.stringify({index:${index},phase})+'\\n');
        emit('start');
        setTimeout(() => { emit('end'); console.log('OK - fixture ${index}'); }, 350);
      `);
      const result = await runPool({root, names, workers, output, timeoutMs: 3000, graceMs: 100, killWaitMs: 3000});
      assert.equal(result.results.length, names.length);
      assert.ok(result.results.every(row => row.ok), JSON.stringify(result.results));
      assert.deepEqual(result.results.map(row => row.name).sort(), [...names].sort());
      const rows = fs.readFileSync(events, 'utf8').trim().split('\n').map(line => JSON.parse(line));
      const running = new Set(), starts = new Set(), ends = new Set();
      let maximum = 0;
      for (const row of rows) {
        if (row.phase === 'start') {
          assert.equal(starts.has(row.index), false, 'fixture must not run twice');
          starts.add(row.index); running.add(row.index);
          maximum = Math.max(maximum, running.size);
          assert.ok(running.size <= workers, 'CPU process limit must never be exceeded');
        } else {
          assert.equal(row.phase, 'end');
          assert.equal(running.delete(row.index), true, 'every finish needs its own preceding start');
          assert.equal(ends.has(row.index), false);
          ends.add(row.index);
        }
      }
      assert.equal(maximum, workers, 'configured concurrency must actually be exercised');
      assert.equal(running.size, 0);
      assert.equal(starts.size, names.length);
      assert.equal(ends.size, names.length);
    });
  });
}

test('nonzero exits and crashes are failures', options, async () => {
  await fixture({
    'tests/test_nonzero.js': "console.error('synthetic failure'); process.exit(1);",
    'tests/test_crash.js': "process.kill(process.pid, 'SIGKILL');",
  }, async ({root, output}) => {
    const result = await runPool({root, output, workers: 2,
      names: ['test_nonzero.js', 'test_crash.js'], timeoutMs: 3000, graceMs: 100, killWaitMs: 3000});
    const byName = new Map(result.results.map(row => [row.name, row]));
    assert.equal(byName.get('test_nonzero.js').status, 1);
    assert.equal(byName.get('test_nonzero.js').ok, false);
    assert.equal(byName.get('test_crash.js').signal, 'SIGKILL');
    assert.equal(byName.get('test_crash.js').ok, false);
  });
});

test('ignored SIGTERM is forcibly cleaned up, and remains a timeout failure', options, async () => {
  await fixture({'tests/test_ignore_term.js': `
    process.on('SIGTERM', () => console.log('TERM ignored'));
    console.log('READY'); setInterval(() => {}, 50);
  `}, async ({root, output}) => {
    const {results: [row]} = await runPool({root, output, workers: 1, names: ['test_ignore_term.js'], ...deadlines});
    assert.equal(row.timedOut, true);
    assert.equal(row.ok, false);
    assert.equal(row.signal, 'SIGKILL');
    assert.equal(row.cleanupError, null);
    assert.match(fs.readFileSync(row.log, 'utf8'), /READY[\s\S]*TERM ignored/);
  });
});

test('SIGTERM followed by exit zero still fails as a timeout', options, async () => {
  await fixture({'tests/test_term_zero.js': `
    process.on('SIGTERM', () => process.exit(0));
    console.log('READY'); setInterval(() => {}, 50);
  `}, async ({root, output}) => {
    const {results: [row]} = await runPool({root, output, workers: 1, names: ['test_term_zero.js'], ...deadlines});
    assert.equal(row.status, 0, 'negative control must genuinely exit zero after TERM');
    assert.equal(row.timedOut, true);
    assert.equal(row.terminationReason, 'test timeout');
    assert.equal(row.ok, false, 'timeout must never be accepted as a green test');
    assert.equal(row.cleanupError, null);
    assert.match(fs.readFileSync(row.log, 'utf8'), /READY/);
  });
});

test('a surviving owned descendant is removed before the pool returns', options, async () => {
  await fixture({}, async ({root, output, directory}) => {
    const proof = path.join(directory, 'owned-child.json');
    const descendant = "process.on('SIGTERM',()=>{}); process.send({pid:process.pid}); setInterval(()=>{},50);";
    fs.writeFileSync(path.join(root, 'tests/test_descendant.js'), `
      const fs=require('node:fs'),{spawn}=require('node:child_process');
      const child=spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:['ignore','ignore','ignore','ipc']});
      child.once('message', data=>{
        fs.writeFileSync(${JSON.stringify(proof)},JSON.stringify({parent:process.pid,child:data.pid}));
        child.disconnect(); child.unref(); process.exit(0);
      });
    `);
    const {results: [row]} = await runPool({root, output, workers: 1, names: ['test_descendant.js'],
      timeoutMs: 2000, graceMs: 100, killWaitMs: 3000});
    const ids = JSON.parse(fs.readFileSync(proof, 'utf8'));
    assert.equal(row.status, 0, 'parent fixture must finish normally');
    assert.equal(row.timedOut, false, 'this must exercise residual-child cleanup, not the timeout path');
    assert.equal(row.terminationReason, 'residual descendants after test exit');
    assert.equal(row.cleanupError, null);
    assert.equal(row.ok, false, 'leaked child must fail its originating fixture');
    for (const pid of [ids.parent, ids.child]) {
      assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH', 'owned process must already be gone');
    }
    assert.throws(() => process.kill(-ids.parent, 0), error => error.code === 'ESRCH', 'owned group must already be empty');
  });
});

test('fake Playwright launch is blocked; the unguarded counterexample writes a marker', options, async () => {
  await fixture({}, async ({root, output, directory}) => {
    const marker = path.join(directory, 'fake-browser-launched');
    fs.mkdirSync(path.join(root, 'node_modules/playwright'), {recursive: true});
    fs.writeFileSync(path.join(root, 'node_modules/playwright/index.js'), `
      const fs=require('node:fs');
      module.exports={chromium:{launch(){fs.writeFileSync(${JSON.stringify(marker)},'launched'); return Promise.resolve();}}};
    `);
    const name = 'test_fake_browser.js';
    fs.writeFileSync(path.join(root, 'tests', name), "require('playwright').chromium.launch();");
    const broken = spawnSync(process.execPath, [path.join(root, 'tests', name)],
      {cwd: root, encoding: 'utf8', timeout: 2000, killSignal: 'SIGKILL'});
    assert.equal(broken.status, 0, 'unguarded control is a successful fake browser launch');
    assert.equal(fs.existsSync(marker), true, 'counterexample must reach the fake launcher');
    fs.unlinkSync(marker);
    const {results: [row]} = await runPool({root, output, workers: 1, names: [name], timeoutMs: 2000, graceMs: 100, killWaitMs: 3000});
    assert.equal(row.ok, false);
    assert.equal(row.browserForbidden, true);
    assert.equal(fs.existsSync(marker), false, 'guard must prevent the launcher, not merely report it afterwards');
  });
});

test('skip is rejected for measurements but preserved in explicit legacy mode', options, async () => {
  await fixture({'tests/test_skip.js': "console.log('SKIP - synthetic optional fixture'); process.exit(0);"}, async ({root, output}) => {
    const strict = await runPool({root, output: path.join(output, 'strict'), workers: 1, names: ['test_skip.js'],
      timeoutMs: 2000, graceMs: 100, killWaitMs: 3000});
    assert.equal(strict.results[0].status, 0);
    assert.equal(strict.results[0].skipped, true);
    assert.equal(strict.results[0].ok, false);
    const legacy = await runPool({root, output: path.join(output, 'legacy'), workers: 1, names: ['test_skip.js'], allowSkipped: true,
      timeoutMs: 2000, graceMs: 100, killWaitMs: 3000});
    assert.equal(legacy.results[0].skipped, true);
    assert.equal(legacy.results[0].ok, true);
  });
});

test('manifest rejects changed, absent, unhashed and duplicate source selections', options, async () => {
  await fixture({'tests/test_manifest.js': "console.log('OK - original');"}, async ({root, output}) => {
    const source = path.join(root, 'tests/test_manifest.js');
    const manifest = {tests: ['test_manifest.js'], files: {'tests/test_manifest.js': blob(source)}};
    assert.doesNotThrow(() => verifyManifest(root, manifest));
    fs.appendFileSync(source, "\nconsole.log('changed');");
    assert.throws(() => verifyManifest(root, manifest), /CPU source changed/);
    fs.unlinkSync(source);
    assert.throws(() => verifyManifest(root, manifest), /ENOENT/);
    assert.throws(() => verifyManifest(root, {tests: ['test_manifest.js'], files: {}}), /Invalid\/unhashed/);
    assert.throws(() => verifyManifest(root, {...manifest, tests: ['test_manifest.js', 'test_manifest.js']}), /duplicate/i);
    await assert.rejects(runPool({root, output, workers: 2, names: ['test_manifest.js', 'test_manifest.js']}), /duplicate/i);
  });
});

test('mandatory-only entry point uses the same owned process runner and preserves its arguments', options, async () => {
  await fixture({'tests/run.js': `
    require('node:assert/strict').deepEqual(process.argv.slice(2), ['--nur-pflicht']);
    console.log('OK - mandatory arguments preserved');
  `}, async ({root, output}) => {
    const {results: [row]} = await runPool({root, output, workers: 1, names: ['run.js'],
      extraArgs: ['--nur-pflicht'], timeoutMs: 2000, graceMs: 100, killWaitMs: 3000});
    assert.equal(row.ok, true);
    await assert.rejects(runPool({root, output, workers: 1, names: ['run.js']}), /Invalid/);
    await assert.rejects(runPool({root, output, workers: 1, names: ['run.js'], extraArgs: ['--full']}), /Invalid/);
  });
});
