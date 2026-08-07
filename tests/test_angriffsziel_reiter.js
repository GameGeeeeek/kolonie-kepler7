// Der Angriffsknopf führt zur Flottenauswahl, nicht irgendwohin (05.08.2026).
//
// SPIELER-REPORT Sascha, sinngemaess: "wenn man Angriffe starten will, finde ich es umstaendlich".
//
// BEFUND: goToAttackPlayer() rief switchTab('galaxie') und liess state.galaxySubTab stehen, wo er
// gerade war. Der haeufigste Weg zu einem Angriff fuehrt aber ueber die BESTENLISTE - und die
// liegt im Unter-Reiter "Rangliste & Ruhm". Nach dem Klick auf das Schwert-Symbol blieb der
// Spieler also genau dort stehen, waehrend die Protokollzeile ihm sagte: "Waehle deine
// Angriffsflotte und klicke dann auf 'Spieler angreifen'." Beides liegt im Unter-Reiter "Kampf &
// Eroberung", und nichts sagte ihm das. Betroffen waren alle vier Wege, ein Ziel zu markieren
// (Bestenliste, Spielerprofil, Spionagebericht, Sektorkarte) sowie die Mondbelagerung.
//
// WIE HIER GEPRUEFT WIRD: ueber den echten Weg. Die Bestenliste speist sich aus den
// 'leaderboard:*'-Schluesseln des geteilten Speichers - ein einzelner Gegner reicht, damit das
// Schwert-Symbol erscheint. Danach wird gemessen, WELCHES Panel sichtbar ist.
//
// GEGENPROBE (Pruefung 3): Vorher steht der Spieler nachweislich im Ranglisten-Reiter. Ohne diese
// Messung waere der Test auch gruen, wenn das Spiel IMMER im Kampf-Reiter staende - dann pruefte
// er nichts.
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const SAVE = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:9e5,deuterium:9e5,antimaterie:900,forschungspunkte:900},
  buildings:{solar:20,mine:18,labor:10,lager:40,werft:14}, research:{},
  fleet:{ jaeger:60, cruisers:30, missions:[] }, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'Ich',avatarKey:null},
  // ABSICHTLICH im Ranglisten-Reiter starten - genau die Lage, in der der Fehler auftrat.
  // Der Schluessel heisst 'rang', nicht 'rangliste' - der erste Anlauf hatte ihn erfunden, und die
  // Gegenprobe meldete daraufhin `null`: Bei einem UNBEKANNTEN Unter-Reiter blendet die Anzeige
  // schlicht ALLE Panels aus (Zeile ~51188 vergleicht stur auf Gleichheit). Aufgefallen ist auch
  // das nur an der Gegenprobe.
  galaxySubTab:'rang',
  xp:5000, credits:5000, buffs:[], lastTick:Date.now(), colonyNames:{} });

const GEGNER = { id:'feind1', name:'Zielperson', score:12000, level:12, allianceTag:'XYZ',
                 ships:{jaeger:10}, defensePower:500, buildLvl:10, colonyCount:2 };

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'Ich',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  // EIN Gegner in der Bestenliste - mehr braucht es nicht, damit das Schwert-Symbol erscheint.
  if(p==='storage-list')return j({keys:['leaderboard:feind1']});
  if(p.startsWith('storage/')){
    const k=decodeURIComponent(p.slice(8));
    if(req.method()==='PUT'){ try { store[k]=JSON.parse(req.postData()).value; } catch(e){} return j({ok:true,version:2}); }
    if(k==='leaderboard:feind1') return j({key:k, value: JSON.stringify(GEGNER), version:1});
    if(store[k]!==undefined)return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}

// Welches Galaxie-Panel ist gerade sichtbar?
const SICHTBARES_PANEL = () => {
  const p = [...document.querySelectorAll('[data-galaxy-sub]')].find(x => x.style.display !== 'none');
  return p ? p.getAttribute('data-galaxy-sub') : null;
};

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{width:1400,height:1000} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SAVE() }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));

  // In den Galaxie-Tab wechseln. Der Unter-Reiter steht laut Spielstand auf 'rangliste'.
  await page.evaluate(() => {
    const b=[...document.querySelectorAll('[data-tab]')].find(x=>x.getAttribute('data-tab')==='galaxie');
    if(b)b.click();
  });
  await page.waitForTimeout(2500);

  // ---- 3) GEGENPROBE ZUERST: der Ausgangszustand ist wirklich der Ranglisten-Reiter.
  const vorher = await page.evaluate(SICHTBARES_PANEL);
  check('3: Gegenprobe - vorher steht der Spieler im Ranglisten-Reiter', vorher === 'rang', { panel: vorher });

  // ---- 1) Das Schwert-Symbol in der Bestenliste anklicken - der echte Weg.
  const geklickt = await page.evaluate(() => {
    const b = document.querySelector('[data-duel]');
    if (!b) return null;
    const name = b.getAttribute('data-duelname'); b.click(); return name;
  });
  check('1: das Schwert-Symbol in der Bestenliste war da', geklickt === 'Zielperson', { geklickt });
  await page.waitForTimeout(1800);

  // ---- 2) DER KERN: danach steht er im Kampf-Reiter, wo Auswahl und Startknopf liegen.
  const nachher = await page.evaluate(SICHTBARES_PANEL);
  check('2: nach dem Klick steht er im Kampf-Reiter', nachher === 'kampf', { panel: nachher });

  // Und der Startknopf ist wirklich sichtbar - nicht nur das Panel umgeschaltet.
  // Genau das ist der Unterschied zwischen "Tab gewechselt" und "der Spieler kann handeln".
  const knopfSichtbar = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /Spieler angreifen/i.test(x.textContent||''));
    return !!(b && b.offsetParent !== null);
  });
  check('2: und der Knopf "Spieler angreifen" ist sichtbar', knopfSichtbar);

  // Seit v8.427.0 gibt es die alte Auswahl-Box nicht mehr - die Flottenwahl oeffnet sich am
  // Knopf selbst. Geprueft wird also der neue echte Weg: Klick -> Feld offen.
  await page.evaluate(() => { const b = document.getElementById('pendingAttackBtn'); if (b) b.click(); });
  await page.waitForTimeout(700);
  const feldOffen = await page.evaluate(() => {
    const o = document.getElementById('fwahlOverlay');
    return !!(o && o.classList.contains('open'));
  });
  check('2: und der Knopf öffnet das Flottenwahl-Feld', feldOffen);

  check('keine JS-Fehler', errs.length === 0, errs.slice(0,3));
  await ctx.close(); await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
