// Key-Art-Poster im Kepler-7-Stil: Illustration + Wortmarke + Zeile + Domain-Pille,
// 1080x1920, alles als SVG und mit Chromium gerastert.
// Die Wortmarke ist aus Pfaden gebaut, nicht gesetzt: der Container hat keine
// geometrische Techno-Schrift, und ueber alle Poster hinweg muss sie identisch sein.
const fs = require('fs');
const OUT = process.argv[2] || './poster';
fs.mkdirSync(OUT, { recursive: true });

const W = 1080, H = 1920;
// Die Brutkoerper der Alien-Nester sind KEINE Nachzeichnung: nest_render.js laesst den
// Zeichencode aus weltraum_kolonie.html selbst laufen und legt die PNGs in nester/ ab.
// Das Poster zeigt damit genau das Bild, das im Spiel auf der Systemkarte steht.
const SCHIFF_BILDER = process.env.SCHIFF_BILDER || __dirname + '/schiffe';
const schiffBild = datei => {
  const pfad = `${SCHIFF_BILDER}/${datei}`;
  if (!fs.existsSync(pfad))
    throw new Error(`${pfad} fehlt - erst "node schiff_render.js" laufen lassen.`);
  return 'data:image/png;base64,' + fs.readFileSync(pfad).toString('base64');
};
const NEST_BILDER = process.env.NEST_BILDER || __dirname + '/nester';
const nestBild = datei => {
  const pfad = `${NEST_BILDER}/${datei}`;
  if (!fs.existsSync(pfad))
    throw new Error(`${pfad} fehlt - erst "node nest_render.js" laufen lassen.`);
  return 'data:image/png;base64,' + fs.readFileSync(pfad).toString('base64');
};

const rnd = seed => { let s = seed; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; };

// ---------- Wortmarke "KEPLER 7" ----------------------------------------
// Zellhoehe 100, Strichstaerke 12, aus Rechtecken und Polygonen gesetzt.
const GLYPHEN = {
  K: { w: 97, teile: [['r',0,0,12,100], ['p',[[12,46],[66,0],[88,0],[26,52]]], ['p',[[26,48],[88,100],[66,100],[12,54]]]] },
  E: { w: 80, teile: [['r',0,0,12,100], ['r',0,0,78,12], ['r',0,44,62,12], ['r',0,88,78,12]] },
  P: { w: 87, teile: [['r',0,0,12,100], ['r',0,0,74,12], ['r',75,0,12,56], ['r',0,44,87,12]] },
  L: { w: 80, teile: [['r',0,0,12,100], ['r',0,88,78,12]] },
  R: { w: 92, teile: [['r',0,0,12,100], ['r',0,0,74,12], ['r',75,0,12,56], ['r',0,44,87,12], ['p',[[46,56],[64,56],[92,100],[72,100]]]] },
  7: { w: 92, teile: [['r',0,0,92,12], ['r',78,12,12,88]] }
};
function wortmarke(cx, cy, breite, farbe) {
  const folge = ['K','E','P','L','E','R','7'], gap = 46, bigGap = 66;
  let gesamt = 0;
  folge.forEach((g,i) => { gesamt += GLYPHEN[g].w; if (i < folge.length-1) gesamt += (folge[i+1]==='7'?bigGap:gap); });
  const s = breite / gesamt;
  let x = -gesamt/2, teile = '';
  folge.forEach((g,i) => {
    GLYPHEN[g].teile.forEach(t => {
      if (t[0]==='r') teile += `<rect x="${(x+t[1]).toFixed(2)}" y="${t[2]}" width="${t[3]}" height="${t[4]}"/>`;
      else teile += `<polygon points="${t[1].map(p=>`${(x+p[0]).toFixed(2)},${p[1]}`).join(' ')}"/>`;
    });
    x += GLYPHEN[g].w + (i < folge.length-1 ? (folge[i+1]==='7'?bigGap:gap) : 0);
  });
  return `<g transform="translate(${cx} ${cy}) scale(${s})" fill="${farbe}" filter="url(#glowText)">
    <g transform="translate(0 -50)">${teile}</g></g>`;
}

