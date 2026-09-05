// Die sechs Sterntypen: Sektorknoten und Sonnenkern der Systemebene (Buendel A, 05.09.2026,
// Grafik-Aufnahme "Kepler-7 in neuem Licht").
//
//   node tests/test_sonnen.js
//
// GEMESSEN AM ALTEN BILD, bevor etwas geaendert wurde:
//   Sektorknoten: sechs gleiche Glanz-Murmeln (radialGradient mit festem Highlight bei 35%/35%),
//     die sich nur in Farbe und Radius unterschieden. Die Flags binary und pulsar aus SUN_TYPES
//     wurden gar nicht gezeichnet. 17 von 20 Knoten lagen zusaetzlich auf opacity 0.6 und wirkten matt.
//   Systemkern: eine einfarbige, hart begrenzte Scheibe mit duennem weissem Ring - am Desktop wie
//     eine weisse LED. Keine Randverdunklung, keine Oberflaeche, kein Uebergang zur Glut.
//
// WAS DIESER TEST HAELT, sind Regeln, keine Bilder:
//   1) Jeder der sechs Typen hat ein eigenes Symbol, und die alten Murmel-Gradienten sind weg.
//   2) Die Form unterscheidet die Typen, nicht nur die Farbe: jedes Symbol hat einen anderen Aufbau.
//   3) Farben kommen aus SUN_TYPES, nichts ist eingetippt.
//   4) Unentdeckt daempft den HALO, nicht den ganzen Knoten - der Stern bleibt hell.
//   5) Der Systemkern ist ein gebackenes Bild je Typ, gecacht, und deckt sich mit dem alten Radius.
//   6) Faellt das Backen aus, bleibt ein Kreis stehen (ein Kartenbild ohne Sonne waere schlimmer).
//
// GEGENPROBE, gemessen am 05.09.2026 gegen origin/main (v8.683.0):
//   grün: node tests/test_sonnen.js  -> 33 von 33
//   rot:  git show origin/main:weltraum_kolonie.html > /tmp/alt.html
//         KEPLER_SPIELDATEI=/tmp/alt.html KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_sonnen.js
//   Am alten Stand fallen 18: 0b 0c 0d 0e 0f 0g 1-anker 1-anker2 2-anker 2-anker2 3a 3b 3c 3d
//   4b 4c 4d 4e. Grün bleiben genau 6, und alle sechs sind Anker oder Bestandsprüfungen:
//   0-anker und 0a (SUN_TYPES gab es schon), 3-vorab und 3-anker (Boot und Sektorwechsel),
//   4-anker (Systemwechsel) und 4a (die Glut - sie soll ja gerade unangetastet bleiben).
//   Die Listen sind bewusst NICHT deckungsgleich: die Prüfungen der Blöcke 1 und 2 laufen am alten
//   Stand gar nicht, weil es die Zeichner dort nicht gibt - genau das melden 1-anker und 2-anker.
//   Eine Prüfung über einer fehlenden Funktion wäre sonst still grün (Hausregel: vacuous).
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSektorMitSystem, oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;
const S = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = S.match(/<script>([\s\S]*)<\/script>/)[1];

/* ---- 0) Quelltext ---------------------------------------------------------------------------- */
const sunTreffer = JS.match(/const SUN_TYPES = \[[\s\S]*?\n  \];/);
check('0-anker: SUN_TYPES ist lesbar', !!sunTreffer);
const typKeys = sunTreffer ? [...sunTreffer[0].matchAll(/key:'([a-z]+)'/g)].map(m => m[1]) : [];
check('0a: es gibt sechs Sonnentypen', typKeys.length === 6, typKeys);
check('0b: die alten Murmel-Gradienten sind weg (sekSun-/sekGlow-)',
  !/sekSun-/.test(JS) && !/sekGlow-/.test(JS));
