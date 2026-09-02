# Kepler 7 – Verdichtetes Projektgedächtnis

Diese Datei ersetzt das frühere Wachstum der `CLAUDE.md` als Sitzungsarchiv. Sie sammelt nur übertragbare Lehren, die zukünftige Änderungen konkret sicherer machen.

Die vollständigen historischen Vorfälle bleiben über die Git-Historie der alten `CLAUDE.md` erhalten.

## 1. Zweite Wahrheiten sind die häufigste Fehlerquelle

Eine Mechanik kann korrekt geändert sein und trotzdem an anderer Stelle falsch dargestellt werden.

Nach fachlichen Änderungen deshalb immer nach Parallelstellen suchen:

- Vorschau
- Banner/Kurzurteil
- Bericht/Ergebnis
- Hilfe
- Tutorial
- Beschreibungen
- Grenzwert-Literale

Wenn möglich, Werte und Darstellung auf gemeinsame Datenquellen/Hilfsfunktionen zurückführen.

## 2. Wiederkehrende Regeln automatisieren

Wenn derselbe Fehler mehrfach auftritt, reicht eine weitere Textregel nicht. Einen Test, Linter oder Check bauen.

Beispiele dieser Fehlerklasse:

- Frontend-/Backend-Parität
- Icon-Whitelist
- Dateisynchronität
- Patchnotes-Seite
- Versionskollisionen
- veraltete Remote-Referenzen

Eine automatisierte Prüfung muss allerdings selbst beweisen, dass sie die richtige Realität misst.

## 3. Messwerkzeuge können falsche Sicherheit erzeugen

Typische Fallen:

- `grep` sieht keinen `FAIL`, obwohl der Prozess abgestürzt ist.
- gecachte `origin/*`-Referenz ist alt und meldet scheinbar „aktuell“.
- ein Slice-Anker fehlt und der Test durchsucht einen falschen Bereich.
- ein Test findet denselben Text in Kommentar/Patchnote statt im Live-Code.
- ein globaler DOM-Selektor trifft die falsche Kopie eines Controls.

Darum immer prüfen, ob das Messwerkzeug selbst die Voraussetzungen seiner Aussage belegt.

## 4. Tests brauchen Gegenproben

Ein Test ist erst überzeugend, wenn gezeigt wurde, dass er den zu verhindernden Fehler tatsächlich erkennt.

Gegenprobe bevorzugt am echten alten Stand oder an einer gezielt sabotierten Kopie. Bleibt sie grün, ist das ein Diagnosebefund und kein Grund, nur den Erwartungswert umzuschreiben.

