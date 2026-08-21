// Größe der Planetendarstellung in der geöffneten Systemebene (Etappe KB-12, Spieler-Report Sascha
// mit Screenshot: "Also die Karte ist wirklich extrem mini, also noch noch kleiner und ich brauch
// echt eine Lupe. Kannst Du das mal bitte anpassen, dass die genauso groß ist wie die Karte davor?").
//
// WAS HIER GEPRÜFT WIRD - und warum ausgerechnet das
// --------------------------------------------------
// KB-10 und KB-11 haben beide an der KASTENHÖHE bzw. am Skala-Deckel gedreht und beide Male war die
// Karte danach immer noch zu klein. Der Grund ist geometrisch: Die Systemebene zeichnete einen
// 600×180 Einheiten breiten STREIFEN (Orbits rx = 42+orbit*43, Ellipsen ry = rx*0,3). Wer auf einem
// ~348 px breiten Handy-Kasten alle Planeten zeigen will, kann damit höchstens 0,85 vergrößern -
// EGAL wie hoch der Kasten ist, denn begrenzend ist die BREITE. Deshalb misst dieser Test die einzige
// Größe, um die es dem Spieler ging: den PLANETENDURCHMESSER IN PIXELN auf dem Gerät.
// Am Stand vor KB-12 sind das 12 px, danach 20 px.
//
// Und er misst die Gegenrichtung mit, weil sie beim Bauen tatsächlich schiefging: Die rundere Form
// braucht einen höheren Kasten - wird der aber AUCH am breiten PC-Kasten hochgezogen (dort gilt
// weiter die flache Zeichnung), entsteht wieder toter Raum, und die Kastenmitte rutscht unter den
// Fensterrand. Gemessen: 325 -> 480 px Kastenhöhe, `elementFromPoint` auf der Kastenmitte lieferte
// null, das Ziehen der Karte kam gar nicht mehr an (test_kartenbedienung 2a/2b, Treue 1 -> 0).
// Prüfung 3 hält genau das fest.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1):
//   grün:  node tests/test_kartengroesse.js
//   rot:   am Stand VOR KB-12 - Prüfung 1 meldet 12 px statt >= 16,
//          Prüfung 2 ein flaches Kastenverhältnis:
//          KEPLER_SPIELDATEI=/tmp/vor_kb12.html node tests/test_kartengroesse.js
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

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

function spielstand() {
  const now = Date.now();
  return JSON.stringify({
    tutorialSeen: true, newbieWelcomeSeen: true,
    /* Die Tab-Hinweisleiste abschalten (19.08.2026). Sie ist 166 px hoch, steht ÜBER dem
       Tab-Inhalt, und ihr Erscheinen ist ein RENNEN: `maybeShowTabHint` blendet sie aus, solange
       ein Overlay steht (`tabHintBlocked()`) - die Tests blenden die Overlays in ihrer
       Vorbereitung aus, und ob danach noch ein Haupt-Tick läuft, entscheidet, ob die Leiste da ist.
       Damit wandert alles darunter um 166 px, und Prüfungen auf Fensterlage schlagen an, ohne dass
       am Spiel etwas falsch wäre. Gemessen an drei Fehlschlägen in drei aufeinanderfolgenden
       Prüfläufen (test_kartenbedienung, test_kartengroesse, test_sprungleiste), jeder einzeln grün.
       test_reiterleiste.js macht das seit jeher richtig - hier fehlte es. */
    seenTabHints: { basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                    galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1 },
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, missions: [] }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    // Ereignis-Uhr in die Zukunft pinnen (Hausregel 18) - der erste Planeten-Ereignis-Check feuert
    // sonst GARANTIERT und schreibt mitten in der Messung Boxen neu.
    nextPlanetEventCheck: now + 3600000
  });
}

