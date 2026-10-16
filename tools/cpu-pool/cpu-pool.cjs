'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');

function blob(file) {
  const data = Buffer.from(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
  return crypto.createHash('sha1').update('blob ' + data.length + '\0').update(data).digest('hex');
}
function verifyManifest(root, manifest) {
  if (!Array.isArray(manifest.tests) || !manifest.tests.length || new Set(manifest.tests).size !== manifest.tests.length)
    throw new Error('Empty or duplicate CPU test manifest');
  for (const name of manifest.tests) {
    if (!/^test_[A-Za-z0-9_]+\.js$/.test(name) || !manifest.files['tests/' + name])
      throw new Error('Invalid/unhashed CPU test ' + name);
  }
  for (const [relative, sha] of Object.entries(manifest.files)) {
    if (!relative.startsWith('tests/') || relative.includes('..') || !/^[0-9a-f]{40}$/.test(sha))
      throw new Error('Invalid CPU source manifest entry ' + relative);
    if (blob(path.join(root, relative)) !== sha) throw new Error('CPU source changed: ' + relative);
  }
}
function groupExists(pid) {
  try { process.kill(-pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runOwnedProcess({root, name, temp, log, active, timeoutMs, graceMs, killWaitMs, extraArgs}) {
  const fd = fs.openSync(log, 'w');
  const started = performance.now();
  return new Promise(resolve => {
    let settled = false, timeout, escalation;
    const state = {child: null, reason: null, closed: false};
    function signalOwned(signal) {
      // This PGID belongs only to the detached Linux child created below.
      // Never enumerate, signal, or stop any other runner/WSL/browser process.
      if (!state.child?.pid) return;
      try { process.kill(-state.child.pid, signal); }
      catch (error) { if (error.code !== 'ESRCH') state.cleanupError = String(error); }
    }
    state.stop = reason => {
      if (state.reason) return;
      state.reason = reason;
      signalOwned('SIGTERM');
      escalation = setTimeout(() => signalOwned('SIGKILL'), graceMs);
    };
    async function finish(status, signal, error) {
      if (settled) return;
      settled = true;
      state.closed = true;
      clearTimeout(timeout);
      let cleanupError = state.cleanupError || null;
      try {
        if (state.child?.pid && groupExists(state.child.pid)) {
          state.stop('residual descendants after test exit');
          const deadline = performance.now() + graceMs + killWaitMs;
          while (groupExists(state.child.pid) && performance.now() < deadline) await delay(25);
          if (groupExists(state.child.pid)) cleanupError = 'Owned process group did not become empty after SIGKILL';
        }
      } catch (problem) { cleanupError = String(problem); }
      clearTimeout(escalation);
      active.delete(state);
      fs.closeSync(fd);
      resolve({name, status, signal, error, terminationReason: state.reason, timedOut: state.reason === 'test timeout', cleanupError,
        seconds: (performance.now() - started) / 1000, log});
    }
    const child = spawn(process.execPath, ['--require', path.join(__dirname, 'cpu-browser-guard.cjs'), path.join(root, 'tests', name), ...extraArgs], {
      cwd: root, env: {...process.env, PC_CHROMIUM_GPU: '0', TMPDIR: temp, TEMP: temp, TMP: temp},
      stdio: ['ignore', fd, fd], detached: true,
    });
    state.child = child;
    active.add(state);
    timeout = setTimeout(() => state.stop('test timeout'), timeoutMs);
    child.once('error', error => finish(null, null, String(error)));
    child.once('close', (status, signal) => finish(status, signal, null));
  });
}

async function runPool({root, names, workers, output, onResult, allowSkipped = false,
  timeoutMs = 300000, graceMs = 5000, killWaitMs = 5000, extraArgs = []}) {
  if (process.platform !== 'linux') throw new Error('CPU process pool requires Linux-owned process groups');
  if (![1, 2, 4].includes(workers)) throw new Error('CPU workers must be 1, 2, or 4');
  const mandatory = Array.isArray(names) && names.length === 1 && names[0] === 'run.js' &&
    Array.isArray(extraArgs) && extraArgs.length === 1 && extraArgs[0] === '--nur-pflicht';
  if (!Array.isArray(names) || !names.length || new Set(names).size !== names.length ||
      names.some(name => !/^test_[A-Za-z0-9_]+\.js$/.test(name) && !mandatory)) throw new Error('Invalid or duplicate CPU test names');
  if (!Array.isArray(extraArgs) || (extraArgs.length && !mandatory)) throw new Error('Extra arguments are reserved for mandatory checks');
  if (![timeoutMs, graceMs, killWaitMs].every(value => Number.isInteger(value) && value > 0)) throw new Error('Invalid CPU test process deadline');
  fs.mkdirSync(output, {recursive: true});
  const results = [];
  const active = new Set();
  let abortReason = null;
  function interrupt(signal) {
    abortReason = 'Parent received ' + signal;
    for (const state of active) state.stop(abortReason);
  }
  const termHandler = () => interrupt('SIGTERM'), intHandler = () => interrupt('SIGINT');
  process.on('SIGTERM', termHandler);
  process.on('SIGINT', intHandler);
  let next = 0;
  async function worker() {
    while (next < names.length && !abortReason) {
      const name = names[next++];
      const temp = fs.mkdtempSync(path.join(output, name.replace(/\.js$/, '') + '-'));
      const log = path.join(temp, 'output.log');
      const result = await runOwnedProcess({root, name, temp, log, active, timeoutMs, graceMs, killWaitMs, extraArgs});
      const text = fs.readFileSync(log, 'utf8');
      result.skipped = /^(?:SKIP|UEBERSPRUNGEN|ÜBERSPRUNGEN)\b/m.test(text);
      result.browserForbidden = text.includes('CPU_POOL_BROWSER_FORBIDDEN');
      result.ok = result.status === 0 && !result.signal && !result.error && !result.timedOut && !result.terminationReason && !result.cleanupError &&
        (allowSkipped || !result.skipped) && !result.browserForbidden;
      if (result.cleanupError) abortReason = result.cleanupError;
      const checks = text.split(/\r?\n/).filter(line => /^(?:OK\s|PASS\b)/.test(line)).map(line => line.split(' | ')[0].trim());
      result.assertionLines = checks.length;
      result.assertionDigest = crypto.createHash('sha256').update(checks.join('\n')).digest('hex');
      results.push(result);
      if (onResult) onResult(result);
    }
  }
  const started = performance.now();
  let settled;
  try { settled = await Promise.allSettled(Array.from({length: Math.min(workers, names.length)}, worker)); }
  finally {
    process.removeListener('SIGTERM', termHandler);
    process.removeListener('SIGINT', intHandler);
  }
  if (abortReason) throw new Error(abortReason);
  const failedWorker = settled.find(result => result.status === 'rejected');
  if (failedWorker) throw failedWorker.reason;
  if (results.length !== names.length) throw new Error('CPU test coverage count changed');
  return {seconds: (performance.now() - started) / 1000, workers, results: results.sort((a, b) => a.name.localeCompare(b.name))};
}
module.exports = {blob, verifyManifest, runPool};

