// Modul-Boxen: Zwischenspeicher (27.07.2026, v8.309.0).
//
// Ausgangsbefund: Beide Modul-Boxen - Standort-Module (#moduleBox) und Schiffsklassen-Module
// (#shipModuleBox) - hängen im Zweig `activeTab === 'offiziere'` der Hauptrenderfunktion. Solange
// der Reiter offen war, wurden BEIDE jede Sekunde komplett neu geschrieben und danach mit
// zusammen über dreißig querySelectorAll-Läufen neu verdrahtet - obwohl immer nur EINE davon
// sichtbar ist und sich in aller Regel gar nichts geändert hat. Seit v8.305.0/v8.307.0 stehen in
// dem Markup außerdem handgezeichnete SVG.
//
// Bedingung des Hausmusters aus CLAUDE.md ist erfüllt: kein Live-Countdown, keine Date.now()-
// Differenz, die sichtbar hochzählt.
//
// Die Signatur ist hier ausnahmsweise das FERTIGE MARKUP statt einer Liste der angezeigten Werte.
// Diese Boxen zeigen nicht fünf Zahlen, sondern Slots, Inventar, Schmelze, Tier-2-Fertigung und
// Set-Boni; eine Wertliste wäre lang, schwer vollständig zu halten und würde beim nächsten neuen
// Feld still veralten. Der Aufbau der Zeichenkette ist billig - teuer sind das innerHTML-Schreiben
// und die Verdrahtungsläufe, und genau die entfallen.
//
// Geprüft wird:
//   1) ohne Änderung bleibt das DOM der Standort-Modulbox über mehrere Ticks bestehen
//   2) dasselbe für die Schiffsmodul-Box
//   3) DER EIGENTLICHE RISIKOFALL: Nach mehreren übersprungenen Ticks müssen die Knöpfe noch
//      funktionieren - ihre onclick-Handler werden ja nicht mehr neu gesetzt.
//   4) eine echte Änderung baut die Box sofort wieder auf (kein Einfrieren)
//   5) die Umschalter (Planet / Schiffsklasse) markieren die Auswahl im Markup - nur deshalb
//      darf die Signatur das Markup sein: sonst könnte sich pk/klasse ändern, ohne dass sich das
//      Markup ändert, und der Cache würde eine echte Umschaltung verschlucken
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

// Beide Inventare gefüllt UND beide Sockelstufen gesetzt - ohne moduleSlotLevel bzw.
// shipModuleSlotLevel gibt es keine Slots, keine Kacheln, und der Test prüfte eine leere Box.
const SAVE = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:20,mine:18,lager:14,werft:10,labor:12}, research:{}, fleet:{jaeger:100,missions:[]},
  colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
  officers:{ ingenieur:3 }, commandPoints:40,
  modules:{ 'panzerung:selten':1, 'schild:episch':1, 'lager:gewoehnlich':1 },
  equippedModules:{ home:['panzerung:selten','schild:episch','lager:gewoehnlich'] },
  moduleSlotLevel:{ home:3 },
  shipModules:{ 'ss_panzerung:selten':1, 'ss_zielcomputer:episch':1, 'ss_schildverstaerker:selten':1 },
  equippedShipModules:{ schlachtschiff:['ss_panzerung:selten','ss_zielcomputer:episch','ss_schildverstaerker:selten'] },
  shipModuleSlotLevel:{ schlachtschiff:3 },
  moduleFragments:500,
  battleStats:{wins:9,losses:2}, xp:20000, credits:50000, buffs:[], lastTick:Date.now(),
  colonyNames:{} });

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

// Die Markierung hängt am DOM-Knoten, nicht am Markup - ein innerHTML-Neuschreiben vernichtet sie
// zwangsläufig. Das ist die Messung, und sie kann nicht aus dem falschen Grund gelingen (anders als
// ein Vergleich der Textinhalte, die ja gleich BLEIBEN sollen).
const markiere = (page, id) => page.evaluate(x => {
  const b=document.getElementById(x); if(!b || !b.firstElementChild) return false;
  b.firstElementChild.__marke = 1; return true;
}, id);
const marke = (page, id) => page.evaluate(x => {
  const b=document.getElementById(x);
  return { da:!!(b && b.firstElementChild && b.firstElementChild.__marke), kacheln: b ? b.querySelectorAll('.mod-slot').length : -1,
           frei: b ? b.querySelectorAll('.mod-slot.empty').length : -1 };
}, id);

