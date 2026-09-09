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
//   2c     Vierstellige Zahlen stehen GENAU da. `fmt` macht aus 1234 ein „1.2k" - fuer eine
//          Kennzahl, deren ganzer Zweck die genaue Zahl ist, waere das die Zahl kaputtgemacht.
//          Heute hat das Spiel 14 Konten; ohne diese Pruefung faellt es erst bei 1000 auf.
//   4a     DIE SCHWELLE IST EINE KOPIE-FAMILIE. Dieselbe Zahl heisst im Backend
//          REMINDER_ONLINE_THRESHOLD_MS und entscheidet ueber die Gesamtzahl; im Spiel heisst sie
//          ONLINE_THRESHOLD_MS und entscheidet ueber die gruenen Punkte in Bestenliste und
//          Freundesliste. Bis zum 09.09.2026 standen dort 90 und hier 120 Sekunden, beide gegen
//          DENSELBEN lastSeen-Zeitstempel - wer vor 100 Sekunden gespeichert hatte, zaehlte oben
//          mit und hatte daneben keinen Punkt. Beide Quelltexte werden gelesen, nicht getippt.
//   4b     EINE VERALTETE ZAHL WIRD VERSTECKT. Am Quelltext gemessen: Ein Testlauf muesste sonst
//          ueber die Verfallsfrist hinweg warten. Der Beleg ist, dass der Anzeigepfad gegen den
//          Zeitpunkt der letzten ANTWORT prueft und nicht gegen den des letzten VERSUCHS.
//   5a     KEINE SEITENFEHLER. Alle Pruefungen oben messen DOM-Zustaende; ein ReferenceError im
//          neuen Code liefe still durch und liesse sie gruen.
//
// GEGENPROBEN (KEPLER_SPIELDATEI auf eine praeparierte Kopie):
//   =alt        der Stand vor dem Abzeichen. Dort fallen 1a, 2a, 2b, 3a, 3b. 1b und 1c bleiben
//               gruen - ohne Abzeichen ist nichts zu sehen, und das ist genau ihre Aussage; sie
//               sind die zweite Haelfte der Paare, nicht der Beleg.
//   =ohnekonto  das Abzeichen ohne die Betreiber-Schranke. Dort faellt 1b.
//   =ohneabstand  das Abzeichen ohne den 30-Sekunden-Abstand. Dort faellt 3a.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, SERVER_JS, starteBrowser, ruhigeUhren, logMitschnitt, versionAbfangen } = require('./lib/umgebung');
let fail = false;
const ergebnis = {};
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };
const SAB = process.env.KEPLER_SPIELERZAHL_GEGENPROBE || '';
/* Alle Listen sind GEMESSEN, nicht gedacht; die Pruefung unten belegt beide Richtungen. */
const MUSS_FALLEN = {
  // 1b bleibt gruen: ohne Abzeichen ist nichts zu sehen und nichts zu holen - das ist genau seine
  // Aussage, nicht ein Beleg fuer das Abzeichen. 1c faellt dagegen mit, weil es seit dieser Runde
  // auch verlangt, dass ueberhaupt GEFRAGT wurde. 4a faellt, weil am alten Stand 90 Sekunden gegen
  // die 120 des Servers standen - genau der Befund, der diese Pruefung ausgeloest hat.
  alt:         ['1a', '1c', '2a', '2b', '2c', '3a', '3b', '4a', '4b'],
  ohnekonto:   ['1b'],
  ohneabstand: ['3a'],
  ohnealter:   ['4b'],
  schwelle:    ['4a']
};

