// Das Reliquienkabinett (28.07.2026, v8.330.0).
//
// Zwei Dinge, die hier still schieflaufen koennen:
//
// 1) DIE BONUSGRUPPE. Zwoelf Reliquien mit "nur 3-5%" sind als eigene MULTIPLIKATION ein Faktor
//    von rund 1,55 - genau das Aufschaukeln, vor dem CLAUDE.md warnt. Sie muessen additiv in
//    dieselben vier Kanaele laufen wie die Werkstatt und dort gedeckelt werden. Dass das
//    tatsaechlich passiert, sieht man dem Code nicht an; es wird deshalb GERECHNET.
//
// 2) DIE SECHS AUFRUFSTELLEN. Vor v8.330.0 stand an sechs Stellen einzeln
//    abgrundWerkstattBonus('...') - Vorschau und Kampfaufloesung getrennt, Splitter und Beute je
//    doppelt. Eine neue Bonusquelle haette an allen sechs nachgetragen werden muessen. Die eine
//    vergessene laesst Vorschau und Kampf auseinanderlaufen, und zwar STILL: Die Vorschau zeigt
//    dann 100 Splitter, der Kampf gibt 92, und niemand rechnet nach. Dass es die Summe nur noch an
//    EINER Stelle gibt, ist deshalb selbst eine Pruefung wert.
//
// Der Rest ist Sammlungs-Hygiene: zwoelf Waechter, zwoelf Reliquien, keine doppelte Zeichnung,
// und der Index muss derselbe sein wie fuer Name und Portrait - sonst haengt unter der Reliquie
// des Kalten Ankers der Text des Zaehlenden.
const fs = require('fs');
const path = require('path');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail = false;
const check = (n, c, x) => { console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail = fail || !c; };

