// Kein Eintrag der beiden Warteschlangen verschwindet still (Spieler-Report 14.09.2026:
// "Wenn Updates kommen, wird die Bauschlange gelöscht und auch die Forschungsschlange").
//
// DIE FEHLERKLASSE, gemessen: Bau-Wunschliste und Forschungs-Warteschlange sind die einzigen zwei
// Listen im Spiel, aus denen Einträge OHNE Meldung verschwanden - und geprüft werden sie
// ausgerechnet im Ladepfad: applyOfflineProgress() arbeitet beide gegen die frisch ausgelieferten
// Tabellen ab, und vierzehn Zeilen später schreibt load() das Ergebnis fest. Ändert ein Update
// eine Voraussetzung oder eine Maximalstufe, ist der Eintrag weg, bevor ihn jemand sehen konnte.
// Genau das ist der eine Unterschied, den nur ein Update hat.
//
// DIE REGEL, die hier bewacht wird - nicht der Wortlaut einer Meldung:
//   VORÜBERGEHEND gesperrt (Voraussetzung fehlt, keine Allianz) -> Eintrag BLEIBT, mit Meldung,
//                                                                  die Schlange läuft weiter
//   ENDGÜLTIG erledigt (Schlüssel weg, Maximalstufe erreicht)   -> Eintrag geht, mit Meldung
//   In keinem Fall verschwindet etwas stumm.
//
// GEGENPROBE (gemessen, beide Richtungen, Prüfnamen beider Läufe per diff verglichen - identisch):
//   neuer Stand -> Exit 0, alle 14 Prüfungen grün
//   alter Stand -> Exit 1, GENAU diese zehn fallen
//     0-anker / 0a  techUnlockedGeneric las nur die Zeichenketten-Form
//     1 (beide)     der gesperrte Bau-Eintrag war weg  -> buildQueue []   UND kein Wort dazu
//     2 (Meldung)   entfernt, aber stumm
//     3 (beide)     der gesperrte Forschungs-Eintrag war weg -> researchQueue [] UND kein Wort dazu
//     4 (Meldung)   entfernt, aber stumm
//     5 (Meldung)   entfernt, aber stumm
//     6 (zweite)    der gesperrte Eintrag war beim Vorziehen des nächsten gleich mit verschwunden
//   Die vier, die an BEIDEN Ständen grün sind (2/4/5 "wird entfernt", 6 "blockiert nicht"), sind
//   die Gegenprobe zur Reparatur selbst: Endgültig erledigte Einträge sollen weiterhin gehen, und
//   die Schlange darf durch das Stehenlassen nicht stillstehen. Ohne sie wäre ein Wächter grün,
//   der einfach nichts mehr entfernt.
//   Alter Stand: KEPLER_SPIELDATEI=<kopie von HEAD> node tests/test_warteschlangen_stiller_wegwurf.js
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

const FILE = SPIEL_URL;
const MEIN_ID = 'u';
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ---------------------------------------------------------------- statisch: die Datenform
// techUnlockedGeneric las jede Voraussetzung als blossen Schlüssel. Eine Voraussetzung in
// Objektform wäre damit NIE erfüllt gewesen - und der Aufrufer hätte den Eintrag gelöscht.
// Heute benutzt BUILDING_DEFS die Objektform kein einziges Mal, die Falle war also latent.
// Geprüft wird die REGEL (beide Leser gehen über denselben Normalisierer), nicht der Bestand.
{
  const html = fs.readFileSync(SPIELDATEI, 'utf8');
  const m = html.match(/function techUnlockedGeneric\(requires\)\{[\s\S]{0,400}?\n  \}/);
  check('0-anker: techUnlockedGeneric ist auffindbar (sonst misst 0a nichts)', !!m);
  check('0a: techUnlockedGeneric normalisiert die Voraussetzung wie techUnlocked',
    !!m && /techVoraussetzung\(req\)/.test(m[0]) && />=\s*v\.level/.test(m[0]),
    m ? m[0].replace(/\s+/g, ' ').slice(0, 130) : null);
}

