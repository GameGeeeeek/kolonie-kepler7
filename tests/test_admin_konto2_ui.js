// Vier weitere Admin-Faehigkeiten am Konto (02.09.2026, Auftrag Sascha "Weitere Ideen fuer Admin
// Funktionen" - alle vier gewaehlt), Frontend zu Backend #203: Kampfverlauf als Beweis zu einer
// Meldung, Anmelde-Forensik im Konto-Blatt, E-Mail an ein Konto und an alle, Konto-Loeschung mit
// sieben Tagen Frist.
//
// KERNMESSUNGEN ALS PAARE (Arbeitsregel 61):
//   1a/1b  der Verlauf steht mit Kennzahlen UND ohne die Route steht nur die 404-Meldung
//   2a/2b  Mail schickt nach Bestaetigung UND nicht nach Abbruch
//   3a/3b  Loeschung schickt Grund nach Bestaetigung UND nicht nach Abbruch
//   3c/3d  bei laufender Loeschung steht der Abbrechen-Knopf UND der Loeschen-Knopf ist weg
//   4a/4b  Fehlversuche stehen in der Zeile UND fehlen ersatzlos, wenn es keine gab
//   5a/5b  der Rundversand zeigt seine Zahlen UND zeigt sie AUCH, wenn nichts rausging (502)
//
// Alle Bedienschritte sind gefasst (fuellen/klicken mit 3 s), damit die Gegenprobe am alten Stand
// ROT wird statt mitten drin zu sterben (Arbeitsregel 34).
//
// GEGENPROBE (Regel 1), gemessen am 02.09.2026 gegen origin/main (v8.636.0, 5210626) per
// KEPLER_SPIELDATEI: 28 von 33 fallen, Prueflisten per diff identisch (kein Abbruch mittendrin).
// Gruen bleiben am alten Stand nur fuenf, und jede davon aus einem benannten Grund:
//   1c, 3f, 5d  "keine Seitenfehler" - die messen die Abwesenheit eines Fehlers, nicht die Flaeche
//   3d          "KEIN Loeschen-Knopf" - am alten Stand gibt es ihn ohnehin nicht (die zweite
//               Haelfte des Paares 3c/3d, allein also kein Beleg)
//   5c          "ohne Betreff wird nichts geschickt" - dito, ohne Rundversand kann nichts gehen
// Die uebrigen Nicht-Wirkungen (2b, 3a2, 3b, 2c) fallen dort, weil sie zusaetzlich die Rueckfrage
// oder die Meldung messen, die es ohne die Flaeche nicht gibt.
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
  check('0a: die vier neuen Handlungen sind verdrahtet',
    /adminKontoVerlauf\(b\.getAttribute\('data-konto-verlauf'\)\)/.test(JS)
    && /adminKontoMail\(name, bet \? bet\.value\.trim\(\) : ''/.test(JS)
    && /adminKontoLoeschen\(name, feld \? feld\.value\.trim\(\) : ''\)/.test(JS)
    && /adminKontoLoeschenAbbrechen\(b\.getAttribute\('data-konto-loeschen-ab'\)\)/.test(JS));
  check('0b: der Rundversand haengt am Knopf des Ankuendigungs-Reiters',
    /adminMailAlleBtn\.onclick = \(\) => adminMailAlle\(\)/.test(JS) && /id="adminMailAlleBetreff"/.test(HTML));
  // Der Knopf sperrt sich waehrend des Versands - dieselbe Lehre wie beim Geschenk-Knopf (#521):
  // Eine langsame Antwort und ein zweiter Klick schickten sonst zweimal an alle.
  check('0c: der Rundversand-Knopf sperrt sich waehrend des Versands',
    /if \(btn\) btn\.disabled = true;\s*\/\/ gegen den zweiten Klick/.test(JS) && /finally \{ if \(btn\) btn\.disabled = false; \}/.test(JS));
}

