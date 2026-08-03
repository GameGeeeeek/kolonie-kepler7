// Recycler-Sammelauftraege (03.08.2026, Spieler-Wunsch Sascha).
//
// DER WUNSCH, woertlich: "Recycler wenn sie das Feld abgebaut haben sollen sie automatisch
// zurueck kommen; waehrend sie woanders einsammeln belegen sie einen Flottenslot je Flotte."
//
// AUSGANGSLAGE: Recycler waren STATIONIERT, nicht auf Mission. Wer sie zu einem fremden
// Truemmerfeld schickte, hatte sie danach dort stehen - bis er sie von Hand zurueckholte.
// Das kostete keinen Flottenslot, aber dauerhaft Schiffe an einem Ort ohne Arbeit.
//
// GEPRUEFT WIRD, und warum jeder Punkt noetig ist:
//
//   1. Der Auftrag entsteht auf dem ECHTEN Weg (Knopf im Kampfbericht) und belegt danach
//      GENAU EINEN Flottenslot. Das ist der Punkt, an dem die Gegenprobe den ersten Entwurf
//      zerlegt hat: Zaehlten Auftrag UND Hinflug-Verlegung, kostete ein einziger Auftrag
//      zwei Slots, und die Zahl im Badge spraenge beim Ankommen ohne erkennbaren Grund.
//   2. Ist am Ziel nichts mehr abzubauen, fliegen die Recycler von SELBST zurueck. Geprueft
//      wird der Endzustand: Der Auftrag ist weg und die Schiffe sind wieder daheim.
//   3. DER NOTAUSGANG. Ein Auftrag an einem Feld, das sich nicht abbauen laesst (volles
//      Lager) oder an dem staendig neue Truemmer entstehen, wuerde sonst einen Slot dauerhaft
//      festhalten - und ausgerechnet das Zurueckholen von Hand scheitert dann am selben
//      Limit. "Auftrag beenden" loest das ohne Flug und ohne Treibstoff.
//   4. Die Anzeige sagt die Wahrheit: eigene Zeile im Seitenmenue (sonst stuende im Badge
//      eine Zahl, zu der es keine Zeile gibt) und keine erfundene Restzeit bei vollem Lager.
//   5. Quelltext-Zusicherungen, die sich zur Laufzeit nicht abfragen lassen - vor allem die
//      vier Aufzaehlungstexte, die die slot-verbrauchenden Missionsarten namentlich nennen.
//      Genau dort verrottet in diesem Projekt erfahrungsgemaess als Erstes etwas.
const fs = require('fs');
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// 'vesna' ist eine ECHTE Planetenkennung aus PLANETS (System kepler). Eine erfundene
// Kennung laesst render() an PLANETS.find(...).name abstuerzen - der erste Anlauf dieses
// Tests ist genau daran gescheitert, und der Fehler sah aus wie ein Fehler im Auftrag.
const ZIEL = 'vesna';

const BERICHT = { id:'r1', ts: Date.now(), type:'npc-attack', result:'win',
  npcName:'Kryllid-Nest (Stufe 3)', attackPower:40000, defensePower:20000,
  fleet:{ jaeger:200 }, ownLostShips:{ jaeger:20 },
  targetPlanet: ZIEL, debrisPlanet: ZIEL, fromPlanet:'home' };

function backend(store, berichte){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='reports')return j({reports: berichte||[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true,version:2});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}

// Reichlich Treibstoff: Ein am Deuterium gescheiterter Rueckflug ist ein EIGENER Fall (der
// Auftrag wartet dann und meldet es einmalig) - er darf diesen Test nicht zufaellig faerben.
function save(extra){
  return JSON.stringify(Object.assign({
    tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
    buildings:{solar:22,mine:20,kristallmine:18,labor:14,lager:30,werft:14,turm:8,laser:10,schild:6},
    research:{rkampf:9,rflottenkoord:3},
    fleet:{ recycler:30, jaeger:200, missions:[] },
    colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
    battleStats:{wins:9,losses:2}, xp:260000, credits:180000, buffs:[], lastTick:Date.now(),
    colonyNames:{}, modules:{}, shipModules:{}
  }, extra||{}));
}
// Eine Kolonie am Zielplaneten - dorthin koennen Recycler verlegt werden.
const mitKolonie = (recycler, feld, auftraege) => ({
  colonies:{ [ZIEL]: { fleet:{ recycler: recycler, missions:[] }, buildings:{solar:8,mine:6,lager:10}, resources:{} } },
  debrisFields: feld ? { [ZIEL]: feld } : {},
  debrisFieldTrackers: feld ? { [ZIEL]: { startedAt: Date.now()-60000, totalAdded:{...feld}, totalCollected:{} } } : {},
  recyclerAuftraege: auftraege || {}
});

