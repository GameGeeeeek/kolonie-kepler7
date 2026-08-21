// Das Bild bleibt still, wenn sich etwas UNSICHTBARES darueber aendert (21.08.2026).
//
// ANLASS, im Browser gemessen: Aendert ein Banner oberhalb der Lesestelle seine Hoehe, rutscht
// alles darunter unter dem Leser weg - die Seite scrollt dabei GAR NICHT, der Inhalt bewegt sich.
// Gemessene Hoehen: Ereignis-Banner 138 px, Reiter-Hinweisleiste 166-302 px, Tagesaufgaben-Leiste
// bis zu 146 px Aenderung. Ein Sprungziel wanderte dadurch von top:128 auf top:-30, also
// teilweise aus dem Bild.
//
// Die eingebaute Scroll-Verankerung des Browsers greift hier NICHT - gemessen, nicht vermutet:
// overflow-anchor steht auf der ganzen Kette auf 'auto', und trotzdem glich das Ausblenden eines
// 138-px-Banners bei scrollY 1500 exakt 0 px aus.
//
// GEPRUEFT WIRD ALS PAAR, und die zweite Haelfte ist die wichtigere:
//   1. UNSICHTBARE Aenderung (Lesekante liegt ueber der Fensterkante): Das Bild muss stehen
//      bleiben, scrollY zieht um die Differenz mit.
//   2. SICHTBARE Aenderung (Lesekante liegt im Bild): Es darf NICHTS ausgeglichen werden. Der
//      Spieler sieht das Banner verschwinden; ein Scroll-Ausgleich waere dort selbst der Sprung,
//      den die Funktion verhindern soll (Entscheidung Sascha, 21.08.2026). Ohne diese Haelfte
//      waere ein viel zu breiter Ausgleich gruen.
//   3. REITERWECHSEL: Ein anderes Panel hat eine andere Dokumentlage - darauf auszugleichen
//      waere ein erfundener Sprung.
//
// GEGENPROBE (Regel 1, beide Richtungen gefahren): Gegen den Stand davor faellt genau 1a
// ({"drift":-158}); 2 und 3 bleiben dort gruen, weil der alte Stand ueberhaupt nie ausglich.
const { starteBrowser, devices, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending|notifications|cosmetics|galaxy|market/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

// Das Ereignis laeuft nach ABLAUF_MS ab - der Inhalt ueber der Lesestelle schrumpft also mitten
// in der Messung. Die uebrigen Ereignis-Uhren sind gepinnt (Regel 18), damit nichts anderes
// dazwischenfunkt; der Zufallsstreuer hat keine Uhr (Regel 70) und wird unten mitprotokolliert.
const ABLAUF_MS = 5000;
function save(mitEreignis){
  const jetzt=Date.now();
  const hints={}; ['basis','forschung','flotte','verteidigung','karte','galaxie','markt','allianz','expedition','offiziere','punkte','fortschritt'].forEach(r=>hints[r]=true);
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:hints,
    nextPlanetEventCheck: jetzt+3600000, nextTraderCheck: jetzt+3600000,
    resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
    buildings:{solar:24,mine:22,kristallmine:20,labor:14,lager:18,werft:16,turm:10},
    research:{rkampf:9,rsolar:9,rerz:8}, uiJumpNav:true,
    fleet:{jaeger:600,frachter:80,missions:[]}, colonies:{ rhea:{buildings:{solar:14,mine:12},fleet:{}} },
    activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
    battleStats:{wins:9,losses:2}, xp:260000, credits:180000, buffs:[], lastTick:jetzt,
    colonyNames:{}, modules:{}, shipModules:{},
    activeEvent: mitEreignis ? { key:'asteroid', startTime: jetzt-1000, expiresAt: jetzt+ABLAUF_MS } : null });
}

async function spiel(browser, mitEreignis){
  const ctx=await browser.newContext(Object.assign({},devices['Desktop Chrome'],{viewport:{width:390,height:844}}));
  const page=await ctx.newPage();
  await page.route('**/api/**', backend({'kepler7-save-v3':save(mitEreignis)}));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3000);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  return { page, ctx };
}

