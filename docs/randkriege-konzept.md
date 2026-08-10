# Die Randkriege

Entwurf für einen tiefen, in allen Bereichen ausgearbeiteten Inhalt. Stand 09.08.2026, Spielversion
v8.468.0. Zeilennummern beziehen sich auf `weltraum_kolonie.html` bzw. `kolonie-kepler7-backend/server.js`.

Die vier NPC-Fraktionen führen einen langsamen, für alle Spieler gemeinsamen Krieg um die
Randsektoren. Systeme wechseln über Tage den Besitzer. Spieler wählen keine feste Seite, sondern
wirken durch ihr Handeln – und ernten Vorteile oder Strafexpeditionen, je nachdem, wem der Sektor
gehört, in dem sie leben.

> **Nachgeprüft am Code, 10.08.2026.** 78 Behauptungen dieses Entwurfs wurden gegen
> `weltraum_kolonie.html` und `server.js` gehalten; 44 gingen glatt durch, 34 wurden beanstandet,
> 15 davon adversarisch gegengeprüft (5 Beanstandungen fielen dabei wieder weg). Die sachlichen
> Korrekturen sind unten **an Ort und Stelle eingearbeitet**, nicht in einem Anhang gesammelt –
> ein Anhang wäre genau die „zweite Anzeigestelle mit der alten Annahme", vor der `CLAUDE.md`
> warnt.
>
> **Zu den Zeilennummern:** Sie waren beim Schreiben richtig und sind seither um rund **35 Zeilen**
> abgewandert, weil die Datei zwischen v8.466.0 und v8.468.0 gewachsen ist. Nachgewiesen an einem
> Anker: `git show 124aa71:weltraum_kolonie.html | sed -n '47983p'` liefert wörtlich
> `const factionRing = controlledByMe`. Über sechs Commits wandert derselbe Anker
> 47934 → 47958 → 47973 → 47983 → 47986 → 48018. **Lehre für künftige Entwürfe:** Zeilennummern in
> einem Dokument, das länger lebt als ein Commit, gehören mit Commit-Stand notiert oder durch einen
> Suchbegriff ersetzt – eine nackte Zahl ist nach zwei Wochen ein Fehlverweis.

---

## 0. Zwei Befunde vorweg, die den Entwurf umkrempeln

### 0.1 Der Kern existiert bereits – er ist nur unsichtbar

Das ist die wichtigste Erkenntnis der ganzen Untersuchung. Territorium, Ausdehnung, gegenseitige
Eroberung, Rückeroberung gegen Spieler und ein Spieler-Angriffsendpunkt laufen **seit Monaten**:

| Was | Wo |
|---|---|
| `FACTION_DEFS` (Stammdaten) + `loadOrInitFactions()`, das `systems[]`/`strength` anlegt | server.js:3773 / 3779 |
| Expansion und gegenseitige Eroberung im `galaxyTick` | server.js:4239–4281 |
| Rückeroberung eines Spielersystems durch die Fraktion | server.js:4289–4309 |
| Spieler erobert ein Fraktionssystem | `POST /api/faction/attack`, server.js:6311 |
| Nachbarschaftsgraph (K=4) | `SYSTEM_NEIGHBORS`, server.js:1262 |
| Anzeige im Client | Z. 14048, 16148–16157, 48018–48022 |

**Das Problem ist Sichtbarkeit, nicht fehlende Mechanik.** Ein Spieler merkt heute praktisch nichts
davon: Territorium erscheint nur als eingefärbter Ring am Systemknoten (`factionRing`, Z. 47983), es
gibt keine Fläche, keine Grenze, keine Frontlinie, keinen Verlauf über Zeit.

Ebenso ist `activeWar` (server.js:4191) heute **reine Kulisse**: Die Parteien kommen aus
`NPC_FACTION_NAMES` (server.js:3642, sechs Namen, zwei davon ohne Fraktionseintrag), der Krieg
spielt in einem zufälligen *freien* System und verändert `f.systems` mit keiner einzigen Zeile.
Krieg und Territorium sind vollständig entkoppelt. Die Randkriege würden sie erstmals verbinden.

### 0.2 Der Blocker: Frontend und Backend kennen verschiedene Galaxien

`SYSTEM_COORDS` im Backend (server.js:1216–1258) kennt **41 Systeme**, das Frontend
(`STAR_SYSTEMS`, Z. 11642) **69** plus die wöchentlich erzeugten. Programmatisch verglichen fehlen
dem Server **28 Basis-Systeme** – darunter **alle acht äußersten** (`sys_pandora_saum` bis
`sys_meridian_kern`) und alle 20 `sysn_*`-Systeme.

Das sind genau die geografischen Randsektoren, um die es gehen soll.

**Die Folgen sind erheblich größer, als hier zuerst stand.** Die genannte 400-Ablehnung von
`/api/faction/attack` (server.js:6313) ist der *unwichtigste* Fall – über die Oberfläche lässt sie
sich gar nicht auslösen. Heute schon wirksam ist dagegen: In diesen 28 Systemen kann **kein neuer
Spieler spawnen**, **keine Fraktion Territorium halten oder ausdehnen**, **keine Supernova und kein
Wurmloch entstehen**, **keine Piratenbasis gegründet** und **kein Allianz-Raid angesetzt** werden.
`SYSTEM_NEIGHBORS` baut seinen K=4-Graphen (server.js:1270) ebenfalls nur über die 41. Rund
**40 % der Karte sind für jeden serverseitigen Galaxie-Inhalt tot** – und zwar genau die äußeren
Randsektoren, also die Bühne der Randkriege.

