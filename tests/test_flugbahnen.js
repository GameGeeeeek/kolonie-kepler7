// Flottenbewegungen auf der Sektorkarte (01.08.2026).
//
// DER BEFUND
// ----------
// buildMap() zeichnete GENAU EINE Missionsart: die Erkundung. Ein Angriff, der zwei Stunden
// unterwegs ist, sah auf der Karte aus wie gar nichts - obwohl das Spiel um Flugzeiten viel
// Aufhebens macht (langsamstes Schiff, Werftmarken-Tempo, Allianzbasis −10%).
//
// ZWEI DINGE, DIE DIESER TEST FESTHÄLT
//
//   1. ES BLEIBT EIN EINZIGER ZEICHENWEG. Die Erweiterung ist bewusst KEINE zweite Schleife neben
//      der bestehenden, sondern eine Tabelle (MISSION_LINIEN), über die dieselbe Schleife läuft.
//      Eine zweite Schleife wäre exakt die zweite Anzeigestelle, an der dieses Projekt wiederholt
//      hängengeblieben ist - sie hätte beim nächsten Umbau eine andere Wahrheit erzählt.
//
//   2. WAS KEIN KARTENZIEL HAT, BEKOMMT AUCH KEINE LINIE. expedition, abgrund, piratelair und
//      worldboss haben keinen Ort im Sektor: Tiefraum, Abstieg, abstrakte Gegner. Eine Linie
//      dorthin wäre erfunden. Der Test setzt für alle vier eine laufende Mission und besteht
//      darauf, dass NICHTS gezeichnet wird - sonst wäre die nächste "Vollständigkeits"-Runde
//      versucht, sie irgendwohin zu malen.
//
// Der Test öffnet ein System, bevor er misst: Die Systemkarte lebt in #galaxySystemLayer INNERHALB
// der Galaxiekarte und entsteht erst beim Öffnen. In der Übersicht gibt es keine Flugbahnen - beim
// ersten Durchlauf genau daran gescheitert und dabei fälschlich "nichts wird gezeichnet" gemessen.
const { starteBrowser, SPIELDATEI, SPIEL_URL } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---- Quelltext: ein Zeichenweg, eine Tabelle ---------------------------------------------------
const tabVon = src.indexOf('const MISSION_LINIEN = {');
check('die Missionsarten stehen in EINER Tabelle', tabVon > 0);
const tab = src.slice(tabVon, src.indexOf('\n  };', tabVon));
const arten = [...tab.matchAll(/^\s{4}'?([\w-]+)'?:\s*\{/gm)].map(m => m[1]);
check('die Tabelle nennt mehr als nur die Erkundung', arten.length >= 5, arten);
check('die Zeichenschleife liest die Tabelle statt einen Typ fest zu prüfen',
  src.includes("fleet.missions.filter(mm=>MISSION_LINIEN[mm.type])"));
check('der alte Einzelfilter auf explore ist weg',
  !src.includes("fleet.missions.filter(mm=>mm.type==='explore')"));
// Einwegflüge dürfen nicht auf halber Strecke umkehren.
check('die Tabelle unterscheidet Rundflug und Einwegflug',
  /rundflug:true/.test(tab) && /rundflug:false/.test(tab));
check('der Rückweg wird nur beim Rundflug gerechnet',
  src.includes('const returning = art.rundflug && frac >= 0.5;'));

// ---- Verhalten: je eine laufende Mission pro Art ------------------------------------------------
// Ziele aus der ECHTEN Spieldatei ziehen - eine erfundene targetId wäre kein Test.
const planetIds = [...src.matchAll(/\{ id:'(\w+)',[^\n]*system:'kepler'/g)].map(m => m[1]).slice(0, 4);
const npcId = (src.match(/const NPCS = \[[\s\S]{0,400}?\{ id:'(\w+)'/) || [])[1];

function backend(store){ return async r => {
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
};}

(async () => {
  check('Ziele aus der Spieldatei gelesen', planetIds.length >= 4 && !!npcId, { planetIds, npcId });
  if (planetIds.length < 4 || !npcId){ console.log('\nFAIL'); process.exit(1); }
  const jetzt = Date.now();
  const MIT_ZIEL = ['explore','attack','colonize','colonize-moon','relocate'];
  const OHNE_ZIEL = ['expedition','abgrund','piratelair','worldboss'];
  const missions = [
    { type:'explore',       targetId: planetIds[0],          startTime: jetzt-600000, endTime: jetzt+600000, fleetName:'Aufklaerer' },
    { type:'attack',        targetId: npcId,                 startTime: jetzt-300000, endTime: jetzt+900000, fleetName:'Streitmacht' },
    { type:'colonize',      targetId: planetIds[1],          startTime: jetzt-200000, endTime: jetzt+800000 },
    { type:'colonize-moon', targetId: 'moon_'+planetIds[2],  startTime: jetzt-100000, endTime: jetzt+900000 },
    { type:'relocate',      targetId: planetIds[3],          startTime: jetzt-400000, endTime: jetzt+600000 },
    ...OHNE_ZIEL.map(t => ({ type:t, startTime: jetzt-100000, endTime: jetzt+900000 }))
  ];
  const store = { 'kepler7-save-v3': JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
    seenTabHints:{ karte:1 },
    resources:{ energie:9e5, erz:9e5, kristalle:9e5, deuterium:9e5, antimaterie:9e4, forschungspunkte:9e4 },
    buildings:{ solar:22, mine:20, labor:14, werft:14, lager:14 },
    research:{ rsolar:8, rkampf:8, rkolonisation:5 },
    fleet:{ jaeger:400, spaeher:20, forscher:10, colonyShips:5, missions },
    colonies:{}, activeBasePlanet:'home',
    player:{ id:'u', name:'K', allianceTag:'', avatarKey:null }, battleStats:{ wins:1, losses:0 },
    xp:64000, buffs:[], lastTick:jetzt }) };

  const b = await starteBrowser();
  const ctx = await b.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
    const t = document.querySelector('.tab-btn[data-tab="karte"]'); if (t) t.click();
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const n = document.querySelector('[data-system-node="kepler"]') || document.querySelector('[data-system-node]');
    if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true }));
  });
  await page.waitForTimeout(2200);

  const r = await page.evaluate(() => {
    const g = document.getElementById('galaxySystemLayer');
    if (!g) return null;
    // Der Flottenmarker ist das gedrehte Dreieck - eindeutig, weil kein anderes Kartenelement
    // dieselbe Punktfolge nutzt.
    return { marker: (g.innerHTML.match(/<polygon points="0,-6/g) || []).length,
             beschriftungen: [...g.querySelectorAll('text.planet-label')].map(t => t.textContent)
               .filter(t => /Hinflug|Rückflug|Kolonisierung|Mondlandung|Verlegung/.test(t)) };
  });
  check('die Systemkarte wurde geöffnet', !!r, r);
  if (!r){ await b.close(); console.log('\nFAIL'); process.exit(1); }

  // Genau eine Linie je Art MIT Kartenziel - nicht mehr (sonst zeichnet etwas doppelt) und nicht
  // weniger (sonst fehlt eine Art).
  check('für JEDE Missionsart mit Kartenziel wird genau ein Flottenmarker gezeichnet',
    r.marker === MIT_ZIEL.length, { gezeichnet: r.marker, erwartet: MIT_ZIEL.length, arten: MIT_ZIEL });
  check('und die Arten ohne Kartenziel erzeugen keine Linie ins Nichts',
    r.marker === MIT_ZIEL.length, { ohneZiel: OHNE_ZIEL });

  // Die Beschriftung muss die Art benennen und darf sich nicht doppeln ("Kolonisierung ·
  // Kolonisierung" war der erste Versuch).
  check('jede Beschriftung benennt ihre Art', r.beschriftungen.length === MIT_ZIEL.length, r.beschriftungen);
  const doppelt = r.beschriftungen.filter(t => { const p = t.split(' · '); return p.length === 2 && p[0] === p[1]; });
  check('keine Beschriftung wiederholt sich selbst', doppelt.length === 0, doppelt);
  // Rundflug zeigt die Richtung, Einwegflug nicht - das ist die sichtbare Seite von `rundflug`.
  check('Rundflüge zeigen Hin- oder Rückflug an',
    r.beschriftungen.filter(t => /Hinflug|Rückflug/.test(t)).length === 2, r.beschriftungen);
  check('Einwegflüge zeigen keine Flugrichtung',
    r.beschriftungen.filter(t => /Kolonisierung|Mondlandung|Verlegung/.test(t) && !/flug/.test(t)).length === 3,
    r.beschriftungen);

  check('keine Skriptfehler', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
