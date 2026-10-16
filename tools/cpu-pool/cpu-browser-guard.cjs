'use strict';

// CPU-only candidates may import the shared environment for source paths or
// assertion helpers. Loading Playwright is permitted; starting any browser is not.
const Module = require('node:module');
const originalLoad = Module._load;
const guarded = new WeakSet();
function forbidden() { throw new Error('CPU_POOL_BROWSER_FORBIDDEN: CPU tests must not launch a browser'); }
function guardPlaywright(exports) {
  if (!exports || !['object', 'function'].includes(typeof exports)) return exports;
  for (const name of ['chromium', 'firefox', 'webkit']) {
    const engine = exports[name];
    if (!engine || guarded.has(engine)) continue;
    for (const method of ['launch', 'launchPersistentContext', 'connect', 'connectOverCDP']) {
      if (typeof engine[method] === 'function') engine[method] = forbidden;
    }
    guarded.add(engine);
  }
  return exports;
}
Module._load = function(request, parent, isMain) {
  const exports = originalLoad.apply(this, arguments);
  if (/(?:^|[/\\])playwright(?:-core)?(?:$|[/\\])/.test(request) ||
      /(?:^|[/\\])umgebung(?:\.js)?$/.test(request)) guardPlaywright(exports);
  return exports;
};

