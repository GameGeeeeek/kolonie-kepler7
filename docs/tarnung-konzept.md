# Tarnwert – Konzept (Entwurf, 03.09.2026)

Auftrag Sascha: „ich würde gerne einen tarnwert noch einfügen … wichtig ist er darf nirgends
vergessen werden in formeln anzeige wenn man schiffe baut module etc sowie es muss eine gegenwehr
für getarnte flotten geben, logisch kleine schiffe besser zu tarnen, große beinahe unmöglich."

Zwei Entscheidungen sind bereits gefallen:

- **Zwei Etappen.** Erst der *Bestand* (was ein Fremder über deine Flotte weiß), dann der *Anflug*
  (ob er einen Angriff kommen sieht). Der Tarnwert wird nur EINMAL eingeführt.
- **Hart gegen große Rümpfe.** Ab Großkampfschiff praktisch unmöglich.

Dieses Dokument ist der Entwurf, nicht die Umsetzung. Alle Zahlen und Stellen darin sind am Code
gemessen; wo eine Annahme sich als falsch erwiesen hat, steht das ausdrücklich dabei.

---

## 1. Die Ausgangslage – und vier Irrtümer, die vorher ausgeräumt gehören

Der Entwurf stand zunächst auf vier Annahmen. Eine Kartierung über beide Repositories hat alle vier
widerlegt. Wer sie nicht kennt, baut am falschen Ort.

**Irrtum 1: „Der öffentliche Bestenlisten-Eintrag legt die komplette Flotte offen."**
Er schreibt **13 von 46** Schiffsklassen (`weltraum_kolonie.html:45374–45386`). 33 Klassen sind
heute schon unsichtbar – darunter alle Tier-2- und Tiefenschiffe. Eine Tarnung, die „Schiffe aus dem
Eintrag nimmt", nimmt also etwas heraus, das für zwei Drittel der Flotte nie drinstand.

**Irrtum 2: „Das ist die einzige Quelle."**
Es sind fünf Kanäle im geteilten Speicher, alle für jedes eingeloggte Konto lesbar:

| Schlüssel | Inhalt | Rechteprüfung |
|---|---|---|
| `leaderboard:<id>` | 13 Schiffsklassen, `defensePower`, Ressourcen | **keine** (`server.js:2782`) |
| `missions:<id>` | Flottenbewegungen mit **voller** Zusammensetzung | keine |
| `moondefense:<id>` | Mondverteidigung | keine |
| `alliance:<TAG>:paradesnapshot:<playerId>` | die **komplette, unverschleierte** Flotte jedes Mitglieds | nur Tag-Prüfung |
| `alliance:<TAG>:basedef:<playerId>` | Basisverteidigung; speist über `allianceMusterDefenseApprox` eine **serverseitige Kampfzahl** | nur Tag-Prüfung |

Dazu neun Anzeigestellen fremder Flotten mit je eigener Quelle. Eine Tarnung, die nur den
Bestenlisten-Eintrag anfasst, ist an vier Stellen wirkungslos.

**Irrtum 3: „Für Spielerangriffe gibt es keine Vorwarnung."**
Für den **koordinierten Allianz-Musterangriff** existiert bereits ein vollständiger,
**servergeschriebener** Vorwarnkanal: `server.js:9027` legt `alliance:<ZIELTAG>:incomingmuster` mit
`arrivalAt` und `totalShips` an, der Verteidiger-Client liest ihn (`:42933–42952`) und zeigt
„geschätzte Flottenstärke: N Schiffe" (`:45025`). **Das ist exakt die Bauform, die Etappe 2
braucht** – eine Zahl, die der Verteidiger sieht und der Angreifer nicht fälschen kann. Etappe 2
erweitert diesen Kanal, sie erfindet keinen zweiten.

Für den **1-gegen-1-Angriff** stimmt der Satz dagegen: serverseitig ist nichts unterwegs.
`pseudoDistanceSeconds` ist ein Hash im Client, `incomingRaid` kommt in `server.js` **null mal** vor.
Es gibt dort nichts zu entdecken, weil nichts fliegt.

**Irrtum 4: „Der Server nimmt keinen Kampfparameter aus dem Request."**
Genau eine Route tut es: `/api/asteroid/anfechtung-vorschau` (`server.js:11061`) nimmt
`composition` aus dem Body und rechnet daraus `rawFleetPower` (`:11080`). Eine **Vorschau** – also
genau die Bauform, in der ein Tarnwert später auseinanderläuft.

---

