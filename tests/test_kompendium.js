// Galaktisches Kompendium: v8.298.13 (Inhaltspaket 3/5) von fuenf auf acht Kategorien, v8.343.0
// auf zehn (Reliquien der Tiefe, Konstellationen).
//
// Die tragende Regel des Kompendiums steht als Kommentar im Code: "rein aus bestehenden
// State-Feldern berechnet (keine neuen Tracker)". Genau die prueft dieser Test - eine Kategorie, die
// heimlich einen neuen Zaehler braeuchte, wuerde bei Altstaenden dauerhaft auf 0 stehen.
//
// Geprueft wird:
//   1) zehn Kategorien, jede mit Icon (Whitelist), Beschreibung, Belohnung, have() und total()
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
  FACTION_DIPLOMACY: { kartell:{}, void:{}, legion:{}, schatten:{} },
  // Reliquien und Konstellationen (v8.343.0). Wie bei den anderen Listen mit der ECHTEN Laenge
  // aus der Spieldatei, damit total() plausibel ist statt frei erfunden.
  ABGRUND_RELIKTE: liste(laenge('ABGRUND_RELIKTE'), 'rel'),
  ABGRUND_KONSTELLATIONEN: liste(laenge('ABGRUND_KONSTELLATIONEN'), 'kon'),
  /* Festungen und Voelker (Phase 6). Beide Tabellen sind OBJEKTE, keine Listen wie die
     Eintraege darueber - die Attrappen bilden das nach, damit total() (Object.keys(...).length)
     dieselbe Zahl liefert wie im Spiel. Die Schluessel werden aus der Spieldatei gelesen, nicht
     getippt: sonst waere die Erwartung eine zweite Wahrheit neben der Tabelle. */
  FESTUNG_STUFEN: Object.fromEntries((((src.match(/const FESTUNG_STUFEN = \{[\s\S]*?\n  \};/) || [''])[0]).match(/^\s{4}[a-z]+: *\{/gm) || []).map((m, i) => [m.trim().replace(/: *\{/, ''), { name: 'st' + i }])),
  ALIEN_VOELKER: Object.fromEntries((((src.match(/const ALIEN_VOELKER = \{[\s\S]*?\n  \};/) || [''])[0]).match(/^\s{4}[a-z]+: *\{/gm) || []).map((m, i) => [m.trim().replace(/: *\{/, ''), { name: 'v' + i }]))
};
check('Bestandszahlen Festungen/Voelker gelesen',
  Object.keys(DEFS.FESTUNG_STUFEN).length >= 3 && Object.keys(DEFS.ALIEN_VOELKER).length >= 4,
  { festungStufen: Object.keys(DEFS.FESTUNG_STUFEN).length, voelker: Object.keys(DEFS.ALIEN_VOELKER).length });
check('Bestandszahlen Abgrund gelesen',
  DEFS.ABGRUND_RELIKTE.length > 0 && DEFS.ABGRUND_KONSTELLATIONEN.length > 0,
  { relikte:DEFS.ABGRUND_RELIKTE.length, konstellationen:DEFS.ABGRUND_KONSTELLATIONEN.length });

// Unikate (v8.464.0, Arbeitsregel 9 - Erwartungen mitgezogen): Anzahl aus der Spieldatei
// ablesen, nicht raten. Die Kategorie zaehlt Modul-TYPEN, deshalb tragen die Attrappen
// Fundort-Texte wie die echten Defs.
const UNIKAT_ANZAHL = (src.match(/quelle:HERKUNFT_UNIKAT,/g) || []).length;
check('Unikat-Anzahl gelesen', UNIKAT_ANZAHL >= 2, UNIKAT_ANZAHL);
DEFS.UNIKATE = new Array(UNIKAT_ANZAHL).fill(0).map((_, i) => ({ key:'uni'+i, name:'Unikat '+i, fundort:'Ort '+i }));
// besitztModulTyp kommt als ECHTE Funktion aus der Spieldatei - genau ihre Vier-Quellen-Regel
// ("Inventar UND eingebaut, beide Modulsysteme") ist das, was hier gedeckt sein soll.
const iBmt = src.indexOf('function besitztModulTyp(s, typKey){');
const bmtQuelle = iBmt > 0 ? src.slice(iBmt, src.indexOf('\n  }', iBmt) + 4) : '';
check('besitztModulTyp aus der Spieldatei gelesen', bmtQuelle.length > 80);

function baue(state){
  const ctx = {};
  const allFleets = () => [state.fleet || {}].concat(Object.values(state.colonies || {}).map(c => c.fleet || {}));
  const allBuildingSets = () => [state.buildings || {}].concat(Object.values(state.colonies || {}).map(c => c.buildings || {}));
  // Seit v8.299.0 (woechentlich wachsende Galaxie) zaehlen die beiden Karten-Kategorien bewusst
  // gegen die fest eingetragene Kern-Galaxie statt gegen die wachsenden Arrays - sonst wuerde eine
  // abgeschlossene Kategorie jeden Montag wieder aufreissen. Hier stehen die Stubs dafuer: alle
  // Attrappen-Planeten/-Systeme gelten als Kern-Galaxie.
  const BASE_PLANET_COUNT = DEFS.PLANETS.length;
  const BASE_STAR_SYSTEM_COUNT = DEFS.STAR_SYSTEMS.length;
  const BASE_PLANET_IDS = new Set(DEFS.PLANETS.map(p => p.id));
  const baseStarSystems = () => DEFS.STAR_SYSTEMS;
  const unikatDefs = () => DEFS.UNIKATE;
  new Function('ctx', 'state', 'PLANETS', 'STAR_SYSTEMS', 'ACHIEVEMENTS', 'SHIP_DEFS', 'MODULE_DEFS',
    'BUILDING_DEFS', 'FACTION_DIPLOMACY', 'allFleets', 'allBuildingSets',
    'BASE_PLANET_COUNT', 'BASE_STAR_SYSTEM_COUNT', 'BASE_PLANET_IDS', 'baseStarSystems',
    'ABGRUND_RELIKTE', 'ABGRUND_KONSTELLATIONEN', 'unikatDefs', 'FESTUNG_STUFEN', 'ALIEN_VOELKER',
    bmtQuelle + '\n' + block + ';ctx.CATS=COMPENDIUM_CATS;')(ctx, state, DEFS.PLANETS, DEFS.STAR_SYSTEMS, DEFS.ACHIEVEMENTS,
    DEFS.SHIP_DEFS, DEFS.MODULE_DEFS, DEFS.BUILDING_DEFS, DEFS.FACTION_DIPLOMACY, allFleets, allBuildingSets,
    BASE_PLANET_COUNT, BASE_STAR_SYSTEM_COUNT, BASE_PLANET_IDS, baseStarSystems,
    DEFS.ABGRUND_RELIKTE, DEFS.ABGRUND_KONSTELLATIONEN, unikatDefs, DEFS.FESTUNG_STUFEN, DEFS.ALIEN_VOELKER);
  return ctx.CATS;
}

// ---------------------------------------------------------------- 1) Form
const leerState = { discovered:{}, npcScaling:{}, factionRep:{}, achievements:{}, fleet:{}, buildings:{}, colonies:{}, modules:{}, equippedModules:{}, abgrund:{ relikte:{}, konstGesehen:{} } };
const cats = baue(leerState);
/* Namentlich statt gezaehlt (Arbeitsregel 33): Eine blanke Zahl sagt beim Fehlschlag nicht, WELCHE
   Kategorie dazugekommen oder verschwunden ist - und beides ist ein Befund. Verschwindet eine,
   verlieren Spieler eine abgeschlossene Sammlung; kommt eine dazu, ohne dass es jemand wollte,
   faellt es hier auf. */
const ERWARTETE_KATEGORIEN = ['planets','systems','bosses','factions','achievements','ships','modules',
  'buildings','relikte','konstellationen','unikate','festungen','voelker'];
{
  const ist = cats.map(c => c.key).sort();
  const soll = ERWARTETE_KATEGORIEN.slice().sort();
  const fehlend = soll.filter(k => ist.indexOf(k) < 0);
  const ueberzaehlig = ist.filter(k => soll.indexOf(k) < 0);
  check('1: genau die erwarteten Kategorien', !fehlend.length && !ueberzaehlig.length, { fehlend, ueberzaehlig });
}
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
  achievements:{}, fleet:{}, buildings:{}, colonies:{}, modules:{}, equippedModules:{ home:[] },
  abgrund:{ relikte:{}, konstGesehen:{} }
};
DEFS.ABGRUND_RELIKTE.forEach(r => { vollState.abgrund.relikte[r.key] = true; });
vollState.festungTypen = vollState.festungTypen || {};
vollState.nestVoelker = vollState.nestVoelker || {};
DEFS.ABGRUND_KONSTELLATIONEN.forEach(k => { vollState.abgrund.konstGesehen[k.key] = true; });
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
// Unikate gemischt wie die Module darueber: gerade Indizes ins Inventar, ungerade in einen
// Slot - die Kategorie ist nur erfuellt, wenn sie beide Quellen zusammenfuehrt.
DEFS.UNIKATE.forEach((u, i) => {
  if (i % 2 === 0) vollState.modules[u.key + ':exotisch:1:w110'] = 1;
  else vollState.equippedModules.home.push(u.key + ':exotisch:1:w110');
});
/* Festungen und Voelker (Phase 6). Die Sammlung zaehlt ARTEN, und der Spielstand fuehrt sie als
   Mengen von SCHLUESSELN - genau der Namensraum, den total() zaehlt. Gefuellt wird aus den
   ATTRAPPEN, nicht aus getippten 3 und 4: Kaeme eine vierte Ausbaustufe dazu, muesste dieser Block
   sonst von Hand nachgezogen werden, und die Luecke fiele erst beim naechsten Fehlschlag auf. */
Object.keys(DEFS.FESTUNG_STUFEN).forEach(k => { vollState.festungTypen[k] = true; });
Object.keys(DEFS.ALIEN_VOELKER).forEach(v => { vollState.nestVoelker[v] = true; });
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

// Unikat-Zeile: `desc` ist hier bewusst eine FUNKTION, weil sie mit dem Spielstand mitwaechst.
const uniLeer = cats.find(c => c.key === 'unikate');
const uniVoll = vollCats.find(c => c.key === 'unikate');
check('4u: die Unikat-Kategorie existiert und beschreibt sich per Funktion',
  !!uniLeer && typeof uniLeer.desc === 'function');
check('4u: ohne Unikate stehen alle auf offen (Kreis) und nennen ihren Fundort',
  uniLeer.desc().includes('\u25CB Unikat 0 \u2013 Ort 0') && !uniLeer.desc().includes('\u2713'),
  uniLeer.desc());
check('4u: mit vollem Bestand sind alle abgehakt - auch das EINGEBAUTE',
  uniVoll.desc().includes('\u2713 Unikat 0') && !uniVoll.desc().includes('\u25CB') &&
  uniVoll.have() === DEFS.UNIKATE.length,
  { zeile: uniVoll.desc(), have: uniVoll.have() });

// ---------------------------------------------------------------- 5) Hilfe mitgezogen
/* 5) Die Hilfe RECHNET ihre Anzahl, statt sie zu behaupten.
   Bis zum 21.08.2026 stand hier eine feste Zahl - und diese Pruefung hat sie FESTGENAGELT: Der
   Hilfetext sagte "in acht Kategorien" und zaehlte acht namentlich auf, waehrend COMPENDIUM_CATS
   gemessen 13 fuehrte und der Reiter auch 13 zeichnete. Er log damit seit v8.343.0 (Reliquien,
   Konstellationen), v8.464.0 (Unikate) und zuletzt Phase 6 (Asteroidenfestungen, Alien-Voelker).
   Wer den Text haette richtigstellen wollen, waere von genau dieser Pruefung zurueckgepfiffen
   worden - sie war nicht der Waechter, sondern der Grund, warum niemand hingesehen hat
   (Arbeitsregel 68).
   Geprueft wird deshalb die REGEL statt der Momentaufnahme: Die Stelle muss aus COMPENDIUM_CATS
   ableiten. Eine Ziffer kann so nicht zurueckkehren, und eine 14. Kategorie ist automatisch
   mitgezaehlt. Denselben Ausdruck haelt tests/test_zaehlangaben.js zusaetzlich fest. */
const hilfeVon = src.indexOf("const HELP_SECTIONS = [");
const kompVon = src.indexOf("{ title:'Galaktisches Kompendium'", hilfeVon < 0 ? 0 : hilfeVon);
const kompBis = kompVon < 0 ? -1 : src.indexOf("\n      { title:'", kompVon + 10);
check('5-anker: der Kompendium-Hilfeeintrag laesst sich schneiden (sonst waeren 5a/5b vacuous)',
  hilfeVon >= 0 && kompVon > hilfeVon && kompBis > kompVon, { hilfeVon, kompVon, kompBis });
const kh = (kompVon >= 0 && kompBis > kompVon) ? src.slice(kompVon, kompBis) : '';
check('5a: die Hilfe RECHNET die Anzahl der Kategorien, statt eine Ziffer zu nennen',
  kh.indexOf("'+COMPENDIUM_CATS.length+' Kategorien") >= 0, kh.slice(0, 200));
check('5b: und nennt sie aus derselben Tabelle, statt sie abzuschreiben',
  /COMPENDIUM_CATS\.map\(c=>'<strong>'\+c\.name\+'<\/strong>'\)/.test(kh), kh.slice(0, 200));
/* Die drei Besitz-Kategorien stehen weiterhin NAMENTLICH im Text - vorher hiess es dort "die
   letzten drei", was still von der Reihenfolge des Arrays abhing. Verschiebt sie jemand, waere
   der Satz falsch geworden, ohne dass eine Pruefung angeschlagen haette. */
check('5c: die drei Besitz-Kategorien sind namentlich genannt, nicht ueber ihre Position',
  /Schiffsregister/.test(kh) && /Modulkabinett/.test(kh) && /Gebäudearchiv/.test(kh)
    && !/letzten drei/.test(kh));
/* 5d) Die DRITTE Anzeigestelle, gefunden am 21.08.2026 beim Nachmessen des gerenderten Spiels.
   Ueber #compendiumBox steht eine statische Einleitungszeile im Markup - und die zaehlte die
   URSPRUENGLICHEN FUENF Kategorien auf ("entdeckte Welten, bereiste Systeme, besiegte Bosse,
   kennengelernte Fraktionen und freigeschaltete Erfolge"), waehrend der Reiter direkt darunter
   dreizehn zeichnete. Sie hinkte damit noch laenger hinterher als der Hilfetext, und zwar seit
   v8.298.
   Sie ist statisches Markup und kann NICHT aus COMPENDIUM_CATS ableiten - eine Aufzaehlung dort
   ist strukturell zum Veralten verurteilt. Geprueft wird deshalb, dass dort gar nicht mehr
   aufgezaehlt wird: kein Kategoriename, und kein Dreier-Muster "a, b, ... und c". Die
   Beschreibung jeder Kategorie steht ohnehin in ihrer eigenen Zeile, der Renderer gibt
   cat.name UND cat.desc aus. */
{
  const notizVon = src.indexOf("class=\"lb-note\"", src.indexOf("data-sec=\"kompendium\""));
  const notizBis = notizVon < 0 ? -1 : src.indexOf('</div>', notizVon);
  check('5d-anker: die Einleitungszeile ueber dem Kompendium laesst sich schneiden',
    notizVon > 0 && notizBis > notizVon, { notizVon, notizBis });
  const notiz = (notizVon > 0 && notizBis > notizVon) ? src.slice(notizVon, notizBis) : '';
  const genannt = cats.map(c => c.name).filter(n => notiz.indexOf(n) >= 0);
  check('5d: die Einleitungszeile nennt keine einzelne Kategorie', !genannt.length, genannt);
  check('5d2: und zaehlt auch nicht beschreibend auf', !/,[^.]*,[^.]*\bund\b/.test(notiz), notiz.slice(0, 200));
}

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
