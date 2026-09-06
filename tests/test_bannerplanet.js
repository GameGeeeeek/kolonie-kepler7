// Der Planet im Allianz-Banner (Bündel F, 06.09.2026, Grafik-Aufnahme).
//
//   node tests/test_bannerplanet.js
//
// GEMESSEN AM ALTEN STAND: bannerPlanet zeichnete eine gefüllte Scheibe und legte eine weiße
// Linse mit fester Deckkraft darüber, nach oben links versetzt. Das ist kein Licht: Die Linse hat
// überall dieselbe Helligkeit und endet an einer harten Kante mitten im Körper. Auf den drei
// großen Bannern (gruen r=34, blau r=32, stahl/tuerkis r=30) war die Kante zu sehen, und der
// Planet las sich als Aufkleber. Der Ring lag zusätzlich KOMPLETT vor dem Körper - ein aufgemalter
// Reifen statt einer Umlaufbahn.
//
// DIE REGELN, DIE HIER GEHALTEN WERDEN:
//   A) Der Körper ist beleuchtet, nicht bemalt: Entlang der Lichtachse (oben links nach unten
//      rechts) fällt die Helligkeit über die GANZE Scheibe ab. Eine Scheibe mit Linse ist flach
//      und fällt an genau einer Stelle - 1a misst den Gesamtabfall, 1b misst, dass er verteilt
//      ist. Eine Prüfung "keine harte Kante" allein wäre wertlos: Eine flache Scheibe hat gar
//      keine Kante und wäre aus dem falschen Grund grün (gemessen: alter größter Sprung 11, neuer
//      21 - die absolute Sprunghöhe trennt die beiden Zustände NICHT).
//   B) Der Ring läuft HINTER dem Körper vorbei und vor ihm wieder hervor. Gemessen wird exakt:
//      dasselbe Bild mit und ohne Ring darf sich INNERHALB der Scheibe nur unterhalb der
//      Bildmitte unterscheiden. Lag der Ring vorn, unterscheidet es sich auch oberhalb.
//   C) Zwei Planeten im selben Banner überschreiben sich die Verlaufs-Kennungen nicht, und die
//      Kennung "g" der Banner-Hintergründe bleibt frei.
//   D) Das Bild ist deterministisch (kein Zufall, keine Uhr) und alle 13 Banner sind unverändert.
//
// Gegenprobe: siehe Fuß der Datei.
const ABFALL_MIN = 60, FALLEND_MIN = 15, KANTE_MAX = 0.40;
const fs = require('fs');
const { starteBrowser, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = S.match(/<script>([\s\S]*)<\/script>/)[1];

/* ---- 0) Quelltext ---------------------------------------------------------------------------- */
check('0a: die aufgemalte Linse ist weg',
  !/s \+= `<circle cx="\$\{\(cx-r\*0\.28\)\.toFixed\(1\)\}"/.test(JS));
check('0b: der Körper kommt aus einem radialen Verlauf, nicht aus einer Füllfarbe',
  /<radialGradient id="\$\{id\}" cx="33%" cy="28%"/.test(JS)
  && /<circle cx="\$\{cx\}" cy="\$\{cy\}" r="\$\{r\}" fill="url\(#\$\{id\}\)"\/>/.test(JS));
/* Die 13 Banner sind Kosmetik, die Spieler bereits gekauft/freigeschaltet haben - die Etappe
   ändert die ZEICHNUNG, nicht die Auswahl. Gezählt wird deshalb, dass die Tabelle unverändert
   dieselben Aufrufe trägt: acht Planeten in sechs Bannern, zwei Banner tragen also zwei. */
check('0c: die Banner-Tabelle ist unangetastet - dieselben acht Planeten',
  (JS.match(/bannerPlanet\(\d/g) || []).length === 8, (JS.match(/bannerPlanet\(\d/g) || []).length);

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 600, height: 400 } });
  const page = await ctx.newPage();
  await page.goto('about:blank');

  /* Die Zeichner werden aus der Spieldatei geschnitten und isoliert ausgeführt - geprüft werden
     Regeln über das Bild, nicht ein Bild gegen eine Momentaufnahme. */
  /* Der Anker beginnt bei bannerRand, NICHT bei den neuen Farbhelfern: So findet die Gegenprobe
     am alten Stand denselben Block und die Bildprüfungen 1a bis 1e laufen dort WIRKLICH, statt
     sich still zu überspringen. Ein Wächter, der am alten Stand nur "Anker fehlt" meldet, belegt
     über die Zeichnung nichts. */
  const von = JS.indexOf('  function bannerRand(seed){');
  const endAnker = '\n  function bannerNebula(';
  const bis = von < 0 ? -1 : JS.indexOf(endAnker, von);
  check('1-anker: der Zeichner ist im Quelltext auffindbar', von > 0 && bis > von, { von, bis });

  let m = null;
  if (von > 0 && bis > von) {
    const code = JS.slice(von, bis);
    m = await page.evaluate(async ({ code }) => {
      const api = new Function(code + '\nreturn { bannerPlanet };')();
      const S = 200, CX = 100, CY = 100, R = 60;
      const laden = url => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
      const male = async (inner) => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + S + '" height="' + S + '" viewBox="0 0 ' + S + ' ' + S + '">'
          + '<rect width="' + S + '" height="' + S + '" fill="#20242e"/>' + inner + '</svg>';
        const im = await laden('data:image/svg+xml,' + encodeURIComponent(svg));
        const cv = document.createElement('canvas'); cv.width = cv.height = S;
        const c = cv.getContext('2d');
        if (im) c.drawImage(im, 0, 0);
        return { d: c.getImageData(0, 0, S, S).data, ok: !!im };
      };
      const hell = (d, x, y) => { const i = ((y|0)*S + (x|0))*4; return 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]; };
      const block = (d, x, y) => { let s = 0; for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) s += hell(d, x+dx, y+dy); return s/9; };

      const ohneRing = await male(api.bannerPlanet(CX, CY, R, '#5aa8e8', null, null));
      const mitRing  = await male(api.bannerPlanet(CX, CY, R, '#5aa8e8', null, '#bfe1ff'));

      /* A) Profil entlang der Lichtachse (oben links -> unten rechts), nur tief im Körper:
         der Saum und die Kante bleiben draußen (0,82 R). */
      const k = Math.SQRT1_2, N = 33, profil = [];
      for (let i = 0; i < N; i++){
        const t = (-0.82 + (1.64*i)/(N-1)) * R;
        profil.push(block(ohneRing.d, CX + t*k, CY + t*k));
      }
      let maxSprung = 0, fallend = 0;
      for (let i = 1; i < N; i++){
        const dlt = profil[i-1] - profil[i];
        if (dlt > 0.5) fallend++;
        if (Math.abs(dlt) > maxSprung) maxSprung = Math.abs(dlt);
      }
      const abfall = profil[0] - profil[N-1];

      /* B) Ring hinter dem Körper: mit und ohne Ring darf sich INNERHALB der Scheibe nur unter
         der Mitte etwas ändern. 0,88 R haelt den weichen Rand der Scheibe heraus. */
      let obenAnders = 0, untenAnders = 0;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++){
        const dx = x - CX, dy = y - CY;
        if (dx*dx + dy*dy > (R*0.88)*(R*0.88)) continue;
        const i = (y*S+x)*4;
        let ungleich = false;
        for (let q = 0; q < 3; q++) if (Math.abs(ohneRing.d[i+q] - mitRing.d[i+q]) > 8) ungleich = true;
        if (!ungleich) continue;
        if (dy < -2) obenAnders++; else if (dy > 2) untenAnders++;
      }

      // C) Zwei Planeten in einem Banner: verschiedene Kennungen, und "g" bleibt frei.
      const a = api.bannerPlanet(300, 60, 30, '#b8c4d4', '#dfe8f2', '#eaf2fb');
      const b = api.bannerPlanet(110, 40, 8, '#c7cbe0', null, null);
      const ids = (s) => [...s.matchAll(/id="([^"]+)"/g)].map(x => x[1]);
      const idsA = ids(a), idsB = ids(b);
      const doppelt = idsA.filter(x => idsB.includes(x));

      // D) Determinismus.
      const gleich = api.bannerPlanet(150, 72, 34, '#3f9e7c', '#8fe9c9', null) === api.bannerPlanet(150, 72, 34, '#3f9e7c', '#8fe9c9', null);

      return { geladen: ohneRing.ok && mitRing.ok, profil: profil.map(v => Math.round(v)),
               maxSprung: Math.round(maxSprung), fallend, N, abfall: Math.round(abfall),
               obenAnders, untenAnders, idsA, idsB, doppelt, gleich };
    }, { code });
  }

  if (m) {
    check('1-vorab: beide Bilder sind gerendert', m.geladen === true, m.geladen);
    console.log('       (Profil entlang der Lichtachse: ' + m.profil.join(' ') + ')');
    console.log('       (Abfall ' + m.abfall + ', groesster Sprung ' + m.maxSprung + ', fallende Schritte '
      + m.fallend + '/' + (m.N-1) + '; Ring innerhalb der Scheibe: oben ' + m.obenAnders + ', unten ' + m.untenAnders + ')');
    /* SCHWELLEN ERST GEMESSEN, DANN GESETZT (GEMESSEN 06.09.2026, r=60, Füllfarbe #5aa8e8):
       alter Stand: Abfall 12, 2 von 32 Schritten fallend, 92 % des Abfalls in EINEM Schritt.
       neuer Stand: Abfall 132, 27 von 32 Schritten fallend, 16 % des Abfalls im größten Schritt.
       Die Schwellen liegen jeweils zwischen den beiden gemessenen Werten. */
    check('1a: der Körper ist beleuchtet - die Helligkeit fällt über die ganze Lichtachse ab',
      m.abfall >= ABFALL_MIN && m.fallend >= FALLEND_MIN,
      { abfall: m.abfall, fallendeSchritte: m.fallend + '/' + (m.N-1), schwellen: [ABFALL_MIN, FALLEND_MIN] });
    /* Nicht "gibt es eine Kante", sondern "steckt der ganze Abfall in EINER Kante". Genau das
       unterscheidet einen Verlauf von einer aufgeklebten Linse. */
    const kantenAnteil = m.abfall > 0 ? m.maxSprung / m.abfall : 1;
    check('1b: und der Abfall ist VERTEILT, nicht eine Kante mitten im Körper',
      kantenAnteil <= KANTE_MAX,
      { anteilGroesterSchritt: Math.round(kantenAnteil*100) + '%', groesterSprung: m.maxSprung, abfall: m.abfall, schwelle: Math.round(KANTE_MAX*100) + '%' });
    check('1c: der Ring läuft hinter dem Körper vorbei (oben verdeckt) und vor ihm hervor (unten sichtbar)',
      m.obenAnders === 0 && m.untenAnders > 50, { oben: m.obenAnders, unten: m.untenAnders });
    check('1d: zwei Planeten im selben Banner teilen sich keine Verlaufs-Kennung',
      m.doppelt.length === 0 && m.idsA.length >= 2 && !m.idsA.includes('g') && !m.idsB.includes('g'),
      { doppelt: m.doppelt, a: m.idsA, b: m.idsB });
    check('1e: zwei Aufrufe liefern dasselbe Bild', m.gleich === true, m.gleich);
  }

  await ctx.close();
  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });
//
// GEGENPROBE GEMESSEN 06.09.2026 (KEPLER_SPIELDATEI = der Stand vor Bündel F):
//   grün: node tests/test_bannerplanet.js                                    (10 von 10)
//   rot:  git show HEAD:weltraum_kolonie.html > /tmp/alt.html
//         KEPLER_SPIELDATEI=/tmp/alt.html node tests/test_bannerplanet.js
// Dort fallen GEMESSEN sechs: 0a 0b 1a 1b 1c 1d. Prüfnamen beider Läufe per diff verglichen und
// identisch (10 zu 10) - es ging keine Prüfung verloren und keine übersprang sich still.
// Die Zahlen des alten Standes sind der eigentliche Befund:
//   Profil entlang der Lichtachse: 28-mal exakt 164, dann ein Schritt auf 152, dann flach.
//   Also 92 % des gesamten Abfalls in EINEM Schritt - das ist die Kante der aufgeklebten Linse,
//   nicht der Terminator einer Kugel. Und der Ring war innerhalb der Scheibe oben wie unten zu
//   sehen (305 zu 316 Bildpunkte), lag also komplett vor dem Körper.
// 1e bleibt am alten Stand grün: Deterministisch war die alte Zeichnung auch. Die Prüfung sichert
// eine Eigenschaft, die NICHT verloren gehen darf, und ist bewusst keine Gegenprobe-Kandidatin.
