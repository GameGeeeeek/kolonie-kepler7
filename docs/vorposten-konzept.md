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

---

## Stand der Umsetzung (02.09.2026)

**Entschieden (Sascha, per Auswahl):** Option B – echtes PvP-Ziel in `db.shared` (Backend #194,
`docs/vorposten.md` dort) – und **alle vier Nutzen-Kanäle**. Die PvP-Weiche des Flugzeit-Kanals ist
nach Konzept-Empfehlung (i) gebaut: `vorpostenFlug(sysId, sek)` hängt NUR an den
Nicht-PvP-Aufrufstellen (Erkundung, Kolonisierung, Abbau, Vorposten-Bau), nie in
`missionDurationFor`; `tests/test_vorposten_paritaet.js` 5a–5c und `tests/test_vorposten_ui.js` 3c
halten das (Anfechtungs-Hinflug mit und ohne Vorposten identisch).

**Was das Frontend selbst festlegt** (der Server prüft keine Kosten, der Spielstand ist
klientenautoritativ): `VORPOSTEN_BAUKOSTEN` 60.000 Erz / 40.000 Kristalle / 25.000 Deuterium,
`VORPOSTEN_AUSBAU_KOSTEN` Stufe 2: 200k/130k/80k, Stufe 3: 600k/400k/250k. Regel 57: Stufe 1 ist
für ein mittleres Konto bezahlbar, Stufe 3 ein Endspiel-Preis (rund drei Viertel des
Endausbau-Lagerdeckels von 803.800); die Bremse dazwischen ist die 12-h-Ausbau-Abklingzeit des
Servers – Zeit, nicht Material.

**Die Bau-Mission** `vorposten-bau` (Form A) nutzt **ein Kolonieschiff als Baukolonne**, das
zurückkehrt (Messfrage §12-3 entschieden: `colonyShips`, keine eigene Klasse). Baukosten werden beim
Start bezahlt; kommt der Bau nicht zustande (belegt, Deckel, Server weg), gehen sie über
`gainResources` zurück, und der Bericht `vorposten-bau` nennt den Grund.

**Die Nutzen-Kanäle im Frontend:** `flug` (Anteil je Stufe, nur eigene Nicht-PvP-Missionen ins
System), `prod` (Summe aller eigenen Vorposten, additiv in der Gruppe von Modul- und Sektorbonus,
Deckel 10 %), `scan` (Entdeckungschance eigener Späher gegen Spieler mit Heimat im Vorposten-System
× (1 − 0,25·Stufe); ab Stufe 2 gilt Aufklärung dort nie als veraltet), Garnison (rechnet der Server).
Alle Zahlen kommen aus `GET /api/vorposten` – keine Tabelle im Frontend, kein Zahlen-Paritätstest.

**Missionsfamilie:** `vorposten-defend` (einwegig, Schiffe bleiben bis zur Ankunft in `fleet`,
der Server nimmt beim Stationieren an, was der gespeicherte Spielstand hat – der Client bucht genau
`angenommen` ab) und `vorposten-rueckruf` (einwegig, `schiffe` wie `mining-recall`); beide in
`EINWEGIG_ERLAUBT`. `vorposten-angriff` Form A. Berichte: `vorposten-bau`, `vorposten-garnison`,
`vorposten-angriff`, `vorposten-verteidigung`; Belohnungszweige `vorposten` und `vorposten-verlust`.

**Karte:** Knoten `data-map-vorposten` auf der inneren Bahn (`kbOrbitRx(1)·0,918`, wie NPC und Nest)
bei 125°, durch `kbMarkerFrei` – bewusst NICHT `kbOrbitRx(kbMaxOrbit)` wie die Allianzbasis: `kbMaxOrbit`
ist lokal in der Kartenfunktion, im Modulscope war das ein ReferenceError, der die ganze Systemebene
leer ließ (erster Lauf von `test_vorposten_ui`: Chip da, Marker weg); ⛺-Landmarke; Detailtafel-Chip; Bau-Knopf im Basis-Schnellzugriff des
aufgeklappten fremden Systems. Der Vorposten-Zustand ist Teil von `karteAuffangSignatur`.

