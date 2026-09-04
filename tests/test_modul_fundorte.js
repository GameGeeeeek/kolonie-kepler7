// Modul-Fundorte und Drop-Chancen (04.09.2026, Idee Sascha "Module-Editor"), Frontend zu
// Backend #229: der Admin-Reiter "Module", der Anteil in der Sammlung und die Entwuerfe.
//
// DIE KERNMESSUNG (1c) und der Grund fuer den ganzen Zuschnitt: Die Uebersicht ist ABGELEITET.
// modulFundort() fragt fundPool() - dieselbe Funktion, die im Spiel wirklich zieht - statt eine
// zweite Fundort-Tabelle zu fuehren. 1c weist das nach, indem es ein Modul ZUR LAUFZEIT in den
// Abgrund umhaengt: Faellt die Uebersicht mit, liest sie den echten Topf. Eine gepflegte Tabelle
// wuerde die Aenderung nicht mitbekommen - und genau so veralten Kopien in diesem Projekt.
//
// WEITERE PAARE (Arbeitsregel 61):
//   1a/1b  jedes Modul bekommt eine Herkunft UND die Anteile eines Topfes ergeben zusammen 1
//   2a/2b  die Sammlung nennt den Anteil bei Modulen UND bei Verbrauchsguetern NICHT (dort waere
//          1/n schlicht falsch - die ziehen aus Toepfen mit eigenen Gewichten)
//   3a/3b  ein Entwurf steht mit "ohne Wirkung im Spiel" UND der Reiter zeigt die Fundorte auch
//          dann, wenn der Server gar nicht antwortet
//
// GEGENPROBE (Regel 1), gemessen gegen origin/main d677ffc (v8.668.0):
//   git show origin/main:weltraum_kolonie.html > /tmp/alt.html
//   KEPLER_SPIELDATEI=/tmp/alt.html node tests/test_modul_fundorte.js
// 22 von 24 Pruefungen fallen. GRUEN bleiben genau zwei, und das ist richtig so: 1f und 4c messen
// "keine Seitenfehler" - die gibt es am alten Stand auch nicht. Die Pruefnamen beider Laeufe sind
// per diff identisch (nur die Schlusszeile "FAIL - es gab rote Pruefungen." kommt dazu, deshalb
// Namen vergleichen statt zaehlen).
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, ruhigeUhren, logMitschnitt, logZeilen } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// Die Spieldatei laeuft komplett in einem (function(){ ... })() ab Zeile 4414 - im Browser ist also
// KEINE dieser Funktionen ueber page.evaluate erreichbar (gemessen: "modulFundorte is not defined").
// Deshalb dieselbe Bauart wie test_abgrund_gegenstaende/test_abgrund_module2: den Quelltext holen
// und in Node auswerten. Das ist hier sogar staerker als ein Aufruf in der Seite - so laesst sich
// ein Modul zur Laufzeit umhaengen (1c), ohne der laufenden Anwendung darunter den Boden wegzuziehen.
function fnAus(n){
  const m = JS.match(new RegExp('function\\s+' + n + '\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: ' + n);
  const i = JS.indexOf(m[0]);
  let d = 0, k = JS.indexOf('{', i + m[0].length);
  for (; k < JS.length; k++){ if (JS[k] === '{') d++; else if (JS[k] === '}'){ d--; if (!d) break; } }
  return JS.slice(i, k + 1);
}
function literalAus(name, auf, zu){
  const i = JS.indexOf('const ' + name + ' = ' + auf);
  if (i < 0) throw new Error('Literal nicht gefunden: ' + name);
  let d = 0, s = JS.indexOf(auf, i), k = s;
  for (; k < JS.length; k++){ if (JS[k] === auf) d++; else if (JS[k] === zu){ d--; if (!d) break; } }
  return JS.slice(s, k + 1);
}
// Die Herkunfts-Konstanten aus der Datei ableiten, nicht eintippen: Kommt eine sechste dazu, waechst
// die Liste von selbst mit, statt den Literal-Parser mit "... is not defined" zu reissen.
const HERKUNFT_DECLS = (JS.match(/const HERKUNFT_[A-Z_]+ = '[a-z]+'/g) || []).join('; ');
// Die Auswertung faengt ihren eigenen Fehler: An einem Stand OHNE diese Aenderung gibt es
// modulFundort() gar nicht. Ohne Fangnetz stuerbe der Lauf in Zeile 1 - die Gegenprobe haette dann
// KEINE Pruefnamen, und die geforderte "was fallen MUSS"-Liste liesse sich nicht vergleichen.
let KERN = null, kernFehler = null;
try {
KERN = new Function(HERKUNFT_DECLS + ';\n'
  + 'const MODULE_DEFS = ' + literalAus('MODULE_DEFS', '[', ']') + ';\n'
  + 'const SHIP_MODULE_DEFS = ' + literalAus('SHIP_MODULE_DEFS', '[', ']') + ';\n'
  + 'const MODUL_HERKUNFT_TEXT = ' + literalAus('MODUL_HERKUNFT_TEXT', '{', '}') + ';\n'
  + fnAus('fundPool') + '\n' + fnAus('modulFundort') + '\n' + fnAus('modulFundorte') + '\n'
  + fnAus('bosssetTeile') + '\n'
  + fnAus('adminZahl') + '\n' + fnAus('sammlungAnteilText') + '\n'
  + 'return { MODULE_DEFS, SHIP_MODULE_DEFS, HERKUNFT_ABGRUND, HERKUNFT_NORMAL,'
  + ' modulFundort, modulFundorte, sammlungAnteilText };')();
} catch(e){ kernFehler = String((e && e.message) || e); }
const LEER = { gesamt: 0, ohneHerkunft: 1, unerreichbar: [], normalSumme: 0, normalTopf: 0, herkuenfte: [] };
const SAVE_KEY = 'kepler7-save-v3';
const ADMIN = 'u-admin';

// ---- 0) Quelltext -----------------------------------------------------------------------------
{
  const i = JS.indexOf('const ADMIN_REITER = [');
  const literal = i >= 0 ? JS.slice(i, JS.indexOf('];', i)) : '';
  const eintraege = literal.split(/\n\s*\{ tab:/).slice(1);
  // Bewusst ohne feste Reiterzahl - dieselbe Falle, an der test_admin_support_ui 0a schon einmal fiel.
  check('0a: der Reiter Module steht in ADMIN_REITER mit Ladefunktion, und jeder Eintrag ist vollstaendig',
    /tab:'module'[^\n]*laden:\(\) => loadAdminModule\(\)/.test(literal)
    && eintraege.every(e => /btn:'/.test(e) && /view:'/.test(e) && /laden:/.test(e)),
    { reiter: eintraege.length });
  // Die Ableitung ist der ganze Punkt: Wer hier eine eigene Liste einfuehrt, faellt an dieser Zeile.
  check('0b: modulFundort fragt fundPool und fuehrt keine eigene Fundort-Tabelle',
    /function modulFundort\(d, defs, art\)/.test(JS) && /topf = fundPool\(defs, opt\)\.length/.test(JS)
    && /anteil = topf > 0 \? 1 \/ topf : null/.test(JS));
  check('0d: die Fundort-Funktionen liegen in der Spieldatei und lassen sich auswerten',
    !!KERN, { fehler: kernFehler });
  check('0c: Admin-Uebersicht und Sammlung lesen DIESELBE Funktion',
    /function sammlungAnteilText\(g\)[\s\S]{0,600}modulFundort\(d, defs,/.test(JS)
    && /const funde = modulFundorte\(\);/.test(JS));
}

const save = () => JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9e6, erz: 5000, kristalle: 9e6, deuterium: 9e6, antimaterie: 9e4, forschungspunkte: 9e4 },
  buildings: { solar: 22, mine: 20, labor: 14, lager: 30, werft: 14 }, research: {}, fleet: { missions: [] },
  colonies: {}, activeBasePlanet: 'home', player: { id: ADMIN, name: 'GameGeeeeek', avatarKey: null },
  xp: 9e5, credits: 5e5, buffs: [], lastTick: Date.now(), colonyNames: {}, modules: { 'panzerung:selten': 2 }, shipModules: {}
}));

