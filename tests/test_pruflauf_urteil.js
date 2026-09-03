// Das Urteil des Prüflaufs - darf "Lastsymptom" nur sagen, wenn es das wissen kann (03.09.2026).
//
//   node tests/test_pruflauf_urteil.js
//
// ANLASS, an einem echten Lauf gemessen: pruflauf.js schließt aus "im Stück rot, einzeln grün" auf
// "Lastsymptom der Gleichzeitigkeit". Der Schluss stimmt nur, solange sich zwischen beiden
// Messungen nichts geändert hat. Am 03.09.2026 war das nicht so: test_paritaet_tabellen fiel um
// 19:15 (ein ECHTER Fehler - ein neues Verteidigungsgebäude fehlte im Backend), das Backend wurde
// um 19:22 im Nachbar-Klon korrigiert, die Nachprüfung lief danach und meldete "Lastsymptom".
//
// Das ist die gefährlichere Richtung: Ein falsches "echt rot" kostet eine Nachprüfung, ein falsches
// "Lastsymptom" verschweigt einen echten Fund - und dieses Skript entscheidet, ob ausgeliefert wird.
//
// GEPRÜFT WIRD (Funktion ausgeführt, nicht nur gegreppt):
//   1) weltAbdruck() gibt es, und er ändert sich, wenn sich die Spieldatei ändert.
//   2) Er ändert sich auch, wenn sich die server.js des Nachbar-Repos ändert - genau der Fall, der
//      den Fehlbefund erzeugt hat. Ohne diese Datei im Abdruck wäre der Test wertlos.
//   3) Beide Urteilsstellen hängen an weltUnveraendert, und der Abdruck wird VOR den Stücken und
//      erneut VOR der Nachprüfung genommen.
//
// GEGENPROBE, GEMESSEN (03.09.2026, `git show HEAD:pruflauf.js` als alter Stand):
//   Exit 1, es fallen GENAU VIER Prüfungen - 1a, 3a, 3b und 3d. Grün bleiben 0a und 3c.
//   1b bis 2b laufen dort gar nicht: Ohne weltAbdruck() greift das `if (quelle)`, und der ganze
//   ausgeführte Teil wird übersprungen. Das ist richtig so - eine Funktion, die es nicht gibt, kann
//   man nicht ausführen, und ein erfundener Ersatz würde nichts belegen.
//   3c bleibt grün, weil das Wort "Lastsymptom" auch vorher schon dreimal vorkam; erst 3d prüft,
//   ob die Urteilsstellen am Abdruck HÄNGEN - und meldet dort 3 ungesicherte.
//
//   ICH HATTE SECHS VORHERGESAGT und 1b/2a/3c auf der Liste, die gar nicht fallen. Vierte
//   Fehlprognose an einem Tag (siehe test_signatur, test_rangnamen, test_angriffssumme). Die Lehre
//   ist damit belegt statt vermutet: Die Liste wird GEMESSEN, nie geschätzt - und wer sie schätzt,
//   überschätzt regelmäßig, weil er die Abbruchpfade des eigenen Tests vergisst.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { WURZEL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const PFAD = path.join(WURZEL, 'pruflauf.js');
const SRC = fs.existsSync(PFAD) ? fs.readFileSync(PFAD, 'utf8') : '';
check('0a: pruflauf.js ist auffindbar', SRC.length > 2000, SRC.length);
if (!SRC) return ende();

// ---- 1+2: der Abdruck, ausgeführt gegen echte Dateien in einem Wegwerf-Verzeichnis -------------
const quelle = (() => {
  const a = SRC.indexOf('\nfunction weltAbdruck(){');
  if (a < 0) return null;
  const b = SRC.indexOf('\n}', a);
  return b < 0 ? null : SRC.slice(a + 1, b + 2);
})();
check('1a: weltAbdruck() ist auffindbar', !!quelle, quelle ? quelle.length : null);
if (quelle){
  // Eine ECHTE Ordnerstruktur statt gefälschter fs-Aufrufe: Der Abdruck liest zwei Dateien über
  // relative Pfade (../kolonie-kepler7-backend/server.js), und genau diese Wegfindung soll
  // mitgeprüft werden. Ein Mock würde sie überspringen.
  const basis = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-abdruck-'));
  const front = path.join(basis, 'kolonie-kepler7');
  const back = path.join(basis, 'kolonie-kepler7-backend');
  fs.mkdirSync(front); fs.mkdirSync(back);
  fs.writeFileSync(path.join(front, 'weltraum_kolonie.html'), 'spiel A');
  fs.writeFileSync(path.join(back, 'server.js'), 'server A');
  const bau = () => new Function('WURZEL, fs, path, crypto', quelle + '; return weltAbdruck;')(front, fs, path, crypto);

  const a1 = bau()();
  check('1b: der Abdruck ist eine kurze Kennung', typeof a1 === 'string' && a1.length >= 8, a1);
  const a2 = bau()();
  check('1c: derselbe Stand ergibt denselben Abdruck', a1 === a2, { a1, a2 });

  fs.writeFileSync(path.join(front, 'weltraum_kolonie.html'), 'spiel B');
  const nachSpiel = bau()();
  check('1d: eine geaenderte Spieldatei aendert den Abdruck', nachSpiel !== a1, { vorher: a1, nachher: nachSpiel });

  // DAS ist der Fall vom 03.09.2026: Nicht die Spieldatei hat sich geaendert, sondern der Nachbar.
  // Ohne server.js im Abdruck waere dieser Test gruen und der Fehlbefund weiterhin moeglich.
  fs.writeFileSync(path.join(back, 'server.js'), 'server B');
  const nachBackend = bau()();
  check('2a: eine geaenderte Nachbar-server.js aendert den Abdruck ebenfalls',
    nachBackend !== nachSpiel, { vorher: nachSpiel, nachher: nachBackend });

  // Fehlt eine der Dateien, darf der Abdruck nicht werfen - sonst faellt der ganze Prueflauf aus,
  // nur weil das Nachbar-Repo nicht danebenliegt (im CI-Klon der Normalfall).
  fs.rmSync(path.join(back, 'server.js'));
  let geworfen = false;
  try { bau()(); } catch (e) { geworfen = true; }
  check('2b: eine fehlende Datei laesst den Abdruck nicht werfen', !geworfen);
  fs.rmSync(basis, { recursive: true, force: true });
}

// ---- 3: die Urteilsstellen haengen wirklich am Abdruck -----------------------------------------
check('3a: der Abdruck wird vor den Stuecken genommen', /const abdruckVorher = weltAbdruck\(\);/.test(SRC));
check('3b: und vor der Nachpruefung erneut',
  /const abdruckNachher = weltAbdruck\(\);[\s\S]{0,120}weltUnveraendert = abdruckNachher === abdruckVorher/.test(SRC));
// Beide Stellen, an denen das Wort "Lastsymptom" faellt, muessen am Abdruck haengen. Geprueft wird
// die AUSSAGE: In der Naehe jedes Vorkommens steht weltUnveraendert.
const stellen = [...SRC.matchAll(/Lastsymptom/g)].map(m => m.index);
check('3c: das Wort "Lastsymptom" faellt nur im Urteil und im Kommentar', stellen.length >= 2, stellen.length);
const ungesichert = stellen.filter(i => {
  const um = SRC.slice(Math.max(0, i - 700), i + 700);
  return um.includes('console.log') && !um.includes('weltUnveraendert');
});
check('3d: jede Urteilsstelle mit "Lastsymptom" haengt an weltUnveraendert',
  ungesichert.length === 0, ungesichert.length);

ende();
