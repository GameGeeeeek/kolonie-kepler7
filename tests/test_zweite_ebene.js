// Die zweite Ebene: klebende Statusleiste, Handy-Hoehe der fuenf Knopfzeilen, der aktive Knopf in
// einer wischbaren Zeile, unbekannte und leere Unterreiter-Schluessel (UI-5a, 12.09.2026).
//
// DIESER WAECHTER IST DIE ZUSAMMENFUEHRUNG VON ZWEIEN (12.09.2026). Neben ihm stand
// `test_unterreiter_ebene2.js` mit 15 Pruefungen, die dieselben drei Zusagen mit denselben Mitteln
// absicherten; `run.js` sammelt per readdirSync ein, also lief in jedem Prueflauf beides - gemessen
// je 42,5 s Browserzeit fuer dasselbe Ergebnis, und zwei Orte, die bei der naechsten Aenderung
// auseinanderlaufen. Was der geloeschte Waechter MEHR gemessen hat, ist hier hineingezogen:
//   * „die Leiste klebt UNTERHALB der Reiterleiste" als eigene Bedingung (jetzt in A3) - die reine
//     Ueberlappungs-Null liesse eine Leiste OBERHALB der Reiterleiste durchgehen.
//   * die Zeilenzahl ueber ALLE Kinder der Leiste statt nur ueber die Knoepfe mit Attribut (jetzt
//     `kinderZeilen` in B) - ein eingefuegtes Nicht-Knopf-Element bricht die Zeile genauso um.
//   * die C-Messung am HANDY (390 px) statt am PC - dort ist die Zeile wischbar, also der
//     interessantere Zustand.
// ERSATZLOS ENTFALLEN ist dreierlei, jedes mit Grund:
//   * seine eingetippte Liste `PANEL_IDS = ['fleetSubWerft', ...]`. Hier stehen die Panels als
//     Selektor auf das MARKUP (`#tab-flotte > div[id^="fleetSub"]`); eine getippte Liste veraltet
//     beim naechsten Panel.
//   * seine PC-Pruefung `stickyTop === 4` - eine getippte Zahl fuer genau die Groesse, um die es
//     hier geht. An ihre Stelle tritt in A6 die HERKUNFTS-Frage: der gerechnete `top` darf am PC
//     NICHT die gemessene Leistenhoehe sein (dieselbe Frage wie A7, nur andersherum).
//   * `isMobile:true` im Browser-Kontext. `hasTouch` allein genuegt: compact-head wird gemessen
//     (A1), nicht vorausgesetzt.
//
// WAS HIER ABGESICHERT WIRD - DIE ZUSAGEN
// ---------------------------------------
// A  Klebt die Reiterleiste (`body.compact-head .tabs`, position sticky, top 0), klebt jede
//    Statusleiste der zweiten Ebene DARUNTER, stoesst an sie an und bleibt sichtbar und antippbar.
//    Der Klebepunkt kommt aus der GEMESSENEN Leistenhoehe, nicht aus einer getippten Zahl.
// B  Am Handy (390 px) ist keine der fuenf Knopfzeilen der zweiten Ebene hoeher als zwei
//    Knopfzeilen, und kein Knopf ist unerreichbar. Am PC bleibt alles beim Umbruch.
// C  Ein Unterreiter-Schluessel, den es nicht (mehr) gibt, faellt auf den ERSTEN Knopf seiner
//    Zeile zurueck, statt alle Panels auszublenden.
// D  Ein Spielstand OHNE die vier Schluessel zeigt je genau ein Panel und den ersten Knopf aktiv.
//    Das ist der Pfad, an dem die frueheren `=== undefined`-Riegel hingen; sie sind entfallen,
//    und nur `unterreiterSchluessel()` haelt ihn seither.
// E  Der AKTIVE Knopf einer wischbaren Zeile liegt im sichtbaren Streifen, ohne dass der Spieler
//    wischen muss.
//
// SECHS FALLEN, DIE DIESE PRUEFUNG EINZELN ABFAENGT:
//
//   1. DIE SEITE MUSS LANG GENUG SEIN. Der Fehler von A tritt nur auf, wenn die zweite Leiste
//      ihren Klebepunkt ueberhaupt ERREICHT. Gemessen am 12.09.2026 bei 390x844: mit
//      `fleetSubTab:'flotte'` ist die Flotten-Seite 838 px scrollbar - die Leiste klebt nie, und
//      eine Pruefung an diesem Stand ist STILL GRUEN, egal wie kaputt das CSS ist. Mit
//      `fleetSubTab:'werft'` sind es rund 14900 px, und der Fehler tritt auf. A0 misst die
//      Scrollhoehe deshalb als eigene Pruefung und faellt, wenn sie zu kurz ist.
//
//   2. DIE STAPELNUMMER BEWEIST NICHTS. Die Statusleiste trug schon vorher z-index 30 gegen 25
//      der Reiterleiste und lag trotzdem dahinter: `.tab-panel.active` traegt
//      `animation: tabIn ... forwards` auf `transform` und ist damit dauerhaft ein eigener
//      STAPELKONTEXT - die 30 gelten nur INNERHALB des Panels. Gemessen wird deshalb, was der
//      Spieler sieht: die UEBERLAPPUNG der beiden Baender und `document.elementFromPoint` auf der
//      Mitte der Leiste, nicht `z-index`.
//
//   3. DIE ZUSAGE GILT FUER JEDE KLEBENDE LEISTE DER ZWEITEN EBENE, nicht nur fuer die eine der
//      Flotte - und ein nicht aktives Panel ist `display:none`, seine Kinder fallen aus jeder
//      Sammlung heraus. Wer nur den Flotten-Reiter aktiviert, misst deshalb IMMER nur
//      `#fleetStickyBar`, auch wenn sein Kommentar „alle klebenden Leisten" verspricht. A schleift
//      darum ueber ALLE dreizehn Hauptreiter, aktiviert jeden und summiert auf.
//      GEMESSEN, was das kostet und was es bringt: 25,1 s fuer die Schleife gegen 1,9 s fuer den
//      einen Reiter, und als Fund genau EIN klebendes Element im ganzen Spiel (`#fleetStickyBar`
//      in `#tab-flotte`) - die uebrigen zwoelf Reiter haben keines. Die 23 s Aufpreis sind der
//      Regressionswert: Eine zweite, spaeter eingebaute Leiste faellt von selbst auf. Bezahlt sind
//      sie ohnehin schon, weil der doppelte Waechter (42,9 s) dafuer weggefallen ist.
//
//   4. AM PC DARF SICH NICHTS GEAENDERT HABEN. Ohne `compact-head` (ab 1001 px) klebt die
//      Reiterleiste gar nicht (gemessen bei 1400 px: position=static), und die Statusleiste
//      gehoert dort weiter auf ihre 4 px. Wer den `body.compact-head`-Vorsatz der neuen Regel
//      vergisst, schiebt sie am PC grundlos nach unten - A6 misst genau das.
//
//   5. DIE ZEILENZAHL IST SCHRIFTUNABHAENGIGER ALS EINE PIXELHOEHE. B zaehlt die verschiedenen
//      Oberkanten der SICHTBAREN Knoepfe, nicht Pixel: Das bleibt aussagekraeftig, wenn eine
//      andere Schrift jede Zeile um ein paar Pixel aendert, und faellt, sobald eine Zeile
//      umbricht. Dazu die Gegenfrage, die eine einzeilige Leiste erst brauchbar macht: Ist der
//      Inhalt breiter als der Kasten, MUSS er wischbar sein - sonst ist die Zeile zwar niedrig,
//      aber die hinteren Knoepfe sind unerreichbar.
//
//   6. EINE PRUEFUNG UEBER EINER LEEREN MENGE IST TRIVIAL GRUEN. Sind alle Knoepfe einer Zeile
//      unsichtbar, ist die Zahl der Knopfzeilen 0, und „hoechstens zwei" trifft zu, ohne dass
//      irgendetwas gemessen waere. JEDE B-Pruefung - auch B0 - traegt deshalb denselben
//      Daseins-Riegel (`!fehlt && knoepfe > 0 && sichtbar > 0`), und A2/A3/A4 verlangen
//      ausdruecklich `leisten.length >= 1`.
//
// ERWARTUNGSWERTE SIND GEMESSEN, NICHT EINGETIPPT:
//   * Welche Schluessel eine Zeile kennt und welcher davon der ERSTE bzw. der LETZTE ist, liest
//     der Test aus dem MARKUP der geladenen Seite (die `data-*-subtab`-Attribute) - dieselbe
//     Quelle, aus der auch `unterreiterSchluessel()` seine Liste nimmt. Fuer E wird die Seite
//     dafuer zweimal geladen: einmal, um den letzten Schluessel je Zeile abzulesen, und einmal mit
//     genau diesem Schluessel im Spielstand.
//   * Die Hoehe der Reiterleiste wird gemessen und nicht angenommen (sie ist gemessen 94 px am PC
//     und 158/159 px am Handy und waechst mit jedem Reiter und jedem Banner darueber).
//   * Der erfundene Schluessel fuer C ist bewusst einer, den kein Build je tragen wird.
//
// GEGENPROBEN (KEPLER_ZWEITEEBENE_GEGENPROBE=<stand>, Spieldatei per KEPLER_SPIELDATEI umlenken):
//   =alt         der Ausgangsstand v8.723.0 unveraendert - dort faellt der Kern von A, C, D und E
//   =sabotageA   die Regel `body.compact-head .fleet-sticky { top: ... }` ersatzlos entfernt
//   =sabotageB   `.pillen-leiste` in der 700-px-Media-Regel auf flex-wrap:wrap / overflow-x:visible
//   =sabotageC   `unterreiterSchluessel` gibt den Wert ungeprueft zurueck (die Listenpruefung faellt weg)
//   =sabotageD   der `body.compact-head`-Vorsatz der neuen Regel entfernt - die PC-Gegenrichtung
//   =sabotageE   `unterreiterSchluessel` reicht einen LEEREN Wert durch - genau der Pfad, an dem
//                die beiden entfernten `=== undefined`-Riegel hingen
//   =sabotageF   der Klebepunkt als fest eingetragene 169px statt aus der gemessenen Variablen -
//                die Zahl, die HEUTE stimmt und beim naechsten Reiter falsch ist
//   =sabotageG   `aktivenKnopfZeigen` tut nichts mehr - der aktive Knopf bleibt ausserhalb
//   =sabotageH   alle Knoepfe der Galaxie-Zeile auf display:none - die leere Menge, gegen die der
//                Daseins-Riegel steht
// Die Sabotagen entstehen aus der AKTUELLEN Spieldatei, je Sabotage genau eine Fundstelle
// (Abbruch vor dem Schreiben, wenn die Zeichenkette nicht genau einmal vorkommt).
// Die MUSS_FALLEN-Listen sind GEMESSEN (erst laufen lassen, dann eingetragen), nicht geraten.
// Eine Sabotage, die gruen bleibt, ist ein Befund ueber die PRUEFUNG - nicht ueber die Sabotage.
const { starteBrowser, SPIEL_URL, ruhigeUhren, versionAbfangen } = require('./lib/umgebung');

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_ZWEITEEBENE_GEGENPROBE || '';
// GEMESSEN am 12.09.2026: erst mit leeren Listen gefahren, die roten Namen eingetragen, dann jeden
// Stand erneut gefahren, bis alle Exit 0 lieferten.
// WAS DABEI AUFFIEL UND HIER STEHEN BLEIBT - SECHS PRUEFUNGEN, DIE HEUTE NICHT FALLEN KOENNEN.
// Jede davon ist eine REGRESSIONSWACHE, keine Messung; wer sie fuer einen Beweis haelt, taeuscht
// sich, und deshalb steht hier je die gemessene Begruendung:
//   * A3 waere am Ausgangsstand mit der blossen „im Bild"-Frage gruen geblieben: Die Leiste lag
//     dort gemessen bei [4,54] und damit durchaus im Fenster - nur eben HINTER der Reiterleiste.
//     Erst die „unterhalb"-Frage aus dem zusammengefuehrten Waechter laesst sie am alten Stand
//     mitfallen (gemessen: sie faellt).
//   * B4 (Allianz) und B5 (Sektorkarte) koennen von KEINER der Sabotagen rot werden. Gemessen
//     gegen sabotageB (Media-Regel zurueck auf flex-wrap:wrap): beide Zeilen haben VIER Pillen,
//     die bei 390 px auf genau ZWEI Knopfzeilen umbrechen (gemessen 78 px, zeilen 2,
//     scrollWidth 348 = clientWidth 348) - und zwei Zeilen sind INNERHALB der Zusage. Nur B3
//     (sechs Pillen, gemessen 120 px auf DREI Zeilen) kann fallen.
//     B5 misst trotzdem seit dem 12.09.2026 auf der SYSTEMEBENE statt auf der Regionsuebersicht:
//     Dort sind alle vier Ebenen-Knoepfe sichtbar (gemessen 399 gegen 348 px) statt nur drei
//     (gemessen 348 gegen 348). Die Pruefung traegt damit wenigstens dieselbe LAGE wie B4 - dass
//     sie an derselben Zahl scheitert wie B4, ist eine Eigenschaft der Zusage, nicht des Tests.
//     Wer B5 und B4 scharf stellen will, muss die Zusage aendern („hoechstens EINE Knopfzeile"),
//     und das ist eine Vertragsfrage.
//   * E1/E2 (Flotte, Offiziere) koennen nicht fallen: Ihre drei Knoepfe passen bei 390 px in den
//     Kasten (gemessen scrollWidth 348 = clientWidth 348), die Zeile ist also gar nicht wischbar
//     und der aktive Knopf immer im Bild. Sie stehen als Wache fuer einen vierten Knopf; ihr Beleg
//     nennt `wischbar` ausdruecklich, damit niemand sie fuer eine Messung haelt, die sie nicht ist.
//   * D1/D2 fallen weder an `alt` noch an sabotageC/E: Die Flotten- und die Offiziers-Zeile lesen
//     `state.fleetSubTab || 'werft'`, reichen also nie einen leeren Wert weiter. Der Pfad, den D
//     wirklich misst, ist der von D3/D4 - dort standen die beiden entfernten Zeilen.
//
// WAS DIE GEGENPROBEN SONST NOCH BELEGEN:
//   * sabotageF (getippte 169px statt der Variablen) laesst A2, A3, A4 und A5 GLATT DURCH und
//     faellt allein an A7. Genau dafuer gibt es A7: Die 169 stimmt heute und ist beim naechsten
//     Reiter falsch.
//   * Der Daseins-Riegel in B0 ist gemessen TRAGEND, nicht dekorativ: Gegen sabotageH (alle
//     Galaxie-Knoepfe auf display:none, gemessen sichtbar 0, zeilen 0) faellt B0 mit Riegel und
//     bleibt OHNE ihn gruen - eigens gefahren, mit einer Fassung ohne Riegel.
const MUSS_FALLEN = {
  alt:       ['A2', 'A3', 'A4', 'A5', 'A7', 'B3', 'C1', 'C2', 'C3', 'C4'],
  sabotageA: ['A2', 'A3', 'A4', 'A5', 'A7'],
  sabotageB: ['B3'],
  sabotageC: ['C1', 'C2', 'C3', 'C4', 'D3', 'D4'],
  sabotageD: ['A6'],
  sabotageE: ['D3', 'D4'],
  sabotageF: ['A7'],
  sabotageG: ['E3', 'E4'],
  sabotageH: ['B0', 'B3', 'E3']
};

