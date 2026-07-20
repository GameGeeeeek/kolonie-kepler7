# CLAUDE.md – kolonie-kepler7 (Frontend)

Browserbasiertes Weltraum-Kolonie-Idle-Spiel, komplett in **einer Datei** `weltraum_kolonie.html` (~15.800 Zeilen: HTML + CSS + Vanilla-JS in `<script>`, kein Build-Schritt, kein Framework). Deployt auf Saschas Raspberry Pi (nginx), erreichbar unter `gamegeeeeek.de` / `www.gamegeeeeek.de` per DynDNS (Domain-Offensive) – **nicht** über GitHub Pages (dort ist Pages deaktiviert, Stand 20.07.2026).

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
- **Signatur-Cache-Muster für `render*Box()`-Funktionen ohne Live-Countdown**: `let lastXSig = null;` vor der Funktion, am Anfang eine Signatur aus allen angezeigten Werten bilden, bei Gleichheit zum Vorlauf `return` statt `innerHTML` neu zu schreiben (Beispiele: `renderAllianceBaseHero`, `renderDominance`, `renderGalaxyNews`, `renderReportsBox`, `renderAllianceTitlesBox`/`renderAllianceSkinsBox`, `renderDailyLoginBox`, `renderFpAllianceDonation`, `renderFpLeaderboard`). **Nur anwenden, wenn die Box KEINEN Live-Countdown (`Date.now()`-Differenz, die sichtbar hochzählt) enthält** – sonst würde die Anzeige sichtbar einfrieren (bewusst NICHT angewendet auf `renderAutoExploreTourBox`, `renderAbhorchpostenBox`, `renderFactions`/`renderMarket`/`renderTradeRoutes`, die stattdessen `isTypingIn()` nutzen). Neue `render*Box()`-Funktionen ohne Countdown sollten dieses Muster von Anfang an übernehmen statt jeden Tick blind neu aufzubauen.
- **Sichtbarkeits-Gate für reines Anzeige-Polling**: `setInterval`s, die nur Daten zum ANZEIGEN nachladen (Bestenliste, Berichte, Nachrichten, Galaxie-Zustand, Allianzbasis-Kriegszustand/Spenden-Rangliste, Versions-Check), prüfen `document.visibilityState === 'visible'`, bevor sie feuern – spart Server-Anfragen/Akku im Hintergrund-Tab. **Bewusst NICHT** auf Timer mit echter Spielmechanik angewendet (`maybeScheduleRaid`, `maybeSchedulePirateDebrisRaid`, `maybeSpawnVoidRift`, `maybeSpawnTrader`, `refreshAllianceMusterAttack`) – deren Timing soll auch im Hintergrund-Tab real weiterlaufen.

## Proaktive Vorschläge

Der Nutzer möchte am Ende einer Session bzw. auf Nachfrage aktiv auf weitere Optimierungs- und Verbesserungsmöglichkeiten hingewiesen werden – sowohl Code/Performance (z. B. weitere `render*Box()`-Kandidaten für das Signatur-Cache-Muster, weitere reine Anzeige-`setInterval`s für das Sichtbarkeits-Gate, doppelte/tote Funktionen) als auch Grafik/Spielinhalt. Nicht nur auf explizite Nachfrage warten, sondern von sich aus konkrete, im Code begründete Vorschläge einbringen (nicht spekulativ – vor dem Vorschlagen kurz grep/lesen, um zu bestätigen, dass es sich wirklich lohnt).

## Deploy

Push nach `main` landet im Repo; live geht es erst, wenn Sascha die Änderungen manuell auf seinem Raspberry Pi zieht (dort läuft nginx und bedient `gamegeeeeek.de`/`www.gamegeeeeek.de`, per DynDNS bei Domain-Offensive). **GitHub Pages ist nicht aktiviert** (Settings → Pages: Source = „None") und deployt nichts – im Zweifel nachfragen statt einen automatischen Pull anzunehmen.

**PRs sofort mergen**: Offene PRs nach dem Push ohne Rückfrage direkt mergen (nicht als Draft offen lassen) – sonst landen Änderungen nicht auf `main` und Sascha kann sie gar nicht erst auf den Pi ziehen. Gilt für Frontend- und Backend-Repo gleichermaßen.
