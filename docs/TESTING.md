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

Ein PR wird also erst aus dem Entwurf geholt, **wenn der ABSCHLIESSENDE Prüflauf startet** — nicht
schon beim Öffnen, aber auch nicht erst danach.

Die erste Fassung dieser Regel sagte „wenn der Volllauf grün ist und der Merge unmittelbar
bevorsteht". Das ist am 03.09.2026 sofort schiefgegangen: Während des Laufs landeten v8.650.0 und
v8.651.0 auf `main`, beide an der Spieldatei — der Lauf war entwertet, bevor die Ampel überhaupt auf
Rot ging. Wer erst nach dem grünen Lauf sperrt, sperrt genau das Fenster nicht, in dem das Rennen
stattfindet.

Das kostet: Die Ampel steht jetzt für die Dauer des Laufs auf Rot statt nur für den Merge. Mit
`pruflauf.js` sind das gemessen 37 Minuten, nicht 91 — deshalb ist der Preis tragbar, und deshalb
gehören die beiden Teile dieser Regel zusammen.

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
Dateiliste auf.

### Ein rotes Stück ist ein Verdacht, kein Urteil (03.09.2026, gemessen)

Der erste echte Lauf brauchte 37 Minuten statt 91 — und meldete **zwei rote Tests, die einzeln grün
sind**: `test_forschung_lagerwand` („die Forschung ist gestartet, statt blockiert zu werden" —
`activeResearch` war schlicht noch `null`) und `test_fraktionsgebiet_karte` (CORS beim Laden von
`version.txt`). Beides Lastsymptome von vier gleichzeitigen Browsern, keine Fehler im Spiel.

Die erste Fassung dieses Abschnitts behauptete „gleiche Tests, gleicher Exit-Code". Das war falsch,
und zwar in der gefährlichen Richtung: Wer einem falschen Rot glaubt, sucht einen Fehler, den es
nicht gibt — oder schlimmer, hält ein echtes Rot beim nächsten Mal für dasselbe Rauschen.

Statt das als Merksatz zu hinterlegen, **fährt das Skript rote Tests selbst noch einmal nach** —
einzeln, nacheinander, ohne Last — und wertet nur diese Nachprüfung. Was dann noch rot ist, ist echt.
(CLAUDE.md: wiederholbare Regeln automatisieren, nicht aufschreiben.)

Zwei Dinge, die dabei zu beachten sind:

- **Nicht durch eine Pipe aufrufen.** `node pruflauf.js | tail -25` liefert den Exit-Code von `tail`,
  nicht den des Laufs — genau der Fehler, vor dem „der Exit-Code entscheidet" warnt. Beim ersten
  Einsatz prompt passiert.
- Die Stücke sind **nach Dateizahl** gleich groß, nicht nach Laufzeit: gemessen 1600 s, 1602 s,
  1829 s und 2198 s. Der Gewinn ist deshalb Faktor 2,5 und nicht 4.

Die Verteilung ist **reihum, nicht blockweise**: Alphabetische Blöcke sammeln die langsamen Tests
(`test_wiedergabe_*`, `test_admin_*`) in wenigen Stücken, und dann wartet alles auf das langsamste.

Die Marken machen den Lauf gegen Abbrüche robust — ein Container-Neustart oder ein fremder Merge
kostet dann ein Stück statt des ganzen Laufs.

## Adversarische Durchsicht vor jeder Auslieferung (04.09.2026)

Der grüne Prüflauf beweist, dass nichts Bekanntes gebrochen ist. Er beweist **nicht**, dass die
Änderung richtig ist — er kennt nur die Regeln, die schon jemand aufgeschrieben hat. Deshalb geht
vor dem Merge eine **adversarische Durchsicht des eigenen Änderungssatzes** darüber, mit der
Leitfrage „was habe ich übersehen", nicht „stimmt das".

Anlass war eine gemessene Lücke: Bei v8.663.0 fand die automatische Durchsicht am PR einen echten
Fehler (eine Voraussetzungs-Schreibweise, die die neue Meldung still verschluckte). Bei v8.665.0
fiel sie aus — das Kontingent war erschöpft —, und die nachgeholte Durchsicht förderte **elf**
Befunde zutage, darunter ein Wirtschaftsloch, das schon vorher live war: Der Baukorb reihte
Schiffe mit Gegenstandskosten ein, ohne den Gegenstand abzuziehen, während der Abbruch ihn
bedingungslos erstattete. Vorrat 3 → einreihen → abbrechen → Vorrat 5, beliebig wiederholbar.

Was die Durchsicht findet, das Tests strukturell nicht finden:

- **Die Ausnahme, die der Wächter nicht sieht.** `test_werft_sperrgrund` zählte
  `[data-buyship]`; das Superschlachtschiff hat einen eigenen Block mit eigener id und blieb als
  einziger Knopf gesperrt. Wer seine Prüfmenge über ein Attribut bildet, das nicht alle Mitglieder
  tragen, misst genau die Ausnahme nicht.
