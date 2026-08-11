// Zwei Clients wollen im selben Augenblick den nächsten Weltboss setzen – wer verliert, darf
// danach keinen Boss anzeigen oder ansagen, den es auf dem Server gar nicht gibt.
//
// Hintergrund: `worldboss:current` nimmt seit v8.483.0 serverseitig nur noch den ersten Spawn und
// den Respawn nach einem gefallenen Boss an (checkWorldBossPermission in server.js, dort steht die
// ausführliche Begründung). Damit bekommt beim gleichzeitigen Respawn genau ein Client 403.
//
// Der Haken lag in storageSet(): Bei einer Ablehnung fällt es STILL auf den lokalen Speicher
// zurück und meldet Erfolg. Der Verlierer hätte danach seinen selbst gebauten Boss im Cache – mit
// einer bossId, die auf dem Server nicht existiert. Eine Mission dorthin kommt in
// /api/worldboss/resolve als „zu spät angekommen" heraus (der Endpunkt vergleicht
// `boss.bossId !== mission.targetId`) und zahlt 50 Kredite Trostpreis statt eines Kampfes.
//
// ZWEI WEGE FÜHREN IN DENSELBEN FEHLER, und der Test prüft beide:
//   A) Der Server LEHNT AB (403) – der Boss des Gewinners steht schon da.
//   B) Die VERBINDUNG REISST AB – niemand weiß, was auf dem Server steht.
// (B) kam erst durch die Durchsicht von PR #331 dazu und war im ersten Entwurf offen: Dort stand
// ein umschließendes `try` mit `return b` dahinter, ein Netzfehler reichte den unbestätigten
// eigenen Boss also durch. Seither gilt: Nur ein BESTÄTIGTES Schreiben macht den eigenen Boss
// gültig, jeder andere Ausgang liefert nichts.
//
// GEMESSEN WIRD DIE ANSAGE, NICHT DIE ANZEIGE. Die erste Fassung dieses Tests prüfte den Inhalt
// der Weltboss-Box – und war wertlos: Sie war am ALTEN Stand genauso grün. Grund: loadWorldBoss()
// läuft bei jedem Bestenlisten-Durchlauf erneut, holt sich dabei den echten Boss und überschreibt
// den lokalen Notnagel. Die Anzeige heilt sich also von selbst, und der Unterschied lebt nur in dem
// Fenster zwischen der abgelehnten Schreibung und dem nächsten Abruf. Was dagegen BLEIBT, ist die
// Ansage, die in genau diesem Fenster herausgeht: „<Name> - Stufe 7 ist erschienen!" für einen Boss,
// den es nie gab. Das ist die zweite Anzeigestelle mit der alten Annahme, vor der CLAUDE.md warnt,
// und sie ist dauerhaft nachweisbar – der Test sammelt alle Meldungen über einen MutationObserver.
//
// GEGENPROBE (beide Richtungen, 10.08.2026):
//   Gegen `git show HEAD:weltraum_kolonie.html`: A meldet „Stufe 7", B meldet „Stufe 7".
//   Gegen den neuen Stand: A meldet „Stufe 20" (den echten), B meldet gar nichts.
//   Die Kontrollprüfungen (Unterreiter offen, Box gefüllt, keine Konsolenfehler) sind in BEIDEN
//   Läufen grün – der Test misst den Unterschied.

const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

const SAVE = {
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9e5, erz: 9e5, kristalle: 6e5, deuterium: 4e5, antimaterie: 2e4, forschungspunkte: 3e4 },
  buildings: { solar: 22, mine: 20, labor: 14, lager: 16, werft: 14 }, research: {},
  fleet: { jaeger: 600, cruisers: 200, spaeher: 20, missions: [] }, colonies: {}, activeBasePlanet: 'home',
  player: { id: 'u', name: 'A', avatarKey: null }, prestige: 2, xp: 260000, credits: 180000,
  buffs: [], lastTick: Date.now(), colonyNames: {}
};

// Der gefallene Boss, den der Client zuerst sieht. Die Frist (10 Minuten) ist abgelaufen, also
// baut er sich einen Nachfolger auf Stufe 7 und versucht ihn zu schreiben.
const GEFALLEN = { bossId: 'wb6_alt', level: 6, maxHp: 524288, hp: 0,
  spawnedAt: Date.now() - 7200000, contributions: {}, defeatedAt: Date.now() - 20 * 60 * 1000 };
