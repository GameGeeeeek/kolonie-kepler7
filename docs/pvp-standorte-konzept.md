# PvP auf Standorte: alle kolonisierten Planeten werden angreifbar

Auftrag Sascha (28.08.2026): „prüfe man kann nur hauptlanet von spielern angreifen keine kolonien
es sollen alle von spielern kolonisierten planeten angreifbar sein mehr pvp aktion!"

Entschieden per Auswahl (28.08.2026): **Voller Standort-Kampf in zwei Etappen** — Etappe 1
(Spionage deckt Standorte auf + Angriff mit Planeten-Zielwahl, Kampf je Standort), Etappe 2
(fremde Kolonien als Karten-Marker).

## 1. Der gemessene Ausgangszustand

Saschas Beobachtung stimmt für die **Zielwahl** — und nur für die. Alle Zahlen sind am Code
gemessen (Stand v8.616.0 Frontend / a49566e Backend):

- **Ein Angriff richtet sich immer gegen das KONTO.** `/api/attack` (server.js Z. 3756) nimmt aus
  dem Body ausschließlich `targetUserId`; alle vier Markier-Wege (Bestenliste, Profil,
  Spionagebericht, Karten-Marker) landen im selben `pendingAttackTarget = { id, name }`
  (weltraum_kolonie.html Z. 42257).
- **Fremde Kolonien sind NIRGENDS sichtbar.** `/api/players-map` (server.js Z. 4195) filtert
  `u.homeSystem === system` — ein Spieler existiert auf der Karte genau einmal, an seiner
  Heimat. Kolonie-Standorte kennt der Server nur als Teil des Spielstand-Blobs.
- **Die Kampfrechnung umfasst dagegen längst das ganze Konto:** `computeDefensePower`
  (Z. 3407) summiert Heimat (×1,2 `HOME_DEFENSE_BONUS`) und ALLE Kolonien (Gebäude + je
  Standort stationierte Flotten); die Beute (12–25 %) kommt aus dem GLOBALEN
  `target.resources`; die Gebäudezerstörung zieht ihre Kandidaten aus `allBuildingsOf(target)`,
  trifft also zufällig auch Kolonie-Gebäude.

**Die zwei Knackpunkte, an denen das Design hängt:**

1. **Das Ressourcenkonto ist global** (ein Topf, nicht je Planet). Ein Standort-Angriff braucht
   eine Beuteanteil-Regel — sonst ist der schwächste Standort das Optimalziel für die VOLLE
   Beute, und die Gesamt-Verteidigung wäre faktisch abgeschafft statt vertieft.
2. **Die Verteidigung je Standort gibt es im Frontend schon** (`defensePower(planetKey)`, von
   den NPC-Raids über `pickRaidTargetPlanet` benutzt) — dem Backend fehlt die Entsprechung.
   `computeDefensePower` iteriert aber bereits je Standort; die Trennung ist ein Refactor, keine
   Neuerfindung.

## 2. Etappe 1: Zielwahl über Spionage, Kampf je Standort

### 2.1 Backend: `standortVerteidigung(save, key)` — EINE Quelle

`computeDefensePower` wird zerlegt: eine Funktion je Standort (Basis-Summe aus Gebäuden ×
Bastionsmarken × `BUILDING_SHIELD_FACTOR` plus Flottenanteil, Heimat zusätzlich ×
`HOME_DEFENSE_BONUS`), multipliziert mit den KONTOWEITEN Faktoren (Forschung, Doktrin, Haltung,
Bonus-Gruppe, Buffs, Sabotage, Schwarm-Malus, T2-Aura). `computeDefensePower` wird zur Summe
über alle Standorte — **byte-gleiches Ergebnis, per Test belegt**, damit kein bestehender
PvP-Wert sich durch den Refactor verschiebt (dieselbe Zusage wie bei kbOrbitRx in KB-13).