**Offen / nicht gebaut:** Vorwarnung des Verteidigers vor der Ankunft (der Server hat keine
`incomingmuster`-Entsprechung; der Besitzer sieht den Kampfvermerk im Dokument, die Meldung beim
ersten Schlag und den Fall im Belohnungsfach).

## Der gesperrte Bau-Knopf sagt jetzt, warum (02.09.2026)

Meldung Sascha: „habe versucht einen vorposten zu errichten ging aber anscheinend nicht." Im
Browser bei 390×844 nachgestellt: Der Knopf „Vorposten errichten" stand da, war aber `disabled` –
und ein gesperrter Knopf feuert **keinen** Klick. Der Grund lag ausschließlich im `title`; am
Telefon gibt es kein Hover. Tippen führte zu nichts: kein Toast, keine Protokollzeile, keine
Erklärung. Dieselbe Fehlerklasse wie beim Festungsschlag.

Jetzt bleibt der Knopf klickbar (nur gedämpft, `aria-disabled`), und `vorpostenBauStarten()` nennt
den Grund als wartenden Toast (`warn`, 9 s) – die Prüfung stand ohnehin schon dort.

Zweiter Fund aus derselben Messung: **Die Baukosten können größer sein als das, was das Lager
überhaupt fasst.** 60.000 Erz, 40.000 Kristalle, 25.000 Deuterium gegen 12.800 Lagerkapazität bei
Lagerstufe 30 ohne Boni (`storageCap()` = 800 + Gebäude + Frachter, dann Multiplikatoren). „Nicht
genug Rohstoffe" schickt den Spieler dann ins Warten auf etwas, das nie eintritt. Der Grund nennt
in diesem Fall die Lagergröße und den Ausweg (Lager, Kryolager, Lagerforschung).

Wächter: `tests/test_vorposten_bau_grund.js` (11; Quelltext + zwei Browser-Stände im Telefon-Format).
Gegenprobe gegen v8.633.0: 8 rot, 3 grün, identische Prüflisten.

**Übertragbar:** Ein `disabled`-Knopf, dessen Grund nur im `title` steht, ist auf einem Telefon eine
stumme Sperre. Wer eine Bedingung zeigt, muss sie auch antippbar erklären.

## Acht Stufen und drei Spezialisierungen – Frontend (02.09.2026)

Auftrag Sascha: der Vorposten soll ein Highlight werden. Entscheidung: 8 Stufen, ab Stufe 4 eine
einmalige Ausrichtung; Etappe 1 ist die Tiefe (Optik, Modul-Steckplätze, Projekte und Sprungtor
folgen). Die Tabellen liegen im Backend (`docs/vorposten.md` dort), das Spiel liest sie.

**Die Ausbaukosten sind aus dem Spiel verschwunden.** `VORPOSTEN_AUSBAU_KOSTEN` (zwei Einträge)
ist gelöscht; die Kosten kommen als `v.naechsteStufe.kosten` vom Server. Mit acht Stufen wäre die
lokale Tabelle eine Kopie-Familie geworden – die Fehlerklasse, die dieses Projekt dreimal erwischt
hat. Bewusst **ohne Rückfall**: Ein Server ohne das Feld ist ein Server ohne die Stufen, dann gibt
es auch nichts auszubauen.

**Die Zweigwahl** fällt beim Sprung auf Stufe 4 in `vorpostenAusbauen()`. Die drei Varianten kommen
fertig gerechnet vom Server (`naechsteStufe.varianten`), damit das Spiel die Multiplikatoren nicht
ein zweites Mal kennt; gewählt wird über eine nummerierte Abfrage, die zu jeder Ausrichtung Kern,
Verteidigung, Garnison und die drei Nutzen-Kanäle nennt.

