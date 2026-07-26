// Botschaftsviertel v8.298.24 (Fraktions-Ausbau, Paket 6/6 - Abschluss).
//
// Ausgangslage: Raenge (P5), Laeden (P4), Rivalitaeten (P3) und Feindschaft (P2) erzwingen alle eine
// Wahl - aber es gab keinen Ort, an dem man diese Wahl FESTLEGT und dauerhaft davon lebt.
//
// Geprueft wird:
//   1) Plaetze: drei Schwellen, imperiumsweite Summe, hoechstens drei - eine Fraktion bleibt immer draussen
//   2) jede Fraktion hat genau eine Botschaftswirkung, und zwar dieselbe Groesse wie ihr Feindschafts-Malus
//   3) die Wirkung greift wirklich in den vier Multiplikatoren, in der RICHTIGEN Richtung
//   4) Botschaft = kein Ruf-Verfall (Klammer zu Paket 5/6), und die Kontaktuhr laeuft mit
//   5) Mindestrang 6: Malus und Bonus derselben Groesse duerfen nie gleichzeitig gelten
//   6) faellt der Ruf darunter, wird geraeumt - OHNE zweiten Ruf-Abzug
//   7) ueberzaehlige Botschaften nach Verlust von Botschaftsvierteln fallen weg
//   8) Wechselkosten: 12h-Sperre und -10 Ruf beim Schliessen (ueber changeFactionRep, damit die
//      Rivalitaeten mitgreifen)
//   9) Gebaeude, Anzeige, Hilfe, Erfolge, Speicherfelder
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const STD = 3600 * 1000;

// ---------------------------------------------------------------- Block ausführbar machen
// Von den Botschafts-Konstanten bis hinter punitiveDebrisMult: so liegen Botschaft UND die vier
// Feindschafts-Multiplikatoren im selben Block, und ihr Zusammenspiel ist echt gemessen statt gestubbt.
const von = src.indexOf('  const EMBASSY_SLOT_AT = [');
// Bis hinter raidChanceMult, weil das der Void-Hebel ist - so liegen alle VIER Hebel im Block.
const bis = src.indexOf('function raidChanceMult', von);
const endeBlock = src.indexOf('\n  }\n', bis) + 4;
check('Botschafts-Block gefunden', von > 0 && bis > von && endeBlock > bis);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
// Der Verfalls-Block aus Paket 5/6 steht in der Datei WEITER OBEN, wird hier aber mitgeladen: nur so
// ist echt gemessen, dass repDecayDueIn/applyReputationDecay die Botschaft wirklich beruecksichtigen
// (Funktionsdeklarationen werden gehoistet, die Reihenfolge der beiden Bloecke ist also egal).
const vonD = src.indexOf('  const REP_DECAY_PER_DAY =');
const bisD = src.indexOf('\n  }\n', src.indexOf('function processReputationDecay', vonD)) + 4;
check('Verfalls-Block gefunden', vonD > 0 && bisD > vonD);
const block = src.slice(vonD, bisD) + '\n' + src.slice(von, endeBlock);

