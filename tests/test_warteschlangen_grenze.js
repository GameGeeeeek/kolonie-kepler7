// Die Warteschlangen sagen die Wahrheit ueber ihre eigene Grenze - und nehmen keine Stufen an,
// die es nicht geben kann (Spieler-Report Sascha, 17.08.2026, Screenshot).
//
// ZWEI FEHLER IN EINEM BILD, beide aus derselben Familie: eine Anzeige, die etwas behauptet, was
// die Mechanik daneben anders sieht (CLAUDE.md Regel 6).
//
//   (a) Die Kopfzeile las "FORSCHUNGS-WARTESCHLANGE (19/10)". Das Einreihen prueft seit den
//       Komfort-Grenzen komfortGrenze('warteschlange') - also 10 ODER 25 je nach Rang -, die
//       Kopfzeile fuehrte die 10 aber als LITERAL. Mit Unterstuetzer-Rang standen dort ganz
//       legitim 19 Eintraege und daneben eine Grenze, die es fuer diesen Spieler nie gab.
//   (b) Eingereiht waren "Kolonial-Logistik -> Stufe 21" bis "Stufe 39", bei maxLevel 28. Elf
//       davon koennen nie stattfinden. tryStartQueuedResearch wirft sie beim Abarbeiten einzeln
//       wieder raus (curLvl >= maxLevel -> splice), aber bis dahin zaehlt die Box sie mit: Die
//       gemeldeten Gesamtkosten (593,2k Erz) und die "fertig in ~9243h" waren Summen ueber
//       Stufen, die es nicht gibt. Ein Wert, der spaeter still verschwindet, ist zwischenzeitlich
//       eine Falschaussage - der Riegel gehoert deshalb ans EINREIHEN.
//
// WARUM ABSCHNITT 1 MUSTERBASIERT SUCHT statt die zwei bekannten Zeilen zu pruefen: Genau diese
// zwei Zeilen sind beim Umbau am 16.08. uebersehen worden, weil niemand nach ihnen gesucht hat.
// Eine Pruefung, die nur sie kennt, findet beim naechsten Mal wieder nur, woran jemand gedacht
// hat (CLAUDE.md Regel 40). Abschnitt 1 kennt deshalb KEINE Zeilennummern: Er sucht jede Stelle,
// die eine Warteschlangen-Kapazitaet ausgibt, und verlangt, dass sie abgeleitet ist.
//
// GEGENPROBE (Arbeitsregel 1, in beide Richtungen gefahren) - siehe unten am Dateiende.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
// Verneinende Pruefungen schneiden die Historie heraus - ein Patchnote, der den alten Wortlaut
// zitiert, um die Behebung zu erklaeren, wuerde sie sonst reissen (CLAUDE.md Regel 46).
const OHNE_HISTORIE = (() => {
  const v = JS.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : JS.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? JS.slice(0, v) + JS.slice(b) : JS;
})();

