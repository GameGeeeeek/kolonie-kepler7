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
// GEPRÜFT WIRD — Funktionen ausgeführt, nicht gegreppt:
//   1) `ampelStand()` gegen ein ECHTES Wegwerf-Git mit echtem `origin`. Die Funktion setzt fetch,
//      rev-parse und einen Drei-Punkt-Diff hintereinander; ein Mock beantwortete nur, ob ich mir
//      die Kommandos richtig gemerkt habe. Mit der Gegenrichtung (ein fremder Merge OHNE die
//      Spieldatei entwertet nichts — sonst wäre es eine Ampel, die immer rot sagt) und dem Ausfall
//      ohne `origin`.
//   2) `ampelUrteil()` mit allen 32 Eingabekombinationen. Der zitierfähige Satz „kein fremder
//      Merge" darf in keiner anderen Lage fallen, und „das Urteil gilt" in keiner entwerteten.
//   3) Der Exit-Ausdruck, aus der Datei geschnitten und mit allen vier Kombinationen ausgewertet.
//
// WARUM NICHT ÜBER TEXTNÄHE: Der erste Entwurf prüfte „steht `ampelNachher` in der Nähe des
// Satzes?" — ein Fenster über dem Quelltext. Die adversarische Durchsicht hat es in BEIDE
// Richtungen widerlegt: grün, als der Satz in den nicht-messbaren Zweig verschoben wurde (der
// verbotene Fall), und rot, als ein Kommentar daneben um sechs harmlose Zeilen wuchs. Deshalb ist
// das Urteil jetzt eine reine Funktion — dieselbe Bauform wie `_build_ask_prompt` im AI-Core-Repo.
//
// GEGENPROBE, GEMESSEN gegen `git show origin/main:pruflauf.js` (Stand b514281, vor dem Einbau):
//   Exit 1, es fallen GENAU DREI — und alle drei sind Anker: 0b, 5-anker, 6-anker. Alles andere
//   läuft dort nicht, weil es die Funktionen nicht gibt. Das ist richtig so, belegt aber wenig über
//   die REGELN. Deshalb daneben drei gezielte Sabotagen am neuen Stand, jede mit genau einem
//   Treffer gemessen:
//     `if (!weltUnveraendert)` abgeschaltet          -> FAIL 5c
//     `zusatz` bedingungslos auf „das Urteil gilt"   -> FAIL 5j
//     `process.exit(testCode || 0)`                  -> FAIL 6b
//   Jede Regel hängt damit an genau der Prüfung, die sie bewachen soll — und keine an zweien,
//   was eine Sabotage sonst schwer zuzuordnen macht.
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
  /* Ein fehlgeschlagenes Einrichtungskommando darf nicht als Fehler der GEPRUEFTEN Funktion
     erscheinen: Ohne diese Meldung sieht ein `commit.gpgsign=true` ohne Schluessel wie ein Defekt
     in ampelStand() aus ("liefert null"), und man sucht an der falschen Stelle. */
  const einrichtungsfehler = [];
  const G = (cwd, ...a) => {
    const r = spawnSync('git', ['-c','user.email=t@t','-c','user.name=T', ...a], { cwd, encoding:'utf8' });
    if (r.status !== 0) einrichtungsfehler.push(a.slice(0,2).join(' ') + ': ' + String(r.stderr || r.error).trim().slice(0,90));
    return r;
  };
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

  check('0c: die Wegwerf-Repos liessen sich einrichten', einrichtungsfehler.length === 0, einrichtungsfehler);

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

// ---- 5) Das Urteil, ausgefuehrt ueber alle Eingaben ---------------------------------------------
/* Hier stand im ersten Entwurf eine NAEHERUNG: "steht das Wort ampelNachher in der Naehe des
   Satzes?" - ein Textfenster ueber dem Quelltext. Die adversarische Durchsicht hat sie gemessen
   widerlegt, und zwar in BEIDE Richtungen: Sie blieb gruen, als der Satz versuchsweise in den
   nicht-messbaren Zweig verschoben wurde (also genau im verbotenen Fall), und sie wurde rot, als
   ein Kommentar daneben um sechs harmlose Zeilen wuchs. Beides ist die Sorte Pruefung, vor der
   docs/PROJECT_MEMORY.md warnt: Sie haelt eine Schreibweise fest, nicht die Sache.
   Deshalb ist das Urteil jetzt eine REINE FUNKTION, und sie wird mit allen Eingaben AUFGERUFEN. */
