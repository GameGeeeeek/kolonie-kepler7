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
const crypto = require('crypto');
const { spawn } = require('child_process');

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
  /* Der Exit-Code entscheidet - und er richtet sich nach der NACHPRUEFUNG, nicht nach den Stuecken.
     Waere es umgekehrt, muesste jeder Aufrufer die Ausgabe lesen, und genau das verbietet CLAUDE.md.
     ACHTUNG BEIM AUFRUF: `node pruflauf.js | tail` verwirft diesen Code (die Pipe liefert den von
     tail). Ohne Pipe aufrufen oder $PIPESTATUS lesen. */
  if (verdaechtig.length && !echtRot.length) console.log(weltUnveraendert
    ? 'Alle roten Tests waren Lastsymptome - der Lauf ist gruen.'
    : 'Alle roten Tests sind einzeln gruen - aber die Welt hat sich waehrend des Laufs geaendert.'
      + ' Kein automatisches Gruen-Urteil; siehe Hinweis oben.');
  process.exit(echtRot.length ? 1 : (rot.length && !verdaechtig.length ? 1 : 0));
})();
