// Das Laufschrift-Banner fuer den seltensten Expeditionsfund (03.09.2026).
//
// Der Server entscheidet ueber den Hort und meldet ihn allen (siehe Backend
// docs/hort-meldung.md); hier steht die Seite, die ihn ZEIGT. Geprueft werden die Regeln, an denen
// das Banner haengt - nicht seine Optik:
//
//   1. es liegt UEBER dem Bild, nicht darin (sonst verschiebt es beim Erscheinen alles darunter)
//   2. es erkennt die Meldung an der ART, nicht am Wortlaut
//   3. es zeigt nichts zweimal und nichts von gestern
//   4. die Anfrage beim Start blockiert nichts und haengt an der Mission
//   5. sie kommt ohne Server nicht vor - und bricht dort auch nichts
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---- 1: ueber dem Bild, nicht darin --------------------------------------------------------------
// Ein Element im Layoutfluss verschoebe beim Erscheinen alles darunter - mitten im Lesen, und es
// braeche jede Messung der Fensterlage. Dieselbe Ueberlegung wie beim Ereignis-Banner (Bild-Ruhe).
const cssVon = src.indexOf('#hortTicker {');
check('1a: das Banner hat eine eigene CSS-Regel', cssVon > 0);
const cssBlock = cssVon > 0 ? src.slice(cssVon, src.indexOf('}', cssVon)) : '';
check('1b: es liegt ueber dem Bild (position:fixed), nicht im Fluss', /position:\s*fixed/.test(cssBlock), { block: cssBlock.slice(0, 120) });
check('1c: und es ist zu Beginn unsichtbar', /display:\s*none/.test(cssBlock));
check('1d: das Element steht im Dokument', src.includes('<div id="hortTicker"'));
// Vorlesbar: Wer nicht hinsieht, bekommt die Meldung sonst gar nicht mit.
check('1e: es meldet sich der Vorlesehilfe (role/aria-live)',
  /<div id="hortTicker"[^>]*role="status"[^>]*aria-live="polite"/.test(src));
