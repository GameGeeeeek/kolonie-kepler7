// Vier weitere Admin-Faehigkeiten im Spiel (02.09.2026, Auftrag Sascha "Ideen fuer noch mehr admin
// Funktionen jeglicher Art" - alle vier Vorschlaege gewaehlt): Sperre mit Grund und Frist plus
// Stummschaltung im Konto-Blatt, Spielstand-Blatt mit Backups und Ruecksicherung, Protokoll-Reiter,
// Allianz-Reiter. Dazu die Spielerseite: Ein Stummgeschalteter erfaehrt beim Senden den Grund,
// ein Gesperrter beim Anmelden.
//
// KERNMESSUNGEN ALS PAARE (Arbeitsregel 61):
//   1a/1b  Sperr- und Stumm-Zeilen stehen da UND fehlen ersatzlos ohne die Felder
//   1c/1d  Bestaetigen sperrt mit Grund und Frist UND Abbrechen schickt nichts
//   3a/3b  die Backup-Kachel steht mit der Route UND fehlt ersatzlos ohne sie
//   5c/5d  Aufloesen schickt nach Bestaetigung UND nicht nach Abbruch
//   7a/7b  der Stummgeschaltete liest den Grund UND ein freier Spieler sieht keine Meldung
//
// Alle Bedienschritte sind gefasst (fuellen/klicken/waehlen mit 3 s), damit die Gegenprobe am
// alten Stand ROT wird statt mitten drin zu sterben (Arbeitsregel 34).
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
  check('0a: die Reiter Protokoll und Allianzen stehen in ADMIN_REITER mit Ladefunktion',
    /tab:'protokoll'[^\n]*laden:\(\) => loadAdminProtokoll\(\)/.test(JS) && /tab:'allianzen'[^\n]*laden:\(\) => loadAdminAllianzen\(\)/.test(JS));
  check('0b: der Chat sendet mit Server STRIKT - ein 403 faellt nicht still auf den lokalen Speicher zurueck',
    (JS.match(/\(useBackend\(\) \? storageSetStrict : storageSet\)\('(globalchat|alliance):/g) || []).length === 2);
  check('0c: die Sperre schickt Grund und Frist mit', /body: JSON\.stringify\(\{ targetUsername: username, banned: wantBan, grund: opt\.grund \|\| '', tage \}\)/.test(JS));
}

const Z = c => ({ groesse: 5000, spielerName: 'anna', lastTick: JETZT - 60000, credits: c, xp: 10, prestige: 0, kampfpunkte: 0,
  ressourcen: { energie: 1, erz: 2, kristalle: 3, deuterium: 4, antimaterie: 5, forschungspunkte: 6 },
  gebaeude: { mine: 7 }, forschung: { energietechnik: 2 }, flotte: { jaeger: 12 }, kolonien: 0, missionen: 0, bauauftraege: 1, allianz: 'T1' });
const SPIELSTAND = { username: 'anna', vorhanden: true, version: 3, zusammenfassung: Z(1234),
  schatten: { zeit: JETZT - 7200000, quelle: 'vor Ruecksicherung aus db-x.json', zusammenfassung: Z(999) } };
const BACKUPS = [{ datei: 'db-2026-09-02T04-00-00-000Z.json', zeit: JETZT - 3600000, groesse: 20480 }, { datei: 'db-2026-09-02T03-30-00-000Z.json', zeit: JETZT - 5400000, groesse: 20000 }];
function konto(extra){
  return Object.assign({ username: 'anna', gesperrt: false, registriert: 1755000000000, emailForm: 'a***@example.org', emailBestaetigt: true,
    letzteSitzung: 1756000000000, hatSpielstand: true, heimatsystem: 'kepler', unterstuetzer: null, unterstuetzerVergeben: false,
    testphaseGenutzt: false, stufeJeMax: null, sternenstaub: 100, abgewehrteAngriffe: 0, pveKills: null, bonusCodes: 0, bonusFehlversuche: 0,
    marktErloesHeute: 0, offeneBelohnungen: 0, tokenVersion: 0, angemeldet: true, reaktionen: [] }, extra || {});
}
const KONTO_FREI = konto({});
const KONTO_GESPERRT = konto({ gesperrt: true, sperre: { grund: 'Spam im Chat', bis: JETZT + 86400000, seit: JETZT - 3600000 },
  stumm: { bis: JETZT + 7200000, grund: 'Beleidigung' }, schattenDa: true });
const PROTOKOLL = [{ zeit: JETZT - 1000, art: 'set-banned', von: 'GameGeeeeek', ziel: 'ben', details: { targetUsername: 'ben', banned: true, grund: 'Spam', tage: 1 } },
  { zeit: JETZT - 5000, art: 'geschenk', von: 'GameGeeeeek', ziel: null, details: { text: 'Danke' } }];
const ALLIANZEN = [
  { tag: 'T1', name: 'Erste', gegruendet: 1755000000000, gruender: 'ben', beitritt: 'application', aufgeloest: false, aufgeloestAm: 0, basisStufe: 3, bewerbungen: 1, mitgliederMax: 15,
    mitglieder: [{ userId: 'b', name: 'ben', rolle: 'admin', seit: 1, letzteSitzung: JETZT - 86400000, kontoDa: true }, { userId: 'c', name: 'carl', rolle: 'officer', seit: 1, letzteSitzung: 0, kontoDa: false }, { userId: 'a', name: 'anna', rolle: 'member', seit: 1, letzteSitzung: JETZT, kontoDa: true }] },
  { tag: 'T2', name: null, gegruendet: 1754000000000, gruender: 'fritz', beitritt: 'open', aufgeloest: true, aufgeloestAm: 1755500000000, basisStufe: null, bewerbungen: 0, mitgliederMax: 10, mitglieder: [] }
];
const SYSTEM = { deploy: { commit: 'abc', checkout: 'abc', blob: 'def', selbstNeustart: true, uptimeSec: 100 }, bestand: { konten: 5, spielstaende: 5, offenesFeedback: 0, offeneMeldungen: 0, offeneKofiZuordnungen: 0 },
  konfiguration: [], laufzeit: { passwortlisteEintraege: 10, pushSchluesselDa: true, selbstheilungDa: true } };

const save = () => JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9e6, erz: 5000, kristalle: 9e6, deuterium: 9e6, antimaterie: 9e4, forschungspunkte: 9e4 },
  buildings: { solar: 22, mine: 20, labor: 14, lager: 30, werft: 14 }, research: {}, fleet: { missions: [] },
  colonies: {}, activeBasePlanet: 'home', player: { id: ADMIN, name: 'GameGeeeeek', avatarKey: null },
  xp: 9e5, credits: 5e5, buffs: [], lastTick: Date.now(), colonyNames: {}, modules: {}, shipModules: {}
}));