// Ein Schluessel, den keine der vier Knopfzeilen je tragen wird - der Bindestrich-Rahmen macht ihn
// beim Lesen eines Spielstands sofort als Test-Wert erkennbar.
const ERFUNDEN = 'erfunden-xyz-gibt-es-nicht';

// Die dreizehn Hauptreiter, aus dem Markup gelesene Reihenfolge. A schleift ueber alle (Falle 3).
const HAUPTREITER = ['basis','verteidigung','forschung','flotte','expedition','karte','galaxie',
                     'allianz','offiziere','markt','punkte','fortschritt','sammlung'];

// Die fuenf Knopfzeilen der zweiten Ebene, in drei Bauarten. `panels` ist der Selektor der
// Flaechen, die die Zeile umschaltet; die Sektorkarte ist eine MEHRFACHWAHL ohne Panels und ohne
// Rueckfall-Frage - sie zaehlt deshalb nur bei B mit.
// `system` heisst: Diese Zeile wird erst auf der SYSTEMEBENE der Karte vollstaendig gemessen.
// GEMESSEN am 12.09.2026 bei 390 px: Auf der Regionsuebersicht UND in der Sektoransicht sind von
// den vier Ebenen-Knoepfen nur DREI sichtbar - `buildGalaxyMap` blendet „Routen" aus, solange
// kein System offen ist (`kbSektorModus = !galaxyOpenSystem` deckt beide Sektor-Ansichten ab).
// Drei Pillen passen bei 390 px auch mit Umbruch in eine Zeile (gemessen scrollWidth 348 =
// clientWidth 348). Erst mit offenem System sind es vier sichtbare Knoepfe und 399 gegen 348 px;
// B5 misst dort also wenigstens die VOLLE Zeile statt einer um ein Viertel gekuerzten.
// Der im Befund vorgeschlagene Weg „Sektoransicht statt Regionsuebersicht" traegt ausdruecklich
// NICHT - das ist gemessen, nicht angenommen: `kbSektorModus` deckt BEIDE Sektor-Ansichten ab.
// UND B5 KANN AUCH SO NICHT FALLEN, gemessen gegen sabotageB: vier Pillen brechen bei 390 px auf
// genau zwei Knopfzeilen um, und zwei sind innerhalb der Zusage - dieselbe Grenze wie bei B4.
// Die vollstaendige Begruendung steht oben bei MUSS_FALLEN.
const ZEILEN = [
  { nr: 1, name: 'Flotte',      reiter: 'flotte',    leiste: '#fleetSubtabs',      attr: 'data-fleet-subtab',    aktiv: 'on',     zustand: 'fleetSubTab',    panels: '#tab-flotte > div[id^="fleetSub"]:not(#fleetSubtabs)' },
  { nr: 2, name: 'Offiziere',   reiter: 'offiziere', leiste: '#officerSubtabs',    attr: 'data-officer-subtab',  aktiv: 'on',     zustand: 'officerSubTab',  panels: '#tab-offiziere > div[id^="offSub"]' },
  { nr: 3, name: 'Galaxie',     reiter: 'galaxie',   leiste: '#galaxySubtabBar',   attr: 'data-galaxy-subtab',   aktiv: 'active', zustand: 'galaxySubTab',   panels: '.galaxy-subpanel[data-galaxy-sub]' },
  { nr: 4, name: 'Allianz',     reiter: 'allianz',   leiste: '#allianceSubtabBar', attr: 'data-alliance-subtab', aktiv: 'active', zustand: 'allianceSubTab', panels: '.alliance-subpanel[data-alliance-sub]' },
  { nr: 5, name: 'Sektorkarte', reiter: 'karte',     leiste: '#karteEbenenLeiste', attr: 'data-karte-ebene',     aktiv: 'active', zustand: null,             panels: null, system: true }
];

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0 });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

