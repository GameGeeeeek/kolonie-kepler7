// Erzeugt alle vier Entwurfsbilder neu: erst die HTML-Seiten, dann die PNGs.
//
//   node docs/randkriege-entwuerfe/bilder.js            → HTML + PNG in dieses Verzeichnis
//   node docs/randkriege-entwuerfe/bilder.js --nur-html → ohne Browser (kein Playwright nötig)
//
// Die PNGs liegen bewusst NICHT im Repo: zusammen 2,8 MB, und sie sind aus diesen Skripten
// jederzeit wiederherstellbar. Dasselbe Prinzip wie bei patchnotes.html – es gibt eine Quelle,
// nicht zwei Stände, die auseinanderlaufen können.
const path = require('path');
const HIER = __dirname;

const SEITEN = [
  { datei: 'm4_front',      breite: 1180, was: 'Frontkarte' },
  { datei: 'm5_kriegsraum', breite: 1180, was: 'Kriegsraum' },
  { datei: 'm6_wappen',     breite: 1180, was: 'Symbolfamilie facw_*' },
  { datei: 'm7_handy',      breite:  900, was: 'Handy, 390 px' }
];

for (const s of SEITEN) require(path.join(HIER, s.datei + '.js'));

if (process.argv.includes('--nur-html')){
  console.log('HTML erzeugt, PNG übersprungen (--nur-html).');
  return;
}

const { starteBrowser } = require(path.join(HIER, '..', '..', 'tests', 'lib', 'umgebung'));

(async () => {
  const browser = await starteBrowser();
  for (const s of SEITEN){
    const ctx = await browser.newContext({ viewport:{ width:s.breite, height:600 }, deviceScaleFactor:2 });
    const seite = await ctx.newPage();
    const fehler = [];
    seite.on('pageerror', e => fehler.push(e.message));
    await seite.goto('file://' + path.join(HIER, s.datei + '.html'));
    await seite.waitForTimeout(600);
    // Höhe MESSEN statt raten – geratene Höhen haben beim ersten Durchgang zweimal den
    // unteren Rand der Seite abgeschnitten, ohne dass es beim Erzeugen auffiel.
    const hoehe = await seite.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height) + 20);
    await seite.setViewportSize({ width:s.breite, height:hoehe });
    await seite.waitForTimeout(400);
    await seite.screenshot({ path: path.join(HIER, s.datei + '.png') });
    console.log(`${s.datei}.png  ${s.breite}×${hoehe}  – ${s.was}${fehler.length ? '  FEHLER: '+fehler[0] : ''}`);
  }
  await browser.close();
})();
