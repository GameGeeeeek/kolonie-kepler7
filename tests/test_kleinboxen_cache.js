// Die kleinen Dauerläufer: Zwischenspeicher für vier Boxen, die auf JEDEM Reiter mitlaufen.
//
// GEMESSEN, nicht geschätzt (14.08.2026, dritte Runde nach v8.310.0 und v8.311.0). Ein
// MutationObserver über acht Reiter zeigt, was heute noch je Sekunde neu geschrieben wird - die
// grossen Listen sind laengst erledigt, geblieben waren vier kleine, die dafuer ueberall mitliefen:
//
//     #socialProfileRow   1,1 kB   auf JEDEM der acht Reiter
//     #buffsBox           0,5 kB   auf JEDEM Reiter
//     #shareTypeChips     0,3 kB   auf JEDEM Reiter
//     #shareFormatChips   0,3 kB   auf JEDEM Reiter
//
// Zusammen 41,3 kB je Sekunde ueber die acht Reiter, danach 23,6 kB - beide Zahlen mit demselben
// Messskript erhoben. Der teure Teil ist nicht der Aufbau der Zeichenkette, sondern innerHTML samt
// Neuaufbau der Kindknoten und den anschliessenden querySelectorAll-Verdrahtungslaeufen.
//
// WARUM DIESE VIER UEBERHAUPT: socialLinksHtml() speist sich aus der KONSTANTE SOCIAL_PROFILE und
// aendert sich nie. Die Effekte-Box schreibt im Normalfall (keine aktiven Effekte) jede Sekunde
// denselben Satz. Die zwei Chip-Leisten aendern sich nur, wenn der Spieler eine andere Karte oder
// ein anderes Format waehlt.
//
// GEPRUEFT WIRD - und zwar BEIDE Richtungen, denn die Gefahr bei einer Bremse ist nicht, dass sie
// zu wenig bremst, sondern dass sie zu viel bremst:
//   1) Ohne Aenderung bleiben alle vier Boxen stehen (Marke am DOM-Knoten ueberlebt).
//   2) MIT laufendem Effekt schreibt die Effekte-Box weiter jede Sekunde - der Countdown darin
//      macht das Markup jede Sekunde zu einem anderen, die Signatur korrigiert sich also selbst.
//      Ohne diese Pruefung waere eine eingefrorene Restzeit-Anzeige das wahrscheinlichste Ergebnis.
//   3) Die Chip-Leisten bleiben nach uebersprungenen Sekunden BEDIENBAR und wechseln die Auswahl.
//      Das ist der Fall, den CLAUDE.md ausdruecklich als testpflichtig markiert: Ihre Klick-Handler
//      werden im SELBEN Zweig gesetzt wie das Schreiben, laufen bei einem uebersprungenen Tick also
//      nicht - das geht nur gut, weil dann auch die alten Knoten samt Handlern stehen bleiben.
//
// GEGENPROBE (Arbeitsregel 1, in beide Richtungen ausgefuehrt - Ergebnisse im PR):
//   - Am Stand davor (v8.499.0) fallen 1a-1d: die Marke stirbt bei jedem Tick.
//   - Setzt man buffsBox wieder auf ein bedingungsloses innerHTML, faellt 1b - und NUR 1b.
//   - Nimmt man die `if (typeNeu)`-Bedingung vor der Verdrahtung heraus, bleibt 3 gruen (die
//     Handler werden dann eben jede Sekunde neu gesetzt) - 3 misst also die Bedienbarkeit, nicht
//     die Ersparnis. Deshalb steht Punkt 1 daneben: erst beide zusammen belegen die Aenderung.
const { starteBrowser, devices, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending|notifications/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

// Ereignis-Uhren in die Zukunft: Bei 0 feuert der erste Planeten-Ereignis-Check GARANTIERT, und
// dessen render() wuerde die Marke mitten im Messfenster vernichten - der Test schiene dann zu
// beweisen, der Zwischenspeicher sei tot. Derselbe Fixture-Fehler wie in test_listen_cache.
function save(zusatz){
  return JSON.stringify(Object.assign({ tutorialSeen:true, newbieWelcomeSeen:true,
    nextPlanetEventCheck: Date.now() + 3600000, nextTraderCheck: Date.now() + 3600000,
    resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
    buildings:{solar:22,mine:20,labor:14,lager:16,werft:14,turm:8},
    research:{rkampf:9,rsolar:9}, fleet:{jaeger:600,missions:[]},
    colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
    xp:260000, credits:180000, buffs:[], lastTick:Date.now(),
    colonyNames:{}, modules:{}, shipModules:{} }, zusatz));
}

const markiere = (page, id) => page.evaluate(x => {
  const b=document.getElementById(x); if(!b || !b.firstElementChild) return false;
  b.firstElementChild.__marke = 1; return true;
}, id);
const markeDa = (page, id) => page.evaluate(x => {
  const b=document.getElementById(x);
  return !!(b && b.firstElementChild && b.firstElementChild.__marke);
}, id);

async function spiel(browser, zustand){
  const store={'kepler7-save-v3':save(zustand)};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1200} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2900);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  return { page, ctx, errs };
}