**Und die Lücke wächst.** „41 gegen 69" beschreibt nur die statischen Listen. Zur Laufzeit hat das
Frontend heute bereits **75** Systeme (69 + 6 wöchentliche, `WEEKLY_SYSTEMS_PER_WEEK = 2` ab
`WEEKLY_SYSTEM_EPOCH`), die echte Lücke ist also **34** – und sie wächst jeden Montag um zwei, bis
zum Deckel 69 + 208 = 277.

Der Backend-Kommentar bei server.js:1214 behauptet dagegen Gleichheit, und
`tests/test_paritaet_tabellen.js` deckt die Systemliste **nicht** ab.

> **Erster Arbeitsschritt, vor jeder Zeile Randkriege:** Systemlisten angleichen – aber **nicht** als
> einmaliges Nachtragen der 28 IDs. Das schlösse die Lücke nur für einen Moment; am Montag darauf
> laufen die Galaxien wieder auseinander, und ein Paritätstest, der bloß die statischen Listen
> vergleicht, würde nicht anschlagen. Der Server muss die wöchentliche Erzeugung **mitrechnen**
> (dieselbe Epoche, dieselbe Formel) oder die Systemliste vom Client übernehmen. Der Paritätstest
> gehört auf den Laufzeit-Bestand, nicht auf die Literale.

---

## 1. Das Frontmodell

### 1.1 Zwei Fronten statt aller gegen alle

`FACTION_RIVALS` (Z. 15498) legt die Paarungen bereits fest: **Kartell ↔ Schatten** und
**Legion ↔ Void**. Daraus folgt der Aufbau von selbst – zwei getrennte Fronten mit je fünf
umkämpften Systemen. Das hält die Karte lesbar und die Erzählung scharf.

### 1.2 Kontrollpunkte mit breiter Pufferzone

Je Frontsystem eine Zahl `kp` von 0 bis 1000:

```
   0 ────────── 300 ─────────────────── 700 ────────── 1000
   Seite B hält    umkämpft: niemand zieht Nutzen      Seite A hält
```

Die breite Mitte ist Absicht. Dem Gegner ein System *wegzunehmen* kostet nur 300 Punkte und ist
damit ein erreichbares Zwischenziel für kleine Gruppen – es selbst zu *halten* verlangt 700.

### 1.3 Bewegung nur im Weltentakt

Alles läuft im `galaxyTick` (server.js:4093, alle 15 Minuten, 96 Ticks am Tag). Beiträge sammeln
sich in zwei Puffern je System, die sich zu Beginn jedes Ticks **zuerst gegenseitig auslöschen** –
gleich starke Gegenseiten bewegen die Front also gar nicht.

- Umrechnung: **4 Kriegspunkte = 1 Kontrollpunkt**
- Deckel je Tick: **3 KP** (Bremse gegen Sturmläufe)
- realistisch: **~84 KP am Tag**, ein vollständiger Systemwechsel dauert damit **rund acht Tage**

Die Phasenuhr läuft über **Zeitstempel**, nie über Tick-Zähler: `galaxyTick()` feuert zusätzlich bei
jedem Prozessstart (server.js:4474), und nodemon startet den Container bei jedem Backend-Push neu.

---

## 2. Wie ein Spieler wirkt

Sieben Handlungen, so weit wie möglich an bereits gezählte Ereignisse angedockt. Vorbild ist die
Bauregel der Fraktionsaufträge (Kommentar Z. 14903–14907): Fortschritt wird über **vorhandene
Lebenszeit-Zähler per Differenz** gemessen, statt neue Hooks in den Kampf-/Expeditionscode zu legen.

| Handlung | Kriegspunkte | Tagesdeckel |
|---|---|---|
| Konvoi eskortieren oder überfallen (je Routen-Tick) | 1 | 40 |
| Expedition in ein Frontsystem | 40 | – |
| **Bollwerk schleifen** (über `/api/faction/attack`) | 250 / 60 | – |
| Piratennest im Frontsektor räumen | 30 | – |
| Nachschubspende (feste Rohstoffmenge) | 60 | – |
| **Fundmeldung** an die Fraktion (150 Abgrundsplitter) | 45 | – |

Nur das Bollwerk ist echt server-autoritativ. Die übrigen hängen am clientseitig geführten
Spielstand – deshalb sind ihre Gewichte bewusst klein gehalten (40/30 gegen 250), statt eine
Scheinvalidierung zu bauen, die keine ist.

**Korrektur nach der Codeprüfung: „alle ohne neuen Hook" trifft nicht zu.** Die Bauregel verlangt
einen *monotonen Lebenszeit-Zähler*, und den hat von den sieben Handlungen nur die **Expedition**
(`expeditionsCompleted`). Konkret:

- **Piratennest** – die Abschlussstelle existiert (`checkMissions`, `m.type === 'piratelair'`), aber
  `pirateLairStage` **fällt nach Stufe 10 auf 1 zurück** und `pirateLairPrestige` zählt nur
  vollständige Zehnerketten; eine Differenzmessung ist damit unmöglich. Schwerer wiegt: Das
  Piratenversteck hat **überhaupt keinen Ort in der Galaxie** – die Mission trägt nur
  `targetId: stage` und startet von `state.activeBasePlanet`. „Im Frontsektor" lässt sich heute an
  nichts prüfen. Entweder man gibt dem Versteck ein System, oder die Handlung fällt weg.
