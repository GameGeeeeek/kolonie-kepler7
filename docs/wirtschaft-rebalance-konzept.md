# Konzept: Wirtschafts-Rebalance — „Senken statt Quellen", der große Durchgang

**Stand:** 17.08.2026 · **Auslöser:** Spieler-Report Sascha — „mich nervt, dass man so ultra
viele Ressourcen bekommt; die Ausgaben sind sehr gering, wenn man Verteidigung und Schiffe
anschaut; für T2 und T3 gibt es zu wenig Abnehmer, auch für Protomaterie brauchen wir mehr
Abnehmer."

**Messgrundlage:** Saschas Live-Konto (Screenshot 17.08.2026) plus neun parallele
Code-Durchgänge über `weltraum_kolonie.html` (v8.545.0) und `server.js`. Jede Zahl in diesem
Dokument ist am Code nachgerechnet, nicht geschätzt; Zeilennummern beziehen sich auf v8.545.0.
Nach Regel 41 gilt trotzdem: **Jede Zahl hier ist ein Startpunkt, kein Ergebnis** — vor jeder
Umsetzung wird sie am dann aktuellen Stand erneut gemessen.

Dieses Konzept ist die Fortsetzung des Kurses, den `docs/tier3-protomaterie-konzept.md` und
die Auslieferungen v8.486–v8.537 eingeschlagen haben (Minen-Deckel, T2-Senken, Tier 3,
Protomaterie). Es erfindet die Richtung nicht neu — es schließt die Lücken, die die Messung
noch zeigt.

---

## 0. Der Befund, gemessen

### 0.1 Die Einnahmenseite (Live-Konto)

| Ressource | je Stunde | je Tag | Bestand in Einnahme |
|---|---:|---:|---:|
| Energie | 22,68 M | 544,3 M | 1,2 h |
| Erz | 6,12 M | 146,9 M | 0,32 h |
| Kristalle | 979 k | 23,5 M | 0,31 h |
| Deuterium | 884 k | 21,2 M | 5,9 h |
| Antimaterie | 276 k | 6,6 M | 2,1 d |
| Forschungspunkte | 167 k | 4,0 M | 9,0 d |

Die Basisraten der Gebäude machen davon nur noch ~2,5–3 % aus; der Rest ist ein
Multiplikatoren-Stapel von real ×15 bis ×40 über ~12 Standorte. Die Deckel-Architektur
(maxLevel 25 / flachAb 15 seit v8.486.0, additive Gruppe mit `PROD_BONUS_CAP` 1.0) bremst
Basis und Bonusgruppe — aber **vier Faktoren stehen bewusst außerhalb jedes Deckels** und
multiplizieren sich gegenseitig: Module je Standort (bis +90 %, Z. 21879), Ewigkeitsforschung
(Z. 21942), Abgrundtiefe (Z. 21948), Happy Hour (Z. 21791). Und **zwei Produktionsgebäude
haben gar kein maxLevel**: die Bergungswerft (0,9 Erz/s je Stufe = 4× Mine, Z. 5041) und der
Urmateriereaktor (2,4 Energie/s je Stufe = 8× Solar, Z. 5047) — der T1-Deckel von v8.486/8.506
greift bei ihnen nie.

Die Forschungspunkte zeigen, dass die Architektur funktionieren KANN: Sie sind bewusst von
metaMult und globalBonus ausgenommen (Kommentar v8.12, Z. 21912) und das Modell trifft die
gemessenen +46,4/s fast exakt. Den fünf Rohstoffen fehlt genau diese Ausklammerung.

### 0.2 Die Ausgabenseite — in Stunden und Tagen Einnahme

| Senke | Volumen | entspricht |
|---|---|---|
| ALLE 26 gedeckelten Gebäude maxen, × 11 Standorte | 1,52 Mrd Erz / 1,1 Mrd Kristalle | 10,4 d Erz / **47 d Kristalle** |
| Kompletter Forschungsbaum (48 Techs, alle Stufen) | 5,1 M Erz / 873 k FP | **0,83 h Erz / 5,2 h FP** |
| Komplette Endgame-Flotte (1.000 Jäger, 500 Kreuzer, 100 Schlachtschiffe, 20 Superschlachtschiffe, 1 Mondzerstörer) | 300 k Erz / 104 k Kristalle | **6,4 MINUTEN** (Engpass Kristalle) |
| Voller Verteidigungsgürtel St. 10, T1-Anteil, je Planet | 2,89 M Erz / 1,61 M Kristalle | 0,47 h / 1,65 h |
| Mega-Ausbaustufe 10 (Dyson, ×2,6 je Stufe, ×3,5 Empire) | ~660 M Kristalle | 28,3 d — die einzige mitwachsende Senke, **aber über dem Lagerdeckel 497 M: real endet sie bei Stufe 9 (Lagerwand)** |
| Energie: alle Baukosten, 11 Standorte | ~15 M | **40 Minuten**. Kein nennenswerter laufender Verbrauch (T2-Ketten-Inputs: ungedrosselt ~0,1 % der Tageseinnahme, im Lager-voll-Gleichgewicht nur der Abfluss-Ausgleich ≈ 0). |

Leerlauf-Reihenfolge (wo hören die Abnehmer auf): **Energie sofort → FP nach ~1 Woche →
Antimaterie → Deuterium → Erz → Kristalle zuletzt**. Kristalle sind der Engpass fast jeder
Endlos-Senke (Ewigkeitsforschung, Mega-Stufen) — konsistent damit, dass Erz- und
Kristall-Bestand des Live-Kontos bei nur ~19 Minuten Einnahme liegen (alles wird sofort
verbaut oder verkauft), während Energie, Antimaterie und FP sich stauen.

### 0.3 Militär: warum „Ausgaben sehr gering" exakt stimmt

1. **`scaledShipCost` deckelt hart bei 2×** (Z. 19668–19676): `1 + min(1.0, n·0.004)` — ab dem
   250. Schiff einer Klasse kostet jedes weitere für immer das Doppelte des FRÜHSPIEL-Basispreises.
   Gebäude und Forschung wachsen geometrisch, Schiffe als einzige Großausgabe nicht.
