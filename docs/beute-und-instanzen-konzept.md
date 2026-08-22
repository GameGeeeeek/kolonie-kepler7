# Beute, Sets und Instanzen — Bestandsaufnahme und Konzept

**Stand 18.08.2026** (v8.567.0 plus Etappe 1 der Verteidigungs-Anerkennung).
**Auftrag Sascha:** „Findbare Module die zusammen set Bonus geben sowie Dungeons und raids mit
Belohnungen die es nur dort gibt vielleicht macht es Sinn eine item Struktur einzubauen."

Dieses Dokument ist das nächste Projekt nach den vier laufenden Etappen (Verteidigungs-Anerkennung,
Doktrinen, Sektor-Eigenschaften, Baustellen-Konto).

---

## 0. Der wichtigste Satz vorweg

**Ein großer Teil des Auftrags ist bereits gebaut** — und zwar gut. Wer das übersieht, baut ein
zweites System daneben, das mit dem vorhandenen konkurriert; genau der Fehler, den dieses Projekt
schon einmal bei den Kampf-Bonusgruppen gemacht hat. Deshalb steht die Messung vor dem Vorschlag.

Was gemessen wurde: alle Zahlen unten stammen aus `weltraum_kolonie.html` in der Fassung vom
18.08.2026, nicht aus der Erinnerung.

---

## 1. Bestandsaufnahme — was es schon gibt

### 1.1 Findbare Module mit Set-Bonus: **gibt es**

`MODULE_SET_DEFS` (Z. 24877) führt **9 Sets** in zwei Bauarten:

- **Vier benannte Sets** (`festung`, `industrie`, `logistik`, `forschungszentrum`) — alles oder
  nichts: Erst wenn alle geforderten Modultypen an einem Standort stecken, greift der Bonus.
- **Fünf Boss-Sets** (`set_fresser`, `set_panzer`, `set_schwarm`, `set_phasen`, `set_glut`) mit je
  vier Teilen und **gestaffelten Stufen**: 2 Teile, 3 Teile, 4 Teile, und die Stufen zählen
  zusammen. Beispiel Panzerschale: 2 Teile +8 % Verteidigung, 3 Teile zusätzlich +10 %
  Gegenschlag, alle 4 weitere +12 % Verteidigung und +6 % Bauzeit-Ersparnis.

Gerechnet wird das in `setBonusAt(planetKey, effect)` (Z. 24920), additiv, und es fließt zusammen
mit Sockel- und Basis-Boni in dieselben nachgelagerten Deckel wie alles andere.

### 1.2 Belohnungen, die es nur dort gibt: **gibt es — mit einem eingebauten Schloss**

Die Module tragen ein Feld `quelle` mit vier Werten (Z. 24613 ff.):

| Herkunft | Bedeutung |
|---|---|
| `normal` | regulärer Fundtopf, Schmiede, Börse |
| `abgrund` | nur aus dem Abgrund |
| `boss` | **ausschließlich** über `grantBossSetModule()` nach einer Allianz-Raid-Welle gegen genau diesen Boss |
| `unikat` | benannte Einzelstücke mit **genau einer** Fundquelle (Weltboss bzw. Wächter-Wiederholungssieg), `grantUnikatModul()` |

Der Kommentar an `HERKUNFT_BOSS` sagt es wörtlich: Die Herkunft „hält die Set-Teile aus JEDEM
regulären Fundtopf heraus (fundPool filtert nach quelle)". Dasselbe Schloss greift für Unikate —
inklusive Schmiede und Modulbörse. **Die Mechanik „nur hier zu bekommen" ist also fertig und
erprobt; sie braucht kein neues System, nur neue Inhalte.**

### 1.3 Raids: **gibt es**, fünf ausgearbeitete Gegner

`ALLIANCE_RAID_BOSSE` (Z. 43330) führt fünf Bosse, jeder mit eigenen Kampfregeln statt nur anderen
Zahlen: eine **Schwäche** (Schiffsklasse), ein Malus ohne diese Klasse (`ohneMult` 0,75–0,80), ein
eigener Verlust- und Beutefaktor und ein **Beute-Schwerpunkt** (Erz, Kristalle, Deuterium,
Antimaterie). Die Allianz wählt den Gegner; jeder Boss lässt sein eigenes Vier-Teile-Set fallen.

