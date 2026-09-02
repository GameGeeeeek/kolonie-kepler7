// Patchnotes-Archiv (01.09.2026, Strukturpruefung Punkt 4).
//
// BEFUND, der zu diesem Umbau fuehrte: Alle 1.047 Versionen standen als Literal in der Spieldatei -
// 1,14 MB, 18 % des JavaScripts, bei jedem Spielstart mitgeladen und mitgeparst, obwohl das Spiel
// nur die neuesten 15 zeichnet. Jetzt bleiben PATCHNOTES_IM_SPIEL Eintraege im Spiel, der Rest liegt
// in patchnotes-archiv.json; build-patchnotes.js rotiert bei jedem Release die aeltesten Eintraege
// dorthin und pflegt PATCHNOTES_ARCHIV_ANZAHL im Spiel sowie version.txt.
//
// Was hier gemessen wird, und warum jeder Punkt einzeln danebengehen kann:
//   1. Der BESTAND passt zusammen: Block kurz, Archiv vorhanden, Zaehler im Spiel gleich der
//      Archivlaenge, die Kette Spiel+Archiv streng absteigend ohne Doppelte, version.txt = VERSION.
//      Jede dieser Groessen wird von einem anderen Schritt geschrieben; laeuft einer nicht, stimmt
//      genau eine davon nicht mehr - und der Update-Tab nennt eine falsche Restzahl, oder kein
//      Spieler bemerkt das naechste Update (version.txt).
//   2. Die ROTATION selbst, an einer Kopie: ein neuer Eintrag oben, Generator laufen lassen -
//      der Block bleibt bei PATCHNOTES_IM_SPIEL, genau der aelteste Eintrag wandert unveraendert
//      an den Anfang des Archivs, Zaehler und version.txt ziehen nach. Das Original bleibt
//      unberuehrt (der Generator schreibt in die Spieldatei; ein Test darf das nur an der Kopie).
//   3. GEGENPROBE: Steht eine zu verschiebende Version schon im Archiv, bricht der Generator ab,
//      BEVOR er etwas schreibt. Ein Generator, der still Doppelte erzeugt, saehe wie ein
//      erfolgreicher Lauf aus.
//   4. IDEMPOTENZ: Ohne neuen Eintrag aendert ein zweiter Lauf keine Datei. Sonst haette jeder
//      Prueflauf, der den Generator ruft, ein Diff im Arbeitsbaum.
const { SPIELDATEI, WURZEL } = require('./lib/umgebung');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const ende = () => { console.log('\n' + (fail ? 'FAIL' : 'PASS')); process.exit(fail ? 1 : 0); };

const START = 'const PATCHNOTES = [';
function blockLesen(s){
  const von = s.indexOf(START), bis = s.indexOf('\n  ];', von);
  if (von < 0 || bis < 0) return null;
  return { von, bis, eintraege: new Function('return [' + s.slice(von + START.length, bis) + '\n]')() };
}
function vergleich(a, b){
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++){ const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
}

const GENERATOR = path.join(WURZEL, 'build-patchnotes.js');
const ARCHIV = path.join(WURZEL, 'patchnotes-archiv.json');
const VERSION_TXT = path.join(WURZEL, 'version.txt');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const VERSION = (src.match(/const VERSION = '([\d.]+)'/) || [])[1];
const gen = fs.readFileSync(GENERATOR, 'utf8');
const IM_SPIEL = parseInt((gen.match(/const PATCHNOTES_IM_SPIEL = (\d+)/) || [])[1], 10);
const SOFORT = parseInt((src.match(/const PATCHNOTES_SOFORT = (\d+)/) || [])[1], 10);

// ---------------------------------------------------------------- 1. Bestand
const block = blockLesen(src);
check('1-vorab: VERSION, PATCHNOTES_IM_SPIEL, PATCHNOTES_SOFORT und der Block sind lesbar',
  !!VERSION && Number.isFinite(IM_SPIEL) && Number.isFinite(SOFORT) && !!block, { VERSION, IM_SPIEL, SOFORT });
if (!block) ende();
const imSpiel = block.eintraege;
check('1a: der Block im Spiel ist hoechstens PATCHNOTES_IM_SPIEL Eintraege lang',
  imSpiel.length <= IM_SPIEL, { imSpiel: imSpiel.length, IM_SPIEL });
check('1b: aber laenger als PATCHNOTES_SOFORT - der Knopf im Update-Tab hat auch ohne Netz etwas zu zeigen',
  imSpiel.length > SOFORT, { imSpiel: imSpiel.length, SOFORT });
check('1c: der Block ist klein (unter 100 kB) - das war der Sinn des Umbaus',
  block.bis - block.von < 100 * 1024, block.bis - block.von);
