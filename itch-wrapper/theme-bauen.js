// Rendert ALLE itch.io-Bilder aus den Vorlagen daneben nach presse-bilder/.
//
// EIN Bauer statt vier: Vorher gab es cover-bauen.js nur fuer das Coverbild. Eine zweite Kopie
// derselben zwanzig Zeilen laeuft beim naechsten Umbau auseinander (Hausregel 43) - deshalb
// steht hier eine TABELLE, und ein fuenftes Bild ist eine Zeile, kein zweites Skript.
//
// Zu den Massen: itch.io nennt fuer Banner, Hintergrund und Embed-BG in seiner Doku KEINE
// Pixelmasse (geprueft 21.08.2026). Die Begruendung fuer jede Zahl steht im Kopf der jeweiligen
// Vorlage, nicht hier - sonst gibt es zwei Stellen, die es erklaeren.
//
// Aufruf:  node itch-wrapper/theme-bauen.js [nur-einer]
const path = require('path');
const fs = require('fs');
const { starteBrowser, WURZEL } = require('../tests/lib/umgebung');

const ZIEL_DIR = path.join(WURZEL, 'presse-bilder');

const BILDER = [
  { name: 'cover',       vorlage: 'cover.html',            datei: 'itch-cover.png',       b: 630,  h: 500,  zweck: 'Cover (Suche/Stoebern)' },
  { name: 'banner',      vorlage: 'theme-banner.html',     datei: 'itch-banner.png',      b: 960,  h: 300,  zweck: 'Banner (ersetzt den Titel)' },
  { name: 'hintergrund', vorlage: 'theme-hintergrund.html', datei: 'itch-hintergrund.png', b: 1600, h: 1000, zweck: 'Seitenhintergrund (kachelt)', nahtlos: true },
  { name: 'embed',       vorlage: 'theme-embed.html',      datei: 'itch-embed-bg.png',    b: 960,  h: 600,  zweck: 'Embed-BG (nur bei "Click to play")' }
];

// Nahtlosigkeit MESSEN statt behaupten. Ein gekacheltes Bild zeigt genau dann eine Kante,
// wenn sich die Pixel ueber die Wiederholungsgrenze hinweg staerker unterscheiden als im
// Bildinneren. Gemessen wird deshalb der mittlere Helligkeitssprung zwischen zwei benachbarten
// Spalten (bzw. Zeilen) - einmal an der Nahtstelle (letzte Spalte gegen erste), und als
// Bezugsgroesse der Durchschnitt ueber alle inneren Nachbarpaare. Liegt die Naht im Rahmen des
// Inneren, ist sie keine.
// Das ist die Gegenrichtung zu "sieht gut aus": Ein Blick auf die EINZELNE Kachel kann eine
// Naht gar nicht zeigen, weil die Naht erst beim Wiederholen entsteht.
async function nahtMessen(page, b, h) {
  return await page.evaluate(([B, H]) => {
    const c = document.getElementById('sterne');
    const d = c.getContext('2d').getImageData(0, 0, B, H).data;
    const hell = (x, y) => { const i = (y * B + x) * 4; return (d[i] + d[i + 1] + d[i + 2]) / 3; };
    const sprung = (f) => { let s = 0, n = 0; f((a) => { s += a; n++; }); return n ? s / n : 0; };

    const nahtX = sprung(add => { for (let y = 0; y < H; y++) add(Math.abs(hell(B - 1, y) - hell(0, y))); });
    const nahtY = sprung(add => { for (let x = 0; x < B; x++) add(Math.abs(hell(x, H - 1) - hell(x, 0))); });
    // Bezugsgroesse: alle inneren senkrechten Nachbarpaare, gleichmaessig abgetastet.
    const innenX = sprung(add => { for (let x = 1; x < B - 1; x += 7) for (let y = 0; y < H; y += 3) add(Math.abs(hell(x, y) - hell(x + 1, y))); });
    const innenY = sprung(add => { for (let y = 1; y < H - 1; y += 7) for (let x = 0; x < B; x += 3) add(Math.abs(hell(x, y) - hell(x, y + 1))); });
    return { nahtX, nahtY, innenX, innenY };
  }, [b, h]);
}

(async () => {
  const nur = process.argv[2];
  if (!fs.existsSync(ZIEL_DIR)) fs.mkdirSync(ZIEL_DIR, { recursive: true });
  const browser = await starteBrowser();
  let gemacht = 0, fehler = 0;

  for (const bild of BILDER) {
    if (nur && bild.name !== nur) continue;
    const vorlage = path.join(WURZEL, 'itch-wrapper', bild.vorlage);
    if (!fs.existsSync(vorlage)) { console.log('  FEHLT  ' + bild.vorlage); fehler++; continue; }

    const ctx = await browser.newContext({ viewport: { width: bild.b, height: bild.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto('file://' + vorlage);
    await page.waitForTimeout(350);

    let nahtNote = '';
    if (bild.nahtlos) {
      const m = await nahtMessen(page, bild.b, bild.h);
      // Schranke als REGEL, nicht als Literal: Die Naht darf nicht auffaelliger sein als ein
      // gewoehnlicher Nachbarschritt im Bildinneren (mit etwas Luft nach oben).
      const okX = m.nahtX <= m.innenX * 1.5 + 0.05;
      const okY = m.nahtY <= m.innenY * 1.5 + 0.05;
      nahtNote = '   Naht x=' + m.nahtX.toFixed(3) + '/innen ' + m.innenX.toFixed(3) +
                 ' · y=' + m.nahtY.toFixed(3) + '/innen ' + m.innenY.toFixed(3) +
                 (okX && okY ? '  [nahtlos]' : '  [NAHT SICHTBAR]');
      if (!(okX && okY)) fehler++;
    }

    const ziel = path.join(ZIEL_DIR, bild.datei);
    await page.screenshot({ path: ziel });
    await ctx.close();
    const kb = Math.round(fs.statSync(ziel).size / 1024);
    console.log('  OK  ' + bild.datei.padEnd(22) + String(kb).padStart(5) + ' kB   ' +
                bild.b + 'x' + bild.h + ' (Datei ' + bild.b * 2 + 'x' + bild.h * 2 + ')   ' + bild.zweck + nahtNote);
    gemacht++;
  }

  await browser.close();
  console.log('\n' + gemacht + ' Bild(er) in ' + ZIEL_DIR + (fehler ? '  -  ' + fehler + ' Problem(e)' : ''));
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error('ABSTURZ: ' + e.message); process.exit(1); });
