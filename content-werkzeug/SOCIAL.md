# Regeln für Social-Media-Posts (TikTok)

Verdichtet aus der laufenden Arbeit. Kurz halten; was hier steht, hat sich in einem
konkreten Fall als nötig erwiesen.

## Hashtags: genau fünf

**TikTok akzeptiert nur fünf Hashtags** (Vorgabe Sascha, 07.09.2026). Nicht zehn,
nicht „so viele wie passen" – fünf. Die fünf werden **je Post neu gewählt**, nach dem,
was für genau diesen Inhalt die meiste Reichweite bringt.

Auswahlprinzip, weil alle fünf Plätze knapp sind:

- **1–2 große Tags** für die Grundreichweite (`#gamedev`, `#indiegame`)
- **2–3 passgenaue Tags** für die Trefferquote (`#browsergame`, `#idlegame`,
  `#aufbauspiel`) – sie bringen weniger Zuschauer, aber die richtigen
- **1 Format-Tag**, wenn der Post ein erkennbares Format hat (`#vorhernachher`) –
  die schauen Leute gezielt

Verzichtet wird bewusst auf sehr kleine Tags wie `#deutschergamedev`: Sie kosten einen
der fünf Plätze und bringen kaum Reichweite. Die deutsche Zielgruppe findet der
Algorithmus ohnehin über die deutschsprachige Caption.

Es gibt **keine gemessenen Volumina** in dieser Umgebung – die Auswahl ist begründet,
nicht gemessen. Wer Zahlen hat, schlägt diese Regel.

## Sprache

Deutsch. Das Spiel ist `<html lang="de">` und hat keinen Sprachumschalter; englische
Reichweite springt auf einer deutschen Oberfläche sofort wieder ab.

## Zahlen

Immer **live aus dem laufenden Spiel** ziehen, nie aus dem Gedächtnis oder aus einem
älteren Checkout. Die Startseite rechnet `llStatSystems`, `llStatPlanets`,
`llStatShips` aus `PLANETS.length` / `SHIP_DEFS.length` und `llStatNext` als Countdown.
Die Galaxie wächst wöchentlich – innerhalb einer Woche waren es 73 → 111 → 113 Systeme.

Wochengrenze ist **Montag 00:00 UTC**, also 02:00 Uhr deutscher Zeit. Ein Montagabend-
Post sagt deshalb „seit heute früh", nicht „heute Nacht kommen".

## Was nicht behauptet wird

- Keine Mengenangaben zu Belohnungen ohne Beleg (Gaben und Laufzeit eines Bonuscodes
  stehen im Admin-Bereich; wer sie nicht kennt, schreibt sie nicht in die Caption).
- Der **Bonuscode wird in den Einstellungen eingelöst**, nicht bei der Registrierung –
  die manuelle Code-Eingabe beim Einladen wurde am 13.07.2026 entfernt (v8.35.5).
  Steht der Weg nicht in der Caption, suchen die Leute vergeblich und geben auf.
- Ein Demo-Spielstand aus `seed.js` ist gestellt. Als „so sieht das Spiel aus" in
  Ordnung, als „mein Konto" gelogen.

## Bild oder Illustration

Bei **Feature- und Update-Posts** schlagen echte Aufnahmen jede Illustration: Ein
Vorher/Nachher aus zwei Spielständen belegt die Änderung, eine gezeichnete Karte
behauptet sie nur. Illustration ist für Stimmungsbilder und Karussell-Titelkarten da.
