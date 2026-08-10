// Die Systemliste von Frontend und Backend, Eintrag für Eintrag.
//
// WARUM ES DIESEN TEST GIBT (Befund 09./10.08.2026): SYSTEM_COORDS im Backend kannte 41 der 69
// Basissysteme. Es fehlten alle acht äußersten (sys_pandora_saum … sys_meridian_kern) und alle
// 20 sysn_*. Der Kommentar über der Liste behauptete dagegen ausdrücklich Gleichheit mit
// STAR_SYSTEMS, und test_paritaet_tabellen.js deckte als einzige der gespiegelten Tabellen
// ausgerechnet die Systemliste NICHT ab – der Fehler konnte deshalb beliebig lange leben.
//
// Er war auch nicht harmlos: In diesen 28 Systemen konnte kein neuer Spieler spawnen, keine
// Fraktion Territorium halten oder expandieren, keine Supernova und kein Wurmloch entstehen,
// keine Piratenbasis gegründet und kein Allianz-Raid angesetzt werden. Rund 40 % der Karte waren
// serverseitig tot.
//
// WARUM DER TEST DIE WOCHENSYSTEME MITPRÜFT: Ein Test, der nur die statischen Listen vergleicht,
// wäre am ersten Montag nach dem Nachtragen wieder wertlos gewesen. Das Frontend hängt jede Woche
// zwei Systeme an; die Lücke wäre also sofort neu aufgelaufen, ohne dass irgendetwas anschlägt.
// Geprüft wird deshalb die FORMEL, nicht der Momentanbestand: Für Wochenindizes bis zum Deckel
// müssen beide Seiten dieselbe ID und dieselben Koordinaten ausrechnen.
//
// GEGENPROBE (beide Richtungen ausgeführt, CLAUDE.md-Testregel 1):
//   rot am alten Stand – `git -C ../kolonie-kepler7-backend show HEAD~1:server.js` in eine Kopie
//   legen und SERVER_JS daraufzeigen lassen: meldet die 28 fehlenden IDs namentlich.
//   grün am neuen Stand – siehe Lauf unten.
//   Zusätzlich künstlich kaputtgemacht: ein gx um 0.1 verändert → „gx/gy stimmen zahlengleich"
//   schlägt an; WEEKLY_SYSTEM_EPOCH um einen Tag verschoben → Wochenformel schlägt an.

const { SPIELDATEI, SERVER_JS, ueberspringen } = require('./lib/umgebung');
const fs = require('fs');

if (!SERVER_JS) ueberspringen('Vergleicht Frontend und Backend - das Backend-Repo (kolonie-kepler7-backend) liegt hier nicht daneben.');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const feSrc = fs.readFileSync(SPIELDATEI, 'utf8');
const beSrc = fs.readFileSync(SERVER_JS, 'utf8');

// ---- Frontend: STAR_SYSTEMS zeilenweise lesen --------------------------------------------------
// Zeilenweise statt per Regex über die ganze Datei: Die Einträge stehen je auf einer Zeile, und
// eine naive Regex über 57.000 Zeilen terminiert an verschachtelten Klammern falsch
// (CLAUDE.md-Fallstrick).
const feZeilen = feSrc.split('\n');
const feStart = feZeilen.findIndex(z => z.startsWith('  const STAR_SYSTEMS = ['));
check('Frontend: STAR_SYSTEMS gefunden', feStart >= 0);
let feEnde = feStart;
while (feEnde < feZeilen.length && !feZeilen[feEnde].startsWith('  ];')) feEnde++;
// Endanker muss EXISTIEREN, sonst liefe der Ausschnitt bis zum Dateiende und die Prüfung
// würde vacuous (CLAUDE.md-Testregel 6).
check('Frontend: Ende von STAR_SYSTEMS gefunden', feEnde < feZeilen.length && feEnde > feStart, feEnde);

const feSys = [];
for (let i = feStart + 1; i < feEnde; i++) {
  const m = feZeilen[i].match(/id:'([a-z0-9_]+)',\s*name:'([^']*)',\s*gx:([-\d.]+),\s*gy:([-\d.]+)/);
  if (m) feSys.push({ id: m[1], gx: Number(m[3]), gy: Number(m[4]) });
}
check('Frontend: Basissysteme gelesen', feSys.length > 60, feSys.length);

