// Vier Poster nebeneinander zur Sichtprüfung - im Browser gebaut, kein ffmpeg noetig.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const DIR = process.argv[2], OUT = process.argv[3];
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
(async () => {
  const dateien = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort();
  const br = await chromium.launch();
  const p = await br.newPage({ viewport:{width:400*dateien.length, height:711}, deviceScaleFactor:1 });
  await p.setContent(`<style>html,body{margin:0;background:#000;display:flex}
    img{width:400px;height:711px;display:block}</style>`
    + dateien.map(f=>`<img src="${b64(DIR+'/'+f)}">`).join(''), { waitUntil:'load' });
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT });
  console.log('Reihe:', dateien.join(', '));
  await br.close();
})();
