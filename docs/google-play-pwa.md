# Google Play über die PWA — geprüfter Weg, gemessene Hürden

Recherche vom 03.09.2026. Dieser Kanal kam in der Recherche vom 21.08.2026 **nicht vor**; er ist
erst aufgefallen, als die Frage „wo können wir noch veröffentlichen?" die HTML5-Portale gekippt hat
(siehe `marketing-kanaele-recherche.md`, Abschnitt „Zwei Klassen von Kanälen").

**Belegstufen wie im Schwesterdokument:** **geprüft** (an der Quelle gelesen bzw. selbst gemessen),
**teilweise** (aus zweiter Hand), **ungeprüft**.

---

## 1. Warum dieser Weg passt und die Spiele-Portale nicht

Die HTML5-Portale (CrazyGames, Poki u. a.) hosten das Spiel **selbst**. Kolonie Kepler-7 kann das
nicht: Es spricht ausschließlich mit `/api` auf dem eigenen Server, und ohne diese Verbindung gibt
es weder Anmeldung noch Spielstand noch Mehrspieler.

Eine TWA (Trusted Web Activity) dreht das um: Die App im Play Store ist eine **Hülle**, die
`www.gamegeeeeek.de` in einem vollflächigen Chrome-Fenster öffnet. Das Spiel bleibt, wo es ist.
Backend, Konto, Cookie, Mehrspieler — alles unverändert.

**Und es kostet keine zweite Codebasis.** Es gibt nichts zu portieren; die App ist ein Verweis.

---

## 2. Was schon fertig ist — gemessen am 03.09.2026

Das Spiel ist eine **vollständige PWA**. Nichts davon musste für diesen Weg gebaut werden:

| Anforderung | Stand | Messung |
|---|---|---|
| `manifest.json` erreichbar | ✅ | `200`, `application/json`, 826 B |
| `name` / `short_name` | ✅ | „Kolonie Kepler-7" / „Kepler-7" |
| `display` | ✅ | `standalone` |
| `start_url` / `scope` | ✅ | `/?pwa=1` / `/` |
| `theme_color` / `background_color` | ✅ | beide `#0a0d1a` |
| Icon 192×192 | ✅ | `icon-192.png`, live `200`, 47.729 B |
| Icon 512×512 | ✅ | `icon-512.png`, live `200`, 258.005 B |
| Maskable-Icons | ✅ | beide vorhanden, live `200` |
| Service Worker | ✅ | `service-worker.js`, live `200`, 6.154 B |
| HTTPS | ✅ | Zertifikat deckt `gamegeeeeek.de`, `www.` und `social.` |

Die Bildmaße sind **aus den PNG-Kopfdaten gelesen**, nicht aus dem Manifest abgeschrieben — sonst
hätte die Prüfung nur belegt, dass das Manifest mit sich selbst übereinstimmt.

---

## 3. Der Befund, der VOR dem ersten Schritt erledigt sein muss

Google verifiziert die Domain über eine Datei unter `/.well-known/assetlinks.json`. Sie muss als
**echte Datei** ausgeliefert werden. Zwei gemessene Hindernisse stehen davor:

### (a) Der Server hat einen Catch-All — jeder unbekannte Pfad liefert die Spieldatei

Gemessen, mit Negativkontrolle im selben Lauf:

```
200  5.964.483 B  text/html   /.well-known/assetlinks.json
200  5.964.483 B  text/html   /.well-known/acme-challenge/probe-xyz
200  5.964.483 B  text/html   /gibtesnicht          <- Negativkontrolle
200  5.964.483 B  text/html   /wp-admin
200      1.645 B  text/html   /impressum.html       <- echte Datei, korrekt
200        826 B  application/json  /manifest.json  <- echte Datei, korrekt
```

**Solange die Datei nicht wirklich existiert, bekommt Google HTML statt JSON** — und die
Verifikation scheitert, ohne dass ein 404 den Fehler sichtbar machen würde. Sobald die Datei da
ist, liefert nginx sie korrekt aus; das belegen `manifest.json` und `impressum.html` in derselben
Messung. **Der Catch-All ist also kein Hindernis, sondern eine Falle beim Diagnostizieren:** Ein
„die Datei fehlt noch" sieht hier aus wie ein Erfolg.

### (b) Der Deploy-Webhook kopiert keine Unterverzeichnisse

Der fest verdrahtete Befehl (`DEPLOY_TARGETS` in `kolonie-kepler7-backend/server.js`) kopiert
ausschließlich Dateien aus dem **Repo-Wurzelverzeichnis**:

```
cp -f *.html /deploy/web/ && (cp -f *.png …) && (cp -f robots.txt sitemap.xml …)
             && (cp -f manifest.json service-worker.js …)
```

Ein `.well-known/`-Verzeichnis im Repo ginge damit **nie live**. Das ist hier ein Vorteil und keine
Schwäche: Die Datei enthält den Fingerabdruck eines Signaturzertifikats, das es noch gar nicht
gibt — eine Vorlage mit Platzhalter im Repo könnte gar nicht versehentlich ausgeliefert werden.

**Drei Wege, und der erste ist der richtige:**

1. **Einmalig von Hand ins Web-Verzeichnis legen** (Empfehlung). Die Datei ändert sich nach dem
   Anlegen **nie wieder** — sie enthält nur Paketnamen und Zertifikats-Fingerabdruck. Ein
   Handgriff, kein Deploy-Umbau, kein Repo-Eintrag, der veralten kann.
2. Den Deploy-Befehl im Backend um das Verzeichnis erweitern — ändert eine Stelle, die dreimal
   Deploy-Ausfälle verursacht hat, für eine Datei, die sich nie ändert. **Nicht empfohlen.**
3. Ein nginx-`location`-Block, der den Pfad auf eine Wurzelverzeichnis-Datei abbildet — dieselbe
   Rechnung wie (2), plus eine zweite Wahrheit über den Dateipfad.

**Der Befehl für Weg 1** (Sascha führt ihn auf dem Pi aus, `<PAKETNAME>` und `<FINGERABDRUCK>`
stammen aus Schritt 4 unten):

```bash
sudo mkdir -p /DATA/kepler7/web/.well-known
sudo tee /DATA/kepler7/web/.well-known/assetlinks.json > /dev/null <<'EOF'
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "<PAKETNAME>",
    "sha256_cert_fingerprints": ["<FINGERABDRUCK>"]
  }
}]
EOF
sudo chown 1000:1000 /DATA/kepler7/web/.well-known/assetlinks.json
```

**Danach von außen gegenmessen** — und zwar auf den Inhaltstyp, nicht nur auf den Statuscode
(der Catch-All liefert ja auch 200):

```bash
curl -sS -o /dev/null -w '%{http_code} %{content_type} %{size_download}B\n' \
  https://www.gamegeeeeek.de/.well-known/assetlinks.json
```

Erwartet ist `200 application/json` und eine **kleine** Größe. Kommt `text/html` und rund 5,9 MB,
liegt die Datei nicht dort, wo nginx sie sucht — dann antwortet der Catch-All.

Das JSON-Format ist die offizielle Struktur aus Googles Digital-Asset-Links-Dokumentation
(**geprüft**); der Pfad ist dort wörtlich festgelegt: „This is the official name and location for
a statement list on a site; statement lists in any other location, or with any other name, are not
valid for this site."

---

## 4. Der Ablauf

**Belegstufe: geprüft** (Android-Developers-Dokumentation), aber **nicht selbst durchgeführt** —
der Build braucht ein Android-SDK und ein Play-Konto, beides liegt bei Sascha.

1. **Play-Entwicklerkonto anlegen.** Einmalig **25 USD** (**teilweise** — aus zweiter Hand; der
   Betrag steht nicht in der von hier abrufbaren Primärquelle).
2. **Bubblewrap installieren und initialisieren:**
   ```bash
   npm install -g @bubblewrap/cli
   bubblewrap init --manifest https://www.gamegeeeeek.de/manifest.json
   ```
   Bubblewrap liest das Manifest, fragt die Werte zur Bestätigung ab und legt das Android-Projekt
   an. Es fragt dabei auch nach dem **Paketnamen** (Vorschlag: `de.gamegeeeeek.kepler7` — er ist
   dauerhaft und lässt sich nach der Veröffentlichung nicht mehr ändern).
3. **Bauen:** `bubblewrap build` → erzeugt `app-release-signed.apk` bzw. das AAB für den Store.
4. **Fingerabdruck auslesen** — er entsteht erst beim Signieren. Bubblewrap zeigt ihn an; er steht
   außerdem in der Play Console unter *Release → Setup → App integrity*. **Wichtig:** Nutzt man
   Googles „Play App Signing" (Vorgabe), zählt der Fingerabdruck aus der Play Console, nicht der
   des lokalen Schlüssels. Wer den lokalen einträgt, bekommt eine App, die beim Start die
   Browser-Adressleiste zeigt statt vollflächig zu laufen.
5. **`assetlinks.json` ausliefern** (Abschnitt 3) und gegenmessen.
6. **Hochladen und veröffentlichen.**

---

## 5. Die eigentliche Hürde ist nicht das Geld

**Persönliche** Play-Konten, die nach dem **13.11.2023** angelegt wurden, müssen vor der
Veröffentlichung einen geschlossenen Test fahren: **mindestens 12 Tester, 14 Tage ununterbrochen
angemeldet.** Wörtlich aus Googles Support-Dokument (**geprüft**):

> „Google Play requires personal developer accounts created after November 13, 2023, to test their
> apps" — „run a closed test for their app with a minimum of 12 testers who have been opted in
> continuously for at least 14 days"

**Zur oft genannten Ausnahme für Organisationskonten: nicht belegt.** Mehrere Quellen aus zweiter
Hand behaupten, Firmenkonten seien ausgenommen; die Primärquelle spricht **ausschließlich** über
persönliche Konten und sagt zu Organisationskonten **gar nichts**. Wer darauf baut, baut auf eine
Auslegung — das ist vor dem Anlegen des Kontos zu klären, nicht danach.

**Was das praktisch heißt:** Zwölf Menschen, die zwei Wochen lang mit einem Play-Konto in der
Testspur eingetragen bleiben. Das ist zu schaffen, aber es ist eine Bitte an zwölf Leute und keine
Nebensache — und es ist genau der Punkt, an dem dieser Weg von „25 Dollar" auf „ein Projekt"
umschlägt.

---

## 6. Was dieser Kanal wert ist — und was er nicht ist

**Dafür:**

- Eine Store-Präsenz mit eigener Suchbarkeit. Wer im Play Store „Weltraum Aufbauspiel" sucht,
  findet keinen Browsertab.
- Installation auf dem Startbildschirm mit Icon — der PWA-Installationsdialog im Browser wird von
  den meisten übersehen, der Play Store nicht.
- Ein **eingehender Link von einer sehr starken Domain** — genau das Mittel gegen den Befund
  „die Seite ist unsichtbar" aus Abschnitt 1 der Kanal-Recherche.

**Dagegen, ehrlich:**

- **Die Registrierungspflicht bleibt.** Sie ist der Grund, warum die Portale wegfallen, und ein
  Store-Eintrag ändert daran nichts: Wer die App installiert und dann eine E-Mail-Bestätigung
  vorgesetzt bekommt, springt genauso ab wie im Browser. **Dieser Kanal bringt mehr Besucher, er
  senkt die Hürde nicht.**
- Play-Rezensionen sind öffentlich und dauerhaft. Ein früher Ein-Stern-Schwung wegen der
  Registrierung wirkt länger nach als ein schlechter Tag auf itch.io.
- Die App muss gepflegt werden (Ziel-API-Stufe, Richtlinienänderungen). Kein großer Aufwand, aber
  ein dauerhafter.

**Nicht geprüft:** ob Apples App Store einen vergleichbaren Weg zulässt. Dort gelten für reine
Web-Hüllen deutlich strengere Regeln (Richtlinie 4.2 „Minimum Functionality"), und es kostet
99 USD im Jahr statt 25 einmalig. Das wäre eine eigene Recherche.

---

## 7. Empfohlene Reihenfolge

Dieser Weg kostet mehr Zeit als jeder andere offene Punkt — und er ist **nicht** der erste Schritt:

1. Die leere itch.io-Beschreibung füllen (Minuten, größte Wirkung je Aufwand).
2. Die vier Anschreiben und die offenen Verzeichnisse (`marketing-einreichungen.md`).
3. **Dann** dieser Weg — und zuerst die Frage aus Abschnitt 5 klären, nicht das Konto anlegen.
