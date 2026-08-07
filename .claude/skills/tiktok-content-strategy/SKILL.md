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

| Säule | Was es zeigt | Aufwand | Beispielaufhänger |
|---|---|---|---|
| **Patch-Video** | Was diese Woche neu ist | niedrig | Neues Feld, neues Schiff, behobener Ärger |
| **Entscheidung** | Zwei Wege, ein Zug | mittel | „Bergbau-Welt oder Festungs-Welt?" |
| **Fortschritt** | Vorher/nachher am selben Konto | mittel | Tag 1 gegen Tag 30 derselben Kolonie |
| **Galaxie lebt** | Dass andere real mitspielen | hoch | Fraktionskrieg, Weltboss, Allianz-Raid |
| **Erklärstück** | Eine Mechanik in 30 s | mittel | Warum Offline-Ertrag gedeckelt ist |

**Warum „Galaxie lebt" trotz Aufwand wichtig ist:** Der stärkste Unterschied zu
den hundert anderen Idle-Spielen ist, dass die Galaxie geteilt und nicht
generiert ist – NPC-Fraktionen erweitern ihr Gebiet und führen Krieg weiter,
auch wenn niemand zusieht, und montags kommen Systeme dazu. Das kann kein
Einzelspieler-Idler behaupten. Diese Säule nicht aus Bequemlichkeit ausfallen
lassen.

## Schritt 3 – Hook (0–3 s)

Der Hook ist der einzige Teil, an dem sich der Erfolg entscheidet. Er muss
**ohne Ton, ohne Vorwissen und ohne Spielname** funktionieren.

Brauchbare Muster für dieses Spiel:

- **Widerspruch:** „Ein Weltraumspiel ohne einen einzigen 3D-Effekt – und ich
  spiele es seit acht Monaten täglich."
- **Konkrete Zahl im Bild:** „Diese Kolonie produziert 40.000 Erz pro Stunde.
  Vor vier Wochen waren es 200." (Zahlen vorher am echten Spielstand ablesen.)
- **Entscheidung an den Zuschauer:** „Du hast Rohstoffe für genau ein Gebäude.
  Mine oder Forschungslabor?" – Antwort erst am Ende.
- **Fehler zugeben:** „Ich habe 300 Jäger gebaut. Das war der teuerste Fehler
  meiner Kolonie." (Konterrollen: reine Masse eines Typs ist selten die beste
  Antwort – das ist echte Mechanik, keine erfundene Pointe.)
- **Gegen das Genre:** „Kein Download, kein Konto-Zwang, keine Energie-Leiste,
  die dich rauswirft."

Was hier **nicht** funktioniert: „Schaut euch mal dieses Spiel an", jede Form
von „Du wirst nicht glauben", und alles, was erst nach dem Spielnamen
interessant wird.

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
  Rückkehr-Fenster mit der Aufstellung dessen, was zusammengekommen ist.

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
- **Ein Serienformat festlegen und durchhalten**, z. B. „Kolonie-Tagebuch:
  Tag N" mit demselben Konto, derselben Kachel, derselben Endzahl. Serien
  sammeln Wiedererkennung, Einzelvideos nicht.
- **Patch-Tag als Anker:** Jeder Push nach `main` geht sofort live. Ein Video
  am selben Tag zum sichtbarsten Punkt des Patches kostet wenig und hat immer
  ein Thema.

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
- Ein Konto für Aufnahmen (weit entwickelt, hohe Zahlen) oder ein frisches
  Konto, damit Zuschauer den Einstieg sehen?
