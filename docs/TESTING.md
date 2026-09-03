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

# Abschlussprüfung für Nummer/Patchnotes
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

### Die laute Kopie (`KEPLER_SPIELDATEI`)

Zufällige Störungen lassen sich nicht abwarten, sondern werden hochgedreht: eine Kopie der
Spieldatei unter einem anderen Pfad, dort die Wahrscheinlichkeit verstellt, und die Tests über
`KEPLER_SPIELDATEI` dagegen gefahren. Die echte Spieldatei bleibt dabei unangetastet, ein
gleichzeitig laufender Prüflauf also gültig.

Zwei Belege gehören dazu, sonst ist „grün" ein Werkzeugbefund:

- **Die Umleitung kam an.** Einmal gegen eine absichtlich kaputte Datei fahren – der Test muss
  fallen. Eine still ignorierte Umgebungsvariable sieht sonst aus wie eine bestandene Probe.
- **Die Sabotage hat gegriffen.** Eine Sonde in eine *Kopie* des Tests unter `tests/` setzen
  (nicht aus `/tmp`, dort löst `require('./lib/umgebung')` nicht auf) und die Störung im Lauf
  wirklich messen, nicht aus der Wahrscheinlichkeit erschließen.

Gemessen am 02.09.2026 mit `Math.random() > 0.9` statt `0.0025` in `maybeSpawnRandomEvent`: Alle
24 Tests, die Fensterlage messen und keinen Ereignis-Riegel führen, bleiben grün, obwohl das
Banner in ihren Läufen nachweislich stand (152 px bzw. 98 px). Das Spiel weicht dieser
Verschiebung selbst aus – ausweichende Klappe seit dem 18.08.2026, Bildruhe seit dem 21.08.2026.
Ein flächiger Einbau von `ruhigeUhren()` in diese Tests wäre also Arbeit ohne Beleg gewesen.

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

## Fixtures wie der echte Erzeuger bauen

Steht im Code ein Rückfall hinter `||`, `??` oder einem `if`, prüft eine Fixture, die den ersten
Zweig füllt, den Rückfall **nie** – und der Rückfall ist oft genau der Live-Pfad. Gemessen am
02.09.2026: Eine Prüfung auf `r.standortName || fremdStandortName(key)` setzte `standortName` in der
Fixture; die Gegenprobe „falsche Namensauflösung" blieb deshalb grün, obwohl serverseitig erzeugte
Berichte dieses Feld gar nicht tragen.

Die Frage lautet nicht „welche Felder brauche ich?", sondern **„welche Felder schickt der echte
Erzeuger?"** – und wenn es mehrere gibt (Client-Weg und Server-Weg), braucht jeder seinen eigenen
Fall.

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

## Auf den ersten Schreibvorgang warten

Wer misst, was ein Zweig über `save()` in den gespeicherten Spielstand schreibt, wartet auf den
ERSTEN Schreibvorgang nach dem Boot – und vergleicht dabei gegen dieselbe Fixture-Zeichenkette,
die im Mock-Speicher liegt. Ein frisch erzeugtes `save()` trägt ein anderes `lastTick`, ist nie
gleich, und die Warteschleife greift dann einen späteren Autosave mit Produktion darin
(gemessen 6.124 statt 6.000 Erz, `test_admin_erweiterungen_ui` 4a). Ressourcen im Fixture unter
dem Lagerdeckel halten – sonst misst man den Deckel statt der Gutschrift.

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

**Die Warnung ist einseitig, der Fehler nicht.** Der Prüflauf meldet einen veralteten *Nachbar*-Klon;
für das *eigene* Repository gibt es keine solche Meldung. Genau dort entsteht der teure Fall: Ein
Paritätstest, gemessen gegen ein veraltetes eigenes `main`, sieht wie eine echte Lücke aus – man
„behebt" dann etwas, das stromaufwärts längst geschlossen ist. Vor jeder Paritätsaussage deshalb
**beide** Seiten auffrischen, nicht nur die, die der Prüflauf namentlich erwähnt.

## Eine Attrappe, die unbedingt Erfolg meldet, fälscht genau das, was fehlschlägt

Sechs serverseitig entschiedene Mechaniken waren seit ihrer Auslieferung tot (siehe
`docs/PROJECT_MEMORY.md`, Punkt 20) – und **jede hatte Tests**. Die Tests waren nicht schlampig
geschrieben; sie waren an genau einer Stelle blind: Ihre Backend-Attrappen antworteten
*bedingungslos* mit einem Erfolgs-Objekt.

