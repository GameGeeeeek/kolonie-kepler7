# Konzept: Aliens und Asteroidenfestungen – zwei angreifbare Ziele auf der Karte

Stand: 18.08.2026 · Zeilennummern geprüft gegen **v8.565.0** (Commit `6d0bdd5`) bzw.
`kolonie-kepler7-backend` Commit `0019a37` · Zielversion: ab v8.570.0, sechs Phasen

Auftrag (Sascha, 18.08.2026): *„Ich würde gerne noch Aliens und Asteroidenfestungen einführen, die
soll man auf der Karte sehen und angreifen können."*

Zeilennummern beziehen sich auf `weltraum_kolonie.html` bzw. `kolonie-kepler7-backend/server.js`.
**Jede Aussage über vorhandenen Code ist am Code nachgeprüft, nicht aus dem Gedächtnis
geschrieben**, und jede Zahl ist gegen den echten Stand nachgerechnet (Hausregel 41 – ein Konzept
beschreibt die Absicht, nicht den Code). Wo das Konzept eine Entscheidung offenlässt, steht das
ausdrücklich dabei (Abschnitt 11.2).

---

## 0. Die sieben Befunde, die das Konzept geformt haben

Vor den Zahlen sieben Dinge aus dem Bestand. Sie erklären jede spätere Entscheidung – und zwei davon
verwandeln den Auftrag von „etwas Neues bauen" in „etwas Halbfertiges endlich fertig machen".

### 0.1 Die Aliens gibt es schon. Als Deko – und der Hilfetext sagt es selbst.

Vier Völker sind seit Monaten im Spiel: `ALIEN_RACE_NAMES = ['Kryll-Schwarm', 'Xantheer-Kollektiv',
'Nomaden von Vex', 'Die Verglühten']` (server.js:4097). Der `galaxyTick` würfelt alle 15 Minuten mit
6 % Chance ein weiteres Volk hinzu (server.js:5186–5190), gibt ihm ein freies System und schreibt
eine Galaxie-Nachricht. Das Frontend zeichnet daraus ein 👽-Abzeichen am Systemknoten
(Z. 53335–53336).

Und dann passiert nichts mehr. Die Liste wird **nie geleert, nie verkleinert, nie umgesetzt** – der
einzige Schreibzugriff ist das `push` in Zeile 5189, begrenzt durch
`g.unlockedAlienRaces.length < ALIEN_RACE_NAMES.length`. Nachgerechnet: 6 % je Tick sind im Mittel
ein Volk je 4,2 Stunden; nach rund **17 Stunden Serverlaufzeit stehen alle vier**, und danach
bewegt sich bis zum Ende der Serverlaufzeit kein Abzeichen mehr.

Das Spiel sagt das seinen Spielern sogar selbst. `HELP_SECTIONS`, Abschnitt „Kriege, neue Völker,
Piratenbasen, Wurmlöcher" (Z. 38049):

> „Aktuell ohne tiefe mechanische Kopplung ans eigentliche Spiel (reine, aber jetzt sichtbare
> Weltgeschichte, kein direkter Gameplay-Effekt außer der Anzeige selbst)."

**Der Auftrag ist damit kein neues System, sondern eine eingelöste Zusage.** Ein Abzeichen, das
etwas ankündigt und nie etwas tut, ist die Sorte Anzeige, vor der Regel 35 warnt – nur langsamer:
kein hängender Ladezustand, sondern ein hängendes Versprechen.

### 0.2 `npcEmpireStrength` ist eine Einbahnstraße, die seit Monaten am Anschlag steht

```js
g.npcEmpireStrength = Math.min(2.5, g.npcEmpireStrength * (1 + 0.002 + Math.random() * 0.003));
```
(server.js:5088). Der Wert **wächst monoton und fällt nie**. Bei ~0,35 % je Tick und 96 Ticks am Tag
ist der Deckel 2,5 nach **rund 2,8 Tagen** erreicht – und bleibt dort, solange der Prozess läuft.

Er ist kein Zierrat: `npcEffectiveDefense()` (Z. 19448) multipliziert **jeden** NPC-Gegner damit.

```js
function npcEffectiveDefense(npc){
  return Math.round(npc.defense * (1 + npcScalingCount(npc.id)*0.18) * (galaxyCache.npcEmpireStrength||1) * prestigeChallengeMult());
}
```

Praktisch heißt das: Alle 18 NPC-Gegner stehen dauerhaft auf **2,5-facher** Verteidigung, und kein
Spieler kann irgendetwas dagegen tun. Ein galaktischer Schwierigkeitsregler ohne Gegenspiel ist
keine Bedrohung, sondern eine Konstante mit Umweg.

**Das ist der Haken, an dem die Aliens hängen.** Abschnitt 5.4 macht aus der Einbahnstraße ein
Tauziehen: Nester treiben den Wert hoch, geräumte Nester lassen ihn wieder sinken. Damit bekommt
eine tote Zahl zum ersten Mal eine Ursache, die man auf der Karte sehen und angreifen kann.

### 0.3 Der `galaxyTick`-Weltboss ist eine fertige, unbenutzte Maschine – **mit Ort**

Es gibt im Backend **zwei** Weltbosse, und das ist bisher niemandem aufgefallen:

| | `db.galaxy.worldBoss` | `db.shared['worldboss:current']` |
|---|---|---|
| erzeugt von | `spawnWorldBoss()` im galaxyTick (server.js:4220–4235) | dem **Client** (Z. 48890), serverseitig gehärtet |
| hat einen Ort | **ja** – `system: pickRandomFreeSystem()` (server.js:4229) | nein |
| HP | `40000 * (1 + users*0.4) * arch.hpMult` | `WORLDBOSS_BASE_HP * 1.6^(level-1)` |
| angreifbar | **nein** | ja, über `/api/worldboss/resolve` (server.js:5948) |
| gelesen von | **niemandem** | dem ganzen Weltboss-Feature |

`g.worldBoss` wird an genau vier Stellen berührt: Initialisierung (4194), Spawn (4224), die
Erscheinungs-Nachricht (4234) und der Ablauf samt Rückzugs-Nachricht (5304–5308). **Kein einziger
Lesezugriff darüber hinaus.** Sein gesamter Effekt ist eine Zeile in den Galaxie-Nachrichten.

**Und es ist nicht bloß toter Code, sondern für Spieler sichtbar falsch.** Beide Bosse ziehen ihre
Namen aus derselben Fünferliste (`WORLD_BOSS_NAMES`, server.js:4208 – im Frontend `WORLDBOSS_NAMEN`,
Z. 48810, wortgleich). Im Galaxie-Tab steht deshalb nebeneinander:

- die Nachricht *„WELTBOSS (Panzer-Bastion): Leviathan der Leere ist bei nyra erschienen! …
  **Gemeinsam bekämpfbar** (… HP, Rückzug in 96h)"* – für ein Objekt, das **niemand angreifen kann**
  und das die Karte nicht zeigt. Seine HP hängen an der Zahl registrierter Konten
  (`40000 * (1 + users*0.4) * arch.hpMult`, server.js:4223), also an einer Größe, die mit dem
  angreifbaren Boss nichts zu tun hat;
- die Boss-Karte mit *„Leviathan der Leere – Stufe 7"*, 838.860 HP (`WORLDBOSS_BASE_HP = 50000`
  × 1,6⁶, Z. 48790/48793), ohne Ort und mit einem anderen Archetyp.

Gleicher Name, andere Zahl, anderer Zustand. Wer die Nachricht liest und dann die Karte ansieht,
findet nichts, was zusammenpasst.

Für dieses Konzept ist das doppelt ein Glücksfall: Die Maschinerie „der galaxyTick erzeugt ein
**verortetes**, allen gemeinsames Objekt, kündigt es an, lässt es ablaufen und räumt es weg" ist
**vollständig geschrieben, erprobt und unbenutzt** – Alien-Nester und Asteroidenfestungen erben sie,
statt sie zu erfinden. Und die Gelegenheit, den widersprüchlichen Doppelboss aufzuräumen, kommt
gratis mit: Sobald `db.galaxy` echte verortete Ziele führt, gehört `g.worldBoss` entweder an das
angreifbare Objekt angeschlossen oder ersatzlos entfernt. **Vorschlag: ersatzlos entfernen**, als
eigener kleiner Commit in Phase 0 – die Anschluss-Variante würde eine zweite Wahrheit über die
Weltboss-HP einführen, und das Spiel hat mit zwei Wahrheiten über dieselbe Größe schlechte
Erfahrungen.

### 0.4 Die Musterangriff-Maschinerie hat kein PvE-Ziel – belegt seit dem 09.08.2026

`docs/content-ideen.md`, Abschnitt 5, hält fest:

> „**Allianz gegen ein Fraktions-Bollwerk** – die Musterangriff-Maschinerie (Sammelfenster,
> Beitritt, gemeinsamer Abflug, serverseitige Auflösung) steht komplett; ihr fehlt nur ein
> PvE-Ziel."

Nachgeprüft: Sechs Endpunkte, alle serverseitig gehärtet – `/api/musterattack/create` (6931),
`/join` (6985), `/cancel` (7029), `/checkdispatch` (7056), `/resolve` (7109), `/claim` (7216). Das
einzige, was sie heute angreifen können, ist die **Allianzbasis einer anderen Allianz**. Für eine
Allianz ohne Feinde ist die halbe Maschinerie damit unbenutzbar.

Die **Alien-Königin** (Abschnitt 5.5) ist dieses fehlende PvE-Ziel.

### 0.5 Der Gürtel hat Platz – zwei bis sieben freie Stellen je System

Der Asteroidengürtel liegt fertig da und hat buchstäblich Lücken:

| Konstante | Zeile | Wert | Bedeutung |
|---|---|---|---|
| `GUERTEL_SYSTEM_ZAHL` | 13211 | 20 | von 69 Systemen tragen einen Gürtel |
| `PLAETZE_JE_GUERTEL` | 13212 | 10 | feste Positionen auf der Gürtelbahn |
| `VORKOMMEN_JE_GUERTEL` | 13213 | `[4, 6]` | Startbelegung |
| `VORKOMMEN_GRENZEN` | 13214 | `[3, 8]` | Schranken beim Wandern des Nachschubs |

Zwischen drei und acht belegten Plätzen bleiben **zwei bis sieben frei**. Sie sind heute schlicht
leer – `asteroidPlatzXY(platz)` (Z. 54114) rechnet für jeden der zehn Plätze eine Position auf der
Gürtelbahn aus, gezeichnet wird nur, wo ein Vorkommen liegt.

**Eine Asteroidenfestung steht auf einem dieser freien Plätze.** Sie braucht keine neue Geometrie,
keine neue Adressierung und keinen neuen Kartenzeichner – die Bahn, die Position, das Kartenmenü
und die Missionsführung dorthin existieren seit v8.478.0.

### 0.6 Nebenbefund: `asteroid-contest` verletzt die Rundflug-Regel – der dritte Fall

Beim Nachlesen der Anfechtungs-Mission (das nächste Vorbild für einen Angriff auf ein ortsfestes
Ziel) ist ein echter Fehler aufgefallen, der nicht zu diesem Konzept gehört, aber hier festgehalten
werden muss.

`sendAnfechtungsMission()` (Z. 13869–13878) legt an:

```js
startTime: jetzt, endTime: jetzt + (flug/2)*1000,
```

`flug` ist die **Rundreise** – das belegt die Abbaumission direkt daneben, die aus derselben Zahl
`hinBis: jetzt + (plan.flug/2)*1000` und `endTime: jetzt + plan.gesamt*1000` mit
`gesamt = flug + abbau` bildet (Z. 55437–55439). Die Anfechtung endet also **im Moment der
Ankunft**: Die Flotte ficht das Schürfrecht an und steht in derselben Sekunde wieder zu Hause. Der
Rückflug fehlt ersatzlos.

Das ist exakt der Fehler, der am 17.08.2026 für `intercept-pirates` und `void-rift` gefunden und in
v8.563.0 behoben wurde. Die CLAUDE.md hält dazu fest: *„Am 17.08.2026 verletzten genau zwei Arten
die Regel"* – das stimmt nicht, es waren drei. Auch der Ankunfts-Durchgang in `checkMissions`
(Z. 49485–49491) filtert nur auf die zwei bekannten Arten, und `tests/test_rundflug.js` prüft in
seiner Falltabelle (Z. 138–139) ebenfalls nur diese zwei.

**Folge für dieses Konzept:** Die vier neuen Angriffsmissionen (Abschnitt 4.4 und 5.5) werden von
Anfang an nach dem Abbaumissions-Muster gebaut – Kampf bei `hinBis`, `endTime` auf die volle
Rundreise. Und `test_rundflug.js` bekommt seine Falltabelle **datengetrieben** statt handgepflegt,
damit ein vierter Fall nicht wieder ein Jahr unbemerkt bleibt (Abschnitt 10, Regel-40-Muster).

### 0.7 Zweiter Nebenbefund, gemessen: `asteroids:*` ist im geteilten Speicher **ungeschützt**

Beim Nachlesen des Feld-Dokuments – dem Ort, an dem die Festung wohnen soll – ist eine offene
Lücke aufgefallen. Die Schreibprüfung der generischen Storage-Route ist eine **Kette expliziter
Erlaubnisregeln** (server.js:1998):

```js
const denyReason = checkAllianceKeyPermission(...) || checkPactKeyPermission(...)
  || checkChatKeyPermission(...) || checkHallOfFamePermission(...)
  || checkMoonDefensePermission(...) || checkWorldBossPermission(...)
  || checkMissionsKeyPermission(...);
```

Dazu kommen zwei Inline-Prüfungen für `leaderboard:` und `spyping:`. **`asteroids:` steht in keiner
davon.** Ein Abgleich aller Schlüsselfamilien im geteilten Speicher (`grep -o "db.shared\[[^]]*\]"`,
entdoppelt) zeigt: Es ist die **einzige** Familie ohne Regel. Und ohne ausdrückliche Regel ist der
geteilte Speicher für **jeden** eingeloggten Nutzer offen – das steht als bekannter Fallstrick
wörtlich in der CLAUDE.md.