check('1d: patchnotes-archiv.json existiert', fs.existsSync(ARCHIV));
let archiv = [];
try { archiv = JSON.parse(fs.readFileSync(ARCHIV, 'utf8')); } catch (e) { check('1d: Archiv ist gueltiges JSON', false, String(e.message).slice(0, 80)); }
check('1e: das Archiv ist ein Array mit der Historie (ueber 100 Eintraege)', Array.isArray(archiv) && archiv.length > 100, archiv.length);
const anzahl = parseInt((src.match(/const PATCHNOTES_ARCHIV_ANZAHL = (\d+);/) || [])[1], 10);
check('1f: PATCHNOTES_ARCHIV_ANZAHL im Spiel entspricht der Archivlaenge', anzahl === archiv.length, { imSpiel: anzahl, archiv: archiv.length });
const alle = imSpiel.concat(archiv);
let bruch = null;
for (let i = 1; i < alle.length && !bruch; i++){
  if (vergleich(alle[i - 1].version, alle[i].version) <= 0) bruch = alle[i - 1].version + ' -> ' + alle[i].version;
}
check('1g: Spiel + Archiv sind eine streng absteigende Kette ohne Doppelte (auch ueber die Naht)', !bruch, bruch || alle.length);
const kaputt = alle.filter(n => !n || typeof n.version !== 'string' || typeof n.date !== 'string' || !Array.isArray(n.changes) || !n.changes.length);
check('1h: jeder Eintrag traegt version, date und mindestens eine Aenderung', kaputt.length === 0, kaputt.slice(0, 3));
check('1i: version.txt existiert und entspricht VERSION',
  fs.existsSync(VERSION_TXT) && fs.readFileSync(VERSION_TXT, 'utf8').trim() === VERSION,
  fs.existsSync(VERSION_TXT) ? fs.readFileSync(VERSION_TXT, 'utf8').trim() : 'fehlt');
check('1j: der neueste Eintrag im Spiel ist die VERSION', imSpiel[0] && imSpiel[0].version === VERSION, imSpiel[0] && imSpiel[0].version);

