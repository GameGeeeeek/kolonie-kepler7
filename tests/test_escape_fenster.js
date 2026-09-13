// Escape gehoert dem obersten Fenster - Waechter zu UI-8, 13.09.2026.
//
//   node tests/test_escape_fenster.js
//   KEPLER_SPIELDATEI=<kopie> KEPLER_ESCAPE_GEGENPROBE=<stand> node tests/test_escape_fenster.js
//
// ZWEI ZUSAGEN
// ------------
// A  Ein Tastendruck schliesst EIN Fenster. Gemessen an v8.728.0 in der Lage "Tafel offen,
//    System aufgeklappt, Wiedergabe darueber" schloss der erste Druck auf 390x844 wie auf
//    900x1000 das System UND die Wiedergabe: {system:false, wiedergabe:false}.
// B  Jedes bildschirmfuellende Fenster hat einen Tastenausgang. Drei Fenster teilen sich die
//    Klasse `fwahl-overlay` samt z-index 9200 und hatten keinen: das Projektfenster und das
//    Steckplatzfenster des Vorpostens und die Flottenwahl. Gemessen an v8.728.0 auf 390x844 UND
//    1280x900 schloss Escape dort das aufgeklappte SYSTEM hinter dem Overlay - das Fenster blieb
//    stehen, die Taste wirkte auf etwas, das der Spieler gar nicht sehen konnte.
//
// DIE BESTANDSAUFNAHME, AUF DER DIESER WAECHTER STEHT (gemessen 13.09.2026)
// --------------------------------------------------------------------------
// Fenster im Bildschirmsinn, nach z-index, mit ihren Ausgaengen:
//   .fwahl-overlay (9200, inset:0) - VIER Fenster, alle dynamisch gebaut: vorpostenProjektOverlay,
//     vorpostenModulOverlay, fwahlOverlay, vrufOverlay. Jedes hat ein x und einen Randklick, und
//     der Rand ist hier am Handy WIRKLICH ein Ausgang: padding 14 px, Karte width min(560px,96vw)
//     schrumpft auf die verbleibenden 362 von 390 px - es bleiben 14 px links und rechts.
//     Tastenausgang: seit UI-8 alle vier, vorher nur der Verbandsruf. 0c bewacht das Muster.
//   .kmenu (9000, fixed) - Eintrag anklicken, Klick daneben, Scrollen, Tabwechsel, Escape (3b).
//     Es kann nicht halb aus dem Bild stehen: openKarteMenu rueckt es nach dem Einhaengen mit
//     Math.max/Math.min vollstaendig ins Fenster, und max-height min(60vh,420px) haelt es
//     kleiner als der Bildschirm.
//   .battle-modal-overlay (210, inset:0) - x in der Titelzeile und Escape. Der Randklick ist am
//     Handy GEMESSEN keiner: `@media (max-width:879px)` setzt das padding der Wiedergabe auf 0,
//     `align-items:stretch` streckt #osWrap ueber das ganze Overlay, e.target === overlay tritt
//     nie ein. Genau diese Falle steht seit dem 03.08.2026 als Kommentar daneben.
//   #fleetPositionPanel.fp-mobile-open (210) mit #fpBackdrop (205) - x, Randknopf, Klick auf die
//     Verdunklung, Escape. Bewacht in tests/test_statustafel.js, nicht hier.
//   .login-overlay (200, inset:0) - DREIZEHN Fenster (Anmeldung, Willkommen neu und zurueck,
//     Update-Hinweis, Tutorial, Spielerprofil, Adminbereich, Aufstiegspfad, Prestige-Bonus,
//     Sitzungskonflikt, Ko-fi-Nachfrage, Stimmen-Hinweis, Spenden-Rangliste). Keines hoert auf
//     Escape, und sie bleiben ausdruecklich in Ruhe: Jedes hat einen eigenen sichtbaren Knopf im
//     Inhalt, und drei davon (Prestige-Bonus, Aufstiegspfad, Sitzungskonflikt) sind Pflichtwahlen
//     nach einem unumkehrbaren Schritt - dort waere ein Tastenausgang ein Fehler, kein Gewinn.
//     Sie sind nicht Gegenstand der beiden Zusagen dieser Etappe.
//   .chat-panel (61) mit .chat-panel-overlay (60) - eine Schublade ueber 88vw: x-Knopf UND Klick
//     auf die verbleibenden 12vw Verdunklung, beides gemessen erreichbar. Sie bekommt in dieser
//     Etappe KEINEN Tastenausgang - Vertrag UI-8, Abschnitt D laesst die Fenster selbst in Ruhe.
//     HIER STAND BIS ZUM 13.09.2026 „kein Tastenausgang, aber auch keine Falle". DIE MESSUNG HAT
//     DAS WIDERLEGT: Ihre Verdunklung ist gemessen 390x844 bzw. 900x1000 gross, deckt also den
//     ganzen Schirm, nicht nur 88vw. Bei aufgeklapptem System und SICHTBARER Kartenflaeche
//     lieferte elementFromPoint in deren Mitte `chatPanelAllianceBox' (390) bzw.
//     `chatPanelOverlay' (900) - und ein Escape liess die Schublade stehen und schloss das System
//     dahinter. Genau der Satz, mit dem diese Etappe die vier neuen Tastenausgaenge begruendet,
//     galt also auch hier. Es war KEINE Verschlechterung gegenueber v8.728.0, aber eine
//     Zusicherung, die die Messung nicht trug. Behoben nicht an der Schublade, sondern am BODEN
//     (siehe den Absatz darueber und Pruefung 3d).
//   Das aufgeklappte System ist KEIN Fenster im Bildschirmsinn, sondern ein Kasten IN der Seite
//     (Knopf „‹ Galaxie", Klick ins Leere, Escape) - siehe den Absatz zum Boden.
//
// WIE ES GELOEST IST - UND WAS DARAN GEMESSEN IST
// -----------------------------------------------
// Die Hausform steht seit UI-8 einmal im Spiel (escapeAusgang/fensterObenauf) statt wortgleich an
// drei Stellen. Jedes Fenster meldet nur noch an, WANN es offen ist, WIE es zugeht und WELCHES
// Element es im Bild ist.
//
// DER EIGENTLICHE FEHLER AUS ZUSAGE A WAR DIE REIHENFOLGE, NICHT DIE MESSUNG. Gemessen an
// v8.728.0: Die Registrierungsreihenfolge der Fenster-Lauscher faellt Zeile fuer Zeile mit ihrem
// z-index (9200, 9200, 9200, 9200, 9000, 210, 210) - mit EINER Ausnahme, und die war der Schaden:
// Der Lauscher des aufgeklappten Systems stand VOR dem der Kampf-Wiedergabe, obwohl das System
// unter allem liegt. Er ist deshalb ans Ende gewandert und haelt die Taste jetzt an.
//
// WARUM DER BODEN NUR DIE HALBE FRAGE STELLT: Das aufgeklappte System ist kein Fenster ueber dem
// Bildschirm, sondern ein Kasten IN der Seite. GEMESSEN am 13.09.2026 auf 900x1000 bei scrollY
// 1847: seine Kartenflaeche stand bei top -954 bis -129, also vollstaendig ausserhalb des Bildes -
// und Escape schliesst es dort seit jeher. Eine volle Obenauf-Messung naehme ihm genau dort den
// Ausgang. Pruefung 3a misst das nach, Gegenprobe sabMisstBoden.
//
// DER PREIS DAVON STAND BIS ZUM 13.09.2026 NIRGENDS (Durchsicht, Befund 2). Solange der Boden GAR
// NICHT mass, nahm er die Taste auch dann, wenn ein Fenster OHNE Tastenausgang bildschirmnah
// darueber lag - gemessen an der Chat-Schublade auf 390x844 UND 900x1000 (Zahlen oben in der
// Bestandsaufnahme). Seither unterscheidet fensterLage() im Spiel drei Faelle statt zwei:
//   `weg'      kein Pixel im Bild      -> der Boden nimmt die Taste (3a bleibt heil)
//   `verdeckt' im Bild, aber ueberdeckt -> der Boden laesst sie liegen (3d)
//   `obenauf'  die Stelle gehoert ihm   -> der Boden nimmt die Taste (1c, 3a, 3b)
// fensterObenauf() ist seither nur noch der Kurzschluss `=== obenauf' und beantwortet fuer die
// FENSTER genau dieselbe Frage wie vorher; escapeAusgang fragt unveraendert nur das.
// WAS DAMIT NICHT BEHOBEN IST, und zwar absichtlich: Wer die Kartenflaeche aus dem Bild scrollt
// UND die Schublade oeffnet, schliesst mit Escape weiterhin das System. `weg' und `verdeckt'
// sind zwei verschiedene Fragen, und die erste gehoert dem gescrollten Spieler - 3a und 3d
// messen beide Haelften gegeneinander.
//
// WAS DIE OBENAUF-MESSUNG LEISTET - UND WIE SIE SELBST BEWACHT IST: Unter den heute OHNE
// Kunstgriff erreichbaren Fensterpaaren gibt es keines, bei dem sie anders entscheidet als die
// Registrierungsreihenfolge; die Reihenfolge faellt Zeile fuer Zeile mit dem z-index zusammen
// (9200, 9200, 9200, 9200, 9000, 210, 210). Die einzige Lage, in der sie ohne Kunstgriff wirklich
// entscheidet, ist Tafel gegen Kampf-Wiedergabe - und die laeuft an dieser Hausform vorbei, weil
// die Tafel ihre eigene Kopie statustafelObenauf() benutzt (Vertrag UI-8, Abschnitt D; bewacht in
// tests/test_statustafel.js, 3h/3i).
// DARAUS FOLGT ABER NICHT, DASS DIE ZEILE UNBEWACHT BLEIBEN MUESSTE - das war der Befund 1 der
// Durchsicht vom 13.09.2026, und die frueheren Zeilen an dieser Stelle ("sabBlind bleibt leer,
// ein Falsifikator braeuchte die Zusammenfuehrung mit der Statustafel") waren GEMESSEN falsch.
// Ein Falsifikator kommt ohne die Statustafel aus: Pruefung 1d legt einen FANGSCHIRM ueber die
// offene Kampf-Wiedergabe - ein leeres div mit position:fixed, inset:0, z-index:9999, opacity:0.
// Damit liegt die Wiedergabe nachweislich nicht mehr obenauf (V7 misst das nach: elementFromPoint
// in ihrer Mitte liefert `__fangschirm'). Mit Messung laesst sie die Taste liegen und der Boden
// nimmt sie; ohne Messung nimmt sie sie trotzdem. Der Fangschirm wird unmittelbar danach wieder
// abgeraeumt und beruehrt kein Fenster, keinen z-index und keine andere Pruefung.
//
// GEGENPROBEN (KEPLER_SPIELDATEI auf eine Kopie lenken, Stand per KEPLER_ESCAPE_GEGENPROBE)
//   =alt          der Grundstand v8.728.0
//   =sabBoden      der System-Lauscher steht wieder VOR dem der Kampf-Wiedergabe
//   =sabDurchfall  escapeAusgang haelt die Taste nicht mehr an (stopImmediatePropagation entfernt)
//   =sabFlotte     der Tastenausgang der Flottenwahl fehlt wieder
//   =sabRoh        die Flottenwahl schliesst per classList.remove statt ueber schliesseFlottenwahl
//   =sabMisstBoden der Boden verlangt DOCH `obenauf` statt nur `nicht verdeckt` - die
//                  naheliegende, falsche Loesung
//   =sabBlinderBoden der Boden misst GAR NICHT (der Stand vor dem 13.09.2026)
//   =sabMuster     ein FUENFTES .fwahl-overlay entsteht, ohne einen Tastenausgang anzumelden
//   =sabMusterKlasse dasselbe fuenfte Fenster, aber ueber classList.add gebaut
//   =sabBlind      escapeAusgang fragt fensterObenauf nicht mehr (greift wieder blind)
// Jede Sabotage entsteht aus der AKTUELLEN Spieldatei, jeder Anker wird vorher gezaehlt (genau
// eine Fundstelle, sonst Abbruch VOR dem Schreiben). Die MUSS_FALLEN-Listen sind GEMESSEN: erst
// leer gefahren, dann eingetragen, dann jeder Stand erneut, bis jeder Lauf Exit 0 lieferte.
// KEINE Liste ist leer, und keine Pruefung ohne Falsifikator: 0a faellt an alt; 0b an alt und
// sabBoden; 0c und 0d an alt, sabFlotte, sabMuster und sabMusterKlasse; 1a/1b (beide Breiten) an
// alt, sabBoden und sabDurchfall; 1c an sabMisstBoden; 1d an alt, sabMisstBoden und sabBlind;
// 2a/2b an alt und sabDurchfall; 2c an alt und sabFlotte; 2d an alt, sabFlotte und sabRoh; 2e an
// alt, sabDurchfall und sabFlotte; 3a an sabMisstBoden; 3b und 3c an sabDurchfall; 3d an alt und
// sabBlinderBoden.
//
// WAS BEIM MESSEN DER LISTEN HERAUSKAM UND ERKLAERT GEHOERT
// ---------------------------------------------------------
// * 1c BLEIBT AM ALTEN STAND GRUEN, und das ist richtig: Dort schliesst schon der ERSTE
//   Tastendruck das System mit, also ist es beim dritten laengst zu und die Pruefung trivial
//   wahr. Ihr Falsifikator ist sabMisstBoden - dort bleibt das System stehen, weil seine
//   Kartenflaeche in dieser Lage gar nicht im Bild ist (der Karte-Reiter steht auf display:none,
//   weil der Weg zur Wiedergabe ueber die Berichte fuehrt).
// * 3a HAT NUR EINEN FALSIFIKATOR, UND DAS IST DER PUNKT DIESER PRUEFUNG. sabMisstBoden ist die
//   Loesung, die man ohne die Messung genommen haette: Gib auch dem System eine Obenauf-Pruefung.
//   Gemessen faellt genau dort der Ausgang weg, den ein bis ganz nach unten gescrollter Spieler
//   braucht.
// * sabBoden BRINGT 1b MIT, nicht nur 1a: Steht der System-Lauscher wieder vorn, nimmt der erste
//   Druck das System und der zweite die Wiedergabe - die Tafel kommt gar nicht mehr an die Reihe.
// * sabDurchfall LAESST 2c GRUEN, und das ist keine Luecke: Die Flottenwahl wird ohne offenes
//   System gemessen (Galaxie-Reiter, Angriffsknopf). Ohne etwas darunter kann das Durchfallen der
//   Taste dort nichts anrichten - 2c misst den AUSGANG, 2a/2b messen das Anhalten.
// * sabFlotte BRINGT 2d, 2e, 0c UND 0d MIT: Die Sabotage nimmt den ganzen Aufruf weg - damit auch
//   den Anker, an dem 2d den Schliessweg liest, und damit meldet `fwahlOverlay` keinen
//   Tastenausgang mehr an, was beide Familien-Pruefungen zaehlen. 2e faellt, weil die Taste ohne
//   diesen Aufruf niemandem mehr gehoert: Der Boden sieht die Kartenflaeche verdeckt und laesst
//   sie liegen - das Fenster bleibt gemessen einfach stehen.
// * 0c UND 0d MESSEN DIESELBE FAMILIE AUF ZWEI WEGEN, und beide brauchten das (Durchsicht
//   13.09.2026, Befund 3). Die fruehere Fassung suchte woertlich `.className = 'fwahl-overlay'`
//   und bewachte damit eine SCHREIBWEISE statt des Musters: Ein fuenftes Fenster ueber
//   classList.add blieb gemessen unbemerkt (Exit 0, kein Fehlschlag). Seither liest 0d jede
//   Erwaehnung der Klasse ausserhalb der Stilbloecke und der Kommentare, und 0c misst die Familie
//   im gerenderten DOM. GEMESSEN am 13.09.2026 an zwei Staenden mit einem fuenften Fenster
//   (`vorpostenLagerOverlay`): sabMuster (className) und sabMusterKlasse (classList.add) - in
//   BEIDEN fallen 0c und 0d, und keine andere Pruefung merkt etwas davon. Am Grundstand fallen
//   beide mit allen vier Namen, weil es dort gar keinen escapeAusgang gibt.
// * 2e MISST DIE LAGE, DIE 2c NICHT MISST (Durchsicht 13.09.2026, Befund 4). Zusage B lautet,
//   Escape habe bei offenem fwahl-Fenster das SYSTEM darunter geschlossen; 2c oeffnet die
//   Flottenwahl aber ueber den Galaxie-Reiter, wo gar kein System aufgeklappt ist, und misst
//   damit nur den Ausgang. 2e nimmt denselben Weg wie 2a und 2b (Karte-Reiter, System, NPC-Knoten,
//   Kartenmenue) und faellt gemessen an alt, sabDurchfall und sabFlotte.
// * DIE REIHENFOLGE-SABOTAGE ZUR FLOTTENWAHL FAELLT SEIT DEM 13.09.2026 DURCH NICHTS MEHR AUF,
//   und das gehoert hierher, statt sie als leeren Stand mitzuschleppen. Gebaut und gemessen wurde
//   `sabSpaet`: derselbe escapeAusgang-Aufruf, aber in ein setTimeout(..., 0) gehuellt, also HINTER
//   dem Boden registriert. Vor der Aenderung am Boden war das der Beleg der Durchsicht, dass 2c
//   nichts misst. GEMESSEN am 13.09.2026 gegen den heutigen Stand: Exit 0, keine einzige Pruefung
//   faellt. Der Grund ist die neue Zeile im Boden, nicht eine Luecke im Waechter - der Boden laeuft
//   in dieser Lage zwar zuerst, sieht die Kartenflaeche aber verdeckt (gemessen 390x844:
//   elementFromPoint in ihrer Mitte lieferte `card-row` des Fensters) und laesst die Taste liegen;
//   danach nimmt sie der spaet registrierte Lauscher der Flottenwahl. Damit ist die
//   Registrierungsreihenfolge hier wirklich nur noch der Gleichstands-Entscheid, als der sie
//   gemeint ist. Der Stand ist deshalb NICHT in MUSS_FALLEN: Ein Gegenprobenstand, durch den nichts
//   faellt, ist keiner. 2e behaelt seine drei Falsifikatoren oben.
// * sabBLIND HAT SEIT DEM 13.09.2026 EINEN FALSIFIKATOR, UND ZWAR GENAU EINEN: 1d. Hier stand
//   davor, die Liste bleibe leer, und ein Falsifikator braeuchte die Zusammenfuehrung mit der
//   Statustafel (Abschnitt D verbietet die). Das war ehrlich aufgeschrieben und trotzdem falsch -
//   die Durchsicht hat es widerlegt, indem sie einen gebaut hat. 1d legt einen FANGSCHIRM ueber
//   die offene Kampf-Wiedergabe (ein leeres div, position:fixed, inset:0, z-index:9999,
//   opacity:0) und misst damit die Messung selbst, ohne ein einziges Fenster anzufassen.
//   GEMESSEN am 13.09.2026 auf 390x844: mit Messung {wiedergabe:true, system:false} - die
//   Wiedergabe laesst die Taste liegen und der Boden nimmt sie; unter sabBlind umgekehrt
//   {wiedergabe:false, system:true}. Am Grundstand faellt 1d auch, dort gibt es die Messung gar
//   nicht.
//   WAS WEITER GILT: Ohne diesen Kunstgriff entscheidet die Obenauf-Messung heute in keiner
//   erreichbaren Lage etwas, das die Reihenfolge nicht auch entschiede - sie faellt Zeile fuer
//   Zeile mit dem z-index zusammen (9200, 9200, 9200, 9200, 9000, 210, 210). Die eine Lage, in
//   der sie das taete, ist Tafel gegen Kampf-Wiedergabe, und die laeuft an der Hausform vorbei,
//   weil die Tafel ihre eigene Kopie statustafelObenauf() benutzt (Abschnitt D; bewacht in
//   tests/test_statustafel.js, 3h/3i). Die Messung bleibt also die Absicherung gegen das NAECHSTE
//   Fenster - aber sie ist nicht mehr unbewacht.
// * sabMISSTBODEN BRINGT SEIT DEM 13.09.2026 AUCH 1d MIT, und das ist kein Zufall, sondern
//   dieselbe Sache von der anderen Seite: In der Fangschirm-Lage steht die Kartenflaeche gar nicht
//   im Bild (Karte-Reiter auf display:none). Ein Boden, der `obenauf` VERLANGT statt nur
//   `verdeckt` auszuschliessen, laesst die Taste dort liegen - dann bleibt das System offen, und
//   1d misst genau diese zweite Haelfte mit. 1c, 1c-900 und 3a fallen wie bisher.
// * sabBLINDERBODEN IST DER FALSIFIKATOR ZU 3d UND FAELLT NUR DORT. Er nimmt dem Boden die Messung
//   ganz - der Stand vor dem 13.09.2026. Gemessen faellt genau eine Pruefung, und das ist richtig
//   so: Die neue Zeile aendert das Verhalten NUR in der Lage `im Bild, aber verdeckt`. In jeder
//   anderen Lage (nichts darueber, aus dem Bild gescrollt, ein Fenster mit eigenem Tastenausgang
//   darueber) verhaelt sich der Boden unveraendert - belegt dadurch, dass 1c, 1c-900, 3a, 3b und
//   1d an diesem Stand gruen bleiben.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, ruhigeUhren, versionAbfangen } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');