function konto(extra){
  return Object.assign({ username: 'anna', gesperrt: false, registriert: 1755000000000, emailForm: 'a***@example.org', emailBestaetigt: true,
    letzteSitzung: 1756000000000, hatSpielstand: true, heimatsystem: 'kepler', unterstuetzer: null, unterstuetzerVergeben: false,
    testphaseGenutzt: false, stufeJeMax: null, sternenstaub: 100, abgewehrteAngriffe: 0, pveKills: null, bonusCodes: 0, bonusFehlversuche: 0,
    marktErloesHeute: 0, offeneBelohnungen: 0, tokenVersion: 0, angemeldet: true, reaktionen: [],
    loeschung: null, kampfVerlauf: 2,
    anmeldung: { fehlversuche: 0, fehlerZuletzt: 0, fehlversucheVorher: 0, letzte: JETZT - 3600000, gesamt: 12, sitzungOffen: true, sitzungSeit: JETZT - 1800000 } }, extra || {});
}
const VERLAUF = { username: 'anna', merken: 30, angriffeGesamt: 2, haeufigstesZiel: { name: 'ben', anzahl: 2 }, letzteStunde: 2,
  verlauf: [
    { zeit: JETZT - 60000, rolle: 'angriff', gegner: 'ben', ziel: 'home', erfolg: true, angriff: 2000, verteidigung: 300, beute: 3 },
    { zeit: JETZT - 120000, rolle: 'verteidigung', gegner: 'carl', ziel: 'kolonie_1', erfolg: false, angriff: 900, verteidigung: 100, beute: 0 }
  ] };

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
    if (p === 'notifications') return j({ notifications: [] });
    if (p === 'admin/konto/verlauf'){ z.gets.push(u); return z.verlaufStatus === 404 ? j({ error: 'nicht da' }, 404) : j(VERLAUF); }
    if (p === 'admin/konto/loeschen'){ z.posts.push({ p, b }); return j({ ok: true, username: b.targetUsername, ab: JETZT + 7 * 86400000, fristTage: 7 }); }
    if (p === 'admin/konto/loeschen-abbrechen'){ z.posts.push({ p, b }); return j({ ok: true, username: b.targetUsername, lief: true }); }
    if (p === 'admin/mail-alle'){ z.posts.push({ p, b }); return z.rundStatus === 502
      ? j({ ok: false, gesendet: 0, abgemeldet: 1, ohneAdresse: 2, fehlgeschlagen: 3, uebrig: 0, deckel: 40, error: 'Keine einzige Mail ging raus - der Mail-Dienst nimmt nichts an.' }, 502)
      : j({ ok: true, gesendet: 9, abgemeldet: 1, ohneAdresse: 2, fehlgeschlagen: 0, uebrig: 0, deckel: 40 }); }
    if (p === 'admin/mail'){ z.posts.push({ p, b }); return j({ ok: true, username: b.targetUsername, empfaenger: 'a***@example.org' }); }
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
function zustand(o){ return Object.assign({ konto: konto({}), posts: [], gets: [], verlaufStatus: 200, rundStatus: 200, dialogAbbrechen: false }, o || {}); }
const overlaysWeg = () => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
  .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
const fuellen = async (page, sel, wert) => { try { await page.fill(sel, wert, { timeout: 3000 }); return true; } catch (e) { return false; } };
const klicken = async (page, sel) => { try { await page.click(sel, { timeout: 3000 }); return true; } catch (e) { return false; } };

