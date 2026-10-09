# Kepler 7 — Kommandozentrale: visuelle Abschlussprüfung

Ausgewählte Richtung: Vorschlag 1, Kommandozentrale. Prüfung am 09.10.2026 am tatsächlichen Spiel mit isolierten lokalen Demodaten.

## Vergleichsziel und Evidenz

Quelle: `C:/Users/Luft/.codex/generated_images/01a10fb5-063e-7352-ab78-3f0a01a616ef/exec-cf1c63f0-fc66-4bf7-ba93-93fc0e8d480c.png` (1487 × 1058 Pixel).
Implementierung: `http://127.0.0.1:8780/`, `weltraum_kolonie.html`. Die finalen Voll- und Detailvergleiche zeigen Stylesheet `20261009-command-19`. Root und unabhängiger Review-Agent haben sie tatsächlich geöffnet und geprüft.
Evidenzordner: `C:/Users/Luft/Documents/ChatGPT/kepler 7/grafik-hud-vorschlaege-2026-10-09/`.

Desktopzustand: deutsche Sprache, dunkle Standardgestaltung, entwickelte Heimatbasis, Erzmine Stufe 22 ausgewählt, Solarkraftwerk 31, Habitat 12, Raffinerie 21; Menü, Kennzahlen, Tagesaufgaben und Statusfenster geschlossen. Die echten Rohstoffbestände und Produktionsraten laufen weiter; der Entwurf enthält Beispielzahlen. Vorhandene Spieleravatare, Gebäudemodelle, Icons und Spielinformationen bleiben maßgeblich.

CSS-Viewport 1487 × 1058, gemeldete devicePixelRatio 1. Die Browser-API liefert 1472 × 1047 Pixel; für den Vergleich wird das gesamte Quellbild proportional auf diese Rastergröße normalisiert, ohne Elemente zu entfernen. Die Originaldateien bleiben unverändert.

- Native Desktopaufnahme: `51-command-desktop-final-19.jpg`.
- Gemeinsamer Vollbildvergleich, Quelle links und Spiel rechts: `52-design-comparison-final-19.png`.
- Gemeinsame Detailvergleiche: `53-navigation-comparison-final-19.png`, `54-hud-comparison-final-19.png`, `55-inspector-comparison-final-19.png`.
- Handy, CSS-Viewport 390 × 844, DPR 1, API-Raster 375 × 812: `41-command-mobile-final-17.jpg`.
- Gesamtes vertikal scrollendes Handy-Menü, oberer und unterer Zustand: `43-command-menu-top-17.jpg`, `44-command-menu-bottom-17.jpg`.
- Sichtbares natives Warteschlangenziel: `48-command-queue-17.jpg`.
- Handy-Verteidigung: `42-command-defense-mobile-17.jpg`.
- Tagesaufgaben mit eigenem Schließenknopf im Hochformat: `45-command-quests-portrait-17.jpg`; Querformat auf endgültigem CSS19: `50-command-quests-landscape-final-19.jpg`.
- Forschung bei 320 × 844 ohne horizontale Scrollleiste: `49-command-research-320-final-19.jpg`.

Die Dateien 41–45/48 zeigen die unveränderten Handyflächen auf CSS17. CSS19 ergänzt ausschließlich den Layout-Ausschluss des geschlossenen Aufgabenpopups und den Umbruch langer Forschungsnamen. Die betroffenen Zustände wurden auf CSS19 erneut aufgenommen und geprüft. Screenshot 47 mit dem gefundenen Überstand bleibt als Befundbeleg erhalten, wird aber nicht als finale Ansicht verwendet.

Das ausgewählte Bild definiert die Desktopkomposition. Eine eigene mobile Bildvorlage liegt nicht vor; die Handyansicht wird anhand derselben Hierarchie, vollständiger Inhalte und erreichbarer nativer Bedienung geprüft.

## Fünf erforderliche Gestaltungsflächen

