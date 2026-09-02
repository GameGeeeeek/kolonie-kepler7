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
