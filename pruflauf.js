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
 *   node pruflauf.js --ohne-ampel       absichtlich auf altem Stand messen (sagt es in der Ausgabe)
 *
 * EXIT-CODE: 0 nur, wenn JEDES Stück 0 geliefert hat. Der Exit-Code entscheidet, nicht die
 * Ausgabe - ein Absturz passt auf kein FAIL-Muster (CLAUDE.md). Code 2 heißt: die Tests sagen
 * nichts Schlechtes, aber das Ergebnis ist trotzdem nicht verwendbar (siehe Ampel unten).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const WURZEL = __dirname;

/* WAS DIE NACHPRUEFUNG NICHT WEISS - Befund vom 03.09.2026, an einem echten Lauf gemessen.
   Die Nachpruefung unten schliesst aus "beim Stueck rot, einzeln gruen" auf "Lastsymptom". Dieser
   Schluss stimmt nur, solange sich zwischen beiden Messungen NICHTS geaendert hat. An diesem Tag
   war das nicht so: test_paritaet_tabellen fiel in Stueck 1 um 19:15 (ein echter Fehler - ein neues
   Verteidigungsgebaeude fehlte im Backend), das Backend wurde um 19:22 im Nachbar-Klon korrigiert,
   und die Nachpruefung lief danach. Sie meldete "war ein Lastsymptom der Gleichzeitigkeit" - und
   war damit sachlich falsch. Der Test war gruen, weil der Fehler behoben war.
   Das ist die gefaehrlichere Richtung: Ein falsches "echt rot" kostet eine Nachpruefung, ein
   falsches "Lastsymptom" verschweigt einen echten Fund.
   Das Skript nimmt deshalb einen Fingerabdruck der beiden Dateien, von denen die Tests abhaengen
   und die es nicht selbst kontrolliert - die Spieldatei und die server.js des Nachbar-Repos - und
   vergleicht ihn vor der Nachpruefung erneut. Weicht er ab, faellt das Wort "Lastsymptom" weg. */
function weltAbdruck(){
  const h = crypto.createHash('sha1');
  for (const f of [path.join(WURZEL, 'weltraum_kolonie.html'),
                   path.join(WURZEL, '..', 'kolonie-kepler7-backend', 'server.js')]){
    try { h.update(f + ':' + fs.statSync(f).size + ':'); h.update(fs.readFileSync(f)); }
    catch (e) { h.update(f + ':fehlt:'); }
  }
  return h.digest('hex').slice(0, 12);
}

/* DIE AMPEL - was bisher eine Regel im Kopf war (04.09.2026).
   ------------------------------------------------------------------------------------------------
   Warum es sie gibt, mit den gemessenen Zahlen: docs/TESTING.md, Abschnitt "Die Merge-Ampel".
   Hier steht nur, was man beim Anfassen des Codes wissen muss.

   ZWEI MESSUNGEN. Vorher: Steht origin/main mit einer Aenderung an der Spieldatei voraus, ist der
   Lauf schon beim Start wertlos - er wird gar nicht erst gefahren. Nachher: Bewegt sich origin/main
   waehrend des Laufs an der Spieldatei, ist das Urteil hin.

   WARUM HIER GEFETCHT WIRD, obwohl tests/run.js ausdruecklich das Gegenteil entscheidet
   ("Bewusst OHNE `git fetch`: Der Prueflauf soll nicht ans Netz", run.js beim Nachbar-Klon):
   Die beiden beantworten verschiedene Fragen. Der Nachbar-Vergleich fragt "ist mein Klon alt?" -
   darauf antwortet eine alte Fernreferenz ehrlich, solange sie ihr Alter nennt. Die Ampel fragt
   "hat sich main in den letzten 35 Minuten bewegt?" - darauf antwortet eine neun Stunden alte
   Referenz gar nicht. Ohne Netz faellt sie deshalb auf "nicht messbar" zurueck und sagt das.

   WAS FAIL-OPEN IST UND WAS FAIL-CLOSED: Der LAUF faellt offen aus (kein Netz -> es wird trotzdem
   geprueft; eine Sicherung, die bei einem Netzhaenger 35 Minuten verweigert, wird abgeschaltet).
   Die AUSSAGE faellt geschlossen aus - siehe ampelUrteil(). */
