// Kampf-Wiedergabe auf dem Handy und die Parteifarben (03.08.2026, Spieler-Report Sascha).
//
// ZWEI BEFUNDE AUS EINEM EINZIGEN BILDSCHIRMFOTO - beide entstanden dadurch, dass ich die
// neue Wiedergabe mit MUSTERFLOTTEN aus sechs Schiffsklassen geprueft hatte und mit einem
// Angriff statt einer Verteidigung. Saschas echter Spielstand deckte beides sofort auf.
//
//   1. DIE BUEHNE WAR AUF DEM HANDY NICHT ZU SEHEN. Die Bestandstafeln stehen dort im
//      normalen Fluss. Bei 22 Schiffsklassen PLUS 22 Abwehrarten sind das 44 Zeilen -
//      gemessen 880 px in einem 666 px hohen Fenster. Die Buehne begann bei y=934, also
//      vollstaendig unterhalb des Bildschirms. Vom Gefecht war NICHTS zu sehen.
//      Sechs Klassen passten noch; deshalb prueft dieser Test mit einer echten Spaetspiel-
//      Flotte, nicht mit einer bequemen.
//
//   2. DIE EIGENE FLOTTE FLOG IN GEGNERROT. KLASSEN[k].farbe wird beim ANLEGEN des Objekts
//      einmal aus F.an/F.ver gelesen; der Farbtausch fuer eingehende Ueberfaelle ("Gruen ist
//      im ganzen Spiel meins") aendert nur F.an/F.ver und erreichte die Rumpfbilder nie -
//      atlantenBauen() backt sie aber genau aus diesem Feld. Bei jedem eingehenden Ueberfall
//      war die eigene Verteidigung rot und der Angreifer gruen. Gemessen an den Bildpunkten
//      der Leinwand: vorher 2.704 rote / 0 gruene im Verband, nachher 0 / 907.
//
// Beide Punkte werden hier GEMESSEN, nicht am Quelltext behauptet: eine Regel, die im CSS
// steht, aber von einer spaeteren Regel ueberschrieben wird, bestuende jede Textpruefung.
// Genau das ist beim ersten Reparaturversuch passiert - der Medienblock lag vor den
// Grundregeln, und `align-items:flex-start` gewann.
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// Eine ECHTE Spaetspiel-Flotte: 22 Schiffsklassen, 20 Abwehrarten. Mit sechs Klassen waere
// dieser Test gruen und die Oberflaeche trotzdem kaputt.
const FLOTTE = { jaeger:152, cruisers:96, destroyers:2418, bomber:15, schlachtschiff:7234,
  superschlachtschiff:2, carrier:89, frachtergross:3324, recycler:283, spaeher:97, forscher:33,
  spionageschiff:164, enterschiff:196, colonyShips:71, waechter:10089, hyperbomber:33,
  hyperjaeger:24, quantenkreuzer:43, nanoklinge:40, metamaterialtitan:22, fusionsdreadnought:3,
  leerenjaeger:2, singularitaetsvernichter:6 };
const ABWEHR = { flak:55, turm:50, laser:45, ionenschild:39, raketen:33, gauss:29, bunker:29,
  voidbarriere:27, schild:25, plasma:21, railgun:20, resonanzschild:19, nanoplattform:13,
  sensorphalanx:12, schildkuppel:8, kiKern:6, fusionsbastion:5, panzerwall:5, kristallfestung:3,
  singularitaetsturm:1 };

// Eingehender Ueberfall: ICH stehe am Planeten (Seite D) und muss gruen sein.
const UEBERFALL = { id:'r1', ts:Date.now(), type:'raid', result:'win', faction:'Söldnerkonvoi',
  attackPower:41200, defensePower:23400, targetPlanet:'home',
  fleet:{ destroyers:179 }, destroyedShips:{ destroyers:31 },
  stationedFleet: FLOTTE, ownLostShips:{}, defenseBefore: ABWEHR };
// Eigener Angriff: ICH fliege an (Seite A) und muss ebenfalls gruen sein.
const ANGRIFF = { id:'a1', ts:Date.now(), type:'npc-attack', result:'win',
  npcName:'Kryllid-Nest (Stufe 5)', attackPower:90000, defensePower:40000,
  targetPlanet:'home', debrisPlanet:'home',
  fleet:{ schlachtschiff:3000, destroyers:1200, jaeger:4000 }, ownLostShips:{ jaeger:400 },
  npcFleet:{ jaeger:2000, cruisers:400 }, destroyedNpcShips:{ jaeger:2000, cruisers:250 } };

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

// Zaehlt je waagerechtem Band die deutlich roten und deutlich gruenen Bildpunkte.
// Band 0 = oben (Anflugbahn), Band 9 = unten (Planetenboden).
const BAENDER = 10;
const baender = page => page.evaluate((B) => {
  const cv = document.getElementById('osCv');
  if (!cv || !cv.width) return null;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const aus = [];
  for (let k = 0; k < B; k++){
    const y0 = Math.floor(cv.height*k/B), y1 = Math.floor(cv.height*(k+1)/B);
    let rot = 0, gruen = 0;
    for (let y = y0; y < y1; y += 3) for (let x = 0; x < cv.width; x += 3){
      const i = (y*cv.width+x)*4, R = d[i], G = d[i+1], Bl = d[i+2];
      if (R > 110 && R > G+45 && R > Bl+45) rot++;
      else if (G > 110 && G > R+40 && G > Bl+20) gruen++;
    }
    aus.push({ rot, gruen });
  }
  return aus;
}, BAENDER);
const summe = (b, von, bis, feld) => b.slice(von, bis+1).reduce((a, x) => a + x[feld], 0);

