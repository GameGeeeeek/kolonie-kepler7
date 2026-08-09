// Boss-Modul-Sets (v8.433.0, Idee Sascha): Jeder der fünf Allianz-Raid-Bosse droppt exklusiv die
// vier Teile seines eigenen Sets; 2/3/4 Teile an einem Standort schalten additive Stufen-Boni frei.
//
// GEPRÜFT WERDEN REGELN, und die kritischen davon werden AUSGEFÜHRT statt am Text abgelesen:
//   1) Vollständigkeit: jeder Boss aus ALLIANCE_RAID_BOSSE hat genau ein Set mit genau 4 Teilen,
//      jedes Teil existiert in MODULE_DEFS mit quelle 'boss' und passendem bossKey, trägt ein
//      Icon aus der Whitelist und eine ganze Satz-Beschreibung (CLAUDE.md Pflicht 7).
//   2) PvP-Parität als Invariante: KEIN Stufen-Bonus und KEIN Teil-Effekt nutzt 'atk' oder
//      'raidloss' - der Server rechnet diese Felder nach, ein clientseitiger Set-Bonus dort
//      würde Vorschau und Kampfergebnis auseinanderziehen.
//   3) Leak-Regel, AUSGEFÜHRT: fundPool() aus der Datei geschnitten und mit den echten
//      MODULE_DEFS aufgerufen - weder der normale Topf noch der Abgrund-Topf darf ein
//      Boss-Teil enthalten. (Ein Textvergleich hätte hier nichts belegt.)
//   4) Stufen-Logik, AUSGEFÜHRT: setBonusAt() im Sandkasten mit gestellter Ausrüstung -
//      1 Teil gibt nichts, 2 Teile genau Stufe 1, 4 Teile die Summe aller Stufen, und die
//      benannten Alt-Sets bleiben Alles-oder-nichts.
//   5) Drop-Weg: der Raid-Claim zieht das Teil des BEKÄMPFTEN Bosses und fällt nur bei
//      unbekanntem Boss auf den normalen Topf zurück.
//
// GEGENPROBE (Arbeitsregel 1, beim Einführen ausgeführt): am alten Stand fällt der Test durch
// (kein HERKUNFT_BOSS, keine Sets, setBonusAt kennt keine Stufen).
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

function parseArray(name) {
  const von = JS.indexOf('const ' + name + ' = [');
  if (von < 0) return null;
  const bis = JS.indexOf('\n  ];', von);
  if (bis < 0) return null;
  // HERKUNFT_*-Konstanten werden im Literal referenziert - als Parameter hereinreichen.
  // HERKUNFT_UNIKAT nachgezogen (Arbeitsregel 9, v8.463.0): Fehlt eine Konstante, wirft das
  // Literal einen ReferenceError, der hier still zu `null` wird - der Test meldete dann
  // "MODULE_DEFS nicht geparst" statt der eigentlichen Ursache.
  try {
    return new Function('HERKUNFT_NORMAL', 'HERKUNFT_ABGRUND', 'HERKUNFT_BOSS', 'HERKUNFT_UNIKAT',
      'return ' + JS.slice(von + ('const ' + name + ' = ').length, bis + 5))('normal', 'abgrund', 'boss', 'unikat');
  } catch (e) { return null; }
}
function funktionsRumpf(name) {
  const von = JS.indexOf('function ' + name + '(');
  if (von < 0) return '';
  const bis = JS.indexOf('\n  }', von);
  return bis > von ? JS.slice(von, bis + 4) : '';
}

const MODULE_DEFS = parseArray('MODULE_DEFS');
const SET_DEFS = parseArray('MODULE_SET_DEFS');
const BOSSE = parseArray('ALLIANCE_RAID_BOSSE');
check('1a: MODULE_DEFS, MODULE_SET_DEFS und ALLIANCE_RAID_BOSSE geparst',
  !!(MODULE_DEFS && SET_DEFS && BOSSE),
  { defs: MODULE_DEFS && MODULE_DEFS.length, sets: SET_DEFS && SET_DEFS.length, bosse: BOSSE && BOSSE.length });
if (!MODULE_DEFS || !SET_DEFS || !BOSSE) return ende();

// ---- 1) Vollständigkeit
const bossSets = SET_DEFS.filter(s => s.stufen);
const teileVon = boss => MODULE_DEFS.filter(d => d.quelle === 'boss' && d.bossKey === boss);
check('1b: jeder Boss hat genau ein Set mit genau 4 exklusiven Teilen',
  BOSSE.every(b => {
    const set = bossSets.find(s => s.bossKey === b.key);
    const teile = teileVon(b.key);
    return set && set.req.length === 4 && teile.length === 4 &&
           set.req.every(t => teile.some(d => d.key === t));
  }), bossSets.map(s => s.bossKey));
