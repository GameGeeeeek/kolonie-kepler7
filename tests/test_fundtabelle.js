// Fundtabellen-Ausbau v8.298.11. Anlass war eine Auszaehlung: 63 Expeditions-Sonderereignisse und
// 60 Zufallsereignisse standen NEUN Verbrauchsgegenstaenden und DREI per Expedition findbaren
// Materialien gegenueber - es gab kaum etwas zu finden, und die Seltenheitsstufe "episch" war leer.
//
// Dieser Test sichert den Bestand und die Regeln, die beim Einfuegen leicht verrutschen:
//   1) jeder Gegenstand hat Icon (aus der Whitelist), vollstaendige Beschreibung und activate()
//   2) keine doppelten Schluessel, alle Seltenheitsstufen belegt
//   3) jedes neue seltene Material hat eine echte Senke (Gebaeude mit unlockItem)
//   4) CLAUDE.md-Falle: JEDES category:'defense'-Gebaeude braucht defVal UND atkVal, sonst kippt die
//      globale Verteidigungsberechnung auf NaN. Gilt fuer alle, nicht nur die neuen.
//   5) die neuen Zustandsfelder haben Vorgabewerte (sonst NaN/undefined bei Altstaenden)
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const whitelist = new Set([...src.matchAll(/^\s*\.(ti-[a-z0-9-]+):before/gm)].map(m => m[1]));
const block = (name) => (src.match(new RegExp('const ' + name + ' = \\[[\\s\\S]*?\\n  \\];')) || [''])[0];

