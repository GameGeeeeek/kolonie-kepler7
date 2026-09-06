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

## Bündel D: Alien-Nester als Brutkörper (06.09.2026, v8.691.0)

**Befund der Aufnahme.** Der Kartenmarker war ein dunkler Kreis mit sechs Punkten in Volksfarbe auf
einem leicht versetzten Radius - er las sich als Blume, nicht als Nest. Die fünf Stufen
unterschieden sich nur im Radius (11 bzw. 15 Einheiten) und im Namen, die vier Völker nur in der
Farbe; die Königin bekam einen weißen Punkt in die Mitte. Am Handy blieben davon 20 Pixel mit ein
paar Punkten. Neben der gerenderten Vorposten-Station wirkte das wie ein Platzhalter.

**Was gebaut ist** (Block `NEST_BILD` … `nestBildUrl` in der Spieldatei):

- Ein organischer Brutkörper je (Volk, Stufe): polare Grundform mit Streckung und Kippung,
  Randtabelle über 720 Winkelschritte, Beleuchtung mit Hauptlicht und Gegenlicht, halbdurchsichtige
  Brutblasen mit Innenleuchten, Ausläufer mit dunkler Wurzel und hellem Ende.
- **Je Volk ein eigenes Formmerkmal**, damit man es ohne Beschriftung erkennt: Kryll viele kleine
  Blasen, Xantheer segmentierte Haut mit dunklen Nähten, Vex ein länglicher Tropfen mit Schweif,
  die Verglühten glimmende Risse. Die Königin bekommt einen leuchtenden Schlund, einen
  Tentakelkranz und einen Sporenschleier.
- **Kein Zufall zur Laufzeit:** der Formgenerator hängt an einem Seed aus Volk und Stufe.
- Gecacht als data-URL je (Volk, Stufe); gemessen 15-29 kB je Bild, Ziel waren unter 40.
- Die Volksfarbe kommt über `nestVolk` aus `ALIEN_VOELKER` - **keine zweite Tabelle**.
- Hof-Ring, Lebensbalken und Beschriftung bleiben; der dunkle Grundkreis entfällt, wo ein Bild
  steht (der Körper überragt ihn je nach Volk).

**Drei Dinge, die der Entwurf nicht mitbrachte und die beim Einbau gemessen wurden:**

1. **Der Körper wuchs mit der Stufe** (Faktor 0,70 bis 1,16) - auf Stufe 1 war er am Handy nur
   15 statt der geforderten 20 Pixel. Der Kernradius steht im Spiel aber fest (r = 11, Königin 15).
   Die Reihe ist auf 0,92 bis 1,16 angehoben; das Wachstum trägt die Zahl der Blasen und
   Ausläufer, nicht die Körpergröße. Gemessen: deckende Fläche auf Stufe 1 plus 73 %.
2. **Lebensbalken und Beschriftung** saßen am alten Kernradius, das Bild reicht bis 1,5 r - der
   Balken lief quer durch den Körper. Im Foto gesehen, nicht im Test.
3. **Der Nachbartest `test_kartenbeschriftung` fand die Folge davon:** mit dem Bezug auf die
   Bildkante saßen Balken und Text eine halbe Kachelbreite zu weit außen und kollidierten mit den
   Nachbarmarkern. Zwei Auswege wurden gemessen und verworfen - eine kleinere Messfläche für den
   Entflechter ließ Text auf dem sichtbaren Bild zu, ein größerer Markerabstand (`sichtR` 2,4)
   drückte „Draconis" auf die Heimatscheibe. Der richtige Bezug ist der **Körper** (1,32 r;
   gemessen reicht der höchste bis 1,28 r), nicht die quadratische Kachel.

**Wächter:** `tests/test_nestkoerper.js`, 22 Prüfungen. Abschnitt 1 schneidet den Zeichner aus der
Spieldatei und führt ihn isoliert aus: 20 Bilder ohne Fehler, jedes trägt einen Körper, der Körper
füllt die Kachel auf jeder Stufe, nichts stößt deckend an den Rand, zwei Aufrufe liefern dasselbe
Bild, keine data-URL über 40 kB. Abschnitt 2 misst auf der **echten Karte**: beide Nester tragen
ein Bild, es ist auf dem Schirm zu sehen, die Bilder unterscheiden sich, die Punkteblume ist weg,
und Balken wie Beschriftung liegen nicht auf dem Körper. Gegenprobe am alten Stand: 9 von 11 dort
laufenden Prüfungen fallen.

