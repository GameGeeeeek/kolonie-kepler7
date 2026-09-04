# CLAUDE.md – Kepler 7 Frontend

Diese Datei ist absichtlich kurz. Sie enthält nur Startkontext und Regeln, die in praktisch jeder Coding-Session gelten. Historische Vorfälle, lange Begründungen und Spezialwissen gehören in die verlinkten Dateien unter `docs/` oder bleiben über die Git-Historie auffindbar.

## Projekt in 30 Sekunden

- Browserbasiertes Weltraum-Kolonie-/Idle-Spiel.
- Hauptcode: `weltraum_kolonie.html` – große Single-File-Anwendung mit HTML, CSS und Vanilla-JS; kein Framework und kein Build-Schritt für das Spiel selbst.
- Es gibt **keine** `index.html`-Kopie mehr (seit 01.09.2026); nginx auf dem Pi liefert `weltraum_kolonie.html` direkt als Startseite (`index weltraum_kolonie.html;`). Eine neu angelegte Kopie lässt den Prüflauf fallen.
- Deployment läuft auf dem Raspberry Pi über nginx, nicht über GitHub Pages.
- Backend und weitere Dienste liegen in Nachbar-Repositories. Bei Änderungen über Repo-Grenzen hinweg immer beide Seiten prüfen.
- Der lokale GameGeeeeek AI Hub/RAG kennt Frontend, Backend und Social Hub. Für Code-Suche zuerst RAG/grep verwenden statt die komplette Spieldatei in einen LLM-Kontext zu laden.

## Kontext sparsam halten

1. Nicht die komplette `weltraum_kolonie.html` lesen, wenn eine gezielte Suche reicht.
2. Für „wo wird X gemacht?“ zuerst lokale RAG-Suche (`POST /kepler/ask`) oder `grep` verwenden.
3. Nur die betroffenen Codebereiche in den Arbeitskontext laden.
4. Keine Sitzungsprotokolle, Fehlergeschichten oder komplette Debug-Verläufe in diese Datei schreiben.
5. Neue dauerhafte Erkenntnisse nur dann dokumentieren, wenn sie zukünftige Arbeit konkret verändern.
6. Wiederholbare Regeln automatisieren (Tests/Skripte) statt sie nur als Erinnerung aufzuschreiben.

Details: `docs/AI_WORKFLOW.md`.

## Pflicht vor jeder Codeänderung

- Zuerst bestehende Implementierung, Datenquellen, Anzeigestellen und vorhandene Tests suchen.
- Namen, Selektoren, IDs, Keys und Funktionsnamen aus dem Code ablesen; nicht raten.
- Bei Mechanik-/Balance-Änderungen alle Darstellungen derselben Größe suchen: Vorschau, Banner, Bericht, Hilfe, Tutorial und `desc`-/`effectDesc`-Texte.
- Neue Inhalte brauchen ein gültiges eigenes Icon und eine vollständige Beschreibung.
- Bei Änderungen mit Frontend-/Backend-Bezug beide Repositories auf Parität prüfen.

Architekturhinweise: `docs/ARCHITECTURE.md`.

## Test- und Release-Ablauf

Für normale Änderungen gilt:

```bash
# 1. Änderung bauen; VERSION/PATCHNOTES noch nicht anfassen
node tests/run.js

# 2. Erst nach grünem Volltest nächste freie Version bestimmen
node naechste-version.js

# 3. VERSION + neuen deutschen PATCHNOTES-Eintrag eintragen
node build-patchnotes.js

# 4. Nach der Nummernvergabe gezielte Abschlussprüfung
node tests/run.js --nummer

# 5. committen / PR erstellen
```

Für schnelle Zwischenprüfungen:

```bash
node tests/run.js --nur-pflicht
```

Der volle Lauf dauert rund 91 Minuten. Wenn das zu lang ist oder ein Abbruch droht (Container-Neustart,
fremder Merge), läuft er gestückelt und gleichzeitig — gemessen 37 Minuten statt 91:

