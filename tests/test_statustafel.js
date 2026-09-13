// Die Statustafel am rechten Rand (#fleetPositionPanel) - Waechter zu UI-7, 13.09.2026.
//
//   node tests/test_statustafel.js
//   KEPLER_SPIELDATEI=<kopie> KEPLER_STATUSTAFEL_GEGENPROBE=<stand> node tests/test_statustafel.js
//
// DREI ZUSAGEN, DREI ABSCHNITTE
// -----------------------------
// A  Fuer eine Tafel, die gar nicht im Bild ist, wird nicht mehr gerechnet.
// B  Derselbe Knopf, der aufklappt, klappt auch wieder zu - und ist dabei treffbar.
// C  Escape schliesst die aufgeklappte Tafel, und nur sie.
//
// VIER PRUEFUNGEN AUS DER DURCHSICHT VOM 13.09.2026 (1f, 2f, 3f, 3g)
// ------------------------------------------------------------------
// 1f  DER RIEGEL AUS A DARF NICHTS MITFANGEN, WAS NICHT DER TAFEL GEHOERT. `[data-fp-vziel]`
//     wird ausdruecklich DOKUMENTWEIT verdrahtet, weil dieselbe Zeile in der Missionsliste des
//     Flotte-Reiters steht und die hinter einem Tab-Riegel haengt. Gemessen bei 390 px mit
//     ZUGEKLAPPTER Tafel: Die Zeile trug data-fp-vziel und den Titel „antippen zeigt das Ziel
//     auf der Karte", aber keinen onclick - 0 von 1 verdrahtet. Geprueft wird nicht nur der
//     Handler, sondern dass der Tipp WIRKT (Karte offen, Zielsystem aufgeklappt).
// 2f  TREFFBAR IST NICHT DASSELBE WIE OBENAUF. 2c misst, dass der Knopf getroffen wird; erst 2f
//     misst, dass er dafuer nichts verdeckt. Gemessen mit offener Tafel, Ueberlappung
//     Knopf/Tafel: 360 px 33,4 x 37,7 - 390 px 22,8 x 51,7 - 430 px 2,8 x 64,7 - 700/1000/1219 px
//     keine. Unter der Flaeche lag bei 360 und 390 px je eine Missionszeile mit eigenem
//     Klickziel; der Tipp dorthin klappte die Tafel ZU statt zu springen. Deshalb SECHS Breiten
//     und die Flaeche als Zahl, nicht ein einzelner Trefferpunkt.
// 3f  UEBER DER SCHWELLE DARF KEIN FENSTER OHNE AUSGANG STEHENBLEIBEN. Der Nachzug reparierte
//     den INHALT der Tafel, nicht ihren ZUSTAND: bei 390 px aufklappen, auf 1400 px wechseln -
//     .fp-mobile-open und Verdunklung blieben stehen, elementFromPoint in der Bildmitte lieferte
//     „fpBackdrop", Randknopf und x sind dort display:none.
// 3g  UND ESCAPE WIRD DORT NICHT MEHR FUER DIESEN REST VERBRAUCHT. Gemessen: Der erste
//     Tastendruck schloss die unsichtbare Klasse, das aufgeklappte System darunter brauchte
//     einen zweiten.
//
// ZWEI PRUEFUNGEN AUS DER DURCHSICHT VOM 13.09.2026, ZWEITER TEIL (3h, 3i)
// ------------------------------------------------------------------------
// 3h  EIN FENSTER, DAS SICH OHNE KLICK OEFFNET, NIMMT DIE TAFEL NICHT MIT IN DEN HINTERGRUND.
//     maybeAutoWatchBattle() schiebt die bildschirmfuellende Kampf-Wiedergabe per setTimeout
//     400 ms hinter einen eintreffenden Kampfbericht; der Schalter state.autoWatchLiveRaid steht
//     per Voreinstellung auf an. GEMESSEN am 13.09.2026 auf 390x844, Tafel offen: beide z-index
//     210, die Wiedergabe steht im Markup spaeter und malt oben (elementFromPoint ueber der
//     Tafel lieferte „osCv"). Der erste Escape schloss die VERDECKTE Tafel, die sichtbare
//     Wiedergabe blieb stehen und brauchte einen zweiten.
//     DIE LOESUNG ZAEHLT NICHT AUF: statustafelObenauf() fragt den Browser, was an der Stelle
//     der Tafel obenauf liegt. Eine Liste der staerkeren Fenster waere derselbe Fehler noch
//     einmal - die Korrekturrunde zu UI-7 hatte genau deshalb nichts gefunden, weil sie nur
//     Wege kannte, die ein KLICK herstellt.
// 3i  UND DIE TAFEL VERLIERT IHREN EIGENEN AUSGANG DABEI NICHT. Ohne diese zweite Haelfte waere
//     „den Lauscher ganz weglassen" eine erlaubte Antwort auf 3h. Sobald die Wiedergabe weg ist,
//     liegt die Tafel wieder obenauf, und der naechste Tastendruck gehoert ihr.
//
// EINE PRUEFUNG AUS DER DURCHSICHT VOM 13.09.2026, DRITTER TEIL (2g)
// ------------------------------------------------------------------
// 2g  OBENAUF UEBER DER EIGENEN TAFEL HEISST NICHT OBENAUF UEBER ALLEM. UI-7 hob den Randknopf
//     bei offener Tafel auf z-index 211 - gedacht als Sicherheitsmarge ueber die Verdunklung
//     (205), gemessen aber eine Stufe UEBER der bildschirmfuellenden Kampf-Wiedergabe
//     (.battle-modal-overlay, 210). GEMESSEN am 13.09.2026 auf 390x844, Tafel offen und
//     Wiedergabe darueber: elementFromPoint auf der Knopfmitte (371,6 | 759,2) lieferte
//     „fpToggleBtn", der Knopf war sichtbar, und ein echter Maustipp dorthin klappte die
//     VERDECKTE Tafel zu, waehrend die Wiedergabe offen stehenblieb.
//     DIE MARGE IST DESHALB WEG (206 statt 211), und ihre Rolle uebernimmt kein groesserer
//     Abstand, sondern ein Waechter: 2f misst, dass Knopf und Tafel sich gar nicht ueberlappen,
//     2g misst die Gegenrichtung. Eine Zahl, die sich Luft ueber fremden Ebenen nimmt, ist keine
//     Sicherheit - sie ist der zweite Fehler.
//
// FUENF FALLEN, GEGEN DIE DIESER WAECHTER AUSDRUECKLICH GEBAUT IST
// ----------------------------------------------------------------
//  1. DIE SICHTBARKEIT HAENGT AN EINER MEDIA-REGEL (max-width: 1219px), NICHT AN EINER KLASSE.
//     Ab 1220 px steht die Tafel fest am rechten Rand, darunter ist sie display:none und wird
//     erst durch .fp-mobile-open sichtbar. Gemessen wird deshalb ueberall der GERECHNETE
//     display-Wert; die Zahl 1219 steht in diesem Test an keiner Stelle. Eine zweite Schwelle
//     hier waere eine zweite Wahrheit, die beim naechsten Anfassen der Media-Regel still falsch
//     wird - und ein Test, der nur bei EINER Breite misst, misst die halbe Wahrheit (deshalb
//     390 px zu, 390 px auf und 1400 px).
//  2. MIT LEEREM SPIELSTAND IST DIESE ZUSAGE GEGENSTANDSLOS. Gemessen am 13.09.2026: der
//     Tafel-Block kostet mit leerem Stand 0,008 ms je Takt, mit dem schweren Stand unten
//     0,758 ms (Takt-Laufzeit 17,02 -> 15,34 ms, mit 4-fach gedrosselter CPU 71,99 -> 62,47 ms).
//     Der schwere Stand (12 Kolonien, 96 Missionen, dazu ein angeschlossener Allianz-Verband =
//     97 Zeilen, gemessen) ist deshalb Teil der Pruefung und nicht Beiwerk - V1 misst nach, dass
//     er wirklich schwer ist, sonst waere „0 Zeilen" in 1a trivial.
//  3. DER EFFEKT WIRD GEMESSEN, NICHT DIE ANWESENHEIT EINER ABFRAGE IM QUELLTEXT. Gefragt wird
//     „steht die Zeile im DOM?", nicht „steht die Bedingung in der Datei?".
//  4. NICHT JEDER KASTEN DER TAFEL TAUGT ALS MESSPUNKT. GEMESSEN: #fpLeaderboard ist auch bei
//     unsichtbarer Tafel gefuellt (20 Zeichen) - renderFpLeaderboard() hat einen ZWEITEN Aufrufer
//     in loadLeaderboard(), der nichts mit dem Riegel zu tun hat. Eine Pruefung „Bestenliste
//     leer" waere also auf voellig korrektem Code gefallen. Als Messpunkte taugen die
//     Missionsliste (#fleetPositionList, 97 gegen 0 Zeilen) und der Spenden-Kasten
//     (#fpAllianceDonationBox, 47 gegen 0 Zeichen ohne Allianz) - beide haben nur den einen
//     Aufrufer hinter dem Riegel.
//  5. EIN UMSCHALTER, DEN MAN NICHT TREFFEN KANN, IST KEINER. Gemessen am Ausgangsstand auf
//     390x844: document.elementFromPoint auf der Knopfmitte lieferte bei offener Tafel
//     „fleetPositionPanel" - der Knopf (z-index 50) lag unter Tafel (210) UND Verdunklung (205).
//     Deshalb wird mit page.mouse.click auf die gemessene Knopfmitte getippt, also ueber die
//     Trefferpruefung des Browsers, und nicht mit element.click().
//
// WARUM 1e DEN TAKT STILLLEGT
// ---------------------------
// Der Nachzug nach einem Groessenwechsel ist auf 150 ms entprellt, der Sekunden-Takt holt
// dasselbe spaetestens nach 1000 ms von selbst nach. Wer einfach misst, misst also mit ~40 %
// Wahrscheinlichkeit den TAKT und haelt ihn fuer den Nachzug. Der Takt rendert nur bei
// document.visibilityState !== 'hidden'; der Nachzug fragt das nicht. Genau daran wird er
// getrennt gemessen - und V3 belegt vorher, dass der Takt wirklich still liegt (geleerte Liste
// bleibt ueber 1,8 s leer). Die Liste darf dafuer geleert werden, ohne den Schreib-Deckel
// auszuhebeln: setBoxHtml schreibt bei childElementCount===0 auch bei gleicher Signatur.
//
// GEGENPROBEN (Spieldatei per KEPLER_SPIELDATEI umlenken, Liste per KEPLER_STATUSTAFEL_GEGENPROBE)
//   =alt        der Grundstand v8.727.0
//   =sabRiegel  der Riegel in render() ist zurueckgenommen (die Tafel rechnet wieder immer)
//   =sabSofort  openFpPanel() ruft render() nicht mehr (aufgeklappt bleibt sie bis zum Takt leer)
//   =sabNachzug der entprellte resize-Nachzug rendert nicht mehr
//   =sabKnopf   der Randknopf haengt wieder an openFpPanel statt am Umschalter
//   =sabZindex  die CSS-Zeile, die den Knopf ueber die offene Tafel hebt, fehlt
//   =sabMarge   die Sicherheitsmarge aus UI-7 ist zurueck (Knopf wieder bei 211 statt 206)
//   =sabAria    aria-expanded/aria-controls sind weg (Markup und beide setAttribute-Stellen)
//   =sabEscape  der keydown-Lauscher der Tafel fehlt ganz
//   =sabDurchfall der Lauscher haelt Escape nicht an (stopImmediatePropagation entfernt)
//   =sabVorrang der Lauscher greift zu frueh und auch bei zugeklappter Tafel (capture-Phase)
//   =sabVerdrahtung die dokumentweite Verdrahtung faellt wieder hinter den Sichtbarkeits-Riegel
//   =sabStreifen die Tafel steht wieder mittig ueber die volle Breite und reicht unter den Knopf
//               GEMESSEN 13.09.2026: Diese Sabotage laesst DREI Pruefungen fallen (2c 2d 2f),
//               nicht nur die Ueberlappung. Der Grund ist die Ebene des Knopfs: Solange er auf
//               211 stand, ueberragte er die Tafel (210) auch dann noch, wenn sie unter ihn
//               reichte - nur 2f schlug an. Seit er auf 206 steht (ueber der Verdunklung 205,
//               UNTER jedem bildschirmfuellenden Fenster), begraebt ihn die Tafel in dieser
//               Lage, und 2c (treffbar) und 2d (klappt wieder zu) fallen mit.
//               DAS IST DER BELEG FUER DIE 206. Der frueher hier stehende Kommentar begruendete
//               die 211 als Marge, 'damit eine kuenftige Aenderung am Streifen den Knopf nicht
//               still begraebt'. Die Sorge war richtig, die Marge falsch: Sie uebersprang die
//               Ebene eines echten Fensters. Und STILL ist der Fall gar nicht - genau diese drei
//               Pruefungen schlagen an. Die Liste ist deshalb gewachsen, nicht passend gemacht.
//   =sabZustand der Nachzug raeumt den Offen-Zustand ueber der Schwelle nicht mehr ab
//   =sabSpaet   derselbe Escape-Lauscher, aber HINTER dem des aufgeklappten Systems registriert
//   =sabBlind   der Riegel statustafelObenauf() faellt weg - der Lauscher greift wieder blind
// Jede Sabotage entsteht aus der AKTUELLEN Spieldatei, jeder Anker wird vorher gezaehlt (genau
// eine Fundstelle, sonst Abbruch VOR dem Schreiben). Die MUSS_FALLEN-Listen sind GEMESSEN: erst
// leer gefahren, dann eingetragen, dann jeder Stand erneut, bis jeder Lauf Exit 0 lieferte.
// Eine Sabotage, die gruen bleibt, ist ein Befund ueber die Pruefung oder ueber die Sabotage -
// nie ein Grund, die Liste passend zu machen.
//
// WAS BEIM MESSEN DER LISTEN HERAUSKAM UND ERKLAERT GEHOERT
// --------------------------------------------------------
// * 1c BLEIBT AM ALTEN STAND GRUEN, und das ist richtig so: Dort baute jeder Takt die Tafel auf,
//   auch unsichtbar - sie stand beim Aufklappen also laengst gefuellt da. Die Pruefung ist erst
//   MIT dem Riegel eine Aussage; sie bewacht die Luecke, die der Riegel aufgemacht hat
//   (belegt durch sabSofort, wo genau sie faellt).
// * 1e FAELLT AM ALTEN STAND MIT. Den Nachzug gab es dort nicht, und der Takt liegt fuer diese
//   Messung still - der alte Stand kommt also mit leerer Tafel aus dem Groessenwechsel.
// * sabZindex BRACHTE FRUEHER AUCH 2d ZU FALL, HEUTE NICHT MEHR - und der Grund gehoert
//   aufgeschrieben, statt die Liste passend zu machen. Damals lag die Tafel unter dem Knopf: Der
//   zweite Tipp landete mit begrabenem Knopf auf der TAFEL, die keinen Schliess-Handler hat, und
//   2d fiel mit. Seit 2f haelt sich die Tafel aus dem Streifen des Knopfs heraus; derselbe Tipp
//   landet jetzt auf der VERDUNKLUNG, und die schliesst die Tafel (Bestandsweg, siehe 2e).
//   GEMESSEN am 13.09.2026: elementFromPoint auf der Knopfmitte lieferte „fpBackdrop", die Tafel
//   ging zu, 2d blieb gruen. 2d misst damit nur noch die Umschalter-LOGIK; die Erreichbarkeit
//   des Knopfes gehoert allein 2c - und die faellt. Der Stand bleibt rot, nur an einer Stelle
//   weniger. sabAria bringt 2b und 2d mit, weil die Ansage des Knopfes Teil beider Pruefungen ist.
// * sabDurchfall bringt NUR 3d zu Fall, nicht 3a: Ohne stopImmediatePropagation schliesst Escape
//   die Tafel weiterhin - es schliesst nur das System gleich mit. Genau diese Trennung ist der
//   Grund, warum 3a und 3d zwei Pruefungen sind und nicht eine.
// * 3b, 3c und 3e koennen durch keine der acht ersten Sabotagen fallen - sie halten fest, was
//   sich NICHT aendern darf, und ein Waechter, der nie fallen kann, ist keiner. Deshalb gibt es
//   sabVorrang: einen Lauscher, der zu frueh greift und Escape auch bei zugeklappter Tafel
//   verschluckt (capture-Phase). Dort fallen genau diese drei - der Beleg, dass sie nicht blind
//   sind. 1d und 2e bleiben an jedem Stand gruen; sie bewachen den PC-Fall und den alten
//   x-Ausgang, und keine dieser Aenderungen fasst sie an.
// * sabVorrang bringt seit dem 13.09.2026 auch 3g mit, und das ist richtig so: Ein Lauscher, der
//   Escape auch bei zugeklappter Tafel anhaelt, verschluckt ihn genau dort, wo die Tafel ueber
//   der Schwelle gerade abgeraeumt wurde - das System bleibt offen.
// * 1f BLEIBT AM ALTEN STAND GRUEN, und das ist der Punkt: Dort war die Verdrahtung schon
//   dokumentweit. Die Pruefung bewacht keinen Zugewinn, sondern die Voraussetzung, die der
//   Riegel aus Zusage A beinahe kassiert haette - belegt durch sabVerdrahtung, wo genau sie
//   faellt. 3g bleibt am alten Stand ebenfalls gruen: Ohne Escape-Lauscher an der Tafel ging
//   Escape dort ohnehin ans System; was fehlte, war der Ausgang (3f).
// * 3h UND 3i AENDERN DREI BESTEHENDE LISTEN, und jede Aenderung ist ein Befund, kein Anpassen:
//   - alt und sabEscape bekommen 3i dazu. Beide Staende haben keinen Escape-Lauscher an der
//     Tafel (alt kannte ihn noch nicht, sabEscape nimmt ihn weg). 3h bleibt dort GRUEN - ohne
//     Lauscher nimmt die Tafel der Wiedergabe nichts weg -, aber die Tafel hat dann ueberhaupt
//     keinen Tastenausgang mehr, und genau das misst 3i. Das ist der Zugewinn aus UI-7/C,
//     jetzt zum ersten Mal belegt.
//   - sabVorrang bekommt 3h dazu: Ein Lauscher in der capture-Phase, der Escape immer anhaelt,
//     verschluckt ihn auch vor der Wiedergabe.
//   - sabZustand VERLIERT 3g, und das ist die interessanteste Messung. Die Sabotage laesst den
//     Offen-Zustand ueber der Schwelle stehen; frueher fiel damit beides - das Fenster ohne
//     Ausgang (3f) UND die dafuer verbrauchte Taste (3g). Die zweite Haelfte heilt jetzt die
//     allgemeine Messung: GEMESSEN am 13.09.2026 auf 1400x900 liegt ueber der Tafel dort ihre
//     eigene Verdunklung (elementFromPoint in der Bildmitte lieferte „fpBackdrop"; die Tafel
//     traegt ihre 210 nur unterhalb der Schwelle, darueber steht sie bei 50). Die Tafel ist also
//     gemessen NICHT obenauf, der Lauscher laesst die Taste durch, und das System bekommt sie.
//     3f faellt weiter - das Fenster ohne Ausgang ist der eigentliche Schaden und bleibt
//     bewacht. 3g bleibt trotzdem falsifizierbar: sabVorrang bringt es weiterhin zu Fall.
// * sabBlind ist die Sabotage ZU 3h: genau die eine Zeile `if (!statustafelObenauf()) return;`
//   faellt weg, der Lauscher greift wieder blind. Gemessen faellt dort 3h und sonst nichts -
//   3i bleibt gruen, weil die Tafel beim ersten Tastendruck ja zugeht (nur eben die falsche).
// * sabSpaet aendert NUR die Reihenfolge - derselbe Lauscher, hinter dem des aufgeklappten
//   Systems registriert. Es faellt genau 3d: Escape schliesst dann die Tafel UND das System auf
//   einmal. Das ist die Pruefung, mit der die Reihenfolge-Zusage im Kommentar der Spieldatei
//   belegt ist; die frueher dort behauptete Reihenfolge gegenueber Verbandsruf und Kartenmenue
//   steht nicht mehr drin, weil jene Lage gemessen nicht erreichbar ist (Begruendung samt
//   Messung am Lauscher in weltraum_kolonie.html).
const { starteBrowser, SPIEL_URL, ruhigeUhren, versionAbfangen, warteBis } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_STATUSTAFEL_GEGENPROBE || '';
// GEMESSEN am 13.09.2026 - siehe Kopf. Was NICHT faellt, ist so wichtig wie was faellt: 1d und 2e
// halten fest, was sich NICHT aendern darf, und bleiben an jedem Stand gruen.
const MUSS_FALLEN = {
  alt:          ['1a', '1b', '1e', '2a', '2b', '2c', '2d', '2f', '3a', '3d', '3f', '3i'],
  sabRiegel:    ['1a', '1b'],
  sabSofort:    ['1c'],
  sabNachzug:   ['1e'],
  sabKnopf:     ['2d'],
  sabZindex:    ['2c'],
  sabMarge:     ['2g'],
  sabAria:      ['2a', '2b', '2d'],
  sabEscape:    ['3a', '3d', '3i'],
  sabDurchfall: ['3d'],
  sabVorrang:   ['3b', '3c', '3e', '3g', '3h'],
  sabVerdrahtung: ['1f'],
  sabStreifen:  ['2c', '2d', '2f'],
  sabZustand:   ['3f'],
  sabSpaet:     ['3d'],
  sabBlind:     ['3h']
};

