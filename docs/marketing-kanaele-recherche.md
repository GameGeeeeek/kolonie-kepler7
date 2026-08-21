# Marketing-Kanäle: Recherche vom 21.08.2026

Auftrag Sascha: „Führe eine sehr umfangreiche Recherche durch, wo und wie wir Kolonie Kepler 7
bekannt machen können." Dieses Dokument hält die **geprüften** Ergebnisse fest, damit sie nicht mit
dem Container verschwinden.

**Rahmenbedingungen, die die Auswahl bestimmen** (im Gespräch geklärt): Das Spiel ist öffentlich
spielbar mit offener Registrierung, der Fokus liegt zuerst auf Deutsch, und Discord sowie die
Social-Kanäle existieren bereits und sind aktiv.

**Die aufbereitete Fassung mit allen Tabellen und dem 30-Tage-Plan** liegt als Artefakt vor:
https://claude.ai/code/artifact/267331cd-f275-432e-9a31-d0f2dab175ec

---

## Belegstufen

Jede Aussage hier trägt eine davon. Wer das überliest, hält Vermutungen für Messungen.

- **geprüft** – an der Quelle gelesen, Zitat oder Zahl liegt vor
- **teilweise** – aus zweiter Hand belegt (Fachartikel, Marktübersicht), nicht an der Quelle
- **ungeprüft** – plausibel, aber nicht belegt

---

## 1. Der Befund, der alles andere ordnet

**Die Seite ist unsichtbar, nicht schlecht optimiert.** Titel, Beschreibung, Keywords, OG-Bild,
`robots.txt`, `sitemap.xml`, Google-Verification und vier Landingpages sind vorhanden – und die
Seite taucht bei einer Suche nach ihren eigenen Kernbegriffen in **keinem** Ergebnis auf
(**geprüft**). Es fehlen eingehende Links, nicht Optimierung. Genau die liefern die Verzeichnisse
aus Abschnitt 4, nebenbei zum eigentlichen Zweck.

**Die Marktlücke ist real, aber schmal.** Zwei Sätze aus deutschsprachigen Marktübersichten 2026:
„OGame hat nach wie vor keine echte Browser-Konkurrenz, die alle seine Kernmechaniken vereint" und
„Echte Browser-Sci-Fi-Strategie ist 2026 eine kleine Nische" (**teilweise**). Konsequenz: **Nicht
neue Genre-Fans gewinnen, sondern enttäuschte alte abholen.**

**Die Positionierung steht schon auf der Startseite:** „Kostenlos · Kein Download · Kein
Pay-to-Win" (**geprüft**). Das ist das schärfste Werkzeug – siehe Abschnitt 6.

---

## 2. Die Einstiegshürde – gemessen, nicht geschätzt

**Entscheidung Sascha, 21.08.2026: Ein Gastmodus wird NICHT gebaut.** Der Abschnitt bleibt, weil
die Hürde damit nicht verschwindet, sondern feststeht – und weil sie bestimmt, was jeder Kanal
dieser Liste wert ist.

**Was ein neuer Spieler tatsächlich durchlaufen muss** (gemessen an `server.js`, Registrierung und
Login-Zweig, **geprüft**):

1. Kommandantenname
2. Passwort – mind. 8 Zeichen, wird gegen 2.122 bekannte Passwörter geprüft
3. **E-Mail-Adresse – Pflicht** (`'E-Mail-Adresse ist erforderlich (für die Konto-Bestätigung).'`)
4. Postfach öffnen
5. **Bestätigungslink klicken** – ohne ihn antwortet der Login mit
   `403 { needsVerification: true }`
6. zurück zum Spiel, anmelden

Erst dann läuft das Spiel. Das ist Double-Opt-In mit einem guten Grund – Zweitkonten sind bei PvP
und einem Referral-System ein echtes Problem –, aber **Schritt 4 liegt außerhalb der Seite**, und
das ist die härteste Stelle jeder Konversionskette.

**Zwei Kanäle fallen dadurch weg**, und zwar an ihrer eigenen Regel, nicht an einer Einschätzung:

- **r/WebGames** (142.000) beschreibt sich wörtlich als „web games with no downloads, **signups**,
  or plugins required" (**geprüft**). Ein Spiel mit Pflichtregistrierung passt dort nicht.
