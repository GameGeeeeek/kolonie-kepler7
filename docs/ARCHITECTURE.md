# Kepler 7 – Architekturhinweise

Diese Datei enthält dauerhafte Architekturregeln, die zu detailliert für `CLAUDE.md` sind.

## Frontend-Grundstruktur

Kepler 7 ist derzeit im Kern eine große Single-File-Anwendung:

- `weltraum_kolonie.html` enthält HTML, CSS und Vanilla-JavaScript.
- Es gibt keinen klassischen Frontend-Build mit Framework-Komponenten.
- Der Pi-Deploy kopiert `*.html` ins Web-Verzeichnis; nginx liefert `weltraum_kolonie.html` direkt als Startseite (`index weltraum_kolonie.html;`, seit 01.09.2026).
- Eine `index.html`-Kopie gibt es nicht mehr; der Prüflauf lehnt sie ab, weil der Deploy nie löscht und eine Kopie live still veralten würde.

## Große Datei: gezielt statt vollständig arbeiten

Die Spieldatei ist groß genug, dass vollständiges Einlesen durch einen Coding-Agenten unnötig teuer und unübersichtlich wird.

Vorgehen:

1. Begriff/Funktion/Key per RAG oder `grep` lokalisieren.
2. Definition und direkte Aufrufstellen lesen.
3. Datenquelle, Mutation, Darstellung und Hilfetexte getrennt prüfen.
4. Nur die relevanten Bereiche ändern.
5. Anschließend nach alten Annahmen und Parallel-Darstellungen suchen.

Typische Suchziele nach Mechanikänderungen:

- Berechnungsfunktion/Konstante
- Vorschau
- Kurzurteil/Banner
- Ergebnis-/Kampfbericht
- `HELP_SECTIONS`
- `TUTORIAL_STEPS`
- `desc` / `effectDesc`
- Grenzwerte und Prozent-Literale

Eine korrekte Mechanik mit veralteter zweiter Anzeige gilt als unvollständige Änderung.

## Daten statt Doppelwahrheiten

Wo dieselbe Information mehrfach dargestellt wird, möglichst eine gemeinsame Datenquelle oder Hilfsfunktion verwenden.

Warnzeichen:

- derselbe Grenzwert als Literal an mehreren Stellen
- dasselbe Icon einmal aus einer Map und einmal hart im Markup
- fast identische Funktionen mit eigenen Sicherheitsprüfungen
- getrennte UI-Modi, die denselben Spielinhalt unterschiedlich zusammensetzen

Bei Refactorings auf eine gemeinsame Funktion müssen alle Einstiegspunkte weiterhin getestet werden.

Beispiel Karte: `karteSystemBadges` (Abzeichen), `systemDominanz` (wem ein System gehört) und
`kbMarkerFrei` (Markerplatz) sind je EINE Quelle für alle drei Kartenebenen. Wer dort etwas
ergänzt, versorgt automatisch Regionsübersicht, Sektoransicht und offene Systemebene — und prüft
vorher die Kosten je Knoten: eine Rechnung, die über alle Spieler oder Planeten läuft, gehört
hinter einen kurzen Zwischenspeicher (`systemHerrscherCached`, `storageCapCached`), sonst wird
sie mit der Zahl der Knoten quadratisch. Einzelheiten: `docs/sektorkarte-konzept.md`, Abschnitt 6.

Die Zeichnung der offenen Systemansicht (Korona, Tag-/Nachtseite, Halos, Ringe, Mondbahnen) lebt in
vier `sys*`-Helfern vor `buildMap` und kommt bewusst ohne SVG-Filter aus: Filter werden bei jeder
Neuzeichnung gerastert, die Ebene trägt Dauer-Animationen. Jeder Verlauf ist ein `radialGradient`,
alles ist deterministisch, sonst greift der Markup-Vergleich an der Schreibstelle nie.
Entscheidungen und Messwerte: `docs/sektorkarte-konzept.md` §7.

## UI-Modi und versteckte Verantwortung

Beim Entfernen oder Abschalten eines UI-Modus nicht nur die sichtbare Darstellung betrachten. Ein alter Zweig kann zusätzlich enthalten:

- Badges/Statussymbole
- Fraktions-/Kontrollinformationen
- Eventhinweise
- Handler-Aufbau
- Handler-Abbau
- `display`-/Klassen-Rücksetzungen
- Cleanup beim Schließen

Vor dem Entfernen eines Zweigs deshalb alle Bedingungen auf den Moduszustand suchen und je Zweig prüfen:

1. Welcher Inhalt existiert nur hier?
2. Welche Aufräumlogik existiert nur hier?

Gemeinsame Verantwortung in gemeinsame Funktionen ziehen statt sie in den neuen Zweig zu kopieren.

## Icons und Inhaltsdefinitionen

