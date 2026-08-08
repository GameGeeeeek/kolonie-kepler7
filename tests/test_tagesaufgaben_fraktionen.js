// Fraktions-Tagesaufgaben v8.298.25.
//
// Ausgangslage: Der Fraktions-Ausbau hat sechs Systeme gebracht (Auftragspools, Feindschaft,
// Rivalitaeten, Gunstmarken/Laeden, acht Raenge + Ruf-Verfall, Botschaftsviertel) - der
// Tagesaufgaben-Pool kannte davon KEIN EINZIGES. Er stammte noch aus der Zeit davor.
//
// Geprueft wird:
//   1) es sind vier neue Vorlagen, alle mit Icon, Ziel, Belohnung und eindeutigem Schluessel
//   2) die Belohnungen liegen in derselben Groessenordnung wie die 16 bestehenden
//   3) available-Praedikate: keine der vier darf strukturell unerfuellbar in den Pool kommen
//   4) Fortschrittsmessung ueber vorhandene Lebenszeit-Zaehler (kein neuer Hook je Aktion)
//   5) 'repcare' zaehlt ueber den EINEN Kontakt-Trichter - und Botschaften zaehlen NICHT mit
//   6) 'rank' misst die Rang-SUMME, damit jeder Aufstieg zaehlt
//   7) Tagesbeginn-Marken werden gesetzt UND fuer Altstaende nachgetragen (sonst waeren drei
//      Aufgaben beim Aktualisieren mitten am Tag sofort erledigt)
//   8) die Hilfe nennt die vier neuen Vorlagen (CLAUDE.md Regel 6 - sie listet alle namentlich)
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const NEU = ['shopbuy', 'warsupport', 'rank', 'repcare'];

