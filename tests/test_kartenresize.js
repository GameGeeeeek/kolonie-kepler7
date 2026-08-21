// Der Kartenkasten folgt einer Fenstergrößenänderung bei OFFENEM System (Etappe KB-20e).
//
// WARUM ES DIESEN TEST ERST JETZT GIBT
// ------------------------------------
// Bis KB-20 kam der Kamera-Ausschnitt der Systemebene aus der BREITE des Kastens, und die
// Kastenhöhe folgte ihr (0,44 bzw. 0,78 der Breite). Ein niedrigeres Fenster war damit folgenlos:
// Beide Größen hingen an derselben Zahl und stimmten nach jedem Neuzeichnen von selbst wieder.
// Seit KB-20 ist am breiten Kasten die HÖHE die bindende Richtung, und ob rund oder flach
// gezeichnet wird, entscheidet die FORM des Kastens (kbRunderKasten). Damit können Kastenhöhe,
// Zeichnung und Kamera aus drei verschiedenen Momenten stammen.
//
// GEMESSEN am Stand ohne den Nachzug (1920x1040 -> 1920x780, System mit Orbit 10):
//   direkt nach der Größenänderung sieht alles unauffällig aus - Kasten 1258x605, runde Zeichnung,
//   Kamera unverändert. Erst der nächste Neuaufbau (EIN Zoom-Klick genügt) löst alles auf einmal
//   ein: Kasten springt auf 420 px, die Zeichnung kippt auf flach (755x262 Einheiten), und die
//   Kamera zeigt sie durch ein Fenster, das für die runde Form gerechnet war - gemessen liegen
//   danach SECHS Planeten außerhalb des Kastens, bis zu 1713 px rechts und 585 px links.
//
// WAS GEPRÜFT WIRD - und warum genau das
// --------------------------------------
// Nicht einzelne Zahlen (die verschieben sich beim nächsten Feinschliff), sondern die EIGENSCHAFT:
// Nach einer Größenänderung steht die Karte so da, wie sie stünde, wenn das Fenster von Anfang an
// diese Größe gehabt hätte. Deshalb läuft jede Messung als PAAR - einmal mit Größenänderung,
// einmal als Kontrolle direkt in der Zielgröße.
//
// GEGENPROBE (beide Richtungen gefahren, Hausregel 1) - an einer Kopie, in der der Nachzug nichts
// tut (`setTimeout(function(){ kbFensterTimer = null; }, 220)`):
//   grün:  node tests/test_kartenresize.js
//   rot:   KEPLER_SPIELDATEI=/tmp/kb20e_ohne.html node tests/test_kartenresize.js
//          → fallen MÜSSEN: 1, 2, 3 (und nur die), bei identischen Prüfnamen in beiden Läufen.
//            Bleibt eine davon grün, ist es ein Werkzeugfehler und kein bestandener Test
//            (Hausregel 71). Prüfung 2 nennt dabei die sechs Planeten, die aus dem Kasten fallen:
//            {"draussen":["gx031","gx032","gx033","gx034","gx035","gx036"]}.
//
//   1b BLEIBT bei der Gegenprobe ausdrücklich GRÜN, und das ist kein Mangel, sondern der Kern des
//   Befunds: Direkt nach der Größenänderung stimmen Zeichnung und Kamera ohne Nachzug noch
//   miteinander überein (beide rund) - nur der KASTEN nicht mehr. Erst der nächste Neuaufbau löst
//   den Widerspruch ein. Eine Prüfung, die nur diesen einen Moment ansieht, hätte den Fehler also
//   nie gefunden; 1b ist eine Wache für die richtige Richtung, nicht der Beweis (Hausregel 28).
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

// Ein System mit dem größten vorkommenden Orbit (10): Dort ist der Unterschied zwischen runder und
// flacher Bahn am größten, und nur dort fällt eine falsch gezielte Kamera wirklich auf.
const SYSTEM = 'sys_corvus_weite';
const BREIT = 1920, HOCH = 1040, NIEDRIG = 780;   // 780 liegt unter der kbRunderKasten-Schwelle

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
    /* Tab-Hinweisleiste abschalten (Hausregel 63): 166 px hoch, steht ÜBER dem Tab-Inhalt und
       verschiebt jede gemessene Fensterlage - genau das messe ich hier. */
    seenTabHints: { basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                    galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1 },
    resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
    buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12, werft: 9 },
    research: {}, fleet: { jaeger: 100, missions: [] }, colonies: {}, activeBasePlanet: 'home',
    player: { id: 'u', name: 'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {},
    // Ereignis-Uhren pinnen (Hausregel 18) - sonst schreibt der erste Planeten-Ereignis-Check
    // GARANTIERT mitten in der Messung Boxen neu.
    nextPlanetEventCheck: now + 3600000, nextTraderCheck: now + 3600000
  });
}

