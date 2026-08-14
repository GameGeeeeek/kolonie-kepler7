# Konzept: Asteroiden-Bergbau und der Umbau der Basiswirtschaft

Stand: 10.08.2026 · Zeilennummern geprüft gegen v8.477.0 · Zielversion: ab v8.480.0 (fünf Phasen)

Zeilennummern beziehen sich auf `weltraum_kolonie.html` bzw. `kolonie-kepler7-backend/server.js` im
Stand v8.477.0 (Commit 50eb264). Alle Aussagen über vorhandenen Code sind am Code nachgeprüft, nicht
aus dem Gedächtnis geschrieben – die eine Stelle, an der das Konzept eine Entscheidung offenlässt,
ist als solche markiert (Abschnitt 12.2).

**Zwei Weichen sind vorab von Sascha entschieden worden und stehen nicht mehr zur Debatte:**

1. **Deckel + Asteroiden als Hauptquelle.** Die T1-Gebäude bleiben, werden aber zur Grundlast
   gedeckelt; der Löwenanteil des Nachschubs kommt ab der Mitte des Spiels aus Asteroiden.
   Bestandskonten brauchen einen Ausgleichspfad – er steht in Abschnitt 4.3.
2. **Geteilt und umkämpft.** Ein Vorkommen gehört dem, der es hält; andere können es ihm streitig
   machen. Das verlangt Backend-Arbeit und wirft die Frage nach dem Solo-Modus auf – Abschnitt 8.

---

## 0. Die drei Befunde, die das Konzept geformt haben

Vor den Zahlen drei Dinge aus dem Bestand, die jede spätere Entscheidung erklären.

**(1) Die T1-Produktionsgebäude haben heute überhaupt keinen Deckel.** `solar`, `mine`,
`raffinerie`, `synth` und `fusionsreaktor` (Z. 4300–4304) tragen als einzige der
Produktionsgruppe **kein `maxLevel`-Feld**. Die Baubremse ist bisher rein wirtschaftlich: Kosten
wachsen exponentiell (`costMult` 1,17–1,30), die Rate linear. Eine Mine auf Stufe 50 kostet
`15 × 1,17⁵⁰ ≈ 38.500` Energie für den nächsten Schritt und liefert dafür 11,25 Erz/s. Das ist ein
weicher Deckel, aber eben nur ein weicher – und er wandert mit jeder neuen Produktionsquelle nach
oben. Ein harter Deckel ist deshalb ein echter Eingriff und kein Formalismus.

**(2) Die Extraktions-Ökonomie ist bereits zweimal gebaut.** Trümmerfelder mit stationierten
Recyclern (`state.debrisFields`, `addDebris` Z. 45856, `renderDebrisBox` Z. 20099) sind exakt das
Muster „endlicher Vorrat an einem Ort, wird von dort stationierten Schiffen mit fester Rate/Sekunde
abgebaut, Lagerdeckel bremst, Piraten können ihn streitig machen". Expeditionen
(`EXPEDITION_TYPES` Z. 49587) sind das Muster „ausfliegen, am Frachtraum gedeckelt heimkehren", und
es gibt dort seit dem 24.07.2026 sogar schon einen Typ **`mining` „Schürfexpedition"**. Beide Muster
werden hier wiederverwendet statt neu erfunden – das ist der Hauptgrund, warum der Frontend-Teil
trotz seines Umfangs überschaubar bleibt.

**(3) `ratesPerSecond()` hat 13 Aufrufstellen in drei Gruppen – und die dritte ist eine Falle.** Die
Funktion (Z. 19149) wird 13-mal echt aufgerufen (21 Grep-Treffer, davon 7 Kommentare und die
Definition):

| Gruppe | Aufrufstellen |
|---|---|
| **Gutschrift** (2) | Haupt-Tick (56773), Offline-Nachholung `applyOfflineProgress` (39970) |
| **Anzeige** (5) | `renderEmpireOverview` (14431), Bedarfslisten-Cache (19031), Ressourcenleiste in `render()` (51024), Ressourcen-Balken (54840), Statistik-Schnappschuss (56856) |
| **Belohnungsformeln** (6) | Fraktionsgeschenk (15378), Wochenliga **zweimal** (23748 serverautoritativ, 43776 lokaler Pfad), Tagesaufgaben (24695), Piratennest-Beute (41307), Pakt-Geschenk (44053) |

Die dritte Gruppe zahlt „N Minuten eigene Produktion" aus. **Jede Mechanik, die diese Zahl erhöht,
erhöht damit stillschweigend sechs Belohnungen mit** – das explosive Muster, vor dem CLAUDE.md unter
„Bekannte Fallstricke" ausdrücklich warnt.

Für dieses Konzept ist die Sache seit der Entscheidung für den **Rundflug** (Abschnitt 5) entschärft:
Asteroidenertrag ist keine laufende Rate, sondern eine Gutschrift bei Rückkehr. `ratesPerSecond()`
behält seine Bedeutung „Produktion aus Gebäuden", bleibt überall korrekt und wird **an keiner
einzigen Stelle angefasst**. Abschnitt 5.5 rechnet auf, was dadurch alles wegfällt.

Der Befund bleibt trotzdem hier stehen, weil er die nächste Person warnt, die auf die naheliegende
Idee kommt, den Asteroidenertrag „der Vollständigkeit halber" in die Rate einzurechnen. Das wäre
kein Anzeige-Feinschliff, sondern eine Balance-Änderung an sechs Belohnungen gleichzeitig.

**Ein Nebenbefund aus derselben Durchsicht,** unabhängig von diesem Konzept: Die
Wochenliga-Ausschüttung steht **zweimal** im Code, in zwei Kopien derselben Schleife (Z. 23748 und
Z. 43776). Wer die eine anfasst, muss die andere mitnehmen – exakt die Fehlerfamilie, die
CLAUDE.md-Regel 6 beschreibt.

---

## 1. Was das Konzept vorschlägt, in fünf Sätzen

Die Basis hört auf, die Hauptquelle für Material zu sein, und wird stattdessen **Kraftwerk und
Hütte**: Sie liefert Energie und veredelt, was die Flotte heranschafft. In etwa zwanzig der
69 Sternsysteme liegen **Gürtel mit Vorkommen** – reine Asteroiden mit einem einzigen Rohstoff und
seltenere **Legierungsasteroiden mit zwei**. Man **wählt eines aus und schickt eine Flotte hin**:
mindestens ein **Minenschiff**, dazu Frachter für mehr Laderaum und Kampfschiffe als Eskorte; sie
gräbt, bis der Laderaum voll ist, und **die Ressourcen gibt es erst, wenn sie wieder zu Hause ist**.
Ein **Schürfrecht** reserviert ein Vorkommen für einen Spieler – es ist knapp, es wird von einer
zurückgelassenen Eskorte gehalten, und wer eins will, das schon jemandem gehört, muss es sich
**erkämpfen**. Wie viel von einer Ladung am Ende im Lager landet, entscheidet die
**Aufbereitungsanlage** auf der Basis.

---

## 2. Bestandsaufnahme: worauf aufgebaut wird

