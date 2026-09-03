// Schiffsmodul-Synergien (v8.437.0, Modul-Ausbau Etappe 1, Idee Sascha).
//
// GEPRUEFT WERDEN REGELN, die kritischen AUSGEFUEHRT:
//   1) Vollstaendigkeit: jedes geforderte Teil existiert in SHIP_MODULE_DEFS mit passender Klasse,
//      jede gibt-Klasse existiert in SHIP_CLASS_DEFS, Icons aus der Whitelist, ganze Satz-descs.
//   2) PVP-NEUTRALITAET ALS INVARIANTE: gibt-Effekte sind AUSSCHLIESSLICH speed/fuel/cargo.
//      atk (Zielcomputer, Fokusarray) und die Belagerungswerte des Mondzerstoerers liest der
//      SERVER direkt aus dem Spielstand - eine Client-Synergie dort waere versprochene, nie
//      ausgezahlte Wirkung. Wer hier einen neuen Effekt eintraegt, muss diese Liste bewusst
//      erweitern und die Server-Frage beantworten.
//   3) Verrechnung, AUSGEFUEHRT: shipModuleBonusFor aus der Datei geschnitten, Ausruestung
//      gestellt - beide Teile eingebaut gibt exakt wert, ein Teil gibt nichts, fremde
//      Klasse/Effekt bleiben unberuehrt.
//   4) Anzeige verdrahtet: aktive und fast-fertige Synergiezeilen stehen im Markup.
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren ausgefuehrt): am alten Stand faellt 1a durch
// (SHIP_SYNERGY_DEFS existiert nicht).
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// Die HERKUNFT_*-Konstanten werden aus der Datei SELBST gezogen, nicht als feste Liste getippt
// (Regel 40/43): eine getippte Vier-Konstanten-Liste veraltet, sobald eine fuenfte dazukommt -
// genau so ist HERKUNFT_KONVOI (A2) durchgefallen. So ist jede kuenftige HERKUNFT-Konstante dabei.
const herkunftDecls = (JS.match(/const HERKUNFT_[A-Z_]+ = '[a-z]+'/g) || []).join('; ');

function arrAus(name){
  const i = JS.indexOf('const '+name+' = [');
  if (i < 0) return null;
  let d = 0, st = JS.indexOf('[', i), k = st;
  for (; k < JS.length; k++){ if (JS[k]==='[') d++; else if (JS[k]===']'){ d--; if(!d) break; } }
  try { return new Function(herkunftDecls + "; return "+JS.slice(st, k+1)+';')(); }
  // Den Grund NICHT verschlucken: Fehlt dem Praeambel-Text eine Herkunfts-Konstante, ist das
  // ein ReferenceError - und ohne diese Zeile meldete 1a nur "mods:null", was nach einem
  // kaputten Anker aussieht statt nach einer fehlenden Konstante. Gemessen am 02.09.2026 mit
  // HERKUNFT_KONVOI; die naechste neue Konstante laeuft sonst in dieselbe stumme Meldung.
  catch(e){ parseFehler.push(name + ': ' + e.message); return null; }
}
function fnAus(name){
  const von = JS.indexOf('function '+name+'(');
  if (von < 0) return '';
  const bis = JS.indexOf('\n  }', von);
  return bis > von ? JS.slice(von, bis + 4) : '';
}

const parseFehler = [];
const SYN = arrAus('SHIP_SYNERGY_DEFS');
const MODS = arrAus('SHIP_MODULE_DEFS');
const KLASSEN = arrAus('SHIP_CLASS_DEFS');
check('1a: SHIP_SYNERGY_DEFS, SHIP_MODULE_DEFS und SHIP_CLASS_DEFS geparst',
  !!(SYN && MODS && KLASSEN), { syn: SYN && SYN.length, mods: MODS && MODS.length, parseFehler });
if (!SYN || !MODS || !KLASSEN) return ende();

// ---- 1) Vollstaendigkeit
const whitelist = new Set([...HTML.matchAll(/\.(ti-[a-z0-9-]+):before/g)].map(m => m[1]));
check('1b: jedes geforderte Teil existiert mit passender Klasse',
  SYN.every(sy => sy.req.every(r => MODS.some(m => m.key === r.typ && m.klasse === r.klasse))),
  SYN.filter(sy => !sy.req.every(r => MODS.some(m => m.key === r.typ && m.klasse === r.klasse))).map(sy=>sy.key));
check('1c: jede gibt-Klasse existiert', SYN.every(sy => sy.gibt.every(g => KLASSEN.some(c => c.key === g.klasse))));
check('1d: Icons aus der Whitelist, ganze Satz-Beschreibungen',
  SYN.every(sy => whitelist.has(sy.icon) && sy.desc && sy.desc.length > 80));
