// Die Randkriege: Kontrollpunkte, Puffer, Tickdeckel und die Sperre gegen das Großkonto.
//
// Bis zum 10.08.2026 bewegte sich Territorium nur in Sprüngen: Expansion nimmt ein System, ein Krieg
// nimmt eines, dazwischen passiert nichts Sichtbares. Die Front legt eine langsame Größe darüber –
// je umkämpftem Grenzsystem ein Wert 0…1000 mit Besitzschwellen bei 300 und 700.
//
// WIE GEMESSEN WIRD: wie beim Kriegstest – der ECHTE Funktionsquelltext aus server.js wird
// herausgeschnitten und mit gestellten Nachbarn ausgeführt. Kein Nachbau.
//
// GEGENPROBE (beide Richtungen, 10.08.2026):
//   Alter Stand (`git -C ../kolonie-kepler7-backend show HEAD:server.js`): rkTick existiert nicht.
//   Gezielt kaputtgemacht, jeweils genau eine Prüfung rot:
//     - Tickdeckel RK_TICK_DECKEL 3 → 999  ......... „kein Takt bewegt mehr als 3"
//     - Auslöschung entfernt (netto = puffer.a) ..... „gleich starke Gegenseiten bewegen nichts"
//     - Sperre auf `aufGewinnerseite < 1` ........... „ein Einzelkonto kippt keine Schwelle"
//     - Wächter `systems.length < 2` entfernt ....... „keine Fraktion verliert ihr letztes System"
//   Nachtrag 10.08.2026: rkAktiveSpieler las `u.lastSeen` - ein Feld, das es gar nicht gibt. Der Test
//   hat es nicht bemerkt, weil sein Fixture denselben erfundenen Schlüssel setzte. Seit baueDb()
//   liegt der Zeitstempel dort, wo der Server ihn wirklich sucht; die Prüfungen 7 und 9 messen
//   damit erstmals etwas.

const { SERVER_JS, ueberspringen, pruefer } = require('./lib/umgebung');
const fs = require('fs');

if (!SERVER_JS) ueberspringen('Prüft Backend-Code - das Backend-Repo (kolonie-kepler7-backend) liegt hier nicht daneben.');

const { check, ende } = pruefer();
const src = fs.readFileSync(process.env.KEPLER_BACKEND_SERVER || SERVER_JS, 'utf8');

// ---- Quelltext holen ---------------------------------------------------------------------------
function holeFunktion(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) return null;
  const schluss = src.indexOf('\n}', start);
  return schluss < 0 ? null : src.slice(start, schluss + 2);
}
// Konstanten stehen teils zu mehreren in EINER Deklaration (`const RK_UNTEN = 300, RK_OBEN = 700;`).
// Der erste Extraktor suchte nur `^const <name> =` und fand RK_OBEN deshalb nicht - der Test meldete
// eine fehlende Konstante, obwohl sie da war.
function holeKonstante(name) {
  // Ob ein Komma das Ende ist, haengt am WERT: Objekt- und Array-Literale (FACTION_RIVALS,
  // RK_FRONT_PAARE) stecken selbst voller Kommas und reichen bis zum Semikolon; einfache Werte
  // enden am ersten Komma, weil dahinter die naechste Konstante derselben Deklaration steht
  // (`const RK_UNTEN = 300, RK_OBEN = 700;`). Ohne diese Unterscheidung lieferte RK_UNTEN die
  // ganze Kette und RK_OBEN kam ein zweites Mal dazu - "Identifier has already been declared".
  const eigen = src.match(new RegExp('^const ' + name + ' = ([^;]+);', 'm'));
  if (eigen) {
    const wert = eigen[1].trim();
    if (wert[0] === '{' || wert[0] === '[') return 'const ' + name + ' = ' + wert + ';';
    return 'const ' + name + ' = ' + wert.split(',')[0].trim() + ';';
  }
  // Danach die Kettenform. Hier darf NICHT ueber Kommas hinweggelesen werden, sonst schluckt der
  // Ausdruck den naechsten Eintrag mit.
  const kette = src.match(new RegExp('^const [^;\n]*\\b' + name + ' = ([^;,\n]+)[;,]', 'm'));
  return kette ? 'const ' + name + ' = ' + kette[1].trim() + ';' : null;
}
const FN = ['rkGrenzsysteme', 'loadOrInitRandkriege', 'getUserLastSeen', 'rkAktiveSpieler', 'rkTick'];
const KONST = ['FACTION_RIVALS', 'RK_FRONT_PAARE', 'RK_SYSTEME_JE_FRONT', 'RK_MAX', 'RK_UNTEN',
  'RK_OBEN', 'RK_TICK_DECKEL', 'RK_MIN_BEITRAGENDE', 'RK_BEITRAG_FENSTER'];
