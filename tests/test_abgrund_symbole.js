// Gezeichnete Symbole des Abgrunds (28.07.2026, v8.328.0).
//
// Der Fehler, den dieser Test verhindert, ist nicht "kein Bild", sondern "dasselbe Bild".
// Vor v8.328.0 trugen die 24 Mutatoren Schrift-Icons aus dem Tabler-Font, davon VIER PAARE
// doppelt (Kristallsporen/Kristallschlund, Spiegelfeld/Funkenflug, Splitterregen/Blindgaenger,
// Resonanzader/Altes Signal), und alle zwoelf Waechter denselben Totenkopf. Das faellt nie als
// Fehler auf - es sieht nur aus, als waere es Absicht. Genau dafuer ist eine automatische
// Pruefung da.
//
// Geprueft wird deshalb in dieser Reihenfolge:
//   1) VOLLSTAENDIGKEIT: jeder Mutator und jeder Waechter hat eine Zeichnung. Die Zahl wird NICHT
//      gegen eine feste Erwartung geprueft, sondern gegen die Zahl der Eintraege in den DEFS -
//      sonst muesste man diesen Test bei jedem neuen Mutator nachziehen und wuerde es vergessen.
//   2) EINDEUTIGKEIT: keine zwei Eintraege teilen sich dieselbe Zeichnung.
//   3) SUBSTANZ: eine Zeichnung ist kein leerer Kreis. Mindestlaenge und mindestens zwei Pfade.
//   4) VERDRAHTUNG: die echten Funktionen werden AUSGEFUEHRT (nicht im Quelltext gesucht) und ihr
//      Ergebnis geprueft - inklusive der Frage, ob abgrundWaechterBild() bei der zyklischen
//      Wiederkehr denselben Index nimmt wie abgrundWaechterDef() fuer den Namen. Laufen die
//      auseinander, steht unter dem Portrait der Stillen Masse der Text des Offenen Tors, und
//      niemand merkt es je.
//   5) KEINE ZWEITE QUELLE: das tote icon:'ti-*'-Feld der Mutatoren ist weg. Ein Feld, das
//      aussieht wie die Bildquelle, es aber nicht mehr ist, ist schlimmer als keins.
const fs = require('fs');
const path = require('path');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail = false;
const check = (n, c, x) => { console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail = fail || !c; };

