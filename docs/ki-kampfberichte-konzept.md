# KI-Kampfberichte – Konzept (22.08.2026)

Auftrag Sascha (AI-Hub-Runde): Als nächstes größeres AI-Hub-Projekt die **KI-Kampfberichte**
aus der Roadmap (`gamegeeeeek-ai-core/docs/AI-HUB-ROADMAP.md`, Punkt 5) – atmosphärische
Berichtstexte aus echten Kampfdaten. Dieses Dokument ist die Entscheidungsgrundlage; gebaut
wird erst nach Saschas Auswahl bei den offenen Entscheidungen unten.

## Die Grundregel, aus der alles andere folgt

**Die KI entscheidet nie – sie beschreibt nur.** Schaden, Treffer, Sieger, Verluste und Beute
kommen aus der Game Engine; der KI-Text ist reiner Schmuck. Daraus folgt die wichtigste
Architektur-Eigenschaft: **Ein fehlender oder verworfener Text ist kein Fehler.** Der Bericht
ist ohne ihn vollständig (er ist es heute ja auch); der Text erscheint als eigene Sektion
(„Logbuch des Kommandanten"), wenn er da ist, und sonst gar nichts – kein Ladezustand, kein
„wird verfasst…". Das ist dieselbe Entscheidung wie bei der Weltlage-Zeile (Regel 35 in der
Gegenrichtung: eine Box, für die es nichts zu sagen gibt, braucht keinen dritten Zustand).

## Gemessene Ausgangslage

- **Die Berichte entstehen im CLIENT** (`pushReport`, ~30 Arten) und tragen bereits alles,
  was ein Erzähltext braucht – am `npc-attack`-Bericht gemessen: `attackPower`,
  `defensePower`, `chancePct`, `phasen` (der Drei-Phasen-Verlauf!), `fleet` (Zusammensetzung),
  `ownLostShips`, `loot`, `cargoLimited`, `npcName`/`npcLevel`, `hasWeakness`/`weaknessType`,
  `flightTime`, `fromPlanet`. Es muss **keine neue Datenquelle** gebaut werden.
  **Nachtrag E0:** Der Bericht trägt sie weiterhin alle – der PROMPT bekommt seit dem
  28.08.2026 nur noch fünf davon (Gegner, Stufe, Ausgang, eigene und verlorene Schiffstypen).
  Begründung unten im E0-Ergebnis: Was das Modell nicht sieht, kann es nicht falsch
  wiedergeben, und die Zahlen stehen im Bericht direkt daneben.
- **AI Core läuft im LAN** (`192.168.178.45:8000`) und ist für Spieler-Browser unerreichbar.
  Jeder Weg führt über das Kepler-Backend auf dem Pi als Vermittler.
- **AI Cores Drossel zählt je Herkunft** (20 Aufrufe je 5 Minuten, 2 gleichzeitig). Aus AI-Core-
  Sicht ist der Pi EINE Herkunft – alle Spieler teilen sich dieses Budget. Die Warteschlange
  muss deshalb im Kepler-Backend liegen, nicht je Client.
- **Latenz am M715q**: ~~von 20–60 s auszugehen~~ – **E0 hat gemessen (28.08.2026): 69,7 s
  je Kampftext mit qwen3.5:4b**, also rund 52 Texte je Stunde. Niemals blockierend nutzbar,
  immer asynchron. Die 69,7 s sind der KALTE Lauf; ein zweiter Lauf mit demselben Prompt
  braucht 29,3 s (Ollamas Prompt-Cache) – für die Hochrechnung zählt der kalte, ein Spieler
  sieht immer ihn. Einzelheiten im E0-Ergebnis unten.

## Architektur (Empfehlung)

```
Spieler-Client ──(Kampfdaten als FELDER)──▶ Kepler-Backend (Pi) ──▶ AI Core (M715q) ──▶ qwen3.5
      ▲                                        │  Warteschlange,          /ai/chat
      └──(Poll: „ist mein Text fertig?")◀──────┘  Drossel je Konto,
                                                  Wahrheits-Sperre
```

1. **`POST /api/kampfbericht/text`** (Pi): nimmt die Kampf-FELDER entgegen – **niemals freien
   Text oder einen Prompt**. Der Prompt entsteht ausschließlich serverseitig aus einer festen
   Schablone; sonst wäre der Endpunkt ein freier LLM-Proxy für jeden, der einen Account hat.
   Felder werden validiert und geklammert (Namen durch `escapeHtml`, Zahlen als Zahlen).
   Antwort: sofort `202 {auftragId}` – die Arbeit läuft asynchron (dasselbe Job-Muster wie in
   Social Hub, aus demselben Grund: Minuten offene Verbindungen sterben).
