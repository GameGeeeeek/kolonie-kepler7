# Baustellen-Konto (B4) — Konzept

*Stand 18.08.2026. Vorarbeit zu Etappe B4 aus `docs/wirtschaft-rebalance-konzept.md` §3, dort
ausdrücklich als „größte Einzelbaustelle des Plans — eigene Etappe, eigenes Konzeptdokument vor der
Umsetzung" markiert. Dieses Dokument ist dieses Konzeptdokument.*

Alle Zahlen darin sind **gemessen**, nicht geschätzt; jede Messung nennt ihre Quelle. Das ist keine
Formalie: Beim Nachrechnen hat sich herausgestellt, dass das Rebalance-Konzept die Wand um sechs bis
sieben Ausbaustufen zu weit außen verortet hat (Abschnitt 2.2). Hausregel 41 — ein Konzept ist kein
Messergebnis, auch wenn es aus derselben Feder stammt.

---

## 1. Das Problem in einem Satz

Die Kosten der einzigen unbegrenzt wiederholbaren Inhalte des Spiels wachsen **exponentiell**, der
Lagerdeckel wächst **linear bis logarithmisch** — ab einem Punkt kostet ein Posten mehr, als das
Lager überhaupt fassen kann, und ist damit **nicht teuer, sondern unbezahlbar**.

Das Spiel benennt die Falle an einer Stelle selbst. Der Kommentar über `forschungUeberLager()`
(`weltraum_kolonie.html`, bei `researchQueue`) beschreibt sie ausführlich und zieht die richtige
Konsequenz für die *Warteschlange* — ein dauerhaft unbezahlbarer Kopf blockiert seit v8.xxx nicht
mehr die Einträge dahinter. **Der Posten selbst bleibt trotzdem für immer unerreichbar.** Behoben
wurde damit der Stillstand, nicht die Wand.

### 1.1 Warum der Deckel hart ist

`SOFT_CAP_OVERFLOW_RATE = 0` (v8.7.2). Ist das Lager voll, steht die Produktion dieser Ressource
**komplett**. Es gibt keinen Überlaufertrag, über den sich ein größerer Betrag ansparen ließe, und
`gainResources` klemmt jede Einmal-Gutschrift am selben Deckel. Ein Posten über `storageCap()` ist
deshalb nicht „irgendwann dran", sondern nie.

Das ist eine bewusste, gut begründete Entscheidung — sie verhindert das unbegrenzte Ansparen. Sie
soll **nicht** angefasst werden (siehe Abschnitt 5, verworfene Alternativen).

---

## 2. Die Messung

### 2.1 Der Bezugswert: was das Lager wirklich fasst

`storageCap()` bei einem **ambitionierten Endausbau** — 11 Standorte, Lagerkomplex 45, Kryolager auf
der Maximalstufe 15, 500 Frachter — wurde am 18.08.2026 im Browser gemessen (CLAUDE.md, Hausregel
57, Anlass Bastionsmarken):

```
storageCap() = 803.800
```

Der Deckel ist **nicht hart nach oben**: Jeder Großfrachter trägt `LAGER_PER_SHIP.frachtergross` =
+1.000 bei. Er lässt sich also durch Flotte erweitern — der Weg über den Lagerkomplex ist dagegen
tot (Stufe 46 kostet 1,9 Mio Erz, Stufe 56 schon 18 Mio; ebenfalls CLAUDE.md Regel 57). Alle Zahlen
unten nennen deshalb die Zahl der **zusätzlichen Großfrachter**, die ein Posten verlangt.

### 2.2 Mega-Ausbaustufen: die Wand steht bei Stufe 3–4, nicht bei 10

`megaStageCost` = `Basis × MEGA_STAGE_COST_MULT^(stufe−1)` mit `MEGA_STAGE_COST_MULT = 2,6`,
anschließend `scaleCostByEmpire` mit `empireCostFactor = 1 + 0,25 je Kolonie`. Gerechnet für den
Dysonschwarm (`erz: 50.000`) gegen den gemessenen Deckel:

