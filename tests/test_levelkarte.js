// Was die Levelanzeigen einem WEIT fortgeschrittenen Konto tatsaechlich hinschreiben.
//
// Der statische Bruder dieses Tests (test_levelfortschritt.js) prueft, dass die Anzeigestellen die
// Grenzen LESEN statt sie noch einmal hinzuschreiben. Das ist die halbe Miete: Eine Anzeige kann
// die richtige Funktion aufrufen und trotzdem Unsinn zeigen. Deshalb hier ein echtes Konto im
// Browser - Level 45, Faehigkeitsbaum ausgekauft, Autonomiekern gebaut - und die Frage: Steht da
// die Wahrheit?
//
// Genau in dieser Konstellation lagen bis 01.08.2026 zwei Falschaussagen nebeneinander:
//   * Levelkarte (Fortschritt-Tab): "+45% Gesamtproduktion" - wirksam waren +30%.
//   * "Naechstes Ziel" (Basis-Tab, oberster Kasten): "... und ein Faehigkeitspunkt" - der Baum war
//     seit Level 18 ausgekauft, der Punkt also wertlos.
// Beide sind mit einer festen Zeichenkette entstanden. Ein Test, der nur nach Zeichenketten sucht,
// haette sie nie gefunden - er haette ja genau die gesuchte Zeichenkette gefunden und sich gefreut.
//
// GEPRUEFT WIRD AUSSCHLIESSLICH DAS GERENDERTE DOM. Das Spiel laeuft komplett in einer Closure;
// commanderLevel, offlineWindowSec und state sind von aussen gar nicht erreichbar. Das ist kein
// Hindernis, sondern die richtige Perspektive: Was der Spieler liest, ist die zu pruefende Aussage.
const { starteBrowser, SPIELDATEI } = require('./lib/umgebung');
const path = require('path');
const fs = require('fs');
const FILE = 'file://' + path.resolve(SPIELDATEI);

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s=200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

// Die Erwartungswerte kommen aus der SPIELDATEI, nicht aus dem Gedaechtnis - sonst prueft der Test
// gegen eine dritte Kopie der Zahlen und veraltet genau wie die Anzeigen, die er absichern soll.
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const DECKEL_PCT = Math.round(Number((src.match(/COMMANDER_PROD_CAP = ([\d.]+)/) || [])[1]) * 100);
const BAUM_KOSTEN = (() => {
  const von = src.indexOf('const SKILL_TREE = [');
  const block = src.slice(von, src.indexOf('\n  ];', von));
  return [...block.matchAll(/cost:(\d+)/g)].reduce((a, m) => a + Number(m[1]), 0);
})();
const BAUM_KNOTEN = (() => {
  const von = src.indexOf('const SKILL_TREE = [');
  const block = src.slice(von, src.indexOf('\n  ];', von));
  return [...block.matchAll(/key:'(\w+)'/g)].map(m => m[1]);
})();
// Seit v8.429.0 gibt es zusaetzlich wiederholbare Meisterschaften (SKILL_MASTERY, Stufenzahl statt
// true im Spielstand). Das "alles ausgekauft"-Szenario dieses Tests muss sie MAXIEREN - sonst ist
// das Versprechen "ein Faehigkeitspunkt" ja wieder wahr und die Kernaussage unten prueft nichts.
const MEISTERSCHAFTEN = (() => {
  const von = src.indexOf('const SKILL_MASTERY = [');
  if (von < 0) return [];
  const block = src.slice(von, src.indexOf('\n  ];', von));
  return [...block.matchAll(/key:'(\w+)'[^\n]*?maxStufen:(\d+)/g)].map(m => ({ key: m[1], max: Number(m[2]) }));
})();
// commanderLevel = floor(sqrt(xp/50)). Ein Level deutlich UEBER Deckel und Baumkosten, damit beide
// Grenzen sicher ueberschritten sind - gerechnet, nicht als 45 hingeschrieben.
const LEVEL = Math.max(DECKEL_PCT, BAUM_KOSTEN) + 5;
const XP = LEVEL * LEVEL * 50 + 10;
const AUTONOMIE_STUFEN = 3;

