// Der Spender-Bereich im Fortschritt-Tab und die kostenlose Testphase (15.08.2026).
//
// WAS HIER GEPRUEFT WIRD - und warum es nicht als Textsuche im Quelltext geht:
//
// 1) Die Vorteilsliste nennt ihre KOSTEN aus den Konstanten. `desc` ist bewusst eine FUNKTION,
//    weil AUTO_REINFORCE_COST_KERNE (~25.100) und AUTO_REPAIR_COST_KERNE (~49.100) weit hinter
//    der Liste (~4.170) stehen: Eine direkt zusammengebaute Zeichenkette haette sie in ihrer
//    Temporal Dead Zone erwischt und das Spiel beim Laden mit einem ReferenceError getoetet.
//    Ein Blick in den Quelltext wuerde das NICHT zeigen - dort sieht beides gleich aus. Der Test
//    laedt die Datei deshalb im Browser und liest, was der Spieler wirklich sieht.
//
// 2) Der Testphase-Knopf schaltet die Automatiken WIRKLICH frei. Geprueft wird nicht der Text der
//    Box, sondern die Wirkung am anderen Ende des Spiels: der Schalter "Automatische Verstaerkung"
//    im Verteidigung-Tab verliert seine Sperrbeschriftung. Eine Box, die "aktiv" behauptet,
//    waehrend die Schalter weiter gesperrt sind, ist genau der Fehlertyp aus CLAUDE.md-Regel 6.
//
// 3) Ohne Freigabe zeigt die Box die Vorteile TROTZDEM vollstaendig (mit Schloss). Das ist der
//    ganze Zweck des Bereichs - eine Werbeflaeche, die verschweigt, wofuer sie wirbt, war der
//    Zustand VOR dieser Aenderung.
//
// 4) Eine Ablehnung des Servers (409, Testphase verbraucht) landet sichtbar in der Box statt still
//    verschluckt zu werden. Der Wert `trial.verfuegbar` stammt aus dem letzten /api/me und kann
//    veraltet sein; die Antwort des Servers ist die Wahrheit.
//
// GEGENPROBE, in beide Richtungen ausgefuehrt (15.08.2026):
//   Gegen den alten Stand (git show HEAD:weltraum_kolonie.html):
//     FAIL - 1: Spender-Bereich existiert                        | null
//     ... alle folgenden Pruefungen rot, da #supporterHubBox fehlt.
//   Gegen eine Kopie mit `desc:'...'+AUTO_REPAIR_COST_KERNE+'...'` statt `desc:()=>...`:
//     Das Spiel startet gar nicht mehr (ReferenceError beim Laden), Pruefung "keine JS-Fehler"
//     und alle Inhaltspruefungen rot - genau der Fall, den Punkt 1 absichert.
//   Gegen den neuen Stand: alles gruen.

const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const SAVE = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9999, erz: 9999, kristalle: 9999, deuterium: 999, antimaterie: 99, forschungspunkte: 999, kikerne: 50 },
  buildings: { solar: 5, mine: 5 }, research: { rkitech: 1 }, fleet: { jaeger: 5, missions: [] }, colonies: {},
  activeBasePlanet: 'home', player: { id: 'u', name: 'Spendentest', allianceTag: '', avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 300, buffs: [], lastTick: Date.now(),
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

// Die Testphase-Antwort ist umschaltbar: `trialAntwort` bestimmt, was POST /api/supporter/trial
// liefert. So laesst sich der Erfolgsfall und die Ablehnung mit derselben Schale fahren.
function backend(opt){
  const store = { 'kepler7-save-v3': SAVE };
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: 'u', username: 'Spendentest', homeSystem: 'kepler', homeSlot: 0,
      attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true, supporter: opt.supporter });
    if (p === 'supporter/trial') return j(opt.trialAntwort.body, opt.trialAntwort.status);
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
      if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 });
      return j({ e: 1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
    return j({});
  };
}

const OHNE_RANG = { active: false, tier: null, exempt: false, until: 0, quelle: null,
  trial: { verfuegbar: true, genutztAm: 0, aktiv: false, bis: 0, tage: 5 } };
// Die Antwort, die der Server nach einem erfolgreichen Start schickt.
const NACH_START = {
  ok: true, tage: 5, bis: Date.now() + 5 * 86400000,
  supporter: { active: true, tier: null, exempt: false, until: Date.now() + 5 * 86400000, quelle: 'testphase',
    trial: { verfuegbar: false, genutztAm: Date.now(), aktiv: true, bis: Date.now() + 5 * 86400000, tage: 5 } }
};

async function oeffne(browser, opt){
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1400 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(opt));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="fortschritt"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}

// Alle Lesezugriffe bleiben auf den Container beschraenkt (CLAUDE.md-Regel 5): Die Wortmarken
// "Automatische Verstaerkung" &Co. stehen auch im Verteidigung-Tab und in den Hilfetexten.
const hubText = page => page.evaluate(() => {
  const el = document.getElementById('supporterHubBox');
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
});
// Der Sperrzustand am ANDEREN Ende des Spiels - die eigentliche Wirkung.
const verteidigungsSchalter = page => page.evaluate(() => {
  const l = document.getElementById('autoReinforceLabel');
  const row = document.getElementById('autoReinforceRow');
  return { text: l ? l.textContent.replace(/\s+/g, ' ').trim() : null,
           gesperrt: row ? row.classList.contains('research-locked') : null };
});

