// Die Passage: das Wurmloch wirkt, statt nur dazustehen (Konzept V4, 03.09.2026).
//
//   node tests/test_wurmloch_passage.js
//
// DER ANLASS: `activeWormhole` hatte im Frontend acht Fundstellen - ALLE im Anzeigepfad
// (Kartenknoten, Abzeichen, eine Zeile im Systemkopf). Der Server würfelte es aus, die Karte malte
// einen Wirbel, und es tat nichts: keine Flugzeit, keine Route, keine Mission. Das Portal trug
// sogar sein `data-map-wurmloch`, aber keinen Handler - man sah die Mündung und konnte sie nicht
// benutzen.
//
// WARUM DAS ERST JETZT GEHT: Bis zum 03.09.2026 stand im Backend fest `from: 'kepler'`, und das
// Wurmloch steht gemessen 74 % der Zeit offen (12 h Lebensdauer, danach 6 % je 15-Minuten-Takt).
// Ein Rabatt auf beide Enden wäre damit drei Viertel der Zeit ein Dauerrabatt auf Flüge in die
// eigene Heimat gewesen. Seit kolonie-kepler7-backend#214 zieht der Takt zwei zufällige Systeme.
//
// GEPRUEFT WIRD:
//   1. Der Portal-Knoten ist da und SICHTBAR, und ein Tipp springt auf die andere Seite.
//   2. Beide Anzeigestellen nennen die Wirkung (Abzeichen-Titel, Kopfzeile der Detailtafel) - eine
//      Mechanik ohne Text ist im Spiel nicht auffindbar.
//   3. DIE WIRKUNG als PAAR: dieselbe Erkundungs-Flugzeit mit und ohne offenes Wurmloch. Ohne
//      diese Messung belegte der Test nur, dass irgendwo „25 %" geschrieben steht.
//   4. Die Gegenrichtung: ein ABGELAUFENES Wurmloch zeichnet nichts und verkürzt nichts.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
check('0a: der Faktor sitzt in missionDurationFor', /mult \*= wurmlochFlugMult\(targetSystem\);/.test(JS));
check('0b: das Portal ist verdrahtet', /querySelectorAll\('\[data-map-wurmloch\]'\)/.test(JS));

const SAVE_KEY = 'kepler7-save-v3';
const HEIMAT = 'kepler';
const ZIEL = 'chronos';        // das andere Ende der Passage
const STUNDE = 3600 * 1000;

function backend(store, opt){
  opt = opt || {};
  const wh = opt.wurmloch === undefined
    ? { from: HEIMAT, to: ZIEL, expiresAt: Date.now() + 6 * STUNDE }
    : opt.wurmloch;
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:HEIMAT, homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole: wh, news:[],
      alienNester:[], wrackKonvois:[] });
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'reports') return req.method() === 'POST' ? j({ ok:true }) : j({ reports: [] });
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

async function tab(browser, startSave, opt){
  const store = {};
  if (startSave) store[SAVE_KEY] = startSave;
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store, opt));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
                      'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  return { ctx, page, errs, store, stand: () => JSON.parse(store[SAVE_KEY] || '{}') };
}
async function aufKarte(t, sys){
  await t.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await t.page.waitForTimeout(700);
  return oeffneSystemUeberSektoren(t.page, sys);
}
/* DIE WIRKUNG wird an der ANZEIGESTELLE gemessen, die der Spieler sieht: Die Kennzahlenzeile der
   Detailtafel nennt "Erkundung ab <Dauer>" und wird von derselben missionDurationFor gespeist.
   Der erste Entwurf rief die Funktion direkt im Seitenkontext - das ging nicht: Der ganze
   Spielcode liegt in einer IIFE, missionDurationFor ist von aussen nicht erreichbar, der Aufruf
   lieferte null, und zwei Pruefungen waren mit null === null AUS DEM FALSCHEN GRUND gruen.
   Die Anzeige ist gerundet (fmtDuration), deshalb wird das Verhaeltnis mit Toleranz geprueft -
   und zusaetzlich der Text selbst, der sich unterscheiden MUSS. */
