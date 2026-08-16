// Das Minenschiff per Forschung freischalten (v8.482.0) - und Abbaumissionen reservieren ihre Schiffe.
//
// BEIDE PUNKTE SIND ECHTE FEHLER AUS v8.481.0, gefunden im PR-Review und NICHT von den Tests.
// Genau deshalb gibt es diese Datei.
//
//   A) FUENF Stellen behandeln ein Event-Schiff als gesperrt. v8.481.0 hatte nur zwei davon auf den
//      neuen Forschungsweg umgestellt: Die WERFTKARTE zeigte weiterhin die gesperrte Event-Kachel,
//      und die KAUFPRUEFUNG lehnte den Bau ab. Wer die Forschung Minentechnik hatte, aber das
//      Goldrausch-Event nie mitgenommen, konnte das Minenschiff also gar nicht bauen - obwohl der
//      Patchnote genau das versprach. Ein Feature, das fuer diese Spieler komplett tot war.
//
//   B) computeAwayByType() fuehrt eine feste Liste von Missionsarten, und 'mining' fehlte. Schiffe
//      einer laufenden Abbaumission galten weiter als verfuegbar - dieselben sechs Minenschiffe
//      liessen sich mehrfach gleichzeitig verschicken, und derselbe Frachtraum zaehlte in jeder
//      Mission erneut. Die Liste steht ausserdem ZWEIMAL (Verfuegbarkeit und Anzeige im Flotte-Tab);
//      beide werden hier geprueft, sonst zeigt die eine Stelle frei, was die andere verplant hat.
//
// GEGENPROBE: Nimmt man schiffPerForschungFrei aus der Werftkarte oder der Kaufpruefung, faellt A2
// bzw. A3. Nimmt man 'mining' aus einer der beiden Away-Listen, faellt B2 bzw. B3.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); if (!c) fail = true; };
const SAVE_KEY = 'kepler7-save-v3';

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (p === 'reports'){ if (req.method() === 'POST') return j({ ok:true }); return j({ reports: [] }); }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}
async function tab(browser, startSave){
  const store = {};
  if (startSave) store[SAVE_KEY] = startSave;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3000);
  await page.evaluate(() => { for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){ const e = document.getElementById(id); if (e) e.remove(); } });
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
function abgewandelt(basis, fn){ const st = JSON.parse(JSON.stringify(basis)); fn(st); return JSON.stringify(st); }