## 2. Die tragende Regel: Tarnung verbirgt die Zusammensetzung, nicht die Größe

Der Server rechnet den Punktestand aus dem **echten** Spielstand nach und überschreibt den
eingereichten (`computeScoreServer`, `server.js:3464`; Überschreiben `:2877–2879`). Der Flottenanteil
daran ist nicht ungefähr, sondern **exakt ausrechenbar**, weil alle acht Nicht-Flotten-Bestandteile
unverschleiert im selben Dokument stehen.

Daraus folgt eine Regel, die nicht verhandelbar ist, wenn der Entwurf ehrlich bleiben soll:

> **Getarnt wird, WAS du hast – nicht, WIE VIEL du hast.**
> Punktestand und Verteidigungsstärke bleiben wahr. Der Gegner sieht, dass da etwas ist, und weiß
> nicht, was.

Das ist kein Kompromiss, sondern der bessere Entwurf:

- Es macht die **Gegenwehr sinnvoll**: Sensoren decken auf, *was* verborgen ist – nicht *dass*.
- Es verhindert die Unsichtbarkeits-Falle, in der ein Spieler mit halber Flotte plötzlich als
  wehrloses Ziel dasteht und reihenweise ausgenommen wird.
- Es verwandelt eine **heute unbestrafte Fälschung** in eine Regel: Die Flottenzahlen im
  öffentlichen Eintrag übernimmt der Server ungeprüft vom Client. Wer will, trägt schon jetzt weniger
  Schiffe ein. Verraten wird er nur durch den Punktestand. Tarnung gibt dieser Möglichkeit einen
  Preis und ein Gegenmittel.

**Der Preis dieser Regel:** Ein aufmerksamer Spieler rechnet die verborgene Flottenstärke aus dem
Punktestand aus. Das ist Absicht. Wer rechnet, soll belohnt werden.

---

## 3. Der Tarnwert je Schiffsklasse

### Warum von Hand gesetzt und nicht abgeleitet

Es gibt **keine Tabelle, die „Größe" ehrlich abbildet**; die drei Kandidaten widersprechen sich am
selben Schiff:

| Achse | Bricht bei | Warum |
|---|---|---|
| `atk` | Wächter (atk 8, defWeight 2.0) und **19 Klassen mit atk 0** | Alle 19 lägen gleichauf auf Platz 1 der Tarnung – darunter jeder Frachter |
| `defWeight` | Frachtern und Nutzschiffen | Sie haben keinen |
| `SHIP_SCORE_WEIGHTS` | `bergungsfrachter:80 > schlachtschiff:70` | Ein Bergungsfrachter wäre schwerer zu tarnen als ein Schlachtschiff |

Ein eigener, handgesetzter Wert je Klasse ist deshalb die einzige ehrliche Lösung – und zugleich der
Balance-Hebel. Der Preis ist genau der, vor dem der Auftrag warnt: Er muss dann **überall** stehen.

### Der Name

`tarnung` ist **bereits vergeben**, und „Tarnung" bedeutet im Spiel schon zwei andere Dinge: das
Schiffsmodul `au_tarnmodul` (Effekt `fuel`, spart Treibstoff) und den Fraktionsbonus
„Spionage-Tarnung" des Schattenbunds. Beide in zwei Repositories.

**Vorschlag: `signatur`** – der Wert steigt mit der Größe (ein Superschlachtschiff hat eine hohe
Signatur), und „Signatur senken" ist die Handlung. Das kollidiert mit nichts und liest sich in jeder
Anzeige natürlich: „Signatur 340 – dieser Rumpf ist nicht zu verbergen."

### Die Flottenregel: das sichtbarste Schiff bestimmt den Verband

Es gibt dafür bereits ein **fertiges, dokumentiertes Muster im Spiel**: `effectiveShipSpeed` +
`fleetSpeedMultiplier`. Eine Flotte ist so schnell wie ihr langsamstes Schiff. Dieselbe Bauform:

> **Ein Verband ist so sichtbar wie sein sichtbarstes Schiff.**

Damit wird „große Schiffe beinahe unmöglich" wörtlich wahr, ohne eine einzige Sonderregel: Ein
Superschlachtschiff im Verband verrät den Verband. Der Spieler versteht es sofort – „nimm das
Schlachtschiff raus, dann bist du getarnt" – und es ist die physikalisch einleuchtende Regel.

Kein Mittelwert, keine Summe: Beides ließe eine getarnte Hauptflotte zu, sobald man genug kleine
Rümpfe dazustellt.

---

