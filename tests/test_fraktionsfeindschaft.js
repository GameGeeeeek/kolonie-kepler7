// Feindschaft mit Folgen v8.298.21 (Fraktions-Ausbau, Paket 2/6).
//
// Vorher war "Feindlich" ein rein KOSMETISCHES rotes Etikett: repTierOf gab die Stufe zurueck, aber
// factionEffectLevel lieferte fuer alles unter Freundlich einfach 0. Es gab also weder einen
// Nachteil noch ein Drama beim Angreifen - und damit auch keinen Grund, den Ruf zu pflegen.
//
// Geprueft wird:
//   1) zwei Feindschaftsstufen mit sauberen Schwellen, ohne die Freundschaftsseite anzufassen
//   2) jede Fraktion schadet dort, wo sie sonst nuetzt (vier Spiegel-Effekte)
//   3) Strafexpeditionen summieren ueber ALLE feindlichen Fraktionen, nicht nur ueber eine
//   4) die Gegenleistung (mehr Truemmer) haengt an derselben Summe wie das Risiko
//   5) der Truemmer-Bonus landet WIRKLICH im Feld, nicht nur im Bericht
//   6) Backend-Paritaet: Marktrabatt und Fraktions-Systemangriffe sind NICHT verschaerft
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------------------------------------------------------------- Block ausführbar machen
// Seit v8.298.23 ist repTierOf tabellengetrieben (REP_RANKS, acht Raenge) - der Block muss
// deshalb bei der Tabelle beginnen, nicht erst bei der Funktion.
const von = src.indexOf('  const REP_RANKS = [');
const bis = src.indexOf('const PUNITIVE_DEBRIS_PER_LEVEL', von);
const endeBlock = src.indexOf('\n  }\n', src.indexOf('function punitiveDebrisMult', bis)) + 4;
check('Feindschafts-Block gefunden', von > 0 && bis > von && endeBlock > bis);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const block = src.slice(von, endeBlock);

function baue(rep){
  const ctx = {};
  const state = { factionRep: Object.assign({ kartell:0, legion:0, void:0, schatten:0 }, rep || {}) };
  new Function('ctx', 'state', 'FACTION_DIPLOMACY', 'REP_MIN', 'REP_MAX', 'factionRepOf',
    block + ';ctx.tier=repTierOf;ctx.eff=factionEffectLevel;ctx.hos=factionHostilityLevel;' +
    'ctx.route=hostileRouteMult;ctx.enc=hostileEncounterMult;ctx.loss=hostileRaidLossMult;' +
    'ctx.punChance=punitiveRaidChanceMult;ctx.punPower=punitiveRaidPowerMult;ctx.punDebris=punitiveDebrisMult;' +
    'ctx.anyHos=anyHostileLevel;ctx.hostileIds=hostileFactionIds;' +
    'ctx.PC=PUNITIVE_RAID_PER_LEVEL;ctx.PP=PUNITIVE_POWER_PER_LEVEL;ctx.PD=PUNITIVE_DEBRIS_PER_LEVEL;'
  )(ctx, state, { kartell:{}, legion:{}, void:{}, schatten:{} }, -100, 100,
    (fid) => Math.max(-100, Math.min(100, state.factionRep[fid]||0)));
  return { ctx, state };
}
const u = baue();

// ---------------------------------------------------------------- 1) Stufen
check('1: bei -70 und darunter gilt Verfeindet', u.ctx.tier(-70).key === 'verfeindet' && u.ctx.tier(-100).key === 'verfeindet');
check('1: zwischen -69 und -30 gilt Feindlich', u.ctx.tier(-69).key === 'feindlich' && u.ctx.tier(-30).key === 'feindlich');
// Seit v8.298.23 heisst der Bereich -29..-10 "Misstrauisch" (Rang 3 von 8). Gepruefte Groesse
// bleibt dieselbe: oberhalb von -30 gibt es KEINEN Feindschafts-Malus mehr.
check('1: oberhalb von -30 endet die Feindschaft', u.ctx.hos('kartell') === 0 && baue({ kartell:-29 }).ctx.hos('kartell') === 0);
check('1: -29 ist Misstrauisch, 0 ist Neutral', u.ctx.tier(-29).key === 'misstrauisch' && u.ctx.tier(0).key === 'neutral',
  [u.ctx.tier(-29).key, u.ctx.tier(0).key]);
