# Kepler 7 – Ideen und Codex-To-dos

Stand der Umsetzung: 06.10.2026
Projekt: GameGeeeeek/kolonie-kepler7
Backend: GameGeeeeek/kolonie-kepler7-backend

## Abschluss: alle Aufträge nacheinander

Am 06.10.2026 hat der Nutzer ausdrücklich die vollständige Umsetzung aller Ideen nacheinander beauftragt. Alle 16 Aufträge sind in v8.743.0 umgesetzt und geprüft. Die unten gesondert dokumentierte v8.742.0 ist der historische Ausgangsstand.

Reihenfolge: Zuerst K7-001 vollständig abgearbeitet, danach K7-002 bis K7-016 jeweils gegen ihren gesamten Codex-Auftrag und ihre Abnahmekriterien geprüft und fehlenden Umfang ergänzt. Bereits erfüllte Aufträge wurden belegt abgeschlossen; zusätzliche, nicht beauftragte Szenarien oder Beutequellen wurden nicht ergänzt.

Abgeschlossen: K7-001 bis K7-016 wurden nacheinander gegen ihren gesamten Auftrag abgearbeitet. Der vollständige Projektprüflauf ist grün: 458 Testdateien und sieben Pflichtprüfungen, Exit-Code 0, drei parallele Gruppen. Gebäude-Raster, Bildruhe und Spielstand-Ersatz waren unter Last rot und in der automatischen Einzelwiederholung grün. Spiel- und Backend-Stand blieben während des gesamten Laufs unverändert; origin/main blieb bei 945cd2b899946d78173221cbb87d4587851bee4d. Keine Produktionsveröffentlichung.

### Vollständiger beauftragter Umfang (v8.743.0)

K7-001: Alle 14.515 inventarisierten Autoren-Texte sind katalogisiert, einschließlich Definitionen, kompletter Hilfe (17 Kategorien, 287 Einträge), Tutorial, Berichten und Servermeldungen. 90 sprachübergreifend identische Begriffe/Eigennamen sind absichtlich unverändert. 77 Forschungs-/Modulbeschreibungen, Fachwortliste und zahlreiche Textkorrekturen wurden manuell geprüft. Übrige Texte stammen aus lokalen Übersetzungsentwürfen mit Zahlen-/Variablen-/Markupprüfung; keine Behauptung einer manuellen Einzelprüfung aller Texte. `test_english_complete`, `test_english_locale` und 24 I18n-Prüfungen prüfen auch unveränderte persönliche Inhalte. Vorgehen: `tools/i18n/README.md`.

K7-002 bis K7-004: Rückkehrbericht mit realen Nettoänderungen einschließlich Raffinerieausgabe/Verbrauch, allen Lagerarten und genau drei Folgeaktionen. Beutekompass für alle Standort-/Schiffssets und einzelne Module, persistente Wünsche, wirkliche Quellen/Kosten/Zugänge und belegte Chancen. Bau-/Forschungsengpass und wirkliche nächste Stufe auf einer Spielstandkopie einschließlich negativer Produktion, voller Lager und Kontofinanzierung. Nachweise: `test_k7_return_report`, `test_k7_loot_compass`, `test_k7_economy`.

K7-005 und K7-006: Favoriten/Notizen plus gespeicherte Aufgabenfilter für eigene Kolonien, sichtbare Beute, eigene Allianzbasis und aktive Missionen; verborgene Positionen und abgelaufene Ziele gesperrt. Kernabläufe, Tagesaufgaben/Servergaben, Ausrüstung und Kartenbedienung auf 360/390/430/1200 CSS-Pixeln, lange Rückkehr-/Profildialoge, Touchziele, Tastaturabholung und Doppelklickschutz. Bewusste spätere Käufe bleiben möglich. Nachweise: `test_k7_map_tasks`, `test_k7_mobile_flows`, 92 Spielablauf- und 24 bestehende Favoritenprüfungen.

K7-007 bis K7-012: Die gespeicherte Fünf-Etappen-Kampagne mit zwei Enden und einmaliger kleiner Gabe erfüllt den Auftrag. Das einzelne Wrack-Ereignis verwendet überall dieselbe Entscheidung; jede Auflösung erhält einen serverseitigen Bericht, auch Umkehr/leere Untersuchung. Rückkehrbericht nutzt denselben tatsächlichen Offlinezeitraum. Pechschutz bleibt genau ein quellengebundener Zwölf-Siege-Pilot (+1/12 seltenes Teil je finalem Sieg; 144-Siege-Modell). Ausbauvorlagen prüfen Eigentum, Zielstufen, Restkosten, Voraussetzungen und Schlangen; Mondziele/Verteidigungsvorlagen sind begründet gesperrt. Fünf Archivorte und drei Kapitel einer Fraktion zeigen Herkunft/Fundbedingungen und dauerhafte Entdeckung. Drei rechtmäßig freigeschaltete Trophäenplätze erscheinen auch im Kommandantenprofil. Nachweise: 30 Planungsprüfungen, `test_k7_completion_details`, Sprach- und HTTP-Prüfungen.

