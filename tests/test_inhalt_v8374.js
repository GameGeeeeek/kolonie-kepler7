// Vier weitere Inhaltsluecken, geschlossen am 02.08.2026 (v8.374.0).
//
// Wie beim Vorgaenger test_inhalt_v8373.js wird bei jedem der vier ausdruecklich auch die
// BEHAUPTETE LUECKE mitgeprueft, nicht nur die neue Mechanik.
//
// DIE DREI ENTSCHEIDUNGEN, DIE HIER FESTGEHALTEN WERDEN
//
//   1. Die Raid-Boss-Regeln duerfen die LEBENSPUNKTE nicht anfassen. Die Belohnung faellt je WELLE
//      an - ein zaeherer Boss braucht mehr Wellen und zahlt damit oefter. Derselbe Grund wie beim
//      Weltboss einen Tag zuvor.
//   2. Die Trefferschwaeche ist ein MALUS bei fehlendem Schiffstyp, kein Bonus bei vorhandenem.
//      Sonst koennte die Belohnungsrate steigen statt nur sinken.
//   3. Der Signalring wirkt ORTSGEBUNDEN und additiv in der vorhandenen gedeckelten Gruppe - eine
//      eigene Multiplikation waere das aufschaukelnde Muster, vor dem CLAUDE.md warnt.
const { starteBrowser, SPIELDATEI, SPIEL_URL } = require('./lib/umgebung');
const fs = require('fs');
const path = require('path');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const BE_PFAD = path.join(path.dirname(SPIELDATEI), '..', 'kolonie-kepler7-backend', 'server.js');
const be = fs.existsSync(BE_PFAD) ? fs.readFileSync(BE_PFAD, 'utf8') : '';
check('Backend-Repo liegt daneben (ohne es sind die Spiegelungen UNGEPRUEFT)', !!be, BE_PFAD);

function schnitt(text, von, bis, ohneEnde){
  const a = text.indexOf(von);
  if (a < 0) return '';
  const b = text.indexOf(bis, a + von.length);
  return b < 0 ? '' : text.slice(a, ohneEnde ? b : b + bis.length);
}

