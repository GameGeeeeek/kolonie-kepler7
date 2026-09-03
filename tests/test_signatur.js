// Die Signatur - wie schwer ein Rumpf zu verbergen ist (03.09.2026, Auftrag Sascha).
//
//   node tests/test_signatur.js
//
// ANLASS: "wichtig ist er darf nirgends vergessen werden in formeln anzeige wenn man schiffe baut
// module etc" - das ist der Auftrag, und dieser Test ist seine Umsetzung. Eine handgepflegte Zahl
// an 46 Schiffen verliert ihre Vollstaendigkeit beim naechsten neuen Schiff, und niemand merkt es:
// Ein fehlender Wert faellt auf 0 zurueck, und 0 heisst "unsichtbar". Ein neues Grosskampfschiff
// waere damit ausgerechnet das am besten getarnte Schiff des Spiels.
//
// DIESES PROJEKT HAT DIESE FEHLERKLASSE HEUTE ZWEIMAL GEHABT: vier Schiffsklassen ohne Eintrag in
// rawFleetPower (zehn Monate lang 0 Angriff serverseitig) und der Kausalitaetsbrecher ohne
// Konterrolle. Beide Male stand der Wert in einer Tabelle und fehlte in der zweiten.
//
// GEPRUEFT WIRD:
//   1) Jede Klasse in SHIP_DEFS hat einen Signaturwert, ganzzahlig und im Bereich 1 bis 1000.
//   2) Das Superschlachtschiff auch - es steht in KEINER Liste und hat deshalb einen eigenen Zweig
//      in shipSignatur(). Genau daran ist es bei frueheren Vollstaendigkeitspruefungen gescheitert.
//   3) DIE KANTE: Zwischen 241 und 599 steht kein einziges Schiff. Das ist "ab Grosskampfschiff
//      praktisch unmoeglich" als messbare Eigenschaft - ein Loch, keine Rampe. Waechst es zu, ist
//      die Entscheidung, um die es geht, verwaessert.
//   4) Die beiden Spaeher tragen die niedrigsten Werte des Spiels - sie sind dafuer gebaut.
//   5) fleetSignatur() ist ein MAXIMUM, ausgefuehrt gemessen: Ein einziges grosses Schiff verraet
//      den Verband. Summe und Mittelwert werden ausdruecklich ausgeschlossen.
//   6) Beide Anzeigestellen der Flottenauswahl zeigen die Signatur - die Zeile wird an zwei
//      Stellen gezeichnet, und beim ersten Anlauf haette ich fast nur eine erwischt.
//
// GEGENPROBE (beidseitig, GEMESSEN am 03.09.2026):
//   KEPLER_SPIELDATEI=<Spieldatei vor dieser Aenderung> node tests/test_signatur.js
//   Exit 1, es fallen GENAU SECHS Pruefungen, und vier bleiben gruen:
//     FAIL - 0a: shipSignatur() und fleetSignatur() sind auffindbar  (beide false)
//     FAIL - 1a: jede Klasse in SHIP_DEFS hat einen Signaturwert     (alle 45 ohne)
//     FAIL - 3a: zwischen 241 und 599 steht kein Schiff              (es gibt gar keine Werte)
//     FAIL - 3b: es gibt Schiffe auf BEIDEN Seiten der Luecke        (0 darunter, 0 darueber)
//     FAIL - 4a: die beiden Spaeher sind die leisesten Schiffe       (beide null)
//     FAIL - 6a: beide Anzeigestellen zeigen die Signatur            (0 von 2)
//   Gruen bleiben dort 0z, 0y, 1b und 6b - die vier Pruefungen, die den MESSAUFBAU sichern und
//   nicht den Messgegenstand. 1b ist gruen, weil eine leere Wertemenge keinen Wert ausserhalb des
//   Bereichs enthaelt; 6b, weil es die zwei Anzeigezeilen schon vorher gab.
//
//   ICH HATTE HIER ZUERST FUENF STEHEN und 3b nicht auf der Liste. Die Messung hat es korrigiert -
//   heute zum dritten Mal (siehe test_rangnamen und test_angriffssumme). Die Lehre ist inzwischen
//   deutlich: Eine Pflichtliste, die man sich zusammenreimt, ist im Zweifel falsch, und zwar
//   systematisch zu KURZ - man denkt an die Pruefung, die man gebaut hat, nicht an die
//   Gegenprobe, die daran haengt.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

