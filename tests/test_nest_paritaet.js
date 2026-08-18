// Die Alien-Tabellen liegen in ZWEI Repos - sie müssen übereinstimmen (Phase 3, 18.08.2026).
//
//   node tests/test_nest_paritaet.js
//
// WARUM ES DIESE KOPIE GIBT. Der SERVER besitzt die Nester und rechnet jede Wirkung; das Frontend
// braucht die Zahlen für Karte, Kartenmenü und Vorschau - und die laufen VOR dem Serveraufruf.
// Dieselbe Kopie-Familie wie FESTUNG_STUFEN nebenan und ASTEROID_SORTEN/AST_SORTEN.
//
// GEPRUEFT WIRD:
//   1. Beide Seiten kennen dieselben VOLKS-SCHLÜSSEL. Schickt der Server ein Volk, das das
//      Frontend nicht kennt, fällt `nestVolk` auf einen Platzhalter zurück - der Spieler sähe
//      "Unbekanntes Volk" ohne Schwäche und ohne Eigenart.
//   2. Je Volk stimmen `name`, `schwaeche`, `reifeStd` und `wandert` überein. `name` trägt die
//      Zuordnung zu ALIEN_RACE_NAMES, `schwaeche` die +25%-Aussage der Vorschau, `reifeStd` die
//      "wächst in etwa"-Zeile des Kartenmenüs, `wandert` den Hinweis auf den verpassten Anflug.
//   3. Die fünf Stufen stimmen in Name UND Lebenspunkten überein - der Hilfetext leitet die
//      Tabelle daraus ab, und das Kartenmenü zeigt den Balken gegen `lpMax`.
//   4. Die Abklingzeit ist auf beiden Seiten dieselbe Zahl. Sie steht im Frontend in STUNDEN und
//      im Backend in Millisekunden - verglichen wird deshalb der WERT, nicht der Text.
//   5. Die Schwäche-Schreibweise des Frontends deckt jede Schwäche ab, die das Backend führt.
//      Ohne diese Abbildung stünde in der Vorschau der rohe Schlüssel ('destroyer') statt des
//      Schiffsnamens - und die Prüfung "ist sie im Verband dabei?" griffe ins Leere, weil die
//      Flotte den Schlüssel 'destroyers' führt.
//
// GEGENPROBE (in beide Richtungen ausgeführt):
//   * Ändert man im Backend eine `schwaeche`, schlägt 2a mit beiden Werten an.
//   * Nimmt man im Frontend ein Volk heraus, schlägt 1b an.
//   * Ändert man eine Stufen-LP, schlägt 3b an.
//   * Setzt man NEST_ABKLING_MS im Backend auf einen anderen Wert, schlägt 4a an.
const fs = require('fs');
const { SPIELDATEI, SERVER_JS, pruefer, ueberspringen } = require('./lib/umgebung');
if (!SERVER_JS) ueberspringen('Backend-Quelltext nicht gefunden (Nachbarverzeichnis kolonie-kepler7-backend fehlt).');
const { check, ende } = pruefer();

const FRONT = fs.readFileSync(SPIELDATEI, 'utf8');
const BACK = fs.readFileSync(SERVER_JS, 'utf8');

// Beide Tabellen AUSFÜHREN statt per Regex lesen - ein nachgebautes Muster übersieht genau die
// Einträge, die anders geschrieben sind als erwartet.
function block(quelle, name, endeMarke){
  const von = quelle.indexOf(name);
  const bis = von < 0 ? -1 : quelle.indexOf(endeMarke, von);
  return (von < 0 || bis < 0) ? null : quelle.slice(von, bis + endeMarke.length);
}
function fuehreAus(text, name){
  if (!text) return null;
  try { return new Function(text + '\nreturn ' + name + ';')(); } catch (e) { return null; }
}

// ---- 1) Die Völker -------------------------------------------------------------------------
const fV = fuehreAus(block(FRONT, '  const ALIEN_VOELKER = {', '\n  };'), 'ALIEN_VOELKER');
const bV = fuehreAus(block(BACK, 'const ALIEN_VOELKER = {', '\n};'), 'ALIEN_VOELKER');
check('1a: beide Völker-Tabellen sind lesbar und ausführbar', !!fV && !!bV, { front: !!fV, back: !!bV });
if (!fV || !bV) return ende();
{
  const f = Object.keys(fV).sort(), b = Object.keys(bV).sort();
  check('1b: dieselben Volks-Schlüssel', JSON.stringify(f) === JSON.stringify(b), { front: f, back: b });
  // Die Felder, die BEIDE Seiten benutzen. `farbe` und `art` sind frontend-only (Aussehen und
  // Erklärtext) und stehen bewusst nicht in dieser Liste.
  const ab = [];
  for (const k of Object.keys(bV)){
    if (!fV[k]) continue;
    for (const feld of ['name', 'schwaeche', 'reifeStd', 'wandert']){
      if (fV[k][feld] !== bV[k][feld]) ab.push({ volk: k, feld, front: fV[k][feld], back: bV[k][feld] });
    }
  }
  check('2a: name, schwaeche, reifeStd und wandert stimmen je Volk überein', ab.length === 0, ab);
}