2. **Verluste sind fast vollständig erstattet:** Trümmerfeld = verlorenes Score-Gewicht × 8,
   davon 60 % Erz + 30 % Kristalle, am eigenen Planeten (Z. 49716). Beispiel 15 %-Verlust der
   großen Flotte: Nachbau <1 Minute Einnahme, Trümmer erstatten 55 % Erz / 86 % Kristalle —
   netto kostet die Schlacht ~20 Sekunden. Ein gut verteidigtes Konto wehrt NPC-Überfälle
   fast immer ab und macht dabei GEWINN (Trümmer des Angreifers).
3. **Es gibt keinerlei laufende Militärkosten:** kein Unterhalt, kein Sold; Treibstoff wächst
   nur mit der Wurzel der Flottengröße (1-h-Mission mit 1.000 Schiffen = 3,7 Minuten
   Deuterium-Einnahme). Die einzigen zeitgetakteten Fixkosten außerhalb der
   Verarbeitungsketten sind 2 Erz/Frachter/Minute der Kredit-Route; daneben nur
   aktivitätsgebundene Posten (Aufbereitung 12 Energie je Zusatzeinheit, Kleinst-Verbräuche
   der Automatiken).
4. Die zwei Stellen, an denen Militär WIRKLICH kostet, sind beide Tier-2-gebunden und beweisen,
   dass T2-Preise tragen: die T2-Verteidigungsgebäude (Schildkuppel St. 10 ≈ 2.443 HEK —
   252 h der aktuell GEMESSENEN HEK-Rate, immerhin 3,7 h der ungedrosselten Kette) und die
   Werftmarken (Superschlachtschiff Mk II→X u. a. 1.656 HEK — größter existierender
   Militär-Sink, aber einmalig je Klasse).

### 0.4 Tier 2: das Lager-voll-Gleichgewicht, bewiesen

Alle fünf Grundketten des Live-Kontos stehen auf „Lager voll". Die gemessenen Raten sind
exakt der Verbrauch der jeweils NÄCHSTEN Kettenstufe (Rechnung mit gravInputMult 0,8 trifft
vier der fünf Messwerte auf ±3 %, HEK auf ±7 % — Rundung der Messwerte): Das Konto produziert netto **nur Singularitätskerne (639/Tag)
und eine Spur Hohlraumgitter** — die fünf Grundketten sind reiner Durchlauferhitzer. `tier2Step`
bucht bei vollem Lager auch die **Eingangsstoffe nicht mehr ab** (Z. 22298, Bugfix v8.117.0);
weil die Folgeketten laufend Platz freiräumen, laufen die Grundketten aber in genau dieser Höhe
weiter und ziehen dabei T1 nach — **netto ~0,4 Erz/s und ~0,5 Kristalle/s, unter 0,5 % der
Einnahme** (Präzisierung nach Review-Hinweis am PR: „exakt 0" wäre falsch — ohne jeden Abfluss
stünde die Schicht komplett still, mit Abfluss konsumiert sie exakt den Abfluss).

Dem Produktionspotenzial (rekonstruiert aus den Lagerständen: 188 Nano- / 130 Chip- /
122 HEK- / 57 FK- / 40 KI-Fabrikstufen imperiumsweit) steht das GESAMTVOLUMEN aller
Einmal-Abnehmer gegenüber — alle 44 markierbaren Klassen (43 `SHIP_DEFS` + Superschlachtschiff)
auf Mk X, alle Forschungen, T2-Verteidigung St. 10 und alle T2-Gebäude auf 17 Kolonien,
Mega-Stufen bis 10 (Obergrenzen ohne Bauplan-Rabatt):

| Kette | Produktion/Tag (ungedrosselt) | Einmal-Abnehmer GESAMT | Vollausbau in Tagen |
|---|---:|---:|---:|
| Nanolegierungen | 97.459 | ~414 k | **4,2** |
| Quantenchips | 22.464 | ~129 k | **5,7** |
| Hochenergiekristalle | 15.812 | ~203 k (davon Kryolager ~108 k) | **12,8** |
| Fusionskerne | 3.940 | ~52 k | **13,3** |
| KI-Kerne | 1.728 | ~35 k | **20,5** |

Der maximal denkbare Komplettausbau ist also 4–20 Tage Produktion; realistisch eher 1–4 Tage.
Wiederkehrend bleiben danach nur Kleinstbeträge (Quantensensor 10 Chips/30 min, Automatiken
3 KI-Kerne je Einsatz, sporadisch HEK). Die Klage ist damit belegt — und wichtig für den Plan:
**T2-Abnehmer lösen die T1-Schwemme NICHT mit.** Selbst alle Ketten auf Vollast fräßen nur
0,1–6,4 % der T1-Einnahme. T1 braucht eigene Senken.

### 0.5 Tier 3: funktioniert heute — kippt beim Ausbau

Tier 3 wurde als einzige Kette mit fertigen Abnehmern ausgeliefert (Kausalitätsbrecher,
Urmaterie-Schmiede, Orbitalstufen 6–7) und funktioniert, **weil die Weberei des Live-Kontos
auf Gesamtstufe ~1 steht** (+26 Gitter/Tag; alle Einmal-Abnehmer = ~10 Tage). Der Ausbaupfad
ist aber Faktor ~165 (15 Stufen × 11 Standorte; theoretisch bis 15 Standorte = ~225): Danach
sind die Einmal-Abnehmer in Stunden
bezahlt und das T2-Muster wiederholt sich eine Etage höher. Zwei Nebenbefunde:

- **Singularitätskerne sind die größte Einzellücke:** +639/Tag Zufluss, alle T3-Einmalbedarfe
  zusammen höchstens ~320 Kerne (eine halbe Tagesproduktion), von den Mega-Stufen bewusst ausgenommen
  (Kommentar Z. 44532, Messung von VOR Tier 3), Deckel in ~13 Tagen erreicht.
