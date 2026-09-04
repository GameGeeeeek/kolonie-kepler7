// Tarnung, Etappe 1 - das Verstecken und seine Gegenwehr (03.09.2026, Auftrag Sascha).
//
//   node tests/test_tarnung.js
//
// ANLASS: "es muss eine gegenwehr fuer getarnte flotten geben, logisch kleine schiffe besser zu
// tarnen, grosse beinahe unmoeglich." Die Signatur aus v8.660.0 bekommt hier ihre Wirkung. Fuenf
// Eigenschaften halten das System zusammen; faellt eine davon, ist die Tarnung entweder wirkungslos
// oder unehrlich - und beides merkt ein Spieler erst, wenn er einen Kampf verloren hat.
//
// GEPRUEFT WIRD:
//   1) DIE GRENZE. TARNUNG_GRENZE haengt an der leeren Stelle der Signaturskala: kein Schiff darf
//      zwischen dem hoechsten tarnbaren und der Grenze liegen. Die Werftkarte verspricht seit
//      v8.660.0 "ab 600 nicht zu verbergen" - dieser Test haelt die Zusage und die Mechanik
//      zusammen. Ausgefuehrt gemessen, nicht am Text abgelesen.
//   2) DER PREIS WIRD WIRKLICH ABGEZOGEN. Die eigentliche Falle dieser Etappe:
//      applySoftCappedGain() hat negative Betraege bis heute STILL verschluckt. Der Test fuehrt die
//      Funktion aus und prueft, dass ein Verbrauch ankommt und bei 0 haelt.
//   3) DER VERBRAUCH STEHT IN ratesPerSecond(). Nicht daneben: 14 Aufrufer lesen diese eine
//      Rechnung. Ein Verbrauch, den nur die Flottenansicht kennt, waere an dreizehn Stellen falsch.
//   4) DIE WIRKUNG IST ECHT. Getarnte Klassen verschwinden aus BEIDEN Broadcast-Kanaelen
//      (Bestenlisten-Eintrag und missions:<id>), und Punktestand/Verteidigung bleiben unangetastet:
//      verborgen wird WAS, nicht WIE VIEL.
//   5) DER AUSFALL IST LAUT, und die Gegenwehr staffelt. sensorUrteil() wird ausgefuehrt und muss
//      drei Stufen liefern; ein zweistufiges Urteil waere die Schwelle, die der Entwurf
//      ausdruecklich vermeidet.
//
//   6) DIE ZEHN ZUSAGEN. Der alte Satz neben der neuen Mechanik ist die Fehlerklasse, an der dieses
//      Projekt regelmaessig scheitert. Gruppe 6 prueft in BEIDE Richtungen: "Aufklaerung zeigt sie
//      dir" muss den Vorbehalt tragen (6c) - und "Nach dem Kampf siehst du ohnehin, was dort stand"
//      muss UNVERAENDERT stehen bleiben (6d), weil der Kampfbericht bewusst nicht angetastet wurde.
//      Eine Ehrlichkeitspruefung, die nur streicht, wuerde eine wahre Zusage mit wegreissen.
//
// GEGENPROBE, BEIDSEITIG UND GEMESSEN (03.09.2026):
//
// a) Am Stand VOR dieser Aenderung (git show 3557299:weltraum_kolonie.html):
//      KEPLER_SPIELDATEI=<alte Datei> node tests/test_tarnung.js  ->  Exit 1
//    Es fallen 0a und 0b (beide Konstanten null), danach bricht der Test ab. Das ist gewollt: Ohne
//    TARNUNG_GRENZE waeren alle folgenden Pruefungen vacuous, und ein Test, der aus dem falschen
//    Grund gruen ist, ist so schlecht wie ein roter. Der Abbruch IST hier der Befund.
//
// b) Weil ein Abbruch nach zwei Pruefungen wenig ueber die einzelnen Regeln sagt, zusaetzlich drei
//    GEZIELTE Sabotagen am neuen Stand. Jede fiel genau dort, wo sie sollte:
//      - Verbrauchszweig aus applySoftCappedGain entfernt
//          FAIL 2b (Vorrat blieb 100 statt 70) und 2c (blieb 5 statt 0)
//          Genau der stille Ausfall, den dieser Test verhindern soll: nichts kracht, es kostet nur
//          nichts mehr.
//      - Abzug aus ratesPerSecond entfernt          -> FAIL 3b und 3c
//      - sensorUrteil auf zwei Stufen verkuerzt     -> FAIL 5e
//        NUR 5e. 5g und 5h bleiben gruen, weil "blind" und "groesse" beide weiter vorkommen - 5e ist
//        die einzige Pruefung, die die harte Schwelle ueberhaupt bemerkt. Ohne sie waere die
//        Zwischenstufe des Entwurfs unbewacht.
//
// c) Gruppe 7 kam nach dem gegnerischen Gegenlesen des eigenen Diffs dazu (der Review-Bot war am
//    Nutzungslimit). Drei weitere Sabotagen, alle gemessen:
//      - Hysterese zurueckgebaut auf eine Schwelle -> FAIL 7c mit {laufend:true, nachAusfall:true}
//        Das IST das Flattern, woertlich: derselbe Vorrat, beide Male an.
//      - Schmutzpruefung entfernt                  -> FAIL 7f
//      - Energiezustand aus der Kennung genommen   -> FAIL 7g
//    Die dritte ist die feinste: Die Box zeichnete dann zwar seltener, aber die Zeile "Tarnung
//    ausgefallen" waere festgefroren, waehrend sie laengst wieder laeuft - eine Anzeige-Luege, die
//    durch die BEHEBUNG der ersten entstanden waere.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// Ein Funktionsrumpf wird herausgeschnitten und AUSGEFUEHRT. Gesucht wird ueber den Kopf plus die
// schliessende Klammer auf derselben Einrueckung - dasselbe Muster wie in test_tiefenflotte.js.
function fnAus(name){
  const kopf = '\n  function ' + name + '(';
  const a = JS.indexOf(kopf);
  if (a < 0) return null;
  const b = JS.indexOf('\n  }', a);
  if (b < 0) return null;
  return JS.slice(a + 1, b + 4);
}
function zahl(name){
  const m = new RegExp('const ' + name + ' = ([0-9.]+);').exec(JS);
  return m ? +m[1] : null;
}

