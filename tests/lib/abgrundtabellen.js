// Die Abgrund-Tabellen fuer einen Testkontext bereitstellen (v8.714.0, erweitert v8.715.0).
//
// WARUM ES DIESE DATEI GIBT: Mehrere Tests bauen Abgrund-Funktionen aus der Spieldatei nach
// (`abgrundWaechterDef`, `ensureAbgrund`, `abgrundSektor`). Diese Funktionen lesen Tabellen, die
// mit jedem Paket wachsen - Paket C brachte ABGRUND_WAECHTER_REGELN, Paket E die Fund-Tabellen.
// Jedes Mal stuerzten dieselben Kontexte mit ReferenceError ab, statt eine Pruefung zu melden,
// und jedes Mal war die Versuchung, den Auszug in jede betroffene Datei zu kopieren. Beim ersten
// Mal habe ich genau das getan: fuenf wortgleiche Kopien, die beim naechsten Paket einzeln
// nachgezogen werden muessten. Es gibt sie deshalb nur noch hier.
//
// DIE ANKER WERDEN GEPRUEFT: Fehlt eine Tabelle, wirft diese Funktion. Ein stilles '' haette den
// Kontext ohne sie gebaut, und die Tests waeren aus dem falschen Grund gruen gewesen - genau die
// Falle, vor der CLAUDE.md bei Such-/Slice-Ankern warnt.
function klammerBlock(js, kopf, auf, zu){
  const i = js.indexOf(kopf);
  if (i < 0) return null;
  let d = 0, a = js.indexOf(auf, i), k = a;
  for (; k < js.length; k++){ if (js[k]===auf) d++; else if (js[k]===zu){ d--; if(!d) break; } }
  return js.slice(i, k+1) + ';';
}

// Die Tabellen, die eine nachgebaute Abgrund-Funktion braucht. `pflicht` heisst: fehlt sie in der
// Spieldatei, ist das ein Fehler und keine Nachlaessigkeit dieses Helfers.
const TABELLEN = [
  { name:'ABGRUND_WAECHTER_REGELN', art:'liste' },
  { name:'ABGRUND_FUNDE',           art:'liste' },
  { name:'ABGRUND_FUND_VORGABEN',   art:'liste' }
  // ABGRUND_PLAN_LINIEN steht bewusst NICHT hier: test_abgrund bringt sie selbst mit, und eine
  // zweite `const` desselben Namens ist im Kontext ein Syntaxfehler - gemessen, nicht vermutet.
];
const KONSTANTEN = ['ABGRUND_FUND_CHANCE', 'ABGRUND_FUND_ATEM'];
const FUNKTIONEN = ['abgrundRegelDef'];

function abgrundTabellen(js, fnAus){
  const teile = [];
  for (const t of TABELLEN){
    const q = klammerBlock(js, 'const '+t.name+' = [', '[', ']');
    if (!q) throw new Error(t.name+' nicht in der Spieldatei gefunden');
    teile.push(q);
  }
  for (const k of KONSTANTEN){
    const m = js.match(new RegExp('^\\s*const '+k+' = .*$','m'));
    if (!m) throw new Error(k+' nicht in der Spieldatei gefunden');
    teile.push(m[0].trim());
  }
  for (const f of FUNKTIONEN){
    const q = fnAus(f);
    if (!q) throw new Error(f+' nicht in der Spieldatei gefunden');
    teile.push(q);
  }
  return teile.join('\n');
}
// Der alte Name bleibt als Durchreiche stehen, damit ein Aufrufer, den ich uebersehen habe,
// nicht still etwas anderes tut - er bekommt jetzt mehr, nie weniger.
module.exports = { abgrundTabellen, regelQuelle: abgrundTabellen };
