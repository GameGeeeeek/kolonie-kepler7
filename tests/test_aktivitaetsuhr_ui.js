// Die Aktivitaets-Uhr im Konto-Blatt (28.08.2026, Auftrag Sascha: "da ist ein Spieler, der ist
// wirklich Tag und Nacht online - kann man nachvollziehen, ob da ein Bot dahintersteckt?").
//
// WAS DIESER TEST PRUEFT - die WIRKUNG, nicht die Beschriftung (Arbeitsregel 61):
//   1. Das Raster wird gezeichnet, 14 Zeilen x 24 Kaestchen, und die Kaestchen SEHEN
//      unterschiedlich aus - aktiv, ruhig, nicht beobachtet sind drei Farben.
//   2. Die Einordnung UNTERSCHEIDET. Das ist die Kernmessung, und sie ist ein PAAR aus drei
//      Laeufen: derselbe Text bei einem Dauerlaeufer, einem Menschen und einem frischen Konto
//      waere auch bei einer fest verdrahteten Zeile gruen.
//   3. Die zwei harmlosen Erklaerungen stehen im Verdachtsfall dabei. Ohne sie macht die Uhr
//      aus einem Hinweis einen Beweis - genau das soll sie nicht.
//   4. Ohne die Felder (ein Server, der noch nicht ausgeliefert hat) fehlt der Block ERSATZLOS.
//      Kein leerer Kasten, keine Ueberschrift ohne Inhalt (Arbeitsregel 35, Gegenrichtung).
const { starteBrowser, SPIEL_URL, ruhigeUhren } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const ADMIN = 'u-admin';
const TAGE = 14;
// Die drei Reihen sind KONSTRUIERT, damit jede Erwartung aus ihnen folgt und nicht aus einer
// Momentaufnahme: lueckenlos / 8-22 Uhr / eine einzige Stunde.
const reiheAus = fn => Array.from({ length: TAGE * 24 }, (_, i) => fn(i % 24, Math.floor(i / 24))).join('');
const DAUER   = { reihe: reiheAus(() => '1'), aktiv: TAGE*24, beobachtet: TAGE*24, laengstePause: 0, belastbar: true, tage: TAGE };
const MENSCH  = { reihe: reiheAus(h => (h >= 8 && h <= 22) ? '1' : '0'), aktiv: TAGE*15, beobachtet: TAGE*24, laengstePause: 9, belastbar: true, tage: TAGE };
const FRISCH  = { reihe: reiheAus((h, t) => (t === TAGE-1 && h === 3) ? '1' : '-'), aktiv: 1, beobachtet: 1, laengstePause: 0, belastbar: false, tage: TAGE };

function konto(name, aktiv, reaktionen){
  return { username:name, gesperrt:false, registriert: 1755000000000, emailForm:'a***@example.org',
    emailBestaetigt:true, letzteSitzung:1756000000000, hatSpielstand:true, heimatsystem:'kepler',
    unterstuetzer:null, unterstuetzerVergeben:false, testphaseGenutzt:false, stufeJeMax:null,
    sternenstaub:100, abgewehrteAngriffe:0, pveKills:null, bonusCodes:0, bonusFehlversuche:0,
    marktErloesHeute:0, offeneBelohnungen:0, tokenVersion:0, angemeldet:true,
    aktiv, reaktionen: reaktionen || [] };
}
const KURZ = [30, 45, 20, 3600, 70].map((sek, i) => ({ zeit: 1756000000000 - i*3600000, art: i%2 ? 'nest' : 'festung', sek }));

const save = () => JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{ energie:9e6, erz:9e6, kristalle:9e6, deuterium:9e6, antimaterie:9e4, forschungspunkte:9e4 },
  buildings:{ solar:22, mine:20, labor:14, lager:30, werft:14 }, research:{}, fleet:{ missions:[] },
  colonies:{}, activeBasePlanet:'home', player:{ id:ADMIN, name:'GameGeeeeek', avatarKey:null },
  xp:9e5, credits:5e5, buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{}
}));

