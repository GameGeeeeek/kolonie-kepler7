// Die Ueberfall-Abwehr wuerfelt drei Kampfphasen (17.08.2026, Entscheidung Sascha:
// "Mechanik an den Text angleichen").
//
// WAS AUF DEM SPIEL STEHT: Startseite und Hilfe versprechen seit v8.295.0 "Jedes Gefecht laeuft
// in drei Phasen" mit NPC-Spielraum 5-95% - die Ueberfall-Abwehr war aber der letzte verbliebene
// Ein-Wurf-Kampf und nutzte obendrein die engeren PvP-Grenzen 10-90%. Der Patchnote zu v8.443
// nannte sogar den Leerenriss "den letzten Kampf mit einem einzigen Wuerfelwurf" - der Ueberfall
// war uebersehen. Dieser Test haelt fest, dass die Abwehr jetzt durch dieselbe Phasen-Maschinerie
// laeuft wie jeder andere Kampf - und dass sie dabei nicht den Konter doppelt zaehlt.
//
// GEPRUEFT WIRD:
//   1. Quelltext, gescoped auf executeRaid (Arbeitsregel 39): Die Aufloesung ruft
//      resolveBattlePhases mit der Kraft OHNE Konter (raiderPowerBase) - die Funktion gewichtet
//      den Konter je Phase selbst, schon multipliziert uebergeben hiesse doppelt zaehlen. Der
//      alte Ein-Wurf-Deckel (Math.max(0.1, Math.min(0.9, ...))) ist aus dem Block verschwunden,
//      beide Berichte tragen die Phasenurteile und die Abwehrchance.
//   2. Der Spaeh-Bericht rechnet die Abwehrchance mit DERSELBEN Funktion (battleWinChance) vorab.
//   3. Am laufenden Spiel: Ein faelliger Ueberfall erzeugt einen Bericht mit drei Phasen
//      (anflug/haupt/rueckzug), jede Einzelchance innerhalb der NPC-Phasen-Deckel (aus der Datei
//      gelesen, nicht eingetippt - Arbeitsregel 2), Abwehrchance 5-95%, Konter als Zahl.
//      Der AUSGANG wird bewusst nicht verlangt - er ist gewuerfelt; gemessen wird die Verdrahtung.
//
// GEGENPROBE (Arbeitsregel 1, beide Richtungen): Am alten Stand fallen 1a/1c/1d (kein
// resolveBattlePhases im Block, alter Deckel noch da, keine phasen im Bericht) und 3b (der
// Live-Bericht traegt keine Phasen).
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

function funktionsBlock(name){
  const von = JS.indexOf('function ' + name + '(');
  const bis = von < 0 ? -1 : JS.indexOf('\n  function ', von + 10);
  return (von >= 0 && bis > von) ? JS.slice(von, bis) : '';
}

