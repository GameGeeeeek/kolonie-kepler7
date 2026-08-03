// Schiffe und Anlagen IM KAMPFBERICHT (04.08.2026, Spieler-Wunsch Sascha:
// „die Icons, die wir haben, dort wiederverwenden").
//
// AUSGANGSLAGE: Der Bericht listete Flotten als reinen Text - „179x Zerstörer, 3.324x Großer
// Frachter". Das Spiel führt für jedes der 40 Schiffe längst ein gezeichnetes Modell
// (SHIP_HULL_DEFS/drawShipMiniIcon), und seit v8.394.0 fliegt es damit auch in der
// Kampf-Wiedergabe. Der Bericht war die letzte Stelle ohne Bild.
//
// ZWEI DINGE, DIE HIER SCHIEFGEHEN KÖNNEN, und beide sind schon einmal passiert:
//
//   1. DIE BILDER KOMMEN NICHT AN. Ein Icon, das nur im Markup steht, aber leer bleibt, sieht in
//      keiner Quelltextprüfung anders aus als eines, das gezeichnet wurde. Deshalb wird der
//      GERECHNETE Stil gelesen (background-image) statt der Quelltext.
//
//   2. ES WIRD ZU TEUER. Der erste Anlauf setzte je Zeile eine eigene <canvas>. Gemessen mit dem
//      echten Deckel des Backends (40 Berichte, volle Flotte): 2.000 Leinwände auf einer Seite.
//      Jetzt wird jedes Schiff EINMAL gebacken und als CSS-Klasse geteilt - aus 2.000 Leinwänden
//      werden rund 25 Bilder. Dieser Test hält die Grenze fest, sonst schleicht sich die alte
//      Lösung beim nächsten Umbau wieder ein.
//
// Dazu die Ehrlichkeitsregel aus der Wiedergabe: Die GEGENSEITE wird ohne meinen
// Flotten-Anstrich und ohne meine Werftmarken gemalt. Das ist prüfbar, weil beides den
// Klassennamen ändert - meine Schiffe tragen ihn, fremde nicht.
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const FLOTTE = { jaeger:152, cruisers:96, destroyers:2418, bomber:15, schlachtschiff:7234,
  superschlachtschiff:2, carrier:89, frachtergross:3324, recycler:283, spaeher:97, forscher:33,
  spionageschiff:164, enterschiff:196, colonyShips:71, waechter:10089, hyperbomber:33,
  hyperjaeger:24, quantenkreuzer:43, nanoklinge:40, metamaterialtitan:22, fusionsdreadnought:3,
  leerenjaeger:2, singularitaetsvernichter:6 };
// Nur echte Gebäudeschlüssel - ein erfundener würde die Bildprüfung fälschlich rot machen.
const ABWEHR = { flak:55, turm:50, laser:45, ionenschild:39, raketen:33, gauss:29, bunker:29,
  voidbarriere:27, schild:25, plasma:21, railgun:20, resonanzschild:19, nanoplattform:13,
  sensorphalanx:12, schildkuppel:8, fusionsbastion:5, festung:3, singularitaetsturm:1 };

const NPC = { id:'n1', time:Date.now(), ts:Date.now(), type:'npc-attack', result:'win',
  npcName:'Kryllid-Nest', npcLevel:5, attackPower:90000, defensePower:40000, chancePct:71,
  targetPlanet:'home', debrisPlanet:'home', flightTime:600,
  fleet:{ schlachtschiff:3000, destroyers:1200, jaeger:4000, hyperbomber:12 },
  ownLostShips:{ jaeger:400, destroyers:22 },
  npcFleet:{ jaeger:2000, cruisers:400 }, destroyedNpcShips:{ jaeger:2000, cruisers:250 } };
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
const save = (extra) => JSON.stringify(Object.assign({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
  buildings:Object.assign({solar:22,mine:20,labor:14,lager:30,werft:14}, ABWEHR),
  research:{rkampf:9}, fleet:Object.assign({missions:[]}, FLOTTE), colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, battleStats:{wins:99,losses:2}, xp:9e5, credits:5e5,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} }, extra||{}));

async function berichteOeffnen(browser, berichte, extra, geraet){
  const ctx = await browser.newContext(geraet ? Object.assign({}, devices[geraet]) : { viewport:{width:1400,height:1000} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save(extra) }, berichte));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3600);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  await page.evaluate(() => { const x=document.getElementById('headerReportsBtn'); if(x)x.click(); });
  await page.waitForTimeout(2200);
  return { page, errs, ctx };
}

