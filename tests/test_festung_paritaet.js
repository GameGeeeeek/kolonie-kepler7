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

// ---- 5) Die BAUTEILE (Phase 2) -------------------------------------------------------------
{
  const fB = block(FRONT, '  const FESTUNG_BAUTEILE = {', '\n  };');
  const bB = block(BACK, 'const FESTUNG_BAUTEILE = {', '\n};');
  check('5-anker: beide Bauteil-Tabellen gefunden', !!fB && !!bB, { front: !!fB, back: !!bB });
  if (fB && bB){
    let F2 = null, B2 = null;
    try { F2 = new Function(fB + '\nreturn FESTUNG_BAUTEILE;')(); } catch (e) { F2 = null; }
    try { B2 = new Function(bB + '\nreturn FESTUNG_BAUTEILE;')(); } catch (e) { B2 = null; }
    check('5a: beide lassen sich ausführen', !!F2 && !!B2, { front: !!F2, back: !!B2 });
    if (F2 && B2){
      const f = Object.keys(F2).sort(), b = Object.keys(B2).sort();
      check('5b: dieselben Bauteile', JSON.stringify(f) === JSON.stringify(b), { front: f, back: b });
      /* Die Zahlen, die BEIDE Seiten benutzen. `anteilKern` bestimmt die LP - läuft sie
         auseinander, zeigt der Balken einen anderen Höchststand als der Server führt.
         `rolle`/`min`/`max` bestimmen den Faktor, den die Vorschau NENNT und der Server ANWENDET;
         eine Abweichung wäre genau die zweite Zahl neben der echten. */
      const ab = [];
      for (const k of Object.keys(B2)){
        if (!F2[k]) continue;
        for (const feld of ['anteilKern', 'rolle', 'min', 'max', 'regenProStd']){
          if (F2[k][feld] !== B2[k][feld]) ab.push({ bauteil: k, feld, front: F2[k][feld], back: B2[k][feld] });
        }
      }
      check('5c: anteilKern, rolle, min, max und regenProStd stimmen je Bauteil überein', ab.length === 0, ab);
      check('5d: der Schild-Durchlass stimmt',
        !!F2.schild && !!B2.schild && F2.schild.kernDurchlass === B2.schild.kernDurchlass,
        { front: F2.schild && F2.schild.kernDurchlass, back: B2.schild && B2.schild.kernDurchlass });
      check('5e: die Turm-Verlustquote stimmt',
        !!F2.tuerme && !!B2.tuerme && F2.tuerme.verlustQuote === B2.tuerme.verlustQuote,
        { front: F2.tuerme && F2.tuerme.verlustQuote, back: B2.tuerme && B2.tuerme.verlustQuote });
    }
  }
  /* Und die Kern-Rolle, die als eigene Konstante danebensteht. VERGLICHEN WERDEN WERTE, nicht
     Text: Der erste Entwurf verglich die normalisierten Quelltext-Zeilen und fiel an einem
     Leerzeichen nach dem Doppelpunkt (`rolle:'kapital'` gegen `rolle: 'kapital'`) - eine
     Schreibweise statt der Regel (Arbeitsregel 3). */
  const wert = (quelle, praefix) => {
    const b = block(quelle, praefix + 'const FESTUNG_KERN_ROLLE = {', '};');
    if (!b) return null;
    try { return new Function(b + '\nreturn FESTUNG_KERN_ROLLE;')(); } catch (e) { return null; }
  };
  const fK = wert(FRONT, '  '), bK = wert(BACK, '');
  check('5f: die Kern-Rollenwerte stimmen überein',
    !!fK && !!bK && fK.rolle === bK.rolle && fK.min === bK.min && fK.max === bK.max,
    { front: fK, back: bK });
  /* Und die Stufen-Verlustquote: Sie steht seit Phase 2 auch im Frontend (die Vorschau nennt die
     Verlustspanne, und die haengt davon ab, ob die Tuerme stehen). Zwei Zahlen fuer dieselbe
     Groesse - also gehoert sie hierher. */
  const ab2 = [];
  for (const k of Object.keys(B)){
    if (!F[k]) continue;
    if (F[k].verlust !== B[k].verlust) ab2.push({ stufe: k, front: F[k].verlust, back: B[k].verlust });
  }
  check('5g: die Verlustquote je Stufe stimmt überein', ab2.length === 0, ab2);
  /* 5h: FESTUNG_BAUTEIL_BEITRAG steht im Frontend AUSSCHLIESSLICH, damit der Hilfetext die Zahl
     ableiten kann statt sie zu behaupten - der Server rechnet damit. Genau deshalb gehoert sie
     hierher: Eine Konstante, die nur eine ANZEIGE speist, faellt sonst nie auf, wenn der Server
     seinen Wert aendert - der Hilfetext behauptete die alte Zahl weiter, und niemand merkte es
     (dieselbe Familie wie die zweite Anzeigestelle in Pflichtpunkt 6). */
  const zahlAus = (quelle, name) => {
    const m = quelle.match(new RegExp('const ' + name + ' = ([0-9.]+);'));
    return m ? parseFloat(m[1]) : null;
  };
  const fBei = zahlAus(FRONT, 'FESTUNG_BAUTEIL_BEITRAG');
  const bBei = zahlAus(BACK, 'FESTUNG_BAUTEIL_BEITRAG');
  check('5h: der Hortanteil für Bauteil-Schaden stimmt überein',
    fBei !== null && bBei !== null && fBei === bBei, { front: fBei, back: bBei });
}