// Liest den vollständigen Zustand der Systemebene: Kasten, Kamera, Form der ZEICHNUNG und alles,
// was aus dem Kasten fällt. Die Zeichnungsform kommt aus getBBox() in SVG-Nutzerkoordinaten, ist
// also zoom-unabhängig - eine runde Bahn liegt bei ~0,9, eine flache bei ~0,35.
const ZUSTAND = () => {
  const wrap = document.querySelector('#tab-karte .map-wrap');
  const svg = document.getElementById('galaxyMapSvg');
  if (!wrap || !svg) return null;
  const r = wrap.getBoundingClientRect();
  const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
  const knoten = [...svg.querySelectorAll('.planet-node[data-planet]')];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, draussen = [];
  for (const k of knoten) {
    const bb = k.getBBox();
    x0 = Math.min(x0, bb.x); x1 = Math.max(x1, bb.x + bb.width);
    y0 = Math.min(y0, bb.y); y1 = Math.max(y1, bb.y + bb.height);
    // Gemessen wird die SCHEIBE, nicht die Gruppe - deren Rechteck enthält die Beschriftung und
    // hinge damit an der Schriftgröße statt an der Kartengeometrie (Hausregel 51).
    const c = k.querySelector('image') || k.querySelector('circle.body');
    if (!c) continue;
    const b = c.getBoundingClientRect();
    if (!(b.width > 0)) continue;
    if (b.left < r.left - 2 || b.right > r.right + 2 || b.top < r.top - 2 || b.bottom > r.bottom + 2) {
      draussen.push(k.getAttribute('data-planet'));
    }
  }
  return {
    fenster: window.innerWidth + 'x' + window.innerHeight,
    kastenB: Math.round(r.width), kastenH: Math.round(r.height),
    kastenVerh: +(r.height / r.width).toFixed(3),
    viewBox: vb.length === 4 ? vb.map(n => +n.toFixed(1)).join(' ') : null,
    kameraVerh: vb.length === 4 ? +(vb[3] / vb[2]).toFixed(3) : null,
    zeichnungVerh: knoten.length ? +((y1 - y0) / (x1 - x0)).toFixed(2) : null,
    planeten: knoten.length, draussen
  };
};