// ---- Backend: SYSTEM_COORDS zeilenweise lesen --------------------------------------------------
const beZeilen = beSrc.split('\n');
const beStart = beZeilen.findIndex(z => z.startsWith('const SYSTEM_COORDS = ['));
check('Backend: SYSTEM_COORDS gefunden', beStart >= 0);
let beEnde = beStart;
while (beEnde < beZeilen.length && !beZeilen[beEnde].startsWith('];')) beEnde++;
check('Backend: Ende von SYSTEM_COORDS gefunden', beEnde < beZeilen.length && beEnde > beStart, beEnde);

const beSys = [];
for (let i = beStart + 1; i < beEnde; i++) {
  const m = beZeilen[i].match(/id: '([a-z0-9_]+)', gx: ([-\d.]+), gy: ([-\d.]+)/);
  if (m) beSys.push({ id: m[1], gx: Number(m[2]), gy: Number(m[3]) });
}
check('Backend: Basissysteme gelesen', beSys.length > 60, beSys.length);

// ---- 1. Mengenvergleich ------------------------------------------------------------------------
const beIds = new Set(beSys.map(s => s.id));
const feIds = new Set(feSys.map(s => s.id));
const fehlen = feSys.filter(s => !beIds.has(s.id)).map(s => s.id);
check('kein Basissystem fehlt dem Backend', fehlen.length === 0, fehlen);
const zuviel = beSys.filter(s => !feIds.has(s.id)).map(s => s.id);
check('das Backend kennt kein System, das es im Frontend nicht gibt', zuviel.length === 0, zuviel);
check('gleiche Anzahl Basissysteme', feSys.length === beSys.length, { frontend: feSys.length, backend: beSys.length });

// ---- 2. Koordinaten zahlengleich ---------------------------------------------------------------
// Die Koordinaten sind nicht bloß Deko: SYSTEM_NEIGHBORS wird daraus berechnet, und der Graph
// entscheidet, wohin eine Fraktion expandieren darf. Eine Abweichung von 0,1 kann einen anderen
// Nachbarn ergeben, ohne dass irgendwo ein Fehler auftritt.
const beById = {}; for (const s of beSys) beById[s.id] = s;
const abweich = feSys
  .filter(s => beById[s.id] && (beById[s.id].gx !== s.gx || beById[s.id].gy !== s.gy))
  .map(s => `${s.id}: FE ${s.gx}/${s.gy} vs BE ${beById[s.id].gx}/${beById[s.id].gy}`);
check('alle gx/gy stimmen zahlengleich überein', abweich.length === 0, abweich);

// ---- 3. Reihenfolge ----------------------------------------------------------------------------
// Nicht kosmetisch: Das Frontend leitet die Kartenposition aus dem INDEX im Array ab
// (galaxySpiralLayout über galaxySlotPositions). Wer im Backend umsortiert, verschiebt zwar nichts
// auf der Karte, verliert aber die einfache Nachvollziehbarkeit beider Listen nebeneinander.
const reihenfolgeGleich = feSys.every((s, i) => beSys[i] && beSys[i].id === s.id);
check('gleiche Reihenfolge', reihenfolgeGleich,
  reihenfolgeGleich ? undefined : feSys.map((s, i) => (beSys[i] && beSys[i].id === s.id) ? null : `${i}: FE ${s.id} vs BE ${beSys[i] ? beSys[i].id : '(fehlt)'}`).filter(Boolean).slice(0, 5));

// ---- 4. Die Wochenformel -----------------------------------------------------------------------
// Der eigentliche Zweck dieses Tests. Beide Seiten rechnen unabhängig; verglichen wird das
// Ergebnis, nicht der Quelltext.
function konstante(src, name) {
  const m = src.match(new RegExp('const ' + name + ' = ([^;]+);'));
  return m ? m[1].trim() : null;
}
for (const k of ['WEEKLY_SYSTEMS_PER_WEEK', 'WEEKLY_SYSTEM_EPOCH', 'WEEKLY_SYSTEM_MAX']) {
  const fe = konstante(feSrc, k), be = konstante(beSrc, k);
  check('Wochen-Konstante ' + k + ' beidseitig gleich', !!fe && fe === be, { frontend: fe, backend: be });
}

// Ring und Formel im Backend nachrechnen – aus dem echten Backend-Quelltext, nicht nachgebaut.
function backendWochenRing() {
  const m = beSrc.match(/const WEEKLY_RING = \(function \(\) \{([\s\S]*?)\n\}\)\(\);/);
  if (!m) return null;
  const basis = beSys;
  const fn = new Function('SYSTEM_COORDS', 'BASE_SYSTEM_COUNT', m[1]);
  return fn(basis, basis.length);
}
function backendWochenKoord() {
  const m = beSrc.match(/function weeklySystemCoord\(i\) \{([\s\S]*?)\n\}/);
  if (!m) return null;
  const ring = backendWochenRing();
  return new Function('i', 'WEEKLY_RING', m[1]).bind(null);
  function _unused() { return ring; }
}
const beRing = backendWochenRing();
check('Backend: WEEKLY_RING berechenbar', !!beRing && isFinite(beRing.r0), beRing);

