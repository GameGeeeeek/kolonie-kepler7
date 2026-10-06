'use strict';
// Test-only preload: exercise the same relative /api URLs as the nginx deployment.
// file:// cannot resolve fetch('/api/health'), even with a Playwright route fixture.
const url = new URL(process.env.KEPLER_TESTDATEI || '');
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port) {
  throw new Error('The test preload requires an ephemeral loopback HTTP origin');
}
const paths = require('./spieldatei');
paths.SPIEL_URL = url.href;
