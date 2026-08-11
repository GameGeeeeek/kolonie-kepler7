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

// 5. Steht der Backend-Klon nebenan auf dem Stand seines Ursprungs? KEIN Fehlschlag, nur eine
//    Meldung - aber eine, die drei verlorene Prüfläufe erklärt hätte. Mehrere Tests lesen
//    `server.js` aus `../kolonie-kepler7-backend` (Randkriege, PvP-Deckel, ausbaubarer Deckel).
//    Ist dieser Klon älter als das Frontend, schlagen sie an, obwohl Spiel UND Test stimmen - am
//    10.08.2026 zweimal, am 11.08.2026 erneut, jedes Mal mit dem Verdacht auf einen echten
//    Spielfehler (CLAUDE.md-Arbeitsregel 22). Die Antwort auf "warum ist das rot" soll nicht mehr
//    eine halbe Stunde später kommen, sondern in Zeile drei des Protokolls stehen.
//    Bewusst OHNE `git fetch`: Der Prüflauf soll nicht ans Netz. Verglichen wird gegen die zuletzt
//    geholte Fernreferenz - fehlt die oder gibt es den Klon nicht, sagt die Zeile genau das.
try {
  const backend = path.resolve(WURZEL, '..', 'kolonie-kepler7-backend');
  if (!fs.existsSync(path.join(backend, 'server.js'))) {
    console.log('  ----  Backend-Klon: nicht vorhanden - die server.js-Tests überspringen sich');
  } else {
    const git = (...a) => spawnSync('git', a, { cwd: backend, encoding: 'utf8' });
    const kopf = (git('log', '--oneline', '-1').stdout || '').trim();
    // Verglichen wird gegen origin/master, NICHT gegen @{u}: Genau im Fehlerfall steht der Klon auf
    // einem eigenen Branch ohne Fernbezug, und @{u} bricht dann mit "no upstream configured" ab -
    // das Werkzeug stünde sich wieder selbst im Weg. Gemessen wird ohnehin gegen das, was live ist.
    const fern = ['origin/master', 'origin/main']
      .find(r => git('rev-parse', '--verify', '--quiet', r).status === 0);
    const zweig = (git('rev-parse', '--abbrev-ref', 'HEAD').stdout || '').trim();
    const hinten = fern ? (git('rev-list', '--count', 'HEAD..' + fern).stdout || '').trim() : '';
    if (!fern || !/^\d+$/.test(hinten)) {
      console.log('  ----  Backend-Klon: ' + kopf + ' (kein Vergleich möglich - noch nie geholt?)');
    } else if (Number(hinten) > 0) {
      console.log('  !!!!  Backend-Klon ist ' + hinten + ' Commit(s) HINTER ' + fern + ': ' + kopf);
      console.log('        Erst `cd ../kolonie-kepler7-backend && git fetch && git pull origin master`,');
      console.log('        sonst prüfen die server.js-Tests gegen einen veralteten Nachbarn.');
    } else {
      console.log('  ----  Backend-Klon auf Höhe von ' + fern
        + (zweig && zweig !== 'master' && zweig !== 'main' ? ' (Zweig ' + zweig + ')' : '') + ': ' + kopf);
    }
  }
} catch (e) {
  console.log('  ----  Backend-Klon: nicht prüfbar (' + String(e.message).slice(0, 60) + ')');
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
      const zeilen = ausgabe.split('\n').filter(l => /^FAIL|Error|Cannot find/.test(l)).slice(0, 6);
      for (const l of zeilen) console.log('         ' + l.slice(0, 160));
      if (!zeilen.length) console.log('         (keine FAIL-Zeile - Zeitüberschreitung oder Absturz)');
    }
  }
}

// ------------------------------------------------------------------------------------ Ergebnis
console.log('\n=== Ergebnis ===');
console.log(ergebnisse.length + ' Prüfungen, ' + fehler + ' fehlgeschlagen');
process.exit(fehler ? 1 : 0);
