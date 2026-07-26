// Acht Raenge je Fraktion + Ruf-Verfall v8.298.23 (Fraktions-Ausbau, Paket 5/6).
//
// Ausgangslage: Es gab fuenf Rufstufen, drei davon 40-60 Punkte breit. Zwischen Ruf 0 und 29 aenderte
// sich 29 Punkte lang gar nichts - weder Anzeige noch Mechanik. Und Ruf war ein Sperrklinken-Rad:
// einmal auf 100, fuer immer auf 100, also war das ganze System nach wenigen Tagen abgeschlossen.
//
// Geprueft wird:
//   1) es sind genau acht Raenge, aufsteigend, mit den VIER ALTEN Schwellen exakt an alter Stelle
//      (-70 / -30 / 30 / 70 - Backend-Paritaet bei 30/70, Feindschaftsstufen bei -30/-70)
//   2) jede der vier Fraktionen hat acht eigene Rangnamen, alle verschieden
//   3) jeder Rang hat eine eigene Wirkung (kein Rang ist ein reines Etikett)
//   4) Ruf-Verfall: Schonfrist gilt, danach genau REP_DECAY_PER_DAY je Tag, Deckel bei 0
//   5) GROLL zerfaellt NICHT - negativer Ruf bleibt liegen, sonst waere der Feindschafts-Malus
//      aus Paket 2/6 blosses Aussitzen
//   6) der Verfall geht NICHT ueber changeFactionRep - der Rivale darf davon nichts gewinnen
//   7) Kontakt setzt die Uhr zurueck
//   8) Rang-Verguenstigungen: Tribut-Aufschlag unten, laengere Auftraege ab Rang 5,
//      Zusatzmarke ab Rang 7, doppelte Gold-Chance ab Rang 8
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const TAG = 24 * 3600 * 1000;

