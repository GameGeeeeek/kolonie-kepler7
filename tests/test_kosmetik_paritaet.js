// Kosmetik: Frontend und Backend müssen dieselben Stücke kennen (15.08.2026).
//
// WARUM ES DIESEN TEST GIBT
// -------------------------
// Die Kosmetik ist bewusst auf zwei Repos verteilt: Der Server entscheidet, WER etwas besitzt
// (KOSMETIK_DEFS in server.js, mit den Freischalt-Bedingungen), das Frontend weiß, WIE es aussieht
// (KOSMETIK_LOOK). Das ist derselbe Fall wie SHIP_SCORE_WEIGHTS/computeScoreServer - und derselbe
// Fallstrick: Die eine Hälfte wird geändert, die andere bleibt zurück. Konkret drohen drei Schäden,
// und jeder ist im laufenden Betrieb erst spät sichtbar:
//
//   (a) Server kennt ein Stück, das Frontend nicht → es lässt sich freischalten, taucht in der
//       Auswahl aber nie auf. Der Spieler erfährt nie, dass er es hat.
//   (b) Frontend kennt ein Stück, der Server nicht → es steht in der Auswahl, und der Klick darauf
//       endet in "Unbekanntes Kosmetik-Stück". Eine Fläche, die etwas anbietet, das es nicht gibt.
//   (c) DER SUBTILE: Der Server führt eine neue BEDINGUNGSART ein (z.B. 'wochenliga'), und
//       kosmetikBedingungText() im Frontend kennt sie nicht. Dann steht unter dem gesperrten Stück
//       "Freischaltbedingung unbekannt." - der Spieler sieht eine Belohnung, ohne je zu erfahren,
//       wie er sie bekommt. Genau deshalb steht die Bedingung NICHT als zweite Liste im Frontend,
//       sondern kommt vom Server; dieser Test wacht über die Übersetzung.
//
// GEGENPROBE, in beide Richtungen gefahren (15.08.2026):
//   Backend-Kopie mit einem zusätzlichen Stück (nf_pruef):
//     FAIL - 1: jedes Server-Stück hat ein Aussehen im Frontend | {"fehlend":["nf_pruef"]}
//   Backend-Kopie mit einer neuen Bedingungsart ('wochenliga'):
//     FAIL - 3: jede Bedingungsart des Servers wird in Worte gefasst | {"unuebersetzt":["wochenliga"]}
//   Gegen den echten Stand: alles grün.

const fs = require('fs');
const path = require('path');
const { SPIELDATEI, SERVER_JS, pruefer, ueberspringen } = require('./lib/umgebung');
const { check, ende } = pruefer();

if (!SERVER_JS) ueberspringen('Backend-Quelltext nicht gefunden (Nachbar-Repo kolonie-kepler7-backend fehlt).');

const spiel = fs.readFileSync(SPIELDATEI, 'utf8');
const js = spiel.match(/<script>([\s\S]*)<\/script>/)[1];
const server = fs.readFileSync(SERVER_JS, 'utf8');

// Ein Array-/Objektliteral samt Inhalt herausschneiden. Klammerzählung statt Regex - eine naive
// Regex terminiert bei dieser Dateigröße an verschachtelten Klammern falsch (CLAUDE.md-Fallstrick).
function literalAus(quelle, anfang, oeffner, schliesser){
  const i = quelle.indexOf(anfang);
  if (i < 0) return null;
  let d = 0, s = quelle.indexOf(oeffner, i), k = s;
  if (s < 0) return null;
  for (; k < quelle.length; k++){
    if (quelle[k] === oeffner) d++;
    else if (quelle[k] === schliesser){ d--; if (!d) break; }
  }
  return quelle.slice(s, k + 1);
}

const defsRoh = literalAus(server, 'const KOSMETIK_DEFS = [', '[', ']');
const lookRoh = literalAus(js, 'const KOSMETIK_LOOK = {', '{', '}');
check('0-vorab: KOSMETIK_DEFS im Backend gefunden', !!defsRoh);
check('0-vorab: KOSMETIK_LOOK im Frontend gefunden', !!lookRoh);
if (!defsRoh || !lookRoh) ende();

const DEFS = eval('(' + defsRoh + ')');
const LOOK = eval('(' + lookRoh + ')');
check('0-vorab: beide Listen sind nicht leer', DEFS.length > 0 && Object.keys(LOOK).length > 0,
  { server: DEFS.length, frontend: Object.keys(LOOK).length });

