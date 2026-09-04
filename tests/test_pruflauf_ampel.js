// Die Merge-Ampel des Prüflaufs (04.09.2026).
//
//   node tests/test_pruflauf_ampel.js
//
// ANLASS, gemessen am 04.09.2026: 25 der letzten 25 Merges nach `main` fassen die Spieldatei an,
// ihr Abstand liegt bei 31 bis 67 Minuten, ein Prüflauf dauert 35. Rechnerisch wird damit mehr als
// jeder zweite Lauf entwertet; ein einzelner Änderungssatz brauchte an diesem Tag VIER Anläufe.
// Die Regel dafür stand in CLAUDE.md („das wird gemessen, nicht vermutet") - gemessen hat es aber
// ein Mensch, hinterher, wenn er daran dachte. Eine Regel, an die man sich erinnern muss, ist bei
// einer regelmäßigen Aufgabe keine Absicherung (docs/PROJECT_MEMORY.md).
//
// GEPRÜFT WIRD (Funktionen ausgeführt, gegen ein ECHTES Wegwerf-Git mit echtem origin):
//   1) ampelStand() misst gegen origin/main und meldet die Spieldatei nur, wenn sie sich dort
//      wirklich bewegt hat.
//   2) Die Gegenrichtung: Ein fremder Merge, der die Spieldatei NICHT anfasst, entwertet nichts -
//      ohne diese Prüfung wäre eine Ampel grün, die einfach immer rot sagt.
//   3) Ohne origin liefert sie null und wirft nicht: Der LAUF fällt offen aus (eine Sicherung, die
//      bei einem Netzhänger 35 Minuten verweigert, wird abgeschaltet und sichert dann gar nichts).
//   4) Die AUSSAGE fällt geschlossen aus: Der Satz „kein fremder Merge" darf nur nach einer
//      gelungenen Messung fallen - das ist der Unterschied zu einer Sicherung, deren Ausfall wie
//      Normalbetrieb aussieht.
//   5) Ein echter Testfehler bleibt Code 1 und wird von der Ampel nicht überschrieben.
//
// GEGENPROBE, GEMESSEN (`git show HEAD:pruflauf.js` als alter Stand, vor dem Einbau):
//   Exit 1, es fallen GENAU DREI: 0b, 4a und 5. Die Prüfungen 1 bis 4 laufen dort gar nicht - ohne
//   ampelStand() greift das `if (quelle)`, und der ganze ausgeführte Teil wird übersprungen. Das
//   ist richtig so: Eine Funktion, die es nicht gibt, kann man nicht ausführen, und ein erfundener
//   Ersatz würde nichts belegen.
//
//   ICH HATTE ZWEI VORHERGESAGT (0b und 4b) und lag zweifach daneben: Prüfung 5 hatte ich
//   schlicht vergessen, und bei 4a/4b habe ich die Richtung verwechselt. Gemessen fällt 4a (der
//   Satz „kein fremder Merge" kommt am alten Stand NULLMAL vor), während 4b grün bleibt - denn
//   „keiner der Sätze ist ungesichert" ist bei null Sätzen wahr.
//   Genau dafür steht 4a daneben: 4b allein wäre an einem Werkzeug grün, das die Behauptung nie
//   aufstellt. Eine Prüfung, die eine leere Menge durchwinkt, belegt nichts - und man sieht es ihr
//   erst an, wenn man die Gegenprobe MISST statt sie zu schätzen (docs/PROJECT_MEMORY.md; dieselbe
//   Falle hat test_pruflauf_urteil.js am 03.09.2026 schon einmal gestellt).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { WURZEL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const PFAD = path.join(WURZEL, 'pruflauf.js');
const SRC = fs.existsSync(PFAD) ? fs.readFileSync(PFAD, 'utf8') : '';
check('0a: pruflauf.js ist auffindbar', SRC.length > 2000, SRC.length);
if (!SRC) return ende();

function schneide(kopf){
  const a = SRC.indexOf(kopf);
  if (a < 0) return null;
  const b = SRC.indexOf('\n}', a);
  return b < 0 ? null : SRC.slice(a, b + 2);
}
const quelle = (() => {
  const g = schneide('function git(args, sekunden){');
  const a = schneide('function ampelStand(){');
  return (g && a) ? (g + '\n' + a) : null;
})();
check('0b: git() und ampelStand() sind auffindbar', !!quelle, quelle ? quelle.length : null);