const fnQ = FN.map(n => ({ n, q: holeFunktion(n) }));
const kQ = KONST.map(n => ({ n, q: holeKonstante(n) }));
for (const { n, q } of fnQ) check(n + ' gefunden', !!q && q.length > 60, q ? q.length : 0);
for (const { n, q } of kQ) check('Konstante ' + n + ' gefunden', !!q, q);
if (fnQ.some(x => !x.q) || kQ.some(x => !x.q)) ende();

// Die Rivalenpaare müssen zu FACTION_RIVALS passen - sonst kämpfte die Front gegen die falsche
// Fraktion, ohne dass irgendetwas auffiele.
{
  const rivalen = new Function(kQ.find(x => x.n === 'FACTION_RIVALS').q + '; return FACTION_RIVALS;')();
  const paare = new Function(kQ.find(x => x.n === 'RK_FRONT_PAARE').q + '; return RK_FRONT_PAARE;')();
  check('jede Front ist ein echtes Rivalenpaar', paare.every(([a, b]) => rivalen[a] === b && rivalen[b] === a), paare);
  check('zwei Fronten', paare.length === 2, paare.length);
  // Und dieselben Paare wie im Frontend - sonst zeigt die Karte eine andere Feindschaft als der Server rechnet.
  const feSrc = fs.readFileSync(require('./lib/umgebung').SPIELDATEI, 'utf8');
  const feZeile = (feSrc.match(/const FACTION_RIVALS = \{[^}]*\}/) || [''])[0];
  check('Frontend-FACTION_RIVALS gefunden', feZeile.length > 20);
  const feRiv = feZeile ? new Function('return ' + feZeile.replace('const FACTION_RIVALS = ', ''))() : {};
  check('Rivalen stimmen mit dem Frontend überein',
    JSON.stringify(feRiv) === JSON.stringify(rivalen), { frontend: feRiv, backend: rivalen });
}

// ---- Gestellte Umgebung ------------------------------------------------------------------------
// Sieben Systeme in einer Reihe; a hält s1..s3, b hält s5..s7, s4 ist die Naht. So ist jede Grenze
// von Hand nachvollziehbar.
// db.users fuehrt KEIN lastSeen - der Zeitstempel eines Kontos liegt in db.shared['leaderboard:<id>'],
// und jede Stelle im Server liest ihn ueber getUserLastSeen(). Im ersten Anlauf war das hier geraten
// statt abgelesen: Das Fixture setzte `lastSeen` direkt aufs Benutzerobjekt, rkAktiveSpieler las
// ebenfalls dort - beide Seiten teilten dieselbe falsche Annahme, und die Pruefungen 7/9 waren gruen,
// obwohl die Funktion auf dem echten Server IMMER 0 lieferte (Hausregel 4: Fixture-Schluessel aus dem
// Code ablesen, nie raten). Jetzt baut das Fixture beide Orte so, wie der Server sie fuehrt.
function baueDb(users) {
  const raus = { users: {}, shared: {} };
  for (const [name, wert] of Object.entries(users || {})) {
    const uid = wert.userId || name;
    raus.users[name] = { userId: uid };
    if (wert.lastSeen) raus.shared['leaderboard:' + uid] = JSON.stringify({ lastSeen: wert.lastSeen });
  }
  return raus;
}
function baueUmgebung(opt) {
  const o = opt || {};
  const NACHBARN = { s1:['s2'], s2:['s1','s3'], s3:['s2','s4'], s4:['s3','s5'], s5:['s4','s6'], s6:['s5','s7'], s7:['s6'] };
  const nachrichten = [];
  const factions = o.factions || {
    kartell:  { id:'kartell',  name:'Aschen-Kartell', systems:['s1','s2','s3','s4'], strength: o.strA !== undefined ? o.strA : 2 },
    schatten: { id:'schatten', name:'Schattenbund',   systems:['s5','s6','s7'],      strength: o.strB !== undefined ? o.strB : 2 },
    legion:   { id:'legion',   name:'Eisenlegion',    systems:[], strength:1 },
    void:     { id:'void',     name:'Void-Marodeure', systems:[], strength:1 }
  };
  const galaxie = { collapsedSystems:{}, controlledSystems: o.controlled || {}, randkriege: o.randkriege };
  const kontext = {
    SYSTEM_NEIGHBORS: NACHBARN,
    occupiedSystems: () => new Set(o.spielerHeimat || []),
    loadOrInitFactions: () => factions,
    pushGalaxyNews: (icon, text) => nachrichten.push({ icon, text }),
    db: baueDb(o.users),
    Math: o.mathe || Math,
    Date: o.datum || Date
  };
  const namen = Object.keys(kontext);
  const koerper = kQ.map(x => x.q).join('\n') + '\n' + fnQ.map(x => x.q).join('\n\n')
    + '\nreturn { rkTick, rkGrenzsysteme, loadOrInitRandkriege, rkAktiveSpieler, RK_OBEN, RK_UNTEN, RK_TICK_DECKEL, RK_MAX };';
  const api = new Function(...namen, koerper)(...namen.map(k => kontext[k]));
  return { api, galaxie, factions, nachrichten };
}
const jetzt = 1786000000000;
const festeUhr = Object.assign(Object.create(Date), { now: () => jetzt });
function frontVon(u, aId) { return (u.galaxie.randkriege.fronten || []).find(f => f.a === aId); }

