// Die mögliche Belohnung an der Weltboss-Karte (03.09.2026, Wunsch Sascha
// "bei weltboss mögliche belohnung anzeigen").
//
// WARUM. Die Karte nannte bisher nur die REGEL: "Beim Kill: Belohnung nach Schadensanteil,
// Top-Schädiger +50%". Daraus lässt sich nicht ablesen, ob sich der heutige Schlag lohnt - und
// mehr als einen Schlag pro Tag gibt es nicht.
//
// EINE RECHNUNG, ZWEI AUFRUFER. `worldBossKillReward(level, share, isTop)` rechnet; die Auszahlung
// (maybeClaimWorldBossReward) und die Anzeige rufen sie. Vorher stand die Formel nur in der
// Auszahlung, eine Vorschau hätte sie abschreiben müssen - zwei Wahrheiten, die beim nächsten
// Balancing auseinanderlaufen. Prüfung 1 hält genau das fest.
//
// GEPRÜFT WIRD:
//   1. Die Auszahlung rechnet NICHT mehr selbst, sondern ruft die gemeinsame Funktion.
//   2. Die Karte zeigt konkrete Zahlen (Kredite, Kampfpunkte, Modul- und Unikat-Chance).
//   3. DAS PAAR: Mit größerem Schadensanteil werden die Zahlen GRÖSSER. Ohne diese Hälfte wäre
//      "es stehen Zahlen da" auch mit einem festen Text erfüllt - der Kern des Wunsches ist aber,
//      dass die Zahl zum eigenen Beitrag passt.
//   4. Wer noch gar nicht getroffen hat, sieht keinen 0-%-Eintrag, sondern den Hinweis, dass ein
//      erster Treffer in die Wertung bringt.
//   5. Die Karte verspricht nichts: Sie sagt, dass der Anteil sich noch verschiebt.
//
// GEGENPROBE (GEMESSEN, nicht geraten - 03.09.2026):
//   * die Anzeigezeile entfernt   -> 2a, 2b, 3a-anker, 3a, 3b, 4a, 5a fallen (2a-anker und 2c
//                                    bleiben grün: die Karte selbst steht ja noch da).
//   * Anteil fest auf 0 gerechnet -> 3a fällt ALLEIN. Genau das ist der Wert des Paars: Die Zahlen
//                                    stehen weiter da, sie wachsen nur nicht mehr mit dem Beitrag.
//
// Die erste Fassung von 3b suchte nur das Wort "Top-Schädiger" - und blieb bei entfernter
// Anzeigezeile GRÜN, weil dasselbe Wort schon im allgemeinen Regelsatz der Karte steht
// ("Top-Schädiger +50%"). Aufgefallen ist das erst in der Gegenprobe. Seither prüft 3b den
// Wortlaut DIESER Zeile ("Anteil von N% (Top-Schädiger"). Eine Prüfung, die auch ohne das
// Geprüfte besteht, ist keine.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
const BOSS_KEY = 'worldboss:current';
const ICH = 'u';

// ---- 1) Eine Rechnung, zwei Aufrufer ----------------------------------------------------------
check('1a: es gibt die gemeinsame Funktion worldBossKillReward', /function worldBossKillReward\(level, share, isTop\)/.test(JS));
const auszahlung = (() => {
  const von = JS.indexOf('function maybeClaimWorldBossReward(');
  const bis = JS.indexOf('function sendWorldBossMission(', von);
  return (von > 0 && bis > von) ? JS.slice(von, bis) : '';
})();
check('1b-anker: der Auszahlungsblock liess sich schneiden', auszahlung.length > 400, { laenge: auszahlung.length });
check('1b: die Auszahlung ruft die gemeinsame Funktion',
  /worldBossKillReward\(b\.level, share, isTop\)/.test(auszahlung), { treffer: /worldBossKillReward/.test(auszahlung) });
/* Und sie rechnet NICHT mehr selbst. Ohne diese Pruefung waere 1b auch dann gruen, wenn die alte
   Formel danebenstehen bliebe - genau die zweite Wahrheit, die vermieden werden soll. */
check('1c: die alte Formel steht nicht mehr in der Auszahlung',
  !/\(500 \+ b\.level\*250\)/.test(auszahlung) && !/\(10 \+ b\.level\*5\)/.test(auszahlung),
  { kredite: /\(500 \+ b\.level\*250\)/.test(auszahlung), punkte: /\(10 \+ b\.level\*5\)/.test(auszahlung) });

const basis = {
  resources: { energie: 5e5, erz: 5e5, kristalle: 5e5, deuterium: 5e5, antimaterie: 100, forschungspunkte: 100 },
  buildings: {}, research: {}, colonies: {},
  fleet: { missions: [], cruisers: 200, jaeger: 200, destroyers: 100 },
  player: { id: ICH, name: 'A' }, credits: 1000, xp: 1000, prestige: 0, battlePoints: 0, lastTick: Date.now()
};

// Derselbe Boss, nur der eigene Schadensanteil unterscheidet sich - so misst 3a wirklich den
// Anteil und nicht nebenbei eine andere Bossstufe.
function boss(meinDmg){
  const beitraege = { rivale: { name: 'Rivale', dmg: 10000 } };
  if (meinDmg > 0) beitraege[ICH] = { name: 'A', dmg: meinDmg };
  return { bossId: 'wb-test-1', level: 4, hp: 500000, maxHp: 900000, defeatedAt: null, contributions: beitraege };
}