// ---- 0: der Messaufbau selbst -----------------------------------------------------------------
const GRENZE = zahl('TARNUNG_GRENZE');
const FAKTOR = zahl('TARN_ENERGIE_JE_SIGNATUR');
check('0a: TARNUNG_GRENZE ist gesetzt', GRENZE === 600, GRENZE);
check('0b: TARN_ENERGIE_JE_SIGNATUR ist gesetzt', typeof FAKTOR === 'number' && FAKTOR > 0, FAKTOR);
const DEFS = (() => {
  const a = JS.indexOf('const SHIP_DEFS = [');
  const b = a < 0 ? -1 : JS.indexOf('\n  ];', a);
  return a < 0 || b < 0 ? null : JS.slice(a, b);
})();
check('0c: SHIP_DEFS ist auffindbar', !!DEFS && DEFS.length > 5000, DEFS ? DEFS.length : null);
if (!DEFS || GRENZE === null) return ende();

const werte = [];
for (const zeile of DEFS.split('\n')){
  if (!/^\s*\{ ?key:'[a-zA-Z]+'/.test(zeile)) continue;
  const s = /signatur:(\d+)/.exec(zeile);
  if (s) werte.push(+s[1]);
}
werte.push(800);   // Superschlachtschiff, steht in keiner Liste

// ---- 1: die Grenze haengt am leeren Bereich, nicht in der Luft --------------------------------
const unter = werte.filter(v => v < GRENZE);
const ueber = werte.filter(v => v >= GRENZE);
check('1a: es gibt Schiffe auf beiden Seiten der Grenze',
  unter.length > 0 && ueber.length > 0, { unter: unter.length, ueber: ueber.length });
// DAS ist die eigentliche Aussage: Die Grenze schneidet nicht mitten durch das Feld, sondern liegt
// in der Luecke. Rutschte sie auf 500, wuerde diese Pruefung NICHT fallen (dort steht auch nichts) -
// deshalb prueft 1c zusaetzlich, dass zwischen dem hoechsten tarnbaren Wert und der Grenze ein
// spuerbarer Abstand liegt. Eine Grenze direkt ueber dem hoechsten tarnbaren Schiff waere eine
// Rampe, keine Kante.
const hoechsterTarnbar = Math.max(...unter);
const niedrigsterUnverbergbar = Math.min(...ueber);
check('1b: kein Schiff liegt zwischen dem hoechsten tarnbaren Wert und der Grenze',
  !werte.some(v => v > hoechsterTarnbar && v < GRENZE), { hoechsterTarnbar, GRENZE });
check('1c: die Grenze liegt in einer echten Luecke, nicht knapp ueber dem letzten Schiff',
  (niedrigsterUnverbergbar - hoechsterTarnbar) >= 200, { hoechsterTarnbar, niedrigsterUnverbergbar });

// ---- 2: der Preis wird wirklich abgezogen -----------------------------------------------------
// Die Falle dieser Etappe. applySoftCappedGain() kannte bis heute nur Zuwaechse und beantwortete
// "rawGain <= 0" mit "nichts zu tun". Mit einem laufenden Verbraucher waere das ein stiller
// Fehler gewesen: Die Anzeige zeigt den Verbrauch, das Lager spuert ihn nie.
const gainQuelle = fnAus('applySoftCappedGain');
check('2a: applySoftCappedGain ist auffindbar', !!gainQuelle, gainQuelle ? gainQuelle.length : null);
if (gainQuelle){
  const gain = new Function('SOFT_CAP_OVERFLOW_RATE, baustelleAbzweigen',
    gainQuelle + '; return applySoftCappedGain;')(0.1, (k, v) => v);
  const r1 = { energie: 100 };
  gain(r1, 'energie', -30, 1000);
  check('2b: ein negativer Betrag wird abgezogen', r1.energie === 70, r1.energie);
  const r2 = { energie: 5 };
  gain(r2, 'energie', -40, 1000);
  check('2c: der Abzug haelt bei 0 an, kein negativer Vorrat', r2.energie === 0, r2.energie);
  const r3 = { energie: 100 };
  gain(r3, 'energie', 25, 1000);
  check('2d: ein Zuwachs verhaelt sich unveraendert', r3.energie === 125, r3.energie);
}

// ---- 3: der Verbrauch steht in der EINEN Rechnung ---------------------------------------------
const ratesQuelle = (() => {
  const a = JS.indexOf('\n  function ratesPerSecond(');
  const b = a < 0 ? -1 : JS.indexOf('\n    return rates;', a);
  return a < 0 || b < 0 ? null : JS.slice(a, b);
})();
check('3a: ratesPerSecond ist auffindbar', !!ratesQuelle, ratesQuelle ? ratesQuelle.length : null);
check('3b: der Tarnverbrauch wird in ratesPerSecond abgezogen',
  !!ratesQuelle && /rates\.energie\s*-=\s*tarnEnergieProSek\(\)/.test(ratesQuelle));
// Nicht die Schreibweise des Aufrufs, sondern die AUSSAGE: Der Abzug haengt an tarnungAktiv(),
// laeuft also nicht weiter, wenn die Tarnung ausgefallen ist.
check('3c: der Abzug haengt an tarnungAktiv()',
  !!ratesQuelle && /tarnungAktiv\(\)[\s\S]{0,80}tarnEnergieProSek\(\)/.test(ratesQuelle));

// ---- 4: die Wirkung ist echt, in BEIDEN Kanaelen ----------------------------------------------
// Kanal 1: der Bestenlisten-Eintrag. Die 13 Schiffsfelder muessen ueber den Tarnfilter laufen.
const eintrag = (() => {
  const a = JS.indexOf("await storageSet('leaderboard:'+state.player.id");
  const b = a < 0 ? -1 : JS.indexOf('defensePower:', a);
  return a < 0 || b < 0 ? null : JS.slice(a, b);
})();
check('4a: der Bestenlisten-Eintrag ist auffindbar', !!eintrag, eintrag ? eintrag.length : null);
if (eintrag){
  const gefiltert = (eintrag.match(/: tz\('/g) || []).length;
  const ungefiltert = (eintrag.match(/: fuzz\(allFleets\(\)/g) || []).length;
  check('4b: alle Schiffsfelder laufen ueber den Tarnfilter',
    gefiltert === 13 && ungefiltert === 0, { gefiltert, ungefiltert });
}
// Der Punktestand bleibt UNGEFILTERT - das ist die tragende Regel und keine Nachlaessigkeit.
// Wuerde er mitgetarnt, waere es eine Luege, die der Server binnen einer Minute widerlegt
// (computeScoreServer rechnet nach und ueberschreibt).
const eintragGanz = (() => {
  const a = JS.indexOf("await storageSet('leaderboard:'+state.player.id");
  const b = a < 0 ? -1 : JS.indexOf('lastSeen:', a);
  return a < 0 || b < 0 ? null : JS.slice(a, b);
})();
check('4c: der Punktestand bleibt ungetarnt', !!eintragGanz && /score: computeScore\(\)/.test(eintragGanz));
check('4d: die Verteidigungsstaerke bleibt ungetarnt',
  /defensePower: fuzz\(Math\.round\(defensePower\(\)\)\)/.test(JS));
// Kanal 2: missions:<id>, der undichtere - er traegt die volle Zusammensetzung und hat
// serverseitig gar keine Rechtepruefung.
const missionen = fnAus('summarizeOwnMissionsForBroadcast');
check('4e: die Missions-Zusammenfassung ist auffindbar', !!missionen);
check('4f: auch die gemeldeten Flottenbewegungen sind gefiltert',
  !!missionen && /composition: tarnungFilter\(/.test(missionen));
// Und der Filter selbst, ausgefuehrt: Er darf NUR die angehakten Klassen entfernen.
const filterQuelle = fnAus('tarnungFilter');
check('4g: tarnungFilter ist auffindbar', !!filterQuelle);
if (filterQuelle){
  const filter = new Function('tarnungAktiv, getarnteKlassen',
    filterQuelle + '; return tarnungFilter;')(() => true, () => ['jaeger']);
  const raus = filter({ jaeger: 50, schlachtschiff: 3, spaeher: 7 });
  check('4h: der Filter entfernt genau die getarnte Klasse',
    raus.jaeger === undefined && raus.schlachtschiff === 3 && raus.spaeher === 7, raus);
  const ausFilter = new Function('tarnungAktiv, getarnteKlassen',
    filterQuelle + '; return tarnungFilter;')(() => false, () => ['jaeger']);
  check('4i: bei ausgefallener Tarnung filtert er nichts',
    ausFilter({ jaeger: 50 }).jaeger === 50);
}

// ---- 5: der Ausfall ist laut, die Gegenwehr staffelt ------------------------------------------
const pruefQuelle = fnAus('tarnungPruefen');
check('5a: tarnungPruefen ist auffindbar', !!pruefQuelle);
if (pruefQuelle){
  // Der Ausfall MUSS melden. Eine Sicherung, deren Ausfall wie Normalbetrieb aussieht, ist keine.
  const meldungen = [];
  const st = { tarnung: { jaeger: true }, tarnungWarnung: false };
  const pruef = new Function('state, getarnteKlassen, tarnungAktiv, log',
    pruefQuelle + '; return tarnungPruefen;')(st, () => ['jaeger'], () => false, m => meldungen.push(m));
  pruef();
  check('5b: der Ausfall meldet sich', meldungen.length === 1, meldungen);
  pruef();
  check('5c: und er meldet sich GENAU EINMAL, nicht bei jedem Tick', meldungen.length === 1, meldungen.length);
}
const urteilQuelle = fnAus('sensorUrteil');
check('5d: sensorUrteil ist auffindbar', !!urteilQuelle);
if (urteilQuelle){
  const urteil = new Function('sensorWert', urteilQuelle + '; return sensorUrteil;')(() => 0);
  // DREI Stufen, ausgefuehrt gemessen. Ein zweistufiges Urteil waere die harte Schwelle, die der
  // Entwurf ausdruecklich vermeidet ("ein Punkt zu wenig und ich sehe gar nichts").
  const stufen = new Set([urteil(200, 0), urteil(200, 120), urteil(200, 250)]);
  check('5e: der Sensor staffelt in drei Stufen statt einer Schwelle',
    stufen.size === 3, [...stufen]);
  check('5f: ohne Tarnung urteilt er "nichts"', urteil(0, 9999) === 'nichts');
  check('5g: ein zu schwacher Sensor merkt nichts', urteil(200, 10) === 'blind');
  check('5h: ein ausreichender Sensor nennt die Groessenklasse', urteil(200, 200) === 'groesse');
}
// Das Gebaeude und sein geschenkter Startwert.
check('5i: der Signaturscanner steht in BUILDING_DEFS', /key:'signaturscanner'/.test(JS));
check('5j: sensorWert liest ihn und den Vorposten-Scanwert',
  /b\.signaturscanner/.test(JS) && /SENSOR_JE_VORPOSTEN_SCAN/.test(JS));
check('5k: die Grundstufe wird im Spielstand vergeben, nicht in der Formel',
  /state\.buildings\.signaturscanner = SENSOR_GRUNDSTUFE/.test(JS)
  && !/Math\.max\(SENSOR_GRUNDSTUFE/.test(JS));

// ---- 6: die Ehrlichkeitstexte ------------------------------------------------------------------
// Die Fehlerklasse, an der dieses Projekt regelmaessig scheitert: nicht die neue Mechanik, sondern
// der alte Satz daneben, den niemand nachzieht. Gesucht wird AUSSERHALB des PATCHNOTES-Blocks -
// der ist unveraenderliche Historie, und ein Treffer dort waere ein falsches Gruen.
const iP = JS.indexOf('const PATCHNOTES = [');
const jP = JS.indexOf('const PATCHNOTES_ARCHIV_ANZAHL');
check('6a: der PATCHNOTES-Block ist auffindbar und wird ausgeklammert', iP > 0 && jP > iP, { iP, jP });
const LEBEND = (iP > 0 && jP > iP) ? (JS.slice(0, iP) + JS.slice(jP)) : JS;

// "Aufklaerung zeigt sie dir" stand im Konterrollen-Abschnitt und waere mit der Tarnung zur Luege
// geworden. Geprueft wird die AUSSAGE - der Satz muss den Vorbehalt tragen, egal wie er formuliert
// ist -, nicht ein Wortlaut, den der naechste Umbau wieder festnagelt.
const konterAbschnitt = (() => {
  const a = LEBEND.indexOf("title:'Konterrollen (Schere-Stein-Papier)'");
  if (a < 0) return null;
  const b = LEBEND.indexOf("' },", a);
  return b < 0 ? null : LEBEND.slice(a, b);
})();
check('6b: der Konterrollen-Abschnitt ist auffindbar', !!konterAbschnitt);
check('6c: seine Aufklaerungs-Zusage nennt die Tarnung als Vorbehalt',
  !!konterAbschnitt && /Aufklärung zeigt sie dir/.test(konterAbschnitt) && /[Tt]arn/.test(konterAbschnitt),
  konterAbschnitt ? /Aufklärung zeigt sie dir[^<]{0,120}/.exec(konterAbschnitt)?.[0] : null);

// "Nach dem Kampf siehst du ohnehin, was dort stand" bleibt WAHR und muss stehen bleiben: Der
// Kampfbericht ist bewusst unveraendert, Tarnung ist ein Einmal-Schutz (Entscheidung Sascha,
// 03.09.2026). Diese Pruefung schuetzt die Zusage also davor, aus Uebereifer mitkorrigiert zu
// werden - sie ist die Gegenrichtung zu 6c.
check('6d: die Kampfbericht-Zusage steht unveraendert',
  /Nach dem Kampf siehst du ohnehin, was dort stand/.test(LEBEND));

// Der Spionagebericht darf "Flotte aufgedeckt" nur noch schreiben, wenn er es auch weiss.
check('6e: der Spionagebericht kennt den unvollstaendigen Fall',
  /Flotte – unvollständig erfasst/.test(LEBEND) && /spyTarnUrteil/.test(LEBEND));
// Und die Angriffs-Vorschau warnt dort, wo der Konter gerechnet wird - eine Zahl und ihr Vorbehalt
// gehoeren nebeneinander.
check('6f: die Angriffs-Vorschau warnt bei unvollstaendigem Bild',
  /Dieses Bild ist unvollständig/.test(LEBEND) && /vorschauUrteil/.test(LEBEND));
check('6g: es gibt einen Hilfe-Abschnitt zur Tarnung',
  /title:'Tarnung & Signatur'/.test(LEBEND));
// Die Zahlen im Hilfetext sind eingetippt (HELP_SECTIONS steht vor den Konstanten - temporale
// Todeszone). Sie muessen deshalb hier gegen die Konstanten gehalten werden, sonst laufen sie beim
// naechsten Balance-Pass auseinander.
const hilfe = (() => {
  const a = LEBEND.indexOf("title:'Tarnung & Signatur'");
  if (a < 0) return null;
  const b = LEBEND.indexOf("' },", a);
  return b < 0 ? null : LEBEND.slice(a, b);
})();
check('6h: der Hilfetext nennt dieselbe Grenze wie die Mechanik',
  !!hilfe && hilfe.includes('<strong>' + GRENZE + '</strong>'), GRENZE);

// ---- 7: die zwei Befunde aus dem gegnerischen Gegenlesen ---------------------------------------
// Beide gefunden, bevor sie jemand im Spiel gesehen hat - der Review-Bot war am Nutzungslimit, also
// habe ich den eigenen Diff selbst gegnerisch gelesen. Beide sind ohne Wächter still rueckbaubar.

// 7a-c: HYSTERESE. Mit einer einzigen Schwelle flattert der Zustand im Sekundentakt - und weil
// jeder Wechsel meldet, waere die Vorkehrung "der Ausfall muss laut sein" zu zwei Meldungen pro
// Sekunde geworden. Eine Warnung im Sekundentakt warnt nicht mehr; das ist derselbe Fehler wie eine
// stille Warnung, nur mit umgekehrtem Vorzeichen.
const aktivQuelle = fnAus('tarnungAktiv');
check('7a: tarnungAktiv ist auffindbar', !!aktivQuelle);
if (aktivQuelle){
  const WIEDER = zahl('TARN_WIEDERANLAUF_SEKUNDEN');
  check('7b: es gibt eine eigene Wiederanlauf-Schwelle', WIEDER > 1, WIEDER);
  const bau = (energie, gewarnt) => new Function(
    'state, getarnteKlassen, tarnEnergieProSek, TARN_ENERGIE_RESERVE, TARN_WIEDERANLAUF_SEKUNDEN',
    aktivQuelle + '; return tarnungAktiv;'
  )({ resources: { energie }, tarnungWarnung: gewarnt }, () => ['jaeger'], () => 1, 1, WIEDER);
  // DER FLATTERFALL, ausgefuehrt: Vorrat knapp ueber der Reserve, Verbrauch 1/s.
  // Laufend -> bleibt an. Nach dem Ausfall -> bleibt AUS, bis der Vorrat sie eine Minute traegt.
  check('7c: nach einem Ausfall springt sie bei knapper Energie NICHT sofort wieder an',
    bau(2, false)() === true && bau(2, true)() === false, { laufend: bau(2, false)(), nachAusfall: bau(2, true)() });
  check('7d: mit Vorrat fuer den Wiederanlauf geht sie wieder an',
    bau(WIEDER + 5, true)() === true, bau(WIEDER + 5, true)());
}

// 7e: SCHMUTZPRUEFUNG. render() laeuft im Sekundentakt, solange der Tab sichtbar ist. Ohne Kennung
// baut die Box ihr DOM jede Sekunde neu und nimmt Fokus und Hover mit. Die Nachbarbox hat dafuer
// lastFormationSig - beim ersten Anlauf hatte ich sie hier vergessen.
const boxQuelle = fnAus('renderTarnungBox');
check('7e: renderTarnungBox ist auffindbar', !!boxQuelle);
check('7f: die Box zeichnet nur bei Aenderung neu',
  !!boxQuelle && /if \(sig === lastTarnSig\) return;/.test(boxQuelle) && /lastTarnSig = sig;/.test(boxQuelle));
// Die Kennung muss den Energiezustand enthalten - sonst friert "Tarnung ausgefallen" fest, waehrend
// sie laengst wieder laeuft. Genau die Sorte Anzeige-Luege, die dieser Auftrag aufgeraeumt hat.
check('7g: die Kennung enthaelt Bestand, Auswahl UND Energiezustand',
  !!boxQuelle && /const sig = JSON\.stringify\(\[[^\]]*aktiv[^\]]*verbrauch/.test(boxQuelle),
  boxQuelle ? (/const sig = .*/.exec(boxQuelle)||[''])[0].slice(0, 160) : null);
// Und der Klick muss sie verwerfen, sonst zeichnet die Box das Umschalten nicht nach.
check('7h: das Umschalten verwirft die Kennung',
  !!boxQuelle && /lastTarnSig = null;/.test(boxQuelle));

ende();
