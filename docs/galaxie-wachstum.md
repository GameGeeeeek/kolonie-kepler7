# Galaxie-Wachstum: Basis, Startschub, Wochensysteme, Gürtel

Stand 02.09.2026. Konzept und Messwerte zu der Frage, wie die Galaxie größer wird und was dabei
nicht wandern darf. Die Mechanik steht in `weltraum_kolonie.html` (Abschnitte „Wöchentlich
wachsende Galaxie" und „Startschub") und in `server.js` (`SYSTEM_COORDS`, `SCHUB_COORDS`,
`weeklySystemCoord`, `astGuertelSysteme`).

## 1. Drei Schichten im Array

| Schicht | Zahl | Herkunft | Position |
|---|---|---|---|
| Basissysteme | 69 (2 versteckt) | fest eingetragen (`STAR_SYSTEMS`, `SYSTEM_COORDS`) | gx/gy von Hand |
| Startschub | 30 | feste Tabelle (`SCHUB_SYSTEMS`, `SCHUB_COORDS`), seit 02.09.2026 | gx/gy einmalig erzeugt, in den acht Sektoren |
| Wochensysteme | 2 je Montag, Deckel 178 | Formel aus dem Wochen-Index (`sysw_<i>`) | Ring außen um die Basis |

Reihenfolge im Array: Basis, Schub, Wochen. Zusammen 277 = die Zahl der Spiralplätze
(`galaxySlotPositions`). Der Deckel der Wochensysteme sank deshalb von 208 auf 178 – ein Platz mehr
hieße, alle bestehenden Plätze neu zu entspannen, und das Versprechen „ein Systemplatz verschiebt
sich nie" (v8.299.1) gilt weiter. Die Spiralplätze tragen seit KB-4 nur noch die Nachbarpunkte
der offenen Systemebene; die Karte selbst zeichnet Sektoren nach gx/gy.

`BASE_STAR_SYSTEM_COUNT`, `BASE_PLANET_COUNT` und die Erfolge (Grenzgänger, Kompendium) zählen
weiter gegen die 69 Basissysteme. Schub- und Wochenplaneten tragen die Marken `schub` bzw.
`weekly`; `generierePlaneten` ist die eine Quelle für beide (5–10 Planeten, fester Startwert je
System, Namen eindeutig gegen alles Vorhandene).

## 2. Warum der Schub nicht einfach 30 weitere Wochensysteme sind

Auftrag: „ein paar im Kepler Kern, ein paar in Meridian Weiten usw." Wochensysteme liegen auf
einem Ring außerhalb aller Basissysteme (Radius 512 um die Galaxiemitte, Basis reicht bis 467) und
fallen damit immer in die Randsektoren. Der Schub wurde deshalb je Sektor gesetzt: Kandidaten auf
Ringen um das Sektorzentrum (Radien 38–108, goldener Winkel), Sektorzugehörigkeit über
`sektorVon` (nächstes Sektorzentrum), Mindestabstand 30 zu jedem Basis-, Schub- **und** allen 178
möglichen Wochensystemen; unter den zulässigen Kandidaten der mit dem kleinsten Radius, sofern
er 40 Einheiten Luft hat. Ergebnis: Kepler-Kern 5, Meridian-Weiten 5, Solmark und Pulsar 4,
Wispern, Obsidian, Ilyra, Randmarken 3; kleinster Abstand 33,8 (Median der Basis: 40,5).

Der Wochenring rechnet nur mit den Basissystemen (`baseStarSystems()` bzw.
`SYSTEM_COORDS.slice(0, BASE_SYSTEM_COUNT)`). Zählten die 30 mit, verschöbe sich der Ring – und
mit ihm die Koordinaten aller schon erzeugten Wochensysteme samt den Kolonien darauf.

## 3. Gemessen: die volle Galaxie kostet die Karte nichts

| | heute (81 sichtbar) | voll (275 sichtbar, +100 Wochen) |
|---|---|---|
| Neuaufbau der Übersicht bis zum nächsten Frame | 26–33 ms | 22–35 ms |
| Elemente im SVG | 230 | 618 |
| Bilder je Sekunde, Karte und Basis | 60 | 60 |
| JS-Heap | 21 MB | 22 MB |

