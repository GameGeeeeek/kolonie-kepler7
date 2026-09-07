# content-werkzeug – Aufnahmen fürs Social-Media-Material

Nimmt das **laufende Spiel** auf, statt Werbebilder danebenzumalen: lokaler Server,
lokales Backend, ein Demo-Konto mit weit entwickeltem Spielstand, dann Screenshots
im Hochformat 1080×1920.

Warum im Repo und nicht im Sitzungs-Scratchpad: Genau dieses Werkzeug lag zweimal
unter `/tmp` und war nach einem Container-Neustart weg – dieselbe Lehre wie bei den
Tests (siehe `CLAUDE.md`, „Eine Spieldatei, keine Kopie" und `tests/README.md`).

## Voraussetzungen

- Nachbar-Klon `kolonie-kepler7-backend` mit `npm install` (liefert `bcryptjs`)
- Playwright (global oder `npm i playwright`), Chromium vorhanden

## Ablauf

```bash
cd content-werkzeug
node mkdb.js "$PWD/db.json"                       # Demo-Konto anlegen

DB_FILE="$PWD/db.json" SECRET_FILE="$PWD/jwt.txt" \
  VAPID_PUBLIC_FILE="$PWD/vp.txt" VAPID_PRIVATE_FILE="$PWD/vs.txt" \
  node ../../kolonie-kepler7-backend/server.js &  # Backend auf 3001

node serve.js &                                   # Spiel + /api-Weiterleitung auf 8900
node seed.js ../weltraum_kolonie.html             # entwickelten Spielstand schreiben
node aufnahmen.js ./bilder                        # Screenshots
```

`serve.js` liefert die Spieldatei aus `WEB` (Vorgabe: Repo-Wurzel) und leitet `/api`
ans Backend weiter. Zusätzliche Umgebungsvariablen: `ROOT`, `WEB`, `WEB_ALT`,
`PLAYWRIGHT`, `BCRYPT`.

## Vorher/Nachher

Für Grafik-Updates. Der alte Stand kommt aus der Git-Historie, beide laufen gegen
dasselbe Backend – gleicher Origin, deshalb gilt eine Anmeldung für beide:

```bash
mkdir -p /tmp/alt && git show <commit>^:weltraum_kolonie.html > /tmp/alt/weltraum_kolonie.html
WEB_ALT=/tmp/alt node serve.js &                  # alter Stand unter /alt/
node vergleich.js ./vgl                           # beide Stände, gleicher Ausschnitt
node split.js ./vgl ./vgl/00_vergleich.png        # Gegenüberstellung als ein Bild
```

## Zwei Fallstricke, die Bilder unbrauchbar gemacht haben

1. **`offsetParent` taugt nicht als Sichtbarkeitsprüfung.** `#loginOverlay` ist
   `position:fixed`, dort ist `offsetParent` immer `null` – die Startseite galt damit
   als abwesend, und zwei „Vorher/Nachher"-Aufnahmen zeigten beide die Landingpage.
   Geprüft wird deshalb am sichtbaren Text (`document.body.innerText`) und mit
   `getComputedStyle(el).display`, unmittelbar **vor** dem Auslösen.
2. **Feste Scroll-Werte treffen je nach Spielstand etwas anderes.** Die Position der
   Liste wird gemessen (`getBoundingClientRect().top + scrollY`), nicht geraten.

Weiter: Das Backend begrenzt Anmeldeversuche pro IP – ein Login je Lauf, sonst
misst man irgendwann den Anmeldebildschirm statt des Spiels.
