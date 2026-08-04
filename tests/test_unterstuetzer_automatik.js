// Die drei Automatiken sind Unterstützern vorbehalten (05.08.2026, Wunsch Sascha).
//
// Betroffen: Automatische Verstärkung, Automatische Reparatur, KI-Abfangautomatik.
//
// ZWEI DINGE WERDEN GEPRÜFT, und das zweite ist das wichtigere:
//   1. Der SCHALTER lässt sich ohne Rang nicht umlegen und sagt, woran es liegt.
//   2. Die MECHANIK läuft ohne Rang auch dann nicht, wenn der Schalter im Spielstand auf `true`
//      steht. Das ist kein theoretischer Fall: `state` liegt beim Spieler, wird lokal gespeichert
//      und ist mit den Entwicklerwerkzeugen in fünf Sekunden umgeschrieben - und jeder, der die
//      Automatik heute anhat, bringt das `true` nach der Umstellung mit. Eine Sperre, die nur am
//      Knopf hängt, wäre für beide Fälle wirkungslos.
//
// Die Gegenprobe mit gültigem Rang gehört zwingend dazu: Ohne sie wäre der Test auch dann grün,
// wenn die Automatiken für NIEMANDEN mehr liefen.
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// gespeichert: der zuletzt zum Server geschickte Spielstand. Das ist der einzige ehrliche Weg, an
// den Zustand des Spiels heranzukommen - der Spielcode laeuft in einer eigenen Kapsel und legt
// nichts auf window ab. Und es misst genau das Richtige: Was gespeichert wird, IST der Spielstand.
function backend(store, supporter, gespeichert){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:supporter});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){
    const k=decodeURIComponent(p.slice(8));
    if(req.method()==='PUT'){
      if (k === 'kepler7-save-v3'){ try { gespeichert.wert = JSON.parse(JSON.parse(req.postData()).value); } catch(e){} }
      return j({ok:true,version:2});
    }
    if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);
  }
  return j([]);
};}

// Alle drei Schalter stehen im Spielstand auf AN - genau der Zustand, den jedes Konto mitbringt,
// das die Automatiken vor der Umstellung genutzt hat. Dazu KI-Technologie (sonst ist die
// Abfangautomatik-Zeile gar nicht sichtbar) und ein Vorrat an KI-Kernen.
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4,kikerne:2500},
  buildings:{solar:22,mine:20,labor:14,lager:30,werft:14,kilabor:10},
  research:{ rkitech:1, rkampf:5 }, fleet:{missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, xp:9e5, credits:5e5,
  autoReinforceOn:true, autoRepairOn:true, kiInterceptOn:true,
  // Aktive Sabotage: genau die Lage, in der die Automatische Reparatur zuschlagen WÜRDE.
  mineDebuff:{ until: Date.now()+15*60*1000, planet:'home', building:'mine' },
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

async function lade(browser, supporter){
  const ctx = await browser.newContext({ viewport:{width:1400,height:1100} });
  const page = await ctx.newPage(); const errs=[]; const gespeichert = { wert:null };
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, supporter, gespeichert));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  // Verteidigung-Tab, dort stehen alle drei Schalter.
  await page.evaluate(async () => {
    const b = Array.from(document.querySelectorAll('[data-tab]')).find(x=>x.getAttribute('data-tab')==='verteidigung');
    if (b) b.click();
    await new Promise(r=>setTimeout(r,1500));
  });
  return { page, ctx, errs, gespeichert };
}
const SCHALTER = [
  ['autoReinforce', 'Automatische Verstärkung'],
  ['autoRepair',    'Automatische Reparatur'],
  ['kiIntercept',   'KI-Abfangautomatik']
];
const lage = page => page.evaluate((paare) => {
  const out = {};
  for (const [id, name] of paare){
    const sw = document.getElementById(id+'Switch');
    const zeile = document.getElementById(id+'Row');
    const label = document.getElementById(id+'Label');
    out[name] = {
      an: sw ? sw.classList.contains('on') : null,
      gedimmt: zeile ? zeile.classList.contains('research-locked') : null,
      nenntGrund: label ? /Unterstützern vorbehalten/.test(label.textContent||'') : false
    };
  }
  return out;
}, SCHALTER);

(async () => {
  const browser = await starteBrowser();

  // ============================== 1) Ohne Rang
  {
    const { page, ctx, errs } = await lade(browser, { active:false, tier:null });
    const vor = await lage(page);
    for (const [, name] of SCHALTER){
      check('1: „'+name+'" steht trotz `true` im Spielstand auf Aus', vor[name].an === false, vor[name]);
      check('1: und die Zeile nennt den Unterstützer-Rang als Grund', vor[name].nenntGrund, vor[name]);
      check('1: und ist als gesperrt erkennbar', vor[name].gedimmt === true, vor[name]);
    }
    // Klicken darf nichts umlegen.
    await page.evaluate((paare) => { for (const [id] of paare){ const z = document.getElementById(id+'Row'); if (z) z.click(); } }, SCHALTER);
    await page.waitForTimeout(900);
    const nach = await lage(page);
    for (const [, name] of SCHALTER) check('1: der Klick legt „'+name+'" nicht um', nach[name].an === false, nach[name]);
    check('keine JS-Fehler (ohne Rang)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 2) DER PUNKT: die Mechanik selbst bleibt aus
  // Der Spielstand sagt autoRepairOn:true und trägt eine laufende Sabotage. Mit Rang wird sie
  // behoben (siehe 3), ohne Rang muss sie stehen bleiben - sonst hinge die Sperre nur am Knopf.
  {
    const { page, ctx, gespeichert } = await lade(browser, { active:false, tier:null });
    // Speichern anstossen, damit der aktuelle Stand messbar wird.
    await page.evaluate(() => { document.body.click(); });
    await page.waitForTimeout(6000);   // mehrere Haupt-Ticks plus ein Speicherlauf
    const st = gespeichert.wert;
    check('2: der Spielstand wurde ueberhaupt gespeichert (sonst misst der Test nichts)', !!st);
    check('2: die Sabotage steht ohne Rang weiterhin', !!(st && st.mineDebuff && st.mineDebuff.until > Date.now()),
      st && { mineDebuff: st.mineDebuff });
    check('2: und es wurden keine KI-Kerne dafuer verbraucht', !!st && (st.resources.kikerne||0) >= 2500,
      st && { kikerne: st.resources.kikerne });
    await ctx.close();
  }

  // ============================== 3) GEGENPROBE: mit Rang läuft alles wie zuvor
  {
    const { page, ctx, errs, gespeichert } = await lade(browser, { active:true, tier:'gold' });
    const vor = await lage(page);
    for (const [, name] of SCHALTER){
      check('3: mit Rang steht „'+name+'" auf An', vor[name].an === true, vor[name]);
      check('3: und die Zeile erklärt wieder die Wirkung statt der Sperre', vor[name].nenntGrund === false, vor[name]);
      check('3: und ist nicht gedimmt', vor[name].gedimmt === false, vor[name]);
    }
    await page.evaluate(() => { document.body.click(); });
    await page.waitForTimeout(6000);
    const st = gespeichert.wert;
    check('3: und die Sabotage ist automatisch behoben', !!st && !st.mineDebuff, st && { mineDebuff: st.mineDebuff });
    check('3: dafuer wurden KI-Kerne verbraucht', !!st && (st.resources.kikerne||0) < 2500,
      st && { kikerne: st.resources.kikerne });
    check('keine JS-Fehler (mit Rang)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
