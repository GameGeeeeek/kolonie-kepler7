// Die sechs Abgrund-Schiffsmodule (28.07.2026, v8.335.0, Roadmap Phase 2, zweite Haelfte).
//
// Tiefenkiel, Schwarmoptik, Resonanzlanze, Bergungsklaue, Stillgaenger, Waechterbann.
//
// Der Unterschied zu den vier Standortmodulen aus v8.334.0 ist die GRENZE: Jene wirken oben, weil
// sie Wirtschaft und NPC-Abwehr betreffen. Diese sechs betreffen Kampfkraft, Verluste und
// Frachtraum - und dort darf Abgrund-Ausruestung keinen Vorsprung gegen Mitspieler geben. Der
// wichtigste Abschnitt dieses Tests ist deshalb Abschnitt 2: KEINE der sechs Wirkungen darf
// ausserhalb des Abgrunds ankommen.
//
// Zwei Entwurfsaenderungen gegenueber der Roadmap stehen hier mit ihrer Begruendung, damit sie
// nicht spaeter als Versehen "korrigiert" werden:
//   - Der Stillgaenger sollte "ausspaehen, ohne einen Tauchgang zu verbrauchen". Tauchgaenge sind
//     aber gar nicht kontingentiert - es gibt nichts zu verbrauchen. Er erweitert stattdessen die
//     Reichweite der Tiefensonde, die genau diese Aufgabe schon hat.
//   - Der Waechterbann sollte die Waechter-Staerke senken. Waechter sind seit v8.333.0 der einzige
//     Grund, eine geknackte Zehnertiefe zu wiederholen (4x Bergungsgut); sie pauschal zu
//     schwaechen haette genau diese Schleife aufgeblasen. Er wirkt deshalb NUR in Tiefen, die noch
//     nie bezwungen wurden - er hilft beim Tieferkommen, nicht beim Abernten.
const fs = require('fs');
const path = require('path');
// Pfad ueber die gemeinsame Quelle, nicht fest verdrahtet: Sonst wird KEPLER_SPIELDATEI
// still ignoriert und eine Gegenprobe liest die ECHTE Datei - sie sieht dann aus wie
// bestanden (CLAUDE.md, Korrektur zu Regel 14).
const { SPIELDATEI } = require('./lib/spieldatei');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