// ---- 1) Jedes Server-Stück hat ein Aussehen ---------------------------------------------------
const serverKeys = DEFS.map(d => d.key);
const frontKeys = Object.keys(LOOK);
const fehlend = serverKeys.filter(k => frontKeys.indexOf(k) === -1);
check('1: jedes Server-Stück hat ein Aussehen im Frontend', fehlend.length === 0, { fehlend });

// ---- 2) Und umgekehrt ---------------------------------------------------------------------------
const ueberzaehlig = frontKeys.filter(k => serverKeys.indexOf(k) === -1);
check('2: kein Frontend-Stück ohne Server-Eintrag', ueberzaehlig.length === 0, { ueberzaehlig });

// ---- 3) Jede Bedingungsart lässt sich in Worte fassen ------------------------------------------
// Der Text wird zur Laufzeit gebaut; geprüft wird deshalb die FUNKTION, nicht der Quelltext.
// Ausgeführt wird sie mit einem eigenen `fmt`, damit sie nicht die ganze Spieldatei braucht.
const fnRoh = literalAus(js, 'function kosmetikBedingungText(b){', '{', '}');
check('3-vorab: kosmetikBedingungText gefunden', !!fnRoh);
if (fnRoh) {
  // Die ECHTE fmt() aus der Spieldatei mitgeben, keinen Platzhalter. Ein Platzhalter hätte diesen
  // Test bewiesenermaßen wertlos gemacht: Er ersetzte fmt durch String(), und die Prüfung "die
  // Schwelle steht im Text" war grün, während im Spiel "5.0k Kampfpunkte" stand - fmt() rundet.
  // Aufgefallen ist das nur, weil der Oberflächentest daneben den echten Text las (15.08.2026).
  const fmtRoh = literalAus(js, 'function fmt(n){', '{', '}');
  check('3-vorab: die echte fmt() gefunden', !!fmtRoh);
  const echtesFmt = fmtRoh ? eval('(function fmt(n)' + fmtRoh + ')') : (n => String(n));
  const bedingungText = eval('(function(fmt){ return function kosmetikBedingungText(b)' + fnRoh + '; })')(echtesFmt);
  const arten = Array.from(new Set(DEFS.map(d => d.bedingung && d.bedingung.typ)));
  const unuebersetzt = [];
  for (const def of DEFS) {
    const t = bedingungText(def.bedingung);
    // Die REGEL, nicht der Wortlaut (Regel 3): Der Text darf sich jederzeit ändern, er darf nur
    // nicht die Ausweichmeldung sein.
    if (!t || /unbekannt/i.test(t)) unuebersetzt.push(def.bedingung && def.bedingung.typ);
  }
  check('3: jede Bedingungsart des Servers wird in Worte gefasst',
    unuebersetzt.length === 0, { unuebersetzt: Array.from(new Set(unuebersetzt)), geprueft: arten });
  // Und die Zahlen aus der Bedingung müssen im Text ankommen - sonst stünde dort "Prestige-Stufe"
  // ohne Stufe. Nur für Bedingungen mit einem Zahlwert.
  //
  // Die Tausenderpunkte werden VOR dem Vergleich entfernt: Geprüft wird die Regel "die Schwelle
  // steht da", nicht eine bestimmte Schreibweise (CLAUDE.md-Regel 3). Ohne diese Normalisierung
  // schlug die Prüfung an, als 5000 völlig korrekt als "5.000" ausgegeben wurde - der Test hätte
  // eine schlechtere Darstellung erzwungen als die, die dort steht.
  const zahlenNormal = t => { let v = String(t); let alt; do { alt = v; v = v.replace(/(\d)[.\s](\d)/g, '$1$2'); } while (v !== alt); return v; };
  const ohneZahl = DEFS.filter(d => d.bedingung && typeof d.bedingung.wert === 'number')
    .filter(d => zahlenNormal(bedingungText(d.bedingung)).indexOf(String(d.bedingung.wert)) === -1)
    .map(d => ({ key: d.key, text: bedingungText(d.bedingung) }));
  check('3: die Schwelle steht im Text', ohneZahl.length === 0, { ohneZahl });
}

// ---- 4) Art stimmt überein ----------------------------------------------------------------------
const artFalsch = DEFS.filter(d => LOOK[d.key] && LOOK[d.key].art !== d.art).map(d => d.key);
check('4: die Art (Namensfarbe/Emblem) stimmt auf beiden Seiten überein', artFalsch.length === 0, { artFalsch });

