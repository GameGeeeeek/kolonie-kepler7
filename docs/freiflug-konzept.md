# Freiflug – aktive Weltraum-Ebene für Kolonie Kepler-7

Technische Bestandsaufnahme und Umsetzungsentwurf. Stand 09.08.2026, Spielversion v8.462.0.
Zeilennummern beziehen sich auf `weltraum_kolonie.html` bzw. `kolonie-kepler7-backend/server.js`.

Der spielbare Prototyp dazu liegt als **`freiflug_test.html`** im Repo – eigenständig, ohne eine
Zeile an der Spieldatei zu ändern. Er ist der Beleg dafür, dass die hier beschriebenen Annahmen
tragen; alle Zahlen in diesem Papier sind an ihm gemessen, nicht geschätzt.

---

## 0. Der überraschendste Befund vorweg

**Die Echtzeit-Engine existiert bereits.** Die Kampf-Wiedergabe „Orbitalsturm" (IIFE `Wiedergabe`,
Z. 28175–33223, rund 5.000 Zeilen) ist eine vollständige Canvas-2D-Engine: `requestAnimationFrame`
mit dt-Deckel und Generationsmarke gegen Doppelschleifen (Z. 32095–32164), dpr-bewusstes `messen()`
(Z. 28770), Sprite-Atlanten mit **32 Drehlagen je Rumpf** (`atlantenBauen` Z. 29136, `zeichneSchiff`
Z. 29189 – ein einziger `drawImage`-Blit pro Schiff), Partikel-Pools mit harten Obergrenzen je
Geräteklasse (`grenzenSetzen` Z. 29776), gebündelte Geschosspfade, Kamera mit Zoom und Ruckeln,
Geschützschwenkung mit Winkelklemmung (Z. 30500–30574) und sogar MP4-Export.

Sie ist ein **Abspielgerät, keine Steuerung**: Der Ausgang steht vor dem ersten Bild fest
(`resolveBattlePhases`), die Zeitachse ist ein Drehbuch (`ABSCHNITTE` Z. 28728). Was fehlt, ist
Spieler-Eingabe, freie Karte und Treffer-Logik mit Spielwirkung. Die **Renderschicht** dagegen ist
nahezu unverändert übernehmbar – das ist der mit Abstand größte Hebel dieses Vorhabens.

Zweiter großer Befund: **Die Extraktions-Ökonomie gibt es auch schon.** Expeditionen sind exakt der
Kreislauf „ausfliegen, Beute sammeln, am Frachtraum gedeckelt heimkehren" (`EXPEDITION_BASE_CARGO`
Z. 17837, `fleetCargoCapacity` Z. 17823, Kappung Z. 45297) – nur ohne Echtzeit.

---

## 1. Welche bestehenden Systeme wiederverwendet werden

