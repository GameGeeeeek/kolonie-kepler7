# Wandernde Beute-Ziele (A2) — Konzept und Entscheidungsgrundlage

**Stand 28.08.2026.** Alle Zeilenangaben auf `weltraum_kolonie.html` (Frontend) bzw.
`kolonie-kepler7-backend/server.js` (Backend), sofern nicht anders genannt. Dieses Dokument ist
eine **Entscheidungsgrundlage für Sascha**, kein Umsetzungsplan. Jede Zahl ist entweder am Code
gemessen (mit Konstanten-/Funktionsnamen belegt) oder ausdrücklich mit **ACHTUNG — vor dem Bau
messen** markiert. Nichts hier ist gebaut.

**Auftrag (sinngemäß):** ein solo-taugliches, wiederkehrendes Karten-Ziel, das über die Sektorkarte
*driftet* (System zu System) und angegriffen werden kann — ein Ziel, das man **verlieren** kann,
wenn man zögert. Ausprägung offen: treibende Beute-Karawane / Wrackkonvoi / Schmuggler-Geleit.

---

## 0. Der wichtigste Satz vorweg

**Das wandernde Karten-Ziel ist bereits gebaut** — als **Nest der Nomaden von Vex**. Gemessen:
`ALIEN_VOELKER.vex` (server.js Z. 9808) trägt als einziges Volk `wandert: true`; `nestTick` (Z. 9953)
zieht es alle `NEST_WANDER_MS = 12 h` (Z. 9843) in ein freies System weiter, und der Endpunkt
`/api/alien/nest-angriff` (Z. 10344) antwortet auf einen zu spät angekommenen Verband mit
`{ verpasst: true, grund: 'weitergezogen' }` (Z. 10370) — das ist wörtlich „ein Ziel, das man
verlieren kann". A2 **darf deshalb kein zweiter Nomaden-Klon werden.** Wer das übersieht, baut ein
zweites System neben ein vorhandenes — genau der Fehler, den dieses Projekt bei den Bonusgruppen
schon einmal gemacht hat.

A2 hebt sich vom Vex-Nest über **zwei** Achsen ab, die dem Nest gemessen fehlen:

1. **Exklusive Beute** aus dem vorhandenen Herkunfts-Schloss (`quelle`, siehe Abschnitt 8.4) —
   Module oder Sternenessenz, die es **nur** hier gibt. Ein wanderndes Ziel, das Erz abwirft, ist
   der dritte Nomaden-Klon; ein wanderndes Ziel, das ein Modul mit eigener `quelle` abwirft, das
   nirgends sonst fällt, ist ein neuer Grund, die Karte abzusuchen.
2. **Das Entkommen.** Der Auftrag verlangt wörtlich „ein Ziel, das man verlieren kann, wenn man
   zögert". **Das Nest kann genau das NICHT** — es wächst und breitet sich aus, es despawnt niemals
   durchs Ignorieren; „weitergezogen" heißt bei ihm „ins Nachbarsystem, weiter angreifbar". Ein Ziel,
   das wirklich **verschwindet**, ist eine neue Mechanik und muss eigens gebaut werden
   (Abschnitt 4).

**Ohne mindestens eine dieser zwei Achsen lohnt A2 gemessen nicht** — dann ist die ehrliche
Empfehlung, das Vex-Nest sichtbarer zu machen statt A2 zu bauen (Abschnitt 13, offene Produktfrage).

---

## 1. Idee in einem Satz + Abgrenzung

**Ein Satz:** Ein bewegliches Beute-Ziel (Karawane/Wrackkonvoi/Schmuggler-Geleit) driftet System zu
System über die Karte, wirft beim Erlegen **exklusive** Beute ab (Module über das `quelle`-Schloss
oder Sternenessenz), zieht weiter oder **entkommt endgültig**, wenn der Spieler zögert.

**Abgrenzung zu den Karten-Systemen E1–E5** (aus `docs/sektorkarte-konzept.md`; die dortige
Einordnung ist bereits ausformuliert und wird hier verdichtet):

| System | Was es ist | Doppelt A2 es? |
|---|---|---|
| **Vex-Nest** (gebaut) | wanderndes PvE-Ziel, wirft `NEST_STUFEN`-Beute (Kampfpunkte/xp/credits/Protomaterie) | **JA in der Bewegung** — A2 hebt sich nur über **exklusive Beute** UND **echtes Entkommen** ab, sonst redundant |
| **E2 Statthalter** | benanntes NPC-Kartenziel (`NPCS` Z. 16017, `chronik` nach `npcScalingCount`) | Überschneidung als *benanntes Kartenziel* — A2 unterscheidet sich durch **Bewegung + Despawn** |
| **E3 Sprungbake** | Ort, der `sprungnetzMult` trägt (Flugzeit-Multiplikator) | **Nein** — E3 ist ein Faktor, A2 ein Objekt; A2 dockt **nicht** an `missionDurationFor` an |
| **E4/E5** | weitere Flugzeit-/Sektor-Kanäle | **Nein** |

**Berührte Ablehnungen aus `sektorkarte-konzept.md` (sieben Ablehnungen):**
- **„Keine Rohstoffberge / N-Minuten-Produktion"** — A2 muss Zeit/Position/Sternenessenz oder
  exklusive Module tragen, nie Erz. Das ist die tragende Beschränkung des ganzen Konzepts.
- **Ablehnung 5 (Wirkung ohne Anzeige)** — ein Ziel, dessen Position zählt, MUSS ein
  `karteSystemBadges`-Abzeichen haben (Abschnitt 7).
- **Leitplanke 6 (Server-Beobachtbarkeit)** — falls backend-autoritativ (Abschnitt 3.1), wird die
  Existenz im geteilten Weltzustand geführt, nie aus einer Client-Meldung.

---

## 2. Spielablauf aus Spielersicht

1. **Entdecken.** Auf der Regionsübersicht/Sektoransicht trägt ein System ein neues Abzeichen. Der
   Spieler sieht: „hier ist ein bewegliches Ziel".
2. **Aufklären.** Klick öffnet das Kartenmenü (`openKarteMenu`, Z. 57754): Art des Ziels, geschätzte
   Verteidigung, **Restzeit bis zum Weiterziehen/Entkommen**, welche Beute lockt. Das ist der Reiz:
   die Restzeit macht aus „irgendwann" ein „jetzt".
3. **Abwägen.** Der Spieler stellt einen Verband zusammen (`oeffneFlottenwahl` → `buildAttackFleet`).
   Die Vorschau **misst** die Erfolgschance und die Schwäche des Ziels (nicht bloß benennen —
   Regel 61).