**Schrift und Typografie:** System-UI-Schrift mit Sans-Serif-Fallback; klar getrennte Seitentitel, Gebäudetitel, Navigationsbeschriftungen und kleine Produktionsangaben. Native Preise und Ausbaugrenzen bleiben vollständiger als im Beispielentwurf. Lange Namen umbrechen; auf besonders schmalen Handys verhindert ein zweispaltiges Rohstoffraster abgeschnittene Milliardenwerte. Alle dreizehn Menüsymbole und Beschriftungen sind links ausgerichtet. Diese Umsetzung erhält die vorhandenen Symbolschrift- und Gebäudebezeichnungen.

**Abstände und Layoutrhythmus:** Vier Navigationsgruppen links, schlanke klebende Kopfzeile, sechs Rohstoffe, Material-/Aufgabenband, große Kolonieszene neben dem Gebäudefenster, vollständiger vierteiliger Katalog und untere Statusleiste. Die erste Katalogreihe steht vollständig oberhalb der Statusleiste. Am Handy werden Szene und Gebäudefenster untereinander angeordnet; der ganze Menübereich scrollt vertikal. Die sicheren PWA-Ränder und die tatsächlich gemessene Statushöhe bestimmen die Freiflächen. Kleine 3px-Ecken der neuen Kommandoelemente ergänzen die vorhandenen geschnittenen Spielkarten.

**Farben und Tokens:** Dunkles Blau für Flächen, helle Schrift, gedämpfte Sekundärtexte, Cyan für Auswahl und Amber für Hinweise. Der gewählte Status bleibt erkennbar; Kosten- und Sperrhinweise behalten ihre native Bedeutung. Native Ressourcen- und Bereichsfarben werden weiterverwendet. Keine neue Farbcodierung für bestehende Spielmechanik.

**Bildqualität und Assets:** Die vorhandene detaillierte Kolonieillustration und die echten Gebäudemodelle bleiben scharf und im richtigen Verhältnis. Auswahlmarken liegen auf der Szene, Modelle erscheinen auch im vollständigen Katalog. Das originale violette Kepler-Logo, der vorhandene Iconkatalog und der reale Spieleravatar haben Vorrang vor den abweichenden Beispielmotiven im Entwurf. Es wurden keine Bildvorlagen durch nachgezeichnete Ersatzformen ersetzt. Die großen Atlasbilder wurden nicht verändert.

**Texte und Inhalte:** Alle dreizehn Spielbereiche, 29 Gebäude und 23 Verteidigungsanlagen bleiben vorhanden. Native Produktionsprognosen, Kosten, Stufen und Sperrgründe stehen weiterhin an den Aktionen. Standortwahl, Monde, selbst vergebene Namen und englische Beschriftungen nutzen die Spielinformationen. Globale Flotteneinsätze und Bauwünsche stimmen mit den jeweiligen nativen Zielansichten überein. Kennzahlen und Aufgaben sind zugänglich aufklappbar. Fiktive Entwurfswerte und ein erfundener Serverstatus werden nicht ins Spiel übernommen.

## Behobene Befunde und Vergleichshistorie