// Öffnet das Heimatsystem auf dem angegebenen Viewport und misst die Darstellung.
async function messeSystem(browser, store, viewport, mobil) {
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
  /* KB-20: Die Kastenhoehe der SEKTORANSICHT, gemessen bevor ein System offen ist. Der
     Spieler-Report vom 21.08.2026 lautete "karten sind unterschiedlich gross bitte selbe groesse
     wie die groessere karte" - genau dieser Vergleich hat bis dahin nirgends stattgefunden. */
  const sektorHoehe = await page.evaluate(() => {
    const w = document.querySelector('#tab-karte .map-wrap');
    return w ? Math.round(w.getBoundingClientRect().height) : 0;
  });
  await oeffneSystemUeberSektoren(page, 'kepler');
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    const wrap = document.querySelector('#tab-karte .map-wrap').getBoundingClientRect();
    // Gemessen wird die SCHEIBE, nicht die Gruppe: Das Umriss-Rechteck von .planet-node enthält die
    // Beschriftung und hinge damit an der Schriftgröße statt an der Kartengeometrie (dieselbe Falle
    // wie in test_kartenbedienung, Punkt a).
    //
    // Die Scheibe ist je nach Planetentyp ein <image> (Textur, über eine clipPath-Maske) oder ein
    // circle.body - beides ist genau r*2 breit. Nach dem r-Attribut zu suchen wäre falsch: Die
    // clipPath-MASKE trägt denselben Radius, liegt aber in <defs> und liefert ein leeres Rechteck
    // bei 0/0. Genau daran hat dieser Test beim ersten Lauf 7 von 8 Planeten als "außerhalb des
    // Kastens" gemeldet - am PC-Stand ebenso, wo sich gar nichts geändert hatte.
    let groesste = 0, anzahl = 0, draussen = 0;
    document.querySelectorAll('#galaxyMapSvg .planet-node').forEach(g => {
      const c = g.querySelector('image') || g.querySelector('circle.body');
      if (!c) return;
      const b = c.getBoundingClientRect();
      anzahl++;
      groesste = Math.max(groesste, b.width);
      if (b.left < wrap.left - 2 || b.right > wrap.right + 2 || b.top < wrap.top - 2 || b.bottom > wrap.bottom + 2) draussen++;
    });
    // Liegt die Mitte des Kartenkastens überhaupt im Fenster? Nur dort kommt ein Zeiger-Ereignis an.
    const mx = wrap.left + wrap.width / 2, my = wrap.top + wrap.height / 2;
    const imFenster = mx >= 0 && my >= 0 && mx <= window.innerWidth && my <= window.innerHeight;
    const unterMitte = imFenster ? document.elementFromPoint(mx, my) : null;
    /* KB-20: Seit der Kasten am PC so hoch ist wie die Sektoransicht, ist er hoeher als der
       sichtbare Fensterausschnitt - genau wie die Sektoransicht das seit jeher ist. Die
       GEOMETRISCHE Mitte liegt dann unter der Fensterkante, obwohl die Karte tadellos bedienbar
       ist: Der Spieler greift dorthin, wo er hinsieht. Gemessen wird deshalb zusaetzlich die
       SICHTBARE Mitte - das ist die Stelle, an der ein echter Zeiger ankommt. */
    const sy0 = Math.max(0, wrap.top), sy1 = Math.min(window.innerHeight, wrap.bottom);
    const sichtHoehe = Math.max(0, sy1 - sy0);
    const sichtY = sy0 + sichtHoehe / 2;
    const unterSicht = sichtHoehe > 20 ? document.elementFromPoint(mx, sichtY) : null;
    /* Und die Eigenschaft, die die alte Schranke "der PC-Kasten bleibt flach" schuetzen sollte:
       KEIN toter Raum. Statt die Kastenform vorzuschreiben wird gemessen, wie viel der Kastenhoehe
       die Zeichnung wirklich belegt (aeusserste Planetenscheiben plus Rand). */
    let oben = Infinity, unten = -Infinity;
    document.querySelectorAll('#galaxyMapSvg .planet-node').forEach(g => {
      const c = g.querySelector('image') || g.querySelector('circle.body');
      if (!c) return;
      const b = c.getBoundingClientRect();
      if (b.width <= 0) return;
      oben = Math.min(oben, b.top); unten = Math.max(unten, b.bottom);
    });
    const fuellung = (unten > oben && wrap.height > 0) ? +((unten - oben) / wrap.height).toFixed(3) : 0;
    /* Form der ZEICHNUNG in SVG-Nutzerkoordinaten (also zoom- und kastenunabhaengig): Die flache
       Streifen-Geometrie liegt bei ~0,35, die runde bei ~0,9. Gebraucht wird sie fuer Abschnitt 5 -
       dort ist die Frage nicht, wie gross etwas ist, sondern WELCHE der beiden Zeichnungen gilt. */
    let zx0 = Infinity, zx1 = -Infinity, zy0 = Infinity, zy1 = -Infinity, zn = 0;
    document.querySelectorAll('#galaxyMapSvg .planet-node[data-planet]').forEach(g => {
      const bb = g.getBBox(); zn++;
      zx0 = Math.min(zx0, bb.x); zx1 = Math.max(zx1, bb.x + bb.width);
      zy0 = Math.min(zy0, bb.y); zy1 = Math.max(zy1, bb.y + bb.height);
    });
    const zeichnungVerh = zn ? +((zy1 - zy0) / (zx1 - zx0)).toFixed(2) : null;
    return {
      zeichnungVerh,
      durchmesserPx: Math.round(groesste), planeten: anzahl, draussen,
      kasten: { w: Math.round(wrap.width), h: Math.round(wrap.height) },
      verhaeltnis: +(wrap.height / wrap.width).toFixed(3),
      mitteImFenster: imFenster,
      mitteTrifft: unterMitte ? (unterMitte.id || unterMitte.tagName) : null,
      sichtMitteTrifft: unterSicht ? (unterSicht.id || unterSicht.tagName) : null,
      fuellung,
      viewBox: svg ? svg.getAttribute('viewBox') : null
    };
  });
  m.sektorHoehe = sektorHoehe;
  m.fehler = fehler.slice(0, 2);
  await ctx.close();
  return m;
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  store['kepler7-save-v3'] = spielstand();

  // ---- Handy (Report-Gerät: 390×844) ----------------------------------------------------------
  const handy = await messeSystem(browser, store, { width: 390, height: 844 }, true);
  check('0-vorab: Handy - Boot ohne Skriptfehler', handy.fehler.length === 0, handy.fehler);
  check('0-vorab: Handy - die Planeten des Systems sind gezeichnet', handy.planeten >= 4, handy);

  // 16 px ist bewusst kein Wunschwert, sondern die MITTE zwischen gemessen 12 (vorher) und 20
  // (nachher): Der Test hält die REGEL fest ("deutlich größer als der Streifen es zuließ"), nicht
  // die Momentaufnahme einer Zahl, die sich beim nächsten Feinschliff um ein Pixel verschiebt
  // (Hausregel 3).
  check('1: die Planetenscheibe ist am Handy deutlich größer als vor KB-12 (>= 16 px)',
    handy.durchmesserPx >= 16, handy);
  check('1b: dabei fällt kein Planet aus dem Kartenkasten', handy.draussen === 0, handy);

  // Die rundere Bahnform und die höhere Kastenform gehören zusammen - fehlt eine der beiden,
  // beschneidet die Kamera den Inhalt oben und unten, statt ihn zu vergrößern.
  check('2: der Kartenkasten ist am Handy hoch genug für die runden Bahnen (h/b >= 0,6)',
    handy.verhaeltnis >= 0.6, handy);

  /* ---- PC, hoher Kasten -----------------------------------------------------------------------
     KORREKTUR 21.08.2026: Hier stand "breiter Kasten: dort gilt weiter die flache Zeichnung". Das
     stimmte bis KB-12/KB-11 und ist seit KB-20 falsch - welche Zeichnung gilt, haengt nicht mehr an
     der FENSTERBREITE, sondern an der FORM des Kastens (kbRunderKasten: Zielhoehe/Breite > 0,5).
     Bei 900x1000 ist der Kasten hoch, also liegen die Bahnen hier RUND. Das flache Band bekommt
     deshalb einen eigenen Abschnitt 5 - eine Ueberschrift, die eine alte Annahme festhaelt, ist
     eine zweite Anzeigestelle (Punkt 6 der Checkliste). */
  const pc = await messeSystem(browser, store, { width: 900, height: 1000 }, false);
  check('0-vorab: PC - Boot ohne Skriptfehler', pc.fehler.length === 0, pc.fehler);
  /* KORREKTUR 21.08.2026 (KB-20, Spieler-Report "karten sind unterschiedlich gross bitte selbe
     groesse wie die groessere karte"): Hier stand "der PC-Kasten bleibt flach (h/b <= 0,5) - sonst
     wieder toter Raum". Der Kasten ist am PC jetzt bewusst so hoch wie die Sektoransicht, und die
     Bahnen liegen dort rund - die Zeichnung waechst also mit, statt in einem leeren Rahmen zu
     stehen. Die Schranke beschrieb damit ein Verhalten, das absichtlich aufgehoben wurde
     (Hausregel 45); geprueft wird jetzt das, was sie MEINTE: kein toter Raum.

     Die Schranke ist GEMESSEN, nicht gewaehlt - alle drei Werte bei 900x1000, Kasten 738 breit:
       Stand vor KB-20 (Kasten 325 px, flach) ........ Fuellung 0,556, Planet 23 px
       KB-20 (Kasten 825 px, runde Bahnen) ........... Fuellung 0,514, Planet 43 px
       nur die Hoehe angehoben, Zeichnung flach ...... Fuellung 0,219, Planet 23 px  <- der Fall,
         den diese Pruefung fangen MUSS: ein hoher Kasten mit dem alten flachen Streifen darin.
     Die Fuellung bleibt durch KB-20 also praktisch gleich (0,556 -> 0,514), waehrend die Planeten
     fast doppelt so gross werden. 0,40 liegt mit Abstand zwischen dem leeren Rahmen und beiden
     gesunden Staenden. */
  check('3: die Zeichnung fuellt den PC-Kasten (kein toter Raum, >= 0,40 der Hoehe)',
    pc.fuellung >= 0.40, pc);
  check('3a: und die Planetenscheibe ist am PC deutlich groesser als vor KB-20 (>= 32 px)',
    pc.durchmesserPx >= 32, pc);
  check('3b-vorab: dabei faellt kein Planet aus dem Kartenkasten', pc.draussen === 0, pc);
  /* Das eigentliche Schadensbild der zu hohen Fassung von KB-12 war nicht die Hoehe, sondern dass
     ein Zeiger-Ereignis die Karte nicht mehr erreichte. Der Kasten ist jetzt hoeher als das
     Fenster (wie die Sektoransicht seit jeher) - gemessen wird deshalb die SICHTBARE Mitte, also
     die Stelle, an der ein echter Zeiger ankommt. */
  check('3b: die sichtbare Mitte des PC-Kartenkastens trifft die Karte',
    pc.sichtMitteTrifft !== null, pc);

  /* ---- 4) Der Spieler-Report selbst: springt der Kasten beim Oeffnen? (KB-20) -----------------
     Gemessen am Stand davor: Sektoransicht 325 px, Systemebene 325 px bei 900x1000 - dort war es
     zufaellig gleich; bei 1920x1040 dagegen 865 gegen 420 px, und genau das hat Sascha gemeldet.
     Geprueft wird deshalb auf einem BREITEN Fenster, wo der alte Deckel von 420 px wirklich bindet. */
  const breit = await messeSystem(browser, store, { width: 1600, height: 1040 }, false);
  check('4-vorab: PC breit - Boot ohne Skriptfehler', breit.fehler.length === 0, breit.fehler);
  check('4: der Kartenkasten springt beim Oeffnen eines Systems nicht mehr (gleiche Hoehe wie die Sektoransicht)',
    breit.sektorHoehe > 0 && Math.abs(breit.kasten.h - breit.sektorHoehe) <= 2,
    { sektoransicht: breit.sektorHoehe, systemebene: breit.kasten.h, planetPx: breit.durchmesserPx });

  /* Die Gegenrichtung, und sie ist eine bewusste Entscheidung, keine Luecke: Am HANDY bleibt die
     Kastenhoehe, wie KB-10/11/12 sie eingestellt haben. Dort ist die BREITE die bindende Richtung -
     ein gleich hoher Kasten waere gemessen zu 63% leer und die Planeten blieben bei 20 px, also
     genau der tote Raum, den KB-10 entfernt hat. Faellt diese Zeile, hat jemand das Handy
     mitangeglichen, ohne diesen Absatz zu lesen. */
  check('4b: am Handy bleibt die Systemebene bewusst flacher als die Sektoransicht',
    handy.sektorHoehe > handy.kasten.h + 20,
    { sektoransicht: handy.sektorHoehe, systemebene: handy.kasten.h });

  /* ---- 5) Das FLACHE Band: breites, niedriges Fenster (KB-20d) -------------------------------
     Zwischen Handy und hohem PC-Kasten liegt ein dritter Fall, den KB-20 zunaechst uebersehen
     hatte: ein breites, aber niedriges Fenster. Dort ist der Kasten flach genug, dass die alte
     Streifen-Zeichnung ihn ausfuellt - die volle Sektor-Hoehe waere hier genau der tote Raum, den
     der Kommentar ueber kbSchmalerKasten seit KB-12 verbietet. Gemessen bei 1920x700: Zielhoehe
     max(480, 700-175) = 525 gegen 1258 px Kastenbreite, Verhaeltnis 0,417 - also unter der
     0,5-Schranke von kbRunderKasten.
     Geprueft wird das PAAR: flache Zeichnung UND flache Kastenhoehe. Jede Haelfte allein waere
     auch dann erfuellt, wenn die andere danebenliegt - und genau dieses Auseinanderlaufen ist der
     Fehler, gegen den der Abschnitt geschrieben ist. */
  const flach = await messeSystem(browser, store, { width: 1920, height: 700 }, false);
  check('5-vorab: flaches Band - Boot ohne Skriptfehler', flach.fehler.length === 0, flach.fehler);
  check('5: im flachen Band gilt die flache Zeichnung UND die flache Kastenhoehe',
    flach.zeichnungVerh !== null && flach.zeichnungVerh < 0.5 && flach.kasten.h <= 420,
    { zeichnungVerh: flach.zeichnungVerh, kasten: flach.kasten, sektorHoehe: flach.sektorHoehe });
  check('5b: und die Zeichnung fuellt den Kasten auch dort (kein toter Raum)',
    flach.fuellung >= 0.40, flach);

  await ende(async () => browser.close());
})();
