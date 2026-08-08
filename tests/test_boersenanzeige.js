// Modulboerse zeigt Hauptwert-Wurf und Substats (v8.449.0, Task #40).
//
// HINTERGRUND (Regel-6-Fund): Seit der Wert-Streuung (v8.444.0) sahen ein 93%- und ein
// 107%-Exemplar desselben Moduls fuer Kaeufer identisch aus - die Angebotskarte nannte
// Name, Seltenheit, Stufe, Beschreibung und Anbieter, aber nicht die Guete. substatZeile()
// ist die gemeinsame Anzeige-Helferin aller anderen Modul-Anzeigeorte; die Boerse war die
// vergessene fuenfte Stelle.
//
// GEPRUEFT WIRD:
//   1) Die Boersen-Angebotskarte rendert die Guete-Zeile ueber substatZeile(info.subs,
//      info.wert) - INNERHALB von renderModuleMarket, nicht irgendwo in der Datei
//      (Regel 6: beide Slice-Anker muessen existieren, sonst ist die Pruefung vacuous).
//   2) Dieselbe Sichtbarkeits-Regel wie im Inventar: die Zeile erscheint, wenn Substats
//      ODER ein vom Glattwert abweichender Hauptwert da sind - sonst nicht.
//   3) Die Hilfe zur Modulboerse nennt Hauptwert-Wurf und Substats.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.448.0) fallen 1b und 3 durch.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) Guete-Zeile in der Angebotskarte, im richtigen Funktions-Slice
const von = JS.indexOf('function renderModuleMarket(){');
// Endanker: die naechste Funktions-/Konstanten-Definition nach der Boerse (aus dem Code
// abgelesen, Regel 4). Existenz wird geprueft, BEVOR gesliced wird (Regel 6).
const bis = von < 0 ? -1 : JS.indexOf('function renderTradeRoutes(){', von);
check('1a: renderModuleMarket-Slice gefunden (beide Anker existieren)', von > 0 && bis > von);
if (von < 0 || bis < 0) return ende();
const quelle = JS.slice(von, bis);
check('1b: die Angebotskarte rendert die Guete-Zeile ueber substatZeile',
  quelle.includes('substatZeile(info.subs, info.wert)'));
check('1c: dieselbe Sichtbarkeits-Regel wie im Inventar (Substats ODER Wurf != 100)',
  quelle.includes('(info&&(info.subs.length||(info.wert&&info.wert!==100)))'));
// Die Zeile gehoert zur Karte des Angebots (zwischen Beschreibung und Anbieter-Zeile),
// nicht in Kopf- oder Fusstext: Beschreibung davor, Anbieter danach.
{
  const pos = quelle.indexOf('substatZeile(info.subs, info.wert)');
  const beschreibung = quelle.indexOf('${info?info.def.desc:\'\'}');
  const anbieter = quelle.indexOf('Anbieter:');
  check('1d: die Guete-Zeile steht in der Angebotskarte (nach Beschreibung, vor Anbieter)',
    beschreibung > -1 && anbieter > -1 && beschreibung < pos && pos < anbieter,
    { beschreibung, pos, anbieter });
}

// ---- 2) substatZeile selbst traegt den Hauptwert (hat eigene Tests - hier nur der
// Vertrag, auf den sich die Boersen-Karte verlaesst: wert wird angezeigt, nicht verschluckt)
check('2: substatZeile nimmt den Hauptwert-Wurf entgegen und zeigt ihn',
  /function substatZeile\(subs, wert\)/.test(JS) && JS.includes('Hauptwert ${wert}%'));

// ---- 3) Hilfe
check('3: die Modulboersen-Hilfe nennt Hauptwert-Wurf und Substats',
  /Modulbörse[\s\S]{0,1200}Hauptwert-Wurf und Substats/.test(JS.slice(JS.indexOf("title:'Modulbörse"))));

ende();
