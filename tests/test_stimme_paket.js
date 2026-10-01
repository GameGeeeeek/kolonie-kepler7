// Das vollstaendige Vote-Paket im echten Browser. Ausschliesslich abgefangene HTTP-Anfragen;
// kein Livekonto, keine echte Stimme. Gegenprobe: KEPLER_STIMME_ALT=<alter Git-Ref> laedt
// den alten Stand, ohne die Spieldatei auszutauschen. Gemessen gegen 0c0d19a: 1b/1c/1e/1f,
// 2a/2b/3a rot; neuer Stand alle 14 Pruefungen gruen.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { SPIELDATEI, starteBrowser, pruefer, ruhigeUhren } = require('./lib/umgebung');
const { check, ende } = pruefer();
const ROOT = path.resolve(__dirname, '..');
const SOURCE = process.env.KEPLER_STIMME_ALT
  ? execFileSync('git', ['show', process.env.KEPLER_STIMME_ALT+':weltraum_kolonie.html'], { cwd: ROOT, encoding:'utf8', maxBuffer:20*1024*1024 })
  : fs.readFileSync(SPIELDATEI, 'utf8');
const ORIGIN = 'http://127.0.0.1:41839';
const KEY = 'kepler7-save-v3';
const PREVIEW = { credits:2000, schiffe:{schlachtschiff:10}, fragmente:4,
  zufallsRohstoff:{arten:['erz','kristalle','deuterium'],max:20000} };
const REWARD = { id:'vote-paket', type:'verzeichnis-stimme', credits:2000,
  schiffe:{schlachtschiff:10}, fragmente:4, erz:20000, zeit:Date.now() };

function startSave(){
  return Object.assign({ tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{energie:9000,erz:1000,kristalle:5000,deuterium:2000,forschungspunkte:500},
    buildings:{lager:12}, research:{}, constructionQueue:[],
    fleet:{schlachtschiff:7,missions:[]},
    colonies:{rhea:{buildings:{lager:12},fleet:{schlachtschiff:3,missions:[]}}},
    activeBasePlanet:'rhea', player:{id:'u',name:'Voter',avatarKey:null},
    xp:1000,credits:5000,moduleFragments:6,buffs:[],lastTick:Date.now(),
    // Den separat bestaetigten Tagesbonus (120 Erz/60 Kristalle) nicht als Vote-Ertrag mitmessen.
    lastLoginDate:new Date().toDateString(),
    colonyNames:{},modules:{},shipModules:{} }, ruhigeUhren(2));
}

async function fixture(browser, {language='de',reward=null,preview=PREVIEW,mobile=false}={}){
  const store = {[KEY]:JSON.stringify(startSave())};
  const queue = reward ? [structuredClone(reward)] : [];
  const reports = [], claims = [], errors = [];
  const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},serviceWorkers:'block'});
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    const json = (body,status=200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if (url.origin !== ORIGIN) return route.fulfill({status:204,body:''});
    if (url.pathname.startsWith('/api/')){
      const p = url.pathname.slice(5);
      if (p === 'health') return json({ok:true});
      if (p === 'me') return json({userId:'u',username:'Voter',homeSystem:'kepler',homeSlot:0,
        attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null},
        stimme:{belohnung:preview,naechsteAb:Date.now()-1000}});
      if (p === 'pending-rewards/claim'){
        const body = JSON.parse(req.postData() || '{}');
        claims.push({body,contentType:req.headers()['content-type']||''});
        // Absichtlich trotzdem ausliefern: Auch die alte UI muss die Buchungs-Gegenprobe sehen.
        // Den echten Schutz gegen alte Clients prueft der Backend-HTTP-Test.
        return json({reward:queue.shift()||null});
      }
      if (p === 'reports'){
        if (req.method() === 'POST'){ reports.push(JSON.parse(req.postData()).report); return json({ok:true}); }
        return json({reports:[]});
      }
      if (p === 'storage-list') return json({keys:[]});
      if (p.startsWith('storage/')){
        const key = decodeURIComponent(p.slice(8));
        if (req.method() === 'PUT'){ store[key]=JSON.parse(req.postData()).value; return json({ok:true,version:2}); }
        return store[key] !== undefined ? json({key,value:store[key],version:1}) : json({error:'missing'},404);
      }
      return json([]);
    }
    if (url.pathname === '/') return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:SOURCE});
    if (url.pathname === '/version.txt') return route.fulfill({status:200,body:(SOURCE.match(/const VERSION = '([^']+)'/)||[])[1]||''});
    return route.fulfill({status:204,body:''});
  });
  await context.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(ORIGIN+'/?lang='+language);
  await page.waitForFunction(() => typeof window.__stimmeErinnerungPruefen === 'function');
  await until(() => claims.length > 0);
  const read = () => JSON.parse(store[KEY]);
  return {page,context,store,reports,claims,errors,read};
}
async function reminder(page){
  return page.evaluate(() => {
    document.querySelectorAll('.login-overlay').forEach(el => {el.style.display='none';});
    window.__stimmeErinnerungPruefen();
    const node = document.getElementById('stimmeBelohnungText');
    return node ? node.textContent : '';
  });
}
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
async function until(predicate){
  const end = Date.now()+12000;
  while (Date.now()<end){ if (predicate()) return true; await pause(50); }
  return false;
}

