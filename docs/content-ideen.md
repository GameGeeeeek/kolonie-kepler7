# Inhalts-Ideen – belegter Rückstand

**Zweiter Durchgang, Stand v8.567.0 (18.08.2026).** Der erste Durchgang entstand am 09.08.2026
(Stand v8.466.0) auf Wunsch von Sascha („merke dir das alles, wir gehen es ein anderes Mal an").
Seitdem sind gut hundert Versionen ausgeliefert worden – diese Fassung ist deshalb **nachgemessen**,
nicht fortgeschrieben: Jeder Posten wurde am aktuellen Quelltext geprüft, erledigte sind als erledigt
markiert, alle Zeilennummern beziehen sich auf `weltraum_kolonie.html` in der Fassung v8.567.0
(64.808 Zeilen) bzw. auf `server.js` des Backends.

**Was diese Liste ist:** ein Vorrat an Inhalten, die sich am Code begründen lassen – keine
Wunschliste. Was hier steht, ist entweder eine Zusage, die das Spiel sich selbst gegeben hat, ein
Topf ohne Abfluss, ein System, das trockenläuft, oder eine Fläche, die etwas verspricht, das es
nicht gibt.

**Was diese Liste NICHT ist:** eine Reihenfolge. Abschnitt 8 nennt eine Empfehlung, entschieden
wird sie von Sascha.

---

## 1. Erledigt seit dem ersten Durchgang (nachgemessen)

Damit niemand zweimal dasselbe vorschlägt:

| Posten (1. Durchgang) | Stand heute |
|---|---|
| 2.1 Zweite Reihe im Aufstiegsbaum | **teilweise** – `ASCENSION_TREE_DEFS` 6 → 7 („Verschobene Grenzen", Z. 29796). Kein `abAufstieg`-Gating. |
| 4. `WORLDBOSS_ARCHETYPEN` 4 | **erledigt** – 5 seit v8.565.0 (Piratenboss, Z. 49185) |
| 4. `ALLIANCE_TITLE_DEFS` 5 | **erledigt (knapp)** – 6 (Z. 41378); der Vorrat läuft weiterhin trocken |
| Wirtschaft: Töpfe ohne Senke | **weit vorangekommen** – Gefechtsvorräte (v8.560.0), Mega-T2-Anteil (v8.557.0), Tier-3-Kette (v8.556.0), Trümmer-Rückfluss (v8.555.0), Markt- und Routendeckel (v8.549.0/8.550.0/8.554.0) |
| Verteidigung zählt nirgends | **halb** – Bastionsmarken (v8.567.0) geben ihr eine Fortschrittsachse. Erfolge, Kosmetik und Punkteachse fehlen weiter (siehe 4.3) |

Alles Übrige aus dem ersten Durchgang ist **unverändert offen** und unten neu belegt.

---

## 2. Zusagen, die das Spiel sich selbst gegeben hat

Drei Posten, die als Absicht im Quelltext stehen und nie eingelöst wurden. Sie haben Vorrang, weil
sie keine neuen Ideen sind, sondern offene Rechnungen. **Alle drei am 18.08.2026 nachgemessen und
weiterhin offen.**

### 2.1 Symbolpaket für die 36 Schiffsklassen-Module
**Gemessen:** `SHIP_MODULE_DEFS` (Z. 25812) hat 44 Einträge, **36 davon tragen ein flaches `ti-*`**
(`ss_panzerung` = `ti-shield`, `fr_frachtraum` = `ti-truck`, `au_tarnmodul` = `ti-atom-2` …). Nur
die acht Abgrund-Module haben handgezeichnete Symbole. Drei Stellen im Quelltext sagen ein eigenes
Paket ausdrücklich zu.
**Aufwand:** reine Handarbeit, kein Balancing, kein Test. Betrifft eine Ansicht, die ständig offen
ist. **Nebenwirkung:** Dieselben `ti-*` doppeln sich (zweimal `ti-shield`), die Karten sind also
nicht nur flach, sondern teils nicht unterscheidbar.

### 2.2 Drittes mondexklusives Gebäude – wirtschaftlich statt militärisch
**Gemessen:** `moonOnly` tragen genau zwei Gebäude, beide `category:'defense'` – `abhorchposten`
(Z. 5128) und `mondschild` (Z. 5132). Ein Mond hat bis heute **kein einziges eigenes
Wirtschaftsgebäude**, obwohl der Kommentar bei Z. 5120 den Plural benutzt.
**Vorschlag (unverändert tragfähig):** „Massentreiber-Schleuder" – senkt die Flugzeit aller
Missionen, die von diesem Mond starten. Das Muster „Startort entscheidet" gibt es bereits beim
Tiefenhafen (`PLANET_ROLE_TIEFENHAFEN`, Z. 45989); `moonOnly` ist ein deklaratives Flag und wird an
genau drei Stellen ausgewertet (Z. 44956, 57879, 62660).

### 2.3 Event-Modul für die Raffineriekrise
**Gemessen:** `EVENT_CALENDAR` (Z. 13002) hat 7 Events. `raffineriekrise` (Z. 13032, `buffOnly:true`)
ist das einzige ohne Event-Modul. Dass es kein Event-**Schiff** bekam, ist direkt daneben begründet –
dass es kein **Modul** hat, nirgends.
**Aufwand:** ein Eintrag.

---

## 2a. Das nächste Projekt: Beute, Sets und Instanzen

**Auftrag Sascha, 18.08.2026:** „Findbare Module die zusammen set Bonus geben sowie Dungeons und
raids mit Belohnungen die es nur dort gibt vielleicht macht es Sinn eine item Struktur einzubauen."

Ausgearbeitet in **`docs/beute-und-instanzen-konzept.md`**. Der Kern der Bestandsaufnahme gehört
hierher, weil er die Ideenliste an mehreren Stellen berührt:

**Ein großer Teil davon ist bereits gebaut** — `MODULE_SET_DEFS` führt neun Sets, davon fünf
Boss-Sets mit gestaffelten Stufen (2/3/4 Teile); das Feld `quelle` ist ein fertiges
**Herkunfts-Schloss**, das Boss- und Unikat-Module aus jedem regulären Fundtopf, jeder Schmiede und
der Börse heraushält; `ALLIANCE_RAID_BOSSE` führt fünf Raid-Gegner mit eigenen Kampfregeln; und der
Abgrund ist ein Dungeon mit Mutatoren, Wächtern und zwölf Reliquien samt Satz-Boni.

**Die vier gemessenen Lücken:**

1. `SHIP_MODULE_DEFS` (44 Module) hat **keinen einzigen** Set-Bonus (gemessen: 0 Treffer für
   `shipModuleSet`/`shipSetBonus`). Das ist die direkteste Umsetzung des Auftrags.
2. Alle 20 Boss-Set-Teile fallen **ausschließlich** nach einer Allianz-Raid-Welle — solo ist keines
   davon je erreichbar.
3. Keine gestufte Schwierigkeit mit eigenem Beutetisch: Ein Boss lässt dieselben Teile fallen,
   egal wie stark die Allianz ist.
4. Fünf parallele Gegenstands-Systeme (182 + 44 + 30 + 6 + 12 Einträge) ohne gemeinsame Auskunft.
   Das Konzept schlägt dafür eine **abgeleitete Beschreibungs-Schicht** vor, ausdrücklich **keinen**
   Umbau der Speicherform — und sie ist zugleich der Träger für die `desc`-Prüfung aus Abschnitt 8.

---

## 3. Offene Posten aus den Konzeptdokumenten

Diese stehen bereits ausgearbeitet in `docs/`. Sie gehören hierher, damit die Ideenliste nicht
danebenher ein zweites Bild zeichnet.

| Posten | Quelle | Warum er wichtig ist |
|---|---|---|
| **B4 – Baustellen-Konto** ✅ UMGESETZT 19.08.2026 | `baustellen-konto-konzept.md` (§7: Abweichungen) | Die **Lagerwand**: Kosten wachsen mit ×1,32–1,38 je Stufe, `storageCap()` linear+logarithmisch. Ab einem Punkt ist eine Forschung *dauerhaft* unbezahlbar. Das Konzept nennt sie an Z. 45806 des Spiels selbst beim Namen. **Das ist die einzige Stelle, an der das Spiel wirklich endet.** |
| **D – Protomaterie-Abnehmer** | `wirtschaft-rebalance-konzept.md` §5 | Alle heutigen Proto-Senken sind einmalig. Enthält den fertig durchgerechneten **Urmaterie-Koloss** (Apex-Schiff mit direktem Proto-Anteil). |
| **V1 – Kostenkurve der Verteidigung brechen** | `verteidigung-flotte-konzept.md` §3 | `costMult` 1,18–1,4 bei linearem Nutzen. Ohne Deckel gibt es keine Obergrenze, an der Balance überhaupt festmachen könnte. **Achtung Bestandsschutz** (Kappungs-Marke, siehe CLAUDE.md). |
| **V3 – Punkteachse begradigen** | `verteidigung-flotte-konzept.md` §3 | 10 Punkte je Stufe unabhängig vom Gebäude belohnt die schwächsten Bauten am stärksten. Eingriff in `computeScore()` – rückwirkend, deshalb heikel. |

**A4 (Schildnetz / laufende Energiekosten für Verteidigung) ist bewusst gestrichen** –
`verteidigung-flotte-konzept.md` §4 begründet das; nicht neu vorschlagen.

---

## 4. Neue Befunde dieses Durchgangs

Alles hier ist am 18.08.2026 gemessen worden und stand im ersten Durchgang noch nicht drin.

### 4.1 Die Sektoren versprechen Mechanik, die es nicht gibt — **UMGESETZT 18.08.2026 (Etappe 3)**

> **Erledigt.** Die acht Sektoren tragen seither ein `mod`-Feld, sieben davon eine Wirkung. Was
> beim Umsetzen ANDERS entschieden wurde als hier vorgeschlagen, steht in CLAUDE.md unter
> „Sektor-Eigenschaften (Etappe 3)"; die drei wichtigsten Abweichungen:
>
> - **Vier Kanäle statt acht Einzelwirkungen** (Produktion, Expeditions-Ausbeute, Abgrundsplitter,
>   Flugzeit). Die Tabelle unten schlug für jeden Sektor eine eigene Mechanik vor – acht neue
>   Rechenwege wären acht neue Anzeigestellen gewesen. Vier Kanäle laufen alle über
>   `SEKTOR_KANAL_TEXT` und damit über EINE Anzeige-Quelle.
> - **Angriff, Verteidigung und Spionage-Sichtweite sind bewusst außen vor.** Sie entscheiden PvP,
>   und der Server rechnet sie nach – eine Sektor-Tabelle im Backend wäre eine zweite Kopie, die bei
>   einem hängenden Deploy auseinanderläuft (dieselbe Wahl wie bei den drei neuen Doktrinen).
>   Damit entfallen die Vorschläge „+ Beute aus NPC-Kämpfen" und „+ Verteidigung hier stationierter
>   Flotten" ersatzlos.
> - **Der Befund war noch schärfer als hier beschrieben:** Die `desc`-Texte versprachen die Mechanik
>   nicht nur – sie wurden **nirgends gerendert**. Ein Versprechen, das nur im Quelltext steht, ist
>   für den Spieler weder ein Versprechen noch ein Bruch. Deshalb gehörten fünf Anzeigestellen
>   genauso zwingend zur Etappe wie die Mechanik selbst.
>
> Der Rest dieses Abschnitts bleibt als Herleitung stehen – die Messung war richtig, nur die
> vorgeschlagene Belegung ist überholt.


**Gemessen:** `SEKTOR_DEFS` (Z. 13328) hat 8 Einträge mit den Feldern `key`, `name`, `cx`, `cy`,
`tint`, `desc` – **kein einziges Wirkungsfeld**. `sektorVon()` (Z. 13338) wird an zwölf Stellen
benutzt, **alle** im Kartenzeichnen und in der Blätter-Reihenfolge (Z. 53528–54603). Der Sektor
eines Planeten hat auf nichts im Spiel eine Auswirkung.

**Die `desc`-Texte behaupten aber etwas anderes** – wörtlich:

- Wispern-Drift: „weite Wege, **ergiebige Gürtelbahnen**"
- Solmark-Reichweite: „umkämpft, aber **reich an Anomalien**"
- Pulsar-Felder: „**Navigation verlangt Erfahrung, belohnt sie aber**"
- Ilyra-Tiefen: „dünn kartiert, **voller Passagen**"
- Meridian-Weiten: „**alte Handelspfade**, verstreute Höfe"

Das ist derselbe Fehlertyp wie in Abschnitt 2, nur an einer Fläche, die seit KB-4 bis KB-16 die
meistbeachtete des Spiels ist: Der Spieler liest eine Eigenschaft und sucht sie vergeblich.

**Vorschlag:** Je Sektor **genau eine** Wirkung, die den vorhandenen Text einlöst – klein (10–20 %),
additiv in eine bereits gedeckelte Gruppe, nie eine eigene Multiplikation:

| Sektor | Wirkung, die der Text schon verspricht |
|---|---|
| Kepler-Kern | bewusst neutral (Heimatcluster – hier soll nichts locken oder abschrecken) |
| Wispern-Drift | + Vorrat/Ausbeute der Asteroidenvorkommen im Sektor |
| Solmark-Reichweite | + Wahrscheinlichkeit für Expeditions-Sonderereignisse von hier |
| Obsidian-Saum | + Beute aus NPC-Kämpfen, dafür längere Anflugzeit dorthin |
| Meridian-Weiten | + Handelsrouten-Ertrag für Routen mit Endpunkt im Sektor |
| Pulsar-Felder | − Spionage-Sichtweite (**beidseitig**), + Verteidigung hier stationierter Flotten |
| Ilyra-Tiefen | − Flugzeit **innerhalb** des Sektors |
| Randmarken | + Abgrundsplitter für Tauchgänge, die von hier starten |

**Warum das mehr ist als ein Prozentwert:** Die Wahl des Koloniestandorts hat heute genau zwei
Dimensionen (Planetentyp und Entfernung). Mit Sektor-Eigenschaften bekommt die Karte zum ersten Mal
eine **geografische Strategie** – und die acht Sektoren, die KB-4 bis KB-16 mühsam bedienbar gemacht
haben, bekommen einen Grund, sie anzusehen.

**Aufwand:** mittel. Eine Nachschlagefunktion (`sektorMod(planetKey, kanal)`), Einhängen in die
vorhandenen additiven Gruppen. **Risiken, die dazugehören:** (a) Regel 6 – die Wirkung muss an der
Sektoransicht, am Systemknoten, auf der Planetenkarte, im Kolonisierungs-Dialog und in
`HELP_SECTIONS` stehen, sonst ist sie unsichtbar; (b) **Bestandsschutz** – vorhandene Kolonien
bekommen die Wirkung rückwirkend geschenkt oder entzogen. Deshalb nur Boni, keine Mali (der
Obsidian-Anflug und die Pulsar-Sicht sind bewusst als beidseitige/örtliche Eigenschaften formuliert,
nicht als Strafe).

### 4.2 Drei Doktrinen für acht Planetenrollen

**Gemessen:** `DOCTRINE_DEFS` (Z. 12451) hat **3** Einträge – das dünnste System des Spiels, und
zugleich die einzige imperiumsweite Identitätsentscheidung. `PLANET_ROLES` (Z. 45990) hat **8**
Rollen. Nur drei davon sind an eine Doktrin gekoppelt (`shipyard`, `fortress`, `trade`).
**Ohne Doktrin-Synergie: `mining`, `science`, `logistics`, `deepport`.**

Das ist ein fertiger Aufhänger: Die Kopplung ist schon gebaut (Feld `syn` mit `rolle`/`rolleName`
und denselben vier Kanälen), die Rollentexte nennen ihre Doktrin-Synergie bereits im `detail` – bei
den vier gekoppelten. Wer heute auf Wirtschaft spielt, hat **keine** Doktrin, die zu ihm passt.

**Vorschlag – drei neue Doktrinen, je eine auf eine bisher unbenutzte Rolle:**

- **Erschließungs-Doktrin** (syn: Bergbau-Welt) – der Wirtschaftsspieler bekommt zum ersten Mal eine
  eigene Doktrin.
- **Aufklärungs-Doktrin** (syn: Forschungs-Welt) – zahlt auf Expedition und Spionage, zahlt mit
  Kampfkraft.
- **Bergungs-Doktrin** (syn: Tiefenhafen) – die erste Doktrin, die auf den Abgrund zeigt; ebenso wie
  der Tiefenhafen selbst nur sichtbar, wenn der Abgrund freigeschaltet ist.

**Zwei Ausbaustufen, die man vorher entscheiden muss:**
- *klein:* nur die vier vorhandenen Kanäle (`atkMult`, `defMult`, `fuelMult`, `cargoMult`) benutzen
  – dann sind es reine Einträge, kein neuer Code, kein Backend.
- *groß:* neue Kanäle (Produktion, Expeditionsausbeute, Splitter) – dann ist es echter Code, und
  jeder Kanal braucht seine Anzeigestellen. **Und die Backend-Parität ist Pflicht**, sobald ein
  Kanal einen PvP-Kampf berührt.

Der **Umschulungsbefehl** (Doktrin-Wechsel als Fundstück) existiert bereits – der Wechsel ist also
schon bezahlbar gemacht.

### 4.3 Verteidigung: 0 von 102 Erfolgen, 0 von 28 Kosmetikstücken — ausgeliefert

> **Erledigt am 18.08.2026** (Etappe 1, PR #436 im Frontend und #127 im Backend): Bollwerk-Reihe
> (fünf Erfolge, rückwirkend), zwei Titel, zwei Kosmetikstücke. **Mit einer Korrektur am Befund
> unten:** `pvpDefended` ist NICHT fälschungssicher — der Server schreibt es zwar, aber in den
> *Spielstand*, und der ist klientenautoritativ. Für die Erfolge ist das in Ordnung, für eine Farbe
> in der Bestenliste nicht; sie hängt deshalb an einem neuen, serverseitigen Zähler
> (`staub.abwehrGesamt`) hinter dem vorhandenen Absprache-Riegel. Die Erfolgszahl steigt damit von
> 102 auf 107; die Zahlen weiter unten beziehen sich auf den Stand davor.

**Gemessen:**
- `ACHIEVEMENTS` (Z. 19545) hat **102** Einträge. Zeilen mit Verteidigungsbezug (`pvpDefended`,
  „abgewehrt", „Verteidig", `defensePower`, `bastion`): **null**.
- `KOSMETIK_DEFS` im Backend hat 28 Stücke; die Bedingungsarten sind `namensfarbe`, `immer`,
  `spender`, `spender_je`, `prestige`, `aufstieg`, `kampfpunkte`, `abgrund`, `emblem`, `kauf`,
  `erfolge`, `bosse` – **keine einzige Verteidigungsgröße**. Kampfpunkte gibt es ausschließlich
  fürs Angreifen (`verteidigung-flotte-konzept.md` §1.3).
- `state.pvpDefended` wird **server-seitig** hochgezählt (`server.js:3413`) und im Frontend an
  **genau einer** Stelle angezeigt (Z. 38082).

**Warum ausgerechnet das sauber ist:** Die Prüffrage dieses Projekts für jedes Belohnungssystem
lautet „Kann der Server die Bedingung SELBST beobachten?" – an ihr ist der Wochenpass gescheitert
(CLAUDE.md). Der abgewehrte Angriff ist eine der ganz wenigen Fortschrittsgrößen, die der Server
selbst würfelt und selbst zählt. Eine Verteidigungs-Kosmetik ist damit **fälschungssicher**, während
fast jede andere es nicht wäre.

**Vorschlag, drei Teile, unabhängig lieferbar:**
1. Erfolgsreihe „Bollwerk" I–V auf `pvpDefended` (Zähler existiert, Frontend-Arbeit).
2. Kosmetik-Bedingungsart `abgewehrt` mit zwei bis drei Stücken. `test_kosmetik_paritaet.js`
   Abschnitt 1f prüft **jede** Bedingungsart automatisch mit – die Absicherung ist also schon da.
3. Ein bis zwei Einträge in `TITLE_MAP` – die hat **11** Einträge gegen 102 Erfolge (Z. 19809), und
   ihre Reihenfolge ist die Rangfolge.

Damit hätte Verteidigung nach den Bastionsmarken (Fortschritt) auch **Anerkennung** – die zweite
Hälfte des Befunds aus §1.3 des Verteidigungskonzepts.

### 4.4 Gefechtsvorräte: zwei Einträge, beide dieselbe Zahl

**Gemessen:** `GEFECHTSVORRAETE` (Z. 23679) hat **2** Einträge – einen für Angriff, einen für
Verteidigung, **beide +8 %**. Das System ist der einzige *wiederkehrende* Tier-2-Abnehmer des
Spiels (Etappe B1a, v8.560.0), und die Auslieferung heißt selbst „B1a", setzt ein B1b also voraus.

**Der Befund dahinter:** Solange jeder Vorrat dieselbe flache Prozentzahl gibt, ist die Wahl keine
Entscheidung, sondern ein Häkchen. Der PvP-Kampf läuft aber in **drei Phasen mit 10–90 %-Deckel** –
darin steckt Raum für Vorräte, die etwas anderes tun als addieren:

- **Störfeld-Emitter** – senkt die Gegnerchance in der **ersten** Phase. Wirkt gegen überlegene
  Gegner stärker als eine flache Zahl, gegen schwächere gar nicht.
- **Reparaturdrohnen-Schwarm** – senkt die eigenen Schiffsverluste, **unabhängig vom Ausgang**. Der
  erste Vorrat, der auch eine Niederlage verbessert.
- **Enterprämie** – erhöht die Kaperchance. Verbindet die Vorräte mit dem Prisengut (siehe 5.4).

**Pflicht dabei:** Backend-Parität. Ein Vorrat verändert den Ausgang eines Kampfes gegen einen
echten Spieler – die Regeln dafür stehen ausformuliert in der Backend-CLAUDE.md („warum der Server
sie rechnet UND abbucht"), inklusive der Falle, dass `attackPower` an sechs Stellen ausgegeben wird.

### 4.5 Der Abgrund sagt selbst, dass er zu Ende ist

**Gemessen und unverändert:** `abgrundReliktDef()` (Z. 47537) rechnet zyklisch – der Kommentar
darin sagt ausdrücklich, die Sammlung sei „mit Tiefe 120 vollstaendig". `ABGRUND_WAECHTER_NAMEN`
(Z. 46481) hat 12 Namen und wiederholt sie mit „(n. Wiederkehr)". Der letzte Chronik-Eintrag
(Z. 47683, Tiefe 150) lautet wörtlich:

> „Es gibt nichts mehr zu entdecken, was sich in Berichte fassen ließe. Was bleibt, ist die Zahl,
> die größer wird, und die Gewissheit, dass sie das immer tun wird."

Das ist ehrlich geschrieben und trotzdem die Stelle, an der ein Langzeitspieler aufhört. **Vorschlag
unverändert:** zweite Reliquienreihe ab Tiefe 130, zwölf weitere Wächternamen, vier bis sechs neue
Chronik-Einträge – und **Tiefen-Meilensteine, die Sternenessenz zahlen** (25/50/75/100/125/150, nach
dem Vorbild von `RESEARCH_MILESTONES`). Heute zahlt der Abgrund nur in Punkte und einen
logarithmischen Produktionsbonus, also in nichts, was den Aufstieg überlebt.

### 4.6 Der Aufstieg verlangt beim zehnten Mal genau so viel wie beim ersten

**Gemessen, unverändert:** `ASCENSION_MIN_PRESTIGE = 3` (Z. 29794) und `ASCENSION_MIN_SCORE = 50000`
(Z. 29795) sind Konstanten. Der Baum hat inzwischen 7 Zweige und keine Maximalstufe mehr, aber der
**Weg dorthin** ist eine Schleife mit gleichbleibender Länge.
**Vorschlag:** Schwelle wächst mit `state.ascension.count` (z. B. Punktschwelle ×1,6 je Aufstieg,
Prestige-Schwelle +1 alle drei) – und dafür eine sichtbare **Aufstiegs-Chronik**, die jeden Aufstieg
mit Datum, Punktestand und gerettetem Bestand festhält. Wer den zwanzigsten Aufstieg macht, soll die
neunzehn davor sehen können.

### 4.7 Die Musterangriff-Maschinerie hat kein PvE-Ziel

**Unverändert aus dem ersten Durchgang, hier nur bestätigt:** Sammelfenster, Beitritt, gemeinsamer
Abflug, serverseitige Auflösung, Berichtskarte, Benachrichtigungskategorie und Flottenwahl-Feld sind
alle gebaut und getestet (der Prüflauf richtet dafür eigens einen laufenden Musterangriff ein).
Es fehlt ausschließlich ein **Ziel, das keine fremde Allianz ist** – ein Fraktions-Bollwerk, das
eine Allianz gemeinsam knackt. Das ist der billigste große Mehrspieler-Inhalt, den dieses Repo
hergibt: eine Zielart auf einer fertigen Maschine.

---

## 5. Töpfe ohne Senke (alle vier nachgemessen, alle vier offen)

| Topf | Gemessener Stand |
|---|---|
| **Bergungsgut** | Einziger Nicht-Schiff-Abnehmer bleibt die **Bergungswerft** (Z. 5074), die sich selbst „das einzige Gebäude" nennt. Alle übrigen Treffer sind die neun Tiefenschiffe. |
| **Abgrundsplitter** | Nach ausgebauter Werkstatt bleibt genau eine Senke: 200 Splitter → Kredite (`ABGRUND_SPLITTER_VERKAUF`, Z. 17220), bewusst schlecht verzinst. |
| **Kommandopunkte** | Eine unbegrenzte Senke (Tagesaufgaben-Neuwurf). Vorschlag „Offiziersstab" (unbegrenzte, stark abflachende Stufe über `OFFICER_MAX_LEVEL`) unverändert tragfähig. |
| **Prisengut** | Der Prisenhof (Z. 24009 ff.) ist die einzige Senke und endlich. Vorschlag „Prisenwerft" – je Stufe N gekaperte Schiffe pro Kampf direkt in die Flotte statt in Prisengut, begrenzt auf die Klassen, die `isBoardable()` ohnehin zulässt. Verbindet sich mit der **Enterprämie** aus 4.4. |

---

## 6. Dünn befüllte Systeme (Zählung 18.08.2026, maschinell)

Gut gefüllt, kein Handlungsbedarf: `MODULE_DEFS` 182 · `EXPEDITION_SPECIAL_EVENTS` 63 ·
`RANDOM_EVENTS` 60 (mit Wahl A/B – ein reifes System) · `RESEARCH_DEFS` 53 · `BUILDING_DEFS` 51 ·
`SHIP_DEFS` 46 · `SHIP_MODULE_DEFS` 44 · `ITEM_DEFS` 30 · `KOSMETIK_LOOK` 28 · `SKILL_TREE` 23 ·
`ACHIEVEMENTS` 102.

Auffällig dünn **im Verhältnis zu ihrer Sichtbarkeit**:

| System | Zeile | Anzahl | Anmerkung |
|---|---|---:|---|
| `GEFECHTSVORRAETE` | 23679 | **2** | siehe 4.4 – beide mit derselben Zahl |
| `ALLIANCE_PROJECT_DEFS` | 15058 | **2** | Kriegsrat (endlich) + Werftkonvoi (unendlich) |
| `DOCTRINE_DEFS` | 12451 | **3** | siehe 4.2 – dünnstes Wahlsystem des Spiels |
| `MEGA_PROJECTS` | 45749 | **3** | drei Projekte tragen den kompletten Endausbau |
| `ALLIANCE_SKIN_DEFS` | 41464 | **4** | Vorrat läuft ab dem 5. Großprojekt trocken |
| `HAPPY_HOUR_TYPES` | 22656 | **4** | Antimaterie nur im 25-%-Sammeltyp |
| `FACTION_DIPLOMACY` | 18023 | **4** | ohne `lore`, ohne `motto` (gemessen: 0 Felder) |
| `ALLIANCE_MISSION_TYPES` | 41218 | **5** | speist alle drei Kadenzen |
| `SIGNAL_TYPES` | 56533 | **5** | keines zeigt auf die Fraktionen |
| `ALLIANCE_TITLE_DEFS` | 41378 | **6** | Vorrat läuft ab dem 7. Großprojekt trocken |
| `EXPEDITION_TYPES` | 56061 | **6** | `derelict`-Band nur von `salvage` bedient |
| `SHIP_SYNERGY_DEFS` | 25914 | **6** | zwei Klassen ganz ohne Synergie |
| `ASCENSION_TREE_DEFS` | 29796 | **7** | siehe 4.6 |
| `TITLE_MAP` | 19809 | **11** | gegen 102 Erfolge |

Die drei Allianz-Zeilen stechen weiter heraus: **Ehrentitel und Anstriche laufen nachweislich
trocken** – ab dem 7. bzw. 5. Großprojekt vergeben die Belohnungszeilen nichts mehr.

---

## 7. Welt statt Zahlen (der billigste Inhalt)

Kein Balancing, kein Test, kein Backend – nur Schreiben. **Alle drei nachgemessen:**

- **Sektorarchiv:** `PLANETS` (Z. 14123) hat 499 Einträge, davon **185 handgeschrieben** und 314
  generierte `gx*`-Welten. **`lore:`-Felder: 0.** Namen wie „Verlorene Hoffnung" tragen keine Zeile
  Text. Ein Feld `lore`, aufgedeckt beim Erkunden – die generierten Welten bleiben bewusst außen vor.
- **Fraktions-Dossiers:** `FACTION_DIPLOMACY` (Z. 18023) hat 4 Fraktionen, **0 `lore`- und
  0 `motto`-Felder**. Drei Rang-Splitter, die sich mit steigendem Ruf aufdecken – Rang 1 nennt
  Gerüchte, Rang 8 die Wahrheit.
- **Konvoi-Zwischenfälle:** `ROUTE_PIRACY_CHANCE = 0.05` (Z. 15287) ist heute ein stiller Ausfall.
  Sechs bis acht benannte Zwischenfälle mit Text und Ausgang machen daraus ein Ereignis, das man
  bemerkt – und geben `ROUTE_PIRACY_CHANCE_PROTECTED` (Z. 15288) endlich eine spürbare Bedeutung.

---

## 8. Werkzeug, das über allem steht

**Automatische Beschreibungs-Prüfung.** `check-icons.js` enthält (gemessen) **null** Vorkommen von
`desc`; es prüft ausschließlich Symbole. Der meistgemeldete Nicht-Bug des Projekts ist aber eine
fehlende oder abgekürzte Beschreibung – Hausregel 7 verlangt zu jedem Inhalt eine vollständige
`desc`, geprüft wird das bis heute von Hand.

Ein Prüfschritt, der alle DEFS-Arrays auf leere oder zu kurze `desc`/`effectDesc`-Felder abklopft,
sichert **jede** Idee dieser Liste ab, statt den Fehler ein siebtes Mal zu wiederholen. Er gehört
neben `check-icons.js` in die Pflichtprüfungen von `tests/run.js`.

---

## 9. Empfehlung

Keine Reihenfolge, sondern drei Körbe – Sascha entscheidet, was daraus wird.

**Korb A – schreiben, nicht bauen (Wirkung sofort, Risiko praktisch null):**
2.1 Modulsymbole · 2.3 Raffineriekrise-Modul · 7. Sektorarchiv, Fraktions-Dossiers,
Konvoi-Zwischenfälle · 4.5 Abgrund-Chronik und Wächternamen.

**Korb B – Inhalt auf fertiger Maschine (mittlerer Aufwand, hoher Ertrag):**
4.3 Verteidigungs-Erfolge und -Kosmetik (die Bedingung beobachtet der Server bereits selbst) ·
4.2 drei neue Doktrinen in der *kleinen* Ausbaustufe · 4.4 zwei bis drei weitere Gefechtsvorräte ·
4.7 Fraktions-Bollwerk als Musterangriff-Ziel · 2.2 Massentreiber-Schleuder.

**Korb C – Struktur (groß, verändert das Spiel dauerhaft):**
B4 Baustellen-Konto (die Lagerwand – der einzige Posten, bei dem das Spiel wirklich endet) ·
4.1 Sektor-Eigenschaften · 4.6 eskalierender Aufstieg mit Chronik · V1/V3 aus dem
Verteidigungskonzept.

**Wenn nur eine Sache passiert:** das **Baustellen-Konto** (B4). Alles andere fügt Inhalt hinzu; B4
entfernt die einzige Wand, hinter der kein Inhalt mehr hilft.
**Umgesetzt am 19.08.2026** – für die Forschungs-Warteschlange, bewusst nicht für alle drei
(Begründung und die Abweichungen vom Entwurf: `baustellen-konto-konzept.md` §7). Die Wand bei den
Mega-Ausbaustufen steht damit noch; sie ist die nächste Ausbaustufe derselben Mechanik.

**Wenn nur eine kleine Sache passiert:** die **Verteidigungs-Erfolge** (4.3). Null von 102 ist eine
Lücke, die jeder Verteidiger spürt, und die Zähler dafür laufen seit Monaten mit.
