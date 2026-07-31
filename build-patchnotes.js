#!/usr/bin/env node
// Erzeugt patchnotes.html aus dem PATCHNOTES-Array in weltraum_kolonie.html.
//
// WARUM ALS GENERATOR und nicht als handgepflegte Seite: Die Landeseite verlinkte an zwei Stellen
// auf patchnotes.html - im Kopfmenue und in der Fusszeile -, die Datei gab es aber nie. Beide Links
// liefen ins Leere. Eine von Hand gepflegte Zweitfassung waere genau die Sorte zweite Liste, die
// dieses Projekt sonst vermeidet (siehe build-icon-subset.js, das seine Icon-Liste ebenfalls aus der
// Spieldatei selbst zieht): Sie waere nach dem naechsten Patch veraltet, und niemand haette es
// gemerkt. Die Patchnotes stehen im Spiel und bleiben dort die einzige Quelle.
//
// AUFRUF: node build-patchnotes.js   (schreibt patchnotes.html, meldet die Groesse)
// Gehoert nach jeder Versionserhoehung mit ausgefuehrt - tests/test_patchnotesseite.js schlaegt an,
// wenn die Seite aelter ist als die neueste Version im Spiel.
const fs = require('fs');
const path = require('path');

const WURZEL = __dirname;
const SPIEL = path.join(WURZEL, 'weltraum_kolonie.html');
const ZIEL = path.join(WURZEL, 'patchnotes.html');
// So viele Versionen stehen aufgeklappt da. Der Rest bleibt vollstaendig erhalten, aber
// zusammengeklappt - 768 Versionen am Stueck liest niemand, und die Historie wegzuwerfen kommt
// nicht in Frage (Patchnotes sind in diesem Projekt unveraenderliche Historie).
const OFFEN = 20;

function lies(){
  const s = fs.readFileSync(SPIEL, 'utf8');
  const von = s.indexOf('const PATCHNOTES = [');
  if (von < 0) throw new Error('PATCHNOTES-Array nicht gefunden');
  const bis = s.indexOf('\n  ];', von);
  if (bis < 0) throw new Error('Ende des PATCHNOTES-Arrays nicht gefunden');
  // Das Array wird ausgefuehrt statt mit einer Regex zerlegt: Die Eintraege enthalten Apostrophe,
  // Anfuehrungszeichen und HTML - eine naive Regex terminiert daran falsch (bekannter Fallstrick
  // dieses Projekts).
  const arr = new Function(s.slice(von, bis + 4) + '; return PATCHNOTES;')();
  if (!Array.isArray(arr) || !arr.length) throw new Error('PATCHNOTES ist leer');
  return arr;
}

function version(){
  const s = fs.readFileSync(SPIEL, 'utf8');
  const m = s.match(/const VERSION = '([\d.]+)'/);
  if (!m) throw new Error('VERSION nicht gefunden');
  return m[1];
}

const notes = lies();
const jetzt = version();
if (notes[0].version !== jetzt){
  console.error('WARNUNG: VERSION ist ' + jetzt + ', neuester Patchnotes-Eintrag ist ' +
    notes[0].version + ' - fehlt ein Eintrag?');
}

// Eintraege enthalten bewusst HTML (<strong>, <em>) - sie werden im Spiel ebenso als Markup
// gerendert und stammen ausschliesslich aus dieser Datei, nicht von Spielern. Sie werden deshalb
// unveraendert uebernommen; es gibt hier keine Fremdeingabe, die zu maskieren waere.
function block(n){
  const zeilen = (n.changes || []).map(c => '      <li>' + c + '</li>').join('\n');
  return '    <h3 id="v' + n.version.replace(/\./g, '-') + '">' + n.version +
    ' <span class="pn-datum">' + n.date + '</span></h3>\n' +
    '    <ul class="pn-liste">\n' + zeilen + '\n    </ul>';
}

const neu = notes.slice(0, OFFEN);
const alt = notes.slice(OFFEN);

// Aeltere Versionen nach TAG gruppieren, damit die Seite eine Gliederung hat statt 748
// Ueberschriften hintereinander. Bewusst nicht nach Monat: Das Spiel ist seit dem 10.07.2026 live,
// alle 768 Versionen fallen in denselben Monat - eine Monatsgruppierung ergab genau EINE Gruppe und
// damit gar keine Gliederung. Nach Tag sind es rund zwanzig handliche Bloecke. Sollte das Projekt
// irgendwann ueber Jahre laufen, ist die Tagesgruppierung immer noch richtig (dann eben mehr
// Gruppen, aber jede weiterhin lesbar gross).
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
    g.liste.map(block).join('\n') + '\n  </details>')
  .join('\n');

const eintraege = notes.reduce((a, n) => a + (n.changes || []).length, 0);

const seite = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Patchnotes – Kolonie Kepler-7</title>
<meta name="description" content="Alle Änderungen an Kolonie Kepler-7: ${notes.length} Versionen von ${notes[notes.length-1].version} bis ${notes[0].version}, vollständig und unverändert.">
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
${neu.map(block).join('\n')}

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