Die Sektoransicht legt ihre Mitglieder sortiert in ein Raster; der Kepler-Kern trägt mit 20
Systemen fünf Spalten, ohne Überlappung (Bild im PR).

## 4. Gürtelsysteme: eingefroren und angeglichen

Zwei Befunde vom 02.09.2026, beide gemessen mit den Formeln aus beiden Repos:

1. **Frontend und Backend rechneten verschiedene Sätze.** Das 5×4-Raster war gleich, Hash und
   Seed nicht (`hashStringToFloat` + `kepler7-guertel-v1` hier, `astHash` + `kepler7-asteroiden-v1`
   dort). Nur 10 der 20 Systeme stimmten überein. `asteroidenImSystem` verlangt beides – lokale
   Auswahl UND Serverfeld –, also waren zehn Gürtel des Servers im Spiel unsichtbar, und zehn
   Systeme trugen einen Gürtelring ohne Feld dahinter.
2. **Der Satz wanderte mit jedem Wochensystem.** Das Raster liegt über der Bounding-Box aller
   Systeme; jedes Wochensystem verschiebt Box und Zellen. Backend-Formel: 12 → 14 Wochensysteme
   nahm `sysn_kelyra` den Gürtel (Montag 31.08.), bei 16 wechseln zwei weitere, bis zum Deckel
   12 von 20. Ein System, das den Gürtel verliert, nimmt Schürfrechte und stationierte Eskorten
   der Spieler mit ins Leere; das Feld bleibt als Waise in `db.shared`. Die 30 Schub-Systeme
   hätten `kepler` und `sys_xerxes_zone` verdrängt.

Entscheidung Sascha: einfrieren. Kandidaten sind in beiden Repos genau die 69 Basissysteme und
`sysw_0` bis `sysw_13` (Stand des Einfrierens); Schub- und spätere Wochensysteme nie. Das
Frontend rechnet mit einer Kopie der Backend-Formel (`guertelHash`, `GUERTEL_AUSWAHL_SEED`) und
übernimmt zusätzlich die Liste aus `/api/asteroid/field`, sobald sie da ist. Der eingefrorene
Satz (20, alphabetisch): abyss, kepler, nebel, orion, sys_corvus_weite, sys_halvar_weite,
sys_meridian_kern, sys_oort_schleuse, sys_xerxes_zone, sysw_1, sysw_10, sysw_11, sysw_12,
sysw_13, sysw_2, sysw_3, sysw_5, sysw_6, sysw_7, tiefsee. Früher verlorene Gürtel
(`sys_marek_schneise`, `sysn_ophiar` bei 10 → 12, `sysn_kelyra` bei 12 → 14) kommen nicht
zurück; ihre verwaisten Felder liegen noch in `db.shared` unter `asteroids:<sysId>`.

Der lokale `ASTEROID_SEED` bleibt für die Offline-Felder (Plätze, Sorten, Größen) unverändert.

## 5. Wächter

- `tests/test_startschub.js` (30): Tabelle, Sektorzugehörigkeit als Regel, Quoten, Mindestabstand
  gegen alle 178 Wochensysteme, Reihenfolge im Array, Deckel 178/277, Planeten deterministisch,
  Basiszahlen unberührt, eingefrorener Gürtelsatz, Hinweis einmal, Serverliste hat Vorrang (Paar
  vega/kepler). Gegenprobe gegen v8.624.0: 27 rot, 3 grün, identische Prüflisten.
- `tests/test_systemparitaet.js` (30): Schub-Tabelle beidseitig, Gürtelformel beidseitig über
  derselben Liste (69 + 30 + 20). Gegenprobe gegen altes Backend und altes Frontend: je 9 rot.
- `tests/test_wochensysteme.js`, `test_kartenposition.js`, `test_galaxiekarte.js`: an Deckel und
  Schub nachgezogen.
- Backend: `test_asteroidfeld_http` 1b2/1b3 (die 20 namentlich, kein Schub), `test_systemliste_http`
  (`syss_01`, `syss_30` bekannt).
