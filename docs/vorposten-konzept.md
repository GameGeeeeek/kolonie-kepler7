# Vorposten / Außenposten (B2) — Konzept

*Entscheidungsgrundlage für Sascha, kein Umsetzungsplan. Jede Zahl ist entweder gemessen (mit
Konstanten-/Funktionsnamen und Zeile belegt) oder ausdrücklich mit **ACHTUNG: vor Bau messen**
markiert. Stand: Datei `weltraum_kolonie.html` hat sich seit den älteren Konzepten verschoben —
alle Zeilennummern hier sind am aktuellen Stand nachgemessen (28.08.2026).*

---

## 0. Zwei getrennte Entscheidungen, nicht eine

Dieses Konzept legt Sascha **zwei** offene Fragen vor, die orthogonal zueinander sind. Beide
bestimmen mit, wie teuer der Bau wird. Sie werden bewusst getrennt geführt, weil der erste Entwurf
sie stillschweigend zusammengelegt und dabei die falsche Antwort gegeben hat:

1. **§3 — Der Ablageort:** Ist der Vorposten reiner NUTZEN (Zustand im Spielstand, kein Backend),
   ein echtes PvP-ZIEL (`db.shared`, volle Härtung) oder PvE-anfechtbar (`db.galaxy`)?
2. **§4 — Der Nutzen-Kanal:** Was TUT der Vorposten — verkürzt er Flugzeit (Sprungknoten),
   liefert er einen Scan, eine Produktion oder eine Stationierung/Garnison? **Diese Wahl entscheidet
   mit über die PvP-Relevanz** (§4.2) und darf deshalb nicht als bereits getroffen behandelt werden.

Der erste Entwurf hat aus „der Nutzen ist Flugzeit, und Flugzeit ist PvP-frei" die ganze Architektur
(kein Backend, keine Parität, kein Schalter) abgeleitet — beides ist **gemessen falsch** (§4.2). Der
korrigierte Stand steht in §3 und §4.

---

## 1. Die Idee in einem Satz — und die Abgrenzung

**Ein Vorposten ist eine persistente, eigene Struktur, die der Spieler in einem fremden
(Nicht-Heimat-)System baut und HÄLT — die erste spielergebaute Präsenz auf der Karte jenseits von
Kolonie und Allianzbasis.** Vorbild ist die Allianzbasis (`allianceBaseModelSvg`, Z. 45555;
Kartenzeichnung Z. 59149 ff): eine dauerhafte, angreifbare, ausbaubare Struktur mit eigenem
Kartenknoten.

### Duplizieren wir etwas? — gemessen, nicht vermutet

- **E2 (Statthalter):** ein *benanntes NPC-Kartenziel*. Ein Vorposten ist ein *spielergebautes*
  Objekt — die Karte trägt heute **kein einziges** außer der Allianzbasis (früher fester
  `translate`, seit KB-20c abgeleitete Bahn). Keine Dopplung.
- **A2 (wandernde Beute-Ziele):** doppelt das Nest der Nomaden von Vex und E2; ein Vorposten steht
  fest und gehört mir. Verschiedene Sache.
- **E3 (Sprungnetz):** **Hier liegt die echte Überschneidung, und sie ist eine Chance, keine
  Kollision** — aber nur, wenn der Nutzen-Kanal Flugzeit wird (§4). E3 baut
  `state.sprungbaken = { <sysId>:{seit} }`, `SPRUNGBAKEN_MAX = 3`, und rechnet einen
  `sprungnetzMult(targetSystem)` in `missionDurationFor` (Z. 25085). Ein Flugzeit-Vorposten IST ein
  Sprungknoten — nur reicher: ein Ort mit Identität, Modell, Ausbau, statt eines nackten
  `{seit}`-Eintrags. **Empfehlung: E3 nicht als eigenes `sprungbaken`-Feld bauen, sondern der
  Vorposten TRÄGT den Sprungnetz-Effekt.** Sonst entsteht „ein zweites System neben einem
  vorhandenen" (die dokumentierte Fehlerklasse der Bonusgruppen). E3s Festlegungen
  (`SPRUNGBAKEN_MAX = 3`, kein Protomaterie-Rückerhalt) werden dann zum Rahmen des Vorpostens.

**Kurz:** B2 ergänzt E2–E5, wenn es den einen Nutzen bündelt, den heute niemand auf der Karte hat —
eine gehaltene Präsenz mit spürbarem Effekt. Es dupliziert nur dann, wenn es zusätzlich einen
zweiten Sprungbaken-Kanal baut.

---

## 2. Spielablauf aus Spielersicht

1. Der Spieler öffnet ein fremdes System auf der Karte, sieht im Kartenmenü einen Eintrag
   **„Vorposten errichten"** (nur wenn nicht Heimatsystem, nicht Kolonie, kein fremder Vorposten
   dort — analog zur Sichtbarkeitsbedingung der Allianzbasis Z. 59149 ff; bei Option B/C liest die
   „kein fremder Vorposten dort"-Bedingung den GETEILTEN Zustand, nicht nur `state.vorposten`, §5.7).
2. Er startet dazu eine **Rundflug-Mission** (Baukolonne fliegt hin, errichtet, kommt zurück — Form
   A, siehe §6), zahlt Baukosten (§3/§6). **Der erfolgreiche Bau schreibt einen Bericht** (§6), damit
   auch der offline zurückkehrende Spieler vom Ergebnis erfährt.
3. Ab dann steht ein **eigener Kartenknoten** im System (`data-map-vorposten`), Abzeichen in der
   Sektor-/Regionsübersicht (§5). Das Kartenmenü zeigt Stufe, Nutzen, Ausbau, ggf. Kern-LP.
4. **Der Nutzen wirkt automatisch** — je nach gewähltem Kanal (§4): verkürzte Flugzeit für Missionen
   ins Umfeld (Sprungknoten), oder ein Scan-/Produktions-/Stationierungsvorteil.
5. **Halten:** Der Vorposten bleibt, bis der Spieler ihn **aufgibt** (§9 — mit Rückfrage, nach dem
   `baustelleAufraeumen`/`mining-recall`-Muster) oder, falls anfechtbar (Saschas Entscheidung §3),
   bis ein Angreifer ihn schleift. Ausbau erhöht Nutzen und Verteidigung.
6. Wird er angefochten (nur in der PvP-Variante), sieht der Verteidiger eine Vorwarnung
   (Muster der `incomingmuster`-Phase der Allianzbasis) und kann mit **Stationierung** gegenhalten —
   das ist eine eigene, zweiteilige Missionsfamilie mit eigener Allowlist-Pflicht (§6, §8).

---

## 3. DIE ERSTE KERN-ENTSCHEIDUNG — Ablageort + „Können ANDERE angreifen?"

**Das ist Saschas Entscheidung und wird hier NICHT still gewählt.** Sie zerfällt in EINE Frage mit
drei Architekturen; alles andere (Karte, Mission, Bericht) folgt daraus.

Die verteidigte Grenze des Projekts: **„Kann ich etwas anfassen, das ANDEREN gehört oder allen
gemeinsam?"** Der eigene Spielstand ist bauartbedingt klientenautoritativ und nur gegen
`SAVE_SANITY_LIMITS` geprüft (server.js, großzügig) — er darf nur tragen, was **ausschließlich mich**
betrifft.

### Option A (Empfehlung, MIT Vorbehalt aus §4.2) — Vorposten als reiner NUTZEN, Zustand im Spielstand

`state.vorposten = { <sysId>: { seit, stufe } }`. Frontend-rein, kein Backend.

- **Gemessene Folge — wann Option A trägt:** Ein reiner Nutzen ohne Anfechtbarkeit braucht kein
  Backend, keinen Schalter, keine Parität, **solange der Nutzen-Kanal nachweislich PvP-frei ist.**
  Das ist NICHT automatisch der Fall (§4.2) und muss je Kanal einzeln belegt werden — der erste
  Entwurf hat das für „Flugzeit" behauptet und es ist gemessen falsch.
