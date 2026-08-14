// Sorten- und Größen-SCHLÜSSEL müssen zwischen Frontend und Backend übereinstimmen (v8.487.0).
//
// WARUM NUR DIE SCHLÜSSEL. Seit Phase 4 erzeugt und führt der SERVER das Asteroidenfeld; der Client
// zeigt an, was er bekommt. Damit entfällt die Pflicht, Formeln doppelt zu pflegen - genau die
// Fehlerklasse, an der dieses Projekt schon mehrfach hing (CLAUDE.md-Fallstrick "Backend hat teils
// eigene Kopien von Frontend-Formeln"). Was NICHT entfällt: Der Client muss wissen, wie ein
// 'magnetit' aussieht. Schickt der Server eine Sorte, die ASTEROID_SORTEN nicht kennt, steht auf der
// Karte ein namenloser Brocken ohne Icon - und niemand merkt es, weil nichts bricht.
//
// Das ist derselbe Gedanke wie test_systemparitaet.js: Eine Tabelle, die in zwei Repos liegt, wächst
// nur in einem mit, wenn niemand nachprüft.
//
// GEPRUEFT WIRD:
//   1. Jede Sorte des Servers ist im Frontend definiert - und umgekehrt.
//   2. Dasselbe für die Größen, inklusive der Zahlen, die BEIDE Seiten benutzen: Vorrat und
//      Nachschubdauer. (Plätze und Güte braucht nur der Client, Gewichte nur der Server - die
//      werden bewusst nicht verglichen.)
//
// GEGENPROBE (beidseitig ausgeführt): Nimmt man im Backend eine Sorte aus AST_SORTEN heraus, meldet
// 1b sie als fehlend; ändert man dort einen Vorrat, schlägt 2c mit beiden Zahlen an.
const fs = require('fs');
const { SPIELDATEI, SERVER_JS, pruefer, ueberspringen } = require('./lib/umgebung');
if (!SERVER_JS) ueberspringen('Backend-Quelltext nicht gefunden (Nachbarverzeichnis kolonie-kepler7-backend fehlt).');
const { check, ende } = pruefer();

const FRONT = fs.readFileSync(SPIELDATEI, 'utf8');
const BACK = fs.readFileSync(SERVER_JS, 'utf8');

// Beide Tabellen wirklich AUSFÜHREN statt per Regex zu lesen: Ein nachgebautes Muster übersieht
// genau die Einträge, die anders geschrieben sind als erwartet (CLAUDE.md: naive Regex über
// Array-Literale terminiert an verschachtelten Klammern falsch).
function block(quelle, name, endeMarke){
  const von = quelle.indexOf(name);
  const bis = von < 0 ? -1 : quelle.indexOf(endeMarke, von);
  return (von < 0 || bis < 0) ? null : quelle.slice(von, bis + endeMarke.length);
}
const fSorten = block(FRONT, '  const ASTEROID_SORTEN = [', '\n  ];');
const fGroessen = block(FRONT, '  const ASTEROID_GROESSEN = [', '\n  ];');
const bSorten = block(BACK, 'const AST_SORTEN = [', '\n];');
const bGroessen = block(BACK, 'const AST_GROESSEN = [', '\n];');
check('0: alle vier Tabellen gefunden', !!fSorten && !!fGroessen && !!bSorten && !!bGroessen,
  { fSorten: !!fSorten, fGroessen: !!fGroessen, bSorten: !!bSorten, bGroessen: !!bGroessen });
if (!fSorten || !fGroessen || !bSorten || !bGroessen) return ende();

const F_SORTEN = new Function(fSorten + '\nreturn ASTEROID_SORTEN;')();
const F_GROESSEN = new Function(fGroessen + '\nreturn ASTEROID_GROESSEN;')();
const B_SORTEN = new Function(bSorten + '\nreturn AST_SORTEN;')();
const B_GROESSEN = new Function(bGroessen + '\nreturn AST_GROESSEN;')();

// ---- 1) Sorten ----------------------------------------------------------------------------
{
  const f = F_SORTEN.map(x => x.key).sort();
  const b = B_SORTEN.map(x => x.key).sort();
  check('1a: beide Seiten kennen überhaupt Sorten', f.length >= 9 && b.length >= 9, { front: f.length, back: b.length });
  const nurBack = b.filter(k => f.indexOf(k) < 0);
  const nurFront = f.filter(k => b.indexOf(k) < 0);
  check('1b: der Server schickt keine Sorte, die der Client nicht kennt', nurBack.length === 0, nurBack);
  check('1c: und der Client erwartet keine Sorte, die der Server nie erzeugt', nurFront.length === 0, nurFront);
}

// ---- 2) Größen ----------------------------------------------------------------------------
{
  const f = F_GROESSEN.map(x => x.key).sort();
  const b = B_GROESSEN.map(x => x.key).sort();
  check('2a: der Server schickt keine Größe, die der Client nicht kennt',
    b.filter(k => f.indexOf(k) < 0).length === 0, b.filter(k => f.indexOf(k) < 0));
  check('2b: und der Client erwartet keine Größe, die der Server nie erzeugt',
    f.filter(k => b.indexOf(k) < 0).length === 0, f.filter(k => b.indexOf(k) < 0));
  // Vorrat und Nachschubdauer stehen auf BEIDEN Seiten und bedeuten dasselbe - laufen sie
  // auseinander, zeigt die Vorschau des Clients eine andere Ausbeute an, als der Server hergibt.
  const abweichung = [];
  for (const g of B_GROESSEN){
    const fg = F_GROESSEN.find(x => x.key === g.key);
    if (!fg) continue;
    if (fg.vorrat !== g.vorrat) abweichung.push({ groesse: g.key, feld: 'vorrat', front: fg.vorrat, back: g.vorrat });
    if (fg.nachschubStd !== g.nachschubStd) abweichung.push({ groesse: g.key, feld: 'nachschubStd', front: fg.nachschubStd, back: g.nachschubStd });
    if (fg.plaetze !== g.plaetze) abweichung.push({ groesse: g.key, feld: 'plaetze', front: fg.plaetze, back: g.plaetze });
  }
  check('2c: Vorrat, Plätze und Nachschubdauer stimmen je Größe überein', abweichung.length === 0, abweichung);
}

return ende();