| Ausbaustufe | 1 Standort | 5 Standorte | 11 Standorte | 21 Standorte |
|---|---|---|---|---|
| 2 | 130.000 ✓ | 260.000 ✓ | 455.000 ✓ | 780.000 ✓ |
| 3 | 338.001 ✓ | 676.001 ✓ | 1.183.001 → +380 Gfr. | 2.028.001 → +1.225 Gfr. |
| 4 | 878.800 → +75 Gfr. | 1.757.600 → +954 Gfr. | 3.075.800 → +2.272 Gfr. | 5.272.800 → +4.469 Gfr. |
| 5 | 2.284.881 → +1.482 | 4.569.761 → +3.766 | 7.997.081 → +7.194 | 13.709.281 → +12.906 |
| 8 | 40.159.051 → +39.356 | 80.318.102 → +79.515 | 140.556.679 → +139.753 | 240.954.306 → +240.151 |

**Zwei Befunde daraus, und beide sind neu:**

1. **`wirtschaft-rebalance-konzept.md` §3 nennt Stufe 10 als Ort der Wand.** Gemessen steht sie bei
   Stufe 3 (großes Imperium) bis 4 (Ein-Standort-Konto). Die Aussage „B4 öffnet die Mega-Stufen 10+"
   war damit zu bescheiden: B4 öffnet die Stufen **ab 3**.
2. **Der `empireCostFactor` dreht die Wand gegen genau die Konten, für die die Stufen gedacht
   sind.** Er existiert aus gutem Grund (ein größeres Imperium *produziert* mehr), aber er skaliert
   die KOSTEN, während der Lagerdeckel nur mit Gebäuden und Frachtern wächst. Wer expandiert,
   verschiebt seine eigene Wand nach innen. Das ist kein Balance-Regler, sondern eine
   Struktur-Unverträglichkeit — dieselbe Familie wie Hausregel 41 (Dauerfabrik gegen
   flugzeitgebundene Ressource) und Hausregel 57 (Zufluss gegen Speicher).

### 2.3 Ewigkeitsforschungen: 98 % der deklarierten Stufen sind unerreichbar

Die vier `rewig_*`-Forschungen haben `maxLevel: 999`. Kosten `baseCost × costMult^(stufe−1)`.
Gegen dieselben 803.800:

| Forschung | costMult | Wand ab Stufe | erste unbezahlbare Menge |
|---|---|---|---|
| `rewig_prod` | 1,32 | **18** | 1.009.251 Erz |
| `rewig_bau` | 1,34 | **18** | 1.013.630 Erz |
| `rewig_def` | 1,33 | **17** | 1.054.433 Erz |
| `rewig_lager` | 1,38 | **15** | 817.617 Kristalle |

**Von 999 deklarierten Stufen sind 15 bis 18 erreichbar.** Und die Ironie steht in der letzten
Zeile: `rewig_lager` — die Forschung, die den Lagerdeckel anhebt und die Wand nach außen schieben
würde — läuft **als erste** in sie hinein. Der Ausweg ist selbst hinter der Wand.

### 2.4 Was schon getan ist, und was es nicht löst

`forschungUeberLager()` unterscheidet seit seiner Einführung zwei Fälle, die vorher gleich aussahen:
*vorübergehend zu arm* (warten) und *dauerhaft unmöglich* (überspringen, Eintrag bleibt stehen).
Das hat den **Stillstand** behoben — vorher stand die ganze Schlange. Es macht den Posten aber nicht
bezahlbar. Für den Spieler heißt das heute: Der Eintrag steht sichtbar da, wird nie abgearbeitet,
und die Karte sagt nicht, dass er es nie wird.

---

## 3. Der Vorschlag

### 3.1 Die Mechanik in drei Sätzen