- P2: Anfangs verdrängten lange Kopfbereiche und zu hohe Gebäudekarten den Katalog. Die Kopfzeile, Materialzeile, Szenenhöhe und Katalogabstände wurden angepasst. Finale Voll- und Detailvergleiche 51–55 zeigen Szene, Gebäudefenster und erste Katalogreihe gemeinsam im Bild.
- P1: Alte Fensterposition und Stapelkontexte konnten Titel/Schließknopf bzw. Status-Einstieg verdecken. Die Transformation entfällt, die Statusleiste liegt außerhalb des inneren Stapelkontexts, der sichtbare Einstieg bleibt über der Verdunklung. Native Handy-/Desktopklicks und gerichtete Gegenproben prüfen beide Wege.
- P2: Flotten- und Wunschlistenangaben zählten nur den aktiven Standort. Sie nutzen jetzt den bestehenden globalen Flottenzähler einschließlich Recycler/Eskorten/Allianzverbänden und die vollständige native Bauwunschliste. Auch fremder Standort und Recycler ohne Missionseintrag werden geprüft.
- P2: Die neue Kopfzeile verlor sichere Bildschirmränder und verdeckte zweite Leisten sowie Sprungziele. Safe-Area-Variablen, die echte Hero-Höhe und ein Border-Box-ResizeObserver halten Kopf, Flottenband, Statusfenster und Inhaltsende frei. Der sichere Geometrievertrag wurde in Hoch- und Querformat mit vier ausdrücklich gemessenen Insets geprüft; dies ist eine kontrollierte PWA-Geometrieprüfung, kein behaupteter Test auf einem physischen iPhone.
- P2: Sehr große Rohstoffzahlen passten bei 320/360px nicht; die vollständige Linux-Prüfung zeigte dieselbe Lücke auch bei 390px. Bis 480px verwenden die sechs Karten jetzt zwei Spalten. Die Messung prüft echten Text und Kartenränder nach abgeschlossener Zahlenanimation.
- P2: Der Queue-Sprung ließ zunächst das Statusfenster offen und anschließend den Queue-Titel unter der Kopfzeile. Er schließt jetzt die native Schublade und fokussiert das sichtbare Ziel unter dem Kopf. Post-Fix-Bild 33; gemessen Queue-Top 75,28px bei Hero-Unterkante 65px.
- P2: Bild 29 zeigte abgeschnittene untere Handy-Menügruppen und eine horizontale Scrollleiste. Der Reset überschreibt nun auch die spezifische alte mobile Tabs-Regel; der gesamte Drawer scrollt. Bilder 34/35 zeigen alle dreizehn Einträge und das Profil mit der endgültigen gemeinsamen linken Ausrichtung einschließlich Sammlung. Normales Rad-Scrollen zum letzten Menüpunkt wird geprüft, unabhängig vom automatischen Scrollen eines Testklicks.
- P2: Frühe Animationsframes konnten einen negativen Rohstoff-Zwischenwert anzeigen. Der native Zählfortschritt ist auf 0 bis 1 begrenzt. Ein separater Test füttert frühe und spätere Framezeiten in die unveränderte native Animationsfunktion; die Gegenprobe entfernt nur die neue Untergrenze. Bestände und Produktionsrechnung wurden nicht geändert.
- P2: Das mobile Aufgabenpopup konnte den eigenen Summary-Schalter verdecken. Ein nativer, 44 × 44px großer Schließenknopf betätigt denselben Details-Schalter und gibt ihm den Fokus zurück. Das Popup orientiert sich bis 900px an Statushöhe und sicheren Rändern; Hoch- und Querformat wurden gemessen und bedient.
- P2: Der Forschungskopf brach bei 320px nicht um. Titel und Fortschritt dürfen jetzt innerhalb derselben Spalte umbrechen. Eine Gegenprobe stellt die tatsächlich zuvor vorhandene Kopfgestaltung wieder her und trifft ausschließlich den zugehörigen Geometriewächter.
- P2: Bild 47 zeigte zusätzlich vier Pixel horizontalen Überstand bei klassischen Browser-Scrollbalken. Ein langer Forschungsname hatte 227px Textbreite bei 194px Spaltenbreite; er bricht jetzt innerhalb seiner vorhandenen Spalte um. Die isolierte Gegenprobe trifft genau den Namensfit und den Dokumentüberstand. CSS19: Dokument-Clientbreite und Scrollbreite beide 305px bei Viewport 320px, alle 53 Forschungsnamen passen. Bild 49 bestätigt den entfernten horizontalen Balken. Kein globales Abschneiden oder Verkleinern der Schrift. Zusätzlich erhalten geschlossene Aufgabeninhalte einen ausdrücklichen Layout-Ausschluss; dessen eigenständige Gegenprobe zeigt behaltene Popupmaße, aber keinen zusätzlichen Dokumentüberstand. Er wird deshalb nicht als Ursache der horizontalen Scrollleiste dargestellt.
- P2: Ein Kartenzielsprung ließ den Flottenstatus offen. Er schließt jetzt zuerst die native Schublade; beide Missionswege werden mit echten Treffertests und je einer gezielten Gegenprobe geprüft.
- Die stille HUD-Aktualisierung schreibt den unveränderten Übersetzungsschutz des Spielernamens nicht wiederholt. Das Attribut steht statisch am nativen Namenselement; die Gegenprobe zählt echte Attributmutationen bei drei Aktualisierungen.

