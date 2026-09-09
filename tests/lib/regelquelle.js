// Die Regeltabelle der Abgrund-Waechter fuer einen Testkontext bereitstellen (v8.714.0).
//
// WARUM HIER UND NICHT FUENFMAL KOPIERT: `abgrundWaechterDef` liest seit Paket C
// ABGRUND_WAECHTER_REGELN. Fuenf Tests bauen diese Funktion aus der Spieldatei nach und stuerzten
// deshalb mit ReferenceError ab. Der erste Entwurf loeste das mit einer wortgleichen Kopie in
// jeder der fuenf Dateien - fuenf Stellen, die beim naechsten Umbau einzeln nachgezogen werden
// muessten, und alle fuenf lieferten bei fehlendem Anker still '' zurueck.
//
// DER ANKER WIRD GEPRUEFT: Fehlt die Tabelle, wirft diese Funktion. Ein stilles '' haette den
// Kontext ohne Regeln gebaut, und die Tests waeren aus dem falschen Grund gruen gewesen -
// genau die Falle, vor der CLAUDE.md bei Such-/Slice-Ankern warnt.
function regelQuelle(js, fnAus){
  const i = js.indexOf('const ABGRUND_WAECHTER_REGELN = [');
  if (i < 0) throw new Error('ABGRUND_WAECHTER_REGELN nicht in der Spieldatei gefunden');
  let d = 0, a = js.indexOf('[', i), k = a;
  for (; k < js.length; k++){ if (js[k]==='[') d++; else if (js[k]===']'){ d--; if(!d) break; } }
  const def = fnAus('abgrundRegelDef');
  if (!def) throw new Error('abgrundRegelDef nicht in der Spieldatei gefunden');
  return js.slice(i, k+1) + ';\n' + def;
}
module.exports = { regelQuelle };