- Der Kommentar an der Urmaterie-Schmiede („4 Gitter ≈ 14 Stunden bei voll ausgebauter
  Weberei", Z. 25201) überzeichnet die Knappheit um Faktor ~38 — bei St. 15 sind es ~22 Minuten.
  Die Primordial-Kosten fußen auf einer Zahl, die nur für den Erstausbau stimmt.

Strukturell gut: Ein voll ausgebautes Tier 3 KANN aus den Vorketten gar nicht satt werden
(Gitter bräuchte 0,09 Metamaterial/s gegen 0,06/s Produktion; Anker+Kern-Kette 0,18 KI-Kerne/s
gegen 0,075/s). **T3-Betrieb IST der gesuchte T2-Dauerabnehmer** — die Drosselung passiert
heute nur still statt als Planungsgröße.

### 0.6 Protomaterie: alle Senken einmalig

Zufluss (bewusst flugzeitgebunden, fix je Fuhre 0/2/8/25): Gelegenheitsspieler 6–24/Tag,
Dauerbetrieb 264–768/Tag. Bedarf: T3-Fabrikbau ~5.035 je Standort-Paar ohne bzw. ~3.529 mit
maximierten Bauplänen (rbauplan −30 % wirkt auch auf Protomaterie; theoretisch ~35–50 k über
10 Standorte — der mit Abstand größte Abnehmer), Mega-Stufen real nur ~600 (die ×2,6-T1-Kosten
enden am 497-M-Lagerdeckel: Stufe 10 wäre 665 M Kristalle, letzte bezahlbare Stufe ist 9 —
der Proto-Deckel 400 bei Stufe 25 wird nie erreicht). Realistischer Gesamtbedarf bis „alles
bezahlt": **grob 4.000–5.000 Einheiten — dann existiert keine wiederkehrende Senke mehr** und
der 2.500er-Speicher läuft dauerhaft voll.
Dazu ein Farming-Loch: Weil Proto je FUHRE anfällt, ist eine 1-Schürfschiff-Flotte auf einem
Koloss die zeitoptimale Route (~45–60/h je Slot, über der Auslieferungsannahme 11–32/h).

### 0.7 Drei Löcher auf der Quellenseite (am Code verifiziert)

1. **Veredelungsroute ohne Frachter-Deckel** (Z. 15052–15057, 15082–15106): Nur die
   Kredit-Route ist auf 15 Frachter begrenzt; `transport` und `sell` nicht. Kurs
   `energie→erz` 0,96, 60 Einheiten/Frachter/Minute: **1.000 Frachter (Basis 100 Erz + 70
   Energie, mit Mengenskalierung im Schnitt ~188 Erz + ~131 Energie je Stück — einmalig ~188 k
   Erz) wandeln 3,6 M Energie/h in 3,46 M Erz/h um — +56 % auf die Erz-Einnahme aus der
   Ressource, die sonst keine nennenswerte Senke hat.** Auf `erz→kristalle` (0,50) wären es +184 % auf die
   Kristall-Einnahme — der Engpass fast jeder Endlos-Senke, umgangen mit Frühspiel-Schiffen.
2. **Verkaufsroute rechnet am Backend-Markt vorbei** (Z. 15156–15170): Menge unbegrenzt
   (Frachterzahl), Preis = lokaler `marketCache`-Preis × 0,55 — die Slippage des echten
   Marktes (~21.250 Erz drücken den Preis auf den Boden) greift hier nie, und der
   Marktpreis bewegt sich durch Routenverkäufe nicht.
3. **Bergungswerft und Urmateriereaktor ohne maxLevel** (0.1) — die einzigen unbegrenzten
   T1-Gebäudequellen, beide voll im Multiplikatoren-Stapel.

---

## 1. Leitplanken — gelten für jede Etappe

Aus CLAUDE.md, dem Tier-3-Konzept und den Patchnotes; hier ausdrücklich übernommen:

1. **Keine „N Minuten eigene Produktion"-Formeln** (sechs existieren, viermal nachträglich
   gekürzt: Piratennester und Wochenliga je um Faktor 5, Tagesaufgaben um Faktor 6,
   Eisenlegion-Geschenk um Faktor 8 — keine siebte).
2. **Neue kleine Boni gehören in die additiven, gedeckelten Gruppen** — nie als eigener
   Multiplikator. Neue gedeckelte Töpfe rufen `deckelWeich()`; jede neue Aufrufstelle wird in
   die Namensliste von `tests/test_ausbaubarer_deckel.js` eingetragen.
3. **Kein Deckel löscht Bestände.** Einzige zulässige Formen: „Lager voll ⇒ Produktion
   stoppt" (T2) und „Überlauf verfällt MIT Ansage" (Protomaterie). Stufen-Kappungen an
   Bestandsgebäuden nur als ausdrückliche Betreiber-Entscheidung, mit neuer Kappungs-Marke
   (`deckelKappung2026d`, Ablauf in CLAUDE.md).
4. **Niemand wird blockiert:** Bestehendes bleibt baubar wie bisher; neue Kosten treffen nur
   Neues oder Mengen OBERHALB einer Schwelle, die kein normales Konto rückwirkend reißt.
5. **Kein laufender Protomaterie-Verbrauch in skalierenden Fabriken** (Regel 41, gemessen
   verworfen: 162/h Verbrauch gegen 11–32/h Einnahme). Neue Proto-Senken sind einmalig oder
   spielergesteuert je Stück, Einzelposten deutlich unter dem Speicher (bisheriges Maximum
   889 von 2.500), ohne `empireCostFactor`.
6. **Keine T2/T3-Ressourcen am Markt** (getestet und wieder entfernt; Hilfe-Abschnitt
   Z. 37093 verspricht das ausdrücklich).
7. **Anzeigestellen-Pflicht:** Jede Formel-/Schwellenänderung zieht HELP_SECTIONS
   (Z. 36878 ff.: „Produktions-Multiplikatoren", „Ausbaustufen der Mega-Projekte",
   „Grenznutzen bei Mega-Flotten", „Was eine Forschungsstufe kostet" u. a.), TUTORIAL_STEPS
   und die `desc`-Texte mit — erst greppen, dann committen (Hausregel 6; Skill
   `anzeigestellen`).
8. **Backend-Parität:** Alles PvP-Wirksame (Verteidigungswert, Angriffskraft) rechnet der
   Server aus dem gespeicherten Spielstand nach — jede Formeländerung dort braucht die
   server.js-Kopie im selben Zug (Muster: `weicherDeckel` Client Z. 21964 / Server Z. 2404).
   `SAVE_SANITY_LIMITS` (Gebäude 10.000, Ressourcen 1e15, Kredite 1e12) liegen für alles hier
   Geplante weit darüber — Pflichtprüfung bleibt.
