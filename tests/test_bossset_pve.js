// Boss-Set-Teile ohne Allianz (Etappe B des Beute-Konzepts, 28.08.2026, Auftrag Sascha:
// "alle 4 optionen" - Asteroidenfestung, Alien-Nest, Weltboss).
//
//   node tests/test_bossset_pve.js
//
// WORUM ES GEHT: Alle 20 Boss-Set-Teile fielen ausschliesslich nach einer Allianz-Raid-Welle. Wer
// solo spielt, kam an keines heran - die groesste inhaltliche Sperre im Modulsystem. Seit dieser
// Etappe wuerfeln drei PvE-Ziele darueber; der SERVER wuerfelt, der Client zieht nur noch das
// Teil (Raid-Muster).
//
// GEPRUEFT WIRD DIE WIRKUNG, NICHT DIE BESCHRIFTUNG (Regel 61) - und beide Repos, weil die
// Mechanik ueber die Naht laeuft:
//   1. Backend: der Wurf, ausgefuehrt statt gelesen. Der Anteilsfaktor MUSS wirken - der erste
//      Entwurf las `Number(contributions[uid])` auf ein Objekt { name, dmg } und bekam damit
//      immer 0, also einen konstanten Sockel von 0,4 (Regel 59: eine Groesse, die nur der
//      Kommentar behauptet). Deshalb misst 1b ihn als PAAR gegen zwei Anteile.
//   2. Die Naht: JEDE Quelle, die das Backend in BOSSSET_PVE_CHANCE fuehrt, braucht im Frontend
//      eine Empfangsstelle. Datengetrieben aus dem Backend abgeleitet (Regel 40) - eine vierte
//      Quelle faellt damit auf, ohne dass jemand an sie gedacht haben muss.
//   3. Frontend: der Empfang, ausgefuehrt. Ein Wurf legt ein Modul ins Inventar, kein Wurf
//      aendert nichts.
//   4. Die Anzeigestellen: Das alte "droppt nur bei <Boss>" war ab dieser Etappe eine
//      FALSCHAUSSAGE (Checkliste Punkt 6). Geprueft im LEBENDEN Text - die PATCHNOTES sind
//      unveraenderliche Historie und tragen den alten Wortlaut weiter (Regel 46).
//
// JEDE PRUEFUNG LAEUFT IN BEIDE RICHTUNGEN - auch wenn ihr Aufbau scheitert (Regel 34).
// Der erste Entwurf hatte vier Aufbau-Tore ohne Rueckfall; am alten Stand liefen dadurch
// 13 statt 28 Pruefungen, und der rote Exit-Code sah aus wie eine vollstaendige Gegenprobe.
// `fehlend()` meldet stattdessen jede abhaengige Pruefung namentlich als rot, mit dem Grund -
// dieselbe Antwort wie `versuche()` in test_gegenstandskatalog.
//
// GEGENPROBE (in beide Richtungen): gegen `origin/main` per KEPLER_SPIELDATEI/KEPLER_BACKEND_SERVER.
const fs = require('fs');
const path = require('path');
const { WURZEL, SPIELDATEI, SERVER_JS } = require('./lib/spieldatei');
const { pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');
const B = fs.existsSync(SERVER_JS) ? fs.readFileSync(SERVER_JS, 'utf8') : '';

// Meldet jede Pruefung einer Gruppe als rot, wenn ihr Aufbau nicht zustande kam. Ohne das faehrt
// die Gegenprobe weniger Pruefungen als der gruene Lauf, und der Vergleich der Pruefnamen
// (Regel 60) meldet einen Unterschied, der gar keine Aussage ueber die Sache ist.
function fehlend(namen, grund){ for (const n of namen) check(n, false, { grund }); }

const N1 = [
  '1a: der Wurf liefert { bossKey, seltenheit }',
  '1b: der Anteilsfaktor staffelt (Vollanteil rund 2,5x haeufiger als Sockel)',
  '1b2: der Faktor selbst laeuft von 0,4 bis 1,0',
  '1c: Basis 0 liefert nie ein Teil',
  '1d: eine haertere Stufe faellt haeufiger legendaer',
  '1e: der Weltboss hat die kleinste Grundchance',
  '1e2: die Chance steigt mit der Ausbaustufe (Festung UND Nest)'
];
const N2 = [
  '2b: der Weltboss-Anteil liest .dmg, nicht das Objekt',
  '2c: gewuerfelt wird je Schlag mit Schaden, nicht nur beim Kill'
];
const N3 = [
  '3a: jede Backend-Quelle ist dem Test bekannt',
  '3b: jede Backend-Quelle hat ihre Frontend-Marke'
];
const N4 = [
  '4-lauf: kein Laufzeitfehler in den Messaufrufen',
  '4a: ein Serverwurf legt genau ein Modul ins Inventar',
  '4b: ohne Wurf passiert NICHTS',
  '4c: die Seltenheit des Servers wird uebernommen'
];

// Kommentare LEEREN statt entfernen - so bleiben die Zeilennummern in jedem Beleg richtig
// (die Lehre aus test_wertstreuung, 22.08.2026).
function ohneKommentare(t){
  return t.replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length))
          .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
}
// Regel 46: verneinende Pruefungen schneiden den PATCHNOTES-Block heraus, sonst findet die Suche
// ihren eigenen Behebungs-Eintrag wieder.
const PN_VON = S.indexOf('  const PATCHNOTES = [');
const PN_BIS = PN_VON < 0 ? -1 : S.indexOf('\n  ];', PN_VON);
const PN_BLOCK = (PN_VON >= 0 && PN_BIS > PN_VON) ? S.slice(PN_VON, PN_BIS) : '';
const S_LEBEND = PN_BLOCK ? S.slice(0, PN_VON) + S.slice(PN_BIS) : S;
// Der Anker misst die EIGENSCHAFT, nicht den Marker: Ein Wortlaut, der nachweislich NUR im
// PATCHNOTES-Block steht, muss im lebenden Text fehlen. Der erste Entwurf suchte stattdessen den
// String 'const PATCHNOTES = [' - den gibt es in der Datei ein zweites Mal (der Bauer der
// oeffentlichen Patchnotes-Seite liest ihn als Suchmarke), also Regel 39 im eigenen Test.
//
// Beide Seiten dieses Merges haben denselben Ausfall vom 02.09.2026 behoben, aber verschieden.
// Uebernommen ist von jeder das Bessere:
//
// - HISTORIE kommt aus tests/lib/patchnotes.js (origin/main). Das ist die EINE Stelle, die Spiel
//   und patchnotes-archiv.json zusammensetzt; eine zweite eigene Pfadaufloesung waere genau die
//   zweite Wahrheit, gegen die lib/spieldatei.js gebaut ist.
//
// - Die PROBE des Ankers wird bei jedem Lauf frisch aus dem Block gelesen. Ein fester Wortlaut
//   taugt hier nicht mehr, auch nicht gegen die ganze Historie geprueft: Steht er im Archiv, ist
//   `HISTORIE.includes(...)` immer wahr und `!S_LEBEND.includes(...)` trivial wahr (im Spiel gibt
//   es ihn ja nicht mehr) - der Anker kann einen fehlgeschlagenen Schnitt dann nicht mehr
//   bemerken. Gemessen an origin/main mit `S_LEBEND = S`: weggefallen 0, Anker meldet trotzdem
//   OK. Mit der Probe aus dem Block faellt er in genau diesem Fall.
const NUR_HISTORIE = 'Boss-Set-Teile nur bei einer Allianz-Raid-Welle';
const HISTORIE = require('./lib/patchnotes').patchnotesText(S);
const PROBE = PN_BLOCK.slice(Math.floor(PN_BLOCK.length / 2), Math.floor(PN_BLOCK.length / 2) + 120);
check('0-anker: der PATCHNOTES-Block wurde wirklich herausgeschnitten',
  PN_BLOCK.length > 0 && PROBE.length === 120 && S.includes(PROBE) && !S_LEBEND.includes(PROBE),
  { ganz: S.length, lebend: S_LEBEND.length, weggefallen: S.length - S_LEBEND.length,
    probe: PROBE.slice(0, 40) })

