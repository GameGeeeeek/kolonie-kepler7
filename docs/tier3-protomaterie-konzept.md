# Konzept: Tier 3 — Protomaterie, der Rohstoff, den nur Asteroiden hergeben

**Stand:** 16.08.2026 · **Auslöser:** Spieler-Report Sascha — „man bekommt immer zu viele
Ressourcen, sodass man gar nicht die Asteroiden sucht, weil man eh viele generiert."
**Entscheidung vorab (Sascha, 16.08.2026):** Der asteroidenexklusive Rohstoff soll **Tier 3 tragen**
— also eine neue Verarbeitungsstufe über Metamaterial und Singularitätskernen, nicht etwas quer
Danebenliegendes.

**Umsetzungsstand (16.08.2026): Phasen 1–3 sind ausgeliefert** — Protomaterie als Ressource, ihr
Ertrag an der Abbaumission und ihr erster Abnehmer, alles in *einer* Auslieferung. Bewusst zusammen:
Abschnitt 4 verlangt, dass kein Stoff vor seinem Verbraucher ausgeliefert wird, und genau daran ist
Tier 2 gescheitert. Die Phasen 4 und 5 (die zwei Apex-Ressourcen und weitere Abnehmer) stehen noch
aus. Zu den offenen Entscheidungen aus Abschnitt 8 siehe die Nachträge dort.

---

## 0. Der Befund, gemessen — warum das Konzept überhaupt nötig ist

Der Bergbau ist nicht zu schwach eingestellt. Er ist **strukturell irrelevant geworden**, und das
lässt sich beziffern. Gemessen an einem realen Spielstand (Sascha, 16.08.2026):

| | |
|---|---|
| Basisproduktion ohne Energie/FP | **2.448/s** = 8,81 Mio./Std. |
| Beste denkbare Abbaumission (Koloss, 30 Gräberplätze, 90 Schiffe, Fördertechnik + Aufbereitung voll) | **177.840** Einheiten |
| davon reine Grabezeit | 30 Min, dazu Hin- und Rückflug |
| **Diese Fuhre entspricht** | **73 Sekunden Basisproduktion** |
| Bei ~45 Min Gesamtdauer also | **2,7 %** dessen, was ohnehin hereinkommt |
| Der **gesamte Vorrat eines Kolosses** (1,5 Mio.) | **10,2 Minuten** Basisproduktion |

Dazu der eigentliche Konstruktionsfehler, ablesbar in `ASTEROID_SORTEN`: Alle neun Sorten liefern
**ausschließlich Erz, Kristalle und Deuterium**, plus 4–5 % Antimaterie bei dreien. Also genau die
Rohstoffe, von denen im selben Spielstand 268 Mio. Erz und 179 Mio. Deuterium im Lager liegen.

**Warum sich das nicht durch Nachjustieren beheben lässt:** Die Basisproduktion wächst unbegrenzt
mit Gebäuden, Kolonien und Bonus-Stapeln. Der Asteroidenvorrat ist eine **feste Zahl** (50.000 bis
1.500.000), der Laderaum hängt an der Schiffszahl. Die Schere geht mit jedem Ausbau weiter auf.
Wer die Abbaurate verdoppelt, kauft sich ein halbes Jahr — dann steht dasselbe Problem wieder da.

**Die Umkehrung ist der Kern dieses Konzepts:** Ein fester, kleiner Ertrag ist kein Mangel, sondern
genau richtig — *sofern der Rohstoff nirgends sonst herkommt*. Dann konkurriert er nicht gegen eine
wachsende Produktion, sondern steht neben ihr.

### Der zweite Befund: die vorhandene Hauptsenke hat sich selbst abgeschaltet

