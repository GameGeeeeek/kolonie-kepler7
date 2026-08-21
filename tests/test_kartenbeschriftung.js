// Beschriftungen der Systemebene weichen belegten Flächen aus (Etappe KB-16).
//
// AUSGANGSMESSUNG über alle 77 Systeme und beide Formfaktoren, vor der Änderung:
//     HANDY  Text-auf-Scheibe 11 · Text-auf-Text 0 · Marker-auf-Scheibe 0
//     PC     Text-auf-Scheibe  1 · Text-auf-Text 0 · Marker-auf-Scheibe 0
// Danach: HANDY 1 · PC 0. Die elf Fälle waren drei verschiedene Konstellationen - lange NPC-Namen
// über Nachbarplaneten, "Deine Basis" auf Rhea und ein Planetenname auf der Heimatbasis-Scheibe.
//
// WAS DIESER TEST PRÜFT - und was er als INFO führt
// -------------------------------------------------
// Geprüft wird, dass in den NPC-Systemen (dort standen 9 der 11 Fälle) keine Beschriftung mehr auf
// einer fremden Scheibe liegt, dass das Ausweichen KEINE neuen Text-Text-Kollisionen erzeugt und
// dass die Marker weiterhin frei stehen (KB-13 darf nicht einreißen).
// Der eine verbliebene Fall im HEIMATSYSTEM ("Deine Basis" auf Rhea, nur am Handy) ist bewusst
// eine INFO-Zeile: Dort ist innerhalb des erlaubten Versatzes wirklich kein freier Platz, und der
// Durchgang lässt das Label dann lieber an seinem Objekt stehen - eine überlappende Beschriftung
// ist ehrlicher als eine, die beim falschen Planeten steht. Eine Prüfung, die von Anfang an rot
// ist, wäre nur ein dauerhaft ignorierter Fehlschlag.
//
// PRÜFUNG 4 IST DIE WICHTIGSTE: Sie hält den Versatz-Deckel fest. Der erste Entwurf erlaubte 42
// Einheiten - damit fand jedes Label einen freien Platz, aber "Deine Basis" landete unter dem
// NACHBARPLANETEN und gehörte optisch zu ihm. Die Kollisionszahl war 0, die Zuordnung kaputt;
// gesehen nur am Screenshot (CLAUDE.md, Regel 42/53).
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_kartenbeschriftung.js
//   rot:   am Stand vor KB-16 - Prüfung 1 meldet die NPC-Namen auf den Nachbarplaneten
//   rot:   an einer Kopie ohne Versatz-Deckel - Prüfung 4 meldet die zu weit gewanderten Labels
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;
const S = fs.readFileSync(SPIELDATEI, 'utf8');

// Die NPC-Systeme aus dem NPCS-Array LESEN, nicht raten (Hausregel 4) - dort stehen die langen
// Namen, an denen sich das Problem zeigte.
const NPC_SYSTEME = (() => {
  const von = S.indexOf('  const NPCS = [');
  const bis = von < 0 ? -1 : S.indexOf('\n  ];', von);
  if (von < 0 || bis < 0) return [];
  return [...new Set(S.slice(von, bis).split('\n')
    .map(z => (z.match(/system:'([a-z0-9_]+)'/i) || [])[1]).filter(Boolean))];
})();

// Drei Alien-Nester im Heimatsystem - so viele setzt Phase 3 hoechstens je System. OHNE sie waere
// die KB-19-Erweiterung dieses Waechters vacuous: Er koennte die neuen Objektarten zwar sehen, im
// Fixture kaeme aber keine vor, und die Gegenprobe am alten Stand bliebe gruen (genau so gemessen).
const NESTER = [
  { id: 'n1', sys: 'kepler', volk: 'Vex-Nomaden', stufe: 3, lp: 90000, lpMax: 120000 },
  { id: 'n2', sys: 'kepler', volk: 'Vex-Nomaden', stufe: 2, lp: 40000, lpMax: 40000 },
  { id: 'n3', sys: 'kepler', volk: 'Vex-Nomaden', stufe: 1, lp: 20000, lpMax: 40000 }
];

