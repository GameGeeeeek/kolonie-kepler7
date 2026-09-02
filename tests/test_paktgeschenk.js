// Pakt-Geschenke kosten den Absender echte Ressourcen. Bis v8.298.4 wurde das geaenderte Pakt-Dokument
// mit storageSet(..., true) geschrieben - die faellt bei JEDER Nicht-OK-Antwort (403/413/507/500)
// still auf localStorage zurueck und liefert ein wahrheitswertiges Ergebnis. Folge: Ressourcen weg,
// Meldung "Geschenk gesendet", beim Partner kam nie etwas an - und der 24h-Cooldown lief trotzdem.
// Dieselbe Fehlerklasse, die bei den Allianz-Beitraegen in v8.298.2 behoben wurde (test_beitrag_strikt).
//
// Der Test erzwingt die Ablehnung, indem das Backend fuer den pact:-Schluessel 500 liefert, und
// vergleicht Erfolgs- und Fehlerlauf.
const { starteBrowser, SPIEL_URL, ruhigeUhren, logMitschnitt, logZeilen } = require('./lib/umgebung');

const FILE = SPIEL_URL;
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const MEIN_ID = 'u';
const GEGNER = 'gegner1';
const jetzt = Date.now();
const START = 50000;

// Ein aktiver Pakt der Stufe 2 (Handelsabkommen) ist Voraussetzung fuer Geschenke.
const PAKT = {
  a: MEIN_ID, b: GEGNER, aName: 'Geschenktest', bName: 'Nachbar',
  names: { [MEIN_ID]: 'Geschenktest', [GEGNER]: 'Nachbar' },
  status: 'active', acceptedAt: jetzt - 86400000, expiresAt: jetzt + 7 * 86400000,
  tier: 2, giftsClaimed: {}, giftCooldown: {}, pendingGifts: []
};

// schreibfehler=true -> jeder PUT auf einen pact:-Schluessel scheitert mit 500.
function backend(store, schreibfehler){ return async r => {
  const req = r.request(); const u = new URL(req.url()); const p = u.pathname.split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: MEIN_ID, username: 'Geschenktest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p === 'storage-list') {
    const prefix = u.searchParams.get('prefix') || '';
    return j({ keys: Object.keys(store).filter(k => k.startsWith(prefix)) });
  }
  if (p.startsWith('storage/')) {
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') {
      if (schreibfehler && k.startsWith('pact:')) return j({ error: 'Serverfehler beim Speichern.' }, 500);
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
  // Der Spread steht VORNE, damit alles Folgende gewinnt (die Einbau-Regel aus lib/umgebung):
  // Planeten-Ereignis, Haendler UND der Zufallsereignis-Riegel. Dieser Test hat den Vorfall im
  // Kommentar unten seit dem 04.08.2026 beschrieben und trotzdem nie gepinnt - er hat sich
  // stattdessen einen eigenen Mitschnitt gebaut, also die Folge behandelt statt der Ursache.
  ...ruhigeUhren(),
  tutorialSeen: true, newbieWelcomeSeen: true,
  // seenTabHints gesetzt, damit die Ersthinweis-Leiste (v8.298.3) hier nichts verdeckt.
  seenTabHints: { galaxie: true },
  resources: { energie: START, erz: START, kristalle: START, deuterium: 9999, antimaterie: 999, forschungspunkte: 999 },
  buildings: { solar: 8, mine: 8, lager: 20 }, research: {}, fleet: { jaeger: 20, missions: [] }, colonies: {},
  activeBasePlanet: 'home',
  player: { id: MEIN_ID, name: 'Geschenktest', allianceTag: null, avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 3000, buffs: [], lastTick: jetzt,
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 0
});

const PAKT_KEY = 'pact:' + [MEIN_ID, GEGNER].sort().join('_');

async function lauf(browser, schreibfehler){
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1500 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const store = { 'kepler7-save-v3': SPIELSTAND, [PAKT_KEY]: JSON.stringify(PAKT) };
  await page.route('**/api/**', backend(store, schreibfehler));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  // Der Mitschnitt haengt am DOKUMENT und laeuft ueber addInitScript VOR dem ersten Tick - der
  // eigene Beobachter dieses Tests sass am #log-KNOTEN und wurde erst nach dem Boot gesetzt
  // (Falle (b) im Kommentar von lib/umgebung): Wird der Container spaeter noch einmal ersetzt,
  // sammelt er am verwaisten Original weiter.
  await logMitschnitt(page);
  await page.goto(FILE); await page.waitForTimeout(2600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });

  // Diplomatie liegt im Galaxie-Unterreiter "diplo".
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="galaxie"]'); if (b) b.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const b = document.querySelector('[data-galaxy-subtab="diplo"]'); if (b) b.click(); });
  await page.waitForTimeout(1600);


  const knopf = await page.locator('#diplomacyBox [data-pact-gift-send]').count();
  if (!knopf) console.log('   [Debug] diplomacyBox:', await page.evaluate(() => { const b = document.getElementById('diplomacyBox'); return b ? b.innerText.slice(0, 250) : 'FEHLT'; }));
  // Erz auswaehlen (erste Option ist bereits Erz oder Energie - explizit setzen macht den Test stabil)
  const ausgeloest = knopf > 0 ? await page.evaluate(() => {
    const sel = document.querySelector('#diplomacyBox [data-pact-gift-res]');
    if (sel){ sel.value = 'erz'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    const b = document.querySelector('#diplomacyBox [data-pact-gift-send]');
    if (!b) return false;
    b.click(); return true;
  }) : false;
  await page.waitForTimeout(1800);

  const log = (await logZeilen(page)).join('\n');
  let erzNachher = null, gespeicherterPakt = null;
  try { erzNachher = JSON.parse(store['kepler7-save-v3']).resources.erz; } catch (e) {}
  try { gespeicherterPakt = JSON.parse(store[PAKT_KEY]); } catch (e) {}
  await ctx.close();
  return { knopf, ausgeloest, log, erzNachher, gespeicherterPakt, errs };
}