// ---------------------------------------------------------------- Block ausführbar machen
const von = src.indexOf('  const DAILY_QUEST_DEFS = [');
const bis = src.indexOf('  const DAILY_QUEST_ACTIVE_COUNT', von);
check('Vorlagen-Block gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const defsBlock = src.slice(von, bis);

// Und die Fortschrittsfunktion separat - sie steht weiter unten in der Datei.
const vonP = src.indexOf('  function dailyQuestProgress(key){');
const bisP = src.indexOf('\n  }\n', vonP) + 4;
check('Fortschritts-Block gefunden', vonP > 0 && bisP > vonP);
const progBlock = src.slice(vonP, bisP);

function baue(opts){
  const o = opts || {};
  const ctx = {};
  const state = {
    factionRep: Object.assign({ kartell:0, legion:0, void:0, schatten:0 }, o.rep || {}),
    factionShopPurchases: o.shopKaeufe || 0,
    warSidesTaken: o.parteinahmen || 0,
    shopPurchases: 0, battlePoints: 0, expeditionsCompleted: 0, npcKills: 0,
    discovered: {}, skillTree: {}, expeditionCodex: {},
    dailyQuests: o.dq === null ? null : Object.assign({
      startFactionShopPurchases: 0, startWarSidesTaken: 0, startRankSum: 4, contactedFactions: {}
    }, o.dq || {})
  };
  const galaxyCache = { factions: {
    kartell:{id:'kartell',name:'Aschen-Kartell'}, legion:{id:'legion',name:'Eisenlegion'},
    void:{id:'void',name:'Void-Marodeure'}, schatten:{id:'schatten',name:'Schattenbund'}
  }, activeWar: o.krieg === undefined ? null : o.krieg };
  const SCHWELLEN = [-100, -69, -29, -9, 15, 30, 50, 70];
  const factionRankOf = fid => {
    const r = state.factionRep[fid]||0;
    let nr = 1;
    SCHWELLEN.forEach((m, i) => { if (r >= m) nr = i + 1; });
    return { nr };
  };
  const factionRankSum = () => ['kartell','legion','void','schatten'].reduce((a,f)=>a+factionRankOf(f).nr, 0);
  new Function('ctx', 'state', 'galaxyCache', 'FACTION_DIPLOMACY', 'REP_RANKS',
    'factionEffectLevel', 'factionRankOf', 'factionRankSum', 'warSupportedSide', 'warFactionIdByName',
    'SKILL_TREE', 'TIER2_DEFS', 'tier2TotalLevel', 'skillPointsSpent',
    defsBlock + progBlock + ';ctx.DEFS=DAILY_QUEST_DEFS;ctx.progress=dailyQuestProgress;'
  )(ctx, state, galaxyCache, { kartell:1, legion:1, void:1, schatten:1 },
    [1,2,3,4,5,6,7,8],
    fid => { const r = state.factionRep[fid]||0; return r >= 70 ? 2 : (r >= 30 ? 1 : 0); },
    factionRankOf, factionRankSum,
    () => o.schonGewaehlt || null,
    name => (Object.values(galaxyCache.factions).find(f => f.name === name)||{}).id || null,
    [], [], () => 0, () => 0);
  return { ctx, state };
}

const u = baue();
const defOf = k => u.ctx.DEFS.find(d => d.key === k);

// ---------------------------------------------------------------- 1: vier neue Vorlagen
// 23 seit v8.454.0 (Modul-Werkbank kam dazu; 22 seit v8.342.0 mit den zwei Abgrund-Aufgaben).
// Die Zahl steht hier bewusst als feste Groesse und nicht als "mindestens 20": Sie wird an ZWEI
// weiteren Stellen dem Spieler genannt (Tutorial-Schritt, Hilfe-Abschnitt "Tagesaufgaben"), und
// genau die vergisst man beim Erweitern. Deshalb werden beide hier gleich mitgeprueft - ein
// neuer Eintrag im Pool muss diesen Test rot machen, sonst laeuft die Zahl im Text still davon.
// (Genau so geschehen bei v8.454.0: dieser Test schlug an, bis Tutorial und Hilfe 23 nannten.)
check('1: der Pool hat 23 Vorlagen', u.ctx.DEFS.length === 23, u.ctx.DEFS.length);
{
  const fs2 = require('fs');
  const { SPIELDATEI: DATEI } = require('./lib/umgebung');
  const roh = fs2.readFileSync(DATEI, 'utf8');
  const stellen = [...roh.matchAll(/aus (\d+) Vorlagen gezogen/g), ...roh.matchAll(/damit (\d+) Vorlagen/g)]
    .map(m => Number(m[1]));
  check('1: Tutorial UND Hilfe nennen dieselbe Poolgroesse',
    stellen.length === 2 && stellen.every(n => n === u.ctx.DEFS.length), stellen);
}
check('1: alle Schlüssel sind eindeutig', new Set(u.ctx.DEFS.map(d=>d.key)).size === u.ctx.DEFS.length);
for (const k of NEU){
  const d = defOf(k);
  check('1: Vorlage "'+k+'" existiert', !!d);
  if (!d) continue;
  check('1: '+k+' hat einen aussagekräftigen Namen', typeof d.name === 'string' && d.name.length >= 15, d.name);
  check('1: '+k+' hat ein ti-Icon', /^ti-[a-z0-9-]+$/.test(d.icon||''), d.icon);
  check('1: '+k+' hat ein Ziel >= 1', d.target >= 1, d.target);
  check('1: '+k+' hat eine Belohnung', d.reward && Object.keys(d.reward).length >= 1, d.reward);
  check('1: '+k+' hat ein Sprungziel', !!(d.nav && d.nav.tab), d.nav);
}
// Alle vier Icons muessen in der Font-Whitelist stehen (check-icons.js prueft das global mit,
// hier zusaetzlich explizit, damit ein Fehler direkt an dieser Vorlage haengt).
for (const k of NEU){
  const d = defOf(k);
  if (d) check('1: das Icon von '+k+' steht in der Font-Whitelist',
    new RegExp('\\.'+d.icon+':before').test(src), d.icon);
}

// ---------------------------------------------------------------- 2: Belohnungsgrößenordnung
// Kein Ausreisser nach oben: die neuen duerfen nicht lohnender sein als die bestehenden, sonst
// wuerden sie den Pool verzerren (dieselbe Sorgfalt wie beim Tier-2- und Peilungs-Zulauf).
{
  const wert = d => Object.entries(d.reward).reduce((a,[r,v]) => a + (r === 'credits' ? v*5 : v), 0);
  const alt = u.ctx.DEFS.filter(d => !NEU.includes(d.key)).map(wert);
  const maxAlt = Math.max(...alt), minAlt = Math.min(...alt);
  for (const k of NEU){
    const w = wert(defOf(k));
    check('2: '+k+' liegt in der Spanne der 16 bestehenden Aufgaben', w >= minAlt && w <= maxAlt,
      { neu: w, spanne: [minAlt, maxAlt] });
  }
}

// ---------------------------------------------------------------- 3: available-Prädikate
// Zuerst die Existenz, dann die Wirkung: sonst stuerzt der Test bei einem entfernten Filter mit
// einem TypeError ab, statt klar zu sagen, welche Vorlage ihr Praedikat verloren hat.
for (const k of ['shopbuy','warsupport','rank']){
  check('3: '+k+' hat ein available-Prädikat', typeof defOf(k).available === 'function', typeof defOf(k).available);
}
if (['shopbuy','warsupport','rank'].some(k => typeof defOf(k).available !== 'function')){
  console.log('\nFAIL'); process.exit(1);
}
// shopbuy: der Laden oeffnet erst ab Freundlich (Ruf 30).
check('3: shopbuy ist ohne freundliche Fraktion NICHT im Pool', defOf('shopbuy').available() === false);
check('3: shopbuy ist mit einer freundlichen Fraktion im Pool',
  baue({ rep: { kartell: 35 } }).ctx.DEFS.find(d=>d.key==='shopbuy').available() === true);
// warsupport: nur bei laufendem Krieg, mit Diplomatie-Partei, und nur wenn noch nicht gewaehlt.
const krieg = { factionA:'Aschen-Kartell', factionB:'Eisenlegion', system:'sys1' };
check('3: warsupport ist ohne laufenden Krieg NICHT im Pool', defOf('warsupport').available() === false);
check('3: warsupport ist bei laufendem Krieg im Pool',
  baue({ krieg }).ctx.DEFS.find(d=>d.key==='warsupport').available() === true);
check('3: warsupport verschwindet, sobald Partei ergriffen wurde',
  baue({ krieg, schonGewaehlt: 'kartell' }).ctx.DEFS.find(d=>d.key==='warsupport').available() === false);
check('3: warsupport bleibt draußen, wenn keine Partei Diplomatie hat',
  baue({ krieg: { factionA:'Piratenflotte', factionB:'Rote Klaue', system:'sys1' } })
    .ctx.DEFS.find(d=>d.key==='warsupport').available() === false);
// rank: nur solange ueberhaupt noch eine Fraktion aufsteigen kann.
check('3: rank ist bei niedrigem Ruf im Pool', defOf('rank').available() === true);
check('3: rank verschwindet, wenn alle vier auf dem höchsten Rang stehen',
  baue({ rep: { kartell:100, legion:100, void:100, schatten:100 } })
    .ctx.DEFS.find(d=>d.key==='rank').available() === false);
check('3: rank bleibt im Pool, solange EINE Fraktion noch aufsteigen kann',
  baue({ rep: { kartell:100, legion:100, void:100, schatten:69 } })
    .ctx.DEFS.find(d=>d.key==='rank').available() === true);
// repcare ist immer erfuellbar (Tribut geht bei jeder Fraktion) und braucht daher kein Praedikat.
check('3: repcare braucht kein Prädikat – Tribut ist immer möglich', defOf('repcare').available === undefined);

// ---------------------------------------------------------------- 4: Fortschritt über Lebenszeit-Zähler
{
  const t = baue({ shopKaeufe: 7, dq: { startFactionShopPurchases: 5 } });
  check('4: shopbuy misst den Zuwachs seit Tagesbeginn', t.ctx.progress('shopbuy') === 2, t.ctx.progress('shopbuy'));
}
{
  const t = baue({ shopKaeufe: 3, dq: { startFactionShopPurchases: 9 } });
  check('4: shopbuy wird bei einem Rückschritt nicht negativ', t.ctx.progress('shopbuy') === 0, t.ctx.progress('shopbuy'));
}
{
  const t = baue({ parteinahmen: 4, dq: { startWarSidesTaken: 3 } });
  check('4: warsupport misst den Zuwachs seit Tagesbeginn', t.ctx.progress('warsupport') === 1);
}
// Der Zaehler, an dem shopbuy haengt, muss im Ladenkauf wirklich hochgezaehlt werden.
check('4: buyFactionShopItem erhöht factionShopPurchases',
  /state\.factionShopPurchases = \(state\.factionShopPurchases\|\|0\) \+ 1;/.test(src));
check('4: supportWarSide erhöht warSidesTaken',
  /state\.warSidesTaken = \(state\.warSidesTaken\|\|0\) \+ 1;/.test(src));

// ---------------------------------------------------------------- 5: repcare über den Kontakt-Trichter
{
  const t = baue({ dq: { contactedFactions: { kartell:true, legion:true } } });
  check('5: repcare zählt die verschiedenen kontaktierten Fraktionen', t.ctx.progress('repcare') === 2);
  check('5: das Ziel sind 3 von 4 Fraktionen', defOf('repcare').target === 3, defOf('repcare').target);
  check('5: das Ziel ist kleiner als die Zahl der Fraktionen – erfüllbar', defOf('repcare').target < 4);
}
{
  // Doppelter Kontakt bei derselben Fraktion darf nicht doppelt zaehlen.
  const t = baue({ dq: { contactedFactions: { kartell:true } } });
  check('5: mehrfacher Kontakt bei derselben Fraktion zählt einmal', t.ctx.progress('repcare') === 1);
}
// Die Zaehlung haengt an touchFactionContact - der einzigen Stelle, durch die echter Kontakt laeuft.
{
  const tf = src.slice(src.indexOf('function touchFactionContact'), src.indexOf('\n  }', src.indexOf('function touchFactionContact')));
  check('5: touchFactionContact zählt die Fraktion für den Tag mit',
    /state\.dailyQuests\.contactedFactions\[fid\] = true;/.test(tf));
}
// Und der Verfalls-Freibrief der Botschaften darf NICHT durch touchFactionContact laufen, sonst
// haetten Botschafts-Spieler die Aufgabe minuetlich von selbst erledigt.
{
  const decay = src.slice(src.indexOf('function applyReputationDecay'), src.indexOf('\n  }\n', src.indexOf('function applyReputationDecay')));
  check('5: der Botschafts-Freibrief setzt die Kontaktuhr DIREKT, nicht über touchFactionContact',
    /if \(hasEmbassy\(fid\)\)\{ state\.factionLastContact\[fid\] = jetzt; continue; \}/.test(decay) &&
    !/touchFactionContact/.test(decay));
}

// ---------------------------------------------------------------- 6: rank misst die Summe
{
  // Start 4 (alle Rang 1... im Testaufbau Rang 4 bei Ruf 0), eine Fraktion steigt auf.
  const t = baue({ rep: { kartell: 0, legion: 0, void: 0, schatten: 0 }, dq: { startRankSum: 16 } });
  check('6: ohne Aufstieg ist der Fortschritt 0', t.ctx.progress('rank') === 0, t.ctx.progress('rank'));
  const t2 = baue({ rep: { kartell: 15, legion: 0, void: 0, schatten: 0 }, dq: { startRankSum: 16 } });
  check('6: ein einzelner Aufstieg zählt', t2.ctx.progress('rank') === 1, t2.ctx.progress('rank'));
  // Der eigentliche Grund fuer die Summe: ein Aufstieg zaehlt auch, wenn eine ANDERE Fraktion
  // schon auf dem hoechsten Rang steht (ein Maximum waere dort fuer immer eingefroren).
  const t3 = baue({ rep: { kartell: 100, legion: 15, void: 0, schatten: 0 }, dq: { startRankSum: 8+4+4+4 } });
  check('6: ein Aufstieg zählt auch neben einer Fraktion auf Rang 8', t3.ctx.progress('rank') === 1, t3.ctx.progress('rank'));
}
check('6: factionRankSum ist die gemeinsame Quelle für Aufgabe und Tagesmarke',
  /function factionRankSum\(\)\{/.test(src) &&
  /startRankSum: factionRankSum\(\)/.test(src) &&
  /factionRankSum\(\) - \(dq\.startRankSum\|\|0\)/.test(src));
// Die ECHTE Funktion aus der Spieldatei ausfuehren. Oben wird sie als Parameter hereingegeben, damit
// die Vorlagen isoliert messbar sind - hier muss sie selbst auf den Pruefstand, sonst bliebe eine
// Umstellung von der Summe auf ein Maximum unbemerkt (genau das fiel in der Rot-Pruefung auf).
{
  const vonS = src.indexOf('  function factionRankSum(){');
  // factionRankOf liest aus einer frei setzbaren Tabelle, damit die Raenge im Test bestimmbar sind.
  function summeFuer(raenge){
    const f = new Function('FACTION_DIPLOMACY', 'factionRankOf',
      src.slice(vonS, src.indexOf('\n  }', vonS) + 4) + ';return factionRankSum;'
    )({ kartell:1, legion:1, void:1, schatten:1 }, fid => ({ nr: raenge[fid] }));
    return f();
  }
  check('6: factionRankSum addiert alle vier Ränge (kein Maximum)',
    summeFuer({ kartell:8, legion:1, void:1, schatten:1 }) === 11,
    summeFuer({ kartell:8, legion:1, void:1, schatten:1 }));
  check('6: ein Aufstieg neben einer Rang-8-Fraktion erhöht die Summe',
    summeFuer({ kartell:8, legion:2, void:1, schatten:1 }) - summeFuer({ kartell:8, legion:1, void:1, schatten:1 }) === 1);
  check('6: alle vier auf dem höchsten Rang ergibt 32', summeFuer({ kartell:8, legion:8, void:8, schatten:8 }) === 32);
}

// ---------------------------------------------------------------- 7: Tagesmarken und Nachtrag
check('7: alle drei Tagesbeginn-Marken werden beim Tageswechsel gesetzt',
  /startFactionShopPurchases: state\.factionShopPurchases\|\|0/.test(src) &&
  /startWarSidesTaken: state\.warSidesTaken\|\|0/.test(src) &&
  /startRankSum: factionRankSum\(\)/.test(src));
check('7: contactedFactions wird beim Tageswechsel geleert', /contactedFactions: \{\},/.test(src));
// Der Nachtrag ist das eigentlich Wichtige: ohne ihn waeren drei der vier Aufgaben fuer jeden,
// der mitten am Tag aktualisiert, sofort erledigt (Lebenszeit-Stand minus 0).
{
  const san = src.slice(src.indexOf('function sanitizeDailyQuests'), src.indexOf('\n  }\n', src.indexOf('function sanitizeDailyQuests')));
  for (const feld of ['startFactionShopPurchases', 'startWarSidesTaken', 'startRankSum']){
    check('7: '+feld+' wird für Altstände nachgetragen',
      new RegExp('dq\\.'+feld+' === undefined').test(san), feld);
  }
  check('7: contactedFactions wird für Altstände nachgetragen', /if \(!dq\.contactedFactions\)\{/.test(san));
  check('7: der Nachtrag meldet eine Änderung zurück (damit gespeichert wird)',
    /changed = true; \}/.test(san) && /return changed;/.test(san));
}
// Rechnerischer Nachweis: mit nachgetragener Marke ist die Aufgabe NICHT sofort fertig.
{
  const t = baue({ shopKaeufe: 42, dq: { startFactionShopPurchases: 42 } });
  check('7: nach dem Nachtrag steht ein Langzeit-Konto bei 0, nicht bei 42',
    t.ctx.progress('shopbuy') === 0, t.ctx.progress('shopbuy'));
}

// ---------------------------------------------------------------- 8: Hilfe (CLAUDE.md Regel 6)
{
  const h = src.slice(src.indexOf("title:'Tagesaufgaben'"));
  const hilfe = h.slice(0, h.indexOf("' },"));
  check('8: der Hilfe-Abschnitt existiert', hilfe.length > 500);
  for (const [k, wort] of [['shopbuy','Fraktionsladen'], ['warsupport','Partei ergreifen'],
                            ['rank','Fraktionsrang'], ['repcare','Kontakt halten']]){
    check('8: die Hilfe nennt '+k+' („'+wort+'")', hilfe.includes(wort));
  }
  // Die Zahl steht nicht mehr fest im Test: Sie kommt aus DEFS und wird oben in Abschnitt 1 gegen
  // beide Textstellen geprueft. Hier bleibt nur, dass die Hilfe die Groesse ueberhaupt nennt - und
  // dass sie die beiden Tiefen-Aufgaben aufzaehlt statt sie nur mitzuzaehlen.
  check('8: die Hilfe nennt die Pool-Größe', new RegExp(u.ctx.DEFS.length+' Vorlagen').test(hilfe));
  check('8: und zaehlt die beiden Tiefen-Aufgaben mit auf',
    /Tauchgang in den Abgrund/.test(hilfe) && /Rekordtiefe/.test(hilfe));
  check('8: die Hilfe erklärt, was als Kontakt zählt', /als Kontakt zählt/.test(hilfe));
  check('8: die Hilfe sagt, dass Botschaften nicht mitzählen', /Botschaften zählen dabei bewusst nicht mit/.test(hilfe));
}

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