function backend(store, z){
  return async r => {
    const req = r.request(); const u = req.url(); const p = u.split('/api/')[1].split('?')[0]; const q = u.split('?')[1] || '';
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
    if (p === 'health') return j({ ok: true });
    if (p === 'login') return z.loginStatus === 403 ? j({ error: 'Dieses Konto wurde gesperrt – Grund: Spam – bis 03.09.2026, 06:17 Uhr.', gesperrt: true }, 403) : j({ token: 'tok', userId: ADMIN, username: 'GameGeeeeek' });
    // Ohne Token muss /me 401 geben - sonst haelt das Spiel sich fuer angemeldet, die Landeseite
    // mit dem Anmeldeformular erscheint nie, und 7c misst ueber leerem Text (Regel 28).
    if (p === 'me' && z.meStatus === 401) return j({ error: 'Nicht angemeldet.' }, 401);
    if (p === 'me') return j({ userId: ADMIN, username: 'GameGeeeeek', isAdmin: true, admin: true, homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true,
      supporter: { active: true, tier: 'gold', exempt: true, granted: false, until: 0 } });
    if (p === 'admin/aktivitaet') return j({ konten: [], gesamt: 0, tage: 14, regel: { pauseMaxStd: 2, minStunden: 168 } });
    if (p === 'admin/konto') return j({ konten: [z.konto], gefunden: 1 });
    if (p === 'admin/set-banned'){ z.posts.push({ p, b }); return j({ ok: true, username: b.targetUsername, banned: b.banned, bannGrund: b.grund, bannBis: b.tage ? JETZT + b.tage * 86400000 : 0 }); }
    if (p === 'admin/stumm'){ z.posts.push({ p, b }); return j({ ok: true, username: b.targetUsername, stummBis: b.stunden ? JETZT + b.stunden * 3600000 : 0 }); }
    if (p === 'admin/spielstand') return z.spielstandStatus === 404 ? j({ error: 'nicht da' }, 404) : j(SPIELSTAND);
    if (p === 'admin/backups') return z.backupsStatus === 404 ? j({ error: 'nicht da' }, 404) : j({ backups: BACKUPS, behalt: 48, taktMinuten: 30 });
    if (p === 'admin/backup-spielstand'){ z.gets.push(q); return j({ username: 'anna', datei: decodeURIComponent((q.match(/datei=([^&]+)/) || ['', ''])[1]), zeit: JETZT - 3600000, vorhanden: true, zusammenfassung: Z(777) }); }
    if (p === 'admin/spielstand-zurueckholen'){ z.posts.push({ p, b }); return j({ ok: true, username: 'anna', version: 5, zusammenfassung: Z(777), schattenDa: true }); }
    if (p === 'admin/spielstand-schatten-zurueck'){ z.posts.push({ p, b }); return j({ ok: true, username: 'anna', version: 6, zusammenfassung: Z(999) }); }
    if (p === 'admin/backup-jetzt'){ z.posts.push({ p, b }); return j({ ok: true, neuestes: BACKUPS[0], anzahl: 3 }); }
    if (p === 'admin/protokoll') return j({ eintraege: z.protokoll, behalt: 300 });
    if (p === 'admin/allianzen') return j({ allianzen: ALLIANZEN, gesamt: 2, aktiv: 1 });
    if (p === 'admin/allianz/anfuehrer' || p === 'admin/allianz/aufloesen'){ z.posts.push({ p, b }); return j({ ok: true, tag: b.tag, herabgestuft: 1, entfernt: 3 }); }
    if (p === 'admin/systemstand') return j(SYSTEM);
    if (p === 'admin/reports') return j({ reports: [{ id: 'r1', time: JETZT - 60000, reporterName: 'ben', targetName: 'anna', targetBanned: false, reason: 'Beleidigung im Chat' }] });
    if (p === 'pending-rewards/claim') return j({ reward: null });
    if (p === 'notifications') return j({ notifications: [] });
    if (p === 'reports') return j({ reports: [] });
    if (p.startsWith('admin/')) return j({});
    if (p === 'storage-list') return j({ keys: [] });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){
        if (k.startsWith('globalchat:msg:')){ z.chatPuts.push(k); return z.stumm ? j({ error: 'Du bist bis 02.09.2026, 08:17 Uhr stummgeschaltet – Grund: Beleidigung.' }, 403) : j({ ok: true, version: 1 }); }
        try { store[k] = b.value; } catch (e) {} return j({ ok: true, version: 2 });
      }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    return j([]);
  };
}
function zustand(o){ return Object.assign({ konto: KONTO_FREI, posts: [], gets: [], chatPuts: [], protokoll: PROTOKOLL, stumm: false, spielstandStatus: 200, backupsStatus: 200, loginStatus: 200 }, o || {}); }
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
  if (!opt.ohneToken) await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await logMitschnitt(page);
  await page.goto(SPIEL_URL); await page.waitForTimeout(opt.ohneToken ? 2500 : 4200);
  await page.evaluate(overlaysWeg);
  let reiterDa = true;
  if (opt.reiter){
    await page.evaluate(() => { const o = document.getElementById('adminPanelOverlay'); if (o) o.style.display = 'flex'; });
    try { await page.click('#adminTab' + opt.reiter + 'Btn', { timeout: 3000 }); } catch (e) { reiterDa = false; }
    await page.waitForTimeout(900);
  }
  const text = async sel => { try { return (await page.textContent(sel)) || ''; } catch (e) { return ''; } };
  return { ctx, page, errs, dialoge, reiterDa, text };
}
async function suche(s){ await fuellen(s.page, '#adminKontoSuche', 'ann'); await klicken(s.page, '#adminKontoSucheBtn'); await s.page.waitForTimeout(800); return s.text('#adminKontoListe'); }
const post = (z, p) => z.posts.filter(x => x.p === p);

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Konto-Blatt: Sperre mit Grund und Frist, Stummschaltung ---------------------------------
  const z1 = zustand({ konto: KONTO_GESPERRT });
  const s1 = await seite(browser, z1, { reiter: 'Konto' });
  const t1 = await suche(s1);
  check('1-vorab: Reiter und Blatt stehen', s1.reiterDa && /anna/.test(t1), { reiterDa: s1.reiterDa });
  check('1a: das Blatt zeigt Sperre (Grund, Frist, Beginn) und Stummschaltung (Frist, Grund)',
    /Sperre/.test(t1) && /Spam im Chat/.test(t1) && /bis /.test(t1) && /seit /.test(t1) && /Stummgeschaltet/.test(t1) && /Beleidigung/.test(t1), { auszug: (t1.match(/Sperre[^]{0,120}/) || [''])[0] });
  const aufhebenDa1 = await s1.page.$('[data-konto-stumm-auf]').then(e => !!e).catch(() => false);
  check('1f: bei aktiver Stummschaltung gibt es den Aufheben-Knopf', aufhebenDa1);
  await klicken(s1.page, '[data-konto-stumm-auf]'); await s1.page.waitForTimeout(600);
  check('1f2: Aufheben schickt stunden 0', post(z1, 'admin/stumm').length === 1 && post(z1, 'admin/stumm')[0].b.stunden === 0, post(z1, 'admin/stumm').map(x => x.b));
  await s1.ctx.close();
  const z1b = zustand({ konto: KONTO_FREI });
  const s1b = await seite(browser, z1b, { reiter: 'Konto' });
  const t1b = await suche(s1b);
  check('1b: ohne die Felder fehlen Sperr- und Stumm-Zeilen ERSATZLOS (PAAR zu 1a)', /anna/.test(t1b) && !/Sperre\s/.test(t1b) && !/Stummgeschaltet/.test(t1b), { auszug: t1b.slice(0, 80) });
  const aufhebenDa1b = await s1b.page.$('[data-konto-stumm-auf]').then(e => !!e).catch(() => false);
  check('1f3: ohne Stummschaltung KEIN Aufheben-Knopf', !aufhebenDa1b);
  // 1c: sperren mit Grund und 7 Tagen
  await fuellen(s1b.page, '[data-konto-grund="anna"]', 'Testgrund');
  await waehlen(s1b.page, '[data-konto-tage="anna"]', '7');
  await klicken(s1b.page, '[data-konto-sperre="anna"]'); await s1b.page.waitForTimeout(800);
  const sp1c = post(z1b, 'admin/set-banned');
  check('1c: Sperren schickt Grund und Frist - und die Rueckfrage nennt beide',
    sp1c.length === 1 && sp1c[0].b.banned === true && sp1c[0].b.grund === 'Testgrund' && sp1c[0].b.tage === 7 && s1b.dialoge.some(d => /7 Tage/.test(d) && /Testgrund/.test(d)),
    { body: sp1c.map(x => x.b), dialoge: s1b.dialoge });
  // 1e: stummschalten 6 Stunden
  await fuellen(s1b.page, '[data-konto-grund="anna"]', 'Spam');
  await waehlen(s1b.page, '[data-konto-stumm-stunden="anna"]', '6');
  await klicken(s1b.page, '[data-konto-stumm="anna"]'); await s1b.page.waitForTimeout(800);
  const st1e = post(z1b, 'admin/stumm');
  check('1e: Stummschalten schickt Stunden und Grund', st1e.length === 1 && st1e[0].b.stunden === 6 && st1e[0].b.grund === 'Spam', st1e.map(x => x.b));
  check('1-fehler: keine Seitenfehler', s1b.errs.length === 0, s1b.errs.slice(0, 3));
  await s1b.ctx.close();
  const z1d = zustand({ konto: KONTO_FREI, dialogAbbrechen: true });
  const s1d = await seite(browser, z1d, { reiter: 'Konto' });
  await suche(s1d);
  await klicken(s1d.page, '[data-konto-sperre="anna"]'); await s1d.page.waitForTimeout(600);
  check('1d: Abbrechen in der Rueckfrage sperrt nicht (PAAR zu 1c)', s1d.dialoge.length === 1 && post(z1d, 'admin/set-banned').length === 0, { dialoge: s1d.dialoge.length, posts: post(z1d, 'admin/set-banned').length });
  await s1d.ctx.close();

  // ---- 2) Spielstand-Blatt, Backups, Ruecksicherung -----------------------------------------------
  const z2 = zustand({ konto: KONTO_GESPERRT });
  const s2 = await seite(browser, z2, { reiter: 'Konto' });
  await suche(s2);
  await klicken(s2.page, '[data-konto-spielstand="anna"]'); await s2.page.waitForTimeout(900);
  const t2 = await s2.text('[data-konto-spielstand-box="anna"]');
  const optionen2 = await s2.page.$$eval('[data-backup-datei="anna"] option', os => os.map(o => o.value)).catch(() => []);
  check('2a: das Spielstand-Blatt fasst zusammen - Version, Kredite exakt, Gebaeude, Schatten, Backup-Auswahl',
    /Aktueller Spielstand/.test(t2) && /Version 3/.test(t2) && /1\.234/.test(t2) && /mine 7/.test(t2) && /Schatten vom/.test(t2) && /999/.test(t2) && optionen2.length === 2 && optionen2[0] === BACKUPS[0].datei,
    { auszug: t2.slice(0, 160), optionen: optionen2 });
  await klicken(s2.page, '[data-backup-ansehen="anna"]'); await s2.page.waitForTimeout(800);
  const t2b = await s2.text('[data-backup-box="anna"]');
  check('2b: "Aus Backup ansehen" fragt genau die gewaehlte Datei ab und zeigt den Stand daraus (777)',
    z2.gets.length === 1 && z2.gets[0].indexOf(encodeURIComponent(BACKUPS[0].datei)) >= 0 && /Im Backup vom/.test(t2b) && /777/.test(t2b), { gets: z2.gets, auszug: t2b.slice(0, 100) });
  await klicken(s2.page, '[data-backup-zurueckholen="anna"]'); await s2.page.waitForTimeout(900);
  const rh = post(z2, 'admin/spielstand-zurueckholen');
  check('2c: "Diesen Stand zurueckholen" fragt nach (nennt die Abmeldung) und schickt Konto und Datei',
    rh.length === 1 && rh[0].b.targetUsername === 'anna' && rh[0].b.datei === BACKUPS[0].datei && s2.dialoge.some(d => /abgemeldet/.test(d) && /Schatten/.test(d)), { body: rh.map(x => x.b), dialoge: s2.dialoge });
  const zeilen2 = await logZeilen(s2.page);
  check('2c2: die Meldung sagt, dass der Spieler sich neu anmelden muss', zeilen2.some(l => /zurückgeholt/.test(l) && /neu anmelden/.test(l)), { zeilen: zeilen2.filter(l => /zurück/.test(l)) });
  await klicken(s2.page, '[data-konto-spielstand="anna"]'); await s2.page.waitForTimeout(900);
  await klicken(s2.page, '[data-schatten-zurueck="anna"]'); await s2.page.waitForTimeout(800);
  check('2d: "Schatten wieder einsetzen" schickt das Rueckgaengig', post(z2, 'admin/spielstand-schatten-zurueck').length === 1 && post(z2, 'admin/spielstand-schatten-zurueck')[0].b.targetUsername === 'anna');
  check('2-fehler: keine Seitenfehler', s2.errs.length === 0, s2.errs.slice(0, 3));
  await s2.ctx.close();
  const s2e = await seite(browser, zustand({ spielstandStatus: 404 }), { reiter: 'Konto' });
  await suche(s2e);
  await klicken(s2e.page, '[data-konto-spielstand="anna"]'); await s2e.page.waitForTimeout(800);
  const t2e = await s2e.text('[data-konto-spielstand-box="anna"]');
  check('2e: ein Server ohne die Route wird benannt (404), statt leer zu bleiben', /noch nicht/.test(t2e) && /404/.test(t2e), { auszug: t2e.slice(0, 100) });
  await s2e.ctx.close();

  // ---- 3) Systemstand: Backups-Kachel -------------------------------------------------------------
  const z3 = zustand();
  const s3 = await seite(browser, z3, { reiter: 'System' });
  const t3 = await s3.text('#adminSystemInhalt');
  check('3a: die Backups-Kachel nennt Anzahl, Deckel, Takt und die juengste Sicherung', /Backups/.test(t3) && /2 von höchstens 48/.test(t3) && /alle 30 Minuten/.test(t3) && /20 kB/.test(t3), { auszug: (t3.match(/Backups[^]{0,120}/) || [''])[0] });
  await klicken(s3.page, '#adminBackupJetztBtn'); await s3.page.waitForTimeout(800);
  const zeilen3 = await logZeilen(s3.page);
  check('3c: "Backup jetzt" schickt und meldet die Anzahl', post(z3, 'admin/backup-jetzt').length === 1 && zeilen3.some(l => /Backup angelegt/.test(l) && /3 Sicherungen/.test(l)), { posts: post(z3, 'admin/backup-jetzt').length, zeilen: zeilen3.filter(l => /Backup/.test(l)) });
  await s3.ctx.close();
  const s3b = await seite(browser, zustand({ backupsStatus: 404 }), { reiter: 'System' });
  const t3b = await s3b.text('#adminSystemInhalt');
  check('3b: ohne die Route fehlt die Kachel ERSATZLOS, der Systemstand steht trotzdem (PAAR zu 3a)', /Auslieferung/.test(t3b) && !/Backups/.test(t3b) && !/Backup jetzt/.test(t3b), { auszug: t3b.slice(0, 80) });
  await s3b.ctx.close();

  // ---- 4) Protokoll-Reiter -------------------------------------------------------------------------
  const s4 = await seite(browser, zustand(), { reiter: 'Protokoll' });
  const t4 = await s4.text('#adminProtokollListe');
  check('4a: der Reiter oeffnet und zeigt die Eintraege mit Art, Ziel, Wer und Angaben', s4.reiterDa && /set-banned → ben/.test(t4) && /von GameGeeeeek/.test(t4) && /grund=Spam/.test(t4) && /tage=1/.test(t4) && /geschenk/.test(t4) && /text=Danke/.test(t4),
    { reiterDa: s4.reiterDa, auszug: t4.slice(0, 200) });
  check('4b: targetUsername steht nicht doppelt (einmal als Ziel, nicht noch einmal in den Angaben)', !/targetUsername=/.test(t4));
  await s4.ctx.close();
  const s4b = await seite(browser, zustand({ protokoll: [] }), { reiter: 'Protokoll' });
  const t4b = await s4b.text('#adminProtokollListe');
  check('4c: ein leeres Protokoll sagt das', /Noch keine Handlung/.test(t4b), { auszug: t4b.slice(0, 60) });
  await s4b.ctx.close();

  // ---- 5) Allianzen-Reiter -------------------------------------------------------------------------
  const z5 = zustand();
  const s5 = await seite(browser, z5, { reiter: 'Allianzen' });
  const t5 = await s5.text('#adminAllianzenListe');
  const t5T1 = await s5.text('[data-allianz="T1"]'), t5T2 = await s5.text('[data-allianz="T2"]');
  const knoepfeT2 = await s5.page.$$('[data-allianz="T2"] button').then(l => l.length).catch(() => -1);
  check('5a: T1 zeigt Mitglieder (Anfuehrer zuerst), Limit, Basisstufe, Bewerbung, Beitrittsart; T2 ist aufgeloest und ohne Knoepfe',
    s5.reiterDa && /\[T1\] Erste/.test(t5T1) && /3 von 15 Mitgliedern/.test(t5T1) && /Basis Stufe 3/.test(t5T1) && /1 offene Bewerbung/.test(t5T1) && /auf Bewerbung/.test(t5T1) &&
    t5T1.indexOf('ben') < t5T1.indexOf('carl') && /Konto fehlt/.test(t5T1) && /aufgelöst/.test(t5T2) && knoepfeT2 === 0,
    { t1: t5T1.slice(0, 200), t2: t5T2.slice(0, 80), knoepfeT2 });
  await waehlen(s5.page, '[data-allianz-mitglied="T1"]', 'anna');
  await klicken(s5.page, '[data-allianz-anfuehrer="T1"]'); await s5.page.waitForTimeout(800);
  const an5 = post(z5, 'admin/allianz/anfuehrer');
  check('5b: "Zum Anfuehrer machen" schickt Tag und das gewaehlte Mitglied', an5.length === 1 && an5[0].b.tag === 'T1' && an5[0].b.targetUsername === 'anna', an5.map(x => x.b));
  await klicken(s5.page, '[data-allianz-aufloesen="T1"]'); await s5.page.waitForTimeout(800);
  const auf5 = post(z5, 'admin/allianz/aufloesen');
  check('5c: "Aufloesen" fragt nach und schickt den Tag', auf5.length === 1 && auf5[0].b.tag === 'T1' && s5.dialoge.some(d => /auflösen/.test(d) && /nicht zurücknehmen/.test(d)), { body: auf5.map(x => x.b) });
  check('5-fehler: keine Seitenfehler', s5.errs.length === 0, s5.errs.slice(0, 3));
  await s5.ctx.close();
  const z5d = zustand({ dialogAbbrechen: true });
  const s5d = await seite(browser, z5d, { reiter: 'Allianzen' });
  await klicken(s5d.page, '[data-allianz-aufloesen="T1"]'); await s5d.page.waitForTimeout(600);
  check('5d: Abbrechen loest nicht auf (PAAR zu 5c)', s5d.dialoge.length === 1 && post(z5d, 'admin/allianz/aufloesen').length === 0, { dialoge: s5d.dialoge.length });
  await s5d.ctx.close();

  // ---- 6) Meldungen-Reiter: die Sperre nimmt den Grund der Meldung mit ---------------------------
  const z6 = zustand();
  const s6 = await seite(browser, z6, { reiter: 'Reports' });
  await klicken(s6.page, '[data-admin-ban="anna"]'); await s6.page.waitForTimeout(800);
  const sp6 = post(z6, 'admin/set-banned');
  check('6a: Sperren aus einer Meldung schickt "Meldung: <Grund>" unbefristet, und die Rueckfrage zeigt den Grund',
    sp6.length === 1 && sp6[0].b.grund === 'Meldung: Beleidigung im Chat' && sp6[0].b.tage === 0 && s6.dialoge.some(d => /Beleidigung im Chat/.test(d)), { body: sp6.map(x => x.b) });
  await s6.ctx.close();

  // ---- 7) Die Spielerseite: Stummschaltung im Chat, Sperre beim Anmelden --------------------------
  const z7 = zustand({ stumm: true });
  const s7 = await seite(browser, z7, {});
  await s7.page.evaluate(() => { const i = document.getElementById('chatPanelGlobalInput'); const b = document.getElementById('chatPanelGlobalSendBtn'); if (i && b){ i.value = 'hallo welt'; b.click(); } });
  await s7.page.waitForTimeout(1200);
  const zeilen7 = await logZeilen(s7.page);
  check('7a: der Stummgeschaltete liest beim Senden Frist und Grund - kein stilles Speichern', z7.chatPuts.length === 1 && zeilen7.some(l => /stummgeschaltet/.test(l) && /Beleidigung/.test(l)),
    { puts: z7.chatPuts.length, zeilen: zeilen7.filter(l => /stumm|Nachricht/.test(l)) });
  await s7.ctx.close();
  const z7b = zustand({ stumm: false });
  const s7b = await seite(browser, z7b, {});
  await s7b.page.evaluate(() => { const i = document.getElementById('chatPanelGlobalInput'); const b = document.getElementById('chatPanelGlobalSendBtn'); if (i && b){ i.value = 'hallo welt'; b.click(); } });
  await s7b.page.waitForTimeout(1200);
  const zeilen7b = await logZeilen(s7b.page);
  check('7b: ein freier Spieler sendet ohne Meldung (PAAR)', z7b.chatPuts.length === 1 && !zeilen7b.some(l => /stummgeschaltet|nicht gesendet/.test(l)), { puts: z7b.chatPuts.length, zeilen: zeilen7b.filter(l => /stumm|Nachricht/.test(l)) });
  await s7b.ctx.close();
  const s7c = await seite(browser, zustand({ loginStatus: 403, meStatus: 401 }), { ohneToken: true });
  await klicken(s7c.page, '[data-ll-open="login"]');
  await fuellen(s7c.page, '#loginUsername', 'ben'); await fuellen(s7c.page, '#loginPassword', 'test1234');
  await klicken(s7c.page, '#loginSubmitBtn'); await s7c.page.waitForTimeout(1200);
  const fehler7 = await s7c.text('#loginError');
  check('7c: der Gesperrte liest beim Anmelden Grund und Frist', /gesperrt/.test(fehler7) && /Spam/.test(fehler7) && /bis /.test(fehler7), { text: fehler7 });
  await s7c.ctx.close();

  await browser.close();
  console.log('');
  console.log(fail ? 'FAIL - es gab rote Pruefungen.' : 'Alles gruen.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEHLER: ' + (e && e.stack || e)); process.exit(1); });
