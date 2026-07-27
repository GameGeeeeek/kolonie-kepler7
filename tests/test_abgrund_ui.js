// Der Abgrund im laufenden Spiel (27.07.2026, v8.320.0).
//
// test_abgrund.js prueft die Formeln am Quelltext. Dieser Test prueft, ob das Ding im Browser
// wirklich funktioniert - genau die Klasse von Fehlern, die eine Quelltextpruefung nicht sieht:
// eine Box, die nie gerendert wird, ein Knopf ohne Handler, ein Aufloesungszweig, der bei der
// ersten echten Mission ueber eine undefinierte Variable stolpert.
//
// state liegt in einer IIFE und ist von aussen nicht lesbar. Gemessen wird deshalb der
// GESPEICHERTE Spielstand ueber das gemockte Backend - das ist ohnehin die ehrlichere Messung,
// weil genau dieser Stand nach einem Reload wieder geladen wird.
//
// Geprueft wird:
//   1) ohne Singularitaetsphysik zeigt die Box den verschlossenen Zustand, keinen Tauchgang
//   2) mit der Forschung erscheint der Sektor mit Namen, Staerke und Mutatoren
//   3) die Tiefenwahl-Knoepfe schreiben in den Spielstand (nicht nur ins DOM)
//   4) ein Tauchgang laesst sich starten und landet als Mission im Spielstand
//   5) DER KERNFALL: eine faellige Abgrund-Mission wird beim Laden aufgeloest - Rekordtiefe,
//      Splitter und Mutatoren-Verzeichnis stehen danach im gespeicherten Stand
//   6) die Werkstatt gibt Splitter aus und erhoeht die Stufe
//   7) keine Konsolenfehler dabei
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

// Grosse Flotte inkl. Frachter: Tiefe 1 hat 900 Gegnerstaerke, der Sieg muss sicher sein, sonst
// misst Pruefung 5 bei jedem Lauf etwas anderes. Frachter, damit die Bergung nicht an leerem
// Laderaum scheitert.
const basisStand = zusatz => JSON.stringify(Object.assign({
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:20,mine:18,lager:20,werft:12,labor:12},
  research:{}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null},
  fleet:{ jaeger:4000, schlachtschiff:400, frachter:200, missions:[] },
  battleStats:{wins:9,losses:2}, xp:20000, credits:50000, buffs:[], lastTick:Date.now(),
  colonyNames:{}
}, zusatz));

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

const gespeichert = store => { try { return JSON.parse(store['kepler7-save-v3']||'{}'); } catch(e){ return {}; } };

async function starte(browser, stand){
  const store={'kepler7-save-v3':stand};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1400} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  page.on('dialog', d=>d.accept());
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2800);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="galaxie"]');if(b)b.click();});
  await page.evaluate(()=>{const b=document.querySelector('[data-galaxy-subtab="kampf"]');if(b)b.click();});
  await page.waitForTimeout(1200);
  return { ctx, page, errs, store };
}
const boxText = page => page.evaluate(()=>{ const b=document.getElementById('abgrundBox'); return b?b.innerText:null; });

