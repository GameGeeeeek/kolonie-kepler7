'use strict';
// Read-only, loopback-only server for tests whose existing API fixtures use /api URLs.
// Usage: node tests/http-run.js test_karte_handy_bedienung.js test_kartenfokus.js sweep.js
// Full suite with the same isolated HTTP origin: node tests/http-run.js --full
// KEPLER_SPIELDATEI selects a baseline/counterexample without modifying the checkout.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { SPIELDATEI, WURZEL } = require('./lib/spieldatei');

async function main() {
  const names = process.argv.slice(2);
  const full = names.length === 1 && names[0] === '--full';
  const split = names.length === 1 && /^--part=(\d+)\/([1-9]\d*)$/.exec(names[0]);
  if (split && Number(split[1]) >= Number(split[2])) throw new Error('Invalid test partition');
  const suite = full || !!split;
  if (!suite && (!names.length || names.some(name => !/^(?:test_[a-zA-Z0-9_]+|sweep)\.js$/.test(name)))) {
    throw new Error('Supply test_*.js or sweep.js basenames from the tests directory');
  }
  const partition = split ? fs.readdirSync(__dirname).filter(name => /^test_.*\.js$/.test(name) || name === 'sweep.js').sort()
    .filter((name,index) => index % Number(split[2]) === Number(split[1])) : [];
  const tests = full ? [path.join(WURZEL, 'pruflauf.js')] : split ? [path.join(__dirname,'run.js')] : names.map(name => path.join(__dirname, name));
  for (const test of tests) {
    if (!fs.statSync(test).isFile()) throw new Error('Not a test file: ' + test);
  }
  const game = fs.readFileSync(SPIELDATEI);
  const assets = new Map();
  const assetNames = ['tabler-icons-full.woff2', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'kepler-graphics.css', 'service-worker.js', 'manifest.json',
    ...fs.readdirSync(WURZEL).filter(name => /^kepler-gfx-[a-z-]+\.png$/.test(name))];
  for (const name of assetNames) {
    const file = path.join(WURZEL, name);
    if (fs.existsSync(file)) assets.set('/' + name, fs.readFileSync(file));
  }
  const version = game.toString('utf8').match(/\bconst VERSION\s*=\s*['"]([^'"]+)['"]/);
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405); res.end(); return;
    }
    const target = new URL(req.url, 'http://127.0.0.1').pathname;
    let data, mime;
    if (target === '/' || target === '/weltraum_kolonie.html') {
      data = game; mime = 'text/html; charset=utf-8';
    } else if (target === '/version.txt' && version) {
      data = Buffer.from(version[1]); mime = 'text/plain; charset=utf-8';
    } else if (assets.has(target)) {
      data = assets.get(target); mime = target.endsWith('.woff2') ? 'font/woff2' : target.endsWith('.css') ? 'text/css; charset=utf-8' : target.endsWith('.js') ? 'application/javascript' : target.endsWith('.json') ? 'application/json' : 'image/png';
    } else {
      // No API, repository, credential or arbitrary filesystem access. The tests own API mocks.
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = 'http://127.0.0.1:' + server.address().port + '/';
  let failed = false;
  try {
    for (let i = 0; i < tests.length; i++) {
      console.log('\nHTTP regression: ' + (full ? 'complete repository suite' : split ? names[0]+' ('+partition.length+' tests)' : names[i]));
      const code = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath,
          ['--require', path.join(__dirname, 'lib/http-test-origin.js'), tests[i], ...partition],
          { env: { ...process.env, KEPLER_HTTP_TEST_ORIGIN: origin,
            ...(suite ? {NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' + JSON.stringify(path.join(__dirname,'lib/http-test-origin.js'))).trim()} : {}) },
            stdio: 'inherit', ...(suite ? {} : {timeout: 180000}) });
        child.once('error', reject);
        child.once('exit', (status, signal) => resolve(signal ? 1 : status));
      });
      if (code !== 0) failed = true;
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
