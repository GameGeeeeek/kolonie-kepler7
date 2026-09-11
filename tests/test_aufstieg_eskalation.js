// Eskalierender Aufstieg + Aufstiegs-Chronik (Feature F, 11.09.2026).
//
// WAS SICH GEAENDERT HAT: Bis v8.715.0 verlangte JEDER Aufstieg dieselbe feste Schwelle -
// ASCENSION_MIN_PRESTIGE = 3 und ASCENSION_MIN_SCORE = 50000 -, und sechs Anzeigestellen nannten
// diese Zahlen (Knopf, Meldung, Vorbote, Hilfe, Reiter-Kurztext, Kommentar). Jetzt liefern zwei
// Funktionen die Voraussetzung fuer den NAECHSTEN Aufstieg aus der Zahl der vollzogenen:
//   ascensionMinPrestige() = 3 + floor(count/3)
//   ascensionMinScore()    = round(50000 * 1.6^min(count, 10))
// Dazu die Aufstiegs-Chronik in state.ascension.chronik (Nr., Zeit, Punkte und Prestige VOR dem
// Reset, Essenz, gewaehlter Pfad), aufklappbar im Aufstiegs-Abschnitt, gedeckelt auf 50 Eintraege.
//
// DREI DINGE, DIE DIESER TEST ABSICHERT:
//  1) Die Konstanten sind nur noch GRUNDWERTE. Wer sie irgendwo als Voraussetzung anzeigt oder
//     prueft, statt die zwei Funktionen zu lesen, zeigt nach dem dritten Aufstieg eine Zahl, die der
//     Knopf nicht mehr kennt - genau die zweite Anzeigestelle mit der alten Annahme (Abschnitt 0).
//  2) Die FORMEL, nicht eine Momentaufnahme: ausgefuehrt gegen count 0/3/6/10/15, Deckel und
//     Monotonie (Abschnitt 1).
//  3) Im Browser: Ein Konto mit drei Aufstiegen und Prestige 3 darf NICHT mehr aufsteigen (alter
//     Stand: Knopf frei); ein Aufstieg schreibt genau einen Chronik-Eintrag mit richtiger Nummer,
//     Punkten und Prestige vor dem Reset; ein Spielstand OHNE das Feld wird zur leeren Liste
//     (Migration); der Deckel behaelt die letzten 50 (Abschnitte 2-4).
//
// GEGENPROBE (gemessen am 11.09.2026 gegen `git show HEAD:weltraum_kolonie.html`, v8.715.0, per
// KEPLER_SPIELDATEI): am alten Stand fallen 0a, 0b, 0c, 0d, 0e, 0f, 0g, 1-bau (1a-1f laufen dann
// gar nicht), 2a, 2b, 2d, 2e, 2e2, 2f, 2g, 3a, 3b, 3c, 4a, 4b, 4c, 5-vor, 5a - 24 Pruefungen. Der
// Kern der Gegenprobe ist 3a/3c: Am alten Stand steigt ein Konto mit drei Aufstiegen und Prestige 3
// weiterhin auf. Am neuen Stand alles gruen (38 Pruefungen).
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer, ruhigeUhren, versionAbfangen, warteBis } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';

function fnAus(n){
  const m = JS.match(new RegExp('function\\s+'+n+'\\s*\\('));
  if (!m) return null;
  const i = JS.indexOf(m[0]);
  let d = 0, s = JS.indexOf('{', i + m[0].length), k = s;
  for (; k < JS.length; k++){ if (JS[k]==='{') d++; else if (JS[k]==='}'){ d--; if(!d) break; } }
  return JS.slice(i, k+1);
}

// ---------------------------------------------------------------- 0) Quelltext: Anzeigestellen
const fnPrestige = fnAus('ascensionMinPrestige');
const fnScore = fnAus('ascensionMinScore');
check('0a: beide Schwellen-Funktionen existieren', !!fnPrestige && !!fnScore,
  { prestige: !!fnPrestige, score: !!fnScore });
const canAscend = fnAus('canAscend') || '';
check('0b: canAscend() liest die Funktionen, nicht die Konstanten',
  /ascensionMinPrestige\(\)/.test(canAscend) && /ascensionMinScore\(\)/.test(canAscend)
  && !/ASCENSION_MIN_PRESTIGE|ASCENSION_MIN_SCORE/.test(canAscend), canAscend.slice(0, 160));