**Die Prüfung, die die Reihe trägt, ist 1f:** Unterscheiden sich die Völker in *Form und Haut* -
oder nur in der Farbe? Verglichen wird eine farbnormierte Helligkeitsrasterung. Gemessener Bereich
über alle 18 Paarungen: **26 bis 78** von 256 Feldern. Die Kontrolle daneben rendert **dieselbe
Form in fremder Farbe** und misst dort nur 3 bis 5 Felder - Faktor fünf, und darauf beruht die
Aussagekraft. Ein erster Anlauf dieser Kontrolle verglich dasselbe Objekt mit sich selbst; das ist
für jede Eingabe 0 und hätte auch eine Rasterung durchgehen lassen, die schlicht die Farbe misst.

**Zweimal in dieser Reihe habe ich eine Schwelle geraten statt gemessen** (1f hier, 1d in Bündel C).
Beide Male stand die Zahl danach im Testkopf. Die Regel steht in `CLAUDE.md` - sie gilt auch für
die eigene Prüfung, nicht nur für den Erwartungswert des Spiels.

## Bündel E: Landeseite (06.09.2026, v8.692.0)

**Befund der Aufnahme.** Der Himmel (`#llSky`) war ein Ring aus 3400 gleichförmigen Punkten mit
gelbem Kernklecks, jeden Frame aus Einzelpfaden neu gezeichnet. Der Kern lag am Desktop bei
y = 0,90 H, also unter der Live-Leiste; die oberen 80 % des Bildschirms waren schwarze Leere, weil
die 26 Staubwolken bei 9-16 % Deckkraft unsichtbar blieben. Das Gefechtsbild daneben zeigte sieben
18x10-Pfeildreiecke an einem pulsierenden Klecks - es bewarb das Kernfeature des Spiels und zeigte
davon nichts.

**Was gebaut ist.** Eine Balkenspirale in Schrägsicht, EINMAL in drei Offscreen-Leinwände gebacken
(Himmel mit Nebeln, Scheibe mit Armen und Staubbändern, Deckung mit Kernglanz) und je Frame nur
noch als drei `drawImage` geblittet, dazu höchstens 60 blinkende Vordergrundsterne. Das ist
zugleich **billiger** als vorher: 3400 Pfade je Frame gegen drei Bilder plus 60 Pfade.
Das Gefechtsbild ist eine Szene aus echten Rumpfformen: Spielerformation in Lilac, Gegner in Rot,
Strahlen, Treffer, ein Wrack mit Trümmern, ein Planetenbogen. Die ruhende Ebene wird gebacken, nur
Strahlen und Treffer laufen je Frame.

**Beim Einbau gefunden:**

1. **`TAU` fehlte** im äußeren Namensraum - das vorhandene liegt in der IIFE der Kampf-Wiedergabe.
   Der Bestandstest `test_landeseite` meldete `ReferenceError` in sieben Prüfungen im selben Lauf.
2. **Der gemeinsame Bildgrund lief doppelt:** der Gefechtszeichner beginnt selbst mit `clearRect`
   und deckendem Verlauf. Für `'flotte'` wird der gemeinsame jetzt übersprungen.

**Adversarische Durchsicht: vier Befunde.**

1. `groesse()` buk die Galaxie bei **jedem** `resize` neu - ohne Entprellung und ohne Prüfung, ob
   sich die Größe überhaupt geändert hat. Am Handy löst die einfahrende Adressleiste beim Scrollen
   ein `resize` aus; jeder Backvorgang kostet rund 200 ms und legt bei 1440x900/dpr 2 etwa 63 MB
   Leinwand an. Jetzt entprellt (180 ms) und nur bei echter Größenänderung.
2. `sterne(n, seed)` war eingebaut, aber **nie aufgerufen** - die Sterne der Abschnittsbilder kamen
   weiter aus `Math.random`. Der beabsichtigte Determinismus war damit nicht da.
3. `RUMPF` **duplizierte drei Rumpfumrisse aus `SHIP_HULL_DEFS`** - eine Kopie-Familie ohne
   Wächter. Der Entwurfskommentar begründete es mit „damit die Datei allein läuft"; im Spiel ist
   das keine Begründung mehr. `RUMPF` liest die Punktlisten jetzt aus `SHIP_HULL_DEFS`, nur die
   Aufbauten (Kanzel, Türme) bleiben lokal.
4. Ein Befund **an meinem eigenen Wächter**: Regel A misst die Canvas-Pixel, der Spieler sieht sie
   aber durch zwei Scrim-Lagen mit zusammen rund 96 % Deckkraft am oberen Rand.

