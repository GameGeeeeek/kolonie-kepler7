// Rendert itch-wrapper/cover.html auf exakt 630x500 nach presse-bilder/itch-cover.png.
// 630x500 ist die von itch.io empfohlene Groesse (Verhaeltnis 315:250, Minimum 315x250) -
// an der itch.io-Dokumentation geprueft, nicht geschaetzt.
const path = require('path');
const fs = require('fs');
const { starteBrowser, WURZEL } = require('../tests/lib/umgebung');

const VORLAGE = path.join(WURZEL, 'itch-wrapper', 'cover.html');
const ZIEL_DIR = path.join(WURZEL, 'presse-bilder');
const ZIEL = path.join(ZIEL_DIR, 'itch-cover.png');

(async () => {
  if (!fs.existsSync(ZIEL_DIR)) fs.mkdirSync(ZIEL_DIR, { recursive: true });
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 630, height: 500 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('file://' + VORLAGE);
  await page.waitForTimeout(300);
  await page.screenshot({ path: ZIEL });
  await browser.close();
  console.log('geschrieben: ' + ZIEL + ' (' + fs.statSync(ZIEL).size + ' Bytes, 1260x1000 px)');
})().catch(e => { console.error('ABSTURZ: ' + e.message); process.exit(1); });