// ---- 5) Jedes Stück hat Name, Beschreibung und ein Aussehen ------------------------------------
// CLAUDE.md-Regel 7: neuer Inhalt braucht Icon UND vollständige Beschreibung. "Vollständig" wird
// hier als "ganzer Satz" geprüft - ein Kürzel wie "Gold" hat sich in diesem Projekt schon einmal
// als fehlende Beschreibung gelesen (Spieler-Report 22.07.2026).
const ohneName = frontKeys.filter(k => !LOOK[k].name || !String(LOOK[k].name).trim());
check('5: jedes Stück hat einen Namen', ohneName.length === 0, { ohneName });
const knapp = frontKeys.filter(k => !LOOK[k].desc || String(LOOK[k].desc).trim().length < 25 || !/[.!]$/.test(String(LOOK[k].desc).trim()));
check('5: jede Beschreibung ist ein ganzer Satz', knapp.length === 0, { knapp });
// Aussehen: eine Namensfarbe braucht `farbe` (Ausnahme: die Vorgabe erbt bewusst), ein Emblem
// braucht `icon` oder `emoji` (Ausnahme: "kein Emblem").
const ohneAussehen = frontKeys.filter(k => {
  const l = LOOK[k];
  if (l.art === 'namensfarbe') return !('farbe' in l);
  if (l.art === 'emblem') return !('icon' in l) && !('emoji' in l);
  return true;
});
check('5: jedes Stück hat ein Aussehen hinterlegt', ohneAussehen.length === 0, { ohneAussehen });

// ---- 6) Der Server speist die Kosmetik wirklich in die Bestenliste ein --------------------------
// Ohne diese beiden Stellen wäre die ganze serverseitige Prüfung wirkungslos: Das Frontend liest
// die Kosmetik aus dem Bestenlisten-Eintrag, und den dürfte sonst der Client selbst bemalen.
// Kommentare werden vor dem Zählen geleert (Regel 33) - sie zitieren den Aufruf.
const serverOhneKommentare = server.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const einspeisungen = (serverOhneKommentare.match(/\.cosmetics = kosmetikGetragen\(/g) || []).length;
check('6: der Server überschreibt die Kosmetik im Bestenlisten-Eintrag (lesend UND schreibend)',
  einspeisungen === 2, { gefunden: einspeisungen });

// ---- 7) Die EINLEITUNGSZEILE der Kosmetik-Box darf die Freischaltwege nicht aufzaehlen ---------
// Gemessen am 21.08.2026: Sie nannte "Fortschritt (Prestige, Aufstieg, Kampfpunkte, Rekordtiefe,
// Erfolge, Sektor-Bosse und abgewehrte Angriffe)" - eine von Hand gepflegte Liste der
// Bedingungsarten. Mit den zwei PvE-Meilensteinen der Phase 6 (geschleifte Asteroidenfestungen,
// gefallene Alien-Koenigin) war sie unvollstaendig, und beim naechsten neuen Weg waere sie es
// wieder. Die Uebersetzung JEDER Art prueft Abschnitt 3; unter jedem gesperrten Stueck steht seine
// eigene Bedingung. Eine zweite, kuerzere Liste daneben kann deshalb nur falsch werden.
// Geprueft wird die REGEL: die drei stabilen Oberbegriffe ja, einzelne Bedingungsarten nein.
{
  const von = js.indexOf('Namensfarbe und Emblem erscheinen');
  const bis = von < 0 ? -1 : js.indexOf('</div>', von);
  check('7-anker: die Einleitungszeile der Kosmetik-Box laesst sich schneiden', von > 0 && bis > von, { von, bis });
  const zeile = (von > 0 && bis > von) ? js.slice(von, bis) : '';
  const verraeter = ['Prestige', 'Aufstieg', 'Kampfpunkte', 'Rekordtiefe', 'Sektor-Bosse',
                     'abgewehrte Angriffe', 'Asteroidenfestungen', 'Königin'];
  const gefunden = verraeter.filter(w => zeile.indexOf(w) >= 0);
  check('7: die Einleitungszeile zaehlt keine einzelnen Freischaltwege auf', gefunden.length === 0,
    { gefunden, zeile: zeile.slice(0, 240) });
  check('7b: sie nennt aber die drei stabilen Oberbegriffe weiterhin',
    /Fortschritt/.test(zeile) && /Unterstützer-Rang/.test(zeile) && /Sternenstaub/.test(zeile),
    zeile.slice(0, 240));
}

ende();
