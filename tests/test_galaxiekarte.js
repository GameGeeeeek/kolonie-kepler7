// Eine Karte, zwei Zustände (v8.349.0).
//
// Bis v8.348.0 hatte der Sektorkarte-Reiter ZWEI Kartenkästen übereinander: oben die Galaxie
// (galaxyMapSvg, viewBox 950×500), unten das gewählte System (mapSvg, viewBox 700×230), dazwischen
// eine ◀/▶-Navigation. Jetzt gibt es einen Ausschnitt: ein Klick auf ein System fährt die Kamera
// hinein, und die Systemansicht wird als skalierte <g>-Gruppe an der Stelle des Knotens gezeichnet.
//
// Geprüft wird an der WIRKUNG, nicht an der Schreibweise:
//   1) Grundzustand: die Galaxie ist da, mapSvg gibt es nicht mehr
//   2) Klick öffnet: Systemebene entsteht, Kamera fährt hinein, Zurück-Knopf erscheint
//   3) Im offenen Zustand tragen die Nachbarn keinen Leuchthof mehr (sie sahen sonst wie Planeten aus)
//   4) Esc, Zurück-Knopf und Klick ins Leere schließen wieder
//   5) Mindestabstand: kein Systempaar liegt enger als 24 px - heute und im Vollausbau
//   6) Ein Systemplatz rückt nicht von der Stelle, wenn Systeme dazukommen (Versprechen aus v8.299.1)
//   7) Der Leuchthof schrumpft mit der Galaxiegröße, aber nicht unter die Untergrenze
//   8) Die Planeten im offenen System sind anklickbar (Erkundungsmission) und tragen echte Texturen
//   9) Der zweite Zoom/Pan-Block ist weg, und die Hilfe beschreibt die neue Bedienung
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI, ruhigeUhren } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const fs = require('fs');

const SAVE = JSON.stringify({ ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:22,mine:20,labor:14,lager:16,werft:14}, research:{}, fleet:{jaeger:600,spaeher:20,missions:[]},
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

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

// ---- Teil A: statisch am Quelltext ------------------------------------------------------------
function quelltext(){
  const src = fs.readFileSync(SPIELDATEI,'utf8');

  check('9: der zweite Zoom/Pan-Block ist entfernt', !/function initSystemMapZoomPan/.test(src));
  check('9: es gibt kein zweites Karten-SVG mehr', !/id="mapSvg"/.test(src));
  check('9: und keinen zweiten Kartenausschnitt-Zustand', !/let mapViewBox\s*=/.test(src) && !/function clampMapViewBox/.test(src));
  // Der Ausschnitt der Systemansicht darf nicht mehr in buildMap gesetzt werden - eine <g>-Gruppe
  // kennt kein viewBox-Attribut, die Zeile hätte also stillschweigend gar nichts getan.
  check('9: buildMap zeichnet in die Gruppe der Galaxiekarte', /getElementById\('galaxySystemLayer'\)/.test(src));

  // Die Hilfe MUSS die neue Bedienung beschreiben. Das ist der wiederkehrende Fehler dieses Projekts:
  // die Mechanik stimmt, eine zweite Anzeigestelle behält die alte Annahme.
  const hilfe = (src.match(/\{ title:'Sektorkarte bedienen', body:'([\s\S]*?)' \},/)||[])[1] || '';
  // Seit KB-4 (nur noch Sektoren-Karte) heißt der Weg "Tipp auf ein System" - die REGEL bleibt:
  // die Hilfe muss benennen, wie man ein System öffnet.
  check('9: die Hilfe nennt den Klick/Tipp auf ein System', /Tipp auf ein System|Klick auf ein System|Klick ein System/.test(hilfe), hilfe.slice(0,60));
  check('9: die Hilfe nennt den Weg zurück', /Esc/.test(hilfe));
  check('9: die Hilfe behauptet nicht mehr zwei Karten übereinander',
    !/Galaxie-Übersicht oben als auch die Einzelsystem-Ansicht darunter/.test(src));
  const hint = (src.match(/karte: \{ icon:'ti-map-2'[\s\S]*?text:'([\s\S]*?)' \}/)||[])[1] || '';
  check('9: der Reiter-Hinweis nennt sie ebenfalls', /Klick ein System an|Klick auf ein System/.test(hint), hint.slice(0,60));
  const tut = (src.match(/title:'Erkunden & Kolonisieren', text:'([\s\S]*?)' \}/)||[])[1] || '';
  check('9: das Tutorial ebenso', /Tipp auf ein System|Klick ein System an|Klick auf ein System/.test(tut), tut.slice(0,60));

  check('9: der Mindestabstand steht als benannte Konstante im Code', /const GALAXY_MIN_NODE_DIST = 24;/.test(src));
  check('9: der Leuchthof-Faktor hat eine eigene Funktion', /function galaxyNodeScale\(\)/.test(src));
  // Der offene Zustand darf NICHT gespeichert werden - er ist Bedienzustand, kein Spielstand.
  check('9: der offene Zustand landet nicht im Spielstand', !/state\.galaxyOpenSystem/.test(src));
}