function baue(opts){
  const o = opts || {};
  const ctx = {};
  const state = {
    factionRep: Object.assign({ kartell:80, legion:80, void:80, schatten:80 }, o.rep || {}),
    embassySeats: Object.assign({}, o.seats || {}),
    embassyOpenedAt: Object.assign({}, o.opened || {}),
    embassyLastContact: {},
    factionLastContact: Object.assign({}, o.kontakt || {}),
    embassiesOpened: 0,
    buildings: { botschaft: o.stufe === undefined ? 12 : o.stufe }
  };
  const meldungen = [];
  const repAenderungen = [];
  const jetzt = o.jetzt || 1000000000;
  const REP_MIN = -100, REP_MAX = 100;
  const factionRepOf = fid => Math.max(REP_MIN, Math.min(REP_MAX, state.factionRep[fid]||0));
  // Rang 1..8 aus dem Ruf - dieselben Schwellen wie REP_RANKS, hier bewusst als kleine eigene
  // Tabelle, damit dieser Test unabhaengig vom Rang-Block laeuft.
  const SCHWELLEN = [-100, -69, -29, -9, 15, 30, 50, 70];
  const factionRankOf = fid => {
    const r = factionRepOf(fid);
    let nr = 1;
    SCHWELLEN.forEach((m, i) => { if (r >= m) nr = i + 1; });
    return { nr, name: 'Rang'+nr };
  };
  // Aufzeichnend: das Schliessen MUSS hierueber laufen (Rivalitaeten), das Raeumen NICHT.
  const changeFactionRep = (fid, d) => { repAenderungen.push([fid, d]); state.factionRep[fid] = (state.factionRep[fid]||0) + d; };
  new Function('ctx', 'state', 'log', 'Date', 'FACTION_DIPLOMACY', 'REP_MIN', 'REP_MAX',
    'factionRepOf', 'factionRankOf', 'changeFactionRep', 'setFactionRepRaw', 'factionNameOf',
    'repTierOf', 'allBuildingSets', 'fmtDuration', 'playSound',
    'checkAchievements', 'render', 'save', 'factionEffectLevel', 'allianceTechFrac',
    'factionHostilityLevel', 'punitiveRaidChanceMult',
    block +
    ';ctx.SLOT_AT=EMBASSY_SLOT_AT;ctx.PER_LEVEL=EMBASSY_EFFECT_PER_LEVEL;ctx.CAP=EMBASSY_EFFECT_CAP;' +
    'ctx.CLOSE_LOSS=EMBASSY_CLOSE_REP_LOSS;ctx.LOCK=EMBASSY_LOCK_MS;ctx.MIN_RANK=EMBASSY_MIN_RANK;' +
    'ctx.EFFECTS=EMBASSY_EFFECTS;ctx.total=embassyTotalLevel;ctx.slots=embassySlotCount;' +
    'ctx.nextAt=embassyNextSlotAt;ctx.factions=embassyFactions;ctx.has=hasEmbassy;' +
    'ctx.pct=embassyEffectPct;ctx.mult=embassyMult;ctx.lockLeft=embassyLockLeft;' +
    'ctx.open=openEmbassy;ctx.close=closeEmbassy;ctx.enforce=enforceEmbassyRequirements;' +
    'ctx.route=hostileRouteMult;ctx.enc=hostileEncounterMult;ctx.loss=hostileRaidLossMult;' +
    'ctx.raid=raidChanceMult;ctx.dueIn=repDecayDueIn;ctx.decay=applyReputationDecay;' +
    'ctx.hos=factionHostilityLevel;'
  )(ctx, state, (t)=>meldungen.push(t), { now: () => jetzt }, { kartell:1, legion:1, void:1, schatten:1 },
    REP_MIN, REP_MAX, factionRepOf, factionRankOf, changeFactionRep,
    (fid, w) => { state.factionRep[fid] = Math.max(REP_MIN, Math.min(REP_MAX, Math.round(w))); },
    fid => fid,
    // repTierOf reicht hier reduziert: nur die Feindschaftsstufen werden abgefragt.
    rep => ({ key: rep <= -70 ? 'verfeindet' : (rep <= -30 ? 'feindlich' : (rep >= 70 ? 'verbuendet' : (rep >= 30 ? 'freundlich' : 'neutral'))) }),
    () => (o.gebaeude || [state.buildings]),
    (s) => Math.round(s)+'s', ()=>{}, ()=>{}, ()=>{}, ()=>{},
    // Effektstufe (0/1/2) und Allianzforschung - fuer raidChanceMult bzw. marketDiscountPctFor.
    fid => { const r = factionRepOf(fid); return r >= 70 ? 2 : (r >= 30 ? 1 : 0); },
    () => 0,
    // Feindschaftsstufe 0/1/2 und die Strafexpeditions-Chance: beide stehen in der Datei zwischen den
    // beiden geladenen Bloecken. Hier nachgebaut, damit die vier Hebel echt gerechnet werden.
    fid => { const r = factionRepOf(fid); return r <= -70 ? 2 : (r <= -30 ? 1 : 0); },
    () => 1);
  return { ctx, state, meldungen, repAenderungen, jetzt };
}

const u = baue();

// ---------------------------------------------------------------- 1: Plätze
check('1: es gibt drei Platz-Schwellen', u.ctx.SLOT_AT.length === 3, u.ctx.SLOT_AT);
check('1: die Schwellen sind aufsteigend', u.ctx.SLOT_AT.every((s,i) => i === 0 || s > u.ctx.SLOT_AT[i-1]), u.ctx.SLOT_AT);
check('1: es gibt weniger Plätze als Fraktionen – eine bleibt immer draußen',
  u.ctx.SLOT_AT.length < Object.keys(u.ctx.EFFECTS).length, [u.ctx.SLOT_AT.length, Object.keys(u.ctx.EFFECTS).length]);
