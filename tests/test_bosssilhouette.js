// Raid-Boss-Silhouetten in der Kampf-Wiedergabe (v8.441.0, Task #32, Fortsetzung von #8).
//
// ARCHITEKTUR: Dasselbe Muster wie der Leerenriss aus v8.440.0 - die Gegenseite hat keine
// Ruempfe, an ihrer Stelle steht eine gezeichnete Gestalt (zeichneBoss, je Boss eine eigene),
// die zurueckschiesst (bossSchritt). Der Hueellenverlauf kommt AUSSCHLIESSLICH aus dem
// Bericht: vorher = hpNachher + damage, nachher = hpNachher, destroyed -> 0. Altberichte
// ohne Zahlen zeigen die Gestalt in voller Staerke - kein erfundener Verlauf.
//
// GEPRUEFT WIRD (die kritischen Teile AUSGEFUEHRT):
//   1) schlachtDaten: alliance-raid markiert boss und fuehrt bossHuelle korrekt (normal,
//      zerstoert, Altbericht ohne Zahlen).
//   2) bossHpAnteil + kraftAnteilA: die Schiene rechnet den Boss mit seiner AKTUELLEN
//      Huelle (Anfang voll, Ende = gemeldeter Rest, zerstoert -> 100% fuer den Verband).
//   3) Verdrahtung: fuenf benannte Gestalten + generischer Rueckfall, Namenszuordnung ueber
//      die Boss-Tabelle des Spiels (typeof-geschuetzt), Zeichnen-/Schritt-Aufrufe, Tafel
//      nennt "Boss-Huelle".
//   4) Browser: Allianz-Raid-Wiedergabe laeuft OHNE Fehler (leere Gegner-Arrays!), Tafel
//      zeigt "Boss-Huelle", Schiene gibt dem Boss echte Prozent.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren ausgefuehrt): am alten Stand fallen 1b
// (boss-Feld fehlt) und 3a-3e durch.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) schlachtDaten ausgefuehrt
{
  const von = JS.indexOf('const Schlachtdaten = (function () {');
  const bis = JS.indexOf('})();', von);
  check('1a: Schlachtdaten-Kapsel gefunden', von > 0 && bis > von);
  const sd = new Function(JS.slice(von, bis + 5) + '\nreturn Schlachtdaten;')().schlachtDaten;
  const basis = { type:'alliance-raid', bossName:'Schwarmmutter', level:3, waveNumber:2,
    damage: 25000, hpNachher: 14200, maxHp: 39200, lossPct: 0.1, totalPower: 61000,
    fleet: { jaeger:120, cruisers:40 }, myComposition: { cruisers:15 } };
  const d1 = sd(basis, null);
  check('1b: der Boss ist markiert und der Hueellenverlauf kommt aus dem Bericht',
    d1 && d1.verteidiger && d1.verteidiger.boss === true && d1.bossHuelle &&
    d1.bossHuelle.vorher === 39200 && d1.bossHuelle.nachher === 14200 && d1.bossHuelle.zerstoert === false,
    d1 && d1.bossHuelle);
  const d2 = sd(Object.assign({}, basis, { destroyed: true, hpNachher: 0 }), null);
  check('1c: ein erlegter Boss traegt zerstoert', d2 && d2.bossHuelle && d2.bossHuelle.zerstoert === true);
  const d3 = sd({ type:'alliance-raid', bossName:'Gluthorn', fleet:{ jaeger:5 }, myComposition:{} }, null);
  check('1d: Altbericht ohne Huellen-Zahlen -> bossHuelle null (kein erfundener Verlauf)',
    d3 && d3.verteidiger && d3.verteidiger.boss === true && d3.bossHuelle === null, d3 && d3.bossHuelle);

  // Weltboss (v8.442.0): markierte Berichte bekommen die Silhouette, der Verlauf ist
  // Rest + eigener Schaden -> Rest, und die angezeigte Kraft ist die Huelle VOR dem
  // eigenen Angriff (nicht das Maximum des Bosses).
  const wb = sd({ type:'npc-attack', result:'win', npcName:'Leviathan der Leere - Stufe 2',
    attackPower: 50000, defensePower: 400000, weltboss: true, bossHpNachher: 150000,
    bossZerstoert: false, fleet:{ jaeger: 200 }, ownLostShips:{} }, null);
  check('1e: Weltboss-Bericht markiert boss+weltboss, Verlauf aus Rest+Schaden',
    wb && wb.verteidiger && wb.verteidiger.boss === true && wb.verteidiger.weltboss === true &&
    wb.bossHuelle && wb.bossHuelle.vorher === 200000 && wb.bossHuelle.nachher === 150000 &&
    wb.verteidiger.kraft === 200000 && wb.abwehrkraft === 200000,
    wb && { huelle: wb.bossHuelle, kraft: wb.verteidiger && wb.verteidiger.kraft });
  const wbKill = sd({ type:'npc-attack', result:'win', npcName:'Nova-Titan - Stufe 5',
    attackPower: 90000, defensePower: 400000, weltboss: true, bossHpNachher: 0,
    bossZerstoert: true, fleet:{ jaeger: 200 } }, null);
  check('1f: der letzte Schlag traegt zerstoert', wbKill && wbKill.bossHuelle && wbKill.bossHuelle.zerstoert === true);
  const wbAlt = sd({ type:'npc-attack', result:'win', npcName:'Leviathan der Leere - Stufe 2',
    attackPower: 50000, defensePower: 400000, fleet:{ jaeger: 200 } }, null);
  check('1g: Weltboss-ALTBERICHT ohne Markierung bleibt bei den Stellvertretern (kein boss-Feld)',
    wbAlt && wbAlt.verteidiger && !wbAlt.verteidiger.boss && !wbAlt.verteidiger.weltboss);
}