// ---- 1. Die Front entsteht und trifft die richtigen Systeme -------------------------------------
{
  const u = baueUmgebung({ datum: festeUhr });
  u.api.rkTick(u.galaxie);
  const f = frontVon(u, 'kartell');
  check('1: Front Kartell↔Schatten angelegt', !!f, (u.galaxie.randkriege.fronten || []).map(x => x.a + '|' + x.b));
  check('1: zwei Fronten insgesamt', u.galaxie.randkriege.fronten.length === 2);
  // Nur s4 (Kartell, grenzt an s5) und s5 (Schatten, grenzt an s4) sind echte Grenzsysteme.
  const sys = f.systeme.map(e => e.sys).sort();
  check('1: nur die echten Grenzsysteme sind Front', JSON.stringify(sys) === JSON.stringify(['s4','s5']), sys);
  check('1: jedes Frontsystem startet im Besitz seines Halters',
    f.systeme.every(e => (e.sys === 's4' ? e.kp > 700 : e.kp < 300)), f.systeme.map(e => e.sys + ':' + Math.round(e.kp)));
}

// ---- 2. Gleich starke Gegenseiten bewegen die Front NICHT ---------------------------------------
{
  const u = baueUmgebung({ strA: 3, strB: 3, datum: festeUhr });
  u.api.rkTick(u.galaxie);
  const f = frontVon(u, 'kartell');
  const e = f.systeme.find(x => x.sys === 's4');
  const vorher = e.kp;
  // Beide Seiten legen gleich viel in den Puffer - die Auslöschung muss daraus null machen.
  e.puffer.a = 400; e.puffer.b = 400;
  u.api.rkTick(u.galaxie);
  check('2: gleich starke Gegenseiten bewegen nichts', Math.abs(e.kp - vorher) < 0.001,
    { vorher, nachher: e.kp });
  check('2: die Puffer sind danach geleert', e.puffer.a === 0 && e.puffer.b === 0, e.puffer);
}

// ---- 3. Der Tickdeckel greift -------------------------------------------------------------------
{
  const u = baueUmgebung({ strA: 6, strB: 1, datum: festeUhr });
  u.api.rkTick(u.galaxie);
  const f = frontVon(u, 'kartell');
  const e = f.systeme.find(x => x.sys === 's5');
  let groesster = 0;
  for (let i = 0; i < 20; i++) {
    e.puffer.a = 1000000;                       // absurd viel - der Deckel muss es abfangen
    const vorher = e.kp;
    u.api.rkTick(u.galaxie);
    const ziel = frontVon(u, 'kartell').systeme.find(x => x.sys === 's5');
    if (!ziel) break;                            // System hat den Besitzer gewechselt
    groesster = Math.max(groesster, Math.abs(ziel.kp - vorher));
  }
  check('3: kein Takt bewegt mehr als 3 Kontrollpunkte', groesster <= 3.0001, groesster);
  // Und die Probe darf nicht dadurch bestehen, dass sich gar nichts bewegt hat.
  check('3: es hat sich überhaupt etwas bewegt', groesster > 0.5, groesster);
}

// ---- 4. Vier Kriegspunkte ergeben einen Kontrollpunkt --------------------------------------------
{
  const u = baueUmgebung({ strA: 2, strB: 2, datum: festeUhr });   // Grundbewegung 0
  u.api.rkTick(u.galaxie);
  const e = frontVon(u, 'kartell').systeme.find(x => x.sys === 's4');
  const vorher = e.kp;
  e.puffer.a = 8;                                // 8 Kriegspunkte -> 2 Kontrollpunkte
  u.api.rkTick(u.galaxie);
  check('4: 8 Kriegspunkte ergeben 2 Kontrollpunkte', Math.abs((e.kp - vorher) - 2) < 0.001,
    { vorher, nachher: e.kp });
}

