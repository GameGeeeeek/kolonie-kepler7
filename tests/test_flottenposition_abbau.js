// Abbaufortschritt in der Flottenposition, und die Zeile fuehrt zum Asteroiden
// (Wunsch Sascha, 17.08.2026: "wenn eine Flotte zu einem Asteroiden fliegt, soll rechts bei
// Flottenposition angezeigt werden, wieviel schon abgebaut worden ist - und klickbar sein, dass
// man zum Asteroiden gefuehrt wird, wo die Flotte gerade ist").
//
// WAS DABEI AUFFIEL - und der eigentliche Grund fuer Pruefung 2: Die Abbaumission hatte in dieser
// Liste ueberhaupt keinen eigenen Zweig. Sie fiel in den generischen ganz unten, und der sucht
// `PLANETS.find(p => p.id === m.targetId)` - eine Abbaumission traegt dort aber "system:platz"
// statt einer Planeten-Id. Die Suche lief also zwangslaeufig ins Leere, und in der Seitenleiste
// stand "Erkundungsziel", waehrend die Flotte an einem Guertelplatz schuerfte. Keine fehlende
// Zeile, sondern eine Falschaussage.
//
// GEPRUEFT WIRD:
//   1. Die Fortschritts-Rechnung selbst, aus der Datei geholt und AUSGEFUEHRT: Anflug = nichts
//      gefoerdert, Mitte = anteilig, nach abbauBis = voll, und streng monoton dazwischen. Der
//      Anteil wird ABGELEITET (hinBis/abbauBis/ladung), nirgends gespeichert.
//   2. Am laufenden Spiel: Die Zeile nennt den Asteroiden statt "Erkundungsziel" - gemessen mit
//      einer Mission, deren Abbau zur HAELFTE durch ist, gegen den aus der Fixture GERECHNETEN
//      Erwartungswert (Arbeitsregel 2: nichts eintippen).
//   3. Ein Klick auf die Zeile oeffnet die Karte und meldet, wo die Flotte steht.
//   4. Die Sprungmechanik ist EINE Quelle: springeZuAsteroid, von Bericht und Flottenzeile
//      gerufen - keine zweite Kopie, die beim naechsten Karten-Umbau auseinanderlaeuft.
//
// GEGENPROBE (Arbeitsregel 1, in beide Richtungen ausgefuehrt): Am Stand v8.542.0 steht in der
// Zeile woertlich "Testflotte → Erkundungsziel" (2a-2f fallen), springeZuAsteroid gibt es nicht
// (4a/4b fallen), und der Fortschritts-Block ist nicht auffindbar (1-anker/1-bau fallen).
// ZUR PRUEFUNGSZAHL (Arbeitsregel 34): Der alte Lauf fuehrt 13 statt 21 Pruefungen aus. Die acht
// fehlenden sind 1a-1f und 3a/3b - sie haengen an Bedingungen, die am alten Stand gar nicht
// eintreten koennen (kein ausfuehrbarer Block, keine klickbare Zeile). Beide Bedingungen werden
// SELBST geprueft und melden dort rot (1-bau, 2e), es verschwindet also nichts stillschweigend.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) Die Rechnung, ausgefuehrt statt gelesen ---------------------------------------------
{
  const von = JS.indexOf('  function abbauFortschritt(m){');
  const bis = von < 0 ? -1 : JS.indexOf('\n  function springeZuAsteroid(', von);
  check('1-anker: der Fortschritts-Block ist auffindbar', von > 0 && bis > von, { von, bis });
  let f = null, fehler = null;
  if (von > 0 && bis > von){
    // Sturzsicher (Arbeitsregel 34): Faellt der Aufbau, meldet das eine eigene Pruefung, statt
    // den ganzen Lauf abzubrechen - die uebrigen sollen trotzdem etwas sagen.
    try {
      f = new Function('fmt', JS.slice(von, bis) + '\nreturn { fortschritt: abbauFortschritt, text: abbauFortschrittText };')(n => String(n));
    } catch(e){ fehler = e.message; }
  }
  check('1-bau: der Block laesst sich ausfuehren', !!f, fehler);
  if (f){
    const jetzt = Date.now();
    const mAnflug = { hinBis: jetzt + 60000, abbauBis: jetzt + 120000, ladung: 10000 };
    const mMitte  = { hinBis: jetzt - 30000, abbauBis: jetzt + 30000, ladung: 10000 };
    const mVoll   = { hinBis: jetzt - 120000, abbauBis: jetzt - 60000, ladung: 10000 };
    check('1a: im Anflug ist noch NICHTS gefoerdert', f.fortschritt(mAnflug).gefoerdert === 0
      && f.fortschritt(mAnflug).phase === 'anflug', f.fortschritt(mAnflug));
    const mitte = f.fortschritt(mMitte);
    check('1b: zur Haelfte der Abbauzeit ist rund die halbe Ladung gefoerdert',
      Math.abs(mitte.anteil - 0.5) < 0.05 && Math.abs(mitte.gefoerdert - 5000) < 500, mitte);
    check('1c: nach dem Abbauende ist die Fuhre VOLL - kein weiterlaufender Balken',
      f.fortschritt(mVoll).gefoerdert === 10000 && f.fortschritt(mVoll).anteil === 1, f.fortschritt(mVoll));
    // Streng monoton: Der Fortschritt darf zwischendrin nie zurueckspringen.
    let monoton = true, vorher = -1;
    for (let p = 0; p <= 20; p++){
      const spanne = 60000;
      const m = { hinBis: jetzt - spanne*(p/20), abbauBis: jetzt + spanne*(1-p/20), ladung: 10000 };
      const g = f.fortschritt(m).gefoerdert;
      if (g < vorher) monoton = false;
      vorher = g;
    }
    check('1d: der Fortschritt waechst monoton, er springt nie zurueck', monoton);
    check('1e: eine Mission ohne Zeitfelder ergibt 0 statt NaN',
      f.fortschritt({ ladung: 500 }).gefoerdert === 0, f.fortschritt({ ladung: 500 }));
    check('1f: der Text nennt die drei Zustaende getrennt',
      /Anflug/.test(f.text(mAnflug)) && /gefördert/.test(f.text(mMitte)) && /Rückflug/.test(f.text(mVoll)),
      { anflug: f.text(mAnflug), mitte: f.text(mMitte), voll: f.text(mVoll) });
  }
}

