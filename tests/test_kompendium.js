// Galaktisches Kompendium, Erweiterung v8.298.13 (Inhaltspaket 3/5) von fuenf auf acht Kategorien.
//
// Die tragende Regel des Kompendiums steht als Kommentar im Code: "rein aus bestehenden
// State-Feldern berechnet (keine neuen Tracker)". Genau die prueft dieser Test - eine Kategorie, die
// heimlich einen neuen Zaehler braeuchte, wuerde bei Altstaenden dauerhaft auf 0 stehen.
//
// Geprueft wird:
//   1) acht Kategorien, jede mit Icon (Whitelist), Beschreibung, Belohnung, have() und total()
//   2) have()/total() laufen ohne Absturz auf einem LEEREN und auf einem VOLLEN Zustand
//   3) leer ergibt 0, voll ergibt total() - die Kategorie ist also ueberhaupt erfuellbar
//   4) keine Kategorie braucht ein Zustandsfeld, das es nicht gibt
//   5) die Hilfe nennt die richtige Anzahl
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const whitelist = new Set([...src.matchAll(/^\s*\.(ti-[a-z0-9-]+):before/gm)].map(m => m[1]));
const von = src.indexOf('const COMPENDIUM_CATS = [');
const bis = src.indexOf('function claimCompendium', von);
check('Kompendium-Block gefunden', von > 0 && bis > von);
if (von < 0) { console.log('\nFAIL'); process.exit(1); }
const block = src.slice(von, bis);