```bash
node pruflauf.js                 # alle Tests, 4 Stücke gleichzeitig
node pruflauf.js --fortsetzen    # fertige Stücke überspringen
```

**Ein rotes Stück ist dort ein Verdacht, kein Urteil.** Vier gleichzeitige Browser erzeugen Last, und
zeitkritische Tests kippen daran (gemessen am 03.09.2026: zwei Tests fielen, beide einzeln grün).
Das Skript fährt rote Tests deshalb selbst noch einmal einzeln nach und wertet nur das Ergebnis
dieser Nachprüfung. Nicht durch eine Pipe aufrufen — `| tail` verwirft den Exit-Code.

## Mehrere Sitzungen gleichzeitig

Arbeiten dürfen alle Sitzungen parallel. **Ausliefern darf nur eine zur Zeit.** Der Zustand des Pull
Requests ist die Ampel: Entwurf heißt „ich arbeite noch, mergt ruhig", bereit zur Prüfung heißt
„ich liefere gerade aus". Ein PR wird deshalb aus dem Entwurf geholt, **wenn der abschließende
Prüflauf startet** — wer erst danach sperrt, sperrt das Fenster nicht, in dem das Rennen
stattfindet (gemessen am 03.09.2026).

Ein fremder Merge entwertet den eigenen Lauf nur, wenn er die Spieldatei anfasst. **Das misst
`pruflauf.js` seit dem 04.09.2026 selbst** — vor dem Lauf (dann bricht er ab, Code **2**) und nach
dem Lauf (dann ist das Urteil hin, ebenfalls Code **2**, auch bei grünen Tests). Ein echter
Testfehler bleibt Code 1. Die PR-Ampel oben bleibt trotzdem Pflicht: Sie soll das Rennen
*verhindern*, die Messung stellt es nur *fest*. Was die Messung kann und was nicht:
`docs/TESTING.md`, Abschnitt „Die Merge-Ampel".

Details: `docs/TESTING.md`.

Wichtig:
- Der Exit-Code entscheidet, nicht ein `grep` über Teile der Testausgabe.
- Ein neuer Test braucht eine Gegenprobe: am neuen Stand grün und an einem gezielt alten/kaputten Stand rot.
- Tests prüfen Regeln/Verhalten, nicht zufällige Momentaufnahmen.
- Selektoren in Tests auf den tatsächlich geprüften Container begrenzen.
- Such-/Slice-Anker vor Benutzung explizit auf Existenz prüfen.
- Nach Konflikten in Testdateien niemals pauschal eine Seite übernehmen; prüfen, dass keine Prüfungen verloren gingen.
- Vor jedem Merge eine adversarische Durchsicht des eigenen Änderungssatzes (`/code-review <ziel> high`).
  Der grüne Lauf beweist nur, dass nichts Bekanntes gebrochen ist. Befunde werden geprüft, nicht
  geglaubt — und jeder bestätigte bekommt einen Wächter mit Gegenprobe.

Mehr: `docs/TESTING.md` und `tests/README.md`.

## Eine Spieldatei, keine Kopie

Der Pi-Deploy kopiert `*.html` ins Web-Verzeichnis und löscht dort nie; nginx nimmt `weltraum_kolonie.html` als Startseite. Eine `index.html` im Repo würde live ausgeliefert und beim nächsten Release still veralten, deshalb verbietet der Prüflauf sie.

## Patchnotes und Live-Dokumentation

