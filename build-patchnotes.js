#!/usr/bin/env node
// Erzeugt patchnotes.html, patchnotes-archiv.json und version.txt aus den Patchnotes in
// weltraum_kolonie.html - und haelt dabei den PATCHNOTES-Block im Spiel klein.
//
// WARUM ALS GENERATOR und nicht als handgepflegte Seite: Die Landeseite verlinkte an zwei Stellen
// auf patchnotes.html - im Kopfmenue und in der Fusszeile -, die Datei gab es aber nie. Beide Links
// liefen ins Leere. Eine von Hand gepflegte Zweitfassung waere genau die Sorte zweite Liste, die
// dieses Projekt sonst vermeidet (siehe build-icon-subset.js, das seine Icon-Liste ebenfalls aus der
// Spieldatei selbst zieht): Sie waere nach dem naechsten Patch veraltet, und niemand haette es
// gemerkt. Neue Patchnotes stehen im Spiel und werden NUR dort geschrieben.
//
// DAS ARCHIV (01.09.2026, Strukturpruefung Punkt 4): Bis dahin standen alle 1.043 Versionen als
// Literal in der Spieldatei - 1,14 MB, 18 % des JavaScripts, bei jedem Spielstart mitgeladen und
// mitgeparst, obwohl das Spiel nur die neuesten PATCHNOTES_SOFORT Eintraege zeichnet. Jetzt bleiben
// die neuesten PATCHNOTES_IM_SPIEL Eintraege im Spiel (fuer den Update-Hinweis beim Start und den
// Update-Tab), alles Aeltere liegt in patchnotes-archiv.json und wird erst geladen, wenn jemand im
// Update-Tab auf "weitere Versionen" tippt. Dieses Skript ROTIERT: Ist der Block im Spiel nach
// einem neuen Eintrag laenger als PATCHNOTES_IM_SPIEL, wandern die aeltesten Eintraege textuell
// (nicht neu serialisiert - der Wortlaut bleibt Byte fuer Byte) an den Anfang des Archivs. Der
// Ablauf fuer Menschen bleibt derselbe wie vorher: Eintrag oben in PATCHNOTES schreiben, dieses
// Skript ausfuehren.
//
// Der Eintrag im Spiel, der die Archivgroesse kennt (PATCHNOTES_ARCHIV_ANZAHL), wird hier ebenfalls
// gepflegt, damit der Knopf im Update-Tab die richtige Restzahl nennt, ohne das Archiv zu laden.
//
// version.txt: Der Client fragt alle paar Minuten, ob es eine neuere Version gibt. Bis zum
// 01.09.2026 lud er dafuer die ganze Spieldatei (6,7 MB, zwei Timer, bei jedem Tab-Wechsel).
// Jetzt liest er diese 20 Byte; erst bei einer neueren Version holt er die Spieldatei einmal, um
// die Patchnotes fuer das Hinweis-Overlay zu zeigen. tests/run.js verlangt, dass version.txt zur
// VERSION passt - eine veraltete version.txt hiesse, dass kein Spieler das Update bemerkt.
//
// AUFRUF: node build-patchnotes.js   (schreibt die drei Dateien und die Spieldatei, meldet Groessen)
// Gehoert nach jeder Versionserhoehung mit ausgefuehrt - tests/test_patchnotesseite.js und
// tests/test_patchnotes_archiv.js schlagen an, wenn etwas davon aelter ist als das Spiel.
//
// KEPLER_WURZEL: Fuer den Test des Skripts selbst (tests/test_patchnotes_archiv.js) laesst sich das
// Arbeitsverzeichnis per Umgebungsvariable auf eine Kopie umlenken - das Skript schreibt in die
// Spieldatei, ein Test darf das nicht am Original tun.
const fs = require('fs');
const path = require('path');

const WURZEL = process.env.KEPLER_WURZEL || __dirname;
const SPIEL = path.join(WURZEL, 'weltraum_kolonie.html');
const ZIEL = path.join(WURZEL, 'patchnotes.html');
const ARCHIV = path.join(WURZEL, 'patchnotes-archiv.json');
const VERSION_DATEI = path.join(WURZEL, 'version.txt');
// So viele Versionen bleiben als Literal im Spiel. Mehr als PATCHNOTES_SOFORT (15) im Spiel, damit
// der "weitere Versionen"-Knopf auch ohne Netz noch etwas zu zeigen hat, und genug fuer den
// Update-Hinweis eines Spielers, der ein paar Tage weg war (Takt: mehrere Versionen am Tag).
const PATCHNOTES_IM_SPIEL = 20;
// So viele Versionen stehen auf patchnotes.html aufgeklappt da. Der Rest bleibt vollstaendig erhalten,
// aber zusammengeklappt - ueber tausend Versionen am Stueck liest niemand, und die Historie
// wegzuwerfen kommt nicht in Frage (Patchnotes sind in diesem Projekt unveraenderliche Historie).
const OFFEN = 20;