const ergebnis = {};
let fail = false;
const merke = (name, bed, zusatz) => {
  const k = String(name).split(':')[0];
  ergebnis[k] = !!bed; fail = fail || !bed;
  console.log((bed ? 'OK  ' : 'FAIL') + ' - ' + name + (zusatz !== undefined ? ' | ' + JSON.stringify(zusatz) : ''));
};
const SAB = process.env.KEPLER_ESCAPE_GEGENPROBE || '';
// GEMESSEN am 13.09.2026 - erst leer gefahren, dann eingetragen, dann jeder Stand erneut.
const MUSS_FALLEN = {
  alt:             ['0a', '0b', '0c', '0d', '1a', '1a-900', '1b', '1b-900', '1d', '2a', '2b', '2c', '2d', '2e', '3d'],
  sabBoden:        ['0b', '1a', '1a-900', '1b', '1b-900'],
  sabDurchfall:    ['1a', '1a-900', '1b', '1b-900', '2a', '2b', '2e', '3b', '3c'],
  sabFlotte:       ['0c', '0d', '2c', '2d', '2e'],
  sabRoh:          ['2d'],
  sabMisstBoden:   ['1c', '1c-900', '1d', '3a'],
  sabBlinderBoden: ['3d'],
  sabMuster:       ['0c', '0d'],
  sabMusterKlasse: ['0c', '0d'],
  sabBlind:        ['1d']
};