2. **Warteschlange im Backend**: 1 Auftrag gleichzeitig Richtung AI Core, Tagesdeckel je Konto
   (Vorschlag: 10/Tag, Zahl offen), Gesamtdeckel/Tag als Notbremse. Ein voller Deckel lehnt mit
   Grund ab – der Client merkt sich das still (kein Spieler-Fehler, der Bericht ist ja fertig).
3. **`GET /api/kampfbericht/text/:id`**: Poll durch den Client (30-s-Takt reicht, der Bericht
   liegt ja schon vor). `fertig` → Text; `fehlgeschlagen`/unbekannt → Client hört auf zu
   fragen, Sektion bleibt weg. Der fertige Text wird **im Bericht des Spielstands** gespeichert
   (client-autoritativ ist hier in Ordnung: reiner Schmuck ohne jede Wirkung – die Grenze
   „kann ich etwas anfassen, das anderen gehört?" wird nicht berührt).
4. **AI Core bleibt unverändert** – `/ai/chat` genügt. Kein neuer Endpunkt, kein neues Modell.

## Die Wahrheits-Sperre (Code, nicht Prompt – Haus-Muster)

Lehre aus dem Piraten-Trait (der erste Entwurf erfand „Agilität" und „Flankenfeuer") und aus
AI-Core-Lektion 10: Verhaltensregeln für kleine lokale Modelle gehören als **Prüfung in den
Code**, nicht als Bitte in den Prompt. Vor dem Speichern prüft das Backend:

- **Jede Ziffernfolge im erzeugten Text muss in den Eingabedaten vorkommen** (nach denselben
  Rundungen, die der Prompt nennt). Eine erfundene Zahl → Text verwerfen, kein Retry (Kosten),
  Sektion bleibt weg.
- **Längendeckel** (~600 Zeichen) und `escapeHtml` beim Rendern – der Text ist Serverdaten im
  Client, wie jede Galaxie-Nachricht.
- **Schiffs-/Gegnernamen nur aus der Eingabe** – der Prompt bekommt die erlaubten Namen als
  Liste, die Prüfung verlangt, dass keine fremden `SHIP_DEFS`-Namen auftauchen.

Ohne diese Sperre wäre jeder Bericht eine potenzielle Falschaussage über einen Kampf, der
nachprüfbar anders lief – genau die Anzeigestellen-Fehlerklasse dieses Projekts, nur generativ.

### NACHTRAG E0 (28.08.2026): die Sperre allein genügt nicht

Der erste echte Messlauf hat diesen Abschnitt widerlegt. qwen3.5:4b lieferte acht Texte, die
Sperre verwarf zwei – nachgemessen trugen **alle acht** eine Falschaussage. Vier Texte kamen
als sauber durch und waren es nicht. Drei blinde Flecken, alle strukturell:

- **Zahlwörter** – „vierzig Quantenkreuzer" statt 45. Eine Ziffernprüfung sieht das nicht.
- **Einheiten** – „1260 Minuten" statt 1260 Sekunden, „über vier Stunden" für 480 Sekunden.
  Die Zahl steht in den Daten und ist damit erlaubt; falsch ist die Einheit.
- **Verschwiegenes** – die am Frachtraum gekappte Beute fehlte in beiden Texten. Ein Fehler
  ohne Zahl ist für eine Zahlenprüfung unsichtbar.

**Die erste Verteidigungslinie ist deshalb nicht die Sperre, sondern der PROMPT-ZUSCHNITT**
(Entscheidung Sascha): Das Modell bekommt nur noch Gegner, Stufe, Ausgang, eigene und verlorene
Schiffstypen – und die ausdrückliche Anweisung, gar keine Zahlen und Zeitangaben zu nennen.
Was es nicht sieht, kann es nicht falsch wiedergeben. Der Nebeneffekt ist der eigentliche
Gewinn: Die Stufe ist die einzige Zahl in den Daten, jede andere Ziffernfolge im Text ist damit
zwangsläufig eine Erfindung – **die Sperre oben wird dadurch scharf, ohne dass sie aufgerüstet
werden muss.**

Zwei Dinge, die beim Bau der Sperre im Backend zu beachten sind, beide gemessen:

1. **Der Vergleichsmaßstab ist der DATENBLOCK, nicht der ganze Prompt.** Gegen den ganzen
   Prompt verglichen waren drei Zahlen erlaubt statt einer – die 500 aus „höchstens 500
   Zeichen" und die 7 aus „Kolonie Kepler-7". Ein Text mit „500 Jäger fielen in 7 Wellen" kam
   damit sauber durch, unabhängig davon, wie kurz der Datenblock ist.
2. **Der Schiffsnamen-Vergleich ist EXAKT, kein Teilstring.** Sonst gilt der Mondzerstörer als
   erlaubt, sobald Zerstörer im Verband stehen – der Anlassfall der ganzen Prüfung kam so durch.

**Benannte Grenze, nicht geschlossen:** Zahlwörter bleiben unsichtbar. Der Schaden ist seit dem
Zuschnitt kleiner (der Prompt nennt gar keine Anzahl mehr, eine falsche Anzahl widerspricht
also keiner mitgegebenen Zahl), aber die Lücke ist da und steht als eigene Prüfung im Wächter
(`gamegeeeeek-ai-core/tests/test_kampftext_messlauf.py`, Abschnitt 7), damit sie niemand für
geprüft hält.

## Etappen

- **E0 – Messen statt schätzen: ERLEDIGT am 28.08.2026.** Werkzeug
  `gamegeeeeek-ai-core/tools/kampftext_messlauf.py`, vier Fälle je Modell (Sieg, Niederlage mit
  zwei verlorenen Phasen, gekappte Beute, ungenutzte Schwäche), zwei Läufe:

  | | qwen3.5:4b | qwen3.5:2b |
  |---|---|---|
  | Dauer, Lauf 1 (kalt) | **69,7 s** | 55,3 s |
  | Dauer, Lauf 2 (Prompt-Cache) | 29,3 s | 22,4 s |
  | von der Sperre verworfen | 2 von 8 | 8 von 8 |
  | **nachgemessen falsch** | **8 von 8** | 8 von 8 |

  **qwen3.5:2b ist keine Option** – es erfand Schiffsnamen („Aethelgard", „Vanguard"), drehte
  einen Ausgang um und schrieb 1374 Zeichen, wo 500 erbeten waren. Damit ist Modellwahl 4b und
  die Rate rund **52 Texte je Stunde**; der Tagesdeckel ist daran zu rechnen und nicht zu raten.
  Das Qualitätsergebnis steht oben im Nachtrag zur Wahrheits-Sperre – es hat den Prompt-Zuschnitt
  ausgelöst. **Offen bleibt die Wiederholungsmessung:** Der Zuschnitt ist an den vier echten
  Durchläufern gegengeprüft, nicht an einem neuen Lauf am M715q – „fast fehlersicher" gilt erst,
  wenn DIESELBE Messung wiederholt wurde (Regel 48).
- **E1 – Pilot: eine Kampfart.** Vorschlag **`npc-attack`** (häufigste Kampfart, reichste
  Daten, kein PvP-Risiko, kein zweiter Spieler betroffen). Backend-Endpunkte + Warteschlange +
  Wahrheits-Sperre, Client-Sektion im Bericht, Schalter `KAMPFTEXT_AKTIV` (Backend) – derselbe
  Auslieferungs-Schutz wie `FESTUNG_SPAWN_AKTIV`.
- **E2 – die großen Momente:** Weltboss, Festungs-Fall, Königin, PvP-Angriff (dort beide
  Perspektiven: Der Verteidiger bekommt denselben Kampf aus seiner Sicht erzählt – zwei Texte
  aus einem Datensatz).
- **E3 – Stil:** Varianz über die vorhandenen Weltbausteine (Doktrin, Offiziere, Sektor-Name
  im Prompt), nie über erfundene Mechaniken.

## Offene Entscheidungen (Sascha)

1. **Wer bekommt Texte?** Alle Spieler mit Tagesdeckel – oder Unterstützer-Vorteil (dann
   gehört er in `UNTERSTUETZER_VORTEILE`, sonst wirbt die Fläche falsch)?
2. **Welche Kämpfe zuerst?** Vorschlag E1 = `npc-attack`; Alternative: nur die seltenen großen
   Momente (Weltboss/Festung/Königin) – weniger Last, mehr Wirkung pro Text.
3. ~~**Modell:** 2b oder 4b~~ – **von E0 beantwortet: 4b.** 2b ist unbrauchbar (erfundene
   Schiffsnamen, umgedrehter Ausgang, 1374 statt 500 Zeichen), und der Geschwindigkeitsvorteil
   war mit 55,3 gegen 69,7 s ohnehin klein. Zu entscheiden bleibt daraus der **Tagesdeckel**:
   52 Texte je Stunde sind die Obergrenze der Maschine, nicht des Spiels.

## Testplan (Wächter je Etappe)

- Backend-HTTP-Test: 202-Sofortantwort, Deckel lehnt mit Grund ab, **Wahrheits-Sperre als
  Paar** (ein Mock-Text mit erfundener Zahl wird verworfen, einer ohne kommt durch – jede
  Hälfte allein wäre trivial grün), Prompt entsteht nie aus Client-Text (Feld `prompt` im
  Request wird ignoriert/abgelehnt).
- Frontend-Test: Sektion erscheint NUR mit Text (Gegenrichtung: ohne Text keine leere
  Überschrift), `escapeHtml` gemessen (Text mit `<script>` rendert als Text), Poll endet
  (kein Endlos-Poll nach `fehlgeschlagen`).
- Parität: keine – es gibt bewusst keine zweite Formel; der Text trägt keine Wirkung.
