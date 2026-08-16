// Rendert die Galaxiekarte das Fraktionsgebiet WIRKLICH? Im Browser, mit echten Fraktionsdaten.
//
// Der Schwestertest test_fraktionsgebiet.js liest den Quelltext. Das genügt hier nicht: Die
// Flächen- und Frontebene hängt an galaxyCache.factions, und ohne Server ist das Objekt leer -
// ein Quelltexttest kann also nicht zeigen, dass am Ende etwas zu sehen ist.
//
// Gemessen wird deshalb am erzeugten SVG: Territoriumsflächen, Wappen, Frontsegment zwischen zwei
// verfeindeten Fraktionen, und der Farbwechsel (Legion muss auf der Karte den entsättigten Ton
// tragen, nicht die Serverfarbe Blau).
//
// GEGENPROBE (beide Richtungen, 10.08.2026): Gegen `git show HEAD:weltraum_kolonie.html` fallen
// „Territoriumsflächen gezeichnet", „Wappen im Knoten", „Frontsegment vorhanden" und
// „Legion trägt NICHT die Serverfarbe". Die Kontrollprüfungen („Karte überhaupt gezeichnet",
// „Knoten vorhanden") bleiben in beiden Läufen grün - der Test misst den Unterschied.

const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');
const { oeffneSektorMitSystem, oeffneSystemUeberSektoren } = require('./lib/karte');
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

// Die beiden Systeme werden nach echtem BILDSCHIRMabstand gewaehlt, nicht zufaellig: Ein beliebiges
// Paar koennte weiter als die 135-px-Schwelle stehen, es entstuende kein Frontsegment, und der Test
// waere gruen, ohne irgendetwas zu belegen.
const pos = P.galaxySpiralLayout(P.STAR_SYSTEMS);
let sysA = null, sysB = null, engste = Infinity;
for (const a of P.STAR_SYSTEMS) for (const b of P.STAR_SYSTEMS){
  if (a.id === b.id) continue;
  const d = Math.hypot(pos[a.id].x-pos[b.id].x, pos[a.id].y-pos[b.id].y);
  if (d < engste){ engste = d; sysA = a.id; sysB = b.id; }
}
// Ein drittes, weit entferntes System fuer die zweite Fraktionsfarbe - so ist auch belegt, dass
// mehrere Gebiete gleichzeitig gezeichnet werden und nicht nur eines.
const sysC = (P.STAR_SYSTEMS.find(x => x.id !== sysA && x.id !== sysB &&
  Math.hypot(pos[x.id].x-pos[sysA].x, pos[x.id].y-pos[sysA].y) > 300) || P.STAR_SYSTEMS[0]).id;

// color absichtlich mit den SERVERfarben belegt (Legion blau, Void rot) - genau die, die frueher
// auf der Karte gewonnen haben. Der Test zeigt damit, dass sie es nicht mehr tun.
const GALAXIE = {
  factions: {
    legion:  { id:'legion',  name:'Eisenlegion',    color:'#85b7eb', systems:[sysA], strength:2 },
    void:    { id:'void',    name:'Void-Marodeure', color:'#e24b4a', systems:[sysB], strength:2 },
    kartell: { id:'kartell', name:'Aschen-Kartell', color:'#fac775', systems:[sysC], strength:2 }
  },
  collapsedSystems:{}, controlledSystems:{}, news:[], activeWar:null, activeWormhole:null,
  npcEmpireStrength:1, marketTrend:1, lastTick:Date.now()
};

