// Baukorb: Kosten je Zeile (28.07.2026, v8.331.0, Spieler-Wunsch).
//
// Der Korb zeigte nur eine Gesamtsumme ganz unten. Wer bei einem von dreissig Schiffstypen eine
// Stueckzahl eintraegt, sah damit nicht, was DIESE Zeile beitraegt - und bei gestaffelten
// Schiffspreisen ist genau das die interessante Zahl.
//
// Warum dieser Test im Browser laeuft und nicht am Quelltext: Die eine Sache, die hier wirklich
// schiefgehen kann, ist NICHT die Rechnung, sondern der FOKUS. Die ganze Box steht unter
// isTypingIn()-Schutz, weil ein innerHTML-Neuaufbau dem Eingabefeld den Fokus entreissen wuerde
// (CLAUDE.md-Fallstrick). Die Kosten muessen also beim Tippen aktualisiert werden, OHNE die Box
// neu zu schreiben. Ob das gelungen ist, sieht man dem Code nicht an - man muss tippen.
//
// Geprueft wird:
//   1) beim Tippen erscheinen die Zeilenkosten UND der Fokus bleibt im Feld
//   2) Zeilen ohne Menge zeigen keinen Preis
//   3) die Summe unten ist die Summe der Zeilen (zwei Anzeigestellen, eine Wahrheit)
//   4) die PREISSTAFFELUNG wird beruecksichtigt - 1000 Schiffe kosten mehr als 1000x das erste
//   5) der Bauknopf wandert mit der Bezahlbarkeit mit
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

// Bewusst WENIG Ressourcen fuer den zweiten Durchgang: nur so laesst sich pruefen, dass der Knopf
// zwischen "bauen" und "einreihen" wechselt.
const stand = (res) => JSON.stringify({
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources: res || {energie:9e6,erz:9e6,kristalle:6e6,deuterium:4e6,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:20,mine:18,lager:24,werft:14,labor:12}, research:{}, colonies:{},
  activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
  fleet:{ jaeger:120, frachter:20, missions:[] },
  battleStats:{wins:9,losses:2}, xp:20000, credits:50000, buffs:[], lastTick:Date.now(), colonyNames:{}
});

// Zahlen aus der Kostenanzeige holen. "98.4k Erz" -> { erz: 98400 }
function zahlen(text){
  const out = {};
  for (const m of String(text||'').matchAll(/([\d.,]+)\s*([kMG])?\s*([A-Za-zÄÖÜäöü]+)/g)){
    const roh = Number(String(m[1]).replace(/\./g,'').replace(',','.'));
    const f = m[2]==='k' ? 1e3 : m[2]==='M' ? 1e6 : m[2]==='G' ? 1e9 : 1;
    // Bei "98.4k" ist der Punkt ein Dezimaltrenner, bei "1.234" ein Tausendertrenner. Der Faktor
    // dahinter entscheidet - genau deshalb wird hier nicht stur ersetzt.
    const wert = m[2] ? Number(String(m[1]).replace(',','.')) * f : roh;
    out[m[3].toLowerCase()] = (out[m[3].toLowerCase()]||0) + wert;
  }
  return out;
}
const lies = (page, sel) => page.evaluate(s => { const e=document.querySelector(s); return e ? e.innerText.replace(/\s+/g,' ').trim() : null; }, sel);

