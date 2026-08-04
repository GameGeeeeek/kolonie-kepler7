// Ein geöffnetes Auswahlfeld überlebt das sekündliche Neuzeichnen (05.08.2026, Spieler-Report).
//
// SPIELER-REPORT Sascha, direkt nach v8.414.0: „bei Allianz den Raid-Boss aussuchen - die
// Dropdown-Funktion geht nicht. Du klickst sie an, sie schließt aber innerhalb von einer Sekunde
// wieder."
//
// URSACHE, genau der Fallstrick aus CLAUDE.md: Der Haupt-Tick schreibt die Raid-Box jede Sekunde
// per innerHTML neu. Ein GEÖFFNETES Auswahlfeld ist ein Zustand, den ausschließlich der Browser
// kennt - er lässt sich nicht ins erzeugte HTML zurückschreiben. `data-keep-value` rettet den
// gewählten WERT (und war deshalb nötig und richtig), aber nicht das offene Menü: Beim Neuaufbau
// ist das alte Element samt Menü schlicht weg.
//
// isTypingIn() deckt SELECT längst ab - die Box hat es nur nicht benutzt. Die Musterangriff-Box
// direkt daneben hatte den Schutz seit jeher. Beim Nachsehen fiel dieselbe Lücke in der
// Diplomatie-Box auf (Auswahlfelder fürs Pakt-Geschenk), nicht gemeldet, aber derselbe Fehler.
//
// WAS DIESER TEST PRÜFT: nicht „steht isTypingIn im Quelltext" - das wäre eine Behauptung über den
// Code, nicht über das Verhalten. Gemessen wird das VERHALTEN: Ein Element im Kasten wird markiert,
// das Auswahlfeld bekommt den Fokus (das ist, was ein geöffnetes Menü ausmacht), und nach mehreren
// Sekunden muss die Markierung noch da sein - der Kasten wurde also nicht neu aufgebaut.
//
// Die Gegenprobe gehört zwingend dazu: OHNE Fokus MUSS der Kasten weiterhin neu geschrieben werden.
// Sonst hätte ich die Box eingefroren statt sie zu schützen, und Countdown und Zustand blieben stehen.
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const TAG = 'RAI';
const store = {};
store['alliance:'+TAG+':info'] = JSON.stringify({ tag:TAG, creatorId:'u', creatorName:'A', createdAt:Date.now(), joinMode:'open' });
store['alliance:'+TAG+':member:u'] = JSON.stringify({ userId:'u', name:'A', role:'admin', joinedAt:Date.now() });
store['alliance:'+TAG+':role:u'] = JSON.stringify({ playerId:'u', name:'A', role:'admin', joinedAt: Date.now()-9e6 });
// Kein laufender Raid -> die Karte zeigt den Zweig "neuer Raid" samt Gegner-Auswahl.
store['alliance:'+TAG+':base'] = JSON.stringify({ foundedAt: Date.now()-9e6, sector:'kepler', level:3, hp:1000, maxHp:1000 });