- **Solo funktioniert vollständig** (`useBackend()`, Z. 4418 ist irrelevant — nichts liegt im
  geteilten Speicher).
- **Preis:** fälschbar (aber es gibt nichts zu holen, was nicht ohnehin über den Spielstand
  offensteht), und **andere können ihn nicht anfassen** — es ist keine gemeinsame Karte, jeder sieht
  nur seine eigenen Vorposten.
- **Warum trotzdem Empfehlung:** Ist der Nutzen ein Flugzeit-Vorteil, der **auf Nicht-PvP-Missionen
  gegated** wird (§4.2, Weiche (i)), bleibt Option A frontend-rein und ist die billigste, solo-fähige,
  deploy-unabhängige Fassung. Der Deploy-Zwang (13 dokumentierte Ausfälle) entfällt. Das ist E3
  „Sprungnetz", nur als benanntes Objekt.

### Option B — Vorposten als echtes PvP-ZIEL, Zustand in `db.shared`

Schlüssel z. B. `outpost:<uid>:<sys>` (Dokument) + `outpostwar:<uid>:<sys>` (Kriegszustand), Muster
der Allianzbasis (`alliance:<TAG>:base` + `basewar`).

- **Gemessene Folge:** `db.shared` ist über `PUT /api/storage/:key?shared=true` für **jeden**
  eingeloggten Nutzer offen (lesen UND schreiben). Ohne Sonderregel manipuliert jeder Beliebige den
  Wert auf null. Jeder neue Unterschlüssel braucht eine explizite Zeile in
  `checkAllianceKeyPermission` (server.js:802) bzw. einer äquivalenten Funktion.
- **Drei Fallen, alle an der Allianzbasis belegt:**
  1. **Offener Grundzustand** — der `base`-Zweig (server.js:976–983) sperrt Nicht-Mitglieder, prüft
     aber den **Wert nicht** gegen echte Beiträge (Kommentar dort: „granuläre Prüfung … fehlt hier
     noch"). Ein Vorposten muss sein **Level serverseitig neu rechnen** (Muster
     `allianceMusterBaseLevel`); die Verteidigungsstärke darf nie aus dem Client-Wert kommen.
  2. **`allianceRoleOf`-Verkettung** (server.js:424): `db.shared['alliance:'+tag+':role:'+userId]` —
     mit `tag===null/undefined` entsteht wörtlich `alliance:null:role:<uid>`, ein anlegbarer
     Fake-Rolleneintrag. Behoben wird das im Muster **durch Verzweigung DAVOR**, nicht durch eine
     Null-Prüfung (siehe `/api/musterattack/resolve` bei `zielArt==='alien-nest'`). Ein Vorposten,
     der Rechte prüft, darf `allianceRoleOf` NIE mit potenziell null/undefined `tag` aufrufen.
  3. **Angriff nur über dedizierte Endpunkte** (`/api/basedamage/solo` server.js:8115,
     `/api/musterattack/resolve` 7844) — die generische Storage-Route schreibt Kriegszustand nie
     (`basewar`/`incomingmuster` server.js:1020 komplett gesperrt). Der Server rechnet Angriffskraft
     und Verteidigung SELBST (`computeAttackPowerFromComposition`, `computeDefensePower`), nimmt
     keinen Kampfparameter aus dem Body.
- **Folge:** echtes Spieler-gegen-Spieler-Ziel, aber **Backend-PR + Schalter + Paritätstest +
  Rechteprüfung** Pflicht. Solo existiert der Vorposten dann nur mit Server; für Solo braucht der
  Nutzen einen Frontend-Rückfall (zweite Wahrheit → eigener Paritätstest).
- **Zusätzliche Pflicht für B:** die Stationierungs-Mission des Verteidigers (§6) UND das Rendern
  **fremder** Vorposten auf der Karte (§5.7).

### Option C — PvE-anfechtbar, Zustand in `db.galaxy`

Nur der Server schreibt (über dedizierte Endpunkte); server-gesteuerte Angreifer (Piraten/Aliens)
könnten den Vorposten bedrohen, **kein Spieler-gegen-Spieler**.

- **Gemessene Folge:** `db.galaxy` ist über `PUT /api/storage` gar nicht erreichbar;
  `galaxyFuerClient()` (`Object.assign`) schickt jedes Feld automatisch lesend an den Client. So
  liegen die Alien-Nester (`db.galaxy.alienNester`). **PvE-sicher by design**, umgeht die ganze
  offene-Shared-Storage-Fehlerklasse.
- **Preis:** Bauen/Halten braucht dedizierte Endpunkte (Client kann via Storage nichts anlegen);
  „eigene Präsenz gegen andere Spieler" fällt weg. Passt, wenn der Reiz „Vorposten gegen die
  wachsende Alien-/Piratenbedrohung verteidigen" sein soll, nicht „gegen Rivalen".

### Empfehlung, klar getrennt

- Ist der Vorposten **Nutzen ohne Anfechtbarkeit** und ist der Nutzen-Kanal PvP-frei gated (§4.2)
  → **Option A**. Am billigsten, solo-fähig, deploy-unabhängig.
- Will Sascha ausdrücklich, dass **andere Spieler** ihn angreifen → **Option B**, mit voller
  Backend-Härtung, Stationierungs-Mission und Fremd-Rendering.
- Will Sascha ihn **anfechtbar, aber nur durch die Welt** (Aliens/Piraten) → **Option C**.

**Die Wahl zwischen „nur Nutzen" (A) und „echtes PvP-Ziel" (B/C) gehört Sascha und bestimmt die
teurere Hälfte der Umsetzung.**

---

## 4. DIE ZWEITE KERN-ENTSCHEIDUNG — Welcher Nutzen-Kanal?

Der Nutzen-Kanal ist **orthogonal** zur A/B/C-Frage und mindestens genauso folgenreich: Er entscheidet
mit über die PvP-Relevanz und damit darüber, ob „kein Backend" (Option A) überhaupt gilt. Deshalb ist
er hier als eigene, ausdrücklich offene Entscheidung geführt — nicht still auf Flugzeit verengt.

### 4.1 Die vier Kanäle, je mit Anker, Bezugsgröße und PvP-Frage

| Kanal | Rechenstelle (Anker) | Bezugsgröße | PvP-Frage | Stand |
|---|---|---|---|---|
| **Flugzeit** (Sprungknoten) | `missionDurationFor` (Z. 25085), Faktor wie `sektorFlugMult` | Sekunden je Mission ins Umfeld | **berührt PvP** — moon-siege/asteroid-contest übergeben `targetSystem` (§4.2) | **gemessen**, Weiche in §4.2 |
| **Scan** | **ACHTUNG: vor Bau messen** — keine bestehende Rechenstelle identifiziert; berührt vermutlich `state.spyIntel` (ausgespähte Spieler) | Aufklärungs-Reichweite/-Genauigkeit | **wahrscheinlich PvP** (fremde Spielerdaten) → Option B | **nicht gemessen** |
| **Produktion** | `ratesPerSecond` (Rohstoff-Zweig, Muster `sektorBonus`) | Rohstoffe/s | PvP-frei (Server rechnet Produktion nicht nach) — ABER Regel 41: gegen die Wirtschaft kalibrieren | **nicht gemessen** |
| **Stationierung / Garnison** | `defensePower(planetKey)` am Vorposten-Standort | Verteidigungswert | **PvP** (verändert Kampfausgang) → Option B, Backend-Parität | **nicht gemessen** |

