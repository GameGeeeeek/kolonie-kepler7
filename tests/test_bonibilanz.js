// Boni-Bilanz v8.298.17.
//
// Anlass war ein Spieler-Report: "Man bekommt so viele Boni ... das ist aber gedeckelt. Dieser
// Deckel steht aber nirgendwo." Nachgemessen stimmte das: von elf grossen Deckeln standen sieben
// verstreut in Einzelbeschreibungen, vier nirgends. Die Antwort ist EINE Bilanz-Box statt
// "gedeckelt" in zwanzig desc-Texten.
//
// Zwei Fehlerbilder, die dieser Test verhindern soll:
//   1) Die Bilanz baut eine EIGENE Beitragsliste auf und veraltet beim naechsten neuen Bonus. Sie
//      muss dieselben Funktionen lesen, die das Spiel auch rechnet (CLAUDE.md Regel 6).
//   2) Die Deckel-Zahlen in der Bilanz laufen von den Deckeln in der Mechanik weg - dann zeigt die
//      Box eine Obergrenze an, die es so gar nicht gibt. Deshalb wird jede Gruppe gegen die ECHTE
//      Verbrauchsstelle in der Spieldatei geprueft.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const whitelist = new Set([...src.matchAll(/^\s*\.(ti-[a-z0-9-]+):before/gm)].map(m => m[1]));

