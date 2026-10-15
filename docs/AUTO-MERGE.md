# Pflichtpruefungen und Auto-Merge

`main` verlangt `Merge readiness` aus der GitHub-Actions-App, einen aktuellen Branch und
aufgeloeste Review-Diskussionen. Die Regeln gelten auch fuer Administratoren. Force-Push und
Branch-Loeschung sind gesperrt. Auto-Merge muss fuer den jeweiligen eigenen PR vorgemerkt werden;
es werden keine fremden oder schon vorhandenen PRs automatisch zur Freigabe hinzugefuegt.

## Was die Pflichtpruefung bewertet

Die kurze Metadaten-Pruefung liest die Workflows des Zielstands und des getesteten Merge-Stands
sowie alle geaenderten Dateien, einschliesslich alter Namen bei Umbenennungen. Sie verlangt alle
auf diesen PR anwendbaren CI-Workflows. Zusaetzliche tatsaechlich gestartete PR-Workflows zaehlen
ebenfalls. Der letzte Lauf je Workflow fuer genau diesen Head-Commit entscheidet; ein alter
gruener Lauf ersetzt keinen neueren roten oder abgebrochenen Lauf. Fehlende/wartende CI bleibt
pending, Fehler bleiben rot. Ein komplett uebersprungener erforderlicher Workflow zaehlt nicht
als ausgefuehrter Test. Die vorhandene Beschraenkung von Keplers Vollsuite auf drei Spezialbranches
bleibt erhalten; normale PRs muessen ihre jeweils anwendbaren Review-Suiten bestehen.

Der Chat dokumentiert seine adversarische Durchsicht im PR-Text und fuegt danach ein:

```text
Review-Ergebnis: bestanden
<!-- self-review: VOLLSTAENDIGE_HEAD_SHA -->
```

Die SHA muss dem aktuellen PR-Head entsprechen. Neue Codeaenderungen entwerten das Review.
Zusatzlich duerfen keine offenen Review-Threads oder weiterhin angeforderten Aenderungen bestehen.
Das ist ein dokumentiertes Chat-Selbstreview, keine unabhaengige menschliche GitHub-Freigabe.
Ein zweiter GitHub-Account ist deshalb nicht vorgeschrieben (Anzahl Pflichtfreigaben: 0).

Die Metadaten-Pruefung fuehrt selbst keinen PR-Code aus. Sie wartet nicht blockierend auf Tests,
sondern aktualisiert den Status nach CI-Ereignissen, Aenderungen am PR-Text oder Reviews. Dadurch
belegt kein wartender Guard den einzigen PC-Job. Reine Dokumentationsaenderungen ohne passende
Spiel-/Dashboard-Workflows brauchen das aktuelle dokumentierte Review und den geprueften Guard.

## PC aus: manuelle GitHub-Alternative

1. Die fuer den PR erforderlichen bestehenden Test-Workflows per `workflow_dispatch` auf dem
   **PR-Branch** starten, `runner=github` waehlen (Grafiktests dort mit Software).
2. Nach den Tests **Merge readiness** manuell auf `main` starten, ebenfalls `runner=github`,
   mit der PR-Nummer. Genau auf dem aktuellen PR-Head gelaufene manuelle Tests werden anerkannt.
3. Nach dem Aufloesen von Review-Threads bei Bedarf die Merge-Pruefung erneut manuell starten.

Ein erfolgreicher Test auf `main` oder einem alten Commit gilt nicht fuer den PR. Bei einem neuen
Head erneut testen und reviewen. Ist der Branch hinter `main`, zuerst ohne Umgehung aktualisieren.
Die PC-Ausfuehrung bleibt fuer beide Projekte gemeinsam auf einen Job begrenzt.

## Aenderungen an CI

Neue PR-Workflows werden aus ihren Triggern erkannt. Ihre Namen auch bei `workflow_run.workflows`
in `.github/workflows/merge-readiness.yml` ergaenzen, damit ihre Fertigstellung den Status neu
berechnet. Unbekannte Pfad-Globs oder unvollstaendige/API-fehlerhafte Evidenz sperren den Merge.
Eine absichtliche Entfernung einer bisherigen Pflicht-CI braucht eine gesonderte Nutzerentscheidung;
die Pruefung beruecksichtigt auch die bisherigen Workflows des Zielbranches.

Lokale Gegenproben des Guards:

```bash
python3 -m unittest discover -s .github/merge -p 'test_*.py' -v
```