const JS = fs.readFileSync(SPIELDATEI, 'utf8');
// Der Klassenname steht hier EINMAL - 0c (DOM) und 0d (Quelltext) messen dieselbe Familie.
const FAMILIE = 'fwahl-overlay';
/* Welche Ids einen Tastenausgang angemeldet haben - gelesen aus den escapeAusgang-Aufrufen im
   Quelltext. Beide Familien-Pruefungen fragen dieselbe Liste; 0c bringt die Namen aus dem DOM,
   0d aus dem Quelltext. */
const aufrufe = [];
{ let p = JS.indexOf('escapeAusgang(');
  while (p >= 0){ aufrufe.push(JS.slice(p, p + 400)); p = JS.indexOf('escapeAusgang(', p + 1); } }
const hatAusgang = id => !!id && aufrufe.some(a => a.indexOf("'" + id + "'") >= 0);
/* Was WIRKLICH entsteht, nicht was im Quelltext danach aussieht: Jede Seite, die dieser Waechter
   aufbaut, meldet am Ende ihre .fwahl-overlay-Elemente hierher. Die vier Fenster der Familie
   werden von den Pruefungen 2a, 2b, 2c und 3c ohnehin alle geoeffnet, und sie bleiben nach dem
   Schliessen im DOM stehen (sie werden beim ERSTEN Oeffnen gebaut und danach nur noch auf- und
   zugeklappt). */
const familieImDom = new Set();
async function familieEinsammeln(page){
  try {
    const ids = await page.evaluate(k => [...document.querySelectorAll('.' + k)].map(e => e.id || '(ohne id)'), FAMILIE);
    ids.forEach(i => familieImDom.add(i));
  } catch (e) { /* geschlossene Seite: die uebrigen Seiten messen dieselbe Familie */ }
}

