// Die Chip-Reihe der Kopfzeile: Zugehoerigkeit, Kopfhoehe, Lesbarkeit, ein Format je Groesse
// (UI-6, 12.09.2026).
//
//   node tests/test_kopfzeile_chips.js
//
// WAS AM GRUNDSTAND (v8.726.0) GEMESSEN WURDE
// -------------------------------------------
// A  Die Reihe lief bei JEDER Breite ueber: Inhalt 1023-1047 px gegen 318/348/658/738/888/988 px
//    Flaeche bei 360/390/700/1000/1400/1500 px Fenster. Der letzte Chip war bei keiner Breite
//    ganz im Bild, und der Scrollbalken ist per scrollbar-width:none unsichtbar - es gab keinen
//    Hinweis darauf, dass rechts noch etwas steht.
// B  Vier Chips gelten kontoweit, vier haengen am aktiven Standort; im Markup standen sie
//    verschraenkt. Erzaehlt wurde der Unterschied nur in den Tooltips - am Handy also nirgends.
// C  Dieselbe Groesse stand in zwei Schreibweisen da: Angriffskraft roh im Chip und in der
//    38-px-Zentralzahl, gerundet in der Klebeleiste; Kampfpunkte roh (1234567) neben dem
//    Punktestand-Chip (3.70M).
//
// VIER FALLEN, GEGEN DIE DIESER WAECHTER AUSDRUECKLICH GEBAUT IST
// ---------------------------------------------------------------
//  1. EINE PRUEFUNG, DIE NUR CONTAINER ZAEHLT, IST AUCH MIT FALSCHEM INHALT GRUEN. „Es gibt zwei
//     Gruppen" und „kein Chip steht ausserhalb" bleiben beide wahr, wenn die Kampfpunkte in der
//     Standort-Gruppe landen. Deshalb steht die Zugehoerigkeit hier AUSGESCHRIEBEN (SOLL_GRUPPEN,
//     Vorbild: die BESTAND-Liste in tests/test_nav.js) - eine aus derselben Datei abgeleitete
//     Erwartung koennte ein Verschieben gar nicht bemerken. Dazu die VERHALTENS-Probe 1e: Beim
//     Standortwechsel darf sich kein Chip der Konto-Gruppe aendern. Das prueft die Zusage selbst
//     und nicht ihre Beschriftung.
//  2. EIN FORMAT-VERGLEICH GEGEN fmt() VERGLEICHT DEN CODE MIT SICH SELBST. Die Kampfpunkte
//     stehen deshalb gegen eine EINGETRAGENE Zeichenkette: Der Spielstand traegt 1234567, und im
//     Chip muss „1.23M" stehen. Fuer Angriff und Verteidigung ist keine eingetippte Zahl
//     moeglich, ohne eine Momentaufnahme der Balance festzuschreiben (jede Waffen-Aenderung
//     brauchte dann einen Testlauf) - dort gilt die REGEL: alle Stellen zeichengleich UND eine
//     gueltige Kurzschreibweise des Hauses. Die zweite Haelfte ist noetig, weil eine Rueckkehr zu
//     ROHZAHLEN an ALLEN Stellen den reinen Gleichheitsvergleich gruen liesse.
//  3. scrollWidth > clientWidth SAGT NUR, DASS ETWAS UEBERLAEUFT - nicht, ob der Spieler es
//     merkt. Gemessen wird deshalb, was er sieht: Liegt jedes Chip-Rechteck im sichtbaren
//     Rechteck seines Behaelters? Wenn nicht, MUSS der Hinweis-Knopf sichtbar sein. Und die
//     Gegenrichtung: Passt alles, darf er nicht dastehen und eine Fortsetzung behaupten.
//  4. EIN EINGETIPPTER HOEHEN-GRENZWERT VERALTET STILL. Die Kopfhoehe wird gegen einen
//     Vergleichsstand gemessen, der IM SELBEN LAUF geladen wird - dieselbe Spieldatei mit einer
//     angehaengten Regel, die die Gruppen bei jeder Breite aufloest (derselbe Layout-Zustand wie
//     „gar keine Gruppen"). Ein historischer Stand kommt nur ueber KEPLER_KOPFZEILE_ALT dazu.
//  5. EINE PRUEFUNG, DIE NUR WAAGERECHT MISST, KANN DORT NICHT FALLEN, WO DIE NEUE MECHANIK
//     SITZT. Ab 1001 px bricht die Reihe um; waagerecht ist dann alles im Bild und der Hinweis
//     verborgen, 3a und 3b sind per Konstruktion gruen. Deshalb 3a2 (senkrecht, gegen die Reihe
//     UND gegen die abschneidende Kopfzeile) und 3e (eine eigene Pruefung fuer die Breiten ab
//     1001 px). Und 3h/3h2 mit einem EIGENEN Spielstand, weil der Fehler, um den es dort geht,
//     mit dem Spielstand oben gar nicht ausloesbar ist.
//
// DIESER WAECHTER IST DER EINZIGE FUER DIE CHIP-REIHE (zusammengefuehrt am 12.09.2026).
// Daneben stand kurzzeitig tests/test_kopfzeile_gruppen.js mit denselben Zusagen; run.js faehrt
// jede test_*.js, also liefen beide. Er ist geloescht, weil er zwei Fehler hatte, die hier nicht
// wiederkehren duerfen:
//   * Er verlangte Zeichengleichheit zwischen Verteidigungs-Chip, Zentralzahl und der KACHEL der
//     Imperium-Uebersicht. Die Kachel ruft defensePower() OHNE Standort und summiert ueber alle
//     Standorte - sie ist eine andere Groesse. Sein Spielstand hatte keine Kolonie, dort waren
//     beide Werte zufaellig gleich; mit der Kolonie dieses Spielstands sind es gemessen 22.2k
//     gegen 22.1k. Die Pruefung waere also auf voellig korrektem Code gefallen. Hier steht die
//     Kachel deshalb in 4e ALLEIN: geprueft wird ihre Schreibweise und dass die Reichssumme den
//     Standortwert nicht unterschreitet - nicht Gleichheit.
//   * Seine Kopfhoehen-Grenzen waren eingetippte Absolutwerte. Sie sind ersatzlos entfallen;
//     2a/2b messen dieselbe Zusage gegen einen im selben Lauf erzeugten Vergleichsstand.
// Herueber kam aus ihm, was hier fehlte: die Umbruch-Pruefung ab 1001 px (jetzt 3e, erweitert um
// „keine Gruppe zerrissen") und die beilaeufige Leer-Gruppen-Pruefung an allen sechs Breiten
// (jetzt 1i, neben dem aktiven Kunstfall 1h).
//
// GEGENPROBEN (KEPLER_KOPFZEILE_GEGENPROBE=<stand>, Spieldatei per KEPLER_SPIELDATEI umlenken):
//   =alt    der Grundstand v8.726.0 - dort faellt der Kern; die Kopfhoehe bleibt gruen, denn sie
//           ist genau der Wert, der sich NICHT aendern darf.
//   =sabA   der Hinweis-Knopf bleibt immer verborgen
//   =sabB   der Kampfpunkte-Chip liegt in der Standort-Gruppe
//   =sabC   die Angriffskraft im Chip laeuft wieder roh
//   =sabD   eine Gruppe ohne sichtbaren Chip bleibt samt Titel stehen
//   =sabE   der Gruppentitel klebt nicht mehr (position:static statt sticky)
//   =sabF   der Hinweis-Knopf haengt wieder als Flex-Kind IN der umbrechenden Reihe
//   =sabG   der volle Standortname steht nicht mehr im title des Gruppentitels
//   =sabH   die NPC-Zielliste zeigt Angriff und Verteidigung wieder roh
//   =sabI   der Kasten „Markiertes Ziel" zeigt die Angriffskraft wieder roh
//   =sabJ   die Kopfzeile ist 100 statt 190 px hoch und schneidet die zweite Chip-Zeile ab
// Jede Sabotage entsteht aus der AKTUELLEN Spieldatei; jeder Anker wird vorher gezaehlt (genau
// eine Fundstelle, sonst Abbruch VOR dem Schreiben). sabF braucht drei Ersetzungen und nicht
// eine: Das Markup allein zurueckzuschieben genuegt nicht, weil der Knopf absolut positioniert
// bliebe - eine Sabotage, die nur die Haelfte einer Regel zuruecknimmt, bleibt wirkungslos und
// sieht dann aus wie eine blinde Pruefung.
// sabB bringt AUCH 1g zu Fall, und das ist kein Zufall: Wandert ein Chip aus der Konto-Gruppe,
// stimmt auch ihre Chipzahl im Betreiber- und im Normalfall nicht mehr. sabA bringt ausser den
// Hinweis-Pruefungen auch 3f und V7/3h/3h2 zu Fall - ohne sichtbaren Knopf gibt es weder eine
// Endstellung zu messen noch eine Vorbedingung fuer den engen Fall.
// Die MUSS_FALLEN-Listen sind GEMESSEN - erst leer laufen lassen, dann eingetragen, dann alle
// Staende erneut, bis jeder Lauf Exit 0 lieferte. Eine Sabotage, die gruen bleibt, ist ein Befund
// ueber die Pruefung oder ueber die Sabotage - nie ein Grund, die Liste passend zu machen.
const { starteBrowser, SPIEL_URL, SPIELDATEI, ruhigeUhren, versionAbfangen } = require('./lib/umgebung');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_KOPFZEILE_GEGENPROBE || '';
// GEMESSEN am 12.09.2026: erst mit leeren Listen gefahren, dann eingetragen, dann alle fuenf
// Staende erneut - bis jeder Lauf Exit 0 lieferte. Was NICHT faellt, ist dabei so wichtig wie was
// faellt: Am Grundstand bleiben 2a und 2b gruen (die Kopfhoehe ist genau der Wert, der sich nicht
// aendern darf), und 1c bleibt gruen, weil es ueber der leeren Menge der sichtbaren Gruppen
// urteilt - dafuer fallen dort 1a und 1b.
const MUSS_FALLEN = {
  alt:  ['1a', '1b', '1d', '1k', '1g', '1h', '3a', '3c', '3d', '3f', '3e', 'V7', '3h', '3h2', '4a', '4b', '4c', '4d', '4g', '4i', '4h', '4j'],
  sabA: ['3a', '3c', '3d', '3f', 'V7', '3h', '3h2'],
  sabB: ['1b', '1g'],
  sabC: ['4a'],
  sabD: ['1h'],
  sabE: ['3f'],
  sabF: ['3f', '3h', '3h2'],
  sabG: ['1k'],
  sabH: ['4i'],
  sabI: ['4j'],
  sabJ: ['3a2']
};

