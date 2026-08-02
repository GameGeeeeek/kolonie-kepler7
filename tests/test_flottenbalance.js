const { SERVER_JS, SPIELDATEI, ueberspringen } = require('./lib/umgebung');
// Flottenaufbau-Bonus: belohnt jetzt Rollenbalance statt Typen-Checkliste.
// Prueft die Absicht (ausgewogen = Praemie, spezialisiert = Konterchance) und die FE/BE-Paritaet.
const fs = require('fs');
if (!SERVER_JS) ueberspringen('Flottenbalance vergleicht Frontend und Backend Zeile fuer Zeile - das Backend-Repo (kolonie-kepler7-backend) liegt hier nicht daneben.');
let fail=false; const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

const FEsrc = fs.readFileSync(SPIELDATEI,'utf8');
const BEsrc = fs.readFileSync(SERVER_JS,'utf8');

// --- Frontend: Konterblock + SHIP_DEFS + Balancefunktion zusammensetzen
function schnitt(s, von, bis){ const a=s.indexOf(von), b=s.indexOf(bis,a); if(a<0||b<0) throw new Error('nicht gefunden: '+von); return s.slice(a,b); }
const feKonter = schnitt(FEsrc, 'const COUNTER_ROLE_DEFS = [', '// ===== Taktik-Stance =====');
const feBal    = schnitt(FEsrc, 'const FLEET_BALANCE_MAX_BONUS', '// ===== Schiffsklassen');
const feCtx={};
new Function('ctx', feKonter + feBal + ';ctx.f=fleetDiversityMult;ctx.OF=COUNTER_ROLE_OF;ctx.cm=counterMultiplier;ctx.ATK=COUNTER_ROLE_ATK;')(feCtx);

const beAtk    = schnitt(BEsrc, 'const COUNTER_ROLE_ATK = {', '};') + '};';
const beKonter = schnitt(BEsrc, 'const COUNTER_ROLE_DEFS = [', 'function counterMultiplier');
const beBal    = schnitt(BEsrc, 'function fleetDiversityMult', '\n// enemyFleetForCounter');
const beCtx={};
new Function('ctx', 'const FLEET_BALANCE_MAX_BONUS=0.08;' + beAtk + '\n' + beKonter + beBal + ';ctx.f=fleetDiversityMult;ctx.ATK=COUNTER_ROLE_ATK;')(beCtx);

// Die Gewichtstabellen selbst muessen zeichengleich sein - sonst driften beide Seiten still auseinander.
check('Angriffsgewichte sind auf beiden Seiten identisch',
  JSON.stringify(Object.entries(feCtx.ATK).sort()) === JSON.stringify(Object.entries(beCtx.ATK).sort()),
  { nurFE: Object.keys(feCtx.ATK).filter(k=>feCtx.ATK[k]!==beCtx.ATK[k]) });
// Und jedes Schiff mit Konterrolle braucht ein Gewicht, sonst zaehlt es stillschweigend als 0.
check('jedes Schiff mit Konterrolle hat ein Angriffsgewicht',
  Object.keys(feCtx.OF).every(k => typeof feCtx.ATK[k] === 'number'),
  Object.keys(feCtx.OF).filter(k => typeof feCtx.ATK[k] !== 'number'));

const F=feCtx.f, B=beCtx.f;

// --- Absicht 1: eine ueber alle drei Rollen ausgewogene Flotte bekommt (fast) die vollen +8%.
// Nach Angriffskraft gewichtet: jaeger 10, bomber 60, cruisers 20.
const ausgewogen = { jaeger: 600, bomber: 100, cruisers: 300 }; // 6000 / 6000 / 6000
const v1 = F(ausgewogen);
check('perfekt ausgewogene Flotte erhaelt die vollen +8%', Math.abs(v1-1.08)<0.005, { wert:v1.toFixed(4) });

// --- Absicht 2: eine reine Ein-Rollen-Flotte bekommt gar nichts.
check('reine Bomberflotte erhaelt +0%', Math.abs(F({bomber:1000})-1)<1e-9, { wert:F({bomber:1000}) });
check('reine Grosskampfflotte erhaelt +0%', Math.abs(F({schlachtschiff:500,cruisers:200})-1)<1e-9);