function backend(bossDoc){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId: ICH, username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null,
      collapsedSystems:{}, activeWormhole:null, news:[], alienNester: [], wrackKonvois: [] });
    if (p === 'vorposten') return j({ ok:true, aktiv:false, liste:[], stufen:[] });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') return j({ ok:true });
      if (k === BOSS_KEY) return j({ key:k, value: JSON.stringify(bossDoc), version:1 });
      if (k === SAVE_KEY) return j({ key:k, value: JSON.stringify(basis), version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|reports/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

async function karte(browser, bossDoc){
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(bossDoc));
  await page.addInitScript(([k, v]) => { localStorage.setItem('kepler7_token', 'tok'); localStorage.setItem(k, v); },
    [SAVE_KEY, JSON.stringify(basis)]);
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(4000);
  await page.evaluate(() => { for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){ const e = document.getElementById(id); if (e) e.remove(); } });
  await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="galaxie"]'); if (x) x.click(); });
  await page.waitForTimeout(1200);
  const text = await page.evaluate(() => {
    const box = document.getElementById('worldBossBox');
    return box ? (box.textContent||'').replace(/\s+/g,' ').trim() : '';
  });
  return { ctx, page, errs, text };
}

// Zahl vor einem Wort herausziehen ("1.234 Kredite" -> 1234). Die Anzeige nutzt fmt() mit
// Tausenderpunkten; ohne das Entfernen waere der Vergleich in 3a still immer wahr.
function zahlVor(text, wort){
  const m = text.match(new RegExp('([0-9][0-9.,k]*)\\s*' + wort));
  if (!m) return null;
  const roh = m[1];
  if (/k$/i.test(roh)) return Math.round(parseFloat(roh.replace(',', '.')) * 1000);
  return parseInt(roh.replace(/[.,]/g, ''), 10);
}

(async () => {
  const browser = await starteBrowser();
  try {
    // ---- 2/5) Mit eigenem Beitrag: konkrete Zahlen -------------------------------------------
    const klein = await karte(browser, boss(2000));    // 2000 von 12000 -> rund 17%
    check('2a-anker: die Weltboss-Karte ist gezeichnet', /Leviathan|HP/.test(klein.text), { auszug: klein.text.slice(0, 120) });
    check('2a: die Karte nennt die moegliche Belohnung mit Krediten und Kampfpunkten',
      /Mögliche Belohnung beim Kill/.test(klein.text) && /Kredite/.test(klein.text) && /Kampfpunkte/.test(klein.text),
      { auszug: klein.text.slice(0, 400) });
    check('2b: sie nennt auch die Chancen auf Modul und Leviathanherz',
      /Chance auf ein Modul/.test(klein.text) && /Leviathanherz/.test(klein.text), { auszug: klein.text.slice(0, 400) });
    check('5a: sie verspricht nichts - der wandernde Anteil steht dabei',
      /verschiebt sich/.test(klein.text), { auszug: klein.text.slice(0, 400) });
    check('2c: keine Seitenfehler', klein.errs.length === 0, klein.errs.slice(0, 2));
    const kreditKlein = zahlVor(klein.text, 'Kredite');
    const punkteKlein = zahlVor(klein.text, 'Kampfpunkte');
    await klein.ctx.close();

    // ---- 3) DAS PAAR: mehr Anteil, mehr Lohn ---------------------------------------------------
    const gross = await karte(browser, boss(90000));   // 90000 von 100000 -> rund 90%, Top-Schaediger
    const kreditGross = zahlVor(gross.text, 'Kredite');
    const punkteGross = zahlVor(gross.text, 'Kampfpunkte');
    check('3a-anker: beide Zahlenpaare sind lesbar',
      kreditKlein > 0 && kreditGross > 0 && punkteKlein > 0 && punkteGross > 0,
      { kreditKlein, kreditGross, punkteKlein, punkteGross });
    check('3a: mit groesserem Schadensanteil wird die Belohnung GROESSER',
      kreditGross > kreditKlein && punkteGross > punkteKlein,
      { kreditKlein, kreditGross, punkteKlein, punkteGross });
    /* Auf den EIGENEN Wortlaut gepruefen, nicht auf das blosse Wort: "Top-Schädiger" steht ohnehin
       im allgemeinen Regelsatz der Karte ("Top-Schädiger +50%"). Der erste Entwurf suchte nur das
       Wort und blieb deshalb GRUEN, obwohl die ganze Anzeigezeile entfernt war - gemessen in der
       Gegenprobe am 03.09.2026. Eine Pruefung, die auch ohne das Gepruefte besteht, ist keine. */
    check('3b: der Top-Schaediger-Bonus steht in der BELOHNUNGSZEILE, nicht nur im Regeltext',
      /Anteil von \d+% \(Top-Schädiger/.test(gross.text), { auszug: gross.text.slice(0, 500) });
    await gross.ctx.close();

    // ---- 4) Ohne eigenen Beitrag ----------------------------------------------------------------
    const ohne = await karte(browser, boss(0));
    check('4a: ohne eigenen Schaden steht kein 0-%-Eintrag, sondern der Hinweis auf den ersten Treffer',
      /ersten Treffer|erster Treffer/.test(ohne.text) && !/Anteil von 0%/.test(ohne.text),
      { auszug: ohne.text.slice(0, 400) });
    await ohne.ctx.close();
  } finally {
    await browser.close();
  }
  ende();
})();