**Was Befund 4 beim Nachmessen ergab, und warum die Prüfung trotzdem am Canvas misst:** Ein Foto
des linken Randstreifens - dort steht keine Schrift - liefert **7,5 (neu) gegen 6,8-7,1 (alt)**.
Der Scrim deckt dort also fast alles, und eine Sichtprüfung an dieser Stelle misst seine Deckkraft
statt der Arbeit des Zeichners. In der Bildmitte, wo die Galaxie steht, läuft die Schlagzeile
darüber; ein Foto misst dort den weißen Text mit. Die Regel wird deshalb am Canvas gemessen und
heißt ausdrücklich „im Canvas"; die Randmessung steht als Notiz im Testlauf, damit die Grenze
dokumentiert ist. **Und sie korrigiert eine Annahme des Konzepts:** dort stand, die Nebel sollten
„so kräftig sein, dass sie NACH dem Scrim noch sichtbar sind" - am Rand sind sie das nicht.

**Wächter:** `tests/test_landeseite_bilder.js`, 18 Prüfungen. Am alten Stand fallen 10.

**Zwei Schwellen mussten nachgemessen werden, beide waren zuerst zu lasch:**

- „Der obere Bildteil ist nicht mehr leer" war mit 2,5 auch am ALTEN Stand grün. Der alte Himmel
  zeichnete mit `Math.random`, seine Werte schwanken - dreimal gemessen: Desktop 4,9-7,7
  Helligkeit / 1,6-6,8 % helle Pixel, Handy 7,3-13,1 / 10,8-31,4 %. Neu: 14,2 / 27,5 % und
  22,9 / 63,8 %. Die Schwellen liegen jetzt über dem alten Maximum, je Formfaktor eine eigene -
  die alte Galaxie stand am Handy schon im oberen Bereich, am Desktop nicht.
- „Im Gefecht stehen Schiffe" nahm die **28 px aus dem Konzept**. Die sind eine Mindestforderung an
  die Lesbarkeit, kein Trennwert: am alten Stand misst derselbe Lauf 27 px (Desktop) und 30 px
  (Handy), die Prüfung wäre dort zur Hälfte grün gewesen. Neu sind es 182 und 153 px; die Schwelle
  liegt bei 60.

**Das ist der dritte Fall dieser Reihe, in dem eine Schwelle geraten statt gemessen war.** Die
Hausregel „gegen den gemessenen Ausgangsstand vergleichen, nie gegen eingetippte Zahlen" gilt auch
dann, wenn die Zahl aus dem eigenen Konzeptpapier stammt.

## Bündel F: HUD und Rest (06.09.2026)

Das letzte Bündel. Fünf Stellen, die einzeln zu klein für eine eigene Etappe waren, aber alle
dieselbe Klasse von Befund tragen: **eine Zeichnung behauptet etwas, das sie nicht zeigt.**

### F1 Die Vorposten-Zweige bekommen eine eigene Bauform

Befund der Aufnahme: „Handel und Festung lagen farblich so nah beieinander, dass sie nicht zu
trennen waren." Die Messung ist härter als der Bericht: Auf Stufe 8 rasterten Werft, Handel und
Festung in **allen 256 Feldern gleich** – dieselbe Zeichnung in drei Farbtönen. Der Bestandstest
`test_vorposten_station` 2d bemerkte das nicht: Drei verschiedene Data-URLs sind ihm genug, auch
wenn nur die Palette wechselt.

Jeder Zweig trägt jetzt einen eigenen Aufbau am äußeren Ring – Werft Dockarme mit Rumpf im Bau,
Handel Frachtcontainer, Festung einen Panzerring statt des Rohrrings plus roten Schild-Emitter.
Die Zahl der Aufbauten wächst mit der Stufe (1 bis 3). Die Ringlichter sind aus `vpRing` nach
`vpRingLichter` ausgelagert, damit Rohr- und Panzerring dieselbe Quelle benutzen.

Der großflächige Halo aus dem Entwurf wurde **nicht** übernommen: GR-6 hatte ihn gemessen
abgeschafft (123 kB gegen 17 kB je PNG).

**Wächter:** `test_vorposten_station` 2e – farbnormierte 16×16-Rasterung, paarweise über die drei
Zweige auf **derselben** Stufe (2a bis 2c messen dafür jetzt alle Stufe 8, sonst verglichen 2d/2e
Stufe und Zweig zugleich). Gemessen: Zweigwechsel bewegt 37 bis 49 Felder, ein Farbdreher auf
dasselbe Bild nur 1.

### F2 Der Banner-Planet wird eine beleuchtete Kugel