// ---------------------------------------------------------------- Gruppen ausführbar machen
const von = src.indexOf('const BONUS_GROUPS = [');
const bis = src.indexOf('let lastBonusBalanceSig', von);
check('Gruppen-Block gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const block = src.slice(von, bis);

function baue(werte){
  const ctx = {};
  const w = werte || {};
  const state = { activeBasePlanet:'home', xp:0, prestige:0 };
  new Function('ctx', 'state', 'PROD_BONUS_CAP', 'productionBonusRaw', 'attackCombatBonusRaw',
    'defenseCombatBonusRaw', 'moduleBonusAt', 'moduleBonusTotal', 'allBuildingSets', 'commanderLevel',
    block + ';ctx.G=BONUS_GROUPS;'
  )(ctx, state, 1.0,
    () => w.prod || 0,
    () => w.atk || 0,
    () => w.def || 0,
    (pk, eff) => (w.modAt || {})[eff] || 0,
    (eff) => (w.modTotal || {})[eff] || 0,
    () => [w.buildings || {}],
    () => w.level || 0);
  return { ctx, state };
}

const G = baue().ctx.G;

// ---------------------------------------------------------------- 1) Form
check('1: es gibt Bonus-Gruppen', G.length >= 10, G.length);
check('1: jede Gruppe hat Name, Icon (Whitelist), Quelle, Rohwert und Deckel',
  G.every(g => g.name && whitelist.has(g.icon) && g.quelle && typeof g.roh === 'function' && typeof g.deckel === 'function'),
  G.filter(g => !(g.name && whitelist.has(g.icon) && g.quelle)).map(g => g.key + '=' + g.icon));
check('1: keine doppelten Schlüssel', new Set(G.map(g => g.key)).size === G.length);
check('1: jede Gruppe sagt, ob sie mehr oder weniger bedeutet',
  G.every(g => g.richtung === 'plus' || g.richtung === 'minus'),
  G.filter(g => !['plus','minus'].includes(g.richtung)).map(g => g.key));
check('1: jeder Deckel ist eine sinnvolle Zahl über null',
  G.every(g => Number.isFinite(g.deckel()) && g.deckel() > 0 && g.deckel() <= 2),
  G.map(g => g.key + '=' + g.deckel()));
// Die Quellenangabe ist das, was den Deckel-Text in den Einzelbeschreibungen ersetzt - sie muss
// tatsaechlich etwas sagen, nicht nur ein Wort sein.
check('1: jede Gruppe nennt ihre Quellen ausformuliert',
  G.every(g => g.quelle.length >= 20), G.filter(g => g.quelle.length < 20).map(g => g.key));

// ---------------------------------------------------------------- 2) Rohwerte kommen aus dem Spiel
// Kein eigener Nachbau: wird die Spielfunktion veraendert, muss sich die Bilanz mitaendern.
const gefuettert = baue({
  prod: 0.42, atk: 1.7, def: 0.3,
  modAt: { buildspeed: 0.9, defatk: 0.2, raidloss: 0.1, fuelcost: 0.05, exprisk: 0.0 },
  modTotal: { research: 0.55, expedition: 0.4, trade: 0.9, xpgain: 0.1 },
  buildings: { werftkern: 8, quantenwerft: 6 }, level: 50
}).ctx.G;
const w = (k) => gefuettert.find(g => g.key === k).roh();
check('2: die Produktions-Gruppe liest productionBonusRaw()', Math.abs(w('prod') - 0.42) < 1e-9, w('prod'));
check('2: die Angriffs-Gruppe liest attackCombatBonusRaw()', Math.abs(w('atk') - 1.7) < 1e-9, w('atk'));
check('2: die Verteidigungs-Gruppe liest defenseCombatBonusRaw()', Math.abs(w('def') - 0.3) < 1e-9, w('def'));
check('2: ortsgebundene Modul-Gruppen lesen moduleBonusAt()', Math.abs(w('buildspeed') - 0.9) < 1e-9, w('buildspeed'));
check('2: imperiumsweite Modul-Gruppen lesen moduleBonusTotal()', Math.abs(w('research') - 0.55) < 1e-9, w('research'));
check('2: die Werft-Gebäude-Gruppe zählt beide Gebäudearten zusammen',
  Math.abs(w('werftkern') - 14*0.015) < 1e-9, { gemessen: w('werftkern'), erwartet: 14*0.015 });
check('2: die Kommandanten-Gruppe hängt am Level', Math.abs(w('commander') - 0.5) < 1e-9, w('commander'));

// ---------------------------------------------------------------- 3) Deckel = die echten Deckel
// Jede Gruppe wird gegen die Verbrauchsstelle in der Spieldatei geprueft. Laeuft eine Zahl weg,
// zeigt die Bilanz eine Obergrenze an, die es nicht gibt - schlimmer als gar keine Anzeige.
const D = {};
G.forEach(g => { D[g.key] = g.deckel(); });
const echt = [
  ['prod',       /globalBonus = Math\.min\(PROD_BONUS_CAP, globalBonus\)/, () => parseFloat((src.match(/const PROD_BONUS_CAP = ([\d.]+)/)||[])[1])],
  ['atk',        null, () => parseFloat((src.match(/Math\.min\(([\d.]+), attackCombatBonusRaw\(planetKey\)\)/)||[])[1])],
  ['def',        null, () => parseFloat((src.match(/Math\.min\(([\d.]+), defenseCombatBonusRaw\(planetKey\)\)/)||[])[1])],
  ['buildspeed', null, () => 1 - parseFloat((src.match(/Math\.max\(([\d.]+), 1 - moduleBonusAt\(planetKey, 'buildspeed'\)\)/)||[])[1])],
  ['defatk',     null, () => parseFloat((src.match(/Math\.min\(([\d.]+), moduleBonusAt\(planetKey, 'defatk'\)\)/)||[])[1])],
  ['raidloss',   null, () => 1 - parseFloat((src.match(/Math\.max\(([\d.]+), 1 - moduleBonusAt\(targetPlanet, 'raidloss'\)\)/)||[])[1])],
  ['fuelcost',   null, () => 1 - parseFloat((src.match(/Math\.max\(([\d.]+), 1 - moduleBonusAt\(state\.activeBasePlanet, 'fuelcost'\)\)/)||[])[1])],
  ['exprisk',    null, () => 1 - parseFloat((src.match(/Math\.max\(([\d.]+), 1 - moduleBonusAt\(planetKey, 'exprisk'\)\)/)||[])[1])],
  ['research',   null, () => 1 - parseFloat((src.match(/Math\.max\(([\d.]+), 1 - moduleBonusTotal\('research'\)\)/)||[])[1])],
  ['expedition', null, () => parseFloat((src.match(/Math\.min\(([\d.]+), moduleBonusTotal\('expedition'\)\)/)||[])[1])],
  ['trade',      null, () => parseFloat((src.match(/Math\.min\(([\d.]+), moduleBonusTotal\('trade'\)\)/)||[])[1])],
  ['xpgain',     null, () => parseFloat((src.match(/Math\.min\(([\d.]+), moduleBonusTotal\('xpgain'\)\)/)||[])[1])],
  ['werftkern',  null, () => parseFloat((src.match(/Math\.min\(([\d.]+), werftkernLvl\*0\.015\)/)||[])[1])],
  ['commander',  null, () => parseFloat((src.match(/Math\.min\(([\d.]+), commanderLevel\(state\.xp\|\|0\)\*0\.01\)/)||[])[1])],
  ['prestige',   null, () => parseFloat((src.match(/Math\.min\(([\d.]+), \(state\.prestige\|\|0\)\*0\.05\)/)||[])[1])]
];
const abweichung = [];
echt.forEach(([key, , holen]) => {
  const ausMechanik = holen();
  if (!Number.isFinite(ausMechanik)){ abweichung.push(key + ': Verbrauchsstelle nicht gefunden'); return; }
  if (D[key] === undefined){ abweichung.push(key + ': Gruppe fehlt in der Bilanz'); return; }
  if (Math.abs(D[key] - ausMechanik) > 1e-9) abweichung.push(key + ': Bilanz ' + D[key] + ' vs. Mechanik ' + ausMechanik);
});
check('3: jeder angezeigte Deckel stimmt mit der echten Verbrauchsstelle überein', abweichung.length === 0, abweichung);
check('3: die Bilanz deckt alle geprüften Verbrauchsstellen ab', echt.length === G.length,
  { gruppen: G.length, geprueft: echt.length });

// ---------------------------------------------------------------- 4) Rechnung
const rand = baue({ modAt:{ buildspeed: 0.9 } }).ctx.G.find(g => g.key === 'buildspeed');
check('4: über dem Deckel wird gekappt', Math.min(rand.deckel(), rand.roh()) === rand.deckel());
const drunter = baue({ modAt:{ buildspeed: 0.2 } }).ctx.G.find(g => g.key === 'buildspeed');
check('4: unter dem Deckel bleibt der volle Wert', Math.abs(Math.min(drunter.deckel(), drunter.roh()) - 0.2) < 1e-9);
const leer = baue().ctx.G;
check('4: ohne jeden Bonus steht alles auf 0', leer.every(g => g.roh() === 0), leer.filter(g => g.roh() !== 0).map(g => g.key));

// ---------------------------------------------------------------- 5) Anzeige verdrahtet
check('5: die Box existiert im Fortschritt-Tab', /id="bonusBalanceBox"/.test(src) && /data-sec="bonibilanz"/.test(src));
check('5: und wird gerendert', /renderBonusBalance\(\);/.test(src));
check('5: sie nutzt den Signatur-Cache (kein Live-Countdown in der Box)',
  /lastBonusBalanceSig/.test(src) && /if \(sig === lastBonusBalanceSig\) return;/.test(src));
check('5: sie nennt Rohwert, wirksamen Wert und Obergrenze',
  /von \$\{vz\}\$\{pct\(roh\)\} · max\. \$\{vz\}\$\{pct\(deckel\)\}/.test(src));
check('5: und sagt, wie viel an der Grenze verpufft',
  /Obergrenze erreicht – \$\{pct\(verpufft\)\} ohne Wirkung/.test(src));
check('5: und wie viel Luft sonst noch ist', /noch \$\{pct\(deckel-roh\)\} Luft/.test(src));

// ---------------------------------------------------------------- 6) Einzelbeschreibungen entlastet
// Der eigentliche Punkt des Spieler-Reports: NICHT in jede Beschreibung "gedeckelt" schreiben.
// Bewusst nur die SPIELER-TEXTE (desc:'...'), nicht die Code-Kommentare daneben - die duerfen und
// sollen die Deckel weiterhin nennen, sie sind ja weiterhin in der Mechanik.
const defsBlock = src.slice(src.indexOf('const MODULE_DEFS = ['), src.indexOf('const SHIP_MODULE_DEFS'));
const modulTexte = [...defsBlock.matchAll(/desc:'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]);
check('6: die Modul-Beschreibungen wurden gefunden', modulTexte.length >= 10, modulTexte.length);
check('6: keine Modul-Beschreibung wiederholt ihre Obergrenze mehr',
  !modulTexte.some(t => /gedeckelt|Obergrenze/.test(t)),
  modulTexte.filter(t => /gedeckelt|Obergrenze/.test(t)).map(t => t.slice(0, 60)));
check('6: die Hilfe erklärt die Bilanz an einer Stelle',
  /Boni-Bilanz: was deine Boni wirklich bringen/.test(src));
check('6: und begründet, warum die Einzelbeschreibungen schweigen',
  /an zwanzig Stellen/.test(src));
// productionBonusRaw muss ausgelagert sein - sonst haette die Bilanz die Beitragsliste kopieren muessen.
check('6: die Produktions-Beitragsliste existiert nur EINMAL',
  (src.match(/function productionBonusRaw\(\)/g) || []).length === 1 &&
  (src.match(/globalBonus \+= prestigePerkCount\('prod'\)\*0\.03;/g) || []).length === 1);

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