Parität: Frontend `defensePower(planetKey)` gegen Backend `standortVerteidigung` — neuer
Abschnitt in `test_paritaet_tabellen` oder eigener Test, ausgeführt statt gegreppt.

### 2.2 `/api/attack` bekommt `targetPlanet` — Ziel-Identität, kein Kampfparameter

- `targetPlanet` ist die Identität des Ziels (wie `targetUserId` selbst), KEIN Wert über die
  Stärke einer Seite — die Eigenschaft „der Endpunkt nimmt keinen Kampfparameter aus dem Body"
  bleibt erhalten.
- **Fehlt das Feld (alter Client), läuft exakt der heutige Konto-Kampf.** Damit ist die
  Auslieferungsreihenfolge entschärft: Das Backend darf zuerst live gehen und ändert für
  Bestandsclients NICHTS (Regel 60 geprüft — kein Schalter nötig; der neue Pfad ist über das
  Request-Feld selbst getort).
- Validierung: `targetPlanet` muss `'home'` sein oder als Schlüssel in `target.colonies`
  existieren. Existiert der Standort nicht (mehr) → 404 mit Grund; der Client bucht
  `angriffOhneKampf` (Berichtspflicht: jeder Ausgang nennt seinen Grund).

### 2.3 Die Kampfrechnung je Standort

| Größe | heute | je Standort |
|---|---|---|
| Verteidigung | Konto-Summe | `standortVerteidigung(target, key)` |
| Konter | gegen `fleetSummary(target)` gesamt | gegen die DORT stationierte Flotte (Heimat: `save.fleet`, Kolonie: `c.fleet`) — man kämpft gegen das, was dort steht |
| Beute | 12–25 % × global | 12–25 % × global × **Standort-Beutefaktor** (siehe 2.4) |
| Verteidiger-Flottenverlust | Quote über `pvp-pending` auf die Gesamtflotte | Quote NUR auf die Flotte des angegriffenen Standorts (`pvp-fleet-loss` trägt `planetKey`) |
| Gebäudezerstörung | zufällig über `allBuildingsOf` | nur aus dem Gebäude-Set des angegriffenen Standorts |
| Schutzschild | kontoweit | **bleibt kontoweit** — sonst wären elf Standorte elf Farm-Ziele je Block |
| Anti-Farming (3×/Ziel, 5×/Block) | je Spieler | **bleibt je Spieler**, nicht je Planet — aus demselben Grund |

### 2.4 Der Beutefaktor ist eine FESTE Konstante je Standortart — bewusst nicht abgeleitet

`STANDORT_BEUTE_FAKTOR`: Heimat 1,0 · Kolonie ~0,5 · Mond ~0,35 (Zahlen werden beim Bauen gegen
echte Bestände gemessen, Regel 41 — das hier ist die Absicht, kein Messwert).

**Warum fest und nicht anteilig nach Standortgröße:** Ein abgeleiteter Anteil (z. B. nach
Gebäudestufen des Standorts) wäre vom VERTEIDIGER manipulierbar — wer seine Kolonien leer
lässt, macht sie als Beuteziel wertlos und hätte die alte Lage wiederhergestellt. Ein fester
Faktor gibt jedem Standort einen garantierten Preis: Die Heimat bleibt das fetteste Ziel
(voller Satz, dafür +20 % Verteidigung), eine schwache Kolonie ist das leichte Ziel mit halbem
Satz. Genau diese Abwägung IST die neue Spieltiefe.

**Die Kopie-Familie dazu:** Der Faktor muss dem Frontend für die Vorschau bekannt sein
(Frontend-Kopie + Paritätsprüfung, wie `FESTUNG_STUFEN`).

### 2.5 Spionage deckt die Standorte auf

