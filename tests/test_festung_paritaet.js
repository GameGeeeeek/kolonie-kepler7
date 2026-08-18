// Die Festungs-Stufentabelle liegt in ZWEI Repos - sie muss übereinstimmen (Phase 1, 18.08.2026).
//
//   node tests/test_festung_paritaet.js
//
// WARUM ES DIESE KOPIE ÜBERHAUPT GIBT. Der SERVER besitzt die Festung und entscheidet jede
// Wirkung; er kürzt die Abbaumenge selbst, und der Client verbucht `daten.menge`. Trotzdem braucht
// das Frontend die Zahlen: Die VORSCHAU (`abbauPlan`) läuft VOR dem Serveraufruf und müsste sonst
// eine Ladung nennen, die die Mission danach nicht einhält. Genau diese stille Abweichung ist der
// Grund, warum `FESTUNG_SPAWN_AKTIV` im Backend so lange auf false steht, bis dieses Frontend live
// ist - eine Zahl, die kleiner ausfällt als angekündigt, ohne dass jemand sagt warum.
//
// Dieselbe Kopie-Familie wie ASTEROID_SORTEN/AST_SORTEN nebenan und wie
// SHIP_SCORE_WEIGHTS/computeScoreServer. Eine Tabelle in zwei Repos wächst nur in einem mit, wenn
// niemand nachprüft.
//
// GEPRUEFT WIRD:
//   1. Beide Seiten kennen dieselben Stufen-SCHLÜSSEL. Schickt der Server eine Stufe, die das
//      Frontend nicht kennt, fällt `festungFaktoren` auf die Schanze zurück - der Spieler sähe
//      dann eine Drosselung von 25 %, während der Server 55 % abzieht.
//   2. Die drei Zahlen, die BEIDE Seiten benutzen, stimmen je Stufe überein:
//      `blockade` (Ladungskürzung), `proto` (Protomaterie-Drosselung) und `kern` (Lebenspunkte,
//      die das Kartenmenü als Balken zeigt).
//   3. Der Geräumt-Bonus steht auf beiden Seiten gleich.
//   4. Der Server SCHICKT den Protomaterie-Faktor wirklich mit (`protoBlockade` in der Antwort von
//      /api/asteroid/mine) - ohne dieses Feld wäre die Drosselung nicht umsetzbar, weil die
//      Protomaterie im Frontend allein an der GRÖSSE des Vorkommens hängt und die Ladungskürzung
//      sie nie erreicht. Das ist der Fund, der die Mechanik überhaupt erst real gemacht hat: Vorher
//      wurde `st.proto` ausschliesslich im Ankündigungstext der Galaxie-Nachricht gelesen.
//
// GEGENPROBE (in beide Richtungen ausgeführt):
//   * Ändert man im Backend `blockade` einer Stufe, schlägt 2a mit beiden Zahlen an.
//   * Nimmt man im Frontend eine Stufe heraus, schlägt 1b an.
//   * Entfernt man `protoBlockade` aus der Serverantwort, schlägt 4a an.
const fs = require('fs');
const { SPIELDATEI, SERVER_JS, pruefer, ueberspringen } = require('./lib/umgebung');
if (!SERVER_JS) ueberspringen('Backend-Quelltext nicht gefunden (Nachbarverzeichnis kolonie-kepler7-backend fehlt).');
const { check, ende } = pruefer();

const FRONT = fs.readFileSync(SPIELDATEI, 'utf8');
const BACK = fs.readFileSync(SERVER_JS, 'utf8');

// Beide Tabellen AUSFÜHREN statt per Regex lesen - ein nachgebautes Muster übersieht genau die
// Einträge, die anders geschrieben sind als erwartet (CLAUDE.md: naive Regex über Array-Literale).
function block(quelle, name, endeMarke){
  const von = quelle.indexOf(name);
  const bis = von < 0 ? -1 : quelle.indexOf(endeMarke, von);
  return (von < 0 || bis < 0) ? null : quelle.slice(von, bis + endeMarke.length);
}
const fBlock = block(FRONT, '  const FESTUNG_STUFEN = {', '\n  };');
const bBlock = block(BACK, 'const FESTUNG_STUFEN = {', '\n};');
check('0: beide Tabellen gefunden', !!fBlock && !!bBlock, { front: !!fBlock, back: !!bBlock });
if (!fBlock || !bBlock) return ende();

let F = null, B = null;
// try/catch je Aufbau, damit ein Fehlschlag hier eine BENANNTE Prüfung ist und nicht den Lauf
// abbricht - sonst liefen die übrigen Prüfungen nie, und der rote Exit sähe aus wie ein Befund
// (Arbeitsregel 34).
try { F = new Function(fBlock + '\nreturn FESTUNG_STUFEN;')(); } catch (e) { F = null; }
try { B = new Function(bBlock + '\nreturn FESTUNG_STUFEN;')(); } catch (e) { B = null; }
check('0b: beide Tabellen lassen sich ausführen', !!F && !!B, { front: !!F, back: !!B });
if (!F || !B) return ende();

