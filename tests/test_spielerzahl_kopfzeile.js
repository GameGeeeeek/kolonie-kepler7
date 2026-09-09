// Spielerzahl in der Kopfzeile - NUR beim Betreiberkonto (Wunsch Sascha, 09.09.2026, mit
// Screenshot der Kennzahlenreihe): "wieviele online von wieviel registrierten".
//
//   node tests/test_spielerzahl_kopfzeile.js
//
// WAS HIER WIRKLICH GEPRUEFT WIRD, und warum in Paaren: Eine Anzeige, die immer dasteht, besteht
// jede Einzelpruefung auf Sichtbarkeit; eine, die nie dasteht, jede auf Unsichtbarkeit. Erst das
// Paar sagt etwas aus.
//   1a/1b  Das Betreiberkonto sieht das Abzeichen UND ein gewoehnliches Konto sieht es nicht -
//          obwohl die Attrappe ihm dieselben Zahlen hinlegen wuerde. Die Schranke ist also das
//          Konto und nicht die Antwort.
//   1c     Antwortet der Server mit 403 (der Fall am ECHTEN Server, wo die Sperre steht), bleibt
//          das Abzeichen weg. Kein Platzhalter, keine Null - eine Zahl, die niemand geliefert hat,
//          waere eine Behauptung.
//   2a     Die Zahlen kommen aus der Antwort, nicht aus dem Spielstand: Zwei Laeufe mit
//          verschiedenen Antworten muessen verschiedene Zahlen zeigen. Ein fest verdrahtetes
//          "0 / 0" bestuende sonst 1a.
//   2b     Die Online-Schwelle im Hinweistext kommt vom Server (`schwelleMs`), nicht getippt.
//          Gemessen mit 5 Minuten statt der zwei des Servers - eine getippte Zahl faellt damit auf.
//   3a     Die Route wird NICHT bei jedem Bildaufbau gerufen. Gemessen: Anfragen zaehlen, viele
//          render()-Durchgaenge erzwingen, wieder zaehlen. `render()` laeuft oft; ohne Abstand
//          waere das ein Dauerfeuer auf eine Zahl, die sich im Minutentakt aendert.
//   3b     Das Abzeichen steht in DERSELBEN Reihe wie Level und Punktestand (.hero-stats), nicht
//          in einem eigenen Kasten daneben - das ist der Wunsch aus dem Screenshot.
//
// GEGENPROBEN (KEPLER_SPIELDATEI auf eine praeparierte Kopie):
//   =alt        der Stand vor dem Abzeichen. Dort fallen 1a, 2a, 2b, 3a, 3b. 1b und 1c bleiben
//               gruen - ohne Abzeichen ist nichts zu sehen, und das ist genau ihre Aussage; sie
//               sind die zweite Haelfte der Paare, nicht der Beleg.
//   =ohnekonto  das Abzeichen ohne die Betreiber-Schranke. Dort faellt 1b.
//   =ohneabstand  das Abzeichen ohne den 30-Sekunden-Abstand. Dort faellt 3a.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, ruhigeUhren, logMitschnitt } = require('./lib/umgebung');
let fail = false;
const ergebnis = {};
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };
const SAB = process.env.KEPLER_SPIELERZAHL_GEGENPROBE || '';
const MUSS_FALLEN = {
  alt:         ['1a', '2a', '2b', '3a', '3b'],
  ohnekonto:   ['1b'],
  ohneabstand: ['3a']
};

const HTML = fs.readFileSync(process.env.KEPLER_SPIELDATEI || SPIELDATEI, 'utf8');
const SAVE_KEY = 'kepler7-save-v3';
const KONTO_ID = 'u-chef';
const JETZT = Date.now();