// ---- 1) Quelltext: keine fest verdrahtete Warteschlangen-Grenze ------------------------------
{
  check('1-vorab: der PATCHNOTES-Block liess sich herausschneiden',
    OHNE_HISTORIE.length < JS.length, { ganz: JS.length, ohne: OHNE_HISTORIE.length });

  // Jede Stelle, die "Warteschlange (<etwas>/<etwas>)" ausgibt. Die Kapazitaet darf keine blanke
  // Zahl sein. Der Fehlschlag nennt die Zeilen, damit nicht von Hand gesucht werden muss (Regel 33/37).
  const zeilen = OHNE_HISTORIE.split('\n');
  const kapazitaetsZeilen = zeilen
    .map((z, i) => ({ nr: i + 1, z }))
    .filter(o => /Warteschlange \(\$\{[^}]*\}\//.test(o.z));
  check('1a: es gibt ueberhaupt Kopfzeilen mit Kapazitaets-Angabe (sonst misst der Test nichts)',
    kapazitaetsZeilen.length >= 2, { gefunden: kapazitaetsZeilen.length });

  const festVerdrahtet = kapazitaetsZeilen.filter(o => /Warteschlange \(\$\{[^}]*\}\/\d/.test(o.z));
  check('1b: keine Kopfzeile fuehrt ihre Grenze als blanke Zahl',
    festVerdrahtet.length === 0,
    festVerdrahtet.map(o => o.nr + ': ' + o.z.trim().slice(0, 120)));

  const abgeleitet = kapazitaetsZeilen.filter(o => /komfortGrenze\(/.test(o.z));
  check('1c: jede Kopfzeile liest die Grenze aus komfortGrenze()',
    abgeleitet.length === kapazitaetsZeilen.length,
    { kapazitaetsZeilen: kapazitaetsZeilen.length, abgeleitet: abgeleitet.length,
      fehlend: kapazitaetsZeilen.filter(o => !/komfortGrenze\(/.test(o.z)).map(o => o.nr) });

  // Der Riegel selbst: beide Einreih-Funktionen muessen maxLevel kennen.
  const rq = (() => { const v = JS.indexOf('  function addToResearchQueue(key){'); const b = v < 0 ? -1 : JS.indexOf('\n  }', v); return v >= 0 && b > v ? JS.slice(v, b) : ''; })();
  check('1d-anker: addToResearchQueue ist auffindbar', rq.length > 0, { laenge: rq.length });
  check('1d: addToResearchQueue prueft die Maximalstufe',
    /maxLevel/.test(rq) && /isEndlessResearch/.test(rq), rq.slice(0, 200));
  const bq = (() => { const v = JS.indexOf('  function addToQueue(planetKey, buildingKey){'); const b = v < 0 ? -1 : JS.indexOf('\n  }', v); return v >= 0 && b > v ? JS.slice(v, b) : ''; })();
  check('1e-anker: addToQueue ist auffindbar', bq.length > 0, { laenge: bq.length });
  check('1e: addToQueue prueft die Maximalstufe je Standort',
    /maxLevel/.test(bq) && /q\.planet === planetKey/.test(bq), bq.slice(0, 200));
}

// ================================================================== am laufenden Spiel
const SAVE_KEY = 'kepler7-save-v3';
// rkolonisation steht bewusst auf maxLevel-1: So ist der ERSTE Klick erlaubt und erst der zweite
// muss abprallen. Ein Fixture direkt auf maxLevel haette den Riegel auch bei einem kaputten
// Vergleich gruen gemeldet, weil dann schon die erste Zeile unmoeglich waere.
function fixture(){
  const jetzt = Date.now();
  return JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true, lastTick:jetzt,
    nextPlanetEventCheck: jetzt+36e5, nextTraderCheck: jetzt+36e5, nextRaidTime: jetzt+36e5, nextFactionGift: jetzt+36e5,
    resources:{energie:5e5,erz:5e8,kristalle:3e8,deuterium:2e8,antimaterie:1e6,forschungspunkte:2e7},
    buildings:{solar:20,mine:12,labor:8,lager:30,werft:10},
    research:{ rkolonisation:27 },
    activeResearch:null, researchQueue:[], buildQueue:[],
    fleet:{ missions:[] }, colonies:{}, activeBasePlanet:'home',
    xp:50000, credits:20000, buffs:[], colonyNames:{}, modules:{}, shipModules:{},
    player:{id:'u',name:'A',avatarKey:null}
  });
}
function backend(store, unterstuetzer){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0,
    hasEmail:true, wantsPatchnotes:true,
    supporter: unterstuetzer ? { active:true, tier:'gold', quelle:'kofi', until: Date.now()+30*864e5 } : { active:false } });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (p === 'reports'){ if (req.method() === 'POST') return j({ ok:true }); return j({ reports: [] }); }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|notifications|cosmetics/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}