const sterne = (seed, n = 190) => {
  const r = rnd(seed); let s = '';
  for (let i = 0; i < n; i++)
    s += `<circle cx="${(r()*W).toFixed(1)}" cy="${(r()*H*0.92).toFixed(1)}" r="${(r()*1.9+0.5).toFixed(2)}" fill="#fff" opacity="${(r()*0.75+0.2).toFixed(2)}"/>`;
  return s;
};

// ---------- Bausteine fuers Umbau-Motiv ---------------------------------
// Gebaeudepaare: links das flache Piktogramm von frueher, rechts das isometrische
// Bauwerk von heute. Sockelplatte und Schatten sind allen gemeinsam, nur der Aufbau
// wechselt - so bleibt die Bildsprache ueber alle Motive gleich.
const sockel = akzent => `
  <ellipse cx="14" cy="72" rx="118" ry="30" fill="#000" opacity="0.55" filter="url(#blur14)"/>
  <polygon points="0,-96 104,-41 104,41 0,96 -104,41 -104,-41" fill="#1d2531"/>
  <polygon points="0,-96 104,-41 0,14 -104,-41" fill="#2c3646"/>
  <polygon points="104,-41 104,41 0,96 0,14" fill="#161d27"/>
  <polygon points="-104,-41 0,14 0,96 -104,41" fill="#212a37"/>
  <polygon points="0,-96 104,-41 0,14 -104,-41" fill="none" stroke="${akzent}" stroke-width="3" opacity="0.75"/>`;

const leuchte = (x, y, akzent) => `
  <g transform="translate(${x} ${y})">
    <polygon points="0,-24 24,-11 24,9 0,22 -24,9 -24,-11" fill="#3a4658"/>
    <polygon points="0,-24 24,-11 0,2 -24,-11" fill="#54627a"/>
    <circle cx="0" cy="-7" r="8" fill="${akzent}" filter="url(#blur6)"/>
    <circle cx="0" cy="-7" r="3.5" fill="#fff"/>
  </g>`;