// 12 Kolonien mit je 6 Missionen + 24 eigene = 96 Missionszeilen, dazu der angeschlossene
// Allianz-Verband weiter unten = 97 (gemessen). Die Bauarten sind gemischt, damit die Schleife im
// Tafel-Block wirklich alle Zweige durchlaeuft.
const PLANETEN = ['vesna','rhea','aion','kaska','draconis','thessa','nyxar','oberon','zeta','echo9','helion','nocta'];
function missionen(heimat, anzahl, now){
  const out = [];
  for (let i = 0; i < anzahl; i++){
    const basis = { id: heimat+'-m'+i, startTime: now-60000, endTime: now+600000+i*1000, fleetName: 'Verband '+i };
    const t = i % 5;
    if (t === 0) out.push(Object.assign({}, basis, { type:'expedition', escortPower:1200+i, escortComposition:{ jaeger:20, bomber:4 } }));
    else if (t === 1) out.push(Object.assign({}, basis, { type:'attack', targetId:'npc'+i, composition:{ jaeger:40, bomber:8 } }));
    else if (t === 2) out.push(Object.assign({}, basis, { type:'relocate', groupId:'g'+heimat+i, shipKey:'jaeger', qty:25, targetId:'rhea' }));
    else if (t === 3) out.push(Object.assign({}, basis, { type:'attack-player', targetName:'Gegner'+i, targetPlanet:'vesna', composition:{ jaeger:60 } }));
    else out.push(Object.assign({}, basis, { type:'explore', targetId:'aion', composition:{ jaeger:12 } }));
  }
  return out;
}
// ruhigeUhren() steht VORNE im Literal (lib/umgebung begruendet, warum): alles danach gewinnt.
function schwererStand(){
  const now = Date.now();
  const colonies = {};
  for (const p of PLANETEN){
    colonies[p] = { buildings:{ solar:18, mine:16, kristallmine:14, labor:10, lager:14, werft:10, turm:6 },
                    resources:{ energie:5e4, erz:5e4, kristalle:3e4, deuterium:2e4 },
                    fleet:{ jaeger:400, bomber:60, frachter:40, missions: missionen(p, 6, now) } };
  }
  return JSON.stringify({
    ...ruhigeUhren(),
    tutorialSeen:true, newbieWelcomeSeen:true, updateNoticeSeen:true,
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:2e4, forschungspunkte:3e4 },
    buildings:{ solar:24, mine:22, kristallmine:20, labor:16, lager:18, werft:16, turm:10 },
    research:{ rkampf:10, rsolar:10, rerz:9 },
    fleet:{ jaeger:2000, bomber:400, frachter:200, missions: missionen('home', 24, now) },
    colonies, activeBasePlanet:'home', player:{ id:'u', name:'A', avatarKey:null },
    discovered: PLANETEN.reduce((a,p) => (a[p] = true, a), {}),
    battleStats:{ wins:120, losses:14 }, xp:2600000, credits:1800000, buffs:[], lastTick:now,
    colonyNames:{}, modules:{}, shipModules:{}, equippedShipModules:{},
    /* Der angeschlossene Verband ist der Grund, warum es ueberhaupt eine Zeile mit
       data-fp-vziel gibt - und er steht in ZWEI Listen: in der Statustafel und in der
       Missionsliste des Flotte-Reiters (allianzVerbandEintraege, EINE Quelle fuer beide).
       `zielOrt` ist Pflicht, sonst laesst verbandKlickAttr() das Klickziel weg; `musterAttackId`
       zeigt bewusst ins Leere, damit musterBeitragZielText() den mitgeschriebenen `zielText`
       nimmt statt ein Verbandsdokument zu brauchen. */
    allianceMusterContribution:{ composition:{ jaeger:10 }, power:500, originPlanet:'home',
      joinedAt:now, musterAttackId:'mx', zielText:'Festung im Vega-System',
      zielOrt:{ system:'vega', selektor:'[data-map-festung]', ebene:null } }
  });
}

