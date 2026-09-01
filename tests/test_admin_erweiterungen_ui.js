// Vier Erweiterungen der Aktivitaets-Uhr im Admin-Bereich (01.09.2026, Auftrag Sascha "Funktionen
// weiter ausbauen" - alle vier Vorschlaege gewaehlt): Uebersicht aller Konten nach
// Auffaelligkeit, Rate-Limit- und Ablehnungs-Zeilen im Konto-Blatt, der Geschenk-Reiter, der
// geschenk-Zweig im Belohnungsfach und die Betreiber-Push 'verdacht'.
//
// DIE KERNMESSUNGEN SIND PAARE (Arbeitsregel 61):
//   1a   anna ist markiert UND ben nicht - eine Markierung, die jeder traegt, unterscheidet nichts
//   1b   ein lueckenloses Miniraster zeichnet EINE Farbe, ein Schlafmuster ZWEI
//   2a-c/2d  die drei neuen Blatt-Zeilen stehen da UND fehlen ERSATZLOS gegen einen alten Server
//   3a/3c    Bestaetigen schickt das Geschenk UND Abbrechen schickt nichts
//   4a/4b    der geschenk-Zweig bucht und speichert UND faellt nicht in den Bug-Report-Rueckfall
//   5a/5b    der Betreiber sieht den Schalter UND ein anderes Konto nicht
//
// `state` lebt im Modulscope der Spieldatei (Regel 47) - gemessen wird der GESPEICHERTE Stand,
// den der Zweig ueber save() schreibt. Das misst zugleich Regel 73: Der Server hat die
// Belohnung beim Abholen bereits entfernt, ohne save() waere sie beim Schliessen des Reiters weg.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, ruhigeUhren, logMitschnitt, logZeilen } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
const ADMIN = 'u-admin';
const TAGE = 14;

