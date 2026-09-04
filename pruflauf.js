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
 *   node pruflauf.js --ohne-ampel       ohne die Merge-Ampel (offline; sagt es in der Ausgabe)
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
   CLAUDE.md sagt seit jeher: "Ein fremder Merge entwertet den eigenen Lauf nur, wenn er die
   Spieldatei anfasst - das wird gemessen." Gemessen hat das bisher ein MENSCH, hinterher, wenn er
   daran dachte. Am 04.09.2026 nachgezaehlt: 25 der letzten 25 Merges nach main fassen die
   Spieldatei an, ihr Abstand liegt bei 31 bis 67 Minuten, ein Lauf dauert 35. Rechnerisch wird
   damit mehr als jeder zweite Lauf entwertet; ein einzelner Aenderungssatz brauchte an diesem Tag
   VIER Anlaeufe. Eine Regel, an die man sich erinnern muss, ist bei einer regelmaessigen Aufgabe
   keine Absicherung (docs/PROJECT_MEMORY.md) - also misst das Werkzeug es selbst.

   ZWEI MESSUNGEN, verschiedene Zwecke:
     VORHER  Steht origin/main mit einer Aenderung an der Spieldatei VOR mir, ist der Lauf schon
             beim Start wertlos. Er wird deshalb gar nicht erst gefahren - das spart die 35 Minuten,
             statt sie erst hinterher als verloren zu erkennen.
     NACHHER Bewegt sich origin/main WAEHREND des Laufs an der Spieldatei, ist das Urteil hin. Dann
             darf hier kein gruener Exit-Code stehen: Er wuerde zu einem Merge fuehren, dem keine
             Messung entspricht - und der Merge IST bei diesem Projekt die Auslieferung.

   WAS FAIL-OPEN IST UND WAS FAIL-CLOSED (die Unterscheidung ist der Kern):
   Der LAUF faellt offen aus - kein Netz, kein origin, kaputtes git: es wird trotzdem geprueft. Eine
   Sicherung, die bei einem Netzhaenger 35 Minuten Arbeit verweigert, wird nach dem zweiten Mal
   dauerhaft abgeschaltet, und dann sichert sie gar nichts mehr.
   Die AUSSAGE faellt geschlossen aus: Ohne Messung sagt das Skript "konnte nicht messen" und
   NIEMALS "kein fremder Merge". Genau das ist der Unterschied zwischen einer Sicherung, deren
   Ausfall wie Normalbetrieb aussieht, und einer, die ihn benennt.

   Bewusst nur die Spieldatei: server.js des Nachbarn deckt weltAbdruck() ab (der misst lokal), und
   ein fremder Merge, der nur Tests hinzufuegt, entwertet den eigenen Lauf nicht - er macht ihn
   unvollstaendig, und das ist eine andere Frage. */
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
   eigener Zustand und ausdruecklich NICHT dasselbe wie "alles in Ordnung"; die Aufrufer unten
   behandeln ihn getrennt. */