function backend(store, berichte){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    /* Berichte NUR, wenn der Aufrufer welche mitgibt: Ohne diesen Zweig antwortet der Sammel-
       Zweig weiter unten mit [] - genau wie bisher. Jede Seite, die keine Berichte anfordert,
       sieht damit unveraendert dieselbe Antwort wie vor dem 13.09.2026. */
    if (p === 'reports' && berichte) return j({ reports: berichte });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'leaderboard') return j(Array.from({ length:20 }, (_, i) => ({ id:'p'+i, name:'Spieler'+i, score:100000-i*137, lastSeen:Date.now() })));
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

/* EIN Kampfbericht, aus dem die Wiedergabe wirklich ein Gefecht bauen kann. openBattleReplay()
   macht das Fenster sonst sofort wieder zu und meldet „Zu diesem Bericht gibt es kein Gefecht zum
   Zuschauen." - die Lage aus 3h waere dann gar nicht hergestellt, und die Pruefung waere gruen,
   ohne etwas zu belegen. Deshalb misst V13 ausdruecklich nach, dass beide Fenster offen sind. */
const UEBERFALL = { id:'r1', time:Date.now(), ts:Date.now(), type:'raid', result:'win',
  faction:'Söldnerkonvoi', attackPower:41200, defensePower:23400, targetPlanet:'home',
  fleet:{ destroyers:179 }, destroyedShips:{ destroyers:31 },
  stationedFleet:{ jaeger:152, destroyers:2418, schlachtschiff:7234 }, ownLostShips:{},
  defenseBefore:{ flak:55, turm:50, laser:45 } };