- **Show HN** schließt E-Mail-Anmeldungen ausdrücklich aus: „you have to have something for people
  to try out now" (**geprüft**).

**itch.io bleibt**, aber mit gedämpfter Erwartung: Die Indexierungsfrage dort hängt an der
Einbettbarkeit (Abschnitt 4), nicht an der Registrierung. Wer auf itch.io stöbert, erwartet
allerdings Sofort-Spielbarkeit – die Abbruchquote wird hoch sein.

**Was daraus folgt, ohne einen Gastmodus:** Die verbleibenden Kanäle müssen den Wegfall auffangen,
also gewinnen Verzeichnisse und r/incremental_games an Gewicht. Und die Reihenfolge wird wichtiger,
nicht unwichtiger: Ein Verzeichniseintrag lässt sich wiederholen und wirkt über den Backlink auch
ohne Klick, ein Reddit-Beitrag ist ein einmaliger Schuss.

**Ein Widerspruch, der unabhängig davon behoben gehört:** `weltraum-browsergame.html` sagt heute
„Kein Client, kein Plugin, kein App-Store – Seite aufrufen, Kommandantennamen wählen, loslegen."
Das stimmt nicht – ohne E-Mail und Bestätigungsklick legt niemand los. Das ist die klassische
zweite Anzeigestelle mit der alten Annahme (Punkt 6 der Checkliste), nur auf einer Landingpage
statt im Spiel, und es ist die erste Seite, die ein Besucher aus einem Verzeichnis sieht.
Gemessen ist es die **einzige** Stelle mit dieser Zusage (**geprüft**).

---

## 3. Reddit

**Zur Belastbarkeit:** Reddit sperrt maschinellen Zugriff – weder direkter Abruf noch ein echter
Browser (Playwright) kamen durch. Die Zahlen stammen aus einer Subreddit-Statistikseite, die Regeln
aus Fachartikeln. **Vor jedem Beitrag die Regelseite selbst öffnen.**

| Subreddit | Mitglieder | Wachstum/Jahr | Eigenwerbung | Prio |
|---|---|---|---|---|
| r/gamedev | 2.100.000 | – | nur fachlich, 10:1-Regel | 4 |
| r/IndieGaming | 515.000 | – | eingeschränkt (**ungeprüft**) | 6 |
| r/IndieDev | 434.000 | +139k (47 %) | in eigenen Threads | 7 |
| r/GameDevelopment | 432.000 | – | **ungeprüft** | 4 |
| r/MMORPG | 359.000 | +60k (20 %) | Flair „Self Promotion" existiert | 6 |
| r/indiegames | 328.000 | +71k (28 %) | häufigster Flair ist „Promotion" | 8 |
| r/incremental_games | 187.000 | +28k (18 %) | ja; **Referral-Links absolut verboten** | 10 |
| r/WebGames | 142.000 | +14k (11 %) | **passt nicht mehr** – Sub schließt „signups" aus (Abschnitt 2) | – |
| r/playmygame | 138.000 | – | dafür gebaut, Formvorgaben | 9 |
| r/RealTimeStrategy | 102.000 | +20k (25 %) | Flairs „Self-Promo Video/Post" | 6 |
| r/DestroyMyGame | 62.000 | +23k (57 %) | dafür gebaut | 5 |
| r/4Xgaming | 53.000 | +7k (16 %) | **ungeprüft** | 6 |
| r/incremental_gamedev | 5.000 | +2k (58 %) | Fachaustausch, HTML-Flair | 5 |
| r/Games | sehr hoch | – | **strikt verboten** | – |

**Drei Regeln, die alles entscheiden:**

1. **Referral-Links sind in r/incremental_games absolut verboten** (**geprüft**). Das trifft direkt,
   weil das Referral-System existiert. Immer die nackte Adresse posten, nie den Einladungslink –
   ein Verstoß kostet den wertvollsten Kanal der ganzen Liste.
2. **Die 10:1-Regel gilt fast überall** (**teilweise**): höchstens jeder zehnte Beitrag darf eigene
   Werbung sein. Praktisch: in der Woche davor zehn fremde Spiele kommentieren.
