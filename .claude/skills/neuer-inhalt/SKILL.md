---
name: neuer-inhalt
description: 'Pflichtschritte beim Hinzufügen neuer Spielinhalte in kolonie-kepler7 — Forschung (RESEARCH_DEFS), Gebäude (BUILDING_DEFS), Schiff (SHIP_DEFS/Superschiffe), Modul, Offizier, Doktrin, Event oder Item. Jeder neue Eintrag braucht von Anfang an ein eigenes Icon UND eine vollständige, selbsterklärende Beschreibung, keine Ausnahme. IMMER verwenden, sobald ein neuer Eintrag in einem *_DEFS-Array oder einer ähnlichen Inhaltsliste angelegt wird — auch wenn nur nach der Spielmechanik gefragt wurde, nicht explizit nach Icon oder Text.'
---

# Neuer Inhalt (kolonie-kepler7)

Jeder neue Eintrag in `RESEARCH_DEFS`, `BUILDING_DEFS`, `SHIP_DEFS`/Superschiffen, Modulen,
Offizieren, Doktrinen, Events oder Items braucht **beides**, nicht optional:

## (a) Ein eigenes Icon

- Entweder ein **handgezeichnetes SVG** in `ICONS`/`RES_ICONS`/`SHIP_HULL_DEFS` unter einem neuen
  Key, oder ein gültiges `ti-*`-Icon aus der ~69er-Whitelist des eingebetteten Icon-Fonts.
- Der `iconHtmlFor`-Fallback auf `ti-flask` ist ein Notnagel, **kein Ersatz** — ein neuer Inhalt
  darf nicht dauerhaft darauf sitzen bleiben.
- **Der Icon-Font ist ein Subset** (nur die tatsächlich verwendeten Glyphen, ~10,8 KB statt
  446,7 KB). Ein neues `ti-*`-Icon reicht deshalb NICHT allein — der Glyph fehlt sonst im Font:
  1. CSS-Regel ergänzen: `.ti-neuesicon:before { content: "\eXXX"; }` (Codepoint aus der
     Tabler-Webfont-CSS)
  2. `node build-icon-subset.js` ausführen — baut den Font neu, aktualisiert **beide**
     HTML-Dateien
  3. `node check-icons.js` zur Kontrolle (Exit-Code 0 = sauber)

## (b) Eine vollständige Beschreibung

- `desc`/`effectDesc` als **ganzer Satz**, der Wirkung und ggf. Stapelverhalten/Deckel nennt.
  Vorbild: `rexpedition`.
- **Kein** knapper Kürzel-Text wie „Lagerkapazität (vertieft)" — das liest sich wie eine fehlende
  Beschreibung, nicht wie eine kurze.

## Danach prüfen

- `node check-icons.js` (Icon-Whitelist)
- Kurzer Render-Blick auf die Karte: erscheint die Beschreibung vollständig, nicht abgeschnitten?

## Zwei verwandte Fallstricke bei Bulk-Einfügen

- Nach Bulk-Einfügen in Arrays (`PLANETS`, `RESEARCH_DEFS` etc.): Regex-Check auf `,\s*,`
  (doppeltes Komma ist gültiges JS, crasht aber `Array.find()`).
- `BUILDING_DEFS` mit `category:'defense'`: `defVal`/`atkVal` müssen explizit gesetzt sein
  (mind. `0`), sonst kippt die globale Verteidigungsberechnung auf `NaN`.

## Balance-Hinweis für neue Belohnungen/Boni

- **„N Minuten eigene Produktion"** als Belohnungsformel ist bei starker Wirtschaft schnell
  explosiv — bewusst vermeiden oder hart deckeln.
- Neue **kleine, stapelnde** Produktions-/Kampfkraft-Boni gehören in die additive, gedeckelte
  Gruppe (`1 + Math.min(1.0, summe_kleiner_boni)`), nicht als eigene Multiplikation — das
  verhindert explosionsartiges Aufschaukeln vieler kleiner Boni.
