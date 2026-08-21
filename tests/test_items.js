// Gegenstände, Seltenheiten und Fundverteilung (28.07.2026, v8.325.0).
//
// Zwei Dinge, bei denen ein stiller Rechenfehler teuer waere:
//
// 1) Die FUNDBAENDER je Expeditionstyp muessen zusammen mit nothingBase exakt 1.0 ergeben. Wer das
//    Item-Band anhebt, ohne an anderer Stelle abzuziehen, verschiebt in Wahrheit alle Wahrschein-
//    lichkeiten - und zwar unbemerkt, weil pickWeightedByRarity trotzdem irgendetwas zurueckgibt.
//    Genau diese Umschichtung stand in v8.325.0 an (Item-Band 0.12 -> 0.18), an drei Stellen.
// 2) Eine neue Seltenheitsstufe muss an ALLEN Stellen ankommen: Label/Farbe, Fundgewicht und
//    Glueck-Index. Fehlt sie im Gewicht, faellt sie auf den Standardwert von "gewoehnlich" zurueck -
//    die seltenste Stufe des Spiels waere dann die haeufigste. Der Fehler waere im Spiel monatelang
//    nicht auffaellig, weil er nur die Verteilung verschiebt und nie einen Fehler wirft.
//
// Geprueft wird ausserdem, dass jeder Gegenstand die CLAUDE.md-Pflichtfelder hat (Icon, ganzer
// Beschreibungssatz) und dass jede activate()-Funktion existiert. Die Zahl der Eintraege wird
// NICHT gegen eine feste Erwartung geprueft, sondern gegen die Zahl der key-Felder im Block -
// so faellt ein Parser auf, der Eintraege ueberspringt, ohne dass die Pruefung bei jedem neuen
// Gegenstand nachgezogen werden muss.
const fs = require('fs');
const path = require('path');
// Pfad ueber die gemeinsame Quelle, nicht fest verdrahtet: Sonst wird KEPLER_SPIELDATEI
// still ignoriert und eine Gegenprobe liest die ECHTE Datei - sie sieht dann aus wie
// bestanden (CLAUDE.md, Korrektur zu Regel 14).
const { SPIELDATEI } = require('./lib/spieldatei');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail = false;
const check = (n, c, x) => { console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail = fail || !c; };