check('1: die Freundschaftsseite ist unverändert',
  u.ctx.tier(30).key === 'freundlich' && u.ctx.tier(70).key === 'verbuendet' && u.ctx.tier(100).key === 'verbuendet');
check('1: die Feindschaftsstufe ist 0/1/2',
  baue({legion:0}).ctx.hos('legion') === 0 &&
  baue({legion:-40}).ctx.hos('legion') === 1 &&
  baue({legion:-80}).ctx.hos('legion') === 2);
check('1: Feindschaft und Freundschaft schließen sich aus',
  ['legion'].every(f => [-80,-40,0,40,80].every(r => {
    const b = baue({[f]:r});
    return !(b.ctx.hos(f) > 0 && b.ctx.eff(f) > 0);
  })));
check('1: die beiden Stufen haben unterschiedliche Farben (sonst wäre die Eskalation unsichtbar)',
  u.ctx.tier(-40).color !== u.ctx.tier(-80).color, { feindlich: u.ctx.tier(-40).color, verfeindet: u.ctx.tier(-80).color });

// ---------------------------------------------------------------- 2) Spiegel-Effekte
const spiegel = [
  ['kartell',  'route', (v)=>v < 1, 'Handelsrouten-Ertrag sinkt'],
  ['legion',   'enc',   (v)=>v > 1, 'Expeditions-Begegnungen steigen'],
  ['schatten', 'loss',  (v)=>v > 1, 'Überfall-Verlust steigt']
];
spiegel.forEach(([fid, fn, pred, txt]) => {
  const neutral = baue({}).ctx[fn]();
  const feind   = baue({[fid]:-40}).ctx[fn]();
  const erz     = baue({[fid]:-80}).ctx[fn]();
  check('2: '+fid+' – ohne Feindschaft kein Malus', neutral === 1, neutral);
  check('2: '+fid+' – feindlich schadet ('+txt+')', pred(feind), feind);
  check('2: '+fid+' – verfeindet schadet mehr',
    pred(erz) && Math.abs(erz-1) > Math.abs(feind-1), { feindlich: feind, verfeindet: erz });
});
// Jede Fraktion darf nur IHREN eigenen Effekt beeinflussen.
const nurKartell = baue({ kartell:-80 });
check('2: eine feindliche Fraktion beeinflusst nur ihren eigenen Bereich',
  nurKartell.ctx.route() < 1 && nurKartell.ctx.enc() === 1 && nurKartell.ctx.loss() === 1,
  { route: nurKartell.ctx.route(), enc: nurKartell.ctx.enc(), loss: nurKartell.ctx.loss() });

// ---------------------------------------------------------------- 3) Strafexpeditionen
check('3: ohne Feinde kein Aufschlag',
  baue({}).ctx.punChance() === 1 && baue({}).ctx.punPower() === 1);
const ein = baue({ legion:-40 });
check('3: eine feindliche Fraktion erhöht Häufigkeit UND Stärke',
  ein.ctx.punChance() > 1 && ein.ctx.punPower() > 1,
  { chance: ein.ctx.punChance(), power: ein.ctx.punPower() });
const vier = baue({ kartell:-80, legion:-80, void:-80, schatten:-80 });
check('3: die Aufschläge summieren über ALLE feindlichen Fraktionen',
  Math.abs(vier.ctx.punChance() - (1 + 8*u.ctx.PC)) < 1e-9,
  { gemessen: vier.ctx.punChance(), erwartet: 1 + 8*u.ctx.PC });
check('3: verfeindet zählt doppelt so schwer wie feindlich',
  Math.abs((baue({legion:-80}).ctx.punChance() - 1) - 2*(baue({legion:-40}).ctx.punChance() - 1)) < 1e-9);
// Der Aufschlag darf nicht ins Unspielbare laufen.
check('3: selbst bei vier verfeindeten Fraktionen bleibt der Aufschlag beherrschbar',
  vier.ctx.punChance() <= 3 && vier.ctx.punPower() <= 2.5,
  { chance: vier.ctx.punChance(), power: vier.ctx.punPower() });