```js
if (p === 'festung/angriff') return j(antwort.body, antwort.status);   // fragt nie nach der Mission
```

Der echte Server sucht an dieser Stelle die Mission im gespeicherten Spielstand und antwortet ohne
Fund mit 403. Die Attrappe übersprang genau diese Prüfung – also die einzige, die fehlschlug. Eine
Prüfung wie „der Client ruft `/asteroid/contest` mit einer Missions-ID auf" war dadurch grün,
während der Server diese ID nie zuordnen konnte.

**Die Regel: Eine Attrappe muss die Vorbedingungen prüfen, an denen der echte Endpunkt scheitert –
mindestens die, die er selbst aus dem mitgeschickten Zustand ableitet.** Wo ein Server aus dem
gespeicherten Spielstand liest, muss die Attrappe aus dem zuletzt gespeicherten Stand lesen. Ein
Erfolgs-Objekt aus dem Nichts prüft den Client gegen eine Welt, in der nichts schiefgehen kann.

Erkennungsfrage beim Schreiben einer Attrappe: *Welche Antwort gibt der echte Endpunkt, wenn der
Client etwas falsch macht – und kann meine Attrappe diese Antwort überhaupt erzeugen?* Lautet die
Antwort „nein", prüft der Test den Fehlerfall nicht, egal wie viele Prüfungen er enthält.

Gegenstück im Repo: `tests/test_server_aufloesung.js`. Seine Attrappe schlägt die Missions-ID im
zuletzt gespeicherten Stand nach und antwortet ohne Fund mit 403 – das ist die tragende
Eigenschaft dieses Tests, nicht ein Detail.

## Qualitätstor für KI-Agenten

Ein KI-Agent darf eine Änderung nicht allein deshalb als fertig betrachten, weil der Patch plausibel aussieht. Für Kepler 7 gilt:

1. relevanten bestehenden Code und Tests finden
2. Änderung durchführen
3. gezielte Tests laufen lassen
4. vollständige Suite nach Aufgabenklasse ausführen
5. Fehlschlag analysieren statt Tests abzuschwächen
6. erst bei grünem Qualitätstor Version/Patchnotes vergeben

Damit bleibt die Ergebnisqualität unabhängig davon, ob der Code von Claude, einem lokalen Modell oder einem anderen Coding-Agenten erzeugt wurde.

## Ein Anker darf nicht auf Patchnote-Wortlaut stehen (02.09.2026)

Seit der Archiv-Rotation (v8.638.0) hält der `PATCHNOTES`-Block im Spiel nur noch die neuesten
Versionen; alles Ältere wandert nach `patchnotes-archiv.json`. Damit ist **jeder feste
Patchnote-Wortlaut in einem Test ein Ablaufdatum**.

`test_bossset_pve.js` hatte genau das: einen Anker, der beweisen sollte, dass der PATCHNOTES-Block
wirklich herausgeschnitten wurde, und der dafür einen bestimmten historischen Satz voraussetzte.
Der Satz rotierte ins Archiv, der Anker verlor still seinen Gegenstand, und der Test wurde rot,
ohne dass sich am Geprüften etwas geändert hatte — auf `main`, also am ausgelieferten Stand.

Regeln daraus:

- **Positive Anker lesen ihre Probe aus dem Block selbst**, bei jedem Lauf frisch (z. B. ein Stück
  aus dessen Mitte). Ein Stück aus dem Block kann nicht herausrotieren, solange es Patchnotes gibt.
- **Wer „die Historie ist unangetastet" prüft, liest beide Dateien** — Spieldatei *und*
  `patchnotes-archiv.json`. Wer nur die Spieldatei liest, misst „umgeschrieben", wo rotiert wurde.