function backend(store, konten){
  return async r => {
    const req = r.request(); const u = req.url(); const p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ADMIN, username:'GameGeeeeek', isAdmin:true, admin:true,
      homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true,
      supporter:{ active:true, tier:'gold', exempt:true, granted:false, until:0 } });
    if (p === 'admin/konto') return j({ konten, gefunden: konten.length });
    if (p === 'reports') return j({ reports: [] });
    if (p === 'pending-rewards/claim') return j({ reward: null });
    if (p === 'storage-list') return j({ keys: [] });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') return j({ ok:true, version:2 });
      return store[k] !== undefined ? j({ value: store[k], version:1 }) : j({ value:null, version:0 });
    }
    if (p.startsWith('admin/')) return j({});
    return j({ ok:true });
  };
}

// Oeffnet den Admin-Bereich ueber den SPIELERWEG (Knopf, nicht switchAdminTab direkt) und sucht.
async function blatt(browser, konten){
  const ctx = await browser.newContext({ viewport:{ width:1400, height:1000 } });
  const page = await ctx.newPage();
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, konten));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }));
  await page.evaluate(() => { const o = document.getElementById('adminPanelOverlay'); if (o) o.style.display = 'flex'; });
  // GEFASST: Am Vergleichsstand einer Gegenprobe gibt es den Knopf nicht, der Klick wirft, und der
  // Test stirbt mitten drin bei rotem Exit-Code (Arbeitsregel 34).
  let reiterDa = true;
  try { await page.click('#adminTabKontoBtn', { timeout: 3000 }); } catch (e) { reiterDa = false; }
  await page.waitForTimeout(500);
  // MINDESTENS zwei Zeichen - die Route lehnt kuerzere ab. Der erste Anlauf suchte nach 'a',
  // bekam "Bitte mindestens zwei Zeichen eingeben." und liess damit 4a und 2c aus dem
  // FALSCHEN Grund gruen werden: Ueber leerem Text ist "fehlt ersatzlos" trivial erfuellt
  // (Arbeitsregel 28). Gefangen haben es allein die -vorab-Zeilen.
  try { await page.fill('#adminKontoSuche', 'ann', { timeout: 3000 }); } catch (e) {}
  try { await page.click('#adminKontoSucheBtn', { timeout: 3000 }); } catch (e) {}
  await page.waitForTimeout(800);
  const text = await page.textContent('#adminKontoListe').catch(() => '');
  const zeilen = await page.$$eval('#adminKontoListe div[style*="repeat(24"]',
    ns => ns.map(n => Array.from(n.children).map(c => getComputedStyle(c).backgroundColor))).catch(() => []);
  return { ctx, page, reiterDa, text: text || '', zeilen };
}

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Der Dauerlaeufer -------------------------------------------------------------------
  const d = await blatt(browser, [konto('anna', DAUER, KURZ)]);
  check('1-vorab: der Konto-Reiter laesst sich oeffnen und das Blatt steht', d.reiterDa && /anna/.test(d.text),
    { reiterDa: d.reiterDa, auszug: d.text.slice(0, 80) });
  // Die erste Rasterzeile ist die Stundenachse (24 Beschriftungen), danach 14 Tageszeilen.
  const rasterD = d.zeilen.filter(z => z.length === 24);
  check('1a: das Raster hat die Stundenachse plus 14 Tageszeilen', rasterD.length === TAGE + 1,
    { zeilen: rasterD.length });
  const farbenD = new Set(rasterD.slice(1).flat());
  check('1a2: ein lueckenloses Konto zeichnet genau EINE Farbe', farbenD.size === 1,
    { farben: [...farbenD] });
  check('1b: die Einordnung benennt den Verdacht', /ungewöhnlich/.test(d.text),
    { auszug: (d.text.match(/Keine Pause[^]{0,60}/) || [''])[0] });
  check('1b2: und nennt die zwei harmlosen Erklaerungen',
    /geteiltes Konto/.test(d.text) && /Zeitzonen/.test(d.text));
  check('1c: die kurzen Reaktionszeiten werden benannt', /unter zwei Minuten/.test(d.text),
    { auszug: (d.text.match(/\d+ davon unter[^]{0,40}/) || [''])[0] });
  await d.page.screenshot({ path: '/tmp/uhr-dauer.png', clip: await d.page.$eval('#adminKontoListe',
    n => { const r = n.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:Math.min(r.height, 700) }; }) }).catch(() => {});
  await d.ctx.close();

  // ---- 2) Der Mensch: dieselbe Fläche, ANDERE Aussage -----------------------------------------
  const m = await blatt(browser, [konto('anna', MENSCH, [])]);
  const rasterM = m.zeilen.filter(z => z.length === 24);
  const farbenM = new Set(rasterM.slice(1).flat());
  check('2-vorab: auch hier steht das Raster', rasterM.length === TAGE + 1, { zeilen: rasterM.length });
  check('2a: ein Schlafmuster zeichnet ZWEI Farben', farbenM.size === 2, { farben: [...farbenM] });
  check('2b: die Einordnung nennt es eine normale Nachtpause', /normale Nachtpause/.test(m.text),
    { auszug: (m.text.match(/Längste Ruhe[^]{0,50}/) || [''])[0] });
  check('2b2: und sie ist NICHT dieselbe wie beim Dauerlaeufer', !/ungewöhnlich/.test(m.text));
  check('2c: ohne Reaktionszeiten fehlt der Abschnitt ersatzlos',
    !/Erster Schlag nach dem Entstehen/.test(m.text));
  // Bild ziehen, damit die Gestaltung ANGESEHEN wird statt behauptet (Arbeitsregel 42).
  if (process.env.KEPLER_BILD) await m.page.screenshot({ path: process.env.KEPLER_BILD,
    clip: await m.page.$eval('#adminKontoListe', n => { const r = n.getBoundingClientRect();
      return { x:r.x, y:r.y, width:r.width, height:Math.min(r.height, 760) }; }) }).catch(() => {});
  await m.ctx.close();

  // ---- 3) Zu wenig Daten ---------------------------------------------------------------------
  const f = await blatt(browser, [konto('anna', FRISCH, [])]);
  check('3a: ein frisches Konto sagt, dass die Uhr noch nichts hergibt',
    /zu wenig aufgezeichnet/.test(f.text), { auszug: (f.text.match(/Noch zu wenig[^]{0,50}/) || [''])[0] });
  check('3a2: und behauptet KEINE Pause', !/Längste Ruhe/.test(f.text) && !/ungewöhnlich/.test(f.text));
  const rasterF = f.zeilen.filter(z => z.length === 24);
  const sichtbarF = new Set(rasterF.slice(1).flat());
  check('3b: nicht beobachtete Stunden sind durchsichtig, nicht "ruhig"',
    [...sichtbarF].some(c => /rgba\(0, 0, 0, 0\)|transparent/.test(c)), { farben: [...sichtbarF] });
  await f.ctx.close();

  // ---- 4) Ein Server ohne die Felder ----------------------------------------------------------
  const a = await blatt(browser, [konto('anna', undefined, undefined)]);
  check('4-vorab: das Blatt selbst steht weiterhin', /anna/.test(a.text) && /a\*\*\*@example\.org/.test(a.text));
  check('4a: ohne die Felder fehlt die Uhr ERSATZLOS',
    !/Aktivität \(/.test(a.text) && !/Längste Ruhe/.test(a.text) && !/zu wenig aufgezeichnet/.test(a.text),
    { auszug: a.text.slice(0, 160) });
  check('4a2: und es steht kein leeres Raster da', a.zeilen.filter(z => z.length === 24).length === 0,
    { zeilen: a.zeilen.filter(z => z.length === 24).length });
  await a.ctx.close();

  await browser.close();
  console.log('');
  console.log(fail ? 'FAIL - es gab rote Pruefungen.' : 'Alles gruen.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEHLER: ' + (e && e.stack || e)); process.exit(1); });
