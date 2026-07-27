// Ein Modul je Typ (27.07.2026, v8.316.0).
//
// Balance-Ansage: "module zu stark egal wo nur 1 typ pro modul also nicht das man 4 mal das selbe
// modul einbauen kann max 1". Bis hierher ließ sich derselbe Modultyp mehrfach in dieselben Slots
// stecken. Da die Boni eines Typs additiv in dieselbe Summe laufen (moduleBonusFor), war viermal
// Panzerung schlicht der vierfache Panzerungsbonus - die stärkste und zugleich einfallsloseste
// Aufstellung, mit jedem zusätzlichen Slot ungebremst wachsend.
//
// Die Regel zählt den TYP, nicht die Instanz. Ein Instanz-Schlüssel ist "typ:seltenheit" bzw.
// "typ:seltenheit:stufe:zusatzwerte"; der Typ ist alles vor dem ersten Doppelpunkt. Würde nur die
// exakt gleiche Instanz verboten, ließe sich die Regel mit Panzerung(gewöhnlich) +
// Panzerung(selten) + Panzerung(episch) umgehen und wäre wirkungslos - Prüfung 2 misst genau das.
//
// Geprüft wird:
//   1) ein zweites Modul desselben Typs lässt sich nicht einbauen
//   2) auch nicht in einer ANDEREN Seltenheit (der eigentliche Kern der Regel)
//   3) ein anderer Typ geht weiterhin - die Regel sperrt nicht zu viel
//   4) Schiffsklassen-Module gehorchen derselben Regel
//   5) Altbestände werden beim Laden bereinigt, OHNE dass Module verloren gehen
//   6) die Ausrüstungs-Vorlage ist kein Schlupfloch
//   7) der Knopf nennt den Grund vorher ("Typ belegt"), statt erst nach dem Klick
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

function save(opts){
  opts = opts || {};
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
    buildings:{solar:20,mine:18,lager:14,werft:10,labor:12}, research:{}, fleet:{jaeger:100,missions:[]},
    colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
    officers:{ ingenieur:3 }, commandPoints:40,
    // Vier Slots, damit "vier gleiche" ueberhaupt hineinpassen - mit weniger Slots wuerde die
    // Slot-Grenze zuschlagen und der Test bewiese nichts ueber die Typ-Regel.
    moduleSlotLevel:{ home:4 }, shipModuleSlotLevel:{ schlachtschiff:3 },
    modules: opts.modules || { 'panzerung:selten':2, 'panzerung:episch':1, 'schild:selten':1, 'lager:gewoehnlich':1 },
    equippedModules: opts.equipped || { home:[] },
    shipModules: opts.shipModules || { 'ss_panzerung:selten':2, 'ss_zielcomputer:episch':1 },
    equippedShipModules: opts.equippedShip || { schlachtschiff:[] },
    moduleLoadouts: opts.loadouts || {}, moduleFragments:500,
    battleStats:{wins:9,losses:2}, xp:20000, credits:50000, buffs:[], lastTick:Date.now(),
    colonyNames:{} });
}

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

// Gemessen wird am GESPEICHERTEN Stand: `state` steckt in der Spieldatei in einer Kapselung und ist
// im Fenster nicht sichtbar. Was hier ankommt, ueberlebt auch einen echten Reload.
function holen(store){
  const v = store['kepler7-save-v3'];
  if (v === undefined) return null;
  try { return typeof v === 'string' ? JSON.parse(v) : v; } catch(e){ return null; }
}

async function starte(browser, spielstand){
  const store={'kepler7-save-v3':spielstand};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1200} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2700);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="offiziere"]');if(b)b.click();});
  await page.waitForTimeout(800);
  return { page, ctx, errs, store };
}

// Klick auf den Einbauen-Knopf einer bestimmten Instanz. Bewusst ueber den echten Knopf und nicht
// ueber die Funktion: Ein gesperrter Knopf soll auch wirklich nichts ausloesen.
const einbauen = (page, attr, instKey) => page.evaluate(([a,k])=>{
  const b=document.querySelector('['+a+'="'+k+'"]');
  if(!b) return 'kein-knopf';
  if(b.disabled) return 'gesperrt';
  b.click(); return 'geklickt';
}, [attr, instKey]);

const knopfInfo = (page, attr, instKey) => page.evaluate(([a,k])=>{
  const b=document.querySelector('['+a+'="'+k+'"]');
  return b ? { text:b.textContent.trim(), gesperrt:b.disabled, titel:b.getAttribute('title')||'' } : null;
}, [attr, instKey]);