const AMPEL_ZWEIG = 'main';
const AMPEL_DATEI = 'weltraum_kolonie.html';

function git(args, sekunden){
  try {
    const r = spawnSync('git', args, { cwd: WURZEL, encoding: 'utf8', timeout: (sekunden || 20) * 1000 });
    if (r.error || r.status !== 0) return null;
    return r.stdout;
  } catch (e) { return null; }
}

/* Liefert { sha, spieldateiVoraus } - oder null, wenn nicht gemessen werden konnte. null ist ein
   eigener Zustand und ausdruecklich NICHT dasselbe wie "alles in Ordnung". */
function ampelStand(){
  if (git(['fetch', 'origin', AMPEL_ZWEIG], 20) === null) return null;
  const sha = git(['rev-parse', 'origin/' + AMPEL_ZWEIG]);
  const diff = git(['diff', '--name-only', 'HEAD...origin/' + AMPEL_ZWEIG]);
  if (sha === null || diff === null) return null;
  return {
    sha: sha.trim().slice(0, 7),
    spieldateiVoraus: diff.split('\n').some(z => z.trim() === AMPEL_DATEI)
  };
}

/* DAS URTEIL ALS REINE FUNKTION - der Grund dafuer ist eine gemessene Fehlkonstruktion.
   Der erste Entwurf traf diese Entscheidung inline im Ablauf. Der Test konnte sie dann nur ueber
   die NAEHE von Textstellen im Quelltext erraten ("steht 'ampelNachher' in der Naehe des Satzes?"),
   und diese Naeherung war in BEIDE Richtungen falsch: Sie blieb gruen, als der Satz versuchsweise
   in den nicht-messbaren Zweig verschoben wurde - also genau im verbotenen Fall -, und sie wurde
   rot, als ein Kommentar daneben um sechs harmlose Zeilen wuchs. Eine reine Funktion laesst sich
   stattdessen mit allen Eingaben AUFRUFEN; tests/test_pruflauf_ampel.js tut das.

   Sie bekommt alles, was das Urteil braucht, und liest nichts selbst:
     vorher/nachher   Ergebnis von ampelStand() (oder null)
     weltUnveraendert Fingerabdruck der lokalen Dateien, aus weltAbdruck()
     ampelAn          false bei --ohne-ampel

   VIER GRUENDE, aus denen ein Lauf entwertet ist - der erste war vor dem 04.09.2026 gar keiner:
     1. Die LOKALE Welt hat sich waehrend des Laufs geaendert (Spieldatei oder Nachbar-server.js).
        weltAbdruck() misst das seit v8.662.0, aber das Ergebnis floss NUR in die Formulierung der
        Nachpruefung - nie in den Exit-Code, und nur dann, wenn ueberhaupt ein Test rot war. Ein
        Lauf, in dem jemand die Spieldatei anfasst, war also gruen und still.
     2. origin/main ist jetzt mit der Spieldatei voraus.
     3. Die Schlussmessung ist misslungen, OBWOHL die Anfangsmessung gelang - wir waren online und
        wissen es jetzt nicht mehr. War schon der Anfang nicht messbar, wurde das beim Start
        gesagt, und der Lauf bleibt bei dem Urteil, das die Tests faellen.
     4. (kein eigener Grund, aber die haeufigste Falle) origin/main hat sich bewegt, OHNE die
        Spieldatei anzufassen. Das entwertet nichts - und deshalb darf hier auch nicht der Satz
        "kein fremder Merge" stehen, der etwas Staerkeres behauptet als gemessen wurde. */