// Die sechs Breiten des Vertrags. 360/390 sind Handy-Masse (dort ist die Kopfzeile mit 206 px
// hoeher als am PC mit 190 px), 700 die Mobil-Schwelle des Spiels, 1000/1001 die Kante des
// ausfuehrlichen Kopfs, 1400/1500 der PC.
const BREITEN = [360, 390, 700, 1000, 1400, 1500];

// AUSGESCHRIEBEN, nicht aus der Datei abgeleitet (Falle 1 oben). Der Schluessel eines Chips ist
// die Id seines Wertknotens - dieselbe Id, an der tests/test_tickruhe.js haengt.
const SOLL_GRUPPEN = [
  { schluessel: 'konto',    chips: ['heroLevel', 'heroScore', 'heroResearch', 'heroBP', 'heroOnline'] },
  { schluessel: 'standort', chips: ['heroFleet', 'heroAttack', 'heroDefense', 'heroExpedition'] }
];
const ALLE_CHIPS = SOLL_GRUPPEN.reduce((a, g) => a.concat(g.chips), []);

// Der Spielstand traegt eine BEKANNTE grosse Zahl. 1234567 Kampfpunkte sind der Fall aus dem
// Vertrag: roh stand daneben „3.70M" im Punktestand-Chip.
const KAMPFPUNKTE = 1234567;
const KAMPFPUNKTE_ERWARTET = '1.23M';

/* Eine gueltige Ausgabe der Haus-Kurzschreibweise. Abgelesen an fmt() in der Spieldatei
   (>=1e6: zwei Nachkommastellen und „M", >=1000: eine Nachkommastelle und „k", darunter eine
   Zahl unter 1000 mit hoechstens einer Nachkommastelle). Eine Rohzahl mit vier oder mehr Ziffern
   kann diese Form NIE annehmen - genau daran faellt eine Rueckkehr zu Rohzahlen auf. */
const KURZSCHREIBWEISE = /^(?:\d+\.\d{2}M|\d+\.\dk|\d{1,3}(?:\.\d)?)$/;

/* Eine angezeigte Zahl in ihre Groessenordnung zuruecklesen - fuer die Vorbedingung „die Groesse
   ist ueberhaupt gross genug, dass sich die Schreibweisen unterscheiden". Bewusst formatblind:
   „13688" und „13.7k" ergeben beide einen Wert ueber 1000, die Vorbedingung ist also in BEIDEN
   Schreibweisen erfuellt und kann die Formatpruefung darunter nicht gruen faerben. */
function zahlWert(text){
  const m = String(text == null ? '' : text).trim().match(/^(\d+(?:[.,]\d+)?)([kM])?$/);
  if (!m) return null;
  const roh = parseFloat(m[1].replace(',', '.'));
  if (!isFinite(roh)) return null;
  return m[2] === 'M' ? roh * 1e6 : m[2] === 'k' ? roh * 1000 : roh;
}

const SPIELSTAND = JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  seenTabHints: { basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                  galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1, sammlung:1 },
  resources: { energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:2e4, forschungspunkte:3e4 },
  buildings: { solar:22, mine:20, kristallmine:18, labor:14, lager:16, werft:14, turm:12, schild:10,
               laser:12, plasma:8, raketen:9, gauss:7, festung:4 },
  research: { rkampf:9, rsolar:9, rerz:8, rschild:6 },
  // Reich bestueckt mit Absicht: Angriff und Verteidigung muessen ueber 1000 liegen, sonst waere
  // die Formatpruefung trivial (Vorbedingung V6 misst das nach).
  fleet: { ships:40, cruisers:30, jaeger:900, bomber:260, schlachtschiff:120, frachter:80, missions:[] },
  // Eine zweite Kolonie ist Pflicht: Ohne sie gibt es keinen Standortwechsel, und die Zusage B
  // waere nur als Beschriftung pruefbar (Pruefung 1d/1e).
  discovered: { rhea:true },
  colonies: { rhea: { buildings:{ solar:3, mine:2, habitat:1, turm:3 }, fleet:{ ships:0, missions:[] } } },
  activeBasePlanet: 'home', player: { id:'u', name:'AdmiralX', avatarKey:null },
  battleStats: { wins:9, losses:2 }, battlePoints: KAMPFPUNKTE, xp: 260000, credits: 180000, buffs: [],
  lastTick: Date.now(), colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {},
  equippedShipModules: {}, moduleFragments: 0
}));

/* Die Attrappe legt die Spielerzahl jedem Konto hin, das danach fragt - die Schranke ist das
   Spiel (istBetreiberKonto), nicht die Antwort. Genau so macht es tests/test_spielerzahl_kopfzeile.js. */
function backend(store, konto){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:konto.name, isAdmin:!!konto.admin, homeSystem:'kepler',
      homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'admin/spielerzahl') return j({ online:konto.online, registriert:konto.registriert, schwelleMs:300000 });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending|notifications/.test(p))
      return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

const OVERLAYS = ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
                  'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay'];

async function seite(browser, url, breite, konto){
  const ctx = await browser.newContext({ viewport:{ width:breite, height:1000 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(String(e)));
  await versionAbfangen(page);
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }, konto || { name:'AdmiralX' }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(url);
  await page.waitForTimeout(2800);
  await page.evaluate(ids => ids.forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }), OVERLAYS);
  await page.waitForTimeout(700);
  return { ctx, page, fehler };
}

// ---- Was auf einer Seite gemessen wird ----------------------------------------------------------
const MESSEN = () => {
  const reihe = document.querySelector('.hero-stats');
  if (!reihe) return null;
  const sicht = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  const schluessel = c => { const v = c.querySelector('.hstat-value'); return (v && v.id) || c.id || '?'; };
  const rr = reihe.getBoundingClientRect();
  const gruppen = [...reihe.querySelectorAll('.hstat-gruppe')];
  const chips = [...reihe.querySelectorAll('.hstat')];
  const knopf = document.getElementById('heroStatsMehr');
  const tabs = document.querySelector('.tabs');
  const hero = document.querySelector('.hero');
  const hr = hero ? hero.getBoundingClientRect() : null;
  return {
    gruppen: gruppen.map(g => {
      const t = g.querySelector('.hstat-gruppe-titel');
      return { schluessel: g.getAttribute('data-hstat-gruppe'),
               direktesKind: g.parentElement === reihe,
               sichtbar: sicht(g),
               breite: Math.round(g.getBoundingClientRect().width),
               titelAnzahl: g.querySelectorAll('.hstat-gruppe-titel').length,
               titelSichtbar: sicht(t),
               titel: t ? (t.textContent || '').trim() : null,
               chipsSichtbar: [...g.querySelectorAll('.hstat')].filter(sicht).length };
    }),
    chips: chips.map(c => {
      const r = c.getBoundingClientRect();
      const v = c.querySelector('.hstat-value');
      return { schluessel: schluessel(c),
               gruppe: c.closest('.hstat-gruppe') ? c.closest('.hstat-gruppe').getAttribute('data-hstat-gruppe') : null,
               sichtbar: sicht(c),
               text: v ? (v.textContent || '').trim() : null,
               ganzImBild: r.left >= rr.left - 1 && r.right <= rr.right + 1,
               /* SENKRECHT AUCH (Durchsicht 12.09.2026). Die Lesbarkeits-Pruefungen verglichen nur
                  die waagerechte Lage - und genau ab 1001 px, wo der Umbau seine neue Mechanik hat
                  (zweite Zeile), ist waagerecht per Konstruktion alles drin. Sie konnten dort also
                  gar nicht mehr fallen. Gemessen wird deshalb gegen ZWEI Rechtecke:
                  die sichtbare Flaeche der Reihe selbst und die Kopfzeile, die mit
                  `overflow:hidden` und fester Hoehe (190 px ab 1001 px) wirklich abschneidet. */
               senkrechtInReihe: r.top >= rr.top - 1 && r.bottom <= rr.bottom + 1,
               senkrechtImKopf: !!hr && r.top >= hr.top - 1 && r.bottom <= hr.bottom + 1,
               oben: Math.round(r.top) };
    }),
    zeilenOben: [...new Set(chips.filter(sicht).map(c => Math.round(c.getBoundingClientRect().top)))].sort((a, b) => a - b),
    kopfOberkante: hr ? Math.round(hr.top) : null,
    ueberlauf: reihe.scrollWidth - reihe.clientWidth,
    scrollLeft: Math.round(reihe.scrollLeft),
    knopfDa: !!knopf,
    knopfSichtbar: !!knopf && !knopf.hidden && sicht(knopf),
    knopfIcon: (document.getElementById('heroStatsMehrIcon') || {}).className || null,
    kopfhoehe: hero ? Math.round(hero.getBoundingClientRect().height) : null,
    // Absolute Seitenposition, nicht die Fensterposition - alles, was unter der Kopfzeile steht,
    // faengt hier an.
    kopfUnten: hero ? Math.round(hero.getBoundingClientRect().bottom + window.scrollY) : null,
    reiterOben: tabs ? Math.round(tabs.getBoundingClientRect().top + window.scrollY) : null,
    // Der Behaelter, ueber den tests/test_spielerzahl_kopfzeile.js (3b) das Abzeichen findet.
    spielerzahlInReihe: !!(document.getElementById('heroOnlineChip') &&
                           document.getElementById('heroOnlineChip').closest('.hero-stats'))
  };
};