## 4. Die Gegenwehr

### Was es heute gibt – und was davon taugt

Drei getrennte Erkennungs-Systeme, die **nichts voneinander wissen**:

1. **Überfall-Vorwarnzeit** gegen NPC-Angriffe (`raidDetectionLead`, `:25527`) aus fünf Summanden:
   Forschung `rscanner`, Allianzforschung `a_scanner`, Frühwarnpakte, Gebäude `sensorphalanx`,
   Fähigkeitsknoten `war7`.
2. **Gegenspionage** beim Ausspähen (`resolveSpyMission`, `:29516`).
3. **Abhorchposten** – das einzige Gebäude, das fremde Flottenbewegungen überhaupt sichtbar macht
   (`:5413`, `ABHORCHPOSTEN_RANGE_SECTORS` `:52908`).

Der Abhorchposten ist ein guter **Anzeige**-Anker, aber ein untauglicher **Mechanik**-Anker: Er
filtert erst beim Beobachter, und er ist teilweise `moonOnly`.

### Der mechanische Anker

Der einzige benannte, ganzzahlige, **serverautoritative** Sensorwert des Spiels ist `nutzen.scan`
der Vorposten (`server.js:12433–12440`) – mit heute genau **einem** Abnehmer (`vorpostenScanMult` in
`resolveSpyMission`). Das ist die Zahl, an die sich eine Gegen-Tarnung hängen lässt, ohne eine völlig
neue Größe zu erfinden.

**Vorschlag: ein Sensorwert je Standort**, gebildet aus dem, was es schon gibt – Sensorphalanx-Stufe,
`rscanner`, `a_scanner`, `nutzen.scan` der eigenen Vorposten. Kein neues Gebäude nötig; die
Gegenwehr ist ein neuer Nutzen für vier vorhandene Investitionen.