/* Der Spielstand ist bewusst reich: Eine arme Werft zeigt wenige Karten, und dann ist die
   Flotten-Seite zu kurz, als dass die Statusleiste ihren Klebepunkt erreichte (Falle 1). Der
   Spread von ruhigeUhren() steht VORNE, damit alles dahinter gewinnt (lib/umgebung.js).
   KEIN `fleetSubTab` und kein anderer Unterreiter-Schluessel im Grundstand - genau das ist der
   Spielstand, den D misst; wer einen braucht, reicht ihn als `extra` herein. */
function spielstand(extra){
  return JSON.stringify(Object.assign({
    ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
    seenTabHints:{ basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                   galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1, sammlung:1 },
    resources:{ energie:412000, erz:388000, kristalle:264000, deuterium:151000, antimaterie:19400, forschungspunkte:31200 },
    buildings:{ solar:20, mine:19, raffinerie:15, synth:13, labor:12, werft:12, hangar:8, lager:12 },
    research:{ rsolar:8, rerz:8, rkampf:7 }, fleet:{ jaeger:420, missions:[] },
    colonies:{}, activeBasePlanet:'home', shipMarks:{}, discovered:{ rhea:true, aion:true },
    player:{ id:'u', name:'A', allianceTag:'' }, battleStats:{ wins:5, losses:1 },
    xp:64000, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{}
  }, extra || {}));
}

