// Die Belohnungsvorschau des Allianz-Raids - gemessen am gerenderten Spiel.
//
// Auftrag Sascha: "allianz raid deutlich optisch aktraktiver gestalten weniger text und vsl.
// belohnungen einblenden."
//
// WAS DIESER TEST MISST UND WARUM SO
// ----------------------------------
// Die FORMEL haelt tests/test_raid_belohnung_paritaet.js gegen das Backend. Hier geht es um die
// Anzeige: ob die Vorschau angeschlossen ist, ob sie schweigt, wo sie nichts zu sagen hat - und
// seit dem 22.08.2026 auch, ob die Zahlen auf dem Bildschirm DIE DER SERVERFORMEL sind.
//
// Diese dritte Frage war die Luecke zwischen den beiden Tests, und in ihr lebte ein Fehler, mit
// dem v8.607.0 live gegangen ist: Die Formel stimmte (der Paritaetstest war gruen), die Anzeige
// war da (dieser Test war gruen) - nur zeigte sie GAR NICHTS, weil die Funktion `e.playerId`
// suchte und der Server das Feld `id` nennt. Zwei gruene Tests, ein totes Feature.
// Eine Pruefung auf "das Wort Beute steht da" waere gruen, egal welche Zahlen darunter stehen
// (Hausregel 61) - gemessen wird deshalb ein PAAR aus zwei Laeufen, der Unterschied zwischen den
// zwei Spalten UND jeder einzelne Betrag gegen die ausgefuehrte Serverformel.
const fs = require('fs');
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI, SERVER_JS } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const TAG = 'TST';
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

const spielstand = () => JSON.stringify({
  tutorialSeen:true, newbieWelcomeSeen:true, allianceSubTab:'uebersicht',
  resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:2e4, forschungspunkte:3e4 },
  buildings:{ solar:20, mine:18, lager:20, werft:12, labor:12 },
  research:{}, colonies:{}, activeBasePlanet:'home',
  player:{ id:'u', name:'A', avatarKey:null, allianceTag:TAG, allianceRole:'admin' },
  fleet:{ jaeger:500, schlachtschiff:50, missions:[] },
  battleStats:{ wins:1, losses:0 }, xp:20000, credits:50000, buffs:[], lastTick:Date.now(), colonyNames:{}
});
const info  = JSON.stringify({ tag:TAG, creatorId:'u', creatorName:'A', createdAt: Date.now()-1e7, joinMode:'open' });
const basis = JSON.stringify({ foundedAt: Date.now()-1e7, system:'kepler', level:5, hp:60000, maxHp:60000, contributions:{}, announcedLevel:5, destroyed:false });
const rolleMit = r => JSON.stringify({ playerId:'u', name:'A', role:r, joinedAt: Date.now()-1e7 });
const raidDoc = z => JSON.stringify(Object.assign({ id:'r1', level:2, hp:30000, maxHp:50000, targetSector:'kepler', waveNumber:2, expiresAt: Date.now()+36e5 }, z));

const versand = ranking => raidDoc({ phase:'enroute', dispatch:{ arrivalAt: Date.now()+5e5,
  participantCount: ranking.length, totalShips:500, totalPower: ranking.reduce((a,e)=>a+e.power,0), ranking } });

async function zeichne(browser, raid, rolle){
  const store = { 'kepler7-save-v3': spielstand(), ['alliance:'+TAG+':info']: info,
                  ['alliance:'+TAG+':role:u']: rolleMit(rolle || 'admin'), ['alliance:'+TAG+':base']: basis };
  if (raid) store['alliance:'+TAG+':raid'] = raid;
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{ width:900, height:1400 } }));
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss());
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForSelector('.tab-btn[data-tab="allianz"]', { timeout: 60000 });
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="allianz"]'); if (b) b.click(); });
  await page.waitForTimeout(3500);
  const m = await page.evaluate(() => {
    const b = document.getElementById('allianceRaidBox');
    if (!b) return { fehlt:true };
    const txt = (b.textContent || '').replace(/\s+/g, ' ').trim();
    // Die ZWEI Spalten der Vorschau getrennt einsammeln - eine Tabelle, deren beide Spalten
    // gleich sind, waere eine Vorschau ohne Aussage.
    // Je Zeile: der Name aus der ersten Zelle, und ALLE Zahlen aus den uebrigen Zellen
    // zusammen. Bewusst nicht "die zweite und die dritte Zelle": Die Vorschau darf ihre
    // Spalten umbauen (sie hat es am 22.08.2026 getan - aus zwei Wertspalten wurde eine
    // mit dem Ueberlebt-Wert in Klammern), ohne dass die Pruefung dabei still ihren
    // Gegenstand verliert (Hausregel 3: die REGEL pruefen, nicht die Momentaufnahme).
    const zeilen = [...b.querySelectorAll('table tr')].map(tr => {
      const tds = [...tr.children];
      const roh = tds.slice(1).map(td => (td.textContent||'').trim()).join(' ');
      return { name: (tds[0] ? tds[0].textContent : '').trim(),
               werte: roh.match(/[0-9][0-9.,]*[kM]?|–/g) || [],
               symbol: !!(tds[0] && tds[0].querySelector('i.ti, svg')) };
    });
    // SICHTBAR, nicht bloss vorhanden (Hausregel 55): textContent liefert auch bei
    // display:none Text. Genau daran hing hier ein sechs Tage alter Fehlgriff - die
    // Fixture setzte den Unterreiter 'krieg', den es nie gab, und bei einem unbekannten
    // Schluessel blendet die Anzeige ALLE Allianz-Panels aus (Hausregel 4). Der Kasten
    // wohnt in 'uebersicht'. Ohne diese Messung koennte der erfundene Schluessel still
    // zurueckkehren, und der Test waere weiterhin gruen.
    const r = b.getBoundingClientRect();
    return { txt, zeilen, hatVorschau: txt.includes('Deine Beute'), selects: b.querySelectorAll('select').length,
             sichtbar: r.height > 0 && r.width > 0 && getComputedStyle(b).display !== 'none' };
  });
  await ctx.close();
  return m;
}

// Die ranking-Eintraege tragen `id`, NICHT `playerId` - so und nur so baut sie der Server
// (server.js: `.map(p => ({ id: p.playerId, name, power }))`, und er liest sie eine Funktion
// weiter selbst als `e.id === req.userId`).
//
// Der erste Entwurf dieser Fixture schrieb `playerId`, und genau daran ist die Belohnungsvorschau
// in v8.607.0 LIVE gegangen, ohne je zu erscheinen: Die Funktion suchte `e.playerId`, bekam von
// findIndex immer -1 und lieferte eine leere Zeichenkette. Der Test war dabei die ganze Zeit
// gruen, weil er eine Datenform mass, die es in der Produktion nicht gibt (Hausregel 36: wer eine
// Sache durch etwas Aehnliches ersetzt, misst nicht mehr das Spiel).
//
// Wer hier etwas aendert, liest zuerst nach, wie der Server das Feld WIRKLICH nennt.

// Die Erwartung kommt aus der SERVERFORMEL, nicht aus der Frontend-Kopie: Der Server entscheidet,
// was ausgezahlt wird, und die Tafel verspricht es dem Spieler. Die Eingaben sind aus der Fixture
// ABGELEITET (Ranglisten-Kraefte, Stufe des raidDoc), nicht eingetippt (Hausregel 2).
const FIX_LEVEL = 2, FIX_KRAEFTE = [52000, 26000, 12000], FIX_ICH = 1;   // Index in FIX_KRAEFTE
// Die acht Wertzeilen samt Zuordnung zum Serverfeld - aus allianceRaidVorschauHtml abgelesen,
// nicht geraten (Hausregel 4).
const TAFEL = [
  { name:'Kredite',        wert: r => r.credits },
  { name:'Kampfpunkte',    wert: r => r.battlePoints },
  { name:'Erfahrung',      wert: r => r.xp },
  { name:'Erz',            wert: r => r.resources.erz },
  { name:'Kristalle',      wert: r => r.resources.kristalle },
  { name:'Deuterium',      wert: r => r.resources.deuterium },
  { name:'Antimaterie',    wert: r => r.resources.antimaterie },
  { name:'Modulfragmente', wert: r => r.fragments }
];

function schneideFunktion(q, kopf){
  const von = q.indexOf(kopf);
  if (von < 0) return null;
  let i = q.indexOf('{', von), t = 0;
  // Ueber die echte Klammertiefe, nie ueber ein geratenes Zeichenfenster.
  for (; i < q.length; i++){
    if (q[i] === '{') t++;
    else if (q[i] === '}'){ t--; if (!t) return q.slice(von, i + 1); }
  }
  return null;
}

function zahlenPruefen(zeilen){
  if (!SERVER_JS){
    // Kein stiller Skip: Ohne Nachbar-Repo entfaellt die halbe Aussage dieses Tests, und ein
    // gruener Lauf saehe genauso aus wie ein vollstaendiger (Hausregel 34).
    check('1d: das Backend-Repo liegt daneben (sonst sind die Zahlen ungeprueft)', false,
      { hinweis: 'kolonie-kepler7-backend/server.js nicht gefunden' });
    return;
  }
  let sieg = null, flucht = null, fmt = null, bauFehler = null;
  try {
    const srv = fs.readFileSync(SERVER_JS, 'utf8');
    const spread = (srv.match(/const ALLIANCE_RAID_RANK_SPREAD = ([\d.]+);/) || [])[1];
    const lohn = new Function('const ALLIANCE_RAID_RANK_SPREAD = ' + spread + ';\n' +
      schneideFunktion(srv, 'function allianceRaidRankFactor(') + '\n' +
      schneideFunktion(srv, 'function allianceRaidRankShare(') + '\n' +
      schneideFunktion(srv, 'function allianceRaidRewardFor(') + '\nreturn allianceRaidRewardFor;')();
    const spiel = fs.readFileSync(SPIELDATEI, 'utf8');
    // fmt() aus der SPIELDATEI geschnitten statt nachgebaut - es kuerzt ab 1000 auf "2.0k", und
    // eine eigene Nachbildung waere die zweite Wahrheit (Hausregel 36).
    fmt = new Function('return ' + schneideFunktion(spiel, 'function fmt('))();
    const bTab = schneideFunktion(spiel, 'function allianceRaidBoss(');
    const bosse = new Function('return ' + (spiel.match(/const ALLIANCE_RAID_BOSSE = \[[\s\S]*?\n  \];/) || ['[]'])[0].replace(/^const ALLIANCE_RAID_BOSSE = /, '').replace(/;$/, ''))();
    const boss = bosse[(Math.max(1, FIX_LEVEL) - 1) % bosse.length];
    const gesamt = FIX_KRAEFTE.reduce((a, k) => a + k, 0);
    const share = FIX_KRAEFTE[FIX_ICH] / gesamt;
    sieg = lohn(FIX_LEVEL, share, FIX_ICH + 1, FIX_KRAEFTE.length, true, boss);
    flucht = lohn(FIX_LEVEL, share, FIX_ICH + 1, FIX_KRAEFTE.length, false, boss);
  } catch(e){ bauFehler = String(e).split('\n')[0]; }
  check('1d-bau: Serverformel, fmt und Boss-Tabelle lassen sich ausfuehren',
    !!sieg && !!flucht && !!fmt, bauFehler || undefined);
  if (!sieg || !flucht || !fmt) return;

  const finde = name => zeilen.find(z => z.name.indexOf(name) >= 0);
  const fehlt = [], falschSieg = [], falschFlucht = [];
  for (const posten of TAFEL){
    const z = finde(posten.name);
    if (!z || !z.werte.length){ fehlt.push(posten.name); continue; }
    const sollS = String(fmt(posten.wert(sieg)));
    const b = posten.wert(flucht);
    const sollF = b > 0 ? String(fmt(b)) : '–';
    if (z.werte[0] !== sollS) falschSieg.push(posten.name + ': "' + z.werte[0] + '" statt "' + sollS + '"');
    if (z.werte[1] !== sollF) falschFlucht.push(posten.name + ': "' + z.werte[1] + '" statt "' + sollF + '"');
  }
  check('1e: alle acht Posten stehen als eigene Zeile in der Tafel', fehlt.length === 0, fehlt);
  check('1f: jede Zahl der Sieg-Spalte stimmt zur Serverformel',
    fehlt.length === 0 && falschSieg.length === 0, falschSieg.length ? falschSieg : undefined);
  // Das PAAR dazu: Ohne die zweite Spalte faellt ein vertauschtes Spaltenpaar nicht auf, und der
  // Ueberlebt-Faktor waere ueberhaupt nicht gemessen.
  check('1g: und jede Zahl der Ueberlebt-Spalte ebenso',
    fehlt.length === 0 && falschFlucht.length === 0, falschFlucht.length ? falschFlucht : undefined);
}

(async () => {
  const browser = await starteBrowser();
  try {
    // --- 1. Mit Rangliste, in der ich stehe: die Vorschau ist da und nennt Platz und Anteil ---
    const mit = await zeichne(browser, versand([
      { id:'x', name:'X', power:52000 }, { id:'u', name:'A', power:26000 }, { id:'c', name:'C', power:12000 }]));
    check('1-vorab: die Box wurde ueberhaupt gezeichnet', !mit.fehlt && mit.txt.length > 40, { zeichen: mit.txt && mit.txt.length });
    check('1-vorab2: und sie ist fuer den Spieler SICHTBAR, nicht nur im DOM', mit.sichtbar === true,
          { sichtbar: mit.sichtbar });
    check('1a: die Vorschau erscheint', mit.hatVorschau === true);
    check('1b: sie nennt den eigenen Platz', /Platz 2 von 3/.test(mit.txt), mit.txt.slice(mit.txt.indexOf('Deine Beute'), mit.txt.indexOf('Deine Beute')+60));
    check('1c: sie nennt den Kraftanteil', /29 % der Kraft/.test(mit.txt));

    // --- 1d-1g: die angezeigten Zahlen SIND die der Serverformel ---
    //
    // Bis hierher mass dieser Test nur, DASS zwei verschiedene Zahlen dastehen (2a) und dass
    // Antimaterie/Fragmente nur beim Fall erscheinen (2b). Ob es die RICHTIGEN Zahlen sind, hat
    // niemand geprueft: `test_raid_belohnung_paritaet` haelt zwar Frontend- und Backend-FORMEL
    // gegeneinander, aber keine Pruefung verband die Formel mit dem, was auf dem Bildschirm steht.
    // Genau in dieser Luecke lebte der Fehler, mit dem v8.607.0 live ging - die Tafel haette jede
    // beliebige Zahl zeigen koennen (Hausregel 61: die Wirkung messen, nicht die Beschriftung).
    zahlenPruefen(mit.zeilen);

    // --- 2. Das PAAR: beide Spalten muessen sich unterscheiden ---
    const werte = mit.zeilen.filter(z => z.werte.length === 2 && /^[0-9]/.test(z.werte[0]));
    check('2-vorab: die Tabelle hat Wertzeilen', werte.length >= 6, { zeilen: werte.length });
    const verschieden = werte.filter(z => z.werte[0] !== z.werte[1]).length;
    check('2a: "Boss faellt" und "ueberlebt" nennen verschiedene Zahlen', verschieden >= 5,
          { verschieden, beispiel: werte.slice(0, 3).map(z => [z.name].concat(z.werte)) });
    const nurBeiFall = werte.filter(z => z.werte[1] === '–');
    check('2b: Antimaterie und Fragmente gibt es NUR beim Fall', nurBeiFall.length === 2,
          nurBeiFall.map(z => z.name));
    // Die Symbole sind der optische Teil des Auftrags (22.08.2026) - und eine Pruefung auf
    // "das Wort Erz steht da" waere auch ohne sie gruen (Hausregel 61).
    const ohneSymbol = werte.filter(z => !z.symbol).map(z => z.name);
    check('2c: jede Beutezeile traegt ihr Symbol', ohneSymbol.length === 0, ohneSymbol);

    // --- 3. Die Gegenrichtungen: schweigen, wo nichts zu sagen ist ---
    const ohneListe = await zeichne(browser, raidDoc({ phase:'enroute',
      dispatch:{ arrivalAt: Date.now()+5e5, participantCount:3, totalShips:500, totalPower:90000 } }));
    check('3a: ohne Rangliste steht KEINE Vorschau da', ohneListe.hatVorschau === false, ohneListe.txt && ohneListe.txt.slice(-80));
    const ohneMich = await zeichne(browser, versand([
      { id:'x', name:'X', power:40000 }, { id:'c', name:'C', power:20000 }]));
    check('3b: wer nicht mitgeflogen ist, sieht KEINE Vorschau', ohneMich.hatVorschau === false, ohneMich.txt && ohneMich.txt.slice(-80));

    // --- 4. Weniger Text: der Bossname steht im Kopf nur noch EINMAL ---
    // Gemessen im Zustand "kein Raid": vorher Kopfzeile + Regelzeile + Auswahlfeld.
    const keinRaid = await zeichne(browser, null);
    const kopf = (keinRaid.txt || '').split('Sternenfresser – ausgewogene Beute')[0];
    const namenImKopf = (kopf.match(/Sternenfresser/g) || []).length;
    check('4-vorab: der Zustand "kein Raid" wurde gezeichnet', /Aktuell läuft kein Allianz-Raid/.test(keinRaid.txt || ''));
    check('4a: der Bossname steht im Kopf nur einmal', namenImKopf === 1, { namenImKopf, kopf: kopf.slice(0, 200) });
    check('4b: der Beutetext steht nicht doppelt', (kopf.match(/ausgewogene Beute/g) || []).length === 0, kopf.slice(0, 200));

    // --- 5. Die Ausnahme: ohne Auswahlfeld bleibt der Beutetext stehen ---
    // Ein einfaches Mitglied sieht kein Auswahlfeld - ohne diese Ausnahme waere die Auskunft
    // fuer es ersatzlos weg, und das waere eine stille Verschlechterung.
    const mitglied = await zeichne(browser, null, 'member');
    check('5-vorab: das Mitglied sieht wirklich kein Auswahlfeld', mitglied.selects === 0, { selects: mitglied.selects });
    check('5a: dafuer nennt seine Zeile die Beute', /Beute: ausgewogene Beute/.test(mitglied.txt || ''), (mitglied.txt||'').slice(0, 220));
  } finally { await browser.close(); }
  console.log(fail ? 'FAIL - es gab rote Pruefungen.' : 'PASS');
  process.exit(fail ? 1 : 0);
})();