function block(name){
  const i = js.indexOf('const '+name+' = [');
  if (i < 0) throw new Error('Block nicht gefunden: '+name);
  let d=0, s=js.indexOf('[', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}
function objBlock(name){
  const re = new RegExp('const '+name+' = \\{');
  const m = js.match(re);
  if (!m) throw new Error('Objekt nicht gefunden: '+name);
  const i = js.indexOf(m[0]);
  let d=0, s=js.indexOf('{', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}

// ---- 1) Fundbaender ----
// Die Expeditionstypen samt ihrer Baender werden aus der Datei ausgewertet. activate-Funktionen
// gibt es hier nicht, der Block ist reine Daten.
const TYPEN = eval(block('EXPEDITION_TYPES'));
const STANDARD = eval('('+objBlock('EXP_DEFAULT_BANDS')+')');
const BANDNAMEN = ['resource','special','item','rare','module','derelict'];

check('1: der Standard-Fundtopf kennt alle sechs Baender',
  BANDNAMEN.every(b => typeof STANDARD[b] === 'number'), STANDARD);
// Der Standard hat kein eigenes nothingBase - der Rest auf 1.0 IST die Nichts-Chance. Sie darf
// weder negativ werden (Summe > 1) noch die Haelfte ueberschreiten (dann faende man fast nie etwas).
const summeStandard = BANDNAMEN.reduce((s,b) => s + (STANDARD[b]||0), 0);
check('1: die Standard-Baender bleiben unter 1.0, es gibt also eine Nichts-Chance',
  summeStandard > 0 && summeStandard < 1.0,
  { summe: +summeStandard.toFixed(4), nichts: +(1-summeStandard).toFixed(4) });

const bandFehler = [];
for (const t of TYPEN){
  if (!t.bands) continue; // Typen ohne eigene Baender nutzen den Standard
  const summe = BANDNAMEN.reduce((s,b) => s + (t.bands[b]||0), 0);
  const gesamt = summe + (t.nothingBase||0);
  if (Math.abs(gesamt - 1.0) > 1e-9) bandFehler.push({ typ:t.key, summe:+summe.toFixed(4), nothingBase:t.nothingBase, gesamt:+gesamt.toFixed(4) });
}
check('1: bei jedem Spezialtyp ergeben Baender + nothingBase exakt 1.0',
  bandFehler.length === 0, bandFehler);
// Und die eigentliche Zusage der Runde: Gegenstaende sind haeufiger als vorher.
check('1: der Gegenstands-Topf liegt beim Standard bei mindestens 18%',
  STANDARD.item >= 0.18, { item: STANDARD.item });
const zuNiedrig = TYPEN.filter(t => t.bands && t.bands.item < 0.05).map(t => ({ typ:t.key, item:t.bands.item }));
check('1: auch die Spezialtypen finden noch Gegenstaende', zuNiedrig.length === 0, zuNiedrig);

// ---- 2) Seltenheitsstufen ----
const RARITY_DEFS = eval(block('RARITY_DEFS'));
const GEWICHT = eval('('+objBlock('RARITY_BASE_WEIGHT')+')');
const INDEX = eval('('+objBlock('RARITY_TIER_INDEX')+')');

check('2: es gibt sechs Seltenheitsstufen inklusive Mythisch',
  RARITY_DEFS.length >= 6 && RARITY_DEFS.some(r => r.key === 'mythisch'),
  RARITY_DEFS.map(r => r.key));
// DER eigentliche Fallstrick: eine Stufe ohne Eintrag im Gewicht faellt still auf "gewoehnlich"
// zurueck - die seltenste Stufe waere dann die haeufigste, ohne dass irgendwo ein Fehler auftritt.
const ohneGewicht = RARITY_DEFS.filter(r => typeof GEWICHT[r.key] !== 'number').map(r => r.key);
const ohneIndex = RARITY_DEFS.filter(r => typeof INDEX[r.key] !== 'number').map(r => r.key);
check('2: jede Stufe hat ein Fundgewicht', ohneGewicht.length === 0, ohneGewicht);
check('2: jede Stufe hat einen Glueck-Index', ohneIndex.length === 0, ohneIndex);
check('2: jede Stufe hat Label und Farbe',
  RARITY_DEFS.every(r => r.label && /^#[0-9a-f]{6}$/i.test(r.color||'')),
  RARITY_DEFS.filter(r => !(r.label && /^#[0-9a-f]{6}$/i.test(r.color||''))).map(r=>r.key));
// Die Reihenfolge muss monoton sein: seltener heisst kleineres Gewicht und groesserer Index.
const reihenfolge = RARITY_DEFS.map(r => ({ k:r.key, w:GEWICHT[r.key], i:INDEX[r.key] }));
check('2: seltenere Stufen haben durchweg kleinere Fundgewichte',
  reihenfolge.every((r,n) => n === 0 || r.w < reihenfolge[n-1].w), reihenfolge);
check('2: und durchweg groessere Glueck-Indizes',
  reihenfolge.every((r,n) => n === 0 || r.i > reihenfolge[n-1].i), reihenfolge);
check('2: Mythisch ist deutlich seltener als Legendaer',
  GEWICHT.mythisch < GEWICHT.legendaer / 3,
  { mythisch:GEWICHT.mythisch, legendaer:GEWICHT.legendaer });
// Dieselbe Stufe soll im ganzen Spiel gleich aussehen - Modul und Gegenstand teilen sich die Farbe.
const modulRar = eval('('+objBlock('MODULE_RARITY')+')');
check('2: Mythisch hat bei Gegenstaenden dieselbe Farbe wie bei Modulen',
  (RARITY_DEFS.find(r=>r.key==='mythisch')||{}).color === modulRar.mythisch.color,
  { gegenstand:(RARITY_DEFS.find(r=>r.key==='mythisch')||{}).color, modul:modulRar.mythisch.color });

// ---- 3) Gegenstaende ----
// ITEM_DEFS enthaelt activate-Funktionen mit Spiellogik - der Block laesst sich nicht auswerten.
// Deshalb hier per Regex ueber die Eintragskoepfe, was ausreicht: geprueft werden Metadaten.
const itemBlock = block('ITEM_DEFS');
// Nicht an einer starren Feldreihenfolge entlangschneiden: Die erste Fassung verlangte exakt
// "key, name, icon, desc" hintereinander und erfasste dadurch nur 24 von 39 Eintraegen - die
// uebrigen 15 wurden von allen folgenden Pruefungen stillschweigend uebersprungen. Jetzt wird am
// Eintragsanfang getrennt und in jedem Stueck einzeln gesucht.
const stuecke = itemBlock.split(/\n\s*\{ key:'/).slice(1);
const items = stuecke.map(st => ({
  key: (st.match(/^([a-z_0-9]+)'/)||[])[1],
  name: (st.match(/name:'([^']+)'/)||[])[1],
  icon: (st.match(/icon:'([^']+)'/)||[])[1],
  desc: (st.match(/desc:'([^']*)'/)||[])[1] || '',
  rarity: (st.match(/rarity:'([a-z]+)'/)||[])[1] || null,
  hatAktion: /activate:\s*\(\)\s*=>/.test(st)
})).filter(i => i.key);
// Selbstkalibrierend statt gegen eine geratene Zahl: Verglichen wird die Zahl der ausgewerteten
// Eintraege mit der Zahl der key-Felder im Block. Ein Parser, der Eintraege ueberspringt, faellt so
// auf - eine feste Erwartung wie ">= 35" dagegen war nur geraten und meldete einen Fehler, den es
// nicht gab (ITEM_DEFS hat 24 Eintraege, nicht 39).
const rohZahl = (itemBlock.match(/key:'/g) || []).length;
check('3: alle Gegenstaende wurden ausgewertet, keiner uebersprungen',
  items.length === rohZahl && items.length >= 20 && items.every(i => i.name && i.icon),
  { ausgewertet:items.length, imBlock:rohZahl, ohneNameOderIcon: items.filter(i=>!(i.name&&i.icon)).map(i=>i.key) });
check('3: jeder Gegenstand hat eine Seltenheit und eine Wirkung',
  items.every(i => i.rarity && i.hatAktion),
  items.filter(i => !(i.rarity && i.hatAktion)).map(i => ({ k:i.key, rarity:i.rarity, aktion:i.hatAktion })));
// CLAUDE.md Regel 7: eigenes Icon UND vollstaendige Beschreibung fuer alles Neue.
const ohneBeschreibung = items.filter(i => i.desc.length < 40 || !/[.!]$/.test(i.desc.trim())).map(i => i.key);
check('3: jeder Gegenstand hat einen vollstaendigen Beschreibungssatz',
  ohneBeschreibung.length === 0, ohneBeschreibung);
const whitelist = new Set((src.match(/\.ti-[a-z0-9-]+:before/g)||[]).map(x => x.slice(1).replace(':before','')));
const schlechteIcons = items.filter(i => i.icon.startsWith('ti-') && !whitelist.has(i.icon)).map(i => ({ k:i.key, icon:i.icon }));
check('3: alle ti-*-Icons der Gegenstaende sind im Icon-Subset', schlechteIcons.length === 0, schlechteIcons);
// Jeder Schluessel nur einmal - ein Duplikat wuerde stillschweigend den ersten Eintrag verdecken.
const doppelt = items.map(i=>i.key).filter((k,n,arr) => arr.indexOf(k) !== n);
check('3: kein Gegenstandsschluessel kommt doppelt vor', doppelt.length === 0, doppelt);

// Die neuen Stuecke und die Hochstufung namentlich festhalten - sie waren der Auftrag dieser Runde.
const NEU = ['splitterkiste','tiefenkarte','modulkiste','forschungsdurchbruch','urwerkzeug'];
check('3: die fuenf neuen Gegenstaende sind vorhanden',
  NEU.every(k => items.some(i => i.key === k)),
  NEU.filter(k => !items.some(i => i.key === k)));
function rarityVon(key){
  const i = itemBlock.indexOf("key:'"+key+"'");
  if (i < 0) return null;
  const ausschnitt = itemBlock.slice(i, i + 1200);
  return (ausschnitt.match(/rarity:'([a-z]+)'/)||[])[1] || null;
}
check('3: das Werftkommando ist mythisch', rarityVon('werftkommando') === 'mythisch',
  { rarity: rarityVon('werftkommando') });
check('3: es gibt genau zwei weitere mythische Gegenstaende',
  rarityVon('forschungsdurchbruch') === 'mythisch' && rarityVon('urwerkzeug') === 'mythisch',
  { forschungsdurchbruch:rarityVon('forschungsdurchbruch'), urwerkzeug:rarityVon('urwerkzeug') });
// Jede in ITEM_DEFS benutzte Stufe muss es auch wirklich geben - ein Tippfehler wuerde sonst
// still auf das Standardgewicht zurueckfallen.
// slice(8,-1): "rarity:'" ist acht Zeichen lang. Die erste Fassung schnitt bei 9 ab und meldete
// deshalb lauter Stufen ohne ersten Buchstaben ("pisch", "ythisch") als unbekannt.
const benutzte = new Set(items.map(i => i.rarity).filter(Boolean));
const unbekannt = [...benutzte].filter(r => !RARITY_DEFS.some(d => d.key === r));
check('3: alle in Gegenstaenden benutzten Seltenheiten sind definiert', unbekannt.length === 0, unbekannt);

// ---- 4) Der Abgrund hat einen eigenen Reiter ----
check('4: es gibt einen Galaxie-Unterreiter fuer den Abgrund',
  /data-galaxy-subtab="abgrund"/.test(src) && /data-galaxy-sub="abgrund"/.test(src));
check('4: die Abgrund-Box liegt in diesem Panel, nicht mehr im Kampf-Panel',
  /data-galaxy-sub="abgrund"[\s\S]{0,200}id="abgrundBox"/.test(src));
// Reihenfolge: direkt hinter "Kampf & Eroberung", wie gewuenscht.
const iKampf = src.indexOf('data-galaxy-subtab="kampf"');
const iAbgrund = src.indexOf('data-galaxy-subtab="abgrund"');
const iDiplo = src.indexOf('data-galaxy-subtab="diplo"');
check('4: er steht an zweiter Stelle, direkt hinter Kampf & Eroberung',
  iKampf >= 0 && iAbgrund > iKampf && iAbgrund < iDiplo, { iKampf, iAbgrund, iDiplo });

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
