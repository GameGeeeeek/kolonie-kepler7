// Kampf-Nachwirkungen (v8.439.0, Modul-Ausbau Etappe 3, Reihenfolge-Wunsch Sascha).
//
// ARCHITEKTUR: Drei Standort-Module (sieg_prod/sieg_atk/sieg_def) zuenden nach jedem gewonnenen
// NPC-Kampf einen zeitbegrenzten Schub ueber das BESTEHENDE state.buffs-System. atk/def rechnet
// der Server via buffMult() aus dem Spielstand mit - es gibt also KEINE versprochene, nie
// ausgezahlte Wirkung. Ausloeser zentral in pushReport (die eine Stelle, durch die jeder
// Bericht laeuft), PvP-/Allianztypen als AUSSCHLUSSLISTE (ein kuenftiger NPC-Typ macht
// automatisch mit; alliance-raid waere als Immer-Sieg ein risikoloser Dauer-Schub).
//
// GEPRUEFT WIRD:
//   1) Vollstaendigkeit: drei Module mit Whitelist-Icons, ganzen Satz-descs, Effekt-Labels
//      (ohne Label zeigt die Karte woertlich "+4% sieg_prod" - der bekannte Notnagel-Bug).
//   2) AUSGEFUEHRT: triggerKampfNachwirkung aus der Datei geschnitten - Schub mit korrektem
//      mult, Deckel greift, ERNEUERN statt stapeln, ohne Module passiert nichts.
//   3) Verdrahtung: Hook in pushReport, Ausschlussliste kennt die PvP-Typen und NICHT npc-attack,
//      Effekte-Leiste nennt die Herkunft, Hilfe-Eintrag existiert.
//   4) Paritaet der Zahlen: Deckel und Dauer der Konstanten stehen woertlich in Hilfe und descs.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren ausgefuehrt): am alten Stand faellt 1a durch
// (Module existieren nicht), ebenso 2a und 3a.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 1) Die drei Module
const modul = key => {
  const m = JS.match(new RegExp("\\{ key:'" + key + "',[\\s\\S]{0,200}?effect:'(sieg_\\w+)', base:(0\\.\\d+),\\n\\s*desc:'([^']+)'"));
  const icon = (JS.match(new RegExp("key:'" + key + "',[^\\n]*icon:'([a-z0-9_-]+)'")) || [])[1];
  return m ? { effect: m[1], base: Number(m[2]), desc: m[3], icon } : null;
};
const MODULE = { siegesschmiede: modul('siegesschmiede'), kampfrausch: modul('kampfrausch'), siegesschirm: modul('siegesschirm') };
check('1a: alle drei Nachwirkungs-Module existieren mit sieg_*-Effekt',
  !!(MODULE.siegesschmiede && MODULE.kampfrausch && MODULE.siegesschirm),
  Object.keys(MODULE).filter(k => !MODULE[k]));
if (!MODULE.siegesschmiede || !MODULE.kampfrausch || !MODULE.siegesschirm) return ende();
// Standort-Module brauchen GEZEICHNETE Icons (test_iconabdeckung zaehlt ti-* als "flach") -
// geprueft wird, dass der Icon-Schluessel ein eigener ICONS-Eintrag mit SVG ist.
check('1b: eigene gezeichnete Icons (ICONS-Eintrag mit SVG), ganze Satz-Beschreibungen (>200 Zeichen)',
  Object.values(MODULE).every(m => new RegExp('\\n    ' + m.icon + ': `<svg').test(JS) && m.desc.length > 200),
  Object.values(MODULE).map(m => [m.icon, m.desc.length]));
// Die Deckel stehen BEWUSST NICHT in den descs (test_bonibilanz Check 6: Obergrenzen an EINER
// Stelle statt in jeder Beschreibung) - genannt werden Dauer und Nicht-Stapeln, der Deckel in der Hilfe.
check('1c: jede Beschreibung nennt Dauer und Nicht-Stapeln, aber KEINE Obergrenze',
  Object.values(MODULE).every(m => m.desc.includes('10 Minuten') && m.desc.includes('stapelt nicht') && !/gedeckelt|Obergrenze/.test(m.desc)));
check('1d: die Effekt-Labels existieren (sonst zeigt die Karte den rohen Schluessel)',
  JS.includes("sieg_prod:'Produktion nach NPC-Sieg (10 Min)'") &&
  JS.includes("sieg_atk:'Angriffskraft nach NPC-Sieg (10 Min)'") &&
  JS.includes("sieg_def:'Verteidigung nach NPC-Sieg (10 Min)'"));