// ---- 4) EINE Sprungquelle -------------------------------------------------------------------
{
  const defs = (JS.match(/function springeZuAsteroid\(/g) || []).length;
  check('4a: springeZuAsteroid ist genau einmal definiert', defs === 1, { defs });
  const ohneKommentar = JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const rufe = (ohneKommentar.match(/springeZuAsteroid\(/g) || []).length - 1; // minus Definition
  check('4b: und wird von mindestens zwei Stellen gerufen (Bericht und Flottenzeile)',
    rufe >= 2, { aufrufe: rufe });
  // Die Blink-Marke darf es nur noch EINMAL geben - sonst laufen zwei Kopien auseinander.
  const blink = (ohneKommentar.match(/fundort-blink/g) || []).length;
  check('4c: die Hervorhebung steht an genau einer Stelle im Code (plus CSS)', blink <= 2, { vorkommen: blink });
}

// ================================================================== am laufenden Spiel
const SAVE_KEY = 'kepler7-save-v3';
// Der Abbau ist zur HAELFTE durch - so misst der Test einen Zwischenstand und nicht 0 oder voll.
const LADUNG = 40000;
function fixture(){
  const jetzt = Date.now();
  return JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true, lastTick:jetzt,
    nextPlanetEventCheck: jetzt+36e5, nextTraderCheck: jetzt+36e5, nextRaidTime: jetzt+36e5, nextFactionGift: jetzt+36e5,
    resources:{energie:5e5,erz:5e5,kristalle:3e5,deuterium:2e5,antimaterie:1e4,forschungspunkte:2e4},
    buildings:{solar:20,mine:12,labor:8,lager:20,werft:10},
    research:{ rminentechnik:1 }, colonies:{}, activeBasePlanet:'home',
    fleet:{ schuerfschiff:6, missions:[{
      id: 900, type:'mining', targetId:'chronos:0',
      system:'chronos', platz:0, sorte:'eiskern', groesse:'brocken', peilung:false,
      startTime: jetzt - 120000,
      hinBis:   jetzt - 60000,          // vor einer Minute angekommen
      abbauBis: jetzt + 60000,          // noch eine Minute Abbau -> HALB durch
      endTime:  jetzt + 180000,
      ladung: LADUNG, res:{ deuterium: LADUNG }, proto: 2,
      fleetName:'Testflotte', composition:{ schuerfschiff:3 }
    }]},
    xp:50000, credits:20000, buffs:[], colonyNames:{}, modules:{}, shipModules:{},
    player:{id:'u',name:'A',avatarKey:null}
  });
}
function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  // Kein geteiltes Feld: Dann erzeugt das Spiel den Guertel lokal und deterministisch, und der
  // Platz aus der Fixture existiert wirklich (dieselbe Lesart wie test_fundort_knopf).
  if (p === 'asteroid/field') return j({ error:'Cannot GET' }, 404);
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (p === 'reports'){ if (req.method() === 'POST') return j({ ok:true }); return j({ reports: [] }); }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|notifications/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