**Wichtig:** Nur der **Flugzeit**-Kanal ist gemessen. Für Scan, Produktion und Stationierung sind
Ankerpunkt, Bezugsgröße und Kalibrierung **ACHTUNG: vor Bau messen**. Die „kein Backend"-Empfehlung
von Option A gilt **nicht** kanalunabhängig: Ein Stationierungs- oder Scan-Vorposten berührt fremden
bzw. gemeinsamen Zustand und kippt damit von A nach B (siehe Zeile „PvP-Frage").

### 4.2 Der Flugzeit-Kanal ist NICHT „PvP-frei by construction" — die Weiche

Der erste Entwurf stützte die ganze Option-A-Empfehlung auf einen Satz: „Ein Zielsystem-Faktor
erreicht PvP per Konstruktion nicht." **Gemessen ist das falsch.** Er stimmt nur für die zwei
Missionen, die tatsächlich OHNE `targetSystem` rufen:

- `sendPlayerAttackMission` (Z. 33154): `missionDurationFor(baseDur, attackFleet, ATTACK_SHIP_KEYS)`
  — **kein** 4. Argument. Hier greift kein Zielsystem-Faktor.
- `sendSpyMission` (Z. 33033): `missionDurationFor(baseDur, {...}, ['spaeher','spionageschiff'])`
  — ebenfalls kein `targetSystem`.

Es gibt aber **mindestens zwei weitere Spieler-gegen-Spieler-Missionen, die `targetSystem` SEHR WOHL
übergeben** (gemessen):

- **Mondbelagerung `moon-siege`** (Z. 54560):
  `missionDurationFor(sameSys ? 600 : 2400, compo, ['mondzerstoerer'], targetMoon.system)` — Angriff
  gegen `targetPlayerId`, `moondefense`-Namensraum, `/api/moonsiege/resolve`.
- **Asteroiden-Anfechtung `asteroid-contest`** (Z. 14650/14679/14739/14784):
  `missionDurationFor(asteroidFlugBasis(a.system), flotte, ATTACK_SHIP_KEYS, a.system)` — Kampf gegen
  den fremden Schürfrecht-Halter.

`sektorFlugMult(sysId)` gibt bei falschem `sysId` genau 1 zurück (Z. 14159:
`const sk = sysId ? … : null; return 1 - ((sk && sk.mod && sk.mod.flug) || 0);`). Ein neuer,
`targetSystem`-gekeyter Vorposten-Faktor mit demselben `!targetSystem → 1`-Guard **erreicht damit
`moon-siege` und `asteroid-contest`** — also PvP. Eine schnellere Ankunft heißt weniger
Reaktionsfenster für den Verteidiger; bei `moon-siege` hängt an der Abklingzeit Taktik. Die Prämisse
„der Flugzeit-Nutzen ist PvP-frei" hält damit **nicht**.

**Die Weiche gehört Sascha vorgelegt, nicht still aufgelöst:**

- **(i) — Empfehlung: Der Effekt wird auf NICHT-PvP-Missionstypen gegated.** Der Vorposten-Faktor
  wirkt nur auf Erkundung, Kolonisierung, Bergbau, eigene Expeditionen — nicht auf `moon-siege`,
  `asteroid-contest`, `player-attack`, `spy`. Damit bleibt Option A frontend-rein, **aber der Kanal
  muss die Missionstypen kennen** (nicht nur `targetSystem`), und ein Test muss festhalten, dass
  `moon-siege`/`asteroid-contest`-Flugzeiten mit und ohne Vorposten IDENTISCH bleiben (§10).
  Folge: Der Faktor wird NICHT generisch in `missionDurationFor` eingehängt, sondern nur an den
  gegateten Aufrufstellen bzw. hinter einer Typprüfung — genau dort liegt die Baubedingung, die der
  erste Entwurf verschwiegen hat.
- **(ii) — Der Effekt darf PvP anfassen.** Dann ist die Flugzeit eine PvP-relevante Größe, und
  **Backend-Parität wird Pflicht** — die teure Hälfte, die Option A gerade vermeiden wollte. Damit
  kippt B2 faktisch zu Option B.

**Die harte Bau-Bedingung für Weiche (i):** Der Nutzen wird als `vorpostenFlugMult(targetSystem, typ)`
implementiert, gibt `1` zurück, wenn `typ` eine PvP-Missionsart ist ODER `targetSystem` fehlt, und
wird an denselben Nicht-PvP-Aufrufstellen eingehängt. Wird er stattdessen als flottenweiter
`mult *= vorpostenFactor` ohne Typprüfung gebaut — was bei „Sprungknoten" naheliegt —, erreicht er
Angriff und Spionage sehr wohl. **Der Test (§10) belegt die Gegenrichtung: ein Faktor auf `mult`
global → PvP-Flugzeiten ändern sich → Test fällt.**

---

## 5. Karten-Wirkung

Alle Stellen in `weltraum_kolonie.html`. Vorbild = Alien-Nest (macht alle SECHS Schritte sauber),
Bahn-/Rand-Behandlung = Allianzbasis (Z. 59149 ff).

1. **Abzeichen** in `karteSystemBadges` (drei Anzeigestellen: Regionsübersicht, Sektoransicht,
   Nachbarpunkte in `buildGalaxyMap`). Neuer `badges.push({icon,title})`-Block **innerhalb des
   `if (karteEbeneAn('ereignisse'))`-Gates**. Icon: ein Emoji (z. B. 🛰), **kein `ti-*`** — das
   Subset hat 69 Glyphen, `check-icons.js` schlüge sonst an. ACHTUNG: bei mehreren Vorposten in
   einem System EIN Abzeichen mit Zahl, nicht mehrere nebeneinander.
2. **Marker auf abgeleiteter Bahn** (Muster `nestMarkerXY` / Allianzbasis Z. 59149 ff):
   `rx = kbOrbitRx(kbMaxOrbit) * FAKTOR`, fester Winkel, `ry` runder als die Planetenbahn
   (`Math.max(0.60, kbOrbitMass().ry)`), NIE ein fester Punkt. **ACHTUNG: FAKTOR und Winkel vor Bau
   messen** — Portal nutzt 0,92 bei 325°, Allianzbasis 0,80 bei 205°; ein Vorposten braucht einen
   Winkel, der weder Portal (325°) noch Basis (205°) trifft, sonst drängen sich die großen
   Strukturen am selben Rand.
3. **Kollisionsschieber `kbMarkerFrei(pos, planeten, sonnenR, markerR, belegt, maxRadius)`
   (Z. 58148)** + Anmeldung in `platzierteMarker`:
   - `markerR` ist der **SICHTBARE** Radius (inkl. Glüh-/Pulsring), nicht der Zeichenradius — die
     Allianzbasis übergibt 30 (Level-10-Glühring), nicht ihren Zeichenradius.
   - Für eine feste Bahn nahe dem Rand den 6. Parameter mitgeben:
     `maxRadius = kbOrbitRx(kbMaxOrbit) + 34 − markerR` (Allianzbasis: `+34−30`) — sonst schiebt der
     Schieber aus dem Bild (KB-20h: 14/138 Basen lagen außerhalb).
4. **`class="planet-node"`** an der `<g>`-Gruppe ⇒ Label-Entflechtung (`kbLabelsEntflechten`) erbt
   der Marker automatisch. AUSNAHME: trägt die Gruppe eine `scale`-transform (wie das Portal), darf
   sie die Klasse NICHT tragen (`getBBox()` ignoriert die transform, meldet ~3× zu große Fläche).
5. **Kartenmenü** `openKarteMenu(ev, art, titel, eintraege, infoHtml)` (Muster `nestMapMenu`),
   `data-map-vorposten` verdrahten UND in die Außenklick-Ausnahme aufnehmen (sonst schließt der
   Öffnungsklick das Menü sofort). LP als `kartenFuellBalken` in der Zeile, nicht im Balken.
6. **`karteAuffangSignatur` (Z. 56470) — der oft übersehene sechste Schritt.** Die Funktion ist der
   Cache-Riegel des Karten-Neubaus: JEDES veränderliche Kartenobjekt hat dort einen eigenen Anteil
   (Asteroidenfeld, Peilungen, Alien-Nester — die Kommentare Z. 56484/56489 nennen den Befund
   `test_geteiltes_asteroidfeld` 6e: ohne Signatur-Anteil erscheint der grüne Ring erst mit dem
   5-Sekunden-Vollbau). Ein `state.vorposten` (Option A) bzw. eine entstandene/gefallene
   Vorposten-Festung (Option B/C) **ohne** Eintrag in `karteAuffangSignatur` bliebe bis zum nächsten
   Vollbau auf der Karte stehen bzw. fehlte — die klassische zweite Anzeigestelle mit alter Annahme
   (Checkliste Punkt 6). Der Vorposten-Zustand gehört dort SCHLANK hinein — nach dem Nest-Muster
   (`id:stufe` statt `JSON.stringify` der ganzen Liste, sonst Tick-Unruhe). **`state.asteroidFeld`
   ist bereits Teil der Signatur**; bei Option B/C, wo der Vorposten am Felddokument oder in
   `galaxyCache` hinge, ist zu prüfen, ob er über den vorhandenen Anteil ohnehin mitreist.

7. **Nur Option B/C — fremde Vorposten rendern und unterscheiden.** §2.1 macht „kein fremder
   Vorposten dort" zur Sichtbarkeitsbedingung des Bau-Menüs. Bei B/C setzt das voraus, dass fremde
   Vorposten aus `db.shared`/`db.galaxy` gelesen UND gerendert werden. Ergänzend zu Schritt 1–6:
   - fremde Vorposten laufen ebenfalls durch `kbMarkerFrei`/`platzierteMarker`, mit
     **Besitzer-Kennzeichnung** (Farbe/Tag wie die Allianzbasis ihren Tag trägt),
   - ihr Kartenmenü zeigt den **Anfechtungs-Zweig** statt des Bau-/Abbau-Eintrags,
   - die „kein fremder Vorposten dort"-Bau-Bedingung liest den GETEILTEN Zustand, nicht nur
     `state.vorposten`.
   Bei Option A entfällt Schritt 7 (jeder sieht nur seine eigenen).

**Im Bild bleiben** ist damit dieselbe Zusage wie bei der Allianzbasis: abgeleitete Bahn + `maxRadius`
+ `platzierteMarker`. ACHTUNG: die Regionsübersicht rendert Abzeichen am Handy bei ~9 px (bekannte
Grenze nach KB-21) — kein neuer Fehler des Vorpostens, aber die Trefferfläche wird eng.

**Nach jedem Geometrie-Umbau: der „was fällt aus dem Kasten"-Durchgang** (KB-20b) über ALLE Kinder der
Systemebene — der Marker MUSS in beiden Zeichnungen (rund/flach) und auf beiden Formfaktoren im Bild
bleiben. Der Durchgang misst nur, was die Fixture erzeugt: also eine Fixture mit gebautem Vorposten
verwenden (KB-20c: die Allianzbasis fehlte, weil die Fixture keine Allianz hatte).

---

## 6. Mission, Bericht, Belohnung

### Mission — Form A (Rundflug-Pflicht)

Ein Vorposten hat **keine Frist** (er läuft nicht ab wie Piratentrümmer/Riss) ⇒ **Form A**, kein
`hinBis`. Vorbilder `sendNestMission` / `sendFestungsMission`.

- **Bau-Mission** `type:'vorposten-bau'`:
  `flug = missionDurationFor(basis, flotte, relevantKeys, sys)`,
  `fuel = missionFuelCostSplit(flug, flotte)`, `canAfford`/`pay`, dann
  `cf.missions.push({ id: nextMissionId(), type:'vorposten-bau', targetId, system, startTime,
  endTime: jetzt + flug*1000, ... })`. **`endTime = jetzt + flug*1000` (volle Rundreise), NIE `/2`** —
  `test_rundflug.js` 1j liest datengetrieben alle `missions.push({`-Blöcke und schlägt bei halbierter
  Dauer an, sofern die Art nicht in `EINWEGIG_ERLAUBT` steht.
- **Welche Schiffe bauen? — `relevantKeys` festlegen (ACHTUNG: vor Bau entscheiden).** Ein Bau ist
  keine Angriffsflotte; die Wahl bestimmt Flugdauer, Treibstoff (`missionFuelCostSplit`),
  Hangar-Kappung und den Auswahl-Weg. Die Kolonisierung nutzt gemessen `['colonyShips']` (Z. 28900).
  Ohne Festlegung ist die Bau-Mission nicht baubar, und ein reiner Jäger-Verband ohne Träger würde
  beim Testen den Hangardeckel statt der Bauwirkung messen. **Empfehlung: eine eigene Baukolonne oder
  `colonyShips`**, keine `ATTACK_SHIP_KEYS`. Diese Entscheidung ist zugleich eine Messfrage (§11),
  weil sie die Kosten- und Dauer-Kalibrierung mitbestimmt.
- **`system` reist mit** (nur so erkennt der Server bei einer anfechtbaren Variante das Zielsystem).
- **Anzeigestellen sonst „Erkundungsziel"** — Pflicht-Zweige: `MISSION_LINIEN['vorposten-bau']`,
  eigener `missionMapZiel`-Zweig, die ZWEI `m.type==='asteroid-contest' || …`-Whitelists
  (`checkMissions`-Vorbereitung UND Missionskarten-Renderer, Z. ~23177 und ~63500), Missionskarte,
  Flottenleiste.

**Nur bei einer anfechtbaren Variante (Option B/C) zusätzlich:**

- **Angriffsmission** `type:'vorposten-angriff'` nach demselben Form-A-Muster. `pveVerlusteBuchen`
  (EINE Funktion, Z. 15042): Verluste ABZIEHEN, Überlebende NIE addieren — die Schiffe stehen die
  ganze Mission über schon in `fleet` (nur der Slot ist belegt; Regel 68).
- **Stationierungs-Mission (Verteidigung) — eigene, ZWEITEILIGE Missionsfamilie.** §2.6 verspricht,
  der Verteidiger könne mit Stationierung gegenhalten. Das ist der Allianzbasis-Präzedenzfall:
  `defend-base` + `defend-base-return` (Z. 44525/44541), **beide bewusst EINWEGIG** und **beide
  NAMENTLICH** in der Allowlist geführt (`tests/test_rundflug.js`, `EINWEGIG_ERLAUBT`). Ein
  Vorposten-Verteidiger braucht analog **`vorposten-defend` + `vorposten-defend-return`**, und **BEIDE
  müssen in `EINWEGIG_ERLAUBT` eingetragen werden** — sonst schlägt `test_rundflug.js` 1j bei jedem
  Bauversuch an. Beide brauchen ihre Anzeigestellen-Zweige (`missionMapZiel`, `MISSION_LINIEN`,
  Missionskarte, Flottenleiste, die zwei Whitelists). Ohne diese Familie ist die Verteidigungs-Zusage
  der PvP-Variante nicht umsetzbar.

### Bericht — Berichtspflicht (auch der ERFOLGREICHE Bau)

- **Der erfolgreiche `vorposten-bau` schreibt einen Bericht.** Ein Bau ist kein Kampf, fällt also
  nicht automatisch unter die „für alle Angriffe"-Regel — genau deshalb würde er, wenn die Bau-Mission
  während des Offline-Nachholens auflöst (`checkMissions` mit `showLog=false`), dem Spieler **gar
  nichts** melden: `#log` ist dort stumm, ein Toast hält nur drei Einträge. Die
  Abbau-/Peilungs-/`mining`-Missionen schreiben aus genau diesem Grund einen Bericht. Der
  Bau-Berichtstyp braucht: einen Zweig in `renderReportsBox`, einen Eintrag in `REPORT_CATEGORIES`,
  und er wird über `reportIsPositive` **NICHT als Rückschlag** eingefärbt (eine Berichtsart ohne
  Ergebnisbegriff ist kein Rückschlag; ggf. `REPORT_SPECIAL_GREEN_TYPES` — ein Bau ist kein verlorener
  Kampf).
- **JEDER Ausgang schreibt `pushReport`** — auch „kein Kampf": Server nicht erreichbar, Ziel schon
  weg, Abklingzeit. Dafür `angriffOhneKampf(typ, ziel, grund, felder)` (setzt `keinKampf:true`,
  denselben `type`, nennt den Grund). `#log` hat keinen Stapel und ist beim Offline-Nachholen stumm.
- **Bei Verteidiger-Sicht** (anfechtbare Variante) **`battleOutcomeOf`** einzeln prüfen —
  `result==='destroyed'` ist beim Angreifer Sieg, beim Verteidiger Verlust; und jede Funktion, die
  nach `result`/`type` urteilt, muss ein neues Zustandsfeld (`keinKampf`) kennen (`return null` = kein
  Ausgang), nicht nur die, die zeichnet.
- Wächter `tests/test_berichtspflicht.js` fängt eine neue Art ohne Zweig/Kategorie automatisch.

### Belohnung — gemessen, additiv+gedeckelt, NIE N-Minuten-Produktion

Ein reiner Nutzen-Vorposten (Option A) hat **keine Fund-Belohnung** — sein Wert IST der laufende
Nutzen. Eine Fund-/Schleif-Belohnung entsteht nur, wenn ein fremder Vorposten gefallen ist (Option B/C):

- **Über `pushPendingReward(userId, reward)`** (server.js) an ALLE Beitragenden inkl. Auslöser;
  schreibt `db.private[uid].__pendingRewards`, nie einen fremden Spielstand.
- **Eigener `type`-Zweig in `claimPendingRewards`** — fehlt er, meldet der Rückfall wörtlich
  „Dankeschön vom Team … Bug-Report", bei fehlendem `credits` sogar „+NaN Kredite".
- **Jeder Zweig ruft `save()`** (Regel 73): `POST /api/pending-rewards/claim` macht `list.shift()` +
  `saveDb()` — die Belohnung ist beim Ausliefern schon aus der Warteschlange, kein zweiter Versuch.
- **KEINE „N Minuten eigener Produktion"** (bei starker Wirtschaft explosiv — gemessen entspricht der
  Endausbau-Lagerdeckel 803.800 rund 5,5 Min Endspiel-Erz). Kleine stapelnde Boni in die additive
  gedeckelte Gruppe `1 + Math.min(1.0, summe)`, nie als eigene Multiplikation.