- `PATCHNOTES` sind unveränderliche Historie. Alte Einträge nicht rückwirkend umformulieren.
- Im Spiel stehen nur die neuesten 20 Versionen; alles Ältere liegt in `patchnotes-archiv.json` (seit 01.09.2026). Neue Einträge werden weiterhin **nur** oben in `PATCHNOTES` geschrieben; `node build-patchnotes.js` rotiert die ältesten ins Archiv und schreibt `patchnotes.html`, `patchnotes-archiv.json`, `version.txt` und den Zähler `PATCHNOTES_ARCHIV_ANZAHL`. Alle diese Dateien gehören in denselben Commit; Archiv und `version.txt` nie von Hand anfassen.
- Bei Mechanik-/Balance-Änderungen die aktuellen Texte in `HELP_SECTIONS` und `TUTORIAL_STEPS` mit aktualisieren.
- Tests, die prüfen, dass ein alter Text nicht mehr existiert, dürfen nicht versehentlich im historischen `PATCHNOTES`-Block suchen.

## Arbeitsprinzipien

- Erst messen, dann ändern.
- Konzepte und Dokumentation sind Absichtserklärungen; Werte und Namen vor Umsetzung gegen den aktuellen Code prüfen.
- Nach einer Verhaltensänderung nach alten Annahmen suchen, nicht nur nach dem geänderten Funktionsnamen.
- Bei UI-Zuständen sowohl Aufbau als auch Aufräumlogik prüfen.
- Bei transienten Meldungen/Toasts nicht nur den späteren DOM-Endzustand messen, sondern den tatsächlichen Ereignisverlauf.
- Bei Refactorings Tests stärker machen: gemeinsame Implementierung + alle Einstiegspunkte prüfen.
- Wenn eine wiederkehrende Fehlerklasse zuverlässig erkannt werden kann, einen Test/Check dafür bauen.

Verdichtete Erfahrungsregeln: `docs/PROJECT_MEMORY.md`.

## KI-/Werkzeugwahl

- RAG/grep: Lokalisierung, Querverweise, kleine Wissensfragen.
- Lokales Modell: Analyse, einfache Änderungen, Testideen, Vorarbeit.
- Cloud-Coding-Agent: komplexe Änderungen, Refactorings, schwierige Debugging-Aufgaben – aber nur mit relevantem Kontext.
- Graphify nicht auf die riesige `weltraum_kolonie.html` loslassen; HTML wird dort als Dokument behandelt. Graphify eignet sich besser für echte Code-Dateien wie `tests/*.js`, Backend-JS, Social-Hub-TypeScript und AI-Core-Python.

Mehr: `docs/AI_WORKFLOW.md`.

## Dokumentationsstruktur

- `CLAUDE.md` – nur universeller Startkontext und Pflichtregeln.
- `docs/ARCHITECTURE.md` – Architektur, Repo-Grenzen und Daten-/UI-Grundsätze.
- `docs/TESTING.md` – Teststrategie, Gegenproben, Release-/Versionsablauf.
- `docs/AI_WORKFLOW.md` – RAG, lokale KI, Graphify und kontextsparsames Arbeiten.
- `docs/PROJECT_MEMORY.md` – verdichtete, weiterhin relevante Lehren aus früheren Fehlern und Umbauten.
- `tests/README.md` – konkrete Test-Suite.
- Fachkonzepte bleiben in ihren vorhandenen Dateien unter `docs/`.

## Dokumentation künftig pflegen

Neue Information wird nach diesem Schema abgelegt:

- Gilt fast immer? -> nur dann kurz in `CLAUDE.md`.
- Architektur-/Systementscheidung? -> `docs/ARCHITECTURE.md`.
- Test-/Release-Lehre? -> `docs/TESTING.md`.
- KI-/Tooling-Lehre? -> `docs/AI_WORKFLOW.md`.
- Übertragbare Projekterfahrung? -> `docs/PROJECT_MEMORY.md`.
- Feature-spezifisch? -> passende Konzeptdatei unter `docs/`.
- Reine Sitzungshistorie oder einmaliger Vorfall? -> nicht dauerhaft dokumentieren; Git/PR-Historie reicht.

Die frühere große `CLAUDE.md` bleibt vollständig über die Git-Historie vor diesem Cleanup verfügbar. Sie soll nicht wieder als wachsendes Sitzungsarchiv aufgebaut werden.
