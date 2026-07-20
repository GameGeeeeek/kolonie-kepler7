# Konzept: Tier-2-Erweiterung — Synthese-Kette (Stufe 6–7) + Effizienz-Achse

Stand: 20.07.2026 · Zielversion: ab v8.169.0 (mehrphasig) · Autor: Konzept für Sascha

Dieses Dokument beschreibt eine **konsistente Erweiterung des bestehenden Tier-2-Systems** —
nach oben (zwei neue Apex-Ressourcen) und in die Breite (eine Effizienz-Forschungsachse) —
inklusive aller zugehörigen Forschungen, Fabriken, Verteidigungs- und Nutzgebäude, Schiffe,
Verbrauchsgegenstände, Module, Erfolge und Doku. Alle Zahlen sind so gewählt, dass sie die
bestehenden Balance-Kurven fortschreiben (nicht brechen).

---

## 1. Bestandsaufnahme (was es heute gibt)

**5 Tier-2-Ressourcen (lineare Kette, `TIER2_DEFS`):**

| # | Ressource | Fabrik | Inputs (je Einheit) | Rate/Stufe | Lager (Basis/Stufe) | max |
|---|-----------|--------|---------------------|-----------|---------------------|-----|
| 1 | Nanolegierungen | Nanolegierungsfabrik | erz 8, kristalle 5, energie 4 | 0,006/s | 200 / 150 | 15 |
| 2 | Quantenchips | Quantenchipfabrik | kristalle 12, deuterium 5, energie 6 | 0,002/s | 100 / 80 | 15 |
| 3 | Hochenergiekristalle | Kristalllabor | kristalle 18, energie 12, antimaterie 1 | 0,0015/s | 80 / 60 | 15 |
| 4 | Fusionskerne | Fusionsschmiede | deuterium 20, antimaterie 2, **nanolegierungen 3** | 0,0008/s | 50 / 40 | 15 |
| 5 | KI-Kerne | KI-Labor | **quantenchips 2, nanolegierungen 2**, antimaterie 3 | 0,0005/s | 40 / 30 | 15 |

**Forschungskette (jeweils `maxLevel:1`):**
`rnanotech` → `rquantenphysik` → `rhochenergie` → `rfusionskerne` → `rkitech`

**Verbraucher heute:**
- Verteidigung: Nano-Verteidigungsplattform (150/60), Quanten-Sensorphalanx (20/0 + Vorwarnzeit),
  Hochenergie-Schildkuppel (220/0), Fusionsbastion (250/120), KI-Verteidigungskern (300/150)
- Nutzgebäude: Hochsicherheitslager (+T2-Lager), Kryolager (+Basis-Lager), Fusions-Werftkern
  (−Bauzeit, Deckel −15 %), Kryo-Archiv (Prestige-Erhalt)
- Schiffe: Nanoklinge (55), Quantenkreuzer (80/Schild 20), Fusionsdreadnought (180)
- Verbrauch: Quantensensoren, KI-Abfangautomatik, Terraforming-Energieschub, Belagerungs-Ladung
- Module: gefertigte Tier-2-Module in Schiffsklasse „raffiniert"

**Wichtig — was schon dynamisch mitwächst (kein Handanlegen nötig):**
- Erfolge `industriemagnat` / `kettenmeister` (rechnen über `TIER2_DEFS.every/…filter`)
- Tagesaufgabe „5 Tier-2-Ressourcen produzieren" (`available: TIER2_DEFS.some(...)`)
- Tier-2-Badgeleiste (`tier2ResBadges`), Pakt-Geschenk-Auswahl, Lagerdeckel-Anzeige
- ⇒ Neue Ressourcen erscheinen dort **automatisch**.

**Was hart verdrahtet ist (muss manuell erweitert werden):**
- **Kryo-Archiv-Erhalt**: feste Mengen „40 Nano / 20 Chips / 15 HEK / 8 Kerne / 5 KI je Stufe".
- Ggf. serverseitige Markt-Tageslimits (irrelevant, weil Tier-2 nicht handelbar).