// ---- 2) Die Schiene rechnet mit der aktuellen Boss-Huelle
{
  const fnAus = (kopf) => {
    const a = JS.indexOf(kopf);
    if (a < 0) return '';
    const b = JS.indexOf('\n    }', a);
    return b > a ? JS.slice(a, b + 6) : '';
  };
  const qR = fnAus('function rissStaerke(){');
  const qB = fnAus('function bossHpAnteil(){');
  const qK = fnAus('function kraftAnteilA(summeA, summeD){');
  check('2a: bossHpAnteil und kraftAnteilA gefunden', qB.length > 100 && qK.length > 300, [qB.length, qK.length]);
  const rechne = (ctx) => new Function('ctx',
    'var GEGNER_UNBEKANNT = true, DATEN = ctx.daten, KRAFT_START_A = 1000,' +
    ' RISS = null, BOSS = ctx.boss, tSim = ctx.t;' +
    ' function klemme(v, a, b){ return Math.min(b, Math.max(a, v)); }\n' +
    qR + '\n' + qB + '\n' + qK + '\nreturn kraftAnteilA(ctx.summeA, 0);')(ctx);
  const daten = { verteidiger: { kraft: 39200, boss: true }, angriffskraft: 61000, abwehrkraft: 39200, ergebnis: 'sieg' };
  // endAnteil wie ihn berichtUebernehmen aus dem Bericht ableitet: 14200/39200.
  const boss = { endAnteil: 14200 / 39200 };
  check('2b: zu Wellenbeginn zaehlt die volle Boss-Huelle',
    rechne({ daten, boss, t: 2.6, summeA: 1000 }) === Math.round(100 * 61000 / (61000 + 39200)));
  check('2c: am Wellenende zaehlt der gemeldete Rest',
    rechne({ daten, boss, t: 41, summeA: 1000 }) === Math.round(100 * 61000 / (61000 + 14200)));
  check('2d: ein erlegter Boss endet bei 100% fuer den Verband',
    rechne({ daten, boss: { endAnteil: 0 }, t: 41, summeA: 1000 }) === 100);
}

