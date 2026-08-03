// Waffengattungen, Treffer und Antriebsfahnen in der Kampf-Wiedergabe
// (04.08.2026, Spieler-Wunsch Sascha: „Was können wir grafisch bei dem Kampf noch rausholen?
// Mehr Effekte je nach Waffen Gattung etc.?").
//
// AUSGANGSLAGE: Alle Ruempfe feuerten dieselbe Streusalve - vom Jaeger bis zum Koloss. Und die
// Schiffssalven schlugen NIRGENDS ein: einschlag() lief nur fuer Bodengeschosse, Schiffsgeschosse
// verschwanden am Ende ihrer Flugzeit lautlos.
//
// GEPRUEFT WIRD AM LAUFENDEN GEFECHT, nicht am Quelltext. Die Zeile `if (rolle === 'kapital')
// return 'lanze'` kann stimmen, waehrend im Bild nie eine Lanze fliegt - genau dieser Fall ist
// beim Bau eingetreten: Die beiden neuen Geschossarten wurden erzeugt, hatten aber keinen Zweig
// in zeichneGeschosse(). Die if/else-Kette dort hat KEINEN else-Zweig, ein neuer Typ fliegt also
// korrekt und ist unsichtbar. Auslesbar ist der Zustand ueber #osWrap[data-zustand] - dasselbe
// Auskunftsfeld, das schon Massstab und Modellatlanten meldet; es wird seit v8.398.0 einmal je
// Sekunde nachgefuehrt, weil ein einmaliger Stand beim Anflug entsteht, wo noch gar nicht
// geschossen wird.
//
// DER ENTSCHEIDENDE PUNKT bei den Vorraeten (Abschnitt 3): Die kurzlebigen Trefferblitze haben
// einen EIGENEN Vorrat. Haetten sie blitzNeu() benutzt, waeren die 90 Plaetze der Explosions-
// blitze von einem Dauerstrom aus Salveneinschlaegen belegt - der Kampf haette FLACHER
// ausgesehen, nicht voller. Der Test prueft deshalb nicht nur "Treffer erscheinen", sondern
// dass daneben weiterhin Explosionsblitze Platz haben.
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// Die Flotte ist bewusst so gewaehlt, dass ALLE DREI Konterrollen darin vorkommen:
//   schlachtschiff/quantenkreuzer -> kapital  (Lanzenstrahl)
//   bomber/hyperbomber            -> bomber   (Torpedos)
//   jaeger/hyperjaeger            -> abfang   (Salve)
// Ohne diese Mischung koennte der Test gruen sein, waehrend zwei der drei Gattungen fehlen.
const FLOTTE = { jaeger:900, hyperjaeger:120, bomber:400, hyperbomber:180,
  schlachtschiff:600, quantenkreuzer:220, cruisers:300, destroyers:260, waechter:400 };
const ABWEHR = { flak:20, turm:18, laser:16, raketen:12, gauss:10, plasma:8, schild:8 };

// Ein NPC-Kampf: Der fuehrt die drei echten Kampfphasen mit - nur dann gibt es einen
// mittleren Abschnitt, und nur in dem fahren die Grosskampfschiffe ihre Breitseite auf.
const NPC = { id:'n1', ts:Date.now(), time:Date.now(), type:'npc-attack', result:'win',
  npcName:'Kryllid-Nest (Stufe 5)', attackPower:88000, defensePower:52000,
  targetPlanet:'home', debrisPlanet:'home',
  phases:[ { nr:1, name:'Anflug', gewonnen:true }, { nr:2, name:'Hauptgefecht', gewonnen:true },
           { nr:3, name:'Rückzug', gewonnen:true } ],
  fleet: FLOTTE, ownLostShips:{ jaeger:210, bomber:60, schlachtschiff:40 },
  npcFleet:{ jaeger:1400, cruisers:380, schlachtschiff:120 },
  destroyedNpcShips:{ jaeger:1400, cruisers:300, schlachtschiff:90 } };

function backend(store, berichte){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='reports')return j({reports:berichte});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
  buildings:Object.assign({solar:22,mine:20,labor:14,lager:30,werft:14}, ABWEHR),
  research:{rkampf:9}, fleet:Object.assign({missions:[]}, FLOTTE), colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, battleStats:{wins:99,losses:2}, xp:9e5, credits:5e5,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{},
  // Werftmarken fuer Abschnitt 4: Ohne Marke >= 2 zeichnet drawShipMiniIcon gar keine
  // Plakette, und der Nachweis liefe ins Leere. Bewusst Stufe 3 und nicht 10 - ab Marke 9
  // bekommt der Rumpf einen goldenen Silbersaum und ab 10 einen goldenen Bugscheinwerfer.
  // Die zaehlen in derselben Farbprobe mit und stuenden dann auch im Bild der Wiedergabe,
  // wo sie hingehoeren: Der Test koennte die Plakette nicht mehr von ihnen unterscheiden.
  shipMarks: Object.keys(FLOTTE).reduce((a,k) => { a[k] = 3; return a; }, {}) });

