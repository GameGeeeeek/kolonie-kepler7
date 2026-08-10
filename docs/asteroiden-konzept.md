# Konzept: Asteroiden-Bergbau und der Umbau der Basiswirtschaft

Stand: 10.08.2026 · Spielversion beim Verfassen: v8.476.0 · Zielversion: ab v8.480.0 (fünf Phasen)

Zeilennummern beziehen sich auf `weltraum_kolonie.html` bzw. `kolonie-kepler7-backend/server.js` im
Stand v8.476.0 (Commit 9e3ce47). Alle Aussagen über vorhandenen Code sind am Code nachgeprüft, nicht
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
Recyclern (`state.debrisFields`, `addDebris` Z. 45853, `renderDebrisBox` Z. 20096) sind exakt das
Muster „endlicher Vorrat an einem Ort, wird von dort stationierten Schiffen mit fester Rate/Sekunde
abgebaut, Lagerdeckel bremst, Piraten können ihn streitig machen". Expeditionen
(`EXPEDITION_TYPES` Z. 49584) sind das Muster „ausfliegen, am Frachtraum gedeckelt heimkehren", und
es gibt dort seit dem 24.07.2026 sogar schon einen Typ **`mining` „Schürfexpedition"**. Beide Muster
werden hier wiederverwendet statt neu erfunden – das ist der Hauptgrund, warum der Frontend-Teil
trotz seines Umfangs überschaubar bleibt.

**(3) Die gefährlichste Stelle ist `ratesPerSecond()` – und zwar nicht als Mechanik, sondern als
Anzeige- und Belohnungsquelle.** Die Funktion (Z. 19146) hat **13 echte Aufrufstellen** (21 Treffer
im Grep, davon 7 Kommentare und die Definition selbst), und sie zerfallen in **drei** Gruppen, die
sich beim Umbau unterschiedlich verhalten:

| Gruppe | Aufrufstellen | Verhalten beim Umbau |
|---|---|---|
| **Gutschrift** (2) | Haupt-Tick (56773), **Offline-Nachholung** `applyOfflineProgress` (39970) | Hier wird real gebucht. Der Asteroiden-Ertrag **muss** an beiden Stellen mitlaufen – sonst fördert man im Hintergrund-Tab und beim Wiederkommen nichts. |
| **Anzeige** (5) | `renderEmpireOverview` (14431), Bedarfslisten-Cache (19031), Ressourcenleiste in `render()` (51024), Ressourcen-Balken (54840), Statistik-Schnappschuss (56856) | Zeigen ohne Anpassung dauerhaft **zu wenig** an: Der Spieler liest „12 Erz/s" und sieht sein Lager viel schneller volllaufen – die klassische zweite Anzeigestelle mit der alten Annahme (CLAUDE.md-Regel 6). |
| **Belohnungsformeln** (6) | Fraktionsgeschenk (15378), Wochenliga **zweimal** (23745 serverautoritativ, 43773 lokaler Pfad), Tagesaufgaben (24695), Piratennest-Beute (41307), Pakt-Geschenk (44053) | Zahlen „N Minuten eigene Produktion" aus. Taucht der Asteroiden-Ertrag hier **auf**, wachsen alle diese Belohnungen mit – genau das explosive Muster, vor dem CLAUDE.md unter „Bekannte Fallstricke" ausdrücklich warnt. |

Die drei Gruppen brauchen also **verschiedene** Zahlen. Deshalb ist die zentrale
Architektur-Entscheidung dieses Konzepts nicht „wie viel Erz gibt ein Asteroid", sondern:

> `ratesPerSecond()` behält **unverändert** die Bedeutung „Produktion aus Gebäuden" und bleibt damit
> die Bezugsgröße aller Belohnungsformeln. Für Anzeige **und Gutschrift** kommt **eine neue Funktion**
> `gesamtRatenProSekunde()` hinzu, die Gebäude- und Asteroidenrate addiert. Die fünf Anzeigestellen
> und die zwei Gutschriftstellen werden auf sie umgestellt, die sechs Belohnungsstellen bleiben, wo
> sie sind.

Wer das umdreht (Asteroiden in `ratesPerSecond()` hineinrechnen), bekommt korrekte Anzeigen und eine
Wochenliga, die im Endgame ein Vielfaches ausschüttet. Wer beides gleich lässt, bekommt eine
Wirtschaft, die das Spiel dem Spieler falsch berichtet. Es gibt hier keinen dritten Weg, und die
Entscheidung muss **vor** der ersten Zeile Code fallen, nicht danach.

**Zwei Nebenbefunde aus derselben Durchsicht,** beide unabhängig von diesem Konzept:

