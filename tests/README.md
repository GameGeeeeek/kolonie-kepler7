# Prüflauf

```
node tests/run.js                 # Pflichtprüfungen + alle Tests
node tests/run.js --nur-pflicht   # nur Syntax/Icons/Dateigleichheit/Version (Sekunden)
node tests/run.js selects         # nur Tests, deren Dateiname "selects" enthält
```

Exit-Code 0 = sauber. Damit taugt der Aufruf auch für einen Git-Hook oder eine spätere CI.

## Warum dieses Verzeichnis existiert

Bis zum 25.07.2026 lagen **alle** Tests ausschließlich im Sitzungs-Scratchpad unter `/tmp` — und waren
weg, sobald der Container eingesammelt wurde. Das Repo enthielt 19 Dateien und **keinen einzigen
Test**. Die Folge war absehbar und ließ sich messen: Von 16 stichprobenartig gestarteten Alt-Tests
liefen nur 6 durch, weil sie nie wieder ausgeführt wurden und still verrotteten (fest verdrahtete
Pfade auf `/opt/node22/...`, veraltete Selektoren).

Was hier liegt, ist deshalb **kuratiert, nicht komplett**: nur Tests, die nachweislich laufen und
etwas Sinnvolles prüfen. Ein Test, der niemand ausführt, ist kein Sicherheitsnetz.

## Aufbau

| | |
|---|---|
| `run.js` | Starter, führt Pflichtprüfungen und danach jede `test_*.js`/`sweep.js` als eigenen Prozess aus |
| `lib/umgebung.js` | findet Playwright, den Browser, die Spieldatei und optional das Backend-Repo |
| `sweep.js` | Pflichtprüfung 3 aus CLAUDE.md: Boot + alle Tabs durchklicken, auf Konsolenfehler prüfen |
| `test_*.js` | je ein Feature/Bugfix |
| `test_tote_funktionen.js` | Sonderfall: reiner Textscan ohne Browser – findet Funktionen ohne Aufrufstelle und doppelte Deklarationen auf oberster Ebene (der Fallstrick aus CLAUDE.md) |

**Keine absoluten Pfade in den Tests.** Alles kommt aus `lib/umgebung.js`; nur dort steht, wo
Playwright und der Browser liegen. Überschreibbar per `KEPLER_CHROMIUM` und
`KEPLER_BACKEND_SERVER`.

## Tests, die das Backend-Repo brauchen

`test_kampfphasen`, `test_konter_paritaet` und `test_flottenbalance` vergleichen Frontend und Backend
Zeile für Zeile — sie fangen genau die Fehlerklasse ab, bei der eine Formel nur auf einer Seite
geändert wird. Liegt `kolonie-kepler7-backend` nicht daneben, **überspringen sie sich selbst**
(`SKIP`, Exit-Code 0), damit der Frontend-Prüflauf ohne das zweite Repo durchläuft.

Tests, die einen echten Backend-Server starten (Sitzungsverwaltung, Mengenschutz, Wiederkehr-Quote),
gehören ins Backend-Repo und liegen bewusst nicht hier.

## Einen neuen Test schreiben

```js
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

(async () => {
  const browser = await starteBrowser();
  const page = await (await browser.newContext()).newPage();
  await page.goto(SPIEL_URL);
  check('irgendetwas stimmt', true);
  await ende(() => browser.close());
})();
```

Zwei Dinge, die sich in dieser Codebasis wiederholt gerächt haben:

1. **Erst rot sehen, dann grün.** Ein Test, der die vorhandene Fassung nicht zum Fehlschlagen bringt,
   prüft womöglich nichts. In dieser Sitzung sind zwei solche Blindgänger aufgefallen — einer
   verglich HTML-Text, der sich zwischen zwei Durchläufen gar nicht ändert, ein anderer las einen
   Selektor, den es nicht gab, und war deshalb immer grün.
2. **Alles steckt in einer IIFE.** `state` und die Spielfunktionen sind nicht global. Ein Test setzt
   den Zustand über den Spielstand (Mock-Backend oder `localStorage`) und liest ihn über das DOM.