| Bereich | Vorhanden | Wiederverwendung im Freiflug |
|---|---|---|
| **Rendering** | `Wiedergabe`-IIFE Z. 28175 ff. | rAF-Schleife mit dt-Deckel 0,05 s + Generationsmarke, `messen()`/dpr, Kamera, Partikel-Pools, gebündelte Geschosspfade – 1:1 als Gerüst |
| **Schiffsgrafik** | `SHIP_HULL_DEFS` Z. 5354, `drawShipMiniIcon` Z. 5534 | ~40 fertige Silhouetten mit abgeleiteten Triebwerken, Skins, Marken-Aufbauten. `backeSpielAtlas` Z. 29014 backt daraus Rotations-Sprites |
| **Loot-Ziehung** | `fundPool`/`zieheAusPool` Z. 20896/20918, `pickWeightedByRarity` Z. 40314 | Neuer Herkunftsschlüssel `HERKUNFT_FREIFLUG` sperrt Space-Loot automatisch aus Markt und Expeditionen aus – `tests/test_herkunft.js` erzwingt das bereits |
| **Gutschrift** | `gainResources()` Z. 18475 | **Einziger** Weg, Beute zu buchen. Lagerdeckel und Tier-2-Klemmung kommen gratis mit |
| **Bezahlen** | `costAmountAvailable` Z. 18384, `pay` Z. 18457 | Neue Kostenschlüssel (Xenit) müssen in BEIDE verdrahtet werden – `tests/test_kostenschluessel.js` wacht |
| **Frachtraum** | `fleetCargoCapacity` Z. 17823, `cargoScale`-Kappung | Fertiges „Laderaum begrenzt die Heimkehr"-Muster samt Warntexten |
| **Module** | `MODULE_RARITY` Z. 20263, Instanzschlüssel `typ:seltenheit:level:subs` Z. 20293–20330 | 7 Seltenheiten, Wertstreuung 90–110 %, Substats, Durchbruch, Werkbank (`fuseModules` Z. 21073 ff.) – alles per `isShip`-Flag parametrisiert, ein drittes Inventar passt ins selbe Muster |
| **Sets** | `MODULE_SET_DEFS` mit `stufen` Z. 20687, `setBonusAt` Z. 20730 | Die Boss-Set-Variante (Teilstufen zählen additiv) ist genau das vom Auftrag geforderte Void-Hunter-Modell |
| **Loadouts** | `applyShipModuleLoadout` Z. 21877, `shipLoadoutVorschau` Z. 21907 | Drei Profile je Klasse inkl. ehrlicher Wechselvorschau (misst mit der ECHTEN Bonusfunktion) |
| **Schiffswerte** | `effectiveShipSpeed` Z. 22085, `shipMarkBonus` Z. 17536, `shipModuleBonusFor` Z. 21825 | Fertige Stat-Pipeline: Basiswert × Klassenmodul × Werftmarke |
| **Kamera/Eingabe** | Galaxiekarte Z. 55857–55916 | Mausrad-Zoom auf den Cursor, Drag-Pan, 2-Finger-Pinch, `galaxyMapDidDrag` gegen Fehlklicks nach dem Ziehen |
| **Weltgenerierung** | `hashStringToFloat` Z. 47461, `weeklyRng`/`buildWeeklySystem` Z. 12381/12406 | Deterministische Erzeugung aus dem Index – ein Sektor sieht bei jedem Besuch gleich aus, ohne dass etwas gespeichert wird |
| **Zonen-Modifikatoren** | Abgrund-Sektorgenerator `mods={atk,def,loot,…}` + `ABGRUND_GRENZEN` Z. 41993–42019 | Vorbild für „diese Zone gibt mehr Beute, kostet aber mehr" mit harten Grenzen |
| **POI mit Verfall** | `maybeSpawnSignal`/`pruneSignals`/`resolveSignalFind` Z. 49574/49553/49604 | Spawns mit Frist, Deckel, Pechsträhnen-Schutz und garantiertem Fund |
| **Trennung vom PvP** | `ATTACK_SHIP_KEYS`/`TIEFEN_SHIP_KEYS` Z. 17757/17763 | Die Tiefenflotte ist die exakte Blaupause für „Schiffe, die nur in einem Modus wirken" |
| **Overlay + Tick-Bremse** | `.battle-modal-overlay` CSS 450–518, `anzeigeVerdeckt()` ~55984 | Vollbild-Overlay, unter dem der Sekunden-Haupttick sein Neuzeichnen aussetzt |
| **Meldungen** | `log()`/`pushToast()` Z. 23578, `playSound` Z. 25379 | Schweregrade `toast-info/warn/crit/ok` |
| **Designtokens** | `:root` Z. 206–291 | Farben, vier Schnittecken, drei Rahmenstärken, Typo-Skala – der Prototyp benutzt ausschließlich diese |

**Bewusst NICHT wiederverwenden:** `resolveBattlePhases` (Z. 19594) als Kampfausgang. Der Freiflug
ist Echtzeit; ein Würfelwurf über den Ausgang würde ihn entwerten. Die Funktion bleibt für die
Rundenkämpfe und taugt höchstens als Auto-Resolve-Notausgang (siehe 7.4).

---

## 2. Welche neuen Systeme gebraucht werden

Sieben Bausteine, die es heute in keiner Form gibt:

1. **Eingabeschicht** – Tastatur (Schub/Drehen/Nachbrenner), Maus (Ziel wählen, Rechtsklick-
   Autopilot), Touch (virtuelles Steuerkreuz links, Aktionsknöpfe rechts). Das Spiel hat bisher
   ausschließlich Klick-Bedienung; freies Fliegen ist eine neue Bedienart.