(async () => {
  const browser = await starteBrowser();
  const store={'kepler7-save-v3':SAVE};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1200} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2600);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="offiziere"]');if(b)b.click();});
  await page.waitForTimeout(900);

  // ------------------------------------------------------- 1) Standort-Module stehen still
  await page.evaluate(()=>{const b=document.querySelector('[data-officer-subtab="module"]'); if(b) b.click();});
  await page.waitForTimeout(700);
  const start1 = await marke(page, 'moduleBox');
  check('1: die Standort-Modulkacheln sind gerendert', start1.kacheln >= 3, start1);
  check('1: die Box lässt sich markieren', await markiere(page, 'moduleBox') === true);
  await page.waitForTimeout(3400); // mindestens drei Sekunden-Ticks
  const nach1 = await marke(page, 'moduleBox');
  check('1: ohne Änderung wird die Standort-Modulbox über mehrere Ticks NICHT neu geschrieben',
    nach1.da === true, nach1);

  // ------------------------------------------------------- 3) Knöpfe wirken trotzdem noch
  // Das ist der Risikofall dieser Änderung: Die onclick-Handler werden bei einem übersprungenen
  // Tick nicht neu gesetzt. Bleiben sie hängen, wäre die Box nach ein paar Sekunden tot - und ein
  // reiner "DOM steht still"-Test wäre trotzdem grün.
  const vorher1 = (await marke(page, 'moduleBox')).frei;
  await page.evaluate(()=>{const b=document.querySelector('[data-unequip-module]'); if(b) b.click();});
  await page.waitForTimeout(900);
  const nach3 = await marke(page, 'moduleBox');
  check('3: der Abnehmen-Knopf wirkt auch nach übersprungenen Ticks noch',
    nach3.frei === vorher1 + 1, { vorher:vorher1, nachher:nach3.frei });
  // 4) und die echte Änderung hat die Box neu aufgebaut - der Cache friert sie nicht ein
  check('4: die Änderung hat die Box neu aufgebaut', nach3.da === false, nach3);

  // ------------------------------------------------------- 2) Schiffsmodule stehen still
  await page.evaluate(()=>{const b=document.querySelector('[data-officer-subtab="schiffsmodule"]'); if(b) b.click();});
  await page.waitForTimeout(800);
  const start2 = await marke(page, 'shipModuleBox');
  check('2: die Schiffsmodulkacheln sind gerendert', start2.kacheln >= 3, start2);
  check('2: die Box lässt sich markieren', await markiere(page, 'shipModuleBox') === true);
  await page.waitForTimeout(3400);
  const nach2 = await marke(page, 'shipModuleBox');
  check('2: ohne Änderung wird die Schiffsmodulbox über mehrere Ticks NICHT neu geschrieben',
    nach2.da === true, nach2);

  const vorher2 = (await marke(page, 'shipModuleBox')).frei;
  await page.evaluate(()=>{const b=document.querySelector('[data-unequip-shipmodule]'); if(b) b.click();});
  await page.waitForTimeout(900);
  const nach4 = await marke(page, 'shipModuleBox');
  check('3: der Abnehmen-Knopf der Schiffsmodule wirkt ebenfalls noch',
    nach4.frei === vorher2 + 1, { vorher:vorher2, nachher:nach4.frei });
  check('4: und die Schiffsmodulbox wurde dabei neu aufgebaut', nach4.da === false, nach4);

  // ------------------------------------------------------- 5) Umschalter markieren die Auswahl
  // Nur weil Planet und Schiffsklasse ihre Auswahl SICHTBAR machen, darf das Markup die Signatur
  // sein. Stünde die Auswahl nur in state, könnte sie sich ändern, ohne dass sich das Markup
  // ändert - und der Cache würde die Umschaltung verschlucken.
  const umschalt = await page.evaluate(()=>{
    const k=[...document.querySelectorAll('[data-shipmodule-class]')];
    return { anzahl:k.length, aktive:k.filter(b=>b.className.includes('active')).length };
  });
  check('5: der Schiffsklassen-Umschalter markiert die aktive Klasse im Markup',
    umschalt.anzahl >= 2 && umschalt.aktive === 1, umschalt);

  check('keine Konsolenfehler', errs.length === 0, errs.slice(0,3));

  // ------------------------------------------------------- Quelltext-Prüfungen
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  check('Q: beide Boxen haben ein Signatur-Gate',
    /if \(html !== lastModuleBoxHtml \|\| !moduleBox\.childElementCount\)\{/.test(src)
    && /if \(html !== lastShipModuleHtml \|\| !shipModuleBox\.childElementCount\)\{/.test(src));
  // childElementCount ist kein Beiwerk: Räumt irgendwer die Box von außen leer, muss der
  // Neuaufbau trotz gleicher Signatur laufen.
  check('Q: der Leer-Fall ist in beiden Gates abgesichert',
    (src.match(/\|\| !\w*[Mm]odule?Box\.childElementCount/g)||[]).length === 2);
  check('Q: die Zwischenspeicher sind genau einmal deklariert',
    (src.match(/let lastModuleBoxHtml = null;/g)||[]).length === 1
    && (src.match(/let lastShipModuleHtml = null;/g)||[]).length === 1);

  console.log('\n' + (fail ? 'FAIL' : 'PASS'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
