# Verteidigung und Flotte — Bestandsaufnahme und Konzept

**Stand 18.08.2026.** Auftrag Sascha: „wir müssen nochmal an die verteidigung und flotte ran und
brauchen da ein neues konzept."

Dieses Dokument steht neben `wirtschaft-rebalance-konzept.md`, nicht darin: Jenes fragt, wohin die
Ressourcen fließen sollen. Dieses fragt, warum eine der beiden Hälften des Militärs seit jeher
nicht mitspielt. **Etappe A4 des Wirtschaftskonzepts („Verteidigung bekommt laufende Kosten") geht
hier auf** und wird nicht separat gebaut — siehe Abschnitt 5.

---

## 0. Die Messkonvention — einmal festgelegt, überall gleich benutzt

Die erste Messrunde lieferte für dieselbe Frage drei Antworten, die um Faktor 11 auseinanderlagen.
Der Unterschied war nicht das Spiel, sondern die Konvention. Deshalb steht sie hier vorn, und alle
Zahlen dieses Dokuments folgen ihr:

> **Ein Posten kostet so viele Sekunden, wie sein knappster Rohstoff braucht, um zuzufließen.**
> Für Tier 1 ist der Zufluss die am Live-Konto gemessene Rate. Für Tier 2 und 3 ist es der
> **Kettendurchsatz bei Vollausbau**, nicht der Gegenwert in Tier 1.

Die Alternative — Tier 2 rekursiv in Tier 1 auflösen — unterstellt, man könne Erz beliebig schnell
in Nanolegierungen verwandeln. Das verbietet die Fabrik: 165 Stufen × 0,006/s × 1,56 Durchsatz =
**1,54 Nanolegierungen je Sekunde**, egal wie voll das Erzlager ist. Wer anders rechnet, misst eine
Welt ohne Fabriken.

Ebenfalls festgelegt, weil zwei Berichte es weggelassen hatten: **`rbauplan` auf Stufe 20 senkt alle
Gebäudekosten auf 0,70** (`costFor`, `max(0.5, 1 − Stufe×0,015)`). Das ist eingerechnet.

**Zuflussraten (Live-Konto, 11 Standorte):**

| | /s | | /s |
|---|---|---|---|
| Energie | 6.300 | Nanolegierungen | 1,54 |
| Erz | 1.700 | Quantenchips | 0,515 |
| Kristalle | 272 | Hochenergiekristalle | 0,386 |
| Deuterium | 245,5 | Fusionskerne | 0,206 |
| Antimaterie | 76,7 | KI-Kerne | 0,129 |
| Forschungspunkte | 46,4 | Metamaterial | 0,103 |
| | | Singularitätskerne | 0,077 |
| | | Hohlraumgitter | 0,051 |
| | | Kausalanker | 0,039 |

---

## 1. Der Befund

### 1.1 Verteidigungsgebäude können ein sinnvolles Niveau nicht liefern

Nicht „ineffizient" — **nicht lieferbar**. Die Kosten wachsen exponentiell (`costMult` 1,18–1,4 je
Stufe), der Nutzen linear (`defVal × Stufe`). Der gierige Optimierer über alle 20 Bauten läuft
deshalb gegen eine Wand:

| Einkommen | Verteidigung über Gebäude | über Schiffe | Verhältnis |
|---|---|---|---|
| 1 Tag | 88.318 | 633.946 | 7,2× |
| 7 Tage | 119.885 | 1.330.278 | 11,1× |
| 30 Tage | 143.674 | 2.101.907 | 14,6× |
| 365 Tage | 184.481 | 3.982.204 | **21,6×** |

Der Abstand **wächst**. Dreißigfaches Einkommen kauft über Gebäude 63 % mehr Verteidigung, über
Schiffe 232 %.

Entscheidend ist dabei eine Eigenschaft, die in der ersten Messrunde übersehen wurde:
**`defensePower(planetKey)` zählt nur den einen Standort**, und `pickRaidTargetPlanet` zieht das
Ziel gleichverteilt aus allen elf. Verteidigung muss also *je Standort* stehen. Was das kostet:

| Ziel je Standort | gesamt | über Gebäude | über Schiffe |
|---|---|---|---|
| 100.000 (= 92,8 % des erreichbaren Nutzens) | 1.100.000 | **unerreichbar** | 4,1 Tage |
| 675.714 (Sättigung) | 7.432.854 | unerreichbar | 60 Jahre |