// ---- 3) Verdrahtung
check('3a: fuenf benannte Gestalten plus generischer Rueckfall',
  ["BOSS.key === 'sternenfresser'", "BOSS.key === 'panzerhuelle'", "BOSS.key === 'schwarmmutter'",
   "BOSS.key === 'phasenwandler'", "BOSS.key === 'gluthorn'"].every(t => JS.includes(t)) &&
  /Generische Gestalt \(Prototyp\/unbekannter Boss\)/.test(JS));
check('3b: der Boss wird ueber die Boss-Tabelle des Spiels zugeordnet (typeof-geschuetzt, keine zweite Liste)',
  JS.includes("(typeof ALLIANCE_RAID_BOSSE !== 'undefined')") &&
  JS.includes('bossName.indexOf(b.name) === 0'));
{
  const w = JS.indexOf('zeichneRiss(g);\n      zeichneBoss(g);\n      zeichneAntriebe(g);');
  check('3c: zeichneBoss haengt im Zeichenpfad neben dem Riss', w > 0);
}
check('3d: bossSchritt laeuft im Simulationsschritt, der Boss ist Ziel der Angreifer',
  JS.includes('rissSchritt(dt);\n      bossSchritt(dt);') &&
  JS.includes("if (seite === 'A' && BOSS) return bossHpAnteil() > 0.03 ? BOSS : null;"));
check('3e: die Tafel nennt die Zahl des Bosses "Boss-Huelle"',
  JS.includes("seite.boss ? 'Boss-Hülle' : 'Abwehrkraft'"));
check('3f: die Hilfe nennt die Silhouetten und den ehrlichen Altbericht-Fall (zweite Anzeigestelle)',
  JS.includes('steht der Boss als eigene gezeichnete') &&
  JS.includes('Ältere Berichte ohne Hüllen-Angaben zeigen die Gestalt in voller Stärke'));
// Weltboss (v8.442.0): fuenf Gestalten wb0-wb4, Zuordnung ueber die Namensliste des Spiels.
check('3g: fuenf Weltboss-Gestalten wb0-wb4 plus Namens-Zuordnung ueber WORLDBOSS_NAMEN',
  ['wb0','wb1','wb2','wb3','wb4'].every(k => JS.includes("BOSS.key === '" + k + "'")) &&
  JS.includes("(typeof WORLDBOSS_NAMEN !== 'undefined')") &&
  JS.includes('bossName.indexOf(n) === 0'));
check('3h: der Weltboss-Bericht traegt die neuen Felder',
  JS.includes("weltboss: true, bossHpNachher: Math.round(data.bossHp||0), bossZerstoert: !!data.killed,"));

// ---- 4) Browser: Allianz-Raid-Wiedergabe mit Silhouette statt Stellvertretern
const BERICHT = { id: 'r1', time: Date.now(), type: 'alliance-raid', result: 'win', destroyed: false,
  bossName: 'Schwarmmutter', level: 3, waveNumber: 2, damage: 25000, hpNachher: 14200, maxHp: 39200,
  hatSchwaeche: true, schadenMult: 1, schwaecheName: 'Jäger', lossPct: 0.1,
  fleet: { jaeger: 120, cruisers: 40, schlachtschiff: 8 }, myComposition: { cruisers: 15 },
  totalPower: 61000, totalShips: 168, participantCount: 3, platz: 2, teilnehmer: 3, share: 24,
  ownLostShips: { cruisers: 2 }, credits: 240, battlePoints: 18, xp: 120 };
// Weltboss-Bericht (v8.442.0): Huelle vor dem Angriff = 150.000 + 50.000 = 200.000.
const WB_BERICHT = { id: 'r2', time: Date.now() - 60000, type: 'npc-attack', result: 'win',
  npcName: 'Leviathan der Leere - Stufe 2', npcLevel: 2, attackPower: 50000, defensePower: 400000,
  chancePct: 100, weltboss: true, bossHpNachher: 150000, bossZerstoert: false,
  fleet: { jaeger: 200, cruisers: 30 }, ownLostShips: { jaeger: 4 }, battlePoints: 5,
  fromPlanet: 'Heimatbasis', debrisPlanet: 'p1', flightTime: 60, loot: {} };

