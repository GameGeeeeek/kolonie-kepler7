# Sektorkarte: tiefergehender Inhalt

Konzept, 19.08.2026. Alle Zeilenangaben auf `weltraum_kolonie.html`, sofern nicht anders genannt.
Grundlage: vier Bestandsaufnahmen, vier Entwurfsrunden, drei Jury-Durchgänge — plus die unten
ausdrücklich markierten Nachmessungen dieser Sitzung (nur gelesen, keine Datei angefasst, kein
Browser gestartet; ein Prüflauf lief).

---

## 1. Was die Karte heute ist

Die Sektorkarte hat seit KB-4 genau drei Ebenen — Regionsübersicht (`sektorUebersichtBauen`,
Z. 54908), Sektoransicht (`sektorAnsichtBauen`, Z. 55059) und aufgeklapptes System (`buildMap`,
Z. 56114) — und ist damit die einzige Karte des Spiels. Auf der Regionsebene trägt ein Knoten
genau drei Textzeilen: Name, „N Systeme" und die Eigenart-Kurzform (Z. 54958–54960); alles
Weitere steckt in SVG-`<title>`-Tooltips, die am Handy unerreichbar sind. Die acht Regionen wirken
über vier Kanäle (`SEKTOR_DEFS` Z. 13715, Rechenstellen Z. 22377 / 23613 / 24306 / 47771), sonst
ist die Karte eine Zeichnung mit Sprungzielen.

**Was fehlt: Die Karte beantwortet an keiner Stelle die Frage „wohin fliege ich als Nächstes, und
warum ausgerechnet dorthin?"** — sie zeigt, wo Dinge *sind*, nie, was dort *los ist*.

Vier Belege dafür, alle in dieser Sitzung am Code nachgeprüft:

- `karteSystemBadges` (Z. 55010–55056) führt sieben Abzeichen (🏰 🏴‍☠️ 👽 ⚔️ 🌀 🔎 📡) — **kein
  einziges für Asteroidenfestung oder Alien-Nest.** Beide leben nur im aufgeklappten System
  (`data-map-festung` Z. 56338, `data-map-nest` Z. 56381). `festungFaktoren` (Z. 13584) hat
  genau zwei Aufrufer (Z. 57161, 57330) — beide in der Abbaurechnung, keiner auf der Karte.
- **Selbst nachgerechnet** (`NPCS` Z. 16017 gegen `STAR_SYSTEMS` Z. 13307 und `sektorVon`
  Z. 13764): 18 NPC-Einträge in 15 von 67 sichtbaren Systemen, davon **12 Einträge in 10 Systemen
  im Kepler-Kern**; obsidian, meridian und ilyra haben **null**. 52 sichtbare Systeme tragen
  keinen NPC.