// ---- Teil B: Rechnen mit dem echten Layout ------------------------------------------------------
function layoutPruefen(){
  const src = fs.readFileSync(SPIELDATEI,'utf8');
  const hol = (name) => {
    const m = src.match(new RegExp('function '+name+'\\([\\s\\S]*?\\n  \\}\\n'));
    if (!m) throw new Error('Funktion nicht gefunden: '+name);
    return m[0];
  };
  const ids = [...src.slice(src.indexOf('const STAR_SYSTEMS = ['), src.indexOf('const TERRAFORM_TARGET_TYPES')).matchAll(/\bid:\s*'([^']+)'/g)].map(m=>m[1]);
  const BASE = ids.length;
  const WEEKLY = +(src.match(/const WEEKLY_SYSTEM_MAX = (\d+);/)||[])[1];
  const umgebung = {
    BASE_STAR_SYSTEM_COUNT: BASE,
    GALAXY_SPIRAL_SLOTS: BASE + WEEKLY,
    GALAXY_SPIRAL_RMAX: +(src.match(/const GALAXY_SPIRAL_RMAX = (\d+);/)||[])[1],
    GALAXY_GOLDEN_ANGLE: +(src.match(/const GALAXY_GOLDEN_ANGLE = ([\d.]+);/)||[])[1],
    GALAXY_MIN_NODE_DIST: +(src.match(/const GALAXY_MIN_NODE_DIST = (\d+);/)||[])[1],
    STAR_SYSTEMS: ids.map(id=>({id}))
  };
  const code = [hol('hashStringToFloat'), hol('galaxyRelax'), hol('galaxySlotPositions'), hol('galaxyNodeScale')].join('\n');
  const bauen = new Function('u', `
    const {BASE_STAR_SYSTEM_COUNT, GALAXY_SPIRAL_SLOTS, GALAXY_SPIRAL_RMAX, GALAXY_GOLDEN_ANGLE, GALAXY_MIN_NODE_DIST} = u;
    let STAR_SYSTEMS = u.STAR_SYSTEMS;
    let galaxySlotCache = null;
    ${code}
    return { plaetze: galaxySlotPositions(), skala: (n) => { STAR_SYSTEMS = new Array(n).fill(0).map((_,i)=>({id:'s'+i})); return galaxyNodeScale(); } };
  `);
  const r = bauen(umgebung);
  const p = r.plaetze;

  check('5: alle Plätze der vollen Galaxie sind berechnet', p.length === umgebung.GALAXY_SPIRAL_SLOTS, p.length);
  let min = Infinity, eng = 0;
  for (let i=0;i<p.length;i++) for (let j=i+1;j<p.length;j++){
    const d = Math.hypot(p[i].x-p[j].x, p[i].y-p[j].y);
    if (d < min) min = d;
    if (d < umgebung.GALAXY_MIN_NODE_DIST - 0.01) eng++;
  }
  check('5: kein Platzpaar liegt enger als der Mindestabstand', eng === 0, { min:+min.toFixed(2), eng });
  // Vor dem Umbau war der kleinste Abstand 6,9 px - genau die Zahl, die den Umbau ausgelöst hat.
  check('5: und der kleinste Abstand ist deutlich größer als die 6,9 px von vorher', min > 20, +min.toFixed(2));
  check('5: alle Plätze liegen im Feld', p.every(o => o.x>=17.9 && o.x<=932.1 && o.y>=17.9 && o.y<=482.1));

  // 6) Die Plätze hängen NUR an der Platznummer. Ein zweiter Aufbau mit mehr Systemen im Array darf
  //    dieselben Zahlen liefern - sonst würde ein neues Wochensystem die bestehenden verschieben.
  const r2 = bauen(Object.assign({}, umgebung, {
    STAR_SYSTEMS: umgebung.STAR_SYSTEMS.concat(new Array(40).fill(0).map((_,i)=>({id:'neu'+i})))
  }));
  const verschoben = p.filter((o,i) => Math.hypot(o.x-r2.plaetze[i].x, o.y-r2.plaetze[i].y) > 0.001).length;
  check('6: kein Platz rückt von der Stelle, wenn 40 Systeme dazukommen', verschoben === 0, verschoben);

  // 7) Leuchthof-Faktor
  const s69 = r.skala(umgebung.BASE_STAR_SYSTEM_COUNT), sVoll = r.skala(umgebung.GALAXY_SPIRAL_SLOTS);
  check('7: bei heutiger Galaxiegröße bleibt der Leuchthof unverändert', Math.abs(s69-1) < 1e-9, s69);
  check('7: im Vollausbau ist er rund halb so groß', sVoll > 0.42 && sVoll < 0.6, +sVoll.toFixed(3));
  check('7: er fällt nie unter die Untergrenze', r.skala(100000) >= 0.42, r.skala(100000));
  check('7: er wird nie größer als 1', r.skala(5) <= 1, r.skala(5));
}

