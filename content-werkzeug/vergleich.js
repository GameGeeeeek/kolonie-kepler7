// Vorher/Nachher am gleichen Bildausschnitt. Geprueft wird am SICHTBAREN TEXT,
// nicht an offsetParent: loginOverlay ist position:fixed, dort ist offsetParent
// immer null - die fruehere Pruefung hielt die Startseite deshalb fuer abwesend
// und lieferte zweimal ein Bild der Landingpage.
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
  const lage = () => p.evaluate(() => {
    const lo = document.getElementById('loginOverlay');
    const t = document.body.innerText || '';
    return { startseite: lo ? getComputedStyle(lo).display !== 'none' : false,
             spiel: /Lasergeschütz|Flak-Batterie/.test(t) };
  });
  const weg = () => p.evaluate(() => {
    ['updateCloseBtn','kofiEmailPromptCloseBtn','welcomeBackCloseBtn'].forEach(id => {
      const e = document.getElementById(id);
      if (e && getComputedStyle(e).display !== 'none') e.click(); });
    document.querySelectorAll('button').forEach(x => {
      if (/^\s*(✓\s*)?Verstanden\s*$/i.test(x.textContent||'')) x.click();
      if (/Weiter geht/i.test(x.textContent||'')) x.click(); });
    const uo = document.getElementById('updateNoticeOverlay'); if (uo) uo.style.display='none';
  }).catch(()=>{});

  const schiess = async (pfad, name) => {
    await p.goto(BASE + pfad, { waitUntil:'load' });
    await warte(9000);
    let st = await lage();
    if (st.startseite) {                       // wirklich abgemeldet -> anmelden
      await p.evaluate(() => document.querySelector('[data-ll-open="login"]')?.click());
      await warte(900);
      await p.fill('#loginUsername','Kommandant'); await p.fill('#loginPassword','demo123456');
      await p.click('#loginSubmitBtn'); await warte(9000);
      st = await lage();
    }
    if (st.startseite) { console.error('  ABBRUCH', name, '- Startseite bleibt sichtbar'); return; }
    await weg(); await warte(2500); await weg();
    await p.evaluate(() => document.querySelector('[data-tab="verteidigung"]')?.click());
    await warte(5000); await weg(); await warte(1500);
    const y = await p.evaluate(() => {
      const box = document.getElementById('defenseBuildings');
      return box && box.getClientRects().length ? Math.round(box.getBoundingClientRect().top + window.scrollY) : null;
    });
    if (y == null) { console.error('  ABBRUCH', name, '- Liste nicht gerendert'); return; }
    await p.evaluate(yy => window.scrollTo(0, yy - 60), y);
    await warte(2000);
    // Letzte Kontrolle DIREKT vor dem Ausloesen
    const k = await lage();
    if (k.startseite || !k.spiel) { console.error('  ABBRUCH', name, '- Bild zeigt nicht die Liste:', JSON.stringify(k)); return; }
    await p.screenshot({ path: OUT+'/'+name+'.png' });
    console.log(`  ${name} OK (y=${y}, Spieltext sichtbar)`);
  };

  await schiess('/weltraum_kolonie.html', 'nachher_8696');
  await schiess('/alt/weltraum_kolonie.html', 'vorher_8689');
  await b.close();
})();