function backend(store){ return async r => {
  const req = r.request(); const u = new URL(req.url()); const p = u.pathname.split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: MEIN_ID, username: 'Schlangentest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p === 'storage-list') { const prefix = u.searchParams.get('prefix') || ''; return j({ keys: Object.keys(store).filter(k => k.startsWith(prefix) && !k.startsWith('__v:')) }); }
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){
      try { const body = JSON.parse(req.postData() || '{}'); store[k] = body.value; store['__v:'+k] = (store['__v:'+k]||0)+1; } catch(e){}
      return j({ ok: true, version: store['__v:'+k] });
    }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: store['__v:'+k]||1 });
    return j({ e: 1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

// Absichtlich ARM: sonst wäre "abgearbeitet" nicht von "weggeworfen" zu unterscheiden.
const stand = (extra) => JSON.stringify(Object.assign({
  tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: {},
  resources: { energie: 5, erz: 5, kristalle: 0, deuterium: 0, antimaterie: 0, forschungspunkte: 0 },
  buildings: { solar: 1, mine: 1, labor: 1 }, research: {},
  fleet: { jaeger: 0, missions: [] }, colonies: {}, activeBasePlanet: 'home',
  player: { id: MEIN_ID, name: 'Schlangentest', allianceTag: null, avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 0, buffs: [],
  colonyNames: {}, modules: {}, shipModules: {}, equippedShipModules: {}
}, extra));

// Transiente Meldungen: den EREIGNISVERLAUF mitschneiden, nicht den späteren DOM-Endzustand.
// #log trägt immer nur die letzte Zeile, und Toasts räumen sich nach Sekunden selbst weg.
const MITSCHNITT = () => {
  window.__mz = [];
  /* Zwei Fallen, beide gemessen:
     - Zu FRÜH beobachten geht nicht: Zum Zeitpunkt des Init-Skripts gibt es document.documentElement
       noch nicht, observe() wirft dann "parameter 1 is not of type 'Node'" - und der Test wäre
       still ohne Beobachter gelaufen (erst rot, dann bei jeder Reparatur weiter rot, ohne Grund).
     - Zu SPÄT beobachten geht auch nicht: Die Meldungen dieses Tests entstehen im Ladepfad.
     readystatechange auf 'interactive' liegt dazwischen: documentElement steht, das Spielskript
     (am Ende des Body) hat seinen Ladevorgang noch vor sich. */
  const start = () => {
    if (window.__mzAn) return; window.__mzAn = true;
    new MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && n.classList && n.classList.contains('toast')) window.__mz.push((n.textContent || '').trim());
    } }).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) start();
  else document.addEventListener('readystatechange', start, true);
};
/* Die EINZELNEN Meldungen, nie den zusammengefügten Strom: Ein Muster über den Strom kann quer
   über zwei verschiedene Toasts treffen ("Nanolegierungsfabrik" aus dem einen, "fehlt" aus einem
   Ereignis-Toast) und wäre dann aus dem falschen Grund grün. Gemessen: Im Ladepfad feuern
   Planeten-Ereignisse und Sektor-Events mit, der Strom ist nie leer. */
const meldungen = () => (window.__mz || []);
const trifft = (liste, re) => liste.some(m => re.test(m));