const MODULE_ANTWORT = {
  quellen: [
    { quelle: 'konvoi_standort', name: 'Wrackkonvoi - Standort-Modul', modul: 'kv_bergungslogik', hinweis: 'Mal Schadensanteil.', basis: 0.3, aktuell: 0.3, gestellt: false },
    { quelle: 'konvoi_schiff', name: 'Wrackkonvoi - Schiffsmodul', modul: 'kv_bergungspanzer', hinweis: 'Mal Schadensanteil.', basis: 0.3, aktuell: 0.5, gestellt: true }
  ],
  hinweisQuellen: 'Der Server vergibt nur diese Module. Alle uebrigen Fundorte stehen im Frontend-Code.',
  eigene: [{ key: 'eigen_kaperhaken', name: 'Kaperhaken', beschreibung: 'Zieht Frachter heran.', art: 'schiff', wirkung: 'keine' }],
  eigeneMax: 50
};

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
    if (p === 'admin/module/chance'){ z.posts.push({ p, b }); return j({ ok: true, quelle: b.quelle, aktuell: b.wert === null ? 0.3 : b.wert, basis: 0.3, zurueckgesetzt: b.wert === null }); }
    if (p === 'admin/module/eigen'){ z.posts.push({ p, b }); return j({ ok: true, modul: Object.assign({}, b, { wirkung: 'keine' }), ersetzt: false, anzahl: 2 }); }
    if (p === 'admin/module/eigen/loeschen'){ z.posts.push({ p, b }); return j({ ok: true, key: b.key, anzahl: 0 }); }
    if (p === 'admin/module') return z.modulStatus === 500 ? j({ error: 'kaputt' }, 500) : j(MODULE_ANTWORT);
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
function zustand(o){ return Object.assign({ posts: [], modulStatus: 200, dialogAbbrechen: false }, o || {}); }
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
  page.on('dialog', d => { dialoge.push(d.message()); if (z.dialogAbbrechen) d.dismiss(); else d.accept(); });
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
  const da = async sel => { try { return !!(await page.$(sel)); } catch (e) { return false; } };
  return { ctx, page, errs, dialoge, reiterDa, text, da };
}
const post = (z, p) => z.posts.filter(x => x.p === p);

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Die Ableitung ---------------------------------------------------------------------------
  const z1 = zustand();
  const s1 = await seite(browser, z1, { reiter: 'Module' });
  const gemessen = !KERN ? LEER : (() => {
    const f = KERN.modulFundorte();
    const normal = f.filter(x => x.herkunft === 'normal' && x.art === 'standort');
    return {
      gesamt: f.length,
      ohneHerkunft: f.filter(x => !x.herkunft || !x.text).length,
      unerreichbar: f.filter(x => x.unerreichbar).map(x => x.key),
      normalSumme: Math.round(normal.reduce((a, x) => a + (x.anteil || 0), 0) * 1000) / 1000,
      normalTopf: normal.length ? normal[0].topf : 0,
      herkuenfte: Array.from(new Set(f.map(x => x.herkunft))).sort()
    };
  })();
  check('1a: jedes Modul bekommt eine Herkunft mit Text', gemessen.gesamt > 90 && gemessen.ohneHerkunft === 0,
    { module: gemessen.gesamt, ohneHerkunft: gemessen.ohneHerkunft, herkuenfte: gemessen.herkuenfte });
  check('1b: die Anteile EINES Topfes ergeben zusammen 1 (PAAR zu 1a - 1/n ist damit wirklich ein Anteil)',
    gemessen.normalSumme === 1 && gemessen.normalTopf > 1,
    { summe: gemessen.normalSumme, topf: gemessen.normalTopf });
  // Die Kernmessung: ein Modul zur Laufzeit umhaengen. Eine abgeleitete Uebersicht geht mit.
  const abgeleitet = !KERN ? {} : (() => {
    const D = KERN.MODULE_DEFS;
    const d = D.find(x => x.key === 'panzerung');
    const vorher = KERN.modulFundort(d, D, 'standort');
    const alteQuelle = d.quelle;
    d.quelle = KERN.HERKUNFT_ABGRUND;
    const nachher = KERN.modulFundort(d, D, 'standort');
    d.quelle = alteQuelle;
    const wiederher = KERN.modulFundort(d, D, 'standort');
    return { vorher: vorher.herkunft, vorherTopf: vorher.topf, nachher: nachher.herkunft,
      nachherTopf: nachher.topf, wiederher: wiederher.herkunft };
  })();
  check('1c: haengt man ein Modul zur Laufzeit in den Abgrund um, folgt die Uebersicht - sie ist ABGELEITET',
    abgeleitet.vorher === 'normal' && abgeleitet.nachher === 'abgrund'
    && abgeleitet.nachherTopf !== abgeleitet.vorherTopf && abgeleitet.wiederher === 'normal',
    abgeleitet);
  const t1 = await s1.text('#adminModuleInhalt');
  // 1g/1h: Der eigentliche Fund der Durchsicht. Boss-Set-Teile WERDEN gezogen
  // (grantBossSetModule wuerfelt unter den vier Teilen desselben Bosses) - sie als "gezielt
  // vergeben" auszuweisen war fuer ein Fuenftel aller Module falsch. Unikate und Konvoi-Module
  // dagegen werden wirklich benannt vergeben; das ist die Gegenrichtung.
  const gezogen = !KERN ? { boss: [], ohneTopf: [] } : (() => {
    const f = KERN.modulFundorte();
    return {
      boss: f.filter(x => x.herkunft === 'boss'),
      ohneTopf: f.filter(x => x.herkunft === 'unikat' || x.herkunft === 'konvoi')
    };
  })();
  check('1g: jedes Boss-Set-Teil hat einen Anteil aus SEINEM Set - und die Ziehstelle liest dieselbe Funktion',
    gezogen.boss.length >= 8 && gezogen.boss.every(x => x.topf > 1 && x.anteil === 1 / x.topf)
    && /const teile = bosssetTeile\(bossKey\);/.test(JS),
    { teile: gezogen.boss.length, toepfe: Array.from(new Set(gezogen.boss.map(x => x.topf))) });
  check('1h: Unikate und Konvoi-Module haben KEINEN Anteil - die vergibt der Code benannt (PAAR zu 1g)',
    gezogen.ohneTopf.length >= 3 && gezogen.ohneTopf.every(x => x.anteil === null && x.topf === 0),
    { stuecke: gezogen.ohneTopf.map(x => x.key) });
  check('1d: der Reiter zeigt die Zahl der Module und sagt, was der Anteil bedeutet',
    s1.reiterDa && /Module im Spiel/.test(t1) && /ist es mit dieser Wahrscheinlichkeit dieses/.test(t1),
    { reiterDa: s1.reiterDa, auszug: t1.slice(0, 120) });
  check('1e: er nennt die Auffaelligkeit "in keinem Topf" ausdruecklich - auch wenn es keine gibt',
    /Module in keinem Topf und ohne gezielte Quelle/.test(t1)
    && (gemessen.unerreichbar.length === 0 ? /keine/.test(t1) : true),
    { unerreichbar: gemessen.unerreichbar });
  check('1f: keine Seitenfehler', s1.errs.length === 0, s1.errs);

  // ---- 2) Die Regler und die Entwuerfe -------------------------------------------------------------
  check('2c: der Regler steht mit Code-Wert und dem Hinweis des Servers',
    /Der Server vergibt nur diese Module/.test(t1) && /Code-Wert 0,3/.test(t1) && (await s1.da('[data-modul-chance="konvoi_standort"]')),
    { auszug: (t1.match(/Wrackkonvoi[^]{0,80}/) || [''])[0] });
  check('2d: bei einer gestellten Quelle steht der Zurueck-Knopf, bei einer ungestellten nicht (PAAR)',
    (await s1.da('[data-modul-chance-zurueck="konvoi_schiff"]')) && !(await s1.da('[data-modul-chance-zurueck="konvoi_standort"]')));
  await fuellen(s1.page, '[data-modul-chance="konvoi_standort"]', '0.6');
  await klicken(s1.page, '[data-modul-chance-setzen="konvoi_standort"]'); await s1.page.waitForTimeout(800);
  const p2 = post(z1, 'admin/module/chance');
  check('2e: Uebernehmen schickt Quelle und Zahl', p2.length === 1 && p2[0].b.quelle === 'konvoi_standort' && p2[0].b.wert === 0.6, { posts: p2.map(x => x.b) });
  await klicken(s1.page, '[data-modul-chance-zurueck="konvoi_schiff"]'); await s1.page.waitForTimeout(800);
  const p2b = post(z1, 'admin/module/chance');
  check('2f: Zurueck schickt null - nicht den Code-Wert (sonst fröre der Eingriff die Balance ein)',
    p2b.length === 2 && p2b[1].b.wert === null, { zweiter: p2b[1] && p2b[1].b });
  check('3a: ein Entwurf steht mit "ohne Wirkung im Spiel" und der Begruendung dazu',
    /Kaperhaken/.test(t1) && /ohne Wirkung im Spiel/.test(t1) && /wirkt im Spiel nicht/.test(t1) && /eigen_/.test(t1),
    { auszug: (t1.match(/Kaperhaken[^]{0,60}/) || [''])[0] });
  await fuellen(s1.page, '#adminModulKey', 'eigen_zugnetz');
  await fuellen(s1.page, '#adminModulName', 'Zugnetz');
  await fuellen(s1.page, '#adminModulText', 'Zieht Wracks aus dem Feld heran.');
  await klicken(s1.page, '#adminModulAnlegenBtn'); await s1.page.waitForTimeout(800);
  const p3 = post(z1, 'admin/module/eigen');
  check('3c: Anlegen schickt Schluessel, Name, Beschreibung und Art',
    p3.length === 1 && p3[0].b.key === 'eigen_zugnetz' && p3[0].b.name === 'Zugnetz' && p3[0].b.art === 'standort'
    && /Wracks/.test(p3[0].b.beschreibung), { post: p3.map(x => x.b) });
  check('3c2: die Meldung sagt auch beim Anlegen, dass es nicht wirkt',
    (await logZeilen(s1.page)).some(l => /wirkt im Spiel nicht/.test(l)));
  await klicken(s1.page, '[data-modul-eigen-weg="eigen_kaperhaken"]'); await s1.page.waitForTimeout(700);
  check('3d: Entfernen fragt nach und schickt den Schluessel',
    s1.dialoge.length === 1 && post(z1, 'admin/module/eigen/loeschen').length === 1);
  await s1.ctx.close();

  // 3b: Ohne Server bleiben die Fundorte stehen - sie kommen aus dem Code.
  const z3 = zustand({ modulStatus: 500 });
  const s3 = await seite(browser, z3, { reiter: 'Module' });
  const t3 = await s3.text('#adminModuleInhalt');
  check('3b: faellt der Server aus, stehen die Fundorte trotzdem - nur die Regler fehlen (PAAR zu 3a)',
    /Module im Spiel/.test(t3) && /Module in keinem Topf/.test(t3)
    && !(await s3.da('[data-modul-chance="konvoi_standort"]')) && !/Kaperhaken/.test(t3),
    { auszug: t3.slice(0, 90) });
  check('3b2: und der Fehler wird benannt, statt still zu fehlen', /Modul-Verwaltung/.test(t3), { auszug: (t3.match(/Modul-Verwaltung[^]{0,40}/) || [''])[0] });
  await s3.ctx.close();

  // ---- 4) Die Sammlung ------------------------------------------------------------------------------
  const z4 = zustand();
  const s4 = await seite(browser, z4);
  const sam = !KERN ? { modulText: '', modulAlsVerbrauch: 'x', material: 'x', reliquie: 'x' } : (() => {
    const p = KERN.MODULE_DEFS.find(x => x.key === 'panzerung');
    return {
      modulText: KERN.sammlungAnteilText({ art: 'standortmodul', key: 'panzerung', name: p.name }),
      // DERSELBE Schluessel, nur eine andere Katalog-Art: So misst die Gegenrichtung wirklich die
      // Art-Schranke und nicht bloss einen unbekannten Schluessel.
      modulAlsVerbrauch: KERN.sammlungAnteilText({ art: 'verbrauch', key: 'panzerung', name: 'x' }),
      material: KERN.sammlungAnteilText({ art: 'material', key: 'sternenstaub', name: 'x' }),
      reliquie: KERN.sammlungAnteilText({ art: 'reliquie', key: 'irgendwas', name: 'x' })
    };
  })();
  check('2a: die Sammlung nennt bei einem Modul den Anteil und die Topfgroesse',
    /Fällt dabei ein Modul, ist es zu [0-9,]+ % dieses \([0-9.]+ im Topf\)/.test(sam.modulText), { text: sam.modulText });
  check('2b: bei Verbrauch, Material und Reliquie steht KEIN Anteil - dort waere 1/n falsch (PAAR zu 2a)',
    sam.modulAlsVerbrauch === '' && sam.material === '' && sam.reliquie === '',
    { verbrauch: sam.modulAlsVerbrauch, material: sam.material, reliquie: sam.reliquie });
  // Und die Verdrahtung: Der Satz muss auch WIRKLICH in der Sammlung stehen. Eine reine
  // Funktionspruefung waere gruen geblieben, haette ihn niemand an die Herkunftszeile gehaengt.
  await s4.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="sammlung"]'); if (x) x.click(); });
  await s4.page.waitForTimeout(900);
  const box = await s4.text('#sammlungBox');
  check('2a2: der Satz steht wirklich in der Sammlung, an derselben Zeile wie die Herkunft',
    /Fällt dabei ein Modul, ist es zu [0-9,]+ % dieses \([0-9.]+ im Topf\)/.test(box),
    { auszug: (box.match(/Fällt dabei ein Modul[^]{0,60}/) || [''])[0], laenge: box.length });
  check('4c: keine Seitenfehler', s4.errs.length === 0, s4.errs);
  await s4.ctx.close();

  await browser.close();
  console.log(fail ? 'FAIL - es gab rote Pruefungen.' : 'Alles gruen.');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL - Testlauf abgebrochen: ' + (e && e.stack || e)); process.exit(1); });