for (const [stufe, erwartet] of [[0,0], [1,1], [5,1], [6,2], [11,2], [12,3], [99,3]]){
  const t = baue({ stufe });
  check('1: Gesamtstufe '+stufe+' ergibt '+erwartet+' Platz/Plätze', t.ctx.slots() === erwartet, t.ctx.slots());
}
// Imperiumsweite Summe: zwei Botschaftsviertel auf verschiedenen Planeten zaehlen zusammen.
{
  const t = baue({ gebaeude: [{ botschaft: 4 }, { botschaft: 3 }, { botschaft: 5 }] });
  check('1: die Stufen aller Planeten zählen zusammen', t.ctx.total() === 12 && t.ctx.slots() === 3, [t.ctx.total(), t.ctx.slots()]);
}
{
  const t = baue({ stufe: 5 });
  check('1: embassyNextSlotAt nennt die nächste Schwelle', t.ctx.nextAt() === 6, t.ctx.nextAt());
  check('1: beim dritten Platz ist embassyNextSlotAt null', baue({ stufe: 12 }).ctx.nextAt() === null);
}

// ---------------------------------------------------------------- 2: eine Wirkung je Fraktion
const fids = ['kartell','legion','void','schatten'];
check('2: genau die vier Diplomatie-Fraktionen haben eine Botschaftswirkung',
  fids.every(f => !!u.ctx.EFFECTS[f]) && Object.keys(u.ctx.EFFECTS).length === 4, Object.keys(u.ctx.EFFECTS));
for (const fid of fids){
  const e = u.ctx.EFFECTS[fid];
  check('2: '+fid+' hat eine Richtung und einen Text',
    (e.richtung === 'plus' || e.richtung === 'minus') && typeof e.text === 'function' && e.text(18).length >= 15, e.richtung);
}
check('2: alle vier Wirkungstexte sind verschieden',
  new Set(fids.map(f => u.ctx.EFFECTS[f].text(18))).size === 4);
// Wirkungshoehe: linear je Stufe, hart gedeckelt.
check('2: die Wirkung wächst je Gesamtstufe', baue({ stufe: 4 }).ctx.pct() > baue({ stufe: 2 }).ctx.pct());
check('2: die Wirkung ist bei '+u.ctx.CAP+' gedeckelt', baue({ stufe: 99 }).ctx.pct() === u.ctx.CAP, baue({ stufe: 99 }).ctx.pct());
check('2: bei Höchststufe 12 ist der Deckel genau erreicht',
  Math.abs(baue({ stufe: 12 }).ctx.pct() - u.ctx.CAP) < 1e-9, baue({ stufe: 12 }).ctx.pct());
// Der Deckel soll etwa auf Hoehe eines Feindschafts-Malus liegen (12-30%) - sonst waere die Botschaft
// entweder bedeutungslos oder wuerde die Feindschaft komplett aufheben.
check('2: der Deckel liegt in der Größenordnung eines Feindschafts-Malus (10–30%)',
  u.ctx.CAP >= 0.10 && u.ctx.CAP <= 0.30, u.ctx.CAP);