(async () => {
  check('zwei benachbarte Systeme fuer die Front gefunden', engste < 135, { sysA, sysB, sysC, abstand: Math.round(engste) });
  const browser = await starteBrowser();
  // Mit gesetztem Token laedt das Spiel den Stand vom SERVER, nicht aus localStorage. Ohne diesen
  // Vorrat antwortete der Mock mit 404, das Spiel startete neu und das Tutorial-Overlay fing jeden
  // Klick ab - der Test lief in einen Timeout, ohne dass an der Karte etwas kaputt war.
  const store = { 'kepler7-save-v3': SAVE };   // als JSON-ZEICHENKETTE, so wie der echte Server sie ablegt
  const ctx = await browser.newContext({ viewport:{ width:1400, height:900 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  // 404er auf Speicher-Schluessel sind hier normal: Der Mock kennt nur den Spielstand, alle
  // uebrigen Schluessel (Allianz, Markt, ...) fehlen absichtlich. Sie zaehlen deshalb nicht als
  // Fehler - echte Skriptfehler (pageerror) dagegen schon.
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) fehler.push(m.text()); });
  galaxieAntwort = GALAXIE;
  await page.route('**/api/**', backend(store));
  // Schluessel aus dem Quelltext abgelesen, nicht geraten: STORE_KEY ist 'kepler7-save-v3' mit
  // Bindestrichen, TOKEN_KEY dagegen 'kepler7_token' mit Unterstrich. Mit dem falschen Token-Namen
  // bleibt das Anmelde-Overlay stehen und faengt jeden Klick ab - der Test lief in einen Timeout,
  // ohne dass irgendetwas an der Karte kaputt gewesen waere.
  await page.addInitScript(s => {
    localStorage.setItem('kepler7-save-v3', s);
    localStorage.setItem('kepler7_token', 'tok');
  }, SAVE);
  await page.goto(SPIEL_URL);
  await page.waitForSelector('[data-tab="karte"]', { timeout: 20000 });
  await page.waitForTimeout(2600);
  // Startfenster wegräumen - dasselbe Vorgehen wie in den übrigen Browsertests des Repos.
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));

  // Der Reiter heisst 'karte' (nicht 'map'): aus dem Markup abgelesen, nicht geraten - ein
  // erfundener Schluessel haette hier still eine leere Karte gemessen.
  await page.click('[data-tab="karte"]');
  // Warten, bis die Karte MIT Fraktionsdaten steht. Fest zu warten waere Wanduhr-Glueck; geprueft
  // wird auf den Zustand selbst.
  await page.waitForFunction(() => {
    const el = document.getElementById('galaxyMapSvg');
    return el && el.innerHTML.length > 2000;
  }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);   // ein Galaxie-Poll (120 s Intervall feuert beim Laden sofort)

  // Seit KB-4 (nur noch Sektoren-Karte) verteilt sich das Bild: Wappen und Fraktions-Ring stehen
  // am Knoten der SEKTORANSICHT, die Territoriums-Flächen und Frontsegmente zeichnet weiterhin
  // die Freiflug-Zeichnung - erreichbar als geöffnete Systemebene. Beides wird nacheinander
  // gemessen.
  const wappenDa = await oeffneSektorMitSystem(page, sysA);
  await page.waitForTimeout(800);
  const knotenA = await page.evaluate(id => {
    const n = document.querySelector('#galaxyMapSvg [data-sektor-sys="' + id + '"]');
    return n ? n.outerHTML : '';
  }, sysA);
  check('die Sektoransicht mit dem Legion-System steht', wappenDa && knotenA.length > 0, { wappenDa, len: knotenA.length });
  check('Wappen im Knoten', /viewBox="0 0 100 100"/.test(knotenA));
  check('Fraktions-Ring am Knoten', /data-ring="fraktion"/.test(knotenA));

  await oeffneSystemUeberSektoren(page, sysA);
  const svg = await page.evaluate(() => {
    const el = document.getElementById('galaxyMapSvg');
    return el ? el.innerHTML : '';
  });

  // ---- Kontrollprüfungen: greifen in BEIDEN Ständen, zeigen also nur, dass der Test lief -------
  check('Karte überhaupt gezeichnet', svg.length > 2000, svg.length);
  check('Systemknoten vorhanden', /data-system-node=/.test(svg));

  // ---- Die eigentlichen Prüfungen ---------------------------------------------------------------
  check('Territoriumsflächen gezeichnet', /url\(#terrGlow-legion\)/.test(svg) && /url\(#terrGlow-void\)/.test(svg));
  check('drei Gebiete gleichzeitig', /url\(#terrGlow-kartell\)/.test(svg));
  check('Verläufe je Fraktion in den defs', /id="terrGlow-legion"/.test(svg));
  check('Frontsegment vorhanden', /id="frontSeg-/.test(svg));
  check('Frontsegment nennt beide Parteien', /Front: (Eisenlegion gegen Void-Marodeure|Void-Marodeure gegen Eisenlegion)/.test(svg));
  check('Front bewegt sich per SMIL', /<animate attributeName="stroke-dashoffset"/.test(svg));

  // ---- Der Farbkonflikt, an der Wirkung gemessen ------------------------------------------------
  // Die Legion muss auf der Karte den entsättigten Ton tragen, NICHT die Serverfarbe Blau.
  const legionGrad = (svg.match(/<radialGradient id="terrGlow-legion"[\s\S]*?<\/radialGradient>/) || [''])[0];
  const voidGrad = (svg.match(/<radialGradient id="terrGlow-void"[\s\S]*?<\/radialGradient>/) || [''])[0];
  // Die beiden Negativpruefungen bestehen auf einem LEEREN Treffer trivial - deshalb erst
  // sicherstellen, dass ueberhaupt ein Verlauf da ist, und die Pruefungen daran haengen.
  const graeder = legionGrad.length > 40 && voidGrad.length > 40;
  check('Verläufe für Legion und Void gefunden', graeder, { legion: legionGrad.length, void: voidGrad.length });
  check('Legion trägt NICHT die Serverfarbe (#85b7eb)', graeder && !/85b7eb/i.test(legionGrad), legionGrad.slice(0, 120));
  check('Legion trägt den entsättigten Kartenton (#c0504f)', graeder && /c0504f/i.test(legionGrad));
  check('Void trägt NICHT --c-danger (#e24b4a)', graeder && !/e24b4a/i.test(voidGrad), voidGrad.slice(0, 120));

  // ---- Der Markup-Zwischenspeicher darf weiter greifen ------------------------------------------
  // Ohne stehende Uhr misst das Wanduhr-Glück statt der Regel (CLAUDE.md-Arbeitsregel 18): Läuft
  // irgendwo ein sekundengenauer Countdown, ist das Markup ohnehin jede Sekunde ein anderes.
  // buildGalaxyMap ist aus der IIFE nicht aufrufbar; gemessen wird deshalb ueber den Haupt-Tick,
  // der die Karte ohnehin jede Sekunde anfasst. Die Uhr wird dafuer angehalten (Arbeitsregel 18):
  // Mit laufender Uhr koennte ein legitimer Countdown irgendwo im Markup den Vergleich kippen, und
  // der Test maesse Wanduhr-Glueck statt der Regel. Ein wirklich kaputter Zwischenspeicher faellt
  // trotzdem durch - die Marke stirbt am Schreiben, nicht am Inhalt.
  const cacheGreift = await page.evaluate(async () => {
    const echt = Date.now;
    const fest = echt();
    Date.now = () => fest;
    try {
      const svgEl = document.getElementById('galaxyMapSvg');
      await new Promise(r => setTimeout(r, 1200));            // ein Tick bei stehender Uhr
      const a = svgEl.innerHTML;
      const knoten = svgEl.firstElementChild;
      await new Promise(r => setTimeout(r, 2500));            // zwei weitere Ticks
      return { gleich: a === svgEl.innerHTML, selberKnoten: knoten === svgEl.firstElementChild };
    } finally { Date.now = echt; }
  });
  check('Markup bei stehender Uhr unverändert', cacheGreift.gleich);
  check('Karte wurde nicht neu geschrieben (Zwischenspeicher greift)', cacheGreift.selberKnoten);

  check('keine Konsolenfehler', fehler.length === 0, fehler.slice(0, 3));

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles in Ordnung');
  process.exit(fail ? 1 : 0);
})();
