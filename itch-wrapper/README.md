# itch.io-Wrapper

Eine einzelne `index.html`, die als HTML5-Spiel auf itch.io hochgeladen wird und dort als
Visitenkarte mit Startknopf erscheint.

## Warum kein echtes iframe auf das Spiel

Der naheliegende Wrapper wäre ein iframe auf `gamegeeeeek.de`. Technisch ginge das – an der
Produktion gemessen liefert die Seite weder `X-Frame-Options` noch `frame-ancestors`, das Einbetten
ist also nicht gesperrt. Es wäre trotzdem falsch, und zwar aus zwei **gemessenen** Gründen:

1. **Das Sitzungs-Cookie ist `SameSite=Lax`.** Gemessen an `POST /api/logout`:
   `kepler7_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`. In einem Fremd-iframe schickt
   der Browser so ein Cookie nicht mit – niemand könnte sich anmelden, und damit wären Allianzen,
   Markt, Bestenliste und PvP tot.
2. **itch.io liefert Spiele über `hwcdn.net` aus**, also als Drittanbieter-Kontext. Wer
   Drittanbieter-Cookies blockiert – in Chrome zunehmend die Voreinstellung –, bekommt dort auch
   kein `localStorage`. Dann speichert nicht einmal der Solo-Modus.

Ein eingebettetes Spiel, das weder anmelden noch speichern kann, wirkt kaputt. Ein Eintrag, der
diesen Eindruck hinterlässt, ist schlechter als gar keiner.

## Was diese Seite stattdessen tut

Sie sagt offen, was sie ist, und führt mit einem Knopf ins eigene Fenster. Kein Ladebalken, der nie
fällt, keine Anmeldemaske, die nicht funktioniert.

**Der Knopf ist ein nackter Link** (`<a target="_blank" rel="noopener">`) — kein JavaScript
dazwischen. Das ist eine Korrektur vom 21.08.2026 und der Grund gehört hierher, weil er sich sonst
wiederholt:

Der erste Entwurf fing den Klick ab und rief `window.open(ziel, '_blank', 'noopener')`, um am
Rückgabewert zu erkennen, ob der Tab aufging. Gemessen in Chromium:

```
window.open(u, '_blank', 'noopener')  ->  null           (auch bei ERFOLG)
window.open(u, '_blank')              ->  Fensterobjekt
```

Das ist kein Browserfehler, sondern die Spezifikation: Mit `noopener` wird die Opener-Beziehung
gekappt, es gibt also nichts zurückzugeben. **Die Erfolgsverzweigung war damit toter Code, und die
Warnung „Dieses Fenster darf keine neuen Tabs öffnen" erschien bei JEDEM Klick** — auch wenn der
Tab einwandfrei aufging. Genau die Sorte Anzeigefläche, die dieses Projekt sonst überall bekämpft.
Nebenwirkung: Weil `preventDefault()` dadurch nie lief, feuerten JS-Aufruf und nativer Link
nebeneinander.

**Der Auffangweg braucht keine Erkennung.** Die Adresse steht dauerhaft sichtbar unter dem Knopf,
trägt `user-select:all` und ist mit einem Klick markiert. Ein Satz, der immer stimmt („Falls der
Knopf nicht reagiert, Adresse aufrufen"), ist besser als eine Erkennung, die sich irren kann — und
der nackte Link ist ohnehin der zuverlässigere Weg: Pop-up-Blocker sperren script-initiiertes
`window.open`, nicht die vom Nutzer geklickte Verknüpfung.

Wächter: `tests/test_itch_startkarte.js` (13 Prüfungen). Er misst die REGEL, nicht das Öffnen eines
Tabs — gemessen mit einer Gegenkontrolle öffnet in dieser Container-Umgebung **kein** Fall einen
Tab, nicht einmal ein nackter Link ohne jedes JavaScript. Eine Prüfung darauf würde das
Messwerkzeug messen statt die Seite.

## Hochladen

1. **NUR `index.html`** als ZIP packen — nicht den Ordner, und nicht die übrigen Dateien darin.
   Der Ordner enthält inzwischen vier Dateien, von denen drei **nicht** hochgeladen werden dürfen:
   `README.md` (diese Datei), `cover.html` (die Coverbild-Vorlage) und `cover-bauen.js`. Ein
   `zip -r` über den Ordner lädt sie mit hoch, und `cover.html` wäre auf itch.io dann als
   `/cover.html` öffentlich abrufbar — eine zweite Seite, die niemand erwartet.

   ```
   cd itch-wrapper && zip -X ../kolonie-kepler-7-itch.zip index.html
   ```

   Prüfen, dass wirklich nur eine Datei drin ist: `unzip -l kolonie-kepler-7-itch.zip`
   → genau eine Zeile, `index.html`, kein Unterordner.
2. Auf itch.io ein neues Projekt anlegen, **Kind of project: HTML**.
3. ZIP hochladen und **„This file will be played in the browser"** ankreuzen.
4. Viewport: **960 × 600**. „Mobile friendly" an, „Fullscreen button" aus (die Seite braucht ihn
   nicht).
5. Beschreibung, Tags und alle übrigen Feldwerte stehen fertig in
   `docs/marketing-einreichungen.md`, Abschnitt „itch.io" — am Original geprüft, mit Begründung
   für die drei Felder, bei denen der naheliegende Wert der falsche wäre.
6. **Coverbild** (itch.io verlangt das Seitenverhältnis 315:250, empfohlen 630×500):
   `node itch-wrapper/cover-bauen.js` erzeugt `presse-bilder/itch-cover.png`. Die Vorlage ist
   `cover.html` — wer sie ändert, sieht sich das Ergebnis in **Thumbnail-Größe** an, nicht nur
   gross: Das Bild erscheint in Suche und Stöbern als kleine Kachel, und genau darauf ist es
   ausgelegt.
7. Screenshots: 3–5 Stück aus `presse-bilder/` (`node marketing-screenshots.js`).

## Der Vorbehalt, den man kennen muss

itch.io-Admin **leafo** zu Seiten, die im Wesentlichen ein externer Link sind:

> „No one will stop you from creating a page like that, but it may not match our community
> guidelines so you may not get indexed in our search and browse pages."

Diese Seite ist ein echter HTML5-Upload und sollte deshalb indexiert werden – **sicher ist das
nicht.** Sie ist funktional nah an dem, was leafo beschreibt, und bei einer manuellen Prüfung
könnte itch.io das anders sehen.

**Das Risiko ist allerdings asymmetrisch:** Schlimmstenfalls wird die Seite nicht indexiert – also
genau der Zustand, der bei einem reinen externen Link ohnehin eingetreten wäre. Bestenfalls
erscheint sie in Suche und Stöbern. Ein Versuch kostet nichts ausser der Zeit für den Upload.

## Prüfen nach dem Hochladen

Die Seite im echten itch.io-Rahmen öffnen und den Knopf drücken.

- **Öffnet sich ein Tab mit dem Spiel**, ist alles in Ordnung.
- **Passiert nichts**, erlaubt itch.io in seinem Rahmen keine neuen Tabs. Das ist kein Fehler der
  Seite: Die Adresse steht darunter und lässt sich mit einem Klick markieren. Falls das öfter
  vorkommt, wäre der nächste Schritt, sie zusätzlich als sichtbaren Text-Link zu führen — dann
  aber gemessen, nicht vermutet.

Der Knopf zeigt **keine** Warnung mehr an. Erscheint dort eine, ist der alte `window.open`-Abfang
zurück; `tests/test_itch_startkarte.js` schlägt dann an (Prüfungen `1a`, `2b`, `2c`).
