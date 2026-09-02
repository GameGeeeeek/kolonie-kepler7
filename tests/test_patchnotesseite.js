// patchnotes.html (v8.352.0) - die oeffentliche Changelog-Seite.
//
// BEFUND, der zu dieser Seite fuehrte: Die Landeseite verlinkte an ZWEI Stellen auf
// patchnotes.html - im Kopfmenue neben SPIEL/FRAKTIONEN und in der Fusszeile neben Impressum und
// Datenschutz. Die Datei gab es nie. Beide Links liefen ins Leere, seit die Landeseite existiert.
//
// Was dieser Test festhaelt, und warum jeder Punkt einzeln danebengehen kann:
//   1. Die Seite existiert ueberhaupt, und JEDER Link aus dem Spiel zeigt auf etwas Vorhandenes.
//      Das ist der eigentliche Anlass - ein toter Link faellt niemandem auf, der die Seite nicht
//      anklickt, und Sascha klickt seine eigene Fusszeile nicht an.
//   2. Sie ist AKTUELL. Eine generierte Seite, die nach dem naechsten Patch nicht neu gebaut wird,
//      ist schlimmer als gar keine: Sie sieht gepflegt aus und luegt. Der Test vergleicht die
//      neueste Version der Seite mit der VERSION-Konstante des Spiels.
//   3. Sie ist VOLLSTAENDIG. Patchnotes sind in diesem Projekt unveraenderliche Historie - die
//      Seite darf nicht stillschweigend nur die letzten zwanzig zeigen.
//   4. Sie steht in der sitemap.xml. Eine Seite, die von der Startseite verlinkt ist, aber nicht
//      in der Sitemap steht, ist genau der Fall, den der Kommentar in der Landeseiten-Fusszeile
//      bereits fuer die Themenseiten beschreibt.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');
const path = require('path');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const WURZEL = path.dirname(SPIELDATEI);
const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------------------------------------------------------------- 1. Kein toter Link mehr
// Alle href="…html" aus der Spieldatei gegen den tatsaechlichen Dateibestand pruefen. Bewusst
// generisch statt nur patchnotes.html: Der naechste tote Link soll hier auffallen, nicht erst,
// wenn ihn jemand anklickt.
const links = [...new Set([...src.matchAll(/href="([a-z0-9_-]+\.html)"/g)].map(m => m[1]))];
check('Links auf statische Seiten gefunden', links.length >= 5, links);
const tot = links.filter(l => !fs.existsSync(path.join(WURZEL, l)));
check('kein Link zeigt auf eine fehlende Datei', tot.length === 0, tot);
check('patchnotes.html ist verlinkt', links.includes('patchnotes.html'));

const seitePfad = path.join(WURZEL, 'patchnotes.html');
check('patchnotes.html existiert', fs.existsSync(seitePfad));
if (!fs.existsSync(seitePfad)){ console.log('\nFAIL'); process.exit(1); }
const seite = fs.readFileSync(seitePfad, 'utf8');

// ---------------------------------------------------------------- 2. Aktuell
const version = (src.match(/const VERSION = '([\d.]+)'/) || [])[1];
check('VERSION aus der Spieldatei gelesen', !!version, version);
// Die Patchnotes selbst ausfuehren statt per Regex zerlegen - die Eintraege enthalten Apostrophe
// und HTML, eine naive Regex terminiert daran falsch (bekannter Fallstrick dieses Projekts).
const von = src.indexOf('const PATCHNOTES = ['), bis = src.indexOf('\n  ];', von);
const imSpiel = new Function(src.slice(von, bis + 4) + '; return PATCHNOTES;')();
// Seit dem 01.09.2026 stehen nur die neuesten Versionen im Spiel; die Historie liegt in
// patchnotes-archiv.json (build-patchnotes.js rotiert). Die Seite muss BEIDES zeigen.
const archivPfad = path.join(WURZEL, 'patchnotes-archiv.json');
check('patchnotes-archiv.json existiert', fs.existsSync(archivPfad));
const archiv = fs.existsSync(archivPfad) ? JSON.parse(fs.readFileSync(archivPfad, 'utf8')) : [];
const notes = imSpiel.concat(archiv);
check('PATCHNOTES aus Spiel und Archiv gelesen', imSpiel.length > 0 && notes.length > 100, { imSpiel: imSpiel.length, archiv: archiv.length });
check('neuester Eintrag im Spiel entspricht der VERSION', notes[0].version === version,
  { version, neuester: notes[0].version });
check('die Seite kennt die aktuelle Version – sonst ist sie veraltet (node build-patchnotes.js)',
  seite.includes('>' + version + ' <span class="pn-datum">'), version);

// ---------------------------------------------------------------- 3. Vollstaendig
const aufSeite = [...seite.matchAll(/id="v([\d-]+)"/g)].map(m => m[1].replace(/-/g, '.'));
check('jede Version des Spiels steht auf der Seite',
  aufSeite.length === notes.length, { seite: aufSeite.length, spiel: notes.length });
const fehlen = notes.map(n => n.version).filter(v => !aufSeite.includes(v));
check('keine einzelne Version fehlt', fehlen.length === 0, fehlen.slice(0, 5));
// Historie heisst Historie: Der aelteste Eintrag muss noch da sein.
check('auch die allererste Version steht noch drauf',
  aufSeite.includes(notes[notes.length - 1].version), notes[notes.length - 1].version);
const li = (seite.match(/<li>/g) || []).length;
const eintraege = notes.reduce((a, n) => a + (n.changes || []).length, 0);
check('alle Einzeleintraege sind uebernommen', li === eintraege, { seite: li, spiel: eintraege });

// ---------------------------------------------------------------- 4. Sitemap und Grundgeruest
const sitemap = fs.readFileSync(path.join(WURZEL, 'sitemap.xml'), 'utf8');
check('patchnotes.html steht in der sitemap.xml', sitemap.includes('/patchnotes.html'));
check('Seite nutzt das gemeinsame Stylesheet', /href="seiten\.css"/.test(seite));
check('Seite hat einen canonical-Eintrag', /rel="canonical"/.test(seite));
// Rechtstexte sind noindex - die Patchnotes ausdruecklich NICHT, sie sind echter Inhalt.
check('Patchnotes sind nicht auf noindex gesetzt', !/name="robots"[^>]*noindex/.test(seite));
check('Seite fuehrt zurueck ins Spiel', /href="\/"/.test(seite));

// ---------------------------------------------------------------- 5. Der Generator selbst
const gen = path.join(WURZEL, 'build-patchnotes.js');
check('build-patchnotes.js liegt im Repo', fs.existsSync(gen));
if (fs.existsSync(gen)){
  const g = fs.readFileSync(gen, 'utf8');
  check('der Generator liest die Spieldatei und das Archiv - und sonst nichts',
    /weltraum_kolonie\.html/.test(g) && /const PATCHNOTES = \[/.test(g) && /patchnotes-archiv\.json/.test(g));
  check('der Generator warnt, wenn VERSION und neuester Eintrag auseinanderlaufen',
    /WARNUNG: VERSION ist/.test(g));
}

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