Vier Tage Einkommen in Schiffen kaufen praktisch die vollständige NPC-Verteidigung. Über Gebäude
ist dasselbe Ziel nicht mit Geduld erreichbar, sondern gar nicht.

### 1.2 Der NPC-Überfall ist nach oben gedeckelt — die Sättigung ist real

`maybeScheduleRaid` setzt die Überfallstärke auf `Gesamtverteidigung × 0,35`, aber
`generateRaiderFleet` bricht bei 500 Schiffen ab (`guard < 500`). Das stärkste Raider-Schiff hat
220 Angriff, die Obergrenze der Überfallkraft ist damit **110.000 — eine Konstante**, sobald die
eigene Verteidigung über ~314.000 liegt.

Mit dem Phasenboden (`PHASE_CHANCE_MIN = 0,14`) folgt die Sättigung bei
`D/A = (1−0,14)/0,14 = 6,1429`, also **675.714 Verteidigung je Standort**. Darüber ist jeder
weitere Punkt exakt wirkungslos.

Im PvP ist die Sättigung dagegen **unerreichbar**: Der Boden liegt bei 0,196, das nötige Verhältnis
bei 4,10 — und Angreifer wie Verteidiger schöpfen aus demselben Einkommen. Ein Verteidiger müsste
rund das 4,6-Fache der linearen Kraft des Angreifers aufbringen; bei logarithmischen Kostenkurven
ist das keine Frage der Geduld, sondern der Größenordnung.

### 1.3 Verteidigung zahlt auf keiner Fortschrittsachse ein

Das ist der Punkt, der in der Kampfrechnung unsichtbar bleibt.

**Kampfpunkte gibt es ausschließlich fürs Angreifen.** PvP-Sieg +25, Niederlage +3, Sabotage +8,
Weltboss, Mondbelagerung, Allianzraid. Der erfolgreiche Verteidiger bekommt **Kommandopunkte statt
Kampfpunkte** — und der Kommentar im Backend begründet das ausdrücklich: *„eine Verteidigung, die
den Rang hebt, würde zum Anreiz, sich angreifen zu lassen."* Das ist eine bewusste Entscheidung und
soll nicht umgeworfen werden. Sie hat aber eine Folge, die niemand entschieden hat: Kampfpunkte
gehen mit ×3 in `computeScore()` ein, und daran hängen Prestige (5.000), Aufstieg (50.000) und
Sternenessenz. **Verteidigung trägt zu keiner dieser Schwellen bei.**

**Es gibt keine Kosmetik, keinen Erfolg und keine Freischaltung für Verteidigung.** Kosmetik hängt
an Kampfpunkten (`nf_stahl` 2.000, `em_klinge` 5.000). `pvpDefended` kommt in der ganzen Spieldatei
genau einmal vor — in einer Anzeige.

**Und Verteidigung ist nicht haltbar.** Werftmarken, Module, Offiziere und Veteranen überleben das
Prestige; für Verteidigungsgebäude gibt es nichts Vergleichbares. Beim Aufstieg verkauft das Spiel
sogar drei bezahlte Erhaltungspfade — Werftregister (50 % der Sternenessenz), Rüstkammer (35 %),
Offiziersstab (30 %). **Alle drei sind Flottenpfade.**

**Vier von fünf PvE-Systemen sind reine Flottenabnehmer:** Weltboss, Piratennest, Leerenriss und
Abgrund lösen alle über die Angriffsflotte auf. Verteidigungsgebäude tragen zu keinem bei.

### 1.4 Die eine Achse, auf der Verteidigung glänzt — und die falschen Gebäude gewinnen

`computeScore()` zahlt **10 Punkte je Gebäudestufe**, unabhängig vom Gebäude. Weil die billigen
Bauten exponentiell langsamer teuer werden, sind sie damit mit die besten Punktequellen des Spiels:

| Punkte je Sekunde Einkommen | Stufe 1 | Stufe 20 |
|---|---|---|
| Flak-Batterie | 425 | 18,3 |
| Jäger (zum Vergleich) | 408 | 6,2 |
| KI-Verteidigungskern | 0,58 | 0,001 |
| Singularitäts-Geschützturm | 0,36 | 0,0006 |

