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

> Browser-based space empire builder (German language). Expand your colony, research technologies,
> build fleets and share one galaxy with all players. Idle progress continues offline. Free, no
> download, no pay-to-win.

*(215 Zeichen)*

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

| Feld | Eintrag |
|---|---|
| Game Name | `Kolonie Kepler-7` |
| Game Website | `https://www.gamegeeeeek.de/` |
| Game Type | `MMO Strategy` |
| Graphics | `2D` |
| Client Type | `Browser Based` |
| Point of View | `Multi` |
| Subscription | `Free` |
| Retail Price | `Free` |
| Description | mittlere englische Fassung |

### browsergame-base.de — **per E-Mail, Vorlage in Abschnitt 6**

Kategorien dort: **Weltraum** („Science-Fiction und Weltraumspiele") und **Strategie**.

### browsergame-index.de/browsergame-melden

Formularweg; Kontakt `webmaster@browsergame-index.de`. Kategorie Weltraum vorhanden.
*Die Seite wirkt eingeschlafen (News zuletzt 2010) – der Eintrag zählt vor allem als Backlink.*

### bbogd.com · mmorpg.com/games-list · mmohub.com

Direkte Einreichung auf der jeweiligen Seite, mittlere englische Fassung, Kategorie Sci-Fi/Strategy.

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

### An webgamers.de — **Priorität 1**

> **Betreff:** Kolonie Kepler-7 – deutsches Weltraum-Browsergame, Einzelentwickler
>
> Hallo Herr Scheidle,
>
> auf webgamers.de habe ich gelesen, dass Sie für Ihre Berichterstattung auf Zusendungen aus der
> Szene angewiesen sind – deshalb melde ich mich mit meinem eigenen Projekt.
>
> **Kolonie Kepler-7** (https://www.gamegeeeeek.de/) ist ein deutsches Weltraum-Aufbauspiel im
> Browser: Kolonie ausbauen, forschen, Flotten aufstellen, geteilte Galaxie mit Allianzen und PvP,
> Idle-Fortschritt läuft offline weiter. Kein Download, keine Bezahlvorteile, kein Tracking, keine
> Werbung.
>
> Zwei Dinge, die es vielleicht von anderen Einsendungen unterscheiden: Ich entwickle es allein und
> liefere fast täglich aus – die öffentliche Patchnote-Seite zeigt das
> (https://www.gamegeeeeek.de/patchnotes.html). Und das Spiel läuft auf einem Raspberry Pi bei mir
> zu Hause, nicht in einer Cloud.
>
> Ihr Angebot für ein Interview würde ich gerne annehmen, wenn es Ihnen passt. Über die technische
> Seite kann ich ausführlich Auskunft geben.
>
> Viele Grüße

### An browsergame-base.de

> **Betreff:** Vorschlag für einen Testbericht: Kolonie Kepler-7 (Weltraum)
>
> Hallo,
>
> auf browsergame-base.de laden Sie dazu ein, fehlende Spiele per E-Mail vorzuschlagen – hiermit
> mache ich das für mein eigenes.
>
> **Kolonie Kepler-7** (https://www.gamegeeeeek.de/) passt in Ihre Kategorien **Weltraum** und
> **Strategie**: Kolonieaufbau mit sechs Ressourcen, Forschungsbaum, über zwanzig Schiffstypen mit
> Konterrollen, gemeinsame Galaxie mit Allianzen, Weltbossen und PvP. Die Produktion läuft offline
> weiter.
>
> Kostenlos, ohne Download, ohne Bezahlvorteile – Spenden bringen ausschließlich Kosmetik. Für einen
> Testbericht stelle ich gerne Material bereit oder beantworte Fragen.
>
> Viele Grüße

### An weltraumspiele.de und bestebrowsergames.de

Wie oben, mit einem angepassten Einstiegssatz: Bei **weltraumspiele.de** die Passung betonen (die
Seite führt ausschließlich Weltraumspiele), bei **bestebrowsergames.de** die Kategorie Weltraum
nennen.
