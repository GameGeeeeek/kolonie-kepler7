// Vier weitere Admin-Faehigkeiten (02.09.2026, Auftrag Sascha "Weitere Ideen fuer Admin Funktionen"
// - alle vier gewaehlt), Frontend zu Backend #208: Waechter-Karte in der Lage, Galaxie-Reiter,
// Geschenk an EIN Konto und Chat-Moderation im Konto-Blatt.
//
// KERNMESSUNGEN ALS PAARE (Arbeitsregel 61):
//   1a/1b  die Waechter-Karte zeigt Messwerte und offene Funde UND faellt ohne die Route ERSATZLOS
//          weg, ohne die vier vorhandenen Lage-Karten mitzunehmen
//   2a/2b  ein Galaxie-Eingriff schickt nach Bestaetigung UND nicht nach Abbruch
//   2e/2f  der Weltboss-Block bietet Knoepfe, wenn einer steht, UND sagt sonst, dass hier keiner
//          erschaffen wird
//   3a/3b  das Geschenk schickt Gabe, Menge und Grund UND ohne Grund geht nichts
//   4a/4b  die Chat-Zeile ist entfernbar UND die zweite Rueckfrage entscheidet ueber die
//          Stummschaltung (Abbrechen dort heisst: nur loeschen)
//
// Alle Bedienschritte sind gefasst (fuellen/klicken/waehlen mit 3 s), damit die Gegenprobe am alten
// Stand ROT wird statt mitten drin zu sterben (Arbeitsregel 34).
//
// GEGENPROBE (Regel 1), gemessen am 02.09.2026 gegen origin/main (v8.641.0, f380e3a) per
// KEPLER_SPIELDATEI: 28 von 34 fallen, Prueflisten per diff identisch. Gruen bleiben am alten Stand
// nur sechs, jede aus einem benannten Grund: 1c, 2g, 4d ("keine Seitenfehler" - sie messen die
// Abwesenheit eines Fehlers), 1-vorab (den Lage-Reiter gab es schon), 0c (kein ti-gift - im alten
// Stand ebenfalls keins) und 1b ("die Waechter-Karte fehlt ersatzlos" - ohne die Karte trivial
// erfuellt, also die zweite Haelfte des Paares 1a/1b und allein kein Beleg).
//
// ERSTER ENTWURF DIESES TESTS STARB am alten Stand mitten im Lauf (`p2b[1].b` auf einer leeren
// Liste, TypeError), statt rot zu werden - Arbeitsregel 34, und die Prueflisten wichen dadurch
// voneinander ab. Jeder Zugriff auf ein Listenelement traegt seither eine Existenzpruefung.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, ruhigeUhren, logMitschnitt, logZeilen } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
const ADMIN = 'u-admin';
const JETZT = Date.now();

