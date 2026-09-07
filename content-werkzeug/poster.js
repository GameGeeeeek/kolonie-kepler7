// Key-Art-Poster im Kepler-7-Stil: Illustration + Wortmarke + Zeile + Domain-Pille,
// 1080x1920, alles als SVG und mit Chromium gerastert.
// Die Wortmarke ist aus Pfaden gebaut, nicht gesetzt: der Container hat keine
// geometrische Techno-Schrift, und ueber alle Poster hinweg muss sie identisch sein.
const fs = require('fs');
const OUT = process.argv[2] || './poster';
fs.mkdirSync(OUT, { recursive: true });

const W = 1080, H = 1920;
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
// Flaches Piktogramm: so sahen die Anlagen vorher aus - eine Silhouette ohne Tiefe.
// Motiv Solarkraftwerk, weil es das erste Gebaeude jeder Kolonie ist.
const flachesSymbol = (cx, cy, s) => `
  <g transform="translate(${cx} ${cy}) scale(${s})" fill="#6d7686">
    <g transform="skewY(-14)">
      <rect x="-96" y="-92" width="192" height="104" rx="8"/>
    </g>
    <g stroke="#41485a" stroke-width="4" opacity="0.9">
      <g transform="skewY(-14)">
        <line x1="-32" y1="-92" x2="-32" y2="12"/>
        <line x1="32" y1="-92" x2="32" y2="12"/>
        <line x1="-96" y1="-40" x2="96" y2="-40"/>
      </g>
    </g>
    <rect x="-11" y="6" width="22" height="52" rx="6"/>
    <rect x="-72" y="52" width="144" height="20" rx="9"/>
  </g>`;

// Isometrisches Bauwerk auf Sockelplatte - so sehen sie jetzt aus: Tiefe, Licht,
// Schlagschatten, ein warmer Akzent. Dasselbe Solarkraftwerk wie links.
const isoBauwerk = (cx, cy, s, akzent) => `
  <g transform="translate(${cx} ${cy}) scale(${s})">
    <ellipse cx="14" cy="72" rx="122" ry="31" fill="#000" opacity="0.55" filter="url(#blur14)"/>
    <polygon points="0,-96 104,-41 104,41 0,96 -104,41 -104,-41" fill="#1d2531"/>
    <polygon points="0,-96 104,-41 0,14 -104,-41" fill="#2c3646"/>
    <polygon points="104,-41 104,41 0,96 0,14" fill="#161d27"/>
    <polygon points="-104,-41 0,14 0,96 -104,41" fill="#212a37"/>
    <polygon points="0,-96 104,-41 0,14 -104,-41" fill="none" stroke="${akzent}" stroke-width="3" opacity="0.75"/>

    <!-- Paneel deutlich ueber der Platte auf sichtbaren Stuetzen: liegt es direkt
         auf, verschmilzt es mit der Sockelflaeche und man sieht kein Kraftwerk. -->
    <g transform="translate(0 -74)">
      <g stroke="#2a3346" stroke-width="9" stroke-linecap="round">
        <line x1="-56" y1="30" x2="-56" y2="78"/>
        <line x1="56" y1="14" x2="56" y2="62"/>
        <line x1="0" y1="46" x2="0" y2="92"/>
      </g>
      <polygon points="-96,-20 -2,-68 94,-18 0,30" fill="#2f5480"/>
      <polygon points="-96,-20 -2,-68 94,-18 0,30" fill="none" stroke="${akzent}" stroke-width="3" opacity="1"/>
      <g stroke="#9dc4ee" stroke-width="2" opacity="0.55">
        <line x1="-49" y1="-44" x2="47" y2="6"/>
        <line x1="-2" y1="-68" x2="0" y2="30"/>
        <line x1="-72" y1="-32" x2="24" y2="18"/>
        <line x1="-25" y1="-56" x2="71" y2="-6"/>
      </g>
      <polygon points="-96,-20 -2,-68 -49,-44" fill="#bcd9f7" opacity="0.42"/>
      <polygon points="-96,-20 -2,-68 94,-18 0,30" fill="none" stroke="#0b1018" stroke-width="1" opacity="0.45"/>
    </g>

    <!-- Verteilerkasten, nach innen gerueckt -->
    <g transform="translate(42 24)">
      <polygon points="0,-24 24,-11 24,9 0,22 -24,9 -24,-11" fill="#3a4658"/>
      <polygon points="0,-24 24,-11 0,2 -24,-11" fill="#54627a"/>
      <circle cx="0" cy="-7" r="8" fill="${akzent}" filter="url(#blur6)"/>
      <circle cx="0" cy="-7" r="3.5" fill="#fff"/>
    </g>
  </g>`;

const pfeil = (cx, cy, akzent) => `
  <g transform="translate(${cx} ${cy})">
    <rect x="-46" y="-5" width="70" height="10" rx="5" fill="${akzent}" opacity="0.95"/>
    <polygon points="24,-24 62,0 24,24" fill="${akzent}"/>
    <rect x="-46" y="-5" width="108" height="10" fill="${akzent}" opacity="0.28" filter="url(#blur10)"/>
  </g>`;

// ---------- Poster ------------------------------------------------------
function poster({ akzent, zeile, unter, seed }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
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
  ${flachesSymbol(258, 726, 1.45)}
  ${pfeil(540, 722, akzent)}
  ${isoBauwerk(816, 692, 1.34, akzent)}

  <text x="258" y="960" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif"
        font-size="30" font-weight="bold" fill="#7f8899" letter-spacing="5">VORHER</text>
  <text x="816" y="960" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif"
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
  { name: 'umbau', akzent: '#fac775', seed: 4242,
    zeile: '52 Bauwerke neu gezeichnet', unter: '29 Gebäude · 23 Verteidigungsanlagen' }
];
POSTER.forEach(p => fs.writeFileSync(`${OUT}/${p.name}.svg`, poster(p)));
console.log('SVGs geschrieben:', POSTER.length);