2. **Bewegungsmodell** – Schub, Trägheit, Dämpfung, Höchstgeschwindigkeit, Drehrate. **Wichtig:**
   Der Weltraum hat keine Reibung, das Spielgefühl braucht sie. Ohne Dämpfung driftet man ewig und
   trifft nie einen Asteroiden. Im Prototyp: `Math.pow(0.12, dt)` pro Sekunde.
3. **Freie kartesische Karte mit Kollision und Treffern** – die heutige Galaxiekarte ist SVG mit
   Knoten, kein Raum mit Objekten.
4. **Gegner-KI in Echtzeit** – acht Verhaltensweisen (Jäger, Panzer, Scharfschütze, Abfänger,
   Bomber, Schwarm, Elite, Boss). Vorbild ist die Geschützturm-Zielverfolgung Z. 30500 ff.
5. **Aktiver Abbau** – Bohrstrahl mit Fortschritt am Objekt, Energieverbrauch, Ertrag proportional
   zur geleisteten Arbeit statt als Einmalwurf.
6. **Ungesicherte Ladung** – ein zweiter Ressourcen-Topf, der bei Zerstörung teilweise verloren
   geht. Das ist der Kern des Risiko/Belohnungs-Systems und hat im heutigen Spiel keine Entsprechung
   (dort ist Beute ab Gutschrift sicher).
7. **Space-Ausrüstung** – ein drittes Modul-Inventar neben Standort- und Schiffsklassen-Modulen,
   nach demselben Muster, aber mit eigenen Wirkungskanälen (Bohrer, Scanner, Tarnung, Sprung).

---

## 3. Datenbank- und Spielstandsänderungen

### 3.1 Frontend-`state` (additiv, alte Spielstände bleiben gültig)

```js
state.freiflug = {
  schiffKey:'spaeher',            // aktiver Rumpf
  besitzt:{ spaeher:true },       // freigeschaltete Rümpfe (aus Bauplänen)
  fracht:{},                      // UNGESICHERTE Ladung – der Risiko-Topf
  module:[],                      // Instanzschlüssel wie state.shipModules
  ausgeruestet:{},                // schiffKey -> [instKey, ...]
  sektor:'heim', besuchte:{},     // Fortschritt auf der Sektorkarte
  statistik:{ ausfluege:0, verluste:0, abschuesse:0, gesichert:0 }
}
```

Alle Felder werden über `ensureFreiflug()` beim Laden lazy angelegt – dasselbe Muster wie
`ensureAbgrund()` (Z. 42094). **Kein Migrationsschritt nötig**, kein Feld verschwindet.

**Zwei Regeln, die nicht verhandelbar sind:**

* **`state.freiflug.fracht` ist NICHT `state.resources`.** Erst das Andocken bucht per
  `gainResources()` um. Solange die Ladung ungesichert ist, darf sie nirgends in Produktion,
  Punktestand oder Kosten einfließen.
* **Nichts aus der Physik darf ungerundet in `resources`/`credits`/`xp` landen.** Der Backend-
  Endpunkt lehnt bei NaN/Infinity/negativ den **gesamten** Spielstand mit HTTP 400 ab
  (`saveSanityViolation` server.js:2338, `numberOutOfRange` 2335) – und das friert das Speichern
  dauerhaft ein. Ein einziges `NaN` aus einer Kollisionsrechnung reicht. Deshalb bucht der
  Prototyp ausschließlich über eine Funktion, die rundet und klemmt.

### 3.2 Backend-`db`

Für Phase 1–3: **gar keine.** Der Freiflug läuft vollständig im Client; die Beute wird über den
bestehenden Spielstand (`kepler7-save-v3`) mitgespeichert.

Ab Phase 4 (Bestenliste, geteilte Sektoren) käme dazu:
* Ein Feld im bestehenden Broadcast `leaderboard:<id>` (`doSave()` Z. 39031–39109) – Vorbild
  `abgrundBest` Z. 39055 und `abgrundWoche` Z. 39059.
* Optional `db.shared['space:sector:<key>:<woche>']` für einen geteilten Sektor-Seed.

### 3.3 SAVE_SANITY_LIMITS

`state.freiflug` wird von `saveSanityViolation()` **nicht** geprüft (server.js:2320–2334 listet nur
`buildings`, `research`, Flotten, `resources`, `credits`, `prestige`, `xp`, `shipMarks`). Das ist
unkritisch. Wird Xenit später eine echte Ressource in `state.resources`, muss die Grenze dort
mitgezogen werden – der Vorfall vom 21.07.2026 (Speicherstopp durch zu enge Limits) ist die Mahnung.