(async () => {
  const browser = await starteBrowser();

  // ---- Teil 1: ohne Rang -----------------------------------------------------------------------
  const a = await oeffne(browser, { supporter: OHNE_RANG, trialAntwort: { status: 200, body: NACH_START } });
  const t1 = await hubText(a.page);
  check('1: Spender-Bereich existiert', !!t1, t1 ? t1.slice(0, 60) : null);
  check('1: er sagt, dass die Vorteile gerade NICHT laufen', /nicht aktiv/i.test(t1 || ''), (t1 || '').slice(0, 90));
  for (const name of ['Automatische Verstärkung', 'Automatische Reparatur', 'KI-Abfangautomatik']){
    check('1: Vorteil trotz fehlender Freigabe genannt: ' + name, (t1 || '').includes(name));
  }
  // Die Kosten stehen als ZAHL da - also hat desc() ausgewertet und die Konstante gefunden.
  // Geprueft wird die REGEL "jeder der drei Texte nennt seine KI-Kern-Kosten", nicht die Zahl 3
  // (CLAUDE.md-Regel 3): Der Test soll bei einer Kostenaenderung nicht mitgepflegt werden muessen,
  // aber bei einer verschwundenen Kostenangabe anschlagen.
  check('1: die Vorteilstexte nennen ihre KI-Kern-Kosten als Zahl',
    ((t1 || '').match(/\d+ KI-Kerne/g) || []).length >= 3, (t1 || '').match(/\d+ KI-Kerne/g));
  check('1: der Testphase-Knopf wird angeboten',
    await a.page.evaluate(() => !!document.querySelector('#supporterHubBox #supporterTrialBtn')));
  check('1: der Verteidigungs-Schalter ist wirklich gesperrt',
    (await verteidigungsSchalter(a.page)).gesperrt === true);
  check('1: keine JS-Fehler', a.errs.length === 0, a.errs.slice(0, 3));

  // ---- Teil 2: Knopf druecken - schaltet er die Automatiken wirklich frei? ---------------------
  await a.page.evaluate(() => { const b = document.querySelector('#supporterHubBox #supporterTrialBtn'); if (b) b.click(); });
  await a.page.waitForTimeout(1200);
  const t2 = await hubText(a.page);
  const schalter = await verteidigungsSchalter(a.page);
  check('2: die Box meldet die laufende Testphase', /Testphase läuft/i.test(t2 || ''), (t2 || '').slice(0, 120));
  check('2: der Knopf ist weg', await a.page.evaluate(() => !document.querySelector('#supporterHubBox #supporterTrialBtn')));
  check('2: WIRKUNG - der Verteidigungs-Schalter ist nicht mehr gesperrt', schalter.gesperrt === false, schalter);
  check('2: und seine Beschriftung nennt nicht mehr den Sperrgrund',
    !/vorbehalten/.test(schalter.text || ''), (schalter.text || '').slice(0, 90));
  check('2: keine JS-Fehler nach dem Klick', a.errs.length === 0, a.errs.slice(0, 3));
  await a.ctx.close();

  // ---- Teil 3: Ablehnung des Servers wird gezeigt, nicht verschluckt ---------------------------
  // trial.verfuegbar sagt hier true (veralteter Stand aus /api/me), der Server lehnt trotzdem ab.
  const b = await oeffne(browser, { supporter: OHNE_RANG,
    trialAntwort: { status: 409, body: { error: 'Die Testphase wurde für dieses Konto bereits genutzt.' } } });
  await b.page.evaluate(() => { const el = document.querySelector('#supporterHubBox #supporterTrialBtn'); if (el) el.click(); });
  await b.page.waitForTimeout(1200);
  const t3 = await hubText(b.page);
  const stelle = (t3 || '').indexOf('bereits genutzt');
  check('3: die Ablehnung des Servers steht in der Box', stelle >= 0, (t3 || '').slice(Math.max(0, stelle - 70), stelle + 30));
  // Der Server hat damit auch gesagt, dass der lokale Wert `trial.verfuegbar` veraltet war - der
  // Knopf darf danach nicht zum naechsten vergeblichen Klick einladen.
  check('3: der veraltete Knopf verschwindet nach der Ablehnung',
    await b.page.evaluate(() => !document.querySelector('#supporterHubBox #supporterTrialBtn')));
  check('3: und die Automatiken bleiben gesperrt', (await verteidigungsSchalter(b.page)).gesperrt === true);
  check('3: keine JS-Fehler', b.errs.length === 0, b.errs.slice(0, 3));
  await b.ctx.close();

  // ---- Teil 4: mit echtem Rang steht die Quelle da ---------------------------------------------
  const c = await oeffne(browser, {
    supporter: { active: true, tier: 'silver', exempt: false, granted: false, until: Date.now() + 12 * 86400000,
      quelle: 'kofi', trial: { verfuegbar: true, genutztAm: 0, aktiv: false, bis: 0, tage: 5 } },
    trialAntwort: { status: 200, body: NACH_START } });
  const t4 = await hubText(c.page);
  check('4: bei echtem Rang wird die Quelle benannt', /Ko-fi-Spende/.test(t4 || ''), (t4 || '').slice(0, 120));
  check('4: und die Restlaufzeit steht daneben', /noch 12 Tage/.test(t4 || ''), (t4 || '').slice(0, 120));
  // Ein Spender, dessen Spende ablaeuft, soll seine Testphase noch haben - sie darf ihm also auch
  // hier angeboten werden. (Der Server meldet verfuegbar:true unabhaengig vom Rang.)
  check('4: die ungenutzte Testphase wird auch Spendern noch angeboten',
    await c.page.evaluate(() => !!document.querySelector('#supporterHubBox #supporterTrialBtn')));
  check('4: keine JS-Fehler', c.errs.length === 0, c.errs.slice(0, 3));
  await c.ctx.close();

  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