// ---------------------------------------------------------------- 3: die vier Hebel, richtige Richtung
{
  const ohne = baue({ stufe: 12 });
  const mit = baue({ stufe: 12, seats: { kartell:true, void:true, legion:true } });
  const p = mit.ctx.pct();
  check('3: Kartell-Botschaft hebt den Handelsrouten-Ertrag',
    Math.abs(mit.ctx.route() - ohne.ctx.route()*(1+p)) < 1e-9 && mit.ctx.route() > ohne.ctx.route(),
    [ohne.ctx.route(), mit.ctx.route()]);
  check('3: Legion-Botschaft senkt die Begegnungschance',
    Math.abs(mit.ctx.enc() - ohne.ctx.enc()*(1-p)) < 1e-9 && mit.ctx.enc() < ohne.ctx.enc(),
    [ohne.ctx.enc(), mit.ctx.enc()]);
  check('3: Void-Botschaft senkt die Überfall-Häufigkeit',
    Math.abs(mit.ctx.raid() - ohne.ctx.raid()*(1-p)) < 1e-9 && mit.ctx.raid() < ohne.ctx.raid(),
    [ohne.ctx.raid(), mit.ctx.raid()]);
  // Schatten ist NICHT besetzt - der vierte Hebel muss unberuehrt sein (drei Plaetze, vier Fraktionen).
  check('3: ohne Schatten-Botschaft bleibt der Überfall-Ressourcenverlust unverändert',
    mit.ctx.loss() === ohne.ctx.loss(), [ohne.ctx.loss(), mit.ctx.loss()]);
  const mitSchatten = baue({ stufe: 12, seats: { schatten:true } });
  check('3: Schatten-Botschaft senkt den Überfall-Ressourcenverlust',
    mitSchatten.ctx.loss() < ohne.ctx.loss(), [ohne.ctx.loss(), mitSchatten.ctx.loss()]);
  check('3: eine Botschaft wirkt nur bei IHRER Fraktion',
    mitSchatten.ctx.route() === ohne.ctx.route() && mitSchatten.ctx.enc() === ohne.ctx.enc());
  check('3: ohne Botschaftsviertel wirkt nichts',
    baue({ stufe: 0, seats: { kartell:true } }).ctx.route() === ohne.ctx.route());
}

// ---------------------------------------------------------------- 4: kein Ruf-Verfall (Klammer zu P5)
{
  const start = 1000000000;
  const t = baue({ stufe: 12, seats: { kartell:true }, kontakt: { kartell: start, legion: start },
                   jetzt: start + 40*24*STD });
  check('4: mit Botschaft meldet repDecayDueIn keinen Verfall', t.ctx.dueIn('kartell') === null, t.ctx.dueIn('kartell'));
  check('4: ohne Botschaft meldet es weiterhin einen', t.ctx.dueIn('legion') !== null);
  const vorher = t.state.factionRep.kartell;
  t.ctx.decay();
  check('4: nach 40 Tagen ohne Kontakt verliert die Botschafts-Fraktion nichts',
    t.state.factionRep.kartell === vorher, [vorher, t.state.factionRep.kartell]);
  check('4: die Fraktion ohne Botschaft verliert dagegen sehr wohl',
    t.state.factionRep.legion < 80, t.state.factionRep.legion);
  // Die Kontaktuhr muss MITLAUFEN, sonst wuerde nach dem Schliessen die ganze aufgelaufene Zeit
  // auf einmal abgerechnet - der Spieler haette schlagartig zweistellig Ruf verloren.
  check('4: die Kontaktuhr der Botschafts-Fraktion wird mitgezogen',
    t.state.factionLastContact.kartell === t.jetzt, [t.state.factionLastContact.kartell, t.jetzt]);
}

// ---------------------------------------------------------------- 5: Mindestrang, kein Doppelzustand
check('5: der Mindestrang ist 6 („Freundlich")', u.ctx.MIN_RANK === 6, u.ctx.MIN_RANK);
{
  // Unter Freundlich darf eine Botschaft NICHT eroeffnet werden.
  const t = baue({ stufe: 12, rep: { kartell: 20 } });
  t.ctx.open('kartell');
  check('5: unterhalb von Freundlich lässt sich keine Botschaft eröffnen',
    !t.ctx.has('kartell') && t.meldungen.some(m => /erst ab Rang 6/.test(m)), t.meldungen);
}
// Und selbst wenn im Spielstand ein Sitz stehen WUERDE, darf die Wirkung nicht greifen.
for (const rep of [-80, -40, -20, 0, 20]){
  const t = baue({ stufe: 12, rep: { kartell: rep }, seats: { kartell:true } });
  check('5: bei Ruf '+rep+' wirkt ein eingetragener Sitz nicht', !t.ctx.has('kartell') && t.ctx.mult('kartell') === 1);
}
// Der eigentliche Punkt: Malus und Bonus derselben Groesse nie gleichzeitig.
{
  const t = baue({ stufe: 12, rep: { kartell: -80 }, seats: { kartell:true } });
  check('5: verfeindet UND Botschaft ist unmöglich – der Malus bleibt allein',
    t.ctx.hos('kartell') === 2 && t.ctx.route() === 0.75, [t.ctx.hos('kartell'), t.ctx.route()]);
}