(async () => {
  const browser = await starteBrowser();
  const store = {}; store[SAVE_KEY] = fixture();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  // Protokollzeilen MITSCHNEIDEN - #log ueberschreibt sich mit jeder Meldung selbst (Regel 47).
  await page.addInitScript(() => {
    window.__logZeilen = [];
    const start = () => { const box = document.getElementById('log'); if (!box) return false;
      const merke = () => { const t=(box.innerText||'').trim(); if (t && window.__logZeilen[window.__logZeilen.length-1]!==t) window.__logZeilen.push(t); };
      new MutationObserver(merke).observe(box,{childList:true,characterData:true,subtree:true}); merke(); return true; };
    if (!start()) document.addEventListener('DOMContentLoaded', start);
  });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o=document.getElementById(id); if(o) o.style.display='none'; }); });

  const zeile = () => page.evaluate(() => {
    const box = document.getElementById('fleetPositionList');
    if (!box) return null;
    const el = box.querySelector('[data-fp-asteroid]') || box.querySelector('.fleet-position-item');
    if (!el) return null;
    return { text: el.textContent, klickbar: el.hasAttribute('data-fp-asteroid'),
             ziel: el.getAttribute('data-fp-asteroid'), titel: el.getAttribute('title') || '' };
  });

  const z = await zeile();
  check('2-vorab: die Flottenposition zeigt eine Zeile', !!z, z);
  if (z){
    check('2a: sie nennt den Asteroiden, nicht "Erkundungsziel"',
      /Eiskern/.test(z.text) && !/Erkundungsziel/.test(z.text), z.text.replace(/\s+/g,' ').slice(0, 140));
    check('2b: und das System dazu', /Chronos/.test(z.text), z.text.replace(/\s+/g,' ').slice(0, 140));
    // Erwartung GERECHNET, nicht eingetippt: Der Abbau ist zur Haelfte durch, also rund LADUNG/2.
    const zahlen = (z.text.match(/[\d.]+k?/g) || []);
    check('2c: sie nennt einen Fortschritt zwischen 0 und der vollen Ladung',
      /gefördert/.test(z.text) && /%/.test(z.text), { text: z.text.replace(/\s+/g,' ').slice(0,140), zahlen });
    const pct = Number((z.text.match(/\((\d+)%\)/) || [])[1]);
    check('2d: und der liegt bei rund der Haelfte (Fixture: halbe Abbauzeit vorbei)',
      pct >= 40 && pct <= 60, { gemessen: pct });
    check('2e: die Zeile ist klickbar und zeigt auf System:Platz',
      z.klickbar === true && z.ziel === 'chronos:0', { klickbar: z.klickbar, ziel: z.ziel });
    check('2f: der Tooltip erklaert, was ein Klick tut', /Antippen/.test(z.titel), z.titel.slice(0, 120));
  }

  // ---- 3) Der Klick fuehrt zum Asteroiden ----------------------------------------------------
  if (z && z.klickbar){
    await page.evaluate(() => {
      const el = document.querySelector('#fleetPositionList [data-fp-asteroid]');
      if (el) el.click();
    });
    await page.waitForTimeout(1500);
    const reiter = await page.evaluate(() => { const a = document.querySelector('.tab-btn.active'); return a ? a.getAttribute('data-tab') : null; });
    check('3a: der Klick oeffnet die Karte', reiter === 'karte', reiter);
    const mitschnitt = await page.evaluate(() => (window.__logZeilen||[]).join('\n'));
    check('3b: und meldet, wo die Flotte gerade abbaut',
      /baut deine Flotte gerade ab|im Einsatz/.test(mitschnitt),
      (mitschnitt.match(/[^\n]*(Flotte gerade ab|im Einsatz)[^\n]*/) || ['(nicht gefunden) gesehen: '+mitschnitt.split('\n').slice(-4).join(' | ')])[0].slice(0, 200));
  }
  check('3c: keine JS-Fehler', errs.length === 0, errs.slice(0, 3));

  await ctx.close();
  await browser.close();
  ende();
})();