/* 0c: DIE REGEL. Jede Zeile, die eine der beiden Konstanten liest, ist entweder ihre Deklaration,
   ein Kommentar, eine Zeile der zwei Funktionen - oder sie sagt dazu, dass es der ERSTE Aufstieg
   ist ("beim ersten Mal"). Alles andere ist eine Anzeigestelle mit der alten festen Schwelle. */
{
  const koerper = (fnPrestige || '') + '\n' + (fnScore || '');
  const verstoesse = JS.split('\n').filter(z => /ASCENSION_MIN_PRESTIGE|ASCENSION_MIN_SCORE/.test(z))
    .filter(z => !/^\s*\/\//.test(z))
    .filter(z => !/^\s*const ASCENSION_MIN_(PRESTIGE|SCORE) = \d+;/.test(z))
    .filter(z => koerper.indexOf(z.trim()) < 0)
    .filter(z => !/beim ersten Mal/.test(z));
  check('0c: keine Stelle liest die Konstanten als LEBENDE Schwelle - nur als Grundwert "beim ersten Mal"',
    verstoesse.length === 0, verstoesse.map(z => z.trim().slice(0, 100)));
}

/* 0d: Kein Live-Text nennt "50.000 Punkten" oder "Prestige 3 und" als feste Zahl. Der
   PATCHNOTES-Block ist Historie und bleibt aussen vor - beide Anker werden geprueft, sonst waere
   der Slice bei fehlendem Anker vacuous (Skill neuer-test). `lastIndexOf` fuer das Ende ist
   falsch: das naechste "\n  ];" NACH dem Start schliesst den Block. */
{
  const von = JS.search(/\n  const PATCHNOTES = \[/);
  const bis = von < 0 ? -1 : JS.indexOf('\n  ];', von);
  check('0d-anker: der PATCHNOTES-Block ist abgegrenzt', von > 0 && bis > von, { von, bis });
  const live = von > 0 && bis > von ? JS.slice(0, von) + JS.slice(bis + 5) : '';
  const treffer = (live.match(/.{0,50}(50\.000 Punkten|Prestige 3 und|Prestige-Stufe 3\b).{0,30}/g) || []);
  check('0d: kein Live-Text nennt die alte Schwelle als feste Zahl', live.length > 0 && treffer.length === 0, treffer);
}

// 0e: Der Chronik-Eintrag entsteht in ascendWithPath, und Punkte/Prestige werden VOR dem Reset
//     gelesen - eine Zeile nach `state = {` stuenden beide auf null.
{
  const auf = fnAus('ascendWithPath') || '';
  const lesen = auf.indexOf('punkteVorher = computeScore()');
  const reset = auf.indexOf('state = {');
  const eintrag = auf.indexOf('asc.chronik = ');
  check('0e: ascendWithPath liest Punkte/Prestige VOR dem Reset und haengt den Eintrag an',
    lesen > 0 && reset > lesen && eintrag > lesen && eintrag < reset
    && /nr: asc\.count/.test(auf) && /gerettet: pfad\.key/.test(auf) && /slice\(-ASCENSION_CHRONIK_MAX\)/.test(auf),
    { lesen, eintrag, reset });
}
// 0f: Migration in applyStateDefaults - fehlendes Feld wird zur leeren Liste, nie zu undefined.
{
  const asd = fnAus('applyStateDefaults') || '';
  check('0f: applyStateDefaults legt eine fehlende Chronik als leere Liste an',
    /if \(!Array\.isArray\(state\.ascension\.chronik\)\) state\.ascension\.chronik = \[\];/.test(asd));
}
// 0g: Die Liste ist ein <details> MIT data-keep-open - setBoxHtml schreibt die Box bei jeder
//     Signatur-Aenderung neu, ein <details> ohne Schluessel klappte nach einer Sekunde zu.
check('0g: die Aufstiegs-Chronik ist aufklappbar und ueberlebt die Neuzeichnung (data-keep-open)',
  /<details data-keep-open="ascensionChronik"\$\{detailsOpenAttr\('ascensionChronik'\)\}/.test(JS)
  && /Aufstiegs-Chronik · \$\{chronikListe\.length\}/.test(JS));

// ---------------------------------------------------------------- 1) Die Formel, ausgefuehrt
const konst = (JS.match(/^  const ASCENSION_(?:MIN_PRESTIGE|MIN_SCORE|PRESTIGE_JE|ESKALATION_FAKTOR|ESKALATION_DECKEL) = [\d.]+;$/gm) || []).join('\n');
let F = null, bauFehler = null;
try {
  F = new Function('state', konst + '\n' + (fnPrestige||'') + '\n' + (fnScore||'')
    + '\nreturn { p: ascensionMinPrestige(), s: ascensionMinScore(), MP: ASCENSION_MIN_PRESTIGE, MS: ASCENSION_MIN_SCORE };');
  F({ ascension: { count: 0 } });
} catch (e) { F = null; bauFehler = String(e && e.message || e); }
check('1-bau: die zwei Funktionen laufen mit ihren Konstanten', !!F, { fehler: bauFehler, konstanten: konst.split('\n').length });
if (F) {
  const bei = c => F(c === null ? {} : { ascension: { count: c } });
  const soll = c => ({ p: 3 + Math.floor(c/3), s: Math.round(50000 * Math.pow(1.6, Math.min(c, 10))) });
  const g = bei(0);
  check('1a: count 0 = die Grundwerte, und die Grundwerte sind die Konstanten',
    g.p === g.MP && g.s === g.MS && g.p === 3 && g.s === 50000, g);
  check('1b: ohne ascension-Objekt dasselbe wie count 0 (kein Absturz auf einem frischen Konto)',
    bei(null).p === g.p && bei(null).s === g.s, bei(null));
  const faelle = [0, 3, 6, 10, 15].map(c => ({ c, ist: { p: bei(c).p, s: bei(c).s }, soll: soll(c) }));
  check('1c: Spec-Formel gegen count 0/3/6/10/15 - 3+floor(count/3) und round(50000*1.6^min(count,10))',
    faelle.every(f => f.ist.p === f.soll.p && f.ist.s === f.soll.s), faelle);
  check('1d: konkrete Zahlen - der vierte Aufstieg verlangt Prestige 4 und 204.800, der elfte rund 5,5 Mio',
    bei(3).p === 4 && bei(3).s === 204800 && bei(10).s === 5497558 && bei(6).s === 838861, { c3: bei(3), c6: bei(6), c10: bei(10) });
  check('1e: der Punkte-Deckel greift beim zehnten - count 15 verlangt nicht mehr Punkte als count 10, aber mehr Prestige',
    bei(15).s === bei(10).s && bei(15).p === 8 && bei(15).p > bei(10).p, { c10: bei(10), c15: bei(15) });
  let monoton = true;
  for (let c = 0; c < 25; c++){ const a = bei(c), b = bei(c+1); if (b.p < a.p || b.s < a.s) monoton = false; }
  check('1f: nie faellt eine Schwelle von einem Aufstieg zum naechsten', monoton);
}

// ---------------------------------------------------------------- Browser-Attrappe
function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications:[] });
    if (p === 'reports') return req.method() === 'POST' ? j({ ok:true }) : j({ reports: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends/.test(p)) return j([]);
    return j({});
  };
}
async function tab(browser, save){
  const store = {};
  if (save) store[SAVE_KEY] = save;
  const ctx = await browser.newContext({ viewport:{ width:1100, height:1600 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message || e)));
  const dialoge = []; page.on('dialog', d => { dialoge.push(d.message().slice(0, 60)); d.accept(); });
  await page.route('**/api/**', backend(store));
  await versionAbfangen(page);
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
    'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  return { ctx, page, errs, dialoge, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
// Alles, was der Aufstiegs-Abschnitt gerade zeigt - gescopt auf #ascensionBox (Skill neuer-test).
const boxLesen = t => t.page.evaluate(() => {
  const box = document.getElementById('ascensionBox');
  const btn = box ? box.querySelector('#doAscensionBtn') : null;
  const sum = box ? box.querySelector('details[data-keep-open="ascensionChronik"] summary') : null;
  const zeilen = box ? [...box.querySelectorAll('details[data-keep-open="ascensionChronik"] .card-row')].map(z => (z.textContent||'').replace(/\s+/g,' ').trim()) : [];
  return { text: box ? (box.textContent||'').replace(/\s+/g,' ').trim() : null,
           knopf: btn ? { disabled: btn.disabled, text: (btn.textContent||'').trim() } : null,
           chronik: sum ? (sum.textContent||'').replace(/\s+/g,' ').trim() : null, zeilen };
});
/* Der EXAKTE Punktestand vor dem Aufstieg. `state` ist von aussen unerreichbar (Hausregel 47) und
   #scoreTotalValue zeigt fmt() - "61.5k" -, also nicht die Zahl, die in die Chronik geht. Genau
   liefert ihn der Bestenlisten-Eintrag, den save() alle 10 s per storageSet('leaderboard:<id>')
   mit `score: computeScore()` schreibt: gemessen aus demselben Rechenweg, nicht eingetippt. */
async function punkteAusStore(t, id){
  const roh = await warteBis(() => t.store['leaderboard:'+id] || null, 14000, 250);
  try { return JSON.parse(roh).score; } catch (e) { return null; }
}
const zuFortschritt = async t => {
  await t.page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="fortschritt"]'); if (b) b.click(); });
  await t.page.waitForTimeout(1200);
};
// Aufsteigen ueber die Bedienung: Knopf -> Pfadwahl im Overlay -> zwei Sicherheitsabfragen (accept).
async function aufsteigen(t, pfad){
  await t.page.evaluate(() => { const b = document.getElementById('doAscensionBtn'); if (b) b.click(); });
  await t.page.waitForTimeout(300);
  const gedrueckt = await t.page.evaluate(p => {
    const b = document.querySelector('#ascensionPathBody [data-asc-path="'+p+'"]');
    if (!b) return false; b.click(); return true;
  }, pfad);
  return gedrueckt;
}

