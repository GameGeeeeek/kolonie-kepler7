# Inhalts-Ideen – belegter Rückstand

Aufgenommen am 09.08.2026 auf Wunsch von Sascha („merke dir das alles, wir gehen es ein anderes
Mal an"). Alle Einträge sind **am Code belegt**, nicht ausgedacht: Jede Zeilennummer bezieht sich
auf `weltraum_kolonie.html` (Stand v8.466.0, 57.242 Zeilen) bzw. auf `server.js` des Backends.

Die Liste entstand aus fünf parallelen Lese-Durchgängen über die Spieldatei mit den Fragen: Wo läuft
das Spiel aus? Welche Systeme sind gebaut, aber dünn befüllt? Was haben Spieler laut Kommentaren
tatsächlich gewünscht? Was ist technisch da, aber inhaltlich leer?

**Warum diese Datei existiert:** Das Projekt hat schon einmal alle Tests im Sitzungs-Scratchpad
verloren (CLAUDE.md). Eine Ideenliste, die nur im Chatverlauf steht, ist beim nächsten Mal weg.

---

## 1. Zusagen, die das Spiel sich selbst gegeben hat

Diese drei stehen als Absicht im Quelltext und wurden nie eingelöst. Sie haben deshalb Vorrang: Es
sind keine neuen Ideen, sondern offene Posten.

### 1.1 Symbolpaket für die 36 Schiffsklassen-Module
**Beleg:** Z. 7252 („Offen bleiben die Schiffsklassen-Module (36 Stück)"), Z. 7259 („bekommen ihr
eigenes Paket"), Z. 7265 („ausdrücklich vorgemerkt") – dreimal schriftlich zugesagt.
**Ist-Zustand:** `SHIP_MODULE_DEFS` (Z. 21739–21830) hat 44 Einträge; nur die acht Abgrund-Module
(`sm_ab_*`) tragen handgezeichnete SVG-Symbole, die übrigen 36 flache `ti-*`-Zeichen.
**Aufwand:** reine Handarbeit, kein Balancing, kein Test. Betrifft eine Ansicht, die ständig offen ist.

### 1.2 Drittes mondexklusives Gebäude – wirtschaftlich statt militärisch
**Beleg:** Z. 4382 formuliert den Wunsch im Plural („Monde um einzigartige Gebäude erweitern").
Umgesetzt sind zwei, beide `category:'defense'`: `abhorchposten` (Z. 4391) und `mondschild` (Z. 4395).
**Ist-Zustand:** Ein Mond hat bis heute **kein einziges eigenes Wirtschaftsgebäude**.
**Vorschlag:** „Massentreiber-Schleuder" – senkt die Flugzeit aller Missionen, die von diesem Mond
starten. Das Muster „Startort entscheidet" existiert bereits beim Tiefenhafen (`PLANET_ROLE_TIEFENHAFEN`,
Z. 40935). `moonOnly` ist ein rein deklaratives Flag und an genau drei Stellen ausgewertet.

### 1.3 Event-Modul für die Raffineriekrise
**Beleg:** `EVENT_CALENDAR` (Z. 11534) hat 7 Events. Die sechs älteren haben je ein Event-Schiff
(`unlockEventParts`, Z. 17134–17158) **und** je ein Event-Modul (`ev_kometenschild` … `ev_erzgreifer`,
Z. 21790–21800). `raffineriekrise` (Z. 11564, `buffOnly:true`) hat weder noch.
**Besonderheit:** Dass es kein Schiff bekam, ist bei Z. 11559–11563 ausdrücklich begründet – dass es
kein Modul hat, nirgends. Ein einzelner Eintrag schließt die Lücke.

---

## 2. Wo Langzeitspieler aufhören

Der Code enthält die Diagnose selbst. Zum **alten** Aufstiegsbaum steht bei Z. 25256–25262:

> „Sternenessenz häufte sich an, ohne dass es noch etwas zu kaufen gab. Genau das ist die Stelle, an
> der Langzeitspieler aufhören."

Genau das wiederholt sich eine Ebene höher, nur langsamer.

### 2.1 Zweite Reihe im Aufstiegsbaum
`ASCENSION_TREE_DEFS` (Z. 25248–25255) hat **sechs Zweige und hatte nie mehr**. Jenseits Stufe 10
kostet ein Prozentpunkt das Fünfundzwanzigfache (`ASCENSION_LATE_RATE`, Z. 25273).
**Vorschlag:** 3–4 neue Zweige mit Feld `abAufstieg:3/6/10`, die erst ab einer Aufstiegszahl
erscheinen (`state.ascension.count`, Z. 25399). Alle zahlen in bereits gedeckelte Bonusgruppen ein.

### 2.2 Der Aufstieg eskaliert nicht
`ASCENSION_MIN_PRESTIGE = 3` und `ASCENSION_MIN_SCORE = 50000` (Z. 25246–25247) sind **konstant** –
der zehnte Aufstieg verlangt exakt so viel wie der erste. Eine Schleife mit gleichbleibender Länge.

### 2.3 Der Abgrund hört bei Tiefe 120 auf, Neues zu zeigen
- Letzte Reliquie in Tiefe 120 (`abgrundReliktDef`, Z. 42449–42455), danach zyklische Wiederholung
- Wächternamen wiederholen sich mit „(n. Wiederkehr)" (Z. 41417–41422)
- Die Chronik endet bei Tiefe 150 (Z. 42595) wörtlich mit: *„Es gibt nichts mehr zu entdecken … Was
  bleibt, ist die Zahl."*

**Vorschlag:** zweite Reliquienreihe (6 Stück) ab Tiefe 130, zwölf weitere Wächternamen
(`ABGRUND_WAECHTER_NAMEN`, Z. 41393–41406), vier bis sechs neue Chronik-Einträge.

### 2.4 Tiefen-Meilensteine, die Sternenessenz zahlen
Der Abgrund zahlt heute nur in den Punktestand (50 je Tiefe, `ABGRUND_SCORE_JE_TIEFE`, Z. 23860) und
in einen logarithmischen Produktionsbonus. Marken bei Tiefe 25/50/75/100/125/150 nach dem Vorbild
von `RESEARCH_MILESTONES` (Z. 10831 ff.) würden ihn an die einzige resetfeste Währung anbinden.

### 2.5 Die Lagerwand
Kommentarblock Z. 24673–24701 rechnet vor, dass Forschungen teurer werden können, als das Lager
fasst – und damit **dauerhaft unbezahlbar** sind. Nachgerechnet und bestätigt: Lagerdeckel 1 Mio →
Wand ab Stufe 16–18; 100 Mio → Stufe 30–35. Ursache: Kosten wachsen mit ×1,32–1,38 je Stufe,
`storageCap()` (Z. 19142) wächst linear plus logarithmisch.

**Zwei Auflösungen, beide tragfähig:**
- *Baustellen-Konto:* Warteschlangen-Einträge bekommen ein Feld `eingezahlt:{res:menge}`; ein neues
  Gebäude erlaubt, je Tick einen Anteil der Produktion direkt in den Auftrag zu buchen, statt ihn im
  Lager zu sammeln. Löst die Wand grundsätzlich.
- *Raumfaltungs-Silo:* Lagergebäude, dessen Beitrag mit `basis * 1.25^Stufe` wächst statt mit einem
  festen Summanden – dieselbe Kurvenform wie der Preis.

**Zweite Baustelle derselben Wand, die im Kommentar fehlt:** `megaStageCost()` (Z. 40795) mit
`MEGA_STAGE_COST_MULT = 2.6` – die 10. Dyson-Stufe kostet 268 Mio Erz. Für Bauaufträge gibt es
keinen „dauerhaft unmöglich"-Zweig wie bei der Forschung (`tryStartQueuedResearch`, Z. 24733).

---

## 3. Töpfe ohne Senke, Senken ohne Nachschub

### 3.1 Bergungsgut hat genau einen Abnehmer
Z. 7002 nennt die Bergungswerft ausdrücklich „das erste Gebäude, dessen Bau Bergungsgut verlangt".
Geprüft ist sie bis heute das **einzige** (`bergung:` findet als Nicht-Schiff-Verbraucher nur
`bergungswerft`, Z. 4337; alle übrigen Treffer sind die neun Tiefenschiffe).

### 3.2 Splitter nach ausgebauter Werkstatt
Einzige verbleibende Senke: 200 Splitter → 500 Kredite (`ABGRUND_SPLITTER_VERKAUF`, Z. 14555).

### 3.3 Kommandopunkte
Haben genau eine unbegrenzte Senke (Tagesaufgaben-Neuwurf). **Vorschlag:** „Offiziersstab" – nach
`OFFICER_MAX_LEVEL = 10` (Z. 22242) eine unbegrenzte, stark abflachende Stufe, Kosten weiter mit
1.6^n (`officerUpgradeCost()`, Z. 22299), Wirkung +0,25 Punkte je Stufe, gedeckelt bei +5.

### 3.4 Prisengut
Der Prisenhof ist die einzige Senke und endlich (Enterhaken, 5 Stufen, Z. 19709).
**Vorschlag:** „Prisenwerft" – ein Gebäude, das je Stufe N gekaperte Schiffe pro Kampf in die eigene
Flotte übernimmt statt in Prisengut, begrenzt auf die Klassen, die `isBoardable()` (Z. 19720)
ohnehin zulässt.

---

## 4. Dünn befüllte Systeme (Zählung vom 09.08.2026)

Gut gefüllt und ohne Handlungsbedarf: `ACHIEVEMENTS` 97 · `EXPEDITION_SPECIAL_EVENTS` 63 ·
`RANDOM_EVENTS` 60 · `BUILDING_DEFS` 48 · `RESEARCH_DEFS` 47 · `MODULE_DEFS` 47 (davon 20 Boss-Set-Teile,
also 27 normale) · `SHIP_MODULE_DEFS` 44 · `SHIP_DEFS` 42 · `ITEM_DEFS` 30.

**Auffällig dünn im Verhältnis zur Sichtbarkeit:**

| System | Zeile | Anzahl | Anmerkung |
|---|---|---|---|
| `DOCTRINE_DEFS` | 10983 | **3** | dünnstes System überhaupt |
| `ALLIANCE_PROJECT_DEFS` | 12733 | **2** | Allianzpunkte laufen laut Z. 12736–12752 leer |
| `ALLIANCE_MISSION_TYPES` | 36273 | **5** | speist **alle drei** Kadenzen (`allianceMissionFor`, 36324) |
| `ALLIANCE_SKIN_DEFS` | 36519 | **4** | `grantAllianceMissionSkin` gibt ab dem 5. Großprojekt null |
| `ALLIANCE_TITLE_DEFS` | 36433 | **5** | dito ab dem 6. |
| `HAPPY_HOUR_TYPES` | 18943 | **4** | Antimaterie nur im 25-%-Sammeltyp |
| `WORLDBOSS_ARCHETYPEN` | 44083 | **4** | Name/Archetyp/Schwäche werden unabhängig gezogen |
| `SIGNAL_TYPES` | 49663 | **5** | keines zeigt auf die Fraktionen |
| `EXPEDITION_TYPES` | 49191 | **6** | `derelict`-Band nur von `salvage` bedient |
| `SHIP_SYNERGY_DEFS` | 21841 | **6** | zwei Klassen ganz ohne Synergie |
| `TITLE_MAP` | 16624 | **11** | gegen 97 Erfolge – die Reihenfolge ist die Rangfolge |

Die Allianz-Einträge stechen heraus: Der Ehrentitel- und Anstrichvorrat **läuft nachweislich trocken**
(Belohnungszeilen 36609/36611 vergeben dann nichts mehr).

---

## 5. Mehrspieler – Maschinerie steht, Inhalt fehlt

Alle folgenden docken an **vorhandene, server-autoritative** Systeme an und respektieren die
Backend-Grenzen (kein WebSocket, 240 Anfragen/Minute je IP, Server-Tick alle 15 Minuten).

- **„Mitglied unter Beschuss"** – `postAllianceBaseNews()` (Z. 35952) schreibt bereits genau solche
  Systemzeilen; beim Angriff auf die *Basis* wird das genutzt, beim Angriff auf ein *Mitglied* nicht.
- **Mitgliederliste mit Aktivität** – `loadAllianceMembers()` (Z. 35254–35263) zeigt nur Name und
  Rolle, obwohl Punktestand und „zuletzt gesehen" im selben Reiter längst geladen sind und in
  `renderFriendsBox` genau so verwendet werden.
- **Spieler setzen Kopfgelder aus** – das System ist vollständig, aber auf einen Fall festgenagelt:
  `resolveBountyServer` (server.js:4081) setzt wöchentlich 2.000 Kredite auf den Bestenlisten-Ersten.
- **Allianz gegen ein Fraktions-Bollwerk** – die Musterangriff-Maschinerie (Sammelfenster, Beitritt,
  gemeinsamer Abflug, serverseitige Auflösung) steht komplett; ihr fehlt nur ein PvE-Ziel.
- **Beistandsflotte** – `state.shipsAtAllianceBase` mit Ein-Autor-Dokument
  `alliance:<TAG>:basedef:<playerId>` ist das fertige Muster, heute nur auf die Basis beschränkt.
- **Allianz-Diplomatie** – zwischen Allianzen gibt es heute nur `declareWar` (Z. 35387) und
  `makePeace` (Z. 35410). Ein Nichtangriffspakt mit Laufzeit fehlt.
- **Ruhmeshalle mit Kategorien** – `updateHallOfFameServer` (server.js:3834) schreibt genau ein
  Objekt je Monat. Vier Kategorien statt einer kosten kaum mehr.

---

## 6. Welt statt Zahlen (der billigste Inhalt)

- **Sektorarchiv:** Die rund 102 handgeschriebenen `PLANETS`-Einträge (Z. 11798–11900) haben Namen
  wie „Verlorene Hoffnung" – und keine Zeile Text. Ein Feld `lore`, aufgedeckt beim Erkunden. Die
  ~400 generierten `gx*`-Welten bleiben bewusst außen vor.
- **Fraktions-Dossiers:** `FACTION_DIPLOMACY` (Z. 15304) um `lore`, `motto` und drei Rang-Splitter
  erweitern, die sich mit steigendem Ruf aufdecken – Rang 1 nennt Gerüchte, Rang 8 die Wahrheit.
- **Konvoi-Zwischenfälle:** `ROUTE_PIRACY_CHANCE = 0.05` (Z. 12946) ist heute ein stiller Ausfall.
  Sechs bis acht benannte Zwischenfälle mit Text und Ausgang machen daraus ein Ereignis.

Kein Balancing, kein Test, nur Schreiben.

---

## 7. Werkzeug, das über allem steht

**Automatische Beschreibungs-Prüfung als Anhang an `check-icons.js`.** Der meistgemeldete
Nicht-Bug des Projekts ist eine fehlende oder abgekürzte Beschreibung – belegt bei Z. 19254 und
Z. 51041 („keine Beschreibung was sie verbessern jede Stufe"), Z. 7524 („14 Forschungen hatten als
Beschreibung nur ein Stichwort"), Z. 7788, Z. 8632, Z. 52203. Hausregel 7 verlangt zu jedem Inhalt
eine vollständige `desc`; geprüft wird das bis heute nur von Hand.

Ein Prüfschritt, der alle DEFS-Arrays auf leere oder zu kurze `desc`-Felder abklopft, würde jede der
Ideen oben absichern, statt den Fehler ein siebtes Mal zu wiederholen.