// ---- Der Vergleichsstand fuer die Kopfhoehe -----------------------------------------------------
// KEIN Vorgabepfad auf eine Sitzungskopie (lib/umgebung.js begruendet, warum): Im Regelfall wird
// er aus der AKTUELLEN Spieldatei abgeleitet - dieselbe Datei plus eine Regel, die die Gruppen
// aufloest, die Titel und den Hinweis-Knopf entfernt und den Umbruch zuruecknimmt. Das ist
// layouttechnisch der Zustand vor UI-6, und die Hoehenpruefung behaelt ihre Aussage auch dann,
// wenn der historische Stand laengst weg ist.
function vergleichsstand(){
  const benannt = process.env.KEPLER_KOPFZEILE_ALT || '';
  try { if (benannt && fs.statSync(benannt).size > 0) return { pfad:benannt, art:'Ausgangsstand', historisch:true, ordner:null }; } catch (e) {}
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-kopfzeile-'));
  const ziel = path.join(ordner, 'vergleich.html');
  fs.writeFileSync(ziel, fs.readFileSync(SPIELDATEI, 'utf8') +
    '\n<style>.hero-stats .hstat-gruppe{display:contents !important;}' +
    '.hero-stats .hstat-gruppe-titel{display:none !important;}' +
    '#heroStatsMehr{display:none !important;}' +
    '@media (min-width:1001px){body:not(.compact-head) .hero-stats{flex-wrap:nowrap !important;}}</style>\n');
  return { pfad:ziel, art:'aus der Spieldatei abgeleitet (ohne Gruppen, ohne Hinweis)', historisch:false, ordner };
}
let VERGLEICH = null;
function aufraeumenVergleich(){
  if (VERGLEICH && VERGLEICH.ordner){
    try { fs.rmSync(VERGLEICH.ordner, { recursive:true, force:true }); } catch (e) {}
    VERGLEICH.ordner = null;
  }
}

