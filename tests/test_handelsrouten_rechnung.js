// Handelsrouten: Karte und Abrechnung rechnen dieselbe Formel (15.08.2026).
//
// BEFUND. processTradeRoutes() rechnete den Ertrag, renderTradeRoutes() rechnete ihn ein zweites
// Mal für die Karte - und ZWEI von drei Routenarten wichen ab, plus die Vorschau für eine neue
// Route:
//   * Veredelungsroute: Die Karte multiplizierte mit yieldMult (Handels-Rolle 1,15 x
//     routeYieldMult(), also Routenoptimierung, Händler-Offizier, Handelsmodule bis +30% und
//     Kartell-Bonus). Die Abrechnung tat es nicht - sie rechnet nur `used * rate * protMult`.
//     Die Karte versprach damit einen Ertrag, den es nie gab.
//   * Verkaufsroute: Die Karte zog die Routenschutz-Gebühr von der MENGE ab. Die Abrechnung zieht
//     sie von den KREDITEN ab und verkauft die volle Menge. Wer den Schutz einschaltete, sah eine
//     um 10% zu niedrige Lagerentnahme - die Vorräte sanken schneller als angekündigt.
//   * Vorschau "Neue Route" (Kredite): zeigte creditsRouteYield(n) ROH, ohne die Handelsboni, die
//     die Route danach tatsächlich bekommt. Für ein entwickeltes Konto also zu wenig.
// Beide Abweichungen sind für den Spieler unsichtbar, weil er die Karte glaubt und den
// Kontostand nicht nachrechnet.
//
// DIE ZUSAGE DIESES TESTS: Es gibt nur EINE Ertragsrechnung. Nicht "die Zahlen stimmen heute
// überein" - das wäre eine Momentaufnahme (Arbeitsregel 3) -, sondern: keine Seite baut sich ihre
// Faktoren selbst zusammen. Deshalb prüft 3 die Rechenbausteine auf Alleinstellung: Wer
// ROUTE_SELL_PER_FRACHTER, ROUTE_TRANSPORT_PER_FRACHTER oder creditsRouteYield() irgendwo ANDERS
// als in seiner einen Helferfunktion multipliziert, fällt durch - auch als künftiger vierter
// Aufrufer, den heute noch niemand geschrieben hat.
//
// GEGENPROBE (Arbeitsregel 1, in beide Richtungen ausgeführt):
//   - Am Stand v8.508.0 fallen 1a-1e (keine der Helferfunktionen existiert) und 3 nennt die
//     Zeilen, an denen die zweite Formel steht.
//   - Setzt man am neuen Stand in routeSellMenge() den Schutzabzug wieder hinein, fällt 2c.
//   - Nimmt man routeHandelsMult() aus routeCreditsErtrag() heraus, fällt 2b.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');

/* Der PATCHNOTES-Block wird fuer die verneinenden und die zaehlenden Pruefungen unten
   herausgeschnitten (CLAUDE.md Regel 46). Grund: Ein Patchnote, der eine Behebung beschreibt,
   ZITIERT die alte Formulierung - und reisst damit genau die Pruefung, die diese Behebung
   festhaelt. Patchnotes sind unveraenderliche Historie, man kann den Wortlaut dort also nicht
   anpassen; die Pruefung muss sich anpassen.
   Die Regel gilt nicht nur fuer "steht NICHT mehr da": Auch ein ZAEHLER wird falsch, sobald ein
   Patchnote den gesuchten Text erwaehnt - in beide Richtungen. */
const S_OHNE_HISTORIE = (() => {
  const v = S.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : S.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? S.slice(0, v) + S.slice(b) : S;
})();

// ---- 1) Jede Helferfunktion existiert genau einmal ------------------------------------------
const HELFER = ['routeProtMult', 'routeHandelsMult', 'routeCreditsErtrag', 'routeSellMenge',
                'routeVeredelungEinsatz', 'routeVeredelungGewinn'];
HELFER.forEach((name, i) => {
  const n = (S.match(new RegExp('function ' + name + '\\s*\\(', 'g')) || []).length;
  check('1' + 'abcdef'[i] + ': ' + name + ' ist genau einmal definiert', n === 1, { gefunden: n });
});

