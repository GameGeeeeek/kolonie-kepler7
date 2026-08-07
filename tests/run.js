#!/usr/bin/env node
/*
 * Prüflauf für kolonie-kepler7 - führt die Pflichtprüfungen aus CLAUDE.md und danach alle Tests aus.
 *
 *   node tests/run.js              alles
 *   node tests/run.js selects      nur Tests, deren Dateiname "selects" enthält
 *   node tests/run.js --nur-pflicht   nur Syntax + Icon-Whitelist + Dateigleichheit (Sekunden statt Minuten)
 *
 * Exit-Code 0 = alles sauber. Damit taugt der Aufruf auch für eine spätere CI oder einen
 * Git-Hook, ohne dass jemand die Ausgabe lesen muss.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..');
const argumente = process.argv.slice(2);
const nurPflicht = argumente.includes('--nur-pflicht');
const filter = argumente.filter(a => !a.startsWith('--'));

let fehler = 0;
const ergebnisse = [];
function melde(name, ok, zusatz) {
  ergebnisse.push({ name, ok, zusatz });
  if (!ok) fehler++;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (zusatz ? '  (' + zusatz + ')' : ''));
}

// ---------------------------------------------------------------- Pflichtprüfungen (CLAUDE.md 1-3)
console.log('\n=== Pflichtprüfungen ===');

// 1. Syntax des eingebetteten <script>-Blocks
try {
  const html = fs.readFileSync(path.join(WURZEL, 'weltraum_kolonie.html'), 'utf8');
  const treffer = html.match(/<script>([\s\S]*)<\/script>/);
  if (!treffer) throw new Error('kein <script>-Block gefunden');
  new Function(treffer[1]);
  melde('Syntax weltraum_kolonie.html', true);
} catch (e) {
  melde('Syntax weltraum_kolonie.html', false, String(e.message).slice(0, 120));
}

// 2. Icon-Whitelist
try {
  execFileSync(process.execPath, [path.join(WURZEL, 'check-icons.js')], { cwd: WURZEL, stdio: 'pipe' });
  melde('Icon-Whitelist (check-icons.js)', true);
} catch (e) {
  melde('Icon-Whitelist (check-icons.js)', false, (e.stdout ? e.stdout.toString() : '').trim().split('\n').pop());
}

// 3. Die beiden HTML-Dateien müssen byte-gleich sein (der Pi-Deploy kopiert weltraum_kolonie.html,
//    index.html ist die Kopie - laufen sie auseinander, sieht der Spieler etwas anderes als getestet)
try {
  const a = fs.readFileSync(path.join(WURZEL, 'weltraum_kolonie.html'));
  const b = fs.readFileSync(path.join(WURZEL, 'index.html'));
  melde('weltraum_kolonie.html == index.html', a.equals(b),
    a.equals(b) ? '' : 'cp weltraum_kolonie.html index.html');
} catch (e) {
  melde('weltraum_kolonie.html == index.html', false, String(e.message).slice(0, 80));
}

// 4. VERSION und der oberste PATCHNOTES-Eintrag müssen zusammenpassen - sonst wurde beim Commit
//    eines von beidem vergessen (CLAUDE.md Punkt 4).
try {
  const html = fs.readFileSync(path.join(WURZEL, 'weltraum_kolonie.html'), 'utf8');
  const v = (html.match(/const VERSION = '([^']+)'/) || [])[1];
  const erster = (html.match(/const PATCHNOTES = \[\s*\{ version:'([^']+)'/) || [])[1];
  melde('VERSION passt zum obersten Patchnotes-Eintrag', !!v && v === erster,
    v === erster ? v : 'VERSION=' + v + ' / Patchnotes=' + erster);
} catch (e) {
  melde('VERSION passt zum obersten Patchnotes-Eintrag', false, String(e.message).slice(0, 80));
}

// ---------------------------------------------------------------------------------- Testdateien
if (!nurPflicht) {
  const dateien = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.js') && f !== 'run.js')
    .filter(f => !filter.length || filter.some(t => f.includes(t)))
    .sort();

  console.log('\n=== Tests (' + dateien.length + ') ===');
  for (const datei of dateien) {
    const start = Date.now();
    // Jeder Test läuft als eigener Prozess: Ein Absturz reißt den Prüflauf nicht mit, und die
    // Tests können ungestört eigene Server/Browser starten.
    const r = spawnSync(process.execPath, [path.join(__dirname, datei)], {
      cwd: WURZEL, encoding: 'utf8', timeout: 5 * 60 * 1000
    });
    const dauer = ((Date.now() - start) / 1000).toFixed(0) + 's';
    const ausgabe = (r.stdout || '') + (r.stderr || '');
    const uebersprungen = /^SKIP - /m.test(ausgabe);
    const ok = r.status === 0;
    melde(datei.padEnd(28) + dauer.padStart(5) + (uebersprungen ? '  [übersprungen]' : ''), ok);
    if (!ok) {
      // Bei Fehlschlag die FAIL-Zeilen zeigen, damit man nicht erst einzeln nachstarten muss.
      // `FEHLER` gehört mit ins Muster: umgebung.js bricht mit "FEHLER: Playwright nicht gefunden"
      // ab, und genau diese Zeile fiel vorher durch den Filter. Der erste CI-Lauf (07.08.2026)
      // meldete deshalb 123-mal "Zeitüberschreitung oder Absturz" - beides falsch, die Ursache
      // stand die ganze Zeit in der Ausgabe und wurde nur weggefiltert. Ein Diagnosewerkzeug, das
      // die eine vorhandene Fehlermeldung verschweigt, ist schlimmer als keines.
      const zeilen = ausgabe.split('\n').filter(l => /^FAIL|FEHLER|Error|Cannot find/.test(l)).slice(0, 6);
      for (const l of zeilen) console.log('         ' + l.slice(0, 160));
      if (!zeilen.length) console.log('         (keine Fehlerzeile - Zeitüberschreitung oder stiller Absturz)');
    }
  }
}

// ------------------------------------------------------------------------------------ Ergebnis
console.log('\n=== Ergebnis ===');
console.log(ergebnisse.length + ' Prüfungen, ' + fehler + ' fehlgeschlagen');
process.exit(fehler ? 1 : 0);
