const { SERVER_JS, SPIELDATEI, ueberspringen } = require('./lib/umgebung');
// Frontend und Backend MUESSEN dieselben Konterrollen kennen. Weicht eine Seite ab, zeigt das Spiel
// eine Gewinnchance an, die der Server anders ausrechnet. Dieser Test schneidet beide Tabellen aus
// den echten Dateien und vergleicht sie Schiff fuer Schiff.
const fs = require('fs');
if (!SERVER_JS) ueberspringen('Konter-Paritaet vergleicht Frontend und Backend Zeile fuer Zeile - das Backend-Repo (kolonie-kepler7-backend) liegt hier nicht daneben.');
let fail = false;
const check = (n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

function lade(datei, von, bis, exportZeile){
  const s = fs.readFileSync(datei,'utf8');
  const a = s.indexOf(von); const b = s.indexOf(bis, a);
  if (a<0||b<0) throw new Error('Block nicht gefunden in '+datei);
  const ctx = {};
  new Function('ctx', s.slice(a,b) + ';' + exportZeile)(ctx);
  return ctx;
}
const FE = lade(SPIELDATEI,
  'const COUNTER_ROLE_DEFS = [', '// ===== Taktik-Stance =====',
  'ctx.ROLES=COUNTER_ROLE_DEFS;ctx.OF=COUNTER_ROLE_OF;ctx.SC=SHIP_COUNTERS;ctx.B=COUNTER_BONUS;ctx.M=COUNTER_MALUS;ctx.cm=counterMultiplier;');
const BE = lade(SERVER_JS,
  'const COUNTER_ROLE_DEFS = [', 'function counterMultiplier',
  'ctx.ROLES=COUNTER_ROLE_DEFS;ctx.OF=COUNTER_ROLE_OF;ctx.SC=SHIP_COUNTERS;ctx.B=COUNTER_BONUS;ctx.M=COUNTER_MALUS;');

check('gleiche Anzahl Rollen', FE.ROLES.length === BE.ROLES.length, { fe: FE.ROLES.length, be: BE.ROLES.length });
check('gleiche Rollen-Schlaegt-Beziehungen',
  FE.ROLES.every(r => (BE.ROLES.find(x=>x.key===r.key)||{}).schlaegt === r.schlaegt),
  FE.ROLES.map(r=>[r.key, r.schlaegt, (BE.ROLES.find(x=>x.key===r.key)||{}).schlaegt]));

const feShips = Object.keys(FE.OF).sort(), beShips = Object.keys(BE.OF).sort();
check('gleiche Schiffsliste', JSON.stringify(feShips)===JSON.stringify(beShips),
  { nurFE: feShips.filter(k=>!beShips.includes(k)), nurBE: beShips.filter(k=>!feShips.includes(k)) });
const rollenAbweichung = feShips.filter(k => FE.OF[k] !== BE.OF[k]);
check('jedes Schiff hat beidseitig dieselbe Rolle', rollenAbweichung.length===0,
  rollenAbweichung.map(k=>[k, FE.OF[k], BE.OF[k]]));

check('gleiche Bonus-/Malus-Konstanten', FE.B===BE.B && FE.M===BE.M, { feB:FE.B, beB:BE.B, feM:FE.M, beM:BE.M });

// Abgeleitete Tabellen zeichengleich?
const norm = t => Object.fromEntries(Object.entries(t).map(([k,v])=>[k,{strongVs:[...v.strongVs].sort(),weakVs:[...v.weakVs].sort()}]));
check('abgeleitete strongVs/weakVs sind identisch',
  JSON.stringify(norm(FE.SC))===JSON.stringify(norm(BE.SC)));

// Und der Endwert stimmt bei zufaelligen Flotten ueberein (Backend-Formel nachgebaut, damit ein
// Rechen-Unterschied und nicht nur ein Tabellen-Unterschied auffaellt).
function beMult(own, enemy, SC, B, M){
  const total = Object.values(enemy).reduce((a,b)=>a+(typeof b==='number'&&b>0?b:0),0); if(!total) return 1;
  let wm=0, ot=0;
  for (const [k,v] of Object.entries(own)){ if(!(typeof v==='number'&&v>0)) continue;
    const r=SC[k]; let m=1;
    if(r){ const s=r.strongVs.reduce((a,t)=>a+(enemy[t]||0),0)/total;
           const w=r.weakVs.reduce((a,t)=>a+(enemy[t]||0),0)/total; m=1+s*B-w*M; }
    wm+=m*v; ot+=v; }
  return ot>0?wm/ot:1;
}
const ships = Object.keys(FE.OF);
const rnd = n => { const f={}; for(let i=0;i<n;i++) f[ships[Math.floor(Math.random()*ships.length)]] = 1+Math.floor(Math.random()*900); return f; };
let gleich = true, gegenbeispiel = null;
for (let i=0;i<2000;i++){
  const o=rnd(5), e=rnd(5);
  const f=FE.cm(o,e), b=beMult(o,e,BE.SC,BE.B,BE.M);
  if (Math.abs(f-b) > 1e-9){ gleich=false; gegenbeispiel={o,e,fe:f,be:b}; break; }
}
check('bei 2000 Zufallsflotten rechnen beide Seiten identisch', gleich, gegenbeispiel);

console.log(fail?'\nFAIL':'\nPASS'); process.exit(fail?1:0);
