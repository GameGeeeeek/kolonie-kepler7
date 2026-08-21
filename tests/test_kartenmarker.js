// Marker in der geöffneten Systemebene liegen nicht auf den Planeten (Etappe KB-13).
//
// DER VORFALL, DEN DIESER TEST FESTHÄLT
// -------------------------------------
// KB-12 hat die Planetenbahnen am schmalen Kasten enger und runder gelegt. Die Marker (NPC, Boss,
// fremde Spieler, eigene Heimatbasis) sitzen aber auf EIGENEN, fest verdrahteten Bahnen aus der
// alten Streifen-Geometrie (Kreis r=50 bzw. Ellipse 78×24) - die waren auf die alte erste
// Planetenbahn hin gewählt. Gemessen über alle 77 Systeme:
//     v8.552.0 (vor KB-12):  15 Marker,  0 auf einer Planetenscheibe
//     v8.553.0 (mit KB-12):  15 Marker, 15 auf einer Planetenscheibe
// Also JEDES System mit NPC. Kein Test hat das bemerkt, weil keiner Marker gegen Planeten geprüft
// hat - deshalb dieser hier.
//
// WIE GEMESSEN WIRD - und die Falle, die dabei zweimal zugeschlagen hat
// ---------------------------------------------------------------------
// Geprüft wird KREIS gegen SCHEIBE über den Mittenabstand, nicht Umrissbox gegen Umrissbox:
// (a) Die Umrissbox der Marker-GRUPPE enthält den Namenstext und ist dreimal so breit wie der
//     Marker (74 statt 22 Sektor-Einheiten) - sie meldet Kollisionen, wo nur eine Beschriftung in
//     der Nähe steht. Beim ersten Anlauf sah der Fix dadurch wirkungslos aus, obwohl der Abstand
//     nachweislich von 17 auf 42 Einheiten gewachsen war.
// (b) Die Planetenscheibe über "circle mit r=11/14" zu suchen trifft auch die clipPath-Maske
//     texturierter Planeten in <defs> (leeres Rechteck bei 0/0) - siehe CLAUDE.md, Regel 51.
// Deshalb: Scheibe über ihre benannte Rolle (`image` bzw. `circle.body`), Marker über den größten
// echten Kreis seiner Gruppe (das schließt den pulsierenden Boss-Ring mit ein, der bis r=19 geht).
//
// WAS DIESER TEST BEWUSST NICHT PRÜFT
// -----------------------------------
// Ob eine BESCHRIFTUNG über eine fremde Planetenscheibe ragt. Das hängt an der Textlänge, nicht an
// den Markerpositionen: "Deine Basis" liegt auf dem Nachbarplaneten Rhea, und zwar an beiden
// Formfaktoren und bereits am Stand vor KB-12 - also unabhängig von dieser Etappe. Eine Prüfung
// darauf wäre von Anfang an rot und damit nur ein dauerhaft ignorierter Fehlschlag. Die Zahl wird
// als INFO-Zeile mitgeschrieben, damit ein Zuwachs auffällt; die Lösung (Beschriftungen weichen
// belegten Flächen aus) ist eine eigene Etappe.
//
// ERGAENZUNG 21.08.2026 (KB-20b/KB-20c): Pruefung 1c misst, ob ein Marker aus dem KARTENKASTEN
// ragt - und zwar datengetrieben ueber alle Markerarten. Diese Frage stellte der Test bis dahin
// gar nicht: Er mass ausschliesslich Abstaende ZWISCHEN Objekten. Genau deshalb hat er weder
// gesehen, dass das Wurmloch-Portal am Handy seit KB-12 vier Tage lang unsichtbar war, noch dass
// die Allianzbasis auf einem festen Punkt sass, den der engere Ausschnitt von KB-20 verlassen
// haette. Gefunden hat beides ein Durchgang ueber ALLE Kinder der Systemebene - der ist jetzt hier
// als Regel abgebildet, damit die naechste Markerart den Schutz automatisch erbt (Hausregel 40).
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_kartenmarker.js
//   rot:   am Stand v8.553.0 - Prüfung 1 meldet je System einen Treffer mit Abstand 17,1 bei
//          nötigen 22,0: KEPLER_SPIELDATEI=/tmp/vor_kb13.html node tests/test_kartenmarker.js
//   rot:   Allianzbasis zurueck auf translate(165,52) - fallen MUESSEN 1c (beide Formfaktoren),
//          3b und 3b2, bei identischen Pruefnamen. Gemessen ragt sie 29 px (Handy) bzw. 61 px (PC)
//          ueber die linke Kastenkante: {"was":"marker:allianzbasis","ueber":{"l":61,…}}.
//   rot:   Wurmloch zurueck auf (665, 28) - dieselben drei, gemessen 127 px (Handy) bzw. 270 px
//          (PC) ueber die RECHTE Kante.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;
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

