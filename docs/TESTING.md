# Kepler 7 – Test- und Release-Regeln

Diese Datei fasst die dauerhaft relevanten Testregeln zusammen. Konkrete Suite-Details stehen zusätzlich in `tests/README.md`.

## Standardablauf

```bash
# Änderung bauen; VERSION/PATCHNOTES noch nicht anfassen
node tests/run.js

# erst nach grünem Volltest nächste freie Version bestimmen
node naechste-version.js

# VERSION + neuen deutschen PATCHNOTES-Eintrag setzen
node build-patchnotes.js
cp weltraum_kolonie.html index.html

# Abschlussprüfung für Nummer/Patchnotes/Synchronität
node tests/run.js --nummer
```

Für schnelle Zwischenprüfungen:

```bash
node tests/run.js --nur-pflicht
```

Die Versionsnummer möglichst spät vergeben, um Kollisionen mit paralleler Arbeit auf `main` zu reduzieren.

## Der Exit-Code entscheidet

Ein Test ist nur erfolgreich, wenn der Testprozess erfolgreich endet. Nicht aus gefilterter Ausgabe auf Erfolg schließen: Syntaxfehler, `ReferenceError` oder andere Abbrüche können außerhalb eines `grep`-Musters liegen.

## Neue Tests brauchen eine Gegenprobe

Nach Möglichkeit immer beidseitig belegen:

1. neuer/funktionierender Stand -> grün
2. alter oder gezielt sabotierter Stand -> rot

Bleibt ein Test am alten Stand grün, zuerst untersuchen, warum er die Regel nicht misst. Nicht nur Erwartungswerte so lange verändern, bis er zufällig rot wird.

## Fachliche Regel statt Momentaufnahme prüfen

- Erwartungen aus gemessenen Ausgangsdaten ableiten, wenn feste Zahlen nicht selbst Teil der Regel sind.
- Teilbedingungen gezielt prüfen statt ganze Codezeilen bytegenau zu vergleichen.
- Bei Zeitlogik die vom Spiel verwendeten Zeitstempel verwenden.
- Bei Refactorings Verhalten ausführen statt nur Textähnlichkeit zu prüfen.

## Namen, Keys und Bedienung aus dem Code ablesen

Vor Testaufbau suchen und verifizieren:

- Funktionsnamen
- Buttontexte
- Tab-/Untertab-Keys
- `data-*`-Attribute
- DOM-Container
- Fixture-Schlüssel

Nie raten. Ein Test kann trivial grün bleiben, wenn er ein nicht existierendes Element bedienen wollte.

## DOM-Selektoren scopen

Bei mehrfach vorhandenen Controls zuerst den relevanten Container bestimmen und innerhalb dieses Containers suchen. Globale `document.querySelector(...)`-Treffer können den gemeinsamen Zustand korrekt ändern, aber anschließend die falsche Darstellung beobachten.

## Textbasierte Tests: Anker prüfen

Vor `slice`, `indexOf` oder `lastIndexOf` sicherstellen, dass der gesuchte Anker existiert. Fehlende Anker dürfen nicht still einen falschen großen Dateibereich erzeugen.

Kommentare und historische Patchnotes können dieselben Zeichenketten wie der produktive Code enthalten. Negative Prüfungen wie „alter Text existiert nicht mehr“ deshalb auf den Live-Bereich begrenzen bzw. `PATCHNOTES` aus der Suchmenge ausschließen.

## Betroffenheits-Sweep vor langem Volltest

Nach Änderungen nicht nur nach dem geänderten Funktionsnamen suchen. Tests können ein Feature über DOM-Merkmale oder fachliche Texte bedienen.

Suchen nach:

- Funktions-/Konstantennamen
- `data-*`, Klassen und IDs
- sichtbaren Texten
- alten Grenzwerten/Literalen
- Tests, die bewusst das alte Verhalten erwarten

## Transiente UI richtig messen

Toasts, Logs und andere kurzlebige Meldungen nicht nur über einen späten DOM-Endstand prüfen. Wenn spätere Meldungen Inhalte verdrängen/überschreiben können, den tatsächlichen Verlauf mitschneiden (z. B. `MutationObserver` oder geeignete Instrumentierung).

Fehlerausgaben sollen zeigen, was tatsächlich sichtbar war, nicht nur „nicht gefunden“.

## Merge-/Rebase-Konflikte in Tests

Testdateien nie pauschal mit `ours` oder `theirs` ersetzen. Danach prüfen, dass keine Prüfungen aus einer Seite verloren gingen, z. B. durch Vergleich der Test-/Prüfnamen.

Ein grüner Lauf beweist nicht, dass ein Test noch gleich viel misst; versehentlich gelöschte Prüfungen machen eine Suite ebenfalls leichter grün.

## Refactorings

Wenn mehrere Einstiegspunkte auf eine gemeinsame Implementierung zusammengeführt werden:

- gemeinsame Schutzlogik nur einmal erwarten,
- alle Einstiegspunkte müssen dorthin delegieren,
- Verhalten mit realistischem Fixture ausführen,
- Test nicht abschwächen, nur weil die alte Struktur verschwunden ist.

## Nachbar-Repositories und Remote-Stand

Paritätstests können an veralteten Frontend-/Backend-Klonen scheitern. Gleichzeitig kann eine lokale `origin/main`- oder `origin/master`-Referenz selbst alt sein.

Darum unterscheiden zwischen:

- lokal = zuletzt gefetchte Remote-Referenz
- lokal = tatsächlicher aktueller Remote-Stand

Checks, die auf gecachten Remote-Referenzen beruhen, sollen deren Alter sichtbar machen.

## Qualitätstor für KI-Agenten

Ein KI-Agent darf eine Änderung nicht allein deshalb als fertig betrachten, weil der Patch plausibel aussieht. Für Kepler 7 gilt:

1. relevanten bestehenden Code und Tests finden
2. Änderung durchführen
3. gezielte Tests laufen lassen
4. vollständige Suite nach Aufgabenklasse ausführen
5. Fehlschlag analysieren statt Tests abzuschwächen
6. erst bei grünem Qualitätstor Version/Patchnotes vergeben

Damit bleibt die Ergebnisqualität unabhängig davon, ob der Code von Claude, einem lokalen Modell oder einem anderen Coding-Agenten erzeugt wurde.