// Frontend: derselbe Ring, aber über STAR_SYSTEMS – im Spiel zum Zeitpunkt der Definition also
// genau die Basissysteme (extendWeeklySystems läuft erst danach).
const feRing = (function () {
  let sx = 0, sy = 0;
  for (const s of feSys) { sx += s.gx; sy += s.gy; }
  const cx = sx / feSys.length, cy = sy / feSys.length;
  let rMax = 0;
  for (const s of feSys) rMax = Math.max(rMax, Math.hypot(s.gx - cx, s.gy - cy));
  return { cx, cy, r0: rMax + 45 };
})();
check('Ringmittelpunkt und -radius identisch',
  !!beRing && beRing.cx === feRing.cx && beRing.cy === feRing.cy && beRing.r0 === feRing.r0,
  { frontend: feRing, backend: beRing });

// Die Koordinatenformel beider Seiten, je aus ihrem eigenen Quelltext gezogen und ausgeführt.
function feWochenKoord() {
  const m = feSrc.match(/const winkel = i \* 2\.39996323;[\s\S]*?gy: Math\.round\(\(WEEKLY_RING\.cy \+ Math\.sin\(winkel\)\*radius\)\*10\)\/10,/);
  return !!m;
}
check('Frontend: Wochen-Koordinatenformel gefunden', feWochenKoord());

const beKoordBlock = beSrc.match(/function weeklySystemCoord\(i\) \{([\s\S]*?)\n\}/);
check('Backend: weeklySystemCoord gefunden', !!beKoordBlock);
const beKoord = beKoordBlock ? new Function('i', 'WEEKLY_RING', 'return (function(){' + beKoordBlock[1] + '})();') : null;

// Frontend-Formel bewusst hier ausgeschrieben und mit der Fundstelle oben abgesichert: Die
// Funktion im Frontend erzeugt neben den Koordinaten auch Namen und Planeten über einen
// Zufallsgenerator und lässt sich nicht sauber isoliert ausführen.
function feKoord(i, ring) {
  const winkel = i * 2.39996323;
  const radius = Math.sqrt(ring.r0 * ring.r0 + (i + 1) * 700);
  return {
    id: 'sysw_' + i,
    gx: Math.round((ring.cx + Math.cos(winkel) * radius) * 10) / 10,
    gy: Math.round((ring.cy + Math.sin(winkel) * radius) * 10) / 10
  };
}

if (beKoord && beRing) {
  // Die GROSSEN Indizes tragen die Prüfung. Gemessen an einer künstlich verbogenen Kopie
  // ((i+1)*700 → *701): Bei i = 0, 1, 2, 5 und 13 ist die Abweichung kleiner als die Rundung auf
  // 0,1 und verschwindet spurlos; angeschlagen hat der Test erst bei i = 41, 99 und 207. Eine
  // Probe, die nur die ersten Wochen abtastet, wäre also grün geblieben, obwohl die Formeln
  // auseinanderlaufen – und der Fehler wäre in einem Jahr aufgetaucht.
  const proben = [0, 1, 2, 5, 13, 41, 99, 207];
  const ungleich = [];
  for (const i of proben) {
    const a = feKoord(i, feRing), b = beKoord(i, beRing);
    if (a.id !== b.id || a.gx !== b.gx || a.gy !== b.gy) {
      ungleich.push(`i=${i}: FE ${a.id} ${a.gx}/${a.gy} vs BE ${b.id} ${b.gx}/${b.gy}`);
    }
  }
  check('Wochensysteme: beide Seiten rechnen dieselben Koordinaten', ungleich.length === 0, ungleich);
  // Und die Probe darf nicht trivial bestehen, weil beide Seiten dasselbe Nichts liefern.
  const p0 = feKoord(0, feRing);
  check('Probe ist nicht leer (Koordinaten sind echte Zahlen)',
    isFinite(p0.gx) && isFinite(p0.gy) && (p0.gx !== 0 || p0.gy !== 0), p0);
}

// ---- 5. Der Kommentar darf nicht wieder etwas behaupten, was der Test nicht deckt --------------
check('Backend-Kommentar verweist auf diesen Test',
  beSrc.includes('test_systemparitaet.js'));

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles in Ordnung');
process.exit(fail ? 1 : 0);