async function spiel(browser, unterstuetzer){
  const store = {}; store[SAVE_KEY] = fixture();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/api/**', backend(store, unterstuetzer));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o=document.getElementById(id); if(o) o.style.display='none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="forschung"]'); if (b) b.click(); });
  await page.waitForTimeout(900);
  return { ctx, page };
}
// Die Kopfzeile der Forschungs-Warteschlange. Bewusst auf #researchQueueBox gescopt: "Warteschlange"
// steht auch an Knoepfen und in der Bau-Box, ein ungescopter Selektor traefe die falsche
// (CLAUDE.md Regel 5).
const kopfzeile = (page) => page.evaluate(() => {
  const box = document.getElementById('researchQueueBox');
  const t = box && box.querySelector('.section-title');
  return t ? (t.textContent||'').replace(/\s+/g,' ').trim() : null;
});

(async () => {
  const browser = await starteBrowser();

  // ---- 2) OHNE Rang: die Kopfzeile nennt 10 ---------------------------------------------------
  let t = await spiel(browser, false);
  {
    const k = await kopfzeile(t.page);
    check('2-vorab: die Kopfzeile ist ueberhaupt da', !!k, k);
    check('2a: sie nennt ohne Rang die Grenze 10', !!k && /\(0\/10\)/.test(k), k);
  }

  // ---- 4) Der Riegel gegen unmoegliche Stufen (rkolonisation 27, maxLevel 28) ------------------
  {
    const knopf = '#research [data-research-queue="rkolonisation"]';
    const da = await t.page.$(knopf);
    check('4-vorab: der Warteschlangen-Knopf der Kolonial-Logistik ist da', !!da, knopf);
    if (da){
      await t.page.click(knopf);
      await t.page.waitForTimeout(400);
      const nach1 = await kopfzeile(t.page);
      check('4a: die erlaubte Stufe 28 laesst sich einreihen', !!nach1 && /\(1\//.test(nach1), nach1);
      await t.page.click(knopf);
      await t.page.waitForTimeout(400);
      const nach2 = await kopfzeile(t.page);
      // Das ist der eigentliche Befund: Stufe 29 gibt es nicht, die Zeile darf nicht entstehen.
      check('4b: Stufe 29 prallt ab - die Warteschlange bleibt bei einem Eintrag',
        !!nach2 && /\(1\//.test(nach2), nach2);
    }
  }
  await t.ctx.close();

  // ---- 3) MIT Rang: dieselbe Kopfzeile nennt 25 -----------------------------------------------
  t = await spiel(browser, true);
  {
    const k = await kopfzeile(t.page);
    check('3-vorab: die Kopfzeile ist auch mit Rang da', !!k, k);
    check('3a: sie nennt mit Unterstuetzer-Rang die Grenze 25', !!k && /\(0\/25\)/.test(k), k);
    // Die Gegenrichtung zu 2a: Waere die Zahl weiterhin fest verdrahtet, stuende hier 10.
    check('3b: und eben NICHT mehr die alte feste 10', !!k && !/\/10\)/.test(k), k);
  }
  await t.ctx.close();

  await browser.close();
  ende();
})();

// GEGENPROBE, in beide Richtungen gefahren:
//   - Am Stand v8.545.0 (vor dieser Aenderung) fallen 1b (zwei Zeilen mit blanker Zahl, der
//     Fehlschlag nennt sie mit Zeilennummer), 1c, 1d, 1e sowie 3a/3b (Kopfzeile meldet auch mit
//     Rang "/10") und 4b (Stufe 29 wird klaglos eingereiht, Kopfzeile springt auf 2).
//     Die Zahl der gelaufenen Pruefungen ist dort dieselbe wie am gruenen Stand - keine haengt
//     hinter einer anderen, es gibt also keine still uebersprungene (Arbeitsregel 34).
//   - 2a bleibt an beiden Staenden gruen, und das ist Absicht: Ohne Rang ist die richtige Antwort
//     zufaellig dieselbe wie die fest verdrahtete. Genau deshalb steht 3a daneben - eine Pruefung,
//     die nur den Fall misst, in dem beide Lesarten uebereinstimmen, belegt nichts (Regel 26).