| Bereich | Vorhanden | Wiederverwendung |
|---|---|---|
| **Karte** | `buildGalaxyMap()` Z. 48052, `galaxyOeffne()` Z. 48031, Objekte als `data-map-npc`/`-moon`/`-debris` (Z. 48945, 49070, 49114), Handler Z. 49211–49233 | Ein neues `data-map-asteroid` reiht sich exakt in dieses Muster ein: SVG-Gruppe im aufgeklappten System, Klick öffnet das Kartenmenü |
| **Kartenmenü** | `npcMapMenu`/`moonMapMenu`, Schließen per Esc/Klick daneben (Z. 48544) | Neues `asteroidMapMenu(e, id)` mit denselben Konventionen (Flugzeit und Kosten unter jedem Eintrag, graue Einträge nennen den Grund) |
| **Missionen** | `cf.missions.push({type, targetId, startTime, endTime, composition})`, Auflösung in `checkMissions()` Z. 44793 | Vier neue `type`-Werte, kein neuer Missions-Mechanismus |
| **Flugzeit / Treibstoff** | `missionDurationFor()` Z. 19648, `missionFuelCostSplit()` Z. 18643 | Unverändert übernommen – Navigator, Allianzforschung, Treibstoffdepot wirken damit automatisch mit |
| **Laderaum** | `fleetCargoCapacity()` Z. 18042, `CARGO_PER_FRACHTER` 300 (Z. 18030) | Begrenzt die Ladung einer Abbaumission, exakt wie bei Expeditionen die Beute |
| **Gutschrift** | `gainResources()` Z. 18695 | **Einziger** Weg, Ertrag zu buchen. Lagerdeckel kommt damit gratis mit (CLAUDE.md: „Lager-Deckel konsequent auf ALLE Ressourcen-Quellen") |
| **Auftrag am fremden Ort** | `state.debrisFields`, Sammelauftrag mit belegtem Flottenslot und selbstständiger Rückkehr | Vorbild für die stationierte Eskorte (Abschnitt 6.2) – belegt einen Slot, kommt allein heim, sagt in der Zeile was los ist |
| **Serverautorität** | `/api/market/trade` Z. 5122, `/api/attack` Z. 2920, `getSaveValue`/`setSaveValue` Z. 1268/1273 | Fertiges Muster „Server liest den Spielstand, rechnet selbst, schreibt zurück" |
| **Optimistisches Sperren** | `expectedVersion` + HTTP 409 in `PUT /api/storage/:key` (Z. 1996) | Für die Feld-Dokumente, wo kein eigener Endpunkt nötig ist |
| **Rechteprüfung** | `checkAllianceKeyPermission()` Z. 614, aufgerufen in der Storage-PUT-Route (Z. 1890) | Muster für `checkAsteroidKeyPermission()` |
| **Seltenheitsziehung** | `pickWeightedByRarity` Z. 40653, `hashStringToFloat` Z. 47826 | Deterministische Felderzeugung ohne gespeicherte Daten |
| **Schiff** | `schuerfschiff` Z. 17323 – existiert, hat ein Icon, **und hat bis heute keine Aufgabe**: sein gesamter Nutzen sind +3 % Gesamtproduktion fürs bloße Besitzen (Z. 19301) | Bekommt endlich seinen Beruf (Abschnitt 6.2) |
| **Planeten-Rolle** | `mining` „Bergbau-Welt", +25 % Produktion (Z. 41148) | Wirkt künftig auch auf die Ausbeute der Aufbereitung |

Und die Zahlen der Welt, in die das eingebettet wird: **499 Planeten in 69 Systemen**, davon
**56 vom Typ `asteroid`** – Asteroiden sind im Spiel also längst ein etabliertes Motiv, bisher aber
nur als *Planetentyp* (etwas, das man kolonisiert), nie als *Vorkommen* (etwas, das man abbaut).

---

## 3. Das Objekt: Vorkommen

### 3.1 Neun Sorten – drei reine, sechs Legierungen

Der Aufbau ist bewusst kombinatorisch, damit ein Spieler ihn nach drei Funden von selbst versteht:
**drei reine Sorten** für die drei Massen-Rohstoffe, **drei Paarungen** unter ihnen, und **drei
Paarungen mit Antimaterie**.

| `key` | Name | Rohstoffe | Aufteilung | Häufigkeit |
|---|---|---|---|---|
| `eisen` | Eisenbrocken | Erz | 100 % | 22 % |
| `prisma` | Prismenbrocken | Kristalle | 100 % | 18 % |
| `eiskern` | Eiskern | Deuterium | 100 % | 15 % |
| `magnetit` | Magnetitkern | Erz + Kristalle | 60 / 40 | 12 % |
| `hydrat` | Hydratbrocken | Erz + Deuterium | 60 / 40 | 11 % |
| `klathrat` | Klathratkern | Kristalle + Deuterium | 55 / 45 | 9 % |
| `pechblende` | Pechblendebrocken | Erz + **Antimaterie** | 80 / 20 | 5 % |
| `resonanz` | Resonanzkern | Kristalle + **Antimaterie** | 80 / 20 | 5 % |
| `kometenkern` | Kometenkern | Deuterium + **Antimaterie** | 75 / 25 | 3 % |

**Reine 55 %, Legierungen 45 %, davon antimateriehaltig 13 %.** Legierungsasteroiden fördern
zusätzlich **×1,15 auf die Gesamtrate** – sie sind seltener *und* ergiebiger, sonst wäre „selten"
nur ein Etikett.

**Warum keine Energie und keine Forschungspunkte.** `RES_DEFS` (Z. 4283) führt sechs Ressourcen. Vier
davon sind Material und passen in einen Felsen. **Energie** bleibt bewusst draußen: Sie wird die
Währung, mit der die Basis das Material verarbeitet (Abschnitt 5.4) – das gibt dem Solarkraftwerk
eine dauerhafte Rolle statt eines Deckels und ist der eigentliche „Umbau der Basis".
**Forschungspunkte** bleiben draußen, weil sie schon nach Balance-Pass v8.12 (Kommentar bei
Z. 19200) bewusst von der Wirtschaftsentwicklung entkoppelt wurden; sie hier wieder anzukoppeln
würde diese Entscheidung still rückgängig machen.

**Warum Antimaterie nie rein vorkommt.** Antimaterie ist mit `baseRate` 0,015 (Fusionsreaktor,
Z. 4304) die mit Abstand knappste Ressource des Spiels, und diese Knappheit trägt die gesamte
Tier-2-Kette. Ein reiner Antimaterie-Asteroid würde sie in einem Zug entwerten. Als Beimischung von
20–25 % in 13 % der Vorkommen bleibt sie das, was sie ist: der Engpass, den man plant.

### 3.2 Vier Größen

| Größe | Vorrat | Minenschiff-Plätze | Güte | Häufigkeit |
|---|---|---|---|---|
| Splitter | 50.000 | 4 | ×1,0 | 46 % |
| Brocken | 150.000 | 8 | ×1,4 | 34 % |
| Kern | 500.000 | 16 | ×2,0 | 16 % |
| Koloss | 1.500.000 | 30 | ×3,0 | 4 % |

**Die Plätze begrenzen, wie viele Minenschiffe gleichzeitig an einem Vorkommen arbeiten können** –
mehr als vier passen an einen Splitter nicht heran. Das ist der Grund, warum ein Koloss nicht nur
mehr Vorrat hat, sondern grundsätzlich eine andere Größenordnung bedient.

Was das im Rundflug-Betrieb bedeutet (Abschnitt 5), gerechnet mit einer für die jeweilige Größe
passenden Flotte – Plätze voll besetzt, ebenso viele Frachter dabei, Fördertechnik Stufe 5, 8 Minuten
Flug je Richtung:

| Größe | Ladung je Fahrt | Abbauzeit | Fahrtdauer gesamt | Fahrten bis leer | erschöpft nach | Ertrag je Stunde |
|---|---|---|---|---|---|---|
| Splitter | 3.120 | 18 min | 34 min | 17 | ~10 Std. | ~5.500 |
| Brocken | 6.240 | 13 min | 29 min | 25 | ~12 Std. | ~13.000 |
| Kern | 12.480 | 9 min | 25 min | 41 | ~17 Std. | ~30.000 |
| Koloss | 23.400 | 6 min | 22 min | 65 | ~24 Std. | ~64.000 |

Zwei Dinge, die diese Tabelle zeigt und die so beabsichtigt sind:

**Ein größeres Vorkommen ist nicht „dasselbe, nur länger".** Es liefert je Stunde rund das
Zwölffache eines Splitters, hält dabei aber nur gut doppelt so lange. Ein Koloss ist eine
Gelegenheit, kein Dauerzustand – und wer einen hat, weiß, dass er in einem Tag weg ist.

**Die Fahrten werden mit der Größe kürzer, nicht länger.** Weil die Güte die Abbaurate stärker hebt
als die Plätze den Laderaum, schrumpft die Abbauzeit von 18 auf 6 Minuten. Ein großer Brocken fühlt
sich damit spürbar anders an: schnelle, schwere Fahrten statt langem Warten.

> **Die Vorräte sind gegenüber dem ersten Entwurf um den Faktor vier gesunken** (Kern von 2 Mio. auf
> 500.000). Der Grund ist der Wechsel zum Rundflug: Ein stationierter Förderposten hätte einen Kern
> mit 19,2/s in 29 Stunden geleert. Im Rundflug liegt der effektive Durchsatz wegen Flugzeit und
> Laderaum bei knapp 5/s – dieselben 2 Mio. hätten **über 120 Stunden** gereicht, das Vorkommen wäre
> praktisch unerschöpflich gewesen und die ganze Nachwachs-Mechanik aus 3.3 toter Code. Das ist
> dieselbe Art Folgefehler wie beim Anspruchslimit in 3.6: eine Zahl, die ihre Begründung verloren
> hat, ohne sich selbst zu ändern.

### 3.3 Wo sie liegen

**Nicht jedes System hat einen Gürtel.** Rund **20 der 69 Systeme** tragen einen. Jeder Gürtel hat
**10 feste Plätze** auf seiner Bahn, von denen zu jedem Zeitpunkt **4 bis 6** ein Vorkommen tragen –
galaxieweit also etwa **90 belegte von 200 möglichen Plätzen**. Die übrigen 49 Systeme haben keinen
Gürtel, und das ist der Punkt: Ein Gürtelsystem ist damit ein *Ort*, kein Hintergrundrauschen. Wer
einen guten hat, hat etwas, das ein anderer haben will.

Die Begründung für diese Zahlen steht in Abschnitt 3.5 – sie ist gemessen, nicht geschätzt, und die
erste Fassung dieses Konzepts hatte sie um den Faktor fünf falsch.

**Verteilung der Gürtelsysteme.** Sie werden deterministisch gewählt, aber **räumlich gestreut**: Die
Galaxiekarte wird in ein Raster gelegt, und je Rasterzelle wird genau ein System zum Gürtelsystem
bestimmt. Ohne diese Streuung könnte der Zufall alle zwanzig in eine Ecke legen, und die Spieler am
anderen Ende hätten keinen erreichbaren Gürtel – bei zehn Konten wäre das kein Balance-Problem mehr,
sondern ein kaputtes Feature.

**Qualität wächst mit der Entfernung von `kepler`.** Im Startsystem und seinen direkten Nachbarn
liegen überwiegend Splitter und Brocken; Kerne und Kolosse häufen sich weit draußen. Das bindet drei
vorhandene Systeme ohne eine einzige neue Regel zusammen: Ein weiter Flug kostet mehr Zeit und
Treibstoff (`missionDurationFor`, `missionFuelCostSplit`), macht Navigator und den neuen
Schürfleitstand wertvoll, und sorgt dafür, dass Anfänger in Reichweite immer *etwas* finden, während
sich die entwickelten Konten um die großen Brocken draußen streiten. Die Knappheit sitzt damit da,
wo sie hingehört – bei der Qualität, nicht beim Zugang.

**Die Kartengeometrie ist dabei kein Engpass** (nachgerechnet an `planetOrbitXY()` Z. 48685): Die
Planeten sitzen auf Ellipsen mit `rx = 42 + orbit·43`, jede Bahn trägt genau **einen** Planeten, der
Rest der Bahn ist leer. Eine Gürtelbahn fasst bei 34 px Markerabstand je nach Lage **19 bis 52**
Marker. Zehn Plätze sind daneben komfortabel – die Zahlen kommen aus der Wirtschaft, nicht aus dem
Platz.

### 3.3.1 Erschöpfung und Nachschub – nie wieder am selben Fleck

Ist ein Vorkommen leergefördert, verschwindet es. **Der Nachschub erscheint nicht dort, wo es lag.**

| Erschöpfte Größe | Nachschub nach | Wo |
|---|---|---|
| Splitter | **3 Std.** | ein **anderer freier Platz** – zu 70 % im selben System, zu 30 % in einem anderen Gürtelsystem |
| Brocken | **8 Std.** | dito |
| Kern | **20 Std.** | dito |
| Koloss | **48 Std.** | dito |

Drei Regeln dazu, jede mit einem Grund:

**Der Platz wechselt immer.** Der neue Brocken landet auf einem Platz, der gerade frei ist – nie auf
dem gerade geräumten. Ohne diese Regel wäre die Karte statisch: Man merkt sich zehn Koordinaten und
fliegt sie für immer ab. Mit ihr ist das Gürtelsystem ein Revier, das man **absuchen** muss, und der
Tiefenscan (Abschnitt 7) sowie die Sichtbarkeitsregel aus 3.4 bekommen dadurch überhaupt erst Sinn.

**Die Sorte und Größe werden neu gezogen**, unabhängig von dem, was dort war. Ein leergeförderter
Koloss kommt nicht als Koloss wieder. Über Wochen pendelt sich die Zusammensetzung des Feldes damit
von selbst auf die Verteilung aus 3.1/3.2 ein – es braucht keine Ausgleichslogik, die man falsch
bauen könnte.

**30 % wandern in ein anderes System.** Damit verschiebt sich über Wochen auch die Landkarte des
Reichtums: Ein System, das heute vier Kerne trägt, kann in zwei Wochen mager sein. Das ist die
langsamste Bewegung im ganzen Entwurf und die, die das Erkunden dauerhaft am Leben hält. **Grenzen:
kein Gürtelsystem fällt unter 3 oder steigt über 8 Vorkommen** – sonst könnte ein System leerlaufen
und ein anderes alles auf sich ziehen.

**Läuft das Feld dadurch leer?** Nein, nachgerechnet nach Little's Law – leere Plätze im Mittel =
Erschöpfungen pro Stunde × mittlere Nachschubzeit:

| gleichzeitig aktiv abgebaute Vorkommen | Erschöpfungen/Std. | im Mittel leer | Anteil des Feldes |
|---|---|---|---|
| 10 (realistisch bei 10 Konten) | 0,85 | 6,3 Plätze | 7 % |
| 20 | 1,71 | 12,7 Plätze | 14 % |
| 35 (Vollauslastung) | 2,99 | 22,2 Plätze | 25 % |

Selbst bei Vollauslastung steht ein Viertel des Feldes leer und drei Viertel tragen etwas. Das ist
genau die Mischung, die gewollt ist: sichtbar in Bewegung, nie leergeräumt.

### 3.3.2 Was das für die Speicherung heißt

Die erste Fassung wollte das Feld **berechnen statt speichern** – Sorte, Größe und Platz aus
`hashStringToFloat(systemId + ':' + epoche)`, so wie der Abgrund seine Sektoren aus der Tiefe
ableitet (HELP_SECTIONS Z. 33851: „Ein Sektor wird aus seiner Tiefe **berechnet**, nicht gewürfelt").
Client und Server hätten unabhängig dasselbe Feld ausgerechnet, gespeichert worden wäre nur die
Abweichung.

**Mit wanderndem Nachschub geht das nicht mehr**, und das ist die Folge, die diese Änderung wirklich
hat: Ein Feld, das sich bei jeder Erschöpfung an einer zufälligen Stelle neu bildet, ist Geschichte,
keine Formel. Es **muss** gespeichert werden.

Das ist bezahlbar, und zwar mit Abstand: Ein System-Dokument führt 10 Plätze mit je einer Handvoll
Feldern – rund **800 Byte**, bei 20 Gürtelsystemen zusammen etwa **16 KB**. Das Limit liegt bei
64 KB **je Schlüssel** (`MAX_SHARED_VALUE_BYTES`, server.js Z. 286), und jedes System ist ein eigener
Schlüssel. Es ist also nicht knapp, sondern um zwei Größenordnungen unkritisch.

Berechnet wird weiterhin die **Erstbelegung** (welche 20 Systeme, welche Plätze, was liegt dort am
ersten Tag) – ab da lebt das Feld. Im Solo-Modus liegt dieselbe Struktur lokal in `state`, mit
derselben Nachschublogik; der Kreislauf funktioniert dort vollständig (Abschnitt 8).

### 3.4 Sichtbarkeit

Ein Vorkommen ist nur zu sehen, wenn man das System schon kennt (dieselbe Regel wie bei Planeten).
Sorte und Größe stehen nach dem ersten **Anflug oder Scan** fest; vorher zeigt die Karte einen
grauen, unbeschrifteten Brocken. Das gibt dem **Spähschiff** und der neuen Forschung
**Tiefenscan-Array** (Abschnitt 7) einen zweiten Nutzen und verhindert, dass man mit einem Blick auf
die Karte alle Vorkommen auf einmal sortiert.

**Seit der Nachschub wandert (3.3.1), ist das keine einmalige Aufgabe mehr.** Ein Gürtelsystem, das
man vorige Woche durchgescannt hat, sieht heute anders aus – der Tiefenscan ist damit kein Häkchen,
das man einmal setzt, sondern ein Werkzeug, das dauerhaft etwas wert bleibt. Das war beim
nachwachsenden Platz aus der ersten Fassung nicht so.

---

### 3.5 Warum 20 Systeme und nicht 69 – die Zahl ist gemessen

**Die erste Fassung dieses Konzepts lag hier um den Faktor fünf daneben.** Sie schrieb „jedes der
69 Systeme trägt 4–9 Vorkommen", also rund 450, ohne die Gegenprobe zu machen, für wie viele Spieler
das eigentlich reichen soll. Nachgeholt am **10.08.2026** über den öffentlichen Health-Endpunkt
(`GET /api/health`, server.js Z. 3220 – liefert bewusst nur die Kontenzahl, keine Namen):

> **10 registrierte Konten.**

Damit rechnet sich das Angebot so:

| Anspruchslimit | maximale Nachfrage (10 Konten) | Auslastung bei 450 Vorkommen | bei 90 |
|---|---|---|---|
| 8 | 80 | 18 % | 89 % |
| **5** | **50** | 11 % | **56 %** |

Bei 450 Vorkommen wäre nie irgendetwas umkämpft – die gesamte Anfechtungs-Mechanik aus Abschnitt 6
wäre toter Code, und genau sie war die zweite der beiden vorab entschiedenen Weichen. Bei rund 90
Vorkommen und einem Limit von 5 liegt die Auslastung bei voller Beteiligung aller zehn Konten bei
gut der Hälfte: Die guten Brocken sind knapp, irgendein Splitter ist immer frei.

**Zwei Einschränkungen, ehrlich benannt.** Der Endpunkt zählt *registrierte*, nicht *aktive* Konten –
sind real nur vier Leute unterwegs, ist die Auslastung entsprechend niedriger, und dann darf die Zahl
der Gürtelsysteme eher auf 15 als auf 20. Und zehn Konten sind eine kleine Grundgesamtheit: Zwei neue
Spieler verschieben die Rechnung spürbar. Deshalb gehört die Zahl **nicht** als Literal in den Code,
sondern als benannte Konstante an genau eine Stelle:

```js
// Faustformel: rund 2 Vorkommen je erwartetem Konto, gestreut auf ~5 je Gürtelsystem.
const GUERTEL_SYSTEME       = 20;      // von 69 - bei wachsender Spielerschaft erhöhen
const PLAETZE_JE_GUERTEL    = 10;      // feste Positionen auf der Bahn, davon belegt:
const VORKOMMEN_JE_GUERTEL  = [4, 6];  // Startbelegung
const VORKOMMEN_GRENZEN     = [3, 8];  // untere/obere Schranke beim Wandern (3.3.1)
const NACHSCHUB_STD         = { splitter: 3, brocken: 8, kern: 20, koloss: 48 };
const NACHSCHUB_SYSTEMWECHSEL = 0.30;  // Anteil, der in ein anderes Gürtelsystem wandert
```

Ein Wachstum auf 30 Spieler heißt dann: `GUERTEL_SYSTEME` auf 60 setzen, fertig. Kein Umbau.

### 3.6 Das Anspruchslimit: 5

Das Limit lag im ersten Entwurf bei 8 und sinkt auf **5**. Die Begründung dafür hat sich im Lauf
dieses Dokuments **zweimal geändert**, und weil das genau die Sorte stiller Verschiebung ist, an der
Konzepte unbemerkt falsch werden, steht sie hier vollständig:

1. *Erster Entwurf:* 8, ohne Begründung – geraten.
2. *Zweiter Entwurf:* 5, begründet mit dem Durchsatz der Aufbereitungsanlage (60/s), den ein einziger
   Koloss zu 90 % ausgelastet hätte.
3. **Jetzt:** 5, begründet mit dem **Angebot** – denn der Durchsatz-Deckel ist mit dem Förderposten
   weggefallen (Abschnitt 5.5). Die Aufbereitung ist keine Rate mehr, sondern eine Ausbeute je
   Ladung; ein „Sättigen" gibt es nicht mehr, und das Argument aus Schritt 2 gilt **nicht** weiter.

Was trägt, ist die Rechnung aus Abschnitt 3.5: Bei rund 90 Vorkommen und 10 Konten ergibt ein Limit
von 5 eine Auslastung von 56 % – knapp genug für echten Streit, weit genug für einen freien Splitter.
Ein Limit von 8 ergäbe 89 % und damit faktische Vollbelegung durch die ersten drei aktiven Spieler.

Dazu kommt eine **natürliche** Bremse, die kein Limit braucht: Jede Abbaumission bindet Minenschiffe
für eine halbe bis ganze Stunde. Wer fünf Vorkommen wirklich bewirtschaften will, braucht fünf
Flotten und die Schiffe dafür. Das Limit ist damit die Obergrenze, nicht der Alltag – der Alltag ist
die Werft.

---

### 3.7 Schürfpeilungen – die Vorkommen, die nicht auf der Karte stehen

**Expeditionen finden Koordinaten besonders seltener und großer Asteroiden.** Das ist die zweite
Quelle für Vorkommen neben den Gürteln – und die einzige, die auch im Solo-Modus große Brocken
liefert.

Eine **Schürfpeilung** ist ein privates Sondervorkommen:

| Eigenschaft | Wert |
|---|---|
| Größe | **Kern** (65 %) oder **Koloss** (35 %) – nie klein |
| Sorte | stark gewichtet zu den **Legierungen**, die antimateriehaltigen dreifach: Pechblende, Resonanz, Kometenkern zusammen ~45 % statt sonst 13 % |
| Sichtbarkeit | **nur für den Finder** – erscheint als eigener Marker in einem bereits entdeckten System |
| Anfechtbar | **nein**. Niemand sonst sieht oder erreicht sie. |
| Haltbarkeit | **7 Tage** ab Fund, dann verfällt die Peilung samt Restvorrat |
| Gleichzeitig offen | **höchstens 3** |

Sie zählt **nicht** gegen das Anspruchslimit von 5 (Abschnitt 3.6) – ein Schürfrecht ist ein Anspruch
auf ein geteiltes Objekt, eine Peilung ist eigenes Wissen. Wer gerade drei Peilungen offen hat, kann
also kurzzeitig acht Vorkommen bewirtschaften. Das ist Absicht und trotzdem kein Rückfall hinter
Abschnitt 3.6: Peilungen laufen ab, Schürfrechte nicht. Es ist ein **Ausschlag**, kein Dauerzustand.

### Warum die Obergrenze der Regler ist und nicht die Fundchance

Die naheliegende Stellschraube wäre die Prozentzahl. Sie taugt hier nicht, und der Grund ist
nachgerechnet: Es laufen höchstens **5 Expeditionen gleichzeitig**
(`maxConcurrentExpeditions()` Z. 22944 – `1 + rexpslots`, `maxLevel: 4`), eine Schürfexpedition
dauert `1200 s × 0,9`. Im theoretischen Dauerbetrieb sind das **rund 400 Expeditionen am Tag**; ein
Gelegenheitsspieler schafft zehn. **Zwischen beiden liegt Faktor vierzig.** Jede Prozentzahl, die für
den einen stimmt, ist für den anderen um zwei Größenordnungen falsch.

Deshalb regelt die **harte Obergrenze von 3 offenen Peilungen**, und die Fundchance bestimmt nur noch,
wie schnell man nach dem Verbrauch einer wieder auffüllt:

| Expeditionstyp | Chance je erfolgreicher Expedition |
|---|---|
| **Schürfexpedition** (`mining`) | **3,0 %** |
| Tiefenraum-Expedition (`deep`) | 2,0 % |
| Bergungsexpedition (`salvage`) | 1,0 % |
| alle übrigen | 1,0 % |

Der Risiko-Regler (`EXPEDITION_RISK_MODES` Z. 49604) skaliert sie mit seinem vorhandenen
`rew`-Faktor mit – wagemutig +35 %, vorsichtig −15 %. Kein eigener Kanal.

**Das gibt der Schürfexpedition endlich ein Profil.** Sie ist heute der blasseste der sieben Typen:
„fast nur Ressourcenfunde und geringes Begegnungsrisiko" – also mehr vom Immergleichen. Mit der
dreifachen Peilungschance wird sie das, wonach sie klingt.

**Findet man eine vierte, während drei offen sind**, ist sie nicht verloren: Sie wird in eine
Rohstoffgutschrift in Höhe eines halben Splitter-Vorrats umgewandelt, mit einem eigenen Satz im
Expeditionsbericht („Die Peilung war schon bekannt – die Daten waren trotzdem etwas wert"). Ein Fund,
der stillschweigend verfällt, ist schlimmer als gar keiner.

### Wo das im Code einhängt

**Nicht als siebtes Fund-Band.** Die Bänder in `EXPEDITION_TYPES` sind kumulative Schwellen
(`b_nothing < b_resource < b_special < b_item < b_rare < b_module`, Z. 45613–45617) und müssen je Typ
zusammen mit `nothingBase` **exakt 1,0** ergeben. Ein neues Band hieße, alle sieben Expeditionstypen
neu auszutarieren – viel Risiko für einen Zusatzfund.

Stattdessen als **unabhängige Zusatzchance oben drauf**, im `outcome === 'success'`-Zweig. Dieses
Muster steht dort bereits zweimal: die Event-Bauteile und das Event-Modul (Z. 45755 ff.), beide
ausdrücklich kommentiert mit „verändert bewusst KEINE der b_nothing..b_module-Wahrscheinlichkeiten".
Und der noch nähere Präzedenzfall steht direkt darunter: die **Entdeckung eines versteckten
Sternsystems** mit 4 % Chance (Z. 45778 ff.) – eine Expedition, die einen *Ort* auf der Karte
aufdeckt, gibt es also schon. Die Schürfpeilung ist derselbe Griff, nur mit einem Vorkommen statt
einem System.

Gespeichert wird sie in `state.peilungen` als kleines Array – Sorte, Größe, System, Restvorrat,
Verfallszeitpunkt. Kein Backend, kein geteilter Speicher, **funktioniert im Solo-Modus vollständig**.

### Warum privat und nicht geteilt

Die Alternative wäre reizvoll: Die Peilung deckt ein Vorkommen auf, das **allen** gehört, der Finder
hat nur einen Vorsprung von ein paar Stunden. Das erzeugt Wettrennen und passt zur umkämpften
Grundidee.

Dagegen sprechen drei Dinge, und das dritte gibt den Ausschlag:

1. **Frust.** Man fliegt zwanzig Minuten und findet den Brocken leergeräumt vor. Bei zehn Konten, die
   sich alle kennen, wird das schnell persönlich.
2. **Backend-Arbeit.** Ein geteiltes Sondervorkommen braucht Feld-Dokumente, Sichtbarkeitsfristen und
   eine Rechteprüfung – es rutscht damit von Phase 2 nach Phase 4.
3. **Der Solo-Modus.** Er hat keine Gürtel-Konkurrenz und keine Schürfrechte (Abschnitt 8). Die
   private Peilung ist der Weg, auf dem ein Solo-Spieler an große Brocken kommt. Als geteiltes Objekt
   wäre sie genau dort wirkungslos, wo sie am meisten gebraucht wird.

---

## 4. Der Umbau der Basis

### 4.1 Der Deckel

| Gebäude | heute | neu | volle Rate neu |
|---|---|---|---|
| `mine` Erzmine | kein Deckel, 0,225/s je Stufe | **`maxLevel: 25`**, Stufen 16–25 zu **halber** Rate | 4,500/s |
| `raffinerie` Kristallraffinerie | kein Deckel, 0,075/s | `maxLevel: 25`, dito | 1,500/s |
| `synth` Deuteriumsynthetisierer | kein Deckel, 0,060/s | `maxLevel: 25`, dito | 1,200/s |
| `fusionsreaktor` Antimaterie | kein Deckel, 0,015/s | `maxLevel: 25`, dito | 0,300/s |
| `solar` Solarkraftwerk | kein Deckel, 0,300/s | **`maxLevel: 40`**, volle Rate durchgehend | 12,000/s |

Zwei Dinge daran sind Absicht:

**Die Abflachung ab Stufe 16 statt einer Wand bei 25.** Ein harter Schnitt macht Stufe 26 zu einem
Knopf, der nichts tut. Die halbe Rate ab 16 sagt dem Spieler stattdessen über zehn Stufen hinweg
„hier ist die Luft raus" – und genau in diesem Bereich soll er anfangen, nach draußen zu schauen.

**Solar bleibt weitgehend frei.** Energie ist ab jetzt Verbrauchsgut (Abschnitt 5.4). Wer seine
Aufbereitung auslasten will, braucht Kraftwerke – die Basis verliert also keine Aufgabe, sie
**tauscht** eine gegen eine andere.

Zu beachten: Der Deckel wirkt **je Standort**, nicht imperiumsweit (`ratesPerSecond` summiert über
`allBuildingSetsWithPlanet()`, Z. 19153). Wer viele Kolonien hat, produziert weiter mehr. Das ist
gewollt: Ein imperiumsweiter Deckel würde neue Kolonien wertlos machen, und Kolonien sind teuer und
langsam genug, um kein Schlupfloch zu sein.

### 4.2 Was der Deckel konkret kostet – gemessen (11.08.2026, v8.486.0)

Die Rechnung darunter stand hier als Schätzung. **Sie ist jetzt nachgemessen** (CLAUDE.md-Regel 11),
an einem Standort mit Solar 35, Mine 40, Raffinerie 34, Synth 30, Fusionsreaktor 26, Habitat 20,
Forschung rsolar/rerz 15 – abgelesen an den Gebäudekarten des laufenden Spiels, einmal gegen
v8.485.0 und einmal gegen den neuen Stand:

| Gebäude | Stufe | vorher | nachher | Verlust |
|---|---|---|---|---|
| Erzmine | 40 | 17,3/s | 11,9/s | **−31,2 %** |
| Kristallraffinerie | 34 | 4,64/s | 3,34/s | −28,0 % |
| Deuteriumsynthetisierer | 30 | 3,28/s | 2,46/s | −25,0 % |
| Fusionsreaktor | 26 | 0,655/s | 0,517/s | −21,1 % |
| Solarkraftwerk | 35 | 20,2/s | 20,2/s | **0 %** |

Die geschätzten „rund 31 %" für die Erzmine waren also richtig; die übrigen Gebäude verlieren
weniger, weil sie weniger weit über der Schwelle stehen. Der Verlust wächst mit der Stufe – wer
seine Basis nie über 15 gebaut hat, merkt gar nichts.

Der Standort verliert an Erz **5,4/s**, also rund **19.400 in der Stunde**.

Dagegen steht ein **Kern**, der bei durchgehendem Betrieb **35.584 je Stunde** liefert – ebenfalls
gemessen, im Zuge von v8.485.0 (Abschnitt 12.2). **Eine einzige durchgehend laufende Abbaumission
holt den Verlust eines vollentwickelten Standorts also fast doppelt heraus.**

Damit das nicht schöner klingt, als es ist: Bei **sechs** ausgebauten Standorten summiert sich der
Verlust auf rund **116.000 Erz je Stunde**, und das sind **gut drei durchgehend laufende
Schürfflotten**. Wer sich auf das neue System einlässt, steht danach besser da – aber es ist Arbeit,
kein Geschenk. Genau das ist der Zweck der Übung, und genau so gehört es in den Patchnote.

Genau dieses Gefälle ist der Zweck der Übung. Es hat aber eine Kehrseite, die der Rundflug mitbringt
und die der Förderposten nicht hatte: **Der Ertrag hängt jetzt daran, dass jemand Flotten schickt.**
Ein Spieler, der eine Woche nicht hereinschaut, hat nach dem Umbau spürbar weniger als vorher – die
Grundlast läuft weiter, die 30.000/Std. nicht. Das ist eine bewusste Verschiebung von *passiv* zu
*aktiv*, und sie gehört so in den Patchnote, statt sie zu verschweigen (Abschnitt 4.3).

### 4.3 Bestandskonten

`maxLevel` blockiert im Spiel nur den **Ausbau** (`if (cur >= def.maxLevel)` Z. 12901) – vorhandene
Stufen werden nirgends abgesenkt. Für die Rate braucht es trotzdem eine ausdrückliche Regel, sonst
entscheidet der Zufall der Formel:

> **Stufen oberhalb des Deckels zählen wie die Stufen 16–25, also zur halben Rate.** Sie bleiben
> erhalten, sie bleiben sichtbar, sie zählen weiter – nur eben abgeflacht.

Dazu einmalig, automatisch beim ersten Laden nach dem Update:

1. **Rückerstattung.** Für jede Stufe oberhalb des Deckels werden **60 % der historischen Baukosten**
   dieser Stufe gutgeschrieben (über `gainResources()`, also am Lagerdeckel geklemmt wie alles
   andere). Bei Mine 40 sind das 15 Stufen – ein spürbarer Batzen, mit dem sich die erste
   Schürfflotte sofort bauen lässt.
2. **Starthilfe Schürfflotte.** **6 Schürfschiffe** ~~und **1 zusätzliches Schürfrecht** (also 3 statt
   2 zu Beginn)~~ für jedes Konto, das mindestens ein Produktionsgebäude über dem Deckel hat.
   *Umgesetzt bis auf das Schürfrecht: Schürfrechte entstehen erst mit dem geteilten Feld in Phase 4;
   ein Anspruch auf etwas, das es noch nicht gibt, wäre eine leere Zusage gewesen.*
3. **Ein Patchnote, der die Zahl nennt.** Nicht „die Produktion wurde angepasst", sondern: *„Deine
   Erzmine auf Stufe 40 liefert künftig rund 31 % weniger. Dafür liefert ein einziger gehaltener
   Asteroidenkern mehr als dieser Standort vorher – hier steht, wie du an einen kommst."* CLAUDE.md
   Regel 11: Patchnotes sind Versprechen, und Behauptungen darin werden vorher gemessen. Die 31 %
   oben sind gerechnet, nicht geschätzt; vor dem Schreiben des Eintrags werden sie an einem echten
   Spielstand nachgemessen.

**Die verworfene Alternative,** der Ehrlichkeit halber: eine Auslauffrist (vier Wochen volle Rate,
danach Abflachung). Klingt freundlicher, ist aber schlechter – sie verlangt einen Stichtag im Code,
der irgendwann als toter Sonderfall liegenbleibt, und sie verschiebt die unangenehme Nachricht
lediglich an einen Tag, an dem kein Patchnote mehr danebensteht.

---

## 5. Die Abbaumission – der Kern des Spiels

**Man wählt ein Vorkommen aus, schickt eine Flotte hin, und bekommt die Ressourcen erst, wenn sie
wieder zu Hause ist.** Kein Tröpfeln, keine Rate, die im Hintergrund läuft: eine Fahrt, eine Ladung,
eine Gutschrift. Das ist die Entscheidung, die dieses Kapitel trägt – und sie räumt drei der
riskantesten Teile der ersten Konzeptfassung ersatzlos ab (Abschnitt 5.5).

### 5.1 Der Ablauf

1. **Auswählen.** Klick auf den Brocken in der Sektorkarte öffnet das Kartenmenü (`data-map-asteroid`,
   Muster wie `data-map-npc`) mit dem Eintrag **Abbaumission**.
2. **Flotte zusammenstellen.** Im vorhandenen Flottenwahl-Feld: **mindestens ein Minenschiff**
   (Pflicht – ohne eins ist der Eintrag grau und sagt das auch), dazu wahlweise Frachter für mehr
   Laderaum und Kampfschiffe als Eskorte.
3. **Vorschau lesen.** Vor dem Start steht da, was zu erwarten ist: Hinflug, **Abbauzeit**, Rückflug,
   Ladung, Treibstoff und die fällige Energie fürs Aufbereiten. Alles aus denselben Funktionen
   gerechnet, die es hinterher auch wirklich abrechnen – die Vorschau kann gar nicht abweichen.
4. **Starten.** `missionFuelCostSplit()` zieht den Treibstoff, die Mission geht als
   `type:'mining'` in `cf.missions`.
5. **Abbauen.** Die Flotte ist die ganze Zeit unterwegs; der Missionseintrag zeigt, in welcher Phase
   sie steckt (Anflug / Abbau / Rückflug).
6. **Heimkehr.** `checkMissions()` löst auf, die Ladung geht durch `gainResources()`, es gibt einen
   Bericht. **Erst jetzt** hat der Spieler die Rohstoffe.

### 5.2 Die Flotte: wer was beiträgt

| Schiff | Abbaurate | Laderaum | Rolle |
|---|---|---|---|
| **Minenschiff** (`schuerfschiff`) | **0,60/s** je Schiff | **400** je Schiff | Pflicht. Bricht das Gestein und hat einen eigenen Bunker. |
| Frachter | – | 300 je Schiff | Reine Laderaum-Erweiterung (`CARGO_PER_FRACHTER` Z. 18030). |
| Großer Frachter | – | 1.500 je Schiff | dito (`CARGO_PER_FRACHTER_GROSS` Z. 18031). |
| Kampfschiffe | – | – | Eskorte. Ohne Belang für den Ertrag, aber siehe Abschnitt 6.3. |

**Das Minenschiff ist das vorhandene Schürfschiff** (`schuerfschiff` Z. 17323). Es existiert bereits
samt Icon, Rumpf-Silhouette und Kostenfunktion – und hat bis heute keine einzige Aufgabe außer
+3 % Produktion fürs bloße Besitzen (Z. 19301). Ein zweites, funktionsgleiches Schiff daneben zu
stellen wäre doppelte Arbeit und doppelte Erklärung. Der bestehende Bonus bleibt unangetastet, das
ist gewachsene Balance. Nur die Freischaltung ändert sich: heute ist es ein reines Event-Schiff
(`unlockEventParts:{ eventKey:'goldrausch' }`), was für eine Kernmechanik nicht geht – künftig
schaltet es die Forschung **Minentechnik** regulär frei, und die Event-Teile bleiben als schnellerer
Weg mit eigenem Rumpf-Skin.

### 5.3 Wie lange sie bleibt und was sie mitbringt

```
Abbaurate  = Anzahl Minenschiffe × 0,60/s × Güte des Vorkommens × (1 + Fördertechnik)
Laderaum   = Minenschiffe × 400 × (1 + Fördertechnik) + Frachter × 300 + Großfrachter × 1.500
Ladung     = min(Laderaum, Restvorrat des Vorkommens)
Abbauzeit  = Ladung ÷ Abbaurate            (gedeckelt bei 4 Std., die Vorschau sagt es)
Gesamtzeit = Hinflug + Abbauzeit + Rückflug
```

Die Flotte gräbt also **so lange, bis der Laderaum voll ist** – nicht eine feste Zeit lang. Das macht
beide Werte gleichzeitig lesbar: Mehr Abbaurate heißt *schneller fertig*, mehr Laderaum heißt *mehr
pro Fahrt, aber länger unterwegs*. Zwei Schrauben, die sich nicht gegenseitig verstecken.

Ein Rechenbeispiel – 5 Minenschiffe und 10 Frachter an einem Kern (Güte ×2,0), Fördertechnik Stufe 5:

- Abbaurate: 5 × 0,60 × 2,0 × 1,20 = **7,2/s**
- Laderaum: 5 × 400 × 1,20 + 10 × 300 = 2.400 + 3.000 = **5.400**
- Abbauzeit: 5.400 ÷ 7,2 = 750 s = **12,5 Minuten**, dazu Hin- und Rückflug

**Die Kappung bei Rückkehr ist die bestehende.** Übersteigt die Ladung den Lagerdeckel, verfällt der
Überschuss – dieselbe `cargoScale`-Rechnung, die Expeditionen, NPC-Beute und Abgrund-Bergung schon
benutzen (Z. 44915, 45082, 45368) und die seit v8.168 ausdrücklich für **alle** Ressourcenquellen
gilt. Kein neuer Sonderweg.

### 5.4 Die Aufbereitungsanlage – was die Basis noch zu tun hat

Eine heimgekehrte Ladung ist Gestein, kein fertiger Rohstoff. Wie viel daraus wird, entscheidet das
neue Gebäude:

**Aufbereitungsanlage** (`key:'aufbereitung'`, eigenes gezeichnetes Icon, `category:'refine'`,
`maxLevel: 20`)

> **Umgesetzt am 11.08.2026 (v8.485.0) – mit zwei bewussten Abweichungen von dem, was hier stand.**
> Die Absätze darunter geben den ursprünglichen Entwurf wieder; was wirklich gebaut wurde, steht
> direkt dahinter und ist begründet.

- ~~**Ausbeute: 70 % ohne Anlage, +1,5 Prozentpunkte je Stufe** – bei Vollausbau **100 %**. Wer nie
  eine baut, verliert dauerhaft knapp ein Drittel jeder Fahrt.~~
- ~~**Verbrauch: 1,5 Energie je aufbereiteter Einheit**, fällig beim Entladen über `pay()`.~~

**Abweichung 1 – Zuschlag statt Grundausbeute.** Gebaut ist: **volle Ladung bleibt die Grundlage,
die Anlage legt +1,5 Prozentpunkte je Stufe OBEN DRAUF** (Vollausbau **+30 %**). Grund: Die
Abbaumission ist seit dem 09.08.2026 (v8.479.0) im Spiel und liefert 100 %. Eine Grundausbeute von
70 % nachzuschieben wäre für jeden, der sie benutzt, eine **stille Kürzung um 30 %** gewesen – eine
bestehende Mechanik schlechter zu machen, um Platz für ein neues Gebäude zu schaffen, kommt als
Strafe an, nicht als Inhalt. Der Design-Effekt ist derselbe (die Basis entscheidet, wie viel aus dem
Gestein wird), nur ohne Enteignung. `tests/test_aufbereitung.js` Punkt 2a hält genau das fest.

**Abweichung 2 – der Preis fällt nur auf die Zusatzeinheiten an**, nicht auf die ganze Ladung: **12
Energie je zusätzlich gewonnener Einheit** (`AUFBEREITUNG_ENERGIE`, gemessen – siehe 12.2). Folgt aus
Abweichung 1: Wer nichts baut, zahlt nichts, und Stufe 1 ist dadurch ein kleines gutes Geschäft statt
eines schlechten. Reicht die Energie nicht, fällt **nur der Zuschlag** anteilig kleiner aus – die
geschürfte Ladung selbst kommt immer vollständig an.

**Und die Reihenfolge beim Entladen ist Teil der Zusage:** Der Zuschlag wird *vor* der Gutschrift
gerechnet (er bestimmt ja, wie viel gutzuschreiben ist), **bezahlt wird aber erst danach** – und nur
für die Zusatzeinheiten, die wirklich eingelagert wurden. Wer vorher bezahlt, gibt bei vollem Lager
Energie für Einheiten aus, die `gainResources()` im selben Augenblick wegwirft: doppelte Strafe für
ein volles Lager, und im Bericht stünde sie nicht einmal. `tests/test_aufbereitung.js` Punkt 6 hält
das fest; die Gegenprobe mit der alten Reihenfolge verlor 19.440 Energie für null angekommene
Einheiten.

**Ebenfalls abweichend: die höchste Anlage im Imperium zählt**, nicht die des Planeten, auf dem die
Flotte landet, und erst recht nicht die Summe. Eine Summe wäre bei sechs Kolonien das Sechsfache des
Deckels; „auf jedem Planeten eine bauen" wäre keine Entscheidung, sondern Fleißarbeit – und eine
Falle für jeden, dessen Minenschiffe auf einer Kolonie ohne Anlage stehen.

**Nicht gebaut: die Forschung `raufbereitung`** (−4 % Energieverbrauch je Stufe, Abschnitt 7). Sie
war die Entlastung gegen einen Preis, der auf der **ganzen** Ladung lag. Mit Abweichung 2 gibt es
diese Last nicht mehr: Wer den Energiepreis nicht zahlen will, baut die Anlage einfach nicht weiter
aus. Dazu kam ein konkreter Nebeneffekt – die Meilenstein-Gruppe `bergbau` besteht aus
`rminentechnik` + `rfoerderung`, und eine dritte Forschung darin hätte den Fortschrittsanteil aller
bestehenden Spieler von 6/11 auf 6/19 gedrückt und den bereits verdienten Meilenstein
„Bergbau-Meisterschaft I" wieder aberkannt.
- **Reicht die Energie nicht, sinkt die Ausbeute anteilig** – der unaufbereitete Rest ist Schlacke und
  weg. Deshalb nennt die **Startvorschau** die voraussichtlichen Energiekosten, genau wie sie heute
  schon vor knappem Frachtraum warnt (`EXPEDITION_MAX_RESOURCE_FIND_BASE` Z. 18062 existiert für
  exakt diesen Zweck). Eine Warnung vorher ist ehrlich; ein stiller Verlust nachher wäre es nicht.
- **Bergbau-Welt-Rolle** (Z. 41148) und **Produktionsring** der Orbitalstation wirken auch hier.

> **Die 1,5 sind der Stellknopf dieses Konzepts und ausdrücklich noch nicht gemessen.** Bei einer
> Ladung von 5.400 sind das 8.100 Energie – für ein Imperium mit mehreren Kolonien gut eine Minute
> Stromproduktion, also spürbar, aber keine Bremse. Ob das die richtige Höhe ist, lässt sich nicht
> am Reißbrett entscheiden, sondern nur an einem echten, weit entwickelten Spielstand. Vor der
> Auslieferung von Phase 2 gehört genau diese Zahl gemessen – CLAUDE.md-Regel 11: Behauptungen in
> Patchnotes werden vorher gemessen, und „Energie ist jetzt der Engpass" wäre eine.

Damit ist die Basis umgebaut, ohne eine einzige neue Ressource:

| | vorher | nachher |
|---|---|---|
| **Erz, Kristalle, Deuterium, Antimaterie** | Mine/Raffinerie/Synth/Reaktor | Abbaumissionen (Hauptteil) + gedeckelte Grundlast |
| **Energie** | ein Rohstoff wie jeder andere | **Betriebsstoff der Aufbereitung** – wer mehr verarbeiten will, baut Kraftwerke |
| **Rolle der Basis** | Bergwerk | **Kraftwerk und Hütte** |
| **Rolle der Flotte** | Kämpfen, erkunden, plündern | **plus: Nachschub** |

**Ausdrücklich nicht vorgeschlagen: eine neue Zwischenressource „Rohgestein".** Sie wäre thematisch
naheliegend – die Ladung *ist* ja Gestein –, würde aber **zwei getrennte Pfade** anfassen, die beide
bedient werden müssen und von denen keiner den anderen absichert: `costAmountAvailable()` (Z. 18603,
„kann ich das bezahlen") und `pay()` (Z. 18677, „bezahle es"). Dazu den Lagerdeckel, die
Tier-2-Klemmung in `gainResources()` (Z. 18695) und jede Anzeige, die eine Ressourcenliste aufzählt.
Die Ausbeute-Rechnung beim Entladen erreicht denselben Design-Effekt für einen Bruchteil des
Aufwands: Das Gestein existiert nur für die Dauer eines Entladevorgangs, nie als Bestand.

> Anmerkung zur Quellenlage: `docs/freiflug-konzept.md` nennt für diese Verdrahtung einen Wächter
> `tests/test_kostenschluessel.js`. **Den gibt es im Repo nicht** (Stand v8.476.0, geprüft) – ebenso
> wenig stimmen die dortigen Zeilennummern für `costAmountAvailable`/`pay` noch. Wer sich beim Bau
> eines neuen Kostenschlüssels auf diesen Test verlässt, verlässt sich auf nichts. Das ist kein
> Argument gegen das Freiflug-Dokument, sondern die übliche Verrottung von Zeilenangaben in einer
> Datei mit 57.686 Zeilen – und ein Beleg dafür, warum CLAUDE.md-Regel 10 verlangt, Befunde aus
> zweiter Hand vor dem Weitergeben am Code nachzuprüfen.

### 5.5 Was durch den Rundflug ersatzlos wegfällt

Die erste Fassung dieses Konzepts hatte einen **Förderposten**: stationierte Schiffe, die dauerhaft
in Richtung Heimat fördern. Das klang nach Idle-Spiel, zog aber eine lange Kette Folgeprobleme nach
sich. Der Rundflug löst sie alle drei auf einmal – nicht durch eine bessere Lösung, sondern indem er
die Fragen gar nicht erst stellt:

| Weggefallen | Warum es weg ist |
|---|---|
| **`gesamtRatenProSekunde()`** und die Umstellung von sieben Aufrufstellen | Es gibt keine laufende Asteroidenrate mehr. `ratesPerSecond()` bedeutet weiterhin „Produktion aus Gebäuden" und stimmt damit auch weiterhin. Eine heimgebrachte Ladung ist ein Ereignis wie Expeditionsbeute – dass die nicht in der Rate/Sekunde auftaucht, ist seit jeher so und hat noch nie jemanden verwirrt. |
| **Die Anbindung an `applyOfflineProgress()`** | Missionen laufen über `checkMissions()`, das Rückkehrzeiten ohnehin gegen `Date.now()` prüft – eine Flotte, die während der Abwesenheit heimkommt, wird beim nächsten Laden ganz normal aufgelöst. Die Funktion mit der dichtesten Regel-Geschichte des Projekts (Phantom-Sekunden, 90-s-Schwelle, Doppelgutschrift) wird **gar nicht angefasst**. |
| **Der `collect`-Endpunkt und das Save-Wettrennen** | Der Server schreibt den Spielstand nie. Er entscheidet beim **Start** der Mission, wie viel dem Vorkommen entnommen wird (Abschnitt 6.4), und das war's. Die Gutschrift passiert rein clientseitig bei Rückkehr, wie bei jeder anderen Mission. |

Das waren zusammen die zwei größten Risiken aus Abschnitt 12.1 und die fehleranfälligste Phase des
Umsetzungsplans. **Der Rundflug ist damit nicht nur die schönere Spielidee, sondern auch die
deutlich billigere.**

Was er kostet: Das Spiel wird an dieser Stelle *aktiver*. Wer acht Stunden weg ist, findet seine
Flotte zu Hause stehen statt ein volles Lager. Genau dafür gibt es die lange Abbauzeit großer
Ladungen – wer vor dem Schlafengehen einen Kern mit vollem Laderaum anfliegt, hat am Morgen die
Ladung und ein Schiff, das auf den nächsten Befehl wartet.

---

## 6. Anspruch, Besitz und Streit

### 6.1 Das Schürfrecht

Ein **Schürfrecht** reserviert ein Vorkommen für genau einen Spieler: Nur er darf dort
Abbaumissionen fliegen. Es entsteht mit der Anmeldung und hält, bis er es aufgibt oder verliert.

Ohne Schürfrecht ist ein Vorkommen **für jeden offen** – dann ist es ein Wettrennen um den Vorrat,
und wer zuerst da ist, hat ihn. Das Recht ist also kein Zugangstor zum Abbau, sondern der Schutz
einer Investition: Es lohnt sich für die Brocken, die man dauerhaft bewirtschaften will.

**Anspruchslimit** – der wichtigste Balance-Hebel des ganzen Systems:

| Quelle | Rechte |
|---|---|
| Grundstock | 2 |
| Forschung `rschuerfrecht` (3 Stufen) | +1 je Stufe |
| **Maximum** | **5** |

Warum 5 und nicht 8 – und warum sich die Begründung dafür im Lauf dieses Dokuments zweimal geändert
hat – steht in **Abschnitt 3.6**.

Bei rund 90 Vorkommen und 5 Rechten je Spieler trägt die Galaxie etwa **18 vollausgebaute
Schürf-Imperien** – bei heute 10 registrierten Konten also mit Luft, aber ohne Überfluss. Der Wert
gehört als benannte Konstante an genau eine Stelle, nicht verstreut in Formeln; er wird sich ändern.

### 6.2 Wer hält ein Schürfrecht

Ein Schürfrecht wird **nicht** von den Minenschiffen gehalten – die kommen ja mit jeder Fahrt wieder
heim. Es wird von einer **zurückgelassenen Eskorte** gehalten: Kampfschiffe, die vor Ort bleiben.

Das trennt die beiden Rollen sauber, und zwar so, wie es sich auch spielt:

- **Minenschiffe holen.** Sie fliegen hin, graben, kommen zurück (Abschnitt 5).
- **Eskorte hält.** Sie bleibt liegen, produziert nichts und ist das Einzige, was zwischen dem
  Vorkommen und einem fremden Angriff steht.

Wer ein Recht ohne Eskorte anmeldet, hält es trotzdem – aber jeder Angreifer nimmt es ihm mit einem
einzigen Jäger ab. **Ein unbewachtes Schürfrecht ist eine offene Einladung, und man sieht es auf der
Karte** (gestrichelter Ring, Abschnitt 9). Fällt die Eskorte auf null, ohne dass jemand angreift,
bleibt das Recht bestehen; es ist dann nur wehrlos.

Missionstyp **`mining-escort`** bringt die Eskorte hin, **`mining-recall`** holt sie zurück. Beides
sind gewöhnliche Verlegungen mit Flugzeit, Treibstoff und einem Flottenslot – dasselbe Muster wie der
Recycler-Sammelauftrag, der ebenfalls einen Slot belegt, solange er läuft.

### 6.3 Anfechtung

Missionstyp **`asteroid-contest`**: eine Kampfflotte gegen die stationierte Eskorte des Halters.

- **Serverautoritativ** aufgelöst, Muster von `/api/attack` (Z. 2920) und `/api/moonsiege/resolve`
  (Z. 6845). Der Angreifer schickt **keine Stärke mit** – der Server rechnet sie aus dem gespeicherten
  Spielstand nach, wie es `computeScoreServer()` für die Bestenliste tut.
- **Verliert der Halter**, geht das Schürfrecht über; seine überlebende Eskorte fliegt automatisch
  heim (dasselbe Muster wie die selbstständige Rückkehr des Recycler-Sammelauftrags).
  **Der Vorrat bleibt, wo er ist** – man erobert eine Quelle, keine Beute. Das ist wichtig, sonst
  wird Anfechtung zum Raubzug statt zum Revierkampf.
- **Eine gerade laufende Abbaumission des Halters wird nicht abgefangen.** Ihre Ladung ist beim Start
  bereits dem Vorkommen entnommen und serverseitig verbucht (Abschnitt 6.4); sie kommt normal heim.
  Wer ein Recht erobert, gewinnt die *Zukunft* des Vorkommens, nicht die Fahrt, die schon läuft. Die
  Gegenregel wäre verlockend, hieße aber, dass ein Angriff im richtigen Moment eine fremde Ladung
  klaut – und damit wäre die Anfechtung wieder ein Raubzug.
- **Schutzfrist 2 Std.** nach jedem Besitzwechsel: kein Ping-Pong im Minutentakt.
- **Abklingzeit 4 Std.** je Angreifer und Vorkommen: kein Zermürben durch Wiederholung.
- **Allianzmitglieder des Halters können nicht anfechten.** Sonst wird jede Allianz zum
  Selbstbedienungsladen.
- **Benachrichtigung** an den Halter über den vorhandenen Push-Kanal (`pushNotificationEvent`,
  genutzt u.a. in `handleSharedStorageWrite` Z. 1089) mit eigener Einstellung in den
  Benachrichtigungs-Präferenzen – wer nicht geweckt werden will, wird nicht geweckt.

#### 6.3.1 Umsetzungsentscheidungen (14.08.2026, vor der Implementierung)

Beim Ausschreiben des Endpunkts sind vier Fragen aufgefallen, die der Entwurf oben offen lässt.
Sie stehen hier, weil jede von ihnen den Unterschied zwischen „funktioniert" und „ist ausnutzbar"
ausmacht.

**Wo steht die Angriffsflotte, während sie fliegt?** Nicht in `save.fleet` – sie ist unterwegs.
Hätte der Server die Stärke von dort gelesen, würde er jede *ehrliche* Anfechtung als „keine
Schiffe" ablehnen. Das ist dieselbe Falle wie bei der Eskorte in Phase 4 (Abschnitt 6.2): Sie
steht in `save.fleet.missions[].composition`, und genau von dort liest der Server sie. Der
Angreifer schickt weiterhin **keine Stärke** mit, er nennt nur die Missions-ID.

**Derselbe Anflug darf nicht zweimal eingelöst werden.** Ohne eine Merkung je Missions-ID genügte
ein wiederholter Aufruf mit derselben ID, um eine Eskorte in Sekunden aufzureiben. Das Felddokument
führt deshalb `abgerechnet: { <missionId>: ts }`.

**Auch ein gewonnener Angriff kostet Schiffe.** Fielen die Verluste des Siegers auf null, wäre eine
Übermacht ein Freifahrtschein und das Bewachen eines Rechts sinnlos. Der Verlustanteil des
Angreifers hängt deshalb an der Stärke der Eskorte; die Trefferchance liegt im selben 10–90-%-Band
wie der PvP-Kampf.

**Wer verbucht die Verluste?** Das naheliegende Vorbild `/api/moonsiege/resolve` schreibt den
Spielstand des Angreifers direkt (`setSaveValue`) – genau das Wettrennen zwischen Server-Schreibung
und Client-Save, das Abschnitt 6.4 vermeidet. Hier nicht: Der **Angreifer** bekommt seine Verluste
in der Antwort und bucht sie selbst (Muster `mine`), der **Halter** erfährt sie über das
Felddokument, das ihm der nächste Feld-Abruf liefert. Dafür braucht der Eskorten-Abgleich im
Frontend die **Gegenrichtung**: Meldet der Server weniger Schiffe als lokal stehen, ist das ein
Kampfverlust – ausdrücklich **nur nach unten**, sonst könnte ein veraltetes Felddokument Schiffe
herbeizaubern.

**Bekommt die Benachrichtigung eine eigene Einstellung?** Der Entwurf oben sagt ja („mit eigener
Einstellung in den Benachrichtigungs-Präferenzen"). Bei der Umsetzung (14.08.2026) ist bewusst
davon abgewichen worden: Die Meldung läuft unter der vorhandenen Kategorie **`attack`**. Es *ist*
ein Angriff auf ihn, und wer Angriffs-Pushes abgestellt hat, will auch diesen nicht – eine eigene
Einstellung für eine einzelne Angriffsart wäre eine, die niemand findet. Die Liste in den
Einstellungen hat heute dreizehn Schalter; der vierzehnte hätte weniger erklärt als verwässert.
Zwei Folgen, beide erwünscht: Es gilt dieselbe **Anti-Flut-Drosselung** wie bei `/api/attack`
(`allowAttackPush`, Postfach-Eintrag immer, Handy-Push höchstens alle 30 Min.), und die
Beschreibung des Schalters musste mitgezogen werden – sie sagte „Wenn dich ein Spieler angreift"
und wäre sonst die nächste zweite Anzeigestelle mit der alten Annahme gewesen.

Der **Verteidiger bekommt bewusst keinen Bericht**, nur die Benachrichtigung: Ein Bericht wäre ein
Schreibvorgang in seinen Spielstand, und genau den vermeidet der Absatz darüber. Das Sprungziel der
Meldung ist deshalb die **Sektorkarte** (`karte`), wo der Rechtezustand steht – nicht der
Berichte-Reiter, in dem für ihn nichts läge.

### 6.4 Datenmodell und Endpunkte

**Ein Dokument je System**, `db.shared['asteroids:<systemId>']`:

```json
{
  "plaetze": {
    "4": { "sorte": "magnetit", "groesse": "kern", "vorrat": 431200,
           "halter": "<userId>", "halterName": "Sascha", "tag": "KEP",
           "seit": 1754800000000, "schutzBis": 1754807200000,
           "eskorte": { "jaeger": 40, "waechter": 8 } },
    "7": { "sorte": "eiskern", "groesse": "splitter", "vorrat": 8400 },
    "9": { "frei": true, "nachschubAb": 1754880000000 }
  }
}
```

**Jetzt steht das ganze Feld drin, nicht nur die Abweichung** – seit der Nachschub wandert (3.3.2),
ist es Geschichte statt Formel. Ein Dokument führt 10 Plätze, rund 800 Byte; es gibt **20** davon,
zusammen etwa 16 KB. Das Limit sind 64 KB **je Schlüssel**.

Ein Platz mit `nachschubAb` ist ein reservierter Wiederbelegungs-Termin: Beim nächsten Lesen des
Feldes (`GET /api/asteroid/field`) prüft der Server, welche Termine fällig sind, und würfelt dort
neu aus. **Faul, ohne Timer** – auf dem Pi läuft kein Hintergrundjob, und es gibt nichts, was bei
einem Neustart hängenbleiben kann. Liest wochenlang niemand ein System, holt der erste Blick alles
auf einmal nach.

Vier eigene Endpunkte statt generischem Shared-Storage – CLAUDE.md ist an dieser Stelle unmissverständlich
(„Generischer Shared-Storage ohne Sonderregel ist für JEDEN eingeloggten Nutzer weit offen"):

| Endpunkt | Aufgabe | Serverseitig geprüft |
|---|---|---|
| `GET /api/asteroid/field/:systemId` | Feld lesen (mit fauler Nachwachs-Auflösung) | – |
| `POST /api/asteroid/mine` | **Beim Start** einer Abbaumission: Ladung aus dem Vorkommen entnehmen | Recht frei oder eigenes? Restvorrat? **Der Server entscheidet die Menge** und zieht sie sofort ab; der Client bekommt sie mitgeteilt |
| `POST /api/asteroid/claim` / `release` | Schürfrecht an- oder abmelden | Platz frei? Anspruchslimit? Eskorte wirklich im Spielstand? |
| `POST /api/asteroid/contest` | Anfechten | Schutzfrist, Abklingzeit, Allianz, Stärke aus dem Spielstand |

**Die Entnahme passiert beim START, nicht bei der Rückkehr** – das ist der Kern des Entwurfs. Der
Server führt Buch über den geteilten Vorrat und nichts sonst; die Gutschrift beim Spieler macht der
Client bei Heimkehr über `gainResources()`, genau wie bei jeder anderen Mission. Zwei Folgen:

- **Der Server schreibt nie den Spielstand.** Das Wettrennen zwischen Server-Gutschrift und
  Client-Save, das `/api/market/trade` bis heute hat, entsteht hier gar nicht erst.
- **Derselbe Brocken kann nicht zweimal verkauft werden.** Fliegen zwei Spieler gleichzeitig auf ein
  freies Vorkommen, bekommt der zweite nur, was der erste übrig gelassen hat – und er erfährt es beim
  Start, nicht nach einer halben Stunde Flug.

Der Preis dafür ist ehrlich zu benennen: Bricht die Verbindung zwischen `mine` und dem tatsächlichen
Missionsstart ab, ist die Ladung dem Vorkommen entnommen, ohne dass eine Flotte fliegt. Deshalb wird
`mine` **erst gerufen, wenn Treibstoff und Slots bereits geprüft sind**, und die Antwort ist das,
was die Mission in `m.ladung` einfriert. Schlägt der Aufruf fehl, startet die Mission nicht.

**Warum das ohne Sperren sicher ist:** Derselbe Grund, den der Kommentar über der Modulbörse
(server.js Z. 5202 ff.) bereits ausformuliert – der gesamte Zustandswechsel eines Endpunkts läuft
**synchron in einem Tick**, das erste `await` steht erst hinter `saveDb()`. Zwei gleichzeitige
Ansprüche auf denselben Platz können sich nicht überlappen; der zweite findet ihn belegt. Dieses
Muster wird übernommen, nicht neu erfunden – und der Grund gehört als Kommentar an den Endpunkt,
sonst „repariert" ihn irgendwann jemand kaputt.

**Die ehrliche Vertrauensgrenze**, ebenfalls nach dem Vorbild der Modulbörse: Der Spielstand wird vom
Client geschrieben. Wer ihn manipuliert, kann Schiffe behaupten, die er nicht hat. Der Server prüft
**Besitz im gespeicherten Spielstand** und die `SAVE_SANITY_LIMITS` (Z. 2517) – mehr nicht, und mehr
behauptet dieses Konzept auch nicht. Das ist dieselbe Grenze wie überall sonst im Spiel; sie durch
das Asteroidensystem zu verschieben, wäre ein eigenes Vorhaben.

**Neue Zahlenfelder im Spielstand** (Schürfrechte, eingefrorene Ladungen) sind gegen `saveSanityViolation()`
(Z. 2535) zu prüfen, **bevor** sie live gehen. CLAUDE.md hält den Vorfall vom 21.07.2026 fest, bei
dem ein zu enges Limit das Speichern für entwickelte Konten komplett eingefroren hat – mehrere
Stunden Fehlersuche, Symptom „immer 8 Std. offline". Konkret: `asteroidClaims` ist ein kleines
Objekt und fällt unter keine bestehende Prüfschleife, die Eskorten-Schiffszahlen laufen als
Flotte durch `maxShipsPerType` (1e9, unkritisch); `m.ladung` ist eine Ressourcenmenge und muss unter
`maxResourceValue` (1e15) bleiben, was bei Laderäumen im Tausenderbereich nie eng wird. **Trotzdem vor dem Merge einmal mit einem
Vollausbau-Spielstand gegen den echten Endpunkt geprüft**, nicht nur überlegt.

---

## 7. Neue Inhalte im Überblick

Jeder Eintrag bringt laut CLAUDE.md-Regel 7 **eigenes Icon und vollständige Beschreibung** mit – ein
ganzer Satz, der Wirkung und Deckel nennt, kein Kürzel-Text.

### Forschungen (`RESEARCH_DEFS`, Z. 10575)

| `key` | Name | Stufen | Wirkung |
|---|---|---|---|
| `rminentechnik` | Minentechnik | 1 | Schaltet das Minenschiff, die Aufbereitungsanlage und den Missionstyp Abbaumission frei. Erste Stufe des ganzen Zweigs. |
| `rfoerderung` | **Fördertechnik** | 10 | **+4 % Abbaurate und +4 % Laderaum des Minenschiffs je Stufe** (bei Vollausbau je +40 %). Beide Werte additiv in die bestehende gedeckelte Bonus-Gruppe – keine eigene Multiplikation. |
| `rschuerfrecht` | Bergbaurecht | 3 | +1 gleichzeitiges Schürfrecht je Stufe (2 → 5). |
| `rtiefenscan` | Tiefenscan-Array | 5 | Deckt Sorte und Größe unerkundeter Vorkommen im eigenen und je Stufe einem weiteren Nachbarsystem auf, ohne Anflug. |
| ~~`raufbereitung`~~ | Aufbereitungstechnik | 8 | **Nicht gebaut** (Begründung in 5.4): Der Energiepreis liegt nur auf den Zusatzeinheiten, eine Entlastung dagegen braucht es nicht – und eine dritte Forschung in der Gruppe `bergbau` hätte den bereits verdienten Meilenstein „Bergbau-Meisterschaft I" wieder aberkannt. |

**`rfoerderung` ist die Forschung, die das Minenschiff wirklich besser macht** – und sie hebt
bewusst **beide** Werte zugleich, statt sie auf zwei Zweige zu verteilen. Der Grund steht in
Abschnitt 5.3: Abbaurate und Laderaum bestimmen gemeinsam die Abbauzeit
(`Ladung ÷ Rate`). Wüchse nur der Laderaum, würde jede Stufe die Fahrten *länger* machen und sich
wie eine Verschlechterung anfühlen; wüchse nur die Rate, brächte jede Fahrt gleich viel und nur
schneller. Zusammen ergeben sie das, was ein Spieler erwartet: **mehr pro Fahrt bei gleicher
Fahrtdauer.**

Konkret, an einer Flotte aus 5 Minenschiffen an einem Kern (Güte ×2,0), ohne Frachter:

| Fördertechnik | Abbaurate | Laderaum | Abbauzeit | Ertrag je Stunde Abbau |
|---|---|---|---|---|
| Stufe 0 | 6,00/s | 2.000 | 5,6 min | 21.600 |
| Stufe 5 | 7,20/s | 2.400 | 5,6 min | 25.920 |
| Stufe 10 | 8,40/s | 2.800 | 5,6 min | 30.240 |

Die Abbauzeit bleibt konstant, der Ertrag steigt um 40 %. Genau so soll sich eine Forschung anfühlen.

### Gebäude (`BUILDING_DEFS`)

| `key` | Name | maxLevel | Wirkung |
|---|---|---|---|
| `aufbereitung` ✅ | Aufbereitungsanlage | 20 | **Gebaut (v8.485.0), abweichend:** Zuschlag auf die volle Ladung, **+1,5 Prozentpunkte je Stufe** (Vollausbau **+30 %**), **12 Energie je Zusatzeinheit**. Es zählt die höchste Anlage im Imperium. Siehe 5.4 und 12.2. |
| `schuerfleitstand` | Schürfleitstand | 10 | −2 % Flugzeit für Abbau- und Anfechtungsmissionen je Stufe (Boden −20 %), zahlt in dieselbe Gruppe wie Navigator und Konvoi-Doktrin ein. |

### Schiffe

**Minenschiff** – das vorhandene **Schürfschiff** (`schuerfschiff` Z. 17323), siehe Abschnitt 5.2:
0,60/s Abbaurate und 400 Laderaum je Schiff, künftig regulär über `rminentechnik` freigeschaltet
statt nur über das Goldrausch-Event.

**Bergungsfrachter** (`bergungsfrachter`) – optional, für später: doppelter Laderaum des Großen
Frachters (3.000), halbe Geschwindigkeit, kein Angriffswert. Er lohnt sich genau dann, wenn die
Flugzeit klein gegen die Abbauzeit ist – also bei den großen Brocken weit draußen. Bewusst als
**Phase-5-Inhalt** markiert: Frachter und Großfrachter decken den Bedarf zunächst vollständig ab,
und ein drittes Frachtschiff, bevor die Mechanik steht, ist Ballast.

### Module und Kosmetik

- Standort-Modul **Förderleitwerk** (`foerder`): +% Abbaurate für Abbaumissionen, die von diesem
  Standort starten – reiht sich in die vorhandene `moduleBonusAt()`-Familie ein.
- Schiffs-Modul **Bohrkopfverstärkung** für die Minenschiff-Klasse (Abbaurate), und **Erweiterter
  Laderaum** wirkt über `shipModuleBonusFor('frachter','cargo')` bereits heute auf die mitgeschickten
  Frachter – dort ist nichts zu bauen.
- Neun gezeichnete Asteroiden-Icons (eins je Sorte) plus ein Icon für die Aufbereitungsanlage und
  eins für den Schürfleitstand.
- Ein eigenes Icon für die **Schürfpeilung** (Abschnitt 3.7) – ein markierter Brocken mit Peilkreuz,
  damit sie sich auf der Karte auf einen Blick von einem regulären Vorkommen unterscheidet. Dazu ein
  vollständiger Beschreibungssatz in der Berichtszeile, der Größe, Sorte **und Verfallsdatum** nennt:
  Eine Peilung, die stillschweigend abläuft, wäre genau der Fehler, den CLAUDE.md-Regel 7 mit
  „vollständige, selbsterklärende `desc`" meint.

**Zu den `ti-*`-Icons:** Die Whitelist umfasst 69 Glyphen, und `ti-pick`, `ti-mountain`, `ti-diamond`,
`ti-droplet`, `ti-atom-2`, `ti-target` und `ti-flag` sind alle dabei – für die UI-Beschriftungen ist
also nichts nachzubauen. Die **Vorkommen selbst** bekommen trotzdem handgezeichnete SVGs in `ICONS`:
Neun Sorten, die sich auf der Karte unterscheiden sollen, sind mit zwei Tabler-Symbolen nicht
darstellbar. Sollte doch ein neues `ti-*` gebraucht werden, gilt der Weg aus CLAUDE.md
(CSS-Regel ergänzen → `node build-icon-subset.js` → `node check-icons.js`) – ein neues `ti-*`
einzubauen reicht seit v8.296.0 nicht mehr aus, der Glyph fehlt sonst im Subset-Font.

### Die Anzeigestellen, die mitgezogen werden müssen

CLAUDE.md-Regel 6 in Listenform – nach dem Umbau **erst greppen, dann committen**:

- **`ratesPerSecond()` wird nicht angefasst** – siehe Abschnitt 0 (3) und 5.5. Es gibt keine
  laufende Asteroidenrate, also auch keine Anzeigestelle, die dadurch veralten könnte. Wer beim Bauen
  auf die Idee kommt, den Ertrag „der Vollständigkeit halber" doch einzurechnen: Das sind sechs
  Belohnungsformeln, keine Anzeige.
- **HELP_SECTIONS**: neuer Abschnitt „Asteroiden und Schürfrechte"; **bestehende** Abschnitte
  „Trümmerfelder" (Z. 33741) und „Planetentypen" (Z. 33750) prüfen – letzterer sagt heute
  „Asteroiden … haben keinen Typ-Bonus", und dieser Satz meint den *Planetentyp*, nicht das neue
  Vorkommen. Er wird mit einem Halbsatz entschärft, sonst widerspricht er der neuen Mechanik dem
  Anschein nach.
- **TUTORIAL_STEPS**: Der Schritt „Erkunden & Kolonisieren" (Z. 27833) beschreibt das Kartenmenü und
  muss die neue Aktion nennen.
- **`effectDesc`** der fünf gedeckelten Gebäude: Sie nennen heute keinen Deckel, weil es keinen gab.
- Die **Startvorschau der Abbaumission** ist selbst eine Anzeigestelle und muss aus denselben
  Funktionen rechnen wie die Auflösung – Flugzeit, Ladung, Ausbeute, Energiekosten. Die
  Frachtraum-Warnung der Expeditionen ist der Präzedenzfall: Ihr fehlte bis zum 01.08.2026
  `codexExpeditionBonus()`, sie schätzte deshalb bis zu 13 % zu niedrig und meldete „passt", wo die
  Beute nicht mehr in den Laderaum ging. Genau dafür gibt es die Warnung, und genau so bricht sie.
- **Tagesaufgaben und Erfolge**: bewusst zuerst *ohne* Asteroiden-Bezug ausliefern und erst in Phase 5
  ergänzen – ein Erfolg, der eine Mechanik voraussetzt, die noch nicht rund läuft, ist eine
  Beschwerde mit Ankündigung.

---

## 8. Solo-Modus

`useBackend()` (Z. 4045) ist `false`, solange kein Konto angemeldet ist – und laut CLAUDE.md ist
„Solo-Modus funktioniert ohne Server" eine Architektur-Zusage, keine Nebenbemerkung. Umkämpfte
Schürfrechte gibt es dort nicht.

**Der Rundflug macht das leicht.** Die Abbaumission (Abschnitt 5) ist von Anfang bis Ende
Client-Mechanik: Flotte los, Abbauzeit, `checkMissions()` löst auf, `gainResources()` bucht. Der
Server wird ausschließlich für den **geteilten Vorrat** und die **Schürfrechte** gebraucht.

Im Solo-Modus fällt beides weg: Alle Vorkommen sind unbeansprucht, der Vorrat lebt lokal in `state`,
es gibt keine Anfechtung und kein Anspruchslimit. **Der komplette Kernkreislauf läuft trotzdem** –
Auswählen, Flotte schicken, Ladung heimbringen, Aufbereitung ausbauen. Solo-Spieler verlieren die
soziale Ebene und sonst nichts. Das ist ein deutlich besseres Ergebnis als beim Förderposten-Entwurf,
wo der Solo-Modus ein Sonderfall der Ertragsbuchung geworden wäre.

**Die große Lösung** – NPC-Konkurrenzsyndikate, die im Solo-Modus Vorkommen halten und anfechten –
wäre reizvoll, ist aber ein eigenes Vorhaben in der Größenordnung der Piraten-Trümmerräuber
(`maybeSchedulePirateDebrisRaid` Z. 23520 und die Auflösungskette daran). Sie gehört **nicht** in
dieses Konzept; wenn sie kommt, dann als Phase 6 mit eigener Bewertung.

---

## 9. Wo es im Spiel auftaucht

**Auf der Sektorkarte** (aufgeklapptes System): ein Gürtel zwischen den Orbits, darin die Vorkommen
als gezeichnete Brocken in der Farbe ihrer Sorte. Am Rand jedes beanspruchten Brockens ein kleiner
Ring in der Farbe des Halters – **eigene grün, Allianz blau, fremde rot**, unbewacht (keine Eskorte)
**gestrichelt**. Damit ist die Antwort auf „wo lohnt sich eine Anfechtung" ein Blick, kein Menü.

**Im Kartenmenü**: **Abbaumission** · Schürfrecht anmelden · Eskorte verlegen · Anfechten – jeweils
mit Flugzeit und Kosten darunter oder dem Grund, warum der Eintrag grau ist („Kein Minenschiff auf
diesem Standort"). Exakt die Konvention, die HELP_SECTIONS Z. 33746 für das Kartenmenü schon
festschreibt.

**Die Startvorschau** ist der wichtigste Bildschirm des ganzen Features, weil dort die Entscheidung
fällt. Sie nennt in einer Zeile: *Hinflug 4:12 · Abbau 12:30 · Rückflug 4:12 · Ladung 5.400
(Erz 3.240 / Kristalle 2.160) · Treibstoff 612 Deuterium · Aufbereitung ~8.100 Energie.* Jede dieser
Zahlen kommt aus derselben Funktion, die sie hinterher abrechnet.

**Neue Box „Schürfbetrieb"** im Flotte-Tab, Unterreiter „Missionen": oben die laufenden
Abbaumissionen mit Phase (Anflug / Abbau / Rückflug) und Restzeit, darunter die gehaltenen
Schürfrechte mit Sorte, Größe, Restvorrat, Eskorte und Schutzfrist. Sie enthält Countdowns, gehört
also **nicht** unter das Signatur-Cache-Muster mit Wertliste, sondern unter **`setBoxHtml()` mit
Markup-Signatur** (Z. 20099 ff. beschreibt die Unterscheidung): Läuft ein Countdown, ist das Markup
jede Sekunde anders und die Box wird neu geschrieben; steht keiner, steht sie still. Die Prüfung ist
selbstkorrigierend – genau der Grund, warum es dieses Muster gibt.

**Achtung bei der Bedienung:** Die Box bekommt eine Schiffszahl-Eingabe und eine Vorkommens-Auswahl.
Beides sind Bedienzustände, die nur im DOM stecken und den Neuaufbau im Sekundentakt nicht überleben
– CLAUDE.md listet genau diese drei Ausprägungen (`<details>`, `<select>`, Scrollposition) als am
25.07.2026 real aufgetretene Spielerfehler. Also von Anfang an `isTypingIn()` für das Eingabefeld,
`data-keep-value` + `selectedAttrFor()` für die Auswahl.

**Im Basis-Tab**: die Aufbereitungsanlage mit einer ehrlichen Ausbeute-Zeile („Stufe 12 – deine
Aufbereitung holt **88 %** aus dem Gestein. Vollausbau: 100 %.") und, nach jeder Heimkehr, der
tatsächlichen Abrechnung im Bericht: *Ladung 5.400 · aufbereitet 4.752 (88 %) · 7.128 Energie
verbraucht.*

---

## 10. Umsetzung in fünf Phasen

Jede Phase ist für sich auslieferbar und lässt das Spiel in einem sinnvollen Zustand zurück. Das ist
keine Förmlichkeit: Seit dem Deploy-Webhook **ist der Merge die Auslieferung** – was gemerged wird,
steht Sekunden später auf `gamegeeeeek.de`.

| Phase | Inhalt | Backend? | Risiko |
|---|---|---|---|
| **1** ✅ | Feldgenerierung, Darstellung auf der Karte, Kartenmenü, **Abbaumission** mit Vorschau und Bericht, Minenschiff regulär freigeschaltet | nein | ausgeliefert mit v8.479.0 |
| **2** ✅ | Aufbereitungsanlage (Ausbeute + Energiekosten), Forschungen, **Schürfpeilungen aus Expeditionen**, Hilfe/Tutorial | nein | ausgeliefert: Peilungen v8.482.0, Anlage v8.485.0. Die Energie je Einheit ist **gemessen** und liegt bei 12 statt der veranschlagten 1,5 (Abschnitt 12.2) |
| **3** ✅ | **Deckel + Bestandskonten-Ausgleich** | nein | ausgeliefert mit v8.486.0. Der Verlust ist **gemessen** (Abschnitt 4.2), der Ausgleich läuft einmalig beim Laden. **Nicht** umgesetzt: das zusätzliche Schürfrecht aus 4.3 – Schürfrechte gibt es erst mit Phase 4 |
| **4** ✅ | Geteilter Vorrat: Feld-Dokumente, wandernder Nachschub, `mine`, Schürfrechte, Anspruchslimit | **ja** | Schritt 1 (geteilter Vorrat) ausgeliefert mit v8.487.0/#98, Schritt 2 (Schürfrechte, Eskorte, Anspruchslimit) mit v8.489.0/#100. Abweichungen: (a) `schutzBis` wird noch NICHT geschrieben – das ist ein Phase-5-Feld, der claim-Endpunkt legt es erst mit der Anfechtung an; (b) die Eskorte wird über den claim-Endpunkt abgeglichen statt über eine eigene Route – der Server liest sie aus `save.asteroidEskorten` des GESPEICHERTEN Spielstands, nie aus dem Request (beim Stationieren haben die Schiffe die Heimflotte längst verlassen, eine Prüfung gegen `save.fleet` würde den ehrlichen Fall ablehnen); (c) `rschuerfrecht` steht bewusst in KEINER Meilenstein-Gruppe – „Bergbau-Meisterschaft“ ist mit den zwei Bestandsforschungen verdienbar, und eine nachträglich wachsende Gruppe würde einen erreichten Meilenstein wegrücken (derselbe Grund, aus dem `raufbereitung` nie gebaut wurde) |
| **5** ◐ | Anfechtung, Schutzfristen, Benachrichtigungen, Bergungsfrachter, Erfolge, Tagesaufgaben | **ja** | **Anfechtung ausgeliefert** (Backend #101, Frontend v8.491.0): `asteroid-contest`, Schutzfrist 2 Std., Abklingzeit 4 Std., Allianz-Sperre, Verluste beidseitig, Vorrat unangetastet. **Benachrichtigung ausgeliefert** (Backend #102, Frontend v8.494.0): `asteroid-contested` an den Halter, Kategorie `attack` statt eigener Einstellung, Sprungziel Sektorkarte. Entscheidungen zu beidem in 6.3.1. **Noch offen:** Bergungsfrachter, Erfolge und Tagesaufgaben mit Asteroiden-Bezug |

**Phase 1 ist eigenständig spielbar.** Ohne Backend, ohne Schürfrechte, ohne Deckel: Man sucht sich
einen Brocken, schickt eine Flotte, bekommt eine Ladung. Wenn nach Phase 1 klar wird, dass sich der
Kreislauf nicht gut anfühlt, ist alles Weitere hinfällig – und es sind erst rund 600 Zeilen
geschrieben statt viertausend. Diese Reihenfolge ist der eigentliche Wert des Phasenplans.

**Phase 3 kommt bewusst nach Phase 2 und vor Phase 4.** Der Deckel darf erst greifen, wenn die
Alternative im Spiel **bereits sichtbar und benutzbar** ist – sonst ist es für ein paar Tage eine
reine Verschlechterung. Umgekehrt darf er nicht bis nach Phase 4 warten, sonst haben die schnellsten
Konten den Übergang schon hinter sich, bevor er beginnt.

---

## 11. Tests

Die Suite liegt unter `tests/` (186 Testdateien, `node tests/run.js`). Was hier dazukommt, gehört ins
Repo, nicht ins Scratchpad – CLAUDE.md ist an dem Punkt aus schmerzhafter Erfahrung deutlich. **Jeder
neue Test braucht eine Gegenprobe, und sie wird in beide Richtungen ausgeführt:** grün am neuen
Stand, rot am alten (`git show HEAD:weltraum_kolonie.html`).

| Test | Prüft | Gegenprobe |
|---|---|---|
| `test_asteroidenfeld.js` | **Erstbelegung** ist deterministisch (gleicher Seed ⇒ identisches Feld über zwei Läufe) und die ~20 Gürtelsysteme sind über das Raster gestreut, nicht geklumpt | – (neuer Inhalt) |
| `test_asteroiden_nachschub.js` | Nach dem Leerfördern: (a) der Platz bleibt bis `nachschubAb` frei, (b) das neue Vorkommen liegt auf einem **anderen** Platz – über 200 Durchläufe **kein einziges Mal** auf demselben, (c) kein System verlässt das Band 3–8, (d) über 2.000 Durchläufe nähert sich die Größenverteilung 46/34/16/4 | mit Nachwachsen am selben Platz fällt (b) sofort |
| `test_abbaumission.js` | Der ganze Kreislauf: Mission starten, Uhr vorstellen, `checkMissions()` auflösen – **vorher keine Ressourcen, nachher genau die Ladung**. Prüft ausdrücklich, dass zur Halbzeit noch **nichts** gutgeschrieben ist | mit Sofortgutschrift beim Start wäre die Zwischenprüfung rot |
| `test_abbau_laderaum.js` | Frachter erhöhen die Ladung, Fördertechnik erhöht Rate **und** Laderaum, und die Abbauzeit bleibt dabei konstant (Tabelle in Abschnitt 7) | ohne Laderaum-Anteil der Forschung sinkt die Abbauzeit statt gleich zu bleiben |
| `test_abbau_vorschau.js` | Die Startvorschau nennt dieselben Zahlen, die die Auflösung dann bucht – Ladung, Ausbeute, Energie. Prüft die **Regel** (Vorschau == Abrechnung), nicht einen Zeichenkettenvergleich | Vorschau mit eigener Formel weicht ab |
| `test_asteroiden_deckel.js` | Eine Mine auf Stufe 40 liefert nach dem Umbau die gerechnete Rate. Erwartungswert **im Test aus dem Spiel abgeleitet** (Rate messen), nicht eingetippt – Arbeitsregeln 2 und 7 | am alten Stand liefert sie die volle Rate |
| `test_aufbereitung.js` | Ausbeute steigt mit der Stufe; reicht die Energie nicht, sinkt sie anteilig **und die Meldung sagt es** | ohne Anlage-Stufe im Nenner bleibt die Ausbeute konstant |
| `test_peilung.js` | Eine Peilung erscheint als eigenes, **nur lokal** sichtbares Vorkommen; die vierte bei drei offenen wird in Rohstoffe gewandelt statt zu verfallen; nach 7 Tagen ist sie weg. Die Fundchance wird über 10.000 simulierte Expeditionen gegen die Sollwerte aus 3.7 geprüft, **nicht** an einer einzelnen Ziehung | ohne Obergrenze staut sich die vierte Peilung an |
| `test_schuerf_lagerdeckel.js` | Bei vollem Lager verfällt der Überschuss über dieselbe `cargoScale`-Kappung wie bei Expeditionen – kein Sonderweg | – |
| `test_schuerfbox_zustand.js` | Auswahl und Eingabefeld der Schürfbetrieb-Box überleben zehn Ticks (die `<select>`-Falle) | ohne `data-keep-value` springt die Auswahl zurück |
| `tests/asteroid.sh` (Backend) | `mine` zieht den Vorrat **beim Start** ab; zwei gleichzeitige Anfragen auf dasselbe Vorkommen können zusammen nie mehr entnehmen als drin war; Anspruchslimit; Anfechtung mit Schutzfrist. Echte HTTP-Requests gegen einen lokal gestarteten Server mit Test-DB in `/tmp` | – |

**Der wichtigste Test ist `test_abbaumission.js`, und zwar wegen seiner Zwischenprüfung.** „Ressourcen
erst bei Rückkehr" ist eine Regel, die man nur bemerkt, wenn man sie verletzt – ein Test, der bloß
den Endstand prüft, wäre auch bei sofortiger Gutschrift grün. Er muss zur Halbzeit ausdrücklich
nachsehen, dass noch nichts gebucht wurde.

Drei Fallen, die bei diesen Tests konkret drohen und die dieses Repo alle schon einmal bezahlt hat:

1. **Der Ertragstest misst die Bezugsgröße mit.** Ein Planeten-Ereignis kann die Produktion mitten im
   Messfenster multiplizieren (`nextPlanetEventCheck` ist bei frischen Fixtures 0, der erste Check
   feuert **garantiert**) – genau der Mechanismus hinter dem 121,5-%-Rätsel vom 09./10.08.2026.
   Ereignis-Uhren im Fixture in die Zukunft pinnen, **und** die Rate vor *und* nach dem Fenster
   messen und zuerst prüfen, ob sie sich gehalten hat.
2. **Der Backend-Test baut JSON nicht in der Shell zusammen.** Nutzlast mit `node -e` erzeugen und per
   `--data-binary @-` übergeben; Serverstart und Test im **selben** Bash-Aufruf, sonst verliert die
   Sandbox den Hintergrundprozess.
3. **Exit-Codes nie hinter einer Pipe messen.** `node test.js | grep FAIL; echo EXIT=$?` meldet den
   grep-Status. Ausgabe in eine Datei umleiten, `echo EXIT=$?` direkt dahinter.

---

## 12. Risiken

### 12.1 Die zwei, die wirklich wehtun

Es waren vier. Zwei davon – das Wettrennen zwischen Server-Gutschrift und Client-Save und die
Anbindung an `applyOfflineProgress()` – sind mit der Entscheidung für den Rundflug **ersatzlos
verschwunden**, nicht gelöst (Abschnitt 5.5). Was bleibt:

**Der Deckel trifft die treuesten Spieler am härtesten.** Wer am längsten spielt, hat die höchsten
Gebäudestufen und verliert am meisten. Der Ausgleich in 4.3 ist deshalb keine Geste, sondern Teil der
Mechanik – und der Patchnote nennt die Zahl, statt sie zu umschreiben.

**Der Wettlauf um Schürfrechte begünstigt, wer zuerst da ist.** Bei rund 90 Vorkommen und einem
Limit von 5 ist das in den ersten Tagen kein Problem, in einem Jahr vielleicht schon. Gegenmittel
sind vorhanden und billig: Anspruchslimit senken, Vorkommen je System erhöhen, Nachwachszeit
verkürzen. Alle drei sind Konstanten. Sie sollten **von Anfang an als benannte Konstanten an einer
Stelle stehen**, damit ein Nachziehen ein Einzeiler bleibt.

Dazu ein kleineres, aber konkretes Risiko: **`POST /api/asteroid/mine` entnimmt den Vorrat, bevor die
Mission steht.** Bricht dazwischen etwas ab, ist Erz aus dem Felsen verschwunden, ohne dass jemand es
bekommt. Deshalb wird der Aufruf als **letzter** Schritt des Missionsstarts gemacht – nach
Treibstoff-, Slot- und Schiffsprüfung – und sein Ergebnis ist das, was die Mission einfriert.
Schlägt er fehl, startet nichts. Der umgekehrte Entwurf (erst Mission, dann Server fragen) wäre
schlimmer: Dann flögen zwei Spieler los und einer käme leer zurück.

### 12.2 Die offene Entscheidung – erledigt, gemessen (11.08.2026, v8.485.0)

Die frühere offene Frage (was bei ausgelasteter Aufbereitung mit dem Überschuss geschieht) hat sich
mit dem Förderposten erledigt – es gibt keinen Durchsatz mehr, an dem sich etwas stauen könnte.

Offen war danach genau eine Zahl: **die Energie je aufbereiteter Einheit** (Abschnitt 5.4). Sie
entscheidet, ob die Aufbereitung ein echter Engpass ist oder eine Formalität, und damit, ob der
Umbau der Basis sein erklärtes Ziel erreicht. Sie ließ sich **nicht am Reißbrett festlegen**: Zu
niedrig, und Energie bleibt der Rohstoff, den man ignoriert; zu hoch, und jede Fahrt wartet auf den
Stromzähler. Die Zielgröße war **ein knappes Drittel der stündlichen Energieproduktion**.

**Gemessen wurde an einem konstruierten, weit entwickelten Spielstand** – nicht an einem echten
Konto, was hier ausdrücklich zur Aussage gehört: Heimat plus fünf Kolonien, Solar 35, Mine 30,
Raffinerie 30, Synth 28, Fusionsreaktor 22, Habitat 20, Lager 45, Labor 10, Forschung rsolar 15 /
rerz 15 / rkristall 12 / rdeuterium 12 / rantimaterie 8, dazu 16 Minenschiffe und 20 Frachter. Die
Zahlen kommen aus dem laufenden Spiel, nicht aus einer Nachrechnung:

| | pro Sekunde | pro Stunde |
|---|---|---|
| Energie | 186,25 | 670.516 |
| Erz | 104,57 | 376.462 |
| Kristalle | 30,57 | 110.050 |
| Deuterium | 22,66 | 81.568 |
| Antimaterie | 3,31 | 11.909 |

Eine durchgehend laufende Abbaumission an einem **Kern** (Vorschau des Spiels: Hinflug 6m 36s ·
Abbau 9m 54s · Rückflug 6m 36s, Ladung 13.700 bei 13.700 Laderaum) bringt damit **35.584 Erz je
Stunde – 9,5 % der eigenen Erzproduktion**. Bei +30 % Ausbeute sind das **10.675 Zusatzeinheiten je
Stunde**. Daraus die Preistabelle, die die Entscheidung getragen hat:

| Energie je Zusatzeinheit | Energiebedarf/Std | 1 Fahrt | 2 Fahrten | 3 Fahrten |
|---|---|---|---|---|
| 6 | 64.052 | 10 % | 19 % | 29 % |
| 9 | 96.078 | 14 % | 29 % | 43 % |
| **12** | **128.104** | **19 %** | **38 %** | **57 %** |
| 15 | 160.130 | 24 % | 48 % | 72 % |
| 21 | 224.182 | 33 % | 67 % | 100 % |

**Gewählt: 12 Energie je Zusatzeinheit** (`AUFBEREITUNG_ENERGIE`). Wer eine Flotte durchgehend
schürfen lässt, gibt ein Fünftel seiner Energie dafür aus; wer drei Flotten fahren lässt, mehr als
die Hälfte und muss Kraftwerke bauen. Das ist die Zielgröße, und der Patchnote darf sie deshalb
behaupten. **Die ursprünglich veranschlagten 1,5 wären 1,3 % gewesen** – unbemerkbar, also
wirkungslos; die Zahl war um den Faktor acht zu klein geraten, weil sie ohne Messung entstand.

Zwei Abweichungen vom Entwurf sind dabei bewusst entstanden, beide in Abschnitt 5.4 nachgetragen:
**Zuschlag statt Grundausbeute**, und der Preis fällt **nur auf die Zusatzeinheiten** an (bei 70 %
Grundausbeute hätte er auf die ganze Ladung gelegen; auf den Zuschlag gerechnet ist Stufe 1 kein
schlechtes Geschäft, sondern ein kleines gutes).

### 12.3 Was dieses Konzept ausdrücklich nicht vorschlägt

- **Keine neue Ressource** (siehe 5.4).
- **Keine „N Minuten eigene Produktion"-Belohnungen** irgendwo im neuen System – das Muster ist in
  CLAUDE.md als explosiv markiert, und ein Asteroidensystem ist genau der Ort, an dem es explodieren
  würde.
- **Keine eigene Multiplikator-Kette.** Förderboni gehen in die **bestehende additive, gedeckelte**
  Bonus-Gruppe, nicht als `×1,1 × 1,15 × 1,2`.
- **Kein Echtzeit-Abbau** und keine Steuerung im Freiflug-Sinn. `docs/freiflug-konzept.md` beschreibt,
  was das kosten würde; dieses Konzept bleibt bewusst im vorhandenen Missions-Takt.
- **Keine NPC-Konkurrenz im Solo-Modus** (siehe 8).

---

## 13. Aufwand, ehrlich geschätzt

| Phase | Frontend | Backend | Tests |
|---|---|---|---|
| 1 | ~600 Zeilen (Felderzeugung, SVG-Darstellung, Kartenmenü, Missionstyp, Vorschau, Bericht) | – | 4 |
| 2 | ~250 Zeilen (Gebäude, Ausbeute-Rechnung, Forschungen, Hilfe/Tutorial) | – | 2 |
| 3 | ~150 Zeilen (Deckel, Ausgleichsroutine, Patchnote) | – | 1 |
| 4 | ~350 Zeilen | ~300 Zeilen (3 Endpunkte, Feld-Logik, Rechteprüfung) | 1 + Backend-Test |
| 5 | ~400 Zeilen | ~250 Zeilen | 1 |

Gegenüber der Förderposten-Fassung sind das rund **550 Zeilen weniger**, und die eingesparten Zeilen
sind ausgerechnet die schwierigsten gewesen: die Umstellung von sieben `ratesPerSecond()`-Stellen,
die Anbindung an die Offline-Nachholung und der `collect`-Endpunkt mit seinem Save-Wettrennen.

Das Größte ist damit nicht mehr die Mechanik, sondern zwei alte Bekannte: die **Bestandskonten** in
Phase 3 und die **Startvorschau**, die dieselben Zahlen nennen muss wie die Abrechnung. Beides sind
kleine Diffs mit großer Reichweite – und beides ist genau die Sorte Änderung, bei der dieses Projekt
seine Fehler gemacht hat.