async function wiedergabeOeffnen(browser, ger){
  const ctx = await browser.newContext(ger ? Object.assign({}, devices[ger]) : { viewport:{width:1280,height:900} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, [NPC]));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3600);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  await page.evaluate(() => { const x=document.getElementById('headerReportsBtn'); if(x)x.click(); });
  await page.waitForTimeout(1600);
  await page.evaluate(() => { const x=document.querySelector('[data-watch-battle]'); if(x)x.click(); });
  await page.waitForTimeout(1200);
  return { page, ctx, errs };
}

const lesen = page => page.evaluate(() => {
  try { return JSON.parse(document.getElementById('osWrap').dataset.zustand); } catch(e){ return null; }
});

// Ueber mehrere Sekunden mitschreiben statt einmal hinsehen: Geschosse leben Bruchteile von
// Sekunden, und welche Art gerade unterwegs ist, haengt an den Nachladezeiten (Lanze 2,8-4,6 s).
// Eine einzelne Stichprobe wuerde je nach Zufall mal die eine, mal die andere Gattung verpassen.
async function mitschreiben(page, sekunden){
  const proben = [];
  for (let i = 0; i < sekunden * 4; i++){
    const z = await lesen(page);
    if (z) proben.push(z);
    await page.waitForTimeout(250);
  }
  return proben;
}