---

## 4. Welche Backend-APIs gebraucht werden

**Kurz: für den spielbaren Kern keine.** Das ist keine Bequemlichkeit, sondern das Ergebnis einer
harten Grenze:

* **Kein WebSocket, kein SSE, kein socket.io** – die Suche über `server.js` liefert null Treffer.
  Alles läuft über HTTP-Polling.
* **`globalApiRateLimit` = 240 Anfragen/Minute pro IP** (server.js:158, aktiv ab 188). Ein Modus,
  der auch nur 1×/Sekunde pollt, verbraucht davon 60 – bei mehreren Tabs oder mehreren Spielern
  hinter einem NAT wird das eng.
* **Die feinste Server-Uhr ist `galaxyTick` alle 15 Minuten** (server.js:3641/4473).

**Folgerung: Ein echtzeit-synchronisiertes Multiplayer-Weltraumfeld ist mit dieser Architektur
nicht machbar** – und sollte auch nicht angestrebt werden. Machbar und gut vorbereitet ist:

> Die Freiflug-Sitzung läuft komplett im Client. Der Server vergibt vorher den Sektor-Seed und
> validiert hinterher **ein** Ergebnis. Andere Spieler erscheinen asynchron als „letzte bekannte
> Position" über `/api/players-map` (server.js:3018) und `db.shared` – als Geister, nicht live.

Wenn es später doch Server-Beteiligung braucht, exakt drei Endpunkte, jeweils **ein** Aufruf pro
Ausflug (nicht pro Sekunde):

| Endpunkt | Zweck |
|---|---|
| `POST /api/freiflug/start` | Sektor-Seed + Ausflug-Token ausgeben, Startzeit vermerken |
| `POST /api/freiflug/ende` | Ergebnis melden; Server prüft Plausibilität (Beute ≤ Laderaum × Zeit × Sektorfaktor) und bucht |
| `GET /api/freiflug/bestenliste` | Wochenwertung |

**Sicherheitsfalle, die dabei zwingend zu beachten ist:** Die fünf Rechteprüfungen des generischen
Speichers (`checkAllianceKeyPermission` server.js:610 u. a.) geben `null` = *erlaubt* zurück, wenn
der Schlüssel ihr Muster nicht trifft (server.js:612, 845). Ein neuer Präfix `space:*` in `db.shared`
wäre damit **für jeden eingeloggten Nutzer les- und schreibbar**. Er braucht eine sechste
Prüffunktion, verdrahtet an **beiden** Aufrufstellen (server.js:1685 und 1717) und zusätzlich in
`/api/storage-list` (1837–1846). Das steht so auch in der Backend-CLAUDE.md und ist genau der Fehler,
den man einmal macht.

---

## 5. Frontend-Komponenten

| Baustein | Art | Anmerkung |
|---|---|---|
| `#freiflugOverlay` | Vollbild-Overlay | Muster `.battle-modal-overlay` (CSS 450–518). Darunter drosselt `anzeigeVerdeckt()` den Haupttick – deshalb Overlay und **nicht** ein 13. Tab |
| `#freiflugCv` | Canvas | Einzige Spielfläche. Kein DOM pro Objekt |
| HUD-Boxen | DOM über dem Canvas | Zone, Schiffszustand, Laderaum, Ziel, Protokoll, Minikarte. Schreiben nur bei Textänderung neu (Prototyp: `setzeText`, dasselbe Prinzip wie `setBoxHtml`) |
| Hangar | Overlay | Rümpfe, Module, Sets, Koloniespeicher, Steuerung. Klicks **delegiert**, weil die Karten neu geschrieben werden |
| Sektorkarte | Overlay | Übersicht; gesprungen wird im Flug am Tor, nicht von hier |
| Ergebnistafel | Overlay | Andocken und Zerstörung – die einzigen zwei Stellen, an denen sich der Kontostand ändert |
| Einstiegspunkt | Knopf im Flotte-Tab | „Selbst ausfliegen" neben der Werft |