- **Die leere Prüfung.** „Bezahlbare Schiffe heißen weiterhin Bauen" zählte nur, ob irgendein
  Knopf „Bauen" sagt — und das taten auch die gesperrten. Grün, ohne etwas zu belegen.
- **Die gespaltene Gegenprobe.** Ein Test lud die Seite über `KEPLER_TESTDATEI`, las die Merkmale
  aber über `SPIELDATEI` — zwei verschiedene Fassungen, ohne dass etwas rot wurde.
- **Die eingetippte Kopie-Familie.** Eine Leiter, die das Backend besitzt (`zweigAb`, `maxStufe`),
  stand als `4` und `8` im Code, obwohl die Nachbarfunktion sie längst aus dem Cache liest.

Praktisch: `/code-review <commit-oder-diff> high` vor dem Merge. Die Befunde werden **geprüft, nicht
geglaubt** — von den elf war einer entschärft (das gemeldete Schiff steht gar nicht im Baukorb; das
echte Loch lag beim Nachbarn daneben). Jeder bestätigte Befund bekommt einen Wächter mit Gegenprobe,
sonst kommt er wieder.

## Während `pruflauf.js` läuft, kein zweiter Browser-Test daneben (04.09.2026)

`pruflauf.js` fährt vier Browser gleichzeitig und fängt Lastsymptome damit ab, dass es rote Dateien
danach **einzeln** nachfährt — die Nachprüfung ist ihr Urteil. Genau diese Nachprüfung war einmal
wertlos, weil ich in derselben Zeit vier eigene Browser-Läufe gestartet hatte (eine Messung plus drei
Gegenproben). `test_kartenrichtungen` fiel dabei „einzeln rot" mit `3e` (↓ scrollt die Seite nicht),
war danach aber **dreimal hintereinander grün** auf demselben Stand — und auf `origin/main` wie auf
der Merge-Basis ebenfalls grün.

**Die Nachprüfung ist der einzige Teil des Laufs, der ohne Last stattfinden MUSS.** Wer währenddessen
etwas anderes startet, nimmt ihr genau die Eigenschaft, für die es sie gibt. Arbeit, die keinen
Browser braucht (Backend, Dokumentation, Textanker suchen), ist unbedenklich.

### Der Abdruck ist global, die Betroffenheit nicht

Derselbe Lauf warnte: „Spieldatei oder die server.js des Nachbar-Repos haben sich während des Laufs
geändert — *Lastsymptom* ist hier keine gültige Erklärung." Die Warnung stimmte in der Sache und war
für drei der vier Dateien trotzdem gegenstandslos: Gemessen hatte sich **nur** die `server.js` des
Nachbarn bewegt (Änderungszeit 07:23; die Spieldatei stand unverändert seit 07:10 und war identisch
mit `HEAD`), und keiner der drei Tests liest `server.js` überhaupt.

**Bevor man die Warnung als Urteil nimmt, misst man zwei Dinge:** *welche* der beiden Dateien sich
bewegt hat (Änderungszeit, `git diff --quiet HEAD -- <datei>`) und ob der rote Test sie *liest*
(`grep -l "SERVER_JS\|server.js" tests/<test>.js`). Nur wenn beides zusammenfällt, entwertet der
Abdruck-Wechsel das Ergebnis.

## Teillauf nach einem fremden Merge (Absprache Sascha, 04.09.2026)

`main` nimmt die eigene Versionsnummer etwa alle 15 Minuten; ein voller Prüflauf braucht 40–70. In
dieser Lage gilt: Der volle Lauf gilt für den eigenen Stand. Kommt danach ein fremder Merge, wird
gemergt, umnummeriert und **nur noch der berührte Bereich** gefahren — die Pflichtprüfungen plus die
Tests der Bereiche, die der fremde Merge wirklich anfasst.

**Die Auswahl wird gemessen, nicht geraten.** Aus dem Diff die berührten Bezeichner ziehen, dann die
Tests suchen, die sie lesen:

```bash
git diff HEAD...origin/main -- weltraum_kolonie.html \
  | grep "^[+-]" | grep -v "^[+-][+-]" \
  | grep -oE "function [a-zA-Z0-9_]+|const [A-Z_]+ =|id=\"[a-zA-Z0-9_-]+\"|data-[a-z-]+" | sort -u
grep -ln "<bezeichner1>\|<bezeichner2>" tests/*.js
```

Dazu kommen die Tests des **eigenen** Bereichs, wenn der fremde Merge ihn mit anfasst. Was gelaufen
ist und was nicht, gehört ausdrücklich in den PR-Text — ein Teillauf, der sich als voller ausgibt,
ist schlimmer als keiner.
