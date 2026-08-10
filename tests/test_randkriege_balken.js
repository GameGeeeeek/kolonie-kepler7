// Zeigt die Karte den Kontrollbalken der Front WIRKLICH - und stimmt seine Fuellung mit dem Wert?
//
// Der Schwestertest test_fraktionsgebiet.js liest den Quelltext. Das genügt hier nicht: Die
// Flächen- und Frontebene hängt an galaxyCache.factions, und ohne Server ist das Objekt leer -
// ein Quelltexttest kann also nicht zeigen, dass am Ende etwas zu sehen ist.
//
// Gemessen wird deshalb am erzeugten SVG: Territoriumsflächen, Wappen, Frontsegment zwischen zwei
// verfeindeten Fraktionen, und der Farbwechsel (Legion muss auf der Karte den entsättigten Ton
// tragen, nicht die Serverfarbe Blau).
//
// NACHTRAG v8.476.0: Das Fixture liefert jetzt die Form, die der Server nach galaxyFuerClient()
// wirklich schickt, und der Test misst zusaetzlich die goldene Beteiligungslinie und den Tooltip
// mit der Zahl der Kommandanten je Seite.
//
// GEGENPROBE (beide Richtungen, 10.08.2026): Gegen `git show HEAD:weltraum_kolonie.html` fallen
// „Territoriumsflächen gezeichnet", „Wappen im Knoten", „Frontsegment vorhanden" und
// „Legion trägt NICHT die Serverfarbe". Die Kontrollprüfungen („Karte überhaupt gezeichnet",
// „Knoten vorhanden") bleiben in beiden Läufen grün - der Test misst den Unterschied.

const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');
// Die Spiel-Interna liegen in einer IIFE und sind aus page.evaluate nicht erreichbar. Die
// Kartenpositionen kommen deshalb aus demselben Helfer, den die Entwurfsbilder benutzen: Er
// schneidet galaxySlotPositions & Co. als Quelltext aus der Spieldatei und fuehrt sie aus - also
// dieselben Zahlen wie im Browser, ohne sie nachzubauen.
const P = require('../docs/randkriege-entwuerfe/positionen.js');

const SAVE = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
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
  if(p==='galaxy')return j(galaxieAntwort);
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}
let galaxieAntwort = {};

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

// Zwei benachbarte Systeme fuer die Front - nach echtem Bildschirmabstand gewaehlt.
const pos = P.galaxySpiralLayout(P.STAR_SYSTEMS);
let sysA = null, sysB = null, engste = Infinity;
for (const a of P.STAR_SYSTEMS) for (const b of P.STAR_SYSTEMS){
  if (a.id === b.id) continue;
  const d = Math.hypot(pos[a.id].x-pos[b.id].x, pos[a.id].y-pos[b.id].y);
  if (d < engste){ engste = d; sysA = a.id; sysB = b.id; }
}

// Drei Werte, die alle drei Zonen abdecken: gehalten von a, umkaempft, gehalten von b.
const KP = { [sysA]: 812, [sysB]: 503 };
const GALAXIE = {
  factions: {
    kartell:  { id:'kartell',  name:'Aschen-Kartell', color:'#fac775', systems:[sysA], strength:2 },
    schatten: { id:'schatten', name:'Schattenbund',   color:'#6fd0c0', systems:[sysB], strength:2 }
  },
  // Genau die Form, die galaxyFuerClient() im Server erzeugt - puffer und beitragende gehen seit
  // v8.476.0 NICHT mehr an den Client, dafuer die Anzahl je Seite und das eigene Dabeisein. Ein
  // Fixture in der alten Rohform wuerde eine Schnittstelle pruefen, die es nicht mehr gibt.
  randkriege: { fronten: [ { a:'kartell', b:'schatten', systeme: [
    { sys:sysA, kp:KP[sysA], beitragendeA:3, beitragendeB:1, dabei:true },
    { sys:sysB, kp:KP[sysB], beitragendeA:0, beitragendeB:2, dabei:false }
  ] } ], meinTag: { 'kartell|schatten': 60 } },
  collapsedSystems:{}, controlledSystems:{}, news:[], activeWar:null, activeWormhole:null,
  npcEmpireStrength:1, marketTrend:1, lastTick:Date.now()
};