// Bewegung ist fuer manche Menschen ein Problem; abgeschnittener Text waere dann aber unlesbar.
//
// Verankert am EIGENEN Selektor, nicht am Medienausdruck: 'prefers-reduced-motion' steht 35-mal in
// dieser Datei, und ein indexOf darauf trifft die erste Regel irgendwo weit oben - gemessen, nicht
// vermutet. Dieselbe Falle wie ein indexOf auf 'const cache = ' im Leiter-Test. In einer 6-MB-Datei
// ist ein generischer Anker so gut wie immer der falsche.
const reduzZeile = (src.match(/#hortTickerText \{[^}]*animation:\s*none[^}]*\}/) || [''])[0];
check('1f: wer keine Bewegung will, bekommt den Text stehend UND umgebrochen',
  /white-space:\s*normal/.test(reduzZeile), { regel: reduzZeile.slice(0, 130) });
check('1f2: und diese Regel steht wirklich in einem prefers-reduced-motion-Block',
  reduzZeile.length > 0 && /@media \(prefers-reduced-motion[^)]*\)\s*\{\s*$/m.test(
    src.slice(Math.max(0, src.indexOf(reduzZeile) - 120), src.indexOf(reduzZeile))));

// ---- 2: erkannt an der Art, nicht am Wortlaut ----------------------------------------------------
const fnVon = src.indexOf('function zeigeHortLaufschrift(){');
check('2a: die Laufschrift ist eine eigene Funktion', fnVon > 0);
const fn = fnVon > 0 ? src.slice(fnVon, fnVon + 1600) : '';
check('2b: sie erkennt die Meldung an art === \'hort\'', /e\.art === 'hort'/.test(fn));
// Das ist der Kern: Ein Filter auf den Satzanfang waere eine zufaellige Momentaufnahme - eine
// umformulierte Meldung braeche das Banner lautlos, und niemand haette einen Grund, daran zu denken.
check('2c: und NICHT am Wortlaut der Meldung', !/Seltener Fund/.test(fn), { gefunden: /Seltener Fund/.test(fn) });
check('2d: sie haengt am Galaxie-Poll, braucht also keinen eigenen', src.includes('zeigeHortLaufschrift();'));

// ---- 3: nichts zweimal, nichts von gestern -------------------------------------------------------
// Zwei Siebe, weil eines allein nicht reicht: Die Menge verhindert die Wiederholung innerhalb einer
// Sitzung, das Zeitfenster verhindert, dass beim ersten Laden die letzten 40 Weltlage-Meldungen
// nacheinander durchlaufen - der Ringpuffer haelt sie lange.
check('3a: schon Gezeigtes wird gemerkt', /hortGezeigt\.has\(e\.id\)/.test(fn) && /hortGezeigt\.add\(/.test(fn));
check('3b: und Altes faellt durch ein Zeitfenster', /HORT_TICKER_FENSTER/.test(fn));
const fenster = Number((src.match(/const HORT_TICKER_FENSTER = (\d+)/) || [])[1]);
check('3c: das Fenster ist in Minuten gemessen, nicht in Stunden', fenster > 0 && fenster <= 60*60*1000, { ms: fenster });
// Bei mehreren auf einmal laeuft die JUENGSTE - die Reihenfolge des Ringpuffers waere die des
// Zufalls, nicht die der Aufmerksamkeit. Die anderen stehen im Log.
check('3d: bei mehreren laeuft die juengste, die uebrigen landen im Log',
  /sort\(\(a,b\) => \(b\.time\|\|0\) - \(a\.time\|\|0\)\)/.test(fn) && /for \(const e of neu\) log\(/.test(fn));

// ---- 4: die Anfrage beim Start -------------------------------------------------------------------
const anfVon = src.indexOf('function hortAnfragen(m, et, risk){');
check('4a: die Anfrage ist eine eigene Funktion', anfVon > 0);
const anf = anfVon > 0 ? src.slice(anfVon, anfVon + 1200) : '';
check('4b: sie fragt den Server', /backendFetch\('\/expedition\/hort'/.test(anf));
// Kein await: checkMissions() ist synchron, und die Antwort kommt Minuten vor der Auswertung.
check('4c: sie blockiert den Start nicht (kein await, stilles catch)',
  !/await backendFetch\('\/expedition\/hort'/.test(src) && /\.catch\(\(\) => \{\}\)/.test(anf));
// An DIE MISSION, nicht in eine Modulvariable: Es koennen mehrere Expeditionen gleichzeitig
// unterwegs sein, und die Zusage gehoert zu genau einer.
check('4d: die Zusage haengt an der Mission', /m\.hortZusage = \{/.test(anf));
check('4e: sie wird beim Start ausgeloest', /hortAnfragen\(cf\.missions\[cf\.missions\.length-1\], et, risk\)/.test(src));

// ---- 5: ohne Server bricht nichts ----------------------------------------------------------------
check('5a: ohne Backend wird gar nicht erst gefragt', /if \(!m \|\| !useBackend\(\)\) return;/.test(anf));
// Der Beweis, dass der Ausfall folgenlos ist: Die Fundaufloesung liest m.hortZusage nur, wenn es
// da ist - fehlt es, wuerfelt die Leiter ihre unteren fuenf Stufen wie immer.
check('5b: die Aufloesung kommt ohne Zusage aus', /m\.hortZusage \? /.test(src));

// ---- 6: die Fundressourcen stehen nur einmal -----------------------------------------------------
// Sie werden jetzt an zwei Stellen gebraucht (Anfrage beim Start, Fund bei der Aufloesung).
check('6a: es gibt eine gemeinsame Funktion', src.includes('function expeditionResKeys(etDef){'));
const rohListen = (src.match(/\['erz','kristalle','deuterium','antimaterie','energie'\]/g) || []).length;
check('6b: die Liste steht genau einmal im Code', rohListen === 1, { kopien: rohListen });

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
