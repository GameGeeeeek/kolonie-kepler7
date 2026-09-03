// Kartenmenue (v8.353.0) - ein Klick auf ein Kartenobjekt oeffnet ein Menue, statt sofort eine
// Mission loszuschicken.
//
// WORAN DAS STILL DANEBENGEHEN KANN, und was dieser Test deshalb festhaelt:
//
//   1. DAS MENUE LANDET IM KARTENCONTAINER. buildGalaxyMap() schreibt dessen innerHTML jede
//      Sekunde neu. Ein Menue darin waere nach spaetestens einer Sekunde weg - mitsamt seinen
//      Klick-Handlern, und zwar mitten im Klick des Spielers. Es MUSS an document.body haengen.
//      Genau dieselbe Falle steht in CLAUDE.md unter "Jeder Bedienzustand, der NUR im DOM steckt".
//   2. EIN ALTER SOFORT-PFAD BLEIBT STEHEN. Vier Marker hatten je einen eigenen Klick-Handler
//      (Planet, Spieler, NPC, Mond). Bleibt einer davon auf der alten Sofortaktion, ist genau
//      dieses eine Objekt weiter ein Fehlklick-Risiko - und niemand merkt es, weil die anderen
//      drei sich richtig verhalten.
//   3. DIE ABGERAEUMTE FUNKTION LEBT WEITER. mapPlayerClick() wurde durch das Menue ersetzt.
//      Bleibt sie als tote Funktion stehen, sucht beim naechsten Mal jemand an der falschen
//      Stelle (bekannter Fallstrick dieses Projekts: doppelte/tote Funktionsdeklarationen).
//   4. DIE BEGRUENDUNGSZEILE ZEIGT MARKUP. Die Zeile wird escapet - costHtml() liefert Icon-HTML
//      und stuende dort als sichtbarer <i class=...>-Text. Dafuer gibt es costText().
//   5. DER TEXT ERZAEHLT ETWAS ANDERES ALS DER CODE (Regel 6). Die Mond-Tooltips sagten
//      "anklicken zum Wechseln" - das stimmte, solange der Klick genau das tat.
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI, ruhigeUhren } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------------------------------------------------------------- 1. Der Traeger
// Regel statt Momentaufnahme (Hausregel 3): Die Signatur beginnt mit den vier Kernparametern,
// darf aber wachsen - v8.510.0 kam der optionale infoHtml-Block (Asteroiden-Vorrat) dazu, und
// die alte exakte Klammer-Prüfung fiel auf korrektem Code durch.
check('openKarteMenu existiert', /function openKarteMenu\(ev, art, titel, eintraege[,)]/.test(src));
check('closeKarteMenu existiert', /function closeKarteMenu\(\)/.test(src));
check('das Menue haengt an document.body, nicht in der Karte',
  /document\.body\.appendChild\(el\);/.test(src));