Jeder neue Inhalt – z. B. Forschung, Gebäude, Schiff, Modul, Offizier, Doktrin, Event oder Item – braucht:

- ein gültiges eigenes Icon bzw. einen vorhandenen gültigen Icon-Key,
- eine vollständige selbsterklärende Beschreibung,
- ggf. Angaben zu Stapelverhalten und Deckeln.

Ein vorhandener Eintrag in `ICONS`/`RES_ICONS` beweist nicht, dass die sichtbare Oberfläche ihn wirklich verwendet. Die Renderstelle ebenfalls prüfen.

## Konzepte vs. realer Code

Konzeptdateien beschreiben Absicht, nicht garantiert den aktuellen Implementierungsstand.

Vor Umsetzung daher:

- Zahlen nachrechnen,
- vorhandene Seltenheiten/Stufen/Keys suchen,
- Skalierung über Kolonien/Standorte/Stufen prüfen,
- bestehende Senken und Quellen gegenrechnen,
- Benennungen am aktuellen Code verifizieren.

Insbesondere laufende Produktionskosten skalieren anders als flug-/ereignisgebundene Ressourcen. Solche Konzepte immer quantitativ gegen den aktuellen Spielstand prüfen.

## Frontend-/Backend-Parität

Einige Features haben passende Daten oder Regeln im Backend. Bei Änderungen an gemeinsamen Spielobjekten, Kosmetik, IDs oder Mechaniken:

- Backend-Klon auf Aktualität prüfen,
- Frontend- und Backend-Schlüssel vergleichen,
- Paritätstests beachten,
- nach Rebase/Merge auch den Nachbar-Klon erneut prüfen.

Eine lokale `origin/*`-Referenz ist nur so aktuell wie der letzte Fetch. Prüfungen, die auf gecachten Fernreferenzen beruhen, müssen deren Alter sichtbar machen.

## Patchnotes und Live-Texte

`PATCHNOTES` sind Historie und werden nicht rückwirkend editiert. Live-Dokumentation dagegen muss den aktuellen Spielstand widerspiegeln.

Bei Mechanikänderungen deshalb neben dem Code auch prüfen:

- `HELP_SECTIONS`
- `TUTORIAL_STEPS`
- Karten-/Tooltip-Beschreibungen
- Vorschau-/Berichtstexte

`patchnotes.html` wird aus dem Patchnotes-Array erzeugt und nicht von Hand gepflegt.

### Patchnotes-Archiv und version.txt (01.09.2026)

- Der `PATCHNOTES`-Block im Spiel hält nur die neuesten 20 Versionen (`PATCHNOTES_IM_SPIEL` in `build-patchnotes.js`); das Spiel zeichnet davon 15 sofort. Die Historie liegt in `patchnotes-archiv.json` (eine Zeile je Version) und wird erst geladen, wenn jemand im Update-Tab auf „ältere Versionen" tippt. Vorher waren es 1,14 MB Literal in der Spieldatei, 18 % des JavaScripts, bei jedem Start mitgeparst.
- `build-patchnotes.js` rotiert die ältesten Einträge textuell (Wortlaut unverändert) ins Archiv, pflegt `PATCHNOTES_ARCHIV_ANZAHL` im Spiel (Restzahl für den Knopf, ohne das Archiv zu laden) und schreibt `version.txt`. Es bricht ab, statt Doppelte zu erzeugen. Wächter: `tests/test_patchnotes_archiv.js` (Bestand, Rotation an einer Kopie, Gegenprobe, Idempotenz).
- Der Versions-Check des Clients (Auto-Reload alle 5 Minuten, Update-Overlay bei Tab-Wechsel) liest `version.txt` (20 Byte) statt der ganzen Spieldatei; die Spieldatei wird nur noch bei einer wirklich neueren Version einmal geholt, für die Patchnotes im Overlay. Da nginx für unbekannte Pfade die Spieldatei selbst liefert (200, text/html), wird die Antwort auf das Versionsmuster geprüft; fehlt `version.txt`, greift höchstens alle 30 Minuten der alte Vollabruf. Wächter: `tests/test_versionscheck.js`.
- Tests, die den `PATCHNOTES`-Block als Historie ausschneiden, funktionieren unverändert; das Archiv wird von ihnen nicht durchsucht.

## Refactoring-Regel

Ein Refactoring ist erst abgeschlossen, wenn:

- die alte Duplikation tatsächlich entfernt ist,
- alle Einstiegspunkte auf die gemeinsame Implementierung führen,
- Schutzlogik nicht verloren ging,
- die Tests die neue Struktur mindestens so streng prüfen wie vorher,
- Verhalten mit einem realistischen Fixture oder ausführbarem Test gemessen wurde.

„Sieht gleich aus“ ist kein Nachweis für Verhaltensgleichheit.