Gehört nicht in dieses Konzept (er wird unter „Senken statt Quellen" separat behandelt), ist aber
die Voraussetzung dafür, dass Tier 3 nicht dasselbe Schicksal erleidet. In `tier2Step`:

```js
const maxBySpace = Math.max(0, tier2StorageCap(def) - (resources[def.key]||0));
const produced   = Math.max(0, Math.min(maxByStock, maxBySpace));
if (produced <= 0) return 0;          // <-- hier ist Schluss
for (const res of Object.keys(def.inputs)) resources[res] -= produced * ...
```

Ist das Tier-2-Lager voll, wird `produced` null — und **die Eingangsstoffe werden nicht mehr
abgebucht**. Die Fabrik hält nicht nur an, sie hört auf zu verbrauchen. Im gemessenen Spielstand
stehen zwei Ketten auf `+0/s (Lager voll)` und drei weitere bei 95–99 %. Die Tier-2-Lagerdeckel
sind schlicht zu klein: 41.900 Nanolegierungen gegen 492 Mio. Basislager — ein Verhältnis von
1 : 11.750.

**Lehre für Tier 3:** Eine Verarbeitungsstufe, deren Lager zu klein ist, verschwindet als Senke
wieder. Abschnitt 6 zieht daraus die Konsequenz.

---

## 1. Was das Konzept vorschlägt, in fünf Sätzen

1. Asteroiden geben zusätzlich zu ihrem bisherigen Ertrag eine Spur **Protomaterie** — einen
   Rohstoff, den **keine Fabrik herstellen kann**.
2. Protomaterie ist der Pflicht-Eingangsstoff einer neuen, dritten Verarbeitungsstufe mit **zwei
   Apex-Ressourcen**, die die obersten Tier-2-Stoffe bündeln.
3. Die Menge hängt an **Größe und Güte** des Vorkommens — Kern und Koloss tragen sie, Splitter
   praktisch nicht.
4. Damit bekommen **alle bereits gebauten Systeme** wieder einen Zweck: Schürfrechte, Eskorten,
   Anfechtungen, Schürfpeilungen und der Bergungsfrachter sind heute mechanisch fertig, aber
   wirtschaftlich sinnlos, weil die Beute nichts wert ist.
5. Es entsteht **kein neues Objekt** auf der Karte und keine neue Missionsart — nur ein neuer
   Ertrag an vorhandenen Vorkommen.

---

## 2. Der Rohstoff: Protomaterie

**Schlüssel:** `protomaterie` · **Name:** Protomaterie · **Icon:** eigenes SVG in `ICONS`
(Pflicht 7 — kein `ti-flask`-Notnagel)

**Warum sie nicht herstellbar ist — und warum das erzählerisch trägt.** Protomaterie stammt aus der
Zeit vor der Planetenbildung. Asteroiden sind die Reste, die nie zu einem Planeten wurden; nur in
ihnen ist sie erhalten geblieben. Die Fabriken des Spiels können Materie **umformen**, aber nicht
erschaffen. Das ist keine Ausrede für eine Balance-Regel, sondern der Grund, warum die Regel
plausibel ist: Wer fragt „warum kann ich das nicht einfach bauen", bekommt eine Antwort.

**Woher sie fällt.** Nicht als zehnte Sorte, sondern als **Beifang an allen vorhandenen Sorten**,
gewichtet nach Größe:

| Größe | Vorrat | Güte | Protomaterie je Fuhre (Vorschlag) |
|---|---:|---:|---:|
| Splitter | 50.000 | 1,0 | **0** |
| Brocken | 150.000 | 1,4 | **2** |
| Kern | 500.000 | 2,0 | **8** |
| Koloss | 1.500.000 | 3,0 | **25** |

Bewusst **nicht** proportional zur Ladung, sondern eine feste Zahl je heimgekehrter Fuhre — sonst
skaliert sie mit dem Laderaum und damit wieder mit dem Imperium, und das Konzept hebelt sich selbst
aus. Wer den größten Brocken anfliegt, bekommt am meisten; wer viele kleine abklappert, wenig.

**Was das für die Peilungen bedeutet.** Schürfpeilungen sind immer Kern oder Koloss (35 % Koloss,
siehe `PEILUNG_KOLOSS_ANTEIL`). Sie werden damit von einer netten Zugabe zur **besten
Protomaterie-Quelle des Spiels** — und die Forschung *Tiefenraum-Kartierung* sowie die
Schürfexpedition bekommen rückwirkend Gewicht.

**Lagerung.** Eigener Deckel, **großzügig** und an den Asteroiden-Ausbau gekoppelt (Vorschlag:
Grundwert 500 plus je Stufe Aufbereitungsanlage 100). Protomaterie hat keine Fabrik und kann
deshalb nicht in die Abschaltfalle aus Abschnitt 0 laufen — ein voller Speicher würde aber
heimkehrende Fuhren verfallen lassen, und das wäre die schlechteste denkbare Rückmeldung nach
45 Minuten Flug. **Der Bericht muss einen Überlauf ausdrücklich nennen**, so wie er es heute schon
bei vollem Basislager tut.

---

## 3. Die dritte Stufe: zwei Apex-Ressourcen

Nach der Leitplanke des Tier-2-Konzepts — *nach oben vertiefen, nicht verbreitern* — bündeln beide
neuen Stoffe vorhandene Tier-2-Ressourcen, statt eine parallele Insel zu bauen. Beide brauchen
Protomaterie; ohne Bergbau steht die Stufe still.

### 3.1 Hohlraumgitter — `hohlraumgitter`

Ein Gitter aus stabilisiertem Vakuum. Inputs (Vorschlag):

```
protomaterie: 1 · metamaterial: 3 · hochenergiekristalle: 8
```

### 3.2 Kausalanker — `kausalanker`

Verankert einen Raumabschnitt gegen Verzerrung. Inputs (Vorschlag):

```
protomaterie: 2 · singularitaetskern: 2 · kikerne: 4
```

**Zwingend zu beachten** (Fallstrick aus dem Tier-2-Konzept): Die Engine verarbeitet `TIER2_DEFS`
**in Array-Reihenfolge** innerhalb eines Ticks. Beide neuen Einträge müssen deshalb **hinter**
`metamaterial` und `singularitaetskern` stehen, sonst sehen sie deren Produktion aus demselben Tick
nicht.

**Fabriken** (`BUILDING_DEFS`, `category:'refine'`, `maxLevel:15` wie die übrigen): Hohlraumweberei
und Kausalanker-Werk, jeweils mit eigener Freischalt-Forschung (`maxLevel:1`, damit die Sackgassen-
Eigenschaft aus `test_forschung_tier2.js` erhalten bleibt — siehe Abschnitt 7).

---

## 4. Wofür man Tier 3 braucht — der Teil, an dem Tier 2 gescheitert ist

**Das ist der wichtigste Abschnitt des Konzepts.** Tier 2 ist nicht daran gescheitert, dass es zu
schwer herzustellen wäre, sondern daran, dass die Lager volllaufen und niemand die Stoffe abnimmt.
Eine dritte Stufe ohne Abnehmer wäre derselbe Fehler eine Etage höher.

Deshalb gilt: **Kein Tier-3-Stoff wird ausgeliefert, bevor sein Verbraucher steht.** Vorschläge,
nach Priorität:

1. **Superschiff-Rümpfe.** Die stärksten Schiffe kosten heute Tier-2; künftig Tier-3. Ein
   dauerhafter Abnehmer, der mit dem Flottenverlust im PvP von selbst nachfragt.
2. **Vierte Modulstufe.** Module sind der bestehende Langzeit-Sog; eine Stufe über Legendär, die
   nur aus Tier 3 herstellbar ist.
3. **Wiederholbare Groß-Projekte.** Heute gibt es genau drei Mega-Projekte zu 50.000 Erz — bei der
   gemessenen Produktion **28 Sekunden**. Wiederholbar mit steigenden Kosten und Tier-3-Anteil.
4. **Orbitalstationen der zweiten Ausbaustufe.**

---

## 5. Was das für die vorhandenen Asteroiden-Systeme bedeutet

Alles Folgende ist **bereits gebaut** und bekommt durch Protomaterie erstmals einen
wirtschaftlichen Grund:

| System | heute | mit Protomaterie |
|---|---|---|
| Schürfrechte (2–5) | reserviert einen Brocken, dessen Ertrag egal ist | reserviert eine **Protomaterie-Quelle** |
| Eskorten am Vorkommen | bindet einen Flottenslot ohne Gegenwert | schützt die Quelle |
| Anfechtung (PvP) | kämpft um wertlosen Vorrat | kämpft um die knappste Ressource des Spiels |
| Schürfpeilungen | netter Zufallsfund | beste Quelle (immer Kern/Koloss) |
| Bergungsfrachter | 3.000 Frachtraum für Rohstoffe, die überlaufen | trägt die Fuhre, an der Protomaterie hängt |

Kein einziges dieser Systeme muss angefasst werden. Sie sind fertig und warten nur darauf, dass
sich das Anfliegen lohnt.

---

## 6. Balance-Leitplanken

Aus `CLAUDE.md` und dem Tier-2-Konzept, hier ausdrücklich übernommen:

- **Keine „N Minuten eigene Produktion"-Formeln** — bei starker Wirtschaft explosiv.
- **Additive, gedeckelte Bonus-Gruppen** statt Multiplikator-Ketten für alles, was Tier 3 an Boni
  gewährt.
- **`category:'defense'` → `defVal`/`atkVal` explizit setzen** (mind. `0`), sonst `NaN` in der
  Verteidigungssumme.
- **Array-Reihenfolge** in `TIER2_DEFS` (siehe 3.2).
- **Backend `SAVE_SANITY_LIMITS`**: Protomaterie und die zwei Tier-3-Stoffe sind neue speicherbare
  Zahlenfelder. Vor der Auslieferung prüfen, dass die Grenzen klar darüber liegen — sonst lehnt der
  Server den **gesamten** Spielstand mit HTTP 400 ab, und der Spieler kann nicht mehr speichern
  (Vorfall 21.07.2026, mehrere Stunden Fehlersuche).
- **Lagerdeckel großzügig**, damit die Kette nicht wie Tier 2 in die Abschaltfalle läuft.

---

## 7. Was NICHT gemacht wird

- **Kein zehnter Sorten-Typ.** Protomaterie fällt an vorhandenen Sorten an; eine eigene Sorte
  würde die Kartenanzeige, die Paritätstests und die Nachschub-Gewichtung anfassen, ohne dass es
  etwas verbessert.
- **Keine neue Missionsart.** Die Abbaumission bleibt, wie sie ist.
- **Kein Anfassen der Basisproduktion.** Deckeln wäre die dritte Möglichkeit gewesen und wurde
  bewusst verworfen: Wegnehmen ärgert Bestandsspieler mehr, als fehlende Verwendung sie langweilt.
- **Keine mehrstufigen Freischalt-Forschungen.** Die neuen Forschungen bekommen `maxLevel:1`. Das
  ist nicht Geschmack, sondern Notwendigkeit: Seit v8.522.0 kosten Forschungen ab Stufe 11 selbst
  Tier-2-Ressourcen, und `test_forschung_tier2.js` stellt sicher, dass keine Forschung eine
  Ressource verlangt, die sie selbst erst freischaltet. Eine mehrstufige Tier-3-Forschung würde
  genau diese Sackgasse aufreißen — der Test schlägt dann an, und das ist so gewollt.

---

## 8. Offene Entscheidungen für Sascha

1. **Die Zahlen in Abschnitt 2** (0/2/8/25 je Größe) sind ein Startpunkt, kein Ergebnis. Sie
   sollten an einem echten Spielstand gemessen werden: Wie viele Fuhren soll ein Superschiff kosten?

   > **Entschieden 16.08.2026 — die Zahlen bleiben, jetzt aber gemessen statt geschätzt.**
   > Erwartungswert bei zufälligem Anflug **2,96 je Fuhre** (Größengewichte 46/34/16/4), bei
   > gezieltem Kern-Anflug 8, bei Schürfpeilungen **13,95** (immer Kern oder Koloss). Bei rund
   > 45 Minuten je Fuhre ergibt das **11 je Stunde mit einer Schürfflotte, 32 mit dreien**.
   > Gegengerechnet am Abnehmer: Ausbaustufe 6 kostet 20, also gut zwei Fuhren. Das ist spürbar,
   > ohne zu blockieren — und es macht den Unterschied zwischen „drei Splitter abklappern" und
   > „einen Koloss anfliegen" zum ersten Mal zu einer echten Entscheidung.

2. **Reihenfolge der Verbraucher** aus Abschnitt 4 — welcher zuerst?

   > **Entschieden 16.08.2026: die Ausbaustufen der Mega-Projekte, nicht die Superschiffe.**
   > Das Konzept hatte die Superschiff-Rümpfe an erster Stelle. Beim Umsetzen fiel auf, dass das
   > gegen Saschas Vorgabe „niemand soll blockiert werden" verstößt: Metamaterial-Titan und
   > Singularitäts-Vernichter kann man **heute** bauen, ein Protomaterie-Anteil hätte sie bis zum
   > ersten Flug gesperrt. Die Ausbaustufen nehmen dagegen niemandem etwas weg — betroffen sind
   > nur Stufen ab 6, und die Stufen 1–5 bleiben unangetastet.
   > Zwei Eigenschaften machen sie zum besseren ersten Abnehmer: Sie sind die einzige Senke des
   > Spiels **ohne Ende**, und die Kette, die ein Blockieren ausschließt, steht bereits im Code —
   > Ausbaustufen setzen alle drei Projekte voraus, der Forschungs-Nexus verlangt dafür
   > `allResearchMaxed()`, und darin steckt Minentechnik. Wer eine Ausbaustufe erreichen kann,
   > **kann zwangsläufig schürfen**. `tests/test_protomaterie.js` Abschnitt 5b hält das fest.
   > Die Superschiffe bleiben als Abnehmer möglich — aber als *neues* Schiff, nicht als Umbau.

3. **Bestandskonten:** Sollen die ersten Protomaterie-Funde rückwirkend gutgeschrieben werden
   (etwa nach abgeschlossenen Abbaumissionen), oder fängt jeder bei null an? Empfehlung: bei null —
   rückwirkende Gutschriften waren beim Deckel-Umbau die Quelle der meisten Rückfragen.

   > **Umgesetzt wie empfohlen: jeder fängt bei null an.** Niemand verliert dadurch etwas, denn
   > es gibt bis dahin nichts, wofür Protomaterie gebraucht würde. Dafür überlebt sie **beide**
   > Resets vollständig (Prestige *und* Aufstieg), ohne Kryo-Archiv: Sie entsteht aus Flugzeit
   > statt aus Wirtschaft, und mit zurückgesetztem Bestand käme niemand, der regelmäßig prestigt,
   > je an ihre Abnehmer heran.

4. **Neu offen, entstanden beim Umsetzen:** Ab Ausbaustufe 6 sind es 20 Protomaterie, danach 20 je
   weitere Stufe, gedeckelt bei 400. Der Deckel ist **keine Balance-Wahl, sondern eine Notwendigkeit**
   — Protomaterie hat einen Lagerdeckel von 2.500 bei Vollausbau, und ein Kostenposten darüber ließe
   sich gar nicht erst ansparen. Wer die Kosten steigern will, muss vorher den Speicher heben.

---

## 9. Umsetzungsreihenfolge

Jede Phase einzeln getestet und ausgeliefert, nach dem Muster des Asteroiden-Konzepts:

| Phase | Inhalt | Warum in dieser Reihenfolge | Stand |
|---|---|---|---|
| **1** | Protomaterie als Ressource: Icon, Lager, Anzeige, Backend-Limits | Ohne Speicher kein Ertrag | **fertig 16.08.2026** |
| **2** | Ertrag an der Abbaumission + Bericht (inkl. Überlauf-Hinweis) | Ab hier lohnt sich Fliegen | **fertig 16.08.2026** |
| **3** | Der **erste Verbraucher** — Ausbaustufen der Mega-Projekte statt Superschiff-Rümpfe (siehe Abschnitt 8) | Vor der Verarbeitungsstufe, damit Protomaterie sofort einen Zweck hat | **fertig 16.08.2026** |
| **4** | Tier-3-Kette: zwei Ressourcen, zwei Fabriken, zwei Forschungen | Erst jetzt, wenn Nachfrage besteht | offen |
| **5** | Weitere Verbraucher (Modulstufe, neues Apex-Schiff) | Langfristiger Sog | offen |

**Phase 1–3 kamen in EINER Auslieferung**, nicht in dreien. Beim Umsetzen zeigte sich, dass die
Aufteilung der eigenen Regel aus Abschnitt 4 widerspricht: Nach Phase 2 gäbe es einen Rohstoff, den
man sammelt und für nichts ausgeben kann — für eine Auslieferung lang genau der Zustand, an dem
Tier 2 gescheitert ist. Die Zwischenstände wären außerdem live gegangen, weil jeder Merge
ausliefert.

**Was das Backend angeht** (Leitplanke aus Abschnitt 6): Es brauchte **keine** Änderung. Protomaterie
liegt in `state.resources` und fällt damit unter die generische Regel `maxResourceValue: 1e15` —
gegen einen Lagerdeckel von 2.500 ist das reichlich Luft. Geprüft, nicht angenommen; ein eigenes
Feld auf oberster Ebene hätte dagegen einen neuen Eintrag in `SAVE_SANITY_LIMITS` gebraucht, und ohne
den lehnt der Server den **gesamten** Spielstand mit HTTP 400 ab.

**Phase 3 steht bewusst vor Phase 4.** Genau diese Reihenfolge ist bei Tier 2 versäumt worden: Dort
kam erst die Kette, dann — teilweise bis heute nicht — die Abnehmer. Das Ergebnis steht in
Abschnitt 0.
