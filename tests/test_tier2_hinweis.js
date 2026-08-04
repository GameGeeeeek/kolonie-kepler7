// Tier-2-Badge: „Lager voll" gegen „Rohstoffe knapp" (05.08.2026, Spieler-Report Sascha:
// „rohstoffe knapp aber ich glaube eher es ist gemeint lager voll").
//
// AUSGANGSLAGE: Die Beschriftung leitete den GRUND aus der Rate ab statt ihn zu kennen.
//   if (full && eff <= 0) → „Lager voll"
//   if (eff < wantMax)    → „Rohstoffe knapp"
// „Lager voll" verlangte damit eine Rate von EXAKT null. Ein volles Tier-2-Lager steht im Betrieb
// aber fast nie exakt am Deckel - es wird laufend ein wenig verbraucht und sofort wieder
// aufgefüllt. Die Fabrik produziert dann den letzten Rest Platz voll, die Rate ist positiv, und
// die Anzeige schob es auf Rohstoffmangel. Gemessen mit Inputs bei 900 Millionen, Mangel also
// ausgeschlossen: Bestand 2449,5 von 2450 zeigte „+0,050/s (Rohstoffe knapp)".
//
// WARUM DIESER TEST BEIDE RICHTUNGEN PRÜFT: Ein Test, der nur „bei vollem Lager steht Lager voll"
// prüft, wäre auch dann grün, wenn die Anzeige IMMER „Lager voll" sagte. Deshalb steht daneben
// ein Fall mit echtem Rohstoffmangel - und der war beim Bau dieses Tests zuerst falsch gebaut:
// Mit Minen und Solarfeldern im Spielstand füllten sich die Inputs in den Sekunden bis zur
// Messung wieder auf, und der „Mangel" war keiner mehr. Der Fall braucht deshalb einen Stand
// OHNE Produzenten und mit Beständen unter dem Bedarf einer einzigen Sekunde.
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// Nanolegierungsfabrik Stufe 15: Deckel 200 + 15*150 = 2450, Wunschrate 15*0,006 = 0,09/s,
// Inputs je Einheit 8 Erz + 5 Kristalle + 4 Energie.
const DECKEL = 2450, WUNSCH = 0.09;

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

const save = (nano, arm) => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  // arm=true: Inputs UNTER dem Bedarf einer Sekunde (0,09 x 8 = 0,72 Erz) und keine Produzenten,
  // die sie nachfüllen könnten - sonst ist der Mangel bis zur Messung längst behoben.
  resources:{ energie: arm?0.3:9e8, erz: arm?0.3:9e8, kristalle: arm?0.3:9e8,
              deuterium:9e8, antimaterie:9e6, forschungspunkte:3e4, nanolegierungen:nano },
  buildings: arm ? { labor:20, lager:60, nanolegierungsfabrik:15 }
                 : { solar:30, mine:28, labor:20, lager:60, werft:14, nanolegierungsfabrik:15 },
  research:{ rnanotech:5 }, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, xp:9e5, credits:5e5,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

async function nanoZeile(browser, nano, arm){
  const ctx = await browser.newContext({ viewport:{width:1400,height:1000} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save(nano, arm) }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  const z = await page.evaluate(() => {
    const karte = Array.from(document.querySelectorAll('.rescard'))
      .find(c => /Nanolegierungen/.test((c.querySelector('.label')||{}).textContent||''));
    if (!karte) return null;
    return { wert: (karte.querySelector('.value')||{}).textContent.replace(/\s+/g,' ').trim(),
             rate: ((karte.querySelector('.rate')||{}).textContent||'').trim() };
  });
  await ctx.close();
  return { z, errs };
}

(async () => {
  const browser = await starteBrowser();

  // ============================== 1) Lager voll - der gemeldete Fall
  {
    const { z, errs } = await nanoZeile(browser, DECKEL);
    check('1: die Nanolegierungs-Karte ist da', !!z, z);
    check('1: bei vollem Lager steht „Lager voll"', z && /Lager voll/.test(z.rate), z);
    check('1: und NICHT „Rohstoffe knapp"', z && !/Rohstoffe knapp/.test(z.rate), z);
  }

  // ============================== 2) Lager fast voll: der Platz reicht der Sekunde noch NICHT
  // Das ist der Zustand, den ein volles Lager im Betrieb dauernd hat - und genau hier stand
  // vorher fälschlich „Rohstoffe knapp", obwohl die Inputs bei 900 Millionen lagen.
  {
    const { z, errs } = await nanoZeile(browser, DECKEL - WUNSCH/4);
    check('2: knapp unter dem Deckel steht ebenfalls „Lager voll"',
      z && /Lager voll/.test(z.rate), z);
    check('2: bei Inputs von 900 Millionen fällt das Wort Rohstoffe nicht',
      z && !/Rohstoffe/.test(z.rate), z);
    check('keine JS-Fehler (fast voll)', errs.length === 0, errs.slice(0,3));
  }

  // ============================== 3) Platz reicht: keine Drosselung, kein Hinweis
  {
    const { z } = await nanoZeile(browser, DECKEL - 200);
    check('3: mit Platz und Rohstoffen läuft sie ohne Hinweis',
      z && !/Lager voll|Rohstoffe knapp/.test(z.rate), z);
    check('3: und zwar mit der vollen Rate', z && /0\.09/.test(z.rate), z);
  }

  // ============================== 4) GEGENPROBE: echter Rohstoffmangel
  // Ohne diesen Abschnitt wäre der Test auch dann grün, wenn überall „Lager voll" stünde.
  {
    const { z, errs } = await nanoZeile(browser, 500, true);
    check('4: bei echtem Rohstoffmangel steht „Rohstoffe knapp"',
      z && /Rohstoffe knapp/.test(z.rate), z);
    check('4: und NICHT „Lager voll" - das Lager ist ja bei 500 von 2450',
      z && !/Lager voll/.test(z.rate), z);
    check('keine JS-Fehler (Mangel)', errs.length === 0, errs.slice(0,3));
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