// ---- 2) Der INHALT der Regeln, ausgeführt statt gelesen --------------------------------------
// Ein Test, der nur nachsieht, ob die Funktionsnamen dastehen, bliebe grün, wenn jemand die
// Faktoren verstellt. Deshalb wird der Block aus der Datei geschnitten und wirklich aufgerufen.
const von = S.indexOf('  function routeProtMult(route){');
const bis = S.indexOf('  function processTradeRoutes(){', von);
check('2a: der Rechenblock ist auffindbar', von >= 0 && bis > von, { von, bis });
if (von >= 0 && bis > von) {
  // Attrappen für alles, was der Block von außen ruft. Die Werte sind bewusst neutral (1 bzw. 0),
  // damit die geprüften Faktoren die EINZIGEN sind, die sich auswirken.
  const stubs = `
    const ROUTE_PROTECTION_FEE = 0.10, ROUTE_SELL_PER_FRACHTER = 40, ROUTE_TRANSPORT_PER_FRACHTER = 60;
    let ROLLE = false;
    function hasRoleAnywhere(){ return ROLLE; }
    function routeYieldMult(){ return 1; }
    function creditsRouteYield(n){ return 100 * n; }
    function setzeRolle(v){ ROLLE = v; }
  `;
  const f = new Function(stubs + S.slice(von, bis)
    + '\nreturn { prot: routeProtMult, handel: routeHandelsMult, credits: routeCreditsErtrag,'
    + ' sell: routeSellMenge, einsatz: routeVeredelungEinsatz, gewinn: routeVeredelungGewinn, rolle: setzeRolle };')();

  const offen = { frachter: 10, rate: 0.5 };
  const geschuetzt = { frachter: 10, rate: 0.5, protected: true };

  check('2b: die Handels-Rolle wirkt auf Kredit- und Verkaufsroute',
    (() => {
      f.rolle(false); const ohne = { c: f.credits(offen), s: f.sell(offen) };
      f.rolle(true);  const mit  = { c: f.credits(offen), s: f.sell(offen) };
      f.rolle(false);
      return Math.abs(mit.c / ohne.c - 1.15) < 1e-9 && Math.abs(mit.s / ohne.s - 1.15) < 1e-9;
    })());

  // Der eigentliche Fund: Die MENGE trägt den Schutzabzug nicht, der Ertrag schon.
  check('2c: der Routenschutz mindert die verkaufte Menge NICHT',
    f.sell(geschuetzt) === f.sell(offen), { offen: f.sell(offen), geschuetzt: f.sell(geschuetzt) });
  check('2d: er mindert dafür den Kreditertrag um die Gebühr',
    Math.abs(f.credits(geschuetzt) / f.credits(offen) - 0.90) < 1e-6,
    { offen: f.credits(offen), geschuetzt: f.credits(geschuetzt) });

  // Und die Veredelungsroute bekommt die Handelsboni bewusst nicht - das ist die Regel, an der
  // die Karte vorbeirechnete.
  check('2e: die Veredelungsroute bekommt die Handels-Rolle NICHT',
    (() => {
      const e = f.einsatz(offen);
      f.rolle(false); const ohne = f.gewinn(offen, e);
      f.rolle(true);  const mit  = f.gewinn(offen, e);
      f.rolle(false);
      return mit === ohne;
    })());
  check('2f: ihr Ertrag trägt dafür den Schutzabzug',
    Math.abs(f.gewinn(geschuetzt, f.einsatz(geschuetzt)) / f.gewinn(offen, f.einsatz(offen)) - 0.90) < 1e-6);
}

// ---- 3) Niemand baut sich die Faktoren ein zweites Mal zusammen ------------------------------
// Das ist die eigentliche Absicherung gegen einen künftigen vierten Aufrufer. Geprüft wird je
// Rechenbaustein, dass er außerhalb seiner Deklaration NUR in seiner Helferfunktion vorkommt.
// Kommentare vorher leeren (Arbeitsregel 33) - sonst zählt ein erklärender Kommentar, der die
// Formel zitiert, als zweite Rechenstelle.
const ohneKommentar = S_OHNE_HISTORIE
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/^([^\n]*?)\/\/[^\n]*$/gm, (m, vor) => vor);
const zeilen = ohneKommentar.split('\n');
const BAUSTEINE = [
  { name: 'ROUTE_SELL_PER_FRACHTER',      erlaubt: [/^\s*const ROUTE_SELL_PER_FRACHTER =/, /function routeSellMenge\(/] },
  { name: 'ROUTE_TRANSPORT_PER_FRACHTER', erlaubt: [/^\s*const ROUTE_TRANSPORT_PER_FRACHTER =/, /function routeVeredelungEinsatz\(/] },
  { name: 'creditsRouteYield(',           erlaubt: [/function creditsRouteYield\(/, /function routeCreditsErtrag\(/] }
];
for (const b of BAUSTEINE) {
  const treffer = [];
  zeilen.forEach((z, i) => { if (z.indexOf(b.name) >= 0) treffer.push({ zeile: i + 1, text: z.trim().slice(0, 100) }); });
  const fremd = treffer.filter(t => !b.erlaubt.some(r => r.test(t.text)));
  check('3: ' + b.name + ' wird nur an seiner einen Rechenstelle benutzt', fremd.length === 0, fremd);
}

// Gegenrichtung: Verschwindet eine Rechenstelle ganz (etwa weil jemand sie wieder inline schreibt),
// soll das genauso auffallen wie eine zusätzliche.
for (const b of BAUSTEINE) {
  const da = b.erlaubt.every(r => zeilen.some(z => z.indexOf(b.name) >= 0 && r.test(z.trim())));
  check('3-gegen: beide erlaubten Stellen von ' + b.name + ' sind noch da', da);
}

ende();
