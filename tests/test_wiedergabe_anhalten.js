// Die Bildrolle der Kampf-Wiedergabe haelt an, wenn sich nichts mehr bewegt (05.08.2026).
//
// AUSGANGSLAGE: requestAnimationFrame lief IMMER weiter. hudAktualisieren/phasenAktualisieren/
// bannerSchritt/zeichne() standen ausserhalb von `if (laeuft)`, also wurde auch bei Pause und
// beim stehenden Schlussbild 60-mal je Sekunde eine vollstaendige Leinwand gemalt. Gemessen mit
// gehakten 2D-Aufrufen: die PAUSE war mit 59,0 Vollbildern/s und 34.265 drawImage/s sogar TEURER
// als das laufende Gefecht (55,5 / 19.718) - das Bild friert im Moment der groessten Objektzahl
// ein, und genau die wurden weiter gemalt, ohne dass sich ein Bildpunkt aenderte.
//
// WARUM DIESER TEST WICHTIGER IST ALS DIE ERSPARNIS: Eine Bildrolle, die anhaelt, muss auch
// wieder anlaufen. Der gefaehrliche Fehler ist nicht "sie malt zu viel", sondern "sie malt gar
// nicht mehr" - ein eingefrorenes Gefecht ist schlimmer als ein verschwendetes Watt. Beim Bau
// dieser Aenderung ist genau das passiert: Eine Groessenaenderung im pausierten Zustand liess
// das Standbild in der ALTEN Groesse stehen (messenNoetig wird nur in schleife() eingeloest,
// und die stand). Gefangen hat es die Gegenprobe mit dem Leinwand-Fingerabdruck - deshalb steht
// sie hier als Abschnitt 3.
//
// GEMESSEN WIRD DAS ZEICHNEN SELBST, nicht der Quelltext: Der Test haengt sich in clearRect auf
// der Buehnen-Leinwand und zaehlt die Vollbilder. Eine Pruefung auf "requestAnimationFrame steht
// im if-Zweig" waere wertlos - genau die Zeile kann stimmen, waehrend ein anderer Bedienweg die
// Rolle nie weckt.
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const FLOTTE = { jaeger:152, destroyers:2418, schlachtschiff:7234, frachtergross:3324,
  waechter:10089, recycler:283, kreuzer:96, bomber:40 };
const ABWEHR = { flak:55, turm:50, laser:45, raketen:33, gauss:29, schild:25, plasma:21 };
const UEBERFALL = { id:'r1', time:Date.now(), ts:Date.now(), type:'raid', result:'win',
  faction:'Söldnerkonvoi', attackPower:41200, defensePower:23400, targetPlanet:'home',
  fleet:{ destroyers:179 }, destroyedShips:{ destroyers:31 },
  stationedFleet: FLOTTE, ownLostShips:{}, defenseBefore: ABWEHR };

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
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

// Vollbilder zaehlen: clearRect auf der Buehnen-Leinwand laeuft genau einmal je gezeichnetem Bild.
const haken = () => {
  const c = document.querySelector('#osBuehne canvas');
  const ctx = c.getContext('2d');
  window.__n = 0;
  const o = ctx.clearRect.bind(ctx);
  ctx.clearRect = function(){ window.__n++; return o.apply(null, arguments); };
};
async function bilder(page, ms){
  await page.evaluate(() => { window.__n = 0; });
  await page.waitForTimeout(ms);
  return page.evaluate(() => window.__n);
}
// Grobe Prüfsumme der Leinwand - erkennt, OB neu gemalt wurde, ohne Bildvergleich.
const fingerabdruck = page => page.evaluate(() => {
  const c = document.querySelector('#osBuehne canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0; for (let i = 0; i < d.length; i += 997) h = (h * 31 + d[i]) | 0;
  return h;
});

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{width:1200,height:900} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, [UEBERFALL]));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3600);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  await page.evaluate(() => { const x=document.getElementById('headerReportsBtn'); if(x)x.click(); });
  await page.waitForTimeout(1600);
  await page.evaluate(() => { const x=document.querySelector('[data-watch-battle]'); if(x)x.click(); });
  await page.waitForTimeout(2500);
  await page.evaluate(haken);

  // ============================== 1) Das laufende Gefecht malt, die Pause nicht
  check('1: im laufenden Gefecht wird gemalt', await bilder(page, 1500) > 30);
  await page.click('#osBtnPause');
  await page.waitForTimeout(300);
  check('1: bei Pause steht die Bildrolle vollstaendig still', await bilder(page, 1500) === 0);

  // ============================== 2) Sie laeuft ueber JEDEN Bedienweg wieder an
  // Zwei Wege zum selben Zustand - der Knopf und die Leertaste. Ein Weckruf, der nur an
  // einem der beiden haengt, faellt beim anderen nicht auf, bis ein Spieler ihn benutzt.
  await page.click('#osBtnPause');
  await page.waitForTimeout(200);
  check('2: „Weiter" weckt sie wieder', await bilder(page, 1500) > 30);

  await page.click('#osBtnPause'); await page.waitForTimeout(300);
  check('2: Pause wirkt auch beim zweiten Mal', await bilder(page, 1200) === 0);
  await page.keyboard.press(' ');
  await page.waitForTimeout(200);
  check('2: die Leertaste weckt sie ebenfalls', await bilder(page, 1200) > 25);

  // ============================== 3) Groessenaenderung im STEHENDEN Zustand
  // Der Fehler, der beim Bau wirklich auftrat: messenNoetig wird nur in schleife() eingeloest,
  // und die stand. Die Leinwand behielt ihre alte Groesse im neuen Rahmen - verzerrtes Bild.
  await page.click('#osBtnPause'); await page.waitForTimeout(300);
  const vorher = await fingerabdruck(page);
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForTimeout(900);
  const nachher = await fingerabdruck(page);
  check('3: das Standbild wird nach einer Groessenaenderung neu gemalt',
    vorher !== nachher, { vorher, nachher });
  check('3: danach steht die Rolle wieder still', await bilder(page, 1200) === 0);

  // ============================== 4) Neustart und Schlussbild
  await page.click('#osBtnNeustart');
  await page.waitForTimeout(200);
  check('4: „Neustart" weckt sie wieder', await bilder(page, 1200) > 25);

  await page.click('#osBtnEnde');
  // „Ans Ende" spult nur bis T_BILANZ+0,6 (43,2 s) vor; bis T_SCHLUSS (50,5 s) laeuft die
  // Rolle bei Tempo 1 noch gut sieben Sekunden weiter. Wer hier zu frueh misst, misst den
  // Nachlauf und haelt ihn faelschlich fuer ein nicht anhaltendes Schlussbild.
  await page.waitForTimeout(11000);
  check('4: das stehende Schlussbild malt nicht weiter', await bilder(page, 1500) === 0);
  await page.click('#osBtnNeustart');
  await page.waitForTimeout(200);
  check('4: und auch daraus weckt „Neustart" sie wieder', await bilder(page, 1200) > 25);

  check('keine JS-Fehler', errs.length === 0, errs.slice(0,3));
  await ctx.close(); await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