const JS = fs.readFileSync(process.env.KEPLER_SPIELDATEI || SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
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
  // Ohne das Abfangen erzeugt der 15-Sekunden-Versionscheck unter file:// einen CORS-Fehler, und
  // 5a faellt an einer Kante statt an einem echten Fehler (siehe lib/umgebung.js).
  await versionAbfangen(page);
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
     vorsorgliche `if (typeof render === 'function')` uebersprang stillschweigend alles.
     DER ZWEITE ENTWURF mass nur „der Zaehler steigt in 8 s nicht" - und das ist genauso wahr,
     wenn im Fenster GAR NICHT neu gezeichnet wird. Der Beleg dafuer lag nur in der Gegenprobe,
     die im Prueflauf nicht laeuft; ein kuenftiges Gatter um `render()` haette die Pruefung still
     aus dem falschen Grund gruen gemacht. Deshalb belegt sie jetzt BEIDE Haelften im selben Lauf:
     in den ersten 8 s kein Zuwachs (der Riegel greift), nach 35 s genau einer (das Spiel zeichnet
     nachweislich weiter, und der Riegel laeuft ab). */
  const vorher = s1.z.rufe;
  await s1.page.waitForTimeout(8000);
  const kurz = s1.z.rufe;
  await s1.page.waitForTimeout(27000);
  const lang = s1.z.rufe;
  merke('3a: der Riegel haelt 30 s - und danach fragt das laufende Spiel wieder nach',
    vorher > 0 && kurz === vorher && lang > kurz,
    { vorher, nach8s: kurz, nach35s: lang, abstandMs: 30000 });
  const fehlerS1 = s1.errs.slice();
  await s1.ctx.close();

  /* Mitgemessen wird, ob ueberhaupt GEFRAGT wurde. Ohne das waere 1b auch dann gruen, wenn jedes
     gewoehnliche Konto die Admin-Route sekuendlich anfragte und nur die Antwort verwuerfe - 403-
     Laerm in jedem Serverprotokoll. Und 1c waere nicht davon zu unterscheiden, dass die Anfrage
     nie gestellt wurde. */
  const s2 = await seite(browser, zustand({ name: 'anna' }));
  const a2 = await abzeichen(s2.page);
  merke('1b: ein gewoehnliches Konto sieht sie nicht und fragt sie gar nicht erst ab',
    !a2.sichtbar && s2.z.rufe === 0, Object.assign({ rufe: s2.z.rufe }, a2));
  await s2.ctx.close();

  const s3 = await seite(browser, zustand({ spielerzahlStatus: 403 }));
  const a3 = await abzeichen(s3.page);
  merke('1c: antwortet der Server mit 403, bleibt das Abzeichen weg - ohne Platzhalter',
    !a3.sichtbar && s3.z.rufe > 0, Object.assign({ rufe: s3.z.rufe }, a3));
  await s3.ctx.close();

  // ---- 2) Die Zahlen stammen aus der Antwort ---------------------------------------------------
  const s4 = await seite(browser, zustand({ online: 7, registriert: 21 }));
  const a4 = await abzeichen(s4.page);
  merke('2a: die Zahlen kommen aus der Antwort, nicht aus dem Spielstand',
    a1.text !== a4.text && /3/.test(a1.text) && /14/.test(a1.text) && /7/.test(a4.text) && /21/.test(a4.text),
    { erst: a1.text, dann: a4.text });
  await s4.ctx.close();

  const s5 = await seite(browser, zustand({ online: 812, registriert: 1234 }));
  const a5 = await abzeichen(s5.page);
  merke('2c: vierstellige Zahlen stehen genau da, nicht als „1.2k"',
    a5.text.indexOf('1234') >= 0 && a5.text.indexOf('k') < 0, { text: a5.text });
  const fehlerS5 = s5.errs.slice();
  await s5.ctx.close();

  // ---- 4) Die Schwelle und das Alter --------------------------------------------------------
  /* 4a liest BEIDE Quelltexte. Getippte Zahlen waeren hier wertlos: Genau dass zwei Stellen
     dieselbe Groesse verschieden gross annehmen, ist der Befund, den diese Pruefung verhindert. */
  const feSchwelle = (JS.match(/const ONLINE_THRESHOLD_MS = (\d+);/) || [])[1];
  if (SERVER_JS){
    const beQuelle = fs.readFileSync(SERVER_JS, 'utf8');
    const beRoh = (beQuelle.match(/const REMINDER_ONLINE_THRESHOLD_MS = ([^;]+);/) || [])[1];
    let beSchwelle = null;
    try { beSchwelle = beRoh ? Function('return (' + beRoh + ');')() : null; } catch(e){}
    merke('4a: die Online-Schwelle im Spiel ist dieselbe wie die des Servers',
      !!feSchwelle && beSchwelle !== null && Number(feSchwelle) === beSchwelle,
      { spiel: feSchwelle, server: beSchwelle, serverRoh: beRoh });
  } else {
    // Ohne Nachbar-Repo (etwa in einem worktree) waere jede Aussage erfunden. Gemessen wird dann
    // wenigstens, dass die Konstante ueberhaupt noch existiert - sonst faende 4a spaeter nichts
    // mehr und bliebe still gruen.
    merke('4a: die Online-Schwelle im Spiel ist dieselbe wie die des Servers',
      !!feSchwelle, { spiel: feSchwelle, server: 'Backend-Repo liegt hier nicht daneben' });
  }

  /* 4b am Quelltext: Ein Lauf muesste sonst ueber die Verfallsfrist hinweg warten. Der Beleg ist,
     dass der Anzeigepfad gegen den Zeitpunkt der letzten ANTWORT prueft (`spielerzahlErfolg`) und
     nicht gegen den des letzten VERSUCHS - und dass dieser Zeitpunkt nur im Erfolgsfall gesetzt
     wird. Beide Anker werden vorher auf Existenz geprueft. */
  const vonZeige = JS.indexOf('function zeigeSpielerzahl(');
  const bisZeige = vonZeige >= 0 ? JS.indexOf('async function ', vonZeige) : -1;
  const zeigeRumpf = (vonZeige >= 0 && bisZeige > vonZeige) ? JS.slice(vonZeige, bisZeige) : '';
  const vonHole = JS.indexOf('async function holeSpielerzahl(');
  const bisHole = vonHole >= 0 ? JS.indexOf('function zeigeSpielerzahl(', vonHole) : -1;
  const holeRumpf = (vonHole >= 0 && bisHole > vonHole) ? JS.slice(vonHole, bisHole) : '';
  merke('4b: eine veraltete Zahl wird versteckt statt als aktuelle gezeigt',
    zeigeRumpf.length > 0 && holeRumpf.length > 0
      && /Date\.now\(\) - spielerzahlErfolg > SPIELERZAHL_ALTER_MAX_MS/.test(zeigeRumpf)
      && /spielerzahlErfolg = Date\.now\(\);/.test(holeRumpf)
      // im Erfolgszweig, nicht im finally - dort steht nur der Versuchs-Zeitpunkt
      && !/finally[\s\S]*spielerzahlErfolg = Date\.now\(\)/.test(holeRumpf),
    { zeigeDa: zeigeRumpf.length > 0, holeDa: holeRumpf.length > 0 });

  // ---- 5) Nichts ist still kaputtgegangen ---------------------------------------------------
  const alleFehler = fehlerS1.concat(fehlerS5);
  merke('5a: keine Seitenfehler waehrend der Messungen',
    alleFehler.length === 0, { fehler: alleFehler.slice(0, 3) });

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