K7-013 bis K7-016: Ereignisfeedback bleibt abschaltbar, respektiert Bewegung/Ton und wird durch bloßes Rendern nicht erneut ausgelöst. Eine Operation im bestehenden Raid umfasst Aufklärung/Versorgung/Angriff; Leitung kann vor Abflug ohne Erstattung abbrechen. Austritt entfernt Wirkung und Teilnehmeranspruch; Offlinegabe einmalig. Genau eine Schildvariante mit zwei echten Phasen, Konter, Vorschau und Bericht sowie genau eine isolierte, reproduzierbare Drei-Wellen-Übung mit vorgegebener Flotte erfüllen den jeweiligen Auftrag. Nachweise: tatsächliche HTTP-Kampfauflösung, Frontend-/Backend-Parität, 14 Trainingsprüfungen und Klickdurchlauf.

Gegenproben: 52 Frontend-Spiel-/Layoutmutationen, drei I18n-Mutationen und acht Backend-Mutationen schlagen jeweils an der erwarteten Assertion fehl. Backend gezielt: 72 neue HTTP-Prüfungen, Start, geteilter Speicher und Balance grün. Bestehende Quelltextprüfungen lesen Hilfetexte ohne den neuen Sprachkatalog und isolierte Berechnungen mit dem tatsächlichen Sprachhelfer. Gegenproben sichern die Texte, Berechnungen, gemeinsamen Aufrufer und den neuen fokussierten Tastaturzugriff. Kopfzeilenprüfungen messen nur wirkliche Anzeigestellen; Kosmetikprüfungen prüfen die ursprüngliche Formatierung außerhalb der privaten Textgrenze. Rückkehr-/Profilprüfungen trennen den abgeschlossenen Spielstart und den asynchronen Fortschrittsabruf von ihren unveränderten Anforderungen an Anzeige, Ressourcen und Navigation. Drei Quelltext-Gegenproben enden vor Browserstart (`tools/ideas/source-preflight.cjs`); die vollständigen unveränderten Browserprüfungen laufen zusätzlich. Der unten dokumentierte 451-Dateien-Volltest gehört ausschließlich zum vorherigen Ausgangsstand v8.742.0.

Release-Abschluss v8.743.0: Versionsnummer erst nach dem grünen Volltest gegen origin/main geprüft. Patchnotes, Archiv, Feed und version.txt gemeinsam erzeugt. Danach 14 Abschlussprüfungen ohne Fehler (Exit-Code 0). Die Spiellogik wurde nach dem Volltest nicht geändert.

## Status und Abgrenzung

Der Nutzer hat mit „alles umsetzten eins nach dme anderen“ alle 16 Punkte vollständig zur Umsetzung beauftragt. Der Abschlussstand v8.743.0 steht oben; die erste Ausbaustufe v8.742.0 ist unten als Historie gekennzeichnet. Eine Produktionsveröffentlichung braucht weiterhin eine gesonderte Freigabe. Aufwand und Priorität sind qualitative Planungsschätzungen, keine Zeit- oder Kostenzusagen.

Die Projektregeln, vorhandene Konzeptdateien und offene Arbeiten wurden zur Planung gelesen. Es wurde keine vollständige Inventur des gesamten Frontend- und Backend-Codes vorgenommen. „Vorschlag“ bedeutet deshalb nicht, dass garantiert jede Teilfunktion fehlt. Codex muss vorhandene Implementierungen und offene PRs je Aufgabe prüfen und nur die fehlende Erweiterung bauen.

### Bereits berücksichtigen

- Achtung Bestandsabgleich: main enthält inzwischen `locales/en.json`, `tools/i18n/runtime.js`, `k7Ui`, `k7View` und `k7t`. Diese laufende Spracharchitektur erhalten. Den älteren Entwurf PR #643 vor Wiederverwendung mit main vergleichen; keinesfalls die aktuelle Lösung durch den alten Zweig zurückdrehen.
- docs/content-ideen.md dokumentiert bereits Tages-/Wochen-/Saisonmechaniken sowie ein Paket mit Galaxie-Wochenziel, Saison-Auftragsbuch, Allianzkriegen, Vergeltung, Vorposten-Endprojekten, Aufstiegs-Chronik und Patenschaft. Die älteren Abschnitte derselben Datei sind teilweise überholt.
- Loadouts und Wechselvorschauen sind bereits dokumentiert und mit Tests versehen. Keine zweite Loadout-Verwaltung erstellen.
- Freiflug ist laut dokumentierter Entscheidung ausdrücklich ausgeschlossen. Keine manuelle Schiffssteuerung und kein Wechsel in das separate Projekt Void Sector.
- Bestehende Module, Sets, Raids, Abgrund-, Handels-, Allianz- und Fortschrittssysteme erweitern statt parallel neu erfinden.

### Historischer Ausgangsstand v8.742.0

Arbeitszweig: `feat/kepler-ideas-20261005`, Basis Frontend `945cd2b899946d78173221cbb87d4587851bee4d` und Backend `543c9c4a933633fbbd00a6697e995f12fa2c413a`.

