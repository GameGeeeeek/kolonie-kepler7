// Das Herkunfts-Schloss (28.07.2026, v8.332.0).
//
// „Nur im Abgrund findbar" ist keine Eigenschaft, die ein Eintrag mitbringt - es ist eine
// Eigenschaft ALLER ANDEREN Fundquellen. Solange irgendeine davon blind aus dem vollen DEFS-Array
// zieht, ist jeder exklusive Inhalt am Tag seiner Einfuehrung auch im Markt, in Expeditionsfunden
// und in Allianz-Belohnungen.
//
// Vor v8.332.0 zogen SECHS Stellen zufaellig aus den Modul-Arrays, davon VIER ungefiltert -
// darunter grantAllianceMissionBonusModule(), das craftOnly- und Event-Module ausschuetten konnte,
// anders als grantRandomShipModule() zwei Bildschirme weiter.
//
// Dieser Test hat zwei Haelften, und die zweite ist die wichtigere:
//
//   A) HEUTE: fundPool() filtert wirklich, und zwar ausgefuehrt an eingeschleusten Testeintraegen -
//      nicht am Quelltext abgelesen.
//   B) MORGEN: Es gibt keine direkte Array-Ziehung mehr im ganzen Spiel. Das ist die eigentliche
//      Absicherung. Der Code oben laesst sich jederzeit korrekt schreiben; was schiefgeht, ist die
//      NAECHSTE Fundstelle, die jemand baut, ohne an die Filter zu denken. Ein Test, der nur das
//      Vorhandene prueft, faengt genau die nicht.
const fs = require('fs');
const path = require('path');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

const zeilenVon = (t) => t.split('\n');

let fail = false;
const check = (n, c, x) => { console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail = fail || !c; };

