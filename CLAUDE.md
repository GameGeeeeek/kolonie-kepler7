# CLAUDE.md – kolonie-kepler7 (Frontend)

Browserbasiertes Weltraum-Kolonie-Idle-Spiel, komplett in **einer Datei** `weltraum_kolonie.html` (~15.800 Zeilen: HTML + CSS + Vanilla-JS in `<script>`, kein Build-Schritt, kein Framework). Deployt via GitHub Pages.

## Kritische Regel: zwei Dateien synchron halten

Der Pi-Deploy kopiert `weltraum_kolonie.html` (nicht `index.html`) ins Ausgabeverzeichnis. **Bei jeder Änderung müssen beide Dateien identisch sein** – am Ende jeder Session:
```
cp weltraum_kolonie.html index.html
```

## Vor jedem Commit (Pflicht, keine Ausnahme)

1. **Syntax-Check**: `node -e "new Function(fs.readFileSync('weltraum_kolonie.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1])"`
2. **Icon-Whitelist-Check**: `node check-icons.js` ausführen (Exit-Code 0 = sauber). Prüft automatisch (a) alle `ti-*`-Verwendungen gegen die ~69 Icons des eingebetteten Icon-Fonts (Whitelist wird per Regex aus der Datei selbst gezogen, nie aus dem Gedächtnis geraten) und (b) alle nicht-`ti-*`-`icon:'X'`-Werte in den DEFS-Arrays gegen die Schlüssel des `ICONS`-Objekts. Eingeführt nach dem `ti-gift`-Bug (v8.77.1), der vor dem Commit nicht auffiel – das Skript macht genau diesen Fehlertyp jetzt automatisch sichtbar.
3. **JSDOM-Boot+Tab-Sweep**: Datei in jsdom laden, `runScripts:'dangerously'`, alle Tab-Buttons durchklicken, auf Konsolenfehler prüfen. Mit realistischem Spielstand (mehrere Kolonien inkl. Mond, aktive Forschung/Missionen) – ein leerer Spielstand übersieht Bugs, die erst bei voller Array-Traversierung auftreten.
4. **VERSION-Konstante erhöhen + neuer PATCHNOTES-Eintrag** (deutsch). Patchnotes-Einträge sind unveränderliche Historie – nie rückwirkend editieren, auch wenn sie veraltete Zahlen zeigen.
5. Bei Mechanik-/Balance-Änderungen: **HELP_SECTIONS und TUTORIAL_STEPS** live-Texte mit aktualisieren (nicht die Patchnotes-Historie).

## Bekannte Fallstricke

- **Doppelte Funktionsdeklarationen**: JS überschreibt bei zwei `function name(){}` mit demselben Namen stillschweigend die erste mit der zweiten – bei dieser Dateigröße schon einmal passiert (`renderWorldBoss` existierte zweimal, die spätere/falsche gewann). Vor Änderungen an einer Funktion: `grep -n "function funktionsname"` prüfen, dass es nur eine Definition gibt.
- **Naive Regex über die ganze Datei** kann an verschachtelten `]`/`}` in Array-Literalen falsch terminieren. Immer mit `grep -n` auf konkrete Zeilennummern verifizieren, nicht blind einer Regex vertrauen.
- **Nach Bulk-Einfügen in Arrays** (PLANETS, RESEARCH_DEFS etc.): Regex-Check auf `,\s*,` (doppeltes Komma ist gültiges JS, crasht aber `Array.find()`).
- **Neue Box mit `<input>`/`<textarea>`**, die von einem wiederkehrenden Trigger (Haupt-Tick, `setInterval`) neu gerendert wird: braucht von Anfang an `isTypingIn('boxId')`-Schutz, sonst verliert das Feld beim Tippen den Fokus.
- **BUILDING_DEFS mit `category:'defense'`**: `defVal`/`atkVal` müssen explizit gesetzt sein (mind. `0`), sonst kippt die globale Verteidigungsberechnung auf `NaN` (kein `||0`-Fallback an der Summierstelle).
- **"N Minuten eigene Produktion" als Belohnungsformel** taucht mehrfach auf (Piratennester, Fraktionsgeschenke, Wochenliga, Tagesaufgaben) – bei starker Wirtschaft schnell explosiv. Bei neuen Belohnungsmechaniken diesem Muster bewusst ausweichen oder hart deckeln.
- **Additive+gedeckelte Bonus-Gruppen statt reiner Multiplikation**: Produktion UND Kampfkraft nutzen bewusst `1 + Math.min(1.0, summe_kleiner_boni)` statt `×1.1×1.15×1.2×…`, um explosionsartiges Aufschaukeln vieler kleiner Boni zu verhindern. Neue "kleine, stapelnde" Boni gehören in diese Gruppe, nicht als eigene Multiplikation.

## Architektur-Kurzüberblick

- Ein einziges `state`-Objekt, per `save()`/localStorage bzw. Server-Sync persistiert
- Backend-Kommunikation optional (`useBackend()`) – Solo-Modus funktioniert ohne Server, Allianzen/Markt/Weltboss brauchen ihn
- Geteilter Speicher (Allianzen, Markt, Weltboss) läuft über generische `storageGet/storageSet/storageList`-Aufrufe gegen das Backend, mit Schlüsselpräfixen wie `alliance:<TAG>:...`
- Rendering: kein virtuelles DOM, direktes `innerHTML`-Neuschreiben pro Box, getriggert vom Haupt-Tick (1×/Sekunde) und bei Nutzeraktionen

## Deploy

Push nach `main` → GitHub Pages aktualisiert automatisch. Sascha zieht zusätzlich manuell auf dem Pi (falls dort ein Cache/eigener Reverse-Proxy zwischengeschaltet ist – im Zweifel nachfragen statt annehmen).