// ---- 0) Quelltext -----------------------------------------------------------------------------
{
  const i = JS.indexOf('const ADMIN_REITER = [');
  const literal = i >= 0 ? JS.slice(i, JS.indexOf('];', i)) : '';
  // Bewusst OHNE feste Reiterzahl: Genau daran fiel test_admin_support_ui 0a, als dieser Reiter
  // dazukam - und dieselbe Falle im Backend (test_admin_funktionen_http 3a zaehlte Notaus-Schalter).
  // Geprueft wird, dass DIESER Reiter eingetragen ist und jeder Eintrag vollstaendig bleibt.
  const eintraege = literal.split(/\n\s*\{ tab:/).slice(1);
  check('0a: der Reiter Galaxie steht in ADMIN_REITER mit Ladefunktion, und jeder Eintrag ist vollstaendig',
    /tab:'galaxie'[^\n]*laden:\(\) => loadAdminGalaxie\(\)/.test(literal)
    && eintraege.length >= 14 && eintraege.every(e => /btn:'/.test(e) && /view:'/.test(e) && /laden:/.test(e)),
    { reiter: eintraege.length });
  check('0b: das Postfach kennt beide neuen Meldungsarten',
    /'admin-alarm': \{ icon:'ti-alert-triangle'/.test(JS) && /'geschenk-konto': \{ icon:'ti-sparkles'/.test(JS));
  // ti-gift ist NICHT im 69er-Whitelist-Font - genau der Bug, wegen dem check-icons.js existiert
  // (v8.77.1). Ein Geschenk-Icon greift deshalb zu ti-sparkles.
  check('0c: kein ti-gift im Dokument', HTML.indexOf('ti-gift') < 0);
  check('0d: die Waechter-Karte haengt an loadAdminLage, nicht an einem eigenen Reiter',
    /id="adminAlarmKarte"/.test(JS) && /loadAdminAlarm\(\);/.test(JS));
}

function konto(extra){
  return Object.assign({ username: 'anna', gesperrt: false, registriert: 1755000000000, emailForm: 'a***@example.org', emailBestaetigt: true,
    letzteSitzung: 1756000000000, hatSpielstand: true, heimatsystem: 'kepler', unterstuetzer: null, unterstuetzerVergeben: false,
    testphaseGenutzt: false, stufeJeMax: null, sternenstaub: 100, abgewehrteAngriffe: 0, pveKills: null, bonusCodes: 0, bonusFehlversuche: 0,
    marktErloesHeute: 0, offeneBelohnungen: 0, tokenVersion: 0, angemeldet: true, reaktionen: [], loeschung: null, kampfVerlauf: 0,
    anmeldung: { fehlversuche: 0, fehlerZuletzt: 0, fehlversucheVorher: 0, letzte: JETZT - 3600000, gesamt: 12, sitzungOffen: true, sitzungSeit: JETZT - 1800000 } }, extra || {});
}
const ALARM = { schwellen: { angriffe: { schwelle: 15, name: 'Angriffe in einer Stunde' }, fehlanmeldungen: { schwelle: 10, name: 'Fehlanmeldungen seit der letzten Anmeldung' },
    spielstaende: { schwelle: 5, name: 'abgelehnte Spielstaende' }, neustarts: { schwelle: 3, name: 'Neustarts in einer Stunde' } },
  ruheStunden: 6, letzterLauf: JETZT - 20000, jetzt: JETZT,
  stand: { angriffe: 18, fehlanmeldungen: 2, spielstaende: 0, neustarts: 1 },
  offen: [{ art: 'angriffe', konto: 'anna', wert: 18, schwelle: 15, text: 'anna hat 18 Angriffe geflogen.' }],
  verlauf: [{ zeit: JETZT - 20000, art: 'angriffe', konto: 'anna', wert: 18, schwelle: 15 }] };
const LAGE = { jetzt: JETZT,
  wirtschaft: { konten: 5, aktiv7Tage: 3, kredite: { gesamt: 100, median: 10, top: [] }, ressourcen: { erz: 50 }, kampfpunkte: 7 },
  markt: { preise: { erz: { preis: 10, basis: 10 } }, ereignis: null, trend: null },
  pve: { weltboss: null, nester: [], festungen: [], konvois: [], vorposten: [] }, notAus: [], ankuendigung: null };
const GALAXIE = {
  weltboss: { bossId: 'boss-1', level: 3, hp: 800, maxHp: 1000, besiegt: false, beteiligte: 2 },
  nester: [{ id: 'nest-1', volk: 'kryll', sys: 'sys_a', stufe: 2, lp: 100, lpMax: 200, seit: JETZT }],
  konvois: [{ id: 'kon-1', sys: 'sys_b', lp: 40000, lpMax: 40000, seit: JETZT }],
  marktEreignis: { resource: 'erz', kind: 'shortage', mult: 1.4, label: 'Erzknappheit', startedAt: JETZT, endsAt: JETZT + 3600000 },
  kopfgeld: { targetUserId: 'x', targetName: 'ben', reward: 2000, claimed: false, durchAdmin: false },
  voelker: [{ schluessel: 'kryll', name: 'Kryll-Schwarm' }, { schluessel: 'vex', name: 'Nomaden von Vex' }],
  systeme: ['sys_a', 'sys_b', 'sys_c'] };
const CHAT = { konto: 'anna', gesamt: 2, nachrichten: [
  { key: 'globalchat:msg:1-a', kanal: 'global', autor: 'anna', autorId: 'u-anna', text: 'Beleidigung im Chat', zeit: JETZT - 60000 },
  { key: 'alliance:T1:msg:2-b', kanal: 'T1', autor: 'anna', autorId: 'u-anna', text: 'Im Allianzchat', zeit: JETZT - 120000 } ] };

const save = () => JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9e6, erz: 5000, kristalle: 9e6, deuterium: 9e6, antimaterie: 9e4, forschungspunkte: 9e4 },
  buildings: { solar: 22, mine: 20, labor: 14, lager: 30, werft: 14 }, research: {}, fleet: { missions: [] },
  colonies: {}, activeBasePlanet: 'home', player: { id: ADMIN, name: 'GameGeeeeek', avatarKey: null },
  xp: 9e5, credits: 5e5, buffs: [], lastTick: Date.now(), colonyNames: {}, modules: {}, shipModules: {}
}));