(async () => {
  const browser = await starteBrowser();

  // --- (a) Normalfall: der Server nimmt an
  const ok = await lauf(browser, false);
  check('Geschenk-Schaltfläche gefunden und ausgelöst', ok.knopf > 0 && ok.ausgeloest, { knopf: ok.knopf, ausgeloest: ok.ausgeloest });
  // Die Menge haengt am aktuellen Bestand und wird per fmt() formatiert - ab 1.000 also "1.1k" statt
  // "1100". Der alte Ausdruck erlaubte nur Ziffern und schlug deshalb zufaellig fehl, je nachdem wie
  // viel Erz waehrend des Testlaufs zusammengekommen war (aufgetreten am 26.07.2026). Die Einheiten-
  // Suffixe gehoeren mit in den Ausdruck - geprueft wird, DASS eine Menge dasteht, nicht welche.
  check('a) Erfolgsmeldung erscheint', /Geschenk \([\d.,]+[kmbtKMBT]?\) an /.test(ok.log), ok.log.slice(0, 140));
  const gifts = (ok.gespeicherterPakt || {}).pendingGifts || [];
  check('a) das Geschenk steht im geteilten Pakt-Dokument', gifts.length === 1, gifts);
  check('a) und ist an den Partner adressiert',
    gifts.length === 1 && gifts[0].to === GEGNER && gifts[0].resKey === 'erz' && gifts[0].amount > 0, gifts[0]);
  check('a) der 24h-Cooldown wurde gesetzt',
    !!((ok.gespeicherterPakt || {}).giftCooldown || {})[MEIN_ID], (ok.gespeicherterPakt || {}).giftCooldown);

  // --- (b) Der Server lehnt ab
  const nok = await lauf(browser, true);
  check('b) KEINE Erfolgsmeldung bei abgelehntem Schreibvorgang', !/Geschenk \([\d.,]+\) an /.test(nok.log), nok.log.slice(0, 180));
  check('b) der Spieler wird auf den Fehlschlag hingewiesen',
    /konnte nicht an .* übermittelt werden|nichts wurde abgebucht/.test(nok.log), nok.log.slice(0, 200));
  // Das Pakt-Dokument im Store ist der Stand VOR dem Klick - es darf kein Geschenk enthalten.
  check('b) im geteilten Pakt-Dokument steht kein Geschenk',
    ((nok.gespeicherterPakt || {}).pendingGifts || []).length === 0, (nok.gespeicherterPakt || {}).pendingGifts);
  check('b) und auch kein Cooldown - der Spieler darf es gleich erneut versuchen',
    !((nok.gespeicherterPakt || {}).giftCooldown || {})[MEIN_ID], (nok.gespeicherterPakt || {}).giftCooldown);
  // Der Kern: die Ressourcen sind wieder da. Verglichen wird gegen den Erfolgslauf - dort fehlt das
  // verschenkte Erz, hier darf es NICHT fehlen. Beide Laeufe starten identisch und laufen gleich lang,
  // die Differenz ist daher aussagekraeftig (gleiches Vorgehen wie in test_beitrag_strikt).
  check('b) die Ressourcen wurden zurückgebucht (Erz höher als im Erfolgsfall)',
    typeof nok.erzNachher === 'number' && typeof ok.erzNachher === 'number' && nok.erzNachher > ok.erzNachher,
    { mitFehler: nok.erzNachher, ohneFehler: ok.erzNachher, differenz: (nok.erzNachher - ok.erzNachher) });

  check('keine JS-Fehler', ok.errs.length === 0 && nok.errs.length === 0, ok.errs.concat(nok.errs).slice(0, 3));

  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