function ampelUrteil({ vorher, nachher, weltUnveraendert, ampelAn }){
  const zeilen = [];
  let entwertet = false;

  if (!weltUnveraendert) {
    zeilen.push('DER LAUF IST ENTWERTET: Spieldatei oder die server.js des Nachbar-Repos haben sich');
    zeilen.push('WAEHREND des Laufs geaendert. Die Stuecke haben verschiedene Staende gemessen.');
    entwertet = true;
  }

  if (!ampelAn) {
    zeilen.push('Ampel: abgeschaltet (--ohne-ampel) - dieser Lauf sagt NICHTS ueber fremde Merges.');
    return { zeilen, entwertet };
  }
  if (!nachher) {
    if (vorher) {
      zeilen.push('DER LAUF IST ENTWERTET: origin/' + AMPEL_ZWEIG + ' war am Ende nicht mehr messbar,');
      zeilen.push('obwohl es am Anfang ging. Ob jemand dazwischen gemergt hat, ist damit OFFEN - und');
      zeilen.push('"offen" darf hier nicht wie "in Ordnung" aussehen. Von Hand pruefen:');
      zeilen.push('  git fetch origin ' + AMPEL_ZWEIG + ' && git diff --name-only HEAD...origin/' + AMPEL_ZWEIG);
      entwertet = true;
    } else {
      zeilen.push('Ampel: origin/' + AMPEL_ZWEIG + ' war durchgehend nicht messbar (kein Netz oder kein origin).');
      zeilen.push('       Dieser Lauf sagt nichts ueber fremde Merges - vor dem Merge von Hand pruefen.');
    }
    return { zeilen, entwertet };
  }
  if (nachher.spieldateiVoraus) {
    zeilen.push('DER LAUF IST ENTWERTET: origin/' + AMPEL_ZWEIG + ' steht jetzt auf ' + nachher.sha
      + ' und hat ' + AMPEL_DATEI);
    zeilen.push('waehrend des Laufs geaendert. Gemessen wurde ein Stand, den es nicht mehr gibt.');
    zeilen.push('');
    zeilen.push('  git merge origin/' + AMPEL_ZWEIG + '   und neu laufen lassen');
    entwertet = true;
    return { zeilen, entwertet };
  }
  /* "Das Urteil gilt" darf hier nur stehen, wenn es das auch tut. Ist der Lauf schon aus einem
     ANDEREN Grund entwertet (die lokale Welt hat sich bewegt), stand im ersten Entwurf woertlich
     "DER LAUF IST ENTWERTET" und zwei Zeilen darunter "das Urteil gilt" - ein Widerspruch in
     derselben Ausgabe. Die Ampel sagt dann nur noch, was SIE gesehen hat, und behauptet nichts
     ueber die Gueltigkeit. */
  const zusatz = entwertet ? ' (der Lauf ist trotzdem entwertet, siehe oben)' : ' - das Urteil gilt';
  if (vorher && vorher.sha !== nachher.sha) {
    /* Die genaue Aussage. "Kein fremder Merge" waere hier schlicht falsch - es gab einen, er hat
       nur die Spieldatei nicht angefasst. Wer den Satz spaeter im PR zitiert, soll das Richtige
       zitieren. */
    zeilen.push('Ampel: origin/' + AMPEL_ZWEIG + ' bewegte sich von ' + vorher.sha + ' nach ' + nachher.sha
      + ', aber NICHT an ' + AMPEL_DATEI + zusatz + '.');
    return { zeilen, entwertet };
  }
  zeilen.push('Ampel: kein fremder Merge waehrend des Laufs' + zusatz
    + (entwertet ? '.' : ' fuer origin/' + AMPEL_ZWEIG + ' ' + nachher.sha + '.'));
  return { zeilen, entwertet };
}

const argumente = process.argv.slice(2);