**Ein Fallstrick aus der Hausregelliste greift hier direkt:** Jeder Bedienzustand, der nur im DOM
steckt, überlebt das Neuzeichnen nicht. Im Freiflug liegt der gesamte Spielzustand ohnehin in
JS-Objekten und wird pro Bild neu gezeichnet – aber die HUD-Boxen und der Hangar sind DOM und
brauchen die bekannten Schutzmuster (`detailsOpenAttr`, delegierte Klicks).

---

## 6. Wie die Schiffsteuerung technisch umgesetzt wird

**Schleife.** Eine eigene `requestAnimationFrame`-Schleife, unabhängig vom 1-Sekunden-Haupttick,
nach dem Vorbild Z. 32095–32164:

```js
let schleifeGen = 0;                     // Generationsmarke gegen Doppelschleifen
function starteSchleife(){
  const meine = ++schleifeGen;
  requestAnimationFrame(function bild(ts){
    if (meine !== schleifeGen) return;   // eine alte Schleife stirbt hier
    requestAnimationFrame(bild);
    let dt = (ts - letzteZeit)/1000; letzteZeit = ts;
    if (dt > 0.05) dt = 0.05;            // Tabwechsel darf keinen Zeitsprung schlagen
    if (!pause && !document.hidden) schritt(dt);
    zeichnen();
  });
}
```

Der dt-Deckel ist kein Schönheitsfehler-Fix: Ohne ihn springt ein Schiff nach einem Tabwechsel durch
die halbe Karte, an Gegnern und Wänden vorbei. Die Generationsmarke verhindert, dass ein zweiter
Start zwei Schleifen nebeneinander laufen lässt – derselbe Fehler, den `weiterlaufen()` schon einmal
lösen musste.

**Bewegung.** Schub in Blickrichtung, exponentielle Dämpfung, Geschwindigkeitsdeckel:

```js
p.winkel += drehEingabe * v.dreh * dt;
p.vx += Math.cos(p.winkel) * v.schub * schubEingabe * dt;
const reibung = Math.pow(0.12, dt);  p.vx *= reibung;  p.vy *= reibung;
```

`v.schub`, `v.dreh` und `v.maxTempo` kommen aus derselben Kette wie im Hauptspiel:
Rumpfwert × Modulbonus × (später) Werftmarke – `effectiveShipSpeed` (Z. 22085) ist das Vorbild.

**Zielen.** Eine erfasste Waffe folgt dem Ziel innerhalb eines **Schwenkkegels**; darüber hinaus
muss der Spieler das Schiff drehen. Der Wert ist gemessen, nicht geraten: Bei ±0,55 rad verfehlte
ein umkreisender Gegner dauerhaft (8 s Dauerfeuer brachten einen Piratenjäger nur von 146 auf 114
Hüllenpunkte). ±1,15 rad ist derselbe Wert, den die Kampf-Wiedergabe ihren Geschütztürmen zugesteht
(Z. 30517–30520).

**Zeichnen.** Für die erste Fassung reicht direktes Pfadzeichnen der Rümpfe (der Prototyp trägt so
30+ Objekte pro Bild flüssig). Sobald Schwärme mit 50+ Einheiten dazukommen, wird auf die
Atlas-Technik umgestellt: `backeSpielAtlas` (Z. 29014) backt das echte Spiel-Schiffsbild in 32
Drehlagen, `zeichneSchiff` (Z. 29189) blittet es mit einem `drawImage`. Das trägt laut Kommentar
dort „über tausend Rümpfe pro Bild".

**Kontext-Taste.** Eine Taste für Abbauen, Plündern, Untersuchen, Andocken. Die Auswahl läuft in
**zwei Stufen: erst Rang der Art, dann Abstand.** Reiner Abstandsvergleich war falsch und ist im
Test aufgefallen: In dichten Feldern liegt regelmäßig ein Asteroid näher als die Anomalie, die man
ansteuern wollte – die Taste baute dann Erz ab, statt das einmalige Fundstück auszulösen. Einmalige
Interaktionen schlagen deshalb den beliebig wiederholbaren Abbau.

**Mobil.** Linke Bildschirmhälfte ist ein virtuelles Steuerkreuz (Richtung + Stärke aus dem
Fingerversatz, weiter Zug = Nachbrenner), rechts liegen Feuer und Aktion. `@media (pointer: coarse)`
hebt die Ziele auf 44 px, wie im Rest des Spiels.

---

## 7. Wie sich der Kreislauf ins bestehende Spiel einfügt