// ---------------------------------------------------------------- Hilfe: Kopie anlegen, Generator fahren
function kopie(name){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler7-' + name + '-'));
  for (const f of ['weltraum_kolonie.html', 'patchnotes-archiv.json', 'version.txt']) fs.copyFileSync(path.join(WURZEL, f), path.join(dir, f));
  return dir;
}
function generator(dir){
  const r = spawnSync(process.execPath, [GENERATOR], { env: Object.assign({}, process.env, { KEPLER_WURZEL: dir }), encoding: 'utf8' });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
function naechsteVersion(v){ const t = v.split('.').map(Number); t[2] += 1; return t.join('.'); }

// ---------------------------------------------------------------- 2. Rotation an einer Kopie
const NEU = naechsteVersion(VERSION);
const dir2 = kopie('rotation');
{
  let k = fs.readFileSync(path.join(dir2, 'weltraum_kolonie.html'), 'utf8');
  k = k.replace("const VERSION = '" + VERSION + "'", "const VERSION = '" + NEU + "'");
  k = k.replace(START + '\n', START + "\n    { version:'" + NEU + "', date:'01.01.2030', changes:[\n      'Testeintrag der Rotation'\n    ]},\n");
  fs.writeFileSync(path.join(dir2, 'weltraum_kolonie.html'), k);
}
const lauf2 = generator(dir2);
check('2a: der Generator laeuft an der Kopie durch (Exit 0)', lauf2.status === 0, lauf2.out.split('\n').slice(-4));
const spiel2 = fs.readFileSync(path.join(dir2, 'weltraum_kolonie.html'), 'utf8');
const block2 = blockLesen(spiel2);
const archiv2 = JSON.parse(fs.readFileSync(path.join(dir2, 'patchnotes-archiv.json'), 'utf8'));
check('2b: der Block bleibt bei PATCHNOTES_IM_SPIEL Eintraegen', block2 && block2.eintraege.length === IM_SPIEL, block2 && block2.eintraege.length);
check('2c: der neue Eintrag steht oben im Spiel', block2 && block2.eintraege[0].version === NEU, block2 && block2.eintraege[0].version);
check('2d: das Archiv ist um genau einen Eintrag gewachsen', archiv2.length === archiv.length + 1, { vorher: archiv.length, nachher: archiv2.length });
const erwartetVerschoben = imSpiel[imSpiel.length - 1];
check('2e: genau der bisher aelteste Eintrag im Spiel steht jetzt vorn im Archiv - Wort fuer Wort',
  JSON.stringify(archiv2[0]) === JSON.stringify(erwartetVerschoben), { archivVorn: archiv2[0] && archiv2[0].version, erwartet: erwartetVerschoben.version });
check('2f: der verschobene Eintrag steht nicht mehr im Spiel', block2 && !block2.eintraege.some(n => n.version === erwartetVerschoben.version));
check('2g: PATCHNOTES_ARCHIV_ANZAHL im Spiel ist nachgezogen',
  parseInt((spiel2.match(/const PATCHNOTES_ARCHIV_ANZAHL = (\d+);/) || [])[1], 10) === archiv2.length);
check('2h: version.txt ist nachgezogen', fs.readFileSync(path.join(dir2, 'version.txt'), 'utf8').trim() === NEU);
const seite2 = fs.existsSync(path.join(dir2, 'patchnotes.html')) ? fs.readFileSync(path.join(dir2, 'patchnotes.html'), 'utf8') : '';
check('2i: patchnotes.html kennt die neue Version UND den verschobenen Eintrag',
  seite2.includes('id="v' + NEU.replace(/\./g, '-') + '"') && seite2.includes('id="v' + erwartetVerschoben.version.replace(/\./g, '-') + '"'));
check('2j: die Spieldatei ausserhalb des Blocks ist unveraendert (nur Block, Zaehler und VERSION duerfen sich aendern)',
  spiel2.slice(block2.bis) === src.slice(block.bis).replace(/const PATCHNOTES_ARCHIV_ANZAHL = \d+;/, 'const PATCHNOTES_ARCHIV_ANZAHL = ' + archiv2.length + ';') &&
  spiel2.slice(0, block2.von) === src.slice(0, block.von).replace("const VERSION = '" + VERSION + "'", "const VERSION = '" + NEU + "'"));
check('2k: das Original im Repo ist unberuehrt', fs.readFileSync(SPIELDATEI, 'utf8') === src &&
  JSON.stringify(JSON.parse(fs.readFileSync(ARCHIV, 'utf8'))) === JSON.stringify(archiv));

// ---------------------------------------------------------------- 3. Gegenprobe: Doppelte im Archiv
const dir3 = kopie('doppelt');
{
  let k = fs.readFileSync(path.join(dir3, 'weltraum_kolonie.html'), 'utf8');
  k = k.replace("const VERSION = '" + VERSION + "'", "const VERSION = '" + NEU + "'");
  k = k.replace(START + '\n', START + "\n    { version:'" + NEU + "', date:'01.01.2030', changes:[\n      'Testeintrag'\n    ]},\n");
  fs.writeFileSync(path.join(dir3, 'weltraum_kolonie.html'), k);
  // Der Eintrag, der verschoben werden muesste, steht schon vorn im Archiv.
  fs.writeFileSync(path.join(dir3, 'patchnotes-archiv.json'), JSON.stringify([erwartetVerschoben].concat(archiv)));
}
const vorher3 = fs.readFileSync(path.join(dir3, 'weltraum_kolonie.html'), 'utf8');
const lauf3 = generator(dir3);
check('3a: steht die zu verschiebende Version schon im Archiv, bricht der Generator ab', lauf3.status !== 0, lauf3.status);
check('3b: ... und nennt den Grund', /schon im Archiv/.test(lauf3.out), lauf3.out.split('\n').find(l => /Archiv/.test(l)));
check('3c: ... und hat vorher NICHTS geschrieben', fs.readFileSync(path.join(dir3, 'weltraum_kolonie.html'), 'utf8') === vorher3 &&
  !fs.existsSync(path.join(dir3, 'patchnotes.html')));

// ---------------------------------------------------------------- 4. Idempotenz
const dir4 = kopie('idempotent');
const lauf4 = generator(dir4);
check('4a: ohne neuen Eintrag laeuft der Generator durch', lauf4.status === 0, lauf4.out.split('\n').slice(-3));
check('4b: ... und laesst Spieldatei, Archiv und version.txt byte-gleich',
  fs.readFileSync(path.join(dir4, 'weltraum_kolonie.html'), 'utf8') === src &&
  fs.readFileSync(path.join(dir4, 'patchnotes-archiv.json'), 'utf8') === fs.readFileSync(ARCHIV, 'utf8') &&
  fs.readFileSync(path.join(dir4, 'version.txt'), 'utf8') === fs.readFileSync(VERSION_TXT, 'utf8'));
check('4c: ... und die erzeugte patchnotes.html gleicht der im Repo',
  fs.readFileSync(path.join(dir4, 'patchnotes.html'), 'utf8') === fs.readFileSync(path.join(WURZEL, 'patchnotes.html'), 'utf8'));

for (const d of [dir2, dir3, dir4]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }
ende();
