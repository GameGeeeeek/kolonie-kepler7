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
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_kartenmarker.js
//   rot:   am Stand v8.553.0 - Prüfung 1 meldet je System einen Treffer mit Abstand 17,1 bei
//          nötigen 22,0: KEPLER_SPIELDATEI=/tmp/vor_kb13.html node tests/test_kartenmarker.js
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;
const S = fs.readFileSync(SPIELDATEI, 'utf8');

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

function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
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
    const vbW = +svg.getAttribute('viewBox').split(/\s+/)[2];
    const proSektor = (rect.width / vbW) * (410 / 700);   // px je Sektor-Einheit
    const mitte = el => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width / 2 }; };

    const scheiben = [...document.querySelectorAll('#galaxyMapSvg .planet-node[data-planet]')].map(g => {
      const c = g.querySelector('image') || g.querySelector('circle.body');
      return c ? Object.assign({ was: 'planet:' + g.getAttribute('data-planet') }, mitte(c)) : null;
    }).filter(Boolean);

    const marker = [];
    document.querySelectorAll('#galaxyMapSvg [data-map-npc], #galaxyMapSvg [data-map-player]').forEach(g => {
      const kreise = [...g.querySelectorAll('circle')];
      if (!kreise.length) return;
      const gross = kreise.reduce((a, c) => (+c.getAttribute('r') > +a.getAttribute('r') ? c : a));
      marker.push(Object.assign({ was: 'marker:' + (g.getAttribute('data-map-npc') || g.getAttribute('data-map-player')) }, mitte(gross)));
    });

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
             textAufScheibe, beschriftungen: boxen.length };
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
  check('0-vorab: die NPC-Systemliste ließ sich aus NPCS lesen', ziele.length >= 3,
    { normal: NPC_SYSTEME.normal.length, boss: NPC_SYSTEME.boss.length, ziele });

  for (const [name, viewport, mobil] of [['Handy', { width: 390, height: 844 }, true],
                                         ['PC', { width: 900, height: 1000 }, false]]) {
    const { ergebnisse, fehler } = await laufe(browser, store, viewport, mobil, ziele);
    check(`0-vorab: ${name} - Boot ohne Skriptfehler`, fehler.length === 0, fehler.slice(0, 2));

    // Ohne diese Vorab-Prüfung wären die beiden Regeln darunter trivial grün, sobald die
    // Navigation scheitert oder gar kein Marker gezeichnet wird (Regel 37).
    const offen = ergebnisse.filter(e => !e.nichtGeoeffnet);
    const mitMarker = offen.filter(e => e.marker > 0);
    check(`0-vorab: ${name} - alle Zielsysteme geöffnet und je ein Marker gezeichnet`,
      offen.length === ziele.length && mitMarker.length === ziele.length,
      ergebnisse.map(e => ({ s: e.system, offen: !e.nichtGeoeffnet, marker: e.marker, scheiben: e.scheiben })));

    const treffer = offen.flatMap(e => e.treffer.map(t => Object.assign({ system: e.system }, t)));
    check(`1 (${name}): kein Marker liegt auf einer Planetenscheibe`, treffer.length === 0, treffer.slice(0, 5));

    const texte = offen.flatMap(e => e.textPaare.map(t => Object.assign({ system: e.system }, t)));
    check(`2 (${name}): keine zwei Beschriftungen überlappen sich`, texte.length === 0, texte.slice(0, 5));

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
  const OHNE_KOMMENTARE = S.replace(/^\s*\/\/.*$/gm, '');
  const definitionen = OHNE_KOMMENTARE.split('function kbMarkerFrei').length - 1;
  const aufrufe = (OHNE_KOMMENTARE.split('kbMarkerFrei(').length - 1) - definitionen;
  check('3a: der Kollisionsschieber existiert genau einmal', definitionen === 1, { definitionen });
  check('3b: alle drei Markerarten (Heimatbasis, fremde Spieler, NPC) rufen ihn auf',
    aufrufe === 3, { aufrufe, erwartet: 3 });
  check('3c: die alte, fest verdrahtete NPC-Bahn ist weg',
    !OHNE_KOMMENTARE.includes('const rx = 78, ry = 24;'), {});

  await ende(async () => browser.close());
})();