check('3: Hilfsfunktionen melden die feindlichen Fraktionen',
  vier.ctx.anyHos() === 2 && vier.ctx.hostileIds().length === 4 && baue({}).ctx.hostileIds().length === 0);

// ---------------------------------------------------------------- 4) Gegenleistung
check('4: ohne Feinde kein Trümmer-Bonus', baue({}).ctx.punDebris() === 1);
check('4: der Trümmer-Bonus wächst mit derselben Summe wie das Risiko',
  Math.abs(vier.ctx.punDebris() - (1 + 8*u.ctx.PD)) < 1e-9, vier.ctx.punDebris());
// Das ist der Kern des Pakets: Feindschaft ist ein Handel, kein reiner Verlust.
check('4: Risiko und Ertrag steigen gemeinsam',
  ein.ctx.punDebris() > 1 && vier.ctx.punDebris() > ein.ctx.punDebris(),
  { eine: ein.ctx.punDebris(), vier: vier.ctx.punDebris() });

// ---------------------------------------------------------------- 5) Trümmer landen wirklich im Feld
// Der naheliegende Halbfehler waere, nur den Rueckgabewert fuer den Bericht zu skalieren - dann
// naennte der Bericht eine Menge, die im Truemmerfeld gar nicht liegt.
const skalVon = src.indexOf('function skaliereTruemmer');
const skalBis = src.indexOf('\n  }\n', skalVon) + 4;
const skalBlock = src.slice(skalVon, skalBis);
const abgelegt = [];
const skal = new Function('addDebris', skalBlock + ';return skaliereTruemmer;')((pk, d) => abgelegt.push({ pk, d }));
const erhoeht = skal({ erz: 100, kristalle: 50 }, 1.6, 'home');
check('5: der zurückgegebene Wert ist erhöht', erhoeht.erz === 160 && erhoeht.kristalle === 80, erhoeht);
check('5: und die DIFFERENZ wird wirklich am Planeten abgelegt',
  abgelegt.length === 1 && abgelegt[0].pk === 'home' && abgelegt[0].d.erz === 60 && abgelegt[0].d.kristalle === 30,
  abgelegt);
abgelegt.length = 0;
check('5: ohne Bonus wird nichts zusätzlich abgelegt',
  JSON.stringify(skal({ erz: 100 }, 1, 'home')) === JSON.stringify({ erz: 100 }) && abgelegt.length === 0);
check('5: ohne Trümmer passiert nichts', skal(null, 2, 'home') === null && abgelegt.length === 0);

// ---------------------------------------------------------------- 6) Backend-Parität
// Beides rechnet der Server (marketDiscountPctFor bzw. /faction/attack). Eine einseitige
// Verschaerfung im Frontend wuerde Anzeige und Serverrechnung auseinanderlaufen lassen.
// Bewusst der FUNKTIONSRUMPF, nicht der umgebende Text: die Kommentare erklaeren ja gerade, warum
// hier NICHT verschaerft wird - die duerfen die Begriffe nennen.
const rumpf = (name) => {
  const i = src.indexOf('function ' + name);
  return i < 0 ? '' : src.slice(i, src.indexOf('\n  }\n', i));
};
check('6: der Kartell-Marktrabatt bekommt KEINEN Feindschafts-Aufschlag',
  rumpf('marketDiscountPct').length > 50 && !/[Hh]ostil/.test(rumpf('marketDiscountPct')),
  rumpf('marketDiscountPct').length);
check('6: Fraktions-Systemangriffe werden nicht clientseitig erschwert',
  rumpf('attackFactionSystem').length > 50 && !/[Hh]ostil/.test(rumpf('attackFactionSystem')),
  rumpf('attackFactionSystem').length);
