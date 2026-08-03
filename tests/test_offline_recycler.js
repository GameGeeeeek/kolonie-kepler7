// Recycler sammeln auch offline (04.08.2026, Spieler-Wunsch Sascha).
//
// AUSGANGSLAGE: collectDebrisWithRecyclers() lief ausschliesslich im Haupt-Tick, also nur bei
// geoeffnetem Spiel. Wer abends einen Sammelauftrag losschickte, fand am Morgen einen belegten
// Flottenslot und ein unveraendertes Truemmerfeld vor - acht Stunden Recycler-Arbeit, die es
// nie gegeben hat, waehrend Produktion, Bauauftraege und Forschung laengst offline weiterliefen.
//
// GEMESSEN WIRD DIE MENGE, nicht "ist ueberhaupt etwas passiert". Die Rate ist bekannt
// (8 je Recycler und Sekunde), also ist auch der Ertrag vorhersagbar - und nur eine Pruefung
// gegen die erwartete Zahl faellt auf, wenn die Zeitrechnung um einen Faktor danebenliegt.
//
// DREI FAELLE, und der zweite ist der, wegen dem es die Sonderbehandlung gibt:
//   1. Die Recycler STANDEN schon am Feld -> volle Abwesenheit.
//   2. Sie kamen erst WAEHREND der Abwesenheit an -> nur die Zeit ab Ankunft. Ohne diesen Fall
//      waere der Nachtauftrag genau das geblieben, was er vorher war: ein Slot ohne Fortschritt.
//   3. Ein kleines Feld wird dabei leer -> es verschwindet, und der Ertrag steht im
//      „Willkommen zurueck"-Fenster. Sonst staende der Spieler vor gestiegenen Rohstoffen ohne
//      Erklaerung.
//
// Der Spielstand nutzt bewusst ein ANTIMATERIE-Truemmerfeld: Diese Basis produziert keine
// Antimaterie, das Lager bleibt dafuer also frei. Mit Erz waere die Messung wertlos - die
// Offline-Produktion fuellt das Lager, der Abbau laeuft gegen den Deckel und der Test
// mysteriös rot, obwohl die Mechanik stimmt (genau so ist es beim Bau dieses Tests passiert).
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const RATE = 8;              // Abbau je Recycler und Sekunde (collectDebrisWithRecyclers)
const WEG_SEK = 30*60;       // 30 Minuten Abwesenheit
const ANKUNFT_VOR_SEK = 300; // Fall 2: angekommen vor 5 Minuten

function stand(jetzt, extra){
  return JSON.stringify(Object.assign({
    tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{energie:5e5,erz:10,kristalle:10,deuterium:10,antimaterie:10,forschungspunkte:10},
    buildings:{solar:22,mine:20,labor:14,lager:75,werft:14},
    research:{}, colonies:{}, activeBasePlanet:'home',
    player:{id:'u',name:'A',avatarKey:null}, xp:9e5, credits:5e5,
    buffs:[], lastTick: jetzt - WEG_SEK*1000, colonyNames:{}, modules:{}, shipModules:{}
  }, extra));
}

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){
    const k=decodeURIComponent(p.slice(8));
    if(req.method()==='PUT'){ try{ store[k]=JSON.parse(req.postData()).value; }catch(e){} return j({ok:true,version:2}); }
    if(store[k]!==undefined)return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}

async function heimkehren(browser, extra){
  const jetzt = Date.now();
  const store = { 'kepler7-save-v3': stand(jetzt, typeof extra === 'function' ? extra(jetzt) : extra) };
  const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  const willkommen = await page.evaluate(() => {
    const b = document.getElementById('welcomeBackBody');
    return b ? b.textContent.replace(/\s+/g,' ') : '';
  });
  // Auf den Server-Speicherstand warten, nicht auf die Uhr: er kommt erst mit dem naechsten save().
  for (let i = 0; i < 40; i++){
    try { if (JSON.parse(store['kepler7-save-v3']).debrisFields !== undefined) break; } catch(e){}
    await page.waitForTimeout(250);
  }
  let g = {}; try { g = JSON.parse(store['kepler7-save-v3']); } catch(e){}
  await ctx.close();
  return { g, willkommen, errs };
}