// ---------------------------------------------------------------- Verbrauchsgegenstaende
const itemSrc = block('ITEM_DEFS');
check('ITEM_DEFS gefunden', itemSrc.length > 100);
// Ein Eintrag beginnt mit { key:'…' auf Einrueckungsebene 4 und laeuft bis zum naechsten.
const rohEintraege = itemSrc.split(/\n    \{ key:'/).slice(1);
const items = rohEintraege.map(t => ({
  key: (t.match(/^(\w+)'/) || [])[1],
  name: (t.match(/name:'([^']+)'/) || [])[1],
  icon: (t.match(/icon:'([^']+)'/) || [])[1],
  desc: (t.match(/desc:'((?:[^'\\]|\\.)*)'/) || [])[1] || '',
  rarity: (t.match(/rarity:'(\w+)'/) || [])[1],
  hatActivate: /activate:/.test(t)
}));
check('1: Gegenstaende geparst', items.length >= 19 && items.every(i => i.key), items.length);
check('1: jeder Gegenstand hat ein Icon aus der Whitelist',
  items.every(i => whitelist.has(i.icon)), items.filter(i => !whitelist.has(i.icon)).map(i => i.key + '=' + i.icon));
// CLAUDE.md Regel 7: vollstaendige, selbsterklaerende Beschreibung - kein Kuerzel-Text.
const kurz = items.filter(i => (i.desc || '').length < 55);
check('1: jede Beschreibung ist ein vollstaendiger Satz (>= 55 Zeichen)', kurz.length === 0,
  kurz.map(i => i.key + '=' + (i.desc || '').length));
check('1: jeder Gegenstand hat eine activate()-Funktion',
  items.every(i => i.hatActivate), items.filter(i => !i.hatActivate).map(i => i.key));

const doppelt = items.map(i => i.key).filter((k, idx, a) => a.indexOf(k) !== idx);
check('2: keine doppelten Gegenstands-Schluessel', doppelt.length === 0, doppelt);
const STUFEN = ['gewoehnlich', 'ungewoehnlich', 'selten', 'episch', 'legendaer'];
const proStufe = {};
items.forEach(i => { proStufe[i.rarity] = (proStufe[i.rarity] || 0) + 1; });
check('2: alle Seltenheitsstufen sind belegt (episch war frueher leer)',
  STUFEN.every(s => (proStufe[s] || 0) > 0), proStufe);
check('2: nur bekannte Seltenheitsstufen', items.every(i => STUFEN.includes(i.rarity)),
  items.filter(i => !STUFEN.includes(i.rarity)).map(i => i.key + '=' + i.rarity));

// ---------------------------------------------------------------- Seltene Materialien + Senken
const rareSrc = block('RARE_ITEMS');
const rares = [...rareSrc.matchAll(/key:'(\w+)', name:'([^']+)', chance:([\d.]+), icon:'([^']+)', rarity:'(\w+)'/g)]
  .map(m => ({ key: m[1], name: m[2], chance: parseFloat(m[3]), icon: m[4], rarity: m[5] }));
check('3: seltene Materialien geparst', rares.length >= 6, rares.length);
check('3: alle Material-Icons aus der Whitelist',
  rares.every(r => whitelist.has(r.icon)), rares.filter(r => !whitelist.has(r.icon)).map(r => r.key));
// Jedes Material, das per Expedition findbar ist (chance > 0), muss irgendwo gebraucht werden -
// sonst sammelt man etwas, das nur im Inventar liegt. Senken: unlockItem an einem Gebaeude,
// SPECIAL_UNIT_ITEMS (Spezialschiffe) oder eine Weltprojekt-Anforderung.
const findbar = rares.filter(r => r.chance > 0);
const ohneSenke = findbar.filter(r => {
  const alsUnlock = new RegExp("unlockItem:'" + r.key + "'").test(src);
  const alsSchiff = new RegExp("SPECIAL_UNIT_ITEMS[\\s\\S]{0,400}" + r.key).test(src);
  const alsProjekt = new RegExp("wp_[\\s\\S]{0,600}" + r.key).test(src);
  return !alsUnlock && !alsSchiff && !alsProjekt;
});
check('3: jedes findbare Material hat eine Senke (Gebaeude, Schiff oder Weltprojekt)',
  ohneSenke.length === 0, ohneSenke.map(r => r.key));

// ---------------------------------------------------------------- Verteidigungs-Gebaeude-Falle
const bSrc = block('BUILDING_DEFS');
const bEintraege = bSrc.split(/\n    \{ key:'/).slice(1);
const defekte = bEintraege
  .filter(t => /category:'defense'/.test(t))
  .map(t => ({ key: (t.match(/^(\w+)'/) || [])[1], defVal: /defVal:/.test(t), atkVal: /atkVal:/.test(t) }))
  .filter(b => !b.defVal || !b.atkVal);
check('4: jedes Verteidigungsgebaeude setzt defVal UND atkVal (sonst NaN-Falle)',
  defekte.length === 0, defekte);

// ---------------------------------------------------------------- neue Zustandsfelder
check('5: freeDoctrineSwitch hat einen Vorgabewert', /state\.freeDoctrineSwitch === undefined\) state\.freeDoctrineSwitch = false/.test(src));
check('5: expeditionSafeRuns hat einen Vorgabewert', /Number\.isFinite\(state\.expeditionSafeRuns\)\) state\.expeditionSafeRuns = 0/.test(src));
check('5: die Quantenpeilung greift wirklich in die Begegnungsauflösung ein',
  /expeditionSafeRuns\|\|0\) > 0/.test(src) && /peilungAktiv \? 0 :/.test(src));
check('5: der Umschulungsbefehl wird beim Doktrinwechsel eingelöst',
  /isSwitch && state\.freeDoctrineSwitch/.test(src) && /state\.freeDoctrineSwitch = false/.test(src));

// ---------------------------------------------------------------- Hilfe mitgezogen (CLAUDE.md 6)
check('6: die Hilfe erklärt Gegenstände und Materialien',
  src.includes('Verbrauchsgegenstände & seltene Materialien'));
const hilfe = src.slice(src.indexOf('Verbrauchsgegenstände & seltene Materialien'), src.indexOf('Verbrauchsgegenstände & seltene Materialien') + 2500);
check('6: die Hilfe nennt die neuen Materialien samt Senke',
  /Resonanzkristall/.test(hilfe) && /Urmaterie/.test(hilfe) && /Resonanzschild-Emitter/.test(hilfe));
const frag = (src.match(/const FRAGMENTS_NEEDED = (\d+)/) || [])[1];
check('6: die Fragment-Zahl in der Hilfe stimmt mit FRAGMENTS_NEEDED überein',
  frag === '4' ? /je vier davon/.test(hilfe) : true, { FRAGMENTS_NEEDED: frag });

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