// Liest den GERECHNETEN Stil, nicht das Markup: Ein Kasten ohne Hintergrundbild sieht im
// Quelltext genauso aus wie einer mit.
const messen = page => page.evaluate(() => {
  const box = document.getElementById('reportsBox');
  const mitBild = el => /url\(/.test(getComputedStyle(el).backgroundImage || '');
  const schiffe = Array.from(box.querySelectorAll('i.gbi-schiff'));
  const anlagen = Array.from(box.querySelectorAll('i.gbi-anlage'));
  const stil = document.getElementById('gebackeneBildStile');
  return {
    schiffe: schiffe.length, schiffeMitBild: schiffe.filter(mitBild).length,
    anlagen: anlagen.length, anlagenMitBild: anlagen.filter(mitBild).length,
    // Ohne Canvas-Grafik greift der SVG-Rückfall (nur der Resonanzschild-Emitter).
    svgRueckfall: box.querySelectorAll('.schiffchip .anlagensvg svg').length,
    gebacken: stil ? stil.childNodes.length : 0,
    klassen: schiffe.map(e => Array.from(e.classList).find(c => c.startsWith('gbi-s-'))).filter(Boolean),
    ueberlauf: box.scrollWidth - box.clientWidth,
    // Die Namen bleiben stehen - ein Icon allein wäre auf dem Handy raten müssen.
    text: box.textContent.replace(/\s+/g,' ')
  };
});

(async () => {
  const browser = await starteBrowser();

  // ============================== 1) Die Bilder sind wirklich da
  {
    const { page, errs, ctx } = await berichteOeffnen(browser, [NPC, UEBERFALL]);
    const m = await messen(page);
    check('1: der Bericht zeigt überhaupt Schiffsbilder', m.schiffe > 0, { stellen: m.schiffe });
    check('1: und JEDES davon trägt wirklich ein Bild', m.schiffe > 0 && m.schiffeMitBild === m.schiffe,
      { mitBild: m.schiffeMitBild, stellen: m.schiffe });
    check('1: die Verteidigungsanlagen ebenso', m.anlagen > 0 && m.anlagenMitBild === m.anlagen,
      { mitBild: m.anlagenMitBild, stellen: m.anlagen });
    // Der Resonanzschild-Emitter ist die einzige Anlage mit SVG statt Canvas-Grafik. Er darf
    // deshalb nicht bildlos dastehen - dafür gibt es den Rückfall auf sein ICONS-SVG.
    check('1: die eine Anlage ohne Canvas-Grafik fällt auf ihr SVG zurück', m.svgRueckfall >= 1,
      { svgRueckfall: m.svgRueckfall });
    // Der Text darf NICHT verschwunden sein.
    check('1: die Stückzahlen und Namen stehen weiterhin da',
      /Zerstörer/.test(m.text) && /179/.test(m.text) && /Flak-Batterie/.test(m.text));
    check('1: nichts läuft seitlich aus dem Kasten', m.ueberlauf <= 0, { ueberlauf: m.ueberlauf });
    check('keine JS-Fehler (Bericht)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 2) Fremde Flotte ohne meinen Anstrich und ohne meine Marken
  // Dieselbe Regel wie im Fremdprofil und in der Kampf-Wiedergabe. Prüfbar, weil beides im
  // Klassennamen steckt: eigene Schiffe tragen Anstrich+Markenstufe, fremde tragen ein „f".
  {
    const { page, errs, ctx } = await berichteOeffnen(browser, [NPC], { shipMarks:{ jaeger:8, destroyers:5 } });
    const m = await messen(page);
    const eigen = m.klassen.filter(k => !/-f$/.test(k));
    const fremd = m.klassen.filter(k => /-f$/.test(k));
    check('2: es sind beide Seiten im Bild (eigene UND fremde Schiffe)',
      eigen.length > 0 && fremd.length > 0, { eigen: eigen.length, fremd: fremd.length });
    check('2: die eigene Flotte trägt ihre Werftmarke im Bild',
      eigen.some(k => /jaeger/.test(k) && /8/.test(k)), eigen.slice(0,4));
    check('2: die Gegenseite trägt sie NICHT', fremd.every(k => /-f$/.test(k)), fremd.slice(0,4));
    check('keine JS-Fehler (Ehrlichkeit)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 3) Der Preis bleibt gedeckelt
  // 40 Berichte ist der echte Deckel des Backends (server.js: list.slice(0, 40)). Mit einer
  // Leinwand je Zeile wären das 2.000 Stück; geteilte Bilder machen daraus rund 25.
  {
    const viele = [];
    for (let i = 0; i < 40; i++) viele.push(Object.assign({}, NPC, { id:'n'+i, time:Date.now()-i*60000,
      fleet: FLOTTE, ownLostShips: FLOTTE }));
    const { page, errs, ctx } = await berichteOeffnen(browser, viele, null, 'iPhone 13');
    const m = await messen(page);
    check('3: bei 40 Berichten stehen viele Bildstellen im Dokument', m.schiffe > 500, { stellen: m.schiffe });
    check('3: aber nur eine Handvoll Bilder dahinter (geteilt statt je Zeile gebacken)',
      m.gebacken > 0 && m.gebacken <= 90, { gebacken: m.gebacken, stellen: m.schiffe });
    check('3: und sie sind trotzdem alle sichtbar', m.schiffeMitBild === m.schiffe,
      { mitBild: m.schiffeMitBild, stellen: m.schiffe });
    check('3: nichts läuft auf dem Handy seitlich hinaus', m.ueberlauf <= 0, { ueberlauf: m.ueberlauf });
    check('keine JS-Fehler (40 Berichte)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