---

## 2. Designziele & Leitplanken

1. **Nach oben vertiefen, nicht verbreitern-um-der-Menge-willen:** zwei neue Apex-Ressourcen, die
   **mehrere bestehende Tier-2-Ressourcen bündeln** → das Produktionsnetz wird tiefer verwoben,
   statt eine sechste parallele Insel zu bauen.
2. **Neue horizontale Achse:** erstmals eine **skalierende Effizienz-Forschung** (Durchsatz) plus ein
   Nutzgebäude für **Input-Sparsamkeit** — ein echtes Langzeitziel, das die *vorhandenen* Fabriken
   aufwertet (bisher fix bei Stufe 15 gedeckelt, ohne Effizienzpfad).
3. **Balance-Leitplanken (CLAUDE.md):**
   - Verteidigungswerte laufen in die **bestehende additiv-gedeckelte** Kampf-Bonus-Gruppe (keine neue Multiplikation).
   - Keine „N Minuten eigene Produktion"-Belohnungen bei neuen Verbrauchsgegenständen.
   - Effizienz-Boni als **direkte, gedeckelte** Multiplikatoren (nicht als stapelnde Gruppe).
   - `category:'defense'` → **`defVal`/`atkVal` explizit setzen** (mind. 0), sonst `NaN` in der Verteidigungssumme.
   - **Array-Reihenfolge in `TIER2_DEFS`**: eine Kette, die eine Tier-2-Ressource als Input nutzt, muss
     **nach** ihren Inputs stehen (die Engine produziert im selben Tick in Array-Reihenfolge).

---

## 3. Neue Ressourcen (an `TIER2_DEFS` **anhängen**, Reihenfolge zwingend)

### 6. Metamaterial-Gewebe — `metamaterial`
Verbund-Werkstoff aus zwei mittleren Ketten; Basis für Panzerung & schwere Hüllen.

```
{ key:'metamaterial', label:'Metamaterial-Gewebe', icon:'ti-atom-2', bg:'rgba(159,225,203,0.18)', fg:'#9fe1cb',
  buildingKey:'metamaterialweberei',
  inputs:{ hochenergiekristalle:2, fusionskerne:1, kristalle:30 },
  ratePerLevel:0.0004, storageBase:30, storagePerLevel:20 }
```
Inputs liegen bei Index 2 (HEK) und 3 (Fusionskerne) → **vor** Index 6. ✓

### 7. Singularitätskerne — `singularitaetskern`
Apex-Ressource; bündelt die zwei schwersten Kerne. Rarste Ressource des Spiels.

```
{ key:'singularitaetskern', label:'Singularitätskerne', icon:'ti-infinity', bg:'rgba(126,119,221,0.20)', fg:'#c3bef5',
  buildingKey:'singularitaetsreaktor',
  inputs:{ kikerne:2, fusionskerne:2, antimaterie:5 },
  ratePerLevel:0.0003, storageBase:20, storagePerLevel:12 }
```
Inputs bei Index 5 (KI-Kerne) und 3 (Fusionskerne) → **vor** Index 7. ✓

> Beide Ketten reihen sich bewusst noch langsamer ein (0,0004 / 0,0003 pro Stufe) und verbrauchen je
> **zwei** knappe Vorstufen → echtes Endgame-Tempo, keine Abkürzung.

---

## 4. Neue Fabriken (an `BUILDING_DEFS` anhängen, `category:'refine'`)

