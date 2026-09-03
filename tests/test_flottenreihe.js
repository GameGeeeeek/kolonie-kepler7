// Die enge Flottenzeile zeigt echte Schiffsmodelle (05.08.2026).
//
// AUSGANGSLAGE: fleetIconRowHtml() erzeugte 14x14 verkleinerte ICONS-SVGs - flache Dreiecke -,
// während der Kampfbericht daneben (shipCountRowHtml, seit v8.395.0) längst die echten Rumpfmodelle
// zeigte. Dieselbe Flotte, zwei Bildsprachen: genau das Muster aus CLAUDE.md Punkt 6, bei dem die
// Umstellung gemacht war und eine zweite Anzeigestelle die alte Annahme behielt. Betroffen waren
// sechs Stellen: Allianzbasis (2x), Flottenparade, NPC-Angriffsliste, Überfall-Banner und der
// Piraten-Trümmerräuber.
//
// GEMESSEN WIRD DER GERECHNETE STIL, nicht das Markup: Ein Kasten ohne Hintergrundbild sieht im
// Quelltext genauso aus wie einer mit. Und geprüft wird zusätzlich das VERHÄLTNIS - die Bilder
// müssen geteilt sein. Fiele jemand auf "eine Leinwand je Zeile" zurück, wäre das Bild identisch
// und nur der Preis ein anderer; genau daran ist ein früherer Versuch gescheitert (2.000 Leinwände).
const { starteBrowser, devices, SPIEL_URL, ruhigeUhren } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const FLOTTE = { jaeger:152, cruisers:96, destroyers:2418, schlachtschiff:7234, carrier:89,
  bomber:40, waechter:10089, recycler:283, frachtergross:3324 };

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}
const save = () => JSON.stringify({ ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
  buildings:{solar:22,mine:20,labor:14,lager:30,werft:14,flak:20,turm:18},
  research:{rkampf:9}, fleet:Object.assign({missions:[]}, FLOTTE), colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, battleStats:{wins:99,losses:2}, xp:9e5, credits:5e5,
  // Eine Werftmarke, damit Abschnitt 2 etwas zu prüfen hat.
  shipMarks:{ jaeger:8, destroyers:5 },
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

async function galaxie(browser, geraet){
  const ctx = await browser.newContext(geraet ? Object.assign({}, devices[geraet]) : { viewport:{width:1400,height:950} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  await page.evaluate(() => { const b=document.querySelector('.tab-btn[data-tab="galaxie"]'); if(b)b.click(); });
  await page.waitForTimeout(1800);
  return { page, ctx, errs };
}

const messen = page => page.evaluate(() => {
  const mitBild = el => /url\(/.test(getComputedStyle(el).backgroundImage || '');
  const npc = document.getElementById('npcList');
  const bilder = npc ? Array.from(npc.querySelectorAll('i.gbi-schiff')) : [];
  const stil = document.getElementById('gebackeneBildStile');
  const chip = npc ? npc.querySelector('.schiffreihe-eng .schiffchip') : null;
  const eins = bilder[0];
  return {
    stellen: bilder.length,
    ohneBild: bilder.filter(e => !mitBild(e)).length,
    // Die alten flachen Dreiecke: inline-SVG direkt im Chip.
    flachSvg: npc ? npc.querySelectorAll('[data-ship-icon-key] svg').length : 0,
    gebacken: stil ? stil.childNodes.length : 0,
    klassen: Array.from(new Set(bilder.map(e => Array.from(e.classList).find(c => c.startsWith('gbi-s-'))).filter(Boolean))),
    zeiger: chip ? getComputedStyle(chip).cursor : null,
    kachel: eins ? Math.round(eins.getBoundingClientRect().width) : null,
    seitenUeberlauf: document.body.scrollWidth - document.documentElement.clientWidth
  };
});

(async () => {
  const browser = await starteBrowser();

  // ============================== 1) Auf dem großen Bild
  {
    const { page, ctx, errs } = await galaxie(browser);
    const m = await messen(page);
    check('1: in der NPC-Liste stehen Schiffsbilder', m.stellen > 5, { stellen: m.stellen });
    check('1: und JEDES trägt wirklich ein Bild', m.ohneBild === 0, { ohneBild: m.ohneBild, stellen: m.stellen });
    check('1: die flachen Dreiecke sind weg', m.flachSvg === 0, { flachSvg: m.flachSvg });
    // Geteilt, nicht je Zeile gebacken: deutlich weniger Klassen als Bildstellen.
    check('1: die Bilder sind geteilt (weniger Klassen als Stellen)',
      m.klassen.length > 0 && m.klassen.length < m.stellen, { klassen: m.klassen.length, stellen: m.stellen });
    // Ehrlichkeitsregel: fremde Flotten ohne eigene Lackierung und ohne Werftmarke.
    check('1: fremde Flotten tragen weder Anstrich noch Werftmarke',
      m.klassen.every(k => /-f$/.test(k)), m.klassen.slice(0,6));
    // Die tote Klickfläche ist geschlossen - nur die eine Stelle mit Handler zeigt einen Zeiger.
    check('1: der Chip sieht nicht ohne Grund klickbar aus', m.zeiger !== 'pointer', { zeiger: m.zeiger });
    check('keine JS-Fehler (großes Bild)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 2) Auf dem Telefon bleibt die Zeile schmal
  // Mit der vollen 30x20-Kachel des Kampfberichts wuchs die Bannerzeile auf einem iPhone 13 von
  // 14 px auf 53 px und brach auf zwei Zeilen um. Die enge Fassung ist dafür da.
  {
    const { page, ctx, errs } = await galaxie(browser, 'iPhone 13');
    const m = await messen(page);
    check('2: auch auf dem Telefon tragen alle Stellen ein Bild',
      m.stellen > 5 && m.ohneBild === 0, { stellen: m.stellen, ohneBild: m.ohneBild });
    check('2: die Kachel ist die ENGE (deutlich kleiner als die 26px des Berichts)',
      m.kachel !== null && m.kachel <= 21, { kachel: m.kachel });
    check('2: nichts läuft seitlich aus der Seite', m.seitenUeberlauf <= 0, { ueberlauf: m.seitenUeberlauf });
    check('keine JS-Fehler (Telefon)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
