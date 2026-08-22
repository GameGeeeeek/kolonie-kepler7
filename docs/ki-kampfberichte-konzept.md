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
- **AI Core läuft im LAN** (`192.168.178.45:8000`) und ist für Spieler-Browser unerreichbar.
  Jeder Weg führt über das Kepler-Backend auf dem Pi als Vermittler.
- **AI Cores Drossel zählt je Herkunft** (20 Aufrufe je 5 Minuten, 2 gleichzeitig). Aus AI-Core-
  Sicht ist der Pi EINE Herkunft – alle Spieler teilen sich dieses Budget. Die Warteschlange
  muss deshalb im Kepler-Backend liegen, nicht je Client.
- **Latenz am M715q**: eine Social-Hub-Caption (vergleichbare Textlänge) dauert gemessen ~28 s
  mit qwen3.5:2b. Für einen Kampftext ist von **20–60 s** auszugehen – niemals blockierend
  nutzbar, immer asynchron. **Messauftrag E0 unten, bevor Zahlen festgelegt werden.**

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

## Etappen

- **E0 – Messen statt schätzen** (ein Abend, nur Befehle für Sascha): einen echten
  Kampftext-Prompt mit echten Berichtsdaten am M715q gegen qwen3.5:2b UND 4b fahren. Gemessen
  werden Dauer und Qualität (erfindet es Zahlen?). Erst danach werden Tagesdeckel und
  Modellwahl festgelegt – ein Konzept ist kein Messergebnis (Regel 41).
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
3. **Modell:** 2b (schneller, mehr Texte/Tag) oder 4b (besser, ~3× langsamer) – E0 liefert die
   Zahlen für die Entscheidung.

## Testplan (Wächter je Etappe)

- Backend-HTTP-Test: 202-Sofortantwort, Deckel lehnt mit Grund ab, **Wahrheits-Sperre als
  Paar** (ein Mock-Text mit erfundener Zahl wird verworfen, einer ohne kommt durch – jede
  Hälfte allein wäre trivial grün), Prompt entsteht nie aus Client-Text (Feld `prompt` im
  Request wird ignoriert/abgelehnt).
- Frontend-Test: Sektion erscheint NUR mit Text (Gegenrichtung: ohne Text keine leere
  Überschrift), `escapeHtml` gemessen (Text mit `<script>` rendert als Text), Poll endet
  (kein Endlos-Poll nach `fehlgeschlagen`).
- Parität: keine – es gibt bewusst keine zweite Formel; der Text trägt keine Wirkung.