function klammer(start, auf, zu){
  let d = 0, s = js.indexOf(auf, start), k = s;
  for (; k < js.length; k++){ if (js[k]===auf) d++; else if (js[k]===zu){ d--; if(!d) break; } }
  return js.slice(s, k+1);
}
function arrAus(n){ const i = js.indexOf('const '+n+' = ['); if (i<0) throw new Error(n); return klammer(i,'[',']'); }
function objAus(n){ const i = js.indexOf('const '+n+' = {'); if (i<0) throw new Error(n); return klammer(i,'{','}'); }
function fnAus(n){
  const m = js.match(new RegExp('function\\s+'+n+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+n);
  const i = js.indexOf(m[0]);
  let d = 0, s = js.indexOf('{', i + m[0].length), k = s;
  for (; k < js.length; k++){ if (js[k]==='{') d++; else if (js[k]==='}'){ d--; if(!d) break; } }
  return js.slice(i, k+1);
}

// Umgebung: Werkstatt und Reliquien zusammen, damit abgrundKanalBonus wirklich beide summiert.
// Der Spielstand ist ein schlichtes Objekt, das der Test von aussen umstellt.
function bau(relikte, werkstatt, ersatzRelikte){
  return new Function(`
    const ABGRUND_RELIKTE = ${ersatzRelikte ? JSON.stringify(ersatzRelikte) : arrAus('ABGRUND_RELIKTE')};
    const ABGRUND_RELIKT_KANAELE = ${objAus('ABGRUND_RELIKT_KANAELE')};
    const ABGRUND_RELIKT_DECKEL = ${objAus('ABGRUND_RELIKT_DECKEL')};
    const ABGRUND_RELIKT_SATZ = ${arrAus('ABGRUND_RELIKT_SATZ')};
    const ABGRUND_KANAL_WERKSTATT = ${objAus('ABGRUND_KANAL_WERKSTATT')};
    // ABGRUND_SONDE_MAX VOR dem Werkstatt-Array: dessen Literal verweist darauf, eine spaetere
    // Deklaration liefe in die temporale Todeszone (derselbe Stolperstein wie in test_abgrund.js).
    const ABGRUND_SONDE_MAX = 3;
    const ABGRUND_WERKSTATT = ${arrAus('ABGRUND_WERKSTATT')};
    const ABGRUND_WAECHTER_ALLE = ${(js.match(/const ABGRUND_WAECHTER_ALLE = (\d+)/)||[])[1]};
    const ABGRUND_WAECHTER_NAMEN = ${arrAus('ABGRUND_WAECHTER_NAMEN')};
    const zustand = { relikte: ${JSON.stringify(relikte||{})}, werkstatt: ${JSON.stringify(werkstatt||{})} };
    function ensureAbgrund(){ return zustand; }
    ${fnAus('abgrundIstWaechter')}
    ${fnAus('abgrundWaechterDef')}
    ${fnAus('abgrundWerkstattStufe')}
    ${fnAus('abgrundWerkstattBonus')}
    ${fnAus('abgrundReliktDef')}
    ${fnAus('abgrundHatRelikt')}
    ${fnAus('abgrundReliktZahl')}
    ${fnAus('abgrundReliktBonus')}
    ${fnAus('abgrundKanalBonus')}
    return { ABGRUND_RELIKTE, ABGRUND_RELIKT_DECKEL, ABGRUND_RELIKT_SATZ, ABGRUND_RELIKT_KANAELE,
             ABGRUND_WAECHTER_NAMEN, abgrundReliktDef, abgrundReliktBonus, abgrundKanalBonus,
             abgrundReliktZahl, abgrundWerkstattBonus, zustand };
  `)();
}
const leer = bau({}, {});
const R = leer.ABGRUND_RELIKTE;
const alle = {}; R.forEach(r => alle[r.key] = true);
const voll = bau(alle, {});

// ---- 1) Die Sammlung ----
check('1: es gibt genau so viele Reliquien wie Waechter',
  R.length === leer.ABGRUND_WAECHTER_NAMEN.length,
  { relikte: R.length, waechter: leer.ABGRUND_WAECHTER_NAMEN.length });
check('1: jede hat Schluessel, Namen, Zeichnung, Kanal, Wert und einen ganzen Beschreibungssatz',
  R.every(r => r.key && r.name && r.bild && r.kanal && typeof r.wert === 'number'
    && typeof r.text === 'string' && r.text.length >= 60 && /[.!]$/.test(r.text.trim())),
  R.filter(r => !(r.key && r.name && r.bild && r.kanal && r.text && r.text.length >= 60)).map(r=>r.key));
check('1: jeder Kanal ist einer der vier bekannten',
  R.every(r => leer.ABGRUND_RELIKT_KANAELE[r.kanal]),
  R.filter(r => !leer.ABGRUND_RELIKT_KANAELE[r.kanal]).map(r=>r.kanal));
check('1: die Schluessel sind eindeutig', new Set(R.map(r=>r.key)).size === R.length);
// Derselbe Fehler wie bei den Waechterportraits vor v8.328.0: zwei Sammelstuecke, ein Bild.
const norm = b => String(b).replace(/\s+/g,' ').trim();
check('1: keine zwei Reliquien teilen sich dieselbe Zeichnung',
  new Set(R.map(r=>norm(r.bild))).size === R.length);
check('1: jede Zeichnung besteht aus mindestens zwei Formen',
  R.every(r => (r.bild.match(/<(path|circle|ellipse)/g)||[]).length >= 2),
  R.filter(r => (r.bild.match(/<(path|circle|ellipse)/g)||[]).length < 2).map(r=>r.key));
check('1: keine Zeichnung schreibt eine Farbe fest ein (alles erbt currentColor)',
  !R.some(r => /#[0-9a-fA-F]{3,6}/.test(r.bild)));
// Alle vier Kanaele muessen bedient werden, sonst waeren einzelne Werkstattzweige nie ergaenzt.
const kanaele = new Set(R.map(r=>r.kanal));
check('1: alle vier Kanaele kommen in der Sammlung vor',
  kanaele.size === Object.keys(leer.ABGRUND_RELIKT_KANAELE).length, [...kanaele]);

// ---- 2) Zuordnung Waechter -> Reliquie ----
check('2: eine Tiefe ohne Waechter hat keine Reliquie',
  leer.abgrundReliktDef(7) === null && leer.abgrundReliktDef(15) === null);
check('2: jede der zwoelf Waechtertiefen hat eine eigene, verschiedene Reliquie',
  new Set(R.map((_,i) => leer.abgrundReliktDef((i+1)*10).key)).size === R.length);
// Die Wiederkehr darf KEINE neue Reliquie bringen - sonst waere die Sammlung endlos statt bei 120
// vollstaendig. Der Index muss zyklisch derselbe sein wie bei Name und Portrait.
check('2: ab der Wiederkehr wiederholt sich die Reliquie (Sammlung endet bei Tiefe 120)',
  leer.abgrundReliktDef(130).key === leer.abgrundReliktDef(10).key
    && leer.abgrundReliktDef(250).key === leer.abgrundReliktDef(10).key,
  { t10: leer.abgrundReliktDef(10).key, t130: leer.abgrundReliktDef(130).key });
// Reliquie und Waechtername muessen aus derselben Rechnung kommen.
const versatz = [];
for (let t = 10; t <= 10*R.length*2; t += 10){
  const i = Math.floor(t/10) - 1;
  if (leer.abgrundReliktDef(t).key !== R[i % R.length].key) versatz.push(t);
}
check('2: Reliquie und Waechter laufen ueber zwei Runden nicht auseinander', versatz.length === 0, versatz);

// ---- 3) Die Bonusgruppe: additiv und gedeckelt ----
check('3: ohne Reliquie gibt es keinen Bonus',
  Object.keys(leer.ABGRUND_RELIKT_KANAELE).every(k => leer.abgrundReliktBonus(k) === 0));
// Additiv heisst: Summe der Einzelwerte, nicht Produkt. Fuer jeden Kanal nachgerechnet.
const summeErwartet = kanal => {
  let s = 0;
  for (const r of R) if (r.kanal === kanal) s += r.wert;
  for (const sz of voll.ABGRUND_RELIKT_SATZ) if (sz.kanal === kanal) s += sz.wert;
  return Math.min(voll.ABGRUND_RELIKT_DECKEL[kanal], s);
};
const abweichung = Object.keys(voll.ABGRUND_RELIKT_KANAELE)
  .filter(k => Math.abs(voll.abgrundReliktBonus(k) - summeErwartet(k)) > 1e-9);
check('3: die Boni werden ADDIERT (und nicht multipliziert)', abweichung.length === 0,
  Object.keys(voll.ABGRUND_RELIKT_KANAELE).map(k =>
    k+': ist '+voll.abgrundReliktBonus(k).toFixed(3)+', erwartet '+summeErwartet(k).toFixed(3)));
// Der Deckel muss auch WIRKLICH greifen. Mit den heutigen zwoelf Reliquien liegt keine Summe in
// seiner Naehe - eine Pruefung an den echten Werten kann ihn also gar nicht ausloesen und bleibt
// gruen, selbst wenn jemand die Deckelung ersatzlos herausnimmt (genau das hat die Rot-Probe zu
// diesem Test gezeigt). Geprueft wird er deshalb an einem Fall, der ihn reisst: dieselbe Funktion,
// aber mit einem uebertrieben bestueckten Reliquien-Array. Damit misst der Test die REGEL, nicht
// den heutigen Zufallsstand der Zahlen.
const uebertrieben = Object.keys(voll.ABGRUND_RELIKT_KANAELE).flatMap(kanal =>
  Array.from({length:20}, (_,i) => ({ key:kanal+i, name:'X', bild:'<circle/><circle/>', kanal, wert:0.10, text:'.' })));
const uebertriebenAlle = {}; uebertrieben.forEach(r => uebertriebenAlle[r.key] = true);
const gedeckelt = bau(uebertriebenAlle, {}, uebertrieben);
const reisst = Object.keys(voll.ABGRUND_RELIKT_KANAELE).filter(k =>
  gedeckelt.abgrundReliktBonus(k) > voll.ABGRUND_RELIKT_DECKEL[k] + 1e-9);
check('3: der Deckel greift, wenn die Summe ihn ueberschreiten wuerde', reisst.length === 0,
  Object.keys(voll.ABGRUND_RELIKT_KANAELE).map(k =>
    k+': roh 2.00+ -> '+gedeckelt.abgrundReliktBonus(k).toFixed(2)+' (Deckel '+voll.ABGRUND_RELIKT_DECKEL[k]+')'));
check('3: mit den heutigen Werten liegt noch jeder Kanal unter seinem Deckel',
  Object.keys(voll.ABGRUND_RELIKT_KANAELE).every(k => voll.abgrundReliktBonus(k) <= voll.ABGRUND_RELIKT_DECKEL[k] + 1e-9),
  Object.keys(voll.ABGRUND_RELIKT_KANAELE).map(k => k+': '+voll.abgrundReliktBonus(k).toFixed(3)+'/'+voll.ABGRUND_RELIKT_DECKEL[k]));
// ERSTER ANLAUF DIESES TESTS, aufgehoben und dokumentiert: Hier stand eine Gegenprobe "additiv
// muss kleiner sein als multiplikativ". Sie war falsch. Erstens verteilen sich die zwoelf
// Reliquien auf VIER Kanaele, dort liegen also nur drei bis vier Werte je Kanal - bei so wenigen
// kleinen Faktoren ist der Unterschied zwischen Summe und Produkt ohnehin winzig. Zweitens
// enthaelt die additive Summe zusaetzlich die Satz-Boni, das Produkt nicht; die Summe war deshalb
// sogar GROESSER, und die Pruefung schlug an, obwohl der Code stimmte.
// Die eigentliche Bremse ist nicht die Additivitaet, sondern der DECKEL. Also wird der geprueft -
// und zwar dort, wo es zaehlt: an der Gesamtsumme aus Werkstatt UND Reliquien, wie sie im Kampf
// wirklich anliegt.
const werkstattVoll = {};
ABGRUND_KANAL_LISTE = Object.entries({ kraft:'druckhuelle', verlust:'tiefenpanzer', splitter:'echolot', beute:'bergungsarm' });
ABGRUND_KANAL_LISTE.forEach(([,wk]) => werkstattVoll[wk] = 999);   // absurd hoch: Deckel muss greifen
const maximal = bau(alle, werkstattVoll);
const WS = eval(arrAus('ABGRUND_WERKSTATT').replace(/ABGRUND_SONDE_MAX/g, '3'));
const ueberzogen = ABGRUND_KANAL_LISTE.filter(([kanal, wk]) => {
  const wsDeckel = (WS.find(d => d.key === wk)||{}).deckel || 0;
  return maximal.abgrundKanalBonus(kanal) > wsDeckel + voll.ABGRUND_RELIKT_DECKEL[kanal] + 1e-9;
});
check('3: selbst mit voll ausgebauter Werkstatt UND allen Reliquien greifen beide Deckel',
  ueberzogen.length === 0,
  ABGRUND_KANAL_LISTE.map(([kanal, wk]) => {
    const wsDeckel = (WS.find(d => d.key === wk)||{}).deckel || 0;
    return kanal+': '+maximal.abgrundKanalBonus(kanal).toFixed(2)+' (Deckel '+wsDeckel+'+'+voll.ABGRUND_RELIKT_DECKEL[kanal]+')';
  }));
// Satz-Boni greifen genau an ihrer Schwelle - eine Stufe darunter noch nicht.
voll.ABGRUND_RELIKT_SATZ.forEach(sz => {
  const knapp = {}, genau = {};
  R.slice(0, sz.ab-1).forEach(r => knapp[r.key] = true);
  R.slice(0, sz.ab).forEach(r => genau[r.key] = true);
  const a = bau(knapp, {}), b = bau(genau, {});
  const zuwachs = b.abgrundReliktBonus(sz.kanal) - a.abgrundReliktBonus(sz.kanal);
  const eigen = R[sz.ab-1].kanal === sz.kanal ? R[sz.ab-1].wert : 0;
  check('3: Satz-Bonus "'+sz.name+'" greift genau bei '+sz.ab+' Stueck',
    Math.abs(zuwachs - (sz.wert + eigen)) < 1e-9,
    { bei: sz.ab-1, dann: sz.ab, zuwachs:+zuwachs.toFixed(4), erwartet:+(sz.wert+eigen).toFixed(4) });
});

// ---- 4) Werkstatt und Reliquien landen in EINER Summe ----
const mitWerkstatt = bau(alle, { druckhuelle:5, tiefenpanzer:4, echolot:3, bergungsarm:6 });
const nurWerkstatt = bau({}, { druckhuelle:5, tiefenpanzer:4, echolot:3, bergungsarm:6 });
const kanalPaare = { kraft:'druckhuelle', verlust:'tiefenpanzer', splitter:'echolot', beute:'bergungsarm' };
const falschSummiert = Object.entries(kanalPaare).filter(([kanal, wk]) =>
  Math.abs(mitWerkstatt.abgrundKanalBonus(kanal)
    - (mitWerkstatt.abgrundWerkstattBonus(wk) + mitWerkstatt.abgrundReliktBonus(kanal))) > 1e-9);
check('4: abgrundKanalBonus ist die Summe aus Werkstatt UND Reliquien', falschSummiert.length === 0,
  Object.keys(kanalPaare).map(k => k+': '+nurWerkstatt.abgrundKanalBonus(k).toFixed(3)+' -> '+mitWerkstatt.abgrundKanalBonus(k).toFixed(3)));
check('4: Reliquien erhoehen jeden Kanal wirklich (die Werkstatt allein ist kleiner)',
  Object.keys(kanalPaare).every(k => mitWerkstatt.abgrundKanalBonus(k) > nurWerkstatt.abgrundKanalBonus(k)));

// ---- 5) Es gibt die Summe nur noch an EINER Stelle ----
// Der eigentliche Punkt: Kein Rechenpfad im Spiel darf die vier Kanaele noch direkt aus der
// Werkstatt ziehen - sonst faellt genau dort der Reliquien-Anteil unter den Tisch.
const direkt = [];
for (const wk of Object.values(kanalPaare)){
  const treffer = (js.match(new RegExp("abgrundWerkstattBonus\\('"+wk+"'\\)", 'g'))||[]).length;
  // Genau EIN Vorkommen ist erlaubt: das in abgrundKanalBonus selbst gibt es nicht (dort steht
  // die Zuordnungstabelle), also muessen es null sein.
  if (treffer > 0) direkt.push(wk+': '+treffer+'x');
}
check('5: keine Stelle zieht einen der vier Kanaele noch direkt aus der Werkstatt',
  direkt.length === 0, direkt);
const kanalStellen = (js.match(/abgrundKanalBonus\(/g)||[]).length;
check('5: stattdessen laufen alle Stellen ueber abgrundKanalBonus', kanalStellen >= 6,
  { aufrufe: kanalStellen });
// Die Tiefensonde ist KEIN Kanal - sie bleibt bewusst ein reiner Werkstattzweig, weil keine
// Reliquie darauf einzahlt. Sie darf also weiterhin direkt gelesen werden.
check('5: die Tiefensonde bleibt ein reiner Werkstattzweig',
  /abgrundWerkstattBonus\('tiefensonde'\)/.test(js));

// ---- 6) Verdrahtung: Erstsieg gibt die Reliquie, Wiederholung das Modul ----
// Am EINDEUTIGEN Anker schneiden, nicht am erstbesten "if (sektor.waechter){" - das kommt in der
// Anzeige ebenfalls vor, und der erste Anlauf dieses Tests hat genau dort gemessen und deshalb
// vier Fehlschlaege gemeldet, obwohl der Code stimmte.
const iRelikt = js.indexOf('const relikt = abgrundReliktDef(tiefe);');
check('6: die Aufloesung fragt ueberhaupt nach einer Reliquie', iRelikt > 0);
// Endanker statt fester Laenge (Arbeitsregel 6, nachgezogen 09.08.2026): Der Slice lief bis
// iRelikt+1600 - eine Zahl, die niemand nachrechnet. Als in v8.463.0 ein Kommentarblock in
// diesen Abschnitt kam, rutschte die Meldung aus dem Fenster und der Test fiel auf korrektem
// Code durch. Jetzt endet er an der Zeile, die den Waechter-Block abschliesst; ihre Existenz
// wird geprueft, sonst liefert indexOf -1 und der Slice liefe bis Dateiende (vacuous).
const iEnde = js.indexOf("registerShareMoment('Wächter bezwungen'", iRelikt);
check('6: der Endanker des Waechter-Blocks existiert', iEnde > iRelikt);
const aufloesung = js.slice(iRelikt, iEnde > iRelikt ? iEnde : iRelikt + 1600);
check('6: der Erstsieg wird am Kabinett erkannt, nicht an der Tiefe',
  /const reliktNeu = relikt && !a\.relikte\[relikt\.key\]/.test(aufloesung));
check('6: bei einer Wiederholung faellt weiterhin ein Modul',
  /reliktNeu \? null : grantRandomModule\(\)/.test(aufloesung));
check('6: die Reliquie wird auch wirklich ins Kabinett gelegt',
  /a\.relikte\[relikt\.key\] = true/.test(aufloesung));
check('6: die Meldung nennt beim Erstsieg die Reliquie, sonst das Modul',
  /Reliquie geborgen/.test(aufloesung) && /Modul geborgen/.test(aufloesung));

const boxQuelle = fnAus('renderAbgrundBox');
check('6: es gibt eine Vitrine mit Zustandserhalt',
  /data-keep-open="abgrundKabinett"/.test(boxQuelle) && /class="vitrine"/.test(boxQuelle));
check('6: leere Faecher werden gezeigt, nicht verschwiegen',
  /vitrine-fach\$\{hat\?'':' leer'\}/.test(boxQuelle) && /\.vitrine-fach\.leer/.test(src));
check('6: ein leeres Fach nennt die Tiefe, in der das fehlende Stueck liegt',
  /const woTiefe = \(i\+1\) \* ABGRUND_WAECHTER_ALLE/.test(boxQuelle));
check('6: es gibt einen Erfolg fuer die vollstaendige Sammlung',
  /key:'abgrundkabinett'/.test(js) && /ABGRUND_RELIKTE\.every/.test(js));

// Regel 6: die Hilfe nennt Zahlen, die aus den Daten kommen muessen.
const hilfe = js.slice(js.indexOf('Reliquien – was ein Wächter zurücklässt'));
check('6: die Hilfe nennt dieselbe Anzahl Reliquien wie das Array',
  hilfe.slice(0,3000).includes('zwölf'), { anzahl: R.length });
check('6: die Hilfe nennt die Tiefe der letzten Reliquie richtig',
  hilfe.slice(0,3000).includes('Tiefe 120'), { erwartet: R.length*10 });

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