- Neue Route `GET /api/spieler-standorte?target=<id>`: liefert die Standortliste des Ziels
  (Planet-Schlüssel + `standortVerteidigung` je Standort, server-gerechnet — dieselbe EINE
  Quelle wie der Kampf). Kein neues Informationsleck: Die GESAMT-Verteidigung steht heute schon
  für jeden im Bestenlisten-Eintrag (`loadPlayerEntry`); die Aufschlüsselung ist dieselbe
  Auskunftsklasse.
- **`resolveSpyMission` ruft die Route beim Missionsende** und legt die Liste als Schnappschuss
  in `state.spyIntel[targetId].standorte` — sie altert also mit der Aufklärung (30-Minuten-
  Frische wie heute), und der Honeypot-Mechanismus (entdeckter Späher bekommt aufgeblähte
  Werte) wird auf die Standort-Zahlen MIT angewandt, sonst wäre er über den neuen Weg
  umgangen.
- **Die Zielwahl-UI zeigt ohne Aufklärung nur die Heimat** plus den Hinweis „Standorte
  unbekannt — spähe das Ziel aus". Das ist eine klientenseitige SPIELREGEL, keine
  Sicherheitsgrenze (dieselbe Einordnung wie `FRAGMENT_LIEFERUNG_PRO_TAG`), und sie ist Saschas
  Linie („man soll schon bisschen suchen", Kartensuche-Entscheidung vom 22.08.).

### 2.6 Frontend: Zielwahl im Kampf-Unterreiter

- Zielwahl-Knöpfe nach dem Muster der Festungs-Bauteile (`data-fest-ziel`): je bekannter
  Standort ein Knopf mit Name, Verteidigungszahl und Beutefaktor; Vorgabe ist die Heimat.
- **Das Ziel reist in der MISSION mit** (`m.targetPlanet`), wie `festungZiel` — nicht im DOM
  (die Box wird im Sekundentakt neu geschrieben, ein `<select>` ohne Merker springt zurück).
- **Die Vorschau rechnet gegen die STANDORT-Verteidigung** (battleWinChance) und nennt die
  gekürzte Beute-Spanne — die Regel messen, nicht das Etikett (Regel 61): zwei Standorte müssen
  in der Vorschau verschiedene Zahlen zeigen.
- Berichte: `attack-sent`/`attack-received` tragen `targetPlanet`/Standortname; die
  Zeichner-Zweige nennen ihn („Angriff auf die Kolonie X von Spieler Y"). `pvp-fleet-loss`
  wendet seine Quote im Client auf die Standort-Flotte an, wenn `planetKey` mitkommt —
  ohne Feld (alter Servereintrag) wie bisher auf die Heimatflotte.
- Anzeigestellen-Sweep (Checkliste Punkt 6): PvP-Vorschau, Bedrohungs-Banner, Bericht,
  HELP_SECTIONS („Angriffe auf Spieler"), Spionagebericht (neue Standortzeilen),
  TUTORIAL_STEPS.

### 2.7 Was sich für Bestandsspieler NICHT ändert

Ein Angriff ohne Zielwahl (Vorgabe Heimat) trifft die Heimat mit deren Standort-Verteidigung —
das ist WENIGER als die heutige Konto-Summe. Das ist die gewollte Balance-Verschiebung dieser
Etappe und gehört in den Patchnote ausdrücklich benannt: Verteidigung schützt ab jetzt den
Standort, an dem sie steht. Wer alles auf der Heimat gebündelt hat, ist dort so stark wie
vorher — seine Kolonien sind es nicht mehr.

## 3. Etappe 2: fremde Kolonien auf der Karte

- **Der Server spiegelt die Kolonie-Schlüssel beim Spielstand-Schreiben** in das Nutzerobjekt
  (`u.kolonien = Object.keys(save.colonies)` im PUT-Pfad — der Save wird dort für die
  Sanity-Prüfung ohnehin geparst). Damit braucht `/api/players-map` KEINEN Scan über alle
  Saves je Anfrage.
- `/api/players-map` liefert zusätzlich Spieler, die eine KOLONIE im abgefragten System haben
  (Zuordnung Schlüssel→System macht das FRONTEND über seine `PLANETS`-Tabelle — das Backend
  braucht die Tabelle nie).
- Karten-Marker: eigene Markerart auf dem kolonisierten Planeten (kein freier Slot-Marker wie
  die Heimat), durch `kbMarkerFrei` + `platzierteMarker` (erbt den Kollisionsschutz
  automatisch), Label über `kbLabelsEntflechten` (erbt über `.planet-node` + data-Attribut).
  Klick → `playerMapMenu` mit Standort-Vorauswahl für die Zielwahl aus Etappe 1.
- `karteSystemBadges` bekommt KEIN neues Abzeichen dafür in Etappe 2 zwingend — ob fremde
  Kolonien auf Regions-/Sektorebene aggregiert erscheinen sollen, ist eine eigene Frage an
  Sascha (dieselbe „nicht zu leicht auffindbar"-Linie wie bei der Kartensuche).

## 4. Testplan

- **Backend-HTTP-Test** (nächster freier Port laut Backend-CLAUDE.md: 3232):
  Standort-Angriff mit Zielwahl (Verteidigung nur dort — PAAR: schwache Kolonie gegen starke
  Heimat, verschiedene Ausgänge bei identischem Angreifer), Beutefaktor, Gebäudeschaden nur am
  Standort, `pvp-fleet-loss` mit planetKey, alter Client ohne Feld → byte-gleiches heutiges
  Verhalten, unbekannter Standort → 404 mit Grund, Schutzschild weiterhin kontoweit.
- **Paritätstest** `standortVerteidigung` gegen Frontend-`defensePower(planetKey)` +
  Beutefaktor-Tabelle (ausgeführt, nicht gegreppt; Summen-Zusage: Σ Standorte ==
  computeDefensePower alt, an einem realistischen Save gemessen).
- **UI-Test** Zielwahl: ohne spyIntel nur Heimat; mit spyIntel alle Standorte; zwei Standorte
  zeigen verschiedene Vorschau-Zahlen (Regel 61); Ziel reist in der Mission mit; Bericht nennt
  den Standort.
- **Etappe 2**: Karten-Marker-Test (Sichtbarkeit + `elementFromPoint`, Markerkollisionen über
  den bestehenden `test_kartenmarker`-Datengetrieben-Sweep — neue Markerart erbt 1b/1c
  automatisch).

## 4b. Stand der Umsetzung

| Teil | Stand |
|---|---|
| Backend Etappe 1 (`targetPlanet`, `/api/spieler-standorte`, `standortVerteidigung`) | **fertig und live** (401 auf dem Pi gemessen) |
| Frontend Etappe 1 (Zielwahl, Vorschau, Berichte, Wächter) | **fertig**, 01.09.2026 |
| Etappe 2 (fremde Kolonien als Karten-Marker) | offen |

### Was beim Umsetzen der Frontend-Etappe 1 ANDERS entschieden wurde als hier

Jede dieser Abweichungen hat einen Grund; wer sie für ein Versehen hält und „repariert", baut den
jeweiligen Fehler wieder ein.

- **Die Zielwahl führt ZWEI Variablen** (`pvpZiel` + `pvpZielFuer`), nicht eine wie `festungZiel`.
  Kolonieschlüssel sind GLOBALE Planeten-IDs — Spieler A und Spieler B können beide auf Vesna
  siedeln. Die Prüfung „steht der Schlüssel in der Liste?" nach dem Festungs-Muster greift dann
  NICHT, und eine bei A getroffene, abgebrochene Wahl wirkte bei B still weiter.
- **Der Standortname reist als TEXT in der Mission mit**, nicht nur als Schlüssel.
  `planetDisplayName` löst zuerst über `state.colonyNames` auf, also über die EIGENEN
  Umbenennungen: Wer seine Vesna-Kolonie „Erzhafen" genannt hat, sähe im Bericht über einen
  Angriff auf die FREMDE Vesna-Kolonie seinen eigenen Namen. Dafür gibt es `fremdStandortName()`;
  für eigene Standorte (`attack-received`, `pvp-fleet-loss`) bleibt `planetDisplayName` richtig.
- **Das Ziel wird im `start`-Callback eingefroren**, nicht in `sendPlayerAttackMission` aus der
  Modulvariable gelesen. Dort liegt ein `await loadPlayerEntry` zwischen Auswahl und
  `missions.push`, und das Overlay ist zu diesem Zeitpunkt schon geschlossen — der Spieler kann in
  dem Netzfenster längst ein neues Ziel markiert haben.
- **`pvpKampfDetails` musste erweitert werden.** Die Funktion ist eine WHITELIST; was sie nicht
  kennt, erreicht keinen Bericht. Ohne die drei neuen Felder wäre die halbe Etappe unsichtbar
  gewesen, ohne dass irgendein Test angeschlagen hätte.
- **Die Vorschau nennt drei Einschränkungen ausdrücklich**, statt eine glatte Zahl zu behaupten:
  Der Konter wird gegen die bekannte GESAMTflotte gerechnet (der Server rechnet ihn gegen die
  Flotte DIESES Standorts, die keine Aufklärung liefert); die Verteidigung ist die Serverzahl, aber
  Aufstellung und Gefechtsvorrat kommen im Kampf noch obendrauf; die Flugzeit hängt am Spieler und
  nicht am Ort (`pseudoDistanceSeconds` hasht die Spieler-ID).

### Ein ausgelieferter Fehler, der dabei gemessen und mitbehoben wurde

Die PvP-Vorschau rechnete ihre Angriffskraft über `buildAttackFleet(state.activeBasePlanet, …)` —
also über die Auswahl am aktiven Standort. Der Server rechnet sie in `computeAttackPower()` über
`allFleetsOf(save)`, also über Heimatflotte **plus jede Kolonieflotte**; der Request trägt gar keine
Flottenangabe. Die angezeigte Siegchance war damit für jeden mit Kolonieflotten zu pessimistisch,
und zwar seit jeher. Entschieden am 01.09.2026 (Sascha): mitbeheben. Die Vorschau rechnet seither
über `pvpReichskraft()`, das die Server-Schleife spiegelt (rohe Kraft und Vielfalt je
Standortflotte, Konter je Flotte, danach die kontoweiten Faktoren genau einmal).

**Offen daraus als eigene Aufgabe:** Kampfkraft und Risiko sind entkoppelt. Die Verluste zieht
`applyCombatLosses` aus `m.composition`, also aus der Auswahl — ein Angriff mit einem einzigen
Jäger kämpft mit voller Reichskraft und riskiert diesen einen Jäger. Beute gibt es dabei keine (der
Client deckelt sie am Frachtraum), wohl aber 25 Kampfpunkte und Gebäudezerstörung beim Ziel. Das
ist eine PvP-Balance-Entscheidung und braucht eine eigene Backend-Etappe.

### Drei Lehren aus dem Bau des Wächters

- **Eine Gegenprobe braucht eine Liste der Prüfungen, die fallen MÜSSEN.** Zwei von vier
  Gegenproben blieben grün — ohne die Liste hätte ich daraus „der Test belegt nichts" gelesen und
  den Code verdächtigt. Tatsächlich waren es Fehler im Test: Die Honeypot-Probe umging den
  Ladepfad (die Fixture berechnete vor), und die Zielbindungs-Probe traf nur eine von zwei
  Schranken — die andere fing ab.
- **Eine Gegenprobe kann einen blinden Fleck melden statt ihn zu bestätigen.** Die Sabotage
  „targetPlanet nicht in den Request" ließ keine Prüfung fallen. Grund: Alle vier Prüfungen maßen
  die MISSION, und die trägt den Standort auch dann, wenn er den Server nie erreicht. Die Zeile,
  ohne die die ganze Etappe wirkungslos ist, war ungeprüft.
- **Die Fixture maß zuerst den unteren Anschlag.** Mit 800 Angriffskraft lagen Heimat *und*
  Kolonie bei 10 % Siegchance — der Test hätte den Deckel gemessen statt der Wirkung. Mit 8.000
  zeigt er 10 % / 72 % / 90 %.

## 5. Offene Entscheidungen (beim Bauen messen, nicht raten)

- Die konkreten Beutefaktoren (Kolonie ~0,5 / Mond ~0,35) gegen echte Bestände rechnen.
- Kampfpunkte je Sieg (heute pauschal 25) — je Standortart staffeln oder lassen.
- Ob die Wochenliga/Kampf-Bilanz Standort-Siege anders gewichtet (vorerst: nein, ein Sieg ist
  ein Sieg).
- Regionsabzeichen für fremde Kolonien (Etappe 2, Frage an Sascha).

## 6. Mindesteinsatz: Ertrag nur ab echtem Einsatz (Aufgabe #20, 02.09.2026)

### Der Befund

Kampfkraft und Risiko waren entkoppelt. `computeAttackPower` rechnet serverseitig über
`allFleetsOf` — die **ganze Reichsflotte** —, während die Verluste im Client nur aus der
geschickten `m.composition` gezogen werden. Ein Angriff mit **einem** Jäger kämpfte also mit
voller Reichskraft und riskierte diesen einen Jäger.

Zwei Dinge kamen beim Nachmessen dazu und verschärfen die Lage erheblich:

- **`awayShipTotalsServer` kennt `attack-player` nicht** (nur `relocate`, `defend-base`,
  `defend-base-return`, `attack-alliance-base`). Angriffsmissionen ziehen ihre Schiffe nirgends
  ab — der volle Bestand bleibt stehen, während sie fliegen.
- **`cargoCapacity` kommt in `server.js` null Mal vor.** Der Server zog dem Ziel **immer** den
  vollen Satz ab (12–25 %) und schrieb ihn dem Angreifer gut; der Frachtdeckel sitzt allein im
  Client, der den Angreifer-Spielstand danach überschreibt. Ein Ein-Jäger-Angriff plünderte also
  ein Viertel des Ressourcenkontos — und der größte Teil wurde **vernichtet**, weil ihn niemand
  tragen konnte. Für den Angreifer sah es nach „keine Beute" aus, für das Opfer nicht. Das war die
  teuerste Zahl der ganzen Lücke und in der Aufgabenbeschreibung nicht erfasst.

### Die Regel (Balance-Entscheidung Sascha: „Mindesteinsatz als Ertragsschwelle")

Ein Angriff unter `PVP_MINDESTEINSATZ` wird **nicht abgelehnt, sondern ertraglos**: keine Beute,
keine Kampfpunkte, keine Kriegspunkte, keine Veteranen-Erfahrung, kein Anlagenschaden, kein
Flottenverlust beim Ziel. Der Kampf läuft normal, die Siegchance bleibt die Reichsflotte — die
Zusage aus v8.634.0 bleibt damit wörtlich wahr. Die **eigenen** Verluste fallen weiter an; ein
Nadelstich ist also nicht gratis, aber auch nicht mehr lohnend.

Ablehnen wäre die schlechtere Bauform: Beim Eintreffen hat der Angreifer Treibstoff und Flugzeit
längst bezahlt, und seine Flotte kann seit dem Start gewachsen sein.

### Wer was durchsetzt

| Größe | Wo | Warum dort |
|---|---|---|
| Beute, Anlagenschaden, Flottenverlust beim Ziel, `battlePoints` am Nutzerobjekt | Server | PvP-relevant, gehört nicht in die Hand des Angreifers |
| `state.battlePoints`, `state.commandPoints`, `state.veteranXp` | Client | liegen im klientenautoritativen Spielstand, der Server kann sie nicht weglassen |

Beide Seiten lesen dieselbe `ertragStufe` aus der Antwort. Läuft der Client gegen ein Backend ohne
diese Etappe, fehlt das Feld — dann bleibt alles beim Altpfad.

### `missionId` statt Flotte im Request

Der Spielstand ist klientenautoritativ; eine Flottenangabe im Body wäre eine PvP-relevante Größe
aus der Hand des Angreifers. Der Server liest die Zusammensetzung deshalb aus dem **gespeicherten**
Spielstand. Ehrlich bleibt: Wer sich den Request baut, kann eine große Mission in seinen Spielstand
schreiben. Der Missbrauch wandert damit aus „drei Klicks in der offiziellen Oberfläche" in die
Klasse „Spielstand fälschen" — eine **Spielregel, kein Sicherheitsschloss**.

**Warum das hier ohne `await save()` funktioniert:** `checkMissions` entfernt die Mission zwar
synchron, aber `fetch()` geht im selben synchronen Durchlauf raus — vor dem Speichern des Ticks.
Gemessen (Playwright-Sonde, dreimal): `save+ save+ save+ >>attack<< save-`. Kommt das Speichern
doch einmal zuerst an, fällt der Server auf `voll` zurück, also in die für den Spieler harmlose
Richtung. Für die sechs PvE-Auflöser reichte genau das nicht — siehe `docs/PROJECT_MEMORY.md`,
Punkt 20.

### Die Kopie-Familie

`PVP_MINDESTEINSATZ` und `PVP_MINDESTEINSATZ_AKTIV` stehen in `weltraum_kolonie.html` **und** in
`server.js`. Sie werden in **einem Zug** auf beiden Seiten umgelegt: Stünde der Schalter vorne an
und hinten aus, warnte die Vorschau vor einer Regel, die es nicht gibt. `tests/test_pvp_mindesteinsatz.js`
prüft Wert und Schalterstand gegen `server.js`.

Auch der **Hilfeabschnitt** hängt am Schalter (`...(PVP_MINDESTEINSATZ_AKTIV ? [{…}] : [])`) — ein
Text, der einen Mindesteinsatz beschreibt, während der Server ihn nicht anwendet, wäre eine
Falschauskunft.

### Die Anzeigestellen

- **Vorschau** (`pvpVorschauHtml`): nennt den Einsatzanteil, **bevor** die Flotte startet. Das ist
  der eigentliche Sinn der Etappe — eine Regel, die dem Spieler erst im Bericht begegnet, bestraft
  ihn für etwas, das er beim Zusammenstellen nicht sehen konnte. Bewusst als Näherung („~"): Die
  Vorschau rechnet mit dem laufenden Zustand, der Server mit dem gespeicherten.
- **Log** (Sieg- und Verlustzweig): nennt Schwelle und tatsächlichen Anteil aus der **Antwort**.
- **Bericht**: eigene Zeile, wenn `ertragStufe === 'sockel'`.
- **Beutetext**: „nichts (Ziel hatte keine Ressourcen)" wäre im Sockel wörtlich falsch — dort steht
  jetzt nur „nichts", und der Grund folgt im nächsten Satz.
- **Hilfe**: eigener Abschnitt unter „Flotte & Schiffe", am Schalter hängend.

### Die Schwelle ist noch geraten

25 % ist ein Startwert. Vor dem Umlegen des Schalters misst
`kolonie-kepler7-backend/pvp_einsatz_messen.js` über `db.private`, welchen Anteil der stärkste
Standort eines Kontos üblicherweise hält — sonst trifft die Regel ehrliche Spieler mit verteilter
Flotte. Ein Konto mit sechs gleich starken Standorten kommt rechnerisch nie über 16,7 %.
