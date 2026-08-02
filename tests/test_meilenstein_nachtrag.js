// Forschungs-Meilensteine werden beim LADEN nachgetragen (v8.378.0, Fehlerbehebung).
//
// DER FEHLER: checkResearchMilestones() lief ausschliesslich in processResearch(), also nur in dem
// Moment, in dem eine Forschung fertig wird. Wer mit der Forschung durch ist, erlebt diesen Moment
// nie wieder - ein solches Konto konnte einen neu hinzugekommenen Meilenstein grundsaetzlich nicht
// mehr bekommen. Das traf ausgerechnet die Aenderungen der beiden Vorversionen am haertesten:
// "Vollstaendige Forschung" wurde in v8.376.0 ueberhaupt erst erreichbar gemacht - und blieb fuer
// die einzige Gruppe, die sie erfuellen kann (wer alles erforscht hat), weiterhin unerreichbar.
//
// Der Test faehrt das Spiel deshalb ECHT hoch, mit einem Spielstand, in dem jede Forschung mit
// Maximalstufe voll ausgebaut ist und researchMilestones leer - genau die Lage eines Altkontos -
// und liest danach den SPEICHERSTAND aus, nicht die Anzeige. Der Speicherstand ist der Beweis:
// Was dort nicht landet, ist beim naechsten Laden wieder weg.
const { starteBrowser, devices, SPIELDATEI, SPIEL_URL } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

function block(von, bis){
  const a = src.indexOf(von);
  const b = src.indexOf(bis, a + von.length);
  return src.slice(a, b + bis.length);
}
const RESEARCH_DEFS = new Function(block('const RESEARCH_DEFS', '\n  ];') + '; return RESEARCH_DEFS;')();
const RESEARCH_MILESTONES = new Function(block('const RESEARCH_MILESTONES = [', '\n  ];') + '; return RESEARCH_MILESTONES;')();
const isEndless = r => !!(r && r.endless);

// Voll ausgebaut - aber nur die Forschungen MIT Maximalstufe. Die Ewigkeitsforschungen bleiben auf
// 0: Genau so sieht das Konto aus, um das es geht, und genau daran haette sich der alte allmax
// verschluckt.
const vollErforscht = {};
RESEARCH_DEFS.forEach(r => { if (!isEndless(r)) vollErforscht[r.key] = r.maxLevel; });

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData() || '{}').value; } catch(e){} return j({ ok:true }); }
    return store[k] === undefined ? j({ value:null }) : j({ value: store[k] });
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))
    return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

const gespeichert = store => {
  const v = store['kepler7-save-v3'];
  if (!v) return null;
  try { return typeof v === 'string' ? JSON.parse(v) : v; } catch(e){ return null; }
};

async function warteAuf(page, pruefe, maxMs){
  const bis = Date.now() + (maxMs || 20000);
  while (Date.now() < bis){
    if (await pruefe()) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

const stand = zusatz => JSON.stringify(Object.assign({
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:2e4, forschungspunkte:3e4 },
  buildings:{ solar:20, mine:18, lager:20, werft:12, labor:12 },
  research:{}, colonies:{}, activeBasePlanet:'home',
  player:{ id:'u', name:'A', avatarKey:null },
  fleet:{ jaeger:100, missions:[] },
  battleStats:{ wins:1, losses:0 }, xp:20000, credits:50000, buffs:[], lastTick:Date.now(),
  colonyNames:{}
}, zusatz));

async function starte(browser, saveJson){
  const store = { 'kepler7-save-v3': saveJson };
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{ width:900, height:1400 } }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForSelector('.tab-btn[data-tab="galaxie"]', { timeout: 60000 });
  return { page, ctx, store, errs };
}