// ---- 0) Quelltext: die Verdrahtung, die ein Browser-Lauf nicht sehen kann ----------------------
{
  const zweig = JS.indexOf("if (r.type === 'geschenk'){");
  const rueckfall = JS.indexOf("log('Dankeschön vom Team: +'");
  check('0a: der geschenk-Zweig steht VOR dem Bug-Report-Rueckfall', zweig > 0 && rueckfall > 0 && zweig < rueckfall, { zweig, rueckfall });
  check('0b: der Geschenk-Bericht traegt keine Gewonnen/Verloren-Pille', /REPORT_SPECIAL_GREEN_TYPES = \[[^\]]*'geschenk'/.test(JS));
  const helfer = (JS.match(/function belohnungGabenBuchen\(/g) || []).length;
  const aufrufe = (JS.match(/= belohnungGabenBuchen\(r\)/g) || []).length;
  check('0c: EIN Buchungs-Helfer, von Bonuscode UND Geschenk benutzt (keine zweite Schleife)', helfer === 1 && aufrufe === 2, { helfer, aufrufe });
  check('0d: notifPrefsCache kennt die Kategorie verdacht', /notifPrefsCache = \{[^}]*verdacht:true/.test(JS));
  check('0e: der Geschenk-Knopf wird per onclick verdrahtet', /adminGeschenkSendenBtn\.onclick *=/.test(JS) && !/adminGeschenkSendenBtn\.addEventListener/.test(JS));
  check('0f: der Konto-Reiter laedt die Uebersicht beim Oeffnen', /tab:'konto'[^\n]*laden:\(\) => loadAdminAktivitaet\(\)/.test(JS));
}

// Die Reihen sind KONSTRUIERT, damit jede Erwartung aus ihnen folgt (Regel 2).
const reiheAus = fn => Array.from({ length: TAGE * 24 }, (_, i) => fn(i % 24, Math.floor(i / 24))).join('');
const zeileU = (name, reihe, pause, belastbar, verdacht, extra) => Object.assign({
  username: name, gesperrt: false, letzteSitzung: 1756000000000, reihe, aktiv: 100, beobachtet: 336,
  laengstePause: pause, belastbar, verdacht, verdachtGemeldet: 0, reaktionen: 0, schnelleReaktionen: 0,
  rateLimitHeute: 0, rateLimitGesamt: 0, spielstandAbgelehnt: 0 }, extra || {});
const UEBERSICHT = { gesamt: 3, tage: TAGE, regel: { pauseMaxStd: 2, minStunden: 168 }, konten: [
  zeileU('anna', reiheAus(() => '1'), 0, true, true, { schnelleReaktionen: 4, rateLimitHeute: 3, spielstandAbgelehnt: 2 }),
  zeileU('ben', reiheAus(h => (h >= 8 && h <= 22) ? '1' : '0'), 9, true, false),
  zeileU('carl', reiheAus((h, t) => (t === TAGE - 1 && h === 3) ? '1' : '-'), null, false, false)
] };
const AKTIV_ANNA = { reihe: reiheAus(() => '1'), aktiv: 336, beobachtet: 336, laengstePause: 0, belastbar: true, tage: TAGE, verdacht: true, verdachtGemeldet: 1756000000000 };
function konto(name, extra){
  return Object.assign({ username: name, gesperrt: false, registriert: 1755000000000, emailForm: 'a***@example.org',
    emailBestaetigt: true, letzteSitzung: 1756000000000, hatSpielstand: true, heimatsystem: 'kepler',
    unterstuetzer: null, unterstuetzerVergeben: false, testphaseGenutzt: false, stufeJeMax: null,
    sternenstaub: 100, abgewehrteAngriffe: 0, pveKills: null, bonusCodes: 0, bonusFehlversuche: 0,
    marktErloesHeute: 0, offeneBelohnungen: 0, tokenVersion: 0, angemeldet: true }, extra || {});
}
const KONTO_ANNA = konto('anna', { aktiv: AKTIV_ANNA, reaktionen: [],
  rateLimitTreffer: { heute: 3, gesamt: 7, letzteZeit: 1756000000000, letzterPfad: '/api/storage/x' },
  spielstandAbgelehnt: { n: 2, letzteZeit: 1756000000000, letzterGrund: 'Kredite unplausibel: -5',
    letzte: [{ zeit: 1755990000000, grund: 'XP unplausibel: -1' }, { zeit: 1756000000000, grund: 'Kredite unplausibel: -5' }] } });
const KONTO_ALT = konto('anna', {});   // ein Server vor dem 01.09.2026 schickt die Felder nicht
const KONTO_NULL = konto('anna', { aktiv: Object.assign({}, AKTIV_ANNA, { verdacht: false, verdachtGemeldet: 0 }), reaktionen: [],
  rateLimitTreffer: { heute: 0, gesamt: 0, letzteZeit: 0, letzterPfad: null },
  spielstandAbgelehnt: { n: 0, letzteZeit: 0, letzterGrund: null, letzte: [] } });
const GESCHENKE = { geschenke: [{ zeit: 1756000000000, gaben: { credits: 500 }, text: 'Danke fuers Testen', empfaenger: 12, nurAktiveTage: 0 }],
  gaben: { credits: { max: 25000, name: 'Kredite' }, erz: { max: 2000000, name: 'Erz' } }, textMax: 200, empfaengerGesamt: 13, empfaenger30Tage: 9 };

// Erz liegt bewusst UNTER dem Lagerdeckel des Fixtures: Mit 9e6 klemmte der Tick den Bestand auf
// den Deckel (gemessen 13.800), und 4a mass den Deckel statt der Gutschrift (Arbeitsregel 7).
const ERZ_START = 5000;
const save = () => JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9e6, erz: ERZ_START, kristalle: 9e6, deuterium: 9e6, antimaterie: 9e4, forschungspunkte: 9e4 },
  buildings: { solar: 22, mine: 20, labor: 14, lager: 30, werft: 14 }, research: {}, fleet: { missions: [] },
  colonies: {}, activeBasePlanet: 'home', player: { id: ADMIN, name: 'GameGeeeeek', avatarKey: null },
  xp: 9e5, credits: 5e5, buffs: [], lastTick: Date.now(), colonyNames: {}, modules: {}, shipModules: {}
}));

