// Der Belagerungsplan (21.08.2026, Auftrag Sascha: aus drei Optionen die UMWIDMUNG gewaehlt).
//
//   node tests/test_belagerungsplan.js
//
// Er senkt die EIGENEN Verluste des naechsten Festungsschlags - ausdruecklich NICHT das, was das
// Konzept vorsah (ein Extraschlag). Der Hort ist streng nullsummig, ein Extraschlag haette also
// nur VERSCHOBEN: gemessen an einer Sternenfeste 180.000 Erz, 96 Protomaterie und 18 Kampfpunkte
// von benannten Mitstreitern zum Planbesitzer.
//
// GEPRUEFT WIRD:
//   1. Die Verdrahtung im Quelltext - vor allem, dass der Bericht die WIRKLICH gebuchten Verluste
//      nennt und nicht die ungekuerzte Serverzahl (das waere die zweite Anzeigestelle, Pflicht 6).
//   2. Die Aktivierung im laufenden Spiel, ueber den Spielerweg: einmal wirkt sie, ein zweites Mal
//      nennt sie den GRUND und behaelt das Exemplar (die Regel aus v8.598.0).
//   3. Die Vorschau MISST die Wirkung, statt sie zu benennen (Arbeitsregel 61): zwei Laeufe mit
//      derselben Festung, einmal mit und einmal ohne Vormerkung, muessen ANDERE Prozentzahlen
//      zeigen. Eine Pruefung auf „Belagerungsplan steht da" waere auch bei wirkungslosem Code gruen.
//   4. Die gebuchten Verluste an einem echten, aufgeloesten Schlag - wieder als PAAR, mit
//      identischer Serverantwort. Der Anker liegt damit ausserhalb der geprueften Rechnung
//      (Arbeitsregel 62): Verschoebe ein Fehler beide Seiten, faellt es hier auf.
//   5. Kommt gar kein Kampf zustande, bekommt der Spieler die Vormerkung ZURUECK.
//
// GEGENPROBE (in beide Richtungen gefahren, identische Pruefnamen per diff verglichen):
//   * KEPLER_SPIELDATEI auf den Stand vor dieser Etappe: es fallen die Abschnitte 1-5 bis auf
//     die reinen Aufbau-Pruefungen.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, devices, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// Kommentare leeren, BEVOR gesucht wird: Die Erklaerungen an diesen Stellen zitieren den Code, den
// sie erklaeren - ohne das Leeren pruefte die Suche den Kommentar statt der Zeile (Arbeitsregel 33).
const OHNE_KOMMENTARE = JS.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
                          .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
check('1-vorab: das Leeren der Kommentare hat gegriffen',
  /Der Belagerungsplan reist genauso in der MISSION mit/.test(JS)
  && !/Der Belagerungsplan reist genauso in der MISSION mit/.test(OHNE_KOMMENTARE));

function fnAus(quelle, n){
  const m = quelle.match(new RegExp('(?:async\\s+)?function\\s+' + n + '\\s*\\('));
  if (!m) return '';
  const i = quelle.indexOf(m[0]);
  let d = 0, k = quelle.indexOf('{', i + m[0].length);
  for (; k < quelle.length; k++){ if (quelle[k] === '{') d++; else if (quelle[k] === '}'){ d--; if (!d) break; } }
  return quelle.slice(i, k + 1);
}

// ---------------------------------------------------------------- 1) Verdrahtung im Quelltext
const senkung = (JS.match(/const BELAGERUNGSPLAN_SENKUNG = ([0-9.]+);/) || [])[1];
check('1a: die Senkung steht als benannte Konstante da, nicht als Zahl im Text',
  senkung !== undefined && Number(senkung) > 0 && Number(senkung) < 1, { senkung });