(async () => {
  const b = await starteBrowser();
  let fail = false;
  const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
  const errs = [];
  const store = {};
  const skillTree = {}; for (const k of BAUM_KNOTEN) skillTree[k] = true;
  for (const m of MEISTERSCHAFTEN) skillTree[m.key] = m.max;
  store['kepler7-save-v3'] = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{ energie:9e5, erz:9e5, kristalle:9e5, deuterium:9e5, antimaterie:9e4, forschungspunkte:9e4 },
    buildings:{ solar:20, mine:18, labor:12, werft:12, hangar:8, lager:12, autonomiekern:AUTONOMIE_STUFEN },
    research:{ rsolar:8, rkampf:6, rnanotech:1, rquantenphysik:1 },
    fleet:{ jaeger:300, missions:[] }, colonies:{}, activeBasePlanet:'home',
    skillTree, prestige:2,
    player:{ id:'u', name:'A', allianceTag:'', avatarKey:null }, battleStats:{ wins:5, losses:1 },
    xp: XP, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{} });

  const ctx = await b.newContext({ viewport:{ width:900, height:1300 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE);
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
  });
  await page.waitForTimeout(1200);

  const platt = s => (s || '').replace(/\s+/g, ' ').trim();

  // ---- 1: Der Kasten "Naechstes Ziel" auf dem Basis-Reiter --------------------------------------
  const zielRoh = await page.evaluate(() => { const b = document.getElementById('nextGoalBox'); return b ? b.textContent : null; });
  const ziel = platt(zielRoh);
  // Nur den Satz "Naechstes Level: ..." betrachten - der Kasten listet darunter noch offene Punkte,
  // und in denen darf "Fähigkeitspunkt" durchaus vorkommen (die Reiter-Meldung "nicht verteilte
  // Fähigkeitspunkte" ist eine andere, korrekte Aussage).
  const satz = (ziel.match(/Nächstes Level: [^.]*\./) || [''])[0];
  check('"Naechstes Ziel" wurde gerendert', !!satz, satz);
  check('der Kasten zeigt das erwartete Level', ziel.includes('Kommandant Level ' + LEVEL), { erwartet: LEVEL, text: ziel.slice(0, 80) });
  // DIE Kernaussage: kein Faehigkeitspunkt mehr versprechen, wenn es nichts dafuer gibt.
  check('er verspricht KEINEN Faehigkeitspunkt mehr', !/Fähigkeitspunkt/.test(satz), satz);
  // ... und auch keine Produktion, denn der Deckel liegt darunter.
  check('und keine weitere Produktion (Deckel liegt darunter)', !/Gesamtproduktion/.test(satz), satz);
  // Statt einer Leerstelle muss dort etwas Brauchbares stehen.
  check('stattdessen steht dort ein echter Hinweis',
    /Nächstes Level: (keine direkte Belohnung|die Levelbelohnung|Produktionsdeckel)/.test(satz), satz);

  // ---- 2: Die Levelkarte im Fortschritt-Reiter ---------------------------------------------------
  await page.evaluate(() => { const t = document.querySelector('.tab-btn[data-tab="fortschritt"]'); if (t) t.click(); });
  await page.waitForTimeout(1400);
  const karte = platt(await page.evaluate(() => { const b = document.getElementById('levelBox'); return b ? b.textContent : null; }));
  check('die Levelkarte wurde gerendert', karte.includes('Gesamtproduktion'), karte.slice(0, 120));
  check('sie nennt den GEDECKELTEN Wert', karte.includes('+' + DECKEL_PCT + '%'), { erwartet: DECKEL_PCT, text: karte.slice(0, 160) });
  // Genau der gemeldete Fehler: der Rohwert des Levels darf dort nicht stehen.
  check('sie nennt NICHT den ungedeckelten Rohwert', !karte.includes('+' + LEVEL + '% Gesamtproduktion'),
    { rohwert: LEVEL, text: karte.slice(0, 160) });
  check('sie sagt, dass der Deckel erreicht ist', /Deckel erreicht/.test(karte), karte.slice(0, 160));
  // Die Belohnungsleiter muss sichtbar sein - sie war es vorher nirgends.
  check('sie nennt die naechste Levelbelohnung', /Nächste Levelbelohnung auf Level \d+/.test(karte), karte.slice(-140));
  const naechste = Number((karte.match(/Nächste Levelbelohnung auf Level (\d+)/) || [])[1]);
  check('und zwar eine, die noch VOR dem Konto liegt', naechste > LEVEL, { naechste, level: LEVEL });

  // ---- 3: Das Offline-Fenster auf der Gebaeudekarte ----------------------------------------------
  // Ende zu Ende: Der Spielstand hat den Autonomiekern auf Stufe 3, die Karte muss ein laengeres
  // Fenster als den Grundwert ausweisen und den Ausbauschritt zeigen.
  await page.evaluate(() => { const t = document.querySelector('.tab-btn[data-tab="basis"]'); if (t) t.click(); });
  await page.waitForTimeout(1400);
  const kern = platt(await page.evaluate(() => {
    const treffer = [...document.querySelectorAll('#buildings .card-row')]
      .find(c => (c.textContent || '').includes('Autonomiekern'));
    return treffer ? treffer.textContent : null;
  }));
  check('die Autonomiekern-Karte ist da', !!kern && kern.includes('Autonomiekern'), kern && kern.slice(0, 100));
  check('sie weist ein Offline-Fenster aus', /Offline-Fenster \(imperiumsweit\)/.test(kern), kern && kern.slice(0, 200));
  // Numerisch statt per Wortlaut: fmtDuration schreibt "10h 15m". Alle vier Zeitangaben der Zeile
  // werden in Minuten umgerechnet und gegen die Erwartung geprueft, die sich aus den Konstanten der
  // Spieldatei ergibt - so kann weder ein geaendertes Zeitformat noch ein geaenderter Deckel den
  // Test still durchrutschen lassen.
  const zeile = (kern.match(/Offline-Fenster \(imperiumsweit\):[^)]*\)/) || [''])[0];
  const minuten = [...zeile.matchAll(/(\d+)h (\d+)m/g)].map(m => Number(m[1])*60 + Number(m[2]));
  const proStufe = Number((src.match(/const OFFLINE_BONUS_PER_LEVEL_SEC = (\d+)\*60;/) || [])[1]);
  const deckelStd = Number((src.match(/const OFFLINE_BONUS_CAP_SEC = (\d+)\*3600;/) || [])[1]);
  check('die Zeile nennt vier Zeitangaben (jetzt, nach Ausbau, Grundwert, Deckel)', minuten.length === 4, { zeile, minuten });
  check('das aktuelle Fenster entspricht genau den gebauten Stufen',
    minuten[0] === 8*60 + AUTONOMIE_STUFEN*proStufe, { gezeigt: minuten[0], erwartet: 8*60 + AUTONOMIE_STUFEN*proStufe });
  check('der Wert nach dem Ausbau ist genau eine Stufe mehr',
    minuten[1] - minuten[0] === proStufe, { diff: minuten[1] - minuten[0], proStufe });
  check('der genannte Grundwert stimmt', minuten[2] === 8*60, minuten[2]);
  check('der genannte Deckel stimmt', minuten[3] === 8*60 + deckelStd*60, { gezeigt: minuten[3], erwartet: 8*60 + deckelStd*60 });
  check('sie nennt die Stufenzahl bis zum Deckel',
    zeile.includes('ab ' + Math.ceil(deckelStd*60/proStufe) + ' summierten Stufen'), zeile);

  check('keine Skriptfehler waehrend des Laufs', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