function backend(store, z){
  return async r => {
    const req = r.request(); const u = req.url(); const p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: ADMIN, username: z.name, isAdmin: z.name === 'GameGeeeeek', admin: z.name === 'GameGeeeeek',
      homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true,
      supporter: { active: true, tier: 'gold', exempt: true, granted: false, until: 0 } });
    if (p === 'admin/aktivitaet') return z.uebersichtStatus === 404 ? j({ error: 'nicht da' }, 404) : j(UEBERSICHT);
    if (p === 'admin/konto'){ z.kontoAnfragen.push(u.split('?')[1] || ''); return j({ konten: [z.konto], gefunden: 1 }); }
    if (p === 'admin/geschenke') return j(GESCHENKE);
    if (p === 'admin/geschenk'){ let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {} z.geschenkPosts.push(b); return j({ ok: true, empfaenger: 9, gaben: b.gaben }); }
    if (p === 'pending-rewards/claim'){ const n = (z.belohnungen || []).shift(); return j({ reward: n || null }); }
    if (p === 'notification-prefs') return j(Object.assign({}, z.prefs));
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok: true }) : j({ notifications: z.postfach });
    if (p === 'reports'){
      if (req.method() === 'POST'){ try { z.berichte.unshift(Object.assign({ id: 'r' + (++z.nr), time: Date.now() }, JSON.parse(req.postData() || '{}').report || {})); } catch (e) {} return j({ ok: true }); }
      return j({ reports: z.berichte });
    }
    if (p.startsWith('admin/')) return j({});
    if (p === 'storage-list') return j({ keys: [] });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true, version: 2 }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    return j([]);
  };
}
const PREFS = { enabled: true, messages: true, pact: true, weltboss: true, raid: true, allianceraid: true, alliancebase: true, chat: true,
  patchnotes: true, application: true, spy: true, attack: true, leaderboard: true, completion: true, neuspieler: true, verdacht: true };
function zustand(o){ return Object.assign({ name: 'GameGeeeeek', uebersichtStatus: 200, konto: KONTO_ANNA, kontoAnfragen: [], geschenkPosts: [],
  belohnungen: [], prefs: Object.assign({}, PREFS), postfach: [], berichte: [], nr: 0 }, o || {}); }

const overlaysWeg = () => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
  .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });

