// LB-1: Die Zeilen, die erklaeren WARUM etwas gesperrt ist, sind lesbar (v8.658.0).
//
// GEMESSEN am 03.09.2026 ueber alle 13 Reiter: Von den beanstandeten Textstellen im ganzen Spiel
// waren in der Flotte 67 von 67 und in der Forschung 42 von 42 genau diese Zeilen - "Benoetigt: …"
// und "Voraussetzung: …". Sie trugen ein Inline-Override `style="color:#6b6f85;"` auf einem
// Element, das mit `.bmeta` bereits die gedaempfte Hausfarbe hat (`--ink-dim: #9296ac`). Das
// zweite Daempfen war Doppelung, nicht Absicht - gemessener Kontrast 3,88 gegen die WCAG-Schranke
// von 4,5; ohne das Override 6,58.
//
// Ausgerechnet die Zeile, die dem Spieler sagt, was ihm fehlt, war damit die schlechtest lesbare
// der Karte. Wer nicht erkennen kann, WARUM ein Knopf grau ist, probiert es blind weiter.
//
// GEPRUEFT WIRD DER KONTRAST, nicht der Quelltext: Eine Regex auf `style="color:…"` waere beim
// naechsten Farbwechsel blind. Gemessen wird die gerechnete Farbe gegen den tatsaechlichen
// Hintergrund des naechsten undurchsichtigen Vorfahren - so, wie ein Auge es sieht.
const { starteBrowser, SPIEL_URL, ruhigeUhren, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

const SCHRANKE = 4.5;   // WCAG 2.2 AA fuer normalen Text

const now = Date.now();
const SPIELSTAND = JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  seenTabHints: { basis:1, verteidigung:1, forschung:1, flotte:1, karte:1, galaxie:1 },
  resources: { energie:48000, erz:52000, kristalle:31000, deuterium:20000, antimaterie:900, forschungspunkte:2200 },
  buildings: { solar:8, mine:8, lager:12, labor:4, werft:3 }, research: {},
  fleet: { jaeger:20, missions:[] }, colonies: {}, activeBasePlanet: 'home',
  player: { id:'u', name:'AdmiralX' }, xp: 3000, credits: 5000, prestige: 0, buffs: [],
  lastTick: now, colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {},
  equippedShipModules: {}, moduleFragments: 0
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

// Im Browser: Kontrast jeder sichtbaren Sperr-/Voraussetzungszeile gegen ihren echten Grund.
const MESSEN = () => {
  const bgVon = el => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement){
      const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(n).backgroundColor);
      if (m){ const t = m[1].split(',').map(parseFloat); if (t.length < 4 || t[3] > 0.5) return t.slice(0,3); }
    }
    return [11, 14, 26];
  };
  const lum = c => { const f = c.map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
                     return 0.2126*f[0] + 0.7152*f[1] + 0.0722*f[2]; };
  const kon = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };
  const farbe = s => { const m = /rgba?\(([^)]+)\)/.exec(s); return m ? m[1].split(',').map(parseFloat).slice(0,3) : [255,255,255]; };
  const raus = [];
  document.querySelectorAll('.tab-panel.active .bmeta').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const t = (el.textContent || '').trim();
    if (!/Benötigt|Voraussetzung/i.test(t)) return;
    const cs = getComputedStyle(el);
    raus.push({ text: t.slice(0, 30), px: Math.round(parseFloat(cs.fontSize)),
                kontrast: Math.round(kon(farbe(cs.color), bgVon(el)) * 100) / 100 });
  });
  return raus;
};

(async () => {
  const browser = await starteBrowser();
  for (const [name, vp, mobil] of [['Handy', { width: 390, height: 844 }, true],
                                   ['PC', { width: 1400, height: 900 }, false]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: mobil, hasTouch: mobil });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
    await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
    await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
    await page.goto(DATEI); await page.waitForTimeout(2600);
    await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
    check('0-vorab (' + name + '): Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

    for (const reiter of ['forschung', 'flotte']) {
      await page.evaluate(t => { const b = document.querySelector('.tab-btn[data-tab="' + t + '"]'); if (b) b.click(); }, reiter);
      await page.waitForTimeout(1200);
      const zeilen = await page.evaluate(MESSEN);

      // Anker: Ohne Zeilen im Bild wuerde die Kontrastpruefung trivial bestehen.
      check('0-anker (' + name + '/' + reiter + '): Sperrzeilen gefunden', zeilen.length >= 10, zeilen.length);
      if (zeilen.length < 10) continue;

      const schwach = zeilen.filter(z => z.kontrast < SCHRANKE);
      check('1 (' + name + '/' + reiter + '): jede Sperrzeile erreicht Kontrast ' + SCHRANKE,
        schwach.length === 0,
        { zeilen: zeilen.length, darunter: schwach.length, kontraste: [...new Set(zeilen.map(z => z.kontrast))], beispiel: schwach[0] });
    }
    await ctx.close();
  }
  await ende(async () => browser.close());
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