const GEBAEUDE = {
  // --- Solarkraftwerk: geneigtes Paneel auf Stuetzen -----------------------
  solar: {
    flach: `<g fill="#6d7686">
      <g transform="skewY(-14)"><rect x="-96" y="-92" width="192" height="104" rx="8"/></g>
      <g stroke="#41485a" stroke-width="4" opacity="0.9"><g transform="skewY(-14)">
        <line x1="-32" y1="-92" x2="-32" y2="12"/><line x1="32" y1="-92" x2="32" y2="12"/>
        <line x1="-96" y1="-40" x2="96" y2="-40"/></g></g>
      <rect x="-11" y="6" width="22" height="52" rx="6"/>
      <rect x="-72" y="52" width="144" height="20" rx="9"/></g>`,
    iso: akzent => `
      <g transform="translate(0 -74)">
        <g stroke="#2a3346" stroke-width="9" stroke-linecap="round">
          <line x1="-56" y1="30" x2="-56" y2="78"/><line x1="56" y1="14" x2="56" y2="62"/>
          <line x1="0" y1="46" x2="0" y2="92"/></g>
        <polygon points="-96,-20 -2,-68 94,-18 0,30" fill="#2f5480"/>
        <polygon points="-96,-20 -2,-68 94,-18 0,30" fill="none" stroke="${akzent}" stroke-width="3"/>
        <g stroke="#9dc4ee" stroke-width="2" opacity="0.55">
          <line x1="-49" y1="-44" x2="47" y2="6"/><line x1="-2" y1="-68" x2="0" y2="30"/>
          <line x1="-72" y1="-32" x2="24" y2="18"/><line x1="-25" y1="-56" x2="71" y2="-6"/></g>
        <polygon points="-96,-20 -2,-68 -49,-44" fill="#bcd9f7" opacity="0.42"/>
      </g>
      ${leuchte(42, 24, akzent)}`
  },

  // --- Erzmine: Foerderturm ueber dem Schacht ------------------------------
  erz: {
    flach: `<g fill="#6d7686">
      <path d="M-58,54 L-30,-72 L30,-72 L58,54 Z"/>
      <rect x="-46" y="-16" width="92" height="12" rx="5" fill="#41485a"/>
      <rect x="-34" y="14" width="68" height="12" rx="5" fill="#41485a"/>
      <rect x="-16" y="-100" width="32" height="30" rx="7"/>
      <rect x="-78" y="54" width="156" height="20" rx="9"/></g>`,
    iso: akzent => `
      <g transform="translate(0 -58)">
        <g stroke="#39435a" stroke-width="10" stroke-linecap="round">
          <line x1="-52" y1="66" x2="-16" y2="-42"/><line x1="52" y1="50" x2="16" y2="-42"/>
          <line x1="-52" y1="66" x2="16" y2="-42"/><line x1="52" y1="50" x2="-16" y2="-42"/></g>
        <g stroke="${akzent}" stroke-width="5" opacity="0.85">
          <line x1="-36" y1="22" x2="36" y2="14"/><line x1="-26" y1="-10" x2="26" y2="-16"/></g>
        <polygon points="0,-74 34,-56 34,-34 0,-16 -34,-34 -34,-56" fill="#3a4658"/>
        <polygon points="0,-74 34,-56 0,-38 -34,-56" fill="#5c6c86"/>
        <circle cx="0" cy="-52" r="13" fill="${akzent}" filter="url(#blur6)"/>
        <circle cx="0" cy="-52" r="5" fill="#fff"/>
      </g>
      <g transform="translate(-46 22)">
        <polygon points="0,-18 22,-7 22,9 0,20 -22,9 -22,-7" fill="#2b3444"/>
        <polygon points="0,-18 22,-7 0,4 -22,-7" fill="#46566e"/></g>`
  },

  // --- Fusionsreaktor: Kuppel mit gluehendem Kern --------------------------
  fusion: {
    flach: `<g fill="#6d7686">
      <path d="M-76,40 a76,76 0 0 1 152,0 Z"/>
      <rect x="-88" y="40" width="176" height="20" rx="9"/>
      <circle cx="0" cy="-4" r="26" fill="#41485a"/>
      <rect x="-8" y="-104" width="16" height="34" rx="7"/></g>`,
    iso: akzent => `
      <g transform="translate(0 -50)">
        <ellipse cx="0" cy="14" rx="86" ry="42" fill="#2b3444"/>
        <path d="M-86,14 a86,58 0 0 1 172,0 Z" fill="#3d4a5f"/>
        <path d="M-86,14 a86,58 0 0 1 172,0 Z" fill="none" stroke="${akzent}" stroke-width="3" opacity="0.9"/>
        <path d="M-52,14 a52,40 0 0 1 104,0 Z" fill="#55647e" opacity="0.55"/>
        <ellipse cx="0" cy="14" rx="86" ry="42" fill="none" stroke="${akzent}" stroke-width="2.5" opacity="0.6"/>
        <circle cx="0" cy="-14" r="26" fill="${akzent}" filter="url(#blur10)"/>
        <circle cx="0" cy="-14" r="11" fill="#fff"/>
        <rect x="-6" y="-92" width="12" height="46" rx="5" fill="#8b9cb6"/>
      </g>
      ${leuchte(-52, 30, akzent)}`
  },

  // --- Raketensilo: drei Schaechte mit offenen Klappen ---------------------
  silo: {
    flach: `<g fill="#6d7686">
      <rect x="-78" y="-58" width="44" height="112" rx="10"/>
      <rect x="-22" y="-86" width="44" height="140" rx="10"/>
      <rect x="34" y="-58" width="44" height="112" rx="10"/>
      <g fill="#41485a"><rect x="-72" y="-40" width="32" height="9" rx="4"/>
        <rect x="-16" y="-68" width="32" height="9" rx="4"/><rect x="40" y="-40" width="32" height="9" rx="4"/></g>
      <rect x="-92" y="54" width="184" height="20" rx="9"/></g>`,
    iso: akzent => `
      <g transform="translate(0 -46)">
        ${[[-52,16],[0,-6],[52,16]].map(([x,y],i) => `
        <g transform="translate(${x} ${y})">
          <polygon points="0,-52 30,-36 30,10 0,26 -30,10 -30,-36" fill="#333e51"/>
          <polygon points="0,-52 30,-36 0,-20 -30,-36" fill="#4d5c74"/>
          <polygon points="30,-36 30,10 0,26 0,-20" fill="#26303f"/>
          <polygon points="0,-52 30,-36 0,-20 -30,-36" fill="none" stroke="${akzent}" stroke-width="2.5" opacity="0.9"/>
          <circle cx="0" cy="-34" r="9" fill="${akzent}" opacity="${0.85 - i*0.18}" filter="url(#blur6)"/>
        </g>`).join('')}
      </g>
      ${leuchte(-2, 42, akzent)}`
  }
,

  /* --- Alien-Nest, Stufe 5 (Königin) -------------------------------------
     Links der Marker, wie er bis zum 06.09.2026 auf der Systemkarte stand: dunkler Kreis,
     sechs Punkte, weisser Kern fuer die Koenigin. Die Geometrie ist die des alten Codes
     (Radius r*(0.55+0.12*Math.sin(g)) mit g in GRAD, Punkte r*0.30) - nicht nachempfunden,
     sondern nachgerechnet, damit das "Vorher" auch wirklich das Vorher ist.
     Rechts der gebackene Brutkoerper aus dem Spiel. Ein Sockel waere hier falsch: das ist
     kein Bauwerk auf einem Planeten, sondern eine Kreatur im All. */
  nest: {
    ohneSockel: true,
    // Beide Seiten auf derselben Hoehe, weil hier keine Sockelplatte die Unterkante setzt.
    // Das Vorher war auf der Karte ein Punkt, das Jetzt eine Kreatur - der Groessensprung
    // ist Teil der Aussage, deshalb steht rechts bewusst groesser als links.
    layout: { linksX: 250, linksY: 706, linksS: 1.18, pfeilX: 528,
              rechtsX: 822, rechtsY: 706, rechtsS: 1.45 },
    flach: `<g>
      <circle cx="0" cy="0" r="100" fill="rgba(10,13,26,0.55)" stroke="#6d7686" stroke-width="4"/>
      ${[0,60,120,180,240,300].map(g => {
        const rad = g * Math.PI/180, rr = 100 * (0.55 + 0.12 * Math.sin(g));
        return `<circle cx="${(rr*Math.cos(rad)).toFixed(1)}" cy="${(rr*Math.sin(rad)).toFixed(1)}" r="30" fill="#6d7686" fill-opacity="0.85"/>`;
      }).join('')}
      <circle cx="0" cy="0" r="34" fill="#8b929e" fill-opacity="0.9"/></g>`,
    iso: (akzent, bild) => `
      <circle cx="0" cy="0" r="135" fill="${akzent}" opacity="0.30" filter="url(#blur24)"/>
      <image href="${nestBild(bild)}" x="-150" y="-150" width="300" height="300"/>`
  }
,

  /* --- Flottenmarker auf der Karte (v8.702.0) -----------------------------
     Links der Zeiger, der bis zum 07.09.2026 fuer jede fliegende Flotte stand. Er ist nicht
     nachempfunden: Polygon und Hof stehen woertlich so im Spiel und sind dort bis heute der
     Rueckfall, wenn kein Rumpfbild zustande kommt (`flottenMarke`).
     Rechts derselbe Marker von heute - Flaggschiff (Kantenlaenge 22) und bis zu drei Begleiter
     (11) auf den Plaetzen, die das Spiel vergibt, mitsamt der Drehung um -90 Grad: Der
     gezeichnete Rumpf zeigt nach rechts, der alte Zeiger nach oben.
     BEIDE SEITEN IM SELBEN MASSSTAB. Der Groessenunterschied ist hier keine Gestaltung,
     sondern die Aussage - im Spiel sind es dieselben Kartenkoordinaten. */
  flotte: {
    ohneSockel: true,
    layout: { linksX: 262, linksY: 690, linksS: 10, pfeilX: 540,
              rechtsX: 812, rechtsY: 690, rechtsS: 10 },
    /* Der Hof ist im Spiel eine 18 px grosse, zu 18 % deckende Scheibe unter einem 12 px hohen
       Zeiger - dort liest er sich als Schein. Zehnfach vergroessert wuerde daraus eine Muenze
       mit harter Kante, deshalb bekommt er hier eine Weichzeichnung. Geometrie und Deckkraft
       bleiben, was das Spiel zeichnet. */
    flach: `<g>
      <circle cx="0" cy="0" r="9" fill="#6d7686" opacity="0.18" filter="url(#blurHof)"/>
      <polygon points="0,-6 4,5 0,2 -4,5" fill="#6d7686"/></g>`,
    iso: (akzent, bild) => {
      const G = 22, k = 11, plaetze = [[-13,-7],[-13,7],[-21,0]];
      const url = schiffBild(bild);
      /* Nach der Drehung liegt das Geleit UNTER dem Flaggschiff (aus (x,y) wird (y,-x)): der
         Verband reicht von -11 bis 26,5. Ohne Ausgleich haengt er nach unten aus der Mitte und
         legt sich auf die Beschriftung - deshalb die Verschiebung um die halbe Hoehe. */
      return `<g transform="translate(0 -7.75)">
        <circle cx="0" cy="0" r="10" fill="${akzent}" opacity="0.16" filter="url(#blurHof)"/>
        <g transform="rotate(-90)">
          ${plaetze.map(([x,y]) => `<image href="${url}" x="${x-k/2}" y="${y-k/2}" width="${k}" height="${k}" opacity="0.85"/>`).join('')}
          <image href="${url}" x="${-G/2}" y="${-G/2}" width="${G}" height="${G}"/>
        </g>
      </g>`;
    }
  }
};

