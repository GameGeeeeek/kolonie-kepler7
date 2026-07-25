const { SERVER_JS, SPIELDATEI, ueberspringen } = require('./lib/umgebung');
// Kampfphasen + Verteidigungs-Aufstellung.
// Der springende Punkt bei diesem Umbau ist NICHT, ob der Code laeuft, sondern ob die
// Wahrscheinlichkeiten stimmen: "zwei von drei" verschaerft, und die Phasen-Deckel sind so
// zurueckgerechnet, dass der Gesamtspielraum derselbe bleibt wie vorher. Genau das wird hier
// nachgerechnet - analytisch UND per Simulation.
const fs = require('fs');
if (!SERVER_JS) ueberspringen('Kampfphasen vergleicht Frontend und Backend Zeile fuer Zeile - das Backend-Repo (kolonie-kepler7-backend) liegt hier nicht daneben.');
let fail=false; const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };
const schnitt=(s,von,bis)=>{const a=s.indexOf(von),b=s.indexOf(bis,a); if(a<0||b<0) throw new Error('nicht gefunden: '+von); return s.slice(a,b);};

const FEsrc = fs.readFileSync(SPIELDATEI,'utf8');
const BEsrc = fs.readFileSync(SERVER_JS,'utf8');

const feKonter = schnitt(FEsrc, 'const COUNTER_ROLE_DEFS = [', '// ===== Kampfphasen');
const fePhasen = schnitt(FEsrc, '// ===== Kampfphasen', '// ===== Verteidigungs-Aufstellung');
const feForm   = schnitt(FEsrc, '// ===== Verteidigungs-Aufstellung', '  // Signatur-Cache-Muster');
const feBal    = schnitt(FEsrc, 'const FLEET_BALANCE_MAX_BONUS', '// ===== Schiffsklassen');
const FE={};
new Function('ctx','state', feKonter+feBal+fePhasen+feForm+
  ';ctx.resolve=resolveBattlePhases;ctx.chance=battleWinChance;ctx.MIN=PHASE_CHANCE_MIN;ctx.MAX=PHASE_CHANCE_MAX;'+
  'ctx.form=formationDefenseMult;ctx.FORMS=DEFENSE_FORMATIONS;ctx.PHASES=BATTLE_PHASES;')(FE, { defenseFormation:'ausgewogen' });

const bePhasen = schnitt(BEsrc, '// ===== Kampfphasen', '// ===== Verteidigungs-Aufstellung');
const beForm   = schnitt(BEsrc, '// ===== Verteidigungs-Aufstellung', 'const COUNTER_BONUS');
const beKonter = schnitt(BEsrc, 'const COUNTER_ROLE_DEFS = [', '// ===== Kampfphasen');
const beAtk    = schnitt(BEsrc, 'const COUNTER_ROLE_ATK = {', '};')+'};';
const BE={};
new Function('ctx', beKonter+beAtk+bePhasen+beForm+
  ';ctx.resolve=resolveBattlePhases;ctx.chance=battleWinChance;ctx.MIN=PVP_PHASE_MIN;ctx.MAX=PVP_PHASE_MAX;ctx.form=formationDefenseMult;')(BE);

// --- 1. Die Deckel-Rueckrechnung MUSS stimmen, sonst verschiebt sich still der Spielraum.
const zweiVonDrei = p => 3*p*p*(1-p) + p*p*p;
check('Frontend-Deckel ergeben insgesamt ~5% Mindestchance', Math.abs(zweiVonDrei(FE.MIN)-0.05)<0.005, { phase:FE.MIN, gesamt:zweiVonDrei(FE.MIN).toFixed(4) });
check('Frontend-Deckel ergeben insgesamt ~95% Hoechstchance', Math.abs(zweiVonDrei(FE.MAX)-0.95)<0.005, { phase:FE.MAX, gesamt:zweiVonDrei(FE.MAX).toFixed(4) });
check('Backend-Deckel (PvP) ergeben insgesamt ~10% Mindestchance', Math.abs(zweiVonDrei(BE.MIN)-0.10)<0.005, { phase:BE.MIN, gesamt:zweiVonDrei(BE.MIN).toFixed(4) });
check('Backend-Deckel (PvP) ergeben insgesamt ~90% Hoechstchance', Math.abs(zweiVonDrei(BE.MAX)-0.90)<0.005, { phase:BE.MAX, gesamt:zweiVonDrei(BE.MAX).toFixed(4) });

// --- 2. Die analytische Formel muss die Simulation treffen (sonst luegt die angezeigte Chance).
function simuliere(basePower, def, konter, min, max, n){
  let siege=0;
  for(let i=0;i<n;i++) if (FE.resolve(basePower, def, konter, min, max).success) siege++;
  return siege/n;
}
let maxAbw = 0, schlimmster = null;
for (const [bp,dp,km] of [[1000,1000,1],[2000,1000,1],[500,2000,1],[1500,1200,1.25],[1500,1200,0.85],[3000,500,1.1]]){
  const analytisch = FE.chance(bp,dp,km);
  const sim = simuliere(bp,dp,km,FE.MIN,FE.MAX,40000);
  const abw = Math.abs(analytisch-sim);
  if (abw>maxAbw){ maxAbw=abw; schlimmster={bp,dp,km,analytisch:analytisch.toFixed(4),sim:sim.toFixed(4)}; }
}
check('analytische Siegchance trifft die Simulation (40k Laeufe, Abweichung <1,5%)', maxAbw<0.015, { maxAbweichung:maxAbw.toFixed(4), schlimmster });