9. **Jede Etappe wird einzeln ausgeliefert und einzeln getestet** (Gegenprobe in beide
   Richtungen, Skill `neuer-test`), und **kein Stoff ohne seinen Verbraucher** — die Lehre,
   an der Tier 2 gescheitert ist.

---

## 2. Etappe A — Militärkosten: Flotte und Verteidigung

Das direkteste Stück der Klage, und laut Patchnote-Historie echtes Neuland: Für „Schiffe und
Verteidigung kosten zu wenig" gab es noch nie einen Balance-Eintrag.

### A1 — Mengenskalierung: der 2×-Deckel bekommt einen exponentiellen Schwanz

Heute: `factor = 1 + min(1.0, n·0.004)` (Z. 19672). Vorschlag:

```
n ≤ 250:  unverändert 1 + n·0,004          (Früh-/Mittelspiel exakt wie heute)
n > 250:  2 × 1,002^(n−250)                 (stetig am Übergang, Steigung wächst)
```

| n-tes Schiff | Faktor heute | Faktor neu |
|---:|---:|---:|
| 100 | 1,4 | 1,4 |
| 250 | 2,0 | 2,0 |
| 500 | 2,0 | 3,3 |
| 1.000 | 2,0 | **8,9** |
| 2.000 | 2,0 | **66** |
| 4.000 | 2,0 | ~3.590 (faktische Wand) |

Eine 1.000er-Flotte wird damit erst ~2× teurer als heute — der eigentliche Effekt ist die
**weiche Flottengrößen-Wand um 2.000–4.000 Schiffe je Klasse**, die es heute gar nicht gibt,
und die Multiplikation mit den T2-Komponenten aus A2 (der Faktor wirkt auf ALLE
Kosteneinträge). Nebenwirkung erwünscht: auch Performance- und PvP-Spreizung profitieren.
Kampfverluste senken `n` und machen den Nachbau weiterhin billiger als den Erstkauf.

*Anzeigestellen:* Werft-Kostenvorschau, HELP „Grenznutzen bei Mega-Flotten" (Z. 36975).
*Test:* `test_schiffskosten_schwanz.js` — Formel aus der Datei schneiden und ausführen
(Regel 36: echte Abhängigkeiten mitschneiden), Stetigkeit bei 250 und Monotonie prüfen;
Gegenprobe am alten Stand (Faktor 1.000stes Schiff = 2,0).

### A2 — T2-Komponenten ab Stückzahl-Schwelle (Massenflotten zahlen in der knappen Währung)

Bestehende T1-Kampfschiffe bekommen ab einer KLASSENWEITEN Stückzahl-Schwelle eine
T2-Komponente in die Baukosten — unterhalb der Schwelle ändert sich exakt nichts
(Leitplanke 4). Startpunkte:

| Klasse | ab Schiff | Komponente je Schiff |
|---|---:|---|
| Kreuzer, Wächter | 250 | 2 Nanolegierungen |
| Zerstörer, Bomber | 200 | 3 Nanolegierungen |
| Schlachtschiff, Carrier | 100 | 8 Nano + 2 Quantenchips |
| Leerenjäger | 50 | 10 Nano + 2 HEK |
| Superschlachtschiff | 25 | 30 Nano + 10 Chips + 2 HEK |
| Jäger, Erkundung, Frachter | — | keine (Frühspiel/zivil) |

Nachgerechnet (Summe über die Schiffe 100–999 mit A1-Faktoren): 1.000 Schlachtschiffe ≈
**30 k Nano — rund 7 Tage der heute gemessenen bzw. gut 7 Stunden der ungedrosselten
Kettenproduktion** (heute: 0). Zusammen mit A1 ist eine Massenflotte damit erstmals
eine Wirtschaftsentscheidung. Die T2-Ketten bekommen genau den wiederkehrenden,
mit der Aktivität skalierenden Abnehmer, der ihnen fehlt — und der beim Wiederaufbau nach
Verlusten automatisch nachfragt.

*Zu entscheiden (Abschnitt 8):* Oberhalb der Schwelle braucht der Massenbau die jeweilige
T2-Kette — ein Konto ganz ohne Nanotech kann dann nicht mehr 1.000 Kreuzer stapeln. Das ist
der Sinn der Maßnahme, aber es ist eine Härte, die es bisher nicht gab.
*Anzeigestellen:* Werft-Kostenvorschau (Komponente sichtbar VOR der Schwelle ankündigen),
Schiffs-`desc`, HELP „Schiffsbau beschleunigen (Tier-2)".
*Test:* Kauf unter/über Schwelle, Kostenvorschau = tatsächliche Abbuchung, Gegenprobe alt.

### A3 — Verluste real machen: Trümmer-Rückfluss senken

