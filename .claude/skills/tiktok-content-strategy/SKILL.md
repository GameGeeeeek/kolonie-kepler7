---
name: tiktok-content-strategy
description: 'Erstellt TikTok-Inhalte für Kolonie Kepler-7 – Hooks, Skripte, Schnittpläne, Captions, Hashtags und Veröffentlichungsplan für kurze Hochformat-Videos, die das Spiel zeigen. Nutzen, wenn nach TikTok, Kurzvideo, Reels, Shorts, Video-Skript, Hook, Caption, Social-Media-Plan oder Content-Ideen für das Spiel gefragt wird. Zieht alle Spielaussagen aus dem Repo (PATCHNOTES, Spieldatei, Landingpages) statt sie zu erfinden.'
---

# TikTok-Content für Kolonie Kepler-7

Kurzvideos für ein Spiel, das keine 3D-Weltraumsimulation ist, sondern eine
Kommandozentrale aus Text, Zahlen und Listen. Das ist die zentrale
Schwierigkeit und zugleich der Hebel: Was hier verkauft wird, ist nicht Grafik,
sondern **Entscheidung, Fortschritt und geteilte Galaxie**.

## Wann diese Skill greift

- Video-Ideen, Skripte oder Schnittpläne für TikTok (auch Reels/Shorts – gleiche Struktur)
- Hooks und Captions zu einem konkreten Feature oder Patch
- Veröffentlichungsplan, Serienformate, Themenrotation
- Ein Patchnote soll zu einem Video werden
- Bestehende Video-Idee gegenmessen: stimmt das noch, was sie behauptet?

Nicht dafür: bezahlte Werbung, TikTok-Shop, Influencer-Verträge. Dafür fehlen
im Repo die Grundlagen, und geraten wird hier nichts.

## Festgelegt: alle Aufnahmen von einem frischen Konto

Entscheidung von Sascha (07.08.2026). Gefilmt wird **nicht** von einem weit
entwickelten Konto, sondern von einem neuen – der Zuschauer sieht genau das,
was er nach dem Klick selbst bekommt. Das ist die Prämisse, unter der jedes
Skript entsteht, und sie ist mehr Vorteil als Einschränkung:

- **Der Einstieg ist der Inhalt.** Die häufigste Enttäuschung bei Spiel-Videos
  ist die Lücke zwischen Aufnahme und eigenem Konto. Die gibt es hier nicht.
- **Alle zwölf Reiter sind ab Sekunde eins offen.** Im Code existiert keine
  Tab-Sperre (kein `tabLocked`/`isTabUnlocked`), die Knöpfe stehen alle
  unbedingt im Markup (`weltraum_kolonie.html:3052–3066`). Auch **Galaxie** und
  **Sektorkarte** sind an Tag 1 begehbar – die geteilte Galaxie, die
  Fraktionsgebiete und die anderen Spieler sind also von Anfang an filmbar.
