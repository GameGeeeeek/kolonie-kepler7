#!/usr/bin/env node
/*
 * Prüflauf für kolonie-kepler7 - führt die Pflichtprüfungen aus CLAUDE.md und danach alle Tests aus.
 *
 *   node tests/run.js              alles
 *   node tests/run.js selects      nur Tests, deren Dateiname "selects" enthält
 *   node tests/run.js --nur-pflicht   nur Syntax + Icon-Whitelist + Dateigleichheit (Sekunden statt Minuten)
 *   node tests/run.js --nummer     Pflichtprüfungen + die vier Tests, die an VERSION/PATCHNOTES hängen
 *
 * --nummer ist fuer EINEN bestimmten Ablauf da (eingefuehrt 15.08.2026): Die Versionsnummer wird
 * erst NACH dem gruenen vollen Prueflauf vergeben, unmittelbar vor dem Commit - sonst ueberholt bei
 * parallelem Auslieferungstakt jede fremde Version die eigene, und jede Kollision kostet einen
 * weiteren vollen Lauf (viermal in Folge am 14./15.08.2026, fuenfmal am 10.08.). Danach ist die
 * Spieldatei aber angefasst worden, und "der volle Lauf war gruen" gilt streng genommen fuer einen
 * anderen Stand. Dieser Modus schliesst genau diese Luecke: Er prueft, was eine Nummernvergabe
 * ueberhaupt kaputtmachen KANN - Syntax, Dateigleichheit, VERSION-zu-Patchnote, die erzeugte
 * patchnotes.html und die Tests, die den Patchnotes-Block lesen. In Sekunden statt in 25 Minuten.
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
// Die vier Tests, die WIRKLICH am Patchnotes-Block oder an VERSION haengen - ermittelt per
// `grep -l "PATCHNOTES\|const VERSION" tests/*.js` und danach einzeln nachgesehen, welche den
// Inhalt auch benutzen statt ihn nur zu erwaehnen. Zusammen rund 14 Sekunden.
const NUMMER_TESTS = ['test_patchnotesseite.js', 'test_patchnotes_lazy.js', 'test_zaehlangaben.js', 'test_seo.js'];
const nurNummer = argumente.includes('--nummer');
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
//    geholte Fernreferenz - fehlt die oder gibt es den Klon nicht, sagt die Zeile genau das. Und
//    weil "zuletzt geholt" der wunde Punkt dieses Vergleichs ist, nennt die Zeile seit dem
//    16.08.2026 IMMER das Alter der Fernreferenz und schlägt an, wenn es über einer Stunde liegt.
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
    // Wie ALT ist die Fernreferenz, gegen die hier verglichen wird? Ohne diese Zahl ist ein
    // "0 Commit(s) hinterher" wertlos - es sagt nur, dass HEAD auf dem Stand des LETZTEN Holens
    // steht, und das kann Stunden her sein. Gemessen am 16.08.2026: FETCH_HEAD war zehn Stunden alt,
    // die Zeile meldete "auf Höhe von origin/master", und der Klon stand in Wahrheit DREI Commits
    // zurück (#108-#110). Damit gab ausgerechnet die Prüfung, die Arbeitsregel 22 maschinell
    // absichern soll, in ihrem eigenen Fehlerfall Entwarnung - dieselbe Familie wie Regel 15/17/19:
    // ein Messwerkzeug, das sich selbst im Weg steht.
    // Gemessen wird FETCH_HEAD, weil git die Datei bei JEDEM `fetch` neu schreibt, auch wenn nichts
    // Neues kam. Die beiden Notnägel darunter sind gröber: `refs/remotes/<fern>` bewegt sich erst,
    // wenn die Fernreferenz wirklich vorrückt, und `packed-refs` erst recht selten (frisch geklonte
    // Repos haben ihre Fernrefs gepackt, die Einzeldatei fehlt dann ganz). Beide sind also
    // höchstens ZU ALT - sie melden lieber einmal zu viel als einmal zu wenig, und genau in diese
    // Richtung soll ein Notnagel irren. Deshalb steht bei ihnen "mindestens" in der Ausgabe.
    const HOLUNG_FRISCH_MS = 60 * 60 * 1000;
    const mtime = (relativ) => {
      const p = (git('rev-parse', '--git-path', relativ).stdout || '').trim();
      if (!p) return 0;
      try { return fs.statSync(path.resolve(backend, p)).mtimeMs; } catch (e) { return 0; }
    };
    const holung = mtime('FETCH_HEAD');
    const grob = Math.max(fern ? mtime('refs/remotes/' + fern) : 0, mtime('packed-refs'));
    const alterMs = holung ? Date.now() - holung : (grob ? Date.now() - grob : null);
    const dauer = (ms) => ms < 90 * 60 * 1000
      ? (Math.round(ms / 60000) === 1 ? '1 Minute' : Math.round(ms / 60000) + ' Minuten')
      : (ms / 3600000).toFixed(1).replace('.', ',') + ' Stunden';
    // Ein Satzteil, der in allen drei Meldungen unten ohne Nachbesserung passt - und der nie auf
    // einen Punkt endet, damit der Satz drumherum keinen zweiten daneben setzt.
    const seit = alterMs == null ? 'Zeitpunkt des letzten Holens unbekannt'
      : 'geholt vor ' + (holung ? '' : 'mindestens ') + dauer(alterMs);
    const nachholen = () => {
      console.log('        Erst `cd ../kolonie-kepler7-backend && git fetch && git pull origin master`,');
      console.log('        sonst prüfen die server.js-Tests gegen einen veralteten Nachbarn.');
    };
    if (!fern || !/^\d+$/.test(hinten)) {
      console.log('  ----  Backend-Klon: ' + kopf + ' (kein Vergleich möglich - noch nie geholt?)');
    } else if (Number(hinten) > 0) {
      console.log('  !!!!  Backend-Klon ist ' + hinten + ' Commit(s) HINTER ' + fern + ' (' + seit + '): ' + kopf);
      nachholen();
    } else if (alterMs == null || alterMs > HOLUNG_FRISCH_MS) {
      // Der Fall, für den diese Zeile 2026 dreimal gebraucht wurde - und zweimal Entwarnung gab.
      console.log('  !!!!  Backend-Klon auf Höhe von ' + fern + ', aber ' + fern + ' ist alt (' + seit + ').');
      console.log('        Der Vergleich sagt damit NICHTS über den echten Stand des Nachbarn.');
      nachholen();
    } else {
      console.log('  ----  Backend-Klon auf Höhe von ' + fern + ' (' + seit + ')'
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
    .filter(f => !nurNummer || NUMMER_TESTS.includes(f))
    .filter(f => !filter.length || filter.some(t => f.includes(t)))
    .sort();
  if (nurNummer){
    // Gegenprobe gegen eine still leere Auswahl: Wird eine dieser Dateien umbenannt, liefe der
    // Modus mit null Tests durch und meldete trotzdem "sauber" - genau die Sorte Messwerkzeug, das
    // sich selbst im Weg steht (CLAUDE.md-Arbeitsregeln 15/17/19).
    const fehlen = NUMMER_TESTS.filter(f => !fs.existsSync(path.join(__dirname, f)));
    melde('Nummern-Modus: alle vier Tests vorhanden', fehlen.length === 0, fehlen.join(', '));
  }

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