Ein Warteschlangen-Eintrag bekommt ein Feld `eingezahlt: { <res>: <menge> }`. Solange er in der
Schlange steht, fließt ein wählbarer **Anteil der laufenden Produktion** nicht ins Lager, sondern
direkt auf dieses Konto. Ist die Summe je Ressource erreicht, startet der Posten — **ohne dass der
Betrag je gleichzeitig im Lager gelegen haben muss**.

Damit fällt die Wand, ohne dass ein einziger Deckel angefasst wird. `storageCap()` bleibt, wie es
ist; `SOFT_CAP_OVERFLOW_RATE` bleibt 0; die Kostenformeln bleiben unverändert.

### 3.2 Die sechs Entscheidungen, die vorab feststehen müssen

**(a) Der Anteil ist eine Wahl des Spielers, kein Automatismus.**
Ein fester Prozentsatz wäre entweder zu klein (die Wand bleibt gefühlt) oder zu groß (die laufende
Wirtschaft verhungert, und der Spieler versteht nicht, warum seine Rate eingebrochen ist). Ein
Regler je Auftrag (0 / 25 / 50 / 75 %) ist ehrlich: Man sieht, was man abzweigt.
**Und die Anzeige der Produktionsrate muss den Abzug NENNEN.** Sonst ist sie die zweite
Anzeigestelle mit der alten Annahme (Punkt 6) — die Ressourcenkarte zeigt „+5,2/s", im Lager
kommen 2,6 an, und der Spieler schreibt einen Fehlerbericht. Der Abzug gehört in `.rescard .rate`
sichtbar gemacht, nicht in einen Tooltip.

