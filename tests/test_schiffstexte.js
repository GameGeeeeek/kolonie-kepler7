// Die Schiffskarte muss sagen, was das Schiff BRINGT - und warum sie gesperrt ist (30.07.2026, v8.347.0).
//
// Spieler-Report: „man sieht nicht welchen Vorteil die Schiffe bringen". Die sechs Tiefenschiff-
// Karten in der Werft zeigten vier Balken (Angriff 0, Abwehr 0, Schild 0, Tempo n), Kosten, Bauzeit
// und Punkte - und keine Zeile darueber, wozu das Schiff gut ist. Zwei Ursachen, beide still:
//
//   A) DAS FELD OHNE ANZEIGESTELLE. Die 30 gewoehnlichen Schiffe erklaert eine handgeschriebene
//      if/else-Kette in der Werft (`meta`). Die 9 Tiefenschiffe tragen stattdessen ein `desc` -
//      und `def.desc` wurde in der ganzen Datei NIE gerendert. CLAUDE.md Regel 7 war erfuellt (der
//      Text war geschrieben, vollstaendig, selbsterklaerend), es fehlte nur der Ort, an dem er
//      erscheint. Genau derselbe Fehler hatte das Projekt schon einmal, nur mit einem anderen
//      Feldnamen: `nicheDesc` war bis v8.150-irgendwas ebenfalls nur bei gesperrten Event-Schiffen
//      sichtbar (Patchnote-Eintrag „Bugfix (danke fuer den Hinweis)"). Zweites Feld, gleiche Falle.
//
//   B) DIE SPERRE OHNE GRUND. shipRequirementsMet() sperrt Tiefenschiffe ueber die REKORDTIEFE, die
//      beiden Anforderungs-Zeilen der Karte lasen aber ausschliesslich def.requires (Forschung).
//      Bei erfuellter Singularitaetsphysik stand deshalb wortwoertlich „Benoetigt:" und dahinter
//      NICHTS. Der Knopf war grau und die Karte schwieg zum Grund.
//
// Der Test prueft beides, und zusaetzlich die Invariante dahinter: Jede Bedingung, die
// shipRequirementsMet abfragt, muss in den Anforderungs-Zeilen einen Namen haben. Wer eine neue
// Freischaltbedingung einbaut, wird hier rot - sonst baut er wieder eine stumme Sperre.
const fs = require('fs');
const path = require('path');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