Dazu die vollständige Sammelfenster-Maschinerie (Beitritt, gemeinsamer Abflug, serverseitige
Auflösung, Berichtskarte, Benachrichtigung) — und der **koordinierte Angriff (Musterangriff)**, der
dieselbe Maschinerie nutzt und bis heute kein PvE-Ziel hat (siehe `docs/content-ideen.md` 4.7).

### 1.4 Dungeon: **gibt es** — er heißt Abgrund

Tiefen-Läufe mit wachsender Gegnerstärke, **Mutatoren** je Sektor, **Wächter** alle paar Tiefen,
**12 Reliquien** (`ABGRUND_RELIKTE`, Z. 47535) und darauf **gestaffelte Satz-Boni**
(`ABGRUND_RELIKT_SATZ`, Z. 47580: ab 3, ab 6, …). Eigene Währungen (Splitter, Bergungsgut), eigene
Werkstatt, eigene Schiffe, eigene Planeten-Rolle (Tiefenhafen). Das ist ein Dungeon mit
Fortschrittsachse.

### 1.5 Item-Systeme: **fünf parallele**

| System | Zeile | Anzahl | Was es ist |
|---|---:|---:|---|
| `MODULE_DEFS` | 24626 | 182 | Standort-Module (inkl. 20 Boss-Set-Teile und Unikate) |
| `SHIP_MODULE_DEFS` | 25852 | 44 | Schiffsklassen-Module |
| `ITEM_DEFS` | 45466 | 30 | Verbrauchsgegenstände im Inventar |
| `RARE_ITEMS` | 45706 | 6 | seltene Materialien (schalten frei, werden nicht verbraucht) |
| `ABGRUND_RELIKTE` | 47535 | 12 | Reliquien-Kabinett |

Dazu Seltenheitsstufen, Substats, Sockel (2 je Standort), Fragmente, zwei Schmieden, Werkbank und
Modulbörse. **Das ist bereits eine Item-Struktur** — sie ist nur nicht *eine*, sondern fünf.

---

## 2. Die echten Lücken

Vier, alle gemessen.

### 2.1 Die Schiffsklassen-Module haben **keine** Sets

`grep -c "SHIP_MODULE_SET\|shipModuleSet\|shipSetBonus"` → **0**. 44 Module, kein einziger
Set-Bonus. Das ist die direkteste Umsetzung des Auftrags und trifft ein System, das die Mechanik
noch nicht hat — statt eine zweite neben `MODULE_SET_DEFS` zu stellen.

### 2.2 Die Boss-Sets sind **allianzgebunden**

Alle 20 Set-Teile fallen ausschließlich nach einer **Allianz-Raid-Welle**. Wer solo spielt oder in
einer kleinen Allianz ist, kann kein einziges davon je besitzen — und damit keinen der gestaffelten
Set-Boni. Das ist die größte inhaltliche Sperre im ganzen Modulsystem.

### 2.3 Keine gestufte Schwierigkeit mit **eigenem** Beutetisch

Die Raid-Bosse unterscheiden sich in der Zusammensetzung, nicht in der Stufe: Ein Sternenfresser
lässt dieselben Teile fallen, egal wie stark die Allianz ist. Der Abgrund hat Tiefen, aber seine
Reliquien enden bei Tiefe 120 (`abgrundReliktDef` rechnet danach zyklisch, dokumentiert in
`docs/content-ideen.md` 4.5). Es gibt nirgends ein „schwerer gespielt, andere Beute".

### 2.4 Fünf Systeme, fünf Anzeigen, keine gemeinsame Auskunft

Ein Spieler kann heute nicht in einer Ansicht sehen, **was er besitzt und woher es kommt**. Und für
die Entwicklung heißt es: fünf Stellen, an denen Hausregel 7 (Icon + vollständige Beschreibung)
einzeln von Hand geprüft wird — die Prüfung dafür gibt es bis heute nicht
(`check-icons.js` enthält kein einziges Vorkommen von `desc`).