// ---- 5. Die Grundbewegung folgt dem Stärkeverhältnis ---------------------------------------------
{
  const stark = baueUmgebung({ strA: 6, strB: 1, datum: festeUhr });
  stark.api.rkTick(stark.galaxie);
  const eS = frontVon(stark, 'kartell').systeme.find(x => x.sys === 's5');
  const vS = eS.kp; stark.api.rkTick(stark.galaxie);
  check('5: die stärkere Fraktion drückt die Front', eS.kp > vS, { vorher: vS, nachher: eS.kp });

  const gleich = baueUmgebung({ strA: 2, strB: 2, datum: festeUhr });
  gleich.api.rkTick(gleich.galaxie);
  const eG = frontVon(gleich, 'kartell').systeme.find(x => x.sys === 's5');
  const vG = eG.kp; gleich.api.rkTick(gleich.galaxie);
  check('5: bei gleicher Stärke steht sie still', Math.abs(eG.kp - vG) < 0.001, { vorher: vG, nachher: eG.kp });
}

// ---- 6. Eine Schwelle fällt und das System wechselt den Besitzer ---------------------------------
{
  const u = baueUmgebung({ strA: 6, strB: 1, datum: festeUhr });
  u.api.rkTick(u.galaxie);
  const schatten = u.factions.schatten, kartell = u.factions.kartell;
  const vorherS = schatten.systems.length;
  // Ohne Spielerbeiträge greift die Sperre nicht - reine NPC-Bewegung darf die Front verschieben.
  let takte = 0;
  while (schatten.systems.includes('s5') && takte < 2000) { u.api.rkTick(u.galaxie); takte++; }
  check('6: das Grenzsystem hat den Besitzer gewechselt', !schatten.systems.includes('s5'), { takte });
  check('6: der Gewinner hat es', kartell.systems.includes('s5'));
  check('6: der Verlierer hat ein System weniger', schatten.systems.length === vorherS - 1);
  check('6: es gab eine Meldung dazu',
    u.nachrichten.some(n => /durchbrochen/.test(n.text) && n.text.includes('s5')), u.nachrichten.map(n => n.text));
  // Der Weg muss lang sein - das ist der Kern des Entwurfs. Von 250 auf 700 sind 450 Punkte,
  // bei höchstens 3 je Takt also mindestens 150 Takte (rund anderthalb Tage bei 96 Takten/Tag).
  check('6: der Weg dauert wirklich lange', takte >= 150, { takte, tage: (takte / 96).toFixed(1) });
}

// ---- 7. Ein Einzelkonto kippt keine Schwelle -----------------------------------------------------
{
  const users = {};
  for (let i = 0; i < 10; i++) users['u' + i] = { lastSeen: jetzt - 1000 };   // 10 aktive Spieler
  const u = baueUmgebung({ strA: 6, strB: 1, datum: festeUhr, users });
  u.api.rkTick(u.galaxie);
  const e = frontVon(u, 'kartell').systeme.find(x => x.sys === 's5');
  for (let i = 0; i < 2000 && u.factions.schatten.systems.includes('s5'); i++) {
    // EIN Spieler trägt bei jedem Takt bei.
    e.beitragende['spielerA'] = { seite: 'kartell', ts: jetzt };
    e.puffer.a = 40;
    u.api.rkTick(u.galaxie);
  }
  check('7: ein Einzelkonto kippt die Schwelle nicht', u.factions.schatten.systems.includes('s5'),
    { kp: Math.round(e.kp) });
  check('7: es bleibt knapp darunter stehen', e.kp >= 690 && e.kp < 700, e.kp);

  // Mit drei verschiedenen Spielern auf der Gewinnerseite fällt sie.
  e.beitragende['spielerB'] = { seite: 'kartell', ts: jetzt };
  e.beitragende['spielerC'] = { seite: 'kartell', ts: jetzt };
  e.puffer.a = 40;
  u.api.rkTick(u.galaxie);
  check('7: mit drei Beitragenden fällt sie', !u.factions.schatten.systems.includes('s5'),
    { kp: Math.round(e.kp), beitragende: Object.keys(e.beitragende) });
}

