# Kepler 7 – Lokale KI-Hardware

## Zielbild

Kepler 7 soll auch dann weiterentwickelt werden können, wenn ein einzelnes Cloud-Kontingent erschöpft ist.

### Gaming-PC

Hauptrechner für lokale Coding-Agenten und schwere Inferenz.

Aktueller Zielstand:

- NVIDIA GeForce RTX 5080 mit 16 GB VRAM
- 48 GB System-RAM
- leistungsstarker Desktop-Prozessor

Aufgaben:

- Ollama
- Claude Code / OpenCode / Codex gegen lokale Ollama-Modelle
- lokaler Frontend-/Backend-Checkout
- Test-Suite
- größere lokale Coding-Modelle mit GPU-/RAM-Offload

### Lenovo M715q

24/7-Wissens- und Infrastrukturknoten:

- GameGeeeeek AI Core
- Kepler-RAG
- semantische Suche
- Index-Aktualisierung
- leichte Hintergrundautomatisierung

### Raspberry Pi

Deployment-/Service-Knoten:

- nginx / Kepler-Deployment
- Social Hub
- bestehende Dienste

## Modellstrategie auf der RTX 5080

Die 16 GB VRAM sind sehr schnell, aber nicht groß genug, um jedes große Coding-Modell inklusive langem Kontext vollständig auf der GPU zu halten. Die 48 GB System-RAM ermöglichen Teil-Offload.

Empfohlene Reihenfolge für reale Kepler-Tests:

1. `gpt-oss:20b` – etwa 14 GB, Agenten-/Tool-fähig, guter Allrounder.
2. `devstral:24b` – etwa 14 GB, Coding-Agent-Spezialist.
3. `qwen3-coder:30b` – etwa 19 GB, stärkerer Repo-Coder, teilweise RAM-Offload.
4. aktuelle Qwen-3.5-Coding-Varianten – größere Modelle gezielt gegen Kepler-Aufgaben benchmarken.

Nicht anhand synthetischer Benchmarks allein entscheiden. Für Kepler zählen:

- schafft das Modell reale Projektaufgaben?
- findet es alle betroffenen Stellen?
- bleiben Tests unangetastet streng?
- wie oft benötigt es Reparaturdurchläufe?
- wie lange dauert Aufgabe bis grünem Test?

## Cloud-Fallback

Cloud wird als Eskalationsstufe verwendet, nicht mehr als einziger Entwicklungsweg.

Der gleiche Agenten-Workflow kann über Ollama zwischen lokal und Cloud wechseln. Dadurch bleiben Projektregeln, Oberfläche und Arbeitsweise gleich.

Qualitätsziel:

```text
lokal unbegrenzt
  -> Tests grün: fertig
  -> Tests wiederholt rot: stärkeres lokales Modell
  -> weiterhin schwierig: Frontier-Cloud-Modell
```

So ist ein ausgeschöpftes einzelnes Anbieter-Kontingent kein Entwicklungsstopp mehr.
