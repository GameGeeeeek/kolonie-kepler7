'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { SPIELDATEI, WURZEL } = require('../tests/lib/spieldatei');

const source = fs.readFileSync(SPIELDATEI, 'utf8');
const corrected = 'const p = Math.max(0, Math.min(1, (t-t0)/dur));';
if (source.split(corrected).length !== 2) throw Error('Expected one native animation lower-bound clamp');
const broken = source.replace(corrected, 'const p = Math.min(1, (t-t0)/dur);');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-resource-animation-'));
const copy = path.join(directory, 'without-lower-bound.html');
try {
  fs.writeFileSync(copy, broken, 'utf8');
  const result = spawnSync(process.execPath, ['tests/test_resource_animation_frames.js'], {
    cwd: WURZEL,
    env: { ...process.env, KEPLER_SPIELDATEI: copy },
    encoding: 'utf8', timeout: 30000, maxBuffer: 512 * 1024
  });
  const output = (result.stdout || '') + (result.stderr || '');
  const lines = output.split(/\r?\n/);
  const failed = lines.filter(line => line.startsWith('FAIL - '));
  const expected = ['R1', 'F1'];
  const failedKeys = failed.map(line => /^FAIL - ([A-Z]\d):/.exec(line)?.[1]);
  const surviving = ['S0', 'R0', 'R2', 'R3', 'R4', 'R5', 'R6', 'F0', 'F2', 'F3', 'F4', 'F5', 'F6'];
  if (result.error || result.signal || result.status !== 1 || failedKeys.length !== expected.length ||
      expected.some(key => !failedKeys.includes(key)) || failedKeys.some(key => !expected.includes(key)) ||
      surviving.some(key => !lines.some(line => line.startsWith('OK - ' + key + ':'))) ||
      !lines.includes('15 checks, 2 failures')) {
    console.error(output);
    throw Error('Removing the native lower-bound clamp must reject only both early-frame stock bounds');
  }
  console.log('OK - native animation without the lower-bound clamp rejects only R1 and F1; all other 13 guards stay green');
} finally {
  // Delete only the two exact entries created here; never remove the game checkout recursively.
  if (fs.existsSync(copy)) fs.unlinkSync(copy);
  fs.rmdirSync(directory);
}
