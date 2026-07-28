// Icon-Abdeckung: haben alle Inhalte ein GEZEICHNETES Icon? (Icon-Audit 26.07.2026, v8.304/305.0)
//
// BEFUND des Audits: Das Spiel hat zwei Icon-Systeme mit sichtbar verschiedener Handschrift -
// 98 handgezeichnete SVG (weich, gefüllt, Farbverlauf, Schattierung) und 69 Schrift-Icons aus dem
// Tabler-Font (flache Striche). Das allein wäre kein Fehler; problematisch war die VERTEILUNG:
// Schiffe 100% gezeichnet, Gebäude 76% - aber Offiziere 0%. Wer vom Flotte-Reiter zum
// Offiziere-Reiter wechselte, wechselte die Bildsprache. CLAUDE.md Regel 7 nennt den ti-Fallback
// ausdrücklich "Notnagel, kein Ersatz".
//
// Dieser Test wächst mit: v8.304.0 brachte die Offiziere (Abschnitte 1-4), v8.305.0 die
// Standort-Module (5, 5b), v8.306.0 Gebäude, Doktrinen und Aufstellungen (6, 7), v8.307.0 die 36
// Schiffsklassen-Module (8, 8b). Kommt später etwas Neues dazu, gehört es als weitere Gruppe
// hierher. Am Ende steht ausdrücklich, welche Bereiche noch offen sind - damit eine Lücke sichtbar
// bleibt statt vergessen zu werden.
//
// Geprüft wird:
//   1) jeder Offizier hat einen eigenen ICONS-Eintrag
//   2) die Offizierskarte holt ihn auch wirklich ab (sie schrieb das Schrift-Icon vorher fest ein)
//   3) die neuen Icons halten den Hausstil ein (Maße, Filter, Strichstärken)
//   4) am laufenden Spiel: im Offiziere-Reiter steckt in jeder Offizierskachel ein <svg>
//   5) dasselbe für die 13 Standort-Module, dazu die Begründung des mod_-Präfixes (Kollision mit
//      Gebäudeschlüsseln)
//   8) dasselbe für die 36 Schiffsklassen-Module (Präfix sm_, eigenes Gehäuse) - samt der Frage,
//      die dort allein zählt: unterscheiden sich die Module INNERHALB einer Schiffsklasse?
//   9) die Rohstoffe: RES_ICONS muss JEDEN Schlüssel abdecken, der in einer Kostenzeile landen
//      kann - miniResIcon() liefert für einen unbekannten Schlüssel '' und die Zeile bleibt
//      wortlos leer, ohne dass irgendwo ein Fehler auftaucht.
//  10) die vier Fraktionen und die Gegenstände - beide Male geht es NICHT um "hat ein Symbol",
//      sondern um "hat ein EIGENES": vier Fraktionen mit demselben ti-flag, zwei Gegenstände mit
//      demselben ti-building-factory-2.
//  11) die sechsundzwanzig Gegenstände, seit v8.312.0 gezeichnet - inklusive der sieben
//      Event-Gegenstände, die in DERSELBEN Liste stehen und deshalb mitmüssen.
//   6) Gebäude - und dabei BEIDE Grafiksysteme mitgerechnet: gezeichnetes SVG oder animiertes
//      Canvas. Die erste Zählung kannte nur ICONS und meldete deshalb 11 statt 4 Lücken.
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

const src = fs.readFileSync(SPIELDATEI,'utf8');
function obj(n){ const i=src.indexOf('  const '+n+' = {'); if(i<0) return '';
  let d=0,j=src.indexOf('{',i),a=j;
  for(;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){ d--; if(!d) break; } }
  return src.slice(a,j+1); }
function arrBlock(n){ const i=src.indexOf('  const '+n+' = ['); if(i<0) return '';
  let d=0,j=src.indexOf('[',i),a=j;
  for(;j<src.length;j++){ if(src[j]==='[')d++; else if(src[j]===']'){ d--; if(!d) break; } }
  return src.slice(a,j+1); }

