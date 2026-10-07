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
const companionAsset = /^(?:tabler-icons-full\.woff2|kepler-graphics\.css|kepler-gfx-[a-z-]+\.png)$/;
const wrapPage = async page => {
  // Some regressions navigate to their own modified HTML copy in a temp folder.
  // Keep that document intact, but give it the same stylesheet, font and graphics
  // as the actual game. Missing temp-folder assets would falsify layout comparisons.
  await page.route('file://**/*', async route => {
    let name;
    try { name = path.basename(fileURLToPath(route.request().url())); } catch { return route.continue(); }
    if (!companionAsset.test(name)) return route.continue();
    await route.fulfill({response: await route.fetch({url: new URL(name, url).href})});
  });
  const goto = page.goto.bind(page);
  page.goto = (target, options) => {
    if (!sameFile(target)) return goto(target, options);
    const source = new URL(target), redirected = new URL('weltraum_kolonie.html', url);
    redirected.search = source.search;
    redirected.hash = source.hash;
    return goto(redirected.href, options);
  };
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
  // The original file-origin fixtures cannot install a service worker. Keep that
  // isolation on HTTP too: a worker's own fetch bypasses Playwright page routes,
  // replacing mocked release HTML with the server's current HTML. Tests which
  // explicitly need workers can still opt in with serviceWorkers: 'allow'.
  browser.newContext = async (options = {}) => wrapContext(await newContext({serviceWorkers:'block', ...options}));
  browser.newPage = async (options = {}) => wrapPage(await newPage({serviceWorkers:'block', ...options}));
  return browser;
};
