// "−" in der Flottenwahl rechnet vom ANGEZEIGTEN Wert (v8.435.0, Spieler-Report Task #26).
//
// DER FEHLER: Die gespeicherte Auswahl ist bewusst ein ungekappter "Wunsch" (getAttackSelection),
// ANGEZEIGT wird der auf das Verfuegbare gekappte Wert. "−" senkte aber den Wunsch: Wer 100 Jaeger
// gewaehlt und 90 unterwegs hatte, sah "10" und musste neunzig Mal druecken, ehe sich sichtbar
// etwas tat - fuer den Spieler "reagiert der Knopf nicht".
//
// GEPRUEFT WIRD AUSGEFUEHRT, nicht abgelesen: verdrahteFlottenwahlZeilen() wird aus der Datei
// geschnitten und mit gestellten Stubs (Auswahl, Verfuegbarkeit, Knopf-Attrappen) aufgerufen -
// dann werden die echten Handler geklickt. attackFleetSelection ist eine Modul-Variable ausserhalb
// des Spielstands, eine Browser-Fixture kann den Ueberhang-Zustand deshalb nicht stellen.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren ausgefuehrt): am alten Stand gibt ein Klick auf "−"
// bei Wunsch 100 / verfuegbar 10 den Wunsch 99 statt 9 - Pruefung 2a faellt durch.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

const von = JS.indexOf('function verdrahteFlottenwahlZeilen(');
const bis = JS.indexOf('\n  }', JS.indexOf("data-atksel-none", von));
check('1a: verdrahteFlottenwahlZeilen gefunden (Anker existieren)', von > 0 && bis > von);
const rumpf = JS.slice(von, bis + 4);

// Sandkasten: sel/avail gestellt, Knopf-Attrappen sammeln die onclick-Handler ein.
function aufbau(selStart, availStart){
  const sel = Object.assign({}, selStart);
  const avail = Object.assign({}, availStart);
  const handler = {};
  const knopf = (attr) => ({ getAttribute: () => 'jaeger', set onclick(f){ handler[attr] = f; }, get onclick(){ return handler[attr]; } });
  const wurzel = { querySelectorAll: (q) => {
    const art = (q.match(/data-atksel-(\w+)/) || [])[1];
    return art ? [knopf(art)] : [];
  } };
  let gezeichnet = 0;
  const fn = new Function('getAttackSelection', 'attackAvailableByType',
    rumpf + '\nreturn verdrahteFlottenwahlZeilen;')(() => sel, () => avail);
  fn(wurzel, 'home', {}, () => { gezeichnet++; });
  return { sel, handler, gezeichnetZahl: () => gezeichnet };
}

// ---- 2) Der gemeldete Fall: Wunsch 100, verfuegbar 10 -> ein Klick auf "−" gibt sichtbar 9.
{
  const { sel, handler } = aufbau({ jaeger: 100 }, { jaeger: 10 });
  handler.dec();
  check('2a: ein Klick auf "−" senkt den ANGEZEIGTEN Wert (10 -> 9), nicht den Wunsch (100 -> 99)',
    sel.jaeger === 9, sel.jaeger);
}
// ---- 3) Normalfall unveraendert: Auswahl unter dem Verfuegbaren.
{
  const { sel, handler, gezeichnetZahl } = aufbau({ jaeger: 5 }, { jaeger: 10 });
  handler.dec();
  check('3a: im Normalfall zaehlt "−" wie bisher (5 -> 4)', sel.jaeger === 4, sel.jaeger);
  check('3b: jeder Klick zeichnet neu', gezeichnetZahl() === 1);
  handler.dec(); handler.dec(); handler.dec(); handler.dec(); handler.dec();
  check('3c: unter null faellt nichts', sel.jaeger === 0, sel.jaeger);
}
// ---- 4) "+" bleibt am Verfuegbaren gedeckelt, "Max"/"Keine" unveraendert.
{
  const { sel, handler } = aufbau({ jaeger: 9 }, { jaeger: 10 });
  handler.inc(); handler.inc();
  check('4a: "+" deckelt am Verfuegbaren (9 -> 10, nicht 11)', sel.jaeger === 10, sel.jaeger);
  handler.none();
  check('4b: "Keine" setzt auf 0', sel.jaeger === 0);
  handler.max();
  check('4c: "Max" setzt auf das Verfuegbare', sel.jaeger === 10);
}

ende();