(async () => {
  const browser = await starteBrowser();
  const roh = await tab(browser, null);
  const basis = roh.stand();
  await roh.ctx.close();
  check('2-basis: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  // Punkte kommen ueber Kampfpunkte (x3) - so liegt der Stand deutlich ueber der Schwelle, ohne
  // dass Gebaeude oder Flotte im Fixture stimmen muessen (Skill neuer-test: nicht den Deckel messen).
  function fixture(o){
    const st = Object.assign(JSON.parse(JSON.stringify(basis)), ruhigeUhren());
    st.seenTabHints = ['basis','forschung','bau','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil'];
    st.tutorialSeen = true; st.credits = 1000;
    st.prestige = o.prestige; st.battlePoints = o.battlePoints;
    st.ascension = { count: o.count, essence: 0, tree: { prod:0, speed:0, combat:0, start:0, expedition:0, leere:0, grenzen:0 } };
    if (o.chronik) st.ascension.chronik = o.chronik;   // sonst BEWUSST fehlend -> Migration
    return JSON.stringify(st);
  }
  const zahl = s => parseInt(String(s).replace(/\./g, ''), 10);

  // ---- 2) Erster Aufstieg: Grundwerte, Chronik-Eintrag Nr. 1 -----------------------------------
  const t2 = await tab(browser, fixture({ count:0, prestige:3, battlePoints:20000 }));
  await zuFortschritt(t2);
  const vor2 = await boxLesen(t2);
  check('2a: der Abschnitt nennt die Voraussetzung fuer Aufstieg Nr. 1 mit den Grundwerten',
    !!vor2.text && /Voraussetzung für Aufstieg Nr\. 1: Prestige 3 \+ 50\.000 Punkte/.test(vor2.text)
    && /die Schwelle steigt mit jedem vollzogenen Aufstieg/.test(vor2.text), (vor2.text||'').slice(0, 300));
  check('2b: vor dem ersten Aufstieg ist die Chronik leer und sagt das',
    vor2.chronik === 'Aufstiegs-Chronik · 0' && /Noch kein Aufstieg vollzogen/.test(vor2.text||''), vor2.chronik);
  check('2c: der Knopf ist frei - Prestige 3 und ueber 50.000 Punkte', !!vor2.knopf && !vor2.knopf.disabled, vor2.knopf);
  const versprochen = zahl(((vor2.knopf||{}).text.match(/\+([\d.]+) Essenz/) || [])[1]);
  const punkteVor = await punkteAusStore(t2, basis.player.id);
  check('2-punkte: der exakte Punktestand vor dem Aufstieg ist gemessen (Bestenlisten-Eintrag)',
    typeof punkteVor === 'number' && punkteVor >= 50000, punkteVor);
  const gedrueckt2 = await aufsteigen(t2, 'keiner');
  check('2-pfad: die Pfadwahl bot "Reiner Aufstieg" an', gedrueckt2);
  const st2 = await warteBis(() => { const s = t2.stand(); return (s.ascension||{}).count === 1 ? s : null; }, 8000, 200);
  const ch2 = ((st2||{}).ascension||{}).chronik;
  check('2d: nach dem Aufstieg steht GENAU EIN Chronik-Eintrag im gespeicherten Stand',
    Array.isArray(ch2) && ch2.length === 1, { count: ((st2||{}).ascension||{}).count, chronik: ch2 });
  const e2 = (ch2||[])[0] || {};
  check('2e: der Eintrag traegt Nr. 1, das Prestige und die Punkte VOR dem Reset, die Essenz des Knopfs und den Pfad',
    e2.nr === 1 && e2.prestige === 3 && e2.punkte === punkteVor && punkteVor >= 50000
    && e2.essenz === versprochen && versprochen > 0 && e2.gerettet === 'keiner'
    && typeof e2.zeit === 'number' && Math.abs(Date.now() - e2.zeit) < 60000,
    { eintrag: e2, punkteVor, versprochen });
  check('2e2: Punkte und Essenz haengen zusammen - die Essenz ist aus genau diesen Punkten gerechnet',
    e2.essenz === Math.max(5, Math.floor((e2.punkte||0)/5000) + 3*3 + Math.floor(20000/200)), { essenz: e2.essenz, punkte: e2.punkte });
  const nach2 = await warteBis(async () => { const b = await boxLesen(t2); return /Aufstieg Nr\. 2/.test(b.text||'') ? b : null; }, 5000, 200);
  check('2f: die Anzeige nennt jetzt die naechste, hoehere Schwelle (Nr. 2: Prestige 3 + 80.000)',
    !!nach2 && /Voraussetzung für Aufstieg Nr\. 2: Prestige 3 \+ 80\.000 Punkte/.test(nach2.text||''), ((nach2||{}).text||'').slice(0, 200));
  check('2g: die Chronik zeigt den Eintrag mit Nr., Punkten, Prestige, Essenz und Pfad',
    !!nach2 && nach2.chronik === 'Aufstiegs-Chronik · 1' && nach2.zeilen.length === 1
    && /Aufstieg 1 · \d{2}\.\d{2}\.\d{4}/.test(nach2.zeilen[0]) && new RegExp(String(punkteVor).replace(/\B(?=(\d{3})+(?!\d))/g, '\\.') + ' Punkte · Prestige 3 · \\+' + versprochen + ' Sternenessenz · Reiner Aufstieg').test(nach2.zeilen[0]),
    (nach2||{}).zeilen);
  check('2h: keine Seitenfehler (Hilfe- und Reiter-Texte lesen die Konstanten beim Laden)', t2.errs.length === 0, t2.errs.slice(0, 3));
  await t2.ctx.close();

  // ---- 3) Drei Aufstiege, Prestige 3: die alte Schwelle reicht NICHT mehr ------------------------
  const t3 = await tab(browser, fixture({ count:3, prestige:3, battlePoints:70000 }));
  await zuFortschritt(t3);
  const b3 = await boxLesen(t3);
  const punkte3 = await punkteAusStore(t3, basis.player.id);
  check('3a: nach drei Aufstiegen ist der Knopf mit Prestige 3 gesperrt, obwohl die Punkte reichen',
    !!b3.knopf && b3.knopf.disabled && punkte3 >= 204800, { knopf: b3.knopf, punkte: punkte3 });
  check('3b: und die Anzeige sagt, was fehlt: Prestige 3/4, Voraussetzung Nr. 4 = Prestige 4 + 204.800',
    /Noch nicht bereit: Prestige 3\/4/.test(b3.text||'') && /Voraussetzung für Aufstieg Nr\. 4: Prestige 4 \+ 204\.800 Punkte/.test(b3.text||''),
    (b3.text||'').slice(0, 300));
  const gedrueckt3 = await aufsteigen(t3, 'keiner');
  await t3.page.waitForTimeout(500);
  check('3c: ein gesperrter Knopf oeffnet keine Pfadwahl und stoesst keinen Aufstieg an',
    !gedrueckt3 && t3.dialoge.length === 0 && (t3.stand().ascension||{ count:3 }).count === 3, { pfadwahl: gedrueckt3, dialoge: t3.dialoge });
  await t3.ctx.close();

  // ---- 4) Vierter Aufstieg mit Pfad + Migration eines Stands OHNE Chronik-Feld -------------------
  const t4 = await tab(browser, fixture({ count:3, prestige:4, battlePoints:70000 }));
  await zuFortschritt(t4);
  const b4 = await boxLesen(t4);
  check('4-vor: mit Prestige 4 ist der Knopf frei', !!b4.knopf && !b4.knopf.disabled, b4.knopf);
  const roh4 = zahl(((b4.knopf||{}).text.match(/\+([\d.]+) Essenz/) || [])[1]);
  const punkte4 = await punkteAusStore(t4, basis.player.id);
  const gedrueckt4 = await aufsteigen(t4, 'offiziere');
  check('4-pfad: die Pfadwahl bot den Offiziersstab an', gedrueckt4);
  const st4 = await warteBis(() => { const s = t4.stand(); return (s.ascension||{}).count === 4 ? s : null; }, 8000, 200);
  const ch4 = ((st4||{}).ascension||{}).chronik || [];
  check('4a: ein Stand ohne Chronik-Feld wird zur Liste mit GENAU dem neuen Eintrag - Nr. 4, Prestige 4, Pfad offiziere',
    ch4.length === 1 && ch4[0].nr === 4 && ch4[0].prestige === 4 && ch4[0].gerettet === 'offiziere' && ch4[0].punkte === punkte4 && punkte4 >= 204800,
    { chronik: ch4, punkteVor: punkte4 });
  check('4b: die Essenz im Eintrag ist die des Pfads (30% weniger als der rohe Ertrag), nicht der rohe Ertrag',
    ch4.length === 1 && ch4[0].essenz === Math.max(1, Math.floor(roh4 * 0.7)) && ch4[0].essenz < roh4, { essenz: (ch4[0]||{}).essenz, roh: roh4 });
  const nach4 = await warteBis(async () => { const b = await boxLesen(t4); return /Aufstieg Nr\. 5/.test(b.text||'') ? b : null; }, 5000, 200);
  check('4c: die Chronik-Zeile nennt den Pfad mit Namen, die Anzeige die Schwelle fuer Nr. 5 (Prestige 4 + 327.680)',
    !!nach4 && nach4.zeilen.length === 1 && /Offiziersstab/.test(nach4.zeilen[0])
    && /Voraussetzung für Aufstieg Nr\. 5: Prestige 4 \+ 327\.680 Punkte/.test(nach4.text||''), (nach4||{}).zeilen);
  check('4d: keine Seitenfehler', t4.errs.length === 0, t4.errs.slice(0, 3));
  await t4.ctx.close();

  // ---- 5) Der Deckel: 50 Eintraege bleiben 50, der aelteste faellt heraus ---------------------------
  const volle = Array.from({ length: 50 }, (_, i) => ({ nr: i+1, zeit: 1700000000000 + i*86400000, punkte: 60000 + i, prestige: 3, essenz: 20, gerettet: 'keiner' }));
  const t5 = await tab(browser, fixture({ count:50, prestige:19, battlePoints:2000000, chronik: volle }));
  await zuFortschritt(t5);
  const b5 = await boxLesen(t5);
  check('5-vor: count 50 verlangt Prestige 19 und den gedeckelten Punktewert - der Knopf ist frei',
    !!b5.knopf && !b5.knopf.disabled && /Prestige 19 \+ 5\.497\.558 Punkte/.test(b5.text||''), { knopf: b5.knopf, text: (b5.text||'').slice(0, 200) });
  const gedrueckt5 = await aufsteigen(t5, 'keiner');
  const st5 = await warteBis(() => { const s = t5.stand(); return (s.ascension||{}).count === 51 ? s : null; }, 8000, 200);
  const ch5 = ((st5||{}).ascension||{}).chronik || [];
  check('5a: nach dem 51. Aufstieg sind es weiterhin 50 Eintraege - Nr. 1 ist heraus, Nr. 51 hinten dran',
    gedrueckt5 && ch5.length === 50 && ch5[0].nr === 2 && ch5[49].nr === 51, { laenge: ch5.length, erster: (ch5[0]||{}).nr, letzter: (ch5[49]||{}).nr });
  check('5b: keine Seitenfehler bei einer vollen Chronik', t5.errs.length === 0, t5.errs.slice(0, 3));
  await t5.ctx.close();

  await browser.close();
  ende();
})();
