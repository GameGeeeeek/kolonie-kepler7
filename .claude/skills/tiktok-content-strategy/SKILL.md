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

## Festgelegt (Entscheidungen von Sascha, 07.08.2026)

Drei Festlegungen, unter denen jedes Skript entsteht. Sie sind keine
Randbedingungen, sondern die Form des Kanals:

1. **Aufnahmen von einem frischen Spielkonto**, nicht von einem weit
   entwickelten.
2. **Der TikTok-Kanal existiert bereits** – es ist kein Start bei null.
3. **Keine Person im Bild.** Bildschirmaufnahme plus Stimme, sonst nichts.

### 1 – Frisches Spielkonto

Der Zuschauer sieht genau das, was er nach dem Klick selbst bekommt. Mehr
Vorteil als Einschränkung:

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

### 2 – Bestehender Kanal

Der Kanal ist da, es wird also nicht bei null angefangen. **Was darauf liegt,
kann diese Skill nicht sehen** – vor der ersten Tagebuch-Folge nachsehen und
danach entscheiden:

- **Liegt dort schon Spielmaterial von einem entwickelten Konto?** Dann ist der
  Neuanfang eine Aussage, die ausgesprochen werden muss, nicht verschwiegen:
  „Neues Konto, ich fange bei null an." Die alten Videos bleiben sichtbar und
  auffindbar; ein Tagebuch, das so tut, als hätte es nie etwas anderes gegeben,
  wird vom eigenen Kanal widerlegt. Genau derselbe Fehlertyp wie eine zweite
  Anzeigestelle im Code.
- **Geht es dort um etwas ganz anderes?** Dann bewusst entscheiden: sauberer
  Themenwechsel mit einer Folge, die ihn benennt – oder ein eigener Kanal.
  Beides ist vertretbar, ein stilles Nebeneinander nicht.
- **Ist der Kanal praktisch leer?** Dann verhält es sich wie ein Neustart, und
  es ist nichts weiter zu beachten.

**Nichts löschen, um „aufzuräumen".** Alte Videos sind Kanalhistorie und
kosten nichts; die Serie wird stattdessen angepinnt und trägt sich über ihre
eigene Nummerierung.

Für den Zuschnitt der Videos ändert der bestehende Kanal wenig: Der weit
überwiegende Teil der Aufrufe kommt über den Vorschlags-Feed, nicht über
Abonnenten. **Jede Folge muss deshalb für jemanden funktionieren, der weder
den Kanal noch das Spiel kennt** – kein „wie letzte Woche besprochen", kein
Rückverweis, der Vorwissen verlangt. Ein Satz Einordnung im Hook („Tag 6 in
diesem Weltraum-Aufbauspiel") reicht und kostet nichts.

### 3 – Bild und Stimme, keine Person

Ohne Gesicht trägt die Stimme die gesamte Persönlichkeit des Kanals, und das
Bild trägt die gesamte Aufmerksamkeit. Beides hat Folgen:

- **Gesprochene Sätze, keine geschriebenen.** Die Texte des Spiels sind
  Schriftdeutsch – vorgelesen klingt das nach Bedienungsanleitung. Jedes Skript
  wird in Sprechsprache umgeschrieben: kurze Hauptsätze, keine verschachtelten
  Relativsätze, keine Abkürzungen, Zahlen ausgeschrieben, wie man sie sagt.
  **Probe: einmal laut lesen.** Wer stolpert, hat den Satz falsch gebaut.
- **Die Stimme ist das Wiedererkennungsmerkmal.** Eigene Stimme ist einer
  Computerstimme vorzuziehen – bei einem Projekt, das von einer Person gebaut
  wird, ist sie das einzige persönliche Element, das bleibt. Fällt die
  Entscheidung für eine synthetische Stimme, dann **eine einzige, dauerhaft
  dieselbe**; wechselnde Stimmen zerstören genau das, was hier den Kanal
  zusammenhält.
- **Das Bild muss die fehlende Person ersetzen.** Ohne Gesicht gibt es keinen
  Ruhepunkt, an dem ein Zuschauer hängenbleibt. Also: Schnitt bei jedem neuen
  Gedanken, Zoom auf die Stelle, über die gerade gesprochen wird, nie länger
  als zwei bis drei Sekunden dasselbe unbewegte Bild.
- **Ton im Spiel vor der Aufnahme ausschalten.** Das Spiel erzeugt eigene
  Klänge (`playSound`, `weltraum_kolonie.html:24384` – Oszillatortöne für Bau,
  Forschung, Treffer, Erfolg), und `soundOn` steht im Startzustand auf `true`
  (`:16453`). Ein frisch aufgesetztes Konto piept also von sich aus ins
  Voiceover. Der Schalter sitzt im Kopfbereich („Sound"). Bewusste Ausnahme:
  eine Folge, in der es *um* den Ton geht – dann ohne Sprache.
- **Stimme getrennt aufnehmen**, nicht während des Spielens. Sonst stecken
  Bediengeräusche und Denkpausen im Ton, und jede Korrektur erzwingt eine neue
  Bildschirmaufnahme.

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
| **Entscheidung** | Zwei Wege, ein Zug | Tag 1 | „Solarkraftwerk oder Erzmine?" |
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
  Welches?" – Antwort erst am Ende. **Gegenprobe nicht vergessen, welche
  Antworten überhaupt möglich sind:** Der Startbestand ist Energie 10 und Erz 10
  (`:16380`), das Solarkraftwerk kostet 10 Erz, die Erzmine 15 Energie und das
  Forschungslabor 150 Energie plus 80 Kristalle (`BUILDING_DEFS`; auf Stufe 0
  ist die Kosten gleich `baseCost`, `costFor` `:16579`). An Tag 1 ist also **nur
  das Solarkraftwerk** bezahlbar – ein Hook, der Mine oder Labor zur Wahl
  stellt, beschreibt eine Entscheidung, die es nicht gibt. Diese Skill hatte
  genau den Fehler im ersten Entwurf.
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
- **Untertitel sind Pflicht**, nicht Kür. Bei diesem Kanal mehr als sonst: Ohne
  Person im Bild steckt die gesamte Aussage in der Stimme – wer stumm schaut,
  sieht ohne Untertitel nur Zahlen, die sich ändern, und weiß nicht, warum.
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

## Was diese Skill nicht wissen kann

Alle drei Grundfragen sind am 07.08.2026 geklärt und stehen oben unter
„Festgelegt". Offen bleibt nur, was außerhalb des Repos liegt und deshalb
**nachgesehen statt angenommen** werden muss:

- **Der Bestand des Kanals** – wie viele Videos, welches Thema, welcher Ton.
  Danach richtet sich, ob die erste Tagebuch-Folge einen Neuanfang benennen
  muss (siehe „Festgelegt 2"). Wer diese Skill benutzt, sieht selbst nach oder
  fragt Sascha; geraten wird es nicht.
- **Der Spielstand des Aufnahmekontos** – Tagesnummer und alle Zahlen im Video
  kommen aus dem laufenden Konto, nicht aus dieser Datei. Die Datei liefert die
  Mechanik und den Beleg dafür, dass eine Zahl möglich ist, nie den Messwert
  selbst.
