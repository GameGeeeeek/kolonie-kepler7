// Zieht die ECHTEN Kartenpositionen aus der Spieldatei, statt sie nachzubauen.
// Der Entwurf verlangt ausdrücklich Bildschirmabstände aus galaxySlotPositions() –
// also wird genau dieser Quelltext ausgeführt, nicht eine Kopie davon.
const fs = require('fs');
const path = require('path');
const SPIEL = path.join(__dirname, '..', '..', 'weltraum_kolonie.html');
const zeilen = fs.readFileSync(SPIEL, 'utf8').split('\n');

// 1-basierte Zeilennummern wie bei grep; slice ist 0-basiert und exklusiv.
function schnitt(von, bis){ return zeilen.slice(von-1, bis).join('\n'); }

function suche(muster, ab){
  for (let i = (ab||1); i <= zeilen.length; i++) if (muster.test(zeilen[i-1])) return i;
  throw new Error('Anker nicht gefunden: ' + muster);
}
function endeVon(start, muster){
  for (let i = start; i <= zeilen.length; i++) if (muster.test(zeilen[i-1])) return i;
  throw new Error('Ende nicht gefunden ab ' + start);
}

const sysStart = suche(/^  const STAR_SYSTEMS = \[/);
const sysEnde  = endeVon(sysStart, /^  \];/);
const hashStart = suche(/^  function hashStringToFloat\(/);
const sunEnde   = endeVon(hashStart, /^  }/);          // Ende hashStringToFloat
const sunTypStart = suche(/^  const SUN_TYPES = \[/);
const sunTypEnde  = endeVon(sunTypStart, /^  \];/);
const sunForStart = suche(/^  function sunTypeFor\(/);
const sunForEnde  = endeVon(sunForStart, /^  }/);
const slotsStart  = suche(/^  const GALAXY_SPIRAL_SLOTS = /);
const relaxStart  = suche(/^  function galaxyRelax\(/);
const relaxEnde   = endeVon(relaxStart, /^  }/);
const fillStart   = suche(/^  function galaxyFillRatio\(/);
const fillEnde    = endeVon(fillStart, /^  }/);
const nodeStart   = suche(/^  function galaxyNodeScale\(/);
const nodeEnde    = endeVon(nodeStart, /^  }/);
// galaxySlotPositions steht zwischen slotsStart und relaxStart – der ganze Block wandert mit,
// inklusive galaxySpiralLayout und der Kommentare. Das ist gewollt: kein Nachbauen.
// Deckel und Schubzahl aus der Spieldatei lesen statt sie hier festzuschreiben: 208 stand hier hart,
// seit dem Startschub (02.09.2026) gilt 178, und das Spiralfeld rechnet 69 + 30 + 178 = 277 Plätze.
const ganz = zeilen.join('\n');
const deckel = (ganz.match(/const WEEKLY_SYSTEM_MAX = (\d+);/) || [])[1] || '208';
const schubStart = ganz.indexOf('  const SCHUB_SYSTEMS = [');
const schubZahl = schubStart < 0 ? 0 : (ganz.slice(schubStart, ganz.indexOf('\n  ];', schubStart)).match(/\bid:'syss_/g) || []).length;
const quelle = [
  'const WEEKLY_SYSTEM_MAX = ' + deckel + ';',
  'const SCHUB_SYSTEM_COUNT = ' + schubZahl + ';',
  schnitt(sysStart, sysEnde),
  'const BASE_STAR_SYSTEM_COUNT = STAR_SYSTEMS.length;',
  schnitt(hashStart, sunEnde),
  schnitt(sunTypStart, sunTypEnde),
  schnitt(sunForStart, sunForEnde),
  schnitt(slotsStart, relaxStart - 1),
  schnitt(relaxStart, relaxEnde),
  schnitt(nodeStart, nodeEnde),
  schnitt(fillStart, fillEnde),
  'module.exports = { STAR_SYSTEMS, galaxySpiralLayout, galaxySlotPositions, sunTypeFor, galaxyNodeScale, galaxyFillRatio, hashStringToFloat };'
].join('\n');

const werk = new Function('module', 'exports', quelle);
const mod = { exports: {} };
werk(mod, mod.exports);
module.exports = mod.exports;

if (require.main === module){
  const m = mod.exports;
  const pos = m.galaxySpiralLayout(m.STAR_SYSTEMS);
  console.log('Systeme:', m.STAR_SYSTEMS.length, 'Knotenskala:', m.galaxyNodeScale().toFixed(3), 'Fuellgrad:', m.galaxyFillRatio().toFixed(3));
  console.log(JSON.stringify(m.STAR_SYSTEMS.slice(0,5).map(s => ({ id:s.id, name:s.name, ...pos[s.id], sonne:m.sunTypeFor(s.id).key })), null, 1));
}
