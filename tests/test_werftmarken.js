// Werftmarken v8.350.0-8.353.0 - zehn Ausbaustufen je Schiffsklasse, Tier-2-Kette,
// Expeditionsfunde und die Aufruestzeit je Stufe (Abschnitt 11).
//
// Woran das Feature still danebengehen kann, und was dieser Test deshalb prueft:
//
//   1. EIN TOR, DAS NIE AUFGEHT. Der erste Entwurf verlangte 'rnanotech' Stufe 3 und
//      'rhochenergie' Stufe 2 - beide Forschungen haben maxLevel:1. Mk VI und Mk VIII waeren
//      dauerhaft gesperrt geblieben, ohne dass es irgendwo aufgefallen waere. Der Test rechnet
//      jedes Tor gegen das maxLevel der genannten Forschung.
//   2. EIN MATERIAL OHNE TOR. Verlangt eine Stufe erstmals Quantenchips, ohne dass die Stufe
//      Quantenphysik voraussetzt, steht der Knopf grau da und die Karte nennt den Grund nicht.
//   3. FE UND BE LAUFEN AUSEINANDER. attackPowerRaw() im Frontend und rawFleetPower() im Backend
//      MUESSEN dieselbe Zahl liefern, sonst zeigt die Vorschau mehr als das PvP rechnet. Der Test
//      fuehrt beide Markenfunktionen aus und vergleicht sie ueber alle zehn Stufen.
//   4. EINE VERGESSENE ANZEIGESTELLE (Regel 6). shipStatBarsHtml() ohne Schluessel zeigt weiter
//      den Auslieferungswert. Der Test besteht darauf, dass jeder Aufruf einen Schluessel mitgibt.
//   5. EIN WERT, DER DEN SAVE SPRENGT. Ein zu hoher shipMarks-Wert wuerde vom Backend abgelehnt -
//      und eine Ablehnung friert das Speichern KOMPLETT ein (Vorfall 21.07.2026). Der Test prueft
//      den Deckel im Frontend und die Existenz der Sanity-Grenze im Backend.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');
const path = require('path');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------------------------------------------------------------- Markenblock ausfuehrbar machen
const von = src.indexOf('const SHIP_MARK_MAX = ');
// Endanker: seit den Bastionsmarken (18.08.2026) steht deren Block ZWISCHEN dem Werftmarken-Block
// und EXPLORE_SHIP_KEYS. Mit dem alten Endanker schnitt dieser Test den fremden Block still mit -
// er lief zwar weiter, mass aber nicht mehr nur das, was er zu messen behauptet. Der neue Anker
// ist der Beginn der Bastionsmarken, MIT Rueckfall auf den alten: Ein fehlender Anker ergaebe -1
// und der Slice liefe fast bis zum Dateiende (CLAUDE.md Regel 6).
const bastionAnker = src.indexOf('const BASTION_MARK_MAX = ', von);
const bis = bastionAnker > von ? bastionAnker : src.indexOf('const EXPLORE_SHIP_KEYS', von);
check('Markenblock in der Spieldatei gefunden', von > 0 && bis > von);
check('Endanker liegt vor dem Bastionsmarken-Block - der Slice misst nur die Werftmarken',
  bastionAnker > von, { bastionAnker, bis });
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }

// SHIP_DEFS wird fuer shipMarkClassFactor() gebraucht (buildTime je Klasse). Statt die ganze
// Datei zu laden, wird eine Minimaltabelle aus den echten Definitionen gezogen - der Test soll
// die ECHTEN Bauzeiten sehen, nicht ausgedachte.
const shipDefs = [];
for (const m of src.matchAll(/\{ key:'([a-zA-Z]+)', name:'[^']*'[^\n]*?atk:(\d+)[^\n]*?buildTime:(\d+)/g)){
  // Die ganze Definitionszeile mitlesen: shipMarkFamily() braucht ausser atk auch das
  // tiefenschiff-Kennzeichen und die Geschwindigkeit. Ohne sie landeten am 01.08.2026 alle
  // Tiefenschiffe und Spaeher faelschlich bei "zivil" - die Attrappe war unvollstaendig, nicht
  // die Zuordnung. Eine zu magere Attrappe prueft am Ende nur sich selbst.
  const zeile = (src.slice(m.index).match(/^[^\n]*/) || [''])[0];
  shipDefs.push({
    key: m[1], atk: Number(m[2]), buildTime: Number(m[3]),
    speed: Number((zeile.match(/speed:(\d+)/) || [])[1] || 0),
    tiefenschiff: /tiefenschiff:true/.test(zeile)
  });
}
check('SHIP_DEFS-Bauzeiten gelesen', shipDefs.length >= 35, shipDefs.length);

// RESEARCH_DEFS: key + maxLevel, fuer die Torpruefung.
const researchMax = {};
for (const m of src.matchAll(/\{ key:'(r[a-z0-9_]+)',[^\n]*?maxLevel:(\d+)/g)) researchMax[m[1]] = Number(m[2]);
check('RESEARCH_DEFS maxLevel gelesen', Object.keys(researchMax).length >= 20, Object.keys(researchMax).length);

const state = { shipMarks: {}, research: {} };
// COUNTER_ROLE_OF steht ausserhalb des Markenblocks, wird von shipMarkFamily() aber gebraucht -
// die drei Kampffamilien leiten sich daraus ab. Es wird aus der ECHTEN Datei gelesen und
// hineingereicht, nicht nachgebaut: Eine hier getippte Rollenzuordnung waere genau die Zweitkopie,
// gegen die dieser Test antritt.
const rollenBlock = src.slice(src.indexOf('const COUNTER_ROLE_OF = {'), src.indexOf('};', src.indexOf('const COUNTER_ROLE_OF = {')) + 2);
const COUNTER_ROLE_OF = new Function(rollenBlock + '; return COUNTER_ROLE_OF;')();
// allianceBuffLeft wird injiziert (v8.373.0): shipMarkDuration liest seit dem Werftkonvoi das
// befristete Allianz-Projekt mit. Die Vorgabe ist 0 (kein Konvoi), damit alle Rohdauer-Pruefungen
// weiter unten die UNGEBREMSTE Dauer messen - die Konvoi-Wirkung wird getrennt geprueft.
let konvoiRest = 0;
const fe = new Function('SHIP_DEFS', 'RESEARCH_DEFS', 'state', 'COUNTER_ROLE_OF', 'allianceBuffLeft',
  src.slice(von, bis) +
  '; return { SHIP_MARK_MAX, SHIP_MARK_PER_STEP, SHIP_MARK_ROMAN, SHIP_MARK_STEPS, SHIP_MARK_COST_BASE,' +
  ' SHIP_MARK_COST_KEYS, SHIP_MARK_GATES, SHIP_MARK_ITEMS, shipMarkClassFactor, shipMarkCost, shipMarkOf,' +
  ' shipMarkBonus, shipMarkGateOpen, shipMarkRound, shipMarkDuration, shipMarkJob, shipMarkJobRest,' +
  ' SHIP_MARK_TIME_BASE, SHIP_MARK_TIME_STEP, SHIP_MARK_TIME_CLASS_EXP, SHIP_MARK_TIME_CAP,' +
  ' SHIP_MARK_STEP_TEXTE, shipMarkFamily, shipMarkStep, SHIP_MARK_PER_STEP_FAMILIE, shipMarkStepBonus };'
)(shipDefs, Object.entries(researchMax).map(([key])=>({key, name:key})), state, COUNTER_ROLE_OF, () => konvoiRest);

// ---------------------------------------------------------------- 1. Struktur
check('zehn Marken', fe.SHIP_MARK_MAX === 10);
check('zehn roemische Ziffern', fe.SHIP_MARK_ROMAN.length === 10 && fe.SHIP_MARK_ROMAN[9] === 'X');
check('zehn beschriebene Stufen', fe.SHIP_MARK_STEPS.length === 10);
check('neun Preiszeilen (Mk II..Mk X)', fe.SHIP_MARK_COST_BASE.length === 9);
check('jede Stufe hat einen eigenen Namen',
  new Set(fe.SHIP_MARK_STEPS.map(s=>s.was)).size === 10);
// Regel 7: jede Stufe braucht eine vollstaendige Beschreibung, keinen Kuerzel-Text.
check('jede Stufe hat einen ganzen Satz als Beschreibung',
  fe.SHIP_MARK_STEPS.every(s => typeof s.txt === 'string' && s.txt.length >= 25 && s.txt.trim().endsWith('.')),
  fe.SHIP_MARK_STEPS.filter(s => !(s.txt||'').trim().endsWith('.')).map(s=>s.was));

// ---------------------------------------------------------------- 1b. Stufentexte je Familie
// Die Texte beschrieben bis zum 01.08.2026 fuer JEDES Schiff dasselbe - "Alle Geschuetzrohre
// deutlich laenger" stand auch beim Frachter, der kein einziges Geschuetz hat. Der MALER zeichnet
// weiterhin fuer alle Ruempfe dasselbe (drawShipMiniIcon kennt nur mk); individualisiert ist die
// BENENNUNG. Deshalb prueft dieser Abschnitt zwei Dinge: dass jede Familie vollstaendig ist, und
// dass die generische Reihe als Rueckfallebene erhalten bleibt.
const familien = Object.keys(fe.SHIP_MARK_STEP_TEXTE);
check('es gibt mehrere Schiffsfamilien mit eigenen Texten', familien.length >= 5, familien);
for (const f of familien){
  const e = fe.SHIP_MARK_STEP_TEXTE[f];
  check(f+': zehn Stufen', e.length === 10, e.length);
  check(f+': jede Stufe hat einen eigenen Namen', new Set(e.map(x=>x.was)).size === 10);
  check(f+': jede Stufe hat einen ganzen Satz (Regel 7)',
    e.every(x => typeof x.txt === 'string' && x.txt.length >= 25 && x.txt.trim().endsWith('.')),
    e.filter(x => !(x.txt||'').trim().endsWith('.')).map(x=>x.was));
}
// Die Texte muessen sich zwischen den Familien WIRKLICH unterscheiden - sonst waere die ganze
// Tabelle nur eine teure Kopie des generischen Textes.
for (let stufe = 2; stufe <= 10; stufe++){
  const texte = familien.map(f => fe.SHIP_MARK_STEP_TEXTE[f][stufe-1].txt);
  check('Stufe '+stufe+': die Familien sagen nicht alle dasselbe',
    new Set(texte).size === texte.length, new Set(texte).size + ' von ' + texte.length + ' verschieden');
}
// Zuordnung: JEDES Schiff muss in einer Familie landen, und die Kampfrollen in ihrer eigenen.
const zuordnung = {};
for (const d of shipDefs) zuordnung[fe.shipMarkFamily(d.key)] = (zuordnung[fe.shipMarkFamily(d.key)]||0) + 1;
check('jede Familie bekommt mindestens ein Schiff',
  familien.every(f => (zuordnung[f]||0) > 0), zuordnung);
for (const [k, r] of Object.entries(COUNTER_ROLE_OF)){
  if (!fe.SHIP_MARK_STEP_TEXTE[r]) continue;
  check('Konterrolle entscheidet: '+k+' -> '+r, fe.shipMarkFamily(k) === r, fe.shipMarkFamily(k));
}
// Rueckfallebene: shipMarkStep darf NIE einen leeren Text liefern, auch fuer einen unbekannten
// Schluessel nicht - eine fehlende Familienzeile waere sonst eine leere Karte im Spiel.
const unbekannt = fe.shipMarkStep('gibtesnichtxyz', 5);
check('unbekannte Klasse faellt auf den generischen Text zurueck',
  !!unbekannt.was && !!unbekannt.txt && unbekannt.txt.length >= 25, unbekannt.was);
check('und die generische Reihe existiert weiterhin als Rueckfallebene',
  fe.SHIP_MARK_STEPS.length === 10);

// ---------------------------------------------------------------- 1c. Markenstil je Familie
// Der Maler kannte bis zum 01.08.2026 nur die Stufe, nicht den Schiffstyp: Ein Jaeger bekam
// denselben breiten Guertelpanzer wie ein Schlachtschiff und denselben Geschuetzlauf wie ein
// Bomber. MARK_STIL variiert die VORHANDENEN Aufbauten (Kielstreifen, Panzerkante, Rohrlaenge,
// Zusatzturm, Sensormast, Lichterkette, Antriebsstrahl) - es kommt kein neues Bauteil dazu.
const stilBlock = src.slice(src.indexOf('const MARK_STIL_STANDARD = {'), src.indexOf('function drawShipMiniIcon'));
check('Standardwerte und Stiltabelle vorhanden',
  stilBlock.includes('const MARK_STIL_STANDARD') && stilBlock.includes('const MARK_STIL = {'));
const stilCtx = new Function(stilBlock + '; return { MARK_STIL_STANDARD, MARK_STIL };')();
const stdSchluessel = Object.keys(stilCtx.MARK_STIL_STANDARD);
check('die Standardtabelle deckt alle sieben Markenstufen ab, die etwas zeichnen',
  stdSchluessel.length >= 12, stdSchluessel.length);
const stilFamilien = Object.keys(stilCtx.MARK_STIL);
check('jede Textfamilie hat auch einen Stil',
  familien.every(f => stilFamilien.includes(f)), { texte: familien, stil: stilFamilien });
// Jede Familie muss JEDEN Wert nennen - ein vergessener Wert faellt still auf den Standard zurueck
// und die Familie saehe an dieser Stufe aus wie jede andere.
for (const f of stilFamilien){
  const fehlend = stdSchluessel.filter(k => stilCtx.MARK_STIL[f][k] === undefined);
  check('Stil '+f+': nennt alle Werte', fehlend.length === 0, fehlend);
}
// Und die Werte muessen sich wirklich unterscheiden - sonst waere die Tabelle nur eine
// aufwendige Kopie des Standards. Geprueft je Wert ueber alle Familien.
for (const k of stdSchluessel){
  const werte = stilFamilien.map(f => stilCtx.MARK_STIL[f][k]);
  check('Wert "'+k+'" unterscheidet sich zwischen den Familien',
    new Set(werte).size >= 3, new Set(werte).size + ' verschiedene bei ' + werte.length + ' Familien');
}
// Plausibilitaet statt blosser Verschiedenheit: Ein Aufklaerer traegt den hoechsten Mast (er IST
// seine Antenne), ein Jaeger den niedrigsten, und die Lichterkette ist beim Grosskampfschiff am
// dichtesten. Sagt die Grafik etwas anderes als der Text, ist einer von beiden falsch.
check('der Aufklaerer hat den hoechsten Mast',
  stilCtx.MARK_STIL.spaeher.mastHoch === Math.max(...stilFamilien.map(f=>stilCtx.MARK_STIL[f].mastHoch)),
  stilFamilien.map(f=>f+':'+stilCtx.MARK_STIL[f].mastHoch));
check('der Abfangjaeger hat den niedrigsten Mast',
  stilCtx.MARK_STIL.abfang.mastHoch === Math.min(...stilFamilien.map(f=>stilCtx.MARK_STIL[f].mastHoch)));
check('der Bomber hat die laengsten Geschuetzrohre',
  stilCtx.MARK_STIL.bomber.rohrLang === Math.max(...stilFamilien.map(f=>stilCtx.MARK_STIL[f].rohrLang)),
  stilFamilien.map(f=>f+':'+stilCtx.MARK_STIL[f].rohrLang));
check('das Grosskampfschiff hat die dichteste Lichterkette',
  stilCtx.MARK_STIL.kapital.lichtZahl === Math.max(...stilFamilien.map(f=>stilCtx.MARK_STIL[f].lichtZahl)));
// Die Lichterkette braucht mindestens zwei Punkte - bei einem waere die Verteilung eine Division
// durch null (i/(lN-1)).
check('keine Familie hat weniger als zwei Systemlichter',
  stilFamilien.every(f => stilCtx.MARK_STIL[f].lichtZahl >= 2),
  stilFamilien.map(f=>f+':'+stilCtx.MARK_STIL[f].lichtZahl));
// Der Maler muss die Werte auch WIRKLICH benutzen - eine Tabelle ohne Verbraucher waere der
// teuerste Fehler hier, weil alle Pruefungen oben trotzdem gruen sind.
const malerBlock = src.slice(src.indexOf('function drawShipMiniIcon'), src.indexOf('function refreshShipMiniIcons'));
for (const k of ['kielY','kielDicke','kanteY','kanteFall','rohrLang','turmAbstand','mastX','mastHoch','lichtZahl','lichtY','strahlLang']){
  check('der Maler liest stil.'+k, malerBlock.includes('stil.'+k));
}

// ---------------------------------------------------------------- 2. Boni
state.shipMarks = {};
check('Mk I gibt keinen Bonus', fe.shipMarkBonus('jaeger','atk') === 0);
state.shipMarks = { jaeger: 10 };
const mkXAtk = fe.shipMarkBonus('jaeger','atk');
// Seit 01.08.2026 haengen die Zuwaechse an der SCHIFFSFAMILIE. Geprueft wird deshalb die
// Eigenschaft - neun bezahlte Stufen ergeben das Neunfache des Stufenwerts DIESER Familie - und
// nicht mehr eine feste Prozentzahl, die bei jedem Balance-Pass nachgezogen werden muesste.
const FAM = fe.SHIP_MARK_PER_STEP_FAMILIE;
check('die Familientabelle ist ausfuehrbar', !!FAM && Object.keys(FAM).length === 6, FAM && Object.keys(FAM));
for (const feld of ['atk','shield','speed','fuel','buildTime']){
  const erwartet = 9 * FAM[fe.shipMarkFamily('jaeger')][feld];
  check('Mk X gibt beim Jaeger das Neunfache des Stufenwerts ('+feld+')',
    Math.abs(fe.shipMarkBonus('jaeger',feld) - erwartet) < 1e-9,
    { ist: fe.shipMarkBonus('jaeger',feld), erwartet });
}
// NICHTS DARF GESUNKEN SEIN. Marken werden gekauft; ein nachtraeglich kleinerer Zuwachs waere ein
// stiller Wertverlust fuer jeden, der schon bezahlt hat. Die alten Werte sind hier bewusst als
// Zahlen festgehalten - sie sind Geschichte und aendern sich nicht mehr.
const ALT = { atk:0.03, shield:0.03, speed:0.02, fuel:0.015, buildTime:0.02 };
const gesunken = [];
for (const [famKey, fam] of Object.entries(FAM))
  for (const [feld, altwert] of Object.entries(ALT))
    if (fam[feld] < altwert - 1e-9) gesunken.push(famKey+'.'+feld+' '+fam[feld]+' < '+altwert);
check('keine Familie bekommt weniger als vor der Umstellung', gesunken.length === 0, gesunken);

// Und die Familien muessen sich WIRKLICH unterscheiden - sonst waere die Umstellung folgenlos.
const profile = new Set(Object.values(FAM).map(f => [f.atk,f.shield,f.speed,f.fuel,f.buildTime].join('/')));
check('die Familien haben unterschiedliche Profile', profile.size >= 5, [...profile]);
check('ein Spaeher gewinnt mehr Tempo als ein Grosskampfschiff',
  FAM.spaeher.speed > FAM.kapital.speed, { spaeher: FAM.spaeher.speed, kapital: FAM.kapital.speed });
check('ein Bomber gewinnt mehr Angriff als ein Zivilschiff',
  FAM.bomber.atk > FAM.zivil.atk, { bomber: FAM.bomber.atk, zivil: FAM.zivil.atk });
check('ein Grosskampfschiff gewinnt mehr Schild als ein Abfangjaeger',
  FAM.kapital.shield > FAM.abfang.shield, { kapital: FAM.kapital.shield, abfang: FAM.abfang.shield });
// Deckel: ein manipulierter Spielstand darf nicht durch die Rechenstellen laufen.
state.shipMarks = { jaeger: 9999 };
check('ueberhoehte Marke wird auf Mk X gedeckelt', fe.shipMarkOf('jaeger') === 10, fe.shipMarkOf('jaeger'));
state.shipMarks = { jaeger: NaN };
check('NaN faellt auf Mk I zurueck', fe.shipMarkOf('jaeger') === 1);
state.shipMarks = {};
check('fehlender Schluessel = Mk I (keine Migration noetig)', fe.shipMarkOf('nanoklinge') === 1);

// ---------------------------------------------------------------- 3. Tore erreichbar (Fund 1)
for (const [ziel, gate] of Object.entries(fe.SHIP_MARK_GATES)){
  const max = researchMax[gate.key];
  check('Tor Mk '+fe.SHIP_MARK_ROMAN[ziel-1]+' ('+gate.key+' '+gate.level+') ist erreichbar',
    max !== undefined && gate.level <= max, { gefordert:gate.level, maxLevel:max });
}

// ---------------------------------------------------------------- 4. Material braucht ein Tor (Fund 2)
// Fuer jedes Material gilt: Auf der Stufe, auf der es ERSTMALS auftaucht, muss ein Tor stehen.
// erz/kristalle sind Grundstoffe und brauchen keins.
const materialTor = {
  nanolegierungen:'rnanotech', quantenchips:'rquantenphysik', hochenergiekristalle:'rhochenergie',
  fusionskerne:'rfusionskerne', kikerne:'rkitech', metamaterial:'rmetamaterial'
};
const gesehen = new Set();
for (let i = 0; i < fe.SHIP_MARK_COST_BASE.length; i++){
  const ziel = i + 2;
  check('Preiszeile Mk '+fe.SHIP_MARK_ROMAN[ziel-1]+' hat so viele Spalten wie SHIP_MARK_COST_KEYS',
    fe.SHIP_MARK_COST_BASE[i].length === fe.SHIP_MARK_COST_KEYS.length,
    [fe.SHIP_MARK_COST_BASE[i].length, fe.SHIP_MARK_COST_KEYS.length]);
  fe.SHIP_MARK_COST_BASE[i].forEach((v, j) => {
    const res = fe.SHIP_MARK_COST_KEYS[j];
    if (v <= 0 || gesehen.has(res)) return;
    gesehen.add(res);
    if (!materialTor[res]) return;   // Grundstoff
    const gate = fe.SHIP_MARK_GATES[ziel];
    check('erstes '+res+' auf Mk '+fe.SHIP_MARK_ROMAN[ziel-1]+' ist durch ein Tor gedeckt',
      !!gate && gate.key === materialTor[res], gate || null);
  });
}
check('alle sechs Tier-2-Materialien kommen vor',
  Object.keys(materialTor).every(r => gesehen.has(r)), [...gesehen]);
// Der Singularitaetskern gehoert der Tiefenflotte und dem Vernichter - eine zweite Senke hier
// waere eine Balance-Entscheidung, keine stille Ergaenzung.
check('Singularitaetskerne bleiben aussen vor', !fe.SHIP_MARK_COST_KEYS.includes('singularitaetskern'));
// Jede Ressource, die eine Stufe verlangt, muss auf allen HOEHEREN Stufen weiter verlangt werden -
// eine Zutat, die auf Mk IX gefordert wird und auf Mk X wieder verschwindet, waere ein Tippfehler.
let monoton = true, monoAbw = null;
for (let i = 1; i < fe.SHIP_MARK_COST_BASE.length; i++){
  fe.SHIP_MARK_COST_BASE[i].forEach((v, j) => {
    const vor = fe.SHIP_MARK_COST_BASE[i-1][j];
    if (vor > 0 && !(v > vor)){ monoton = false; monoAbw = { stufe:'Mk '+fe.SHIP_MARK_ROMAN[i+1], res:fe.SHIP_MARK_COST_KEYS[j], vor, v }; }
  });
}
check('einmal verlangte Zutaten verschwinden auf hoeheren Stufen nicht', monoton, monoAbw);

// ---------------------------------------------------------------- 4b. Expeditionsfunde
// RARE_ITEMS mit chance > 0 sind die einzigen, die tatsaechlich bei Expeditionen fallen.
const rareChance = {};
for (const m of src.matchAll(/\{ key:'([a-z]+)', name:'([^']+)', chance:([0-9.]+)/g)) rareChance[m[1]] = Number(m[3]);
check('RARE_ITEMS mit Fundchance gelesen', Object.keys(rareChance).length >= 5, Object.keys(rareChance));
const itemStufen = Object.keys(fe.SHIP_MARK_ITEMS).map(Number).sort((a,b)=>a-b);
check('genau die drei obersten Marken verlangen einen Fund',
  itemStufen.join(',') === '8,9,10', itemStufen);
for (const ziel of itemStufen){
  const it = fe.SHIP_MARK_ITEMS[ziel];
  check('Mk '+fe.SHIP_MARK_ROMAN[ziel-1]+': '+it.key+' faellt wirklich bei Expeditionen (chance > 0)',
    rareChance[it.key] > 0, { chance: rareChance[it.key] });
  check('Mk '+fe.SHIP_MARK_ROMAN[ziel-1]+': Menge ist klein und fest', it.n >= 1 && it.n <= 2, it.n);
}
check('jede Stufe verlangt ein ANDERES Material (nicht dreimal dasselbe)',
  new Set(itemStufen.map(z=>fe.SHIP_MARK_ITEMS[z].key)).size === itemStufen.length);
// Der Leerensplitter heisst zwar "Splitter", hat aber chance:0 - er kommt NICHT aus Expeditionen.
check('Leerensplitter wird nicht als Expeditionsfund verlangt (chance:0, andere Quelle)',
  !itemStufen.some(z => fe.SHIP_MARK_ITEMS[z].key === 'leerensplitter'));
// Der Antimateriekern wird je Superschlachtschiff verbraucht - keine zweite Senke.
check('Antimateriekern bleibt dem Superschlachtschiff vorbehalten',
  !itemStufen.some(z => fe.SHIP_MARK_ITEMS[z].key === 'antimateriekern'));
// Die Fundmenge darf NICHT mit dem Klassenfaktor wachsen - 18 Urmaterie waeren eine Mauer.
check('Fundmenge haengt nicht am Klassenfaktor (steht nicht im Kostenobjekt)',
  Object.keys(fe.shipMarkCost('fusionsdreadnought', 10)).every(k => !rareChance[k]),
  Object.keys(fe.shipMarkCost('fusionsdreadnought', 10)));

// ---------------------------------------------------------------- 5. Preise
check('Jaeger hat Klassenfaktor 1,0', Math.abs(fe.shipMarkClassFactor('jaeger') - 1) < 1e-9);
check('Schlachtschiff hat Klassenfaktor 6,4', Math.abs(fe.shipMarkClassFactor('schlachtschiff') - 6.4) < 1e-9);
check('Mondzerstoerer laeuft in den Deckel 20', fe.shipMarkClassFactor('mondzerstoerer') === 20);
// Preise muessen streng steigen - sonst waere eine spaetere Stufe billiger als eine fruehere.
let steigend = true, vorher = 0;
for (let ziel = 2; ziel <= 10; ziel++){
  const erz = fe.shipMarkCost('jaeger', ziel).erz;
  if (!(erz > vorher)) steigend = false;
  vorher = erz;
}
check('Preise steigen von Mk II bis Mk X streng', steigend);
check('Mk XI existiert nicht', fe.shipMarkCost('jaeger', 11) === null);
const jaegerGesamt = [...Array(9)].reduce((a,_,i)=> a + fe.shipMarkCost('jaeger', i+2).erz, 0);
check('Jaeger-Gesamtweg kostet ~2,26 Mio Erz', jaegerGesamt > 2.2e6 && jaegerGesamt < 2.35e6, jaegerGesamt);

// ---------------------------------------------------------------- 6. FE/BE-Gleichstand (Fund 3)
const backend = path.resolve(__dirname, '../../../workspace/kolonie-kepler7-backend/server.js');
const bePfade = [
  backend,
  '/workspace/kolonie-kepler7-backend/server.js',
  path.resolve(__dirname, '../../kolonie-kepler7-backend/server.js')
];
const bePfad = bePfade.find(p => { try { return fs.existsSync(p); } catch(e){ return false; } });
if (!bePfad){
  console.log('SKIP - Backend nicht im Arbeitsbereich, FE/BE-Vergleich ausgelassen');
} else {
  const beSrc = fs.readFileSync(bePfad, 'utf8');
  const bVon = beSrc.indexOf('const SHIP_MARK_MAX = ');
  const bBis = beSrc.indexOf('function rawFleetPower', bVon);
  check('Markenblock im Backend gefunden', bVon > 0 && bBis > bVon);
  if (bVon > 0 && bBis > bVon){
    // Das Backend braucht seit 01.08.2026 seine EIGENE Rollentabelle im Sandkasten: Die
    // Markenzuwaechse haengen dort an COUNTER_ROLE_OF. Sie wird aus der echten Backend-Datei
    // gelesen, nicht aus der Frontend-Datei uebernommen - sonst pruefte der Test die Spiegelung
    // gegen sich selbst.
    const beRollenVon = beSrc.indexOf('const COUNTER_ROLE_OF = {');
    const beRollen = beSrc.slice(beRollenVon, beSrc.indexOf('};', beRollenVon) + 2);
    check('Backend hat eine eigene Rollentabelle', beRollenVon > 0);
    const be = new Function(beRollen + ';' + beSrc.slice(bVon, bBis) +
      '; return { SHIP_MARK_MAX, shipMarkLevel, shipMarkAtkMult, shipMarkShieldMult, COUNTER_ROLE_OF };')();
    check('Backend deckelt bei derselben Stufe', be.SHIP_MARK_MAX === fe.SHIP_MARK_MAX);

    // ALLE Klassen vergleichen, nicht nur den Jaeger. Bis 01.08.2026 stand hier genau ein
    // Schluessel - das genuegte, solange jede Klasse denselben Zuwachs bekam. Mit Zuwaechsen je
    // Familie prueft ein einzelner Schluessel nur noch eine von sechs Tabellenzeilen; die
    // Abweichungen (Bomber beim Angriff, Grosskampfschiff beim Schild) laegen genau daneben.
    const alleKeys = shipDefs.map(d => d.key).concat(['superschlachtschiff']);
    const abwAtk = [], abwShield = [];
    for (const key of alleKeys){
      for (let mk = 1; mk <= 12; mk++){
        state.shipMarks = { [key]: mk };
        const feA = 1 + fe.shipMarkBonus(key,'atk');
        const beA = be.shipMarkAtkMult({ [key]: mk }, key);
        if (Math.abs(feA - beA) > 1e-9) abwAtk.push({ key, mk, fe:feA, be:beA });
        const feS = 1 + fe.shipMarkBonus(key,'shield');
        const beS = be.shipMarkShieldMult({ [key]: mk }, key);
        if (Math.abs(feS - beS) > 1e-9) abwShield.push({ key, mk, fe:feS, be:beS });
      }
    }
    check('Angriffsfaktor stimmt fuer JEDE Klasse und Stufe zwischen Frontend und Backend',
      abwAtk.length === 0, abwAtk.slice(0, 4));
    // Bis 01.08.2026 verglich diese Zeile den SCHILD des Frontends gegen die ANGRIFFS-Funktion des
    // Backends. Das fiel nie auf, weil beide Felder auf 0,03 standen - mit unterschiedlichen Werten
    // waere daraus ein stiller Fehlalarm bzw. eine uebersehene Abweichung geworden.
    check('Schildfaktor stimmt fuer JEDE Klasse und Stufe ueberein',
      abwShield.length === 0, abwShield.slice(0, 4));
    check('Gegenprobe: es wurden wirklich viele Klassen geprueft', alleKeys.length >= 20, alleKeys.length);
    // Und die Abweichungen muessen im Backend WIRKLICH ankommen - sonst waere die Gleichheit oben
    // nur deshalb erfuellt, weil beide Seiten flach 0,03 rechnen.
    check('das Backend rechnet dem Bomber mehr Angriff zu als dem Frachter',
      be.shipMarkAtkMult({ bomber:10 }, 'bomber') > be.shipMarkAtkMult({ frachter:10 }, 'frachter'),
      { bomber: be.shipMarkAtkMult({ bomber:10 },'bomber'), frachter: be.shipMarkAtkMult({ frachter:10 },'frachter') });
    check('das Backend rechnet dem Schlachtschiff mehr Schild zu als dem Jaeger',
      be.shipMarkShieldMult({ schlachtschiff:10 }, 'schlachtschiff') > be.shipMarkShieldMult({ jaeger:10 }, 'jaeger'),
      { schlacht: be.shipMarkShieldMult({ schlachtschiff:10 },'schlachtschiff'), jaeger: be.shipMarkShieldMult({ jaeger:10 },'jaeger') });
    check('Backend kennt eine Sanity-Grenze fuer shipMarks',
      /maxShipMark/.test(beSrc) && /Werftmarke "/.test(beSrc));
    check('Backend liest shipMarks aus dem Spielstand',
      /rawFleetPower\([^)]*save\.shipMarks\)/.test(beSrc));
  }
  state.shipMarks = {};
}

// ---------------------------------------------------------------- 7. Regel 6: Anzeigestellen
const statAufrufe = [...src.matchAll(/shipStatBarsHtml\(([^;]*?)\)\}/g)].map(m => m[1]);
check('shipStatBarsHtml wird an mindestens zwei Stellen aufgerufen', statAufrufe.length >= 2, statAufrufe.length);
check('JEDER shipStatBarsHtml-Aufruf gibt einen Schiffsschluessel mit (sonst zeigt er den Grundwert)',
  statAufrufe.every(a => a.split(',').length >= 5), statAufrufe.filter(a => a.split(',').length < 5));

// Die fuenf Rechenstellen muessen die Marke tatsaechlich lesen.
const rechenstellen = [
  // Seit v8.354.0 hat dm() einen ohneMarken-Schalter fuer die Bericht-Anzeige - der Markenfaktor
  // steht weiterhin genau hier, nur eben hinter der Abfrage.
  ['Angriff (attackPowerRaw)', /const dm = \(key, count\) => diminishingShipCount\(count\|\|0\) \* \(ohneMarken \? 1 : \(1 \+ shipMarkBonus\(key,'atk'\)\)\)/],
  ['Schild (defensePower)', /shipMarkBonus\(def\.key, 'shield'\)/],
  ['Tempo (effectiveShipSpeed)', /speed \*= \(1 \+ shipMarkBonus\(shipKey, 'speed'\)\)/],
  ['Treibstoff (fleetFuelModuleMult)', /shipMarkBonus\(k, 'fuel'\)/],
  ['Bauzeit (effectiveBuildTimeEach)', /shipMarkBonus\(shipKey, 'buildTime'\)/]
];
for (const [name, re] of rechenstellen) check('Rechenstelle verdrahtet: '+name, re.test(src));
check('Superschlachtschiff bekommt seine Marke in der Verteidigung eigens (steht nicht in SHIP_DEFS)',
  /shipMarkBonus\('superschlachtschiff','atk'\)/.test(src));

// ---------------------------------------------------------------- 8. Persistenz und Deckel (Fund 5)
check('shipMarks bekommt einen Default in applyStateDefaults',
  /if \(!state\.shipMarks \|\| typeof state\.shipMarks !== 'object'\) state\.shipMarks = \{\};/.test(src));
check('applyStateDefaults deckelt ueberhoehte Werte',
  /state\.shipMarks\[k\] = Math\.min\(SHIP_MARK_MAX, Math\.floor\(v\)\)/.test(src));
check('Marken ueberleben das Prestige', /const keepShipMarks = state\.shipMarks;/.test(src) && /shipMarks:keepShipMarks\|\|\{\}/.test(src));

// ---------------------------------------------------------------- 9. Bedienung und Text
check('Werft hat einen Aufruest-Knopf', /data-shipmark="/.test(src));
check('Aufruest-Knopf hat einen Handler', /\[data-shipmark\]/.test(src));
check('Kauf prueft das Forschungstor', /if \(!shipMarkGateOpen\(ziel\)\)/.test(src));
check('Kauf prueft die Bezahlbarkeit und zieht den Fund ab',
  /if \(!canAfford\(cost\)\) return;[\s\S]{0,60}pay\(cost\);[\s\S]{0,200}state\.shipMarkJob = \{ key, ziel,/.test(src)
  && /state\.rareItems\[item\.key\] = \(state\.rareItems\[item\.key\]\|\|0\) - item\.n;/.test(src));
// Reihenfolge ist wichtig: Erst pruefen, dann bezahlen. Andersherum waeren die Ressourcen weg und
// die Marke trotzdem nicht da.
const kaufBlock = src.slice(src.indexOf("data-shipmark]"), src.indexOf("data-shipmark]") + 2000);
check('der Fund wird VOR der Bezahlung geprueft',
  kaufBlock.indexOf('item.have < item.n') > 0 && kaufBlock.indexOf('item.have < item.n') < kaufBlock.indexOf('pay(cost)'));
check('Werftkarte zeigt den Fund mit Bestand', /vorhanden: \$\{item\.have\}/.test(src));
check('Werftkarte sperrt den Knopf ohne Fund und bei belegter Werft',
  /const kaufbar = gateOk && itemOk && bezahlbar && !werftBelegt;/.test(src));
check('Hilfe erklaert die Werftmarken', /title:'Werftmarken/.test(src));
check('Hilfe nennt den Konvoi-Haken beim Tempo', /langsamste<\/strong> beteiligte Schiff/.test(src));
// BEWUSST ohne feste Versionsnummer. Die erste Fassung dieses Tests prüfte auf '8.351.0' - und
// schlug schon beim naechsten Patch fehl, obwohl an den Werftmarken nichts kaputt war. Ein Test,
// der bei jeder Versionserhoehung rot wird, erzieht dazu, ihn wegzuklicken. Geprueft wird
// stattdessen die Eigenschaft, um die es geht: dass VERSION und neuester Eintrag zusammenpassen
// und dass die Werftmarken in den Patchnotes ueberhaupt vorkommen.
const dateiVersion = (src.match(/const VERSION = '([\d.]+)'/) || [])[1];
const neuesterEintrag = (src.match(/const PATCHNOTES = \[\s*\{ version:'([\d.]+)'/) || [])[1];
check('VERSION und neuester Patchnotes-Eintrag stimmen ueberein',
  !!dateiVersion && dateiVersion === neuesterEintrag, { version: dateiVersion, neuester: neuesterEintrag });
// Namentlich statt in einem festen Byte-Fenster ab dem Array-Anfang - siehe die Begruendung in
// test_abgrund_module2.js: Das Array waechst nach oben, das Fenster rutscht vorbei. Geprueft wird
// der Einfuehrungs-Eintrag v8.350.0 selbst, nicht "irgendwo steht Werftmarke" (das erfuellt
// inzwischen jeder spaetere Eintrag, der sie nur erwaehnt).
const pn350 = src.indexOf("{ version:'8.350.0'");
check('der Einfuehrungs-Eintrag v8.350.0 existiert noch', pn350 > 0);
check('die Werftmarken sind in den Patchnotes dokumentiert',
  pn350 > 0 && /Werftmarke/.test(src.slice(pn350, src.indexOf("{ version:'8.349.0'", pn350))));

// ---------------------------------------------------------------- 10. Grafik
// Seit dem 01.08.2026 nimmt der Maler eine Uebersteuerung entgegen: Im Profil eines FREMDEN
// Spielers wurde dessen Flotte sonst mit den Marken des eigenen Kontos gezeichnet. Ohne
// Uebersteuerung gilt weiterhin die eigene Stufe - genau das prueft die zweite Zeile.
check('Maler nimmt eine Marken-Uebersteuerung entgegen',
  /function drawShipMiniIcon\(key, canvas, markOverride(, \w+)?\)\{/.test(src));
check('Maler liest ohne Uebersteuerung die Marke selbst aus dem Zustand',
  /\(typeof markOverride === 'number'\) \? markOverride[\s\S]{0,120}shipMarkOf\(key\)/.test(src));
check('Zusatzturm wird gegen den Rumpf geprueft (nichts schwebt daneben)',
  /if \(pointInHull\(cfg\.pts, k\[0\], k\[1\]\)\) turrets\.push\(k\)/.test(src));
check('Sensormast sitzt auf der echten Oberkante', /hullTopAt\(cfg\.pts, mxU/.test(src));
check('Plakette traegt die Stufe in Listengroesse', /SHIP_MARK_ROMAN\[mk-1\]/.test(src) && /fillText\(rz, bx-1, by\)/.test(src));
// Alle neun sichtbaren Schritte muessen tatsaechlich im Maler vorkommen - eine Stufe ohne
// Zeichenaenderung waere eine bezahlte Stufe, die nichts zeigt.
for (const stufe of [2,3,4,5,6,7,8,9,10]){
  check('Maler reagiert auf Mk '+fe.SHIP_MARK_ROMAN[stufe-1], new RegExp('mk *>= *'+stufe+'\\b').test(src));
}

// ---------------------------------------------------------------- 11. Aufruestzeit (v8.353.0)
// Was hier still danebengehen kann:
//   a) EINE STUFE, DIE LAENGER DAUERT ALS DER SPIELER WACH IST. Die Kosten skalieren voll mit dem
//      Klassenfaktor (bis 20). Wuerde die ZEIT das auch tun, waere der letzte Schritt eines
//      Fusionsdreadnoughts ein Mehrtagesauftrag - und die schwersten Klassen, fuer die man Marken
//      am ehesten kauft, waeren die unattraktivsten. Deshalb gedaempft (Exponent < 1) und gedeckelt.
//   b) EINE MARKE, DIE SICH SELBST BESCHLEUNIGT. shipMarkDuration() darf den shipKey NICHT an
//      effectiveBuildTimeEach() durchreichen, sonst zieht der Bauzeit-Rabatt der Marke auf ihre
//      eigene Aufruestung.
//   c) EIN AUFTRAG, DER OFFLINE STEHENBLEIBT. Ohne Aufruf im Nachholpfad waere ein ueber Nacht
//      faelliger Umbau erst beim ersten sichtbaren Tick fertig - die Nacht waere verschenkt.
//   d) EIN ABBRUCH, DER state.resources.credits ERFINDET. pay() legt Kredite und Bergungsgut
//      ausserhalb von state.resources ab; ein pauschales += wuerde dort ein Feld erzeugen, das die
//      Backend-Sanity-Pruefung sieht - und eine Ablehnung friert das Speichern KOMPLETT ein.
check('Zeitkonstanten vorhanden', typeof fe.SHIP_MARK_TIME_BASE === 'number' && fe.SHIP_MARK_TIME_STEP > 1);
check('die Zeit skaliert gedaempfter mit der Klasse als die Kosten (Exponent < 1)',
  fe.SHIP_MARK_TIME_CLASS_EXP > 0 && fe.SHIP_MARK_TIME_CLASS_EXP < 1, fe.SHIP_MARK_TIME_CLASS_EXP);
// Ohne planetKey rechnet shipMarkDuration die Rohdauer - genau das, was hier geprueft werden soll.
for (const k of ['jaeger','schlachtschiff','fusionsdreadnought']){
  let vorher = 0, summe = 0;
  for (let ziel = 2; ziel <= fe.SHIP_MARK_MAX; ziel++){
    const d = fe.shipMarkDuration(k, ziel);
    check(k+' Mk '+fe.SHIP_MARK_ROMAN[ziel-1]+' dauert laenger als die Stufe davor', d > vorher, d);
    check(k+' Mk '+fe.SHIP_MARK_ROMAN[ziel-1]+' bleibt unter dem Einzelschritt-Deckel',
      d <= fe.SHIP_MARK_TIME_CAP, d);
    vorher = d; summe += d;
  }
  // Zeitfenster des ganzen Weges. Angehoben am 01.08.2026 (Spieler-Rueckmeldung "Verbesserungs-
  // zeiten zu gering"): vorher galt "unter 24 Stunden", jetzt liegt schon der Jaeger bei rund
  // 20 Stunden und der Fusionsdreadnought bei gut zwei Tagen.
  //
  // Geprueft wird bewusst eine SPANNE, keine Punktzahl: Eine feste Zahl waere bei jedem Balance-
  // Eingriff rot geworden, ohne dass etwas kaputt ist - genau daran ist dieser Test heute
  // gescheitert. Die Grenzen sagen, was die Mechanik leisten soll: lange genug, dass Mk X ein
  // mehrtaegiges Ziel bleibt, kurz genug, dass es keine Mauer wird.
  const stunden = summe/3600;
  check(k+': Mk I -> Mk X dauert mindestens 12 Stunden (sonst keine echte Senke)', stunden >= 12,
    Math.round(stunden*10)/10 + ' h');
  check(k+': Mk I -> Mk X dauert hoechstens 5 Tage (sonst eine Mauer)', stunden <= 120,
    Math.round(stunden*10)/10 + ' h');
}
check('der Fusionsdreadnought braucht weniger als das Fuenffache eines Jaegers (gedaempft)',
  fe.shipMarkDuration('fusionsdreadnought', 10) < 5 * fe.shipMarkDuration('jaeger', 10),
  { jaeger: fe.shipMarkDuration('jaeger', 10), dread: fe.shipMarkDuration('fusionsdreadnought', 10) });
check('die Marke beschleunigt ihre eigene Aufruestung NICHT (kein shipKey an effectiveBuildTimeEach)',
  /effectiveBuildTimeEach\('ship', planetKey, roh\)/.test(src));
check('Werft-Boni wirken trotzdem (planetKey wird durchgereicht)',
  /const dauer = shipMarkDuration\(key, ziel, state\.activeBasePlanet\)/.test(src));

// ---------------------------------------------------------------- Werftkonvoi (v8.373.0)
// Das befristete Allianz-Projekt halbiert die Umbauzeit. Es steht hier und nicht in einem eigenen
// Test, weil es GENAU DIESE Groesse anfasst - eine Aenderung an der Markendauer, die den Konvoi
// vergisst, faellt so an derselben Stelle auf wie jede andere.
{
  const ohne = fe.shipMarkDuration('jaeger', 5);
  konvoiRest = 3600 * 1000;                     // laeuft noch eine Stunde
  const mit = fe.shipMarkDuration('jaeger', 5);
  konvoiRest = 0;
  const wieder = fe.shipMarkDuration('jaeger', 5);
  check('Werftkonvoi: laufender Konvoi halbiert die Umbauzeit', mit === Math.round(ohne * 0.5), { ohne, mit });
  check('Werftkonvoi: ohne Konvoi wieder die volle Dauer', wieder === ohne, { ohne, wieder });
  // Gegenprobe, dass die Injektion ueberhaupt greift - saehe der Sandkasten den Konvoi gar nicht,
  // waeren beide Werte gleich und die Pruefung darueber waere eine Tautologie.
  check('Werftkonvoi: die Injektion wirkt wirklich (beide Werte unterscheiden sich)', mit !== ohne, { ohne, mit });
}

// Auftrag, Tick und Offline-Nachholpfad
check('der Kauf startet einen Auftrag statt die Marke sofort zu setzen',
  /state\.shipMarkJob = \{ key, ziel, startedAt: Date\.now\(\), endsAt: Date\.now\(\) \+ dauer\*1000/.test(src));
check('es laeuft nur EIN Umbau gleichzeitig', /const laeuft = shipMarkJob\(\);[\s\S]{0,80}if \(laeuft\)\{/.test(src));
check('processShipMarkJob setzt die Marke erst bei Faelligkeit',
  /if \(!j \|\| Date\.now\(\) < j\.endsAt\) return false;/.test(src));
check('processShipMarkJob laeuft im Haupt-Tick', /const markDone = processShipMarkJob\(\);/.test(src));
check('processShipMarkJob laeuft AUCH im Offline-Nachholpfad',
  src.split('processShipMarkJob()').length - 1 >= 3);
check('shipMarkJob bekommt einen Default in applyStateDefaults',
  /if \(state\.shipMarkJob === undefined\) state\.shipMarkJob = null;/.test(src));
check('ein kaputter oder uralter Auftrag wird beim Laden verworfen statt stehenzubleiben',
  /if \(!gueltig\) state\.shipMarkJob = null;/.test(src));
// Regel 6: Der Umbau laeuft offline mit - dann muss ihn auch der Rueckkehrbericht nennen. Ein
// gezaehltes Feld, das nirgends ankommt, ist die typische zweite Anzeigestelle dieses Projekts.
check('der Offline-Bericht bekommt die Umbauten durchgereicht',
  /markenUmbauten: queues\.markenUmbauten\|\|0/.test(src));
check('der Offline-Bericht zeigt sie auch an', /offlineSummary\.markenUmbauten>0/.test(src));

// Abbruch mit vollstaendiger Rueckgabe - und ohne erfundenes Zahlenfeld.
const abbruch = src.slice(src.indexOf('[data-shipmark-cancel]'), src.indexOf('[data-shipmark-cancel]') + 1400);
check('Abbrechen gibt die Ressourcen zurueck', /state\.resources\[r\] = \(state\.resources\[r\]\|\|0\) \+ v;/.test(abbruch));
check('Abbrechen behandelt Kredite und Bergungsgut wie pay() – kein state.resources.credits',
  /if \(r === 'credits'\) state\.credits/.test(abbruch) && /r === 'bergung'/.test(abbruch));
check('Abbrechen gibt auch den Expeditionsfund zurueck',
  /state\.rareItems\[j\.item\.key\] = \(state\.rareItems\[j\.item\.key\]\|\|0\) \+ j\.item\.n;/.test(abbruch));
check('Abbrechen loescht den Auftrag', /state\.shipMarkJob = null;/.test(abbruch));

// Anzeige (Regel 6): Dauer am Kaufknopf, Restzeit waehrend des Umbaus, Grund bei fremder Belegung.
check('die Kaufzeile nennt die Dauer neben dem Preis', /costHtml\(cost\)\} · <i class="ti ti-clock"[^>]*><\/i> \$\{fmtDuration\(dauer\)\}/.test(src));
check('die laufende Karte zeigt Restzeit und Fortschrittsbalken',
  /noch \$\{fmtDuration\(rest\/1000\)\}/.test(src) && /class="mark-fortschritt"/.test(src));
check('andere Klassen sagen, warum ihr Knopf grau ist', /es läuft immer nur ein Umbau/.test(src));
check('die Hilfe erklaert die Aufruestzeit', /<strong>Ein Umbau braucht Zeit<\/strong>/.test(src));
check('die Hilfe nennt den Ein-Umbau-Grundsatz und die volle Rueckgabe',
  /ein Umbau gleichzeitig<\/strong>/.test(src) && /Abbrechen geht jederzeit und gibt alles zurück<\/strong>/.test(src));

// ---------------------------------------------------------------- 12. Marken im Kampfbericht (v8.354.0)
// Die Marken flossen seit v8.350.0 in jede Kampfrechnung ein, aber kein Bericht sagte es. Was hier
// still danebengehen kann:
//   a) EIN KAMPFPFAD OHNE STEMPEL. Es gibt zwoelf Stellen, an denen ein Kampfbericht gebaut wird.
//      Der Markenstand wird deshalb an der EINEN Stelle gesetzt, durch die alle laufen (pushReport).
//   b) DIE FALSCHE FLOTTE GESTEMPELT. Bei einem Ueberfall steht unter report.fleet die Flotte der
//      ANGREIFER - ein pauschaler Stempel haette dem Spieler seine eigenen Marken auf den Gegner
//      geschrieben. Die eigene Flotte ist dort stationedFleet.
//   c) DER HEUTIGE STAND IN EINEM ALTEN BERICHT. Wird der Stand beim LESEN ermittelt statt beim
//      Austragen, wird eine mit Mk III gewonnene Schlacht nach dem naechsten Umbau zum Mk-IV-Sieg.
//   d) EINE ZWEITE, NACHGEBAUTE PROZENTFORMEL. Sie waere beim naechsten neuen Schiff still falsch.
//      Der Anteil kommt aus zwei Durchlaeufen DERSELBEN Funktion.
//   e) NUR DER BERICHT, NICHT DIE VORSCHAU (Regel 6).
check('attackPowerRaw kann markenlos rechnen (ein Schalter, keine zweite Kopie)',
  /function attackPowerRaw\(fleet, ohneMarken\)/.test(src)
  && /\(ohneMarken \? 1 : \(1 \+ shipMarkBonus\(key,'atk'\)\)\)/.test(src));
check('shipDefenseContribution ebenso', /function shipDefenseContribution\(fleet, ohneMarken\)/.test(src));
check('der Angriffsanteil kommt aus zwei Durchlaeufen derselben Funktion',
  /const mit = attackPowerRaw\(fleet\), ohne = attackPowerRaw\(fleet, true\);/.test(src));
check('der Verteidigungsanteil ebenso (Marke wirkt dort ueber atk UND Schild)',
  /const mit = shipDefenseContribution\(fleet\), ohne = shipDefenseContribution\(fleet, true\);/.test(src));
check('es gibt eine Momentaufnahme des Markenstands', /function fleetMarksSnapshot\(fleet\)/.test(src));
check('und eine Berichtszeile dafuer', /function markReportLine\(marken, anteil, groesse\)/.test(src));
// (a) Der Stempel sitzt an der einen Stelle, durch die jeder Bericht laeuft.
check('der Markenstand wird zentral in pushReport gestempelt',
  /async function pushReport\(report\)\{\s*stampShipMarks\(report\);/.test(src));
check('stampShipMarks existiert genau einmal',
  (src.match(/function stampShipMarks\(/g) || []).length === 1);
// (b) Beim Ueberfall ist die eigene Flotte die stationierte, nicht report.fleet.
check('beim Ueberfall wird die STATIONIERTE Flotte gestempelt, nicht die der Angreifer',
  /else if \(report\.type === 'raid'\) eigene = report\.stationedFleet;/.test(src));
check('und dort zaehlt der Verteidigungsanteil',
  /report\.type === 'raid'\s*\?\s*fleetMarkDefShare\(eigene\) : fleetMarkAtkShare\(eigene\)/.test(src));
// (c) Gespeichert, nicht beim Lesen gerechnet.
check('der Anteil wird im Bericht gespeichert', /report\.markAtkShare = Math\.round\(/.test(src));
check('die Berichtszeile liest den gespeicherten Stand', /markReportLine\(r\.marken, r\.markAtkShare/.test(src));
// (e) Alle Kampfberichte und die Vorschau. Seit v8.430.0 zeigen auch die beiden Verbandsberichte
// (Allianz-Raid, Musterangriff) die Zeile - dort stempelt stampShipMarks ueber myComposition,
// weil report.fleet die GEMEINSAME Verbandsflotte ist und die Marken auf die eigene gehoeren.
const berichte = (src.match(/markReportLine\(r\.marken, r\.markAtkShare/g) || []).length;
check('alle sechs Kampfberichte zeigen die Zeile (NPC, Spieler, Allianzbasis, Ueberfall, Raid, Musterangriff)',
  berichte === 6, berichte);
check('der Ueberfall-Bericht nennt ausdruecklich die Flottenverteidigung',
  /markReportLine\(r\.marken, r\.markAtkShare, 'Flottenverteidigung'\)/.test(src));
/* MITGEZOGEN AM 22.08.2026 (E1b) - und dabei SCHAERFER geworden, nicht passend gemacht.
   Hier stand die WORTFORM `const markenPreview = totalSelected > 0 ? fleetMarksSnapshot(...)`,
   also die Zeile, in der die Marken-Vorschau inline im Galaxie-Reiter berechnet wurde. Seit E1b
   liegt die Rechnung in npcKampfLage(), weil die KARTE dieselben Zahlen braucht - die Zeile gibt
   es dort nicht mehr, und die Pruefung fiel auf voellig korrektem Code durch (Arbeitsregel 3).
   Der eigentliche Punkt ist derselbe wie bei test_enterung: Bis E1b nannte NUR der Galaxie-Reiter
   die Marken. Geprueft wird deshalb die Eigenschaft (die Rechnung existiert und weist sie als
   eingerechnet aus) UND ihre Reichweite (beide Angriffs-Vorschauen zeigen sie). */
check('auch die NPC-Angriffsvorschau nennt die Marken',
  /const marken = gewaehlt > 0 \? fleetMarksSnapshot\(f\) : null;/.test(src)
  && /markAnteil: marken \? fleetMarkAtkShare\(f\) : 0/.test(src)
  && /bereits eingerechnet/.test(src));
{
  /* Die Reichweite: Kartenvorschau UND Galaxie-Reiter zeichnen die Marken-Zeile. `Werftmarken: ${`
     kommt gemessen genau an diesen beiden Stellen vor - der Kampfbericht baut dieselbe Liste in
     einer anderen Form und ist hier bewusst nicht mitgezaehlt. */
  const n = (src.match(/Werftmarken: \$\{/g) || []).length;
  check('und zwar in BEIDEN Angriffs-Vorschauen', n === 2, { stellen: n });
}
check('die Hilfe sagt, dass Vorschau und Bericht sie ausweisen',
  /<strong>Im Kampf sind sie ausgewiesen:<\/strong>/.test(src));

// ---------------------------------------------------------------- 13. Marken im Punktestand (v8.355.0)
// Ein Mk X-Jaeger zaehlte im Punktestand exakt so viel wie ein Mk I-Jaeger. Woran das jetzt still
// danebengehen kann:
//   a) DER SERVER RECHNET ANDERS. computeScoreServer() prueft den Punktestand nach und
//      UEBERSCHREIBT den eingereichten Wert. Ohne den Nachzug dort waere die Frontend-Aenderung
//      wirkungslos - die Bestenliste zeigte weiter den alten Wert. Genau dieser Fallstrick
//      ("Backend-Kopie mitpflegen") hat bei SHIP_SCORE_WEIGHTS schon zweimal zugeschlagen.
//   b) DER ZUSCHLAG LECKT IN DIE ANDEREN NUTZER DERSELBEN TABELLE. SHIP_SCORE_WEIGHTS bestimmt auch
//      Truemmerfeld-Masse, Prisengut und die Kaper-Obergrenze. Dort darf die Marke NICHT wirken:
//      Das Truemmerfeld eines abgeschossenen Raiders haengt nicht an MEINEN Marken, und eine
//      markenabhaengige Kapergrenze machte eine Klasse allein durchs Aufruesten unkaperbar.
//   c) EINE ZWEITE PUNKTE-ZAHL. Der Zuschlag wird aus SHIP_MARK_PER_STEP.atk gelesen; eine eigene
//      Konstante daneben liefe beim naechsten Balance-Eingriff still auseinander.
//   d) EIN UNERKLAERTER PUNKTESPRUNG. Wird eine Marke fertig, springt der Punktestand - ohne Zeile
//      im Punkteprotokoll waere das der einzige Sprung im Spiel ohne Begruendung.
check('shipScoreWeight existiert und nutzt den atk-Markenanteil',
  /function shipScoreWeight\(key\)\{\s*return \(SHIP_SCORE_WEIGHTS\[key\]\|\|0\) \* \(1 \+ shipMarkBonus\(key,'atk'\)\);/.test(src));
check('der Punktestand rechnet mit dem Markengewicht',
  /total \+= \(f\[key\]\|\|0\) \* shipScoreWeight\(key\)/.test(src)
  && /total \+= \(away\[key\]\|\|0\) \* shipScoreWeight\(key\)/.test(src));
check('die Aufschluesselung nennt die Marke mit', /\(mk>1\?' \(Mk '\+SHIP_MARK_ROMAN\[mk-1\]\+'\)':''\)/.test(src));
check('ein fertig gebautes Schiff meldet die Punkte MIT Marke',
  /const weight = shipScoreWeight\(job\.key\);/.test(src));
check('ein fertiger Umbau erscheint im Punkteprotokoll',
  /const punkteVorher = computeShipScoreTotal\(\);/.test(src)
  && /logScoreChange\(punkteDelta, def\.name\+' auf Werftmarke Mk '/.test(src));
// (b) Die anderen Nutzer der Tabelle bleiben markenfrei.
check('die Kaper-Obergrenze bleibt am Grundgewicht',
  /function isBoardable\(shipKey\)\{ return \(SHIP_SCORE_WEIGHTS\[shipKey\]\|\|999\) <= BOARD_MAX_SHIP_WEIGHT; \}/.test(src));
check('die Truemmerfeld-Masse bleibt am Grundgewicht',
  !/debrisWeight \+= [^\n]*shipScoreWeight/.test(src));
check('das Prisengut bleibt am Grundgewicht',
  /ergebnis\.prisengut \+= nimm \* \(SHIP_SCORE_WEIGHTS\[k\]\|\|10\) \* PRISENGUT_PER_WEIGHT;/.test(src));

// (a) Backend-Spiegel. Nutzt denselben bePfad wie Abschnitt 6 - ein zweiter Suchpfad daneben waere
// genau die Sorte Zweitfassung, die dieses Projekt vermeidet. Ohne Backend wird uebersprungen.
if (!bePfad){
  console.log('SKIP - Backend nicht im Arbeitsbereich, Punktestand-Spiegel ausgelassen');
} else {
  const be = fs.readFileSync(bePfad, 'utf8');
  check('BE: computeScoreServer zieht den Markenfaktor',
    /shipScore \+= \(f\[key\] \|\| 0\) \* weight \* shipMarkAtkMult\(marks, key\);/.test(be));
  check('BE: und liest die Marken aus dem gespeicherten Spielstand', /const marks = save\.shipMarks;/.test(be));
  // Beim Nachziehen der Marken aufgefallen: Der Server kannte den Abgrund gar nicht und hat den
  // eingereichten Punktestand jedem Taucher nach unten korrigiert (50 Punkte je Rekordtiefe seit
  // v8.343.0). Der Test haelt fest, dass beide Seiten dieselbe Zahl verwenden.
  const feJeTiefe = (src.match(/const ABGRUND_SCORE_JE_TIEFE = (\d+);/) || [])[1];
  const beJeTiefe = (be.match(/const ABGRUND_SCORE_JE_TIEFE = (\d+);/) || [])[1];
  check('BE: die Rekordtiefe zaehlt serverseitig mit', !!beJeTiefe && feJeTiefe === beJeTiefe,
    { frontend: feJeTiefe, backend: beJeTiefe });
  check('BE: und geht in die Summe ein', /\+ expansionScore \+ abgrundScore \+/.test(be));
  // FE und BE muessen fuer dieselbe Flotte dieselbe Punktzahl liefern - sonst ueberschreibt der
  // Server den eingereichten Wert mit einer anderen Zahl, und der Spieler sieht in der Bestenliste
  // etwas anderes als in seinem Spiel.
  const beWeights = new Function(be.slice(be.indexOf('const SHIP_SCORE_WEIGHTS = {'),
    be.indexOf('};', be.indexOf('const SHIP_SCORE_WEIGHTS = {')) + 2) + '; return SHIP_SCORE_WEIGHTS;')();
  const feWeights = new Function(src.slice(src.indexOf('const SHIP_SCORE_WEIGHTS = {'),
    src.indexOf('};', src.indexOf('const SHIP_SCORE_WEIGHTS = {')) + 2) + '; return SHIP_SCORE_WEIGHTS;')();
  const beAtkPerStep = Number((be.match(/const SHIP_MARK_ATK_PER_STEP = ([\d.]+);/) || [])[1]);
  check('FE und BE nutzen denselben Zuschlag je Stufe',
    beAtkPerStep === fe.SHIP_MARK_PER_STEP.atk, { fe: fe.SHIP_MARK_PER_STEP.atk, be: beAtkPerStep });
  let ungleich = [];
  for (const k of Object.keys(feWeights)){
    for (let mk = 1; mk <= fe.SHIP_MARK_MAX; mk++){
      const feP = feWeights[k] * (1 + (mk-1) * fe.SHIP_MARK_PER_STEP.atk);
      const beP = (beWeights[k]||0) * (1 + (mk-1) * beAtkPerStep);
      if (Math.abs(feP - beP) > 1e-9) ungleich.push(k+'@Mk'+mk);
    }
  }
  check('FE und BE liefern fuer jede Klasse und jede Marke dieselbe Punktzahl',
    ungleich.length === 0, ungleich.slice(0, 5));
}

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