- **Belohnungsgröße nur aus SELBST beobachteten Ereignissen** (Fall des Vorpostens), nie aus dem
  klientenautoritativen Spielstand (sonst F5-druckbar).

### Baukosten — Regel 57 (der teuerste Einzelbefund)

Ein Vorposten ist eine **Einmalzahlung** und läuft sonst in den Bastionsmarken-Fehlermodus: teuer ≠
bezahlbar. **ACHTUNG: vor Bau gegen BEIDE Deckel rechnen, nicht gegen den Zufluss** —
`storageCap()` (Z. 24603), `tier2StorageCap(def)` (Z. 24766), `protomaterieCap()` (Z. 24780). Und
gegen ein **mittleres** Konto rechnen (~33.000 gemessene Größenordnung), nicht nur den Endausbau
(Bastionsmarken-Lehre). Erdrückt der Deckel die Menge, ist die richtige Antwort **Zeit** (die einzige
ungedeckelte Größe), nicht Material.

---

## 7. Icon + vollständige `desc`

Pflicht (Checkliste 7): eigenes Icon UND selbsterklärende `desc` (ganzer Satz, nennt Wirkung +
Grenze/Deckel). Der Vorposten braucht:

- ein Kartenknoten-SVG (Modell, Muster `allianceBaseModelSvg`),
- ein Menü-/Listen-Icon aus dem 69er-Subset (sonst `check-icons.js` rot; `ti-building-*` prüfen),
- die `desc` des Bau-Eintrags: was der Vorposten bringt, ab welcher Stufe, und — wenn Flugzeit-Kanal
  mit Weiche (i) — dass er nur **Nicht-PvP-Missionen** verkürzt (Angriff/Spionage unberührt), damit
  die Anzeige nicht mehr verspricht, als der Effekt tut.