(async () => {
  const browser = await starteBrowser();

  // ============================== 1) Die Recycler standen schon am Feld
  {
    const { g, willkommen, errs } = await heimkehren(browser, jetzt => ({
      fleet:{ recycler:1, missions:[] },
      debrisFields:{ home:{ antimaterie:900000 } },
      debrisFieldTrackers:{ home:{ startedAt: jetzt - WEG_SEK*1000, totalCollected:{} } }
    }));
    const erwartet = RATE * WEG_SEK;                 // 1 Recycler * 8/s * 1800s = 14.400
    const geerntet = Math.round((g.resources||{}).antimaterie || 0);
    // Grosszuegige Spanne nach oben: Zwischen Ankunft und Speicherstand laufen noch echte Ticks.
    check('1: der Abbau lief waehrend der Abwesenheit weiter',
      geerntet >= erwartet * 0.9, { geerntet, erwartet });
    check('1: und zwar in der ERWARTETEN Groessenordnung (nicht nur „irgendetwas")',
      geerntet <= erwartet * 1.2, { geerntet, erwartet });
    const feld = ((g.debrisFields||{}).home||{}).antimaterie || 0;
    check('1: das Truemmerfeld ist um genau diese Menge kleiner geworden',
      Math.abs((900000 - feld) - geerntet) <= erwartet * 0.25, { feldWeg: Math.round(900000-feld), geerntet });
    check('1: das „Willkommen zurueck"-Fenster nennt den Ertrag',
      /Recycler haben abgebaut/.test(willkommen), willkommen.slice(0,140));
    check('keine JS-Fehler (stehende Recycler)', errs.length === 0, errs.slice(0,3));
  }

  // ============================== 2) Die Recycler kamen erst waehrend der Abwesenheit an
  // Das ist der Fall, der die Beschwerde ausgeloest hat: abends losgeschickt, morgens nichts
  // passiert. Gerechnet wird ab ANKUNFT, nicht ab Abmeldung - sonst waeren es hier faelschlich
  // die vollen 30 Minuten.
  {
    const { g, willkommen, errs } = await heimkehren(browser, jetzt => ({
      fleet:{ recycler:0, missions:[
        { id:'m1', type:'relocate', shipKey:'recycler', qty:1, targetId:'home',
          startTime: jetzt - WEG_SEK*1000, endTime: jetzt - ANKUNFT_VOR_SEK*1000,
          from:'home', groupId:'g1' }
      ]},
      debrisFields:{ home:{ antimaterie:900000 } },
      debrisFieldTrackers:{ home:{ startedAt: jetzt - WEG_SEK*1000, totalCollected:{} } }
    }));
    const erwartet = RATE * ANKUNFT_VOR_SEK;         // 8/s * 300s = 2.400
    const zuViel   = RATE * WEG_SEK;                 // waere die volle Abwesenheit
    const geerntet = Math.round((g.resources||{}).antimaterie || 0);
    check('2: auch spaet angekommene Recycler haben gesammelt',
      geerntet >= erwartet * 0.9, { geerntet, erwartet });
    check('2: aber NUR ab ihrer Ankunft, nicht ab der Abmeldung',
      geerntet < zuViel * 0.5, { geerntet, volleAbwesenheit: zuViel });
    check('2: der Ertrag steht im „Willkommen zurueck"-Fenster',
      /Recycler haben abgebaut/.test(willkommen), willkommen.slice(0,140));
    check('keine JS-Fehler (spaete Ankunft)', errs.length === 0, errs.slice(0,3));
  }

  // ============================== 3) Ein kleines Feld wird dabei leer
  {
    const { g, willkommen, errs } = await heimkehren(browser, jetzt => ({
      fleet:{ recycler:20, missions:[] },
      debrisFields:{ home:{ antimaterie:400 } },
      debrisFieldTrackers:{ home:{ startedAt: jetzt - WEG_SEK*1000, totalCollected:{} } }
    }));
    check('3: ein kleines Feld ist nach der Abwesenheit verschwunden',
      !((g.debrisFields||{}).home), { felder: g.debrisFields });
    check('3: seine Menge ist wirklich angekommen',
      Math.round((g.resources||{}).antimaterie||0) >= 400, { antimaterie: Math.round((g.resources||{}).antimaterie||0) });
    check('3: und das Fenster sagt, woher die Rohstoffe kommen',
      /Recycler haben abgebaut/.test(willkommen), willkommen.slice(0,140));
    check('keine JS-Fehler (leergeraeumtes Feld)', errs.length === 0, errs.slice(0,3));
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
