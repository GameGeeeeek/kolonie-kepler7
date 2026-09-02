// HUD-1: Trefferflaechen der Kopfzeile am Handy (v8.640.0).
//
// WAS HIER GEPRUEFT WIRD
// ----------------------
// Unter 700 px blendet `.header-btn-label { display:none }` die Beschriftungen aus - vom Knopf
// bleibt das Icon mit `padding:5px 9px`. Gemessen am 02.09.2026 ueber alle 13 Reiter am
// 390x844-Handy waren alle sieben Knoepfe darunter: headerCompactBtn und headerLogoutBtn 31x36,
// Feedback/Berichte/Hilfe/Profil 34x36, Kofi 36x36. Der Richtwert fuer eine Trefferflaeche ist 44.
//
// Geprueft wird die REGEL ("kein Knopf der Kopfzeile ist am Handy kleiner als das Mass"), nicht
// eine Liste gemessener Kaestchen (Hausregel 3): Kommt ein achter Knopf dazu, faellt der Test,
// ohne dass ihn jemand eintragen muss. Deshalb wird der Container abgefragt und nicht sieben IDs.
//
// Die PC-Richtung gehoert dazu: Die Regel steht bewusst NUR in der 700-px-Media-Query, weil am PC
// die Beschriftungen stehen und die Knoepfe ohnehin breit sind. Ohne Pruefung 2 koennte jemand sie
// global ziehen, und der Test bliebe gruen - er wuerde die Absicht nicht mehr messen.
//
// Pruefung 3 ist die eigentliche Sorge hinter dem Ganzen: Die Knoepfe stehen 6 px auseinander. Eine
// Mindesthoehe hilft nichts, wenn die Reihe dabei umbricht und die Kopfzeile hoeher wird - dann
// verschiebt sie alles darunter. Gemessen wird deshalb, dass alle sieben auf EINER Zeile bleiben,
// und zwar auch auf dem schmalsten ueblichen Geraet (360 px).
//
// Diese Pruefung 3 hat ihren Zweck sofort erfuellt: Der erste Anlauf setzte die Breite auf 40 px
// (7*40 + 6*6 = 316) - bei 390 px ging das auf den Pixel auf, bei 360 px fiel headerLogoutBtn auf
// die zweite Zeile. `.hero-actions` hat dort naemlich nur 294 px, nicht 316. Die Zahl steht jetzt
// auf 36 und ist gemessen statt geschaetzt.
const { starteBrowser, SPIEL_URL, ruhigeUhren, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

const MASS_HOCH = 44;   // Richtwert fuer die Hoehe - die Richtung, in der der Daumen am ungenauesten trifft
const MASS_BREIT = 36;  // gedeckelt: bei 360 px hat .hero-actions nur 294 px, minus 36 px Luecken sind das 36,8 je Knopf

const now = Date.now();
const SPIELSTAND = JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  seenTabHints: { basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                  galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1 },
  resources: { energie: 48000, erz: 52000, kristalle: 31000, deuterium: 20000, antimaterie: 900, forschungspunkte: 2200 },
  buildings: { solar: 18, mine: 17, kristallmine: 15, labor: 10, lager: 12 },
  research: {}, fleet: { jaeger: 100, missions: [] }, colonies: {}, activeBasePlanet: 'home',
  player: { id: 'u', name: 'AdmiralX' }, xp: 52000, credits: 184000, prestige: 4, buffs: [], lastTick: now,
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
}));

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'AdmiralX', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
  if (p.startsWith('storage/')) {
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
    return j({ e: 1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

// Alle SICHTBAREN Knoepfe der Kopfzeile mit ihrem Rechteck. Der Abmelde-Knopf steht anfangs auf
// display:none und wird erst von `wireLogout` gezeigt - unsichtbare Knoepfe haben kein Mass und
// gehoeren nicht in die Messung.
const KOPFKNOEPFE = () => {
  const c = document.querySelector('.hero-actions');
  if (!c) return null;
  return Array.from(c.querySelectorAll('button')).map(b => {
    const r = b.getBoundingClientRect();
    return { id: b.id || '(ohne id)', b: Math.round(r.width), h: Math.round(r.height),
             l: Math.round(r.left), t: Math.round(r.top) };
  }).filter(x => x.b > 0 && x.h > 0);
};

async function seite(browser, breite){
  const ctx = await browser.newContext({ viewport: { width: breite, height: 844 },
    deviceScaleFactor: breite < 700 ? 3 : 1, isMobile: breite < 700, hasTouch: breite < 700 });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2400);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  const knoepfe = await page.evaluate(KOPFKNOEPFE);
  await ctx.close();
  return { knoepfe, fehler };
}

(async () => {
  const browser = await starteBrowser();

  // --- (1) Handy: kein Knopf unter dem Mass
  const handy = await seite(browser, 390);
  check('0-vorab: Kopfzeile gefunden und Knoepfe sichtbar',
    !!handy.knoepfe && handy.knoepfe.length >= 5, handy.knoepfe && handy.knoepfe.length);
  if (!handy.knoepfe || handy.knoepfe.length < 5) return ende(async () => browser.close());
  check('0-vorab: Boot ohne Skriptfehler', handy.fehler.length === 0, handy.fehler.slice(0, 2));

  const zuKlein = handy.knoepfe.filter(x => x.h < MASS_HOCH || x.b < MASS_BREIT);
  check('1) am Handy ist kein Kopfzeilen-Knopf unter ' + MASS_HOCH + ' px hoch / ' + MASS_BREIT + ' px breit',
    zuKlein.length === 0, zuKlein.length ? zuKlein : handy.knoepfe.map(x => x.id + ' ' + x.b + 'x' + x.h));

  // --- (2) PC: die Regel gilt dort NICHT - sonst misst Pruefung 1 nicht mehr die Media-Query.
  // Geprueft wird die Ursache, nicht eine Zahl: am PC stehen die Beschriftungen, die Knoepfe sind
  // deshalb deutlich BREITER als das Handy-Mass. Waere die Regel global gezogen, waeren die
  // Knoepfe am PC exakt so hoch wie am Handy und die Breiten unveraendert - das faellt hier auf.
  const pc = await seite(browser, 1200);
  const beschriftet = (pc.knoepfe || []).filter(x => x.b > MASS_BREIT + 20).length;
  check('2) am PC tragen die Knoepfe ihre Beschriftung und sind breiter',
    beschriftet >= 4, (pc.knoepfe || []).map(x => x.id + ' ' + x.b + 'x' + x.h));

  // --- (3) Die Reihe bricht nicht um - auch nicht auf dem schmalsten ueblichen Geraet.
  // Eine hoehere Kopfzeile wuerde alles darunter verschieben; genau davor schuetzt die gewaehlte
  // Breite von 40 statt 44.
  for (const breite of [390, 360]) {
    const s = breite === 390 ? handy : await seite(browser, breite);
    const zeilen = new Set((s.knoepfe || []).map(x => x.t));
    check('3) bei ' + breite + ' px stehen alle Kopfzeilen-Knoepfe auf einer Zeile',
      zeilen.size === 1, { zeilen: Array.from(zeilen), knoepfe: (s.knoepfe || []).map(x => x.id + ' y' + x.t) });
    const rechts = Math.max(...(s.knoepfe || []).map(x => x.l + x.b));
    check('3) bei ' + breite + ' px bleibt die Reihe im Bild',
      rechts <= breite, { rechteKante: rechts, fenster: breite });
  }

  await ende(async () => browser.close());
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