(async()=>{
  const browser = await starteBrowser();
  try {
    const f = await fixture(browser,{reward:REWARD});
    await until(() => f.reports.some(r => r.type === 'verzeichnis-stimme') && f.read().credits === 7000);
    const saved = f.read();
    check('1a: Paket gebucht und gespeichert: 2.000 Kredite',saved.credits===7000,saved.credits);
    check('1b: vier Modulfragmente addiert, vorhandener Vorrat bleibt',saved.moduleFragments===10,saved.moduleFragments);
    check('1c: zehn Schlachtschiffe auf Heimatbasis, nicht aktiver Kolonie',
      saved.fleet.schlachtschiff===17 && saved.colonies.rhea.fleet.schlachtschiff===3 && saved.activeBasePlanet==='rhea',
      {home:saved.fleet.schlachtschiff,colony:saved.colonies.rhea.fleet.schlachtschiff,active:saved.activeBasePlanet});
    check('1d: genau der gewuerfelte Rohstoffbetrag von 20.000 angekommen',
      saved.resources.erz>=21000 && saved.resources.erz<21010 && saved.resources.kristalle<5010 && saved.resources.deuterium<2010,saved.resources);
    const report = f.reports.find(r => r.type === 'verzeichnis-stimme');
    const text = report && report.gaben.join(', ');
    check('1e: Bericht nennt Schiffe, Heimatbasis, Fragmente, Kredite und tatsaechliches Erz',
      !!text && /10 Schlachtschiffe \(Heimatbasis\)/.test(text) && /4 Modulfragmente/.test(text)
      && /2(?:[.,]0+)?k Kredite|2000 Kredite/.test(text) && /20(?:[.,]0+)?k Erz|20000 Erz/.test(text),text);
    check('1f: JSON-Claim meldet Paket-Unterstuetzung',f.claims.length>0 && f.claims.every(c => c.body.stimmePaketVersion===1 && /application\/json/.test(c.contentType)),f.claims);
    const preview = await reminder(f.page);
    check('2a: Vorschau nennt alle Fixgaben und die Zufalls-Obergrenze',
      /10 Schlachtschiffe/.test(preview) && /4 Modulfragmente/.test(preview) && /2\.000 Kredite/.test(preview)
      && /bis zu 20\.000/.test(preview) && /einer zufällig gewählten Sorte/.test(preview)
      && /Erz.*Kristalle.*Deuterium/.test(preview),preview);
    await f.page.reload();
    await f.page.waitForFunction(() => typeof window.__stimmeErinnerungPruefen === 'function');
    await pause(1000);
    check('2b: Neuladen zahlt nichts doppelt aus',f.read().credits===7000 && f.read().moduleFragments===10
      && f.read().fleet.schlachtschiff===17 && f.reports.filter(r=>r.type==='verzeichnis-stimme').length===1);
    check('2c: keine Browserfehler',f.errors.length===0,f.errors);
    await f.context.close();

    const en = await fixture(browser,{language:'en',mobile:true});
    const english = await reminder(en.page);
    check('3a: englische mobile Vorschau nennt dasselbe Paket',/10 battleships/.test(english)
      && /4 module fragments/.test(english) && /2,000/.test(english) && /20,000/.test(english)
      && /one randomly chosen type/.test(english),english);
    const fits = await en.page.locator('#stimmeOverlay').evaluate(el => {
      const card=el.firstElementChild, rect=card.getBoundingClientRect();
      return rect.left>=0 && rect.right<=innerWidth && card.scrollWidth<=card.clientWidth+1;
    });
    check('3b: Paket-Fenster passt in 390px Handybreite',fits);
    await en.page.locator('#stimmeLink').evaluate(a => a.addEventListener('click',e=>e.preventDefault()));
    await en.page.locator('#stimmeLink').click();
    await until(() => !!en.read().stimmeGeklicktZuletzt);
    check('3c: der Abstimmungs-Link allein zahlt keine Belohnung',en.read().credits===5000
      && en.read().moduleFragments===6 && en.read().fleet.schlachtschiff===7 && en.reports.length===0);
    check('3d: keine Browserfehler mobil/Englisch',en.errors.length===0,en.errors);
    await en.context.close();

    const off = await fixture(browser,{preview:null});
    const disabled = await reminder(off.page);
    check('4a: ohne Server-Belohnung kein falsches Paket-Versprechen',!/Schlachtschiffe|Modulfragmente|Kredite|20\.000/.test(disabled),disabled);
    await off.context.close();
  } finally { await browser.close(); }
  await ende();
})().catch(e=>{console.error(e);process.exitCode=1;});