const save = () => JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9e6, erz: 5000, kristalle: 9e6, deuterium: 9e6, antimaterie: 9e4, forschungspunkte: 9e4 },
  buildings: { solar: 22, mine: 20, labor: 14, lager: 30, werft: 14 }, research: {}, fleet: { missions: [] },
  colonies: {}, activeBasePlanet: 'home', player: { id: KONTO_ID, name: 'GameGeeeeek', avatarKey: null },
  xp: 9e5, credits: 5e5, buffs: [], lastTick: Date.now(), colonyNames: {}, modules: {}, shipModules: {}
}));

/* Die Attrappe legt die Spielerzahl JEDEM Konto hin, solange `z.spielerzahlStatus` nichts anderes
   sagt. Das ist Absicht: Waere sie hier schon an den Namen gebunden, pruefte 1b die Attrappe statt
   das Spiel. Am echten Server steht die Sperre trotzdem (403, siehe das Backend-Repo). */
function backend(store, z){
  return async r => {
    const req = r.request(); const u = req.url(); const p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
    if (p === 'health') return j({ ok: true });
    if (p === 'login') return j({ token: 'tok', userId: KONTO_ID, username: z.name });
    if (p === 'me') return j({ userId: KONTO_ID, username: z.name, isAdmin: z.name.toLowerCase() === 'gamegeeeeek', homeSystem: 'kepler', homeSlot: 0,
      attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true, supporter: { active: false, tier: null, exempt: false, granted: false, until: 0 } });
    if (p === 'admin/spielerzahl'){
      z.rufe++;
      if (z.spielerzahlStatus === 403) return j({ error: 'Kein Admin-Zugriff.' }, 403);
      return j({ online: z.online, registriert: z.registriert, schwelleMs: z.schwelleMs });
    }
    if (p === 'admin/reports') return j({ reports: [] });
    if (p.startsWith('admin/')) return j({});
    if (p === 'pending-rewards/claim') return j({ reward: null });
    if (p === 'notifications') return j({ notifications: [] });
    if (p === 'reports') return j({ reports: [] });
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
function zustand(o){
  return Object.assign({ name: 'GameGeeeeek', online: 3, registriert: 14, schwelleMs: 300000,
    spielerzahlStatus: 200, rufe: 0 }, o || {});
}
const overlaysWeg = () => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
  .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });

async function seite(browser, z){
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message || e)));
  const store = { [SAVE_KEY]: save() };
  await page.route('**/api/**', backend(store, z));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await logMitschnitt(page);
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(overlaysWeg);
  return { ctx, page, errs, z };
}
/* Sichtbar heisst: im Baum UND nicht ausgeblendet. `textContent` allein waere gruen, sobald das
   Abzeichen mit display:none dasteht - genau der Zustand, den 1b und 1c verbieten. */