Falls der Nutzen über eine `RESEARCH_DEFS`-Freischaltung läuft: neuer Eintrag braucht Icon + `desc`,
und eine aus einer Konstante **abgeleitete** Zahl im Text nur, wenn die Konstante in der Datei WEITER
OBEN steht (temporale Todeszone in Array-Literalen — `HELP_SECTIONS`/`RESEARCH_DEFS` werden beim
Laden ausgewertet). **ACHTUNG: Reihenfolge vor jeder Ableitung messen** (`indexOf`-Vergleich).

---

## 8. Falls Backend (nur Option B/C): Schalter, Reihenfolge, Solo, Parität

- **Schalter:** Der auslösende Teil (spielergebautes/anfechtbares Weltobjekt) hinter einen benannten
  `VORPOSTEN_AKTIV = false` (Muster `FESTUNG_SPAWN_AKTIV`, `NEST_SPAWN_AKTIV`), im **Frontend-PR**
  umgelegt, als **Notaus** stehen bleibend. Prüffrage: Sieht ein Spieler ohne das Frontend eine
  spielersichtbare ZAHL anders? Bei Anfechtbarkeit: ja → Schalter Pflicht, und ein Test hält fest,
  dass er auf `true` steht.
- **Auslieferungsreihenfolge:** Backend zuerst (Schalter aus), Frontend legt um (Regel 60). Server
  darf hinterherhinken, Frontend nicht.
- **Solo-Modus:** `db.shared`/`db.galaxy` existieren solo nicht (`useBackend()`, Z. 4418). Ein
  anfechtbarer Vorposten ist solo dann entweder nicht vorhanden, oder der Nutzen braucht eine
  Frontend-Rechnung als Rückfall — **das ist dann eine Kopie-Familie und braucht ihren
  Paritätstest**.
- **Backend-Parität:** Bewegt der Vorposten Verteidigung/Angriff (PvP — Stationierungs-Kanal, oder
  Flugzeit-Kanal in Weiche (ii)), ist die Formel eine Kopie-Familie mit **ausgeführtem** Paritätstest
  (Muster `bastionMarkMultServer`, `test_nest_paritaet.js`, `SHIP_SCORE_WEIGHTS`/`computeScoreServer`).
  Level serverseitig neu rechnen, nie dem Client-Wert vertrauen. Eine neue Schiffsklasse/Größe müsste
  in den einschlägigen Backend-Tabellen stehen (`grep -c` gegen die Zahl der Anzeigestellen).

---

## 9. Aufgeben / Abbau — mit Rückfrage (Pflicht)

„Halten, bis man aufgibt" (§2.5) verlangt einen **spezifizierten Abbau-Ablauf**. Ein Vorposten ist
eine über eine Bau-Mission errichtete, ggf. teure Struktur; ihn wegzuwerfen ist eine zerstörende
Aktion. Der Präzedenzfall ist eindeutig: `baustelleAufraeumen` und der `mining-recall` fragen VOR dem
Entfernen zurück und nennen **beide Zahlen** (was zurückkommt, was verloren geht), gerade weil ein
Fehlgriff auf ein kleines ✕ tagelanges Ansparen kostet und die Erklärung sonst nur im Protokoll steht
— also nach der Tat.