/* ------------------------------------------------------------------ 6) die Abklingzeit
   Sie stand im Frontend bis zum 21.08.2026 als eingetippte 6 an FÜNF Stellen – vier Anzeigen
   und, schwerer wiegend, an der SPERRE selbst (`meinLetzter + 6*3600*1000` im Kartenmenü, also
   die Entscheidung, ob der Angriffs-Eintrag überhaupt anklickbar ist). Der Server ist die
   Autorität (`FESTUNG_ABKLING_MS`); liefen die zwei auseinander, zeigte die Karte den Schlag
   als frei an und `/api/festung/angriff` antwortete mit 403 – oder umgekehrt sperrte das
   Frontend etwas, das der Server längst erlaubt.
   VERGLICHEN WIRD DER WERT, nicht der Text: Das Frontend führt Stunden, das Backend
   Millisekunden. Ein Textvergleich fiele hier zwangsläufig durch und wäre kein Befund –
   dasselbe Muster wie 4a in test_nest_paritaet.js. */
{
  const fStd = (FRONT.match(/const FESTUNG_ABKLING_STD = ([\d.]+);/) || [])[1];
  const bMs  = (BACK.match(/const FESTUNG_ABKLING_MS = ([^;]+);/) || [])[1];
  let bStd = null;
  try { bStd = bMs ? (new Function('return (' + bMs + ');')()) / 3600000 : null; } catch (e) {}
  check('6-anker: beide Konstanten sind auffindbar', !!fStd && bStd !== null, { front: fStd, backMs: bMs });
  check('6a: die Abklingzeit der Festung ist auf beiden Seiten dieselbe',
    fStd !== undefined && bStd !== null && Math.abs(parseFloat(fStd) - bStd) < 0.001,
    { frontStunden: fStd, backStunden: bStd });
  /* Und die Gegenrichtung, sonst wäre die Konstante ein Denkmal: Sie muss auch BENUTZT werden.
     Eine eingeführte Konstante, die niemand liest, während die alte Ziffer weiterlebt, ist genau
     die zweite Anzeigestelle, gegen die dieser Umbau gebaut ist (Arbeitsregel 59).

     HIER STAND `leser >= 5` ÜBER ALLE Fundstellen – also inklusive der DEFINITION. Bei sechs
     Vorkommen (1 Definition + 5 Leser) durfte damit genau einer still auf die alte Ziffer
     zurückfallen, ohne dass etwas anschlug. Gezählt wird deshalb ohne die Definition. */
  const alleFund = (FRONT.match(/FESTUNG_ABKLING_STD/g) || []).length;
  const definition = (FRONT.match(/const FESTUNG_ABKLING_STD = /g) || []).length;
  const leser = alleFund - definition;
  check('6b: die Konstante hat mindestens fünf LESER (die Definition zählt nicht mit)',
    definition === 1 && leser >= 5, { alleFund, definition, leser });
  /* Und die eine Fundstelle, die nicht nur anzeigt, sondern ENTSCHEIDET, wird namentlich
     verlangt: Fällt ausgerechnet die Sperre auf eine eingetippte Ziffer zurück, zeigt die Karte
     den Schlag als frei an, während der Server mit 403 antwortet – der Spieler schickt dann eine
     Flotte los, die zurückprallt. Ein reiner Zähler kann das nicht von einem Anzeigetext
     unterscheiden. */
  /* KOMMENTARE MÜSSEN VORHER WEG (Arbeitsregel 33). Der Erklärkommentar an der Konstante ZITIERT
     die alte Zeile `meinLetzter + 6*3600*1000`, um zu sagen, was behoben wurde – die rohe
     Textsuche sah sie dadurch als noch vorhanden an, und 6c fiel auf korrektem Code durch.
     Genau dieselbe Falle hat in derselben Lieferung schon test_belohnungen_speichern erwischt. */
  const ohneKommentare = FRONT
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/^([^'"\n]*?)\/\/[^\n]*$/gm, (m, vor) => vor + ' '.repeat(m.length - vor.length));
  // Und die Leerung belegt sich selbst - sonst prüfte 6c am Ende nur, dass nichts gegriffen hat.
  check('6c-vorab: das Leeren der Kommentare hat gegriffen',
    ohneKommentare.length === FRONT.length && ohneKommentare !== FRONT
      && /meinLetzter \+ 6\*3600\*1000/.test(FRONT)
      && !/meinLetzter \+ 6\*3600\*1000/.test(ohneKommentare),
    { zitatImKommentar: /meinLetzter \+ 6\*3600\*1000/.test(FRONT) });
  check('6c: auch die SPERRE im Kartenmenü rechnet mit der Konstante, nicht mit einer Ziffer',
    /meinLetzter \+ FESTUNG_ABKLING_STD\*3600\*1000/.test(ohneKommentare)
      && !/meinLetzter \+ 6\*3600\*1000/.test(ohneKommentare),
    { mitKonstante: /meinLetzter \+ FESTUNG_ABKLING_STD\*3600\*1000/.test(ohneKommentare),
      mitZiffer: /meinLetzter \+ 6\*3600\*1000/.test(ohneKommentare) });
}

ende();