function block(t, anfang, endeMarke){
  const von = t.indexOf(anfang);
  const bis = von < 0 ? -1 : t.indexOf(endeMarke, von);
  return (von < 0 || bis < 0) ? null : t.slice(von, bis + endeMarke.length);
}

// ---- 1) Backend: der Wurf, AUSGEFUEHRT ------------------------------------------------------
let wurf = null, faktor = null, tabelle = null, bauFehler = null;
if (!B){
  bauFehler = 'server.js liegt nicht daneben: ' + SERVER_JS;
} else {
  try {
    const teile = [
      block(B, 'const BOSSSET_PVE_CHANCE = {', '\n};'),
      block(B, 'function bosssetAnteilFaktor(', '\n}'),
      block(B, 'function bosssetPveWurf(', '\n}')
    ];
    if (teile.some(t => !t)) throw new Error('ein Block fehlt: ' + teile.map(t => !!t).join(','));
    // ALLIANCE_RAID_BOSSES braucht der Wurf fuer die Bosswahl - geschnitten, nicht nachgebaut
    // (Regel 36).
    const bosse = block(B, 'const ALLIANCE_RAID_BOSSES = [', '\n];');
    if (!bosse) throw new Error('ALLIANCE_RAID_BOSSES nicht gefunden');
    const f = new Function(bosse + '\n' + teile.join('\n') +
      '\nreturn { BOSSSET_PVE_CHANCE, bosssetAnteilFaktor, bosssetPveWurf };');
    const m = f();
    tabelle = m.BOSSSET_PVE_CHANCE; faktor = m.bosssetAnteilFaktor; wurf = m.bosssetPveWurf;
  } catch(e){ bauFehler = String(e && e.message || e); }
}
check('1-bau: die drei Backend-Bloecke lassen sich schneiden und ausfuehren', !bauFehler, { fehler: bauFehler });