- Die Wochenliga-Ausschüttung („N Minuten Produktion") steht **zweimal** im Code, in zwei Kopien
  derselben Schleife (Z. 23745 und Z. 43773). Wer die eine anfasst, muss die andere mitnehmen – das
  ist exakt die Fehlerfamilie, die CLAUDE.md-Regel 6 beschreibt. Für dieses Konzept ist es unkritisch
  (beide bleiben unverändert), für die nächste Balance-Änderung an der Wochenliga nicht.
- `applyOfflineProgress()` (39970) ist die Funktion mit der dichtesten Regel-Geschichte des
  Projekts – Phantom-Sekunden (v8.459.0), die 90-s-Schwelle, die Doppelgutschrift-Gegenrichtung
  (CLAUDE.md-Regeln 11, 12, 20, 21). Sie ist der Ort, an dem beim Asteroiden-Ertrag am ehesten etwas
  schiefgeht, und der Ort, an dem ein Fehler am schwersten zu bemerken ist. Abschnitt 12.1 sagt, was
  dort konkret zu prüfen ist.

---

## 1. Was das Konzept vorschlägt, in fünf Sätzen

Die Basis hört auf, die Hauptquelle für Material zu sein, und wird stattdessen **Kraftwerk und
Hütte**: Sie liefert Energie und veredelt, was die Flotte heranschafft. In jedem der 69 Sternsysteme
liegen **Vorkommen** – reine Asteroiden mit einem einzigen Rohstoff und seltenere
**Legierungsasteroiden mit zwei**. Man fliegt sie an: früh als Einzelflug mit begrenztem Laderaum,
später indem man Schürfschiffe **dort stationiert** und ein **Schürfrecht** anmeldet, das dann
dauerhaft fördert. Schürfrechte sind für alle Spieler dieselben Objekte, ihre Zahl ist knapp, und
wer eins will, das schon jemandem gehört, muss es sich **erkämpfen**. Der Durchsatz nach Hause ist
nicht die Fördermenge, sondern die **Aufbereitungsanlage** auf der Basis – dort entscheidet sich,
wie viel von dem, was draußen liegt, überhaupt ankommt.

---

## 2. Bestandsaufnahme: worauf aufgebaut wird

| Bereich | Vorhanden | Wiederverwendung |
|---|---|---|
| **Karte** | `buildGalaxyMap()` Z. 48047, `galaxyOeffne()` Z. 48029, Objekte als `data-map-npc`/`-moon`/`-debris` (Z. 48942, 49067, 49111), Handler Z. 49208–49230 | Ein neues `data-map-asteroid` reiht sich exakt in dieses Muster ein: SVG-Gruppe im aufgeklappten System, Klick öffnet das Kartenmenü |
| **Kartenmenü** | `npcMapMenu`/`moonMapMenu`, Schließen per Esc/Klick daneben (Z. 48541) | Neues `asteroidMapMenu(e, id)` mit denselben Konventionen (Flugzeit und Kosten unter jedem Eintrag, graue Einträge nennen den Grund) |
| **Missionen** | `cf.missions.push({type, targetId, startTime, endTime, composition})`, Auflösung in `checkMissions()` Z. 44790 | Vier neue `type`-Werte, kein neuer Missions-Mechanismus |
| **Flugzeit / Treibstoff** | `missionDurationFor()` Z. 19645, `missionFuelCostSplit()` Z. 18640 | Unverändert übernommen – Navigator, Allianzforschung, Treibstoffdepot wirken damit automatisch mit |
| **Laderaum** | `fleetCargoCapacity()` Z. 18039, `CARGO_PER_FRACHTER` 300 (Z. 18027) | Begrenzt den Einzelflug, exakt wie bei Expeditionen |
| **Gutschrift** | `gainResources()` Z. 18692 | **Einziger** Weg, Ertrag zu buchen. Lagerdeckel kommt damit gratis mit (CLAUDE.md: „Lager-Deckel konsequent auf ALLE Ressourcen-Quellen") |
| **Abbau am Ort** | `state.debrisFields`, 8 Ressourcen/s je Recycler, Sammelauftrag mit belegtem Flottenslot und Selbstrückkehr | Vorbild für den Förderposten – inklusive der Feinheiten (Lager voll ⇒ Abbau steht **und die Zeile sagt das**) |
| **Serverautorität** | `/api/market/trade` Z. 5122, `/api/attack` Z. 2920, `getSaveValue`/`setSaveValue` Z. 1268/1273 | Fertiges Muster „Server liest den Spielstand, rechnet selbst, schreibt zurück" |
| **Optimistisches Sperren** | `expectedVersion` + HTTP 409 in `PUT /api/storage/:key` (Z. 1996) | Für die Feld-Dokumente, wo kein eigener Endpunkt nötig ist |
| **Rechteprüfung** | `checkAllianceKeyPermission()` Z. 614, aufgerufen in der Storage-PUT-Route (Z. 1890) | Muster für `checkAsteroidKeyPermission()` |
| **Seltenheitsziehung** | `pickWeightedByRarity` Z. 40650, `hashStringToFloat` Z. 47823 | Deterministische Felderzeugung ohne gespeicherte Daten |
| **Schiff** | `schuerfschiff` Z. 17320 – existiert, hat ein Icon, **und hat bis heute keine Aufgabe**: sein gesamter Nutzen sind +3 % Gesamtproduktion fürs bloße Besitzen (Z. 19298) | Bekommt endlich seinen Beruf (Abschnitt 6.2) |
| **Planeten-Rolle** | `mining` „Bergbau-Welt", +25 % Produktion (Z. 41145) | Wirkt künftig auch auf den Aufbereitungs-Durchsatz |

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
Währung, mit der die Basis das Material verarbeitet (Abschnitt 5.2) – das gibt dem Solarkraftwerk
eine dauerhafte Rolle statt eines Deckels und ist der eigentliche „Umbau der Basis".
**Forschungspunkte** bleiben draußen, weil sie schon nach Balance-Pass v8.12 (Kommentar bei
Z. 19197) bewusst von der Wirtschaftsentwicklung entkoppelt wurden; sie hier wieder anzukoppeln
würde diese Entscheidung still rückgängig machen.

**Warum Antimaterie nie rein vorkommt.** Antimaterie ist mit `baseRate` 0,015 (Fusionsreaktor,
Z. 4304) die mit Abstand knappste Ressource des Spiels, und diese Knappheit trägt die gesamte
Tier-2-Kette. Ein reiner Antimaterie-Asteroid würde sie in einem Zug entwerten. Als Beimischung von
20–25 % in 13 % der Vorkommen bleibt sie das, was sie ist: der Engpass, den man plant.

### 3.2 Vier Größen

| Größe | Vorrat | Schürf-Plätze | Güte | Häufigkeit | Leergefördert nach (voll besetzt) |
|---|---|---|---|---|---|
| Splitter | 150.000 | 4 | ×1,0 | 46 % | ~17 Std. |
| Brocken | 600.000 | 8 | ×1,4 | 34 % | ~25 Std. |
| Kern | 2.000.000 | 16 | ×2,0 | 16 % | ~29 Std. |
| Koloss | 8.000.000 | 30 | ×3,0 | 4 % | ~41 Std. |

Die Laufzeiten sind mit Absicht **in derselben Größenordnung** gehalten: Ein Koloss ist nicht
„länger", er ist „mehr pro Stunde". Wer einen hält, verdient deutlich mehr – aber er muss ihn
genauso oft neu suchen wie jeder andere, und das hält die Karte in Bewegung.

**Förderrate je Schürfschiff: 0,60/s**, multipliziert mit der Güte, den Boni aus Abschnitt 7 und bei
Legierungen mit 1,15. Ein voll besetzter Kern (16 Schiffe, Güte ×2,0) liefert damit **19,2/s**, ein
voll besetzter Koloss **54/s**.

### 3.3 Wo sie liegen und wie sie entstehen

Jedes der 69 Systeme trägt **4–9 Vorkommen** in einem Gürtel zwischen den Orbit-Positionen der
Sektorkarte (`WEEKLY_ORBIT_POS` Z. 12425 zeigt das vorhandene Raster). Galaxieweit sind das rund
**450 Vorkommen**.

Sie werden **berechnet, nicht gespeichert.** Anzahl, Sorte, Größe und Position eines Systems ergeben
sich aus `hashStringToFloat(systemId + ':' + epoche)` – dasselbe Verfahren, mit dem der Abgrund seine
Sektoren aus der Tiefe ableitet („Ein Sektor wird aus seiner Tiefe **berechnet**, nicht gewürfelt",
HELP_SECTIONS Z. 33848). Client und Server rechnen unabhängig dasselbe Feld aus. Gespeichert wird
ausschließlich, was davon **abweicht**: wer ein Vorkommen hält und wie viel Vorrat noch drin ist.

Das ist keine Eleganz um ihrer selbst willen, sondern eine harte Anforderung: Der geteilte Speicher
hat ein Schlüssel- und ein Größenlimit (`MAX_SHARED_KEYS`/`MAX_SHARED_VALUE_BYTES`, definiert Z. 286/287, geprüft in der
Storage-PUT-Route). 450 einzelne Vorkommen-Dokumente wären eine schlechte Idee; **69 System-Dokumente**
mit je einer Handvoll Einträgen sind unauffällig.

**Erschöpfung und Nachwachsen.** Ist ein Vorkommen leer, verschwindet es und der Platz bleibt
**6 Stunden** leer, danach liegt dort ein neues – Sorte und Größe aus `epoche+1` desselben Platzes.
Das Nachwachsen läuft **faul**: Es passiert beim nächsten Lesen des Feldes, nicht in einem Timer.
Auf dem Pi läuft kein Hintergrundjob, und es gibt nichts, was bei einem Neustart hängenbleiben kann.

### 3.4 Sichtbarkeit

Ein Vorkommen ist nur zu sehen, wenn man das System schon kennt (dieselbe Regel wie bei Planeten).
Sorte und Größe stehen nach dem ersten **Anflug oder Scan** fest; vorher zeigt die Karte einen
grauen, unbeschrifteten Brocken. Das gibt dem **Spähschiff** und der neuen Forschung
**Tiefenscan-Array** (Abschnitt 7) einen zweiten Nutzen und verhindert, dass man mit einem Blick auf
die Karte 450 Vorkommen sortiert.

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

**Solar bleibt weitgehend frei.** Energie ist ab jetzt Verbrauchsgut (Abschnitt 5.2). Wer seine
Aufbereitung auslasten will, braucht Kraftwerke – die Basis verliert also keine Aufgabe, sie
**tauscht** eine gegen eine andere.

Zu beachten: Der Deckel wirkt **je Standort**, nicht imperiumsweit (`ratesPerSecond` summiert über
`allBuildingSetsWithPlanet()`, Z. 19150). Wer viele Kolonien hat, produziert weiter mehr. Das ist
gewollt: Ein imperiumsweiter Deckel würde neue Kolonien wertlos machen, und Kolonien sind teuer und
langsam genug, um kein Schlupfloch zu sein.

### 4.2 Was der Deckel konkret kostet

Eine Beispielrechnung für einen entwickelten Standort mit Mine auf Stufe 40 (heute realistisch),
Habitat 20 (×1,40), Bergbau-Rolle (×1,25), Vulkanwelt (×1,15), Produktionsring Stufe 3 (×1,09):

- **heute:** 40 × 0,225 = 9,000/s roh → **× 2,19 ≈ 19,7 Erz/s**
- **neu (Bestandsschutz, s.u.):** 15 × 0,225 + 10 × 0,1125 + 15 Stufen darüber × 0,1125 = 6,188/s roh → **≈ 13,6 Erz/s**
- **Verlust: rund 31 %** an diesem Standort.

Dagegen steht ein einziger gehaltener **Kern** mit 16 Schürfschiffen: **19,2/s** – mehr als der
gesamte Standort vorher. Wer sich auf das neue System einlässt, steht nach dem Umbau **besser** da,
und zwar deutlich. Wer es ignoriert, verliert rund ein Drittel. Genau dieses Gefälle ist der Zweck
der Übung; es darf nur nicht als Überraschung kommen (Abschnitt 4.3).

### 4.3 Bestandskonten

`maxLevel` blockiert im Spiel nur den **Ausbau** (`if (cur >= def.maxLevel)` Z. 12898) – vorhandene
Stufen werden nirgends abgesenkt. Für die Rate braucht es trotzdem eine ausdrückliche Regel, sonst
entscheidet der Zufall der Formel:

> **Stufen oberhalb des Deckels zählen wie die Stufen 16–25, also zur halben Rate.** Sie bleiben
> erhalten, sie bleiben sichtbar, sie zählen weiter – nur eben abgeflacht.

Dazu einmalig, automatisch beim ersten Laden nach dem Update:

1. **Rückerstattung.** Für jede Stufe oberhalb des Deckels werden **60 % der historischen Baukosten**
   dieser Stufe gutgeschrieben (über `gainResources()`, also am Lagerdeckel geklemmt wie alles
   andere). Bei Mine 40 sind das 15 Stufen – ein spürbarer Batzen, mit dem sich die erste
   Schürfflotte sofort bauen lässt.
2. **Starthilfe Schürfflotte.** **6 Schürfschiffe** und **1 zusätzliches Schürfrecht** (also 3 statt
   2 zu Beginn) für jedes Konto, das mindestens ein Produktionsgebäude über dem Deckel hat.
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

## 5. Der Weg nach Hause

Zwischen „im Felsen" und „im Lager" liegen zwei Engpässe. Beide sind bewusst gesetzt, denn ohne sie
wäre das Ganze nur eine größere Zahl.

### 5.1 Der Einzelflug (früh, ohne Schürfrecht)

Missionstyp **`mining`**. Ablauf wie eine Expedition: hinfliegen, laden, zurück. Ertrag ist das
Minimum aus drei Größen – Förderleistung × Abbauzeit, **Laderaum der Flotte**
(`fleetCargoCapacity()` Z. 18039), und Restvorrat des Vorkommens.

Er funktioniert auf **jedem unbeanspruchten** Vorkommen, ohne Server, ohne Anspruch, ohne Kampf. Das
ist die Einstiegsschleife und zugleich der Solo-Modus (Abschnitt 8). Anders als bei Expeditionen gibt
es hier **keinen kostenlosen Basis-Frachtraum** wie `EXPEDITION_BASE_CARGO` (Z. 18053): Wer Erz
holen will, braucht Frachter. Das ist der Punkt, an dem der Frachter vom Lagerraum-Statisten zum
Werkzeug wird.

### 5.2 Der Förderposten (später, mit Schürfrecht) – und die Aufbereitung

Missionstyp **`mining-station`**: Schürfschiffe fliegen hin und **bleiben dort**. Ab dann fördert das
Vorkommen dauerhaft in Richtung Heimat – kein Klicken mehr, es ist ein Idle-Spiel.

Zwischen Förderung und Lager sitzt das neue Gebäude:

**Aufbereitungsanlage** (`key:'aufbereitung'`, eigenes gezeichnetes Icon in `ICONS`,
`category:'refine'`, `maxLevel: 20`)

- **Durchsatz: 3,0 Einheiten/s je Stufe**, imperiumsweit gemeinsam – Vollausbau **60/s**.
- **Verbrauch: 0,35 Energie je aufbereiteter Einheit.** Bei Vollauslastung sind das **21 Energie/s**
  – der erste echte Dauerverbraucher für Energie im Spiel.
- Die **Bergbau-Welt-Rolle** (Z. 41145) und der **Produktionsring** der Orbitalstation wirken auch
  hier, damit die vorhandenen Standort-Entscheidungen im neuen System etwas bedeuten.

**Wird der Durchsatz oder die Energie knapp, drosselt die Förderung – und der Rest bleibt im
Felsen.** Nichts verfällt still. Das ist dieselbe Regel, die der Recycler bei vollem Lager schon
befolgt, und sie wird genauso ausdrücklich angezeigt („Aufbereitung ausgelastet: 42 von 61/s werden
verarbeitet, der Rest bleibt im Vorkommen").

Damit ist die Basis umgebaut, ohne dass eine einzige Ressource dazuerfunden werden musste:

| | vorher | nachher |
|---|---|---|
| **Erz, Kristalle, Deuterium, Antimaterie** | Mine/Raffinerie/Synth/Reaktor | Asteroiden (Hauptteil) + gedeckelte Grundlast |
| **Energie** | ein Rohstoff wie jeder andere | **Treibstoff der Aufbereitung** – wer mehr verarbeiten will, baut Kraftwerke |
| **Rolle der Basis** | Bergwerk | **Kraftwerk und Hütte** |
| **Rolle der Flotte** | Kämpfen, erkunden, plündern | **plus: Nachschub** |

**Ausdrücklich nicht vorgeschlagen: eine neue Zwischenressource „Rohgestein".** Sie wäre thematisch
naheliegend, würde aber **zwei getrennte Pfade** anfassen, die beide bedient werden müssen und von
denen keiner den anderen absichert: `costAmountAvailable()` (Z. 18600, „kann ich das bezahlen") und
`pay()` (Z. 18674, „bezahle es"). Dazu den Lagerdeckel, die Tier-2-Klemmung in `gainResources()`
(Z. 18692) und jede Anzeige, die eine Ressourcenliste aufzählt. Die Aufbereitung erreicht denselben
Design-Effekt (Basis = Hütte, Energie = Senke) über eine **Rate**, nicht über einen neuen Bestand.
Rate statt Bestand ist hier zehnmal billiger und nicht einen Deut schwächer.

> Anmerkung zur Quellenlage: `docs/freiflug-konzept.md` nennt für diese Verdrahtung einen Wächter
> `tests/test_kostenschluessel.js`. **Den gibt es im Repo nicht** (Stand v8.476.0, geprüft) – ebenso
> wenig stimmen die dortigen Zeilennummern für `costAmountAvailable`/`pay` noch. Wer sich beim Bau
> eines neuen Kostenschlüssels auf diesen Test verlässt, verlässt sich auf nichts. Das ist kein
> Argument gegen das Freiflug-Dokument, sondern die übliche Verrottung von Zeilenangaben in einer
> Datei mit 57.686 Zeilen – und ein Beleg dafür, warum CLAUDE.md-Regel 10 verlangt, Befunde aus
> zweiter Hand vor dem Weitergeben am Code nachzuprüfen.

---

## 6. Anspruch, Besitz und Streit

### 6.1 Das Schürfrecht

Ein **Schürfrecht** entsteht, wenn Schürfschiffe an einem unbeanspruchten Vorkommen ankommen, und
gehört genau einem Spieler. Es hält, solange dort mindestens ein eigenes Schürfschiff steht.

**Anspruchslimit** – der wichtigste Balance-Hebel des ganzen Systems:

| Quelle | Rechte |
|---|---|
| Grundstock | 2 |
| Forschung `rschuerfrecht` (6 Stufen) | +1 je Stufe |
| **Maximum** | **8** |

Bei rund 450 Vorkommen und 8 Rechten je Spieler trägt die Galaxie etwa **50 vollausgebaute
Schürf-Imperien**, bevor es wirklich eng wird. Ob das passt, hängt an der echten Spielerzahl – es ist
**eine Konstante**, kein Umbau, und lässt sich nach den ersten Wochen nachziehen. Der Wert gehört
deshalb als benannte Konstante an eine Stelle, nicht verstreut in Formeln.

### 6.2 Wer fördert und wer bewacht

**Schürfschiff** (`schuerfschiff` Z. 17320) bekommt endlich seinen Beruf. Es behält seinen
+3 %-Produktionsbonus (Z. 19298 – das ist bestehende Balance, an der grundlos nichts geändert wird)
und wird zusätzlich das Förderschiff: **0,60/s**, ein Schürfplatz je Schiff.

Heute ist es ein **Event-Schiff** (`unlockEventParts:{ eventKey:'goldrausch' }`) – wer das Event nie
mitgenommen hat, kommt gar nicht an eins. Für eine Kernmechanik geht das nicht. Vorschlag: Das
Schürfschiff wird mit der Forschung **Schürftechnik** (Abschnitt 7) regulär freigeschaltet; die
Event-Teile bleiben als **zweiter, schnellerer** Weg bestehen und geben zusätzlich einen kosmetischen
Rumpf-Skin, damit die Goldrausch-Veteranen nichts verlieren.

**Eskorte:** Kampfschiffe können mitstationiert werden. Sie fördern nichts, aber sie sind das, was
eine Anfechtung schlagen muss. Ein unbewachtes Schürfrecht ist eine offene Einladung – und das soll
man auf der Karte sehen (Abschnitt 9).

### 6.3 Anfechtung

Missionstyp **`asteroid-contest`**: eine Kampfflotte gegen die stationierte Eskorte des Halters.

- **Serverautoritativ** aufgelöst, Muster von `/api/attack` (Z. 2920) und `/api/moonsiege/resolve`
  (Z. 6845). Der Angreifer schickt **keine Stärke mit** – der Server rechnet sie aus dem gespeicherten
  Spielstand nach, wie es `computeScoreServer()` für die Bestenliste tut.
- **Verliert der Halter**, geht das Schürfrecht über; seine überlebenden Schürfschiffe fliegen
  automatisch heim (dasselbe Muster wie die selbstständige Rückkehr des Recycler-Sammelauftrags).
  **Der Vorrat bleibt, wo er ist** – man erobert eine Quelle, keine Beute. Das ist wichtig, sonst
  wird Anfechtung zum Raubzug statt zum Revierkampf.
- **Schutzfrist 2 Std.** nach jedem Besitzwechsel: kein Ping-Pong im Minutentakt.
- **Abklingzeit 4 Std.** je Angreifer und Vorkommen: kein Zermürben durch Wiederholung.
- **Allianzmitglieder des Halters können nicht anfechten.** Sonst wird jede Allianz zum
  Selbstbedienungsladen.
- **Benachrichtigung** an den Halter über den vorhandenen Push-Kanal (`pushNotificationEvent`,
  genutzt u.a. in `handleSharedStorageWrite` Z. 1089) mit eigener Einstellung in den
  Benachrichtigungs-Präferenzen – wer nicht geweckt werden will, wird nicht geweckt.

### 6.4 Datenmodell und Endpunkte

**Ein Dokument je System**, `db.shared['asteroids:<systemId>']`:

```json
{
  "epoche": 3,
  "plaetze": {
    "4": { "halter": "<userId>", "halterName": "Sascha", "tag": "KEP",
           "vorrat": 1743200, "seit": 1754800000000, "schutzBis": 1754807200000,
           "schiffe": { "schuerfschiff": 16, "jaeger": 40, "waechter": 8 },
           "geerntetBis": 1754812345000 },
    "7": { "vorrat": 84000, "leerSeit": null }
  }
}
```

Nur belegte oder angebrochene Plätze stehen drin. Alles andere ist berechnet. Ein System-Dokument
bleibt damit weit unter jedem Größenlimit, und es gibt **69** davon.

Vier eigene Endpunkte statt generischem Shared-Storage – CLAUDE.md ist an dieser Stelle unmissverständlich
(„Generischer Shared-Storage ohne Sonderregel ist für JEDEN eingeloggten Nutzer weit offen"):

| Endpunkt | Aufgabe | Serverseitig geprüft |
|---|---|---|
| `GET /api/asteroid/field/:systemId` | Feld lesen (mit fauler Nachwachs-Auflösung) | – |
| `POST /api/asteroid/claim` | Schürfrecht anmelden | Platz frei? Anspruchslimit? Schiffe wirklich im Spielstand? |
| `POST /api/asteroid/collect` | Ertrag gutschreiben | **Menge rechnet der Server** aus `geerntetBis`, Rate und Restvorrat – der Client nennt keine Zahl |
| `POST /api/asteroid/contest` | Anfechten | Schutzfrist, Abklingzeit, Allianz, Stärke aus dem Spielstand |

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

**Neue Zahlenfelder im Spielstand** (Schürfrechte, Stationierungen) sind gegen `saveSanityViolation()`
(Z. 2535) zu prüfen, **bevor** sie live gehen. CLAUDE.md hält den Vorfall vom 21.07.2026 fest, bei
dem ein zu enges Limit das Speichern für entwickelte Konten komplett eingefroren hat – mehrere
Stunden Fehlersuche, Symptom „immer 8 Std. offline". Konkret: `asteroidClaims` ist ein kleines
Objekt und fällt unter keine bestehende Prüfschleife, die stationierten Schiffszahlen laufen als
Flotte durch `maxShipsPerType` (1e9, unkritisch). **Trotzdem vor dem Merge einmal mit einem
Vollausbau-Spielstand gegen den echten Endpunkt geprüft**, nicht nur überlegt.

---

## 7. Neue Inhalte im Überblick

Jeder Eintrag bringt laut CLAUDE.md-Regel 7 **eigenes Icon und vollständige Beschreibung** mit – ein
ganzer Satz, der Wirkung und Deckel nennt, kein Kürzel-Text.

### Forschungen (`RESEARCH_DEFS`, Z. 10572)

| `key` | Name | Stufen | Wirkung |
|---|---|---|---|
| `rschuerftechnik` | Schürftechnik | 1 | Schaltet Schürfschiff, Aufbereitungsanlage und den Missionstyp Schürfflug frei. |
| `rschuerfrecht` | Bergbaurecht | 6 | +1 gleichzeitiges Schürfrecht je Stufe (2 → 8). |
| `rfoerderung` | Fördertechnik | 10 | +3 % Förderrate je Stufe, additiv in die gedeckelte Bonus-Gruppe (max. +30 %). |
| `rtiefenscan` | Tiefenscan-Array | 5 | Deckt Sorte und Größe unerkundeter Vorkommen im eigenen und je Stufe einem weiteren Nachbarsystem auf, ohne Anflug. |
| `raufbereitung` | Aufbereitungstechnik | 8 | −4 % Energieverbrauch je aufbereiteter Einheit je Stufe, Boden bei −32 %. |

### Gebäude (`BUILDING_DEFS`)

| `key` | Name | maxLevel | Wirkung |
|---|---|---|---|
| `aufbereitung` | Aufbereitungsanlage | 20 | +3,0 Einheiten/s Aufbereitungsdurchsatz je Stufe (imperiumsweit gemeinsam); verbraucht 0,35 Energie je Einheit. |
| `schuerfleitstand` | Schürfleitstand | 10 | −2 % Flugzeit für Schürf- und Anfechtungsmissionen je Stufe (Boden −20 %), zahlt in dieselbe Gruppe wie Navigator und Konvoi-Doktrin ein. |

### Schiff

**Bergungsfrachter** (`bergungsfrachter`) – der Frachter für die lange Strecke: doppelter Laderaum des
Großen Frachters, halbe Geschwindigkeit, kein Angriffswert. Für den Einzelflug zu weit entfernten
Vorkommen, bevor man dort ein Schürfrecht halten kann.

### Module und Kosmetik

- Standort-Modul **Förderleitwerk** (`foerder`): +% Förderrate der von diesem Standort aus
  stationierten Schürfschiffe – reiht sich in die vorhandene `moduleBonusAt()`-Familie ein.
- Schiffs-Modul **Bohrkopfverstärkung** für die Schürfschiff-Klasse.
- Neun gezeichnete Asteroiden-Icons (eins je Sorte) plus ein Icon für die Aufbereitungsanlage und
  eins für den Schürfleitstand.

**Zu den `ti-*`-Icons:** Die Whitelist umfasst 69 Glyphen, und `ti-pick`, `ti-mountain`, `ti-diamond`,
`ti-droplet`, `ti-atom-2`, `ti-target` und `ti-flag` sind alle dabei – für die UI-Beschriftungen ist
also nichts nachzubauen. Die **Vorkommen selbst** bekommen trotzdem handgezeichnete SVGs in `ICONS`:
Neun Sorten, die sich auf der Karte unterscheiden sollen, sind mit zwei Tabler-Symbolen nicht
darstellbar. Sollte doch ein neues `ti-*` gebraucht werden, gilt der Weg aus CLAUDE.md
(CSS-Regel ergänzen → `node build-icon-subset.js` → `node check-icons.js`) – ein neues `ti-*`
einzubauen reicht seit v8.296.0 nicht mehr aus, der Glyph fehlt sonst im Subset-Font.

### Die Anzeigestellen, die mitgezogen werden müssen

CLAUDE.md-Regel 6 in Listenform – nach dem Umbau **erst greppen, dann committen**:

- Die **fünf Anzeige- und zwei Gutschriftstellen** aus Abschnitt 0 auf `gesamtRatenProSekunde()`
  umstellen – die sechs Belohnungsformeln ausdrücklich **nicht**.
- **HELP_SECTIONS**: neuer Abschnitt „Asteroiden und Schürfrechte"; **bestehende** Abschnitte
  „Trümmerfelder" (Z. 33738) und „Planetentypen" (Z. 33747) prüfen – letzterer sagt heute
  „Asteroiden … haben keinen Typ-Bonus", und dieser Satz meint den *Planetentyp*, nicht das neue
  Vorkommen. Er wird mit einem Halbsatz entschärft, sonst widerspricht er der neuen Mechanik dem
  Anschein nach.
- **TUTORIAL_STEPS**: Der Schritt „Erkunden & Kolonisieren" (Z. 27830) beschreibt das Kartenmenü und
  muss die neue Aktion nennen.
- **`effectDesc`** der fünf gedeckelten Gebäude: Sie nennen heute keinen Deckel, weil es keinen gab.
- Die **Lagerdeckel-Restzeit** (Z. 23745) rechnet mit der Gebäuderate und meldet nach dem Umbau eine
  zu lange Zeit bis „Lager voll".
- **Tagesaufgaben und Erfolge**: bewusst zuerst *ohne* Asteroiden-Bezug ausliefern und erst in Phase 5
  ergänzen – ein Erfolg, der eine Mechanik voraussetzt, die noch nicht rund läuft, ist eine
  Beschwerde mit Ankündigung.

---

## 8. Solo-Modus

`useBackend()` (Z. 4045) ist `false`, solange kein Konto angemeldet ist – und laut CLAUDE.md ist
„Solo-Modus funktioniert ohne Server" eine Architektur-Zusage, keine Nebenbemerkung. Umkämpfte
Schürfrechte gibt es dort nicht.

**Vorschlag – die kleine Lösung:** Im Solo-Modus sind alle Vorkommen unbeansprucht und frei
abbaubar. Der Einzelflug (5.1) läuft vollständig, der Förderposten (5.2) auch – nur eben ohne
Anspruch, ohne Anfechtung und ohne Anspruchslimit. Die Deckelung durch die **Aufbereitungsanlage**
greift trotzdem, und sie ist der eigentliche Balance-Riegel. Solo-Spieler verlieren damit die
soziale Ebene, aber keinen Spielinhalt und keine Progression.

**Die große Lösung** – NPC-Konkurrenzsyndikate, die im Solo-Modus Vorkommen halten und anfechten –
wäre reizvoll, ist aber ein eigenes Vorhaben in der Größenordnung der Piraten-Trümmerräuber
(`maybeSchedulePirateDebrisRaid` Z. 23517 und die Auflösungskette daran). Sie gehört **nicht** in
dieses Konzept; wenn sie kommt, dann als Phase 6 mit eigener Bewertung.

---

## 9. Wo es im Spiel auftaucht

**Auf der Sektorkarte** (aufgeklapptes System): ein Gürtel zwischen den Orbits, darin die Vorkommen
als gezeichnete Brocken in der Farbe ihrer Sorte. Am Rand jedes beanspruchten Brockens ein kleiner
Ring in der Farbe des Halters – **eigene grün, Allianz blau, fremde rot**, unbewacht (keine Eskorte)
**gestrichelt**. Damit ist die Antwort auf „wo lohnt sich eine Anfechtung" ein Blick, kein Menü.

**Im Kartenmenü**: Anfliegen (Schürfflug) · Schürfrecht anmelden · Anfechten · Schiffe abziehen –
jeweils mit Flugzeit und Kosten darunter oder dem Grund, warum der Eintrag grau ist. Exakt die
Konvention, die HELP_SECTIONS Z. 33743 für das Kartenmenü schon festschreibt.

**Neue Box „Schürfbetrieb"** im Flotte-Tab, Unterreiter „Missionen": je gehaltenes Vorkommen eine
Zeile mit Sorte, Größe, Restvorrat, aktueller Rate, stationierten Schiffen und Schutzfrist. Sie
enthält einen Countdown (Schutzfrist), gehört also **nicht** unter das Signatur-Cache-Muster mit
Wertliste, sondern unter **`setBoxHtml()` mit Markup-Signatur** (Z. 20096 ff. beschreibt die
Unterscheidung): Läuft ein Countdown, ist das Markup jede Sekunde anders und die Box wird neu
geschrieben; steht keiner, steht sie still. Die Prüfung ist selbstkorrigierend – genau der Grund,
warum es dieses Muster gibt.

**Achtung bei der Bedienung:** Die Box bekommt eine Schiffszahl-Eingabe und eine Vorkommens-Auswahl.
Beides sind Bedienzustände, die nur im DOM stecken und den Neuaufbau im Sekundentakt nicht überleben
– CLAUDE.md listet genau diese drei Ausprägungen (`<details>`, `<select>`, Scrollposition) als am
25.07.2026 real aufgetretene Spielerfehler. Also von Anfang an `isTypingIn()` für das Eingabefeld,
`data-keep-value` + `selectedAttrFor()` für die Auswahl.

**Im Basis-Tab**: die Aufbereitungsanlage mit einer ehrlichen Auslastungszeile („42 von 61/s
verarbeitet – 19/s bleiben im Vorkommen liegen. Grund: Energie reicht nicht.").

---

## 10. Umsetzung in fünf Phasen

Jede Phase ist für sich auslieferbar und lässt das Spiel in einem sinnvollen Zustand zurück. Das ist
keine Förmlichkeit: Seit dem Deploy-Webhook **ist der Merge die Auslieferung** – was gemerged wird,
steht Sekunden später auf `gamegeeeeek.de`.

| Phase | Inhalt | Backend? | Risiko |
|---|---|---|---|
| **1** | Feldgenerierung, Darstellung auf der Karte, Kartenmenü, Einzelflug (`mining`), Schürfschiff regulär freigeschaltet | nein | gering – rein additiv, nichts Bestehendes ändert sich |
| **2** | Aufbereitungsanlage, `gesamtRatenProSekunde()` + Umstellung der fünf Anzeige- und zwei Gutschriftstellen, Forschungen, Hilfe/Tutorial | nein | **mittel** – Anzeigestellen und Offline-Nachholung sind die Fehlerquellen |
| **3** | **Deckel + Bestandskonten-Ausgleich** | nein | **hoch** – der einzige Schritt, der Spielern etwas wegnimmt |
| **4** | Schürfrechte: Feld-Dokumente, `claim`/`collect`, Anspruchslimit, Förderposten | **ja** | mittel |
| **5** | Anfechtung, Schutzfristen, Benachrichtigungen, Erfolge, Tagesaufgaben, Berichte | **ja** | mittel |

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

| Test | Prüft | Gegenprobe am alten Stand muss ROT werden |
|---|---|---|
| `test_asteroidenfeld.js` | Feldgenerierung ist deterministisch: gleiche `systemId`+Epoche ⇒ identisches Feld, über zwei getrennte Läufe | – (neuer Inhalt) |
| `test_asteroiden_deckel.js` | Eine Mine auf Stufe 40 liefert nach dem Umbau die **gerechnete** Rate. Erwartungswert wird **im Test aus dem Spiel abgeleitet** (Rate messen), nicht eingetippt – Regel 2 und 7 der Arbeitsregeln | Stufe-40-Mine liefert dort die volle Rate |
| `test_asteroiden_anzeige.js` | Die fünf Anzeige- und zwei Gutschriftstellen nennen Gebäude **+** Asteroidenrate, die sechs Belohnungsformeln **nur** die Gebäuderate (Wochenliga-Ausschüttung bei laufendem Förderposten gegen die reine Gebäuderate prüfen) | alte Stellen zeigen bei aktivem Förderposten zu wenig |
| `test_asteroiden_offline.js` | Nach 3 Std. simulierter Abwesenheit ist der Asteroiden-Ertrag **genau einmal** gutgeschrieben – Uhr nur über `Date.now()` vorstellen, nie über Treiber-Uhrhilfen (Arbeitsregel 8), und die Gegenrichtung (Doppelgutschrift) mitmessen | ohne Anbindung an `applyOfflineProgress` kommt 0 heraus |
| `test_aufbereitung_drossel.js` | Bei zu kleinem Durchsatz **bleibt** der Rest im Vorkommen (Vorrat vorher/nachher messen), und die Box **sagt** es | – |
| `test_schuerf_lagerdeckel.js` | Bei vollem Lager wird der Vorrat **nicht** angetastet – dieselbe Regel wie beim Recycler | – |
| `test_schuerfbox_zustand.js` | Auswahl und Eingabefeld überleben zehn Ticks (die `<select>`-Falle) | ohne `data-keep-value` springt die Auswahl zurück |
| `tests/asteroid.sh` (Backend) | Anspruch, Doppelanspruch (zweiter muss scheitern), Anspruchslimit, `collect` rechnet serverseitig, Anfechtung mit Schutzfrist – echte HTTP-Requests gegen einen lokal gestarteten Server mit Test-DB in `/tmp` | – |

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

### 12.1 Die vier, die wirklich wehtun

**Der Deckel trifft die treuesten Spieler am härtesten.** Wer am längsten spielt, hat die höchsten
Gebäudestufen und verliert am meisten. Der Ausgleich in 4.3 ist deshalb keine Geste, sondern Teil der
Mechanik – und der Patchnote nennt die Zahl, statt sie zu umschreiben.

**Der Wettlauf um Schürfrechte begünstigt, wer zuerst da ist.** Bei rund 450 Vorkommen und einem
Limit von 8 ist das in den ersten Tagen kein Problem, in einem Jahr vielleicht schon. Gegenmittel
sind vorhanden und billig: Anspruchslimit senken, Vorkommen je System erhöhen, Nachwachszeit
verkürzen. Alle drei sind Konstanten. Sie sollten **von Anfang an als benannte Konstanten an einer
Stelle stehen**, damit ein Nachziehen ein Einzeiler bleibt.

**Die Gutschrift läuft über den Server, der Spielstand über den Client.** `POST /api/asteroid/collect`
schreibt in den Spielstand (`setSaveValue`), während der Client denselben Spielstand im Sekundentakt
weiterschreibt. Das ist ein echtes Wettrennen – dieselbe Klasse Problem, die `/api/market/trade`
schon hat. Empfohlene Auflösung: Der Endpunkt **schreibt den Spielstand nicht selbst**, sondern gibt
den gutzuschreibenden Betrag zurück und bucht ihn serverseitig nur im Feld-Dokument als „bis hierher
geerntet" ab; der Client verbucht ihn über `gainResources()` und speichert im normalen Takt. Bei
einem Verbindungsabbruch zwischen beidem geht höchstens **ein** Intervall verloren, nie mehr – und
niemals doppelt, weil `geerntetBis` serverseitig schon fortgeschrieben ist. Die Gegenrichtung
(Doppelgutschrift) ist dabei genauso zu prüfen wie der Verlust; CLAUDE.md-Regel 12 hält fest, dass
dieselbe Behebung einmal zuerst eine Sekunde je Nachholung **doppelt** gutgeschrieben hat.

**Die Offline-Nachholung ist die heikelste einzelne Codestelle des Vorhabens.**
`applyOfflineProgress()` (Z. 39970) trägt mehr hart erarbeitete Regeln als jede andere Funktion im
Projekt: den Phantom-Sekunden-Fix (v8.459.0, der Anteil wird an den echten Uhr-Fortschritt gekoppelt),
die Nachhol-Schwelle und die Restschuld darunter, und die ausdrückliche Warnung, dass dieselbe
Behebung in der Gegenrichtung einmal doppelt gutgeschrieben hat. Der Asteroiden-Ertrag muss dort
mitlaufen – sonst fördert ein Förderposten über Nacht nichts, was niemand sofort bemerkt, weil die
Zahl ja irgendwie steigt. Konkret zu beachten:

- Der Ertrag hängt am **Restvorrat**, und der ist endlich. Eine achtstündige Nachholung darf nicht
  mehr fördern, als im Felsen lag – die Kappung gehört in dieselbe Schleife, nicht dahinter.
- Bei geteilten Vorkommen ist der Vorrat **Servereigentum**. Die Nachholung darf ihn nicht lokal
  fortschreiben, sondern holt beim ersten `collect` nach dem Wiederkommen den echten Stand –
  andernfalls rechnen zwei Geräte desselben Kontos denselben Vorrat zweimal ab.
- Der Test dazu (`test_asteroiden_offline.js`) simuliert die Abwesenheit **nur** durch Vorstellen von
  `Date.now()`, nie über Uhr-Hilfen des Browsertreibers: Die feuern versäumte Timer nach und heilen
  das Spiel künstlich, und ein `Date`-Proxy erzeugt Endlosrekursion (Arbeitsregel 8 – beide Fehler
  sind hier schon einmal gemacht worden).

### 12.2 Die offene Entscheidung

**Bleibt die Förderung im gedrosselten Zustand stehen oder läuft sie weiter?** Wenn die Aufbereitung
ausgelastet ist, bleibt der Rest laut 5.2 im Vorkommen. Das ist spielerfreundlich (nichts verfällt),
hat aber eine Folge: Ein Spieler kann acht Kolosse halten, deren Ertrag zu 80 % ungenutzt liegen
bleibt, und blockiert sie damit für alle anderen, ohne selbst etwas davon zu haben. Die Alternative
– Förderung läuft weiter, Überschuss verfällt – erzeugt Druck, nur so viel zu halten, wie man
verarbeiten kann, ist aber die unfreundlichere Regel.

Empfehlung: **erst die freundliche Variante ausliefern** und beobachten. Wird Horten zum Problem,
ist die Gegenmaßnahme kein Verfall, sondern eine **Nutzungspflicht** (ein Schürfrecht, dessen Ertrag
über 72 Std. zu weniger als 25 % abgerufen wird, wird frei) – das trifft genau das Verhalten, um das
es geht, statt alle zu bestrafen. Diese Entscheidung braucht Daten und gehört deshalb bewusst nicht
in Phase 4.

### 12.3 Was dieses Konzept ausdrücklich nicht vorschlägt

- **Keine neue Ressource** (siehe 5.2).
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
| 1 | ~600 Zeilen (Felderzeugung, SVG-Darstellung, Kartenmenü, Missionstyp) | – | 2 |
| 2 | ~400 Zeilen (Gebäude, Rate-Funktion, 7 Umstellungen, Forschung, Hilfe) | – | 4 |
| 3 | ~150 Zeilen (Deckel, Ausgleichsroutine, Patchnote) | – | 1 |
| 4 | ~500 Zeilen | ~350 Zeilen (3 Endpunkte, Feld-Logik, Rechteprüfung) | 2 + Backend-Test |
| 5 | ~400 Zeilen | ~250 Zeilen | 2 |

Das Größte ist nicht das Neue, sondern das Bestehende: die sieben Anzeigestellen in Phase 2 und die
Bestandskonten in Phase 3. Beides sind kleine Diffs mit großer Reichweite – und beides ist genau die
Sorte Änderung, bei der dieses Projekt seine Fehler gemacht hat.