Davon zu trennen ist die **Standardisierung**: ein Umbau, der eine lokale Kopie durch eine
gemeinsame Quelle ersetzt, ohne das geprüfte Verhalten zu ändern. Dort ist eine grüne Gegenprobe
das erwartete Ergebnis und kein Befund – belegt werden muss stattdessen, dass die Sabotage
überhaupt gegriffen hat (sonst ist „beide grün" ein Werkzeugfehler). Ein solcher Umbau darf im
Commit nicht als Behebung ausgegeben werden.

## 5. Testcode ist genauso kritisch wie Produktcode

Breite Textersetzungen und Merge-Konflikte können Tests still schwächen.

Nach Eingriffen in Testdateien:

- Exit-Code einzeln prüfen,
- verlorene Prüfungen/Testnamen vergleichen,
- Suchmuster und ausgeführten Testcode auseinanderhalten,
- keine komplette Konfliktseite pauschal übernehmen.

Eine leichtere Suite kann grün werden, obwohl Schutz verloren ging.

Ein Test-Parser, der Konstanten der Spieldatei als getippte Liste mitgibt (etwa die `HERKUNFT_*`-Werte vor einem `new Function`), stirbt beim nächsten Eintrag – oder liefert still `null`. Solche Preludes aus der Datei selbst ableiten (Regex über die Deklarationen); bei der fünften Herkunft (Konvoi) waren es acht Tests auf einmal.

## 6. UI-Zustände besitzen Aufbau und Abbau

Beim Entfernen/Ersetzen eines UI-Modus nicht nur dessen sichtbaren Inhalt portieren. Alte Zweige können Cleanup enthalten:

- Handler entfernen
- Anzeigezustände zurücksetzen
- Hilfsleisten verstecken
- temporäre Klassen/Elemente abbauen

Bei jedem Moduszweig separat nach Inhalt und Aufräumverantwortung suchen.

## 7. Transiente Meldungen als Verlauf messen

Toasts und Logs können verdrängt oder überschrieben werden. Ein später DOM-Snapshot beweist nicht, dass eine wichtige Meldung für den Spieler sichtbar war.

Bei Tests auf kurzlebige Meldungen den Verlauf mitschneiden und im Fehlerfall den tatsächlich beobachteten Inhalt ausgeben.

## 8. Konzepte vor Umsetzung gegenrechnen

Konzeptdateien können veraltete Zahlen, Stufen oder Annahmen enthalten.

Vor Umsetzung:

- aktuelle Keys/Stufen greppen,
- Ressourcenflüsse überschlagen,
- Skalierung über Standorte/Stufen prüfen,
- vorhandene Quellen/Senken berücksichtigen,
- Zahlen nicht allein aufgrund einer Konzeptnotiz übernehmen.

## 9. Icons: Definition ist nicht Darstellung

Ein Icon in `ICONS` oder `RES_ICONS` beweist nicht, dass die UI es verwendet. Nach neuen Icons die sichtbare Renderstelle überprüfen; bei Unsicherheit rendern/Screenshot ansehen.

Neue Inhalte brauchen Icon und vollständige Beschreibung von Anfang an.

## 10. Refactorings müssen Schutz zentralisieren

Beim Zusammenführen ähnlicher Funktionen darf der Test nicht nur an die neue Struktur angepasst und schwächer werden.

Stärkeres Ziel:

- Schutzlogik existiert genau einmal,
- alle Einstiegspunkte delegieren dorthin,
- Verhalten wird ausgeführt,
- zukünftige neue Einstiegspunkte ohne Schutz fallen im Test auf.

## 11. Betroffenheit fachlich suchen

Eine Suche nur nach geändertem Funktionsnamen ist zu eng. Tests und UI können ein Feature über andere Merkmale erreichen.

Zusätzlich suchen nach:

- DOM-Attributen
- Bedien-/Anzeigetexten
- alten Zahlen/Grenzen
- Daten-Keys
- Tests, die das alte Verhalten explizit festhalten

## 12. Historie von Live-Zustand trennen

`PATCHNOTES` zitieren absichtlich alte Zustände und Formulierungen. Negative Texttests dürfen historische Bereiche nicht mit aktuellem Verhalten verwechseln.

Patchnotes bleiben unverändert; Live-Hilfe und Tutorial werden dagegen bei Mechanikänderungen aktualisiert.

## 13. Versionierung spät und in kleinem Fenster

Bei paralleler Entwicklung verursacht frühe Vergabe einer Versionsnummer unnötige Kollisionen. Deshalb erst Änderung und Volltest abschließen, dann aktuelle freie Version bestimmen und den Nummern-/Patchnote-Schritt schnell bis zum Commit/Merge durchziehen.

Nach Rebase/Merge gezielt prüfen, dass eigene und fremde Änderungen vollständig erhalten blieben.

## 14. Große Dateien nicht als LLM-Kontext missbrauchen

Die riesige Spieldatei wird nicht komplett geladen, nur weil ein Modell ein großes Kontextfenster anbietet.

RAG/grep -> relevante Stellen -> gezielter Kontext -> Tests.

Das reduziert Kosten, Latenz und Fehlfokus und macht lokale Modelle deutlich praktikabler.

## 15. KI-Qualität ist ein System, nicht nur ein Modellname

Für Kepler ergibt sich Qualität aus:

- gutem Retrieval,
- klarer Aufgabenabgrenzung,
- brauchbarem Coding-Modell,
- Werkzeugzugriff,
- echten Tests,
- Gegenproben,
- Eskalation bei Fehlschlägen.

Ein stärkeres Cloud-Modell ohne diese Leitplanken kann schlechtere Änderungen liefern als ein kleineres lokales Modell mit sauberem Projektkontext und einem strengen Qualitätstor.

## 16. Ein schwacher Hash über fortlaufende Schlüssel ist kein Zufall

`hashStringToFloat` rechnet `h*31+Zeichen mod 10000`. Zwei Schlüssel, die sich nur in einer
laufenden Nummer unterscheiden, liegen damit 31/10000 auseinander. Wer daraus Positionen ableitet,
bekommt Muster statt Streuung – bei den Sternen der Systemansicht waren es „Perlenschnüre", die im
Bild wie gestrichelte Striche aussahen, und aufgefallen ist es nur im gerenderten Bild, nicht im
Quelltext.

Für deterministische Streuung den Hash nur als Startwert nehmen und die Folge aus einem echten
Generator ziehen (`sysZufall`, mulberry32). Und eine Zeichnung vor dem Merge einmal wirklich
ansehen – ein Test, der Anker zählt, sieht so ein Muster nicht.

## 17. Ein Statuscode ist keine Diagnose, und ein verdeckter Toast keine Meldung

Der Festungsschlag antwortete bei 403 mit „Abklingzeit", obwohl der Server drei verschiedene
403-Gründe wörtlich mitschickt. Wer aus dem Code den Text rät, verwandelt eine Antwort in eine
Vermutung; der Servertext gehört in Toast und Bericht, der geratene Text ist nur der Rückfall.

Und eine Meldung, die abläuft, solange ein Overlay davorsteht, hat für den Spieler nie
stattgefunden – „keinerlei Info" war die zutreffende Beschreibung, obwohl `log()` aufgerufen
wurde. Transiente Meldungen messen sich als Ereignisverlauf (wann sichtbar, für wen), nicht als
Aufruf im Protokoll. `pushToast` wartet deshalb auf freie Sicht (`TOAST_OVERLAYS`).

## 18. Ein `disabled`-Knopf ist auf dem Telefon eine stumme Sperre

Der Vorposten-Bau-Knopf war `disabled`, sein Grund stand nur im `title`. Ein gesperrter Knopf feuert
kein Klick-Ereignis, und am Telefon gibt es kein Hover – Tippen führte zu nichts. Für den Spieler
sieht das wie ein kaputtes Spiel aus („ging aber anscheinend nicht"), obwohl die Prüfung korrekt war.

Regel: Eine Bedingung, die etwas verhindert, muss **antippbar** erklärt werden. Knopf klickbar
lassen (gedämpft, `aria-disabled`), Grund als `warn`-Toast. Und jede Sperre daraufhin prüfen, ob sie
eine Sackgasse ist: Kosten oberhalb des Lagerdeckels lassen sich nie ansparen – dann gehört der
Ausweg in den Text, nicht nur der Mangel.

## 19. Eine Bounding-Box misst auch das Label

Der Test „der Marker wächst mit der Stufe" verglich `getBBox()` zweier Marker — und war am alten
Stand mit **festem** Radius grün. Grund: In der Box steckt das `<text>` mit dem Namen, und
„Sternenfestung" ist breiter als „Stützpunkt". Gemessen wurde die Textlänge, behauptet die Größe.

Regel: Eine Größenmessung an einer Zeichnung braucht ein Element, das **nur** an der gesuchten Größe
hängt (hier der Radius des Hof-Kreises). Und: Gefunden hat den Fehler die Gegenprobe, nicht der
grüne Lauf — eine Prüfung, die am alten Stand grün bleibt, obwohl sie fallen müsste, ist der
eigentliche Ertrag der Gegenprobe.

## Pflege dieser Datei

Nur eine neue Regel aufnehmen, wenn sie:

1. auf mehr als einen Einzelfall übertragbar ist,
2. zukünftiges Verhalten konkret verändert,
3. nicht bereits durch einen automatisierten Check vollständig abgedeckt ist oder dessen Bedeutung erklärt werden muss,
4. kurz formulierbar ist.

Lange Vorfallchronologien gehören in PR-/Commit-Historie oder eine fachlich passende Dokumentation, nicht hierher.