```
{ key:'metamaterialweberei', name:'Metamaterialweberei', icon:'ti-building-factory-2', produces:null, baseRate:0,
  baseCost:{erz:40000, kristalle:28000, deuterium:12000, antimaterie:1000}, costMult:1.35,
  bg:'rgba(159,225,203,0.16)', fg:'#9fe1cb', effectDesc:'Metamaterial-Produktion (verbraucht Hochenergiekristalle/Fusionskerne/Kristalle)',
  category:'refine', maxLevel:15, buildTime:2100, buildTimePerLevelMult:1.15, requires:['rmetamaterial'] }

{ key:'singularitaetsreaktor', name:'Singularitätsreaktor', icon:'ti-building-factory-2', produces:null, baseRate:0,
  baseCost:{erz:60000, kristalle:40000, deuterium:20000, antimaterie:1600}, costMult:1.4,
  bg:'rgba(126,119,221,0.16)', fg:'#c3bef5', effectDesc:'Singularitätskern-Produktion (verbraucht KI-Kerne/Fusionskerne/Antimaterie)',
  category:'refine', maxLevel:15, buildTime:2400, buildTimePerLevelMult:1.15, requires:['rsingularitaet'] }
```
Beide brauchen einen `SHIP_HULL_DEFS`-artigen Mini-SVG-Eintrag im Gebäude-Icon-Objekt (analog zu den 5
bestehenden Fabriken; sonst greift der Icon-Fallback). **`check-icons.js`** validiert das.

---

## 5. Neue Forschung (an `RESEARCH_DEFS` anhängen)

### `rmetamaterial` — „Metamaterial-Synthese" (`maxLevel:1`)
```
baseCost:{erz:110000, kristalle:75000, antimaterie:6000, forschungspunkte:13000}, costMult:1.3,
baseDuration:9000, durationMult:1.35, effectRes:null, effectPerLevel:0, maxLevel:1,
requires:[{key:'rkitech',level:1}],
desc:'Schaltet Metamaterialweberei und Metamaterial-Panzerwall frei (sechste Tier-2-Ressource: Metamaterial-Gewebe, verbraucht laufend Hochenergiekristalle/Fusionskerne/Kristalle).'
```

### `rsingularitaet` — „Singularitätsphysik" (`maxLevel:1`)
```
baseCost:{erz:150000, kristalle:100000, deuterium:60000, antimaterie:9000, forschungspunkte:18000}, costMult:1.3,
baseDuration:12000, durationMult:1.35, effectRes:null, effectPerLevel:0, maxLevel:1,
requires:[{key:'rmetamaterial',level:1}],
desc:'Schaltet Singularitätsreaktor und Singularitäts-Geschützturm frei (siebte Tier-2-Ressource: Singularitätskerne - die apex-Kette, verbraucht laufend KI-Kerne/Fusionskerne/Antimaterie).'
```

### `rraffinerieoptimierung` — „Raffinerie-Optimierung" (NEU: mehrstufig, horizontale Achse)
```
baseCost:{kristalle:20000, deuterium:8000, forschungspunkte:3000}, costMult:1.4,
baseDuration:2400, durationMult:1.4, maxLevel:10,
requires:[{key:'rquantenphysik',level:1}],
desc:'Erhöht den Durchsatz ALLER Tier-2-Fabriken um +3 % je Stufe (max. +30 %).'
```
**Wirkung (gedeckelt, direkt):** effektive Fabrikrate ×`(1 + 0.03 * level)`, hart bei ×1,30. Hook in der
Produktionsberechnung (dort, wo `ratePerLevel` × Fabrikstufe zur Tick-Produktion wird): einen Faktor
`raffinerieThroughputMult()` einführen. Keine stapelnde Bonus-Gruppe — ein sauberer, gedeckelter Multiplikator.

---

## 6. Neue Verteidigungsgebäude (`category:'defense'`, `defVal`/`atkVal` **explizit**)

