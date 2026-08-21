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

// ZUM FORMAT: Die drei Bildflaechen sind JPEG, die Textur bleibt PNG - und das ist gemessen,
// nicht Geschmack. Ihr Inhalt ist fast ausschliesslich WEICHER VERLAUF (Planetenkoerper,
// Terminator, Nebel), und genau daran scheitert PNG: Es speichert jeden Farbwert verlustfrei
// und kann aus einem Verlauf nichts wegnehmen. Gemessen am Banner: 787 kB als PNG.
// Banner und Hintergrund laden bei JEDEM Aufruf der Spielseite mit - zusammen waren das
// 1,4 MB, bevor der Besucher ein Wort gelesen hat.
// Die Textur bleibt PNG, weil sie nach dem Wegfall des Nebels fast leer ist (14 kB) und
// JPEG um jeden Stern Ringe malen wuerde - dort ist genau die harte Kante der Inhalt.
const BILDER = [
  { name: 'cover',       vorlage: 'cover.html',            datei: 'itch-cover.jpg',       b: 630,  h: 500,  typ: 'jpeg', qualitaet: 90, zweck: 'Cover (Suche/Stoebern)' },
  { name: 'banner',      vorlage: 'theme-banner.html',     datei: 'itch-banner.jpg',      b: 960,  h: 300,  typ: 'jpeg', qualitaet: 90, zweck: 'Banner (ersetzt den Titel)' },
  // skala 1 statt 2: Der Hintergrund ist eine TEXTUR, die sich ueber die ganze Seite
  // wiederholt - kein Bild, das jemand ansieht. Mit skala 2 wog die Datei 2.026 kB und
  // laedt bei JEDEM Seitenaufruf mit; die feinen Nebelverlaeufe komprimiert PNG schlecht.
  // Gemessen ist der Unterschied im gerenderten Bild nicht auszumachen (Sterne sind 1-2 px,
  // der Nebel ist ein weicher Verlauf) - die vierfache Datenmenge zahlt auf nichts ein.
  { name: 'hintergrund', vorlage: 'theme-hintergrund.html', datei: 'itch-hintergrund.png', b: 1600, h: 1000, skala: 1, zweck: 'Seitenhintergrund (kachelt)', nahtlos: true },
  { name: 'embed',       vorlage: 'theme-embed.html',      datei: 'itch-embed-bg.jpg',    b: 960,  h: 600,  typ: 'jpeg', qualitaet: 90, zweck: 'Embed-BG (nur bei "Click to play")' }
];

