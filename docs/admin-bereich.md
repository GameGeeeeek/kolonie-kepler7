# Admin-Bereich – Konto, Aktivitäts-Uhr, Geschenk (Stand 01.09.2026)

Der Admin-Bereich ist ein Einschub-Fenster (`adminPanelOverlay`) mit einer datengetriebenen
Reiterleiste (`ADMIN_REITER`): Knopf, Fläche, Untertitel und Ladefunktion je Reiter stehen in
EINER Tabelle, die Verdrahtung iteriert darüber. Ein neuer Reiter ist ein Eintrag dort plus Markup;
`tests/test_adminbereich.js` liest die Reiter seither aus den `adminTab*Btn`-Knöpfen der Seite,
nicht aus einer Namensliste.

Die Server-Hälfte jeder Fläche samt Begründungen steht in der CLAUDE.md des Backend-Repos
(Abschnitte „Vier neue Admin-Fähigkeiten", „Aktivitäts-Uhr und Reaktionszeit", „Vier Erweiterungen
der Uhr"). Hier steht nur, was das Frontend entscheidet.

## Konto-Reiter

**Übersicht nach Auffälligkeit** (`loadAdminAktivitaet`, lädt beim Öffnen des Reiters, steht UNTER
der Suche, damit das gesuchte Blatt oben bleibt): alle Konten mit Spielstand in der Sortierung des
Servers (kürzeste Pause zuerst, belastbare vor unbelastbaren), je Zeile ein Miniraster
(`aktivMiniRasterHtml`, 14 × 24 Kästchen von 3 px, dieselben drei Farben wie die große Uhr) und ein
farbiger Punkt (orange auffällig, grün belastbar, grau unbelastbar). Tippen füllt die Suche und holt
das Blatt. Ein Server ohne die Route bekommt `adminListenFehler` – die Suche daneben läuft weiter.

Der Punkt ist ein `<span>` mit Hintergrund, kein `border-left`: Inline-`border-*:Npx` reißt
`test_formensprache`.

**Konto-Blatt** (`loadAdminKonto`): zeigt, was der Server je Konto führt – nie `passwordHash`, die
E-Mail nur in ihrer Form. Die Aktivitäts-Uhr (`aktivUhrHtml`, 14 Zeilen × 24 Stunden UTC, Einordnung
über `aktivUhrEinordnung` mit den zwei harmlosen Erklärungen geteiltes Konto / Zeitzonen) und die
Reaktionszeiten (`reaktionenHtml`, ganze Reihe statt Mittelwert) kommen seit v8.622.0 dazu. Seit
01.09.2026: Rate-Limit-Treffer (`rateLimitZeileHtml`), abgelehnte Spielstände
(`spielstandAbgelehntHtml`, nennt die letzten Gründe und sagt, dass ein abgelehnter Stand NICHT
gespeichert wird) und die Verdachtsmeldung. **Alle drei fehlen ERSATZLOS, wenn der Server die
Felder nicht schickt** – kein „0", das etwas behauptet, was niemand gemessen hat. Bei Nullwerten
steht „keine" bzw. „0 heute".

Zahlen im Admin-Bereich laufen über `adminZahl()` (exakt, de-DE), nie über `fmt()`: 1.234
Sternenstaub ist ein Messwert, keine Spielanzeige.

## Geschenk-Reiter

`loadAdminGeschenke` holt Gaben-Felder, Deckel, Empfängerzahl und Verlauf vom Server (dieselbe
Tabelle wie bei den Bonuscodes – keine zweite Kopie hier). `adminGeschenkSenden` fragt vor dem
Versand mit Betrag und Empfängerkreis nach; was der Bediener nicht zurücknehmen kann, wird vorher
benannt. Der Empfängerfilter (`nurAktiveTage`) grenzt auf binnen N Tagen angemeldete Konten ein.

Im Belohnungsfach bucht `belohnungGabenBuchen(r)` die Gaben – EINE Stelle für Bonuscode und
Geschenk. Der `geschenk`-Zweig in `claimPendingRewards` ist Pflicht: Ein unbekannter Typ fällt in
den Rückfall „+500 Kredite für deinen Bug-Report". Er speichert sofort (der Server hat den Eintrag
beim Abholen bereits entfernt) und schreibt einen Bericht mit eigenem Zeichner-Zweig ohne
Gewonnen/Verloren-Pille (`REPORT_SPECIAL_GREEN_TYPES`).

## Betreiber-Push-Kategorien

`neuspieler` (22.08.2026) und `verdacht` (01.09.2026) sind nur für das Betreiberkonto sichtbar –
ein Schalter, den jeder sieht, aber nur einer je auslöst, wäre eine tote Fläche. Die Prüfung ist
keine Sicherheitsgrenze; der Server schlägt die Kategorie ohnehin nur am Betreiberkonto nach. Jede
Kategorie braucht fünf Stellen (`notifPrefsCache`, `data-notif-cat`, `NOTIF_EVENT_INFO`, im
Backend `getNotifPrefs` und `POST /notification-prefs`); `test_pushkategorien` hält sie zusammen.
Ohne `NOTIF_EVENT_INFO`-Eintrag zeichnet das Postfach das Wort „Ereignis".