// Der Boss des Gewinners – Stufe 20, lebendig. Absichtlich weit weg von der 7, die der Client
// selbst gebaut hätte: Eine Verwechslung fiele sofort auf.
const GEWINNER = { bossId: 'wb20_gewinner', level: 20, maxHp: 2000000, hp: 1800000,
  spawnedAt: Date.now() - 30000, contributions: {}, defeatedAt: null };

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// Fährt einen kompletten Spielstart mit einer eigenen Behandlung des Boss-Schlüssels.
// `bossRoute(route, request, verlauf)` entscheidet, was auf PUT/GET geantwortet wird.
async function szenario(browser, bossRoute) {
  const saveStr = JSON.stringify(SAVE);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  const page = await ctx.newPage();
  const fehler = [];
  const verlauf = { bossGet: 0, bossPut: 0 };
  page.on('pageerror', e => fehler.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fehler.push(m.text()); });

  await page.route('**/api/**', async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
    if (p === 'storage/worldboss%3Acurrent' || p === 'storage/worldboss:current') return bossRoute(r, req, verlauf, j);
    if (p.startsWith('storage/')) {
      if (req.method() === 'PUT') return j({ ok: true });
      return j({ e: 1 }, 404);
    }
    if (p === 'galaxy') return j({ factions: {}, collapsedSystems: {}, controlledSystems: {}, news: [],
      activeWar: null, activeWormhole: null, npcEmpireStrength: 1, marketTrend: 1, lastTick: Date.now() });
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
    return j({});
  });

  // Jede Meldung mitschneiden, sobald sie als Einblendung im Dokument auftaucht. Muss VOR dem
  // Spielcode laufen, weil die Ansage schon 2,5 s nach dem Start herausgeht.
  await page.addInitScript(() => {
    window.__meldungen = [];
    const start = () => {
      new MutationObserver(muts => {
        for (const m of muts) for (const n of m.addedNodes) {
          if (n.nodeType === 1 && n.classList && n.classList.contains('toast')) window.__meldungen.push(n.textContent);
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
  });
  await page.addInitScript(s => {
    localStorage.setItem('kepler7-save-v3', s);
    localStorage.setItem('kepler7_token', 'tok');
  }, saveStr);

  await page.goto(SPIEL_URL);
  await page.waitForSelector('[data-tab="karte"]', { timeout: 20000 });
  await page.waitForTimeout(4000); // loadWorldBoss läuft 2,5 s nach dem Start
  await page.evaluate(() => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  await page.click('[data-tab="galaxie"]');
  await page.click('[data-galaxy-subtab="kampf"]');
  await page.waitForTimeout(2500);

  const offen = await page.evaluate(() => {
    const p = document.querySelector('.galaxy-subpanel[data-galaxy-sub="kampf"]');
    return !!p && p.style.display !== 'none';
  });
  const text = await page.evaluate(() => {
    const box = document.getElementById('worldBossBox');
    return box ? box.textContent.replace(/\s+/g, ' ') : null;
  });
  const meldungen = await page.evaluate(() => window.__meldungen || []);
  await ctx.close();
  return { offen, text, meldungen, verlauf, fehler };
}

(async () => {
  const browser = await starteBrowser();

  // ===== A) Der Server lehnt ab – der Boss des Gewinners steht schon da =========================
  {
    const a = await szenario(browser, (r, req, verlauf, j) => {
      if (req.method() === 'PUT') {
        verlauf.bossPut++;
        // Genau die Antwort, die der gehärtete Server dem Verlierer des Rennens gibt.
        return j({ error: 'Der laufende Weltboss wird nur über den Kampf verändert.' }, 403);
      }
      verlauf.bossGet++;
      // Erster Abruf: der gefallene Boss. Jeder weitere: der Boss des Gewinners.
      const doc = verlauf.bossGet === 1 ? GEFALLEN : GEWINNER;
      return j({ key: 'worldboss:current', value: JSON.stringify(doc), shared: true, version: 0 });
    });

    check('A: der Kampf-Unterreiter ist offen', a.offen);
    check('A: der Schreibversuch wurde unternommen und abgelehnt', a.verlauf.bossPut >= 1, a.verlauf);
    check('A: nach der Ablehnung wurde der echte Boss nachgelesen', a.verlauf.bossGet >= 2, a.verlauf);
    check('A: die Weltboss-Box ist gefüllt', !!a.text && a.text.length > 40, a.text && a.text.slice(0, 80));

    const erschienen = a.meldungen.filter(m => /ist erschienen/.test(m));
    check('A: es ging genau eine „ist erschienen"-Ansage heraus', erschienen.length === 1, erschienen);
    check('A: sie nennt den Boss, der wirklich dasteht (Stufe 20)',
      erschienen.some(m => /Stufe 20/.test(m)), erschienen);
    check('A: und NICHT den selbst gebauten, den es nie gab (Stufe 7)',
      !erschienen.some(m => /Stufe 7\b/.test(m)), erschienen);
    check('A: keine Konsolenfehler', a.fehler.length === 0, a.fehler.slice(0, 3));
  }

  // ===== B) Die Verbindung reisst ab – niemand weiss, was auf dem Server steht ==================
  // Hier gibt es keinen „echten Boss zum Nachlesen": Das GET liefert weiterhin den GEFALLENEN
  // Boss, weil unsere Schreibung den Server nie erreicht hat. Richtig ist deshalb, GAR NICHTS
  // anzusagen – nicht etwa den eigenen Entwurf.
  {
    const b = await szenario(browser, (r, req, verlauf, j) => {
      if (req.method() === 'PUT') { verlauf.bossPut++; return r.abort(); }
      verlauf.bossGet++;
      return j({ key: 'worldboss:current', value: JSON.stringify(GEFALLEN), shared: true, version: 0 });
    });

    check('B: der Kampf-Unterreiter ist offen', b.offen);
    check('B: der Schreibversuch wurde unternommen und scheiterte am Netz', b.verlauf.bossPut >= 1, b.verlauf);
    check('B: die Weltboss-Box ist gefüllt', !!b.text && b.text.length > 40, b.text && b.text.slice(0, 80));

    const erschienenB = b.meldungen.filter(m => /ist erschienen/.test(m));
    check('B: es wird ÜBERHAUPT KEIN neuer Boss angesagt', erschienenB.length === 0, erschienenB);
    check('B: insbesondere nicht der unbestätigte eigene (Stufe 7)',
      !b.meldungen.some(m => /Stufe 7\b/.test(m)), b.meldungen.filter(m => /Stufe 7\b/.test(m)));
    // Der alte Stand bleibt stehen: der gefallene Boss der Stufe 6, nicht ein lebender Stufe 7.
    check('B: die Box zeigt weiter den gefallenen Boss, keinen erfundenen lebenden',
      !!b.text && /BESIEGT/.test(b.text), b.text && b.text.slice(0, 110));
    check('B: keine Konsolenfehler', b.fehler.length === 0, b.fehler.slice(0, 3));
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles in Ordnung');
  process.exit(fail ? 1 : 0);
})();
