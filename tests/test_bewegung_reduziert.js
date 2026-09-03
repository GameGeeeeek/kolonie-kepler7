// „Bewegung reduzieren": Hinweis sichtbar, und man darf trotzdem zuschauen (05.08.2026).
//
// SPIELER-REPORT Sascha: „der kampf startet nicht am pc am handy aber schon". Gemessen war das
// kein PC-Fehler: Mit prefers-reduced-motion zeichnet die Wiedergabe 0 Bilder und springt sofort
// auf tSim 42,9, also aufs Schlussbild - auf dem Telefon genauso. Am Rechner war schlicht die
// System-Einstellung an. Das ist so gebaut und richtig so; falsch war nur, dass man es nicht
// erkennen konnte: Der Hinweis stand als 10-px-Graukasten in der linken oberen Ecke einer vollen
// Bühne, nannte den Grund nicht und bot keinen Ausweg.
//
// GEPRÜFT WIRD BEIDES, und die zweite Hälfte ist die wichtigere: Ein Hinweis, den man sieht, ist
// nett - ein Kampf, den man sich trotzdem ansehen kann, ist die eigentliche Antwort auf die
// Meldung. Und die Vorgabe muss die Systemeinstellung bleiben: Wer sie gesetzt hat, bekommt
// weiterhin ZUERST das Schlussbild, nicht ungefragt eine Animation.
const { starteBrowser, devices, SPIEL_URL, ruhigeUhren } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const FLOTTE = { jaeger:152, destroyers:2418, schlachtschiff:7234, waechter:10089, kreuzer:96 };
const ABWEHR = { flak:55, turm:50, laser:45, raketen:33, gauss:29, schild:25 };
const UEBERFALL = { id:'r1', time:Date.now(), ts:Date.now(), type:'raid', result:'win',
  faction:'Söldnerkonvoi', attackPower:41200, defensePower:23400, targetPlanet:'home',
  fleet:{ destroyers:179 }, destroyedShips:{ destroyers:31 },
  stationedFleet: FLOTTE, ownLostShips:{}, defenseBefore: ABWEHR };

function backend(store, berichte){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='reports')return j({reports:berichte});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}
const save = () => JSON.stringify({ ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
  buildings:Object.assign({solar:22,mine:20,labor:14,lager:30,werft:14}, ABWEHR),
  research:{rkampf:9}, fleet:Object.assign({missions:[]}, FLOTTE), colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, battleStats:{wins:99,losses:2}, xp:9e5, credits:5e5,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

async function wiedergabe(browser, opts){
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, [UEBERFALL]));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3800);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  await page.evaluate(() => { const x=document.getElementById('headerReportsBtn'); if(x)x.click(); });
  await page.waitForTimeout(1600);
  await page.evaluate(() => { const x=document.querySelector('[data-watch-battle]'); if(x)x.click(); });
  await page.waitForTimeout(1800);
  return { page, ctx, errs };
}
const lage = page => page.evaluate(() => {
  const rm = document.getElementById('osRm'), b = document.getElementById('osRmTrotzdem');
  const r = rm ? rm.getBoundingClientRect() : null;
  const z = (()=>{ try { return JSON.parse(document.getElementById('osWrap').dataset.zustand); } catch(e){ return null; } })();
  return { sichtbar: rm ? getComputedStyle(rm).display !== 'none' : false,
           flaeche: r ? Math.round(r.width*r.height) : 0,
           knopfHoch: (b && getComputedStyle(b).display !== 'none') ? Math.round(b.getBoundingClientRect().height) : 0,
           nenntGrund: rm ? /Animationen reduzieren/.test(rm.textContent||'') : false,
           tSim: z ? z.t : null };
});
// Vollbilder zählen: clearRect läuft genau einmal je gezeichnetem Bild.
const haken = page => page.evaluate(() => {
  const c = document.querySelector('#osBuehne canvas'); const g = c.getContext('2d');
  window.__n = 0; const o = g.clearRect.bind(g);
  g.clearRect = function(){ window.__n++; return o.apply(null, arguments); };
});
async function bilder(page, ms){ await page.evaluate(()=>{window.__n=0;}); await page.waitForTimeout(ms); return page.evaluate(()=>window.__n); }

(async () => {
  const browser = await starteBrowser();

  for (const [name, opts] of [
    ['großes Bild', { viewport:{width:1440,height:900}, reducedMotion:'reduce' }],
    ['Telefon',     Object.assign({}, devices['iPhone 13'], { reducedMotion:'reduce' })]
  ]){
    const { page, ctx, errs } = await wiedergabe(browser, opts);
    const vor = await lage(page);
    check(name + ': der Hinweis ist sichtbar', vor.sichtbar, vor);
    // Der alte Kasten war rund 1.500 px² in der Ecke. Alles unter 8.000 px² ist wieder ein
    // Zettel, den man übersieht - und genau das war die Meldung.
    check(name + ': und groß genug, um aufzufallen', vor.flaeche > 8000, { flaeche: vor.flaeche });
    check(name + ': er nennt den Grund (Systemeinstellung)', vor.nenntGrund, vor);
    check(name + ': der Knopf ist mit dem Finger treffbar', vor.knopfHoch >= 30, { hoch: vor.knopfHoch });
    // Die Vorgabe bleibt die Systemeinstellung: erst das Schlussbild, keine Animation.
    check(name + ': es steht zunächst das Schlussbild', vor.tSim !== null && vor.tSim > 40, vor);
    await haken(page);
    check(name + ': und es wird dabei NICHT gezeichnet', await bilder(page, 1200) === 0);

    // DER PUNKT: Wer zuschauen will, darf.
    await page.click('#osRmTrotzdem');
    await page.waitForTimeout(400);
    const nach = await page.evaluate(() => {
      const z = (()=>{ try { return JSON.parse(document.getElementById('osWrap').dataset.zustand); } catch(e){ return null; } })();
      return { tSim: z ? z.t : null, hinweisWeg: getComputedStyle(document.getElementById('osRm')).display === 'none' };
    });
    check(name + ': nach dem Klick läuft das Gefecht von vorn', nach.tSim !== null && nach.tSim < 10, nach);
    check(name + ': und der Hinweis ist weg', nach.hinweisWeg, nach);
    check(name + ': jetzt wird auch wirklich gezeichnet', await bilder(page, 1200) > 5);
    check('keine JS-Fehler (' + name + ')', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== Gegenprobe: ohne die Einstellung ändert sich nichts
  // Ohne diesen Abschnitt wäre der Test auch dann grün, wenn der Hinweis IMMER stünde.
  {
    const { page, ctx, errs } = await wiedergabe(browser, { viewport:{width:1440,height:900} });
    const vor = await lage(page);
    check('ohne die Einstellung bleibt der Hinweis weg', !vor.sichtbar, vor);
    check('und das Gefecht läuft von Anfang an', vor.tSim !== null && vor.tSim < 10, vor);
    check('keine JS-Fehler (normal)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