(async () => {
  const browser = await starteBrowser();

  // ---------------------------------------------- 1) Ohne Aenderung stehen alle vier still
  {
    const { page, ctx, errs } = await spiel(browser, {});
    const IDS = ['socialProfileRow', 'buffsBox', 'shareTypeChips', 'shareFormatChips'];
    const gerendert = {};
    for (const id of IDS) gerendert[id] = await page.evaluate(x=>{const b=document.getElementById(x); return b?b.innerHTML.length:-1;}, id);
    check('1-vorab: alle vier Boxen sind ueberhaupt gerendert (sonst misst 1a-1d nichts)',
      IDS.every(id => gerendert[id] > 20), gerendert);
    const konnte = {};
    for (const id of IDS) konnte[id] = await markiere(page, id);
    check('1-vorab2: alle vier lassen sich markieren', IDS.every(id => konnte[id] === true), konnte);
    await page.waitForTimeout(3600); // mindestens drei Sekunden-Ticks
    for (const id of IDS){
      check('1: #' + id + ' wurde NICHT neu geschrieben', await markeDa(page, id) === true);
    }
    const f = errs.filter(e=>!/favicon/i.test(e));
    check('1: keine Konsolenfehler', f.length === 0, f.slice(0,3));
    await ctx.close();
  }

  // ---------------------------------------------- 2) MIT laufendem Effekt schreibt sie weiter
  {
    // Der Countdown im Markup ist sekundengenau - die Signatur ist damit jede Sekunde eine andere.
    const { page, ctx } = await spiel(browser, { buffs:[{ kind:'prod_all', mult:2, expiresAt: Date.now() + 25*60000 }] });
    const inhalt = await page.evaluate(()=>{const b=document.getElementById('buffsBox'); return b?b.innerText:'';});
    check('2-vorab: der Effekt ist wirklich aktiv (sonst misst 2 den leeren Fall)',
      /Alle Ressourcen/.test(inhalt), inhalt.slice(0, 80));
    check('2-vorab2: die Box laesst sich markieren', await markiere(page, 'buffsBox') === true);
    await page.waitForTimeout(2600);
    check('2: mit laufendem Effekt wird die Box weiter neu geschrieben - der Countdown friert nicht ein',
      await markeDa(page, 'buffsBox') === false);
    await ctx.close();
  }

  // ---------------------------------------------- 3) Nach uebersprungenen Ticks noch bedienbar
  {
    const { page, ctx } = await spiel(browser, {});
    const vorher = await page.evaluate(()=>{
      const b=document.getElementById('shareFormatChips');
      return b ? [...b.querySelectorAll('[data-share-format]')].map(x=>({ k:x.getAttribute('data-share-format'), aktiv:x.classList.contains('buy') })) : null;
    });
    check('3-vorab: die Format-Chips stehen da, genau einer ist aktiv',
      Array.isArray(vorher) && vorher.length >= 2 && vorher.filter(x=>x.aktiv).length === 1, vorher);
    if (!vorher || vorher.length < 2){ await ctx.close(); await browser.close(); return ende(); }
    // Erst mehrere Sekunden verstreichen lassen - in denen wird die Leiste NICHT neu geschrieben
    // und ihre Handler folglich auch nicht neu gesetzt. Genau danach wird geklickt.
    await page.waitForTimeout(3600);
    const ziel = vorher.find(x=>!x.aktiv).k;
    await page.evaluate(k=>{
      const b=document.getElementById('shareFormatChips');
      const btn = b && b.querySelector('[data-share-format="'+k+'"]');
      if (btn) btn.click();
    }, ziel);
    await page.waitForTimeout(400);
    const nachher = await page.evaluate(()=>{
      const b=document.getElementById('shareFormatChips');
      return b ? [...b.querySelectorAll('[data-share-format]')].map(x=>({ k:x.getAttribute('data-share-format'), aktiv:x.classList.contains('buy') })) : null;
    });
    const jetztAktiv = (nachher||[]).find(x=>x.aktiv);
    check('3: nach uebersprungenen Sekunden schaltet ein Klick die Auswahl weiterhin um',
      !!jetztAktiv && jetztAktiv.k === ziel, { geklickt: ziel, aktiv: jetztAktiv && jetztAktiv.k, nachher });
    await ctx.close();
  }

  await browser.close();
  return ende();
})();