Faktor 700 bis 1.180 zwischen der billigsten und der teuersten Verteidigung — bei identischem
Nutzen von 10 Punkten je Stufe. Wer auf Punkte spielt, baut also genau die Gebäude, die im Kampf am
wenigsten tragen, und lässt die sieben Tier-2-Bauten stehen.

**Damit ist der Befund vollständig:** Verteidigung ist im Kampf wirkungslos, auf der Rangliste
abwesend, beim Reset vergänglich — und die einzige Achse, auf der sie zählt, belohnt ausgerechnet
die Bauten mit dem geringsten Kampfwert.

---

## 2. Was daraus folgt — und was ausdrücklich nicht

**Nicht** der Schluss: „Verteidigung muss stärker werden." Eine Verdopplung aller `defVal` änderte
an 1.1 nichts Wesentliches (die Kurve bliebe logarithmisch, der Faktor zu Schiffen halbierte sich
von 21,6 auf 10,8) und an 1.3 gar nichts.

Der Schluss ist: **Verteidigung braucht eine eigene Rolle, die Schiffe nicht ausfüllen können** —
sonst bleibt sie ein zweiter, schlechterer Weg zum selben Ziel. Drei Ansatzpunkte, nach Wirkung
sortiert.

---

## 3. Die Vorschläge

### V1 — Die Kostenkurve brechen: Verteidigung wird pro Standort gedeckelt, dafür bezahlbar

**Das Problem an der Wurzel:** `costMult` 1,18–1,4 bei linearem Nutzen. Jede Diskussion über
Verteidigungsstärke ist folgenlos, solange die 40. Stufe das 750-Fache der ersten kostet.

**Vorschlag:** Verteidigungsgebäude bekommen ein `maxLevel` (Vorschlag: 25, wie das Labor seit
v8.5xx) und im Gegenzug einen deutlich flacheren `costMult` (Vorschlag: einheitlich 1,15). Der
Deckel ist das, was den flacheren Anstieg trägt — ohne ihn wäre es eine reine Verbilligung.

**Nachgerechnet:** Bei `costMult` 1,15 und Deckel 25 kostet die letzte Stufe das 33-Fache der
ersten statt des 750-Fachen. Ein voll ausgebauter Standort ist damit in Tagen statt in
Größenordnungen erreichbar — und danach ist Schluss, was der Verteidigung erstmals eine
**definierte Obergrenze** gibt, an der Balance überhaupt festmachen kann.

**Achtung, Bestandsschutz:** Bestehende Konten haben Verteidigungsstufen weit über 25 (das
Optimum liegt heute bei Flak 72, Turm 64). Ein `maxLevel` allein ließe sie stehen, aber der
Deckel-Kappungsmechanismus (`deckelKappung`) würde sie senken. **Das darf hier nicht passieren** —
eine Kappung nähme Bestandskonten ohne Erstattung einen großen Teil ihrer Verteidigung. Also:
`maxLevel` ohne Kappung, Bestand bleibt, nur Neubau ist begrenzt. Der Kommentar am Labor-Deckel
beschreibt genau diesen Unterschied.

*Offen für Sascha:* Deckel 25 ist ein Vorschlag, keine Messung. Er muss zusammen mit V2 kalibriert
werden.

### V2 — Verteidigung bekommt eine eigene Fortschrittsachse

**Das Problem:** 1.3 — Verteidigung zählt nirgends.

**Vorschlag: Bastionsmarken**, das Werftmarken-Muster für Verteidigungsgebäude (steht im
Wirtschaftskonzept als B3 und gehört fachlich hierher). Je Verteidigungsgebäude-Klasse eine Marke,
einmalig zu erwerben, **überlebt das Prestige** — damit gibt es erstmals eine haltbare
Verteidigungsinvestition. Kosten in Tier 2, damit sie als Senke wirkt.

**Und die kleine Schwester, die nichts kostet:** `pvpDefended` existiert bereits als Zähler und wird
genau einmal angezeigt. Daran lassen sich Erfolge und Kosmetik hängen, ohne irgendeine
Kampfmechanik anzufassen. Das ist der billigste Teil dieses Konzepts und schließt die Lücke „es
gibt keine Anerkennung fürs Verteidigen", ohne den bewussten Verzicht auf Verteidiger-Kampfpunkte
umzuwerfen.