```
{ key:'metamaterialwall', name:'Metamaterial-Panzerwall', icon:'ti-shield-lock', produces:null, baseRate:0,
  baseCost:{erz:9000, kristalle:5000, metamaterial:20}, costMult:1.4,
  bg:'rgba(159,225,203,0.18)', fg:'#9fe1cb', effectDesc:'Verteidigung',
  category:'defense', defVal:340, atkVal:0, buildTime:300, requires:['rmetamaterial'] }

{ key:'singularitaetsturm', name:'Singularitäts-Geschützturm', icon:'ti-bolt', produces:null, baseRate:0,
  baseCost:{erz:12000, kristalle:6000, singularitaetskern:15}, costMult:1.4,
  bg:'rgba(126,119,221,0.18)', fg:'#c3bef5', effectDesc:'Verteidigung',
  category:'defense', defVal:380, atkVal:220, buildTime:330, requires:['rsingularitaet'] }
```
Setzt die Leiter fort: reiner Schutz-Gipfel (340/0, über Schildkuppel 220) und Kombi-Gipfel (380/220,
über KI-Kern 300/150). Fließt in die **bestehende gedeckelte** Verteidigungs-Bonus-Gruppe.

---

## 7. Neue Nutzgebäude (`category:'utility'`)

### `gravkompressor` — „Gravitations-Stabilisator" (NEU: Input-Sparsamkeit)
```
{ key:'gravkompressor', name:'Gravitations-Stabilisator', icon:'ti-atom', produces:null, baseRate:0,
  baseCost:{kristalle:10000, deuterium:4000, metamaterial:15}, costMult:1.4,
  bg:'rgba(159,225,203,0.14)', fg:'#9fe1cb', effectDesc:'-2 % Tier-2-Rohstoffverbrauch je Stufe (imperiumsweit, max. -20 %)',
  category:'utility', maxLevel:10, requires:['rmetamaterial'] }
```
**Wirkung (gedeckelt):** senkt den Input-Verbrauch aller Tier-2-Fabriken um `min(0.20, 0.02*Σstufen)`.
Zweite, klar getrennte Effizienzachse (Durchsatz ↑ vs. Verbrauch ↓). Hook an der Stelle, wo Fabrik-Inputs
vom Bestand abgezogen werden.

> Bewusst **kein** weiteres „größeres Lager"/„−Bauzeit" (das gibt es schon) — der Stabilisator eröffnet
> eine neue Optimierungsdimension statt einer stärkeren Variante von Vorhandenem.

---

## 8. Neue Schiffe (`SHIP_DEFS`, Baukosten komplett aus raffinierten Ressourcen)

```
{ key:'metamaterialtitan', name:'Metamaterial-Titan', icon:'ship_metamaterialtitan', atk:150, shield:80,
  costFn:metamaterialtitanCost, buildTime:1100, requires:['rmetamaterial'], drive:'impuls', speed:45, defWeight:2.0,
  nicheDesc:'schwerster Verteidigungs-Titan, höchster Schildwert - Baukosten aus Metamaterial und Hochenergiekristallen' }

{ key:'singularitaetsvernichter', name:'Singularitäts-Vernichter', icon:'ship_singularitaetsvernichter', atk:280,
  costFn:singularitaetsvernichterCost, buildTime:1500, requires:['rsingularitaet'], drive:'hyperraum', speed:38, defWeight:1.6,
  nicheDesc:'Apex-Flaggschiff - stärkster regulärer Angriffswert, Baukosten aus Singularitätskernen und Fusionskernen' }
```
- `metamaterialtitanCost`: z. B. `{metamaterial:40, hochenergiekristalle:30}`
- `singularitaetsvernichterCost`: z. B. `{singularitaetskern:25, fusionskerne:40}`
- Beide brauchen einen `SHIP_HULL_DEFS`-Mini-Icon-Eintrag (check-icons prüft die 1:1-Abdeckung).
- **Modul-Klasse:** `shipKeys` der Klasse „raffiniert" um beide erweitern (oder neue Klasse „exotisch").

---

## 9. Neue Verbrauchsgegenstände (erhöhen `tier2ConsumablesUsed` → speist Erfolg „Verbrauchsstratege")

Beide bewusst **utility**, nicht „N Minuten Produktion":