// ---- 1) executeRaid ------------------------------------------------------------------------
{
  const block = funktionsBlock('executeRaid');
  check('1-anker: executeRaid ist auffindbar und nicht leer', block.length > 500, block.length);
  check('1a: die Aufloesung wuerfelt die drei Phasen mit der Kraft OHNE Konter (kein Doppelzaehlen)',
    /resolveBattlePhases\(raiderPowerBase,/.test(block), (block.match(/resolveBattlePhases\([^)]*/) || [])[0]);
  check('1b: die NPC-Deckel sind die Voreinstellung - keine eigenen Grenzen uebergeben',
    /resolveBattlePhases\(raiderPowerBase, dpMitAufstellung, konterMult\)/.test(block));
  check('1c: der alte Ein-Wurf-Deckel 10-90% ist aus der ENTSCHEIDUNG verschwunden',
    !/repelChance/.test(block), (block.match(/repelChance[^\n]*/) || ['-'])[0]);
  const berichte = (block.match(/phasen:kampf\.phasen/g) || []).length;
  check('1d: BEIDE Berichte (Abwehr und Durchbruch) tragen die Phasenurteile', berichte === 2, berichte);
  check('1e: beide Berichte tragen die vorab berechnete Abwehrchance',
    (block.match(/abwehrChancePct/g) || []).length >= 3);
}

// ---- 2) Der Spaeh-Bericht rechnet mit derselben Funktion -----------------------------------
{
  const block = funktionsBlock('resolveRaidScout');
  check('2-anker: resolveRaidScout ist auffindbar', block.length > 300, block.length);
  check('2a: die Vorab-Chance kommt aus battleWinChance - nicht aus einer zweiten Formel',
    /battleWinChance\(raiderPower, dpEffNow, konterMultNow\)/.test(block));
  check('2b: der Spaeh-Bericht traegt die Abwehrchance', /abwehrChancePct/.test(block) && /pushReport\(\{ type:'raid-scout'[^\n]*abwehrChancePct/.test(block));
}

// ---- 3) Am laufenden Spiel ------------------------------------------------------------------
// Phasen-Deckel aus der Datei ablesen (Arbeitsregel 2: nichts eintippen).
// Beide Konstanten stehen in EINER const-Zeile - das Muster darf kein eigenes 'const ' verlangen.
const PHASE_MIN = Number((JS.match(/PHASE_CHANCE_MIN = ([\d.]+)/) || [])[1]);
const PHASE_MAX = Number((JS.match(/PHASE_CHANCE_MAX = ([\d.]+)/) || [])[1]);
check('3-vorab: die NPC-Phasen-Deckel stehen als Konstanten da', PHASE_MIN > 0 && PHASE_MAX < 1, { PHASE_MIN, PHASE_MAX });

const SAVE_KEY = 'kepler7-save-v3';
function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (p === 'reports'){
    if (req.method() === 'POST'){ try { store.__berichte.unshift(JSON.parse(req.postData()||'{}').report || {}); } catch(e){} return j({ ok:true }); }
    return j({ reports: store.__berichte });
  }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

(async () => {
  const browser = await starteBrowser();
  const store = { __berichte: [] };
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));

  // Erst booten, dann den echten Boot-Stand als Fixture-Grundlage nehmen (Arbeitsregel 4).
  // Der Stand kommt aus dem SERVER-Mock, nicht aus localStorage - mit Token speichert das Spiel
  // versioniert gegen /api/storage (dieselbe Lesart wie test_t1_deckel/test_labor_deckel).
  await page.goto(SPIEL_URL); await page.waitForTimeout(3000);
  for (let i = 0; i < 24 && store[SAVE_KEY] === undefined; i++) await page.waitForTimeout(500);
  const basis = JSON.parse(store[SAVE_KEY] || '{}');
  await ctx.close();
  check('3-0: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
  if (!basis.buildings){ await browser.close(); return ende(); }

  const st = JSON.parse(JSON.stringify(basis));
  st.tutorialSeen = true; st.newbieWelcomeSeen = true;
  Object.assign(st.buildings, { turm:15, laser:10, schild:10, raketen:8, solar:20 });
  st.fleet = Object.assign(st.fleet || { missions: [] }, { jaeger: 30, cruisers: 10, missions: [] });
  // Der Ueberfall ist FAELLIG: nextRaidTime in der Vergangenheit, die anfliegende Flotte steht.
  st.nextRaidTime = Date.now() - 5000;
  st.incomingRaid = { faction:'Testflotte', icon:'ti-alert-triangle', power:400,
    fleet:{ jaeger:15, cruisers:5, destroyers:2 }, preview:'mittel', approxPoints:400,
    planet:'home', detected:true, superAttack:false };
  // Uebrige Ereignis-Uhren pinnen (Arbeitsregel 18) - NUR die Raid-Uhr muss feuern.
  const fern = Date.now() + 365*24*3600*1000;
  for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextFactionGift']) st[k] = fern;
  st.activeEvent = null; st.buffs = [];
  store[SAVE_KEY] = JSON.stringify(st);

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  page2.on('pageerror', e => errs.push(String(e)));
  await page2.route('**/api/**', backend(store));
  await page2.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page2.goto(SPIEL_URL);
  // Warten, bis der Ueberfall-Bericht im Mock angekommen ist (hoechstens 20 s).
  for (let i = 0; i < 40 && !(store.__berichte || []).some(b => b && b.type === 'raid'); i++) await page2.waitForTimeout(500);

  const bericht = (store.__berichte || []).find(b => b && b.type === 'raid');
  check('3a: der faellige Ueberfall hat einen Bericht erzeugt', !!bericht,
    (store.__berichte || []).map(b => b && b.type).slice(0, 5));
  if (bericht){
    const ph = bericht.phasen || [];
    check('3b: der Bericht traegt DREI Phasen (anflug/haupt/rueckzug)',
      ph.length === 3 && JSON.stringify(ph.map(p => p.key)) === JSON.stringify(['anflug','haupt','rueckzug']),
      ph.map(p => p && p.key));
    check('3c: jede Einzelchance haelt die NPC-Phasen-Deckel aus der Datei ein',
      ph.length === 3 && ph.every(p => p.chance >= PHASE_MIN - 1e-9 && p.chance <= PHASE_MAX + 1e-9),
      ph.map(p => p && +Number(p.chance).toFixed(3)));
    check('3d: die Abwehrchance liegt im Gesamtspielraum 5-95%',
      typeof bericht.abwehrChancePct === 'number' && bericht.abwehrChancePct >= 5 && bericht.abwehrChancePct <= 95,
      bericht.abwehrChancePct);
    check('3e: die Konterwirkung steht als Zahl im Bericht',
      typeof bericht.counterMult === 'number' && bericht.counterMult > 0, bericht.counterMult);
    check('3f: der Ausgang passt zu den Phasenurteilen (zwei von drei entscheiden)',
      (ph.filter(p => p.gewonnen).length >= 2) === (bericht.result === 'loss'),
      { siegeAngreifer: ph.filter(p => p.gewonnen).length, result: bericht.result });
  }
  check('3g: keine JS-Fehler', errs.length === 0, errs.slice(0, 3));

  await ctx2.close();
  await browser.close();
  ende();
})();
