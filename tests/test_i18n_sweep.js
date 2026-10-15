'use strict';
// Reuse the existing realistic, mocked-backend sweep without weakening any of its assertions.
// The normal sweep remains a German regression check; this is its English companion.
const assert = require('node:assert/strict');
const environment = require('./lib/umgebung');
const originalLaunch = environment.starteBrowser;
environment.starteBrowser = async function (options) {
  const browser = await originalLaunch(options);
  const originalContext = browser.newContext.bind(browser);
  browser.newContext = async function (contextOptions) {
    const context = await originalContext(contextOptions);
    await context.addInitScript(() => localStorage.setItem('kepler7_ui_language', 'en'));
    const originalPage = context.newPage.bind(context);
    context.newPage = async function () {
      const page = await originalPage();
      const originalGoto = page.goto.bind(page);
      page.goto = async function (...args) {
        const response = await originalGoto(...args);
        assert.equal(await page.evaluate(() => window.KeplerI18n && KeplerI18n.language), 'en', 'English runtime must actually be active');
        assert.equal(await page.getAttribute('html', 'lang'), 'en');
        console.log('OK - Actual game started with saved English selection');
        return response;
      };
      return page;
    };
    return context;
  };
  return browser;
};
require('./sweep');