// Nahtlosigkeit MESSEN statt behaupten. Ein gekacheltes Bild zeigt genau dann eine Kante,
// wenn sich die Pixel ueber die Wiederholungsgrenze hinweg staerker unterscheiden als im
// Bildinneren. Gemessen wird deshalb der mittlere Helligkeitssprung zwischen zwei benachbarten
// Spalten (bzw. Zeilen) - einmal an der Nahtstelle (letzte Spalte gegen erste), und als
// Bezugsgroesse der Durchschnitt ueber alle inneren Nachbarpaare. Liegt die Naht im Rahmen des
// Inneren, ist sie keine.
// Das ist die Gegenrichtung zu "sieht gut aus": Ein Blick auf die EINZELNE Kachel kann eine
// Naht gar nicht zeigen, weil die Naht erst beim Wiederholen entsteht.
async function nahtMessen(page) {
  return await page.evaluate(() => {
    const c = document.getElementById('sterne');
    // Die Masse kommen aus der LEINWAND selbst, nicht aus der Tabelle oben. Seit die Kulisse
    // ihren Speicher auf die Geraete-Aufloesung stellt (kulisse.js, Punkt 2), sind das bei
    // deviceScaleFactor 2 doppelt so viele Bildpunkte wie CSS-Masse. Mit den Tabellenwerten
    // haette getImageData das linke obere VIERTEL gelesen - die "Naht" laege dann mitten im
    // Bild, und die Pruefung waere aus dem falschen Grund gruen (Hausregel 28).
    const B = c.width, H = c.height;
    const d = c.getContext('2d').getImageData(0, 0, B, H).data;
    const hell = (x, y) => { const i = (y * B + x) * 4; return (d[i] + d[i + 1] + d[i + 2]) / 3; };
    const sprung = (f) => { let s = 0, n = 0; f((a) => { s += a; n++; }); return n ? s / n : 0; };

    const nahtX = sprung(add => { for (let y = 0; y < H; y++) add(Math.abs(hell(B - 1, y) - hell(0, y))); });
    const nahtY = sprung(add => { for (let x = 0; x < B; x++) add(Math.abs(hell(x, H - 1) - hell(x, 0))); });
    // Bezugsgroesse: alle inneren senkrechten Nachbarpaare, gleichmaessig abgetastet.
    const innenX = sprung(add => { for (let x = 1; x < B - 1; x += 7) for (let y = 0; y < H; y += 3) add(Math.abs(hell(x, y) - hell(x + 1, y))); });
    const innenY = sprung(add => { for (let y = 1; y < H - 1; y += 7) for (let x = 0; x < B; x += 3) add(Math.abs(hell(x, y) - hell(x, y + 1))); });
    return { nahtX, nahtY, innenX, innenY, B, H };
  });
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

    const skala = bild.skala || 2;
    const ctx = await browser.newContext({ viewport: { width: bild.b, height: bild.h }, deviceScaleFactor: skala });
    const page = await ctx.newPage();
    await page.goto('file://' + vorlage);
    await page.waitForTimeout(350);

    let nahtNote = '';
    if (bild.nahtlos) {
      const m = await nahtMessen(page);
      // Schranke als REGEL, nicht als Literal: Die Naht darf nicht auffaelliger sein als ein
      // gewoehnlicher Nachbarschritt im Bildinneren (mit etwas Luft nach oben).
      const okX = m.nahtX <= m.innenX * 1.5 + 0.05;
      const okY = m.nahtY <= m.innenY * 1.5 + 0.05;

      // UND die Messung sagt, wenn sie gar nichts belegen kann. Gemessen an derselben
      // Vorlage in vier Stellungen (21.08.2026):
      //
      //   duenn besetzt, Umschlag AN    Naht x=0.000 / innen 0.020   [nahtlos]
      //   duenn besetzt, Umschlag AUS   Naht x=0.000 / innen 0.020   [nahtlos]   <-- vacuous
      //   dicht besetzt, Umschlag AN    Naht x=0.261 / innen 0.473   [nahtlos]
      //   dicht besetzt, Umschlag AUS   Naht x=0.492 / innen 0.472   [NAHT SICHTBAR]
      //
      // Die zweite Zeile ist der Grund fuer diesen Block: Beim ausgelieferten Hintergrund
      // beruehrt schlicht KEIN Stern die Randspalten - es gibt dort nichts, was eine Naht
      // bilden koennte, und ein selbstbewusstes "nahtlos" waere eine Aussage ohne Grundlage.
      // Die dritte und vierte Zeile belegen, dass das Werkzeug taugt, sobald es etwas zu
      // messen gibt. (Dieselbe Familie wie das /health des Pi, das von aussen gar nicht
      // erreichbar war: Eine Pruefung, die nicht fehlschlagen KANN, prueft nichts.)
      const aussage = m.innenX >= 0.05 && m.innenY >= 0.05;

      nahtNote = '   [' + m.B + 'x' + m.H + '] Naht x=' + m.nahtX.toFixed(3) + '/innen ' + m.innenX.toFixed(3) +
                 ' · y=' + m.nahtY.toFixed(3) + '/innen ' + m.innenY.toFixed(3) +
                 (!(okX && okY) ? '  [NAHT SICHTBAR]'
                                : aussage ? '  [nahtlos]'
                                          : '  [nahtlos - aber die Kachel ist zu inhaltsarm, die Messung belegt hier nichts]');
      if (!(okX && okY)) fehler++;
    }

    const ziel = path.join(ZIEL_DIR, bild.datei);
    await page.screenshot(bild.typ === 'jpeg'
      ? { path: ziel, type: 'jpeg', quality: bild.qualitaet || 90 }
      : { path: ziel });
    await ctx.close();
    const kb = Math.round(fs.statSync(ziel).size / 1024);
    console.log('  OK  ' + bild.datei.padEnd(22) + String(kb).padStart(5) + ' kB   ' +
                bild.b + 'x' + bild.h + ' (Datei ' + bild.b * skala + 'x' + bild.h * skala + ')   ' + bild.zweck + nahtNote);
    gemacht++;
  }

  await browser.close();
  console.log('\n' + gemacht + ' Bild(er) in ' + ZIEL_DIR + (fehler ? '  -  ' + fehler + ' Problem(e)' : ''));
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error('ABSTURZ: ' + e.message); process.exit(1); });