// ===== 0) Quelltext: die Hausform gibt es einmal, und der Boden liegt unten ======================
{
  const nHausform = (JS.match(/function escapeAusgang\(/g) || []).length;
  const nObenauf = (JS.match(/function fensterObenauf\(/g) || []).length;
  const nLage = (JS.match(/function fensterLage\(/g) || []).length;
  merke('0a: die Hausform steht genau einmal im Spiel (escapeAusgang, fensterObenauf, fensterLage)',
    nHausform === 1 && nObenauf === 1 && nLage === 1,
    { escapeAusgang: nHausform, fensterObenauf: nObenauf, fensterLage: nLage });

  /* DIE REIHENFOLGE WIRD GEMESSEN, NICHT BEHAUPTET. Beide Anker werden vorher auf Existenz
     geprueft - ein indexOf von -1 waere sonst automatisch "kleiner" und die Pruefung vacuous. */
  const iWiedergabe = JS.indexOf('escapeAusgang(() => overlay.classList.contains(\'open\'), closeBattleReplay, overlay)');
  const iSystem = JS.indexOf('if (e.key !== \'Escape\' || !galaxyOpenSystem) return;');
  merke('0b: der Lauscher des aufgeklappten Systems ist der Boden - er steht HINTER dem der Kampf-Wiedergabe',
    iWiedergabe > 0 && iSystem > 0 && iSystem > iWiedergabe, { wiedergabe: iWiedergabe, system: iSystem });

  /* 0d: DAS MUSTER IM QUELLTEXT - UND ZWAR SCHREIBWEISENFREI (Durchsicht 13.09.2026, Befund 3).
     Zusage B galt einer FAMILIE: `.fwahl-overlay` ist eine Klasse, mit der heute vier Fenster
     dynamisch gebaut werden, und an dreien davon fehlte der Tastenausgang.
     DIE ERSTE FASSUNG DIESER ZEILE BEWACHTE NUR EINE SCHREIBWEISE. Sie suchte woertlich
     `.className = 'fwahl-overlay'`; ein fuenftes Fenster ueber `classList.add('fwahl-overlay')`
     oder ueber ein `class`-Attribut in einem innerHTML-Schnipsel erhoehte weder die Zahl der
     Baustellen noch die der Erkannten - die Pruefung blieb gruen, obwohl genau der Fall
     eingetreten war, gegen den Zusage B gebaut ist. Gemessen und belegt am 13.09.2026.
     GELESEN WIRD DESHALB NICHT MEHR NACH SCHREIBWEISE, SONDERN NACH ERWAEHNUNG: Jede Stelle, an
     der der Klassenname ausserhalb der Stilbloecke und ausserhalb eines Kommentars auftaucht,
     gilt als Baustelle - gleich wie sie aussieht. Zu jeder muss sich in den 300 Zeichen davor
     eine Id lesen lassen, und die muss in einem escapeAusgang-Aufruf vorkommen. Findet sich
     keine Id, faellt die Zeile ebenfalls: Ein Fenster der Familie ohne Id koennte gar keinen
     Tastenausgang anmelden.
     GEMESSEN am 13.09.2026 gegen drei gebaute Staende mit einem fuenften Fenster: className,
     classList.add und `class="..."` in innerHTML - alle drei wurden erkannt und fielen.
     Was diese Zeile NICHT kann: ein Overlay, das die Klasse aus einer Variablen bekommt
     (`el.className = KLASSE`). Dafuer gibt es 0c, das die Familie aus dem gerenderten DOM misst.
     Falsifikatoren gemessen: sabMuster, sabMusterKlasse, sabFlotte und der Grundstand. */
  {
    const ohneStil = JS.replace(/<style[\s\S]*?<\/style>/g, '');
    const stellen = [];
    { let p = ohneStil.indexOf(FAMILIE); while (p >= 0){ stellen.push(p); p = ohneStil.indexOf(FAMILIE, p + 1); } }
    const imKommentar = p => {
      const auf = ohneStil.lastIndexOf('/*', p), zu = ohneStil.lastIndexOf('*/', p);
      if (auf > zu) return true;
      const za = ohneStil.lastIndexOf('\n', p) + 1;
      return ohneStil.slice(za, p).indexOf('//') >= 0;
    };
    const idVor = p => {
      const m = [...ohneStil.slice(Math.max(0, p - 300), p).matchAll(/\bid\s*=\s*["']([A-Za-z0-9_]+)["']/g)];
      return m.length ? m[m.length - 1][1] : null;
    };
    const bauStellen = stellen.filter(p => !imKommentar(p));
    const erkannt = bauStellen.map(idVor);
    const ohneAusgang = erkannt.filter(id => !hatAusgang(id));
    merke('0d: im Quelltext meldet JEDE Stelle, die die Klasse fwahl-overlay vergibt, einen Tastenausgang an',
      bauStellen.length >= 4 && ohneAusgang.length === 0,
      { baustellen: bauStellen.length, erkannt, ohneAusgang });
  }

  /* 2d als Quelltext-Pruefung, und zwar mit Grund: Der Unterschied zwischen den beiden Schliess-
     wegen ist im DOM nicht sichtbar. schliesseFlottenwahl raeumt zusaetzlich `fwahlAuftrag` und
     den Sekunden-Zaehler des Countdowns ab; ein blosses classList.remove liesse den Zaehler
     endlos weiterlaufen, weil sein Abbruch am VORHANDENSEIN des Zaehlfeldes haengt und das
     Overlay ja stehen bleibt. */
  const i = JS.indexOf("const o = document.getElementById('fwahlOverlay'); return !!o && o.classList.contains('open'); }");
  const zeile = i > 0 ? JS.slice(i, i + 260) : '';
  merke('2d: der Tastenausgang der Flottenwahl geht ueber schliesseFlottenwahl - nur das raeumt Auftrag und Countdown ab',
    i > 0 && /schliesseFlottenwahl/.test(zeile), { gefunden: i > 0, zeile: zeile.slice(90, 190) });
}

// ===== Fixtures =================================================================================
const PLANETEN = ['vesna', 'rhea', 'aion'];
function stand(){
  const now = Date.now();
  return JSON.stringify({
    ...ruhigeUhren(),
    tutorialSeen:true, newbieWelcomeSeen:true, updateNoticeSeen:true,
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:2e4, forschungspunkte:3e4 },
    buildings:{ solar:24, mine:22, kristallmine:20, labor:16, lager:18, werft:16, turm:10 },
    research:{ rkampf:10 }, fleet:{ jaeger:2000, bomber:400, frachter:200, missions:[] },
    colonies:{}, activeBasePlanet:'home', player:{ id:'u', name:'A', avatarKey:null },
    discovered: PLANETEN.reduce((a,p) => (a[p] = true, a), {}),
    battleStats:{ wins:120, losses:14 }, xp:2600000, credits:1800000, buffs:[], lastTick:now,
    colonyNames:{}, modules:{}, shipModules:{}, equippedShipModules:{}
  });
}
/* EIN Kampfbericht, aus dem die Wiedergabe wirklich ein Gefecht bauen kann - sonst macht
   openBattleReplay() das Fenster sofort wieder zu und die Lage aus Zusage A entstuende gar
   nicht. V1 misst deshalb nach, dass alle drei Fenster wirklich offen stehen. */
const UEBERFALL = { id:'r1', time:Date.now(), ts:Date.now(), type:'raid', result:'win',
  faction:'Söldnerkonvoi', attackPower:41200, defensePower:23400, targetPlanet:'home',
  fleet:{ destroyers:179 }, destroyedShips:{ destroyers:31 },
  stationedFleet:{ jaeger:152, destroyers:2418, schlachtschiff:7234 }, ownLostShips:{},
  defenseBefore:{ flak:55, turm:50, laser:45 } };
const OVERLAYS = ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
                  'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'];
function backendEinfach(store, berichte){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'reports' && berichte) return j({ reports: berichte });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'leaderboard') return j([]);
    // Die Chat-Schublade braucht eine gueltige Antwort, sonst oeffnet sie sich gar nicht erst
    // (Pruefung 3d misst sie). Fuer alle uebrigen Pruefungen aendert die Zeile nichts.
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/reports|messages|ranking|wars|halloffame|bounty|friends|pending|notifications|market|chat/.test(p))
      return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}
const fehlerAlle = [];
/* Der Zustand aller Fenster in EINEM Aufruf - gefragt wird der sichtbare Beleg (Klasse,
   display-Wert, Zurueck-Knopf), nicht eine innere Zustandsvariable. */
const LAGE = () => {
  const p = document.getElementById('fleetPositionPanel');
  const ov = document.getElementById('battleModalOverlay');
  const back = document.getElementById('galaxyBackBtn');
  const cp = document.getElementById('chatPanel');
  return { tafel: !!(p && p.classList.contains('fp-mobile-open')),
           system: !!(back && back.style.display !== 'none'),
           wiedergabe: !!(ov && ov.classList.contains('open')),
           kmenu: !!document.querySelector('.kmenu'),
           chat: !!(cp && cp.classList.contains('open')) };
};
/* Dieselbe Rechnung wie fensterLage() im Spiel, hier NACHGEBAUT statt aufgerufen: Der Waechter
   soll die Lage messen, die er behauptet, und nicht die Auskunft der Stelle glauben, die er
   bewacht. Sie liefert `weg`, `verdeckt` oder `obenauf` - genau die drei Faelle, die der Boden
   auseinanderhaelt. */
const WO = (id) => {
  const el = document.getElementById(id);
  if (!el) return { lage:'kein element' };
  const r = el.getBoundingClientRect();
  const l = Math.max(r.left, 0), o = Math.max(r.top, 0);
  const re = Math.min(r.right, window.innerWidth), u = Math.min(r.bottom, window.innerHeight);
  if (re <= l || u <= o) return { lage:'weg', rechteck:[Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] };
  const oben = document.elementFromPoint((l + re) / 2, (o + u) / 2);
  return { lage: (!!oben && (oben === el || el.contains(oben))) ? 'obenauf' : 'verdeckt',
           punkt:[Math.round((l + re) / 2), Math.round((o + u) / 2)],
           getroffen: oben ? (oben.id || oben.getAttribute('class') || oben.tagName) : null };
};
const zahlOffen = l => (l.tafel ? 1 : 0) + (l.system ? 1 : 0) + (l.wiedergabe ? 1 : 0) + (l.kmenu ? 1 : 0);

(async () => {
  const browser = await starteBrowser();
  async function seite(breite, hoehe, berichte){
    const ctx = await browser.newContext({ viewport:{ width:breite, height:hoehe } });
    const page = await ctx.newPage();
    page.on('pageerror', e => fehlerAlle.push(breite + 'px: ' + String(e)));
    await versionAbfangen(page);
    await page.route('**/api/**', backendEinfach({ 'kepler7-save-v3': stand() }, berichte));
    await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
    await page.goto(SPIEL_URL);
    await page.waitForTimeout(3000);
    await page.evaluate(ids => ids.forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }), OVERLAYS);
    await page.waitForTimeout(600);
    return { ctx, page };
  }

  // ===== 1) Zusage A: ein Tastendruck, ein Fenster ==============================================
  /* Zwei Breiten, weil der Fehler an v8.728.0 an beiden gemessen wurde und die Tafel unterhalb
     der Schwelle eine Schublade, darueber eine feste Spalte ist. */
  /* Der dritte Durchlauf misst DIE MESSUNG SELBST - siehe den Absatz zum Fangschirm im Kopf.
     Er stellt dieselbe Lage her und legt eine kuenstliche Ebene darueber. */
  for (const [b, h, schirm] of [[390, 844, false], [900, 1000, false], [390, 844, true]]){
    const { ctx, page } = await seite(b, h, [UEBERFALL]);
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await page.waitForTimeout(1500);
    const sysDa = await oeffneSystemUeberSektoren(page, 'vega');
    await page.evaluate(() => { const x = document.getElementById('headerReportsBtn'); if (x) x.click(); });
    await page.waitForTimeout(1600);
    await page.evaluate(() => { const t = document.getElementById('fpToggleBtn'); if (t) t.click(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { const x = document.querySelector('[data-watch-battle]'); if (x) x.click(); });
    await page.waitForTimeout(1500);
    const vor = await page.evaluate(LAGE);
    merke('V1-' + b + (schirm ? 'f' : '') + ': Vorbedingung - Tafel, System UND Wiedergabe stehen wirklich alle drei offen',
      sysDa === true && vor.tafel === true && vor.system === true && vor.wiedergabe === true, vor);

    if (schirm){
      /* DER FANGSCHIRM: eine unsichtbare Ebene ueber allem. Er nimmt keinem Fenster einen
         Ausgang und bleibt nur fuer diesen einen Tastendruck liegen - er ist das Messmittel,
         nicht der Messgegenstand. opacity:0 statt visibility:hidden, weil ein unsichtbares
         Element nur so vom Treffertest gefunden wird. */
      const schirmDa = await page.evaluate(() => {
        const d = document.createElement('div');
        d.id = '__fangschirm';
        d.style.cssText = 'position:fixed; inset:0; z-index:9999; opacity:0;';
        document.body.appendChild(d);
        return !!document.getElementById('__fangschirm');
      });
      await page.waitForTimeout(200);
      const wo = await page.evaluate(WO, 'battleModalOverlay');
      const woKarte = await page.evaluate(WO, 'galaxyMapSvg');
      merke('V7: Vorbedingung - der Fangschirm liegt WIRKLICH ueber der Wiedergabe, und die Kartenflaeche ist gar nicht im Bild',
        schirmDa === true && wo.lage === 'verdeckt' && wo.getroffen === '__fangschirm' && woKarte.lage === 'weg',
        { wiedergabe: wo, karte: woKarte });
      await page.keyboard.press('Escape'); await page.waitForTimeout(600);
      const nachF = await page.evaluate(LAGE);
      /* DIE ZEILE, AUF DER DIE ETAPPE STEHT, HAT HIER IHREN FALSIFIKATOR. Fragt escapeAusgang die
         Messung nicht mehr (Gegenprobe sabBlind), nimmt die Wiedergabe die Taste, obwohl sie
         nachweislich nicht obenauf liegt - dann steht sie hinterher zu und das System offen.
         Mit Messung ist es genau andersherum: Die Wiedergabe laesst die Taste liegen, und weil
         die Kartenflaeche in dieser Lage gar nicht im Bild steht (Karte-Reiter auf display:none,
         der Weg zur Wiedergabe fuehrt ueber die Berichte), nimmt sie der Boden. */
      merke('1d: unter einer fremden Ebene nimmt die Wiedergabe die Taste NICHT - sie geht weiter an den Boden',
        nachF.wiedergabe === true && nachF.system === false, { vor, nachF });
      await page.evaluate(() => { const d = document.getElementById('__fangschirm'); if (d) d.remove(); });
      await familieEinsammeln(page);
      await ctx.close();
      continue;
    }

    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const e1 = await page.evaluate(LAGE);
    merke('1a' + (b === 390 ? '' : '-' + b) + ': der erste Tastendruck schliesst GENAU EIN Fenster - das sichtbare (die Wiedergabe)',
      e1.wiedergabe === false && e1.system === true && e1.tafel === true, { vor, e1, offenVorher: zahlOffen(vor), offenNachher: zahlOffen(e1) });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const e2 = await page.evaluate(LAGE);
    merke('1b' + (b === 390 ? '' : '-' + b) + ': der zweite gehoert dann der Tafel - das System darunter bleibt offen',
      e2.tafel === false && e2.system === true, { e1, e2 });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const e3 = await page.evaluate(LAGE);
    merke('1c' + (b === 390 ? '' : '-' + b) + ': der dritte schliesst das System - kein Ausgang geht dabei verloren',
      e3.system === false, { e2, e3 });
    await familieEinsammeln(page);
    await ctx.close();
  }

  // ===== 3) Die Gegenrichtung: was heute auf Escape hoert, tut es weiter ========================
  {
    const { ctx, page } = await seite(900, 1000);
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await page.waitForTimeout(1500);
    const sysDa = await oeffneSystemUeberSektoren(page, 'vega');
    /* DER BODEN, UND ZWAR IN DER LAGE, DIE IHN NOETIG MACHT: bis ganz nach unten gescrollt, die
       Kartenflaeche vollstaendig ausserhalb des Bildes. Eine Obenauf-Messung wuerde dem System
       hier den Ausgang nehmen; gemessen am 13.09.2026 stand die Flaeche bei top -954 bis -129. */
    await page.evaluate(() => window.scrollTo(0, 99999));
    await page.waitForTimeout(400);
    const rand = await page.evaluate(() => {
      const svg = document.getElementById('galaxyMapSvg');
      const r = svg.getBoundingClientRect();
      return { oben: Math.round(r.top), unten: Math.round(r.bottom), hoehe: window.innerHeight,
               imBild: r.bottom > 0 && r.top < window.innerHeight, scrollY: Math.round(window.scrollY) };
    });
    const vorS = await page.evaluate(LAGE);
    merke('V2: Vorbedingung - das System steht offen und seine Kartenflaeche liegt ganz ausserhalb des Bildes',
      sysDa === true && vorS.system === true && rand.imBild === false, { rand, vorS });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const nachS = await page.evaluate(LAGE);
    merke('3a: aus dem Bild gescrollt schliesst Escape das System weiterhin (fuer den Boden ist `weg` kein `verdeckt`)',
      nachS.system === false, { vorS, nachS });

    // Das Kartenmenue behaelt die Taste - und das System darunter bleibt stehen.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const wieder = await oeffneSystemUeberSektoren(page, 'vega');
    await page.evaluate(() => {
      const n = document.querySelector('#galaxyMapSvg [data-planet],#galaxyMapSvg [data-map-npc],#galaxyMapSvg [data-map-asteroid]');
      if (!n) return;
      const r = n.getBoundingClientRect();
      n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:r.left + r.width/2, clientY:r.top + r.height/2 }));
    });
    await page.waitForTimeout(600);
    const vorM = await page.evaluate(LAGE);
    merke('V3: Vorbedingung - das Kartenmenue steht offen, das System darunter auch',
      wieder === true && vorM.kmenu === true && vorM.system === true, vorM);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const nachM = await page.evaluate(LAGE);
    merke('3b: das Kartenmenue behaelt Escape - es geht zu, das System darunter bleibt offen',
      nachM.kmenu === false && nachM.system === true, { vorM, nachM });
    await familieEinsammeln(page);
    await ctx.close();
  }

  // ===== 3d) Die andere Haelfte des Bodens: im Bild, aber verdeckt ==============================
  /* WARUM DIESE PRUEFUNG EXISTIERT (Durchsicht 13.09.2026, Befund 2). Die Ausnahme fuer den Boden
     war nur an der bequemen Haelfte gemessen: Ein aus dem Bild gescrolltes System braucht den
     Ausgang (3a). Der PREIS stand nirgends - solange der Boden GAR NICHT mass, nahm er die Taste
     auch dann, wenn ein Fenster OHNE Tastenausgang bildschirmnah darueber lag.
     Die Chat-Schublade ist genau so ein Fenster, und der Waechter hat sie ausdruecklich als
     unbedenklich abgeschrieben. GEMESSEN war sie eine Falle: 390x844, Karte-Reiter, System
     aufgeklappt, Kartenflaeche sichtbar und obenauf - Schublade auf, elementFromPoint in der
     Mitte der Kartenflaeche lieferte `chatPanelAllianceBox`, und Escape schloss das System
     dahinter. Auf 900x1000 dasselbe mit `chatPanelOverlay`.
     Gemessen wird hier die REGEL, nicht die Schublade: Liegt die Kartenflaeche im Bild und ist
     verdeckt, laesst der Boden die Taste liegen. Die Schublade selbst bleibt unberuehrt - sie
     bekommt keinen Tastenausgang (Vertrag UI-8, Abschnitt D), sie geht auf Escape also auch
     nicht zu. Falsifikator: sabBlinderBoden. */
  {
    const { ctx, page } = await seite(390, 844);
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await page.waitForTimeout(1500);
    const sysDa = await oeffneSystemUeberSektoren(page, 'vega');
    // Die Kartenflaeche MUSS im Bild stehen, sonst misst diese Pruefung den Fall aus 3a.
    await page.evaluate(() => { const svg = document.getElementById('galaxyMapSvg'); if (svg) svg.scrollIntoView({ block:'center' }); });
    await page.waitForTimeout(500);
    const woVor = await page.evaluate(WO, 'galaxyMapSvg');
    await page.evaluate(() => { const t = document.getElementById('chatEdgeTab'); if (t) t.click(); });
    await page.waitForTimeout(900);
    const woNach = await page.evaluate(WO, 'galaxyMapSvg');
    const vorC = await page.evaluate(LAGE);
    merke('V8: Vorbedingung - die Kartenflaeche lag OBENAUF und liegt jetzt IM BILD unter der offenen Chat-Schublade',
      sysDa === true && vorC.system === true && vorC.chat === true
        && woVor.lage === 'obenauf' && woNach.lage === 'verdeckt',
      { vorherige: woVor, jetzt: woNach, lage: vorC });
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    const nachC = await page.evaluate(LAGE);
    merke('3d: unter der offenen Chat-Schublade laesst der Boden die Taste liegen - das System dahinter bleibt offen',
      nachC.system === true && nachC.chat === true, { vorC, nachC });
    await familieEinsammeln(page);
    await ctx.close();
  }

  // ===== 2) Zusage B: die vier Fenster der fwahl-Familie ========================================
  await vorpostenFenster(browser, merke);
  await flottenwahlFenster(browser, merke);
  await flottenwahlUeberSystem(browser, merke);
  await verbandsRuf(browser, merke);

  /* 0c: DIE FAMILIE AUS DEM GERENDERTEN DOM (Durchsicht 13.09.2026, Befund 3). Was WIRKLICH die
     Klasse traegt, weiss der Browser besser als jede Suche im Quelltext - und die Pruefungen
     oeffnen ohnehin alle vier Fenster. Gemessen wird: Jedes Element, das die Klasse im DOM
     traegt, hat eine Id, und diese Id kommt in einem escapeAusgang-Aufruf vor. Die Untergrenze
     von vier haelt die Zeile davor, still gegenstandslos zu werden, wenn ein Fenster gar nicht
     mehr geoeffnet wird.
     Falsifikatoren gemessen: sabMuster und sabMusterKlasse (fuenftes Fenster ohne Ausgang, je
     einmal ueber className und ueber classList.add), sabFlotte (Ausgang eines vorhandenen
     weggenommen) und der Grundstand, wo es gar keinen escapeAusgang gibt. */
  {
    const gefunden = [...familieImDom];
    const ohneAusgang = gefunden.filter(id => !hatAusgang(id));
    merke('0c: jedes Element, das im DOM wirklich die Klasse fwahl-overlay traegt, hat einen Tastenausgang',
      gefunden.length >= 4 && ohneAusgang.length === 0, { gefunden, ohneAusgang });
  }

  merke('J1: keine Skriptfehler auf irgendeiner der gemessenen Seiten', fehlerAlle.length === 0, fehlerAlle.slice(0, 3));
  await browser.close();

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false);
    const fehlend = soll.filter(n => ergebnis[n] !== false);
    const unerwartet = gefallen.filter(n => soll.indexOf(n) < 0);
    if (fehlend.length) console.log('FAIL - Gegenprobe unvollstaendig: ' + fehlend.join(' ') + ' blieben gruen');
    else if (unerwartet.length) console.log('FAIL - Gegenprobe UEBERZAEHLIG: ' + unerwartet.join(' ') + ' fiel zusaetzlich');
    else console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' gefallen (' + gefallen.map(n => n + '=rot').join(' ') + ')');
    process.exit((fehlend.length || unerwartet.length) ? 1 : 0);
  }
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.log('FAIL - Testlauf abgebrochen: ' + (e && e.stack || e));
  process.exit(1);
});

