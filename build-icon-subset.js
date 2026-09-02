#!/usr/bin/env node
/*
 * Erzeugt den eingebetteten Icon-Font neu - als SUBSET, das nur die tatsächlich verwendeten Icons
 * enthält.
 *
 * WARUM ES DIESES SKRIPT GIBT
 * ---------------------------
 * In weltraum_kolonie.html steckte bis v8.296.0 der KOMPLETTE Tabler-Icon-Font als Base64:
 * 5.071 Glyphen, 447 KB binär, 596 KB als Base64 im HTML. Benutzt werden davon 69 Icons.
 * Base64 ist dabei doppelt teuer - es bläht um ein Drittel auf, und WOFF2 ist bereits komprimiert,
 * gzip holt daran fast nichts zurück. Gemessen: von 1.345 KB gzip-Auslieferung entfielen 448 KB auf
 * diesen Font. Das Subset bringt ihn auf 10,8 KB (gzip gesamt: 908 KB, -33%).
 *
 * Ohne dieses Skript wäre der eingebettete Font eine Blackbox: Sobald jemand ein 70. Icon braucht,
 * wüsste niemand mehr, woraus der Font gebaut wurde und wie man ihn erweitert. Genau deshalb liegt
 * die Erzeugung hier im Repo und nicht in einer einmaligen Handarbeit.
 *
 * SO ERWEITERST DU DEN FONT UM EIN NEUES ICON
 * -------------------------------------------
 *  1. tabler-icons-full.woff2 liegt bereits im Repo - das ist EXAKT der Font, der bis v8.295.0
 *     eingebettet war (aus der Spieldatei extrahiert, nicht neu heruntergeladen). Bewusst
 *     mitversioniert: Ein npm-Download waere eine andere Tabler-Version und koennte still andere
 *     Glyphen liefern als die, die Spieler bisher gesehen haben.
 *  2. Die CSS-Regel für das neue Icon in weltraum_kolonie.html eintragen:
 *       .ti-neuesicon:before { content: "\eXXX"; }
 *     (Der Codepoint steht in der tabler-icons.css der Webfont-Distribution.)
 *  3. `node build-icon-subset.js` ausführen. Das Skript liest die Whitelist AUS DER SPIELDATEI
 *     SELBST (alle .ti-*:before-Regeln) - es gibt also keine zweite Liste, die veralten könnte.
 *  4. `node check-icons.js` bestätigt anschließend, dass alle verwendeten Icons abgedeckt sind.
 *
 * ABHÄNGIGKEIT: fontTools (Python). Installation: pip install fonttools brotli
 * Ohne die Vollversion des Fonts bricht das Skript mit einer klaren Meldung ab und fasst die
 * Spieldatei NICHT an - ein halb gebautes Subset wäre schlimmer als gar keins.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const SPIEL = path.join(__dirname, 'weltraum_kolonie.html');
const VOLLFONT = path.join(__dirname, 'tabler-icons-full.woff2');

function fehler(msg) { console.error('FEHLER: ' + msg); process.exit(1); }

if (!fs.existsSync(VOLLFONT)) {
  fehler('tabler-icons-full.woff2 nicht gefunden.\n' +
    '  Die Datei gehoert ins Repo-Wurzelverzeichnis und ist dort normalerweise eingecheckt.\n' +
    '  Notfalls aus einer aelteren Fassung der Spieldatei extrahieren (die Base64-Nutzlast der\n' +
    '  @font-face-Regel), NICHT per npm neu laden - das waere eine andere Tabler-Version.\n' +
    '  Die Spieldatei wurde NICHT verändert.');
}

const html = fs.readFileSync(SPIEL, 'utf8');

// Whitelist direkt aus der Spieldatei ziehen - dieselbe Quelle, die auch check-icons.js nutzt.
// So kann die Icon-Liste nicht zwischen Font, CSS und Prüfskript auseinanderlaufen.
const regeln = [...html.matchAll(/\.ti-([a-z0-9-]+):before\s*\{\s*content:\s*["']\\?([0-9a-fA-F]{4,5})["']/g)];
if (!regeln.length) fehler('Keine .ti-*:before-Regeln in der Spieldatei gefunden - Format geändert?');
const codepoints = regeln.map(m => 'U+' + m[2]);
console.log('Icons laut Spieldatei: ' + regeln.length);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-font-'));
const cpDatei = path.join(tmp, 'codepoints.txt');
const ausgabe = path.join(tmp, 'subset.woff2');
fs.writeFileSync(cpDatei, codepoints.join(','));

try {
  execFileSync('pyftsubset', [
    VOLLFONT,
    '--unicodes-file=' + cpDatei,
    '--flavor=woff2',
    '--output-file=' + ausgabe,
    '--no-hinting',
    '--desubroutinize'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  fehler('pyftsubset fehlgeschlagen. Ist fontTools installiert? (pip install fonttools brotli)\n' +
    '  ' + (e.stderr ? e.stderr.toString().trim() : e.message) + '\n' +
    '  Die Spieldatei wurde NICHT verändert.');
}

const neu = fs.readFileSync(ausgabe);
const b64 = neu.toString('base64');

// Die bestehende Base64-Nutzlast ersetzen. Bewusst nur die EINE @font-face-Quelle - im HTML gibt es
// keine weitere data:font/woff2-URL, das wird hier gegengeprüft.
const treffer = html.match(/data:font\/woff2;base64,[A-Za-z0-9+/=]+/g) || [];
if (treffer.length !== 1) fehler('Erwartet genau EINE eingebettete woff2-Quelle, gefunden: ' + treffer.length);
const alt = treffer[0];
const altBytes = Buffer.from(alt.split(',')[1], 'base64').length;

const neuesHtml = html.replace(alt, 'data:font/woff2;base64,' + b64);
fs.writeFileSync(SPIEL, neuesHtml);

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log('Font vorher : ' + kb(altBytes));
console.log('Font nachher: ' + kb(neu.length));
console.log('HTML        : ' + kb(Buffer.byteLength(html)) + ' -> ' + kb(Buffer.byteLength(neuesHtml)));
console.log('\nweltraum_kolonie.html aktualisiert.');
console.log('Bitte noch pruefen: node check-icons.js');
