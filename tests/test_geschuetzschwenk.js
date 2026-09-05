// Die Ausrichtung der Geschütze kommt im Bild an (05.08.2026, umgebaut mit Bündel C).
//
// AUSGANGSLAGE - und der Grund, warum dieser Test so gebaut ist, wie er gebaut ist:
// Die Ausrichtung war IMMER schon da. anlagenSchritt() sucht ein Ziel, rechnet sollRicht und
// führt an.richt mit 1,6 rad/s nach, gedeckelt auf ±1,15 rad. Gezeichnet wurde sie nur in den
// ALTEN Notsilhouetten - seit die Wiedergabe (v8.394.0) das echte Gebäudebild stempelt, kehrte
// dieser Zweig vorher zurück, und die Rohre zeigten stur geradeaus. Gemessen standen dauerhaft
// 9-10 Stellungen mit bis zu 61,8 Grad Schwenk.
//
// WAS SICH MIT BÜNDEL C GEÄNDERT HAT: Die Anlagen stehen jetzt auf einer achteckigen Sockelplatte,
// deren HINTERE Ecke bei Bildanteil y = 0,368 liegt - höher als der Fuß jedes Aufsatzes und sogar
// höher als die Mündung des Turmrohrs (0,42). Der alte Trick (Bild an einer waagerechten Linie
// teilen, obere Hälfte kippen) nimmt damit immer ein Stück Platte mit, das sichtbar mitkippt.
// Die SCHWENK-Tabelle ist deshalb ausgebaut; die Begründung steht im Spiel an ihrer Stelle.
//
// DIE REGEL BLEIBT, DIE STELLE WECHSELT: an.richt muss weiterhin im BILD ankommen - jetzt über
// den Mündungsblitz (MUENDUNG_LAENGE) und den Schussursprung, nicht mehr über das Rohr. Ein Test,
// der nur den Winkel prüft, hätte den alten Fehler nicht gefunden (die Winkel stimmten ja die
// ganze Zeit); deshalb misst dieser Test weiter das Bild.
//
// Dafür baut er zwei gepatchte Kopien der Spieldatei im Systemtemp (das Repo bleibt unangetastet),
// in denen der Winkel fest auf 0 bzw. 0,9 rad steht UND die Mündungsglut dauerhaft brennt - sonst
// entschiede der Zufall, ob im Foto gerade ein Blitz zu sehen ist. Alles andere - Funken,
// Explosionen, Schüsse - ist in beiden Kopien gleich verteilt.
//
// Warum nicht einfach zwei Momente desselben Laufs vergleichen: Im Bodenband regnet es Funken und
// Trümmer. Ein Vergleich über die Zeit misst überwiegend die, nicht die Anlagen - beim Bau dieses
// Tests gemessen: 27.394 gegenüber 31.194 veränderten Bildpunkten mit und OHNE Schwenktabelle,
// also genau die falsche Richtung. Erst der deterministische Vergleich trennt die Wirkung sauber.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const FLOTTE = { jaeger:152, destroyers:2418, schlachtschiff:7234, frachtergross:3324,
  waechter:10089, recycler:283, kreuzer:96 };
// Genug Flak, Verteidigungstürme und Lasergeschütze, dass die Größte-Reste-Verteilung
// zuverlässig schwenkbare Stellungen auf den Boden stellt.
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

