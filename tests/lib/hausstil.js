// Der Hausstil der Anfuehrungszeichen - EINE Implementierung, zwei Ausfuehrungsstellen.
//
// Die Regel: oeffnend „ (U+201E), schliessend das GERADE ". Verboten ist damit U+201C, das im
// Deutschen als schliessendes und im Englischen als oeffnendes Zeichen auftritt.
//
// Sie laeuft an ZWEI Stellen - als Pflichtpruefung in tests/run.js (damit sie in allen drei Modi
// greift, auch in `--nummer`, also im letzten Moment vor dem Merge) und als Pruefung in
// test_forschungstexte.js. Bis zum 22.08.2026 stand dafuer an beiden Stellen ein eigenes
// `includes('“')`; mit der Escape-Regel unten waeren die zwei Kopien beim naechsten Anfassen
// auseinandergelaufen. Deshalb liegt die Regel jetzt hier und die Aufrufer sagen nur noch, WANN
// sie laeuft.
//
// WARUM DIE ESCAPE-FORM MITGEPRUEFT WIRD - gemessen an der ausgelieferten Datei (22.08.2026):
//
//     U+201C als LITERAL (was die Pruefung suchte) : 0
//     U+201C als ESCAPE  (was sie NICHT sah)       : 8
//
// `'“'` ist zur Laufzeit dasselbe Zeichen; die Suche nach dem Literal findet es nicht.
// VIER der acht standen in LEBENDEM Spielertext (zwei log-Meldungen der Modulschmiede, zweimal
// die Titelzeile des Teilen-Bildes) - die Pruefung war also gegen genau das blind, wofuer sie
// gebaut wurde. Das ist Arbeitsregel 77, hier zum ersten Mal an ausgeliefertem Text gemessen:
// Ein Escape ist kein Schreibfehler, sondern eine TARNUNG vor jeder Pruefung, die den Quelltext
// liest - und die Pflichtpruefungen sind genau solche.
//
// DIE VIER HISTORISCHEN AUSNAHMEN liegen in PATCHNOTES (Versionen 8.526.0 und 8.587.0, je zwei).
// Patchnotes sind unveraenderliche Historie und werden nie rueckwirkend editiert (Checkliste
// Punkt 4) - sie stehen deshalb namentlich hier. Erkannt werden sie an ihrer VERSION, nicht an
// einer Zeilennummer: Die verschiebt sich beim naechsten Eintrag, die Version nie.
// Ein NEUER Patchnote mit dieser Schreibweise faellt weiterhin auf - genau der Fall, der bei
// v8.599.0 nur deshalb nicht live ging, weil die Escapes als Stil-Abweichung auffielen.
'use strict';

const VERBOTEN = '“';
const ESCAPE = /\\u201[cC]/g;
// Historischer Befund, keine ableitbare Tabelle - dasselbe Mittel wie die Regressionsliste in
// test_gegenstand_verbrauch. Wer eine Version hier ergaenzt, sagt damit: dieser Text ist
// unveraenderlich. Fuer alles andere gilt die Regel.
const HISTORIE = ['8.526.0', '8.587.0'];

// Zerlegt den PATCHNOTES-Block in { version, von, bis }. Gibt null zurueck, wenn der Anker fehlt -
// der Aufrufer behandelt das als Verstoss und nicht als "keine Ausnahmen" (Arbeitsregel 6: ein
// fehlender Anker darf eine Pruefung nicht still entschaerfen).
function patchnoteBereiche(html){
  const v = html.indexOf('  const PATCHNOTES = [');
  if (v < 0) return null;
  const b = html.indexOf('\n  ];', v);
  if (b < 0) return null;
  const bereiche = [];
  const re = /\n    \{ version:'([^']+)'/g;
  re.lastIndex = v;
  let m, offen = null;
  while ((m = re.exec(html)) && m.index < b){
    if (offen) { offen.bis = m.index; bereiche.push(offen); }
    offen = { version: m[1], von: m.index, bis: b };
  }
  if (offen) bereiche.push(offen);
  return { von: v, bis: b, eintraege: bereiche };
}

// Liefert die Verstoesse als Liste - leer heisst sauber. Jeder Eintrag nennt Art, Zeile und
// Umfeld, damit der Fehlschlag die Stelle benennt statt nur "irgendwo" (Arbeitsregel 37).
function hausstilVerstoesse(html){
  const raus = [];
  const zeileVon = pos => html.slice(0, pos).split('\n').length;
  const umfeld = pos => '…' + html.slice(Math.max(0, pos - 45), pos + 25).replace(/\s+/g, ' ') + '…';

  let p = html.indexOf(VERBOTEN);
  while (p >= 0){
    raus.push({ art: 'Literal U+201C', zeile: zeileVon(p), stelle: umfeld(p) });
    p = html.indexOf(VERBOTEN, p + 1);
  }

  const pn = patchnoteBereiche(html);
  ESCAPE.lastIndex = 0;
  let m;
  while ((m = ESCAPE.exec(html))){
    const pos = m.index;
    if (pn){
      const eintrag = pn.eintraege.find(e => pos >= e.von && pos < e.bis);
      if (eintrag && HISTORIE.includes(eintrag.version)) continue;   // unveraenderliche Historie
    }
    raus.push({ art: 'Escape ' + m[0] + (pn ? '' : ' (PATCHNOTES-Anker FEHLT)'),
                zeile: zeileVon(pos), stelle: umfeld(pos) });
  }
  return raus;
}

module.exports = { hausstilVerstoesse, HISTORIE, patchnoteBereiche };