**Sensor gegen Signatur als Verhältnis, nicht als Schwelle.** Eine Schwelle ist hart und
frustrierend („ein Punkt zu wenig und ich sehe gar nichts"). Ein Verhältnis erlaubt die interessante
Zwischenstufe: *„Da bewegt sich etwas, aber wir sehen nicht was."*

### Der Befund, ohne den die Gegenwehr wertlos bleibt

**Entdeckung hat heute NULL Kampfwirkung.** `executeRaid()` nutzt Konter und Verteidigungs-Aufstellung
unabhängig davon, ob `detected` gesetzt ist. Und der Kampfkern rechnet ausdrücklich mit „beide
Flotten bekannt" (`server.js:4541–4542`); die Verteidigungs-Aufstellung ist laut Kommentar
„der einzige Kampf, in dem ein echter Gegner die Angriffszusammensetzung bestimmt" (`:4554–4555`).

**Das ist die Stelle, an der Tarnung wehtun muss.** Ohne diese Änderung bleibt jede Tarnung
Kosmetik: Der Verteidiger stellt sich weiterhin optimal auf, egal was er gesehen hat.

---

## 5. Etappe 1 – Der Bestand

**Wirkung:** Getarnte Schiffe fehlen in den fünf Broadcast-Kanälen und im Spähbericht. Punktestand
und Verteidigungsstärke bleiben ehrlich.

**Was das dem Angreifer antut:** Seine Angriffs-Vorschau rechnet den Konter (`counterMultiplier`)
gegen die *bekannte* Flotte. Wer die falsche Zusammensetzung kennt, wählt die falsche Aufstellung und
verliert einen Kampf, den die Zahlen ihm versprochen hatten.

**Backend-Aufwand: keiner.** Der Bestenlisten-Eintrag wird vom Client geschrieben; der Server
überschreibt dort nur `score`, `weekScore`, `isSupporter`, `supporterTier` und `cosmetics`. Weil
Punktestand und Verteidigung ehrlich bleiben, muss der Server nichts über Tarnung wissen.

**Die Lücke, die Etappe 1 offen lässt – und offen lassen muss:**
Der Kampfbericht liefert dem Verteidiger **schon heute die komplette Reichsflotte des Angreifers**
(`fleet: attackerFleetSummary`, viermal: `server.js:4758/4763/4812/4819`) und dem Angreifer die volle
Zielflotte. **Ein einziger Wegwerf-Angriff hebt jede Tarnung auf.**

Das ist kein Fehler, sondern der eingebaute Preis: Tarnung schützt vor dem *ersten* Angriff, nicht
vor dem zweiten. Wer sie brechen will, bezahlt mit einem Angriff. Ob das so bleiben soll, ist eine
Entscheidung (siehe Abschnitt 8).

---

## 6. Etappe 2 – Der Anflug

**Baut auf `alliance:<TAG>:incomingmuster` auf**, dem einzigen servergeschriebenen Vorwarnkanal des
Spiels. Die Erweiterung: Der Kanal meldet nicht mehr `totalShips` roh, sondern das, was der Sensor
des Verteidigers gegen die Signatur des Verbands durchlässt.

**Für den 1-gegen-1-Angriff muss zuerst überhaupt ein Flug entstehen.** Serverseitig existiert er
nicht. Das ist die eigentliche Arbeit von Etappe 2 und der Grund, warum sie eine eigene Etappe ist.

**Der Balance-Einwand, ernst genommen:** Wer vorgewarnt wird, schickt seine Flotte weg – PvP würde
zahnlos. Drei mögliche Antworten, alle in Etappe 2 zu entscheiden:
- Die Vorwarnung nennt nur „ein Verband nähert sich", nicht Größe oder Zusammensetzung.
- Die Vorwarnzeit ist kurz genug, dass Umbauen, nicht Fliehen, die Antwort ist.
- Eine Startsperre für die eigene Flotte, sobald ein Anflug erkannt ist.

**Eine Regel, die dabei verletzt würde:** Der Vorposten-Hilfetext schreibt ausdrücklich fest, dass
sich „das Reaktionsfenster eines Verteidigers nie verschiebt" (`:38597`) – im Code eingehalten, weil
`vorpostenFlug()` die Angriffsmission nicht umschließt. Ein Tarnwert, der das Erkennungsfenster
verkürzt, verletzt genau diese Zusage und braucht dafür eine ausdrückliche Entscheidung samt
Textänderung.

---

## 7. Wo der Wert nirgends fehlen darf

Das ist der Kern des Auftrags. Gemessen, nicht geraten.

### Die Schiffslisten – vier, und keine zwei sind deckungsgleich

| Liste | Klassen | Folge |
|---|---|---|
| `SHIP_DEFS` (`:18105–18268`) | **45** | die Hauptliste – aber das **Superschlachtschiff steht nicht darin** (eigene Konstanten, `:18269–18271`, eigener Werft-Block) |
| `SHIP_SCORE_WEIGHTS` (`:26455`, gespiegelt `server.js:3430`) | **37** | die neun Tiefenschiffe fehlen, werden aber in derselben Werft gebaut |
| Bestenlisten-Eintrag (`:45374–45386`) | **13** | **24 Schiffstypen können im Spionagebericht baulich nie erscheinen** |
| Profilkarte | **3** | |

Ein Tarnwert muss für **alle 46** existieren – und für jede der vier Listen muss *begründet* stehen,
ob er dort auftaucht. „Überall eintragen" wäre schon falsch.

### Die Backend-Tabellen – die „sechs Tabellen"-Regel stimmt heute nicht

Gemessen: `kausalitaetsbrecher` steht in 5, `urmateriekoloss` in 7, `sternenbanner` in 7 Tabellen.
Und es gibt **zwei widersprüchliche Größen-Tabellen**: `COUNTER_ROLE_OF` (`server.js:3502`) und
`SHIP_KLASSE_VON` (`:4175`).

### Die Anzeigestellen – wo „beim Schiffe bauen" scheitern würde

**Die Werft-Metazeile ist eine 25-Zweig-`if/else`-Kette mit eingetippten Literalen** – dort steht
`"Angriffspunkte 90"` als Text, nicht `def.atk`. **20 der 45 Schiffe bekommen dort gar keine
Metazeile.** Wer den Tarnwert nur in `SHIP_DEFS` einträgt, zeigt ihn beim Bauen nirgends an.

Weiter nötig: Flottenübersicht, Vergleich, Tooltips, Bauwarteschlange (`shipScoreWeight` hat neun
Verbraucher, drei davon in Werft und Warteschlange), Spionagebericht, Kampfbericht, Kampf-Wiedergabe,
Angriffs-Vorschau, Bedrohungsbanner, Aufklärungsring und System-Abzeichen auf der Sektorkarte.

### Das Modulsystem

`SHIP_MODULE_EFFECT_LABEL` ist das Effekt-Vokabular – **ohne einen Eintrag dort bleibt ein
Tarn-Modul in der Wechselvorschau unsichtbar.** Und: Der Modulweg deckt nur **26 von 46** Klassen ab;
das bestehende „Tarnmodul" erreicht nicht einmal den Spionagekreuzer.

### Die Ehrlichkeits-Zusagen, die zu Lügen würden

Über Jahre bewusst eingebaut, jetzt im Weg. Wörtlich im Spiel:

- „**Flotte aufgedeckt:**" (Spionagebericht)
- „**Nach dem Kampf siehst du ohnehin, was dort stand.**" (Hilfe, Aufklärung)
- „**Erfunden wird nichts**" (Kampf-Wiedergabe)
- „**Aufklärung zeigt sie dir**"

Zehn Fundstellen in `HELP_SECTIONS`, `TUTORIAL_STEPS`, Spionagebericht, PvP-Bericht,
Kampf-Wiedergabe, Angriffs-Vorschau und Bedrohungsbanner. Jede einzelne muss mitgezogen werden –
das ist die Fehlerklasse, an der dieses Projekt regelmäßig scheitert.

### Die drei vorhandenen Verschleierungsformeln

`fuzz()` (aus `rspyshield`), der Honigtopf (`:29528–29529`) und **`vorpostenFuerClient`
(`server.js:12573–12576`)**. Die dritte ist der wichtigste Präzedenzfall: serverseitige
Verschleierung beim Ausliefern – genau die Bauform, die Etappe 2 braucht.

---

## 8. Wie wir das Vergessen unmöglich machen

Keine Liste zum Abhaken, sondern Zwang. Dasselbe Muster, mit dem dieses Projekt schon die
Icon-Abdeckung erzwingt:

1. **Vollständigkeits-Test über die Schiffsliste.** Jede der 46 Klassen braucht einen Signaturwert.
   Eine neue Schiffsklasse ohne Wert lässt den Prüflauf fallen. Das Superschlachtschiff muss dabei
   ausdrücklich mitgezählt werden – es steht in keiner Liste.
2. **Paritätstest Frontend gegen Backend**, ausgeführt statt gegreppt, mit einem Vergleich gegen die
   *gemessene* Klassenzahl statt gegen eine Schwelle. Die vorhandenen Anker in
   `test_paritaet_tabellen.js` sind Schwellen (`feSchiffe.length > 30`) – wer umsortiert, rutscht
   durch.
3. **Anzeigestellen-Test.** Für jede Klasse mit Signaturwert muss die Werftkarte ihn zeigen. Das
   fängt die 25-Zweig-Kette und die 20 Schiffe ohne Metazeile.
4. **Effekt-Vokabular-Test.** Jeder Modul-Effekt braucht ein Label in `SHIP_MODULE_EFFECT_LABEL`.
5. **Ehrlichkeits-Test.** Die zehn Zusagen dürfen nach der Umsetzung nicht mehr wörtlich dastehen.

---

## 9. Offene Entscheidungen

1. **Hebt ein Angriff die Tarnung auf?** Heute liefert der Kampfbericht die komplette Flotte beider
   Seiten. Bleibt das so, ist Tarnung ein Einmal-Schutz. Alternative: Der Bericht zeigt nur, was am
   Kampf teilgenommen hat.
2. **Was kostet Tarnung?** Ohne laufende Kosten ist sie immer an und damit keine Entscheidung.
   Energie wäre der natürliche Kandidat – das Spiel hat einen Energiehaushalt.
3. **Darf Etappe 2 das Reaktionsfenster verkürzen?** Das verletzt eine ausdrückliche Zusage im
   Vorposten-Hilfetext.
4. **Wird der Sensorwert eine neue Zahl oder die Summe vorhandener?** Der Entwurf schlägt die Summe
   vor – kein neues Gebäude, dafür neuer Nutzen für vier vorhandene Investitionen.

---

## 10. Nebenbefunde aus der Kartierung

Zwei Fehler, die nichts mit Tarnung zu tun haben, aber dabei aufgefallen sind:

- **`rawFleetPower()` im Backend fehlen vier Schiffsklassen**, die in `ATTACK_SHIP_KEYS` und
  `attackPowerRaw` stehen: `kausalitaetsbrecher`, `paktkorvette`, `bundeskreuzer`, `sternenbanner`.
  Sie tragen serverseitig 0 Angriffskraft – dieselbe Fehlerklasse, die in diesem Repo bereits
  mehrfach zugeschlagen hat.
- **`notifySpyTarget` feuert nie.** Es schreibt den Spionage-Ping mit `shared=false`, der Server
  behandelt `spyping` aber nur im shared-Zweig. Die einzige existierende Gegenwehr-Meldung des Spiels
  kommt nie an – und ein Hilfetext verspricht sie trotzdem.