**(b) Gedeckelt wird nur der ZUFLUSS, nie der Bestand.**
Wird ein Auftrag abgebrochen, muss das Eingezahlte **zurück** — und zwar ins Lager, wo es dann
selbstverständlich am Deckel klemmt. Ein Abbruch, der die Einzahlung verfallen lässt, wäre die
Bestrafung einer Planänderung; dieselbe Regel wie bei den Komfort-Grenzen („Gedeckelt wird nur das
Hinzufügen", CLAUDE.md). Läuft dabei etwas über den Deckel, wird es **nicht** gutgeschrieben, aber
der Spieler muss es vorher erfahren — die Rückzahlung braucht einen Hinweis, keine stille Vernichtung.

**(c) Tier-2-Ressourcen und Protomaterie müssen einzahlbar sein.**
`wirtschaft-rebalance-konzept.md` §3 verlangt das ausdrücklich (die Mega-Stufen ziehen ab Stufe 2
einen linearen T2-Anteil und ab Stufe 6 Protomaterie). Beide haben **eigene, viel kleinere Deckel**
(`tier2StorageCap`, `protomaterieCap` — Protomaterie 2.500 bei Vollausbau). Genau dort ist das Konto
am wertvollsten. Aber: Protomaterie fällt **fest je Fuhre** an, nicht als laufende Rate — für sie
kann es keinen „Anteil der Produktion" geben. Sie braucht eine **Einzahlung von Hand** aus dem
Bestand. Zwei Einzahlungswege also, und die Oberfläche muss beide zeigen.

**(d) Das Konto ist kein zweites Lager.**
Es ist zweckgebunden an genau einen Auftrag, nicht abhebbar außer per Abbruch, und trägt keine
Zinsen, keinen Bonus, keine Anzeige unter den Ressourcen. Sonst entsteht der Umweg, den der harte
Deckel gerade verhindern soll: „einen Dummy-Auftrag einreihen, um unbegrenzt zu sparen". Deshalb:
**Ein Eintrag mit `eingezahlt` muss die Kosten des Postens als Obergrenze führen** — mehr als
`kosten[res]` nimmt das Konto nie an, und Überschüssiges läuft weiter ins Lager.

**(e) Der Backend-Sanity-Check braucht eine eigene Schleife.**
`saveSanityViolation` (`server.js`) prüft ausschließlich **bekannte** Schlüssel: Gebäude, Forschung,
Flotten, `resources`, `credits`, `prestige`, `xp`, `shipMarks`, `bastionMarks`. Ein neues Zahlenfeld
in den Warteschlangen-Einträgen liefe **ungeprüft** durch. Der Kommentar an den Bastionsmarken sagt,
warum das nicht bleiben darf: „eine Ungleichbehandlung, die niemand begründet hat, ist die Sorte
Lücke, die später jemand für Absicht hält." Also: `maxBaustellenEinzahlung` in `SAVE_SANITY_LIMITS`,
großzügig bemessen (gleiche Begründung wie `maxShipMark`: ein zu enges Limit sperrt einen echten
Spieler vom Speichern aus, und das ist der teurere Fehler).

**(f) Prestige und Aufstieg müssen entscheiden, was mit dem Konto passiert.**
`buildQueue`/`researchQueue`/`constructionQueue` werden beim Prestige geleert (`buildQueue:[],
researchQueue:[], constructionQueue:[]` in der Reset-Zeile). Mit dem Konto verschwindet dann auch
das Eingezahlte — bei einem Betrag in Millionenhöhe ist das eine Entscheidung, keine Nebenwirkung.
**Vorschlag: vor dem Leeren zurückzahlen**, dieselbe Behandlung wie beim Abbruch; das Lager kappt
den Rest ohnehin. Was NICHT geht, ist stilles Verschwinden.

### 3.3 Was B4 ausdrücklich NICHT tut

- Es hebt **keinen** Deckel an: nicht `storageCap()`, nicht `MEGA_PROTO_MAX`, nicht
  `SOFT_CAP_OVERFLOW_RATE`.
- Es ändert **keine** Kostenformel. Die Posten bleiben genauso teuer wie heute — sie werden nur
  bezahlbar.
- Es beschleunigt **nichts**. Wer 3 Mio Erz braucht und 5.000/s produziert, wartet weiterhin zehn
  Minuten. Der Unterschied ist, dass er sie am Ende auch hat.
- Es macht die Mega-Stufen **nicht billiger** und die Ewigkeitsforschung **nicht schneller** — die
  Balance-Fragen aus dem Rebalance-Konzept (Posten 2, `MEGA_PROTO_MAX`) bleiben getrennt davon offen.

---

## 4. Der Testplan

Nach der Erfahrung der letzten Etappen die drei Prüfungen, die wirklich tragen:

1. **Die Wand fällt — gemessen, nicht behauptet.** Ein Fixture mit einem Posten oberhalb von
   `storageCap()` muss ihn nach genügend Ticks starten. Die Gegenprobe am alten Stand darf ihn nie
   starten. Erwartungswert aus der GEMESSENEN Rate ableiten, nicht eintippen (Hausregel 2/7).
2. **Der Abbruch zahlt zurück, und zwar messbar.** Bestand vor dem Einreihen, nach dem Einzahlen,
   nach dem Abbruch — hinter JEDEM Schritt gemessen, nicht nur am Ende (Hausregel 27).
3. **Das Konto ist kein Lager-Umweg.** Ein Eintrag darf nie mehr aufnehmen als seine Kosten; ein
   Versuch, mehr einzuzahlen, muss am Deckel des Eintrags klemmen. Gegenprobe an einer sabotierten
   Kopie ohne diese Grenze.

Dazu die musterbasierten Wächter, die keine Namen kennen (Hausregel 40): eine Prüfung, dass **jede**
Stelle, die eine Warteschlange leert, das Konto vorher zurückzahlt — datengetrieben über alle
Fundstellen von `buildQueue = []`/`researchQueue = []`, nicht als Namensliste.

---

## 5. Verworfene Alternativen (damit sie niemand naiv neu vorschlägt)

- **`SOFT_CAP_OVERFLOW_RATE` wieder > 0 setzen.** Das war der Zustand vor v8.7.2 und wurde bewusst
  beendet: Ein Überlaufertrag macht den Lagerausbau wertlos und das Ansparen unbegrenzt. Es löste
  die Wand, indem es den Deckel abschafft.
- **`storageCap()` exponentiell mitwachsen lassen.** Verschiebt die Wand, statt sie zu entfernen —
  und macht jeden heutigen Lagerwert bedeutungslos. Die Kosten wachsen mit 1,32–2,6 je Stufe; eine
  Deckelformel, die da mithält, ist keine Formel mehr, sondern die Abschaffung des Deckels mit
  Zwischenschritt.
- **Die Kosten der `rewig_*`-Forschungen abflachen.** Sie sind als *ewige* Senke gebaut; eine
  Abflachung macht sie irgendwann trivial und nimmt dem Endspiel seine einzige Größe, die mitwächst.
  Außerdem senkt eine Kostenänderung rückwirkend den Wert bereits getätigter Ausbauten — dieselbe
  Erwägung, die bei den Bastionsmarken gegen einen Punktestand-Eingriff entschieden hat.
- **`maxLevel: 999` auf den erreichbaren Wert senken.** Ehrlicher als heute, aber es löst nichts —
  es schreibt die Wand nur fest. Falls B4 doch nicht kommt, ist das der Minimal-Fix, und dann gehört
  eine ehrliche Zeile in die Beschreibung („endet faktisch bei Stufe 17").

---

## 6. Offene Punkte vor der Umsetzung

1. **Wo lebt der Regler?** Je Auftrag (genauer, mehr Bedienaufwand) oder je Warteschlange (einfacher,
   gröber). Vorschlag: je **Warteschlange**, mit einem Wert je Schlange — drei Regler statt beliebig
   vieler, und das deckt den Anwendungsfall („ich spare gerade auf die nächste Mega-Stufe") vollständig ab.
2. **Was passiert, wenn zwei Aufträge gleichzeitig sparen?** Vorschlag: nur der **Kopf** der Schlange
   zahlt ein. Alles andere macht die Anzeige unerklärbar und die Rate unvorhersehbar.
3. **Braucht das Konto eine eigene Anzeige im Punktestand?** Nein — es ist zweckgebunden und kein
   Besitz. Es im Score zu führen wäre ein rückwirkender Ranglisten-Eingriff (dieselbe Erwägung wie
   bei den Bastionsmarken, Vorschlag V3).
4. **Der Deckel-Hinweis auf der Karte.** Unabhängig von B4 fehlt heute die Auskunft „dieser Posten
   passt nicht ins Lager". Sie gehört dazu — und mit B4 wird daraus „dieser Posten braucht das
   Baustellen-Konto", also ein Hinweis mit Ausweg statt einer Sackgasse (Hausregel 35: ein Zustand
   ohne Entkommen ist eine Falschaussage).

---

## 7. Umgesetzt (19.08.2026) — und was dabei ANDERS entschieden wurde

Der Umfang ist bewusst die **Forschungs-Warteschlange**, nicht alle drei Schlangen. Dort beißt die
gemessene Wand am härtesten (Ewigkeitsforschungen bei Stufe 15–18 von 999), und die Erkundung hat
**fünfzehn** Stellen gezählt, an denen Warteschlangen geleert oder gekürzt werden — jede weitere
Schlange vervielfacht die Zahl der Stellen, an denen ein Konto verwaisen kann.

Jede Abweichung unten ist eine Entscheidung mit Grund. Wer sie für ein Versehen hält und
„repariert", baut den jeweiligen Fehler wieder ein.

- **Der Regler steht je WARTESCHLANGE (wie vorgeschlagen), aber er sitzt IN der Box, nicht
  daneben.** Der Hinweis an einem gesperrten Eintrag verweist wörtlich auf „unten" — ein Regler in
  einer eigenen Box wäre die zweite Stelle mit derselben Aussage (Punkt 6 der Checkliste).
- **Einzahlender Posten ist NICHT der Kopf der Schlange, sondern der erste Eintrag ÜBER dem
  Lagerdeckel.** Der Kopf ist im Normalfall bezahlbar, ein Konto darauf wäre wirkungslos — und der
  Spieler müsste umsortieren, um zu sparen. Die Regel „der, der es braucht" ist die einzige, die
  ohne Erklärung vorhersehbar ist.
- **Es gibt kein Aufräumen an den fünfzehn Entfernungsstellen, sondern einen ABGLEICH im Takt**
  (`baustelleAufraeumen`). Eine davon zu vergessen — oder die nächste, die jemand später dazubaut —
  ist nach Lage der Dinge der Normalfall, nicht die Ausnahme. Dieselbe Antwort wie bei
  `astFreiePlaetze` im Backend: eine Quelle statt vieler Aufrufer, die alle daran denken müssen.
- **Die Restkosten-Rechnung liegt an EINER Stelle** (`baustelleRestKosten`). Fünf Stellen brauchen
  sie; beim ersten Anlauf hatten zwei davon — **beide Forschungskarten** — die volle Summe behalten,
  und der Erforschen-Knopf blieb grau, obwohl das Konto den Posten längst gedeckt hatte. Genau der
  Fehler, gegen den diese Etappe geschrieben ist, in der eigenen Lieferung.
- **`affordEtaHtml` bekommt den Kontoschlüssel optional.** Ohne ihn verhält sie sich exakt wie
  vorher — Gebäude- und Schiffskarten kennen kein Konto, und ein Hinweis darauf wäre dort ein
  Versprechen, das nichts einlöst. Mit ihm sagt sie statt „erst mit größerer Lagerkapazität möglich"
  (seit dem Konto schlicht unwahr), was wirklich hilft.
- **Neu dazugekommen, weil die Umsetzung es sichtbar gemacht hat: eine RÜCKFRAGE vor dem
  Entfernen.** Die Rückgabe läuft über `gainResources` und klemmt damit am Lagerdeckel — und ein
  Konto ist kurz vor dem Ziel *zwangsläufig* größer als der Deckel, denn genau dafür existiert es.
  Ohne Rückfrage kostet ein Fehlgriff auf das kleine ✕ tagelanges Ansparen, und die Erklärung dafür
  stünde nur im Protokoll, also nach der Tat. Der Dialog nennt beide Zahlen: was zurückpasst und was
  verloren ginge. Dieselbe Abwägung wie beim Forschungsabbruch daneben, der seine 50-%-Erstattung
  ebenfalls vorher ansagt.
- **Über das Prestige und den Aufstieg wandert der ANTEIL mit, nicht das Guthaben.** Das Guthaben
  hängt an einer Forschungsstufe, und die ist nach dem Reset weg — es zu bewahren wäre Guthaben ohne
  Posten. Der Anteil ist dagegen eine Einstellung, und eine still zurückgedrehte Einstellung ist
  genau die Sorte Änderung, die ein Spieler zu Recht meldet. Gefährlich ist er dort nicht: Liegt kein
  Posten über dem Deckel, liefert `baustelleZiel()` null und es wird nichts abgezweigt.
- **Kein Eintrag in `SAVE_SANITY_LIMITS`, und das ist eine bewusste Nicht-Änderung.** Die
  Backend-Prüfung ist eine Positivliste über wenige Felder; das Konto steht nicht darin und löst
  deshalb keine Ablehnung aus. Ein Limit dort hätte einen echten Nutzen nur gegen einen gefälschten
  Spielstand — und der ist bauartbedingt ohnehin möglich (die Grenze dieses Projekts ist „kann ich
  etwas anfassen, das ANDEREN gehört?"). Dagegen hätte ein zu enges Limit einen echten Spieler vom
  Speichern ausgesperrt, und das ist der teurere Fehler (dieselbe Begründung wie bei `maxShipMark`).
- **Tier-2-Material sammelt das Konto nicht** — es hängt an der Produktion der sechs
  Grundressourcen, und `forschungUeberLager` prüft auch nur die (Tier 2 hat einen eigenen, kleinen
  Deckel). Die Wand ist eine T1-Wand; der T2-Anteil einer Forschung muss weiterhin im Lager liegen.