// ---- 1) Die Schlüssel ----------------------------------------------------------------------
{
  const f = Object.keys(F).sort(), b = Object.keys(B).sort();
  check('1a: beide Seiten kennen überhaupt Stufen', f.length >= 3 && b.length >= 3,
    { front: f, back: b });
  const nurBack = b.filter(k => f.indexOf(k) < 0);
  const nurFront = f.filter(k => b.indexOf(k) < 0);
  check('1b: der Server kennt keine Stufe, die das Frontend nicht kennt', nurBack.length === 0, nurBack);
  check('1c: und das Frontend erwartet keine Stufe, die der Server nie erzeugt', nurFront.length === 0, nurFront);
}

// ---- 2) Die Zahlen, die BEIDE Seiten benutzen ----------------------------------------------
{
  const abweichung = [];
  for (const k of Object.keys(B)){
    const fs_ = F[k], bs = B[k];
    if (!fs_) continue;
    for (const feld of ['blockade', 'proto', 'kern']){
      if (fs_[feld] !== bs[feld]) abweichung.push({ stufe: k, feld, front: fs_[feld], back: bs[feld] });
    }
  }
  check('2a: blockade, proto und kern stimmen je Stufe überein', abweichung.length === 0, abweichung);
  // Und die NAMEN, weil das Frontend sie dem Spieler zeigt ("Sternenfeste im System").
  const namen = Object.keys(B).filter(k => F[k] && F[k].name !== B[k].name)
    .map(k => ({ stufe: k, front: F[k].name, back: B[k].name }));
  check('2b: die Stufennamen stimmen überein', namen.length === 0, namen);
}

// ---- 3) Der Geräumt-Bonus ------------------------------------------------------------------
{
  const zahl = (quelle, name) => {
    const m = quelle.match(new RegExp('const ' + name + ' = ([0-9.]+);'));
    return m ? Number(m[1]) : null;
  };
  const fB = zahl(FRONT, 'FESTUNG_GERAEUMT_BONUS');
  const bB = zahl(BACK, 'FESTUNG_GERAEUMT_BONUS');
  check('3a: der Geräumt-Bonus steht auf beiden Seiten gleich', fB !== null && fB === bB,
    { front: fB, back: bB });
}

// ---- 4) Der Server schickt den Protomaterie-Faktor wirklich mit -----------------------------
{
  /* Der Faktor MUSS reisen: Die Protomaterie hängt im Frontend allein an der GRÖSSE des Vorkommens
     (protoJeFuhre), die Ladungskürzung des Servers erreicht sie also nie. Ohne dieses Feld wäre
     `proto` in der Stufentabelle eine Zahl, die nur der Ankündigungstext liest - und genau so war
     es vor dem 18.08.2026 (Arbeitsregel 59).

     KOMMENTARE WERDEN VORHER GELEERT, und das ist hier keine Formalie: Der erste Entwurf prüfte
     `/protoBlockade/.test(BACK)` über den rohen Quelltext. Die Gegenprobe (Feld aus der Antwort
     entfernt) blieb GRÜN - weil der ausführliche Kommentar über der Zeile das Wort mehrfach
     zitiert. Damit prüfte der Test die Erklärung statt der Umsetzung, also exakt derselbe Fehler,
     den er für `st.proto` aufdecken soll (Arbeitsregel 33/59). */
  const ohneKommentare = BACK
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  // Und gescopt auf die ANTWORT des Endpunkts, nicht auf die ganze Datei: Der Faktor nützt nur,
  // wenn er beim Client ankommt (Arbeitsregel 39 - ein Name kann an mehreren Stellen stehen).
  const antwort = (() => {
    const a = ohneKommentare.indexOf("app.post('/api/asteroid/mine'");
    if (a < 0) return '';
    const r = ohneKommentare.indexOf('res.json({', a);
    return r < 0 ? '' : ohneKommentare.slice(r, ohneKommentare.indexOf('});', r) + 3);
  })();
  check('4a-bereich: die Antwort von /api/asteroid/mine liess sich abgrenzen',
    antwort.length > 40 && /menge/.test(antwort), { laenge: antwort.length });
  check('4a: sie führt protoBlockade als Feld',
    /protoBlockade/.test(antwort), { antwort: antwort.slice(0, 240) });
  check('4b: und das Frontend wendet einen eigenen Protomaterie-Faktor an',
    /festungProtoFaktor|proto:\s*Math\.round\(protoJeFuhre/.test(FRONT));
  // Gegenrichtung: `st.proto` darf nicht NUR im Nachrichtentext stehen. Mindestens eine Fundstelle
  // muss etwas RECHNEN - sonst ist die Spalte wieder ein blosses Versprechen.
  const protoStellen = (ohneKommentare.match(/\.proto\b/g) || []).length;
  check('4c: das Feld proto wird im Backend mehr als einmal gelesen', protoStellen >= 2,
    { fundstellen: protoStellen, hinweis: 'genau eine Stelle hiesse: nur der Ankuendigungstext' });
}

ende();
