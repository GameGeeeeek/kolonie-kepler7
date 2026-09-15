// Jeder Faktor der Flugzeitkette hat einen Deckel (03.09.2026).
//
//   node tests/test_flugzeit_deckel.js
//
// DER ANLASS, gemessen: `missionDurationFor` multipliziert sechzehn Faktoren. Fünf davon tragen
// seit jeher die Form `Math.max(0.5, …)` - hoechstens die Haelfte, egal wie weit ausgebaut. Genau
// EINER fiel aus der Reihe: `Math.pow(0.97, f.spaeher||0)`, der Spaeher-Bonus, ohne jede
// Untergrenze. Die Papierrechnung aus den Werten der Funktion selbst:
//
//   die zehn gedeckelten Faktoren zusammen, alle maximal ....... 0,0147  (aus 60 Min: 53 s)
//   dazu 0,97^50 ............................................... 0,0032  (aus 60 Min: 12 s)
//   dazu 0,97^100 .............................................. 0,0007  (aus 60 Min:  2,5 s)
//
// Ein Spaeherstapel konnte damit jede Flugzeit gegen null druecken - und mit ihr jedes
// Reaktionsfenster eines Verteidigers, jede Abklingzeit, die an einer Ankunft haengt.
//
// WARUM DIESER TEST DIE REGEL PRUEFT UND NICHT DIE EINE ZEILE (Hausregel 40): Der Fehler war
// nicht "jemand hat den Deckel vergessen", sondern "ein Faktor waechst unbegrenzt, und niemand
// sieht es". Ein siebzehnter Faktor derselben Bauart faellt hier auf, ohne dass jemand an ihn
// gedacht haben muss. Geprueft wird deshalb JEDE `mult *=`-Zeile der Funktion gegen eine
// namentliche Liste der Formen, die nachweislich begrenzt sind.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');
const von = S.indexOf('  function missionDurationFor(');
const bis = von >= 0 ? S.indexOf('\n  }', von) : -1;
check('0-anker: missionDurationFor laesst sich schneiden', von >= 0 && bis > von, { von, bis });
if (von < 0 || bis < 0) { ende(); return; }
const RUMPF = S.slice(von, bis);
// Kommentare leeren, bevor gezaehlt wird: Der Block ueber dem Deckel zitiert die alte Zeile.
const CODE = RUMPF.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/^\s*\/\/.*$/gm, '');

/* Die erlaubten Formen. Jede steht hier MIT ihrer Begruendung, warum sie begrenzt ist - eine
   blanke Zahl ("es sind 16 Faktoren") waere eine Momentaufnahme und saegte beim naechsten
   Bonus ab (Hausregel 33). */