// Welche Systeme einen NPC haben, wird aus dem NPCS-Array GELESEN, nicht geraten (Hausregel 4) -
// und auf den Block dieses Arrays gescopt, damit kein gleichnamiger Schlüssel anderswo hereinredet
// (Regel 39). Geprüft werden die ersten Systeme daraus plus alle Boss-Systeme: Bosse tragen den
// größten Marker und sind damit der harte Fall.
const NPC_SYSTEME = (() => {
  const von = S.indexOf('  const NPCS = [');
  const bis = von < 0 ? -1 : S.indexOf('\n  ];', von);
  if (von < 0 || bis < 0) return { normal: [], boss: [] };
  const block = S.slice(von, bis);
  const normal = [], boss = [];
  block.split('\n').forEach(z => {
    const m = z.match(/system:'([a-z0-9_]+)'/i);
    if (!m) return;
    (/boss:\s*true/.test(z) ? boss : normal).push(m[1]);
  });
  return { normal, boss };
})();

/* Die Nest-Fixture für Prüfung 1b. Drei Völker, drei Stufen, alle im SELBEN System - das ist die
   Lage, in der die drei Marker vor KB-17 übereinander lagen. Das System wird unten aus der echten
   NPC-Liste genommen, nicht geraten (Hausregel 4). */
let NEST_SYS = null;
const NEST_FIXTURE_ROH = [
  { id: 'kb17-a', volk: 'kryll',     stufe: 3, lp: 260000,  lpMax: 320000 },
  { id: 'kb17-b', volk: 'vex',       stufe: 2, lp: 88000,   lpMax: 120000 },
  { id: 'kb17-c', volk: 'verglueht', stufe: 5, lp: 3100000, lpMax: 4400000 }
];
let NEST_FIXTURE = [];
/* Wurmloch und Allianzbasis brauchen ebenfalls eine Fixture, sonst ist die Erweiterung oben
   VACUOUS: Ohne beide im Bild ist "kein Marker liegt auf einer Scheibe" fuer sie trivial erfuellt,
   und die Gegenprobe bliebe gruen (genau so bei KB-19 gemessen - und das war dort der Befund). */
let WURMLOCH_FIXTURE = null, BASIS_SYS = null;
function nestFixtureSetzen(sys){
  NEST_SYS = sys;
  const t = Date.now();
  NEST_FIXTURE = NEST_FIXTURE_ROH.map(n => Object.assign({}, n, {
    sys, seit: t - 7200000, letzteReifung: t - 3600000,
    naechsterWurf: t + 8 * 3600000, naechsteWanderung: 0, beitraege: {}, schlaege: {}
  }));
}

function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
    /* DREI Alien-Nester im ERSTEN NPC-System - sonst hätte Prüfung 1b keinen Gegenstand: Ohne zwei
       gleichartige Marker in einem System ist "keine zwei Marker liegen aufeinander" trivial
       erfüllt, und die Prüfung wäre aus dem falschen Grund grün (Regel 28/37). Genau diese Lage
       hat den Fehler von KB-17 erzeugt. */
    if (p === 'galaxy') return j({ npcEmpireStrength: 1, marketTrend: 1, activePirateFaction: null,
      unlockedAlienRaces: [], activeWar: null, collapsedSystems: {}, activeWormhole: WURMLOCH_FIXTURE,
      news: [], alienNester: NEST_FIXTURE });
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    return j({});
  };
}