- **Negative Prüfungen** („dieser Text steht nicht mehr im lebenden Code") sind von der Rotation
  nicht betroffen; der Historien-Schnitt schützt sie dort nur vor falschem Rot. Sie brauchen keine
  Änderung.

Die Fehlerklasse lässt sich messen statt raten: Zeichenketten aus `tests/*.js` suchen, die im
Archiv stehen, aber nicht mehr in `weltraum_kolonie.html`. Am 02.09.2026 traf das neun Dateien —
acht davon nur in Kommentaren, eine (`test_bossset_pve.js`) in einer echten Voraussetzung.

## Eine Scheibe ohne gefundenen Anfang beginnt bei 0

`cblock.slice(cblock.indexOf(kopf), …)` liefert bei fehlendem `kopf` **nicht** nichts, sondern die
Scheibe ab Index 0 — `indexOf` gibt `-1`, und `slice` zählt das vom Ende her, bzw. bei einem leeren
Suchstring 0. `test_muster_nest_ui.js` prüfte darauf, dass ein bestimmter Zweig die Währungsfelder
nicht anfasst; fehlte der Zweig ganz, maß die Prüfung den Blockanfang und ging grün durch — genau
in dem Fall, für den sie gebaut war.

Wer eine Scheibe an einem gesuchten Anker aufhängt, gibt bei nicht gefundenem Anker **leer**
zurück und lässt die Prüfung daran scheitern.

## Parallele Sitzungen: arbeiten dürfen alle, ausliefern darf einer (03.09.2026)

Mehrere Coding-Sitzungen am selben Repo sind erwünscht. Das Problem ist nicht die Arbeit, sondern
die **Auslieferung**: Ein Volllauf dauert gemessen 91 Minuten. Jeder fremde Merge, der in dieser
Zeit `weltraum_kolonie.html` anfasst, entwertet ihn — der Lauf hat dann einen Stand geprüft, der
nicht mehr ausgeliefert wird. Am 03.09.2026 musste derselbe Änderungssatz deshalb fünfmal geprüft
werden und war am Ende trotzdem nicht draußen.

Die Regel hat zwei Hälften, und beide sind nötig:

**1. Der Zustand des Pull Requests ist die Ampel.**

| Zustand | Bedeutung |
|---|---|
| Entwurf (Draft) | Ich arbeite noch. Andere dürfen jederzeit mergen. |
| Bereit zur Prüfung (Ready for review) | Ich liefere gerade aus. Bis zum Merge mergt sonst niemand nach `main`. |

Ein PR wird also erst aus dem Entwurf geholt, **wenn der Volllauf grün ist und der Merge unmittelbar
bevorsteht** — nicht schon beim Öffnen. Die Ampel steht damit nur für die wenigen Minuten auf Rot,
die der Merge wirklich braucht, statt für die anderthalb Stunden des Prüflaufs.

**2. Ein fremder Merge ist erst dann ein Problem, wenn er die Spieldatei anfasst.** Das ist messbar
und wird gemessen, nicht vermutet:

```bash
git fetch origin main
git diff --name-only HEAD...origin/main
```

Steht `weltraum_kolonie.html` nicht in der Liste, bleibt der eigene Lauf gültig: Der Merge hat nur
Tests, Doku oder Backend-Dateien berührt. Dann reicht ein Merge von `origin/main` plus die Tests,
die die geänderten Dateien betreffen (`## Betroffenheits-Sweep`). Nur wenn die Spieldatei dabei ist,
muss der Volllauf wiederholt werden — und dann fortsetzbar, siehe unten.

**3. Der Prüflauf läuft parallel und ist fortsetzbar.** `pruflauf.js` im Wurzelverzeichnis verteilt
die Testdateien reihum auf mehrere gleichzeitige Stücke und hinterlässt je Stück eine Marke mit dem
Exit-Code:

```bash
node pruflauf.js                    # alle Tests, 4 Stücke gleichzeitig
node pruflauf.js --gleichzeitig 6   # mehr Stücke nebeneinander
node pruflauf.js --fortsetzen       # fertige Stücke überspringen (nach einem Abbruch)
```

Warum das überhaupt geht: Gemessen an einem vollständigen Lauf brauchen 107 der 332 Tests 0 s (reine
Quelltext-Tests), und die Zeit der übrigen steckt fast vollständig in Browser-Tests, die **warten**
(`waitForTimeout`) statt zu rechnen. Solche Tests laufen nebeneinander fast gratis. Es wird nichts
übersprungen und nichts abgeschwächt — jedes Stück ruft dasselbe `tests/run.js` mit einem Teil der
Dateiliste auf, und der Gesamt-Exit-Code ist nur dann 0, wenn jedes Stück 0 geliefert hat.

Die Verteilung ist **reihum, nicht blockweise**: Alphabetische Blöcke sammeln die langsamen Tests
(`test_wiedergabe_*`, `test_admin_*`) in wenigen Stücken, und dann wartet alles auf das langsamste.

Die Marken machen den Lauf gegen Abbrüche robust — ein Container-Neustart oder ein fremder Merge
kostet dann ein Stück statt des ganzen Laufs.