const BEGRENZT = [
  { was: 'Math.max(…)-Deckel',        muster: /Math\.max\(\s*0?\.\d+\s*,/ },
  { was: 'Anteil 0..1 (1 - x*frac)',  muster: /\(\s*1\s*-\s*0?\.\d+\s*\*\s*\w+/ },
  { was: 'feste Konstante',           muster: /\*=\s*0?\.\d+\s*;/ },
  /* Funktionen mit eigenem Deckel. wurmlochFlugMult kam am 03.09.2026 dazu und wurde von genau
     dieser Pruefung gemeldet, bevor er eingetragen war - das ist der Zweck der Liste: Ein neuer
     Faktor muss hier benannt werden, mit dem Nachweis, warum er begrenzt ist. Er gibt 0,75 oder
     1 zurueck, sonst nichts (Abschnitt 4 fuehrt das aus). */
  /* vorpostenFlugMult kam am 15.09.2026 dazu, als der Vorposten-Flugbonus von neun einzelnen
     Aufrufstellen in diese Kette wanderte. Sein Deckel steht im Client selbst
     (VORPOSTEN_FLUG_HARTDECKEL = 0,75, `Math.min` um den Serverwert): Ohne diese Klammer haenge
     die Grenze an dem, was der Server schickt - und ein `flugDeckel: 1` druecke den Faktor auf 0.
     Genau das ist der Nachweis, den diese Liste verlangt; Abschnitt 5 fuehrt ihn aus. */
  { was: 'Funktion mit eigenem Deckel', muster: /(fleetSpeedMultiplier|allianceBaseFlightMult|sektorFlugMult|wurmlochFlugMult|vorpostenFlugMult)\(/ },
  { was: 'Tempo-Buff (endliche Laufzeit)', muster: /buff\.mult/ }
];
const zeilen = CODE.split('\n').map(z => z.trim()).filter(z => /mult\s*\*?=/.test(z) && !/^let mult/.test(z));
check('1-vorab: die Faktorzeilen wurden gefunden', zeilen.length >= 12, { gefunden: zeilen.length });

const ungedeckelt = zeilen.filter(z => !BEGRENZT.some(b => b.muster.test(z)));
check('1: jeder Faktor der Flugzeitkette ist nachweislich begrenzt',
  ungedeckelt.length === 0,
  { ungedeckelt, erlaubteFormen: BEGRENZT.map(b => b.was),
    hinweis: 'ein Faktor ohne Grenze zieht die ganze Kette gegen null - siehe Kopf dieser Datei' });

// Der Anlassfall NAMENTLICH (Hausregel 33): Verschwindet der Spaeher-Bonus, ist das ein Befund,
// keine stille Erleichterung fuer diese Pruefung.
check('2: der Spaeher-Bonus gibt es noch UND er ist gedeckelt',
  /Math\.max\(0\.5,\s*Math\.pow\(0\.97,\s*f\.spaeher\|\|0\)\)/.test(CODE),
  { zeile: (CODE.match(/.*0\.97.*/) || ['(keine)'])[0].trim() });

/* Abschnitt 3: die WIRKUNG, ausgefuehrt. Die Regel oben liesse sich auch mit einem Deckel bei
   0,000001 erfuellen; gemessen wird deshalb die Zahl, die herauskommt (Regel 61/62). */
const fn = new Function('n', 'return Math.max(0.5, Math.pow(0.97, n||0));');
// 0,97^22 = 0,5117 und 0,97^23 = 0,4963 - der Deckel greift also ab dem 23. Spaeher. GEMESSEN,
// nicht geschaetzt: Der erste Entwurf dieser Datei behauptete 24 und fiel an dieser Stelle durch.
const punkte = { p0: fn(0), p10: fn(10), p22: fn(22), p23: fn(23), p100: fn(100) };
check('3a: bis 22 Spaeher aendert der Deckel nichts - der Bonus wirkt wie bisher',
  Math.abs(punkte.p0 - 1) < 1e-9 && Math.abs(punkte.p10 - Math.pow(0.97, 10)) < 1e-9
    && Math.abs(punkte.p22 - Math.pow(0.97, 22)) < 1e-9, punkte);
check('3b: ab 23 Spaehern greift er, und tiefer als die Haelfte geht es nie',
  punkte.p23 === 0.5 && punkte.p100 === 0.5 && Math.pow(0.97, 23) < 0.5 && Math.pow(0.97, 22) > 0.5, punkte);
// Die Gegenrichtung: OHNE Deckel faellt derselbe Wert auf ein Fuenfzigstel - das ist der Unterschied,
// um den es geht, und ohne diese Zeile belegte 3b nur, dass 0,5 gleich 0,5 ist.
check('3c: ohne Deckel waere derselbe Stapel 10-fach schneller',
  Math.pow(0.97, 100) < 0.05 && punkte.p100 / Math.pow(0.97, 100) > 10,
  { ohneDeckel: +Math.pow(0.97, 100).toFixed(5), mitDeckel: punkte.p100 });

/* ---- 4) Der neue Faktor, ausgefuehrt (V4 Passage, 03.09.2026) -------------------------------
   Der Eintrag in der Liste oben behauptet "begrenzt" - hier wird es gemessen. Geprueft wird die
   REGEL: an beiden Muendungen 0,75, sonst 1, und ein abgelaufenes Wurmloch wirkt gar nicht. */
let whFn = null, whBau = null;
try {
  /* BEIDE Funktionen schneiden: wurmlochFlugMult ruft seit dem 03.09.2026 wurmlochOffen(), und ein
     Schnitt, der nur die eine mitnimmt, stirbt mit "wurmlochOffen is not defined" - im vollen Lauf
     gemessen, nachdem der Einzellauf noch gruen war. Dieselbe Fehlerklasse wie die
     HERKUNFT-Preludes: Wer eine Funktion aus der Spieldatei schneidet, muss ihre Aufrufe
     mitschneiden, statt sie zu erraten. */
  const aOffen = S.indexOf('  function wurmlochOffen(){');
  const eOffen = aOffen >= 0 ? S.indexOf('\n  }', aOffen) : -1;
  const a = S.indexOf('  function wurmlochFlugMult(sysId){');
  const e = a >= 0 ? S.indexOf('\n  }', a) : -1;
  if (a < 0 || e < 0 || aOffen < 0 || eOffen < 0) throw new Error('Anker nicht gefunden');
  whFn = (cache) => new Function('galaxyCache',
    S.slice(aOffen, eOffen + 4) + '\n' + S.slice(a, e + 4) + '\n return wurmlochFlugMult;')(cache);
} catch(err){ whBau = String(err.message || err); }
check('4-bau: wurmlochFlugMult laesst sich schneiden und ausfuehren', whBau === null, { whBau });
if (whFn){
  const offen = whFn({ activeWormhole: { from:'kepler', to:'abyss', expiresAt: Date.now() + 3600000 } });
  const zu    = whFn({ activeWormhole: { from:'kepler', to:'abyss', expiresAt: Date.now() - 1000 } });
  const ohne  = whFn({ activeWormhole: null });
  const werte = { keplerOffen: offen('kepler'), abyssOffen: offen('abyss'), fremdOffen: offen('vega'),
    ohneZiel: offen(null), abgelaufen: zu('kepler'), keinWurmloch: ohne('kepler') };
  check('4a: an BEIDEN Muendungen gilt 0,75 - das Wurmloch hat zwei Enden',
    werte.keplerOffen === 0.75 && werte.abyssOffen === 0.75, werte);
  check('4b: jedes andere System und ein fehlendes Ziel bleiben unberuehrt',
    werte.fremdOffen === 1 && werte.ohneZiel === 1, werte);
  check('4c: ein abgelaufenes oder fehlendes Wurmloch wirkt nicht',
    werte.abgelaufen === 1 && werte.keinWurmloch === 1, werte);
}

/* ---- 5) Der Vorposten-Faktor, ausgefuehrt (15.09.2026) ---------------------------------------
   Seit der Ausdehnung auf jede Missionsart mit Zielsystem steht er in dieser Kette. Der Eintrag
   in der Liste oben behauptet „begrenzt" - hier wird es gemessen, und zwar gegen den Fall, der
   die Begrenzung ueberhaupt noetig macht: Der Deckel kommt VOM SERVER. Ein Serverstand mit
   `flugDeckel: 1` ist kein Hirngespinst, sondern genau die Art Feld, die sich aendert, ohne dass
   jemand an diese Kette denkt - und er druecke den Faktor ohne die Klammer auf 0. */
let vpFn = null, vpBau = null;
try {
  const aAn = S.indexOf('  function vorpostenAn(sysId){');
  const eAn = aAn >= 0 ? S.indexOf('\n', aAn) : -1;
  const aDarf = S.indexOf('  function vorpostenDarfMitwirken(v){');
  const eDarf = aDarf >= 0 ? S.indexOf('\n', aDarf) : -1;
  const a = S.indexOf('  function vorpostenFlugMult(sysId){');
  const e = a >= 0 ? S.indexOf('\n  }', a) : -1;
  const hart = Number((S.match(/const VORPOSTEN_FLUG_HARTDECKEL = ([\d.]+);/) || [])[1]);
  const basis = Number((S.match(/const VORPOSTEN_FLUG_DECKEL = ([\d.]+);/) || [])[1]);
  if (a < 0 || e < 0 || aAn < 0 || aDarf < 0 || !(hart > 0) || !(basis > 0)) throw new Error('Anker nicht gefunden');
  /* Wie bei Abschnitt 4: die AUFRUFE mitschneiden statt sie zu erraten. vorpostenFlugMult ruft
     vorpostenAn und vorpostenDarfMitwirken; vorpostenAn ruft vorpostenImSystem, das hier durch
     die uebergebene Liste ersetzt wird - das ist die einzige Stelle, an der der Test etwas
     nachbaut, und sie ist reine Datenhaltung. */
  vpFn = (vp) => new Function('liste',
    'function vorpostenImSystem(sysId){ return (liste||[]).filter(v => v && v.sys === sysId); }\n'
    + S.slice(aAn, eAn) + '\n' + S.slice(aDarf, eDarf) + '\n'
    + 'const VORPOSTEN_FLUG_DECKEL = ' + basis + ';\n'
    + 'const VORPOSTEN_FLUG_HARTDECKEL = ' + hart + ';\n'
    + S.slice(a, e + 4) + '\n return vorpostenFlugMult;')(vp);
} catch(err){ vpBau = String(err.message || err); }
check('5-bau: vorpostenFlugMult laesst sich schneiden und ausfuehren', vpBau === null, { vpBau });
if (vpFn){
  const mit = (nutzen, eigener) => vpFn([{ sys:'vega', eigener: eigener !== false, nutzen }])('vega');
  const werte = {
    ohneZiel:   vpFn([])(null),
    fremd:      vpFn([{ sys:'vega', eigener:false, verbuendet:false, nutzen:{ flug:0.9, flugDeckel:0.9 } }])('vega'),
    normal:     mit({ flug:0.20, flugDeckel:0.5 }),
    amDeckel:   mit({ flug:0.90, flugDeckel:0.5 }),
    mitTor:     mit({ flug:0.90, flugDeckel:0.75 }),
    serverGier: mit({ flug:0.99, flugDeckel:1 }),
    deckelWeg:  mit({ flug:0.99, flugDeckel:-5 })
  };
  check('5a: ohne Zielsystem und an einem FREMDEN Vorposten wirkt er gar nicht',
    werte.ohneZiel === 1 && werte.fremd === 1, werte);
  check('5b: der Anteil wirkt, solange er unter dem Deckel liegt',
    Math.abs(werte.normal - 0.8) < 1e-9, werte);
  check('5c: der Deckel des Servers greift - 0,5 ohne Tor, 0,75 mit Tor',
    Math.abs(werte.amDeckel - 0.5) < 1e-9 && Math.abs(werte.mitTor - 0.25) < 1e-9, werte);
  /* DIE EIGENTLICHE ZUSAGE dieses Abschnitts: Was der Server auch schickt, tiefer als ein Viertel
     geht es nie. Ohne die Klammer im Client waere `serverGier` gemessen 0 - und mit ihr faellt
     die ganze Flugzeitkette auf null, samt jedem Reaktionsfenster, das daran haengt. */
  check('5d: ein masslos hoher Deckel vom Server aendert daran nichts - nie unter ein Viertel',
    werte.serverGier === 0.25, { serverGier: werte.serverGier, erwartet: 0.25, alle: werte });
  /* Und die andere Richtung: Ein negativer Deckel darf den Faktor nicht ueber 1 heben (das waere
     eine Flugzeit-VERLAENGERUNG aus einem kaputten Serverfeld). Gemessen kommt 1 heraus - der
     Vorposten wirkt dann gar nicht, was der richtige Ausfall ist. */
  check('5e: ein negativer Deckel schaltet den Bonus ab, statt den Flug zu verlaengern',
    werte.deckelWeg === 1, { deckelWeg: werte.deckelWeg, erwartet: 1 });
}

ende();