const abzeichen = page => page.evaluate(() => {
  const el = document.getElementById('heroOnlineChip');
  if (!el) return { da: false, sichtbar: false, text: '', titel: '', inReihe: false };
  const st = getComputedStyle(el);
  return {
    da: true,
    sichtbar: st.display !== 'none' && st.visibility !== 'hidden' && el.offsetParent !== null,
    text: ((document.getElementById('heroOnline') || {}).textContent || '').trim(),
    titel: el.getAttribute('title') || '',
    inReihe: !!(el.closest('.hero-stats')),
    icon: !!el.querySelector('i.ti.ti-users')
  };
});

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Wer es sieht und wer nicht ----------------------------------------------------------
  const s1 = await seite(browser, zustand());
  const a1 = await abzeichen(s1.page);
  merke('1a: das Betreiberkonto sieht die Spielerzahl in der Kopfzeile',
    a1.sichtbar && a1.text.length > 0, a1);
  merke('3b: das Abzeichen steht in derselben Reihe wie die anderen Kennzahlen',
    a1.inReihe && a1.icon, { inReihe: a1.inReihe, icon: a1.icon });
  merke('2b: die Online-Schwelle im Hinweis kommt vom Server, nicht aus dem Spiel',
    /5\s*Minuten/.test(a1.titel), { titel: a1.titel.slice(0, 120) });

  /* 3a misst an der LAUFENDEN UHR, nicht ueber erzwungene Aufrufe. Der erste Entwurf rief
     `render()` 25-mal aus dem Seitenkontext - und mass damit nichts: Das ganze Spiel liegt in
     einer Kapsel (`(function(){` ab Zeile 4487), `render` ist von aussen nicht erreichbar, das
     vorsorgliche `if (typeof render === 'function')` uebersprang stillschweigend alles. Die
     Pruefung war an BEIDEN Staenden gruen - gemeldet hat das die Gegenprobe, nicht der Lauf.
     Jetzt zeichnet das Spiel im Messfenster von selbst neu; gezaehlt werden die Abfragen, die
     dabei zusaetzlich anfallen. Dass in diesem Fenster ueberhaupt neu gezeichnet wird, belegt die
     Gegenprobe `ohneabstand`: dort steigt der Zaehler. */
  const vorher = s1.z.rufe;
  await s1.page.waitForTimeout(8000);
  const nachher = s1.z.rufe;
  merke('3a: das laufende Spiel fragt die Zahl nicht bei jedem Bildaufbau nach',
    vorher > 0 && nachher === vorher, { vorher, nachher, fensterMs: 8000 });
  await s1.ctx.close();

  const s2 = await seite(browser, zustand({ name: 'anna' }));
  const a2 = await abzeichen(s2.page);
  merke('1b: ein gewoehnliches Konto sieht sie nicht, obwohl der Server antworten wuerde',
    !a2.sichtbar, a2);
  await s2.ctx.close();

  const s3 = await seite(browser, zustand({ spielerzahlStatus: 403 }));
  const a3 = await abzeichen(s3.page);
  merke('1c: antwortet der Server mit 403, bleibt das Abzeichen weg - ohne Platzhalter',
    !a3.sichtbar, a3);
  await s3.ctx.close();

  // ---- 2) Die Zahlen stammen aus der Antwort ---------------------------------------------------
  const s4 = await seite(browser, zustand({ online: 7, registriert: 21 }));
  const a4 = await abzeichen(s4.page);
  merke('2a: die Zahlen kommen aus der Antwort, nicht aus dem Spielstand',
    a1.text !== a4.text && /3/.test(a1.text) && /14/.test(a1.text) && /7/.test(a4.text) && /21/.test(a4.text),
    { erst: a1.text, dann: a4.text });
  await s4.ctx.close();

  await browser.close();

  /* Beide Richtungen: dass jede genannte Pruefung faellt UND dass keine ungenannte mitfaellt.
     Die einseitige Form belegt nur die erste Haelfte - und genau daran ist in diesem Auftrag
     schon einmal ein zusaetzliches Rot unbemerkt geblieben (test_abgrund_stroemung, `3a`). */
  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false);
    const fehlend = soll.filter(n => ergebnis[n] !== false);
    const unerwartet = gefallen.filter(n => soll.indexOf(n) < 0);
    console.log('GEGENPROBE ' + SAB + ': ' + (soll.length - fehlend.length) + '/' + soll.length + ' gefallen (' +
      soll.map(n => n + '=' + (ergebnis[n] === false ? 'rot' : 'gruen')).join(' ') + ')' +
      (unerwartet.length ? ' | ZUSAETZLICH rot: ' + unerwartet.join(', ') : ''));
    if (fehlend.length || unerwartet.length){
      if (fehlend.length) console.log('FAIL - Gegenprobe unvollstaendig: ' + fehlend.join(', ') + ' blieben gruen');
      if (unerwartet.length) console.log('FAIL - Gegenprobe ueberzaehlig: ' + unerwartet.join(', ') + ' fielen, stehen aber nicht in MUSS_FALLEN');
      process.exit(1);
    }
    process.exit(0);
  }
  console.log(fail ? 'FAIL' : 'PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEHLER: ' + (e && e.stack || e)); process.exit(1); });