// ---------------------------------------------------------------- 6: Räumen ohne zweiten Ruf-Abzug
{
  const t = baue({ stufe: 12, rep: { kartell: 20 }, seats: { kartell:true } });
  const geraeumt = t.ctx.enforce();
  check('6: ein Sitz unter Freundlich wird geräumt', geraeumt && !t.state.embassySeats.kartell);
  check('6: das Räumen kostet KEINEN weiteren Ruf', t.repAenderungen.length === 0, t.repAenderungen);
  check('6: der Spieler erfährt davon', t.meldungen.some(m => /schließt deine Botschaft/.test(m)), t.meldungen);
}
{
  const t = baue({ stufe: 12, seats: { kartell:true } });
  check('6: ein gültiger Sitz wird NICHT geräumt', t.ctx.enforce() === false && t.state.embassySeats.kartell === true);
}

// ---------------------------------------------------------------- 7: überzählige Botschaften
{
  // Drei Sitze eingetragen, aber nur noch ein Platz (Botschaftsviertel abgerissen/Prestige).
  const t = baue({ stufe: 1, seats: { kartell:true, legion:true, void:true } });
  check('7: bei nur einem Platz wirkt nur eine Botschaft', t.ctx.factions().length === 1, t.ctx.factions());
  t.ctx.enforce();
  const uebrig = Object.keys(t.state.embassySeats).filter(k => t.state.embassySeats[k]);
  check('7: die überzähligen Sitze werden auch aus dem Spielstand entfernt', uebrig.length === 1, uebrig);
  check('7: auch das kostet keinen Ruf', t.repAenderungen.length === 0, t.repAenderungen);
}

// ---------------------------------------------------------------- 8: Wechselkosten
{
  const t = baue({ stufe: 1 });
  t.ctx.open('kartell');
  check('8: Eröffnen belegt den Platz', t.ctx.has('kartell') && t.state.embassiesOpened === 1);
  check('8: Eröffnen setzt die Kontaktuhr', t.state.factionLastContact.kartell === t.jetzt);
  check('8: eine frische Botschaft ist gesperrt', t.ctx.lockLeft('kartell') === t.ctx.LOCK, t.ctx.lockLeft('kartell'));
  t.ctx.close('kartell');
  check('8: innerhalb der Sperre lässt sie sich nicht schließen',
    t.ctx.has('kartell') && t.meldungen.some(m => /erst in/.test(m)));
  check('8: und es wurde kein Ruf abgezogen', t.repAenderungen.length === 0, t.repAenderungen);
}
{
  const start = 1000000000;
  const t = baue({ stufe: 1, seats: { kartell:true }, opened: { kartell: start }, jetzt: start + 13*STD });
  check('8: nach der Sperre ist sie frei', t.ctx.lockLeft('kartell') === 0);
  t.ctx.close('kartell');
  check('8: Schließen gibt den Platz frei', !t.ctx.has('kartell'));
  check('8: Schließen kostet '+u.ctx.CLOSE_LOSS+' Ruf',
    t.repAenderungen.length === 1 && t.repAenderungen[0][0] === 'kartell' && t.repAenderungen[0][1] === -u.ctx.CLOSE_LOSS,
    t.repAenderungen);
}
check('8: die Sperre ist 12 Stunden', u.ctx.LOCK === 12*STD, u.ctx.LOCK / STD);
check('8: der Ruf-Abzug ist 10', u.ctx.CLOSE_LOSS === 10, u.ctx.CLOSE_LOSS);
// Das Schliessen MUSS ueber changeFactionRep laufen, damit die Rivalitaeten (Paket 3/6) mitgreifen -
// ein Rueckzug ist eine echte Tat gegen die Fraktion, anders als der stille Ruf-Verfall.
{
  const cl = src.slice(src.indexOf('function closeEmbassy'), src.indexOf('\n  }', src.indexOf('function closeEmbassy')));
  check('8: Schließen läuft über changeFactionRep (Rivalitäten greifen mit)',
    /changeFactionRep\(fid, -EMBASSY_CLOSE_REP_LOSS\);/.test(cl));
  check('8: Schließen prüft die Sperre vor dem Löschen',
    cl.indexOf('embassyLockLeft') < cl.indexOf('delete state.embassySeats'));
}

