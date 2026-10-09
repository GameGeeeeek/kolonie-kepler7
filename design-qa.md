# Kepler 7 — Kommandozentrale: visuelle Abschlussprüfung

Ausgewählte Richtung: Vorschlag 1, Kommandozentrale. Prüfung am 09.10.2026 am tatsächlichen Spiel mit isolierten lokalen Demodaten.

## Vergleichsziel und Evidenz

Quelle: `C:/Users/Luft/.codex/generated_images/01a10fb5-063e-7352-ab78-3f0a01a616ef/exec-cf1c63f0-fc66-4bf7-ba93-93fc0e8d480c.png` (1487 × 1058 Pixel).
Implementierung: `http://127.0.0.1:8780/`, `weltraum_kolonie.html`, Stylesheet `20261009-command-15`.
Evidenzordner: `C:/Users/Luft/Documents/ChatGPT/kepler 7/grafik-hud-vorschlaege-2026-10-09/`.

Desktopzustand: deutsche Sprache, dunkle Standardgestaltung, entwickelte Heimatbasis, Erzmine Stufe 22 ausgewählt, Solarkraftwerk 31, Habitat 12, Raffinerie 21; Menü, Kennzahlen, Tagesaufgaben und Statusfenster geschlossen. Die echten Rohstoffbestände und Produktionsraten laufen weiter; der Entwurf enthält Beispielzahlen. Vorhandene Spieleravatare, Gebäudemodelle, Icons und Spielinformationen bleiben maßgeblich.

CSS-Viewport 1487 × 1058, gemeldete devicePixelRatio 1. Die Browser-API liefert 1472 × 1047 Pixel; für den Vergleich wird das gesamte Quellbild proportional auf diese Rastergröße normalisiert, ohne Elemente zu entfernen. Die Originaldateien bleiben unverändert.

- Native Desktopaufnahme: `23-command-desktop-final.jpg`.
- Gemeinsamer Vollbildvergleich, Quelle links und Spiel rechts: `24-design-comparison.png`.
- Gemeinsame Detailvergleiche: `25-navigation-comparison.png`, `26-hud-comparison.png`, `27-inspector-comparison.png`.
- Handy, CSS-Viewport 390 × 844, DPR 1, API-Raster 375 × 812: `28-command-mobile-final.jpg`.
- Gesamtes vertikal scrollendes Handy-Menü, oberer und unterer Zustand auf Stylesheet 15: `34-command-menu-final-top.jpg`, `35-command-menu-final-bottom.jpg`.
- Sichtbares natives Warteschlangenziel nach dem Statusfenster: `33-command-queue-fixed.jpg`.
- Handy-Verteidigung: `30-command-defense-mobile.jpg`.

Das ausgewählte Bild definiert die Desktopkomposition. Eine eigene mobile Bildvorlage liegt nicht vor; die Handyansicht wird anhand derselben Hierarchie, vollständiger Inhalte und erreichbarer nativer Bedienung geprüft.

## Fünf erforderliche Gestaltungsflächen

**Schrift und Typografie:** System-UI-Schrift mit Sans-Serif-Fallback; klar getrennte Seitentitel, Gebäudetitel, Navigationsbeschriftungen und kleine Produktionsangaben. Native Preise und Ausbaugrenzen bleiben vollständiger als im Beispielentwurf. Lange Namen umbrechen; auf besonders schmalen Handys verhindert ein zweispaltiges Rohstoffraster abgeschnittene Milliardenwerte. Alle dreizehn Menüsymbole und Beschriftungen sind links ausgerichtet. Diese Umsetzung erhält die vorhandenen Symbolschrift- und Gebäudebezeichnungen.

**Abstände und Layoutrhythmus:** Vier Navigationsgruppen links, schlanke klebende Kopfzeile, sechs Rohstoffe, Material-/Aufgabenband, große Kolonieszene neben dem Gebäudefenster, vollständiger vierteiliger Katalog und untere Statusleiste. Die erste Katalogreihe steht vollständig oberhalb der Statusleiste. Am Handy werden Szene und Gebäudefenster untereinander angeordnet; der ganze Menübereich scrollt vertikal. Die sicheren PWA-Ränder und die tatsächlich gemessene Statushöhe bestimmen die Freiflächen. Kleine 3px-Ecken der neuen Kommandoelemente ergänzen die vorhandenen geschnittenen Spielkarten.

**Farben und Tokens:** Dunkles Blau für Flächen, helle Schrift, gedämpfte Sekundärtexte, Cyan für Auswahl und Amber für Hinweise. Der gewählte Status bleibt erkennbar; Kosten- und Sperrhinweise behalten ihre native Bedeutung. Native Ressourcen- und Bereichsfarben werden weiterverwendet. Keine neue Farbcodierung für bestehende Spielmechanik.

**Bildqualität und Assets:** Die vorhandene detaillierte Kolonieillustration und die echten Gebäudemodelle bleiben scharf und im richtigen Verhältnis. Auswahlmarken liegen auf der Szene, Modelle erscheinen auch im vollständigen Katalog. Das originale violette Kepler-Logo, der vorhandene Iconkatalog und der reale Spieleravatar haben Vorrang vor den abweichenden Beispielmotiven im Entwurf. Es wurden keine Bildvorlagen durch nachgezeichnete Ersatzformen ersetzt. Die großen Atlasbilder wurden nicht verändert.

