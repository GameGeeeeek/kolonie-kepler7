# Detaillierte Schiffsgrafiken

Die drei transparenten Bildatlanten enthalten eigene Motive für alle 46 vorhandenen Rumpfschlüssel. Materialstil und Kamerawinkel richten sich nach den bereits vorhandenen detaillierten Schiffsgrafiken. Die Rümpfe zeigen nach rechts; Kampf und Karten verwenden weiterhin ihre nativen Drehungen und Parteimarkierungen.

| Atlas | Motive | WebP-Größe |
| --- | ---: | ---: |
| `kepler-gfx-ship-atlas-regular` | 16 | 621.020 Bytes |
| `kepler-gfx-ship-atlas-utility` | 16 | 786.674 Bytes |
| `kepler-gfx-ship-atlas-advanced` | 14 | 686.292 Bytes |

PNG-Dateien sind die unveränderten Ergebnisse der integrierten Bildgenerierung. Die WebP-Dateien sind verlustfrei kodiert; ihre dekodierten RGBA-Pixel einschließlich Transparenz stimmen vollständig mit den PNGs überein. Beide Formate haben 1.254 × 1.254 Pixel. Es wurden keine Rumpfformen nachträglich durch Pixelbearbeitung verändert.

Die tatsächlich belegten Ausschnitte stehen zusammen mit SHA-256-Prüfsummen in [ship-art-package.json](ship-art-package.json). Die Ausschnitte berücksichtigen kleine Abweichungen innerhalb des generierten Rasters. Die Sichtbarkeitsprüfung verwendet einen Alphawert ab 8, damit unsichtbare Hintergrundreste den Ausschnitt nicht vergrößern. Zwischen benachbarten Motiven liegen geprüfte transparente Trennstreifen. Die letzten beiden Felder des erweiterten Atlasses bleiben leer.

Die Generierung und die anschließenden Änderungen an Platzierung und Freiräumen sind in [ship-art-prompts.json](ship-art-prompts.json) dokumentiert. Verwendet wurde ausschließlich die integrierte Bildgenerierung.

Die Laufzeit nutzt eingebettete Ausschnitte und URLs mit Inhaltsprüfsumme. Sichtbare Verbraucher laden einen gemeinsamen Atlas zuerst als WebP und bei Lade- oder Dekodierfehlern als PNG. Solange kein Bild verfügbar ist, bleibt der vorhandene gezeichnete Rumpf sichtbar. Die bestehenden Einzelbilder bleiben im Paket enthalten.