async function seite(browser, z, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message || e)));
  const fixture = save();
  const store = { [SAVE_KEY]: fixture };
  await page.route('**/api/**', backend(store, z));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await logMitschnitt(page);
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(overlaysWeg);
  let reiterDa = true;
  if (opt.reiter){
    await page.evaluate(() => { const o = document.getElementById('adminPanelOverlay'); if (o) o.style.display = 'flex'; });
    // GEFASST (Regel 34): Am Vergleichsstand gibt es den Knopf nicht, der Klick wuerfe, und der
    // Test stuerbe mitten drin - so ist es eine benannte rote Zeile und der Rest laeuft auf leerem Text.
    try { await page.click('#adminTab' + opt.reiter + 'Btn', { timeout: 3000 }); } catch (e) { reiterDa = false; }
    await page.waitForTimeout(900);
  }
  const text = async sel => { try { return (await page.textContent(sel)) || ''; } catch (e) { return ''; } };
  return { ctx, page, errs, store, fixture, reiterDa, text, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
// Ein Konto ueber die Suche ins Blatt holen - der Spielerweg, mindestens zwei Zeichen (Regel 28).
async function suche(s, was){
  try { await s.page.fill('#adminKontoSuche', was, { timeout: 3000 }); await s.page.click('#adminKontoSucheBtn', { timeout: 3000 }); } catch (e) {}
  await s.page.waitForTimeout(800);
  return s.text('#adminKontoListe');
}
const fuellen = async (page, sel, wert) => { try { await page.fill(sel, wert, { timeout: 3000 }); return true; } catch (e) { return false; } };
const klicken = async (page, sel) => { try { await page.click(sel, { timeout: 3000 }); return true; } catch (e) { return false; } };
const waehlen = async (page, sel, wert) => { try { await page.selectOption(sel, wert, { timeout: 3000 }); return true; } catch (e) { return false; } };
const rasterFarben = (page, name) => page.$$eval('[data-uebersicht-konto="' + name + '"] [data-mini-raster] div div',
  ns => [...new Set(ns.map(n => getComputedStyle(n).backgroundColor))]).catch(() => []);

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Die Uebersicht im Konto-Reiter ----------------------------------------------------------
  const z1 = zustand();
  const s1 = await seite(browser, z1, { reiter: 'Konto' });
  const namen1 = await s1.page.$$eval('[data-uebersicht-konto]', ns => ns.map(n => n.getAttribute('data-uebersicht-konto'))).catch(() => []);
  check('1-vorab: der Konto-Reiter oeffnet und die Uebersicht steht mit drei Zeilen', s1.reiterDa && namen1.length === 3, { reiterDa: s1.reiterDa, namen: namen1 });
  check('1c: die Zeilen stehen in der Reihenfolge des Servers (kuerzeste Pause zuerst)', namen1.join(',') === 'anna,ben,carl', namen1);
  const marken = await s1.page.$$eval('[data-uebersicht-konto]', ns => ns.map(n => ({ name: n.getAttribute('data-uebersicht-konto'),
    verdacht: n.getAttribute('data-uebersicht-verdacht'), auffaellig: /auffällig/.test(n.textContent || '') }))).catch(() => []);
  const mAnna = marken.find(m => m.name === 'anna') || {}, mBen = marken.find(m => m.name === 'ben') || {};
  check('1a: anna ist als auffaellig markiert UND ben nicht (PAAR)',
    mAnna.verdacht === '1' && mAnna.auffaellig && mBen.verdacht === '0' && !mBen.auffaellig, { anna: mAnna, ben: mBen });
  const fAnna = await rasterFarben(s1.page, 'anna'), fBen = await rasterFarben(s1.page, 'ben');
  check('1b: das Miniraster zeichnet bei anna EINE Farbe, bei ben ZWEI', fAnna.length === 1 && fBen.length === 2, { anna: fAnna, ben: fBen });
  const uText = await s1.text('#adminKontoUebersicht');
  check('1b2: die Erklaerung nennt die Regel UND die harmlosen Erklaerungen', /7 Tage/.test(uText) && /2 Stunden/.test(uText) && /kein Beweis/.test(uText) && /Zeitzonen/.test(uText),
    { auszug: uText.slice(0, 200) });
  check('1b3: die Zeile von anna traegt ihre Zaehler (schnelle Reaktionen, Rate-Limit, Ablehnungen)',
    /4× unter 2 Min/.test(uText) && /3× Rate-Limit/.test(uText) && /2 Spielstände abgelehnt/.test(uText), { auszug: (uText.match(/anna[^]{0,160}/) || [''])[0] });
  if (process.env.KEPLER_BILD) await s1.page.screenshot({ path: process.env.KEPLER_BILD.replace('.png', '-uebersicht.png'),
    clip: await s1.page.$eval('#adminKontoView', n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 700) }; }) }).catch(() => {});
  // 1d: Tippen auf eine Zeile fuellt die Suche und holt das Blatt.
  await klicken(s1.page, '[data-uebersicht-konto="anna"]');
  await s1.page.waitForTimeout(900);
  const suchWert = await s1.page.$eval('#adminKontoSuche', el => el.value).catch(() => null);
  const blatt1 = await s1.text('#adminKontoListe');
  check('1d: Tippen auf die Zeile fuellt die Suche und holt das Blatt', suchWert === 'anna' && /anna/.test(blatt1) && z1.kontoAnfragen.some(q => /name=anna/.test(q)),
    { suchWert, anfragen: z1.kontoAnfragen });

  // ---- 2) Die neuen Blatt-Zeilen (das Blatt von 1d ist KONTO_ANNA) --------------------------------
  check('2a: das Blatt nennt die Rate-Limit-Treffer heute, gesamt und den letzten Pfad',
    /Rate-Limit-Treffer/.test(blatt1) && /3 heute/.test(blatt1) && /7 gesamt/.test(blatt1) && /\/api\/storage\/x/.test(blatt1), { auszug: (blatt1.match(/Rate-Limit[^]{0,90}/) || [''])[0] });
  check('2b: es nennt die abgelehnten Spielstaende mit Zahl und Grund',
    /Abgelehnte Spielstände/.test(blatt1) && /Kredite unplausibel/.test(blatt1) && /XP unplausibel/.test(blatt1) && /NICHT gespeichert/.test(blatt1),
    { auszug: (blatt1.match(/Abgelehnte Spielstände[^]{0,120}/) || [''])[0] });
  check('2c: es nennt die Verdachtsmeldung an den Betreiber', /Verdachtsmeldung/.test(blatt1) && /an dich geschickt/.test(blatt1));
  check('2-fehler: keine Seitenfehler', s1.errs.length === 0, s1.errs.slice(0, 3));
  await s1.ctx.close();
  // 2d: ein Server VOR dem 01.09.2026 schickt die Felder nicht - dann fehlen die Zeilen ERSATZLOS.
  const s2 = await seite(browser, zustand({ konto: KONTO_ALT }), { reiter: 'Konto' });
  const blattAlt = await suche(s2, 'ann');
  check('2d-vorab: das alte Blatt steht', /anna/.test(blattAlt) && /a\*\*\*@example\.org/.test(blattAlt));
  check('2d: ohne die Felder fehlen alle drei Zeilen ERSATZLOS', !/Rate-Limit-Treffer/.test(blattAlt) && !/Abgelehnte Spielstände/.test(blattAlt) && !/Verdachtsmeldung/.test(blattAlt),
    { auszug: blattAlt.slice(0, 120) });
  await s2.ctx.close();
  const s2e = await seite(browser, zustand({ konto: KONTO_NULL }), { reiter: 'Konto' });
  const blattNull = await suche(s2e, 'ann');
  check('2e: bei Nullwerten stehen die Zeilen mit "keine" und "0 heute" - nicht rot, nicht leer',
    /Abgelehnte Spielstände\s*keine/.test(blattNull) && /0 heute/.test(blattNull) && !/Verdachtsmeldung/.test(blattNull), { auszug: (blattNull.match(/Rate-Limit[^]{0,60}/) || [''])[0] });
  await s2e.ctx.close();
  // 1e: ein Server ohne die Uebersichts-Route - die Flaeche BENENNT das, und die Suche geht weiter.
  const s1e = await seite(browser, zustand({ uebersichtStatus: 404 }), { reiter: 'Konto' });
  const u404 = await s1e.text('#adminKontoUebersicht');
  check('1e: bei 404 nennt die Uebersicht den Grund (Backend laeuft hinterher) statt leer zu bleiben', /noch nicht/.test(u404) && /404/.test(u404), { auszug: u404.slice(0, 120) });
  const blatt404 = await suche(s1e, 'ann');
  check('1e2: ... und die Kontosuche funktioniert daneben weiter', /anna/.test(blatt404));
  await s1e.ctx.close();

  // ---- 3) Der Geschenk-Reiter ------------------------------------------------------------------
  const z3 = zustand();
  const s3 = await seite(browser, z3, { reiter: 'Geschenk' });
  const felder3 = await s3.page.$$eval('[data-geschenk-gabe]', ns => ns.map(n => n.getAttribute('data-geschenk-gabe'))).catch(() => []);
  const info3 = await s3.text('#adminGeschenkEmpfaenger');
  const verlauf3 = await s3.text('#adminGeschenkVerlauf');
  check('3-vorab: der Reiter oeffnet, die Gaben-Felder kommen vom Server', s3.reiterDa && felder3.join(',') === 'credits,erz', { reiterDa: s3.reiterDa, felder: felder3 });
  check('3-vorab2: die Empfaengerzahl und der Verlauf stehen', /13/.test(info3) && /9/.test(info3) && /Danke fuers Testen/.test(verlauf3) && /12 Konten/.test(verlauf3), { info: info3, verlauf: verlauf3.slice(0, 100) });
  if (process.env.KEPLER_BILD) await s3.page.screenshot({ path: process.env.KEPLER_BILD.replace('.png', '-geschenk.png'),
    clip: await s3.page.$eval('#adminGeschenkView', n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 700) }; }) }).catch(() => {});
  const dialoge3 = [];
  s3.page.on('dialog', d => { dialoge3.push(d.message()); d.accept(); });   // Regel 66: der Handler MUSS antworten
  await fuellen(s3.page, '[data-geschenk-gabe="credits"]', '500');
  await fuellen(s3.page, '#adminGeschenkText', 'Sorry fuer den Ausfall');
  await waehlen(s3.page, '#adminGeschenkFilter', '30');
  await klicken(s3.page, '#adminGeschenkSendenBtn');
  await s3.page.waitForTimeout(1200);
  const post3 = z3.geschenkPosts[0] || null;
  check('3a: Bestaetigen schickt Gaben, Text und Empfaengerfilter', !!post3 && post3.gaben && post3.gaben.credits === 500 && post3.text === 'Sorry fuer den Ausfall' && post3.nurAktiveTage === 30 && z3.geschenkPosts.length === 1,
    { posts: z3.geschenkPosts });
  check('3a2: die Rueckfrage nennt Betrag und Empfaengerkreis', dialoge3.length === 1 && /500/.test(dialoge3[0]) && /30 Tagen/.test(dialoge3[0]) && /nicht zurücknehmen/.test(dialoge3[0]), dialoge3);
  const zeilen3 = await logZeilen(s3.page);
  check('3b: die Meldung nennt die Empfaengerzahl des Servers', zeilen3.some(z => /Geschenk an 9 Konten/.test(z)), { zeilen: zeilen3.filter(z => /Geschenk/.test(z)) });
  const feldNach3 = await s3.page.$eval('[data-geschenk-gabe="credits"]', el => el.value).catch(() => null);
  check('3b2: die Felder sind danach geleert', feldNach3 === '', { wert: feldNach3 });
  await s3.ctx.close();
  // 3c: Abbrechen schickt NICHTS (die andere Haelfte des Paars).
  const z3c = zustand();
  const s3c = await seite(browser, z3c, { reiter: 'Geschenk' });
  const dialoge3c = [];
  s3c.page.on('dialog', d => { dialoge3c.push(d.message()); d.dismiss(); });
  await fuellen(s3c.page, '[data-geschenk-gabe="credits"]', '100');
  await klicken(s3c.page, '#adminGeschenkSendenBtn');
  await s3c.page.waitForTimeout(800);
  check('3c: Abbrechen in der Rueckfrage schickt nichts', dialoge3c.length === 1 && z3c.geschenkPosts.length === 0, { dialoge: dialoge3c.length, posts: z3c.geschenkPosts.length });
  // 3d: ohne Gabe gibt es gar keine Rueckfrage.
  await fuellen(s3c.page, '[data-geschenk-gabe="credits"]', '');
  await klicken(s3c.page, '#adminGeschenkSendenBtn');
  await s3c.page.waitForTimeout(600);
  check('3d: ohne Gabe keine Rueckfrage und kein Versand', dialoge3c.length === 1 && z3c.geschenkPosts.length === 0, { dialoge: dialoge3c.length, posts: z3c.geschenkPosts.length });
  check('3-fehler: keine Seitenfehler', s3c.errs.length === 0, s3c.errs.slice(0, 3));
  await s3c.ctx.close();

  // ---- 4) Das Belohnungsfach: der geschenk-Zweig -------------------------------------------------
  const z4 = zustand({ belohnungen: [{ id: 'g1', type: 'geschenk', credits: 500, erz: 1000, text: 'Danke euch allen', zeit: Date.now() }] });
  const s4 = await seite(browser, z4, {});
  await s4.page.waitForTimeout(2500);
  const zeilen4 = await logZeilen(s4.page);
  check('4b: die Meldung nennt das Geschenk und seinen Text - NICHT den Bug-Report-Rueckfall',
    zeilen4.some(z => /Geschenk vom Team/.test(z) && /Danke euch allen/.test(z) && /\+500 Kredite/.test(z)) && !zeilen4.some(z => /Bug-Report/.test(z)),
    { zeilen: zeilen4.filter(z => /Geschenk|Bug-Report/.test(z)) });
  // Gewartet wird auf den ERSTEN Schreibvorgang nach dem Boot - das ist das save() des Zweigs.
  // Kredite sind exakt (nichts produziert sie); beim Erz laeuft zwischen Laden und Abholen die
  // Produktion mit (mine:20, gemessen rund 12 Erz je Sekunde), deshalb ein enges Fenster statt
  // Gleichheit. Ohne die Buchung staende der Wert bei rund ERZ_START + Produktion, also weit darunter.
  for (let i = 0; i < 25 && s4.store[SAVE_KEY] === s4.fixture; i++) await s4.page.waitForTimeout(400);
  const st4 = s4.stand();
  const erz4 = (st4.resources || {}).erz;
  check('4a: Kredite und Erz stehen im GESPEICHERTEN Spielstand (der Zweig speichert sofort)',
    st4.credits === 5e5 + 500 && erz4 >= ERZ_START + 1000 && erz4 < ERZ_START + 1000 + 400,
    { credits: st4.credits, erz: erz4, erwartetErz: ERZ_START + 1000 });
  const b4 = z4.berichte.find(b => b && b.type === 'geschenk');
  check('4c: es gibt einen bleibenden Bericht mit Gaben und Text', !!b4 && Array.isArray(b4.gaben) && b4.gaben.length === 2 && b4.text === 'Danke euch allen',
    b4 ? { gaben: b4.gaben, text: b4.text } : { berichte: z4.berichte.map(b => b.type) });
  await s4.page.evaluate(() => { const b = document.getElementById('headerReportsBtn'); if (b) b.click(); });
  await s4.page.waitForTimeout(1500);
  const berichte4 = await s4.text('#tab-berichte');
  check('4d: die Berichtskarte zeigt Titel, Gutschrift und Text', /Geschenk vom Team/.test(berichte4) && /Gutgeschrieben/.test(berichte4) && /Danke euch allen/.test(berichte4),
    { auszug: (berichte4.match(/Geschenk vom Team[^]{0,120}/) || [''])[0] });
  check('4-fehler: keine Seitenfehler - der Zweig darf die Abhol-Schleife nicht werfen', s4.errs.length === 0, s4.errs.slice(0, 3));
  await s4.ctx.close();

  // ---- 5) Die Betreiber-Push 'verdacht' ------------------------------------------------------------
  const schalterLage = () => {
    const el = document.querySelector('[data-notif-cat="verdacht"]');
    if (!el) return { da: false };
    const zeile = el.closest('.card-row');
    const r = zeile ? zeile.getBoundingClientRect() : null;
    return { da: true, sichtbar: !!(zeile && zeile.offsetParent !== null && r.height > 0), text: zeile ? zeile.textContent.trim() : '' };
  };
  const oeffneEinstellungen = () => { const b = document.getElementById('headerProfileBtn'); if (b) b.click(); };
  const s5 = await seite(browser, zustand(), {});
  await s5.page.evaluate(oeffneEinstellungen); await s5.page.waitForTimeout(1500);
  const betreiber = await s5.page.evaluate(schalterLage);
  check('5a: der Betreiber SIEHT den Schalter, und er nennt Hinweis-statt-Beweis', betreiber.da && betreiber.sichtbar && /Auffällige Konten/.test(betreiber.text) && /kein Beweis/.test(betreiber.text), betreiber);
  await s5.ctx.close();
  const s5b = await seite(browser, zustand({ name: 'Anna' }), {});
  await s5b.page.evaluate(oeffneEinstellungen); await s5b.page.waitForTimeout(1500);
  const fremder = await s5b.page.evaluate(schalterLage);
  const andere = await s5b.page.evaluate(() => { const el = document.querySelector('[data-notif-cat="attack"]'); const z = el && el.closest('.card-row'); return !!(z && z.offsetParent !== null && z.getBoundingClientRect().height > 0); });
  check('5b: ein anderes Konto sieht ihn NICHT - bei sichtbarer Liste (PAAR)', andere && fremder.da && !fremder.sichtbar, { fremder, andereSichtbar: andere });
  await s5b.ctx.close();
  const s5c = await seite(browser, zustand({ postfach: [{ id: 'n1', type: 'konto-verdacht', time: Date.now() - 60000,
    payload: { username: 'anna', laengstePause: 0, beobachtet: 211, tage: 9 }, ziel: 'galaxie:rang' }] }), {});
  await s5c.page.evaluate(() => { const b = document.getElementById('headerReportsBtn'); if (b) b.click(); }); await s5c.page.waitForTimeout(1500);
  const zeile5 = await s5c.page.evaluate(() => { const el = document.querySelector('[data-notif-go="galaxie:rang"]'); return el ? el.textContent.trim() : null; });
  check('5c: die Postfach-Zeile nennt das Konto und die harmlosen Erklaerungen - kein "Ereignis"-Rueckfall',
    !!zeile5 && /anna/.test(zeile5) && /9 Tagen/.test(zeile5) && /Zeitzonen/.test(zeile5) && !/^Ereignis/.test(zeile5), zeile5);
  await s5c.ctx.close();

  await browser.close();
  console.log('');
  console.log(fail ? 'FAIL - es gab rote Pruefungen.' : 'Alles gruen.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEHLER: ' + (e && e.stack || e)); process.exit(1); });