- **Das Startkonto hat genau ein Schiff** – ein Erkundungsschiff, sonst nichts
  (`fleet: { ships: 1, … }` im Startzustand, `weltraum_kolonie.html:16396`;
  `key:'ships'` heißt „Erkundungsschiffe", `:16832`). Diese Zahl ist ein
  Geschenk für Hooks und stimmt nachprüfbar. **Achtung beim Nachschlagen:**
  `ships:1` steht dreimal in der Datei – die beiden anderen Stellen (`:24131`,
  `:24330`) sind Prestige- und Aszensions-Reset, nicht der Neustart. Genau so
  ein Fehlgriff ist der Grund für die Belegzeile im Ausgabeformat.

Was **nicht** geht, und das ehrlich einplanen: Weltboss, Allianz-Raid und
große Flottenkämpfe sind an echten Fortschritt gebunden, nicht an die
Oberfläche. Sie sind in Woche 1 nicht filmbar. Zwei zulässige Auswege,
**beide nur so**:

1. **Warten und die Serie tragen lassen.** Das Konto reift mit dem Kanal; der
   Weltboss-Clip ist dann Folge 20 und keine Behauptung.
2. **Fremdes Endgame nur zitieren, nie als eigenes zeigen** – z. B. die
   Bestenliste oder ein Fraktionsgebiet im Galaxie-Reiter filmen und sagen,
   dass dort andere stehen. Was der eigene Kanal nicht erreicht hat, wird nicht
   so geschnitten, als hätte er es.

**Aufnahmedisziplin, die daraus folgt: Tag 1 gibt es genau einmal.** Ab dem
ersten Login wird mehr gefilmt, als je gesendet wird – die ersten Klicks, das
erste Gebäude, das erste Rückkehr-Fenster. Material lässt sich später schneiden,
aber nicht nachdrehen. Wer erst nach vier Wochen anfängt zu filmen, hat den
gesamten Einstieg verloren, also genau das, worauf diese Ausrichtung setzt.

## Grundhaltung: jede Behauptung hat einen Beleg im Repo

Dieses Projekt hat eine Hausregel, die für Marketing genauso gilt wie für Code:
**eine zweite Anzeigestelle, die die alte Annahme behält, ist der wiederkehrende
Fehler.** Ein Video ist so eine zweite Anzeigestelle – nur eine, die man nach
dem Hochladen nicht mehr patchen kann.

Deshalb, ohne Ausnahme:

1. **Keine Zahl, kein Feature, kein Superlativ ohne Fundstelle.** Wer „über 20
   Schiffstypen" sagt, hat vorher `SHIP_DEFS` gezählt.
2. **Nichts versprechen, was noch nicht auf `main` ist.** Live geht ein Push
   nach `main` von selbst (Deploy-Webhook). Ein Video zu einem Feature auf einem
   Feature-Branch zeigt Spielern etwas, das sie nicht finden.
3. **Im Zweifel weglassen.** Der Ton der Landingpages ist nüchtern und genau
   („Diese Seite erklärt, was das Spiel ausmacht und für wen es gedacht ist"),
   nicht marktschreierisch. Ein Video, das lauter ist als das Spiel, enttäuscht
   beim ersten Klick.

## Schritt 1 – Fakten holen

Vor dem ersten Satz Skript. Immer aus `weltraum_kolonie.html`, **nie** aus
`index.html` (die ist die Kopie und kann hinterherhinken):

```bash
cd /home/user/kolonie-kepler7

# Aktueller Stand und die letzten Patches – die beste Ideenquelle
grep -n "const VERSION" weltraum_kolonie.html | head -1
sed -n "$(grep -n 'const PATCHNOTES = \[' weltraum_kolonie.html | head -1 | cut -d: -f1),+60p" weltraum_kolonie.html

# Wie viele X gibt es wirklich? (Einträge zählen, nicht schätzen)
node -e "
const fs=require('fs'),t=fs.readFileSync('weltraum_kolonie.html','utf8');
for(const n of ['SHIP_DEFS','RESEARCH_DEFS','BUILDING_DEFS']){
  const i=t.indexOf('const '+n+' = [');
  const body=t.slice(i, t.indexOf('\n  ];', i));
  console.log(n.padEnd(15), (body.match(/^\s*\{\s*key:'/gm)||[]).length, 'Einträge');
}"

# Fertig formulierte, geprüfte Beschreibungstexte
sed -e 's/<[^>]*>//g' weltraum-browsergame.html   # Gesamtüberblick
sed -e 's/<[^>]*>//g' idle-spiel-browser.html     # Offline-Fortschritt
sed -e 's/<[^>]*>//g' allianzen-pvp.html          # Allianzen, PvP, Weltboss
sed -e 's/<[^>]*>//g' spielanleitung.html         # Einstieg, erste Schritte
```

Die vier Landingpages sind bereits redigierte, faktisch geprüfte Prosa über das
Spiel. **Sie sind die bevorzugte Quelle für Video-Texte** – umformulieren auf
Sprechsprache, nicht neu erfinden.

## Schritt 2 – Format wählen

Fünf Säulen, bewusst unterschiedlich im Aufwand. Eine gesunde Woche mischt
mindestens drei davon.

| Säule | Was es zeigt | Ab wann filmbar | Beispielaufhänger |
|---|---|---|---|
| **Tagebuch** | Dasselbe Konto wächst | Tag 1 | „Tag 6. Immer noch ein Schiff." |
| **Entscheidung** | Zwei Wege, ein Zug | Tag 1 | „Mine oder Forschungslabor?" |
| **Patch-Video** | Was diese Woche neu ist | jederzeit | Neues Feld, neues Schiff, behobener Ärger |
| **Erklärstück** | Eine Mechanik in 30 s | Tag 1 | Warum Offline-Ertrag gedeckelt ist |
| **Galaxie lebt** | Dass andere real mitspielen | Tag 1 (klein) / später (groß) | Fraktionsgebiet, Bestenliste – später Weltboss |

**Das Tagebuch ist die Wirbelsäule des Kanals**, nicht eine Säule unter fünf.
Ein frisches Konto hat genau eine Geschichte, die kein anderes Video hat: die
eigene. Serientitel festlegen („Kolonie-Tagebuch: Tag N"), gleicher
Bildausschnitt, gleiche Endkachel, gleiche Schlusszahl – die Wiedererkennung
über Folgen hinweg ist bei einem neuen Kanal wertvoller als jeder einzelne
Treffer.

**„Galaxie lebt" fällt trotz frischem Konto nicht aus**, sie wechselt nur die
Perspektive. Der stärkste Unterschied zu den hundert anderen Idle-Spielen ist,
dass die Galaxie geteilt und nicht generiert ist – NPC-Fraktionen erweitern ihr
Gebiet und führen Krieg weiter, auch wenn niemand zusieht, und montags kommen
Systeme dazu. Vom kleinen Konto aus zeigt man das nicht als Machtdemonstration,
sondern **als Größenverhältnis**: ein Punkt neben Gebieten, die anderen gehören.
„Ich bin hier der Kleinste" ist als Video ehrlicher und für den Zuschauer
näher als jeder Endgame-Flex – und er kann es sofort nachstellen.

## Schritt 3 – Hook (0–3 s)

Der Hook ist der einzige Teil, an dem sich der Erfolg entscheidet. Er muss
**ohne Ton, ohne Vorwissen und ohne Spielname** funktionieren.

Brauchbare Muster für dieses Spiel:

- **Die kleine Zahl:** „Ich habe genau ein Schiff." (Stimmt am Tag 1 wörtlich –
  `fleet:{ships:1,…}`. Kleine Zahlen sind für einen neuen Kanal **stärker** als
  große: nachprüfbar, sofort nachstellbar, und sie erzeugen die Frage „und
  dann?", die zur nächsten Folge führt.)
- **Größenverhältnis:** „Das hier gehört alles anderen. Das da bin ich." –
  Galaxie-Reiter, Fraktionsgebiet, dann der eigene Punkt.
- **Widerspruch:** „Ein Weltraumspiel ohne einen einzigen 3D-Effekt. Und ich
  komme trotzdem nicht davon los."
- **Entscheidung an den Zuschauer:** „Du hast Rohstoffe für genau ein Gebäude.
  Mine oder Forschungslabor?" – Antwort erst am Ende.
- **Fehler zugeben:** „Ich habe alles in einen Schiffstyp gesteckt. Das war
  falsch." (Konterrollen: reine Masse eines Typs ist selten die beste Antwort –
  echte Mechanik, keine erfundene Pointe. Zahl erst nennen, wenn sie im eigenen
  Spielstand wirklich so steht.)
- **Gegen das Genre:** „Kein Download, kein Konto-Zwang, keine Energie-Leiste,
  die dich rauswirft."

Was hier **nicht** funktioniert: „Schaut euch mal dieses Spiel an", jede Form
von „Du wirst nicht glauben", und alles, was erst nach dem Spielnamen
interessant wird.

**Vom frischen Konto aus verboten:** jeder Hook, der Erfahrung oder Größe
behauptet, die das Konto nicht hat – „seit Monaten täglich", „meine Flotte",
„nach 500 Stunden". Das ist der naheliegendste Griff, weil er Autorität
vortäuscht, und der erste, den ein Zuschauer im nächsten Bild widerlegt sieht.

## Schritt 4 – Aufbau

Zielrichtung 25–40 s. Kürzer geht bei Patch-Videos, länger nur bei Erklärstücken.

| Zeit | Aufgabe | Fehler, der hier passiert |
|---|---|---|
| 0–3 s | Hook, Bild bewegt sich sofort | Logo-Intro, Begrüßung |
| 3–10 s | Zeigen, worum es geht – am echten Spiel | Über das Spiel reden statt es zu zeigen |
| 10–25 s | Die eine Idee zu Ende bringen | Drei Ideen halb |
| 25–35 s | Auflösung / Ergebnis / Antwort | Vergessene Frage aus dem Hook |
| Ende | CTA, **eine** Handlung | Drei CTAs gleichzeitig |

**Loop-Trick:** Endet das letzte Bild dort, wo das erste anfängt (gleicher
Bildausschnitt, gleiche Zahl), läuft das Video im Loop und die Wiedergabezeit
steigt, ohne dass jemand etwas tun muss.

## Schritt 5 – Aufnahme

Das Spiel ist eine Kommandozentrale. Es sieht im Hochformat auf dem Handy
**besser** aus als am Desktop – die Oberfläche ist genau dafür gebaut („Du
sollst dieselbe Kolonie am Rechner und unterwegs am Handy weiterspielen
können"). Deshalb:

- **Immer am Handy aufnehmen**, 9:16, `gamegeeeeek.de` im mobilen Browser.
  Desktop-Aufnahmen brauchen Zuschnitt und verlieren dabei die Hälfte.
- **Zoom auf das, worüber gesprochen wird.** Ganzer Bildschirm mit
  6-Punkt-Schrift ist auf einem Handy unlesbar. Lieber eine Box formatfüllend.
- **Wenig, aber sichtbare Bewegung:** Warteschlange füllen, Zahl hochlaufen
  lassen, Reiter wechseln. Ein Standbild mit Voiceover verliert.
- **Untertitel sind Pflicht**, nicht Kür – ein großer Teil schaut ohne Ton.
- Der Offline-Fortschritt liefert die dankbarste Bildidee überhaupt: das
  Rückkehr-Fenster mit der Aufstellung dessen, was zusammengekommen ist. Auf
  einem frischen Konto sind die Zahlen darin klein – **das ist kein Mangel,
  sondern der Beweis, dass ehrlich gefilmt wird.** Nicht auf ein starkes Konto
  ausweichen, um das Fenster voller aussehen zu lassen.

**Rohmaterial sammeln, nicht pro Video drehen.** Bei jeder Spielsitzung
mitlaufen lassen und wegsichern; geschnitten wird später. Zwei Dinge dabei
konsequent festhalten, weil sie sich nie wiederholen:

- **Jeden Sitzungsanfang** – das Rückkehr-Fenster mit der Zeit seit dem letzten
  Login. Das ist die Zeitachse der ganzen Serie.
- **Jedes „erste Mal"** – erstes Gebäude, erste Forschung, erstes zweites
  Schiff, erste Expedition, erster Kontakt mit einem anderen Spieler, erste
  Niederlage. Diese Aufnahmen sind später der Serienkern und lassen sich mit
  keinem Aufwand der Welt nachholen.

## Schritt 6 – Caption, Hashtags, CTA

- **Caption:** ein Satz, der den Hook *nicht* wiederholt, sondern ergänzt oder
  eine Frage stellt (Kommentare sind das stärkste Signal).
- **Hashtags:** 3–5, gemischt aus breit und eng. Breit: `#browsergame`
  `#idlegame` `#aufbauspiel`. Eng: `#weltraumspiel` `#indiegame`
  `#gamedev`. Keine 20er-Wolke, keine Hashtags zu Themen, die im Video nicht
  vorkommen.
- **Sprache: Deutsch.** Spiel, Landingpages, Patchnotes und Hilfe sind
  durchgehend deutsch; englischsprachiges Publikum landet auf einer deutschen
  Oberfläche. Das ist eine bewusste Entscheidung, keine Auslassung.
- **CTA:** genau einer. Der Link gehört in die Bio (`gamegeeeeek.de`), nicht in
  die Caption – klickbare Links stehen in TikTok-Captions nicht zur Verfügung.
  Guter CTA: „Link in der Bio, kostenlos, kein Download." Schlechter CTA:
  „Folgt mir, liked, kommentiert und spielt."
- **Nicht bewerben:** Ko-fi/Spenden gehören nicht in einen TikTok-CTA. Wer das
  Spiel mag, findet das im Spiel.

## Kadenz und Serien

- **3 Videos pro Woche** ist die realistische Untergrenze, bei der ein Kanal
  überhaupt Fahrt aufnimmt. Zwei davon sollten billig produzierbar sein
  (Patch-Video, Erklärstück), damit die Kadenz nicht am Aufwand stirbt.
- **Feste Wochenform**, solange das Konto jung ist: eine Tagebuch-Folge
  (Wirbelsäule), ein Erklärstück oder eine Entscheidung (aus vorhandenem
  Material schneidbar), ein Patch-Video (Thema kommt von selbst).
- **Die Tagebuch-Nummerierung ist die Kontozeit, nicht die Sendezeit.** „Tag 6"
  heißt Tag 6 im Spiel. Wird eine Folge später gesendet, bleibt die Nummer –
  sonst stimmt die einzige Zahl nicht mehr, die die Serie zusammenhält.
- **Patch-Tag als Anker:** Jeder Push nach `main` geht sofort live. Ein Video
  am selben Tag zum sichtbarsten Punkt des Patches kostet wenig und hat immer
  ein Thema. Vorsicht bei der einen Reibung mit dem frischen Konto: Betrifft
  der Patch etwas, das ein junges Konto gar nicht sieht (Allianzbasis,
  Superschiffe, späte Forschung), wird es **erklärt statt vorgeführt** – oder
  es fällt aus. Ein Patch-Video, das Zugriff vortäuscht, kippt die ganze
  Ausrichtung.

## Was nicht geht

- **Erfundene Zahlen, Spielerzahlen, Bewertungen oder Auszeichnungen.** Das
  Spiel wird von einer Person gebaut; jede aufgeblasene Zahl fliegt auf.
- **Fremdes Material** – kein Musikstück, kein Clip, kein Bild ohne
  gesicherte Rechte. TikToks eigene Bibliothek nutzen.
- **Vergleichende Herabsetzung** namentlich genannter anderer Spiele.
- **Engagement-Bait**, das TikToks Richtlinien verletzt (Gewinnspiele mit
  Teilen-Zwang, „kommentiere X für einen Vorteil im Spiel").
- **Spielvorteile für Social-Media-Aktionen** – das ist auch mechanisch eine
  schlechte Idee, weil belohnte Aktionen im Spiel bewusst gedeckelt sind.
- **Fortschritt vortäuschen, den das Konto nicht hat.** Kein Umschnitt auf ein
  starkes Konto, keine Aufnahme aus einer alten Sitzung als „heute", keine
  Tagesnummer, die nicht der Kontozeit entspricht. Die ganze Ausrichtung „Du
  siehst genau, was du selbst bekommst" hält nur, solange das ausnahmslos gilt –
  ein einziger geschönter Clip macht rückwirkend jede vorherige Zahl fraglich.

## Ausgabeformat

Wird nach Videos gefragt, wird **pro Video** dieses Gerüst geliefert – nicht
mehr Prosa drumherum:

```
### Video N – <Titel> [Säule]
Hook (0–3 s):   <exakter gesprochener/eingeblendeter Satz>
Bild:           <was zu sehen ist, Reiter/Box konkret benannt>
Skript:         <3–6 Sätze Sprechtext, sprechbar, keine Schriftsprache>
Auflösung:      <die Antwort/Pointe am Ende>
Caption:        <ein Satz>
Hashtags:       <3–5>
CTA:            <einer>
Beleg:          <Datei:Zeile oder Landingpage-Absatz für jede harte Aussage>
```

Die Zeile **Beleg** ist nicht optional. Sie ist der ganze Unterschied zwischen
dieser Skill und einer allgemeinen TikTok-Beratung.

## Offene Punkte

Diese Skill trifft bewusst keine Annahme dazu – vor dem ersten
Veröffentlichungsplan mit Sascha klären:

- Gibt es bereits einen TikTok-Kanal, und wenn ja, mit welchem Bestand?
- Erscheint eine Person im Bild oder bleibt es reine Bildschirmaufnahme mit
  Stimme/Text?

Geklärt (07.08.2026): **frisches Konto** – siehe den Abschnitt „Festgelegt"
oben.
