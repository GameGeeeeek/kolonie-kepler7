---
name: backend-abgleich
description: 'Prüfen, ob der Nachbar-Klon kolonie-kepler7-backend aktuell ist, bevor ein Testfehler in kolonie-kepler7 als echter Spielfehler gemeldet wird. Betrifft Tests, die server.js aus dem Nachbarverzeichnis lesen (z. B. test_randkriege_*, test_ausbaubarer_deckel, test_pvp_deckel, oder allgemein Tests, die Frontend- gegen Backend-Formeln vergleichen). IMMER als ERSTEN Verdacht verwenden, wenn so ein Test fehlschlägt — dreimal ist das in diesem Projekt bereits ein veralteter Nachbar-Klon gewesen, kein echter Bug.'
---

# Backend-Abgleich (kolonie-kepler7 ↔ kolonie-kepler7-backend)

Einige Tests vergleichen Frontend- und Backend-Formeln Zeile für Zeile (Konterrollen,
Kampfphasen, Flottenbalance, Randkriege) und lesen dafür `server.js` aus dem Nachbarverzeichnis
`../kolonie-kepler7-backend`. Dieser Nachbar ist ein eigenständiger Git-Klon — er zieht sich
nicht automatisch nach, wenn im Backend-Repo gemerged wird.

**Dreimal ist genau das die Ursache eines fehlgeschlagenen Tests gewesen**, nicht ein Fehler im
Spiel: der Backend-Klon stand zwei bis drei Commits hinter `origin/master`, während das Frontend
schon die passende Fassung erwartete.

## Sofort-Check

```
cd ../kolonie-kepler7-backend && git fetch && git log --oneline -1 origin/master
```

Vergleiche das Ergebnis mit dem lokalen `HEAD` des Backend-Klons (`git log --oneline -1`). Steht
der Klon zurück: `git pull origin master` (oder den passenden Branch) im Backend-Verzeichnis, dann
den Test erneut laufen lassen — **bevor** am Frontend-Code gesucht wird.

`node tests/run.js` prüft das seit v8.485.0 selbst als fünfte Pflichtprüfung — bewusst ohne
`git fetch` (soll ohne Netz laufen) und bewusst gegen `origin/master` statt `@{u}`, weil der Klon
im Fehlerfall oft auf einem eigenen Branch ohne Fernbezug steht und `@{u}` dort abbricht.

## Fallstricke bei der Gegenprobe

- **Ein Kontrollversuch in einem `git worktree` (z. B. unter `/tmp`) beweist hier nichts.** Ein
  Worktree hat kein Nachbarverzeichnis `kolonie-kepler7-backend`; `umgebung.js` findet den
  Backend-Quelltext dort nicht, und genau diese Tests **überspringen sich dann still und melden
  grün**. Das sieht wie eine Bestätigung aus, ist aber nur ein Test, der sich selbst im Weg steht.
- **Vor jeder Messung beide Repos auf ihren Ursprung ziehen** — nicht nur das, an dem gerade
  gearbeitet wird. Auch das Backend-Arbeitsverzeichnis kann auf einem eigenen, nicht
  gemergten Branch stehen.
- Passt derselbe Mechanismus auch auf die **Frontend**-Seite: prüfen, ob ein Melder versehentlich
  eine veraltete Kopie statt `weltraum_kolonie.html` gelesen hat (bis 01.09.2026 lag eine
  `index.html`-Kopie im Repo) — Zeilennummern passen dann auf die falsche Datei.

## Von außen messen, welchen Stand der Pi wirklich fährt

Für Fragen "ist der Deploy überhaupt angekommen" (nicht: ist der lokale Klon aktuell): eine Route,
die es im laufenden Backend-Prozess gibt, antwortet ohne Token mit **401**, eine unbekannte Route
mit **404**. `/api/health` mit 200 beweist nur, dass irgendein Backend läuft — nicht, welcher
Stand. Immer eine Gegenprobe mit einer ALTEN, sicher vorhandenen Route mitführen, sonst misst man
nur die eigene Messmethode.

## Der Klon ist aktuell — und *deshalb* fällt der Test (05.09.2026)

Der umgekehrte Fall zu allem oben: Nicht der veraltete Klon bricht den Test, sondern ein **frischer**.

`tests/test_randkriege_front.js` baut `rkTick` aus dem Serverquelltext per `new Function` nach und
reicht dabei eine Handvoll Funktionen als Umgebung hinein (`pushGalaxyNews`, `loadOrInitFactions`,
…). Backend-PR #242 (Galaxie-Chronik) fügte in `rkTick` einen Aufruf von `chronikVermerken` ein.
Diese Funktion gab es in der Testumgebung nicht — der Lauf brach mit `ReferenceError` ab, mitten in
einem Prüflauf, der mit Randkriegen nichts zu tun hatte, und in einem PR, der die Datei nicht
anfasst.

Erkennungsmerkmal: **`ReferenceError: <name> is not defined`** aus einem `<anonymous_script>` unter
`eval at baueUmgebung`. Der Name steht dann im Backend, nicht im Frontend.

Messung, die es in zwei Minuten klärt — den Klon auf den Stand VOR dem verdächtigen Merge stellen
und denselben Test noch einmal fahren:

```
cd ../kolonie-kepler7-backend && git checkout <commit-davor>
cd ../kolonie-kepler7 && node tests/<test>.js      # grün -> die Ursache liegt im Backend-Merge
cd ../kolonie-kepler7-backend && git checkout master
```

Die Reparatur gehört ins **Frontend**, in die Umgebung des Tests. Und sie ist keine stumme
Attrappe: `chronikVermerken` schreibt jetzt mit (wie `pushGalaxyNews`), die Umgebung gibt die Liste
heraus, und Abschnitt 7 prüft, dass der Durchbruch mit Sieger und Verlierer im Ereignisbuch landet.
Eine Attrappe, die nur schweigt, hätte den Aufruf zwar überlebt, aber nichts belegt.
Gegenprobe: den `chronikVermerken`-Aufruf im Klon entfernen → genau diese eine Prüfung fällt.