(async () => {
  const browser = await starteBrowser();

  // ============================== 1) Alle drei Waffengattungen fliegen wirklich
  {
    const { page, ctx, errs } = await wiedergabeOeffnen(browser);
    const proben = await mitschreiben(page, 16);
    const summe = {};
    proben.forEach(z => Object.entries(z.geschossArten || {}).forEach(([k,v]) => { summe[k] = (summe[k]||0) + v; }));
    check('1: das Auskunftsfeld wird laufend nachgefuehrt (nicht nur einmal beim Aufbau)',
      new Set(proben.map(p => p.t)).size >= 5, { verschiedeneZeitpunkte: new Set(proben.map(p=>p.t)).size });
    check('1: Abfangjaeger und leichte Rümpfe feuern Salven', (summe.spur||0) > 0, summe);
    check('1: Grosskampfschiffe feuern Lanzenstrahlen', (summe.lanze||0) > 0, summe);
    check('1: Bomber feuern Torpedos', (summe.schifftorpedo||0) > 0, summe);
    check('keine JS-Fehler (Waffengattungen)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 2) Schiffssalven schlagen ein - und lassen die Explosionen in Ruhe
  {
    const { page, ctx, errs } = await wiedergabeOeffnen(browser);
    const proben = await mitschreiben(page, 16);
    const maxT = Math.max(...proben.map(p => (p.vorraete||{}).treffer || 0));
    const grenze = (proben[0].grenzen||{}).MAXT || 0;
    check('2: Schiffstreffer blitzen ueberhaupt auf', maxT > 0, { maxTreffer: maxT });
    check('2: und bleiben in ihrem eigenen Deckel', grenze > 0 && maxT <= grenze, { maxTreffer: maxT, MAXT: grenze });
    // DAS ist der Punkt: Der Explosionsvorrat darf vom Trefferstrom nicht aufgefressen werden.
    const maxB = Math.max(...proben.map(p => (p.vorraete||{}).blitze || 0));
    const grenzeB = (proben[0].grenzen||{}).MAXB || 0;
    check('2: die grossen Explosionsblitze haben weiterhin Platz',
      maxB < grenzeB, { maxBlitze: maxB, MAXB: grenzeB });
    // Und die Vorraete duerfen nicht ueber ihre Grenzen laufen - beim Treffervorrat wird der
    // AELTESTE verdraengt, beim Funkenvorrat der neue abgelehnt; beides muss halten.
    const ueber = proben.filter(p => (p.vorraete.funken > p.grenzen.MAXF) ||
                                     (p.vorraete.geschosse > p.grenzen.MAXG) ||
                                     (p.vorraete.scherben > p.grenzen.MAXS));
    check('2: kein Vorrat laeuft ueber seine Grenze', ueber.length === 0,
      ueber.slice(0,2).map(p => ({ v: p.vorraete, g: p.grenzen })));
    check('keine JS-Fehler (Treffer)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 3) Antriebsfahnen brennen an den grossen Ruempfen
  {
    const { page, ctx, errs } = await wiedergabeOeffnen(browser);
    const proben = await mitschreiben(page, 6);
    const fahnen = Math.max(...proben.map(p => p.antriebsfahnen || 0));
    check('3: Ruempfe tragen eine Antriebsart aus dem Spiel', fahnen > 0, { fahnen });
    check('keine JS-Fehler (Antrieb)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 4) Die Werftmarken-Plakette bleibt in der Wiedergabe draussen
  // GEMESSEN WIRD DAS FERTIGE BILD, nicht der Quelltext: „das Kennzeichen wird gesetzt" und
  // „die Plakette ist wirklich weg" sind zwei verschiedene Aussagen. Gezaehlt werden die
  // Bildpunkte im Gold der Plakette - einmal im gebackenen Schiffsbild der Wiedergabe (ueber
  // das Auskunftsfeld), einmal in einer echten Flottenlisten-Leinwand aus dem DOM.
  //
  // Die GEGENPROBE ist der eigentliche Wert dieses Abschnitts: Ohne sie waere der Test auch
  // dann gruen, wenn die Plakette ueberall verschwunden waere - also auch in der Flottenliste,
  // wo sie hingehoert.
  {
    const { page, ctx, errs } = await wiedergabeOeffnen(browser);
    const z = await lesen(page);
    // Wiedergabe zumachen und in den Flotte-Tab: Dort stehen die echten Listen-Leinwaende.
    await page.evaluate(() => { const b = document.getElementById('battleModalCloseBtn'); if (b) b.click(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const t = document.querySelector('.tab-btn[data-tab="flotte"]');
      if (t) t.click();
    });
    await page.waitForTimeout(1600);
    const liste = await page.evaluate(() => {
      // Dieselbe Farbprobe wie im Spiel (goldPunkt) - hier auf einer echten Listen-Leinwand.
      // Ausdruecklich eine Klasse, die im Spielstand eine Werftmarke traegt - die erste
      // beliebige Leinwand waere sonst ein Erkundungsschiff ohne Marke und ohne Plakette.
      const cv = document.querySelector('canvas[data-ship-icon="schlachtschiff"]');
      if (!cv) return null;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4){
        if (d[i+3] > 140 && d[i] > 205 && d[i] < 255 && d[i+1] > 150 && d[i+1] < 225 && d[i+2] > 55 && d[i+2] < 150) n++;
      }
      return { key: cv.getAttribute('data-ship-icon'), punkte: n };
    });
    check('4: eine Flottenlisten-Leinwand war zum Vergleich da', liste !== null, liste);
    check('4: dort traegt das Schiff seine Marken-Plakette', liste && liste.punkte > 30, liste);
    // Geeicht statt geraten: Waere die Plakette in der Wiedergabe drin, muesste jedes der
    // gebackenen Bilder rund so viele Goldpunkte tragen wie die Listen-Leinwand. Der
    // gemessene Wert muss deutlich darunter liegen. Ein fester Schwellwert waere hier
    // wertlos - ein paar Rümpfe tragen selbst einen Goldverlauf und zaehlen mit.
    const pl = z && z.plakettePunkte;
    const erwartetMitPlakette = liste ? liste.punkte * (pl ? pl.bilder : 0) : 0;
    check('4: es wurden ueberhaupt Schiffsbilder gebacken', pl && pl.bilder > 3, pl);
    check('4: im Bild der Wiedergabe fehlt die Plakette',
      pl && erwartetMitPlakette > 0 && pl.punkte < erwartetMitPlakette * 0.5,
      { gemessen: pl && pl.punkte, mitPlaketteZuErwarten: erwartetMitPlakette, jeListe: liste && liste.punkte });
    check('keine JS-Fehler (Plakette)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 5) Auf dem Telefon laeuft es genauso fehlerfrei
  // Die Grenzen der Partikelvorraete sind dort andere (klein = Breite < 700). Ein Deckel, der
  // nur am grossen Bild geprueft wird, kann am kleinen still danebenliegen.
  {
    const { page, ctx, errs } = await wiedergabeOeffnen(browser, 'iPhone 13');
    const proben = await mitschreiben(page, 10);
    const g = proben[0].grenzen || {};
    check('5: am Telefon gelten die kleineren Deckel', g.MAXT > 0 && g.MAXT < 24, g);
    const summe = {};
    proben.forEach(z => Object.entries(z.geschossArten || {}).forEach(([k,v]) => { summe[k] = (summe[k]||0) + v; }));
    check('5: und es wird trotzdem mit allen Gattungen geschossen',
      (summe.spur||0) > 0 && ((summe.lanze||0) + (summe.schifftorpedo||0)) > 0, summe);
    const ueber = proben.filter(p => (p.vorraete.treffer > p.grenzen.MAXT) ||
                                     (p.vorraete.funken > p.grenzen.MAXF));
    check('5: kein Vorrat laeuft ueber den kleineren Deckel', ueber.length === 0,
      ueber.slice(0,2).map(p => ({ v: p.vorraete, g: p.grenzen })));
    check('keine JS-Fehler (Telefon)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