### V3 — Die Punkteachse begradigen

**Das Problem:** 1.4 — 10 Punkte je Stufe unabhängig vom Gebäude belohnt die schwächsten Bauten am
stärksten.

**Vorschlag:** Der Punktwert eines Gebäudes richtet sich nach seinem `defVal` statt nach seiner
Stufe (z. B. `defVal / 10` Punkte je Stufe). Flak (10) gäbe dann 1 Punkt je Stufe, der
Singularitäts-Geschützturm (330) 33.

**Warnung, die dazugehört:** Das ist ein Eingriff in `computeScore()`, und der Punktestand ist
serverseitig nachgerechnet (`computeScoreServer`). Beide Kopien müssen im selben Zug wandern, sonst
lehnt der Server legitime Stände ab. Außerdem verschiebt es die Rangliste **rückwirkend** für alle
Konten — Spieler mit hohen Flak-Stufen verlieren Punkte. Das ist kein Detail, sondern die
eigentliche Entscheidung an diesem Vorschlag.

---

## 4. Was ich nicht vorschlage, und warum

**Laufende Energiekosten für Verteidigung (A4 des Wirtschaftskonzepts).** Die Idee war, Verteidigung
eine Dauerkostenstelle zu geben. Nach dieser Messung ist sie schädlich:

1. Sie träfe zuerst die **billigen** Bauten auf Stufe 66–79 — also die Punktequelle (1.4), nicht
   die Kampfkraft.
2. Sie bestraft eine Investition, die ohnehin schon auf keiner Achse zahlt (1.3).
3. Das Backend hat **kein Produktionsmodell** — keine `BUILDING_DEFS`, keine Raten. Ein
   PvP-wirksamer Deckungsgrad wäre dort nicht identisch berechenbar, und eine Vorschau, die etwas
   anderes sagt als der Kampf, ist genau der Fehler, den die PvP-Vorschau schon zweimal hatte.

Der Name kollidiert außerdem mit der bestehenden Allianzforschung `ra_schildnetz`.

**Verteidigung im PvP stärken.** Die Sättigung ist dort unerreichbar (1.2) — jede Stärkung
verschiebt nur, wo die Kurve verläuft, nicht ob sie eingeholt werden kann. Solange Angreifer und
Verteidiger aus demselben Einkommen schöpfen und Schiffe auf beiden Seiten besser sind, ist PvP
keine Verteidigungsfrage.

---

## 5. Offene Entscheidungen

1. **V3 ist ein rückwirkender Eingriff in die Rangliste.** Bauen, verschieben oder lassen?
2. **Der Deckel in V1** (Vorschlag 25) muss zusammen mit dem flacheren `costMult` kalibriert
   werden. An welchem Ziel? Vorschlag: „ein Standort ist in ~3 Tagen Einkommen voll ausgebaut".
3. **Reihenfolge.** V2 ist der kleinste Eingriff mit dem größten Nutzen je Risiko und braucht
   weder Backend-Parität noch Bestandsschutz. Empfehlung: V2 zuerst.

---

## Anhang: Was diese Zahlen wert sind

Die Messung lief in zwei Stufen: fünf unabhängige Blickwinkel, danach je ein Gegenprüfer mit dem
ausdrücklichen Auftrag, sie zu **widerlegen**. Dabei fielen 50 Behauptungen, darunter mehrere, die
sonst hier stünden — eine falsche Verlust-Untergrenze (5 % statt tatsächlich 0,96 %), ein
Kategorienfehler („Faktor 500.000" verglich ein Verteidigungsverhältnis mit einem Zeitverhältnis),
eine umgekehrte Aussage zur Verteilung über Standorte (verteilen ist 2,3× **besser**, nicht 34×
schlechter) und ein systematischer Zeilennummern-Versatz.

Ein anschließender Vollständigkeits-Kritiker fand elf Achsen, die keiner der fünf Berichte
betrachtet hatte; vier davon stehen heute in Abschnitt 1.3 und 1.4 und haben das Ergebnis
verändert.

**Was nicht gemessen ist:** die Rohstoffraten eines echten mittleren Kontos (die Zahlen dafür sind
linear skalierte Annahmen), die Alltagshäufigkeit von PvP-Angriffen (nur der Deckel von 48/Tag ist
gerechnet), und die Wochenliga-Belohnungen.