- **Option A:** ein Menüeintrag „Vorposten aufgeben" mit `confirm`-Rückfrage, der den
  `state.vorposten`-Eintrag löscht und den Kartenslot freigibt.
- **Option B/C:** ein **dedizierter** Endpunkt (kein generischer Storage-Write), der das Objekt
  entfernt; die Rechteprüfung stellt sicher, dass nur der Besitzer aufgeben kann.
- **Rückerstattung — eigene Sascha-Entscheidung mit Folge:**
  - **(a) nichts zurück** — die einfachste, keine Farm-Anreize;
  - **(b) Teilerstattung** wie beim Forschungsabbruch (50 %) — der Dialog nennt beide Zahlen, und die
    Rückgabe läuft über `gainResources` und klemmt damit am Lagerdeckel (die Rückfrage ist genau
    deshalb Pflicht, nicht Höflichkeit).
  **Empfehlung: (a) nichts zurück** — hält den Bau als bewusste, verbindliche Ortswahl und vermeidet
  jeden Abbau-Wiederaufbau-Kreislauf.

---

## 10. Prestige / Aufstieg

Zu klären als Teil des Konzepts (Vorbild Bastionsmarken `keepBastionMarks`, Sektor-Baustellenkonto):

- **Bei Option A** (`state.vorposten` im Spielstand): Ohne Erhalt löscht Prestige/Aufstieg die
  Vorposten. **Empfehlung: die STUFE/den Standort erhalten** (nicht ein Guthaben) — ein Vorposten ist
  eine Ortswahl wie eine Bake, und eine still zurückgesetzte Präsenz meldet der Spieler zu Recht.
  ACHTUNG: in BEIDE Reset-Bewahrlisten eintragen (Suchmuster wie `keepBastionMarks`).
- **Bei Option B/C** (Objekt am Server): überlebt Prestige ohnehin, weil es nicht im zurückgesetzten
  Spielstand liegt — dann nur die *Bindung* (welcher Vorposten gehört mir) prüfen.

---

## 11. Wächter / Testplan

Jeder Test mit Gegenprobe in **beide** Richtungen (grün neu, rot alt, per `KEPLER_SPIELDATEI` /
`git show HEAD:datei`), Prüfnamen per `diff` verglichen (nicht gezählt).

| Test | misst | Gegenprobe |
|---|---|---|
| `test_vorposten.js` (neu) | Bau-Mission ist Form A (`endTime = flug*1000`), Marker im Bild (kein Objekt außerhalb des Kastens über alle Systeme, beide Formfaktoren), Menü sichtbar (`elementFromPoint`, nicht bloß Existenz), erfolgreicher Bau schreibt einen Bericht, Nutzen als **Wirkung** (zwei Läufe mit/ohne Vorposten → andere Zahl, Regel 61) | Nutzen fest → Wirkungsprüfung fällt; Marker auf festen Punkt → Rand-Prüfung fällt; Bau-Bericht entfernt → Berichtsprüfung fällt |
| **PvP-Unberührtheit** (Teil von `test_vorposten.js`, nur Flugzeit-Kanal) | `moon-siege`- und `asteroid-contest`-Flugzeit mit/ohne Vorposten **identisch** | Faktor global auf `mult` gehängt → PvP-Flugzeit ändert sich → Prüfung fällt |
| `test_rundflug.js` (Bestand) | fängt halbierte `endTime` automatisch; Stationierungs-Missionen stehen NAMENTLICH in `EINWEGIG_ERLAUBT` | eine `/2`-Version → 1j fällt; `vorposten-defend`/`-return` aus der Allowlist → 1j fällt |
| `test_berichtspflicht.js` (Bestand) | neuer Berichtstyp (`vorposten-bau`, ggf. `vorposten-angriff`) hat Zweig + Kategorie + richtige Einfärbung | Zweig entfernt → fällt mit Typnamen |
| `test_kartenmarker.js` 1c (Bestand) | Vorposten-Marker (7.+ Art) im Bild + kollisionsfrei | Marker auf festen Punkt → px über Kante |
| `karteAuffangSignatur`-Prüfung (Teil von `test_vorposten.js` / `test_tickruhe.js`) | Vorposten-Zustand ist in der Signatur → Marker erscheint/verschwindet ohne 5-s-Verzug | Signatur-Anteil entfernt → Marker bleibt bis zum Vollbau stehen |
| `test_flotte_rueckkehr.js` (Bestand, nur anfechtbar) | `pveVerlusteBuchen` zieht ab, addiert nicht | Rückgabe addiert → Bestand wächst |
| `test_vorposten_paritaet.js` (neu, **nur B/C** bzw. Weiche (ii)) | Frontend-Nutzen-/Verteidigungstabelle Feld für Feld gegen `server.js`, **ausgeführt** | Backend-Wert ±1 → fällt mit `{feld,front,back}` |
| `test_belohnungen_speichern.js` (Bestand, nur B/C) | jeder `claim`-Zweig ruft `save()` | Zweig ohne `save` → `{"ohneSave":[…]}` |

Zusätzlich (nur B/C, Backend-Repo): HTTP-Test am Endpunkt (Muster `test_festung_http.js`) —
Rechteprüfung (Außenstehender bekommt 403, auch mit angelegtem Fake-`role`-Schlüssel; und das
Aufgeben nur durch den Besitzer), Abklingzeit am Objekt, Schadenszählung (angekommen, nicht Wurf),
Schalter steht auf `true`, fremde Vorposten werden gerendert und tragen den Anfechtungs-Zweig.

---

## 12. Offene Messfragen (VOR dem Bau)

1. **Der `missionDurationFor`-Boden ist KEINE harmlose „Reparatur" — und wird NICHT als globaler
   Return-Boden gebaut.** Gemessen (Z. 25085–25108): die Funktion endet `return sec * mult;`, **das
   Produkt hat keinen Boden**; die Einzelfaktoren tragen `Math.max(0.4, …)` bzw. `Math.max(0.5, …)`,
   und `mult *= Math.pow(0.97, f.spaeher||0)` (Z. 25089) ist bodenlos. Der erste Entwurf schlug vor,
   den Boden in denselben Rückgabewert zu setzen (`return Math.max(sec * 0.25, sec * mult);`) und
   nannte das „für sich schon eine Reparatur". **Beides ist gemessen falsch:**
   - **Ein globaler Boden bei 0,25 verschlechtert JEDE Bestandsflotte.** Allein das Produkt der
     GEDECKELTEN Faktoren erreicht bei einem entwickelten Konto weit weniger:
     `rfusion 0,4 × prestige-speed 0,5 × asc-speed 0,5 × skill 0,5 × navigator 0,5 = 0,0125` — noch
     VOR `fleetSpeedMultiplier` (Z. 25090) und `0,97^spaeher` (Z. 25089), die weiter senken. Ein
     Boden bei 0,25 würde solche Flotten um bis zu ~20× verlangsamen — eine spielersichtbare
     Regression für alle Bestandskonten ohne Schalter (Regel 12/26/60), verkleidet als Bugfix. Der
     Wert 0,25 ist nirgends hergeleitet (Regel 41).
   - **Der Fehler, den ein Boden behebt, betrifft nur den NEUEN Faktor.** Ein Vorposten-Faktor auf
     einem bodenlosen Stapel ist eine Multiplikation ins Unbekannte — aber das Bestandsprodukt ist
     nicht das Problem.
   **Vorgehen:** (a) Die Wirkung des **Vorposten-Faktors selbst** deckeln
   (`mult *= Math.max(untergrenze, 1 - vorpostenBonus)`), nicht das Produkt. (b) Erst MESSEN, ob eine
   realistische Flotte mit maximaler Forschung/Prestige/Buffs/Spähern das Produkt je unter einen
   kritischen Wert drückt (Vorabmessung deutet auf < 0,05). Fällt es nie unter die geplante
   Vorposten-Wirkung, ist ein Boden ein „Rabatt auf nichts" (Regel 59) und gar nicht nötig. (c) Falls
   doch ein Produkt-Boden gewollt ist, wird er am gemessenen realen Minimum kalibriert und
   **darunter** gesetzt, damit er heutige Flotten nie bindet — und dann ist er eine eigene
   Balance-Änderung mit eigenem Anzeigestellen- und Testbedarf, nicht „zuerst als harmlose
   Reparatur". **Bis zur Messung bleibt „Reparatur" eine Behauptung.**