const fehler = [];
async function seite(browser, breite, stand){
  const store = {}; store['kepler7-save-v3'] = stand;
  const ctx = await browser.newContext({ viewport:{ width:breite, height:844 }, hasTouch: breite <= 700 });
  const page = await ctx.newPage();
  page.on('pageerror', e => fehler.push(breite + 'px pageerror: ' + e));
  await versionAbfangen(page);
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
     'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
  });
  return { ctx, page };
}
async function reiter(page, tab){
  await page.evaluate(t => { const b = document.querySelector('.tab-btn[data-tab="' + t + '"]'); if (b) b.click(); }, tab);
  await page.waitForTimeout(1400);
}
/* Die Systemebene der Karte oeffnen. Der Klick geht auf ein `[data-sektor-sys]` der gezeichneten
   Sektoransicht - dieselbe Flaeche, die der Spieler antippt; `galaxyOeffne()` selbst ist nicht
   global und darf es auch nicht werden, nur damit ein Test sie ruft. Zurueckgemeldet wird, wie
   viele Flaechen gefunden wurden, damit ein Fehlschlag im Beleg steht statt still zu bleiben. */
async function systemOeffnen(page){
  // ZWEI Schritte, gemessen: Die Karte startet auf der Regionsuebersicht, dort tragen die
  // Flaechen `data-sektor` (gemessen 8 Stueck). Erst die SEKTORANSICHT zeichnet die einzelnen
  // Systeme als `data-sektor-sys` (gemessen 20). Ein Einschritt-Versuch fand null Systeme.
  const sektor = await page.evaluate(() => {
    const k = [...document.querySelectorAll('#galaxyMapSvg [data-sektor]')];
    if (!k.length) return 0;
    k[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return k.length;
  });
  await page.waitForTimeout(1600);
  const wie = await page.evaluate(() => {
    const k = [...document.querySelectorAll('#galaxyMapSvg [data-sektor-sys]')];
    if (!k.length) return { gefunden: 0 };
    k[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return { gefunden: k.length, system: k[0].getAttribute('data-sektor-sys') };
  });
  await page.waitForTimeout(1800);
  wie.sektorflaechen = sektor;
  return wie;
}

/* Was am gescrollten Reiter gemessen wird. Alles davon ist das, WAS DER SPIELER SIEHT:
   Rechtecke, Ueberlappung, Trefferflaeche - keine Stapelnummer (Falle 2). */
const A_MESSEN = (zielPos) => {
  const scrollbar = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo(0, Math.min(zielPos, Math.max(0, scrollbar)));
  return new Promise(fertig => setTimeout(() => {
    const tabs = document.querySelector('.tabs');
    if (!tabs) return fertig({ fehlt:'.tabs' });
    const ts = getComputedStyle(tabs), tr = tabs.getBoundingClientRect();
    const klebt = ts.position === 'sticky';
    // Das klebende BAND der Reiterleiste - nur wenn sie wirklich klebt, sonst gibt es keines.
    const band = klebt ? [tr.top, tr.bottom] : null;
    const sichtbar = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.offsetParent !== null; };
    // ALLE klebenden Elemente der zweiten Ebene im GERADE AKTIVEN Panel (Falle 3 - der Aufrufer
    // schleift ueber die Reiter, weil ein nicht aktives Panel display:none traegt).
    const zweite = [...document.querySelectorAll('.tab-panel *')]
      .filter(el => getComputedStyle(el).position === 'sticky' && sichtbar(el))
      .map(el => {
        const r = el.getBoundingClientRect(), c = getComputedStyle(el);
        const mx = r.left + r.width / 2, my = r.top + r.height / 2;
        const treffer = document.elementFromPoint(mx, my);
        return {
          id: el.id || null, klasse: String(el.className || '').slice(0, 24),
          panel: (el.closest('.tab-panel') || {}).id || null,
          cssTop: c.top, rect: [Math.round(r.top), Math.round(r.bottom)],
          ueberlappung: band ? Math.round(Math.max(0, Math.min(band[1], r.bottom) - Math.max(band[0], r.top))) : 0,
          // Wie weit UNTER der Unterkante der Reiterleiste faengt sie an? 0 heisst: sie stossen
          // aneinander. Negativ hiesse: sie liegt darueber oder darin.
          unterhalb: band ? Math.round(r.top - band[1]) : null,
          imBild: r.top >= -1 && r.bottom <= window.innerHeight + 1,
          getroffen: !!treffer && (treffer === el || el.contains(treffer)),
          traf: treffer ? (treffer.tagName.toLowerCase() + (treffer.id ? '#' + treffer.id : '') + '.' + String(treffer.className || '').slice(0, 20)) : null
        };
      });
    fertig({
      scrollbar, scrollY: Math.round(window.scrollY),
      compact: document.body.classList.contains('compact-head'),
      tabsPos: ts.position, tabsHoehe: Math.round(tr.height), tabsRect: [Math.round(tr.top), Math.round(tr.bottom)],
      sprungAbstand: getComputedStyle(document.documentElement).getPropertyValue('--sprung-abstand').trim(),
      leistenHoehe: getComputedStyle(document.documentElement).getPropertyValue('--leisten-hoehe').trim(),
      zweite
    });
  }, 450));
};

/* Was an EINER Knopfzeile gemessen wird. `zeilen` zaehlt die verschiedenen Oberkanten der
   SICHTBAREN Knoepfe, `kinderZeilen` dasselbe ueber ALLE sichtbaren Kinder der Leiste - ein
   eingefuegtes Nicht-Knopf-Element bricht die Zeile genauso um (Falle 5, aus dem
   zusammengefuehrten Waechter uebernommen). `ersterSchluessel` und `letzterSchluessel` kommen aus
   dem Markup, nicht aus einer Liste. */
const ZEILE_MESSEN = (a) => {
  const l = document.querySelector(a.leiste);
  if (!l) return { fehlt: a.leiste };
  const cs = getComputedStyle(l), r = l.getBoundingClientRect();
  const knoepfe = [...l.querySelectorAll('[' + a.attr + ']')];
  const sicht = knoepfe.filter(b => { const br = b.getBoundingClientRect(); return br.width > 0 && br.height > 0; });
  const kinder = [...l.children].filter(k => { const kr = k.getBoundingClientRect(); return kr.width > 0 && kr.height > 0; });
  const panels = a.panels ? [...document.querySelectorAll(a.panels)] : [];
  const offen = panels.filter(p => getComputedStyle(p).display !== 'none' && p.offsetParent !== null);
  const aktive = knoepfe.filter(b => b.classList.contains(a.aktiv));
  // Liegt ein Knopf VOLLSTAENDIG im sichtbaren Streifen der Leiste? Genau diese Frage stellt E.
  const imStreifen = b => { const br = b.getBoundingClientRect(); return br.left >= r.left - 1 && br.right <= r.right + 1; };
  return {
    hoehe: Math.round(r.height), knoepfe: knoepfe.length, sichtbar: sicht.length,
    zeilen: [...new Set(sicht.map(b => Math.round(b.getBoundingClientRect().top)))].length,
    kinder: kinder.length,
    kinderZeilen: [...new Set(kinder.map(k => Math.round(k.getBoundingClientRect().top)))].length,
    wrap: cs.flexWrap, overflowX: cs.overflowX, anzeige: cs.display,
    scrollLeft: Math.round(l.scrollLeft), scrollWidth: Math.round(l.scrollWidth), clientWidth: Math.round(l.clientWidth),
    // EIN Name fuer eine Frage: Ist der Inhalt breiter als der Kasten? Genau daran haengt, ob die
    // Zeile wischbar sein MUSS (B) und ob der aktive Knopf ueberhaupt herausfallen kann (E).
    wischbar: l.scrollWidth > l.clientWidth + 2,
    schluessel: knoepfe.map(b => b.getAttribute(a.attr)),
    ersterSchluessel: knoepfe.length ? knoepfe[0].getAttribute(a.attr) : null,
    letzterSchluessel: knoepfe.length ? knoepfe[knoepfe.length - 1].getAttribute(a.attr) : null,
    aktive: aktive.map(b => b.getAttribute(a.attr)),
    aktiveDraussen: aktive.filter(b => !imStreifen(b)).map(b => b.getAttribute(a.attr)),
    panelsGesamt: panels.length, panelsOffen: offen.length,
    offeneIds: offen.map(p => p.id || p.getAttribute('data-galaxy-sub') || p.getAttribute('data-alliance-sub'))
  };
};

// Der Daseins-Riegel, den JEDE B-Pruefung traegt (Falle 6).
const daseinsRiegel = m => !!m && !m.fehlt && m.knoepfe > 0 && m.sichtbar > 0;

(async () => {
  const browser = await starteBrowser();

  // ================= A: die klebende zweite Ebene, Handy, ueber ALLE Reiter =======================
  {
    const { ctx, page } = await seite(browser, 390, spielstand({ fleetSubTab: 'werft' }));
    await reiter(page, 'flotte');
    const flotte = await page.evaluate(A_MESSEN, 1400);

    // A0 ist die Vorbedingung, ohne die alles Weitere still gruen waere (Falle 1). Die Schranke
    // 5000 px liegt weit ueber der gemessenen kurzen Seite (838 px mit `fleetSubTab:'flotte'`)
    // und weit unter der gemessenen langen (rund 14900 px mit 'werft').
    merke('A0: die Flotten-Seite ist lang genug, dass die zweite Leiste ihren Klebepunkt erreicht',
      flotte.scrollbar > 5000 && flotte.scrollY > 1000,
      { scrollbar: flotte.scrollbar, scrollY: flotte.scrollY });
    // A1 ist die zweite Vorbedingung: ohne klebende Reiterleiste gibt es die Frage von A gar nicht.
    merke('A1: bei 390 px traegt die Seite compact-head und die Reiterleiste klebt oben am Bildrand',
      flotte.compact === true && flotte.tabsPos === 'sticky' && flotte.tabsRect[0] <= 1 && flotte.tabsHoehe > 0,
      { compact: flotte.compact, tabsPos: flotte.tabsPos, tabsRect: flotte.tabsRect, tabsHoehe: flotte.tabsHoehe });

    // Die Schleife ueber alle dreizehn Reiter (Falle 3). Der Flotten-Reiter ist schon gemessen.
    const leisten = flotte.zweite.map(l => Object.assign({ reiter: 'flotte' }, l));
    const proReiter = { flotte: flotte.zweite.length };
    let leistenHoehe = flotte.leistenHoehe;
    for (const t of HAUPTREITER){
      if (t === 'flotte') continue;
      await reiter(page, t);
      const m = await page.evaluate(A_MESSEN, 1400);
      proReiter[t] = (m.zweite || []).length;
      for (const l of (m.zweite || [])) leisten.push(Object.assign({ reiter: t }, l));
      if (m.leistenHoehe) leistenHoehe = m.leistenHoehe;
    }

    // A2 ohne gefundene Leiste waere ueber einer leeren Menge trivial gruen - deshalb die Anzahl
    // ausdruecklich mit in die Bedingung (Falle 6).
    const ueberlappend = leisten.filter(l => l.ueberlappung > 0);
    merke('A2: keine klebende Leiste der zweiten Ebene ueberlappt die Reiterleiste',
      leisten.length >= 1 && ueberlappend.length === 0,
      { gefunden: leisten.length, proReiter, ueberlappend: ueberlappend.slice(0, 3), alle: leisten.slice(0, 3) });
    // A3 stellt ZWEI Fragen, die zusammen erst die Zusage sind: vollstaendig im Bild UND unterhalb
    // der Reiterleiste. Die zweite kommt aus dem zusammengefuehrten Waechter - eine Leiste, die
    // OBERHALB oder INNERHALB des Reiterbandes sitzt, haette ebenfalls Ueberlappung 0, sobald sie
    // nur schmal genug waere.
    const schlecht3 = leisten.filter(l => !l.imBild || !(l.unterhalb >= 0));
    merke('A3: jede klebende Leiste der zweiten Ebene liegt im Bild und beginnt unterhalb der Reiterleiste',
      leisten.length >= 1 && schlecht3.length === 0,
      { schlecht: schlecht3.slice(0, 3) });
    const verdeckt = leisten.filter(l => !l.getroffen);
    merke('A4: die Mitte jeder klebenden Leiste ist antippbar, nicht von der Reiterleiste verdeckt',
      leisten.length >= 1 && verdeckt.length === 0,
      { verdeckt: verdeckt.slice(0, 3) });

    /* A7 prueft die HERKUNFT, nicht nur die Wirkung. Der Vertrag verlangte fuer A ausdruecklich
       die VORHANDENE, gemessene Groesse statt einer getippten Zahl - und eine getippte 169 liefe
       durch A2 bis A4 glatt hindurch, weil sie HEUTE zufaellig passt. Gemessen wird deshalb, dass
       der gerechnete `top` der klebenden Leiste GLEICH der Variablen ist, die
       `sprungAbstandSetzen()` aus der Leistenhoehe schreibt. Beide Werte liegen ohnehin vor; es
       ist eine Bedingung, kein zweiter Messlauf.
       Bewusst `--leisten-hoehe` und nicht `--sprung-abstand`: Letztere traegt 10 px Luft fuer
       Sprungziele, und als Klebepunkt erzeugte genau diese Luft einen Streifen, durch den der
       Inhalt sichtbar hindurchlief (gemessen Spalt 10 px, `elementFromPoint` traf `div.mark-row`). */
    const hoeheZahl = parseFloat(leistenHoehe);
    const falscherTop = leisten.filter(l => Math.abs(parseFloat(l.cssTop) - hoeheZahl) > 0.5);
    merke('A7: der Klebepunkt der zweiten Ebene IST die gemessene Leistenhoehe, keine getippte Zahl',
      leisten.length >= 1 && leistenHoehe !== '' && hoeheZahl > 0 && falscherTop.length === 0,
      { leistenHoehe, falscherTop: falscherTop.slice(0, 3).map(l => ({ reiter: l.reiter, id: l.id, cssTop: l.cssTop })) });
    await ctx.close();
  }

  // ================= A5: dieselbe Frage an der oberen Kante des kompakten Kopfes ==================
  {
    const { ctx, page } = await seite(browser, 700, spielstand({ fleetSubTab: 'werft' }));
    await reiter(page, 'flotte');
    const a = await page.evaluate(A_MESSEN, 1400);
    const leisten = a.zweite || [];
    const schlecht = leisten.filter(l => l.ueberlappung > 0 || !l.imBild || !l.getroffen || !(l.unterhalb >= 0));
    merke('A5: auch bei 700 px klebt die zweite Ebene unter der Reiterleiste und bleibt antippbar',
      a.compact === true && a.tabsPos === 'sticky' && a.scrollbar > 5000
      && leisten.length >= 1 && schlecht.length === 0,
      { compact: a.compact, tabsPos: a.tabsPos, scrollbar: a.scrollbar, gefunden: leisten.length, schlecht: schlecht.slice(0, 2) });
    await ctx.close();
  }

  // ================= A6 + B0: am PC darf sich nichts geaendert haben ==============================
  {
    const { ctx, page } = await seite(browser, 1400, spielstand({ fleetSubTab: 'werft' }));
    await reiter(page, 'flotte');
    const a = await page.evaluate(A_MESSEN, 1400);
    const leisten = a.zweite || [];
    /* Am PC klebt die Reiterleiste NICHT (gemessen: position=static), die Statusleiste gehoert
       deshalb weiter auf ihre eigenen 4 px. Statt diese 4 einzutippen - die Zahl, um die es hier
       geht - stellt A6 dieselbe HERKUNFTS-Frage wie A7, nur andersherum: Der gerechnete `top`
       darf am PC gerade NICHT die gemessene Leistenhoehe sein (gemessen 94 px), und die Leiste
       darf nicht nach unten gerutscht sein. Faellt der `body.compact-head`-Vorsatz der neuen
       Regel weg, trifft beides zu. */
    const hoeheZahl = parseFloat(a.leistenHoehe);
    const versetzt = leisten.filter(l => l.rect[0] > 60 || Math.abs(parseFloat(l.cssTop) - hoeheZahl) <= 0.5);
    merke('A6: am PC klebt die Reiterleiste nicht und die zweite Ebene steht unveraendert oben',
      a.compact === false && a.tabsPos === 'static' && leisten.length >= 1 && versetzt.length === 0,
      { compact: a.compact, tabsPos: a.tabsPos, leistenHoehe: a.leistenHoehe, sprungAbstand: a.sprungAbstand,
        leisten: leisten.map(l => ({ id: l.id, cssTop: l.cssTop, rect: l.rect })) });

    /* Die Gegenrichtung zu B: oberhalb der 700-px-Schwelle bleiben die Zeilen umbrechend und
       gerade NICHT wischbar - gemessen flex-wrap:wrap und overflow-x:visible bei allen dreien,
       die die Media-Regel betrifft. Ein zu weit gefasster Medienbereich faellt hier auf.
       MIT DASEINS-RIEGEL (Falle 6): Ohne ihn wuerde eine Zeile, deren Knoepfe alle unsichtbar
       sind, mit `zeilen === 0` durchgehen - „hoechstens eine Zeile" ist ueber der leeren Menge
       trivial wahr, und die Pruefung haette nichts gemessen. */
    const pcSchlecht = [];
    for (const z of ZEILEN){
      await reiter(page, z.reiter);
      const kartenlage = z.system ? await systemOeffnen(page) : null;
      const m = await page.evaluate(ZEILE_MESSEN, z);
      // Dieselbe Vorbedingung wie bei B5: Misst die Karte versehentlich die Regionsuebersicht,
      // soll B0 FALLEN statt still die schwaechere Lage zu messen.
      const kartenlageOk = !z.system || (kartenlage && kartenlage.gefunden > 0 && m.sichtbar === m.knoepfe);
      if (!daseinsRiegel(m) || !kartenlageOk || m.zeilen > 1 || m.kinderZeilen > 1 || m.overflowX !== 'visible') pcSchlecht.push({ zeile: z.name, kartenlage, m });
    }
    merke('B0: am PC sind alle fuenf Knopfzeilen da, einzeilig und ohne Wischbereich',
      pcSchlecht.length === 0, pcSchlecht.slice(0, 3));
    await ctx.close();
  }

  // ================= B: die fuenf Knopfzeilen am Handy ============================================
  {
    const { ctx, page } = await seite(browser, 390, spielstand({}));
    for (const z of ZEILEN){
      await reiter(page, z.reiter);
      // B5 wird erst auf der Systemebene aussagekraeftig (Begruendung an ZEILEN).
      const kartenlage = z.system ? await systemOeffnen(page) : null;
      const m = await page.evaluate(ZEILE_MESSEN, z);
      const da = daseinsRiegel(m);
      // Fuer die Sektorkarte gehoert die Vorbedingung „alle vier Knoepfe sind sichtbar" mit in die
      // Pruefung: Misst sie versehentlich die Regionsuebersicht, soll sie FALLEN und nicht still
      // die schwaechere Lage messen.
      const vorbedingung = !z.system || (da && kartenlage && kartenlage.gefunden > 0 && m.sichtbar === m.knoepfe && m.knoepfe === 4);
      // Zwei Fragen in einer Pruefung, weil nur beide zusammen die Zusage sind: hoechstens zwei
      // Knopfzeilen UND kein Knopf, der dabei unerreichbar wird.
      const niedrig = da && m.zeilen <= 2 && m.kinderZeilen <= 2;
      const erreichbar = da && (!m.wischbar || m.overflowX === 'auto' || m.overflowX === 'scroll');
      merke('B' + z.nr + ': die Zeile ' + z.name + ' hat am Handy hoechstens zwei Knopfzeilen und laesst keinen Knopf unerreichbar',
        da && vorbedingung && niedrig && erreichbar, Object.assign({ kartenlage }, m));
    }
    await ctx.close();
  }

  // ================= C: der unbekannte Schluessel =================================================
  // Am HANDY gemessen (aus dem zusammengefuehrten Waechter uebernommen): Dort ist die Zeile
  // wischbar, also der interessantere Zustand; der Rueckfall selbst haengt an keiner Breite.
  {
    const stand = spielstand({ fleetSubTab: ERFUNDEN, officerSubTab: ERFUNDEN,
                               galaxySubTab: ERFUNDEN, allianceSubTab: ERFUNDEN });
    const { ctx, page } = await seite(browser, 390, stand);
    for (const z of ZEILEN){
      if (!z.panels) continue;   // die Sektorkarte ist Mehrfachwahl, sie hat keine Rueckfall-Frage
      await reiter(page, z.reiter);
      const m = await page.evaluate(ZEILE_MESSEN, z);
      const da = !m.fehlt && m.panelsGesamt > 0 && m.knoepfe > 0;
      // Der erfundene Schluessel darf in der Zeile gar nicht vorkommen - sonst pruefte C nichts.
      const wirklichUnbekannt = da && m.schluessel.indexOf(ERFUNDEN) < 0;
      // GEMESSEN wird, ob ein Panel SICHTBAR ist - nicht, was im Spielstand steht: Der Spielstand
      // wird bewusst nicht berichtigt, die Anzeige faellt nur zurueck.
      const einsOffen = da && m.panelsOffen === 1;
      const ersterAktiv = da && m.aktive.length === 1 && m.aktive[0] === m.ersterSchluessel;
      merke('C' + z.nr + ': ein unbekannter Schluessel laesst die Zeile ' + z.name + ' auf ihren ERSTEN Reiter zurueckfallen',
        da && wirklichUnbekannt && einsOffen && ersterAktiv, m);
    }
    await ctx.close();
  }

  /* ================= D: der LEERE Spielstand ====================================================
     WARUM DIESER BLOCK EIGENS EXISTIERT: Vor UI-5a hing der Rueckfall fuer den leeren Spielstand
     an zwei Zeilen, die dieser Aenderungssatz ERSATZLOS entfernt hat -
     `if (state.galaxySubTab === undefined) state.galaxySubTab = 'kampf';` und die gleichlautende
     fuer die Allianz. Seither traegt ihn allein `unterreiterSchluessel(undefined, ...)`, das dann
     den ersten Knopf liefert. C deckt diesen Pfad NICHT ab: Dort steht in allen vier Zeilen ein
     erfundener Schluessel, nie gar keiner. Ein Riss genau hier traefe jeden neuen Spieler beim
     allerersten Oeffnen des Reiters - der schlechteste denkbare Ort. */
  {
    const { ctx, page } = await seite(browser, 390, spielstand({}));
    for (const z of ZEILEN){
      if (!z.panels) continue;
      await reiter(page, z.reiter);
      const m = await page.evaluate(ZEILE_MESSEN, z);
      // Der Spielstand darf den Schluessel wirklich nicht tragen - sonst pruefte D nichts.
      /* `state` ist ein top-level `let` und liegt damit NICHT an `window` - bare gelesen, in
         try/catch, damit ein spaeteres Umbenennen hier keinen Absturz erzeugt. Das Ergebnis steht
         nur im BELEG: D misst die ANZEIGE, nicht den Spielstand. Es macht aber sichtbar, ob der
         Rueckfall den Wert stillschweigend zurueckgeschrieben hat - das soll er ausdruecklich
         nicht (Begruendung an `unterreiterSchluessel`). */
      const leer = await page.evaluate(k => { try { return state[k] === undefined; } catch(e){ return 'unlesbar: ' + e.message; } }, z.zustand);
      const da = !m.fehlt && m.panelsGesamt > 0 && m.knoepfe > 0;
      merke('D' + z.nr + ': ohne gespeicherten Schluessel zeigt die Zeile ' + z.name + ' genau ein Panel und den ersten Knopf aktiv',
        da && m.panelsOffen === 1 && m.aktive.length === 1 && m.aktive[0] === m.ersterSchluessel,
        Object.assign({ zustandLeer: leer, zustandsSchluessel: z.zustand }, m));
    }
    await ctx.close();
  }

  /* ================= E: der aktive Knopf einer wischbaren Zeile =================================
     Punkt B hat die Galaxie- und die Allianz-Zeile einzeilig und wischbar gemacht - und niemand
     holte den AKTIVEN Knopf ins Bild. GEMESSEN am Zwischenstand bei 390 px mit dem LETZTEN
     Schluessel im Spielstand: Galaxie/`info` lag bei 672-783 in einem 348 px breiten Kasten,
     Allianz/`verwaltung` bei 352-458 - beide vollstaendig ausserhalb. Der Spieler sah eine
     Pillenzeile, in der KEIN Knopf aktiv aussah.
     DER LETZTE SCHLUESSEL WIRD GEMESSEN, NICHT GETIPPT: Die Seite wird einmal geladen, um ihn je
     Zeile aus dem Markup abzulesen, und danach mit genau diesem Schluessel im Spielstand erneut. */
  {
    const letzte = {};
    {
      const { ctx, page } = await seite(browser, 390, spielstand({}));
      for (const z of ZEILEN){
        if (!z.zustand) continue;
        await reiter(page, z.reiter);
        const m = await page.evaluate(ZEILE_MESSEN, z);
        letzte[z.zustand] = m.letzterSchluessel;
      }
      await ctx.close();
    }
    const { ctx, page } = await seite(browser, 390, spielstand(letzte));
    for (const z of ZEILEN){
      if (!z.zustand) continue;
      await reiter(page, z.reiter);
      const m = await page.evaluate(ZEILE_MESSEN, z);
      const da = daseinsRiegel(m) && m.aktive.length >= 1;
      // Die Zeile muss wirklich den letzten Knopf zeigen, sonst misst E den falschen Zustand.
      const richtig = da && m.aktive.length === 1 && m.aktive[0] === letzte[z.zustand] && letzte[z.zustand];
      merke('E' + z.nr + ': in der Zeile ' + z.name + ' liegt der aktive Knopf ohne Wischen im sichtbaren Streifen',
        da && richtig && m.aktiveDraussen.length === 0,
        Object.assign({ gesetzt: letzte[z.zustand] }, m));
    }
    await ctx.close();
  }

  merke('J1: keine Skriptfehler in allen Messlaeufen', fehler.length === 0, fehler.slice(0, 3));

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