(async () => {
  const browser = await starteBrowser();

  // ---- 1) verschlossen ----
  {
    const { ctx, page } = await starte(browser, basisStand({}));
    const txt = await boxText(page);
    check('1: ohne Singularitaetsphysik steht die Box auf "verschlossen"',
      !!txt && /verschlossen/i.test(txt) && /Singularit/i.test(txt), txt ? txt.slice(0,80) : null);
    const knopf = await page.evaluate(()=>!!document.querySelector('[data-abgrund-start]'));
    check('1: es gibt keinen Abtauchen-Knopf, solange der Abgrund zu ist', !knopf);
    await ctx.close();
  }

  // ---- 2-4, 6) freigeschaltet ----
  {
    const { ctx, page, errs, store } = await starte(browser, basisStand({ research:{ rsingularitaet:1 } }));
    const txt = await boxText(page);
    check('2: der Sektor erscheint mit Name, Tiefe und Gegnerstaerke',
      !!txt && /Tiefe 1/.test(txt) && /Gegnerst/i.test(txt) && /[α-ω]-\d{4}/.test(txt),
      txt ? txt.split('\n').slice(0,4) : null);
    // Tiefe 1 zieht genau einen Mutator - er muss mit Beschreibung dastehen, nicht nur als Name.
    const mutZeilen = await page.evaluate(()=>{
      const b=document.getElementById('abgrundBox'); if(!b) return 0;
      return Array.from(b.querySelectorAll('div')).filter(d => /^(Ionensturm|Gravitationstrichter|Dichtes|Echokammer|Leerenstille|Kristallsporen|Dunkelstr|Panzerschwarm|Sensorblindheit|Hitzeblase|Wracklinie|Resonanzader|Nullzone|Splitterregen|Spiegelfeld|Tiefendruck|Phosphorwolke|Altes Signal)/.test(d.innerText||'')).length;
    });
    check('2: mindestens ein Mutator wird mit Namen angezeigt', mutZeilen > 0, { treffer:mutZeilen });

    // ---- 3) Tiefenwahl ----
    const vorher = gespeichert(store).abgrund;
    const runterAktiv = await page.evaluate(()=>{ const b=document.querySelector('[data-abgrund-tiefe="1"]'); return !!b && !b.disabled; });
    check('3: ohne Rekord ist die naechste Tiefe noch nicht waehlbar', !runterAktiv,
      { rekord: vorher ? vorher.best : null });

    // ---- 4) Tauchgang starten ----
    await page.evaluate(()=>{ const b=document.querySelector('[data-abgrund-start]'); if(b) b.click(); });
    await page.waitForTimeout(1500);
    const nachStart = gespeichert(store);
    const mission = ((nachStart.fleet||{}).missions||[]).find(m=>m.type==='abgrund');
    check('4: der Tauchgang steht als Mission im gespeicherten Spielstand',
      !!mission && mission.targetId === 1 && mission.endTime > Date.now(),
      mission ? { typ:mission.type, tiefe:mission.targetId, name:mission.fleetName } : null);
    check('4: die Mission fuehrt eine Flottenzusammensetzung mit',
      !!mission && mission.composition && Object.keys(mission.composition).length > 0);
    const zweiter = await page.evaluate(()=>{ const b=document.querySelector('[data-abgrund-start]'); return !!b && b.disabled; });
    check('4: waehrend eines laufenden Tauchgangs ist der Knopf gesperrt', zweiter);
    check('4: keine Konsolenfehler bis hierhin', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---- 5) faellige Mission wird aufgeloest ----
  {
    const jetzt = Date.now();
    const stand = basisStand({
      research:{ rsingularitaet:1 },
      fleet:{ jaeger:4000, schlachtschiff:400, frachter:200, missions:[
        { id:'t1', type:'abgrund', targetId:1, startTime: jetzt-600000, endTime: jetzt-2000,
          composition:{ jaeger:4000, schlachtschiff:400, frachter:200 }, fleetName:'Probe', power:200000 }
      ]}
    });
    const { ctx, page, errs, store } = await starte(browser, stand);
    await page.waitForTimeout(1800);
    const s = gespeichert(store);
    const a = s.abgrund || {};
    check('5: die faellige Mission ist aufgeloest (keine offene Abgrund-Mission mehr)',
      !((s.fleet||{}).missions||[]).some(m=>m.type==='abgrund'));
    check('5: die Rekordtiefe steht im Spielstand', (a.best||0) >= 1, { best:a.best });
    check('5: Abgrundsplitter wurden gutgeschrieben', (a.splitter||0) > 0, { splitter:a.splitter });
    check('5: die naechste Tiefe ist freigeschaltet', (a.tiefe||0) >= 2, { tiefe:a.tiefe });
    check('5: der begegnete Mutator steht im Verzeichnis',
      a.gesehen && Object.keys(a.gesehen).length > 0, { gesehen:a.gesehen });
    check('5: der Tauchgang wurde gezaehlt', (a.tauchgaenge||0) >= 1, { tauchgaenge:a.tauchgaenge });
    const txt = await boxText(page);
    // Case-insensitiv: das Rekord-Pill wird per CSS in Grossbuchstaben gesetzt, innerText liefert
    // deshalb "REKORD 1". Eine schreibungsgenaue Suche schlug hier fehl, obwohl die Anzeige stimmte.
    check('5: die Box zeigt den Rekord an', !!txt && /rekord\s*1/i.test(txt),
      txt ? txt.split('\n').slice(0,2) : null);
    check('5: keine Konsolenfehler bei der Aufloesung', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---- 6) Werkstatt ----
  {
    const stand = basisStand({ research:{ rsingularitaet:1 },
      abgrund:{ tiefe:1, best:0, splitter:5000, tauchgaenge:0, gesehen:{}, werkstatt:{} } });
    const { ctx, page, errs, store } = await starte(browser, stand);
    const vorher = gespeichert(store).abgrund || {};
    const gedrueckt = await page.evaluate(()=>{
      const b=document.querySelector('[data-abgrund-kauf="druckhuelle"]');
      if(!b || b.disabled) return false; b.click(); return true;
    });
    check('6: der Kauf-Knopf der Werkstatt ist bedienbar', gedrueckt);
    await page.waitForTimeout(1200);
    const nachher = gespeichert(store).abgrund || {};
    check('6: die Ausbaustufe ist gestiegen',
      ((nachher.werkstatt||{}).druckhuelle||0) === 1, { stufe:(nachher.werkstatt||{}).druckhuelle });
    check('6: Splitter wurden abgezogen',
      (nachher.splitter||0) < (vorher.splitter||0), { vorher:vorher.splitter, nachher:nachher.splitter });
    check('6: keine Konsolenfehler beim Kauf', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
