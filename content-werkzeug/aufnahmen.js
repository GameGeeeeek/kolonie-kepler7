// Ein einziger Browserlauf: erst MESSEN wo die Gebaeudeliste steht, dann dorthin
// scrollen und schiessen. Nur ein Login pro Lauf - das Backend begrenzt sie pro IP.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8900';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:648,height:1152},
    deviceScaleFactor:1080/648, isMobile:true, hasTouch:true });
  const p = await ctx.newPage();
  const warte = ms => p.waitForTimeout(ms);
  const weg = () => p.evaluate(() => {
    ['updateCloseBtn','kofiEmailPromptCloseBtn','welcomeBackCloseBtn'].forEach(id => {
      const e = document.getElementById(id); if (e && e.offsetParent) e.click(); });
    document.querySelectorAll('button').forEach(x => {
      if (/^\s*(✓\s*)?Verstanden\s*$/i.test(x.textContent||'')) x.click();
      if (/Weiter geht/i.test(x.textContent||'')) x.click(); });
    const uo = document.getElementById('updateNoticeOverlay'); if (uo) uo.style.display='none';
  }).catch(()=>{});

  await p.goto(BASE + '/weltraum_kolonie.html', { waitUntil:'load' });
  await warte(5000);
  await p.evaluate(() => document.querySelector('[data-ll-open="login"]')?.click());
  await warte(900);
  await p.fill('#loginUsername','Kommandant'); await p.fill('#loginPassword','demo123456');
  await p.click('#loginSubmitBtn'); await warte(8000);
  if (!await p.evaluate(() => !document.getElementById('loginOverlay')?.offsetParent)) {
    console.error('NICHT ANGEMELDET'); await b.close(); return; }
  await weg(); await warte(2000); await weg(); await warte(1500);

  // MESSEN: wo steht die Gebaeudeliste im Basis-Tab?
  const lage = await p.evaluate(() => {
    const box = document.getElementById('buildings');
    const r = box ? box.getBoundingClientRect() : null;
    const erste = box ? box.querySelector('div') : null;
    return { hatBox: !!box, top: r ? Math.round(r.top + window.scrollY) : null,
             hoehe: r ? Math.round(r.height) : null, seite: Math.round(document.body.scrollHeight),
             text: erste ? (erste.textContent||'').trim().slice(0,50) : null };
  });
  console.log('Gebaeudeliste:', JSON.stringify(lage));

  if (lage.hatBox && lage.top != null) {
    for (const [k, name] of [[0,'05_gebaeude_stadt'], [700,'06_gebaeude_stadt2']]) {
      await p.evaluate(y => window.scrollTo(0, y), lage.top - 90 + k);
      await warte(1500);
      await p.screenshot({ path: OUT+'/'+name+'.png' });
      console.log('  ', name, 'bei y =', lage.top - 90 + k);
    }
  }
  // Verteidigungsanlagen als Bauwerke
  await p.evaluate(() => document.querySelector('[data-tab="verteidigung"]')?.click());
  await warte(3200); await weg();
  const vlage = await p.evaluate(() => {
    const box = document.getElementById('defenseBuildings');
    const r = box ? box.getBoundingClientRect() : null;
    return r ? Math.round(r.top + window.scrollY) : null;
  });
  console.log('Verteidigungsliste bei y =', vlage);
  if (vlage != null) { await p.evaluate(y => window.scrollTo(0, y), vlage - 90); await warte(1500);
    await p.screenshot({ path: OUT+'/07_verteidigung.png' }); console.log('   07_verteidigung'); }
  await b.close();
})();