function backend(store, z){
  return async r => {
    const req = r.request(); const u = req.url(); const p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
    if (p === 'health') return j({ ok: true });
    if (p === 'login') return j({ token: 'tok', userId: ADMIN, username: 'GameGeeeeek' });
    if (p === 'me') return j({ userId: ADMIN, username: 'GameGeeeeek', isAdmin: true, admin: true, homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true,
      supporter: { active: true, tier: 'gold', exempt: true, granted: false, until: 0 } });
    if (p === 'ankuendigung') return j({ ankuendigung: null });
    if (p === 'notifications') return j({ notifications: z.notifs });
    if (p === 'admin/alarm') return z.alarmStatus === 404 ? j({ error: 'nicht da' }, 404) : j(ALARM);
    if (p === 'admin/lage') return j(LAGE);
    if (p === 'admin/galaxie'){
      if (req.method() === 'POST'){ z.posts.push({ p, b }); return z.galaxieFehler ? j({ error: 'Dieses System gibt es nicht.' }, 400) : j({ ok: true, bereich: b.bereich, aktion: b.aktion }); }
      return j(z.galaxie || GALAXIE);
    }
    if (p === 'admin/chat/loeschen'){ z.posts.push({ p, b }); return j({ ok: true, key: b.key, autor: 'anna', stummKonto: b.stummStunden ? 'anna' : null, stummBis: b.stummStunden ? JETZT + 86400000 : 0 }); }
    if (p === 'admin/chat'){ z.gets.push(u); return j(CHAT); }
    if (p === 'admin/geschenk-konto'){ z.posts.push({ p, b }); return j({ ok: true, username: b.targetUsername, gaben: b.gaben }); }
    if (p === 'admin/konto') return j({ konten: [z.konto], gefunden: 1 });
    if (p === 'admin/aktivitaet') return j({ konten: [], gesamt: 0, tage: 14, regel: { pauseMaxStd: 2, minStunden: 168 } });
    if (p === 'admin/reports') return j({ reports: [] });
    if (p === 'pending-rewards/claim') return j({ reward: null });
    if (p === 'reports') return j({ reports: [] });
    if (p.startsWith('admin/')) return j({});
    if (p === 'storage-list') return j({ keys: [] });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = b.value; } catch (e) {} return j({ ok: true, version: 2 }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    return j([]);
  };
}
function zustand(o){ return Object.assign({ konto: konto({}), posts: [], gets: [], notifs: [], alarmStatus: 200, galaxie: null, galaxieFehler: false, dialogAbbrechen: false, dialogAntworten: null }, o || {}); }
const overlaysWeg = () => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
  .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
const fuellen = async (page, sel, wert) => { try { await page.fill(sel, wert, { timeout: 3000 }); return true; } catch (e) { return false; } };
const klicken = async (page, sel) => { try { await page.click(sel, { timeout: 3000 }); return true; } catch (e) { return false; } };
const waehlen = async (page, sel, wert) => { try { await page.selectOption(sel, wert, { timeout: 3000 }); return true; } catch (e) { return false; } };

