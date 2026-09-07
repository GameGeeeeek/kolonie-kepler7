// Rendert die Brutkoerper der Alien-Nester als PNG - mit dem ECHTEN Zeichencode aus
// weltraum_kolonie.html, nicht mit einer Nachzeichnung. Ein Poster, das ein selbst
// gemaltes Nest zeigt, behauptet etwas ueber das Spiel, was das Spiel nicht einloest.
//
// Der Code wird ueber Textanker geschnitten, nicht ueber Zeilennummern: die Spieldatei
// waechst taeglich um hunderte Zeilen. Jeder Anker wird vor Gebrauch geprueft (er muss
// GENAU einmal vorkommen), und der Schnitt wird mit new Function() auf Syntax geprueft,
// bevor er laeuft - sonst zeigt ein stiller Fehlschnitt sich erst als leeres Bild.
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const SPIEL = process.argv[3] || path.join(__dirname, '..', 'weltraum_kolonie.html');
const OUT = process.argv[2] || path.join(__dirname, 'nester');
const GROESSE = 640;                       // im Spiel 168 px; hier gross fuers Poster

function einmal(html, anker) {
  const n = html.split(anker).length - 1;
  if (n !== 1) throw new Error(`Anker ${n === 0 ? 'fehlt' : n + 'x vorhanden'}: ${anker.slice(0, 60)}`);
  return html.indexOf(anker);
}
// Schneidet ab `anfang` bis einschliesslich der ersten Zeile, die genau `schluss` ist.
function bisZeile(html, anfang, schluss) {
  const e = html.indexOf('\n' + schluss + '\n', anfang);
  if (e < 0) throw new Error(`Blockende "${schluss}" nach Position ${anfang} nicht gefunden`);
  return html.slice(anfang, e + schluss.length + 2);
}

function schneide() {
  const html = fs.readFileSync(SPIEL, 'utf8');
  const aVoelker = einmal(html, '  const ALIEN_VOELKER = {');
  const aVolk    = einmal(html, '  function nestVolk(v){');
  const aBrut    = einmal(html, '    /* ================= Alien-Nester als Brutkoerper');
  // Das Blockende wird an der LETZTEN Funktion des Blocks gemessen. Ein einfaches "bis zur
  // naechsten Zeile '    }'" haette am Ende der ersten Hilfsfunktion abgeschnitten - die
  // liegen alle auf derselben Einrueckung (gemessen: nbHex, erste Zeile des Blocks).
  const aUrl     = einmal(html, '    function nestBildUrl(volk, stufe){');
  if (aUrl < aBrut) throw new Error('nestBildUrl liegt vor dem Blockanfang - Datei umgebaut?');
  const teile = [
    bisZeile(html, aVoelker, '  };'),
    html.slice(aVolk, html.indexOf('\n', aVolk) + 1),
    html.slice(aBrut, aUrl) + bisZeile(html, aUrl, '    }')
  ];
  const code = teile.join('\n');
  for (const noetig of ['function nestZeichneBrutkoerper', 'function nbKoerper', 'kryll:', 'verglueht:'])
    if (!code.includes(noetig)) throw new Error('Schnitt unvollstaendig, fehlt: ' + noetig);
  new Function(code);                                        // Syntaxprobe
  return code;
}

(async () => {
  const code = schneide();
  console.log('Zeichencode geschnitten:', (code.length / 1024).toFixed(0), 'kB aus', path.basename(SPIEL));
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 800, height: 800 } });
  await p.setContent('<canvas id="cv"></canvas>');
  for (const volk of ['kryll', 'xantheer', 'vex', 'verglueht']) {
    for (const stufe of [1, 5]) {
      const url = await p.evaluate(([code, volk, stufe, S]) => {
        const cv = document.getElementById('cv'); cv.width = S; cv.height = S;
        const c = cv.getContext('2d'); c.clearRect(0, 0, S, S);
        new Function('c', 'S', 'volk', 'stufe',
          code + '\nnestZeichneBrutkoerper(c,S,volk,stufe);')(c, S, volk, stufe);
        return cv.toDataURL();
      }, [code, volk, stufe, GROESSE]);
      const roh = Buffer.from(url.split(',')[1], 'base64');
      // Ein leeres Canvas ergibt ein winziges PNG - das faellt sonst erst im Poster auf.
      if (roh.length < 20000) throw new Error(`${volk}/${stufe}: Bild ist praktisch leer (${roh.length} B)`);
      fs.writeFileSync(`${OUT}/${volk}_${stufe}.png`, roh);
      console.log('  ', `${volk}_${stufe}.png`, (roh.length / 1024).toFixed(0) + ' kB');
    }
  }
  await b.close();
})().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });
