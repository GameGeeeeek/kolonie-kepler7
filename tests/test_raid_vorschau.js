// Die Belohnungsvorschau des Allianz-Raids - gemessen am gerenderten Spiel.
//
// Auftrag Sascha: "allianz raid deutlich optisch aktraktiver gestalten weniger text und vsl.
// belohnungen einblenden."
//
// WAS DIESER TEST MISST UND WARUM SO
// ----------------------------------
// Die RECHNUNG haelt tests/test_raid_belohnung_paritaet.js gegen das Backend. Hier geht es um
// etwas anderes: ob die Vorschau ANGESCHLOSSEN ist und ob sie schweigt, wo sie nichts zu sagen
// hat. Eine Pruefung auf "das Wort Beute steht da" waere gruen, egal welche Zahlen darunter
// stehen (Hausregel 61) - gemessen wird deshalb ein PAAR aus zwei Laeufen und der Unterschied
// zwischen den zwei Spalten.
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

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
  tutorialSeen:true, newbieWelcomeSeen:true, allianceSubTab:'krieg',
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
    const zeilen = [...b.querySelectorAll('table tr')].map(tr =>
      [...tr.children].map(td => (td.textContent||'').trim()));
    return { txt, zeilen, hatVorschau: txt.includes('Deine Beute'), selects: b.querySelectorAll('select').length };
  });
  await ctx.close();
  return m;
}

(async () => {
  const browser = await starteBrowser();
  try {
    // --- 1. Mit Rangliste, in der ich stehe: die Vorschau ist da und nennt Platz und Anteil ---
    const mit = await zeichne(browser, versand([
      { playerId:'x', name:'X', power:52000 }, { playerId:'u', name:'A', power:26000 }, { playerId:'c', name:'C', power:12000 }]));
    check('1-vorab: die Box wurde ueberhaupt gezeichnet', !mit.fehlt && mit.txt.length > 40, { zeichen: mit.txt && mit.txt.length });
    check('1a: die Vorschau erscheint', mit.hatVorschau === true);
    check('1b: sie nennt den eigenen Platz', /Platz 2 von 3/.test(mit.txt), mit.txt.slice(mit.txt.indexOf('Deine Beute'), mit.txt.indexOf('Deine Beute')+60));
    check('1c: sie nennt den Kraftanteil', /29 % der Kraft/.test(mit.txt));

    // --- 2. Das PAAR: beide Spalten muessen sich unterscheiden ---
    const werte = mit.zeilen.filter(z => z.length === 3 && /^[0-9]/.test(z[1] || ''));
    check('2-vorab: die Tabelle hat Wertzeilen', werte.length >= 6, { zeilen: werte.length });
    const verschieden = werte.filter(z => z[1] !== z[2]).length;
    check('2a: "Boss faellt" und "ueberlebt" nennen verschiedene Zahlen', verschieden >= 5,
          { verschieden, beispiel: werte.slice(0, 3) });
    const nurBeiFall = werte.filter(z => z[2] === '–');
    check('2b: Antimaterie und Fragmente gibt es NUR beim Fall', nurBeiFall.length === 2, nurBeiFall);

    // --- 3. Die Gegenrichtungen: schweigen, wo nichts zu sagen ist ---
    const ohneListe = await zeichne(browser, raidDoc({ phase:'enroute',
      dispatch:{ arrivalAt: Date.now()+5e5, participantCount:3, totalShips:500, totalPower:90000 } }));
    check('3a: ohne Rangliste steht KEINE Vorschau da', ohneListe.hatVorschau === false, ohneListe.txt && ohneListe.txt.slice(-80));
    const ohneMich = await zeichne(browser, versand([
      { playerId:'x', name:'X', power:40000 }, { playerId:'c', name:'C', power:20000 }]));
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