async function seite(browser, z, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message || e)));
  const dialoge = [];
  // dialogAntworten: eine Liste von true/false, der Reihe nach - so laesst sich die ZWEITE
  // Rueckfrage (Stummschaltung) getrennt von der ersten beantworten (Regel 66).
  page.on('dialog', d => {
    dialoge.push(d.message());
    const antwort = Array.isArray(z.dialogAntworten) ? z.dialogAntworten[dialoge.length - 1] : !z.dialogAbbrechen;
    if (antwort === false) d.dismiss(); else d.accept();
  });
  const store = { [SAVE_KEY]: save() };
  await page.route('**/api/**', backend(store, z));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await logMitschnitt(page);
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(overlaysWeg);
  let reiterDa = true;
  if (opt.reiter){
    await page.evaluate(() => { const o = document.getElementById('adminPanelOverlay'); if (o) o.style.display = 'flex'; });
    try { await page.click('#adminTab' + opt.reiter + 'Btn', { timeout: 3000 }); } catch (e) { reiterDa = false; }
    await page.waitForTimeout(1100);
  }
  const text = async sel => { try { return (await page.textContent(sel)) || ''; } catch (e) { return ''; } };
  const wert = async sel => { try { return await page.inputValue(sel, { timeout: 2000 }); } catch (e) { return null; } };
  const da = async sel => { try { return !!(await page.$(sel)); } catch (e) { return false; } };
  return { ctx, page, errs, dialoge, reiterDa, text, wert, da };
}
async function suche(s){ await fuellen(s.page, '#adminKontoSuche', 'ann'); await klicken(s.page, '#adminKontoSucheBtn'); await s.page.waitForTimeout(800); return s.text('#adminKontoListe'); }
const post = (z, p) => z.posts.filter(x => x.p === p);

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Waechter-Karte in der Lage ---------------------------------------------------------------
  const z1 = zustand();
  const s1 = await seite(browser, z1, { reiter: 'Lage' });
  const t1 = await s1.text('#adminLageInhalt');
  check('1-vorab: die Lage steht mit ihren vier Karten', s1.reiterDa && /Wirtschaft/.test(t1) && /Markt/.test(t1) && /PvE-Ziele/.test(t1) && /Betrieb/.test(t1),
    { reiterDa: s1.reiterDa });
  const w1 = await s1.text('#adminAlarmKarte');
  check('1a: die Waechter-Karte nennt jede Schwelle mit ihrem Messwert und faerbt die ueberschrittene',
    /Wächter/.test(w1) && /Angriffe in einer Stunde18 von 15/.test(w1) && /Fehlanmeldungen[^]*2 von 10/.test(w1)
    && /Ruhefrist je Meldung6 Stunden/.test(w1), { auszug: w1.slice(0, 220) });
  const farbe1 = await s1.page.evaluate(() => {
    const sp = Array.from(document.querySelectorAll('#adminAlarmKarte span'));
    const f = t => { const treffer = sp.filter(x => x.textContent.trim() === t); return treffer.length ? treffer[treffer.length - 1].style.color : null; };
    return { ueber: f('18 von 15'), unter: f('2 von 10') };
  });
  check('1a2: ueber der Schwelle orange, darunter gruen', farbe1.ueber === 'rgb(240, 153, 123)' && farbe1.unter === 'rgb(93, 202, 165)', farbe1);
  check('1a3: der letzte Lauf und die offenen Funde stehen da',
    /vor 20 Sekunden/.test(w1) && /Offen: angriffe \(anna\) 18/.test(w1) && /Zuletzt gemeldet:/.test(w1), { auszug: (w1.match(/Letzte Prüfung[^]{0,60}/) || [''])[0] });
  check('1c: keine Seitenfehler', s1.errs.length === 0, s1.errs);
  await s1.ctx.close();
  const z1b = zustand({ alarmStatus: 404 });
  const s1b = await seite(browser, z1b, { reiter: 'Lage' });
  const t1b = await s1b.text('#adminLageInhalt');
  const w1b = await s1b.text('#adminAlarmKarte');
  check('1b: ohne die Route faellt die Karte ERSATZLOS weg - die vier Lage-Karten bleiben (PAAR zu 1a)',
    w1b.trim() === '' && /Wirtschaft/.test(t1b) && /Betrieb/.test(t1b) && !/noch nicht \(404\)/.test(t1b),
    { waechter: w1b.slice(0, 40), lageDa: /Wirtschaft/.test(t1b) });
  await s1b.ctx.close();

  // ---- 2) Galaxie-Reiter ---------------------------------------------------------------------------
  const z2 = zustand();
  const s2 = await seite(browser, z2, { reiter: 'Galaxie' });
  const t2 = await s2.text('#adminGalaxieInhalt');
  check('2-vorab: der vierzehnte Reiter zeigt alle fuenf Bereiche',
    s2.reiterDa && /Weltboss/.test(t2) && /Alien-Nester/.test(t2) && /Wrackkonvois/.test(t2) && /Marktereignis/.test(t2) && /Kopfgeld/.test(t2),
    { reiterDa: s2.reiterDa });
  check('2e: steht ein Weltboss, gibt es Knoepfe fuer Lebenspunkte und Entfernen',
    /Stufe 3 · 800 \/ 1.000 LP · 2 beteiligt/.test(t2) && (await s2.da('#galaxieBossHpBtn')) && (await s2.da('#galaxieBossWegBtn')),
    { auszug: (t2.match(/Stufe 3[^]{0,50}/) || [''])[0] });
  check('2-vorab2: Nest, Konvoi, Marktereignis und Kopfgeld stehen mit ihren Angaben',
    /kryll bei sys_a · Stufe 2 · 100\/200/.test(t2) && /bei sys_b · 40.000\/40.000/.test(t2)
    && /Erzknappheit · Faktor 1.4/.test(t2) && /Auf ben · 2.000 Kredite · offen/.test(t2), { auszug: t2.slice(0, 200) });
  // 2b ZUERST (Abbruch): kein POST
  const z2b = zustand({ dialogAbbrechen: true });
  const s2b = await seite(browser, z2b, { reiter: 'Galaxie' });
  await klicken(s2b.page, '#galaxieBossWegBtn'); await s2b.page.waitForTimeout(500);
  check('2b: Abbrechen der Rueckfrage greift NICHT ein (PAAR zu 2a)',
    s2b.dialoge.length === 1 && post(z2b, 'admin/galaxie').length === 0, { dialoge: s2b.dialoge.length });
  await s2b.ctx.close();
  await waehlen(s2.page, '#galaxieNestVolk', 'vex');
  await waehlen(s2.page, '#galaxieNestSys', 'sys_c');
  await klicken(s2.page, '#galaxieNestBtn'); await s2.page.waitForTimeout(800);
  const p2 = post(z2, 'admin/galaxie');
  check('2a: ein Nest wird mit Volk und System gesetzt, nach Rueckfrage',
    p2.length === 1 && !!p2[0] && p2[0].b.bereich === 'nest' && p2[0].b.aktion === 'setzen' && p2[0].b.volk === 'vex' && p2[0].b.sys === 'sys_c'
    && s2.dialoge.some(d => /sys_c/.test(d) && /Karte aller Spieler/.test(d)), { post: p2.map(x => x.b), dialoge: s2.dialoge });
  await klicken(s2.page, '[data-galaxie-weg="nest"]'); await s2.page.waitForTimeout(800);
  const p2b = post(z2, 'admin/galaxie');
  check('2c: der Entfernen-Knopf an einem Eintrag schickt dessen Kennung',
    p2b.length === 2 && !!p2b[1] && p2b[1].b.aktion === 'entfernen' && p2b[1].b.id === 'nest-1' && p2b[1].b.bereich === 'nest',
    { post: p2b[1] ? p2b[1].b : null });
  await fuellen(s2.page, '#galaxieKopfgeldName', 'anna');
  await klicken(s2.page, '#galaxieKopfgeldBtn'); await s2.page.waitForTimeout(800);
  const p2c = post(z2, 'admin/galaxie');
  check('2d: das Kopfgeld wird mit Namen gesetzt, und die Rueckfrage nennt die Folge',
    p2c.length === 3 && !!p2c[2] && p2c[2].b.bereich === 'kopfgeld' && p2c[2].b.targetUsername === 'anna'
    && s2.dialoge.some(d => /überschreibt das Kopfgeld auf den Bestenlisten-Ersten/.test(d)), { post: p2c[2] ? p2c[2].b : null });
  check('2g: keine Seitenfehler', s2.errs.length === 0, s2.errs);
  await s2.ctx.close();
  const z2c = zustand({ galaxie: Object.assign({}, GALAXIE, { weltboss: null, marktEreignis: null, kopfgeld: null, nester: [], konvois: [] }) });
  const s2c = await seite(browser, z2c, { reiter: 'Galaxie' });
  const t2c = await s2c.text('#adminGalaxieInhalt');
  check('2f: steht kein Weltboss, sagt die Karte das - und bietet KEIN Erschaffen an (PAAR zu 2e)',
    /Gerade steht kein Weltboss/.test(t2c) && /kein „Erschaffen"/.test(t2c)
    && !(await s2c.da('#galaxieBossHpBtn')) && !(await s2c.da('#galaxieBossWegBtn')), { auszug: t2c.slice(0, 120) });
  check('2f2: leere Listen sagen "keine", das Marktereignis "kein Ereignis aktiv"',
    (t2c.match(/keine/g) || []).length >= 2 && /Kein Ereignis aktiv/.test(t2c) && /Kein Kopfgeld gesetzt/.test(t2c));
  await s2c.ctx.close();

  // ---- 3) Geschenk an ein Konto ---------------------------------------------------------------------
  const z3 = zustand();
  const s3 = await seite(browser, z3, { reiter: 'Konto' });
  await suche(s3);
  await waehlen(s3.page, '[data-konto-gabe="anna"]', 'kristalle');
  await fuellen(s3.page, '[data-konto-gabemenge="anna"]', '2500');
  await klicken(s3.page, '[data-konto-geschenk="anna"]'); await s3.page.waitForTimeout(500);
  check('3b: ohne Grund wird nicht einmal gefragt (PAAR zu 3a)',
    post(z3, 'admin/geschenk-konto').length === 0 && s3.dialoge.length === 0
    && (await logZeilen(s3.page)).some(l => /begründen/.test(l)), { dialoge: s3.dialoge.length });
  await fuellen(s3.page, '[data-konto-geschenkgrund="anna"]', 'Entschaedigung fuer den Fehler von gestern');
  await klicken(s3.page, '[data-konto-geschenk="anna"]'); await s3.page.waitForTimeout(800);
  const p3 = post(z3, 'admin/geschenk-konto');
  check('3a: Gabe, Menge und Grund gehen an genau dieses Konto',
    p3.length === 1 && !!p3[0] && p3[0].b.targetUsername === 'anna' && p3[0].b.gaben.kristalle === 2500 && /Entschaedigung/.test(p3[0].b.grund)
    && s3.dialoge.some(d => /2\.500 kristalle/.test(d) && /Entschaedigung/.test(d)), { post: p3.map(x => x.b) });
  check('3a2: die Felder sind danach leer, die Meldung nennt das Postfach',
    (await s3.wert('[data-konto-gabemenge="anna"]')) === '' && (await s3.wert('[data-konto-geschenkgrund="anna"]')) === ''
    && (await logZeilen(s3.page)).some(l => /Postfach/.test(l)));
  await fuellen(s3.page, '[data-konto-gabemenge="anna"]', '0');
  await fuellen(s3.page, '[data-konto-geschenkgrund="anna"]', 'Test test');
  await klicken(s3.page, '[data-konto-geschenk="anna"]'); await s3.page.waitForTimeout(500);
  check('3c: eine Menge von null wird abgelehnt', post(z3, 'admin/geschenk-konto').length === 1
    && (await logZeilen(s3.page)).some(l => /größer als 0/.test(l)));

  // ---- 4) Chat-Moderation ---------------------------------------------------------------------------
  await klicken(s3.page, '[data-konto-chat="anna"]'); await s3.page.waitForTimeout(800);
  const c4 = await s3.text('[data-konto-chat-box="anna"]');
  check('4-vorab: beide Kanaele stehen mit Text und je einem Entfernen-Knopf',
    /Global: Beleidigung im Chat/.test(c4) && /Allianz T1: Im Allianzchat/.test(c4)
    && (await s3.page.$$('[data-chat-loeschen]')).length === 2, { auszug: c4.slice(0, 140) });
  check('4-vorab2: der Abruf nennt Konto und Grenze', (z3.gets[0] || '').indexOf('name=anna') > 0 && (z3.gets[0] || '').indexOf('limit=20') > 0, { get: z3.gets[0] });
  await s3.ctx.close();
  // 4a: beide Rueckfragen mit Ja -> loeschen UND stummschalten
  const z4 = zustand({ dialogAntworten: [true, true] });
  const s4 = await seite(browser, z4, { reiter: 'Konto' });
  await suche(s4);
  await klicken(s4.page, '[data-konto-chat="anna"]'); await s4.page.waitForTimeout(800);
  await klicken(s4.page, '[data-chat-loeschen="globalchat:msg:1-a"]'); await s4.page.waitForTimeout(900);
  const p4 = post(z4, 'admin/chat/loeschen');
  check('4a: die Nachricht wird entfernt und der Verfasser fuer 24 Stunden stummgeschaltet',
    p4.length === 1 && !!p4[0] && p4[0].b.key === 'globalchat:msg:1-a' && p4[0].b.stummStunden === 24
    && s4.dialoge.length === 2 && /verschwindet für alle/.test(s4.dialoge[0]) && /stummgeschaltet/.test(s4.dialoge[1])
    && (await logZeilen(s4.page)).some(l => /Nachricht entfernt/.test(l) && /stummgeschaltet/.test(l)),
    { post: p4.map(x => x.b), dialoge: s4.dialoge.length });
  await s4.ctx.close();
  // 4b: erste Rueckfrage Ja, zweite Nein -> nur loeschen
  const z4b = zustand({ dialogAntworten: [true, false] });
  const s4b = await seite(browser, z4b, { reiter: 'Konto' });
  await suche(s4b);
  await klicken(s4b.page, '[data-konto-chat="anna"]'); await s4b.page.waitForTimeout(800);
  await klicken(s4b.page, '[data-chat-loeschen="globalchat:msg:1-a"]'); await s4b.page.waitForTimeout(900);
  const p4b = post(z4b, 'admin/chat/loeschen');
  check('4b: Nein bei der zweiten Rueckfrage loescht NUR, ohne Stummschaltung (PAAR zu 4a)',
    p4b.length === 1 && !!p4b[0] && p4b[0].b.stummStunden === 0 && s4b.dialoge.length === 2
    && !(await logZeilen(s4b.page)).some(l => /stummgeschaltet/.test(l)), { post: p4b.map(x => x.b) });
  await s4b.ctx.close();
  // 4c: Nein bei der ERSTEN Rueckfrage -> gar nichts
  const z4c = zustand({ dialogAntworten: [false] });
  const s4c = await seite(browser, z4c, { reiter: 'Konto' });
  await suche(s4c);
  await klicken(s4c.page, '[data-konto-chat="anna"]'); await s4c.page.waitForTimeout(800);
  await klicken(s4c.page, '[data-chat-loeschen="globalchat:msg:1-a"]'); await s4c.page.waitForTimeout(600);
  check('4c: Abbrechen bei der ersten Rueckfrage fragt nicht weiter und loescht nichts',
    s4c.dialoge.length === 1 && post(z4c, 'admin/chat/loeschen').length === 0, { dialoge: s4c.dialoge.length });
  check('4d: keine Seitenfehler', s4c.errs.length === 0, s4c.errs);
  await s4c.ctx.close();

  // ---- 5) Das Postfach des Betreibers ---------------------------------------------------------------
  const z5 = zustand({ notifs: [
    { id: 'n1', type: 'admin-alarm', time: JETZT - 1000, payload: { titel: 'Angriffe in einer Stunde', text: 'anna hat 18 Angriffe geflogen.', wert: 18, schwelle: 15, art: 'angriffe', konto: 'anna' } },
    { id: 'n2', type: 'geschenk-konto', time: JETZT - 2000, payload: { grund: 'Entschaedigung fuer den Fehler', gaben: { credits: 500 } } } ] });
  const s5 = await seite(browser, z5);
  const t5 = await s5.text('#notificationEventsBox');
  check('5a: der Alarm steht im Postfach mit Konto, Messwert und Schwelle',
    /Angriffe in einer Stunde bei anna/.test(t5) && /18 Angriffe geflogen/.test(t5) && /gemessen 18, Schwelle 15/.test(t5),
    { auszug: t5.slice(0, 160) });
  check('5b: das Geschenk nennt den Grund - ohne ihn wuesste der Beschenkte nichts',
    /Ein Geschenk vom Betreiber: Entschaedigung fuer den Fehler/.test(t5));
  check('5c: keine der beiden Meldungen faellt auf das generische "Ereignis" zurueck', !/>Ereignis</.test(await s5.page.innerHTML('#notificationEventsBox')));
  await s5.ctx.close();

  await browser.close();
  console.log(fail ? 'FAIL - es gab rote Pruefungen.' : 'Alles gruen.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL - Testlauf abgebrochen: ' + (e && e.stack || e)); process.exit(1); });