- **Metamaterial-Reparaturschwarm** (ab `rmetamaterial`): stellt sofort einen Teil zerstörter
  Verteidigungsstruktur wieder her (z. B. 25 % der aktuell fehlenden Verteidigungs-HP), Kosten z. B.
  10 Metamaterial. Sinnvoll nach einem Angriff, statt auf regulären Wiederaufbau zu warten.
- **Singularitäts-Sprungladung** (ab `rsingularitaet`): verkürzt **eine laufende** Flottenmission
  einmalig um 25 % Restflugzeit, Kosten z. B. 4 Singularitätskerne. Rein zeitlich, kein Ressourcen-Output.

---

## 10. Neue Module

Zwei gefertigte Apex-Module im bestehenden Tier-2-Fertigungs-Pool (erhöhen `tier2ModulesCrafted` →
speist Erfolg „Modulschmied"):
- **Metamaterial-Panzerplatte** (Verteidigungs-/Hüllenmodul, aus Metamaterial)
- **Singularitäts-Fokusarray** (Angriffsmodul, aus Singularitätskernen)

---

## 11. Neue Erfolge (`ACHIEVEMENTS`)

```
{ key:'synthesemeister', name:'Synthese-Meister', desc:'Errichte deine erste Metamaterialweberei.',
  check: s => tier2TotalLevel(tier2Def('metamaterial')) >= 1,
  progress: s => [Math.min(1, tier2TotalLevel(tier2Def('metamaterial'))), 1],
  reward:{erz:20000,kristalle:14000,deuterium:6000,antimaterie:300,credits:600}, xpReward:600 }

{ key:'singularitaetsarchitekt', name:'Singularitäts-Architekt', desc:'Errichte deinen ersten Singularitätsreaktor.',
  check: s => tier2TotalLevel(tier2Def('singularitaetskern')) >= 1,
  progress: s => [Math.min(1, tier2TotalLevel(tier2Def('singularitaetskern'))), 1],
  reward:{erz:30000,kristalle:20000,deuterium:10000,antimaterie:500,credits:1000}, xpReward:900 }

{ key:'raffinerieoptimierer', name:'Raffinerie-Optimierer', desc:'Bringe die Raffinerie-Optimierung auf Maximalstufe.',
  check: s => (s.research.rraffinerieoptimierung||0) >= 10,
  progress: s => [Math.min(10, s.research.rraffinerieoptimierung||0), 10],
  reward:{kristalle:12000,deuterium:6000,credits:400}, xpReward:400 }
```
**Kategorie-Map (`ACH_CAT`) mitpflegen:** die drei Keys → `aufbau` (bzw. `raffinerieoptimierer` → `forschung`).
`industriemagnat`/`kettenmeister` wachsen automatisch mit (jetzt 7 statt 5 Ketten) — ihre Belohnung darf
ggf. leicht angehoben werden, weil das Ziel härter wird (optional).

---

## 12. Zwingende Hand-Anpassungen (nicht-dynamisch)

1. **Kryo-Archiv-Erhalt erweitern** (`kryoarchiv`): Erhalt-Mengen + `effectDesc` um die zwei neuen
   Ressourcen ergänzen, z. B. „… / 3 Metamaterial / 2 Singularitätskerne je Stufe". Die zugehörige
   Prestige-Erhalt-Logik (feste Mengen-Tabelle) mit beiden Keys füttern.
2. **Produktions-Hooks** für die zwei Effizienz-Effekte (Durchsatz ×, Input −) an genau je einer Stelle
   in der Tier-2-Tick-Berechnung.
3. **HELP_SECTIONS**: der große Tier-2-Hilfetext bekommt einen Absatz zur Synthese-Kette + Effizienz;
   die Markt-Sektion bleibt unberührt (Tier-2 weiterhin nicht handelbar).
4. **TUTORIAL_STEPS**: nur falls ein Schritt „Tier-2" erklärt — Zahl „5 Ketten" ggf. neutral formulieren.

---

## 13. Balance-Gesamtbild

- Zwei Apex-Ressourcen mit 0,0004 / 0,0003 pro Stufe und je **zwei** knappen Vorstufen ⇒ effektiv nur im
  echten Endgame in Stückzahl verfügbar; kann Fabriken **nie ersetzen**, nur krönen.
- Verteidigung wächst 340/380 in die **gedeckelte** Bonus-Gruppe (kein Aufschaukeln).
- Neue Schiffe schließen die Lücke nach dem Fusionsdreadnought bzw. setzen einen Angriffs-Gipfel (280) —
  weiterhin unter/nahe Superschlachtschiff, damit keine „ein Schiff schlägt alles"-Dominanz entsteht.
- Effizienz-Forschung/-Gebäude sind **hart gedeckelt** (+30 % Durchsatz, −20 % Verbrauch), rein linear,
  kein Perpetuum-Mobile.

---

## 14. Implementierungsreihenfolge (mehrphasig, je Phase getestet & ausgeliefert)

- **Phase A** – Kernkette: 2 Ressourcen (`TIER2_DEFS`) + 2 Fabriken + 2 Forschungen (`rmetamaterial`,
  `rsingularitaet`). Fabrik-Mini-Icons. Test: Syntax, `check-icons.js`, JSDOM-Boot+Tab-Sweep mit Spielstand,
  in dem beide Fabriken freigeschaltet & gebaut sind (Produktion, Badge, Lagerdeckel). Version + Patchnotes.
- **Phase B** – Verteidigung + Nutzgebäude (Panzerwall, Geschützturm, Gravitations-Stabilisator) inkl.
  Input-Spar-Hook. Test: Verteidigungssumme kein `NaN`, Effekt sichtbar.
- **Phase C** – Effizienz-Forschung `rraffinerieoptimierung` + Durchsatz-Hook. Test: Rate skaliert korrekt & gedeckelt.
- **Phase D** – Schiffe (Titan, Vernichter) + `SHIP_HULL_DEFS`-Icons + Modul-Klasse + 2 Module. Test:
  Schiffe erscheinen, kein „undefined", check-icons grün.
- **Phase E** – Verbrauchsgegenstände + Erfolge + `ACH_CAT` + Kryo-Archiv-Erweiterung + HELP_SECTIONS.
  Test: voller Durchlauf.

**Backend:** kein Muss. Tier-2 wird client-seitig produziert und ist nicht handelbar; Bestenliste/Spionage
sind unberührt. Nur falls später ein Server-relevanter Verbraucher dazukommt, nachziehen.

---

## 15. Fallstricke-Checkliste (aus CLAUDE.md, vor jedem Commit)

- [ ] `TIER2_DEFS`-Reihenfolge: Metamaterial nach HEK/Fusionskerne, Singularität nach KI-/Fusionskerne. ✓ im Konzept
- [ ] `category:'defense'` → `defVal`/`atkVal` gesetzt (Panzerwall atkVal:0!).
- [ ] Icon-Whitelist: verwendete `ti-*` sind whitelisted — geprüft: `ti-atom`, `ti-atom-2`, `ti-infinity`,
      `ti-shield-lock`, `ti-bolt`, `ti-building-factory-2`, `ti-building-fortress` sind alle im Font.
- [ ] Neue Fabriken/Schiffe: Mini-Icon-Eintrag vorhanden (check-icons prüft 1:1-Abdeckung).
- [ ] Keine doppelten Funktions-/Key-Namen; kein doppeltes Komma in Arrays.
- [ ] `node -e` Syntax-Check + `node check-icons.js` + JSDOM-Boot+Tab-Sweep.
- [ ] VERSION erhöht, neuer PATCHNOTES-Eintrag, HELP_SECTIONS aktualisiert.
- [ ] `cp weltraum_kolonie.html index.html` (beide Dateien identisch).
