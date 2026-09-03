# Einreichungs-Paket: fertige Texte für Verzeichnisse und Portale

**Zweck:** Alle Texte, die für einen Verzeichniseintrag oder ein Anschreiben gebraucht werden, an
EINER Stelle – damit ein Eintrag Einfügen statt Formulieren ist. Reihenfolge und Begründung stehen
in `marketing-kanaele-recherche.md`.

**Alle Angaben sind aus dem Spiel abgeleitet**, überwiegend aus `weltraum-browsergame.html` – die
Landingpage ist bereits im richtigen Ton geschrieben, und eine zweite, frei erfundene Beschreibung
wäre genau die zweite Anzeigestelle, die dieses Projekt sonst überall vermeidet.

---

## 0. Voraussetzungen, die VOR dem ersten Eintrag geklärt sein müssen

| Was | Warum | Stand |
|---|---|---|
| **E-Mail-Adresse auf `@gamegeeeeek.de`** | `browsermmorpg.com` verlangt sie ausdrücklich und **prüft das Domain-Eigentum** („Must be reachable — we verify ownership"). Auch für die Anschreiben ist ein Domain-Absender glaubwürdiger als eine Freemail-Adresse. | **offen** – im Repo steht keine; das Impressum leitet bewusst zu einem Impressum-Dienst weiter |
| **Ein Screenshot-Satz** | Fast jedes Verzeichnis will mindestens ein Bild. | **erledigt** – `node marketing-screenshots.js` erzeugt fünf Bilder (Basis, Sektorkarte, Forschung, Flotte, Verteidigung) aus dem aktuellen Stand nach `presse-bilder/`. Je ~2 MB in 3200×1800; wo ein Verzeichnis kleiner verlangt, vorher verkleinern. |
| **Die Einstiegshürde** | Siehe Abschnitt 5 – sie entscheidet, wie viel jeder Eintrag überhaupt bringt. | **offen** |

---

## 1. Stammdaten

| Feld | Wert |
|---|---|
| Name | Kolonie Kepler-7 |
| URL | `https://www.gamegeeeeek.de/` |
| Genre | Weltraum-Strategie / Aufbau / Idle (Sci-Fi MMO Strategy) |
| Plattform | Browser (kein Download, kein Plugin), Desktop + Handy |
| Preismodell | Free-to-play, keine Bezahlvorteile |
| Sprache | Deutsch |
| Status | Live, offene Registrierung |
| Kategorie-Wahl | Sci-Fi / Space / Strategy / MMO Strategy / Browser Based |

---

## 2. Beschreibungen (Deutsch)

### Ein Satz (für Listen und Tooltips)

> Kostenloses Weltraum-Aufbauspiel im Browser: Kolonie ausbauen, forschen, Flotten bauen und in
> einer gemeinsamen Galaxie gegen andere Spieler antreten – ohne Download und ohne Bezahlvorteile.

### Max. 250 Zeichen (`browsermmorpg.com` begrenzt darauf, reiner Text)

> Weltraum-Aufbauspiel im Browser. Baue deine Kolonie aus, erforsche Technologien, stelle eine
> Flotte auf und teile dir mit allen Spielern eine Galaxie. Idle-Fortschritt läuft offline weiter.
> Kostenlos, kein Download, keine Bezahlvorteile.

*(246 Zeichen)*

### Mittel (~500 Zeichen, für die meisten Verzeichnisse)

> Kolonie Kepler-7 ist ein Weltraum-Aufbauspiel, das komplett im Browser läuft – ohne Client, ohne
> Plugin, auf Rechner und Handy mit demselben Spielstand.
>
> Du beginnst mit einem Planeten und baust ihn Gebäude für Gebäude aus. Sechs Ressourcen, ein
> Forschungsbaum von Solarzellen bis Singularitätsphysik, über zwanzig Schiffstypen mit
> Konterrollen. Weitere Kolonien und Monde bekommen eigene Rollen: Bergbau, Forschung, Festung,
> Handel oder Logistik.
>
> Alle Spieler teilen sich dieselbe Galaxie. Jeden Montag kommen neue Sternsysteme dazu, vier
> NPC-Fraktionen führen untereinander Krieg, und Allianzen greifen gemeinsam Weltbosse an. Neue
> Konten haben vier Tage Anfängerschutz.
>
> Die Produktion läuft offline weiter – wer eine Woche keine Zeit hatte, findet seine Kolonie nicht
> ruiniert vor. Es gibt keine Abos, keine Lootboxen und keine Bezahlvorteile; Spenden bringen
> ausschließlich Kosmetik. Kein Tracking, keine Werbung.

### Lang (für `browsermmorpg.com`, HTML erlaubt)

```html
<h2>Ein Weltraum-Imperium im Browser</h2>
<p>Kolonie Kepler-7 ist ein Aufbau- und Strategiespiel, das ohne Client und ohne Plugin läuft.
Derselbe Spielstand liegt auf dem Server – du spielst am Rechner weiter, was du unterwegs am Handy
begonnen hast.</p>

<h3>Aufbauen</h3>
<p>Du startest mit einem Planeten. Energie versorgt alles Weitere, Erz, Kristalle und Deuterium sind
die Grundstoffe, Antimaterie und Forschungspunkte öffnen später die anspruchsvollen Zweige. Jede
Gebäudestufe kostet mehr und dauert länger – die Frage ist nie, was du bauen kannst, sondern was
zuerst. Wer weit kommt, trifft auf eine zweite Wirtschaftsstufe: Nanolegierungen, Quantenchips und
Fusionskerne werden in eigenen Fabriken hergestellt und schalten die stärksten Anlagen frei.</p>

<h3>Forschen und Flotten aufstellen</h3>
<p>Der Forschungsbaum reicht von besseren Solarzellen bis zu Leerentechnologie und
Singularitätsphysik und läuft auch offline weiter. Über zwanzig Schiffstypen decken Erkundung,
Fracht und Kampf ab – mit Konterrollen: Eine reine Masse eines Typs ist selten die beste Antwort.</p>

<h3>Eine geteilte Galaxie</h3>
<p>Alle Spieler bewegen sich in derselben Galaxie. Jeden Montag kommen neue Sternsysteme dazu. Vier
NPC-Fraktionen besitzen eigene Gebiete, erweitern sie selbstständig und führen untereinander Krieg –
das läuft auf dem Server weiter, auch wenn niemand zusieht. Dazu Asteroidenfestungen und
Alien-Nester als gemeinsame Ziele, Allianzen mit eigener Basis und Weltbosse, die eine einzelne
Flotte nicht bezwingt.</p>

<h3>Kostenlos heißt hier kostenlos</h3>
<p>Keine Abos, keine Lootboxen, keine Bezahlvorteile. Wer freiwillig spendet, bekommt Titel und
Farbschemata – keinen Vorteil in Kampf, Produktion oder Bestenliste. Auf der Seite läuft kein
Tracking und keine Werbung. Neue Konten haben vier Tage Anfängerschutz.</p>
```

---

## 3. Beschreibungen (Englisch, für die internationalen Verzeichnisse)

**Hinweis:** Das Spiel ist auf Deutsch. Die englische Beschreibung muss das **sagen** – sonst kommen
Spieler, die sofort wieder gehen, und das schadet der Bewertung im Verzeichnis mehr, als der Eintrag
nützt.

### Max. 250 Zeichen

> Browser-based space empire builder, in German. Expand your colony, research technologies, build
> fleets and share one galaxy with every other player. Production keeps running while you are
> offline. Free, no download, no pay-to-win.

*(230 Zeichen – die Grenze bei browsermmorpg.com liegt bei 250, reiner Text ohne Zeilenumbrüche)*

### Lang, englisch (für das Feld „Long description" bei browsermmorpg.com – HTML erlaubt, keine Skripte)

```html
<h2>A space empire that runs in your browser</h2>
<p>Kolonie Kepler-7 needs no client and no plugin. Your save lives on the server, so you continue on your desktop what you started on your phone. <strong>The game is in German.</strong></p>

<h3>Build</h3>
<p>You start with a single planet. Energy powers everything else; ore, crystals and deuterium are the raw materials; antimatter and research points open the demanding branches later. Every building level costs more and takes longer, so the question is never what you can build, but what you build first. Further out, a second economy tier waits: nano alloys, quantum chips and fusion cores are manufactured in dedicated factories and unlock the strongest ships and defences.</p>

<h3>Research and fleets</h3>
<p>The research tree runs from better solar panels to void technology and singularity physics, and it keeps progressing while you are away. More than twenty ship classes cover scouting, freight and combat — with counter roles, so massing a single type is rarely the best answer.</p>

<h3>One shared galaxy</h3>
<p>Every player moves through the same galaxy, and new star systems appear every Monday. Four NPC factions hold their own territory, expand on their own and wage war on each other — that continues on the server whether anyone is watching or not. Asteroid fortresses and alien nests are shared targets, alliances build a joint base, and world bosses cannot be brought down by a single fleet.</p>

<h3>Free means free</h3>
<p>No subscriptions, no loot boxes, no paid advantages. Donations unlock titles and colour schemes — never an edge in combat, production or the leaderboard. No tracking and no ads. New accounts get four days of beginner protection.</p>
```

### Mittel

> Kolonie Kepler-7 is a space colony builder that runs entirely in the browser – no client, no
> plugin, same save on desktop and mobile. **The game is in German.**
>
> Start with one planet and expand it building by building: six resources, a research tree from
> solar panels to singularity physics, and more than twenty ship classes with counter roles.
> Additional colonies and moons take on roles – mining, research, fortress, trade or logistics.
>
> All players share one galaxy. New star systems appear every Monday, four NPC factions wage war on
> each other, and alliances team up against world bosses. New accounts get four days of beginner
> protection.
>
> Production continues while you are offline. No subscriptions, no loot boxes, no paid advantages –
> donations only unlock cosmetics. No tracking, no ads.

---

## 4. Feldangaben je Verzeichnis

### browsermmorpg.com/register_game — **kostenlos, Priorität 1**

| Feld | Eintrag |
|---|---|
| Game name | `Kolonie Kepler-7` (keine Werbewörter – wird ausdrücklich verlangt) |
| Official URL | `https://www.gamegeeeeek.de/` – **ohne Referrer-Code**, wird ausdrücklich verlangt |
| Official game email | **muss auf `@gamegeeeeek.de` liegen** und erreichbar sein – Eigentum wird geprüft |
| Category | `Sci-Fi` |
| Short description | die 250-Zeichen-Fassung (Englisch), reiner Text, kein HTML |
| Long description | der HTML-Block aus Abschnitt 2, ins Englische übertragen |

Menschliche Freigabe – der Eintrag erscheint nicht sofort.

### thebigmmorpglist.com/submit-game/

Elf Felder, **kein Captcha, kein Bildupload, keine Zeichenlimits** (am Formular geprüft, 21.08.2026).
Reihenfolge wie dort:

| # | Feld | Eintrag |
|---|---|---|
| 1 | Game Name | `Kolonie Kepler-7` |
| 2 | Game Website | `https://www.gamegeeeeek.de/` |
| 3 | Your Name | Saschas Name |
| 4 | Your Email | dieselbe wie bei browsermmorpg.com |
| 5 | Game Description | mittlere englische Fassung (Abschnitt 3) |
| 6 | Game Type | `MMO Strategy` |
| 7 | Graphics | `2D` |
| 8 | Client Type | `Browser Based` |
| 9 | Point of View | `Multi` |
| 10 | Subscription | `Free` |
| 11 | Retail Price | `Free` |

**Zwei Auswahlfelder brauchen eine Begründung, weil die naheliegende Antwort falsch wäre:**

- **Client Type → `Browser Based`, nicht `Multiple`.** Die Liste bietet `Multiple` an, und das Spiel
  läuft auf Desktop *und* Handy – aber beides im Browser. `Multiple` bedeutet verschiedene Client-
  ARTEN (Download-Client **und** Browser), weckt also eine Erwartung, die der Eintrag nicht hält.
- **Point of View → `Multi`.** Ehrlicherweise passt keine der vier Optionen: Kolonie Kepler hat
  keine Perspektive im klassischen Sinn, es ist eine Kommandozentrale mit Karte. `Multi` ist die
  harmloseste; `Third Person` oder `Side-scrolling` wären schlicht falsch.

### browsergame-base.de — **per E-Mail, Vorlage in Abschnitt 6**

Kategorien dort: **Weltraum** („Science-Fiction und Weltraumspiele") und **Strategie**.

### browsergame-index.de/browsergame-melden

Formularweg; Kontakt `webmaster@browsergame-index.de`. Kategorie Weltraum vorhanden.
*Die Seite wirkt eingeschlafen (News zuletzt 2010) – der Eintrag zählt vor allem als Backlink.*

### bbogd.com/addgame — **kostenlos**

Am Original geprüft (21.08.2026). **Zwei Abweichungen von der Recherche-Notiz:** Das Formular liegt
unter `/addgame`, nicht unter `/submit-game/` (diese Adresse antwortet mit 404), und es verlangt
**vorher ein Konto**. Kein Captcha, keine Zeichengrenze, Bild-Uploads (Banner, Avatar) sind optional.
Die Seite bezeichnet sich selbst als „Browser Based Online Game Directory where players can submit,
vote, rate and discuss their favorite games" — passt also genau.

| Feld | Wert |
|---|---|
| Name | `Kolonie Kepler-7` |
| URL | `https://www.gamegeeeeek.de/` |
| FB | *leer lassen* |
| Can connect with Facebook? | **nicht** ankreuzen |
| Released (Month) | `7` |
| Released (Year) | `2026` |
| Categories | **Space**, **Strategy**, **Simulation** |
| Interface | **Web Browser** |
| Graphics | **2D Dimension** |
| Plugins | **None** |
| In Beta | **No** |
| Description | mittlere englische Fassung aus Abschnitt 3 |
| Vote Link | *steht auf „Unavailable" — nichts eintragen* |
| Callback | *leer lassen* |

**Vier Felder, bei denen der naheliegende Wert der falsche wäre:**

- **Released 7/2026 ist gemessen, nicht geschätzt.** Der älteste Patchnote-Eintrag ist `1.0.0` vom
  **10.07.2026**; die Versionen bis `4.1.1` liegen alle auf demselben Tag. Das ist der Start der
  Historie und damit die beste verfügbare Auskunft.
- **FB bleibt leer, weil es keine Facebook-Seite gibt.** Gemessen an allen ausgelieferten
  HTML-Dateien: Discord, Instagram (`@GameGeeeeek`), TikTok und YouTube (beide `@GameGeeeeek`) sind
  verlinkt — Facebook nicht. Ein erfundener Eintrag wäre ein toter Link im Verzeichnis.
- **Graphics „2D Dimension", nicht „Illustrated".** Die Karte ist gezeichnetes SVG mit beweglichen
  Knoten, keine Sammlung fester Illustrationen. „Text Based" wäre schlicht falsch.
- **In Beta „No".** Das Spiel läuft seit Juli 2026 mit Spielern und trägt heute v8.594.0. „Yes"
  wäre eine Ausrede, die die Bewertung drückt, ohne etwas zu gewinnen.

### mmorpg.com/games-list — **redaktionell, kein Selbsteintrag**

Am Original geprüft (21.08.2026). Die Seite hat eine Browser-Games-Kategorie, aber der Weg dorthin
ist ein **Google-Formular** und ausdrücklich eine Bewerbung, keine Eintragung: „to submit a game
you'd like to have **considered** for inclusion on this list".

Formular: `https://docs.google.com/forms/d/1jMevWFLPUNOjz5oAFOMF2S-IJcu4Ku3u3qndoD5TVvY/viewform`

Die Felder ließen sich von hier aus nicht auslesen (Google-Formulare bauen sich per Skript auf).
Erwartungshaltung: Aufwand fünf Minuten, Ergebnis ungewiss — anders als bei den Verzeichnissen oben
entscheidet dort eine Redaktion. Deshalb **nach** den sicheren Einträgen, nicht davor.

### ~~mmohub.com~~ — **passt nicht, gestrichen**

Am Original geprüft (21.08.2026): Die Seite listet **ausschließlich Private Server** („Top MMORPG
private servers", Kategorien Aion, Lineage, MU Online, WoW). Kolonie Kepler-7 ist kein Private
Server, sondern ein eigenes Spiel — ein Eintrag dort wäre off-topic und nichts weiter als ein
Spam-Risiko ohne Gegenwert.

Die Recherche hatte den Eintrag als **teilweise belegt** geführt („Toplist nach Stimmen"). Das war
richtig beschrieben und trotzdem der falsche Schluss: *wonach* die Toplist sortiert, sagt nichts
darüber, *was* dort überhaupt gelistet werden darf. **Übertragbar für die restlichen Verzeichnisse:
Vor dem Ausfüllen erst prüfen, welche ART von Eintrag die Seite sammelt — nicht nur, ob sie ein
Formular hat.**

### itch.io — **kostenlos, HTML5-Projekt**

An der itch.io-Dokumentation geprüft (21.08.2026). Die Startkarte liegt fertig gepackt vor;
`itch-wrapper/README.md` erklärt, warum sie **kein iframe** ist.

**Technische Grenzen** (verbatim aus der Doku): entpackt höchstens 500 MB, eine Einzeldatei
höchstens 200 MB, höchstens 1.000 Dateien, Dateiname samt Pfad höchstens 240 Zeichen. Unser
ZIP: **eine Datei, 4,4 kB**. Dazu zwei Regeln, die wir einhalten und die gemessen sind: externe
Ressourcen nur über HTTPS (wir haben genau eine, den Link aufs Spiel) und keine absoluten Pfade.

| Feld | Wert |
|---|---|
| Title | `Kolonie Kepler-7` |
| Short description | `Weltraum-Aufbauspiel im Browser: Kolonie ausbauen, Flotte aufstellen, geteilte Galaxie. Kein Pay-to-Win. Auf Deutsch.` |
| Classification | **Game** |
| Kind of project | **HTML** („play in browser") |
| Release status | **Released** |
| Pricing | **No payments** |
| Uploads | `kolonie-kepler-7-itch.zip` (2 Dateien: `index.html` + `kulisse.js`, 23 kB), Haken bei **„This file will be played in the browser"** |
| Embed | **Embed in page**, Breite `960`, Höhe `600` |
| Mobile friendly | **an** (die Karte ist am Hochformat gemessen) |
| Fullscreen button | **aus** – eine Startkarte braucht keinen |
| Genre | **Strategy** |
| Tags | `browser`, `space`, `idle`, `incremental`, `multiplayer`, `strategy`, `management`, `german`, `no-pay-to-win`, `4x` (itch.io erlaubt **bis zu 10**) |
| Cover image | `presse-bilder/itch-cover.jpg` (630×500 – erzeugt mit `node itch-wrapper/theme-bauen.js`) |
| Screenshots | 3–5 aus `presse-bilder/` (`node marketing-screenshots.js`) |
| Visibility | erst **Draft**, dann **Public** |

### Die Theme-Seite (Dashboard → *Edit theme*)

Alle Bilder liegen nach `node itch-wrapper/theme-bauen.js` in `presse-bilder/`.

| Feld auf der Theme-Seite | Datei | Größe | Gewicht |
|---|---|---|---|
| **Banner** | `itch-banner.jpg` | 960×300 (Datei 1920×600) | 90 kB |
| **Background** | `itch-hintergrund.png` | 1600×1000 (1:1), kachelbar | 14 kB |
| **Embed BG** | `itch-embed-bg.jpg` | 960×600 (Datei 1920×1200) | 129 kB |

**Warum drei JPEG und ein PNG, und warum die Textur bei einfacher Auflösung bleibt** – beides
gemessen, nicht nach Geschmack entschieden. Der Inhalt der drei Bildflächen ist fast
ausschließlich weicher Verlauf (Planetenkörper, Terminator, Nebel), und daran scheitert PNG:
Es speichert jeden Farbwert verlustfrei und kann aus einem Verlauf nichts wegnehmen. Der
Seitenhintergrund umgekehrt ist nach dem Wegfall des Nebels fast leer – dort wäre JPEG falsch,
weil es um jeden Stern Ringe malte und die harte Kante dort der ganze Inhalt ist.

| | vorher (alles PNG, alles 2×) | jetzt |
|---|---|---|
| Cover | 877 kB | **95 kB** |
| Banner | 787 kB | **90 kB** |
| Hintergrund | 2.026 kB | **14 kB** |
| Embed BG | 1.508 kB | **129 kB** |
| **Summe** | **5,2 MB** | **328 kB** |

Banner und Hintergrund laden bei **jedem** Aufruf der Spielseite mit – das waren zusammen
1,4 MB, bevor ein Besucher ein Wort gelesen hatte.

**Die Größen sind abgeleitet, nicht abgeschrieben.** itch.io nennt für diese drei in seiner
Doku (`itch.io/docs/creators/design`, geprüft 21.08.2026) **keine** Pixelmaße – nur, dass der
Banner „replaces the title otherwise shown just above the description" und der Hintergrund
„more subtle" sein soll. Die 960 sind an der fertigen Seite **gemessen**: Die 960 px breite
Einbettung füllt die Inhaltsspalte exakt von Kante zu Kante.

**Der Banner ersetzt die Überschrift.** Deshalb steht der Spielname darin. Ein Banner ohne
Namen löscht den Titel der Seite, statt ihn zu schmücken – das ist keine Geschmacksfrage.

**Der Hintergrund kachelt, und das ist die einzige harte Anforderung an ihn.** Er hat deshalb
keinen großflächigen Verlauf (der ergäbe an der Wiederholungskante hell-auf-dunkel), sondern
eine flache Grundfarbe und am Rand umgeschlagene Sterne. `theme-bauen.js` **misst** das nach
und meldet es je Lauf (`Naht x=0.000/innen 0.158 … [nahtlos]`); die Gegenprobe ohne Umschlag
liefert `Naht x=1.315` und `[NAHT SICHTBAR]`, Exit 1. Ein Blick auf die einzelne Kachel könnte
eine Naht gar nicht zeigen – die entsteht erst beim Wiederholen.

**Die Embed BG zeigt bei der eingestellten Einbettung NICHTS.** Die Doku
(`itch.io/docs/creators/html5`) beschreibt sie wörtlich als „A image that takes up the size of
the viewport that sits behind the *Play* button" – und den Play-Knopf gibt es nur im Modus
**„Click to play"**. Die Seite steht auf **„Embed in page"** (Tabelle oben), die Startkarte
lädt also sofort und füllt ihre 960×600 vollständig. Die Datei ist trotzdem dabei, damit sie
da ist, falls der Modus je wechselt.
**Von „Click to play" wird abgeraten, und das ist gerechnet:** Die Einbettung *ist* schon eine
Startkarte mit Knopf. Mit „Click to play" bräuchte ein Spieler **drei** Klicks bis ins Spiel
(Play → Startkarte → eigener Tab) statt zwei.

**Farben dazu (Bereich COLOR auf derselben Seite).** Der Hintergrund ist dunkel, die Seite
steht aber auf Hellgrau – ohne Anpassung blitzt vor dem Laden des Bildes eine helle Fläche auf
und der Rand bleibt hell, wo das Bild nicht reicht:

| Feld | bisher | empfohlen | warum |
|---|---|---|---|
| BG | `#eeeeee` | `#0B1020` | dieselbe Farbe wie das Hintergrundbild – kein Aufblitzen, keine helle Kante |
| BG 2 | `#ffffff` | **unverändert** | der Inhaltskasten bleibt weiß, die Beschreibung damit gut lesbar |
| Text | `#222222` | **unverändert** | steht auf BG 2, nicht auf dem Bild |
| Link | `#fa5c5c` | `#F09849` | die Akzentfarbe des Spiels statt itch.ios Vorgaberot |

### Was die LIVE-Seite am 21.08.2026 wirklich zeigte – gemessen, nicht angenommen

Die Seite steht: **https://gamegeeeeek.itch.io/kolonie-kepler-7** (Cover, Banner, Hintergrund,
fünf Screenshots, neun Tags, Genre Strategy, HTML5). Gemessen wurde am **rohen HTML** der Seite,
nicht am Eindruck – und drei Dinge weichen von der Tabelle oben ab:

| Befund | Messung | Folge |
|---|---|---|
| **Die Beschreibung ist LEER** | kein `formatted_description`-Block im HTML | Die Seite hat **gar keinen Text**. Der fertige liegt unten in diesem Abschnitt. |
| **Modus ist „Click to play"** | `iframe_placeholder` + `load_iframe_btn` + „Run game" | Ein Klick mehr bis ins Spiel (siehe unten) |
| **Farben unverändert** | `--itchio_bg_color: #eeeeee`, `--itchio_link_color: #fa5c5c` | Die zwei empfohlenen Änderungen sind noch nicht gesetzt |

**Die leere Beschreibung ist der mit Abstand teuerste Punkt.** Sie ist das einzige Feld, das
erklärt, was das Spiel ist; sie trägt jedes Suchwort, über das jemand die Seite findet; und sie
steht direkt unter der Einbettung, also genau dort, wohin ein Besucher nach dem ersten Blick
schaut. Ein Eintrag ohne sie ist ein Bild mit einem Knopf.

**Zum Modus, und es ist eine echte Abwägung statt eines Fehlers:** „Click to play" ist der
einzige Modus, in dem die **Embed BG** überhaupt erscheint – dafür kostet er einen Klick mehr.
Gezählt:

| Modus | Weg bis ins Spiel |
|---|---|
| **Embed in page** *(empfohlen)* | Startkarte steht sofort → **1 Klick** → Spiel im eigenen Tab |
| Click to play | „Run game" → Startkarte lädt → **2 Klicks** → Spiel im eigenen Tab |

Die Empfehlung bleibt **Embed in page**, und seit dem 21.08.2026 hat sie einen zweiten Grund:
Die Startkarte zeichnet jetzt selbst einen animierten Planeten mit kreisenden Verbänden. Sie ist
damit das bessere Standbild als die Embed BG – und sie steht sofort da, statt hinter einem Knopf.

**Was die AI-Kennzeichnung angeht** (die Seite trägt „AI Assisted" für Code, Graphics, Sounds,
Text): itch.io wendet darauf **keine automatische Filterung an** – die Angabe erzeugt virtuelle
Tags, nach denen Besucher *positiv* filtern können, und pflichtig ist sie nur für Asset-Ersteller.
Eine Sache ist dabei gemessen und gehört genannt: Das Spiel enthält **keine einzige Tondatei**
(`find` über das Repo: null Treffer für mp3/ogg/wav/m4a, kein `new Audio`). Seine Klänge entstehen
zur Laufzeit aus `webkitAudioContext` + `createOscillator` – also aus **Code**, nicht aus
generierten Audio-Assets. Ob „Sounds" damit zutrifft, ist Saschas Entscheidung; die Messung sagt
nur, worüber entschieden wird.

**Drei Feldwerte mit Begründung, weil der naheliegende falsch wäre:**

- **Pricing „No payments", nicht „Donate".** Das Spiel nimmt Spenden über Ko-fi entgegen, aber
  nicht über itch.io – ein Spendenknopf dort führte ins Leere bzw. an eine Kasse, die nichts mit
  dem Spiel zu tun hat.
- **Release status „Released", nicht „In development".** Das Spiel läuft seit Juli 2026 mit
  Spielern. „In development" senkt die Erwartung und damit den Klick, ohne etwas zu gewinnen.
- **`german` gehört in die Tags.** Die Startkarte sagt es, die Beschreibung sagt es – und ein
  englischsprachiger Besucher, der es erst nach dem Klick merkt, geht sofort wieder. Eine
  Absprungrate schadet dem Eintrag mehr, als der zusätzliche Klick nützt.

#### Beschreibungstext für das itch.io-Feld

**Reiner Text, keine HTML-Tags** — itch.io hat einen Rich-Text-Editor, kein HTML-Feld. Die
HTML-Fassung aus Abschnitt 2 („Lang") würde dort ihre Tags sichtbar mit ausgeben.

**Deutsch zuerst, Englisch darunter, und das ist eine Entscheidung:** Das Spiel IST deutsch, also
gehört die deutsche Fassung nach oben. Der englische Block darunter ist keine Übersetzung, sondern
eine Vorwarnung in vier Sätzen — ein internationaler Besucher soll in fünf Sekunden wissen, woran er
ist, statt es nach dem Klick zu merken. Dieselbe Begründung wie beim `german`-Tag.

```
Kolonie Kepler-7 ist ein Weltraum-Aufbauspiel, das komplett im Browser läuft. Kein Download, kein
Plugin, kein Konto bei einem Store. Dein Spielstand liegt auf dem Server – du spielst am Rechner
weiter, was du unterwegs am Handy begonnen hast.

AUFBAUEN

Du startest mit einem Planeten. Energie versorgt alles Weitere, Erz, Kristalle und Deuterium sind
die Grundstoffe, Antimaterie und Forschungspunkte öffnen später die anspruchsvollen Zweige. Jede
Gebäudestufe kostet mehr und dauert länger – die Frage ist nie, was du bauen kannst, sondern was
zuerst. Weiter hinten wartet eine zweite Wirtschaftsstufe: Nanolegierungen, Quantenchips und
Fusionskerne aus eigenen Fabriken.

FORSCHEN UND FLOTTEN AUFSTELLEN

Der Forschungsbaum reicht von besseren Solarzellen bis zu Leerentechnologie und
Singularitätsphysik – und läuft weiter, während du offline bist. Über zwanzig Schiffstypen decken
Erkundung, Fracht und Kampf ab, mit Konterrollen: Eine reine Masse eines Typs ist selten die beste
Antwort.

EINE GETEILTE GALAXIE

Alle Spieler bewegen sich in derselben Galaxie. Jeden Montag kommen neue Sternsysteme dazu. Vier
NPC-Fraktionen besitzen eigene Gebiete, erweitern sie selbstständig und führen untereinander Krieg –
das läuft auf dem Server weiter, auch wenn niemand zusieht. Dazu Asteroidenfestungen und
Alien-Nester als gemeinsame Ziele, Allianzen mit eigener Basis, und Weltbosse, die eine einzelne
Flotte nicht bezwingt.

KOSTENLOS HEISST HIER KOSTENLOS

Keine Abos, keine Lootboxen, keine Bezahlvorteile. Wer freiwillig spendet, bekommt Titel und
Farbschemata – keinen Vorteil in Kampf, Produktion oder Bestenliste. Auf der Seite läuft kein
Tracking und keine Werbung. Neue Konten haben vier Tage Anfängerschutz.

Das Spiel läuft auf einem Raspberry Pi bei mir zu Hause. Entwickelt von einer Person, fast täglich
aktualisiert – die Patchnotes sind öffentlich.

---

PLEASE NOTE: THE GAME IS IN GERMAN

Kolonie Kepler-7 is a space colony builder that runs entirely in the browser – no client, no
plugin, same save on desktop and mobile. The interface and all texts are German only.

Build up a colony across six resources, work through a research tree from solar panels to
singularity physics, and field more than twenty ship classes with counter roles. All players share
one galaxy: new star systems appear every Monday, four NPC factions wage war on each other, and
alliances team up against world bosses. Production continues while you are offline.

No subscriptions, no loot boxes, no paid advantages – donations only unlock cosmetics. No tracking,
no ads. New accounts get four days of beginner protection.
```

**Zwei Sätze, die bewusst drinstehen:** „läuft auf einem Raspberry Pi bei mir zu Hause" und „von
einer Person entwickelt" — auf itch.io ist das kein Makel, sondern genau das, wofür die Plattform
da ist. Auf einem kommerziellen MMO-Verzeichnis wäre es fehl am Platz und steht dort deshalb nicht.

**Der Vorbehalt bleibt und gehört benannt:** Ob itch.io die Startkarte als vollwertiges
HTML5-Spiel indexiert, ist **nicht bestätigt**. Ein Admin-Zitat sagt über Seiten, die im Kern ein
externer Link sind: „it may not match our community guidelines so you may not get indexed in our
search and browse pages." Das Risiko ist asymmetrisch – schlimmstenfalls bleibt der Eintrag
un-indexiert, also genau der Zustand, den ein reiner Link ohnehin gehabt hätte. Deshalb erst als
**Draft** anlegen und ansehen, bevor er öffentlich wird.

### Nachgemessen am 03.09.2026: „eingereicht" ist nicht „gelistet"

Beide internationalen Verzeichnisse wurden am 21.08.2026 eingetragen, und beide haben eine
**menschliche Freigabe**. Zwei Wochen später nachgesehen — und zwar nicht am Formular, sondern am
Ergebnis (Hausregel 61: die Wirkung messen, nicht das Etikett):

**thebigmmorpglist.com — der Eintrag ist NICHT gelistet.** Dreifach abgesichert:

| Prüfung | Ergebnis |
|---|---|
| Sitemap: 523 Seiten unter `/game/` | **0** Treffer für „kepler" |
| `GET /game/kolonie-kepler-7/` | **404** |
| Gegenkontrolle `GET /game/travian/` | **200**, 18.805 B, `<title>Travian \| TheBigMMORPGList.com` |
| Negativkontrolle `GET /game/gibtesnicht-xyz-123/` | **404** — dasselbe Verhalten wie Kepler |

Die Sitemap-Suche deckt auch einen abweichenden Slug ab: Unter allen 523 Spielseiten kommt
„kepler" kein einziges Mal vor.

**browsermmorpg.com — von hier aus NICHT feststellbar.** Die Seite baut ihre Suche im Browser auf;
`/search` liefert mit und ohne Suchbegriff **byte-identische** 90.557 Bytes und dieselben 20
Spiele, filtert also nicht. Ein `sitemap.xml` gibt es nicht (404). **Das heißt ausdrücklich nicht
„nicht gelistet"** — es heißt, dass die Frage einen Blick von Hand braucht.

**Drei Fehlversuche, die zur Methode gehören** (sonst wiederholt sie jemand): `search.php?q=` bei
browsermmorpg existiert gar nicht (**404** — geratene Adresse, Hausregel 4); die Suche bei
thebigmmorpglist findet auch „ogame" und „travian" nicht, taugt also selbst nicht als Beleg; und
**beide** Seiten haben einen Catch-All, bei dem ein erfundener Slug mit **200** antwortet. Erst die
Unterscheidung über **Größe und Titel** trennt einen echten Eintrag von der Auffangseite — genau
dieselbe Falle wie beim eigenen Server (`marketing-kanaele-recherche.md`, Abschnitt 13).

**Was daraus folgt:** Bei beiden lohnt ein Nachfassen. Bei browsermmorpg.com genügt ein Blick ins
eigene Konto; bei thebigmmorpglist.com ist eine kurze Nachfrage über `/contact-us/` angebracht —
die Einreichung ist entweder noch in der Warteschlange oder untergegangen. **Ein Eintrag, den
niemand freigegeben hat, ist keine Reichweite.**

### pwa.directory — **kostenlos**, neu am 03.09.2026

Der einzige Kanal dieser Liste, der das Spiel als **PWA** listet statt als Browserspiel. Er passt,
weil er nur verweist: Das Spiel bleibt auf `gamegeeeeek.de`, mit Backend, Konto und Mehrspieler.
Am Quelltext geprüft (03.09.2026): 660 gelistete PWAs, Kategorie **Games** vorhanden, 30 Treffer
für „2026" — die Seite ist aktiv. Wörtlich zur Aufnahme:

> „The catalogue combines discovered public PWAs and submitted listings. […] submitted and paid
> listings are reviewed before approval. Paid placement is always labelled Featured or Sponsored."

Es gibt also eine redaktionelle Freigabe. **Der kostenlose Weg heißt dort „Submit free"**; daneben
steht ein bezahltes „Pro Launch · $49" — das ist Hervorhebung, keine Voraussetzung.

**Die Feldnamen des Formulars konnten NICHT abgelesen werden** — es wird erst im Browser
aufgebaut, im Quelltext steht nur der Formularname. Sie werden deshalb hier nicht geraten
(Hausregel 4). Was das Formular erfahrungsgemäß braucht, liegt aber vollständig vor:

| Was gebraucht wird | Wert |
|---|---|
| Name | Kolonie Kepler-7 |
| URL | `https://www.gamegeeeeek.de/` |
| Kategorie | **Games** |
| Kurzbeschreibung | der 250-Zeichen-Text aus Abschnitt 2 (deutsch) bzw. Abschnitt 3 (englisch) |
| Manifest | `https://www.gamegeeeeek.de/manifest.json` — liegt vor, `200 application/json` |
| Icon | `icon-512.png`, live erreichbar |
| Screenshots | die fünf aus `presse-bilder/` (`node marketing-screenshots.js`) |
| Preis | kostenlos → „Free"-Abzeichen |

**Erwartung ehrlich halten:** 660 Einträge sind ein kleines Verzeichnis. Der Wert liegt fast
vollständig im eingehenden Link, nicht in einem Besucherstrom. Der Eintrag kostet Minuten und
ersetzt keinen der Punkte weiter oben.

**Zwei Nachbarn geprüft, beide nicht nutzbar:** `appsco.pe` ist **tot** (HTTP 503).
`findpwa.com` antwortet mit `200`, liefert aber **33 Bytes** — von hier aus nicht beurteilbar
(**ungeprüft**, nicht „tot").

**Der große PWA-Kanal ist ein eigenes Dokument:** Google Play über eine Trusted Web Activity —
siehe `google-play-pwa.md`. Er ist der aufwendigste offene Kanal und ausdrücklich **nicht** der
erste Schritt.

## 5. Was die Einträge wert sind – die offene Frage

**Gemessen am Backend (`server.js`, Registrierung und Login):** Ein neuer Spieler braucht

1. Kommandantenname
2. Passwort (mind. 8 Zeichen, wird gegen 2.122 bekannte Passwörter geprüft)
3. **E-Mail-Adresse – Pflicht**
4. Postfach öffnen
5. **Bestätigungslink klicken** – ohne ihn antwortet der Login mit `403, needsVerification`
6. zurück zum Spiel, anmelden

Erst dann läuft das Spiel. Das ist Double-Opt-In und hat einen guten Grund (Zweitkonten sind bei
PvP und einem Referral-System ein echtes Problem) – aber es ist die härteste Stelle der ganzen
Kette, und sie liegt **außerhalb der Seite**: Schritt 4 findet im Postfach statt.

**Für das Marketing heißt das:** Jeder Kanal aus der Recherche führt Besucher in diese Kette. Wie
viele davon ankommen, entscheidet, ob ein Verzeichniseintrag zehn Spieler bringt oder einen.
Solange das nicht entschieden ist, sind die Einträge trotzdem richtig – sie kosten wenig und der
Backlink wirkt unabhängig davon. **Ein einmaliger Reddit-Beitrag ist dagegen ein Schuss, der sich
nicht wiederholen lässt**, und der sollte warten, bis die Kette steht.

**Ein Widerspruch, der unabhängig davon behoben gehört:** `weltraum-browsergame.html` sagt heute
„Kein Client, kein Plugin, kein App-Store – Seite aufrufen, Kommandantennamen wählen, loslegen."
Das stimmt nicht: Ohne E-Mail und Bestätigungsklick legt niemand los. Das ist die klassische zweite
Anzeigestelle mit der alten Annahme (Punkt 6 der Checkliste), nur auf einer Landingpage statt im
Spiel – und es ist die erste Seite, die ein Besucher aus einem Verzeichnis sieht.

---

## 6. E-Mail-Vorlagen

**Alle vier Adressen am 21.08.2026 am Original geprüft.** Die Reihenfolge hat sich dabei geändert:
Zwei der Seiten, die in der Recherche auf Prio 9 und 8 standen, haben **gar keinen
Einreichungsweg** — sie sind redaktionell kuratiert. Dorthin geht ein *Pitch*, keine Eintragung, und
der Text muss anders klingen.

| Empfänger | Adresse | Lädt ein? | Reihenfolge |
|---|---|---|---|
| browsergame-base.de (Mario Kaufmann) | `info@browsergame-base.de` | **ja, wörtlich** | **zuerst** |
| webgamers.de (Wolfgang Scheidle) | `kontakt@webgamers.de` | **ja, wörtlich** – aber Seite wirkt seit 2023 still | zweitens |
| bestebrowsergames.de (Tolle & Wendt GbR) | `kontakt@bestebrowsergames.de` | nein | Kaltpitch |
| weltraumspiele.de (IDGV GmbH) | `info@idgv.info` | nein | Kaltpitch, geringste Aussicht |

Die Adresse bei browsergame-base.de steht auf der Seite Cloudflare-verschleiert; jeder Browser mit
JavaScript zeigt sie im Klartext an. Falls dort im Impressum zusätzlich eine `redaktion@`-Adresse
steht, ist die der bessere Empfänger.

---

### 1. An browsergame-base.de — `info@browsergame-base.de`

Die Seite lädt wörtlich ein: „Bist Du selbst Entwickler/Publisher oder vermisst hier noch einen
bestimmten Artikel? Dann schicke Deine Vorschläge an uns." Sie führt die Kategorien **Weltraum**
und **Strategie** — also genau die zwei, in die das Spiel gehört.

> **Betreff:** Vorschlag für einen Testbericht: Kolonie Kepler-7 (Weltraum / Strategie)
>
> Hallo Herr Kaufmann,
>
> auf browsergame-base.de laden Sie Entwickler ein, fehlende Spiele vorzuschlagen — hiermit mache
> ich das für mein eigenes.
>
> **Kolonie Kepler-7** (https://www.gamegeeeeek.de/) passt in Ihre Kategorien **Weltraum** und
> **Strategie**: Kolonieaufbau mit sechs Ressourcen, Forschungsbaum, über zwanzig Schiffstypen mit
> Konterrollen, gemeinsame Galaxie mit Allianzen, Weltbossen und PvP. Die Produktion läuft offline
> weiter.
>
> Kostenlos, ohne Download, ohne Bezahlvorteile — Spenden schalten ausschließlich Kosmetik frei.
> Kein Tracking, keine Werbung. Ich entwickle allein und liefere fast täglich aus; die öffentliche
> Patchnote-Seite zeigt das (https://www.gamegeeeeek.de/patchnotes.html).
>
> Für einen Testbericht stelle ich gerne Bildmaterial bereit oder beantworte Fragen.
>
> Viele Grüße

### 2. An webgamers.de — `kontakt@webgamers.de`

Betreiber **Wolfgang Scheidle** schreibt wörtlich: „Um möglichst umfangreich berichten zu können,
bin ich auf Euren Input angewiesen" und „Gerne stehe ich für Interviews bereit".

**Erwartung dämpfen:** Der jüngste erkennbare Inhalt stammt aus 2023. Die Einladung ist echt, aber
die Seite wirkt eingeschlafen. Kosten: eine E-Mail. Mehr sollte man nicht einplanen.

> **Betreff:** Kolonie Kepler-7 – deutsches Weltraum-Browsergame, Einzelentwickler
>
> Hallo Herr Scheidle,
>
> auf webgamers.de schreiben Sie, dass Sie für Ihre Berichterstattung auf Input aus der Szene
> angewiesen sind — deshalb melde ich mich mit meinem eigenen Projekt.
>
> **Kolonie Kepler-7** (https://www.gamegeeeeek.de/) ist ein deutsches Weltraum-Aufbauspiel im
> Browser: Kolonie ausbauen, forschen, Flotten aufstellen, geteilte Galaxie mit Allianzen und PvP,
> Idle-Fortschritt läuft offline weiter. Kein Download, keine Bezahlvorteile, kein Tracking, keine
> Werbung.
>
> Zwei Dinge, die es vielleicht von anderen Einsendungen unterscheiden: Ich entwickle es allein und
> liefere fast täglich aus — die öffentliche Patchnote-Seite zeigt das
> (https://www.gamegeeeeek.de/patchnotes.html). Und das Spiel läuft auf einem Raspberry Pi bei mir
> zu Hause, nicht in einer Cloud.
>
> Ihr Angebot für ein Interview würde ich gerne annehmen, wenn es Ihnen passt. Über die technische
> Seite kann ich ausführlich Auskunft geben.
>
> Viele Grüße

### 3. Kaltpitch an bestebrowsergames.de — `kontakt@bestebrowsergames.de`

**Keine Einladung, kein Formular** — am Original bestätigt. Das ändert den Ton: Hier wird nicht um
eine Eintragung gebeten, sondern ein Thema angeboten. Deshalb steht der Aufhänger vorn und die
Spielbeschreibung dahinter; und es wird ausdrücklich nichts erwartet.

> **Betreff:** Themenvorschlag: Ein Browsergame, das auf einem Raspberry Pi im Wohnzimmer läuft
>
> Hallo Herr Tolle, hallo Herr Wendt,
>
> Sie führen in Ihrer Weltraum-Rubrik überwiegend die großen Titel. Vielleicht ist als Kontrast
> etwas Kleines interessant: **Kolonie Kepler-7** (https://www.gamegeeeeek.de/) ist ein deutsches
> Weltraum-Aufbauspiel, das ich allein entwickle und das auf einem Raspberry Pi bei mir zu Hause
> läuft — kein Publisher, keine Cloud, kein Werbenetzwerk.
>
> Inhaltlich: Kolonieaufbau mit sechs Ressourcen, Forschungsbaum, über zwanzig Schiffstypen mit
> Konterrollen, geteilte Galaxie mit Allianzen, Weltbossen und PvP; die Produktion läuft offline
> weiter. Kostenlos, ohne Download, ohne Bezahlvorteile — Spenden schalten nur Kosmetik frei.
>
> Ich weiß, dass Sie keine offene Einreichung anbieten, und erwarte nichts. Falls es doch passt,
> stelle ich gerne Bildmaterial bereit.
>
> Viele Grüße

### 4. Kaltpitch an weltraumspiele.de — `info@idgv.info`

**Geringste Aussicht der vier.** Die Seite gehört der **IDGV GmbH** (Geschäftsführer Matti Gittel,
inhaltlich verantwortlich André Nowak) — ein Firmennetzwerk, das eher bezahlte Platzierung verkauft,
als einen Gefallen zu tun. Dafür ist der Themenkreis der engste überhaupt: ausschließlich
Weltraumspiele.

**Deshalb die Frage offen stellen**, statt um einen Gefallen zu bitten: Wenn eine Aufnahme
kostenpflichtig ist, will man das wissen, bevor man drei Mails schreibt.

> **Betreff:** Aufnahme in die Spieleliste – Kolonie Kepler-7 (deutsches Weltraum-Browsergame)
>
> Hallo, Herr Nowak,
>
> weltraumspiele.de führt ausschließlich Weltraumspiele — genau das ist mein Projekt, deshalb frage
> ich an.
>
> **Kolonie Kepler-7** (https://www.gamegeeeeek.de/) ist ein deutsches Weltraum-Aufbauspiel im
> Browser: Kolonieaufbau mit sechs Ressourcen, Forschungsbaum, über zwanzig Schiffstypen mit
> Konterrollen, geteilte Galaxie mit Allianzen, Weltbossen und PvP, Idle-Fortschritt läuft offline
> weiter. Kostenlos, kein Download, keine Bezahlvorteile.
>
> Auf der Seite habe ich keinen Einreichungsweg gefunden. Deshalb zwei Fragen: Nehmen Sie
> Vorschläge überhaupt entgegen — und wäre eine Aufnahme kostenpflichtig? Beides beantworten Sie mir
> gerne kurz; ich richte mich danach.
>
> Bildmaterial stelle ich auf Wunsch bereit.
>
> Viele Grüße

---

**Zur Anrede:** Alle vier Namen stammen aus dem jeweiligen Impressum. Bei
`bestebrowsergames.de` sind zwei Gesellschafter eingetragen (Manuel Tolle, Alexander Wendt) — beide
zu nennen ist richtiger, als einen zu raten. Bei `weltraumspiele.de` ist **André Nowak** inhaltlich
verantwortlich, der Geschäftsführer heißt anders; angeschrieben wird deshalb Nowak.
