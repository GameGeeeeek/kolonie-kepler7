// Exotische Forschung und Veteranen-Ausbildung ueberstehen das Prestige (05.08.2026).
//
// BEFUND: Beide Reset-Objekte enthielten woertlich `exoticResearch:{}, veteranTraining:{}` -
// Prestige UND Aufstieg loeschten also beide Systeme. Gleichzeitig endeten alle drei Exoten-
// Beschreibungen auf "(dauerhaft)", und der Prestige-Bestaetigungsdialog erwaehnte sie mit keinem
// Wort: Er zaehlt sorgfaeltig auf, was verloren geht ("Gebaeude, Forschung und Flotte") und was
// bleibt ("Skill-Baum, Offiziere, Module, Abgrund-Fortschritt") - in KEINER der beiden Listen
// standen sie. Das sind bis zu 86.000 Forschungspunkte, die ohne Vorwarnung verschwanden.
//
// ENTSCHEIDUNG (Sascha): Sie ueberleben das Prestige. Bewusst AN DEN SKILL-BAUM GEKOPPELT und
// nicht als eigene Regel - es soll genau EINE Antwort auf "was ueberlebt einen Reset" geben.
// Beim AUFSTIEG fallen sie weiterhin, dort faellt auch der Skill-Baum.
//
// GEPRUEFT WIRD:
//   1. Die Regel am Quelltext: Prestige bewahrt beide, der Aufstieg nicht - und beide Dialoge
//      sagen es. Ein Reset, der etwas Teures still loescht, ist genau der Fall, in dem der Text
//      mitgeprueft gehoert.
//   2. Im Browser, mit einem ECHTEN Prestige: die Freischaltungen sind danach noch da.
//   3. GEGENPROBE: Gebaeude und Forschung sind danach WEG. Ohne diese Pruefung waere der Test
//      auch gruen, wenn das Prestige gar nichts zuruecksetzte.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ---- 1) die Regel am Quelltext
{
  const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

  // Der Prestige-Reset muss die gemerkten Werte zurueckschreiben, nicht leere Objekte.
  const prestige = JS.slice(JS.indexOf('const keepSkillTree = state.skillTree;'));
  const resetPrestige = prestige.slice(0, prestige.indexOf('vorboten:'));
  check('1: Prestige bewahrt die exotische Forschung',
    /exoticResearch:keepExotic/.test(resetPrestige));
  check('1: Prestige bewahrt die Veteranen-Ausbildung',
    /veteranTraining:keepVeteran/.test(resetPrestige));
  // Und die Werte werden vorher wirklich gemerkt - sonst waeren keepExotic/keepVeteran undefined
  // und der ||{}-Fallback loeschte sie genauso still wie vorher.
  check('1: die Werte werden vor dem Reset gemerkt',
    /const keepExotic = state\.exoticResearch;/.test(JS) &&
    /const keepVeteran = state\.veteranTraining;/.test(JS));

  // Der AUFSTIEG loescht sie weiterhin - dort faellt auch der Skill-Baum.
  // Erkennbar am Reset-Objekt, das skillTree:{} setzt.
  const aufstiegStart = JS.indexOf('skillTree:{}, dailyQuests:null');
  const aufstieg = aufstiegStart < 0 ? '' : JS.slice(aufstiegStart, JS.indexOf('vorboten:', aufstiegStart));
  check('1: der Aufstieg setzt beide weiterhin zurück (wie den Skill-Baum)',
    /exoticResearch:\{\}/.test(aufstieg) && /veteranTraining:\{\}/.test(aufstieg));

  // BEIDE Dialoge muessen es sagen. Das ist der Kern des Befunds: Die Mechanik war nicht das
  // Problem, das Verschweigen war es.
  const prestigeDialog = (JS.match(/confirm\('Prestige zurücksetzen\?[^']*'/) || [''])[0];
  check('1: der Prestige-Dialog nennt beide Systeme',
    /Exotische Forschung/.test(prestigeDialog) && /Veteranen-Ausbildung/.test(prestigeDialog),
    prestigeDialog.slice(0, 150));
  const aufstiegDialog = (JS.match(/confirm\('Wirklich sicher\?[^']*'/) || [''])[0];
  check('1: der Aufstiegs-Dialog sagt, dass sie verloren gehen',
    /Exotische Forschung/.test(aufstiegDialog) && /Veteranen-Ausbildung/.test(aufstiegDialog),
    aufstiegDialog.slice(0, 170));

  // Die Phantom-Punkte: logScoreChange meldete einen Zuwachs, den computeScore() nie vergibt.
  check('1: keine Phantom-Punkte mehr beim Abschluss',
    !/logScoreChange\(200, def\.name/.test(JS) && !/logScoreChange\(150, def\.name/.test(JS));

  // Eigene Icons statt eines fest verdrahteten ti-medal fuer alle Stufen.
  const vt = JS.slice(JS.indexOf('const VETERAN_TRAINING = ['), JS.indexOf('const VETERAN_TRAINING_DURATION_MS'));
  const iconKeys = (vt.match(/icon:'[a-z-]+'/g) || []);
  check('1: jede Veteranenstufe hat ein eigenes Icon',
    iconKeys.length === 3 && new Set(iconKeys).size === 3, iconKeys);
  check('1: und die Karte benutzt das Feld statt eines Literals',
    /class="ti \$\{v\.icon\|\|'ti-medal'\}"/.test(JS));

  // Die Erfolgstexte rechnen, statt eine Zahl zu behaupten.
  check('1: die Erfolgstexte rechnen statt "alle drei" zu behaupten',
    /'Schließe alle '\+VETERAN_TRAINING\.length\+' Stufen/.test(JS) &&
    /'Schließe alle '\+EXOTIC_RESEARCH\.length\+' Exotischen/.test(JS));
}

// ---- 2)+3) im Browser: ein echtes Prestige durchfuehren
const SAVE = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e6,erz:9e6,kristalle:9e6,deuterium:9e6,antimaterie:9e4,forschungspunkte:9e4},
  // Hohe Gebaeude/Forschung/Flotte aus ZWEI Gruenden: die Gegenprobe unten braucht etwas zu
  // messen, UND computeScore() muss ueber prestigeRequiredScore() liegen (PRESTIGE_BASE_COST=5000
  // beim ersten Prestige) - sonst ist der Knopf disabled und der ganze Ablauf findet nicht statt.
  // Genau daran ist der zweite Anlauf gescheitert: Knopf da, aber disabled.
  buildings:{solar:40,mine:38,raffinerie:35,synth:30,labor:28,lager:45,werft:25,
             forschungslabor:20,roboterfabrik:20,nanofabrik:15},
  research:{rflottenkoord:8, rlabor:12, rwaffen:12, rschild:12, rpanzerung:12, rantrieb:12},
  fleet:{ jaeger:400, cruisers:200, destroyers:120, schlachtschiff:60, missions:[] }, colonies:{},
  activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
  exoticResearch:{ quantenkomm:true, legierungen:true },
  veteranTraining:{ vet1:true, vet2:true },
  skillTree:{}, xp:9e6, credits:9e5, buffs:[], lastTick:Date.now(), colonyNames:{} });

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p==='storage-list')return j({keys:[]});
  if(p.startsWith('storage/')){
    const k=decodeURIComponent(p.slice(8));
    if(req.method()==='PUT'){ try { store[k] = JSON.parse(req.postData()).value; } catch(e){} return j({ok:true,version:2}); }
    if(store[k]!==undefined)return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}

(async () => {
  const browser = await starteBrowser();
  const store = { 'kepler7-save-v3': SAVE() };
  const ctx = await browser.newContext({ viewport:{width:1400,height:1000} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  // confirm() automatisch bestaetigen - der Prestige-Knopf fragt zweimal.
  page.on('dialog', d => d.accept());
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));

  const vorher = JSON.parse(store['kepler7-save-v3']);
  check('2: Ausgangsstand hat die Freischaltungen',
    !!(vorher.exoticResearch||{}).quantenkomm && !!(vorher.veteranTraining||{}).vet1,
    { exotic: Object.keys(vorher.exoticResearch||{}), vet: Object.keys(vorher.veteranTraining||{}) });

  // Prestige ausloesen. Der Knopf sitzt im FORTSCHRITT-Tab, heisst "Zurücksetzen" (nicht
  // "Prestige") und traegt id="prestigeBtn"; er ist disabled, solange computeScore() unter
  // prestigeRequiredScore() liegt.
  // ERSTER ANLAUF SUCHTE NACH DEM WORT "Prestige" IM KNOPFTEXT und fand nichts - der Test war
  // dadurch scheinbar gruen: Ohne Prestige blieben die Freischaltungen natuerlich erhalten, und
  // die beiden "hat ueberlebt"-Pruefungen bestanden, ohne irgendetwas zu belegen. Aufgefallen ist
  // es NUR an der Gegenprobe weiter unten. Genau dafuer ist sie da.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[data-tab]')].find(x => x.getAttribute('data-tab')==='fortschritt');
    if (b) b.click();
  });
  await page.waitForTimeout(1800);
  const knopf = await page.evaluate(() => {
    const b = document.getElementById('prestigeBtn');
    return b ? { da:true, disabled: b.disabled, text: (b.textContent||'').trim() } : { da:false };
  });
  check('2: der Prestige-Knopf ist da und freigeschaltet',
    knopf.da && !knopf.disabled, knopf);
  await page.evaluate(() => { const b = document.getElementById('prestigeBtn'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  // Nach der Bestaetigung folgt die Perk-Auswahl ("Dauerhaften Bonus wählen") - und ERST der
  // Klick auf einen Bonus schreibt den Reset. Die Knoepfe tragen data-prestige-perk.
  // Auch hier war der erste Anlauf falsch (Suche nach dem Wort "wählen" im Knopftext); der Test
  // meldete danach brav "überlebt", ohne dass je ein Prestige stattgefunden haette.
  const perkGeklickt = await page.evaluate(() => {
    const b = document.querySelector('[data-prestige-perk]');
    if (!b) return null;
    const key = b.getAttribute('data-prestige-perk'); b.click(); return key;
  });
  check('2: die Bonus-Auswahl war da und wurde bestätigt', !!perkGeklickt, { perk: perkGeklickt });
  await page.waitForTimeout(3500);

  const nachher = JSON.parse(store['kepler7-save-v3']);
  check('2: die exotische Forschung hat das Prestige überlebt',
    !!(nachher.exoticResearch||{}).quantenkomm && !!(nachher.exoticResearch||{}).legierungen,
    Object.keys(nachher.exoticResearch||{}));
  check('2: die Veteranen-Ausbildung ebenfalls',
    !!(nachher.veteranTraining||{}).vet1 && !!(nachher.veteranTraining||{}).vet2,
    Object.keys(nachher.veteranTraining||{}));

  // ---- 3) GEGENPROBE: das Prestige hat wirklich stattgefunden.
  // Ohne diese Pruefung waere der Test auch gruen, wenn gar nichts zurueckgesetzt wurde.
  // GEGEN DEN ECHTEN AUSGANGSSTAND, nicht gegen eingetippte Zahlen: Der erste Anlauf verglich
  // mit festen 28/8 und wurde selbst vakuos, sobald der Spielstand oben angehoben wurde - er
  // meldete "zurückgesetzt", obwohl gar nichts passiert war.
  check('3: Gegenprobe - die Gebäude sind zurückgesetzt',
    (nachher.buildings||{}).mine < (vorher.buildings||{}).mine,
    { vorher: (vorher.buildings||{}).mine, nachher: (nachher.buildings||{}).mine });
  check('3: Gegenprobe - die Forschung ist zurückgesetzt',
    // ||0, weil der Schluessel nach dem Reset GANZ FEHLT - und `undefined < 12` ist falsch.
    ((nachher.research||{}).rlabor || 0) < ((vorher.research||{}).rlabor || 0),
    { vorher: (vorher.research||{}).rlabor, nachher: (nachher.research||{}).rlabor || 0 });
  check('3: und der Prestige-Zähler ist hochgegangen',
    (nachher.prestige||0) > (vorher.prestige||0), { vorher: vorher.prestige||0, nachher: nachher.prestige||0 });

  check('keine JS-Fehler', errs.length === 0, errs.slice(0,3));
  await ctx.close(); await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