// Die Spieldatei liegt neben tests/ - SPIEL_URL ist eine file://-Adresse darauf.
const SPIELDATEI = decodeURIComponent(String(SPIEL_URL).replace(/^file:\/\//, '').split('?')[0]);

// Zwei Kopien mit FESTEM Winkel und dauerhaft brennender Mündungsglut. Der Anker ist die Stelle,
// an der die Wiedergabe das Gebäudebild stempelt; findet er sich nicht, ist der Test kaputt und
// sagt das, statt still grün zu werden (Hausregel: Anker vor Benutzung prüfen).
function kopieMitWinkel(quelle, winkel, ziel){
  const anker = '          gg.drawImage(bild, -20*f, -34*f, 40*f, 40*f);\n'
              + '          if (an.glut > 0 || an.klappe > 0.1 || an.salve > 0){';
  if (!quelle.includes(anker)) return null;
  const neu = quelle.replace(anker,
    '          an.richt = ' + winkel + '; an.glut = 1;\n' + anker);
  if (neu === quelle) return null;
  fs.writeFileSync(ziel, neu);
  return ziel;
}

async function bodenband(browser, datei){
  const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, [UEBERFALL]));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto('file://' + datei); await page.waitForTimeout(3600);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  await page.evaluate(() => { const x=document.getElementById('headerReportsBtn'); if(x)x.click(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const x=document.querySelector('[data-watch-battle]'); if(x)x.click(); });
  await page.waitForTimeout(2200);
  const px = await page.evaluate(() => {
    const c = document.querySelector('#osBuehne canvas');
    const y0 = Math.floor(c.height*0.72);
    return Array.from(c.getContext('2d').getImageData(0, y0, Math.floor(c.width*0.72), c.height-y0).data);
  });
  const z = await page.evaluate(() => { try { return JSON.parse(document.getElementById('osWrap').dataset.zustand); } catch(e){ return null; } });
  await ctx.close();
  return { px, errs, z };
}

(async () => {
  const quelle = fs.readFileSync(SPIELDATEI, 'utf8');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-schwenk-'));
  const a0 = kopieMitWinkel(quelle, '0',   path.join(tmp, 'richt0.html'));
  const a9 = kopieMitWinkel(quelle, '0.9', path.join(tmp, 'richt9.html'));
  check('die Stempelstelle der Wiedergabe ist auffindbar', !!(a0 && a9));
  if (!a0 || !a9){ console.log('\nFEHLGESCHLAGEN'); process.exit(1); }

  const browser = await starteBrowser();
  const r0 = await bodenband(browser, a0);
  const r9 = await bodenband(browser, a9);
  await browser.close();
  try { fs.rmSync(tmp, { recursive:true, force:true }); } catch(e){}

  let anders = 0, gesamt = 0;
  const n = Math.min(r0.px.length, r9.px.length);
  for (let i = 0; i < n; i += 4){
    gesamt++;
    if (Math.abs(r0.px[i]-r9.px[i]) > 30 || Math.abs(r0.px[i+1]-r9.px[i+1]) > 30 || Math.abs(r0.px[i+2]-r9.px[i+2]) > 30) anders++;
  }
  const anteil = 100 * anders / (gesamt || 1);

  check('es wurden überhaupt Bildpunkte des Bodenbands gelesen', gesamt > 20000, { gesamt });
  // DER Punkt: Ein anderer Winkel MUSS ein anderes Bild ergeben. Vor der Änderung vom 05.08.2026
  // war der Unterschied exakt 0 - das Bild kannte den Winkel gar nicht. Seit Bündel C trägt ihn
  // der Mündungsblitz statt des Rohres; die Regel ist dieselbe geblieben.
  check('ein anderer Winkel ergibt ein anderes Bild (die Ausrichtung kommt an)',
    anders > 300, { andersPunkte: anders, anteilProzent: Number(anteil.toFixed(2)) });
  // Und die Bauwerke bleiben stehen: Würde das GANZE Gebäude mitkippen, wäre der Unterschied
  // ein Vielfaches. Das ist seit Bündel C ausdrücklich so gewollt - die Sockelplatte lässt sich
  // nicht schneiden, ohne dass ein Stück von ihr mitkippt.
  check('aber nur die Mündungen, nicht die ganzen Gebäude', anteil < 8,
    { anteilProzent: Number(anteil.toFixed(2)) });
  check('die Anlagen werden dabei weiterhin alle gezeichnet',
    r9.z && r9.z.anlagenMitBild >= (r9.z.anlagen - 1),
    { mitBild: r9.z && r9.z.anlagenMitBild, anlagen: r9.z && r9.z.anlagen });
  check('keine JS-Fehler', r0.errs.length === 0 && r9.errs.length === 0,
    r0.errs.slice(0,2).concat(r9.errs.slice(0,2)));

  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