// ---------------------------------------------------------------- Block ausführbar machen
const von = src.indexOf('const REP_RANKS = [');
const bis = src.indexOf('// ===== Fraktions-Rivalitäten', von);
check('Rang-Block gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const block = src.slice(von, bis);

// Der Block braucht ein paar Nachbarn, die weiter oben in der Datei stehen: factionRepOf,
// setFactionRepRaw, FACTION_DIPLOMACY, TRIBUTE_COST. Die werden als Parameter hereingereicht,
// damit der Test nicht die halbe Spieldatei mitschleppen muss.
function baue(rep, kontakt, jetzt){
  const ctx = {};
  const state = {
    factionRep: Object.assign({ kartell:0, legion:0, void:0, schatten:0 }, rep || {}),
    factionLastContact: Object.assign({}, kontakt || {})
  };
  const meldungen = [];
  const rivalGesetzt = [];
  const REP_MIN = -100, REP_MAX = 100;
  const factionRepOf = fid => Math.max(REP_MIN, Math.min(REP_MAX, state.factionRep[fid]||0));
  // Aufzeichnende Attrappe: schlaegt an, falls der Verfall je ueber changeFactionRep liefe
  // (dann wuerde das Ueberschwappen auf den Rivalen mit ausgeloest - Pruefpunkt 6).
  const setFactionRepRaw = (fid, w) => { rivalGesetzt.push(fid); state.factionRep[fid] = Math.max(REP_MIN, Math.min(REP_MAX, Math.round(w))); };
  const changeFactionRep = () => { throw new Error('changeFactionRep darf im Verfall nicht aufgerufen werden'); };
  new Function('ctx', 'state', 'log', 'Date', 'REP_MIN', 'REP_MAX', 'FACTION_DIPLOMACY',
    'factionRepOf', 'setFactionRepRaw', 'changeFactionRep', 'factionNameOf', 'TRIBUTE_COST',
    // Ab v8.298.24 setzt eine Botschaft den Verfall aus (Paket 6/6). Hier auf "keine Botschaft"
    // gestellt, damit dieser Test weiter den reinen Verfall misst; die Kopplung prueft test_botschaft.js.
    'hasEmbassy',
    block +
    ';ctx.RANKS=REP_RANKS;ctx.NAMEN=FACTION_RANK_NAMES;ctx.PERKS=RANK_PERKS;' +
    'ctx.tier=repTierOf;ctx.rang=factionRankOf;ctx.next=nextRankAt;ctx.idx=repRankIndex;' +
    'ctx.tribut=tributeCostFor;ctx.SURCHARGE=RANK_TRIBUTE_SURCHARGE;' +
    'ctx.QUEST_FROM=RANK_QUEST_TIME_FROM;ctx.QUEST_BONUS=RANK_QUEST_TIME_BONUS;' +
    'ctx.FAVOR_FROM=RANK_FAVOR_BONUS_FROM;ctx.GOLD_FROM=RANK_GOLD_CHANCE_FROM;' +
    'ctx.PER_DAY=REP_DECAY_PER_DAY;ctx.GRACE=REP_DECAY_GRACE_MS;ctx.INTERVAL=REP_DECAY_INTERVAL_MS;' +
    'ctx.decay=applyReputationDecay;ctx.touch=touchFactionContact;ctx.dueIn=repDecayDueIn;'
  )(ctx, state, (t)=>meldungen.push(t), { now: () => jetzt || 0 }, REP_MIN, REP_MAX,
    { kartell:1, legion:1, void:1, schatten:1 },
    factionRepOf, setFactionRepRaw, changeFactionRep, fid => fid, 400, () => false);
  return { ctx, state, meldungen, rivalGesetzt };
}

const u = baue();

// ---------------------------------------------------------------- 1: acht Raenge, alte Schwellen
check('1: es sind genau acht Ränge', u.ctx.RANKS.length === 8, u.ctx.RANKS.length);
const mins = u.ctx.RANKS.map(r => r.min);
check('1: Schwellen sind streng aufsteigend', mins.every((m,i) => i === 0 || m > mins[i-1]), mins);
// Die vier ALTEN Schwellen muessen exakt dort liegen, wo sie lagen. 30/70 spiegelt das Backend
// (marketDiscountPctFor), -30/-70 sind die Feindschaftsstufen aus Paket 2/6.
const grenze = (rep, key) => check('1: Ruf '+rep+' ist "'+key+'"', u.ctx.tier(rep).key === key, u.ctx.tier(rep).key);
grenze(-100, 'verfeindet'); grenze(-70, 'verfeindet'); grenze(-69, 'feindlich');
grenze(-30, 'feindlich');   grenze(-29, 'misstrauisch');
grenze(29, 'bekannt');      grenze(30, 'freundlich');
grenze(69, 'geachtet');     grenze(70, 'verbuendet');  grenze(100, 'verbuendet');
// Und die alte Fuenf-Stufen-Einteilung muss als Gruppierung erhalten bleiben: alles, was frueher
// "Freundlich" hiess (30-69), darf heute nicht unter die Buendnis-Schwelle rutschen und umgekehrt.
check('1: Effektstufe 2 beginnt weiterhin exakt bei 70',
  u.ctx.idx(69) < 7 && u.ctx.idx(70) === 7, [u.ctx.idx(69), u.ctx.idx(70)]);
check('1: Effektstufe 1 beginnt weiterhin exakt bei 30',
  u.ctx.idx(29) < 5 && u.ctx.idx(30) === 5, [u.ctx.idx(29), u.ctx.idx(30)]);

// ---------------------------------------------------------------- 2: eigene Rangnamen je Fraktion
const fids = ['kartell','legion','void','schatten'];
for (const fid of fids){
  const namen = u.ctx.NAMEN[fid];
  check('2: '+fid+' hat acht eigene Rangnamen', Array.isArray(namen) && namen.length === 8, namen && namen.length);
  check('2: '+fid+' – alle acht Namen verschieden', namen && new Set(namen).size === 8);
  check('2: '+fid+' – kein Name ist bloß die Stufenbezeichnung',
    namen && namen.every((n,i) => n !== u.ctx.RANKS[i].label));
}
const alle = fids.flatMap(f => u.ctx.NAMEN[f]);
check('2: keine zwei Fraktionen teilen sich einen Rangnamen', new Set(alle).size === 32, new Set(alle).size);
// factionRankOf liefert Nummer UND Fraktionsnamen
{
  const t = baue({ kartell: 55 });
  const r = t.ctx.rang('kartell');
  check('2: factionRankOf liefert Rang 7 mit Kartell-Namen',
    r.nr === 7 && r.name === u.ctx.NAMEN.kartell[6], [r.nr, r.name]);
  check('2: nextRankAt zeigt auf die nächste Schwelle', t.ctx.next(55) === 70, t.ctx.next(55));
  check('2: nextRankAt ist beim höchsten Rang null', t.ctx.next(100) === null, t.ctx.next(100));
}

// ---------------------------------------------------------------- 3: kein Rang ohne Wirkung
for (const r of u.ctx.RANKS){
  const txt = u.ctx.PERKS[r.key];
  check('3: Rang "'+r.key+'" hat einen Wirkungstext', typeof txt === 'string' && txt.length >= 20, txt);
}
check('3: alle acht Wirkungstexte sind verschieden',
  new Set(Object.values(u.ctx.PERKS)).size === 8, new Set(Object.values(u.ctx.PERKS)).size);

// ---------------------------------------------------------------- 4: Verfall
// Die drei Balance-Zahlen werden als LITERALE festgenagelt und nicht aus der Datei gelesen. Sonst
// passt sich der Test still an, wenn jemand die Schonfrist oder den Satz aendert - und genau diese
// Zahlen stehen wortwoertlich in der Hilfe und in den Patchnotes.
check('4: der Verfallssatz ist 3 Ruf', u.ctx.PER_DAY === 3, u.ctx.PER_DAY);
check('4: die Schonfrist sind 3 Tage', u.ctx.GRACE === 3*TAG, u.ctx.GRACE / TAG);
check('4: der Verfall greift im Tagestakt', u.ctx.INTERVAL === TAG, u.ctx.INTERVAL / TAG);
// Schonfrist: kurz davor darf nichts passieren.
{
  const start = 1000000000;
  const t = baue({ kartell: 60 }, { kartell: start }, start + u.ctx.GRACE + u.ctx.INTERVAL - 1);
  const weg = t.ctx.decay();
  check('4: innerhalb der Schonfrist verfällt nichts', weg === 0 && t.state.factionRep.kartell === 60,
    [weg, t.state.factionRep.kartell]);
  check('4: repDecayDueIn zeigt die Restzeit an', t.ctx.dueIn('kartell') === 1, t.ctx.dueIn('kartell'));
}
// Genau ein Tag nach der Schonfrist: genau ein Abbau.
{
  const start = 1000000000;
  const t = baue({ kartell: 60 }, { kartell: start }, start + u.ctx.GRACE + u.ctx.INTERVAL);
  const weg = t.ctx.decay();
  check('4: ein Tag nach der Schonfrist genau '+u.ctx.PER_DAY+' Ruf weg',
    weg === u.ctx.PER_DAY && t.state.factionRep.kartell === 60 - u.ctx.PER_DAY, [weg, t.state.factionRep.kartell]);
  check('4: der Spieler wird darüber informiert', t.meldungen.some(m => /vermisst deinen Kontakt/.test(m)), t.meldungen);
}
// Lange Abwesenheit: linear, ein Abbau je Tag nach der Schonfrist.
{
  const start = 1000000000;
  const tage = 10;
  const t = baue({ kartell: 100 }, { kartell: start }, start + u.ctx.GRACE + tage*TAG);
  const weg = t.ctx.decay();
  check('4: nach '+tage+' Tagen ohne Kontakt genau '+(tage*u.ctx.PER_DAY)+' Ruf weg',
    weg === tage * u.ctx.PER_DAY, weg);
}
// Deckel bei 0: der Verfall darf NICHT in die Feindschaft hineinlaufen.
{
  const start = 1000000000;
  const t = baue({ kartell: 4 }, { kartell: start }, start + u.ctx.GRACE + 100*TAG);
  const weg = t.ctx.decay();
  check('4: der Verfall stoppt bei 0 und läuft nicht ins Negative',
    t.state.factionRep.kartell === 0 && weg === 4, [t.state.factionRep.kartell, weg]);
}
// Ohne Zeitstempel (Altstand) startet die Uhr, ohne rueckwirkend zu bestrafen.
{
  const jetzt = 1000000000;
  const t = baue({ kartell: 80 }, {}, jetzt);
  const weg = t.ctx.decay();
  check('4: Altstände ohne Zeitstempel verlieren nichts, die Uhr startet jetzt',
    weg === 0 && t.state.factionRep.kartell === 80 && t.state.factionLastContact.kartell === jetzt,
    [weg, t.state.factionLastContact.kartell]);
}

// ---------------------------------------------------------------- 5: Groll bleibt liegen
{
  const start = 1000000000;
  const t = baue({ kartell: -80, legion: -35 }, { kartell: start, legion: start }, start + u.ctx.GRACE + 60*TAG);
  const weg = t.ctx.decay();
  check('5: negativer Ruf zerfällt NICHT von selbst',
    weg === 0 && t.state.factionRep.kartell === -80 && t.state.factionRep.legion === -35,
    [weg, t.state.factionRep.kartell, t.state.factionRep.legion]);
  check('5: Verfeindet bleibt nach 60 Tagen Aussitzen verfeindet',
    t.ctx.tier(t.state.factionRep.kartell).key === 'verfeindet');
  check('5: repDecayDueIn meldet für negativen Ruf nichts', t.ctx.dueIn('kartell') === null, t.ctx.dueIn('kartell'));
}

// ---------------------------------------------------------------- 6: Verfall geht am Rivalen vorbei
// Konstruktionsprobe: changeFactionRep wirft im Test. Liefe der Verfall darueber, waere der Rivale
// mitbetroffen (applyRivalSpill haengt daran) - der Verlust wuerde dem Gegenspieler Ruf schenken.
{
  const start = 1000000000;
  const t = baue({ kartell: 50, schatten: 50 }, { kartell: start, schatten: start }, start + u.ctx.GRACE + TAG);
  let geworfen = null;
  try { t.ctx.decay(); } catch(e){ geworfen = e.message; }
  check('6: der Verfall ruft changeFactionRep nicht auf', geworfen === null, geworfen);
  check('6: der Rivale gewinnt durch den Verfall nichts',
    t.state.factionRep.schatten === 50 - u.ctx.PER_DAY, t.state.factionRep.schatten);
}

// ---------------------------------------------------------------- 7: Kontakt setzt die Uhr zurück
{
  const start = 1000000000;
  const jetzt = start + u.ctx.GRACE + 5*TAG;
  const t = baue({ kartell: 60 }, { kartell: start }, jetzt);
  t.ctx.touch('kartell');
  const weg = t.ctx.decay();
  check('7: nach Kontakt verfällt nichts mehr', weg === 0 && t.state.factionRep.kartell === 60, [weg, t.state.factionRep.kartell]);
  check('7: die Kontaktuhr steht auf jetzt', t.state.factionLastContact.kartell === jetzt);
}
// Die Kontaktquellen muessen im Spielcode auch wirklich verdrahtet sein.
for (const [wo, name] of [
  ['completeFactionQuest', 'Auftrag abschließen'],
  ['buyFactionShopItem',   'Einkauf im Fraktionsladen'],
  ['claimFactionGift',     'Belohnung abholen'],
  ['changeFactionRep',     'jeder Ruf-Zuwachs']
]){
  const start = src.indexOf('function '+wo);
  const ende = src.indexOf('\n  }', start);
  check('7: '+name+' setzt die Kontaktuhr', start > 0 && /touchFactionContact\(/.test(src.slice(start, ende)), wo);
}
// Der Verfall muss im Haupt-Tick haengen, sonst laeuft er nie.
check('7: der Verfall hängt im Haupt-Tick', /const rufVerfallen = processReputationDecay\(\);/.test(src));
check('7: ein Verfall löst ein Speichern aus', /\|\| rufVerfallen\) save\(\);/.test(src));

// ---------------------------------------------------------------- 8: Rang-Vergünstigungen
// Tribut-Aufschlag: je tiefer der Rang, desto teurer der Weg zurueck.
{
  const preise = {};
  for (const [rep, key] of [[-80,'verfeindet'], [-50,'feindlich'], [-20,'misstrauisch'], [0,'neutral'], [50,'geachtet']]){
    const t = baue({ kartell: rep });
    preise[key] = t.ctx.tribut('kartell');
  }
  check('8: Tribut ab Neutral kostet den Normalpreis', preise.neutral === 400 && preise.geachtet === 400, preise);
  check('8: Misstrauisch < Feindlich < Verfeindet beim Tributpreis',
    preise.misstrauisch > preise.neutral && preise.feindlich > preise.misstrauisch && preise.verfeindet > preise.feindlich,
    preise);
}
// Laufzeit, Zusatzmarke und Gold-Chance sind an Rangnummern gebunden - die Schwellen muessen
// zu den Wirkungstexten passen, sonst verspricht die Hilfe etwas anderes als der Code tut.
check('8: die Laufzeit-Vergünstigung hängt an Rang 5 (Bekannt)',
  u.ctx.QUEST_FROM === 5 && u.ctx.RANKS[4].key === 'bekannt', [u.ctx.QUEST_FROM, u.ctx.RANKS[4].key]);
check('8: die Zusatzmarke hängt an Rang 7 (Geachtet)',
  u.ctx.FAVOR_FROM === 7 && u.ctx.RANKS[6].key === 'geachtet', [u.ctx.FAVOR_FROM, u.ctx.RANKS[6].key]);
check('8: die Gold-Chance hängt an Rang 8 (Verbündet)',
  u.ctx.GOLD_FROM === 8 && u.ctx.RANKS[7].key === 'verbuendet', [u.ctx.GOLD_FROM, u.ctx.RANKS[7].key]);

// Und die drei Vergünstigungen müssen in generateFactionQuest / completeFactionQuest angewandt sein.
{
  const gen = src.slice(src.indexOf('function generateFactionQuest'), src.indexOf('function ensureFactionQuests'));
  check('8: generateFactionQuest senkt die Gold-Schwelle ab Rang '+u.ctx.GOLD_FROM,
    /rangNr >= RANK_GOLD_CHANCE_FROM \? 0\.74 : 0\.87/.test(gen));
  check('8: generateFactionQuest verlängert die Laufzeit ab Rang '+u.ctx.QUEST_FROM,
    /rangNr >= RANK_QUEST_TIME_FROM \? 1 \+ RANK_QUEST_TIME_BONUS : 1/.test(gen) && /expiresAt: Date\.now\(\) \+ laufzeit/.test(gen));
  check('8: die Gold-Schwelle 0.74 ist wirklich die doppelte Chance von 0.87',
    Math.abs((1-0.74) - 2*(1-0.87)) < 1e-9);
  const comp = src.slice(src.indexOf('function completeFactionQuest'), src.indexOf('// ===== Fraktions-Diplomatie'));
  check('8: completeFactionQuest legt ab Rang '+u.ctx.FAVOR_FROM+' eine Marke drauf',
    /rangNr >= RANK_FAVOR_BONUS_FROM \? 1 : 0/.test(comp) && /\(FAVOR_PER_TIER\[q\.tier\] \|\| 1\) \+ rangBonus/.test(comp));
  check('8: der Rang wird VOR der Ruf-Belohnung festgehalten',
    comp.indexOf('const rangNr = factionRankOf(fid).nr;') < comp.indexOf('changeFactionRep(fid, q.rewardRep)'));
  check('8: der Rangbonus steht in der Abschlussmeldung', /Rangbonus/.test(comp));
  const trib = src.slice(src.indexOf('function payTribute'), src.indexOf('// Greift ein NPC-Fraktionssystem'));
  check('8: payTribute rechnet mit tributeCostFor', /const kosten = tributeCostFor\(fid\);/.test(trib) && /state\.credits -= kosten;/.test(trib));
  check('8: payTribute prüft auch gegen den erhöhten Preis', /< kosten\)/.test(trib));
}

