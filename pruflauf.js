#!/usr/bin/env node
/*
 * Der Prüflauf, in Stücken und gleichzeitig.
 *
 * WARUM ES DIESES SKRIPT GIBT (03.09.2026)
 * ----------------------------------------
 * `node tests/run.js` braucht gemessen 91 Minuten für 332 Tests. In derselben Zeit landen bei
 * paralleler Arbeit ein bis zwei fremde Merges auf `main` - und jeder, der `weltraum_kolonie.html`
 * anfasst, entwertet den Lauf. Am 03.09.2026 musste derselbe Änderungssatz deshalb FÜNFMAL neu
 * geprüft werden; ausgeliefert war er am Ende trotzdem nicht.
 *
 * Gemessen an einem vollständigen Lauf: 107 der 332 Tests brauchen 0 s (reine Quelltext-Tests),
 * 54 brauchen 30 s und mehr. Die Zeit steckt fast vollständig in Browser-Tests, die WARTEN
 * (`waitForTimeout`) - sie belegen kaum Rechenzeit. Genau solche Tests laufen nebeneinander fast
 * gratis. Das ist der ganze Trick hier; es wird nichts übersprungen und nichts abgeschwächt.
 *
 * ZWEI EIGENSCHAFTEN, die den Unterschied machen:
 *
 *   1. GLEICHZEITIG. Mehrere Stücke laufen nebeneinander. Der Vorgabewert 4 ist gemessen, nicht
 *      geraten - siehe docs/TESTING.md.
 *   2. FORTSETZBAR. Jedes fertige Stück hinterlässt eine Marke mit seinem Exit-Code. Ein Abbruch
 *      (Container-Neustart, fremder Merge) kostet damit ein Stück, nicht den ganzen Lauf.
 *
 * DIE VERTEILUNG IST REIHUM, nicht blockweise: Alphabetische Blöcke sammeln die langsamen Tests
 * (test_wiedergabe_*, test_admin_*) in wenigen Stücken, und dann wartet alles auf das langsamste.
 * Reihum mischt schnelle und langsame Tests in jedes Stück.
 *
 * AUFRUF:
 *   node pruflauf.js                    alle Tests, 4 gleichzeitig
 *   node pruflauf.js --gleichzeitig 6   mehr Stücke nebeneinander
 *   node pruflauf.js --fortsetzen       fertige Stücke überspringen (nach einem Abbruch)
 *   node pruflauf.js --nur-pflicht      reicht direkt an tests/run.js durch (Sekunden)
 *
 * EXIT-CODE: 0 nur, wenn JEDES Stück 0 geliefert hat. Der Exit-Code entscheidet, nicht die
 * Ausgabe - ein Absturz passt auf kein FAIL-Muster (CLAUDE.md).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const WURZEL = __dirname;
const argumente = process.argv.slice(2);

// --nur-pflicht und --nummer sind Sache von tests/run.js - hier nur durchreichen, damit niemand
// zwei Aufrufwege im Kopf behalten muss.
if (argumente.includes('--nur-pflicht') || argumente.includes('--nummer')) {
  const kind = spawn(process.execPath, [path.join(WURZEL, 'tests', 'run.js'), ...argumente], { stdio: 'inherit' });
  kind.on('exit', code => process.exit(code === null ? 1 : code));
  return;
}

const zahlNach = (flag, standard) => {
  const i = argumente.indexOf(flag);
  if (i < 0) return standard;
  const n = parseInt(argumente[i + 1], 10);
  return Number.isFinite(n) && n > 0 ? n : standard;
};
const GLEICHZEITIG = zahlNach('--gleichzeitig', 4);
const FORTSETZEN = argumente.includes('--fortsetzen');

const ABLAGE = path.join(os.tmpdir(), 'kepler-pruflauf');
fs.mkdirSync(ABLAGE, { recursive: true });

const alle = fs.readdirSync(path.join(WURZEL, 'tests'))
  .filter(f => f.endsWith('.js') && f !== 'run.js')
  .sort();

/* Reihum verteilen. Die Zuordnung haengt NUR an der sortierten Liste und der Stueckzahl - zwei
   Aufrufe mit denselben Dateien ergeben dieselben Stuecke, sonst waere `--fortsetzen` eine Falle. */
const stuecke = Array.from({ length: GLEICHZEITIG }, () => []);
alle.forEach((f, i) => stuecke[i % GLEICHZEITIG].push(f));

const marke = i => path.join(ABLAGE, 'fertig_' + i);
const protokoll = i => path.join(ABLAGE, 'lauf_' + i + '.txt');

if (!FORTSETZEN) {
  for (let i = 0; i < 64; i++) { try { fs.unlinkSync(marke(i)); } catch (e) {} }
}

console.log('Prüflauf: ' + alle.length + ' Testdateien in ' + GLEICHZEITIG + ' Stücken, gleichzeitig.');
console.log('Ablage: ' + ABLAGE);

function starte(i) {
  return new Promise(fertig => {
    if (FORTSETZEN && fs.existsSync(marke(i))) {
      const code = parseInt(fs.readFileSync(marke(i), 'utf8').trim(), 10);
      console.log('  Stück ' + i + ' war schon fertig (EXIT=' + code + ')');
      return fertig({ i, code, uebersprungen: true });
    }
    const start = Date.now();
    const aus = fs.openSync(protokoll(i), 'w');
    const kind = spawn(process.execPath, [path.join(WURZEL, 'tests', 'run.js'), ...stuecke[i]],
      { cwd: WURZEL, stdio: ['ignore', aus, aus] });
    kind.on('exit', code => {
      try { fs.closeSync(aus); } catch (e) {}
      const c = code === null ? 1 : code;
      fs.writeFileSync(marke(i), String(c));
      const dauer = Math.round((Date.now() - start) / 1000);
      console.log('  Stück ' + i + ' fertig: EXIT=' + c + ' (' + stuecke[i].length + ' Dateien, ' + dauer + 's)');
      fertig({ i, code: c, dauer });
    });
  });
}

(async () => {
  const start = Date.now();
  const ergebnisse = await Promise.all(stuecke.map((_, i) => starte(i)));
  const rot = ergebnisse.filter(e => e.code !== 0);

  // Die Zahlen aus den Teilprotokollen zusammenziehen. Gezaehlt wird, was die Stuecke selbst
  // gemeldet haben - nicht nachgerechnet.
  let pruefungen = 0, fehlgeschlagen = 0;
  const roteZeilen = [];
  for (let i = 0; i < stuecke.length; i++) {
    let txt = '';
    try { txt = fs.readFileSync(protokoll(i), 'utf8'); } catch (e) { continue; }
    const m = txt.match(/(\d+) Prüfungen, (\d+) fehlgeschlagen/);
    if (m) { pruefungen += parseInt(m[1], 10); fehlgeschlagen += parseInt(m[2], 10); }
    for (const z of txt.split('\n')) if (/^ {2}FAIL /.test(z)) roteZeilen.push(z.trim());
  }

  console.log('\n=== Ergebnis ===');
  console.log(pruefungen + ' Prüfungen, ' + fehlgeschlagen + ' fehlgeschlagen');
  if (roteZeilen.length) {
    console.log('\nRote Tests:');
    for (const z of roteZeilen) console.log('  ' + z);
    console.log('\nDie Protokolle der Stücke liegen unter ' + ABLAGE + '.');
  }
  console.log('Dauer: ' + Math.round((Date.now() - start) / 1000) + 's');
  process.exit(rot.length ? 1 : 0);
})();