3. **r/playmygame verlangt seinen eigenen „Make a Post"-Knopf** (**geprüft**); wer die
   Community-Hinweise überspringt, riskiert einen Shadowban.

**Deutsche Subreddits: keine Empfehlung.** Ich habe keinen gefunden, in dem ein Browsergame-Beitrag
regelkonform und sinnvoll wäre (**ungeprüft**). Die deutsche Reichweite liegt bei den Portalen.

---

## 4. Verzeichnisse und Portale – der unterschätzte Block

Zwei Wirkungen gleichzeitig: Spieler, die aktiv suchen, **und** eingehende Links gegen das
SEO-Problem aus Abschnitt 1. Aufwand je Eintrag: 10–20 Minuten, einmalig.

### Deutschsprachig

| Portal | Zustand | Eintragsweg | Prio |
|---|---|---|---|
| **webgamers.de** | aktiv, redaktionell | E-Mail über Impressum. Betreiber (Wolfgang Scheidle) kommt **selbst aus der Indie-Browsergame-Szene**, bietet ausdrücklich Interviews an, schreibt: „bin ich auf Euren Input angewiesen" (**geprüft**) | 10 |
| **browsergame-base.de** | aktiv, 2026-Inhalte | Vorschlag per E-Mail ausdrücklich eingeladen; Kategorien „Weltraum" + „Strategie" (**geprüft**) | 9 |
| **bestebrowsergames.de** | aktiv, 1.000+ Spiele | Kontaktseite erreichbar, Einreichungsweg nicht dokumentiert (**teilweise**); `/games/weltraum.html` | 9 |
| **weltraumspiele.de** | seit 2009, ~35 Spiele | kein Formular gefunden, Kontakt über Impressum (**teilweise**). **Ausschließlich** Weltraum – engster Themenkreis überhaupt | 8 |
| browsergames.de | aktiv, 2.700+ Spiele | kein Formular sichtbar (**teilweise**) | 6 |
| browsergames.fm | aktiv | blockt Bot-Abrufe, hat Weltraum-Rubrik (**teilweise**) | 6 |
| browsergame-index.de | läuft, News zuletzt 2010 | „Neues Browsergame melden" unter `/browsergame-melden`, `webmaster@browsergame-index.de` (**geprüft**) | 5 |
| stadtgame.com | erreichbar | **ungeprüft** | 4 |

**Wo Zeit verschwendet wäre:** Ein erheblicher Teil der Top-Ergebnisse für „Weltraum Browsergame"
sind Affiliate-Strecken in Zeitungsportalen (`blick.de/vergleich/…`, `freiepresse.de/vergleich/…`,
**teilweise**) – dort kommt man nicht durch eine freundliche Mail hinein.

### International