### 7.1 Der Einstieg
Im Flotte-Tab neben der Werft: **„Selbst ausfliegen"**. Öffnet das Vollbild-Overlay. Die Kolonie
tickt darunter normal weiter – Produktion, Bau, Forschung laufen, nur ihr Neuzeichnen ruht
(`anzeigeVerdeckt`). Wer den Freiflug schließt, kommt in ein Spiel zurück, das die Zeit über
gearbeitet hat. Das ist wichtig: Der Freiflug darf sich nie anfühlen, als koste er Idle-Fortschritt.

### 7.2 Die Rückkopplung in die Kolonie
Der Freiflug ist kein zweites Spiel, weil er in **dieselben Töpfe** liefert:

```
Freiflug: Erz, Kristalle, Deuterium, Antimaterie  ->  gainResources()  ->  Gebäude, Forschung, Schiffe
Freiflug: Modulfragmente                          ->  state.moduleFragments  ->  bestehende Werkbank
Freiflug: Xenit (neu)                             ->  eigener Topf     ->  Space-Rümpfe und -Module
Freiflug: Baupläne                                ->  neue Rümpfe im Hangar
Kolonie:  Deuterium                               ->  Sprungtore       ->  tiefere Sektoren
Kolonie:  Werftmarken/Forschung                   ->  bessere Freiflug-Werte
```

Die Richtung ist bewusst wechselseitig: Die Kolonie bezahlt die Sprünge (Deuterium), der Freiflug
bezahlt den Ausbau. Wer nur idlet, kommt nicht in den Leerensaum; wer nur fliegt, hat keine
Reichweite.

### 7.3 Die Risiko-Entscheidung
Ladung im Laderaum ist **ungesichert**. Andocken bucht sie um und setzt das Schiff instand;
Zerstörung kostet die Hälfte (im Prototyp gemessen: 38 an Bord → 19 gerettet). Das erzeugt genau die
Frage aus dem Auftrag: *heimfliegen oder noch ein Feld weiter?* Der Schürferbund-Set-Bonus
(4 Teile: nur die Hälfte geht verloren) ist die erste Antwort darauf, die man sich erspielen kann.

### 7.4 Was NICHT passieren darf
* **Kein PvP im Freiflug**, solange der Server nichts nachrechnet. Die Kampfkraft im Freiflug ist
  rein clientseitig – ein manipulierter Client könnte sonst echte Spieler schädigen. Die Hausregel
  der PvP-Parität (keine client-only `atk`-Quellen, Kommentare Z. 20298–20301, 21733–21736) gilt
  hier als **Abgrenzung**: Freiflug-Werte wirken nur im Freiflug, wie die Tiefenflotte im Abgrund.
* **Keine „N Minuten eigene Produktion"-Belohnungen.** Diese Formelfamilie ist in CLAUDE.md als
  explosiv markiert. Freiflug-Beute hängt an Asteroidentabellen und Sektortiefe, nie an der eigenen
  Wirtschaft.
* **Kein Auto-Resolve als Normalweg.** Ein „Ausflug überspringen"-Knopf mit `resolveBattlePhases`
  würde das aktive Spiel sofort entwerten. Falls er je kommt, dann mit klar schlechterem Ertrag.

---

## 8. Reihenfolge der Umsetzung

**Phase 1 – Vertical Slice (ist im Prototyp fertig und gemessen).**
Sektor, Schiff, direkte Steuerung, Asteroiden, Abbau, Laderaum, Rückkehr zur Station.
*Beleg:* `tests/test_freiflug.js`, 42 Prüfungen, Gegenprobe mit sechs Sabotagen.

**Phase 2 – Kampf und Beute (im Prototyp enthalten).**
Acht Gegner-Verhaltensweisen, Geschosse, Schilde mit Nachladepause, Wracks mit Fallen, Beutebrocken
mit Magnetwirkung, Modul-Inventar.

**Phase 3 – Welt (im Prototyp enthalten).**
Fünf Sektoren mit Zonencharakter, Sprungtore mit Deuteriumkosten, sechs Anomalietypen, neun
Zufallsereignisse, Piraten und Alien-Gebiete, NPC-Frachter mit Rettungsprämie, Nester.

**Phase 4 – Endgame (im Prototyp angelegt).**
Fünf Rümpfe, drei Sets mit Teilstufen, Alien-Nester, Boss (`leere_koloss`, 6.200 Hüllenpunkte).