if (wurf){
  // 1a: Die Rueckgabeform ist GENAU das, was grantBossSetModule braucht. Ein drittes Feld waere
  //     toter Code, ein fehlendes ein stiller Ausfall.
  let treffer = null;
  for (let i = 0; i < 20000 && !treffer; i++) treffer = wurf(1.0, 1.0, 3);
  check(N1[0], !!(treffer && treffer.bossKey && treffer.seltenheit), { treffer });

  // 1b: PAAR - der Anteilsfaktor wirkt wirklich. Der Sockel 0,4 und der Vollwert 1,0 muessen
  //     messbar auseinanderliegen; waere der Anteil (wie im ersten Entwurf) immer 0, waeren
  //     beide Laeufe gleich.
  const N = 40000;
  let klein = 0, gross = 0;
  for (let i = 0; i < N; i++){ if (wurf(0.5, 0.0, 1)) klein++; if (wurf(0.5, 1.0, 1)) gross++; }
  const verh = klein > 0 ? gross / klein : 0;
  check(N1[1], verh > 2.1 && verh < 2.9,
    { kleinerAnteil: klein, vollerAnteil: gross, verhaeltnis: +verh.toFixed(2) });
  check(N1[2], faktor(0) === 0.4 && faktor(1) === 1.0 && faktor(0.5) === 0.7,
    { a0: faktor(0), a05: faktor(0.5), a1: faktor(1) });

  // 1c: Eine Basis von 0 wuerfelt gar nicht - so schaltet eine kuenftige Quelle sich ab, ohne
  //     dass jemand einen Zweig ausbauen muss.
  let nullTreffer = 0;
  for (let i = 0; i < 5000; i++) if (wurf(0, 1.0, 3)) nullTreffer++;
  check(N1[3], nullTreffer === 0, { treffer: nullTreffer });

  // 1d: Die Haerte des Ziels verschiebt die Seltenheit. Gemessen als PAAR, nicht als Blick auf
  //     eine Zeile.
  function anteilLegendaer(stufe){
    let n = 0, gesamt = 0;
    for (let i = 0; i < 60000; i++){ const t = wurf(1.0, 1.0, stufe); if (t){ gesamt++; if (t.seltenheit === 'legendaer') n++; } }
    return gesamt ? n / gesamt : 0;
  }
  const l1 = anteilLegendaer(1), l5 = anteilLegendaer(5);
  check(N1[4], l5 > l1 + 0.05, { stufe1: +l1.toFixed(3), stufe5: +l5.toFixed(3) });

  // 1e: Die Kalibrierung. Nicht "irgendeine Zahl", sondern die Ordnung, in der sie stehen MUSS:
  //     Der Weltboss ist die einzige Quelle mit garantierter taeglicher Gelegenheit und hat
  //     deshalb die kleinste Basis (die Rechnung steht am Kommentar der Tabelle).
  const fMax = Math.max(...Object.values(tabelle.festung));
  const nMax = Math.max(...Object.values(tabelle.nest));
  check(N1[5], tabelle.weltboss > 0 && tabelle.weltboss < fMax && tabelle.weltboss < nMax,
    { weltboss: tabelle.weltboss, festungMax: fMax, nestMax: nMax });
  const festSteigt = Object.keys(tabelle.festung).map(Number).sort((a,b)=>a-b)
    .every((k, i, arr) => i === 0 || tabelle.festung[k] > tabelle.festung[arr[i-1]]);
  const nestSteigt = Object.keys(tabelle.nest).map(Number).sort((a,b)=>a-b)
    .every((k, i, arr) => i === 0 || tabelle.nest[k] > tabelle.nest[arr[i-1]]);
  check(N1[6], festSteigt && nestSteigt, { festung: tabelle.festung, nest: tabelle.nest });
} else {
  fehlend(N1, 'der Wurf liess sich nicht ausfuehren: ' + bauFehler);
}