| Verzeichnis | Bedingungen | Prio |
|---|---|---|
| **browsermmorpg.com/register_game** | **Kostenlos.** Kategorie Sci-Fi. Verlangt sauberen Link ohne Referrer-Codes und eine **E-Mail auf der Spiel-Domain** – Eigentum wird geprüft. Menschliche Freigabe. (**geprüft**) | 10 |
| **thebigmmorpglist.com/submit-game/** | Formular, Typ „MMO Strategy", Client „Browser Based"; führt 83 Browserspiele. Kosten nicht ausgewiesen. (**geprüft**) | 8 |
| **bbogd.com/addgame** | **Kostenlos.** Formular am Original geprüft: Konto nötig, kein Captcha, keine Zeichengrenze, Bild-Upload optional. Nennt sich selbst „Browser Based Online Game Directory“. Achtung: `/submit-game/` antwortet mit 404. (**geprüft**) | 8 |
| mmorpg.com/games-list | **Kein Selbsteintrag, sondern eine Bewerbung** über ein Google-Formular: „considered for inclusion“. Browser-Kategorie vorhanden, Ergebnis ungewiss. (**geprüft**) | 5 |
| ~~mmohub.com~~ | **Passt nicht – gestrichen.** Listet ausschließlich PRIVATE SERVER (Aion, Lineage, MU Online, WoW). Ein eigenes Spiel ist dort off-topic. (**geprüft**) | – |
| mmohuts.com / mmobomb.com / mmogames.com | redaktionelle Browser-Listen (**ungeprüft**) | 5 |

### itch.io – der Befund, der die Vorgehensweise bestimmt

itch.io-Admin **leafo** wörtlich zur Frage nach einem reinen externen Link:

> „No one will stop you from creating a page like that, but it may not match our community
> guidelines so you may not get indexed in our search and browse pages."

(**geprüft**) Übersetzt: Die Seite existiert, taucht aber in **Suche und Stöbern nicht auf** – also
genau dort nicht, wo Spieler etwas finden. Übrig bleiben Profil und Game Jams.

**Der Ausweg:** eine kleine `index.html` hochladen, die das Spiel per iframe von gamegeeeeek.de
lädt. Damit gilt es als HTML5-Spiel und wird indexiert; laut Community-Threads verstößt das nicht
gegen die ToS (**teilweise**) – **von itch.io selbst nicht bestätigt.** Der Mehrspieler-Teil
funktioniert weiter (der Client verbindet sich aus dem iframe heraus zum eigenen Server).
**An einer unveröffentlichten Seite testen** – die eigene CSP könnte das Einbetten blockieren.

---

## 5. Discord

Wichtige Unterscheidung: Die großen GameDev-Server sind voller **Entwickler**, nicht voller
Spieler. Für Feedback hervorragend, für Spielergewinnung schwach.

| Server | Einladung | Größe | Publikum | Prio |
|---|---|---|---|---|
| **r/incremental_games** | `discord.com/invite/r-incremental-games-256804627310182401` | 11.200+ | **Spieler** | 9 |
| **DISBOARD** | `disboard.org` | Verzeichnis | Suchende – **eigenen Server eintragen**, Tags idle/incremental/strategy/free-games | 8 |
| How To Market A Game | `discord.gg/ZaFhHZ4Bwa` | n. b. | Entwickler (Marketing-Wissen) | 7 |
| Indie Games Community | `discord.me/indiegamescommunity` | n. b. | gemischt; Demo posten + bewerben erlaubt | 7 |
| Funsmith Club | `discord.gg/GMxgxptwpu` | n. b. | Entwickler, gegenseitiges Testen | 6 |
| r/gamedev | `discord.gg/reddit-gamedev` | n. b. | Entwickler, eigener Promo-Kanal | 6 |
| Game Dev League | `discord.gg/gamedev` | n. b. | Entwickler | 5 |
| Game Dev Network | `discord.gg/gdn` | 38.000+ | Entwickler | 5 |
| Brackeys | `discord.gg/brackeys` | 92.000+ | Unity-Lernende, thematisch fern | 3 |

**DISBOARD ist kein Ort zum Posten, sondern zum Gefundenwerden** – einmal eintragen, dauerhaft über
Tags auffindbar für Leute, die aktiv nach einem Idle- oder Strategiespiel suchen.

---

## 6. Konkurrenzanalyse: woran OGame-Spieler sich reiben

| Beschwerde | Beleg | Gegenposition von Kolonie Kepler |
|---|---|---|
| **Pay-to-Win** | Vier Offiziere à 3 €, zusammen 12 €/Monat „um keinen Nachteil zu haben"; beim Durchsickern binnen 48 h ein **130-seitiger Protest-Thread** (**teilweise**) | „Kein Pay-to-Win" steht bereits auf der Startseite |
| **Support antwortet nur Zahlenden** | wiederkehrendes Muster in Trustpilot-Bewertungen zu ogame.de (**teilweise**) | Ein Entwickler, der Spieler-Reports direkt in Patchnotes verwandelt – `patchnotes.html` ist der Beweis |
| **Sterbende Universen** | Server-Merges („S252-US Server Merge", Juli 2026); Forum-Thread „This game is actually officially dead" (**teilweise**) | Wachsende Galaxie: zwei neue Systeme jeden Montag |
| **20 Jahre altes Bedienkonzept** | „OGame war der König des Desktop-Zeitalters und passt nicht ins mobile Zeitalter" (**teilweise**) | Die gesamte KB-Reihe ist mobile Bedienbarkeit – ein Verkaufsargument, kein Wartungsposten |

**Die eine Botschaft:** „Weltraumstrategie wie früher – ohne die 12 € im Monat." Nicht zum
Aufsagen, sondern als Raster, durch das jeder Beitrag geht.

**Direkte Nachbarn** (als Landkarte, nicht als Gegner): Drifting Souls 2 (seit 20+ Jahren,
ausdrücklich ohne Bezahlinhalte), Universe Dawn, Stargods, Escape to Andromeda, Alpha Vertikan
Empire 2, XOrbit (**teilweise**). Alle stehen auf denselben deutschen Portalen aus Abschnitt 4.

**In OGame-Foren nicht posten** – Eigenwerbung ist dort verboten, das Risiko steht in keinem
Verhältnis.

---

## 7. Presse und Beta-Tester

| Ziel | Bedingungen | Prio |
|---|---|---|
| Alpha Beta Gamer | größte kostenlose Beta-Test-Seite, deckt Frühphasen ab (**teilweise**; Abruf scheiterte an Serverfehler) | 8 |
| Indie Games Developer | `devcentral.indiegamesdeveloper.com/submit-your-game/` – **kostenlos**, lange Warteschlange, keine Garantie (**teilweise**) | 7 |
| dinogame.gg | schreibt „Best New Browser Games 2026"-Listen – **genau die Nische** (**teilweise**) | 7 |
| gamedevcafe.de | deutsches Forum, **aktiv im August 2026**, Bereich „Projektvorstellung" mit „Vollversionen" (**geprüft**) | 7 |
| Games Press | Presseverteiler für Journalisten (**teilweise**) | 6 |
| indiegamereviewer.com / theindieinformer.com | Indie-Review-Seiten (**ungeprüft**) | 5 |
| gamersglobal.de / gameswirtschaft.de | deutsche Redaktionen (**teilweise**) | 4–5 |
| indiegames-inside.de | aktiv (190 Artikel), stark Steam-orientiert (**teilweise**) | 4 |
| **indieplanet.de** | **still seit 2023 – auslassen** (**teilweise**) | – |
| **forum.worldofplayers.de** | **Browsergame-Thread tot seit 2009, geschlossen, Reflinks verboten** (**geprüft**) | – |

**Beta-Tester:** playtester.io, roastmygame.com, We Playtest Games (erster Test gratis), IndieQA
(gratis gegen Keys), Playcocola (ab ~2 €), r/DestroyMyGame (62.000, kostenlos).

**Die Regel, die 2026 überall wiederholt wird:** 20–30 gezielte Ansprachen schlagen 200
Massenmails (**teilweise**). Wer in den letzten sechs Monaten über Browsergames oder Idle-Spiele
geschrieben hat, wird angeschrieben – mit Bezug auf seinen Artikel.

---

## 8. Creator

**Ehrliche Einschränkung:** YouTube und TikTok waren aus dieser Umgebung heraus nicht abrufbar
(Playwright kam nicht durch den Proxy). **Deshalb keine Liste kleiner Creator mit
Abonnentenzahlen** – erfundene Zahlen wären das schlechteste Ergebnis.

**Namentlich belegt** (aus einer Fachübersicht zu Indie-Games-Creators, **teilweise**; Größen
liegen dort nicht vor, dürften meist über 100k liegen), nach Passung gefiltert:

| Creator | Plattform | Warum passend |
|---|---|---|
| **Nookrium** | YouTube, Twitch | Kolonieaufbau ist sein Kernthema – beste Passung der Liste |
| **SplatterCat** | YouTube, Twitch | Betreibt „Weekly Indie Newcomer" – Format für genau diesen Fall |
| **Alpha Beta Gamer** | YouTube + Website | Doppelkanal: ein Kontakt bringt Video und Artikel |
| KatherineOfSky | YouTube, Twitch | Publikum für langfristigen Aufbau |
| GamerZakh | YouTube, Twitch | „Nostalgic PC Gaming" deckt sich mit der OGame-Positionierung |
| Get Indie Gaming | YouTube + Podcast | „This Week in Indie Games" – laufender Bedarf |
| Best Indie Games (Clemmy) | YouTube | Zusammenstellungen nehmen kleine Titel leichter auf |
| InterndotGif | YouTube | Simulation und Automation |
| I Dream of Indie Games | YouTube, Twitch | Interviewformat passt zur Ein-Mann-Geschichte |
| Indie James | YouTube | Longplays ohne Kommentar, niedrige Schwelle |

**Suchmethode für die kleinen** (besser als jede Liste, die veraltet):

1. YouTube-Suche nach `browsergame 2026`, `idle game review deutsch`, `ogame alternative`,
   `weltraum browsergame`; Filter **dieses Jahr** + **Typ: Kanal**
2. Auf 1.000–100.000 Abonnenten filtern
3. **Der wichtigste Filter:** Hat der Kanal in den letzten drei Monaten ein Spiel **ohne
   Steam-Seite** gezeigt? Wenn nein, streichen
4. Kontakt im Kanal-Reiter „Info", zusammen mit dem Video notieren, auf das man sich bezieht
5. TikTok über `#browsergame`, `#idlegame`, `#indiegame` – dort zählen Aufrufe, nicht Follower
6. Twitch: zuschauerarme Kategorien, Streamer die auf Chatwünsche eingehen (**teilweise**)

**Was in die Anfrage gehört:** ein Link, der sofort funktioniert – kein Key, keine Anmeldung, kein
Download. Das ist der größte Vorteil gegenüber jedem Steam-Indie. Drei Sätze, kein Pressekit-Zip.

---

## 9. SEO

| Begriff | Wettbewerb | Chance | Vorgehen |
|---|---|---|---|
| Kolonie Kepler / Kepler 7 | keiner | **sehr hoch** | Markenname – muss ranken, sonst geht Mundpropaganda ins Leere |
| Weltraum Idle Spiel deutsch | gering | hoch | bereits Keyword der Startseite, mit Links erreichbar |
| **Browsergame ohne Pay to Win** | gering | hoch | **eigene Landingpage bauen** – trifft die Positionierung exakt |
| OGame Alternative deutsch | mittel | mittel | ehrlicher Vergleichsartikel kann mitspielen |
| Weltraum Browsergame | **hoch** | gering | Portale belegen die Plätze – nicht optimieren, sondern *dort hineinkommen* |
| Browsergame kostenlos | sehr hoch | sehr gering | auslassen |

**Vier Maßnahmen nach Wirkung:**

1. **Verzeichniseinträge** (Abschnitt 4) – je rund 10 Minuten, je ein thematisch passender
   Backlink. Bestes Verhältnis von Aufwand zu Wirkung in dieser ganzen Recherche.
   *Bewusst ohne Stückzahl:* Hier stand „17 Einträge“, und die Zahl war schon beim Schreiben
   nicht nachrechenbar (eine Tabellenzeile führt drei Seiten zusammen, eine ist inzwischen
   gestrichen). Eine handgepflegte Zahl neben einer Liste wird immer wieder falsch – die Liste
   selbst ist die Auskunft.
2. **Landingpage „Browsergame ohne Pay-to-Win"** – vier solche Seiten existieren bereits, eine
   fünfte auf den Begriff, der die Positionierung trägt, ist konsequent.
3. **Die Patchnotes sind ein ungenutztes SEO-Vermögen.** `patchnotes.html` steht in der Sitemap mit
   `changefreq: daily` und wird aus dem Spiel erzeugt – regelmäßiger, echter Inhalt. Was fehlt, ist
   die Verbreitung: ein RSS-Feed wäre ein Kanal für sich, und jeder Patchnote ist ein fertiger
   Beitrag für Discord und Reddit.
4. **itch.io, IndieDB, Game Jolt** setzen je einen Link von einer etablierten Domain.

**Suchvolumen wurde nicht gemessen** – die Einschätzungen beruhen darauf, wer aktuell rankt.

---

## 10. Viralität: was ins Spiel gehört

**Das Referral-System existiert bereits** – `referralShareBtn`, `referralCopyLinkBtn`,
`Einladungscode`, `referralRedeemed`, `referralNudgeShown`, dazu ein „Einladung teilen"-Knopf auf
der Startseite (**geprüft**). Was fehlt, ist nicht der Mechanismus, sondern der Moment, in dem
jemand ihn benutzen *will*.

1. **Der teilbare Kampfbericht.** Berichte mit Flotte, Verlusten, Beute und Ausgang existieren; was
   fehlt, ist ein Teilen-Knopf, der daraus ein **Bild** macht (Canvas-Rendering mit Spielername,
   Ergebnis, Adresszeile). Ein Weltboss-Sieg ist ein Moment, den Spieler von selbst zeigen wollen –
   heute nur per Screenshot, und der trägt keinen Link. **Der stärkste Hebel der Liste**, weil er
   keine Werbung verlangt, sondern Angeberei.
2. **Belohnung am Meilenstein, nicht an der Registrierung.** Prämie bei Anmeldung = Zweitkonten.
   Prämie bei „Freund erreicht Stufe 5" oder „spielt drei Tage" = echte Werbung. Passt zur
   Hausregel: Der Server muss die Bedingung **selbst beobachten** können.
3. **Allianzen als Rekrutierungsmaschine.** Eine Allianz hat ein Eigeninteresse zu wachsen, das man
   nicht erzeugen muss. Eigener Allianz-Einladungslink + sichtbares Gemeinschaftsziel („zehn neue
   Mitglieder, dann eine Ausbaustufe für alle"). Damit werben zwanzig Spieler gleichzeitig, bei
   Leuten, die sie persönlich kennen.
4. **Automatische Ereignisbilder** – „Sternenfeste zerstört", „Kolonie Stufe 50", „Platz 3 der
   Wochenliga". Daten liegen vor, es fehlt der Rahmen. Am wirksamsten bei seltenen, schweren
   Ereignissen.
5. **Saisonale Ereignisse als Rückkehr-Anlass.** Ein Idle-Spiel verliert Spieler durch Vergessen,
   nicht durch Ärger. Der Weltboss ist der offensichtliche Kandidat – er braucht viele Spieler
   gleichzeitig, ist also von selbst ein Grund, andere zu holen.

**Die Einschränkung, die alle fünf betrifft:** r/incremental_games verbietet Referral-Links absolut
(**geprüft**) – und dort liegt die beste Zielgruppe. Geteilte Bilder und Links müssen **auch ohne
Einladungscode funktionieren**; der Code gehört als bewusste zweite Wahl gebaut, nicht als Vorgabe.

---

## 11. Was nicht geprüft werden konnte

Diese Liste gehört zum Ergebnis.

- **Reddit war nicht abrufbar** (weder direkt noch per Browser). Zahlen aus einer Statistikseite,
  Regeln aus Fachartikeln.
- **YouTube und TikTok blockiert** – daher Suchmethode statt Creator-Liste mit Zahlen.
- **Facebook-Gruppen: nichts Belastbares gefunden.** Facebook ist von außen schlecht durchsuchbar.
  Lieber nichts aufführen als eine Gruppe erfinden.
- **Deutsche Subreddits: keine Empfehlung** – keiner gefunden, in dem ein Beitrag regelkonform wäre.
- **Der iframe-Weg auf itch.io ist von itch.io nicht bestätigt** – an einer unveröffentlichten
  Seite testen.
- **Einige Portale nicht vollständig lesbar** (browsergames.fm blockt Abrufe, alphabetagamer.com
  antwortete mit Serverfehler).
- **Suchvolumen nicht gemessen.**
- **Der Gastmodus ist verworfen** (Entscheidung Sascha, 21.08.2026). Die Einstiegskette ist
  seitdem gemessen statt vermutet – siehe Abschnitt 2.

---

## 12. Wenn nur drei Dinge passieren

1. **Die Verzeichniseinträge aus Abschnitt 4.** Ein Nachmittag, und das Sichtbarkeitsproblem aus
   Abschnitt 1 ist strukturell angegangen statt beklagt.
2. **Den falschen Satz auf `weltraum-browsergame.html` korrigieren.** Er verspricht einen
   Einstieg, den es nicht gibt – auf genau der Seite, auf der ein Besucher aus einem
   Verzeichnis landet.
3. **Den teilbaren Kampfbericht.** Der einzige Kanal dieser Liste, der mit jedem neuen Spieler
   stärker wird statt schwächer.
