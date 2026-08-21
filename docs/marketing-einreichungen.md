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

---

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