function backend(){ return async r => {
  const req=r.request(); const u=req.url(); const p=u.split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p==='storage-list'){
    const pref = decodeURIComponent((u.split('prefix=')[1]||'').split('&')[0]);
    return j({ keys: Object.keys(store).filter(k=>k.startsWith(pref)) });
  }
  if(p.startsWith('storage/')){
    const k=decodeURIComponent(p.slice(8));
    if(req.method()==='PUT')return j({ok:true,version:2});
    if(store[k]!==undefined)return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e6,erz:9e6,kristalle:9e6,deuterium:9e6,antimaterie:9e4,forschungspunkte:9e4},
  buildings:{solar:22,mine:20,labor:14,lager:30,werft:14}, research:{}, fleet:{missions:[],destroyers:50},
  colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null,allianceTag:TAG,allianceRole:'admin'},
  allianceBase:{ foundedAt: Date.now()-9e6, sector:'kepler' },
  xp:9e5, credits:5e5, buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{width:1400,height:1100} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend());
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));
  await page.evaluate(() => { const b=[...document.querySelectorAll('[data-tab]')].find(x=>x.getAttribute('data-tab')==='allianz'); if(b)b.click(); });
  await page.waitForTimeout(1500);
  // Der Allianz-Tag im Spielstand allein reicht NICHT: Beim Laden prueft das Spiel die
  // Mitgliedschaft gegen den geteilten Speicher und wirft den Tag weg, wenn sie nicht bestaetigt
  // ist. Deshalb hier der ECHTE Weg - Tag eintragen und "Setzen" klicken, so wie ein Spieler es
  // tut. (An genau dieser Huerde war schon ein frueherer Messaufbau fuer den Allianz-Tab
  // gescheitert; der Umweg ueber die Oberflaeche loest sie.)
  await page.evaluate((tag) => {
    const inp = document.getElementById('allianceInput');
    if (inp){ inp.value = tag; inp.dispatchEvent(new Event('input', {bubbles:true})); }
    const btn = document.getElementById('saveAllianceBtn');
    if (btn) btn.click();
  }, TAG);
  await page.waitForTimeout(3000);

  const da = await page.evaluate(() => {
    const b = document.getElementById('allianceRaidBox');
    return { box: !!b, select: !!(b && b.querySelector('#raidBossSelect')),
             text: b ? (b.textContent||'').replace(/\s+/g,' ').slice(0,90) : null };
  });
  if (!da.select){
    const diag = await page.evaluate(() => {
      const t = document.getElementById('allianceTag');
      const inp = document.getElementById('allianceInput');
      return { tagAnzeige: t ? t.textContent : null, eingabe: inp ? inp.value : null,
               allianzTabText: (document.getElementById('tab-allianz')||{textContent:''}).textContent.replace(/\s+/g,' ').slice(0,200) };
    });
    console.log('   DIAGNOSE: ' + JSON.stringify(diag));
  }
  check('das Gegner-Auswahlfeld ist da', da.box && da.select, da);
  if (!da.select){ console.log('\nFEHLGESCHLAGEN'); await browser.close(); process.exit(1); }

  // ---- GEGENPROBE ZUERST: ohne Fokus MUSS der Kasten weiter neu geschrieben werden.
  // Zuerst, weil sie beweist, dass die Messmethode ueberhaupt etwas sieht. Waere sie nachher
  // gruen, koennte sie das auch sein, weil die Box gar nicht mehr gezeichnet wird.
  {
    await page.evaluate(() => {
      document.activeElement && document.activeElement.blur();
      const b = document.getElementById('allianceRaidBox');
      if (b && b.firstElementChild) b.firstElementChild.__marke = true;
    });
    await page.waitForTimeout(3200);
    const weg = await page.evaluate(() => {
      const b = document.getElementById('allianceRaidBox');
      return !(b && b.firstElementChild && b.firstElementChild.__marke);
    });
    check('Gegenprobe: OHNE Fokus wird der Kasten weiterhin neu geschrieben', weg === true,
      { hinweis:'Sonst waere die Box eingefroren statt geschuetzt - Countdown und Zustand blieben stehen.' });
  }

  // ---- Der eigentliche Punkt: MIT Fokus auf dem Auswahlfeld bleibt der Kasten stehen.
  // Ein geoeffnetes Menue hat den Fokus - das ist die messbare Entsprechung zu "Dropdown offen".
  {
    await page.evaluate(() => {
      const b = document.getElementById('allianceRaidBox');
      const sel = b && b.querySelector('#raidBossSelect');
      if (sel) sel.focus();
      if (b && b.firstElementChild) b.firstElementChild.__marke = true;
    });
    await page.waitForTimeout(3200);
    const stand = await page.evaluate(() => {
      const b = document.getElementById('allianceRaidBox');
      const sel = b && b.querySelector('#raidBossSelect');
      return { marke: !!(b && b.firstElementChild && b.firstElementChild.__marke),
               nochFokussiert: !!(sel && document.activeElement === sel),
               optionen: sel ? sel.options.length : 0 };
    });
    check('mit Fokus auf dem Auswahlfeld bleibt der Kasten ueber mehrere Sekunden stehen',
      stand.marke === true, stand);
    check('und das Auswahlfeld selbst hat den Fokus behalten', stand.nochFokussiert === true, stand);
    check('alle fuenf Gegner stehen zur Wahl', stand.optionen === 5, stand);
  }

  // ---- Und die gewaehlte Sorte ueberlebt das Neuzeichnen weiterhin (data-keep-value).
  // Beides zusammen ergibt erst eine benutzbare Auswahl: offen bleiben UND die Wahl behalten.
  {
    await page.evaluate(() => {
      const sel = document.querySelector('#raidBossSelect');
      if (sel){ sel.value = sel.options[3].value; sel.dispatchEvent(new Event('change', {bubbles:true})); sel.blur(); }
    });
    await page.waitForTimeout(3200);
    const w = await page.evaluate(() => {
      const sel = document.querySelector('#raidBossSelect');
      return sel ? sel.value : null;
    });
    const erwartet = await page.evaluate(() => {
      const sel = document.querySelector('#raidBossSelect');
      return sel ? sel.options[3].value : null;
    });
    check('die getroffene Wahl ueberlebt das Neuzeichnen', !!w && w === erwartet, { gewaehlt: w });
  }

  // ---- DER FALL, DEN DIE FOKUS-PRUEFUNG NICHT ABDECKT (05.08.2026, zweiter Report)
  // Auf dem Handy oeffnet ein Auswahlfeld ein SYSTEMMENUE ausserhalb der Seite - die Seite kann
  // dabei den Fokus ganz verlieren. Dann greift isTypingIn() nicht, die Box wird weiter jede
  // Sekunde neu geschrieben, und das Menue schliesst sich wieder. Genau das hat Sascha ein zweites
  // Mal gemeldet.
  // Ein gesteuerter Browser kann kein echtes Systemmenue oeffnen. Nachgestellt wird deshalb die
  // messbare Eigenschaft: mousedown auf dem Auswahlfeld (das feuert immer, BEVOR das Menue
  // aufgeht), danach Fokus ausdruecklich WEGNEHMEN - also der schlimmste Fall.
  {
    await page.evaluate(() => {
      const b = document.getElementById('allianceRaidBox');
      const sel = b && b.querySelector('#raidBossSelect');
      if (sel) sel.dispatchEvent(new MouseEvent('mousedown', { bubbles:true }));
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (b && b.firstElementChild) b.firstElementChild.__marke2 = true;
    });
    await page.waitForTimeout(3200);
    const ohneFokus = await page.evaluate(() => {
      const b = document.getElementById('allianceRaidBox');
      return { marke: !!(b && b.firstElementChild && b.firstElementChild.__marke2),
               aktiv: document.activeElement ? document.activeElement.tagName : null };
    });
    check('auch OHNE Fokus bleibt der Kasten stehen, wenn das Auswahlfeld angetippt wurde',
      ohneFokus.marke === true, Object.assign(ohneFokus,
        { hinweis:'Das ist der Handy-Fall: Systemmenue ausserhalb der Seite, Fokus weg.' }));

    // Und die Sperre loest sich nach der Auswahl wieder - sonst bliebe die Box haengen.
    await page.evaluate(() => {
      const sel = document.querySelector('#raidBossSelect');
      if (sel){ sel.dispatchEvent(new Event('change', { bubbles:true })); }
      const b = document.getElementById('allianceRaidBox');
      if (b && b.firstElementChild) b.firstElementChild.__marke3 = true;
    });
    await page.waitForTimeout(3200);
    const danach = await page.evaluate(() => {
      const b = document.getElementById('allianceRaidBox');
      return !(b && b.firstElementChild && b.firstElementChild.__marke3);
    });
    check('nach getroffener Auswahl laeuft das Neuzeichnen wieder an', danach === true,
      { hinweis:'Sonst bliebe die Karte samt Countdown fuer immer stehen.' });
  }

  check('keine JS-Fehler', errs.length === 0, errs.slice(0,3));
  await ctx.close(); await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