function ampelStand(){
  if (git(['fetch', 'origin', AMPEL_ZWEIG], 60) === null) return null;
  const sha = git(['rev-parse', 'origin/' + AMPEL_ZWEIG]);
  const diff = git(['diff', '--name-only', 'HEAD...origin/' + AMPEL_ZWEIG]);
  if (sha === null || diff === null) return null;
  return {
    sha: sha.trim().slice(0, 7),
    spieldateiVoraus: diff.split('\n').some(z => z.trim() === AMPEL_DATEI)
  };
}

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

  /* AMPEL, erste Messung. Steht origin/main mit einer Aenderung an der Spieldatei vor uns, ist der
     Lauf schon jetzt wertlos - dann lieber sofort abbrechen als in 35 Minuten feststellen, dass
     ein Stand gemessen wurde, den es nicht mehr gibt. */
  let ampelVorher = null;
  if (!AMPEL_AN) {
    console.log('Ampel abgeschaltet (--ohne-ampel) - dieser Lauf sagt NICHTS ueber fremde Merges.');
  } else {
    ampelVorher = ampelStand();
    if (!ampelVorher) {
      console.log('Ampel: origin/' + AMPEL_ZWEIG + ' nicht messbar (kein Netz oder kein origin).');
      console.log('       Der Lauf geht weiter, aber er kann hinterher NICHT sagen, ob jemand dazwischen gemergt hat.');
    } else if (ampelVorher.spieldateiVoraus) {
      console.log('ABBRUCH: origin/' + AMPEL_ZWEIG + ' (' + ampelVorher.sha + ') hat ' + AMPEL_DATEI + ' geaendert,');
      console.log('dieser Zweig kennt die Aenderung noch nicht. Ein Lauf darauf misst einen Stand, den es');
      console.log('nicht mehr gibt - und das faellt sonst erst am Ende auf, nach der vollen Laufzeit.');
      console.log('');
      console.log('  git merge origin/' + AMPEL_ZWEIG + '   und dann neu starten');
      console.log('');
      console.log('(Absichtlich auf altem Stand messen: node pruflauf.js --ohne-ampel)');
      process.exit(2);
    } else {
      console.log('Ampel: origin/' + AMPEL_ZWEIG + ' steht auf ' + ampelVorher.sha + ', ' + AMPEL_DATEI + ' ist hier aktuell.');
    }
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

  /* AMPEL, zweite Messung - die eigentliche. Hat sich origin/main waehrend des Laufs an der
     Spieldatei bewegt, ist das Urteil hin, egal wie gruen die Tests waren. Der Exit-Code muss das
     sagen: Ein gruener Code hier fuehrt zu einem Merge, dem keine Messung entspricht, und der
     Merge IST bei diesem Projekt die Auslieferung.
     Der Satz "kein fremder Merge" faellt NUR nach einer gelungenen Messung - ohne sie steht da,
     dass nicht gemessen werden konnte. */
  let ampelHinweis = 0;
  if (AMPEL_AN) {
    const ampelNachher = ampelStand();
    if (!ampelNachher) {
      console.log('\nAmpel: origin/' + AMPEL_ZWEIG + ' war am Ende nicht messbar - ob jemand waehrend des Laufs');
      console.log('gemergt hat, ist damit OFFEN. Vor dem Merge von Hand pruefen:');
      console.log('  git fetch origin ' + AMPEL_ZWEIG + ' && git diff --name-only HEAD...origin/' + AMPEL_ZWEIG);
    } else if (ampelNachher.spieldateiVoraus) {
      console.log('\nDER LAUF IST ENTWERTET: origin/' + AMPEL_ZWEIG + ' steht jetzt auf ' + ampelNachher.sha
        + ' und hat ' + AMPEL_DATEI);
      console.log('waehrend des Laufs geaendert. Gemessen wurde ein Stand, den es nicht mehr gibt.');
      console.log('');
      console.log('  git merge origin/' + AMPEL_ZWEIG + '   und neu laufen lassen');
      ampelHinweis = 2;
    } else {
      console.log('\nAmpel: kein fremder Merge waehrend des Laufs - das Urteil gilt fuer origin/'
        + AMPEL_ZWEIG + ' ' + ampelNachher.sha + '.');
    }
  }
  /* Der Exit-Code entscheidet - und er richtet sich nach der NACHPRUEFUNG, nicht nach den Stuecken.
     Waere es umgekehrt, muesste jeder Aufrufer die Ausgabe lesen, und genau das verbietet CLAUDE.md.
     ACHTUNG BEIM AUFRUF: `node pruflauf.js | tail` verwirft diesen Code (die Pipe liefert den von
     tail). Ohne Pipe aufrufen oder $PIPESTATUS lesen. */
  if (verdaechtig.length && !echtRot.length) console.log(weltUnveraendert
    ? 'Alle roten Tests waren Lastsymptome - der Lauf ist gruen.'
    : 'Alle roten Tests sind einzeln gruen - aber die Welt hat sich waehrend des Laufs geaendert.'
      + ' Kein automatisches Gruen-Urteil; siehe Hinweis oben.');
  /* Reihenfolge: Ein echter Testfehler bleibt Code 1 - er ist das schwerere Urteil und darf nicht
     von der Ampel ueberschrieben werden. Erst wenn die Tests nichts zu beanstanden haben, entscheidet
     die Ampel, ob das Ergebnis ueberhaupt verwendbar ist (Code 2). */
  const testCode = echtRot.length ? 1 : (rot.length && !verdaechtig.length ? 1 : 0);
  process.exit(testCode || ampelHinweis);
})();