// Misst ein geöffnetes System: Marker auf Scheibe, Beschriftung auf Beschriftung.
async function messe(page) {
  return page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const rect = svg.getBoundingClientRect();
    const kastenR = (document.querySelector('#tab-karte .map-wrap') || svg).getBoundingClientRect();
    const vbW = +svg.getAttribute('viewBox').split(/\s+/)[2];
    const proSektor = (rect.width / vbW) * (410 / 700);   // px je Sektor-Einheit
    const mitte = el => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width / 2 }; };

    const scheiben = [...document.querySelectorAll('#galaxyMapSvg .planet-node[data-planet]')].map(g => {
      const c = g.querySelector('image') || g.querySelector('circle.body');
      return c ? Object.assign({ was: 'planet:' + g.getAttribute('data-planet') }, mitte(c)) : null;
    }).filter(Boolean);

    /* Alien-Nester und Festung gehoeren MIT in die Markerliste (KB-17). Bis Phase 3 gab es nie
       zwei gleichartige Marker in einem System, deshalb kannte dieser Test die Paarung
       Marker x Marker gar nicht - und genau darin steckte der Fehler, den erst der Screenshot
       gezeigt hat: drei Nester uebereinander, ihre Beschriftungen ineinander. */
    /* KORREKTUR 21.08.2026 (KB-20b/KB-20c): Hier fehlten ZWEI weitere Markerarten - das
       Wurmloch-Portal und die Allianzbasis. Beide sassen bis dahin auf FESTEN Punkten des alten
       700x230-Systemfelds und liefen gar nicht durch kbMarkerFrei; genau deshalb hat dieser Test
       sie nie vermisst. Seit sie beide durch den Schieber gehen, gehoeren sie auch in die Messung -
       sonst haette der Test wieder denselben blinden Fleck wie die Implementierung (das ist die
       Lehre von KB-19, nur eine Ebene hoeher: eine Pruefung, die die Liste des Codes spiegelt,
       erbt dessen Luecke). */
    const marker = [];
    document.querySelectorAll('#galaxyMapSvg [data-map-npc], #galaxyMapSvg [data-map-player], #galaxyMapSvg [data-map-nest], #galaxyMapSvg [data-map-festung], #galaxyMapSvg [data-map-wurmloch], #galaxyMapSvg [data-alliance-base]').forEach(g => {
      const kreise = [...g.querySelectorAll('circle')];
      const poly = g.querySelector('polygon');
      const bezug = kreise.length ? kreise.reduce((a, c) => (+c.getAttribute('r') > +a.getAttribute('r') ? c : a)) : poly;
      if (!bezug) return;
      const name = g.getAttribute('data-map-npc') || g.getAttribute('data-map-player')
        || (g.hasAttribute('data-map-nest') ? 'nest:' + g.getAttribute('data-map-nest') : null)
        || (g.hasAttribute('data-map-wurmloch') ? 'wurmloch:' + g.getAttribute('data-map-wurmloch') : null)
        || (g.hasAttribute('data-alliance-base') ? 'allianzbasis' : null)
        || 'festung';
      /* Das Portal traegt eine scale-Transformation (die Zeichnung ist fuer viewBox 0 0 100 100
         gebaut). getBoundingClientRect liefert deshalb den ECHTEN Bildschirmplatz, das <circle>
         darin aber seine eigenen, viel groesseren Nutzerkoordinaten - gemessen 82 gegen die 27,9
         Sektor-Einheiten, die es auf der Karte einnimmt. Fuer die Kollisionsrechnung zaehlt der
         sichtbare Platz, also die GRUPPE (dieselbe Messung, die begruendet, warum die Gruppe
         bewusst kein planet-node traegt). */
      const bezugsEl = g.hasAttribute('data-map-wurmloch') ? g : bezug;
      const gb = g.getBoundingClientRect();
      marker.push(Object.assign({ was: 'marker:' + name,
        // Ragt der Marker aus dem Kartenkasten? Gemessen an der GRUPPE, also an dem, was der
        // Spieler sieht - inklusive Puls-Hof und Modell, nicht nur am Bezugskreis.
        ueber: { l: Math.round(kastenR.left - gb.left), r: Math.round(gb.right - kastenR.right),
                 o: Math.round(kastenR.top - gb.top), u: Math.round(gb.bottom - kastenR.bottom) }
      }, mitte(bezugsEl)));
    });
    /* DIE PAARUNG, DIE GEFEHLT HAT. Gemessen werden die SICHTBAREN Radien gegeneinander - zwei
       Marker duerfen sich nicht beruehren. Der pulsierende Hof zaehlt bewusst mit: Er ist Teil
       dessen, was der Spieler als "dieser Marker" sieht (dieselbe Begruendung, mit der KB-13 den
       Boss-Ring in den Mindestabstand aufgenommen hat). */
    const markerPaare = [];
    for (let i = 0; i < marker.length; i++) for (let j = i + 1; j < marker.length; j++) {
      const a = marker[i], b = marker[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < a.r + b.r) markerPaare.push({ a: a.was, b: b.was,
        abstand: +(d / proSektor).toFixed(1), noetig: +((a.r + b.r) / proSektor).toFixed(1) });
    }

    const treffer = [];
    for (const sc of scheiben) for (const mk of marker) {
      const d = Math.hypot(sc.x - mk.x, sc.y - mk.y);
      if (d < sc.r + mk.r) treffer.push({ a: sc.was, b: mk.was,
        abstand: +(d / proSektor).toFixed(1), noetig: +((sc.r + mk.r) / proSektor).toFixed(1) });
    }

    const boxen = [...document.querySelectorAll('#galaxyMapSvg text.planet-label')].map(t => {
      const b = t.getBoundingClientRect();
      return { text: (t.textContent || '').trim().slice(0, 24), l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width };
    }).filter(x => x.w > 0);
    const textPaare = [];
    for (let i = 0; i < boxen.length; i++) for (let j = i + 1; j < boxen.length; j++) {
      const a = boxen[i], c = boxen[j];
      if (Math.min(a.r, c.r) - Math.max(a.l, c.l) > 1 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 1)
        textPaare.push({ a: a.text, b: c.text });
    }
    // Dritte Kombination: BESCHRIFTUNG auf SCHEIBE. Marker-Kreis und Texte können einzeln frei
    // stehen und der Name trotzdem quer über einem Planeten liegen - genau das zeigte der
    // Screenshot nach dem ersten Anlauf ("Void-Marodeure" über Aion).
    const textAufScheibe = [];
    for (const t of boxen) for (const sc of scheiben) {
      const l = sc.x - sc.r, r = sc.x + sc.r, o = sc.y - sc.r, u = sc.y + sc.r;
      if (Math.min(t.r, r) - Math.max(t.l, l) > 1 && Math.min(t.b, u) - Math.max(t.t, o) > 1)
        textAufScheibe.push({ text: t.text, auf: sc.was });
    }
    return { scheiben: scheiben.length, marker: marker.length, treffer, textPaare,
             textAufScheibe, markerPaare, beschriftungen: boxen.length,
             markerArten: marker.map(m => m.was.replace(/^marker:/, '').split(':')[0]),
             ausserhalb: marker.filter(m => m.ueber.l > 1 || m.ueber.r > 1 || m.ueber.o > 1 || m.ueber.u > 1)
                               .map(m => ({ was: m.was, ueber: m.ueber })) };
  });
}