`bannerPlanet` malte eine gefüllte Scheibe und legte eine weiße Linse fester Deckkraft darüber.
Gemessen entlang der Lichtachse: **28 von 33 Messpunkten exakt derselbe Wert**, dann ein Schritt,
dann wieder flach – 92 % des gesamten Abfalls in einer Kante. Der Ring lag komplett vor dem Körper
(innerhalb der Scheibe oben 305, unten 316 Bildpunkte sichtbar).

Jetzt: radialer Verlauf, weicher Terminator, Lichtsaum nur auf der beleuchteten Kante, zwei
Wolkenbänder ab r ≥ 12. Der Ring läuft hinter dem Körper vorbei und kommt vor ihm hervor. Alle 13
Banner-Definitionen bleiben unverändert – die Etappe ändert die Zeichnung, nicht die Auswahl.

**Wächter:** `tests/test_bannerplanet.js`, 10 Prüfungen. Sein Anker beginnt bewusst bei
`bannerRand` statt bei den neuen Farbhelfern, damit die Gegenprobe am alten Stand denselben Block
findet und die Bildprüfungen dort **wirklich laufen** statt sich still zu überspringen.

**Eine Prüfung wurde verworfen, weil sie aus dem falschen Grund grün gewesen wäre:** „keine harte
Kante im Körper" – eine flache Scheibe hat gar keine Kante (alter größter Sprung 11, neuer 21, die
absolute Sprunghöhe trennt die Zustände also nicht). Gemessen wird stattdessen der **Anteil** des
größten Schritts am Gesamtabfall: alt 92 %, neu 16 %.

### F3 Die Sektorregionen werden Gebiete statt Flurstücke

Acht konvexe Polygone aus geraden Kanten mit flacher 10-%-Füllung; die Ecken lagen sichtbar auf den
äußersten Systemen. Jetzt läuft der Umriss als geschlossene Kurve durch **dieselben** Hüllpunkte
(Catmull-Rom → kubische Bézier), und die Fläche ist ein radialer Verlauf je Region, dessen Radius
aus dem gemessenen äußersten Hüllpunkt kommt.

**Der Kurvenbauch musste nachgemessen werden.** Eine Kurve durch dieselben Punkte liegt zwischen
ihnen weiter außen als die Sehne. Mit der ersten Spannung (1/6) und dem alten Abstand (22) wuchsen
die Regionen so weit, dass Nachbargebiete im Bild ineinanderliefen – Bauch bis **34 px** gegen
20 bis 22 px beim alten Polygon. Ausgeliefert ist 1/8 mit Abstand 16: **16 bis 23 px**, also im
Bereich des Polygons davor.

**Wächter:** `tests/test_sektorregionen.js`, 7 Prüfungen. 1a lässt den Browser über innen/außen
entscheiden (`isPointInFill`), statt eine zweite Punkt-in-Kurve-Rechnung neben die gezeichnete zu
stellen. 1a und 1d bleiben am alten Stand grün, und das ist kein Mangel, sondern die Aussage: Sie
sichern, was der Umbau **nicht verlieren durfte**.

### F4 Der Kulissenplanet zeigt die Oberfläche seines Weltentyps

Der Planet hinter der Oberfläche trug nur die Grundfarbe seines Typs. Seit Bündel A hat jeder
Weltentyp eine echte Textur – der Ort, an dem man **steht**, war damit die einzige Stelle im Spiel,
an der eine Eiswelt aussah wie eine Lavawelt in anderer Farbe. Die Textur liegt jetzt auf die Kugel
geschnitten zwischen Füllung und Terminator (quadratischer Mittelausschnitt des 2:1-Streifens).

Der Zwischenspeicher merkt sich **mit**, ob die Textur da war (`key + '|textur'`). Ohne das bliebe
ein Planet, dessen Textur beim ersten Bild noch fehlte, für den Rest der Sitzung flach.

**Wächter:** `tests/test_kulissenplanet.js`, 7 Prüfungen – er **liest ein Merkmal** (`data-standort`
an der Leinwand), statt ein Bild zu messen, und das ist gemessen begründet: Eine Rauheitsmessung auf
`#bgstars` wurde versucht und verworfen, sie lieferte am alten wie am neuen Stand 3 bis 7 und am
neuen sogar weniger – gemessen wurden Sterne und Farbbänderung, nicht die Oberfläche.
Arbeitsteilung: dass sich die Texturen unterscheiden, sichert weiter `test_planeten_texturen` 1f;
dieser Test sichert, dass die Kulisse sie auch benutzt.

### F5 Der Rahmen der Kanzel (Freigabe Sascha nach Bildvergleich)

**Zwei Fassungen wurden am Bild gemessen und verworfen**, und beide Gründe stehen als Regel im
Wächter:

