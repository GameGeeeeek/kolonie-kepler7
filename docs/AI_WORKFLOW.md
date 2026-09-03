# Kepler 7 – KI-Workflow

Ziel: hohe Coding-Qualität ohne Entwicklungsstopp durch das Nutzungslimit eines einzelnen Cloud-Anbieters.

## Rollen der Geräte

### Gaming-PC – Haupt-Coding-Rechner

Der leistungsstarke Gaming-PC übernimmt lokale LLM-Inferenz und den eigentlichen Coding-Agenten.

Empfohlener Stack:

- aktuelles Ollama
- Claude Code, OpenCode oder Codex als Agenten-Oberfläche
- lokale Coding-/Reasoning-Modelle für den Großteil der Arbeit
- optional Cloud-Modelle als Eskalationsstufe für besonders schwierige Aufgaben
- lokaler Checkout von Frontend und Backend, damit Tests ohne Netzwerk-Latenz laufen

Claude Code kann über Ollamas Anthropic-kompatible API mit lokalen Modellen betrieben werden. Dadurch bleibt der gewohnte Agenten-Workflow nutzbar, ohne dass jede Anfrage Anthropic-Guthaben verbraucht.

Beispiel:

```bash
ollama launch claude
```

oder gezielt:

```bash
ollama launch claude --model gpt-oss:20b
```

Für OpenCode entsprechend:

```bash
ollama launch opencode --model gpt-oss:20b
```

### Lenovo M715q – AI Core / RAG / Wissensdienst

Der M715q bleibt dauerhaft laufender Hintergrunddienst:

- GameGeeeeek AI Core
- RAG-Index für Kepler Frontend, Backend und Social Hub
- semantische Code-Suche
- Projektwissen und Retrieval
- ggf. leichte Automatisierungen/Index-Aktualisierung

Der M715q soll nicht mehr das stärkste Coding-Modell tragen, wenn der Gaming-PC verfügbar ist. Seine Stärke ist 24/7-Verfügbarkeit und Wissensbereitstellung.

### Raspberry Pi – Deployment und bestehende Dienste

Der Raspberry Pi bleibt für:

- nginx / Kepler-Deployment
- Social Hub
- bestehende Home-/Server-Dienste
- Orchestrierung, soweit sinnvoll

Schwere LLM-Inferenz gehört nicht auf den Pi.

## Lokale Modellstufen auf einer RTX 5080

Die RTX 5080 besitzt 16 GB VRAM. Zusammen mit 48 GB System-RAM lassen sich Modelle nutzen, die vollständig oder teilweise auf der GPU liegen. Größere Modelle können in den RAM ausweichen; das erhöht die Latenz, bleibt für Coding aber nutzbar.

Praktische Kandidaten:

### Stufe A – schnell und lokal

`gpt-oss:20b`

- ca. 14 GB Modellgröße in Ollama
- Tool-/Agenten-fähig
- gute allgemeine Reasoning- und Coding-Leistung
- guter Kandidat für täglichen Agentenbetrieb

`devstral:24b`

- ca. 14 GB Q4-Modell
- speziell auf agentische Softwareentwicklung ausgerichtet
- geeignet für Repo-Erkundung, Dateiänderungen und Tests

Diese Modelle passen gewichtsmäßig nahe an den VRAM der RTX 5080. Große Kontextfenster benötigen zusätzlich Speicher, daher kann auch hier ein Teil in den System-RAM ausweichen.

### Stufe B – stärkere lokale Coding-Modelle

`qwen3-coder:30b`

- ca. 19 GB Modellgröße
- 30B Gesamtparameter, nur ca. 3.3B aktiv
- stark auf agentisches Coding und Repository-Aufgaben ausgerichtet
- 256K nomineller Kontext

Auf 16 GB VRAM läuft es nicht vollständig im Grafikspeicher, ist mit 48 GB RAM aber sinnvoll testbar.

Neuere Qwen-3.5-Coding-Varianten können ebenfalls ausprobiert werden. Größere 20–25-GB-Quantisierungen werden teilweise aus dem System-RAM bedient; deshalb immer mit realen Kepler-Aufgaben benchmarken statt nur Modell-Benchmarks zu vergleichen.

## Kontextgröße: nicht blind maximieren

Coding-Agenten profitieren von großem Kontext, aber Kepler hat bereits RAG und gezielte Suche. Deshalb nicht die komplette 50.000+-Zeilen-Spieldatei in jeden Prompt drücken.

Empfehlung:

1. RAG/grep findet relevante Stellen.
2. Agent lädt Definition, Aufrufstellen, Tests und angrenzenden Code.
3. Kontext nur bei Bedarf erweitern.
4. 32K–64K als praktischen Startbereich testen.

Ein riesiges nominelles Kontextfenster ist kein Ersatz für Retrieval und verbraucht viel Speicher/Prompt-Zeit.

## Qualitätsleiter

Der Agent soll Aufgaben in Stufen bearbeiten.

### 1. Lokal lösen

Standardmäßig lokales Modell auf dem Gaming-PC verwenden.

Geeignet für:

- Bugs mit klarer Reproduktion
- UI-/Textänderungen
- Tests schreiben
- kleine/mittlere Features
- Code-Suche und Refactorings mit klarer Struktur
- Patchnotes/Hilfe aktualisieren

### 2. Lokales stärkeres Modell

Wenn das schnelle Modell scheitert oder die Aufgabe architektonisch komplex ist, auf ein größeres lokales Coding-Modell wechseln.

### 3. Frontier-Cloud-Modell als Eskalation

Nur schwierige Aufgaben in die Cloud geben, z. B.:

- komplexe repoübergreifende Refactorings
- schwer reproduzierbare Logikfehler
- lange autonome Engineering-Aufgaben
- Probleme, bei denen lokale Modelle wiederholt Tests nicht grün bekommen

Der Agenten-Workflow kann derselbe bleiben; nur das Modell wird umgeschaltet.

Ollama unterstützt auch Cloud-Modelle, sodass Claude Code/OpenCode nicht neu eingerichtet werden müssen.

## Automatische Eskalation – Zielbild

Langfristig soll ein Wrapper/Orchestrator folgende Logik verwenden:

```text
Aufgabe
  ↓
RAG: relevante Dateien/Zeilen finden
  ↓
Lokales Modell auf Gaming-PC
  ↓
Gezielte Tests
  ├─ grün → Volltest/Release-Ablauf
  └─ rot
       ↓
     zweiter lokaler Reparaturversuch
       ├─ grün → weiter
       └─ rot → stärkeres lokales oder Cloud-Modell
```

Damit gibt es keinen vollständigen Entwicklungsstopp mehr, wenn ein einzelnes Cloud-Kontingent erschöpft ist.

## Qualität wird durch Tests abgesichert

Modellqualität allein ist nicht das Qualitätstor. Kepler hat eine umfangreiche Test-Suite und dokumentierte Gegenproben.

Unabhängig vom verwendeten Modell:

- bestehende Tests zuerst finden
- neue Tests mit Gegenprobe erstellen
- gezielte Tests nach dem Patch
- anschließend die passende volle Suite
- Tests nicht abschwächen, um einen KI-Patch grün zu bekommen

Ein lokales Modell mit guten Werkzeugen, sauberem Retrieval und strenger Testschleife kann in diesem Projekt zuverlässiger arbeiten als ein stärkeres Modell, dem ungezielt riesige Mengen Kontext gegeben werden.

## RAG zuerst

Der lokale AI Core ist für Fragen wie diese zuständig:

- Wo wird der Kampfbericht erzeugt?
- Welche Funktion berechnet X?
- Wo wird Ressource Y angezeigt?
- Welche Tests decken Feature Z ab?

Endpoint:

```text
POST /kepler/ask
```

AI Core läuft im lokalen Netz auf dem M715q. Nach größeren Releases muss der Index aktualisiert werden. Eine automatische Re-Ingestion nach erfolgreichen Releases ist ein sinnvolles Folgeprojekt.

## Graphify

Graphify eignet sich für echte Code-Dateien wie:

- `tests/*.js`
- Backend-JavaScript
- Social-Hub-TypeScript
- AI-Core-Python

Nicht als Standardwerkzeug für `weltraum_kolonie.html`: Die große HTML-Datei wird von Graphify als Dokument behandelt und würde unnötig durch LLM-Extraktion laufen. Für die Spieldatei RAG/grep verwenden.

## Dokumentation und Kontextkosten

`CLAUDE.md` bleibt klein und wird nicht wieder zum Sitzungsarchiv.

Dauerhafte Informationen verteilen:

- Architektur -> `docs/ARCHITECTURE.md`
- Tests/Release -> `docs/TESTING.md`
- KI/Tooling -> diese Datei
- übertragbare Projekterfahrungen -> `docs/PROJECT_MEMORY.md`
- Feature-Details -> passende Konzeptdatei

Einmalige Debug-Historie gehört in Commit-/PR-Historie, nicht automatisch in den Startkontext jedes Agenten.
