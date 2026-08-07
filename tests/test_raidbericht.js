// Klassischer Kampfbericht für Allianz-Raid und Musterangriff (v8.430.0, Wunsch Sascha).
//
// DIE BEIDEN BEFUNDE, DIE DIESEN TEST AUSGELÖST HABEN:
//   * Der Allianz-Raid schrieb einen 'item-found'-Einzeiler unter „Sonstiges" - obwohl der Server
//     die Verbandsflotte, die Rangliste und die Verluste je Schiffstyp längst berechnet.
//   * Der Musterangriff-Bericht ('alliance-muster-attack') hatte NIE einen Render-Zweig: Die Karte
//     stand LEER in der Liste (Icon, Pille, Datum, Löschen-Knopf - kein Titel, kein Text). Ein Typ
//     ohne Zweig fällt still durch, weil die Zweigkette keinen else-Fehlerzweig hat.
//
// Geprüft werden REGELN (Arbeitsregel 3):
//   1) Beide Typen haben einen Render-Zweig, stehen in der Kampf-Kategorie, zählen in die
//      Kampf-Bilanz, und die Marken-Stempelung nimmt die EIGENE Flotte (myComposition), nie die
//      gemeinsame Verbandsflotte.
//   2) Der Raid-Claim schreibt keinen 'item-found' mehr.
//   3) 'destroyed' (zerstörte Basis - der beste Ausgang) färbt positiv, nicht rot.
//   4) Backend-Parität: Wellen-Ergebnis und /claim führen die Berichtsfelder (totalComposition,
//      hatSchwaeche, hpNachher) - die eigentliche Lücke des alten Zustands.
//   5) Browser: Beide Karten rendern mit Titel, Verbandsflotte als Schiffschips und eigenem
//      Beitrag; eine ALTE Musterangriff-Karte (nur ownLostText, vor v8.430.0) rendert lesbar
//      statt leer; der Kämpfe-Filter zeigt beide.
//
// GEGENPROBE (Arbeitsregel 1, beim Einführen ausgeführt): gegen den Stand davor fällt der Test
// durch - kein Render-Zweig, Kategorie kennt die Typen nicht, Raid-Claim schreibt item-found.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

function funktionsRumpf(name) {
  const von = JS.indexOf('function ' + name + '(');
  if (von < 0) return '';
  const bis = JS.indexOf('\n  function ', von + 20);
  return bis > von ? JS.slice(von, bis) : '';
}

// ---- 1) Verdrahtung im Berichtssystem
check('1a: Render-Zweig für alliance-raid existiert',
  JS.includes("} else if (r.type === 'alliance-raid'){"));
check('1b: Render-Zweig für alliance-muster-attack existiert',
  JS.includes("} else if (r.type === 'alliance-muster-attack'){"));
{
  const cat = (JS.match(/key:'combat'[^\n]*types:\[([^\]]*)\]/) || ['', ''])[1];
  check('1c: beide Typen in der Kampf-Kategorie', cat.includes("'alliance-raid'") && cat.includes("'alliance-muster-attack'"), cat);
}
const outcome = funktionsRumpf('battleOutcomeOf');
check('1d: beide Typen zählen in die Kampf-Bilanz',
  outcome.includes("'alliance-raid'") && outcome.includes("'alliance-muster-attack'"));
const marks = funktionsRumpf('stampShipMarks');
check('1e: Marken-Stempel nimmt myComposition, nicht die Verbandsflotte',
  /'alliance-raid' \|\| report\.type === 'alliance-muster-attack'\) eigene = report\.myComposition;/.test(marks));

