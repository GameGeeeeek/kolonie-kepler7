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

## Key-Art-Poster

`poster.js` erzeugt gezeichnete Poster im Kepler-7-Stil (Illustration, Wortmarke,
Zeile, Domain-Pille), `poster_render.js` rastert sie auf 1080x1920:

```bash
node nest_render.js            # nur fuer die Nest-Motive, siehe unten
node poster.js ./pos && node poster_render.js ./pos
```

Die Wortmarke ist **aus Pfaden gebaut, nicht gesetzt**: Der Container hat keine
geometrische Techno-Schrift, und über alle Poster hinweg muss sie identisch aussehen.

Ein gezeichnetes Vorher/Nachher (`umbau`) schlägt bei Grafik-Updates den rohen
Screenshot-Vergleich - Sascha, 07.09.2026: der Screenshot-Vergleich passt nicht zur
Bildsprache der übrigen Posts.

### Die Nest-Motive zeigen echte Spielgrafik

`nest_render.js` schneidet den Zeichencode der Brutkörper **aus
`weltraum_kolonie.html` heraus** und lässt ihn in Chromium laufen; die PNGs landen in
`content-werkzeug/nester/` und werden von `poster.js` als Bild eingebettet. Nichts daran
ist nachgemalt - ein selbst gezeichnetes Nest würde dem Publikum etwas über das Spiel
versprechen, was das Spiel nicht einlöst.

Der Schnitt hängt an **Textankern, nicht an Zeilennummern** (die Spieldatei wächst
täglich): jeder Anker muss genau einmal vorkommen, der Schnitt wird vor dem Lauf per
`new Function()` auf Syntax geprüft, und ein Bild unter 20 kB gilt als Fehlschlag. Zieht
jemand die Nest-Funktionen um, bricht der Lauf mit Namen des fehlenden Ankers ab statt
still ein leeres Poster zu liefern.

Die Ordner `nester/` und die gerenderten Poster liegen **nicht** im Repo - sie sind
jederzeit reproduzierbar und würden es nur schwer machen.

Die linke Hälfte (`VORHER`) ist ebenfalls kein Freihand-Entwurf, sondern die
nachgerechnete Geometrie des alten Kartenmarkers aus dem Stand vor `077e9f0`
(Radius `r*(0.55+0.12*Math.sin(g))` mit `g` in **Grad**, Punkte `r*0.30`).

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
