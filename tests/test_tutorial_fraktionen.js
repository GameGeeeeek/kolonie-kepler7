// Tutorial-Schritt zu den Fraktionen v8.298.26.
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
check('7: es sind acht Schritte', STEPS.length === 8, STEPS.length);
check('7: der Kommentar über TUTORIAL_STEPS nennt die richtige Anzahl',
  /Einführungstutorial für neue Spieler: acht kurze Schritte/.test(src));
check('7: alle Titel sind verschieden', new Set(STEPS.map(s=>s.title)).size === STEPS.length);
for (const s of STEPS){
  check('7: "'+s.title.slice(0,28)+'" hat ein Icon aus der Whitelist',
    /^ti-[a-z0-9-]+$/.test(s.icon||'') && new RegExp('\\.'+s.icon+':before').test(src), s.icon);
  check('7: "'+s.title.slice(0,28)+'" hat einen gefüllten Text', typeof s.text === 'string' && s.text.length >= 120, s.text && s.text.length);
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
