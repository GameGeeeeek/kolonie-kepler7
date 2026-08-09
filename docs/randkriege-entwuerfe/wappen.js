// Die elf neuen Symbole der Familie facw_* (Entwurf 5.3) – handgezeichnetes SVG,
// kein neues ti-*-Icon (der Font ist ein Subset).
//
// Alle im 100×100-Raum wie ICONS/SHIP_HULL_DEFS, damit sie sich an derselben Stelle
// einhängen lassen. Verlaufs-IDs bekommen ein Präfix, weil sie auf der Karte mehrfach
// im selben Dokument stehen.

const DEFS = `
<defs>
  <linearGradient id="wGold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#f7dda0"/><stop offset="55%" stop-color="#e0a548"/><stop offset="100%" stop-color="#8d6520"/>
  </linearGradient>
  <linearGradient id="wAsche" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#6a6f80"/><stop offset="100%" stop-color="#3a3e4d"/>
  </linearGradient>
  <linearGradient id="wViolett" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#dcd6ff"/><stop offset="60%" stop-color="#9d8fe0"/><stop offset="100%" stop-color="#4a3f7d"/>
  </linearGradient>
  <linearGradient id="wRot" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#e8908f"/><stop offset="55%" stop-color="#c0504f"/><stop offset="100%" stop-color="#6d2524"/>
  </linearGradient>
  <linearGradient id="wCyan" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#a9ede0"/><stop offset="55%" stop-color="#6fd0c0"/><stop offset="100%" stop-color="#256b60"/>
  </linearGradient>
  <linearGradient id="wStahl" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#e6eaf6"/><stop offset="60%" stop-color="#9aa2bd"/><stop offset="100%" stop-color="#4a5169"/>
  </linearGradient>
  <filter id="wSchein" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>`;

// --- Die vier Fraktionswappen ----------------------------------------------------------------
// Achteck-Siegel mit GEBROCHENEM Rand: die Bruchstelle sitzt oben rechts, ein Stück Rand fehlt
// ganz. Aschgrau auf Gold, wie im Entwurf – der Aschekern liegt AUF der Goldscheibe.
const facw_kartell = `
<g filter="url(#wSchein)">
  <path d="M32 8 H68 L92 32 V68 L68 92 H32 L8 68 V32 Z" fill="url(#wGold)"/>
</g>
<path d="M32 8 H68 L92 32 V68 L68 92 H32 L8 68 V32 Z" fill="none" stroke="#f7dda0" stroke-width="2.5" stroke-opacity="0.8"
      stroke-dasharray="36 14 96 200" stroke-dashoffset="-30"/>
<path d="M38 20 H62 L80 38 V62 L62 80 H38 L20 62 V38 Z" fill="url(#wAsche)"/>
<path d="M50 30 L58 46 L50 70 L42 46 Z" fill="#f7dda0" opacity="0.92"/>
<path d="M50 46 L64 54 M50 46 L36 54" stroke="#f7dda0" stroke-width="3" stroke-linecap="round" opacity="0.55"/>
<path d="M70 12 L86 24 L78 30 Z" fill="#0d1224" opacity="0.9"/>
<circle cx="50" cy="46" r="4.4" fill="#0d1224" opacity="0.75"/>`;

// Zerrissener Schild, Riss von oben rechts nach unten links – die beiden Hälften stehen
// wirklich auseinander, dazwischen die Leere.
// Die erste Fassung schob die Hälften nur 3,5 Einheiten auseinander – gerendert las sich das
// als Schild MIT EINEM SPRUNG, also genau das, was die Beschreibung ausschließt. Jetzt gehen
// beide Hälften weit auseinander und dazwischen steht wirklich nichts.
const facw_void = `
<g filter="url(#wSchein)">
  <path d="M50 6 L86 18 V50 Q86 78 50 94 Q14 78 14 50 V18 Z" fill="url(#wViolett)" opacity="0.16"/>
</g>
<g transform="translate(7 2) rotate(5 62 50)">
  <path d="M50 6 L86 18 V50 Q86 78 50 94 L60 58 L46 42 L64 34 L42 22 Z" fill="url(#wViolett)"/>
  <path d="M42 22 L64 34 L46 42 L60 58 L50 94" fill="none" stroke="#efe9ff" stroke-width="1.6" opacity="0.45"/>
</g>
<g transform="translate(-7 -2) rotate(-5 38 50)">
  <path d="M50 6 L14 18 V50 Q14 78 50 94 L40 58 L54 42 L36 34 L58 22 Z" fill="url(#wViolett)" opacity="0.8"/>
  <path d="M58 22 L36 34 L54 42 L40 58 L50 94" fill="none" stroke="#efe9ff" stroke-width="1.6" opacity="0.35"/>
</g>
<circle cx="50" cy="50" r="2.6" fill="#efe9ff" opacity="0.85"/>`;

// Kohortenstandard mit FLACHEM SOCKEL statt Speerspitze – die Kollision mit doc_offensive
// (Speerspitze) war der ausdrückliche Grund dafür.
const facw_legion = `
<g filter="url(#wSchein)">
  <rect x="45" y="14" width="10" height="62" rx="2" fill="url(#wStahl)"/>
</g>
<rect x="24" y="84" width="52" height="9" rx="2.5" fill="url(#wStahl)"/>
<rect x="32" y="76" width="36" height="9" rx="2" fill="url(#wStahl)" opacity="0.85"/>
<path d="M24 22 H76 V52 L68 52 L62 64 L50 52 L38 64 L32 52 L24 52 Z" fill="url(#wRot)"/>
<path d="M31 30 H69" stroke="#0d1224" stroke-width="2" opacity="0.4"/>
<path d="M50 34 L57 46 H43 Z" fill="#f0d0cf" opacity="0.92"/>
<rect x="18" y="16" width="64" height="7" rx="2.5" fill="url(#wStahl)"/>
<circle cx="50" cy="10" r="5" fill="url(#wRot)" stroke="#e6eaf6" stroke-width="1.6"/>`;