function klammerBlock(start, auf, zu){
  let d = 0, s = js.indexOf(auf, start), k = s;
  for (; k < js.length; k++){ if (js[k]===auf) d++; else if (js[k]===zu){ d--; if(!d) break; } }
  return js.slice(s, k+1);
}
function arrAus(name){
  const i = js.indexOf('const '+name+' = [');
  if (i < 0) throw new Error('Array nicht gefunden: '+name);
  return klammerBlock(i, '[', ']');
}
function objAus(name){
  const i = js.indexOf('const '+name+' = {');
  if (i < 0) throw new Error('Objekt nicht gefunden: '+name);
  return klammerBlock(i, '{', '}');
}
function fnAus(name){
  const m = js.match(new RegExp('function\\s+'+name+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+name);
  const i = js.indexOf(m[0]);
  let d = 0, s = js.indexOf('{', i + m[0].length), k = s;
  for (; k < js.length; k++){ if (js[k]==='{') d++; else if (js[k]==='}'){ d--; if(!d) break; } }
  return js.slice(i, k+1);
}

const MUTATOREN = eval(arrAus('ABGRUND_MUTATOREN'));
const SYMBOLE   = eval('('+objAus('ABGRUND_SYMBOLE')+')');
const BILDER    = eval(arrAus('ABGRUND_WAECHTER_BILDER'));
const NAMEN     = eval(arrAus('ABGRUND_WAECHTER_NAMEN'));

// ---- 1) Vollstaendigkeit ----
const ohneSymbol = MUTATOREN.filter(m => !SYMBOLE[m.key]).map(m => m.key);
check('1: jeder Mutator hat eine eigene Zeichnung', ohneSymbol.length === 0,
  { mutatoren: MUTATOREN.length, symbole: Object.keys(SYMBOLE).length, fehlen: ohneSymbol });
// Andersherum genauso: eine Zeichnung ohne Mutator ist eine Leiche, die beim naechsten Umbau
// jemanden glauben laesst, der Mutator existiere noch.
const schluessel = new Set(MUTATOREN.map(m => m.key));
const verwaist = Object.keys(SYMBOLE).filter(k => !schluessel.has(k));
check('1: es gibt keine Zeichnung ohne zugehoerigen Mutator', verwaist.length === 0, verwaist);
check('1: jeder Waechter der Namensliste hat ein Portrait',
  BILDER.length === NAMEN.length, { namen: NAMEN.length, bilder: BILDER.length });

// ---- 2) Eindeutigkeit ----
// Der eigentliche Punkt der ganzen Runde. Verglichen werden die Pfaddaten selbst.
function doppelte(werte){
  const gesehen = new Map(), treffer = [];
  werte.forEach(([name, v]) => {
    const norm = String(v).replace(/\s+/g,' ').trim();
    if (gesehen.has(norm)) treffer.push([gesehen.get(norm), name]); else gesehen.set(norm, name);
  });
  return treffer;
}
const dopplMut = doppelte(Object.entries(SYMBOLE));
check('2: keine zwei Mutatoren teilen sich dieselbe Zeichnung', dopplMut.length === 0, dopplMut);
const dopplWae = doppelte(BILDER.map((b,i) => [NAMEN[i] ? NAMEN[i].name : '#'+i, b]));
check('2: keine zwei Waechter teilen sich dasselbe Portrait', dopplWae.length === 0, dopplWae);

// ---- 3) Substanz ----
// Untergrenzen bewusst niedrig: Sie sollen "Platzhalter" von "Zeichnung" trennen, nicht Stil
// vorschreiben. Das kuerzeste echte Symbol (Leerenstille: ein Kreis und ein Strich) liegt knapp
// darueber und ist Absicht - Leere sieht leer aus.
const zuDuenn = Object.entries(SYMBOLE).filter(([k,v]) => v.length < 40 || (v.match(/<(path|circle|ellipse)/g)||[]).length < 2);
check('3: jede Mutator-Zeichnung besteht aus mindestens zwei Formen', zuDuenn.length === 0,
  zuDuenn.map(([k,v]) => k+' ('+v.length+' Zeichen)'));
const duenneW = BILDER.map((b,i)=>[i,b]).filter(([i,v]) => v.length < 40 || (v.match(/<(path|circle|ellipse)/g)||[]).length < 2);
check('3: jedes Waechter-Portrait besteht aus mindestens zwei Formen', duenneW.length === 0,
  duenneW.map(([i]) => NAMEN[i] && NAMEN[i].name));
// currentColor statt fester Farbe: nur so gilt die vorhandene Farblogik (violett gesehen, grau
// unbekannt, blass gebannt) weiter, ohne dass eine Aufrufstelle davon wissen muss.
const festeFarbe = Object.entries(SYMBOLE).concat(BILDER.map((b,i)=>['waechter'+i,b]))
  .filter(([k,v]) => /#[0-9a-fA-F]{3,6}/.test(v));
check('3: keine Zeichnung schreibt eine Farbe fest ein (alles erbt currentColor)',
  festeFarbe.length === 0, festeFarbe.map(([k])=>k));

// ---- 4) Die echten Funktionen ausfuehren ----
const umgebung = new Function(`
  ${objAus('ABGRUND_SYMBOLE') ? 'const ABGRUND_SYMBOLE = '+objAus('ABGRUND_SYMBOLE')+';' : ''}
  const ABGRUND_WAECHTER_BILDER = ${arrAus('ABGRUND_WAECHTER_BILDER')};
  const ABGRUND_WAECHTER_NAMEN = ${arrAus('ABGRUND_WAECHTER_NAMEN')};
  const ABGRUND_WAECHTER_ALLE = ${(js.match(/const ABGRUND_WAECHTER_ALLE = (\d+)/)||[])[1]};
  ${fnAus('abgrundIstWaechter')}
  ${fnAus('abgrundWaechterDef')}
  ${fnAus('abgrundMutatorSymbol')}
  ${fnAus('abgrundWaechterBild')}
  return { abgrundMutatorSymbol, abgrundWaechterBild, abgrundWaechterDef, abgrundIstWaechter };
`)();

const einSymbol = umgebung.abgrundMutatorSymbol('ionensturm', 22);
check('4: abgrundMutatorSymbol liefert ein vollstaendiges <svg> in der gewuenschten Groesse',
  /^<svg /.test(einSymbol) && einSymbol.includes('width="22"') && einSymbol.includes('</svg>')
    && einSymbol.includes('stroke="currentColor"'));
check('4: ein unbekannter Schluessel liefert bewusst NICHTS statt eines stillen Ersatzbildes',
  umgebung.abgrundMutatorSymbol('gibtesnicht', 22) === '');
// Jeder Mutator muss auch wirklich durch die Funktion kommen - der Zwischenschritt (Objekt hat den
// Schluessel) reicht nicht, wenn die Funktion ihn nie findet.
const durchgefallen = MUTATOREN.filter(m => !/^<svg /.test(umgebung.abgrundMutatorSymbol(m.key, 20)));
check('4: alle Mutatoren kommen durch abgrundMutatorSymbol() durch', durchgefallen.length === 0,
  durchgefallen.map(m=>m.key));

check('4: eine Tiefe ohne Waechter bekommt kein Portrait',
  umgebung.abgrundWaechterBild(7, 60) === '' && umgebung.abgrundWaechterBild(11, 60) === '');
check('4: jede Waechtertiefe der ersten Runde bekommt ein Portrait',
  NAMEN.every((_,i) => /^<svg /.test(umgebung.abgrundWaechterBild((i+1)*10, 60))));

// DIE Frage dieser Runde: Bild und Name muessen aus derselben Rechnung kommen. Geprueft ueber die
// zyklische Wiederkehr hinaus - dort waere ein Versatz am leichtesten unbemerkt geblieben.
const versatz = [];
for (let t = 10; t <= 10 * NAMEN.length * 3; t += 10){
  const bild = umgebung.abgrundWaechterBild(t, 60);
  const name = umgebung.abgrundWaechterDef(t).name;
  const grundname = name.replace(/ \(\d+\. Wiederkehr\)$/, '');
  const erwarteterIndex = NAMEN.findIndex(n => n.name === grundname);
  const erwartetesBild = BILDER[erwarteterIndex % BILDER.length];
  if (!bild.includes(erwartetesBild)) versatz.push({ tiefe: t, name });
}
check('4: Portrait und Name gehoeren ueber drei volle Wiederkehr-Runden zusammen',
  versatz.length === 0, versatz.slice(0,5));

// ---- 5) Keine zweite Bildquelle mehr ----
const mutBlock = arrAus('ABGRUND_MUTATOREN');
check("5: die Mutatoren tragen kein totes icon:'ti-*'-Feld mehr",
  !/icon:\s*'ti-/.test(mutBlock));
// Nur der Rumpf der Abgrund-Box, nicht die ganze Datei: `${m.icon}` kommt anderswo voellig
// legitim vor (Tagesbonus-Meilensteine), und ein Suchlauf ueber alles wuerde daran haengen
// bleiben statt an dem, was hier gemeint ist.
const abgrundBoxRumpf = fnAus('renderAbgrundBox');
check('5: keine Anzeigestelle der Abgrund-Box zeichnet einen Mutator noch als Schrift-Icon',
  !/\$\{m\.icon\}/.test(abgrundBoxRumpf) && !/m\.icon:/.test(abgrundBoxRumpf)
    && !/ti-skull/.test(abgrundBoxRumpf.split('waechter-tafel')[1] || ''),
  { treffer: (abgrundBoxRumpf.match(/m\.icon/g)||[]).length });
// Die Waechter-Tafel muss das Portrait auch wirklich einsetzen - eine gezeichnete Datei, die
// nirgends gerendert wird, ist genau der Fehler aus v8.326.0 (abgrundBest wurde nie geschrieben).
check('5: die Sektorkarte ruft abgrundWaechterBild() auf',
  /abgrundWaechterBild\(tiefe/.test(js));
check('5: die Tiefensonde und das Verzeichnis rufen abgrundMutatorSymbol() auf',
  (js.match(/abgrundMutatorSymbol\(/g)||[]).length >= 4,
  { aufrufe: (js.match(/abgrundMutatorSymbol\(/g)||[]).length });

// ---- 6) Abstiegs-Panorama (Entwurf 03) ----
// Das Panorama soll DREI Dinge tun, die alle still ausfallen koennen, ohne dass etwas kaputtgeht:
// mit der Tiefe dunkler werden, auf Mutatoren reagieren, und bei einem Waechter rot werden. Faellt
// eins davon weg, sieht jede Tiefe wieder gleich aus - also genau der Zustand, den diese Runde
// beheben sollte. Geprueft wird deshalb NICHT "es kommt ein <svg> zurueck", sondern dass sich das
// Ergebnis zwischen verschiedenen Eingaben messbar unterscheidet.
// Die Tiefenpalette (v8.345.0) gehoert mit in die Umgebung: Das Panorama liest seit dieser Version
// JEDE Farbe aus ihr. Sie wird ECHT mitgeladen und nicht attrappiert - waere sie eine Attrappe mit
// festen Farben, pruefte der Test die Attrappe statt die Farbreise.
const panoUmgebung = new Function(`
  ${fnAus('abgrundRng')}
  const ABGRUND_PANORAMA_TIEFE_STERNE = ${(js.match(/const ABGRUND_PANORAMA_TIEFE_STERNE = (\d+)/)||[])[1]};
  ${fnAus('abgrundMisch')}
  const ABGRUND_FARBSTATIONEN = ${(js.match(/const ABGRUND_FARBSTATIONEN = (\[[\s\S]*?\n  \]);/)||[])[1]};
  const ABGRUND_FARB_WENDE = ${(js.match(/const ABGRUND_FARB_WENDE\s*=\s*(\d+)/)||[])[1]};
  const ABGRUND_FARB_TIEF = ${(js.match(/const ABGRUND_FARB_TIEF\s*=\s*(\d+)/)||[])[1]};
  ${fnAus('abgrundTiefenFarben')}
  // Die Ankunfts-Marke (v8.345.0) steht bewusst auf 0: Dieser Abschnitt prueft das RUHENDE Bild.
  // Die Ankunft selbst hat ihren eigenen Nachweis weiter unten - dort wird sie auf einen Zeitpunkt
  // in der Zukunft gesetzt und die Klasse am Wurzelelement geprueft.
  let abgrundAnkunftBis = 0;
  ${fnAus('abgrundPanorama')}
  return function(sektor, faellt, ankunftBis){ abgrundAnkunftBis = ankunftBis || 0; return abgrundPanorama(sektor, faellt); };
`)();
const sek = (tiefe, keys, waechter) => ({ tiefe, mutatoren: (keys||[]).map(k => ({ key:k })), waechter: waechter||null });
const zaehlSterne = svgTxt => (svgTxt.match(/class="pano-stern"/g)||[]).length;

const flach = panoUmgebung(sek(2, ['ionensturm']), 0);
const tief  = panoUmgebung(sek(55, ['ionensturm']), 0);
const ganzTief = panoUmgebung(sek(80, ['ionensturm']), 0);
check('6: das Panorama ist ein vollstaendiges <svg> mit eigener Klasse',
  /^<svg class="abgrund-panorama"/.test(flach) && flach.includes('</svg>'));
// Die Sternzahl faellt streng ueber die Tiefe und ist ab ABGRUND_PANORAMA_TIEFE_STERNE ganz weg.
// Beides wird gemessen, nicht geraten: die Grenze steht in der Konstante, nicht in diesem Test.
check('6: mit der Tiefe werden die Sterne weniger',
  zaehlSterne(flach) > zaehlSterne(tief) && zaehlSterne(tief) > zaehlSterne(ganzTief),
  { tiefe2: zaehlSterne(flach), tiefe55: zaehlSterne(tief), tiefe80: zaehlSterne(ganzTief) });
check('6: jenseits der Sternengrenze ist kein Stern mehr da',
  zaehlSterne(ganzTief) === 0, { tiefe80: zaehlSterne(ganzTief) });
check('6: die Leerenstille raeumt den Himmel komplett leer',
  zaehlSterne(panoUmgebung(sek(2, ['leerenstille']), 0)) === 0);
// Zwei Sektoren derselben Tiefe mit VERSCHIEDENEN Mutatoren muessen verschieden aussehen - sonst
// malt der Mutator gar nicht mit, und das faellt an einem einzelnen Bild nie auf.
const mitKristall = panoUmgebung(sek(20, ['kristallsporen']), 0);
const mitTruemmer = panoUmgebung(sek(20, ['truemmerdicht']), 0);
const ohne        = panoUmgebung(sek(20, ['nullzone']), 0);
check('6: verschiedene Mutatoren malen verschieden (Kristall vs. Truemmer vs. keiner)',
  mitKristall !== mitTruemmer && mitKristall !== ohne && mitTruemmer !== ohne
    && mitKristall.includes('#5dcaa5') && mitTruemmer.includes('#8f9bb5') && !ohne.includes('#5dcaa5'));
// Rot ist im Panorama fuer den Waechter reserviert. Steht es auch ohne einen da, ist das Signal weg.
const mitW  = panoUmgebung(sek(30, ['nullzone'], { name:'X' }), 0);
check('6: nur ein Waechtersektor bringt Rot ins Panorama',
  mitW.includes('#e24b4a') && !ohne.includes('#e24b4a'));
// Determinismus: derselbe Sektor muss zweimal dasselbe Bild ergeben, sonst wuerde ein Neuladen
// umzeichnen - genau das, was der Abgrund seit v8.320.0 ausdruecklich nicht tut.
check('6: dasselbe Panorama wird zweimal identisch gezeichnet',
  panoUmgebung(sek(47, ['ionensturm','wracklinie']), 0) === panoUmgebung(sek(47, ['ionensturm','wracklinie']), 0));
check('6: verschiedene Tiefen ergeben verschiedene Panoramen',
  panoUmgebung(sek(47, ['ionensturm']), 0) !== panoUmgebung(sek(48, ['ionensturm']), 0));

// ---- 7) Kartenraum (Entwurf 06) ----
const krUmgebung = new Function(`
  const ABGRUND_WAECHTER_ALLE = ${(js.match(/const ABGRUND_WAECHTER_ALLE = (\d+)/)||[])[1]};
  ${fnAus('abgrundKartenraumTiefen')}
  ${fnAus('abgrundHeuteKurz')}
  return { abgrundKartenraumTiefen, abgrundHeuteKurz };
`)();
check('7: ohne einen einzigen Tauchgang steht genau eine Station da (das erste Ziel)',
  JSON.stringify(krUmgebung.abgrundKartenraumTiefen(0)) === '[10]', krUmgebung.abgrundKartenraumTiefen(0));
check('7: unter dem Rekord steht immer genau eine noch verschlossene Station',
  krUmgebung.abgrundKartenraumTiefen(34).slice(-1)[0] === 40
    && krUmgebung.abgrundKartenraumTiefen(40).slice(-1)[0] === 50,
  { bei34: krUmgebung.abgrundKartenraumTiefen(34), bei40: krUmgebung.abgrundKartenraumTiefen(40) });
check('7: die Stationen sind lueckenlos in Zehnerschritten',
  krUmgebung.abgrundKartenraumTiefen(97).every((t,i) => t === (i+1)*10));
// Das Datum ist eine Zeichenkette, KEIN Zeitstempel - ein Date.now() koennte die
// Backend-Zahlengrenzen reissen und dann speichert gar nichts mehr (CLAUDE.md, Vorfall 21.07.2026).
const heute = krUmgebung.abgrundHeuteKurz();
check('7: der Eroberungstag ist eine Zeichenkette im Format JJJJ-MM-TT, keine Zahl',
  typeof heute === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(heute), heute);
check('7: merkeWaechterSieg ueberschreibt einen vorhandenen Tag NICHT (Ersteroberung zaehlt)',
  /if \(!a\.waechterTage\[tiefe\]\)/.test(fnAus('merkeWaechterSieg')));
check('7: der Tag wird bei der AUFLOESUNG gesetzt, nicht beim Rendern',
  /merkeWaechterSieg\(tiefe\)/.test(js) && !/merkeWaechterSieg\(/.test(fnAus('renderAbgrundBox')));

// ---- 8) Tauchgang-Streifen (Entwurf 07) ----
const boxQuelle = fnAus('renderAbgrundBox');
check('8: der Streifen erscheint NUR, solange eine Abgrund-Mission laeuft',
  /\$\{busy \? '<div class="tauchgang-streifen"/.test(boxQuelle));
check('8: es gibt eine CSS-Regel dafuer, samt Bewegung',
  /\.tauchgang-streifen\s*\{/.test(src) && /@keyframes tauchgangZug/.test(src));
// Bewegung ohne Ruecksicht auf prefers-reduced-motion ist ein Barrierefreiheits-Fehler und faellt
// beim Ansehen nie auf, weil die meisten die Einstellung nicht gesetzt haben.
const bewegteKlassen = ['tauchgang-streifen', 'waechter-portrait'];
const fehlendeRuecksicht = bewegteKlassen.filter(k => {
  const i = src.indexOf('@media (prefers-reduced-motion: reduce)');
  return !new RegExp('@media \\(prefers-reduced-motion: reduce\\)[^}]*\\.'+k).test(src.replace(/\s+/g,' '));
});
check('8: jede neue Bewegung steht bei prefers-reduced-motion still',
  fehlendeRuecksicht.length === 0, fehlendeRuecksicht);

// ---- 9) Lebendes Panorama (v8.329.0, Entwurf 06) ----
// Parallax hat genau zwei Arten, still kaputtzugehen, und beide sieht man erst nach Sekunden:
//   a) Eine Bahn ohne Kopie reisst nach einem Durchlauf eine leere Bahn auf.
//   b) Der Verschiebeweg im CSS und die Bildhoehe im JS laufen auseinander - dann springt das Bild
//      bei jedem Durchlauf. Das ist der CLAUDE.md-Regel-6-Fall in Reinform: EINE Groesse, zwei
//      Stellen. Deshalb wird die Hoehe aus dem Quelltext gezogen und mit dem Keyframe verglichen,
//      statt beide Zahlen hier abzuschreiben.
const panoMitFall = panoUmgebung(sek(20, ['nullzone']), true);
const panoOhneFall = panoUmgebung(sek(20, ['nullzone']), false);
check('9: das Panorama hat drei getrennte Zieh-Schichten',
  ['pano-fern','pano-mitte','pano-nah'].every(k => panoOhneFall.includes('class="'+k+'"')));
check('9: die Klasse "faellt" haengt NUR dran, solange ein Tauchgang laeuft',
  panoMitFall.includes('abgrund-panorama faellt') && !panoOhneFall.includes('faellt'));
// Jede Bahn traegt ihren Inhalt zweimal - einmal am Platz, einmal um H versetzt.
const hoeheJs = Number((fnAus('abgrundPanorama').match(/W = \d+, H = (\d+)/)||[])[1]);
// Gesucht wird die WOERTLICHE Zeichenkette statt einer zusammengebauten Regex: Beim ersten Anlauf
// standen hier RegExp-Literale aus Strings, deren Escapes durch zwei Ebenen liefen und am Ende
// etwas anderes suchten als gemeint. Der Test war gruen-blind, nicht der Code kaputt.
const marke = '<g transform="translate(0,'+hoeheJs+')">';
check('9: jede Zieh-Schicht enthaelt eine um die Bildhoehe versetzte Kopie',
  panoOhneFall.split(marke).length - 1 === 3,
  { hoehe: hoeheJs, kopien: panoOhneFall.split(marke).length - 1 });
const keyframeWeg = Number((src.match(/@keyframes panoZug \{ from \{ transform: translateY\(0\); \} to \{ transform: translateY\(-(\d+)px\); \} \}/)||[])[1]);
check('9: der Verschiebeweg im CSS entspricht exakt der Bildhoehe im JS',
  keyframeWeg === hoeheJs, { css: keyframeWeg, js: hoeheJs });
// Fallend muss schneller sein als treibend, sonst traegt die Geschwindigkeit keine Auskunft mehr.
// Die Regel wird ueber ihren Anfang gefunden und danach die erste Sekundenzahl gelesen.
function sekundenNach(anfang){
  const i = src.indexOf(anfang);
  if (i < 0) return NaN;
  const m = src.slice(i, i + 160).match(/(\d+(?:\.\d+)?)s/);
  return m ? Number(m[1]) : NaN;
}
const dauer = (kl, imFall) => sekundenNach(imFall ? '.abgrund-panorama.faellt .'+kl : '\n    .'+kl+' ');
const schichten = ['pano-fern','pano-mitte','pano-nah'];
const zuLangsam = schichten.filter(k => !(dauer(k,true) > 0 && dauer(k,true) < dauer(k,false)));
check('9: im Tauchgang zieht jede Schicht schneller als im Ruhezustand', zuLangsam.length === 0,
  schichten.map(k => k+': '+dauer(k,false)+'s -> '+dauer(k,true)+'s'));
// Parallax heisst: verschiedene Geschwindigkeiten. Sind alle gleich, ist es nur ein Schwenk.
const ruhe = schichten.map(k => dauer(k,false));
check('9: die drei Schichten ziehen wirklich verschieden schnell (sonst kein Parallax)',
  new Set(ruhe).size === 3 && ruhe[0] > ruhe[1] && ruhe[1] > ruhe[2], ruhe);
// Seit v8.345.0 gibt es zwei weitere Bewegungen im Panorama (Leuchtgaenger am Grund, Wächter-Auge).
// Geprueft wird deshalb nicht mehr eine woertliche Zeile, sondern dass JEDE .pano-Klasse mit einer
// Animation auch im reduce-Block auftaucht - so faellt eine kuenftige dritte Bewegung auf, statt
// still durchzurutschen.
{
  const reduceBlock = (src.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.pano-[^}]*\}/)||[''])[0];
  const bewegte = [...new Set([...src.matchAll(/\.(pano-[a-z]+)\s*\{\s*animation:/g)].map(m => m[1]))];
  const fehlend = bewegte.filter(k => !reduceBlock.includes('.'+k));
  check('9: auch das Panorama steht bei prefers-reduced-motion still',
    bewegte.length >= 3 && fehlend.length === 0, { bewegte, fehlend });
}
// Der Grund darf NICHT mitziehen - ein wandernder Boden kehrt die Leserichtung um.
const nachFest = panoOhneFall.split('</g>').pop();
// Der Grund wird seit v8.345.0 mit einem Verlauf gefuellt statt mit einer festen Farbe - gesucht
// wird deshalb die Verlaufs-Referenz, nicht der alte Farbwert.
check('9: der Grund liegt ausserhalb der Zieh-Schichten',
  /fill="url\(#gr[^)]+\)"/.test(panoOhneFall.replace(/<g class="pano-[a-z]+">[\s\S]*?<\/g><\/g>/g, '')),
  { rest: nachFest.length });

// ---- 10) Die Ankunft (v8.345.0) ----
// Der Effekt ist reine Kosmetik - und genau deshalb kann er still ausfallen, ohne dass irgendetwas
// kaputtgeht. Geprueft wird die ganze Kette: Klasse am Wurzelelement, beide Elemente im Markup,
// beide unsichtbar OHNE die Klasse, und die Kopplung an dieselbe Bedingung wie die Erfolgsmeldung.
{
  const ruhig = panoUmgebung(sek(30, ['sog']), false, 0);
  const kommt = panoUmgebung(sek(30, ['sog']), false, Date.now() + 5000);
  check('10: ohne Ankunft traegt das Bild die Klasse nicht',
    !/class="abgrund-panorama[^"]*ankommt/.test(ruhig));
  check('10: nach einem Sieg traegt es sie', /class="abgrund-panorama ankommt"/.test(kommt));
  // Die Elemente stehen IMMER im Markup - sonst braeuchte der Effekt einen zweiten Codeweg.
  check('10: Druckstoss und Aufblitzen stehen in beiden Faellen im Markup',
    ruhig.includes('class="pano-stoss"') && ruhig.includes('class="pano-blitz"')
    && kommt.includes('class="pano-stoss"') && kommt.includes('class="pano-blitz"'));
  // ... und sind ohne die Klasse unsichtbar. Ohne diese Regel waere im Ruhezustand ein Ring zu sehen.
  check('10: ohne die Klasse sind sie per CSS unsichtbar',
    /\.pano-stoss, \.pano-blitz \{ opacity:0; \}/.test(src));
  check('10: die Skalierung dreht um den eigenen Mittelpunkt (sonst laeuft der Ring schraeg raus)',
    /\.pano-stoss \{ transform-box:fill-box; transform-origin:center; \}/.test(src));
  // Die Kopplung an showLog: Bei Offline-Rueckkehr loesen sich mehrere Missionen auf einmal auf.
  // Ohne dieselbe Bedingung wie die Erfolgsmeldung liefe der Effekt mehrfach hintereinander.
  check('10: ausgeloest wird nur dort, wo auch die Erfolgsmeldung laeuft',
    /if \(showLog !== false\) abgrundAnkunftBis = Date\.now\(\) \+ ABGRUND_ANKUNFT_MS;/.test(js));
  check('10: die Marke liegt NICHT im Spielstand (ein Reload soll sie nicht wiederholen)',
    !/state\.abgrundAnkunft|a\.ankunftBis/.test(js) && /let abgrundAnkunftBis = 0;/.test(js));
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