// ---- 2) Der Raid-Claim schreibt einen echten Kampfbericht
{
  const von = JS.indexOf('async function claimAllianceRaidOutcome(');
  const bis = JS.indexOf('\n  function ', von + 20);
  check('2a: claimAllianceRaidOutcome gefunden (Anker existieren)', von > 0 && bis > von);
  const rumpf = JS.slice(von, bis);
  check('2b: kein item-found mehr, stattdessen alliance-raid',
    !rumpf.includes("type:'item-found'") && rumpf.includes("type:'alliance-raid'"));
  check('2c: die gemeinsame Flotte UND der eigene Beitrag stehen im Bericht',
    rumpf.includes('fleet: data.totalComposition') && rumpf.includes('myComposition: contrib.composition'));
  check('2d: Verluste als Objekt (Schiffsbilder/Nachbau), nicht nur als Text',
    rumpf.includes('ownLostShips:'));
}
check('2e: auch der Musterangriff führt Verbandsflotte, Beitrag und Verlust-Objekt',
  /type:'alliance-muster-attack'[^\n]*fleet: \(doc\.dispatch && doc\.dispatch\.totalComposition\)[^\n]*myComposition: contrib\.composition[^\n]*ownLostShips:/.test(JS));

// ---- 3) 'destroyed' ist ein positiver Ausgang
check('3a: reportIsPositive kennt destroyed',
  /r\.result==='win' \|\| r\.result==='destroyed'/.test(funktionsRumpf('reportIsPositive')));
check('3b: die Icon-Wahl (won) kennt destroyed',
  JS.includes("const won = r.result === 'win' || r.result === 'destroyed';"));

// ---- 4) Backend-Parität (überspringt sich nur selbst, wenn das Backend-Repo fehlt)
if (SERVER_JS) {
  const srv = fs.readFileSync(SERVER_JS, 'utf8');
  const wr = (srv.match(/const waveResult = \{[\s\S]{0,2000}?\n  \};/) || [''])[0];
  check('4a: das Wellen-Ergebnis führt die Berichtsfelder',
    wr.includes('totalComposition:') && wr.includes('hatSchwaeche') && wr.includes('hpNachher:'));
  const claimVon = srv.indexOf("app.post('/api/allianceraid/claim'");
  const claim = srv.slice(claimVon, srv.indexOf('\napp.', claimVon + 10));
  check('4b: /claim reicht sie durch (typgeprüft, alte Wellen -> null)',
    claimVon > 0 && claim.includes('totalComposition: res_.totalComposition || null') &&
    claim.includes("typeof res_.hatSchwaeche === 'boolean'") && claim.includes('hpNachher:'));
} else {
  console.log('SKIP - Backend-Repo liegt nicht daneben, Paritätsprüfung 4a/4b übersprungen.');
}

// ---- 5) Browser: die Karten rendern wirklich
const BERICHTE = [
  { id: 'r1', time: Date.now(), type: 'alliance-raid', result: 'win', destroyed: false,
    bossName: 'Schwarmmutter', level: 3, waveNumber: 2, damage: 25000, hpNachher: 14200, maxHp: 39200,
    hatSchwaeche: false, schadenMult: 0.8, schwaecheName: 'Jäger', lossPct: 0.18,
    fleet: { jaeger: 120, cruisers: 40, schlachtschiff: 8 }, myComposition: { cruisers: 15, schlachtschiff: 2 },
    totalPower: 61000, totalShips: 168, participantCount: 3, platz: 2, teilnehmer: 3, share: 24,
    ranking: [ { platz: 1, name: 'Alpha', power: 40000, ich: false }, { platz: 2, name: 'Ich', power: 15000, ich: true }, { platz: 3, name: 'Gamma', power: 6000, ich: false } ],
    ownLostShips: { cruisers: 3 }, credits: 240, battlePoints: 18, xp: 120,
    resources: { erz: 4000, kristalle: 2500 }, fragmente: 0, modulName: null },
  // ALTES Format (vor v8.430.0): nur ownLostText, keine Flottenobjekte - genau die Karte, die
  // frueher leer blieb. Sie muss lesbar rendern, nicht perfekt.
  { id: 'r2', time: Date.now() - 60000, type: 'alliance-muster-attack', result: 'destroyed',
    targetTag: 'FEIND', damage: 90000, defensePower: 30000, chancePct: 88, myPower: 20000, myShare: 35,
    totalPower: 57000, totalShips: 300, participantCount: 4, credits: 500, forschungspunkte: 200,
    battlePoints: 40, ownLostText: '5x Kreuzer' }
];

