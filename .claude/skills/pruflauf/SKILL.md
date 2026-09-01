---
name: pruflauf
description: 'Ablauf und Fallstricke des Pflicht-Prüflaufs vor jedem Commit im Spiel kolonie-kepler7 (node tests/run.js), inklusive der Regeln, wie man einen Hintergrundlauf sauber überwacht und seinen Exit-Code korrekt misst. IMMER verwenden, bevor an weltraum_kolonie.html committet oder gepusht wird, ein PR gemergt wird, oder wenn nach "testen", "Prüflauf", "VERSION erhöhen", "Patchnotes" oder "committen" im Kontext dieses Spiels gefragt wird — auch ohne dass explizit "run.js" genannt wird.'
---

# Prüflauf (kolonie-kepler7)

Der Merge nach `main` ist die Auslieferung selbst (Deploy-Webhook zieht sofort auf den Pi). Der
Prüflauf ist deshalb keine Formalie, sondern das einzige, was zwischen einer Änderung und den
Spielern steht. Vor jedem Commit an `weltraum_kolonie.html`, in dieser Reihenfolge:

## 1. Pflichtschritte

1. **`node tests/run.js`** (voller Lauf, ~25 Min) oder **`node tests/run.js --nur-pflicht`**
   (Sekunden) für schnelle Zwischenstände. Exit-Code 0 = sauber.
2. Prüft automatisch: Syntax des `<script>`-Blocks, Icon-Whitelist (`check-icons.js`),
   dass keine `index.html`-Kopie im Repo liegt, ob der Backend-Nachbar-Klon aktuell ist — danach
   alle Tests unter `tests/`.
3. **Keine `index.html` anlegen.** Die Kopie ist seit dem 01.09.2026 abgeschafft (nginx liefert
   `weltraum_kolonie.html` direkt); ein `cp` aus Gewohnheit lässt den Prüflauf fallen.
4. **VERSION-Konstante erhöhen + neuer PATCHNOTES-Eintrag** (deutsch, nie rückwirkend editieren).
   Erst **unmittelbar vor** dem Commit vergeben, `main` in diesem Moment nochmal ansehen — bei
   parallelen PRs kollidieren Versionsnummern sonst mehrfach. **`node build-patchnotes.js`**
   danach ausführen (erzeugt `patchnotes.html` neu, nie von Hand editieren).
5. Bei Mechanik-/Balance-Änderungen: siehe Skill `anzeigestellen` (HELP_SECTIONS, TUTORIAL_STEPS,
   alle Anzeigestellen derselben Größe).

## 2. Während der Prüflauf läuft

- **Die Spieldatei NICHT anfassen** — die Tests lesen sie live. Erst nach grünem Ergebnis
  committen.
- Lass den Lauf **ohne umschließende Subshell** im Hintergrund laufen, oder warte auf die
  Marker-Zeile `EXIT=` in einer Logdatei (`until grep -q "^EXIT=" log; do sleep 10; done`). Eine
  `(... ; echo EXIT=$? >> log) &`-Subshell meldet ihren EIGENEN Abschluss, nicht den des Tests
  darin — das Werkzeug sagt "completed" während die Suite noch minutenlang weiterläuft.
- Verfolge einen laufenden Prüflauf über seine Task-ID/Logdatei, nie über `pgrep -f "node
  tests/run.js"` — das Muster trifft auch die eigenen Wartejobs (die den Suchtext selbst
  enthalten) und meldet "läuft"/liefert eine PID, die gar nicht zum eigentlichen Lauf gehört. Kein
  `pkill` mit breitem Muster.
- Exit-Code **nie hinter einer Pipe** messen (`node test.js | grep FAIL; echo EXIT=$?` misst den
  Status von `grep`, nicht von `node`). Ausgabe in eine Datei umleiten und `echo EXIT=$?` direkt
  danach, oder `${PIPESTATUS[0]}`. Ebenso: ein leeres `grep -E "^FAIL"` über die Ausgabe beweist
  nichts — ein Absturz (`ReferenceError` o.ä.) passt auf kein `FAIL`-Muster und wird so als grün
  gemeldet. Der Exit-Code ist die Wahrheit, `grep` über die Ausgabe ist nur Beiwerk.

## 3. Wenn etwas rot ist

- Fällt ein Test, der `server.js`/`SERVERDATEI` aus dem Nachbarverzeichnis liest (z. B.
  `test_randkriege_*`, `test_ausbaubarer_deckel`, `test_pvp_deckel`): siehe Skill
  `backend-abgleich`, **bevor** der eigene Code verdächtigt wird.
- Ein neuer Testport kollidiert leicht mit bestehenden — `grep -n "PORT = " tests/*.js` vor der
  Wahl eines neuen.

## 4. Nach grünem Prüflauf

Offene PRs sofort mergen (nicht als Draft liegen lassen) — Frontend wie Backend. Der Prüflauf ist
das, was vor dem Merge stehen muss, nicht danach.
