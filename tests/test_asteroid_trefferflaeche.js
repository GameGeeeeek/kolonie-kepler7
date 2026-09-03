// KB-22: Die Guertel-Vorkommen sind gross genug, um sie mit dem Finger zu treffen (v8.648.0).
//
// ANLASS: Spieler-Report vom 03.09.2026, "Asteroiden sind ueberhaupt nicht anklickbar".
//
// WAS DIE MESSUNG ERGAB, bevor etwas geaendert wurde - denn die Diagnose ist hier die halbe Arbeit:
// Der Klick-Weg ist voellig in Ordnung. Der Handler ist gebunden (ein Lauscher am SVG schweigt,
// weil der Handler stopPropagation ruft), galaxyMapDidDrag steht auf false, asteroidAn() findet das
// Vorkommen, und bei pixelgenauem Tippen oeffnet sich das Menue. Das Ziel war nur 8 px gross
// (Handy) bzw. 19 px (PC), waehrend ein Fingerkontakt rund 40 px misst. Zum Vergleich im selben
// Bild: Planet 20-37 px, NPC 45 px. Der Asteroid war das kleinste Klickziel der ganzen Karte.
//
// EINE FALLE, DIE DREI FALSCHE DIAGNOSEN GEKOSTET HAT: Das Kartenmenue hat KEINE id. Es ist
// `<div class="kmenu">` (openKarteMenu). Wer `#karteMenu` sucht, findet nie etwas und haelt einen
// funktionierenden Klick fuer kaputt. Deshalb sucht Pruefung 4 unten ueber die KLASSE.
//
// GEPRUEFT WIRD DIE REGEL, nicht die Momentaufnahme: nicht "das Feld ist 26 px", sondern
//   (a) kein Vorkommen liegt unter dem Mindestmass,
//   (b) kein Feld ueberlappt seinen Nachbarn - ein gestohlener Klick waere schlimmer als der
//       heutige Zustand, deshalb ist der Deckel Teil der Zusage und nicht nur eine Nebenbedingung,
//   (c) die Mitte trifft den eigenen Knoten,
//   (d) ein ECHTER Tap oeffnet das Menue.
// Kommt eine fuenfte Asteroidengroesse dazu oder aendert sich die Bahngeometrie, faellt der Test,
// ohne dass jemand eine Zahl nachtragen muss.
const { starteBrowser, SPIEL_URL, ruhigeUhren, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

// WCAG 2.2 AA verlangt 24x24 CSS-Pixel. Der Komfort-Richtwert von 44 wird auf der Guertelbahn
// bewusst NICHT erzwungen: Die zehn Plaetze stehen an den schmalen Enden der Ellipse so dicht,
// dass ein 44-px-Feld dem Nachbarn den Klick abnaehme.
const MIN_PX = 24;

const now = Date.now();
const SPIELSTAND = JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: { basis:1, karte:1, galaxie:1 },
  resources: { energie:148000, erz:152000, kristalle:131000, deuterium:92000, antimaterie:3900, forschungspunkte:12200 },
  buildings: { solar:18, mine:17, kristallmine:15, labor:10, lager:12, werft:8 },
  research: {}, fleet: { jaeger:120, transporter:30, missions:[] }, colonies: {},
  activeBasePlanet: 'home', player: { id:'u', name:'AdmiralX' }, xp:152000, credits:384000,
  prestige: 4, buffs: [], lastTick: now, colonyNames: {}, colonyNotes: {}, modules: {},
  shipModules: {}, equippedShipModules: {}, moduleFragments: 12
}));

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'AdmiralX', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
  if (p.startsWith('storage/')) { const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 }); return j({ e: 1 }, 404); }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))
    return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

async function messen(browser, name, vp, mobil){
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobil, hasTouch: mobil, deviceScaleFactor: mobil ? 2 : 1 });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI); await page.waitForTimeout(2600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(900);
  await oeffneSystemUeberSektoren(page, 'kepler');
  await page.waitForTimeout(1300);

  const m = await page.evaluate(() => {
    const kn = [...document.querySelectorAll('[data-map-asteroid]')];
    const rechtecke = kn.map(n => n.getBoundingClientRect());
    let ueberlappt = 0;
    for (let i = 0; i < kn.length; i++) for (let j = i + 1; j < kn.length; j++) {
      const a = rechtecke[i], b = rechtecke[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) ueberlappt++;
    }
    const mitteTrifft = kn.map((n, i) => {
      const r = rechtecke[i];
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!(el && (el === n || n.contains(el)));
    });
    return {
      anzahl: kn.length,
      masse: rechtecke.map(r => Math.round(Math.min(r.width, r.height))),
      ueberlappt,
      mitteTrifft: mitteTrifft.filter(Boolean).length,
      // Der Marker selbst darf NICHT mitgewachsen sein - das Trefferfeld ist unsichtbar.
      polygone: kn.map(n => { const p = n.querySelector('polygon'); return p ? Math.round(p.getBoundingClientRect().width) : 0; })
    };
  });

  // Der ECHTE Tap - mit mousedown/touchstart, die den Drag-Riegel zuruecksetzen. Ein reines
  // dispatchEvent('click') tut das nicht und misst dann das eigene Werkzeug statt des Spiels.
  let menue = { da: false, text: '' };
  const box = m.anzahl ? await page.locator('[data-map-asteroid]').first().boundingBox() : null;
  if (box) {
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    if (mobil) await page.touchscreen.tap(cx, cy);
    else { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.up(); }
    await page.waitForTimeout(600);
    menue = await page.evaluate(() => {
      const k = document.querySelector('.kmenu');
      return { da: !!k, text: k ? (k.innerText || '').replace(/\n/g, ' | ').slice(0, 60) : '' };
    });
  }
  await ctx.close();
  return Object.assign(m, { menue, fehler, name });
}

(async () => {
  const browser = await starteBrowser();
  for (const [name, vp, mobil] of [['Handy', { width: 390, height: 844 }, true],
                                   ['PC', { width: 1400, height: 900 }, false]]) {
    const m = await messen(browser, name, vp, mobil);
    check('0-vorab (' + name + '): Guertel-Vorkommen auf der Karte gefunden', m.anzahl >= 2, m.anzahl);
    if (m.anzahl < 2) continue;
    check('0-vorab (' + name + '): Boot ohne Skriptfehler', m.fehler.length === 0, m.fehler.slice(0, 2));

    const klein = m.masse.filter(x => x < MIN_PX);
    check('1 (' + name + '): kein Vorkommen unter ' + MIN_PX + ' px Trefferflaeche',
      klein.length === 0, { masse: m.masse, zuKlein: klein });

    check('2 (' + name + '): keine zwei Trefferfelder ueberlappen',
      m.ueberlappt === 0, { ueberlappungen: m.ueberlappt });

    check('3 (' + name + '): die Mitte jedes Vorkommens trifft es selbst',
      m.mitteTrifft === m.anzahl, { trifft: m.mitteTrifft, von: m.anzahl });

    check('4 (' + name + '): ein echter Tap oeffnet das Kartenmenue',
      m.menue.da && /ASTEROID/i.test(m.menue.text), m.menue);

    // Das Trefferfeld ist unsichtbar: der gezeichnete Brocken bleibt so klein wie zuvor.
    check('5 (' + name + '): der sichtbare Marker ist NICHT mitgewachsen',
      m.polygone.every(p => p > 0 && p < MIN_PX), { polygonBreiten: m.polygone });
  }
  await ende(async () => browser.close());
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