// ---- Projektfenster und Steckplatzfenster des Vorpostens ---------------------------------------
async function vorpostenFenster(browser, merke){
  const ICH = 'u-ich', SYS = 'vega', now = Date.now();
  const MODUL_DEFS = [
    { key:'kernpanzer', name:'Kernpanzerung', icon:'ti-shield', wirkung:'kern', basis:0.08, desc:'Verstärkt den Kern.' },
    { key:'geschuetz', name:'Geschützbank', icon:'ti-sword', wirkung:'verteidigung', basis:0.10, desc:'Geschütze.' }
  ];
  const SELTENHEITEN = { gewoehnlich:{ label:'Gewöhnlich', mult:1.0 }, selten:{ label:'Selten', mult:2.0 }, episch:{ label:'Episch', mult:2.8 } };
  const PROJEKT_DEFS = [
    { key:'dockring', name:'Dockring', icon:'ti-rocket', zweig:'festung', stufeAb:5, dauerMs:28800000, wirkung:{ garnison:0.25 }, desc:'Ein zweiter Liegeplatzring.', kosten:{ erz:9000 } },
    { key:'tiefenhorchen', name:'Tiefenhorchposten', icon:'ti-antenna-bars-5', zweig:null, stufeAb:6, dauerMs:43200000, wirkung:{ scan:1 }, desc:'Lauschanlage.', kosten:{ erz:16000 } }
  ];
  const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s, garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, kosten: s===1?null:{ erz:1000 } }));
  const vp = { id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now-86400000, stufe:5, name:'Zitadelle',
    zweig:'festung', zweigName:'Festungsring', maxStufe:8, kern:{ lp:900000, lpMax:1000000 }, verteidigung:250000,
    garnisonAnzahl:0, garnisonMax:4800, garnison:{}, schutzBis:0, ausbauAb: now-1000,
    nutzen:{ flug:0.15, prod:0.04, scan:4, flugDeckel:0.5 }, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
    slots:2, module:['geschuetz:selten'], modulBoni:{ kern:0, verteidigung:0.2, garnison:0, flug:0, prod:0, scan:0 },
    projekte:['tiefenhorchen'], projektBoni:null, projektLaeuft:null, projektMoeglich:['dockring'], naechsteStufe:null };
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  const save = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5000, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });

  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => fehlerAlle.push('vorposten: ' + String(e)));
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': save };
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{}, wrackKonvois:[] });
    if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000, ausbauMs:43200000,
      garnisonFaktor:0.5, stufen:STUFEN,
      zweige:[{ key:'festung', name:'Festungsring', kurz:'Hält Systeme.', namen:{5:'Zitadelle'}, mult:{} }],
      zweigAb:4, maxStufe:8, modulDefs:MODUL_DEFS, modulSeltenheiten:SELTENHEITEN, modulBaubar:['gewoehnlich'],
      modulAusbauKosten:250, modulBauAbklingMs:21600000, modulBestand:{ 'kernpanzer:episch':1 }, modulBauAb:0,
      projektDefs:PROJEKT_DEFS, projekteAktiv:true, flugDeckel:0.5, liste:[vp], eigene:1 });
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
    if (p === 'players-map') return j({ players:[] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
    return j({ ok:true });
  });
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); window.confirm = () => true; });
  await page.goto(SPIEL_URL); await page.waitForTimeout(5000);
  await page.evaluate(ids => ids.forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }), OVERLAYS);
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(800);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(1200);

  const faelle = [['2a', 'Projektfenster', 'vorpostenProjektOverlay', '^Projekte'],
                  ['2b', 'Steckplatzfenster', 'vorpostenModulOverlay', 'Steckplätze']];
  for (const [nr, name, id, rx] of faelle){
    if (!await page.evaluate(() => { const b = document.getElementById('galaxyBackBtn'); return !!b && b.style.display !== 'none'; }))
      await oeffneSystemUeberSektoren(page, SYS);
    await page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    await page.waitForTimeout(600);
    await page.evaluate(r => { const b = [...document.querySelectorAll('.kmenu button')].find(x => new RegExp(r).test(x.textContent.trim())); if (b) b.click(); }, rx);
    await page.waitForTimeout(700);
    const vor = await page.evaluate(i => {
      const o = document.getElementById(i), back = document.getElementById('galaxyBackBtn');
      if (!o) return { da:false };
      const r = o.getBoundingClientRect();
      const mitte = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      return { da:true, offen:o.classList.contains('open'),
               system: !!(back && back.style.display !== 'none'),
               deckt: Math.round(r.width) >= window.innerWidth && Math.round(r.height) >= window.innerHeight,
               mitteMeins: !!(mitte && (mitte === o || o.contains(mitte))) };
    }, id);
    merke('V4-' + nr + ': Vorbedingung - ' + name + ' offen und bildschirmfuellend, System darunter offen',
      vor.da === true && vor.offen === true && vor.system === true && vor.deckt === true, vor);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const nach = await page.evaluate(i => {
      const o = document.getElementById(i), back = document.getElementById('galaxyBackBtn');
      return { offen: !!(o && o.classList.contains('open')), system: !!(back && back.style.display !== 'none') };
    }, id);
    merke(nr + ': das ' + name + ' schliesst auf Escape - und das System dahinter bleibt offen',
      nach.offen === false && nach.system === true, { vor, nach });
  }
  await familieEinsammeln(page);
  await ctx.close();
}

