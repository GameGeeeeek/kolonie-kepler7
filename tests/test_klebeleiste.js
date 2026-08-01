// Die klebende Reiterleiste auf dem Handy - und warum dieser Test im Browser laufen MUSS.
//
// DER BEFUND (01.08.2026)
// -----------------------
// `body.compact-head .tabs { position:sticky; top:0 }` steht seit dem Grafik-Audit vom 24.07.2026
// in der Datei. Sie hat nie funktioniert. Die Leiste scrollte auf jedem Reiter komplett weg, und wer
// tief in einer Gebäude- oder Forschungsliste stand, musste zum Reiterwechsel den ganzen Weg zurück.
//
// Ursache war eine Regel 650 Zeilen WEITER OBEN, an einem völlig anderen Element: `.shell` hatte
// `overflow:hidden`. Das erzeugt einen Scroll-Container, und `position:sticky` klebt immer am
// nächsten Scroll-Container - hier also an einer Box, die selbst mit der Seite scrollt. Effektiv:
// gar nicht. `overflow:clip` beschneidet optisch identisch, erzeugt aber keinen Scroll-Container.
//
// WARUM NICHT STATISCH PRÜFEN
// ---------------------------
// Eine Quelltext-Prüfung hätte hier ein Jahr lang GRÜN gemeldet: Die sticky-Regel war ja da,
// buchstabengetreu und korrekt. Kaputt war die Wechselwirkung mit einem anderen Selektor. Genau
// deshalb scrollt dieser Test wirklich und schaut nach, wo die Leiste dann steht - und zwar auf
// ALLEN Reitern, nicht nur einem: Mit `hidden` klebte sie zufällig auf 1 von 12 (dort war der
// Inhalt zu kurz zum Scrollen), und ein Test mit einem einzigen Reiter hätte genau den erwischen
// können.
//
// Der Test prüft zusätzlich, dass der Beschnitt erhalten bleibt (kein waagerechter Überlauf) -
// sonst wäre "clip statt hidden" die Reparatur einer Sache auf Kosten einer anderen.
const { starteBrowser, SPIELDATEI } = require('./lib/umgebung');
const path = require('path');
const fs = require('fs');
const FILE = 'file://' + path.resolve(SPIELDATEI);

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s=200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

// Alle Reiter-Hinweise als gesehen markiert: Die Hinweisleiste ist ein hoher Block, der den Inhalt
// nach unten schiebt - mit ihr würde der Test messen, wie weit man scrollen muss, statt was klebt.
const SPEICHER = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  seenTabHints:{ basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                 galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1 },
  resources:{ energie:412000, erz:388000, kristalle:264000, deuterium:151000, antimaterie:19400, forschungspunkte:31200 },
  buildings:{ solar:20, mine:19, raffinerie:15, synth:13, labor:12, werft:12, hangar:8, lager:12, turm:10, schild:8, laser:9 },
  research:{ rsolar:8, rerz:8, rkristall:6, rkampf:7, rfusion:5, rexpedition:4 },
  fleet:{ jaeger:420, schlachtschiff:60, bomber:90, frachter:60, spaeher:20, missions:[] },
  colonies:{}, activeBasePlanet:'home', shipMarks:{},
  player:{ id:'u', name:'A', allianceTag:'', avatarKey:null }, battleStats:{ wins:22, losses:4 },
  xp:64000, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{} });

const TABS = ['basis','verteidigung','forschung','flotte','expedition','karte',
              'galaxie','allianz','offiziere','markt','punkte','fortschritt'];