(async () => {
  // ---- A1 / B1: Quelltext-Zusicherungen (die eigentliche Regressionsbremse) -----------------
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  const gates = (src.match(/^.*unlockEventParts.*state\.unlocked.*$/gm) || []).filter(l => !/^\s*\/\//.test(l));
  const ohneForschung = gates.filter(g => !/schiffPerForschungFrei/.test(g));
  check('A1 jede Sperre fuer Event-Schiffe kennt den Forschungsweg',
    gates.length >= 4 && ohneForschung.length === 0, { sperren: gates.length, ohne: ohneForschung.length });
  const awayListen = (src.match(/m\.type==='attack' \|\| m\.type==='attack-player'[^\n]*m\.type==='expedition'[^\n]*/g) || []);
  check('B1 beide Away-Listen kennen die Abbaumission',
    awayListen.length === 2 && awayListen.every(l => /m\.type==='mining'/.test(l)), { listen: awayListen.length });

  const browser = await starteBrowser();
  const a = await tab(browser);
  const stA = a.stand();
  await a.ctx.close();

  // ---- A2/A3: Forschung da, Event NIE mitgenommen -> Schiff muss baubar sein ---------------
  const c = await tab(browser, abgewandelt(stA, st => {
    st.research = st.research || {};
    st.research.rminentechnik = 1;
    st.unlocked = {};            // ausdruecklich NICHTS aus dem Goldrausch-Event
    st.eventParts = {};
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 200000;
  }));
  await c.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="flotte"]'); if (x) x.click(); });
  await c.page.waitForTimeout(900);
  await c.page.evaluate(() => { const x = document.querySelector('[data-fleet-subtab="werft"]'); if (x) x.click(); });
  await c.page.waitForTimeout(1200);
  // Der Knopf EXISTIERT auch bei gesperrtem Schiff - er ist dann nur disabled. Gefragt ist also
  // nicht sein Dasein, sondern seine Benutzbarkeit.
  const kauf = await c.page.evaluate(() => {
    const b = document.querySelector('[data-buyship="schuerfschiff"]');
    return b ? { da:true, gesperrt: b.disabled || b.hasAttribute('disabled') } : { da:false };
  });
  check('A2 der Kaufknopf des Minenschiffs ist nicht gesperrt', kauf.da && !kauf.gesperrt, kauf);

  const vorher = (c.stand().fleet || {}).schuerfschiff || 0;
  await c.page.evaluate(() => { const b = document.querySelector('[data-buyship="schuerfschiff"]'); if (b) b.click(); });
  await c.page.waitForTimeout(1500);
  const stNachKauf = c.stand();
  const imBau = (stNachKauf.constructionQueue || []).some(j => j.key === 'schuerfschiff' || j.shipKey === 'schuerfschiff');
  const jetzt = (stNachKauf.fleet || {}).schuerfschiff || 0;
  check('A3 der Bau wird wirklich angenommen', imBau || jetzt > vorher,
    { imBau, vorher, jetzt, queue: (stNachKauf.constructionQueue||[]).length });
  await c.ctx.close();

  // ---- B2/B3: eine laufende Abbaumission reserviert ihre Schiffe ---------------------------
  const guertel = Object.keys(stA.asteroidFeld || {});
  const sys = guertel[0];
  const platz = Object.keys(stA.asteroidFeld[sys].plaetze).filter(k => !stA.asteroidFeld[sys].plaetze[k].frei)[0];
  const d = await tab(browser, abgewandelt(stA, st => {
    st.research = st.research || {};
    st.research.rminentechnik = 1;
    st.fleet.schuerfschiff = 6;
    st.fleet.frachter = 10;
    st.buildings.lager = 200;
    for (const r of ['energie','erz','kristalle','deuterium','antimaterie']) st.resources[r] = 20000;
  }));
  await d.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await d.page.waitForTimeout(700);
  // Seit KB-4: über die Sektoren hinein (Übersicht -> Region -> System).
  await oeffneSystemUeberSektoren(d.page, sys);
  async function oeffneWahl(pl){
    await d.page.evaluate(x => { const n = document.querySelector('[data-map-asteroid="' + x + '"]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 })); }, pl);
    await d.page.waitForTimeout(400);
    await d.page.evaluate(() => { const x = [...document.querySelectorAll('.kmenu button')].find(y => /Abbaumission/.test(y.textContent)); if (x) x.click(); });
    await d.page.waitForTimeout(800);
    // NUR lesen, wenn das Feld wirklich offen ist: Ein geschlossenes #fwahlOverlay behaelt seinen
    // alten Text im DOM - sonst vergleicht man zweimal denselben Stand und "beweist" damit nichts.
    return d.page.evaluate(() => {
      const o = document.querySelector('#fwahlOverlay');
      return (o && o.classList.contains('open')) ? o.innerText : null;
    });
  }
  const platz2 = Object.keys(stA.asteroidFeld[sys].plaetze).filter(k => !stA.asteroidFeld[sys].plaetze[k].frei)[1];
  const wahl1 = await oeffneWahl(platz);
  check('B2-vorab das Feld ist offen und zeigt zunaechst alle sechs Minenschiffe',
    !!wahl1 && /verfügbar: 6 von 6/.test(wahl1), wahl1 ? (wahl1.match(/verfügbar: \d+ von \d+/g)||[]).slice(0,2) : 'Feld blieb zu');
  await d.page.evaluate(() => { const x = [...document.querySelectorAll('#fwahlOverlay button')].find(y => /Abbaumission starten/.test(y.textContent)); if (x) x.click(); });
  await d.page.waitForTimeout(1800);
  const mission = (d.stand().fleet.missions || []).find(m => m.type === 'mining');
  check('B2-vorab2 die Mission laeuft', !!mission, mission ? { schiffe: mission.composition.schuerfschiff } : null);

  /* WO die Reservierung geprueft wird - und warum nicht noch einmal im Kartenmenue:
     Nach dem Start sind alle sechs Minenschiffe unterwegs, und das Kartenmenue graut den Eintrag
     "Abbaumission" deshalb voellig richtig aus. Das Feld geht gar nicht mehr auf, es gibt also
     nichts zu lesen - und ein geschlossenes #fwahlOverlay behaelt seinen ALTEN Text im DOM, man
     verglich sonst zweimal denselben Stand (Arbeitsregel 5).
     Gemessen wird an den ESKORTE-Zeilen des Expeditions-Tabs. Die rechnen mit computeAwayByType() -
     genau der Funktion, der 'mining' gefehlt hat - und sie fuehren die FRACHTER. Das trifft den
     gemeldeten Fehler ins Zentrum: Es ging nicht nur um doppelt verplante Minenschiffe, sondern
     darum, dass derselbe Frachtraum in jeder weiteren Mission erneut zaehlte. */
  await d.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="expedition"]'); if (x) x.click(); });
  await d.page.waitForTimeout(1400);
  const expText = await d.page.evaluate(() => document.body.innerText);
  const frachterZeile = (expText.match(/Kleiner Frachter[\s\S]{0,110}/) || [''])[0].replace(/\n/g, ' | ');
  check('B2 die Frachter der laufenden Abbaumission sind als unterwegs ausgewiesen',
    /10 bereits unterwegs/.test(expText), frachterZeile);
  check('B3 und sie gelten dort nicht mehr als verfuegbar',
    !/Kleiner Frachter[\s\S]{0,90}verfügbar:\s*10\s*von\s*10/.test(expText), frachterZeile);

  const fehler = d.errs.filter(e => !/favicon|net::ERR|CORS|404/i.test(e));
  check('keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
  await d.ctx.close();

  await browser.close();
  console.log(fail ? '\nERGEBNIS: FEHLER' : '\nERGEBNIS: alles gruen');
  process.exit(fail ? 1 : 0);
})();