(async () => {
  const browser = await starteBrowser();

  // ------------------------------------------------------ 1-3) Standort-Module
  {
    const { page, ctx, errs, store } = await starte(browser, save());
    await page.evaluate(()=>{const b=document.querySelector('[data-officer-subtab="module"]'); if(b) b.click();});
    await page.waitForTimeout(700);

    const e1 = await einbauen(page, 'data-equip-module', 'panzerung:selten');
    await page.waitForTimeout(600);
    let s = holen(store) || {};
    check('1: das erste Modul geht rein', e1 === 'geklickt' && (s.equippedModules.home||[]).length === 1,
      { klick:e1, eingebaut:(s.equippedModules||{}).home });

    // 1) zweites Exemplar EXAKT derselben Instanz
    const e2 = await einbauen(page, 'data-equip-module', 'panzerung:selten');
    await page.waitForTimeout(600);
    s = holen(store) || {};
    check('1: ein zweites Modul desselben Typs geht NICHT rein',
      (s.equippedModules.home||[]).length === 1, { klick:e2, eingebaut:s.equippedModules.home });

    // 2) andere SELTENHEIT desselben Typs - der eigentliche Kern der Regel
    const e3 = await einbauen(page, 'data-equip-module', 'panzerung:episch');
    await page.waitForTimeout(600);
    s = holen(store) || {};
    check('2: auch eine andere Seltenheit desselben Typs geht NICHT rein',
      (s.equippedModules.home||[]).length === 1, { klick:e3, eingebaut:s.equippedModules.home });

    // 7) und der Knopf sagt das vorher
    const ki = await knopfInfo(page, 'data-equip-module', 'panzerung:episch');
    check('7: der Knopf nennt den Grund vorher', ki && ki.gesperrt === true && /Typ belegt/.test(ki.text), ki);
    check('7: und der Titel erklaert die Regel', ki && /je Typ ist nur eines erlaubt/.test(ki.titel), ki && ki.titel);

    // 3) ein ANDERER Typ muss weiterhin gehen - sonst sperrt die Regel zu viel
    const e4 = await einbauen(page, 'data-equip-module', 'schild:selten');
    await page.waitForTimeout(600);
    s = holen(store) || {};
    check('3: ein anderer Typ geht weiterhin rein',
      e4 === 'geklickt' && (s.equippedModules.home||[]).length === 2, { klick:e4, eingebaut:s.equippedModules.home });
    // Und die Slots waren nie der Grund: Es sind vier, belegt sind zwei.
    check('3: die Slot-Grenze war nicht der Grund (4 Slots, 2 belegt)',
      (s.moduleSlotLevel||{}).home === 4, (s.moduleSlotLevel||{}).home);
    check('keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ------------------------------------------------------ 4) Schiffsklassen-Module
  {
    const { page, ctx, store } = await starte(browser, save());
    await page.evaluate(()=>{const b=document.querySelector('[data-officer-subtab="schiffsmodule"]'); if(b) b.click();});
    await page.waitForTimeout(800);
    await einbauen(page, 'data-equip-shipmodule', 'ss_panzerung:selten');
    await page.waitForTimeout(600);
    const zweiter = await einbauen(page, 'data-equip-shipmodule', 'ss_panzerung:selten');
    await page.waitForTimeout(600);
    const s = holen(store) || {};
    const eq = (s.equippedShipModules||{}).schlachtschiff || [];
    check('4: auch bei Schiffsklassen-Modulen nur eines je Typ', eq.length === 1, { klick:zweiter, eingebaut:eq });
    // Gegenprobe: ein anderer Typ geht
    const anderer = await einbauen(page, 'data-equip-shipmodule', 'ss_zielcomputer:episch');
    await page.waitForTimeout(600);
    const s2 = holen(store) || {};
    check('4: ein anderer Schiffsmodul-Typ geht weiterhin',
      anderer === 'geklickt' && ((s2.equippedShipModules||{}).schlachtschiff||[]).length === 2,
      (s2.equippedShipModules||{}).schlachtschiff);
    await ctx.close();
  }

  // ------------------------------------------------------ 5) Altbestand wird bereinigt
  // Vier gleiche Panzerungen eingebaut - so sahen die staerksten Konten vor der Regel aus.
  {
    const altstand = save({
      modules:{}, shipModules:{},
      equipped:{ home:['panzerung:selten','panzerung:selten','panzerung:episch','schild:selten'] },
      equippedShip:{ schlachtschiff:['ss_panzerung:selten','ss_panzerung:selten'] }
    });
    const { page, ctx, store } = await starte(browser, altstand);
    await page.waitForTimeout(1200);
    const s = holen(store) || {};
    const eq = (s.equippedModules||{}).home || [];
    const eqS = (s.equippedShipModules||{}).schlachtschiff || [];
    check('5: die Doppelungen sind aus den Slots verschwunden',
      eq.length === 2 && eq.includes('panzerung:selten') && eq.includes('schild:selten'), eq);
    check('5: auch bei den Schiffsklassen-Modulen', eqS.length === 1, eqS);
    // Der springende Punkt: NICHTS darf dabei verloren gehen.
    const inv = s.modules || {}, invS = s.shipModules || {};
    check('5: die ueberzaehligen Module liegen wieder im Inventar',
      (inv['panzerung:selten']||0) === 1 && (inv['panzerung:episch']||0) === 1, inv);
    check('5: dasselbe bei den Schiffsklassen-Modulen', (invS['ss_panzerung:selten']||0) === 1, invS);
    // Gesamtzahl vorher 6, nachher muss sie 6 sein - Slots plus Inventar.
    const gesamt = eq.length + eqS.length
      + Object.values(inv).reduce((a,b)=>a+b,0) + Object.values(invS).reduce((a,b)=>a+b,0);
    check('5: die Gesamtzahl der Module ist unveraendert (6)', gesamt === 6, { gesamt, eq, eqS, inv, invS });
    await ctx.close();
  }

  // ------------------------------------------------------ 6) Vorlage ist kein Schlupfloch
  {
    const mitVorlage = save({
      modules:{ 'panzerung:selten':2, 'panzerung:episch':1, 'schild:selten':1 },
      equipped:{ home:[] },
      loadouts:{ home:{ A:['panzerung:selten','panzerung:selten','panzerung:episch','schild:selten'] } }
    });
    const { page, ctx, store } = await starte(browser, mitVorlage);
    await page.evaluate(()=>{const b=document.querySelector('[data-officer-subtab="module"]'); if(b) b.click();});
    await page.waitForTimeout(700);
    const geklickt = await page.evaluate(()=>{
      const b=[...document.querySelectorAll('[data-loadout-apply]')].find(x=>x.getAttribute('data-loadout-apply')==='A');
      if(!b) return false; b.click(); return true;
    });
    await page.waitForTimeout(900);
    const s = holen(store) || {};
    const eq = (s.equippedModules||{}).home || [];
    check('6: die Vorlage ist anwendbar', geklickt === true);
    check('6: sie baut je Typ nur eines ein', eq.length === 2, eq);
    check('6: und die uebersprungenen Module blieben im Inventar',
      (s.modules||{})['panzerung:selten'] === 1 && (s.modules||{})['panzerung:episch'] === 1, s.modules);
    await ctx.close();
  }

  // ------------------------------------------------------ Quelltext-Prüfungen
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  check('Q: die Typ-Pruefung existiert genau einmal',
    (src.match(/function typeAlreadyEquipped\(/g)||[]).length === 1
    && (src.match(/function moduleTypeOf\(/g)||[]).length === 1);
  // Vier Vorkommen sind richtig: je einmal in equipModule und equipShipModule (die Sperre) und je
// einmal in den beiden Inventar-Boxen (die Beschriftung). Die erste Fassung erwartete zwei und
// schlug deshalb an, obwohl alles korrekt war.
check('Q: beide Einbau-Wege pruefen sie - und beide Boxen zeigen es an',
    (src.match(/typeAlreadyEquipped\(equipped, instKey\)/g)||[]).length === 4
    && /if \(typeAlreadyEquipped\(equipped, instKey\)\)\{\n      const info = moduleInstanceInfo/.test(src)
    && /if \(typeAlreadyEquipped\(equipped, instKey\)\)\{\n      const vorhanden = shipModuleInstanceInfo/.test(src));
  check('Q: die Vorlage prueft sie ebenfalls',
    /if \(typeAlreadyEquipped\(equippedAt\(planetKey\), instKey\)\)\{ doppelt\+\+; continue; \}/.test(src));
  check('Q: die Migration laeuft beim Laden', /migrateEinModulJeTyp\(\);/.test(src)
    && (src.match(/function migrateEinModulJeTyp\(\)/g)||[]).length === 1);
  // Die Hilfe MUSS es sagen - eine Regel, die man nur durch Ausprobieren entdeckt, ist eine Falle.
  check('Q: die Hilfe nennt die Regel bei den Standort-Modulen',
    /Je Typ nur EIN Modul gleichzeitig/.test(src));
  check('Q: und bei den Schiffsklassen-Modulen',
    /je Typ nur eines gleichzeitig<\/strong> – unabhängig von der Seltenheit/.test(src));

  console.log('\n' + (fail ? 'FAIL' : 'PASS'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