// ---- 8. Ein Gegner kann die Front nicht durch einen Minimalbeitrag einfrieren --------------------
{
  const users = {};
  for (let i = 0; i < 10; i++) users['u' + i] = { lastSeen: jetzt - 1000 };
  const u = baueUmgebung({ strA: 6, strB: 1, datum: festeUhr, users });
  u.api.rkTick(u.galaxie);
  const e = frontVon(u, 'kartell').systeme.find(x => x.sys === 's5');
  for (let i = 0; i < 2000 && u.factions.schatten.systems.includes('s5'); i++) {
    // Drei auf der Gewinnerseite - und ein einzelner Störer auf der Gegenseite.
    e.beitragende['a1'] = { seite: 'kartell', ts: jetzt };
    e.beitragende['a2'] = { seite: 'kartell', ts: jetzt };
    e.beitragende['a3'] = { seite: 'kartell', ts: jetzt };
    e.beitragende['stoerer'] = { seite: 'schatten', ts: jetzt };
    e.puffer.a = 40;
    u.api.rkTick(u.galaxie);
  }
  check('8: ein einzelner Gegner friert die Front nicht ein', !u.factions.schatten.systems.includes('s5'),
    { kp: Math.round(e.kp) });
}

// ---- 9. Die Schranke skaliert mit der Beteiligung ------------------------------------------------
{
  // Nur EIN aktives Konto auf dem Server: dann darf ein einzelner Beitragender auch reichen,
  // sonst stünde die Front auf einem kleinen Server für immer still.
  const u = baueUmgebung({ strA: 6, strB: 1, datum: festeUhr, users: { einer: { lastSeen: jetzt - 1000 } } });
  u.api.rkTick(u.galaxie);
  const e = frontVon(u, 'kartell').systeme.find(x => x.sys === 's5');
  for (let i = 0; i < 2000 && u.factions.schatten.systems.includes('s5'); i++) {
    e.beitragende['einer'] = { seite: 'kartell', ts: jetzt };
    e.puffer.a = 40;
    u.api.rkTick(u.galaxie);
  }
  check('9: bei einem aktiven Spieler reicht einer', !u.factions.schatten.systems.includes('s5'),
    { kp: Math.round(e.kp) });
}

// ---- 10. Keine Fraktion verliert ihr letztes System ----------------------------------------------
{
  const u = baueUmgebung({
    strA: 6, strB: 1, datum: festeUhr,
    factions: {
      kartell:  { id:'kartell',  name:'Aschen-Kartell', systems:['s1','s2','s3','s4'], strength:6 },
      schatten: { id:'schatten', name:'Schattenbund',   systems:['s5'],                strength:1 },
      legion:   { id:'legion',   name:'Eisenlegion',    systems:[], strength:1 },
      void:     { id:'void',     name:'Void-Marodeure', systems:[], strength:1 }
    }
  });
  for (let i = 0; i < 1500; i++) u.api.rkTick(u.galaxie);
  check('10: keine Fraktion verliert ihr letztes System', u.factions.schatten.systems.length >= 1,
    u.factions.schatten.systems);
}

// ---- 11. Spieler-Systeme sind auch hier tabu -----------------------------------------------------
{
  const u = baueUmgebung({ datum: festeUhr, spielerHeimat: ['s4'], controlled: { s5: 'spieler1' } });
  u.api.rkTick(u.galaxie);
  const f = frontVon(u, 'kartell');
  check('11: weder Heimat- noch eroberte Systeme werden Front',
    f.systeme.every(e => e.sys !== 's4' && e.sys !== 's5'), f.systeme.map(e => e.sys));
}

// ---- 12. Ein System, das keine Grenze mehr ist, fällt aus der Front ------------------------------
{
  const u = baueUmgebung({ datum: festeUhr });
  u.api.rkTick(u.galaxie);
  check('12: s5 ist zunächst Front', frontVon(u, 'kartell').systeme.some(e => e.sys === 's5'));
  // Der Schattenbund zieht sich zurück - s5 gehört jetzt niemandem mehr.
  u.factions.schatten.systems = ['s6', 's7'];
  u.api.rkTick(u.galaxie);
  check('12: s5 ist danach keine Front mehr', !frontVon(u, 'kartell').systeme.some(e => e.sys === 's5'),
    frontVon(u, 'kartell').systeme.map(e => e.sys));
}

// ---- 13. Der Takt hängt wirklich im galaxyTick ----------------------------------------------------
check('13: rkTick läuft im Weltentakt', /\n  rkTick\(g\);/.test(src));
// ... und zwar NACH Expansion und Kriegsauflösung, sonst rechnet die Front auf einem überholten Stand.
{
  const iTick = src.indexOf('\n  rkTick(g);');
  const iKrieg = src.indexOf('resolveFactionWar(g);');
  const iExp = src.indexOf('NPC-Fraktionen: Territorium-Simulation');
  check('13: rkTick läuft nach Kriegsauflösung und Expansion',
    iTick > iKrieg && iTick > iExp, { iTick, iKrieg, iExp });
}

ende();