(async () => {
  const browser = await starteBrowser();
  VERGLEICH = vergleichsstand();
  const fehlerAlle = [];
  const neu = {}, alt = {};

  // ---- Vergleichsstand: nur die Hoehen, je Breite eine eigene Seite ------------------------------
  // Eine eigene Seite je Breite, KEIN setViewportSize: Der kompakte Kopf haengt an einer
  // Automatik, die beim Laden UND beim Groessenwechsel greift - ein frisch geladener Stand ist
  // der Zustand, den der Spieler wirklich bekommt.
  for (const w of BREITEN){
    const { ctx, page, fehler } = await seite(browser, 'file://' + VERGLEICH.pfad, w);
    alt[w] = await page.evaluate(MESSEN);
    fehlerAlle.push(...fehler.map(f => 'Vergleich@' + w + ': ' + f));
    await ctx.close();
  }
  const v390 = alt[390];
  const ohneGruppen = !!v390 && (v390.gruppen.length === 0 || v390.gruppen.every(g => !g.sichtbar));
  merke('V3: Vergleichsstand geladen, Chip-Reihe ohne eigene Gruppenkaesten (' + VERGLEICH.art + ')',
    !!v390 && v390.chips.length >= 8 && ohneGruppen &&
    path.resolve(VERGLEICH.pfad) !== path.resolve(SPIELDATEI) && alt[360] && alt[1500],
    { pfad:VERGLEICH.pfad, chips: v390 ? v390.chips.length : null,
      gruppenSichtbar: v390 ? v390.gruppen.filter(g => g.sichtbar).length : null,
      hoehen: BREITEN.map(w => w + ':' + (alt[w] ? alt[w].kopfhoehe : '?')).join(' ') });

  // ---- Neuer Stand: dieselben sechs Breiten ------------------------------------------------------
  for (const w of BREITEN){
    const { ctx, page, fehler } = await seite(browser, SPIEL_URL, w);
    neu[w] = await page.evaluate(MESSEN);

    // Pruefung 3c/3d brauchen dieselbe Seite: ans Ende wischen, dann den Knopf druecken.
    if (neu[w] && neu[w].knopfSichtbar){
      neu[w].ende = await page.evaluate(async () => {
        const r = document.querySelector('.hero-stats');
        r.scrollLeft = r.scrollWidth;
        await new Promise(x => setTimeout(x, 400));
        const rr = r.getBoundingClientRect();
        const chips = [...r.querySelectorAll('.hstat')].filter(c => getComputedStyle(c).display !== 'none');
        const letzt = chips[chips.length - 1];
        const lr = letzt.getBoundingClientRect();
        const k = document.getElementById('heroStatsMehr');
        const sichtb = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
        return { letzterGanzImBild: lr.left >= rr.left - 1 && lr.right <= rr.right + 1,
                 knopfSichtbar: !!k && !k.hidden,
                 icon: (document.getElementById('heroStatsMehrIcon') || {}).className || '',
                 letzter: chips.length ? chips[chips.length - 1].querySelector('.hstat-value').id : null,
                 // Fuer 3f: welche Gruppe ist am Ende der Reihe noch zu sehen, und steht ihr Titel dann im Bild?
                 gruppen: [...r.querySelectorAll('.hstat-gruppe')].filter(sichtb).map(g => {
                   const gb = g.getBoundingClientRect();
                   const t = g.querySelector('.hstat-gruppe-titel');
                   const tb = t ? t.getBoundingClientRect() : null;
                   return { schluessel: g.getAttribute('data-hstat-gruppe'),
                            imBild: gb.right > rr.left + 1 && gb.left < rr.right - 1,
                            titelImBild: !!tb && tb.left >= rr.left - 1 && tb.right <= rr.right + 1 && tb.width > 0 };
                 }) };
      });
      neu[w].zurueck = await page.evaluate(async () => {
        document.getElementById('heroStatsMehr').click();
        await new Promise(x => setTimeout(x, 1200));
        return Math.round(document.querySelector('.hero-stats').scrollLeft);
      });
    }
    fehlerAlle.push(...fehler.map(f => 'neu@' + w + ': ' + f));
    await ctx.close();
  }

  const m390 = neu[390];
  const idsGemessen = m390 ? m390.chips.map(c => c.schluessel) : [];
  merke('V1: Vorbedingung - die Chip-Reihe steht mit genau den neun bekannten Chips da',
    !!m390 && idsGemessen.length === ALLE_CHIPS.length &&
    ALLE_CHIPS.every(k => idsGemessen.includes(k)) && new Set(idsGemessen).size === idsGemessen.length,
    { gemessen:idsGemessen, erwartet:ALLE_CHIPS });
  merke('V2: Vorbedingung - .hero-stats bleibt der aeussere Behaelter des Spielerzahl-Abzeichens',
    !!m390 && m390.spielerzahlInReihe === true);

  // ---- 1: Die Zugehoerigkeit ---------------------------------------------------------------------
  const gruppenFehler = BREITEN.filter(w => {
    const x = neu[w];
    return !x || x.gruppen.length !== SOLL_GRUPPEN.length ||
      x.gruppen.some((g, i) => g.schluessel !== SOLL_GRUPPEN[i].schluessel || !g.direktesKind);
  }).map(w => w + 'px:' + (neu[w] ? neu[w].gruppen.map(g => g.schluessel + (g.direktesKind ? '' : '(nicht direkt)')).join(',') : 'keine Messung'));
  merke('1a: genau zwei Gruppen (konto, standort) als direkte Kinder von .hero-stats, bei allen sechs Breiten',
    gruppenFehler.length === 0, gruppenFehler);

  const zuordnungFehler = [];
  BREITEN.forEach(w => {
    const x = neu[w]; if (!x) { zuordnungFehler.push(w + 'px: keine Messung'); return; }
    x.chips.forEach(c => {
      const soll = SOLL_GRUPPEN.find(g => g.chips.includes(c.schluessel));
      if (!soll) zuordnungFehler.push(w + 'px: unbekannter Chip ' + c.schluessel);
      else if (c.gruppe !== soll.schluessel)
        zuordnungFehler.push(w + 'px: ' + c.schluessel + ' liegt in ' + c.gruppe + ' statt in ' + soll.schluessel);
    });
    ALLE_CHIPS.filter(k => !x.chips.some(c => c.schluessel === k))
      .forEach(k => zuordnungFehler.push(w + 'px: Chip ' + k + ' fehlt'));
  });
  merke('1b: jeder Chip liegt in der ausgeschriebenen Gruppe - keiner daneben, keiner vertauscht',
    zuordnungFehler.length === 0, zuordnungFehler.slice(0, 6));

  const titelFehler = BREITEN.flatMap(w => (neu[w] ? neu[w].gruppen : [])
    .filter(g => g.sichtbar && !(g.titelAnzahl === 1 && g.titelSichtbar && g.titel && g.titel.length))
    .map(g => w + 'px ' + g.schluessel + ': ' + g.titelAnzahl + ' Titel, sichtbar ' + g.titelSichtbar + ', Text ' + JSON.stringify(g.titel)));
  merke('1c: jede sichtbare Gruppe traegt genau einen sichtbaren Titel mit Text',
    titelFehler.length === 0, titelFehler.slice(0, 6));
  /* Aus tests/test_kopfzeile_gruppen.js herueber (zusammengefuehrt am 12.09.2026): 1h prueft den
     Kunstfall aktiv, aber nur bei 390 px und nur fuer die Konto-Gruppe. Diese Zeile prueft ihn
     BEILAEUFIG an allen sechs Breiten und fuer jede Gruppe - eine Ueberschrift ueber nichts faellt
     damit auch dann auf, wenn sie aus einem ganz anderen Grund entsteht. */
  const leerFehler = BREITEN.flatMap(w => (neu[w] ? neu[w].gruppen : [])
    .filter(g => g.sichtbar && g.chipsSichtbar === 0)
    .map(g => w + 'px: ' + g.schluessel + ' sichtbar, aber ohne sichtbaren Chip'));
  merke('1i: keine sichtbare Gruppe ohne sichtbaren Chip - bei allen sechs Breiten',
    leerFehler.length === 0, leerFehler.slice(0, 6));

  // ---- 1d/1e: Der Standortwechsel - die Zusage selbst, nicht ihre Beschriftung -------------------
  {
    const { ctx, page, fehler } = await seite(browser, SPIEL_URL, 1400);
    const lies = () => page.evaluate(() => {
      const r = document.querySelector('.hero-stats');
      const karte = document.querySelector('.dash-colony-card.active-base .dash-colony-name-text');
      const werte = {};
      r.querySelectorAll('.hstat-value').forEach(v => { werte[v.id] = (v.textContent || '').trim(); });
      return { werte,
               titel: Object.fromEntries([...r.querySelectorAll('.hstat-gruppe')]
                 .map(g => [g.getAttribute('data-hstat-gruppe'), ((g.querySelector('.hstat-gruppe-titel') || {}).textContent || '').trim()])),
               ortLautUebersicht: karte ? (karte.textContent || '').trim() : null };
    });
    const vorher = await lies();
    const gewechselt = await page.evaluate(async () => {
      const b = document.querySelector('[data-planet-switch="rhea"]');
      if (!b) return false;
      b.click();
      await new Promise(x => setTimeout(x, 1600));
      return true;
    });
    const nachher = gewechselt ? await lies() : null;
    merke('V4: Vorbedingung - der Standort laesst sich wechseln und die Uebersicht nennt beide Namen',
      gewechselt && !!nachher && !!vorher.ortLautUebersicht && !!nachher.ortLautUebersicht &&
      vorher.ortLautUebersicht !== nachher.ortLautUebersicht,
      { vorher: vorher.ortLautUebersicht, nachher: nachher ? nachher.ortLautUebersicht : null });
    merke('1d: der Titel der Standort-Gruppe nennt den aktiven Standort - vor UND nach dem Wechsel',
      !!nachher && vorher.titel.standort === vorher.ortLautUebersicht &&
      nachher.titel.standort === nachher.ortLautUebersicht,
      { vorher:{ titel:vorher.titel.standort, uebersicht:vorher.ortLautUebersicht },
        nachher: nachher ? { titel:nachher.titel.standort, uebersicht:nachher.ortLautUebersicht } : null });
    const geaendert = nachher ? Object.keys(vorher.werte).filter(k => vorher.werte[k] !== nachher.werte[k]) : [];
    const kontoChips = SOLL_GRUPPEN.find(g => g.schluessel === 'konto').chips;
    /* GEMESSEN, nicht als Mindestzahl (Durchsicht 12.09.2026). Hier stand „mindestens zwei
       Standort-Chips springen". Gemessen springen mit diesem Spielstand GENAU DREI - Flotte,
       Angriff, Verteidigung; die Expedition bleibt bei „0/0", weil auf keinem der beiden Standorte
       eine laeuft. Eine Mindestzahl von zwei liess also zu, dass einer der drei einfriert und die
       Pruefung trotzdem gruen bleibt - genau der Fall, gegen den sie gebaut ist. Festgenagelt wird
       deshalb die gemessene Menge; die Expedition steht ausdruecklich NICHT darin, und warum sie
       fehlt, steht hier statt in einer Zahl. */
    const SPRINGEN_MUSS = ['heroFleet', 'heroAttack', 'heroDefense'];
    const fehlen = SPRINGEN_MUSS.filter(k => !geaendert.includes(k));
    const kontoGesprungen = geaendert.filter(k => kontoChips.includes(k));
    const fremd = geaendert.filter(k => !SPRINGEN_MUSS.includes(k) && !kontoChips.includes(k));
    merke('1e: beim Standortwechsel springen genau die drei gemessenen Standort-Chips (Flotte, Angriff, Verteidigung) und KEIN Chip der Konto-Gruppe',
      !!nachher && fehlen.length === 0 && kontoGesprungen.length === 0 && fremd.length === 0,
      { geaendert, nichtGesprungen:fehlen, kontoGesprungen, unerwartet:fremd,
        vorher:vorher.werte, nachher: nachher ? nachher.werte : null });
    merke('1e2: und die Expedition bleibt stehen, weil sie auf beiden Standorten „0/0" ist - die Vorbedingung fuer 1e',
      !!nachher && vorher.werte.heroExpedition === '0/0' && nachher.werte.heroExpedition === '0/0',
      { vorher:vorher.werte.heroExpedition, nachher: nachher ? nachher.werte.heroExpedition : null });
    merke('1f: der Titel der Konto-Gruppe bleibt beim Wechsel derselbe',
      !!nachher && vorher.titel.konto === nachher.titel.konto,
      { vorher:vorher.titel.konto, nachher: nachher ? nachher.titel.konto : null });
    /* 1k: DER VOLLE NAME GEHT NICHT VERLOREN (Durchsicht 12.09.2026). Vor UI-6 stand der
       Standortname vollstaendig im Flotten-Chip; seither traegt ihn der Gruppentitel - und der ist
       gedeckelt. Gemessen in der Hausschrift: „Heimatbasis" 80 px, ein typischer 24-Zeichen-Name
       173 px, „Mond von Kepler-7b" 128 px, der Extremfall 24x W 253 px, mit Mond-Praefix 316 px.
       Eine Deckelung, die JEDEN Namen traegt, gibt es also nicht (die Wischflaeche ist am Handy
       328 px breit). Geprueft wird deshalb die ZUSAGE, nicht die Pixelzahl: Der vollstaendige Name
       steht im title-Attribut, und zwar derselbe, den die Uebersicht nennt - auch nach einem
       Standortwechsel, sonst waere er beim naechsten Wechsel eine Behauptung von gestern. */
    const titelAttr = await page.evaluate(() => {
      const t = document.getElementById('heroStatsOrt');
      return t ? (t.getAttribute('title') || '') : null;
    });
    merke('1k: der vollstaendige Standortname steht im title des Gruppentitels - auch nach dem Wechsel',
      !!nachher && typeof titelAttr === 'string' && !!nachher.ortLautUebersicht &&
      titelAttr.indexOf(nachher.ortLautUebersicht) === 0,
      { titelAttribut:titelAttr, uebersicht: nachher ? nachher.ortLautUebersicht : null,
        angezeigt: nachher ? nachher.titel.standort : null });
    fehlerAlle.push(...fehler.map(f => 'Wechsel: ' + f));
    await ctx.close();
  }

  // ---- 1g/1h: Der neunte Chip - beide Faelle, und die leere Gruppe -------------------------------
  {
    const { ctx, page, fehler } = await seite(browser, SPIEL_URL, 390,
      { name:'GameGeeeeek', admin:true, online:12, registriert:340 });
    await page.waitForTimeout(1500);
    const chef = await page.evaluate(MESSEN);
    fehlerAlle.push(...fehler.map(f => 'Betreiber: ' + f));
    const kontoChef = chef && chef.gruppen.find(g => g.schluessel === 'konto');
    const kontoNormal = m390 && m390.gruppen.find(g => g.schluessel === 'konto');
    merke('1g: der neunte Chip ist nur fuer das Betreiberkonto da - mit ihm fuenf Chips in der Konto-Gruppe, ohne ihn vier, und der Titel steht in beiden Faellen',
      !!kontoChef && !!kontoNormal && kontoChef.chipsSichtbar === 5 && kontoNormal.chipsSichtbar === 4 &&
      kontoChef.titelSichtbar && kontoNormal.titelSichtbar,
      { betreiber: kontoChef ? kontoChef.chipsSichtbar : null, normal: kontoNormal ? kontoNormal.chipsSichtbar : null,
        online: chef ? (chef.chips.find(c => c.schluessel === 'heroOnline') || {}).text : null });
    await ctx.close();
  }
  {
    // Kunstfall: JEDER Chip der Konto-Gruppe verborgen. Dann darf weder die Flaeche noch die
    // Ueberschrift stehenbleiben - eine Ueberschrift ueber nichts ist genau der Fehler, vor dem
    // der Vertrag warnt. Gemessen wird nach dem naechsten Takt, nicht sofort.
    const { ctx, page, fehler } = await seite(browser, SPIEL_URL, 390);
    const leer = await page.evaluate(async (chips) => {
      const r = document.querySelector('.hero-stats');
      [...r.querySelectorAll('.hstat')].forEach(c => {
        const v = c.querySelector('.hstat-value');
        if (v && chips.includes(v.id)) c.style.display = 'none';
      });
      window.dispatchEvent(new Event('resize'));
      await new Promise(x => setTimeout(x, 1800));
      const g = r.querySelector('.hstat-gruppe[data-hstat-gruppe="konto"]');
      const t = g ? g.querySelector('.hstat-gruppe-titel') : null;
      return { gruppeAnzeige: g ? getComputedStyle(g).display : null,
               gruppeBreite: g ? Math.round(g.getBoundingClientRect().width) : null,
               titelBreite: t ? Math.round(t.getBoundingClientRect().width) : null };
    }, SOLL_GRUPPEN.find(g => g.schluessel === 'konto').chips);
    merke('1h: eine Gruppe ohne sichtbaren Chip verschwindet samt Titel',
      leer.gruppeAnzeige === 'none' && leer.gruppeBreite === 0 && leer.titelBreite === 0, leer);
    fehlerAlle.push(...fehler.map(f => 'leere Gruppe: ' + f));
    await ctx.close();
  }

  // ---- 2: Die Kopfhoehe --------------------------------------------------------------------------
  const hoeheFehler = BREITEN.filter(w => !neu[w] || !alt[w] || neu[w].kopfhoehe > alt[w].kopfhoehe)
    .map(w => w + 'px: neu ' + (neu[w] ? neu[w].kopfhoehe : '?') + ' gegen ' + (alt[w] ? alt[w].kopfhoehe : '?'));
  merke('2a: die Kopfzeile ist bei keiner der sechs Breiten hoeher als am Vergleichsstand',
    hoeheFehler.length === 0,
    { fehler:hoeheFehler, gemessen: BREITEN.map(w => w + ':' + (neu[w] ? neu[w].kopfhoehe : '?') + '/' + (alt[w] ? alt[w].kopfhoehe : '?')).join(' ') });
  /* 2b misst die UNTERKANTE der Kopfzeile, nicht die Oberkante der Reiterleiste - und das ist
     gemessen, nicht Geschmack: Zwischen beiden liegt die Zeile mit dem Speicherstand (`#loadstate`),
     und die bricht je nach Text auf zwei Zeilen um. Gemessen an DERSELBEN Datei, vier Laeufe bei
     390 px: Reiterleiste 563/563/563/577 px - 14 px Wackler ohne jeden Bezug zur Chip-Reihe. Eine
     Pruefung darauf waere zufaellig rot. Die Unterkante der Kopfzeile lag in allen vier Laeufen
     bei 227 px und ist genau das, was die Chip-Reihe nach unten schiebt. */
  const unterkanteFehler = BREITEN.filter(w => !neu[w] || !alt[w] || neu[w].kopfUnten === null || alt[w].kopfUnten === null || neu[w].kopfUnten > alt[w].kopfUnten)
    .map(w => w + 'px: neu ' + (neu[w] ? neu[w].kopfUnten : '?') + ' gegen ' + (alt[w] ? alt[w].kopfUnten : '?'));
  merke('2b: die Unterkante der Kopfzeile liegt bei keiner Breite tiefer als am Vergleichsstand',
    unterkanteFehler.length === 0,
    { fehler:unterkanteFehler, gemessen: BREITEN.map(w => w + ':' + (neu[w] ? neu[w].kopfUnten : '?') + '/' + (alt[w] ? alt[w].kopfUnten : '?')).join(' ') });

  // ---- 3: Die Lesbarkeit -------------------------------------------------------------------------
  const sichtFehler = BREITEN.filter(w => {
    const x = neu[w]; if (!x) return true;
    const versteckt = x.chips.filter(c => c.sichtbar && !c.ganzImBild);
    return versteckt.length > 0 && !x.knopfSichtbar;
  }).map(w => w + 'px: ' + (neu[w] ? neu[w].chips.filter(c => c.sichtbar && !c.ganzImBild).map(c => c.schluessel).join(',') + ' angeschnitten, kein Hinweis' : 'keine Messung'));
  merke('3a: bei jeder Breite steht entweder jeder Chip waagerecht ganz im Bild oder der Hinweis-Knopf ist sichtbar',
    sichtFehler.length === 0,
    { fehler:sichtFehler, gemessen: BREITEN.map(w => w + ':' + (neu[w] ? (neu[w].chips.filter(c => c.sichtbar && !c.ganzImBild).length + 'ab/' + (neu[w].knopfSichtbar ? 'Hinweis' : 'kein Hinweis')) : '?')).join(' ') });
  /* 3a2 IST DIE HAELFTE, DIE GEFEHLT HAT (Durchsicht 12.09.2026). Waagerecht kann der Spieler das
     Fehlende erwischen - dafuer ist der Hinweis-Knopf da. SENKRECHT gibt es keinen Ausweg: Die
     Kopfzeile schneidet mit `overflow:hidden` ab, und ab 1001 px hat sie eine FESTE Hoehe von
     190 px. Ein Chip, der dort unten heraussteht, ist schlicht weg - es gibt keine Geste, die ihn
     holt. Deshalb kennt diese Pruefung auch kein „oder der Knopf ist sichtbar". */
  const senkFehler = BREITEN.flatMap(w => {
    const x = neu[w]; if (!x) return [w + 'px: keine Messung'];
    return x.chips.filter(c => c.sichtbar && !(c.senkrechtInReihe && c.senkrechtImKopf))
      .map(c => w + 'px: ' + c.schluessel + ' (Reihe ' + c.senkrechtInReihe + ', Kopf ' + c.senkrechtImKopf + ', y=' + c.oben + ')');
  });
  merke('3a2: kein sichtbarer Chip wird senkrecht abgeschnitten - weder von der Reihe noch von der Kopfzeile',
    senkFehler.length === 0, senkFehler.slice(0, 6));
  const behauptungFehler = BREITEN.filter(w => {
    const x = neu[w]; if (!x) return true;
    const alleDrin = x.chips.filter(c => c.sichtbar).every(c => c.ganzImBild) && x.ueberlauf <= 2;
    return alleDrin && x.knopfSichtbar;
  }).map(w => w + 'px: Hinweis ohne Ueberlauf (Ueberlauf ' + (neu[w] ? neu[w].ueberlauf : '?') + ')');
  merke('3b: passt alles ins Bild, steht der Hinweis-Knopf NICHT da',
    behauptungFehler.length === 0, behauptungFehler);
  const gewischt = BREITEN.filter(w => neu[w] && neu[w].knopfSichtbar);
  const endeFehler = gewischt.filter(w => !neu[w].ende || !neu[w].ende.letzterGanzImBild ||
      !neu[w].ende.knopfSichtbar || !/chevron-left/.test(neu[w].ende.icon))
    .map(w => w + 'px: ' + JSON.stringify(neu[w].ende));
  merke('3c: ans Ende gewischt steht der letzte Chip ganz im Bild und der Hinweis zeigt zurueck',
    gewischt.length > 0 && endeFehler.length === 0, { breiten:gewischt, fehler:endeFehler });
  const zurueckFehler = gewischt.filter(w => !(neu[w].zurueck <= 2)).map(w => w + 'px: scrollLeft ' + neu[w].zurueck);
  merke('3d: ein Klick auf den Hinweis fuehrt wieder an den Anfang (keine Sackgasse)',
    gewischt.length > 0 && zurueckFehler.length === 0, zurueckFehler);

  /* ---- 3f: der Gruppentitel wischt nicht mit ----------------------------------------------------
     WARUM (Durchsicht 12.09.2026): Zusage B lautet „die Zugehoerigkeit ist ohne Tooltip erkennbar".
     Gemessen galt das nur in der AUSGANGSSTELLUNG. Bei 360 und 390 px stand der Standort-Titel
     schon bei Wischstand 0 ausserhalb des Bildes, und am Ende der Reihe - also genau dort, wohin
     der Hinweis-Knopf fuehrt - war auch der Konto-Titel weg: vier Zahlen ohne jede Beschriftung.
     Gemessen VOR der Behebung (Standort-Titel im Bild, Endstellung): 360 nein, 390 nein, 700 nein,
     1000 ja, 1400 ja, 1500 ja. Danach: ueberall ja.
     GEPRUEFT WIRD DIE REGEL, nicht die Stellung: Der Titel JEDER Gruppe, die am Ende der Reihe noch
     zu sehen ist, muss dann auch im Bild stehen. Eine Gruppe, die ganz herausgewischt ist, braucht
     ihren Titel nicht - sie steht ja auch nicht da. */
  const wischFehler = gewischt.flatMap(w => {
    const e = neu[w] && neu[w].ende;
    if (!e || !e.gruppen) return [w + 'px: keine Endmessung'];
    return e.gruppen.filter(g => g.imBild && !g.titelImBild)
      .map(g => w + 'px: Gruppe ' + g.schluessel + ' ist am Ende sichtbar, ihr Titel aber nicht');
  });
  merke('3f: ans Ende gewischt steht der Titel jeder noch sichtbaren Gruppe im Bild',
    gewischt.length > 0 && wischFehler.length === 0,
    { breiten:gewischt, fehler:wischFehler,
      gemessen: gewischt.map(w => w + ':' + (neu[w].ende && neu[w].ende.gruppen ? neu[w].ende.gruppen.map(g => g.schluessel + (g.imBild ? '' : '(weg)') + '=' + g.titelImBild).join(',') : '?')).join(' ') });
  /* Und die Ausgangsstellung, die zweite gemessene Wischstellung: Was da ist, ist beschriftet. */
  const startFehler = BREITEN.flatMap(w => {
    const x = neu[w]; if (!x) return [w + 'px: keine Messung'];
    return x.gruppen.filter(g => g.sichtbar && g.breite > 0 && !g.titelSichtbar)
      .map(g => w + 'px: ' + g.schluessel + ' ohne sichtbaren Titel in der Ausgangsstellung');
  });
  merke('3g: und in der Ausgangsstellung traegt jede sichtbare Gruppe ihren Titel',
    startFehler.length === 0, startFehler.slice(0, 6));

  /* ---- 3e: die Breiten ab 1001 px haben eine EIGENE Pruefung -------------------------------------
     WARUM (Durchsicht 12.09.2026): Genau dort sitzt die neue Mechanik - der ausfuehrliche Kopf mit
     fester Bannerhoehe bricht die Reihe zwischen den Gruppen um. 3a bis 3d koennen das nicht
     bemerken: Waagerecht ist dann alles im Bild, der Hinweis-Knopf verborgen, und beide Pruefungen
     sind per Konstruktion gruen. Gepruefte REGEL, keine Momentaufnahme:
       (1) Es gibt wirklich mehr als eine Chip-Zeile - sonst haette der Umbruch nicht stattgefunden
           und die Reihe liefe wie frueher waagerecht heraus.
       (2) Keine Gruppe ist auf zwei Zeilen zerrissen. Umbrochen wird ZWISCHEN den Gruppen; eine
           Gruppe, die in der Mitte bricht, macht ihren Titel zur Behauptung.
       (3) Mit diesem Spielstand (Standort „Heimatbasis") ist die Reihe vollstaendig im Bild und der
           Hinweis verborgen. Gemessen: Standort-Gruppe 660 px gegen 706 px Inhaltsbreite bei
           1001 px Fenster. Das gilt NICHT fuer jeden Spielstand - ein 24-Zeichen-Standortname
           schiebt die Gruppe auf 735 px, dann laeuft die Reihe auch hier ueber. Genau dafuer sind
           3a/3a2 da, und der Knopf haengt seit dieser Durchsicht ausserhalb des Umbruchflusses. */
  const abWrap = BREITEN.filter(w => w >= 1001);
  const wrapFehler = abWrap.flatMap(w => {
    const x = neu[w];
    if (!x) return [w + 'px: keine Messung'];
    const f = [];
    if (!(x.zeilenOben.length >= 2)) f.push(w + 'px: nur ' + x.zeilenOben.length + ' Chip-Zeile(n) - kein Umbruch');
    for (const g of SOLL_GRUPPEN){
      const oben = [...new Set(x.chips.filter(c => c.sichtbar && c.gruppe === g.schluessel).map(c => c.oben))];
      if (oben.length > 1) f.push(w + 'px: Gruppe ' + g.schluessel + ' ist auf ' + oben.length + ' Zeilen zerrissen (' + oben.join(',') + ')');
    }
    if (x.ueberlauf > 2) f.push(w + 'px: Ueberlauf ' + x.ueberlauf + ' trotz Umbruch');
    if (x.knopfSichtbar) f.push(w + 'px: Hinweis-Knopf sichtbar, obwohl die Reihe umbricht und passt');
    return f;
  });
  merke('3e: ab 1001 px bricht die Reihe zwischen den Gruppen um - mehr als eine Zeile, keine Gruppe zerrissen, nichts mehr ueber der Kante',
    abWrap.length > 0 && wrapFehler.length === 0,
    { fehler:wrapFehler.slice(0, 6),
      gemessen: abWrap.map(w => w + ':' + (neu[w] ? neu[w].zeilenOben.join('/') + ' ueberlauf' + neu[w].ueberlauf : '?')).join(' ') });

  /* ---- 3h: der Hinweis-Knopf steht AUSSERHALB des Umbruchflusses -------------------------------
     WARUM EIN EIGENER SPIELSTAND (Durchsicht 12.09.2026): Mit dem Spielstand oben passt die Reihe
     ab 1001 px vollstaendig ins Bild, der Knopf ist dort verborgen - der Fehler, um den es geht,
     ist damit gar nicht ausloesbar. Er entsteht, sobald EINE Gruppe allein breiter ist als die
     Flaeche: Dann bleibt trotz Umbruch ein Ueberlauf, der Knopf erscheint, und als Flex-Kind der
     umbrechenden Reihe bekam er eine EIGENE dritte Zeile. GEMESSEN am Zwischenstand bei 1001 px
     (Standort-Gruppe 741 px gegen 738 px Flaeche): Chips bei y=35 und y=78, der Knopf allein bei
     y=121, 16 px hoch, ganz links bei x=148 - losgeloest von der Reihe, die er meint.
     Dieser Spielstand stellt genau das her: eine grosse Flotte AUF DER KOLONIE, die Kolonie aktiv,
     und ein 24-Zeichen-Name im Gruppentitel. Gepruefte Regel: Der Knopf deckt die GANZE Reihe ab
     (oben wie unten) und klebt rechts - nicht eine eigene Zeile links darunter. */
  {
    const WEIT = JSON.stringify(Object.assign({}, ruhigeUhren(), {
      tutorialSeen: true, newbieWelcomeSeen: true,
      seenTabHints: { basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                      galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1, sammlung:1 },
      resources: { energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:2e4, forschungspunkte:3e4 },
      buildings: { solar:22, mine:20, kristallmine:18, labor:14, lager:16, werft:14, turm:12 },
      research: { rkampf:9 },
      fleet: { ships:1, missions:[] },
      discovered: { rhea:true },
      colonies: { rhea: { buildings:{ solar:3, mine:2, habitat:1, turm:3 },
                          fleet:{ ships:98765, cruisers:43210, jaeger:900, bomber:260, missions:[] } } },
      colonyNames: { rhea: 'Prometheus-Ankerwelt XII' },
      activeBasePlanet: 'rhea', player: { id:'u', name:'AdmiralX', avatarKey:null },
      battleStats: { wins:9, losses:2 }, battlePoints: KAMPFPUNKTE, xp: 260000, credits: 180000,
      buffs: [], lastTick: Date.now(), colonyNotes: {}, modules: {}, shipModules: {},
      equippedShipModules: {}, moduleFragments: 0
    }));
    const ctx = await browser.newContext({ viewport:{ width:1001, height:1000 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
    await versionAbfangen(page);
    await page.route('**/api/**', backend({ 'kepler7-save-v3': WEIT }, { name:'AdmiralX' }));
    await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
    await page.goto(SPIEL_URL);
    await page.waitForTimeout(2800);
    await page.evaluate(ids => ids.forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }), OVERLAYS);
    await page.waitForTimeout(700);
    const eng = await page.evaluate(() => {
      const r = document.querySelector('.hero-stats');
      const k = document.getElementById('heroStatsMehr');
      if (!r) return null;
      const rr = r.getBoundingClientRect();
      const sicht = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
      const chips = [...r.querySelectorAll('.hstat')].filter(sicht).map(c => c.getBoundingClientRect());
      const kb = k && !k.hidden && sicht(k) ? k.getBoundingClientRect() : null;
      return {
        ueberlauf: r.scrollWidth - r.clientWidth,
        knopfSichtbar: !!kb,
        knopfImFluss: !!k && !!k.closest('.hero-stats'),
        zeilen: [...new Set(chips.map(c => Math.round(c.top)))].sort((a, b) => a - b),
        chipOben: chips.length ? Math.round(Math.min(...chips.map(c => c.top))) : null,
        chipUnten: chips.length ? Math.round(Math.max(...chips.map(c => c.bottom))) : null,
        knopfOben: kb ? Math.round(kb.top) : null,
        knopfUnten: kb ? Math.round(kb.bottom) : null,
        knopfLinks: kb ? Math.round(kb.left) : null,
        reiheLinks: Math.round(rr.left), reiheRechts: Math.round(rr.right),
        kopfhoehe: Math.round(document.querySelector('.hero').getBoundingClientRect().height)
      };
    });
    merke('V7: Vorbedingung - dieser Spielstand erzeugt bei 1001 px wirklich einen Ueberlauf trotz Umbruch (sonst prueft 3h nichts)',
      !!eng && eng.ueberlauf > 2 && eng.knopfSichtbar === true && eng.zeilen.length >= 2, eng);
    /* `knopfSichtbar` gehoert IN die Bedingung, nicht nur in die Vorbedingung: Gaebe es den Knopf
       gar nicht, waere „haengt nicht in der Reihe" trivial wahr - die Pruefung waere blind genau
       in dem Fall, den sie am dringendsten melden muesste. */
    merke('3h: der Hinweis-Knopf ist da und haengt nicht IN der umbrechenden Reihe - er kann dort keine Zeile mehr aufmachen',
      !!eng && eng.knopfSichtbar === true && eng.knopfImFluss === false,
      { knopfSichtbar: eng && eng.knopfSichtbar, knopfImFluss: eng && eng.knopfImFluss });
    merke('3h2: er deckt die ganze Reihe ab (keine eigene Zeile darunter) und klebt rechts',
      !!eng && eng.knopfOben <= eng.chipOben + 1 && eng.knopfUnten >= eng.chipUnten - 1 &&
      eng.knopfLinks > (eng.reiheLinks + eng.reiheRechts) / 2, eng);
    fehlerAlle.push(...fehler.map(f => 'eng@1001: ' + f));
    await ctx.close();
  }

  // ---- 4: Ein Format je Groesse, an ALLEN Anzeigestellen ------------------------------------------
  {
    const { ctx, page, fehler } = await seite(browser, SPIEL_URL, 1400);
    const reiter = async t => {
      await page.evaluate(x => { const b = document.querySelector('.tab-btn[data-tab="' + x + '"]'); if (b) b.click(); }, t);
      await page.waitForTimeout(900);
    };
    await reiter('verteidigung');
    await reiter('flotte');
    await page.evaluate(() => { const b = document.querySelector('.fleet-subtab[data-fleet-subtab="flotte"]'); if (b) b.click(); });
    await page.waitForTimeout(900);
    await reiter('punkte');
    await reiter('fortschritt');
    await reiter('galaxie');
    await page.waitForTimeout(900);

    const s = await page.evaluate(() => {
      const txt = id => { const e = document.getElementById(id); return e ? (e.textContent || '').trim() : null; };
      /* Die beiden Kachelkaesten schreiben in VERSCHIEDENER Reihenfolge: die Imperium-Uebersicht
         Beschriftung-dann-Wert, die Kennzahl-Kacheln Wert-dann-Beschriftung. Wer nur eine
         Richtung sucht, liest den Wert der NACHBARkachel. Deshalb ausdruecklich beide. */
      const ausKasten = (boxId, wort, wertZuerst) => {
        const box = document.getElementById(boxId);
        if (!box) return null;
        const t = (box.textContent || '').replace(/\s+/g, ' ');
        const m = wertZuerst ? t.match(new RegExp('([0-9][0-9.,]*[kM]?)\\s*' + wort))
                             : t.match(new RegExp(wort + '\\s*([0-9][0-9.,]*[kM]?)'));
        return m ? m[1] : null;
      };
      const leiste = ((document.getElementById('fleetStickyBar') || {}).textContent || '').replace(/\s+/g, ' ');
      const mLeiste = leiste.match(/Angriff\s*([0-9][0-9.,]*[kM]?)/);
      const kolonie = [...document.querySelectorAll('.dash-colony-stats')].map(el => ({
        zeile: (el.textContent || '').replace(/\s+/g, ' ').trim(),
        titel: el.getAttribute('title') || '' }));
      return {
        atk: { Chip: txt('heroAttack'), Zentralzahl: txt('attackCentralValue'),
               Klebeleiste: mLeiste ? mLeiste[1] : null,
               ImperiumUebersicht: ausKasten('empireOverviewBox', 'Angriffskraft', false) },
        def: { Chip: txt('heroDefense'), Zentralzahl: txt('defenseCentralValue') },
        bp:  { Chip: txt('heroBP'), Profilzeile: txt('profileBP'),
               Kennzahlkachel: ausKasten('statsTilesBox', 'Kampfpunkte', true) },
        reichVerteidigung: ausKasten('empireOverviewBox', 'Verteidigung', false),
        aufriss: ((document.getElementById('scoreBreakdownBox') || {}).textContent || '').replace(/\s+/g, ' '),
        kolonie
      };
    });
    fehlerAlle.push(...fehler.map(f => 'Format: ' + f));

    const gruppen = { atk:'Angriffskraft', def:'Verteidigungspunkte', bp:'Kampfpunkte' };
    const fehlend = Object.keys(gruppen).flatMap(k => Object.entries(s[k]).filter(([, v]) => !v || !v.length).map(([n]) => k + '.' + n));
    merke('V5: Vorbedingung - alle gemessenen Anzeigestellen sind wirklich gerendert',
      fehlend.length === 0, { fehlend, gemessen:{ atk:s.atk, def:s.def, bp:s.bp } });
    const zuKlein = Object.keys(gruppen).flatMap(k => Object.entries(s[k])
      .filter(([, v]) => !(zahlWert(v) >= 1000)).map(([n, v]) => k + '.' + n + '=' + v));
    merke('V6: Vorbedingung - alle drei Groessen liegen ueber 1000 (darunter waere die Formatfrage gegenstandslos)',
      zuKlein.length === 0, zuKlein);

    for (const [k, name] of Object.entries(gruppen)){
      const paare = Object.entries(s[k]);
      const werte = paare.map(([, v]) => v);
      const gleich = new Set(werte).size === 1;
      const form = paare.filter(([, v]) => !KURZSCHREIBWEISE.test(String(v))).map(([n, v]) => n + '=' + v);
      merke('4' + (k === 'atk' ? 'a' : k === 'def' ? 'b' : 'c') + ': ' + name + ' steht an allen ' +
            werte.length + ' Anzeigestellen zeichengleich und in der Kurzschreibweise des Hauses',
        gleich && form.length === 0, { werte:s[k], nichtKurz:form });
    }
    merke('4d: der Kampfpunkte-Chip zeigt den eingetragenen Erwartungswert „' + KAMPFPUNKTE_ERWARTET + '"',
      s.bp.Chip === KAMPFPUNKTE_ERWARTET, { gemessen:s.bp.Chip, erwartet:KAMPFPUNKTE_ERWARTET, spielstand:KAMPFPUNKTE });

    /* DIE IMPERIUM-UEBERSICHT IST KEINE ZWEITE ANZEIGESTELLE DERSELBEN GROESSE, und das ist
       gemessen: Ihre Kachel „Verteidigung" ruft defensePower() OHNE Standort - die Funktion
       summiert dann ueber allBuildingSetsWithPlanet(), also ueber alle Standorte. Mit der zweiten
       Kolonie dieses Spielstands steht dort 22.2k gegen 22.1k im Chip (22139 am Standort plus 63
       auf der Kolonie). Wer beide Zahlen gleichsetzt, prueft eine Regel, die es nicht gibt - und
       merkt es nur deshalb nicht, weil ein Spielstand mit EINEM Standort beide Wege gleich
       aussehen laesst. Gefordert ist hier deshalb die Schreibweise, nicht die Gleichheit; die
       Summe darf den Standortwert nicht unterschreiten. (Die Kachel „Angriffskraft" daneben ist
       ein anderer Fall: attackPower() ohne Flotte rechnet die Flotte des aktiven Standorts, dort
       gilt die Gleichheit und 4a verlangt sie.) */
    merke('4e: die Imperium-Uebersicht nennt die imperiumsweite Verteidigungssumme in derselben Kurzschreibweise',
      KURZSCHREIBWEISE.test(String(s.reichVerteidigung)) &&
      zahlWert(s.reichVerteidigung) >= zahlWert(s.def.Chip),
      { reich:s.reichVerteidigung, standort:s.def.Chip });
    // Die bewusste Ausnahme: Der Punktestand-Aufriss zeigt die RECHNUNG, nicht den Standwert.
    // Gerundet stuende dort „1.23M x 3 Punkte = 3.70M", und das ergibt nachgerechnet 3.69M - eine
    // Rechnung, die nicht aufgeht, waere schlimmer als zwei Schreibweisen.
    merke('4f: der Punktestand-Aufriss bleibt bewusst exakt, damit seine Rechnung aufgeht',
      s.aufriss.includes(String(KAMPFPUNKTE)) && s.aufriss.includes(String(KAMPFPUNKTE * 3)),
      { enthaeltKampfpunkte: s.aufriss.includes(String(KAMPFPUNKTE)),
        enthaeltProdukt: s.aufriss.includes(String(KAMPFPUNKTE * 3)),
        ausschnitt: s.aufriss.slice(0, 160) });
    // Tooltip und Zeile derselben Standort-Karte nannten dieselben zwei Zahlen in verschiedenen
    // Schreibweisen - der Fall, den man beim Suchen der Anzeigestellen am leichtesten uebersieht.
    const kolonieFehler = s.kolonie.filter(k => {
      const zahlen = (k.zeile.match(/[0-9][0-9.,]*[kM]?/g) || []);
      return zahlen.length < 2 || !zahlen.every(z => k.titel.includes(z));
    }).map(k => k.zeile + ' <-> ' + k.titel);
    merke('4g: in der Standortliste stehen dieselben Zahlen in Zeile und Tooltip',
      s.kolonie.length > 0 && kolonieFehler.length === 0, { karten:s.kolonie.length, fehler:kolonieFehler.slice(0, 3) });

    /* 4i: DIE NPC-ZIELLISTE IM GALAXIE-REITER (Durchsicht 12.09.2026). Sie war die groesste der
       uebersehenen Anzeigestellen: dieselbe eigene Angriffskraft, die der Kopf-Chip gerundet
       zeigt, stand hier roh - und gleich daneben die gegnerische Verteidigung ebenfalls roh,
       obwohl die Flottenwahl-Vorschau (npcVorschauHtml) BEIDE Werte aus DERSELBEN Funktion
       (npcKampfLage) laengst gerundet zeigt. Gemessen am Zwischenstand: 13.7k/5.0k dort gegen
       13688/4960 hier.
       Gepruefte Regel: JEDE Zahl dieser Zeile ist eine gueltige Haus-Kurzschreibweise. Eine
       Rohzahl mit vier Ziffern kann diese Form nie annehmen. Die Vorbedingung dazu wird
       mitgemessen - liegen alle Werte unter 1000, sind beide Schreibweisen gleich und die
       Pruefung waere blind. */
    const npc = await page.evaluate(() => {
      const zeilen = [...document.querySelectorAll('.bmeta')]
        .map(e => (e.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(t => /Gegner-Verteidigungspunkte:/.test(t) && /Deine Angriffskraft:/.test(t));
      return zeilen.map(t => {
        const d = t.match(/Gegner-Verteidigungspunkte: ([0-9][0-9.,]*[kM]?)/);
        const a = t.match(/Deine Angriffskraft: ([0-9][0-9.,]*[kM]?)/);
        return { zeile:t, def: d ? d[1] : null, atk: a ? a[1] : null };
      });
    });
    const npcWerte = npc.flatMap(z => [z.def, z.atk]);
    merke('V8: Vorbedingung - die NPC-Zielliste steht da, und je Seite liegt mindestens ein Wert ueber 1000',
      npc.length > 0 && npc.every(z => z.def && z.atk) &&
      npc.some(z => zahlWert(z.def) >= 1000) && npc.some(z => zahlWert(z.atk) >= 1000),
      { zeilen:npc.length, beispiel: npc[0] ? npc[0].zeile : null,
        groessteVerteidigung: npc.length ? Math.max(...npc.map(z => zahlWert(z.def) || 0)) : null,
        groessteAngriffskraft: npc.length ? Math.max(...npc.map(z => zahlWert(z.atk) || 0)) : null });
    const npcRoh = npc.filter(z => !KURZSCHREIBWEISE.test(String(z.def)) || !KURZSCHREIBWEISE.test(String(z.atk)))
      .map(z => z.zeile);
    merke('4i: in der NPC-Zielliste stehen eigene Angriffskraft UND gegnerische Verteidigung in der Kurzschreibweise des Hauses',
      npc.length > 0 && npcRoh.length === 0, { zeilen:npc.length, roh:npcRoh.slice(0, 3) });
    await ctx.close();
  }

  // ---- 4h: die eine Anzeigestelle, die im Browser nicht erreichbar ist ----------------------------
  // Die Ueberfall-Meldung erscheint erst, wenn der Scanner eine anfliegende Flotte meldet. Der
  // Anker wird deshalb im Quelltext gemessen - und VOR der Benutzung auf Existenz geprueft, damit
  // eine umbenannte Meldung nicht als bestanden durchgeht.
  {
    const quelle = fs.readFileSync(SPIELDATEI, 'utf8');
    const ANKER = 'Verteidigungspunkte dort: ';
    const treffer = quelle.split(ANKER).length - 1;
    const stelle = treffer === 1 ? quelle.substr(quelle.indexOf(ANKER), 80) : '';
    merke('4h: die Ueberfall-Meldung nennt die Verteidigungspunkte in derselben Schreibweise',
      treffer === 1 && /fmt\(defensePower\(/.test(stelle),
      { anker:ANKER, treffer, stelle });
  }

  /* ---- 4j: die Anzeigestellen, die im Browser nicht ohne Weiteres erreichbar sind -------------
     Der Kasten „Markiertes Ziel" braucht ein aus einem Spionagebericht markiertes Ziel, die sechs
     Protokollzeilen einen wirklich losgeschickten Auftrag. Beide werden deshalb im QUELLTEXT
     gemessen - und wie bei 4h wird JEDER Anker VOR der Benutzung gezaehlt: Steht er nicht genau
     einmal da, faellt die Pruefung, statt eine umbenannte Stelle stillschweigend durchzulassen.
     Alle sieben Stellen zeigen eine LIVE gerechnete eigene Angriffskraft - dieselbe Groesse wie
     der Kopf-Chip, nur fuer die jeweils losgeschickte Flotte. Sie liefen roh, waehrend die
     Ueberfall-Meldung daneben (4h) seit UI-6 ueber fmt() laeuft; zwei Schreibweisen in derselben
     Protokollspalte sind genau die Fehlerklasse, um die es hier geht. */
  {
    const quelle = fs.readFileSync(SPIELDATEI, 'utf8');
    const STELLEN = [
      ['Kasten „Markiertes Ziel" im Galaxie-Reiter', 'angegriffen · Angriffskraft ${'],
      ['Protokoll: Piratenflotte abfangen',          "' ab (Angriffskraft '+"],
      ['Protokoll: Leerenriss',                      "' (Angriffskraft '+"],
      ['Protokoll: Weltboss',                        "den '+worldBossName(b.level)+' an (Angriffskraft '+"],
      ['Protokoll: NPC-Angriff',                     "gestartet (Angriffskraft '+"],
      ['Protokoll: Piraten-Versteck',                "pirateLairName(stage)+' an (Angriffskraft '+"],
      ['Protokoll: Expeditions-Eskorte',             "(Kampfkraft '+"]
    ];
    const fehlerStellen = [];
    for (const [name, anker] of STELLEN){
      const treffer = quelle.split(anker).length - 1;
      if (treffer !== 1){ fehlerStellen.push(name + ': Anker ' + treffer + 'x gefunden (erwartet 1)'); continue; }
      const stelle = quelle.substr(quelle.indexOf(anker), anker.length + 40);
      if (!/fmt\(/.test(stelle)) fehlerStellen.push(name + ': laeuft roh - ' + stelle.slice(0, 70));
    }
    merke('4j: die sieben Anzeigestellen ausserhalb des Browsers nennen die Angriffskraft ueber fmt()',
      fehlerStellen.length === 0, fehlerStellen);
  }

  merke('J1: keine Skriptfehler auf irgendeiner der gemessenen Seiten', fehlerAlle.length === 0, fehlerAlle.slice(0, 3));

  await browser.close();
  aufraeumenVergleich();

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false);
    const fehlend2 = soll.filter(n => ergebnis[n] !== false);
    const unerwartet = gefallen.filter(n => soll.indexOf(n) < 0);
    if (fehlend2.length) console.log('FAIL - Gegenprobe unvollstaendig: ' + fehlend2.join(' ') + ' blieben gruen');
    else if (unerwartet.length) console.log('FAIL - Gegenprobe UEBERZAEHLIG: ' + unerwartet.join(' ') + ' fiel zusaetzlich');
    else console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' gefallen (' + gefallen.map(n => n + '=rot').join(' ') + ')');
    process.exit((fehlend2.length || unerwartet.length) ? 1 : 0);
  }
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  aufraeumenVergleich();
  console.log('FAIL - Testlauf abgebrochen: ' + e.message);
  process.exit(1);
});