**Zwei Fallstricke, beide beim Bauen gemessen:**
- `garnisonMax` kam aus der Stufentabelle – das ist die Leiter **ohne** Zweig-Multiplikatoren. Ein
  Festungsring hätte 45 % zu wenig Platz angezeigt, und der Spieler hätte Schiffe geschickt, die
  der Server ablehnt. Die Grenze kommt jetzt vom Objekt (`v.garnisonMax`).
- Die Kopfzeile las die Stufenzahl aus `stufen.length` statt aus `maxStufe`. Im Betrieb identisch,
  aber eine Antwort mit gekürzter Leiter hätte „Stufe 3 von 4" gezeigt.

Wächter: `tests/test_vorposten_zweig.js` (14; Quelltext plus zwei Browser-Stände – vor und nach der
Wahl, inklusive dessen, was an den Server geht). Gegenprobe gegen v8.636.0: 12 rot, 2 grün,
identische Prüflisten.

## Etappe 2: die Raumstation, gezeichnet (02.09.2026)

Bis Stufe 3 bleibt der Vorposten eine **Palisade mit Fahne** – ein Feldlager soll wie eines
aussehen. Ab der Wahlstufe zeichnet `vorpostenSilhouette()` eine **Station im Orbit**, je Zweig
eine eigene Form:

- **Werft** – zwei Dockklammern, dazwischen ein Schiffsrumpf im Bau (spitzer Bug, Triebwerksglut am
  Heck), Querstreben zwischen Klammer und Rumpf.
- **Handelsknoten** – breiter Ring mit sechs angedockten Frachtcontainern, der sich langsam dreht.
- **Festungsring** – gepanzerter Ring mit vier Geschütztürmen und einem gestrichelten Schildkreis.
- **ohne Zweig** – neutraler Doppelring mit Nabe (ein Dokument aus der Zeit vor den Zweigen darf die
  Zeichnung nicht zerbrechen).

`vorpostenRadius()` wächst von 11 auf 17 – ein Ausbau, den man nicht sieht, ist kein Ausbau. Der
Kollisionsschieber bekommt den gewachsenen Sichtradius, sonst schiebt eine Sternenfestung in die
Planetenbahn. Die Rotation läuft über **eine** `transform`-Animation auf einer Gruppe, nicht über ein
Dutzend Einzelpunkte (Bilder je Sekunde auf dem Telefon). Die Landmarke wechselt von ⛺ auf 🛰.

Die vier Silhouetten wurden **im Bild angesehen**, nicht nur als Anker gezählt (PROJECT_MEMORY
Nr. 16): Der erste Entwurf der Werft las sich als Gitter mit einem Ei – zwei Rechtecke mit
durchlaufenden Streben. Erst Klammern plus spitzer Rumpf ergaben „Schiff im Dock".

Wächter: `tests/test_vorposten_station.js` (15; die Zeichnung im echten Kartenaufbau, je Zweig die
eigenen Formen und die Abwesenheit der fremden). Gegenprobe gegen v8.641.0: 8 rot, 7 grün,
identische Prüflisten.