async function spielStarten(browser, berichte, wartezeit){
  const ctx = await browser.newContext(Object.assign({}, devices['iPhone 13']));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, berichte));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const x = document.getElementById('headerReportsBtn'); if (x) x.click(); });
  await page.waitForTimeout(1600);
  await page.evaluate(() => { const x = document.querySelector('[data-watch-battle]'); if (x) x.click(); });
  await page.waitForTimeout(wartezeit || 2500);
  return { page, errs, ctx };
}

(async () => {
  const browser = await starteBrowser();

  // ============================== 1) Die Buehne ist auf dem Handy zu sehen
  {
    const { page, errs, ctx } = await spielStarten(browser, [UEBERFALL]);
    const m = await page.evaluate(() => {
      const r = id => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { oben: Math.round(b.top), hoehe: Math.round(b.height) }; };
      return { fenster: window.innerHeight, kopf: r('osKopf'), buehne: r('osBuehne'), tafelD: r('osTafelD') };
    });
    // Der Kern des Befunds: Die Buehne begann UNTERHALB des Bildschirms.
    check('1: die Buehne beginnt im sichtbaren Bereich',
      m.buehne && m.buehne.oben < m.fenster * 0.55, { oben: m.buehne && m.buehne.oben, fenster: m.fenster });
    check('1: sie bekommt einen brauchbaren Anteil des Bildschirms (>= 30%)',
      m.buehne && m.buehne.hoehe >= m.fenster * 0.30,
      { hoehe: m.buehne && m.buehne.hoehe, anteil: m.buehne ? Math.round(m.buehne.hoehe/m.fenster*100)+'%' : '?' });
    // Die Tafel darf nicht ueber ihren Deckel hinauswachsen - vorher 874 px.
    check('1: die Bestandstafel bleibt gedeckelt und scrollt in sich',
      m.tafelD && m.tafelD.hoehe <= m.fenster * 0.32,
      { tafel: m.tafelD && m.tafelD.hoehe, deckel: Math.round(m.fenster*0.32) });
    check('1: der Kopfbereich sprengt das Fenster nicht', m.kopf && m.kopf.hoehe < m.fenster * 0.35, m.kopf);

    // Der Schalter muss die Buehne wirklich groesser machen - und die Leinwand mitwachsen.
    const vorher = m.buehne.hoehe;
    await page.evaluate(() => { const t = document.getElementById('osToggleTafeln'); if (t) t.click(); });
    await page.waitForTimeout(1200);
    const nach = await page.evaluate(() => {
      const b = document.getElementById('osBuehne').getBoundingClientRect();
      const cv = document.getElementById('osCv');
      let hell = 0;
      const d = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
      for (let i = 0; i < d.length; i += 4000) if (d[i] > 12 || d[i+1] > 12 || d[i+2] > 24) hell++;
      return { hoehe: Math.round(b.height), fenster: window.innerHeight, cvHoehe: cv.height, gemalt: hell };
    });
    check('1: „Listen" räumt die Bühne frei (>= 60% des Bildschirms)',
      nach.hoehe >= nach.fenster * 0.60, { vorher, nachher: nach.hoehe, anteil: Math.round(nach.hoehe/nach.fenster*100)+'%' });
    // Ohne Neumessung bliebe die Leinwand in der alten Groesse und das Bild waere verzerrt.
    check('1: die Leinwand wird dabei neu vermessen und zeichnet weiter',
      nach.cvHoehe > 0 && nach.gemalt > 100, { cvHoehe: nach.cvHoehe, gemalt: nach.gemalt });
    check('keine JS-Fehler (Handy-Aufbau)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 2) „Grün ist meins" - in BEIDE Richtungen
  {
    // Eingehender Ueberfall: meine Verteidigung steht am Planeten, in den Baendern
    // oberhalb des Bodens. Vor der Reparatur war dort 2.704 rot / 0 gruen.
    const { page, errs, ctx } = await spielStarten(browser, [UEBERFALL], 3000);
    const b = await baender(page);
    check('2: die Leinwand liefert Messwerte', Array.isArray(b) && b.length === BAENDER);
    if (b){
      const rot = summe(b, 3, 6, 'rot'), gruen = summe(b, 3, 6, 'gruen');
      check('2: beim eingehenden Überfall ist die EIGENE Verteidigung grün, nicht rot',
        gruen > 50 && gruen > rot * 3, { gruen, rot });
    }
    check('keine JS-Fehler (Überfall)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }
  {
    // Eigener Angriff: ich komme von aussen (obere Baender), der Gegner steht unten.
    const { page, errs, ctx } = await spielStarten(browser, [ANGRIFF], 9000);
    const b = await baender(page);
    if (b){
      const obenG = summe(b, 0, 2, 'gruen'), obenR = summe(b, 0, 2, 'rot');
      const untenR = summe(b, 4, 8, 'rot'), untenG = summe(b, 4, 8, 'gruen');
      check('2: beim eigenen Angriff fliegt die eigene Flotte grün heran',
        obenG > 50 && obenG > obenR * 3, { gruen: obenG, rot: obenR });
      check('2: und der Gegner steht in Rot am Planeten',
        untenR > 20 && untenR > untenG, { rot: untenR, gruen: untenG });
    }
    check('keine JS-Fehler (Angriff)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