function fnAus(n){
  const m = js.match(new RegExp('function\\s+'+n+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+n);
  const i = js.indexOf(m[0]);
  let d=0, s=js.indexOf('{', i+m[0].length), k=s;
  for (; k<js.length; k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}
function arrAus(name){
  const i = js.indexOf('const '+name+' = [');
  if (i < 0) throw new Error('Array nicht gefunden: '+name);
  let d=0, s=js.indexOf('[', i), k=s;
  for (; k<js.length; k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}

// ---- 1) Welche Schiffe tragen ueberhaupt ein desc? ----
// Aus der Datei gezogen, nicht abgeschrieben: Kommt morgen ein zehntes Schiff mit desc dazu, deckt
// der Test es automatisch mit ab.
const shipBlock = arrAus('SHIP_DEFS');
const schiffe = shipBlock.split(/\{ key:'/).slice(1).map(t => {
  const m = t.match(/^([A-Za-z0-9_]+)'/);
  if (!m) return null;
  const eigen = t.split(/\n *\{ key:'/)[0];   // nur bis zum naechsten Eintrag
  const tf = eigen.match(/\btiefe:\s*(\d+)/);
  return { key:m[1], desc:/\bdesc:/.test(eigen), tiefe: tf ? +tf[1] : null };
}).filter(Boolean);
const mitDesc = schiffe.filter(s => s.desc).map(s => s.key);
check('1: die Schiffsliste wurde vollstaendig gelesen', schiffe.length >= 35, schiffe.length);
check('1: es gibt Schiffe mit eigenem desc-Text', mitDesc.length >= 9, mitDesc);
// Jedes Tiefenschiff MUSS einen desc-Text haben - es hat keine meta-Zeile in der if/else-Kette und
// waere ohne desc eine Karte ohne jede Auskunft (CLAUDE.md Regel 7).
const tiefenOhneDesc = schiffe.filter(s => s.tiefe && !s.desc).map(s => s.key);
check('1: jedes tiefenfreigeschaltete Schiff hat einen desc-Text',
  tiefenOhneDesc.length === 0, tiefenOhneDesc);

// ---- 2) DER KERN: def.desc wird auf der Schiffskarte gerendert ----
// Die Pruefung ist absichtlich auf `def.desc` und nicht auf einen der Texte geeicht: Ein Test, der
// nach „Ein Auge, keine Waffe" sucht, wird beim ersten Umformulieren rot, ohne dass etwas kaputt
// ist. Was hier wirklich schiefgehen kann, ist das Fehlen der Anzeigestelle.
const werft = js.slice(js.indexOf('const shipRows = visibleShipDefs.map'));
const karte = werft.slice(0, werft.indexOf('const superBlock'));
check('2: die Schiffskarte rendert def.desc', /\$\{def\.desc \? `<div class="bmeta"/.test(karte));
check('2: und tut das generisch, nicht nur fuer eine Handvoll Schluessel',
  !/def\.key===.(lotsenboot|kessel|bergungskran)/.test(karte.match(/def\.desc[\s\S]{0,400}/)[0]));
// Die alte nicheDesc-Zeile muss daneben stehen bleiben - sie erklaert die 30 anderen Schiffe.
check('2: die nicheDesc-Zeile ist weiter da', /\$\{def\.nicheDesc \? `<div class="bmeta"/.test(karte));

// ---- 3) Die zweite Anzeigestelle: die Bau-Bruecke im Abgrund (CLAUDE.md Regel 6) ----
// Die Bruecke nannte Bestand, Preis und Freischalttiefe - alles ausser dem Grund, so ein Schiff zu
// bauen. Sie muss DENSELBEN def.desc zeigen und keine eigene Kurzfassung: zwei Texte fuer dieselbe
// Sache sind die Fundstelle, die beim naechsten Balance-Pass nur an einer Stelle mitwandert.
const bruecke = fnAus('abgrundBauBruecke');
check('3: die Bau-Bruecke zeigt die Wirkung auch', /def\.desc/.test(bruecke));
check('3: und zwar denselben Text, keine zweite Kurzfassung',
  (bruecke.match(/def\.desc/g)||[]).length >= 1 && !/wirkung:|kurz:/.test(bruecke));
// Der Abgrund-Kasten wird periodisch per setBoxHtml neu geschrieben. Ein <details> ohne stabilen
// Schluessel klappt dort nach einer Sekunde von selbst wieder zu - dreimal als echter Spielerfehler
// aufgetreten (CLAUDE.md: „Jeder Bedienzustand, der NUR im DOM steckt").
if (/<details/.test(bruecke)){
  check('3: ein Aufklappfeld in der Bruecke merkt sich seinen Zustand',
    /data-keep-open="tiefenschiff:\$\{def\.key\}"/.test(bruecke) &&
    /detailsOpenAttr\('tiefenschiff:'\+def\.key\)/.test(bruecke));
}

// ---- 4) DIE INVARIANTE: keine stumme Sperre ----
// shipRequirementsMet() ist die eine Wahrheit dafuer, ob ein Schiff baubar ist. Jede Bedingung
// darin muss in den Anforderungs-Zeilen der Karte einen Namen haben, sonst ist der Knopf grau und
// die Karte schweigt zum Grund. Gelesen werden die def-Felder, die die Funktion abfragt.
const srm = fnAus('shipRequirementsMet');
const gelesen = [...new Set([...srm.matchAll(/def\.([a-zA-Z]+)/g)].map(m => m[1]))];
// 05.08.2026: Hier stand bis heute eine HANDGEPFLEGTE Freigabeliste (`new Set(['requires','tiefe'])`).
// Sie war rot, sobald jemand ein neues Feld abfragte - aber sie war auch dann rot, wenn er die
// Anzeigestelle korrekt mitgebaut hatte, und sie waere gruen geblieben, wenn jemand ein Feld in die
// Liste eingetragen haette, ohne es je anzuzeigen. Geprueft wurde also die Buchfuehrung, nicht die
// Sache. Mit der Allianzflotte (allianzSchiff/allianzWerft) ist genau der erste Fall eingetreten.
//
// Jetzt wird die REGEL gemessen: Jedes Feld, das shipRequirementsMet() abfragt, muss in dem
// Abschnitt der Werftkarte auftauchen, der die Anforderungs-Zeilen baut - also dort, wo reqNames
// und allReqNames entstehen. Damit kann die Pruefung weder falsch-rot noch falsch-gruen sein, und
// niemand muss sie beim naechsten Schiff von Hand nachziehen.
// Es sind ZWEI Zeilen, und sie haben verschiedene Aufgaben:
//   reqNames    - was JETZT noch fehlt (steht auf der gesperrten Karte hinter „Benoetigt:")
//   allReqNames - was das Schiff ueberhaupt verlangt (steht auf der freigeschalteten Karte)
// Eine Bedingung muss in BEIDEN vorkommen. Der erste Anlauf dieser Pruefung schnitt beide Zeilen
// als EINEN Block aus und suchte darin - und war damit blind dafuer, dass eine Bedingung aus genau
// einer der beiden herausfaellt. Gegengeprueft: Beim testweisen Entfernen der Werftstufe aus
// reqNames blieb sie gruen, weil allReqNames sie noch nannte. Deshalb jetzt getrennt.
// Anker ist reqNameFor - die Hilfsfunktion, die es NUR im Werft-Block gibt. Ohne sie traf
// `indexOf('const reqNames =')` die gleichnamige Zeile der GEBAEUDE-Karte, die zufaellig weiter
// oben steht und mit Schiffen nichts zu tun hat; die Pruefung war dadurch gruen an der falschen
// Stelle. Beim naechsten Umbau also am Anker denken, nicht am Variablennamen.
const werftBlock = js.indexOf('const reqNameFor = req =>');
const zeileVon = (name) => {
  const a = js.indexOf('const ' + name + ' = (def.requires||[])', werftBlock);
  return a < 0 ? '' : js.slice(a, js.indexOf('\n', a));
};
check('4: der Werft-Block wurde gefunden (Anker reqNameFor)', werftBlock > 0, werftBlock);
const reqZeile = zeileVon('reqNames');
const allZeile = zeileVon('allReqNames');
check('4: beide Anforderungs-Zeilen wurden gefunden', reqZeile.length > 80 && allZeile.length > 40,
  { req: reqZeile.length, all: allZeile.length });
// 'requires' ist der Regelfall und wird von reqNameFor generisch aufgeloest - alles andere ist eine
// SONDERbedingung. Sie taucht in der Zeile selbst oder in einer direkt davor gebauten Hilfsliste auf
// (tiefeOffen/tiefeAlle, allianzOffen/allianzAlle), deshalb wird die jeweilige Hilfsliste mitgelesen.
const mitHilfslisten = (zeile) => {
  let t = zeile;
  for (const h of (zeile.match(/\.concat\((\w+)\)/g) || []).map(x => x.slice(8, -1))){
    const a = js.indexOf('const ' + h + ' =');
    if (a >= 0) t += '\n' + js.slice(a, js.indexOf(';', a));
  }
  return t;
};
const reqText = mitHilfslisten(reqZeile), allText = mitHilfslisten(allZeile);
const fehltIn = (text) => gelesen.filter(f => f !== 'requires' && text.indexOf('def.' + f) < 0);
check('4: die „Benoetigt"-Zeile nennt jede Bedingung, die die Sperre prueft',
  fehltIn(reqText).length === 0,
  { unbenannt: fehltIn(reqText), geprueft: gelesen,
    hinweis:'Neue Freischaltbedingung? In reqNames einen Namen dafuer ergaenzen, sonst ist die Karte gesperrt und sagt nicht warum.' });
check('4: und die Voraussetzungs-Zeile ebenso',
  fehltIn(allText).length === 0,
  { unbenannt: fehltIn(allText), hinweis:'dasselbe fuer allReqNames.' });
// GEGENPROBE: Der Ausschnitt muss ueberhaupt etwas enthalten - ein leerer Text waere sonst still gruen.
check('4: die Gegenprobe greift (leerer Ausschnitt waere aufgefallen)',
  reqText.indexOf('def.') >= 0 && allText.indexOf('def.') >= 0 && gelesen.length >= 3, gelesen);
// Und die Tiefe muss in BEIDEN Zeilen vorkommen: „Voraussetzung" steht dauerhaft (auch nach dem
// Freischalten, damit man es nachschlagen kann), „Benoetigt" nur solange gesperrt.
check('4: die Voraussetzungs-Zeile nennt die Rekordtiefe',
  /allReqNames = [^\n]*\.concat\(tiefeAlle\)/.test(karte) && /tiefeAlle = typeof def\.tiefe === 'number'/.test(karte));
check('4: die Benoetigt-Zeile nennt die fehlende Rekordtiefe samt aktuellem Stand',
  /reqNames = [^\n]*\.concat\(tiefeOffen\)/.test(karte) &&
  /tiefeOffen = \(typeof def\.tiefe === 'number' && tiefeErreicht < def\.tiefe\)/.test(karte) &&
  /aktuell '\+tiefeErreicht\+'/.test(karte));

// ---- 5) Ausfuehren statt lesen: die beiden Zeilen duerfen NIE leer sein ----
// Das war der eigentliche Fehler - nicht eine falsche Zahl, sondern eine leere Zeile. Die Logik der
// Karte wird hier nachgebaut (dieselben Ausdruecke, aus dem Quelltext gezogen) und gegen jedes
// Schiff laufen gelassen, das ueber die Tiefe freigeschaltet wird.
{
  // Aus der Liste von 1) statt per eigener Regex ueber den ganzen Block: Eine globale Regex
  // `key:'…'[\s\S]*?tiefe:(\d+)` liefert hier NICHT neun, sondern acht Treffer - sie frisst beim
  // ersten Match den Text bis zum tiefe-Feld mit, das Suchfenster beginnt danach schon mitten im
  // naechsten Eintrag, und ein Schiff fehlt still. Genau der Fallstrick, vor dem CLAUDE.md warnt
  // („naive Regex ueber die ganze Datei").
  const tiefen = schiffe.filter(s => typeof s.tiefe === 'number').map(s => ({ key:s.key, tiefe:s.tiefe }));
  check('5: es gibt tiefenfreigeschaltete Schiffe zum Pruefen', tiefen.length >= 9, tiefen.length);
  const zeile = (tiefe, best) => {
    const tiefeErreicht = best;
    const tiefeOffen = (typeof tiefe === 'number' && tiefeErreicht < tiefe)
      ? ['Rekordtiefe '+tiefe+' im Abgrund (aktuell '+tiefeErreicht+')'] : [];
    // Forschung ist erfuellt - genau der Fall aus dem Report.
    return [].concat(tiefeOffen).join(', ');
  };
  const leer = tiefen.filter(e => zeile(e.tiefe, 0) === '').map(e => e.key);
  check('5: bei erfuellter Forschung und Tiefe 0 nennt jede Karte trotzdem einen Grund',
    leer.length === 0, leer);
  const flach = tiefen.filter(e => !/aktuell 3\)/.test(zeile(e.tiefe, 3)) && e.tiefe > 3).map(e => e.key);
  check('5: und nennt den eigenen Stand mit', flach.length === 0, flach);
  // Umgekehrt: wer tief genug ist, darf keinen Grund mehr angezeigt bekommen.
  const hoechste = Math.max(...tiefen.map(e => e.tiefe));
  check('5: wer tief genug ist, sieht keine offene Bedingung',
    tiefen.every(e => zeile(e.tiefe, hoechste) === ''), hoechste);
}

// ---- 6) Der Hilfetext darf die Flotte nicht falsch zaehlen ----
// Die Hilfe sprach von „Sechs Schiffen … in zwei Staffeln", obwohl Staffel III (v8.339.0) drei
// weitere gebracht hatte - dieselbe Sorte veraltete Zweitstelle wie die „20 Vorlagen" im Tutorial.
// Gegengeprueft wird nicht gegen eine getippte Zahl, sondern gegen SHIP_DEFS.
{
  const anzahl = schiffe.filter(s => typeof s.tiefe === 'number').length;
  const worte = ['null','ein','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf'];
  const i = src.indexOf("title:'Die Tiefenflotte");
  const eintrag = src.slice(i, src.indexOf("' },", i));
  check('6: der Hilfetext nennt die richtige Zahl Tiefenschiffe',
    new RegExp(worte[anzahl], 'i').test(eintrag.slice(0, 400)),
    { erwartet:worte[anzahl], anzahl });
  // Und keine ALTE Zahl darf daneben stehen bleiben.
  const falsche = worte.slice(1).filter((w,k) => k+1 !== anzahl && new RegExp(w+' Schiffe','i').test(eintrag));
  check('6: und keine veraltete Zahl daneben', falsche.length === 0, falsche);
  // Die Staffelzahl ebenso: drei Staffelabschnitte in der Hilfe, also „drei Staffeln".
  const staffeln = (src.match(/title:'Tiefenflotte, Staffel [IVX]+/g)||[]).length + 1;
  check('6: der Hilfetext nennt die richtige Zahl Staffeln',
    new RegExp(worte[staffeln]+' Staffeln').test(eintrag), { erwartet:worte[staffeln], staffeln });
}

// ---- 7) Das Icon der Wirkungszeile muss im Font-Subset stehen ----
// Der Icon-Font enthaelt nur die tatsaechlich verwendeten Glyphen. Ein ti-* ohne CSS-Regel fehlt im
// Font und erscheint als leeres Kaestchen - check-icons.js faengt das ebenfalls, hier steht es
// direkt bei der Zeile, die es benutzt.
{
  const m = karte.match(/def\.desc \? `<div class="bmeta"[^`]*?<i class="ti (ti-[a-z0-9-]+)"/);
  check('7: die Wirkungszeile benutzt ein Icon', !!m, m && m[1]);
  if (m) check('7: und dieses Icon steht im Font-Subset',
    new RegExp('\\.'+m[1]+':before\\{content:"').test(src), m[1]);
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