// Beobachtet, wie sich das Bild bewegt, waehrend das Banner abläuft.
// zielLesekante: gewuenschte Fensterlage der Lesekante VOR dem Ablauf (<=0 unsichtbar, >0 sichtbar)
const beobachte = (page, zielLesekante) => page.evaluate(async (ziel) => {
  const kante = () => document.querySelector('.tab-panel.active');
  const k = kante(); if (!k) return { keinPanel:true };
  // So scrollen, dass die Lesekante genau dort steht, wo der Fall es verlangt.
  const dok = k.getBoundingClientRect().top + window.scrollY;
  window.scrollTo(0, Math.max(0, Math.round(dok - ziel)));
  await new Promise(r=>setTimeout(r,400));
  const bannerDa = () => { const b=document.getElementById('eventBanner'); return !!(b && b.offsetParent !== null); };
  if (!bannerDa()) return { keinBanner:true };
  // Ein festes Merkzeichen im Panel, dessen Fensterlage sich NICHT aendern darf.
  const merk = k.querySelector('div') || k;
  const vorher = { merk: Math.round(merk.getBoundingClientRect().top),
                   scrollY: Math.round(window.scrollY),
                   lesekante: Math.round(k.getBoundingClientRect().top) };
  // warten, bis das Banner wirklich weg ist (nicht blind schlafen)
  for (let i=0; i<40 && bannerDa(); i++) await new Promise(r=>setTimeout(r,250));
  const nochDa = bannerDa();
  await new Promise(r=>setTimeout(r,700)); // ein Tick Ruhe nach dem Ausblenden
  const nachher = { merk: Math.round(merk.getBoundingClientRect().top),
                    scrollY: Math.round(window.scrollY) };
  return { vorher, nachher, nochDa, drift: nachher.merk - vorher.merk,
           scrollAusgleich: nachher.scrollY - vorher.scrollY };
}, zielLesekante);

(async () => {
  const browser = await starteBrowser();

  // ---- 1) UNSICHTBAR: Lesekante deutlich ueber der Fensterkante
  {
    const { page, ctx } = await spiel(browser, true);
    const r = await beobachte(page, -400);
    check('1-vorab: das Banner stand und ist waehrend der Messung abgelaufen',
      !r.keinPanel && !r.keinBanner && r.nochDa === false, r);
    check('1-vorab2: die Lesekante lag wirklich ausserhalb des Bildes',
      !!r.vorher && r.vorher.lesekante <= 0, r.vorher);
    check('1a: das Bild bleibt stehen - das Merkzeichen wandert nicht',
      Math.abs(r.drift || 0) <= 2, r);
    check('1b: ausgeglichen wurde ueber scrollY, nicht ueber einen Sprung im Inhalt',
      (r.scrollAusgleich || 0) < -50, r);
    await ctx.close();
  }

  // ---- 2) SICHTBAR: Lesekante im Bild - hier darf NICHTS ausgeglichen werden
  {
    const { page, ctx } = await spiel(browser, true);
    const r = await beobachte(page, 200);
    check('2-vorab: das Banner stand und ist abgelaufen', r.nochDa === false, r);
    check('2-vorab2: die Lesekante lag wirklich IM Bild',
      !!r.vorher && r.vorher.lesekante > 0, r.vorher);
    check('2: bei sichtbarer Aenderung wird NICHT gescrollt',
      Math.abs(r.scrollAusgleich || 0) <= 2, r);
    await ctx.close();
  }

  // ---- 3) Reiterwechsel loest keinen Ausgleich aus
  {
    const { page, ctx } = await spiel(browser, false);
    const r = await page.evaluate(async () => {
      window.scrollTo(0, 600); await new Promise(r=>setTimeout(r,400));
      const vor = Math.round(window.scrollY);
      document.querySelector('.tab-btn[data-tab="forschung"]').click();
      await new Promise(r=>setTimeout(r,1600));
      const nachKlick = Math.round(window.scrollY);
      await new Promise(r=>setTimeout(r,1600));   // zwei weitere Ticks
      return { vor, nachKlick, ende: Math.round(window.scrollY) };
    });
    check('3-vorab: der Reiterwechsel hat stattgefunden',
      await page.evaluate(()=>!!document.querySelector('#tab-forschung.active')), r);
    check('3: nach dem Reiterwechsel scrollt sich die Seite nicht von selbst weiter',
      Math.abs(r.ende - r.nachKlick) <= 2, r);
    await ctx.close();
  }

  await browser.close();
  return ende();
})().catch(e => { console.error(e); process.exit(1); });