Die dokumentierten ersten Ausbaustufen aller 16 Ideen sind im Arbeitszweig implementiert und als v8.742.0 geprüft. Der vollständige Lauf mit 451 Testdateien ist grün (Exit-Code 0); `test_forschung_lagerwand.js` war unter paralleler Last rot und in der automatischen Einzelwiederholung grün. Spiel- und Backend-Stand blieben während des Laufs unverändert, kein fremder Merge hat ihn entwertet. Es gibt kein Produktions-Release. Frontend: [PR #646](https://github.com/GameGeeeeek/kolonie-kepler7/pull/646); Backend-Entwurf: [PR #275](https://github.com/GameGeeeeek/kolonie-kepler7-backend/pull/275), Commit `456696c`.

| ID | Implementierter Umfang | Nachweis / Grenze |
|---|---|---|
| K7-001 | Bestehende Spracharchitektur erweitert; neue Planungs-, Story-, Archiv- und Operationsoberflächen sowie alle Boss-Set-Beschreibungen übersetzt. Definitionen inventarisiert. | `tools/ideas/en.json`, `translation-inventory.json`; vollständige Übersetzung des übrigen Spiels bleibt offen: 53 Forschungs- und 24 weitere Modulbeschreibungen in dieser Teilinventur. |
| K7-002 | Bestehender Rückkehrbericht um tatsächlich neu gebuchte Inventar-/Modulbeute und volle Lager erweitert; drei nächste Aktionen. | `k7OfflineLootDelta`, `k7ReturnExtras`; erst später eintreffende Servergaben werden nicht rückwirkend erfunden. |
| K7-003 | Datengetriebener Beutekompass für vorhandene Boss-Sets, Besitz inklusive Ausrüstung, Wunschstücke, Herkunft, Voraussetzungen und direkte Aktivitätslinks. | `k7SetOwnership`, `renderK7LootCompass`; Fundtopf-Anteil ausdrücklich keine Chance pro Kampf. |
| K7-004 | Auswahl eines Forschungsziels mit echten Restkosten, Nettozufluss, Raffinerieverbrauch, Lagergrenzen, Konto und begründeter Wartezeit. | `k7ResearchBottleneck`; reine Schätzung bei unveränderten Bedingungen, keine automatische Ausgabe. |
| K7-005 | Vorhandene Kolonie-/Systemfavoriten um bis zu 24 sichtbare Festungs-, Nest- und Konvoiziele erweitert. Ablaufende Ziele behalten ihre Notiz und verlieren den Sprung. | `k7LootTargets`, `mapFavoriteTarget`; Sichtbarkeit wird bei Lesen und Sprung erneut geprüft. |
| K7-006 | Größere Touchziele für Kernaktionen; Bauen, Forschung, Expedition bis Rückkehr, Ausrüstung und Karte bei 360/390/430/1200 Pixeln geprüft. | `test_k7_gameplay.js`, 92 Prüfungen; keine pauschale Abnahme jedes alten Dialogs. |
| K7-007 | Eine Kampagne mit fünf Etappen, zwei unterschiedlichen Enden und einmalig 100 Krediten. | Konto-Fortschritt im Backend; Reihenfolge, Datennachweis, bestätigter PvE-Beitrag und Ausgabe geprüft. |
| K7-008 | Ein zusätzliches Wrack-Ereignis mit sicherer Bergung, Untersuchung oder Umkehr, fixiertem Zufall und sicherem Offline-Standard. | Backend-Registrierung einer gespeicherten laufenden Expedition; eine Registrierung je Minute, Frist und Ausgabe serverkontrolliert. |
| K7-009 | Panzerhüllen-Pilot: zwölf bestätigte finale Siege → gewähltes seltenes Teil, jede Welle einmal. | 144-Siege-Modell; +1/12 Teil pro Sieg, keine Änderung vorhandener Zufallsfunde oder höherer Seltenheiten. |
| K7-010 | Bis zu acht benannte Ausbauvorlagen; Vergleich auf eigener Kolonie mit vorhandenen/aktiven Schlangen, Voraussetzungen und echten Restkosten; bewusste Einzelübernahme. | `k7BlueprintPreview`; jede Übernahme nutzt die bestehende Bau-Wunschliste. Persönliche Namen bleiben unübersetzt, unbekannte Einträge erhalten; ohne Definitionsgrenze maximal Stufe 100. |
| K7-011 | Fünf echte besondere Systeme und drei Rufkapitel des Aschen-Kartells; Entdeckung dauerhaft, unbekannte Geschichten verborgen. | `K7_ARCHIVE`, `k7UpdateArchive`; Geschichten geben keine erfundenen Belohnungen. |
| K7-012 | Drei frei belegbare kosmetische Plätze aus tatsächlich freigeschalteten Erfolgen, Vorschau und Austausch. | `k7AvailableTrophies`, `k7SetTrophy`; keine zweite Erfolgswährung oder Boni. |
| K7-013 | Ereignisgebundene, abschaltbare Rückmeldung für echte Bauabschlüsse und Flottenrückkehr; reduzierte Bewegung/Energiesparen respektiert. | `k7ColonyFeedback`; vorhandener abschaltbarer Ton bleibt zuständig, kein neuer Dauereffekt. |
| K7-014 | Aufklärung → Versorgung → echter Raid; Mitgliedschaft, stationierte Schiffe, Kosten, geteilte Phasen, wirksame Faktoren und einmalige Offline-Gabe. | Bestehendes geschütztes Raid-Dokument; ausgeschiedene Mitglieder wirken/verdienen nicht weiter. |
| K7-015 | Optionale Panzerhüllen-Schildvariante mit zwei echten Hüllenphasen, Bomberkonter, tatsächlichen Schadens-/Gegenwehrfaktoren, Vorschau und Bericht. | Gleicher reiner Helfer in beiden Repos; Parität und reale HTTP-Kampfauflösung geprüft. |
| K7-016 | Drei-Wellen-Übung mit fester Flotte und festen Würfen über die vorhandene Drei-Phasen-Kampfrechnung; Verlustfall und Wiederholung. | `test_tactical_trial.js`, 14 Prüfungen, plus Klickdurchlauf; keine echten Bestandsänderungen, Belohnung oder Rangliste. |

Gezielte Prüfungen: 7 Pflichtprüfungen, 30 Planungsprüfungen, 92 Spielablaufprüfungen, 14 Trainingsprüfungen; bestehende Favoriten- und Raidtests grün. Backend: Syntax/Start, bestehender Shared-Storage-HTTP-Test, 61 neue echte HTTP-Prüfungen mit SIGKILL-Neustarts und beiden Save-Formen, Balance. Acht Frontend- und fünf Backend-Gegenproben schlagen an den jeweils erwarteten Fehlern an. Volltest: 451 Testdateien grün, einschließlich automatischer Einzelwiederholung. Die freie Versionsnummer 8.742.0 wurde erst danach gegen origin/main bestimmt; Patchnotes, Archiv, Feed und version.txt wurden gemeinsam erzeugt. Abschlussprüfung `node tests/run.js --nummer`: 14 Prüfungen, 0 fehlgeschlagen (Exit-Code 0).

Belegte vorhandene Bausteine für die nächsten Schritte: `showWelcomeBackModal`, `applyOfflineProgress`, `lastOfflineSummary`, `spielBedarfGecacht` (K7-002); `MODULE_SET_DEFS`, `modulFundort`, `besitztModulTyp`, `bosssetTeile` (K7-003); `researchCostFor`, `ratesPerSecond`, `storageCap` und Baustellen-Konto (K7-004); `costForRange`, `currentBuildings`, `BUILDING_DEFS` (K7-010). Vor weiteren Änderungen die Regeln, tatsächlichen Aufrufer und Backend-Verantwortung erneut prüfen.

### Auslieferung

Alle 16 Aufträge sind abgeschlossen. Die fertigen Änderungen stehen in [Frontend-PR #646](https://github.com/GameGeeeeek/kolonie-kepler7/pull/646) und [Backend-PR #275](https://github.com/GameGeeeeek/kolonie-kepler7-backend/pull/275). Veröffentlichung nur nach gesonderter Freigabe, Backend vor Frontend.

### Arbeitsregeln für Codex

1. Vor jeder Umsetzung aktuelle Branches, Issues, PRs, Projektregeln, Definitionen und passende Tests lesen. Historische Zeilennummern nicht ungeprüft übernehmen.
2. Frontend-/Backend-Abhängigkeiten zuerst bestimmen. Namen, Schlüssel und Schnittstellen aus dem Code lesen, nicht erfinden.
3. Pro beauftragter Aufgabe ein kleiner, nachvollziehbarer Änderungssatz auf einem Feature-Branch. Keine direkten main-Änderungen und kein automatisches Produktions-Deployment.
4. Spielstände, bereits erworbene Inhalte und bestehende Schnittstellen erhalten. Keine neue Item-Speicherstruktur, kein Reset und keine destruktiven Datenbankänderungen als Nebenwirkung.
5. Neue Belohnungen, Ausgaben und Mehrspieleraktionen serverseitig prüfen. Nur vom Server nachvollziehbare Ereignisse als Grundlage neuer wertvoller Belohnungen nutzen. Doppelklick, Reload, mehrere Tabs und wiederholte Requests dürfen keine Doppelbelohnungen erzeugen.
6. Neue Inhalte mit eigenen passenden Icons, vollständigen Beschreibungen und deutscher/englischer Textabdeckung ergänzen. Die aktuelle Architektur unter locales/ und tools/i18n/ weiterverwenden; PR #643 ist ein älterer, gesondert abzugleichender Entwurf.
7. Projekt-Testablauf aus CLAUDE.md beachten. Gezielte Verhaltenstests mit Gegenprobe ergänzen; Ergebnisse und nicht ausgeführte Prüfungen offen dokumentieren. Mobile Darstellung und vorhandene Spielstände prüfen.
8. Änderungen an Wirtschaft, Beute und Kämpfen in Vorschau, tatsächlicher Berechnung, Bericht, Hilfe und Tutorial konsistent halten. Keine unabhängig nachgebaute Berechnungslogik für Anzeigen.
9. Versionsnummer und Patchnotes erst gemäß Projektablauf vergeben. Veröffentlichung benötigt eine gesonderte Freigabe.

## K7-000 – Bestandsabgleich vor Umsetzung

Priorität: Voraussetzung für jede ausgewählte Aufgabe.

- [x] Aktuelles main und relevante offene PRs in beiden Repositories prüfen.
- [x] Für die ausgewählten IDs dokumentieren: vorhanden / teilweise vorhanden / fehlt / bereits in Arbeit / ausgeschlossen.
- [x] Betroffene Funktionen, Dateien, Datenquellen und Tests nennen.
- [x] Erledigte Teilfunktionen aus dem Auftrag streichen; vorhandene Konzeptdateien verknüpfen, nicht ersetzen.
- [x] Die erste lieferbare Teilaufgabe und ihre Abhängigkeiten festlegen.

Erledigt, wenn jede ausgewählte Aufgabe ein belegtes Implementierungsziel und klare Grenzen hat.

---

# Priorität 1 – Einstieg und Übersicht verbessern

## K7-001 – Deutsch/Englisch fertigstellen

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Groß; tatsächlicher Restumfang nach Inventur.

Idee: Das gesamte relevante Spiel soll in beiden Sprachen verständlich sein, nicht nur die Navigation.

Codex-Auftrag: Die bestehende main-Implementierung unter locales/ und tools/i18n/ weiterführen. Fehlende dynamische Beschreibungen, Hilfen, Tutorialtexte, Berichte, Meldungen und serverseitige Texte katalogisieren und übersetzen. Deutsch bleibt Standard; bestehende Sprachwahl weiterverwenden.

Erste Ausbaustufe: Offene Texte und Renderbereiche inventarisieren und einen klar abgegrenzten Bereich vollständig abschließen. Keine pauschale Vollständigkeitsbehauptung.

Erledigt, wenn: Sprachwechsel vor und nach Anmeldung funktioniert, die Auswahl erhalten bleibt und der beauftragte Bereich einschließlich dynamischer Zustände vollständig geprüft ist. Chat, Spielernamen und Eingaben bleiben unverändert. Spielstand und Ressourcen werden durch den Wechsel nicht beeinflusst. Vollständige Veröffentlichung erst nach den offenen Gesamtprüfungen.

## K7-002 – Persönlicher Rückkehrbericht

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Mittel.

Idee: Beim Wiederkommen auf einen Blick verstehen, was passiert ist und was jetzt sinnvoll wäre.

Codex-Auftrag: Bestehende Offline-/Nachrichtenanzeigen um eine gemeinsame Zusammenfassung erweitern: belegte Produktion, fertige Bauten/Forschungen, zurückgekehrte Flotten, neue Beute und relevante Lagergrenzen. Drei passende nächste Aktionen direkt verlinken.

Erste Ausbaustufe: Fertigstellungen, Flottenrückkehr und belegte Ressourcenänderungen anzeigen. Fehlende historische Daten nicht rückwirkend erfinden.

Erledigt, wenn: Jede Angabe auf tatsächlich gespeicherten Ereignissen bzw. der bestehenden Offline-Berechnung beruht, Links zum richtigen Spielbereich führen und Reloads weder Ereignisse noch Belohnungen erneut verarbeiten.

## K7-003 – Beutekompass und Set-Wunschliste

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Mittel.

Idee: Spieler können gezielt auf ein gewünschtes Modul oder vollständiges Set hinarbeiten.

Codex-Auftrag: Gegenstände als Wunschziel markieren. Vorhandene und fehlende Set-Teile, tatsächlich zulässige Fundorte, Zugangsvoraussetzungen und bereits sichtbare Fundchancen an einer Stelle darstellen. Vom Gegenstand zur passenden Aktivität springen.

Erste Ausbaustufe: Ein bestehendes Boss-Set vollständig im Beutekompass abbilden, danach datengetrieben erweitern.

Erledigt, wenn: Herkunft und Set-Boni aus den vorhandenen Definitionen stammen, gesperrte Quellen ehrlich erklärt werden und Besitz-/Ausrüstungswechsel die Anzeige korrekt aktualisieren. Keine Fundchancen erfinden und keine exklusive Beutequelle umgehen.

## K7-004 – Wirtschafts- und Engpassanzeige

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Mittel.

Idee: Nicht nur „zu wenig Ressourcen“, sondern nachvollziehbar zeigen, was ein Vorhaben blockiert.

Codex-Auftrag: Für einen ausgewählten Bau oder eine Forschung Nettozufluss, Verbrauch, Lagergrenze und fehlende Voraussetzungen zusammenfassen. Den Effekt einer möglichen Verbesserung als Vorschau aus der echten Spielberechnung anzeigen.

Erste Ausbaustufe: Ein ausgewähltes Forschungsziel mit fehlenden Ressourcen, erreichbar/nicht erreichbar und begründeter Wartezeit anzeigen.

Erledigt, wenn: Negative Produktion, volle Lager, Baukonten und weitere bestehende Mechaniken korrekt berücksichtigt werden. Wartezeiten als Schätzung bei unveränderten Bedingungen kennzeichnen. Kein automatischer Kauf und keine Ressourcenabbuchung durch die Vorschau.

## K7-005 – Kartenfavoriten und Aufgabenfilter

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Klein bis mittel.

Idee: Wichtige Ziele schneller finden, ohne ständig dieselben Koordinaten zu suchen.

Codex-Auftrag: Fehlende Favoriten-, Notiz- und Filterfunktionen ergänzen. Beispiele: eigene Kolonien, erreichbare Beuteziele, Allianztreffpunkte und aktuell relevante Missionen. Auswahl zwischen Ansichten beibehalten.

Erste Ausbaustufe: Persönliche Favoriten mit eigener Kurznotiz und direktem Kartensprung.

Erledigt, wenn: Markierungen nach erneutem Login erhalten bleiben, Umbenennen/Löschen funktioniert und kein Filter unbekannte, getarnte oder anderweitig geschützte Informationen aufdeckt.

## K7-006 – Mobile Bedienung durchgehend verbessern

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Mittel.

Idee: Die zentralen Spielabläufe sollen am Handy ohne Fummelei funktionieren.

Codex-Auftrag: Bauen, Forschen, Flottenstart, Ausrüstung, Belohnungsabholung und Karteninteraktion auf schmalen Bildschirmen prüfen. Abgeschnittene Dialoge, reine Hover-Erklärungen, überlagerte Schaltflächen und versehentliche Doppelklicks gezielt beseitigen.

Erste Ausbaustufe: Einen vollständigen Ablauf vom Login bis zur Flottenrückkehr prüfen und die nachgewiesenen Probleme beheben.

Erledigt, wenn: Die beauftragten Abläufe auf 360, 390 und 430 CSS-Pixel breiten Ansichten sowie am Desktop bedienbar sind, Dialoge korrekt scrollen und keine Aktion versehentlich doppelt ausgelöst wird.

---

# Priorität 2 – Mehr Entdeckungen und persönliche Ziele

## K7-007 – Erste zusammenhängende Story-Kampagne

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Mittel bis groß.

Idee: „Das verstummte Forschungsschiff“ – aus einem Notruf wird eine kleine Geschichte mit einer echten Entscheidung.

Codex-Auftrag: Eine Kampagne aus fünf aufeinanderfolgenden Missionen auf vorhandenen Aktivitätstypen bauen: Signal untersuchen, Daten bergen, Gefahr überwinden, Entscheidung treffen, Abschluss erleben. Kein neuer Freiflug-Modus.

Erste Ausbaustufe: Genau eine Kampagne mit einer Entscheidung und zwei unterschiedlichen Abschlussvarianten. Belohnungen klein, eindeutig definiert und an bestehende Systeme angebunden.

Erledigt, wenn: Fortschritt gespeichert wird, Reihenfolge und Wahl serverseitig nachvollziehbar sind, Abschlussbelohnungen nur einmal vergeben werden und ein später Rückkehrer die Geschichte ohne Zeitdruck fortsetzen kann.

## K7-008 – Expeditionen mit Entscheidungen

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Groß.

Idee: Eine Expedition meldet eine Anomalie. Der Spieler entscheidet: sicher bergen, gründlich untersuchen oder umkehren.

Codex-Auftrag: Zuerst einen Ereignistyp mit drei klar beschriebenen Optionen ergänzen. Risiken und mögliche Gewinne müssen vor der Entscheidung erkennbar sein. Ohne Antwort gilt eine sichere, vorher erklärte Standardoption.

Erste Ausbaustufe: Ein Wrack-Ereignis; kein neues Echtzeit-Steuerungssystem und keine umfassende Überarbeitung aller Expeditionen.

Erledigt, wenn: Das Ereignis nur einmal entschieden werden kann, Zufallsergebnis und Belohnung nicht per Reload neu ausgewürfelt werden und Frontend, Server, Rückkehrbericht und Offline-Verhalten dieselbe Entscheidung verwenden.

## K7-009 – Pechschutz für ausgewählte Set-Teile

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Mittel bis groß.

Idee: Wer denselben zulässigen Boss oft besiegt, macht auch bei unpassender Beute sichtbaren Fortschritt zu seinem Wunschstück.

Codex-Auftrag: Prüfen, ob vorhandene Fragmente oder Herstellungssysteme dafür genutzt werden können. Für ein ausgewähltes Set einen begrenzten, transparenten Ziel-Fortschritt aus tatsächlich serverbestätigten Kämpfen derselben Beutequelle vorsehen.

Erste Ausbaustufe: Ein Set, ein klarer Fortschrittsweg, modellierte Auswirkungen auf die Gegenstandsverfügbarkeit. Kein allgemeiner Gratis-Shop für seltene Module.

Erledigt, wenn: Exklusive Herkunftsregeln erhalten bleiben, Zufallsfunde weiterhin Bedeutung haben, bereits vorhandene Teilfortschritte nicht mehrfach gezählt werden und Balancetests die Auswirkungen belegen. Nicht pauschal jede beliebige Aktivität für Boss-Beute anrechnen.

## K7-010 – Kolonie-Baupläne

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Mittel.

Idee: Eine bewährte Bau-Reihenfolge als „Bergbaukolonie“, „Forschung“ oder „Handel“ auf einer weiteren Kolonie wiederverwenden.

Codex-Auftrag: Bauziele und Zielstufen als Vorlage speichern. Beim Anwenden aktuelle Gebäude, Voraussetzungen, vorhandene Warteschlangen und echte Kosten vergleichen. Zunächst nur einen Plan vorschlagen, nicht sofort alles abbuchen.

Erste Ausbaustufe: Plan speichern, auf einer anderen eigenen Kolonie vergleichen und einzelne Schritte bewusst übernehmen.

Erledigt, wenn: Bereits erreichte Ziele übersprungen werden, unzulässige Ziele begründet blockiert sind und keine Bauzeit-, Kosten- oder Warteschlangenregeln umgangen werden.

## K7-011 – Entdeckerarchiv und Fraktionsgeschichten

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Mittel.

Idee: Besondere Orte und Fraktionen erhalten kleine Geschichten, die durch Erkundung bzw. Ruf sichtbar werden.

Codex-Auftrag: Zuerst fünf besondere Orte und eine Fraktion auswählen. Kurze, zusammenhängende Einträge mit Herkunft, Fundbedingung und dauerhaft gespeichertem Entdeckungsstatus ergänzen. Bestehende Fraktionsdaten und Kompendium verwenden.

Erste Ausbaustufe: Kleine, abgeschlossene Sammlung statt hunderter generischer Texte.

Erledigt, wenn: Enthüllungsbedingungen korrekt greifen, Einträge in Deutsch/Englisch verfügbar sind und Texte keine nicht existierenden Spielmechaniken oder garantierten Belohnungen versprechen.

## K7-012 – Persönliche Trophäenhalle

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Klein bis mittel.

Idee: Erste Bosssiege, seltene Funde und besondere Allianzleistungen sichtbar ausstellen können.

Codex-Auftrag: Eine kleine Profilfläche mit frei auswählbaren Trophäen aus tatsächlich belegten Errungenschaften schaffen. Vorhandene Titel und Kosmetik wiederverwenden, keine zweite Erfolgswährung hinzufügen.

Erste Ausbaustufe: Drei Ausstellungsplätze mit Auswahl, Vorschau und austauschbarer Reihenfolge.

Erledigt, wenn: Nur rechtmäßig freigeschaltete Trophäen auswählbar sind, Auswahl und Reihenfolge gespeichert werden und fehlende historische Abschlussdaten nicht erfunden werden. Keine zusätzlichen Kampfboni.

## K7-013 – Sichtbares Feedback und mehr Leben in der Kolonie

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Mittel.

Idee: Erfolge und Aktivität nicht nur als Zahlen sehen: fertiges Bauwerk, Flottenankunft, neuer Fund oder kleines Stationsmanöver.

Codex-Auftrag: Eine begrenzte Auswahl fehlender Ereignisrückmeldungen in der vorhandenen Bildsprache ergänzen. Animationen an echte Spielereignisse binden; optionale Geräusche separat regelbar machen.

Erste Ausbaustufe: Bauabschluss und Flottenankunft mit eindeutiger, nicht störender Rückmeldung.

Erledigt, wenn: Rückmeldungen nicht durch jedes Neurendern erneut ausgelöst werden, reduzierte Bewegung respektiert wird, Ton abschaltbar ist und mobile Bedienbarkeit sowie Leistung nicht messbar verschlechtert werden.

---

# Priorität 3 – Größere Spielinhalte in kleinen Etappen

## K7-014 – Allianzoperation mit unterschiedlichen Aufgaben

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Sehr groß.

Idee: Eine Gruppe erfüllt gemeinsam Aufklärung, Versorgung und Angriff. Nicht jeder Teilnehmer muss dieselbe stärkste Flotte besitzen.

Codex-Auftrag: Auf vorhandene Allianz- und Flottenmechaniken aufsetzen. Eine PvE-Operation mit drei aufeinanderfolgenden Aufgaben planen. Jede Aufgabe erhält eine tatsächlich wirksame Rolle, klare Teilnahmebedingungen und nachvollziehbare Belohnungsregeln.

Erste Ausbaustufe: Eine einzelne Operation, ein Ziel, klar begrenzte Teilnahme und ein funktionierender gemeinsamer Abschluss. Kein eigener paralleler Raid-Unterbau.

Erledigt, wenn: Beiträge serverseitig belegt werden, nicht teilnehmende Konten keine Teilnehmerbelohnung erhalten, Abbruch/Austritt/Neuladen eindeutig behandelt werden und Belohnungen auch für Offline-Teilnehmer sicher genau einmal bereitgestellt werden.

## K7-015 – Bossvariante mit echten Kampfphasen

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Groß.

Idee: Ein Schildträger-Boss wechselt nachvollziehbar zwischen Schildphase und verwundbarer Phase. Vorbereitung und Flottenwahl haben erkennbaren Einfluss.

Codex-Auftrag: Zuerst prüfen, welche Phasen und Konter bereits existieren. Genau eine neue Variante mit eigenständiger, getesteter Mechanik ergänzen; nicht lediglich zusätzliche Lebenspunkte oder kosmetisch behauptete Phasen.

Erste Ausbaustufe: Ein Boss mit zwei klaren Phasen, Vorabhinweis und nachvollziehbarem Bericht.

Erledigt, wenn: Phasen aus der tatsächlichen Kampfberechnung hervorgehen, Vorschau und Bericht dazu passen, vorhandene Ausrüstung wie vorgesehen wirkt und Belohnungen im Rahmen der bestehenden Balance bleiben.

## K7-016 – Taktische Prüfungen mit vorgegebener Flotte

Status: Erledigt – vollständiger beauftragter Umfang implementiert und geprüft (v8.743.0); aktuelle Abschlussnachweise oben.
Aufwand: Groß.

Idee: Eine taktische Aufgabe mit gleicher Ausgangsflotte für alle – Erfolg durch Entscheidungen statt allein durch jahrelang angesammelte Stärke.

Codex-Auftrag: Einen PvE-Prüfungsmodus mit vorgegebenen Schiffen/Modulen und klaren Siegzielen skizzieren und umsetzen. Die vorhandene Kampfberechnung nutzen. Normale Flotte, Spielstand und Wirtschaft bleiben getrennt.

Erste Ausbaustufe: Genau ein Szenario ohne Rangliste und ohne handelbare Belohnung. Erst nach erfolgreicher Prüfung weitere Szenarien oder kosmetische Auszeichnungen ergänzen.

Erledigt, wenn: Eigene Flotten und Ressourcen weder verbraucht noch dupliziert werden, Versuche reproduzierbar geprüft werden können und eine spätere Belohnung ausschließlich für servervalidierte Abschlüsse vorgesehen ist.

---

## Empfohlene Reihenfolge

1. K7-000 für die ausgewählten Aufgaben ausführen.
2. K7-001 als vorhandene Arbeit separat weiterführen; offene Übersetzungsarbeit nicht durch neue inkompatible Texte vergrößern.
3. K7-003: Beutekompass – ein konkretes Ziel für Spieler, ohne sofort die Balance zu verändern.
4. K7-007: erste Story-Kampagne – ein abgeschlossenes neues Spielerlebnis.
5. K7-002: Rückkehrbericht – laufenden Fortschritt verständlich machen.
6. K7-008: ein Entscheidungsereignis für Expeditionen.
7. Größere Aufgaben K7-014 bis K7-016 erst nach jeweils eigener Bestandsanalyse und expliziter Auswahl beginnen.

Bei parallelen Codex-Sitzungen unterschiedliche Bereiche zuweisen; zentrale Spieldatei, Versionsnummern, Patchnotes und abschließende Prüfläufe gemäß den vorhandenen Projektregeln koordinieren.

## Vorlage für die Bearbeitungsnotiz pro Aufgabe

- ID / beauftragter Umfang:
- Bestand und verknüpfte offene Arbeit:
- Erste lieferbare Teilaufgabe:
- Betroffene Dateien, Funktionen und Schnittstellen:
- Umsetzung und Abweichungen:
- Tests einschließlich Gegenprobe:
- Nicht geprüfte Punkte / Restrisiken:
- Branch / Commit / PR:
- Status: vorgeschlagen / beauftragt / in Arbeit / geprüft / veröffentlicht

„Veröffentlicht“ erst nach tatsächlichem Deployment und dessen Prüfung setzen. „Implementiert“ ist nicht gleichbedeutend mit „produktiv verfügbar“.

## Herangezogene Projektquellen

- Frontend CLAUDE.md, gelesen auf main am 05.10.2026.
- Frontend docs/content-ideen.md, einschließlich Nachträgen und Erledigt-Markierungen.
- Offener Frontend-Entwurf PR #643: Deutsch/Englisch-Sprachwahl und englische Oberfläche (Beta).
- Frontend-Dokumentationsverzeichnis mit den bereits vorhandenen Fachkonzepten.
- Suchergebnisse auf dem Standardbranch zu Loadouts, insbesondere tests/test_loadout_vorschau.js und tests/test_klassen_vorlagen.js.

Die neuen Ideen und ihre Priorisierung sind Vorschläge dieser Planung, keine aus den Quellen abgeleiteten Bestandsbehauptungen.

### Geprüfter Zwischenstand

GitHub Actions Run 37306487860: sieben Pflichtprüfungen, 24 Favoriten-Browserprüfungen, 13 Taktik-Logikprüfungen und beide roten Gegenproben bestanden. Die bestehenden Handy-/Fokusprüfungen und der Tab-Sweep bestanden unverändert über einen lokalen HTTP-Testserver sowohl am Basisstand als auch am Feature. Der vorherige file://-Lauf blieb hinter der Loginmaske, weil relative /api-Aufrufe dort keine HTTP-Herkunft haben; keine Loginlogik und keine Assertions wurden dafür abgeschwächt. Nicht durchgeführt: vollständige Projektsuite, produktiver Backend-Test, Produktionsfreigabe.