// ---------------------------------------------------------------- Anzeige- und Doku-Stellen
// CLAUDE.md Regel 6: nach einer Mechanik-Aenderung ALLE Anzeigestellen derselben Groesse pruefen.
check('A: die Fraktionskarte zeigt den Rang', /Rang \$\{rang\.nr\}\/8:/.test(src));
check('A: die Fraktionskarte zeigt den Weg zum nächsten Rang', /Nächster Rang <strong>/.test(src));
check('A: die Fraktionskarte warnt vor dem Verfall', /Vernachlässigt:<\/strong> −\$\{REP_DECAY_PER_DAY\}/.test(src));
check('A: rangRow und verfallRow sind in die Karte eingehängt',
  /\$\{rangRow\}/.test(src) && /\$\{verfallRow\}/.test(src));
check('A: der Tribut-Knopf zeigt den rangabhängigen Preis', /fmt\(tributeKosten\)\+' Kr\./.test(src));
check('B: es gibt einen Hilfe-Abschnitt zu Rängen und Verfall',
  /title:'Die acht Ränge und der Ruf-Verfall'/.test(src));
{
  const h = src.slice(src.indexOf("title:'Die acht Ränge und der Ruf-Verfall'"));
  const hilfe = h.slice(0, h.indexOf("' },"));
  for (const wort of ['Syndikatspartner','Schwertträger','Stimme im Riss','Teil des Netzes'])
    check('B: der Hilfe-Abschnitt nennt den Spitzenrang "'+wort+'"', hilfe.includes(wort));
  check('B: der Hilfe-Abschnitt nennt den Verfallssatz', /<strong>3 pro Tag<\/strong>/.test(hilfe));
  check('B: der Hilfe-Abschnitt erklärt, dass Groll nicht verfällt', /Groll verfällt bewusst nicht/.test(hilfe));
}
check('B: der Abschnitt "Diplomatie & Ruf" verweist auf den teureren Tribut unter Neutral',
  /unter Neutral wird der Tribut teurer/.test(src));
check('C: es gibt zwei neue Rang-Erfolge',
  /key:'rangfuenf'/.test(src) && /key:'ranggeachtet'/.test(src));
check('C: beide Rang-Erfolge haben ein Icon', /rangfuenf:'ti-[a-z0-9-]+'/.test(src) && /ranggeachtet:'ti-[a-z0-9-]+'/.test(src));
check('C: beide Rang-Erfolge sind einer Kategorie zugeordnet',
  /rangfuenf:'handel'/.test(src) && /ranggeachtet:'handel'/.test(src));

// ---------------------------------------------------------------- Backend-Parität
// Der Server kennt die Schwellen 30/70 (marketDiscountPctFor). Die acht Raenge sind eine reine
// Client-Verfeinerung - keine der neuen Schwellen darf dazwischen etwas verschieben.
check('D: der Kartell-Marktrabatt hängt weiterhin an factionEffectLevel, nicht am Rang', (() => {
  const i = src.indexOf("const lvl = factionEffectLevel('kartell');");
  return i > 0 && !/factionRankOf/.test(src.slice(i, i + 400));
})());
check('D: factionEffectLevel prüft weiterhin nur verbuendet/freundlich', (() => {
  const i = src.indexOf('function factionEffectLevel');
  const body = src.slice(i, src.indexOf('\n  }', i));
  return /verbuendet/.test(body) && /freundlich/.test(body) && !/geachtet|bekannt/.test(body);
})());
check('D: REP_ALLY_THRESHOLD steht weiterhin auf 70', /const REP_ALLY_THRESHOLD = 70;/.test(src));

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