const OVERLAYS = ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
                  'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'];
const fehlerAlle = [];

async function seite(browser, breite, hoehe, berichte){
  const ctx = await browser.newContext({ viewport:{ width:breite, height:hoehe } });
  const page = await ctx.newPage();
  page.on('pageerror', e => fehlerAlle.push(breite + 'px: ' + String(e)));
  await versionAbfangen(page);
  await page.route('**/api/**', backend({ 'kepler7-save-v3': schwererStand() }, berichte));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3000);
  await page.evaluate(ids => ids.forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }), OVERLAYS);
  await page.waitForTimeout(600);
  return { ctx, page };
}

/* Alles, was ueber die Tafel gemessen wird, an EINER Stelle. „display" ist der GERECHNETE Wert -
   die Media-Regel ist die einzige Wahrheit ueber die Sichtbarkeit. */
const TAFEL = () => {
  const p = document.getElementById('fleetPositionPanel');
  const b = document.getElementById('fpBackdrop');
  const t = document.getElementById('fpToggleBtn');
  const spende = document.getElementById('fpAllianceDonationBox');
  const beste = document.getElementById('fpLeaderboard');
  return {
    display: p ? getComputedStyle(p).display : null,
    offen: !!(p && p.classList.contains('fp-mobile-open')),
    verdunklung: !!(b && b.classList.contains('show')),
    ariaExpanded: t ? t.getAttribute('aria-expanded') : null,
    ariaControls: t ? t.getAttribute('aria-controls') : null,
    zeilen: document.querySelectorAll('#fleetPositionList .fleet-position-item').length,
    spendeLaenge: spende ? (spende.textContent || '').trim().length : null,
    bestenlisteLaenge: beste ? (beste.textContent || '').trim().length : null
  };
};
const tafel = page => page.evaluate(TAFEL);
// Der Zurueck-Knopf der Karte ist der Beleg dafuer, dass die Systemebene aufgeklappt ist.
const systemOffen = page => page.evaluate(() => {
  const b = document.getElementById('galaxyBackBtn');
  return !!b && b.style.display !== 'none';
});
/* WER LIEGT AUF DER FLAECHE DER TAFEL OBENAUF? Gefragt wird in der Mitte des Teils der Tafel,
   der wirklich im Bild steht - nicht in der Bildmitte: Die Tafel ist ein Streifen und deckt die
   Bildmitte gar nicht ab. Keine Zahl aus dem CSS steht hier, kein z-index und keine Breite;
   gefragt wird der Browser. */
