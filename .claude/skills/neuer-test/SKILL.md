---
name: neuer-test
description: 'Konventionen und bekannte Fallstricke beim Schreiben oder Ändern eines Tests unter tests/ im Repo kolonie-kepler7 — Gegenprobe in beide Richtungen, gemessene statt eingetippte Ausgangswerte, gescopte Selektoren, eingefrorene Uhr, freie Ports, die REGEL statt einer Momentaufnahme prüfen. IMMER verwenden, wenn eine neue Testdatei angelegt oder eine bestehende grundlegend umgebaut wird — die meisten früheren Tests dieses Projekts waren zunächst scheinbar grün, ohne etwas zu belegen.'
---

# Neuer Test (kolonie-kepler7)

Tests liegen unter `tests/`, laufen per `node tests/<datei>.js` oder gesammelt über
`node tests/run.js`. Gemeinsame Umgebung: `tests/lib/umgebung.js` (Playwright/Chromium,
`SPIEL_URL`, optional `SERVER_JS` für Backend-Vergleiche, `pruefer()`-Helfer).

## Vor dem Schreiben

- **Fixture-Schlüssel und Bediennamen aus dem Code ablesen, nie raten.** `grep` nach dem
  tatsächlichen Reiter-Schlüssel, Knopftext, Funktionsnamen — erfundene Namen führen oft zu
  einem Test, der still nichts prüft (z. B. weil eine unbekannte Ansicht stur alle Panels
  ausblendet), statt mit einem Fehler abzubrechen.
- Neuen Testport gegen vorhandene prüfen: `grep -n "PORT = " tests/*.js`.

## Beim Schreiben

- **`document.querySelector` immer auf den Container scopen.** Manche Knöpfe/Felder existieren
  doppelt (alte Box + Overlay); ein ungescopter Selektor trifft den gemeinsamen Zustand zweimal
  und der Test vergleicht scheinbar etwas, das er gar nicht bewegt hat.
- **Ein Slice mit `indexOf`-Endanker prüft zuerst, dass der Anker existiert.** Fehlt er (genau der
  Fall im alten Stand, gegen den die Gegenprobe anschlagen soll), liefert `indexOf` `-1`, der
  Slice läuft fast bis zum Dateiende, die Prüfung wird vacuous. `lastIndexOf` statt `indexOf`
  verwenden, wenn ein Kommentar denselben Text zitieren könnte.
- **Eingefrorene Tabs**: nur `Date.now()` vorstellen, nie die Uhr-Hilfen des Browsertreibers
  (heilen versäumte Timer künstlich nach) und nie einen Proxy um `Date` (Endlosrekursion, und die
  Prüfung wird scheinbar grün, weil nie etwas passiert).
- **Ein „diese Box schreibt nicht neu"-Test** friert für sein Messfenster die Uhr ein (`Date.now`
  festhalten → Tick verstreichen lassen → dann markieren), sonst misst er Wanduhr-Glück statt der
  Cache-Regel. Ereignis-Uhren im Fixture bewusst in die Zukunft pinnen (sonst feuert der erste
  Wahrscheinlichkeits-Check oft garantiert, weil er bei `0` startet).

## Erwartungswerte

- **Gegen den gemessenen Ausgangsstand vergleichen, nie gegen eingetippte Zahlen.** Feste Werte
  wie „28"/„8" werden wertlos, sobald sich der Testspielstand ändert.
- **Die REGEL prüfen, nicht die Momentaufnahme.** Nicht eine Rückgabezeile zeichengenau
  vergleichen — prüfen, dass der geprüfte Term Teil des Ergebnisses IST, egal was sonst noch
  dazukommt.
- **Messen, was gemessen werden soll — nicht den Deckel.** Testspielstand so wählen, dass der
  gemessene Endwert nicht zufällig exakt auf einer Kappe landet. Erwartungswerte aus dem Spiel
  ableiten (Rate messen), nicht raten.
- **Bezugsgrößen selbst nachmessen**, wenn eine Aussage von einer über Zeit konstanten Größe
  abhängt (z. B. Produktionsrate) — unmittelbar vor UND nach dem Messfenster, nicht nur einmal am
  Anfang. Schwankt die Bezugsgröße zwischen zwei Läufen (z. B. durch ein zufälliges Ereignis
  mitten im Test), sieht das aus wie ein Fehler im Messgegenstand, ist aber keiner.
- Nach Umbau des Testablaufs: **Erwartungen am Ende mitziehen** — ein Test kann auf korrektem Code
  durchfallen, wenn nur die Endkontrolle noch den alten Ablauf prüft.

## Die Gegenprobe

- **Jeder neue Test braucht eine Gegenprobe in beide Richtungen**: grün am neuen Stand, rot am
  alten (`git show HEAD:datei` oder gezielt kaputtgemachte Kopie). Ein Test, der dreimal
  hintereinander "grün" war, hat schon einmal gar nichts geprüft (falscher Knopftext, disabled
  Button, fehlender Klick).
- **Bleibt die Gegenprobe am alten Stand grün, ist das kein Beweis, sondern der Befund.** Nicht
  nachbessern, bis sie zufällig rot wird — fragen, WARUM sie grün war. Häufig heilt sich der
  gemessene Zustand von selbst wieder ein (z. B. weil eine andere Stelle ihn beim nächsten
  Durchlauf überschreibt). Miss stattdessen etwas, das bleibt — z. B. eine Nutzer-sichtbare
  Meldung, mitgeschnitten per `MutationObserver`.
- **Eine Endstands-Prüfung nach mehreren Schreibversuchen misst nur den letzten.** Bei mehreren
  Schreibversuchen hintereinander (z. B. mehrere Fälschungsversuche) nach JEDEM einzelnen prüfen,
  nicht nur am Ende.
- **Eine Prüfung, die aus dem falschen Grund grün ist, ist so schlecht wie eine rote.** Kennt eine
  Sperre mehrere Gründe, den GRUND mitprüfen (z. B. den genauen Fehlertext), nicht nur den
  Statuscode/Boolean.

## Backend-Vergleiche

- Liest der Test `server.js`/`SERVERDATEI` aus dem Nachbarverzeichnis: siehe Skill
  `backend-abgleich`, bevor ein Fehlschlag als Spielfehler gemeldet wird.
- Ein Kontrollversuch in einem `git worktree` ohne Nachbar-Repo beweist nichts — solche Tests
  überspringen sich dort still und melden grün.

## Bei pauschalem Ersetzen über Testdateien

- In einer Testdatei stehen Suchmuster für fremden Code und ausgeführter eigener Code
  nebeneinander — ein Textersetzer sieht den Unterschied nicht. Nach so einem Lauf jede Datei
  einzeln per **Exit-Code** prüfen (siehe Skill `pruflauf`, Abschnitt Exit-Code), nicht per
  `grep FAIL` über die Ausgabe.
- Python-Ersetzskripte sollten bei `count != 1` vor dem Schreiben abbrechen — verhindert stille
  Fehlgriffe, wenn das erwartete Markup anders aussieht als angenommen.