function fnAus(n){
  const m = js.match(new RegExp('function\\s+'+n+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+n);
  const i = js.indexOf(m[0]);
  let d = 0, s = js.indexOf('{', i + m[0].length), k = s;
  for (; k < js.length; k++){ if (js[k]==='{') d++; else if (js[k]==='}'){ d--; if(!d) break; } }
  return js.slice(i, k+1);
}

// ---- A) fundPool an eingeschleusten Eintraegen AUSFUEHREN ----
// Erfundene Eintraege statt der echten DEFS, weil sich nur so ALLE Faelle abdecken lassen - auch
// die Kombination Abgrund+craftOnly, die es im Spiel (noch) nicht gibt. Abschnitt C prueft dieselbe
// Funktion danach an den echten MODULE_DEFS; das eine ersetzt das andere nicht.
const G = new Function(`
  const HERKUNFT_NORMAL = 'normal';
  const HERKUNFT_ABGRUND = 'abgrund';
  ${fnAus('fundPool')}
  ${fnAus('zieheAusPool')}
  return { fundPool, zieheAusPool };
`)();

const PROBE = [
  { key:'a_normal' },                              // ohne Feld -> gilt als normal
  { key:'b_normal_ausdruecklich', quelle:'normal' },
  { key:'c_abgrund', quelle:'abgrund' },
  { key:'d_craft', craftOnly:true },
  { key:'e_event', eventKey:'winter' },
  { key:'f_abgrund_craft', quelle:'abgrund', craftOnly:true }
];
const keys = p => p.map(x => x.key);

const normal = G.fundPool(PROBE);
check('A: die Vorgabe liefert nur normale Eintraege - kein Abgrund, kein Craft, kein Event',
  JSON.stringify(keys(normal)) === JSON.stringify(['a_normal','b_normal_ausdruecklich']), keys(normal));
check('A: ein Eintrag OHNE quelle-Feld gilt als normal (Rueckwaertskompatibilitaet)',
  keys(normal).includes('a_normal'));
check('A: quelle:"abgrund" liefert nur die Abgrund-Eintraege',
  JSON.stringify(keys(G.fundPool(PROBE, { quelle:'abgrund' }))) === JSON.stringify(['c_abgrund']),
  keys(G.fundPool(PROBE, { quelle:'abgrund' })));
check('A: craft:true nimmt craftOnly dazu, aber weiterhin keinen Abgrund-Eintrag',
  JSON.stringify(keys(G.fundPool(PROBE, { craft:true }))) === JSON.stringify(['a_normal','b_normal_ausdruecklich','d_craft']),
  keys(G.fundPool(PROBE, { craft:true })));
check('A: event:true nimmt Event-Eintraege dazu',
  keys(G.fundPool(PROBE, { event:true })).includes('e_event'));
check('A: quelle:"alle" mit allen Schaltern liefert wirklich alles',
  G.fundPool(PROBE, { quelle:'alle', craft:true, event:true }).length === PROBE.length);
// Die Kombination ist der Fall, an dem eine schlampige Filterkette auffliegt: Abgrund UND craftOnly.
check('A: ein Abgrund-Eintrag mit craftOnly faellt auch bei quelle:"abgrund" ohne craft:true raus',
  !keys(G.fundPool(PROBE, { quelle:'abgrund' })).includes('f_abgrund_craft'));

// zieheAusPool muss aus DEMSELBEN Pool ziehen - eine eigene Filterlogik dort waere die zweite
// Wahrheit, die dieser ganze Umbau abschaffen soll.
const gezogen = new Set();
for (let i = 0; i < 400; i++){
  const z = G.zieheAusPool(PROBE);
  if (z) gezogen.add(z.key);
}
check('A: zieheAusPool zieht ueber 400 Versuche NIE etwas ausserhalb des Pools',
  [...gezogen].every(k => ['a_normal','b_normal_ausdruecklich'].includes(k)), [...gezogen]);
check('A: und es erreicht dabei jeden Eintrag des Pools (kein toter Eintrag)',
  gezogen.size === 2, [...gezogen]);
check('A: ein leerer Pool liefert null statt undefined-Absturz',
  G.zieheAusPool([{ key:'x', quelle:'abgrund' }]) === null);

// ---- B) Es gibt keine direkte Array-Ziehung mehr ----
// DAS ist die eigentliche Absicherung. Gesucht wird "IRGENDEIN_GROSSGESCHRIEBENES_ARRAY[Math.floor(
// Math.random" im ganzen Spiel-Quelltext. Bewusst NICHT auf *_DEFS eingeschraenkt: Der teuerste
// Befund dieser Runde hiess RARE_ITEMS und waere durch ein Muster auf "_DEFS" glatt durchgerutscht
// (zwoelf Ziehstellen, siehe Abschnitt D).
//
// Die Ausnahmeliste ist der heikle Teil dieses Tests. Sie darf nur Arrays enthalten, die
// nachweislich KEIN Fundpool sind - also nichts, was der Spieler als Gegenstand/Modul/Schiff/
// Material ins Inventar bekommt. Wer hier etwas eintraegt, um den Test gruen zu bekommen, hebelt
// genau die Absicherung aus, um derentwillen er existiert. Jeder Eintrag braucht deshalb einen
// Grund danebst.
const KEIN_FUNDPOOL = {
  RES_DEFS:                  'die 6 Kern-Ressourcen - welche einen Produktionsbonus bekommt',
  RANDOM_EVENTS:             'welches Zufallsereignis ausgeloest wird',
  PLANET_EVENT_DEFS:         'welches Planetenereignis ausgeloest wird',
  PLANET_BONUS_POOL:         'welchen Bonus ein neu entdeckter Planet traegt',
  RAID_FACTIONS:             'welche Fraktion einen Raid fliegt',
  PIRATE_DEBRIS_ESCORT_POOL: 'Zusammensetzung einer NPC-Eskorte, kein Spielerbesitz',
  EXPEDITION_SPECIAL_EVENTS: 'welches Sonderereignis die Expedition trifft',
  EXPEDITION_NOTHING_FLAVOR: 'reiner Anzeigetext',
  EXPEDITION_RESCUED_FLAVOR: 'reiner Anzeigetext',
  EXPEDITION_WEAKENED_FLAVOR:'reiner Anzeigetext',
  EXPEDITION_DEFENDED_FLAVOR:'reiner Anzeigetext'
};
const zeilen = js.split('\n');
const direkte = [];
for (const m of js.matchAll(/([A-Z][A-Z_0-9]{2,})\s*\[\s*Math\.floor\s*\(\s*Math\.random/g)){
  const zeile = js.slice(0, m.index).split('\n').length;
  if (zeilen[zeile-1].trim().startsWith('//')) continue;   // Erwaehnung im Kommentar ist keine Ziehung
  if (KEIN_FUNDPOOL[m[1]]) continue;
  direkte.push(m[1]+' (Zeile ~'+zeile+' im <script>)');
}
check('B: keine Stelle zieht mehr direkt aus einem Fundpool-Array', direkte.length === 0, direkte);

// Auch der Umweg ueber ein selbst gefiltertes Zwischenarray ist einer: Wer erst .filter(...) schreibt
// und das Ergebnis dann zufaellig indiziert, hat die Filterregeln von Hand nachgebaut - genau so sah
// randomFindableRareItem() bis v8.332.0 aus, und genau deshalb kannte es nur die chance-Regel und
// nicht die Herkunft.
const eigeneFilter = [];
for (const m of js.matchAll(/\.filter\([^\n]{0,160}?\)\s*\[\s*Math\.floor\s*\(\s*Math\.random/g)){
  eigeneFilter.push('~Zeile '+js.slice(0, m.index).split('\n').length);
}
check('B: niemand filtert von Hand und zieht dann selbst aus dem Ergebnis', eigeneFilter.length === 0, eigeneFilter);

// Die vier bekannten Fundfunktionen muessen den Pool wirklich benutzen.
const pflicht = ['grantRandomModule','grantRandomShipModule','grantAllianceMissionBonusModule','dailyModuleOffers'];
const ohnePool = pflicht.filter(n => !/(fundPool|zieheAusPool)\(/.test(fnAus(n)));
check('B: jede bekannte Fundfunktion zieht ueber den gemeinsamen Pool', ohnePool.length === 0, ohnePool);

// Der Nebenbefund: grantAllianceMissionBonusModule zog aus dem VOLLEN SHIP_MODULE_DEFS und
// ignorierte damit craftOnly/eventKey. Beide Zweige der Funktion muessen jetzt ueber den Pool laufen.
const allianz = fnAus('grantAllianceMissionBonusModule');
check('B: beide Zweige der Allianz-Belohnung (Schiffs- UND Standort-Modul) laufen ueber den Pool',
  (allianz.match(/zieheAusPool\(/g)||[]).length === 2,
  { aufrufe: (allianz.match(/zieheAusPool\(/g)||[]).length });

// Expeditionen sind eine normale Fundquelle und duerfen keine Abgrund-Gegenstaende ausschuetten.
check('B: der Expeditions-Itempool laeuft ueber fundPool',
  /const itemPool = fundPool\(ITEM_DEFS\)/.test(js));
// ...aber die Event-Gegenstaende muessen weiterhin dazukommen koennen, sonst waere ein Beute-Event
// wirkungslos - und DAS faellt erst auf, wenn das naechste laeuft.
check('B: waehrend eines Beute-Events kommen die Event-Gegenstaende weiterhin dazu',
  /activeLootEvent \? fundPool\(EVENT_ITEM_DEFS, \{ event:true \}\)/.test(js));

// ---- C) Die Sperre traegt echten Inhalt ----
// Bis v8.333.0 stand hier "noch traegt kein Eintrag quelle:'abgrund'" - Phase 0 war reine
// Infrastruktur. Seit v8.334.0 gibt es die ersten Abgrund-Module, und damit dreht sich die Pruefung
// um: Eine Sperre ohne Inhalt dahinter kann nicht falsch sein und beweist deshalb auch nichts.
const abgrundEintraege = (js.match(/quelle:\s*HERKUNFT_ABGRUND/g)||[]).length;
check('C: es gibt Eintraege mit Abgrund-Herkunft', abgrundEintraege >= 4, { eintraege: abgrundEintraege });
// Kommentarzeilen ausgenommen: Die Prosa oben ERKLAERT das Feld und schreibt es dabei aus - das ist
// kein loser Wert im Code, sondern der Grund, warum es die Konstante gibt.
const loseHerkunft = zeilenVon(js)
  .map((z,i) => ({ z, nr:i+1 }))
  .filter(x => !x.z.trim().startsWith('//') && /quelle:\s*'abgrund'/.test(x.z))
  .map(x => 'Zeile '+x.nr);
check('C: die Herkunft steht als KONSTANTE dran, nicht als lose Zeichenkette',
  loseHerkunft.length === 0, loseHerkunft);
check('C: die beiden Herkunfts-Konstanten sind benannt, nicht als Zeichenkette verstreut',
  /const HERKUNFT_NORMAL = 'normal'/.test(js) && /const HERKUNFT_ABGRUND = 'abgrund'/.test(js));

// Und die Gegenprobe, die den ganzen Umbau erst rechtfertigt: Ein Abgrund-Eintrag darf aus KEINER
// normalen Quelle kommen. Gemessen wird das an den echten MODULE_DEFS, ausgefuehrt.
const MD = (() => {
  const i = js.indexOf('const MODULE_DEFS = [');
  let d=0, s=js.indexOf('[', i), k=s;
  for (; k<js.length; k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  // Die desc-Texte enthalten HTML, aber keine Funktionsaufrufe - das Array ist als Literal lesbar,
  // sobald die beiden Herkunfts-Konstanten definiert sind.
  return new Function("const HERKUNFT_NORMAL='normal', HERKUNFT_ABGRUND='abgrund'; return "+js.slice(s,k+1))();
})();
const abgrundKeys = MD.filter(d => d.quelle === 'abgrund').map(d => d.key);
check('C: die echten MODULE_DEFS tragen die Abgrund-Module', abgrundKeys.length >= 4, abgrundKeys);
const normalerPool = G.fundPool(MD).map(d => d.key);
check('C: KEIN Abgrund-Modul liegt im normalen Fundpool (Markt, Expedition, Kiste, Allianz)',
  abgrundKeys.every(k => !normalerPool.includes(k)),
  abgrundKeys.filter(k => normalerPool.includes(k)));
const abgrundPool = G.fundPool(MD, { quelle:'abgrund' }).map(d => d.key);
check('C: und der Abgrund-Pool enthaelt AUSSCHLIESSLICH sie (keine normalen Module von unten)',
  abgrundPool.length === abgrundKeys.length && abgrundPool.every(k => abgrundKeys.includes(k)),
  abgrundPool);

// ---- D) chance:0 - der Nebenbefund, der den Umbau bezahlt hat ----
// Beim Zusammenziehen der Ziehstellen fiel auf: RARE_ITEMS hat SECHS Eintraege, einer davon
// (leerensplitter) traegt chance:0 und ist laut eigener Definition "KEIN Direktfund bei
// Expeditionen" - er soll nur aus Leere-NPCs, Weltboss und Piraten-Endboss kommen. Genau eine
// Funktion hielt sich daran; ZWOELF weitere Fundstellen zogen daneben direkt aus dem vollen Array
// und schuetteten die Endgame-Ressource mit rund 1/6 je Fund aus.
//
// Die Regel liegt jetzt in fundPool(), damit sie nicht ein zweites Mal vergessen werden kann - und
// sie wird hier AUSGEFUEHRT geprueft, nicht am Quelltext abgelesen.
check('D: fundPool wirft chance:0 raus - unabhaengig von der Herkunft',
  G.fundPool([{key:'nie',chance:0},{key:'doch',chance:0.005}]).length === 1 &&
  G.fundPool([{key:'nie',chance:0}], { quelle:'alle', craft:true, event:true }).length === 0);
check('D: chance:undefined und chance>0 bleiben drin (nur die ausdrueckliche 0 fliegt)',
  G.fundPool([{key:'ohne'},{key:'klein',chance:0.001}]).length === 2);
// Ueber 400 Ziehungen darf der gesperrte Eintrag KEIN einziges Mal kommen. Ein Filter, der nur
// meistens greift, waere hier nicht zu unterscheiden von einem, der gar nicht greift.
const rar = [{key:'a',chance:0.006},{key:'gesperrt',chance:0},{key:'b',chance:0.005}];
let leck = 0;
for (let i=0;i<400;i++){ const z = G.zieheAusPool(rar); if (z && z.key === 'gesperrt') leck++; }
check('D: ueber 400 Ziehungen kommt der chance:0-Eintrag kein einziges Mal', leck === 0, { leck });

// Und die zwoelf Fundstellen muessen wirklich auf der einen Funktion sitzen.
check('D: keine Fundstelle zieht mehr am Filter vorbei aus dem vollen RARE_ITEMS',
  !/RARE_ITEMS\s*\[\s*Math\.floor/.test(js));
const roh = fnAus('randomFindableRareItem');
check('D: randomFindableRareItem baut den Pool nicht mehr selbst, sondern zieht ueber zieheAusPool',
  /zieheAusPool\(\s*RARE_ITEMS\s*\)/.test(roh) && !/\.filter\(/.test(roh), roh.trim());
// 15 Aufrufe = 12 umgestellte + 3, die es vorher schon richtig machten. Die Zahl steht hier, damit
// ein spaeteres Wiederauftauchen einer eigenen Ziehung auffaellt, auch wenn sie anders geschrieben ist.
const aufrufe = (js.match(/randomFindableRareItem\(\)/g)||[]).length - 0;
check('D: alle Fundstellen fuer seltene Materialien laufen ueber die eine Funktion',
  aufrufe >= 15, { aufrufe });

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