function fnAus(n){
  const m = js.match(new RegExp('function\\s+'+n+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+n);
  const i = js.indexOf(m[0]);
  let d=0, s=js.indexOf('{', i+m[0].length), k=s;
  for (; k<js.length; k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}
function arrAus(name){
  const i = js.indexOf('const '+name+' = [');
  let d=0, s=js.indexOf('[', i), k=s;
  for (; k<js.length; k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}
const zahl = n => Number((js.match(new RegExp('const '+n+' = ([\\d.]+)'))||[])[1]);
const lade = n => new Function("const HERKUNFT_NORMAL='normal', HERKUNFT_ABGRUND='abgrund', HERKUNFT_BOSS='boss', HERKUNFT_UNIKAT='unikat', HERKUNFT_KONVOI='konvoi'; return "+arrAus(n))();

const SHIP_MODULE_DEFS = lade('SHIP_MODULE_DEFS');
const SHIP_CLASS_DEFS  = lade('SHIP_CLASS_DEFS');
const SECHS = ['ab_tiefenkiel','ab_schwarmoptik','ab_resonanzlanze','ab_bergungsklaue','ab_stillgaenger','ab_waechterbann'];
const defOf = k => SHIP_MODULE_DEFS.find(d => d.key === k);

// ---- 1) Vollstaendigkeit (CLAUDE.md Regel 7) ----
check('1: alle sechs Module sind angelegt', SECHS.every(k => !!defOf(k)), SECHS.filter(k=>!defOf(k)));
const ICON_KEYS = new Set(Array.from(js.matchAll(/^\s{4}([a-z][a-z0-9_]*): `<svg/gm)).map(m=>m[1]));
const KLASSEN = new Set(SHIP_CLASS_DEFS.map(c=>c.key));
for (const k of SECHS){
  const d = defOf(k); if (!d) continue;
  check('1: '+k.padEnd(17)+' eigenes gezeichnetes Icon', !/^ti-/.test(d.icon) && ICON_KEYS.has(d.icon), { icon:d.icon });
  check('1: '+k.padEnd(17)+' vollstaendige Beschreibung', (d.desc||'').length >= 200, { laenge:(d.desc||'').length });
  check('1: '+k.padEnd(17)+' Abgrund-Herkunft', d.quelle === 'abgrund', { quelle:d.quelle });
  check('1: '+k.padEnd(17)+' haengt an einer echten Schiffsklasse', KLASSEN.has(d.klasse), { klasse:d.klasse });
  // Hausregel aus test_bonibilanz: die Boni-Bilanz nennt Deckel an EINER Stelle.
  check('1: '+k.padEnd(17)+' wiederholt keine Obergrenze', !/gedeckelt|Obergrenze/.test(d.desc||''));
}
const LABEL = new Function('return '+js.slice(js.indexOf('{', js.indexOf('const SHIP_MODULE_EFFECT_LABEL')), js.indexOf('};', js.indexOf('const SHIP_MODULE_EFFECT_LABEL'))+1))();
check('1: jeder neue Effekt hat eine deutsche Beschriftung',
  SECHS.every(k => !!LABEL[defOf(k).effect]),
  SECHS.map(k => defOf(k).effect+' -> '+(LABEL[defOf(k).effect]||'FEHLT')));
// Eigene Effektnamen: Wuerde eins der sechs einen vorhandenen Effekt (atk/hull/cargo/...) benutzen,
// waere es sofort auch ausserhalb des Abgrunds wirksam - genau das soll nicht sein.
const ALTE_EFFEKTE = new Set(SHIP_MODULE_DEFS.filter(d => d.quelle !== 'abgrund').map(d => d.effect));
check('1: keins der sechs benutzt einen bereits vorhandenen Effektnamen',
  SECHS.every(k => !ALTE_EFFEKTE.has(defOf(k).effect)),
  SECHS.filter(k => ALTE_EFFEKTE.has(defOf(k).effect)));

// ---- 2) DIE GRENZE: nichts davon wirkt ausserhalb des Abgrunds ----
// Gesucht wird jede Verwendung der sechs Effektnamen im Quelltext. Jede muss in einer Funktion
// liegen, die zum Abgrund gehoert. Faende sich eine in attackPower(), defensePower() oder
// fleetCargoCapacity(), waere die Grenze gefallen - und zwar unbemerkt, weil das Spiel weiterlaeuft.
const ABGRUND_FUNKTIONEN = ['abgrundKampfkraft','abgrundSchiffsmodul','abgrundSondeReichweite'];
const zeilen = js.split('\n');
for (const k of SECHS){
  const eff = defOf(k).effect;
  const treffer = [];
  for (const m of js.matchAll(new RegExp("'"+eff+"'", 'g'))){
    const zeile = js.slice(0, m.index).split('\n').length;
    const z = zeilen[zeile-1];
    if (z.trim().startsWith('//')) continue;
    if (/effect:'/.test(z) || new RegExp(eff+":'").test(z)) continue;  // Definition und Beschriftung
    treffer.push(zeile);
  }
  check('2: '+eff.padEnd(14)+' wird ueberhaupt irgendwo verrechnet', treffer.length > 0, { zeilen:treffer });
}
// Die drei Funktionen, die PvP und normale Missionen speisen, duerfen KEINEN der sechs Effekte kennen.
const EFFEKTE = SECHS.map(k => defOf(k).effect);
for (const fn of ['attackPowerRaw','defenseCombatBonusRaw','defensePower','fleetCargoCapacity','fleetDiversityMult']){
  const quelle = fnAus(fn);
  const drin = EFFEKTE.filter(e => quelle.includes("'"+e+"'"));
  check('2: '+fn.padEnd(22)+' kennt keinen Abgrund-Effekt (PvP und normale Missionen bleiben unberuehrt)',
    drin.length === 0, drin);
}
// Die Schwarmoptik LIEST fleetDiversityMult, aber sie darf die Funktion nicht veraendern - sonst
// stiege der Vielfalts-Bonus auch im PvP.
check('2: die Schwarmoptik liest die Vielfalt, statt sie global anzuheben',
  /fleetDiversityMult\(flotte\) - 1/.test(fnAus('abgrundKampfkraft')) &&
  !/vielfalt/.test(fnAus('fleetDiversityMult')));
// Die Bergungsklaue darf fleetCargoCapacity nicht anfassen - die speist auch die Lagerkapazitaet.
check('2: die Bergungsklaue erweitert den Frachtraum nur an der Abgrund-Stelle',
  /Math\.round\(fleetCargoCapacity\(m\.composition \|\| fleet\) \* \(1 \+ klaue\)\)/.test(js));

// ---- 3) Die Klassenbedingung, ausgefuehrt ----
// Ein Tiefenkiel im Schlachtschiff-Slot soll nichts bewirken, wenn kein Schlachtschiff mitfliegt.
const ASM = new Function('shipModuleBonusFor, SHIP_CLASS_DEFS', fnAus('abgrundSchiffsmodul')+'; return abgrundSchiffsmodul;');
const asm = (flotte, klasse, bonus) => ASM(() => bonus, SHIP_CLASS_DEFS)(flotte, klasse, 'egal');
check('3: mit passenden Schiffen greift das Modul', asm({ schlachtschiff:5 }, 'schlachtschiff', 0.1) === 0.1);
check('3: ohne passende Schiffe greift es nicht', asm({ jaeger:500 }, 'schlachtschiff', 0.1) === 0);
check('3: eine leere Flotte liefert 0 statt NaN', asm({}, 'schlachtschiff', 0.1) === 0 && asm(null, 'schlachtschiff', 0.1) === 0);
check('3: ohne Modul bleibt es 0, auch mit passenden Schiffen', asm({ schlachtschiff:5 }, 'schlachtschiff', 0) === 0);
check('3: eine unbekannte Klasse liefert 0 statt eines Absturzes', asm({ jaeger:1 }, 'gibtsnicht', 0.1) === 0);
// Die Klasse muss ALLE ihre Schiffe akzeptieren, nicht nur das erstgenannte.
const jg = SHIP_CLASS_DEFS.find(c=>c.key==='jagdgeschwader');
check('3: jedes Schiff der Klasse zaehlt, nicht nur das erste',
  jg.shipKeys.every(k => asm({ [k]:1 }, 'jagdgeschwader', 0.1) === 0.1), jg.shipKeys);

// ---- 4) Kampfkraft: die drei Module darin, ausgefuehrt ----
// tiefenschiffBonus steht seit v8.338.0 (Presslufthai) mit in der Funktion. Hier eine Attrappe, die
// immer 0 liefert: Dieser Test prueft die MODULE, und die Tiefenflotte hat ihren eigenen
// (tests/test_tiefenflotte.js, Abschnitt 6). Ohne die Attrappe waere es ein ReferenceError.
const KK = new Function(
  'state, abgrundKanalBonus, abgrundSchiffsmodul, fleetDiversityMult, FLEET_BALANCE_MAX_BONUS, ABGRUND_KRAFT_DECKEL, tiefenschiffBonus',
  fnAus('abgrundKampfkraft')+'; return abgrundKampfkraft;'
);
const DECKEL = zahl('ABGRUND_KRAFT_DECKEL');
const BAL = zahl('FLEET_BALANCE_MAX_BONUS');
// Attrappen: nur das jeweils gepruefte Modul liefert einen Bonus.
function kraft(opt){
  const o = opt||{};
  return KK({ abgrund:{ best: o.best||0 } },
    () => 0,
    (f, klasse, effect) => (o.modul === effect ? (o.wert||0.1) : 0),
    () => 1 + (o.balance||0)*BAL,
    BAL, DECKEL, () => 0
  )(1000, { mods:{atk:1}, mutatoren: new Array(o.mut||0).fill({}), waechter: o.waechter||null, tiefe: o.tiefe||1 }, o.flotte||{ jaeger:1 });
}
check('4: ohne Module ist die Kampfkraft unveraendert', kraft({}) === 1000, { k:kraft({}) });
check('4: die Resonanzlanze bringt in einem Sektor OHNE Mutatoren nichts',
  kraft({ modul:'resonanz', mut:0 }) === 1000);
check('4: und waechst mit jedem Mutator',
  kraft({ modul:'resonanz', mut:1 }) < kraft({ modul:'resonanz', mut:3 }),
  { einer:kraft({modul:'resonanz',mut:1}), drei:kraft({modul:'resonanz',mut:3}) });
check('4: die Schwarmoptik bringt einer EINSEITIGEN Flotte nichts',
  kraft({ modul:'vielfalt', balance:0 }) === 1000);
check('4: und einer ausgewogenen etwas',
  kraft({ modul:'vielfalt', balance:1 }) > 1000, { k:kraft({modul:'vielfalt',balance:1}) });
// Der Waechterbann - der Kern der Entwurfsaenderung.
check('4: der Waechterbann wirkt NICHT ohne Waechter',
  kraft({ modul:'waechterbann', tiefe:10, best:0 }) === 1000);
check('4: er wirkt in einer NOCH NIE bezwungenen Waechtertiefe',
  kraft({ modul:'waechterbann', waechter:{}, tiefe:10, best:0 }) > 1000,
  { k:kraft({modul:'waechterbann',waechter:{},tiefe:10,best:0}) });
check('4: er wirkt NICHT in einer bereits bezwungenen Waechtertiefe (das Abernten bleibt gleich schwer)',
  kraft({ modul:'waechterbann', waechter:{}, tiefe:10, best:10 }) === 1000);
check('4: auch nicht in einer laengst ueberholten Tiefe',
  kraft({ modul:'waechterbann', waechter:{}, tiefe:10, best:80 }) === 1000);
// Deckel an einem uebertriebenen Wert gemessen - mit den heutigen Zahlen (base 0.06 x 3 Mutatoren)
// wird er nie erreicht, eine Pruefung an realistischen Werten koennte gar nicht fehlschlagen.
check('4: die Kampfkraft-Gruppe ist gedeckelt',
  Math.abs(kraft({ modul:'resonanz', mut:3, wert:99 }) - 1000*(1+DECKEL)) < 1e-6,
  { k:kraft({modul:'resonanz',mut:3,wert:99}), erwartet:1000*(1+DECKEL) });
// Vorschau und Aufloesung MUESSEN dieselbe Funktion mit derselben Flotte fuettern.
check('4: Vorschau und Aufloesung geben beide die Flotte mit',
  /abgrundKampfkraft\(rohkraft, sektor, flotte\)/.test(js) &&
  /abgrundKampfkraft\(rohkraft, sektor, m\.composition \|\| fleet\)/.test(js));

// ---- 5) Tiefenkiel: Verluste ----
// Fenster grosszuegig: Seit v8.337.0 steht der Kessel-Kommentar zwischen Kiel-Definition und
// Verlustzeile. Ein zu enges Fenster haette die Pruefung stillschweigend ins Leere laufen lassen.
const kielStelle = js.slice(js.indexOf("const kiel = abgrundSchiffsmodul"), js.indexOf("const kiel = abgrundSchiffsmodul")+1200);
check('5: der Kiel skaliert mit der Tiefe', /Math\.min\(1, tiefe\/50\)/.test(kielStelle), kielStelle.split('\n')[0]);
check('5: er ist eigenstaendig gedeckelt', /Math\.min\(0\.5, kiel\)/.test(kielStelle));
// Multiplikativ AUF den Werkstattschutz: eine gemeinsame additive Gruppe wuerde die 60%-Deckelung
// der Tiefenpanzerung still aushebeln.
// Seit v8.337.0 haengt der Kessel als DRITTER Faktor daran. Die Aussage bleibt dieselbe: drei
// Quellen, die denselben Wert senken, wirken multiplikativ statt in einer gemeinsamen additiven
// Gruppe - addiert laendeten sie schnell bei 100%, multiplikativ naehern sie sich der Null an.
check('5: er wirkt multiplikativ auf den Werkstatt-/Reliquienschutz, nicht in derselben Gruppe',
  /\(1 - abgrundKanalBonus\('verlust'\)\) \* \(1 - Math\.min\(0\.5, kiel\)\) \* \(1 - kesselSchutz\)/.test(js));

// ---- 6) Stillgaenger: Sondenreichweite ----
const SR = new Function('abgrundWerkstattBonus, shipModuleBonusFor, ABGRUND_STILLGAENGER_MAX, state, lotsenbootSicht',
  fnAus('abgrundSondeReichweite')+'; return abgrundSondeReichweite;');
const MAXS = zahl('ABGRUND_STILLGAENGER_MAX');
// state kommt seit v8.336.0 dazu: abgrundSondeReichweite liest darin das Tiefenlot. Hier ohne
// Lot, damit dieser Abschnitt weiterhin nur den Stillgaenger misst.
const sicht = (werkstatt, modul) => SR(() => werkstatt, () => modul, MAXS, { abgrund:{} }, () => 0)();
check('6: ohne alles ist die Reichweite 0', sicht(0,0) === 0);
check('6: gekaufte Werkstattstufen zaehlen weiterhin', sicht(2,0) === 2);
check('6: das Modul wirkt auch ohne gekaufte Sonde', sicht(0,1) === 1);
check('6: beides addiert sich', sicht(2,1) === 3);
check('6: Bruchteile eines Moduls geben noch keine ganze Tiefe', sicht(0,0.9) === 0, { r:sicht(0,0.9) });
check('6: der Modulanteil ist gedeckelt, die Werkstatt nicht',
  sicht(0,99) === MAXS && sicht(5,99) === 5+MAXS, { nurModul:sicht(0,99), max:MAXS });

// ---- 7) Die zwei Entwurfsaenderungen sind dokumentiert ----
// Sie weichen bewusst von der Roadmap ab. Steht der Grund nirgends, wird die Abweichung beim
// naechsten Durchgang fuer ein Versehen gehalten und "reparariert".
check('7: die Waechterbann-Beschreibung sagt dem Spieler, dass nur neue Tiefen zaehlen',
  /noch nie bezwungen/.test(defOf('ab_waechterbann').desc));
check('7: und die Stillgaenger-Beschreibung nennt die Sonde als das, was er erweitert',
  /Tiefensonde/.test(defOf('ab_stillgaenger').desc));

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