check('1e: mindestens sechs Synergien, alle Schluessel eindeutig',
  SYN.length >= 6 && new Set(SYN.map(s=>s.key)).size === SYN.length, SYN.length);

// ---- 2) PvP-Neutralitaet als Invariante
const ERLAUBT = ['speed', 'fuel', 'cargo'];
const verstoss = SYN.flatMap(sy => sy.gibt.filter(g => !ERLAUBT.includes(g.effect)).map(g => sy.key+':'+g.effect));
check('2a: gibt-Effekte sind AUSSCHLIESSLICH speed/fuel/cargo (Server liest atk/Belagerung direkt)',
  verstoss.length === 0, verstoss);
check('2b: jeder Einzelwert bleibt klein (<= 0.10 - Synergien sind Zulage, kein zweites Modul)',
  SYN.every(sy => sy.gibt.every(g => g.wert > 0 && g.wert <= 0.10)));

// ---- 3) Verrechnung ausgefuehrt
{
  /* shipModuleBonusFor addiert seit dem 21.08.2026 auch den KLASSEN-SET-Bonus. Die zwei dafuer
     noetigen Funktionen und ihre Tabelle werden AUS DER DATEI geschnitten, nicht durch einen
     Platzhalter ersetzt (Arbeitsregel 36) - sonst maesse dieser Test einen Nachbau. Ohne sie
     starb er mit "shipModuleSetBonus is not defined"; das ist dieselbe Bausteinlisten-Falle wie
     in test_protomaterie am selben Tag. */
  const setTab = (() => { const v = JS.indexOf('  const SHIP_MODULE_SET_DEFS = [');
                          const b = v < 0 ? -1 : JS.indexOf('\n  ];', v);
                          return (v >= 0 && b > v) ? JS.slice(v, b + 5) : ''; })();
  const quelle = setTab + '\n' + fnAus('shipModuleSetTeile') + '\n' + fnAus('shipModuleSetBonus') + '\n'
    + fnAus('shipSynergyAktiv') + '\n' + fnAus('shipSynergyBonusFor') + '\n' + fnAus('shipModuleBonusFor');
  check('3a: alle Funktionen gefunden - inklusive der Set-Bausteine', quelle.length > 600
    && /SHIP_MODULE_SET_DEFS/.test(quelle) && /function shipModuleSetBonus/.test(quelle), quelle.length);
  const mach = (ausruestung) => new Function('SHIP_SYNERGY_DEFS', 'equippedShipModulesAt', 'shipModuleInstanceInfo',
    quelle + '\nreturn shipModuleBonusFor;')(SYN, (kl) => ausruestung[kl] || [], () => null);
  const sy = SYN.find(x => x.key === 'konvoi');
  const voll = { frachter: ['fr_triebwerke:selten'], aufklaerer: ['au_sensoren:episch:1:x'] };
  const halb = { frachter: ['fr_triebwerke:selten'], aufklaerer: [] };
  const erwartet = kl => sy.gibt.filter(g => g.klasse === kl).reduce((a,g)=>a+g.wert,0);
  check('3b: beide Teile eingebaut -> exakt der gibt-Wert (aus den geparsten Defs gerechnet)',
    mach(voll)('frachter','speed') === erwartet('frachter') && mach(voll)('aufklaerer','speed') === erwartet('aufklaerer'),
    { frachter: mach(voll)('frachter','speed'), erwartet: erwartet('frachter') });
  check('3c: nur ein Teil -> nichts', mach(halb)('frachter','speed') === 0);
  check('3d: fremde Klasse und fremder Effekt bleiben unberuehrt',
    mach(voll)('schlachtschiff','speed') === 0 && mach(voll)('frachter','atk') === 0);
  // Gleiche-Klasse-Synergie (Taktgeber: beide Teile in 'raffiniert') funktioniert ebenso.
  const t2 = { raffiniert: ['t2_nanoantrieb:selten', 't2_quantenkondensator:selten'] };
  const tg = SYN.find(x => x.key === 'taktgeber');
  check('3e: Synergie innerhalb EINER Klasse (Taktgeber-Verbund)',
    mach(t2)('raffiniert','speed') === tg.gibt.find(g=>g.effect==='speed').wert &&
    mach(t2)('raffiniert','fuel') === tg.gibt.find(g=>g.effect==='fuel').wert);
}

// ---- 4) Anzeige und Hilfe verdrahtet
check('4a: aktive und fast-fertige Synergiezeilen stehen im Markup',
  JS.includes('Synergie „${syn.name}" aktiv') && JS.includes('Synergie „${syn.name}": nur noch ${fehlt} fehlt'));
check('4b: der Hilfe-Abschnitt nennt die Synergien und ihre Neutralitaet',
  /Synergien:<\/strong> Sechs benannte Modul-Kombinationen/.test(JS));

ende();