const START_MARKER = 'const PATCHNOTES = [';
const ENDE_MARKER = '\n  ];';
// Ein Eintrag beginnt auf einer eigenen Zeile mit `{ version:'`. Die Einrueckung ist bewusst
// beliebig: Drei Eintraege (8.600.0 bis 8.602.0) standen mit null bzw. acht Leerzeichen im Block,
// ein starres `    { version:'` haette sie uebersehen - und genau das faellt unten auf, weil die
// Zahl der Zeilenanfaenge gegen die ausgefuehrte Fassung nachgezaehlt wird.
const EINTRAG_MUSTER = /\n[ \t]*\{ version:'/g;

// Liest den PATCHNOTES-Block textuell: Rueckgabe sind die Grenzen im Quelltext und die Startoffsets
// der einzelnen Eintraege (jeweils die Position des Zeilenumbruchs VOR dem Eintrag).
function blockLesen(s){
  const von = s.indexOf(START_MARKER);
  if (von < 0) throw new Error('PATCHNOTES-Array nicht gefunden');
  const bis = s.indexOf(ENDE_MARKER, von);
  if (bis < 0) throw new Error('Ende des PATCHNOTES-Arrays nicht gefunden');
  const starts = [];
  EINTRAG_MUSTER.lastIndex = von;
  let m;
  while ((m = EINTRAG_MUSTER.exec(s)) && m.index < bis) starts.push(m.index);
  return { von, bis, starts };
}

// Das Array wird ausgefuehrt statt mit einer Regex zerlegt: Die Eintraege enthalten Apostrophe,
// Anfuehrungszeichen und HTML - eine naive Regex terminiert daran falsch (bekannter Fallstrick
// dieses Projekts).
function ausfuehren(literalText){
  const arr = new Function('return [' + literalText + '\n]')();
  if (!Array.isArray(arr)) throw new Error('PATCHNOTES-Text ergibt kein Array');
  return arr;
}

function archivLesen(){
  if (!fs.existsSync(ARCHIV)) return [];
  const arr = JSON.parse(fs.readFileSync(ARCHIV, 'utf8'));
  if (!Array.isArray(arr)) throw new Error('patchnotes-archiv.json ist kein Array');
  return arr;
}

function version(s){
  const m = s.match(/const VERSION = '([\d.]+)'/);
  if (!m) throw new Error('VERSION nicht gefunden');
  return m[1];
}

function versionVergleich(a, b){
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++){
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// ---------------------------------------------------------------- 1. Lesen und rotieren
let spiel = fs.readFileSync(SPIEL, 'utf8');
const jetzt = version(spiel);
let archiv = archivLesen();
const block = blockLesen(spiel);
const imSpielVorher = ausfuehren(spiel.slice(block.von + START_MARKER.length, block.bis));
if (imSpielVorher.length !== block.starts.length){
  throw new Error('Eintraege im Block: ' + imSpielVorher.length + ' ausgefuehrt, aber ' +
    block.starts.length + ' Zeilenanfaenge `    { version:\'` - der textuelle Schnitt waere unsicher');
}

let verschoben = 0;
if (block.starts.length > PATCHNOTES_IM_SPIEL){
  const schnitt = block.starts[PATCHNOTES_IM_SPIEL];          // Beginn des ersten zu alten Eintrags
  const ueberhangText = spiel.slice(schnitt, block.bis);
  const ueberhang = ausfuehren(ueberhangText);
  // Plausibilitaet, bevor irgendetwas geschrieben wird: Das Archiv darf keine der Versionen schon
  // enthalten, und der neueste Archiveintrag muss aelter sein als der aelteste, der im Spiel bleibt.
  const archivVersionen = new Set(archiv.map(n => n.version));
  const doppelt = ueberhang.filter(n => archivVersionen.has(n.version)).map(n => n.version);
  if (doppelt.length) throw new Error('Versionen stehen schon im Archiv: ' + doppelt.slice(0, 5).join(', '));
  if (archiv.length && versionVergleich(ueberhang[ueberhang.length - 1].version, archiv[0].version) <= 0){
    throw new Error('Aeltester zu verschiebender Eintrag ' + ueberhang[ueberhang.length - 1].version +
      ' ist nicht neuer als der neueste Archiveintrag ' + archiv[0].version);
  }
  archiv = ueberhang.concat(archiv);
  verschoben = ueberhang.length;
  // Textuell entfernen: Der letzte verbleibende Eintrag endet mit `]},` - ein Komma vor `]` ist in
  // JavaScript erlaubt, und genau so sah der Block auch vorher an jeder Stelle aus.
  spiel = spiel.slice(0, schnitt) + spiel.slice(block.bis);
}

const imSpiel = (() => { const b = blockLesen(spiel); return ausfuehren(spiel.slice(b.von + START_MARKER.length, b.bis)); })();
const notes = imSpiel.concat(archiv);

if (notes[0].version !== jetzt){
  console.error('WARNUNG: VERSION ist ' + jetzt + ', neuester Patchnotes-Eintrag ist ' +
    notes[0].version + ' - fehlt ein Eintrag?');
}
// Die Reihenfolge ist Teil der Wahrheit: streng absteigend, ohne Doppelte, ueber die Naht hinweg.
for (let i = 1; i < notes.length; i++){
  if (versionVergleich(notes[i - 1].version, notes[i].version) <= 0){
    throw new Error('Patchnotes nicht streng absteigend bei ' + notes[i - 1].version + ' -> ' + notes[i].version);
  }
}

// ---------------------------------------------------------------- 2. Spieldatei: Zaehler pflegen
const zaehlerRegex = /const PATCHNOTES_ARCHIV_ANZAHL = \d+;/;
if (!zaehlerRegex.test(spiel)) throw new Error('PATCHNOTES_ARCHIV_ANZAHL nicht in der Spieldatei gefunden');
spiel = spiel.replace(zaehlerRegex, 'const PATCHNOTES_ARCHIV_ANZAHL = ' + archiv.length + ';');
fs.writeFileSync(SPIEL, spiel);

// ---------------------------------------------------------------- 3. Archiv und version.txt
// Eine Zeile je Eintrag: lesbare Diffs (ein neuer Eintrag ist eine neue Zeile), und die Datei
// bleibt trotzdem kompakt.
fs.writeFileSync(ARCHIV, '[\n' + archiv.map(n => JSON.stringify(n)).join(',\n') + '\n]\n');
fs.writeFileSync(VERSION_DATEI, jetzt + '\n');

// ---------------------------------------------------------------- 4. patchnotes.html
// Eintraege enthalten bewusst HTML (<strong>, <em>) - sie werden im Spiel ebenso als Markup
// gerendert und stammen ausschliesslich aus der Spieldatei, nicht von Spielern. Sie werden deshalb
// unveraendert uebernommen; es gibt hier keine Fremdeingabe, die zu maskieren waere.
function blockHtml(n){
  const zeilen = (n.changes || []).map(c => '      <li>' + c + '</li>').join('\n');
  return '    <h3 id="v' + n.version.replace(/\./g, '-') + '">' + n.version +
    ' <span class="pn-datum">' + n.date + '</span></h3>\n' +
    '    <ul class="pn-liste">\n' + zeilen + '\n    </ul>';
}

const neu = notes.slice(0, OFFEN);
const alt = notes.slice(OFFEN);

// Aeltere Versionen nach TAG gruppieren, damit die Seite eine Gliederung hat statt ueber tausend
// Ueberschriften hintereinander. Bewusst nicht nach Monat: Das Spiel ist seit dem 10.07.2026 live,
// die ersten 768 Versionen fielen in denselben Monat - eine Monatsgruppierung ergab genau EINE Gruppe
// und damit gar keine Gliederung. Nach Tag sind es handliche Bloecke. Sollte das Projekt irgendwann
// ueber Jahre laufen, ist die Tagesgruppierung immer noch richtig (dann eben mehr Gruppen, aber
// jede weiterhin lesbar gross).
const WOCHENTAGE = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const gruppen = new Map();
for (const n of alt){
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(n.date || '');
  const schl = m ? m[3] + '-' + m[2] + '-' + m[1] : 'ohne-datum';
  let titel = 'Ohne Datum';
  if (m){
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    titel = WOCHENTAGE[d.getDay()] + ', ' + n.date;
  }
  if (!gruppen.has(schl)) gruppen.set(schl, { titel, liste: [] });
  gruppen.get(schl).liste.push(n);
}
const alteBloecke = [...gruppen.entries()]
  .sort((a, b) => b[0].localeCompare(a[0]))
  .map(([, g]) =>
    '  <details class="pn-tag">\n' +
    '    <summary>' + g.titel + ' <span class="pn-anzahl">' + g.liste.length +
    (g.liste.length === 1 ? ' Version' : ' Versionen') + '</span></summary>\n' +
    g.liste.map(blockHtml).join('\n') + '\n  </details>')
  .join('\n');

const eintraege = notes.reduce((a, n) => a + (n.changes || []).length, 0);

const seite = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Patchnotes – Kolonie Kepler-7</title>
<meta name="description" content="Alle Änderungen an Kolonie Kepler-7: ${notes.length} Versionen von ${notes[notes.length-1].version} bis ${notes[0].version}, vollständig und unverändert seit dem ersten Tag.">
<link rel="canonical" href="https://www.gamegeeeeek.de/patchnotes.html">
<meta name="theme-color" content="#0a0d1a">
<meta property="og:title" content="Patchnotes – Kolonie Kepler-7">
<meta property="og:description" content="Jede Änderung am Spiel, seit dem ersten Tag. ${notes.length} Versionen.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.gamegeeeeek.de/patchnotes.html">
<meta property="og:image" content="https://www.gamegeeeeek.de/og-image.png">
<link rel="stylesheet" href="seiten.css">
<style>
  /* Nur was diese Seite zusaetzlich braucht - alles Uebrige kommt aus seiten.css. */
  .pn-datum { font-weight:400; opacity:0.6; font-size:0.85em; margin-left:0.4rem; }
  .pn-liste { margin:0 0 1.6rem; padding-left:1.1rem; }
  .pn-liste li { margin-bottom:0.55rem; }
  .pn-tag { margin-bottom:0.6rem; border-left:2px solid rgba(255,255,255,0.12); padding-left:0.9rem; }
  .pn-tag > summary { cursor:pointer; font-weight:600; padding:0.35rem 0; }
  .pn-tag > summary:hover { color:#f0b556; }
  .pn-anzahl { font-weight:400; opacity:0.55; font-size:0.85em; margin-left:0.4rem; }
  .pn-tag h3 { margin-top:1.4rem; }
  @media (prefers-reduced-motion: reduce) { .pn-tag > summary { transition:none; } }
</style>
</head>
<body>

<header class="kopf">
  <a class="marke" href="/"><span class="marke-punkt"></span>Kolonie Kepler-7</a>
  <nav class="kopf-nav">
    <a href="patchnotes.html" aria-current="page">Patchnotes</a>
    <a href="spielanleitung.html">Spielanleitung</a>
    <a href="/">Zum Spiel</a>
  </nav>
</header>

<main>
<h1>Patchnotes</h1>
<p class="lede">Jede Änderung am Spiel, seit dem ersten Tag – ${notes.length} Versionen mit ${eintraege} Einträgen,
von ${notes[notes.length-1].version} (${notes[notes.length-1].date}) bis ${notes[0].version} (${notes[0].date}).
Ältere Einträge werden nie nachträglich geändert, auch wenn sie inzwischen überholte Zahlen nennen –
sie sind Historie, kein Handbuch. Was aktuell gilt, steht in der <a href="spielanleitung.html">Spielanleitung</a>.</p>

<h2>Neueste Versionen</h2>
${neu.map(blockHtml).join('\n')}

<h2>Ältere Versionen</h2>
<p>Vollständig erhalten, nach Tag zusammengefasst.</p>
${alteBloecke}

<p style="margin-top:2.5rem;"><a href="/">Zurück zum Spiel</a> &middot; <a href="spielanleitung.html">Spielanleitung</a> &middot; <a href="impressum.html">Impressum</a></p>
</main>

</body>
</html>
`;

fs.writeFileSync(ZIEL, seite);
console.log('patchnotes.html geschrieben: ' + notes.length + ' Versionen, ' + eintraege +
  ' Einträge, ' + Math.round(seite.length / 1024) + ' kB');
console.log('  offen: ' + neu.length + ' · zusammengeklappt: ' + alt.length + ' in ' + gruppen.size + ' Tagesgruppen');
console.log('  im Spiel: ' + imSpiel.length + ' · Archiv: ' + archiv.length +
  (verschoben ? ' (' + verschoben + ' ins Archiv verschoben)' : '') + ' · version.txt: ' + jetzt);
