// Vier weitere Admin-Faehigkeiten (02.09.2026, Auftrag Sascha "Weitere Ideen fuer Admin Funktionen" -
// alle vier Vorschlaege gewaehlt): Feedback beantworten (Antwort am Eintrag, Postfach-Meldung beim
// Einsender), Wartungsankuendigung mit Countdown-Banner fuer alle Spieler, Support-Werkzeuge im
// Konto-Blatt (E-Mail setzen, umbenennen, Reset-Link) und der dreizehnte Reiter "Lage".
//
// KERNMESSUNGEN ALS PAARE (Arbeitsregel 61):
//   1a/1b  die Antwort steht am Eintrag UND fehlt ersatzlos ohne das Feld
//   1c/1d  Antworten schickt id+text UND ein leeres Feld schickt nichts
//   3a/3c  das Banner zaehlt herunter UND ist ohne Ankuendigung leer und unsichtbar
//   4b/4c  Setzen laesst das Banner sofort erscheinen UND Aufheben laesst es sofort verschwinden
//   5d/5e  Umbenennen schickt nach Bestaetigung UND nicht nach Abbruch
//   5f/5g  der Reset-Link landet im Feld nach Bestaetigung UND nicht nach Abbruch
//   6a/6e  die vier Lage-Karten stehen mit der Route UND ohne sie steht nur die 404-Meldung
//
// Alle Bedienschritte sind gefasst (fuellen/klicken/waehlen mit 3 s), damit die Gegenprobe am
// alten Stand ROT wird statt mitten drin zu sterben (Arbeitsregel 34).
//
// GEGENPROBE (Regel 1), gemessen am 02.09.2026 gegen origin/main (v8.629.0, aafcdf9) per
// KEPLER_SPIELDATEI: 36 von 42 fallen, Prueflisten identisch (kein Abbruch). Gruen bleiben am alten
// Stand NUR 1-vorab (der Feedback-Reiter gab es schon), 2b (die generische Meldung), und die vier
// "keine Seitenfehler" (1e, 4e, 5i, 6f). Auch die Nicht-Wirkungen 1b/1d/4d/5c/5e/5g fallen dort, weil
// jede von ihnen zusaetzlich die Meldung bzw. die Rueckfrage misst, die es ohne die Flaeche nicht gibt.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, ruhigeUhren, logMitschnitt, logZeilen } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
const ADMIN = 'u-admin';
const JETZT = Date.now();
const LINK = 'https://gamegeeeeek.de/?reset=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// ---- 0) Quelltext -----------------------------------------------------------------------------
{
  const i = JS.indexOf('const ADMIN_REITER = [');
  const literal = i >= 0 ? JS.slice(i, JS.indexOf('];', i)) : '';
  check('0a: der Reiter Lage steht in ADMIN_REITER mit Ladefunktion, und es sind dreizehn Reiter',
    /tab:'lage'[^\n]*laden:\(\) => loadAdminLage\(\)/.test(literal) && (literal.match(/tab:'/g) || []).length === 13,
    { reiter: (literal.match(/tab:'/g) || []).length });
  check('0b: das Postfach kennt die Meldungsart feedback-antwort', /'feedback-antwort': \{ icon:'ti-message'/.test(JS));
  check('0c: das Banner steht im DOM, und die Ankuendigung wird beim Start und jede Minute geholt',
    /id="wartungBanner" role="status"/.test(HTML) && /setInterval\(\(\) => \{ try \{ ladeAnkuendigung\(\); \} catch\(e\)\{\} \}, 60000\)/.test(JS)
    && /loadNotificationEvents\(\); ladeAnkuendigung\(\); \} catch\(e\)\{\} \}, 2500\)/.test(JS));
  // Der PvP-Pfad zeigt data.error des Servers; die vier PvE-/Vorposten-Pfade (Festung, Nest, Konvoi,
  // Vorposten seit #531) werfen den Antworttext bei !ok weg und nennen den Grund nach Status - der 503
  // der Angriffspause gehoert dazu.
  check('0d: Festung, Nest, Konvoi und Vorposten nennen bei 503 die Angriffspause statt nur "kam nicht zustande"',
    (JS.match(/status === 503 \? ' – Angriffe sind gerade pausiert \(Wartung\)'/g) || []).length === 4);
}

function konto(extra){
  return Object.assign({ username: 'anna', gesperrt: false, registriert: 1755000000000, emailForm: 'a***@example.org', emailBestaetigt: true,
    letzteSitzung: 1756000000000, hatSpielstand: true, heimatsystem: 'kepler', unterstuetzer: null, unterstuetzerVergeben: false,
    testphaseGenutzt: false, stufeJeMax: null, sternenstaub: 100, abgewehrteAngriffe: 0, pveKills: null, bonusCodes: 0, bonusFehlversuche: 0,
    marktErloesHeute: 0, offeneBelohnungen: 0, tokenVersion: 0, angemeldet: true, reaktionen: [] }, extra || {});
}
const FEEDBACK = [
  { id: 'f1', userId: 'u-anna', username: 'anna', time: JETZT - 60000, version: '8.629.0', type: 'bug', text: 'Der Knopf klemmt', erledigt: false, hatBild: false,
    antwort: { text: 'Danke, ist in Arbeit', zeit: JETZT - 30000 } },
  { id: 'f2', userId: 'u-ben', username: 'ben', time: JETZT - 120000, version: '8.629.0', type: 'idee', text: 'Mehr Schiffe bitte', erledigt: false, hatBild: false, antwort: null }
];
const LAGE = { jetzt: JETZT,
  wirtschaft: { konten: 5, aktiv7Tage: 3, kredite: { gesamt: 12345, median: 1000, top: [{ username: 'ben', credits: 9000 }, { username: 'anna', credits: 2000 }] },
    ressourcen: { erz: 5000, kristalle: 300 }, kampfpunkte: 777 },
  markt: { preise: { erz: { preis: 15, basis: 10 }, kristalle: { preis: 8, basis: 10 } }, ereignis: { label: 'Handelsflaute' }, trend: null },
  pve: { weltboss: { level: 3, hp: 5000, maxHp: 9000, beteiligte: 4 },
    nester: [{ volk: 'kryll', sys: 'n-sys', stufe: 2, lp: 100, lpMax: 200 }],
    festungen: [], konvois: [{ sys: 'k-sys', stufe: 1, lp: 50, lpMax: 80 }],
    vorposten: [{ sys: 'v-sys', besitzerName: 'ben', stufe: 2, kern: 10, kernMax: 20 }] },
  notAus: ['nester', 'angriffe'], ankuendigung: { text: 'Server-Update', ab: JETZT + 900000, dauerMinuten: 20 } };

const save = () => JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9e6, erz: 5000, kristalle: 9e6, deuterium: 9e6, antimaterie: 9e4, forschungspunkte: 9e4 },
  buildings: { solar: 22, mine: 20, labor: 14, lager: 30, werft: 14 }, research: {}, fleet: { missions: [] },
  colonies: {}, activeBasePlanet: 'home', player: { id: ADMIN, name: 'GameGeeeeek', avatarKey: null },
  xp: 9e5, credits: 5e5, buffs: [], lastTick: Date.now(), colonyNames: {}, modules: {}, shipModules: {}
}));