async function starte(browser, res){
  const store={'kepler7-save-v3':stand(res)};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:900} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2800);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  await page.evaluate(()=>{const t=document.querySelector('.tab-btn[data-tab="flotte"]');if(t)t.click();});
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Tippen: Kosten erscheinen, Fokus bleibt ----
  {
    const { ctx, page, errs } = await starte(browser);
    // Locator statt ElementHandle: Der Haupt-Tick schreibt die Box jede Sekunde neu, ein einmal
    // geholter Knoten ist danach nicht mehr im DOM.
    const jaeger = page.locator('[data-basket-ship="jaeger"]');
    check('1: der Baukorb ist im Flotte-Reiter da', await jaeger.count() > 0);
    check('1: ohne Menge steht in der Zeile kein Preis',
      (await lies(page,'[data-korb-kosten="jaeger"]')) === '–',
      await lies(page,'[data-korb-kosten="jaeger"]'));

    await jaeger.click({clickCount:3});
    await jaeger.type('1000', {delay:35});
    await page.waitForTimeout(300);

    // DER Kernpunkt: Die Kosten sind da UND der Fokus ist noch im Feld.
    const fokus = await page.evaluate(()=>document.activeElement && document.activeElement.getAttribute('data-basket-ship'));
    check('1: der Fokus bleibt beim Tippen im Eingabefeld', fokus === 'jaeger', { fokus });
    check('1: der eingetippte Wert steht noch im Feld', (await jaeger.inputValue()) === '1000');
    const zeile = await lies(page,'[data-korb-kosten="jaeger"]');
    check('1: die Zeilenkosten erscheinen sofort beim Tippen', !!zeile && zeile !== '–', zeile);
    check('1: keine Konsolenfehler', errs.length === 0, errs);
    await ctx.close();
  }

  // ---- 2) Summe = Summe der Zeilen ----
  {
    const { ctx, page, errs } = await starte(browser);
    const jaeger = page.locator('[data-basket-ship="jaeger"]');
    const frachter = page.locator('[data-basket-ship="frachter"]');
    await jaeger.click({clickCount:3}); await jaeger.type('300',{delay:25});
    await page.waitForTimeout(200);
    await frachter.click({clickCount:3}); await frachter.type('40',{delay:25});
    await page.waitForTimeout(300);

    const zJ = zahlen(await lies(page,'[data-korb-kosten="jaeger"]'));
    const zF = zahlen(await lies(page,'[data-korb-kosten="frachter"]'));
    const zS = zahlen(await lies(page,'[data-korb-summe]'));
    // Zwei Anzeigestellen derselben Groesse: Die Summe MUSS die Summe der Zeilen sein. Laufen sie
    // auseinander, glaubt der Spieler der einen und zahlt die andere - CLAUDE.md Regel 6.
    const felder = new Set([...Object.keys(zJ), ...Object.keys(zF)]);
    const abweichung = [...felder].filter(f => {
      const erwartet = (zJ[f]||0) + (zF[f]||0);
      // Toleranz, weil die Anzeige rundet ("98.4k"): 1% oder 100 Einheiten, je nachdem was groesser ist.
      return Math.abs((zS[f]||0) - erwartet) > Math.max(100, erwartet*0.01);
    });
    check('2: die Gesamtsumme ist die Summe der Zeilen', abweichung.length === 0,
      { jaeger:zJ, frachter:zF, summe:zS, abweichung });
    check('2: keine Konsolenfehler', errs.length === 0, errs);

    // ---- 3) Preisstaffelung wird beruecksichtigt ----
    // Schiff Nummer 1000 kostet mehr als Schiff Nummer 1. Eine naive Rechnung "Menge x Grundpreis"
    // wuerde das uebersehen - und genau die waere beim Nachbauen die naheliegende Abkuerzung.
    await jaeger.click({clickCount:3}); await jaeger.type('1',{delay:25});
    await page.waitForTimeout(250);
    const einzeln = zahlen(await lies(page,'[data-korb-kosten="jaeger"]'));
    await jaeger.click({clickCount:3}); await jaeger.type('300',{delay:25});
    await page.waitForTimeout(250);
    const dreihundert = zahlen(await lies(page,'[data-korb-kosten="jaeger"]'));
    const feld = Object.keys(einzeln)[0];
    check('3: es gibt eine messbare Ressource zum Vergleich', !!feld, { einzeln });
    if (feld){
      check('3: 300 Schiffe kosten MEHR als das 300-fache des ersten (Staffelung greift)',
        dreihundert[feld] > einzeln[feld] * 300,
        { proStueck:einzeln[feld], fuer300:dreihundert[feld], naiv:einzeln[feld]*300 });
    }
    await ctx.close();
  }

  // ---- 4) Der Bauknopf wandert mit ----
  {
    // Wenig Ressourcen: Ein grosser Korb ist nicht bezahlbar, der Knopf muss "einreihen" sagen.
    const { ctx, page, errs } = await starte(browser, {energie:500,erz:500,kristalle:200,deuterium:100,antimaterie:0,forschungspunkte:0});
    const jaeger = page.locator('[data-basket-ship="jaeger"]');
    await jaeger.click({clickCount:3}); await jaeger.type('900',{delay:25});
    await page.waitForTimeout(300);
    const knopf = await lies(page,'#shipBasketBuildBtn');
    check('4: bei zu wenig Ressourcen sagt der Knopf "einreihen"', /einreihen/i.test(knopf||''), knopf);
    check('4: und er ist trotzdem bedienbar (Einreihen ist erlaubt)',
      await page.evaluate(()=>{const b=document.getElementById('shipBasketBuildBtn');return b && !b.disabled;}));
    // Zurueck auf 0: der Knopf muss wieder gesperrt sein, sonst reiht man einen leeren Korb ein.
    await jaeger.click({clickCount:3}); await jaeger.type('0',{delay:25});
    await page.waitForTimeout(300);
    check('4: bei leerem Korb ist der Knopf gesperrt',
      await page.evaluate(()=>{const b=document.getElementById('shipBasketBuildBtn');return b && b.disabled;}));
    check('4: und die Summe meldet wieder "keine Menge"',
      /keine Menge/i.test(await lies(page,'[data-korb-summe]')||''),
      await lies(page,'[data-korb-summe]'));
    check('4: keine Konsolenfehler', errs.length === 0, errs);
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