// position:fixed, weil die Karte selbst verschiebbar ist - Dokumentkoordinaten wuerden beim
// naechsten Schwenk nicht mehr zum Marker passen.
check('.kmenu ist fixed positioniert', /\.kmenu \{ position:fixed;/.test(src));
check('das Menue bleibt im Fenster (Position wird geklemmt)',
  /window\.innerWidth - b\.width/.test(src) && /window\.innerHeight - b\.height/.test(src));

// ---------------------------------------------------------------- 2. Schliessen
check('schliesst bei Klick daneben', /if \(karteMenuEl && !karteMenuEl\.contains\(e\.target\)/.test(src));
check('schliesst mit Escape', /if \(e\.key !== 'Escape' \|\| !karteMenuEl\) return;\s*closeKarteMenu\(\);/.test(src));
// Weiter unten haengt ein zweiter Esc-Handler an document, der das aufgeklappte System zuklappt.
// Ohne das Anhalten schloesse ein Tastendruck beides - man kaeme aus einem versehentlich
// geoeffneten Menue nur heraus, indem man nebenbei das System verliert.
check('Escape gehoert dem Menue und klappt nicht zusaetzlich das System zu',
  /closeKarteMenu\(\);\s*e\.stopImmediatePropagation\(\);/.test(src));
check('schliesst beim Scrollen und bei Groessenaenderung',
  /window\.addEventListener\('scroll', closeKarteMenu, true\);/.test(src)
  && /window\.addEventListener\('resize', closeKarteMenu\);/.test(src));

// ---------------------------------------------------------------- 3. Alle vier Marker umgestellt
const marker = [
  ['Planet', /\[data-planet\]'\)\.forEach[\s\S]{0,400}planetMapMenu\(e, pid\)/],
  ['Spieler', /\[data-map-player\]'\)\.forEach[\s\S]{0,300}playerMapMenu\(e,/],
  ['NPC', /\[data-map-npc\]'\)\.forEach[\s\S]{0,300}npcMapMenu\(e,/],
  ['Mond', /\[data-map-moon\]'\)\.forEach[\s\S]{0,300}moonMapMenu\(e,/]
];
for (const [name, re] of marker) check(name+'-Marker oeffnet das Menue statt sofort zu handeln', re.test(src));
// Der native confirm()-Dialog beim NPC ist ersetzt - er nannte weder Flugzeit noch Treibstoff.
check('der native NPC-confirm ist weg', !/confirm\(\(node\.getAttribute\('data-map-npcname'\)/.test(src));
// Ein Zieh-Klick auf der verschiebbaren Karte darf das Menue nicht oeffnen.
// Bewusst nicht auf eine Formatierung festgenagelt (zwei Handler haben die Pruefung auf einer
// eigenen Zeile): geprueft wird, dass zwischen der Pruefung und dem Menueaufruf nichts liegt.
const dragOk = (src.match(/if \(galaxyMapDidDrag\) return;\s*(planet|player|npc|moon)MapMenu/g) || []).length;
check('jeder der vier Marker prueft galaxyMapDidDrag direkt vor dem Menue', dragOk === 4, dragOk);

// ---------------------------------------------------------------- 4. Die vier Menues
for (const fn of ['planetMapMenu', 'moonMapMenu', 'playerMapMenu', 'npcMapMenu']){
  check(fn+' ist genau einmal definiert',
    (src.match(new RegExp('function '+fn+'\\(', 'g')) || []).length === 1);
}
// Die Aktionen aus dem Spieler-Wunsch muessen wirklich verdrahtet sein, nicht nur beschriftet.
const aktionen = [
  ['Erkunden', /fn: \(\) => sendExploreMission\(planetId\)/],
  ['Kolonisieren (Planet)', /fn: \(\) => colonizePlanet\(planetId\)/],
  ['Kolonisieren (Mond)', /fn: \(\) => colonizeMoon\(parentKey\)/],
  ['Spaehen', /fn: \(\) => sendSpyMission\(userId, name\)/],
  ['Angreifen (Spieler)', /fn: \(\) => goToAttackPlayer\(userId, name\)/],
  // Seit v8.425.0 fuehrt der Eintrag ueber das Flottenwahl-Feld - die Eigenschaft "fuehrt
  // wirklich zum NPC-Angriff" gilt weiter, nur als Kette: Menue -> oeffneNpcAngriff -> Feld-Start
  // -> sendAttackMission. BEIDE Glieder werden geprueft, sonst koennte das Menue ein Feld
  // oeffnen, dessen Startknopf ins Leere zeigt.
  ['Angreifen (NPC, oeffnet Feld)', /fn: \(\) => oeffneNpcAngriff\(npcId\)/],
  ['Angreifen (NPC, Feld startet echt)', /start: \(\) => sendAttackMission\(npcId\)/]
];
for (const [name, re] of aktionen) check('Aktion verdrahtet: '+name, re.test(src));

// ---------------------------------------------------------------- 5. Sperrgruende
// Ein grauer Eintrag ohne Begruendung ist die schlechtere Haelfte derselben Information.
const gruende = [
  ['Erkundung bereits unterwegs', /Bereits eine Erkundung zu diesem Ziel unterwegs\./],
  ['Planet noch nicht erkundet', /Planet muss zuerst erkundet werden\./],
  ['Kolonie-Limit', /Kolonie-Limit erreicht \('\+\(currentColonyCount\(\)\+pendingColonyCount\(\)\)/],
  ['kein Kolonieschiff', /Kein Kolonieschiff auf '\+planetDisplayName\(state\.activeBasePlanet\)/],
  ['Pakt blockiert Spionage', /Nichtangriffspakt aktiv – Spionage ist blockiert\./],
  ['Pakt blockiert Angriff', /Nichtangriffspakt aktiv – ein Angriff ist blockiert\./],
  ['keine Angriffsflotte gewaehlt', /Angriffsflotte zusammenstellen/]
];
for (const [name, re] of gruende) check('Sperrgrund genannt: '+name, re.test(src));
// Die Bedingungen muessen dieselben sein wie in der Planetenliste - eine zweite Anzeigestelle mit
// eigenen Regeln waere genau der wiederkehrende Fehler dieses Projekts.
check('Erkundungs-Sperre nutzt dieselbe Bedingung wie die Planetenliste (cf.ships)',
  /const erkFrei = cf\.missions\.filter\(m => m\.type==='explore'\)\.length < cf\.ships;/.test(src));
check('Kolonisier-Sperre nutzt dasselbe Limit wie colonizePlanet',
  /currentColonyCount\(\) \+ pendingColonyCount\(\) >= maxColoniesAllowed\(\)/.test(src));

// ---------------------------------------------------------------- 6. Text ohne Markup
check('costText() liefert reinen Text', /function costText\(cost\)\{/.test(src));
const menueBlock = src.slice(src.indexOf('function openKarteMenu'), src.indexOf('const SUN_X ='));
check('die Menuetexte werden escapet', /escapeHtml\(e\.label\)/.test(menueBlock) && /escapeHtml\(e\.grund\)/.test(menueBlock));
check('im Menue steht kein costHtml (das waere sichtbares Icon-Markup)', !/costHtml\(/.test(menueBlock));

// ---------------------------------------------------------------- 7. Aufgeraeumt und dokumentiert
check('die ersetzte mapPlayerClick ist entfernt', !/function mapPlayerClick\(/.test(src));
check('moonMapClick lebt weiter (das Menue ruft sie fuer den Basiswechsel)',
  (src.match(/function moonMapClick\(/g) || []).length === 1 && /fn: \(\) => moonMapClick\(parentKey\)/.test(src));
// Regel 6: Der Mond-Tooltip sagte "anklicken zum Wechseln" - das stimmt jetzt nicht mehr.
check('die Mond-Tooltips sagen nicht mehr "anklicken zum Wechseln"',
  !/anklicken zum Wechseln\)':' \(noch nicht kolonisiert\)/.test(src));
check('die Hilfe erklaert das Kartenmenue', /title:'Das Kartenmenü – ein Klick löst nichts mehr sofort aus'/.test(src));
// Die Einschraenkung des Datenmodells gehoert in den Hilfetext, sonst sucht der Spieler
// "angreifen" ewig im Planetenmenue.
check('die Hilfe erklaert, warum Angreifen nicht beim Planeten steht',
  /eigenen roten Marker<\/strong> nahe der Sonne/.test(src));
// Der Eintrag wird namentlich gesucht, nicht in einem festen Ausschnitt ab dem Array-Anfang: Das
// Patchnotes-Array waechst nach OBEN, ein Byte-Fenster rutscht mit jeder neuen Version am gesuchten
// Eintrag vorbei und der Test wird rot, ohne dass sich an der Sache etwas geaendert hat. Genau das
// ist am 01.08.2026 bei test_abgrund_module2.js passiert.
// Die Historie liegt seit dem 01.09.2026 an zwei Stellen (Spiel + patchnotes-archiv.json); tests/lib/patchnotes.js setzt sie zusammen.
check('das Kartenmenue steht in den Patchnotes',
  /Ein Klick auf die Sektorkarte öffnet jetzt ein kleines Menü/.test(require('./lib/patchnotes').patchnotesText(src)));

// ---------------------------------------------------------------- 8. Im Browser
// Der statische Teil oben prueft, dass der Code so AUSSIEHT, wie er soll. Dass das Menue auch
// wirklich aufgeht, an document.body haengt und das aufgeklappte System nicht hinter sich zuzieht,
// zeigt nur ein echter Klick.
const SAVE = JSON.stringify({ ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:22,mine:20,labor:14,lager:16,werft:14}, research:{rkolonisation:4}, 
  fleet:{jaeger:600,spaeher:20,ships:6,colonyShips:3,missions:[]},
  colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
  prestige:2, xp:260000, credits:180000, buffs:[], lastTick:Date.now(), colonyNames:{} });

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

async function imBrowser(){
  const browser = await starteBrowser();
  const store = {'kepler7-save-v3':SAVE};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:1280,height:900} }));
  await ctx.route('**/api/**', backend(store));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/404|Failed to load resource|CORS/.test(m.text())) errs.push(m.text()); });
  await page.addInitScript(()=>{ localStorage.setItem('kepler7_token','tok'); });
  await page.goto(SPIEL_URL); await page.waitForTimeout(2600);
  for (let i=0;i<6;i++){
    const zu = await page.evaluate(()=>{
      const b=[...document.querySelectorAll('button')].find(x=>/Weiter geht|Verstanden|Schlie.en|Alles klar/i.test(x.textContent||'') && x.offsetParent);
      if(b){ b.click(); return true; } return false;
    });
    if (!zu) break;
    await page.waitForTimeout(400);
  }
  await page.evaluate(()=>{ const b=document.querySelector('.tab-btn[data-tab="karte"]'); if(b) b.click(); });
  await page.waitForTimeout(1200);
  // Seit KB-4: über die Sektoren hinein (Übersicht -> Region -> System).
  await oeffneSystemUeberSektoren(page, 'kepler');

  // Klick auf einen fremden Planeten
  const auf = await page.evaluate(()=>{
    const n = [...document.querySelectorAll('#galaxySystemLayer [data-planet]')].find(x => x.getAttribute('data-planet') !== '__home__');
    if (!n) return { klick:false };
    n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:400, clientY:300 }));
    const m = document.querySelector('.kmenu');
    return { klick:true, offen: !!m,
      amBody: !!m && m.parentElement === document.body,
      knoepfe: m ? [...m.querySelectorAll('button')].map(b=>b.textContent.trim()) : [],
      gruende: m ? m.querySelectorAll('.kmenu-grund').length : 0,
      systemOffen: !!document.getElementById('galaxySystemLayer') };
  });
  check('B: ein Planetenklick oeffnet das Menue', auf.klick && auf.offen, auf);
  check('B: es haengt an document.body (ueberlebt das Neuzeichnen der Karte)', auf.amBody);
  check('B: es bietet Erkunden und Kolonisieren', 
    auf.knoepfe.some(t=>/Erkunden/.test(t)) && auf.knoepfe.some(t=>/Kolonisieren/.test(t)), auf.knoepfe);
  check('B: jeder Eintrag hat eine Begruendungszeile', auf.gruende >= 2, auf.gruende);
  check('B: der Klick zieht das aufgeklappte System nicht zu', auf.systemOffen);

  // Der Haupt-Tick schreibt die Karte jede Sekunde neu - das Menue muss das ueberstehen. Genau
  // hier waere es gestorben, haette es im Kartencontainer gehangen.
  await page.waitForTimeout(2500);
  const nachTick = await page.evaluate(()=>({
    offen: !!document.querySelector('.kmenu'),
    knoepfe: document.querySelectorAll('.kmenu button').length }));
  check('B: das Menue steht nach zwei Kartenaufbauten noch', nachTick.offen && nachTick.knoepfe > 0, nachTick);

  // Esc gehoert dem Menue - das System bleibt offen.
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  const nachEsc = await page.evaluate(()=>({ menue: !!document.querySelector('.kmenu'),
    system: !!document.getElementById('galaxySystemLayer') }));
  check('B: Esc schliesst das Menue', !nachEsc.menue);
  check('B: und laesst das System offen', nachEsc.system, nachEsc);

  // NPC-Marker: frueher ein natives confirm(), das den Test blockiert haette.
  const npc = await page.evaluate(()=>{
    const n = document.querySelector('[data-map-npc]');
    if (!n) return { da:false };
    n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:400, clientY:300 }));
    const m = document.querySelector('.kmenu');
    return { da:true, offen:!!m, knoepfe: m ? [...m.querySelectorAll('button')].map(b=>b.textContent.trim()) : [] };
  });
  if (npc.da){
    check('B: ein NPC-Klick oeffnet das Menue statt eines Systemdialogs', npc.offen, npc);
    check('B: und bietet Angreifen an', npc.knoepfe.some(t=>/Angreifen/.test(t)), npc.knoepfe);
  } else {
    console.log('OK  - B: kein NPC im Startsystem sichtbar, Teilpruefung uebersprungen');
  }

  check('B: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
  await browser.close();
}

imBrowser().then(() => {
  console.log('\n' + (fail ? 'FAIL' : 'PASS'));
  process.exit(fail ? 1 : 0);
}).catch(e => { console.log('FAIL - Browserteil abgebrochen | ' + e.message); console.log('\nFAIL'); process.exit(1); });
