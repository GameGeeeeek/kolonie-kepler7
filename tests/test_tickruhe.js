// Tick-Ruhe der Dauerlaeufer: die v8.534.0-Umstellungen auf setBoxHtml/setBoxText (16.08.2026).
//
// GEMESSEN, nicht geschaetzt (MutationObserver ueber alle zwoelf Reiter, Rohdaten der
// Mess-Session): 40 Elemente schrieben auf JEDEM Reiter jede Sekunde byte-identisch neu -
// darunter tradeRouteBox (1.449 B, der groesste Einzelposten), fleetStickyBar (368 B),
// doctrineBox (328 B), die drei Verlaufs-SVGs, die Automatik-Labels (je 221 B) und ein Dutzend
// kleiner Status-Texte. Seit v8.534.0 laufen die Boxen ueber setBoxHtml (Markup-Signatur) und
// die reinen Text-Labels ueber setBoxText (schreibt nur bei geaendertem textContent).
//
// GEPRUEFT WIRD IN BEIDE RICHTUNGEN - die Gefahr einer Bremse ist nicht, dass sie zu wenig
// bremst, sondern dass sie zu viel bremst (Vorbild test_kleinboxen_cache):
//   1) EINGEFRORENE UHR (Regel 18: NUR Date.now() festhalten, keine Uhr-Hilfen des Treibers;
//      Reihenfolge nach der Regel: erst einfrieren, einen Tick verstreichen lassen, DANN
//      markieren): Ohne Zeitfortschritt aendert sich kein angezeigter Wert - die hier gemessene
//      Teilmenge der umgestellten Boxen und Labels (alles, was vom Fortschritt-Tab aus lebt bzw.
//      reiterunabhaengig geschrieben wird; die Flotten-Listen prueft Abschnitt 2 in der
//      Gegenrichtung) muss vollstaendig stillstehen. Die Uhr haelt auch die Produktion an; ohne
//      das Einfrieren wuerde der Test Wanduhr-Glueck messen (fmt() rundet die kleinen Zuwaechse
//      meist weg, aber eben nur meist).
//   2) MIT laufender Mission schreiben Missions-/Positionslisten WEITER jede Sekunde - der
//      Countdown macht das Markup jede Sekunde zu einem anderen, die Markup-Signatur korrigiert
//      sich selbst. Ohne diese Pruefung waere eine eingefrorene Restzeit die wahrscheinlichste
//      Folge einer zu breiten Bremse.
//   3) BEDIENBAR NACH UEBERSPRUNGENEN TICKS (CLAUDE.md markiert das als testpflichtig, weil die
//      Verdrahtung bei traderBox und moduleMarketBox im Schreibzweig steht): Nach mehreren
//      Sekunden ohne Neuaufbau muss der Handels-Knopf des Haendlers und der Kauf-Knopf der
//      Modulboerse weiterhin wirken - die alten Knoten samt Handlern bleiben ja stehen.
//      relocateBox folgt exakt demselben Muster (Verdrahtung im if-setBoxHtml-Zweig) und ist
//      damit stellvertretend mit abgedeckt.
//
// GEGENPROBE (Regel 1, in beide Richtungen ausgefuehrt - Ergebnis im PR dokumentiert): Am alten
// Stand fallen die Still-Pruefungen aus Abschnitt 1 (Marken sterben, Labels mutieren jede
// Sekunde), Abschnitte 2 und 3 bleiben gruen (der alte Stand schrieb ja immer). Die Anzahl der
// gelaufenen Pruefungen beider Laeufe wurde verglichen (Regel 34).
const { starteBrowser, devices, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

function backend(store, zaehler){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='modulemarket')return j({listings:[{id:'L1',price:500,mine:false,isShip:false,instKey:'xx',sellerName:'B'}],limits:{maxPerUser:5,feePct:0.05}});
  if(p==='modulemarket/buy'){ if(zaehler) zaehler.mmBuy++; return j({ok:false,error:'Testlauf'}); }
  if(p==='market')return j({});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending|notifications/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

// Ereignis-Uhren gepinnt (Regel 18: bei 0 feuert der erste Planeten-Ereignis-Check GARANTIERT
// und schriebe mitten im Messfenster Boxen um). Keine Deuterium-Produktion und keine Routen im
// Grundzustand - die Sticky-Leiste und creditsDisplay haben damit auch VOR dem Einfrieren der
// Uhr keinen Grund, sich zu aendern.
function save(zusatz){
  return JSON.stringify(Object.assign({ tutorialSeen:true, newbieWelcomeSeen:true,
    nextPlanetEventCheck: Date.now() + 3600000, nextTraderCheck: Date.now() + 3600000,
    resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
    buildings:{solar:22,mine:20,kristallmine:18,labor:14,lager:16,werft:14,turm:8},
    research:{rkampf:9,rsolar:9,rerz:8},
    fleet:{jaeger:600,bomber:120,frachter:80,missions:[]},
    colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
    battleStats:{wins:9,losses:2}, xp:260000, credits:180000, buffs:[], lastTick:Date.now(),
    colonyNames:{}, modules:{}, shipModules:{} }, zusatz));
}

const markiere = (page, id) => page.evaluate(x => {
  const b=document.getElementById(x); if(!b || !b.firstElementChild) return false;
  b.firstElementChild.__marke = 1; return true;
}, id);
const markeDa = (page, id) => page.evaluate(x => {
  const b=document.getElementById(x);
  return !!(b && b.firstElementChild && b.firstElementChild.__marke);
}, id);

async function spiel(browser, zustand, zaehler){
  const store={'kepler7-save-v3':save(zustand)};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1200} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store, zaehler));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2900);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  return { page, ctx, errs };
}

