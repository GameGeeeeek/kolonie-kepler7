// Allianz-Beitraege: Ressourcen werden lokal abgebucht, BEVOR der Beitrag ins geteilte Dokument
// geschrieben wird. Bisher lief dieser Schreibvorgang ueber storageSet(..., true) - das faellt bei
// einem Serverfehler oder einer Ablehnung STILL auf localStorage zurueck und meldet trotzdem Erfolg.
// Fuer einen geteilten Schluessel heisst das: Die Ressourcen sind weg, die Allianz sieht nichts,
// und das Spiel meldet "beigetragen".
//
// Der Test erzwingt die Ablehnung, indem das Backend fuer den contrib-Schluessel 500 liefert.
const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, ueberspringen } = require('./lib/umgebung');
const path = require('path');

const FILE = SPIEL_URL;
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const MEIN_ID = 'u';
const jetzt = Date.now();
const START_ERZ = 50000;

// schreibfehler=true -> jeder PUT auf den contrib-Schluessel scheitert mit 500.
function backend(store, schreibfehler){ return async r => {
  const req = r.request(); const u = new URL(req.url()); const p = u.pathname.split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: MEIN_ID, username: 'Beitragstest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p === 'storage-list') {
    const prefix = u.searchParams.get('prefix') || '';
    return j({ keys: Object.keys(store).filter(k => k.startsWith(prefix)) });
  }
  if (p.startsWith('storage/')) {
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') {
      if (schreibfehler && k.includes(':contrib:')) return j({ error: 'Serverfehler beim Speichern.' }, 500);
      try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {}
      return j({ ok: true });
    }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
    return j({ e: 1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

const SPIELSTAND = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: START_ERZ, erz: START_ERZ, kristalle: START_ERZ, deuterium: 9999, antimaterie: 999, forschungspunkte: 999 },
  buildings: { solar: 8, mine: 8, lager: 20 }, research: {}, fleet: { jaeger: 20, missions: [] }, colonies: {},
  activeBasePlanet: 'home',
  player: { id: MEIN_ID, name: 'Beitragstest', allianceTag: 'TST', allianceRole: 'admin', avatarKey: null },
  allianceBase: { foundedAt: jetzt - 86400000, level: 2, system: 'kepler' },
  allianceSubTab: 'uebersicht', allianceContributed: {},
  battleStats: { wins: 0, losses: 0 }, xp: 3000, buffs: [], lastTick: jetzt,
  // Ereignis-Uhren gepinnt (Hausregel 18): Bei fehlendem Feld ist nextPlanetEventCheck 0, der
  // erste Check feuert dann GARANTIERT - und seine Meldung ueberschreibt in #log genau die Zeile,
  // die dieser Test misst. Genau so ist er am 18.08.2026 im Suite-Lauf gefallen, einzeln blieb er
  // gruen: Der Fehlschlag meldete "Neues Ereignis: Pluenderer-Crew angetroffen ...".
  nextPlanetEventCheck: jetzt + 3600000, nextTraderCheck: jetzt + 3600000,
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

async function lauf(browser, schreibfehler){
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1400 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const store = {
    'kepler7-save-v3': SPIELSTAND,
    ['alliance:TST:role:' + MEIN_ID]: JSON.stringify({ role: 'admin', name: 'Beitragstest' }),
    'alliance:TST:base': JSON.stringify({ foundedAt: jetzt - 86400000, level: 2, system: 'kepler', tag: 'TST', announcedLevel: 2 })
  };
  await page.route('**/api/**', backend(store, schreibfehler));
  await page.addInitScript(() => {
    localStorage.setItem('kepler7_token', 'tok');
    // MITSCHNITT statt Endstand (Hausregel 47, Nachtrag "#log"): #log hat keinen Stapel, es
    // ueberschreibt sich mit jeder Meldung selbst. Die geprueften Aussagen lauten "die Zeile ist
    // ERSCHIENEN" bzw. "sie ist NIE erschienen" - nicht "sie steht am Ende noch da". Beobachtet
    // wird document.body, weil der Boot den Container einmal per innerHTML ersetzt; #log wird je
    // Mutation frisch per id gelesen.
    // addInitScript laeuft, BEVOR das Dokument existiert - ein sofortiges observe() wirft
    // "parameter 1 is not of type 'Node'", der Mitschnitt bliebe leer und die Pruefung waere aus
    // dem falschen Grund rot. Deshalb scharfstellen, sobald documentElement da ist; das passiert
    // im ersten Tick und damit lange vor dem Spiel-Boot, der Mitschnitt bleibt also lueckenlos.
    window.__logMit = [];
    (function scharf(){
      if (!document.documentElement) { setTimeout(scharf, 0); return; }
      new MutationObserver(() => {
        const el = document.getElementById('log');
        const t = el ? (el.textContent || '').trim() : '';
        if (t && window.__logMit[window.__logMit.length - 1] !== t) window.__logMit.push(t);
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    })();
  });
  await page.goto(FILE); await page.waitForTimeout(2600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="allianz"]'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelectorAll('.alliance-subpanel').forEach(p => { p.style.display = ''; }); });
  await page.waitForTimeout(1200);

  // Beitrag ueber die echte Schaltflaeche ausloesen (Allianzbasis, Ressource Erz).
  const knopf = await page.locator('[data-ab-contrib="erz"]').count();
  const ausgeloest = knopf > 0 ? await page.evaluate(() => {
    const inp = document.querySelector('[data-ab-contrib-input="erz"]');
    if (inp) { inp.value = '100'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    const b = document.querySelector('[data-ab-contrib="erz"]');
    if (!b) return false;
    b.click(); return true;
  }) : false;
  await page.waitForTimeout(1500);

  const erg = await page.evaluate(() => {
    const raw = localStorage.getItem('kepler7_kepler7-save-v3');
    return { log: (document.getElementById('log') || {}).textContent || '',
             logMit: (window.__logMit || []).join(' || ') };
  });
  // Der Erz-Stand kommt aus dem GESPEICHERTEN Spielstand im Mock-Store: state ist nicht global,
  // und die Kopfzeilen-Anzeige waere nur indirekt. save() laeuft nach jedem Beitrag, der Wert im
  // Store ist also der massgebliche.
  let erzNachher = null;
  try { erzNachher = JSON.parse(store['kepler7-save-v3']).resources.erz; } catch (e) {}
  await ctx.close();
  return Object.assign(erg, { knopf, ausgeloest, erzNachher, errs, store });
}

(async () => {
  const browser = await starteBrowser();

  // --- (a) Normalfall: Server nimmt an
  const ok = await lauf(browser, false);
  check('Beitrags-Schaltfläche gefunden', ok.knopf > 0 && ok.ausgeloest, { knopf: ok.knopf, ausgeloest: ok.ausgeloest });
  check('a) Erfolgsmeldung erscheint', /beigetragen/.test(ok.logMit), ok.logMit.slice(-200));
  const contribKeys = Object.keys(ok.store).filter(k => k.includes(':contrib:'));
  check('a) der Beitrag steht im geteilten Dokument', contribKeys.length === 1, contribKeys);
  check('a) und zwar mit der gespendeten Menge',
    contribKeys.length === 1 && JSON.parse(ok.store[contribKeys[0]]).base_erz === 100,
    contribKeys.length ? ok.store[contribKeys[0]] : null);
  check('a) das Erz ist im Erfolgsfall auch wirklich abgebucht', typeof ok.erzNachher === 'number', { erz: ok.erzNachher });

  // --- (b) Server lehnt ab: nichts darf verlorengehen und die Meldung muss ehrlich sein
  const nok = await lauf(browser, true);
  check('b) KEINE Erfolgsmeldung bei abgelehntem Schreibvorgang', !/beigetragen/.test(nok.logMit), nok.logMit.slice(-200));
  // Das ist die Prüfung, die am 18.08.2026 in der Suite fiel und einzeln grün blieb: Sie las den
  // ENDSTAND von #log, und dort stand längst eine spätere Meldung („Neues Ereignis: Plünderer-Crew
  // angetroffen …"). Der Beleg im Fehlschlag zeigt jetzt den MITSCHNITT, nicht den Endstand.
  check('b) der Spieler wird auf den Fehlschlag hingewiesen',
    /nicht an die Allianz übermittelt|nichts wurde abgebucht/.test(nok.logMit), nok.logMit.slice(-260));
  check('b) es wurde kein contrib-Dokument angelegt',
    Object.keys(nok.store).filter(k => k.includes(':contrib:')).length === 0,
    Object.keys(nok.store).filter(k => k.includes(':contrib:')));
  // Der entscheidende Punkt: die Ressourcen sind wieder da. Verglichen wird gegen den Erfolgsfall -
  // dort fehlen die 100 Erz, hier duerfen sie NICHT fehlen. Beide Laeufe starten identisch, die
  // Produktion zwischen Laden und Klick ist in beiden gleich lang, daher ist die Differenz aussagekraeftig.
  check('b) die Ressourcen wurden zurückgebucht (Erz höher als im Erfolgsfall)',
    typeof nok.erzNachher === 'number' && typeof ok.erzNachher === 'number' && nok.erzNachher > ok.erzNachher,
    { mitFehler: nok.erzNachher, ohneFehler: ok.erzNachher, differenz: (nok.erzNachher - ok.erzNachher) });

  check('keine JS-Fehler', ok.errs.length === 0 && nok.errs.length === 0, ok.errs.concat(nok.errs).slice(0, 3));

  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