// ---- Flottenwahl --------------------------------------------------------------------------------
async function flottenwahlFenster(browser, merke){
  const SAVE = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{ energie:9e5, erz:9e5, kristalle:9e5, deuterium:9e5, antimaterie:900, forschungspunkte:900 },
    buildings:{ solar:20, mine:18, labor:10, lager:40, werft:14 }, research:{},
    fleet:{ jaeger:60, cruisers:30, frachter:10, missions:[] }, colonies:{}, activeBasePlanet:'home',
    player:{ id:'u', name:'Ich', avatarKey:null }, galaxySubTab:'kampf',
    xp:5000, credits:5000, buffs:[], lastTick:Date.now(), colonyNames:{} });
  const GEGNER = { id:'feind1', name:'Zielperson', score:12000, level:12, allianceTag:'XYZ',
                   ships:{ jaeger:10 }, defensePower:500, buildLvl:10, colonyCount:2 };
  const store = { 'kepler7-save-v3': SAVE };
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => fehlerAlle.push('flottenwahl: ' + String(e)));
  await page.route('**/api/**', async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true, supporter:{ active:false, tier:null } });
    if (p === 'reports') return j({ reports:[] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'storage-list') return j({ keys:['leaderboard:feind1'] });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()).value; } catch(e){} return j({ ok:true, version:2 }); }
      if (k === 'leaderboard:feind1') return j({ key:k, value: JSON.stringify(GEGNER), version:1 });
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    return j([]);
  });
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  page.on('dialog', d => d.accept());
  await page.goto(SPIEL_URL); await page.waitForTimeout(4500);
  await page.evaluate(ids => ids.forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }), OVERLAYS);
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-tab]')].find(x => x.getAttribute('data-tab') === 'galaxie'); if (b) b.click(); });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { const b = document.querySelector('[data-duel]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  const gabKnopf = await page.evaluate(() => { const b = document.getElementById('pendingAttackBtn'); if (!b || b.disabled) return false; b.click(); return true; });
  await page.waitForTimeout(900);
  const vor = await page.evaluate(() => {
    const o = document.getElementById('fwahlOverlay');
    if (!o) return { da:false };
    const r = o.getBoundingClientRect();
    return { da:true, offen:o.classList.contains('open'),
             deckt: Math.round(r.width) >= window.innerWidth && Math.round(r.height) >= window.innerHeight };
  });
  merke('V5: Vorbedingung - die Flottenwahl steht offen und deckt den Bildschirm',
    gabKnopf === true && vor.da === true && vor.offen === true && vor.deckt === true, vor);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  const nach = await page.evaluate(() => ({ offen: !!(document.getElementById('fwahlOverlay') || {}).classList?.contains('open') }));
  /* Und danach laesst sie sich wieder oeffnen - ein Tastenausgang, der das Feld in einem halben
     Zustand zuruecklaesst, waere keiner. */
  await page.evaluate(() => { const b = document.getElementById('pendingAttackBtn'); if (b && !b.disabled) b.click(); });
  await page.waitForTimeout(700);
  const wieder = await page.evaluate(() => {
    const o = document.getElementById('fwahlOverlay');
    const t = document.querySelector('#fwahlOverlay .fwahl-titel');
    return { offen: !!(o && o.classList.contains('open')), titel: t ? t.textContent.trim() : null };
  });
  merke('2c: die Flottenwahl schliesst auf Escape und laesst sich danach unveraendert wieder oeffnen',
    nach.offen === false && wieder.offen === true && /Zielperson/.test(wieder.titel || ''), { nach, wieder });
  await familieEinsammeln(page);
  await ctx.close();
}