## Wächter

- `tests/test_adminbereich.js` – Reiter bedienbar (per `elementFromPoint`), Feedback, Schalter,
  Konto-Blatt, Systemstand.
- `tests/test_aktivitaetsuhr_ui.js` – die Uhr misst die WIRKUNG (drei Konten, drei Aussagen, Farben
  der Kästchen), Block fehlt ersatzlos ohne Felder.
- `tests/test_admin_erweiterungen_ui.js` – Übersicht (Markierung und Miniraster als PAAR),
  Blatt-Zeilen (da UND ersatzlos weg), Geschenk (Bestätigen schickt UND Abbrechen nicht),
  Belohnungsfach (bucht, speichert, kein Rückfall), Push-Schalter (Betreiber sieht, Fremder nicht).
- `tests/test_neuspieler_meldung.js`, `tests/test_pushkategorien.js`, `tests/test_bonuscodes.js`.

Alle Gegenproben laufen per `KEPLER_SPIELDATEI` gegen den Stand vor der jeweiligen Etappe; die
Prüflisten werden per `diff` über die reinen Prüfnamen verglichen, nicht gezählt.

## Vier weitere Fähigkeiten: Sperre mit Frist, Spielstand-Rücksicherung, Protokoll, Allianzen (02.09.2026)

Auftrag Sascha: „Ideen für noch mehr admin Funktionen jeglicher Art?" – alle vier Vorschläge gewählt.
Server-Hälfte samt Begründungen: Backend `docs/admin.md` (kolonie-kepler7-backend#196).

**Konto-Blatt, Moderation.** Sperre und Stummschaltung teilen sich ein Grund-Feld; die Sperre hat
eine Dauer-Auswahl (unbefristet, 1/3/7/30 Tage), die Stummschaltung eine Stunden-Auswahl. Beide
Zeilen (`Sperre`, `Stummgeschaltet`) fehlen **ersatzlos**, wenn der Server die Felder nicht schickt.
Der Meldungen-Reiter gibt beim Sperren den Grund der Meldung als „Meldung: …" mit – der Gesperrte
liest ihn beim Anmelden. `adminToggleBan(name, gesperrt, { grund, tage })` ist die eine Stelle für
beide Reiter.

**Spielstand-Blatt.** „Spielstand ansehen" lädt eine Zusammenfassung (nie den rohen Stand), den
Schatten einer früheren Rücksicherung mit „wieder einsetzen", und die Backup-Auswahl. „Aus Backup
ansehen" zeigt den Stand aus der gewählten Sicherung **neben** dem heutigen, erst dann gibt es
„Diesen Stand zurückholen" – mit einer Rückfrage, die die zwei Folgen nennt: Der Spieler wird auf
allen Geräten abgemeldet (sonst schriebe sein laufendes Spiel den alten Stand per 409-Wiederholung
zurück), der jetzige Stand wird zum Schatten. Im Systemstand hängt eine Backups-Kachel mit „Backup
jetzt anlegen"; ohne die Route fehlt sie ersatzlos (`adminBackupsKachel`).

**Protokoll- und Allianz-Reiter** (elfter und zwölfter Reiter). Das Protokoll zeigt Zeit, Art, Ziel,
Wer und die gekürzten Angaben je Handlung; `targetUsername`/`tag` erscheinen als Ziel, nicht ein
zweites Mal in den Angaben. Die Allianz-Karte zeigt Mitglieder (Anführer zuerst, mit letzter Sitzung
und „Konto fehlt"), Limit, Basisstufe, Bewerbungen; „Zum Anführer machen" nimmt das gewählte
Mitglied, „Auflösen" fragt nach. Eine aufgelöste Allianz hat keine Knöpfe.

**Die Spielerseite.** Chat-Senden läuft mit Server über `storageSetStrict` – `storageSet()` fiel
bei einem 403 still auf den lokalen Speicher zurück, ein Stummgeschalteter hätte seine Nachricht
bei sich gesehen und sonst nirgends, ohne je den Grund zu erfahren. Ohne Server bleibt der
bisherige Weg. Direktnachrichten zeigen den Fehlertext des Servers; der Anmeldetext eines
Gesperrten kommt unverändert vom Server (Grund und Frist).

**Wächter** `tests/test_admin_verwaltung_ui.js` (35 Prüfungen) mit Paaren: Zeilen da UND ersatzlos
weg, Bestätigen sperrt UND Abbrechen nicht, Kachel mit Route UND ohne sie weg, Auflösen nach
Bestätigung UND nicht nach Abbruch, Stummgeschalteter liest den Grund UND ein freier Spieler
sieht nichts. Der erste Entwurf von 7c ließ `/api/me` auch ohne Token angemeldet antworten – die
Landeseite mit dem Anmeldeformular erschien nie, und die Prüfung maß über leerem Text.

## Feedback beantworten, Wartungsbanner, Support-Werkzeuge, Lage (02.09.2026)

Vierte Runde (Auftrag „Weitere Ideen für Admin Funktionen vorschlagen", alle vier gewählt). Backend
#201 zuerst live (`/api/health` blob geprüft), dann dieser Stand.

**Feedback beantworten.** Jeder Eintrag im Feedback-Reiter hat ein Antwortfeld (500 Zeichen) und
„Antworten" (`[data-fb-antwort-text]`/`[data-fb-antwort]`); eine vorhandene Antwort steht mit Zeit
am Eintrag („Deine Antwort (…)"). Ein leeres Feld schickt nichts und sagt es. Der Einsender findet
die Antwort in seinem Postfach als Meldung `feedback-antwort` (`NOTIF_EVENT_INFO`) mit dem Auszug
seines eigenen Textes – die Push dazu bekommt nur, wer Nachrichten-Push erlaubt hat.

**Wartungsbanner.** `#wartungBanner` liegt direkt hinter `<body>`, für alle Spieler. Beim Start
(2,5 s) und jede Minute holt `ladeAnkuendigung()` `GET /api/ankuendigung`; die Serverzeit `jetzt`
aus der Antwort wird als `wartungZeitversatz` gemerkt, damit der Countdown nicht an der Uhr des
Geräts hängt. `zeichneWartungBanner()` (alle 30 s) schreibt „Wartung in N Min. (ca. D Min.): Text"
bzw. „Wartung läuft (noch ca. N Min.): Text" und blendet nach `ab + dauer` von selbst aus. Die
Ankündigungs-Karte im Schalter-Reiter (`adminAnkuendigungText/Ab/Dauer`) setzt und hebt auf; beides
ruft danach sofort `ladeAnkuendigung()`, der Admin sieht also das Banner, ohne die Minute abzuwarten.
Der neue Notaus „angriffe" erscheint in der Schalterliste wie die anderen (nur AB-schaltbar); das
Backend antwortet mit 503 und Grund. Der PvP-Pfad zeigt `data.error` des Servers ohnehin; die drei
PvE-Pfade (Festung, Nest, Konvoi) werfen den Antworttext bei `!res.ok` weg und nennen den Grund nach
Status – dort steht jetzt ein 503-Zweig „Angriffe sind gerade pausiert (Wartung)" (Wächter 0d).

**Support-Werkzeuge im Konto-Blatt.** Drei Zeilen unter der Sperre: E-Mail setzen
(`[data-konto-email]`, gilt als bestätigt, die Meldung nennt die verkürzte Form), Umbenennen
(`[data-konto-neuername]`, Rückfrage nennt Abmeldung und alle Namensstellen; danach springt die
Suche auf den neuen Namen) und „Passwort-Reset-Link erzeugen" (`[data-konto-resetlink]`, Rückfrage;
der Link landet NUR im schreibgeschützten Feld daneben, vorselektiert – die Meldung nennt die Frist,
nie den Link, damit der Token nicht im Protokoll steht).

**Lage (dreizehnter Reiter).** Vier Karten aus `GET /api/admin/lage`: Wirtschaft (Konten mit
Spielstand und Aktive in 7 Tagen, Kredite gesamt mit Median und Top-Liste, Kampfpunkte, Ressourcen
in Umlauf), Markt (Preis je Rohstoff mit Basis und Abweichung in Prozent; über 40 % orange;
Ereignis), PvE-Ziele (Weltboss, Nester, Festungen, Wrackkonvois, Vorposten mit Besitzer) und
Betrieb (gesetzte Notaus-Schalter, Ankündigung). Ohne die Route steht die 404-Meldung
(`adminListenFehler`), keine Karte. Icon der Wirtschafts-Karte ist `ti-award`: `ti-coin` liegt
nicht im 69er-Whitelist-Font, `check-icons.js` fiel an dieser einen Stelle.

**Wächter** `tests/test_admin_support_ui.js` (42 Prüfungen) mit Paaren: Antwort da UND ersatzlos
weg, Antworten schickt UND leer schickt nichts, Banner zählt herunter UND ist ohne Ankündigung
unsichtbar und leer, Setzen zeigt das Banner sofort UND Aufheben nimmt es sofort weg, Umbenennen
und Reset-Link nach Bestätigung UND nicht nach Abbruch, vier Lage-Karten UND ohne Route nur die
404-Meldung. Gegenprobe gegen origin/main (v8.629.0): 36 von 42 fallen, Prüflisten identisch.