---

## 3. Leitplanken

Sie gelten für jede Etappe unten und stammen aus Fehlern, die dieses Projekt schon gemacht hat.

1. **Kein zweites System neben einem vorhandenen.** Set-Boni für Schiffsmodule benutzen die
   Bauform von `MODULE_SET_DEFS` (Stufen mit `teile`), nicht eine eigene Erfindung.
2. **Additiv und gedeckelt**, nie eine eigene Multiplikation (CLAUDE.md, Bonus-Gruppen).
3. **PvP-Parität, sobald Angriff oder Verteidigung berührt wird.** `atk` und `raidloss` sind bei
   Boss-Sets und Unikaten bewusst ausgespart — diese Linie bleibt, oder das Backend zieht mit.
4. **Die Prüffrage für jede Belohnung:** Kann der Server die Bedingung SELBST beobachten? Ein
   Beutetisch, den der Client auswürfelt und meldet, ist eine Selbstbedienung (der Grund, warum der
   Wochenpass gestrichen wurde). Raid-Beute wird serverseitig aufgelöst — das ist der Grund, warum
   die Boss-Sets dort hängen, und es ist kein Zufall.
5. **Kein „N Minuten eigene Produktion"** als Belohnungsformel.
6. **Jede Etappe einzeln ausgeliefert und einzeln geprüft**, mit Gegenprobe in beide Richtungen.
7. **Hausregel 7 von Anfang an:** jedes neue Stück mit eigenem Icon und vollständiger `desc`.

---

## 4. Teil A — Set-Boni für die Schiffsklassen-Module

**Die kleinste Etappe mit der größten Deckung des Auftrags.**

Die 44 Module verteilen sich auf Schiffsklassen (`klasse:'schlachtschiff'`, `'frachter'`, …). Ein
Set ist deshalb natürlich definiert: **die Module EINER Klasse**, gestaffelt nach Anzahl.

- Bauform wie `MODULE_SET_DEFS`: `{ key, klasse, req:[...], stufen:[{teile:2,…},{teile:3,…}] }`
- Wirkung auf die vorhandenen Schiffsmodul-Kanäle (`atk`, `hull`, `shield`, `cargo`, …)
- **Achtung PvP:** `atk`/`hull`/`shield` gehen in die Kampfkraft. Entweder die Sets bleiben auf
  nicht-kampfrelevante Kanäle beschränkt (`cargo`, Treibstoff, Bauzeit) — dann kein Backend —,
  oder das Backend bekommt die Tabelle mit. **Das ist die erste offene Entscheidung.**
