// Rastert die Poster-SVGs mit Chromium auf 1080x1920 PNG.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const DIR = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1080,height:1920}, deviceScaleFactor:1 });
  for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.svg')).sort()) {
    await p.setContent(`<style>html,body{margin:0;padding:0;background:#04050a;overflow:hidden}svg{display:block}</style>`
      + fs.readFileSync(DIR+'/'+f,'utf8'), { waitUntil:'load' });
    await p.waitForTimeout(300);
    await p.screenshot({ path: DIR+'/'+f.replace('.svg','.png') });
    console.log('  ', f.replace('.svg','.png'));
  }
  await b.close();
})();