Frühe Aufnahmen 06–48 und Vergleiche 18–21, 24–27 sowie 37–40 bleiben als Iterationsbelege im Evidenzordner; die finalen normalisierten Vergleiche sind 52–55. Die früheren Vergleiche werden nicht als abschließender Dichtenachweis verwendet.

## Bedienung und Prüfgrenzen

Manuell im Browser: Standortwahl, Menü öffnen/schließen, End-Taste zum unteren Menübereich, Sammlung und Verteidigung öffnen, Fokus im ausgewählten Panel, Statusfenster öffnen, Escape mit Fokus zum sichtbaren Einstieg, Status→Bauwarteschlange und sichtbarer Queue-Titel. CSS17/19: echte Tagesaufgaben im Hoch- und Querformat öffnen, eigenen Schließenknopf drücken und zurückgegebenen Summary-Fokus prüfen; Forschung bei 320px lesen. Queue-Top 74,53px bei Hero-Unterkante 65px. Browserkonsole: keine App-Fehler. Der temporäre Viewport wurde zurückgesetzt.

Automatisch: alle nativen Bereiche über mehrere Breiten von 320 bis 1900px, echte Trefferflächen, Badges, Tastaturfokus/Tab/Escape, Drawer-Scrollen, Chat über Navigation, Tagesaufgaben und Kennzahlen, eigene Planeten und Monde, Namen in Deutsch/Englisch, native Bauaktionen, globale Zähler, zweites Flottenband/Karten-/Abschnittssprünge und sichere PWA-Ränder. Die Gegenproben sind Teil der zusätzlichen PR-Prüfung. Die vollständige Spielprüfung folgt vor Versionsvergabe und Veröffentlichung; diese visuelle Prüfung behauptet deren Ergebnis nicht.

Die erste vollständige Prüfung ist abgeschlossen und hat weitere Bedien- und Layoutlücken aufgedeckt. Sie wurden behoben und gezielt geprüft: der native Command-Test hat auf dem endgültigen CSS19 erneut 404/404 Prüfungen bestanden; auch alle elf betroffenen strikten Command-Gegenproben wurden auf CSS19 vollständig grün wiederholt. Die normalen Fachprüfungen und 22 unabhängige Harmony-/Graphics-/Map-Gegenproben waren zuvor grün. CSS19 hat den gezielten Lauf mit echter klassischer Scrollleiste vollständig bestanden (16/16); die beiden neuen Gegenproben treffen ausschließlich ihre festen Fehlermengen bei unverändert vollständigem 16er-Manifest und grünem JavaScript-Abschluss. Alle sieben Pflichtprüfungen sind grün. Die erneute vollständige Spielprüfung mit allen 467 Testdateien ist noch ausstehend; die Versionsvergabe und Veröffentlichung folgen erst nach deren Erfolg. Zusätzliche native Texte, kleinere Originalmodelle, originale Icons/Logo und die laufenden Daten sind erwartete Anpassungen an das bestehende Spiel.

final result: passed (visuelle Prüfung; vollständige automatisierte Veröffentlichungsschranke noch ausstehend)