// ---- 2) Backend: die drei Aufrufstellen, und der Fehler, der still gewesen waere -------------
if (B){
  const BK = ohneKommentare(B);
  const aufrufe = BK.split('\n').map((z, i) => ({ nr: i+1, z }))
    .filter(x => /bosssetPveWurf\s*\(/.test(x.z) && !/function\s+bosssetPveWurf/.test(x.z));
  check('2a: drei Aufrufstellen im Backend (Festung, Nest, Weltboss)', aufrufe.length === 3,
    { zeilen: aufrufe.map(x => x.nr + ': ' + x.z.trim().slice(0, 80)) });

  // Die Regel, nicht die Schreibweise: Wer den Weltboss-Anteil bildet, muss `.dmg` lesen -
  // `contributions[uid]` ist ein OBJEKT. Der erste Entwurf las `Number(b2)` und bekam NaN.
  const wbBlock = block(BK, 'let bosssetWb = null;', 'res.json(');
  check('2b-anker: der Weltboss-Block laesst sich schneiden', !!wbBlock, { gefunden: !!wbBlock });
  if (wbBlock){
    check(N2[0], /\.dmg/.test(wbBlock) && !/Number\(\s*b2\s*\)/.test(wbBlock),
      { block: wbBlock.replace(/\s+/g, ' ').trim().slice(0, 220) });
    // Je SCHLAG, nicht je Kill - sonst haengt die Belohnung am Zufall des letzten Schlags
    // (dieselbe Kritik, die beim Hort der Festung zum anteiligen Modell gefuehrt hat).
    check(N2[1], /dmg\s*>\s*0/.test(wbBlock) && !/\bkilled\s*&&/.test(wbBlock),
      { block: wbBlock.replace(/\s+/g, ' ').trim().slice(0, 220) });
  } else {
    fehlend(N2, 'der Weltboss-Block liess sich nicht schneiden');
  }
} else {
  check('2a: drei Aufrufstellen im Backend (Festung, Nest, Weltboss)', false, { grund: 'kein server.js' });
  check('2b-anker: der Weltboss-Block laesst sich schneiden', false, { grund: 'kein server.js' });
  fehlend(N2, 'kein server.js');
}

// ---- 3) Die NAHT: jede Backend-Quelle braucht eine Frontend-Empfangsstelle -------------------
// Datengetrieben aus BOSSSET_PVE_CHANCE abgeleitet (Regel 40). Die Zuordnung Quelle -> Marke ist
// eine Namensliste, und das ist Absicht: Eine vierte Quelle meldet sich hier als "unbekannt" und
// ERZWINGT damit die Entscheidung, statt sie zu erraten (Muster von test_abgrund_prestige 3).
const EMPFANGSSTELLE = {
  festung:  "r.type === 'festung'",
  nest:     "r.type === 'alien-nest'",
  weltboss: 'data.bossset'
};
if (tabelle){
  const quellen = Object.keys(tabelle);
  const unbekannt = quellen.filter(q => !EMPFANGSSTELLE[q]);
  check(N3[0], unbekannt.length === 0,
    { unbekannt, hinweis: 'Neue Quelle? Frontend-Empfangsstelle bauen und hier eintragen.' });

  const SKq = ohneKommentare(S);
  const fehlendeMarke = quellen.filter(q => EMPFANGSSTELLE[q] && !SKq.includes(EMPFANGSSTELLE[q]));
  check(N3[1], fehlendeMarke.length === 0, { fehlend: fehlendeMarke });
} else {
  fehlend(N3, 'BOSSSET_PVE_CHANCE liess sich nicht lesen: ' + bauFehler);
}

// Der Helfer existiert GENAU EINMAL - eine zweite Kopie kann auseinanderlaufen (Regel 43).
const SK = ohneKommentare(S);
const defs = (SK.match(/function bosssetAusServerwurf\s*\(/g) || []).length;
check('3c: bosssetAusServerwurf gibt es genau einmal', defs === 1, { definitionen: defs });
const rufer = SK.split('\n').map((z,i)=>({nr:i+1,z})).filter(x => /bosssetAusServerwurf\s*\(/.test(x.z) && !/function bosssetAusServerwurf/.test(x.z));
check('3d: alle drei Empfangsstellen rufen den EINEN Helfer', rufer.length === 3,
  { zeilen: rufer.map(x => x.nr + ': ' + x.z.trim().slice(0, 70)) });

// ---- 4) Frontend: der Empfang, AUSGEFUEHRT ---------------------------------------------------
{
  let hol = null, f4 = null;
  try {
    const teile = [
      "const HERKUNFT_BOSS = 'boss';",
      "const MODULE_RARITY = { gewoehnlich:{label:'Gewoehnlich'}, selten:{label:'Selten'}, episch:{label:'Episch'}, legendaer:{label:'Legendaer'} };",
      "const MODULE_DEFS = [{ key:'m_a', name:'Teil A', quelle:HERKUNFT_BOSS, bossKey:'sternenfresser', effect:'prod' }];",
      'function rollModuleSubs(){ return []; }',
      "function mitWertWurf(){ return 'x'; }",
      'function playSound(){}',
      "function moduleInstanceInfo(k){ const r = k.split(':')[1]; return { rar: MODULE_RARITY[r], def: MODULE_DEFS[0] }; }",
      block(S, '  function grantBossSetModule(', '\n  }'),
      block(S, '  function bosssetAusServerwurf(', '\n  }')
    ];
    if (teile.some(t => !t)) throw new Error('ein Frontend-Block fehlt');
    hol = new Function('state', teile.join('\n') + '\nreturn bosssetAusServerwurf;');
  } catch(e){ f4 = String(e && e.message || e); }
  check('4-bau: die zwei Frontend-Bloecke lassen sich schneiden und ausfuehren', !f4, { fehler: f4 });

  if (hol){
    // 4a/4b: das PAAR. Ein Wurf legt genau EIN Modul ins Inventar, kein Wurf laesst es unberuehrt.
    let lauffehler = null, mit = null, ohne = null;
    try {
      const s1 = { modules: {} };
      mit = { text: hol(s1)({ bossKey:'sternenfresser', seltenheit:'episch' }), inv: Object.entries(s1.modules) };
      const s2 = { modules: {} };
      ohne = { text: hol(s2)(null), inv: Object.entries(s2.modules) };
    } catch(e){ lauffehler = String(e && e.message || e); }
    check(N4[0], !lauffehler, { fehler: lauffehler });
    if (!lauffehler){
      check(N4[1],
        !!mit.text && mit.inv.length === 1 && mit.inv[0][1] === 1 && mit.inv[0][0].includes(':episch:'),
        { text: mit.text, inventar: mit.inv });
      check(N4[2], ohne.text === null && ohne.inv.length === 0, { ohne });
      // 4c: Die Seltenheit kommt vom SERVER - der Client erfindet keine.
      const s3 = { modules: {} };
      const t3 = hol(s3)({ bossKey:'sternenfresser', seltenheit:'legendaer' });
      check(N4[3], String(Object.keys(s3.modules)[0]).includes(':legendaer:'),
        { instanz: Object.keys(s3.modules)[0], text: t3 });
    } else {
      fehlend(N4.slice(1), 'Laufzeitfehler in den Messaufrufen: ' + lauffehler);
    }
  } else {
    fehlend(N4, 'die Frontend-Bloecke liessen sich nicht schneiden: ' + f4);
  }
}

// ---- 5) Die Anzeigestellen (Checkliste Punkt 6) ----------------------------------------------
// "droppt nur bei <Boss>" war ab dieser Etappe eine Falschaussage. Geprueft im LEBENDEN Text.
const droppt = (S_LEBEND.match(/droppt nur be[ie]/g) || []).length;
check('5a: kein Modultext behauptet mehr "droppt nur bei"', droppt === 0, { treffer: droppt });
// Die Historie steht seit v8.638.0 in ZWEI Dateien; HISTORIE oben setzt beide zusammen. Wer nur
// die Spieldatei liest, misst "die Historie wurde umgeschrieben", wo in Wahrheit rotiert wurde.
const historie = HISTORIE.match(/Boss-Set-Teile nur bei einer Allianz-Raid[^']{0,40}/g) || []
check('5b: die PATCHNOTES tragen den alten Wortlaut weiter (Historie bleibt unangetastet)',
  historie.length > 0, { gefunden: historie, inHistorie: HISTORIE.includes(NUR_HISTORIE) });

const herk = block(S, '  const HERKUNFT_TEXT = {', '\n  };');
check('5c-anker: HERKUNFT_TEXT laesst sich schneiden', !!herk, { gefunden: !!herk });
const N5c = '5c: das Herkunfts-Schloss nennt die PvE-Ziele';
if (herk){
  const bossZeile = (herk.split('\n').find(z => /^\s*boss:/.test(z)) || '');
  check(N5c,
    /Festung/i.test(bossZeile) && /Nest/i.test(bossZeile) && /Weltboss/i.test(bossZeile) && !/ausschließlich/.test(bossZeile),
    { zeile: bossZeile.trim() });
} else {
  fehlend([N5c], 'HERKUNFT_TEXT liess sich nicht schneiden');
}
check('5d: kein Hilfetext behauptet mehr die Raid-Exklusivitaet',
  !/Boss-Set-Teile ausschließlich bei einer Allianz-Raid/.test(S_LEBEND)
  && !/droppt exklusiv die vier Teile/.test(S_LEBEND),
  { rest: (S_LEBEND.match(/Boss-Set-Teile ausschließlich[^.]{0,60}|droppt exklusiv[^.]{0,60}/g) || []) });

// 5e: Und die POSITIVE Auskunft - der Spieler muss erfahren, dass es den Weg jetzt gibt. Ohne
//     diese Zeile waere die Mechanik da und niemand wuesste davon (dieselbe Familie wie eine
//     Wirkung ohne Anzeige, Regel 59).
const hilfeTreffer = (S_LEBEND.match(/Boss-Set-Teil<\/strong>/g) || []).length;
check('5e: mindestens drei Hilfetexte nennen die neue Fundmoeglichkeit', hilfeTreffer >= 3,
  { treffer: hilfeTreffer });

ende();
