// Einfuehrungsrundgang (TUTORIAL_STEPS) v8.298.27.
//
// Ausgangslage: Der Fraktions-Ausbau hat sechs Systeme, 20 Tagesaufgaben und 15 Erfolge gebracht -
// TUTORIAL_STEPS erwaehnte davon kein Wort. Ein neuer Spieler lief an Raengen, Gunstmarken, Laeden
// und dem Ruf-Verfall komplett vorbei, bis er zufaellig in den Galaxie-Tab schaute.
//
// Der eigentliche Wert dieses Tests ist die ZAHLENPRUEFUNG: Tutorial-Texte sind eine zweite
// Anzeigestelle im Sinne von CLAUDE.md Regel 6, und sie sind besonders anfaellig, weil sie niemand
// beim Balancing anfasst. Ein Rundgang, der neuen Spielern „ab Rang 5" oder „nach sieben Tagen"
// erzaehlt, waere schlimmer als kein Rundgang.
//
// Geprueft wird:
//   1) es gibt einen Fraktions-Schritt mit gueltigem Icon, sinnvoller Laenge und Titel
//   2) er nennt alle vier Fraktionen namentlich
//   3) er nennt die tragenden Begriffe des Ausbaus (Rang, Gunstmarken, Laden, Rivalen, Botschaft)
//   4) ZAHLEN: acht Raenge, Rang 6 als Ladenschwelle, drei Tage Schonfrist - alle gegen die
//      Konstanten der Spieldatei geprueft, nicht gegen mein Gedaechtnis
//   5) die zitierten Rangnamen stehen wirklich in FACTION_RANK_NAMES
//   6) KEIN Schritt enthaelt HTML - renderTutorialStep nutzt textContent, Auszeichnung waere Klartext
//   7) alle Schritte bleiben formal in Ordnung (Icon in der Whitelist, Titel/Text gefuellt)
//   9) die Schritte zu Krediten und Tagesaufgaben (v8.298.27) - inklusive der Pruefung, dass
//      jede genannte Kredit-Quelle im Code wirklich existiert
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------------------------------------------------------------- Schritte laden
const von = src.indexOf('  const TUTORIAL_STEPS = [');
const bis = src.indexOf('\n  ];', von) + 5;
check('TUTORIAL_STEPS gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const STEPS = new Function(src.slice(von, bis) + ';return TUTORIAL_STEPS;')();

// Die Konstanten, gegen die die Tutorial-Zahlen geprueft werden - direkt aus der Spieldatei.
const raengeBlock = src.slice(src.indexOf('  const REP_RANKS = ['), src.indexOf('\n  ];', src.indexOf('  const REP_RANKS = [')) + 5);
const REP_RANKS = new Function(raengeBlock + ';return REP_RANKS;')();
const namenBlock = src.slice(src.indexOf('  const FACTION_RANK_NAMES = {'), src.indexOf('\n  };', src.indexOf('  const FACTION_RANK_NAMES = {')) + 5);
const RANK_NAMES = new Function(namenBlock + ';return FACTION_RANK_NAMES;')();
const zahl = (re, was) => { const m = src.match(re); check('Konstante '+was+' gefunden', !!m); return m ? m[1] : null; };
const MIN_RANK = Number(zahl(/const EMBASSY_MIN_RANK = (\d+);/, 'EMBASSY_MIN_RANK'));
const GRACE_TAGE = Number(zahl(/const REP_DECAY_GRACE_MS = (\d+)\*24\*3600\*1000;/, 'REP_DECAY_GRACE_MS'));
const DECAY_PRO_TAG = Number(zahl(/const REP_DECAY_PER_DAY = (\d+);/, 'REP_DECAY_PER_DAY'));

const schritt = STEPS.find(s => /Fraktionen/.test(s.title));
check('1: es gibt einen Fraktions-Schritt', !!schritt, schritt && schritt.title);
if (!schritt){ console.log('\nFAIL'); process.exit(1); }

// ---------------------------------------------------------------- 1: Form
check('1: der Schritt hat ein ti-Icon', /^ti-[a-z0-9-]+$/.test(schritt.icon||''), schritt.icon);
check('1: das Icon steht in der Font-Whitelist', new RegExp('\\.'+schritt.icon+':before').test(src), schritt.icon);
check('1: der Titel ist aussagekräftig', schritt.title.length >= 15 && schritt.title.length <= 60, schritt.title.length);
// Untergrenze, damit der Schritt wirklich etwas erklaert; Obergrenze, damit das Overlay nicht platzt
// (der bisher laengste Schritt ist die Messlatte).
const laengen = STEPS.filter(s => s !== schritt).map(s => s.text.length);
check('1: der Text ist substanziell (mind. 300 Zeichen)', schritt.text.length >= 300, schritt.text.length);
check('1: der Text sprengt nicht den Rahmen der übrigen Schritte',
  schritt.text.length <= Math.max(...laengen) * 1.6, { neu: schritt.text.length, bisherMax: Math.max(...laengen) });

// ---------------------------------------------------------------- 2: alle vier Fraktionen
for (const name of ['Aschen-Kartell', 'Eisenlegion', 'Void-Marodeure', 'Schattenbund']){
  check('2: der Schritt nennt '+name, schritt.text.includes(name));
}

// ---------------------------------------------------------------- 3: die tragenden Begriffe
for (const [begriff, paket] of [['Ruf', 'P5'], ['Rang', 'P5'], ['Gunstmarken', 'P4'], ['Laden', 'P4'],
                                 ['Rivalen', 'P3'], ['Botschaft', 'P6'], ['Feindschaft', 'P2'],
                                 ['Aufträgen', 'P1']]){
  check('3: der Schritt nennt "'+begriff+'" ('+paket+')', schritt.text.includes(begriff));
}

// ---------------------------------------------------------------- 4: Zahlen gegen die Konstanten
// Das ist der Kern. Jede Zahl im Tutorialtext muss aus der Spieldatei belegbar sein.
const ZAHLWORT = { 1:'ein', 2:'zwei', 3:'drei', 4:'vier', 5:'fünf', 6:'sechs', 7:'sieben', 8:'acht' };
check('4: die Zahl der Ränge stimmt mit REP_RANKS überein',
  schritt.text.includes(ZAHLWORT[REP_RANKS.length]+' Ränge'), { imText: ZAHLWORT[REP_RANKS.length]+' Ränge', konstante: REP_RANKS.length });
check('4: die Ladenschwelle stimmt mit EMBASSY_MIN_RANK überein',
  schritt.text.includes('Rang '+MIN_RANK), { imText: 'Rang '+MIN_RANK, konstante: MIN_RANK });
// Und dieser Rang muss in REP_RANKS wirklich "freundlich" heissen - der Text behauptet das.
check('4: Rang '+MIN_RANK+' heißt in REP_RANKS wirklich "freundlich"',
  REP_RANKS[MIN_RANK-1] && REP_RANKS[MIN_RANK-1].key === 'freundlich',
  REP_RANKS[MIN_RANK-1] && REP_RANKS[MIN_RANK-1].key);
check('4: der Text nennt genau diese Bezeichnung', schritt.text.includes('„Freundlich"'));
check('4: die Schonfrist stimmt mit REP_DECAY_GRACE_MS überein',
  schritt.text.includes(ZAHLWORT[GRACE_TAGE]+' Tage'), { imText: ZAHLWORT[GRACE_TAGE]+' Tage', konstante: GRACE_TAGE });
// Gegenprobe: es darf KEINE andere Rang- oder Tagesangabe im Text stehen, die nicht belegt ist.
{
  const raenge = [...schritt.text.matchAll(/Rang (\d+)/g)].map(m => Number(m[1]));
  check('4: der Text nennt keine unbelegte Rang-Zahl', raenge.every(r => r === MIN_RANK), raenge);
  const tage = [...schritt.text.matchAll(/(\w+) Tage/g)].map(m => m[1]);
  check('4: der Text nennt keine unbelegte Tages-Angabe', tage.every(t => t === ZAHLWORT[GRACE_TAGE]), tage);
}
// Der Verfallssatz wird im Tutorial bewusst NICHT genannt (das gehoert in die Hilfe) - dann darf er
// hier auch nicht halb falsch auftauchen.
check('4: der Verfallssatz wird nicht halb zitiert',
  !/\d+ Ruf pro Tag/.test(schritt.text) || schritt.text.includes(DECAY_PRO_TAG+' Ruf pro Tag'));

// ---------------------------------------------------------------- 5: zitierte Rangnamen belegen
{
  const zitiert = ['Bittsteller', 'Syndikatspartner'].filter(n => schritt.text.includes(n));
  check('5: der Schritt zitiert Rangnamen als Beispiel', zitiert.length >= 2, zitiert);
  const alle = Object.values(RANK_NAMES).flat();
  for (const n of zitiert){
    check('5: "'+n+'" steht wirklich in FACTION_RANK_NAMES', alle.includes(n));
  }
  // Und sie muessen zur genannten Fraktion gehoeren - der Text sagt "beim Kartell".
  if (schritt.text.includes('beim Kartell')){
    for (const n of zitiert){
      check('5: "'+n+'" ist ein Kartell-Rang (der Text sagt „beim Kartell")', RANK_NAMES.kartell.includes(n));
    }
  }
}

// ---------------------------------------------------------------- 6: kein HTML in den Texten
// renderTutorialStep setzt title/text per textContent - ein <strong> stuende woertlich im Overlay.
{
  const setzt = src.slice(src.indexOf('function renderTutorialStep'), src.indexOf('\n  }', src.indexOf('function renderTutorialStep')));
  check('6: renderTutorialStep setzt den Text per textContent',
    /tutorialText'\)\.textContent = step\.text;/.test(setzt) && !/tutorialText'\)\.innerHTML/.test(setzt));
  for (const s of STEPS){
    check('6: "'+s.title.slice(0,28)+'" enthält kein HTML-Tag', !/<[a-z/][^>]*>/i.test(s.title + ' ' + s.text));
    check('6: "'+s.title.slice(0,28)+'" enthält keine HTML-Entity', !/&(?:[a-z]+|#\d+);/i.test(s.title + ' ' + s.text));
  }
}

// ---------------------------------------------------------------- 7: alle Schritte formal in Ordnung
check('7: es sind elf Schritte (v8.453.0: + Offiziere & Module)', STEPS.length === 11, STEPS.length);
check('7: der Kommentar über TUTORIAL_STEPS nennt die richtige Anzahl',
  /Einführungstutorial für neue Spieler: elf kurze Schritte/.test(src));
check('7: alle Titel sind verschieden', new Set(STEPS.map(s=>s.title)).size === STEPS.length);
for (const s of STEPS){
  check('7: "'+s.title.slice(0,28)+'" hat ein Icon aus der Whitelist',
    /^ti-[a-z0-9-]+$/.test(s.icon||'') && new RegExp('\\.'+s.icon+':before').test(src), s.icon);
  check('7: "'+s.title.slice(0,28)+'" hat einen gefüllten Text', typeof s.text === 'string' && s.text.length >= 120, s.text && s.text.length);
}
// ---------------------------------------------------------------- 9: Kredite und Tagesaufgaben
// Zwei Luecken derselben Art wie beim Fraktions-Schritt: die zweite Waehrung und die taegliche
// Schleife des Spiels kamen im Rundgang gar nicht vor (Spieler-Frage 26.07.2026: "wie bekommt man
// credits").
{
  const kredit = STEPS.find(s => /Kredite/.test(s.title));
  check('9: es gibt einen Kredit-Schritt', !!kredit, kredit && kredit.title);
  if (kredit){
    // Jede genannte Quelle muss es im Spiel wirklich geben - sonst schickt der Rundgang neue Spieler
    // auf eine Schnitzeljagd nach etwas, das nicht existiert.
    check('9: der Kredit-Schritt nennt Handelsrouten als Hauptquelle', /Handelsrouten/.test(kredit.text));
    check('9: Handelsrouten schreiben wirklich Kredite gut',
      /state\.tradeRouteLifetimeCredits = \(state\.tradeRouteLifetimeCredits\|\|0\) \+/.test(src));
    check('9: der Schritt nennt eroberte Systeme', /eroberte Sternsysteme/.test(kredit.text));
    check('9: eroberte Systeme zahlen wirklich Kredite', /CONQUERED_CREDITS_PER_MIN/.test(src));
    check('9: der Schritt nennt den Kredit-Shop als Senke', /Kredit-Shop/.test(kredit.text));
    check('9: der Schritt nennt das Botschaftsviertel als Kredit-Senke', /Botschaftsviertel/.test(kredit.text));
    // Und das ist keine leere Behauptung mehr: das Gebaeude hat wirklich Kredit-Kosten UND die
    // Kostenpruefung kann sie lesen (das war der Fehler aus v8.298.24).
    check('9: das Botschaftsviertel hat wirklich Kredit-Kosten', /baseCost:\{erz:9000, kristalle:6500, deuterium:3200, credits:400\}/.test(src));
  }
  const tag = STEPS.find(s => /Tagesaufgaben/.test(s.title));
  check('9: es gibt einen Tagesaufgaben-Schritt', !!tag, tag && tag.title);
  if (tag){
    // Die Poolgroesse im Text muss zu DAILY_QUEST_DEFS passen, und die Zahl der taeglich gezogenen
    // zu DAILY_QUEST_ACTIVE_COUNT - wieder Regel 6.
    const defsQ = src.slice(src.indexOf('  const DAILY_QUEST_DEFS = ['), src.indexOf('  const DAILY_QUEST_ACTIVE_COUNT', src.indexOf('  const DAILY_QUEST_DEFS = [')));
    const POOL = new Function(defsQ + ';return DAILY_QUEST_DEFS.length;')();
    const AKTIV = Number((src.match(/const DAILY_QUEST_ACTIVE_COUNT = (\d+);/)||[])[1]);
    check('9: die genannte Poolgröße stimmt mit DAILY_QUEST_DEFS überein',
      tag.text.includes(POOL+' Vorlagen'), { imText: POOL+' Vorlagen', konstante: POOL });
    check('9: die Zahl der täglich gezogenen stimmt mit DAILY_QUEST_ACTIVE_COUNT überein',
      tag.text.includes(ZAHLWORT[AKTIV]+' werden täglich'), { konstante: AKTIV });
    check('9: der Schritt nennt den Serien-Bonus', /Serien-Bonus/.test(tag.text));
    check('9: der Schritt nennt das Antippen zum Springen', /antippen/.test(tag.text));
  }
}

// ---------------------------------------------------------------- 10: Offiziere & Module
// Dieselbe Luecke wie einst bei Fraktionen/Krediten/Tagesaufgaben (v8.453.0): Das Modul-System
// war zum zentralen Build-System gewachsen (zwei Systeme, sieben Seltenheiten, Wert-Streuung,
// Schmelze, Vorlagen), aber das Wort "Modul" kam im Rundgang NULL Mal vor und der Offiziere-Tab
// wurde nirgends vorgestellt. Auch hier gilt: jede Zahl im Text gegen die Konstanten.
{
  const mod = STEPS.find(s => /Offiziere & Module/.test(s.title));
  check('10: es gibt einen Offiziere-&-Module-Schritt', !!mod, mod && mod.title);
  if (mod){
    // Position: nach "Forschung & Doktrin", vor "Flotte & Kampf" - der Baukasten kommt vor dem
    // Kampf, in dem seine Boni wirken.
    const iForsch = STEPS.findIndex(s => /Forschung & Doktrin/.test(s.title));
    const iFlotte = STEPS.findIndex(s => /Flotte & Kampf/.test(s.title));
    const iMod = STEPS.indexOf(mod);
    check('10: der Schritt steht zwischen Forschung und Flotte',
      iForsch > -1 && iFlotte > -1 && iForsch < iMod && iMod < iFlotte, [iForsch, iMod, iFlotte]);
    // Beide Modulsysteme und die tragenden Begriffe des Build-Systems.
    for (const begriff of ['Standort-Module', 'Schiffsklassen-Module', 'Kommandopunkten',
                            'Fragmenten', 'Vorlagen', 'Wechselvorschau']){
      check('10: der Schritt nennt "'+begriff+'"', mod.text.includes(begriff));
    }
    // ZAHLEN gegen die Konstanten - nicht gegen mein Gedaechtnis.
    const offBlock = src.slice(src.indexOf('  const OFFICERS = ['), src.indexOf('\n  ];', src.indexOf('  const OFFICERS = [')) + 5);
    const OFF = new Function(offBlock + ';return OFFICERS;')();
    check('10: die Offiziers-Zahl stimmt mit OFFICERS überein',
      new RegExp(ZAHLWORT[OFF.length] + ' Offiziere', 'i').test(mod.text),
      { imText: ZAHLWORT[OFF.length] + ' Offiziere', konstante: OFF.length });
    const rarBlock = src.slice(src.indexOf('  const MODULE_RARITY = {'), src.indexOf('\n  };', src.indexOf('  const MODULE_RARITY = {')) + 5);
    const RAR = new Function(rarBlock + ';return MODULE_RARITY;')();
    const rarKeys = Object.keys(RAR);
    check('10: die Seltenheits-Zahl stimmt mit MODULE_RARITY überein',
      new RegExp(ZAHLWORT[rarKeys.length] + ' Seltenheiten', 'i').test(mod.text),
      { konstante: rarKeys.length });
    check('10: "von X bis Y" nennt wirklich die erste und letzte Stufe',
      mod.text.includes('von ' + RAR[rarKeys[0]].label + ' bis ' + RAR[rarKeys[rarKeys.length - 1]].label),
      { erste: RAR[rarKeys[0]].label, letzte: RAR[rarKeys[rarKeys.length - 1]].label });
    const FUSE = Number((src.match(/const MODULE_FUSE_COUNT = (\d+);/) || [])[1]);
    check('10: Konstante MODULE_FUSE_COUNT gefunden', Number.isFinite(FUSE), FUSE);
    check('10: die Verschmelz-Zahl stimmt mit MODULE_FUSE_COUNT überein',
      new RegExp(ZAHLWORT[FUSE] + ' gleichartige', 'i').test(mod.text), { konstante: FUSE });
    // Und die Kommandopunkte-Behauptung ("verdienst du fürs Kämpfen") muss zur Offiziers-UI passen,
    // die genau das verspricht.
    check('10: die Kommandopunkte-Quelle deckt sich mit der Offiziers-UI',
      /Kommandopunkte<\/strong> – die verdienst du fürs Kämpfen/.test(src));
  }
}

// Der Fraktions-Schritt soll VOR dem Abschluss-Schritt stehen, der auf den Hilfe-Tab verweist -
// sonst kommt der Verweis „Details im Hilfe-Tab" vor dem Inhalt, auf den er sich bezieht.
{
  const iF = STEPS.indexOf(schritt);
  const iLetzt = STEPS.length - 1;
  check('7: der Fraktions-Schritt steht vor dem Abschluss-Schritt', iF < iLetzt, [iF, iLetzt]);
  check('7: der Abschluss-Schritt verweist weiterhin auf den Hilfe-Tab', /Hilfe-Tab/.test(STEPS[iLetzt].text));
}

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