(async () => {
  let fail = false;
  const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

  // ---- Quelltext: die Bedingung, die man beim Lesen NICHT sieht -------------------------------
  // Bewusst zusätzlich zur Verhaltensprüfung: Wer .shell wieder auf hidden setzt, soll den Grund
  // an der Fehlermeldung ablesen können, statt nur "Leiste klebt nicht" zu sehen.
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  const shellVon = src.indexOf('.shell {');
  const shellBlock = src.slice(shellVon, src.indexOf('}', shellVon));
  check('.shell beschneidet mit clip, nicht mit hidden (hidden erzeugt einen Scroll-Container)',
    /overflow:\s*clip/.test(shellBlock) && !/overflow:\s*hidden/.test(shellBlock),
    (shellBlock.match(/overflow:[^;]*/) || [''])[0]);
  check('die sticky-Regel der Reiterleiste existiert überhaupt noch',
    /body\.compact-head \.tabs \{[^}]*position:sticky/.test(src));
  check('ihr Hintergrund ist deckend (sonst läuft der Inhalt sichtbar durch sie hindurch)',
    /body\.compact-head \.tabs \{[^}]*background:#[0-9a-f]{6}/i.test(src),
    (src.match(/body\.compact-head \.tabs \{[^}]*background:[^;]*/) || [''])[0].slice(-30));

  const b = await starteBrowser();
  const store = {}; store['kepler7-save-v3'] = SPEICHER;
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE);
  await page.waitForTimeout(2400);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
  });
  await page.waitForTimeout(1000);

  check('der Kompaktmodus ist auf Handybreite von selbst an (sonst greift die Regel gar nicht)',
    await page.evaluate(() => document.body.classList.contains('compact-head')));

  // ---- Verhalten: auf JEDEM Reiter scrollen und nachsehen --------------------------------------
  const klebt = [], scrollteNicht = [], ueberlauf = [];
  for (const tab of TABS){
    await page.evaluate(t => { const b = document.querySelector('.tab-btn[data-tab="'+t+'"]'); if (b) b.click(); }, tab);
    await page.waitForTimeout(1100);
    const u = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (u > 1) ueberlauf.push(tab + ' (+' + u + 'px)');
    const r = await page.evaluate(() => {
      window.scrollTo(0, 1000);
      return new Promise(res => setTimeout(() => {
        const t = document.querySelector('.tabs').getBoundingClientRect();
        res({ y: Math.round(window.scrollY), top: Math.round(t.top) });
      }, 350));
    });
    // Konnte der Reiter überhaupt scrollen? Ein zu kurzer Reiter kann nichts beweisen - er würde
    // sonst als "klebt" durchgehen, obwohl nichts passiert ist. Genau so kam mit `hidden` die
    // eine grüne Messung von zwölf zustande.
    if (r.y < 300) { scrollteNicht.push(tab); }
    else if (r.top >= -2 && r.top < 130) klebt.push(tab);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
  }
  const geprueft = TABS.length - scrollteNicht.length;
  check('genug Reiter sind lang genug zum Scrollen, um überhaupt etwas zu beweisen',
    geprueft >= 8, { geprueft, zuKurz: scrollteNicht });
  check('die Reiterleiste bleibt auf JEDEM scrollbaren Reiter oben stehen',
    klebt.length === geprueft, { klebt: klebt.length, geprueft, klebtNicht: TABS.filter(t => !klebt.includes(t) && !scrollteNicht.includes(t)) });
  check('der Beschnitt bleibt erhalten - kein Reiter überläuft waagerecht', ueberlauf.length === 0, ueberlauf);

  // ---- Ressourcen: alle sechs gleichzeitig sichtbar ---------------------------------------------
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="basis"]'); if (b) b.click(); });
  await page.waitForTimeout(1000);
  const res = await page.evaluate(() => {
    const bar = document.querySelector('.resbar');
    if (!bar) return null;
    const bb = bar.getBoundingClientRect();
    const cards = [...document.querySelectorAll('.rescard')];
    const ganz = cards.filter(c => { const r = c.getBoundingClientRect();
      return r.left >= bb.left - 1 && r.right <= bb.right + 1 && r.top >= bb.top - 1 && r.bottom <= bb.bottom + 1; }).length;
    return { ganz, alle: cards.length, anzeige: getComputedStyle(bar).display,
             hoehe: Math.round(bb.height), wischbar: bar.scrollWidth > bar.clientWidth + 2 };
  });
  check('die Ressourcenleiste wurde gefunden', !!res && res.alle >= 6, res);
  check('ALLE Ressourcenkarten sind gleichzeitig sichtbar (vorher: eine von sechs)',
    res.ganz === res.alle, res);
  check('sie ist dafür ein Raster, keine Wischleiste', res.anzeige === 'grid' && !res.wischbar, res);

  check('keine Skriptfehler während des Laufs', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