/* Der Abbruch vor dem Lauf. Eigene Funktion, weil ihn ZWEI Wege brauchen: der volle Lauf und die
   Durchreichung von --nummer. Letzteres ist die Abschlusspruefung nach der Nummernvergabe, also die
   LETZTE Messung vor dem Merge - CLAUDE.md sagt dort ausdruecklich "main in diesem Moment nochmal
   ansehen". Der erste Entwurf schuetzte nur den 35-Minuten-Lauf und liess ausgerechnet die
   14-Sekunden-Pruefung unmittelbar vor der Auslieferung ungeschuetzt.
   --nur-pflicht bleibt bewusst frei: Das ist die Zwischenpruefung waehrend der Arbeit, mehrmals je
   Aenderung, und ein Netzzugriff je Tastendruck waere dort nur Bremse. */
function ampelAbbruchWennVoraus(stand){
  if (!stand || !stand.spieldateiVoraus) return;
  console.log('ABBRUCH: origin/' + AMPEL_ZWEIG + ' (' + stand.sha + ') hat ' + AMPEL_DATEI + ' geaendert,');
  console.log('dieser Zweig kennt die Aenderung noch nicht. Ein Lauf darauf misst einen Stand, den es');
  console.log('nicht mehr gibt.');
  console.log('');
  console.log('  git merge origin/' + AMPEL_ZWEIG);
  console.log('');
  console.log('Sind noch Aenderungen offen, lehnt git den Merge ab ("local changes would be');
  console.log('overwritten") - dann erst committen oder stashen. Der Prueflauf laeuft laut CLAUDE.md');
  console.log('VOR dem Commit, dieser Fall ist also der Normalfall, nicht die Ausnahme.');
  console.log('');
  console.log('(Absichtlich auf altem Stand messen: --ohne-ampel)');
  process.exit(2);
}