// Raute mit Schleierbändern, halb verdeckt – die rechte Hälfte verschwindet unter dem Schleier.
const facw_schatten = `
<g filter="url(#wSchein)">
  <path d="M50 8 L88 50 L50 92 L12 50 Z" fill="url(#wCyan)"/>
</g>
<path d="M50 8 L88 50 L50 92 Z" fill="#0d1224" opacity="0.62"/>
<path d="M50 22 L74 50 L50 78 L26 50 Z" fill="none" stroke="#0d1224" stroke-width="2.6" opacity="0.55"/>
<path d="M20 34 Q50 46 82 32" fill="none" stroke="#a9ede0" stroke-width="3.4" stroke-linecap="round" opacity="0.75"/>
<path d="M16 52 Q50 66 86 50" fill="none" stroke="#a9ede0" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
<path d="M24 68 Q50 80 78 66" fill="none" stroke="#a9ede0" stroke-width="2.4" stroke-linecap="round" opacity="0.32"/>
<circle cx="50" cy="50" r="5" fill="#0d1224" opacity="0.8"/>`;

// --- Die sechs Dienstgrade --------------------------------------------------------------------
// Eine LEITER, keine sechs beliebigen Zeichen: derselbe Träger, wachsende Auszeichnung.
// 25 / 75 / 175 / 350 / 650 / 1100 Dienstpunkte.
function dienstgrad(stufe){
  const balken = [];
  for (let i = 0; i < Math.min(3, stufe); i++){
    balken.push(`<rect x="30" y="${62 + i*10}" width="40" height="6" rx="2" fill="url(#wStahl)"/>`);
  }
  const stern = stufe >= 4
    ? `<path d="M50 18 L57 36 L76 38 L61 50 L66 68 L50 58 L34 68 L39 50 L24 38 L43 36 Z" fill="url(#wGold)"/>`
    : `<path d="M50 24 L56 40 L72 42 L60 52 L64 68 L50 60 L36 68 L40 52 L28 42 L44 40 Z" fill="url(#wStahl)" opacity="0.9"/>`;
  const kranz = stufe >= 5
    ? `<path d="M22 46 Q14 66 30 80" fill="none" stroke="url(#wGold)" stroke-width="4" stroke-linecap="round"/>
       <path d="M78 46 Q86 66 70 80" fill="none" stroke="url(#wGold)" stroke-width="4" stroke-linecap="round"/>` : '';
  const krone = stufe >= 6
    ? `<path d="M32 16 L40 6 L50 14 L60 6 L68 16 Z" fill="url(#wGold)"/>
       <circle cx="50" cy="14" r="3" fill="#fff3d0"/>` : '';
  return `<g filter="url(#wSchein)">${stern}</g>${balken.join('')}${kranz}${krone}`;
}

// --- Die Frontmarke ---------------------------------------------------------------------------
// Die neue, fraktionsNEUTRALE Währung – deshalb bewusst KEINE der vier Fraktionsfarben,
// sondern Stahl mit einem Kern in --c-info.
const facw_frontmarke = `
<g filter="url(#wSchein)">
  <path d="M50 8 L84 26 V62 L50 92 L16 62 V26 Z" fill="url(#wStahl)"/>
</g>
<path d="M50 18 L75 31 V59 L50 80 L25 59 V31 Z" fill="#0d1224" opacity="0.78"/>
<path d="M50 30 L64 40 V56 L50 68 L36 56 V40 Z" fill="#378add"/>
<path d="M28 34 L50 48 L72 34" fill="none" stroke="#e6eaf6" stroke-width="2.6" stroke-linecap="round" opacity="0.7"/>
<path d="M50 48 V78" stroke="#e6eaf6" stroke-width="2.2" opacity="0.45"/>`;

const WAPPEN = { facw_kartell, facw_void, facw_legion, facw_schatten, facw_frontmarke };
const DIENSTGRAD_NAMEN = [
  { n:'Hilfskraft',    p:25 },   { n:'Kundschafter', p:75 },
  { n:'Frontmeister',  p:175 },  { n:'Bannerträger', p:350 },
  { n:'Kohortenwart',  p:650 },  { n:'Randmarschall',p:1100 }
];

function symbol(key, groesse, extra){
  return `<svg viewBox="0 0 100 100" width="${groesse}" height="${groesse}" ${extra||''}>${DEFS}${WAPPEN[key]}</svg>`;
}
function dienstgradSvg(stufe, groesse){
  return `<svg viewBox="0 0 100 100" width="${groesse}" height="${groesse}">${DEFS}${dienstgrad(stufe)}</svg>`;
}
// Für Dokumente mit vielen Symbolen: DEFS EINMAL oben, danach nur noch die Zeichnungen.
function symbolOhneDefs(key, groesse){
  return `<svg viewBox="0 0 100 100" width="${groesse}" height="${groesse}">${WAPPEN[key]}</svg>`;
}
function dienstgradOhneDefs(stufe, groesse){
  return `<svg viewBox="0 0 100 100" width="${groesse}" height="${groesse}">${dienstgrad(stufe)}</svg>`;
}

module.exports = { DEFS, WAPPEN, dienstgrad, dienstgradSvg, symbol, symbolOhneDefs, dienstgradOhneDefs, DIENSTGRAD_NAMEN };