**Gemessen an einem echten Server** (`node server.js` mit Test-Datenbank unter `/tmp`, zwei frisch
registrierte und bestätigte Konten, echte HTTP-Aufrufe):

```
OK    1 Guertelfeld lesbar
OK    2 Schuerfrecht angemeldet            (Konto "opfer", System abyss)
OK    3 Halter steht im Felddokument       halterName: "opfer"
FAIL  4 fremdes Schreiben wird ABGEWIESEN  {"status":200, "value":"kaputt"}
FAIL  5 Schuerfrecht des Opfers ueberlebt  {"halterVorher":"opfer","plaetzeNachher":["1","3","5","7","9"]}
```

Ein beliebiges zweites Konto schreibt mit **einer** Anfrage die Zeichenkette `"kaputt"` auf
`asteroids:abyss` und bekommt **HTTP 200**. Danach ist das Feld weg: `astAlleFelder()`
(server.js:7871) prüft `typeof feld !== 'object'`, findet eine Zeichenkette und erzeugt das
Gürtelfeld **komplett neu** – mit anderen Plätzen, anderen Sorten, anderen Größen. **Alle
Schürfrechte aller Spieler in diesem System sind damit gelöscht**, ihre stationierten Eskorten
stehen als „gestrandet" da (den Fall kennt das Kartenmenü bereits, Z. 55523). Zwanzig Anfragen
räumen die Schürfrechte der gesamten Galaxie ab.

Das ist keine theoretische Lücke, sondern genau die Grenze, die dieses Projekt verteidigt: *„Kann
ich etwas anfassen, das ANDEREN gehört oder allen gemeinsam?"* – hier beides.

**Die Behebung ist klein** und folgt exakt dem Muster, mit dem `worldboss:current` am 10.08.2026
geschlossen wurde: eine Funktion `checkAsteroidKeyPermission(req, key, isWrite)`, die für jeden
Schlüssel mit dem Präfix `asteroids:` beim **Schreiben** ablehnt (Lesen bleibt offen, der Gürtel ist
öffentlich), und ein Glied mehr in der Kette. **Nachgeprüft, dass dabei nichts kaputtgeht:** Die
Spieldatei ruft für Asteroiden ausschließlich die dedizierten Endpunkte auf – `/asteroid/field`
(Z. 13453), `/claim` (13595, 13639), `/release` (13668), `/contest` (13827, 13891), `/mine` (55395).
Eine generische `storageSet('asteroids:…')`-Stelle gibt es **nicht** (grep über die ganze Datei,
null Treffer). Die Sperre trifft also keinen legitimen Aufruf. Dazu ein HTTP-Test nach dem Muster
oben, der beide Richtungen misst.

**Das gehört vor dieses Konzept, nicht hinein** (Phase 0, Abschnitt 9). Es hier festzuhalten hat
zwei Gründe: Der Befund ist beim Entwurf entstanden, und die Festung würde **im selben Dokument**
wohnen – ohne die Sperre könnte man sie mit derselben Anfrage einfach wegschreiben.

---

## 1. Was das Konzept vorschlägt, in fünf Sätzen

Auf der Gürtelbahn der zwanzig Gürtelsysteme stehen künftig **Asteroidenfestungen**: befestigte
Brocken, die den Gürtel um sich herum blockieren, das Fördergut horten, das sie ihm entnehmen, und
so lange stehen bleiben, bis jemand sie schleift. Sie haben einen **gemeinsamen, serverseitig
geführten Lebenspunkte-Vorrat** und drei angreifbare Teile – Schildkuppel, Geschütztürme, Kern –,
gegen die je eine der drei vorhandenen Konterrollen wirkt, sodass eine Flotte nicht nur groß, sondern
**richtig zusammengesetzt** sein muss. Die vier längst gesichteten **Alien-Völker** bekommen
gleichzeitig echte **Brutnester**, die in fünf Stufen reifen, sich in Nachbarsysteme ausbreiten und –
solange sie stehen – die galaktische Gegnerstärke nach oben drücken; geräumte Nester lassen sie
wieder sinken, womit die heute einbahnige `npcEmpireStrength` zum ersten Mal ein Gegenspiel bekommt.
Beides steht **sichtbar auf der Sektorkarte** und wird über dieselbe Flottenwahl und dieselbe
Missionsführung angegriffen wie jeder andere Gegner – nur die Auflösung liegt beim Server, weil ein
gemeinsamer Lebenspunkte-Vorrat allen gehört. Und die Spitze der Alien-Eskalation, die
**Königin**, ist das PvE-Ziel, das der fertigen Musterangriff-Maschinerie seit ihrem Bau fehlt.

---

## 2. Die Leitentscheidung: zwei Ziele, zwei Gefühle

Der naheliegende Fehler wäre, beides als dasselbe zu bauen – „ein Ding auf der Karte mit
Lebenspunkten". Das Spiel hat davon bereits fünf Ausprägungen; eine sechste und siebte ohne eigenen
Charakter wären Füllmaterial. Die beiden Inhalte sind deshalb bewusst gegensätzlich angelegt:

|  | **Asteroidenfestung** | **Alien-Nest** |
|---|---|---|
| Grundgefühl | **Belagerung** | **Seuche** |
| Verhalten | steht still, wird nicht stärker | reift, wächst, breitet sich aus |
| Druck entsteht durch | **Verlust** (der Gürtel liefert weniger) | **Zeit** (jede Stunde wird es mehr) |
| Wer sie ignoriert | verzichtet auf Ertrag – und findet später einen fetteren Hort | bekommt eine härtere Galaxie für alle |
| Ort | fest, auf einem Gürtelplatz | wandernd, breitet sich aus |
| Lebensdauer | bis jemand sie schleift | bis jemand sie räumt – oder bis daraus zwei werden |
| Anreiz zum Angriff | der Hort, den sie angehäuft hat | der Schaden, den sie sonst anrichtet |
| Kooperation | hilfreich (Teile parallel angreifen) | ab Stufe 3 praktisch unverzichtbar – aber nie erzwungen (5.5) |

Und die Abgrenzung nach außen – gegen alles, was das Spiel bereits hat:

| Vorhandenes Ziel | Was es ist | Warum das Neue es nicht doppelt |
|---|---|---|
| `NPCS` (18 Stück, Z. 15186) | fest verortete Gegner, beliebig oft, rein clientseitig aufgelöst, wachsen je Sieg (`npcScaling`) | Ein NPC ändert nie etwas an der Welt. Festung und Nest **verändern den Zustand des Systems**, in dem sie stehen. |
| Weltboss (`worldboss:current`) | ein einziger, galaxieweiter Gegner, 24 h Abklingzeit je Spieler, **ohne Ort** | Festungen sind **viele, dauerhaft, verortet**. Der Weltboss bleibt das seltene Großereignis. |
| Piratennest (`pirateLairStage`, 10 Stufen) | reine Solo-Kette, kein Ort, kein geteilter Zustand | bleibt unverändert die Einzelspieler-Leiter |
| Allianz-Raid (`ALLIANCE_RAID_BOSSE`, Z. 42915) | fünf ausgearbeitete Bosse **nur für die eigene Allianz**, abstrakter Ort, Wellen-Rhythmus | Der Raid ist eine **Verabredung**, das Nest ein **Zustand der Welt**. Dass dort schon eine „Schwarmmutter" steht (Z. 42920), ist ein Argument **für** die Alien-Bildsprache, nicht gegen das Konzept – Abschnitt 5.6 knüpft daran an, statt daneben etwas Zweites zu erfinden. |
| Schürfrecht-Anfechtung (`asteroid-contest`) | **Spieler gegen Spieler** um ein Vorkommen | Die Festung ist der PvE-Gegenpol auf derselben Bahn: nicht „nimm es dem anderen weg", sondern „hol es euch allen zurück". |
| Randkriege (`RK_*`) | Fraktionsfront, Kontrollbalken, Kriegspunkte | bleibt das territoriale System; Nester sind **fraktionsneutral** und treffen alle gleich |
| Abgrund (`ABGRUND_*`) | Abstieg in die Tiefe, private Endlosschleife | ohne Ort auf der Karte, ohne geteilten Zustand |

