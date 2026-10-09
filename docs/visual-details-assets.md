# Weitere Spieloptik – 9. Oktober 2026

Alle neun Bereiche der Grafikprüfung erhalten die gemeinsame dunkelblaue Metallpalette: Orbitalstation/Terraforming, Schiffskatalog, Expeditionen, Markt/Modulschmiede, Forschung, Flaggschiff/Offiziere, Einstellungen, Hilfe/Leerzustände und Gegnerinformationen.

Die vier neuen PNG-Atlanten wurden mit dem eingebauten `image_gen` erzeugt, anschließend visuell geprüft und unverändert ins Repository kopiert. Originale bleiben im Codex-Bildverzeichnis erhalten. Die Anwendung wählt einzelne quadratische Motive über CSS-Hintergrundpositionen; keine zugeschnittenen Kopien und keine zusätzlichen Bildanfragen je Kachel.

| Datei | Raster | Motive in Leserichtung |
|---|---|---|
| `kepler-gfx-orbital-atlas.png` | 2 × 2 | Verteidigung, Produktion, Dock, Signal |
| `kepler-gfx-world-atlas.png` | 2 × 2 | Todeswelt, Leerenwelt, Erdwelt, Wasserwelt |
| `kepler-gfx-expedition-atlas.png` | 3 × 2 | Kurz, Standard, Tiefenraum, Bergung, Forschung, Schürfen |
| `kepler-gfx-flagship-atlas.png` | 3 × 1 | Grundmotiv, Ausbau ab der Hälfte der maximalen Stufe, maximale Stufe |

## Verwendete Bildaufträge

Gemeinsame Vorgabe: detaillierte realistische Weltraumstrategie, dunkles Marineblau, Stahl/Gunmetal, kühle Cyan-Kantenbeleuchtung, kleine bernsteinfarbene Fenster, gleiche Bildfamilie wie Kolonie und Werft. Keine Schrift, Ziffern, Wasserzeichen, Benutzeroberfläche oder Beschriftungen; vollständige Motive innerhalb gleich großer Rasterzellen ohne Zwischenräume.

- **Orbitalstationen:** Ein quadratischer Atlas aus vier eigenständigen Ringstationen in Dreiviertelansicht über einem Planetenrand. Blau beleuchteter Verteidigungsring mit gepanzerten Bastionen und Geschützen; bernsteinfarbener Produktionsring mit Solarflächen, Reaktoren und Fabriken; türkisfarbener Dockring mit offenen Liegeplätzen, Kränen und kleinen angedockten Schiffen; violetter Signalring mit Antennen, Masten und Kommunikationsringen. Unterschiede ausdrücklich in der Bauform, nicht nur der Farbe.
- **Planeten:** Ein quadratischer Atlas mit vier vollständig sichtbaren Kugeln vor Sternenfeldern. Verbrannte graubraune Todeswelt mit Kratern, Rissen und schwachen roten Spalten; dunkle Obsidian-Leerenwelt mit violetten Adern und Halo; grüne gemäßigte Erdwelt mit Kontinenten, Meer und weißen Wolken; überwiegend saphirblaue Wasserwelt mit wenigen Inseln, Wolkenwirbeln und türkisfarbenen Küsten.
- **Expeditionen:** Ein Atlas im Verhältnis 3:2 aus sechs quadratischen Szenen. Kleiner Scout neben einem nahen blauen Planeten und Navigationssignal; zwei Erkundungsschiffe im Asteroidenkorridor; einsamer Kreuzer vor großem violettem Nebel und dunkler Ringanomalie; Bergungsschiffe mit Greifarmen an Wrack und Frachtkisten; Wissenschaftsschiff mit leuchtenden Sensoren und Sonde an einer violetten Anomalie; Bergbauschiff an einem Asteroiden mit goldenen Mineraladern und Erzcontainern. Motive anhand ihrer Objekte und Umgebung unterscheidbar.
- **Flaggschiff:** Ein Atlas im Verhältnis 3:1, dreimal dasselbe einzigartige Kapitalschiff in gleicher Dreiviertelansicht. Langer kantiger Stahlrumpf mit Mittelspine, zwei breiten Schulterrümpfen, Kommandoturm, violetten Kommandolichtern, Cyan-Triebwerken und kleinen bernsteinfarbenen Fenstern. Grundmotiv mit kompakter Panzerung und wenigen Geschützen; Ausbau mit zusätzlicher Panzerung, Schulterstrukturen und Geschützbänken; Maximum mit geschichteter Panzerung, größerem Turm, weiteren Triebwerken und violetten Schildprojektoren.

## Verhalten und Prüfung

Bestehende Bau-, Kauf-, Freischaltungs-, Forschungs-, Kampf- und Terraformingregeln bleiben die Datenquelle. Forschungsgruppen verwenden die vorhandenen Meilenstein-Familien und zeigen jede Definition genau einmal. Schiffsbilder greifen bei aktivem Allianz-Anstrich auf den nativen Renderer zurück. Laufende und wartende Orbitalaufträge lesen ihren tatsächlichen Fokus aus `job.key`.

`tests/test_visual_details.js` prüft mit 67 Kontrollen native Aktionen, Bildzuordnung, vollständige Kataloge, gesperrte Avatare, Tastaturfokus, tatsächliche Stufen und Größen bei 320/390/760/1487 px. Sieben kontrollierte Gegenbeispiele betreffen Tippziele, Missionsmotive, fehlende Forschung, Hilfefokus, Orbitalbreiten, die Scrollposition im Schiffskatalog und englische Rollenbeschriftungen. Die vorhandenen Werft-, Wischleisten-, Hilfe- und Grafikprüfungen bleiben erhalten.

Die adversarische Durchsicht hat insbesondere native Handler, seltene Zusatzkosten, Auswahl während eines anderen Terraformingauftrags, Beschreibungen, Cache-Signaturen, englische Beschriftungen und Allianz-Anstriche geprüft. Bestätigte Befunde: zu enge Orbitalraster durch alte Scrollkartenbreiten, Fokusverlust nach dem Neurendern eines Hilfethemas und verlorene Scrollposition/Fokus bei Auswahl eines entfernten Schiffs. Alle korrigiert und durch Verhaltenstests mit Gegenproben abgesichert; die Werft erhält horizontale und vertikale Position auch bei Bestandsänderungen.

Die Atlanten ergänzen zusammen ungefähr 12 MB PNG-Daten. Sie verwenden die vorhandene Bildfamilie und werden beim Aufrufen der jeweiligen Ansichten vom Browser zwischengespeichert. Bestehende Planeten-, Schiffs-, Modul- und Offiziersbilder werden wiederverwendet.

Die vorhandenen Zahlenformat- und Gegnerlageprüfungen lesen die neu getrennten Gegnerfelder, weiterhin mit Unterstützung für historische Vergleichsstände. Zusätzliche Gegenproben bestätigen, dass Rohzahlen statt Kurzschreibweise und eine vom Kartenweg abweichende Erfolgschance tatsächlich erkannt werden.

Der englische Grafiktest fand unübersetzte Rollen im erweiterten Schiffskatalog: `shipRoleInfo` liefert temporäre Objekte, daher ist `k7View` dort nicht der passende Übersetzungsweg. Die Beschriftung verwendet nun `k7t` und den vorhandenen Wortschatz; alle Schiffsklassen werden nach einem echten Sprachwechsel geprüft.