Heute: verlorenes Score-Gewicht × 8, davon 60 % Erz / 30 % Kristalle — **an ZWEI Rechenstellen**
(`applyCombatLosses` Z. 49716 UND Allianzbasis-Solo-Angriff Z. 40557; beide ändern, sonst
entsteht die „zweite Anzeigestelle mit der alten Annahme", Hausregel 6) — 55–86 % Erstattung.
Vorschlag: **× 8 → × 3, Aufteilung unverändert** → Erstattung sinkt auf ~21 % Erz
/ ~32 % Kristalle. Verluste bleiben gedämpft (Rückzugsmechanik unangetastet), aber eine
verlorene Schlacht kostet wieder etwas, und der Wiederaufbau läuft durch A1/A2.

*Nebenwirkung, bewusst:* Auch die Trümmer ABGEWEHRTER Überfälle schrumpfen — NPC-Raids sind
heute netto eine Einnahmequelle; das gehört mit abgestellt, ist aber spürbar (Abschnitt 8).
*Backend:* Trümmerfeld entsteht clientseitig; PvP-Server-Anteile prüfen (`SHIP_SCORE_WEIGHTS`
hat eine Backend-Kopie für den Score — die Trümmer-Konstante selbst ist Frontend).
*Anzeigestellen:* Kampfbericht-Trümmerzeile, HELP „Kampf", Recycler-Texte.

### A4 — Schildnetz: Verteidigung bekommt laufende Energiekosten

Die eine strukturell fehlende Mechanik: **laufende Kosten**. Energie ist dafür die richtige
Währung — sie hat KEINE Senke (0.2), und das Spiel hat ihr die Rolle „Betriebsstoff" schon
gegeben (Aufbereitungsanlage, v8.485.0, Patchnote-Kommentar Z. 7331).

Mechanik (bewusst offline-sicher):

- Jede Verteidigungsgebäude-Stufe zieht eine feste **Energie-Last je Sekunde von der
  PRODUKTIONSRATE ab** (nie vom Lagerbestand — kein Offline-Todesfall, kein Bestandsfressen;
  Netto-Rate hat Boden 0). Startwerte: **1,0 Energie/s je T1-Stufe, 2,0 je T2-Stufe.**
- Deckt die Energieproduktion die Last nicht (Deckung < 100 %), sinkt der wirksame
  Verteidigungswert weich: `defWirksam = defVal × (0,7 + 0,3 × Deckung)` — maximal −30 %,
  kein Totalausfall.
- Anzeige: Energie-Karte bekommt eine Zeile „davon Schildnetz −N/s", der Verteidigungs-Tab
  den Deckungsgrad. Drei Zustände, keine stille Drossel (Regel 35 sinngemäß).

Größenordnung am Live-Konto (vor Auslieferung EXAKT messen, Skript: Summe aller
Verteidigungsstufen × Satz ÷ 6.300/s): grob 180 Stufen je Planet × 11 Standorte ≈ 2.000/s ≈
**~30 % der Energieproduktion**. Wer Verteidigung stapelt, muss erstmals Solar/Reaktoren
mitziehen — Verteidigung UND Energie bekommen gleichzeitig ihre fehlende Ökonomie.

*Backend-Parität PFLICHT:* Der Server rechnet den PvP-Verteidigungswert aus dem Spielstand
nach — der Deckungsfaktor braucht die server.js-Kopie im selben Zug (Muster `deckelWeich`),
sonst weichen Vorschau und Kampfergebnis ab.
*Anzeigestellen:* Energie-Karte, Verteidigungs-Tab, HELP „Verteidigung" + neue Sektion
„Schildnetz", `effectDesc` der Verteidigungsgebäude, Angriffs-/Bedrohungs-Vorschauen (Hausregel
6 — genau der Fehlertyp der PvP-Vorschau von v8.295.0).
*Test:* Parität Client/Server (Muster `test_pvp_deckel`), Deckung 0/50/100 %, eingefrorene
Uhr (Regel 18), Gegenprobe alt (kein Abzug).

---

## 3. Etappe B — Tier 2: wiederkehrende Abnehmer statt Einmal-Listen

A2 ist bereits der größte neue T2-Abnehmer. Dazu:

### B1 — Gefechtsvorräte (spielergesteuert, wiederkehrend)

Das Muster existiert schon dreifach (Sprungladung 3 Kerne, Mondbelagerung 25 HEK/Schuss,
Automatiken 3 KI-Kerne/Einsatz) — es fehlt nur die Breite. Je Angriff/Verteidigung optional
EIN Vorrat, Wirkung in die additiven, gedeckelten Kampf-Gruppen (Leitplanke 2):

| Vorrat | Kosten je Einsatz | Wirkung (additiv, gedeckelt) |
|---|---|---|
| Nano-Gefechtsköpfe | 40 Nanolegierungen | +8 % Angriff für diesen Kampf |
| Schildkondensatoren | 25 Hochenergiekristalle | +8 % Verteidigung für diesen Kampf |
| Zielrechner-Overlay | 15 Quantenchips | +10 % Trefferphase 1 (Vorschau zeigt es) |

Bei 10 Kämpfen/Tag ≈ 400 Nano/Tag — ~10 % der heute gemessenen Tagesproduktion, komplett
freiwillig, skaliert mit Aktivität statt mit Kontogröße. Bewusst als Startpunkt; wer die
Senke größer will, hebt die Einsatzkosten, nicht die Wirkung.
*Achtung Anzeigestellen:* Angriffs-VORSCHAU und Kampfbericht müssen den Vorrat ausweisen;
PvP braucht die Server-Seite (der Server rechnet Angriffskraft nach — Vorrat muss als Teil
des Angriffs-Requests validiert werden, Bestand serverseitig gegen den Spielstand geprüft).

### B2 — Mega-Ausbaustufen: T2-Anteil verdreifachen — und von der Empire-Skalierung ausnehmen

Der T2-Anteil (Z. 44535: linear, `t2Cost × (Stufe−1)`) bleibt linear, der Koeffizient wird ×3:
Dyson 1.800 Nano + 750 HEK je Stufe, Void 1.500 Nano + 600 FK, Nexus 1.050 Chips + 450 KI.

**Zwingende Begleitänderung (Fund der Verifikation):** `buildMegaProject` skaliert die
Stufenkosten heute INKLUSIVE des T2-Anteils mit `scaleCostByEmpire` (Z. 44608; nur Protomaterie
ist ausgenommen, Z. 25792 ff.). Mit ×3 und Empire-Faktor 3,5 kostete Stufe 8 real 44,1 k Nano —
ÜBER dem Lagerdeckel 41,9 k, also nicht teuer, sondern unbezahlbar (exakt die Falle aus dem
Proto-Kommentar Z. 44558). Deshalb: **T2-Anteil von der Empire-Skalierung ausnehmen, wie
Protomaterie.** Dann kostet Stufe 8 planbare 12,6 k Nano + 5,25 k HEK — Tage statt Minuten
Kettenproduktion, unabhängig von der Kolonienzahl. Zusätzlich steigt der Anteil nur bis
**Stufe 20** (34,2 k Nano) und bleibt danach konstant — die Design-Begründung „muss unters
Lager passen" (Z. 44527 ff.) gilt damit auch für die Stufen, die B4 erreichbar macht.