**Texte und Inhalte:** Alle dreizehn Spielbereiche, 29 Gebäude und 23 Verteidigungsanlagen bleiben vorhanden. Native Produktionsprognosen, Kosten, Stufen und Sperrgründe stehen weiterhin an den Aktionen. Standortwahl, Monde, selbst vergebene Namen und englische Beschriftungen nutzen die Spielinformationen. Globale Flotteneinsätze und Bauwünsche stimmen mit den jeweiligen nativen Zielansichten überein. Kennzahlen und Aufgaben sind zugänglich aufklappbar. Fiktive Entwurfswerte und ein erfundener Serverstatus werden nicht ins Spiel übernommen.

## Behobene Befunde und Vergleichshistorie

- P2: Anfangs verdrängten lange Kopfbereiche und zu hohe Gebäudekarten den Katalog. Die Kopfzeile, Materialzeile, Szenenhöhe und Katalogabstände wurden angepasst. Neue Voll- und Detailvergleiche 23–27 zeigen Szene, Gebäudefenster und erste Katalogreihe gemeinsam im Bild.
- P1: Alte Fensterposition und Stapelkontexte konnten Titel/Schließknopf bzw. Status-Einstieg verdecken. Die Transformation entfällt, die Statusleiste liegt außerhalb des inneren Stapelkontexts, der sichtbare Einstieg bleibt über der Verdunklung. Native Handy-/Desktopklicks und gerichtete Gegenproben prüfen beide Wege.
- P2: Flotten- und Wunschlistenangaben zählten nur den aktiven Standort. Sie nutzen jetzt den bestehenden globalen Flottenzähler einschließlich Recycler/Eskorten/Allianzverbänden und die vollständige native Bauwunschliste. Auch fremder Standort und Recycler ohne Missionseintrag werden geprüft.
- P2: Die neue Kopfzeile verlor sichere Bildschirmränder und verdeckte zweite Leisten sowie Sprungziele. Safe-Area-Variablen, die echte Hero-Höhe und ein Border-Box-ResizeObserver halten Kopf, Flottenband, Statusfenster und Inhaltsende frei. Der sichere Geometrievertrag wurde in Hoch- und Querformat mit vier ausdrücklich gemessenen Insets geprüft; dies ist eine kontrollierte PWA-Geometrieprüfung, kein behaupteter Test auf einem physischen iPhone.
- P2: Sehr große Rohstoffzahlen passten bei 320/360px nicht. Unter 381px verwenden die sechs Karten zwei Spalten. Die Messung prüft echten Text und Kartenränder nach abgeschlossener Zahlenanimation.
- P2: Der Queue-Sprung ließ zunächst das Statusfenster offen und anschließend den Queue-Titel unter der Kopfzeile. Er schließt jetzt die native Schublade und fokussiert das sichtbare Ziel unter dem Kopf. Post-Fix-Bild 33; gemessen Queue-Top 75,28px bei Hero-Unterkante 65px.
- P2: Bild 29 zeigte abgeschnittene untere Handy-Menügruppen und eine horizontale Scrollleiste. Der Reset überschreibt nun auch die spezifische alte mobile Tabs-Regel; der gesamte Drawer scrollt. Bilder 34/35 zeigen alle dreizehn Einträge und das Profil mit der endgültigen gemeinsamen linken Ausrichtung einschließlich Sammlung. Normales Rad-Scrollen zum letzten Menüpunkt wird geprüft, unabhängig vom automatischen Scrollen eines Testklicks.
- P2: Frühe Animationsframes konnten einen negativen Rohstoff-Zwischenwert anzeigen. Der native Zählfortschritt ist auf 0 bis 1 begrenzt. Ein separater Test füttert frühe und spätere Framezeiten in die unveränderte native Animationsfunktion; die Gegenprobe entfernt nur die neue Untergrenze. Bestände und Produktionsrechnung wurden nicht geändert.

Frühe Aufnahmen 06–22 und Vergleiche 18–21 bleiben als Iterationsbelege im Evidenzordner; die finalen normalisierten Vergleiche sind 24–27. Die früheren Vergleiche werden nicht als abschließender Dichtenachweis verwendet.

## Bedienung und Prüfgrenzen

Manuell im Browser: Standortwahl, Menü öffnen/schließen, End-Taste zum unteren Menübereich, Sammlung und Verteidigung öffnen, Fokus im ausgewählten Panel, Statusfenster öffnen, Escape mit Fokus zum sichtbaren Einstieg, Status→Bauwarteschlange und sichtbarer Queue-Titel. Browserkonsole: keine Fehler.

Automatisch: alle nativen Bereiche über mehrere Breiten von 320 bis 1900px, echte Trefferflächen, Badges, Tastaturfokus/Tab/Escape, Drawer-Scrollen, Chat über Navigation, Tagesaufgaben und Kennzahlen, eigene Planeten und Monde, Namen in Deutsch/Englisch, native Bauaktionen, globale Zähler, zweites Flottenband/Karten-/Abschnittssprünge und sichere PWA-Ränder. Die Gegenproben sind Teil der zusätzlichen PR-Prüfung. Die vollständige Spielprüfung folgt vor Versionsvergabe und Veröffentlichung; diese visuelle Prüfung behauptet deren Ergebnis nicht.

Keine offenen P0/P1/P2-Befunde in der finalen sichtbaren Komposition oder den geprüften Bedienwegen. Zusätzliche native Texte, kleinere Originalmodelle, originale Icons/Logo und die laufenden Daten sind erwartete Anpassungen an das bestehende Spiel. Keine offene Designentscheidung für die Umsetzung.

final result: passed