**Phase 5 – Einbindung (steht aus, das ist die eigentliche Arbeit).**
Der Prototyp beweist das Spielgefühl. Für die Spieldatei kommt hinzu:
1. `state.freiflug` mit `ensureFreiflug()` anlegen, Beute über `gainResources()` buchen
2. Overlay in die Spieldatei einsetzen, Einstieg im Flotte-Tab, `anzeigeVerdeckt` mitnutzen
3. Modul-Inventar an die vorhandene Werkbank hängen (`isShip`-Flag-Familie erweitern)
4. `HERKUNFT_FREIFLUG` in `fundPool` eintragen, damit Space-Loot nicht in Markt/Expeditionen leckt
5. Xenit in `costAmountAvailable`/`pay`/`miniResIcon`/`resDefFor` verdrahten, Icon in `RES_ICONS`
6. HELP_SECTIONS und TUTORIAL_STEPS ergänzen, VERSION + Patchnotes, `build-patchnotes.js`
7. Auf Atlas-Sprites umstellen, sobald Schwarmgegner in Menge auftreten

**Aufwandsschätzung Phase 5:** Punkte 1–3 sind der Löwenanteil, weil sie die Werkbank berühren –
und die ist an fünf Stellen mit `isShip` verzweigt. Punkt 4–5 sind je eine knappe Stunde, Punkt 6
ist Pflicht und schnell, Punkt 7 erst nötig, wenn es ruckelt.

---

## 9. Was der Prototyp bereits belegt (gemessen, nicht behauptet)

| Frage | Messung |
|---|---|
| Fühlt sich die Steuerung direkt an? | Schub 0 → 244 Einheiten/s in 0,8 s, Reibung baut auf 35 ab; Höchstgeschwindigkeit wird eingehalten |
| Funktioniert aktiver Abbau? | 1,8 s Bohren = 54 Einheiten Erz; Laderaum füllt auf exakt 219/220 und deckelt dort auch bei weiterem Bohren |
| Trägt der Extraktions-Kreislauf? | 219 Einheiten an Bord → Andocken → 219 im Koloniespeicher, Laderaum leer, Hülle instandgesetzt |
| Greift das Risiko? | 38 an Bord, Zerstörung → 19 gerettet, Koloniespeicher unangetastet |
| Ist Kampf gewinnbar und gefährlich? | Späher tötet einen Piratenjäger in 4,8 s; im Riff fällt sein Schild in 6 s von 123 auf 0 |
| Lösen alle Fundstücke aus? | Alle 6 Anomalietypen, alle 9 Ereignisse, Wrackplünderung mit Falle – 0 Konsolenfehler |
| Zählen Set-Stufen additiv? | 1 Teil: +0,400 · 2 Teile: +0,550 (Modul 0,400 + Set 0,150) · 3 Teile: zusätzlich +0,200 Glück |
| Läuft es sauber? | 42 Prüfungen grün, keine Konsolenfehler in keinem Sektor |

---

## 10. Offene Fragen, die vor der Einbindung zu entscheiden sind

1. **Xenit als echte Ressource oder eigener Topf?** Der Prototyp führt ihn als eigenen Topf (Vorbild
   `state.abgrund.bergung`). Als `state.resources`-Eintrag bräuchte er Lagerdeckel, Produktionsrate
   und einen Blick auf `RES_DEFS` – das Array wird an über zehn Stellen als „die sechs
   produzierbaren" gelesen (Kommentar Z. 4255–4261), ein Eintrag dort erzeugt NaN.
2. **Eigene Rümpfe oder bestehende Schiffe?** Der Prototyp hat fünf eigene. Alternative: vorhandene
   `SHIP_DEFS`-Einträge fliegbar machen. Dagegen spricht, dass dort ein `cargo`-Feld pro Schiff
   fehlt (es gibt nur zwei Frachter-Konstanten, Z. 17811/17812).
3. **Zeitbegrenzung je Ausflug?** Ohne sie kann man beliebig lange draußen bleiben. Eine
   Treibstoffuhr wäre die naheliegende Bremse und würde Deuterium weiter aufwerten.
4. **Bestenliste?** Erst sinnvoll mit serverseitiger Plausibilitätsprüfung – sonst ist sie am ersten
   Tag manipuliert.