const ICONS_BLOCK = obj('ICONS');
const ICONS = new Set([...ICONS_BLOCK.matchAll(/(\w+):\s*`<svg/g)].map(m=>m[1]));

// ---------------------------------------------------------------- 1: Offiziere vollständig
const offBlock = arrBlock('OFFICERS');
const offKeys = [...offBlock.matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
check('1: alle sieben Offiziere sind im Array', offKeys.length === 7, offKeys);
const ohne = offKeys.filter(k => !ICONS.has(k));
check('1: jeder Offizier hat ein eigenes gezeichnetes Icon', ohne.length === 0, ohne);

// ---------------------------------------------------------------- 2: die Karte holt es auch ab
// Vor v8.304.0 stand dort `<i class="ti ${o.icon}">` fest verdrahtet - die Icons hätten im Objekt
// liegen können, ohne dass je eines zu sehen gewesen wäre. Genau diese Falle prüft der Test.
check('2: die Offizierskarte ruft iconHtmlFor auf', /\$\{iconHtmlFor\(o\.key, o\.icon, o\.color\)\}/.test(src));
check('2: und schreibt kein Schrift-Icon mehr fest hinein',
  !/<div class="bicon"[^>]*><i class="ti \$\{o\.icon\}"/.test(src));
// Das ti-Icon bleibt als Notnagel im Aufruf - es zu entfernen wäre die falsche Lehre.
check('2: der Notnagel im OFFICERS-Array bleibt erhalten',
  (offBlock.match(/icon:'ti-/g)||[]).length === 7);

// ---------------------------------------------------------------- 3: Hausstil der neuen Icons
for (const k of offKeys){
  const m = ICONS_BLOCK.match(new RegExp('\\b'+k+":\\s*`(<svg[\\s\\S]*?<\\/svg>)`"));
  if (!m){ check('3: '+k+' gefunden', false); continue; }
  const svg = m[1];
  const masse = /viewBox="0 0 100 100" width="24" height="24"/.test(svg);
  const filter = /<g filter="url\(#ig\)">/.test(svg);
  // Strichstärken: die zwei Stufen, auf denen auch die 98 bestehenden Icons liegen
  // (4 ≈ 0,96px optisch für Hauptstriche, 1.6 ≈ 0,38px für Detaillinien).
  const striche = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(x=>x[1]);
  const sauber = striche.every(s => s==='4' || s==='1.6');
  check('3: '+k.padEnd(16)+' Maße, Filter und Strichstärken nach Hausstil',
    masse && filter && sauber, { masse, filter, striche });
}

// ---------------------------------------------------------------- 5: Standort-Module (v8.305.0)
// Die Modulschlüssel 'schild' und 'lager' sind IDENTISCH mit Gebäudeschlüsseln. Ein
// iconHtmlFor(def.key) hätte dem Schildmodul das Icon der Schildkuppel gegeben - semantisch nah
// genug, dass es niemandem aufgefallen wäre, aber Zufall statt Entscheidung. Deshalb das Präfix
// mod_, wie die Schiffe seit jeher ship_ benutzen. Der Test hält beides fest: das Präfix UND dass
// die Kollisionsschlüssel wirklich betroffen sind (sonst verliert die Begründung ihren Grund).
const modBlock = arrBlock('MODULE_DEFS');
const modKeys = [...modBlock.matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
// 13 bis v8.333.0, seit v8.334.0 die vier Abgrund-Standortmodule (Drucktank, Echolotmast,
// Splitterofen, Nullfeldanker). Die Zahl steht hier fest, damit ein neu eingefuegtes Modul nicht
// still an den Icon-Pruefungen darunter vorbeirutscht.
check('5: alle Standort-Module sind im Array', modKeys.length === 17, modKeys.length);
const modOhne = modKeys.filter(k => !ICONS.has('mod_'+k));
check('5: jedes Standort-Modul hat ein eigenes gezeichnetes Icon', modOhne.length === 0, modOhne);
// Erst behauptet: drei Kollisionen (schild/lager/werft). Der Test hat die Behauptung widerlegt -
// 'werft' existiert gar nicht als ICONS-Schlüssel, es sind ZWEI. Die Prüfung steht bewusst hier,
// damit die Begründung des mod_-Präfixes nachprüfbar bleibt statt eine Erzählung zu sein.
const kollision = modKeys.filter(k => ICONS.has(k));
check('5: genau die zwei bekannten Kollisionsschlüssel existieren doppelt (Begründung des Präfixes)',
  kollision.length === 2 && kollision.includes('schild') && kollision.includes('lager'), kollision);
check('5: es gibt einen eigenen Modul-Helfer mit mod_-Präfix',
  /function moduleIconHtml\(def, isShip, color\)/.test(src) && /iconHtmlFor\('mod_'\+def\.key/.test(src));
// Schiffsmodule sind eine eigene Familie mit eigenen Schlüsseln. Der isShip-Zweig muss bleiben:
// ein pauschales 'mod_'+key griffe für sie ins Leere - und 'schild'/'lager' würden dann quer
// zwischen den Familien treffen, also genau die Kollision, die das Präfix verhindern soll.
check('5: der isShip-Zweig trennt die beiden Modulfamilien weiterhin',
  /if \(isShip\) return iconHtmlFor\('sm_'\+def\.key, def\.icon, color\);/.test(src));
for (const k of modKeys){
  const m = ICONS_BLOCK.match(new RegExp('\\bmod_'+k+":\\s*`(<svg[\\s\\S]*?<\\/svg>)`"));
  if (!m){ continue; }
  const svg = m[1];
  const gehaeuse = /M50 8 L86 29 V71 L50 92 L14 71 V29 Z/.test(svg);
  const striche = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(x=>x[1]);
  check('5: mod_'+k.padEnd(17)+' gemeinsames Gehäuse und Hausstil-Strichstärken',
    gehaeuse && striche.every(s=>s==='4'||s==='1.6'), { gehaeuse, striche });
}

// ---------------------------------------------------------------- 6: Gebäude (v8.306.0)
// KORREKTUR EINES EIGENEN FEHLBEFUNDS: Das Audit meldete "11 Gebäude noch flach". Es sind vier.
// Sieben der elf haben längst eine ANIMIERTE CANVAS-Grafik (DEFENSE_ART bzw. DEFENSE_CANVAS_KEYS),
// und defIconHtml() prüft die VOR dem ICONS-Objekt - ein SVG dafür wäre toter Code gewesen. Die
// Zählung schaute nur ins ICONS-Objekt und übersah damit ein ganzes zweites Grafiksystem.
// Die Canvas-Schlüssel gehören deshalb ab hier in JEDE Abdeckungsrechnung.
const dokKeysVorab = [...arrBlock('DOCTRINE_DEFS').matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
const formKeysVorab = [...arrBlock('DEFENSE_FORMATIONS').matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
const artBlock = obj('DEFENSE_ART');
const CANVAS = new Set(['turm','schild','raketen', ...[...artBlock.matchAll(/^\s+(\w+):\s*\{/gm)].map(m=>m[1])]);
check('6: die Canvas-Anlagen sind gefunden', CANVAS.size >= 20, CANVAS.size);
// Die Reihenfolge über Positionen statt über eine Regex mit Abstandsgrenze: der Abstand zwischen
// beiden Stellen ist Umbauten ausgesetzt, die Reihenfolge nicht. Genau diese Reihenfolge ist der
// Grund, warum ein SVG für eine Canvas-Anlage toter Code wäre.
const iCanvas = src.indexOf('DEFENSE_CANVAS_KEYS.includes(def.key)');
const iFallback = src.indexOf('iconHtmlFor(def.key, def.icon, def.fg)');
check('6: defIconHtml prüft Canvas VOR dem ICONS-Objekt',
  iCanvas > 0 && iFallback > iCanvas, { canvas:iCanvas, icons:iFallback });
const gebBlock = arrBlock('BUILDING_DEFS');
const gebKeys = [...gebBlock.matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
const gebFlach = gebKeys.filter(k => !ICONS.has(k) && !CANVAS.has(k));
check('6: kein Gebäude trägt mehr ein flaches Schrift-Icon', gebFlach.length === 0, gebFlach);
for (const k of ['quantenwerft','resonanzschild','urmateriereaktor','botschaft']){
  const m = ICONS_BLOCK.match(new RegExp('\\b'+k+":\\s*`(<svg[\\s\\S]*?<\\/svg>)`"));
  if (!m){ check('6: '+k+' gefunden', false); continue; }
  const svg = m[1];
  const striche = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(x=>x[1]);
  check('6: '+k.padEnd(18)+' Maße, Filter und Strichstärken nach Hausstil',
    /viewBox="0 0 100 100" width="24" height="24"/.test(svg) && /<g filter="url\(#ig\)">/.test(svg)
    && striche.every(x=>x==='4'||x==='1.6'), striche);
}
// Kein Icon DIESER Runden darf in der Canvas-Liste stehen - sonst wäre es toter Code, weil
// defIconHtml() die Canvas-Grafik zuerst nimmt. Bewusst über ALLE neu angelegten Schlüssel statt
// über eine Handliste: Die Rot-Probe zeigte, dass eine Handliste ein neu eingeschleustes totes
// Icon durchgehen lässt.
// GRENZE dieser Prüfung, ausdrücklich festgehalten: Ein pauschales "kein ICONS-Schlüssel darf
// Canvas-Schlüssel sein" wäre FALSCH. Rund vierzehn Altlasten (schild, turm, flak, laser, ...)
// existieren in beiden Systemen, und sie sind nicht zwangsläufig tot - iconHtmlFor() wird an
// anderen Stellen (Kompendium, Listen) auch ohne den Canvas-Vorrang aufgerufen. Geprüft wird
// deshalb nur, was in diesen Runden dazugekommen ist.
const smKeysVorab = [...arrBlock('SHIP_MODULE_DEFS').matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
const neueSchluessel = [...offKeys, ...modKeys.map(k=>'mod_'+k), ...dokKeysVorab,
  ...formKeysVorab.map(k=>'form_'+k), ...smKeysVorab.map(k=>'sm_'+k),
  'quantenwerft','resonanzschild','urmateriereaktor','botschaft'];
const totesIcon = neueSchluessel.filter(k => CANVAS.has(k));
check('6: kein neu angelegtes Icon wird von einer Canvas-Grafik verdeckt', totesIcon.length === 0, totesIcon);

// ------------------------------------------- 7: Doktrinen und Aufstellungen (v8.306.0)
// Beides sind AUSWAHLKARTEN: drei Optionen nebeneinander, der Unterschied soll auf einen Blick
// erkennbar sein. Ausgerechnet dort trugen alle drei fast dieselben flachen Symbole - bei den
// Aufstellungen zweimal ein Schild. Der Test hält fest, dass die drei einer Reihe wirklich
// VERSCHIEDENE Icons haben; gleiche Icons wären hier schlimmer als gar keine.
const dokKeys = [...arrBlock('DOCTRINE_DEFS').matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
const formKeys = [...arrBlock('DEFENSE_FORMATIONS').matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
check('7: jede Doktrin hat ein eigenes gezeichnetes Icon',
  dokKeys.length === 3 && dokKeys.every(k => ICONS.has(k)), dokKeys.filter(k=>!ICONS.has(k)));
// Aufstellungs-Schlüssel sind sehr generisch ('schilde','ausgewogen') - Präfix form_ wie mod_/ship_,
// damit sie nicht irgendwann still ein fremdes Icon erwischen.
check('7: jede Aufstellung hat ein eigenes gezeichnetes Icon (Präfix form_)',
  formKeys.length === 3 && formKeys.every(k => ICONS.has('form_'+k)), formKeys.filter(k=>!ICONS.has('form_'+k)));
check('7: die Aufstellungs-Karte holt es über das Präfix ab',
  /iconHtmlFor\('form_'\+f\.key, f\.icon/.test(src));
check('7: die Doktrin-Karte holt es über den Schlüssel ab',
  /iconHtmlFor\(d\.key, d\.icon, isActive/.test(src));
// Drei gleiche Icons in einer Auswahl wären der eigentliche Fehler - deshalb ausdrücklich geprüft.
const dokSvgs = dokKeys.map(k => (ICONS_BLOCK.match(new RegExp('\\b'+k+":\\s*`(<svg[\\s\\S]*?<\\/svg>)`"))||[])[1]);
const formSvgs = formKeys.map(k => (ICONS_BLOCK.match(new RegExp('\\bform_'+k+":\\s*`(<svg[\\s\\S]*?<\\/svg>)`"))||[])[1]);
check('7: die drei Doktrin-Icons sind wirklich verschieden', new Set(dokSvgs).size === 3);
check('7: die drei Aufstellungs-Icons sind wirklich verschieden', new Set(formSvgs).size === 3);
for (const [name, liste] of [['Doktrin',dokSvgs],['Aufstellung',formSvgs]])
  check('7: '+name+'-Icons nach Hausstil', liste.every(v => v
    && /viewBox="0 0 100 100" width="24" height="24"/.test(v) && /<g filter="url\(#ig\)">/.test(v)
    && [...v.matchAll(/stroke-width="([\d.]+)"/g)].every(m=>m[1]==='4'||m[1]==='1.6')));

// ------------------------------------------- 8: Schiffsklassen-Module (v8.307.0)
// Letzte grosse Gruppe des Icon-Durchgangs. Zwei Dinge sind hier eigen:
//   a) EIGENES GEHÄUSE (Steckmodul mit zwei Kontaktstiften) statt des Sechsecks der Standort-
//      Module. Beide heissen im Spiel "Modul", sind aber verschiedene Technik - zwei Umrisse
//      halten sie auseinander. Der Test haelt das Gehaeuse fest, damit die Familie geschlossen
//      bleibt, wenn jemand ein 37. Modul ergaenzt.
//   b) Die Module stehen NIE alle zusammen in einer Liste, sondern immer nur die einer
//      Schiffsklasse. Verschiedene Icons ueber alle 36 waeren also die falsche Forderung (dann
//      braeuchte es 36 Motive); entscheidend ist die Unterscheidbarkeit INNERHALB einer Klasse.
//      Genau das prueft der Test - und genau daran haengen die zwei Sonderkerne.
const smBlock = arrBlock('SHIP_MODULE_DEFS');
const smDefs = [...smBlock.matchAll(/key:'([^']+)'[\s\S]*?klasse:'([^']+)'[\s\S]*?effect:'([^']+)'/g)]
  .map(m=>({ k:m[1], klasse:m[2], effect:m[3] }));
check('8: alle 36 Schiffsmodule sind erfasst', smDefs.length === 36, smDefs.length);
const smOhne = smDefs.filter(d => !ICONS.has('sm_'+d.k)).map(d=>d.k);
check('8: jedes Schiffsmodul hat ein eigenes gezeichnetes Icon (Präfix sm_)', smOhne.length === 0, smOhne);

const GEHAEUSE = 'M50 8 L86 29 V71 L50 92 L14 71 V29 Z';   // das Sechseck der Standort-Module
const smSvg = {};
for (const d of smDefs){
  const m = ICONS_BLOCK.match(new RegExp('\\bsm_'+d.k+":\\s*`(<svg[\\s\\S]*?<\\/svg>)`"));
  if (m) smSvg[d.k] = m[1];
}
const stilFehler = smDefs.filter(d => { const v = smSvg[d.k]; return !(v
  && /viewBox="0 0 100 100" width="24" height="24"/.test(v) && /<g filter="url\(#ig\)">/.test(v)
  && /<rect x="24" y="10" width="52" height="62"/.test(v)      // Gehäuse-Körper
  && (v.match(/<rect x="(?:33|58)" y="72"/g)||[]).length === 2 // die zwei Kontaktstifte
  && !v.includes(GEHAEUSE)
  // dieselben zwei Strichstärken wie in allen anderen Paketen
  && [...v.matchAll(/stroke-width="([\d.]+)"/g)].every(x=>x[1]==='4'||x[1]==='1.6')); }).map(d=>d.k);
check('8: alle tragen dasselbe eigene Gehäuse - und NICHT das Sechseck der Standort-Module',
  stilFehler.length === 0, stilFehler);

// Kleine Formen mit Verlauf verschwinden im fast schwarzen Ende der Bounding-Box (Lehre aus
// mod_abwehr, v8.305.0). Der Kern - alles nach dem schliessenden </g> des Gehäuses - muss deshalb
// solide Farben benutzen.
const verlaufImKern = smDefs.filter(d => {
  const v = smSvg[d.k]; if (!v) return false;
  return v.slice(v.indexOf('</g>')+4).includes('url(#g');
}).map(d=>d.k);
check('8: kein Kern benutzt einen Farbverlauf (kleine Formen bleiben sichtbar)',
  verlaufImKern.length === 0, verlaufImKern);

// Der eigentliche Punkt: innerhalb einer Schiffsklasse muss jedes Modul anders aussehen.
const proKlasse = {};
for (const d of smDefs) (proKlasse[d.klasse] = proKlasse[d.klasse] || []).push(d);
const doppelt = [];
for (const [klasse, liste] of Object.entries(proKlasse)){
  const kerne = liste.map(d => (smSvg[d.k]||'').slice((smSvg[d.k]||'').indexOf('</g>')));
  if (new Set(kerne).size !== liste.length) doppelt.push(klasse+' ('+liste.map(d=>d.k).join(', ')+')');
}
check('8: innerhalb jeder Schiffsklasse sind die Icons unterscheidbar', doppelt.length === 0, doppelt);
// Und die Begründung der zwei Sonderkerne nachprüfbar halten: OHNE sie waeren es genau diese vier
// Module, die sich in ihrer Klasse doppelten. Faellt eine Wirkung weg, faellt auch diese Prüfung
// auf - dann ist der Sonderkern womöglich gar nicht mehr nötig.
const nachWirkung = [];
for (const [klasse, liste] of Object.entries(proKlasse)){
  const zaehler = {};
  for (const d of liste) zaehler[d.effect] = (zaehler[d.effect]||0) + 1;
  for (const [ef,n] of Object.entries(zaehler)) if (n > 1)
    nachWirkung.push(klasse+':'+ef+' ('+liste.filter(d=>d.effect===ef).map(d=>d.k).join('+')+')');
}
check('8: genau zwei Wirkungspaare brauchen einen Sonderkern (Begründung der Sonderkerne)',
  nachWirkung.length === 2, nachWirkung);

// Die schmalen Fertigungs-Knöpfe bleiben bewusst flach (font-size:10px, ein 24px-SVG sprengt die
// Zeile) - und zwar fuer BEIDE Modulfamilien gleich. Festgehalten, damit die Ausnahme eine Regel
// ist und nicht als vergessener Rest gelesen wird.
check('8: die Ausnahme der Fertigungs-Knöpfe steht als Begründung im Code',
  /WO DIESE FUNKTION BEWUSST NICHT AUFGERUFEN WIRD/.test(src));
for (const knopf of ['data-craft-mythic-loc','data-craft-mythic-ship','data-fragcraft-loc','data-fragcraft-ship'])
  check('8: '+knopf.padEnd(24)+' benutzt weiterhin das Schrift-Icon',
    new RegExp(knopf+'="\\$\\{def\\.key\\}"[^`]*<i class="ti \\$\\{def\\.icon\\}"').test(src));

// ------------------------------------------- 9: Rohstoffe (v8.307.1)
// BEFUND: Von den sieben Tier-2-Rohstoffen hatten zwei keinen RES_ICONS-Eintrag - Metamaterial-
// Gewebe und Singularitätskerne. miniResIcon() gibt für einen unbekannten Schlüssel schlicht ''
// zurück, es gibt also nicht einmal einen ti-Notnagel: Die Kostenzeile der beiden Endgame-Schiffe
// zeigte "40 Metamaterial-Gewebe" ganz ohne Symbol, direkt neben "30 Hochenergiekristalle" mit.
// Diese Fehlerklasse ist besonders leise, weil sie weder crasht noch etwas Falsches anzeigt -
// sie zeigt einfach nichts. Deshalb ab hier geprüft.
const resIconBlock = obj('RES_ICONS');
const RESICONS = new Set([...resIconBlock.matchAll(/(\w+):\s*`<svg/g)].map(m=>m[1]));
const resKeys  = [...arrBlock('RES_DEFS').matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
const t2Keys   = [...arrBlock('TIER2_DEFS').matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
check('9: die sechs Kern-Rohstoffe sind gefunden', resKeys.length === 6, resKeys);
check('9: die sieben Tier-2-Rohstoffe sind gefunden', t2Keys.length === 7, t2Keys);
const resOhne = [...resKeys, ...t2Keys].filter(k => !RESICONS.has(k));
check('9: jeder Rohstoff, der in einer Kostenzeile landen kann, hat ein RES_ICONS-Symbol',
  resOhne.length === 0, resOhne);
// Kredite sind die EINE bewusste Ausnahme - sie sind keine produzierbare Ressource und benutzen im
// ganzen Spiel ti-diamond. Der Zweig muss stehen bleiben, sonst wäre auch dort die Zeile leer.
check('9: Kredite haben ihren eigenen Zweig in miniResIcon',
  /if \(key === 'credits'\) return '<i class="ti ti-diamond"/.test(src));

// Hausstil der RES_ICONS - bewusst ein ANDERER als bei ICONS: kleinere viewBox, 20px statt 24px,
// flache Vollfarbe statt Verlauf, kein <g filter="url(#ig)">. Rohstoffe sind Symbole, keine Objekte.
// Der Test hält den Unterschied fest, damit nicht irgendwann ein ICONS-Icon hier hineinrutscht.
for (const k of [...resKeys, ...t2Keys]){
  const m = resIconBlock.match(new RegExp('\\b'+k+":\\s*`(<svg[\\s\\S]*?<\\/svg>)`"));
  if (!m){ continue; }
  const svg = m[1];
  check('9: '+k.padEnd(20)+' im RES_ICONS-Hausstil',
    /viewBox="0 0 42 42" width="20" height="20"/.test(svg)
    && !svg.includes('url(#ig)') && !svg.includes('url(#g'),
    svg.slice(0,60));
}
// Und wie bei den Modulen: gleiche Symbole wären schlimmer als gar keine.
const resSvgs = [...resKeys, ...t2Keys]
  .map(k => (resIconBlock.match(new RegExp('\\b'+k+":\\s*`(<svg[\\s\\S]*?<\\/svg>)`"))||[])[1]);
check('9: alle dreizehn Rohstoff-Symbole sind verschieden',
  new Set(resSvgs).size === resSvgs.length, resSvgs.length+' Symbole, '+new Set(resSvgs).size+' verschieden');

// ------------------------------------------- 10: Fraktionen und Gegenstände (v8.308.0)
// BEFUND: Alle vier Fraktionen trugen dasselbe Symbol - ti-flag, nur in verschiedenen Farben.
// Dieselbe Fehlerklasse wie bei Doktrinen und Aufstellungen (Abschnitt 7), aber folgenreicher:
// Fraktionen stehen nicht nur nebeneinander, sie sind paarweise verfeindet (FACTION_RIVALS), und
// im Fraktionskrieg wählt man EINE Seite - eine Entscheidung, die je Krieg endgültig ist.
const fakKeys = [...obj('FACTION_DIPLOMACY').matchAll(/^\s{4}(\w+):\s*\{/gm)].map(m=>m[1]);
check('10: die vier Fraktionen sind gefunden', fakKeys.length === 4, fakKeys);
const fakOhne = fakKeys.filter(k => !ICONS.has('fac_'+k));
check('10: jede Fraktion hat ein eigenes gezeichnetes Icon (Präfix fac_)', fakOhne.length === 0, fakOhne);
const fakSvgs = fakKeys.map(k => (ICONS_BLOCK.match(new RegExp('\\bfac_'+k+":\\s*`(<svg[\\s\\S]*?<\\/svg>)`"))||[])[1]);
check('10: und die vier Symbole sind wirklich verschieden', new Set(fakSvgs).size === 4);
check('10: Fraktions-Icons nach Hausstil', fakSvgs.every(v => v
  && /viewBox="0 0 100 100" width="24" height="24"/.test(v) && /<g filter="url\(#ig\)">/.test(v)
  && [...v.matchAll(/stroke-width="([\d.]+)"/g)].every(m=>['4','1.6','5','6','2.5'].includes(m[1]))));
// Beide Anzeigestellen, nicht nur die eine: die Fraktionskarte UND die Kriegskarte, wo man sich
// zwischen den zwei Kriegsparteien entscheidet. Genau dort trugen bisher beide Seiten ein Schwert.
check('10: die Fraktionskarte holt das Icon über das Präfix ab',
  /iconHtmlFor\('fac_'\+f\.id, 'ti-flag', f\.color\)/.test(src));
check('10: auch die beiden Kriegsparteien tragen ihr eigenes Wappen',
  /const wappen = id => id \? `<span[^`]*iconHtmlFor\('fac_'\+id/.test(src));

// Gegenstände: hier ist ein gezeichnetes Icon NICHT die Forderung - alle neunzehn stehen als eine
// Liste im Inventar, und eine gemischte Liste (ein paar gezeichnet, der Rest flach) wäre unruhiger
// als eine durchgehend flache. Geprüft wird die Eigenschaft, auf die es in einer Liste ankommt:
// kein Symbol darf doppelt vorkommen. Bautrupp-Express und Werftkommando taten genau das.
const itemBlock = arrBlock('ITEM_DEFS');
const items = [...itemBlock.matchAll(/key:'([^']+)'[\s\S]{0,200}?icon:'([^']+)'/g)].map(m=>({k:m[1], ic:m[2]}));
// Selbstkalibrierend statt feste Zahl: Die Erwartung "19" musste bei jedem neuen Gegenstand
// nachgezogen werden und meldete sonst einen Fehler, den es nicht gab. Entscheidend ist, dass
// die Auswertung KEINEN Eintrag verliert - deshalb gegen die Zahl der key-Felder im Block.
const itemRoh = (itemBlock.match(/key:'/g) || []).length;
check('10: alle Gegenstände sind erfasst, keiner übersprungen',
  items.length === itemRoh && items.length >= 19, { erfasst:items.length, imBlock:itemRoh });
const proIcon = {};
for (const it of items) (proIcon[it.ic] = proIcon[it.ic] || []).push(it.k);
const itemDoppel = Object.entries(proIcon).filter(([,ks]) => ks.length > 1)
  .map(([ic,ks]) => ic+' → '+ks.join(', '));
check('10: kein Gegenstand teilt sein Symbol mit einem anderen', itemDoppel.length === 0, itemDoppel);

// ------------------------------------------- 11: Gegenstände (v8.312.0)
// Die Gegenstände waren die letzte geschlossen flache Gruppe. Sie wurden bewusst als GANZES
// umgestellt: Die Inventarliste wirft ITEM_DEFS und EVENT_ITEM_DEFS zusammen (allItemDefs), und
// sieben flache Symbole zwischen neunzehn gezeichneten wären unruhiger gewesen als der Zustand
// vorher. Genau diese Vollständigkeit prüft der Abschnitt - eine Teilumstellung wäre hier ein
// Rückschritt, kein halber Fortschritt.
const itemKeys  = [...arrBlock('ITEM_DEFS').matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
const eventKeys = [...arrBlock('EVENT_ITEM_DEFS').matchAll(/key:'([^']+)'/g)].map(m=>m[1]);
check('11: Gegenstände und Event-Gegenstände sind vollständig erfasst',
  itemKeys.length >= 19 && eventKeys.length >= 7, { items:itemKeys.length, event:eventKeys.length });
const itemOhne = [...itemKeys, ...eventKeys].filter(k => !ICONS.has('item_'+k));
check('11: JEDER Gegenstand der gemeinsamen Liste hat ein eigenes gezeichnetes Icon',
  itemOhne.length === 0, itemOhne);
const itemSvgs = [...itemKeys, ...eventKeys]
  .map(k => (ICONS_BLOCK.match(new RegExp('\\bitem_'+k+":\\s*`(<svg[\\s\\S]*?<\\/svg>)`"))||[])[1]);
check('11: alle Symbole sind verschieden',
  new Set(itemSvgs).size === itemSvgs.length,
  itemSvgs.length+' Symbole, '+new Set(itemSvgs).size+' verschieden');
// Gemeinsames Gehäuse - das Anhängeschild ist die DRITTE Silhouette neben dem Sechseck der
// Standort-Module und dem Steckmodul der Schiffsmodule. Der Test hält die Abgrenzung fest.
const SECHSECK = 'M50 8 L86 29 V71 L50 92 L14 71 V29 Z';
const itemStil = [...itemKeys, ...eventKeys].filter((k,i) => { const v = itemSvgs[i]; return !(v
  && /viewBox="0 0 100 100" width="24" height="24"/.test(v) && /<g filter="url\(#ig\)">/.test(v)
  && /<rect x="14" y="14" width="72" height="78" rx="10"/.test(v)   // Schild-Körper
  && /<circle cx="50" cy="25" r="4.5"/.test(v)                      // Aufhängeloch
  && !v.includes(SECHSECK)
  && !/<rect x="24" y="10" width="52" height="62"/.test(v)); });    // nicht das Steckmodul
check('11: alle tragen dasselbe Anhängeschild - und keine der beiden Modul-Silhouetten',
  itemStil.length === 0, itemStil);
// Kleine Formen mit Verlauf verschwinden im fast schwarzen Ende der Bounding-Box (mod_abwehr,
// v8.305.0). Der Kern - alles nach dem schließenden </g> des Gehäuses - bleibt solide.
const itemVerlauf = [...itemKeys, ...eventKeys].filter((k,i) => {
  const v = itemSvgs[i]; return v && v.slice(v.indexOf('</g>')+4).includes('url(#g'); });
check('11: kein Kern benutzt einen Farbverlauf', itemVerlauf.length === 0, itemVerlauf);
check('11: die Inventarzeile holt das Icon über das Präfix ab',
  /iconHtmlFor\('item_'\+it\.key, it\.icon, '#c3bef5'\)/.test(src));
// Die zwei bewussten Ausnahmen als Regel festhalten, damit sie nicht als vergessener Rest gelesen
// werden: die Tagesbonus-Vorschau (gemischte Reihe mit Schiffen/Krediten) und der Kredit-Shop.
check('11: die Ausnahmen sind im Code begründet',
  /würde EINE Zelle aus der Reihe herausbrechen/.test(src));

// ---------------------------------------------------------------- offene Lücken benennen
// Kein Fehlschlag - eine Standortbestimmung, damit die verbleibende Arbeit sichtbar bleibt.
// Rechnet BEIDE Grafiksysteme mit (gezeichnetes SVG ODER Canvas), sonst zählt sie wieder falsch.
const rest = {};
for (const name of ['MODULE_DEFS','DOCTRINE_DEFS','DEFENSE_FORMATIONS','BUILDING_DEFS','SHIP_MODULE_DEFS']){
  const b = arrBlock(name); if (!b) continue;
  const eintraege = [...b.matchAll(/key:'([^']+)'[^}]*?icon:'([^']+)'|icon:'([^']+)'[^}]*?key:'([^']+)'/g)]
    .map(m=>({k:m[1]||m[4], ic:m[2]||m[3]}));
  const flach = eintraege.filter(e =>
    !(ICONS.has(e.k) || ICONS.has(e.ic) || ICONS.has('mod_'+e.k) || ICONS.has('form_'+e.k)
      || ICONS.has('sm_'+e.k) || CANVAS.has(e.k)));
  if (eintraege.length) rest[name] = flach.length+' von '+eintraege.length+' noch flach';
}
console.log('\n  Noch offen (bewusst, kein Fehlschlag):');
for (const [k,v] of Object.entries(rest)) console.log('    '+k.padEnd(20)+v);
console.log();

// ---------------------------------------------------------------- 4: am laufenden Spiel
function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}
const SAVE = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:20,mine:18,lager:14,werft:10,labor:12}, fleet:{jaeger:100,missions:[]},
  colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
  officers:{ ingenieur:3, admiral:2 }, commandPoints:40,
  // Ohne diese zwei Forschungen erscheinen Metamaterial-Titan und Singularitäts-Vernichter gar
  // nicht im Flotte-Reiter - und 9b prüfte eine leere Liste (dieselbe Falle wie bei 5b/8b).
  research:{ rmetamaterial:1, rsingularitaet:1 },
  // Ausgerüstete Standort-Module, damit die Slot-Kacheln überhaupt gerendert werden. 'schild' ist
  // bewusst dabei: das ist einer der drei Schlüssel, die mit einem Gebäude kollidieren.
  modules:{ 'panzerung:selten':1, 'schild:episch':1, 'lager:gewoehnlich':1 },
  equippedModules:{ home:['panzerung:selten','schild:episch','lager:gewoehnlich'] },
  // Ohne Sockel gibt es keine Slots und damit auch keine Kacheln - moduleSlotCount() liest
  // ausschliesslich state.moduleSlotLevel. Fehlte das, prüfte 5b in Wahrheit eine leere Liste.
  moduleSlotLevel:{ home:3 },
  // Inventar mit BEIDEN Sorten: drei gewöhnliche Gegenstände und zwei Event-Gegenstände. Genau
  // diese Mischung ist der Grund, warum das Paket alle sechsundzwanzig umstellen musste.
  inventory:{ boost_prod:2, cargo:1, werftkommando:1, eventkapsel:3, glueckstalisman:1 },
  // Ausgeruestete Schiffsmodule fuer 8b. Bewusst eine Klasse mit MEHREREN Modulen, damit die
  // Kacheln nebeneinander stehen - genau die Ansicht, in der sie unterscheidbar sein muessen.
  shipModules:{ 'ss_panzerung:selten':1, 'ss_zielcomputer:episch':1, 'ss_schildverstaerker:selten':1 },
  equippedShipModules:{ schlachtschiff:['ss_panzerung:selten','ss_zielcomputer:episch','ss_schildverstaerker:selten'] },
  shipModuleSlotLevel:{ schlachtschiff:3 },
  battleStats:{wins:9,losses:2}, xp:20000, credits:50000, buffs:[], lastTick:Date.now(),
  colonyNames:{} });

(async () => {
  const browser = await starteBrowser();
  const store={'kepler7-save-v3':SAVE};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1200} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2600);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="offiziere"]');if(b)b.click();});
  await page.waitForTimeout(1400);

  const befund = await page.evaluate(namen => {
    const box=document.getElementById('officerBox');
    if(!box) return { fehlt:true };
    const treffer = namen.map(n => {
      // Die Karte, deren Überschrift den Offiziersnamen trägt
      const karte = [...box.querySelectorAll('.card-row')].find(c => {
        const t=c.querySelector('.bname'); return t && t.textContent.trim().startsWith(n);
      });
      if(!karte) return { name:n, karte:false };
      const kachel = karte.querySelector('.bicon');
      return { name:n, karte:true, svg: !!(kachel && kachel.querySelector('svg')),
               schrift: !!(kachel && kachel.querySelector('i.ti')) };
    });
    return { fehlt:false, treffer };
  }, ['Ingenieur','Admiral','Wissenschaftler','Händler','Navigator','Quartiermeister','Aufklärer']);

  check('4: der Offiziere-Reiter ist da', befund && !befund.fehlt, befund && befund.fehlt);
  if (befund && !befund.fehlt){
    const alleKarten = befund.treffer.every(t=>t.karte);
    check('4: alle sieben Offizierskarten sind gerendert', alleKarten,
      befund.treffer.filter(t=>!t.karte).map(t=>t.name));
    const alleSvg = befund.treffer.filter(t=>t.karte).every(t=>t.svg);
    check('4: jede Kachel zeigt ein gezeichnetes Icon (<svg>)', alleSvg,
      befund.treffer.filter(t=>t.karte && !t.svg).map(t=>t.name));
    const keinSchrift = befund.treffer.filter(t=>t.karte).every(t=>!t.schrift);
    check('4: und keine mehr das flache Schrift-Icon', keinSchrift,
      befund.treffer.filter(t=>t.schrift).map(t=>t.name));
  }
  // ---------------------------------------------------------------- 5b: Module am laufenden Spiel
  await page.evaluate(()=>{const b=document.querySelector('[data-officer-subtab="module"]'); if(b) b.click();});
  await page.waitForTimeout(400);
  const mods = await page.evaluate(()=>{
    const koepfe=[...document.querySelectorAll('.mod-head')];
    return { anzahl:koepfe.length,
             mitSvg:koepfe.filter(k=>k.querySelector('svg')).length,
             mitSchrift:koepfe.filter(k=>k.querySelector('i.ti')).length };
  });
  // Die Anzahl-Prüfung ist der Schutz gegen eine leere Wahrheit: Ohne sie wäre "alle Kacheln zeigen
  // ein svg" auch dann grün, wenn gar keine Kachel gerendert wurde.
  check('5b: die ausgerüsteten Modul-Kacheln sind gerendert', mods.anzahl >= 3, mods);
  if (mods.anzahl > 0){
    check('5b: jede zeigt ein gezeichnetes Icon', mods.mitSvg === mods.anzahl, mods);
    check('5b: keine mehr ein flaches Schrift-Icon', mods.mitSchrift === 0, mods);
  }
  // ------------------------------------------- 8b: Schiffsmodule am laufenden Spiel
  // Eigener Unterreiter, deshalb eigener Klick. Dieselbe Falle wie bei 5b: ohne Sockel
  // (shipModuleSlotLevel) gibt es keine Slots, keine Kacheln - und die Prüfung waere leer wahr.
  await page.evaluate(()=>{const b=document.querySelector('[data-officer-subtab="schiffsmodule"]'); if(b) b.click();});
  await page.waitForTimeout(500);
  const smods = await page.evaluate(()=>{
    const koepfe=[...document.querySelectorAll('.mod-head')];
    return { anzahl:koepfe.length,
             mitSvg:koepfe.filter(k=>k.querySelector('svg')).length,
             mitSchrift:koepfe.filter(k=>k.querySelector('i.ti')).length,
             // Zeigen die drei Kacheln nebeneinander wirklich verschiedene Bilder?
             verschieden:new Set(koepfe.map(k=>{const v=k.querySelector('svg');return v?v.innerHTML:'';})).size };
  });
  check('8b: die ausgerüsteten Schiffsmodul-Kacheln sind gerendert', smods.anzahl >= 3, smods);
  if (smods.anzahl > 0){
    check('8b: jede zeigt ein gezeichnetes Icon', smods.mitSvg === smods.anzahl, smods);
    check('8b: keine mehr ein flaches Schrift-Icon', smods.mitSchrift === 0, smods);
    check('8b: und die Kacheln einer Klasse zeigen verschiedene Bilder',
      smods.verschieden === smods.anzahl, smods);
  }
  // ------------------------------------------- 9b: Kostenzeilen am laufenden Spiel
  // Die eigentliche Messung. Ein fehlender RES_ICONS-Eintrag erzeugt weder Fehler noch falschen
  // Text - nur eine Zeile ohne Symbol. Genau das wird hier gesucht, an der Stelle, an der es dem
  // Spieler auffiel: den Baukosten der beiden Endgame-Schiffe.
  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="flotte"]'); if(b) b.click();});
  await page.waitForTimeout(1200);
  const kosten = await page.evaluate(()=>[...document.querySelectorAll('.costitem')]
    .map(e=>({ txt:e.textContent.trim(), svg:!!e.querySelector('svg'), ti:!!e.querySelector('i.ti') })));
  const t2Zeilen = kosten.filter(z=>/Metamaterial-Gewebe|Singularitätskerne|Fusionskerne|Hochenergiekristalle/.test(z.txt));
  check('9b: die Tier-2-Kostenzeilen sind überhaupt gerendert', t2Zeilen.length >= 4, t2Zeilen.length);
  const ohneBild = kosten.filter(z=>!z.svg && !z.ti);
  check('9b: keine einzige Kostenzeile steht ohne Symbol da', ohneBild.length === 0,
    ohneBild.slice(0,5).map(z=>z.txt));

  // ------------------------------------------- 10b: Fraktionskarten am laufenden Spiel
  // Wie bei den Offizieren: Die Icons könnten im Objekt liegen, ohne dass je eines zu sehen wäre -
  // die Karte schrieb ihr ti-flag vorher fest ins Markup. Und die Frage, um die es hier geht,
  // beantwortet nur das laufende Spiel: Zeigen die vier Karten VERSCHIEDENE Bilder?
  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="galaxie"]'); if(b) b.click();});
  await page.waitForTimeout(500);
  await page.evaluate(()=>{const b=document.querySelector('[data-galaxy-subtab="diplo"]'); if(b) b.click();});
  await page.waitForTimeout(1200);
  // Der factionBox enthält MEHR als die vier Fraktionskarten - Fraktionsladen, Botschafts-
  // Übersicht und Feindseligkeits-Warnung haben eigene .bicon-Kacheln und bleiben bewusst flach.
  // Ein pauschales querySelectorAll('.bicon') maß deshalb zehn Kacheln statt vier und schlug fehl.
  // Gesucht wird stattdessen je Fraktion die Karte, deren Überschrift ihren Namen trägt.
  const fak = await page.evaluate(namen => {
    const box=document.getElementById('factionBox');
    if(!box) return { fehlt:true };
    const treffer = namen.map(n => {
      const karte = [...box.querySelectorAll('.card-row')].find(c => {
        const t=c.querySelector('.bname'); return t && t.textContent.trim() === n;
      });
      if(!karte) return { name:n, karte:false };
      const kachel = karte.querySelector('.bicon');
      const svg = kachel && kachel.querySelector('svg');
      return { name:n, karte:true, svg:!!svg, schrift:!!(kachel && kachel.querySelector('i.ti')),
               bild: svg ? svg.innerHTML : null };
    });
    return { fehlt:false, treffer };
  }, ['Aschen-Kartell','Void-Marodeure','Eisenlegion','Schattenbund']);
  check('10b: der Fraktions-Bereich ist da', fak && !fak.fehlt, fak && fak.fehlt);
  if (fak && !fak.fehlt){
    check('10b: alle vier Fraktionskarten sind gerendert', fak.treffer.every(t=>t.karte),
      fak.treffer.filter(t=>!t.karte).map(t=>t.name));
    const da = fak.treffer.filter(t=>t.karte);
    check('10b: jede zeigt ein gezeichnetes Icon', da.every(t=>t.svg),
      da.filter(t=>!t.svg).map(t=>t.name));
    check('10b: keine mehr das flache Schrift-Icon', da.every(t=>!t.schrift),
      da.filter(t=>t.schrift).map(t=>t.name));
    check('10b: und die vier Karten zeigen verschiedene Bilder',
      new Set(da.map(t=>t.bild)).size === da.length, da.length+' Karten, '+new Set(da.map(t=>t.bild)).size+' Bilder');
  }

  // ------------------------------------------- 11b: Inventarliste am laufenden Spiel
  // Die Liste mischt ITEM_DEFS und EVENT_ITEM_DEFS. Gemessen wird deshalb nicht "es gibt Symbole",
  // sondern dass KEINE Zeile mehr flach ist - eine halb umgestellte Liste wäre der eigentliche
  // Fehler, den dieses Paket vermeiden sollte.
  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="fortschritt"]'); if(b) b.click();});
  await page.waitForTimeout(600);
  await page.evaluate(()=>{const h=document.querySelector('[data-sec-toggle="inventar"]'); if(h) h.click();});
  await page.waitForTimeout(900);
  const inv = await page.evaluate(()=>{
    const box=document.getElementById('inventoryBox');
    if(!box) return { fehlt:true };
    const k=[...box.querySelectorAll('.bicon')];
    return { fehlt:false, anzahl:k.length,
             mitSvg:k.filter(e=>e.querySelector('svg')).length,
             mitSchrift:k.filter(e=>e.querySelector('i.ti')).length,
             verschieden:new Set(k.map(e=>{const v=e.querySelector('svg'); return v?v.innerHTML:'-';})).size };
  });
  check('11b: die Inventarliste ist da', inv && !inv.fehlt, inv && inv.fehlt);
  if (inv && !inv.fehlt){
    check('11b: alle fünf Gegenstände des Spielstands sind gerendert', inv.anzahl >= 5, inv);
    check('11b: jede Zeile zeigt ein gezeichnetes Icon', inv.mitSvg === inv.anzahl, inv);
    check('11b: keine einzige Zeile ist noch flach', inv.mitSchrift === 0, inv);
    check('11b: und die Zeilen zeigen verschiedene Bilder', inv.verschieden === inv.anzahl, inv);
  }

  check('keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
  console.log('\n' + (fail ? 'FAIL' : 'PASS'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
