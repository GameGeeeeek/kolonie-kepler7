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

**Der Knopf ist gegen den Fall abgesichert, dass itch.io keine neuen Tabs erlaubt.** Gemessen in
einem sandboxed iframe ohne `allow-popups`: `window.open` wird stillschweigend blockiert, der
Spieler klickt und nichts passiert. Die Seite fängt das ab, benennt den Grund und bietet die
Adresse gross und markierbar an.

## Hochladen

1. `index.html` als ZIP packen (nur diese eine Datei, keinen Ordner drumherum).
2. Auf itch.io ein neues Projekt anlegen, **Kind of project: HTML**.
3. ZIP hochladen und **„This file will be played in the browser"** ankreuzen.
4. Viewport: **960 × 600**. „Mobile friendly" an, „Fullscreen button" aus (die Seite braucht ihn
   nicht).
5. Beschreibung, Tags und Screenshots aus `docs/marketing-einreichungen.md` bzw.
   `presse-bilder/` (erzeugbar mit `node marketing-screenshots.js`).

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

Die Seite im echten itch.io-Rahmen öffnen und den Knopf drücken. Zwei Ausgänge sind richtig:

- Ein neuer Tab öffnet sich mit dem Spiel, **oder**
- der Hinweistext wechselt auf „Dieses Fenster darf keine neuen Tabs öffnen …" und die Adresse
  steht darunter.

Passiert **nichts** von beidem, ist etwas kaputt.
