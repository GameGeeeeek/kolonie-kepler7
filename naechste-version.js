#!/usr/bin/env node
/*
 * Welche Versionsnummer ist gerade frei?
 *
 * WARUM ES DIESES SKRIPT GIBT: Am 14./15.08.2026 wurde EINE Änderung viermal hintereinander
 * umnummeriert (v8.500.0 → 8.502.0 → 8.503.0), weil parallel ausgeliefert wurde und jede fremde
 * Version die eigene überholte, während der 25-Minuten-Prüflauf lief. Am 10.08.2026 war dasselbe
 * schon fünfmal passiert. CLAUDE.md-Arbeitsregel 23 sagt seitdem "die Nummer erst unmittelbar VOR
 * dem Commit vergeben und main in diesem Moment noch einmal ansehen" - aber eine Regel, an die man
 * sich erinnern muss, ist bei einer Aufgabe, die man mehrmals täglich macht, keine Absicherung.
 * Das ist dieselbe Begründung, aus der die Backend-Klon-Prüfung in tests/run.js steht.
 *
 * AUFRUF:
 *   node naechste-version.js          holt origin/main und nennt die nächste freie Nummer
 *   node naechste-version.js --offline  ohne git fetch (nutzt die zuletzt geholte Fernreferenz)
 *
 * EXIT-CODE:
 *   0 = die lokale VERSION ist frei (oder es gibt lokal noch keine neue)
 *   1 = KOLLISION: die lokale VERSION ist auf main bereits vergeben
 *
 * Damit ist der Ablauf: Änderung bauen → voller Prüflauf OHNE neue Nummer → dieses Skript →
 * Nummer + Patchnote eintragen → `node build-patchnotes.js`
 * → `node tests/run.js --nummer` (Sekunden) → committen und mergen.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WURZEL = __dirname;
const offline = process.argv.includes('--offline');
const git = (...a) => spawnSync('git', a, { cwd: WURZEL, encoding: 'utf8' });

// "8.503.0" -> [8,503,0]; unbrauchbare Eingaben werden zu null, damit sie nie als "groesste"
// Version durchrutschen.
function teile(v){
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v || '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function groesser(a, b){
  for (let i = 0; i < 3; i++){ if (a[i] !== b[i]) return a[i] > b[i]; }
  return false;
}
// Alle Versionen aus einem Dateiinhalt: die Konstante UND jeden Patchnotes-Eintrag. Beides, weil
// eine fremde Auslieferung mehrere Eintraege auf einmal mitbringen kann - genau so ist v8.500.0
// zusammen mit v8.501.0 in EINEM Commit auf main gelandet und wurde beim Blick auf nur die
// VERSION-Konstante uebersehen.
function versionenAus(inhalt){
  const raus = [];
  const v = (inhalt.match(/const VERSION = '([^']+)'/) || [])[1];
  if (teile(v)) raus.push(teile(v));
  for (const m of inhalt.matchAll(/\{ version:'([\d.]+)'/g)){
    const t = teile(m[1]); if (t) raus.push(t);
  }
  return raus;
}
const hoechste = (liste) => liste.reduce((a, b) => (a === null || groesser(b, a)) ? b : a, null);

if (!offline){
  const f = git('fetch', 'origin', 'main');
  if (f.status !== 0) console.log('Hinweis: git fetch fehlgeschlagen - es gilt die zuletzt geholte Fernreferenz.');
}

const fern = ['origin/main', 'origin/master'].find(r => git('rev-parse', '--verify', '--quiet', r).status === 0);
if (!fern){
  console.log('FEHLER: keine Fernreferenz origin/main gefunden - ohne sie ist keine Aussage moeglich.');
  process.exit(1);
}
const fernInhalt = git('show', fern + ':weltraum_kolonie.html').stdout || '';
if (!fernInhalt){
  console.log('FEHLER: konnte ' + fern + ':weltraum_kolonie.html nicht lesen.');
  process.exit(1);
}
const lokalInhalt = fs.readFileSync(path.join(WURZEL, 'weltraum_kolonie.html'), 'utf8');

const maxFern = hoechste(versionenAus(fernInhalt));
const lokalV = teile((lokalInhalt.match(/const VERSION = '([^']+)'/) || [])[1]);
const naechste = [maxFern[0], maxFern[1] + 1, 0];
const fmt = (t) => t.join('.');

console.log('main (' + fern + ') ist bei    : ' + fmt(maxFern));
console.log('lokal steht                 : ' + (lokalV ? fmt(lokalV) : '(nicht lesbar)'));
console.log('naechste freie Nummer       : ' + fmt(naechste));

if (!lokalV){ process.exit(1); }
if (!groesser(lokalV, maxFern)){
  console.log('\nKOLLISION: ' + fmt(lokalV) + ' ist auf ' + fern + ' bereits vergeben.');
  console.log('Umnummerieren auf ' + fmt(naechste) + ' - und den eigenen Patchnote HINTER dem fremden einsortieren.');
  console.log('Den Aenderungssatz dafuer gegen den ELTERN des eigenen Commits bilden');
  console.log('(git diff <commit>^ <commit> -- datei), nie gegen einen fuer inhaltsgleich gehaltenen Fremdstand.');
  process.exit(1);
}
console.log('\nFrei. (Trotzdem gilt: Diese Auskunft ist so frisch wie dieser Aufruf -');
console.log('unmittelbar vor dem Commit noch einmal ausfuehren.)');
process.exit(0);