if (quelle){
  /* Ein ECHTES Git statt gefälschter spawnSync-Aufrufe: ampelStand() setzt fetch, rev-parse und
     einen Drei-Punkt-Diff hintereinander, und genau dieses Zusammenspiel soll gemessen werden.
     Ein Mock würde die Frage beantworten, ob ich mir die Kommandos richtig gemerkt habe. */
  const G = (cwd, ...a) => spawnSync('git', ['-c','user.email=t@t','-c','user.name=T', ...a],
    { cwd, encoding:'utf8' });
  const basis = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-ampel-'));
  const bare = path.join(basis, 'origin.git');
  const arbeit = path.join(basis, 'arbeit');
  const fremd = path.join(basis, 'fremd');
  G(basis, 'init', '--bare', '-b', 'main', bare);
  G(basis, 'clone', bare, arbeit);
  fs.writeFileSync(path.join(arbeit, 'weltraum_kolonie.html'), 'A');
  fs.writeFileSync(path.join(arbeit, 'liesmich.txt'), 'A');
  G(arbeit, 'add', '-A'); G(arbeit, 'commit', '-m', 'start'); G(arbeit, 'push', '-u', 'origin', 'main');
  G(basis, 'clone', bare, fremd);

  const bau = wurzel => new Function('WURZEL, spawnSync, AMPEL_ZWEIG, AMPEL_DATEI',
    quelle + '; return ampelStand;')(wurzel, spawnSync, 'main', 'weltraum_kolonie.html');

  // ---- 1) Nichts bewegt sich ------------------------------------------------------------------
  const ruhig = bau(arbeit)();
  check('1: bei stillem origin ist die Spieldatei nicht voraus',
    !!ruhig && ruhig.spieldateiVoraus === false, ruhig);
  check('1b: und die Messung nennt den Stand von origin', !!ruhig && /^[0-9a-f]{7}$/.test(ruhig.sha || ''), ruhig && ruhig.sha);

  // ---- 2) Der Anlassfall: fremder Merge an der Spieldatei --------------------------------------
  fs.writeFileSync(path.join(fremd, 'weltraum_kolonie.html'), 'B');
  G(fremd, 'add', '-A'); G(fremd, 'commit', '-m', 'fremde Spieldatei-Aenderung'); G(fremd, 'push', 'origin', 'main');
  const rot = bau(arbeit)();
  check('2: eine fremde Aenderung an der Spieldatei wird gemeldet',
    !!rot && rot.spieldateiVoraus === true, rot);
  check('2b: und der Stand von origin hat sich mitbewegt', !!rot && !!ruhig && rot.sha !== ruhig.sha,
    { vorher: ruhig && ruhig.sha, nachher: rot && rot.sha });

  // ---- 3) Gegenrichtung: ein fremder Merge OHNE die Spieldatei ----------------------------------
  /* Ohne diese Prüfung wäre eine Ampel grün, die einfach jeden fremden Merge rot meldet - und die
     würde nach dem dritten Fehlalarm abgeschaltet. Der Zweig holt den fremden Stand, damit nur
     noch die Textdatei den Unterschied macht. */
  G(arbeit, 'fetch', 'origin', 'main'); G(arbeit, 'merge', 'origin/main');
  fs.writeFileSync(path.join(fremd, 'liesmich.txt'), 'B');
  G(fremd, 'add', '-A'); G(fremd, 'commit', '-m', 'nur Doku'); G(fremd, 'push', 'origin', 'main');
  const harmlos = bau(arbeit)();
  check('3: ein fremder Merge OHNE die Spieldatei entwertet nichts',
    !!harmlos && harmlos.spieldateiVoraus === false, harmlos);

  // ---- 4) Ohne origin: null, und kein Wurf -------------------------------------------------------
  const ohne = path.join(basis, 'ohne');
  fs.mkdirSync(ohne);
  G(ohne, 'init', '-b', 'main', '.');
  fs.writeFileSync(path.join(ohne, 'weltraum_kolonie.html'), 'A');
  G(ohne, 'add', '-A'); G(ohne, 'commit', '-m', 'allein');
  let geworfen = false, ergebnis;
  try { ergebnis = bau(ohne)(); } catch (e) { geworfen = true; }
  check('4-anker: ein Repo ohne origin laesst die Messung nicht werfen', !geworfen);
  check('4: ohne origin liefert sie null (nicht "alles in Ordnung")', ergebnis === null, ergebnis);

  fs.rmSync(basis, { recursive: true, force: true });
}

// ---- 4a/4b) Die Aussage haengt an der Messung ---------------------------------------------------
/* Was diese beiden Prüfungen NICHT können: Sie lesen Quelltext und sehen nur die heutige
   Schreibweise. Ihr Zweck ist auch ein anderer - die AUSSAGE. Der Satz "kein fremder Merge" ist
   die einzige Stelle, an der das Werkzeug etwas behauptet, das ein Mensch danach im PR zitiert.
   Fiele er auch ohne Messung, wäre die Ampel genau die Sicherung, deren Ausfall wie Normalbetrieb
   aussieht. */
const saetze = [...SRC.matchAll(/kein fremder Merge/g)].map(m => m.index);
check('4a: das Werkzeug sagt "kein fremder Merge" ueberhaupt', saetze.length >= 1, saetze.length);
const ungesichert = saetze.filter(i => {
  const um = SRC.slice(Math.max(0, i - 900), i + 300);
  return um.includes('console.log') && !um.includes('ampelNachher');
});
check('4b: und zwar nur im Zweig einer gelungenen Messung', ungesichert.length === 0, ungesichert.length);

// ---- 5) Ein echter Testfehler bleibt Code 1 -----------------------------------------------------
/* Die Reihenfolge ist inhaltlich: Ein roter Test ist das schwerere Urteil. Würde die Ampel ihn
   überschreiben, meldete ein Lauf mit echtem Fehler und fremdem Merge nur noch "entwertet" - und
   der Fehler ginge im Rauschen unter. */
check('5: der Testfehler-Code 1 wird von der Ampel nicht ueberschrieben',
  /const testCode = [^\n]*;\s*\n\s*process\.exit\(testCode \|\| ampelHinweis\);/.test(SRC));

ende();