// Öffnet SYSTEM auf `start` und misst; ist `ziel` gesetzt, wird das Fenster danach umgestellt und
// nach der Entprellung (220 ms) erneut gemessen.
async function lauf(browser, store, start, ziel) {
  const ctx = await browser.newContext({ viewport: start });
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
  await oeffneSystemUeberSektoren(page, SYSTEM);
  await page.waitForTimeout(1400);
  const vorher = await page.evaluate(ZUSTAND);
  let nachher = null, nachNeuaufbau = null;
  if (ziel) {
    await page.setViewportSize(ziel);
    await page.waitForTimeout(1600);          // 220 ms Entprellung plus ein Tick Luft
    nachher = await page.evaluate(ZUSTAND);
    /* Der dritte Messpunkt ist der eigentliche Beweis: Ohne Nachzug sieht direkt nach der
       Größenänderung noch alles unauffällig aus - erst der nächste Neuaufbau löst die drei
       auseinandergelaufenen Entscheidungen auf einmal ein. Ein Zoom-Klick ist die billigste
       Handlung, die einen solchen Neuaufbau auslöst. */
    await page.evaluate(() => { const b = document.getElementById('galaxyZoomInBtn'); if (b) b.click(); });
    await page.waitForTimeout(1400);
    nachNeuaufbau = await page.evaluate(ZUSTAND);
  }
  await ctx.close();
  return { vorher, nachher, nachNeuaufbau, fehler: fehler.slice(0, 2) };
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  store['kepler7-save-v3'] = spielstand();

  // Der Lauf mit Größenänderung ...
  const um = await lauf(browser, store, { width: BREIT, height: HOCH }, { width: BREIT, height: NIEDRIG });
  // ... und die KONTROLLE: dasselbe Fenster von Anfang an. Sie ist die Bezugsgröße, gegen die
  // gemessen wird - ein fest eingetippter Erwartungswert würde beim nächsten Feinschliff verrotten
  // (Hausregel 2).
  const kontrolle = await lauf(browser, store, { width: BREIT, height: NIEDRIG }, null);

  check('0-vorab: Boot ohne Skriptfehler', um.fehler.length === 0 && kontrolle.fehler.length === 0,
    { um: um.fehler, kontrolle: kontrolle.fehler });
  check('0-vorab: das System ist offen und gezeichnet',
    !!(um.vorher && um.vorher.planeten >= 6 && um.nachher && kontrolle.vorher && kontrolle.vorher.planeten >= 6),
    { vorher: um.vorher, kontrolle: kontrolle.vorher });
  /* Ohne Schwellenübertritt misst dieser Test gar nichts: Die Ausgangsgröße MUSS die runde
     Zeichnung ergeben und die Zielgröße die flache. Fällt diese Zeile, ist die Fixture gewandert
     (etwa weil sich die Schwelle verschoben hat) - dann sind die Prüfungen darunter vacuous, und
     das steht dann im Protokoll statt in einer späteren Sitzung (Hausregel 37). */
  check('0-vorab: die Größenänderung überschreitet die Schwelle rund → flach',
    !!(um.vorher && kontrolle.vorher) && um.vorher.zeichnungVerh > 0.6 && kontrolle.vorher.zeichnungVerh < 0.5,
    { start: um.vorher && um.vorher.zeichnungVerh, ziel: kontrolle.vorher && kontrolle.vorher.zeichnungVerh });

  const n = um.nachher || {}, k = kontrolle.vorher || {};
  /* DIE Eigenschaft: Nach der Größenänderung steht die Karte so da, wie sie stünde, wenn das
     Fenster von Anfang an diese Größe gehabt hätte. Kastenhöhe, Zeichnungsform und Kamera werden
     zusammen geprüft - jede einzeln wäre auch dann erfüllt, wenn die anderen zwei auseinander
     lägen, und genau dieses Auseinanderlaufen ist der Fehler. */
  check('1: nach der Größenänderung stimmen Kastenhöhe, Zeichnung und Kamera mit einem Fenster überein, das von Anfang an so groß war',
    n.kastenH === k.kastenH && n.zeichnungVerh === k.zeichnungVerh && n.viewBox === k.viewBox,
    { nachAenderung: n, kontrolle: k });
  check('1b: dabei fällt kein Planet aus dem Kartenkasten',
    Array.isArray(n.draussen) && n.draussen.length === 0, n);

  /* Der Neuaufbau danach ist der Messpunkt, an dem der Fehler ohne Nachzug wirklich sichtbar
     wurde. Verglichen wird wieder gegen die Kontrolle: Ein Zoom-Klick schiebt naturgemäß Planeten
     aus dem Bild - die Frage ist nicht OB, sondern ob mehr als bei einem Fenster, das nie
     verändert wurde (Hausregel 53: wer etwas verschiebt, misst die neue Stelle mit). */
  const nn = um.nachNeuaufbau || {}, kn = kontrolle.nachNeuaufbau;
  check('2: auch der nächste Neuaufbau bleibt bei der Zeichnungsform und lässt nicht mehr Planeten aus dem Kasten fallen als ohne Größenänderung',
    nn.zeichnungVerh === k.zeichnungVerh && Array.isArray(nn.draussen) && nn.draussen.length <= 2,
    { nachNeuaufbau: nn, kontrolleVorher: k });

  /* Gegenrichtung: Die Kamera muss dem Kasten IMMER folgen, auch wenn die Schwelle gar nicht
     berührt wird - sonst hätte man den Fehler nur an einer Stelle behoben. Gemessen wird das
     Seitenverhältnis, weil genau daran der Ausschnitt hängt. */
  const um2 = await lauf(browser, store, { width: BREIT, height: HOCH }, { width: BREIT, height: 900 });
  const n2 = um2.nachher || {};
  check('3: auch ohne Schwellenübertritt folgt der Kamera-Ausschnitt der neuen Kastenform',
    Math.abs((n2.kameraVerh || 0) - (n2.kastenVerh || 0)) <= 0.02, n2);

  await browser.close();
  ende();
})();