// Die Rufleiter ist seit v8.298.23 eine Tabelle statt einer if-Kette - die beiden vom Backend
// gespiegelten Schwellen muessen aber unveraendert dort liegen.
check('6: die Freundschafts-Schwellen 30/70 sind unverändert',
  /\{ key:'verbuendet',\s+min:70,/.test(src) && /\{ key:'freundlich',\s+min:30,/.test(src));

// ---------------------------------------------------------------- 7) Verdrahtung
check('7: der Handelsrouten-Malus hängt an routeYieldMult',
  /\* hostileRouteMult\(\); \}/.test(src));
check('7: der Überfall-Malus hängt an raidChanceMult, zusammen mit den Strafexpeditionen',
  /return freundlich \* voidMalus \* punitiveRaidChanceMult\(\);/.test(src));
check('7: der Expeditions-Malus wird beim START eingebacken (wie encounterChance selbst)',
  /et\.encounterChance\*risk\.enc\*hostileEncounterMult\(\)/.test(src));
check('7: der Verlust-Malus greift beim NPC-Überfall',
  /Math\.min\(isSuper\?0\.5:0\.35, raiderPower\/\(raiderPower\+dp\*2\)\)\) \* hostileRaidLossMult\(\);/.test(src));
check('7: Strafexpeditionen sind auch stärker, nicht nur häufiger',
  /faction\.mult \* punitiveRaidPowerMult\(\);/.test(src));
check('7: der Trümmer-Bonus wird mit dem Zielplaneten aufgerufen (sonst landet er nirgends)',
  /skaliereTruemmer\(combatDebrisOf\(lostRaiderShips\), punitiveDebrisMult\(\), targetPlanet\)/.test(src));

// ---------------------------------------------------------------- 8) Anzeigestellen (CLAUDE.md 6)
check('8: die Fraktionskarte zeigt den Feindschafts-Malus im Klartext',
  /Verfeindet':'Feindlich'\}:<\/strong> \$\{txt\}/.test(src));
check('8: und nennt die Strafexpeditionen bei Verfeindet',
  /schickt <strong>Strafexpeditionen<\/strong> gegen deine Planeten/.test(src));
check('8: die angezeigten Zahlen stimmen mit der Mechanik überein',
  (() => {
    const b1 = baue({kartell:-40}), b2 = baue({kartell:-80});
    const l1 = baue({legion:-40}), l2 = baue({legion:-80});
    const s1 = baue({schatten:-40}), s2 = baue({schatten:-80});
    const v1 = baue({void:-40}), v2 = baue({void:-80});
    return Math.round((1-b1.ctx.route())*100) === 12 && Math.round((1-b2.ctx.route())*100) === 25 &&
           Math.round((l1.ctx.enc()-1)*100) === 20 && Math.round((l2.ctx.enc()-1)*100) === 45 &&
           Math.round((s1.ctx.loss()-1)*100) === 15 && Math.round((s2.ctx.loss()-1)*100) === 30 &&
           /\+25% Überfall-Häufigkeit/.test(src) && /\+60% Überfall-Häufigkeit/.test(src) &&
           v1.ctx.hos('void') === 1 && v2.ctx.hos('void') === 2;
  })());
check('8: die Hilfe erklärt Feindschaft, Strafexpeditionen und die Gegenleistung',
  /title:'Feindschaft: was passiert, wenn der Ruf fällt'/.test(src) &&
  /Strafexpeditionen:<\/strong>/.test(src) && /Aber es gibt auch eine Gegenleistung/.test(src));
check('8: und benennt die Backend-Grenze ehrlich',
  /beides rechnet der Server, eine einseitige Verschärfung/.test(src));
check('8: es gibt eine Gesamt-Übersicht über alle Feindschaften',
  /\$\{ids\.length\} \$\{ids\.length===1\?'Fraktion ist':'Fraktionen sind'\} dir feindlich gesinnt/.test(src));
check('8: und die nennt Häufigkeit, Stärke UND die Trümmer-Gegenleistung',
  /\+\$\{pc\}% Überfall-Häufigkeit/.test(src) && /\+\$\{pp\}% Angreifer-Stärke/.test(src) && /\+\$\{pd\}% Trümmer/.test(src));
check('8: neuer Erfolg auf die Feindschaft, mit Kategorie und Icon',
  /key:'erzfeind'/.test(src) && /erzfeind:'handel'/.test(src) && /erzfeind:'ti-alert-triangle'/.test(src));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