1. Am Fenster in voller Breite – die Spielspalte ist mittig und 780 px breit, die Fensterecken
   liegen weit daneben. Die Streben saßen im leeren Hintergrund und rahmten den Browser.
2. An der Hülle (`.shell::after`) – `.shell` ist die ganze scrollende Seite und mehrere tausend
   Pixel hoch. Die unteren Streben lagen am Seitenende, der Randabfall war über die volle
   Scrollhöhe gezogen und unsichtbar. Ein Rahmen, den man nur oben sieht, ist keiner.

Ausgeliefert: am Fenster festgeklebt, aber genau so breit wie der Inhalt. Beide lesen dafür die
neue Größe `--spielbreite`. Kein `backdrop-filter`, keine Animation – der Energiesparmodus hat hier
nichts abzuschalten.

**Wächter:** `tests/test_kanzelrahmen.js`, 9 Prüfungen, Gegenprobe in **zwei** Richtungen. Die
Sabotage ist die wichtigere: Mit `pointer-events:auto` statt `none` treffen gemessen **1216** der
abgerasterten Bildschirmpunkte den Rahmen statt das, was darunter liegt, und der Sektorkarte-Reiter
ist nicht mehr der oberste Treffer an seiner eigenen Stelle. Deshalb rastert 1c den ganzen
Bildschirm ab und prüft nicht einen Punkt.

### Was dieses Bündel über das Prüfen gelehrt hat

Drei der fünf Etappen haben eine Prüfung hervorgebracht, die **aus dem falschen Grund grün** gewesen
wäre (F2 die Kantenhöhe, F4 die Rauheit, und in F3 wäre eine Bauchschwelle ohne Nachmessen zu lasch
gewesen). Die Hausregel „erst messen, dann setzen" gilt für die eigene Prüfung genauso wie für die
Erwartungswerte des Spiels – und der Test, der die verworfene Messung im Kopf nennt, ist der
einzige Ort, an dem diese Arbeit nicht verloren geht.

### Die adversarische Durchsicht des Bündels (06.09.2026)

Drei Befunde, **zwei bestätigt, einer nicht reproduzierbar** – und der Unterschied wurde gemessen,
nicht geglaubt:

1. **Bestätigt: Der Ladeausleger des Handelszweigs lief aus der Kachel.** `maxLaenge` deckelte ihn
   nur nach unten, waagerecht war er ungedeckelt. Gemessen auf Stufe 8: **27 deckende Randzeilen
   rechts gegen 4 beim Rumpf ohne Zweig**, auf Stufe 7 zwei. Die 4 stammen vom Ring selbst und
   stehen genauso in `origin/main` – sie sind älter als dieses Bündel. Behoben durch einen
   gemessenen Platzdeckel, der den ganzen Anbau proportional verkleinert statt ihn abzuschneiden.
   **Der erste Anlauf der Behebung war zu kurz gerechnet** (27 → 11 Randzeilen): Der äußerste Punkt
   ist nicht die Bugspitze des Frachters, sondern der Schein der Bugleuchte, den `vpLeuchte` bis
   `r*3.2` malt – und dieser Schein hängt an `R`, wächst also beim Verkleinern nicht mit und gehört
   in den festen Teil der Rechnung. Wächter `test_vorposten_station` 2f, und er misst gegen den
   **Rumpf ohne Zweig** statt gegen eine eingetippte Zahl.
2. **Bestätigt: Der Mond bekam seine Textur nicht.** Der erste Wurf schloss neben `vorgabe` auch
   `mond` aus – dabei hat der Mond einen eigenen Builder, den Kartenminiatur und Planetenboden
   längst benutzen. Eine Mondkolonie behielt damit genau die flache Kulisse, die die Etappe
   abschaffen wollte. Wächter `test_kulissenplanet` 0c-mond.
3. **Nicht reproduzierbar: der Kurvenbauch der Regionen.** Der Befund gab für `rand` 26 statt 18 an
   und leitete daraus einen Sicherheitsabstand von nur 1 ab. Zwei aufeinanderfolgende Läufe liefern
   identisch 16 bis 23, und eine Kontrolle mit **4000 statt 240 Stützstellen** auf der Kurve ändert
   keine einzige Zahl – die Abtastung unterschätzt also nicht. Der Abstand beträgt 4. Die Messung
   steht jetzt im Testkopf, damit der nächste Leser sie nicht wiederholen muss.

Zwei von drei ist eine gute Quote für eine Durchsicht; die Regel „Befunde werden geprüft, nicht
geglaubt" hat sich beim dritten aber genauso bewährt wie bei den ersten beiden.
