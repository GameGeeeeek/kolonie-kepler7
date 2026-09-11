// Vergleichsbild im Browser bauen - kein ffmpeg noetig. Beide Aufnahmen zeigen
// denselben Ausschnitt; hier wird je die linke Haelfte (Symbol + Name) gegenueber-
// gestellt, weil genau dort der Unterschied sitzt.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const DIR = process.argv[2], OUT = process.argv[3];
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const br = await chromium.launch();
  const p = await br.newPage({ viewport:{width:1080,height:1920}, deviceScaleFactor:1 });
  const html = `<style>
    html,body{margin:0;padding:0;background:#05070d;width:1080px;height:1920px;overflow:hidden;
      font-family:'Liberation Sans',DejaVu Sans,sans-serif}
    .reihe{position:absolute;inset:0;display:flex}
    .halb{position:relative;width:540px;height:1920px;overflow:hidden}
    .halb img{position:absolute;top:-250px;left:0;width:1080px}
    .halb.rechts img{left:0}
    .band{position:absolute;top:0;left:0;right:0;height:104px;display:flex;align-items:center;
      justify-content:center;font-size:38px;font-weight:900;letter-spacing:3px;color:#fff;
      background:rgba(5,7,13,.88)}
    .links .band{color:#9aa6bd}
    .rechts .band{color:#8ee6c0}
    .trenn{position:absolute;left:539px;top:0;width:3px;height:1920px;background:#8ee6c0;
      box-shadow:0 0 26px rgba(142,230,192,.8);z-index:5}
    .fuss{position:absolute;left:0;right:0;bottom:0;height:150px;background:rgba(5,7,13,.92);
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;z-index:6}
    .fuss b{color:#fff;font-size:34px;font-weight:900;letter-spacing:.5px}
    .fuss span{color:#aeb8cc;font-size:24px}
  </style>
  <div class="reihe">
    <div class="halb links"><img src="${b64(DIR+'/vorher_8689.png')}"><div class="band">VORHER</div></div>
    <div class="halb rechts"><img src="${b64(DIR+'/nachher_8696.png')}"><div class="band">NACHHER</div></div>
  </div>
  <div class="trenn"></div>
  <div class="fuss"><b>23 Verteidigungsanlagen &middot; 29 Gebäude</b><span>gamegeeeeek.de</span></div>`;
  await p.setContent(html, { waitUntil:'load' });
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT });
  console.log('Vergleichsbild:', OUT);
  await br.close();
})();