const urteilQuelle = schneide('function ampelUrteil({ vorher, nachher, weltUnveraendert, ampelAn }){');
check('5-anker: ampelUrteil() ist auffindbar', !!urteilQuelle, urteilQuelle ? urteilQuelle.length : null);
if (urteilQuelle){
  const urteil = new Function('AMPEL_ZWEIG, AMPEL_DATEI',
    urteilQuelle + '; return ampelUrteil;')('main', 'weltraum_kolonie.html');
  const A = { sha:'aaaaaaa', spieldateiVoraus:false };
  const B = { sha:'bbbbbbb', spieldateiVoraus:false };
  const MIT = { sha:'ccccccc', spieldateiVoraus:true };
  const txt = u => u.zeilen.join(' ');

  const still = urteil({ vorher:A, nachher:A, weltUnveraendert:true, ampelAn:true });
  check('5: nichts bewegt sich - nicht entwertet, und der Satz faellt',
    still.entwertet === false && /kein fremder Merge/.test(txt(still)), still);

  const voraus = urteil({ vorher:A, nachher:MIT, weltUnveraendert:true, ampelAn:true });
  check('5b: fremde Aenderung an der Spieldatei - ENTWERTET', voraus.entwertet === true, voraus);

  /* Der Fund, den die Durchsicht aufgedeckt hat: weltAbdruck() mass die lokale Aenderung seit
     v8.662.0, aber das Ergebnis floss nur in die Formulierung - nie in den Exit-Code, und nur bei
     einem roten Test ueberhaupt. Ein Lauf, in dem jemand die Spieldatei anfasst, war gruen. */
  const lokal = urteil({ vorher:A, nachher:A, weltUnveraendert:false, ampelAn:true });
  check('5c: die LOKALE Welt hat sich geaendert - ebenfalls entwertet', lokal.entwertet === true, lokal);

  /* Wir waren online und wissen es jetzt nicht mehr. "Offen" darf nicht wie "in Ordnung" aussehen. */
  const verloren = urteil({ vorher:A, nachher:null, weltUnveraendert:true, ampelAn:true });
  check('5d: Schlussmessung misslungen NACH gelungener Anfangsmessung - entwertet',
    verloren.entwertet === true, verloren);

  /* Durchgehend offline: Das wurde beim Start gesagt, der Lauf bleibt beim Urteil der Tests. */
  const blind = urteil({ vorher:null, nachher:null, weltUnveraendert:true, ampelAn:true });
  check('5e: durchgehend nicht messbar - NICHT entwertet (der Start hat es gesagt)',
    blind.entwertet === false, blind);

  /* Die haeufigste Falle, und die Durchsicht hat sie gefunden: origin/main bewegt sich, ohne die
     Spieldatei anzufassen. Das entwertet nichts - aber "kein fremder Merge" waere schlicht falsch.
     Wer den Satz spaeter im PR zitiert, soll das Richtige zitieren. */
  const daneben = urteil({ vorher:A, nachher:B, weltUnveraendert:true, ampelAn:true });
  check('5f: main bewegte sich ohne die Spieldatei - nicht entwertet',
    daneben.entwertet === false, daneben);
  check('5g: und der Satz "kein fremder Merge" faellt dort NICHT',
    !/kein fremder Merge/.test(txt(daneben)), txt(daneben));

  /* DIE ZENTRALE ZUSAGE, als Regel ueber ALLE Eingaben statt als Textfenster: Der zitierfaehige
     Satz darf nur fallen, wenn wirklich gemessen wurde UND sich nichts bewegt hat. */
  const alle = [];
  for (const v of [null, A]) for (const n of [null, A, B, MIT]) for (const w of [true, false]) for (const an of [true, false])
    alle.push({ ein:{ vorher:v, nachher:n, weltUnveraendert:w, ampelAn:an }, aus: urteil({ vorher:v, nachher:n, weltUnveraendert:w, ampelAn:an }) });
  const unerlaubt = alle.filter(f => /kein fremder Merge/.test(txt(f.aus))
    && !(f.ein.ampelAn && f.ein.nachher && !f.ein.nachher.spieldateiVoraus
         && (!f.ein.vorher || f.ein.vorher.sha === f.ein.nachher.sha)));
  /* Und die zweite Haelfte derselben Zusage, gefunden weil die Ausgabe von 5c sie verletzte:
     "das Urteil gilt" darf in KEINER Lage stehen, in der der Lauf entwertet ist. Der erste Entwurf
     schrieb woertlich "DER LAUF IST ENTWERTET" und zwei Zeilen darunter "das Urteil gilt". */
  const widerspruch = alle.filter(f => f.aus.entwertet && /das Urteil gilt/.test(txt(f.aus)));
  check('5j: "das Urteil gilt" steht in keiner entwerteten Lage', widerspruch.length === 0,
    widerspruch.map(f => txt(f.aus).slice(0, 120)));
  check('5h: der Satz faellt in KEINER anderen Lage (32 Eingaben durchgespielt)',
    unerlaubt.length === 0, unerlaubt.map(f => f.ein));
  check('5i: und in der erlaubten Lage faellt er wirklich (sonst waere 5h leer-gruen)',
    alle.some(f => /kein fremder Merge/.test(txt(f.aus))), true);
}

// ---- 6) Der Exit-Code, ebenfalls ausgefuehrt ----------------------------------------------------
/* Die eine Zeile, um die es geht, wird aus der Datei GESCHNITTEN und mit allen vier Kombinationen
   ausgewertet - nicht mit einem Regex bestaetigt. Ein Regex haette auch dann gepasst, wenn
   `entwertet` nirgends mehr gesetzt wuerde. */
const exitAusdruck = (SRC.match(/process\.exit\((testCode [^\n]*?)\);/) || [])[1];
check('6-anker: der Exit-Ausdruck ist auffindbar', !!exitAusdruck, exitAusdruck);
if (exitAusdruck){
  const werte = (t, e) => new Function('testCode, urteil', 'return ' + exitAusdruck + ';')(t, { entwertet: e });
  check('6: alles in Ordnung -> 0', werte(0, false) === 0, werte(0, false));
  check('6b: Lauf entwertet, Tests gruen -> 2', werte(0, true) === 2, werte(0, true));
  check('6c: echter Testfehler -> 1', werte(1, false) === 1, werte(1, false));
  /* Der Testfehler ist das schwerere Urteil: Wuerde die Ampel ihn ueberschreiben, meldete ein Lauf
     mit echtem Fehler UND fremdem Merge nur noch "entwertet" - der Fehler ginge im Rauschen unter. */
  check('6d: beides zugleich -> der Testfehler gewinnt', werte(1, true) === 1, werte(1, true));
}

ende();