**Die Leitfrage bei jeder Einzelentscheidung unten war:** Kann der Server das SELBST beobachten?
(CLAUDE.md, „Sternenstaub: nur was der Server SELBST beobachtet" und „Der Wochenpass wurde bewusst
NICHT gebaut".) Ein gemeinsamer Lebenspunkte-Vorrat ist etwas, das **allen** gehört – er liegt damit
genau auf der Grenze, die dieses Projekt verteidigt, und darf deshalb an keiner Stelle aus einer
Client-Meldung fortgeschrieben werden.

---

## 3. Bestandsaufnahme: worauf aufgebaut wird

| Bereich | Vorhanden | Wiederverwendung |
|---|---|---|
| **Systemabzeichen** | `karteSystemBadges(sysId)` Z. 53329 – EINE Quelle für Sektoransicht **und** offene Systemebene | Zwei weitere Einträge (🛡 Festung, 👾 Nest). Beide Renderer und die Sektor-Übersichts-Aggregation (`data-sektor-hinweise`) erben sie automatisch (Regel 44). |
| **Marker im System** | `data-map-npc` Z. 54717, Kollisionsschieber `kbMarkerFrei()` Z. 54141 | Ein vierter/fünfter Markertyp erbt den Schieber, wie es der Kommentar dort ausdrücklich vorsieht. |
| **Gürtelbahn** | `guertelRx()` Z. 54113, `asteroidPlatzXY(platz)` Z. 54114, `asteroidMarkerR()` Z. 54119 | Die Festung sitzt auf einem freien der zehn Plätze – ohne eine Zeile neue Geometrie. |
| **Kartenmenü** | `asteroidMapMenu()` Z. 55453, `npcMapMenu()` Z. 54059, `openKarteMenu()` Z. 53907 | Zwei neue Menüs nach demselben Muster: Einträge mit `icon`/`label`/`grund`/`disabled`/`fn`. |
| **Ebenen-Leiste** | `karteEbeneAn('ereignisse')` Z. 53213, Knopf Z. 3397 („Piratenbasis, Aliens, Krieg") | Nester gehören in die vorhandene Ebene – ihr Knopf **wirbt schon heute mit „Aliens"**. Festungen bekommen einen eigenen Schalter (Abschnitt 4.8). |
| **Flottenwahl** | `oeffneFlottenwahl({art, titel, keys, vorschau, startLabel, sperre, start})` Z. 21461 | Alle vier neuen Angriffe nutzen genau dieses Feld – es ist seit v8.421.0 an allen zwölf Startstellen. |
| **Missionsführung** | `cf.missions.push({type, targetId, startTime, hinBis, endTime, composition})`, Auflösung in `checkMissions()` | Vier neue `type`-Werte, kein neuer Mechanismus. |
| **Rundflug** | Ankunfts-Durchgang Z. 49480–49491, `ankunftsKampf()`, `m.kampfErledigt` | Wird um die neuen Arten erweitert – **datengetrieben** statt mit einer vierten `\|\|`-Bedingung (0.6). |
| **Flugzeit / Treibstoff** | `missionDurationFor()`, `missionFuelCostSplit()`, `asteroidFlugBasis(sysId)` Z. 55219 | unverändert; Navigator, Allianzforschung und Treibstoffdepot wirken damit automatisch mit |
| **Serverautoritativer Kampf** | `/api/worldboss/resolve` server.js:5948, `computeAttackPowerFromComposition()` server.js:5935 | Das fertige Muster: Mission aus dem **gespeicherten** Spielstand lesen, Kraft selbst rechnen, Abklingzeit selbst durchsetzen, nur den eigenen Spielstand schreiben. |
| **Beitragsverbuchung** | `boss.contributions[userId] = {name, dmg}` server.js:5999–6004 | Identisch für Festung und Nest – Belohnung nach Schadensanteil. |
| **Verortetes galaktisches Objekt** | `spawnWorldBoss()` + `pickRandomFreeSystem()` server.js:4801, `pushGalaxyNews()` | 0.3: fertig geschrieben und unbenutzt. |
| **Feld-Dokument je System** | `astFeldKey(sysId) = 'asteroids:' + sysId` server.js:7739, `/api/asteroid/field` 7890 | Die Festung lebt **im selben Dokument** wie der Gürtel dieses Systems – ein Abruf, ein Zustand. |
| **Rechteprüfung** | `checkAllianceKeyPermission()` server.js:685, aufgerufen aus der Storage-PUT-Route | Muster für die Schreibsperre auf die neuen Schlüssel. |
| **Konterrollen** | `COUNTER_ROLE_DEFS` Z. 23149 (abfang / bomber / kapital), `COUNTER_ROLE_OF` Z. 23154 | **Der Kern des Festungskampfes** (4.4) – drei Rollen, drei Bauteile, keine neue Mechanik. |
| **Gefechtsvorräte** | `GEFECHTSVORRAETE` Z. 23350, serverseitig gebucht (Backend-CLAUDE.md, 18.08.2026) | wirken unverändert mit, weil die Kraftberechnung dieselbe bleibt |
| **Koordinierter Angriff** | `/api/musterattack/*` server.js:6931–7216 | 0.4: das PvE-Ziel für die Königin |
| **Boss-Modulsets** | `MODULE_SET_DEFS` Z. 24508, `bossKey:'schwarmmutter'` Z. 24535 | Das Alien-Set existiert bereits – es bekommt eine zweite, verortete Quelle statt eines neuen Sets |
| **Galaxie-Nachrichten** | `pushGalaxyNews(icon, text)` server.js:4280 | Erscheinen, Reifen, Ausbreiten und Fall jedes Objekts sind Weltgeschichte |
| **Nachbarschaft der Systeme** | `SYSTEM_NEIGHBORS` server.js:1495 (k=4, euklidisch, in `rebuildSystemTables()` server.js:1501 aufgebaut) | Die Ausbreitung der Nester nutzt dieselbe Tabelle wie die Fraktions-Expansion – keine zweite Distanzrechnung |
| **Vorboten** | `VORBOTEN` Z. 28088 (vier Einträge, level-gebunden) | Ein fünfter Eintrag führt neue Spieler an die Festungen heran |

**Was ausdrücklich NICHT gebraucht wird:** kein neuer Missions-Mechanismus, keine neue
Kampfformel, kein WebSocket, keine neue Währung, keine zweite Kartenzeichnung.

---

## 4. Asteroidenfestungen

### 4.1 Wo sie stehen

Eine Festung besetzt **einen freien Platz auf der Gürtelbahn** eines Gürtelsystems – dieselben zehn
Positionen, auf denen die Vorkommen liegen, dieselbe Ellipse `guertelRx()`, dieselbe Adressierung
`sysId + ':' + platz`. Je Gürtelsystem steht **höchstens eine** Festung; galaxieweit sind
höchstens **sechs** gleichzeitig aktiv (`FESTUNG_MAX_AKTIV = 6`, also knapp ein Drittel der zwanzig
Gürtelsysteme).

**Warum eine je System und nicht mehr:** Die Festung wirkt auf **das ganze System** (4.3). Zwei
Festungen im selben Gürtel würden ihre Blockaden stapeln, und der Spieler stünde vor einer
Rechnung statt vor einer Entscheidung. Eine je System heißt außerdem: die Blockade ist genau dann
weg, wenn die Festung fällt – keine Restwirkung, kein „schon wieder".

**Warum sechs und nicht zwanzig:** Bei zwanzig gäbe es kein unblockiertes Gürtelsystem mehr, und
der Blockade-Malus wäre keine Bedrohung, sondern eine Steuer. Bei sechs bleibt immer die Wahl
„woanders schürfen oder die Festung schleifen" – und genau diese Wahl ist der Inhalt.

Der Platz wird beim Entstehen **zufällig aus den freien** gewählt. Weil `astNachschub()`
(server.js:7830–7866) neue Vorkommen ebenfalls auf zufällige freie Plätze setzt, gibt es hier eine
echte Kollisionsgefahr – Abschnitt 4.7 nennt die eine Zeile, die sie verhindert, und den Test dazu.

### 4.2 Drei Ausbaustufen, gewählt nach Entfernung

Die Stufe hängt an `asteroidFerne(sysId)` (Z. 13366) – dem bereits vorhandenen Maß „0 = Heimat,
1 = äußerster Rand", das schon die Größenverteilung der Vorkommen steuert. Damit findet ein
Anfänger in Reichweite eine Festung, die er auch knacken kann, während die harten Brocken dort
stehen, wo Flugzeit und Treibstoff ohnehin wehtun. **Eine zweite Schwierigkeitszahl wird dafür nicht
erfunden.**

| Stufe | `ferne` | Gesamt-LP | Schild (25 %) | Türme (20 %) | Blockade | Hort/Std. | Hort-Deckel |
|---|---|---|---|---|---|---|---|
| **Vorposten** | < 0,40 | 120.000 | 30.000 | 24.000 | −25 % | 2.000 | 120.000 |
| **Bastion** | 0,40–0,74 | 450.000 | 112.500 | 90.000 | −40 % | 6.000 | 400.000 |
| **Zitadelle** | ≥ 0,75 | 1.500.000 | 375.000 | 300.000 | −55 % | 15.000 | 900.000 |

**Woher die Lebenspunkte kommen – nachgerechnet, nicht geschätzt.** Maßstab ist die
Angriffskraft, die der Server aus einer echten Flotte rechnet
(`computeAttackPowerFromComposition()`, server.js:5935 → `rawFleetPower()`, server.js:2830). Die
Gewichte dort: Jäger 10, Kreuzer 20, Zerstörer 45, Bomber 60, Schlachtschiff 90,
Superschlachtschiff 220, Leerenjäger 140, Singularitäts-Vernichter 280.

- Ein **Mittelfeld-Konto** (etwa 60 Kreuzer, 40 Zerstörer, 30 Bomber, 10 Schlachtschiffe) kommt roh
  auf `60·20 + 40·45 + 30·60 + 10·90 = 5.700`; mit Kampfforschung (`rkampf`/`rkampf2`, je +2 %/Stufe)
  und Flotten-Diversität liegt es bei rund **7.000**.
- Ein **Endspiel-Konto** (200 Superschlachtschiffe, 100 Leerenjäger, 50 Vernichter) kommt roh auf
  `200·220 + 100·140 + 50·280 = 72.000`, mit Werftmarken und Forschung auf **90.000 bis 120.000**.

Bei einem Schaden von Kraft × 0,8–1,2 je Schlag (dieselbe Streuung wie beim Weltboss,
server.js:5985) und **sechs Stunden Abklingzeit je Festung und Spieler**:

| | Mittelfeld allein | Endspiel allein | drei Endspiel-Konten |
|---|---|---|---|
| Vorposten (120k) | 17 Schläge ≈ 4 Tage | 1–2 Schläge ≈ 6 Std. | 1 Runde |
| Bastion (450k) | 64 Schläge – unrealistisch | 5 Schläge ≈ 1,2 Tage | 2 Runden ≈ 12 Std. |
| Zitadelle (1,5 Mio) | aussichtslos | 15 Schläge ≈ 3,8 Tage | 5 Runden ≈ 1,3 Tage |

Das ist die beabsichtigte Staffelung: **Der Vorposten ist ein Solo-Ziel, die Bastion eine Frage von
zwei bis drei Tagen oder zwei Mitspielern, die Zitadelle ohne Allianz eine Zumutung.** Die Zahlen
sind bewusst so gewählt, dass eine Festung **nicht** an einem Nachmittag verschwindet – sie soll
lange genug stehen, dass die Blockade spürbar ist und der Hort wächst.

**Die Abklingzeit von sechs Stunden je Festung** (nicht je Spieler, wie beim Weltboss die 24
Stunden): Bei sechs gleichzeitigen Festungen kann ein Spieler theoretisch 24 Schläge am Tag führen,
aber nie zwei auf dasselbe Ziel innerhalb von sechs Stunden. Das hält die Belagerung als
Zeitgeschehen zusammen und verhindert zugleich, dass eine einzige Abklingzeit alle sechs Ziele
sperrt – wer weit fliegt, soll das dürfen. Gespeichert wird sie wie beim Weltboss **im eigenen
Spielstand** (`save.festungLetzterSchlag[<sys>]`), nicht am Festungsobjekt: So überlebt die Sperre
den Fall und den Neuaufbau einer Festung, und der Server setzt sie durch, statt ihr zu glauben
(Vorbild: `save.worldBossLastAttack`, server.js:5971–5978, samt der Begründung im Kommentar dort).

### 4.3 Was sie tut, solange sie steht – Blockade und Hort

Eine Festung, die nur Lebenspunkte hat, ist ein Sandsack. Zwei Wirkungen machen sie zu einer
Entscheidung:

**(1) Blockade.** Solange die Festung steht, liefert **jede Abbaumission in diesem Gürtelsystem**
25 / 40 / 55 % weniger Ladung. Angewandt wird der Malus dort, wo die Ladung ohnehin entsteht – in
`abbauPlan()` (Z. 55224) auf `ladung`, **vor** dem `Math.min(wunsch, …)`. Damit erscheint er
automatisch in der Vorschau, im Missionseintrag und im Rückkehr-Bericht, ohne dass drei
Anzeigestellen einzeln nachgezogen werden müssen (Pflichtpunkt 6).

Bewusst **nicht** gedeckelt wird die Förder*rate*, sondern die *Ladung*: Eine gedrosselte Rate
verlängert nur die Abbauzeit (`abbauBasis = ladung / rate`), und der Spieler bekäme am Ende dieselbe
Fuhre nach längerem Warten – eine Blockade, die man aussitzen kann, ist keine.

**Und sie steht auf beiden Seiten – das ist der wichtigere Teil.** `abbauPlan()` läuft im Client;
eine Blockade, die nur dort rechnet, ist eine Anzeige und keine Regel. Der Server hat die passende
Stelle aber schon: `/api/asteroid/mine` (server.js:7909) begrenzt die entnommene Menge auf
`obergrenze`, eine Kapazität, die er aus den Minenschiffen und Frachtern des **gespeicherten**
Spielstands selbst ausrechnet (server.js:7929–7947), und der Kommentar dort nennt die Haltung
ausdrücklich: *„Ehrliche Grenze … Der Server prüft BESITZ im gespeicherten Stand – mehr nicht, und
mehr behauptet das Konzept auch nicht."* Der Blockade-Faktor gehört genau dorthin, als eine Zeile:

```js
const blockade = feld.festung ? FESTUNG_STUFEN[feld.festung.stufe].blockade : 0;   // 0 | 0.25 | 0.40 | 0.55
const menge = Math.max(0, Math.min(wunsch, vork.vorrat, Math.floor(obergrenze * (1 - blockade))));
```

Damit ist die Blockade **serverseitig durchgesetzt** und nicht nur angezeigt – und weil beide Seiten
denselben Faktor führen, gehört sie in die Paritäts-Familie (`test_festung_paritaet.js`,
Abschnitt 10), genau wie `SHIP_SCORE_WEIGHTS` oder die Kosmetik-Definitionen.

**(2) Hort.** Was die Festung dem Gürtel entnimmt, häuft sie an. Je Stunde wachsen 2.000 / 6.000 /
15.000 Einheiten an, gedeckelt bei 120.000 / 400.000 / 900.000. Die Zusammensetzung folgt den
**Sorten, die in diesem Gürtelsystem tatsächlich liegen** (`AST_SORTEN`-Anteile der belegten Plätze,
server.js:7704) – eine Festung im Eiskern-Revier hortet Deuterium, eine im Prismen-Revier
Kristalle. Der Deckel ist nach 60 / 67 / 60 Stunden erreicht.

**Woher der Deckel kommt – nachgerechnet.** Der Hort soll ungefähr das zurückgeben, was die
Blockade gekostet hat, sonst ist er entweder eine Strafe oder ein Geschenk. Ein Gürtelsystem trägt
drei bis acht Vorkommen (`AST_GRENZE_MIN/MAX = 3/8`, server.js:7698) mit Vorräten von 50.000
(Splitter) bis 1,5 Mio (Koloss, Z. 13205–13209). Wird ein solches System aktiv beschürft, wandern
grob 200.000 bis 400.000 Einheiten am Tag heraus. Bei −55 % über die 60 Stunden bis zum
Zitadellen-Deckel entgehen den Spielern also rund **275.000 bis 550.000** Einheiten. Der Hort von
900.000 liegt oberhalb davon – und das ist Absicht: Er wird unter **allen** Angreifern nach
Schadensanteil aufgeteilt, während die Blockade nur die trifft, die dort schürfen. Für den
einzelnen Angreifer bleibt der Anteil damit deutlich unter dem, was er ohne Festung gefördert
hätte. **Der Hort belohnt das Schleifen, er bezahlt es nicht.**

**Was eine Festung ausdrücklich NICHT tut: sie zerstört keine Schiffe außerhalb eines Kampfes.**
Der naheliegende Einfall wäre, dass sie stationierte Eskorten (`state.asteroidEskorten`) beschießt.
Das geht nicht, und der Grund ist keine Bequemlichkeit: Diese Schiffe stehen im **Spielstand des
Halters**, und der Server schreibt grundsätzlich keine fremden Spielstände – der Weltboss-Code sagt
das ausdrücklich (server.js:4205–4207: *„keine Schreibzugriffe auf fremde Spielstände – die würden
mit dem Autosave online spielender Nutzer kollidieren"*). Eine Lösung über „der Client bucht die
Verluste beim nächsten Laden selbst ab" wäre eine clientautoritative Schadensmeldung an einer
Stelle, an der es etwas zu holen gibt. Deshalb: **Die Festung kostet Ertrag, niemals Besitz.**

### 4.4 Der Kampf: drei Ziele statt einer Zahl

Der eigentliche Inhalt. Eine Festung hat drei angreifbare Teile, und **die drei vorhandenen
Konterrollen** (`COUNTER_ROLE_DEFS`, Z. 23149) entscheiden, wie gut man sie trifft:

| Bauteil | Wirkung, solange es steht | Wirksame Rolle | Rollen-Faktor |
|---|---|---|---|
| **Schildkuppel** | Treffer auf den Kern zählen nur zu **35 %** | **Bomber** (`bomber`) | ×1,6 · andere ×0,7 |
| **Geschütztürme** | eigene Verluste **30 %** statt 8 % | **Abfangjäger** (`abfang`) | ×1,6 · andere ×0,7 |
| **Kern** | die Festung lebt | **Großkampfschiffe** (`kapital`) | ×1,3 · andere ×0,85 |

Vor dem Abflug wählt man im Flottenwahl-Feld ein **Ziel** (`ziel: 'schild' | 'tuerme' | 'kern'`) –
ein Auswahlfeld neben der Schiffswahl, technisch dasselbe Muster wie die Doktrin-Auswahl. Der
Schaden geht auf dieses Bauteil; ist es schon zerstört, geht er ohne Rollenfaktor auf den Kern (die
Flotte wird nicht bestraft, wenn ein Mitspieler schneller war).

**Warum diese Zuordnung und keine andere:** Sie steht bereits in den Rollentexten des Spiels.
„Bomber: schwere Waffen gegen große Ziele – reißt Großkampfschiffe auf" – eine Schildkuppel ist das
größte denkbare Ziel. „Abfangjäger: schnell und wendig" – genau das, was man gegen Geschütztürme
braucht. „Großkampfschiff: schwer gepanzert mit breiter Abwehr" – das Schiff, das im Feuer stehen
bleibt und den Kern bearbeitet. Es wird **keine** neue Rolle, keine neue Tabelle und kein neuer
Text erfunden; `COUNTER_ROLE_OF` (Z. 23154) ordnet bereits **24 Schiffsklassen** einer der drei
Rollen zu – nachgezählt 8 Abfangjäger, 7 Bomber, 9 Großkampfschiffe, genau die Verteilung, die der
Kommentar dort nennt. Rein zivile Rümpfe (Frachter, Späher, Forscher, Recycler, Kolonieschiff,
Schürfschiff) stehen bewusst ohne Rolle und tragen deshalb weder Bonus noch Malus.

**Der Rollenfaktor rechnet nach Anteil, nicht nach Anwesenheit.** Ein einzelner Bomber in einer
Flotte aus zweihundert Kreuzern darf den Schildbonus nicht auslösen. Der Faktor ist deshalb
`1 + (1,6 − 1) · anteil`, wobei `anteil` der Anteil der passenden Rolle an der **Angriffskraft** der
Flotte ist (nicht an der Schiffszahl – sonst wären hundert Jäger mehr wert als zehn
Superschlachtschiffe). Dieselbe „nach Anteil"-Konstruktion nutzt der reguläre Kampf bereits
(Kommentar bei `COUNTER_ROLE_OF`: *„weil der Konter nach dem ANTEIL an der Gegnerflotte wirkt"*).

**Die Schildkuppel regeneriert** 2 % ihrer Maximal-LP je Stunde, solange sie nicht zerstört ist.
Damit ist „einmal anfangen und drei Wochen liegen lassen" kein Weg, und eine Belagerung bleibt eine
Belagerung. Zerstört ist zerstört: Ein gefallener Schild kommt nicht wieder. Türme regenerieren
nie – sonst wäre der Verlust-Vorteil, den man sich erkämpft hat, wieder weg, bevor die zweite Welle
da ist.

**Der Ablauf einer Angriffsmission** (Missionstyp `festung-angriff`), gebaut nach dem Muster der
Abbaumission und **nicht** nach dem der Anfechtung (siehe 0.6):

1. `oeffneFlottenwahl()` mit Zielwahl → Vorschau nennt Flugzeit, Treibstoff, Rollenanteile und die
   erwartete Verlustspanne. **Keine Schadens-Prozentzahl** – der Server rechnet mit Werten, die der
   Client nur teilweise kennt (Werftmarken, Gefechtsvorräte, Doktrin des Servers). Eine Zahl hier
   wäre eine Behauptung, die der Kampf danach widerlegt; genau diese Begründung steht schon an der
   Anfechtungs-Vorschau (Z. 13840–13842).
2. `startTime: jetzt`, `hinBis: jetzt + (flug/2)*1000`, `endTime: jetzt + flug*1000`.
3. Bei `hinBis` löst der Ankunfts-Durchgang in `checkMissions()` den Kampf aus (`m.kampfErledigt`
   verhindert das zweite Feuern), ruft `POST /api/festung/angriff` und bucht die zurückgemeldeten
   eigenen Verluste ab.
4. Die Flotte fliegt weiter und ist bei `endTime` zu Hause. Die Missionskarte zeigt „Anflug" bzw.
   „Rückflug" (Z. 58483-Muster).

### 4.5 Belohnung

**Beim Fall der Festung** wird der Hort nach **Schadensanteil am Kern** aufgeteilt – dieselbe
Mathematik wie beim Weltboss (`contributions`, server.js:5999–6004). Wer nur Schild oder Türme
bearbeitet hat, geht damit nicht leer aus: Schaden an Schild und Türmen zählt zu **60 %** auf den
Anteil. Das ist der Ausgleich dafür, dass diese Arbeit dem Verband nützt und nicht dem eigenen
Zähler – ohne ihn würde niemand den Schild angreifen, und die ganze Rollen-Mechanik wäre tot.

Dazu, fest je Stufe und **unabhängig von der eigenen Wirtschaft** (die Belohnungsformel „N Minuten
eigene Produktion" ist in diesem Projekt mehrfach explodiert und steht als bekannter Fallstrick in
der CLAUDE.md):

| | Vorposten | Bastion | Zitadelle |
|---|---|---|---|
| Hort (Rohstoffe, geteilt) | bis 120.000 | bis 400.000 | bis 900.000 |
| Kampfpunkte | 40 | 120 | 350 |
| Erfahrung | 300 | 900 | 2.600 |
| Modulfragmente (Top-Schädiger) | 4 | 12 | 30 |
| Modulfragmente (übrige, anteilig) | 1–3 | 3–8 | 8–20 |
| **Protomaterie** | – | – | **12–30** |
| Modul-Chance (Standort) | 8 % selten | 15 % episch | 25 % legendär |

**Warum Protomaterie ausgerechnet hier:** `docs/tier3-protomaterie-konzept.md` und die Hausregel 41
halten fest, dass Protomaterie **flugzeitgebunden** bleiben muss – eine Dauerfabrik skaliert mit
Standorten und Stufen, eine flugzeitgebundene Quelle nicht, und genau daran ist der erste
Tier-3-Entwurf gescheitert (*„eine EINZIGE voll ausgebaute Kette frisst rund 16 Protomaterie je
Stunde, über zehn Standorte 162 – gegen eine Einnahme von 11 bis 32"*). Eine Zitadelle ist die
flugzeitgebundene Quelle in Reinform: Sie steht weit draußen, fällt selten, und die Ausbeute teilen
sich alle Beteiligten. Heute kommt Protomaterie ausschließlich aus dem `urmateriekern`
(Gewicht 3 von 103, also 2,91 % aller Vorkommen, Z. 13203) und pauschal aus großen Fuhren –
eine zweite Quelle mit anderem Rhythmus ist der Sache dienlich, ohne die Knappheit aufzuheben.
Nachgerechnet: Bei sechs Festungen, davon im Mittel zwei Zitadellen, und einer Falldauer von rund
drei Tagen sind das **etwa 14 Protomaterie je Tag für die gesamte Spielerschaft** – gegen eine
Einnahme von 11 bis 32 je Konto und Tag aus dem Gürtel also ein Zuschlag, kein Dammbruch.

**Ein Schlag, der die Festung nicht fällt**, zahlt sofort: 5 Kampfpunkte je Stufe und 3 % des
gehorteten Bestandes als Vorabbeute („aufgebrochene Lager"). Das ist bewusst klein – es soll
verhindern, dass ein Schlag ins Leere geht, wenn ein anderer den Todesstoß setzt, und keine
Schleife eröffnen, in der man Festungen anschlägt, statt sie zu schleifen.

**Erfolge** (`ACHIEVEMENTS`, Z. 19530 – Icons in `ACH_ICONS`, Z. 19730):

| Schlüssel | Name | Bedingung | Icon |
|---|---|---|---|
| `festungerst` | Brecher | Erste Asteroidenfestung geschleift | `ti-building-fortress` |
| `festung25` | Belagerungsmeister der Gürtel | 25 Festungen geschleift | `ti-shield-lock` |
| `zitadelle` | Zitadellenstürmer | Eine Zitadelle geschleift | `ti-building-castle` |
| `dreiteile` | Systematisch | In EINEM Kampf Schild, Türme und Kern getroffen | `ti-target` |

**Alle vier Zeichen stehen bereits im eingebetteten Font.** Nachgezählt am Stand v8.565.0 enthält er
**72** `ti-*`-Glyphen (`grep -o '\.ti-[a-z0-9-]*:before'`, entdoppelt) – die CLAUDE.md nennt noch
„rund 69", was seit dem letzten Ausbau überholt ist. Damit entfällt für dieses Konzept der Lauf von
`build-icon-subset.js` vollständig; es kommt **kein einziges neues `ti-*`-Zeichen** hinzu. Geprüft
wird das trotzdem mit `node check-icons.js` – die Whitelist ist die Instanz, nicht diese Tabelle.

### 4.6 Entstehen und Vergehen

Im `galaxyTick` (alle 15 Minuten, server.js:4095):

- **Entstehen:** mit 8 % Chance je Tick, solange weniger als `FESTUNG_MAX_AKTIV = 6` stehen und ein
  Gürtelsystem ohne Festung mit mindestens einem freien Platz existiert. Erwartungswert: eine neue
  Festung je 3,1 Stunden, bis der Deckel greift. Nach dem ersten Tag steht das System dauerhaft bei
  fünf bis sechs.
- **Ankündigung:** `pushGalaxyNews('ti-building-fortress', '…')` – dieselbe Zeile, mit der heute
  Piratenbasen und Alien-Sichtungen gemeldet werden.
- **Vergehen:** Eine Festung läuft **nicht** ab. Sie steht, bis sie fällt. Das ist der Unterschied
  zum Weltboss (der sich nach 36–96 Stunden zurückzieht) und der Grund, warum ihr Hort einen Deckel
  braucht statt einer Frist: Wer sie stehen lässt, verliert Ertrag, aber nichts läuft ihm davon.
- **Nach dem Fall** bleibt das System 24 Stunden festungsfrei (`geraeumtBis`), und alle Spieler
  bekommen dort 24 Stunden lang **+15 % Abbau-Ladung** („geräumter Gürtel"). Das ist die sichtbare
  Gegenbewegung zur Blockade und der Grund, warum sich das Schleifen auch für den lohnt, der beim
  Hort nur einen kleinen Anteil hatte.

### 4.7 Datenmodell und Endpunkte

Die Festung lebt **im selben Dokument wie der Gürtel ihres Systems**: `db.shared['asteroids:<sys>']`
(`astFeldKey()`, server.js:7739). Ein Abruf, ein Zustand, keine zweite Ladequelle – `/api/asteroid/field`
(server.js:7890) liefert sie ohne neuen Endpunkt mit aus.

```js
feld.festung = {
  id: '<uuid>',            // wechselt bei jedem Neuentstehen; Missionen prüfen dagegen
  stufe: 'vorposten' | 'bastion' | 'zitadelle',
  platz: '7',              // einer der zehn Gürtelplätze
  kernMax, kern,           // Lebenspunkte
  schildMax, schild,       // 25 % von kernMax; regeneriert 2 %/h
  tuermeMax, tuerme,       // 20 % von kernMax; keine Regeneration
  hort: { erz: 0, kristalle: 0, ... },
  hortDeckel,
  seit,                    // Zeitstempel des Entstehens (Hort-Wachstum rechnet daraus)
  letzteReifung,           // Zeitstempel der letzten Hort-/Schild-Fortschreibung
  beitraege: { '<userId>': { name, kern, schild, tuerme } }
};
feld.geraeumtBis = 0;      // 24 h Bonusfenster nach dem Fall
```

**Die eine Zeile, die die Kollision mit dem Nachschub verhindert.** `astNachschub()`
(server.js:7830–7866) sucht an **zwei** Stellen freie Plätze (Zeilen 7846–7852 und 7858–7864) und
setzt dort neue Vorkommen. Ohne Änderung würde ein Vorkommen auf der Festung erscheinen und sie
still überschreiben. Beide Schleifen werden deshalb durch **eine** gemeinsame Funktion ersetzt:

```js
function astFreiePlaetze(feld) {
  const belegtDurchFestung = feld.festung ? String(feld.festung.platz) : null;
  const frei = [];
  for (let i = 0; i < AST_PLAETZE_JE_GUERTEL; i++) {
    const k = String(i);
    if (k === belegtDurchFestung) continue;
    const q = feld.plaetze[k];
    if (!q || q.frei) frei.push(k);
  }
  return frei;
}
```

Eine Funktion statt zweier Kopien, damit ein dritter Aufrufer sie automatisch erbt (Regel 43) – und
mit einem eigenen Test, der genau das misst (Abschnitt 10). `astBelegtZahl()` bleibt bewusst
unverändert: Die Festung soll **nicht** als belegtes Vorkommen zählen, sonst hielte sie ein
Gürtelsystem unter der Untergrenze von drei Vorkommen fest, und die Blockade träfe den Gürtel
doppelt.

**Endpunkte** (alle `authMiddleware`, alle nach dem Muster `/api/worldboss/resolve`):

| Endpunkt | Tut | Prüft |
|---|---|---|
| `POST /api/festung/angriff` | löst einen angekommenen Schlag auf | Mission existiert im **gespeicherten** Spielstand, `type === 'festung-angriff'`, `endTime`/`hinBis` erreicht, `festung.id` stimmt, 6-h-Abklingzeit, Ziel gültig |
| *(kein weiterer)* | Zustand kommt über `/api/asteroid/field`, Fall und Hort werden im Angriffs-Endpunkt abgeschlossen | |

`db.shared['asteroids:*']` ist für Clients **schreibgeschützt** – die Sperre existiert bereits
(`checkAllianceKeyPermission()`, server.js:685) und muss nur um das Präfix erweitert werden, falls
sie es noch nicht führt. Ohne sie könnte jeder eingeloggte Nutzer eine Festung per PUT auf 1 LP
setzen; der geteilte Speicher ist ohne ausdrückliche Regel für **jeden** offen (CLAUDE.md, „Bekannte
Fallstricke").

**Der Server rechnet, der Client zeigt.** `POST /api/festung/angriff` nimmt – wie `/api/attack` –
**keinen einzigen Kampfparameter** aus dem Request entgegen. Die Zielwahl steht in der Mission im
gespeicherten Spielstand, genau wie `save.gefechtsvorrat` (Backend-CLAUDE.md, 18.08.2026): Der
Client meldet keine Wirkung, er meldet eine Absicht, und die stand schon vor dem Abflug da.

### 4.8 Auf der Karte

- **Sektor-Übersicht:** Das Abzeichen fließt über `karteSystemBadges()` in die
  `data-sektor-hinweise`-Aggregation – wer über eine Region fährt, sieht „Asteroidenfestung
  (Zitadelle) bei Chronos-Gürtel" im Tooltip.
- **Sektoransicht:** 🛡-Abzeichen am Systemknoten, Titel nennt Stufe und den Blockade-Malus.
- **Offene Systemebene:** eigene SVG-Gruppe `data-map-festung` auf `asteroidPlatzXY(platz)` –
  ein sechseckiger Rumpf statt einer Scheibe, damit sie sich auf einen Blick von einem Vorkommen
  unterscheidet, mit einem **Schildbogen darüber, solange die Kuppel steht**, und drei kleinen
  Geschützpunkten, die verschwinden, wenn die Türme fallen. Der Zustand ist damit **am Bild**
  ablesbar, nicht erst im Menü.
- **Kollision:** über `kbMarkerFrei(pos, planeten, sonnenR, markerR)` mit `markerR = 13`. Sie steht
  auf der Gürtelbahn zwischen dem 3. und 4. Orbit und kann dort mit den Planetenscheiben
  kollidieren – dafür ist der Schieber da (Regel 52), und `tests/test_kartenmarker.js` wird um den
  neuen Markertyp erweitert.
- **Ebene: „Ereignisse", kein neuer Schalter.** Der erste Entwurf sah einen fünften Schalter
  „Gürtel" vor, der Festungen und Vorkommen zusammen schaltet. Dagegen sprechen zwei gemessene
  Dinge: (a) Die Vorkommen sind heute **an keine Ebene gebunden** (`data-map-asteroid`, Z. 54505 und
  54525, werden unbedingt gezeichnet) – ein Schalter dafür wäre eine Verhaltensänderung an
  bestehendem Inhalt, die niemand bestellt hat; (b) die Leiste hat vier Knöpfe, und die Karte hat
  zwischen KB-10 und KB-13 drei Etappen lang mit dem Platz am Hochformat gerungen (Regeln 49–53) –
  ein fünfter Knopf ist genau die Art Zugabe, die dort zuletzt Bedienbarkeit gekostet hat. Es bleibt
  eine Festung je Gürtelsystem; sie überfüllt nichts.
- **Kartenmenü:** `festungMapMenu()` mit den Einträgen „Angreifen" (öffnet die Flottenwahl mit
  Zielwahl) und – gesperrt mit Grund – während laufender Abklingzeit „Noch 4 Std. 12 Min." Der
  Info-Block zeigt drei Balken (Schild, Türme, Kern) und den Hort, exakt nach dem Muster des
  Vorrats-Balkens im Asteroiden-Menü (Z. 55537–55539).
- **Missionslinie:** `MISSION_LINIEN` (Z. 54190) bekommt `'festung-angriff': { hin:'#e0a548',
  rueck:'#5dcaa5', rundflug:true, was:'Festungssturm' }`, und `missionMapZiel()` (Z. 54200) muss den
  neuen Typ auf `asteroidPlatzXY(platz)` abbilden – heute kennt es nur `attack` (NPC-Marker) und
  Planeten-Ziele, alles andere landet still bei `null`.

### 4.9 Solo-Modus

Ohne Backend (`useBackend() === false`) gibt es kein geteiltes Feld – `asteroidFeldGeteilt()`
(Z. 13444) ist dann falsch, und der Gürtel wird lokal erzeugt. Dieselbe Trennung gilt hier:

- **Es gibt Festungen**, aber sie sind **privat**: eine je Spielstand, im lokal erzeugten Gürtel,
  mit denselben drei Bauteilen und denselben Rollen-Regeln.
- **Der Kampf wird clientseitig aufgelöst** – wie beim Piratennest und beim NPC-Angriff. Das ist
  unbedenklich, weil ohne Server niemand anderes betroffen ist: Die Sicherheitsgrenze dieses
  Projekts lautet „kann ich etwas anfassen, das ANDEREN gehört?", und im Solo-Modus gibt es keine
  Anderen.
- **Kein Hort-Wachstum in Echtzeit**, sondern eine feste Beute je Stufe (der Mittelwert der
  geteilten Variante), damit Offline-Zeit keine Belohnung erzeugt.
- **Keine Protomaterie** aus der Solo-Zitadelle. Sie ist eine Endgame-Ressource der geteilten
  Wirtschaft; eine private, beliebig wiederholbare Quelle dafür wäre genau die Selbstbedienung, vor
  der der gestrichene Wochenpass warnt.

---

## 5. Aliens

### 5.1 Was aus den vier Völkern wird

Die vier Namen bleiben, was sie sind – aber jeder bekommt einen **Charakter** und ein **Nest**. Das
Vorbild sind die fünf Allianz-Raid-Bosse (`ALLIANCE_RAID_BOSSE`, Z. 42915), deren Eigenart die
Zusammensetzung des Verbandes belohnt statt nur seine Größe. Die Schwächen folgen der
NPC-Schreibweise (`WEAKNESS_NAMEN`, Z. 23252), damit die Anzeige- und Kampfkette unverändert greift.

| Volk | Eigenart | Schwäche | Reifezeit je Stufe | LP-Faktor | Was es dem System antut |
|---|---|---|---|---|---|
| **Kryll-Schwarm** | wächst am schnellsten, verbreitet sich am weitesten | `jaeger` | 6 Std. | ×0,8 | Ausbreitungs-Chance ×1,5 |
| **Xantheer-Kollektiv** | zäh und langsam, Kollektivpanzerung | `bomber` | 10 Std. | ×1,4 | – |
| **Nomaden von Vex** | breitet sich nicht aus, das Nest **wandert** alle 12 Std. | `destroyer` | 8 Std. | ×1,0 | verlässt das System, statt es zu teilen |
| **Die Verglühten** | verstrahlt sein Umfeld | `schlachtschiff` | 8 Std. | ×1,1 | Flugzeit **zu diesem System** +20 % |

**Warum vier Charaktere und nicht ein Nest-Typ:** Vier gleiche Nester wären vier Zahlen. Mit
Eigenarten entscheidet der Spieler, welches Nest zuerst weg muss – der Kryll, weil er sonst vier
wird, oder das Xantheer, weil es allein nie kleiner wird. Und die Schwäche macht die
Flottenauswahl zu einer Frage, nicht zu einer Formalität; genau das war die Begründung, mit der die
Raid-Bosse ihre Eigenarten bekamen (Kommentar Z. 42905–42914: *„damit kann die Belohnungsrate durch
die Neuerung nur sinken, nie steigen – und Zusammensetzung zählt zum ersten Mal überhaupt"*).

Der Nomade ist dabei der bewusste Ausreißer: Ein wanderndes Nest ist ein Ziel, das man **verlieren**
kann, wenn man zu lange zögert – der Angriff fliegt ins Leere, und die Flotte kommt ohne Kampf
zurück (die Mission meldet das ehrlich, statt still nichts zu tun; vgl. das Verhalten bei
`arrivedTooLate` im Weltboss, server.js:5994).

### 5.2 Das Nest: vier Stufen und eine Königin

| Stufe | Bezeichnung | LP (× Volksfaktor) | Stufenpunkte (5.4) | Was sie zusätzlich tut |
|---|---|---|---|---|
| 1 | Sporenherd | 40.000 | 1 | nichts außer wachsen |
| 2 | Brutkammer | 120.000 | 2 | – |
| 3 | Schwarmstock | 400.000 | 3 | Ausbreitungs-Würfe beginnen |
| 4 | Hochnest | 1.200.000 | 4 | Ausbreitungs-Wurf alle 8 Std. |
| 5 | **Königin** | 4.000.000 | 5 | keine Ausbreitung mehr – die Entscheidung |

Die **Stufenpunkte** sind die einzige Zahl, mit der ein Nest auf die Galaxie wirkt: Ihre Summe über
alle Nester bestimmt den Zielwert der galaktischen Gegnerstärke (5.4). Ein Sporenherd zählt also
bereits – schwach, aber sichtbar.

Ein Nest reift je Volk alle 6 bis 10 Stunden um eine Stufe. Vom Sporenherd bis zum Hochnest sind
das **18 bis 30 Stunden**; die Königin schlüpft erst unter der Bedingung in 5.3.

**Die Lebenspunkte gegen dieselben Maßstäbe wie bei den Festungen** (4.2): Ein Sporenherd (40.000)
fällt einem Endspiel-Konto in einem einzigen Schlag, einem Mittelfeld-Konto in sechs. Ein Hochnest
(1,2 Mio) verlangt zwölf Endspiel-Schläge, also drei Spieler über einen Tag. Eine Königin
(4 Mio) ist mit 40 Endspiel-Schlägen ausgelegt: **das Ereignis, für das eine Allianz zusammenkommt.**
Abklingzeit: **4 Stunden je Nest und Spieler** – kürzer als bei der Festung, weil ein Nest im
Gegensatz zu ihr davonläuft.

### 5.3 Ausbreitung und die Königin

- Ein Nest ab Stufe 3 würfelt alle 8 Stunden mit 35 % (Kryll: 52 %) auf **Ausbreitung**. Trifft es,
  entsteht in einem **benachbarten freien System** ein neues Nest der Stufe 1.
  **„Benachbart" ist keine neue Rechnung**: `SYSTEM_NEIGHBORS` (server.js:1495) führt zu jedem System
  bereits die `SYSTEM_NEIGHBOR_K = 4` nächstgelegenen anderen – aufgebaut in `rebuildSystemTables()`
  (server.js:1501) über genau die euklidische Distanz der Kartenkoordinaten und beim Wochenwechsel
  mitgezogen. Der Kommentar dort sagt, wofür es gedacht war: *„Wird für Fraktions-Expansion (nur in
  benachbarte Systeme) genutzt."* Der Schwarm breitet sich damit **nach derselben Nachbarschaft aus,
  nach der die vier NPC-Fraktionen expandieren** – eine Tabelle, zwei Nutzer. Ist kein Nachbar frei
  („frei" nach derselben Regel wie `pickRandomFreeSystem()`, server.js:4801 – also **nie** in einem
  System, in dem ein Spieler zu Hause ist), verfällt der Wurf.
- Galaxieweit sind höchstens **`NEST_MAX = 12`** Nester gleichzeitig aktiv. Ist der Deckel erreicht,
  verfallen weitere Würfe.
- Hat ein Volk **vier oder mehr Nester** gleichzeitig, schlüpft am **ältesten** davon die
  **Königin** (Stufe 5). Ab da breitet sich dieses Volk nicht weiter aus – der Schwarm sammelt sich.
- **Fällt die Königin, stirbt der ganze Schwarm dieses Volkes**: alle Nester dieses Volkes
  verschwinden, das Volk pausiert 72 Stunden und beginnt danach wieder mit einem einzelnen
  Sporenherd. Der Fall wird als Galaxie-Nachricht gemeldet, und die Karte wird sichtbar leer.

**Die Spannung, die das erzeugt – und sie ist beabsichtigt.** Wer früh räumt, zahlt wenig und
bekommt wenig. Wer wachsen lässt, bekommt die Königin mit ihrer großen Ausschüttung – **aber die
höhere Gegnerstärke bezahlen in der Zwischenzeit alle** (5.4). Das ist ein echtes Dilemma zwischen
individuellem Ertrag und gemeinsamen Kosten, und es ist der Grund, warum dieses System auf einem
Server mit mehreren Spielern anders gespielt wird als allein. Es ist zugleich das **größte Risiko**
des Konzepts – Abschnitt 11.1 sagt, woran man merken würde, dass es kippt, und was dann zu tun ist.

### 5.4 Was Vernachlässigung kostet: `npcEmpireStrength` bekommt ein Gegenspiel

Der heutige Stand (0.2): Der Wert wächst monoton bis 2,5 und bleibt dort. Neu leitet der
`galaxyTick` einen **Zielwert** aus dem Nestbestand ab und lässt den Ist-Wert dorthin driften:

```js
const stufenSumme = alienNester.reduce((a, n) => a + n.stufe, 0);
const ziel = Math.min(2.5, 1.0 + 0.08 * stufenSumme);
g.npcEmpireStrength += (ziel - g.npcEmpireStrength) * 0.04;   // 4 % des Abstands je Tick
```

Nachgerechnet:

| Lage | Stufensumme | Zielwert | Wirkung auf `npcEffectiveDefense()` |
|---|---|---|---|
| Galaxie geräumt | 0 | **1,00** | NPC-Verteidigung wie im Grundzustand |
| ruhig (4 Nester, Stufe 2) | 8 | **1,64** | +64 % |
| angespannt (8 Nester, Stufe 3) | 24 | **2,50** (Deckel) | +150 %, wie heute |
| Königinnenlage (12 Nester + Königin) | ≥ 30 | **2,50** (Deckel) | wie heute |

Bei 4 % Annäherung je Tick (96 Ticks/Tag) ist die Hälfte des Abstands nach **17 Ticks ≈ 4,3
Stunden** überwunden, 95 % nach **rund 19 Stunden**. Die Galaxie reagiert also innerhalb eines
Tages sichtbar – schnell genug, dass eine geräumte Nacht sich lohnt, langsam genug, dass ein
einzelner Angriff die Weltlage nicht umschaltet.

**Das ist eine Balance-Änderung, und sie muss als solche angekündigt werden.** Heute steht der
Faktor dauerhaft auf 2,5; künftig wird er zwischen 1,0 und 2,5 pendeln und im Normalbetrieb eher
bei 1,6 bis 2,2 liegen. **Alle 18 NPC-Gegner werden dadurch im Mittel leichter.** Das ist gewollt –
ein Schwierigkeitsregler, den niemand bewegen kann, ist kein Spielelement –, aber es ist eine
spürbare Änderung an bestehenden Zahlen und gehört in die Patchnotes, nicht in eine Fußnote. Die
konservative Gegenvariante (Basis 1,4 statt 1,0, sodass die geräumte Galaxie bei 1,4 landet) steht
als offene Entscheidung in 11.2.

**Ein zweiter, lokaler Kostenpunkt:** Liegt ein Nest der Stufe 3+ in einem der vier **Nachbarsysteme**
deines Heimatsystems – dieselbe `SYSTEM_NEIGHBORS`-Tabelle wie bei der Ausbreitung, keine zweite
Distanzregel –, steigt die Häufigkeit der Piratenüberfälle auf dich (`maybeScheduleRaid`) um 25 %. Das ist ausdrücklich eine **Spielregel, keine Sicherheitsgrenze** –
sie lebt im Client wie die Warteschlangen-Grenzen, und der Client rechnet seine Überfälle ohnehin
selbst aus. Wer sie durch Manipulation abschaltet, nimmt sich Trümmerfelder und Kampfpunkte weg;
es gibt dort nichts zu holen (dieselbe Prüffrage wie bei den Routen-Erlösen im Markt-Deckel, mit
demselben Ergebnis).

### 5.5 Der Kampf – allein, im Verband, gegen die Königin

Ein Nest wird angegriffen wie ein NPC: Kartenmenü → „Nest angreifen" → Flottenwahl → Mission
`nest-angriff` mit `hinBis`/`endTime` nach dem Abbaumissions-Muster → bei Ankunft
`POST /api/alien/nest-angriff`. Der Server rechnet die Kraft aus dem gespeicherten Spielstand,
zieht Lebenspunkte ab, verbucht den Beitrag und meldet die eigenen Verluste zurück.

Drei Unterschiede zur Festung, alle mit Absicht:

1. **Keine Bauteile.** Ein Nest ist ein Ziel, keine Anlage. Statt der drei Bauteile wirkt die
   **Schwäche des Volkes**: Ohne den passenden Schiffstyp richtet der Verband nur **80 %** Schaden
   an. Bewusst als Malus bei fehlendem Typ statt als Bonus bei vorhandenem – dieselbe Konstruktion
   und dieselbe Begründung wie bei den Raid-Bossen (Z. 42911–42913): So kann die Belohnungsrate
   durch die Neuerung nur sinken, nie steigen.
2. **Höhere eigene Verluste, dafür kein Fehlschlag.** Wie beim Weltboss gibt es keine Niederlage;
   jeder Schlag wirkt. Die Verlustquote steigt mit der Neststufe (8 % + 3 % je Stufe, gedeckelt bei
   35 %) – ein Sporenherd kostet fast nichts, ein Hochnest tut weh.
3. **Der koordinierte Angriff zählt mehr.** Wird ein Nest über die vorhandene
   Musterangriff-Maschinerie angegriffen (`/api/musterattack/*`, 0.4), zählt der Schaden des
   Verbandes **×1,35**. Das ist der Anreiz, den die Maschinerie bisher nicht hatte – und
   ausdrücklich **kein Tor**: Auch ein einzelner Spieler darf die Königin angreifen, er trägt nur
   entsprechend wenig bei. Ein Feature, das Alleinspieler aussperrt, wäre in diesem Spiel ein
   Fremdkörper (der Solo-Modus ist eine bewusste Zusage, siehe 4.9).

**Der Musterangriff auf ein PvE-Ziel** braucht im Backend genau eine Erweiterung: `create` nimmt
zusätzlich `zielArt: 'alien-nest'` mit einer Nest-ID entgegen und prüft sie gegen den echten
Nestbestand; `resolve` verzweigt am `zielArt` auf die Nest-Schadensrechnung statt auf die
Allianzbasis-Rechnung. Sammelfenster, Beitritt, Flugzeit, Verbandsbildung und Belohnungsverteilung
bleiben **unangetastet** – das ist die ganze Arbeit, und sie ist der Grund, warum die Königin in
Phase 5 und nicht in Phase 1 steht.

### 5.6 Belohnung

Nach Schadensanteil, wie überall in diesem Konzept:

| | Sporenherd | Brutkammer | Schwarmstock | Hochnest | **Königin** |
|---|---|---|---|---|---|
| Kampfpunkte | 15 | 45 | 130 | 380 | **1.200** |
| Erfahrung | 120 | 360 | 1.000 | 3.000 | **9.000** |
| Modulfragmente (anteilig) | 1 | 2–4 | 5–10 | 12–25 | **40–90** |
| Kredite | 400 | 1.200 | 3.500 | 10.000 | **30.000** |
| Seltene Materialien | – | – | 1× Fragment | 1× volles Material | **2× „Alte Technologie"** |
| Leerensplitter (Top-Schädiger) | – | – | – | 1 | **4** |
| Modul aus `set_schwarm` | – | – | – | 5 % | **35 %** |

**Warum „Alte Technologie" und nicht eine neue Währung.** `docs/content-ideen.md` hält als eigenen
Abschnitt fest, dass das Spiel bereits Töpfe ohne Senke führt (Bergungsgut, Abgrundsplitter,
Kommandopunkte, Prisengut). Eine „Alien-Biomasse" wäre der fünfte. „Alte Technologie"
(`RARE_ITEMS`, Z. 45293, `chance:0.005`, legendär) ist dagegen der Engpass der Megaprojekte und
heute **ausschließlich** auf Expeditionen zu finden – eine zweite Quelle mit völlig anderem Rhythmus
ist genau das, was dem Material fehlt.

**Warum das `set_schwarm`-Set und kein neues.** Es existiert bereits: vier Teile mit
`bossKey:'schwarmmutter'` (Z. 24355–24362), das Set-Objekt bei Z. 24535, dazu eine handgezeichnete
Boss-Gestalt in der Kampf-Wiedergabe (Z. 36305). Seine einzige Quelle ist heute der Allianz-Raid –
für Spieler ohne aktive Allianz also gar keine. Die Königin gibt demselben Set eine zweite,
verortete Quelle. Das ist billiger als ein neues Set **und** repariert nebenbei den in
`content-ideen.md` belegten Befund, dass die Allianz-Belohnungstöpfe trockenlaufen.

**Erfolge:**

| Schlüssel | Name | Bedingung |
|---|---|---|
| `nesterst` | Erstkontakt | Erstes Alien-Nest geräumt |
| `nest50` | Kammerjäger | 50 Nester geräumt |
| `koenigin` | Königinnenmörder | An einem Königinnen-Kill beteiligt |
| `allevoelker` | Xenologe | Von allen vier Völkern mindestens ein Nest geräumt |

### 5.7 Datenmodell und Endpunkte

Der Nestbestand liegt in `db.galaxy` – dort, wo die verortete Weltgeschichte ohnehin lebt, und
damit automatisch in `/api/galaxy` (`galaxyFuerClient()`, server.js:5480) und in `galaxyCache`
(Z. 15220):

```js
db.galaxy.alienNester = [{
  id, rasse: 'kryll' | 'xantheer' | 'vex' | 'verglueht',
  sys, stufe: 1..5,
  hp, hpMax,
  seit, letzteReifung, naechsterWurf,
  beitraege: { '<userId>': { name, dmg } }
}];
db.galaxy.alienPause = { kryll: <timestamp>, ... };   // 72-h-Sperre nach einem Königinnen-Fall
```

**`unlockedAlienRaces` bleibt bestehen und behält seine Form** – aber sein `system`-Feld wird beim
Reifen auf das **stärkste Nest des Volkes** nachgeführt. Das ist reine Rücksicht auf den Deploy:
Frontend und Backend gehen über **getrennte, fest verdrahtete Befehle desselben Webhooks** live und
sind schon dreimal auseinandergelaufen (Backend-CLAUDE.md, Vorfälle 14./15./18.08.2026). Ein
Frontend, das die Nester noch nicht kennt, zeigt so weiterhin ein sinnvolles 👽-Abzeichen am
richtigen Ort, statt gar keins.

**Endpunkte:**

| Endpunkt | Tut |
|---|---|
| `POST /api/alien/nest-angriff` | löst einen angekommenen Einzelschlag auf – Muster `/api/worldboss/resolve` |
| `POST /api/musterattack/create` | **erweitert** um `zielArt: 'alien-nest'` + `zielId` |
| `POST /api/musterattack/resolve` | **erweitert** um den Nest-Zweig |

Der Nestbestand wird **ausschließlich vom Server** geschrieben. `db.galaxy` ist für Clients
ohnehin nicht per `PUT /api/storage/:key` erreichbar – anders als der Weltboss, dessen Schlüssel
`worldboss:current` im geteilten Speicher liegt und deshalb 2026 eigens abgesichert werden musste
(server.js:625–680). Die Nester in `db.galaxy` zu legen, umgeht diese ganze Klasse von Problemen
von vornherein. **Das ist der eigentliche Grund für die Wahl des Ablageortes**, nicht die Nähe zu
den Alien-Namen.

### 5.8 Auf der Karte

- **Sektor-Übersicht und Sektoransicht:** Das vorhandene 👽-Abzeichen bleibt – aber es sagt jetzt
  etwas: „Kryll-Schwarm · Schwarmstock (Stufe 3) · breitet sich aus". Bei einer Königin wird es 👑
  und trägt eine eigene, auffällige Färbung.
- **Offene Systemebene:** eigene Gruppe `data-map-nest` auf `npcMarkerXY()`-Höhe, aber um 140° im
  Winkel versetzt, damit Nest und NPC nicht denselben Fleck belegen – gerechnet über denselben
  `kbMarkerFrei()` (Z. 54141) mit `markerR = 12` bzw. 20 für die Königin (die einen Pulsring wie
  ein Boss trägt, siehe Z. 54718).
- **Ebene:** „Ereignisse", wie heute. Der Knopf wirbt bereits mit „Aliens" (Z. 3397).
- **Kartenmenü:** `nestMapMenu()` mit „Nest angreifen" und – für Allianz-Offiziere – „Koordinierten
  Angriff ausrufen". Der Info-Block zeigt Volk, Stufe, Lebenspunkte-Balken, Schwäche und den
  nächsten Reifungs-Zeitpunkt als **gerundete Dauer**, nie sekundengenau: Eine laufende Restzeit im
  Kartenmenü würde `setBoxHtml` im Sekundentakt neu schreiben lassen – genau die Tick-Unruhe, wegen
  der die Peilung ihren Tooltip ohne Restzeit führt (Kommentar Z. 53370) und der Markt-Deckel seine
  Restzeit auf Minuten rundet.
- **Missionslinie:** `'nest-angriff': { hin:'#5dcaa5', rueck:'#5dcaa5', rundflug:true, was:'Nest-Angriff' }`.

### 5.9 Solo-Modus

Ohne Backend gibt es keine geteilte Galaxie – `galaxyCache` bleibt auf seinen Vorgabewerten
(Z. 15220), und schon heute sieht ein Solo-Spieler weder Piratenbasis noch Alien-Sichtung noch
Krieg. Für die Nester gilt dasselbe wie für die Festungen (4.9):

- **Nester gibt es auch solo**, lokal erzeugt und lokal gereift (ein Tick-Zähler im Spielstand,
  Muster `nextPlanetEventCheck`), höchstens **drei** gleichzeitig.
- **Keine Wirkung auf `npcEmpireStrength`** – der Wert kommt vom Server und ist solo konstant 1.
  Der lokale Ersatz ist ehrlich klein: ein Nest der Stufe 3+ erhöht die Überfallhäufigkeit, sonst
  nichts. Damit bleibt die Aussage „geräumte Nester machen die Galaxie leichter" eine Aussage über
  die **geteilte** Galaxie und wird solo nicht behauptet.
- **Keine Königin.** Sie ist der Kulminationspunkt eines Ausbreitungs-Geschehens über zwölf Nester;
  bei dreien gäbe es nichts zu kulminieren. Statt eine dünnere Version zu bauen, sagt der Hilfetext
  ausdrücklich, dass sie ein Mehrspieler-Inhalt ist. Ein angekündigtes und dann still weggelassenes
  Feature ist schlimmer als eines, das nie erwähnt wurde (die Begründung, mit der der Wochenpass
  ausdrücklich abgesagt wurde, v8.525.0).

---

## 6. Neue Inhalte im Überblick

Hausregel 7 verlangt zu **jedem** neuen Eintrag ein eigenes Icon **und** eine vollständige,
selbsterklärende Beschreibung – ein ganzer Satz, der Wirkung und Stapelverhalten nennt, kein
Kürzel. Die folgende Liste ist deshalb vollständig und nicht beispielhaft.

### Forschungen (`RESEARCH_DEFS`, Z. 11876)

| Schlüssel | Name | Icon | Wirkung | `desc` (Entwurf) |
|---|---|---|---|---|
| `rbelagerung` | Belagerungsdoktrin | `ti-building-fortress` | +4 % Schaden an Festungsbauteilen je Stufe, max. 12 Stufen (+48 %) | „Schwere Belagerungsleitstände koordinieren das Feuer auf feste Ziele: erhöht den Schaden deiner Angriffe auf Asteroidenfestungen um 4 % je Stufe, bis zu 48 % bei Stufe 12. Wirkt ausschließlich gegen Festungen – auf Nester, NPC-Gegner und Spielerkämpfe hat sie keinen Einfluss." |
| `rxenobiologie` | Xenobiologie | `ti-microscope` | −4 % eigene Verluste an Nestern je Stufe, max. 10 Stufen | „Auswertung erbeuteter Schwarmgewebe: senkt deine Flottenverluste bei Angriffen auf Alien-Nester um 4 % je Stufe, bis zu 40 % bei Stufe 10. Sie senkt nur die Verluste, nicht die Lebenspunkte des Nestes – ein Hochnest bleibt gleich zäh, es kostet dich nur weniger." |

**Beide Forschungen zahlen bewusst NICHT in die gedeckelten Bonus-Gruppen** (`BONUS_GROUPS`,
Z. 17002, `PROD_BONUS_CAP`, Z. 22535) ein: Sie wirken auf **einen einzigen Kampftyp** und können
dort nichts aufschaukeln. Ein Deckel über beide ist deshalb überflüssig – wohl aber sind ihre
eigenen Maxima (12 bzw. 10 Stufen) harte Grenzen, weil eine unbegrenzte Kette hier dieselbe
Explosion erzeugen würde wie überall sonst.

### Gebäude

**Keine.** Der naheliegende Einfall wäre ein „Belagerungshafen", der Festungsangriffe verbilligt.
Das Spiel hat 48 Gebäude, und der Ort, an dem so ein Effekt hingehört, existiert bereits: die
Planeten-Rolle. Ein neues Gebäude wäre ein Eintrag mehr in einer ohnehin langen Liste, ohne eine
Frage zu beantworten, die nicht schon beantwortet ist.

### Schiffe

**Keine.** `SHIP_DEFS` hat 42 Einträge, und der Festungskampf ist gerade deshalb interessant, weil
er die **vorhandenen** Klassen neu bewertet: Wer nie Abfangjäger gebaut hat, merkt an den Türmen
zum ersten Mal, was ihm fehlt. Ein „Belagerungsschiff" würde genau diese Frage wieder zuschütten.

### Module und Kosmetik

- **Kein neues Modulset.** Die Königin speist das vorhandene `set_schwarm` (5.6).
- **Ein neues Standort-Modul** wäre möglich (`effect:'festungsschaden'`), ist aber bewusst **nicht**
  vorgesehen: Der Modul-Effekt-Katalog (`MODULE_EFFECT_LABEL`, Z. 24402) ist bereits breit, und ein
  Effekt, der nur in einem Kampftyp wirkt, ist an einem Standort-Modul schlecht aufgehoben.
- **Kosmetik** (Namensfarben/Embleme aus `KOSMETIK_DEFS` im Backend) ist ein eigenständiges,
  serverseitig verantwortetes System mit Paritätstest (`tests/test_kosmetik_paritaet.js`). Zwei
  Meilenstein-Embleme („Festungsbrecher" ab 25 geschleiften Festungen, „Schwarmbrecher" ab einem
  Königinnen-Kill) passen exakt in die vorhandene Bedingungsart-Mechanik und sind als **Phase 6**
  vorgesehen – nach allem anderen, weil sie eine Backend-Änderung mit Paritätstest sind und kein
  Spielinhalt.

### Gegenstände

**Ein** neuer Verbrauchsgegenstand (`ITEM_DEFS`, 30 Einträge):

| Schlüssel | Name | Icon | Seltenheit | Wirkung | `desc` |
|---|---|---|---|---|---|
| `belagerungsplan` | Belagerungsplan | `ti-list-details` | episch | setzt die Abklingzeit auf **eine** Festung sofort zurück | „Erbeutete Baupläne einer Festungsanlage: Deine Angriffs-Abklingzeit gegen eine Asteroidenfestung deiner Wahl endet sofort, du kannst also unmittelbar erneut zuschlagen. Wirkt auf genau eine Festung und verbraucht sich dabei; auf Alien-Nester und andere Kampfarten hat er keinen Einfluss." |

Fundort: als Beute an Festungen selbst (2 % je Fall) und im Expeditions-Fundpool. Damit ist er der
Gegenstand, der eine Belagerung beschleunigt, ohne sie zu ersetzen – und er stapelt sich nicht:
Wer ihn hortet, verkürzt lediglich mehrere Sechs-Stunden-Fenster.

### Zusammenfassung der neuen Bezeichner

| Art | Neue Einträge |
|---|---|
| Missionstypen | `festung-angriff`, `nest-angriff` (+ 2 Musterangriff-Zielarten) |
| Backend-Endpunkte | `/api/festung/angriff`, `/api/alien/nest-angriff` (+ 2 erweiterte) |
| Geteilte Zustände | `feld.festung` in `asteroids:<sys>`, `db.galaxy.alienNester`, `db.galaxy.alienPause` |
| Spielstand-Felder | `festungLetzterSchlag`, `nestLetzterSchlag`, `festungKills`, `nestKills`, `koeniginKills` |
| Forschungen | `rbelagerung`, `rxenobiologie` |
| Erfolge | 8 (4 + 4, Abschnitte 4.5 und 5.6) |
| Gegenstände | `belagerungsplan` |
| Neue `ti-*`-Zeichen | **0** |
| Neue Währungen | **0** |

---

## 7. Die Anzeigestellen, die mitgezogen werden müssen

Der wiederkehrende Fehler dieses Projekts ist nicht die kaputte Mechanik, sondern die **zweite
Anzeigestelle, die die alte Annahme behält** (CLAUDE.md, Pflichtpunkt 6). Die folgende Liste ist
das Ergebnis eines Durchgangs mit den drei vorgeschriebenen Suchen – nach dem Namen der geänderten
Größe, nach den Wörtern, mit denen sie dem Spieler präsentiert wird, und nach den Grenzwerten als
Literal.

**Blockade (Abbau-Ladung −25/40/55 %):**

| Stelle | Zeile | Was zu tun ist |
|---|---|---|
| `abbauPlan()` | 55224 | die Wirkstelle selbst – Malus auf `ladung`, vor dem `Math.min` |
| Abbau-Vorschau im Kartenmenü | 55453 ff. | eigene Zeile „Blockade durch <Festung>: −40 % Ladung" |
| Missionseintrag im Flotte-Tab | 58503 | Ladung ist beim Start eingefroren; nichts zu tun, aber **prüfen** |
| Rückkehr-Bericht | 38663-Umfeld | die gemeldete Ladung ist bereits die gedeckelte |
| `HELP_SECTIONS` „Asteroiden-Bergbau" | 37738 ff. | Blockade erklären |
| Erträge-Übersicht / Kodex | – | prüfen, ob eine Ertragsprognose existiert, die den Malus nicht kennt |

**Gegnerstärke (`npcEmpireStrength` wird beweglich):**

| Stelle | Zeile | Was zu tun ist |
|---|---|---|
| `npcEffectiveDefense()` | 19448 | die Wirkstelle – unverändert, sie liest den Wert ohnehin live |
| NPC-Gegnerkarte (Vorschau) | 3455-Umfeld | **prüfen**, ob die angezeigte Verteidigung aus derselben Funktion kommt |
| Angriffs-Vorschau auf der Karte | `npcMapMenu` 54059 | dito – die Vorschau muss dieselbe Funktion rufen wie der Kampf (der Fehler von v8.421.0) |
| `HELP_SECTIONS` NPC-Abschnitt | 37738 ff. | Zusammenhang „Nester ↔ Gegnerstärke" erklären |
| Galaxie-Tab | – | eine Zeile „Galaktische Gegnerstärke: 1,8 (fallend)" – der Wert war bisher **nirgends sichtbar**, obwohl er jeden Kampf beeinflusst |

Die letzte Zeile ist ein eigener Befund: `galaxyCache.npcEmpireStrength` wird an genau **einer**
Stelle gelesen (Z. 19448) und **nirgends angezeigt**. Ein Faktor, der die Verteidigung jedes
Gegners um bis zu 150 % anhebt, ohne dass er irgendwo steht, ist eine fehlende Anzeigestelle – und
sobald er beweglich wird, wird sie zur Pflicht.

**Rundflug (0.6):**

| Stelle | Zeile | Was zu tun ist |
|---|---|---|
| Ankunfts-Durchgang in `checkMissions()` | 49485 | Typliste **datengetrieben** statt `\|\|`-Kette |
| `tests/test_rundflug.js` | 138–139 | Falltabelle aus derselben Quelle speisen |
| Missionskarte „Anflug/Rückflug" | 58483, 58563 | die neuen Typen aufnehmen |
| `MISSION_LINIEN` / `missionMapZiel()` | 54190 / 54200 | neue Typen eintragen **und** ihre Zielposition abbilden |

**Sonstige Pflichtstellen:**

- `HELP_SECTIONS` (Z. 37738): zwei neue Abschnitte, **und** die Korrektur des heutigen Satzes
  „Aktuell ohne tiefe mechanische Kopplung ans eigentliche Spiel" (Z. 38049) – ab dem Tag der
  Auslieferung ist er falsch.
- `TUTORIAL_STEPS` (Z. 31928): ein Schritt zur Sektorkarte, der die zwei neuen Zeichen benennt.
- `VORBOTEN` (Z. 28088): ein fünfter Eintrag auf Level 12 („Auf den Gürtelbahnen stehen Anlagen,
  die dort niemand gebaut hat …"), der neue Spieler an die Festungen heranführt.
- `COMPENDIUM_CATS` (Z. 16825): Festungen und Völker als Kompendium-Einträge, damit die
  Weltgeschichte nachlesbar ist.
- Bestenlisten-/Statistik-Zähler: `festungKills`, `nestKills`, `koeniginKills` gehören in die
  Statistik-Anzeige, sonst sind es Felder ohne Anzeigestelle.
- **Prestige- und Aufstiegs-Bewahrlisten:** Die fünf neuen Spielstand-Felder müssen ausdrücklich
  entschieden werden. Vorschlag: Die drei **Lebenszeit-Zähler** (`festungKills`, `nestKills`,
  `koeniginKills`) bleiben über Prestige und Aufstieg erhalten, die zwei **Abklingzeit-Stempel**
  werden zurückgesetzt.
  **Achtung, hier gibt es ein warnendes Beispiel:** `state.piratennesterGeraeumt` (angelegt in
  `applyStateDefaults()`, Z. 28832) ist ausdrücklich als *Lebenszeit-Zähler* gedacht – die
  Randkriege-Handlung „geräumte Piratennester" (Z. 18740) rechnet die Differenz gegen einen
  serverseitig gemerkten Basiswert. Im Prestige-Reset (Z. 29377) taucht das Feld **nicht** auf, und
  der Kommentar bei Z. 28828–28831 sagt selbst, dass es danach `undefined` wäre und auf 0
  zurückfällt. Ob der serverseitige Basiswert dabei mitwandert, ist **nicht geprüft** und gehört vor
  der Umsetzung nachgemessen – ein Zähler, der bei jedem Prestige auf null fällt, während der
  Server seinen alten Stand behält, liefert danach dauerhaft keine Kriegspunkte mehr. Die neuen
  Zähler werden von Anfang an in beide Bewahrlisten eingetragen (Suchbegriff `deckelKappung2026`,
  CLAUDE.md, „Wer einem BESTANDS-Gebäude nachträglich …").

---

## 8. Wo es im Spiel auftaucht

| Ort | Was dort steht |
|---|---|
| **Sektorkarte, Übersicht** | aggregierte Hinweise je Region – 🛡 und 👽/👑 mit Systemnamen im Tooltip |
| **Sektorkarte, Sektoransicht** | Abzeichen am Systemknoten, Tooltip nennt Stufe und Wirkung |
| **Sektorkarte, offenes System** | Festung als sechseckiger Rumpf auf der Gürtelbahn, Nest als Marker; Klick öffnet das Kartenmenü |
| **Galaxie-Tab** | neue Kästen „Asteroidenfestungen" und „Schwarmlage" (Liste aller bekannten Ziele mit Stufe, Lebenspunkte-Balken, Entfernung und Abklingzeit), dazu die Zeile „Galaktische Gegnerstärke" |
| **Galaxie-Nachrichten** | Entstehen, Reifen, Ausbreiten, Fall – über `pushGalaxyNews()` |
| **Berichte-Tab** | zwei neue Berichtstypen in der Kategorie „Kämpfe" (`REPORT_CATEGORIES`, Z. 38187) |
| **Flotte-Tab** | die neuen Missionen mit „Anflug"/„Rückflug" |
| **Fortschritt-Tab** | acht neue Erfolge, zwei neue Forschungen, drei neue Zähler |
| **Hilfe** | zwei neue Abschnitte, ein korrigierter |
| **Tutorial** | ein Schritt |

---

## 9. Umsetzung in sechs Phasen

Jede Phase ist **für sich auslieferbar** und lässt das Spiel in einem sinnvollen Zustand zurück.
Das ist keine Formalie: Ein Merge nach `main` ist in diesem Projekt die Auslieferung selbst
(CLAUDE.md, „Deploy"), und Backend und Frontend gehen über getrennte Befehle live.

| Phase | Inhalt | Frontend | Backend | Ausliefer­bar als |
|---|---|---|---|---|
| **1** | **Festungen ohne Bauteile.** Entstehen im galaxyTick, Blockade, Hort, ein Lebenspunkte-Vorrat, Angriffsmission mit Rundflug, Karte, Kartenmenü, Bericht | groß | mittel | „Auf den Gürtelbahnen stehen Festungen" |
| **2** | **Die drei Bauteile.** Schild/Türme/Kern, Zielwahl, Rollenfaktoren, Balken im Menü, Erfolg `dreiteile` | mittel | mittel | „Festungen haben Schwachstellen" |
| **3** | **Nester Stufe 1–4.** Reifen, Ausbreiten, Karte, Angriff, Völker-Eigenarten, `rxenobiologie` | groß | mittel | „Die Völker haben Nester" |
| **4** | **Die Gegnerstärke wird beweglich.** Zielwert aus dem Nestbestand, Drift, Anzeige im Galaxie-Tab, Hilfetexte | klein | klein | „Geräumte Nester machen die Galaxie leichter" |
| **5** | **Die Königin.** Stufe 5, Musterangriff-Zielart, `set_schwarm`-Ausschüttung, Erfolge | mittel | mittel | „Der koordinierte Angriff hat endlich ein Ziel" |
| **6** | **Feinschliff.** Zwei Meilenstein-Embleme, Kompendium-Einträge, `belagerungsplan`, Vorbote | klein | klein | – |

**Warum die Festungen zuerst.** Sie sind das kleinere Risiko: Ihr Zustand lebt in einem Dokument,
das es schon gibt, ihr Kampf ist eine Kopie des Weltboss-Musters, und sie ändern **keine
bestehende Zahl**. Die Nester dagegen greifen in Phase 4 in die Balance jedes NPC-Kampfes ein – das
gehört an eine Stelle, an der die Festungen bereits laufen und man die Wirkung isoliert beobachten
kann.

**Phase 0, davor und unabhängig – drei kleine Commits, die nicht warten sollten:**

1. Die **Rundflug-Lücke bei `asteroid-contest`** (0.6) wird behoben, **bevor** die erste neue Mission
   gebaut wird – sonst kopiert die neue Arbeit das falsche Vorbild von nebenan. Dazu gehört,
   `test_rundflug.js` datengetrieben zu machen.
2. Der **vestigiale `db.galaxy.worldBoss`** (0.3) wird entfernt, samt seiner beiden
   Galaxie-Nachrichten. Sie behaupten heute etwas Falsches („Gemeinsam bekämpfbar") über ein Objekt,
   das niemand angreifen kann, und würden neben den echten Festungs- und Nest-Meldungen erst recht
   verwirren. Zwei Zeilen weniger Weltgeschichte sind besser als zwei erfundene.
3. **Die Schreibsperre für `asteroids:*`** (0.7) wird gesetzt. Das ist der dringendste der drei
   Punkte und hängt nicht an diesem Konzept: Die Lücke steht heute offen, ist gemessen, und die
   Festung würde im selben Dokument wohnen.

---

## 10. Tests

Jeder neue Test braucht eine **Gegenprobe in beide Richtungen** – grün am neuen Stand, **rot am
alten** (CLAUDE.md, Testregel 1). Und die Gegenprobe darf nicht am falschen Grund grün werden
(Regel 26/28): Wo eine Sperre mehrere Gründe kennt, wird der **Grund** geprüft, nicht der
Statuscode.

### Frontend (`tests/`)

| Datei | Prüft | Gegenprobe am alten Stand |
|---|---|---|
| `test_festung_karte.js` | Festung erscheint als Abzeichen in Sektoransicht **und** als Marker im offenen System; Kartenmenü öffnet sich; die drei Balken stehen im Info-Block | ohne den Renderer: kein `[data-map-festung]` |
| `test_festung_blockade.js` | `abbauPlan()` liefert bei stehender Festung 40 % weniger `ladung`; die Vorschau **nennt** den Malus (nicht nur die kleinere Zahl) | am alten Stand voller Ertrag |
| `test_rundflug.js` (**Umbau**) | die Falltabelle kommt aus **derselben Quelle** wie der Ankunfts-Durchgang; alle Rundflug-Missionsarten haben `hinBis` **und** `endTime > hinBis` | am alten Stand fällt `asteroid-contest` durch – das ist zugleich der Beleg für Befund 0.6 |
| `test_kartenmarker.js` (**Erweiterung**) | Festungs- und Nest-Marker kollidieren auf **beiden** Formfaktoren nicht mit Planetenscheiben; die Knöpfe sind per `elementFromPoint` auf ihrer **Mitte** erreichbar (Regel 49) | mit ausgeschaltetem `kbMarkerFrei`: Überlappung messbar |
| `test_nest_reifung.js` | ein Nest wechselt seine Stufe erst nach der Reifezeit; die Anzeige nennt die Stufe; die Restzeit wird **gerundet** ausgegeben (keine Sekundenanzeige, sonst Tick-Unruhe) | am alten Stand keine Stufenanzeige |
| `test_festung_paritaet.js` | die Stufen-, Lebenspunkte- und Blockade-Tabellen im Frontend stimmen mit `server.js` überein – dieselbe Familie wie `test_kosmetik_paritaet.js`, `test_asteroid_paritaet.js` und `SHIP_SCORE_WEIGHTS` | Wert im Backend verändern → rot |
| `test_anzeigestellen_gegnerstaerke.js` | die NPC-Vorschau, die Gegnerkarte und der Kampf rufen **dieselbe** Funktion für die effektive Verteidigung | eine Kopie der Formel einsetzen → rot |

### Backend (`tests/`)

| Datei | Prüft |
|---|---|
| `test_festung_http.js` | echter Server, echte DB unter `/tmp`, **zwei Serverstarts auf derselben DB** (die Abklingzeit hängt an der Uhr, siehe das Sternenstaub-Muster): Schlag zieht LP ab, zweiter Schlag innerhalb von 6 Std. wird abgewiesen **mit dem richtigen Grund im Fehlertext**, Fall verteilt den Hort nach Anteil, `festung.id` schützt gegen Nachzügler |
| `test_festung_nachschub.js` | **der Kollisionstest**: Läuft `astNachschub()` über ein Feld mit Festung, darf auf ihrem Platz kein Vorkommen entstehen. Gegenprobe: mit der alten, doppelten `frei`-Schleife entsteht es messbar |
| `test_alien_nest_http.js` | Reifen, Ausbreiten (nie in ein bewohntes System), Deckel `NEST_MAX`, Königinnen-Bedingung, Königinnen-Fall räumt das Volk |
| `test_gegnerstaerke_drift.js` | der Zielwert folgt der Stufensumme, die Drift ist gedämpft, der Deckel 2,5 hält, und **0 Nester führen wirklich auf 1,0** (heute unerreichbar) |
| `test_festung_schreibschutz.js` | ein `PUT /api/storage/asteroids:<sys>` eines gewöhnlichen Nutzers wird abgewiesen – der geteilte Speicher ist ohne ausdrückliche Regel für jeden offen |

**Zwei Fallen, die bei diesen Tests konkret drohen** (beide sind in diesem Projekt schon einmal
teuer gewesen):

- **Der Anfängerschutz muss für Angriffstests weg** (`db.private[<id>].__attackShieldUntil = 0`) –
  sonst antwortet der Angriffs-Endpunkt mit 403, und ganze Abschnitte werden aus dem falschen Grund
  grün (Regel 37).
- **Neue Testports gegen die vorhandenen prüfen** (`grep -n "PORT = " tests/*.js`) – im
  Backend-Repo sind 3217 und 3218 bereits vergeben.

---

## 11. Risiken und offene Entscheidungen

### 11.1 Die drei, die wirklich wehtun

**(1) Das Königinnen-Dilemma kippt zur Passivität.** Der Entwurf setzt darauf, dass die
gemeinsamen Kosten (höhere Gegnerstärke) den Anreiz aufwiegen, den Schwarm für die große
Ausschüttung wachsen zu lassen. Auf einem kleinen Server mit wenigen Aktiven kann das kippen:
Wenn niemand räumt, weil sich Räumen im Verhältnis zur Königin nicht lohnt, steht die Galaxie
dauerhaft am Deckel – also genau da, wo sie heute schon steht, nur mit mehr Aufwand.
**Woran man es merkt:** Die mittlere Neststufe steigt über drei und bleibt dort, und die Zahl der
geräumten Nester der Stufen 1–2 geht gegen null.
**Was dann zu tun ist:** Die Ausschüttung der Königin senken und die der kleinen Nester anheben,
**nicht** die Ausbreitung verlangsamen – langsamere Ausbreitung nimmt dem System seinen Rhythmus,
eine flachere Belohnungskurve nur seine Spitze.

**(2) Die Blockade trifft die Falschen.** Wer sein Schürfrecht in einem Gürtelsystem hat, in dem
eine Zitadelle steht, verliert 55 % Ertrag – auch wenn er die Festung gar nicht schleifen kann.
Das Konzept mildert das über die Wahlfreiheit (nur sechs von zwanzig Systemen sind je betroffen,
Schürfrechte lassen sich aufgeben und neu anmelden) und über den 24-Stunden-Bonus nach dem Fall.
Es bleibt trotzdem der Punkt, an dem ein Spieler-Report zuerst kommen wird.
**Ausweg, falls nötig:** Die Blockade auf **Vorkommen ohne Schürfrecht** beschränken – dann trifft
sie den freien Abbau, nicht den angemeldeten Besitz. Das wäre die mildere Variante und ist bewusst
nicht der Vorschlag, weil sie die Festung für Rechtehalter unsichtbar macht.

**(2b) Die Flottenslots werden knapp.** `maxConcurrentFleets()` (Z. 26553) liefert
`2 + rflottenkoord + skillFleetSlots()` – im Aufbau also **zwei bis vier**, im Endspiel bis zu elf
(zehn Forschungsstufen plus „Parallelkommando"). Ein Festungssturm und ein Nest-Angriff belegen je
einen Slot für die volle Rundreise. Für ein junges Konto mit zwei Slots ist das die Wahl zwischen
Belagerung und Expedition – für ein Endspiel-Konto ist es nichts. Das ist eher Feature als Fehler
(die Slots sind seit jeher die Währung, in der dieses Spiel Entscheidungen einfordert), aber es ist
der Grund, warum die **Vorposten** in Heimatnähe stehen und kurze Flugzeiten haben: Der Slot soll
für einen Anfänger nicht drei Stunden gebunden sein.

**(3) Zwei neue Angriffsziele verdünnen die vorhandenen.** Wer sechs Stunden Abklingzeit auf
Festungen und vier auf Nester hat, greift möglicherweise keine NPCs mehr an. Nachgerechnet ist das
Risiko gering – NPC-Angriffe haben **keine** Abklingzeit und bleiben der einzige Weg zu Trümmerfeldern
am eigenen Standort, zu Enterungen und zum `npcScaling`-Fortschritt –, aber die Beobachtung gehört
in den ersten Prüflauf nach der Auslieferung.

### 11.2 Die offenen Entscheidungen

| Frage | Vorschlag | Alternative | Wer entscheidet |
|---|---|---|---|
| Basiswert der Gegnerstärke bei geräumter Galaxie | **1,0** – die Räumung soll sich deutlich anfühlen | 1,4 – behutsamer, weil alle 18 NPC-Gegner sonst spürbar leichter werden | Sascha (Balance) |
| Königinnen-Fall | **räumt das ganze Volk** | setzt nur die Königin und alle Nester des Volkes um zwei Stufen zurück | Sascha (Spielgefühl) |
| Blockade | trifft **alle** Vorkommen des Systems | nur die ohne Schürfrecht | Sascha (Balance) |
| Festungs-Höchstzahl | **6** von 20 Gürtelsystemen | mit der Spielerzahl skalierend, wie die Weltboss-LP | offen, bis die Spielerzahl es verlangt |

### 11.3 Was dieses Konzept ausdrücklich NICHT vorschlägt

- **Keine Alien-Fraktion mit Ruf, Shop und Botschaft.** `FACTION_DIPLOMACY`, `FACTION_SHOPS`,
  `FACTION_QUEST_POOLS`, `REP_RANKS`, `RANK_PERKS`, `EMBASSY_*` und `FACTION_RIVALS` hängen alle am
  Fraktionsschlüssel; eine fünfte Fraktion wäre ein Eingriff in ein Dutzend Tabellen. Und
  inhaltlich wäre es falsch: Die vier Fraktionen sind **Verhandlungspartner**, der Schwarm ist eine
  **Naturgewalt**. Man verhandelt nicht mit einem Nest.
- **Keine Festung, die zurückschlägt, während man offline ist.** Sie kostet Ertrag, nie Besitz
  (4.3) – und der Grund ist die Regel, dass der Server keine fremden Spielstände schreibt.
- **Keine neue Währung.** Vier Töpfe ohne ausreichende Senke sind bereits belegt.
- **Kein neues `ti-*`-Icon und kein Font-Neubau.** Alle Zeichen stehen im Bestand.
- **Keine Festung auf einem Planeten oder in einem Nicht-Gürtelsystem.** Der Reiz ist gerade, dass
  sie dort steht, wo der Spieler ohnehin arbeitet.
- **Keine Änderung an `/api/attack`.** Der Endpunkt nimmt weiterhin keinen einzigen Kampfparameter
  aus dem Request entgegen; das ist eine Eigenschaft, die erhalten bleiben soll.

---

## 12. Aufwand, ehrlich geschätzt

| Phase | Frontend | Backend | Tests | Summe |
|---|---|---|---|---|
| 0 – Rundflug-Lücke, toter Weltboss, Schreibsperre | 0,5 | 0,5 | 1 | **2** |
| 1 – Festungen | 4 | 2,5 | 2 | **8,5** |
| 2 – Bauteile | 2 | 1,5 | 1 | **4,5** |
| 3 – Nester | 4 | 2,5 | 2 | **8,5** |
| 4 – Gegnerstärke | 1 | 0,5 | 1 | **2,5** |
| 5 – Königin | 2 | 2 | 1,5 | **5,5** |
| 6 – Feinschliff | 1,5 | 1 | 0,5 | **3** |
| | | | | **34,5 Einheiten** |

Eine „Einheit" ist ein halber konzentrierter Arbeitstag – die Größenordnung, in der dieses Projekt
bisher einzelne Auslieferungen gebaut hat. 34,5 Einheiten sind damit rund **drei Wochen** bei
zügiger Arbeit; zum Vergleich: Das Asteroiden-Konzept (`docs/asteroiden-konzept.md`, fünf Phasen,
1.294 Zeilen) war der bislang größte Umbau des Spiels und ist in gut zwei Wochen umgesetzt worden.
Dieses hier ist etwas größer, weil es **zwei** Inhalte sind und beide die Karte anfassen – die
Phasen sind aber so geschnitten, dass nach Phase 1 (8,5 Einheiten) bereits etwas Spielbares live
steht.

**Der teuerste Einzelposten ist nicht der Kampf, sondern die Karte.** Zwei neue Markertypen auf
einer Zeichnung, die zwischen dem 16. und 18.08.2026 fünfzehn Etappen (KB-1 bis KB-15) durchlaufen
hat und deren letzte drei Etappen ausschließlich Kollisions- und Bedienbarkeits-Nachwehen waren
(Regeln 49–53). Wer hier arbeitet, misst mit `elementFromPoint` und auf **beiden** Formfaktoren –
ein Sichtbarkeits-Test findet genau die Fehler nicht, die dort auftreten.