function backend(){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true, supporter: { active: false, tier: null } });
  if (p === 'reports') return j({ reports: BERICHTE });
  if (p === 'storage-list') return j({ keys: [] });
  if (p.startsWith('storage/')) return j({ e: 1 }, 404);
  return j([]);
}; }

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend());
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay'].forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }));
  await page.evaluate(() => { const b = document.querySelector('[data-tab="berichte"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);

  const platt = s => (s || '').replace(/\s+/g, ' ').trim();
  const karten = await page.evaluate(() => {
    const box = document.getElementById('reportsBox');
    if (!box) return null;
    return [...box.querySelectorAll('.card-row')].map(c => ({
      text: c.textContent.replace(/\s+/g, ' ').trim().slice(0, 1500),
      chips: c.querySelectorAll('.schiffchip').length,
      pill: /Gewonnen/.test(c.textContent) ? 'Gewonnen' : (/Verloren/.test(c.textContent) ? 'Verloren' : null)
    }));
  });
  check('5a: beide Karten wurden gerendert', Array.isArray(karten) && karten.length >= 2, karten && karten.length);
  const raidKarte = (karten || []).find(k => k.text.includes('Allianz-Raid: Schwarmmutter'));
  check('5b: Raid-Karte hat Titel mit Boss, Stufe und Welle',
    !!raidKarte && raidKarte.text.includes('(Stufe 3, Welle 2)'), raidKarte && raidKarte.text.slice(0, 90));
  check('5c: Verbandsflotte und eigener Beitrag stehen mit Schiffschips darin',
    !!raidKarte && raidKarte.text.includes('Verbandsflotte (3 Teilnehmer') && raidKarte.text.includes('Dein Beitrag (Platz 2 von 3') && raidKarte.chips >= 5,
    raidKarte && { chips: raidKarte.chips });
  check('5d: Rangliste, ungedeckte Trefferschwäche und Verlustquote stehen darin',
    !!raidKarte && raidKarte.text.includes('Rangliste: 1. Alpha') && raidKarte.text.includes('NICHT gedeckt (kein Jäger') && raidKarte.text.includes('rund 18%'),
    raidKarte && raidKarte.text.slice(90, 300));
  check('5e: die Welle gilt als gewonnen (nie "Verloren")', !!raidKarte && raidKarte.pill === 'Gewonnen');
  const musterKarte = (karten || []).find(k => k.text.includes('Koordinierter Angriff auf [FEIND]'));
  check('5f: die ALTE Musterangriff-Karte rendert lesbar statt leer',
    !!musterKarte && musterKarte.text.includes('DIE BASIS WURDE ZERSTÖRT') && musterKarte.text.includes('5x Kreuzer'),
    musterKarte && musterKarte.text.slice(0, 140));
  check('5g: die zerstörte Basis färbt positiv ("Gewonnen"-Pille)', !!musterKarte && musterKarte.pill === 'Gewonnen', musterKarte && musterKarte.pill);

  // Kämpfe-Filter: beide Typen müssen darunter erscheinen (vorher: Raid unter "Sonstiges").
  await page.evaluate(() => { const f = document.querySelector('[data-reports-filter-cat="combat"]'); if (f) f.click(); });
  await page.waitForTimeout(600);
  const nachFilter = await page.evaluate(() => {
    const box = document.getElementById('reportsBox');
    return box ? box.textContent.replace(/\s+/g, ' ') : '';
  });
  check('5h: der Kämpfe-Filter zeigt beide Verbandsberichte',
    nachFilter.includes('Allianz-Raid: Schwarmmutter') && nachFilter.includes('Koordinierter Angriff auf [FEIND]'));
  check('5i: keine JS-Fehler', errs.length === 0, errs.slice(0, 3));

  await ende(async () => { await ctx.close(); await browser.close(); });
})();