// ---------------------------------------------------------------- 9: Gebäude, Anzeige, Doku, Speicher
{
  const def = src.slice(src.indexOf("key:'botschaft'"), src.indexOf("key:'botschaft'") + 1200);
  check('9: es gibt ein Botschaftsviertel-Gebäude', /name:'Botschaftsviertel'/.test(def));
  check('9: mit eigenem Icon', /icon:'ti-building-bank'/.test(def));
  check('9: die Höchststufe reicht für den dritten Platz allein', /maxLevel:12/.test(def));
  const m = def.match(/effectDesc:'([^']+)'/);
  check('9: mit vollständiger Beschreibung (mind. 120 Zeichen)', !!m && m[1].length >= 120, m && m[1].length);
  check('9: die Beschreibung nennt die drei Platz-Schwellen',
    !!m && /Stufe 1/.test(m[1]) && /ab 6/.test(m[1]) && /ab 12/.test(m[1]));
}
check('9: das Icon steht in der Font-Whitelist', /\.ti-building-bank:before/.test(src));
check('A: die Fraktionskarte hat eine Botschaftszeile', /\$\{botRow\}/.test(src));
check('A: es gibt eine Botschafts-Übersichtskarte',
  /const botschaftCard = \(\(\) =>/.test(src) && /mineCard \+ botschaftCard \+ feindCard/.test(src));
check('A: die Übersicht nennt belegte und vorhandene Plätze', /Botschaftsplätzen belegt/.test(src));
check('A: die Übersicht nennt die Fraktionen OHNE Botschaft', /Ohne Botschaft: \$\{ohne\.join/.test(src));
check('A: beide Knöpfe sind verdrahtet',
  /\[data-embassy-open\]/.test(src) && /openEmbassy\(btn\.getAttribute/.test(src) &&
  /\[data-embassy-close\]/.test(src) && /closeEmbassy\(btn\.getAttribute/.test(src));
check('A: mit Botschaft wird die Verfallszeile unterdrückt (keine zwei widersprüchlichen Zeilen)',
  /const verfallRow = \(dip && !botschaft &&/.test(src));
check('A: das Räumen hängt in der Fraktions-Hauswirtschaft', /enforceEmbassyRequirements\(\);/.test(src));
check('B: es gibt einen Hilfe-Abschnitt zur Botschaft',
  /title:'Botschaftsviertel: drei Plätze, vier Fraktionen'/.test(src));
{
  const h = src.slice(src.indexOf("title:'Botschaftsviertel: drei Plätze, vier Fraktionen'"));
  const hilfe = h.slice(0, h.indexOf("' },"));
  check('B: die Hilfe nennt die Knappheit ausdrücklich', /bleibt immer eine draußen/.test(hilfe));
  check('B: die Hilfe nennt alle vier Wirkungen',
    /Handelsrouten/.test(hilfe) && /Überfall-Häufigkeit/.test(hilfe) && /Begegnungschance/.test(hilfe) && /Ressourcenverlust/.test(hilfe));
  check('B: die Hilfe nennt den Mindestrang', /Rang 6/.test(hilfe));
  check('B: die Hilfe nennt die Wechselkosten', /12 Stunden/.test(hilfe) && /−10 Ruf/.test(hilfe));
  check('B: die Hilfe nennt die Kopplung an den Ruf-Verfall', /verfällt gar nicht mehr/.test(hilfe));
}
check('C: es gibt zwei neue Botschafts-Erfolge', /key:'botschaft1'/.test(src) && /key:'botschaft3'/.test(src));
check('C: beide mit Icon und Kategorie',
  /botschaft1:'ti-building-bank'/.test(src) && /botschaft3:'ti-building-bank'/.test(src) &&
  /botschaft1:'handel'/.test(src) && /botschaft3:'handel'/.test(src));
// Speicherfelder: alle drei Default-Stellen (Literal + zwei Migrationen), sonst kippen Altstaende.
for (const feld of ['embassySeats', 'embassyOpenedAt']){
  const n = (src.match(new RegExp('state\\.'+feld+' = \\{\\}', 'g'))||[]).length;
  check('D: '+feld+' wird an beiden Migrationsstellen abgesichert', n === 2, n);
  check('D: '+feld+' steht in den Literal-Defaults', new RegExp('\\n    '+feld+': \\{\\},').test(src));
}
check('D: embassiesOpened wird abgesichert',
  (src.match(/state\.embassiesOpened === undefined/g)||[]).length === 2);
check('D: Prestige/Neustart räumt die Botschaften mit ab',
  (src.match(/embassySeats:\{\}, embassyOpenedAt:\{\}/g)||[]).length === 2);

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