check('1b: es gibt genau EINE Definition', (JS.match(/const BELAGERUNGSPLAN_SENKUNG\s*=/g) || []).length === 1);
check('1c: der Gegenstand liegt im REGULAEREN Fundtopf (keine fremde Herkunft)',
  /\{ key:'belagerungsplan',[^\n]*chance:0\.012[^\n]*rarity:'episch'/.test(JS)
  && !/\{ key:'belagerungsplan',[^\n]*quelle:/.test(JS));

const start = fnAus(OHNE_KOMMENTARE, 'sendFestungsMission');
check('1-vorab2: sendFestungsMission wurde gefunden', start.length > 200, { laenge: start.length });
check('1d: die Vormerkung wird beim START verbraucht, nicht bei der Aufloesung',
  /state\.belagerungsplan\s*=\s*false/.test(start));
check('1e: und reist als Feld IN DER MISSION mit (nicht als Zustandsflagge)',
  /belagerungsplan:\s*plan/.test(start));

const aufl = fnAus(OHNE_KOMMENTARE, 'festungAufloesen');
check('1-vorab3: festungAufloesen wurde gefunden', aufl.length > 500, { laenge: aufl.length });
check('1f: die Wirkung sitzt VOR der Buchung',
  aufl.indexOf('BELAGERUNGSPLAN_SENKUNG') > 0
  && aufl.indexOf('BELAGERUNGSPLAN_SENKUNG') < aufl.indexOf('pveVerlusteBuchen'),
  { wirkung: aufl.indexOf('BELAGERUNGSPLAN_SENKUNG'), buchung: aufl.indexOf('pveVerlusteBuchen') });
/* Der Bericht muss die WIRKLICH gebuchte Zahl tragen. Naennte er `daten.eigeneVerluste`, staende
   dort die ungekuerzte Serverzahl - waehrend eine andere gebucht wird. Genau die Sorte zweite
   Anzeigestelle, gegen die Punkt 6 der Checkliste geschrieben ist. */
check('1g: der Bericht traegt die GEBUCHTEN Verluste, nicht die rohe Serverzahl',
  /eigeneVerluste:\s*verluste/.test(aufl) && !/eigeneVerluste:\s*daten\.eigeneVerluste/.test(aufl));
check('1h: kam kein Kampf zustande, wird die Vormerkung zurueckgegeben',
  /state\.belagerungsplan\s*=\s*true/.test(aufl));

// ---------------------------------------------------------------- Aufbau fuer das laufende Spiel
const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
const FEST_PLATZ = '3';
const FEST = { id:'fest-1', stufe:'sternenfeste', platz:FEST_PLATZ, sorte:'eisen',
  kernMax:1200000, kern:900000, hort:250000, hortProto:180,
  seit:Date.now(), letzteReifung:Date.now(), beitraege:{}, schlaege:{} };
const FELD = { systeme:[SYS], felder:{ [SYS]: { plaetze:{}, festung: FEST } } };

// Die Serverantwort ist in BEIDEN Laeufen dieselbe - nur die Vormerkung unterscheidet sie. Damit
// liegt der Anker ausserhalb der geprueften Rechnung (Arbeitsregel 62).
const SERVER_VERLUSTE = { cruisers: 20 };

function grundstand(zusatz){
  return JSON.stringify(Object.assign({
    tutorialSeen:true, newbieWelcomeSeen:true, lastTick:Date.now(),
    nextPlanetEventCheck: Date.now() + 36e5, nextTraderCheck: Date.now() + 36e5,
    lastEventTime: Date.now() + 36e5, activeEvent:null,
    seenTabHints:['basis','karte','galaxie','fortschritt','flotte','forschung','werft','verteidigung','markt','allianz','abgrund','profil'],
    resources:{energie:5e5,erz:5e5,kristalle:3e5,deuterium:3e5,antimaterie:1e4,forschungspunkte:2e4},
    buildings:{solar:20,mine:12,labor:8,lager:200,werft:10},
    research:{}, colonies:{}, activeBasePlanet:'home', xp:50000, credits:20000, buffs:[],
    colonyNames:{}, modules:{}, shipModules:{}, inventory:{},
    fleet:{ cruisers:100, jaeger:60, missions:[] }
  }, zusatz));
}

function schlagMission(mitPlan){
  const jetzt = Date.now();
  return { id: 991, type:'festung-angriff', targetId: SYS, system: SYS, festungId: FEST.id,
    stufe: FEST.stufe, stufeName:'Sternenfeste', ziel:'kern',
    belagerungsplan: mitPlan, startTime: jetzt - 7200000, endTime: jetzt - 5000,
    fleetName:'Testverband', composition:{ cruisers:100 } };
}

function backend(store, opt){
  opt = opt || {};
  return async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'asteroid/field') return j(FELD);
    if (p === 'festung/angriff'){
      store.__schlaege = (store.__schlaege || 0) + 1;
      if (opt.festungFehler) return j({ error:'nix' }, 404);
      return j({ ok:true, schaden:50000, gefallen:false, kern:850000, kernMax:1200000,
        anteil:0.1, teilnehmer:1, eigeneVerluste: SERVER_VERLUSTE,
        ziel:'kern', teilSchaden:0, zerstoert:null, rollenFaktor:1, bauteile:{} });
    }
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'reports'){
      if (req.method() === 'POST'){ try { (store.__berichte = store.__berichte||[]).unshift(JSON.parse(req.postData()||'{}').report || {}); } catch(e){} return j({ ok:true }); }
      return j({ reports: store.__berichte || [] });
    }
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|notifications|cosmetics/.test(p))
      return j(/pending/.test(p) ? { reward:null } : []);
    return j({});
  };
}