const lage = page => page.evaluate(() => {
  const p = document.getElementById('fleetPositionPanel');
  const ov = document.getElementById('battleModalOverlay');
  const r = p.getBoundingClientRect();
  const l = Math.max(r.left, 0), o = Math.max(r.top, 0);
  const re = Math.min(r.right, window.innerWidth), u = Math.min(r.bottom, window.innerHeight);
  const ob = (re > l && u > o) ? document.elementFromPoint((l + re) / 2, (o + u) / 2) : null;
  return {
    tafelOffen: p.classList.contains('fp-mobile-open'),
    tafelDisplay: getComputedStyle(p).display,
    wiedergabeOffen: ov.classList.contains('open'),
    obenauf: ob ? (ov.contains(ob) || ob === ov ? 'wiedergabe'
                 : (p.contains(ob) || ob === p ? 'tafel' : (ob.id || ob.tagName))) : null
  };
});
const knopfMitte = page => page.evaluate(() => {
  const b = document.getElementById('fpToggleBtn'); const r = b.getBoundingClientRect();
  return { x: r.left + r.width/2, y: r.top + r.height/2, breite: Math.round(r.width), hoehe: Math.round(r.height) };
});

(async () => {
  const browser = await starteBrowser();

  // ===== A: unsichtbar heisst gar nicht erst rechnen ==============================================
  {
    const { ctx, page } = await seite(browser, 1400, 900);
    const breit = await tafel(page);
    merke('V1: Vorbedingung - der schwere Spielstand fuellt die Tafel ueberhaupt (sonst waere 1a trivial)',
      breit.zeilen > 50 && breit.spendeLaenge > 0, breit);
    merke('V2: Vorbedingung - bei 1400 px ist die Tafel nach GERECHNETEM display sichtbar',
      breit.display === 'block', { display: breit.display });
    merke('1d: ab der Schwelle bleibt alles wie bisher - Tafel sichtbar und jeden Takt gefuellt',
      breit.display === 'block' && breit.zeilen > 50 && breit.spendeLaenge > 0, breit);
    await ctx.close();
  }
  {
    const { ctx, page } = await seite(browser, 390, 844);
    // Mehrere Takte abwarten: waere der Riegel wirkungslos, stuende die Liste laengst voll.
    await page.waitForTimeout(3200);
    const zu = await tafel(page);
    merke('V3: Vorbedingung - bei 390 px ist die Tafel nach GERECHNETEM display ausgeblendet',
      zu.display === 'none', { display: zu.display });
    merke('1a: unsichtbar wird die Missionsliste gar nicht erst gebaut (0 Zeilen nach mehreren Takten)',
      zu.zeilen === 0, zu);
    merke('1b: auch der zweite Zeichner hinter dem Riegel schweigt - der Spenden-Kasten bleibt leer',
      zu.spendeLaenge === 0, { spendeLaenge: zu.spendeLaenge, bestenlisteLaenge: zu.bestenlisteLaenge });

    /* Uhr anhalten, dann Klick UND Ablesen in EINEM evaluate-Aufruf: zwischen beidem kann kein
       Takt liegen. Ohne den render()-Aufruf in openFpPanel stuende die Tafel hier leer da. */
    await page.evaluate(() => { const t0 = Date.now(); Date.now = () => t0; });
    await page.waitForTimeout(1200);
    const sofort = await page.evaluate(() => {
      document.getElementById('fpToggleBtn').click();
      const p = document.getElementById('fleetPositionPanel');
      return { display: getComputedStyle(p).display,
               zeilen: document.querySelectorAll('#fleetPositionList .fleet-position-item').length,
               spendeLaenge: (document.getElementById('fpAllianceDonationBox').textContent || '').trim().length };
    });
    merke('1c: aufgeklappt steht die Tafel SOFORT gefuellt da - ohne einen Takt dazwischen',
      sofort.display === 'block' && sofort.zeilen > 50 && sofort.spendeLaenge > 0, sofort);
    await ctx.close();
  }
  {
    /* Der Nachzug beim Ueberschreiten der Schwelle - gemessen OHNE den Sekunden-Takt, der
       dasselbe Ergebnis sonst innerhalb einer Sekunde von selbst herstellt (siehe Kopf). */
    const { ctx, page } = await seite(browser, 1400, 900);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); });
    await page.evaluate(() => { document.getElementById('fleetPositionList').innerHTML = ''; });
    await page.waitForTimeout(1800);
    const nachWisch = await tafel(page);
    merke('V4: Vorbedingung - der Sekunden-Takt liegt still, was jetzt noch rendert ist der Nachzug',
      nachWisch.zeilen === 0, { zeilen: nachWisch.zeilen });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    const schmal = await tafel(page);
    merke('V5: Vorbedingung - schmal und zugeklappt rendert der Nachzug NICHT (die Tafel ist unsichtbar)',
      schmal.display === 'none' && schmal.zeilen === 0, schmal);
    await page.setViewportSize({ width: 1400, height: 900 });
    const gefuellt = await warteBis(async () => {
      const z = await page.evaluate(() => document.querySelectorAll('#fleetPositionList .fleet-position-item').length);
      return z > 50 ? z : 0;
    }, 900, 60);
    merke('1e: ueber die Schwelle vergroessert steht die Tafel gefuellt da statt leer (entprellter Nachzug)',
      gefuellt > 50, { zeilen: gefuellt || 0 });
    await ctx.close();
  }

  {
    /* DIE VERDRAHTUNG, DIE NICHT DER TAFEL GEHOERT. `[data-fp-vziel]` wird bewusst dokumentweit
       verdrahtet: Dieselbe Zeile steht in der Missionsliste des Flotte-Reiters, und die haengt
       hinter einem Tab-Riegel. Gemessen wird deshalb bei 390 px mit ZUGEKLAPPTER Tafel - der
       Normalzustand am Handy, und genau die Lage, in der ein Riegel um den Tafel-Block sie
       mitfangen wuerde. */
    const { ctx, page } = await seite(browser, 390, 844);
    await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="flotte"]'); if (b) b.click(); });
    await page.waitForTimeout(2400);
    const vor = await page.evaluate(() => {
      const alle = Array.from(document.querySelectorAll('[data-fp-vziel]'));
      const aussen = alle.filter(el => !el.closest('#fleetPositionPanel'));
      const p = document.getElementById('fleetPositionPanel');
      return { gesamt: alle.length, aussen: aussen.length,
               inMissionsActive: aussen.filter(el => el.closest('#missionsActive')).length,
               mitHandler: aussen.filter(el => typeof el.onclick === 'function').length,
               titel: aussen.length ? (aussen[0].getAttribute('title') || '').slice(-40) : null,
               tafelDisplay: getComputedStyle(p).display };
    });
    merke('V10: Vorbedingung - eine Verbandszeile im Flotte-Reiter, Tafel dabei zugeklappt',
      vor.aussen === 1 && vor.inMissionsActive === 1 && vor.tafelDisplay === 'none', vor);
    /* Nicht nur „traegt einen Handler": der Tipp muss WIRKEN. zeigeVerbandsziel schaltet auf die
       Karte und klappt das Zielsystem auf - der Zurueck-Knopf der Karte ist der Beleg dafuer. */
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('[data-fp-vziel]')).find(x => !x.closest('#fleetPositionPanel'));
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:r.left+4, clientY:r.top+4 }));
    });
    await page.waitForTimeout(1200);
    const danach = await page.evaluate(() => {
      const zurueck = document.getElementById('galaxyBackBtn');
      const karte = document.getElementById('tab-karte');
      return { karteSichtbar: !!karte && getComputedStyle(karte).display !== 'none',
               systemOffen: !!zurueck && zurueck.style.display !== 'none' };
    });
    merke('1f: bei zugeklappter Tafel ist die Verbandszeile im Flotte-Reiter verdrahtet UND der Tipp wirkt',
      vor.mitHandler === 1 && danach.karteSichtbar === true && danach.systemOffen === true,
      { mitHandler: vor.mitHandler, danach });
    await ctx.close();
  }

  // ===== B: der Randknopf ist ein Umschalter - und er wird getroffen ==============================
  {
    const { ctx, page } = await seite(browser, 390, 844);
    const zu = await tafel(page);
    merke('2a: zugeklappt meldet der Knopf aria-expanded="false" und zeigt per aria-controls auf die Tafel',
      zu.ariaExpanded === 'false' && zu.ariaControls === 'fleetPositionPanel',
      { ariaExpanded: zu.ariaExpanded, ariaControls: zu.ariaControls });

    const mitte = await knopfMitte(page);
    await page.mouse.click(mitte.x, mitte.y);
    await page.waitForTimeout(400);
    const auf = await tafel(page);
    merke('2b: ein ECHTER Maustipp auf den Knopf klappt die Tafel auf',
      auf.offen === true && auf.display === 'block' && auf.verdunklung === true && auf.ariaExpanded === 'true',
      { mitte, auf });

    const treffer = await page.evaluate(() => {
      const b = document.getElementById('fpToggleBtn'); const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      return { getroffen: el ? (el.id || el.className || el.tagName) : null,
               istKnopf: !!(el && (el === b || b.contains(el))),
               zKnopf: getComputedStyle(b).zIndex,
               zTafel: getComputedStyle(document.getElementById('fleetPositionPanel')).zIndex,
               zVerdunklung: getComputedStyle(document.getElementById('fpBackdrop')).zIndex };
    });
    merke('2c: bei offener Tafel liegt der Knopf oben - elementFromPoint auf seiner Mitte trifft ihn',
      treffer.istKnopf === true, treffer);

    await page.mouse.click(mitte.x, mitte.y);
    await page.waitForTimeout(400);
    const wiederZu = await tafel(page);
    merke('2d: derselbe Knopf klappt die Tafel auch wieder zu (Verdunklung und aria ziehen mit)',
      wiederZu.offen === false && wiederZu.verdunklung === false && wiederZu.ariaExpanded === 'false', wiederZu);

    // Der Bestandsweg darf durch den Umschalter nicht verloren gehen.
    await page.mouse.click(mitte.x, mitte.y);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('fpCloseBtn').click());
    await page.waitForTimeout(300);
    const nachX = await tafel(page);
    merke('2e: das x schliesst die Tafel weiterhin (Bestandsweg unveraendert)',
      nachX.offen === false && nachX.verdunklung === false, nachX);
    await ctx.close();
  }

  {
    /* TREFFBAR HEISST NICHT „OBENAUF": Ein Knopf, der die Tafel ueberdeckt, nimmt ihr die Zeilen
       darunter. 2c misst, dass der Knopf getroffen wird; DIESE Pruefung misst, dass er dafuer
       nichts verdeckt. Gemessen an sechs Breiten unterhalb der Schwelle - eine einzelne Breite
       waere die halbe Wahrheit, die Ueberlappung war gemessen breitenabhaengig (360 px 33,4 x
       37,7, 390 px 22,8 x 51,7, 430 px 2,8 x 64,7, darueber keine).
       EIN Kontext mit setViewportSize statt sechs Seitenaufbauten; nach jeder Aenderung eine
       gute Sekunde Ruhe, weil klappenFrei() die Klappe erst im naechsten Takt aus der
       Reiterleiste rueckt. */
    const { ctx, page } = await seite(browser, 360, 844);
    const gemessen = [];
    for (const b of [360, 390, 430, 700, 1000, 1219]){
      await page.setViewportSize({ width:b, height:844 });
      await page.waitForTimeout(1300);
      await page.evaluate(() => {
        const p = document.getElementById('fleetPositionPanel');
        if (!p.classList.contains('fp-mobile-open')) document.getElementById('fpToggleBtn').click();
      });
      await page.waitForTimeout(400);
      gemessen.push(await page.evaluate(w => {
        const knopf = document.getElementById('fpToggleBtn'), panel = document.getElementById('fleetPositionPanel');
        const k = knopf.getBoundingClientRect(), p = panel.getBoundingClientRect();
        const ox = Math.max(0, Math.min(k.right, p.right) - Math.max(k.left, p.left));
        const oy = Math.max(0, Math.min(k.bottom, p.bottom) - Math.max(k.top, p.top));
        return { breite:w, offen:panel.classList.contains('fp-mobile-open'),
                 knopfDisplay:getComputedStyle(knopf).display,
                 tafelBreite:+p.width.toFixed(1), ueberlapp:Math.round(ox*oy) };
      }, b));
    }
    merke('V11: Vorbedingung - an jeder gemessenen Breite steht die Tafel offen und der Knopf im Bild',
      gemessen.every(g => g.offen === true && g.knopfDisplay !== 'none' && g.tafelBreite > 0), gemessen);
    merke('2f: der Randknopf verdeckt die aufgeklappte Tafel an keiner Breite (Ueberlappung 0)',
      gemessen.every(g => g.ueberlapp === 0), gemessen.map(g => g.breite + 'px:' + g.ueberlapp));
    await ctx.close();
  }

  {
    /* UND DIE GEGENRICHTUNG: OBENAUF UEBER DER TAFEL HEISST NICHT OBENAUF UEBER ALLEM. 2c misst,
       dass der Knopf die Verdunklung seiner eigenen Tafel ueberragt. DIESE Pruefung misst, dass
       er dafuer kein FREMDES Fenster ueberragt - ein Randknopf, der ueber einem
       bildschirmfuellenden Fenster steht, bedient etwas, das der Spieler gar nicht sieht.
       GEMESSEN am 13.09.2026 auf 390x844 mit z-index 211 (der Sicherheitsmarge aus UI-7), Tafel
       offen und die Kampf-Wiedergabe darueber: elementFromPoint auf der Knopfmitte
       (371,6 | 759,2) lieferte „fpToggleBtn", der Knopf war sichtbar (display block, opacity 1),
       und ein echter Maustipp dorthin klappte die VERDECKTE Tafel zu (offen true -> false),
       waehrend die Wiedergabe offen stehenblieb. Mit 206 lieferte dieselbe Messung ein Element
       INNERHALB der Wiedergabe, und derselbe Tipp liess die Tafel offen.
       ZWEI HAELFTEN, WEIL EINE NICHT REICHT: Nur „elementFromPoint trifft ihn nicht" liesse
       Wege offen, auf denen der Knopf trotzdem bedient wird; nur „der Tipp tut nichts" liesse
       einen sichtbaren Knopf ueber dem Fenster stehen. Gemessen wird die LAGE, nicht die Zahl -
       in dieser Pruefung steht kein z-index. Die Lage wird ueber den Bestandsweg der Wiedergabe
       hergestellt (der Knopf [data-watch-battle] in den Berichten, wie in tests/test_wiedergabe_*.js);
       maybeAutoWatchBattle() stellt dieselbe Lage im Spiel per Zeitgeber her, ohne jeden Klick. */
    const { ctx, page } = await seite(browser, 390, 844, [UEBERFALL]);
    await page.evaluate(() => { const x = document.getElementById('headerReportsBtn'); if (x) x.click(); });
    await page.waitForTimeout(1600);
    await page.evaluate(() => document.getElementById('fpToggleBtn').click());
    await page.waitForTimeout(400);
    await page.evaluate(() => { const x = document.querySelector('[data-watch-battle]'); if (x) x.click(); });
    await page.waitForTimeout(1500);
    const amKnopf = await page.evaluate(() => {
      const b = document.getElementById('fpToggleBtn');
      const p = document.getElementById('fleetPositionPanel');
      const ov = document.getElementById('battleModalOverlay');
      const r = b.getBoundingClientRect(), o = ov.getBoundingClientRect();
      const x = r.left + r.width/2, y = r.top + r.height/2;
      const el = document.elementFromPoint(x, y);
      const cs = getComputedStyle(b);
      return { x:+x.toFixed(1), y:+y.toFixed(1),
               tafelOffen: p.classList.contains('fp-mobile-open'),
               tafelDisplay: getComputedStyle(p).display,
               wiedergabeOffen: ov.classList.contains('open'),
               knopfDisplay: cs.display,
               knopfImBild: r.width > 0 && r.height > 0,
               /* Deckt das Fenster die Knopfmitte ueberhaupt ab? Sonst waere die Pruefung
                  trivial gruen, ohne etwas zu belegen. */
               fensterDeckt: x >= o.left && x <= o.right && y >= o.top && y <= o.bottom,
               getroffen: el ? (el.id || el.className || el.tagName) : null,
               istKnopf: !!(el && (el === b || b.contains(el))),
               inWiedergabe: !!(el && (el === ov || ov.contains(el))) };
    });
    merke('V14: Vorbedingung - Tafel offen, Wiedergabe offen, Knopf im Bild und vom Fenster ueberdeckt',
      amKnopf.tafelOffen === true && amKnopf.tafelDisplay === 'block' && amKnopf.wiedergabeOffen === true
      && amKnopf.knopfDisplay !== 'none' && amKnopf.knopfImBild === true && amKnopf.fensterDeckt === true, amKnopf);
    await page.mouse.click(amKnopf.x, amKnopf.y);
    await page.waitForTimeout(600);
    const nachTipp = await page.evaluate(() => ({
      tafelOffen: document.getElementById('fleetPositionPanel').classList.contains('fp-mobile-open'),
      wiedergabeOffen: document.getElementById('battleModalOverlay').classList.contains('open') }));
    merke('2g: ueber einem bildschirmfuellenden Fenster liegt der Randknopf NICHT obenauf - und ein Tipp auf seine Mitte klappt die verdeckte Tafel nicht zu',
      amKnopf.istKnopf === false && amKnopf.inWiedergabe === true && nachTipp.tafelOffen === true,
      { amKnopf, nachTipp });
    await ctx.close();
  }

  // ===== C: Escape gehoert der Tafel - und nur ihr ================================================
  {
    const { ctx, page } = await seite(browser, 390, 844);
    await page.evaluate(() => document.getElementById('fpToggleBtn').click());
    await page.waitForTimeout(400);
    const vor = await tafel(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const nach = await tafel(page);
    merke('V6: Vorbedingung - die Tafel ist vor dem Tastendruck wirklich aufgeklappt',
      vor.offen === true && vor.display === 'block', vor);
    /* Bewusst OHNE aria in der Bedingung: 3a gehoert der Zusage C. Wer die Ansage des Knopfes
       mitpruefen will, liest 2a/2d - sonst faellt hier eine Pruefung aus fremdem Grund. */
    merke('3a: Escape schliesst die aufgeklappte Tafel samt Verdunklung',
      nach.offen === false && nach.verdunklung === false, { vor, nach });
    await ctx.close();
  }
  {
    /* ZUGEKLAPPTE Tafel: Escape muss unveraendert das tun, was es vorher tat. Ein Lauscher, der
       zu frueh greift, nimmt einem anderen Fenster den Ausgang - genau dieser Fehler ist in
       diesem Spiel schon einmal passiert. */
    const { ctx, page } = await seite(browser, 900, 1000);
    await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
    await page.waitForTimeout(1800);
    const sektorDa = await oeffneSystemUeberSektoren(page, 'vega');
    const sysVor = await systemOffen(page);
    const tafelZu = await tafel(page);
    merke('V7: Vorbedingung - die Systemebene steht offen und die Tafel ist zu',
      sektorDa === true && sysVor === true && tafelZu.offen === false, { sektorDa, sysVor, offen: tafelZu.offen });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    const sysNach = await systemOffen(page);
    merke('3b: bei ZUGEKLAPPTER Tafel schliesst Escape weiterhin das aufgeklappte System',
      sysNach === false, { sysVor, sysNach });

    // Das Kartenmenue liegt UEBER der Tafel und behaelt Escape fuer sich.
    const wieder = await oeffneSystemUeberSektoren(page, 'vega');
    await page.evaluate(() => {
      const n = document.querySelector('#galaxyMapSvg [data-planet],#galaxyMapSvg [data-map-npc],#galaxyMapSvg [data-map-asteroid]');
      if (!n) return;
      const r = n.getBoundingClientRect();
      n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:r.left+r.width/2, clientY:r.top+r.height/2 }));
    });
    await page.waitForTimeout(600);
    const menueVor = await page.evaluate(() => !!document.querySelector('.kmenu'));
    const sysVor2 = await systemOffen(page);
    merke('V8: Vorbedingung - das Kartenmenue steht offen, das System darunter auch',
      wieder === true && menueVor === true && sysVor2 === true, { wieder, menueVor, sysVor2 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const menueNach = await page.evaluate(() => !!document.querySelector('.kmenu'));
    const sysNach2 = await systemOffen(page);
    merke('3c: das Kartenmenue behaelt Escape - es geht zu, das System darunter bleibt offen',
      menueNach === false && sysNach2 === true, { menueVor, menueNach, sysVor2, sysNach2 });
    await ctx.close();
  }
  {
    // Tafel AUF ueber einem offenen System: der erste Tastendruck darf NUR die Tafel treffen.
    const { ctx, page } = await seite(browser, 900, 1000);
    await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
    await page.waitForTimeout(1800);
    const sektorDa = await oeffneSystemUeberSektoren(page, 'vega');
    await page.evaluate(() => document.getElementById('fpToggleBtn').click());
    await page.waitForTimeout(400);
    const tafelVor = await tafel(page), sysVor = await systemOffen(page);
    merke('V9: Vorbedingung - Tafel aufgeklappt UEBER einem offenen System',
      sektorDa === true && tafelVor.offen === true && sysVor === true, { sektorDa, offen: tafelVor.offen, sysVor });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const tafelNach = await tafel(page), sysNach = await systemOffen(page);
    merke('3d: das erste Escape schliesst NUR die Tafel - das System darunter bleibt offen',
      tafelNach.offen === false && sysNach === true, { tafelNach, sysNach });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const sysNach2 = await systemOffen(page);
    merke('3e: das zweite Escape schliesst dann das System - der Ausgang faellt nicht weg',
      sysNach2 === false, { sysNach2 });
    await ctx.close();
  }

  {
    /* UEBER DIE SCHWELLE MIT AUFGEKLAPPTER TAFEL. Ab 1220 px ist die Tafel eine feste
       Seitenspalte; ein stehengebliebener Offen-Zustand ist dort ein Fenster ohne Ausgang -
       Randknopf und x sind display:none, und die Verdunklung deckt das ganze Bild ab. Was bliebe,
       waere Escape - verbraucht fuer eine Klasse, die man nicht sieht. */
    const { ctx, page } = await seite(browser, 900, 1000);
    await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
    await page.waitForTimeout(1800);
    const sektorDa = await oeffneSystemUeberSektoren(page, 'vega');
    await page.evaluate(() => document.getElementById('fpToggleBtn').click());
    await page.waitForTimeout(400);
    const vor = await tafel(page), sysVor = await systemOffen(page);
    merke('V12: Vorbedingung - Tafel aufgeklappt unterhalb der Schwelle, das System darunter offen',
      sektorDa === true && vor.offen === true && vor.verdunklung === true && sysVor === true,
      { sektorDa, offen: vor.offen, verdunklung: vor.verdunklung, sysVor });
    await page.setViewportSize({ width:1400, height:900 });
    await page.waitForTimeout(900);
    /* Nach oben rollen, BEVOR ein Reiter als Messpunkt dient: Die Seite stand hier gemessen bei
       scrollY 735, die Reiterleiste damit bei top -216,6 - ausserhalb des Bildes, und
       elementFromPoint lieferte null. Ein Messpunkt ausserhalb des Fensters beantwortet die
       Frage „ist der Reiter wieder erreichbar" nicht, er beantwortet gar keine. */
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const nach = await page.evaluate(() => {
      const p = document.getElementById('fleetPositionPanel');
      const reiter = document.querySelector('.tab-btn[data-tab="basis"]');
      const r = reiter.getBoundingClientRect();
      const auf = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      const mitte = document.elementFromPoint(window.innerWidth/2, window.innerHeight/2);
      return { offen: p.classList.contains('fp-mobile-open'),
               verdunklung: getComputedStyle(document.getElementById('fpBackdrop')).display,
               knopf: getComputedStyle(document.getElementById('fpToggleBtn')).display,
               x: getComputedStyle(document.getElementById('fpCloseBtn')).display,
               reiterErreichbar: !!(auf && (auf === reiter || reiter.contains(auf))),
               mitte: mitte ? (mitte.id || mitte.tagName) : null };
    });
    merke('3f: ueber der Schwelle bleibt kein Fenster ohne Ausgang stehen - Verdunklung weg, ein Reiter wieder erreichbar',
      nach.offen === false && nach.verdunklung === 'none' && nach.reiterErreichbar === true && nach.mitte !== 'fpBackdrop', nach);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const sysNach = await systemOffen(page);
    merke('3g: der erste Tastendruck danach erreicht das Fenster, das wirklich im Bild steht (das System)',
      sysNach === false, { sysVor, sysNach });
    await ctx.close();
  }

  {
    /* EIN FENSTER, DAS SICH OHNE KLICK OEFFNET (Durchsicht 13.09.2026). maybeAutoWatchBattle()
       schiebt die bildschirmfuellende Kampf-Wiedergabe per setTimeout 400 ms hinter einen
       eintreffenden Kampfbericht; state.autoWatchLiveRaid steht per Voreinstellung auf an. Der
       Zeitgeber ist dabei nur der ANLASS - die Bedingung ist die Lage „Tafel offen, Wiedergabe
       darueber". Sie wird hier ueber den Bestandsweg der Wiedergabe hergestellt (der Knopf
       [data-watch-battle] in den Berichten, wie in tests/test_wiedergabe_*.js), weil das
       dieselbe Funktion aufruft und ohne Wartezeit auskommt.
       GEMESSEN am 13.09.2026 auf 390x844 vor der Aenderung: beide z-index 210, elementFromPoint
       ueber der Tafel lieferte „osCv" (die Leinwand der Wiedergabe) - und der erste Escape
       schloss trotzdem die VERDECKTE Tafel; die sichtbare Wiedergabe brauchte einen zweiten. */
    const { ctx, page } = await seite(browser, 390, 844, [UEBERFALL]);
    await page.evaluate(() => { const x = document.getElementById('headerReportsBtn'); if (x) x.click(); });
    await page.waitForTimeout(1600);
    const knoepfe = await page.evaluate(() => document.querySelectorAll('[data-watch-battle]').length);
    await page.evaluate(() => document.getElementById('fpToggleBtn').click());
    await page.waitForTimeout(400);
    await page.evaluate(() => { const x = document.querySelector('[data-watch-battle]'); if (x) x.click(); });
    await page.waitForTimeout(1500);
    const vor = await lage(page);
    merke('V13: Vorbedingung - die Tafel steht offen UND die Wiedergabe liegt gemessen ueber ihr',
      knoepfe === 1 && vor.tafelOffen === true && vor.tafelDisplay === 'block'
      && vor.wiedergabeOffen === true && vor.obenauf === 'wiedergabe', { knoepfe, vor });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const e1 = await lage(page);
    merke('3h: der erste Tastendruck trifft das Fenster, das der Spieler SIEHT - die Wiedergabe geht zu, die Tafel bleibt offen',
      e1.wiedergabeOffen === false && e1.tafelOffen === true, { vor, e1 });
    /* Und die Tafel verliert ihren eigenen Ausgang dabei nicht: Sobald sie wieder obenauf liegt,
       gehoert die Taste ihr. Ohne diese zweite Haelfte waere „nicht anfassen" eine erlaubte
       Antwort auf 3h - und die Tafel haette Escape fuer immer verloren (belegt durch sabEscape,
       wo genau 3i faellt und 3h gruen bleibt). */
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const e2 = await lage(page);
    merke('3i: danach liegt die Tafel wieder obenauf - der zweite Tastendruck schliesst sie',
      e2.tafelOffen === false, { e1, e2 });
    await ctx.close();
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
  console.log('FAIL - Testlauf abgebrochen: ' + e.message);
  process.exit(1);
});