async function seite(browser, z, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message || e)));
  const dialoge = [];
  page.on('dialog', d => { dialoge.push(d.message()); if (z.dialogAbbrechen) d.dismiss(); else d.accept(); });   // Regel 66
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
    await page.waitForTimeout(900);
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

  // ---- 1) Kampfverlauf ----------------------------------------------------------------------------
  const z1 = zustand();
  const s1 = await seite(browser, z1, { reiter: 'Konto' });
  const t1 = await suche(s1);
  check('1-vorab: das Blatt steht und traegt den Verlauf-Knopf mit Zahl', s1.reiterDa && /anna/.test(t1) && /Kampfverlauf ansehen \(2\)/.test(t1),
    { reiterDa: s1.reiterDa, auszug: (t1.match(/Kampfverlauf[^]{0,20}/) || [''])[0] });
  await klicken(s1.page, '[data-konto-verlauf="anna"]'); await s1.page.waitForTimeout(800);
  const box1 = await s1.text('[data-konto-verlauf-box="anna"]');
  check('1a: der Verlauf zeigt beide Rollen mit Ausgang, Kraeften und Standort',
    /griff an ben/.test(box1) && /gewonnen · 2\.000 gegen 300/.test(box1)
    && /verteidigte gegen carl \(kolonie_1\)/.test(box1) && /verloren · 900 gegen 100/.test(box1),
    { auszug: box1.slice(0, 200) });
  check('1a2: die drei Kennzahlen stehen im Kopf',
    /2 eigene Angriffe in den letzten 30 Kämpfen/.test(box1) && /häufigstes Ziel/.test(box1) && /ben/.test(box1) && /2 in der letzten Stunde/.test(box1),
    { kopf: box1.slice(0, 160) });
  check('1a3: der Abruf nennt das Konto als Parameter', (z1.gets[0] || '').indexOf('targetUsername=anna') > 0, { get: z1.gets[0] });
  check('1c: keine Seitenfehler', s1.errs.length === 0, s1.errs);
  await s1.ctx.close();
  const z1b = zustand({ verlaufStatus: 404 });
  const s1b = await seite(browser, z1b, { reiter: 'Konto' });
  await suche(s1b);
  await klicken(s1b.page, '[data-konto-verlauf="anna"]'); await s1b.page.waitForTimeout(800);
  const box1b = await s1b.text('[data-konto-verlauf-box="anna"]');
  check('1b: ohne die Route steht die 404-Meldung mit dem Namen der Liste, kein Kampf (PAAR zu 1a)',
    /den Kampfverlauf/.test(box1b) && /noch nicht \(404\)/.test(box1b) && !/griff an/.test(box1b), { auszug: box1b.slice(0, 90) });
  await s1b.ctx.close();

  // ---- 2) E-Mail an ein Konto ----------------------------------------------------------------------
  const z2 = zustand();
  const s2 = await seite(browser, z2, { reiter: 'Konto' });
  await suche(s2);
  // 2c ZUERST (leer): kein POST, aber die Meldung
  await klicken(s2.page, '[data-konto-mail="anna"]'); await s2.page.waitForTimeout(500);
  check('2c: ohne Betreff und Text wird nichts geschickt und nicht einmal gefragt',
    post(z2, 'admin/mail').length === 0 && s2.dialoge.length === 0
    && (await logZeilen(s2.page)).some(l => /Betreff und Text/.test(l)), { dialoge: s2.dialoge.length });
  await fuellen(s2.page, '[data-konto-mailbetreff="anna"]', 'Wartung heute Abend');
  await fuellen(s2.page, '[data-konto-mailtext="anna"]', 'Wir machen heute Abend eine kurze Wartung.');
  await klicken(s2.page, '[data-konto-mail="anna"]'); await s2.page.waitForTimeout(800);
  const p2 = post(z2, 'admin/mail');
  check('2a: nach der Rueckfrage geht die Mail mit Konto, Betreff und Text raus',
    p2.length === 1 && p2[0].b.targetUsername === 'anna' && p2[0].b.betreff === 'Wartung heute Abend' && /kurze Wartung/.test(p2[0].b.text)
    && s2.dialoge.some(d => /Wartung heute Abend/.test(d)), { posts: p2.map(x => x.b), dialoge: s2.dialoge });
  check('2a2: die Meldung nennt die verkuerzte Adresse, und die Felder sind danach leer',
    (await logZeilen(s2.page)).some(l => /verschickt \(a\*\*\*@example\.org\)/.test(l))
    && (await s2.wert('[data-konto-mailbetreff="anna"]')) === '' && (await s2.wert('[data-konto-mailtext="anna"]')) === '');
  await s2.ctx.close();
  const z2b = zustand({ dialogAbbrechen: true });
  const s2b = await seite(browser, z2b, { reiter: 'Konto' });
  await suche(s2b);
  await fuellen(s2b.page, '[data-konto-mailbetreff="anna"]', 'Wartung');
  await fuellen(s2b.page, '[data-konto-mailtext="anna"]', 'Ein Text, der lang genug ist.');
  await klicken(s2b.page, '[data-konto-mail="anna"]'); await s2b.page.waitForTimeout(600);
  check('2b: Abbrechen der Rueckfrage schickt nichts (PAAR zu 2a)',
    s2b.dialoge.length === 1 && post(z2b, 'admin/mail').length === 0, { dialoge: s2b.dialoge.length });

  // ---- 3) Loeschung mit Frist ----------------------------------------------------------------------
  await fuellen(s2b.page, '[data-konto-loeschgrund="anna"]', 'Loeschbitte des Spielers');
  await klicken(s2b.page, '[data-konto-loeschen="anna"]'); await s2b.page.waitForTimeout(600);
  check('3b: Abbrechen der Rueckfrage loescht nicht (PAAR zu 3a)',
    s2b.dialoge.length === 2 && post(z2b, 'admin/konto/loeschen').length === 0, { dialoge: s2b.dialoge.length });
  await s2b.ctx.close();
  const z3 = zustand();
  const s3 = await seite(browser, z3, { reiter: 'Konto' });
  await suche(s3);
  await klicken(s3.page, '[data-konto-loeschen="anna"]'); await s3.page.waitForTimeout(500);
  check('3a2: ohne Grund wird nicht einmal gefragt', post(z3, 'admin/konto/loeschen').length === 0 && s3.dialoge.length === 0
    && (await logZeilen(s3.page)).some(l => /begründen/.test(l)));
  await fuellen(s3.page, '[data-konto-loeschgrund="anna"]', 'Loeschbitte des Spielers');
  await klicken(s3.page, '[data-konto-loeschen="anna"]'); await s3.page.waitForTimeout(900);
  const p3 = post(z3, 'admin/konto/loeschen');
  check('3a: nach der Rueckfrage wird mit Grund vorgemerkt', p3.length === 1 && p3[0].b.targetUsername === 'anna' && p3[0].b.grund === 'Loeschbitte des Spielers',
    { posts: p3.map(x => x.b) });
  check('3a3: die Rueckfrage nennt die Frist, was verschwindet UND was bleibt',
    s3.dialoge.some(d => /sieben Tagen/.test(d) && /Spielstand/.test(d) && /Vorposten/.test(d) && /Chat-Nachrichten und Feedback bleiben stehen/.test(d) && /abbrechen/.test(d)),
    { dialog: (s3.dialoge[0] || '').slice(0, 140) });
  check('3a4: die Meldung nennt den Tag der Loeschung', (await logZeilen(s3.page)).some(l => /wird am /.test(l) && /abbrechbar/.test(l)));
  await s3.ctx.close();
  // Laufende Loeschung: Warnzeile, Abbrechen-Knopf, KEIN Loeschen-Knopf
  const z3b = zustand({ konto: konto({ loeschung: { ab: JETZT + 5 * 86400000, seit: JETZT - 2 * 86400000, grund: 'Loeschbitte des Spielers' } }) });
  const s3b = await seite(browser, z3b, { reiter: 'Konto' });
  const t3b = await suche(s3b);
  check('3c: bei laufender Loeschung stehen Zeile und Abbrechen-Knopf',
    /Löschung vorgemerkt/.test(t3b) && /Loeschbitte des Spielers/.test(t3b) && (await s3b.da('[data-konto-loeschen-ab="anna"]')),
    { auszug: (t3b.match(/Löschung vorgemerkt[^]{0,80}/) || [''])[0] });
  check('3d: dann gibt es KEINEN Loeschen-Knopf und kein Grundfeld (PAAR zu 3c)',
    !(await s3b.da('[data-konto-loeschen="anna"]')) && !(await s3b.da('[data-konto-loeschgrund="anna"]')));
  await klicken(s3b.page, '[data-konto-loeschen-ab="anna"]'); await s3b.page.waitForTimeout(800);
  check('3e: Abbrechen schickt an die Abbruch-Route und meldet, dass das Konto bleibt',
    post(z3b, 'admin/konto/loeschen-abbrechen').length === 1
    && (await logZeilen(s3b.page)).some(l => /abgebrochen/.test(l) && /Konto bleibt/.test(l)));
  check('3f: keine Seitenfehler', s3b.errs.length === 0, s3b.errs);

  // ---- 4) Anmelde-Forensik in der Zeile ------------------------------------------------------------
  check('4b: ohne Fehlversuche steht keine Fehlversuch-Angabe, aber die Anmeldungen (PAAR zu 4a)',
    /Anmeldungen/.test(t3b) && /12 insgesamt/.test(t3b) && /Sitzung offen seit/.test(t3b) && !/Fehlversuch/.test(t3b),
    { auszug: (t3b.match(/Anmeldungen[^]{0,120}/) || [''])[0] });
  await s3b.ctx.close();
  const z4 = zustand({ konto: konto({ anmeldung: { fehlversuche: 7, fehlerZuletzt: JETZT - 600000, fehlversucheVorher: 3, letzte: JETZT - 7200000, gesamt: 12, sitzungOffen: false, sitzungSeit: 0 } }) });
  const s4 = await seite(browser, z4, { reiter: 'Konto' });
  const t4 = await suche(s4);
  check('4a: sieben Fehlversuche stehen mit Zeitpunkt, dazu die Zahl von davor und "keine offene Sitzung"',
    /7 Fehlversuche seit der letzten Anmeldung, zuletzt /.test(t4) && /davor 3 Fehlversuche/.test(t4) && /keine offene Sitzung/.test(t4),
    { auszug: (t4.match(/Anmeldungen[^]{0,160}/) || [''])[0] });
  const farbe4 = await s4.page.evaluate(() => {
    // Den INNERSTEN passenden span nehmen: Die Zeile selbst ist auch einer und traegt die
    // Grundfarbe - ein find() auf die Trefferliste liefert ihn zuerst und misst am Ziel vorbei.
    const treffer = Array.from(document.querySelectorAll('#adminKontoListe span')).filter(x => /Fehlversuche seit/.test(x.textContent));
    const innerster = treffer.filter(x => !treffer.some(y => y !== x && x.contains(y))).pop();
    return innerster ? innerster.style.color : null;
  });
  check('4a2: ab fuenf Fehlversuchen ist die Angabe orange, nicht gelb', farbe4 === 'rgb(240, 153, 123)', { farbe: farbe4 });
  await s4.ctx.close();

  // ---- 5) E-Mail an alle ---------------------------------------------------------------------------
  const z5 = zustand();
  const s5 = await seite(browser, z5, { reiter: 'Broadcast' });
  check('5-vorab: die Karte steht im Ankuendigungs-Reiter', s5.reiterDa && (await s5.da('#adminMailAlleBtn')), { reiterDa: s5.reiterDa });
  await klicken(s5.page, '#adminMailAlleBtn'); await s5.page.waitForTimeout(400);
  check('5c: ohne Betreff und Text wird nicht gefragt und nichts geschickt',
    post(z5, 'admin/mail-alle').length === 0 && s5.dialoge.length === 0);
  await fuellen(s5.page, '#adminMailAlleBetreff', 'Wartung heute Abend');
  await fuellen(s5.page, '#adminMailAlleText', 'Wir machen heute Abend eine kurze Wartung.');
  await klicken(s5.page, '#adminMailAlleBtn'); await s5.page.waitForTimeout(900);
  const p5 = post(z5, 'admin/mail-alle');
  const stand5 = await s5.text('#adminMailAlleStand');
  check('5a: der Rundversand schickt Betreff und Text und zeigt alle Zahlen',
    p5.length === 1 && p5[0].b.betreff === 'Wartung heute Abend'
    && /9 verschickt · 1 abgemeldet · 2 ohne bestätigte Adresse/.test(stand5)
    && s5.dialoge.some(d => /ALLE Spieler/.test(d) && /nicht zurückholen/.test(d)),
    { post: p5.map(x => x.b), stand: stand5 });
  check('5a2: die Felder sind nach dem Versand leer', (await s5.wert('#adminMailAlleBetreff')) === '' && (await s5.wert('#adminMailAlleText')) === '');
  await s5.ctx.close();
  const z5b = zustand({ rundStatus: 502 });
  const s5b = await seite(browser, z5b, { reiter: 'Broadcast' });
  await fuellen(s5b.page, '#adminMailAlleBetreff', 'Wartung');
  await fuellen(s5b.page, '#adminMailAlleText', 'Ein Text, der lang genug ist.');
  await klicken(s5b.page, '#adminMailAlleBtn'); await s5b.page.waitForTimeout(900);
  const stand5b = await s5b.text('#adminMailAlleStand');
  check('5b: ging nichts raus, stehen die Zahlen TROTZDEM da - und der Grund als Fehler (PAAR zu 5a)',
    /0 verschickt · 1 abgemeldet · 2 ohne bestätigte Adresse · 3 fehlgeschlagen/.test(stand5b)
    && (await logZeilen(s5b.page)).some(l => /Keine einzige Mail ging raus/.test(l)),
    { stand: stand5b });
  check('5b2: die Felder bleiben im Fehlerfall gefuellt, damit der Text nicht verloren ist',
    (await s5b.wert('#adminMailAlleBetreff')) === 'Wartung');
  check('5d: keine Seitenfehler', s5b.errs.length === 0, s5b.errs);
  await s5b.ctx.close();

  await browser.close();
  console.log(fail ? 'FAIL - es gab rote Pruefungen.' : 'Alles gruen.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL - Testlauf abgebrochen: ' + (e && e.stack || e)); process.exit(1); });