check('0c: der Sektorknoten zeichnet ein <use> auf den Symbolsatz',
  /sekSternUse\(st\.key/.test(JS) && /defs \+= sekSternSymbole\(SUN_TYPES\)/.test(JS));
/* Die Gesamt-Abdunklung des Knotens muss weg sein - sonst daempft sie den Stern gleich mit. */
check('0d: unentdeckt setzt eine Kennung statt opacity auf den ganzen Knoten',
  /entdeckt === 0 && !heim \? ' data-unentdeckt="1"'/.test(JS)
  && !/entdeckt === 0 && !heim \? ' opacity="0\.6"'/.test(JS));
check('0e: die Daempfung liegt im CSS auf der Schrift, nicht auf dem Knoten',
  /\.sektor-sys\[data-unentdeckt\] text \{ opacity/.test(S));
/* Kein zweiter Rauschgenerator: der Sonnenkern nimmt den des Texturblocks. */
check('0f: es gibt nur EINEN Rauschgenerator (makeNoise3D), kein wiedereingefuehrtes makeNoise2D',
  /function makeNoise3D\(/.test(JS) && !/function makeNoise2D\(/.test(JS)
  && /function sonneRausch2D\(seed\)\{[\s\S]{0,140}makeNoise3D\(seed\)/.test(JS));
check('0g: der Systemkern zeichnet ein Bild und behaelt einen Kreis als Rueckfall',
  /const sonneUrl = sonneBildUrl\(activeSunType\)/.test(JS)
  && /<image href="\$\{sonneUrl\}"/.test(JS)
  && /\} else \{[\s\S]{0,400}<circle cx="\$\{SUN_X\}"/.test(JS));

/* ---- 1) Die Symbole, isoliert gerechnet ------------------------------------------------------ */
const symVon = JS.indexOf('function sekRg(id, stops, o){');
const symBis = JS.indexOf('function sekSternUse(');
check('1-anker: der Symbol-Zeichner ist im Quelltext auffindbar', symVon > 0 && symBis > symVon);

(async () => {
  const browser = await starteBrowser();
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('about:blank');
    let m = null;
    try {
      m = await page.evaluate(({ code, sun }) => {
        const api = new Function(sun + ';' + code + ';return { sekSternSymbole, SUN_TYPES };')();
        const markup = api.sekSternSymbole(api.SUN_TYPES);
        const je = {};
        for (const t of api.SUN_TYPES) {
          const i = markup.indexOf('<symbol id="sekStern-' + t.key + '"');
          const e = i < 0 ? -1 : markup.indexOf('</symbol>', i);
          const inner = i >= 0 && e > i ? markup.slice(i, e) : '';
          je[t.key] = {
            da: i >= 0,
            formen: (inner.match(/<(circle|path|ellipse|polygon|rect)\b/g) || []).length,
            bauart: [...new Set((inner.match(/<(circle|path|ellipse|polygon|rect)\b/g) || []).map(x => x.slice(1)))].sort().join('+'),
            haloVariabel: /var\(--sek-halo/.test(inner)
          };
        }
        // Farben: jeder Farbwert im Markup muss aus core/glow ableitbar sein oder ein Grauton sein
        const farben = [...new Set((markup.match(/#[0-9a-fA-F]{6}/g) || []).map(c => c.toLowerCase()))];
        const ausSun = new Set(api.SUN_TYPES.flatMap(t => [t.core.toLowerCase(), t.glow.toLowerCase()]));
        return { je, farben, ausSunAnzahl: farben.filter(c => ausSun.has(c)).length, laenge: markup.length };
      }, { code: JS.slice(symVon, symBis), sun: sunTreffer[0] });
    } catch (e) { m = { fehler: String(e).slice(0, 200) }; }
    check('1-anker2: der Symbolsatz laesst sich bauen', !!m && !m.fehler, m && m.fehler);
    if (m && !m.fehler) {
      check('1a: jeder der sechs Typen hat ein eigenes Symbol', typKeys.every(k => m.je[k] && m.je[k].da),
        Object.fromEntries(typKeys.map(k => [k, m.je[k] && m.je[k].da])));
      /* DIE FORM unterscheidet, nicht die Farbe: mindestens vier verschiedene Bauarten unter sechs
         Typen. Frueher waren alle sechs derselbe Kreis, nur anders eingefaerbt. */
      const bauarten = new Set(typKeys.map(k => m.je[k].bauart));
      check('1b: die Typen unterscheiden sich in der FORM, nicht nur in der Farbe', bauarten.size >= 4,
        Object.fromEntries(typKeys.map(k => [k, m.je[k].bauart])));
      check('1c: jedes Symbol traegt den steuerbaren Halo (--sek-halo)',
        typKeys.every(k => m.je[k].haloVariabel), Object.fromEntries(typKeys.map(k => [k, m.je[k].haloVariabel])));
      check('1d: die Farben von SUN_TYPES kommen im Markup wirklich vor', m.ausSunAnzahl >= 6,
        { gefunden: m.ausSunAnzahl, farben: m.farben.slice(0, 12) });
    }
    await ctx.close();
  }

  /* ---- 2) Die Sonnenbilder der Systemebene, isoliert gerechnet -------------------------------- */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('about:blank');
    const kernVon = JS.indexOf('  function sonneRausch2D(seed){');
    const kernBis = JS.indexOf('  /* DIE SECHS STERNTYPEN DER SEKTORANSICHT');
    const rauschVon = JS.indexOf('function makeNoise3D(seed){');
    const rauschBis = JS.indexOf('function fbm3(');
    check('2-anker: Sonnenkern-Zeichner und Rauschgenerator sind auffindbar',
      kernVon > 0 && kernBis > kernVon && rauschVon > 0 && rauschBis > rauschVon);
    let k = null;
    try {
      k = await page.evaluate(({ kern, rausch, sun }) => {
        const api = new Function(rausch + ';' + sun + ';' + kern + ';return { SUN_TYPES, sonneBildUrl, SONNE_BILD_CACHE };')();
        const t0 = performance.now();
        const bilder = api.SUN_TYPES.map(t => {
          const u = api.sonneBildUrl(t);
          return { key: t.key, ok: !!u, kb: u ? Math.round(u.length * 0.75 / 1024) : 0 };
        });
        const dauerMs = Math.round(performance.now() - t0);
        // Zweiter Aufruf: der Cache muss greifen (identische Zeichenkette, kein Neubau)
        const zweimal = api.SUN_TYPES.every(t => api.sonneBildUrl(t) === api.SONNE_BILD_CACHE[t.key]);
        // Und die Bilder muessen sich voneinander unterscheiden
        const verschieden = new Set(api.SUN_TYPES.map(t => api.sonneBildUrl(t))).size;
        return { bilder, dauerMs, zweimal, verschieden };
      }, { kern: JS.slice(kernVon, kernBis), rausch: JS.slice(rauschVon, rauschBis), sun: sunTreffer[0] });
    } catch (e) { k = { fehler: String(e).slice(0, 200) }; }
    check('2-anker2: die Sonnenbilder lassen sich bauen', !!k && !k.fehler, k && k.fehler);
    if (k && !k.fehler) {
      check('2a: jeder der sechs Typen liefert ein Bild', k.bilder.every(b => b.ok), k.bilder);
      /* Der Entwurf hielt jede Kachel unter 15 KB - eine Data-URL steckt im Markup der Karte und
         wird bei jedem Aufbau mitgeschrieben. */
      check('2b: jede Kachel bleibt unter 15 KB', k.bilder.every(b => b.kb > 0 && b.kb < 15), k.bilder);
      check('2c: die sechs Bilder unterscheiden sich voneinander', k.verschieden === 6, { verschieden: k.verschieden });
      check('2d: je Typ wird nur EINMAL gebacken (der Cache greift)', k.zweimal === true);
      check('2e: alle sechs entstehen in unter 3 s', k.dauerMs < 3000, { dauerMs: k.dauerMs });
    }
    await ctx.close();
  }

  /* ---- 3) Im Spiel --------------------------------------------------------------------------- */
  const store = {};
  const now = Date.now();
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, ships: 3, colonyShips: 1, missions: [] },
    discovered: { rhea: true, aion: true },
    colonies: { rhea: { buildings: { solar: 3, mine: 2, habitat: 1 }, fleet: { ships: 2, missions: [] } } },
    activeBasePlanet: 'home', player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000,
    prestige: 4, buffs: [], lastTick: now, colonyNames: {}, colonyNotes: {}, nextPlanetEventCheck: now + 3600000
  });
  const backend = async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
    if (p.startsWith('storage/')) {
      const kk = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[kk] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[kk] !== undefined) return j({ key: kk, value: store[kk], version: 1 });
      return j({ e: 1 }, 404);
    }
    return j({});
  };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await page.route('**/api/**', backend);
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  check('3-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  const auf = await oeffneSektorMitSystem(page, 'kepler');
  check('3-anker: die Region um Kepler laesst sich oeffnen', auf === true);
  const sekt = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const symbole = [...svg.querySelectorAll('symbol[id^="sekStern-"]')].map(s => s.id);
    const uses = [...svg.querySelectorAll('use[href^="#sekStern-"]')];
    const knoten = [...svg.querySelectorAll('g.sektor-sys')];
    const unentdeckt = knoten.filter(g => g.hasAttribute('data-unentdeckt'));
    return {
      symbole: symbole.length, uses: uses.length, knoten: knoten.length,
      unentdeckt: unentdeckt.length,
      knotenMitOpacity: knoten.filter(g => g.getAttribute('opacity')).length,
      haloGesenkt: unentdeckt.length ? unentdeckt.every(g => {
        const u = g.querySelector('use[href^="#sekStern-"]');
        return u && /--sek-halo/.test(u.getAttribute('style') || '');
      }) : null
    };
  });
  check('3a: der Symbolsatz steht genau einmal im Kartenbild (sechs Symbole)', sekt.symbole === 6, sekt);
  check('3b: jeder Systemknoten zeichnet seinen Stern per <use>', sekt.uses >= 10 && sekt.uses === sekt.knoten, sekt);
  check('3c: kein Knoten traegt mehr eine Gesamt-Abdunklung', sekt.knotenMitOpacity === 0, sekt);
  check('3d: bei unentdeckten Systemen ist NUR der Halo gesenkt (sonst misst 3c nichts)',
    sekt.unentdeckt > 0 && sekt.haloGesenkt === true, sekt);

  const sys = await oeffneSystemUeberSektoren(page, 'kepler');
  check('4-anker: das Heimatsystem laesst sich oeffnen', sys === true);
  const kern = await page.evaluate(async () => {
    const svg = document.getElementById('galaxyMapSvg');
    const glut = svg.querySelector('[data-sys-glut]');
    const bilder = [...svg.querySelectorAll('image')].map(i => i.getAttribute('href') || '').filter(h => h.startsWith('data:image/png'));
    // Das Sonnenbild ist das einzige, das den Glut-Mittelpunkt umschliesst
    const cx = glut ? +glut.getAttribute('cx') : null, cy = glut ? +glut.getAttribute('cy') : null;
    const treffer = [...svg.querySelectorAll('image')].filter(i => {
      const x = +i.getAttribute('x'), y = +i.getAttribute('y'), w = +i.getAttribute('width'), h = +i.getAttribute('height');
      return cx !== null && x < cx && cx < x + w && y < cy && cy < y + h;
    });
    const groesse = await Promise.all(treffer.slice(0, 1).map(i => new Promise(res => {
      const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res([0, 0]);
      im.src = i.getAttribute('href');
    })));
    return {
      glutDa: !!glut, bilder: bilder.length, aufDerSonne: treffer.length,
      kante: treffer.length ? +treffer[0].getAttribute('width') : null,
      kachel: groesse[0] || null,
      weisserRing: svg.innerHTML.includes('stroke-opacity="0.5" stroke-width="0.8"')
    };
  });
  check('4a: die Glut steht weiter (Korona und Strahlen bleiben unangetastet)', kern.glutDa === true, kern);
  check('4b: der Sonnenkern ist ein gebackenes Bild, kein flacher Kreis mehr', kern.aufDerSonne === 1, kern);
  /* Die Kachel ist 30 Einheiten breit angelegt (E = S/30, Kern 13 E) - damit deckt sich die Kante
     genau mit dem bisherigen Kernradius 13. Kepler ist ein Weisser Zwerg (r 0,55): 30 * 0,55 = 16,5. */
  check('4c: die Bildkante deckt sich mit dem alten Kernradius (30 Einheiten je Typradius)',
    kern.kante !== null && Math.abs(kern.kante - 16.5) < 0.2, kern);
  check('4d: die Kachel ist 128 px gross (auch der blaue Riese bleibt scharf)',
    kern.kachel && kern.kachel[0] === 128 && kern.kachel[1] === 128, kern);
  check('4e: der alte duenne weisse Ring um den Kern ist weg', kern.weisserRing === false, kern);

  await ende(async () => browser.close());
})();