function backend(){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'A', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true, supporter: { active: false, tier: null } });
  if (p === 'reports') return j({ reports: [BERICHT, WB_BERICHT] });
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
  await page.waitForTimeout(1200);

  const geklickt = await page.evaluate(() => {
    const karte = [...document.querySelectorAll('#reportsBox .card-row')]
      .find(c => c.textContent.includes('Schwarmmutter'));
    const btn = karte && karte.querySelector('[data-watch-battle]');
    if (btn) btn.click();
    return !!btn;
  });
  check('4a: der Raid-Bericht hat einen Zuschauen-Knopf', geklickt === true);
  await page.waitForTimeout(2500);

  const stand = await page.evaluate(() => {
    const wrap = document.getElementById('osWrap');
    const kraftD = document.getElementById('osKraftD');
    const tafelD = document.getElementById('osTafelD');
    return {
      offen: !!(wrap && wrap.offsetParent !== null),
      kraftD: kraftD ? kraftD.textContent : null,
      tafelD: tafelD ? tafelD.textContent.replace(/\s+/g, ' ') : null
    };
  });
  check('4b: die Wiedergabe ist offen', stand.offen === true, stand);
  check('4c: die Tafel nennt die Boss-Huelle mit der Zahl des Berichts',
    !!stand.tafelD && stand.tafelD.includes('Boss-Hülle') && stand.tafelD.includes('39.200'),
    stand.tafelD && stand.tafelD.slice(0, 120));
  const prozD = stand.kraftD ? parseInt(stand.kraftD, 10) : NaN;
  check('4d: die Schiene gibt dem Boss echte Prozent (Berichtszahlen, nicht 0)',
    Number.isFinite(prozD) && prozD > 5 && prozD < 95, stand.kraftD);
  check('4e: keine JS-Fehler in der Boss-Wiedergabe (leere Gegner-Arrays!)', errs.length === 0, errs.slice(0, 3));

  // ---- Weltboss (v8.442.0): Wiedergabe schliessen, den Leviathan-Bericht oeffnen.
  await page.evaluate(() => { const b = document.getElementById('battleModalCloseBtn'); if (b) b.click(); });
  await page.waitForTimeout(600);
  const wbGeklickt = await page.evaluate(() => {
    const karte = [...document.querySelectorAll('#reportsBox .card-row')]
      .find(c => c.textContent.includes('Leviathan der Leere'));
    const btn = karte && karte.querySelector('[data-watch-battle]');
    if (btn) btn.click();
    return !!btn;
  });
  check('4f: der Weltboss-Bericht hat einen Zuschauen-Knopf', wbGeklickt === true);
  await page.waitForTimeout(2500);
  const wbStand = await page.evaluate(() => {
    const kraftD = document.getElementById('osKraftD');
    const tafelD = document.getElementById('osTafelD');
    return {
      kraftD: kraftD ? kraftD.textContent : null,
      tafelD: tafelD ? tafelD.textContent.replace(/\s+/g, ' ') : null
    };
  });
  check('4g: die Tafel nennt die Weltboss-Huelle VOR dem Angriff (Rest + Schaden, nicht das Maximum)',
    !!wbStand.tafelD && wbStand.tafelD.includes('Boss-Hülle') && wbStand.tafelD.includes('200.000') &&
    !wbStand.tafelD.includes('400.000'),
    wbStand.tafelD && wbStand.tafelD.slice(0, 120));
  const wbProzD = wbStand.kraftD ? parseInt(wbStand.kraftD, 10) : NaN;
  check('4h: die Schiene gibt dem Weltboss echte Prozent', Number.isFinite(wbProzD) && wbProzD > 5 && wbProzD < 95, wbStand.kraftD);
  check('4i: auch die Weltboss-Wiedergabe laeuft ohne JS-Fehler', errs.length === 0, errs.slice(0, 3));

  await ende(async () => { await ctx.close(); await browser.close(); });
})();