// ---- 2) Ausgefuehrt: Zuenden, Deckel, Erneuern
const defsVon = JS.indexOf('const KAMPF_NACHWIRKUNG_PVP_TYPEN');
const defsBis = JS.indexOf('\n  function battleOutcomeOf', defsVon);
check('2a: Konstanten und Ausloeser stehen vor battleOutcomeOf', defsVon > 0 && defsBis > defsVon);
const quelle = JS.slice(defsVon, defsBis);
const DEFS = new Function(quelle.slice(0, quelle.indexOf('function triggerKampfNachwirkung')) + '\nreturn { pvp: KAMPF_NACHWIRKUNG_PVP_TYPEN, defs: KAMPF_NACHWIRKUNG_DEFS, dauer: KAMPF_NACHWIRKUNG_DAUER_MS };')();
{
  const mach = (bonusJeEffekt) => {
    const state = { buffs: [] };
    const logs = [];
    const fn = new Function('state', 'moduleBonusTotal', 'log',
      quelle + '\nreturn triggerKampfNachwirkung;')(state, (eff) => bonusJeEffekt[eff] || 0, (t) => logs.push(t));
    return { fn, state, logs };
  };
  const a = mach({ sieg_prod: 0.08, sieg_atk: 0.05 });
  a.fn();
  const prodBuff = a.state.buffs.find(b => b.kind === 'prod_all');
  const atkBuff = a.state.buffs.find(b => b.kind === 'atk');
  check('2b: Schub gezuendet - mult exakt 1+Bonus, source nachwirkung, Log erschienen',
    !!prodBuff && prodBuff.mult === 1.08 && prodBuff.source === 'nachwirkung' &&
    !!atkBuff && atkBuff.mult === 1.05 && a.logs.length === 1 && a.logs[0].includes('Sieges-Nachwirkung'),
    { prodBuff, atkBuff, logs: a.logs });
  check('2c: kein Verteidigungs-Schub ohne Siegesschirm-Bonus', !a.state.buffs.some(b => b.kind === 'def'));
  const erstesEnde = prodBuff.expiresAt;
  a.fn();
  check('2d: ERNEUERN statt stapeln - zweiter Sieg ersetzt, verdoppelt nicht',
    a.state.buffs.filter(b => b.kind === 'prod_all').length === 1 &&
    a.state.buffs.find(b => b.kind === 'prod_all').expiresAt >= erstesEnde,
    a.state.buffs.length);
  // Deckel: gemessen gegen die GEPARSTEN Konstanten, nicht gegen eingetippte Zahlen (Arbeitsregel 2).
  const b = mach({ sieg_prod: 9, sieg_atk: 9, sieg_def: 9 });
  b.fn();
  const deckelOk = DEFS.defs.every(d => {
    const buff = b.state.buffs.find(x => x.kind === d.kind);
    return buff && Math.abs(buff.mult - (1 + d.deckel)) < 1e-9;
  });
  check('2e: der Deckel greift je Art (aus den geparsten Konstanten gerechnet)', deckelOk,
    b.state.buffs.map(x => [x.kind, x.mult]));
  const leer = mach({});
  leer.fn();
  check('2f: ohne Nachwirkungs-Module passiert nichts (kein Buff, kein Log)',
    leer.state.buffs.length === 0 && leer.logs.length === 0);
}

// ---- 3) Verdrahtung
{
  const von = JS.indexOf('async function pushReport(');
  const rumpf = JS.slice(von, JS.indexOf('\n  function ', von + 20));
  check('3a: pushReport zuendet bei Sieg ausserhalb der PvP-Typen',
    rumpf.includes("if (outcome === 'win' && !KAMPF_NACHWIRKUNG_PVP_TYPEN.has(report.type)) triggerKampfNachwirkung();"));
}
check('3b: die Ausschlussliste kennt die Spieler-/Allianztypen und NICHT die NPC-Typen',
  ['player-attack', 'alliance-base-attack', 'alliance-raid', 'alliance-muster-attack'].every(t => DEFS.pvp.has(t)) &&
  ['npc-attack', 'raid', 'pirate-debris-raid', 'void-rift', 'expedition'].every(t => !DEFS.pvp.has(t)),
  [...DEFS.pvp]);
check('3c: die Effekte-Leiste nennt die Herkunft',
  JS.includes("b.source === 'nachwirkung' ? ' · Sieges-Nachwirkung'") && JS.includes('${label}${quelle}'));
check('3d: Hilfe-Eintrag existiert und nennt den PvP-Ausschluss',
  /title:'Kampf-Nachwirkungen \(Sieges-Module\)'/.test(JS) &&
  JS.includes('Spieler- und Allianzkämpfe lösen nichts aus.'));

// ---- 4) Paritaet: Konstanten woertlich in den Texten (die "zweite Anzeigestelle", Pflicht 6)
const proz = x => Math.round(x * 100);
const deckelVon = k => DEFS.defs.find(d => d.kind === k).deckel;
check('4a: die Hilfe nennt die Deckel der Konstanten',
  JS.includes('+' + proz(deckelVon('prod_all')) + '% Produktion, +' + proz(deckelVon('atk')) + '% Angriff, +' + proz(deckelVon('def')) + '% Verteidigung'));
// Die Historie liegt seit dem 01.09.2026 an zwei Stellen (Spiel + patchnotes-archiv.json); tests/lib/patchnotes.js setzt sie zusammen.
const PN = require('./lib/patchnotes').patchnotesText(JS);
check('4b: die Patchnote nennt dieselben Deckel (unveraenderliche Historie stimmt zum Startstand)',
  PN.includes('gedeckelt +' + proz(deckelVon('prod_all')) + '%') &&
  PN.includes('gedeckelt +' + proz(deckelVon('atk')) + '%'));
check('4c: die Dauer der Texte ist die Dauer der Konstante',
  DEFS.dauer === 10 * 60 * 1000, DEFS.dauer);

ende();