(async () => {
  const browser = await starteBrowser();

  // ---------------------------------------------------------------- 1) Altkonto bekommt sie nach
  {
    const { page, ctx, store, errs } = await starte(browser, stand({
      research: vollErforscht, researchMilestones: {}, ascension: { count:1, essence:5, tree:{prod:0,speed:0,combat:0,start:0,expedition:0,leere:0} }
    }));

    const alleKeys = RESEARCH_MILESTONES.map(m => m.key);
    const da = await warteAuf(page, async () => {
      const s = gespeichert(store);
      return !!(s && s.researchMilestones && alleKeys.every(k => s.researchMilestones[k]));
    }, 40000);

    const s = gespeichert(store) || {};
    check('1: der Spielstand wurde ueberhaupt zurueckgeschrieben', !!s.researchMilestones);
    check('1: JEDER Meilenstein ist nachgetragen', da,
      alleKeys.filter(k => !(s.researchMilestones || {})[k]));
    // Der wichtigste einzelne: Er war in v8.376.0 erreichbar gemacht worden und blieb es fuer
    // genau dieses Konto trotzdem nicht.
    check('1: "Vollstaendige Forschung" ist dabei', !!(s.researchMilestones || {}).allmax);

    const erwartet = 5 + RESEARCH_MILESTONES.reduce((a, m) => a + m.essence, 0);
    check('1: die Sternenessenz stimmt auf den Punkt', (s.ascension || {}).essence === erwartet,
      { ist: (s.ascension || {}).essence, soll: erwartet });
    const erwarteteKredite = 50000 + RESEARCH_MILESTONES.reduce((a, m) => a + m.credits, 0);
    check('1: die Kredite stimmen auf den Punkt', s.credits === erwarteteKredite,
      { ist: s.credits, soll: erwarteteKredite });
    check('1: keine Konsolenfehler beim Laden', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  // ---------------------------------------------------------------- 2) GEGENPROBE: kein Geschenk
  // Ohne diesen Abschnitt wuerde der Test auch dann gruen bleiben, wenn der Nachtrag jedem alles
  // gibt. Ein Konto ganz ohne Forschung darf beim Laden NICHTS bekommen.
  {
    const { page, ctx, store } = await starte(browser, stand({
      research: {}, researchMilestones: {}, ascension: { count:0, essence:0, tree:{prod:0,speed:0,combat:0,start:0,expedition:0,leere:0} }
    }));
    await page.waitForTimeout(6000);
    const s = gespeichert(store) || {};
    const vergeben = Object.keys(s.researchMilestones || {});
    check('2: ein Konto ohne Forschung bekommt keinen Meilenstein', vergeben.length === 0, vergeben);
    check('2: und keine Sternenessenz', ((s.ascension || {}).essence || 0) === 0, (s.ascension || {}).essence);
    await ctx.close();
  }

  // ---------------------------------------------------------------- 3) Keine Doppelvergabe
  // Ein Konto, das die Marker schon traegt, darf beim Laden nicht ein zweites Mal kassieren -
  // sonst waere jeder Reload eine Essenzquelle.
  {
    const marker = {};
    RESEARCH_MILESTONES.forEach(m => marker[m.key] = true);
    const { page, ctx, store } = await starte(browser, stand({
      research: vollErforscht, researchMilestones: marker,
      ascension: { count:1, essence:99, tree:{prod:0,speed:0,combat:0,start:0,expedition:0,leere:0} }
    }));
    await page.waitForTimeout(6000);
    const s = gespeichert(store);
    // Kein Rueckschreiben ist hier das erwartete Ergebnis (nichts vergeben -> kein save()), ein
    // zurueckgeschriebener Stand mit UNVERAENDERTEN Werten aber genauso richtig - der Tick
    // speichert ohnehin regelmaessig. Geprueft wird deshalb der Wert, nicht das Schreiben.
    check('3: ein Reload vergibt nichts ein zweites Mal',
      !s || (s.ascension || {}).essence === 99, s && (s.ascension || {}).essence);
    check('3: und die Kredite bleiben unveraendert', !s || s.credits === 50000, s && s.credits);
    await ctx.close();
  }

  // ---------------------------------------------------------------- 4) Der Aufruf steht an der
  // Ladestelle - und NICHT in applyStateDefaults(), das auch beim Prestige und beim Zuruecksetzen
  // laeuft. Dort waere er wirkungslos (die Forschung ist gerade auf null) und verwirrend.
  {
    const ladeStelle = block('  async function load(){', '\n  }');
    check('4: der Nachtrag steht in load()', /checkResearchMilestones\(\)\s*>\s*0/.test(ladeStelle));
    const defaults = block('  function applyStateDefaults(){', '\n  }');
    check('4: und NICHT in applyStateDefaults()', !/checkResearchMilestones/.test(defaults));
    // Ein Ton, nicht vier. Beim Nachtragen fallen mehrere Meilensteine gleichzeitig.
    const fn = block('  function checkResearchMilestones(){', '\n  }');
    check('4: der Erfolgston spielt hoechstens einmal je Lauf',
      /if \(neu === 0\) playSound\('achieve'\)/.test(fn));
    check('4: die Funktion meldet die Zahl der Neuvergaben zurueck', /return neu;/.test(fn));
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