- **Fundmeldung** – hier war der Entwurf gleich doppelt daneben. „Tiefenfund" ist ein erfundener
  Name; die Währung heißt `state.abgrund.splitter` (**Abgrundsplitter**). Und die Handlung muss
  nicht gebaut werden, **sie existiert bereits**: 150 Splitter an eine Fraktion gegen Ruf, mit
  Sperrzeit je Fraktion über `state.fundmeldungLastAt`. Sie ist damit auch nicht „eine zweite
  Senke", sondern bereits die vierte von vier. Richtig ist nur, dort einen Kriegspunkt-Ertrag
  anzuhängen – ein Lebenszeit-Zähler fehlt allerdings auch hier (nur Zeitstempel).
- **Nachschubspende** – `WAR_SUPPORT_COST` ist tatsächlich ein Literal mit festen Mengen
  (`{ erz:4000, kristalle:2500, deuterium:1200 }`) und taugt als Vorbild gegen „N Minuten
  Produktion". Aber `supportWarSide` ist durch `if (warSupportedSide()){ … return; }` genau
  **einmal je Krieg** möglich, nicht wiederholbar-täglich – und schickt nicht einmal etwas an den
  Server. Das zweite Spendenmuster (`recordAllianceDonation`) arbeitet mit frei gewählter Menge,
  ist also gerade **kein** Vorbild für einen festen Betrag.
- **Konvoi** – Routen-Ticks haben keinen passenden Zähler.

Für diese vier ist es also sehr wohl ein neuer Hook. Das ist machbar, muss aber im Aufwand stehen
und nicht als „dockt an Vorhandenes an" verbucht werden.

### 2.1 Fünf Sperren gegen das Großkonto

1. **Tagesdegression** 100 / 70 / 40 / 0 Prozent. ~~Die ersten hundert Punkte sind viermal so viel
   wert wie die letzten. Effektiver Deckel: 265 Kriegspunkte je Front und Tag.~~ **Beim Bauen
   nachgerechnet, beide Zahlen waren falsch:** 100 % gegen 40 % ist der Faktor **2,5**, nicht 4, und
   der wirksame Deckel ist die Summe der Stufen, also 100 + 70 + 40 = **210** Kriegspunkte je Front
   und Tag (rund 52 Kontrollpunkte). Woher die 265 kamen, lässt sich nicht mehr rekonstruieren – sie
   passen zu keiner Lesart der Stufen. Die Zahl steht jetzt an genau EINER Stelle im Code
   (`RK_TAGESSTUFEN`); Hilfetext, Patchnote und Test leiten sie daraus ab, statt sie zu wiederholen.
2. **Tickdeckel** 3 KP je System.
3. **Anteilsdeckel je Konto und Phase.**
4. **Wochendeckel** auf alle Belohnungen (siehe 4.2).
5. **Die entscheidende, strukturelle Sperre:** Ein System darf eine Besitzschwelle nur
   überschreiten, wenn in 24 Stunden **mindestens drei verschiedene Spieler** beigetragen haben.
   Ein Einzelkonto drückt bis `kp` 699 – und bleibt dort für immer stehen.

---

## 3. Was ein Sieg bedeutet

Gewinnt eine Fraktion ein System, wirkt das **im System**, nicht global:

- Vorrechte für Freunde der Fraktion: Handelsrabatt, Reparatur, bessere Bergungsquoten
- Für Verfeindete: erhöhter Druck durch Strafexpeditionen
- Der Sektor bekommt sichtbar die Farbe und das Wappen seiner Fraktion

**Verlieren kostet niemals Besitz.** Nur Vorteil und Druck: Vorrechte weg, +25 % Strafexpeditionen
für 48 Stunden, −15 % Handelsroutenertrag. Wer die unterlegene Seite gestützt hat, bekommt
**6 Ruf als Trostpreis** – ohne den kippt die Beteiligung geschlossen auf die führende Seite, und
der Krieg ist nach zwei Tagen entschieden.

---

## 4. Progression und Balance

### 4.1 Eine Korrektur am Auftrag

Der Befund „Endgame-Senken fehlen" stimmt so nicht. Der Aufstiegsbaum ist seit dem 27.07.2026
**unendlich** (`ascNodeCost`, Z. 25284–25286), und es gibt vier endlose Forschungszweige
(Z. 10631–10642, alle vier mit `endless:true`). Was fehlt, ist die **wiederholbare Essenz-QUELLE**.

**Korrektur:** Hier stand zuerst „zwischen zwei Aufstiegen ist der Zufluss exakt null". Das ist
falsch – und widersprach sogar Abschnitt 6.5 dieses Dokuments. Es gibt drei aufstiegsunabhängige
Quellen: Forschungs-Meilensteine (86), Kompendium (47) und Expeditions-Kodex (54), zusammen rund
**187 Essenz**. Alle drei sind aber **einmalig je Konto** – ihre Marker überleben seit v8.379.0
Prestige *und* Aufstieg. Richtig ist also: Es gibt keine **wiederholbare** Quelle, nicht: keine.

Der Krieg speist deshalb drei Töpfe:

- **Gunstmarken** – der dünnste Zufluss im Spiel: genau zwei Zuflusspunkte im ganzen Code, Aufträge
  (1/2/4, ab Rang 7 „Geachtet" 2/3/5 durch `RANK_FAVOR_BONUS_FROM`) und Kriegsparteinahme (3)
- **Frontmarken** – eine neue, fraktionsneutrale Währung
- **Sternenessenz** – ausschließlich als Wochenprämie mit absolutem Deckel 3, **nie pro Aktion**

### 4.2 Wochendeckel (konkret)

| Topf | Deckel je Woche |
|---|---|
| Frontmarken | 12 |
| Sternenessenz | 3 (absolut, erst ab dem ersten Aufstieg) |
| Gunstmarken je Fraktion | 4 (erst ab Rang 6, weil der Laden erst dort öffnet) |
| Ruf je Fraktion | 20 |
| Beitragspunkte je Frontabschnitt | 100 |
| Frontverschiebung | höchstens 2 Sektoren am Tag |

### 4.3 Dienstgrade statt eines neunten Rangs

`REP_RANKS` bekommt **keine** neunte Stufe – die Schwellen 30 und 70 sind im Backend gespiegelt
(`marketDiscountPctFor`, server.js:4502). Stattdessen eine **parallele Dienstgrad-Leiter** je
Fraktion mit sechs Stufen bei 25 / 75 / 175 / 350 / 650 / 1100 Dienstpunkten.

**Kein Dienstgrad gibt einen eigenen Prozentbonus.** Alle Freischaltungen sind Sachwerte – ein
Schiff, ein Modul, ein Gebäude, ein Titel, ein Anstrich –, deren Wirkung durch die bereits
gedeckelten Gruppen `productionBonusRaw()` und `attackCombatBonusRaw()` läuft.

**Wichtig, weil die beiden Töpfe seit v8.468.0 nicht mehr gleich gebaut sind:** Der Kampfbonus ist
weiterhin ein hartes `Math.min(1.0, …)`. Die Produktion läuft dagegen durch `weicherDeckel()` –
Werte über 1.0 brechen nicht ab, sondern laufen exponentiell aus und sind erst bei
Deckel + Spielraum = 1.25 hart begrenzt, effektiv also **+125 %, nicht +100 %**. Wer einen neuen
Produktionsbonus in diese Gruppe legt, muss mit dem weichen Auslauf rechnen, nicht mit einer Klippe.

### 4.4 Drei Dinge, die der Krieg ausdrücklich NICHT tun darf

- **Keine Kampfpunkte für risikofreie Handlungen.** `awardBattlePoints` (Z. 22395) erhöht
  `battlePoints` und `commandPoints` im Gleichschritt; `battlePoints` gehen mit ×3 in
  `computeScore()` und mit /200 in `essenceGainNow()`. Das wäre eine PvP-freie Abkürzung in
  Bestenliste *und* Sternenessenz zugleich.
- **Kein „N Minuten eigene Produktion".** Dieses Muster lebt ausgerechnet im Fraktionssystem weiter
  (`factionGiftPreview`, Z. 15272–15281). Genau genommen betrifft es **eine** Fraktion und **eine**
  Stufe: Die Legion zahlt auf „Verbündet" `ratesPerSecond().erz * 900` (15 Minuten) plus 60 % davon
  in Kristallen, auf „Freundlich" `* 400` (rund 6,7 Minuten); der Schattenbund zahlt feste Kredite.
  Das `Math.max` davor ist ein **Boden, kein Deckel** – begrenzt wird nur durch die 24-Stunden-
  Abklingzeit je Fraktion. Vorlage sind
  stattdessen die **festen** Beträge bei `WAR_SUPPORT_*` (Z. 15098–15099).
- **Kein Ruf-Zuwachs an `changeFactionRep()` vorbei** (Z. 15546). Sonst greifen `applyRivalSpill`
  (0,35 gegenläufig) und `enforceRivalExclusivity` nicht – und der Krieg wird still zum Weg, mit
  allen vier Fraktionen gleichzeitig verbündet zu sein und alle vier `FACTION_OUTSIDE`-Boni
  gleichzeitig zu halten.

---

## 5. Grafik

> **Die Entwürfe sind gebaut und gemessen**, nicht beschrieben: `docs/randkriege-entwuerfe/`
> erzeugt vier Bilder (Frontkarte, Kriegsraum, Symbolfamilie, Handy) mit `node
> docs/randkriege-entwuerfe/bilder.js`. Die Kartenpositionen kommen dabei aus der Spieldatei
> selbst – `galaxySlotPositions()` und Nachbarn werden als Quelltext herausgeschnitten und
> ausgeführt, nicht nachgebaut. Sechs Punkte dieses Abschnitts hat erst das gerenderte Bild
> korrigiert; sie stehen in `docs/randkriege-entwuerfe/README.md` und weiter unten in 5.2.

### 5.1 Zuerst: der Farbkonflikt

Frontend (`FACTION_DIPLOMACY`, Z. 15320–15325) und Backend (`FACTION_DEFS`, server.js:3773–3778)
vergeben **verschiedene Fraktionsfarben**. Der Konflikt ist schärfer und breiter, als hier zuerst
stand – nachgeprüft am Code:

- **Die Karte kennt die Frontend-Farbe überhaupt nicht.** Sie geht gar nicht durch
  `diplomacyFactions()`: `factionOwning()` liest `galaxyCache.factions` roh aus, und der
  Territoriumsring benutzt `owner.color` direkt. Es gibt dort **keinen Rückfall** auf die lokale
  Farbe. (`diplomacyFactions()` mit `s.color || d.color` betrifft nur den Diplomatie-Reiter.)
- **Rot ist wirklich vertauscht:** `#e24b4a` gehört im Frontend der **Legion**, im Backend dem
  **Void**. „Rot und Blau vertauscht" war aber ungenau: Im Frontend gibt es gar kein Blau – Void
  ist dort `#c3bef5`, ein blasses Lavendel, und das Wappen `fac_void` ist violett gezeichnet. Das
  Blau `#85b7eb` der Legion ist keine vertauschte, sondern eine **im Backend neu erfundene** Farbe,
  die im Frontend nirgends vorkommt.
- **Es gibt eine dritte Farbquelle.** Das Überfall-Banner färbt über `factionAccentColor()`
  ausdrücklich mit der **Frontend**-Farbe („Echte Fraktionsfarbe vor der gehashten Ersatzfarbe").
  Void erscheint dort lavendel und auf der Karte rot. Und in der Fraktionskarte steht der
  Widerspruch in *einer* Zeile: Der Name wird mit `f.color` (Serverfarbe, Legion blau) eingefärbt,
  während `iconHtmlFor()` bei vorhandenem `ICONS`-Eintrag das SVG unverändert zurückgibt und den
  Farbparameter ignoriert – das rote Wappen steht direkt neben dem blauen Namen.

Wer den Konflikt auflöst, muss also **drei** Stellen mitnehmen, nicht zwei. Bei einer Karte, die
über Farbe gelesen wird, ist das vorher zu klären.

Zusätzlich: Die Flächenfarbe der Legion muss von `#e24b4a` abweichen (Vorschlag `#c0504f`), weil
`#e24b4a` identisch mit `--c-danger` und mit der Kernfarbe des eigenen Heimatsterns (Z. 48014) ist.

### 5.2 Die Frontkarte

- **Besitz als Fläche:** ein `radialGradient` je Fraktion, ein Kreis mit r = 30 × Knotenskala je
  besessenem System. Der Metaball-Filter für eine harte Grenze ist **Ausbaustufe** und wird erst
  nach einer Pan-Messung auf einem echten Handy freigegeben.
- **Frontsegmente aus Bildschirmabständen**, nicht aus dem Server-Nachbargraphen:
  `SYSTEM_NEIGHBORS` hängt an `gx/gy`, die Kartenposition dagegen an den Spiralplätzen aus
  `galaxySlotPositions()` (Z. 47676–47691). Wer die Front aus `gx/gy` baut, bekommt ein Spinnennetz
  quer über das Bild.
- **Segmente, und zwar wörtlich – keine durchgehende Frontlinie.** Am gerenderten Bild gemessen:
  Vier Gebiete als Viertel eines schmalen Rings haben radiale Nähte von rund **90 Bildpunkten**
  Länge (Kern bei Radius 75, äußerstes der heutigen 69 Systeme bei 120). Drei Versuche, daraus
  einen durchgehenden Zug zu ziehen – nach Radius sortiert, auf den Nahtwinkel projiziert, bis
  Kern und Rand verlängert –, haben die Linie jedes Mal ins eigene Gebiet gebogen. Was es
  wirklich gibt, sind **Berührungen**: Systempaare aus verfeindeten Gebieten, die nah beieinander
  stehen. Jedes bekommt einen Riegel quer zur Verbindung, länger und heller je enger das Paar –
  zusammen eine Postenkette, die die Grenze zeigt, ohne eine Geometrie zu behaupten, die nicht da ist.
- **Der Kartenausschnitt muss zugeschnitten sein.** Das Spiralfeld hält Platz für alle 277
  künftigen Systeme frei; die heutigen 69 sitzen in der vollen 950 × 500-Fläche als Fleck in der
  Mitte. Die Frontkarte braucht denselben Ausschnitt, den `galaxyFillRatio()` schon für den
  Startausschnitt bildet.
- **Die Beschriftung braucht einen eigenen Entzerrungsdurchgang.** Knoten liegen 24 px auseinander
  (`GALAXY_MIN_NODE_DIST`), ein Block aus Name, Kontrollbalken und Zahl ist rund 60 × 24 px groß –
  ohne Auseinanderschieben (Verfahren wie `galaxyRelax()`, plus Fühler zum Stern) liegen sie
  übereinander. Zwei Fallen dabei, beide erst im Bild sichtbar geworden: Der Kasten muss die
  **tatsächliche** Ausdehnung beschreiben statt um den Ankerpunkt zentriert zu sein, und seine
  Breite kommt aus der **breitesten Zeile** – „812 +9/Tag · du 62" ist fast doppelt so breit wie
  der Systemname.
- **Die Frontebene gehört ÜBER die Knoten.** Darunter gezeichnet verschwindet sie unter den
  Leuchthöfen, die bis 17 px groß sind.
- **Kontrollbalken je System als Balken unter dem Label**, nicht als zweiter Ring – der Knotenring
  ist mit `ringDash` (Z. 47994) bereits für den Erkundungsgrad belegt.
- **Jede Bewegung als SMIL oder CSS im SVG** (Vorbilder: Wurmloch-Animate Z. 47921, Pulsar
  Z. 48001), niemals ein pro Tick neu gerechneter Wert – sonst greift der Markup-Zwischenspeicher
  (Z. 48051) nie mehr und alle 448 Knoten werden jede Sekunde neu gebaut.

### 5.3 Wappen und Symbole

Die vier vorhandenen Wappen (`ICONS` Z. 4873–4876) bleiben. Für Karte und Kriegsraum kommt eine
zweite, größere Familie `facw_*` dazu:

| Fraktion | Wappen |
|---|---|
| Aschen-Kartell | Achteck-Siegel, gebrochener Rand, Aschgrau auf Gold |
| Void-Marodeure | zerrissener Schild, Riss von oben rechts nach unten links |
| Eisenlegion | Kohortenstandard mit **flachem Sockel** statt Speerspitze (Kollision mit `doc_offensive`, Z. 4798) |
| Schattenbund | Raute mit Schleierbändern, halb verdeckt |

**Kein neues `ti-*`-Icon** – der Font ist ein Subset. Alle elf neuen Symbole kommen als
handgezeichnetes SVG in `ICONS`, und auf der Karte als verschachteltes `<svg>` statt als weiteres
Emoji, wie es die heutigen Abzeichen (Z. 47961–47981) noch sind.

### 5.4 Meldungen

Frontverschiebungen **anderer** Fraktionen gehören in die Galaxie-Nachrichten (Z. 14010–14040,
serverseitig auf 40 Einträge begrenzt), nie in `pushToast` – dort gibt es nur drei Plätze, sie
werden für eigene Ereignisse gebraucht, und `log()` belegt selbst einen davon.

**Der engere Deckel steht aber woanders:** Angezeigt werden nur die neuesten **zwölf** Einträge
(`news.slice(0,12)`, zweimal – für die Signatur und fürs Markup). Der Server hält 40 vor, der
Spieler sieht 12. Eine aktive Front würde diese zwölf Plätze schnell allein belegen und Weltboss-,
Liga- und Allianzkriegsmeldungen verdrängen. Frontmeldungen brauchen deshalb entweder eine eigene
Rubrik oder eine harte Quote innerhalb der zwölf.

### 5.5 Handy

Auf 390 px rendert die Karte wegen des Vorgabewerts von `preserveAspectRatio` (Z. 3241) nur rund
184 px hoch in einem 420-px-Kasten. **Achtung beim Nachlesen:** Die CSS-Klasse `.map-wrap` gibt
230 px vor; die 420 px kommen aus dem Inline-Stil genau dieser einen Instanz (Z. 3240). Für die
Rechnung ist 420 richtig, aber wer nur die Regel liest, findet 230.

Die Front bekommt diese Briefkastenfläche als **HTML-Leiste** im `.map-wrap` (Bauweise wie
`.map-radar-overlay`) – nicht mehr Kartenhöhe.

Der neue Unterreiter heißt kurz **„Front"** und läuft ohne eine Zeile neue Schaltlogik im
vorhandenen generischen Werk mit (Leiste Z. 3270–3276, Umschaltung Z. 53571).

Die Begründung „bei 350 px bricht die Leiste sonst in eine zweite Reihe um" ist allerdings
**nicht gemessen**, und die Formulierung unterstellt einen einzeiligen Ist-Zustand, den das Markup
nicht hergibt: Die Leiste hat `flex-wrap:wrap`, und die fünf vorhandenen Pillen stehen bei 350 px
mit einiger Wahrscheinlichkeit schon heute mehrzeilig. Vor dem Bau im Browser nachmessen – ein
kurzer Name ist trotzdem richtig, aber die Begründung muss stimmen.

---

## 6. Technische Anbindung

### 6.1 Wo die Daten liegen

**Der Frontverlauf gehört nach `db.galaxy`, nicht nach `db.shared`.** Geteilte Schlüssel haben kein
Compare-and-Swap (server.js:1789–1793 schreibt blind; `expectedVersion` existiert nur im privaten
Pfad, 1817–1823) und sind auf 64 KB je Wert begrenzt. `db.galaxy` wird vom `galaxyTick` gepflegt und
von `/api/galaxy` ausgeliefert – **jedes neue Feld dort ist ohne neuen Endpunkt sofort bei allen
Clients**, weil `loadGalaxyState()` (Z. 13983) den Zustand 1:1 übernimmt.

**Das Rohdaten-Hauptbuch muss außerhalb liegen** (z. B. `db.randkriegBuch`): `/api/galaxy`
(server.js:4477) liefert das komplette Objekt ungefiltert aus – ein Geschwisterfeld wäre sofort
öffentlich, inklusive aller Spieler-IDs.

### 6.2 Rechte

Ein neuer Präfix im geteilten Speicher ist ohne eigene Prüfung für **jeden eingeloggten Nutzer**
schreibbar: Alle fünf Prüffunktionen geben bei Nicht-Treffer `null` zurück (server.js:528, 549, 562,
607, 612), und die Kette ist `a() || b() || …`. Falls doch etwas nach `db.shared` muss, braucht es
`checkRandkriegKeyPermission` mit **deny-by-default** an **drei** Orten: 1685 (GET), 1717 (PUT) und
im guarded-Block von `storage-list` (1837–1845).

**Zur Vorsicht, weil das Vorbild hier trügt:** `checkAllianceKeyPermission` selbst hat nur **zwei**
Aufrufstellen (1685 und 1717). Der dritte Ort ruft sie *nicht* auf, sondern wiederholt die
Rollenprüfung von Hand über `allianceRoleOf`. Als Bauanweisung stimmen die drei Orte – als
Beschreibung des Ist-Zustands wäre „an drei Stellen verdrahtet" falsch, und wer beim Nachbauen nur
der Funktion folgt, übersieht `storage-list`.

### 6.3 Polling – eine Messkorrektur

Der oft zitierte „globale Limiter 240/min" ist **kein globaler Limiter**. Der Bucket-Schlüssel ist
`req.ip + req.path` (server.js:134), und in der per `app.use('/api', …)` gemounteten Middleware
(188) ist `req.path` der Pfad **ohne** Mount-Präfix – bei `/api/storage/:key` sogar je Schlüssel.
Experimentell mit einer Mini-Express-App bestätigt.

Gemessen macht ein sichtbarer Tab heute bereits rund **165 Anfragen/Minute**, verteilt auf ~35
Pfade – kein Bucket kommt in die Nähe von 240.

**Empfehlung trotzdem: keine neue Anfrage.** Der Kriegszustand fällt aus dem bestehenden
120-Sekunden-Abruf von `/api/galaxy` heraus (Z. 56494). Aktionen laufen über einen eigenen
POST-Pfad mit 30/min statt 20, weil NAT mehrere Spieler auf eine IP legt.

### 6.4 Was der Server rechnen muss

- Den **Wert** jeder Aktion aus dem gespeicherten Spielstand (Muster `/api/faction/attack`,
  server.js:6322–6331) – der Body trägt nur die Absicht.
- Die Mission **vor** jeder Wirkung aus dem Save verbrauchen (Muster `/api/worldboss/resolve`,
  server.js:4830–4835).
- Die Abklingzeit im Save führen (Muster `worldBossLastAttack`, server.js:4842).

**`galaxyTick` darf niemals pro Spieler einen vollständigen Save parsen.** Heute sind es höchstens
vier (server.js:4298); 200 Saves wären auf dem Pi hunderte Millisekunden bis Sekunden blockierte
Event-Loop, dazu das `saveDb()` der kompletten `db.json`.

### 6.5 Spielstand und Resets

```js
state.randkriege = {          // lazy angelegt, Vorbild ensureAbgrund (Z. 42201)
  dienst: {},                 // fraktionId -> Dienstpunkte (ganzzahlig, >= 0)
  beitrag: {},                // systemId -> Beitragspunkte der laufenden Phase
  frontmarken: 0,
  abgeholt: {},               // phasenId -> true  (MUSS beide Resets überleben)
  wocheStart: 0, wocheMarken: 0, wocheEssenz: 0
}
```

- **Prestige behält alles** (`randkriegeUeberReset(true)` neben `abgrundUeberReset`, Z. 25262).
- **Der Aufstieg behält nur Marker und Zähler** (Z. 25456).
- Die `abgeholt`-Marker müssen **beide** Resets überleben, sonst ist jede Phasenbelohnung
  nachfarmbar – genau der Fehler, der bei `researchMilestones` schon passiert ist (86 Essenz je
  Durchlauf, Kommentar Z. 25366–25382).
- **Achtung:** `state.factionRep` wird von **beiden** Resets geleert (Z. 25246 Prestige, Z. 25445
  Aufstieg). Werden Sektorvorteile daraus abgeleitet, muss das in den Prestige-Dialog (Z. 24843)
  und in beide Aufstiegs-Dialoge (Z. 25397/25398) – sonst entsteht wieder die zweite Anzeigestelle
  mit der alten Annahme.

### 6.6 Eine Präzisierung zur Hausregel

`saveSanityViolation()` (server.js:2338–2363) prüft **nur** `buildings`, `research`, Flotten,
`resources`, `credits`, `prestige`, `xp`, `shipMarks`. Ein `state.randkriege` fällt derzeit **nicht**
darunter und könnte das Speichern heute *nicht* einfrieren. Das Klemmen auf nicht-negative
Ganzzahlen bleibt trotzdem Pflicht: Ein `NaN` wandert still weiter und kippt den Spielstand erst,
wenn es `credits` erreicht – dann ist es der Vorfall vom 21.07.2026.

---

## 7. Die Gegenprüfung – wo der Entwurf wehtut

Ehrlich aufgeführt, weil diese Punkte vor dem Bau entschieden werden müssen:

**Die Spielerzahl trägt das „für alle dasselbe" womöglich nicht.** Das Backend sichert Wochen- und
Saisonliga ausdrücklich für weniger als 8 bzw. 5 Teilnehmer ab (server.js:3876, 3951). Eine Front,
die drei verschiedene Beiträger je 24 Stunden braucht, steht bei geringer Beteiligung schlicht still.

**Der Straftrupp-Hebel ist am Anschlag.** `raidChanceMult` multipliziert bereits vier Faktoren
(Z. 15861) und erreicht in der Spitze über 1,0 Überfallchance je 5-Minuten-Takt. Ein zusätzlicher
Frontfaktor hat keinen Wirkungsraum – und liefe zudem clientseitig (`maybeScheduleRaid`, Z. 23007),
erreicht Offline-Spieler also nie.

**Prestige trifft genau die falsche Hälfte.** `factionRep` wird geleert (Z. 25246/25445), während
eroberte Systeme im Backend liegen (server.js:3726) und samt Ertrag überleben: Frontgewinne bleiben,
Frontposition ist weg.

**Solo-Spieler ohne Backend sähen einen leeren Reiter.** Genau dieser Fehler ist am 26.07.2026 schon
passiert; die Lehre steht im Code (Z. 15311–15325): Inhalt lokal, Zustand vom Server. Eine Front ist
reiner Zustand – der Reiter braucht einen ehrlichen Leerzustand.

**Kleine Konten werden bestraft.** Die Fraktionsverteidigung skaliert mit der Serverlaufzeit
(`strength` bis 6.0, server.js:4241), Misserfolg kostet 10–25 % jeder Schiffsart (server.js:6348),
die Trostchance liegt bei 8 %.

---

## 8. Die einfachere Idee, die 80 % der Wirkung bringt

Weil der Kern bereits existiert (Abschnitt 0.1), erreicht man den größten Teil der Wirkung **ohne**
neue Mechanik:

> **Mach das Vorhandene sichtbar.** Territorium als Fläche statt als Ring, ein Frontbalken je
> umkämpftem System, die vorhandenen Fraktionskriege in die Galaxie-Nachrichten, und `activeWar`
> mit `f.systems` verbinden, damit ein Krieg endlich etwas verschiebt.

Das ist ein Bruchteil des Aufwands, bricht nichts, braucht keine Balance-Entscheidung – und man
sieht danach am echten Spielerverhalten, ob die tiefere Fassung überhaupt gebraucht wird.

## 9. Reihenfolge, wenn gebaut wird

1. ✅ **Systemlisten angleichen** und Paritätstest ergänzen — *gebaut am 10.08.2026.* Aus „41 gegen
   69" wurde beim Bauen mehr, als der Entwurf annahm: Die Folgen reichten weit über die
   400-Ablehnung hinaus (kein Spawn, kein Territorium, keine Supernova, kein Wurmloch, keine
   Piratenbasis, kein Allianz-Raid in 28 Systemen), und ein einmaliges Nachtragen hätte nicht
   gereicht — der Server rechnet die wöchentlich hinzukommenden Systeme jetzt selbst mit.
   Belegt durch `tests/test_systemparitaet.js` (Frontend, statisch, inkl. Wochenformel bis
   Index 207) und `tests/test_systemliste_http.js` (Backend, echter Server: 9 von 12 Spawns landen
   in vorher toten Sektoren).
2. ✅ **Farbkonflikt auflösen** — *gebaut.* Es waren nicht zwei Stellen, sondern drei, und die
   Karte ging gar nicht durch `diplomacyFactions()`. Jetzt gibt es `factionColorOf()` und
   `factionMapColorOf()` als einzige Quelle; die lokale Farbe gewinnt, weil nur sie zu den Wappen
   passt. Legion-Fläche `#c0504f` statt `#e24b4a`.
3. ✅ **Sichtbarkeit** — *gebaut.* Territorium als Fläche (ein `radialGradient` je Fraktion,
   r = 30 × Knotenskala), Wappen am Knoten als verschachteltes `<svg>`, Frontsegmente zwischen
   verfeindeten Nachbarn aus Bildschirmabständen. Bewusst **ohne** Kontrollbalken: Kontrollpunkte
   gibt es noch nicht, ein Balken ohne Mechanik dahinter wäre eine Behauptung.
   Belegt durch `tests/test_fraktionsgebiet.js` (Quelltext) und
   `tests/test_fraktionsgebiet_karte.js` (Browser, misst das erzeugte SVG).
4. `activeWar` an `f.systems` koppeln — der Krieg bewegt erstmals etwas
5. Kontrollpunkte, Puffer, Tickdeckel — die eigentliche Frontmechanik
6. Die sieben Handlungen, beginnend mit dem Bollwerk (als einzige server-autoritativ).
   **Achtung, Korrektur aus der Nachprüfung:** Nur die Expedition dockt wirklich ohne neuen Hook
   an. Piratennest und Fundmeldung brauchen einen, und das Piratenversteck braucht überhaupt erst
   einen Ort in der Galaxie.
   - ✅ **Das Bollwerk** — *gebaut am 10.08.2026.* `/api/faction/attack` trägt jetzt für den Rivalen
     des Besitzers bei, 250 bei Erfolg / 60 bei Fehlschlag, über `rkBeitrag()` mit Tagesdegression.
     Zwei Dinge kamen beim Bauen dazu, die der Entwurf nicht vorhergesehen hatte: (a) Ein
     **erfolgreicher** Angriff nimmt das System aus der Front heraus (es gehört dann dem Spieler,
     und `rkGrenzsysteme` schließt `controlledSystems` aus) – der Beitrag wäre im nächsten Takt
     ersatzlos verfallen. Er geht deshalb an den Frontabschnitt, an dem die eigene Seite dem
     nächsten Schritt am nächsten ist. (b) Wer nichts **Wirksames** beiträgt (Tagesdeckel
     ausgeschöpft), darf nicht als Beitragender zählen – sonst schlösse ein Großkonto die
     Mehr-Konten-Sperre mit wertlosen Punkten auf.
   - ⚠️ **Dabei aufgefallen:** Die Mehr-Konten-Sperre aus Schritt 5 war praktisch **aus**.
     `rkAktiveSpieler()` las `u.lastSeen` – ein Feld, das es auf den Benutzerobjekten nicht gibt
     (der Zeitstempel liegt in `db.shared['leaderboard:<id>']`). Die Funktion lieferte immer 0, die
     Schranke war damit auf „einer reicht" geklemmt. Der Test hat es nicht gemerkt, weil sein
     Fixture denselben erfundenen Schlüssel setzte – eine Annahme, gegen sich selbst geprüft.
     Behoben, und das Fixture baut die Ablage jetzt so, wie der Server sie führt.
   - Offen bleiben die sechs übrigen Handlungen.
7. Dienstgrade, Frontmarken, Wochendeckel
8. Kriegsraum-Ansicht und Wappenfamilie

> **Vor Schritt 5 zu entscheiden, nicht danach:** Ob täglich drei verschiedene Spieler
> zusammenkommen. Steht die Front sonst still, sind die Schritte 5–8 gebaute Deko. Die Schritte
> 1–3 sind davon unabhängig wertvoll — 1 war ein echter Fehler, 2 ein sichtbarer Widerspruch,
> 3 macht eine seit Monaten laufende Simulation erstmals erlebbar.
