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
// GEGENPROBE (beide Richtungen, 10.08.2026; auf die Sektoransicht umgezogen mit KB-4):
// Am Stand vor KB-4b tragen die Sektorknoten keinen Kontrollbalken - „Kontrollbalken vorhanden"
// und alles Weitere fallen. Die Kontrollprüfungen („Karte gezeichnet", „Sektorregionen
// vorhanden") bleiben in beiden Läufen grün - der Test misst den Unterschied.

const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');
const { oeffneSektorMitSystem } = require('./lib/karte');
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

  // Seit KB-4 lebt der Kontrollbalken in der SEKTORANSICHT (die Freiflug-Galaxie-Übersicht ist
  // unerreichbar; die Systemebene zeichnet Nachbarn nur als nackte Punkte). Je Frontsystem wird
  // die Sektoransicht seiner Region geöffnet und der Balken am Knoten selbst gemessen - sysA und
  // sysB können in verschiedenen Regionen liegen, deshalb zwei Messungen statt einer.
  const uebersicht = await page.evaluate(() => document.getElementById('galaxyMapSvg').innerHTML);
  check('Karte gezeichnet', uebersicht.length > 2000, uebersicht.length);
  check('Sektorregionen vorhanden', /data-sektor=/.test(uebersicht));

  const knotenHtml = async (sysId) => {
    if (!await oeffneSektorMitSystem(page, sysId)) return null;
    await page.waitForTimeout(800);
    return page.evaluate(id => {
      const n = document.querySelector('#galaxyMapSvg [data-sektor-sys="' + id + '"]');
      return n ? n.outerHTML : null;
    }, sysId);
  };
  const htmlA = await knotenHtml(sysA);
  const htmlB = await knotenHtml(sysB);
  check('beide Frontsysteme sind in ihrer Sektoransicht auffindbar', !!htmlA && !!htmlB, { a: !!htmlA, b: !!htmlB });
  if (!htmlA || !htmlB){ await browser.close(); console.log('\nFEHLGESCHLAGEN'); process.exit(1); }

  // ---- Der Balken --------------------------------------------------------------------------------
  const titelZahl = h => [...h.matchAll(/umk(&#228;|ä)mpft zwischen 300 und 700/g)].length;
  check('Kontrollbalken vorhanden (ein Titel je Frontsystem)',
    titelZahl(htmlA) === 1 && titelZahl(htmlB) === 1, { a: titelZahl(htmlA), b: titelZahl(htmlB) });
  check('der Titel nennt beide Seiten mit ihren Werten',
    /Aschen-Kartell 812 : 188 Schattenbund/.test(htmlA) && /Aschen-Kartell 503 : 497 Schattenbund/.test(htmlB),
    { a: (htmlA.match(/Aschen-Kartell \d+ : \d+ Schattenbund/)||[])[0], b: (htmlB.match(/Aschen-Kartell \d+ : \d+ Schattenbund/)||[])[0] });

  // Die Fuellung muss zum Wert passen. Gemessen wird das VERHAELTNIS der beiden Balken
  // zueinander - so haengt die Pruefung nicht an der Balkenbreite. Die gefuellten Anteile:
  // Rechtecke in der KARTENfarbe des Kartells (#e0a548 - nicht die Serverfarbe #fac775, die hier
  // absichtlich im Fixture steht).
  const breiteVon = h => [...h.matchAll(/<rect [^>]*width="([\d.]+)"[^>]*fill="#e0a548"/g)].map(m => Number(m[1]));
  const bA = breiteVon(htmlA), bB = breiteVon(htmlB);
  check('je Frontsystem genau ein gefüllter Anteil', bA.length === 1 && bB.length === 1, { bA, bB });
  if (bA.length === 1 && bB.length === 1){
    const erwartet = 812 / 503;
    check('die Füllung folgt dem Kontrollwert', Math.abs((bA[0]/bB[0]) - erwartet) < 0.05,
      { verhaeltnis: (bA[0]/bB[0]).toFixed(3), erwartet: erwartet.toFixed(3) });
  }

  // Die Kerben: zwei je Balken.
  const kerbenZahl = h => [...h.matchAll(/width="0.8" height="[\d.]+" fill="#060812" opacity="0.9"/g)].length;
  check('zwei Besitzschwellen je Balken', kerbenZahl(htmlA) === 2 && kerbenZahl(htmlB) === 2,
    { a: kerbenZahl(htmlA), b: kerbenZahl(htmlB) });

  // Sektorknoten sind immer beschriftet - der Balken schwebt nie ohne Namen im Raum.
  const nameVon = id => (P.STAR_SYSTEMS.find(x => x.id === id)||{}).name;
  check('beide Frontsysteme sind beschriftet',
    htmlA.includes('>' + nameVon(sysA) + '<') && htmlB.includes('>' + nameVon(sysB) + '<'),
    [nameVon(sysA), nameVon(sysB)]);

  // ---- Die eigene Beteiligung (v8.476.0) --------------------------------------------------------
  // Eine goldene Linie unter dem Balken markiert die Abschnitte, an denen man selbst beigetragen
  // hat - nur sysA traegt dabei:true. Kein `\/>` im Muster: innerHTML/outerHTML serialisiert SVG
  // ohne schliessenden Schraegstrich.
  const goldVon = h => [...h.matchAll(/<rect [^>]*fill="#fac775"[^>]*>/g)];
  check('genau eine goldene Beteiligungslinie, nur am eigenen Abschnitt',
    goldVon(htmlA).length === 1 && goldVon(htmlB).length === 0,
    { a: goldVon(htmlA).length, b: goldVon(htmlB).length });
  if (goldVon(htmlA).length === 1){
    const gw = Number((goldVon(htmlA)[0][0].match(/width="([\d.]+)"/)||[])[1]);
    check('die Linie spannt den ganzen Balken', gw > bA[0], { gold: gw, fuellung: bA });
  }
  check('der Tooltip nennt die Kommandanten je Seite',
    /Kommandanten dahinter: 3 f(&#252;|ü)r Aschen-Kartell, 1 f(&#252;|ü)r Schattenbund/.test(htmlA),
    (htmlA.match(/Kommandanten dahinter: \d+ [^,]+, \d+ [^<\n]+/g)||[]).slice(0,2));
  check('"du bist dabei" steht nur am eigenen Abschnitt',
    (htmlA.match(/du bist dabei/g)||[]).length === 1 && !(htmlB.match(/du bist dabei/g)),
    { a: (htmlA.match(/du bist dabei/g)||[]).length, b: (htmlB.match(/du bist dabei/g)||[]).length });

  check('keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));
  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles in Ordnung');
  process.exit(fail ? 1 : 0);
})();