**Eine Lehre aus dieser Gegenprobe:** Prüfung 3a („der Marker wächst mit der Stufe") maß zuerst die
Bounding-Box – die enthält das `<text>` mit dem Namen, und „Sternenfestung" ist länger als
„Stützpunkt". Sie war deshalb am alten Stand mit festem Radius **grün** und belegte nichts. Jetzt
liest sie den Radius des pulsenden Hofs, die einzige Größe, die nur am Radius hängt.

## Der Allianz-Verband gegen einen Vorposten (02.09.2026)

Eine Bastion hält 400.000 Kernpunkte und 60.000 Verteidigung. Für ein Einsteiger-Konto sind das rund
53 Einzelschläge bei vier Stunden Abklingzeit – solo ist sie nicht zu schleifen. Damit ist der
Vorposten die vierte Zielart des koordinierten Angriffs, neben fremder Allianzbasis, Alien-Nest und
Asteroidenfestung. Der Server-Kern `vorpostenSchlagAusfuehren` nahm `beteiligte` schon gewichtet
entgegen; gebaut wurde die Zielwahl, der Auflösungszweig und der Bericht.

**Zielwahl (`renderAllianceMusterBox`).** `musterVorposten` filtert die geladenen Vorposten auf
**fremd** und **ohne Bauschutz** – dieselben zwei Bedingungen, die der Server beim `create` prüft.
Ein Eintrag, den der Server abweisen würde, gehört nicht in die Liste; das Paar in Abschnitt 4 von
`tests/test_muster_vorposten_ui.js` misst genau das: der fremde, ungeschützte steht zur Wahl, der
eigene und der geschützte nicht. Steht kein wählbarer Vorposten da, erscheint die Option nicht –
eine leere Wahl wäre ein Versprechen ohne Gegenstand (dieselbe Regel wie bei Nest und Festung).

**Der Bauschutz wird zweimal geprüft.** Beim Ausrufen und noch einmal **bei der Ankunft**
(Backend, Grund `schutz`). Ohne die zweite Prüfung wäre der Verband der Weg, den Bauschutz zu
umgehen: Man ruft gegen einen ungeschützten Vorposten aus, der Besitzer baut während der
Sammelphase neu – und der frisch gebaute stünde ungeschützt da. Der Verband kehrt stattdessen
unverrichtet und vollzählig zurück.

**Wortlaut-Tests sind an dieser Stelle teuer.** Der Umbau der Zielart-Wahl auf vier Optionen riss
zwei fremde Tests, die den alten Satz wörtlich festhielten: `test_muster_festung_ui` 1b/1d und
`test_muster_nest_ui` 5b/5c. Beide prüften eine Momentaufnahme (`if (data.nest || data.festung){`,
„… oder eine Asteroidenfestung sein") statt der Regel. Sie prüfen jetzt die Regel: der claim-Zweig
muss `data.nest` zuerst und `data.festung` irgendwo führen, die Zahl der weiteren Glieder ist offen;
der Hilfesatz muss die Asteroidenfestung nennen, die Reihenfolge der Aufzählung ist offen. Eine
fünfte Zielart bricht diese Tests nicht mehr, ein Wegfall der bewachten Zielart weiterhin schon
(gemessen: Festung raus → 1b; Nest raus → 1b, 5b, 5c; Festung aus der Hilfe → 1d).

Dabei fiel ein stummer Punkt auf: `test_muster_nest_ui` 5c schnitt seine Scheibe ab
`cblock.indexOf(zweigKopf)`. Ohne gefundenen Kopf ist das **0** – die Scheibe begann am Blockanfang
und die Prüfung ging grün durch, genau in dem Fall, für den sie gebaut war. Ohne Kopf gibt es jetzt
keine Scheibe.

## Etappe 3: Stationsmodule im Spiel (02.09.2026)

Die Tabellen liegen im Backend (`docs/vorposten.md` dort) — das Spiel hält **keine eigene
Moduldefinition**. Katalog, Seltenheiten, Bestand, Ausbaukosten und die Bau-Abklingzeit kommen mit
`GET /api/vorposten`; gerechnet wird auf dem Server, angezeigt hier.

- Das **Kartenmenü** des eigenen Vorpostens nennt die Belegung („Steckplätze: 1 von 2 – Selten
  Geschützbank") und öffnet mit einem Eintrag das Steckplatz-Fenster. Vor der Wahlstufe steht dort
  der Grund, statt nur ausgegraut zu sein (Lehre vom Bau-Knopf).
- Das **Fenster** (dasselbe Overlay-Muster wie die Flottenwahl, kein zweites Gerüst) zeigt belegte
  und freie Plätze, den Bestand mit Anzahl und Wirkung in Worten, und die Schmiede.
- **Wirkung in Worten**: `vpModulWirkungText()` rechnet `basis × mult` nur zur **Anzeige** nach. Der
  Horchposten ist eine **Stufe**, kein Anteil — „+1 Aufklärungsstufe", nicht „+100 %".
- Der **Ausbau** gleicht Kredite und Spielstand-Version an, die der Server zurückmeldet (wie
  `/api/worldboss/resolve`) — ohne das liefe der nächste Speicherversuch in einen Versionskonflikt.

Wächter: `tests/test_vorposten_module_ui.js` (17). Gegenprobe gegen v8.642.0: 15 rot, 2 grün,
identische Prüflisten.

**Eine Lehre daraus:** Der erste Entwurf des Tests **brach** am alten Stand nach der sechsten
Prüfung ab (`fenster.raus[0].label` auf einem leeren Array). Die Prüflisten waren dadurch
verschieden, und für die zehn Prüfungen dahinter belegte die Gegenprobe nichts. Ein Test, der am
kaputten Stand abstürzt statt zu fallen, misst dort gar nichts — jede Auswertung eines erwarteten
Elements gehört null-sicher geschrieben.

## Etappe 4: Projekte an der Station (03.09.2026)

Auftrag Sascha: „dass man von dort aus Projekte starten kann, dass man von dort aus vielleicht auch
eine Art Überraumtor bauen kann."

Der Katalog kommt vom Server (`projektDefs` aus `GET /api/vorposten`) — das Spiel hält **keine
eigene Projekttabelle**, dieselbe Entscheidung wie bei den Modulen.

- Das **Kartenmenü** zeigt den Eintrag **immer**, auch wenn heute noch nichts geht. Ein Eintrag, der
  erst ab Stufe 5 auftaucht, verschwiege, dass es das Sprungtor überhaupt gibt. Er nennt, was läuft
  („noch 6 h 12 min"), sonst die Zahl der fertigen Vorhaben.
- Das **Fenster** hat drei Abschnitte: *Im Bau*, *Fertig*, *Möglich*. Unter „Möglich" steht auch,
  was **nicht** geht — mit dem Grund am Eintrag („Braucht Stufe 7.", „Baut nur Handelsknoten.")
  statt einer stummen Ausgrauung (Lehre vom Bau-Knopf, PROJECT_MEMORY Nr. 18).
- **Bezahlt wird nach der Zusage des Servers.** Andersherum wären die Rohstoffe weg, wenn der Server
  ablehnt — dieselbe Reihenfolge wie beim Modul-Ausbau.

### Der Flugzeit-Deckel ist keine Frontend-Zahl mehr

`vorpostenFlugMult` deckelte den Flugzeit-Bonus hart auf `0.5`. Das war eine Kopie-Familie mit dem
Backend — und ausgerechnet die Zahl, die das **Sprungtor** verschiebt: Ein Tor, das nur weitere
Prozentpunkte gäbe, täte nichts, weil eine hohe Stufe mit Modulen schon am Deckel liegt. Der Deckel
kommt jetzt als `nutzen.flugDeckel` vom Server; `VORPOSTEN_FLUG_DECKEL = 0.5` ist nur noch der
Rückfall für einen Vorposten aus einem älteren Serverstand.

Deshalb steht das Tor in der Anzeige als **Grenze**, nicht als Anteil: „Flugzeit-Grenze 75 % statt
50 %", nicht „+75 % kürzere Anflüge" — Letzteres wäre eine Falschangabe.

### Ein Wächter für eine Lücke, die niemand sehen konnte

`check-icons.js` liest **nur die Spieldatei**. Die Icons der Server-Tabellen (`VP_PROJEKT_DEFS`,
`VP_MODUL_DEFS`) laufen daran vorbei: Ein Projekt mit einem Icon außerhalb der 72er-Whitelist
zeichnete im Spiel ein leeres Kästchen, und **kein Prüflauf sähe es**. Genau diese Fehlerklasse hat
v8.77.1 schon einmal getroffen (`ti-gift`).

`tests/test_vorposten_projekte_ui.js` 0e hält die Whitelist aus der Spieldatei gegen beide
Server-Tabellen. Gegenprobe gemessen: `ti-atom-2` des Sprungtors testweise auf `ti-gift` gesetzt →
0e fällt und nennt `["gift"]`; ohne Nachbar-Repo überspringt sich die Prüfung sichtbar.

Wächter: `tests/test_vorposten_projekte_ui.js` (17). Gegenprobe gegen v8.646.0: 13 rot, 4 grün
(die vier messen die Backend-Icons und den Bootvorgang, nicht diese Änderung), Prüflisten identisch.

## Aufgeben ist ein Abbau über 24 Stunden (03.09.2026)

Auftrag Sascha: „vorposten sollen auch aufgebar sein allerdings müssen die abgebaut werden dauert
24 stunden."

Der Punkt der Frist ist nicht das Warten: Bis hierher verschwand ein Vorposten in dem Moment, in
dem sein Besitzer es wollte — auch mitten im Angriff, und der Angreifer stand vor einem leeren
System. **Das Spiel muss das sagen**, sonst klickt jemand „abbauen" und glaubt, damit aus einem
Angriff zu sein. Deshalb steht am Eintrag nicht nur die Dauer, sondern die Folge: *„so lange bleibt
er angreifbar"*.

- **Kartenmenü, kein laufender Abbau:** „Vorposten abbauen", mit Dauer und Folge. Die Rückfrage
  nennt zusätzlich, dass Garnison und Module erst mit dem fertigen Abbau zurückkommen.
- **Kartenmenü, laufender Abbau:** statt eines zweiten Starts der **Abbruch**, mit Restzeit. Ein
  zweiter „abbauen"-Klick würde vom Server ohnehin abgewiesen — ein Eintrag, der nur eine
  Fehlermeldung erzeugt, ist ein Versprechen ohne Gegenstand.
- **Infozeile:** die Restzeit steht an **jedem** Vorposten, auch an einem fremden. Eine Station,
  die in Kürze verschwindet, ist für einen Angreifer eine echte Information.
- **Keine Rückflug-Mission beim Start.** Die Garnison bleibt am Vorposten und verteidigt weiter;
  der Server schickt sie gar nicht mit. Legte das Spiel trotzdem einen Rückflug an, fehlten die
  Schiffe zu Hause *und* am Vorposten.
- **Der fertige Abbau kommt über die Belohnungs-Warteschlange** (`vorposten-abbau`): Die Schiffe
  landen direkt auf dem aktiven Standort. Beim Ablauf der 24 Stunden ist der Spieler üblicherweise
  gar nicht da, und der Server schreibt keinen fremden Spielstand.

### Der Wortlaut hängt an der Serverangabe, nicht an diesem Release

Zwischen diesem Frontend-Release und dem Umlegen von `VORPOSTEN_ABBAU_AKTIV` liegt genau ein
Deploy. In dieser Zeit löscht `/vorposten/aufgeben` weiterhin **sofort** — ein Eintrag, der dann
„Dauert 24h" verspräche, wäre eine Lüge in der Oberfläche. Der Menüpunkt liest deshalb
`vorpostenCache.abbauAktiv` und heißt so lange weiter „Vorposten aufgeben". Prüfung 4a/4b hält das
fest, damit die Absicherung nicht still verlorengeht.

Ebenso kommt die **Dauer** als `abbauMs` vom Server. Eine `24` im Spiel wäre eine Kopie-Familie mit
genau der Konstante, die im Backend steht.

Wächter: `tests/test_vorposten_abbau_ui.js` (20). Gegenprobe gegen v8.649.0: 12 rot, 8 grün,
Prüflisten identisch. Die acht grünen messen den Bootvorgang und den Übergangszustand — dort
verhält sich der alte Stand richtigerweise wie ein Server ohne Abbau.