// ================================================================== 1) ALLIANZ-RAID-BOSSE
{
  const tab = schnitt(src, 'const ALLIANCE_RAID_BOSSE = [', '\n  ];');
  check('1: es gibt eine Raid-Boss-Tabelle', tab.length > 300);
  const keys = [...tab.matchAll(/key:'(\w+)'/g)].map(m => m[1]);
  check('1: fuenf Bosse', keys.length === 5, keys);
  // Die alte, feste Benennung darf nicht zurueckkehren.
  check('1: der Name kommt aus der Tabelle, nicht als fester Text',
    !/return 'Sternenfresser - Stufe '\+level/.test(src));
  // Der Kern der Balance-Entscheidung.
  check('1: keine Regel fasst die Lebenspunkte an', !/hp|maxHp/i.test(tab.replace(/\/\/[^\n]*/g, '')), tab.match(/hpMult|maxHp/g));
  check('1: allianceRaidHpFor haengt weiterhin allein an der Stufe',
    /function allianceRaidHpFor\(level\)\{ return Math\.round\(ALLIANCE_RAID_BASE_HP \* Math\.pow\(1\.4, Math\.max\(0, level-1\)\)\); \}/.test(src));
  check('1: Ableitung aus der Stufe, nicht gewuerfelt',
    /ALLIANCE_RAID_BOSSE\[\(Math\.max\(1, level\|0\) - 1\) % ALLIANCE_RAID_BOSSE\.length\]/.test(src)
    && !/ALLIANCE_RAID_BOSSE\[Math\.floor\(Math\.random/.test(src));
  // Jeder Boss braucht Icon und vollstaendigen Beschreibungssatz (CLAUDE.md Regel 7).
  check('1: jeder Boss hat ein Icon', (tab.match(/icon:'ti-[a-z0-9-]+'/g) || []).length === 5, tab.match(/icon:'ti-[a-z0-9-]+'/g));
  const traits = [...tab.matchAll(/trait:'([^']+)'/g)].map(m => m[1]);
  check('1: jeder Boss hat einen vollstaendigen Beschreibungssatz', traits.length === 5 && traits.every(t => t.length > 60), traits.map(t=>t.length));
  // Die Schwaechen muessen echte Schiffsschluessel sein - ein Tippfehler waere sonst unsichtbar,
  // weil "kein Schiff dieses Typs vorhanden" auch bei einem falschen Namen wahr ist.
  const schwaechen = [...tab.matchAll(/schwaeche:'(\w+)'/g)].map(m => m[1]);
  check('1: vier Bosse haben eine Trefferschwaeche, einer keine', schwaechen.length === 4, schwaechen);
  const unbekannt = schwaechen.filter(k => !new RegExp("key:'" + k + "'").test(src));
  check('1: JEDE Trefferschwaeche ist ein echter Schiffsschluessel', unbekannt.length === 0, unbekannt);

  if (be){
    const beTab = schnitt(be, 'const ALLIANCE_RAID_BOSSES = [', '\n];');
    check('1: Backend hat die Boss-Tabelle', beTab.length > 100);
    const feCtx = {}; new Function('ctx', tab + '\n' + schnitt(src, 'function allianceRaidBoss(level){', '\n') + ';ctx.f=allianceRaidBoss;')(feCtx);
    const beCtx = {}; new Function('ctx', beTab + '\n' + schnitt(be, 'function allianceRaidBossOf(level)', '\n') + ';ctx.f=allianceRaidBossOf;')(beCtx);
    const ab = [];
    for (let lvl = 1; lvl <= 12; lvl++){
      const a = feCtx.f(lvl), b = beCtx.f(lvl);
      if (a.key !== b.key || a.schwaeche !== b.schwaeche || a.ohneMult !== b.ohneMult || a.verlustMult !== b.verlustMult){
        ab.push({ lvl, fe:[a.key,a.schwaeche,a.ohneMult,a.verlustMult], be:[b.key,b.schwaeche,b.ohneMult,b.verlustMult] });
      }
    }
    check('1: Frontend und Backend ergeben fuer Stufe 1-12 denselben Boss und dieselben Faktoren', ab.length === 0, ab.slice(0,3));
    const verschieden = new Set([1,2,3,4,5].map(l => feCtx.f(l).ohneMult + '/' + feCtx.f(l).verlustMult));
    check('1: die fuenf Bosse unterscheiden sich wirklich', verschieden.size >= 4, [...verschieden]);
    // Der Malus-statt-Bonus-Punkt, woertlich am Server geprueft.
    check('1: der Server gibt vollen Schaden, WENN der Schiffstyp da ist (Malus statt Bonus)',
      /const schadenMult = hatSchwaeche \? 1 : raidBoss\.ohneMult;/.test(be));
    // 07.08.2026 (v8.438.0) neu gefasst: Der Schock-Status darf die Schwaeche zusaetzlich decken
    // (statusVorher.schock ? true : ...), die REGEL "ohne Schwaeche immer voller Schaden" bleibt -
    // geprueft wird der Term IN der Zuweisung, nicht mehr die woertliche alte Zeile (Arbeitsregel 3).
    check('1: ... und ein Boss ohne Schwaeche gibt immer vollen Schaden',
      /const hatSchwaeche = [^\n]*!raidBoss\.schwaeche \|\| \(comp\[raidBoss\.schwaeche\] \|\| 0\) > 0/.test(be));
    check('1: die Verlustquote bekommt den Boss-Faktor, die alte Spanne bleibt aussen',
      /Math\.max\(0\.05, Math\.min\(0\.6, \(counter \/ \(counter \+ power\)\) \* raidBoss\.verlustMult\)\)/.test(be));
    check('1: der Server liest die Zusammensetzung des abgeflogenen Verbands',
      /doc\.dispatch && doc\.dispatch\.totalComposition/.test(be));
  }
  // Anzeige: eine Regel, die man erst nach der Welle erfaehrt, kann die Allianz nicht einplanen.
  // Beide Karten: die laufende (doc.level) und die Vorschau auf den naechsten (nextLevel).
  // 05.08.2026 neu gefasst: Die Pruefung hing an den LITERALEN Aufrufen
  // `allianceRaidBoss(doc.level).trait` / `allianceRaidBoss(nextLevel).trait`. Seit der Boss
  // waehlbar ist, leitet ihn keine Anzeigestelle mehr aus der Stufe ab - die Eigenschaft steht
  // weiterhin in beiden Karten, nur anders geschrieben. Ein Test, der die Schreibweise festhaelt
  // statt der Eigenschaft, wird bei jedem Umbau rot, ohne dass etwas kaputt ist.
  // Geprueft wird jetzt die Eigenschaft: In der Zeichenfunktion der Raid-Box steht die
  // Boss-Regel zweimal - einmal fuer den laufenden Raid, einmal in der Vorschau.
  {
    const box = schnitt(src, 'function renderAllianceRaidBox(){', '\n  }\n');
    const treffer = (box.match(/\.trait/g) || []).length;
    check('1: die Boss-Eigenschaft steht in BEIDEN Raid-Karten', treffer >= 2,
      { vorkommen: treffer, hinweis:'laufender Raid UND Vorschau auf den naechsten' });
  }
}

// ================================================================== 2) STRAFEXPEDITIONEN
{
  check('2: die Auswahl laeuft ueber eine eigene Funktion, nicht mehr blind zufaellig',
    /const faction = waehleUeberfallFraktion\(\);/.test(src) && !/const faction = RAID_FACTIONS\[Math\.floor\(Math\.random/.test(src));
  const fn = schnitt(src, 'function waehleUeberfallFraktion(){', '\n  }');
  check('2: sie sieht die Feindschaftsstufe an', /factionHostilityLevel\(fid\)/.test(fn));
  check('2: und gewichtet danach', /wurf -= f\.stufe;/.test(fn));
  check('2: ohne Feindschaft bleibt es beim alten Pool', /return RAID_FACTIONS\[Math\.floor\(Math\.random\(\)\*RAID_FACTIONS\.length\)\];/.test(fn));
  // Die Staerke darf NICHT doppelt gerechnet werden - punitiveRaidPowerMult tut das bereits.
  check('2: die Strafexpedition bekommt keinen zweiten Staerke-Faktor', /mult:1\.0, icon:'ti-flag'/.test(fn));
  check('2: der Absender wird im Ueberfall gespeichert (Zeichenkette, unkritisch fuers Backend)',
    /factionId: faction\.factionId \|\| null,/.test(src));
  check('2: das Banner nutzt die echte Fraktionsfarbe statt einer gehashten',
    /if \(name\.includes\(FACTION_DIPLOMACY\[fid\]\.name\)\) return FACTION_DIPLOMACY\[fid\]\.color;/.test(src));
  // Verhalten nachrechnen: ohne Feind nie benannt, mit Feind ueberwiegend benannt, doppelte
  // Gewichtung bei Stufe 2. Die Funktion wird dafuer ausgefuehrt, nicht nur gelesen.
  const bau = (stufen) => {
    const ctx = {};
    new Function('ctx', 'FACTION_DIPLOMACY', 'factionHostilityLevel', 'RAID_FACTIONS',
      schnitt(src, 'const PUNITIVE_NAMED_SHARE', '\n  }') + ';ctx.f=waehleUeberfallFraktion;')
      (ctx, { kartell:{name:'Aschen-Kartell',color:'#1'}, legion:{name:'Eisenlegion',color:'#2'},
              void:{name:'Void-Marodeure',color:'#3'}, schatten:{name:'Schattenbund',color:'#4'} },
       fid => stufen[fid] || 0, [{ name:'Piratenflotte', mult:1.3, icon:'ti-anchor' }]);
    return ctx.f;
  };
  const ohneFeind = bau({});
  let benannt = 0;
  for (let i = 0; i < 400; i++) if (ohneFeind().factionId) benannt++;
  check('2: ohne Feindschaft traegt kein Ueberfall ein Fraktionsgesicht', benannt === 0, benannt);
  const mitFeind = bau({ legion: 2 });
  let mit = 0, namen = new Set();
  for (let i = 0; i < 2000; i++){ const f = mitFeind(); if (f.factionId){ mit++; namen.add(f.factionId); } }
  check('2: mit Feindschaft kommt der Ueberfall ueberwiegend von der beleidigten Fraktion',
    mit / 2000 > 0.68 && mit / 2000 < 0.82, Math.round(mit/2000*100)+'%');
  check('2: und ausschliesslich von IHR, nicht von einer anderen', [...namen].join() === 'legion', [...namen]);
  // Die Gewichtung: Stufe 2 muss rund doppelt so oft schicken wie Stufe 1.
  const zwei = bau({ legion: 2, kartell: 1 });
  const zaehler = { legion:0, kartell:0 };
  for (let i = 0; i < 4000; i++){ const f = zwei(); if (f.factionId) zaehler[f.factionId]++; }
  const verh = zaehler.legion / Math.max(1, zaehler.kartell);
  check('2: Stufe 2 schickt rund doppelt so oft wie Stufe 1', verh > 1.7 && verh < 2.35, Math.round(verh*100)/100);
}

// ================================================================== 3) URMATERIE
{
  check('3: der Urmaterie-Reaktor verbraucht sie jetzt je Stufe',
    /const SPECIAL_UNIT_ITEMS = \{[^}]*urmateriereaktor: 'urmaterie'/.test(src));
  // Die Luecke selbst: vorher gab es NUR den einmaligen unlockItem-Verbrauch.
  check('3: der einmalige Freischalt-Verbrauch besteht weiterhin', /unlockItem:'urmaterie'/.test(src));
  check('3: der Reaktor erklaert den laufenden Verbrauch in seiner Beschreibung',
    /fuer JEDE weitere Stufe wird 1x Urmaterie verbraucht|für JEDE weitere Stufe wird 1x Urmaterie verbraucht/.test(src));
  // Gegenprobe: Urmaterie muss ueberhaupt findbar sein, sonst waere die Senke eine Sackgasse.
  check('3: Urmaterie ist weiterhin ein Fundstueck', /key:'urmaterie', name:'Urmaterie'/.test(src));
}

// ================================================================== 4) ORBITALRING
{
  const foci = schnitt(src, 'const ORBITAL_FOCI = [', '\n  ];');
  const keys = [...foci.matchAll(/key:'(\w+)'/g)].map(m => m[1]);
  check('4: der Ring hat jetzt vier Foki', keys.length === 4, keys);
  check('4: der neue heisst signal und wirkt auf Expeditionen', keys.includes('signal') && /Expeditionsausbeute/.test(foci));
  check('4: jeder Fokus hat ein Icon und eine Beschreibung',
    (foci.match(/icon:'ti-[a-z0-9-]+'/g)||[]).length === 4 && (foci.match(/desc:'/g)||[]).length === 4);
  // Der behobene Anzeigefehler: die Wirkungsangabe darf es nur EINMAL geben.
  check('4: jeder Fokus traegt seine Wirkungsangabe selbst', (foci.match(/wirkung: lvl =>/g)||[]).length === 4);
  check('4: die dreifache Ternaere in der Fokus-Karte ist weg',
    !/cur\.focus==='def' \? '\+'\+\(cur\.level\*8\)/.test(src) && /\$\{fdef\.wirkung\(cur\.level\)\}/.test(src));
  // Und die Rechnung dahinter muss zur Anzeige passen - das war der eigentliche Fehler.
  const ctx = {};
  new Function('ctx', foci + ';ctx.f=ORBITAL_FOCI;')(ctx);
  const prod = ctx.f.find(f => f.key === 'prod');
  check('4: der Produktionsring zeigt +3% je Stufe an, nicht +4%', prod.wirkung(5) === '+15% Produktion', prod.wirkung(5));
  check('4: und die Rechnung im Spiel nutzt dieselben 3%', /if \(orbP && orbP\.focus==='prod'\) mineMult \*= 1 \+ 0\.03\*orbP\.level;/.test(src));
  // Der Signalring wirkt ortsgebunden und additiv.
  check('4: der Signalring liest den STARTPLANETEN, nicht den angezeigten',
    /function expeditionRewardMult\(rewardMult, planetKey\)\{/.test(src)
    && /const ring = planetKey \? orbitalStationOf\(planetKey\) : null;/.test(src));
  // Geprueft wird die REGEL, nicht die Momentaufnahme (Hausregel 3): `signal` muss ein SUMMAND
  // derselben Gruppe sein wie die uebrigen Expeditions-Boni. Vorher stand hier die exakte
  // Zeichenfolge "+ codexExpeditionBonus() + signal)" - am 18.08.2026 kam mit der
  // Aufklaerungs-Doktrin ein weiterer, voellig regelkonformer Summand DAZWISCHEN, und der Test
  // fiel auf korrektem Code durch. Genau der Fall, den test_recycler_sammelauftrag schon einmal
  // hatte: Ein weiterer Summand ist kein Regelbruch, sondern der Beleg, dass die Gruppe benutzt
  // wird.
  // KLAMMERZAEHLUNG statt Regex. Der erste Anlauf nahm "(1 + ascBonus('expedition') ... ) *
  // seasonalLootMult" nicht-gierig - und spannte damit ueber die Multiplikations-Grenze hinweg:
  // Eine Gegenprobe, die `signal` bewusst als EIGENE Multiplikation herausloeste, blieb gruen,
  // weil der Ausschnitt einfach bis in "(1 + signal)" weiterlief. Eine gruene Gegenprobe ist der
  // Befund, nicht der Beweis (Hausregel 26).
  const expGruppe = (() => {
    const start = src.indexOf("(1 + ascBonus('expedition')");
    if (start < 0) return '';
    let tiefe = 0;
    for (let i = start; i < src.length; i++){
      if (src[i] === '(') tiefe++;
      else if (src[i] === ')'){ tiefe--; if (!tiefe) return src.slice(start, i + 1); }
    }
    return '';
  })();
  check('4-vorab: die Expeditions-Bonusgruppe wurde im Quelltext gefunden', expGruppe.length > 0);
  check('4: er zahlt additiv in die vorhandene gedeckelte Gruppe ein',
    /\+\s*signal\b/.test(expGruppe) && /codexExpeditionBonus\(\)/.test(expGruppe),
    expGruppe.slice(0, 200));
  check('4: die Aufloesung reicht den Startplaneten durch',
    /expeditionRewardMult\(m\.rewardMult !== undefined \? m\.rewardMult : 1, planetKey\)/.test(src));
  check('4: und die Vorschau ebenfalls',
    /expeditionMaxResourceFind\(selectedEt\.rewardMult, state\.activeBasePlanet\)/.test(src));
  const ORB = Number((src.match(/ORBITAL_SIGNAL_PER_LEVEL = ([\d.]+)/)||[])[1]);
  check('4: 3% je Stufe, also hoechstens +15% bei Vollausbau', ORB === 0.03 && ORB*5 === 0.15, ORB);
}

// ================================================================== HILFE
{
  const von = src.indexOf('const HELP_SECTIONS');
  const bis = src.indexOf('let helpOpenSections', von);
  const hilfe = (von > 0 && bis > von) ? src.slice(von, bis) : '';
  check('H: HELP_SECTIONS-Block ausgeschnitten', hilfe.length > 50000, hilfe.length);
  for (const [was, wort] of [['die Raid-Bosse','Schwarmmutter'], ['den Signalring','Signalring'],
                             ['den behobenen Anzeigefehler','+20% Produktion']]){
    check('H: die Hilfe erklaert ' + was, hilfe.includes(wort));
  }
}

// ================================================================== BROWSER
(async () => {
  const store = { 'kepler7-save-v3': JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
    seenTabHints:{ basis:1, expedition:1 },
    resources:{ energie:9e5, erz:9e5, kristalle:9e5, deuterium:9e5, antimaterie:9e4, forschungspunkte:9e4 },
    buildings:{ solar:22, mine:20, labor:14, werft:15, lager:14 }, research:{ rsolar:8, rexpedition:5 },
    fleet:{ jaeger:400, forscher:10, missions:[] }, colonies:{}, activeBasePlanet:'home',
    orbitalStations:{ home:{ focus:'signal', level:3 } },
    player:{ id:'u', name:'K', allianceTag:'', avatarKey:null }, xp:120000, buffs:[], lastTick:Date.now() }) };
  const backend = async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s=200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'K', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
  const b = await starteBrowser();
  const ctx = await b.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend);
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
  });
  for (const t of ['basis','expedition']){
    await page.evaluate(x => { const el = document.querySelector('.tab-btn[data-tab="'+x+'"]'); if (el) el.click(); }, t);
    await page.waitForTimeout(900);
  }
  const sicht = await page.evaluate(() => {
    const kopie = document.body.cloneNode(true);
    kopie.querySelectorAll('script, style, template').forEach(e => e.remove());
    return kopie.textContent || '';
  });
  // Der Signalring ist im Spielstand gesetzt - seine Wirkungsangabe muss auf der Karte stehen.
  check('B: die Orbitalring-Karte nennt den Signalring samt Wirkung',
    /Signalring/.test(sicht) && /Expeditionsausbeute/.test(sicht));
  check('B: keine Skriptfehler', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