const flachesSymbol = (cx, cy, s, art) => `
  <g transform="translate(${cx} ${cy}) scale(${s})">${GEBAEUDE[art].flach}</g>`;

const isoBauwerk = (cx, cy, s, akzent, art, bild) => `
  <g transform="translate(${cx} ${cy}) scale(${s})">
    ${GEBAEUDE[art].ohneSockel ? '' : sockel(akzent)}
    ${GEBAEUDE[art].iso(akzent, bild)}
  </g>`;

const pfeil = (cx, cy, akzent) => `
  <g transform="translate(${cx} ${cy})">
    <rect x="-46" y="-5" width="70" height="10" rx="5" fill="${akzent}" opacity="0.95"/>
    <polygon points="24,-24 62,0 24,24" fill="${akzent}"/>
    <rect x="-46" y="-5" width="108" height="10" fill="${akzent}" opacity="0.28" filter="url(#blur10)"/>
  </g>`;

// ---------- Poster ------------------------------------------------------
function poster({ akzent, zeile, unter, seed, art, bild }) {
  const L = Object.assign({ linksX: 258, linksY: 726, linksS: 1.45, pfeilX: 540,
                           rechtsX: 816, rechtsY: 692, rechtsS: 1.34 },
                          GEBAEUDE[art].layout || {});
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="blurHof" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="blur6" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="blur10" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="blur14" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="blur24" x="-100%" y="-400%" width="300%" height="900%"><feGaussianBlur stdDeviation="24"/></filter>
    <filter id="glowText" x="-30%" y="-60%" width="160%" height="220%">
      <feGaussianBlur stdDeviation="9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="gBg" cx="50%" cy="32%" r="105%">
      <stop offset="0%" stop-color="${akzent}" stop-opacity="0.16"/>
      <stop offset="38%" stop-color="${akzent}" stop-opacity="0.06"/>
      <stop offset="72%" stop-color="${akzent}" stop-opacity="0.015"/>
      <stop offset="100%" stop-color="${akzent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gUnten" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#04050a" stop-opacity="0"/>
      <stop offset="42%" stop-color="#04050a" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#04050a" stop-opacity="0.97"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="#04050a"/>
  <rect width="${W}" height="${H}" fill="url(#gBg)"/>
  ${sterne(seed)}

  <!-- waagerechter Lichtstreifen wie in den uebrigen Motiven -->
  <rect x="0" y="700" width="${W}" height="4" fill="${akzent}" opacity="0.32" filter="url(#blur24)"/>

  <!-- Vorher / Nachher, gezeichnet statt abfotografiert -->
  ${flachesSymbol(L.linksX, L.linksY, L.linksS, art)}
  ${pfeil(L.pfeilX, 722, akzent)}
  ${isoBauwerk(L.rechtsX, L.rechtsY, L.rechtsS, akzent, art, bild)}

  <text x="${L.linksX}" y="960" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif"
        font-size="30" font-weight="bold" fill="#7f8899" letter-spacing="5">VORHER</text>
  <text x="${L.rechtsX}" y="960" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif"
        font-size="30" font-weight="bold" fill="${akzent}" letter-spacing="5">JETZT</text>

  <rect x="0" y="1020" width="${W}" height="900" fill="url(#gUnten)"/>
  <rect x="${(W-470)/2}" y="1182" width="470" height="3" fill="#ffffff" opacity="0.92"/>
  ${wortmarke(W/2, 1268, 706, '#ffffff')}
  <text x="${W/2}" y="1388" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif"
        font-size="46" font-weight="bold" fill="#ffffff" filter="url(#glowText)">${zeile}</text>
  <text x="${W/2}" y="1434" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif"
        font-size="30" fill="#dfe6f5" opacity="0.95">${unter}</text>
  <g>
    <rect x="${(W-350)/2}" y="1466" width="350" height="62" rx="31" fill="none" stroke="${akzent}" stroke-width="3" opacity="0.95"/>
    <text x="${W/2}" y="1508" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif"
          font-size="35" font-weight="bold" fill="#ffffff">gamegeeeeek.de</text>
  </g>
</svg>`;
}

const POSTER = [
  { name: 'umbau_solar',  art: 'solar',  akzent: '#fac775', seed: 4242,
    zeile: '52 Bauwerke neu gezeichnet', unter: '29 Gebäude · 23 Verteidigungsanlagen' },
  { name: 'umbau_erz',    art: 'erz',    akzent: '#e0b184', seed: 1717,
    zeile: '52 Bauwerke neu gezeichnet', unter: '29 Gebäude · 23 Verteidigungsanlagen' },
  { name: 'umbau_fusion', art: 'fusion', akzent: '#8ee6c0', seed: 2828,
    zeile: '52 Bauwerke neu gezeichnet', unter: '29 Gebäude · 23 Verteidigungsanlagen' },
  { name: 'umbau_silo',   art: 'silo',   akzent: '#ff9a8a', seed: 3939,
    zeile: '52 Bauwerke neu gezeichnet', unter: '29 Gebäude · 23 Verteidigungsanlagen' }
,
  // Akzent = v.farbe aus ALIEN_VOELKER (weltraum_kolonie.html), damit Poster und Karte
  // dieselbe Volksfarbe zeigen.
  { name: 'nest_kryll',     art: 'nest', akzent: '#8fd694', seed: 5151, bild: 'kryll_5.png',
    zeile: 'Aus sechs Punkten wurde eine Königin', unter: '4 Alien-Völker · 5 Stufen · 20 Brutkörper' },
  { name: 'nest_verglueht', art: 'nest', akzent: '#e0765a', seed: 6262, bild: 'verglueht_5.png',
    zeile: 'Aus sechs Punkten wurde eine Königin', unter: '4 Alien-Völker · 5 Stufen · 20 Brutkörper' },
  { name: 'nest_xantheer',  art: 'nest', akzent: '#7ea8e8', seed: 7373, bild: 'xantheer_5.png',
    zeile: 'Aus sechs Punkten wurde eine Königin', unter: '4 Alien-Völker · 5 Stufen · 20 Brutkörper' },
  { name: 'nest_vex',       art: 'nest', akzent: '#e0c168', seed: 8484, bild: 'vex_5.png',
    zeile: 'Aus sechs Punkten wurde eine Königin', unter: '4 Alien-Völker · 5 Stufen · 20 Brutkörper' },
  // Akzent = MISSION_LINIEN.attack.hin, die Farbe, in der eine Angriffsbahn auf der Karte liegt.
  { name: 'flotte_karte', art: 'flotte', akzent: '#e24b4a', seed: 9595,
    bild: 'kausalitaetsbrecher.png',
    zeile: 'Aus dem Pfeil wurde eine Flotte', unter: 'Dein stärkstes Schiff führt · bis zu 3 Begleiter' }
];
POSTER.forEach(p => fs.writeFileSync(`${OUT}/${p.name}.svg`, poster(p)));
console.log('SVGs geschrieben:', POSTER.length);
