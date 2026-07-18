#!/usr/bin/env node
// Icon-Sicherheitsnetz (Grafik-Runde 10, Spieler-Wunsch): eigenständiges Skript statt eines
// Freihand-Regex-Checks pro Session - Teil des Pflicht-Pre-Commit-Checklists aus CLAUDE.md
// ("Icon-Whitelist-Check"). Prüft zwei unabhängige Fehlerquellen, die in der Vergangenheit schon
// real aufgetreten sind:
//
//   1) ti-*-Klassen (69-Icon-Whitelist aus dem eingebetteten Icon-Font) - der ti-gift-Bug (v8.77.1)
//      wäre hiermit vor dem Commit aufgefallen statt danach.
//   2) icon:'X'-Werte in BUILDING_DEFS/RESEARCH_DEFS/SHIP_DEFS/etc., die NICHT mit "ti-" beginnen -
//      diese müssen als Schlüssel im ICONS-Objekt existieren (dem zweiten, separaten Icon-System aus
//      handgezeichneten Gradient-SVGs). icon:'ti-...'-Werte sind bewusst ausgenommen, da sie zum
//      Tabler-Font gehören, nicht zu ICONS (beide Systeme werden im Code parallel verwendet, siehe
//      CLAUDE.md "Icon system duality").
//
// Nutzung: node check-icons.js  (Exit-Code 0 = sauber, 1 = Probleme gefunden)

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'weltraum_kolonie.html');
const html = fs.readFileSync(FILE, 'utf8');

let hasError = false;

// --- Check 1: ti-*-Whitelist ---------------------------------------------------------------
// Whitelist IMMER aus der Datei selbst ziehen, nie aus dem Gedächtnis raten (siehe CLAUDE.md).
const whitelist = new Set(
  [...html.matchAll(/\.ti-([a-z0-9-]+):before\s*\{\s*content:/g)].map(m => m[1])
);
if (whitelist.size === 0) {
  console.error('FEHLER: Icon-Whitelist konnte nicht aus der Datei extrahiert werden (Regex-Treffer: 0). Icon-Font-Block umbenannt/verschoben?');
  process.exit(1);
}

// Alle ti-*-Verwendungen in echten Nutzungs-Kontexten (class-Attribute, Icon-Key-Strings) statt
// jeder zufälligen Teilstring-Fundstelle - reduziert Fehlalarme durch Kommentare/Variablennamen.
const usagePattern = /(?:class="[^"]*\bti\s+ti-([a-z0-9-]+)|class="[^"]*\bti-([a-z0-9-]+)\b|'ti-([a-z0-9-]+)'|"ti-([a-z0-9-]+)")/g;
const used = new Map(); // icon -> Beispielstelle (Zeilennummer)
for (const m of html.matchAll(usagePattern)) {
  const icon = m[1] || m[2] || m[3] || m[4];
  if (icon && !used.has(icon)) {
    const line = html.slice(0, m.index).split('\n').length;
    used.set(icon, line);
  }
}
const missingIcons = [...used.entries()].filter(([icon]) => !whitelist.has(icon));
if (missingIcons.length) {
  hasError = true;
  console.error('FEHLER: ti-*-Icons verwendet, die NICHT im 69er-Whitelist-Font enthalten sind:');
  for (const [icon, line] of missingIcons) console.error(`  - ti-${icon}  (erste Fundstelle: Zeile ${line})`);
} else {
  console.log(`OK: alle ${used.size} verwendeten ti-*-Icons sind in der ${whitelist.size}er-Whitelist enthalten.`);
}

// --- Check 2: icon:'X'-Werte (nicht ti-*) müssen im ICONS-Objekt existieren -----------------
if (!/const ICONS = \{/.test(html)) {
  console.error('FEHLER: ICONS-Objekt nicht gefunden - Check 2 übersprungen.');
  hasError = true;
} else {
  // Bewusst KEINE Klammer-Tiefen-Suche zur Objektgrenze: die Werte sind Template-Literale mit
  // SVG-Inhalt, der selbst beliebige {}-Zeichen enthalten kann (z.B. in verschachtelten
  // ${...}-Interpolationen anderer Funktionen weiter unten in derselben Datei) - eine naive
  // Tiefen-Zählung über den ganzen Text lief dabei schon einmal am eigentlichen Objektende vorbei
  // und verlor dadurch echte Schlüssel (false positives beim Abgleich). Stattdessen: jede Zeile mit
  // dem für ICONS-Einträge typischen Muster "    key: `<svg" direkt global matchen - robuster, auch
  // wenn dadurch theoretisch ein paar Schlüssel aus anderen, gleich eingerückten SVG-Objekten
  // (z.B. RES_ICONS) mit eingesammelt werden. Das macht die Prüfung höchstens zu lax, nie zu streng.
  const iconsKeys = new Set([...html.matchAll(/^ {4}([a-zA-Z0-9_]+):\s*`<svg/gm)].map(m => m[1]));

  const defsIconPattern = /icon:\s*'([a-zA-Z0-9_]+)'/g;
  const defsIcons = new Map();
  for (const m of html.matchAll(defsIconPattern)) {
    const icon = m[1];
    if (icon.startsWith('ti-') || icon.startsWith('ti_')) continue; // gehört zum Tabler-Font, nicht zu ICONS
    if (!defsIcons.has(icon)) {
      const line = html.slice(0, m.index).split('\n').length;
      defsIcons.set(icon, line);
    }
  }
  const missingDefsIcons = [...defsIcons.entries()].filter(([icon]) => !iconsKeys.has(icon));
  if (missingDefsIcons.length) {
    hasError = true;
    console.error("FEHLER: icon:'X'-Werte ohne passenden ICONS-Objekt-Schlüssel:");
    for (const [icon, line] of missingDefsIcons) console.error(`  - icon:'${icon}'  (erste Fundstelle: Zeile ${line})`);
  } else {
    console.log(`OK: alle ${defsIcons.size} nicht-ti-*-icon:'...'-Werte haben einen passenden ICONS-Schlüssel (von ${iconsKeys.size} vorhandenen).`);
  }
}

process.exit(hasError ? 1 : 0);
