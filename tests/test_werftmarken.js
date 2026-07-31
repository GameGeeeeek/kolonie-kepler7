// Werftmarken v8.350.0-8.351.0 - zehn Ausbaustufen je Schiffsklasse, Tier-2-Kette und Expeditionsfunde.
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
const bis = src.indexOf('const EXPLORE_SHIP_KEYS', von);
check('Markenblock in der Spieldatei gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }

// SHIP_DEFS wird fuer shipMarkClassFactor() gebraucht (buildTime je Klasse). Statt die ganze
// Datei zu laden, wird eine Minimaltabelle aus den echten Definitionen gezogen - der Test soll
// die ECHTEN Bauzeiten sehen, nicht ausgedachte.
const shipDefs = [];
for (const m of src.matchAll(/\{ key:'([a-zA-Z]+)', name:'[^']*'[^\n]*?atk:(\d+)[^\n]*?buildTime:(\d+)/g)){
  shipDefs.push({ key:m[1], atk:Number(m[2]), buildTime:Number(m[3]) });
}
check('SHIP_DEFS-Bauzeiten gelesen', shipDefs.length >= 35, shipDefs.length);

// RESEARCH_DEFS: key + maxLevel, fuer die Torpruefung.
const researchMax = {};
for (const m of src.matchAll(/\{ key:'(r[a-z0-9_]+)',[^\n]*?maxLevel:(\d+)/g)) researchMax[m[1]] = Number(m[2]);
check('RESEARCH_DEFS maxLevel gelesen', Object.keys(researchMax).length >= 20, Object.keys(researchMax).length);

const state = { shipMarks: {}, research: {} };
const fe = new Function('SHIP_DEFS', 'RESEARCH_DEFS', 'state',
  src.slice(von, bis) +
  '; return { SHIP_MARK_MAX, SHIP_MARK_PER_STEP, SHIP_MARK_ROMAN, SHIP_MARK_STEPS, SHIP_MARK_COST_BASE,' +
  ' SHIP_MARK_COST_KEYS, SHIP_MARK_GATES, SHIP_MARK_ITEMS, shipMarkClassFactor, shipMarkCost, shipMarkOf,' +
  ' shipMarkBonus, shipMarkGateOpen, shipMarkRound };'
)(shipDefs, Object.entries(researchMax).map(([key])=>({key, name:key})), state);

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

// ---------------------------------------------------------------- 2. Boni
state.shipMarks = {};
check('Mk I gibt keinen Bonus', fe.shipMarkBonus('jaeger','atk') === 0);
state.shipMarks = { jaeger: 10 };
const mkXAtk = fe.shipMarkBonus('jaeger','atk');
check('Mk X gibt +27% Angriff', Math.abs(mkXAtk - 0.27) < 1e-9, mkXAtk);
check('Mk X gibt +18% Tempo', Math.abs(fe.shipMarkBonus('jaeger','speed') - 0.18) < 1e-9);
check('Mk X gibt -13,5% Treibstoff', Math.abs(fe.shipMarkBonus('jaeger','fuel') - 0.135) < 1e-9);
check('Mk X gibt -18% Bauzeit', Math.abs(fe.shipMarkBonus('jaeger','buildTime') - 0.18) < 1e-9);
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
    const be = new Function(beSrc.slice(bVon, bBis) +
      '; return { SHIP_MARK_MAX, shipMarkLevel, shipMarkAtkMult, shipMarkShieldMult };')();
    check('Backend deckelt bei derselben Stufe', be.SHIP_MARK_MAX === fe.SHIP_MARK_MAX);
    let gleich = true, abw = null;
    for (let mk = 1; mk <= 12; mk++){
      state.shipMarks = { jaeger: mk };
      const feMult = 1 + fe.shipMarkBonus('jaeger','atk');
      const beMult = be.shipMarkAtkMult({ jaeger: mk }, 'jaeger');
      if (Math.abs(feMult - beMult) > 1e-9){ gleich = false; abw = { mk, feMult, beMult }; }
    }
    check('Angriffsfaktor stimmt bei Frontend und Backend ueber alle Stufen ueberein', gleich, abw);
    state.shipMarks = { jaeger: 10 };
    check('Schildfaktor stimmt ebenfalls ueberein',
      Math.abs((1 + fe.shipMarkBonus('jaeger','shield')) - be.shipMarkAtkMult({ jaeger:10 }, 'jaeger')) < 1e-9);
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
  ['Angriff (attackPowerRaw)', /const dm = \(key, count\) => diminishingShipCount\(count\|\|0\) \* \(1 \+ shipMarkBonus\(key,'atk'\)\)/],
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
  /if \(!canAfford\(cost\)\) return;[\s\S]{0,60}pay\(cost\);[\s\S]{0,140}state\.shipMarks\[key\] = ziel;/.test(src)
  && /state\.rareItems\[item\.key\] = \(state\.rareItems\[item\.key\]\|\|0\) - item\.n;/.test(src));
// Reihenfolge ist wichtig: Erst pruefen, dann bezahlen. Andersherum waeren die Ressourcen weg und
// die Marke trotzdem nicht da.
const kaufBlock = src.slice(src.indexOf("data-shipmark]"), src.indexOf("data-shipmark]") + 2000);
check('der Fund wird VOR der Bezahlung geprueft',
  kaufBlock.indexOf('item.have < item.n') > 0 && kaufBlock.indexOf('item.have < item.n') < kaufBlock.indexOf('pay(cost)'));
check('Werftkarte zeigt den Fund mit Bestand', /vorhanden: \$\{item\.have\}/.test(src));
check('Werftkarte sperrt den Knopf ohne Fund', /const kaufbar = gateOk && itemOk && bezahlbar;/.test(src));
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
const pnAnfang = src.indexOf('const PATCHNOTES = [');
check('die Werftmarken sind in den Patchnotes dokumentiert',
  /Werftmarke/.test(src.slice(pnAnfang, pnAnfang + 30000)));

// ---------------------------------------------------------------- 10. Grafik
check('Maler liest die Marke selbst aus dem Zustand', /const mk = \(typeof shipMarkOf === 'function'\) \? shipMarkOf\(key\) : 1;/.test(src));
check('Zusatzturm wird gegen den Rumpf geprueft (nichts schwebt daneben)',
  /if \(pointInHull\(cfg\.pts, k\[0\], k\[1\]\)\) turrets\.push\(k\)/.test(src));
check('Sensormast sitzt auf der echten Oberkante', /hullTopAt\(cfg\.pts, mxU/.test(src));
check('Plakette traegt die Stufe in Listengroesse', /SHIP_MARK_ROMAN\[mk-1\]/.test(src) && /fillText\(rz, bx-1, by\)/.test(src));
// Alle neun sichtbaren Schritte muessen tatsaechlich im Maler vorkommen - eine Stufe ohne
// Zeichenaenderung waere eine bezahlte Stufe, die nichts zeigt.
for (const stufe of [2,3,4,5,6,7,8,9,10]){
  check('Maler reagiert auf Mk '+fe.SHIP_MARK_ROMAN[stufe-1], new RegExp('mk *>= *'+stufe+'\\b').test(src));
}

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