// Die Ankuendigung wird je Abruf mit der Serverzeit von JETZT gebaut (abIn relativ), damit der
// Countdown im Banner deterministisch 15 ergibt - unabhaengig davon, wie lange der Test schon laeuft.
function ankuendigungAntwort(a){
  if (!a) return { ankuendigung: null };
  const now = Date.now();
  return { ankuendigung: { text: a.text, ab: now + a.abIn, dauerMinuten: a.dauerMinuten, gesetzt: now - 1000, jetzt: now } };
}
function backend(store, z){
  return async r => {
    const req = r.request(); const u = req.url(); const p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
    if (p === 'health') return j({ ok: true });
    if (p === 'login') return j({ token: 'tok', userId: ADMIN, username: 'GameGeeeeek' });
    if (p === 'me') return j({ userId: ADMIN, username: 'GameGeeeeek', isAdmin: true, admin: true, homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true,
      supporter: { active: true, tier: 'gold', exempt: true, granted: false, until: 0 } });
    if (p === 'ankuendigung') return j(ankuendigungAntwort(z.ankuendigung));
    if (p === 'notifications') return j({ notifications: z.notifs });
    if (p === 'admin/feedback/antwort'){ z.posts.push({ p, b }); return j({ ok: true, zugestellt: true, antwort: { text: b.text, zeit: JETZT } }); }
    if (p === 'admin/feedback') return j({ feedback: z.feedback, gesamt: z.feedback.length, offen: z.feedback.length, angezeigt: z.feedback.length });
    if (p === 'admin/ankuendigung/aufheben'){ z.posts.push({ p, b }); z.ankuendigung = null; return j({ ok: true, aufgehoben: true }); }
    if (p === 'admin/ankuendigung'){ z.posts.push({ p, b }); z.ankuendigung = { text: b.text, abIn: b.abInMinuten * 60000, dauerMinuten: b.dauerMinuten }; return j({ ok: true }); }
    if (p === 'admin/schalter') return j({ schalter: [] });
    if (p === 'admin/aktivitaet') return j({ konten: [], gesamt: 0, tage: 14, regel: { pauseMaxStd: 2, minStunden: 168 } });
    if (p === 'admin/konto/email'){ z.posts.push({ p, b }); return j({ ok: true, username: b.targetUsername, emailForm: 'n***@example.org' }); }
    if (p === 'admin/konto/umbenennen'){ z.posts.push({ p, b }); return j({ ok: true, alterName: b.targetUsername, username: b.neuerName }); }
    if (p === 'admin/konto/reset-link'){ z.posts.push({ p, b }); return j({ ok: true, username: b.targetUsername, link: LINK, gueltigBis: JETZT + 3600000 }); }
    if (p === 'admin/konto') return j({ konten: [z.konto], gefunden: 1 });
    if (p === 'admin/lage') return z.lageStatus === 404 ? j({ error: 'nicht da' }, 404) : j(LAGE);
    if (p === 'admin/systemstand') return j({ deploy: { commit: 'abc', checkout: 'abc', blob: 'def', selbstNeustart: true, uptimeSec: 100 },
      bestand: { konten: 5, spielstaende: 5, offenesFeedback: 0, offeneMeldungen: 0, offeneKofiZuordnungen: 0 }, konfiguration: [],
      laufzeit: { passwortlisteEintraege: 10, pushSchluesselDa: true, selbstheilungDa: true } });
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
function zustand(o){ return Object.assign({ konto: konto({}), posts: [], feedback: FEEDBACK, notifs: [], ankuendigung: null, lageStatus: 200, dialogAbbrechen: false }, o || {}); }
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
  // Das Banner: sichtbar? Text? Ein fehlendes Element meldet da:false - die Gegenprobe soll das sehen.
  const banner = () => page.evaluate(() => { const el = document.getElementById('wartungBanner'); return el ? { da: true, sichtbar: el.style.display !== 'none', text: el.textContent } : { da: false, sichtbar: false, text: '' }; });
  return { ctx, page, errs, dialoge, reiterDa, text, wert, banner };
}
async function suche(s){ await fuellen(s.page, '#adminKontoSuche', 'ann'); await klicken(s.page, '#adminKontoSucheBtn'); await s.page.waitForTimeout(800); return s.text('#adminKontoListe'); }
const post = (z, p) => z.posts.filter(x => x.p === p);

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Feedback beantworten -------------------------------------------------------------------
  const z1 = zustand();
  const s1 = await seite(browser, z1, { reiter: 'Feedback' });
  const t1 = await s1.text('#adminFeedbackList');
  check('1-vorab: der Feedback-Reiter zeigt beide Eintraege', s1.reiterDa && /Der Knopf klemmt/.test(t1) && /Mehr Schiffe bitte/.test(t1), { reiterDa: s1.reiterDa });
  check('1a: die vorhandene Antwort steht am Eintrag mit Zeit', /Deine Antwort \(/.test(t1) && /Danke, ist in Arbeit/.test(t1), { auszug: (t1.match(/Deine Antwort[^]{0,60}/) || [''])[0] });
  check('1b: der Eintrag ohne Antwort hat KEINE Antwort-Zeile (PAAR zu 1a) - nur eine Antwort-Zeile fuer zwei Eintraege',
    (t1.match(/Deine Antwort/g) || []).length === 1);
  const feldDa = await s1.page.$('[data-fb-antwort-text="f2"]').then(e => !!e).catch(() => false);
  check('1a2: jeder Eintrag hat ein Antwortfeld und einen Antworten-Knopf',
    feldDa && (await s1.page.$$('[data-fb-antwort]')).length === 2);
  // 1d ZUERST (leer): kein POST, aber die Meldung
  await klicken(s1.page, '[data-fb-antwort="f2"]'); await s1.page.waitForTimeout(500);
  const zeilen1d = await logZeilen(s1.page);
  check('1d: ein leeres Feld schickt NICHTS und sagt es (PAAR zu 1c)', post(z1, 'admin/feedback/antwort').length === 0 && zeilen1d.some(l => /Bitte erst eine Antwort schreiben/.test(l)), { zeilen: zeilen1d.slice(-2) });
  await fuellen(s1.page, '[data-fb-antwort-text="f2"]', 'Kommt mit dem naechsten Update');
  await klicken(s1.page, '[data-fb-antwort="f2"]'); await s1.page.waitForTimeout(800);
  const p1 = post(z1, 'admin/feedback/antwort');
  check('1c: Antworten schickt id und Text an /admin/feedback/antwort', p1.length === 1 && p1[0].b.id === 'f2' && p1[0].b.text === 'Kommt mit dem naechsten Update', p1.map(x => x.b));
  const zeilen1c = await logZeilen(s1.page);
  check('1c2: die Meldung sagt, dass die Antwort im Postfach liegt', zeilen1c.some(l => /Antwort zugestellt/.test(l) && /Postfach/.test(l)), { zeilen: zeilen1c.slice(-2) });
  check('1e: keine Seitenfehler', s1.errs.length === 0, s1.errs);
  await s1.ctx.close();

  // ---- 2) Das Postfach des Einsenders ---------------------------------------------------------------
  const z2 = zustand({ notifs: [{ id: 'n1', type: 'feedback-antwort', time: JETZT - 1000, payload: { text: 'Danke, ist behoben', typ: 'bug', auszug: 'Der Knopf klemmt' } },
    { id: 'n2', type: 'gibtsnicht-xyz', time: JETZT - 2000, payload: {} }] });
  const s2 = await seite(browser, z2);
  const t2 = await s2.text('#notificationEventsBox');
  check('2a: die Antwort steht im Postfach mit Auszug des eigenen Feedbacks und dem Antworttext',
    /Antwort auf dein Feedback/.test(t2) && /Der Knopf klemmt/.test(t2) && /Danke, ist behoben/.test(t2), { auszug: t2.slice(0, 140) });
  check('2b: eine unbekannte Art bleibt das generische "Ereignis" (der Text kommt aus der Art, nicht aus dem Payload)', /Ereignis/.test(t2));
  await s2.ctx.close();

  // ---- 3) Das Wartungsbanner fuer alle Spieler ------------------------------------------------------
  const s3a = await seite(browser, zustand({ ankuendigung: { text: 'Server-Update', abIn: 15 * 60000, dauerMinuten: 20 } }));
  const b3a = await s3a.banner();
  check('3a: bevorstehende Wartung: das Banner ist sichtbar und zaehlt herunter (15 Min., ca. 20 Min., Text)',
    b3a.da && b3a.sichtbar && /^Wartung in 15 Min\. \(ca\. 20 Min\.\): Server-Update$/.test(b3a.text), b3a);
  await s3a.ctx.close();
  const s3b = await seite(browser, zustand({ ankuendigung: { text: 'Server-Update', abIn: -5 * 60000, dauerMinuten: 20 } }));
  const b3b = await s3b.banner();
  check('3b: laufende Wartung: das Banner nennt die Restdauer', b3b.sichtbar && /^Wartung läuft \(noch ca\. 15 Min\.\): Server-Update$/.test(b3b.text), b3b);
  await s3b.ctx.close();
  const s3c = await seite(browser, zustand({ ankuendigung: null }));
  const b3c = await s3c.banner();
  check('3c: ohne Ankuendigung ist das Banner da, aber unsichtbar und leer (PAAR zu 3a)', b3c.da && !b3c.sichtbar && b3c.text === '', b3c);
  await s3c.ctx.close();

  // ---- 4) Die Ankuendigungs-Karte im Schalter-Reiter ------------------------------------------------
  const z4 = zustand({ ankuendigung: null });
  const s4 = await seite(browser, z4, { reiter: 'Schalter' });
  const stand4 = await s4.text('#adminAnkuendigungStand');
  check('4-vorab: die Karte steht im Schalter-Reiter und meldet "keine aktiv"', s4.reiterDa && /Keine Ankündigung aktiv/.test(stand4), { reiterDa: s4.reiterDa, stand: stand4.slice(0, 60) });
  // 4d ZUERST (leer): kein POST
  await klicken(s4.page, '#adminAnkuendigungSetzenBtn'); await s4.page.waitForTimeout(500);
  const zeilen4d = await logZeilen(s4.page);
  check('4d: ohne Text wird nichts angekuendigt (PAAR zu 4a)', post(z4, 'admin/ankuendigung').length === 0 && zeilen4d.some(l => /Bitte sagen, was passiert/.test(l)), { zeilen: zeilen4d.slice(-1) });
  await fuellen(s4.page, '#adminAnkuendigungText', 'Server-Update');
  await waehlen(s4.page, '#adminAnkuendigungAb', '15');
  await waehlen(s4.page, '#adminAnkuendigungDauer', '30');
  await klicken(s4.page, '#adminAnkuendigungSetzenBtn'); await s4.page.waitForTimeout(1000);
  const p4 = post(z4, 'admin/ankuendigung');
  check('4a: Setzen schickt Text, Vorlauf 15 und Dauer 30 als Zahlen', p4.length === 1 && p4[0].b.text === 'Server-Update' && p4[0].b.abInMinuten === 15 && p4[0].b.dauerMinuten === 30, p4.map(x => x.b));
  const stand4b = await s4.text('#adminAnkuendigungStand');
  const b4b = await s4.banner();
  check('4b: danach zeigt die Karte "Aktiv" und das Banner erscheint SOFORT (ohne die Minute abzuwarten)',
    /Aktiv: „Server-Update"/.test(stand4b) && b4b.sichtbar && /Wartung in 15 Min\. \(ca\. 30 Min\.\)/.test(b4b.text), { stand: stand4b.slice(0, 80), banner: b4b });
  check('4b2: das Textfeld ist nach dem Setzen leer', (await s4.wert('#adminAnkuendigungText')) === '');
  await klicken(s4.page, '#adminAnkuendigungAufhebenBtn'); await s4.page.waitForTimeout(1000);
  const b4c = await s4.banner();
  const stand4c = await s4.text('#adminAnkuendigungStand');
  check('4c: Aufheben schickt an /aufheben, das Banner verschwindet SOFORT und die Karte meldet "keine aktiv" (PAAR zu 4b)',
    post(z4, 'admin/ankuendigung/aufheben').length === 1 && !b4c.sichtbar && /Keine Ankündigung aktiv/.test(stand4c), { banner: b4c });
  check('4e: keine Seitenfehler', s4.errs.length === 0, s4.errs);
  await s4.ctx.close();

  // ---- 5) Support-Werkzeuge im Konto-Blatt ------------------------------------------------------------
  const z5 = zustand();
  const s5 = await seite(browser, z5, { reiter: 'Konto' });
  const t5 = await suche(s5);
  const da5 = {};
  for (const sel of ['[data-konto-email="anna"]', '[data-konto-email-setzen="anna"]', '[data-konto-neuername="anna"]', '[data-konto-umbenennen="anna"]', '[data-konto-resetlink="anna"]', '[data-konto-resetlink-feld="anna"]'])
    da5[sel] = await s5.page.$(sel).then(e => !!e).catch(() => false);
  check('5a: das Blatt traegt E-Mail-Feld, Namensfeld und Reset-Link-Knopf mit Feld', s5.reiterDa && /anna/.test(t5) && Object.values(da5).every(Boolean), da5);
  // 5c ZUERST (leere E-Mail): kein POST
  await klicken(s5.page, '[data-konto-email-setzen="anna"]'); await s5.page.waitForTimeout(400);
  check('5c: eine leere E-Mail schickt nichts (PAAR zu 5b)', post(z5, 'admin/konto/email').length === 0 && (await logZeilen(s5.page)).some(l => /Bitte eine E-Mail-Adresse eingeben/.test(l)));
  await fuellen(s5.page, '[data-konto-email="anna"]', 'neu@example.org');
  await klicken(s5.page, '[data-konto-email-setzen="anna"]'); await s5.page.waitForTimeout(800);
  const p5b = post(z5, 'admin/konto/email');
  check('5b: E-Mail setzen schickt Konto und Adresse, die Meldung nennt die verkuerzte Form und "bestaetigt"',
    p5b.length === 1 && p5b[0].b.targetUsername === 'anna' && p5b[0].b.email === 'neu@example.org'
    && (await logZeilen(s5.page)).some(l => /E-Mail von anna gesetzt \(n\*\*\*@example\.org\)/.test(l) && /bestätigt/.test(l)), p5b.map(x => x.b));
  // 5f: Reset-Link nach Bestaetigung - er landet im Feld, NICHT in der Meldung
  await klicken(s5.page, '[data-konto-resetlink="anna"]'); await s5.page.waitForTimeout(800);
  const p5f = post(z5, 'admin/konto/reset-link');
  const feld5f = await s5.wert('[data-konto-resetlink-feld="anna"]');
  check('5f: der Reset-Link wird nach Rueckfrage erzeugt und steht im Feld', p5f.length === 1 && p5f[0].b.targetUsername === 'anna' && feld5f === LINK
    && s5.dialoge.some(d => /Reset-Link/.test(d) && /eine Stunde/.test(d)), { feld: feld5f, dialoge: s5.dialoge });
  const zeilen5f = await logZeilen(s5.page);
  check('5h: die Meldung nennt die Frist, aber NIE den Link selbst (der Token gehoert nicht ins Protokoll)',
    zeilen5f.some(l => /Reset-Link für anna erzeugt, gültig bis/.test(l)) && !zeilen5f.some(l => /reset=/.test(l)), { zeilen: zeilen5f.slice(-1) });
  // 5d: Umbenennen nach Bestaetigung - die Rueckfrage nennt die Abmeldung
  await fuellen(s5.page, '[data-konto-neuername="anna"]', 'annika');
  await klicken(s5.page, '[data-konto-umbenennen="anna"]'); await s5.page.waitForTimeout(900);
  const p5d = post(z5, 'admin/konto/umbenennen');
  check('5d: Umbenennen schickt alten und neuen Namen, die Rueckfrage nennt die Abmeldung, die Suche springt auf den neuen Namen',
    p5d.length === 1 && p5d[0].b.targetUsername === 'anna' && p5d[0].b.neuerName === 'annika'
    && s5.dialoge.some(d => /„anna" in „annika" umbenennen/.test(d) && /abgemeldet/.test(d))
    && (await s5.wert('#adminKontoSuche')) === 'annika'
    && (await logZeilen(s5.page)).some(l => /anna heißt jetzt annika/.test(l)), { posts: p5d.map(x => x.b), suche: await s5.wert('#adminKontoSuche') });
  check('5i: keine Seitenfehler', s5.errs.length === 0, s5.errs);
  await s5.ctx.close();
  // 5e/5g: Abbruch der Rueckfrage schickt nichts
  const z5b = zustand({ dialogAbbrechen: true });
  const s5b = await seite(browser, z5b, { reiter: 'Konto' });
  await suche(s5b);
  await fuellen(s5b.page, '[data-konto-neuername="anna"]', 'annika');
  await klicken(s5b.page, '[data-konto-umbenennen="anna"]'); await s5b.page.waitForTimeout(600);
  check('5e: Abbrechen der Rueckfrage benennt NICHT um (PAAR zu 5d)', s5b.dialoge.length === 1 && post(z5b, 'admin/konto/umbenennen').length === 0, { dialoge: s5b.dialoge.length });
  await klicken(s5b.page, '[data-konto-resetlink="anna"]'); await s5b.page.waitForTimeout(600);
  check('5g: Abbrechen erzeugt KEINEN Reset-Link, das Feld bleibt leer (PAAR zu 5f)',
    s5b.dialoge.length === 2 && post(z5b, 'admin/konto/reset-link').length === 0 && (await s5b.wert('[data-konto-resetlink-feld="anna"]')) === '');
  await s5b.ctx.close();

  // ---- 6) Der Lage-Reiter -------------------------------------------------------------------------------
  const z6 = zustand();
  const s6 = await seite(browser, z6, { reiter: 'Lage' });
  const t6 = await s6.text('#adminLageInhalt');
  check('6-vorab: der dreizehnte Reiter oeffnet sich und zeigt die vier Karten', s6.reiterDa && /Wirtschaft/.test(t6) && /Markt/.test(t6) && /PvE-Ziele/.test(t6) && /Betrieb/.test(t6), { reiterDa: s6.reiterDa });
  check('6a: Wirtschaft: Konten mit Aktiven, Kredite mit Median, Kampfpunkte, Ressourcen, Top-Liste',
    /Konten mit Spielstand5 · aktiv in 7 Tagen: 3/.test(t6) && /Kredite in Umlauf12\.345 · Median 1\.000/.test(t6) && /Kampfpunkte gesamt777/.test(t6)
    && /Erz 5\.000/i.test(t6) && /Top Kredite: ben 9\.000 · anna 2\.000/.test(t6), { auszug: t6.slice(0, 200) });
  check('6b: Markt: Abweichung zur Basis in Prozent, Ereignis', /15 \(Basis 10, \+50 %\)/.test(t6) && /8 \(Basis 10, -20 %\)/.test(t6) && /Ereignis: Handelsflaute/.test(t6));
  const farben6 = await s6.page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('#adminLageInhalt span'));
    const f = t => { const el = spans.find(x => x.textContent.indexOf(t) >= 0); return el ? el.style.color : null; };
    return { plus50: f('+50 %'), minus20: f('-20 %') };
  });
  check('6b2: ueber 40 % Abweichung ist orange, darunter normal', farben6.plus50 === 'rgb(240, 153, 123)' && farben6.minus20 === 'rgb(201, 212, 232)', farben6);
  check('6c: PvE: Weltboss, Nest, Festungen "keine", Konvoi, Vorposten mit Besitzer',
    /WeltbossStufe 3 · 5\.000 \/ 9\.000 HP · 4 beteiligt/.test(t6) && /kryll n-sys St\. 2 \(100\/200\)/.test(t6) && /Festungenkeine/.test(t6)
    && /k-sys St\. 1 \(50\/80\)/.test(t6) && /v-sys von ben St\. 2 \(10\/20\)/.test(t6), { auszug: (t6.match(/Weltboss[^]{0,200}/) || [''])[0] });
  check('6d: Betrieb: gesetzte Notaus-Schalter und die Ankuendigung', /Notaus gesetztnester, angriffe/.test(t6) && /WartungsankündigungServer-Update \(/.test(t6));
  check('6f: keine Seitenfehler', s6.errs.length === 0, s6.errs);
  await s6.ctx.close();
  const s6e = await seite(browser, zustand({ lageStatus: 404 }), { reiter: 'Lage' });
  const t6e = await s6e.text('#adminLageInhalt');
  check('6e: ohne die Route steht nur die 404-Meldung mit dem Namen der Liste, keine Karte (PAAR zu 6a)',
    s6e.reiterDa && /die Lage/.test(t6e) && /noch nicht \(404\)/.test(t6e) && !/Konten mit Spielstand/.test(t6e), { auszug: t6e.slice(0, 80) });
  await s6e.ctx.close();

  await browser.close();
  console.log(fail ? 'FAIL - es gab rote Pruefungen.' : 'Alles gruen.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL - Testlauf abgebrochen: ' + (e && e.stack || e)); process.exit(1); });
