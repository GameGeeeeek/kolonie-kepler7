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

## 20. Wer erst aufräumt und dann fragt, fragt nach etwas, das er gerade weggeräumt hat

Sechs Missionsarten – Anfechtung, Festungsschlag, Nest-Schlag, Wrackkonvoi, Vorposten-Bau und
Vorposten-Angriff – haben ihren Kampf **nie** ausgefochten, jede seit ihrer eigenen Auslieferung.
`checkMissions` entfernte die fertige Mission synchron aus `fleet.missions`, der Auflöser
speicherte diesen Stand mit `await save()` und fragte erst danach den Server – und der sucht die
Mission über ihre Kennung im gespeicherten Spielstand. Antwort: immer 403, Flotte kehrt unversehrt
heim, kein Kampf. Der PvP-Angriff war als einziger heil, und zwar aus Versehen: Er hat kein
`await save()` vor dem Aufruf.

Die übertragbare Regel: **Wenn der Server einen Zustand aus dem gespeicherten Spielstand liest,
darf der Client diesen Zustand nicht vorher entfernen – „erst speichern, dann fragen" genügt
nicht, wenn zwischen Entfernen und Speichern nichts mehr liegt.** Der Kommentar an der Stelle sagte
sogar wörtlich „Erst speichern (er liest die Mission aus dem GESPEICHERTEN Stand), dann fragen" –
die Absicht war richtig, nur war die Mission zu diesem Zeitpunkt schon weg. Ein Kommentar, der die
Absicht beschreibt, belegt nicht, dass sie zutrifft.

Zweitens: **Fünf gleichartige Zweige nebeneinander laufen auseinander, sobald einer angefasst
wird.** Die sechs Auflöser waren wortgleich gebaut und teilten damit auch den Fehler sechsfach.
Sie laufen jetzt über einen gemeinsamen Starter, der die Mission erst nach der Antwort entfernt –
im `finally`, damit eine geworfene Ausnahme keine Mission für immer stehen lässt.

## Pflege dieser Datei

Nur eine neue Regel aufnehmen, wenn sie:

1. auf mehr als einen Einzelfall übertragbar ist,
2. zukünftiges Verhalten konkret verändert,
3. nicht bereits durch einen automatisierten Check vollständig abgedeckt ist oder dessen Bedeutung erklärt werden muss,
4. kurz formulierbar ist.

Lange Vorfallchronologien gehören in PR-/Commit-Historie oder eine fachlich passende Dokumentation, nicht hierher.

## Ein neuer Name gehört gegen den Bestand geprüft — Dateien UND Begriffe (03.09.2026)

Beim Bau der Besucherquellen-Messung wurde ein Test `tests/test_herkunft.js` angelegt. **Diese
Datei gab es bereits** — als 311-Zeilen-Wächter des Item-Herkunfts-Schlosses (v8.332.0), also
genau der Regel, die exklusive Beute aus den normalen Fundtöpfen heraushält. Der neue Test hat sie
überschrieben.

**Der Hinweis lag vor und wurde übersehen:** `git status` zeigte die Datei als `M` (modified), nicht
als `??` (neu). Bei einer Datei, die man gerade erst angelegt zu haben glaubt, ist `M` ein Alarm.

**Gefunden hat es erst der volle Prüflauf** — an einem fallenden `test_abgrundbilanz.js`, das den
überschriebenen Test seinerseits mitprüft (ein Test, der einen anderen Test bewacht). Ohne diese
zweite Ebene wäre der Verlust erst aufgefallen, wenn die Beute-Regel wieder gebrochen wäre.

**Der Begriff war ebenso vergeben, nicht nur der Dateiname:** `HERKUNFT_ABGRUND`, `HERKUNFT_BOSS`,
`HERKUNFT_UNIKAT`, `HERKUNFT_NORMAL`, `HERKUNFT_KONVOI` — 129 Fundstellen im Frontend, dazu
`HERKUNFT_BOSS` im Backend. Ein `HERKUNFT_SPEICHER` für etwas völlig anderes reiht sich dort ein
und wird beim nächsten Lesen verwechselt.

**Vorgehen bei jedem neuen Namen** — Datei, Konstante, Funktion, Feld, API-Pfad:

```bash
ls tests/<name>.js                       # existiert die Datei schon?
grep -c "<BEGRIFF>" weltraum_kolonie.html ../kolonie-kepler7-backend/server.js
```

Ist die Zahl größer als 0, gehört der Begriff jemand anderem. Das ist dieselbe Familie wie die
Regel „ein Schlüssel kann in mehreren Tabellen vorkommen", nur eine Ebene höher: nicht zwei
Tabellen mit demselben Schlüssel, sondern zwei **Bedeutungen** desselben Wortes.

**Und beim Aufräumen die fremde Seite schützen:** Der Ersetzer lief mit gemessener Trefferzahl je
Muster (`count != erwartet` → Abbruch, nichts geschrieben). Er hat einmal angeschlagen und dabei
verhindert, dass `HERKUNFT_BOSS` mit umbenannt wird — die Wache war hier nicht Formsache, sondern
der Grund, warum die Item-Begriffe unangetastet blieben (nachgezählt: 31× `HERKUNFT_ABGRUND` vorher
wie nachher).