async function laden(browser, extra){
  const store = { 'kepler7-save-v3': stand(extra) };
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
  const page = await ctx.newPage();
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.addInitScript(MITSCHNITT);
  await page.goto(FILE);
  await page.waitForTimeout(4000);
  await page.evaluate(() => { ['welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.waitForTimeout(2500);   // die gewichteten Toasts warten hinter Overlays
  return { ctx, page, store };
}
const gespeichert = (store) => { try { return JSON.parse(store['kepler7-save-v3']); } catch(e){ return {}; } };

(async () => {
  const browser = await starteBrowser();

  // ======================================================= 1) Bau: Voraussetzung fehlt
  // nanolegierungsfabrik verlangt rnanotech - state.research ist leer.
  {
    const { ctx, page, store } = await laden(browser, {
      buildQueue: [{ planet: 'home', key: 'nanolegierungsfabrik' }, { planet: 'home', key: 'solar' }]
    });
    const s = gespeichert(store);
    check('1: gesperrter Bau-Eintrag bleibt in der Wunschliste stehen',
      (s.buildQueue||[]).some(q => q.key === 'nanolegierungsfabrik'), (s.buildQueue||[]).map(q=>q.key));
    const m1 = await page.evaluate(meldungen);
    check('1: und der Spieler erfährt, warum - in EINER Meldung',
      trifft(m1, /Nanolegierungsfabrik.*wartet.*fehlt/), m1.filter(m => /Nanolegierung/.test(m)));
    await ctx.close();
  }

  // ======================================================= 2) Bau: Standort weg (endgültig)
  {
    const { ctx, page, store } = await laden(browser, {
      buildQueue: [{ planet: 'gibtsnicht', key: 'solar' }]
    });
    const s = gespeichert(store);
    check('2: Eintrag für einen verlorenen Standort wird entfernt',
      !(s.buildQueue||[]).some(q => q.planet === 'gibtsnicht'), (s.buildQueue||[]).map(q=>q.planet+':'+q.key));
    const m2 = await page.evaluate(meldungen);
    check('2: und das wird gemeldet - in EINER Meldung',
      trifft(m2, /Bau-Wunschliste entfernt.*Standort/), m2.filter(m => /Wunschliste/.test(m)));
    await ctx.close();
  }

  // ======================================================= 3) Forschung: Voraussetzung fehlt
  // rsolar2 verlangt rsolar Stufe 5 - state.research ist leer.
  {
    const { ctx, page, store } = await laden(browser, { researchQueue: ['rsolar2'] });
    const s = gespeichert(store);
    check('3: gesperrter Forschungs-Eintrag bleibt stehen',
      (s.researchQueue||[]).includes('rsolar2'), s.researchQueue);
    const m3 = await page.evaluate(meldungen);
    check('3: und der Spieler erfährt, was fehlt - in EINER Meldung',
      trifft(m3, /Photonenkollektoren.*wartet.*Solarzellen Stufe 5/), m3.filter(m => /Photonenkoll/.test(m)));
    await ctx.close();
  }

  // ======================================================= 4) Forschung: Maximalstufe (endgültig)
  {
    const { ctx, page, store } = await laden(browser, { research: { rsolar: 20 }, researchQueue: ['rsolar'] });
    const s = gespeichert(store);
    check('4: Eintrag auf Maximalstufe wird entfernt', !(s.researchQueue||[]).includes('rsolar'), s.researchQueue);
    const m4 = await page.evaluate(meldungen);
    check('4: und das wird gemeldet - in EINER Meldung',
      trifft(m4, /Maximalstufe.*Forschungs-Warteschlange entfernt/), m4.filter(m => /Maximalstufe/.test(m)));
    await ctx.close();
  }

  // ======================================================= 5) Forschung: Schlüssel unbekannt
  {
    const { ctx, page, store } = await laden(browser, { researchQueue: ['rgibtsnichtmehr'] });
    const s = gespeichert(store);
    check('5: unbekannter Forschungs-Eintrag wird entfernt',
      !(s.researchQueue||[]).includes('rgibtsnichtmehr'), s.researchQueue);
    const m5 = await page.evaluate(meldungen);
    check('5: und das wird gemeldet - in EINER Meldung',
      trifft(m5, /rgibtsnichtmehr.*Forschungs-Warteschlange entfernt/), m5.filter(m => /rgibtsnicht/.test(m)));
    await ctx.close();
  }

  // ======================================================= 6) die Schlange steht nicht still
  // Der gesperrte Eintrag steht VORNE. Dahinter etwas Bezahlbares - das muss trotzdem laufen,
  // sonst wäre "stehen lassen" nur eine andere Art, die Liste zu verlieren.
  {
    const { ctx, page, store } = await laden(browser, {
      resources: { energie: 5000, erz: 5000, kristalle: 5000, deuterium: 5000, antimaterie: 0, forschungspunkte: 5000 },
      buildings: { solar: 1, mine: 1, labor: 1 },
      buildQueue: [{ planet: 'home', key: 'nanolegierungsfabrik' }, { planet: 'home', key: 'solar' }]
    });
    const s = gespeichert(store);
    check('6: der gesperrte Eintrag blockiert die Wunschliste nicht',
      (s.buildings||{}).solar > 1, { solar: (s.buildings||{}).solar, rest: (s.buildQueue||[]).map(q=>q.key) });
    check('6: und der gesperrte Eintrag ist dabei NICHT verschwunden',
      (s.buildQueue||[]).some(q => q.key === 'nanolegierungsfabrik'), (s.buildQueue||[]).map(q=>q.key));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? 'FAIL - Warteschlangen stiller Wegwurf' : 'OK - Warteschlangen stiller Wegwurf');
  process.exit(fail ? 1 : 0);
})();
