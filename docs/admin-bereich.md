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
seines eigenen Textes – die Push dazu bekommt nur, wer Nachrichten-Push erlaubt hat. Diesen
Postfach-Eintrag hat eine parallele Sitzung mit v8.634.0 selbst gebaut; beim Merge blieb ihre
Fassung stehen (sie deckelt Auszug und Text), meine wurde verworfen.

**Wartungsbanner.** `#wartungBanner` liegt direkt hinter `<body>`, für alle Spieler. Beim Start
(2,5 s) und jede Minute holt `ladeAnkuendigung()` `GET /api/ankuendigung`; die Serverzeit `jetzt`
aus der Antwort wird als `wartungZeitversatz` gemerkt, damit der Countdown nicht an der Uhr des
Geräts hängt. `zeichneWartungBanner()` (alle 30 s) schreibt „Wartung in N Min. (ca. D Min.): Text"
bzw. „Wartung läuft (noch ca. N Min.): Text" und blendet nach `ab + dauer` von selbst aus. Die
Ankündigungs-Karte im Schalter-Reiter (`adminAnkuendigungText/Ab/Dauer`) setzt und hebt auf; beides
ruft danach sofort `ladeAnkuendigung()`, der Admin sieht also das Banner, ohne die Minute abzuwarten.
Der neue Notaus „angriffe" erscheint in der Schalterliste wie die anderen (nur AB-schaltbar); das
Backend antwortet mit 503 und Grund. Der PvP-Pfad zeigt `data.error` des Servers ohnehin; Festung,
Nest und Konvoi (#530) sowie der Vorposten (#533) lesen ihn als `serverFehler` und nennen ihn in
Bericht und Meldung. Der Wortlaut der Pause kommt damit überall vom Server, nicht aus dem
Statuscode – Wächter 0d misst genau das (vier Pfade, acht Anzeigestellen). Der eigene 503-Zweig aus
dem ersten Entwurf ist damit entfallen; er wäre eine zweite Fassung derselben Aussage gewesen. 0d ist
deshalb die einzige Prüfung dieses Wächters, die am alten Stand grün bleibt: Sie misst eine fremde
Anzeigestelle, an der der Notaus hängt, und hat als Gegenprobe eine Sabotage statt des alten Standes.

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

## Kampfverlauf, Anmelde-Forensik, E-Mail, Löschung mit Frist (02.09.2026)

Fünfte Runde (Auftrag „Weitere Ideen für Admin Funktionen", alle vier gewählt). Backend #203 zuerst
live (`/api/health` blob geprüft), dann dieser Stand.

**Kampfverlauf im Konto-Blatt.** „Kampfverlauf ansehen (N)" lädt `GET /admin/konto/verlauf` in eine
Box unter der Karte: je Zeile Zeitpunkt, Rolle („griff an" / „verteidigte gegen"), Gegner, Standort
falls nicht die Heimat, Ausgang in Grün oder Orange und beide Kräfte. Darüber die drei Kennzahlen
des Servers — eigene Angriffe, häufigstes Ziel, Angriffe in der letzten Stunde (ab fünf orange).
Ohne die Route steht die 404-Meldung, kein Kampf. Der Verlauf beginnt mit dem ersten Angriff nach
dem 02.09.2026; die leere Box sagt das, statt „keine Kämpfe" zu behaupten.

**Anmelde-Forensik** steht als Zeile im Blatt, neben Sperre und Stummschaltung: laufende
Fehlversuche seit der letzten Anmeldung (ab fünf orange, darunter gelb) mit Zeitpunkt, die letzte
Anmeldung, die Gesamtzahl, die Fehlversuche vor der letzten gelungenen Anmeldung und ob eine Sitzung
offen ist. Gab es keine Fehlversuche, fehlt die Angabe ersatzlos — eine „0 Fehlversuche" wäre eine
Zeile, die nie etwas mitteilt.

**E-Mail.** Im Konto-Blatt Betreff und Text mit Rückfrage; die Meldung nennt die verkürzte Adresse
(`a***@example.org`), nie die volle. Im Ankündigungs-Reiter steht die Karte „E-Mail an alle mit
bestätigter Adresse" **neben** der Chat-Ankündigung und nicht statt ihr: Die Ankündigung erreicht,
wer gerade spielt, die Mail die anderen. Das Ergebnis zeigt verschickt / abgemeldet / ohne
bestätigte Adresse / fehlgeschlagen / über dem Deckel übrig — und es steht **auch im Fehlerfall**
da, wenn der Server mit 502 meldet, dass gar nichts hinausging; die Felder bleiben dann gefüllt,
damit der Text nicht verloren ist. Der Knopf sperrt sich während des Versands (dieselbe Lehre wie
beim Geschenk-Knopf, #521).

**Löschung mit Frist.** Grundfeld und „Konto löschen (7 Tage Frist)" stehen am Ende der Karte. Die
Rückfrage nennt alles drei: die Frist, was verschwindet (Konto, Spielstand, Bestenliste, Allianz,
Vorposten) und was bleibt (Chat und Feedback, dann unter „Geloeschtes Konto"), dazu dass sich das
bis zum Ablauf abbrechen lässt und danach nicht mehr. Läuft eine Löschung, steht statt des Feldes
eine orange Zeile „Löschung vorgemerkt" mit Frist und Grund sowie ein Abbrechen-Knopf — der
Löschen-Knopf ist dann weg, damit die Frist nicht versehentlich neu gesetzt wird.

**Wächter** `tests/test_admin_konto2_ui.js` (33 Prüfungen) mit den Paaren 1a/1b, 2a/2b, 3a/3b,
3c/3d, 4a/4b und 5a/5b. Gegenprobe gegen origin/main v8.636.0: 28 von 33 fallen, Prüflisten
identisch; die fünf verbleibenden sind im Kopf der Testdatei einzeln begründet.

## Wächter, Galaxie-Reiter, Geschenk je Konto, Chat-Moderation (02.09.2026)

Sechste Runde (Auftrag „Weitere Ideen für Admin Funktionen", alle vier gewählt). Backend #208
zuerst live, dann dieser Stand.

**Wächter als fünfte Karte der Lage.** `loadAdminAlarm()` hängt an `loadAdminLage()` und zeigt je
Schwelle den aktuellen Messwert („18 von 15", orange wenn überschritten, sonst grün), den Zeitpunkt
der letzten Prüfung, die Ruhefrist, die offenen Funde und die letzten Meldungen. Kennt der Server
die Route nicht, fällt die Karte **ersatzlos** weg — die vier vorhandenen Lage-Karten bleiben
stehen, statt dass eine 404-Meldung sie verdrängt. Das ist die eine Stelle, an der `adminListenFehler`
bewusst nicht benutzt wird: Der Wächter ist eine Ergänzung, kein Reiterinhalt.

**Vierzehnter Reiter „Galaxie".** Fünf Karten: Weltboss (Lebenspunkte setzen, entfernen — steht
keiner, sagt die Karte das und bietet **kein** Erschaffen an, weil die `bossId` klientenseitig
entsteht), Alien-Nester und Wrackkonvois (Liste mit Entfernen-Knopf je Eintrag, dazu Auswahl für
Volk und System zum Setzen), Marktereignis beenden, Kopfgeld auf einen Namen setzen. Jede Handlung
fragt nach und nennt die Folge — keine davon hat einen Rückgängig-Knopf, und ein gesetztes Nest
steht sofort auf der Karte aller Spieler.

**Geschenk an ein Konto** im Konto-Blatt: Auswahl der Gabe, Menge, Grund (Pflicht). Die Rückfrage
nennt Menge, Gabe und Grund; nach dem Versand sind Menge und Grund leer, und die Meldung sagt, dass
der Grund im Postfach des Beschenkten steht.

**Chat-Moderation** im Konto-Blatt: „Chat-Nachrichten ansehen" lädt die letzten 20 Zeilen dieses
Kontos aus beiden Kanälen, jede mit Entfernen-Knopf. Zwei Rückfragen nacheinander: erst „entfernen?"
(verschwindet für alle), dann „zusätzlich 24 Stunden stummschalten?" — **Abbrechen bei der zweiten
heißt: nur löschen**, Abbrechen bei der ersten heißt gar nichts. Wer eine Zeile entfernt, will den
Verfasser meistens auch bremsen; zwei getrennte Handgriffe daraus zu machen hieße, dass der zweite
vergessen wird.

**Postfach.** `admin-alarm` (nur der Betreiber bekommt ihn) nennt Konto, Messwert und Schwelle;
`geschenk-konto` nennt den Grund. Beide Einträge müssen da sein, sonst zeichnet das Postfach die
Zeile mit Glocke und dem blanken Wort „Ereignis" — `test_pushkategorien` 2b fällt darauf. Das
Geschenk-Icon ist `ti-sparkles`, **nicht** `ti-gift`: Letzteres fehlt im 69er-Whitelist-Font und ist
genau der Bug, wegen dem `check-icons.js` existiert.

**Wächter** `tests/test_admin_runde6_ui.js` (33 Prüfungen) mit den Paaren 1a/1b, 2a/2b, 2e/2f,
3a/3b und 4a/4b. Gegenprobe gegen origin/main v8.641.0: 28 von 34 fallen, Prüflisten identisch.
Der erste Entwurf starb dabei mitten im Lauf an einem Zugriff auf ein leeres Listenelement, statt
rot zu werden (Arbeitsregel 34) — jeder solche Zugriff trägt seither eine Existenzprüfung.

**Fünfzehnter Reiter „Module" (04.09.2026, Idee Sascha „Module-Editor").** Die Übersicht ist
**abgeleitet, nicht gepflegt**: `modulFundort()` fragt `fundPool()` — dieselbe Funktion, mit der das
Spiel wirklich zieht — und rechnet den Anteil aus der Topfgröße. Eine gepflegte Fundort-Tabelle wäre
die dritte Kopie neben Frontend und Backend gewesen und die erste, die niemand nachzieht. Gemessen:
93 Module (48 Standort-, 45 Schiffsmodule) in sieben Herkünften, keines davon unerreichbar.

- **Der Anteil ist 1/n und sagt ausdrücklich, was er nicht ist.** `zieheAusPool()` indiziert
  gleichverteilt, jeder Eintrag im Topf ist also gleich wahrscheinlich. Der Satz lautet deshalb
  „Schüttet diese Quelle ein Modul aus, ist es mit dieser Wahrscheinlichkeit dieses" — er sagt
  **nicht**, wie oft die Quelle überhaupt etwas ausschüttet. Ohne diesen Zusatz liest sich die Zahl
  als Fundchance und ist um Größenordnungen falsch.
- **Zwei Arten von Topf, und sie kommen aus verschiedenen Funktionen.** `fundPool()` ist die eine;
  die andere sind Ziehstellen mit eigener Liste. Die adversarische Durchsicht hat genau dort einen
  Fehler des ersten Entwurfs gefunden: Boss-Set-Teile standen als „gezielt vergeben" da, obwohl
  `grantBossSetModule()` gleichverteilt unter den vier Teilen **desselben** Bosses würfelt — gemessen
  20 Teile, fünf Bosse zu je vieren, also 25 % je Stück und ein Fünftel aller Module falsch
  ausgewiesen. Die Teile-Liste ist jetzt eine gemeinsame Funktion (`bosssetTeile()`), die die
  Ziehstelle **und** die Übersicht lesen. Unikate (`grantUnikatModul('leviathanherz')`) und
  Konvoi-Module (der Server nennt `defKey`) werden dagegen wirklich benannt vergeben — dort steht
  „gezielt vergeben" zu Recht. Wächter-Paar 1g/1h.
- **Die Karte „Auffälligkeiten"** nennt Module, die in **keinem** Topf liegen und auch keine gezielte
  Quelle haben — im Spiel unerreichbar. Sie steht auch dann da, wenn es keine gibt („keine", grün):
  Eine Auffälligkeitsliste, die bei null Befunden verschwindet, ist von „noch nicht geladen" nicht
  zu unterscheiden.
- **Drop-Chancen** (Backend #229, `GET/POST /api/admin/module…`): Der Server vergibt nur die beiden
  Wrackkonvoi-Module, alle übrigen Fundorte stehen im Frontend-Code — das sagt der Kasten selbst.
  Je Quelle Zahlenfeld, „Übernehmen" und, **nur bei einer wirklich gestellten Quelle**, „Auf 0,3
  zurück". Zurücksetzen schickt `null`, nie den Code-Wert: Sonst fröre der Eingriff die heutige
  Balance ein, und eine spätere Änderung im Code hätte keine Wirkung mehr.
- **Eigene Einträge sind Entwürfe.** Die Kennzeichnung „ohne Wirkung im Spiel" steht an jedem
  Eintrag, in der Einleitung des Kastens und in der Meldung nach dem Anlegen. Der Schlüssel beginnt
  mit `eigen_` (Backend-Sperre), damit ein Entwurf nie ein echtes Modul überschreiben kann.
- **Fällt der Server aus, bleiben die Fundorte stehen** — sie kommen aus dem Code. Ein Fehler nimmt
  dem Reiter die Regler und die Entwürfe, nicht die Übersicht.

**Der Anteil in der Sammlung.** Die Herkunftszeile stand schon da und sagt, WO etwas fällt; sie sagte
nur nicht, wie viel Auswahl der Topf hat — genau die Frage, die ein Spieler stellt. `sammlungAnteilText()`
hängt den Satz an dieselbe Zeile und ruft **dieselbe** Funktion wie der Admin-Reiter. Nur für Module:
Verbrauchsgüter, Material und Reliquien ziehen aus Töpfen mit eigenen Gewichten, für sie wäre 1/n falsch.

**Nebenbefund, in der gemeinsamen Funktion behoben.** `adminListenFehler()` nannte die Liste nur beim
404er; bei jedem anderen Status stand „Liste konnte nicht geladen werden (500)" — auf einem Reiter mit
mehreren Kästen sagt das nicht, welche. Der Sammelfall und der 403er nennen jetzt beide die Liste.
Das gilt für alle siebzehn Admin-Listen, nicht nur für die neue.

**Wächter** `tests/test_modul_fundorte.js` (26 Prüfungen). Die Kernmessung ist 1c: Sie hängt ein Modul
**zur Laufzeit** in den Abgrund um und prüft, dass Herkunft und Topfgröße mitgehen — eine gepflegte
Tabelle würde das nicht mitbekommen. Paare 1a/1b, 2a/2b, 3a/3b. Gegenprobe gegen origin/main d677ffc
(v8.668.0): 22 von 24 fallen; grün bleiben genau die zwei „keine Seitenfehler"-Prüfungen, die es am
alten Stand auch nicht gibt. **Lehre für die nächste UI-Prüfung dieser Art:** Das ganze Spielskript
liegt in einem `(function(){ … })()`, über `page.evaluate` ist deshalb **keine** Spielfunktion
erreichbar (der erste Entwurf starb an „modulFundorte is not defined"). Der Weg ist derselbe wie in
`test_abgrund_gegenstaende.js`: den Quelltext holen und in Node auswerten — und diese Auswertung
fängt ihren eigenen Fehler, sonst hätte die Gegenprobe keine Prüfnamen zum Vergleichen.