## Ein Lauscher mit `capture:true` am `window` sieht auch die eigenen Ereignisse (03.09.2026)

Das Kartenmenü ließ sich nicht scrollen. Es hatte seit E1b-2 einen Höhendeckel
(`max-height`/`overflow-y:auto`), die Bildlaufleiste stand sichtbar daneben — und der erste
Radschlag darin schloss es. Gemessen am Handyformat 390×844: `scrollHeight` 590 gegen
`clientHeight` 420, also **170 px unerreichbarer Inhalt**, darunter „Vorposten aufgeben".

Die Ursache war eine Zeile, die zwei Dinge auf einmal tat:

```js
window.addEventListener('scroll', closeKarteMenu, true);
```

Gemeint war das Scrollen **der Seite** — das Menü ist `position:fixed` und stünde danach neben
seinem Marker. Getroffen hat es jedes Scrollen der ganzen Seite, auch das **im Menü selbst**.
Scroll-Ereignisse steigen nicht auf, aber die **Einfangphase** läuft durch `window`, und genau
dort hängt `capture:true`.

**Die übertragbare Regel:** Ein Lauscher mit `capture:true` am `window` oder `document` hört
jedes gleichnamige Ereignis der Seite — auch die aus dem eigenen Aufbau. Wer einen schreibt,
muss sagen, **wessen** Ereignis er meint (`e.target` prüfen), sonst wächst der Fehler erst
später ein: Solange die Menüs zwei bis fünf Einträge hatten, war die Zeile folgenlos. Erst der
Höhendeckel und ein gewachsenes Menü machten aus ihr eine Sperre. **Eine Zeile, die heute
richtig aussieht, weil der Fall noch nicht eintritt, ist nicht richtig — sie ist unbenutzt.**

**Der zweite Halbfehler wäre das Weiterscrollen der Seite am Listenende gewesen** (Scroll-Chaining):
Das schließt das Menü dann völlig zu Recht, und der Spieler sähe dasselbe „geht nicht" eine Zeile
später wieder. Deshalb gehört `overscroll-behavior:contain` zu dieser Reparatur dazu, nicht in
einen Folgeauftrag.

**Was die Gegenprobe hier tragen musste:** „schließt nicht mehr beim Scrollen" wäre auch grün,
wenn die Reparatur das Schließen ganz abgeschaltet hätte. Die beiden Gegenstücke — Seitenscroll
und ein fremder Scrollkasten schließen weiterhin — laufen deshalb im **selben** Durchgang mit,
nicht als Nachgedanke (`tests/test_kartenmenue_scrollen.js` 5 und 6).

---

## Wer misst, welche Quellen eine Währung speisen, zählt die Auszahlungen — nicht die Tabellen

Sternenessenz ist die einzige Währung, die **jeden** Reset überlebt. Beim Schließen der letzten
Lücke (Vollreset, 03.09.2026) musste die Frage beantwortet werden: *Welche Marken halten fest,
dass sie schon ausgezahlt wurde?* Ich habe sie zweimal falsch beantwortet:

| Anlauf | Methode | Ergebnis |
|---|---|---|
| 1 | „aus dem Kopf" | vier Marken, davon zwei falsch |
| 2 | `grep essence:` in den *offensichtlichen* Tabellen | **zwei** Marken, 184 Essenz |
| 3 | jede Stelle zählen, die `state.ascension.essence` erhöht | **fünf** Marken, **320** Essenz |