// --- Absicht 3: die alte Checkliste zieht NICHT mehr. Fuenf Typen aus EINER Rolle sind kein Bonus.
//
// Die Beispielflotte wird seit dem 02.08.2026 AUS DER ROLLENTABELLE GEBAUT statt danebengeschrieben.
// Vorher stand hier eine feste Liste mit dem Carrier darin - und als der bei der Neuverteilung der
// Konterrollen (5/5/11 -> 7/6/8) vom Grosskampfschiff zum Abfangjaeger wurde, prueften diese Zeilen
// stillschweigend etwas anderes als ihren eigenen Titel: fuenf Typen aus ZWEI Rollen, die
// folgerichtig +1% Bonus ergaben. Der Test hat das gemeldet, was richtig war - aber eine Liste, die
// bei jeder Rollenaenderung von Hand nachgezogen werden muss, meldet es beim naechsten Mal nur mit
// Glueck wieder. Jetzt nimmt er einfach die ersten fuenf Klassen, die WIRKLICH dieselbe Rolle haben.
const eineRolle = Object.keys(feCtx.OF).filter(k => feCtx.OF[k] === 'kapital').slice(0, 5);
check('genug Klassen fuer die Ein-Rollen-Probe vorhanden', eineRolle.length === 5, eineRolle);
const fuenfTypenEineRolle = {};
for (const k of eineRolle) fuenfTypenEineRolle[k] = 100;
check('fuenf Typen aus derselben Rolle geben keinen Bonus mehr', Math.abs(F(fuenfTypenEineRolle)-1)<1e-9,
  { wert:F(fuenfTypenEineRolle), klassen:eineRolle, hinweis:'frueher waren das +8%' });

// --- Absicht 4: Gewichtung nach Angriffskraft, nicht nach Stueckzahl.
// 500 Jaeger (5000 Kraft) + 1 Schlachtschiff (90) ist NICHT ausgewogen, auch wenn zwei Rollen da sind.
const alibiSchiff = { jaeger:500, schlachtschiff:1 };
check('ein Alibi-Schiff erzeugt keine Ausgewogenheit', F(alibiSchiff) < 1.01, { wert:F(alibiSchiff).toFixed(4) });

// --- Absicht 5: der Hoechstwert bleibt bei +8% (keine stille Inflation).
const ships = Object.keys(feCtx.OF);
const rnd = n => { const f={}; for(let i=0;i<n;i++) f[ships[Math.floor(Math.random()*ships.length)]] = 1+Math.floor(Math.random()*800); return f; };
let max=-Infinity, min=Infinity;
for(let i=0;i<5000;i++){ const v=F(rnd(1+Math.floor(Math.random()*6))); max=Math.max(max,v); min=Math.min(min,v); }
check('bei 5000 Zufallsflotten bleibt der Bonus in [1.00, 1.08]', min>=1-1e-9 && max<=1.08+1e-9, { min:min.toFixed(4), max:max.toFixed(4) });

// --- Paritaet: Frontend und Backend muessen denselben Wert liefern.
let gleich=true, gegen=null;
for(let i=0;i<3000;i++){ const f=rnd(1+Math.floor(Math.random()*6));
  if (Math.abs(F(f)-B(f))>1e-9){ gleich=false; gegen={f,fe:F(f),be:B(f)}; break; } }
check('Frontend und Backend rechnen identisch', gleich, gegen);

// --- Die eigentliche Entscheidung muss tragen: Spezialisierung + Aufklaerung schlaegt Allzweck.
const cmCtx = feCtx; // counterMultiplier kommt aus demselben Block
const gegnerKapital = { schlachtschiff:400, quantenkreuzer:150 };
const spezialisiert = { hyperbomber:300 };
const wertSpezialisiert = F(spezialisiert) * cmCtx.cm(spezialisiert, gegnerKapital);
const wertAusgewogen  = F(ausgewogen)    * cmCtx.cm(ausgewogen,    gegnerKapital);
check('gezielt spezialisiert schlaegt die Allzweckflotte beim richtigen Ziel',
  wertSpezialisiert > wertAusgewogen, { spezialisiert:wertSpezialisiert.toFixed(3), ausgewogen:wertAusgewogen.toFixed(3) });
const gegnerAbfang = { jaeger:2000, hyperjaeger:400 };
const wertFalsch = F(spezialisiert) * cmCtx.cm(spezialisiert, gegnerAbfang);
const wertAusgewogen2 = F(ausgewogen) * cmCtx.cm(ausgewogen, gegnerAbfang);
check('beim FALSCHEN Ziel faellt die Spezialflotte hinter die Allzweckflotte zurueck',
  wertFalsch < wertAusgewogen2, { spezialisiert:wertFalsch.toFixed(3), ausgewogen:wertAusgewogen2.toFixed(3) });

console.log(fail?'\nFAIL':'\nPASS'); process.exit(fail?1:0);