**Singularitätskerne** kommen in die Nexus-Stufen — aber **ab Stufe 4 und flach 200 je Stufe**,
nicht ab Stufe 2 mit steigendem Satz (Korrektur nach Review-Hinweis am PR: Ein gültiges
Minimal-Konto hat mit Reaktor-Stufe 1 nur 32 Kerne Lagerdeckel — 300 ab Stufe 2 wäre nicht
teuer, sondern unerreichbar, exakt die Lagerwand, die dieses Konzept vermeidet). Die 200 sind
bewusst die Kapazität EINER voll ausgebauten Reaktor-Kette (20 + 15×12 = 200) — dieselbe
„eine Vollfabrik"-Messlatte, mit der die Orbital-T3-Kosten kalibriert wurden (Z. 44785).
Die Ausnahme-Begründung („einzige nicht-volle Kette", Z. 44532) stammt von VOR Tier 3 — heute
läuft auch dieses Lager in ~13 Tagen voll, und alle T3-Bedarfe zusammen sind eine halbe
Tagesproduktion (0.5). Wer das Kausalanker-Werk baut, hat den Dauerabnehmer; wer nicht,
braucht diese Senke.

### B3 — Bastionsmarken: die Werftmarken-Idee für Verteidigungsgebäude

Die Werftmarken sind der größte funktionierende Militär-Sink (0.3) — Verteidigungsgebäude
haben kein Gegenstück. Je Verteidigungsgebäude-TYP eine Marken-Reihe Mk II–X nach exakt dem
Schiffs-Muster (Kostenfaktor aus `defVal` statt `buildTime`, T2-Staffel ab Mk V wie
`SHIP_MARK_COST_BASE`, Wirkung +3 % defVal je Marke auf den Typ). Über 18 Gebäudetypen
entsteht ein Einmal-Volumen in der Größenordnung der Schiffsmarken (~100 k+
Nano-Äquivalent) plus laufende Energie-Last über A4 auf das, was man sich damit stärker macht.

*Wichtig:* Wirkt auf `defVal` — Backend-Parität wie A4; und `category:'defense'`-Falle
beachten (`defVal`/`atkVal` explizit, sonst NaN).

### B4 — Baustellen-Konto: die Lagerwand fällt, die Endlos-Senke wird real endlos

`docs/content-ideen.md` 2.5 beschreibt die Wand: Mega-Stufen ab ~11 und späte Forschungen
kosten mehr, als das Lager fasst — die einzige exponentiell mitwachsende Senke endet daran,
nicht am Preis. Das dort skizzierte **Baustellen-Konto** (Warteschlangen-Einträge bekommen
`eingezahlt:{res:menge}`, ein Anteil der laufenden Produktion fließt direkt in den Auftrag
statt ins Lager) löst gleich zwei Befunde: Die hohen Mega-Stufen werden erreichbar und
ziehen dann ihren linearen T2-/Proto-Anteil weiter (das Konto muss deshalb ausdrücklich auch
T2-Ressourcen einzahlen können, siehe B2); überschüssige Produktion bekommt ein Ziel, ohne dass
irgendein Deckel angefasst wird. Das ist die größte Einzelbaustelle des Plans —
eigene Etappe, eigenes Konzeptdokument vor der Umsetzung.

**KORREKTUR 18.08.2026 — die Wand steht viel weiter innen, als hier stand.** Der Satz lautete
ursprünglich „die Lagerwand steht real schon bei Stufe 10 (0.6)". Nachgerechnet gegen den
GEMESSENEN Lagerdeckel (803.800 bei ambitioniertem Endausbau, CLAUDE.md Hausregel 57) steht sie
beim Dysonschwarm bei **Stufe 4** für ein Ein-Standort-Konto und bei **Stufe 3** für elf
Standorte — `megaStageCost` wächst mit 2,6 je Stufe und wird danach noch mit
`empireCostFactor` (1 + 0,25 je Kolonie) multipliziert. Stufe 10 läge bei 271 Mio Erz und ist
mit keiner denkbaren Frachterflotte lagerbar.
Zwei Folgen: (a) B4 öffnet nicht „die Stufen 10+", sondern **die Stufen ab 3** — der Nutzen ist
also deutlich größer als hier behauptet; (b) der `empireCostFactor` skaliert die KOSTEN mit dem
Imperium, während der Lagerdeckel nur mit Gebäuden und Frachtern wächst — **wer expandiert,
schiebt seine eigene Wand nach innen.** Vollständige Tabelle und Herleitung in
`docs/baustellen-konto-konzept.md` Abschnitt 2.2. Hausregel 41: ein Konzept ist kein Messergebnis,
auch wenn es aus derselben Feder stammt.

---

## 4. Etappe C — Tier 3: den T2-Fehler nicht wiederholen

1. **Progressive Primordial-Kosten:** `PRIMORDIAL_CRAFT_COST` (4 Gitter + 3 Anker, Z. 25205)
   wird progressiv: +1 Gitter je 2 bereits gefertigte, +1 Anker je 3, Deckel 12/9. Damit
   bleibt „ein Modul ist ein Projekt" auch nach dem Fabrikausbau wahr — heute gilt der
   Schmiede-Kommentar nur für Weberei-Stufe 1 (0.5). Bestehende Module bleiben unberührt
   (Leitplanke 3/4).
2. **Auslastungs-Anzeige der Ketten:** Die stille Drossel („Kette läuft auf 40 %, es fehlt
   KI-Kerne") wird auf der Ketten-Karte sichtbar — T3-Betrieb als T2-Sog wird damit zur
   Planungsgröße statt zum unsichtbaren Zufall. Reine Anzeige, kein Balance-Eingriff.
3. **Schmiede-Kommentar korrigieren** (Faktor-38-Diskrepanz) — Dokumentations-Fix, damit die
   nächste Balance-Entscheidung nicht wieder auf der falschen Zahl fußt.
4. Der Kausalitätsbrecher bleibt der Vorzeige-Dauerabnehmer; nach A1 bekommt auch er den
   exponentiellen Schwanz (6 Gitter × Faktor — eine 100er-Brecher-Flotte wird real teuer).

---

## 5. Etappe D — Protomaterie: Abnehmer für die Zeit NACH dem Erstausbau

Verträglichkeits-Regeln aus 0.6/Leitplanke 5: einmalig oder je Stück, unter dem Speicher,
nicht empire-skaliert, kein Laufverbrauch.

1. **Speicher zuerst:** `PROTOMATERIE_LAGER_JE_AUFBEREITUNG` 100 → 150 (Deckel 2.500 → 3.500).
   Jede weitere Senke hängt daran (dokumentierte Abhängigkeit aus Konzept-Abschnitt 8.4).
2. **Mega-Proto-Deckel mitziehen:** `MEGA_PROTO_MAX` 400 → 600 — die Stufen 26+ tragen dann
   weiter (mit B4 überhaupt erst erreichbar).
3. **Orbitalstation Stufe 8** (einmalig je Standort): 12 Gitter + 10 Anker + **60 Protomaterie**
   — verlängert die bestehende Leiter (Z. 44789) um die erste direkte Proto-Stufe.
4. **Neues Apex-Schiff mit direktem Proto-Anteil** — der im Tier-3-Konzept (Abschnitt 8.2)
   ausdrücklich offengehaltene Weg „als NEUES Schiff, nicht als Umbau": Arbeitstitel
   **Urmaterie-Koloss**, Kosten je Schiff 30 Protomaterie + 8 Gitter + 6 Anker, Rolle:
   Belagerung/Transport-Hybrid (kein reiner Statwert-Überflieger; Aura-Deckel-Muster der
   Titanen). Wiederkehrend, spielergesteuert, und über A1 mengengebremst. (Hausregel 7:
   eigenes Icon + vollständige `desc` von Anfang an.)
5. **Farming-Loch schließen:** Proto je Fuhre × `min(1, Schürfschiffe/10)` — volle Ausbeute
   erst ab 10 Schürfschiffen, KEINE Skalierung darüber (der fixe Fuhren-Charakter bleibt).
   Trifft nur die 1-Schiff-Pendelroute, keinen normalen Abbau.

Nachgerechnet, mit offengelegter Herleitung: Orbital St. 8 = 60 × 11 = **660 sofort**; die
Mega-Deckel-Anhebung (Posten 2) trägt erst zusammen mit B4 (Stufen 26–35: bis ~3.300 über
alle drei Projekte); der Urmaterie-Koloss ist nach oben offen (30 je Schiff). Zusammen also
**~700 sofort, bis ~4.000 mit B4-Fortschritt**, plus der offene Schiffs-Abnehmer — zusammen
mit dem T3-Fabrikausbau trägt der Bergbau damit Monate statt zwei Wochen, ohne dass je ein
Laufverbrauch entsteht.

---

## 6. Etappe E — Quellenseite: Löcher schließen, kein Flächen-Nerf

Die Entscheidung vom 16.08. („Kein Anfassen der Basisproduktion — Wegnehmen ärgert
Bestandsspieler mehr, als fehlende Verwendung sie langweilt") bleibt stehen. Diese Etappe
schließt nur die drei Löcher aus 0.7, die am regulären Deckelwerk vorbeilaufen:

1. **Veredelungs- und Verkaufsroute deckeln:** max. 15 Frachter je Route und max. 1 Route je
   Umwandlungspaar bzw. Verkaufsressource (Konsistenz: die Kredit-Route hat den 15er-Deckel
   seit v7.89 aus exakt demselben Grund — „Perpetuum mobile"). Damit bleibt die Veredelung
   ein Komfort (900 Einheiten/min statt unbegrenzt), kein zweiter Produktionszweig.
2. **Verkaufsroute ehrlich bepreisen:** Preis = `min(marketCache-Preis, Basispreis)` × 0,55 —
   die Route kann den slippagefreien Cache-Preis nicht mehr über den Basispreis hinaus
   ausnutzen. (Langfristig sauberer: serverseitige Abrechnung; wegen des 240-Anfragen/Minute-
   Limits nicht je Routen-Tick, sondern gebündelt — eigener Entwurf, nicht Teil dieser Etappe.)
3. **Bergungswerft maxLevel 15, Urmateriereaktor maxLevel 10** — als reine Deckel OHNE
   flachAb (ein Deckel senkt keine vorhandene Rate, Abflachung schon — dieselbe Begründung
   wie beim Labor v8.537.0). Bestandsstufen darüber: Kappung nur als Betreiber-Entscheidung,
   dann mit Marke `deckelKappung2026d` nach dem dokumentierten Ablauf (CLAUDE.md, inkl.
   Reset-Bewahrlisten und `test_t1_deckel`-Abstreifliste).
4. **Beobachtung, bewusst NICHT in diesem Plan:** die vier Multiplikatoren außerhalb der
   Deckel (Module je Standort, Ewigkeitsforschung, Abgrundtiefe, Happy Hour) und die
   Kreditschwemme (Markt-Verkauf ~156 M Kr/Tag möglich gegen einen Credit-Shop mit
   400–75.000-Kr-Posten). Beides sind eigene Entscheidungen mit Bestands-Nerf-Charakter
   bzw. eigenem Konzeptbedarf — Abschnitt 8 fragt sie ab, Etappe E setzt sie nicht um.

---

## 7. Was NICHT gemacht wird

- **Kein flächiger Produktions-Nerf** und keine Senkung von Basisraten (Entscheidung 16.08.).
  Die Schwemme wird über Senken (A/B/D) und Löcher (E) angegangen.
- **Kein Unterhalt, der Lagerbestände frisst.** Das Schildnetz (A4) wirkt ausschließlich auf
  die Produktionsrate — offline kann nichts ins Minus laufen, nichts wird abgeschaltet.
- **Kein laufender Protomaterie-Verbrauch** (Regel 41) und **kein T2/T3 am Markt**.
- **Keine „N Minuten Produktion"-Belohnungen** — auch nicht als Ausgleich für neue Kosten.
- **Kein Wochenpass-artiges Belohnungssystem** als Senken-Ersatz (client-autoritative
  Bedingungen, siehe CLAUDE.md „Der Wochenpass wurde bewusst NICHT gebaut").
- **Keine gleichzeitige Auslieferung mehrerer Etappen.** Jede Etappe einzeln: bauen, messen,
  Prüflauf, Patchnote — erst dann die nächste (Ablauf aus CLAUDE.md Regel 23).

---

## 8. Offene Entscheidungen für Sascha

1. **A2-Härte:** T2-Komponenten ab Stückzahl-Schwelle heißt: Massenbau oberhalb der Schwelle
   braucht die jeweilige Kette. Schwellen (250/200/100/50/25) und Mengen okay — oder höher
   ansetzen/weicher einsteigen?
2. **A3-Nebenwirkung:** Trümmer ×8 → ×3 macht auch abgewehrte NPC-Überfälle unlukrativer
   (heute Netto-Einnahmequelle). Gewollt — oder Abwehr-Trümmer getrennt behandeln?
3. **A4-Zielband:** Wie viel Energieproduktion soll ein voll verteidigtes Konto ins
   Schildnetz stecken? Vorschlag 25–40 %; die Sätze (1,0/2,0 je Stufe) werden vor der
   Auslieferung am Live-Konto darauf kalibriert.
4. **B2:** Singularitätskerne in die Nexus-Stufen aufnehmen (ab Stufe 4, flach 200 je Stufe —
   eine voll ausgebaute Reaktor-Kette deckt genau 200) — ja/nein?
5. **E3-Kappung:** Bestands-Stufen von Bergungswerft/Urmateriereaktor über dem neuen Deckel
   kappen (wie v8.506, ohne Erstattung) — oder nur deckeln und Bestand stehen lassen?
6. **Etappen-Reihenfolge:** Empfehlung A → E1/E2 → B1/B2 → D → C → B3 → B4 (Begründung in 9.).
   Anders gewichten?
7. **Zurückgestellt, eigene Entscheidung nötig:** Module-je-Standort-Bonus in einen weichen
   Deckel nehmen (Bestands-Nerf!) und ein Kredit-Senken-Konzept. Jetzt mitplanen oder liegen
   lassen?

---

## 9. Umsetzungsreihenfolge

Jede Etappe einzeln ausgeliefert; keine Ressource ohne Verbraucher, kein Verbraucher ohne
Anzeige. Reihenfolge-Logik: erst das, was falsche Anreize SOFORT abstellt und niemandem etwas
nimmt (A1/A2), dann die stillen Löcher (E1/E2), dann die neuen Dauerabnehmer, dann die
Großbaustelle.

| # | Etappe | Inhalt | Warum hier |
|---|---|---|---|
| 1 | **A1 + A2** | Mengenskalierungs-Schwanz + T2-Komponenten | Größter Hebel für „Ausgaben zu gering" UND „T2 ohne Abnehmer" in einem Schritt; rein additiv, niemand verliert etwas |
| 2 | **E1 + E2** | Routen-Deckel + ehrliche Routenpreise | Stopft die Löcher, BEVOR neue Senken die Nachfrage erhöhen (sonst füttert die Veredelung die neuen Kosten) |
| 3 | **A3** | Trümmer-Rückfluss ×3 | Macht Verluste real, nachdem Nachbau-Kosten (1) stehen |
| 4 | **A4** | Schildnetz (mit Backend-Parität) | Energie-Senke + Verteidigungs-Ökonomie; größter Einzeleingriff der Etappe A, deshalb nach den einfachen Schritten |
| 5 | **B1 + B2** | Gefechtsvorräte + Mega-T2 ×3 (+ Kerne) | Wiederkehrende T2-Abnehmer in Breite |
| 6 | **D1–D5** | Proto-Speicher, Orbital 8, Urmaterie-Koloss, Farming-Fix | Bergbau trägt über den Erstausbau hinaus |
| 7 | **C1–C3** | Primordial progressiv, Auslastungs-Anzeige, Doku-Fix | T3-Vorsorge, bevor die Fabriken breit ausgebaut sind |
| 8 | **B3** | Bastionsmarken | Großes Einmal-Volumen, braucht eigenes Kosten-Tuning |
| 9 | **B4** | Baustellen-Konto (eigenes Konzept vorab) | Öffnet Mega-Stufen 10+ und macht die Endlos-Senke real endlos |
| 10 | **E3** | Bergungswerft/Urmateriereaktor deckeln | Bestands-relevant → nach Entscheidung 8.5, mit Kappungs-Marke |

Für jede Etappe gilt der Standard-Ablauf: bauen → betroffene Einzeltests VOR dem vollen Lauf
(`grep -ln` über `tests/`, Regel 40) → `node tests/run.js` → `naechste-version.js` → Patchnote
(ehrlich, inkl. Härten) → HELP/TUTORIAL im selben Commit → mergen. Neue Tests je Etappe sind
oben benannt; jeder braucht die Gegenprobe in beide Richtungen.

---

## Anhang: Kernzahlen der Bestandsaufnahme (17.08.2026)

- Kettenproduktion je Tag (ungedrosselt / gemessen im Lager-voll-Gleichgewicht):
  Nano 97.459 / 4.234 · Chips 22.464 / 1.642 · HEK 15.812 / 233 · FK 3.940 / 1.037 ·
  KI 1.728 / 1.037 · Metamaterial ~52 (netto) · Singularitätskerne 639 · Hohlraumgitter 26.
- Werftmarken gesamt (alle 44 markierbaren Klassen Mk X, Obergrenze): ~257 k Nano / 59,5 k Chips /
  41,7 k HEK / 13,6 k FK / 4,8 k KI — die größte existierende T2-Einmalsenke.
- Markt: Verkauf ist echte Vernichtung (server.js), aber ~21.250 Erz drücken den Preis auf
  den Boden; Erholung 1,5 % der Lücke je 15 min. Tagesproduktion komplett verkauft ≈ 156 M Kr.
- Prestige-Schwelle ×5 je Stufe (St. 7 = 390 M Punkte) — als Senke für reife Konten faktisch
  abgeschaltet; Kryo-Archiv rettet ~1 % der T2-Lager.
- Allianz-Endlossenken: `ep_*`-Projekte ×1,09 über 100 Stufen (ep_werft 4,3 Mrd Erz,
  ep_forschung ~49 M FP kumuliert) — allianzweit geteilt, einmalig.
- Offline-Nachholung: bis 14 h volle Rate je Fenster (~318 M Energie), ab 24 h Abwesenheit
  ×1,5-Rückkehrer-Buff für 24 h.