(async () => {
  const browser = await starteBrowser();

  // ------------------------------------ 1) Eingefrorene Uhr: alles steht still
  {
    const { page, ctx, errs } = await spiel(browser, {});
    // Fortschritt-Tab: dort leben die meisten der umgestellten Boxen; die Labels und das
    // Seitenmenue werden reiterunabhaengig geschrieben und sind hier ebenfalls sichtbar.
    await page.evaluate(() => { const b=document.querySelector('.tab-btn[data-tab="fortschritt"]'); if (b) b.click(); });
    await page.waitForTimeout(1500);

    // Boxen mit Kind-Elementen: Marke am ersten Kind stirbt bei jedem Neuaufbau.
    const BOXEN = ['kofiTopSupporterBox','inventoryBox','rareItemsBox','scoreLogBox',
      'fleetPositionList','scoreHistorySvg','creditsHistorySvg','prodHistorySvg',
      'traderBox','lastLoginText','scoreChartNote'];
    // Reine Text-Anzeigen (setBoxText): kein Kind-Element - je ein gescopter Observer.
    const LABELS = ['heroFleet','heroAttack','heroDefense','heroResearch','heroExpedition',
      'heroLevel','heroBP','heroScore','profileNameDisplay','profileBP','profileScore',
      'scoreTotalValue','fpColonyCount','fpFleetCount','autoReinforceLabel','autoRepairLabel',
      'autoWatchLiveRaidLabel','powerSaveLabel','notifStateLabel','soundStateLabel',
      'allianceNameDisplay','allianceMetaLine','autoExploreLabel'];

    // REIHENFOLGE nach Regel 18: erst die Uhr einfrieren (NUR Date.now), dann einen Tick unter
    // stehender Uhr verstreichen lassen, DANN markieren und beobachten. Andersherum koennte
    // zwischen Markieren und Einfrieren noch ein Wanduhr-Tick schreiben und die Marke toeten -
    // der Test schiene dann zu beweisen, die Bremse sei tot.
    await page.evaluate(() => { const t0 = Date.now(); Date.now = () => t0; });
    await page.waitForTimeout(1300); // ein voller Tick unter stehender Uhr

    const vorab = {};
    for (const id of BOXEN) vorab[id] = await markiere(page, id);
    check('1-vorab: alle Marken-Boxen sind gerendert und markierbar',
      BOXEN.every(id => vorab[id] === true), vorab);
    const labelDa = await page.evaluate(ids => ids.map(id => {
      const el = document.getElementById(id);
      return el && (el.textContent||'').length > 0;
    }), LABELS);
    check('1-vorab2: alle Text-Labels existieren mit Inhalt',
      labelDa.every(Boolean), LABELS.filter((_,i)=>!labelDa[i]));

    await page.evaluate(ids => {
      window.__mut = {};
      for (const id of ids){
        window.__mut[id] = 0;
        const el = document.getElementById(id);
        if (el) new MutationObserver(m => { window.__mut[id] += m.length; })
          .observe(el, { childList:true, subtree:true, characterData:true });
      }
    }, LABELS);
    await page.waitForTimeout(4200); // mindestens vier Sekunden-Ticks

    for (const id of BOXEN){
      check('1: #' + id + ' wurde NICHT neu geschrieben', await markeDa(page, id) === true);
    }
    const mut = await page.evaluate(() => window.__mut);
    const unruhig = Object.entries(mut).filter(([,n]) => n > 0);
    check('1: kein Text-Label wurde neu geschrieben', unruhig.length === 0, unruhig);
    const f = errs.filter(e=>!/favicon/i.test(e));
    check('1: keine Konsolenfehler', f.length === 0, f.slice(0,3));
    await ctx.close();
  }

  // ------------------------------------ 2) Mit laufender Mission tickt der Countdown weiter
  {
    const jetzt = Date.now();
    const { page, ctx, errs } = await spiel(browser, {
      fleet:{jaeger:600,bomber:120,frachter:80,missions:[
        { id:'m1', type:'explore', targetId:'testziel', startTime:jetzt, endTime:jetzt+600000 }
      ]}
    });
    await page.evaluate(() => { const b=document.querySelector('.tab-btn[data-tab="flotte"]'); if (b) b.click(); });
    await page.waitForTimeout(1500);
    const posText = await page.evaluate(()=>{const b=document.getElementById('fleetPositionList'); return b?b.textContent:'';});
    check('2-vorab: die Mission steht in der Positionsliste (sonst misst 2 den leeren Fall)',
      posText.length > 0 && !/keine Missionen unterwegs/.test(posText), posText.slice(0,80));
    // Auch fuer missionsActive belegen, dass die MISSION dort steht - nicht nur, dass die Box
    // ein Kind hat: Die Leer-Notiz ist ebenfalls ein Kind-Element, und eine Marke darauf wuerde
    // im Fehlerfall die irrefuehrende Meldung "Countdown friert ein" liefern, obwohl schlicht
    // die Mission fehlt (Review-Fund).
    const aktText = await page.evaluate(()=>{const b=document.getElementById('missionsActive'); return b?b.textContent:'';});
    check('2-vorab2: die Mission steht auch in der Missionsliste des Flotten-Tabs',
      aktText.length > 0 && !/Keine aktiven Missionen/.test(aktText), aktText.slice(0,80));
    const konnte = { fleetPositionList: await markiere(page,'fleetPositionList'), missionsActive: await markiere(page,'missionsActive') };
    check('2-vorab3: beide Listen lassen sich markieren', konnte.fleetPositionList && konnte.missionsActive, konnte);
    await page.waitForTimeout(2600);
    check('2: fleetPositionList schreibt mit laufendem Countdown weiter - er friert nicht ein',
      await markeDa(page, 'fleetPositionList') === false);
    check('2: missionsActive ebenso',
      await markeDa(page, 'missionsActive') === false);
    const f2 = errs.filter(e=>!/favicon/i.test(e));
    check('2: keine Konsolenfehler', f2.length === 0, f2.slice(0,3));
    await ctx.close();
  }

  // ------------------------------------ 3) Bedienbar nach uebersprungenen Ticks
  {
    const zaehler = { mmBuy: 0 };
    const { page, ctx, errs } = await spiel(browser, {
      trader: { give:'erz', giveAmt:100, get:'kristalle', getAmt:50, expiresAt: Date.now()+1800000 }
    }, zaehler);
    // 3a: Haendler - Verdrahtung liegt im setBoxHtml-Schreibzweig; nach Sekunden ohne Neuaufbau
    // muss der alte Knoten samt Handler noch wirken. acceptTrade() raeumt den Haendler weg -
    // der Textwechsel der Box ist der Beleg, dass der Klick wirklich verarbeitet wurde.
    // Die PRAEMISSE "die Box stand waehrend der Wartezeit wirklich still" wird per Marke
    // MITGEMESSEN (Review-Fund: ohne sie prueft der Abschnitt nur "Klick funktioniert",
    // was auch bei sekuendlicher Neuverdrahtung trivial gruen waere).
    await page.evaluate(() => { const b=document.querySelector('.tab-btn[data-tab="fortschritt"]'); if (b) b.click(); });
    await page.waitForTimeout(1200);
    const traderVorher = await page.evaluate(()=>{const b=document.getElementById('traderBox'); return b?b.textContent:'';});
    check('3-vorab: das Handelsangebot steht da', /Handelsangebot/.test(traderVorher), traderVorher.slice(0,60));
    check('3-vorab2: traderBox laesst sich markieren', await markiere(page, 'traderBox') === true);
    await page.waitForTimeout(3600); // uebersprungene Ticks: Markup identisch, keine Neuverdrahtung
    check('3a-praemisse: traderBox stand waehrend der Wartezeit wirklich still (Ticks wurden uebersprungen)',
      await markeDa(page, 'traderBox') === true);
    await page.evaluate(()=>{ const b=document.getElementById('acceptTradeBtn'); if (b) b.click(); });
    await page.waitForTimeout(600);
    const traderNachher = await page.evaluate(()=>{const b=document.getElementById('traderBox'); return b?b.textContent:'';});
    check('3a: der Handels-Knopf wirkt nach uebersprungenen Ticks (Haendler abgeraeumt)',
      /Kein Händler im Orbit/.test(traderNachher), traderNachher.slice(0,60));

    // 3b: Modulboerse - gleiche Verdrahtungslage, gleiche mitgemessene Praemisse. Der Kauf-Klick
    // muss die Anfrage ausloesen (der Mock antwortet ok:false, es geht nur um den Handler).
    await page.evaluate(() => { const b=document.querySelector('.tab-btn[data-tab="markt"]'); if (b) b.click(); });
    await page.waitForTimeout(1200);
    const mmDa = await page.evaluate(()=>!!document.querySelector('#moduleMarketBox [data-mm-buy]'));
    check('3-vorab3: die Modulboerse zeigt das Mock-Angebot mit Kauf-Knopf', mmDa === true);
    check('3-vorab4: moduleMarketBox laesst sich markieren', await markiere(page, 'moduleMarketBox') === true);
    await page.waitForTimeout(3600);
    check('3b-praemisse: moduleMarketBox stand waehrend der Wartezeit wirklich still',
      await markeDa(page, 'moduleMarketBox') === true);
    await page.evaluate(()=>{ const b=document.querySelector('#moduleMarketBox [data-mm-buy]'); if (b) b.click(); });
    await page.waitForTimeout(600);
    check('3b: der Kauf-Knopf der Modulboerse feuert nach uebersprungenen Ticks die Anfrage',
      zaehler.mmBuy >= 1, { anfragen: zaehler.mmBuy });
    const f3 = errs.filter(e=>!/favicon/i.test(e));
    check('3: keine Konsolenfehler', f3.length === 0, f3.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  return ende();
})().catch(e => { console.error(e); process.exit(1); });
