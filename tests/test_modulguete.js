// Modul-Zweitwerte: der Spieler kann jetzt sehen, ob ein Wurf gut war (05.08.2026).
//
// AUSGANGSLAGE (nachgelesen, nicht vermutet): Die Zweitwerte wuerfeln 1,0 % bis 2,5 % - der Bereich
// stand als `10 + Math.floor(Math.random()*16)` mitten im Wuerfelcode und war nirgends abfragbar.
// Angezeigt wurde nur die nackte Zahl ("+1,7 % Produktion"). Damit fehlte der Bezugsrahmen: Ist das
// viel? Was waere moeglich gewesen?
//
// Die Folge war groesser als eine Anzeigeschwaeche: Das Spiel hat seit langem ein NEU-WUERFELN der
// Zweitwerte (moduleRerollCost) - eine Entscheidung, die man ohne Bezugsrahmen gar nicht treffen
// kann. Man wusste nie, ob sich der Einsatz lohnt.
//
// WAS DIESER TEST PRUEFT:
//   1. Die Spanne ist BENANNT und der Wuerfelcode benutzt sie - sonst koennte die Anzeige wieder
//      an einer eingestreuten Zahl vorbeirechnen.
//   2. Die Guete-Rechnung ist richtig verankert: schlechtester Wurf = 0, bester = 1, dazwischen
//      monoton. Und OHNE Zweitwerte gibt es null statt 0 - "kein Wurf" ist nicht "schlechtester
//      Wurf", das waere schlicht gelogen.
//   3. Alle vier Anzeigestellen gehen ueber dieselbe Funktion.
//   4. Im Browser: ein Spitzenwurf und ein schwacher Wurf sind wirklich zu UNTERSCHEIDEN.
//      Das ist der Punkt - ohne diese Pruefung waere der Test auch gruen, wenn ueberall dasselbe
//      Wort staende.
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const SPIEL = fs.readFileSync(path.join(__dirname, '..', 'weltraum_kolonie.html'), 'utf8');
const JS = SPIEL.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) die Spanne ist benannt und wird auch benutzt
{
  const min = (JS.match(/const MODULE_SUB_MIN = (\d+)/)||[])[1];
  const max = (JS.match(/const MODULE_SUB_MAX = (\d+)/)||[])[1];
  check('1: die Spanne der Zweitwerte ist benannt', !!min && !!max, { min, max });
  // Der Wuerfelcode darf die Zahlen nicht mehr selbst enthalten - sonst laufen Wurf und Anzeige
  // auseinander, sobald jemand nur eine der beiden Stellen aendert.
  const roll = JS.slice(JS.indexOf('function rollModuleSubs('), JS.indexOf('function moduleRerollCost('));
  check('1: der Wuerfelcode benutzt die benannte Spanne',
    /MODULE_SUB_MIN/.test(roll) && /MODULE_SUB_MAX/.test(roll) && !/\*\s*16\)/.test(roll),
    { hinweis:'Die alte Fassung hatte 10 und 16 fest eingebaut.' });
}

// ---- 2) die Guete-Rechnung, mit den echten Funktionen ausgefuehrt
{
  const schnitt = (von, bis) => JS.slice(JS.indexOf(von), JS.indexOf(bis));
  const u = {};
  new Function('u', schnitt('const MODULE_SUB_MIN', 'function rollModuleSubs(') +
    '\nu.g = moduleSubGuete; u.mg = moduleGuete; u.stufe = modulGueteStufe; u.MIN = MODULE_SUB_MIN; u.MAX = MODULE_SUB_MAX;')(u);

  check('2: der schlechtestmoegliche Wurf ergibt Guete 0', u.g(u.MIN/1000) === 0, u.g(u.MIN/1000));
  check('2: der bestmoegliche Wurf ergibt Guete 1', u.g(u.MAX/1000) === 1, u.g(u.MAX/1000));
  // Monoton: jeder Schritt nach oben erhoeht die Guete. Ohne das koennte die Anzeige einen
  // besseren Wurf als schlechter ausweisen.
  let monoton = true;
  for (let v = u.MIN; v < u.MAX; v++) if (!(u.g((v+1)/1000) > u.g(v/1000))) monoton = false;
  check('2: dazwischen steigt sie monoton', monoton);
  // Werte ausserhalb der Spanne (Altbestand, kuenftig geweitete Spanne) duerfen nicht ausbrechen.
  check('2: Werte ausserhalb der Spanne werden gekappt, nicht hochgerechnet',
    u.g(0.001) === 0 && u.g(0.9) === 1, { klein: u.g(0.001), gross: u.g(0.9) });
  // OHNE Zweitwerte: null, nicht 0.
  check('2: ohne Zweitwerte gibt es null statt 0 ("kein Wurf" ist nicht "schlechtester Wurf")',
    u.mg([]) === null && u.mg(null) === null, { leer: u.mg([]), nix: u.mg(null) });
  check('2: und die Stufen-Einordnung kommt damit klar', u.stufe(null) === null);
  // Zwei Zweitwerte werden gemittelt.
  check('2: mehrere Zweitwerte werden gemittelt',
    Math.abs(u.mg([{value:u.MIN/1000},{value:u.MAX/1000}]) - 0.5) < 1e-9,
    u.mg([{value:u.MIN/1000},{value:u.MAX/1000}]));
}

