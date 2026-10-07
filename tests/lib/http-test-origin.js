'use strict';
// Test-only preload: exercise the same relative /api URLs as the nginx deployment.
// file:// cannot resolve fetch('/api/health'), even with a Playwright route fixture.
const url = new URL(process.env.KEPLER_HTTP_TEST_ORIGIN || '');
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port) {
  throw new Error('The test preload requires an ephemeral loopback HTTP origin');
}
// Keep source-file URLs intact: some checks read the tested HTML with fileURLToPath.
// Redirect only navigation to that exact game file, including tests which construct FILE
// themselves instead of importing SPIEL_URL. API routes and every assertion remain unchanged.
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const environment = require('./umgebung');
const gameFile = path.resolve(environment.SPIELDATEI);
const sameFile = value => {
  try {
    const target = path.resolve(fileURLToPath(value));
    return process.platform === 'win32' ? target.toLowerCase() === gameFile.toLowerCase() : target === gameFile;
  } catch { return false; }
};
const wrapPage = page => {
  const goto = page.goto.bind(page);
  page.goto = (target, options) => goto(sameFile(target) ? new URL('weltraum_kolonie.html', url).href : target, options);
  return page;
};
const wrapContext = context => {
  const newPage = context.newPage.bind(context);
  context.newPage = async (...args) => wrapPage(await newPage(...args));
  return context;
};
const launch = environment.starteBrowser;
environment.starteBrowser = async (...args) => {
  const browser = await launch(...args);
  const newContext = browser.newContext.bind(browser), newPage = browser.newPage.bind(browser);
  browser.newContext = async (...args) => wrapContext(await newContext(...args));
  browser.newPage = async (...args) => wrapPage(await newPage(...args));
  return browser;
};