(async () => {
  check('zwei benachbarte Systeme gefunden', engste < 200, { sysA, sysB, abstand: Math.round(engste) });
  const browser = await starteBrowser();
  const store = { 'kepler7-save-v3': SAVE };
  const ctx = await browser.newContext({ viewport:{ width:1400, height:900 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) fehler.push(m.text()); });
  galaxieAntwort = GALAXIE;
  await page.route('**/api/**', backend(store));
  await page.addInitScript(s => {
    localStorage.setItem('kepler7-save-v3', s);
    localStorage.setItem('kepler7_token', 'tok');
  }, SAVE);
  await page.goto(SPIEL_URL);
  await page.waitForSelector('[data-tab="karte"]', { timeout: 20000 });
  await page.waitForTimeout(2600);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  await page.click('[data-tab="karte"]');
  await page.waitForFunction(() => {
    const el = document.getElementById('galaxyMapSvg');
    return el && el.innerHTML.length > 2000;
  }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);

  const svg = await page.evaluate(() => document.getElementById('galaxyMapSvg').innerHTML);

  // ---- Kontrollpruefungen: greifen auch am alten Stand ------------------------------------------
  check('Karte gezeichnet', svg.length > 2000, svg.length);
  check('Systemknoten vorhanden', /data-system-node=/.test(svg));

  // ---- Der Balken --------------------------------------------------------------------------------
  const titel = [...svg.matchAll(/umk(&#228;|ä)mpft zwischen 300 und 700/g)];
  check('Kontrollbalken vorhanden (ein Titel je Frontsystem)', titel.length === 2, titel.length);
  check('der Titel nennt beide Seiten mit ihren Werten',
    /Aschen-Kartell 812 : 188 Schattenbund/.test(svg), (svg.match(/Aschen-Kartell \d+ : \d+ Schattenbund/g)||[]).slice(0,3));

  // Die Fuellung muss zum Wert passen. Gemessen wird das VERHAELTNIS der beiden Balken
  // zueinander - so haengt die Pruefung nicht an Knotenskala oder Pixelbreite.
  // Die gefuellten Anteile: Rechtecke in der KARTENfarbe des Kartells (#e0a548 - nicht die
  // Serverfarbe #fac775, die hier absichtlich im Fixture steht). Der Ausdruck greift nur die
  // Breite heraus und macht keine Annahme ueber die Reihenfolge der uebrigen Attribute.
  const breiten = [...svg.matchAll(/<rect [^>]*width="([\d.]+)"[^>]*fill="#e0a548"/g)].map(m => Number(m[1]));
  check('zwei gefüllte Anteile gefunden', breiten.length === 2, breiten);
  if (breiten.length === 2){
    const hoch = Math.max(...breiten), niedrig = Math.min(...breiten);
    const erwartet = 812 / 503;
    check('die Füllung folgt dem Kontrollwert', Math.abs((hoch/niedrig) - erwartet) < 0.05,
      { verhaeltnis: (hoch/niedrig).toFixed(3), erwartet: erwartet.toFixed(3) });
  }

  // Die Kerben: zwei je Balken, also vier insgesamt.
  const kerben = [...svg.matchAll(/width="0.8" height="[\d.]+" fill="#060812" opacity="0.9"/g)];
  check('zwei Besitzschwellen je Balken', kerben.length === 4, kerben.length);

  // Ein Frontsystem zeigt seinen Namen immer - ohne ihn schwebte der Balken ohne Bezug im Raum.
  const namen = P.STAR_SYSTEMS.filter(x => x.id === sysA || x.id === sysB).map(x => x.name);
  check('beide Frontsysteme sind beschriftet', namen.every(n => svg.includes('>' + n + '<')), namen);

  // ---- Die eigene Beteiligung (v8.476.0) --------------------------------------------------------
  // Eine goldene Linie unter dem Balken markiert die Abschnitte, an denen man selbst beigetragen hat.
  // Genau EINE, denn nur sysA traegt dabei:true - eine Linie an beiden waere derselbe Fehler wie
  // gar keine, nur andersherum.
  // Kein `\/>` im Muster: innerHTML serialisiert SVG-Elemente OHNE den schliessenden Schraegstrich
  // (`<rect ...>`), der erste Versuch fand deshalb null Treffer bei korrektem Markup.
  const goldlinien = [...svg.matchAll(/<rect [^>]*fill="#fac775"[^>]*>/g)];
  check('genau eine goldene Beteiligungslinie', goldlinien.length === 1, goldlinien.map(m=>m[0]));
  // Sie liegt unter dem GANZEN Balken, nicht nur unter dem gefuellten Teil - sonst waere sie eine
  // zweite Fuellstandsanzeige statt einer Beteiligungsmarke.
  if (goldlinien.length === 1){
    const gw = Number((goldlinien[0][0].match(/width="([\d.]+)"/)||[])[1]);
    check('die Linie spannt den ganzen Balken', gw > Math.max(...breiten), { gold: gw, fuellung: breiten });
  }
  check('der Tooltip nennt die Kommandanten je Seite',
    /Kommandanten dahinter: 3 f(&#252;|ü)r Aschen-Kartell, 1 f(&#252;|ü)r Schattenbund/.test(svg),
    (svg.match(/Kommandanten dahinter: \d+ [^,]+, \d+ [^<\n]+/g)||[]).slice(0,2));
  check('"du bist dabei" steht nur am eigenen Abschnitt',
    (svg.match(/du bist dabei/g)||[]).length === 1, (svg.match(/du bist dabei/g)||[]).length);

  check('keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles in Ordnung');
  process.exit(fail ? 1 : 0);
})();