// ---- 3) eine Quelle fuer alle Anzeigestellen
{
  check('3: substatZeile() existiert', /function substatZeile\(/.test(JS));
  const aufrufe = (JS.match(/substatZeile\(info\.subs\)/g) || []).length;
  check('3: alle vier Anzeigestellen gehen darueber', aufrufe === 4, aufrufe);
  // Und keine baut die Zeile noch selbst.
  const selbstgebaut = (JS.match(/subs\.map\(s=>'\+'\+\(s\.value\*100\)/g) || []).length;
  check('3: keine Anzeigestelle baut die Zeile mehr selbst', selbstgebaut === 0, selbstgebaut);
}

// ---- 4) im Browser: Spitzenwurf und schwacher Wurf sind zu unterscheiden
// Zwei Module desselben Typs koennen nicht gleichzeitig ausgeruestet sein (ein Modul je Typ), aber
// im BESTAND duerfen beide liegen - und genau dort werden sie angezeigt.
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e6,erz:9e6,kristalle:9e6,deuterium:9e6,antimaterie:9e4,forschungspunkte:9e4},
  buildings:{solar:22,mine:20,labor:14,lager:30,werft:14}, research:{}, fleet:{missions:[]},
  colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
  // 'prod25' = 2,5 % (bestmoeglich), 'prod10' = 1,0 % (schlechtestmoeglich).
  modules: { 'panzerung:legendaer:1:prod25': 1, 'waffen:legendaer:1:prod10': 1 },
  moduleFragments: 500, equippedModules:{}, shipModules:{},
  xp:9e5, credits:5e5, buffs:[], lastTick:Date.now(), colonyNames:{} });

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p==='storage-list')return j({keys:[]});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{width:1400,height:1000} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));
  // Module stehen im Offiziere-Tab. Abschnitte aufklappen, damit die Liste sichtbar ist.
  await page.evaluate(() => {
    const b=[...document.querySelectorAll('[data-tab]')].find(x=>x.getAttribute('data-tab')==='offiziere');
    if(b)b.click();
    document.querySelectorAll('.prog-section.collapsed').forEach(e=>e.classList.remove('collapsed'));
    document.querySelectorAll('.sec-collapsed').forEach(e=>e.classList.remove('sec-collapsed'));
  });
  await page.waitForTimeout(2500);
  const t = await page.evaluate(() => (document.body.textContent||'').replace(/\s+/g,' '));

  check('4: keine JS-Fehler', errs.length === 0, errs.slice(0,3));
  check('4: der Spitzenwurf wird als solcher benannt', /Spitzenwurf/.test(t));
  check('4: der schwache Wurf ebenfalls', /schwach/.test(t));
  // DER PUNKT: beide stehen gleichzeitig da, also werden sie wirklich unterschieden.
  check('4: beide Einordnungen erscheinen gleichzeitig - sie sind zu unterscheiden',
    /Spitzenwurf/.test(t) && /schwach/.test(t),
    { hinweis:'Ohne diese Pruefung waere der Test auch gruen, wenn ueberall dasselbe Wort staende.' });
  // Und die Prozentzahlen stehen weiterhin da - die Einordnung ERSETZT sie nicht.
  check('4: die genauen Werte stehen weiterhin daneben', /2[.,]5\s*%/.test(t) && /1[.,]0\s*%/.test(t));

  await ctx.close(); await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