const badge = page => page.evaluate(() => {
  const b = document.getElementById('fleetLimitBadge');
  return b ? (b.textContent||'').replace(/\s+/g,' ').trim() : null;
});
const seiten = page => page.evaluate(() => {
  const l = document.getElementById('fleetPositionList');
  return l ? (l.textContent||'').replace(/\s+/g,' ').trim() : '';
});

async function starteSpiel(browser, spielstand, berichte){
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{ width:1100, height:1400 } }));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': spielstand }, berichte));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3400);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  return { page, errs, ctx };
}

(async () => {
  // ================================================= 5) Quelltext-Zusicherungen
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  for (const f of ['recyclerAuftraege','recyclerAuftragSlots','recyclerUnterwegsZu',
                   'vielleichtSammelauftrag','beendeRecyclerAuftrag','processRecyclerAuftraege'])
    check('5: ' + f + '() ist genau einmal definiert',
      (src.match(new RegExp('function ' + f + '\\b', 'g')) || []).length === 1);
  check('5: der Auftrag zaehlt in activeFleetMissionCount() mit',
    /return n \+ relocateGroupIds\.size \+ recyclerAuftragSlots\(\);/.test(src));
  check('5: die Hinflug-Verlegung wird dabei NICHT doppelt gezaehlt',
    /if \(m\.groupId && auftragsGruppen\.has\(m\.groupId\)\) continue;/.test(src));
  check('5: der Rueckflug umgeht die Slot-Pruefung (sonst blockiert er sich selbst)',
    /if \(!ohneSlotPruefung && fleetLimitBlocks\(\)\) return false;/.test(src));
  check('5: die Sammelverlegung erzeugt keine Auftraege',
    /sammelverlegungLaeuft = true;/.test(src) && /finally \{ sammelverlegungLaeuft = false; \}/.test(src));
  check('5: der Rueckkehr-Ausloeser haengt NICHT am "Feld leer"-Zweig des Abbaus',
    /const recyclerHeim = processRecyclerAuftraege\(\);/.test(src));

  const stelle = (von, bis) => { const a = src.indexOf(von); return a < 0 ? '' : src.slice(a, src.indexOf(bis, a) + bis.length); };
  const nennt = t => /Recycler-Gruppe/.test(t);
  // Ausschnitt bis zum NAECHSTEN Forschungseintrag: desc steht hinter costMult, ein Schnitt
  // dort haette die zu pruefende Stelle gar nicht enthalten.
  check('5: rflottenkoord.desc nennt die Recycler-Gruppen',
    nennt(stelle("key:'rflottenkoord'", "key:'rexpslots'")));
  check('5: HELP „Flottenentsendelimit" nennt sie', nennt(stelle("title:'Flottenentsendelimit'", '},')));
  check('5: HELP-FAQ zur Blockade nennt sie', nennt(stelle('Warum wird mein Angriff', '},')));
  check('5: TAB_HINTS.flotte nennt sie', nennt(stelle("flotte: { icon:'ti-ship'", '},')));
  check('5: HELP „Truemmerfelder" erklaert Auftrag und Rueckkehr',
    /Sammelauftrag/.test(stelle("title:'Trümmerfelder'", '},')));
  check('5: die Werft-Karte nennt den Recycler nicht mehr nur „passiv"',
    !/Trümmerfeld-Sammlung am stationierten Planeten · passiv/.test(src));

  const browser = await starteBrowser();

  // ============================== 1) Der echte Weg: Knopf im Kampfbericht
  {
    const { page, errs, ctx } = await starteSpiel(browser,
      save(mitKolonie(0, { erz:9000, kristalle:4000 }, {})), [BERICHT]);
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="flotte"]'); if (x) x.click(); });
    await page.waitForTimeout(1000);
    const vorher = await badge(page);
    check('1: vor dem Verlegen ist kein Slot belegt', /(^|\D)0\s*\/\s*5/.test(vorher||''), vorher);

    await page.evaluate(() => { const x = document.getElementById('headerReportsBtn'); if (x) x.click(); });
    await page.waitForTimeout(1500);
    const knopf = await page.evaluate(() => {
      const b = document.querySelector('[data-send-recyclers]');
      if (!b || b.disabled) return { da:false, gesperrt: !!(b && b.disabled) };
      b.click(); return { da:true };
    });
    check('1: der Kampfbericht bietet den Recycler-Knopf an', knopf.da === true, knopf);
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const c = document.getElementById('reportsCloseBtn') || document.querySelector('[data-close-reports]'); if (c) c.click(); });
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="flotte"]'); if (x) x.click(); });
    await page.waitForTimeout(1200);

    const nachher = await badge(page);
    // GENAU EINER, nicht zwei: Der Auftrag und seine Hinflug-Verlegung sind dieselbe Flotte.
    check('1: danach ist GENAU EIN Flottenslot belegt (nicht zwei)',
      /(^|\D)1\s*\/\s*5/.test(nachher||''), { vorher, nachher });
    check('keine JS-Fehler (Weg 1)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 2) Feld leer -> sie kommen von selbst zurueck
  {
    // Recycler stehen am Ziel, Auftrag laeuft, aber es liegt NICHTS mehr da.
    const { page, errs, ctx } = await starteSpiel(browser,
      save(mitKolonie(30, null, { [ZIEL]: { heimat:'home', anzahl:30, gestartet: Date.now()-120000, groupId:null, treibstoffGemeldet:false } })), []);
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="flotte"]'); if (x) x.click(); });
    await page.waitForTimeout(3000);   // mehrere Sekunden-Takte
    const z = await page.evaluate(() => {
      const l = document.getElementById('fleetPositionList');
      return { seite: l ? (l.textContent||'').replace(/\s+/g,' ') : '',
               badge: (document.getElementById('fleetLimitBadge')||{}).textContent||'' };
    });
    // Der Rueckflug ist eine gewoehnliche Verlegung - sie taucht als solche im Seitenmenue auf,
    // und der Auftrag ist verschwunden (sonst stuende dort weiter "sammeln bei").
    check('2: die Recycler fliegen von selbst heim (Rueckflug sichtbar)',
      /Recycler/.test(z.seite) && !/sammeln bei/.test(z.seite), z.seite.slice(0,140));
    check('2: dabei bleibt es bei EINEM belegten Slot', /(^|\D)1\s*\/\s*5/.test(z.badge), z.badge.trim());
    check('keine JS-Fehler (Weg 2)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 3+4) Notausgang und Anzeige
  {
    const { page, errs, ctx } = await starteSpiel(browser,
      save(mitKolonie(30, { erz:900000, kristalle:900000 },
        { [ZIEL]: { heimat:'home', anzahl:30, gestartet: Date.now()-120000, groupId:null, treibstoffGemeldet:false } })), []);
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="flotte"]'); if (x) x.click(); });
    await page.waitForTimeout(1600);

    const vor = await page.evaluate(() => ({
      badge: (document.getElementById('fleetLimitBadge')||{}).textContent||'',
      seite: (document.getElementById('fleetPositionList')||{}).textContent.replace(/\s+/g,' ')||'',
      knopf: !!document.querySelector('[data-end-recycler-auftrag]')
    }));
    check('4: der Auftrag hat eine eigene Zeile im Seitenmenue',
      /Recycler sammeln bei/.test(vor.seite), vor.seite.slice(0,140));
    check('4: die Zeile nennt kein erfundenes Ende, sondern eine Restangabe',
      /noch ~|Lager voll|Rückflug/.test(vor.seite), vor.seite.slice(0,160));
    check('3: es gibt einen Knopf „Auftrag beenden"', vor.knopf === true);
    check('3: vorher ist ein Slot belegt', /(^|\D)1\s*\/\s*5/.test(vor.badge), vor.badge.trim());

    await page.evaluate(() => { const b = document.querySelector('[data-end-recycler-auftrag]'); if (b) b.click(); });
    await page.waitForTimeout(1400);
    const nach = await page.evaluate(() => ({
      badge: (document.getElementById('fleetLimitBadge')||{}).textContent||'',
      seite: (document.getElementById('fleetPositionList')||{}).textContent.replace(/\s+/g,' ')||''
    }));
    check('3: der Knopf gibt den Slot sofort frei', /(^|\D)0\s*\/\s*5/.test(nach.badge), { vor: vor.badge.trim(), nach: nach.badge.trim() });
    check('3: die Recycler bleiben dabei stehen (kein Flug ausgeloest)',
      !/sammeln bei/.test(nach.seite) && !/→/.test(nach.seite), nach.seite.slice(0,140));
    check('keine JS-Fehler (Weg 3+4)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