async function tab(browser, stand, opt){
  const store = { [SAVE_KEY]: stand };
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1400} }));
  const page = await ctx.newPage();
  await page.route('**/api/**', backend(store, opt));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.addInitScript(() => {
    window.__logZeilen = [];
    const an = () => {
      const box = document.getElementById('log');
      if (!box) return false;
      const merke = () => { const t = (box.innerText||'').trim(); if (t && window.__logZeilen[window.__logZeilen.length-1] !== t) window.__logZeilen.push(t); };
      new MutationObserver(merke).observe(box, { childList:true, characterData:true, subtree:true });
      merke(); return true;
    };
    if (!an()) document.addEventListener('DOMContentLoaded', an);
  });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  return { ctx, page, store, stand: () => { try { return JSON.parse(store[SAVE_KEY]||'{}'); } catch(e){ return {}; } } };
}

(async () => {
  const browser = await starteBrowser();
  let klickFehler = null;
  const klick = async (page, sel) => {
    const da = await page.evaluate(s => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
    if (!da && !klickFehler) klickFehler = sel;
    return da;
  };

  // ------------------------------------------------- 2) Aktivierung ueber den Spielerweg
  const t2 = await tab(browser, grundstand({ inventory:{ belagerungsplan: 2 } }));
  await klick(t2.page, '[data-tab="fortschritt"]');
  await t2.page.waitForTimeout(900);
  await klick(t2.page, '[data-item-toggle="belagerungsplan"]');
  await t2.page.waitForTimeout(700);
  const knopfDa = await t2.page.evaluate(() => !!document.querySelector('[data-item-activate="belagerungsplan"]'));
  // Eine Messung, die nichts anklickt, darf nicht gruen sein (Arbeitsregel 28).
  check('2-vorab: der Aktivieren-Knopf steht bereit', knopfDa === true, { knopfDa });
  await klick(t2.page, '[data-item-activate="belagerungsplan"]');
  await t2.page.waitForTimeout(1200);
  const nach1 = t2.stand();
  check('2a: die Aktivierung setzt die Vormerkung', nach1.belagerungsplan === true, { wert: nach1.belagerungsplan });
  check('2b: und verbraucht genau EIN Exemplar', (nach1.inventory||{}).belagerungsplan === 1,
    { bestand: (nach1.inventory||{}).belagerungsplan });

  /* NICHT blind noch einmal auf den Aufklapper klicken: Nach der Aktivierung steht die Karte
     unter Umstaenden noch offen, und der zweite Klick klappte sie dann ZU - der Aktivieren-Knopf
     war weg, `klick` lief ins Leere, und „der zweite Versuch verbraucht nichts" waere aus dem
     falschen Grund gruen gewesen (Arbeitsregel 28; genau derselbe Fehlgriff wie in
     test_gegenstand_verbrauch). Deshalb erst nachsehen, dann nur bei Bedarf aufklappen. */
  const offen = await t2.page.evaluate(() => !!document.querySelector('[data-item-activate="belagerungsplan"]'));
  if (!offen){
    await klick(t2.page, '[data-item-toggle="belagerungsplan"]');
    await t2.page.waitForTimeout(500);
  }
  const knopfDa2 = await t2.page.evaluate(() => !!document.querySelector('[data-item-activate="belagerungsplan"]'));
  check('2-vorab2: der Knopf steht fuer den zweiten Versuch bereit', knopfDa2 === true, { knopfDa2 });
  await klick(t2.page, '[data-item-activate="belagerungsplan"]');
  await t2.page.waitForTimeout(1200);
  const nach2 = t2.stand();
  check('2c: der zweite Versuch verbraucht NICHTS', (nach2.inventory||{}).belagerungsplan === 1,
    { bestand: (nach2.inventory||{}).belagerungsplan });
  const zeilen2 = await t2.page.evaluate(() => window.__logZeilen || []);
  check('2d: und nennt den GRUND, statt stumm zu verpuffen',
    zeilen2.some(z => /bereits vorgemerkt/.test(z) && /bleibt dir erhalten/.test(z)),
    { letzte: zeilen2.slice(-3) });
  await t2.ctx.close();

  // ------------------------------------------------- 3) Die Vorschau MISST (Paar-Messung)
  async function vorschauText(mitPlan){
    const t = await tab(browser, grundstand(mitPlan ? { belagerungsplan:true } : {}));
    await klick(t.page, '.tab-btn[data-tab="karte"]');
    await t.page.waitForTimeout(800);
    await oeffneSystemUeberSektoren(t.page, SYS);
    await t.page.evaluate(() => { const n = document.querySelector('[data-map-festung]'); if (n) n.dispatchEvent(new MouseEvent('click', {bubbles:true})); });
    await t.page.waitForTimeout(600);
    await t.page.evaluate(() => {
      const m = document.querySelector('.kmenu');
      const b = m && Array.from(m.querySelectorAll('button,a')).find(x => /angreifen/i.test(x.textContent||''));
      if (b) b.click();
    });
    await t.page.waitForTimeout(1400);
    const txt = await t.page.evaluate(() => {
      const o = document.getElementById('fwahlOverlay');
      return o ? (o.innerText || '') : '';
    });
    await t.ctx.close();
    return txt;
  }
  const vOhne = await vorschauText(false);
  const vMit  = await vorschauText(true);
  const spanne = t => (t.match(/rechne mit rund (\d+)[–-](\d+)%/) || []).slice(1, 3).join('-');
  const sOhne = spanne(vOhne), sMit = spanne(vMit);
  check('3-vorab: beide Laeufe zeigen ueberhaupt eine Verlustspanne', !!sOhne && !!sMit, { sOhne, sMit });
  /* Der Kern der ganzen Datei: Die ZAHL muss sich unterscheiden. Eine Pruefung auf das Wort
     „Belagerungsplan" waere auch bei voellig wirkungslosem Code gruen (Arbeitsregel 61). */
  check('3a: die Vorschau zeigt MIT Plan eine kleinere Verlustspanne', !!sOhne && !!sMit && sOhne !== sMit,
    { ohnePlan: sOhne, mitPlan: sMit });
  check('3b: und nennt die ungekuerzte Spanne als Gegenrechnung',
    /Belagerungsplan vorgemerkt/.test(vMit) && new RegExp('ohne ihn wären es ' + sOhne.replace('-', '[–-]')).test(vMit),
    { auszug: (vMit.match(/Belagerungsplan[^\n]*/) || [''])[0] });
  check('3c: ohne Vormerkung steht die Zeile NICHT da', !/Belagerungsplan vorgemerkt/.test(vOhne));

  // ------------------------------------------------- 4) Die gebuchten Verluste (Paar-Messung)
  async function schlag(mitPlan){
    const t = await tab(browser, grundstand({ fleet:{ cruisers:100, jaeger:60, missions:[schlagMission(mitPlan)] } }));
    await t.page.waitForTimeout(3500);
    const s = t.stand();
    const zeilen = await t.page.evaluate(() => window.__logZeilen || []);
    const bericht = (t.store.__berichte || []).find(b => b && b.type === 'festung-angriff') || null;
    await t.ctx.close();
    return { rest: (s.fleet||{}).cruisers, schlaege: t.store.__schlaege || 0, zeilen, bericht, plan: s.belagerungsplan };
  }
  const aOhne = await schlag(false);
  const aMit  = await schlag(true);
  check('4-vorab: beide Laeufe haben den Schlag wirklich ausgefuehrt',
    aOhne.schlaege === 1 && aMit.schlaege === 1 && typeof aOhne.rest === 'number' && typeof aMit.rest === 'number',
    { ohne: aOhne.schlaege, mit: aMit.schlaege, restOhne: aOhne.rest, restMit: aMit.rest });
  check('4a: ohne Plan wird die volle Serverzahl gebucht', aOhne.rest === 100 - SERVER_VERLUSTE.cruisers,
    { rest: aOhne.rest, erwartet: 100 - SERVER_VERLUSTE.cruisers });
  const erwartetMit = 100 - Math.floor(SERVER_VERLUSTE.cruisers * (1 - Number(senkung)));
  check('4b: mit Plan bleiben MEHR Schiffe uebrig - bei identischer Serverantwort',
    aMit.rest === erwartetMit && aMit.rest > aOhne.rest,
    { ohnePlan: aOhne.rest, mitPlan: aMit.rest, erwartet: erwartetMit });
  /* Der Bericht muss die WIRKLICH gebuchte Zahl nennen - und ausdruecklich NICHT die rohe
     Serverzahl. Beide Haelften gehoeren dazu: Die erste allein waere auch erfuellt, wenn Buchung
     und Bericht gemeinsam falsch lieferen (Arbeitsregel 62). */
  const gebucht = 100 - aMit.rest;
  check('4c: der Bericht nennt die GEBUCHTE Zahl, nicht die rohe Serverzahl',
    !!aMit.bericht && (aMit.bericht.eigeneVerluste||{}).cruisers === gebucht
    && gebucht !== SERVER_VERLUSTE.cruisers,
    { imBericht: aMit.bericht && aMit.bericht.eigeneVerluste, gebucht, roh: SERVER_VERLUSTE.cruisers });
  check('4d: und weist den Plan aus', !!aMit.bericht && aMit.bericht.belagerungsplan === true
    && aMit.bericht.planGespart === SERVER_VERLUSTE.cruisers - gebucht,
    { plan: aMit.bericht && aMit.bericht.belagerungsplan, gespart: aMit.bericht && aMit.bericht.planGespart,
      erwartet: SERVER_VERLUSTE.cruisers - gebucht });
  check('4e: ohne Plan weist der Bericht ihn NICHT aus',
    !!aOhne.bericht && aOhne.bericht.belagerungsplan === false,
    { plan: aOhne.bericht && aOhne.bericht.belagerungsplan });
  check('4f: das Protokoll sagt, was der Plan gebracht hat',
    aMit.zeilen.some(z => /Belagerungsplan hat gewirkt/.test(z)), { letzte: aMit.zeilen.slice(-3) });

  // ------------------------------------------------- 5) Kein Kampf -> Vormerkung zurueck
  const t5 = await tab(browser, grundstand({ fleet:{ cruisers:100, jaeger:60, missions:[schlagMission(true)] } }),
    { festungFehler:true });
  await t5.page.waitForTimeout(3500);
  const s5 = t5.stand();
  const z5 = await t5.page.evaluate(() => window.__logZeilen || []);
  await t5.ctx.close();
  check('5-vorab: der Schlag ist wirklich am Server gescheitert',
    (t5.store.__schlaege || 0) === 1 && (s5.fleet||{}).cruisers === 100,
    { schlaege: t5.store.__schlaege, rest: (s5.fleet||{}).cruisers });
  /* Der Zweig kostet nach eigener Ansage NICHTS. Ein Gegenstand, der dabei verschwaende, waere
     genau der Fehler, der am 21.08.2026 fuer dreizehn Gegenstaende behoben wurde. */
  check('5a: die Vormerkung ist zurueck', s5.belagerungsplan === true, { wert: s5.belagerungsplan });
  check('5b: und der Spieler erfaehrt es', z5.some(z => /Belagerungsplan bleibt dir erhalten/.test(z)),
    { letzte: z5.slice(-3) });

  check('9-schluss: jeder Klick hat sein Ziel getroffen', klickFehler === null, { verfehlt: klickFehler });
  await browser.close();
  ende();
})();