// --nur-pflicht und --nummer sind Sache von tests/run.js - hier nur durchreichen, damit niemand
// zwei Aufrufwege im Kopf behalten muss.
if (argumente.includes('--nur-pflicht') || argumente.includes('--nummer')) {
  if (argumente.includes('--nummer') && !argumente.includes('--ohne-ampel')) ampelAbbruchWennVoraus(ampelStand());
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
const AMPEL_AN = !argumente.includes('--ohne-ampel');

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

/* DER FINGERABDRUCK - ohne ihn ist `--fortsetzen` eine Falle (Review-Befund 03.09.2026).
   Eine Marke sagte bisher nur "Stueck 3 war fertig, EXIT=0". Womit, stand nirgends. Nach einer
   Aenderung an der Spieldatei, einem Merge, einer anderen `--gleichzeitig`-Zahl oder einem zweiten
   Checkout auf demselben Rechner beschreibt dieselbe Marke eine ANDERE Dateimenge - und ein alter
   Exit-Code 0 laesst den Lauf gruen melden, ohne die aktuellen Tests gefahren zu haben. Ein
   Release-Tor, dessen Ausfall wie Normalbetrieb aussieht, ist keins.
   Im Abdruck steckt alles, was das Ergebnis eines Stuecks bestimmt: der Inhalt der Spieldatei UND
   aller Testdateien (nicht nur ihre Namen - eine geaenderte Pruefung waere sonst unsichtbar), die
   Stueckzahl, die Dateiliste genau dieses Stuecks und das Wurzelverzeichnis. */
function abdruckVon(dateienDesStuecks) {
  const h = crypto.createHash('sha1');
  h.update(WURZEL + '\n' + GLEICHZEITIG + '\n' + dateienDesStuecks.join(',') + '\n');
  const spiel = path.join(WURZEL, 'weltraum_kolonie.html');
  if (fs.existsSync(spiel)) h.update(fs.readFileSync(spiel));
  for (const f of alle) { try { h.update(fs.readFileSync(path.join(WURZEL, 'tests', f))); } catch (e) {} }
  return h.digest('hex').slice(0, 16);
}

if (!FORTSETZEN) {
  for (let i = 0; i < 64; i++) { try { fs.unlinkSync(marke(i)); } catch (e) {} }
}

console.log('Prüflauf: ' + alle.length + ' Testdateien in ' + GLEICHZEITIG + ' Stücken, gleichzeitig.');
console.log('Ablage: ' + ABLAGE);

function starte(i) {
  return new Promise(fertig => {
    if (FORTSETZEN && fs.existsSync(marke(i))) {
      const roh = fs.readFileSync(marke(i), 'utf8').trim().split(/\s+/);
      const code = parseInt(roh[0], 10);
      const gemerkt = roh[1] || '';
      const jetzt = abdruckVon(stuecke[i]);
      // Nur ueberspringen, wenn der Abdruck passt. Sonst ist die Marke von einem anderen Stand,
      // und ihr Exit-Code sagt nichts ueber DIESEN.
      if (gemerkt === jetzt && Number.isFinite(code)) {
        console.log('  Stück ' + i + ' war schon fertig (EXIT=' + code + ', Abdruck passt)');
        return fertig({ i, code, uebersprungen: true });
      }
      console.log('  Stück ' + i + ': Marke verworfen (' + (gemerkt ? 'anderer Stand' : 'ohne Abdruck') + ') - wird neu gefahren.');
    }
    const start = Date.now();
    const aus = fs.openSync(protokoll(i), 'w');
    const kind = spawn(process.execPath, [path.join(WURZEL, 'tests', 'run.js'), ...stuecke[i]],
      { cwd: WURZEL, stdio: ['ignore', aus, aus] });
    kind.on('exit', code => {
      try { fs.closeSync(aus); } catch (e) {}
      const c = code === null ? 1 : code;
      fs.writeFileSync(marke(i), String(c) + ' ' + abdruckVon(stuecke[i]));
      const dauer = Math.round((Date.now() - start) / 1000);
      console.log('  Stück ' + i + ' fertig: EXIT=' + c + ' (' + stuecke[i].length + ' Dateien, ' + dauer + 's)');
      fertig({ i, code: c, dauer });
    });
  });
}

(async () => {
  const start = Date.now();

  /* AMPEL, erste Messung. Steht origin/main mit einer Aenderung an der Spieldatei voraus, bricht
     ampelAbbruchWennVoraus() hier ab - das spart die volle Laufzeit, statt sie erst am Ende als
     verloren zu erkennen. */
  let ampelVorher = null;
  if (!AMPEL_AN) {
    console.log('Ampel abgeschaltet (--ohne-ampel) - dieser Lauf sagt NICHTS ueber fremde Merges.');
  } else {
    ampelVorher = ampelStand();
    ampelAbbruchWennVoraus(ampelVorher);
    console.log(ampelVorher
      ? 'Ampel: origin/' + AMPEL_ZWEIG + ' steht auf ' + ampelVorher.sha + ', ' + AMPEL_DATEI + ' ist hier aktuell.'
      : 'Ampel: origin/' + AMPEL_ZWEIG + ' nicht messbar (kein Netz oder kein origin) - der Lauf geht weiter.');
  }

  const abdruckVorher = weltAbdruck();
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

  /* NACHPRUEFUNG - der wichtigste Teil dieses Skripts.
     Gemessen am ersten echten Lauf (03.09.2026): Zwei Tests fielen gleichzeitig, die EINZELN gruen
     sind - test_forschung_lagerwand ("die Forschung ist gestartet, statt blockiert zu werden",
     activeResearch war schlicht noch null) und test_fraktionsgebiet_karte (CORS beim Laden von
     version.txt). Beides Lastsymptome von vier gleichzeitigen Browsern, keine Fehler im Spiel.
     Damit ist ein rotes Stueck hier ein VERDACHT, kein Urteil. Statt das als Merksatz in die
     Dokumentation zu schreiben, faehrt das Skript die roten Tests selbst noch einmal - einzeln,
     nacheinander, ohne Last. Was dann noch rot ist, ist echt. */
  const verdaechtig = [...new Set(roteZeilen.map(z => (z.match(/^FAIL (\S+)/) || [])[1]).filter(Boolean))];
  const echtRot = [];
  const abdruckNachher = weltAbdruck();
  const weltUnveraendert = abdruckNachher === abdruckVorher;
  if (verdaechtig.length && !weltUnveraendert) {
    console.log('\nACHTUNG: Spieldatei oder die server.js des Nachbar-Repos haben sich waehrend des Laufs');
    console.log('geaendert (Abdruck ' + abdruckVorher + ' -> ' + abdruckNachher + '). Die Nachpruefung misst damit');
    console.log('einen anderen Stand als die Stuecke - "Lastsymptom" ist hier keine gueltige Erklaerung.');
  }
  if (verdaechtig.length) {
    console.log('\n' + verdaechtig.length + ' rote Datei(en) - jetzt einzeln nachgefahren, ohne Last:');
    for (const datei of verdaechtig) {
      const code = await new Promise(f => {
        const k = spawn(process.execPath, [path.join(WURZEL, 'tests', 'run.js'), datei],
          { cwd: WURZEL, stdio: 'ignore' });
        k.on('exit', c => f(c === null ? 1 : c));
      });
      if (code === 0) console.log('  ' + datei + (weltUnveraendert
        ? ': einzeln GRUEN - war ein Lastsymptom der Gleichzeitigkeit.'
        : ': einzeln GRUEN - ABER Spieldatei oder Nachbar-server.js haben sich waehrend des Laufs geaendert.'
          + ' Das kann eine Korrektur gewesen sein, kein Lastsymptom. Ergebnis von Hand einordnen.'));
      else { console.log('  ' + datei + ': einzeln ROT - echter Fehler.'); echtRot.push(datei); }
    }
    console.log('\nDie Protokolle der Stücke liegen unter ' + ABLAGE + '.');
  }
  console.log('Dauer: ' + Math.round((Date.now() - start) / 1000) + 's');

  /* AMPEL, zweite Messung - und das Urteil. Es faellt in ampelUrteil(), einer reinen Funktion:
     Hier steht nur noch, dass es ausgegeben wird und was aus ihm folgt. */
  const urteil = ampelUrteil({
    vorher: ampelVorher,
    nachher: AMPEL_AN ? ampelStand() : null,
    weltUnveraendert,
    ampelAn: AMPEL_AN
  });
  if (urteil.zeilen.length) console.log('\n' + urteil.zeilen.join('\n'));

  if (verdaechtig.length && !echtRot.length) console.log(weltUnveraendert
    ? 'Alle roten Tests waren Lastsymptome - der Lauf ist gruen.'
    : 'Alle roten Tests sind einzeln gruen - aber die Welt hat sich waehrend des Laufs geaendert.'
      + ' Kein automatisches Gruen-Urteil; siehe Hinweis oben.');

  /* Der Exit-Code entscheidet - und er richtet sich nach der NACHPRUEFUNG, nicht nach den Stuecken.
     Waere es umgekehrt, muesste jeder Aufrufer die Ausgabe lesen, und genau das verbietet CLAUDE.md.
     ACHTUNG BEIM AUFRUF: `node pruflauf.js | tail` verwirft diesen Code (die Pipe liefert den von
     tail). Ohne Pipe aufrufen oder $PIPESTATUS lesen.
     Reihenfolge: Ein echter Testfehler bleibt Code 1 - er ist das schwerere Urteil und darf nicht
     von der Ampel ueberschrieben werden. Erst wenn die Tests nichts zu beanstanden haben, entscheidet
     die Ampel, ob das Ergebnis ueberhaupt verwendbar ist (Code 2). */
  const testCode = echtRot.length ? 1 : (rot.length && !verdaechtig.length ? 1 : 0);
  process.exit(testCode || (urteil.entwertet ? 2 : 0));
})();
