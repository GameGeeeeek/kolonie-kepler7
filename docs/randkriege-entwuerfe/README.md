# Entwurfsbilder zu „Die Randkriege"

Vier Bilder zum Entwurf in [`../randkriege-konzept.md`](../randkriege-konzept.md). Erzeugt mit:

```
node docs/randkriege-entwuerfe/bilder.js
```

Abhängigkeit ist nur das, was das Repo ohnehin hat (`tests/lib/umgebung.js` → Playwright).
`--nur-html` lässt den Browser weg und schreibt nur die HTML-Seiten.

| Datei | Was | Größe |
|---|---|---|
| `m4_front.js` | Frontkarte – Fraktionsflächen, Frontsegmente, Kontrollbalken je System | 1180 × 667 |
| `m5_kriegsraum.js` | Kriegsraum – Abschnitte, Handlungen, Tagesdegression, Dienstgrade, Wochendeckel | 1180 × 1122 |
| `m6_wappen.js` | Symbolfamilie `facw_*` – vier Wappen, sechs Dienstgrade, Frontmarke, Größenprobe | 1180 × 1086 |
| `m7_handy.js` | Handy bei 390 px – die Briefkastenfläche als Frontleiste | 900 × 620 |

Gemeinsame Bausteine: `positionen.js` (Kartenpositionen), `front_daten.js` (Frontzustand),
`wappen.js` (die elf Symbole).

**Die PNGs liegen absichtlich nicht im Repo** – zusammen 2,8 MB, und aus diesen Skripten
jederzeit wiederherstellbar. Eine Quelle statt zweier Stände, die auseinanderlaufen können.

## Warum die Positionen aus der Spieldatei gezogen und nicht nachgebaut werden

`positionen.js` schneidet `STAR_SYSTEMS`, `hashStringToFloat`, `SUN_TYPES`, `sunTypeFor`,
`galaxySlotPositions`, `galaxyRelax`, `galaxyNodeScale` und `galaxyFillRatio` als **Quelltext**
aus `weltraum_kolonie.html` heraus und führt sie aus. Kein Nachbau, keine abgeschriebenen Zahlen.

Der Entwurf verlangt in Abschnitt 5.2 ausdrücklich Frontsegmente aus **Bildschirmabständen** und
nicht aus `gx/gy` – das lässt sich nur beantworten, wenn man die echten Bildschirmpositionen hat.
Ein Bild, das mit erfundenen Koordinaten arbeitet, hätte genau die Frage nicht beantwortet, für
die es gemacht wurde. Nebeneffekt: Ändert jemand die Spiralverteilung, ändern sich die Entwürfe
beim nächsten Lauf mit, statt still zu veralten.

## Was das Rendern am Entwurf korrigiert hat

Sechs Dinge sahen auf dem Papier richtig aus und im Bild falsch. Sie stehen hier, weil sie beim
Bauen wieder auftreten werden:

1. **Der Kartenausschnitt.** Das Spiralfeld hält Platz für alle 277 künftigen Systeme frei; die
   heutigen 69 saßen in der vollen 950 × 500-Fläche als Fleck in der Mitte. Die Frontkarte
   braucht denselben zugeschnittenen Ausschnitt, den das Spiel über `galaxyFillRatio()` schon
   für den Startausschnitt bildet.
2. **Fünf Frontsysteme dicht beieinander sind keine Front.** Die naheliegende Auswahl – die fünf
   engsten Paare – legte alle fünf an dieselbe Stelle der Naht. Erst die Aufteilung in fünf
   **Radiusbänder** spannt den Abschnitt vom Kern bis zum Rand.
3. **Es gibt keine lange Frontlinie.** Vier Gebiete als Viertel eines schmalen Rings haben
   radiale Nähte; gemessen sind sie rund 90 Bildpunkte lang (Kern bei Radius 75, äußerstes
   System bei 120). Jeder Versuch, daraus eine durchgehende Linie zu ziehen, hat sie ins eigene
   Gebiet gebogen. Was es gibt, sind **Berührungen** – und die zeigt jetzt eine Postenkette aus
   Riegeln quer zur Verbindung, je heller und länger, je enger das Paar steht.
4. **Beschriftungen brauchen einen eigenen Entzerrungsdurchgang.** Knoten liegen 24 px
   auseinander (`GALAXY_MIN_NODE_DIST`), ein Block aus Name, Balken und Zahl ist rund 60 × 24 px
   groß. Ohne Auseinanderschieben – nach demselben Verfahren wie `galaxyRelax()` – liegen sie
   übereinander. Zwei Fallen dabei: Der Kasten muss die **tatsächliche** Ausdehnung des Blocks
   beschreiben (nicht um den Ankerpunkt zentriert), und seine Breite kommt aus der **breitesten
   Zeile** – die Zahlenzeile „812 +9/Tag · du 62" ist fast doppelt so breit wie der Systemname.
5. **Die Front gehört über die Knoten, nicht darunter.** Unter den Leuchthöfen gezeichnet
   verschwand sie; die Höfe sind bis zu 17 px groß und decken die Grenze zu.
6. **Ein Wappen, das nur groß funktioniert, taugt nicht.** Auf der Karte steht es bei 13 px. Die
   Größenprobe in `m6_wappen.js` ist deshalb kein Beiwerk – sie hat zwei Zeichnungen verworfen,
   die groß gut aussahen: der Void-Riss las sich als Schild *mit* einem Sprung statt als Schild,
   der den Riss *ist*, und die Legions-Standarte sah wie eine Lampe aus, bis das Banner unten
   gekerbt statt zulaufend war.
