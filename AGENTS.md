# Projektanweisungen fuer Coding-Chats

Vor Arbeiten auch `CLAUDE.md` lesen und dessen Test-, Release- und Merge-Ampel-Regeln beachten.

## Freigabe fuer eigene Pull Requests

Der Projekteigentuemer hat am 15.10.2026 ausdruecklich freigegeben:
"Die Chats duerfen ihre eigenen PRs automatisch mergen, sobald alle erforderlichen Tests und Reviews bestanden sind."

- Diese Freigabe gilt in diesem Repository fuer den eigenen, in diesem Chat bearbeiteten PR nach `main`.
  Sie gilt nicht fuer fremde PRs oder pauschales Mergen aller offenen PRs.
- Vor Auto-Merge den gesamten aktuellen Diff adversarisch durchsehen, bestaetigte Befunde beheben
  und die passenden Tests durchfuehren. Das Review-Ergebnis samt geprueftem Umfang, Tests und
  verbleibenden Einschraenkungen im PR-Text dokumentieren.
- Fuer den letzten Head-Commit SHA im PR-Text zwei Zeilen eintragen:
  `Review-Ergebnis: bestanden` und `<!-- self-review: VOLLSTAENDIGE_HEAD_SHA -->`.
  Nach jeder Codeaenderung ist ein neues Review mit neuer SHA notwendig.
- Eigene PRs danach mit GitHubs Auto-Merge vormerken, z.B.
  `gh pr merge NUMMER --auto --merge --match-head-commit SHA --repo OWNER/REPO`.
  GitHub wartet auf die Pflichtpruefung `Merge readiness`, einen aktuellen Branch und erledigte
  Review-Diskussionen. Bei Tests, Review-Befunden, Konflikten oder fehlender Evidenz nicht mergen.
- Keine Admin-Umgehung, erzwungenen Merges, gefaelschten gruenen Statusmeldungen oder abgeschwaechten
  Tests verwenden. Eine ausdrueckliche spaetere Anweisung des Nutzers hat Vorrang.
- Tests und Builds standardmaessig auf `pc-saschaneu`; insgesamt bleibt ein PC-Job gleichzeitig.
  GitHub-gehostete Runner bleiben eine manuell gewaehlte Alternative.
- Vollstaendige Bedienung und manuelle Alternative: `docs/AUTO-MERGE.md`.