function backend(store) {
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    /* Das Wurmloch gehoert in die Fixture, seit GR-1 (21.08.2026) das Portal eine eigene
       Beschriftung hat. Sie ist ein text.planet-label wie jede andere, liegt aber AUSSERHALB der
       <g data-map-wurmloch>-Gruppe - fuer kbLabelsEntflechten also eine FREISTEHENDE Beschriftung
       ohne eigenes Objekt (Richtung nach unten, kein Ausnahme-Abstand zum eigenen Objekt). Ohne
       sie misst dieser Test einen Fall weniger, als das Spiel kennt, und die neue Beschriftung
       koennte andere verdraengen, ohne dass es je auffaellt. */
    if (p === 'galaxy') return j({ alienNester: NESTER, activeWormhole: { from: 'kepler', to: 'vega' } });
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

async function messe(page) {
  return page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const vbW = +svg.getAttribute('viewBox').split(/\s+/)[2];
    const proSektor = (rect.width / vbW) * (410 / 700);
    const kasten = el => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, x: b.left + b.width/2, y: b.top + b.height/2, rad: b.width/2, w: b.width }; };
    const schneidet = (a, c) => Math.min(a.r, c.r) - Math.max(a.l, c.l) > 1 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 1;

    // Scheiben und Marker über ihre BENANNTE Rolle greifen, nie über den Radius (Regel 51).
    //
    // KB-19: Hier stand DIESELBE Namensliste aus drei Selektoren wie im Spielcode - und damit hatte
    // dieser Waechter exakt denselben blinden Fleck wie die Funktion, die er bewacht: Asteroiden,
    // Alien-Nester und Asteroidenfestungen kamen erst nach KB-16 dazu, keiner von beiden kannte
    // sie, und ein Planetenname auf einer Nest-Scheibe konnte deshalb gar nicht auffallen (im
    // gerenderten Bild gemessen: "Vesna" lag auf einem Nest). Eine Pruefung, die die Namensliste
    // der Implementierung SPIEGELT, erbt deren Luecke - sie kann nur finden, woran schon jemand
    // gedacht hat (Regel 40). Gegriffen wird deshalb ueber die Klasse, die alle sechs Kartenobjekte
    // tragen; eine neue Markerart ist damit automatisch mitgeprueft.
    const OBJEKTE = '.planet-node';
    const objekte = [];
    svg.querySelectorAll(OBJEKTE).forEach(g => {
      let el = g.querySelector('image') || g.querySelector('circle.body');
      if (!el) {
        const kreise = [...g.querySelectorAll('circle')];
        if (kreise.length) el = kreise.reduce((a, c) => (+c.getAttribute('r') > +a.getAttribute('r') ? c : a));
      }
      if (!el) return;
      const k = kasten(el);
      if (!k.w) return;
      const was = g.getAttribute('data-planet') || g.getAttribute('data-map-npc')
               || g.getAttribute('data-map-player') || g.getAttribute('data-map-nest')
               || (g.hasAttribute('data-map-festung') ? 'festung' : null)
               || g.getAttribute('data-map-asteroid');
      objekte.push(Object.assign({ g, was, istPlanet: !!g.getAttribute('data-planet') }, k));
    });

    const texte = [];
    svg.querySelectorAll('text.planet-label').forEach(t => {
      const k = kasten(t);
      if (!k.w) return;
      const eigen = t.closest(OBJEKTE);
      const eigenO = eigen ? objekte.find(o => o.g === eigen) : null;
      texte.push(Object.assign({ text: (t.textContent || '').trim().slice(0, 28),
                                 eigen: eigenO ? eigenO.was : null,
                                 abstandZumEigenen: eigenO ? Math.hypot(k.x - eigenO.x, k.y - eigenO.y) / proSektor : null }, k));
    });

    const aufScheibe = [], aufMarker = [], textPaare = [], markerAufScheibe = [];
    for (const t of texte) for (const o of objekte) {
      if (!o.istPlanet) continue;
      const box = { l: o.x - o.rad, r: o.x + o.rad, t: o.y - o.rad, b: o.y + o.rad };
      if (schneidet(t, box)) aufScheibe.push({ text: t.text, auf: o.was });
    }
    // KB-19: die GEGENRICHTUNG - ein fremder Name auf einem NICHT-Planeten (Alien-Nest,
    // Asteroidenfestung, Asteroid, NPC, fremder Spieler). Genau die hat der Entflechter bis KB-19
    // nicht gekannt, und genau die hat dieser Waechter bis dahin auch nicht gemessen: Die Schleife
    // darueber steigt bei `!o.istPlanet` aus. Ohne diese zweite Schleife blieb die Gegenprobe zu
    // KB-19 gruen, obwohl im gerenderten Bild "Vesna" auf einer Nest-Scheibe lag (gemessen).
    for (const t of texte) for (const o of objekte) {
      if (o.istPlanet) continue;
      if (t.eigen !== null && t.eigen === o.was) continue;   // das eigene Objekt zaehlt nicht
      const box = { l: o.x - o.rad, r: o.x + o.rad, t: o.y - o.rad, b: o.y + o.rad };
      if (schneidet(t, box)) aufMarker.push({ text: t.text, auf: o.was });
    }
    for (let i = 0; i < texte.length; i++) for (let j = i + 1; j < texte.length; j++) {
      if (schneidet(texte[i], texte[j])) textPaare.push({ a: texte[i].text, b: texte[j].text });
    }
    for (const o of objekte) for (const m of objekte) {
      if (!o.istPlanet || m.istPlanet) continue;
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      if (d < o.rad + m.rad) markerAufScheibe.push({ planet: o.was, marker: m.was });
    }
    // Größter Abstand eines Labels zu SEINEM Objekt - die Kennzahl für die Zuordnung.
    const weiteste = texte.filter(t => t.abstandZumEigenen !== null)
      .sort((a, b) => b.abstandZumEigenen - a.abstandZumEigenen)[0] || null;
    /* Form der ZEICHNUNG in Sektor-Einheiten (rund ~0,8 gegen flach ~0,35), aus den echten
       Planetenknoten statt aus einer Konstante: getBBox() liefert in der transformierten
       Systemgruppe genau die Koordinaten von kbOrbitMass. Traegt die Vorab-Pruefung, dass die
       drei Formfaktoren wirklich verschiedene Zeichnungen messen. */
    const formKnoten = [...svg.querySelectorAll('.planet-node[data-planet]')];
    let fx0 = 1e9, fx1 = -1e9, fy0 = 1e9, fy1 = -1e9;
    for (const k of formKnoten){ let b; try { b = k.getBBox(); } catch (e) { continue; }
      fx0 = Math.min(fx0, b.x); fx1 = Math.max(fx1, b.x + b.width);
      fy0 = Math.min(fy0, b.y); fy1 = Math.max(fy1, b.y + b.height); }
    const zeichnungVerh = (fx1 > fx0) ? +((fy1 - fy0) / (fx1 - fx0)).toFixed(2) : null;

    return { texte: texte.length, wurmlochLabel: texte.some(t => t.text === 'Wurmloch'), zeichnungVerh,
             aufScheibe, aufMarker, textPaare, markerAufScheibe,
             weiteste: weiteste ? { text: weiteste.text, eigen: weiteste.eigen, abstand: +weiteste.abstandZumEigenen.toFixed(1) } : null };
  });
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
    // Asteroidenfestung im Heimatsystem - die zweite der drei Objektarten, die KB-16 noch nicht
    // kannte (die dritte, Asteroiden, entsteht im Guertelsystem von selbst).
    asteroidFeld: { kepler: { festung: { stufe: 2, kern: 200000, kernMax: 250000,
                    hort: { sorte: 'urmaterie', menge: 5000, protomaterie: 40 } } } },
    nextPlanetEventCheck: now + 3600000,  // Ereignis-Uhr pinnen (Hausregel 18)
    nextTraderCheck: now + 3600000
  });

  check('0-vorab: die NPC-Systeme ließen sich aus NPCS lesen', NPC_SYSTEME.length >= 6,
    { gefunden: NPC_SYSTEME.length });

  // Sechs NPC-Systeme reichen: Dort standen 9 der 11 Ausgangsfälle, und jedes weitere kostet den
  // Suite-Lauf Zeit, ohne eine andere Konstellation zu prüfen.
  const ziele = NPC_SYSTEME.slice(0, 6);
  // Der HÖCHSTE erlaubte Abstand eines Labels zu seinem Objekt, in Sektor-Einheiten. Er entspricht
  // dem Versatz-Deckel des Durchgangs plus dem regulären Grundabstand (Label steht ~13 unter der
  // Scheibe) plus Reserve - siehe Prüfung 4.
  const ABSTAND_MAX = 48;

  /* DREI Formfaktoren, nicht zwei - und der dritte ist seit KB-20 noetig.
     Bis dahin gab es genau zwei Zeichnungen und sie hingen an der Fensterbreite: schmal = rund,
     breit = flach. Seit KB-20 entscheidet kbRunderKasten() ueber das Verhaeltnis des KASTENS,
     und damit bekommt der bisherige PC-Lauf bei 1280x900 die RUNDE Zeichnung (gemessen: Kasten
     738x725, Verhaeltnis 0,98; Zeichnung 287x233 Sektor-Einheiten, also 0,81). Die FLACHE
     Zeichnung, fuer die dieser Test urspruenglich kalibriert wurde, maesse danach niemand mehr.
     1920x700 liegt im flachen Band (Zielhoehe 525 gegen 1258 Kastenbreite = 0,42) - derselbe
     Formfaktor, den test_kartengroesse Abschnitt 5 als PAAR prueft. */
  for (const [name, viewport, mobil] of [['Handy', { width: 390, height: 844 }, true],
                                         ['PC', { width: 1280, height: 900 }, false],
                                         ['PC flach', { width: 1920, height: 700 }, false]]) {
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
    check(`0-vorab: ${name} - Boot ohne Skriptfehler`, fehler.length === 0, fehler.slice(0, 2));

    const ergebnisse = [];
    for (const sys of ziele) {
      let offen = false;
      try { offen = await oeffneSystemUeberSektoren(page, sys); } catch (e) { offen = false; }
      if (!offen) { ergebnisse.push({ system: sys, nichtGeoeffnet: true }); continue; }
      await page.waitForTimeout(800);
      const m = await messe(page);
      if (m) ergebnisse.push(Object.assign({ system: sys }, m));
    }
    await ctx.close();

    const offen = ergebnisse.filter(e => !e.nichtGeoeffnet);
    // Ohne diese Vorab-Prüfung wären die Regeln darunter trivial grün, sobald die Navigation
    // scheitert oder gar keine Beschriftungen gezeichnet werden (Regel 37).
    check(`0-vorab: ${name} - alle Zielsysteme geöffnet und beschriftet`,
      offen.length === ziele.length && offen.every(e => e.texte >= 4),
      ergebnisse.map(e => ({ s: e.system, offen: !e.nichtGeoeffnet, texte: e.texte })));

    /* Und das Wurmloch-Label ist wirklich dabei. Ohne diese Zeile bliebe eine entfernte
       activeWormhole-Fixture unbemerkt, und der Test maesse still einen Fall weniger, als das
       Spiel kennt - genau die Sorte stiller Luecke, die KB-19 an diesem Test aufgedeckt hat.
       Gemessen mit der Fixture: kepler 12 -> 13 Texte, vega 7 -> 8 (die zwei Endpunkte des
       Wurmlochs). */
    const mitWurmloch = offen.filter(e => e.wurmlochLabel).map(e => e.system);
    check(`0-vorab: ${name} - das Wurmloch-Portal traegt seine Beschriftung und wird mitgemessen`,
      mitWurmloch.length >= 1, { mitWurmloch, texteJeSystem: offen.map(e => e.system + ':' + e.texte) });

    /* Und dieser Formfaktor zeichnet wirklich das, was sein Name sagt. Ohne die Zeile waere "PC
       flach" ein stilles Duplikat von "PC", sobald jemand die Schwelle kbRunderKasten() oder den
       Viewport verschiebt - und der Test haette wieder nur eine der zwei Zeichnungen abgedeckt.
       Gemessen: rund 0,81, flach 0,35; die Schranke 0,5 ist dieselbe, die kbRunderKasten benutzt. */
    const verh = offen.map(e => e.zeichnungVerh).filter(v => v !== null);
    const rundErwartet = name !== 'PC flach';
    check(`0-vorab: ${name} - die Zeichnung ist ${rundErwartet ? 'rund' : 'flach'}`,
      verh.length === offen.length && verh.every(v => rundErwartet ? v > 0.5 : v < 0.5),
      { verhaeltnisse: verh, erwartet: rundErwartet ? '> 0,5 (rund)' : '< 0,5 (flach)' });

    // Genau EINE dokumentierte Ausnahme: "Deine Basis" auf Rhea im Heimatsystem. Dort ist innerhalb
    // des erlaubten Versatzes wirklich kein freier Platz (gemessen), und der Durchgang lässt das
    // Label dann lieber an seinem Objekt stehen, statt es zum Nachbarplaneten wandern zu lassen.
    // Sie wird NAMENTLICH zugelassen, nicht pauschal weggelassen: Jeder andere Fall - auch ein
    // zweiter im selben System - schlägt weiterhin an (Regel 33: erlaubte Stellen als Musterliste,
    // nie als blanke Zahl).
    // Namentlich hinterlegte Faelle, nie pauschal ausgeblendet - jeder andere schlaegt an.
    //
    // 'Schwarmstock' auf 'vesna' kam mit KB-19 dazu, als drei Alien-Nester ins Fixture gingen, und
    // ist GEMESSEN kein Fehler, sondern die Abwaegung aus KB-16: Alle drei Nest-Namen sitzen bei
    // dy = -20,3 an ihrer natuerlichen Stelle ueber dem Marker; 'Sporenherd' wich um dx = 8
    // seitlich aus, 'Schwarmstock' fand innerhalb des Deckels (21 senkrecht, danach 12 seitlich)
    // keinen freien Platz und bleibt deshalb an seinem eigenen Objekt stehen. Eine ueberlappende
    // Beschriftung ist ehrlicher als eine, die beim falschen Planeten steht - genau deshalb gibt
    // es den Deckel. Wer ihn anhebt, prueft zuerst Abschnitt 4 (Abstand zum EIGENEN Objekt).
    const BEKANNT = [
      { system: 'kepler', text: 'Deine Basis', auf: 'rhea' },
      { system: 'kepler', text: 'Schwarmstock', auf: 'vesna' }
    ];
    const alleTreffer = offen.flatMap(e => e.aufScheibe.map(x => Object.assign({ system: e.system }, x)));
    const aufScheibe = alleTreffer.filter(t =>
      !BEKANNT.some(b => b.system === t.system && b.text === t.text && b.auf === t.auf));
    check(`1 (${name}): keine Beschriftung liegt auf einer fremden Planetenscheibe`,
      aufScheibe.length === 0, { neu: aufScheibe.slice(0, 6), bekannteAusnahmen: alleTreffer.length - aufScheibe.length });

    // KB-19: kein Name auf einer Nest-/Festungs-/Asteroiden-/Marker-Scheibe. Bewusst OHNE
    // Ausnahmeliste - hier ist bislang kein Fall bekannt, und ein leerer Deckel ist ehrlicher als
    // eine vorsorglich geoeffnete Tuer.
    const aufMarker = offen.flatMap(e => e.aufMarker.map(x => Object.assign({ system: e.system }, x)));
    check(`1b (${name}): keine Beschriftung liegt auf einem fremden Marker (Nest, Festung, Asteroid, NPC)`,
      aufMarker.length === 0, aufMarker.slice(0, 6));

    const paare = offen.flatMap(e => e.textPaare.map(x => Object.assign({ system: e.system }, x)));
    check(`2 (${name}): das Ausweichen erzeugt keine Text-auf-Text-Kollision`,
      paare.length === 0, paare.slice(0, 6));

    const marker = offen.flatMap(e => e.markerAufScheibe.map(x => Object.assign({ system: e.system }, x)));
    check(`3 (${name}): die Marker stehen weiterhin frei (KB-13 reißt nicht ein)`,
      marker.length === 0, marker.slice(0, 6));

    // ---- 4) DIE WICHTIGSTE: Die Zuordnung Label -> Objekt bleibt erhalten ----------------------
    const zuWeit = offen.map(e => e.weiteste).filter(w => w && w.abstand > ABSTAND_MAX);
    check(`4 (${name}): kein Label ist so weit gewandert, dass es zu einem anderen Objekt gehört`,
      zuWeit.length === 0, { grenze: ABSTAND_MAX, zuWeit, gemessen: offen.map(e => e.weiteste && e.weiteste.abstand) });
  }

  // ---- 5) Der bekannte Restfall, bewusst als INFO statt als Prüfung ---------------------------
  // Im Heimatsystem ist innerhalb des erlaubten Versatzes kein freier Platz; der Durchgang lässt
  // das Label dann an seinem Objekt stehen. Die Zahl steht hier, damit ein Zuwachs auffällt.
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page2 = await ctx2.newPage();
  await page2.route('**/api/**', backend(store));
  await page2.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page2.goto(DATEI);
  await page2.waitForTimeout(2500);
  await page2.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page2.waitForTimeout(1200);
  let heimOffen = false;
  try { heimOffen = await oeffneSystemUeberSektoren(page2, 'kepler'); } catch (e) { heimOffen = false; }
  if (heimOffen) {
    await page2.waitForTimeout(800);
    const m = await messe(page2);
    console.log('INFO - Heimatsystem am Handy, verbliebene Text-auf-Scheibe: ' + JSON.stringify(m ? m.aufScheibe : null));
  }
  await ctx2.close();

  await ende(async () => browser.close());
})();