// ---- 3) Die Stufen -------------------------------------------------------------------------
const fS = fuehreAus(block(FRONT, '  const NEST_STUFEN = [', '\n  ];'), 'NEST_STUFEN');
const bS = fuehreAus(block(BACK, 'const NEST_STUFEN = [', '\n];'), 'NEST_STUFEN');
check('3a: beide Stufen-Tabellen sind lesbar und ausführbar', !!fS && !!bS, { front: !!fS, back: !!bS });
if (fS && bS){
  check('3a2: gleich viele Stufen', fS.length === bS.length, { front: fS.length, back: bS.length });
  const ab = [];
  for (let i = 1; i < Math.min(fS.length, bS.length); i++){
    if (!fS[i] || !bS[i]) { ab.push({ stufe: i, front: fS[i], back: bS[i] }); continue; }
    if (fS[i].name !== bS[i].name) ab.push({ stufe: i, feld: 'name', front: fS[i].name, back: bS[i].name });
    if (fS[i].lp !== bS[i].lp) ab.push({ stufe: i, feld: 'lp', front: fS[i].lp, back: bS[i].lp });
  }
  check('3b: Name und Lebenspunkte stimmen je Stufe überein', ab.length === 0, ab);
}

// ---- 4) Die Abklingzeit --------------------------------------------------------------------
{
  /* VERGLICHEN WIRD DER WERT, nicht der Text: Das Frontend führt Stunden (der Hilfetext und die
     Vorschau schreiben "4 Stunden"), das Backend Millisekunden. Ein Textvergleich fiele hier
     zwangsläufig durch und wäre kein Befund. */
  const fStd = (FRONT.match(/const NEST_ABKLING_STD = ([\d.]+);/) || [])[1];
  const bMs = (BACK.match(/const NEST_ABKLING_MS = ([^;]+);/) || [])[1];
  let bStd = null;
  try { bStd = bMs ? (new Function('return (' + bMs + ');')()) / 3600000 : null; } catch (e) {}
  check('4-anker: beide Konstanten sind auffindbar', !!fStd && bStd !== null, { front: fStd, backMs: bMs });
  check('4a: die Abklingzeit ist auf beiden Seiten dieselbe',
    fStd !== undefined && bStd !== null && Math.abs(parseFloat(fStd) - bStd) < 0.001,
    { frontStunden: fStd, backStunden: bStd });
}

// ---- 5) Die Schwäche-Schreibweise ----------------------------------------------------------
{
  /* Das Backend nennt die Schwäche in der Schreibweise von fleetHasShipType() ('destroyer'), die
     Flotte trägt aber 'destroyers'. Das Frontend braucht deshalb dieselbe Abbildung - fehlt zu
     einer Schwäche der Eintrag, steht in der Vorschau der rohe Schlüssel, und die Prüfung
     "ist sie im Verband dabei?" liest ein Feld, das es nicht gibt. */
  const map = fuehreAus(block(FRONT, '  const NEST_SCHWAECHE_KEY = {', '};'), 'NEST_SCHWAECHE_KEY');
  check('5-anker: die Schwäche-Abbildung ist lesbar', !!map, { map });
  if (map && bV){
    const fehlend = Object.values(bV).map(v => v.schwaeche).filter(sw => sw && !map[sw]);
    check('5a: jede Schwäche des Backends hat einen Eintrag in der Abbildung',
      fehlend.length === 0, { fehlend, abbildung: Object.keys(map) });
    // Und die Ziele der Abbildung müssen echte Schiffsschlüssel sein - sonst findet
    // nestSchwaecheName() nichts und zeigt den Schlüssel statt des Namens.
    const shipBlock = block(FRONT, '  const SHIP_DEFS = [', '\n  ];') || '';
    const unbekannt = Object.values(map).filter(k => shipBlock.indexOf("key:'" + k + "'") < 0);
    check('5b: jedes Abbildungs-Ziel ist ein echter SHIP_DEFS-Schlüssel',
      unbekannt.length === 0, { unbekannt });
  }
}

ende();