2. **Der Nutzen-Kanal (§4) und seine Kalibrierung.** Bei Flugzeit: welcher Faktor, welcher Radius
   (E3 schlägt R=2,0 vor, drei Baken decken 36/67 Systeme — Greedy-Messung aus dem E3-Entwurf, **vor
   Bau am aktuellen Systemgraphen neu messen**), und die PvP-Weiche aus §4.2. Bei
   Scan/Produktion/Stationierung: **ACHTUNG — Ankerpunkt, Bezugsgröße und PvP-Frage sind je Kanal
   ungemessen** und müssen vor jeder Empfehlung nachgesehen werden (§4.1).
3. **`relevantKeys` der Bau-Mission** — welche Schiffsart(en) einen Vorposten errichten (eigene
   Baukolonne? `colonyShips`? ein Untersatz von `ATTACK_SHIP_KEYS`?). Bestimmt Dauer, Treibstoff und
   Kosten-Kalibrierung mit (§6).
4. **Baukosten gegen `storageCap`/`tier2StorageCap`/`protomaterieCap` an einem mittleren Konto**
   (Regel 57) — der größte Einzelposten muss BESITZBAR sein, nicht nur „teuer".
5. **Marker-Bahn: FAKTOR + Winkel** — muss über alle sichtbaren Systeme im Kasten bleiben (beide
   Formfaktoren) und darf Portal (325°) / Allianzbasis (205°) nicht treffen; am gerenderten Bild
   messen (KB-20c/h), nicht schätzen.
6. **Anzahl-Deckel:** Wie viele Vorposten darf ein Spieler halten? E3 legt `SPRUNGBAKEN_MAX = 3`
   fest — falls der Vorposten den Sprungknoten ersetzt, gilt dieser Rahmen; sonst neu entscheiden.
7. **Nur bei Option B/C bzw. Weiche (ii):** Verteidigungs-/Nutzenformel als Kopie-Familie — welche
   Backend-Tabellen sie berührt, und ob das Level serverseitig nachgerechnet wird.

---

### Empfohlene Reihenfolge

1. **Die zwei Kern-Entscheidungen einholen** (Sascha): §3 Ablageort und §4 Nutzen-Kanal, inklusive
   der PvP-Weiche §4.2. Ohne sie steht die Architektur nicht fest.
2. **Falls Flugzeit-Kanal gewählt: zuerst die Boden-Frage MESSEN** (Messfrage 1) — aber NICHT als
   globalen Boden bauen, sondern die Vorposten-Wirkung selbst deckeln. Das Wort „Reparatur" fällt
   erst, wenn eine Messung eine Bestandsverschlechterung ausschließt.
3. **Dann Option A** (Vorposten = enger Sprungknoten, Nutzen auf Nicht-PvP-Missionen gegated, Zustand
   im Spielstand, kein Backend) — der billigste Weg zu „eigener gehaltener Präsenz auf der Karte",
   solo-fähig, deploy-unabhängig. Mit dem PvP-Unberührtheits-Test (§11) als Pflicht.
4. **Anfechtbarkeit (Option B/C) oder ein PvP-berührender Kanal (Stationierung, Weiche (ii)) nur, wenn
   Sascha das ausdrücklich will** — dann mit voller Backend-Härtung, Stationierungs-Missionsfamilie,
   Fremd-Rendering, Schalter und Paritätstest.

---

## 13. Stand der Umsetzung (02.09.2026)

**Entschieden (Sascha, per Auswahl):** Option B – der Vorposten ist ein **echtes PvP-Ziel in
`db.shared`** – und **alle vier Nutzen-Kanäle** (Flugzeit, Aufklärung, Produktion, Stationierung).
Die Weiche aus §4.2 wurde nicht eigens abgefragt; gebaut ist die dortige Empfehlung (i): Der
Flugzeit-Nutzen wirkt **nur auf Nicht-PvP-Missionsarten**. Dafür trägt `missionDurationFor` ein
fünftes Argument `art`; wer es nicht mitgibt, bekommt keinen Bonus (die sichere Richtung), und
kein PvP-Missionsstart (Spielerangriff, Spionage, Mondbelagerung, Anfechtung, Allianzbasis) gibt es
mit – `tests/test_vorposten_ui.js` 5b misst das datengetrieben über alle `missions.push`-Blöcke.

**Backend (kolonie-kepler7-backend#194, hinter `VORPOSTEN_AKTIV = false`):** Dokumente
`vorposten:<sys>` in `db.shared`, Schreibsperre über die generische Storage-Route
(`checkVorpostenKeyPermission`), die Endpunkte `GET /api/vorposten`, `bauen`, `ausbauen`,
`stationieren`, `rueckruf`, `aufgeben` und `angriff`, Stufentabelle `VORPOSTEN_STUFEN` (Feldlager /
Stützpunkt / Bastion), Bauschutz 12 h, Abklingzeit 4 h je Angreifer und Vorposten, Ausbau-Sperre
12 h, höchstens drei je Konto. Entscheidungen und Messungen: `docs/vorposten.md` im Backend-Repo.
**Die Stufentabelle reist mit der GET-Antwort** – das Frontend führt bewusst KEINE Kopie, es gibt
also keine Kopie-Familie und keinen Paritätstest; alle Zahlen im Kartenmenü kommen vom Server.

**Frontend (diese Etappe):**

- **Karte:** ein Knoten je System auf der Allianzbasis-Bahn (0,86 der äußersten Planetenbahn,
  145°), durch `kbMarkerFrei` geschoben und in `platzierteMarker` angemeldet (§5): eigener
  Vorposten grün, fremder bernstein, dazu der gestrichelte graue **Bauplatz**, wenn hier gebaut
  werden könnte (fremdes System, kein Vorposten, Deckel nicht erreicht). Kern-Balken, Antenne,
  Beschriftung; `karteAuffangSignatur` und die Sektor-Abzeichen kennen ihn.
- **Kartenmenü:** fremd → „Vorposten angreifen" (gesperrt mit Grund bei Bauschutz, Abklingzeit,
  fehlenden Kampfschiffen, laufendem Verband); eigen → Ausbauen, Garnison stationieren, Garnison
  zurückrufen, Vorposten aufgeben (mit Rückfrage, beide Zahlen, §9); Bauplatz → „Vorposten
  errichten" mit Baukosten, Stufe-1-Werten und Nutzen.
- **Missionen (§6):** `vorposten-bau` und `vorposten-angriff` als **Rundflug (Form A)**;
  `vorposten-defend` / `vorposten-defend-return` **einwegig** nach dem `defend-base`-Muster (die
  Schiffe verlassen die Flotte beim Start, der Rückweg ist eine eigene Mission) und stehen in
  `EINWEGIG_ERLAUBT` von `tests/test_rundflug.js`. Dabei hat sich der dortige Detektor als blind
  für eine dritte Einweg-Form erwiesen (Dauer VOR dem push halbiert, `endTime: jetzt + dur*1000`) –
  er erkennt sie jetzt und belegt an den zwei Garnisons-Missionen, dass er sie findet.