// --- 3. Der Gesamtspielraum darf die alten Grenzen nicht verlassen.
let gMin=Infinity, gMax=-Infinity;
for(let i=0;i<20000;i++){
  const bp=1+Math.random()*100000, dp=1+Math.random()*100000, km=0.85+Math.random()*0.4;
  const c=FE.chance(bp,dp,km); gMin=Math.min(gMin,c); gMax=Math.max(gMax,c);
}
check('Gesamt-Siegchance bleibt im alten Rahmen [0.05, 0.95]', gMin>=0.049 && gMax<=0.951, { min:gMin.toFixed(4), max:gMax.toFixed(4) });

// --- 4. Phasen duerfen den Erwartungswert nicht kippen: bei Gleichstand bleibt es 50/50.
const gleichstand = FE.chance(1000,1000,1);
check('bei gleicher Staerke bleibt die Siegchance 50%', Math.abs(gleichstand-0.5)<0.001, { chance:gleichstand.toFixed(4) });

// --- 5. Aber sie VERSCHAERFEN: der Staerkere gewinnt verlaesslicher als vorher (weniger Zufall).
const alt = (bp,dp)=>Math.max(0.05,Math.min(0.95,bp/(bp+dp)));
const beispiele = [[1500,1000],[2000,1000],[3000,1000]];
const verschaerft = beispiele.every(([bp,dp]) => FE.chance(bp,dp,1) > alt(bp,dp));
check('der Staerkere gewinnt jetzt verlaesslicher als beim Einzelwurf', verschaerft,
  beispiele.map(([bp,dp])=>({ verhaeltnis:(bp/dp).toFixed(1), vorher:alt(bp,dp).toFixed(3), jetzt:FE.chance(bp,dp,1).toFixed(3) })));

// --- 6. Konter wirken im Anflug staerker als im Rueckzug - das ist der ganze Zweck der Phasen.
const stark = FE.resolve(1000, 1000, 1.25, FE.MIN, FE.MAX, ()=>0.5);
const chAnflug = stark.phasen.find(p=>p.key==='anflug').chance;
const chRueckzug = stark.phasen.find(p=>p.key==='rueckzug').chance;
check('ein Konter-Vorteil wirkt im Anflug staerker als im Rueckzug', chAnflug > chRueckzug + 0.02,
  { anflug:chAnflug.toFixed(3), rueckzug:chRueckzug.toFixed(3) });
const schwach = FE.resolve(1000, 1000, 0.85, FE.MIN, FE.MAX, ()=>0.5);
check('ein Konter-NACHTEIL trifft im Anflug ebenfalls am haertesten',
  schwach.phasen.find(p=>p.key==='anflug').chance < schwach.phasen.find(p=>p.key==='rueckzug').chance - 0.02);

// --- 7. Verteidigungs-Aufstellung: wirkt anteilig und in der versprochenen Groessenordnung.
const bomberFlotte = { hyperbomber: 500 };
const abfangFlotte = { hyperjaeger: 800 };
check('"Schilde vorn" traegt gegen eine reine Bomberflotte +15%', Math.abs(FE.form(bomberFlotte,'schilde')-1.15)<1e-9, { wert:FE.form(bomberFlotte,'schilde') });
check('"Schilde vorn" verliert gegen eine reine Abfangflotte 10%', Math.abs(FE.form(abfangFlotte,'schilde')-0.90)<1e-9, { wert:FE.form(abfangFlotte,'schilde') });
check('"Geschuetze vorn" ist genau umgekehrt', Math.abs(FE.form(abfangFlotte,'geschuetze')-1.15)<1e-9 && Math.abs(FE.form(bomberFlotte,'geschuetze')-0.90)<1e-9);
check('"Ausgewogen" wirkt nie', FE.form(bomberFlotte,'ausgewogen')===1 && FE.form(abfangFlotte,'ausgewogen')===1);
const gemischt = { hyperbomber:100, hyperjaeger:100, schlachtschiff:100 };
const gm = FE.form(gemischt,'schilde');
check('gegen eine gemischte Flotte wirkt sie nur anteilig', gm>1 && gm<1.10, { wert:gm.toFixed(4) });
check('ein einzelnes Schiff kippt nichts', Math.abs(FE.form({hyperjaeger:1000, hyperbomber:1},'schilde')-0.90)<0.01);

// --- 8. FE/BE-Paritaet der Aufstellung.
let formGleich=true, formGegen=null;
const schiffe = ['jaeger','hyperjaeger','bomber','hyperbomber','cruisers','schlachtschiff','waechter','singularitaetsvernichter'];
for(let i=0;i<3000;i++){
  const f={}; for(let j=0;j<4;j++) f[schiffe[Math.floor(Math.random()*schiffe.length)]] = 1+Math.floor(Math.random()*500);
  for (const k of ['ausgewogen','schilde','geschuetze']){
    if (Math.abs(FE.form(f,k)-BE.form(f,k))>1e-9){ formGleich=false; formGegen={f,k,fe:FE.form(f,k),be:BE.form(f,k)}; break; }
  }
  if(!formGleich) break;
}
check('Aufstellung: Frontend und Backend rechnen identisch', formGleich, formGegen);

// --- 9. Phasen-Paritaet der ANALYTIK (gleiche Deckel eingesetzt).
let phGleich=true, phGegen=null;
for(let i=0;i<3000;i++){
  const bp=1+Math.random()*50000, dp=1+Math.random()*50000, km=0.85+Math.random()*0.4;
  const f=FE.chance(bp,dp,km), b=BE.chance(bp,dp,km,FE.MIN,FE.MAX);
  if (Math.abs(f-b)>1e-9){ phGleich=false; phGegen={bp,dp,km,fe:f,be:b}; break; }
}
check('Phasen: Frontend und Backend rechnen bei gleichen Deckeln identisch', phGleich, phGegen);

console.log(fail?'\nFAIL':'\nPASS'); process.exit(fail?1:0);