- Zugleich löst das Teil 2.1 des Auftrags („findbare Module, die zusammen einen Set-Bonus geben")
  auf einem System, in dem die Module ohnehin schon gefunden werden.

**Nebenwirkung, die dazugehört:** Diese Etappe ist der natürliche Zeitpunkt, das seit langem
zugesagte **Symbolpaket für die 36 Schiffsklassen-Module** zu liefern (`docs/content-ideen.md` 2.1
— dreimal im Quelltext versprochen, 36 von 44 tragen flache `ti-*`, zwei davon sogar dasselbe
Symbol). Ein Set-Bonus auf Karten, die man nicht auseinanderhalten kann, ist halb verschenkt.

---

## 5. Teil B — Die Boss-Sets aus der Allianz-Sperre lösen

**Ziel:** Ein Spieler ohne große Allianz soll die vorhandenen 20 Teile erreichen können — langsamer
und mühsamer, aber erreichbar.

Vorschlag, ohne neues System: eine **zweite, serverseitig aufgelöste Quelle je Boss**, die dieselbe
`grantBossSetModule()`-Vergabe benutzt.

- Kandidat 1: der **Weltboss** — vergibt bereits Unikate über `grantUnikatModul()`, ist
  serverseitig aufgelöst und steht jedem offen.
- Kandidat 2: das **Fraktions-Bollwerk** als PvE-Ziel des Musterangriffs
  (`docs/content-ideen.md` 4.7) — die Maschinerie steht komplett, ihr fehlt nur ein Ziel.
- In beiden Fällen mit deutlich kleinerer Fallwahrscheinlichkeit als im Raid: Der Raid soll der
  schnelle Weg bleiben, nicht der einzige.

**Was dabei NICHT passieren darf:** die Teile in den regulären Fundtopf, in die Schmiede oder an
die Börse lassen. Das Herkunfts-Schloss (1.2) ist der Grund, warum diese Sets etwas bedeuten.

---

## 6. Teil C — Instanzen: gestufte Schwierigkeit mit eigenem Beutetisch

Das ist der eigentliche „Dungeon"-Teil des Auftrags, und der größte Brocken.

**Nicht vorgeschlagen:** ein neues Instanz-System neben Abgrund und Raid. Es gäbe drei Orte, an
denen dasselbe passiert.

**Vorgeschlagen:** die vorhandenen zwei bekommen eine **Stufenachse mit eigener Beute**.

- **Raid-Stufen.** Jeder der fünf Bosse bekommt Schwierigkeitsstufen (Arbeitstitel: Wache /
  Gezeichnet / Urtümlich). Höhere Stufe = härtere Kampfregeln, und **erst ab einer Stufe fällt ein
  fünftes, gestuftes Set-Teil** oder eine höhere Seltenheit desselben Teils. Die Auflösung liegt
  ohnehin beim Server (Leitplanke 4).
- **Abgrund: die zweite Reliquienreihe ab Tiefe 130** (steht bereits als Posten 4.5 in der
  Ideenliste) — sechs weitere Reliquien, zwölf weitere Wächternamen, neue Chronik-Einträge. Das ist
  exakt „mehr Dungeon mit exklusiver Beute" und der billigste Teil dieses Abschnitts.
  **GEBAUT am 22.08.2026 — und „der billigste Teil" war beim Nachmessen falsch.** Die vier
  Reliquien-Kanäle sind GEDECKELT (`ABGRUND_RELIKT_DECKEL`), und der Splitter-Kanal stand vor der
  Erweiterung schon bei 0,290 von 0,35 — also 83 %. Eine zweite Reihe im Stil der ersten (je zwei
  weitere Stücke zu 0,05 plus eine Satz-Stufe) hätte ihn auf 0,44 getrieben; neun Prozentpunkte
  wären still im Deckel verschwunden, also eine Belohnung, die der Spieler sieht und nie erhält.
  Gebaut ist die Reihe deshalb mit kleinen, deckelverträglichen Prozenten **plus Tiefen-Meilensteinen
  in Sternenessenz** — der einzigen Währung ohne Deckel, die Prestige und Aufstieg übersteht
  (Entscheidung Sascha). Die Zahlen und der Wächter stehen in der CLAUDE.md unter „Abgrund C2".
  **Übertragbar für C1 und B: Bevor eine Etappe „reines Schreiben" heißt, wird die Schranke gemessen,
  in die sie einzahlt** (Regel 41 — ein Konzept ist kein Messergebnis, auch das eigene nicht).
- **Der Beutetisch je Stufe wird ausgeschrieben**, nicht abgeleitet: Ein Spieler muss vorher sehen
  können, wofür er die schwerere Stufe fliegt. Eine Belohnung, die man erst nach dem Kampf kennt,
  ist keine Entscheidung.

---

## 7. Teil D — Die Item-Struktur

Der Auftrag sagt „vielleicht macht es Sinn" — und die Messung sagt: ja, aber **nicht als Umbau**.

**Was ausdrücklich NICHT vorgeschlagen wird:** die fünf Systeme in ein Datenmodell zusammenzulegen.
Der Modul-Schlüssel (`typ:seltenheit:…`) ist tragend; der Kommentar an den Sockeln hält fest, dass
schon ein fünftes Schlüssel-Segment „genau die Fehlerklasse aus dem Schmelze-Bugfix" gewesen wäre.
Ein Umbau der Speicherform brächte dem Spieler nichts und riskiert jeden Bestandsstand.

**Was stattdessen:** eine **Beschreibungs-Schicht** über den fünf Listen — ein Verzeichnis, das
jedem Stück eine einheitliche Auskunft gibt, ohne die Speicherung anzufassen:

```
{ key, name, icon, art, seltenheit, herkunft, quelleText, desc }
   art:      'standortmodul' | 'schiffsmodul' | 'verbrauch' | 'material' | 'reliquie'
   herkunft: 'normal' | 'abgrund' | 'boss' | 'unikat' | 'raid' | 'instanz'
```

Drei Dinge werden damit auf einen Schlag möglich, und jedes einzelne rechtfertigt den Aufwand:

1. **Eine Sammlungs-Ansicht** („was besitze ich, was fehlt mir, und woher kommt es"). Das ist die
   Anzeige, die ein Set-System braucht, damit Sammeln sich wie Sammeln anfühlt.
2. **Die automatische Beschreibungs-Prüfung** (`docs/content-ideen.md` 8): ein Prüfschritt neben
   `check-icons.js`, der ALLE Gegenstands-Listen auf leere oder zu kurze `desc` abklopft. Heute
   wird Hausregel 7 an fünf Stellen von Hand geprüft — und ist der meistgemeldete Nicht-Bug des
   Projekts.
3. **Ein Ort, an dem „nur hier zu bekommen" auch dransteht.** Das Herkunfts-Schloss existiert im
   Code (1.2); für den Spieler steht es nirgends.

Die Schicht wird **abgeleitet, nicht gepflegt** — sie liest die fünf vorhandenen Listen, statt
neben ihnen eine sechste zu führen. Sonst ist sie in drei Monaten die veraltete Anzeigestelle.

---

## 8. Was NICHT gemacht wird

- **Keine Item-Datenmodell-Vereinheitlichung** (Begründung in Teil D).
- **Kein drittes Instanz-System** neben Abgrund und Raid.
- **Keine Boss-Set-Teile in Fundtopf, Schmiede oder Börse.**
- **Keine Beute, die der Client auswürfelt und meldet** (Leitplanke 4).
- **Kein Handel mit Set-Teilen zwischen Spielern** — die Börse ist bewusst außen vor; ein
  handelbares Set-Teil macht aus „gemeinsam erspielt" eine Preisfrage.

---

## 9. Offene Entscheidungen für Sascha

1. **Teil A, Kanäle:** Dürfen die Schiffsmodul-Sets auf Angriff/Hülle/Schild wirken (dann
   Backend-Parität, größerer Aufwand) — oder bleiben sie auf Fracht, Treibstoff und Bauzeit
   (dann reine Frontend-Etappe)?
2. **Teil B:** Weltboss, Fraktions-Bollwerk oder beides als zweite Quelle der Boss-Set-Teile?
3. **Teil C:** Raid-Stufen zuerst (mehr Arbeit, mehr Wirkung) oder die zweite Abgrund-Reihe
   zuerst (reines Schreiben, sofort spürbar für Langzeitspieler)?
4. **Teil D:** Reicht die Beschreibungs-Schicht plus Sammlungs-Ansicht — oder soll daraus ein
   eigener Reiter werden?

---

## 10. Vorgeschlagene Reihenfolge

| # | Etappe | Warum hier | Stand |
|---|---|---|---|
| 1 | **A** — Schiffsmodul-Sets (+ die 36 Symbole) | Deckt den Auftrag zur Hälfte, kleinster Eingriff, keine neue Mechanik | **fertig** (v8.603.0) |
| 2 | **C2** — zweite Abgrund-Reihe ab Tiefe 130 | ~~Reines Schreiben~~, löst zugleich den ältesten Endgame-Posten der Ideenliste | **fertig** (22.08.2026) |
| 3 | **D** — Beschreibungs-Schicht + Sammlungs-Ansicht + `desc`-Prüfung | Ab hier hat jede weitere Etappe eine Anzeige, in der sie auftaucht | offen |
| 4 | **B** — Boss-Sets aus der Allianz-Sperre lösen | Braucht die Sammlungs-Ansicht, damit der langsame Weg sichtbar ist | offen |
| 5 | **C1** — Raid-Stufen mit eigenem Beutetisch | Größter Brocken, serverseitige Auflösung, eigener Balance-Durchgang | offen |