function dauerInSekunden(text){
  const m = /Erkundung ab ([^·]+)/.exec(text || '');
  if (!m) return null;
  let sek = 0, treffer = 0;
  for (const [, zahl, einheit] of m[1].matchAll(/(\d+)\s*([dhms])/g)){
    treffer++;
    sek += Number(zahl) * ({ d: 86400, h: 3600, m: 60, s: 1 })[einheit];
  }
  return treffer ? sek : null;
}
const kennzahlen = page => page.evaluate(() => {
  const el = document.getElementById('systemNavKenn');
  return el ? (el.textContent || '') : '';
});

(async () => {
  const browser = await starteBrowser();

  const roh = await tab(browser);
  const basis = roh.stand();
  await roh.ctx.close();
  check('0c: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  function fixture(){
    const st = JSON.parse(JSON.stringify(basis));
    const fern = Date.now() + 365*24*STUNDE;
    for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
    st.activeEvent = null; st.buffs = [];
    st.karteEbenen = Object.assign({}, st.karteEbenen, { ereignisse:true });
    return JSON.stringify(st);
  }

  // ---- 1) Das Portal ist sichtbar und springt --------------------------------------------------
  const t1 = await tab(browser, fixture());
  await t1.page.waitForTimeout(2000);
  const offen = await aufKarte(t1, HEIMAT);
  check('1-anker: das Heimatsystem steht offen', offen === true, { offen });
  const portal = await t1.page.evaluate(() => {
    const n = document.querySelector('#galaxyMapSvg [data-map-wurmloch]');
    if (!n) return { da:false };
    const b = n.getBoundingClientRect();
    return { da:true, ziel: n.getAttribute('data-map-wurmloch'), breite: Math.round(b.width), hoehe: Math.round(b.height) };
  });
  check('1: das Portal ist auf der Karte SICHTBAR und kennt sein Gegenüber',
    portal.da && portal.breite > 4 && portal.hoehe > 4 && portal.ziel === ZIEL, portal);
  // Der Sprung: derselbe Weg wie bei allen Kartenknoten (synthetisches click, wie tests/lib/karte.js).
  await t1.page.evaluate(() => {
    const n = document.querySelector('#galaxyMapSvg [data-map-wurmloch]');
    if (n) n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await t1.page.waitForTimeout(1500);
  const nachSprung = await t1.page.evaluate(() => {
    const el = document.getElementById('systemNavName');
    return el ? (el.textContent || '').trim() : '';
  });
  check('2: ein Tipp auf das Portal springt auf die andere Seite',
    /Chronos/i.test(nachSprung), { systemKopf: nachSprung, erwartetesZiel: ZIEL });

  // ---- 3) Beide Anzeigestellen nennen die Wirkung ----------------------------------------------
  const kopfzeile = await t1.page.evaluate(() => {
    const el = document.getElementById('systemNavMeta');
    return el ? (el.textContent || '') : '';
  });
  check('3: die Kopfzeile der Detailtafel nennt die Wirkung, nicht nur die Verbindung',
    /🌀/.test(kopfzeile) && /25%/.test(kopfzeile), { kopfzeile });
  check('3b: der Abzeichen-Titel ebenso',
    /Flüge zu beiden Enden dauern 25% weniger/.test(JS),
    { hinweis: 'karteSystemBadges traegt den Titel des 🌀 auf beiden oberen Ebenen' });
  check('3c: keine Skriptfehler', t1.errs.length === 0, t1.errs.slice(0, 3));

  /* ---- 4) DIE WIRKUNG, als PAAR gemessen -------------------------------------------------------
     Zwei Laeufe, dieselbe Fixture, dieselbe Detailtafel - der einzige Unterschied ist das offene
     Wurmloch. Ohne diese Messung belegte der Test nur, dass irgendwo "25 %" geschrieben steht. */
  await aufKarte(t1, ZIEL);
  const mitZiel = await kennzahlen(t1.page);
  await aufKarte(t1, 'vega');
  const mitFremd = await kennzahlen(t1.page);
  await t1.ctx.close();

  const t2 = await tab(browser, fixture(), { wurmloch: null });
  await t2.page.waitForTimeout(2500);
  await aufKarte(t2, ZIEL);
  const ohneZiel = await kennzahlen(t2.page);
  await aufKarte(t2, 'vega');
  const ohneFremd = await kennzahlen(t2.page);
  const portalOhne = await (async () => { await aufKarte(t2, HEIMAT); return t2.page.evaluate(() => !!document.querySelector('#galaxyMapSvg [data-map-wurmloch]')); })();
  await t2.ctx.close();

  const sMit = dauerInSekunden(mitZiel), sOhne = dauerInSekunden(ohneZiel);
  check('4-vorab: beide Laeufe nennen eine Erkundungszeit fuer dasselbe System',
    sMit > 0 && sOhne > 0, { mit: mitZiel, ohne: ohneZiel, sekundenMit: sMit, sekundenOhne: sOhne });
  check('4: zum fernen Ende der Passage fliegt man ein Viertel schneller',
    sMit > 0 && sOhne > 0 && Math.abs(sMit / sOhne - 0.75) < 0.03,
    { sekundenMit: sMit, sekundenOhne: sOhne, verhaeltnis: sOhne ? +(sMit / sOhne).toFixed(4) : null,
      hinweis: 'die Anzeige ist gerundet, deshalb 3 % Toleranz' });
  /* Die Gegenrichtung, ohne die 4 auch von einem pauschalen Rabatt erfuellt waere: Ein System, das
     KEIN Ende der Passage ist, zeigt in beiden Laeufen dieselbe Zeit. */
  check('4b: ein unbeteiligtes System bleibt unberuehrt',
    dauerInSekunden(mitFremd) === dauerInSekunden(ohneFremd) && dauerInSekunden(mitFremd) > 0,
    { mit: mitFremd, ohne: ohneFremd });
  check('4c: ohne Wurmloch zeichnet die Karte auch kein Portal', portalOhne === false, { portalOhne });

  // ---- 5) Ein abgelaufenes Wurmloch wirkt nicht -------------------------------------------------
  // Der Server raeumt es im 15-Minuten-Takt weg; dazwischen kann der Client eines sehen, dessen
  // Frist schon abgelaufen ist. Es darf dann weder rechnen noch etwas versprechen.
  const t3 = await tab(browser, fixture(), { wurmloch: { from: HEIMAT, to: ZIEL, expiresAt: Date.now() - 1000 } });
  await t3.page.waitForTimeout(2500);
  await aufKarte(t3, ZIEL);
  const abgelaufen = await kennzahlen(t3.page);
  const portalAbgelaufen = await (async () => { await aufKarte(t3, HEIMAT); return t3.page.evaluate(() => !!document.querySelector('#galaxyMapSvg [data-map-wurmloch]')); })();
  await t3.ctx.close();
  check('5: ein abgelaufenes Wurmloch verkuerzt nichts mehr',
    dauerInSekunden(abgelaufen) === sOhne && sOhne > 0,
    { abgelaufen: dauerInSekunden(abgelaufen), ohneWurmloch: sOhne });
  check('5b: und es steht auch nicht mehr auf der Karte', portalAbgelaufen === false, { portalAbgelaufen });

  /* ---- 6) Ein Wurmloch OHNE Frist gilt als offen ----------------------------------------------
     Die Entscheidung, die der volle Pruefllauf erzwungen hat: Der erste Entwurf verlangte
     `expiresAt > jetzt` und machte damit jede Angabe ohne Frist stumm - test_kartenbeschriftung
     zeichnete daraufhin kein Portal mehr, obwohl seine Fixture ein Wurmloch fuehrt. Ein fehlendes
     Feld ist keine abgelaufene Passage, sondern eine unvollstaendige Angabe; die Karte zeichnet
     das Wurmloch dann, und die Wirkung muss dazu passen. Diese Pruefung haelt die Entscheidung
     fest - wer wieder auf die strenge Lesart umstellt, faellt hier auf. */
  const t4 = await tab(browser, fixture(), { wurmloch: { from: HEIMAT, to: ZIEL } });
  await t4.page.waitForTimeout(2500);
  await aufKarte(t4, ZIEL);
  const ohneFrist = await kennzahlen(t4.page);
  const portalOhneFrist = await (async () => { await aufKarte(t4, HEIMAT); return t4.page.evaluate(() => !!document.querySelector('#galaxyMapSvg [data-map-wurmloch]')); })();
  await t4.ctx.close();
  check('6: ein Wurmloch ohne Frist wirkt und wird gezeichnet',
    dauerInSekunden(ohneFrist) === sMit && portalOhneFrist === true,
    { ohneFrist: dauerInSekunden(ohneFrist), mitFrist: sMit, portal: portalOhneFrist });

  await browser.close();
  ende();
})();