// Attrappen fuer alles, was die Kategorien anfassen - bewusst mit ECHTEN Laengen aus der Spieldatei,
// damit total() plausible Werte liefert.
const laenge = (name) => (((src.match(new RegExp('const ' + name + ' = \\[[\\s\\S]*?\\n  \\];')) || [''])[0]).match(/\{ key:'/g) || []).length;
const N = {
  PLANETS: 40, STAR_SYSTEMS: 12,
  ACHIEVEMENTS: laenge('ACHIEVEMENTS'), SHIP_DEFS: laenge('SHIP_DEFS'),
  MODULE_DEFS: laenge('MODULE_DEFS'), BUILDING_DEFS: laenge('BUILDING_DEFS')
};
check('Bestandszahlen gelesen', N.ACHIEVEMENTS > 50 && N.SHIP_DEFS > 20 && N.MODULE_DEFS > 5 && N.BUILDING_DEFS > 20, N);

const liste = (n, praefix) => new Array(n).fill(0).map((_, i) => ({ key: praefix + i, id: praefix + i, system: 's' + (i % 12) }));
const DEFS = {
  PLANETS: liste(N.PLANETS, 'p'),
  STAR_SYSTEMS: new Array(N.STAR_SYSTEMS).fill(0).map((_, i) => ({ id: 's' + i })),
  ACHIEVEMENTS: liste(N.ACHIEVEMENTS, 'a'),
  SHIP_DEFS: liste(N.SHIP_DEFS, 'sh'),
  MODULE_DEFS: liste(N.MODULE_DEFS, 'mo'),
  BUILDING_DEFS: liste(N.BUILDING_DEFS, 'bd'),
  FACTION_DIPLOMACY: { kartell:{}, void:{}, legion:{}, schatten:{} }
};

function baue(state){
  const ctx = {};
  const allFleets = () => [state.fleet || {}].concat(Object.values(state.colonies || {}).map(c => c.fleet || {}));
  const allBuildingSets = () => [state.buildings || {}].concat(Object.values(state.colonies || {}).map(c => c.buildings || {}));
  new Function('ctx', 'state', 'PLANETS', 'STAR_SYSTEMS', 'ACHIEVEMENTS', 'SHIP_DEFS', 'MODULE_DEFS',
    'BUILDING_DEFS', 'FACTION_DIPLOMACY', 'allFleets', 'allBuildingSets',
    block + ';ctx.CATS=COMPENDIUM_CATS;')(ctx, state, DEFS.PLANETS, DEFS.STAR_SYSTEMS, DEFS.ACHIEVEMENTS,
    DEFS.SHIP_DEFS, DEFS.MODULE_DEFS, DEFS.BUILDING_DEFS, DEFS.FACTION_DIPLOMACY, allFleets, allBuildingSets);
  return ctx.CATS;
}

// ---------------------------------------------------------------- 1) Form
const leerState = { discovered:{}, npcScaling:{}, factionRep:{}, achievements:{}, fleet:{}, buildings:{}, colonies:{}, modules:{}, equippedModules:{} };
const cats = baue(leerState);
check('1: acht Kategorien', cats.length === 8, cats.length);
check('1: jede Kategorie hat ein Icon aus der Whitelist',
  cats.every(c => whitelist.has(c.icon)), cats.filter(c => !whitelist.has(c.icon)).map(c => c.key + '=' + c.icon));
check('1: jede Kategorie hat Name, Beschreibung und Belohnung',
  cats.every(c => c.name && c.desc && c.reward && (c.reward.essence || c.reward.credits)),
  cats.filter(c => !(c.name && c.desc && c.reward)).map(c => c.key));
check('1: keine doppelten Schlüssel', new Set(cats.map(c => c.key)).size === cats.length);

// ---------------------------------------------------------------- 2/3/4) leer und voll
let fehler = [];
const leerWerte = cats.map(c => { try { return { key:c.key, have:c.have(), total:c.total() }; } catch(e){ fehler.push(c.key+': '+e.message); return null; } });
check('2: alle Kategorien laufen auf einem leeren Zustand ohne Absturz', fehler.length === 0, fehler);
check('3: auf einem leeren Zustand steht jede Kategorie auf 0',
  leerWerte.every(w => w && w.have === 0), leerWerte.filter(w => w && w.have !== 0));
check('3: jede Kategorie hat ein positives Ziel',
  leerWerte.every(w => w && w.total > 0), leerWerte.filter(w => w && !(w.total > 0)));

// Voller Zustand: alles entdeckt, alle Bosse, alle Fraktionen, alle Erfolge, je ein Schiff/Modul/Gebäude.
const vollState = {
  discovered:{}, npcScaling:{ boss1:1, boss2:1, boss3:1 }, factionRep:{ kartell:5, void:5, legion:5, schatten:5 },
  achievements:{}, fleet:{}, buildings:{}, colonies:{}, modules:{}, equippedModules:{ home:[] }
};
DEFS.PLANETS.forEach(p => { vollState.discovered[p.id] = true; });
DEFS.ACHIEVEMENTS.forEach(a => { vollState.achievements[a.key] = true; });
DEFS.SHIP_DEFS.forEach(s => { vollState.fleet[s.key] = 1; });
DEFS.BUILDING_DEFS.forEach(b => { vollState.buildings[b.key] = 1; });
// Modularten absichtlich GEMISCHT: die Haelfte im Inventar, die Haelfte eingebaut - genau diese
// Zusammenfuehrung ist die Stelle, an der die Kategorie leicht die Haelfte uebersehen wuerde.
DEFS.MODULE_DEFS.forEach((m, i) => {
  if (i % 2 === 0) vollState.modules[m.key + ':selten'] = 1;
  else vollState.equippedModules.home.push(m.key + ':episch');
});
fehler = [];
const vollCats = baue(vollState);
const vollWerte = vollCats.map(c => { try { return { key:c.key, have:c.have(), total:c.total() }; } catch(e){ fehler.push(c.key+': '+e.message); return null; } });
check('2: alle Kategorien laufen auch auf einem vollen Zustand ohne Absturz', fehler.length === 0, fehler);
const nichtVoll = vollWerte.filter(w => w && w.have < w.total);
check('4: mit vollem Bestand ist jede Kategorie erfüllt', nichtVoll.length === 0, nichtVoll);
check('4: das Modulkabinett zählt Inventar UND eingebaute Module zusammen',
  (vollWerte.find(w => w.key === 'modules') || {}).have === N.MODULE_DEFS,
  vollWerte.find(w => w.key === 'modules'));
// Die drei neuen Kategorien muessen auch Kolonien einbeziehen, nicht nur die Heimatbasis.
const nurKolonie = { discovered:{}, npcScaling:{}, factionRep:{}, achievements:{}, fleet:{}, buildings:{},
  colonies:{ k1:{ fleet:{ sh0:3 }, buildings:{ bd0:2 } } }, modules:{}, equippedModules:{} };
const kCats = baue(nurKolonie);
check('4: Schiffsregister und Gebäudearchiv zählen auch Kolonien mit',
  kCats.find(c => c.key === 'ships').have() === 1 && kCats.find(c => c.key === 'buildings').have() === 1,
  { ships: kCats.find(c => c.key === 'ships').have(), buildings: kCats.find(c => c.key === 'buildings').have() });

// ---------------------------------------------------------------- 5) Hilfe mitgezogen
check('5: die Hilfe nennt acht Kategorien', /Kompendium deinen Sammel-Fortschritt über die ganze Galaxie in acht Kategorien/.test(src));
check('5: und beschreibt die drei neuen', /Schiffsregister/.test(src) && /Modulkabinett/.test(src) && /Gebäudearchiv/.test(src));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