- `npcMapMenu` (Z. 55741–55757) hat **genau einen Eintrag** („Angreifen") und ruft `openKarteMenu`
  mit vier statt fünf Argumenten — der `infoHtml`-Parameter (Z. 55589) bleibt ungenutzt. Der
  Spieler entscheidet über einen Angriff, ohne zu wissen wogegen.
- `SEKTOR_DEFS[].desc` wird **nirgends gerendert**: „Der stille Norden" (Z. 13719) kommt in der
  ganzen Datei genau einmal vor, in seiner eigenen Definition. Von 15 `SEKTOR_DEFS`-Fundstellen
  liest keine `desc`. Der Kommentar Z. 13694 behauptet das Gegenteil.

Dazu ein **ausgelieferter Fehler**, verifiziert: `festung-angriff` fehlt in `MISSION_LINIEN`
(Z. 55889–55896, sechs Einträge) und hat keinen Zweig in `missionMapZiel` (Z. 55900–55919, nur
`attack` und `nest-angriff`). Die Mission trägt `targetId: sysId`, der generische Zweig sucht
`PLANETS.find` und liefert `null` — **der Festungssturm hat keine Flugbahn auf der Karte**,
während sein Schwestermechanismus Nest-Angriff eine hat.

---

## 2. Die fünf Vorschläge

### V1 — Landmarken: die Karte zeigt, was wo los ist

*(Zusammenführung der Entwürfe „Landmarken" und „Gefechtsstand" — sie ergänzen sich vollständig:
der eine bringt die Antippbarkeit, der andere die Kennzahl.)*

**Was der Spieler tut.** Er öffnet die Regionsübersicht und sieht, in welchen Regionen Festungen,
Nester und Gegner stehen; ein Tipp auf die Abzeichenzeile listet die Systeme namentlich und
springt hin. Im Kartenmenü eines NPC steht erstmals, wie stark der ist — und wie alt diese
Auskunft ist.

**Wie es rechnet.** Drei neue Einträge in `karteSystemBadges` (Z. 55010), alle hinter
`karteEbeneAn('ereignisse')`:
- 🛡 Festung aus `festungFaktoren(sysId)` (Z. 13584) — Stufenname aus `FESTUNG_STUFEN` (Z. 13443),
  Kernstand in Prozent, Blockade in Prozent.
- 👾/👑 Nest aus `nesterImSystem(sysId)` (Z. 13505) — Volk, stärkste Stufe, Anzahl. Ein System mit
  drei Nestern bekommt **ein** Abzeichen mit Zahl.
- 🎯 NPC aus `NPCS.filter(n => n.system === sysId)`. Nicht ⚔️ — das ist an den Fraktionskrieg
  vergeben (Z. 55018).

Die NPC-Kennzahl ist ein **echter Wissensstand, kein Vorhang**: `npcEffectiveDefense` (Z. 20279)
rechnet `npc.defense × (1 + npcScalingCount(id)·0,18) × npcEmpireStrength × prestigeChallengeMult()`.
`npcScalingCount` steigt nach **jedem eigenen Sieg um 1**, also +18 Prozentpunkte, die der Spieler
selbst verursacht hat. `state.npcIntel[npcId] = { at, def, scal }` wird ausschließlich bei der
Auflösung eines eigenen Angriffs geschrieben. Anzeige mit der Farbcodierung, die der Spieler vom
🔎-Abzeichen schon kennt (Z. 55040–55046): cyan frisch, grau > 30 min, amber verfälscht; ohne
Eintrag „hier war noch keine eigene Flotte". Ist `scal` seither gestiegen, steht dort „seit deinem
letzten Sieg mindestens +18 %" **je Differenz** — abgeleitet aus dem eigenen Siegzähler, also
nachrechenbar.

**Ausdrücklich kein Vorhang vor Festungs- und Nestdaten:** `ladeAsteroidfeld` ersetzt
`state.asteroidFeld` in **einem** Abruf durch alle Felder des Servers (Z. 13936/13939),
`galaxyCache.alienNester` reist über `galaxyFuerClient` ohnehin komplett mit. Eine Sperre davor
wäre eine, die jede Entwicklerkonsole in fünf Sekunden aufzieht.

**Kartenebene.** Alle drei. `karteSystemBadges` ist die eine Quelle beider Renderer — gerufen bei
Z. 54940 (Übersicht, aggregiert) und Z. 55125 (Sektoransicht). Ein Eintrag versorgt beide.

**Autorität.** Keine. Es wird nichts entschieden, nichts verteilt, keine Zahl geändert — nur
angezeigt und navigiert. Kein Backend, kein Schalter.

**Bestehende Anzeigestellen, die mitwandern müssen.**
| Stelle | Zeile | Warum |
|---|---|---|
| Status-Chips der Detailtafel | 56165–56192 | führt heute NPCs, Gürtel, Trümmer — aber weder Festung noch Nest; sonst sagt die Karte „Sternenfeste" und die Tafel darunter schweigt |
| 👽-Abzeichen | 55017 | sagt nur „`<Volk>` gesichtet", obwohl der Server den Ort auf das **stärkste** Nest nachführt (server.js:9028) — widerspräche sonst dem neuen 👾 im selben System |
| `performSectorSearch` | 58678–58684 | durchsucht nur `visibleSystems()` und `PLANETS`; eine Festung, die man sieht aber nicht suchen kann, ist auf 67 Systemen nicht auffindbar |
| `MISSION_LINIEN` + `missionMapZiel` | 55889 / 55900 | `festung-angriff` fehlt in beiden (ausgelieferter Fehler, siehe oben) |
| `karteAuffangSignatur` | 54489–54509 | braucht einen **schlanken** Nest-Anteil (id + stufe + lp/1000); sonst steht ein gefallenes Nest bis zu 5 s weiter auf der Karte (Z. 65145). `state.asteroidFeld` ist bereits drin |
| NPC-Angriffsvorschau + Kampfbericht | 22833 ff. | nennen sie die Stärke nicht, sind sie die zweite Anzeigestelle mit der alten Annahme |
| Übersicht: Kopf, Fuß, Legende | 54954–54966 | hat heute weder Titel noch „Region antippen" noch eine Abzeichen-Legende — die Sektoransicht eine Ebene tiefer hat all das (55190–55203) |
| `HELP_SECTIONS` „Aufklärung auf der Sektorkarte" | bei 39371 | beschreibt heute nur 🔎/🛡 für ausgespähte **Spieler** |

Und hier kommt `sk.desc` endlich unter: als Text im antippbaren Regionsmenü, nicht nur im
`<title>`.

---

### V2 — Die acht Statthalter: eine benannte Figur je Region

**Was der Spieler tut.** Er reist in eine Region, die ihm bisher nichts geboten hat, und schlägt
dort einen benannten Gegner, der eine andere Schiffsklasse fürchtet als alle anderen — und der
sich merkt, wie oft er ihn schon geschlagen hat.

**Wie es rechnet.** Acht neue `NPCS`-Einträge (Tabelle Z. 16017) mit den **vorhandenen** Feldern
id/name/level/defense/duration/loot/weakness/system, plus zwei neuen: `statthalter:'<sektorkey>'`
und `chronik` (Textfunktion mit vier Fassungen für 0 / 1–2 / 3–9 / 10+ Siege, gelesen aus
`npcScalingCount`, Z. 16044–16047). Keine neue Tabelle, keine neue Kampfrechnung.

Platziert je in einem System **ohne** heutigen NPC — davon gibt es gemessen 52.

**Die Verteidigungswerte liegen in den Lücken der vorhandenen Leiter, nicht darüber.** Gemessene
Reihe der 18 Einträge: `30, 65, 105, 155, 225, 320, 450, 600, 820, 1400, 1700, 2200, 2800, 3600,
5200, 8000, 12500, 20000` bei Level 1–40. Die acht Statthalter bekommen **260 / 700 / 1.150 /
1.900 / 3.000 / 4.400 / 6.500 / 10.500** — jeder zwischen zwei echten Nachbarn. Der schwächste
liegt zwischen „Schattenflotte Xar" (225) und dem nächsten (320), ist also im frühen Spiel
erreichbar; das ist der einzige Vorschlag im Feld, der Anfänger und Endspiel gleichzeitig bedient.

Die Eigenart des Sektors wird im Kampf spürbar, **ohne eine Zeile Zusatzarbeit**: der NPC-Angriff
übergibt sein Zielsystem bereits an `missionDurationFor` (Z. 22842), dort greift `sektorFlugMult`
(Z. 24306) — der Ilyra-Statthalter ist 12 % schneller zu erreichen als der Wispern-Statthalter.

Erstsieg: **3 Sternenessenz + 40 Kampfpunkte**, gemerkt in `state.statthalterKills` nach dem
exakten Muster von `claimedBossKills` (Z. 20701 / 30617 / 30826 / 30946). Acht Erstsiege = 24
Essenz und 320 KP — zum Vergleich zahlen Festung und Nest je Auflösung 15 bis 1.200 KP
(server.js:8222–8225 / 8970–8974).

Dazu eine **neue** Kompendium-Kategorie `statthalter` (0/8) — ausdrücklich keine Erweiterung von
`bosses`: `compendiumClaimed` überlebt jeden Reset (Kommentar Z. 17654), wer `bosses` schon
eingelöst hat, sähe es sonst auf 3/11 zurückfallen. Nebenbei wird der Kategoriename dort zum
ersten Mal wahr — „Besiegte Sektor-Bosse" zählt heute hart `['boss1','boss2','boss3']`
(Z. 17683), und die sitzen in drei von acht Sektoren, zwei davon derselbe.

**Kartenebene.** Neues Abzeichen ⚑ in `karteSystemBadges` — bewusst **ohne** Ebenen-Gate, wie 🏰
(Z. 55012, gemessen das einzige ohne Gate): ein Statthalter ist kein Ereignis, sondern eine feste
Tatsache. Damit erscheint er automatisch aggregiert auf der Übersicht. Auf der Systemebene
bekommt `npcMapMenu` endlich sein `infoHtml`: Chronik, Siegzähler, Schwäche, Verteidigung,
Vergleichsbalken (`.kmenu-info` steht bereits, Z. 1006–1009; Vorbild `festungMapMenu` Z. 57492).

**Autorität.** Keine. NPC-Kämpfe rechnet vollständig der Client; der Server kennt `NPCS` nicht.
Die **einzige** Größe, die ihn berührt, sind die 320 Kampfpunkte — `battlePoints` gehen mit
Faktor 3 in den serverseitig nachgerechneten Punktestand (server.js:2773) und haben in
`SAVE_SANITY_LIMITS` keine Grenze. Einmalig und klein, aber ein Ranglisten-Eingriff und als
solcher zu benennen.

**Anzeigestellen, die mitwandern.** Status-Chip der Detailtafel (Z. 56177 sagt heute pauschal
„Gegner: " + Name — ein Statthalter braucht seinen eigenen Chip, sonst fällt die ganze Erzählung
auf dieser Ebene in sich zusammen), `performSectorSearch`, `HELP_SECTIONS`, `ACH_ICONS` falls ein
Erfolg dazukommt. Jeder Eintrag braucht Icon **und** vollständige `desc` (Checklistenpunkt 7).

---

### V3 — Sprungnetz: Entfernung wird zu etwas, das man bauen kann

**Was der Spieler tut.** Er fliegt zu höchstens drei (später fünf) frei gewählten Systemen und
setzt dort eine Sprungbake. Jede Mission mit Ziel im Umkreis fliegt schneller. Die Frage „wo setze
ich meine drei Baken?" ist die einzige im ganzen Feld, für die man die Karte **ausmisst**.

**Wie es rechnet.** `state.sprungbaken = { <sysId>: { seit } }`, `SPRUNGBAKEN_MAX = 3`, über eine
zweistufige Forschung auf 5. Gesetzt per Mission `bake-setzen` nach **Form A** der Rundflug-Regel
(`endTime = jetzt + flug`, Wirkung bei der Heimkehr — eine Bake hat keine Frist).

Neuer Faktor `sprungnetzMult(targetSystem)` in `missionDurationFor` (Z. 24285), direkt neben
`allianceBaseFlightMult` (24303) und `sektorFlugMult` (24306) — beide hängen schon am Zielsystem
und lassen Missionsarten ohne Ziel unberührt:

```
d = min über alle Baken von systemSectorDistance(bake, ziel)     // Z. 14870
d > 2,0  → 1,0
sonst    → 1 − 0,18 × (1 − d/2,0)
```

Kalibrierung (aus dem Entwurf, Greedy über alle 67 sichtbaren Systeme): eine Bake mit R = 2,0
deckt im Median 8 Systeme, drei decken 36 von 67, fünf decken 49. Bei R = 2,5 wären es 46 bzw. 58
— deshalb 2,0: es bleibt eine Wahl statt einer Flächendeckung. Kein Protomaterie-Rückerhalt beim
Abbau; die Ortswahl ist eine Festlegung.

**Diese Etappe bringt eine Bestandsreparatur zwingend mit.** Gemessen endet `missionDurationFor`
mit `return sec * mult;` (Z. 24308) — die Einzelterme tragen `Math.max(0.5, …)` (24295–24297),
**das Produkt hat keinen Boden**, und darin steht unter anderem `Math.pow(0.97, f.spaeher||0)`
(Z. 24289), ebenfalls ohne Untergrenze. Ein vierter Faktor auf einem bodenlosen Stapel ist eine
Multiplikation ins Unbekannte. Der Boden gehört in **denselben Rückgabewert**
(`return Math.max(sec * 0.25, sec * mult);`), damit jede der über dreißig Aufrufstellen ihn erbt
statt einer Klammer an einer davon.

**Kartenebene.** 🛰-Abzeichen in `karteSystemBadges` (Sektoransicht + aggregiert auf der
Übersicht). Emoji, kein `ti-*` — das Subset hat 69 Glyphen, `check-icons.js` schlüge sonst an.

**Autorität.** Keine, und das ist **bewiesen statt behauptet**: `sendPlayerAttackMission`
(Z. 32017) und `sendSpyMission` (Z. 31896) rufen `missionDurationFor` **ohne** `targetSystem` —
ein Zielsystem-Faktor erreicht PvP per Konstruktion nicht, er ist dort 1. Damit fällt die Bake auf
dieselbe Seite der Grenze wie die vier Sektor-Kanäle (Kommentar Z. 13709–13712). Kein Backend,
kein Schalter.

**Anzeigestellen, die mitwandern.** `MISSION_LINIEN` **und** `missionMapZiel` (eigener Zweig — das
Ziel ist ein System, kein Planet); **beide** Missionstyp-Listen (~21855 und ~59543) plus je ein
Zweig in Missionskarte und Flottenleiste, sonst steht die Mission als **„Erkundungsziel"** da;
`karteAuffangSignatur` (54489); beide Reset-Bewahrlisten (die Bake kostet Protomaterie);
`performSectorSearch`; `HELP_SECTIONS` — der Abschnitt, der die Flugzeit-Faktoren aufzählt, muss
den vierten nennen. Alle Flugzeit-Vorschauen erben den Rabatt automatisch, weil sie durch
`missionDurationFor` gehen; vor dem Commit trotzdem nach Stellen greppen, die eine Flugzeit **ohne**
diese Funktion bilden.

---

### V4 — Die Passage: das Wurmloch bekommt zum ersten Mal eine Wirkung

**Was der Spieler tut.** Solange ein Wurmloch offen steht, fliegt er zu seinen beiden Mündungen
deutlich schneller — und er kann durch das gezeichnete Portal auf die andere Seite springen.

**Wie es rechnet.** `wurmlochFlugMult(targetSystem)` als weiterer Faktor in `missionDurationFor`,
dieselbe Wache wie die Nachbarn: **−25 %** zu beiden Endpunkten, solange
`galaxyCache.activeWormhole.expiresAt` in der Zukunft liegt, sonst 1,0. Zum Einordnen:
`allianceBaseFlightMult` gibt −10 %, `sektorFlugMult` höchstens −12 %.

**Der Befund ist die reinste Ortsbindung nur dem Namen nach.** Nachgezählt: `activeWormhole` hat
im Frontend fünf Fundstellen — Vorgabewert (16051), Kartenabzeichen (55022–55024), Meta-Zeile der
Detailtafel (56132), Portal-Symbol (56423–56424) — **alle Anzeige**. Es verkürzt keine Flugzeit,
öffnet keine Route, erlaubt keine Mission. Das ist dieselbe Familie wie das `st.proto`-Feld der
Festungen (Backend-Arbeitsregel 59): eine Ankündigung ohne Mechanik.

**Kartenebene.** Alle drei. Das 🌀 sitzt bereits an beiden Endpunkten und wird auf der Übersicht
aggregiert. Das Portal (Z. 56423–56433) hat gemessen **kein** `data`-Attribut und keinen Handler,
obwohl der Zielsystemname eine Zeile weiter bereitsteht und `switchToSystem` (Z. 55931) existiert
— es bekommt `data-map-wurmloch` und einen Verdrahtungsblock nach dem Muster der neun vorhandenen
(56693–56758, alle mit `galaxyMapDidDrag`-Prüfung) und meldet sich bei `platzierteMarker`
(Z. 56236) an.

**Autorität.** Der Server entscheidet **wann** und **wohin** — das ist ein Zustand der gemeinsamen
Galaxie. Der Client rechnet nur seine eigene Missionsdauer daraus. Kein Endpunkt, keine Tabelle,
keine Parität. Backend nur für zwei **Textzeilen**: `server.js:5497` und `:5447` setzen die **rohe
System-ID** ein, der Spieler liest also wörtlich „Kepler-System ↔ sysn_lunyra". Reiner Text ohne
Zahl, also in beliebiger Reihenfolge auslieferbar.

**Anzeigestellen, die mitwandern.** 🌀-Tooltip (55022) und Meta-Zeile der Detailtafel (56132) —
zwei Stellen derselben Größe, beide müssen die Wirkung nennen. **Ausdrücklich ohne laufende
Restzeit:** der Kommentar bei der Peilung (55050–55052) hält fest, dass eine sekundengenaue
Restzeit im Titel den Neuaufbau der ganzen Karte erzwingt — also auf volle Stunden gerundet.
Dazu `karteAuffangSignatur` (enthält gemessen keinen `galaxyCache`-Ereignisanteil; solange es Deko
war, war das egal) und `HELP_SECTIONS`.

**Hängt an V3:** ein weiterer Faktor gehört nicht auf ein Produkt ohne Boden.

---

### V5 — Sektorlage: der Schwarmdruck macht eine Region gefährlich

**Was der Spieler tut.** Er sieht auf der Übersicht, dass eine Region unter Druck steht, und
entscheidet: aufräumen oder ausweichen. Die Zahl bewegt sich alle 15 Minuten von selbst — das ist
die einzige Mechanik im Feld, in der die Karte **lebt**, ohne dass der Spieler etwas tut.

**Wie es rechnet.** Backend, in `galaxyTick` nach `nestTick(g)` (server.js:5369) und **vor** der
`npcEmpireStrength`-Zeile (5372) — die Reihenfolge ist dort schon aus diesem Grund kommentiert:

```
druck[sek]  = Σ NEST_STUFEN[n.stufe].punkte über die Nester im Sektor  +  2 je Festung
g.sektorLage[sek] = { druck, nester, festungen, npcMult: min(1.45, 1 + 0.03·druck), stand }
```

`NEST_STUFEN[*].punkte` (1–5, server.js:8970–8975) existiert bereits **ausschließlich** dafür.
Größenordnung: `NEST_MAX` 12 galaxieweit, `FESTUNG_MAX_AKTIV` 6 — typischer Sektordruck 0–6, der
Deckel greift nur im Extremfall. Drei Stufen: ruhig (0), unruhig (1–5), belagert (ab 6).

**Der Boden liegt exakt auf 1,00** — ein ruhiger Sektor ist so schwer wie heute, ein geräumter
kehrt dorthin zurück. Die Änderung kann kein Bestandskonto verschlechtern; damit ist die
Rückwirkungs-Bedingung des Sektor-Kommentars (13703–13707) strukturell erfüllt.

Dazu braucht es das Backend-Gegenstück von `sektorVon`: acht Zeilen `{key, cx, cy}`, **ohne**
`mod`, `desc`, Farbe. `sektorVon` (Z. 13764) ist eine reine Funktion aus gx/gy, und
`SYSTEM_COORD_BY_ID` (server.js:1621) existiert schon. Mit Paritätsprüfung — dieselbe
Kopie-Familie wie `FESTUNG_STUFEN`/`AST_SORTEN`.

**Das Frontend rechnet nichts nach.** `npcEffectiveDefense` (Z. 20279) multipliziert mit dem Wert
aus `galaxyCache.sektorLage`. Die Frontend-Kopie `NEST_STUFEN` (Z. 13484–13491) trägt gemessen
**kein** `punkte`-Feld, und das soll so bleiben. Der Faktor wird beim Missionsstart in die Mission
**eingefroren**, wie `protoBlockade` beim Abbau — sonst zeigt die Vorschau eine Verteidigung, die
der Kampf sechs Minuten später nicht mehr benutzt.

**Diese Etappe löst nebenbei die einzige völlig ungezeigte Größe des Spiels ein:**
`npcEmpireStrength` hat gemessen genau zwei Fundstellen — den Vorgabewert (Z. 16051) und die
Rechenstelle (Z. 20279). Er wächst serverseitig bis 2,5 und **niemand sagt es dem Spieler**.

**Kartenebene.** Vierte Textzeile am Regionsknoten („Belagert · Druck 9 · NPCs +27 %", grün/amber/
rot) — die Icon-Zeile bei `schwerY+44` (Z. 54948) rutscht mit; fünfte Kopfzeile in der
Sektoransicht (bei 55198).

**Autorität.** Vollständig Server. `g.sektorLage` liegt in `db.galaxy` — über
`PUT /api/storage/:key` für keinen Client erreichbar — und reist über `galaxyFuerClient`
(`Object.assign`) ohne eine Zeile Verdrahtung mit. **Backend: ja. Schalter: ja**
(`SEKTOR_LAGE_AKTIV = false`), denn allein ausgeliefert wären NPCs bis 45 % zäher, ohne dass eine
Anzeige den Grund kennt — Regel 60 in Reinform.

**Anzeigestellen, die mitwandern.** NPC-Angriffsvorschau, Kampfbericht, `npcMapMenu`-Info-Block,
`HELP_SECTIONS` „Sektoren haben Eigenschaften" (der Text beschreibt die Region heute als etwas
Festes — „Sie wirkt rückwirkend"; die Lage ist beweglich), und die Galaxie-Nachrichten in
`nestTick` (server.js:9065/9082/9114), die heute nur die Systemkennung nennen.

**V5 setzt V2 voraus.** Gemessen haben obsidian, meridian und ilyra **null** NPCs — dort könnte
der Schwarmdruck gar nicht wirken. Die Statthalter sind die Vorbedingung dafür, dass die Mechanik
mehr als die halbe Karte erreicht.

---

## 3. Was ausdrücklich NICHT gebaut werden sollte

**Kein Vorhang vor Festungs- und Nestdaten.** Der Client hat sie vollständig (Z. 13939,
`galaxyCache`). Eine Sperre wäre eine, die die Entwicklerkonsole aufzieht — und eine Prüffrage,
die aus dem falschen Grund grün ist. Echtes Nichtwissen gibt es nur bei Größen, die der **Spieler
selbst** verschiebt (`npcScalingCount`) oder die es heute gar nicht gibt (Aggregate).

**Kein fünfter Ebenen-Knopf.** Bereits begründet verworfen
(`docs/aliens-asteroidenfestungen-konzept.md:797-804`): die Leiste hat vier Knöpfe (Z. 3433–3438),
und die Karte hat zwischen KB-10 und KB-13 drei Etappen um den Platz am Hochformat gerungen.
Festung und Nest gehören in `ereignisse`, dessen Knopf schon mit „Aliens" wirbt.

**Kein Sektor-Kanal auf Angriff, Verteidigung oder Spionage.** Sie entscheiden PvP, der Server
rechnet sie nach, eine Sektor-Tabelle im Backend wäre eine zweite Kopie — und der Backend-Deploy
ist nachweislich **sechsmal** vom Frontend abgewichen. Gemessen: `grep -i sektor server.js` liefert
7 Treffer, **alle in Kommentaren**.

**Keine Sonnentyp-Produktion in der vorliegenden Form.** Die Idee ist gut (`SUN_TYPES` Z. 54559
verteilt sechs Typen über 67 Systeme, alle Fundstellen sind Zeichnung), aber der Faktor wäre der
**siebte in der multiplikativen `mineMult`-Kette** (Z. 23605–23616) und läuft damit gegen die
Hausregel „additive, gedeckelte Gruppen statt reiner Multiplikation"; eine ressourcen*spezifische*
additive Klammer gibt es im Spiel nicht. Dazu: Die Entscheidung fällt genau einmal beim
Kolonisieren, ist unumkehrbar, und für jedes Bestandskonto ist sie längst gefallen. Wieder
vorschlagen erst, wenn die additive Klammer ressourcenfähig gebaut ist — das ist eine eigene
Etappe.

**Keine ortsabhängige Sortenverteilung der Asteroiden ohne Anzeigestelle.** Der Entwurf ist
strukturell der eleganteste des Feldes (mittelwerterhaltend, Streuung × 3,23), aber die einzige
für den Spieler **wahrnehmbare** Wirkung ist ein Verlust: wer nahe am Kern schürft, verliert
gemessen 28–31 % seiner Protomaterie — bei der knappsten Ressource des Spiels, und rückwirkend für
ortsgebundene, schwache Konten. Der Gewinn ist eine Wahrscheinlichkeit, die nirgends angezeigt
wird und über Tage einsickert. Zurückgestellt, **nicht verworfen**: Zuerst müsste die Karte den
Sortenschwerpunkt einer Region **nennen** — dann ist die Anzeige der eigentliche Inhalt und die
Verteilung nur ihre Begründung.

**Keine Kriegs- oder Kampfpunkte für eine clientgemeldete Zahl ohne Aufwand.** Der Entwurf
„geteiltes Lagebild" wollte 20 KP je geteiltem Lagebild, gedeckelt bei 100/Tag — gegen
`RK_TAGESSTUFEN` mit 210 wirksamen Punkten (server.js:4645) und gegen vier bestehende Handlungen,
die 25–45 Punkte für **echte Spielzeit** zahlen (Z. 19564–19577). Die Prüffrage „kann der Server
die Bedingung selbst beobachten?" lautet hier Nein. **Die erste Hälfte dieses Entwurfs ist
dagegen billig und gut** und gehört in V1 mit aufgenommen: `shareIntelWithAlliance` (Z. 39859)
schickt `targetId, name, defensePower, deep, score` — aber **kein `system`**, obwohl
`state.spyIntel[id].system` vorliegt und `karteSystemBadges` es bei Z. 55031 liest. Ein fehlendes
Feld ist der Grund, warum geteiltes Wissen auf der Karte unsichtbar ist; der Präfix `sharedintel:`
ist bereits rechtegeprüft, kostet also serverseitig nichts.

**Keine Garnisonsmechanik mit gesenkter Grundverteidigung.** Die Idee ist die beste echte
Entscheidung des Feldes (Schiffe zu Hause oder draußen), aber die vorgeschlagene Umsetzung ersetzt
`Math.max(200, computeDefensePower(save))` in der Rückeroberung (server.js:5559–5583) durch
`200 + Garnison + 0,25·computeDefensePower` — ein **rückwirkender Verlust an bestehendem Besitz**,
und ohne Frontend gäbe es die Garnisonsmission gar nicht. Wenn überhaupt, dann in der additiven
Fassung (Garnison **addieren**, `computeDefensePower` unangetastet) — dann ist es ein reiner
Bonus und braucht keinen Schalter.

**Keine dritte Sammelleiste** (Kartierungsgrad, Sektor-Chroniken). Beide belohnen Handlungen, die
der Spieler ohnehin ausführt, geben keinen Grund die Karte öfter zu öffnen, und ein Bestandskonto
springt sofort auf die höchste Stufe. Der eine wertvolle Teil daran — die acht ungenutzten
`desc`-Texte endlich zu zeigen — ist in V1 mit drin und kostet dort nichts.

**Keine „N Minuten Produktion" und keine Rohstoffberge als Kartenbelohnung.** Sechs Belohnungen
hängen bereits an dieser Formel (CLAUDE.md:1224), und der dokumentierte Endausbau-Lagerdeckel
(803.800) entspricht rund 5,5 Minuten Endspiel-Erzproduktion. Die Währung neuer Karteninhalte ist
**Zeit, Position, Sternenessenz** — nicht Material.

---

## 4. Reihenfolge

| # | Etappe | Aufwand | Backend | Schalter |
|---|---|---|---|---|
| **E1** | **Landmarken** (V1): drei Abzeichen, antippbare Abzeichenzeile, `npcMapMenu`-Info-Block mit gemessener Stärke, Übersichts-Kopf/Fuß/Legende, `sk.desc` im Regionsmenü, Kartensuche um Festungen/Nester/NPCs erweitert, `system`-Feld in `shareIntelWithAlliance`, **`festung-angriff` in `MISSION_LINIEN` + `missionMapZiel`** | mittel | nein | nein |
| **E2** | **Statthalter** (V2): acht `NPCS`-Einträge, Chronik-Text, neue Kompendium-Kategorie, `statthalterKills` in beide Bewahrlisten | mittel | nein | nein |
| **E3** | **Sprungnetz** (V3), **mit dem Boden in `missionDurationFor` als erstem Schritt** — der Boden ist für sich schon eine Reparatur und könnte auch allein gehen | mittel | nein | nein |
| **E4** | **Passage** (V4): Flugzeit-Faktor, klickbares Portal, zwei Backend-Textzeilen | klein | ja (nur Text) | nein |
| **E5** | **Sektorlage** (V5): Backend-Druckwert, Sektorzentren-Kopie mit Paritätstest, Anzeige auf beiden oberen Ebenen | mittel–groß | **ja** | **ja** (`SEKTOR_LAGE_AKTIV`) |

**Warum diese Reihenfolge.** E1 ist Pflicht und Voraussetzung: Solange man von oben nicht sieht,
was in einer Region steht, hat kein weiterer Inhalt eine Chance, gefunden zu werden. E2 füllt die
leere Hälfte der Karte und ist die Vorbedingung dafür, dass E5 in drei heute NPC-freien Regionen
überhaupt wirken kann. E3 bringt die Bestandsreparatur mit, auf die E4 aufsetzt. E5 ist die
einzige Etappe mit Backend-Autorität und steht deshalb am Ende — und hinter einem Schalter.

Jede Etappe ist für sich auslieferbar und lässt das Spiel in einem sinnvollen Zustand zurück; für
E4 und E5 ist das je oben ausdrücklich geprüft, nicht angenommen.

---

## 5. Was noch nicht belegt ist

**Muss vor dem Bau gemessen werden:**

1. **Die dritte Multiplikation auf `npcEffectiveDefense`** (E5, blockierend). Gelesen ist die
   Formel (Z. 20279): `defense × (1 + npcScalingCount·0,18) × npcEmpireStrength × prestigeChallengeMult()`.
   Nicht gemessen ist, wo `npcScalingCount` bei einem aktiven Konto realistisch steht. Rechnerisch
   ergäben 10 Siege × Empire 2,5 × Sektorfaktor 1,45 bereits **das 10,2-fache** des Grundwerts.
   Kommt dabei eine Zahl heraus, die Einsteiger aussperrt, muss der Sektorfaktor unter 1,45 oder
   aus der Multiplikation heraus.

2. **Die gesamte Flugzeitkette an einem ausgebauten Konto** (E3/E4, blockierend). Das Produkt hat
   gemessen keinen Boden und enthält `0,97^spaeher` ohne Untergrenze — bei 100 Spähern allein
   Faktor 0,047. Der vorgeschlagene Boden von 0,25 ist gesetzt, nicht kalibriert.

3. **Die Bakenkosten gegen den Deckel eines MITTLEREN Kontos** (E3). Die vorgeschlagenen 180.000
   Erz sind nur gegen den Endausbau geprüft. Regel 57 verlangt beide Deckel (`storageCap`
   Z. 23803, `tier2StorageCap` Z. 23966, `protomaterieCap` Z. 23980) — und ein Konto mit drei
   Kolonien liegt bei rund 33.000. Das ist exakt der Bastionsmarken-Fehlermodus.

4. **Alles am gerenderten Bild** (E1, E5). Die Abzeichenzeile trägt heute bis zu sieben Arten bei
   14 px Schrittweite (Z. 54948 / 55141), künftig zehn — ohne Umbruch läuft sie aus dem Kasten.
   `kbLabelsEntflechten` läuft gemessen **nur** in `buildMap` (Aufruf Z. 56692), nicht in
   `sektorUebersichtBauen`; die Region kepler hat 15 Mitgliedssysteme und damit die höchste
   Dichte. Und die Übersicht hat heute **keine** `galaxyMapDidDrag`-Prüfung — ein Wischen könnte
   als Tipp durchgehen. Das beantwortet nur ein Playwright-Screenshot (Regel 42/49).

5. **Die ungedeckelten Bonusgruppen** (blockiert nichts hier, ist aber ein Bestandsbefund und
   gehört benannt): `expeditionRewardMult` (Z. 22377) deckelt gemessen **nur**
   `moduleBonusTotal('expedition')` — die übrigen sieben Summanden inklusive `sektorBonus` laufen
   ungebremst, obwohl der Kommentar Z. 22371–22373 das Gegenteil behauptet.
   `abgrundSplitterFaktor` (Z. 47767–47772) hat **gar kein** `deckelWeich` und keinen Eintrag in
   `BONUS_GROUPS`. Und `sektorBonus(planet,'prod')` liegt in einer Klammer ohne Deckel (Z. 23613)
   — `PROD_BONUS_CAP` deckelt eine **andere** Gruppe (`productionBonusRaw`, Z. 23735). Wer je
   einen dieser Kanäle vergrößert, sollte das vorher wissen.

6. **Wurmloch-Häufigkeit** (E4). Aus 6 % je 15-Minuten-Takt und 12 Stunden Dauer ergäbe sich
   rechnerisch eine Präsenz von rund 74 % — dann ist die Passage kein besonderer Moment, sondern
   der Normalzustand an wechselndem Ort. Nicht am laufenden Spiel verifiziert, und die Rechnung
   hängt daran, ob nur bei fehlendem Wurmloch gewürfelt wird.

**Fremdmessungen, die ich nicht reproduziert habe** und die in mehreren Kalibrierungen tragen: der
Endausbau-Lagerdeckel **803.800** (CLAUDE.md:778 — eine eigene Teilrechnung aus den dort genannten
Bestandteilen ergibt 653.800, die Differenz von 150.000 ist offen) und **8,81 Mio Erz/Std**
Endspielproduktion (Backend-CLAUDE.md:342). Die Größenordnung trägt, die exakten Zahlen sind nicht
gemessen.

**Selbst nachgemessen in dieser Sitzung** (Quelltext-Lesung bzw. Nachrechnung der deterministischen
Tabellen in node): 67 sichtbare Systeme und ihre Sektorverteilung; 18 NPC-Einträge in 15 Systemen
mit 4 Bossen und der Sektorverteilung 12/3/1/1/1/0/0/0; die Verteidigungsreihe 30…20.000;
`karteSystemBadges` ohne Festung/Nest; `MISSION_LINIEN` ohne `festung-angriff`; `missionDurationFor`
ohne Produkt-Boden; `npcMapMenu` mit einem Eintrag; `npcEmpireStrength` mit zwei Fundstellen;
`activeWormhole` ausschließlich in Anzeigepfaden; `SEKTOR_DEFS[].desc` ohne Leser;
`performSectorSearch` ohne Festungen/Nester/NPCs.

## 6. Gebaut: Wem gehört ein System? Der Ring sagt es (01.09.2026)

Auftrag Sascha: „anzeige welche macht ein system dominiert". Gewählt: **eine Rangfolge, eine
Farbe** — der Knoten trägt das Zeichen genau der stärksten anwesenden Macht.

**Der Befund war größer als „es fehlt eine Anzeige".** Beide Kartenstellen prüften die Eroberung
nur gegen die EIGENE Spieler-ID. `galaxyCache.controlledSystems` ist aber die globale Karte
`systemId -> userId` aller Spieler: Ein von einem **fremden** Spieler erobertes System sah aus wie
ein unbeanspruchtes. Ebenso unsichtbar war die Kolonie-Herrschaft, obwohl
`computeSystemControllers` sie vollständig führt. Alle vier Machtquellen waren vorhanden; die
Etappe ist eine Verdrahtung plus Rangfolge — und beseitigt die Doppelung, dass die
Ring-plus-Wappen-Regel zweimal stand (Nachbarpunkte der Systemebene und Sektoransicht).

### Die Rangfolge (`systemDominanz`, die eine Quelle für alle Kartenebenen)

| Rang | Art | warum dort |
|---|---|---|
| 1 | kollabiert | Zustand, kein Machtträger; in einem zerstörten System ist die Besitzfrage gegenstandslos. |
| 2 | erobert | Die einzige Macht, die der Server exklusiv führt und die militärisch genommen wird. Schlägt das Territorium, weil man genau Fraktionssysteme erobert. |
| 3 | Kolonie-Herrschaft | Alleinherrschaft über die besiedelten Planeten (nur bei EINER Identität, +5 % Produktion). |
| 4 | Fraktions-Territorium | Politische Zuordnung ohne Präsenz — die weichste Aussage. Hängt wie bisher an der Ebene „fraktionen". |
| 5 | Alien-Nest | Beansprucht nichts. Steht nur, wenn sonst niemand herrscht; sitzt ein Spieler drauf, bleibt das Nest Abzeichen (dieselbe Entdopplung wie 👽/👾). |

Farben abgelesen, nicht erfunden: grün/rot aus der Chip-Zeile des offenen Systems, das Rosa
fremder Kolonie-Herrschaft aus `renderTerritoryBox`, Fraktions- und Volksfarben aus ihren
Tabellen. **Eigener Besitz ist gefüllt, Fremdes nur umrandet.** Die Betonung folgt der Rangstufe
(`DOMINANZ_BETONUNG`) — am gerenderten Bild gemessen ging „von einem fremden Spieler erobert" mit
den Bestandswerten des Fraktionsrings (Breite 1,2 / Deckkraft 0,55) unter; der Fraktionswert
bleibt unverändert, alles darüber wird lauter.

### Vier Anzeigestellen

Sektoransicht (Ring, Statuszeile), Nachbarpunkte der offenen Systemebene (Ring, `meta`),
Chip-Zeile im offenen System (Kolonie-Herrschaft dort neu — sonst widerspräche sie der Karte), und
die **Systempunkte der Regionsübersicht**. Dort bewusst keine fünfte Textzeile und keine
Regions-Aggregation: KB-21 hat gemessen, dass am Handy alle Beschriftungen bei 6–9 px liegen. Die
Punkte kosten keinen Platz und sagen mehr als eine Summe — man sieht, WELCHE Systeme wem gehören.
Auf Regionsebene ist das eine Zugabe, keine Karte.

### Der Riegel gegen die quadratische Form

`computeSystemControllers()` macht je besessenem Planeten ein lineares `PLANETS.find`.
Ausgeführt gemessen (30 Spieler à 18 Planeten): 540 `find`-Aufrufe, 269.460 Vergleiche,
**3,9 ms je Aufruf** — je Systemknoten gerufen wären das bei 81 Systemen **317 ms je
Kartenaufbau**. `systemHerrscherCached()` (900 ms, Muster `storageCapCached`) verhindert das; die
Bestandsaufrufer profitieren mit. Wer eine neue Machtquelle ergänzt, misst zuerst ihre Kosten je
Knoten.

Die Ringnamen `kontrolle` und `fraktion` sind Bestands-Anker (vier Tests greifen darauf) und
bleiben; alles Neue trägt `data-ring="dominanz"` plus `data-dominanz="<art>"`.

Wächter: `tests/test_systemdominanz.js` (28 Prüfungen, jede Kernmessung als PAAR; Gegenprobe
gegen den Stand davor: 21 rot bei identischer Prüfliste). `test_fraktionsgebiet` prüft die
Ring-Regel seither als Eigenschaft statt als Literal und verlangt zusätzlich, dass es sie nur
EINMAL gibt.

## 7. Gebaut: Die Systemansicht bekommt Licht und Schatten (01.09.2026)

Auftrag Sascha: „generell die systemansicht ausbauen das es optisch ein meisterwerk werden könnte".
Vorgelegt wurden drei gerenderte Varianten auf denselben Daten (Sonne, Bahnen, echte
Planetentexturen aus dem Markup des Heimatsystems): A „Licht und Schatten", B „Sternkarte",
C „Nebelwelt". Gewählt: **A als Basis, plus Gasriesen-Ringe und sichtbare Mondbahnen aus C.** Die
Mockups samt Generator liegen nicht im Repo (Sitzungs-Scratchpad); die Entscheidung steht hier.

### Was die offene Systemansicht jetzt zeichnet

| Element | Regel |
|---|---|
| Nebelschleier | drei weiche Flächen hinter allem, eine davon in der Farbe der Sonne dieses Systems |
| Sterne | 48 statt 30, über das ganze sichtbare Feld; die hellsten mit Glanzkreuz |
| Bahnen | durchgezogen (0,6 breit, 10 % Deckkraft) statt gepunktet |
| Bahnspur | kurzer Bogen in der Typfarbe **hinter** jedem Planeten, endet exakt an der Scheibe; unerforscht blasser |
| Sonne | Korona (radialer Verlauf, Radius 95·Sonnentyp) und zehn Strahlen, die in 150 s einmal wandern; Randlicht am Kern |
| Tag-/Nachtseite | je Scheibe ein Verlauf mit Mittelpunkt auf der **Sonnenseite** (halber Radius Richtung Sonne), dunkel zum abgewandten Rand |
| Atmosphären-Halo | zwei Ringe in der Typfarbe, **nur erforschte** Welten |
| Unerforscht | Scheibe 0,7 plus dunkle Deckung 0,32, gestrichelter Rand bleibt |
| Gasriesen-Ring | hintere Hälfte vor, vordere Hälfte nach der Scheibe (clipPath im gekippten Raum) |
| Mondbahn | feiner Kreis mit Radius Versatz·√2 – der bestehende Mond-Marker liegt darauf, er wurde nicht bewegt |
| Beschriftung | dunkler Saum (`paint-order: stroke`, 2,4 px) für alle `.planet-label` |

### Drei Entscheidungen

1. **Kein SVG-Filter.** Die Mockups A und C nutzten `feGaussianBlur`. Im Spiel wird jeder Filter bei
   jeder Neuzeichnung gerastert, und die Ebene trägt Dauer-Animationen (Pulse, Strahlen). Jeder
   Verlauf ist deshalb ein `radialGradient`; die Halos sind zwei Ringe statt eines Weichzeichners.
   `test_systemansicht_optik` 0b hält das fest.
2. **Die Sterne kommen aus einem Generator, nicht aus `hashStringToFloat` je Stern.** Gemessen: Der
   Hash rechnet `h*31+Zeichen mod 10000`; zwei Schlüssel, die sich nur in der Sternnummer
   unterscheiden, liegen 31/10000 auseinander, also 1,4 Karteneinheiten. 48 Sterne ergaben zwei
   „Perlenschnüre" aus je acht bis zehn Sternen, die im Bild wie gestrichelte Striche aussahen.
   `sysZufall` (mulberry32) nimmt den Hash nur als Startwert.
3. **Der Mond-Marker bleibt, wo er ist.** An ihm hängen Klick-Handler und `test_kartenmenue`. Die
   Bahn übernimmt seinen Abstand: Planeten `r+2`, Heimat 13. Der erste Entwurf riet den Versatz aus
   dem Radius und legte die Heimatbahn 1,4 Einheiten neben ihren Mond (1f2 hat es gemeldet).

### Kosten, gemessen (Heimatsystem, 1280×900, alt gegen neu)

| | alt | neu |
|---|---|---|
| Markup der Ebene | 56.158 Zeichen | 69.475 Zeichen |
| Elemente | 106 | 244 |
| Verläufe / Filter | 1 / 0 | 15 / 0 |
| Dauer-Animationen | 1 | 2 |
| Neuaufbau bis zum nächsten Frame (5 Messungen) | 30–42 ms | 32–56 ms |
| Frames je Sekunde bei ruhender Karte | 59,5 | 59,5 |

### Wächter

`tests/test_systemansicht_optik.js` – 28 Prüfungen. Die Kernmessungen sind Regeln, keine
Momentaufnahmen: Spur endet an der Bildmitte, Schatten-Verlauf liegt näher an der Sonne als die
Scheibe, Mondbahn-Radius gleich Markerabstand; Halo und Abdunklung als Paar erforscht/unerforscht;
Determinismus über einen echten Systemwechsel (Vega und zurück, zeichengleiches Markup). Gegenprobe
gegen `origin/main`: 18 rot, 10 grün, identische Prüflisten. Drei Werkzeugfehler beim Bau: Der
Anker „`let inner = \`<defs>`" traf zuerst die Galaxie-Ebene (zwei Vorkommen); ein Schnitt „von den
Sternen bis zur Sonne" umfasste 36 kB samt Wurmloch-Filter und ließ 0b aus dem falschen Grund
fallen; und weder Warten noch Fenstergröße noch Tab-Wechsel lösen einen Neuaufbau aus
(`__karteAufbauten` blieb dreimal bei 6) – erst der Systemwechsel tut es.

## 8. Gebaut: Drei Reparaturen in jede Richtung (03.09.2026)

Auftrag Sascha: „prüfe, was wir noch betreffend Sektorkarte machen können. prüfen jede Richtung."
Zuerst eine **Bestandsaufnahme gegen dieses Konzept** (gemessen am Stand v8.646.0), dann die drei
Befunde, die sich daraus als Bestandsreparatur ergaben.

### Was von §2/§4 inzwischen steht

| Etappe | Stand (03.09.2026) |
|---|---|
| **E1 Landmarken** | **geliefert** — #456 (drei Ebenen), #487 (Gegnerstärke im `npcMapMenu`), #494 (antippbare Abzeichenzeile) |
| **E2 Statthalter** | **offen** — null Fundstellen. 52 der 67 Systeme tragen weiterhin keinen NPC, drei Regionen gar keinen |
| **E3 Sprungnetz** | **faktisch ersetzt** durch B2 Vorposten (#531): Der Vorposten *ist* der Sprungknoten, mit Flugzeit-Nutzen im Umkreis. Der Backend-Kommentar führt ihn ausdrücklich als „E3-Rahmen (SPRUNGBAKEN_MAX = 3)" |
| **E4 Passage** | **offen** — und der stärkste noch offene Befund: `activeWormhole` hat **acht** Fundstellen, **alle** im Anzeigepfad (Knoten zeichnen, eine Zeile im Systemkopf). Der Server würfelt das Wurmloch aus, die Karte malt einen Wirbel, und es tut nichts |
| **E5 Sektorlage** | **offen** — null Fundstellen; einzige Etappe mit Backend-Autorität und Schalter |

Dazu ungeplant geliefert: Dominanz-Ring (§6), Licht und Schatten (§7), Wrackkonvois (#516),
Vorposten (#531).

### Zwei Messfragen aus §5 sind beantwortet

**§5-2 (Flugzeitkette, „blockierend"): gemessen.** Die Papierrechnung aus den Werten von
`missionDurationFor` selbst — die zehn gedeckelten Faktoren ergeben im Vollausbau **0,0147**, aus
60 Minuten werden 53 Sekunden; `0,97^spaeher` zog das ohne Untergrenze weiter, bei 100 Spähern auf
**0,0007** (2,5 Sekunden). Der im Konzept vorgeschlagene Boden von 0,25 wäre damit **keine
Reparatur, sondern eine 17-fache Verlangsamung** jedes ausgebauten Kontos gewesen.

Entscheidung Sascha aus drei vorgelegten Varianten: **nur der Späher-Faktor bekommt einen Deckel,
kein Produkt-Boden.** `Math.max(0.5, Math.pow(0.97, …))` ist dieselbe Form und derselbe Wert wie
bei seinen fünf Nachbarn (Prestige, Aufstieg, Fähigkeit, Navigator, Fusionsantrieb) und greift ab
**23** Spähern — 0,97²² = 0,512, 0,97²³ = 0,496. Darunter ändert sich nichts.

**§5-4 (Wisch-Schutz auf den oberen Ebenen): gemessen und behoben.** `galaxyMapDidDrag` schützte
13 Klickstellen, **alle** im aufgeklappten System; Regionsübersicht und Sektoransicht gingen leer
aus, obwohl Schwenken und Zoomen dort genauso aktiv sind — der Handler hängt am `svg`, nicht an
einer Ebene. Am alten Stand am gerenderten Spiel belegt: Ein Wischen öffnet die Region bzw. das
System. Nur der **Zeiger** bekommt den Schutz; die Tastatur zieht nicht.

### Die dritte Richtung: die Tastatur kannte nur eine Ebene

← / → wirkten nur bei offenem System. Die Begründung im Code lautete „in den Sektor-Ansichten gibt
es kein nächstes System" — das stimmte, als sie geschrieben wurde, und war seit KB-4 überholt: Die
Sektoransicht **hat** einen Nachbarsektor, erreichbar über die ‹ ›-Knöpfe **und** eine Wischgeste,
nur nicht über die Tastatur. Am PC war sie damit die einzige der drei Ebenen ohne Tastenweg.

Der **Zoom** bleibt bewusst dem offenen System vorbehalten (auf den oberen Ebenen hat er keinen
Bezugspunkt), **↑/↓ bleiben frei** fürs Seiten-Scrollen — dieselbe Abwägung wie seit KB-14, jetzt
zusätzlich auf der Sektorebene mitgeprüft.

### Wächter

`tests/test_flugzeit_deckel.js` prüft die **Regel** statt der einen Zeile: jede `mult *=`-Zeile der
Kette gegen eine namentliche Liste nachweislich begrenzter Formen. Ein siebzehnter Faktor derselben
Bauart fällt damit auf, ohne dass jemand an ihn gedacht haben muss.
`tests/test_kartenrichtungen.js` misst am gerenderten Spiel, **jede Sperre mit ihrer
Gegenrichtung** — derselbe Knoten öffnet beim Tipp und öffnet beim Wischen nicht.

### Drei Befunde aus dem Bau der Messvorrichtung

Sie stehen als Kommentar in den Tests, weil jeder beim nächsten Kartentest wieder zuschlägt:

1. Der Deckel greift ab **23** Spähern, nicht ab 24. Der erste Entwurf behauptete 24 und fiel an
   der eigenen Prüfung durch — die Zahl kam aus dem Kopf, nicht aus der Rechnung.
2. Die **Bounding-Box-Mitte einer Region liegt außerhalb ihres Polygons** (Regionen sind
   unregelmäßige Flächen). Der erste Testentwurf zielte daneben, und „nichts ging auf" sah aus wie
   ein bestandener Wisch-Schutz — eine Prüfung, die aus dem falschen Grund grün ist.
3. Im ausgeloggten Zustand liegt die **Login-Karte über dem Kartenkasten** (`elementFromPoint`
   liefert `INPUT#loginPassword`) und hält den **Tastaturfokus**. Ohne `blur()` kommt kein
   Tastendruck an, und beide Tastenprüfungen melden „wirkt nicht", obwohl der Code stimmt. Deshalb
   arbeitet der Test mit synthetischen Ereignissen — derselbe Weg wie `tests/lib/karte.js`.

### Was als Nächstes ansteht

**E4 Passage** hat das beste Verhältnis von Aufwand zu Wirkung: Das Objekt steht schon auf der
Karte und ist antippbar, ihm fehlt nur eine Wirkung. E2 und E5 bleiben eigene Etappen, E5
zusätzlich mit Backend und Schalter.

