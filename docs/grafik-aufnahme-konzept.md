# Grafik-Aufnahme „Kepler-7 in neuem Licht" (September 2026)

Am 04./05.09.2026 wurde jede gezeichnete Grafik des Spiels fotografiert (185 Aufnahmen, Desktop und
Handy), benotet und für 15 Kandidaten je zwei Entwürfe gerendert; 18 kleinere Dinge kamen ohne
Entwurf auf die Liste. Der Bericht dazu ist ein Claude-Artefakt („Kepler-7 in neuem Licht"), die
Entwurfsdateien lagen im Sitzungs-Scratchpad und sind nicht Teil des Repos: Was übernommen wurde,
steht als Code in der Spieldatei und als Regel in einem Wächtertest.

Die Umsetzung lief zunächst als Reihe **GR-9 bis GR-24** mit je einem Release. Ab dem 05.09.2026
sind die verbliebenen Etappen zu **sechs Bündeln A bis F** zusammengefasst (Absprache Sascha): Jede
Etappe braucht einen vollen Prüflauf von rund 35 Minuten, und Etappen, die dieselbe Ansicht
betreffen, teilen sich einen. Reihenfolge weiterhin nach Abhängigkeit: erst die Grundstoffe
(Texturen, Sonnen, Rümpfe), dann das, was darauf aufbaut (Planetenboden der Wiedergabe,
Banner-Planet, Gefechtsbild der Landeseite).

Grundsätze, die für alle Etappen gelten:

- **Einmal zeichnen, dann cachen.** Jede Grafik entsteht einmal je Typ (Atlas, Data-URL oder
  Canvas-Cache), nie je Instanz und nie je Frame.
- **Kein Zufall im Bild.** Alle Generatoren sind deterministisch (Hash aus Seed und Koordinate);
  zwei Sitzungen zeigen dieselbe Welt.
- **Schnittstellen bleiben.** Konsumenten lesen Breite/Höhe vom Bild, nie aus einer Zahl im Kopf.
- **Jede Etappe bekommt einen Wächter mit Gegenprobe** (grün am neuen, rot am alten Stand, gemessene
  Pflichtliste im Testkopf).

## GR-9: Vier Fehler und Einzeiler (05.09.2026)

Wappen-Riesenhelm, Gürtelplatz 5 auf Aion, ortTyp der Wiedergabe, Wracks aus dem Atlas, Banner am
Handy, Nebel-Deckkraft, Orbitringe. Beschrieben in `sektorkarte-konzept.md`, Abschnitt „GR-9".
Wächter: `tests/test_grafik_einzeiler.js`.

## GR-10: Planeten-Texturen aller 13 Weltentypen (05.09.2026)

**Befund der Aufnahme.** Der alte Zeichner (`buildPlanetTexture`, 90×45) ließ die Rauschkoordinate
mit der Zeile wandern (`rowShiftX`/`rowShiftY`). Ergebnis: alle zehn Typen trugen dasselbe
V-Schlierenmuster und unterschieden sich nur in der Farbrampe. `mond`, `erdwelt` und `leerenwelt`
hatten gar keinen Builder und fielen still auf die Erdtextur zurück (Byte für Byte identisch).
Angezeigt werden bis 82 Gerätepixel (Desktop, DPR 2) bzw. 78 (Handy, DPR 3); der 45er-Ausschnitt
wurde also 1,3- bis 1,8-fach hochskaliert.

**Was gebaut ist** (Block `PLANET_TEXTUR_B` … `PLANET_TEXTURE_CACHE` in der Spieldatei):

- Rauschen auf **Kugelkoordinaten**: Längen-/Breitengrad → Punkt der Einheitskugel → 3D-Wertrauschen
  (`makeNoise3D`, `fbm3`, `ridge3`, `makeCell3D`). Der Streifen ist an der Naht x=0/x=B nahtlos,
  das V-Muster ist weg.
- Jeder Typ liefert **Albedo und Höhe**; `buildPlanetStrip` schattiert das Höhenfeld mit festem Licht
  von oben links (passt zum Rand- und Kantenlicht in `drawPlanetMiniIcon`) und legt optional Wolken
  darüber.
- **13 Builder mit eigener Geologie:** erdaehnlich (Kontinente, Küstenlinie, Eiskappen, Wolken),
  erdwelt (grüner, mehr Land), wasserwelt (Inseln), wueste (Dünenbänder), eis (Eisschild mit
  Rissen), vulkan (Lavaadern aus Grat-Rauschen), kristall (Zellrauschen-Facetten), gasriese (Bänder
  mit Sturm), asteroid (Krater mit Wall als Höhenprofil), mond (Maria und Krater), todeswelt
  (Narben, Einschlag), super (Aurora), leerenwelt (Leuchtadern im Violett).
- **128×64** statt 90×45. Gemessen 267–274 ms für alle 13 Streifen zusammen, einmal je Typ.
- Schnittstelle unverändert: `PLANET_TEXTURE_BUILDERS[typ]()` liefert einen 2:1-Canvas-Streifen,
  `getPlanetTexture` cacht, `drawPlanetMiniIcon` (Planetenliste, Kolonieliste) und
  `getPlanetTextureDataUrl` (Systemebene der Karte, quadratischer Mittelausschnitt = Streifenhöhe)
  lesen Breite und Höhe vom Streifen.

**Wächter:** `tests/test_planeten_texturen.js`. Er schneidet den Block aus der Spieldatei und führt ihn
in einer leeren Seite aus (der Block ist absichtlich in sich geschlossen) und prüft Regeln, nicht
Bilder: 13 Builder, jeder Typ aus `PLANET_TYPE_INFO` und `TERRAFORM_TARGET_TYPES` hat einen, 128×64,
deckend, nicht flach, nahtlos, die drei früheren Doppelgänger unterscheiden sich von der Erde,
deterministisch, unter 4 s. Dazu die beiden Einstiegspunkte im Spiel (Miniaturen der Planetenliste
gezeichnet, Systemkarte bettet 64×64 ein). Gegenprobe am alten Stand: 6 von 19 fallen.

**Was darauf aufbaut:** GR-17 (Banner-Planet) und GR-18 (Planetenboden der Kampf-Wiedergabe) lesen
dieselben Streifen über `getPlanetTexture`.

## Bündel A: Himmelskörper (05.09.2026, v8.685.0)

Planeten-Texturen aller 13 Weltentypen (siehe GR-10 oben, dort ausführlich), dazu die Sonnen:
sechs Sterntypen bekamen im Sektorknoten eine eigene Form statt nur Farbe und Radius, und der
Systemkern eine Oberfläche mit Randverdunklung statt einer einfarbigen Scheibe mit weißem Ring.
Wächter: `tests/test_planeten_texturen.js` (20) und `tests/test_sonnen.js` (33).

**Ein Fehler, der still blieb:** Beim Umbau der Sonnenbilder ersetzte ein Präfix-Lauf auch Namen
innerhalb von Template-Literalen - `sonneRgba` lieferte danach die Zeichenkette `'sonneRgba(...)'`.
Alle sechs Sonnenbilder scheiterten, und der Rückfall auf die alte Scheibe verdeckte es. Prüfung 2a
fordert seither ausdrücklich **ein Bild je Typ**, statt nur zu prüfen, dass gezeichnet wurde.

## Bündel B: Kampf-Wiedergabe (05.09.2026, v8.687.0)

Schiffsrümpfe, Planetenboden und Boss-Gestalten - drei Entwürfe derselben Ansicht.

- **Rümpfe:** Die 62-%-Einfärbung im Mischmodus `color` machte aus jedem Schiff eine Farbfläche.
  Jetzt tragen alle Rümpfe dasselbe Stahlgrau (`GEFECHT_STAHL`), und die Partei sitzt an
  Leuchtkante, Kennungsstreifen und Triebwerksglut. Dazu ein gemeinsames Lichtmodell.
- **Boden:** Der Planet unter dem Gefecht zeigt die Textur aus Bündel A (`getPlanetTexture`), der
  Atmosphärensaum hat die Farbe des Ortstyps statt immer Lila, und Stadtlichter gibt es nur noch,
  wo jemand wohnt und wo es eine feste Oberfläche gibt.
- **Bosse:** Füllung mit Masse, Lichtseite und einem Kern, dessen Glut am Zustand hängt. Die
  Silhouetten blieben unverändert.

Wächter: `tests/test_schiffsruempfe.js` (11), Erweiterungen in `test_kampfort_optik.js` und
`test_bosssilhouette.js`.

**Die Lehre aus diesem Bündel:** Ein erster Entwurf der Prüfung 1c war **trivial grün** - er verglich
Pixelkoordinaten verschieden großer Atlanten. Eine Prüfung, die aus dem falschen Grund grün ist, ist
so schlecht wie eine rote. Und: zwei Befunde der adversarischen Durchsicht, die ich zunächst
gekippt hatte, erwiesen sich beim Nachmessen als richtig. Ein gekippter Befund ist eine
Wahrscheinlichkeitsaussage, kein Freispruch.

## Bündel C: Isometrische Bausätze (05.09.2026)

**Befund der Aufnahme.** Die Verteidigung hatte 21 Canvas-Anlagen, alle auf demselben flachen
Graustahl-Trapez; das Bauwerk belegte die obere Hälfte, die Familienfarbe hing als kleiner Glow
daran, und der Ausbaustand kam im Bild nicht vor (Lv. 6 sah aus wie Lv. 0). Zwei Anlagen
(`resonanzschild`, `signaturscanner`) fehlten ganz und zeigten ein 42-px-Schloss. Der Basis-Reiter,
die Startseite des Spiels, trug 24-px-Piktogramme in 42er-Kacheln, und **17 von 30 Karten zeigten
nur ein graues Tabler-Schloss** - die halbe Startseite war bildlos. Beide Reiter sprachen außerdem
zwei Bildsprachen.

**Was gebaut ist** (Block `ANLAGE_FAMILIE` … `refreshBuildingIcons` in der Spieldatei):

- **Eine** Werkzeugkiste für beide Bausätze: `isoWerkzeug(c, S, T)` liefert Projektion
  (Dreiviertel-Isometrie, feste Faktoren 0,866/0,5), Lichtmodell (Hauptlicht oben links, +y-Flanke
  halb, +x-Flanke im Kernschatten mit kaltem Gegenlichtsaum, Schlagschatten nach rechts unten auf
  die Platte geclippt) und die Grundkörper (Prisma, Quader, Zylinder, Kuppel, Kugel, Rohr, Ring,
  Kegel, Kristall, Panel, Sägezahndach, Halle, Leuchten, Fensterreihen, Energiewand). Die
  Entwürfe trugen diese Werkzeuge zweimal; der Einbau hat sie zusammengelegt - **156 von 156
  Bildern kamen danach pixelgleich heraus**, die Zusammenlegung ist also verlustfrei.
- `zeichneAnlage` (23 Schlüssel) und `zeichneGebaeude` (29 Schlüssel) enthalten nur noch die
  Bauwerke. Die Familie trägt Platte und Kanten (Geschütze Amber, Schilde Blau, Sensoren Mint,
  Massivbau Grau mit Amber-Kante; Produktion Gold, Lager Grau, Forschung Lila, Fabriken Info-Blau,
  Siedlung Mint), das Motiv trägt die Leuchtfarbe aus `BUILDING_DEFS.fg` - **gelesen, nicht
  abgeschrieben**, sonst laufen Kachel und Karte auseinander.
- **Drei Ausbaustände** je Bauwerk, relativ zur Höchststufe des Gebäudes. Absolute Schwellen
  hätten den Abhorchposten (maxLevel 4) für immer auf Stand 0 stehen lassen.
- **Kein Zeit-Parameter mehr.** Das alte Bild war ein zufälliger Frame einer nie laufenden
  Animation (das Raketensilo mal mit, mal ohne Rakete). Jetzt: Rakete im Silo, Mündungen dunkel,
  Glut auf Maximum - und zwei Aufrufe liefern dasselbe Bild.
- **Cache als Offscreen-Canvas** je (Bausatz, Schlüssel, Stand, Kantenlänge), nicht als data-URL:
  ein `<img>` lädt asynchron, der erste Aufbau der Kachel bliebe leer.
- `buildingIconHtml` gibt jetzt für **jedes** Gebäude die große `.bicon-def`-Kachel aus; gesperrte
  Karten zeigen dieselbe Grafik entsättigt mit Schloss-Abzeichen. Das nackte Schloss ist weg.
- `refreshBuildingIcons` findet die Kacheln über die Markierung `data-bicon` statt über eine
  Schlüsselliste - so trifft sie genau das, was der letzte Rebuild geschrieben hat.

**Was dabei entfallen ist, und warum.** Die Tabelle `SCHWENK` drehte in der Kampf-Wiedergabe den
Aufsatz dreier Anlagen, indem das gebackene Bild an einer waagerechten Linie geteilt und die obere
Hälfte gekippt wurde. Mit der neuen Sockelplatte geht das nicht mehr: ihre **hintere Ecke liegt bei
Bildanteil y = 0,368**, höher als der Fuß jedes Aufsatzes (Turmkuppel 0,56, Flak-Kranz 0,51) und
sogar höher als die Mündung des Turmrohrs (0,42). Jede waagerechte Trennlinie nimmt deshalb ein
Stück Platte mit, das sichtbar mitkippt - gemessen und als Bild belegt. Die Ausrichtung bleibt über
Mündungsblitz und Schussursprung sichtbar, nur das Rohr steht fest. Wer die Drehung zurückhaben
will, braucht ein zweites gebackenes Bild je Anlage **ohne** den Aufsatz; ein waagerechter Schnitt
reicht nicht.

**Eine Regel hat sich umgedreht.** `test_iconabdeckung` hielt fest: „ein SVG für einen
Canvas-Schlüssel wäre toter Code, weil die Kachel die Grafik zuerst nimmt". Das galt, solange die
Kachel der einzige Ort war. Jetzt haben alle Gebäude eine Canvas-Grafik, und die Regel würde
verlangen, dass man handgezeichnete SVGs wegwirft. An ihre Stelle tritt die stärkere Prüfung
**jedes Gebäude hat ein gezeichnetes Bauwerk**; die SVGs bleiben als Kleinformat-Vorrat für
`iconHtmlFor` stehen. Was von der alten Regel bleibt: kein Offizier-, Modul-, Doktrin- oder
Aufstellungsschlüssel darf in einem der Bausätze stehen.

**Wächter:** `tests/test_bausaetze.js`, 22 Prüfungen. Abschnitt 1 schneidet die Maschine aus der
Spieldatei und führt sie isoliert aus: 156 Bilder ohne Zeichenfehler, jedes trägt ein Bauwerk,
jeder Ausbaustand ist im Bild zu sehen (Anteil geänderter Pixel, nicht Flächenzuwachs - sonst
fielen die Bauwerke durch, deren Anbau innerhalb der Silhouette sitzt), nichts stößt deckend an den
Bildrand, zwei Aufrufe liefern dasselbe Bild. Abschnitt 2 misst im **echten Basis-Reiter**: alle 29
Karten tragen die große Kachel, keine bleibt leer, keine zeigt nur ein Schloss, gesperrte tragen
Bauwerk und Abzeichen. Gegenprobe am alten Stand: 10 von 12 dort laufenden Prüfungen fallen.

**Beim Einbau nachgebessert.** Prüfung 1d fand sieben Bauwerke, deren Ausbaustand unter 1,5 % der
Bildpixel änderte - bei 64 Pixeln praktisch unsichtbar. Betroffen: `railgun`, `mondschild`,
`abhorchposten`, `nanolegierungsfabrik`, `fusionsschmiede`, `metamaterialweberei`, `botschaft`.
Sie haben jetzt echte Anbauten statt nur einer Leuchtlinie oder eines zweiten Schlots. Genau diese
Schwäche hatte die Selbstkritik des Entwurfs vorhergesagt; der Wächter hat sie messbar gemacht.