- **Berichte (§6):** `vorposten-bau` (auch der ERFOLG, plus Fehlschlag mit Grund),
  `vorposten-angriff` (Schaden = das Angekommene, Durchschlag, Garnisonsverluste, Beuteanteil beim
  Fall) und `vorposten-verlust` (der eigene ist gefallen – ein Rückschlag ohne Ergebnisbegriff,
  deshalb namentlich in `REPORT_OHNE_ERGEBNIS_NEGATIV`).
- **Belohnungen:** Zweige `vorposten` (Kampfpunkte, Erfahrung, Kredite) und `vorposten-verlust`
  (schreibt den Bericht) in `claimPendingRewards`, beide mit `save()` (Regel 73).
- **Die vier Kanäle:** Flugzeit über `vorpostenFlugMult(targetSystem, art)` in
  `missionDurationFor` (bester eigener Vorposten im Umkreis von 2 Sektoren, Deckel 0,5);
  Produktion als Summand in `productionBonusRaw` (die Boni-Bilanz nennt die Quelle); Aufklärung
  senkt die Entdeckungschance der Spionage um 15 % je Stufe im Umkreis; Stationierung über die
  Garnison (Kampfschiffe, Deckel je Stufe, Überzählige kehren sofort um).
- **Baukosten (§6, Regel 57):** 20.000 Erz, 12.000 Kristalle, 6.000 Deuterium plus **ein
  Kolonieschiff**, das verbaut wird – jeder Posten liegt unter dem Lagerdeckel eines mittleren
  Kontos; Ausbau Stufe 2: 20.000 / 15.000 / 9.000, Stufe 3: 20.000 / 20.000 / 12.000 + 40
  Antimaterie. Bezahlt wird der Ausbau erst nach dem Ja des Servers. Aufgeben erstattet nichts.
- **Hilfe:** eigener Eintrag „Vorposten: deine Präsenz in einem fremden System".

**Wächter:** `tests/test_vorposten_ui.js` (47 Prüfungen am gerenderten Spiel). Die Kernmessung
ist die **Flugzeit-Wirkung als Drei-Läufe-Messung** (Regel 61/62): dieselbe Fixture, derselbe
Angriff – ohne eigenen Vorposten, mit einem Stufe-3-Vorposten in `abyss` (0,85 Sektor vom Ziel:
Missionsdauer 85 %), mit einem in `zenith` (3,2 Sektor: unverändert). Dazu die geschnittene
Funktion (PvP-Arten, fehlendes `art`, fehlendes Ziel → Faktor 1, Deckel 0,5), Bauplatz mit
Kostenabbuchung und Kolonieschiff, Bauschutz-Sperre, Beute als PAAR gegen einen Lauf ohne
Belohnung, Verlustbericht, und die Gegenrichtung „Server meldet aktiv:false → kein Knoten".
Betroffene Bestandstests: `test_kartenmarker` (neue benannte Aufrufstelle), `test_berichtspflicht`
(`vorposten-verlust` als benannter Rückschlag), `test_rundflug` (siehe oben).

**Auslieferung:** dieses Repo ZUERST, dann der Backend-Schalter (`VORPOSTEN_AKTIV = true`, plus
Admin-Notaus `vorposten` für den Bau) – wie bei den Wrackkonvois: Solange der Server
`aktiv:false` meldet, zeichnet das Frontend nichts, und die Patchnote liegt im selben Fenster wie
die Wirkung.

## Änderungen gegenüber dem Entwurf

Eingearbeitete Kritik-Befunde (Blocker/wichtig aufgelöst, Hinweise abgewogen):

- **[blocker] `missionDurationFor`-Boden 0,25 (lupe:zahlen):** Der Boden wird nicht mehr als
  „Reparatur zuerst" oder globaler Return-Boden geführt. §12-1 belegt gemessen, dass das Produkt der
  gedeckelten Faktoren ein entwickeltes Konto weit unter 0,25 bringt (0,0125 vor `spaeher`/`fleetSpeed`,
  `return sec*mult` ohne Boden bei Z. 25108) und ein globaler Boden Bestandsflotten ~20× verlangsamte.
  Neue Vorgabe: die Vorposten-Wirkung selbst deckeln, den realen Minimalwert erst messen. Auch in §11
  und in der empfohlenen Reihenfolge korrigiert; das Wort „Reparatur" ist als Behauptung markiert.
- **[blocker] PvP-frei-Beleg unvollständig (lupe:vollstaendigkeit):** Neu gemessen und belegt, dass
  `moon-siege` (Z. 54560) und `asteroid-contest` (Z. 14650/14679/14739/14784) `targetSystem` an
  `missionDurationFor` übergeben und damit PvP sind. §4.2 führt die Weiche (i) Nicht-PvP-Gating vs.
  (ii) PvP + Backend-Parität ausdrücklich für Sascha auf. Option A (§3) trägt jetzt den Vorbehalt,
  ihre Empfehlung ist an Weiche (i) gebunden statt an „PvP-frei by construction".
- **[wichtig] fehlender `karteAuffangSignatur`-Schritt (lupe:hausregeln):** §5 hat jetzt einen
  sechsten Punkt (Cache-Riegel Z. 56470, schlank nach Nest-Muster) und der Satz „macht alle fünf
  Schritte" ist auf sechs korrigiert.
- **[wichtig] PvP-frei an ungenannte Baubedingung geknüpft (lupe:zahlen):** Als harte Bau-Bedingung
  in §4.2 festgeschrieben — `vorpostenFlugMult(targetSystem, typ)` mit `!targetSystem`- UND
  PvP-Typ-Guard; der Test in §11 belegt die Gegenrichtung (Faktor global → Test fällt).
- **[wichtig] Nutzen-Kanal als zweite offene Entscheidung (lupe:vollstaendigkeit):** Neuer Abschnitt
  §4 mit Ankerpunkt, Bezugsgröße und PvP-Frage je Kanal; §0 führt beide Kern-Entscheidungen getrennt.
- **[wichtig] Aufgeben/Abbau unspezifiziert (lupe:vollstaendigkeit):** Neuer §9 mit Rückfrage-Pflicht
  (Muster `baustelleAufraeumen`/`mining-recall`), Endpunkt-Anforderung für B/C und der
  Rückerstattung als Sascha-Option mit Folge (Empfehlung: nichts zurück).
- **[wichtig] Option B ohne Verteidigungs-Mission + EINWEGIG_ERLAUBT (lupe:vollstaendigkeit):** §6
  führt jetzt `vorposten-defend` + `vorposten-defend-return` als zweiteilige Familie mit
  ausdrücklicher Allowlist-Pflicht (`tests/test_rundflug.js`); §11 hat die eigene Testzeile.
- **[hinweis] Option A generalisiert PvP-frei auf drei Kanäle (lupe:hausregeln/zahlen):** §3/§4.1
  stellen klar, dass nur der Flugzeit-Kanal gemessen ist; Scan/Produktion/Stationierung sind mit
  **ACHTUNG: vor Bau messen** markiert und kippen ggf. zu Option B.
- **[hinweis] Bau-Mission schreibt keinen Bericht (lupe:vollstaendigkeit):** §6 macht den
  Erfolgs-Bericht des `vorposten-bau` zur Pflicht (Zweig, Kategorie, nicht-negativ eingefärbt).
- **[hinweis] `relevantKeys` unspezifiziert (lupe:vollstaendigkeit):** §6 und Messfrage §12-3
  behandeln die Schiffswahl der Bau-Mission (Empfehlung: eigene Baukolonne/`colonyShips`).
- **[hinweis] fremde Vorposten bei B/C nicht behandelt (lupe:vollstaendigkeit):** §5 Schritt 7 ergänzt
  Rendering, Besitzer-Kennzeichnung, Anfechtungs-Menü und das Lesen des geteilten Zustands für die
  Bau-Bedingung.