Anlauf 2 übersah den Kodex (`CODEX_TIERS[].reward.essence` — die Zahl steht eine Ebene tiefer als
gesucht) und die Abgrund-Tiefenmarken (`ABGRUND_TIEFEN_MEILENSTEINE`, eine Tabelle, an die beim
Stichwort „Belohnung" niemand denkt). Beide Fehler haben dieselbe Form: **Die Suche ging von den
Orten aus, an denen die Antwort vermutet wurde, statt von der Wirkung, um die es geht.**

**Die übertragbare Regel:** Wer wissen will, was eine Größe verändert, sucht nach der
**Zuweisung** an diese Größe, nicht nach den Tabellen, die sie vermutlich füttern. Eine Tabelle
kann man übersehen; eine Zuweisung nicht, denn ohne sie passiert nichts.

Und für den Wächter folgt daraus dieselbe Richtung: `tests/test_essenzmarken.js` zählt die
**Auszahlungsstellen** und verlangt, dass jede einzeln eingeordnet ist — als bewachte Marke oder
mit Begründung als markenlos (der Wrackkonvoi, dessen Essenz vom Server kommt). Eine sechste
Quelle lässt den Test fallen, bis jemand sie einordnet. Eine Prüfung, die stattdessen die fünf
bekannten Marken abgehakt hätte, wäre bei genau dem Fehler grün geblieben, der hier zweimal
passiert ist.

**Nachtrag, und er ist die eigentliche Pointe:** Der Wächter, der genau diesen Fehler verhindern
sollte, hatte ihn selbst. Er zählte die Auszahlungen — aber über den *Wortlaut* einer Zuweisung
(`state.ascension.essence = (state.ascension.essence || 0) + …`). Die Codex-Prüfung am PR meldete
das als Möglichkeit („ein `+=` rutscht durch"); nachgemessen war es bereits Wirklichkeit: Eine
**siebte** Auszahlung existierte längst und rutschte durch, weil der Aufstieg über einen Alias
schreibt (`asc.essence = (asc.essence||0) + gain`). Der Test zählt seither **jede Zuweisung an ein
Feld namens `essence`** und nennt seine Restlücke ausdrücklich (Zugriff über `['essence']` oder
eine Hilfsfunktion). Eine zweite Prüfung daneben belegt im selben Durchgang, dass der enge Ausdruck
weniger findet als der weite — sonst könnte jemand ihn wieder verengen und die Zahl mitziehen.

**Die Regel dahinter, zum dritten Mal an einem Tag:** Eine Prüfung, die eine *Schreibweise* festhält
statt der *Sache*, ist keine Prüfung — sie ist eine Wette darauf, dass niemand die Schreibweise
ändert. Am selben Tag traf das `test_endlos` Prüfung 6 (Regex auf die einzeilige Fassung von
`npcEffectiveDefense`, gefallen an einer richtigen Änderung) und diesen Zähler hier (blind für
eine bestehende Quelle). Die eine war zu streng, die andere zu nachsichtig; beide hingen am Text
statt an der Wirkung.

**Nebenlehre aus derselben Datei:** Ein Schnitt, der sein Ziel verfehlt, sieht aus wie ein
gefallener Test. Der erste Entwurf schnitt die drei Reset-Ausgänge bis zum ersten
`applyStateDefaults` — alle drei erwähnen den Namen aber vorher in einem Kommentar, und alle fünf
Prüfungen fielen bei richtigem Code. Seither steht eine eigene Ankerprüfung daneben
(„jeder Schnitt enthält wirklich das Zustands-Literal"); sie unterscheidet *rot* von *unbrauchbar*,
und die beiden sehen sonst gleich aus. Dasselbe galt für den Anker selbst: Das Prestige-Literal
lebt nicht in `doPrestige()`, sondern in `confirmPrestigeWithPerk()` — `doPrestige` öffnet nur die
Perk-Auswahl.

## Eine Regel, die ein Mensch hinterher messen muss, ist keine Absicherung (04.09.2026)

`CLAUDE.md` sagte seit jeher richtig: „Ein fremder Merge entwertet den eigenen Lauf nur, wenn er die
Spieldatei anfasst — das wird **gemessen**, nicht vermutet." Gemessen hat es trotzdem ein Mensch,
hinterher, wenn er daran dachte. An einem Tag mit acht solchen Merges reicht das nicht.

**Die Zahl, die es entschieden hat:** 25 der letzten 25 Merges nach `main` fassen die Spieldatei an
— ausnahmslos. Abstand 31–67 Minuten, Laufzeit eines Prüflaufs 35. Rechnerisch wird **mehr als jeder
zweite Lauf entwertet, bevor er fertig ist**. Ein Änderungssatz brauchte vier Anläufe, drei davon
mit grünem, aber wertlosem Ergebnis. Solange die Prüfung im Kopf steckte, kostete jeder vergessene
Blick 35 Minuten — und der Blick wird gerade dann vergessen, wenn der Lauf endlich grün ist und man
liefern will.

**Die übertragbare Form:** Wenn eine Regel bei jedem Durchgang derselben Aufgabe angewendet werden
muss, gehört sie ins Werkzeug, nicht in die Dokumentation. Die Dokumentation beschreibt dann, was
das Werkzeug tut — sie ersetzt es nicht. (Dieselbe Lehre steht im Nachbar-Repo `gamegeeeeek-ai-core`
als Lektion 8a, dort über einen Schalter, den man „nur beim ersten Lauf setzen" sollte.)

**Die Unterscheidung, ohne die so eine Sicherung wieder abgeschaltet wird:** Der *Vorgang* fällt
offen aus, die *Aussage* geschlossen. Kein Netz, kein `origin`, kaputtes `git` → es wird trotzdem
geprüft; eine Sicherung, die bei einem Netzhänger 35 Minuten Arbeit verweigert, ist nach dem zweiten
Mal dauerhaft deaktiviert und sichert dann gar nichts. Aber der Satz „kein fremder Merge während des
Laufs" fällt **nur** nach einer gelungenen Messung; ohne sie steht dort, dass nicht gemessen werden
konnte. Wer beides zusammenwirft, baut genau die Sicherung, deren Ausfall wie Normalbetrieb
aussieht.

**Und ein eigener Exit-Code für ein eigenes Urteil.** „Die Tests sind grün, das Ergebnis ist
trotzdem unbrauchbar" ist nicht dasselbe wie „ein Test ist rot" — deshalb Code 2 neben Code 1, und
der Testfehler gewinnt, wenn beides zutrifft. Ein Urteil, das ein anderes überschreibt, lässt den
schwereren Fund im Rauschen untergehen.