const whitelist = new Set([...HTML.matchAll(/\.(ti-[a-z0-9-]+):before/g)].map(m => m[1]));
const bossTeile = MODULE_DEFS.filter(d => d.quelle === 'boss');
check('1c: alle 20 Teile tragen Whitelist-Icons und ganze Satz-Beschreibungen',
  bossTeile.length === BOSSE.length * 4 &&
  bossTeile.every(d => whitelist.has(d.icon) && d.desc && d.desc.length > 80),
  bossTeile.filter(d => !whitelist.has(d.icon)).map(d => d.key));
check('1d: jedes Set nennt in der Beschreibung seine Stufen', bossSets.every(s => s.desc && /2 Teile/.test(s.desc)));

// ---- 2) PvP-Paritäts-Invariante
const verboten = ['atk', 'raidloss'];
check('2a: kein Teil-Effekt und kein Stufen-Bonus nutzt atk/raidloss',
  bossTeile.every(d => !verboten.includes(d.effect)) &&
  bossSets.every(s => s.stufen.every(st => verboten.every(v => !(v in st.bonuses)))));

// ---- 3) Leak-Regel, ausgeführt: fundPool hält Boss-Teile aus allen Töpfen
{
  const rumpf = funktionsRumpf('fundPool');
  check('3a: fundPool gefunden', rumpf.length > 200);
  const fundPool = new Function('HERKUNFT_NORMAL', 'HERKUNFT_ABGRUND',
    rumpf + '\nreturn fundPool;')('normal', 'abgrund');
  const normal = fundPool(MODULE_DEFS, {});
  const abgrund = fundPool(MODULE_DEFS, { quelle: 'abgrund', tiefe: 999 });
  check('3b: der normale Fundtopf enthält KEIN Boss-Teil',
    normal.length > 0 && normal.every(d => d.quelle !== 'boss'), normal.filter(d => d.quelle === 'boss').map(d => d.key));
  check('3c: der Abgrund-Topf ebenfalls nicht',
    abgrund.length > 0 && abgrund.every(d => d.quelle !== 'boss'));
}

// ---- 4) Stufen-Logik, ausgeführt
{
  const rumpf = funktionsRumpf('setBonusAt');
  check('4a: setBonusAt gefunden', rumpf.length > 200);
  const mach = ausgeruestet => new Function('MODULE_SET_DEFS', 'equippedAt',
    rumpf + '\nreturn setBonusAt;')(SET_DEFS, () => ausgeruestet);
  const set = bossSets[0];
  const st = n => set.req.slice(0, n).map(k => k + ':selten');
  const summe = (n, effect) => set.stufen.filter(x => n >= x.teile).reduce((a, x) => a + (x.bonuses[effect] || 0), 0);
  // Erwartung aus den geparsten Stufen GERECHNET (Arbeitsregel 2), für jeden Effekt des Sets.
  const effekte = [...new Set(set.stufen.flatMap(x => Object.keys(x.bonuses)))];
  check('4b: 1 Teil gibt keinen Stufen-Bonus', effekte.every(e => mach(st(1))('home', e) === 0));
  check('4c: 2 Teile geben genau die erste Stufe', effekte.every(e => mach(st(2))('home', e) === summe(2, e)));
  check('4d: 4 Teile geben die Summe ALLER Stufen', effekte.every(e => mach(st(4))('home', e) === summe(4, e)));
  // Benannte Alt-Sets bleiben Alles-oder-nichts: Festungs-Doktrin braucht beide Typen.
  const alt = SET_DEFS.find(s => !s.stufen);
  const altEffekt = Object.keys(alt.bonuses)[0];
  check('4e: benannte Sets bleiben Alles-oder-nichts (' + alt.key + ')',
    mach(alt.req.slice(0, alt.req.length - 1).map(k => k + ':selten'))('home', altEffekt) === 0 &&
    mach(alt.req.map(k => k + ':selten'))('home', altEffekt) === alt.bonuses[altEffekt]);
}

// ---- 5) Drop-Weg
{
  const von = JS.indexOf('async function claimAllianceRaidOutcome(');
  const bis = JS.indexOf('\n  function ', von + 20);
  const rumpf = JS.slice(von, bis);
  check('5a: der Raid-Claim zieht das Teil des bekämpften Bosses, mit Rückfall auf den Normal-Topf',
    /grantBossSetModule\(data\.boss \? data\.boss\.key : null, data\.modulSeltenheit\) \|\| grantRandomModule\(data\.modulSeltenheit\)/.test(rumpf));
  const gbs = funktionsRumpf('grantBossSetModule');
  check('5b: grantBossSetModule filtert exklusiv nach bossKey und liefert null bei unbekanntem Boss',
    gbs.includes("d.quelle === HERKUNFT_BOSS && d.bossKey === bossKey") && gbs.includes('if (!teile.length) return null;'));
  // Die Anzeige kennt die Stufen: Fortschrittszaehler und naechste Stufe stehen im Markup.
  check('5c: die Standort-Ansicht zeigt Fortschritt und nächste Stufe',
    JS.includes('Boss-Set „${s.name}" ${have.length}/${s.req.length}') && JS.includes('nächste Stufe (${naechste.teile} Teile)'));
}

ende();