// ---- Teil C: im Browser ------------------------------------------------------------------------
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
  // Startfenster stapeln sich - alle wegklicken, sonst liegt eins über der Karte.
  for (let i=0;i<6;i++){
    const zu = await page.evaluate(()=>{
      const b=[...document.querySelectorAll('button')].find(x=>/Weiter geht|Verstanden|Schlie.en|Alles klar/i.test(x.textContent||'') && x.offsetParent);
      if(b){ b.click(); return true; } return false;
    });
    if (!zu) break;
    await page.waitForTimeout(400);
  }
  await page.evaluate(()=>{ const b=document.querySelector('.tab-btn[data-tab="karte"]'); if(b) b.click(); });
  await page.waitForTimeout(1500);

  // Seit KB-4 ist die Sektoren-Karte die einzige Karte: Der Grundzustand ist die Übersicht mit
  // den Sektorregionen, keine Systemknoten mehr (die zeichnet erst die geöffnete Systemebene).
  const grund = await page.evaluate(()=>{
    const svg = document.getElementById('galaxyMapSvg');
    return { galaxie: !!svg, zweiteKarte: !!document.getElementById('mapSvg'),
             regionen: svg ? svg.querySelectorAll('[data-sektor]').length : 0,
             ebene: !!document.getElementById('galaxySystemLayer'),
             zurueck: (document.getElementById('galaxyBackBtn')||{}).style ? document.getElementById('galaxyBackBtn').style.display : 'fehlt' };
  });
  check('1: die Galaxiekarte ist da', grund.galaxie);
  check('1: es gibt keine zweite Karte mehr', !grund.zweiteKarte);
  check('1: der Grundzustand ist die Sektoren-Übersicht', grund.regionen >= 1, grund.regionen);
  check('1: im Grundzustand ist kein System aufgeklappt', !grund.ebene);
  check('1: und der Zurück-Knopf ist verborgen', grund.zurueck === 'none', grund.zurueck);

  // 2) Öffnen - auf dem Spielerweg: Übersicht -> Region -> System (Helfer aus lib/karte)
  const geoeffnet = await oeffneSystemUeberSektoren(page, 'kepler');
  check('2: das Heimatsystem lässt sich über die Sektoren öffnen', geoeffnet);
  await page.waitForTimeout(600);
  const auf = await page.evaluate(()=>{
    const svg = document.getElementById('galaxyMapSvg');
    const g = document.getElementById('galaxySystemLayer');
    const vb = svg.getAttribute('viewBox').split(' ').map(Number);
    return { ebene: !!g, planeten: g ? g.querySelectorAll('[data-planet]').length : 0,
             texturen: g ? g.querySelectorAll('image').length : 0,
             sonne: g ? g.querySelectorAll('circle').length : 0,
             breite: vb[2],
             // KB-20: Statt einer festen Spanne die EIGENSCHAFT messen, die die Spanne meinte -
             // "die Kamera zeigt EIN System, und zwar vollstaendig". Die untere Schranke 300 war
             // auf die flache Zeichnung kalibriert; seit die Bahnen am hohen Kasten rund liegen,
             // ist der korrekte Ausschnitt 284 Einheiten breit, und der Test fiel auf richtigem
             // Code durch (Hausregel 3: die Regel pruefen, nicht die Momentaufnahme).
             ausserhalb: (()=>{
               const kasten = svg.getBoundingClientRect();
               return [...(g ? g.querySelectorAll('[data-planet] image, [data-planet] circle') : [])]
                 .map(e => e.getBoundingClientRect()).filter(b => b.width > 0)
                 .filter(b => b.left < kasten.left - 1 || b.right > kasten.right + 1
                           || b.top < kasten.top - 1 || b.bottom > kasten.bottom + 1).length;
             })(),
             zurueck: document.getElementById('galaxyBackBtn').style.display,
             // Die Nachbarn dürfen im offenen Zustand keinen Leuchthof mehr tragen.
             hoefe: [...svg.querySelectorAll('[data-system-node] circle')].filter(c => /miniSunGlow/.test(c.getAttribute('fill')||'')).length,
             knoten: svg.querySelectorAll('[data-system-node]').length };
  });
  check('2: das System ist aufgeklappt', auf.ebene);
  check('2: seine Planeten sind gezeichnet', auf.planeten >= 5, auf.planeten);
  check('2: und tragen die echten Planetentexturen', auf.texturen >= 5, auf.texturen);
  // Das Galaxie-Gesamtfeld ist 950 Einheiten breit - alles deutlich darunter heisst "ein System".
  check('2: die Kamera ist hineingefahren', auf.breite < 500, auf.breite);
  check('2b: und zeigt das System vollstaendig, nichts ist abgeschnitten', auf.ausserhalb === 0,
    { ausserhalb: auf.ausserhalb, ausschnittBreite: auf.breite });
  check('2: der Zurück-Knopf ist sichtbar', auf.zurueck !== 'none', auf.zurueck);
  check('3: die Nachbarsysteme sind noch da', auf.knoten > 30, auf.knoten);
  check('3: aber keiner von ihnen trägt einen Leuchthof', auf.hoefe === 0, auf.hoefe);

  // 8) Ein Planet muss anklickbar sein und eine Erkundungsmission auslösen
  const vorher = await page.evaluate(()=>document.querySelectorAll('#galaxySystemLayer [data-planet]').length);
  const klickbar = await page.evaluate(()=>{
    const n = [...document.querySelectorAll('#galaxySystemLayer [data-planet]')].find(x => x.getAttribute('data-planet') !== '__home__');
    if (!n) return false;
    n.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    return true;
  });
  await page.waitForTimeout(700);
  const nachKlick = await page.evaluate(()=>({
    // Der Klick darf das System NICHT zuziehen (der Klick-ins-Leere-Handler muss ihn durchlassen).
    offen: !!document.getElementById('galaxySystemLayer'),
    planeten: document.querySelectorAll('#galaxySystemLayer [data-planet]').length
  }));
  check('8: ein Planet ist anklickbar', klickbar);
  check('8: und der Klick zieht das System nicht zu', nachKlick.offen, nachKlick);
  check('8: die Planeten sind danach noch da', nachKlick.planeten === vorher, [vorher, nachKlick.planeten]);

  // 4) Schließen über Esc
  // Der Planetenklick oben öffnet seit v8.353.0 das Kartenmenü, und Esc gehört dann zuerst DEM
  // (siehe tests/test_kartenmenue.js): Ein Tastendruck darf nicht Menü und System auf einmal
  // schließen, sonst verliert man beim Verlassen eines versehentlich geöffneten Menüs nebenbei
  // das aufgeklappte System. Hier wird das Menü deshalb erst weggeklickt, bevor Esc dem System
  // gilt - der Test prüft weiterhin genau das, was er immer geprüft hat.
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check('4: der erste Esc gilt dem Kartenmenü und lässt das System offen',
    await page.evaluate(()=>!document.querySelector('.kmenu') && !!document.getElementById('galaxySystemLayer')));
  // 5) Am gezeichneten Markup nachmessen (nicht nur gerechnet) - SOLANGE das System offen ist:
  //    nur die Systemebene zeichnet [data-system-node]; nach dem Schließen steht seit KB-4 die
  //    Sektoransicht, und dort gibt es diese Knoten nicht mehr.
  const gemessen = await page.evaluate(()=>{
    const kn = [...document.querySelectorAll('#galaxyMapSvg [data-system-node]')];
    const p = kn.map(n => { const c = n.querySelector('circle'); return { x:+c.getAttribute('cx'), y:+c.getAttribute('cy') }; });
    let min = Infinity;
    for (let i=0;i<p.length;i++) for (let j=i+1;j<p.length;j++){
      const d = Math.hypot(p[i].x-p[j].x, p[i].y-p[j].y); if (d < min) min = d;
    }
    return { anzahl:p.length, min:+min.toFixed(1) };
  });
  // Die Koordinaten stehen im Markup auf eine Nachkommastelle gerundet, deshalb 23.8 statt 24.
  check('5: auch im gezeichneten Markup liegt kein Paar zu eng', gemessen.min >= 23.8, gemessen);

  await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
  // Seit KB-4 führt das Zuklappen nicht mehr auf die Freiflug-Galaxie hinaus, sondern in die
  // Sektoransicht der Region des Systems - die Kamera-/Ausschnitt-Prüfungen von früher sind
  // durch die Prüfung "die Sektoransicht steht" ersetzt.
  const zu1 = await page.evaluate(()=>({ ebene: !!document.getElementById('galaxySystemLayer'),
    sektorSys: document.querySelectorAll('#galaxyMapSvg [data-sektor-sys]').length,
    zurueck: document.getElementById('galaxyBackBtn').style.display }));
  check('4: Esc klappt das System wieder zu', !zu1.ebene);
  check('4: und führt in die Sektoransicht der Region', zu1.sektorSys >= 1, zu1.sektorSys);
  check('4: und der Zurück-Knopf verschwindet', zu1.zurueck === 'none', zu1.zurueck);

  // 4b) Schließen über den Zurück-Knopf (Öffnen jetzt über den Systemknoten der Sektoransicht)
  await page.evaluate(()=>{ document.querySelector('#galaxyMapSvg [data-sektor-sys="kepler"]').dispatchEvent(new MouseEvent('click',{bubbles:true})); });
  await page.waitForTimeout(1200);
  await page.evaluate(()=>document.getElementById('galaxyBackBtn').click());
  await page.waitForTimeout(1200);
  check('4: der Zurück-Knopf schließt ebenfalls', await page.evaluate(()=>!document.getElementById('galaxySystemLayer')));

  check('Keine Konsolenfehler auf der Karte', errs.length === 0, errs.slice(0,3));
  await ctx.close(); await browser.close();
}

(async () => {
  quelltext();
  layoutPruefen();
  await imBrowser();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