4. **Angreifen.** Form-A-Rundflug (hin UND zurück). Kommt der Verband an, während das Ziel noch da
   ist: Kampf, Bericht, Beute. Ist das Ziel **weitergezogen** oder **entkommen**: der Verband kehrt
   vollzählig heim, kostet nichts, und der Bericht nennt den **Grund** (kein stilles „ok").
5. **Verpassen kostet nichts, Zögern kostet die Beute.** Wer wartet, findet das Ziel im
   Nachbarsystem — oder es ist **endgültig weg** (Abschnitt 4). Genau darin liegt der Unterschied zum
   Vex-Nest.

Solo (`useBackend() === false`) erlebt jeder seine eigene Karawane; gemeinsam (Backend) jagen
mehrere dasselbe Ziel — **das ist DIE Kern-Entscheidung, Abschnitt 3.1.**

---

## 3. Die Kern-Entscheidungen (gehören Sascha)

### 3.1 Braucht es überhaupt ein Backend?

Das ist die zentrale Frage und entscheidet fast alles Weitere.

**OPTION A — gemeinsames Weltereignis (Backend, empfohlen).**
Das Ziel lebt in `db.galaxy` (analog `db.galaxy.alienNester`, Z. 4861), driftet und despawnt im
`galaxyTick` (Z. 5749 ruft `nestTick`), wird serverseitig aufgelöst, Beute an alle Beitragenden über
`pushPendingReward` (Z. 5523).
- **Gemessene Folge (Vorteil):** *echtes* Wettrennen — mehrere jagen dasselbe Ziel, es entkommt
  wirklich, wenn niemand rechtzeitig da ist. Die Frist hat Gewicht, weil sie für alle gleich tickt.
  Die ganze Nest-Infrastruktur (Wandern, Abklingzeit am Ziel, anteilige Beute, `verpasst`) ist
  erprobt und großteils wiederverwendbar — der Despawn (Abschnitt 4) und der Modul-Auslieferungsweg
  (Abschnitt 8.4) sind die einzigen echten Neubauteile.
- **Gemessene Folge (Kosten):** Deploy-Risiko. Der Backend-Deploy dieses Projekts ist **13-mal**
  ausgefallen (siehe Backend-CLAUDE.md „AUSFALL NR. …"). A2-Backend braucht deshalb zwingend einen
  **Notausschalter** (`A2_SPAWN_AKTIV`, Abschnitt 10) und die getrennte Auslieferungsreihenfolge.

**OPTION B — rein persönlich (clientseitig, kein Deploy-Risiko).**
Das Ziel lebt im Spielstand (`state.…`), driftet und despawnt in einer Frontend-Tick-Funktion, wird
lokal aufgelöst.
- **Gemessene Folge (Vorteil):** kein Deploy-Risiko, kein Schalter, funktioniert solo wie online
  identisch. Schnell gebaut.
- **Gemessene Folge (Kosten):** jeder erlebt seine eigene Karawane — **kein Wettrennen**, die Frist
  ist folgenlos jenseits „ich hätte früher fliegen können". Schwerer wiegt die
  **klientenautoritative Grenze** (Backend-Grenzen-Wissen): ein Ziel im Spielstand ist bauartbedingt
  fälschbar. Solange die Beute **nur den Spieler selbst betrifft** und der Server sie nicht
  beobachtet, wäre eine wertvolle Belohnung damit **F5-druckbar** — und exklusive
  Module/Sternenessenz sind wertvoll. Ein clientseitiges A2 darf deshalb **keine server-beobachtete
  Belohnungsgröße** ausschütten (kein `user.pveKills`-Emblem, keine Bestenlisten-Wirkung); es bliebe
  auf rein persönliche, ohnehin fälschbare Beute beschränkt. Das entwertet den „exklusiv"-Reiz.

**Empfehlung: Option A (Backend), aber nur, wenn A2 wirklich exklusive/wertvolle Beute tragen soll.**
Begründung, gemessen: Der Sinn von A2 gegenüber dem vorhandenen Vex-Nest sind die exklusive Beute
und das Entkommen (Abschnitt 0). Exklusive Beute + Wettrennen = Backend, sonst ist die Belohnung
fälschbar. Ist Sascha die exklusive Beute **nicht** wichtig und geht es nur um „noch ein Grund, die
Karte anzusehen", dann ist Option B billiger — aber dann ist es gemessen fast dasselbe wie das
Vex-Nest, und die ehrliche Empfehlung lautet: **A2 gar nicht bauen, sondern das Vex-Nest sichtbarer
machen.**

### 3.2 Bestenlisten-Emblem / PvP-Relevanz?

A2 ist ein **PvE**-Ziel (ein NPC-Objekt auf der Karte), kein Spieler. „Andere angreifen" heißt hier
**mehrere Spieler jagen dasselbe NPC-Ziel** (Option A) — das ist kein PvP.

Es gibt **zwei** Stellen, an denen A2 doch PvP-relevant würde. Beide sind eigene Entscheidungen und
dürfen nicht still mitlaufen:

- **Ein Bestenlisten-Emblem.** Speist das erlegte Ziel einen Zähler in die Bestenliste (wie
  `user.pveKills` für Festungs-/Königinnen-Embleme, gemessen `pveKillZaehlen(uid, 'koeniginnen')`
  Z. 10303), liegt der Zähler zwingend am **Nutzerobjekt** (server-beobachtet), nie im Spielstand —
  und das schließt Option B als Träger aus (siehe 3.1). **Entscheidung Sascha:** soll A2 ein
  Bestenlisten-Emblem freischalten? Wenn ja → Option A + Zähler am Nutzerobjekt. Wenn nein → beide
  Optionen bleiben offen.
- **Ein Kampf-Modul als Beute.** Ob **keine Backend-Parität einer Kampfformel** nötig ist, hängt
  ausschließlich an der Beute-Art aus 3.3 — ein Schiffsklassen-Modul mit `atk`/`hull`/`shield` ist
  PvP-relevant und reißt diese Zusage. Der Satz „A2 verändert keine Verteidigungs-/Angriffskraft
  eines Spielers, also keine Kampfformel-Parität" gilt **nur**, solange 3.3 auf eine Beute ohne
  Kampf-Kanal fällt.

### 3.3 Beute-Art — Modul oder Sternenessenz (NEUE benannte Entscheidung)

Der Entwurf hatte die zwei Wege als gleichwertige Aufzählung geführt. Gemessen ist das **keine
gleichwertige Aufzählung, sondern eine Entscheidung mit Folge für 3.2**: Ein Schiffsklassen-Modul
trägt laut CLAUDE.md `atk`/`hull`/`shield` und ist damit PvP-relevant — `SHIP_MODULE_SET_DEFS` ist
eine Kopie-Familie mit Pflicht-Paritätstest gegen `server.js`. Wer diesen Weg wählt, ohne es zu
benennen, bricht die Zusage aus 3.2 unbemerkt.

Drei benannte Varianten, jede mit gemessener Folge:

| Variante | Was fällt | PvP-Parität | Auslieferungsreihenfolge |
|---|---|---|---|
| **(1) Standort-Modul (`MODULE_DEFS`) mit eigener `quelle:'konvoi'`, ohne Kampf-Kanal** | ein exklusives Standort-Modul (Produktion/Komfort) | **keine** — trägt keinen `atk`/`hull`/`shield`-Kanal | gleichgültig (Server hinterher erlaubt) |
| **(2) Sternenessenz** (`state.ascension.essence`) | die einzige Währung, die Prestige UND Aufstieg übersteht (Abschnitt 11) | **keine** | gleichgültig |
| **(3) Schiffsklassen-Modul(-Set) mit `atk`/`hull`/`shield`** | ein exklusives Kampf-Modul, das PvP entscheidet | **PFLICHT** — `SHIP_MODULE_SET_DEFS`-Parität Frontend↔Backend, Wächter wie `test_schiffsmodul_paritaet.js` | **Backend zuerst** (Regel 60), sonst sieht die Werft einen Kampfwert, mit dem der Server nicht rechnet |

**Empfehlung: (1) oder (2).** Beide tragen die Exklusivität ohne PvP-Rückkopplung und lassen die
Auslieferung reihenfolgeunabhängig. Variante (2) passt am besten zu einem Ziel, das über Wochen
gejagt wird (siehe Abschnitt 11). **(3) nur, wenn ausdrücklich ein neues Kampf-Modul-Set gewünscht
ist** — dann gilt 3.2 nicht mehr, die Parität und die Backend-zuerst-Reihenfolge sind Pflicht.

### 3.4 Ausprägung: Karawane / Wrackkonvoi / Schmuggler-Geleit (kosmetisch)

Rein narrativ, keine Mechanik-Folge. Alle drei laufen durch dieselbe Mechanik. Der Name entscheidet
nur `desc`, Icon und Berichtstext. **Empfehlung: Wrackkonvoi** — passt am besten zu „findbare
Module" (ein Wrack birgt Bergungsmodule), ohne den Erz-Reflex zu wecken, den „Karawane" auslöst.

---

## 4. Das Entkommen: die Despawn-Mechanik (NEUE Mechanik, NICHT vom Nest geerbt)

**Der Kern-Reiz, über den A2 sich vom Nest abhebt, ist das Verlieren — und den kennt das Nest
gemessen nicht.** Der Nest-Endpunkt hat genau zwei `verpasst`-Gründe: `gefallen` (jemand hat es
zerstört, Backend Z. 10366) und `weitergezogen` (ins Nachbarsystem verschoben, **weiter
angreifbar**, Z. 10370). Ein Nest despawnt NICHT durchs Ignorieren; nur das Königinnen-Ereignis
räumt den Schwarm. A2 braucht deshalb eine eigene, explizite Regel, nach der das Ziel **vollständig
verschwindet**.

**Mechanik:** A2 hat eine begrenzte Lebensdauer. Wird sie erreicht, ohne dass das Ziel gefallen ist,
wird es im `galaxyTick` **ganz aus `db.galaxy` entfernt** (nicht nur verschoben). Zwei mögliche
Formen der Grenze, beide **ACHTUNG — vor dem Bau messen**:

- `A2_LEBENSDAUER_MS` — feste Gesamtzeit ab Entstehen.
- `A2_MAX_DRIFTS` — nach N Drift-Schritten löst sich das Ziel auf.

**Der Endpunkt braucht einen DRITTEN `verpasst`-Grund `entkommen`** neben `gefallen` und
`weitergezogen`, mit eigenem Berichts- und Kartenmenütext. Das ist gemessen die einzige Stelle, an
der A2 sich vom Nest-Endpunkt strukturell unterscheidet: Das Nest kennt diesen Ausgang nicht.

**Die Lebensdauer wird gegen Drift-Intervall UND Abklingzeit gerechnet, nicht geraten** (Regel 41):
Das Ziel darf nicht entkommen, bevor ein Solo-Spieler es realistisch erreichen und in den verfügbaren
Schlägen fällen kann. Faustformel als Messvorgabe: `A2_LEBENSDAUER_MS` muss so groß sein, dass ein
Einsteiger-Konto in dem Fenster (bei `A2_ABKLING_MS` Abklingzeit) genug Schläge für die A2-LP
zusammenbekommt, plus mindestens einen Hin- und Rückflug. Andernfalls ist das Ziel für seine
Zielgruppe faktisch nie fällbar — der Fehler, den die Festungs-LP beinahe hatten (Backend-CLAUDE.md,
„neunzehn Schläge"). Die konkreten Zahlen stehen in Abschnitt 13 (Messfragen 1–3) und hängen
zusammen.

Wer die Grenze WEGLÄSST und nur „weitergezogen" behält, hat kein A2, sondern einen dritten
Nomaden-Klon — dann greift Abschnitt 0 (A2 gar nicht bauen).

---

## 5. Ablageort + Sicherheit

Die verteidigte Grenze ist eine: **„Kann ich etwas anfassen, das ANDEREN gehört oder allen
gemeinsam?"** Gemessen aus der Backend-Praxis (drei Ablageorte):

| Ort | Client-Erreichbarkeit | Für A2 |
|---|---|---|
| **`db.galaxy.<x>`** (Init `loadOrInitGalaxy`) | über `PUT /api/storage` **gar nicht** schreibbar; `galaxyFuerClient()` schickt via `Object.assign` alles lesend an den Client | **Option A: erste Wahl.** So liegen die Nester (`db.galaxy.alienNester`, Z. 4861, Kommentar Z. 9779). Umgeht die ganze Fehlerklasse „offener Shared-Storage" |
| **`db.shared[…]`** | für jeden eingeloggten Nutzer offen (lesen UND schreiben) | **vermeiden.** Bräuchte eine Sonderregel in einer `check…KeyPermission`-Funktion (wie `checkAsteroidKeyPermission` für `asteroids:*`), sonst setzt jeder den Lebenspunktestand auf null |
| **`db.private[uid]` = Spielstand** | klientenautoritativ, nur `SAVE_SANITY_LIMITS` | **Option B (rein persönlich)** — mit der 3.1-Einschränkung: keine server-beobachtete Beute |

**Für Option A gilt zusätzlich:**
- **Die Abklingzeit/Wiederholungssperre gehört AN DAS ZIEL** (`ziel.schlaege[uid]`, Muster
  `nest.schlaege[userId]` Z. 10285/10377), NIE in den Spielstand — dort gäbe ein gelöschtes Feld
  den nächsten Schlag frei (Entwicklerkonsole). Fällt oder entkommt das Ziel, ist seine Abklingzeit
  gegenstandslos — sie muss keinen Respawn überleben (anders als die 24h-Weltboss-Sperre, die bewusst
  im Spielstand liegt).
- **Der Server nimmt KEINEN Kampfparameter aus dem Request-Body.** Die Angriffskraft rechnet er aus
  dem gespeicherten Spielstand neu (`computeAttackPowerFromComposition`, Muster Z. 10389). Das ist
  die Eigenschaft, die `/api/attack` und `/api/alien/nest-angriff` teilen — sie bleibt erhalten.

---

## 6. Backend-Bauplan: die Bauteile (nur Option A)

Der Entwurf nannte die Backend-Teile als Präzedenz, aber nicht als geschlossene Bau-Liste. Ohne sie
bleibt „wo entsteht es" offen. Fünf Bauteile, jedes mit Vorbild:

1. **Feld-Init** `db.galaxy.a2Ziele = []` in `loadOrInitGalaxy` (Muster `db.galaxy.alienNester`
   Z. 4861). `galaxyFuerClient()` schickt das Feld dann automatisch an den Client (kein
   Verdrahtungscode).
2. **`A2Tick(g)`, aufgerufen aus `galaxyTick`** (Muster `nestTick` Z. 5749/9953). **In Zeile 1
   `if (!A2_SPAWN_AKTIV) return;`** — der Schalter (Abschnitt 10). Der Tick enthält die Zweige 3–4.
3. **Entstehungs-Zweig — ACHTUNG, das Konzept legt ihn noch nicht fest.** Ein A2-Ziel ist ein
   eigenständiges Objekt und hat **keine** Kopplung wie das Nest (das an das „Volk entdeckt"-Ereignis
   hängt). Zu entscheiden und zu messen (Abschnitt 13, Messfrage 4): an welches Intervall bzw.
   Ereignis das Entstehen gekoppelt ist, mit welcher Rate (`A2_WURF_CHANCE` je `A2_WURF_MS`), und in
   **welchem System**. Das gewählte System muss **frei** sein (Muster `astFreiePlaetze` / das
   „freies System" des Nests, Backend Z. 9999): es darf keine Festung, kein Nest und kein anderes
   A2-Ziel tragen, sonst stapeln sich Abzeichen und Marker um denselben Kartenknoten. Alternativ
   bewusst zulassen und als Karten-Messfrage (KB) markieren.
4. **Drift-/Despawn-Zweig.** Alle `A2_WANDER_MS` in ein **freies** Nachbarsystem verschieben (dieselbe
   Freiheitsprüfung wie in 3), Beiträge und `schlaege` reisen mit (Muster Nest, Backend Z. 9999–10011).
   **Neu gegenüber dem Nest:** ist die Lebensdauer bzw. `A2_MAX_DRIFTS` erreicht (Abschnitt 4), wird
   das Ziel aus `db.galaxy.a2Ziele` **entfernt** statt verschoben.
5. **Endpunkt + Missionssucher.** `POST /api/A2/angriff` (Muster `/api/alien/nest-angriff` Z. 10344)
   und der Helfer `A2FindeMission(save, missionId, zielId)`. **Der Sucher findet das Ziel über seine
   persistente `zielId`, nicht über das System** — Begründung in Abschnitt 8.1. Der Endpunkt liest
   `computeAttackPowerFromComposition`, prüft `ziel.schlaege[uid]`, zählt den **angekommenen**
   Schaden (`schaden = lpVorher - ziel.lp`) und verteilt die Beute anteilig über `pushPendingReward`.

---

## 7. Karten-Wirkung

Alle Zeilen Frontend. Vorbild ist der Nest-Marker (macht alle fünf Schritte richtig).

1. **Abzeichen** in `karteSystemBadges` (Z. 57125–57224), **innerhalb des
   `if (karteEbeneAn('ereignisse')){…}`-Gates** (Z. 57157). Neuer `badges.push({ icon, title })`
   nach dem Muster Festung (🛡, Z. 57160) / Nest (👾/👑, Z. 57173). Diese eine Funktion speist
   **drei** Anzeigestellen (Regionsübersicht, Sektoransicht, Nachbarpunkte in `buildGalaxyMap`) —
   ein Eintrag versorgt alle.
   **Zum Badge-Icon (Korrektur gegenüber dem Entwurf):** `karteSystemBadges` pusht **reine Emoji**,
   keine `ti-*`-Glyphen — gemessen an 🛡/👾/👑/🎯. `check-icons.js` prüft ausschließlich
   `ti-*`-Klassen gegen die 69er-Whitelist und `icon:'X'`-Werte der DEFS-Arrays gegen `ICONS`; ein
   Emoji in `badges.push` wird von **keinem** der beiden Checks berührt. Die `check-icons.js`-Pflicht
   gilt deshalb **nur** für die Modul-Icons der Beute (Abschnitt 9), nicht für das Badge-Emoji. Für
   das Badge zählt stattdessen: (a) **Kollisionsprüfung** — nicht ⚔️/🌀/🏰/👽/🛡/👾/👑/🎯 doppelt
   belegen (das Schwerter-Zeichen ⚔️ gehört dem Fraktionskrieg, zwei Bedeutungen für ein Symbol
   wären die zweite Anzeigestelle) und (b) ein **Render-Blick**, ob das gewählte Emoji auf den
   Zielgeräten dargestellt wird.
2. **Marker-Bahn abgeleitet, NIE fest** (KB-20c). Hilfsfunktion nach `nestMarkerXY(index)` (Z. 13853):
   `rx = kbOrbitRx(1) * FAKTOR`, `ry = rx * Math.max(0.60, kbOrbitMass().ry)` (runder als
   Planetenbahn, sonst klebt es auf der Ekliptik), eigener **Winkel** (Nest 340°, NPC 200° —
   A2 braucht einen dritten, damit es nicht deckungsgleich liegt).
3. **`kbMarkerFrei` + `platzierteMarker`** in `buildMap` (Z. 58496). Der übergebene Radius ist der
   **SICHTBARE** Radius inkl. pulsierendem Hof (`r * 2.0`), nicht der Zeichenradius — sonst liegt
   der Marker am Handy auf einer Planetenscheibe (KB-17). Nach dem Schieben in `platzierteMarker`
   anmelden, damit spätere Marker nicht darauf geschoben werden. Bei fester randnaher Bahn:
   6. Parameter `maxRadius = kbOrbitRx(kbMaxOrbit)+34 − eigenerRadius` (KB-20h) — hält es im Bild.
4. **Label-Entflechtung automatisch:** Gruppe braucht `class="planet-node"` + `data-map-A2`
   (Marker ohne `scale`-transform), dann erbt sie `kbLabelsEntflechten` (Z. 58315) ohne Zutun.
5. **Kartenmenü** nach `nestMapMenu` (Z. 59932): `openKarteMenu(ev, art, titel, eintraege, infoHtml)`
   (Z. 57754). `infoHtml` mit `kartenFuellBalken(…)` für die Lebenspunkte (Hausform
   `.progress-outer`, Prozent in die Zeile, GR-3). Klick-Handler in `buildMap` registrieren
   (Muster Z. 59226), und `data-map-A2` in die Außenklick-Ausnahme Z. 57786 aufnehmen — sonst
   schließt der Öffnungsklick das Menü sofort.

**Restzeit im Menü** (der Reiz des Systems): „zieht weiter/entkommt in X" — als **Dauer auf Minuten
gerundet**, nie sekundengenau (sonst schreibt `setBoxHtml`/das Menü im Sekundentakt neu) und nie als
Uhrzeit (für deutsche Spieler falsch).

---

## 8. Mission, Bericht, Belohnung

### 8.1 Missionsform — Form A (Rundflug), und die persistente `zielId`

Die Wahl der Form hängt allein an einer Frage: **Hat das Ziel eine Frist, vor der die Flotte da sein
muss?** Ein wanderndes/despawnendes Ziel läuft zwar ab — aber der Umgang damit ist „bei Ankunft ist
es weg → `verpasst`", nicht „die Flotte muss vor einer Deadline ankommen und der Code braucht die
Ankunftszeit". Das Nest ist der exakte Präzedenzfall und verwendet **Form A**
(`sendNestMission`, Z. 14899): `endTime = jetzt + flug*1000` (volle Rundreise, Kampf bei Heimkehr),
**kein `hinBis`**. `hinBis` tragen nur `intercept-pirates`/`void-rift`, weil dort der Riss/die
Piraten vor Ankunft zerfallen. **A2 = Form A.**

`flug = missionDurationFor(...)`, `fuel = missionFuelCostSplit(flug, flotte)` (Vorschau UND Bezahlung
durch dieselbe Funktion — sonst kündigt der Dialog die Rundreise an und bucht die Hälfte,
`test_rundflug.js` 1k). Der Rundflug-Wächter `test_rundflug.js` 1j liest datengetrieben alle
`missions.push`-Blöcke und schlägt an, wenn A2 `endTime` halbiert (`/2` oder `*500`).

**Die Mission trägt ZWEI Felder, nicht nur das System** (Korrektur gegenüber dem Entwurf, gemessen).
Der Entwurf verlangte nur „`system` MUSS mitreisen". Das reicht nicht: `nestAufloesen` schickt
`nestId` UND `missionId` (Z. 15113), der Endpunkt findet das Ziel per `liste.find(n => n.id === nestId)`
(Backend Z. 10351) und erkennt das Wandern erst **danach** per `nest.sys !== mission.system`
(Z. 10370). Ein wanderndes/entkommenes Ziel ist nach dem Drift über einen System-Abgleich gar nicht
mehr auffindbar — es steht nicht mehr dort. Ohne eigene ID im Missionsdokument könnte der Server
`gefallen`/`entkommen` nicht von `weitergezogen` unterscheiden und keine Abklingzeit/Beute zuordnen.
Deshalb:

- **`zielId`** — die persistente Objekt-ID des A2-Ziels; sie überlebt jeden Drift. Über sie findet
  `A2FindeMission` das Ziel (Abschnitt 6, Bauteil 5).
- **`system`** — das Ursprungssystem beim Missionsstart; daran erkennt der Server, dass das Ziel
  **weitergezogen** ist (`ziel.sys !== mission.system`). Ist das Ziel gar nicht mehr in der Liste,
  ist es **gefallen** oder **entkommen** (Abschnitt 4) — die zwei Fälle unterscheidet der Server über
  ein Feld am Ziel bzw. über sein Fehlen samt Despawn-Vermerk.

### 8.2 Die neun Anzeigestellen (sonst „Erkundungsziel")

Für `type:'A2-angriff'` braucht es (Muster nest-angriff, alle gemessen):
- `MISSION_LINIEN['A2-angriff']` (Z. 58233) — **fehlt der Eintrag, verschwindet die Missionslinie
  still** (beide Leser filtern `filter(mm => MISSION_LINIEN[mm.type])`).
- eigener `missionMapZiel`-Zweig (Z. 58245) — sonst `PLANETS.find` ins Leere.
- die **zwei** Typlisten `m.type==='asteroid-contest' || …`: Z. **23177** UND Z. ~63500 (beide von
  Hand, ein Ersetzer mit `count==1` bricht ab).
- eigener Zweig in Missionskarte (`renderFleetPositionList`) und **Flottenleiste** (Z. ~65505) —
  der generische `else` setzt sonst `label = 'Erkundungsziel'`.
- Auflösung in `checkMissions` als eigener `if (m.type==='A2-angriff'){ A2Aufloesen(...); continue; }`
  VOR der langen Typ-Kette (kein `else if`).

### 8.3 Bericht — Pflicht in JEDEM Ausgang, auch offline

`A2Aufloesen` (Muster `nestAufloesen`, Z. 15108):
- Kampf: `pveVerlusteBuchen(fleet, daten.eigeneVerluste)` (Z. 15042, ZIEHT ab, addiert NICHT die
  Überlebenden — Schiffe stehen die ganze Mission in `fleet`, nur der Slot ist belegt; Regel 68),
  `pushReport({ type:'A2-angriff', … })`, `loadGalaxyState()`, bei Fall `claimPendingRewards()`.
- **kein Kampf** (Ziel weitergezogen / **entkommen** / Server weg): `angriffOhneKampf('A2-angriff',
  ziel, grund, …)` (Z. 35210 im Frontend) — leeres `verluste`, vollzählige Rückkehr, **nennt den
  Grund**. Der Grund `entkommen` (Abschnitt 4) ist ein eigener Text neben `weitergezogen` und
  `gefallen`. Ein stilles „ok" wäre die Falschaussage, vor der die Anzeigestellen geschützt werden.
- Berichtstyp braucht: Zeichner-Zweig in `renderReportsBox`, Eintrag in `REPORT_CATEGORIES`
  (Kategorie „Kämpfe"), `reportIsPositive` (`keinKampf` gilt als positiv; ein wirklich verlorener
  Kampf trägt seinen Typ in `REPORT_OHNE_ERGEBNIS_NEGATIV`). Wächter `test_berichtspflicht.js` liest
  datengetrieben alle `pushReport({type:…` und erzwingt Zeichner/Kategorie/Einfärbung.

**Offline-Nachholen ist mitgedacht** (Ergänzung gegenüber dem Entwurf): `A2Aufloesen` erbt vom
Nest-Vorbild den Offline-Pfad (`checkMissions` mit `showLog=false`, Z. 15108) — dort ist das `log()`
stumm und der `pushReport` die **einzige** bleibende Auskunft. Deshalb muss der kein-Kampf-/`verpasst`-
Zweig auch offline vollständig sein (Grund `entkommen`/`weitergezogen` nennen). Kein Neubau nötig,
nur benennen, damit es in `test_A2_ui`/`test_A2_http` mitgemessen wird.

### 8.4 Belohnung — gemessen, additiv, kein N-Minuten, exklusiv — UND der Auslieferungsweg

**Keine „N Minuten eigene Produktion"** (bei starker Wirtschaft explosiv) und **kein Erz**
(Rohstoffe skalieren mit dem Imperium, die Modulwirtschaft nicht — jeder ungedeckelte Kanal dazwischen
bricht, Regel 41 / Markt-Deckel). Der Reiz ist **Exklusivität**; welche der beiden Formen es wird,
entscheidet Abschnitt 3.3.

Werte serverseitig (Option A) in einer Tabelle nach Muster `NEST_STUFEN` (Z. 9833, führt
`kampfpunkte/xp/credits`), an ALLE Beitragenden anteilig, gezählt wird der **angekommene** Schaden
(`schaden = lpVorher - ziel.lp`), nicht der Wurf (sonst stünde der letzte Angreifer bei 84 % statt
seinem Anteil).

**BLOCKER, der im Entwurf fehlte: ein Modul hat heute keinen Auslieferungsweg durch die
Belohnungs-Warteschlange.** Gemessen liefert `claimPendingRewards` (Z. 29711 ff.) in **jedem**
vorhandenen Zweig (`festung`, `alien-nest`, `weekly-league`) ausschließlich Zahlen/Ressourcen —
**kein Zweig erzeugt je ein Modul**. `grantBossSetModule` (Z. 26944) und `grantUnikatModul`
(Z. 26963) werden dagegen **synchron beim Resolver** aufgerufen (Weltboss Z. 46552, Leviathan
Z. 52551) — nie über `pushPendingReward`, nie „anteilig an alle". Die anteilige `pushPendingReward`-
Auszahlung des Nests und ein unteilbares Modul sind also nicht ohne Weiteres vereinbar. Das muss
**vor dem Bau als Sascha-Option mit Folgen** vorliegen — es ist ein eigenes Bauteil, keine
Nebensache:

- **Fällt A2 Sternenessenz oder Kredite/Kampfpunkte (3.3 Variante 2):** kein Problem. Die Zahl reist
  anteilig über `pushPendingReward`, exakt wie beim Nest. Kein neuer Zweig, kein Modul-Transport.
- **Fällt A2 ein MODUL (3.3 Variante 1 oder 3):** es braucht einen **neuen Auslieferungsweg**, und
  die anteilige Verteilung eines unteilbaren Gegenstands muss geklärt werden. Zwei Wege, gemessen:
  - **(a) Modul-Spezifikation in die Warteschlange.** Der Server reiht in `__pendingRewards` eine
    **Spezifikation** ein (`defKey`/Seltenheit/`quelle:'konvoi'`), und ein **neuer A2-Zweig** in
    `claimPendingRewards` ruft clientseitig `grantBossSetModule`/`grantUnikatModul` auf. Dann ist zu
    entscheiden, wie „anteilig an alle" bei einem unteilbaren Modul aussieht: bekommt **jeder**
    Beitragende ein volles Modul? Nur der letzte Schlag? Eine **Chance je Anteil**? — eine
    Produktentscheidung, keine technische. Vorteil: passt in die erprobte Warteschlange und deckt den
    Offline-Fall ab (der Bericht liegt dann bereits im Fach).
  - **(b) Nur der Auslöser bekommt das Modul, synchron.** Der auslösende Client erhält das Modul
    synchron aus `daten.*` (Muster Weltboss Z. 46552) — **ohne** die `pushPendingReward`-„an
    alle"-Zusage. Einfacher, aber der Reiz „gemeinsam jagen, gemeinsam ernten" entfällt, und wer den
    letzten Schlag zufällig führt, kassiert allein.
  - **Empfehlung:** Weg (a) mit **Chance je Anteil** — er hält die anteilige Fairness des Nests und
    macht das Modul nicht F5-druckbar (Server ist Autorität über die Chance). In BEIDEN Wegen gilt:
    der neue `A2`-Zweig braucht seinen **eigenen `type`**, sonst fällt die Belohnung in den Rückfall
    „+500 Kredite für deinen Bug-Report" (Falschaussage; bei fehlendem `credits`: „+NaN Kredite"),
    und er filtert jeden Wert einzeln (`Math.floor`, `> 0`), weil `claimPendingRewards` in einem
    stillen `try/catch` läuft.

**`claim` mit `save()` — PFLICHT (Regel 73):** `POST /api/pending-rewards/claim` macht
`list.shift()` + `saveDb()` — die Belohnung ist beim Ausliefern schon aus der Warteschlange, es gibt
keinen zweiten Versuch. Der `A2`-Zweig in `claimPendingRewards` MUSS `save()` rufen (Muster `festung`
Z. 29761, `alien-nest` Z. 29782) — genau `festung`/`alien-nest` hatten das vergessen und lieferten
einen Datenverlust aus.

### 8.5 ACHTUNG — Belohnungshöhe vor dem Bau gegen die Lagerdeckel messen (Regel 57)

Falls A2 **entgegen der Empfehlung** je Rohstoffe oder Einmalzahlungen ausschüttet: gegen **beide**
Deckel rechnen (`storageCap`, `tier2StorageCap`), nicht gegen den Zufluss, und gegen ein **mittleres**
Konto. **ACHTUNG — die im Entwurf genannte Zahl ~33.000 stammt aus einem anderen Konzept
(`sektorkarte-konzept`, Messfrage 3) und ist HIER nicht belegt** (Regel 41); der gemessene
Endausbau-Deckel liegt bei 803.800 (CLAUDE.md), 33.000 wären ~4 % davon, plausibel aber unverifiziert.
Wer diesen Zweig baut, misst `storageCap` gegen ein reales Mittelkonto erneut, statt die Zahl zu
übernehmen. Für exklusive Module/Sternenessenz (die Empfehlung aus 3.3) entfällt der ganze Abschnitt —
die haben keinen Lagerdeckel.

---

## 9. Icon + vollständige `desc`

Pflicht bei jedem neuen Inhalt (Hausregel 7). Falls A2 ein neues Modul(-Set) als Beute einführt:
jedes Modul braucht ein eigenes Icon (SVG oder gültiges `ti-*` aus der 69er-Whitelist, `check-icons.js`
sauber — **hier greift `check-icons.js` wirklich**, anders als beim Badge-Emoji, Abschnitt 7) und eine
**vollständige, selbsterklärende `desc`** — ganzer Satz mit Wirkung, Deckel/Stapel, und der
Herkunfts-Angabe („nur aus einem Wrackkonvoi"). **ACHTUNG — temporale Todeszone:** Wenn die `desc`
ihre Zahl aus einer Konstante ableitet, muss die Konstante in der Datei **vor** dem Array-Literal
stehen (Regel 38: `RESEARCH_DEFS`/`ITEM_DEFS`/`HELP_SECTIONS` werden beim Laden ausgewertet; eine
`const` weiter unten liegt in ihrer Todeszone und das Spiel startet gar nicht). Reihenfolge vorher
**messen**, nicht schätzen (`node -e "s.indexOf('const ZIEL') < s.indexOf('const QUELLE')"`).

---

## 10. Falls Backend (Option A): Schalter, Reihenfolge, Solo, Parität

- **Notausschalter Pflicht:** `A2_SPAWN_AKTIV` nach Muster `NEST_SPAWN_AKTIV` (Z. 9798) — `A2Tick`
  kehrt in Zeile 1 zurück, wenn aus. Steht bei Auslieferung auf `false`, wird im **Frontend-PR**
  umgelegt, bleibt danach als Notaus stehen (der Deploy hing 13-mal). Ein Test hält fest, dass er auf
  `true` steht, damit er nicht still zurückkippt (Muster `test_festung_http.js` Abschnitt 10).
- **Auslieferungsreihenfolge: Backend zuerst mit Schalter `false`** (Regel 60). Ginge das Backend
  allein live mit `true`, entstünde ein Ziel, das niemand sieht/angreifen kann; ginge das Frontend
  allein live, riefe es Routen, die es nicht gibt. Der Server darf hinterherhinken, das Frontend
  nicht. **Ausnahme:** Fällt ein Kampf-Modul (3.3 Variante 3), ist die Backend-zuerst-Reihenfolge
  ohnehin doppelt Pflicht (Kampfwert-Divergenz).
- **Solo-Modus:** `db.galaxy`/`db.shared` existieren solo (`useBackend()===false`) nicht. **Empfehlung:
  A2 zunächst nur online (kein Solo-Spawn)** — solo sieht der Spieler dann schlicht kein Ziel, was
  ehrlich und harmlos ist.
- **Paritätstest — die Kopplung an den Solo-Rückfall war im Entwurf FALSCH und ist korrigiert.** Der
  Entwurf behauptete, „nur online" spare die Kopie-Familie. Das ist am Code widerlegt: Das Nest ist
  server-autoritativ (Option A, kein Solo-Spawn nötig) und trägt im Frontend **trotzdem** eine Kopie
  der Stufentabelle — `NEST_STUFEN` (Z. 13772, Kommentar „EINE Quelle für Kartenmenü und
  Angriffsvorschau (GR-2)"), gelesen von `nestStufeDef`/`nestMapMenu`/`nestVorschauHtml`, und
  `test_nest_paritaet.js` hält sie Feld für Feld gegen `server.js`. Der Grund ist nicht der Solo-Modus,
  sondern dass die Vorschau die Werte schon **online** braucht, bevor der Server geantwortet hat.
  Genau die Anzeigestellen, die dieses Konzept verlangt, erzwingen eine solche Kopie: das Kartenmenü
  nennt „welche Beute lockt" und „geschätzte Verteidigung" (Abschnitt 2/7), der LP-Balken kommt aus
  `kartenFuellBalken` (Abschnitt 7), die Vorschau misst Erfolgschance/Schwäche (Abschnitt 2/8).
  **Die Entscheidung ist deshalb explizit zu treffen:**
  - **ENTWEDER** alle Vorschauwerte (LP-Max, Stufenname, Beute-Vorschau, geschätzte Verteidigung)
    vollständig aus dem `galaxyCache`-Objekt des Servers rendern — **keine** Frontend-Tabelle, dann
    **kein** Paritätstest. Das ist gangbar, wenn der Server jede angezeigte Zahl mitliefert.
  - **ODER** — wenn eine A2-Stufen-/Beutetabelle im Frontend liegt (Muster `nestMapMenu`/`NEST_STUFEN`)
    — dann `test_A2_paritaet.js` **bedingungslos** führen, NICHT „nur falls Solo-Rückfall". Sobald A2
    Stufe/LP/Beute aus einer Frontend-Tabelle rendert, ist das eine zweite Wahrheit mit Paritätspflicht,
    unabhängig davon, ob es je einen Solo-Spawn gibt.
- **Backend-Parität einer KAMPFFORMEL** ist nur bei 3.3 Variante 3 (Kampf-Modul) nötig. Bei reinem
  PvE-Ziel ohne Kampf-Modul verändert A2 keine PvP-Kraft. Die Kampfkraft-Rechnung liegt ohnehin
  serverseitig (`computeAttackPowerFromComposition`); der Client rechnet nur die **Vorschau** und muss
  dafür dieselbe Funktion wie das Nest benutzen (`festungRohkraft`-Muster: Grundwert je Klasse aus
  `SHIP_DEFS` × `diminishingShipCount`, NICHT `attackPowerRaw` — sonst nennt die Vorschau einen
  anderen Faktor als der Kampf).

---

## 11. Prestige / Aufstieg

- **Das Ziel selbst** lebt in `db.galaxy` (Option A) — von Prestige/Aufstieg eines einzelnen
  Spielers unberührt (es ist Weltzustand).
- **Ausstehende Belohnung** (`__pendingRewards`) wird beim `claim` sofort in den Spielstand gebucht;
  was danach ein Reset mitnimmt, folgt der jeweiligen Größe: Kampfpunkte/xp gehen verloren wie üblich,
  **Sternenessenz übersteht Prestige UND Aufstieg** (`state.ascension.essence`) — deshalb ist sie der
  richtige Träger für eine über Wochen erspielte Beute (3.3 Variante 2). Ein exklusives Modul bleibt
  im Inventar und folgt dessen Erhaltungsregeln.
- **Ein Bestenlisten-Zähler** (falls 3.2 „ja") liegt am **Nutzerobjekt** (`user.…`), nicht im
  Spielstand — er ist damit reset-unabhängig und server-beobachtet. Widerruf/Reset löscht ihn nicht
  (Muster `user.pveKills`, monoton).
- Ein clientseitiges A2 (Option B) mit Zustand im Spielstand müsste entscheiden, ob das Ziel einen
  Reset überlebt — **ACHTUNG:** ein driftendes NPC-Ziel im Spielstand, das Prestige überlebt, ist
  eine ungewöhnliche Kopplung; im Zweifel beim Reset verwerfen (es ist Weltzustand, kein Besitz).

---

## 12. Wächter / Testplan

Jeder Test mit Gegenprobe in **beide** Richtungen (grün neu, rot alt), Prüfnamen per `diff`
verglichen (nicht gezählt — Regel 60), jede Gegenprobe mit „was fallen MUSS"-Liste + `WERKZEUGFEHLER`
(Regel 71).

| Test | misst | Gegenprobe |
|---|---|---|
| `test_A2_ui.js` (Frontend) | Abzeichen sichtbar (nicht nur im DOM), Kartenmenü nennt Restzeit+Beute, Vorschau **misst** die Erfolgschance (zwei Läufe, andere Zahl — Regel 61), Marker im Kartenausschnitt (KB-20c/1c) | am alten Stand fallen die Abzeichen-/Menü-Prüfungen |
| `test_A2_http.js` (Backend, Option A) | Drift im Tick, **Despawn** nach Lebensdauer (`entkommen`-Ausgang), `schlaege[uid]`-Abklingzeit, `verpasst`-Ausgänge (kein Schaden, Grund genannt — je **weitergezogen** UND **entkommen**), Ziel-Fund über `zielId` nach Drift, anteilige `pushPendingReward` an alle inkl. Auslöser, `A2_SPAWN_AKTIV===true` | Sperre in den Spielstand → gelöschtes Feld gibt Schlag frei; voller Wurf statt angekommener Schaden → Beute-Anteil kippt; Mission ohne `zielId` → Ziel nach Drift nicht gefunden |
| `test_rundflug.js` (Bestand) | A2 verwendet volle Rundreise (`endTime = jetzt+flug*1000`), steht NICHT in `EINWEGIG_ERLAUBT` | halbierte Dauer → 1j schlägt an |
| `test_berichtspflicht.js` (Bestand) | `A2-angriff` hat Zeichner-Zweig + Kategorie + richtige Einfärbung, jeder Ausgang (Kampf, weitergezogen, entkommen, Server weg) schreibt `pushReport` | fehlender Zweig → 22-Zeichen-Karte |
| `test_belohnungen_speichern.js` (Bestand) | der `A2`-Zweig in `claimPendingRewards` ruft `save()` | ohne `save()` → im Ergebnis benannt |
| `test_A2_paritaet.js` (**bedingungslos, wenn eine Frontend-Tabelle existiert** — nicht „nur Solo") | jedes Feld der Frontend-Beutetabelle == `server.js` | Backend-Kopie mit abweichendem Wert → benennt Feld/Wert |
| `test_schiffsmodul_paritaet.js` (**nur bei 3.3 Variante 3**, Kampf-Modul) | die neuen `SHIP_MODULE_SET_DEFS`-Felder Frontend == Backend | Backend-Kopie mit abweichendem `atk`/`hull`/`shield` → fällt |

**Messfalle (Angriffs-Test):** frisches Opfer/Ziel je Messung, Anfängerschutz zwischen Serverstarts
leeren (`__attackShieldUntil = 0`), Verband mit Trägern zusammenstellen (`capFighterSelection` kappt
Jäger auf Hangarplätze — ohne Träger misst man den Hangardeckel statt der Kampfwirkung).

---

## 13. Offene Messfragen — vor dem Bau zu klären

1. **ACHTUNG — Lebenspunkte gegen echte Flottenkräfte rechnen** (Regel 41, nicht gegen das Gefühl).
   Maßstab sind die gemessenen Schlagkräfte des Festungs-Kapitels (**7.500 / 44.000 / 240.000 je
   Schlag** für Einsteiger / Mittelfeld / Endspiel, Kommentar server.js Z. 9820). Ein A2-Ziel soll
   solo-tauglich sein → LP eher am unteren Ende, Größenordnung Sporenherd 40.000 / Schanze 30.000.
   **Korrektur gegenüber dem Entwurf:** Das ist NICHT „1–2 Endspiel-Schläge". Gegen die zitierte
   Messtabelle (server.js Z. 9817–9825) sind 40.000 LP gemessen **≈4–5 Einsteiger-Schläge (7.500),
   ≈1 Mittelfeld-Schlag (44.000) bzw. 0,17 Endspiel-Schläge (240.000)** — die Tabellenzeile sagt für
   den Sporenherd wörtlich „5,3 / 0,9 / 0,2 Schlaege". Der Anker muss zur Schlagkraft 240.000 passen:
   Wer wirklich 1–2 Endspiel-Schläge will, müsste die LP auf ~240.000–480.000 heben — das wäre dann
   aber kein Einsteiger-Ziel mehr. Für „solo-tauglich" bleibt die Größenordnung 30.000–40.000 LP
   richtig; nur das Etikett war falsch. **Zu messen: wie viele Schläge bei welcher Abklingzeit** —
   Vorschlag `A2_ABKLING_MS` kürzer als das Nest (`NEST_ABKLING_MS = 4h`, Z. 9842), weil das Ziel
   davonläuft.
2. **ACHTUNG — Drift-Intervall gegen die Abklingzeit prüfen.** Beim Nest: `NEST_WANDER_MS = 12h`
   gegen `NEST_ABKLING_MS = 4h` — die Abklingzeit wäre bei der Wanderung ohnehin abgelaufen. Für A2
   dieselbe Relation messen: driftet es schneller als die Abklingzeit, entsteht ein anderes Verhalten.
3. **ACHTUNG — Lebensdauer/Despawn gegen 1 und 2 rechnen (Abschnitt 4).** `A2_LEBENSDAUER_MS` bzw.
   `A2_MAX_DRIFTS` muss so bemessen sein, dass ein Solo-Spieler das Ziel im verfügbaren Fenster
   (Anflug + verfügbare Schläge bei `A2_ABKLING_MS`) fällen kann, bevor es entkommt. LP (1), Abklingzeit
   (1/2), Drift (2) und Lebensdauer (3) hängen zusammen und werden **gemeinsam** kalibriert.
4. **ACHTUNG — Entstehungsquelle und Spawn-Rate (galaxieweit gleichzeitig).** A2 hat keine
   Nest-Kopplung an ein Ereignis; die Quelle ist zu wählen und zu messen (Abschnitt 6, Bauteil 3):
   an welches Intervall/Ereignis, mit `A2_WURF_CHANCE` je `A2_WURF_MS`, und `A2_MAX` (wie viele
   gleichzeitig). Zu solo-tauglich heißt: mindestens EINS soll fast immer irgendwo stehen, sonst ist
   „die Karte absuchen" frustrierend leer — aber nicht so viele, dass die Exklusivität verwässert.
   Rate messen, nicht raten (Nest zum Vergleich: `NEST_MAX = 12`, `NEST_WURF_CHANCE = 0.35` je
   `NEST_WURF_MS = 8h`).
5. **ACHTUNG — exklusive Beute-Rate (falls Module, 3.3 Variante 1/3).** Wie oft fällt das exklusive
   Modul je Erlegung? Zu häufig entwertet die Exklusivität, zu selten ist das Ziel nicht lohnend.
   Gegen die Fall-Chancen der bestehenden `quelle:'boss'`/`unikat`-Stücke (`grantBossSetModule`)
   messen. **Dazu (Abschnitt 8.4): der Auslieferungsweg** — wie „anteilig an alle" bei einem
   unteilbaren Modul aussieht (jeder ein volles Modul / nur der letzte Schlag / Chance je Anteil).
6. **ACHTUNG — Kollision des Drift-Ziels mit anderen Weltobjekten.** Das gewählte Drift-Zielsystem
   muss belegte Systeme meiden (Festung, Nest, anderes A2) — Muster `astFreiePlaetze` / das „freies
   System" des Nests (Abschnitt 6). Wird es bewusst zugelassen, ist es als Karten-Messfrage (KB) zu
   markieren (Marker-/Abzeichen-Kollision am selben Knoten).
7. **Icon des Badge-Emojis (Abschnitt 7):** KEIN `check-icons.js` (das prüft Emoji nicht) — sondern
   Kollisionsprüfung (nicht ⚔️/🌀/🏰/👽/🛡/👾/👑/🎯 doppelt) plus Render-Blick auf den Zielgeräten.
   `check-icons.js` gilt nur für die Modul-Icons der Beute (Abschnitt 9).
8. **Offene Produktfrage an Sascha (blockierend):** die Kern-Entscheidungen 3.1 (Backend ja/nein),
   3.2 (Bestenlisten-Emblem ja/nein), 3.3 (Beute-Art) und die Frage aus Abschnitt 0 — **lohnt A2
   überhaupt neben dem vorhandenen Vex-Nest, oder ist die bessere Antwort, das Nest sichtbarer zu
   machen?** Ohne exklusive Beute UND ohne echtes Entkommen (Abschnitt 4) ist A2 gemessen ein dritter
   Nomaden-Klon.

---

## Änderungen gegenüber dem Entwurf

Welche Kritik-Befunde wie eingearbeitet wurden:

- **[blocker] Modul-Beute hat keinen Auslieferungsweg** → Abschnitt 8.4 weist den Modul-Transport als
  eigenes Bauteil aus, benennt die gemessene Sperre (`claimPendingRewards` liefert nur Zahlen;
  `grantBossSetModule`/`grantUnikatModul` laufen synchron, nie über `pushPendingReward`) und legt zwei
  Wege (a/b) mit Folgen als Sascha-Option vor, inkl. der offenen „anteilig-an-alle"-Frage
  (Messfrage 5).
- **[wichtig] Beute-Art ist eine versteckte Entscheidung, die 3.2 umstößt** → neue benannte
  Entscheidung **3.3** mit drei Varianten und den drei Folgen (keine Parität / Parität + Backend-zuerst).
  In 3.2 ist der Satz „keine Kampfformel-Parität" ausdrücklich an 3.3 gebunden.
- **[wichtig] Mission braucht die persistente Ziel-ID, nicht nur das System** → Abschnitt 8.1: `zielId`
  UND `system` reisen mit; Backend-Fund über `zielId` (Messung an `nestAufloesen`/Endpunkt belegt).
  Die drei Backend-Bauteile (Endpunkt, `A2FindeMission`, Feld-Init) stehen jetzt als geschlossene
  Liste in Abschnitt 6.
- **[wichtig] Der Selbst-Despawn ist nicht designt (nur Nest-Verhalten kopiert)** → neuer Abschnitt 4
  „Das Entkommen" mit `A2_LEBENSDAUER_MS`/`A2_MAX_DRIFTS`, dem dritten `verpasst`-Grund `entkommen` und
  der Kalibrier-Vorgabe; als eigene Messfrage 3 verankert.
- **[wichtig] Paritätstest zu eng an den Solo-Rückfall gekoppelt** → Abschnitt 10 stellt die
  Entscheidung explizit (alles aus `galaxyCache` rendern ODER Paritätstest **bedingungslos**); der
  Entwurfssatz „nur online spart die Kopie-Familie" ist gestrichen und als am Code widerlegt benannt.
  Testplan (12) führt `test_A2_paritaet.js` entsprechend bedingungslos.
- **[wichtig] „40.000/30.000 LP = 1–2 Endspiel-Schläge" widerspricht der Messtabelle** → Messfrage 1
  korrigiert: 40.000 LP sind ≈4–5 Einsteiger-Schläge / ≈1 Mittelfeld-Schlag / 0,17 Endspiel-Schläge;
  der Anker passt jetzt zur Schlagkraft 240.000, das Etikett „1–2 Endspiel-Schläge" ist entfernt.
- **[hinweis] check-icons.js prüft das Badge-Emoji nicht** → Abschnitt 7 und Messfrage 7 trennen die
  Pflicht sauber: `check-icons.js` nur für Modul-Icons (Abschnitt 9), fürs Badge Kollisionsprüfung +
  Render-Blick.
- **[hinweis] ~33.000 Lagerdeckel aus fremdem Konzept** → Abschnitt 8.5 markiert die Zahl als „vor dem
  Bau erneut messen" und bindet den ganzen Abschnitt an den (nicht empfohlenen) Rohstoff-/Einmalzahlungs-Fall.
- **[hinweis] Offline-Nachholen nicht adressiert** → Abschnitt 8.3 benennt den `showLog=false`-Pfad und
  die Pflicht, den kein-Kampf-/`verpasst`-Zweig auch offline vollständig zu halten.
- **[hinweis] Backend-Bauteile nur als Präzedenz** → Abschnitt 6 „Backend-Bauplan" als geschlossene
  Fünf-Punkte-Liste (Feld-Init, `A2Tick` mit Schalter-Return, Entstehungs-Zweig, Drift/Despawn, Endpunkt
  + Sucher).
- **[hinweis] Kollision des Drift-Ziels mit anderen Weltobjekten** → Abschnitt 6 (Bauteil 3/4) und
  Messfrage 6: Drift-Zielsystem meidet belegte Systeme (Muster `astFreiePlaetze`) bzw. als KB-Frage
  markiert.

## 14. Stand der Umsetzung (02.09.2026)

**Backend** (`kolonie-kepler7-backend`, auf `master` seit dem 28.08.2026): `db.galaxy.wrackKonvois`,
`A2Tick` (Entstehen, Drift, Entkommen nach `A2_LEBENSDAUER_MS` = 18 h), Endpunkt mit Sucher über
`zielId`, `A2SchlagAusfuehren` (flacher Wurf, gezählt wird der ANGEKOMMENE Schaden), Belohnung
`{ type:'wrackkonvoi', essenz, kampfpunkte, xp, credits, modul?, kampfmodul? }` an alle Beitragenden,
Abklingzeit `A2_ABKLING_MS` = 2 h **am Ziel** (nie im Spielstand). `kv_bergungspanzer` steht in
`SHIP_MODULE_COMBAT_BASE`, Parität hält `test_A2_http.js` 8e. Wächter: `tests/test_A2_http.js`
(Port 3234, 35 Prüfungen, vier Gegenproben). **`A2_SPAWN_AKTIV` steht auf `false`** –
Auslieferungs-Riegel (Regel 60) und Notausschalter zugleich.

**Frontend** (v8.625.0, dieser Stand):

- **Karte:** eigener Knoten `data-map-konvoi` in der Systemansicht (`konvoiImSystem` →
  `konvoiMarkerXY` + `kbMarkerFrei`, Rumpfzustand am Knoten), Kartenmenü `konvoiMapMenu` mit Rumpf,
  Abklingzeit und Angriff.
- **Mission** `konvoi-angriff` (Form A, Rundflug; eigener `MISSION_LINIEN`-Eintrag) trägt `zielId`
  UND `system`; ein zweiter Angriff auf dasselbe Ziel ist gesperrt, solange einer unterwegs ist
  (`schonUnterwegs`).
- **Auflösung** in den Missions-Dispatchern: Kampfausgang über `pushReport({ type:'konvoi-angriff', … })`,
  der `verpasst`-Ausgang (entkommen, aufgebracht, weitergedriftet) über `angriffOhneKampf` mit
  benanntem Grund – kein stilles `ok`. Berichtskategorie `combat`, eigener Renderer-Zweig.
- **Belohnung:** Zweig `wrackkonvoi` in `claimPendingRewards` – `essenz` → `state.ascension.essence`,
  `modul`/`kampfmodul` → `konvoiModulAusServerwurf` (der Server würfelt, der Client legt nur ab;
  beide Modulfelder werden getrennt behandelt).
- **Beute:** `kv_bergungslogik` (`MODULE_DEFS`, `effect:'prod'`) und `kv_bergungspanzer`
  (`SHIP_MODULE_DEFS`, Klasse `schwerelinie`, `effect:'hull'`), beide `quelle:HERKUNFT_KONVOI` – die
  **fünfte** Herkunft, mit eigenem `HERKUNFT_TEXT.konvoi` und zwei Icons (`mod_kv_bergungslogik`,
  `sm_kv_bergungspanzer`). Das Herkunfts-Schloss hält sie aus jedem Fundtopf und beiden Schmieden.
- **Wächter:** `tests/test_A2_ui.js` (29 Prüfungen) plus Erweiterungen in `test_iconabdeckung` §8,
  `test_kartenmarker` und `test_wertstreuung` §3a.

**Auslieferungsreihenfolge, wie gebaut:** Das Frontend liest `galaxyCache.wrackKonvois`. Solange der
Backend-Schalter aus ist, ist die Liste leer – die Karte zeichnet nichts, es gibt kein Menü und keine
Mission, also keinen stillen Falschzustand. `A2_SPAWN_AKTIV` wird im Backend **unmittelbar nach**
diesem Frontend-Merge umgelegt (eigener PR; `test_A2_http.js` §9 wird dabei mit umgestellt), damit
Ankündigung (Patchnote 8.625.0) und Wirkung im selben Fenster liegen.

**Was die fünfte Herkunft gekostet hat:** Acht Test-Parser gaben die `HERKUNFT_*`-Konstanten als
getippte Liste mit und starben an `HERKUNFT_KONVOI is not defined` (`test_abgrund_gegenstaende`,
`test_abgrund_schiffsmodule`, `test_abgrundbilanz`, `test_abgrundmodule`, `test_herkunft`,
`test_schiffssynergien`, `test_abgrund_module2`) oder lieferten still `null` (`test_bossmodulsets`:
„MODULE_DEFS nicht geparst"). Alle acht leiten das Prelude jetzt aus der Datei ab
(`JS.match(/const HERKUNFT_[A-Z_]+ = '[a-z]+'/g)`); die übertragbare Regel steht in
`docs/PROJECT_MEMORY.md` §5.

**Bewusst entfallen:** Ein Kampfformel-Paritätstest (§10/§12) – der Schaden wird ausschließlich
serverseitig gerechnet, `A2SchlagAusfuehren` kommt im Frontend nicht vor; die einzige Kopie-Familie
dieser Etappe (`kv_bergungspanzer` in `SHIP_MODULE_COMBAT_BASE`) hält `test_A2_http.js` 8e im
Backend.