async function laufe(browser, store, viewport, mobil, systeme) {
  const ctx = await browser.newContext(Object.assign({ viewport }, mobil ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}));
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page.waitForTimeout(1200);
  const ergebnisse = [];
  for (const sys of systeme) {
    let offen = false;
    try { offen = await oeffneSystemUeberSektoren(page, sys); } catch (e) { offen = false; }
    if (!offen) { ergebnisse.push({ system: sys, nichtGeoeffnet: true }); continue; }
    await page.waitForTimeout(900);
    ergebnisse.push(Object.assign({ system: sys }, await messe(page)));
  }
  await ctx.close();
  return { ergebnisse, fehler };
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  const now = Date.now();
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, missions: [] }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    nextPlanetEventCheck: now + 3600000   // Ereignis-Uhr pinnen (Hausregel 18)
  });

  // Zwei gewöhnliche NPC-Systeme plus ALLE Boss-Systeme (größter Marker = harter Fall).
  const ziele = [...new Set([...NPC_SYSTEME.normal.slice(0, 2), ...NPC_SYSTEME.boss])];
  // Die Nester in das erste Zielsystem legen - dort misst 1b dann wirklich etwas.
  nestFixtureSetzen(ziele[0]);
  /* Wurmloch und Allianzbasis bewusst in ein ANDERES Zielsystem als die drei Nester: Zusammen
     waeren es sechs grosse Marker in einem System, und dann misst der Test die Grenzen des
     Schiebers statt der Positionen. Verteilt auf zwei Systeme ist jede Lage die, die im Spiel
     wirklich vorkommt. */
  BASIS_SYS = ziele[1] || ziele[0];
  WURMLOCH_FIXTURE = { from: BASIS_SYS, to: ziele[0], until: now + 6 * 3600000 };
  store['kepler7-save-v3'] = JSON.stringify(Object.assign(JSON.parse(store['kepler7-save-v3']), {
    player: { id: 'u', name: 'A', allianceTag: 'KB' },
    allianceBase: { tag: 'KB', sector: BASIS_SYS, foundedAt: now - 86400000, readyAtByLevel: {} }
  }));
  /* Die Basis MUSS zusaetzlich im geteilten Speicher liegen, nicht nur im Spielstand: `loadAllianceBase`
     laeuft beim Boot und setzt `state.allianceBase` bedingungslos auf das, was der Server liefert -
     bei fehlendem Schluessel also auf null. Der erste Anlauf hatte sie nur im Spielstand, und die
     Vorab-Pruefung meldete korrekt `["nest","wurmloch","raider1",...]` ohne Allianzbasis. Genau
     dafuer ist die Vorab-Zeile da (Hausregel 37). */
  store['alliance:KB:base'] = JSON.stringify({ tag: 'KB', sector: BASIS_SYS, foundedAt: now - 86400000, readyAtByLevel: {} });
  store['alliance:KB:info'] = JSON.stringify({ tag: 'KB', creatorId: 'u', creatorName: 'A', createdAt: now - 86400000, joinMode: 'open' });
  store['alliance:KB:member:u'] = JSON.stringify({ id: 'u', name: 'A', role: 'admin', joinedAt: now - 86400000 });
  check('0-vorab: die NPC-Systemliste ließ sich aus NPCS lesen', ziele.length >= 3,
    { normal: NPC_SYSTEME.normal.length, boss: NPC_SYSTEME.boss.length, ziele });

  for (const [name, viewport, mobil] of [['Handy', { width: 390, height: 844 }, true],
                                         ['PC', { width: 900, height: 1000 }, false]]) {
    /* JEDER Lauf bekommt eine EIGENE Kopie des Speichers. Vorher teilten sich beide Laeufe ein
       Objekt, und das Spiel schreibt darin waehrend des Laufs herum (Spielstand, Allianz-Dokumente).
       Gemessen: Im Handy-Lauf stand die Allianzbasis auf der Karte, im PC-Lauf danach nicht mehr -
       bei identischem Code und identischer Fixture. Ein Messwerkzeug, dessen erster Lauf den
       zweiten veraendert, misst nicht zweimal dasselbe (dieselbe Familie wie Hausregel 15/17/19). */
    const speicher = JSON.parse(JSON.stringify(store));
    const { ergebnisse, fehler } = await laufe(browser, speicher, viewport, mobil, ziele);
    check(`0-vorab: ${name} - Boot ohne Skriptfehler`, fehler.length === 0, fehler.slice(0, 2));

    // Ohne diese Vorab-Prüfung wären die beiden Regeln darunter trivial grün, sobald die
    // Navigation scheitert oder gar kein Marker gezeichnet wird (Regel 37).
    const offen = ergebnisse.filter(e => !e.nichtGeoeffnet);
    const mitMarker = offen.filter(e => e.marker > 0);
    check(`0-vorab: ${name} - alle Zielsysteme geöffnet und je ein Marker gezeichnet`,
      offen.length === ziele.length && mitMarker.length === ziele.length,
      ergebnisse.map(e => ({ s: e.system, offen: !e.nichtGeoeffnet, marker: e.marker, scheiben: e.scheiben })));

    /* Ohne diese Zeile waere die Erweiterung um Wurmloch und Allianzbasis vacuous - beide muessen
       in mindestens einem gemessenen System WIRKLICH auf der Karte stehen, sonst pruefen die
       Zeilen darunter fuer sie gar nichts (Hausregel 37, und die Lehre aus KB-19). */
    const arten = new Set(offen.flatMap(e => (e.markerArten || [])));
    check(`0-vorab: ${name} - Wurmloch-Portal und Allianzbasis sind wirklich im Bild`,
      arten.has('wurmloch') && arten.has('allianzbasis'),
      { gemesseneArten: [...arten], basisSystem: BASIS_SYS,
        jeSystem: offen.map(e => ({ s: e.system, arten: e.markerArten })) });

    const treffer = offen.flatMap(e => e.treffer.map(t => Object.assign({ system: e.system }, t)));
    check(`1 (${name}): kein Marker liegt auf einer Planetenscheibe`, treffer.length === 0, treffer.slice(0, 5));

    const texte = offen.flatMap(e => e.textPaare.map(t => Object.assign({ system: e.system }, t)));
    check(`2 (${name}): keine zwei Beschriftungen überlappen sich`, texte.length === 0, texte.slice(0, 5));

    /* 1c (KB-20b/KB-20c): Faellt ein Marker aus dem KARTENKASTEN? Genau das war der Fehler des
       Wurmloch-Portals (gemessen 241 px hinter der rechten Kante am PC, 133 px am Handy seit
       KB-12) und der Allianzbasis (bei 18 von 69 Systemen ganz ausserhalb). Beide hat KEIN Test
       gefunden, sondern ein Durchgang ueber alle Kinder der Systemebene - dieser Test mass
       ausschliesslich Abstaende ZWISCHEN Objekten und nie ihre Lage im Kasten.
       Bewusst datengetrieben ueber ALLE Markerarten: Eine neue Art erbt die Pruefung automatisch,
       statt dass jemand an sie denken muss (Hausregel 40). */
    const raus = offen.flatMap(e => (e.ausserhalb || []).map(t => Object.assign({ system: e.system }, t)));
    check(`1c (${name}): kein Marker ragt aus dem Kartenkasten`, raus.length === 0, raus.slice(0, 6));

    /* 1b (KB-17): DIE PAARUNG, DIE GEFEHLT HAT. Bis Phase 3 gab es nie zwei gleichartige Marker in
       einem System, also prüfte niemand Marker gegen Marker - der Schieber kannte nur Planeten und
       Sonne. Gefunden hat den Fehler kein Test, sondern ein Blick auf das gerenderte Bild: drei
       Alien-Nester lagen übereinander. Regel 53 in Reinform - wer eine Paarung nicht misst, hält
       eine Verschiebung für eine Lösung. */
    const markerTreffer = offen.flatMap(e => (e.markerPaare || []).map(t => Object.assign({ system: e.system }, t)));
    check(`1b (${name}): keine zwei Marker liegen aufeinander`,
      markerTreffer.length === 0, markerTreffer.slice(0, 5));

    // BEWUSST KEINE PRÜFUNG, sondern eine Zahl im Protokoll: Ob eine BESCHRIFTUNG über eine
    // fremde Scheibe ragt, hängt an der Textlänge, nicht an den Markerpositionen - "Deine Basis"
    // liegt seit jeher auf dem Nachbarplaneten Rhea, an beiden Formfaktoren und schon am Stand vor
    // KB-12 (gemessen). Das ist ein eigenes Thema (Label-Ausweichlogik) und wird hier nicht als
    // Regel behauptet, solange es niemand gelöst hat - eine Prüfung, die von Anfang an rot ist,
    // wäre nur ein dauerhaft ignorierter Fehlschlag. Die Zahl steht trotzdem hier, damit ein
    // Zuwachs auffällt.
    const aufScheibe = offen.flatMap(e => e.textAufScheibe.map(t => Object.assign({ system: e.system }, t)));
    console.log(`INFO - ${name}: Beschriftungen über einer fremden Scheibe: ` + JSON.stringify(aufScheibe));
  }

  // ---- 3) EIN Schieber, nicht mehrere Kopien --------------------------------------------------
  // Der Schieber existierte vor KB-13 als einzige Kopie an der Heimatbasis - genau deshalb hatten
  // NPCs und fremde Spieler ihn nie. Diese Prüfung hält fest, dass es bei EINER Quelle bleibt und
  // dass alle drei Markerarten sie benutzen; ein vierter Markertyp ohne Schieber fällt damit auf
  // (Regel 43). Kommentare werden vorher geleert, weil die Erklärtexte den Aufruf zitieren
  // (Regel 33).
  /* KOMMENTARE VOLLSTAENDIG LEEREN, Zeilen- UND Blockkommentare. Der erste Entwurf entfernte nur
     `//`-Zeilen; als der Nest-Marker (Phase 3) dazukam, zaehlte sein erklaerender BLOCK-Kommentar
     als fuenfter "Aufruf" und die Pruefung fiel auf korrektem Code durch. Das ist Arbeitsregel 33
     an genau dem Zaehler, vor dem sie warnt. */
  const OHNE_KOMMENTARE = S_OHNE_HISTORIE
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const definitionen = OHNE_KOMMENTARE.split('function kbMarkerFrei').length - 1;
  check('3a: der Kollisionsschieber existiert genau einmal', definitionen === 1, { definitionen });
  /* DIE ERWARTUNG IST EINE NAMENTLICHE LISTE, keine blanke Zahl (Arbeitsregel 33): Ein Zaehler
     sagt beim Fehlschlag nicht, WELCHE Stelle dazugekommen ist, und eine Zahl ist ohnehin eine
     Momentaufnahme. Geprueft wird die REGEL: Jede Markerart geht durch den Schieber, und es gibt
     keine Aufrufstelle, die hier nicht benannt ist. Beide Richtungen zaehlen - verschwindet eine
     erlaubte Stelle, ist das genauso ein Befund wie eine unbekannte neue (Regel 33). */
  const ERLAUBTE_MARKER = [
    { was: 'eigene Heimatbasis', muster: /kbMarkerFrei\(homeSlotXY\(myHomeSlot\)/ },
    { was: 'fremde Spieler',     muster: /kbMarkerFrei\(homeSlotXY\(pl\.slot\)/ },
    { was: 'NPCs',               muster: /kbMarkerFrei\(npcMarkerXY\(\)/ },
    { was: 'Alien-Nester',       muster: /kbMarkerFrei\(nestMarkerXY\(/ },
    /* KB-20b (21.08.2026): Das Wurmloch-Portal sass bis dahin fest bei (665, 28) - einem Punkt aus
       dem alten, breiten Systemfeld. Mit dem engeren Ausschnitt lag es am PC gemessen 241 px hinter
       der Kastenkante, am Handy schon seit KB-12 133 px. Seitdem kommt seine Bahn aus kbOrbitRx()
       und laeuft durch den Schieber wie jeder andere Marker. Es hat keine eigene *MarkerXY-Funktion,
       weil seine Bahn von der aeussersten PLANETENBAHN abhaengt (0,92 davon) und nicht von einer
       festen Marker-Bahn - gegriffen wird deshalb ueber die Variable. */
    { was: 'Wurmloch-Portal',    muster: /kbMarkerFrei\(\{ x: SUN_X \+ whRx/ },
    /* KB-20c (21.08.2026): Dieselbe Fehlerklasse an der Allianzbasis. Sie stand fest bei
       translate(165,52) - mit dem engeren Ausschnitt von KB-20 lag Sektor-x 165 bei 18 von 69
       Systemen ganz ausserhalb des Bildes und bei 23 weiteren angeschnitten. Sie hat auf der Karte
       KEINE zweite Darstellung; faellt sie aus dem Ausschnitt, ist sie fuer den Spieler schlicht
       weg. Gefunden hat sie kein Test, sondern die Durchsicht vor dem Merge - der eigene
       "was faellt aus dem Kasten"-Durchgang hatte sie uebersehen, weil die Fixture gar keine
       Allianz hatte (seit dem hat sie eine, siehe oben). */
    { was: 'Allianzbasis',       muster: /kbMarkerFrei\(\{ x: SUN_X \+ abRx/ }
  ];
  const fehlende = ERLAUBTE_MARKER.filter(m => !m.muster.test(OHNE_KOMMENTARE)).map(m => m.was);
  const aufrufe = (OHNE_KOMMENTARE.split('kbMarkerFrei(').length - 1) - definitionen;
  check('3b: JEDE bekannte Markerart ruft den Schieber auf',
    fehlende.length === 0, { fehlende, erwartet: ERLAUBTE_MARKER.map(m => m.was) });
  // Und keine unbenannte dazu: Ein neuer Markertyp muss hier eingetragen werden, sonst faellt er
  // auf - genau der Zweck dieser Pruefung seit KB-13.
  const unbenannt = aufrufe - ERLAUBTE_MARKER.length;
  check('3b2: und es gibt keine unbenannte Aufrufstelle',
    unbenannt === 0,
    { aufrufeGesamt: aufrufe, benannt: ERLAUBTE_MARKER.length, ueberzaehlig: unbenannt,
      zeilen: OHNE_KOMMENTARE.split('\n').map((z, i) => ({ z, i })).filter(x => x.z.includes('kbMarkerFrei(')).map(x => x.z.trim().slice(0, 90)) });
  check('3c: die alte, fest verdrahtete NPC-Bahn ist weg',
    !OHNE_KOMMENTARE.includes('const rx = 78, ry = 24;'), {});

  await ende(async () => browser.close());
})();