// ---- Flottenwahl UEBER dem aufgeklappten System -------------------------------------------------
/* WARUM ES DIESE ZWEITE FLOTTENWAHL-PRUEFUNG GIBT (Durchsicht 13.09.2026, Befund 4). Zusage B
   lautet, Escape habe bei offenem fwahl-Fenster etwas UNSICHTBARES getan: das aufgeklappte System
   darunter geschlossen. 2a, 2b und 3c messen genau diese geschichtete Lage - 2c nicht. Dort wird
   die Flottenwahl ueber den Galaxie-Reiter und den Angriffsknopf geoeffnet, und darunter liegt gar
   kein System. 2c misst also, DASS das Fenster zugeht, nie, dass es die Taste BEHAELT.
   Der Weg hierher ist derselbe, den 2a und 2b schon benutzen, nur ein anderer Eintrag: Karte-
   Reiter, System aufklappen, den NPC-Knoten antippen, im Kartenmenue auf „Angreifen". GEMESSEN am
   13.09.2026 auf 390x844 und 900x1000: Das oeffnet `fwahlOverlay` ueber dem weiterhin
   aufgeklappten System (Titel „Schrottgarde-Klan angreifen"), und der NPC-Knoten des Systems vega
   heisst `raider2`.
   DER SPIELSTAND BRAUCHT ECHTE KAMPFSCHIFFE. Gemessen: Mit jaeger/bomber/frachter allein ist der
   Eintrag GESPERRT - kampfflottenMangel zaehlt Jaeger ohne Traegerschiff nicht mit, combatFleetCount
   ist dann 0. Deshalb stehen hier zusaetzlich cruisers und destroyers; die Vorbedingung V9 misst
   nach, dass der Eintrag wirklich anklickbar war. */