function schnitt(von, bis){
  const a = JS.indexOf(von);
  if (a < 0) return null;
  const b = JS.indexOf(bis, a);
  if (b < 0) return null;
  return JS.slice(a, b + bis.length);
}

// ---- Die Werte aus SHIP_DEFS lesen. Ausfuehren geht hier NICHT: SHIP_DEFS verweist auf Dutzende
// Kostenfunktionen, die weiter unten stehen. Gelesen wird deshalb der Quelltext - und die
// FUNKTIONEN darunter werden dann sehr wohl ausgefuehrt, mit diesen Werten als Datengrundlage.
const DEFS = schnitt('const SHIP_DEFS = [', '\n  ];');
check('0z: SHIP_DEFS ist auffindbar', !!DEFS && DEFS.length > 5000, DEFS ? DEFS.length : null);
if (!DEFS) return ende();

// EIN Schiff je Zeile, und der ERSTE Treffer der Zeile ist sein Schluessel. Wichtig, weil in
// derselben Zeile weitere {key:'...'}-Objekte stehen: die requires-Listen ("{key:'rsingularitaet',
// level:5}"). Ein Suchmuster ueber den ganzen Block zaehlt die mit und meldet dann 59 Klassen statt
// 45 - genau das ist beim Schreiben dieses Tests passiert, und die Vollstaendigkeitspruefung hat es
// gemeldet, weil Forschungsschluessel natuerlich keinen Signaturwert tragen.
const klassen = [], werte = {};
for (const zeile of DEFS.split('\n')){
  const k = /^\s*\{ ?key:'([a-zA-Z]+)'/.exec(zeile);
  if (!k) continue;
  klassen.push(k[1]);
  const s = /signatur:(\d+)/.exec(zeile);
  if (s) werte[k[1]] = +s[1];
}
check('0y: es wurden ueberhaupt Klassen gefunden (sonst misst der Rest nichts)',
  klassen.length >= 40, klassen.length);

const fnSig = schnitt('function shipSignatur(', '\n  }');
const fnFleet = schnitt('function fleetSignatur(', '\n  }');
check('0a: shipSignatur() und fleetSignatur() sind auffindbar', !!fnSig && !!fnFleet,
  { shipSignatur: !!fnSig, fleetSignatur: !!fnFleet });

// ---- 1) Vollstaendigkeit ------------------------------------------------------------------------
const ohne = klassen.filter(k => werte[k] === undefined);
check('1a: jede Klasse in SHIP_DEFS hat einen Signaturwert', ohne.length === 0,
  { anzahl: ohne.length, ohne: ohne.slice(0, 8) });
const ausserhalb = Object.entries(werte).filter(([, v]) => !(Number.isInteger(v) && v >= 1 && v <= 1000));
check('1b: jeder Wert ist ganzzahlig und liegt zwischen 1 und 1000', ausserhalb.length === 0, ausserhalb);

// ---- 2) Das Superschlachtschiff ------------------------------------------------------------------
// Es steht in keiner Liste des Spiels. Genau deshalb bekommt es hier eine eigene Pruefung: Ein
// Vollstaendigkeitstest, der nur ueber SHIP_DEFS laeuft, wuerde es nie vermissen.
let API = null;
if (fnSig && fnFleet){
  try {
    const stub = 'const SHIP_DEFS = ' + JSON.stringify(klassen.map(k => ({ key: k, signatur: werte[k] }))) + ';\n'
      + 'function currentFleet(){ return {}; }\n';
    API = new Function(stub + fnSig + '\n' + fnFleet + '; return { shipSignatur, fleetSignatur };')();
  } catch(e){
    check('2z: die Funktionen lassen sich ausfuehren', false, { fehler: String(e && e.message) });
  }
}
if (API){
  check('2z: die Funktionen lassen sich ausfuehren', true);
  const sSuper = API.shipSignatur('superschlachtschiff');
  check('2a: das Superschlachtschiff hat einen eigenen Signaturwert',
    Number.isInteger(sSuper) && sSuper >= 1 && sSuper <= 1000, sSuper);
  check('2b: ein unbekannter Schluessel liefert 0 statt undefined (Anzeige bliebe sonst leer)',
    API.shipSignatur('gibtesnicht') === 0, API.shipSignatur('gibtesnicht'));
}

// ---- 3) Die Kante -------------------------------------------------------------------------------
const alleWerte = Object.values(werte).concat(API ? [API.shipSignatur('superschlachtschiff')] : []);
const inDerLuecke = Object.entries(werte).filter(([, v]) => v >= 241 && v <= 599);
check('3a: zwischen 241 und 599 steht kein Schiff - die Kante ist ein Loch, keine Rampe',
  inDerLuecke.length === 0 && alleWerte.length > 0, inDerLuecke);
// Gegenprobe zur Zeile darueber: Es MUSS Schiffe auf beiden Seiten der Luecke geben, sonst waere
// sie leer, weil die Skala gar nicht so weit reicht - und 3a waere still gruen.
check('3b: und es gibt Schiffe auf BEIDEN Seiten der Luecke (Gegenprobe zu 3a)',
  alleWerte.some(v => v <= 240) && alleWerte.some(v => v >= 600),
  { darunter: alleWerte.filter(v => v <= 240).length, darueber: alleWerte.filter(v => v >= 600).length });

// ---- 4) Die Spaeher -----------------------------------------------------------------------------
const leiseste = Math.min(...alleWerte);
const spaeherWerte = ['spaeher', 'spionageschiff'].map(k => werte[k]);
const andere = Object.entries(werte).filter(([k]) => k !== 'spaeher' && k !== 'spionageschiff').map(([, v]) => v);
check('4a: die beiden Spaeher tragen die niedrigsten Werte des Spiels',
  spaeherWerte.every(v => typeof v === 'number') && Math.max(...spaeherWerte) < Math.min(...andere),
  { spaeher: spaeherWerte, naechsthoeher: Math.min(...andere), leiseste });

// ---- 5) Die Flottenregel, AUSGEFUEHRT -------------------------------------------------------------
if (API){
  const klein = { jaeger: 500, spaeher: 20, hyperjaeger: 80 };
  const mitGross = Object.assign({}, klein, { schlachtschiff: 1 });
  const sKlein = API.fleetSignatur(klein);
  const sGross = API.fleetSignatur(mitGross);
  check('5a: ein einziges grosses Schiff verraet den ganzen Verband',
    sGross === werte.schlachtschiff && sGross > sKlein, { ohne: sKlein, mitEinemSchlachtschiff: sGross });
  check('5b: die Flotte ist so sichtbar wie ihr sichtbarstes Schiff (Maximum, nicht Summe)',
    sKlein === Math.max(werte.jaeger, werte.spaeher, werte.hyperjaeger), sKlein);
  // Die Gegenprobe zur Regel: Bei einer SUMME waeren 500 Jaeger sichtbarer als ein Schlachtschiff,
  // bei einem MITTELWERT liesse sich das Schlachtschiff dahinter verstecken. Beides waere kaputt.
  check('5c: 500 Jaeger bleiben leiser als ein einzelnes Schlachtschiff (schliesst die Summe aus)',
    sKlein < werte.schlachtschiff, { fuenfhundertJaeger: sKlein, einSchlachtschiff: werte.schlachtschiff });
  check('5d: das Schlachtschiff versteckt sich nicht hinter 500 Jaegern (schliesst den Mittelwert aus)',
    sGross === werte.schlachtschiff, sGross);
  check('5e: eine leere Flotte hat Signatur 0', API.fleetSignatur({}) === 0, API.fleetSignatur({}));
  check('5f: Schiffe mit Anzahl 0 zaehlen nicht mit',
    API.fleetSignatur({ schlachtschiff: 0, jaeger: 3 }) === werte.jaeger,
    API.fleetSignatur({ schlachtschiff: 0, jaeger: 3 }));
}

// ---- 6) Anzeigestellen ----------------------------------------------------------------------------
// Die Zeile der Flottenauswahl wird an ZWEI Stellen gezeichnet. Beim Einbau hat mein erster
// Suchtreffer nur eine erwischt; die Zaehlpruefung hat es gemeldet, bevor etwas geschrieben wurde.
const anzeigen = (JS.match(/· Signatur \$\{shipSignatur\(k\)\}/g) || []).length;
check('6a: beide Anzeigestellen der Flottenauswahl zeigen die Signatur', anzeigen === 2, { gefunden: anzeigen });
// Gegenprobe: Es gibt wirklich zwei solche Zeilen - sonst waere 6a eine Behauptung ueber nichts.
const zeilen = (JS.match(/Angriffspunkte je Schiff:/g) || []).length;
check('6b: und es gibt genau zwei solche Zeilen (Gegenprobe zu 6a)', zeilen === 2, { gefunden: zeilen });

ende();
