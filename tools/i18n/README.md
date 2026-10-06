# Vorhandene Deutsch/Englisch-Architektur

Das Spiel nutzt die eingebetteten `k7t`, `k7View` und `k7Ui`. Definitionen und Spielstandschlüssel bleiben unverändert; nur Darstellungstexte ändern sich. `sync.cjs` ersetzt genau einen markierten Laufzeitblock und registriert zusätzliche Autorendefinitionen. Es führt den ursprünglichen Compiler nicht erneut aus.

`inventory.cjs` liest Autoren-Texte aus Spiel, Backend und Ideenmodul. Das Feld `missing` enthält auch katalogisierte Identitäten: sprachübergreifende Begriffe und Eigennamen. Entscheidend ist, dass kein Inventareintrag ohne Katalogschlüssel bleibt. Browserprüfungen ergänzen diesen statischen Nachweis für dynamische Ansichten.

Entwürfe wurden mit dem lokalen offiziellen Argos-Modell `translate-de_en-1_3` erzeugt. Modellarchiv SHA-256: `becc2b0011f8249fcb89be9ecb75ba0d876b1fab93c28ee6ff0420936897d637`. Herkunft: [Argos-Paketindex](https://github.com/argosopentech/argospm-index), Download über den referenzierten Argos-Datenserver. Modell, Laufzeitpakete und Rohentwürfe liegen außerhalb des Repositorys und sind keine Spiel-Abhängigkeit.

77 vollständige Forschungs-/Modulbeschreibungen stehen mit dem Original in `reviewed-source.json`. `glossary.json` und `reviewed-text.json` enthalten manuelle Korrekturen. Die übrigen Entwürfe wurden nicht einzeln vollständig menschlich lektoriert. `quality.cjs` prüft Werte/Vorzeichen, URLs, Variablen und exakte Markupstruktur; `import-drafts.cjs` verweigert die Übernahme bei Problemen. `quality-report.json` dokumentiert das Ergebnis.

Private Namen, Notizen, freie Nachrichten, Beschreibungen und Eingaben erhalten geschützte Textgrenzen (`translate="no"`). Dynamische Muster übersetzen feste Textteile und erhalten eingefangene Namen, Werte und HTML-Escaping. Tests verwenden unter anderem persönliche Namen, die zufällig `Warteschlange`, `Heimatbasis` oder `Jäger` heißen.

Prüfungen: `node tools/i18n/test.cjs`, `node tests/test_english_complete.js`, `node tests/test_english_locale.js`, `node tools/i18n/check-counterexamples.cjs`. Gegenproben entfernen gezielt den Privatschutz, kürzen die Hilfe bzw. unterdrücken Beschreibungsübersetzungen und müssen an benannten Assertions scheitern.

Bestehende Quelltextprüfungen müssen den Katalog von tatsächlichen Anzeigestellen trennen: `tests/lib/i18n.js` bietet dafür `ohneI18nWoerterbuch`. Isolierte Berechnungen mit Autorentabellen verwenden `i18nFunction` und damit den echten Sprachhelfer, nicht Attrappen. `tools/ideas/source-preflight.cjs` beendet ausgewählte Quelltext-Gegenproben vor Browserstart; das ersetzt weder den vollständigen Browsertest noch den Projektprüflauf.

Nach Autorenänderungen zuerst Quelle und Katalog pflegen, dann `node tools/ideas/sync.cjs` und `node tools/i18n/sync.cjs` ausführen. Inventur und passende Browserprüfung wiederholen. Beide Synchronisierungen sind idempotent.