async function flottenwahlUeberSystem(browser, merke){
  const SYS = 'vega';
  const roh = JSON.parse(stand());
  roh.fleet = Object.assign({}, roh.fleet, { cruisers:30, destroyers:12 });
  const store = { 'kepler7-save-v3': JSON.stringify(roh) };
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => fehlerAlle.push('flottenwahl-ueber-system: ' + String(e)));
  await versionAbfangen(page);
  await page.route('**/api/**', backendEinfach(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  page.on('dialog', d => d.accept());
  await page.goto(SPIEL_URL); await page.waitForTimeout(3000);
  await page.evaluate(ids => ids.forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }), OVERLAYS);
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(1500);
  const sysDa = await oeffneSystemUeberSektoren(page, SYS);
  await page.evaluate(() => {
    const n = document.querySelector('#galaxyMapSvg [data-map-npc]');
    if (!n) return;
    const r = n.getBoundingClientRect();
    n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:r.left + r.width/2, clientY:r.top + r.height/2 }));
  });
  await page.waitForTimeout(700);
  const geklickt = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.kmenu button')].find(x => /Angreifen/.test(x.textContent || ''));
    if (!b || b.disabled) return false;
    b.click(); return true;
  });
  await page.waitForTimeout(900);
  const vor = await page.evaluate(() => {
    const o = document.getElementById('fwahlOverlay'), back = document.getElementById('galaxyBackBtn');
    const r = o ? o.getBoundingClientRect() : null;
    return { da:!!o, offen: !!(o && o.classList.contains('open')),
             system: !!(back && back.style.display !== 'none'),
             deckt: !!r && Math.round(r.width) >= window.innerWidth && Math.round(r.height) >= window.innerHeight };
  });
  merke('V9: Vorbedingung - die Flottenwahl steht bildschirmfuellend UEBER dem aufgeklappten System',
    sysDa === true && geklickt === true && vor.offen === true && vor.system === true && vor.deckt === true,
    { geklickt, vor });
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  const nach = await page.evaluate(() => {
    const o = document.getElementById('fwahlOverlay'), back = document.getElementById('galaxyBackBtn');
    return { offen: !!(o && o.classList.contains('open')), system: !!(back && back.style.display !== 'none') };
  });
  merke('2e: die Flottenwahl BEHAELT die Taste - sie geht zu, das System darunter bleibt offen',
    nach.offen === false && nach.system === true, { vor, nach });
  await familieEinsammeln(page);
  await ctx.close();
}

// ---- Verbandsruf (Bestandsfenster derselben Familie) --------------------------------------------
async function verbandsRuf(browser, merke){
  const SYS = 'vega', TAG = 'TST', SAVE_KEY = 'kepler7-save-v3';
  const nest = { id:'n1', volk:'kryll', sys:SYS, stufe:3, lp:260000, lpMax:400000,
    seit: Date.now()-7200000, letzteReifung: Date.now()-3600000, naechsterWurf: Date.now()+8*3600*1000,
    naechsteWanderung:0, beitraege:{}, schlaege:{} };
  const backend = store => async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[],
      activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], controlledSystems:{}, factions:{}, alienNester:[nest] });
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{} } } });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'storage-list') return j({ keys: Object.keys(store).filter(k => k.indexOf('__') !== 0) });
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|reports|vorposten/.test(p))
      return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
  async function tab(startSave){
    const store = {};
    if (startSave) store[SAVE_KEY] = startSave;
    store['alliance:'+TAG+':info'] = JSON.stringify({ tag:TAG, creatorId:'u', creatorName:'A', createdAt: Date.now()-86400000, joinMode:'open' });
    store['alliance:'+TAG+':role:u'] = JSON.stringify({ role:'admin', joinedAt: Date.now()-86400000, userId:'u' });
    store['alliance:'+TAG+':base'] = JSON.stringify({ foundedAt: Date.now()-86400000, sector:'kepler', level:3, hp:1000 });
    const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => fehlerAlle.push('verbandsruf: ' + String(e)));
    await page.route('**/api/**', backend(store));
    await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
    await page.goto(SPIEL_URL); await page.waitForTimeout(3500);
    await page.evaluate(ids => ids.forEach(i => { const o = document.getElementById(i); if (o) o.remove(); }), OVERLAYS);
    return { ctx, page, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
  }
  /* ZWEI DURCHLAEUFE, wie in tests/test_nest_verbandsruf.js: Der erste holt einen Ausgangsstand
     aus dem Spiel selbst, der zweite setzt Allianz und Rang darauf - eingetippte Spielstaende
     veralten, ein gemessener nicht. */
  const roh = await tab();
  const basis = roh.stand();
  await roh.ctx.close();
  if (!basis || !basis.buildings){ merke('3c: der Verbandsruf behaelt Escape', false, 'kein Ausgangsstand'); return; }
  const st = JSON.parse(JSON.stringify(basis));
  st.fleet = Object.assign({ missions:[] }, st.fleet, { jaeger:200, cruisers:80 });
  st.player = Object.assign({}, st.player, { allianceTag:TAG, allianceRole:'admin' });
  const fern = Date.now() + 365*24*3600*1000;
  for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
  st.activeEvent = null; st.buffs = [];
  const t = await tab(JSON.stringify(st));
  const page = t.page;
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(1000);
  await page.evaluate(() => { const n = document.querySelector('[data-map-nest]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
  await page.waitForTimeout(600);
  const auf = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.kmenu button')].find(x => /Allianz-Verband ausrufen/.test(x.textContent||''));
    if (!b || b.disabled) return false; b.click(); return true;
  });
  await page.waitForTimeout(600);
  const vor = await page.evaluate(() => {
    const o = document.getElementById('vrufOverlay'), back = document.getElementById('galaxyBackBtn');
    return { offen: !!(o && o.classList.contains('open')), system: !!(back && back.style.display !== 'none') };
  });
  merke('V6: Vorbedingung - der Verbandsruf steht offen, das System darunter auch',
    auf === true && vor.offen === true && vor.system === true, vor);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  const nach = await page.evaluate(() => {
    const o = document.getElementById('vrufOverlay'), back = document.getElementById('galaxyBackBtn');
    return { offen: !!(o && o.classList.contains('open')), system: !!(back && back.style.display !== 'none') };
  });
  merke('3c: der Verbandsruf behaelt seinen Tastenausgang - er geht zu, das System darunter bleibt offen',
    nach.offen === false && nach.system === true, { vor, nach });
  await familieEinsammeln(page);
  await t.ctx.close();
}
