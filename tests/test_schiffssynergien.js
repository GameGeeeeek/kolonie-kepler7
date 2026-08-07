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

function arrAus(name){
  const i = JS.indexOf('const '+name+' = [');
  if (i < 0) return null;
  let d = 0, st = JS.indexOf('[', i), k = st;
  for (; k < JS.length; k++){ if (JS[k]==='[') d++; else if (JS[k]===']'){ d--; if(!d) break; } }
  try { return new Function("const HERKUNFT_NORMAL='normal', HERKUNFT_ABGRUND='abgrund', HERKUNFT_BOSS='boss'; return "+JS.slice(st, k+1)+';')(); }
  catch(e){ return null; }
}
function fnAus(name){
  const von = JS.indexOf('function '+name+'(');
  if (von < 0) return '';
  const bis = JS.indexOf('\n  }', von);
  return bis > von ? JS.slice(von, bis + 4) : '';
}

const SYN = arrAus('SHIP_SYNERGY_DEFS');
const MODS = arrAus('SHIP_MODULE_DEFS');
const KLASSEN = arrAus('SHIP_CLASS_DEFS');
check('1a: SHIP_SYNERGY_DEFS, SHIP_MODULE_DEFS und SHIP_CLASS_DEFS geparst',
  !!(SYN && MODS && KLASSEN), { syn: SYN && SYN.length, mods: MODS && MODS.length });
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
  const quelle = fnAus('shipSynergyAktiv') + '\n' + fnAus('shipSynergyBonusFor') + '\n' + fnAus('shipModuleBonusFor');
  check('3a: alle drei Funktionen gefunden', quelle.length > 600, quelle.length);
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
